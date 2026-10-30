import { describe, expect, it, vi } from "vitest";

import {
  CROSSREF_WORKS_API_ENDPOINT,
  type CrossrefContextualFetch,
} from "../../src/worker/crossref-contextual-discovery";
import {
  SIX_SCREEN_CROSSREF_LITERATURE_BUDGETS,
  discoverCrossrefLiteratureMetadata,
} from "../../src/worker/screen05-crossref-literature";

const retrievedAt = "2026-09-15T12:00:00.000Z";

function jsonResponse(body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", ...headers },
  });
}

function work(input: {
  doi?: string;
  title: string;
  date?: number[];
  url?: string;
}) {
  return {
    DOI: input.doi,
    title: [input.title],
    author: [
      { given: "Ada", family: "Lovelace" },
      { name: "Research Consortium" },
    ],
    publisher: "Research Publisher",
    "container-title": ["Journal of Institutional Change"],
    "published-online": { "date-parts": [input.date ?? [2024, 2, 29]] },
    type: "journal-article",
    URL: input.url ??
      (input.doi ? `https://doi.org/${input.doi}` : undefined),
    "update-to": [{
      DOI: "10.9999/CORRECTION.1",
      type: "correction",
      label: "Correction notice",
    }],
    "updated-by": [{
      DOI: "10.9999/RETRACTION.1",
      type: "retraction",
      label: "Retraction notice",
    }],
    abstract:
      "<jats:p>Organizational adaptation may follow participation.</jats:p>",
    link: [{ URL: "https://publisher.invalid/full-text.pdf" }],
    reference: [{ unstructured: "NEVER_RETAIN_THIS_REFERENCE" }],
  };
}

describe("Screen 5 Crossref literature metadata", () => {
  it("makes one bounded selected-field request and retains bibliographic identity only", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetch: CrossrefContextualFetch = async (request, init) => {
      requests.push({ url: String(request), init });
      return jsonResponse({ message: { items: [work({
        doi: "10.1234/EXAMPLE.1",
        title: "<i>Participation</i> and organizational adaptation",
      })] } });
    };
    const result = await discoverCrossrefLiteratureMetadata({
      fetch,
      query: "participation OR https://attacker.invalid private_outcome",
      retrievedAt,
    });

    expect(requests).toHaveLength(1);
    const url = new URL(requests[0]!.url);
    expect(`${url.origin}${url.pathname}`).toBe(CROSSREF_WORKS_API_ENDPOINT);
    expect([...url.searchParams.keys()].sort()).toEqual([
      "query.bibliographic",
      "rows",
      "select",
    ]);
    expect(url.searchParams.get("query.bibliographic")).toBe(
      "participation OR https attacker invalid private outcome",
    );
    expect(url.searchParams.get("rows")).toBe("5");
    expect(url.searchParams.get("select")).toBe(
      "DOI,title,author,publisher,container-title,published-print,published-online,published,type,URL,update-to,updated-by,abstract",
    );
    expect(requests[0]!.init).toMatchObject({
      method: "GET",
      redirect: "manual",
      cache: "no-store",
    });
    expect(result).toMatchObject({
      diagnostics: {
        status: "searched",
        recordsReceived: 1,
        recordsAccepted: 1,
        abstractFieldsInspected: true,
        fullTextLocationsFollowed: 0,
        citationNeighborhoodHops: 0,
      },
      records: [{
        providerNativeId: "10.1234/example.1",
        doi: "10.1234/example.1",
        title: "Participation and organizational adaptation",
        authors: ["Ada Lovelace", "Research Consortium"],
        publicationYear: 2024,
        publishedDate: "2024-02-29",
        publicationVenue: "Journal of Institutional Change",
        publisher: "Research Publisher",
        workType: "journal-article",
        stableLocator: "https://doi.org/10.1234/example.1",
        abstractText:
          "Organizational adaptation may follow participation.",
        abstractSource: "crossref_member_deposit",
        updateRelations: [
          {
            relationType: "update_to:correction",
            relatedDoi: "10.9999/correction.1",
            label: "Correction notice",
          },
          {
            relationType: "updated_by:retraction",
            relatedDoi: "10.9999/retraction.1",
            label: "Retraction notice",
          },
        ],
      }],
    });
    expect(JSON.stringify(result)).not.toMatch(
      /publisher\.invalid|NEVER_RETAIN_THIS_REFERENCE|unstructured/iu,
    );
  });

  it("deduplicates by DOI or normalized title and caps accepted records", async () => {
    const result = await discoverCrossrefLiteratureMetadata({
      fetch: async () => jsonResponse({ message: { items: [
        work({ doi: "10.1234/A", title: "First title" }),
        work({ doi: "https://doi.org/10.1234/a", title: "DOI duplicate" }),
        work({ doi: "10.1234/B", title: "First — title" }),
        work({ doi: "10.1234/C", title: "Second title" }),
        work({ doi: "10.1234/D", title: "Third title" }),
      ] } }),
      query: "market participation",
      retrievedAt,
      resultLimit: 2,
    });

    expect(result.records.map(({ title }) => title)).toEqual([
      "First title",
      "Second title",
    ]);
    expect(result.diagnostics).toMatchObject({
      recordsReceived: 5,
      recordsAccepted: 2,
      duplicateRecordsDropped: 2,
      overBudgetRecordsDropped: 1,
    });
  });

  it.each([
    {
      name: "HTTP errors",
      response: () => new Response("unavailable", { status: 503 }),
      reason: "http_failure",
    },
    {
      name: "oversized bodies",
      response: () => new Response("{}", { headers: {
        "content-type": "application/json",
        "content-length": String(
          SIX_SCREEN_CROSSREF_LITERATURE_BUDGETS.maximumResponseBytes + 1,
        ),
      } }),
      reason: "response_too_large",
    },
    {
      name: "malformed JSON",
      response: () => new Response("{", { headers: {
        "content-type": "application/json",
      } }),
      reason: "malformed_json",
    },
  ])("returns a typed failure for $name", async ({ response, reason }) => {
    const fetch = vi.fn(async () => response());
    const result = await discoverCrossrefLiteratureMetadata({
      fetch,
      query: "market participation",
      retrievedAt,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      records: [],
      diagnostics: { status: "failed", failureReason: reason },
    });
  });
});
