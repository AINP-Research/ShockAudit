import { describe, expect, it, vi } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import {
  createCompletedStudyFirstEventInvestigation,
  createRefreshedStudyFirstEventInvestigation,
  currentStudyFirstEventInvestigation,
  studyFirstEventSourceInputFingerprint,
  validateStudyFirstEventInvestigationCollections,
} from "../../src/core/six-screen/study-first-event-investigation";
import {
  openScreen3,
  openScreen4,
  type StudyContextDraft,
} from "../../src/core/six-screen/workflow";
import { executeStudyFirstEventInvestigation,
  rebindStudyFirstEventSourceResult,
  studyFirstEventStepResourceCaps } from
  "../../src/worker/screen04-study-first-investigation";
import { buildSixScreenSourceRegister } from
  "../../src/worker/six-screen-source-register";
import { createBrowserEventCardFixture } from
  "../browser/six-screen-event-card-review-fixture";

const draft: StudyContextDraft = {
  population: "U.S. public manufacturers",
  analysisUnit: "firm-year",
  geography: ["United States", "CA"],
  industry: ["Manufacturing"],
  period: { start: "2018", end: "2025" },
  outcome: "Firm performance",
  outcomeMeasure: null,
  intendedConstruct: "Organizational performance",
  policySideConcept: "Customer protection",
  initialExplanation: "Through customer confidence.",
  proposedTreatment: "California firms",
  proposedComparison: "Non-California firms",
  resultsPreviouslyInspected: "not_disclosed",
};

function openedScreen4Fixture(studyDraft = draft) {
  const fixture = createBrowserEventCardFixture();
  const opened3 = openScreen3(fixture.state, {
    expectedRevision: fixture.state.revision,
    study: studyDraft,
    proposedTiming: { mode: "year", year: 2020, milestoneReference: null },
    openedAt: "2026-09-20T15:00:00.000Z",
  });
  const opened4 = openScreen4(opened3.state, {
    expectedRevision: opened3.state.revision,
    openedAt: "2026-09-20T15:00:01.000Z",
  });
  return opened4;
}

function plannedInvestigation(studyDraft = draft) {
  const opened4 = openedScreen4Fixture(studyDraft);
  const investigation = currentStudyFirstEventInvestigation({
    studyFirstEventInvestigations:
      opened4.state.studyFirstEventInvestigations,
    confirmedShock: opened4.state.confirmedShock,
    study: opened4.state.study,
    entryContext: opened4.state.screen3StudyEntryContexts!.at(-1)!,
    timing: opened4.state.proposedTreatmentTimings!.at(-1)!,
    advice: opened4.state.studyDesignAdvices!.at(-1)!,
    selection: null,
  });
  if (!investigation) throw new Error("Missing planned investigation fixture.");
  return investigation;
}

function federalRows(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    document_number: `2021-${12340 + index}`,
    title: index === 0
      ? "Manufacturing crédit-market reporting rule 跨境"
      : `Manufacturing credit-market rule ${index + 1}`,
    type: "Rule",
    abstract:
      "The commission changed a lending requirement for manufacturing credit markets.",
    action: "Final rule.",
    excerpts: ["A lending requirement for manufacturing credit markets changed."],
    html_url:
      `https://www.federalregister.gov/documents/2021/05/${String(index + 10).padStart(2, "0")}/2021-${12340 + index}/example`,
    publication_date: `2021-05-${String(index + 10).padStart(2, "0")}`,
    effective_on: `2021-06-${String(index + 10).padStart(2, "0")}`,
    agencies: [{ name: "Federal fixture agency" }],
  }));
}

