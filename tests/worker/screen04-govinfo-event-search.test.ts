import { describe, expect, it, vi } from "vitest";

import { proposalOccurrence } from
  "../../src/worker/screen04-coevent-execution";
import { searchScreen04GovInfoPublicLaws } from
  "../../src/worker/screen04-govinfo-event-search";
import { screen02ProductionPeerBoundFetch } from
  "../../src/worker/screen02-secure-transport";

const retrievedAt = "2026-09-24T12:00:00.000Z";
const packageId = "PLAW-117publ99";
const originalUrl =
  `https://www.govinfo.gov/content/pkg/${packageId}/html/${packageId}.htm`;
const summaryUrl = `https://api.govinfo.gov/packages/${packageId}/summary`;

function record(overrides: Record<string, unknown> = {}) {
  return {
    collectionCode: "PLAW",
    title: "Consumer Data Accountability Act",
    packageId,
    dateIssued: "2021-08-12",
    resultLink: summaryUrl,
    governmentAuthor: ["United States Congress"],
    ...overrides,
  };
}

function originalDocument(marker = "PUBLIC LAW 117-99") {
  return `<!doctype html><html><body><main>
    <h1>${marker}</h1>
    <p>This Act may be cited as the Consumer Data Accountability Act.</p>
    <p>The Secretary shall issue regulations concerning covered data processing
    after consulting relevant agencies. The exact application, conditions and
    implementation date of those regulations require provision-level review.</p>
    <p>Approved August 11, 2021.</p>
    </main></body></html>`;
}

function queryInput(fetch: Parameters<typeof searchScreen04GovInfoPublicLaws>[0]["fetch"]) {
  return {
    fetch,
    apiKey: "server-test-secret",
    query: "consumer data",
    startDate: "2018-01-01",
    endDate: "2025-12-31",
    limit: 2,
    retrievedAt,
  };
}

