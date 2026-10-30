import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assertFindPositiveHandoff, assertScreen02Acceptance, assertScreen03EvidenceGuardRejection,
  evaluateScreen03Scenario, projectScreen02Result,
  hasReviewedScreen02CandidateEvidence, pdfContentLimitation,
  isPersistedQualificationReuseReason, requireScreen02RetrievalBudget,
  summarizeModeResults,
  targetMatches, validateCaseManifest,
} from "../../scripts/verify-production-matrix.mjs";
import { screen03RefreshDecisionIsCurrent } from
  "../../scripts/live-verifier-screen03.mjs";
import manifest from "../../scripts/production-matrix-cases.json";
import { buildReadyFindState, fixtureAt, workflowManifest } from "../core/screen02-workflow-fixtures";
import { buildScreen02WorkflowHandoff } from "../../src/core/screen02-workflow-handoff";
import { encodeScreen02FindWorkflowStateEnvelope } from "../../src/core/screen02-workflow-envelope";
import { confirmScopeContract } from "../../src/core/screen01-service";
import { buildScreen01StudyContext } from "../../src/core/study-context";
import { decisionKeys } from "../../src/core/scope-types";
import { fingerprintScreen02WorkflowState } from "../../src/core/screen02-workflow-state";
import { buildScreen02FindDiscoveryFromProposals, buildScreen02SearchFunnel } from "../../src/core/screen02-find-discovery";
import { qualifyScreen02FindProposal } from "../../src/core/screen02-qualification";
import { SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN, type Screen02FindProposal } from "../../src/core/screen02-types";
import { buildScreen03StateFromResearch, screen03FactualClaims } from "../../src/core/screen03-workflow";
import { researchScreen03Evidence } from "../../src/worker/screen03-evidence-service";
import { createInitialScreen02WorkflowState, applyScreen02WorkflowAction,
  buildScreen02WorkflowClientSnapshot, SCREEN_02_WORKFLOW_ACTION_SCHEMA_VERSION,
  type Screen02WorkflowControllerOptions } from "../../src/worker/screen02-workflow-controller";

function typedRetrievalManifest(
  baselineOverrides: Record<string, unknown> = {},
  qualificationRecovery: Record<string, unknown> | null = null,
) {
  const queryIds = Array.from({ length: 12 }, (_value, index) =>
    `retrieval-query-${index + 1}`
  );
  const baseline = {
    phase: "baseline",
    status: "completed",
    queryIds,
    stoppingReason: "routes-exhausted",
    queriesPlanned: 12,
    queriesAttempted: 12,
    queriesSucceeded: 12,
    queriesFailed: 0,
    roundsExecuted: 1,
    recordsReceived: 2,
    proposalsGenerated: 2,
    uniqueProposalsGenerated: 2,
    ...baselineOverrides,
  };
  const recovery = qualificationRecovery;
  const additive = (key: string) =>
    Number(baseline[key as keyof typeof baseline] ?? 0) +
    Number(recovery?.[key] ?? 0);
  return {
    protocolVersion: "screen-02-search-protocol-v4",
    funnel: {
      schemaVersion: "screen-02-search-funnel-v2",
      sourceRecordsRetrieved: additive("recordsReceived"),
      uniqueEventLeads: additive("uniqueProposalsGenerated"),
      deeperRetrievalAttempts: 0,
    },
    queryMatrix: [
      ...baseline.queryIds,
      ...((recovery?.queryIds as string[] | undefined) ?? []),
    ].map((id) => ({ id })),
    channels: [{ channel: "presentation", note: "This text is not parsed." }],
    retrievalExecution: {
      schemaVersion: "screen-02-retrieval-execution-v2",
      limits: {
        rawCandidateTarget: 40,
        rawCandidateMaximum: 60,
        qualifiedCandidateTarget: 10,
        minimumGeneralQueryVariants: 12,
        maximumGeneralQueryVariants: 16,
        maximumBaselineRounds: 2,
        maximumDocumentAcquisitions: 24,
        maximumDocumentRedirects: 3,
        documentRequestTimeoutMs: 3_000,
        documentRunTimeoutMs: 45_000,
        documentMaximumBytes: 2 * 1024 * 1024,
        documentTotalBytes: 6 * 1024 * 1024,
        documentConcurrency: 2,
      },
      baseline,
      qualificationRecovery: recovery,
      aggregate: {
        queriesPlanned: additive("queriesPlanned"),
        queriesAttempted: additive("queriesAttempted"),
        queriesSucceeded: additive("queriesSucceeded"),
        queriesFailed: additive("queriesFailed"),
        roundsExecuted: additive("roundsExecuted"),
        recordsReceived: additive("recordsReceived"),
        proposalsGenerated: additive("proposalsGenerated"),
        uniqueProposalsGenerated: additive("uniqueProposalsGenerated"),
        terminal: true,
      },
      documentAcquisitions: [],
      outcomeValuesInspected: false,
    },
  };
}

