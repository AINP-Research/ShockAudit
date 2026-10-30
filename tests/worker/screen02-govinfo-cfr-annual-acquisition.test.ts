import { describe, expect, it, vi } from "vitest";

import {
  acquireScreen02GovInfoAnnualCfrBaseline,
  annualCfrRevisionDate,
  SIX_SCREEN_GOVINFO_ANNUAL_CFR_SEARCH_MAX_BYTES,
  SIX_SCREEN_GOVINFO_ANNUAL_CFR_SEARCH_URL,
} from "../../src/worker/screen02-govinfo-cfr-annual-acquisition";
import type { Screen02ConnectorFetch } from
  "../../src/worker/screen02-connectors";

const boundary =
  "(8) Market Violation means a tariff violation or a violation of a Commission-approved order, rule, or regulation.";
const packageId = "CFR-2018-title18-vol1";
const granuleId = `${packageId}-sec35-28`;
const resultLink =
  `https://api.govinfo.gov/packages/${packageId}/granules/${granuleId}/summary`;
const xmlUrl =
  `https://api.govinfo.gov/packages/${packageId}/granules/${granuleId}/xml`;

function searchResult(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    count: 1,
    offsetMark: "opaque-next-page",
    results: [{
      packageId,
      granuleId,
      collectionCode: "CFR",
      dateIssued: "2018-04-01",
      resultLink,
      download: { xmlLink: xmlUrl },
      ...overrides,
    }],
  });
}

function annualXml(paragraph = boundary) {
  return `<?xml version="1.0" encoding="UTF-8"?>
    <CFRGRANULE>
      <CFRTITLE>18</CFRTITLE>
      <DATE>2018-04-01</DATE>
      <GRANULENUM>Â§ 35.28</GRANULENUM>
      <ANCESTORS>
        <PARENT HEADING="Title 18" SEQ="2"></PARENT>
        <PARENT HEADING="PART 35" SEQ="1"></PARENT>
      </ANCESTORS>
      <SECTION>
        <SECTNO>§ 35.28</SECTNO>
        <SUBJECT>Non-discriminatory open access transmission tariff.</SUBJECT>
        <P>${paragraph}</P>
        <EFFDNOTP><REVTXT><SECTION>
          <SECTNO>§ 35.28</SECTNO>
          <P>(9) A future effective-date note retained in the annual granule.</P>
        </SECTION></REVTXT></EFFDNOTP>
      </SECTION>
    </CFRGRANULE>`;
}

function input(fetch: Screen02ConnectorFetch) {
  return {
    fetch,
    apiKey: "govinfo-secret",
    cfrTitle: "18",
    cfrPart: "35",
    section: "35.28",
    legalEffectDate: "2018-06-04",
    expectedBoundaryText: boundary,
  };
}

describe("bounded GovInfo annual CFR acquisition", () => {
  it("maps each CFR title cycle to the latest strictly pre-effective edition", () => {
    expect(annualCfrRevisionDate("1", "2018-06-04")).toBe("2018-01-01");
    expect(annualCfrRevisionDate("18", "2018-06-04")).toBe("2018-04-01");
    expect(annualCfrRevisionDate("30", "2018-06-04")).toBe("2017-07-01");
    expect(annualCfrRevisionDate("45", "2018-10-01")).toBe("2017-10-01");
    expect(annualCfrRevisionDate("18", "1997-04-01")).toBeNull();
    expect(annualCfrRevisionDate("51", "2018-06-04")).toBeNull();
  });

  it("retains one exact annual section and keeps the credential out of evidence", async () => {
    const fetch = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      const url = String(request);
      const headers = new Headers(init?.headers);
      expect(headers.get("x-api-key")).toBe("govinfo-secret");
      if (url === SIX_SCREEN_GOVINFO_ANNUAL_CFR_SEARCH_URL) {
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({
          query:
            "collection:(CFR) cfrtitlenum:18 cfrpartnum:35 cfrsectionnum:35.28 publishdate:2018-04-01",
          pageSize: "2",
          offsetMark: "*",
          historical: true,
          sorts: [{ field: "publishdate", sortOrder: "DESC" }],
        });
        return new Response(searchResult(), {
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
      if (url === xmlUrl) {
        expect(init?.method).toBe("GET");
        return new Response(annualXml(), {
          headers: { "content-type": "application/xml" },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    const result = await acquireScreen02GovInfoAnnualCfrBaseline(input(fetch));

    expect(result).toMatchObject({
      status: "ready",
      failureCode: null,
      attemptedSources: [SIX_SCREEN_GOVINFO_ANNUAL_CFR_SEARCH_URL, xmlUrl],
      baseline: {
        annualEditionDate: "2018-04-01",
        section: "35.28",
        packageId,
        granuleId,
        searchUrl: SIX_SCREEN_GOVINFO_ANNUAL_CFR_SEARCH_URL,
        searchQuery: expect.stringContaining("publishdate:2018-04-01"),
        searchResponseContentHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
        xmlUrl,
        xmlContentHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      },
      usage: {
        sourceQueries: 1,
        metadataRecords: 1,
        documentAttempts: 2,
        usefulDocuments: 2,
        transportHops: 2,
      },
    });
    expect(JSON.stringify(result)).not.toContain("govinfo-secret");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not fetch without a configured credential", async () => {
    const fetch = vi.fn();
    const result = await acquireScreen02GovInfoAnnualCfrBaseline({
      ...input(fetch),
      apiKey: undefined,
    });
    expect(result).toMatchObject({
      status: "unsupported",
      failureCode: "source_not_configured",
      attemptedSources: [],
      baseline: null,
      usage: { sourceQueries: 0, documentAttempts: 0 },
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects a non-unique search before retrieving XML", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({
      count: 2,
      results: [{}, {}],
    }), { headers: { "content-type": "application/json" } }));
    const result = await acquireScreen02GovInfoAnnualCfrBaseline(input(fetch));
    expect(result).toMatchObject({
      status: "unsupported",
      failureCode: "wrong_document",
      baseline: null,
      usage: { metadataRecords: 2, documentAttempts: 1, transportHops: 1 },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("rejects annual XML that does not contain the selected boundary", async () => {
    const fetch = vi.fn(async (request: RequestInfo | URL) =>
      String(request) === SIX_SCREEN_GOVINFO_ANNUAL_CFR_SEARCH_URL
        ? new Response(searchResult(), {
            headers: { "content-type": "application/json" },
          })
        : new Response(annualXml("A different historical paragraph."), {
            headers: { "content-type": "text/xml" },
          }));
    const result = await acquireScreen02GovInfoAnnualCfrBaseline(input(fetch));
    expect(result).toMatchObject({
      status: "unsupported",
      failureCode: "wrong_document",
      attemptedSources: [SIX_SCREEN_GOVINFO_ANNUAL_CFR_SEARCH_URL, xmlUrl],
      baseline: null,
    });
    expect(result.limitation).toContain("selected pre-effective boundary");
  });

  it("stops at a declared search-response ceiling", async () => {
    const fetch = vi.fn(async () => new Response(searchResult(), {
      headers: {
        "content-type": "application/json",
        "content-length": String(
          SIX_SCREEN_GOVINFO_ANNUAL_CFR_SEARCH_MAX_BYTES + 1,
        ),
      },
    }));
    const result = await acquireScreen02GovInfoAnnualCfrBaseline(input(fetch));
    expect(result).toMatchObject({
      status: "waiting_source",
      failureCode: "response_limit",
      baseline: null,
      usage: { sourceQueries: 1, documentAttempts: 1, transportHops: 1 },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
