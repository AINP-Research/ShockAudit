import { describe, expect, it, vi } from "vitest";

import {
  CROSSREF_CONTEXTUAL_DISCOVERY_BUDGETS,
  CROSSREF_CONTEXTUAL_DISCOVERY_CHANNEL,
  CROSSREF_WORKS_API_ENDPOINT,
  buildCrossrefContextualDiscoveryRequest,
  createCrossrefContextSearchProvider,
  discoverCrossrefContextualLeads,
  selectScreen02ContextLeadSlots,
  type CrossrefContextualFetch,
} from "../../src/worker/crossref-contextual-discovery";
import type { Screen02ContextSearchLead } from
  "../../src/worker/screen02-search-expansion";

const retrievedAt = "2026-09-08T14:00:00.000Z";

function jsonResponse(body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", ...headers },
  });
}

function work(input: {
  doi?: string;
  title: string;
  publisher?: string;
  date?: number[];
  url?: string;
}) {
  return {
    DOI: input.doi,
    title: [input.title],
    publisher: input.publisher ?? "Research publisher",
    published: { "date-parts": [input.date ?? [2021, 4, 2]] },
    URL: input.url ??
      (input.doi ? `https://doi.org/${input.doi}` : undefined),
    // These fields model a noisy upstream response. The parser must ignore
    // them even if a fixture includes them.
    abstract: "Never retain this abstract.",
    score: 99,
    "is-referenced-by-count": 1_000,
  };
}

function providerInput() {
  return {
    mode: "find" as const,
    stage: "implementation" as const,
    query: "energy regulation",
    resultLimit: 5,
    retrievedAt,
    eventFamily: "Regulation",
    startDate: "2010-01-01",
    endDate: "2023-12-31",
    identity: null,
    signal: new AbortController().signal,
  };
}

