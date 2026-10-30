import { describe, expect, it, vi } from "vitest";

import {
  fetchScreen02OverviewDocument,
  screen02RedirectedOverviewMatchesProposal,
} from "../../src/worker/server";
import {
  fetchFederalRegisterProposals,
  type Screen02ConnectorFetch,
} from "../../src/worker/screen02-connectors";

const retrievedAt = "2026-09-07T00:00:00.000Z";

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
  });
}

function federalRegisterInput(fetch: Screen02ConnectorFetch) {
  return {
    fetch,
    retrievedAt,
    query: "electric storage participation",
    startDate: "2014-01-01",
    endDate: "2022-12-31",
    population: "U.S. energy firms",
    outcomeFamily: "Investment",
    limit: 1,
    workflowMode: "find" as const,
  };
}

describe("Federal Register source locator identity", () => {
  it("admits only exact document-numbered official representation paths", async () => {
    const result = await fetchFederalRegisterProposals(
      federalRegisterInput(async () =>
        jsonResponse({
          count: 1,
          results: [{
            title: "Electric Storage Participation Rule",
            type: "Rule",
            document_number: "2018-03708",
            publication_date: "2018-03-06",
            html_url:
              "https://www.federalregister.gov/documents/2018/03/06/2018-03708/electric-storage-participation-rule",
            body_html_url:
              "https://www.federalregister.gov/documents/full_text/html/2018/03/06/2018-03708.html",
            raw_text_url:
              "https://www.federalregister.gov/documents/full_text/text/2018/03/06/2018-03708.txt",
            pdf_url:
              "https://www.govinfo.gov/content/pkg/FR-2018-03-06/pdf/2018-03708.pdf",
          }],
        })),
    );

    expect(result.proposals[0]?.sources.map((source) => source.locator))
      .toEqual([
        "https://www.govinfo.gov/content/pkg/FR-2018-03-06/pdf/2018-03708.pdf",
        "https://www.federalregister.gov/documents/full_text/html/2018/03/06/2018-03708.html",
        "https://www.federalregister.gov/documents/full_text/text/2018/03/06/2018-03708.txt",
        "https://www.federalregister.gov/documents/2018/03/06/2018-03708/electric-storage-participation-rule",
      ]);
  });

  it("drops credentialed, custom-port, and cross-record API locators", async () => {
    const result = await fetchFederalRegisterProposals(
      federalRegisterInput(async () =>
        jsonResponse({
          count: 1,
          results: [{
            title: "Electric Storage Participation Rule",
            type: "Rule",
            document_number: "2018-03708",
            publication_date: "2018-03-06",
            html_url:
              "https://reader:secret@www.federalregister.gov/d/2018-03708",
            body_html_url:
              "https://www.federalregister.gov:8443/documents/full_text/html/2018/03/06/2018-03708.html",
            raw_text_url:
              "https://www.federalregister.gov/documents/full_text/text/2018/03/06/2018-09999.txt",
            pdf_url:
              "https://www.govinfo.gov/content/pkg/FR-2018-03-06/pdf/2018-09999.pdf",
          }],
        })),
    );

    expect(result.proposals[0]?.sources).toEqual([
      expect.objectContaining({
        locator: "https://www.federalregister.gov/d/2018-03708",
        authorityAssessment: expect.objectContaining({
          reason: expect.stringMatching(/constructed/i),
        }),
      }),
    ]);
  });

  it("does not accept any representation when only its query names the record", async () => {
    const result = await fetchFederalRegisterProposals(
      federalRegisterInput(async () =>
        jsonResponse({
          count: 1,
          results: [{
            title: "Electric Storage Participation Rule",
            type: "Rule",
            document_number: "2018-03708",
            publication_date: "2018-03-06",
            html_url:
              "https://www.federalregister.gov/d/2018-09999?document_number=2018-03708",
            body_html_url:
              "https://www.federalregister.gov/documents/full_text/html/2018/03/06/2018-09999.html?document_number=2018-03708",
            raw_text_url:
              "https://www.federalregister.gov/documents/full_text/text/2018/03/06/2018-09999.txt?document_number=2018-03708",
            pdf_url:
              "https://www.govinfo.gov/content/pkg/FR-2018-03-06/pdf/2018-09999.pdf?document_number=2018-03708",
          }],
        })),
    );

    expect(result.proposals[0]?.sources).toEqual([
      expect.objectContaining({
        locator: "https://www.federalregister.gov/d/2018-03708",
        authorityAssessment: expect.objectContaining({
          reason: expect.stringMatching(/constructed/i),
        }),
      }),
    ]);
  });
});

