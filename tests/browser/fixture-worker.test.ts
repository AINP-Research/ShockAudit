import { describe, expect, it } from "vitest";

import { fingerprintScreen01StudyContext } from "../../src/core/screen02-service";
import { buildReviewedScreen02AuditDiscovery } from "../../src/core/screen02-audit-discovery";
import {
  buildScreen02WorkflowHandoff,
  serializeScreen02WorkflowHandoff,
} from "../../src/core/screen02-workflow-handoff";
import {
  createScreen02AuditState,
  fingerprintScreen02WorkflowValue,
} from "../../src/core/screen02-workflow-state";
import {
  requireScreen03ResearchPacket,
  screen03ProposalConfirmability,
} from "../../src/core/screen03-workflow";
import { researchScreen03Evidence } from "../../src/worker/screen03-evidence-service";
import {
  buildReadyFindState,
  confirmedWorkflowAuditContext,
  confirmedWorkflowFindContext,
} from "../core/screen02-workflow-fixtures";
import { GDELT_DOC_API_ENDPOINT } from "../../src/worker/contextual-discovery";
import { FEDERAL_REGISTER_API_ENDPOINT } from "../../src/worker/screen02-connectors";
import {
  EU_CELLAR_SPARQL_ENDPOINT,
  UK_LEGISLATION_ATOM_ENDPOINT,
  fetchEuCellarLegalProposals,
  fetchUkLegislationProposals,
} from "../../src/worker/screen02-global-connectors";
import {
  advanceBrowserFixtureScreen03Evidence,
  deterministicConnectorFetch,
} from "./fixture-worker";

const ccpaStatuteFixtureUrl =
  "https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=201720180AB375";
const ccpaRegulationsFixtureUrl = "https://oag.ca.gov/privacy/ccpa/regs";
const revisableCcpaFixtureUrls = [
  ccpaStatuteFixtureUrl,
  ccpaRegulationsFixtureUrl,
] as const;

const federalRegisterFields = [
  "document_number",
  "title",
  "type",
  "abstract",
  "action",
  "excerpts",
  "html_url",
  "pdf_url",
  "raw_text_url",
  "body_html_url",
  "publication_date",
  "effective_on",
  "agencies",
] as const;

function appendFederalRegisterFields(url: URL) {
  for (const field of federalRegisterFields) {
    url.searchParams.append("fields[]", field);
  }
}

function federalRegisterFixtureFetch(
  url: URL,
  overrides: RequestInit = {},
) {
  return deterministicConnectorFetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
    ...overrides,
  });
}

function overviewDocumentFixtureFetch(
  url: string | URL,
  overrides: RequestInit = {},
) {
  return deterministicConnectorFetch(url, {
    headers: {
      accept: "text/html, text/plain;q=0.9",
      "cache-control": "no-store",
      "user-agent": "ShockAudit/0.6.2 substantive-overview retrieval",
    },
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
    ...overrides,
  });
}

async function revisedCcpaDocuments() {
  return Promise.all(
    revisableCcpaFixtureUrls.map(async (url) =>
      (await overviewDocumentFixtureFetch(url)).text()
    ),
  );
}

function ccpaAuditRequest(query: string, perPage = "12") {
  const url = new URL(FEDERAL_REGISTER_API_ENDPOINT);
  url.searchParams.set("conditions[term]", query);
  url.searchParams.set("conditions[publication_date][gte]", "2015-01-01");
  url.searchParams.set("conditions[publication_date][lte]", "2021-12-31");
  for (const type of ["RULE", "PRORULE", "NOTICE"]) {
    url.searchParams.append("conditions[type][]", type);
  }
  appendFederalRegisterFields(url);
  url.searchParams.set("per_page", perPage);
  url.searchParams.set("order", "relevance");
  return url;
}

