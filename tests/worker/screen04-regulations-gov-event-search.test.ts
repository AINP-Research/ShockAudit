import { describe, expect, it, vi } from "vitest";

import {
  searchScreen04RegulationsGovEvents,
} from "../../src/worker/screen04-regulations-gov-event-search";

const retrievedAt = "2026-09-27T12:00:00.000Z";

describe("Screen 4 Regulations.gov event search", () => {
  it("returns bounded source-linked docket candidates in the requested window", async () => {
    const fetch = vi.fn(async (request: RequestInfo | URL,
      init?: RequestInit) => {
      const url = new URL(String(request));
      expect(url.origin + url.pathname)
        .toBe("https://api.regulations.gov/v4/documents");
      expect(url.searchParams.get("filter[searchTerm]"))
        .toBe("consumer privacy");
      expect(url.searchParams.get("page[size]")).toBe("5");
      expect(new Headers(init?.headers).get("x-api-key"))
        .toBe("server-regulations-key");
      return new Response(JSON.stringify({ data: [{
        id: "FTC-2021-0040-0001",
        type: "documents",
        attributes: {
          title: "Consumer Privacy Rule Establishing Data Broker Duties",
          documentType: "Rule",
          docketId: "FTC-2021-0040",
          agencyId: "FTC",
          frDocNum: "2021-12345",
          postedDate: "2021-05-10T00:00:00Z",
          effectiveDate: "2021-07-01T00:00:00Z",
          commentStartDate: "2021-03-01T00:00:00Z",
          commentEndDate: "2021-04-01T00:00:00Z",
          withdrawn: false,
        },
      }, {
        id: "FTC-2000-0001-0001",
        type: "documents",
        attributes: {
          title: "Outside-window privacy notice",
          documentType: "Notice",
          postedDate: "2000-01-01T00:00:00Z",
        },
      }] }), { headers: { "content-type": "application/json" } });
    });

    const result = await searchScreen04RegulationsGovEvents({
      fetch,
      apiKey: "server-regulations-key",
      query: "consumer privacy",
      startDate: "2018-01-01",
      endDate: "2025-12-31",
      retrievedAt,
    });

    expect(result).toMatchObject({
      status: "searched",
      diagnostics: {
        recordsReceived: 2,
        recordsAccepted: 1,
        outOfWindowRecordsDropped: 1,
      },
    });
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      providerId: "regulations_gov",
      sourceNativeId: "FTC-2021-0040-0001",
      eventFamily: "Federal regulation docket record",
      formalIdentifiers: expect.arrayContaining([
        "FTC-2021-0040-0001", "FTC-2021-0040", "2021-12345",
      ]),
      typedDates: expect.arrayContaining([
        expect.objectContaining({ kind: "effective", value: "2021-07-01" }),
        expect.objectContaining({ kind: "publication", value: "2021-05-10" }),
      ]),
    });
    expect(result.candidates[0]!.evidence[0]!.locator)
      .toBe("https://www.regulations.gov/document/FTC-2021-0040-0001");
    expect(JSON.stringify(result)).not.toContain("server-regulations-key");
  });

  it("distinguishes missing configuration and provider failure from no match", async () => {
    const fetch = vi.fn();
    const missing = await searchScreen04RegulationsGovEvents({
      fetch,
      query: "consumer privacy",
      startDate: "2018-01-01",
      endDate: "2025-12-31",
      retrievedAt,
    });
    expect(missing).toMatchObject({ status: "not_configured", candidates: [] });
    expect(fetch).not.toHaveBeenCalled();

    const failed = await searchScreen04RegulationsGovEvents({
      fetch: vi.fn(async () => new Response(null, { status: 503 })),
      apiKey: "server-regulations-key",
      query: "consumer privacy",
      startDate: "2018-01-01",
      endDate: "2025-12-31",
      retrievedAt,
    });
    expect(failed).toMatchObject({ status: "source_unavailable", candidates: [] });
  });
});