describe("Screen 4 GovInfo public-law co-event adapter", () => {
  it("keeps unavailable credentials distinct from a completed empty search", async () => {
    const fetch = vi.fn();
    const missing = await searchScreen04GovInfoPublicLaws({
      ...queryInput(fetch), apiKey: undefined,
    });
    expect(missing).toMatchObject({
      status: "not_configured",
      proposals: [],
      inspectedDocuments: [],
      diagnostics: { sourceQueries: 0, documentFetches: 0 },
    });
    expect(fetch).not.toHaveBeenCalled();

    const emptyFetch = vi.fn(async () => new Response(JSON.stringify({
      count: 0, results: [],
    }), { headers: { "content-type": "application/json" } }));
    const empty = await searchScreen04GovInfoPublicLaws(queryInput(emptyFetch));
    expect(empty).toMatchObject({
      status: "searched", proposals: [],
      diagnostics: { sourceQueries: 1, recordsReceived: 0, failureKind: "none" },
    });
  });

  it("inspects an exact original law and preserves publication versus approval", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetch = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      const url = String(request);
      calls.push({ url, init });
      if (url === "https://api.govinfo.gov/search") {
        return new Response(JSON.stringify({
          count: 1, results: [record()],
        }), { headers: { "content-type": "application/json" } });
      }
      if (url === originalUrl) {
        return new Response(originalDocument(), {
          headers: { "content-type": "text/html" },
        });
      }
      throw new Error(`Unexpected URL ${url}`);
    });
    const result = await searchScreen04GovInfoPublicLaws(queryInput(fetch));
    expect(calls.map(({ url }) => url)).toEqual([
      "https://api.govinfo.gov/search", originalUrl,
    ]);
    expect(calls[0]!.init).toMatchObject({
      method: "POST", redirect: "manual", cache: "no-store",
    });
    expect(calls[1]!.init).toMatchObject({
      method: "GET", redirect: "manual", cache: "no-store",
    });
    const searchBody = JSON.parse(String(calls[0]!.init?.body));
    expect(searchBody).toEqual({
      query: 'collection:(PLAW) publishdate:range(2018-01-01,2025-12-31) "consumer data"',
      pageSize: "10",
      offsetMark: "*",
      resultLevel: "package",
      sorts: [{ field: "score", sortOrder: "DESC" }],
    });
    expect(new Headers(calls[0]!.init?.headers).get("x-api-key"))
      .toBe("server-test-secret");
    expect(new Headers(calls[1]!.init?.headers).has("x-api-key"))
      .toBe(false);
    expect(result.status).toBe("searched");
    expect(result.diagnostics).toMatchObject({
      sourceQueries: 1, documentFetches: 1,
      recordsReceived: 1, documentsInspected: 1,
      failureKind: "none",
    });
    expect(result.inspectedDocuments).toEqual([expect.objectContaining({
      packageId, originalHtmlUrl: originalUrl, summaryUrl,
      dateFacts: [{
        role: "publication", date: "2021-08-12",
        sourceUrl: summaryUrl, basis: "provider_metadata",
        inspectedPassage: null,
      }, {
        role: "enactment", date: "2021-08-11",
        sourceUrl: originalUrl, basis: "inspected_original_html",
        inspectedPassage: "Approved August 11, 2021",
      }],
    })]);
    expect(result.proposals).toEqual([expect.objectContaining({
      id: `screen04-govinfo-${packageId}`,
      title: "Consumer Data Accountability Act",
      nativeIdentity: {
        formalIdentifier: packageId,
        issuer: "United States Congress",
        issuingJurisdiction: "United States",
        status: "Public law, original package",
      },
      provisionalDates: ["Publication date: 2021-08-12"],
      sources: [
        expect.objectContaining({
          id: `screen04-govinfo-${packageId}-summary`,
          locator: summaryUrl, authorityTier: 1,
        }),
        expect.objectContaining({
          id: `screen04-govinfo-${packageId}-original-html`,
          locator: originalUrl, authorityTier: 1,
          evidenceText: expect.stringContaining("Approved August 11, 2021"),
        }),
      ],
    })]);
    const converted = proposalOccurrence("govinfo", result.proposals[0]!, retrievedAt);
    expect(converted?.typedDates).toEqual([{
      kind: "publication", value: "2021-08-12", precision: "day",
      sourceId: `screen04-govinfo-${packageId}-summary`,
    }]);
    expect(JSON.stringify(result)).not.toContain("server-test-secret");
  });

  it("uses the credentialed fixed-source transport without changing its allowlist", async () => {
    const provider = vi.fn(async (request: RequestInfo | URL) =>
      String(request).endsWith("/search")
        ? new Response(JSON.stringify({ count: 1, results: [record()] }), {
            headers: { "content-type": "application/json" },
          })
        : new Response(originalDocument(), {
            headers: { "content-type": "text/html" },
          }));
    const result = await searchScreen04GovInfoPublicLaws({
      ...queryInput((url, init) =>
        screen02ProductionPeerBoundFetch(url, init, provider)),
      query: 'Consumer data" collection:(BILLS)',
    });
    expect(result.status).toBe("searched");
    expect(result.proposals).toHaveLength(1);
    expect(result.diagnostics.query).toBe(
      'collection:(PLAW) publishdate:range(2018-01-01,2025-12-31) "Consumer data collection BILLS"',
    );
    expect(provider).toHaveBeenCalledTimes(2);
  });

  it("drops off-host links, duplicate records, and unverified document identities", async () => {
    const otherPackage = "PLAW-117publ100";
    const fetch = vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request);
      if (url.endsWith("/search")) {
        return new Response(JSON.stringify({
          count: 6,
          results: [
            record({ resultLink: "https://example.org/private" }),
            record(), record(),
            record({
              packageId: otherPackage,
              resultLink: `https://api.govinfo.gov/packages/${otherPackage}/summary`,
            }),
          ],
        }), { headers: { "content-type": "application/json" } });
      }
      return new Response(url.includes(otherPackage)
        ? originalDocument("PUBLIC LAW 117-101")
        : originalDocument(), {
        headers: { "content-type": "text/html" },
      });
    });
    const result = await searchScreen04GovInfoPublicLaws(queryInput(fetch));
    expect(result).toMatchObject({
      status: "searched",
      diagnostics: {
        recordsReceived: 4, recordsAccepted: 1,
        invalidRecordsDropped: 1,
        duplicateRecordsConsolidated: 1,
        documentsAttempted: 2,
        documentsInspected: 1,
        documentFailures: 1,
        limitReached: true,
      },
    });
    expect(result.proposals.map(({ nativeIdentity }) =>
      nativeIdentity?.formalIdentifier)).toEqual([packageId]);
  });

  it("reports upstream failures and rejects redirects and oversized bodies", async () => {
    const errored = await searchScreen04GovInfoPublicLaws(queryInput(
      vi.fn(async () => new Response(null, { status: 429 })),
    ));
    expect(errored).toMatchObject({
      status: "source_unavailable", proposals: [],
      diagnostics: { failureKind: "http", sourceQueries: 1 },
    });

    const redirected = await searchScreen04GovInfoPublicLaws(queryInput(
      vi.fn(async () => new Response(null, {
        status: 302, headers: { location: "https://example.org/redirect" },
      })),
    ));
    expect(redirected.status).toBe("source_unavailable");

    const oversized = await searchScreen04GovInfoPublicLaws(queryInput(
      vi.fn(async () => new Response("{}", {
        headers: {
          "content-type": "application/json",
          "content-length": "500000",
        },
      })),
    ));
    expect(oversized.diagnostics.failureKind).toBe("response-limit");
    await expect(searchScreen04GovInfoPublicLaws({
      ...queryInput(vi.fn()), limit: 7,
    })).rejects.toThrow(/inspection limit/iu);
  });

  it("SRC4-02 follows at most one validated provider cursor and inspects beyond the first page", async () => {
    const packageIds = Array.from({ length: 6 }, (_, index) =>
      `PLAW-117publ${99 + index}`);
    const packageRecord = (id: string) => record({
      packageId: id,
      resultLink: `https://api.govinfo.gov/packages/${id}/summary`,
    });
    const cursors: string[] = [];
    const fetch = vi.fn(async (request: RequestInfo | URL,
      init?: RequestInit) => {
      if (String(request) === "https://api.govinfo.gov/search") {
        const cursor = JSON.parse(String(init?.body)).offsetMark as string;
        cursors.push(cursor);
        if (cursor === "*") {
          return new Response(JSON.stringify({
            count: 13, offsetMark: "SAFE12345678",
            results: [...packageIds.slice(0, 3).map(packageRecord),
              ...Array.from({ length: 7 }, (_, index) =>
                record({ packageId: `BILLS-invalid-${index}` }))],
          }), { headers: { "content-type": "application/json" } });
        }
        return new Response(JSON.stringify({
          count: 13, offsetMark: "SAFE98765432",
          results: packageIds.slice(3).map(packageRecord),
        }), { headers: { "content-type": "application/json" } });
      }
      const id = packageIds.find((candidate) =>
        String(request).includes(candidate))!;
      return new Response(originalDocument(
        `PUBLIC LAW 117-${id.slice("PLAW-117publ".length)}`),
      { headers: { "content-type": "text/html" } });
    });
    const result = await searchScreen04GovInfoPublicLaws({
      ...queryInput((url, init) =>
        screen02ProductionPeerBoundFetch(url, init, fetch)), limit: 6,
    });
    expect(cursors).toEqual(["*", "SAFE12345678"]);
    expect(result.diagnostics).toMatchObject({
      sourceQueries: 2, recordsReceived: 13,
      documentsAttempted: 6, documentsInspected: 6,
    });
    expect(result.proposals.map(({ nativeIdentity }) =>
      nativeIdentity?.formalIdentifier)).toEqual(packageIds);
  });

  it("records an interrupted later page as partial source coverage without losing inspected laws", async () => {
    let pages = 0;
    const fetch = vi.fn(async (request: RequestInfo | URL) => {
      if (String(request).endsWith("/search")) {
        pages += 1;
        return pages === 1
          ? new Response(JSON.stringify({
              count: 19, offsetMark: "SAFE12345678",
              results: [record(), ...Array.from({ length: 9 }, (_, index) =>
                record({ packageId: `BILLS-invalid-${index}` }))],
            }), { headers: { "content-type": "application/json" } })
          : new Response(null, { status: 503 });
      }
      return new Response(originalDocument(), {
        headers: { "content-type": "text/html" },
      });
    });
    const result = await searchScreen04GovInfoPublicLaws({
      ...queryInput(fetch), limit: 6,
    });
    expect(result.proposals).toHaveLength(1);
    expect(result.diagnostics).toMatchObject({
      sourceQueries: 2, failureKind: "http", recordsReceived: 10,
      documentsInspected: 1, limitReached: true,
    });
    expect(result.diagnostics.limitation).toMatch(/later page failed/iu);
  });
});
