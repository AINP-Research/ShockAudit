import { describe, expect, it, vi } from "vitest";

import {
  acquireCongressPublicLawIdentity,
  congressCoordinatesFromGovInfoPackage,
  congressPublicLawIdentityResponseMatches,
} from "../../src/worker/screen01-congress-statute-identity";

const retrievedAt = "2026-09-17T14:00:00.000Z";
const congressApiKey = "[redacted-congress-test-value]";

describe("Congress.gov public-law identity adapter", () => {
  it("binds GovInfo law coordinates to a native bill and inspected official text", async () => {
    const requests: Array<{ url: string; headers: Headers }> = [];
    const fetch = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      const url = String(request);
      requests.push({ url, headers: new Headers(init?.headers) });
      if (url.includes("/v3/law/118/pub/42")) {
        return new Response(JSON.stringify({
          bill: {
            congress: 118,
            type: "HR",
            number: "1234",
            title: "Federal Data Accountability Act",
            laws: [{ type: "Public Law", number: "42" }],
          },
        }), { headers: { "content-type": "application/json" } });
      }
      if (url.includes("/v3/bill/118/hr/1234/text")) {
        return new Response(JSON.stringify({
          textVersions: [{
            type: "Enrolled Bill",
            formats: [{
              type: "Formatted Text",
              url: "https://www.congress.gov/118/plaws/publ42/PLAW-118publ42.htm",
            }],
          }],
        }), { headers: { "content-type": "application/json" } });
      }
      return new Response(`<!doctype html><html><body><main>
        <p>Public Law 118-42</p>
        <p>This Act may be cited as the “Federal Data Accountability Act”.</p>
        <p>Each covered agency shall publish the required accountability report.</p>
        <p>The report shall describe the agency's data-governance controls, implementation schedule, review authority, and records retained under the program.</p>
        <p>The responsible inspector general may review the report and submit documented findings to Congress.</p>
      </main></body></html>`, {
        headers: { "content-type": "text/html" },
      });
    });

    const result = await acquireCongressPublicLawIdentity({
      packageId: "PLAW-118publ42",
      expectedTitle: "Federal Data Accountability Act",
      retrievedAt,
      fetch,
      apiKey: congressApiKey,
    });

    expect(result.status).toBe("resolved");
    expect(result.source).toMatchObject({
      provider: "Congress.gov",
      nativeId: "118/hr/1234",
      routeId: "congress_public_law_bill_text",
      accessStatus: "retained_passage",
    });
    expect(result.formalIdentifiers).toEqual([
      "Public Law 118-42",
      "HR 1234 (118th Congress)",
    ]);
    expect(result.usage).toMatchObject({
      sourceQueries: 2,
      documentAttempts: 1,
      usefulDocuments: 1,
      transportHops: 3,
    });
    expect(requests).toHaveLength(3);
    expect(requests.slice(0, 2).every(({ headers }) =>
      headers.get("x-api-key") === congressApiKey
    )).toBe(true);
    expect(requests[2]!.headers.has("x-api-key")).toBe(false);
    expect(requests.every(({ url }) => !url.includes(congressApiKey)))
      .toBe(true);
  });

  it("accepts the documented congress-prefixed law number and rejects a mismatched Congress", () => {
    const response = {
      bill: {
        congress: 115,
        type: "S",
        number: "756",
        title: "First Step Act of 2018",
        laws: [{ type: "Public Law", number: "115-391" }],
      },
    };
    expect(congressPublicLawIdentityResponseMatches(
      response,
      "PLAW-115publ391",
    )).toBe(true);
    expect(congressPublicLawIdentityResponseMatches({
      bill: {
        ...response.bill,
        laws: [{ type: "Public Law", number: "114-391" }],
      },
    }, "PLAW-115publ391")).toBe(false);
  });

  it("fails closed without a configured credential and never requests a source", async () => {
    const fetch = vi.fn();
    const result = await acquireCongressPublicLawIdentity({
      packageId: "PLAW-118publ42",
      expectedTitle: "Federal Data Accountability Act",
      retrievedAt,
      fetch,
    });
    expect(result.status).toBe("not_configured");
    expect(result.source).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("parses only exact GovInfo public- and private-law package coordinates", () => {
    expect(congressCoordinatesFromGovInfoPackage("PLAW-118publ42"))
      .toMatchObject({ congress: 118, lawType: "pub", lawNumber: 42 });
    expect(congressCoordinatesFromGovInfoPackage("PLAW-117priv3"))
      .toMatchObject({ congress: 117, lawType: "priv", lawNumber: 3 });
    expect(congressCoordinatesFromGovInfoPackage("BILLS-118hr42enr")).toBeNull();
  });
});