function privacyFindRequest(
  documentTypes: readonly string[] = ["RULE", "PRORULE", "NOTICE"],
  perPage = "5",
) {
  const url = new URL(FEDERAL_REGISTER_API_ENDPOINT);
  url.searchParams.set("conditions[term]", "Technology");
  url.searchParams.set("conditions[publication_date][gte]", "2016-01-01");
  url.searchParams.set("conditions[publication_date][lte]", "2020-12-31");
  for (const type of documentTypes) {
    url.searchParams.append("conditions[type][]", type);
  }
  appendFederalRegisterFields(url);
  url.searchParams.set("per_page", perPage);
  url.searchParams.set("order", "relevance");
  return url;
}

function manufacturingFindRequest(
  query: string,
  options: {
    documentTypes?: readonly string[];
    from?: string;
    through?: string;
    perPage?: string;
  } = {},
) {
  const url = new URL(FEDERAL_REGISTER_API_ENDPOINT);
  url.searchParams.set("conditions[term]", query);
  url.searchParams.set(
    "conditions[publication_date][gte]",
    options.from ?? "2014-01-01",
  );
  url.searchParams.set(
    "conditions[publication_date][lte]",
    options.through ?? "2022-12-31",
  );
  for (
    const type of options.documentTypes ?? ["RULE", "PRORULE", "NOTICE"]
  ) {
    url.searchParams.append("conditions[type][]", type);
  }
  appendFederalRegisterFields(url);
  url.searchParams.set("per_page", options.perPage ?? "5");
  url.searchParams.set("order", "relevance");
  return url;
}

function technologyFindRequest(
  query: string,
  options: {
    from?: string;
    through?: string;
    perPage?: string;
  } = {},
) {
  const url = new URL(FEDERAL_REGISTER_API_ENDPOINT);
  url.searchParams.set("conditions[term]", query);
  url.searchParams.set(
    "conditions[publication_date][gte]",
    options.from ?? "2016-01-01",
  );
  url.searchParams.set(
    "conditions[publication_date][lte]",
    options.through ?? "2020-12-31",
  );
  for (const type of ["RULE", "PRORULE", "NOTICE"]) {
    url.searchParams.append("conditions[type][]", type);
  }
  appendFederalRegisterFields(url);
  url.searchParams.set("per_page", options.perPage ?? "5");
  url.searchParams.set("order", "relevance");
  return url;
}

function gamingFindRequest(query: string, perPage = "5") {
  const url = new URL(FEDERAL_REGISTER_API_ENDPOINT);
  url.searchParams.set("conditions[term]", query);
  url.searchParams.set("conditions[publication_date][gte]", "2014-01-01");
  url.searchParams.set("conditions[publication_date][lte]", "2016-12-31");
  for (const type of ["RULE", "PRORULE", "NOTICE"]) {
    url.searchParams.append("conditions[type][]", type);
  }
  appendFederalRegisterFields(url);
  url.searchParams.set("per_page", perPage);
  url.searchParams.set("order", "relevance");
  return url;
}

const gamingQueries = [
  "video game",
  "video gaming",
  "video game console",
  "interactive entertainment",
  "game software",
  "online game",
] as const;

const manufacturingBaselineQueries = [
  "Manufacturing",
  "Manufacturing California consumer privacy business thresholds",
  "Manufacturing consumer data privacy regulation technology firms",
  "advanced manufacturing",
  "factory operator",
  "industrial product",
  "assembly",
  "industrial production",
  "Manufacturing united states us usa united states of america",
  "Manufacturing united states us federal us states",
  "Manufacturing us usa united states of america",
  "Manufacturing regulation",
  "Manufacturing regulation 2014 2022",
  "Manufacturing eligibility threshold",
] as const;

const manufacturingExpansionQueries = [
  "Manufacturing Regulation official title identifier issuing authority",
  "Manufacturing Regulation enacted adopted effective commencement date",
  "Manufacturing Regulation covered entities eligibility threshold exemption",
  "Manufacturing Regulation California consumer privacy business thresholds consumer data privacy regulation technology firms official title identifier issuing authority",
  "Manufacturing Regulation California consumer privacy business thresholds consumer data privacy regulation technology firms enacted adopted effective commencement date",
  "Manufacturing Regulation California consumer privacy business thresholds consumer data privacy regulation technology firms covered entities eligibility threshold exemption",
] as const;

