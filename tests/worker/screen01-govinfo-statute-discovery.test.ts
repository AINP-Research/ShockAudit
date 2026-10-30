import { describe, expect, it, vi } from "vitest";

import { createSixScreenWorkflow } from
  "../../src/core/six-screen/workflow";
import {
  discoverGovInfoPublicLaws,
  SCREEN_01_GOVINFO_SEARCH_URL,
} from "../../src/worker/screen01-govinfo-statute-discovery";

const retrievedAt = "2026-09-17T14:00:00.000Z";

function workflow(shockInput: string, locator?: string) {
  return createSixScreenWorkflow({
    runId: `run-${shockInput.replace(/\W+/gu, "-").slice(0, 50)}`,
    studyId: "study-federal-statute-discovery",
    study: {
      population: "Organizations",
      analysisUnit: "Organization",
      geography: ["United States"],
      industry: [],
      period: { start: "1990", end: "2026" },
      outcome: "Compliance",
      intendedConstruct: null,
      initialExplanation: null,
      proposedTreatment: null,
      proposedComparison: null,
      resultsPreviouslyInspected: "no",
    },
    shockInput,
    requestedJurisdiction: "United States",
    officialSourceLocators: locator ? [locator] : [],
    createdAt: retrievedAt,
  });
}

function recordedFetch(input: {
  packageId: string;
  searchTitle: string;
  shortTitle: string;
  dateIssued: string;
}) {
  return vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
    const url = String(request);
    if (url === SCREEN_01_GOVINFO_SEARCH_URL) {
      return new Response(JSON.stringify({
        count: 1,
        results: [{
          collectionCode: "PLAW",
          title: input.searchTitle,
          packageId: input.packageId,
          dateIssued: input.dateIssued,
          resultLink:
            `https://api.govinfo.gov/packages/${input.packageId}/summary`,
          governmentAuthor: ["United States Congress"],
        }],
      }), { headers: { "content-type": "application/json" } });
    }
    if (url.includes(input.packageId)) {
      const coordinates = /PLAW-(\d+)(?:publ|priv)(\d+)/u.exec(input.packageId)!;
      return new Response(
        "<!doctype html><html><body><main>" +
          `<p>Public Law ${Number(coordinates[1])}-${Number(coordinates[2])}</p>` +
          `<p>This Act may be cited as the “${input.shortTitle}”.</p>` +
          "<p>A regulated person shall maintain the records required by section 4.</p>" +
          "<p>The designated federal agency shall administer this Act and may issue implementing regulations after public notice.</p>" +
          "</main></body></html>",
        { headers: { "content-type": "text/html" } },
      );
    }
    throw new Error(`Unexpected request ${url} ${init?.method ?? "GET"}`);
  });
}

