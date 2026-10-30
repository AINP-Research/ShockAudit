import { describe, expect, it, vi } from "vitest";

import {
  SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
  type Screen02FindProposal,
  type Screen02Proposal,
} from "../../src/core/screen02-types";
import {
  screen02MaterialTimingFacts,
  screen02ProposalHasPreliminaryLifecycle,
} from "../../src/core/screen02-service";
import { screen02SourceSupportsProposalIdentity } from
  "../../src/core/screen02-source-grounding";

import {
  FEDERAL_REGISTER_API_ENDPOINT,
  OPEN_FEMA_API_ENDPOINT,
  SCREEN_02_CONNECTOR_MAX_RESPONSE_BYTES,
  SCREEN_02_CONNECTOR_MAX_LIMIT,
  SCREEN_02_CONNECTOR_MAX_RECORDED_REQUEST_URL_LENGTH,
  SCREEN_02_CONNECTOR_MAX_TIMEOUT_MS,
  fetchFederalRegisterProposals,
  fetchOpenFemaDisasterProposals,
  screen02ConnectorFailureKind,
  type OpenFemaConnectorInput,
  type Screen02ConnectorFetch,
} from "../../src/worker/screen02-connectors";

const retrievedAt = "2026-07-29T20:00:00.000Z";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function chunkedResponseOverLimit(maximumBytes: number) {
  const responseBytes = maximumBytes + 1;
  const chunkBytes = 64 * 1_024;
  let emittedBytes = 0;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const remainingBytes = responseBytes - emittedBytes;
      if (remainingBytes <= 0) return;
      const nextChunkBytes = Math.min(chunkBytes, remainingBytes);
      controller.enqueue(new Uint8Array(nextChunkBytes).fill(0x78));
      emittedBytes += nextChunkBytes;
    },
    cancel() {
      cancelled = true;
    },
  });
  const response = new Response(body, {
    headers: { "content-type": "application/json" },
  });
  return {
    response,
    wasCancelled: () => cancelled,
  };
}

function requireFindProposal(
  proposal: Screen02Proposal | undefined,
): Screen02FindProposal {
  expect(proposal?.mode).toBe("find");
  if (!proposal || proposal.mode !== "find") {
    throw new Error("Expected a Find proposal.");
  }
  return proposal;
}

