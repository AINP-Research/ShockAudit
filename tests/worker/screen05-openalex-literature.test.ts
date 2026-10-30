import { describe, expect, it, vi } from "vitest";

import {
  OPENALEX_WORKS_API_ENDPOINT,
  SIX_SCREEN_OPENALEX_LITERATURE_BUDGETS,
  discoverOpenAlexLiteratureMetadata,
} from "../../src/worker/screen05-openalex-literature";

const retrievedAt = "2026-09-15T12:00:00.000Z";
const apiKey = "[redacted-openalex-test-value]";

function jsonResponse(body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", ...headers },
  });
}

function work(input: {
  id?: string;
  doi?: string | null;
  title: string;
}) {
  return {
    id: input.id ?? "https://openalex.org/W1234567890",
    doi: input.doi === undefined
      ? "https://doi.org/10.1234/OPENALEX.1"
      : input.doi,
    display_name: input.title,
    authorships: [
      { author: { display_name: "Ada Lovelace" } },
      { author: { display_name: "Research Consortium" } },
    ],
    publication_year: 2024,
    publication_date: "2024-02-29",
    primary_location: {
      is_oa: false,
      landing_page_url: "https://journal.example/article/1#summary",
      pdf_url: null,
      version: "publishedVersion",
      license: null,
      source: {
        display_name: "Journal of Institutional Change",
        type: "journal",
        host_organization_name: "Research Publisher",
      },
    },
    best_oa_location: {
      is_oa: true,
      landing_page_url: "https://repository.example/record/1",
      pdf_url: "https://repository.example/record/1.pdf",
      version: "acceptedVersion",
      license: "cc-by",
      source: {
        display_name: "Institutional Repository",
        type: "repository",
      },
    },
    open_access: { is_oa: true, oa_status: "green" },
    type: "article",
    language: "en",
    is_retracted: true,
    abstract_inverted_index: {
      Organizational: [0],
      adaptation: [1],
      may: [2],
      follow: [3],
      participation: [4],
    },
    referenced_works: ["https://openalex.org/W9999999999"],
  };
}

