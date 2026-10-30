import { describe, expect, it, vi } from "vitest";

import type { Screen02WorkflowHandoff } from "../../src/core/screen02-workflow-handoff";
import {
  buildScreen03EvidenceSynthesisRequest,
} from "../../src/worker/screen03-evidence-synthesis";
import {
  CONTEXTUAL_DISCOVERY_BUDGETS,
  CONTEXTUAL_DISCOVERY_CHANNEL,
  CONTEXTUAL_DISCOVERY_SOURCE_ROLE,
  GDELT_DOC_API_ENDPOINT,
  boundedContextualDiscoveryQuery,
  buildGdeltContextualDiscoveryRequest,
  createGdeltContextSearchProvider,
  discoverGdeltContextualLeads,
  gdeltLeadToScreen02ContextLead,
  gdeltLeadToScreen03Evidence,
  type ContextualDiscoveryFetch,
  type GdeltContextualLead,
} from "../../src/worker/contextual-discovery";

const retrievedAt = "2026-08-13T16:00:00.000Z";

function jsonResponse(body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", ...headers },
  });
}

function article(input: {
  url: string;
  title: string;
  seenDate?: string;
  language?: string;
  sourceCountry?: string;
}) {
  return {
    url: input.url,
    title: input.title,
    seendate: input.seenDate ?? "20260801T120000Z",
    language: input.language ?? "English",
    sourcecountry: input.sourceCountry ?? "United States",
  };
}

function successfulInput(fetch: ContextualDiscoveryFetch) {
  return {
    fetch,
    query: "technology regulation implementation",
    startDate: "2026-01-01",
    endDate: "2026-08-13",
    retrievedAt,
    resultLimit: 5,
    timeoutMs: 100,
  };
}

function lead(): GdeltContextualLead {
  return {
    id: "gdelt-context-0123456789abcdef",
    title: "Agency announces technology compliance timetable",
    locator: "https://press.example.test/agency-compliance",
    publisher: "press.example.test",
    publishedDate: "2026-08-01",
    language: "English",
    sourceCountry: "United States",
    sourceRole: CONTEXTUAL_DISCOVERY_SOURCE_ROLE,
    authorityTier: 6,
    evidenceBasis: "source-metadata",
  };
}

function oversizedChunkedResponse() {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(
        new Uint8Array(
          CONTEXTUAL_DISCOVERY_BUDGETS.maximumResponseBytes + 1,
        ).fill(0x78),
      );
    },
    cancel() {
      cancelled = true;
    },
  });
  return {
    response: new Response(body, {
      headers: { "content-type": "application/json" },
    }),
    cancelled: () => cancelled,
  };
}