describe("Crossref contextual research discovery", () => {
  it("makes exactly one selected-field v1/works request with rows=5 and no paging or retry", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetch: CrossrefContextualFetch = async (input, init) => {
      requests.push({ url: String(input), init });
      return jsonResponse({
        message: {
          items: [work({
            doi: "10.1234/example.1",
            title: "Federal Register 2018-03708 and electricity storage",
          })],
        },
      });
    };
    const result = await discoverCrossrefContextualLeads({
      fetch,
      query: "energy OR https://attacker.invalid private_outcome",
      retrievedAt,
    });

    expect(requests).toHaveLength(1);
    const url = new URL(requests[0]!.url);
    expect(`${url.origin}${url.pathname}`).toBe(CROSSREF_WORKS_API_ENDPOINT);
    expect(url.searchParams.get("rows")).toBe("5");
    expect(url.searchParams.get("query.title")).toBe(
      "energy OR https attacker invalid private outcome",
    );
    expect(url.searchParams.get("cursor")).toBeNull();
    expect(url.searchParams.get("offset")).toBeNull();
    expect(url.searchParams.get("select")).toBe(
      "DOI,title,publisher,published-print,published-online,published,URL",
    );
    expect(requests[0]!.init).toMatchObject({
      method: "GET",
      redirect: "manual",
      cache: "no-store",
    });
    expect(result).toMatchObject({
      diagnostics: {
        status: "searched",
        requestedResultLimit: 5,
        recordsReceived: 1,
        recordsAccepted: 1,
        workPagesFetched: 0,
        outcomeValuesInspected: false,
      },
    });
    expect(JSON.stringify(result)).not.toMatch(
      /Never retain this abstract|is-referenced-by-count|"score"/,
    );
  });

  it("deduplicates by canonical DOI or normalized title and caps accepted metadata", async () => {
    const result = await discoverCrossrefContextualLeads({
      fetch: async () => jsonResponse({ message: { items: [
        work({ doi: "10.1234/A", title: "First title" }),
        work({ doi: "https://doi.org/10.1234/a", title: "DOI duplicate" }),
        work({ doi: "10.1234/B", title: "First — title" }),
        work({ doi: "10.1234/C", title: "Second title" }),
        work({ doi: "10.1234/D", title: "Third title" }),
      ] } }),
      query: "regulation",
      retrievedAt,
      resultLimit: 2,
    });
    expect(result.leads.map((lead) => lead.title)).toEqual([
      "First title",
      "Second title",
    ]);
    expect(result.diagnostics).toMatchObject({
      recordsReceived: 5,
      duplicateRecordsDropped: 2,
      overBudgetRecordsDropped: 1,
    });
  });

  it("keeps publication timing separate from event identity and evidence", async () => {
    const provider = createCrossrefContextSearchProvider(async () =>
      jsonResponse({ message: { items: [work({
        doi: "10.1234/order-study",
        title: "Study of Federal Register document 2018-03708",
        date: [2022, 11, 9],
      })] } })
    );
    const leads = await provider(providerInput());
    expect(leads).toHaveLength(1);
    const lead = leads[0]!;
    if (lead.value.mode !== "find") throw new Error("Expected a Find lead.");
    expect(lead.formalIdentifier).toBeNull();
    expect(lead.value.nativeIdentity).toEqual({
      formalIdentifier: null,
      issuer: null,
      issuingJurisdiction: null,
      status: null,
    });
    expect(lead.value.event.eventDate).toMatch(/not event timing/i);
    expect(lead.value.provisionalDates).toEqual([
      "Research publication date only (not an event date): 2022-11-09",
    ]);
    expect(lead.value.sources[0]).toMatchObject({
      authorityTier: 6,
      channel: CROSSREF_CONTEXTUAL_DISCOVERY_CHANNEL,
    });
    expect(JSON.stringify(lead)).not.toContain("Never retain this abstract");
  });

  it("fails closed at the 128 KiB response cap", async () => {
    const fetch = vi.fn(async () =>
      new Response("{}", {
        headers: {
          "content-type": "application/json",
          "content-length": String(
            CROSSREF_CONTEXTUAL_DISCOVERY_BUDGETS.maximumResponseBytes + 1,
          ),
        },
      })
    );
    const result = await discoverCrossrefContextualLeads({
      fetch,
      query: "regulation",
      retrievedAt,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      leads: [],
      diagnostics: { status: "failed", failureReason: "response-too-large" },
    });
  });

  it("reserves three research and two reporting slots, then fills vacancies", () => {
    const lead = (
      id: string,
      channel: string,
    ): Screen02ContextSearchLead => ({
      recordId: id,
      canonicalIdentity: id,
      locator: `https://context.invalid/${id}`,
      value: {
        id,
        mode: "find",
        kind: "event",
        title: id,
        description: id,
        event: {
          displayName: id,
          eventDate: "Unknown",
          eventFamily: "Regulation",
          geographies: [],
          populations: [],
        },
        origin: "unsupported-lead",
        provisionalDates: [],
        affectedPopulation: "Unknown",
        requiredVariables: [],
        outcomeLink: { text: "Unknown", status: "system-template" },
        likelyServiceLevel: "event-reconnaissance",
        limitations: [],
        reasons: [],
        sources: [{
          id: `source-${id}`,
          title: id,
          locator: `https://context.invalid/${id}`,
          publisher: "Context",
          publishedDate: null,
          authorityTier: 6,
          channel,
        }],
      },
    });
    const reportingChannel =
      "Context to verify · contextual-secondary · GDELT DOC 2.0 metadata";
    const values = [
      lead("r1", CROSSREF_CONTEXTUAL_DISCOVERY_CHANNEL),
      lead("r2", CROSSREF_CONTEXTUAL_DISCOVERY_CHANNEL),
      lead("r3", CROSSREF_CONTEXTUAL_DISCOVERY_CHANNEL),
      lead("r4", CROSSREF_CONTEXTUAL_DISCOVERY_CHANNEL),
      lead("n1", reportingChannel),
      lead("n2", reportingChannel),
      lead("n3", reportingChannel),
    ];
    expect(selectScreen02ContextLeadSlots(values).map((item) => item.recordId))
      .toEqual(["r1", "r2", "r3", "n1", "n2"]);
    expect(
      selectScreen02ContextLeadSlots(
        [values[0]!, values[3]!, values[4]!, values[5]!, values[6]!],
      ).map((item) => item.recordId),
    ).toEqual(["r1", "r4", "n1", "n2", "n3"]);
  });

  it("builds a bounded request without exposing unsupported parameters", () => {
    const request = new URL(buildCrossrefContextualDiscoveryRequest({
      query: "electric storage",
      resultLimit: 5,
    }));
    expect([...request.searchParams.keys()].sort()).toEqual([
      "query.title",
      "rows",
      "select",
    ]);
  });
});