function shortfall() {
  const input = manifest.screen2.find((item) => item.caseId === "s2-thailand-food-regulation")!;
  return { input, observation: {
    scope: structuredClone(input.scope), displayed: 0, discoveryStatus: "completed-empty",
    funnel: { qualifiedCandidates: 0, displayedCandidates: 0, hardScopePassed: 0, evaluatedUniqueLeads: 1 },
    stoppingRule: { status: "met", note: "One bounded registry lead failed hard scope; no native route supports this exact scope." },
    retrievalBudget: { stoppingReason: "unsupported", queryRequestsExecuted: 0 },
    exclusions: [{ qualification: { eligible: false, exclusionCodes: ["hard-scope-mismatch", "industry-mismatch"] } }],
    decision: { openedCandidateSnapshotId: null, tentativeSelectionSnapshotId: null, continuedRevision: null },
    handoff: null,
    sourceRoutes: [
      { channel: "bounded-reviewed-event-registry", status: "searched", note: "Registry search completed." },
      { channel: "Coverage limitation · national-primary-source-not-configured", status: "not-searched", note: "No native official legal-source connector is configured for this exact scope." },
    ],
  } };
}

function negativePdf() {
  const input = manifest.screen3.find((item) => item.scenario === "inaccessible-pdf")!;
  const locator = input.anchor.sourceLocator;
  return { input, observation: {
    initial: {
      eventIdentity: { canonicalTitle: "California Privacy Rights Act", commonNames: ["CPRA"] },
      proposals: [{ group: "overview", label: "What changed", support: "indirect", passages: [] }],
      initialSources: [{ locator, authorityTier: 1, status: "carried", passageCount: 1,
        passageBases: ["source-metadata"], officialFields: [] }],
      research: { status: "completed", channels: [], gaps: [
        `The PDF page structure could not be safely bounded, so conversion was not attempted. Locator: ${locator}`,
      ] },
    },
    actions: { confirm: "server-rejected-unsupported-probe", confirmProbe: { support: "indirect", sourceLocator: locator } },
  } };
}

