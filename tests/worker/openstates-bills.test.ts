import { describe, expect, it, vi } from "vitest";

import {
  openStatesSearchRequest,
  searchOpenStatesBills,
} from "../../src/worker/openstates-bills";

const apiKey = "[redacted-openstates-test-key]";

function billPayload() {
  return {
    results: [{
      id: "ocd-bill/123e4567-e89b-12d3-a456-426614174000",
      session: "2025-2026",
      jurisdiction: {
        id: "ocd-jurisdiction/country:us/state:ca/government",
        name: "California",
        classification: "state",
      },
      from_organization: {
        id: "ocd-organization/example",
        name: "California Legislature",
        classification: "legislature",
      },
      identifier: "AB 123",
      title: "Consumer Data Accountability Act",
      classification: ["bill"],
      openstates_url: "https://openstates.org/ca/bills/20252026/AB123/",
      first_action_date: "2025-01-10",
      latest_action_date: "2025-10-01",
      abstracts: [{
        abstract: "Requires covered businesses to document specified controls.",
        note: "summary",
      }],
      actions: [{
        id: "action-1",
        description: "Introduced",
        date: "2025-01-10",
        classification: ["introduction"],
        order: 1,
      }, {
        id: "action-2",
        description: "Chaptered by Secretary of State",
        date: "2025-10-01",
        classification: ["became-law"],
        order: 2,
      }],
      sources: [{
        url: "https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202520260AB123",
        note: "Official bill text",
      }],
      versions: [],
      documents: [],
    }],
  };
}