describe("reusable GovInfo public-law discovery", () => {
  it("distinguishes an unavailable credential from a completed empty search", async () => {
    const fetch = vi.fn();
    const result = await discoverGovInfoPublicLaws({
      workflow: workflow("Administrative Procedure Act"),
      fetch,
      retrievedAt,
    });

    expect(result).toMatchObject({
      status: "not_configured",
      candidates: [],
      usage: { sourceQueries: 0, documentAttempts: 0 },
    });
    expect(result.limitation).toMatch(/GOVINFO_API_KEY/u);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    {
      query: "Sarbanes–Oxley Act of 2002 (SOX)",
      packageId: "PLAW-107publ204",
      title: "Sarbanes-Oxley Act of 2002",
      date: "2002-07-30",
    },
    {
      query: "Administrative Procedure Act",
      packageId: "PLAW-79publ404",
      title: "Administrative Procedure Act",
      date: "1946-06-11",
    },
    {
      query: "Family Smoking Prevention and Tobacco Control Act",
      packageId: "PLAW-111publ31",
      title: "Family Smoking Prevention and Tobacco Control Act",
      date: "2009-06-22",
    },
  ])("discovers $title through one generic package route", async (record) => {
    const fetch = recordedFetch({
      packageId: record.packageId,
      searchTitle: record.title,
      shortTitle: record.title,
      dateIssued: record.date,
    });
    const result = await discoverGovInfoPublicLaws({
      workflow: workflow(record.query),
      fetch,
      retrievedAt,
      apiKey: "test-server-key",
    });

    expect(result).toMatchObject({
      status: "resolved",
      usage: {
        sourceQueries: 1,
        metadataRecords: 1,
        documentAttempts: 1,
        usefulDocuments: 1,
        transportHops: 2,
      },
      candidates: [expect.objectContaining({
        officialTitle: record.title,
        issuingJurisdiction: "United States",
        instrumentType: "federal statute (public law)",
        formalIdentifiers: expect.arrayContaining([
          record.packageId,
          expect.stringMatching(/Public Law/iu),
        ]),
        identitySources: [expect.objectContaining({
          nativeId: record.packageId,
          routeId: "govinfo_public_law",
          accessStatus: "retained_passage",
        })],
      })],
    });
    const [searchUrl, searchInit] = fetch.mock.calls[0]!;
    expect(String(searchUrl)).toBe(SCREEN_01_GOVINFO_SEARCH_URL);
    expect(searchInit).toMatchObject({ method: "POST", redirect: "manual" });
    const headers = new Headers(searchInit?.headers);
    expect(headers.get("x-api-key")).toBe("test-server-key");
    const body = JSON.parse(String(searchInit?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      pageSize: "10",
      offsetMark: "*",
      resultLevel: "package",
      sorts: [{ field: "score", sortOrder: "DESC" }],
    });
    expect(body.query).toMatch(/^collection:\(PLAW\) "/u);
    expect(result.candidates[0]!.identitySources[0]!.locator).toBe(
      `https://www.govinfo.gov/content/pkg/${record.packageId}/html/${record.packageId}.htm`,
    );
  });

  it("tries a normalized entity alias after an empty exact-name search", async () => {
    const packageId = "PLAW-103publ3";
    const fetch = vi.fn(async (request: RequestInfo | URL,
      init?: RequestInit) => {
      const url = String(request);
      if (url === SCREEN_01_GOVINFO_SEARCH_URL) {
        const body = JSON.parse(String(init?.body)) as { query: string };
        return new Response(JSON.stringify({
          results: body.query.includes("Family Medical Leave") ? [{
            collectionCode: "PLAW",
            title: "Family and Medical Leave Act of 1993",
            packageId,
            dateIssued: "1993-02-05",
            resultLink: `https://api.govinfo.gov/packages/${packageId}/summary`,
            governmentAuthor: ["United States Congress"],
          }] : [],
        }), { headers: { "content-type": "application/json" } });
      }
      return new Response(`<!doctype html><html><body><main>
        <p>Public Law 103-3</p>
        <p>This Act may be cited as the “Family and Medical Leave Act of 1993”.</p>
        <p>An eligible employee shall be entitled to family and medical leave under this Act.</p>
        <p>The Secretary shall administer the requirements and preserve the applicable records.</p>
      </main></body></html>`, {
        headers: { "content-type": "text/html" },
      });
    });

    const result = await discoverGovInfoPublicLaws({
      workflow: workflow("Family and Medical Leave Statute"),
      fetch,
      retrievedAt,
      apiKey: "test-server-key",
      queryVariants: ["Family Medical Leave"],
    });

    expect(result.status).toBe("resolved");
    expect(result.usage.sourceQueries).toBe(2);
    expect(result.candidates[0]?.officialTitle).toBe(
      "Family and Medical Leave Act of 1993",
    );
  });

  it("recognizes division short titles in original GPO paired-quote typography", async () => {
    const packageId = "PLAW-111publ31";
    const fetch = vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request);
      if (url === SCREEN_01_GOVINFO_SEARCH_URL) {
        return new Response(JSON.stringify({ results: [{
          collectionCode: "PLAW",
          title:
            "An Act To protect the public health and for other purposes",
          packageId,
          dateIssued: "2009-06-22",
          resultLink: `https://api.govinfo.gov/packages/${packageId}/summary`,
          governmentAuthor: ["United States Congress"],
        }] }), { headers: { "content-type": "application/json" } });
      }
      if (url.includes(packageId)) {
        return new Response(`<!doctype html><html><body><main>
          <p>Public Law 111-31</p>
          <p>SECTION 1. SHORT TITLE; TABLE OF CONTENTS.</p>
          <p>(a) Short Title.--This division may be cited as the
          \`\`Family Smoking Prevention and Tobacco Control Act''.</p>
          <p>The Secretary shall regulate tobacco products and may issue
          implementing regulations under this division.</p>
        </main></body></html>`, {
          headers: { "content-type": "text/html" },
        });
      }
      throw new Error(`Unexpected request ${url}`);
    });

    const result = await discoverGovInfoPublicLaws({
      workflow: workflow("Family Smoking Prevention and Tobacco Control Act"),
      fetch,
      retrievedAt,
      apiKey: "test-server-key",
    });

    expect(result.status).toBe("resolved");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      officialTitle: "Family Smoking Prevention and Tobacco Control Act",
      formalIdentifiers: expect.arrayContaining([
        "PLAW-111publ31",
        "Public Law 111-31",
      ]),
      identitySources: [expect.objectContaining({
        routeId: "govinfo_public_law",
        routeVersion: "govinfo-public-law-name-discovery-v3",
      })],
    });
  });

  it("completes name search through GovInfo and native law/bill identity plus exact text through Congress.gov", async () => {
    const packageId = "PLAW-118publ42";
    const fetch = vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request);
      if (url === SCREEN_01_GOVINFO_SEARCH_URL) {
        return new Response(JSON.stringify({ results: [{
          collectionCode: "PLAW",
          title: "Federal Data Accountability Act",
          packageId,
          dateIssued: "2023-06-01",
          resultLink: `https://api.govinfo.gov/packages/${packageId}/summary`,
          governmentAuthor: ["United States Congress"],
        }] }), { headers: { "content-type": "application/json" } });
      }
      if (url.includes("www.govinfo.gov/content/pkg")) {
        return new Response(`<!doctype html><html><body><main>
          <p>Public Law 118-42</p>
          <p>This Act may be cited as the “Federal Data Accountability Act”.</p>
          <p>Each covered agency shall publish the required accountability report.</p>
          <p>The report shall describe the agency's data-governance controls, implementation schedule, review authority, and records retained under the program.</p>
          <p>The responsible inspector general may review the report and submit documented findings to Congress.</p>
        </main></body></html>`, {
          headers: { "content-type": "text/html" },
        });
      }
      if (url.includes("/v3/law/118/pub/42")) {
        return new Response(JSON.stringify({ bill: {
          congress: 118,
          type: "HR",
          number: "1234",
          title: "Federal Data Accountability Act",
          laws: [{ type: "Public Law", number: "42" }],
        } }), { headers: { "content-type": "application/json" } });
      }
      if (url.includes("/v3/bill/118/hr/1234/text")) {
        return new Response(JSON.stringify({ textVersions: [{
          type: "Enrolled Bill",
          formats: [{
            type: "Formatted Text",
            url: "https://www.congress.gov/118/plaws/publ42/PLAW-118publ42.htm",
          }],
        }] }), { headers: { "content-type": "application/json" } });
      }
      if (url.includes("www.congress.gov/118/plaws/publ42")) {
        return new Response(`<!doctype html><html><body><main>
          <p>Public Law 118-42</p>
          <p>Federal Data Accountability Act</p>
          <p>Each covered agency shall publish the required accountability report.</p>
          <p>The report shall describe the agency's data-governance controls, implementation schedule, review authority, and records retained under the program.</p>
          <p>The responsible inspector general may review the report and submit documented findings to Congress.</p>
        </main></body></html>`, {
          headers: { "content-type": "text/html" },
        });
      }
      throw new Error(`Unexpected request ${url}`);
    });
    const result = await discoverGovInfoPublicLaws({
      workflow: workflow("Federal Data Accountability Act"),
      fetch,
      retrievedAt,
      apiKey: "govinfo-test-secret",
      congressApiKey: "congress-test-secret",
    });

    expect(result.status).toBe("resolved");
    expect(result.limitation).toBeNull();
    expect(result.candidates[0]).toMatchObject({
      formalIdentifiers: expect.arrayContaining([
        packageId,
        "Public Law 118-42",
        "HR 1234 (118th Congress)",
      ]),
      identitySources: [
        expect.objectContaining({ provider: "GovInfo", nativeId: packageId }),
        expect.objectContaining({
          provider: "Congress.gov",
          nativeId: "118/hr/1234",
          routeId: "congress_public_law_bill_text",
        }),
      ],
    });
    expect(result.usage).toMatchObject({
      sourceQueries: 3,
      documentAttempts: 2,
      usefulDocuments: 2,
      transportHops: 5,
    });
  });

  it("rejects a search lead whose original bytes do not bind the named law", async () => {
    const fetch = vi.fn(async (request: RequestInfo | URL) => {
      if (String(request) === SCREEN_01_GOVINFO_SEARCH_URL) {
        return new Response(JSON.stringify({ results: [{
          collectionCode: "PLAW",
          title: "Administrative Procedure Act",
          packageId: "PLAW-79publ404",
          dateIssued: "1946-06-11",
          resultLink: "https://api.govinfo.gov/packages/PLAW-79publ404/summary",
        }] }), { headers: { "content-type": "application/json" } });
      }
      return new Response(
        "<html><body><p>A different document with no public-law identifier or requested title.</p></body></html>",
        { headers: { "content-type": "text/html" } },
      );
    });
    const result = await discoverGovInfoPublicLaws({
      workflow: workflow("Administrative Procedure Act"),
      fetch,
      retrievedAt,
      apiKey: "test-server-key",
    });

    expect(result).toMatchObject({ status: "no_match", candidates: [] });
    expect(result.limitation).toMatch(/none passed exact package/iu);
  });

  it("uses an explicit GovInfo package without name-search ambiguity", async () => {
    const packageId = "PLAW-111publ31";
    const fetch = recordedFetch({
      packageId,
      searchTitle: "Unused search title",
      shortTitle: "Family Smoking Prevention and Tobacco Control Act",
      dateIssued: "2009-06-22",
    });
    const result = await discoverGovInfoPublicLaws({
      workflow: workflow(
        "Tobacco Control Act",
        `https://www.govinfo.gov/app/details/${packageId}`,
      ),
      fetch,
      retrievedAt,
      apiKey: "test-server-key",
    });

    expect(result.status).toBe("resolved");
    expect(fetch).toHaveBeenCalledOnce();
    expect(String(fetch.mock.calls[0]![0])).toContain(packageId);
    expect(result.usage.sourceQueries).toBe(0);
  });
});