const technologyBaselineQueries = [
  "Technology",
  "Technology California consumer privacy business thresholds",
  "Technology consumer data privacy regulation technology firms",
  "Technology united states us usa united states of america",
  "Technology united states us federal us states",
  "Technology us usa united states of america",
  "Technology regulation",
  "Technology eligibility threshold",
  "Technology reporting disclosure",
  "Technology licensing permit",
  "Technology safety standard",
  "Technology market access restriction",
  "Technology tax fee assessment",
] as const;

const technologyExpansionQueries = [
  "Technology Regulation official title identifier issuing authority",
  "Technology Regulation enacted adopted effective commencement date",
  "Technology Regulation covered entities eligibility threshold exemption",
  "Technology Regulation California consumer privacy business thresholds consumer data privacy regulation technology firms official title identifier issuing authority",
  "Technology Regulation California consumer privacy business thresholds consumer data privacy regulation technology firms enacted adopted effective commencement date",
  "Technology Regulation California consumer privacy business thresholds consumer data privacy regulation technology firms covered entities eligibility threshold exemption",
] as const;

const ccpaAuditExpansionQueries = [
  "California Consumer Privacy Act California Legislature official title identifier issuing authority",
  "California Consumer Privacy Act California Legislature enacted adopted effective commencement date",
  "California Consumer Privacy Act California Legislature covered entities eligibility threshold exemption",
] as const;

function reviewedGdprResearchHandoff() {
  const baseline = confirmedWorkflowAuditContext();
  const context = {
    ...baseline,
    knownShock: "GDPR",
    studySentence: "Audit whether GDPR affected innovation among U.S. firms from 2015 to 2023.",
    contractSourceSentence: "Audit whether GDPR affected innovation among U.S. firms from 2015 to 2023.",
    scopeContract: {
      ...baseline.scopeContract,
      population: "U.S. firms",
      industry: "All industries",
    },
  };
  const reviewed = buildReviewedScreen02AuditDiscovery(
    createScreen02AuditState(context, "browser-gdpr-contract", "2026-08-09T18:00:00.000Z"),
    { matchSetSnapshotId: "browser-gdpr-matches", at: "2026-08-09T18:00:01.000Z" },
  );
  const match = reviewed.matches.find((candidate) =>
    candidate.identity.formalIdentifier === "Regulation (EU) 2016/679"
  );
  if (!match) throw new Error("Expected the reviewed GDPR identity.");
  const reviewedSource = reviewed.sources.find((source) => match.sourceIds.includes(source.id));
  if (!reviewedSource) throw new Error("Expected the reviewed GDPR source.");

  // Keep an already-valid continuation envelope and its source references;
  // exercise the browser's reviewed event identity, source, and study window
  // through the real Screen 3 research pipeline.
  const handoff = structuredClone(buildScreen02WorkflowHandoff(
    buildReadyFindState(), "0.4.4", "2026-08-09T18:01:00.000Z",
  ));
  handoff.screen01Baseline = confirmedWorkflowFindContext("Technology", { studyPeriod: context.scopeContract.studyPeriod });
  handoff.screen01Fingerprint = fingerprintScreen01StudyContext(handoff.screen01Baseline);
  handoff.event.identity = structuredClone(match.identity);
  const { sourceFingerprint: _sourceFingerprint, ...source } = reviewedSource;
  const replacement = { ...source, id: handoff.sources[0]!.id };
  handoff.sources = [{
    ...replacement,
    sourceFingerprint: fingerprintScreen02WorkflowValue(replacement),
  }];
  handoff.integrity.eventFingerprint = fingerprintScreen02WorkflowValue(handoff.event);
  const { handoffFingerprint: _handoffFingerprint, ...integrity } = handoff.integrity;
  handoff.integrity.handoffFingerprint = fingerprintScreen02WorkflowValue({ ...handoff, integrity });
  return JSON.parse(serializeScreen02WorkflowHandoff(handoff)) as typeof handoff;
}