describe("Open States bill discovery", () => {
  it("keeps the credential in a header and separates official locators", async () => {
    const requests: Array<{ url: string; headers: Headers }> = [];
    const fetch = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: String(request), headers: new Headers(init?.headers) });
      return new Response(JSON.stringify(billPayload()), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const result = await searchOpenStatesBills({
      fetch,
      apiKey,
      query: "California AB 123",
      jurisdiction: "California",
      approximateYear: "2025",
      retrievedAt: "2026-10-19T00:00:00.000Z",
      monotonicNow: (() => {
        let value = 0;
        return () => (value += 5);
      })(),
    });

    expect(result.status).toBe("searched");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      officialTitle: "Consumer Data Accountability Act",
      issuingJurisdiction: "California",
      formalIdentifiers: ["AB 123", "Session 2025-2026"],
      episode: "enacted legislation",
    });
    expect(result.candidates[0]!.identitySources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          authorityTier: "tier-2",
          provider: "Open States API",
        }),
        expect.objectContaining({
          authorityTier: "tier-1",
          provider: "Official state legislature",
          inspectedText: "metadata_only",
        }),
      ]),
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]!.headers.get("x-api-key")).toBe(apiKey);
    expect(requests[0]!.url).not.toContain(apiKey);
    expect(new URL(requests[0]!.url).searchParams.has("session")).toBe(false);
    expect(result.requestUrl).not.toContain(apiKey);
    expect(JSON.stringify(result)).not.toContain(apiKey);
    expect(result.candidates[0]!.identitySources[0]!.locator).toBe(
      "https://v3.openstates.org/bills/ocd-bill/123e4567-e89b-12d3-a456-426614174000",
    );
  });

  it("canonicalizes provider fragments before retaining official locators", async () => {
    const payload = billPayload();
    payload.results[0]!.sources[0]!.url += "#billText";
    const result = await searchOpenStatesBills({
      fetch: vi.fn(async () => new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      })),
      apiKey,
      query: "California AB 123",
      jurisdiction: "California",
      approximateYear: "2025",
      retrievedAt: "2026-10-19T00:00:00.000Z",
    });

    const official = result.candidates[0]!.identitySources.find(
      ({ provider }) => provider === "Official state legislature",
    );
    expect(official?.locator).toBe(
      "https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202520260AB123",
    );
  });

  it("distinguishes an unavailable source from an empty successful search", async () => {
    const result = await searchOpenStatesBills({
      fetch: vi.fn(async () => new Response("unavailable", { status: 503 })),
      apiKey,
      query: "HB 5",
      retrievedAt: "2026-10-19T00:00:00.000Z",
    });
    expect(result).toMatchObject({
      status: "source_unavailable",
      candidates: [],
    });
    expect(result.limitation).toContain("not an empty search result");
  });

  it("normalizes common state bill identifiers", () => {
    const request = new URL(openStatesSearchRequest({
      query: "Assembly Bill AB-5",
      jurisdiction: "California",
    }));
    expect(request.searchParams.get("identifier")).toBe("AB 5");
    expect(request.searchParams.has("identifiers")).toBe(false);
    expect(request.searchParams.get("jurisdiction")).toBe("California");
  });

  it("recognizes spelled-out state bill and resolution identifiers", () => {
    const examples = [
      ["California Assembly Bill 5", "AB 5"],
      ["Senate Bill No. 331", "SB 331"],
      ["House File 12", "HF 12"],
      ["Senate Joint Resolution 7", "SJR 7"],
    ] as const;
    for (const [query, expected] of examples) {
      const request = new URL(openStatesSearchRequest({ query }));
      expect(request.searchParams.get("identifier")).toBe(expected);
      expect(request.searchParams.has("q")).toBe(false);
    }
  });

  it("ranks repeated bill numbers by the requested year before truncation", async () => {
    const base = billPayload().results[0]!;
    const fetch = vi.fn(async (_request: RequestInfo | URL) =>
      new Response(JSON.stringify({
        results: [{
          ...base,
          id: "ocd-bill/123e4567-e89b-12d3-a456-426614174025",
          identifier: "AB 5",
          title: "Current-session measure",
          session: "2025-2026",
          first_action_date: "2025-01-10",
          latest_action_date: "2025-10-01",
        }, {
          ...base,
          id: "ocd-bill/123e4567-e89b-12d3-a456-426614174019",
          identifier: "AB 5",
          title: "Worker status: employees and independent contractors",
          session: "2019-2020",
          first_action_date: "2018-12-03",
          latest_action_date: "2019-09-18",
          actions: [{
            id: "action-ab5-2019",
            description: "Chaptered by Secretary of State",
            date: "2019-09-18",
            classification: ["became-law"],
            order: 1,
          }],
        }],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));

    const result = await searchOpenStatesBills({
      fetch,
      apiKey,
      query: "California Assembly Bill 5",
      jurisdiction: "California",
      approximateYear: "2019",
      retrievedAt: "2026-10-19T00:00:00.000Z",
      limit: 1,
    });

    expect(new URL(String(fetch.mock.calls[0]![0])).searchParams.get("per_page"))
      .toBe("10");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      officialTitle: "Worker status: employees and independent contractors",
      formalIdentifiers: ["AB 5", "Session 2019-2020"],
    });
    expect(result.usage).toMatchObject({
      metadataRecords: 2,
      usefulDocuments: 1,
    });
  });

  it("reads bounded older pages when the first page is crowded by newer bills", async () => {
    const base = billPayload().results[0]!;
    const fetch = vi.fn(async (request: RequestInfo | URL) => {
      const page = new URL(String(request)).searchParams.get("page");
      const results = page === "1"
        ? Array.from({ length: 10 }, (_, index) => ({
            ...base,
            id: `ocd-bill/newer-${index}`,
            title: `Newer paid leave measure ${index + 1}`,
            session: "2025-2026",
            first_action_date: "2025-01-10",
            latest_action_date: "2025-10-01",
          }))
        : [{
            ...base,
            id: "ocd-bill/historical-target",
            title: "Paid Family Leave Benefits Law",
            session: "2017-2018",
            first_action_date: "2016-04-04",
            latest_action_date: "2016-04-04",
          }];
      return new Response(JSON.stringify({ results }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const result = await searchOpenStatesBills({
      fetch,
      apiKey,
      query: "paid family leave",
      approximateYear: "2016",
      retrievedAt: "2026-10-19T00:00:00.000Z",
      limit: 1,
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(new URL(String(fetch.mock.calls[1]![0])).searchParams.get("page"))
      .toBe("2");
    expect(result.candidates[0]?.officialTitle).toBe(
      "Paid Family Leave Benefits Law",
    );
    expect(result.usage).toMatchObject({
      sourceQueries: 2,
      metadataRecords: 11,
    });
  });

  it("reads older exact-identifier pages and ranks a historical title without a year", async () => {
    const base = billPayload().results[0]!;
    const fetch = vi.fn(async (request: RequestInfo | URL) => {
      const page = new URL(String(request)).searchParams.get("page");
      const results = page === "1"
        ? Array.from({ length: 10 }, (_, index) => ({
            ...base,
            id: `ocd-bill/sb1383-newer-${index}`,
            identifier: "SB 1383",
            title: `Unrelated current-session measure ${index + 1}`,
            session: "2025-2026",
          }))
        : [{
            ...base,
            id: "ocd-bill/sb1383-family-leave",
            identifier: "SB 1383",
            title: "California Family Rights Act expansion",
            session: "2019-2020",
            abstracts: [{
              abstract: "Expands family and medical leave coverage.",
              note: "summary",
            }],
          }];
      return new Response(JSON.stringify({ results }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const result = await searchOpenStatesBills({
      fetch,
      apiKey,
      query: "California SB 1383 family and medical leave expansion",
      jurisdiction: "California",
      retrievedAt: "2026-10-28T00:00:00.000Z",
      limit: 1,
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(new URL(String(fetch.mock.calls[1]![0])).searchParams.get("page"))
      .toBe("2");
    expect(result.candidates[0]?.officialTitle).toBe(
      "California Family Rights Act expansion",
    );
  });

  it("honors a caller request ceiling while retaining bounded results", async () => {
    const base = billPayload().results[0]!;
    const fetch = vi.fn(async () => new Response(JSON.stringify({
      results: Array.from({ length: 10 }, (_, index) => ({
        ...base,
        id: `ocd-bill/request-bound-${index}`,
        title: `Newer measure ${index + 1}`,
        session: "2025-2026",
      })),
    }), { headers: { "content-type": "application/json" } }));

    const result = await searchOpenStatesBills({
      fetch,
      apiKey,
      query: "paid family leave",
      approximateYear: "2016",
      retrievedAt: "2026-10-19T00:00:00.000Z",
      maximumRequests: 1,
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("searched");
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.usage).toMatchObject({
      sourceQueries: 1,
      providerCostUnits: { openstates: 1 },
    });
  });

  it("tries a normalized alias after a completed empty name search", async () => {
    const fetch = vi.fn(async (request: RequestInfo | URL) => {
      const query = new URL(String(request)).searchParams.get("q");
      return new Response(JSON.stringify({
        results: query === "Silenced No More" ? billPayload().results : [],
      }), { headers: { "content-type": "application/json" } });
    });
    const result = await searchOpenStatesBills({
      fetch,
      apiKey,
      query: "California Silenced No More Act (2021)",
      queryVariants: ["Silenced No More"],
      jurisdiction: "California",
      retrievedAt: "2026-10-19T00:00:00.000Z",
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("searched");
    expect(result.candidates).toHaveLength(1);
  });

  it("expands postal abbreviations to Open States jurisdiction names", () => {
    const request = new URL(openStatesSearchRequest({
      query: "S 123",
      jurisdiction: "NY",
    }));
    expect(request.searchParams.get("jurisdiction")).toBe("New York");
  });
});