function femaRows(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `fema-row-${index + 1}`,
    disasterNumber: 4500 + index,
    state: "CA",
    declarationType: "DR",
    declarationDate: `2022-02-${String(index + 10).padStart(2, "0")}T00:00:00.000Z`,
    incidentType: "Flood",
    declarationTitle: `PACIFIC STORM ${index + 1}`,
    incidentBeginDate: `2022-02-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
    incidentEndDate: `2022-02-${String(index + 5).padStart(2, "0")}T00:00:00.000Z`,
    designatedArea: "Fixture County",
  }));
}

function fixtureFetch(input: { federal: number; fema: number; status?: number }) {
  return vi.fn(async (request: RequestInfo | URL) => {
    if (input.status && input.status !== 200) {
      return new Response(null, { status: input.status });
    }
    const url = String(request);
    const body = /openfema|fema\.gov|DisasterDeclarationsSummaries/iu.test(url)
      ? { DisasterDeclarationsSummaries: femaRows(input.fema) }
      : { count: input.federal, results: federalRows(input.federal) };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
}

function federalRecordFetch(record: ReturnType<typeof federalRows>[number]) {
  return vi.fn(async (request: RequestInfo | URL) => {
    if (/openfema|fema\.gov|DisasterDeclarationsSummaries/iu.test(
      String(request),
    )) {
      return new Response(JSON.stringify({ DisasterDeclarationsSummaries: [] }), {
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ count: 1, results: [record] }), {
      headers: { "content-type": "application/json" },
    });
  });
}

function ccpaInvestigation() {
  const investigation = structuredClone(plannedInvestigation());
  investigation.context.policy.officialTitle =
    "California Consumer Privacy Act";
  investigation.context.policy.aliases = ["CCPA"];
  investigation.context.policy.formalIdentifiers = ["Cal. Civ. Code 1798.100"];
  return investigation;
}

async function execute(
  investigation: ReturnType<typeof plannedInvestigation>,
  fetch: ReturnType<typeof fixtureFetch>,
  options: {
    sourceRegister?: ReturnType<typeof buildSixScreenSourceRegister>;
    govInfoApiKey?: string;
    congressApiKey?: string;
    regulationsApiKey?: string;
    openStatesApiKey?: string;
  } = {},
) {
  let tick = 2;
  let monotonic = 0;
  return executeStudyFirstEventInvestigation({
    investigation,
    fetch,
    now: () => `2026-09-20T15:00:${String(tick++).padStart(2, "0")}.000Z`,
    monotonicNow: () => (monotonic += 5),
    sourceRegister: options.sourceRegister ?? buildSixScreenSourceRegister({}),
    govInfoApiKey: options.govInfoApiKey,
    congressApiKey: options.congressApiKey,
    regulationsApiKey: options.regulationsApiKey,
    openStatesApiKey: options.openStatesApiKey,
  });
}

function analysesForProvider(
  result: Awaited<ReturnType<typeof execute>>,
  providerId: string,
) {
  const ids = new Set(result.occurrences.filter((occurrence) =>
    occurrence.providerId === providerId).map(({ id }) => id));
  return result.analyses.filter(({ eventId }) => ids.has(eventId));
}

describe("study-first Screen 4 automatic event investigation", () => {
  it("reserves the full two-page, six-document GovInfo adapter bound", () => {
    const investigation = plannedInvestigation();
    const govInfo = investigation.plan.steps.find(({ providerId }) =>
      providerId === "govinfo")!;
    const caps = studyFirstEventStepResourceCaps(govInfo);
    expect(caps).toMatchObject({
      sourceQueries: 5,
      metadataRecords: 20,
      documentAttempts: 6,
      transportHops: 11,
      receivedBytes: 2 * 256 * 1024 + 6 * 2 * 1024 * 1024 +
        2 * 256 * 1024 + 2 * 1024 * 1024,
      decodedBytes: 2 * 256 * 1024 + 6 * 2 * 1024 * 1024 +
        2 * 256 * 1024 + 2 * 1024 * 1024,
    });
    expect(caps.activeResearchMs).toBeGreaterThanOrEqual(144_000);
    expect(caps.leaseMs).toBeGreaterThan(caps.activeResearchMs);
  });

  it("SRC4-02 plans distinct plain-language source queries without appending group and outcome fields", () => {
    const investigation = plannedInvestigation({
      ...draft,
      industry: [],
      outcome: "Return on assets",
      outcomeMeasure: "ROA",
      policySideConcept: "Transparency enhancement",
    });
    const federalSteps = investigation.plan.steps.filter(({ providerId }) =>
      providerId === "federal_register");
    expect(investigation.context.study.intendedConstruct).toBeNull();
    expect(investigation.context.study.policySideConcept).toBe(
      "Transparency enhancement");
    const terms = federalSteps.map(({ queryTerms }) => queryTerms.join(" "));
    expect(terms).toEqual(expect.arrayContaining([
      "consumer privacy", "credit lending", "operating costs",
      "market demand", "financial reporting",
    ]));
    expect(investigation.plan.steps.filter(({ providerId }) =>
      providerId === "regulations_gov")).toHaveLength(2);
    expect(terms.every((term) => !/California firms|Non-California firms|\bROA\b/u
      .test(term))).toBe(true);
    expect(investigation.plan.steps.find(({ providerId }) =>
      providerId === "govinfo")?.plannedLimit).toBe(6);
    expect(investigation.plan.steps.find(({ branch }) =>
      branch === "disaster_or_disruption")?.occurrenceWindow.start)
      .toBe("2018-01-01");
    expect(federalSteps[0]?.occurrenceWindow.start).toBe("2016-01-01");
  });

  it("SRC4-03 scopes economic searches to a supplied industry across distinct synthetic policies", () => {
    const manufacturing = plannedInvestigation({ ...draft,
      industry: ["Manufacturing"], policySideConcept: "Customer protection" });
    const software = plannedInvestigation({ ...draft,
      industry: ["Software services"], policySideConcept: "Data access" });
    const economicQueries = (input: typeof manufacturing) => input.plan.steps
      .filter(({ providerId, question }) => providerId ===
        "federal_register" && /costs|demand/iu.test(question))
      .map(({ queryTerms }) => queryTerms.join(" "));
    expect(economicQueries(manufacturing)).toEqual([
      "Manufacturing operating costs", "Manufacturing market demand",
    ]);
    expect(economicQueries(software)).toEqual([
      "Software services operating costs", "Software services market demand",
    ]);
    expect(economicQueries(software).join(" ")).not.toMatch(/energy|manufactur/iu);
  });

  it("activates the configured Regulations.gov route and deduplicates its repeated topical result", async () => {
    const investigation = plannedInvestigation({
      ...draft,
      population: "U.S. public online-service firms",
      industry: ["Online services"],
      policySideConcept: "Consumer privacy and data protection",
    });
    const ordinary = fixtureFetch({ federal: 0, fema: 0 });
    const fetch = vi.fn(async (request: RequestInfo | URL) => {
      if (String(request).startsWith(
        "https://api.regulations.gov/v4/documents?",
      )) {
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
          },
        }] }), { headers: { "content-type": "application/json" } });
      }
      return ordinary(request);
    });
    const sourceRegister = buildSixScreenSourceRegister({
      configuredSecrets: { REGULATIONS_API_KEY: true },
      probes: { regulations_gov: {
        at: "2026-09-20T12:00:00.000Z",
        endpoint: "https://api.regulations.gov/v4/documents?page[size]=1",
        outcome: "success", httpStatus: 200,
        note: "Successful harmless capability probe fixture.",
      } },
    });

    const result = await execute(investigation, fetch, {
      sourceRegister,
      regulationsApiKey: "server-regulations-key",
    });
    expect(result.attempts.filter(({ providerId }) =>
      providerId === "regulations_gov")).toHaveLength(2);
    expect(result.attempts.filter(({ providerId }) =>
      providerId === "regulations_gov").every(({ outcome }) =>
        outcome === "candidates_found")).toBe(true);
    const records = result.occurrences.filter(({ providerId }) =>
      providerId === "regulations_gov");
    expect(records).toHaveLength(1);
    expect(result.presentation.visibleEventIds).toContain(records[0]!.id);
    expect(JSON.stringify(result)).not.toContain("server-regulations-key");
  });

  it("discovers overlapping state legislation through configured Open States", async () => {
    const investigation = plannedInvestigation({
      ...draft,
      population: "U.S. public manufacturers",
      geography: ["United States", "New York"],
      policySideConcept: "Customer protection",
      proposedTreatment: "New York firms",
      proposedComparison: "Firms outside New York",
    });
    const ordinary = fixtureFetch({ federal: 0, fema: 0 });
    const openStatesRequests: string[] = [];
    const fetch = vi.fn(async (request: RequestInfo | URL,
      init?: RequestInit) => {
      if (String(request).startsWith("https://v3.openstates.org/bills?")) {
        openStatesRequests.push(String(request));
        if (new Headers(init?.headers).get("x-api-key") !==
            "server-openstates-key") {
          return new Response("unauthorized", { status: 401 });
        }
        return new Response(JSON.stringify({ results: [{
          id: "ocd-bill/123e4567-e89b-12d3-a456-426614174002",
          session: "2021-2022",
          jurisdiction: { id: "ocd-jurisdiction/country:us/state:ny/government",
            name: "New York", classification: "state" },
          from_organization: { id: "ocd-organization/new-york-legislature",
            name: "New York State Legislature", classification: "legislature" },
          identifier: "S 8888",
          title: "Customer Protection Reporting Act",
          classification: ["bill"],
          openstates_url: "https://openstates.org/ny/bills/2021-2022/S8888/",
          first_action_date: "2021-02-01",
          latest_action_date: "2021-07-01",
          abstracts: [{ abstract:
            "Requires manufacturers serving New York customers to file specified protection reports.",
            note: "summary" }],
          actions: [{ id: "action-ny-8888", description: "Signed into law",
            date: "2021-07-01", classification: ["became-law"], order: 1 }],
          sources: [{ url:
            "https://www.nysenate.gov/legislation/bills/2021/S8888",
            note: "Official bill page" }],
          versions: [],
          documents: [],
        }] }), { headers: { "content-type": "application/json" } });
      }
      return ordinary(request);
    });
    const sourceRegister = buildSixScreenSourceRegister({
      configuredSecrets: { OPENSTATES_API_KEY: true },
      probes: { openstates: {
        at: "2026-09-20T12:00:00.000Z",
        endpoint:
          "https://v3.openstates.org/jurisdictions?classification=state&per_page=1",
        outcome: "success",
        httpStatus: 200,
        note: "Successful harmless capability probe fixture.",
      } },
    });

    const result = await execute(investigation, fetch, {
      sourceRegister,
      openStatesApiKey: "server-openstates-key",
    });
    const attempt = result.attempts.find(({ providerId }) =>
      providerId === "openstates");
    expect(attempt).toMatchObject({
      outcome: "candidates_found",
      recordsReceived: 1,
      recordsAccepted: 1,
    });
    expect(result.occurrences).toEqual(expect.arrayContaining([
      expect.objectContaining({
        providerId: "openstates",
        title: "Customer Protection Reporting Act",
        formalIdentifiers: expect.arrayContaining(["S 8888"]),
      }),
    ]));
    expect(openStatesRequests).toHaveLength(3);
    expect(openStatesRequests.every((request) =>
      !new URL(request).searchParams.has("jurisdiction"))).toBe(true);
    expect(JSON.stringify(result)).not.toContain("server-openstates-key");
  });

  it("retains topical CCPA-period alternatives without padding or unrelated index records", async () => {
    const investigation = structuredClone(plannedInvestigation({
      ...draft,
      population: "U.S. public technology and online-service firms",
      industry: ["Technology", "Online services"],
      period: { start: "2017", end: "2024" },
      policySideConcept: "Consumer privacy and data protection",
      proposedTreatment: "California-exposed firms",
      proposedComparison: "Firms without California exposure",
    }));
    investigation.context.policy.officialTitle =
      "California Consumer Privacy Act";
    investigation.context.policy.aliases = ["CCPA"];
    investigation.context.policy.formalIdentifiers = [
      "Cal. Civ. Code 1798.100",
    ];

    const result = await execute(investigation,
      fixtureFetch({ federal: 0, fema: 0 }));
    const titles = result.presentation.visibleEventIds.map((id) =>
      result.occurrences.find((occurrence) => occurrence.id === id)!.title);
    const normalized = titles.map((title) => title.normalize("NFKC")
      .toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]+/gu, " ").trim());
    expect(titles.length).toBeGreaterThan(2);
    expect(titles.length).toBeLessThanOrEqual(10);
    expect(new Set(normalized).size).toBe(titles.length);
    expect(titles).not.toContain("California Consumer Privacy Act");
    expect(titles.some((title) =>
      /Nevada|Virginia|Colorado|Age-Appropriate/iu.test(title))).toBe(true);
    const reviewed = result.occurrences.filter(({ providerId }) =>
      providerId === "reviewed_official_documents");
    expect(reviewed.some(({ sourceNativeId, geography }) =>
      sourceNativeId === "index-uk-financial-guidance-claims-act-2018" ||
      geography.labels.includes("United Kingdom"))).toBe(false);
    expect(reviewed.every(({ geography }) =>
      geography.labels.some((label) => /United States/iu.test(label))))
      .toBe(true);
    expect(reviewed.every(({ title }) =>
      /privacy|data|age-appropriate|coppa/iu.test(title)),
      reviewed.map(({ title }) => title).join(" | ")).toBe(true);
  });

  it("does not confuse United States with United Kingdom for a finance study", async () => {
    const result = await execute(plannedInvestigation({
      ...draft,
      population: "U.S. public financial-services firms",
      geography: ["United States"],
      industry: ["Banking", "Financial services"],
      period: { start: "2010", end: "2020" },
      outcome: "Return on assets",
      outcomeMeasure: "ROA",
      policySideConcept: "Financial regulation",
      initialExplanation: "Through funding costs and lending capacity.",
      proposedTreatment: "Banks covered by the focal U.S. rule",
      proposedComparison: "Banks not covered by the focal U.S. rule",
    }), fixtureFetch({ federal: 0, fema: 0 }));
    const reviewed = result.occurrences.filter(({ providerId }) =>
      providerId === "reviewed_official_documents");
    expect(reviewed.some(({ geography }) =>
      geography.labels.includes("United Kingdom"))).toBe(false);
    expect(result.presentation.visibleEventIds.some((eventId) =>
      reviewed.some(({ id, geography }) => id === eventId &&
        geography.labels.includes("United Kingdom")))).toBe(false);
  });

  it("SRC4-08 requires a documented continuing route for an earlier credit change", async () => {
    const earlier = {
      ...federalRows(1)[0],
      document_number: "2016-12345",
      title: "Manufacturing credit lending requirement",
      publication_date: "2016-05-01",
      effective_on: "2016-06-01",
      html_url: "https://www.federalregister.gov/documents/2016/05/01/2016-12345/credit",
      abstract: "The commission changed manufacturing lending requirements, ongoing through 2020.",
      excerpts: ["The manufacturing credit requirement is ongoing through 2020."],
    };
    const persistent = await execute(plannedInvestigation(),
      federalRecordFetch(earlier));
    const withoutPersistence = await execute(plannedInvestigation(),
      federalRecordFetch({ ...earlier,
        abstract: "The commission changed manufacturing lending requirements.",
        excerpts: ["A manufacturing credit requirement changed."],
      }));
    const persistentFederalId = persistent.occurrences.find(({ providerId }) =>
      providerId === "federal_register")!.id;
    const nonpersistentFederalId = withoutPersistence.occurrences.find(
      ({ providerId }) => providerId === "federal_register")!.id;
    expect(persistent.presentation.visibleEventIds)
      .toContain(persistentFederalId);
    expect(withoutPersistence.presentation.visibleEventIds)
      .not.toContain(nonpersistentFederalId);
    expect(analysesForProvider(persistent, "federal_register")[0]
      ?.relevanceOrder.evidenceBasis.join(" ")).toContain("continuing");
  });

  it("SRC4-11 reviews synthetic precision and recall separately across policy, hazard, and sector cases", async () => {
    const cases = [{
      name: "sector credit",
      investigation: plannedInvestigation(),
      fetch: fixtureFetch({ federal: 1, fema: 0 }),
      expectedPresent: "Manufacturing crédit-market reporting rule",
      expectedWeak: null,
    }, {
      name: "policy with unspecified industry",
      investigation: plannedInvestigation({ ...draft, industry: [],
        outcome: "Return on assets", outcomeMeasure: "ROA",
        policySideConcept: "Transparency enhancement" }),
      fetch: federalRecordFetch({ ...federalRows(1)[0],
        document_number: "2021-09090",
        title: "National Ambient Air Quality Standards for Particulate Matter",
        abstract: "The agency revised ambient air monitoring and reporting requirements.",
        excerpts: ["The agency revised ambient air monitoring requirements."],
      }),
      expectedPresent: null,
      expectedWeak: "National Ambient Air Quality Standards",
    }, {
      name: "geographic disruption",
      investigation: plannedInvestigation(),
      fetch: fixtureFetch({ federal: 0, fema: 1 }),
      expectedPresent: "PACIFIC STORM",
      expectedWeak: null,
    }];
    const review = await Promise.all(cases.map(async (item) => {
      const result = await execute(item.investigation, item.fetch);
      const visible = result.presentation.visibleEventIds.map((id) =>
        result.occurrences.find((occurrence) => occurrence.id === id)?.title ??
          "");
      return {
        name: item.name,
        retrievedRelevant: item.expectedPresent ? visible.some((title) =>
          title.includes(item.expectedPresent!)) : true,
        weakInclusions: item.expectedWeak ? visible.filter((title) =>
          title.includes(item.expectedWeak!)).length : 0,
      };
    }));
    expect(review).toEqual([
      { name: "sector credit", retrievedRelevant: true, weakInclusions: 0 },
      { name: "policy with unspecified industry", retrievedRelevant: true,
        weakInclusions: 0 },
      { name: "geographic disruption", retrievedRelevant: true,
        weakInclusions: 0 },
    ]);
  });

  it("E01/E02/E04/E05/E09/E11 searches six branches plus finite reviewed/GovInfo routes, and keeps interpretation conditional", async () => {
    const investigation = plannedInvestigation();
    const before = fingerprintSixScreenValue(investigation);
    const result = await execute(investigation, fixtureFetch({
      federal: 1,
      fema: 1,
    }));

    expect(result.attempts).toHaveLength(19);
    expect(result.attempts.map(({ branch }) => branch)).toEqual([
      "overlapping_policy",
      "sector_market_or_financing",
      "disaster_or_disruption",
      "comparison_spillover",
      "measurement_or_sample_shift",
      "focal_policy_lifecycle_or_litigation",
      "overlapping_policy",
      "overlapping_policy",
      "overlapping_policy",
      "overlapping_policy",
      "sector_market_or_financing",
      "sector_market_or_financing",
      "overlapping_policy",
      "overlapping_policy",
      "overlapping_policy",
      "overlapping_policy",
      "overlapping_policy",
      "sector_market_or_financing",
      "sector_market_or_financing",
    ]);
    expect(result.attempts.reduce((sum, item) =>
      sum + item.usage.sourceQueries, 0)).toBe(11);
    expect(result.attempts.find(({ providerId }) =>
      providerId === "reviewed_official_documents")).toMatchObject({
      providerId: "reviewed_official_documents",
      usage: { sourceQueries: 0, documentAttempts: 0 },
    });
    expect(result.attempts.find(({ providerId }) =>
      providerId === "govinfo")).toMatchObject({
      providerId: "govinfo",
      outcome: "unsupported_route",
      usage: { sourceQueries: 0, documentAttempts: 0 },
    });
    expect(result.attempts.filter(({ providerId }) =>
      providerId === "regulations_gov")).toHaveLength(2);
    expect(result.occurrences.filter(({ providerId }) =>
      providerId === "federal_register" || providerId === "openfema"
    )).toHaveLength(2);
    expect(result.presentation).toMatchObject({
      status: "completed_partial",
      visibleEventIds: expect.arrayContaining(result.occurrences.filter(
        ({ providerId }) => providerId === "federal_register" ||
          providerId === "openfema",
      ).map(({ id }) => id)),
      coverage: {
        sourceRoutesAttempted: 12,
        sourceRoutesSucceeded: 12,
        interpretation: "evidence_bounded",
      },
    });
    expect(result.analyses).toHaveLength(result.occurrences.length);
    expect(analysesForProvider(result, "federal_register")[0]).toMatchObject({
      interpretationMode: "bounded_evidence_rules",
      directionStatus: "unknown",
      executionProvenance: { semanticRouteStatus: "bounded_rules_completed" },
    });
    expect(result.analyses.map(({ whatHappened }) => whatHappened).join(" "))
      .toContain("Manufacturing crédit-market reporting rule 跨境");
    expect(result.analyses.every(({ uncertainties }) =>
      uncertainties.some((value) => value.includes("No dataset was uploaded"))))
      .toBe(true);
    const retainedIds = new Set(result.occurrences.map(({ id }) => id));
    expect(result.attempts.every(({ candidateOccurrenceIds }) =>
      candidateOccurrenceIds.every((id) => retainedIds.has(id)))).toBe(true);
    expect(fingerprintSixScreenValue(investigation)).toBe(before);
  });

  it("discovers separate Federal Register, GovInfo statute, and indexed California law with inspected date roles", async () => {
    const investigation = plannedInvestigation({
      ...draft,
      population: "U.S. public online service firms",
      industry: ["Online services"],
      policySideConcept: "Data protection",
      proposedTreatment: "California online service firms",
      proposedComparison: "Non-California online service firms",
    });
    const packageId = "PLAW-117publ99";
    const htmlUrl =
      `https://www.govinfo.gov/content/pkg/${packageId}/html/${packageId}.htm`;
    const summaryUrl = `https://api.govinfo.gov/packages/${packageId}/summary`;
    const sourceRegister = buildSixScreenSourceRegister({
      configuredSecrets: { GOVINFO_API_KEY: true },
      probes: { govinfo: {
        at: "2026-09-20T12:00:00.000Z",
        endpoint: "https://api.govinfo.gov/collections",
        outcome: "success", httpStatus: 200,
        note: "Successful harmless capability probe fixture.",
      } },
    });
    const federalRecord = {
      ...federalRows(1)[0],
      title: "Online services lending requirement",
      abstract: "The agency changed a lending requirement for online services.",
      excerpts: ["Online services lending requirements were changed."],
    };
    const fetch = vi.fn(async (request: RequestInfo | URL) => {
      const url = String(request);
      if (url === "https://api.govinfo.gov/search") {
        return new Response(JSON.stringify({ count: 1, results: [{
          collectionCode: "PLAW",
          title: "Online Services Privacy Funding Act",
          packageId, dateIssued: "2021-08-12", resultLink: summaryUrl,
          governmentAuthor: ["United States Congress"],
        }] }), { headers: { "content-type": "application/json" } });
      }
      if (url === htmlUrl) {
        return new Response(`<!doctype html><html><body><main>
          <h1>PUBLIC LAW 117-99</h1>
          <p>This Act may be cited as the Online Services Privacy Funding Act.
          It requires federal financing conditions for covered online services;
          the exact reach and effective dates need provision-level inspection.
          No company-specific exposure has been established.</p>
          <p>Approved August 11, 2021.</p></main></body></html>`,
        { headers: { "content-type": "text/html" } });
      }
      if (/openfema|fema\.gov|DisasterDeclarationsSummaries/iu.test(url)) {
        return new Response(JSON.stringify({ DisasterDeclarationsSummaries: [] }),
          { headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ count: 1,
        results: [federalRecord] }),
      { headers: { "content-type": "application/json" } });
    });
    const result = await execute(investigation, fetch, {
      sourceRegister, govInfoApiKey: "server-test-secret",
    });
    const byProvider = (id: string) => result.occurrences.filter(
      ({ providerId }) => providerId === id);
    expect(byProvider("federal_register")).toHaveLength(1);
    expect(byProvider("govinfo")).toHaveLength(1);
    const stateEvent = byProvider("reviewed_official_documents").find(
      ({ sourceNativeId }) =>
        sourceNativeId === "index-us-california-aadc-2022");
    expect(stateEvent).toBeDefined();
    expect(stateEvent?.evidence).toContainEqual(expect.objectContaining({
      locator: expect.stringContaining("leginfo.legislature.ca.gov"),
      sourceId: "source-ca-ab2273-2022",
    }));
    expect(stateEvent?.typedDates).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "event", value: "2022-09-15" }),
      expect.objectContaining({ kind: "effective", value: "2024-07-01" }),
    ]));
    const law = byProvider("govinfo")[0]!;
    expect(law.sourceNativeId).toBe(packageId);
    expect(law.typedDates).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "publication", value: "2021-08-12",
        sourceId: `screen04-govinfo-${packageId}-summary` }),
      expect.objectContaining({ kind: "event", value: "2021-08-11",
        sourceId: `screen04-govinfo-${packageId}-original-html` }),
    ]));
    expect(law.typedDates.some(({ kind }) => kind === "effective")).toBe(false);
    expect([
      ...result.presentation.visibleEventIds,
      ...result.presentation.overflowEventIds,
    ]).toEqual(expect.arrayContaining([
      byProvider("federal_register")[0]!.id, stateEvent!.id, law.id,
    ]));
    expect(result.attempts.find(({ providerId }) => providerId === "govinfo"))
      .toMatchObject({ outcome: "candidates_found", usage: {
        sourceQueries: 1, documentAttempts: 1, transportHops: 2,
      } });
    expect(result.attempts.reduce((sum, item) =>
      sum + item.usage.sourceQueries, 0)).toBeLessThanOrEqual(32);
    expect(result.attempts.reduce((sum, item) =>
      sum + (item.usage.documentAttempts ?? 0), 0)).toBeLessThanOrEqual(40);
    expect(result.occurrences).toHaveLength(result.analyses.length);
    expect(JSON.stringify(result)).not.toContain("server-test-secret");
  });

  it("gates GovInfo on a healthy probe and isolates later GovInfo failure from other sources", async () => {
    const investigation = plannedInvestigation({
      ...draft,
      population: "U.S. public online service firms",
      industry: ["Online services"],
      policySideConcept: "Data protection",
    });
    const fetch = vi.fn(async (request: RequestInfo | URL) => {
      if (String(request) === "https://api.govinfo.gov/search") {
        return new Response(null, { status: 503 });
      }
      if (/openfema|fema\.gov|DisasterDeclarationsSummaries/iu.test(
        String(request))) {
        return new Response(JSON.stringify({ DisasterDeclarationsSummaries: [] }),
          { headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ count: 1, results: [{
        ...federalRows(1)[0],
        title: "Online services lending requirement",
        abstract: "Lending requirement for online services changed.",
      }] }), { headers: { "content-type": "application/json" } });
    });
    const untested = await execute(investigation, fetch, {
      govInfoApiKey: "server-test-secret",
      sourceRegister: buildSixScreenSourceRegister({
        configuredSecrets: { GOVINFO_API_KEY: true },
      }),
    });
    expect(untested.attempts.find(({ providerId }) => providerId === "govinfo"))
      .toMatchObject({ outcome: "unsupported_route",
        usage: { sourceQueries: 0, documentAttempts: 0 } });
    expect(fetch.mock.calls.some(([request]) =>
      String(request) === "https://api.govinfo.gov/search")).toBe(false);

    const tested = await execute(investigation, fetch, {
      govInfoApiKey: "server-test-secret",
      sourceRegister: buildSixScreenSourceRegister({
        configuredSecrets: { GOVINFO_API_KEY: true },
        probes: { govinfo: {
          at: "2026-09-20T12:00:00.000Z",
          endpoint: "https://api.govinfo.gov/collections",
          outcome: "success", httpStatus: 200,
          note: "Successful harmless capability probe fixture.",
        } },
      }),
    });
    expect(tested.attempts.find(({ providerId }) => providerId === "govinfo"))
      .toMatchObject({ outcome: "source_unavailable",
        usage: { sourceQueries: 1, documentAttempts: 0 } });
    expect(tested.attempts.find(({ providerId }) =>
      providerId === "federal_register")?.outcome).toBe("candidates_found");
    expect(tested.attempts.find(({ providerId }) =>
      providerId === "reviewed_official_documents")?.outcome)
      .toBe("candidates_found");
    expect(tested.presentation.status).toBe("completed_partial");
    const retainedPresentationIds = new Set([
      ...tested.presentation.visibleEventIds,
      ...tested.presentation.overflowEventIds,
    ]);
    expect(retainedPresentationIds.has(
      tested.occurrences.find(({ providerId }) =>
        providerId === "federal_register")?.id ?? "missing",
    )).toBe(true);
    expect(JSON.stringify(tested)).not.toContain("server-test-secret");
  });

  it("E10/E12 distinguishes an incomplete route from a no-match and preserves successful reviewed-index coverage", async () => {
    const investigation = plannedInvestigation();
    const empty = await execute(
      investigation,
      fixtureFetch({ federal: 0, fema: 0 }),
    );
    expect(empty.presentation).toMatchObject({
      status: "completed_partial",
      overflowEventIds: [],
      coverage: { sourceRoutesSucceeded: 12 },
    });
    expect(empty.presentation.visibleEventIds.length).toBeGreaterThan(0);
    expect(empty.presentation.visibleEventIds.every((id) =>
      empty.occurrences.find((item) => item.id === id)?.providerId ===
        "reviewed_official_documents")).toBe(true);
    expect(empty.attempts.filter((item) => item.providerId === "federal_register")
      .every(({ outcome }) => outcome === "no_match")).toBe(true);
    expect(empty.attempts.find((item) => item.providerId === "govinfo")?.outcome)
      .toBe("unsupported_route");
    expect(empty.presentation.coverage.limitation).toContain(
      "missing branches and study-specific implications remain unresolved",
    );

    const failed = await execute(
      investigation,
      fixtureFetch({ federal: 0, fema: 0, status: 503 }),
    );
    expect(failed.presentation).toMatchObject({
      status: "completed_partial",
      coverage: { sourceRoutesSucceeded: 1 },
    });
    expect(failed.presentation.visibleEventIds.length).toBeGreaterThan(0);
    expect(failed.attempts.filter((item) => item.providerId === "federal_register")
      .every(({ outcome }) => outcome === "source_unavailable")).toBe(true);
    expect(failed.presentation.coverage.limitation).toContain(
      "missing branches and study-specific implications remain unresolved",
    );
  });

  it("E06 keeps a geography-only federal rule out of the main list", async () => {
    const investigation = plannedInvestigation();
    const fetch = vi.fn(async (request: RequestInfo | URL) => {
      if (/openfema|fema\.gov|DisasterDeclarationsSummaries/iu.test(
        String(request),
      )) {
        return new Response(JSON.stringify({
          DisasterDeclarationsSummaries: [],
        }), { headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({
        count: 1,
        results: [{
          ...federalRows(1)[0],
          title: "National Ambient Air Quality Standards for Particulate Matter",
          abstract:
            "The agency revised ambient air monitoring and reporting requirements.",
          excerpts: [
            "The agency revised ambient air monitoring requirements.",
          ],
        }],
      }), { headers: { "content-type": "application/json" } });
    });
    const result = await execute(investigation, fetch);
    expect(analysesForProvider(result, "federal_register")).toHaveLength(1);
    expect(analysesForProvider(result, "federal_register")[0]).toMatchObject({
      eligibility: { status: "excluded" },
      relevanceOrder: { priorityBand: "background" },
    });
    const federalId = result.occurrences.find(({ providerId }) =>
      providerId === "federal_register")!.id;
    expect(result.presentation.visibleEventIds).not.toContain(federalId);
  });

  it("does not turn an incidental CCPA compliance mention into a focal-policy stage and preserves same-day date roles", async () => {
    const record = {
      ...federalRows(1)[0],
      document_number: "2024-04006",
      title: "Privacy Act of 1974; System of Records",
      abstract:
        "The Presidio Trust establishes a parking-payment records system. A vendor states that its software complies with applicable laws including the California Consumer Privacy Act.",
      action: "Notice of a new records system.",
      excerpts: [
        "The system covers parking-payment activity at the Presidio.",
        "The vendor references compliance with the California Consumer Privacy Act.",
      ],
      publication_date: "2024-02-27",
      effective_on: "2024-02-27",
    };
    const withMention = await execute(
      ccpaInvestigation(),
      federalRecordFetch(record),
    );
    const withoutMention = await execute(
      ccpaInvestigation(),
      federalRecordFetch({
        ...record,
        abstract:
          "The Presidio Trust establishes a parking-payment records system.",
        excerpts: ["The system covers parking-payment activity at the Presidio."],
      }),
    );

    const mentionedId = withMention.occurrences.find(({ providerId }) =>
      providerId === "federal_register")!.id;
    expect(withMention.presentation.visibleEventIds).not.toContain(mentionedId);
    expect(analysesForProvider(withMention, "federal_register")[0]).toMatchObject({
      relationshipType: "uncertain",
      eligibility: { status: "background_lead" },
      relationshipEvidence: { status: "not_established" },
      documentEventDistinction: {
        publicationDate: "2024-02-27",
        substantiveOccurrenceDate: "2024-02-27",
        dateRoleStatus: "separate_roles_same_date",
      },
    });
    expect(analysesForProvider(withoutMention, "federal_register")[0]
      ?.relationshipType).toBe(
      analysesForProvider(withMention, "federal_register")[0]
        ?.relationshipType,
    );
    expect(analysesForProvider(withoutMention, "federal_register")[0]
      ?.eligibility.status).toBe(
      analysesForProvider(withMention, "federal_register")[0]
        ?.eligibility.status,
    );
  });

  it("consolidates the same named shock across search branches and retains every source date", async () => {
    const investigation = plannedInvestigation();
    let federalCall = 0;
    const fetch = vi.fn(async (request: RequestInfo | URL) => {
      if (/openfema|fema\.gov|DisasterDeclarationsSummaries/iu.test(
        String(request),
      )) {
        return new Response(JSON.stringify({ DisasterDeclarationsSummaries: [] }), {
          headers: { "content-type": "application/json" },
        });
      }
      const index = federalCall++;
      const day = String(10 + index).padStart(2, "0");
      return new Response(JSON.stringify({ count: 1, results: [{
        ...federalRows(1)[0],
        document_number: `2021-${44000 + index}`,
        title: "Disclosure of Consumer Complaint Data",
        abstract:
          "A reporting requirement for manufacturing credit markets changed.",
        html_url:
          `https://www.federalregister.gov/d/2021-${44000 + index}`,
        publication_date: `2021-05-${day}`,
        effective_on: `2021-06-${day}`,
      }] }), { headers: { "content-type": "application/json" } });
    });

    const result = await execute(investigation, fetch);
    const consolidated = result.occurrences.filter(({ providerId, title }) =>
      providerId === "federal_register" &&
      title === "Disclosure of Consumer Complaint Data");
    expect(consolidated).toHaveLength(1);
    expect(consolidated[0]!.formalIdentifiers.length).toBeGreaterThan(1);
    expect(consolidated[0]!.evidence.length).toBeGreaterThan(1);
    expect(new Set(consolidated[0]!.typedDates.map(({ value }) => value)).size)
      .toBeGreaterThan(2);
    expect(result.attempts.filter(({ providerId }) =>
      providerId === "federal_register").every(({ candidateOccurrenceIds }) =>
        candidateOccurrenceIds.includes(consolidated[0]!.id)))
      .toBe(true);
  });

  it("requires an evidenced action on the exact focal instrument for a related policy stage", async () => {
    const unrelated = await execute(
      ccpaInvestigation(),
      federalRecordFetch({
        ...federalRows(1)[0],
        title: "Final Rule Implementing a Workplace Safety Standard",
        abstract:
          "The agency issues a final rule and an effective date for a workplace safety standard.",
        action: "Final rule; implementation.",
        excerpts: [
          "The rule addresses a workplace safety standard unrelated to consumer privacy.",
        ],
      }),
    );
    const genuine = await execute(
      ccpaInvestigation(),
      federalRecordFetch({
        ...federalRows(1)[0],
        title: "Amendment to California Consumer Privacy Act regulations",
        abstract:
          "The agency amends the California Consumer Privacy Act regulations and changes covered-business duties.",
        action: "Final amendment.",
      }),
    );

    const unrelatedAnalysis = analysesForProvider(
      unrelated, "federal_register")[0]!;
    expect(unrelatedAnalysis).toMatchObject({
      relationshipEvidence: { status: "not_established" },
    });
    expect(unrelatedAnalysis.relationshipType).not.toBe(
      "related_policy_stage",
    );
    const unrelatedId = unrelated.occurrences.find(({ providerId }) =>
      providerId === "federal_register")!.id;
    expect(unrelated.presentation.visibleEventIds).not.toContain(unrelatedId);
    const genuineAnalysis = analysesForProvider(genuine,
      "federal_register")[0]!;
    expect(genuineAnalysis).toMatchObject({
      relationshipType: "related_policy_stage",
      eligibility: { status: "qualifying" },
      relationshipEvidence: { status: "source_linked" },
    });
    const genuineId = genuine.occurrences.find(({ providerId }) =>
      providerId === "federal_register")!.id;
    expect(genuine.presentation.visibleEventIds).toContain(genuineId);
  });

  it("keeps two substantive actions that share a broad document identifier", async () => {
    let legalCall = 0;
    const fetch = vi.fn(async (request: RequestInfo | URL) => {
      if (/openfema|fema\.gov|DisasterDeclarationsSummaries/iu.test(
        String(request),
      )) {
        return new Response(JSON.stringify({ DisasterDeclarationsSummaries: [] }), {
          headers: { "content-type": "application/json" },
        });
      }
      const first = legalCall++ % 2 === 0;
      const record = {
        ...federalRows(1)[0],
        document_number: "2021-12345",
        title: first
          ? "First amendment to Provider-neutral Participation Final Rule"
          : "Second amendment to Provider-neutral Participation Final Rule",
        abstract: first
          ? "The Example Commission amends the Provider-neutral Participation Final Rule to change eligibility."
          : "The Example Commission amends the Provider-neutral Participation Final Rule to change reporting duties.",
        excerpts: first
          ? ["The first action changes eligibility."]
          : ["The second action changes reporting duties."],
        publication_date: first ? "2021-05-10" : "2022-05-10",
        effective_on: first ? "2021-06-10" : "2022-06-10",
      };
      return new Response(JSON.stringify({ count: 1, results: [record] }), {
        headers: { "content-type": "application/json" },
      });
    });
    const result = await execute(plannedInvestigation(), fetch);
    expect(result.occurrences.filter(({ providerId }) =>
      providerId === "federal_register")).toHaveLength(2);
    expect(analysesForProvider(result, "federal_register")
      .every(({ relationshipType }) =>
      relationshipType === "related_policy_stage")).toBe(true);
  });

  it("E03/E08 preserves one qualifying event and labels incomplete acquisition as partial", async () => {
    const investigation = plannedInvestigation();
    const one = await execute(
      investigation,
      fixtureFetch({ federal: 0, fema: 1 }),
    );
    const femaId = one.occurrences.find(({ providerId }) =>
      providerId === "openfema")!.id;
    expect(one.presentation.visibleEventIds).toContain(femaId);
    expect(one.presentation.overflowEventIds).toEqual([]);

    const available = fixtureFetch({ federal: 0, fema: 1 });
    const partialFetch = vi.fn(async (request: RequestInfo | URL) =>
      String(request).includes("federalregister.gov")
        ? new Response(null, { status: 503 })
        : available(request));
    const partial = await execute(investigation, partialFetch);
    expect(partial.presentation.status).toBe("completed_partial");
    expect(partial.presentation.visibleEventIds).toContain(
      partial.occurrences.find(({ providerId }) =>
        providerId === "openfema")!.id,
    );
    expect(partial.presentation.coverage.failedBranches.length).toBeGreaterThan(0);
    expect(partial.presentation.coverage.limitation).toMatch(
      /missing branches.*unresolved/iu,
    );
    expect(partial.presentation.coverage.limitation).not.toMatch(
      /no confounding exists/iu,
    );
  });

  it("reuses documentary occurrences after a method-only selection change without a source call", async () => {
    const planned = plannedInvestigation();
    const fetch = fixtureFetch({ federal: 1, fema: 0 });
    const result = await execute(planned, fetch);
    const completed = createCompletedStudyFirstEventInvestigation({
      previous: planned,
      ...result,
    });
    const callsAfterSourceScan = fetch.mock.calls.length;
    const methodChanged = structuredClone(planned);
    methodChanged.context.methodSelection = {
      selectionId: "method-selection-fixture",
      selectionFingerprint: fingerprintSixScreenValue("method-selection"),
      decision: { mode: "selected", optionId: "D01" },
      adviceId: planned.context.advice.adviceId,
      adviceFingerprint: planned.context.advice.adviceFingerprint,
      methodLibraryVersion: planned.context.advice.methodLibraryVersion,
    };
    expect(studyFirstEventSourceInputFingerprint(methodChanged)).toBe(
      studyFirstEventSourceInputFingerprint(completed),
    );
    const rebound = rebindStudyFirstEventSourceResult({
      source: completed,
      target: methodChanged,
      completedAt: "2026-09-20T15:01:00.000Z",
    });
    expect(fetch).toHaveBeenCalledTimes(callsAfterSourceScan);
    expect(rebound.occurrences).toEqual(completed.occurrences);
    expect(rebound.attempts.map(({ outcome }) => outcome))
      .toEqual(completed.attempts.map(({ outcome }) => outcome));
  });

  it("E13 bounds presentation at ten without padding or losing overflow lineage", async () => {
    const investigation = plannedInvestigation();
    const result = await execute(
      investigation,
      fixtureFetch({ federal: 6, fema: 6 }),
    );
    const sourceOccurrences = result.occurrences.filter(({ providerId }) =>
      providerId === "federal_register" || providerId === "openfema"
    );
    expect(sourceOccurrences).toHaveLength(12);
    expect(new Set(sourceOccurrences.map(({ title }) =>
      title.normalize("NFKC").toLocaleLowerCase("en-US")
    )).size).toBe(sourceOccurrences.length);
    expect(result.presentation.visibleEventIds).toHaveLength(10);
    expect(result.presentation.overflowEventIds).toHaveLength(
      result.analyses.filter(({ eligibility }) =>
        eligibility.status === "qualifying").length - 10,
    );
    expect(new Set([
      ...result.presentation.visibleEventIds,
      ...result.presentation.overflowEventIds,
    ])).toEqual(new Set(result.analyses.filter(({ eligibility }) =>
      eligibility.status === "qualifying").map(({ eventId }) => eventId)));
  });

  it("MU06 rejects a tampered persisted investigation fingerprint", () => {
    const investigation = plannedInvestigation();
    expect(() => validateStudyFirstEventInvestigationCollections({
      investigations: [investigation],
      handoffs: [],
    })).not.toThrow();
    const tampered = structuredClone(investigation);
    tampered.context.study.outcome = "Changed outcome";
    expect(() => validateStudyFirstEventInvestigationCollections({
      investigations: [tampered],
      handoffs: [],
    })).toThrow(/fingerprint/iu);
  });

  it("MU07 preserves legacy results while opening a current v4 relevance scan", async () => {
    const opened4 = openedScreen4Fixture();
    const legacy = structuredClone(
      opened4.state.studyFirstEventInvestigations!.at(-1)!,
    );
    (legacy.context as unknown as { schemaVersion: string }).schemaVersion =
      "screen-04-study-first-context-v1";
    const { investigationFingerprint: _oldFingerprint, ...legacyBody } = legacy;
    legacy.investigationFingerprint = fingerprintSixScreenValue(legacyBody);
    opened4.state.studyFirstEventInvestigations = [legacy];

    expect(() => validateStudyFirstEventInvestigationCollections({
      investigations: opened4.state.studyFirstEventInvestigations,
      handoffs: [],
    })).not.toThrow();

    const reopened = openScreen4(opened4.state, {
      expectedRevision: opened4.state.revision,
      openedAt: "2026-09-20T15:00:02.000Z",
    });
    expect(reopened.state.studyFirstEventInvestigations).toHaveLength(2);
    expect(reopened.state.studyFirstEventInvestigations?.[0]?.context.schemaVersion)
      .toBe("screen-04-study-first-context-v1");
    expect(reopened.state.studyFirstEventInvestigations?.[1]).toMatchObject({
      context: { schemaVersion: "screen-04-study-first-context-v4" },
      status: "planned",
    });
    const refreshed = createRefreshedStudyFirstEventInvestigation({
      previous: legacy,
      ordinal: legacy.ordinal + 1,
      createdAt: "2026-09-20T15:00:03.000Z",
    });
    expect(refreshed).toMatchObject({
      context: { schemaVersion: "screen-04-study-first-context-v4" },
      plan: { schemaVersion: "screen-04-study-first-plan-v3" },
      status: "planned",
      previousSnapshotId: legacy.snapshotId,
    });
    expect(refreshed.snapshotId).not.toBe(legacy.snapshotId);
    const output = await execute(refreshed, fixtureFetch({ federal: 0, fema: 0 }));
    const completed = createCompletedStudyFirstEventInvestigation({
      previous: refreshed,
      ...output,
    });
    expect(completed.plan.discoveryVersion).toBe(
      "screen-04-multisource-discovery-v6",
    );
    expect(completed.previousSnapshotId).toBe(refreshed.snapshotId);
    expect(completed.attempts).toHaveLength(19);
    expect(legacy.context.schemaVersion).toBe("screen-04-study-first-context-v1");
    expect(() => validateStudyFirstEventInvestigationCollections({
      investigations: [legacy, refreshed, completed],
      handoffs: [],
    })).not.toThrow();
  });

  it("keeps saved v2 evidence while making a stricter v4 scan current", async () => {
    const opened4 = openedScreen4Fixture();
    const planned = opened4.state.studyFirstEventInvestigations!.at(-1)!;
    const result = await execute(planned, fixtureFetch({ federal: 1, fema: 1 }));
    const legacy = structuredClone(createCompletedStudyFirstEventInvestigation({
      previous: planned, ...result,
    }));
    legacy.context.schemaVersion = "screen-04-study-first-context-v2";
    delete legacy.context.searchConcepts;
    const { id: _contextId, createdAt: _contextCreatedAt,
      contextFingerprint: _contextFingerprint, ...contextBody } = legacy.context;
    legacy.context.contextFingerprint = fingerprintSixScreenValue(contextBody);
    legacy.plan.schemaVersion = "screen-04-study-first-plan-v2";
    legacy.plan.contextFingerprint = legacy.context.contextFingerprint;
    legacy.plan.steps = legacy.plan.steps.slice(0, 6);
    legacy.plan.budget = {
      sourceQueryCeiling: 6, metadataCandidateCeiling: 36,
      visibleEventCeiling: 10,
    };
    delete legacy.plan.discoveryVersion;
    delete legacy.plan.sourceCapabilityVersion;
    delete legacy.plan.queryPlanFingerprint;
    const { id: _planId, createdAt: _planCreatedAt,
      planFingerprint: _planFingerprint, ...planBody } = legacy.plan;
    legacy.plan.planFingerprint = fingerprintSixScreenValue(planBody);
    legacy.attempts = legacy.attempts.slice(0, 6);
    legacy.occurrences = legacy.occurrences.filter(({ providerId }) =>
      providerId === "federal_register" || providerId === "openfema");
    const retainedIds = new Set(legacy.occurrences.map(({ id }) => id));
    legacy.analyses = legacy.analyses.filter(({ eventId }) =>
      retainedIds.has(eventId));
    legacy.presentation!.visibleEventIds = legacy.presentation!.visibleEventIds
      .filter((id) => retainedIds.has(id));
    legacy.presentation!.overflowEventIds = [];
    legacy.presentation!.coverage.sourceRoutesSucceeded = 6;
    legacy.presentation!.coverage.attemptedBranches = legacy.attempts.map(
      ({ branch }) => branch);
    legacy.presentation!.coverage.completedBranches = legacy.attempts.map(
      ({ branch }) => branch);
    legacy.presentation!.coverage.unsupportedBranches = [];
    legacy.presentation!.coverage.failedBranches = [];
    legacy.presentation!.status = "events_available";
    const { presentationFingerprint: _presentationFingerprint,
      ...presentationBody } = legacy.presentation!;
    legacy.presentation!.presentationFingerprint = fingerprintSixScreenValue(
      presentationBody);
    legacy.status = "completed";
    const { investigationFingerprint: _investigationFingerprint,
      ...legacyBody } = legacy;
    legacy.investigationFingerprint = fingerprintSixScreenValue(legacyBody);
    opened4.state.studyFirstEventInvestigations = [legacy];

    const reopened = openScreen4(opened4.state, {
      expectedRevision: opened4.state.revision,
      openedAt: "2026-09-20T15:00:04.000Z",
    });
    expect(reopened.state.studyFirstEventInvestigations).toHaveLength(2);
    const current = currentStudyFirstEventInvestigation({
      studyFirstEventInvestigations:
        reopened.state.studyFirstEventInvestigations,
      confirmedShock: reopened.state.confirmedShock,
      study: reopened.state.study,
      entryContext: reopened.state.screen3StudyEntryContexts!.at(-1)!,
      timing: reopened.state.proposedTreatmentTimings!.at(-1)!,
      advice: reopened.state.studyDesignAdvices!.at(-1)!,
      selection: null,
    });
    expect(current?.snapshotId).not.toBe(legacy.snapshotId);
    expect(current).toMatchObject({
      status: "planned",
      context: { schemaVersion: "screen-04-study-first-context-v4" },
    });
    expect(legacy.presentation?.visibleEventIds).toHaveLength(2);

    const refreshed = createRefreshedStudyFirstEventInvestigation({
      previous: legacy, ordinal: legacy.ordinal + 1,
      createdAt: "2026-09-20T15:00:05.000Z",
    });
    const refreshedResult = await execute(refreshed, fixtureFetch({
      federal: 1, fema: 1,
    }));
    const completed = createCompletedStudyFirstEventInvestigation({
      previous: refreshed, ...refreshedResult,
    });
    expect(refreshed.previousSnapshotId).toBe(legacy.snapshotId);
    expect(refreshed.plan.discoveryVersion).toBe(
      "screen-04-multisource-discovery-v6");
    expect(legacy.presentation?.visibleEventIds).toHaveLength(2);
    expect(completed.attempts).toHaveLength(19);
    expect(() => validateStudyFirstEventInvestigationCollections({
      investigations: [planned, legacy, refreshed, completed], handoffs: [],
    })).not.toThrow();
  });
});