describe("the deterministic browser connector fixture", () => {
  it("accepts only the projected rule-and-notice Find profile", async () => {
    await expect(
      federalRegisterFixtureFetch(privacyFindRequest()),
    ).resolves.toHaveProperty("status", 200);
    await expect(
      federalRegisterFixtureFetch(
        privacyFindRequest(["RULE", "PRORULE"]),
      ),
    ).rejects.toThrow("rejected unexpected request");
    const missingFields = privacyFindRequest();
    missingFields.searchParams.delete("fields[]");
    await expect(
      federalRegisterFixtureFetch(missingFields),
    ).rejects.toThrow("rejected unexpected request");
    const duplicateField = privacyFindRequest();
    duplicateField.searchParams.append("fields[]", "agencies");
    await expect(
      federalRegisterFixtureFetch(duplicateField),
    ).rejects.toThrow("rejected unexpected request");
    await expect(
      federalRegisterFixtureFetch(
        privacyFindRequest(["RULE", "PRORULE"], "20"),
      ),
    ).rejects.toThrow("rejected unexpected request");
    await expect(
      deterministicConnectorFetch(privacyFindRequest()),
    ).rejects.toThrow("rejected unexpected Federal Register transport");
    await expect(
      federalRegisterFixtureFetch(privacyFindRequest(), { method: "POST" }),
    ).rejects.toThrow("rejected unexpected Federal Register transport");
    await expect(
      federalRegisterFixtureFetch(privacyFindRequest(), {
        headers: { accept: "text/html" },
      }),
    ).rejects.toThrow("rejected unexpected Federal Register transport");
    await expect(
      federalRegisterFixtureFetch(privacyFindRequest(), {
        redirect: "follow",
      }),
    ).rejects.toThrow("rejected unexpected Federal Register transport");
  });

  it("serves only the exact bounded Manufacturing query plan without inventing official records", async () => {
    for (const query of [
      ...manufacturingBaselineQueries,
      ...manufacturingExpansionQueries,
    ]) {
      const response = await federalRegisterFixtureFetch(
        manufacturingFindRequest(query),
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        count: 0,
        results: [],
      });
    }

    const unexpectedParameter = manufacturingFindRequest("Manufacturing");
    unexpectedParameter.searchParams.set("unexpected", "1");
    const duplicateLimit = manufacturingFindRequest("Manufacturing");
    duplicateLimit.searchParams.append("per_page", "5");
    for (const request of [
      manufacturingFindRequest("Manufacturing unrelated near miss"),
      manufacturingFindRequest(
        "Manufacturing Regulation California consumer privacy business thresholds consumer data privacy regulation technology firms implementation compliance amendment enforcement",
      ),
      manufacturingFindRequest("Manufacturing", { perPage: "20" }),
      manufacturingFindRequest("Manufacturing", { from: "2015-01-01" }),
      manufacturingFindRequest("Manufacturing", {
        documentTypes: ["RULE", "PRORULE"],
      }),
      manufacturingFindRequest("Manufacturing", {
        documentTypes: ["RULE,PRORULE"],
      }),
      unexpectedParameter,
      duplicateLimit,
    ]) {
      await expect(federalRegisterFixtureFetch(request)).rejects.toThrow(
        "rejected unexpected request",
      );
    }

  });

  it("keeps the legacy gaming fixture inside the current result and date bounds", async () => {
    for (const query of gamingQueries) {
      const response = await federalRegisterFixtureFetch(
        gamingFindRequest(query),
      );
      const payload = await response.json() as {
        count: number;
        results: Array<{ publication_date: string }>;
      };
      expect(payload.count).toBe(8);
      expect(payload.results).toHaveLength(5);
      expect(payload.results.every((record) =>
        record.publication_date >= "2014-01-01" &&
        record.publication_date <= "2016-12-31"
      )).toBe(true);
    }
    await expect(
      federalRegisterFixtureFetch(gamingFindRequest("casino")),
    ).rejects.toThrow("rejected unexpected request");
    await expect(
      federalRegisterFixtureFetch(gamingFindRequest("video game", "20")),
    ).rejects.toThrow("rejected unexpected request");
  });

  it("serves the exact bounded Technology query plans at the current five-row limit", async () => {
    for (const [from, through, yearQuery] of [
      ["2016-01-01", "2020-12-31", "Technology regulation 2016 2020"],
      ["2017-01-01", "2023-12-31", "Technology regulation 2017 2023"],
    ] as const) {
      for (const query of [
        ...technologyBaselineQueries,
        yearQuery,
        ...technologyExpansionQueries,
      ]) {
        const response = await federalRegisterFixtureFetch(
          technologyFindRequest(query, { from, through }),
        );
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
          count: 0,
          results: [],
        });
      }
    }

    for (const request of [
      technologyFindRequest("technology"),
      technologyFindRequest("Technology unrelated near miss"),
      technologyFindRequest(
        "Technology Regulation implementation compliance amendment enforcement",
      ),
      technologyFindRequest("Technology", { perPage: "20" }),
      technologyFindRequest("Technology", { through: "2021-12-31" }),
      technologyFindRequest("Technology regulation 2017 2023"),
      technologyFindRequest("Technology regulation 2016 2020", {
        from: "2017-01-01",
        through: "2023-12-31",
      }),
    ]) {
      await expect(federalRegisterFixtureFetch(request)).rejects.toThrow(
        "rejected unexpected request",
      );
    }

    await expect(
      federalRegisterFixtureFetch(
        technologyFindRequest("Technology"),
        { signal: AbortSignal.abort() },
      ),
    ).rejects.toThrow("rejected unexpected Federal Register transport");
  });

  it("serves identity-bound official text for every reviewed candidate used by the bounded browser journeys", async () => {
    const documents = [
      [
        "https://leg.colorado.gov/bills/sb21-190?exec=1ba5018",
        "Colorado Privacy Act",
        "2023-07-01",
      ],
      [
        "https://www.cga.ct.gov/2023/pub/chap_743jj.htm",
        "Connecticut Data Privacy Act",
        "2023-07-01",
      ],
      [
        "https://legacylis.virginia.gov/cgi-bin/legp604.exe?212+ful+CHAP0035+hil",
        "Consumer Data Protection Act",
        "2023-01-01",
      ],
      [
        "https://le.utah.gov/~2022/bills/sbillenr/SB0227.htm",
        "Utah Consumer Privacy Act",
        "2023-12-31",
      ],
      [
        "https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=201720180SB327",
        "California Security of Connected Devices Law",
        "2020-01-01",
      ],
      [
        "https://eur-lex.europa.eu/eli/reg/2022/1925/oj/eng",
        "Digital Markets Act",
        "2023-05-02",
      ],
      [
        "https://eur-lex.europa.eu/LexUriServ/LexUriServ.do?uri=CELEX%3A32003L0087%3Aen%3AHTML",
        "Directive 2003/87/EC",
        "2005-01-01",
      ],
      [
        "https://climate.ec.europa.eu/eu-action/carbon-markets/about-eu-ets_en",
        "EU Emissions Trading System",
        "2005-01-01",
      ],
      [
        "https://www.sec.gov/files/conflict-minerals-disclosure-small-entity-compliance-guide.htm",
        "Conflict Minerals Disclosure",
        "2012-11-13",
      ],
    ] as const;
    for (const [url, identity, effectiveDate] of documents) {
      const document = await (await overviewDocumentFixtureFetch(url)).text();
      expect(document).toContain(identity);
      expect(document).toContain(effectiveDate);
      expect(document).toMatch(/requires|obligations/u);
    }
  });

  it("accepts the canonical bounded Audit baseline and expansion profile only", async () => {
    await expect(
      federalRegisterFixtureFetch(
        ccpaAuditRequest("California Consumer Privacy Act"),
      ),
    ).resolves.toHaveProperty("status", 200);
    for (const query of ccpaAuditExpansionQueries) {
      await expect(
        federalRegisterFixtureFetch(ccpaAuditRequest(query)),
      ).resolves.toHaveProperty("status", 200);
    }
    await expect(
      federalRegisterFixtureFetch(
        ccpaAuditRequest("California Consumer Privacy Act", "11"),
      ),
    ).rejects.toThrow("rejected unexpected request");
    await expect(
      federalRegisterFixtureFetch(
        ccpaAuditRequest(
          "Unexpected identity enacted adopted effective commencement date",
        ),
      ),
    ).rejects.toThrow("rejected unexpected request");
    await expect(
      federalRegisterFixtureFetch(
        ccpaAuditRequest(
          "California Consumer Privacy Act California Legislature implementation compliance amendment enforcement",
        ),
      ),
    ).rejects.toThrow("rejected unexpected request");
  });

  it("serves bounded EU, UK, and controlling-text fixtures for the Northern Europe electricity journey", async () => {
    const shared = {
      fetch: deterministicConnectorFetch,
      retrievedAt: "2026-08-21T12:00:00.000Z",
      startDate: "2021-01-01",
      endDate: "2024-12-31",
      population: "Electricity firms",
      outcomeFamily: "Profitability",
      limit: 5,
      timeoutMs: 5_000,
      queryId: "browser-electricity",
      queryPurpose: "Exercise the exact deterministic browser fixture.",
    } as const;
    const cellarResult = await fetchEuCellarLegalProposals({
      ...shared,
      query: "electricity",
      language: "en",
    });
    expect(cellarResult.proposals).toEqual([
      expect.objectContaining({
        title: "Electricity Market Design Regulation",
      }),
    ]);

    const ukResult = await fetchUkLegislationProposals({
      ...shared,
      query: "Electricity Regulation",
    });
    expect(ukResult.proposals).toEqual([
      expect.objectContaining({
        title: "Electricity Market Reform Act 2023",
      }),
    ]);

    const invalidCellar = new URL(EU_CELLAR_SPARQL_ENDPOINT);
    invalidCellar.searchParams.set("query", "SELECT * WHERE {}");
    invalidCellar.searchParams.set(
      "format",
      "application/sparql-results+json",
    );
    await expect(deterministicConnectorFetch(invalidCellar)).rejects.toThrow(
      "rejected unexpected request",
    );

    const invalidUk = new URL(UK_LEGISLATION_ATOM_ENDPOINT);
    invalidUk.pathname = "/all/2021-2024/data.feed";
    invalidUk.searchParams.set("title", "Electricity Regulation");
    await expect(deterministicConnectorFetch(invalidUk)).rejects.toThrow(
      "rejected unexpected request",
    );

    const euDocument = await overviewDocumentFixtureFetch(
      "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32024R1747",
    );
    await expect(euDocument.text()).resolves.toContain(
      "consumer contracting information",
    );
    const ukDocument = await overviewDocumentFixtureFetch(
      "https://www.legislation.gov.uk/ukpga/2023/52",
    );
    await expect(ukDocument.text()).resolves.toContain(
      "market governance",
    );
  });

  it("provides exact structured GDPR fields through the real Screen 3 research path and rejects altered requests", async () => {
    const requests: Array<{ url: URL; init: RequestInit | undefined }> = [];
    const rejected: string[] = [];
    const packet = requireScreen03ResearchPacket(await researchScreen03Evidence({
      handoff: reviewedGdprResearchHandoff(),
      retrievedAt: "2026-08-09T18:02:00.000Z",
      fetch: async (input, init) => {
        const url = new URL(String(input));
        requests.push({ url, init });
        try {
          return await deterministicConnectorFetch(input, init);
        } catch (error) {
          rejected.push(String(error));
          throw error;
        }
      },
    }));
    const cellar = requests.filter(({ url }) =>
      `${url.origin}${url.pathname}` === EU_CELLAR_SPARQL_ENDPOINT
    );
    expect(cellar).toHaveLength(6);
    expect(new Set(cellar.map(({ url }) => url.searchParams.get("query"))).size).toBe(6);
    expect(cellar[0]!.url.searchParams.get("query"))
      .toContain('FILTER(STR(?celex) = "32016R0679")');
    expect(rejected.filter((error) => /CELLAR|eur-lex/.test(error))).toEqual([]);
    expect(requests.some(({ url }) =>
      url.toString() === "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679"
    )).toBe(true);

    const officialPassages = packet.evidence.flatMap((source) => source.passages)
      .filter((passage) => passage.basis === "official-record-field");
    expect(officialPassages).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: "32016R0679", officialField: "formal-identifier" }),
      expect.objectContaining({ text: "General Data Protection Regulation", officialField: "canonical-title" }),
    ]));
    // CELEX is the raw structured identifier. The public legal citation
    // must be grounded in the document rather than fabricated as a raw field.
    expect(officialPassages).not.toContainEqual(expect.objectContaining({
      text: "Regulation (EU) 2016/679", officialField: "formal-identifier",
    }));
    const directDocumentPassages = packet.evidence.flatMap((source) => source.passages)
      .filter((passage) => passage.basis === "official-document-passage");
    const documentPassageIds = new Set(directDocumentPassages.map((passage) => passage.id));
    const directIdentity = packet.proposals.identity.filter((proposal) =>
      proposal.support === "direct" && proposal.passageIds.some((id) => documentPassageIds.has(id))
    );
    expect(directIdentity.length).toBeGreaterThanOrEqual(2);
    expect(directIdentity).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: "Canonical event title", value: "General Data Protection Regulation",
      }),
      expect.objectContaining({
        label: "Formal identifier", value: "Regulation (EU) 2016/679",
      }),
    ]));
    const formalIdentifier = directIdentity.find((proposal) => proposal.label === "Formal identifier")!;
    expect(directDocumentPassages.some((passage) =>
      formalIdentifier.passageIds.includes(passage.id) && passage.text.includes("Regulation (EU) 2016/679")
    )).toBe(true);
    for (const proposal of directIdentity) {
      expect(screen03ProposalConfirmability(proposal, packet.evidence).confirmable).toBe(true);
    }
    expect(packet.proposals.identity.some((proposal) =>
      proposal.support === "indirect" && !screen03ProposalConfirmability(proposal, packet.evidence).confirmable
    )).toBe(true);

    const { url: exactUrl, init: exactInit } = cellar[0]!;
    const mismatchedExactKey = new URL(exactUrl);
    mismatchedExactKey.searchParams.set("query",
      mismatchedExactKey.searchParams.get("query")!.replace("32016R0679", "32016R0680"));
    await expect(deterministicConnectorFetch(mismatchedExactKey, exactInit), "wrong exact CELEX identity")
      .rejects.toThrow("rejected unexpected request");
    const { url: validUrl, init: validInit } = cellar.find(({ url }) =>
      url.searchParams.get("query")?.includes('LCASE("enactment")')
    )!;
    for (const [name, from, to] of [
      ["wrong identity", "2016", "2017"],
      ["wrong stage", "enactment", "unknown"],
      ["wrong date window", "2012-01-01", "2011-01-01"],
      ["wrong result limit", "LIMIT 5", "LIMIT 6"],
      ["wrong language", "/language/ENG", "/language/DEU"],
    ]) {
      const altered = new URL(validUrl);
      altered.searchParams.set("query", altered.searchParams.get("query")!.replace(from!, to!));
      await expect(deterministicConnectorFetch(altered, validInit), name)
        .rejects.toThrow("rejected unexpected request");
    }
    const extraParameter = new URL(validUrl);
    extraParameter.searchParams.set("unexpected", "1");
    await expect(deterministicConnectorFetch(extraParameter, validInit))
      .rejects.toThrow("rejected unexpected request");
    const wrongFormat = new URL(validUrl);
    wrongFormat.searchParams.set("format", "text/html");
    await expect(deterministicConnectorFetch(wrongFormat, validInit))
      .rejects.toThrow("rejected unexpected request");
    await expect(deterministicConnectorFetch(validUrl, { ...validInit, method: "POST" }))
      .rejects.toThrow("rejected unexpected request");
  });

  it("rejects hidden Request state and null abort signals", async () => {
    await expect(
      deterministicConnectorFetch(
        new Request(privacyFindRequest(), {
          method: "POST",
          body: "unexpected",
        }),
        {
          method: "GET",
          headers: { accept: "application/json" },
          redirect: "manual",
          cache: "no-store",
          signal: AbortSignal.timeout(5_000),
        },
      ),
    ).rejects.toThrow("rejects Request inputs");
    await expect(
      federalRegisterFixtureFetch(privacyFindRequest(), { signal: null }),
    ).rejects.toThrow("rejected unexpected Federal Register transport");
    const credentialedFixtureUrl = new URL(
      "https://leg.colorado.gov/bills/sb21-190",
    );
    credentialedFixtureUrl.username = "fixture-user";
    credentialedFixtureUrl.password = "fixture-password";
    credentialedFixtureUrl.searchParams.set("exec", "1ba5018");
    await expect(
      overviewDocumentFixtureFetch(credentialedFixtureUrl),
    ).rejects.toThrow("rejected URL credentials");
  });

  it("accepts only the exact bounded CCPA contextual-index request and returns no invented article", async () => {
    const request = new URL(GDELT_DOC_API_ENDPOINT);
    request.searchParams.set(
      "query",
      "California Consumer Privacy Act",
    );
    request.searchParams.set("mode", "artlist");
    request.searchParams.set("format", "json");
    request.searchParams.set("sort", "datedesc");
    request.searchParams.set("maxrecords", "1");
    request.searchParams.set("startdatetime", "20250808000000");
    request.searchParams.set("enddatetime", "20260809235959");
    const transport = {
      method: "GET",
      headers: { accept: "application/json" },
      redirect: "manual" as const,
      cache: "no-store" as const,
      signal: AbortSignal.timeout(5_000),
    };

    await expect(
      (await deterministicConnectorFetch(request, transport)).json(),
    ).resolves.toEqual({ articles: [] });

    const unexpected = new URL(request);
    unexpected.searchParams.set("maxrecords", "2");
    await expect(
      deterministicConnectorFetch(unexpected, transport),
    ).rejects.toThrow("rejected unexpected request");
  });

  it("serves the exact controlling text used by the post-Undo alternative-shock journey", async () => {
    const response = await overviewDocumentFixtureFetch(
      "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX%3A32014L0095",
    );
    const document = await response.text();
    expect(document).toContain("large public-interest entities");
    expect(document).toContain("exceeding 500 employees");
    expect(document).toContain("financial years beginning on January 1, 2017");
    expect(document).toContain("must publish a non-financial statement");
  });

  it("changes the Screen 3 official-source fixture on every evidence advance", async () => {
    const original = await revisedCcpaDocuments();

    expect(advanceBrowserFixtureScreen03Evidence()).toBe(1);
    const revised = await revisedCcpaDocuments();
    for (let index = 0; index < revised.length; index += 1) {
      expect(revised[index]).not.toBe(original[index]);
      expect(revised[index]).toContain(
        "deterministic browser fixture revision 1",
      );
    }

    expect(advanceBrowserFixtureScreen03Evidence()).toBe(2);
    const restored = await revisedCcpaDocuments();
    expect(restored).toEqual(original);
  });
});