describe("bounded contextual discovery", () => {
  it("makes one fixed-endpoint ArticleList request with literal bounded terms and no outcome input", async () => {
    const requested: Array<{ url: string; init?: RequestInit }> = [];
    const fetch: ContextualDiscoveryFetch = async (input, init) => {
      requested.push({ url: String(input), init });
      return jsonResponse({
        articles: [
          article({
            url: "https://news.example.test/rule#tracking-fragment",
            title: "Technology rule announced",
          }),
        ],
      });
    };
    const result = await discoverGdeltContextualLeads({
      fetch,
      query:
        "Technology OR domain:attacker.example repeat3:system private_sentinel \"new rule\"",
      startDate: "2024-01-01",
      endDate: "2027-01-01",
      retrievedAt,
      resultLimit: 5,
      timeoutMs: 100,
    });

    expect(requested).toHaveLength(1);
    const url = new URL(requested[0]!.url);
    expect(`${url.origin}${url.pathname}`).toBe(GDELT_DOC_API_ENDPOINT);
    expect(url.searchParams.get("mode")).toBe("artlist");
    expect(url.searchParams.get("format")).toBe("json");
    expect(url.searchParams.get("sort")).toBe("datedesc");
    expect(url.searchParams.get("maxrecords")).toBe("5");
    expect(url.searchParams.get("startdatetime")).toBe("20250812000000");
    expect(url.searchParams.get("enddatetime")).toBe("20260813235959");
    expect(url.searchParams.get("query")).toBe(
      "Technology attacker example system private sentinel new rule",
    );
    expect(requested[0]!.init).toMatchObject({
      method: "GET",
      redirect: "manual",
      cache: "no-store",
    });
    expect(result.diagnostics).toMatchObject({
      status: "searched",
      recordsReceived: 1,
      recordsAccepted: 1,
      articlePagesFetched: 0,
      outcomeValuesInspected: false,
    });
    expect(result.leads).toEqual([
      expect.objectContaining({
        locator: "https://news.example.test/rule",
        authorityTier: 6,
        sourceRole: "contextual-secondary",
        evidenceBasis: "source-metadata",
      }),
    ]);
    expect(JSON.stringify(result)).not.toContain("private_sentinel");
  });

  it("caps and deduplicates results while dropping malformed and out-of-window records", async () => {
    const result = await discoverGdeltContextualLeads({
      ...successfulInput(async () =>
        jsonResponse({
          articles: [
            article({
              url: "https://news.example.test/a#first",
              title: "Rule A",
            }),
            article({
              url: "https://news.example.test/a#duplicate",
              title: "Rule A duplicate URL",
            }),
            article({
              url: "https://news.example.test/a-copy",
              title: "Rule A",
            }),
            article({ url: "https://news.example.test/b", title: "Rule B" }),
            article({ url: "https://news.example.test/c", title: "Rule C" }),
            article({ url: "https://news.example.test/d", title: "Rule D" }),
            article({ url: "https://news.example.test/e", title: "Rule E" }),
            article({ url: "http://news.example.test/insecure", title: "Bad" }),
            article({
              url: "https://news.example.test/old",
              title: "Too old",
              seenDate: "20240101T000000Z",
            }),
          ],
        }),
      ),
      resultLimit: 2,
    });

    expect(result.leads.map((item) => item.title)).toEqual(["Rule A", "Rule B"]);
    expect(result.diagnostics).toMatchObject({
      recordsReceived: 9,
      recordsAccepted: 2,
      duplicateRecordsDropped: 2,
      invalidRecordsDropped: 2,
      overBudgetRecordsDropped: 3,
      outcomeValuesInspected: false,
    });
  });

  it("skips a wholly unsupported historical window without calling the index", async () => {
    const fetch = vi.fn<ContextualDiscoveryFetch>();
    const result = await discoverGdeltContextualLeads({
      fetch,
      query: "historic regulation",
      startDate: "2018-01-01",
      endDate: "2019-01-01",
      retrievedAt,
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      leads: [],
      diagnostics: {
        status: "skipped",
        failureReason: "date-window-outside-supported-range",
        requestUrl: null,
        articlePagesFetched: 0,
        outcomeValuesInspected: false,
      },
    });
  });

  it.each([
    {
      label: "malformed JSON",
      response: () =>
        new Response("{not-json", {
          headers: { "content-type": "application/json" },
        }),
      reason: "malformed-json",
    },
    {
      label: "wrong response schema",
      response: () => jsonResponse({ results: [] }),
      reason: "invalid-response-schema",
    },
    {
      label: "unsupported content type",
      response: () =>
        new Response("<html></html>", {
          headers: { "content-type": "text/html" },
        }),
      reason: "unsupported-content-type",
    },
    {
      label: "declared oversized response",
      response: () =>
        new Response("{}", {
          headers: {
            "content-type": "application/json",
            "content-length": String(
              CONTEXTUAL_DISCOVERY_BUDGETS.maximumResponseBytes + 1,
            ),
          },
        }),
      reason: "response-too-large",
    },
  ])("fails closed for $label", async ({ response, reason }) => {
    const result = await discoverGdeltContextualLeads({
      ...successfulInput(async () => response()),
    });
    expect(result).toMatchObject({
      leads: [],
      diagnostics: {
        status: "failed",
        failureReason: reason,
        recordsAccepted: 0,
        articlePagesFetched: 0,
        outcomeValuesInspected: false,
      },
    });
  });

  it("cancels a chunked body at the byte cap", async () => {
    const oversized = oversizedChunkedResponse();
    const result = await discoverGdeltContextualLeads({
      ...successfulInput(async () => oversized.response),
    });
    expect(result.diagnostics.failureReason).toBe("response-too-large");
    expect(result.leads).toEqual([]);
    expect(oversized.cancelled()).toBe(true);
  });

  it("settles promptly on local timeout and upstream cancellation", async () => {
    const neverFetch: ContextualDiscoveryFetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      });
    const timedOut = await discoverGdeltContextualLeads({
      ...successfulInput(neverFetch),
      timeoutMs: 5,
    });
    expect(timedOut.diagnostics.failureReason).toBe("timed-out");

    const controller = new AbortController();
    const pending = discoverGdeltContextualLeads({
      ...successfulInput(neverFetch),
      timeoutMs: 100,
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).resolves.toMatchObject({
      leads: [],
      diagnostics: { failureReason: "aborted" },
    });
  });

  it("rejects invalid budgets and bounds operator-like query syntax before fetch", async () => {
    expect(
      boundedContextualDiscoveryQuery(
        'OR domain:example.test repeat25:system ("Clean Air") AND NOT',
      ),
    ).toBe("example test system Clean Air");
    expect(() =>
      buildGdeltContextualDiscoveryRequest({
        query: "x".repeat(1_600),
        startDate: "2026-01-01",
        endDate: "2026-08-13",
        resultLimit: 5,
      }),
    ).toThrow(/URL exceeded/i);
    await expect(
      discoverGdeltContextualLeads({
        ...successfulInput(async () => jsonResponse({ articles: [] })),
        resultLimit: 6,
      }),
    ).rejects.toThrow(/resultLimit/i);
  });

  it("converts Screen 2 leads to a separate tier-6 lane and Screen 3 leads to metadata-only evidence", async () => {
    const item = lead();
    const screen02 = gdeltLeadToScreen02ContextLead({
      lead: item,
      eventFamily: "Regulation",
      retrievedAt,
      stage: "implementation",
    });
    expect(screen02).toMatchObject({
      recordId: item.id,
      value: {
        mode: "find",
        origin: "unsupported-lead",
        likelyServiceLevel: "event-reconnaissance",
        sources: [
          {
            authorityTier: 6,
            channel: CONTEXTUAL_DISCOVERY_CHANNEL,
            authorityAssessment: { method: "unverified" },
          },
        ],
      },
    });
    expect(screen02).not.toHaveProperty("directSupport");
    expect(screen02.value.provisionalDates[0]).toMatch(
      /not a verified event date/i,
    );
    expect(screen02.value.limitations.join(" ")).toMatch(/cannot confirm/i);

    const screen03 = gdeltLeadToScreen03Evidence(item, retrievedAt);
    expect(screen03).toMatchObject({
      authorityTier: 6,
      channel: CONTEXTUAL_DISCOVERY_CHANNEL,
      status: "retrieved",
      passages: [
        {
          locator: item.locator,
          basis: "source-metadata",
        },
      ],
    });

    const request = buildScreen03EvidenceSynthesisRequest(
      {
        event: {
          identity: {
            canonicalTitle: "Technology compliance rule",
            formalIdentifier: null,
            issuer: null,
            issuingJurisdiction: null,
            eventType: "Regulation",
            status: null,
          },
        },
      } as unknown as Screen02WorkflowHandoff,
      [screen03],
    );
    expect(request.evidence).toEqual([]);
    expect(JSON.stringify(request)).not.toContain(item.title);
    expect(request.outcomeValuesInspected).toBe(false);
  });

  it("adapts the fixed provider contract for both Find and Audit without accepting authority claims", async () => {
    let fetchCalls = 0;
    const requests: string[] = [];
    const provider = createGdeltContextSearchProvider(async (input) => {
      fetchCalls += 1;
      requests.push(String(input));
      return jsonResponse({ articles: [article({ url: lead().locator, title: lead().title })] });
    });
    const common = {
      stage: "identity" as const,
      query: "technology compliance",
      resultLimit: 20,
      retrievedAt,
      eventFamily: "Regulation",
      startDate: "2026-01-01",
      endDate: "2026-08-13",
      signal: new AbortController().signal,
    };
    const find = await provider({ ...common, mode: "find", identity: null });
    const audit = await provider({
      ...common,
      mode: "audit",
      identity: {
        canonicalName: "Technology compliance rule",
        issuingJurisdiction: "United States",
      },
    });
    expect(fetchCalls).toBe(2);
    expect(new URL(requests[1]!).searchParams.get("query")).toBe(
      "Technology compliance rule",
    );
    expect(find).toHaveLength(1);
    expect(audit).toHaveLength(1);
    for (const result of [...find, ...audit]) {
      expect(result.value.origin).toBe("unsupported-lead");
      expect(result.value.sources[0]?.authorityTier).toBe(6);
      expect(result.value.sources[0]?.channel).toContain("Context to verify");
    }
  });

  it("surfaces index failure to guarded callers instead of reporting a zero-result success", async () => {
    const provider = createGdeltContextSearchProvider(async () =>
      new Response("upstream unavailable", { status: 503 })
    );
    await expect(provider({
      mode: "audit",
      stage: "implementation",
      query: "technology compliance",
      resultLimit: 5,
      retrievedAt,
      eventFamily: "Regulation",
      startDate: "2026-01-01",
      endDate: "2026-08-13",
      identity: {
        canonicalName: "Technology compliance rule",
        issuingJurisdiction: "United States",
      },
      signal: new AbortController().signal,
    })).rejects.toThrow(/http-failure/i);
  });
});