describe("Screen 5 OpenAlex literature metadata", () => {
  it("uses one server-authenticated selected-field request and follows no reported location", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const result = await discoverOpenAlexLiteratureMetadata({
      fetch: async (request, init) => {
        requests.push({ url: String(request), init });
        return jsonResponse({
          meta: { count: 1, page: 1, per_page: 5 },
          results: [work({
            title: "<i>Participation</i> and organizational adaptation",
          })],
          group_by: [],
        });
      },
      apiKey,
      query: "participation OR https://attacker.invalid private_outcome",
      retrievedAt,
    });

    expect(requests).toHaveLength(1);
    const url = new URL(requests[0]!.url);
    expect(`${url.origin}${url.pathname}`).toBe(OPENALEX_WORKS_API_ENDPOINT);
    expect([...url.searchParams.keys()].sort()).toEqual([
      "per_page",
      "search",
      "select",
    ]);
    expect(url.searchParams.get("search")).toBe(
      "participation OR attacker invalid private outcome",
    );
    expect(url.searchParams.get("per_page")).toBe("5");
    expect(url.searchParams.get("select")).toBe(
      "id,doi,display_name,authorships,publication_year,publication_date,primary_location,best_oa_location,type,language,is_retracted,abstract_inverted_index,content_urls",
    );
    expect(url.toString()).not.toContain(apiKey);
    expect(requests[0]!.init).toMatchObject({
      method: "GET",
      redirect: "manual",
      cache: "no-store",
    });
    expect(new Headers(requests[0]!.init?.headers).get("authorization"))
      .toBe(`Bearer ${apiKey}`);
    expect(result).toMatchObject({
      diagnostics: {
        status: "searched",
        recordsReceived: 1,
        recordsAccepted: 1,
        authentication: "server_bearer_header",
        abstractFieldsSelected: true,
        abstractFieldsInspected: true,
        reportedLocationsFollowed: 0,
        fullTextLocationsFollowed: 0,
        citationNeighborhoodHops: 0,
      },
      records: [{
        providerNativeId: "https://openalex.org/W1234567890",
        doi: "10.1234/openalex.1",
        title: "Participation and organizational adaptation",
        authors: ["Ada Lovelace", "Research Consortium"],
        publicationYear: 2024,
        publishedDate: "2024-02-29",
        publicationVenue: "Journal of Institutional Change",
        publisher: "Research Publisher",
        workType: "article",
        language: "en",
        stableLocator: "https://openalex.org/W1234567890",
        isRetracted: true,
        abstractText:
          "Organizational adaptation may follow participation",
        abstractSource: "openalex_abstract_inverted_index",
        reportedLocations: [{
          landingPageUrl: "https://journal.example/article/1",
          pdfUrl: null,
          sourceName: "Journal of Institutional Change",
          sourceType: "journal",
          version: "publishedVersion",
          license: null,
          isOpenAccess: false,
        }, {
          landingPageUrl: "https://repository.example/record/1",
          pdfUrl: "https://repository.example/record/1.pdf",
          sourceName: "Institutional Repository",
          sourceType: "repository",
          version: "acceptedVersion",
          license: "cc-by",
          isOpenAccess: true,
        }],
      }],
    });
    expect(JSON.stringify(result)).not.toContain(apiKey);
    expect(JSON.stringify(result)).not.toMatch(/W9999999999/iu);
  });

  it("deduplicates by OpenAlex id, DOI, or normalized title and caps accepted records", async () => {
    const result = await discoverOpenAlexLiteratureMetadata({
      fetch: async () => jsonResponse({
        meta: { count: 5 },
        results: [
          work({ id: "W1", doi: "10.1234/A", title: "First title" }),
          work({ id: "https://openalex.org/W1", doi: "10.1234/B", title: "ID duplicate" }),
          work({ id: "W2", doi: "https://doi.org/10.1234/a", title: "DOI duplicate" }),
          work({ id: "W3", doi: "10.1234/C", title: "Second title" }),
          work({ id: "W4", doi: "10.1234/D", title: "Third title" }),
        ],
      }),
      apiKey,
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

  it("drops credential-bearing reported locators without dropping safe work metadata", async () => {
    const unsafe = work({ title: "Credential-bearing location metadata" });
    const unsafeLandingPage = new URL("https://journal.example/article/1");
    unsafeLandingPage.searchParams.set("access_token", "[redacted]");
    unsafe.primary_location.landing_page_url = unsafeLandingPage.toString();
    const unsafePdf = new URL("https://repository.example/record/1.pdf");
    unsafePdf.searchParams.set("X-Amz-Signature", "[redacted]");
    unsafe.best_oa_location.pdf_url = unsafePdf.toString();
    const result = await discoverOpenAlexLiteratureMetadata({
      fetch: async () => jsonResponse({
        meta: { count: 1 },
        results: [unsafe],
      }),
      apiKey,
      query: "market participation",
      retrievedAt,
    });

    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.reportedLocations).toEqual([{
      landingPageUrl: "https://repository.example/record/1",
      pdfUrl: null,
      sourceName: "Institutional Repository",
      sourceType: "repository",
      version: "acceptedVersion",
      license: "cc-by",
      isOpenAccess: true,
    }]);
    expect(JSON.stringify(result)).not.toContain("[redacted]");
  });

  it.each([
    {
      name: "redirect responses",
      response: () => new Response(null, {
        status: 302,
        headers: { location: "https://elsewhere.invalid" },
      }),
      reason: "http_failure",
    },
    {
      name: "oversized bodies",
      response: () => new Response("{}", { headers: {
        "content-type": "application/json",
        "content-length": String(
          SIX_SCREEN_OPENALEX_LITERATURE_BUDGETS.maximumResponseBytes + 1,
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
    {
      name: "invalid envelopes",
      response: () => jsonResponse({ results: [] }),
      reason: "invalid_response_schema",
    },
  ])("returns a typed failure for $name", async ({ response, reason }) => {
    const fetch = vi.fn(async () => response());
    const result = await discoverOpenAlexLiteratureMetadata({
      fetch,
      apiKey,
      query: "market participation",
      retrievedAt,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      records: [],
      diagnostics: { status: "failed", failureReason: reason },
    });
    expect(JSON.stringify(result)).not.toContain(apiKey);
  });
});