describe("Screen 2 official no-key connectors", () => {
  it("classifies malformed JSON and unsupported response types explicitly", () => {
    expect(
      screen02ConnectorFailureKind(
        "SyntaxError: Unexpected end of JSON input",
      ),
    ).toBe("invalid-response");
    expect(
      screen02ConnectorFailureKind(
        "Official API returned an unsupported content type.",
      ),
    ).toBe("invalid-response");
  });
  it("safely queries Federal Register final rules and labels organizational applicability provisional", async () => {
    let requestedUrl = "";
    let requestedInit: RequestInit | undefined;
    const fetchImpl: Screen02ConnectorFetch = async (input, init) => {
      requestedUrl = String(input);
      requestedInit = init;
      return jsonResponse({
        count: 9,
        results: [
          {
            title: "Clean Air Reporting Rule",
            type: "Rule",
            abstract:
              "The agency establishes revised reporting requirements.",
            document_number: "2026-12345",
            html_url:
              "https://www.federalregister.gov/documents/2026/07/01/2026-12345/clean-air-reporting-rule",
            pdf_url:
              "https://www.govinfo.gov/content/pkg/FR-2026-07-01/pdf/2026-12345.pdf",
            publication_date: "2026-07-01",
            effective_on: "2026-09-01",
            agencies: [
              {
                name: "Environmental Protection Agency",
              },
            ],
          },
        ],
      });
    };

    const userQuery =
      "https://untrusted.example/rule?x=1 & clean air";
    const result = await fetchFederalRegisterProposals({
      fetch: fetchImpl,
      retrievedAt,
      query: userQuery,
      queryId: "native-01",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      population: "U.S. exchange-listed manufacturing firms",
      outcomeFamily: "Firm profitability",
      limit: 2,
      timeoutMs: 500,
    });

    const url = new URL(requestedUrl);
    expect(url.origin + url.pathname).toBe(
      FEDERAL_REGISTER_API_ENDPOINT,
    );
    expect(url.searchParams.get("conditions[term]")).toBe(userQuery);
    expect(
      url.searchParams.get("conditions[publication_date][gte]"),
    ).toBe("2026-01-01");
    expect(
      url.searchParams.get("conditions[publication_date][lte]"),
    ).toBe("2026-12-31");
    expect(url.searchParams.getAll("conditions[type][]")).toEqual([
      "RULE",
      "PRORULE",
      "NOTICE",
    ]);
    expect(url.searchParams.get("per_page")).toBe("2");
    expect(url.searchParams.get("order")).toBe("relevance");
    expect(url.searchParams.getAll("fields[]")).toEqual(
      expect.arrayContaining([
        "document_number",
        "body_html_url",
        "raw_text_url",
        "effective_on",
      ]),
    );
    expect(requestedInit).toMatchObject({
      method: "GET",
      redirect: "manual",
      cache: "no-store",
    });
    expect(requestedInit?.signal).toBeInstanceOf(AbortSignal);

    expect(result.proposals).toHaveLength(1);
    const proposal = requireFindProposal(result.proposals[0]);
    expect(proposal).toMatchObject({
      id: "fr-2026-12345",
      mode: "find",
      kind: "event",
      origin: "newly-discovered",
      likelyServiceLevel: "event-reconnaissance",
      nativeIdentity: {
        formalIdentifier: "2026-12345",
        issuer: "Environmental Protection Agency",
        issuingJurisdiction: "United States",
        status: "Rule",
      },
      event: {
        eventDate: "2026-07-01",
        eventFamily: "Regulation",
        geographies: ["United States"],
      },
    });
    expect(proposal?.description).toMatch(/applicability.*provisional/i);
    expect(proposal?.affectedPopulation).toMatch(
      /did not establish organizational population coverage/i,
    );
    expect(proposal?.event.populations).toEqual([
      SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
    ]);
    expect(JSON.stringify(proposal)).not.toContain(
      "U.S. exchange-listed manufacturing firms",
    );
    expect(proposal?.outcomeLink).toMatchObject({
      status: "system-template",
      text: expect.stringMatching(/Source-grounded event feature/),
    });
    expect(proposal?.limitations.join(" ")).toMatch(
      /thresholds.*exemptions/i,
    );
    expect(proposal?.sources).toHaveLength(2);
    expect(proposal?.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "fr-source-2026-12345",
          locator:
            "https://www.govinfo.gov/content/pkg/FR-2026-07-01/pdf/2026-12345.pdf",
          publisher: "Environmental Protection Agency",
          publishedDate: "2026-07-01",
          authorityTier: 1,
          channel:
            "Federal Register API v1 · rules, proposed rules, and notices",
          retrievedAt,
          evidenceText:
            "Clean Air Reporting Rule. Federal Register document 2026-12345. Issuing authority: Environmental Protection Agency. Issuing jurisdiction: United States. The agency establishes revised reporting requirements. Effective date: 2026-09-01.",
          authorityAssessment: expect.objectContaining({
            method: "connector-native",
          }),
        }),
        expect.objectContaining({
          id: "fr-source-html-2026-12345",
          title: "Clean Air Reporting Rule — Federal Register HTML",
          locator:
            "https://www.federalregister.gov/documents/2026/07/01/2026-12345/clean-air-reporting-rule",
          publisher: "Environmental Protection Agency",
          publishedDate: "2026-07-01",
          authorityTier: 2,
          evidenceText:
            "Clean Air Reporting Rule. Federal Register document 2026-12345. Issuing authority: Environmental Protection Agency. Issuing jurisdiction: United States. The agency establishes revised reporting requirements. Effective date: 2026-09-01.",
          authorityAssessment: expect.objectContaining({
            method: "connector-native",
          }),
        }),
      ]),
    );

    expect(result.diagnostics).toMatchObject({
      connector: "federal-register-api-v1",
      endpoint: FEDERAL_REGISTER_API_ENDPOINT,
      retrievedAt,
      resultLimit: 2,
      recordsReceived: 1,
      recordsAccepted: 1,
      proposalsReturned: 1,
      invalidRecordsDropped: 0,
      duplicateRecordsConsolidated: 0,
      limitReached: true,
      outcomeValuesInspected: false,
    });
    expect(
      result.diagnostics.queryMatrix[0]?.returnedRecordIds,
    ).toEqual(["2026-12345"]);
    expect(result.proposalBindings).toEqual([{
      proposalId: proposal.id,
      queryId: "federal-register-native-01",
      returnedRecordIds: ["2026-12345"],
      sourceIds: proposal.sources.map((source) => source.id),
    }]);
    expect(result.diagnostics.channels[0]).toMatchObject({
      status: "searched",
      retrievedAt,
    });
    expect(result.diagnostics.channels[0]?.note).toMatch(
      /outcome values were not inspected/i,
    );
  });

  it("returns and promotes only the exact Federal Register bridge document", async () => {
    const requested = "2020-12345";
    const result = await fetchFederalRegisterProposals({
      fetch: async () => jsonResponse({
        count: 2,
        results: [
          {
            title: "Wrong document returned for the search term",
            type: "Rule",
            abstract: "This is a different official record.",
            document_number: "2020-54321",
            publication_date: "2020-05-01",
            html_url:
              "https://www.federalregister.gov/documents/2020/05/01/2020-54321/wrong-document",
            agencies: [{ name: "Example Agency" }],
          },
          {
            title: "Exact bridge document",
            type: "Rule",
            abstract: "This is the independently retrieved exact record.",
            document_number: requested,
            publication_date: "2020-04-01",
            html_url:
              `https://www.federalregister.gov/documents/2020/04/01/${requested}/exact-document`,
            agencies: [{ name: "Example Agency" }],
          },
        ],
      }),
      retrievedAt,
      query: requested,
      exactDocumentNumber: requested,
      startDate: "2020-01-01",
      endDate: "2020-12-31",
      population: "U.S. firms",
      outcomeFamily: "Investment",
      limit: 5,
      timeoutMs: 500,
    });

    expect(result.proposals.map((proposal) =>
      proposal.mode === "find" ? proposal.nativeIdentity?.formalIdentifier : null
    )).toEqual([requested]);
    expect(result.diagnostics.queryMatrix[0]?.returnedRecordIds).toEqual([
      requested,
    ]);
    expect(result.diagnostics).toMatchObject({
      recordsReceived: 2,
      recordsAccepted: 1,
      proposalsReturned: 1,
      invalidRecordsDropped: 1,
    });
  });

  it("rejects a noncanonical Federal Register bridge identifier before I/O", async () => {
    const fetchImpl = vi.fn<Screen02ConnectorFetch>();
    await expect(fetchFederalRegisterProposals({
      fetch: fetchImpl,
      retrievedAt,
      query: "FR Doc. 2020-12345",
      exactDocumentNumber: "FR Doc. 2020-12345",
      startDate: "2020-01-01",
      endDate: "2020-12-31",
      population: "U.S. firms",
      outcomeFamily: "Investment",
    })).rejects.toThrow(/canonical Federal Register document number/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects an exact bridge whose query names a different document", async () => {
    const fetchImpl = vi.fn<Screen02ConnectorFetch>();
    await expect(fetchFederalRegisterProposals({
      fetch: fetchImpl,
      retrievedAt,
      query: "2020-54321",
      exactDocumentNumber: "2020-12345",
      startDate: "2020-01-01",
      endDate: "2020-12-31",
      population: "U.S. firms",
      outcomeFamily: "Investment",
    })).rejects.toThrow(/query must equal exactDocumentNumber/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("retains Federal Register document-numbered full-text alternatives for substantive retrieval", async () => {
    const result = await fetchFederalRegisterProposals({
      fetch: async () =>
        jsonResponse({
          count: 1,
          results: [{
            title:
              "Electric Storage Participation in Markets Operated by Regional Transmission Organizations and Independent System Operators",
            type: "Rule",
            abstract:
              "The Commission is amending its regulations to remove barriers to electric storage participation.",
            document_number: "2018-03708",
            html_url:
              "https://www.federalregister.gov/documents/2018/03/06/2018-03708/electric-storage-participation-in-markets-operated-by-regional-transmission-organizations-and",
            pdf_url:
              "https://www.govinfo.gov/content/pkg/FR-2018-03-06/pdf/2018-03708.pdf",
            body_html_url:
              "https://www.federalregister.gov/documents/full_text/html/2018/03/06/2018-03708.html",
            raw_text_url:
              "https://www.federalregister.gov/documents/full_text/text/2018/03/06/2018-03708.txt",
            publication_date: "2018-03-06",
            effective_on: "2018-06-04",
            agencies: [{ name: "Federal Energy Regulatory Commission" }],
          }],
        }),
      retrievedAt,
      query: "electric storage participation",
      startDate: "2014-01-01",
      endDate: "2022-12-31",
      population: "U.S. energy firms",
      outcomeFamily: "Investment",
      limit: 1,
    });

    const proposal = requireFindProposal(result.proposals[0]);
    expect(proposal.sources.map((source) => source.locator)).toEqual([
      "https://www.govinfo.gov/content/pkg/FR-2018-03-06/pdf/2018-03708.pdf",
      "https://www.federalregister.gov/documents/full_text/html/2018/03/06/2018-03708.html",
      "https://www.federalregister.gov/documents/full_text/text/2018/03/06/2018-03708.txt",
      "https://www.federalregister.gov/documents/2018/03/06/2018-03708/electric-storage-participation-in-markets-operated-by-regional-transmission-organizations-and",
    ]);
    expect(proposal.sources[1]).toMatchObject({
      authorityTier: 2,
      title: expect.stringContaining("full-text HTML"),
    });
  });

  it("keeps a Federal Register PRORULE effective date as a nonselectable lead", async () => {
    const result = await fetchFederalRegisterProposals({
      fetch: async () =>
        jsonResponse({
          count: 1,
          results: [{
            title: "Manufacturing Product-Control Rulemaking",
            type: "Proposed Rule",
            abstract:
              "If adopted, the proposal would require covered manufacturers to change product controls beginning in 2019.",
            document_number: "2018-proposal-001",
            html_url:
              "https://www.federalregister.gov/d/2018-proposal-001",
            publication_date: "2018-06-01",
            effective_on: "2020-01-01",
            agencies: [{ name: "Example Federal Agency" }],
          }],
        }),
      retrievedAt,
      query: "manufacturing product controls",
      documentTypes: ["PRORULE"],
      startDate: "2014-01-01",
      endDate: "2022-12-31",
      population: "U.S. public manufacturing firms",
      outcomeFamily: "Profitability",
      limit: 1,
    });

    const proposal = requireFindProposal(result.proposals[0]);
    expect(proposal.nativeIdentity?.status).toBe("Proposed Rule");
    expect(proposal.sources[0]?.evidenceText).toContain(
      "Effective date: 2020-01-01",
    );
    expect(screen02ProposalHasPreliminaryLifecycle(proposal)).toBe(true);
    expect(screen02MaterialTimingFacts(proposal)).toEqual([]);
  });

  it("keeps one official locator or constructs the Federal Register fallback when needed", async () => {
    const result = await fetchFederalRegisterProposals({
      fetch: async () =>
        jsonResponse({
          count: 3,
          results: [
            {
              title: "HTML-only reporting rule",
              type: "Rule",
              document_number: "2026-html-only",
              html_url:
                "https://www.federalregister.gov/d/2026-html-only",
              publication_date: "2026-06-01",
            },
            {
              title: "PDF-only reporting rule",
              type: "Rule",
              document_number: "2026-pdf-only",
              pdf_url:
                "https://www.govinfo.gov/content/pkg/FR-2026-06-02/pdf/2026-pdf-only.pdf",
              publication_date: "2026-06-02",
            },
            {
              title: "Reporting rule without an API locator",
              type: "Rule",
              document_number: "2026-no-locator",
              html_url: "https://untrusted.example/2026-no-locator",
              pdf_url: "http://www.govinfo.gov/insecure.pdf",
              publication_date: "2026-06-03",
            },
          ],
        }),
      retrievedAt,
      query: "reporting rule",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      population: "U.S. public firms",
      outcomeFamily: "Profitability",
      limit: 3,
    });

    const htmlOnly = requireFindProposal(result.proposals[0]);
    const pdfOnly = requireFindProposal(result.proposals[1]);
    const noLocator = requireFindProposal(result.proposals[2]);
    expect(htmlOnly.sources).toEqual([
      expect.objectContaining({
        id: "fr-source-2026-html-only",
        locator: "https://www.federalregister.gov/d/2026-html-only",
        authorityTier: 2,
      }),
    ]);
    expect(pdfOnly.sources).toEqual([
      expect.objectContaining({
        id: "fr-source-2026-pdf-only",
        locator:
          "https://www.govinfo.gov/content/pkg/FR-2026-06-02/pdf/2026-pdf-only.pdf",
        authorityTier: 1,
      }),
    ]);
    expect(noLocator.sources).toEqual([
      expect.objectContaining({
        id: "fr-source-2026-no-locator",
        locator: "https://www.federalregister.gov/d/2026-no-locator",
        authorityTier: 2,
        authorityAssessment: {
          method: "connector-native",
          reason: expect.stringMatching(/constructed/i),
          policyVersion: expect.any(String),
        },
      }),
    ]);
  });

  it("records unique query-matrix identities and supports an explicit document-type subset", async () => {
    let requestedUrl = "";
    const result = await fetchFederalRegisterProposals({
      fetch: async (input) => {
        requestedUrl = String(input);
        return jsonResponse({ count: 0, results: [] });
      },
      retrievedAt,
      query: "video game console",
      queryId: "native-03",
      queryPurpose:
        "Search one disclosed video-game industry alias.",
      documentTypes: ["RULE", "NOTICE"],
      startDate: "2014-01-01",
      endDate: "2016-12-31",
      population: "U.S. public video-game firms",
      outcomeFamily: "Profitability",
      limit: 10,
    });

    expect(
      new URL(requestedUrl).searchParams.getAll("conditions[type][]"),
    ).toEqual(["RULE", "NOTICE"]);
    expect(result.diagnostics.queryMatrix[0]).toMatchObject({
      id: "federal-register-native-03",
      purpose: "Search one disclosed video-game industry alias.",
      returnedRecordIds: [],
    });
  });

  it("retains sanitized search excerpts so industry evidence is not lost when an abstract is absent", async () => {
    const result = await fetchFederalRegisterProposals({
      fetch: async () =>
        jsonResponse({
          count: 1,
          results: [
            {
              title:
                "Sony Computer Entertainment America; Proposed Consent Order",
              type: "Notice",
              excerpts: [
                "Advertising claims for a <strong>video game console</strong> and related software.",
              ],
              document_number: "2014-28346",
              html_url:
                "https://www.federalregister.gov/d/2014-28346",
              publication_date: "2014-12-02",
              agencies: [{ name: "Federal Trade Commission" }],
            },
          ],
        }),
      retrievedAt,
      query: "video game console",
      startDate: "2014-01-01",
      endDate: "2016-12-31",
      population: "U.S. public video-game firms",
      outcomeFamily: "Profitability",
      limit: 10,
    });

    const proposal = requireFindProposal(result.proposals[0]);
    expect(proposal.description).toContain(
      "video game console",
    );
    expect(proposal.description).not.toContain("<strong>");
    expect(proposal.limitations).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/notice-stage lead/i),
      ]),
    );
    expect(proposal.nativeIdentity).toMatchObject({
      formalIdentifier: "2014-28346",
      issuer: "Federal Trade Commission",
      issuingJurisdiction: "United States",
      status: "Notice",
    });
  });

  it("keeps same-record source identity stable across query-highlight excerpts", async () => {
    const responseForExcerpt = (excerpt: string) => jsonResponse({
      count: 1,
      results: [{
        title: "Video Game Competition Rule",
        type: "Rule",
        action: "Final rule.",
        abstract:
          "The agency establishes requirements for covered platform operators.",
        excerpts: [excerpt],
        document_number: "2018-12345",
        html_url:
          "https://www.federalregister.gov/d/2018-12345",
        publication_date: "2018-08-01",
        effective_on: "2018-10-01",
        agencies: [{ name: "Federal Trade Commission" }],
      }],
    });
    const run = (query: string, excerpt: string) =>
      fetchFederalRegisterProposals({
        fetch: async () => responseForExcerpt(excerpt),
        retrievedAt,
        query,
        startDate: "2014-01-01",
        endDate: "2022-12-31",
        population: "U.S. public video-game firms",
        outcomeFamily: "Profitability",
        limit: 10,
      });
    const [platform, operator] = await Promise.all([
      run(
        "video game platform",
        "Highlighted passage about <strong>video game platforms</strong>.",
      ),
      run(
        "covered operators",
        "Highlighted passage about <strong>covered operators</strong>.",
      ),
    ]);
    const platformProposal = requireFindProposal(platform.proposals[0]);
    const operatorProposal = requireFindProposal(operator.proposals[0]);

    expect(platformProposal.description).toContain("video game platforms");
    expect(operatorProposal.description).toContain("covered operators");
    expect(platformProposal.description).not.toBe(operatorProposal.description);
    expect(platformProposal.sources).toEqual(operatorProposal.sources);
    expect(platformProposal.sources[0]?.evidenceText).toContain(
      "establishes requirements for covered platform operators",
    );
    expect(platformProposal.sources[0]?.evidenceText).not.toContain(
      "Highlighted passage",
    );
  });

  it("bounds a multi-agency Federal Register issuer to the canonical identity limit", async () => {
    const result = await fetchFederalRegisterProposals({
      fetch: async () =>
        jsonResponse({
          count: 1,
          results: [
            {
              title: "Joint Digital Reporting Rule",
              type: "Rule",
              abstract: "Several agencies issue one joint reporting rule.",
              document_number: "2026-joint-rule",
              html_url:
                "https://www.federalregister.gov/d/2026-joint-rule",
              publication_date: "2026-04-01",
              agencies: Array.from({ length: 8 }, (_, index) => ({
                name: `Agency ${index + 1} ${"x".repeat(120)}`,
              })),
            },
          ],
        }),
      retrievedAt,
      query: "joint digital reporting",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      population: "U.S. public technology firms",
      outcomeFamily: "Profitability",
      limit: 10,
    });

    const proposal = requireFindProposal(result.proposals[0]);
    expect(proposal.nativeIdentity?.issuer).toBeTypeOf("string");
    expect(proposal.nativeIdentity?.issuer?.length).toBe(500);
  });

  it("filters clearly administrative Federal Register event titles while retaining substantive notices", async () => {
    const result = await fetchFederalRegisterProposals({
      fetch: async () =>
        jsonResponse({
          count: 3,
          results: [
            {
              title:
                "Public Workshop, Webinar, and Listening Session on Digital Markets",
              type: "Notice",
              abstract: "The agency announces a public discussion session.",
              document_number: "2026-admin-session",
              html_url:
                "https://www.federalregister.gov/d/2026-admin-session",
              publication_date: "2026-05-01",
              agencies: [{ name: "Example Federal Agency" }],
            },
            {
              title: "Digital Markets Proposed Consent Order",
              type: "Notice",
              abstract: "The agency publishes a proposed consent order.",
              document_number: "2026-consent-order",
              html_url:
                "https://www.federalregister.gov/d/2026-consent-order",
              publication_date: "2026-05-02",
              agencies: [{ name: "Example Federal Agency" }],
            },
            {
              title:
                "Disclosure Requirements for Annual Shareholder Meetings",
              type: "Rule",
              abstract:
                "The agency establishes binding disclosure requirements.",
              document_number: "2026-shareholder-meeting-rule",
              html_url:
                "https://www.federalregister.gov/d/2026-shareholder-meeting-rule",
              publication_date: "2026-05-03",
              agencies: [{ name: "Example Federal Agency" }],
            },
          ],
        }),
      retrievedAt,
      query: "digital markets",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      population: "U.S. public technology firms",
      outcomeFamily: "Profitability",
      limit: 10,
    });

    expect(result.proposals.map((proposal) => proposal.id)).toEqual([
      "fr-2026-consent-order",
      "fr-2026-shareholder-meeting-rule",
    ]);
    expect(result.diagnostics).toMatchObject({
      recordsReceived: 3,
      recordsAccepted: 2,
      invalidRecordsDropped: 1,
      proposalsReturned: 2,
    });
  });

  it("does not present Manufacturing Council membership notices as regulatory shocks but preserves explicit administrative searches", async () => {
    const records = [
      {
        title: "Manufacturing Council",
        type: "Notice",
        action: "Notice of Renewal and Opportunity to Apply.",
        abstract:
          "The Secretary renewed the Manufacturing Council and the Department of Commerce is seeking candidates for membership.",
        document_number: "2014-21513",
        html_url:
          "https://www.federalregister.gov/d/2014-21513",
        publication_date: "2014-09-10",
        agencies: [{ name: "International Trade Administration" }],
      },
      {
        title: "Manufacturing Council",
        type: "Notice",
        action: "Notice of extension of the application deadline.",
        abstract:
          "The Department extends the application deadline for membership on the Manufacturing Council.",
        document_number: "2014-25531",
        html_url:
          "https://www.federalregister.gov/d/2014-25531",
        publication_date: "2014-10-27",
        agencies: [{ name: "International Trade Administration" }],
      },
      {
        title: "Manufacturing Supply Disclosure Consent Order",
        type: "Notice",
        abstract:
          "The agency publishes a proposed consent order concerning supply disclosures.",
        document_number: "2014-substantive-notice",
        html_url:
          "https://www.federalregister.gov/d/2014-substantive-notice",
        publication_date: "2014-11-03",
        agencies: [{ name: "Federal Trade Commission" }],
      },
      {
        title: "Manufacturing Emissions Reporting Requirements",
        type: "Rule",
        abstract:
          "The agency establishes binding reporting requirements for covered manufacturers.",
        document_number: "2014-substantive-rule",
        html_url:
          "https://www.federalregister.gov/d/2014-substantive-rule",
        publication_date: "2014-12-01",
        agencies: [{ name: "Environmental Protection Agency" }],
      },
    ];
    const fetchRecords = async () =>
      jsonResponse({ count: records.length, results: records });
    const shared = {
      fetch: fetchRecords,
      retrievedAt,
      query: "manufacturing",
      startDate: "2014-01-01",
      endDate: "2016-12-31",
      population: "U.S. public manufacturing firms",
      outcomeFamily: "Profitability",
      limit: 10,
      workflowMode: "find" as const,
    };

    const regulatory = await fetchFederalRegisterProposals({
      ...shared,
      eventFamily: "Regulation",
    });

    expect(regulatory.proposals.map((proposal) => proposal.id)).toEqual([
      "fr-2014-substantive-notice",
      "fr-2014-substantive-rule",
    ]);
    expect(
      regulatory.proposals.every(
        (proposal) =>
          proposal.mode !== "find" ||
          proposal.event.eventFamily === "Regulation",
      ),
    ).toBe(true);
    expect(regulatory.diagnostics).toMatchObject({
      recordsReceived: 4,
      recordsAccepted: 2,
      proposalsReturned: 2,
      invalidRecordsDropped: 2,
    });

    const administrative = await fetchFederalRegisterProposals({
      ...shared,
      eventFamily: "Administrative/governance shock",
    });
    const councilProposals = administrative.proposals
      .map(requireFindProposal)
      .filter((proposal) => proposal.title === "Manufacturing Council");

    expect(councilProposals).toHaveLength(2);
    expect(
      councilProposals.every(
        (proposal) =>
          proposal.event.eventFamily ===
            "Administrative/governance event" &&
          proposal.nativeIdentity?.status ===
            "Nonbinding administrative/governance notice" &&
          /nonbinding administrative\/governance notice/i.test(
            proposal.description,
          ) &&
          proposal.limitations.some((limitation) =>
            /does not itself establish a legal duty/i.test(limitation),
          ),
      ),
    ).toBe(true);

    const exactNamed = await fetchFederalRegisterProposals({
      ...shared,
      query: "Manufacturing Council",
      eventFamily: "Regulation",
    });
    const exactCouncilProposals = exactNamed.proposals
      .map(requireFindProposal)
      .filter((proposal) => proposal.title === "Manufacturing Council");
    expect(exactCouncilProposals).toHaveLength(2);
    expect(
      exactCouncilProposals.every(
        (proposal) =>
          proposal.event.eventFamily ===
          "Administrative/governance event",
      ),
    ).toBe(true);
  });

  it("fails one official query safely when its JSON response exceeds the byte bound", async () => {
    const oversized = JSON.stringify({
      count: 0,
      results: [],
      padding: "x".repeat(SCREEN_02_CONNECTOR_MAX_RESPONSE_BYTES),
    });
    const result = await fetchFederalRegisterProposals({
      fetch: async () =>
        new Response(oversized, {
          headers: { "content-type": "application/json" },
        }),
      retrievedAt,
      query: "video game",
      startDate: "2014-01-01",
      endDate: "2016-12-31",
      population: "U.S. public video-game firms",
      outcomeFamily: "Profitability",
      limit: 10,
    });

    expect(result.proposals).toEqual([]);
    expect(result.proposalBindings).toEqual([]);
    expect(result.diagnostics.channels[0]).toMatchObject({
      status: "failed",
      note: expect.stringMatching(/byte limit/i),
    });
  });

  it("cancels a chunked response without Content-Length before buffering beyond the byte bound", async () => {
    const streamed = chunkedResponseOverLimit(
      SCREEN_02_CONNECTOR_MAX_RESPONSE_BYTES,
    );
    expect(streamed.response.headers.has("content-length")).toBe(
      false,
    );

    const result = await fetchFederalRegisterProposals({
      fetch: async () => streamed.response,
      retrievedAt,
      query: "video game",
      startDate: "2014-01-01",
      endDate: "2016-12-31",
      population: "U.S. public video-game firms",
      outcomeFamily: "Profitability",
      limit: 10,
    });

    expect(result.proposals).toEqual([]);
    expect(result.diagnostics.channels[0]).toMatchObject({
      status: "failed",
      note: expect.stringMatching(/byte limit/i),
    });
    expect(streamed.wasCancelled()).toBe(true);
  });

  it("fails closed on an official-source redirect without following its location", async () => {
    let requestedInit: RequestInit | undefined;
    const fetchImpl: Screen02ConnectorFetch = async (_input, init) => {
      requestedInit = init;
      return new Response(null, {
        status: 302,
        headers: {
          location: "https://unreviewed.example/redirect-target",
        },
      });
    };

    const result = await fetchFederalRegisterProposals({
      fetch: fetchImpl,
      retrievedAt,
      query: "financial disclosure",
      startDate: "2020-01-01",
      endDate: "2022-12-31",
      population: "U.S. public firms",
      outcomeFamily: "Performance",
      limit: 1,
      timeoutMs: 500,
    });

    expect(requestedInit?.redirect).toBe("manual");
    expect(result.proposals).toEqual([]);
    expect(result.diagnostics.recordsReceived).toBe(0);
    expect(result.diagnostics.channels[0]).toMatchObject({
      status: "failed",
      retrievedAt,
    });
    expect(result.diagnostics.channels[0]?.note).toMatch(/HTTP 302/);
    expect(result.diagnostics.channels[0]?.note).not.toContain(
      "unreviewed.example",
    );
  });

  it("bounds the exact recorded Federal Register URL after multilingual percent-encoding", async () => {
    let requestedUrl = "";
    const query = "中".repeat(240);
    const result = await fetchFederalRegisterProposals({
      fetch: async (input) => {
        requestedUrl = String(input);
        return jsonResponse({ count: 0, results: [] });
      },
      retrievedAt,
      query,
      startDate: "2020-01-01",
      endDate: "2022-12-31",
      population: "中国上市公司",
      outcomeFamily: "企业绩效",
      limit: 1,
    });

    expect(requestedUrl.length).toBeLessThanOrEqual(
      SCREEN_02_CONNECTOR_MAX_RECORDED_REQUEST_URL_LENGTH,
    );
    expect(
      new URL(requestedUrl).searchParams.get("conditions[term]"),
    ).not.toBe(query);
    expect(result.diagnostics.queryMatrix[0]?.query).toBe(
      requestedUrl,
    );
    expect(result.diagnostics.queryMatrix[0]?.purpose).toMatch(
      /deterministically shortened/i,
    );
  });

  it("enforces connector limits and returns a failed channel instead of hiding an HTTP failure", async () => {
    const fetchImpl: Screen02ConnectorFetch = async () =>
      new Response("unavailable", { status: 503 });

    const result = await fetchFederalRegisterProposals({
      fetch: fetchImpl,
      retrievedAt,
      query: "financial disclosure",
      startDate: "2020-01-01",
      endDate: "2022-12-31",
      population: "U.S. public firms",
      outcomeFamily: "Performance",
      limit: 1,
      timeoutMs: 500,
    });

    expect(result.proposals).toEqual([]);
    expect(result.diagnostics.recordsReceived).toBe(0);
    expect(result.diagnostics.queryMatrix[0]?.returnedRecordIds).toEqual(
      [],
    );
    expect(result.diagnostics.channels[0]).toMatchObject({
      status: "failed",
      retrievedAt,
    });
    expect(result.diagnostics.channels[0]?.note).toMatch(/HTTP 503/);

    await expect(
      fetchFederalRegisterProposals({
        fetch: fetchImpl,
        retrievedAt,
        query: "financial disclosure",
        startDate: "2020-01-01",
        endDate: "2022-12-31",
        population: "U.S. public firms",
        outcomeFamily: "Performance",
        limit: SCREEN_02_CONNECTOR_MAX_LIMIT + 1,
      }),
    ).rejects.toThrow(/limit must be an integer/);

    await expect(
      fetchFederalRegisterProposals({
        fetch: fetchImpl,
        retrievedAt,
        query: "financial disclosure",
        startDate: "2020-01-01",
        endDate: "2022-12-31",
        population: "U.S. public firms",
        outcomeFamily: "Performance",
        timeoutMs: SCREEN_02_CONNECTOR_MAX_TIMEOUT_MS + 1,
      }),
    ).rejects.toThrow(/timeoutMs must be an integer/);
  });

  it("aborts a connector request at the configured timeout and records that failure", async () => {
    const fetchImpl: Screen02ConnectorFetch = () =>
      new Promise(() => undefined);

    const result = await fetchFederalRegisterProposals({
      fetch: fetchImpl,
      retrievedAt,
      query: "workplace safety",
      startDate: "2020-01-01",
      endDate: "2022-12-31",
      population: "U.S. public firms",
      outcomeFamily: "Performance",
      timeoutMs: 1,
    });

    expect(result.proposals).toEqual([]);
    expect(result.diagnostics.channels[0]).toMatchObject({
      status: "failed",
    });
    expect(result.diagnostics.channels[0]?.note).toMatch(
      /timed out after 1 ms/i,
    );
    expect(result.diagnostics.failureKind).toBe("timeout");
  });

  it("safely builds an OpenFEMA OData query and consolidates designated-area rows by disaster number", async () => {
    let requestedUrl = "";
    const fetchImpl: Screen02ConnectorFetch = async (input) => {
      requestedUrl = String(input);
      return jsonResponse({
        DisasterDeclarationsSummaries: [
          {
            id: "row-one",
            disasterNumber: 4321,
            state: "CA",
            declarationType: "DR",
            declarationDate: "2024-04-10T00:00:00.000Z",
            incidentType: "Flood",
            declarationTitle: "PACIFIC COAST STORMS",
            incidentBeginDate: "2024-04-01T00:00:00.000Z",
            incidentEndDate: "2024-04-12T00:00:00.000Z",
            designatedArea: "Alpha (County)",
          },
          {
            id: "row-two",
            disasterNumber: 4321,
            state: "CA",
            declarationType: "DR",
            declarationDate: "2024-04-10T00:00:00.000Z",
            incidentType: "Flood",
            declarationTitle: "PACIFIC COAST STORMS",
            incidentBeginDate: "2024-04-01T00:00:00.000Z",
            incidentEndDate: "2024-04-12T00:00:00.000Z",
            designatedArea: "Beta (County)",
          },
          {
            id: "invalid-row",
            disasterNumber: "not-a-number",
            state: "CA",
            declarationDate: "2024-04-10T00:00:00.000Z",
            declarationTitle: "INVALID",
          },
        ],
      });
    };

    const input: OpenFemaConnectorInput & {
      endpoint: string;
    } = {
      fetch: fetchImpl,
      retrievedAt,
      startDate: "2024-01-01",
      endDate: "2024-12-31",
      population: "U.S. exchange-listed firms",
      outcomeFamily: "Employment",
      state: "ca",
      incidentType: "King's Flood",
      limit: 3,
      timeoutMs: 500,
      endpoint: "https://untrusted.example/should-never-be-fetched",
    };
    const result = await fetchOpenFemaDisasterProposals(input);

    const url = new URL(requestedUrl);
    expect(url.origin + url.pathname).toBe(OPEN_FEMA_API_ENDPOINT);
    expect(requestedUrl).not.toContain("untrusted.example");
    expect(url.searchParams.get("$filter")).toBe(
      "declarationDate ge '2024-01-01T00:00:00.000Z' and declarationDate le '2024-12-31T23:59:59.999Z' and state eq 'CA' and incidentType eq 'King''s Flood'",
    );
    expect(url.searchParams.get("$top")).toBe("3");
    expect(url.searchParams.get("$orderby")).toBe(
      "declarationDate desc",
    );

    expect(result.proposals).toHaveLength(1);
    const proposal = requireFindProposal(result.proposals[0]);
    expect(proposal).toMatchObject({
      id: "fema-4321",
      mode: "find",
      kind: "event",
      origin: "newly-discovered",
      nativeIdentity: {
        formalIdentifier: "FEMA-4321",
        issuer: "Federal Emergency Management Agency (FEMA)",
        issuingJurisdiction: "United States",
        status: "DR declaration",
      },
      event: {
        eventDate: "2024-04-10",
        eventFamily: "Flood disaster",
        geographies: ["United States", "California", "CA"],
      },
    });
    expect(proposal?.description).toContain("Alpha (County)");
    expect(proposal?.description).toContain("Beta (County)");
    expect(proposal?.affectedPopulation).toBe(
      SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
    );
    expect(proposal?.event.populations).toEqual([
      SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
    ]);
    expect(JSON.stringify(proposal)).not.toContain(
      "U.S. exchange-listed firms",
    );
    expect(proposal?.outcomeLink).toMatchObject({
      status: "system-template",
      text: expect.stringMatching(/Source-grounded event feature/),
    });
    expect(proposal?.sources[0]).toMatchObject({
      id: "fema-source-4321",
      locator: "https://www.fema.gov/disaster/4321",
      publisher: "Federal Emergency Management Agency (FEMA)",
      publishedDate: "2024-04-10",
      authorityTier: 2,
      channel: "OpenFEMA Disaster Declarations Summaries v2",
      retrievedAt,
      authorityAssessment: {
        method: "connector-native",
      },
    });
    expect(proposal?.sources[0]?.evidenceText).toMatch(
      /Structured source-native fields \(not a verbatim passage\).*designated-area location: Alpha \(County\); Beta \(County\)/i,
    );
    expect(proposal?.sources[0]?.evidenceText).not.toMatch(
      /organization-to/i,
    );
    expect(proposal?.requiredVariables).toEqual(expect.arrayContaining([
      "Designated-area location",
      "Organization-to-designated-area location linkage",
    ]));
    expect(screen02SourceSupportsProposalIdentity(
      proposal,
      proposal.sources[0]!,
    )).toBe(true);

    expect(result.diagnostics).toMatchObject({
      connector: "openfema-disaster-declarations-v2",
      endpoint: OPEN_FEMA_API_ENDPOINT,
      resultLimit: 3,
      recordsReceived: 3,
      recordsAccepted: 2,
      proposalsReturned: 1,
      invalidRecordsDropped: 1,
      duplicateRecordsConsolidated: 1,
      limitReached: true,
      outcomeValuesInspected: false,
    });
    expect(
      result.diagnostics.queryMatrix[0]?.returnedRecordIds,
    ).toEqual(["row-one", "row-two", "invalid-row"]);
    expect(result.proposalBindings).toEqual([{
      proposalId: proposal.id,
      queryId: "openfema-disaster-declarations",
      returnedRecordIds: ["row-one", "row-two"],
      sourceIds: proposal.sources.map((source) => source.id),
    }]);
    expect(result.diagnostics.channels[0]?.note).toMatch(
      /consolidated.*1 provisional disaster candidate/i,
    );
    expect(result.diagnostics.channels[0]?.note).toMatch(
      /outcome values were not inspected/i,
    );
  });

  it("validates deterministic time and range inputs before making any request", async () => {
    let called = false;
    const fetchImpl: Screen02ConnectorFetch = async () => {
      called = true;
      return jsonResponse({});
    };

    await expect(
      fetchOpenFemaDisasterProposals({
        fetch: fetchImpl,
        retrievedAt: "now",
        startDate: "2024-01-01",
        endDate: "2024-12-31",
        population: "U.S. firms",
        outcomeFamily: "Performance",
      }),
    ).rejects.toThrow(/explicit ISO 8601 UTC timestamp/);

    await expect(
      fetchOpenFemaDisasterProposals({
        fetch: fetchImpl,
        retrievedAt,
        startDate: "2024-12-31",
        endDate: "2024-01-01",
        population: "U.S. firms",
        outcomeFamily: "Performance",
      }),
    ).rejects.toThrow(/valid inclusive YYYY-MM-DD range/);

    await expect(
      fetchOpenFemaDisasterProposals({
        fetch: fetchImpl,
        retrievedAt,
        startDate: "2024-01-01",
        endDate: "2024-12-31",
        population: "U.S. firms",
        outcomeFamily: "Performance",
        state: "California",
      }),
    ).rejects.toThrow(/two-letter U.S. postal code/);
    expect(called).toBe(false);
  });
});