describe("official overview redirect origin families", () => {
  it.each([
    [
      "FTC to SEC",
      "https://www.ftc.gov/news-events/news/press-releases/2018/08/example-action",
      "https://www.sec.gov/news/press-release/unrelated",
    ],
    [
      "Federal Register to FTC",
      "https://www.federalregister.gov/d/2018-03708",
      "https://www.ftc.gov/news-events/news/press-releases/unrelated",
    ],
    [
      "Federal Register to a different GovInfo record",
      "https://www.federalregister.gov/d/2018-03708",
      "https://www.govinfo.gov/content/pkg/FR-2018-03-06/html/2018-09999.htm",
    ],
  ])("rejects %s before requesting the unrelated destination", async (
    _label,
    initial,
    destination,
  ) => {
    const requests: string[] = [];
    const fetch = vi.fn<Screen02ConnectorFetch>(async (input) => {
      const request = String(input);
      requests.push(request);
      if (request === initial) {
        return new Response(null, {
          status: 302,
          headers: { location: destination },
        });
      }
      throw new Error("The redirect destination must not be requested.");
    });

    await expect(fetchScreen02OverviewDocument(fetch, initial)).rejects
      .toThrow(/origin-family host allowlist/i);
    expect(requests).toEqual([initial]);
  });

  it("allows a redirect between the reviewed FTC bare/www aliases", async () => {
    const initial =
      "https://www.ftc.gov/news-events/news/press-releases/2018/08/example-action";
    const destination =
      "https://ftc.gov/news-events/news/press-releases/2018/08/example-action";
    const requests: string[] = [];
    const document = await fetchScreen02OverviewDocument(async (input) => {
      const request = String(input);
      requests.push(request);
      if (request === initial) {
        return new Response(null, {
          status: 301,
          headers: { location: destination },
        });
      }
      return new Response(
        "<!doctype html><html><head><title>Example FTC Action</title></head><body><main>The Commission approved the completed action for covered operators on August 14, 2018.</main></body></html>",
        { headers: { "content-type": "text/html; charset=utf-8" } },
      );
    }, initial);

    expect(requests).toEqual([initial, destination]);
    expect(document.locator).toBe(destination);
  });

  it("allows and identity-binds an exact Federal Register to GovInfo HTML transition", async () => {
    const initial = "https://www.federalregister.gov/d/2018-03708";
    const destination =
      "https://www.govinfo.gov/content/pkg/FR-2018-03-06/html/2018-03708.htm";
    const discovery = await fetchFederalRegisterProposals(
      federalRegisterInput(async () =>
        jsonResponse({
          count: 1,
          results: [{
            title: "Electric Storage Participation Rule",
            type: "Rule",
            document_number: "2018-03708",
            publication_date: "2018-03-06",
            html_url: initial,
          }],
        })),
    );
    const proposal = discovery.proposals[0];
    if (!proposal || proposal.mode !== "find") {
      throw new Error("Expected a Federal Register Find proposal.");
    }
    const requests: string[] = [];
    const document = await fetchScreen02OverviewDocument(async (input) => {
      const request = String(input);
      requests.push(request);
      if (request === initial) {
        return new Response(null, {
          status: 302,
          headers: { location: destination },
        });
      }
      return new Response(
        "<!doctype html><html><head><title>Electric Storage Participation Rule</title></head><body><main><p>The final rule removes barriers for covered market operators and is effective June 4, 2018.</p><p>[FR Doc. 2018-03708 Filed 3-5-18; 8:45 am]</p></main></body></html>",
        { headers: { "content-type": "text/html; charset=utf-8" } },
      );
    }, initial);

    expect(requests).toEqual([initial, destination]);
    expect(document.locator).toBe(destination);
    expect(document.sourceRecordIdentifier).toBe("2018-03708");
    expect(
      screen02RedirectedOverviewMatchesProposal(
        proposal,
        initial,
        document,
      ),
    ).toBe(true);
  });

  it.each([
    "https://reader@www.ftc.gov/news-events/news/press-releases/example",
    "https://www.ftc.gov:8443/news-events/news/press-releases/example",
    "https://preview.ftc.gov/news-events/news/press-releases/example",
    "https://reader@www.federalregister.gov/d/2018-03708",
    "https://www.federalregister.gov:8443/d/2018-03708",
  ])("rejects an unsafe initial official locator without fetching: %s", async (locator) => {
    const fetch = vi.fn<Screen02ConnectorFetch>();
    await expect(fetchScreen02OverviewDocument(fetch, locator)).rejects
      .toThrow(/outside the bounded host allowlist/i);
    expect(fetch).not.toHaveBeenCalled();
  });
});