describe("prospectively reviewed production acceptance modes", () => {
  it("recognizes current cache audit wording and only reopens affected refresh decisions", () => {
    expect(isPersistedQualificationReuseReason(
      "The persisted qualification was reused without another assisted-reasoning request.",
    )).toBe(true);
    expect(isPersistedQualificationReuseReason(
      "The persisted qualification was reused without another provider or host request.",
    )).toBe(true);
    expect(isPersistedQualificationReuseReason(
      "The fixed qualification was recomputed from current source evidence.",
    )).toBe(false);

    const refreshState = (reviewStatus: string, reopenedProposalIds: string[]) => ({
      history: [{ id: "refresh-history", action: "research-refreshed" }],
      proposals: {
        identity: [{ id: "reviewed-proposal", reviewStatus }],
      },
      sourceChanges: [{
        historyEventId: "refresh-history",
        reopenedProposalIds,
      }],
    });
    expect(screen03RefreshDecisionIsCurrent(
      refreshState("accepted", []),
      "reviewed-proposal",
    )).toBe(true);
    expect(screen03RefreshDecisionIsCurrent(
      refreshState("proposed", ["reviewed-proposal"]),
      "reviewed-proposal",
    )).toBe(true);
    expect(screen03RefreshDecisionIsCurrent(
      refreshState("accepted", ["reviewed-proposal"]),
      "reviewed-proposal",
    )).toBe(false);
  });

  it("keeps all 22 cases with 15 positive, six shortfall and one negative expectation", () => {
    expect(validateCaseManifest(manifest)).toBe(manifest);
    const all = [...manifest.screen2, ...manifest.screen3];
    expect(new Set(all.map((item) => item.caseId)).size).toBe(22);
    expect(summarizeModeResults(all.map((item) => ({ expectedMode: item.expectedMode, status: "passed" })))).toEqual({
      "positive-journey": { total: 15, passed: 15, failed: 0 },
      "honest-shortfall": { total: 6, passed: 6, failed: 0 },
      "negative-evidence": { total: 1, passed: 1, failed: 0 },
    });
    const missing = structuredClone(manifest); missing.screen2.pop();
    expect(() => validateCaseManifest(missing)).toThrow(/11 cases/u);
    const unknown = structuredClone(manifest); unknown.screen2[0]!.expectedMode = "automatic-pass";
    expect(() => validateCaseManifest(unknown)).toThrow(/acceptance mode/u);
  });

  it("requires reviewed source-backed positive inputs and preserves Audit scenario intent", () => {
    const unreviewed = structuredClone(manifest);
    unreviewed.screen2.find((item) =>
      item.caseId === "s2-global-all-industry"
    )!.acceptance.sourceLocators = [];
    expect(() => validateCaseManifest(unreviewed)).toThrow(/positive inputs/u);
    const relabeled = structuredClone(manifest); relabeled.screen3[0]!.expectedMode = "honest-shortfall";
    expect(() => validateCaseManifest(relabeled)).toThrow(/preserve/u);
  });

  it("prospectively requires direct or adjacent source-backed gaming and U.S. energy selections", () => {
    for (const caseId of [
      "s2-us-video-gaming-regulation",
      "s2-us-energy-regulation",
    ]) {
      const input = manifest.screen2.find((item) => item.caseId === caseId)!;
      expect(input).toMatchObject({
        expectedMode: "positive-journey",
        acceptance: {
          requiredCandidateClassifications: ["direct", "adjacent"],
          sourceLocators: expect.any(Array),
        },
      });
      expect(input.acceptance.sourceLocators.length).toBeGreaterThan(0);
    }
    const invalid = structuredClone(manifest);
    invalid.screen2.find((item) =>
      item.caseId === "s2-us-energy-regulation"
    )!.acceptance.requiredCandidateClassifications = ["mismatch"];
    expect(() => validateCaseManifest(invalid)).toThrow(
      /candidate-classification contract/u,
    );
    const changedIdentity = structuredClone(manifest);
    const changedBinding = changedIdentity.screen2.find((item) =>
      item.caseId === "s2-us-energy-regulation"
    )!.acceptance.requiredCandidateEvidence;
    if (!changedBinding) throw new Error("Expected reviewed energy binding.");
    changedBinding.formalIdentifier = "Order 999";
    expect(() => validateCaseManifest(changedIdentity)).toThrow(
      /independently reviewed candidate-evidence binding/u,
    );
  });

  it.each([
    "s2-us-video-gaming-regulation",
    "s2-us-energy-regulation",
  ])("binds %s to its exact identity, locator, and stored bridge passages", (caseId) => {
    const input = manifest.screen2.find((item) => item.caseId === caseId)!;
    const binding = input.acceptance.requiredCandidateEvidence;
    if (!binding) throw new Error(`Expected reviewed binding for ${caseId}.`);
    const source = {
      id: "reviewed-source",
      locator: binding.sourceLocator,
      evidenceText: [
        binding.canonicalTitle,
        binding.issuer,
        binding.issuingJurisdiction,
        binding.formalIdentifier ?? "",
        ...binding.industryBridgePassages,
        ...binding.populationBridgePassages,
      ].join(". "),
    };
    const coordinates = [
      ...binding.industryBridgePassages,
      ...binding.populationBridgePassages,
    ].map((text, index) => ({
      sourceId: source.id,
      sentenceStart: index,
      sentenceEnd: index,
      characterStart: 0,
      characterEnd: text.length,
      text: source.evidenceText,
      matchedIdentityTerms: [binding.canonicalTitle],
      matchedFormalIdentifiers: binding.formalIdentifier
        ? [binding.formalIdentifier]
        : [],
      matchedActionTerms: ["requires"],
      matchedDateTerms: [],
      polarity: "affirmative",
    }));
    const candidate: any = {
      identity: {
        canonicalTitle: binding.canonicalTitle,
        formalIdentifier: binding.formalIdentifier,
        issuer: binding.issuer,
        issuingJurisdiction: binding.issuingJurisdiction,
      },
      sourceIds: [source.id],
      qualification: {
        classification: "direct",
        evidenceSourceIds: [source.id],
        industryFit: { evidenceSourceIds: [source.id] },
        substantiveOverview: {
          passed: true,
          evidenceSourceIds: [source.id],
          sourceGrounding: {
            schemaVersion: "screen-02-source-grounding-v1",
            coordinates,
          },
        },
      },
    };
    const sources = new Map([[source.id, source]]);
    expect(hasReviewedScreen02CandidateEvidence(input, candidate, sources))
      .toBe(true);

    for (const mutate of [
      (copy: any) => { copy.identity.canonicalTitle += " (different)"; },
      (copy: any) => { copy.identity.formalIdentifier = "different"; },
      (copy: any) => { copy.identity.issuer = "Different authority"; },
      (copy: any) => { copy.identity.issuingJurisdiction = "Canada"; },
      (copy: any) => { copy.qualification.industryFit.evidenceSourceIds = []; },
      (copy: any) => {
        copy.qualification.substantiveOverview.sourceGrounding.coordinates = [];
      },
    ]) {
      const copy = structuredClone(candidate);
      mutate(copy);
      expect(hasReviewedScreen02CandidateEvidence(input, copy, sources))
        .toBe(false);
    }

    for (const fact of [
      binding.canonicalTitle,
      binding.issuer,
      binding.issuingJurisdiction,
      binding.formalIdentifier,
    ].filter((value): value is string => Boolean(value))) {
      const wrongSourceIdentity = new Map([[source.id, {
        ...source,
        evidenceText: source.evidenceText.replace(
          fact,
          "Different identity fact",
        ),
      }]]);
      expect(hasReviewedScreen02CandidateEvidence(
        input,
        candidate,
        wrongSourceIdentity,
      )).toBe(false);
    }

    const ungroundedIdentity = structuredClone(candidate);
    ungroundedIdentity.qualification.substantiveOverview.sourceGrounding
      .coordinates.forEach((coordinate: any) => {
        coordinate.matchedIdentityTerms = [];
      });
    expect(hasReviewedScreen02CandidateEvidence(
      input,
      ungroundedIdentity,
      sources,
    )).toBe(false);

    const unrelatedIdentityMarker = structuredClone(candidate);
    unrelatedIdentityMarker.qualification.substantiveOverview.sourceGrounding
      .coordinates.forEach((coordinate: any) => {
        coordinate.matchedIdentityTerms = ["unrelated-marker"];
      });
    expect(hasReviewedScreen02CandidateEvidence(
      input,
      unrelatedIdentityMarker,
      sources,
    )).toBe(false);

    const ungroundedJurisdiction = structuredClone(candidate);
    ungroundedJurisdiction.qualification.substantiveOverview.sourceGrounding
      .coordinates.forEach((coordinate: any) => {
        coordinate.text = coordinate.text.replace(
          binding.issuingJurisdiction,
          "",
        );
      });
    expect(hasReviewedScreen02CandidateEvidence(
      input,
      ungroundedJurisdiction,
      sources,
    )).toBe(false);
    const arbitrary = structuredClone(candidate);
    arbitrary.qualification.substantiveOverview.sourceGrounding.coordinates = [{
      ...coordinates[0],
      text: "Some unrelated but nonempty official evidence.",
    }];
    expect(hasReviewedScreen02CandidateEvidence(input, arbitrary, sources))
      .toBe(false);
  });

  it("keeps the global cache scope and uses the reviewed UK primary-source scope for repeated Find", () => {
    const global = manifest.screen2.find((item) => item.caseId === "s2-global-all-industry")!;
    const cache = manifest.screen2.find((item) => item.repeatSearch)!;
    expect(cache.scope).toEqual(global.scope);
    expect(cache.sentence).toBe(global.sentence);
    expect(global.scope).toMatchObject({ geography: "Global", industry: "All industries", studyPeriod: "2000–2024", eventFamily: "Disaster", population: "Listed firms" });
    const live = readFileSync(new URL("../../scripts/verify-live-mcp.mjs", import.meta.url), "utf8");
    expect(live).toContain('item.caseId === "s2-uk-finance-regulation"');
    expect(live).toContain('} : { ...reviewedFindAcceptance.scope }');
    expect(live).toContain("firstActiveFindCandidateSnapshotId");
    const repeated = manifest.screen2.find((item) => item.caseId === "s2-uk-finance-regulation")!;
    expect(repeated.expectedMode).toBe("positive-journey");
    expect(repeated.scope).toMatchObject({ geography: "United Kingdom", industry: "Financial services", studyPeriod: "2010–2020", eventFamily: "Regulation" });
    expect(repeated.acceptance.sourceLocators).toContain("https://www.legislation.gov.uk/");
  });

  it("accepts terminal reviewed zero coverage with explicit limits and no handoff", () => {
    const { input, observation } = shortfall();
    expect(assertScreen02Acceptance(input, observation)).toMatchObject({ mode: "honest-shortfall", qualificationTargetMet: false, selection: "absent", handoff: "absent" });
  });

  it.each(["count", "filler", "scope", "pending", "reason", "stop", "exclusions", "selection", "handoff"])("fails closed for inconsistent shortfall %s", (kind) => {
    const { input, observation } = shortfall();
    const bad = observation as Record<string, any>;
    if (kind === "count") bad.funnel.qualifiedCandidates = 1;
    if (kind === "filler") bad.displayed = 1;
    if (kind === "scope") bad.scope.industry = "All industries";
    if (kind === "pending") bad.discoveryStatus = "searching";
    if (kind === "reason") bad.stoppingRule.note = "";
    if (kind === "stop") bad.retrievalBudget.stoppingReason = "source-timeout";
    if (kind === "exclusions") bad.exclusions = [];
    if (kind === "selection") bad.decision.tentativeSelectionSnapshotId = "fabricated";
    if (kind === "handoff") bad.handoff = { destinationScreen: "screen-03" };
    expect(() => assertScreen02Acceptance(input, bad)).toThrow();
  });

  it("preserves the v0.4.06 gaming shortfall contract as failing evidence when required enrichment timed out", () => {
    const { observation } = shortfall();
    const current = manifest.screen2.find((item) => item.caseId === "s2-us-video-gaming-regulation")!;
    const input = {
      ...current,
      expectedMode: "honest-shortfall",
      acceptance: {
        reason: "Retained v0.4.06 source records did not establish the requested industry and organizational population; zero coverage must preserve counts, exclusions, and the exact scope.",
        reviewBasis: [
          "Workflow 34040825782, case s2-us-video-gaming-regulation; zero qualified candidates and every evaluated lead excluded for scope or industry mismatch.",
        ],
        sourceLocators: [
          "https://www.federalregister.gov/api/v1/documents.json",
        ],
        shortfallCondition: "no-scope-qualified-candidate",
        allowedStops: ["raw-target", "routes-exhausted"],
      },
    };
    observation.scope = structuredClone(input.scope);
    observation.retrievalBudget = { stoppingReason: "raw-target", queryRequestsExecuted: 12 };
    observation.sourceRoutes.push({ channel: "Bounded substantive-information retrieval ladder", status: "failed", note: "All bounded official documents timed out." });
    expect(() => assertScreen02Acceptance(input, observation)).toThrow(/required source retrieval failed/u);
  });

  it("does not absorb a configured-source defect into unsupported native coverage", () => {
    const { input, observation } = shortfall();
    observation.sourceRoutes.push({ channel: "federal-register-api-v1 diagnostics", status: "failed", note: "Native endpoint failed." });
    expect(() => assertScreen02Acceptance(input, observation)).toThrow(/required source retrieval failed/u);
  });

  it("requires the explicit unconfigured-source limitation and retains ancillary failures separately", () => {
    const { input, observation } = shortfall();
    observation.sourceRoutes.push({ channel: "Bounded substantive-information retrieval ladder", status: "failed", note: "Only already-rejected out-of-scope registry documents were unavailable." });
    expect(assertScreen02Acceptance(input, observation)).toMatchObject({ nonNativeRejectedLeadRetrievalLimits: [expect.objectContaining({ channel: "Bounded substantive-information retrieval ladder" })] });
    observation.sourceRoutes = observation.sourceRoutes.filter((route) => !route.channel.startsWith("Coverage limitation"));
    expect(() => assertScreen02Acceptance(input, observation)).toThrow(/explicit native-source coverage limitation/u);
  });

  it("keeps optional context failure distinct from required official retrieval", () => {
    const { observation } = shortfall();
    const input = manifest.screen2.find((item) => item.caseId === "s2-chile-disaster")!;
    observation.scope = structuredClone(input.scope);
    observation.retrievalBudget = { stoppingReason: "routes-exhausted", queryRequestsExecuted: 1 };
    observation.sourceRoutes.push({ channel: "Optional contextual discovery", status: "failed", note: "Optional context source timed out." });
    expect(() => assertScreen02Acceptance(input, observation)).not.toThrow();
    observation.sourceRoutes.push({ channel: "gdacs-event-search-v1 diagnostics", status: "failed", note: "Required official event lookup timed out." });
    expect(() => assertScreen02Acceptance(input, observation)).toThrow(/required source retrieval failed/u);
  });

  it("keeps positive zero coverage a failure", () => {
    const { input, observation } = shortfall();
    expect(() => assertScreen02Acceptance({ ...input, expectedMode: "positive-journey" }, observation)).toThrow(/no qualified candidate/u);
  });

  it("allows zero native query planning only for the exact typed unsupported contract", () => {
    const source = typedRetrievalManifest({
      status: "unsupported",
      queryIds: [],
      stoppingReason: "unsupported",
      queriesPlanned: 0,
      queriesAttempted: 0,
      queriesSucceeded: 0,
      queriesFailed: 0,
      roundsExecuted: 0,
      recordsReceived: 0,
      proposalsGenerated: 0,
      uniqueProposalsGenerated: 0,
    });
    expect(() => requireScreen02RetrievalBudget(source)).toThrow();
    expect(requireScreen02RetrievalBudget(source, { allowUnsupportedRoute: true }).stoppingReason).toBe("unsupported");
    source.retrievalExecution.baseline.recordsReceived = 1;
    expect(() => requireScreen02RetrievalBudget(source, { allowUnsupportedRoute: true })).toThrow();
  });

  it("requires an actual exact-selection handoff and unchanged scope", () => {
    const state = buildReadyFindState();
    const envelope = encodeScreen02FindWorkflowStateEnvelope(state);
    const handoff = buildScreen02WorkflowHandoff(state, "0.4.6", fixtureAt);
    const snapshot = { mode: "find", runId: state.runId, revision: state.revision,
      stateFingerprint: envelope.checksum, stateEnvelope: envelope, handoff };
    const input = { caseId: "s2-positive-offline", expectedMode: "positive-journey", scope: state.screen01Baseline.scopeContract };
    const selectedId = state.decision.tentativeSelectionSnapshotId!;
    expect(() => assertFindPositiveHandoff(input, snapshot, selectedId)).not.toThrow();
    expect(() => assertFindPositiveHandoff(input, { ...snapshot, handoff: null }, selectedId)).toThrow(/handoff/u);
    expect(() => assertFindPositiveHandoff(input, snapshot, "different-selection")).toThrow(/handoff/u);
    const changed = structuredClone(snapshot); changed.handoff.screen01Baseline.scopeContract.geography = "Changed";
    expect(() => assertFindPositiveHandoff(input, changed, selectedId)).toThrow(/Scope Contract/u);
  });

  it("accepts a real controller-produced broad Find selection and Screen 3 handoff", async () => {
    const input = manifest.screen2.find((item) => item.caseId === "s2-global-all-industry")!;
    const confirmed = confirmScopeContract({ revision: 1, mode: "find", sentence: input.sentence,
      contractSourceSentence: input.sentence, scope: input.scope, knownShock: "", resolvedKeys: [...decisionKeys],
      acknowledgedDifferences: [], scopeDirty: false });
    if (!confirmed.ok) throw new Error(confirmed.error);
    const context = buildScreen01StudyContext(confirmed.state, confirmed.ambiguities);
    const text = "GDACS recorded an earthquake event beginning 2011-03-11 with a red alert level and provides hazard-footprint coordinates. Countries reported: Japan.";
    const proposal: Screen02FindProposal = {
      id: "gdacs-eq-acceptance-fixture", mode: "find", kind: "event", title: "Earthquake: Japan Earthquake",
      description: text, nativeIdentity: { formalIdentifier: "GDACS-EQ-ACCEPTANCE", issuer: null, issuingJurisdiction: null, status: null },
      event: { displayName: "Earthquake: Japan Earthquake", eventDate: "2011-03-11", eventFamily: "Earthquake disaster",
        geographies: ["Japan"], populations: [SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN] },
      origin: "newly-discovered", provisionalDates: ["GDACS event start: 2011-03-11"],
      affectedPopulation: SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
      requiredVariables: ["Organization-to-event-footprint location linkage", "Hazard-footprint coordinates"],
      outcomeLink: { text: "No outcome values inspected; organizational exposure remains unverified.", status: "system-template" },
      likelyServiceLevel: "event-reconnaissance", limitations: ["The source does not establish organizational exposure."],
      reasons: ["Offline source-format fixture for the production common qualifier, not live event evidence."],
      sources: [{ id: "gdacs-offline-source", title: "Earthquake: Japan Earthquake", locator: "https://www.gdacs.org/report.aspx?eventid=fixture&eventtype=EQ",
        publisher: "GDACS", publishedDate: "2011-03-11", authorityTier: 3, channel: "official-primary", evidenceText: `Earthquake: Japan Earthquake. ${text}` }],
    };
    const second: Screen02FindProposal = { ...proposal, id: "gdacs-eq-second-acceptance-fixture",
      title: "Earthquake: Papua New Guinea Earthquake", description: text.replace("Japan", "Papua New Guinea"),
      nativeIdentity: { ...proposal.nativeIdentity!, formalIdentifier: "GDACS-EQ-SECOND-ACCEPTANCE" },
      event: { ...proposal.event, displayName: "Earthquake: Papua New Guinea Earthquake", geographies: ["Papua New Guinea"] },
      sources: proposal.sources.map((source) => ({ ...source, id: "gdacs-second-offline-source",
        title: "Earthquake: Papua New Guinea Earthquake", locator: source.locator.replace("eventid=fixture", "eventid=second-fixture"),
        evidenceText: source.evidenceText!.replaceAll("Japan", "Papua New Guinea") })) };
    const proposals = [proposal, second];
    let ordinal = 0;
    let discoveryFailure: unknown;
    const options: Screen02WorkflowControllerOptions = { now: () => fixtureAt, createId: (kind) => `${kind}-${++ordinal}`,
      signingConfig: null, legacyHostAssessments: false,
      discoverFind: async (state, request) => {
        try {
        expect(state.screen01Baseline).toEqual(context);
        const qualifications = proposals.map((record) => qualifyScreen02FindProposal(record, context,
          { scopeFingerprint: state.screen01Fingerprint }));
        for (const qualification of qualifications) expect(qualification, JSON.stringify(qualification)).toMatchObject({ eligible: true, classification: "broad", section: "broader" });
        const sourceManifest = workflowManifest(
          request.exactRequest,
          proposals.length,
        );
        sourceManifest.queryMatrix[0]!.returnedRecordIds = proposals.map(
          (proposal) => proposal.id,
        );
        sourceManifest.stoppingRule.note = "One source-qualified location-bound disaster was retained; organizational exposure remains unverified.";
        sourceManifest.channels.push({ channel: "Screen 2 exact retrieval funnel · offline source-format fixture", status: "searched", retrievedAt: fixtureAt,
          note: "Targets: 40 raw, 60 raw maximum, 10 qualified. Planned 1 distinct query variants (required range 12–16 for general legal Find), executed 1 source-query requests across 1/2 rounds, received 2 records, generated 2 provisional proposals, and retained 2 unique raw identities before the common registry/connector qualifier. Stop: routes-exhausted." });
        sourceManifest.funnel = buildScreen02SearchFunnel({ sourceRecordsRetrieved: 2, uniqueEventLeads: 2,
          qualifications, displayedCandidates: 2 });
        return buildScreen02FindDiscoveryFromProposals(state, { searchRoundId: request.searchRoundId, at: request.at,
          proposals, qualifications, manifest: sourceManifest,
          resultOrigins: proposals.map((proposal) => ({ proposalId: proposal.id, origins: [{
            kind: "query-result" as const, retrievalLane: "official-baseline" as const,
            evidenceRole: "identity" as const, producerRecordId: proposal.id,
            queryId: "query-1", returnedRecordIds: [proposal.id],
            sourceIds: proposal.sources.map((source) => source.id),
          }] })) });
        } catch (error) { discoveryFailure = error; throw error; }
      } };
    let state = createInitialScreen02WorkflowState(context, "offline-global-controller", fixtureAt, options);
    const apply = async (action: "find-search" | "find-open" | "find-select" | "find-continue", payload: Record<string, unknown>) => {
      const changed = await applyScreen02WorkflowAction(state, { schemaVersion: SCREEN_02_WORKFLOW_ACTION_SCHEMA_VERSION,
        operationId: `offline-action-${++ordinal}`, runId: state.runId, accessToken: "offline-test-access",
        expectedRevision: state.revision, expectedStateFingerprint: fingerprintScreen02WorkflowState(state), action, payload }, options);
      state = changed.state;
    };
    await apply("find-search", { criteria: [] });
    if (discoveryFailure) throw discoveryFailure;
    const searched = await buildScreen02WorkflowClientSnapshot(state, "offline-test-access", options);
    if (state.mode !== "find") throw new Error("Expected Find after search.");
    expect(state.candidates.length, JSON.stringify(state.candidateSets.at(-1)?.manifest)).toBe(2);
    expect(projectScreen02Result(input, searched)).toMatchObject({ expectedMode: "positive-journey", activeReferenceCount: 2, continuationReady: false });
    expect(() => projectScreen02Result({
      ...input,
      acceptance: {
        ...input.acceptance,
        requiredCandidateClassifications: ["direct", "adjacent"],
      },
    }, searched)).toThrow(/no substantive source-backed candidate/u);
    if (state.mode !== "find") throw new Error("Expected actual Find state.");
    const selected = state.candidates[0]!;
    await apply("find-open", { candidateSnapshotId: selected.candidateSnapshotId });
    await apply("find-select", { candidateSnapshotId: selected.candidateSnapshotId });
    await apply("find-continue", {});
    const continued = await buildScreen02WorkflowClientSnapshot(state, "offline-test-access", options);
    expect(() => assertFindPositiveHandoff(input, continued, selected.candidateSnapshotId)).not.toThrow();
    const handoff = continued.handoff!;
    expect(handoff.event.preliminaryQualification).toMatchObject({ classification: "broad", section: "broader" });
    const packet = await researchScreen03Evidence({ handoff, retrievedAt: fixtureAt,
      fetch: async () => new Response(JSON.stringify({ count: 0, results: [] }), { headers: { "content-type": "application/json" } }) });
    const screen3 = buildScreen03StateFromResearch(handoff, packet, fixtureAt);
    expect(screen3.status).toBe("reviewing");
    expect(screen3.researchCoverage.status).not.toBe("pending");
    expect(screen3.eventIdentity).toEqual(handoff.event.identity);
    // Carried GDACS tier-3 metadata is insufficient for direct factual Confirm.
    // Empty offline connector responses establish handoff only, never the live
    // verifier's strict direct-proposal and two-Find-card locking requirements.
    expect(screen03FactualClaims(screen3.proposals).filter((claim) => claim.support === "direct")).toHaveLength(0);
  });

  it("normalizes equivalent native bill labels without matching different bill numbers", () => {
    expect(targetMatches({ formalIdentifier: "SB0227" }, ["S.B. 227"])).toBe(true);
    expect(targetMatches({ formalIdentifier: "S.B. 227" }, ["SB0227"])).toBe(true);
    expect(targetMatches({ formalIdentifier: "SB02270" }, ["S.B. 227"])).toBe(false);
  });

  it("accepts only the actual direct-evidence Confirm guard, not a schema or capability error", () => {
    const result = { isError: true, content: [{ type: "text", text: "Accepted or edited fields require active direct passage support; otherwise reject them or leave them unresolved." }] };
    expect(() => assertScreen03EvidenceGuardRejection(result, "negative PDF")).not.toThrow();
    expect(() => assertScreen03EvidenceGuardRejection({ ...result, content: [{ type: "text", text: "Unsupported decision accept" }] }, "negative PDF"))
      .toThrow(expect.objectContaining({ code: "screen3-confirm-rejection-wrong-cause", publicFailureMessage: "Unsupported decision accept" }));
    expect(() => assertScreen03EvidenceGuardRejection({ ...result, isError: false }, "negative PDF")).toThrow();
  });

  it("recognizes exact-locator nonconversion with metadata only and an actual rejected Confirm", () => {
    const { input, observation } = negativePdf();
    expect(pdfContentLimitation(input, observation)).toMatchObject({ sourceObserved: true, hasDocumentContent: false, contentUnavailable: true });
    expect(evaluateScreen03Scenario(input, observation)).toEqual({ status: "passed", reasons: [] });
  });

  it.each(["document", "unrelated", "accepted", "missing-probe", "different-probe"])("rejects an invalid negative PDF precondition or Confirm %s", (kind) => {
    const { input, observation } = negativePdf();
    const bad = observation as Record<string, any>;
    if (kind === "document") bad.initial.initialSources[0].passageBases = ["official-document-passage"];
    if (kind === "unrelated") bad.initial.research.gaps = ["An unrelated route failed. Locator: https://example.org/unrelated"];
    if (kind === "accepted") bad.actions.confirm = "server-accepted-direct-supported-probe";
    if (kind === "missing-probe") delete bad.actions.confirmProbe;
    if (kind === "different-probe") bad.actions.confirmProbe.sourceLocator = "https://example.org/unrelated";
    expect(evaluateScreen03Scenario(input, bad).status).toBe("failed");
  });
});
