import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  SCREEN_02_EXTERNALITY_RUBRIC_VERSION,
  SCREEN_02_OUTCOME_PATHWAY_RUBRIC_VERSION,
  SCREEN_02_POPULATION_APPLICABILITY_RUBRIC_VERSION,
  SCREEN_02_PRELIMINARY_ASSESSMENT_SCHEMA_VERSION,
  SCREEN_02_PREFERENCE_VERSION,
  SCREEN_02_RUBRIC_VERSION,
  SCREEN_02_SCORING_FORMULA_VERSION,
  SCREEN_02_SEARCH_PROTOCOL_VERSION,
  SCREEN_02_SESSION_SCHEMA_VERSION,
  SCREEN_02_SOURCE_POLICY_VERSION,
  type Screen02ComponentDetail,
  type Screen02FindItem,
  type Screen02Item,
  type Screen02SearchManifest,
  type Screen02SearchRound,
  type Screen02Session,
} from "../../src/core/screen02-types";
import type { Screen01StudyContext } from "../../src/core/scope-types";
import Screen02, {
  buildScreen02InteractiveSearchRequest,
  candidateTriageForScreen02Item,
  collectVisiblePreferenceDrafts,
  currentVisibleScreen02Items,
  logicalScreen02Searches,
  screen02HasCompletedAiReview,
  screen02WhyUsefulReasons,
  screen02SemanticDecisionLock,
  screen02SemanticReviewStatus,
  screen02StrictCriteriaDecisionLock,
  type Screen02Notice,
} from "../../src/ui/screen-02/Screen02";
import { SHOCKAUDIT_VERSION } from "../../src/version";

const hostView = {
  connected: true,
  embedded: true,
  displayMode: "fullscreen" as const,
  canFullscreen: true,
  canSendMessage: true,
};

function createBaseline(
  startingPoint: "find" | "audit" = "find",
): Screen01StudyContext {
  const studySentence =
    "Study regulation and annual profitability among U.S. public technology firms from 2017 to 2023.";
  return {
    schemaVersion: "1.0",
    appVersion: SHOCKAUDIT_VERSION,
    sourceScreen: "screen-01",
    startingPoint,
    studySentence,
    contractSourceSentence: studySentence,
    knownShock:
      startingPoint === "audit"
        ? "California Consumer Privacy Act"
        : "",
    scopeContract: {
      population: "U.S. public technology firms",
      assignmentLevel: "Firm",
      analysisLevel: "Firm",
      geography: "United States",
      industry: "Technology",
      studyPeriod: "2017–2023",
      eventFamily: "Regulation",
      outcomeFamily: "Profitability",
      outcomeFrequency: "Annual",
    },
    resolvedKeys: [
      "population",
      "assignmentLevel",
      "analysisLevel",
      "geography",
      "industry",
      "studyPeriod",
      "eventFamily",
      "outcomeFamily",
      "outcomeFrequency",
      ...(startingPoint === "audit" ? (["knownShock"] as const) : []),
    ],
    unresolvedDecisions: [],
    scopeDirty: false,
    confirmed: true,
    readyForLaterScreens: true,
    revision: 4,
  };
}

function detail(
  method: Screen02ComponentDetail["method"],
  category: string,
  evidenceSourceIds: string[] = [],
): Screen02ComponentDetail {
  return {
    method,
    category,
    criteria: ["Apply the published criterion without inspecting outcomes."],
    evidenceSourceIds,
    reason: `Evidence-based reason for ${category}.`,
    confidence: "medium",
    unresolved: category === "unknown" ? ["Verification is required."] : [],
    rubricVersion: SCREEN_02_RUBRIC_VERSION,
  };
}

function createFindItem(id: string, title: string): Screen02FindItem {
  const sourceId = `source-${id}`;
  return {
    id,
    mode: "find",
    kind: "event",
    title,
    description: `${title} is retained as a source-backed candidate.`,
    origin: "newly-discovered",
    provisionalDates: ["2020-01-01"],
    affectedPopulation: "Covered firms",
    requiredVariables: ["Exposure status", "Event date"],
    outcomeLink: {
      text: `${title} could change firms' compliance obligations and operating costs.`,
      status: "ai-hypothesis",
    },
    likelyServiceLevel: "full-audit",
    limitations: ["Firm-level exposure still requires verification."],
    reasons: ["The event fits the confirmed study boundary."],
    provisional: true,
    evidenceStatus: "partial",
    sources: [
      {
        id: sourceId,
        title: `Official record for ${title}`,
        locator: "https://example.gov/official-record",
        publisher: "Official authority",
        publishedDate: "2020-01-01",
        authorityTier: 1,
        authorityAssessment: {
          method: "system-domain-rule",
          reason: "The record is hosted by the issuing authority.",
          policyVersion: SCREEN_02_SOURCE_POLICY_VERSION,
        },
        channel: "official-primary",
        retrievedAt: "2026-07-30T12:00:00-05:00",
      },
    ],
    sourceSummary: {
      uniqueSourceCount: 1,
      byAuthorityTier: {
        1: 1,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
        6: 0,
      },
      strongestAuthorityTier: 1,
      authorityScore: 100,
    },
    hardFilters: [
      {
        key: "geography",
        status: "pass",
        reason: "The event matches the confirmed geography.",
      },
      {
        key: "studyPeriod",
        status: "pass",
        reason: "The event falls inside the confirmed period.",
      },
      {
        key: "population",
        status: "review",
        reason: "Firm-level applicability requires closer review.",
      },
      {
        key: "eventFamily",
        status: "pass",
        reason: "The event is a regulation.",
      },
    ],
    scorecard: {
      formulaVersion: SCREEN_02_SCORING_FORMULA_VERSION,
      components: {
        scopeFit: 90,
        sourceAuthority: 100,
        exposureObservability: 72,
        timeSupport: 80,
        variation: 62,
      },
      componentReasons: {
        scopeFit: "The fixed boundary checks pass.",
        sourceAuthority: "An official record was located.",
        exposureObservability: "Exposure may be observable with linkage.",
        timeSupport: "The study period allows pre/post observation.",
        variation: "Comparison variation appears possible but needs verification.",
      },
      componentDetails: {
        scopeFit: detail("system-computed", "scope-pass", [sourceId]),
        sourceAuthority: detail(
          "system-computed",
          "official-source",
          [sourceId],
        ),
        exposureObservability: detail(
          "ai-rubric",
          "observable-with-linkage",
          [sourceId],
        ),
        timeSupport: detail("ai-rubric", "adequate-window", [sourceId]),
        variation: detail("ai-rubric", "limited-comparison", [sourceId]),
      },
      overall: null,
      overallRange: { minimum: 70, maximum: 84 },
      reason: "The evidence is incomplete.",
      coverage: {
        knownComponents: 5,
        totalComponents: 5,
        knownWeight: 1,
        knownWeightPercent: 100,
      },
    },
    externalShockPlausibility: {
      method: "ai-rubric",
      category: "plausible",
      criteria: [
        "Assess external-shock plausibility without inspecting outcomes.",
      ],
      evidenceSourceIds: [sourceId],
      reason:
        "The issuing authority, rather than the focal firms, initiated the event.",
      confidence: "medium",
      unresolved: ["Formal exogeneity still requires Screen 3 verification."],
      rubricVersion: SCREEN_02_EXTERNALITY_RUBRIC_VERSION,
    },
    populationApplicability: {
      method: "ai-rubric",
      category: "documented-conditional",
      sourceEstablishedPopulation: {
        text: `Organizations covered by ${title}'s documented eligibility conditions`,
        evidenceSourceIds: [sourceId],
      },
      criteria: [
        "Compare source-documented event coverage with the immutable Screen 1 study population.",
      ],
      evidenceSourceIds: [sourceId],
      reason: `${title} documents conditional coverage of covered firms; overlap with the broader Screen 1 study population still requires verification.`,
      confidence: "medium",
      unresolved: [
        "Verify candidate-specific thresholds and exemptions on Screen 3.",
      ],
      rubricVersion:
        SCREEN_02_POPULATION_APPLICABILITY_RUBRIC_VERSION,
    },
    outcomePathway: {
      method: "ai-rubric",
      category: "source-anchored-specific",
      criteria: [
        "Assess whether attached pre-outcome sources support a candidate-specific outcome pathway.",
      ],
      evidenceSourceIds: [sourceId],
      reason: `${title}'s documented compliance obligations provide a source-anchored Profitability pathway through operating-cost and investment changes.`,
      confidence: "medium",
      unresolved: [
        `Check whether ${title}'s compliance obligations changed the proposed firm-level pathway in Screen 3.`,
      ],
      rubricVersion: SCREEN_02_OUTCOME_PATHWAY_RUBRIC_VERSION,
    },
    rank: 1,
    event: {
      displayName: title,
      eventDate: "2020-01-01",
      eventFamily: "Regulation",
      geographies: ["United States"],
      populations: ["Covered firms"],
    },
  };
}

function createManifest(): Screen02SearchManifest {
  return {
    queryMatrix: [
      {
        id: "query-1",
        query: "technology regulation United States",
        purpose: "Locate eligible regulatory events",
        returnedRecordIds: ["proposal-a", "proposal-b"],
      },
    ],
    channels: [
      {
        channel: "official-primary",
        status: "searched",
        note: "Official records searched.",
        retrievedAt: "2026-07-30T12:00:00-05:00",
      },
      {
        channel: "scholarly-research",
        status: "not-searched",
        note: "Not required for this bounded pass.",
      },
    ],
    hardFilters: [
      { key: "geography", requiredValue: "United States" },
      { key: "studyPeriod", requiredValue: "2017–2023" },
      { key: "population", requiredValue: "U.S. public technology firms" },
      { key: "eventFamily", requiredValue: "Regulation" },
    ],
    exclusions: [
      {
        proposalId: "old-event-a",
        filter: "studyPeriod",
        reason: "Outside the confirmed period.",
      },
      {
        proposalId: "old-event-b",
        filter: "studyPeriod",
        reason: "Outside the confirmed period.",
      },
      {
        proposalId: "foreign-event",
        filter: "geography",
        reason: "Outside the confirmed geography.",
      },
    ],
    stoppingRule: {
      rule: "Stop when the declared bounded search is complete.",
      status: "met",
      note: "All declared queries completed.",
    },
    coverage: {
      status: "partial",
      proposalsReceived: 5,
      itemsRetained: 1,
      uniqueSourcesLocated: 2,
      reason: "A bounded, reproducible search was completed.",
    },
    outcomeValuesInspected: false,
  };
}

function createRound(
  requestType: Screen02SearchRound["requestType"],
  itemIdsRetained: string[],
  revision: number,
): Screen02SearchRound {
  return {
    id: `round-${revision}`,
    revision,
    requestType,
    exactRequest:
      requestType === "initial"
        ? "Open Screen 2."
        : "Only include government actions and rank energy events higher.",
    retrievedAt: "2026-07-30T12:00:00-05:00",
    searchProtocolVersion: SCREEN_02_SEARCH_PROTOCOL_VERSION,
    preferenceCriteriaIds:
      requestType === "initial"
        ? []
        : ["criterion-government", "criterion-energy"],
    proposalIdsReceived: ["proposal-a", "proposal-b"],
    itemIdsRetained,
    itemIdsAdded: itemIdsRetained,
    duplicateProposalIds: [],
    rejectedItemIds: [],
    assessedItemVersionIds: [],
    activeItemVersionIds: [],
    discovery: {
      formulaVersion: "screen-02-discovery-v1",
      query: "government energy regulation",
      rankings: itemIdsRetained.map((itemId, index) => ({
        proposalId: `proposal-${itemId}`,
        stableProposalId: `stable-${itemId}`,
        rank: index + 1,
        rankScore: 8.25 - index,
        matchedTerms: ["government", "energy"],
      })),
      clusters: [],
    },
    manifest: createManifest(),
  };
}

function createFindSession(initialOnly = false): Screen02Session {
  const first = createFindItem("candidate-a", "Clean Energy Rule");
  const second = createFindItem("candidate-b", "Grid Reliability Order");
  const initial = createRound("initial", [first.id], 1);
  const native = createRound("refine", [second.id], 2);
  const reviewed = createRound("refine", [second.id], 3);
  initial.stage = "initial";
  native.stage = "native-retrieval";
  reviewed.stage = "ai-review";
  reviewed.parentRoundId = native.id;
  reviewed.proposalIdsReceived = [second.id];
  reviewed.semanticDecisions = [
    {
      itemId: second.id,
      decision: "retained",
      criterionIds: ["criterion-government", "criterion-energy"],
      reason:
        "The host model retained this candidate after semantic review.",
    },
  ];
  const rounds = initialOnly
    ? [initial]
    : [initial, native, reviewed];
  return {
    schemaVersion: SCREEN_02_SESSION_SCHEMA_VERSION,
    sourceScreen: "screen-02",
    runId: "screen02-run-render",
    mode: "find",
    screen01Baseline: createBaseline(),
    screen01Fingerprint: "fnv1a64:baseline",
    revision: initialOnly ? 1 : 3,
    items: [first, second],
    selectedItemId: null,
    lockedChoice: null,
    searchManifest: rounds.at(-1)!.manifest,
    interaction: {
      preferences: {
        version: SCREEN_02_PREFERENCE_VERSION,
        criteria: [
          {
            id: "criterion-government",
            kind: "require",
            text: "Government actions",
            source: "ai-interpretation",
            exactRequest: "Only include government actions.",
          },
          {
            id: "criterion-energy",
            kind: "prefer",
            text: "Energy-sector events",
            source: "ai-interpretation",
            exactRequest: "Rank energy-sector events higher.",
          },
        ],
        requests: [],
      },
      preferenceAssessments: [
        {
          itemId: second.id,
          score: 80,
          matchedCriteriaIds: ["criterion-energy"],
          // An informational lexical mismatch must not disable choosing a
          // semantically retained candidate.
          unmetRequiredCriteriaIds: ["criterion-government"],
          reasons: ["The current search retained this result."],
          computedAtRevision: 3,
        },
      ],
      pendingRequest: null,
      interactionRequestHistory: [],
      itemVersions: [],
      searchRounds: rounds,
      rejections: [],
      selectionHistory: [],
      deferredQuestions: [],
      pendingScopeRevision: null,
      downstreamInvalidationCount: 0,
    },
  };
}

function makeLatestSemanticReviewIncomplete(session: Screen02Session) {
  const latest = session.interaction.searchRounds.at(-1);
  if (!latest?.parentRoundId) {
    throw new Error("The fixture does not contain a semantic child round.");
  }
  session.interaction.searchRounds.pop();
  const native = session.interaction.searchRounds.at(-1)!;
  session.revision = native.revision;
  session.searchManifest = native.manifest;
  session.selectedItemId = null;
  session.lockedChoice = null;
  return session;
}

function withCompactPreliminaryAssessment(
  session: Screen02Session,
  options: {
    itemId?: string;
    status?: "assessed" | "needs-retry";
    judgment?: "promising-to-verify" | "worth-exploring" | "low-priority" | "not-enough-evidence";
    studyFit?: string;
    affectedPopulation?: string | null;
    outcomeMechanism?: string | null;
    mainConcern?: string;
    nextChecks?: string[];
    evidenceSourceIds?: string[];
  } = {},
) {
  const rootRound = [...session.interaction.searchRounds]
    .reverse()
    .find((round) => round.stage === "native-retrieval");
  if (!rootRound) {
    throw new Error("The fixture does not contain a native search round.");
  }
  const rootIndex = session.interaction.searchRounds.findIndex(
    (round) => round.id === rootRound.id,
  );
  session.interaction.searchRounds = session.interaction.searchRounds.slice(
    0,
    rootIndex + 1,
  );
  const itemId = options.itemId ?? rootRound.itemIdsRetained[0]!;
  const item = session.items.find((candidate) => candidate.id === itemId);
  if (!item) throw new Error(`Unknown compact-assessment item: ${itemId}`);
  const status = options.status ?? "assessed";
  const revision = rootRound.revision + 1;
  const assessmentRound = createRound(
    rootRound.requestType,
    [...rootRound.itemIdsRetained],
    revision,
  );
  assessmentRound.stage = "preliminary-assessment";
  assessmentRound.assessmentParentRoundId = rootRound.id;
  assessmentRound.rootNativeRoundId = rootRound.id;
  assessmentRound.proposalIdsReceived = [];
  assessmentRound.itemIdsAdded = [];
  assessmentRound.assessmentResults = rootRound.itemIdsRetained.map(
    (candidateId) => ({
      itemId: candidateId,
      status:
        candidateId === itemId ? status : ("needs-retry" as const),
      reason:
        candidateId === itemId && status === "assessed"
          ? "Compact preliminary assessment recorded."
          : "Needs retry: no usable compact assessment was returned.",
    }),
  );
  delete assessmentRound.parentRoundId;
  delete assessmentRound.semanticDecisions;

  if (status === "assessed") {
    item.preliminaryAssessment = {
      schemaVersion: SCREEN_02_PRELIMINARY_ASSESSMENT_SCHEMA_VERSION,
      method: "ai-preliminary",
      judgment: options.judgment ?? "worth-exploring",
      studyFit:
        options.studyFit ??
        `${item.title} fits the confirmed regulation, place, and study-period criteria, with firm-level coverage still to verify.`,
      affectedPopulation:
        options.affectedPopulation === undefined
          ? `Organizations covered by ${item.title}'s eligibility rule.`
          : options.affectedPopulation,
      outcomeMechanism:
        options.outcomeMechanism === undefined
          ? `${item.title} may affect Profitability through compliance costs and operating changes.`
          : options.outcomeMechanism,
      mainConcern:
        options.mainConcern ??
        `The organization-level exposure rule for ${item.title} is not yet verified.`,
      nextChecks:
        options.nextChecks ?? [
          "Confirm the operative date.",
          "Map the eligibility rule to focal firms.",
        ],
      evidenceSourceIds:
        options.evidenceSourceIds ?? item.sources.map((source) => source.id),
      rootNativeRoundId: rootRound.id,
      assessedAtRevision: revision,
    };
  } else {
    delete item.preliminaryAssessment;
  }

  session.revision = revision;
  session.searchManifest = assessmentRound.manifest;
  session.interaction.searchRounds.push(assessmentRound);
  return session;
}

function createAuditSession(): Screen02Session {
  const findItem = createFindItem(
    "audit-eligibility",
    "California Consumer Privacy Act of 2018",
  );
  const auditItem: Screen02Item = {
    ...findItem,
    mode: "audit",
    kind: "representation",
    representationType: "whole-package",
    anchorShock: "California Consumer Privacy Act",
    candidateConstruct:
      "California Consumer Privacy Act: resolved event identity",
    operationalization:
      "Confirm the source-backed event identity before constructing exposure on Screen 3.",
  };
  const round = createRound("refine", [auditItem.id], 2);
  round.stage = "native-retrieval";
  round.manifest.channels.push({
    channel: "Coverage limitation · subnational-law",
    status: "not-searched",
    note:
      "State, local, and tribal legal sources require targeted host discovery.",
  });
  round.shockEvidence = {
    status: "shock-level-reconnaissance",
    anchorShock: "California Consumer Privacy Act",
    matchMethod: "exact-name-or-controlled-alias",
    proposalIds: ["registry-us-california-ccpa-2020"],
    candidateNames: ["California Consumer Privacy Act of 2018"],
    sources: auditItem.sources,
    provisionalDates: ["2018-06-28", "2020-01-01"],
    affectedPopulations: [
      "Qualifying businesses handling California consumers' personal information",
    ],
    note:
      "Exact-name evidence supports shock-level reconnaissance only.",
  };
  const session = createFindSession(true);
  return {
    ...session,
    mode: "audit",
    screen01Baseline: createBaseline("audit"),
    items: [auditItem],
    revision: 2,
    searchManifest: round.manifest,
    interaction: {
      ...session.interaction,
      searchRounds: [round],
    },
  };
}

function renderSession(
  session: Screen02Session,
  options: {
    reviewedItemId?: string | null;
    notice?: Screen02Notice | null;
    aiReviewAvailable?: boolean;
    expandCoverageAvailable?: boolean;
  } = {},
) {
  return renderToStaticMarkup(
    <Screen02
      session={session}
      hostView={hostView}
      researchNotice={options.notice ?? null}
      initialReviewedItemId={options.reviewedItemId}
      onSelect={() => undefined}
      onReject={() => undefined}
      onLock={() => undefined}
      onUnlock={() => undefined}
      onRequestSearch={() => undefined}
      onRequestAiReview={
        options.aiReviewAvailable === false ? undefined : () => undefined
      }
      onExpandCoverage={
        options.expandCoverageAvailable ? () => undefined : undefined
      }
      onBack={() => undefined}
      onReset={() => undefined}
      onRequestFullscreen={() => undefined}
    />,
  );
}

describe("Screen 2 researcher-facing workflow", () => {
  it("uses only the three currently visible optional criteria", () => {
    expect(
      collectVisiblePreferenceDrafts({
        require: "  national government actions ",
        prefer: "energy sector",
        avoid: "   ",
      }),
    ).toStrictEqual([
      { kind: "require", text: "national government actions" },
      { kind: "prefer", text: "energy sector" },
    ]);

    expect(
      buildScreen02InteractiveSearchRequest(
        "find",
        "find-more",
        { require: "", prefer: "", avoid: "" },
      ),
    ).toMatchObject({
      requestType: "find-more",
      criteria: [],
      hadExplanation: false,
    });

    expect(
      buildScreen02InteractiveSearchRequest(
        "find",
        "find-more",
        {
          require: "is natural disaster",
          prefer: "",
          avoid: "finance-related",
        },
      ),
    ).toMatchObject({
      requestType: "refine",
      criteria: [
        { kind: "require", text: "is natural disaster" },
        { kind: "avoid", text: "finance-related" },
      ],
      hadExplanation: false,
    });
  });

  it("shows only the latest completed search round, never the cumulative ledger", () => {
    const initial = createFindSession(true);
    const searched = createFindSession();
    expect(currentVisibleScreen02Items(initial)).toStrictEqual([]);
    expect(
      currentVisibleScreen02Items(searched).map((item) => item.title),
    ).toStrictEqual(["Grid Reliability Order"]);
  });

  it("renders the AI child order even when the cumulative item ledger has a different order", () => {
    const session = createFindSession();
    const reviewed = session.interaction.searchRounds.at(-1)!;
    reviewed.proposalIdsReceived = ["candidate-b", "candidate-a"];
    reviewed.itemIdsRetained = ["candidate-b", "candidate-a"];
    reviewed.itemIdsAdded = ["candidate-a"];

    expect(session.items.map((item) => item.id)).toStrictEqual([
      "candidate-a",
      "candidate-b",
    ]);
    expect(
      currentVisibleScreen02Items(session).map((item) => item.id),
    ).toStrictEqual(["candidate-b", "candidate-a"]);

    const html = renderSession(session);
    const listStart = html.indexOf('<ol class="s2-result-list">');
    const listEnd = html.indexOf("</ol>", listStart);
    const resultList = html.slice(listStart, listEnd);
    expect(resultList.indexOf("Grid Reliability Order")).toBeLessThan(
      resultList.indexOf("Clean Energy Rule"),
    );
  });

  it("groups a native round and its AI child as one logical search", () => {
    const session = createFindSession();
    expect(logicalScreen02Searches(session)).toHaveLength(1);
    expect(renderSession(session)).not.toContain(
      "Earlier searches and decisions",
    );

    const nextNative = createRound("find-more", ["candidate-a"], 4);
    nextNative.stage = "native-retrieval";
    session.interaction.searchRounds.push(nextNative);
    expect(logicalScreen02Searches(session)).toHaveLength(2);
    expect(renderSession(session)).toContain(
      "Earlier searches and decisions",
    );
  });

  it("groups a native round and its compact assessment as one logical search", () => {
    const session = withCompactPreliminaryAssessment(createFindSession());
    expect(logicalScreen02Searches(session)).toHaveLength(1);
    expect(
      logicalScreen02Searches(session)[0]?.resultRound.stage,
    ).toBe("preliminary-assessment");
    expect(renderSession(session)).not.toContain(
      "Earlier searches and decisions",
    );
  });

  it("derives transparent ordinal assessment labels without exposing scores", () => {
    const item = createFindItem("assessment", "Energy Efficiency Standard");
    const triage = candidateTriageForScreen02Item(item);
    expect(triage.fit.judgment).toBe("Conditional fit");
    expect(triage.outcome.judgment).toBe("Source-anchored pathway");
    expect(triage.feasibility.judgment).toBe(
      "Worth investigating",
    );
    expect(triage.technicalPoints.map((point) => point.basis)).toEqual(
      expect.arrayContaining([
        "Recorded metadata",
        "Preliminary AI inference",
      ]),
    );
    expect(
      triage.technicalPoints.find((point) => point.id === "externality"),
    ).toMatchObject({
      judgment: "Plausible",
      basis: "Preliminary AI inference",
    });
    expect(triage).not.toHaveProperty("overall");

    const geographyFilter = item.hardFilters.find(
      (filter) => filter.key === "geography",
    )!;
    geographyFilter.status = "review";
    geographyFilter.reason =
      "The issuing geography still needs candidate-specific verification.";
    expect(candidateTriageForScreen02Item(item).feasibility.judgment).toBe(
      "Needs targeted checking",
    );
    geographyFilter.status = "pass";
    geographyFilter.reason = "The event matches the confirmed geography.";

    item.scorecard.componentDetails.variation =
      detail("system-computed", "limited-comparison");
    expect(candidateTriageForScreen02Item(item)).toMatchObject({
      aiEnriched: true,
      feasibility: { judgment: "Needs targeted checking" },
    });

    item.scorecard.componentDetails.exposureObservability =
      detail("system-computed", "observable");
    item.scorecard.componentDetails.timeSupport =
      detail("system-computed", "adequate");
    expect(candidateTriageForScreen02Item(item, false)).toMatchObject({
      aiEnriched: false,
      fit: { judgment: "Possible industry fit" },
      outcome: { judgment: "Unassessed pathway lead" },
      feasibility: {
        judgment: "Factual lead to investigate",
        basis: "Recorded metadata",
      },
    });
  });

  it("calibrates technical scope to candidate-population applicability", () => {
    const known = createFindItem(
      "population-known",
      "Console Efficiency Threshold",
    );
    const knownView = candidateTriageForScreen02Item(
      known,
      true,
      "Profitability",
    );
    expect(knownView.fit.judgment).toBe("Conditional fit");
    expect(
      knownView.technicalPoints.find((point) => point.id === "scope"),
    ).toMatchObject({
      judgment: "Conditional match",
      basis: "Preliminary AI inference",
    });
    expect(
      knownView.technicalPoints.find((point) => point.id === "scope")
        ?.explanation,
    ).toContain("Firm-level applicability requires closer review");
    expect(
      knownView.technicalPoints.find((point) => point.id === "scope")
        ?.explanation,
    ).toContain("documents conditional coverage");

    known.populationApplicability = {
      ...known.populationApplicability!,
      category: "documented-direct",
      reason:
        "Console Efficiency Threshold directly documents coverage of the focal public gaming firms.",
      unresolved: [],
    };
    expect(
      candidateTriageForScreen02Item(known).technicalPoints.find(
        (point) => point.id === "scope",
      ),
    ).toMatchObject({
      judgment: "Clear match",
      basis: "Preliminary AI inference",
    });

    known.populationApplicability = {
      ...known.populationApplicability,
      category: "plausible-indirect",
      reason:
        "Console Efficiency Threshold may reach publishers only indirectly through covered console platforms.",
      unresolved: [
        "Trace platform obligations to publisher-level exposure.",
      ],
    };
    const indirectView = candidateTriageForScreen02Item(known);
    expect(indirectView.fit.judgment).toBe("Conditional fit");
    expect(
      indirectView.technicalPoints.find((point) => point.id === "scope"),
    ).toMatchObject({ judgment: "Conditional match" });
    expect(
      indirectView.technicalPoints.find((point) => point.id === "scope")
        ?.judgment,
    ).not.toBe("Clear match");

    known.populationApplicability = {
      ...known.populationApplicability,
      category: "unlikely",
      reason:
        "Console Efficiency Threshold does not appear to cover the focal publishers.",
      unresolved: ["Confirm whether any focal publisher is directly covered."],
    };
    const unlikelyView = candidateTriageForScreen02Item(known);
    expect(unlikelyView.fit.judgment).toBe("Weak population fit");
    expect(
      unlikelyView.technicalPoints.find((point) => point.id === "scope"),
    ).toMatchObject({ judgment: "Mismatch" });
    expect(
      unlikelyView.technicalPoints.find((point) => point.id === "scope")
        ?.judgment,
    ).not.toBe("Clear match");

    known.populationApplicability = {
      ...known.populationApplicability!,
      category: "unknown",
      evidenceSourceIds: [],
      reason:
        "Console Efficiency Threshold does not establish which public gaming firms own models covered by the efficiency cutoff.",
      unresolved: [
        "Map covered console models and threshold exemptions to public gaming-firm owners.",
      ],
    };
    const unknownView = candidateTriageForScreen02Item(
      known,
      true,
      "Profitability",
    );
    expect(unknownView.fit.judgment).toBe(
      "Population fit unresolved",
    );
    expect(unknownView.fit.judgment).not.toBe("Clear fit");
    expect(unknownView.feasibility.judgment).toBe(
      "Needs targeted checking",
    );
    expect(
      unknownView.technicalPoints.find((point) => point.id === "scope"),
    ).toMatchObject({
      judgment: "Unresolved match",
      basis: "Preliminary AI inference",
    });
  });

  it("adapts a legacy six-dimension review into the concise card", () => {
    const session = createFindSession();
    const item = session.items.find(
      (candidate) => candidate.id === "candidate-b",
    )!;

    item.populationApplicability = {
      ...item.populationApplicability!,
      category: "documented-direct",
      reason:
        "Grid Reliability Order directly documents coverage of the focal firms.",
      unresolved: [],
    };
    const html = renderSession(session, {
      reviewedItemId: item.id,
    });
    expect(html).toContain('data-testid="screen02-preliminary-judgment"');
    expect(html).toContain('data-testid="screen02-study-fit"');
    expect(html).toContain('data-testid="screen02-affected-population"');
    expect(html).toContain('data-testid="screen02-outcome-pathway"');
    expect(html).toContain('data-testid="screen02-main-concern"');
    expect(html).toContain('data-testid="screen02-next-checks"');
    expect(html).toContain('data-testid="screen02-evidence-basis"');
    expect(html).toContain(
      "Grid Reliability Order directly documents coverage of the focal firms.",
    );
    expect(html).not.toContain("Current assessment ·");
    expect(html).not.toContain("Methodological details");
    expect(html).not.toContain("Recorded metadata");
    expect(html).not.toContain("Preliminary AI inference");
  });

  it("bands fully assessed feasibility from overall and weakest component scores", () => {
    const setScores = (
      item: Screen02FindItem,
      overall: number,
      exposure: number,
      timing: number,
      variation: number,
    ) => {
      item.scorecard.overall = overall;
      item.scorecard.overallRange = {
        minimum: overall,
        maximum: overall,
      };
      item.scorecard.components.exposureObservability = exposure;
      item.scorecard.components.timeSupport = timing;
      item.scorecard.components.variation = variation;
    };

    const strong = createFindItem("band-strong", "Strong Evidence Rule");
    setScores(strong, 82, 78, 80, 74);
    expect(
      candidateTriageForScreen02Item(strong).feasibility.judgment,
    ).toBe("Strong preliminary feasibility");

    const promising = createFindItem(
      "band-promising",
      "Promising Evidence Rule",
    );
    setScores(promising, 67, 64, 61, 57);
    expect(
      candidateTriageForScreen02Item(promising).feasibility.judgment,
    ).toBe("Worth investigating");

    const caveat = createFindItem("band-caveat", "Caveated Evidence Rule");
    setScores(caveat, 58, 54, 52, 48);
    expect(
      candidateTriageForScreen02Item(caveat).feasibility.judgment,
    ).toBe("Material feasibility caveats");

    const sameEvidence = createFindItem(
      "band-caveat-twin",
      "Second Caveated Evidence Rule",
    );
    setScores(sameEvidence, 58, 54, 52, 48);
    expect(
      candidateTriageForScreen02Item(sameEvidence).feasibility.judgment,
    ).toBe("Material feasibility caveats");
  });

  it("uses the highest-weight unknown score dimension as the principal bottleneck", () => {
    const unresolved = createFindItem(
      "unknown-bottleneck",
      "Threshold Reporting Rule",
    );
    unresolved.scorecard.components.exposureObservability = null;
    unresolved.scorecard.componentDetails.exposureObservability = {
      ...detail("ai-rubric", "unknown"),
      reason:
        "Threshold Reporting Rule does not identify entity-level exposure in the attached record.",
      unresolved: ["Verification is required."],
    };
    unresolved.scorecard.components.variation = null;
    unresolved.scorecard.componentDetails.variation = {
      ...detail("ai-rubric", "unknown"),
      reason: "Comparison variation is not documented.",
      unresolved: [
        "Map the threshold to treated and untreated organizations.",
      ],
    };

    const reasonFallback = candidateTriageForScreen02Item(unresolved);
    expect(reasonFallback.feasibility.judgment).toBe(
      "Needs targeted checking",
    );
    expect(reasonFallback.feasibility.explanation).toContain(
      "Exposure-rule clarity remains unresolved: Threshold Reporting Rule does not identify entity-level exposure",
    );
    expect(reasonFallback.feasibility.explanation).not.toContain(
      "Verify candidate-specific thresholds and exemptions",
    );

    unresolved.scorecard.componentDetails.exposureObservability = {
      ...unresolved.scorecard.componentDetails.exposureObservability,
      unresolved: [
        "Link the reporting threshold to each focal organization.",
      ],
    };
    const explicitDetail = candidateTriageForScreen02Item(unresolved);
    expect(explicitDetail.feasibility.explanation).toContain(
      "Exposure-rule clarity remains unresolved: Link the reporting threshold to each focal organization.",
    );
  });

  it("maps outcome-pathway evidence categories to distinct feasibility guidance", () => {
    const conditional = createFindItem(
      "pathway-conditional",
      "Marketplace Refund Directive",
    );
    conditional.outcomePathway = {
      ...conditional.outcomePathway!,
      category: "conditional-or-indirect",
      reason:
        "Marketplace Refund Directive may influence Profitability indirectly through platform refund expectations and seller-interface redesign.",
    };
    expect(
      candidateTriageForScreen02Item(conditional, true, "Profitability")
        .outcome.judgment,
    ).toBe("Conditional or indirect pathway");

    const unclear = createFindItem(
      "pathway-unclear",
      "Age Assurance Standard",
    );
    unclear.outcomePathway = {
      ...unclear.outcomePathway!,
      category: "unclear",
      reason:
        "Age Assurance Standard identifies design duties, but their relationship to Profitability is not established by the attached record.",
      unresolved: [
        "Trace age-assurance engineering and consent-system costs into firm-level Profitability records.",
      ],
    };
    const unclearView = candidateTriageForScreen02Item(
      unclear,
      true,
      "Profitability",
    );
    expect(unclearView.outcome.judgment).toBe(
      "Pathway remains unclear",
    );
    expect(unclearView.feasibility.judgment).toBe(
      "Needs targeted checking",
    );
    expect(unclearView.feasibility.explanation).toContain(
      "Trace age-assurance engineering",
    );

    const unlikely = createFindItem(
      "pathway-unlikely",
      "Voluntary Interface Guidance",
    );
    unlikely.outcomePathway = {
      ...unlikely.outcomePathway!,
      category: "unlikely",
      reason:
        "Voluntary Interface Guidance contains no binding design duty that would plausibly transmit into firm Profitability.",
    };
    const unlikelyView = candidateTriageForScreen02Item(
      unlikely,
      true,
      "Profitability",
    );
    expect(unlikelyView.outcome.judgment).toBe(
      "Pathway appears unlikely",
    );
    expect(unlikelyView.feasibility.judgment).toBe("Weak lead");
    expect(unlikelyView.feasibility.explanation).toContain(
      "contains no binding design duty",
    );

    const session = createFindSession();
    const detailItem = session.items[1]!;
    detailItem.title = unclear.title;
    detailItem.description = unclear.description;
    detailItem.outcomePathway = unclear.outcomePathway;
    detailItem.outcomeLink = unclear.outcomeLink;
    detailItem.sources[0]!.title =
      "Official record for Age Assurance Standard";
    const detailsHtml = renderSession(session, {
      reviewedItemId: detailItem.id,
    });
    expect(detailsHtml).toContain('data-testid="screen02-study-fit"');
    expect(detailsHtml).toContain('data-testid="screen02-outcome-pathway"');
    expect(detailsHtml).toContain("How it may affect Profitability");
    expect(detailsHtml).toContain("Age Assurance Standard identifies");
    expect(detailsHtml).toContain("Trace age-assurance engineering");
    expect(detailsHtml).toContain(
      "Official record for Age Assurance Standard",
    );
    expect(detailsHtml).not.toContain("Outcome-pathway evidence");
    expect(detailsHtml).not.toContain("Population applicability");
  });

  it("keeps the Screen 1 study population separate from candidate-specific coverage evidence", () => {
    const item = createFindItem(
      "console-coverage",
      "Console Energy Labeling Requirements",
    );
    item.affectedPopulation =
      "Console manufacturers subject to the labeling threshold";
    item.populationApplicability = {
      ...item.populationApplicability!,
      category: "documented-conditional",
      sourceEstablishedPopulation: {
        text:
          "Console manufacturers whose covered models exceed the rule's energy-use threshold",
        evidenceSourceIds: [item.sources[0]!.id],
      },
      reason:
        "Console Energy Labeling Requirements document coverage conditional on console type and energy-use thresholds.",
      unresolved: [
        "Verify which public video-gaming firms manufacture covered console models.",
      ],
    };

    const nativeView = candidateTriageForScreen02Item(
      item,
      false,
      "Innovation",
      { studyPopulation: "Public video-gaming firms" },
    );
    expect(nativeView.evidence).toMatchObject({
      studyPopulation: "Public video-gaming firms",
      candidateApplicabilityBasis: "Verification needed",
    });
    expect(nativeView.evidence.sourceEstablishedPopulation).toContain(
      "Not established by the current cited sources",
    );
    expect(nativeView.evidence.candidateApplicability).toContain(
      "Not established from the current record",
    );
    expect(nativeView.evidence.candidateApplicability).not.toContain(
      "Public video-gaming firms are covered",
    );

    const assessedView = candidateTriageForScreen02Item(
      item,
      true,
      "Innovation",
      { studyPopulation: "Public video-gaming firms" },
    );
    expect(assessedView.evidence).toMatchObject({
      studyPopulation: "Public video-gaming firms",
      sourceEstablishedPopulation:
        "Console manufacturers whose covered models exceed the rule's energy-use threshold",
      sourceEstablishedPopulationEvidenceTitles: [
        "Official record for Console Energy Labeling Requirements",
      ],
      candidateApplicabilityBasis: "Preliminary AI inference",
    });
    expect(assessedView.evidence.candidateApplicability).toContain(
      "Conditional coverage documented",
    );
    expect(assessedView.evidence.candidateApplicability).toContain(
      "console type and energy-use thresholds",
    );
  });

  it("renders objective facts plus the compact five-part assessment without duplicating the study population", () => {
    const session = withCompactPreliminaryAssessment(createFindSession(), {
      studyFit:
        "The rule falls within the confirmed regulation, geography, and study-period criteria.",
      affectedPopulation:
        "Console manufacturers whose covered models exceed the energy-use threshold.",
      outcomeMechanism:
        "The Console Energy Labeling Requirements may affect Profitability through compliance costs and product redesign.",
      mainConcern:
        "Publisher-only firms require a separate ownership linkage.",
    });
    const item = session.items.find(
      (candidate) => candidate.id === "candidate-b",
    )!;

    const html = renderSession(session, { reviewedItemId: item.id });
    expect(html).toContain("Date or timing lead");
    expect(html).toContain("Geography");
    expect(html).toContain("Event or match type");
    expect(html).toContain("Documentation");
    expect(html).toContain('data-testid="screen02-study-fit"');
    expect(html).toContain('data-testid="screen02-affected-population"');
    expect(html).toContain(
      "Console manufacturers whose covered models exceed the energy-use threshold.",
    );
    expect(html).toContain(
      "Publisher-only firms require a separate ownership linkage.",
    );
    expect(html).not.toContain("Screen 1 target population");
    expect(html).not.toContain("Population described by cited sources");
    expect(html).not.toContain("Applicability to the Screen 1 target");
    expect(html).not.toContain("Why it may be useful");
  });

  it("renders nullable compact population and outcome fields as honest evidence gaps", () => {
    const session = withCompactPreliminaryAssessment(createFindSession(), {
      judgment: "not-enough-evidence",
      affectedPopulation: null,
      outcomeMechanism: null,
      evidenceSourceIds: [],
    });
    const item = session.items.find(
      (candidate) => candidate.id === "candidate-b",
    )!;

    const html = renderSession(session, { reviewedItemId: item.id });
    expect(html).toContain(
      "Current sources do not yet establish which organizations are affected.",
    );
    expect(html).toContain(
      "Current evidence does not yet support a candidate-specific pathway to Profitability.",
    );
    expect(html).toContain("Not enough evidence");
    expect(html).toContain('data-testid="screen02-affected-population"');
    expect(html).toContain('data-testid="screen02-outcome-pathway"');
    expect(html).not.toContain('data-testid="screen02-assessment-neutral"');
  });

  it("removes the separate usefulness and variable panels while preserving factual cards", () => {
    const session = createFindSession();
    const item = session.items.find(
      (candidate) => candidate.id === "candidate-b",
    )!;
    item.reasons = [];

    const html = renderSession(session, { reviewedItemId: item.id });
    expect(html).toContain("Date or timing lead");
    expect(html).toContain("Located sources");
    expect(html).toContain('data-testid="screen02-study-fit"');
    expect(html).not.toContain("Variables to investigate");
    expect(html).not.toContain("Why it may be useful");
    expect(html).not.toContain("Early reasons to investigate");
    expect(html).not.toContain("s2-detail-columns");
  });

  it("keeps usefulness provenance internal instead of rendering a separate box", () => {
    const session = createFindSession();
    const item = session.items.find(
      (candidate) => candidate.id === "candidate-b",
    )!;
    const candidateReason =
      "Grid Reliability Order identifies a reserve-margin scheduling rule that may create a focused operational setting for studying Innovation.";
    const nativeReasons = [
      "The official API returned this regulatory-document record for the encoded query and publication-date window.",
      "The connector inspected event metadata only and did not inspect outcome values.",
    ];
    item.reasons = [candidateReason, ...nativeReasons];
    const reviewRound = session.interaction.searchRounds.at(-1)!;
    const parentRound = session.interaction.searchRounds.find(
      (round) => round.id === reviewRound.parentRoundId,
    )!;
    const parentItem = JSON.parse(JSON.stringify(item)) as Screen02Item;
    parentItem.reasons = [...nativeReasons];
    parentRound.activeItemVersionIds = ["native-candidate-b-version"];
    session.interaction.itemVersions = [
      {
        versionId: "native-candidate-b-version",
        itemId: item.id,
        itemFingerprint: "fnv1a64:native-candidate-b",
        recordedAtRevision: parentRound.revision,
        item: parentItem,
      },
    ];

    expect(screen02WhyUsefulReasons(session, item)).toEqual([
      candidateReason,
    ]);
    const html = renderSession(session, { reviewedItemId: item.id });
    expect(html).not.toContain(candidateReason);
    expect(html).not.toContain(nativeReasons[0]);
    expect(html).not.toContain(nativeReasons[1]);
    expect(html).not.toContain("Why it may be useful");
  });

  it("uses a compact two-column assessment grid without the obsolete detail tracks", () => {
    const css = readFileSync(
      new URL(
        "../../src/ui/screen-02/screen-02.css",
        import.meta.url,
      ),
      "utf8",
    );
    const assessmentGrid = css.match(
      /\.s2-assessment-brief-grid\s*\{([^}]*)\}/,
    )?.[1];
    expect(assessmentGrid).toContain(
      "grid-template-columns: repeat(2, minmax(0, 1fr))",
    );
    expect(assessmentGrid).not.toContain("repeat(3");
    expect(css).not.toContain(".s2-detail-columns");
    expect(css).not.toContain(".s2-primary-judgment-grid");
    expect(css).not.toContain(".s2-assessment-grid");
  });

  it("uses evidence-specific explanations while allowing equal ordinal categories", () => {
    const accessibility = createFindItem(
      "accessibility-standard",
      "Interactive Entertainment Accessibility Standards",
    );
    accessibility.populationApplicability = {
      ...accessibility.populationApplicability!,
      reason:
        "Interactive Entertainment Accessibility Standards condition coverage on product and platform accessibility duties.",
      unresolved: [
        "Verify which publishers and platform operators have covered products.",
      ],
    };
    accessibility.outcomeLink = {
      text:
        "Interactive Entertainment Accessibility Standards could redirect engineering effort toward accessible interfaces and reusable design capabilities that shape innovation.",
      status: "ai-hypothesis",
    };

    const privacy = createFindItem(
      "privacy-safeguards",
      "Game Software Privacy Safeguards",
    );
    privacy.populationApplicability = {
      ...privacy.populationApplicability!,
      reason:
        "Game Software Privacy Safeguards condition coverage on firms processing player accounts and profile data.",
      unresolved: [
        "Verify which publishers process the regulated account and profile fields.",
      ],
    };
    privacy.outcomeLink = {
      text:
        "Game Software Privacy Safeguards could change data-governance costs and permissible experimentation with player profiles, shaping innovation.",
      status: "ai-hypothesis",
    };

    const accessibilityView = candidateTriageForScreen02Item(
      accessibility,
      true,
      "Innovation",
    );
    const privacyView = candidateTriageForScreen02Item(
      privacy,
      true,
      "Innovation",
    );
    expect({
      fit: accessibilityView.fit.judgment,
      outcome: accessibilityView.outcome.judgment,
      feasibility: accessibilityView.feasibility.judgment,
    }).toEqual({
      fit: privacyView.fit.judgment,
      outcome: privacyView.outcome.judgment,
      feasibility: privacyView.feasibility.judgment,
    });
    expect(accessibilityView.fit.explanation).toContain(
      "product and platform accessibility duties",
    );
    expect(privacyView.fit.explanation).toContain(
      "player accounts and profile data",
    );
    expect(accessibilityView.outcome.explanation).toContain(
      "accessible interfaces",
    );
    expect(privacyView.outcome.explanation).toContain(
      "data-governance costs",
    );
    expect(accessibilityView.outcome.explanation).not.toBe(
      privacyView.outcome.explanation,
    );

    const weakCoverage = createFindItem(
      "voluntary-guidance",
      "Voluntary Gaming Guidance",
    );
    weakCoverage.populationApplicability = {
      ...weakCoverage.populationApplicability!,
      category: "unlikely",
      reason:
        "Voluntary Gaming Guidance does not document a coverage rule reaching the focal public firms.",
      unresolved: [
        "Determine whether any focal organization adopted the voluntary guidance.",
      ],
    };
    weakCoverage.externalShockPlausibility = {
      ...weakCoverage.externalShockPlausibility!,
      category: "major-concern",
      reason:
        "Voluntary Gaming Guidance may be selected by firms already changing their innovation strategy.",
    };
    const weakView = candidateTriageForScreen02Item(
      weakCoverage,
      true,
      "Innovation",
    );
    expect(weakView.fit.judgment).toBe("Weak population fit");
    expect(weakView.feasibility.judgment).toBe("Weak lead");
    expect(weakView.feasibility.explanation).toContain(
      "selected by firms already changing their innovation strategy",
    );
  });

  it("renders distinct evidence-backed assessments for realistic candidate shocks", () => {
    const privacy = createFindItem(
      "privacy-safeguards",
      "Game Software Privacy Safeguards",
    );
    privacy.description =
      "The official record covers services processing player accounts and profiles and identifies service-level privacy notices for ownership linkage.";
    privacy.sources[0]!.title =
      "Official privacy-safeguards record for player accounts and profiles";
    privacy.populationApplicability = {
      ...privacy.populationApplicability!,
      sourceEstablishedPopulation: {
        text: "Services processing player accounts and profile data",
        evidenceSourceIds: [privacy.sources[0]!.id],
      },
      reason:
        "The privacy-safeguards record conditionally covers firms that process player accounts and profile data, rather than every video-gaming firm.",
    };
    privacy.outcomePathway = {
      ...privacy.outcomePathway!,
      reason:
        "Player-account safeguards can constrain data-governance and personalization experiments, providing a source-anchored pathway to Innovation.",
    };
    privacy.outcomeLink = {
      status: "ai-hypothesis",
      text:
        "Player-account safeguards may redirect data-governance and personalization experiments toward different forms of Innovation.",
    };
    privacy.reasons = [
      "The player-account safeguards offer a focused setting for studying how data-governance constraints redirect personalization Innovation.",
    ];

    const accessibility = createFindItem(
      "accessibility-standard",
      "Interactive Entertainment Accessibility Standards",
    );
    accessibility.description =
      "The official record covers accessible controls and reusable interface capabilities in interactive entertainment products.";
    accessibility.sources[0]!.title =
      "Official accessibility record for accessible controls and interfaces";
    accessibility.populationApplicability = {
      ...accessibility.populationApplicability!,
      category: "plausible-indirect",
      sourceEstablishedPopulation: {
        text: "Operators of covered interactive entertainment products",
        evidenceSourceIds: [accessibility.sources[0]!.id],
      },
      reason:
        "The accessibility record reaches covered product and platform operators directly, while developer and publisher exposure depends on product-role linkage.",
    };
    accessibility.outcomePathway = {
      ...accessibility.outcomePathway!,
      category: "conditional-or-indirect",
      reason:
        "Accessible controls and reusable interface capabilities may redirect engineering effort and create a conditional pathway to Innovation.",
    };
    accessibility.outcomeLink = {
      status: "ai-hypothesis",
      text:
        "Accessible controls and reusable interface capabilities may redirect product-design effort toward different forms of Innovation.",
    };
    accessibility.scorecard.components.timeSupport = 25;
    accessibility.scorecard.componentDetails.timeSupport = {
      ...detail("ai-rubric", "weak", [accessibility.sources[0]!.id]),
      reason:
        "The 2014 publication lead leaves no full annual pre-period inside the 2014–2016 study window.",
      unresolved: [
        "Confirm the operative accessibility compliance date and implementation phases.",
      ],
    };
    accessibility.reasons = [
      "The accessible-controls standard isolates reusable design obligations that may redirect product-development Innovation.",
    ];

    const disclosure = createFindItem(
      "consumer-disclosure",
      "Video Game Consumer Disclosure Rule",
    );
    disclosure.description =
      "The official record identifies software and downloadable-content notices but not obligated sellers or product-to-firm linkage.";
    disclosure.sources[0]!.title =
      "Official consumer-disclosure record for downloadable content";
    disclosure.externalShockPlausibility = {
      ...disclosure.externalShockPlausibility!,
      category: "unknown",
      evidenceSourceIds: [],
      reason:
        "The consumer-disclosure record does not resolve whether regulator initiative or publisher conduct produced the action.",
      unresolved: [
        "Trace the rulemaking record for regulator initiation and industry petitions.",
      ],
    };
    disclosure.populationApplicability = {
      ...disclosure.populationApplicability!,
      category: "unknown",
      sourceEstablishedPopulation: null,
      evidenceSourceIds: [],
      reason:
        "The disclosure record names software and downloadable content without establishing which sellers, publishers, or storefront operators are covered.",
      unresolved: [
        "Identify obligated sellers and map downloadable products to focal firms.",
      ],
    };
    disclosure.outcomePathway = {
      ...disclosure.outcomePathway!,
      category: "conditional-or-indirect",
      reason:
        "Downloadable-content notices may redirect storefront information design and monetization experiments, creating a conditional pathway to Innovation.",
    };
    disclosure.outcomeLink = {
      status: "ai-hypothesis",
      text:
        "Downloadable-content notices may redirect storefront information and monetization experiments toward different forms of Innovation.",
    };
    for (const component of [
      "exposureObservability",
      "timeSupport",
      "variation",
    ] as const) {
      disclosure.scorecard.components[component] = null;
      disclosure.scorecard.componentDetails[component] = {
        ...detail("ai-rubric", "unknown"),
        reason: `${disclosure.title} does not establish the candidate-specific ${component} fact needed for design triage.`,
        unresolved: [
          `Verify ${component} for the downloadable-content notice using product-level records.`,
        ],
      };
    }
    disclosure.reasons = [
      "The downloadable-content notice offers a focused setting for studying storefront information and monetization Innovation.",
    ];

    const session = createFindSession();
    session.screen01Baseline = {
      ...session.screen01Baseline,
      scopeContract: {
        ...session.screen01Baseline.scopeContract,
        population: "Public video-gaming firms",
        industry: "Video gaming",
        studyPeriod: "2014–2016",
        outcomeFamily: "Innovation",
      },
    };
    session.items = [disclosure, privacy, accessibility];
    const parent = session.interaction.searchRounds.at(-2)!;
    const review = session.interaction.searchRounds.at(-1)!;
    const candidateIds = session.items.map((item) => item.id);
    parent.itemIdsRetained = [...candidateIds];
    parent.proposalIdsReceived = [...candidateIds];
    review.itemIdsRetained = [...candidateIds];
    review.proposalIdsReceived = [...candidateIds];
    review.semanticDecisions = candidateIds.map((itemId) => ({
      itemId,
      decision: "retained" as const,
      criterionIds: ["criterion-government", "criterion-energy"],
      reason: `Comparative review retained ${itemId} using its candidate-specific source record.`,
    }));

    const listHtml = renderSession(session);
    expect(listHtml).toContain("Worth exploring");
    expect(listHtml).toContain("Low priority");
    expect(listHtml).not.toContain("Partial evidence");
    expect(listHtml).not.toContain("Possible but needs checking");

    const visibleDetails = session.items.map((item) => ({
      item,
      html: renderSession(session, { reviewedItemId: item.id }),
    }));
    expect(
      new Set(
        visibleDetails.map(({ item }) =>
          candidateTriageForScreen02Item(
            item,
            true,
            "Innovation",
          ).evidence.sourceEstablishedPopulation.trim(),
        ),
    ).size,
    ).toBe(3);
    expect(visibleDetails[0]!.html).toContain(
      "Current sources do not yet establish which organizations are affected.",
    );
    expect(visibleDetails[1]!.html).toContain(
      "Services processing player accounts and profile data",
    );
    expect(visibleDetails[2]!.html).toContain(
      "Operators of covered interactive entertainment products",
    );
    expect(visibleDetails[0]!.html).toContain(
      "Downloadable-content notices may redirect storefront information",
    );
    expect(visibleDetails[1]!.html).toContain(
      "Player-account safeguards may redirect data-governance",
    );
    expect(visibleDetails[2]!.html).toContain(
      "Accessible controls and reusable interface capabilities",
    );
    for (const { html } of visibleDetails) {
      expect(html).toContain('data-testid="screen02-study-fit"');
      expect(html).toContain('data-testid="screen02-main-concern"');
      expect(html).not.toContain("Why it may be useful");
      expect(html).not.toContain("Methodological details");
    }
  });

  it("adapts an unresolved legacy dimension into one concise concern and next checks", () => {
    const session = createFindSession();
    const item = session.items[1]!;
    item.scorecard.components.variation = null;
    item.scorecard.componentDetails.variation = detail(
      "ai-rubric",
      "unknown",
      ["source-candidate-b"],
    );

    expect(screen02HasCompletedAiReview(session)).toBe(true);
    const triage = candidateTriageForScreen02Item(item);
    expect(triage).toMatchObject({
      aiEnriched: true,
      feasibility: {
        judgment: "Needs targeted checking",
        basis: "Preliminary AI inference",
      },
    });
    expect(
      triage.technicalPoints.find((point) => point.id === "variation"),
    ).toMatchObject({
      judgment: "Needs verification",
      basis: "Preliminary AI inference",
      evidenceTitles: ["Official record for Grid Reliability Order"],
    });

    const html = renderSession(session, {
      reviewedItemId: item.id,
    });
    expect(html).toContain("Worth exploring");
    expect(html).toContain('data-testid="screen02-main-concern"');
    expect(html).toContain('data-testid="screen02-next-checks"');
    expect(html).toContain("What to check next");
    expect(html).not.toContain("Methodological details");
    expect(html).not.toContain("Variation for identification");
    expect(html).not.toContain("Not enough information");
    expect(html).not.toContain("3 of 4 are complete");
    expect(html).not.toContain(
      "A complete preliminary AI view requires all four interpretive dimensions",
    );
  });

  it("shows one neutral assessment status when a legacy review is incomplete", () => {
    const session = createFindSession();
    const item = session.items[1]!;
    item.scorecard.componentDetails.variation =
      detail("system-computed", "limited-comparison");
    const html = renderSession(session, {
      reviewedItemId: item.id,
    });
    expect(html).toContain('data-testid="screen02-assessment-neutral"');
    expect(html).toContain("Preliminary assessment not completed");
    expect(html).toContain(
      "Criteria recorded — assessment not completed",
    );
    expect(html).toContain("Retry preliminary assessment");
    expect(html.match(/Preliminary assessment not completed/g)).toHaveLength(1);
    expect(html).not.toContain("Assessment unavailable");
  });

  it("opens Find mode blank, with intuitive labels and an accessible reset", () => {
    const html = renderSession(createFindSession(true));
    expect(html).toContain("Only include shocks that…");
    expect(html).toContain("Rank higher shocks that…");
    expect(html).toContain("Do not show shocks that…");
    expect(html).toContain("All fields may be left blank");
    expect(html).toContain("No search has been run yet");
    expect(html).toContain(
      "Add criteria only if useful, then run Find and assess candidate shocks. Blank criteria are valid.",
    );
    expect(html).not.toContain("Clean Energy Rule");
    expect(html).not.toMatch(/>Add</);
    expect(html).not.toContain("Must have");
    expect(html).not.toContain("Nice to have");
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
  });

  it("renders a compact current list and a separate review panel", () => {
    const session = createFindSession();
    const html = renderSession(session, {
      reviewedItemId: "candidate-b",
    });
    expect(html).toContain("Suggested shocks");
    expect(html).toContain("Grid Reliability Order");
    expect(html).not.toContain("Clean Energy Rule");
    expect(html).toContain("Candidate shock under review");
    expect(html).toContain("Preliminary assessment");
    expect(html).toContain("Should you investigate this shock?");
    expect(html).toContain("Study fit");
    expect(html).toContain("Who appears affected");
    expect(html).toContain("How it may affect Profitability");
    expect(html).toContain("Main concern");
    expect(html).toContain("What to check next");
    expect(html).toContain("Evidence");
    expect(html).not.toContain("Evidence at a glance");
    expect(html).not.toContain("Recorded metadata");
    expect(html).not.toContain("Preliminary AI inference");
    expect(html).not.toContain("Methodological details");
    expect(html).not.toContain("External-shock plausibility");
    expect(html).toContain("Why this result appears");
    expect(html).toContain("Choose this shock");
    expect(html).toContain(
      "The host model retained this candidate after reviewing the candidate evidence.",
    );
    expect(html).not.toContain(
      "This record does not appear to meet every inclusion condition",
    );
    expect(html).not.toContain(
      "No unmet inclusion condition was recorded",
    );
    expect(html).not.toContain("/100");
    expect(html).not.toContain("How this was assessed");
    // A lexical must-have mismatch is never recomputed after semantic filtering.
    expect(html).not.toContain("Not selectable");
  });

  it("does not recompute lexical contradictions after semantic retention", () => {
    const session = createFindSession();
    expect(screen02SemanticReviewStatus(session)).toBe("reviewed");

    const html = renderSession(session, {
      reviewedItemId: "candidate-b",
    });
    expect(html).toContain(
      "The host model retained this candidate after reviewing the candidate evidence.",
    );
    expect(html).not.toContain("semantic review");
    expect(html).not.toContain("lexical match-or-mismatch");
    expect(html).not.toContain(
      "This record does not appear to meet every inclusion condition",
    );
    expect(html).not.toContain("unmet inclusion condition");
  });

  it("recognizes a fully accounted AI child after a blank-criteria search", () => {
    const session = createFindSession();
    const native =
      session.interaction.searchRounds[
        session.interaction.searchRounds.length - 2
      ]!;
    const reviewed = session.interaction.searchRounds.at(-1)!;
    native.preferenceCriteriaIds = [];
    reviewed.preferenceCriteriaIds = [];
    reviewed.semanticDecisions![0]!.criterionIds = [];

    expect(screen02SemanticReviewStatus(session)).toBe("reviewed");
    expect(screen02SemanticDecisionLock("reviewed")).toBe(false);
    const html = renderSession(session, {
      reviewedItemId: "candidate-b",
    });
    expect(html).toMatch(
      /<button class="s2-primary-action" type="button">Choose this shock<\/button>/,
    );
  });

  it("trusts a valid completed AI child over a stale transient host notice", () => {
    const session = createFindSession();
    const staleNotice: Screen02Notice = {
      status: "warning",
      message:
        "The preliminary AI review was temporarily unavailable.",
    };

    expect(
      screen02SemanticReviewStatus(session, staleNotice),
    ).toBe("reviewed");
  });

  it("restores a native-only round as recoverably incomplete instead of reviewed", () => {
    const session = makeLatestSemanticReviewIncomplete(
      createFindSession(),
    );
    session.interaction.searchRounds.at(-1)!.preferenceCriteriaIds = [];

    expect(screen02SemanticReviewStatus(session)).toBe(
      "review-incomplete",
    );
    const html = renderSession(session, {
      reviewedItemId: "candidate-b",
    });
    expect(html).toContain('data-testid="screen02-assessment-neutral"');
    expect(html).toContain("Preliminary assessment not completed");
    expect(html).toContain("Retry preliminary assessment");
    expect(html).toContain("Official documentation located");
    expect(html).toContain("Official record for Grid Reliability Order");
    expect(html).not.toContain("Assessment unavailable");
    expect(html).not.toContain('data-testid="screen02-study-fit"');
    expect(html).toMatch(
      /<button data-testid="screen02-search-button" class="s2-primary-action" type="button" aria-busy="false">Find and assess candidate shocks<\/button>/,
    );
    expect(html).toMatch(
      /<button class="s2-primary-action" type="button">Choose this shock<\/button>/,
    );
    expect(html).toMatch(
      /class="s2-reset-button" type="button" aria-haspopup="dialog"/,
    );
    expect(html).toContain('aria-controls="s2-candidate-detail"');
    expect(html.match(/Preliminary assessment not completed/g)).toHaveLength(1);
  });

  it("shows a legacy outcome hypothesis only after the legacy review is complete", () => {
    const session = createFindSession();
    const item = session.items[1]!;
    item.outcomeLink = {
      text:
        "Source-grounded event feature: Grid Reliability Order establishes reliability requirements; the organizational pathway remains unassessed.",
      status: "system-template",
    };

    expect(screen02SemanticReviewStatus(session)).toBe(
      "review-incomplete",
    );
    expect(screen02HasCompletedAiReview(session)).toBe(false);
    const incompleteHtml = renderSession(session, {
      reviewedItemId: item.id,
    });
    expect(incompleteHtml).toContain("Preliminary assessment not completed");
    expect(incompleteHtml).not.toContain(
      "Grid Reliability Order establishes reliability requirements; the organizational pathway remains unassessed",
    );

    item.outcomeLink = {
      text: "A fresh candidate-specific, outcome-blind AI hypothesis.",
      status: "ai-hypothesis",
    };
    expect(screen02SemanticReviewStatus(session)).toBe("reviewed");
    const reviewedHtml = renderSession(session, {
      reviewedItemId: item.id,
    });
    expect(reviewedHtml).toContain("How it may affect Profitability");
    expect(reviewedHtml).toContain(
      "A fresh candidate-specific, outcome-blind AI hypothesis.",
    );
  });

  it("offers preliminary assessment only when the host action is available", () => {
    const incomplete = makeLatestSemanticReviewIncomplete(
      createFindSession(),
    );
    incomplete.interaction.searchRounds.at(-1)!.preferenceCriteriaIds = [];

    const availableHtml = renderSession(incomplete, {
      reviewedItemId: "candidate-b",
    });
    expect(availableHtml).toContain(
      'data-testid="screen02-ai-review-button"',
    );
    expect(availableHtml).toContain("Retry preliminary assessment");

    const unavailableHtml = renderSession(incomplete, {
      reviewedItemId: "candidate-b",
      aiReviewAvailable: false,
    });
    expect(unavailableHtml).not.toContain(
      'data-testid="screen02-ai-review-button"',
    );
    expect(unavailableHtml).toContain(
      'data-testid="screen02-search-button" class="s2-primary-action" type="button" aria-busy="false">Find candidate shocks</button>',
    );
    expect(unavailableHtml).not.toContain(
      ">Find and assess candidate shocks</button>",
    );

    const awaitingHtml = renderSession(incomplete, {
      reviewedItemId: "candidate-b",
      notice: {
        status: "pending",
        message: "ChatGPT is completing the requested AI interpretation.",
      },
    });
    expect(awaitingHtml).toMatch(
      /data-testid="screen02-ai-review-button"[^>]*disabled=""[^>]*>Preliminary assessment in progress<\/button>/,
    );

    expect(renderSession(createFindSession())).not.toContain(
      "Retry preliminary assessment",
    );

    incomplete.lockedChoice = {
      status: "locked",
      itemId: "candidate-b",
      itemFingerprint: "fnv1a64:candidate-b",
      lockedAtRevision: incomplete.revision,
      mode: "find",
      shockName: "Grid Reliability Order",
      knownShockAnchor: null,
      primaryRepresentationType: null,
      primaryConstruct: null,
      baselineFingerprint: incomplete.screen01Fingerprint,
      downstreamStatus: "screen-03-ready",
    };
    expect(renderSession(incomplete)).not.toContain(
      "Retry preliminary assessment",
    );
  });

  it("recognizes and renders a complete compact preliminary assessment", () => {
    const session = withCompactPreliminaryAssessment(createFindSession(), {
      judgment: "promising-to-verify",
      studyFit:
        "Grid Reliability Order fits the confirmed regulation, geography, and study period.",
      affectedPopulation:
        "Utilities and technology firms covered by Grid Reliability Order.",
      outcomeMechanism:
        "Grid Reliability Order may affect Profitability through reliability spending and operating costs.",
      mainConcern:
        "The firm-level exposure threshold has not been mapped.",
      nextChecks: [
        "Confirm the operative date.",
        "Map covered utilities to focal firms.",
      ],
    });

    expect(screen02SemanticReviewStatus(session)).toBe("reviewed");
    expect(screen02HasCompletedAiReview(session)).toBe(true);
    const html = renderSession(session, {
      reviewedItemId: "candidate-b",
    });
    expect(html).toContain("Promising to verify");
    expect(html).toContain('data-testid="screen02-study-fit"');
    expect(html).toContain('data-testid="screen02-affected-population"');
    expect(html).toContain('data-testid="screen02-outcome-pathway"');
    expect(html).toContain('data-testid="screen02-main-concern"');
    expect(html).toContain('data-testid="screen02-next-checks"');
    expect(html).toContain('data-testid="screen02-evidence-basis"');
    expect(html).toContain("Official record for Grid Reliability Order");
    expect(html).not.toContain('data-testid="screen02-assessment-neutral"');
  });

  it("shows targeted retry actions for a needs-retry result without duplicating an unavailable card", () => {
    const session = withCompactPreliminaryAssessment(createFindSession(), {
      status: "needs-retry",
    });
    expect(screen02SemanticReviewStatus(session)).toBe("review-incomplete");
    expect(screen02HasCompletedAiReview(session)).toBe(false);

    const html = renderSession(session, {
      reviewedItemId: "candidate-b",
    });
    expect(html).toContain("Retry assessment");
    expect(html).toContain("Retry this assessment");
    expect(html).toContain('data-testid="screen02-assessment-neutral"');
    expect(html.match(/Preliminary assessment not completed/g)).toHaveLength(1);
    expect(html).not.toContain("Assessment unavailable");
    expect(html).toContain("Official documentation located");
  });

  it("distinguishes a completed zero-result search from the initial empty state", () => {
    const session = createFindSession();
    const reviewed = session.interaction.searchRounds.at(-1)!;
    reviewed.proposalIdsReceived = [];
    reviewed.itemIdsRetained = [];
    reviewed.itemIdsAdded = [];
    reviewed.semanticDecisions = [
      {
        itemId: "candidate-b",
        decision: "excluded",
        criterionIds: [],
        scopeMismatchFields: ["outcomeFamily"],
        reason: "The candidate does not match the locked outcome family.",
      },
    ];

    expect(screen02SemanticReviewStatus(session)).toBe("reviewed");
    const html = renderSession(session);
    expect(html).toContain(
      "No candidate shocks were retained in this search.",
    );
    expect(html).toContain(
      "This bounded search found no eligible result.",
    );
    expect(html).not.toContain("No search has been run yet.");
    expect(html).toContain(
      "Locked study-boundary mismatch:",
    );
    expect(html).toContain("Outcome family");
  });

  it("does not accept an AI child whose decisions fail to account for its native parent", () => {
    const session = createFindSession();
    session.interaction.searchRounds.at(-1)!.semanticDecisions = [];

    expect(screen02SemanticReviewStatus(session)).toBe(
      "review-incomplete",
    );
    expect(screen02HasCompletedAiReview(session)).toBe(false);
  });

  it("rejects a retained semantic decision that records a locked-scope mismatch", () => {
    const session = createFindSession();
    session.interaction.searchRounds.at(-1)!.semanticDecisions![0]!
      .scopeMismatchFields = ["industry"];

    expect(screen02SemanticReviewStatus(session)).toBe(
      "review-incomplete",
    );
    expect(screen02HasCompletedAiReview(session)).toBe(false);
  });

  it("allows browsing but locks mutations while required criteria await assessment", () => {
    const session = makeLatestSemanticReviewIncomplete(
      createFindSession(),
    );
    for (const criterion of session.interaction.preferences.criteria) {
      criterion.source = "researcher";
    }
    const notice: Screen02Notice = {
      status: "pending",
      message:
        "The AI-assisted global review was requested. ChatGPT is interpreting the criteria.",
    };
    expect(screen02SemanticReviewStatus(session, notice)).toBe(
      "awaiting-review",
    );

    const html = renderSession(session, {
      reviewedItemId: "candidate-b",
      notice,
    });
    expect(html).toContain("Grid Reliability Order");
    expect(html).toContain('aria-controls="s2-candidate-detail"');
    expect(html).toContain(
      "Criteria assessment in progress — not yet applied",
    );
    expect(html).not.toContain("Applied to the latest completed search");
    expect(html).toContain(
      "Preliminary assessment and required-criteria review are in progress",
    );
    expect(html).toContain(
      "candidate decisions, source expansion, and event verification are paused until the required criteria are assessed",
    );
    expect(html).toMatch(
      /<button data-testid="screen02-search-button" class="s2-primary-action" type="button" disabled="" aria-busy="true"[^>]*>Preliminary assessment in progress<\/button>/,
    );
    expect(html).not.toContain("<summary>Remove from consideration</summary>");
    expect(html).toMatch(
      /<button class="s2-secondary-action" type="button" disabled=""[^>]*>Remove from consideration<\/button>/,
    );
    expect(html).toMatch(
      /<button class="s2-primary-action" type="button" disabled="" title="Choosing is paused until the required criteria are assessed">Choose this shock<\/button>/,
    );
  });

  it("keeps factual records and selection available when assessment is unavailable", () => {
    const session = makeLatestSemanticReviewIncomplete(
      createFindSession(),
    );
    for (const criterion of session.interaction.preferences.criteria) {
      criterion.source = "researcher";
    }
    const notice: Screen02Notice = {
      status: "warning",
      message:
        "The factual source search completed, but this host did not accept the preliminary AI review. The displayed candidates have not been semantically filtered.",
    };
    expect(screen02SemanticReviewStatus(session, notice)).toBe(
      "review-unavailable",
    );
    expect(
      screen02StrictCriteriaDecisionLock(
        session,
        "review-unavailable",
      ),
    ).toBe(false);

    const html = renderSession(session, {
      reviewedItemId: "candidate-b",
      notice,
    });
    expect(html).toContain(
      "Criteria recorded — assessment needs retry",
    );
    expect(html).toContain(
      "These criteria were recorded but could not be assessed.",
    );
    expect(html).toContain(
      "choose a candidate while treating the criteria as unverified",
    );
    expect(html).toContain("Preliminary assessment not completed");
    expect(html).toContain("Retry preliminary assessment");
    expect(html).not.toContain("Assessment unavailable");
    expect(html).toMatch(
      /<button data-testid="screen02-search-button" class="s2-primary-action" type="button" aria-busy="false">Find and assess candidate shocks<\/button>/,
    );
    expect(html).toContain("<summary>Remove from consideration</summary>");
    expect(html).toMatch(
      /<button class="s2-primary-action" type="button">Choose this shock<\/button>/,
    );
    expect(html).toContain('aria-controls="s2-candidate-detail"');
    expect(html).toMatch(
      /class="s2-reset-button" type="button" aria-haspopup="dialog"/,
    );

    session.selectedItemId = "candidate-b";
    const chosenHtml = renderSession(session, { notice });
    expect(chosenHtml).toMatch(
      /<button class="s2-primary-action" type="button" disabled="" title="Finish the preliminary assessments before event verification">Continue: Verify the event<\/button>/,
    );
  });

  it.each(["require", "avoid"] as const)(
    "locks an actively awaiting %s criterion but not an unavailable one",
    (kind) => {
      const session = createFindSession();
      session.interaction.preferences.criteria[0]!.kind = kind;
      expect(
        screen02StrictCriteriaDecisionLock(
          session,
          "review-unavailable",
        ),
      ).toBe(false);
      expect(
        screen02StrictCriteriaDecisionLock(
          session,
          "awaiting-review",
        ),
      ).toBe(true);
      expect(
        screen02StrictCriteriaDecisionLock(session, "reviewed"),
      ).toBe(false);
    },
  );

  it("allows choosing after unavailable review when the current request has preferences only", () => {
    const session = makeLatestSemanticReviewIncomplete(
      createFindSession(),
    );
    session.interaction.preferences.criteria =
      session.interaction.preferences.criteria.filter(
        (criterion) => criterion.kind === "prefer",
      );
    session.interaction.searchRounds.at(-1)!.preferenceCriteriaIds = [
      "criterion-energy",
    ];
    const notice: Screen02Notice = {
      status: "warning",
      message:
        "The factual source search completed, but this host did not accept the preliminary AI review. The displayed candidates have not been semantically filtered.",
    };
    const status = screen02SemanticReviewStatus(session, notice);
    expect(status).toBe("review-unavailable");
    expect(
      screen02StrictCriteriaDecisionLock(session, status),
    ).toBe(false);
    expect(screen02SemanticDecisionLock(status)).toBe(false);

    const html = renderSession(session, {
      reviewedItemId: "candidate-b",
      notice,
    });
    expect(html).not.toContain(
      "Strict criteria were not semantically reviewed",
    );
    expect(html).not.toContain("Preliminary AI review is incomplete");
    expect(html).toContain("Retry preliminary assessment");
    expect(html).toMatch(
      /<button class="s2-primary-action" type="button">Choose this shock<\/button>/,
    );
    expect(html).toMatch(
      /<button data-testid="screen02-search-button" class="s2-primary-action" type="button" aria-busy="false">Find and assess candidate shocks<\/button>/,
    );
  });

  it("keeps Find selection and search available during an ordinary assessment", () => {
    const session = makeLatestSemanticReviewIncomplete(
      createFindSession(),
    );
    session.interaction.preferences.criteria =
      session.interaction.preferences.criteria.filter(
        (criterion) => criterion.kind === "prefer",
      );
    session.interaction.searchRounds.at(-1)!.preferenceCriteriaIds = [
      "criterion-energy",
    ];
    const notice: Screen02Notice = {
      status: "pending",
      message:
        "ChatGPT is completing the preliminary assessment.",
    };
    expect(screen02SemanticReviewStatus(session, notice)).toBe(
      "awaiting-review",
    );
    const html = renderSession(session, {
      reviewedItemId: "candidate-b",
      notice,
      expandCoverageAvailable: true,
    });
    expect(html).toContain("Preliminary assessment is in progress");
    expect(html).toContain(
      "You can keep comparing candidates, choose a shock, or start another search while this assessment is prepared.",
    );
    expect(html).not.toMatch(/id="s2-require-criterion"[^>]*disabled=""/);
    expect(html).not.toMatch(/id="s2-refinement-request"[^>]*disabled=""/);
    expect(html).toMatch(
      /<button data-testid="screen02-search-button" class="s2-primary-action" type="button" aria-busy="false">Find and assess candidate shocks<\/button>/,
    );
    expect(html).toMatch(
      /<button class="s2-secondary-action" type="button">Search for different results<\/button>/,
    );
    expect(html).toMatch(
      /data-testid="screen02-ai-review-button"[^>]*disabled=""[^>]*>Preliminary assessment in progress<\/button>/,
    );
    expect(html).toMatch(
      /data-testid="screen02-expand-coverage-button"[^>]*>Expand source coverage<\/button>/,
    );
    expect(html).toContain("<summary>Remove from consideration</summary>");
    expect(html).toMatch(
      /<button class="s2-primary-action" type="button">Choose this shock<\/button>/,
    );
    expect(html).toContain("Reviewing");
    expect(html).toMatch(
      /<button type="button" class="s2-result-row s2-result-row--reviewed" aria-pressed="true" aria-controls="s2-candidate-detail">/,
    );
    expect(html).toMatch(
      /class="s2-reset-button" type="button" aria-haspopup="dialog" aria-expanded="false"/,
    );

    session.selectedItemId = "candidate-b";
    const chosenHtml = renderSession(session, { notice });
    expect(chosenHtml).toMatch(
      /<button class="s2-primary-action" type="button" disabled="" title="Finish the preliminary assessments before event verification">Continue: Verify the event<\/button>/,
    );
  });

  it("serializes known-shock search and confirmation controls during an assessment turn", () => {
    const session = createAuditSession();
    const notice: Screen02Notice = {
      status: "pending",
      message: "ChatGPT is completing the preliminary assessment.",
    };
    expect(screen02SemanticReviewStatus(session, notice)).toBe(
      "awaiting-review",
    );

    const html = renderSession(session, {
      notice,
      expandCoverageAvailable: true,
    });
    expect(html).toContain(
      "Preliminary assessment and required-criteria review are in progress",
    );
    expect(html).toContain(
      "known-shock search, clarification, confirmation, source expansion, and event verification are paused until the required criteria are assessed",
    );
    expect(html).toMatch(/id="s2-audit-guidance"[^>]*disabled=""/);
    expect(html).toMatch(
      /data-testid="screen02-audit-search-button"[^>]*disabled="" aria-busy="true"[^>]*>Preliminary assessment in progress<\/button>/,
    );
    expect(html).toMatch(
      /<button class="s2-secondary-action" type="button" disabled="">Correct the shock name in Screen 1<\/button>/,
    );
    expect(html).toMatch(
      /data-testid="screen02-ai-review-button"[^>]*disabled=""[^>]*>Preliminary assessment in progress<\/button>/,
    );
    expect(html).toMatch(
      /data-testid="screen02-expand-coverage-button"[^>]*disabled=""[^>]*>Source expansion available after assessment<\/button>/,
    );
    expect(html).toMatch(
      /<button class="s2-primary-action" type="button" disabled="" title="Confirmation is paused until the required criteria are assessed">This is my shock<\/button>/,
    );
    expect(html).toMatch(
      /class="s2-reset-button" type="button" aria-haspopup="dialog" aria-expanded="false"/,
    );
  });

  it("keeps Audit search and confirmation available during an ordinary assessment", () => {
    const session = createAuditSession();
    session.interaction.preferences.criteria =
      session.interaction.preferences.criteria.filter(
        (criterion) => criterion.kind === "prefer",
      );
    session.interaction.searchRounds.at(-1)!.preferenceCriteriaIds = [
      "criterion-energy",
    ];
    const notice: Screen02Notice = {
      status: "pending",
      message: "ChatGPT is completing the preliminary assessment.",
    };

    const html = renderSession(session, {
      notice,
      expandCoverageAvailable: true,
    });
    expect(html).toContain(
      "You can keep reviewing or confirm this shock, and you may start another search while the assessment is prepared.",
    );
    expect(html).not.toMatch(/id="s2-audit-guidance"[^>]*disabled=""/);
    expect(html).toMatch(
      /data-testid="screen02-audit-search-button"[^>]*aria-busy="false"[^>]*>Find\/resolve shock matches again<\/button>/,
    );
    expect(html).toMatch(
      /<button class="s2-secondary-action" type="button">Correct the shock name in Screen 1<\/button>/,
    );
    expect(html).toMatch(
      /<button class="s2-primary-action" type="button">This is my shock<\/button>/,
    );
    expect(html).toMatch(
      /data-testid="screen02-expand-coverage-button"[^>]*>Expand source coverage<\/button>/,
    );
  });

  it("summarizes coverage plainly and collapses exact diagnostics", () => {
    const html = renderSession(createFindSession());
    expect(html).toContain("What this search covered");
    expect(html).toContain("Current search summary");
    expect(html).toContain("Searched Official primary sources");
    expect(html).toContain(
      "ShockAudit checked 5 submitted candidate records",
    );
    expect(html).toContain("ChatGPT may have considered additional records");
    expect(html).toContain("that total is not available here");
    expect(html).toContain("Records checked");
    expect(html).toContain("Results retained");
    expect(html).toContain("Outside the study period");
    expect(html).toContain("<b>2</b>");
    expect(html).toContain("<summary>Search record (optional)</summary>");
    expect(html).toContain("Result ordering record");
    expect(html).toContain("How your criteria affected the results");
    expect(html).toContain(
      "ChatGPT assessed 1 candidate: 1 kept and 0 excluded",
    );
    expect(html).toContain("Criteria decisions");
    expect(html).toContain(
      "The host model retained this candidate after reviewing the candidate evidence.",
    );
    expect(html).not.toContain("fixed validation gate");
    expect(html).not.toContain("Tier 6");
  });

  it("surfaces meaningful global coverage limits without exposing raw channel codes", () => {
    const session = createFindSession();
    const round = session.interaction.searchRounds.at(-1)!;
    round.manifest.channels.push({
      channel:
        "Coverage limitation · national-primary-source-not-configured",
      status: "not-searched",
      retrievedAt: "2026-07-30T12:00:00-05:00",
      note:
        "No native official legal-source connector is configured for China. A suitable jurisdiction-specific source must be identified and disclosed before candidates can be proposed. Host-assisted discovery required: yes.",
    });
    const html = renderSession(session);

    expect(html).toContain("Limits to keep in mind");
    expect(html).toContain(
      "These live-source routes were unavailable, skipped, or bounded",
    );
    expect(html).toContain(
      "No native official legal-source connector is configured for China",
    );
    expect(html).toContain(
      "A suitable jurisdiction-specific source must be identified and disclosed before candidates can be proposed.",
    );
    expect(html).not.toContain("ChatGPT must identify");
  });

  it("uses recorded authority metadata before calling a source official or documented", () => {
    const supported = createFindSession();
    const supportedHtml = renderSession(supported, {
      reviewedItemId: "candidate-b",
    });
    expect(supportedHtml).toContain(">Official source</span>");
    expect(supportedHtml).toContain("Official documentation located");
    expect(supportedHtml).not.toContain("Recorded metadata");

    const unverified = createFindSession();
    const unverifiedSource = unverified.items[1]!.sources[0]!;
    delete unverifiedSource.authorityAssessment;
    const unverifiedHtml = renderSession(unverified, {
      reviewedItemId: "candidate-b",
    });
    expect(unverifiedHtml).toContain("Authority not established");
    expect(unverifiedHtml).toContain(
      "Source located · authority not established",
    );
    expect(unverifiedHtml).not.toContain(">Official source</span>");
    expect(unverifiedHtml).not.toContain(
      "Official documentation located",
    );

    const aiClassified = createFindSession();
    aiClassified.items[1]!.sources[0]!.authorityAssessment = {
      method: "ai-rubric",
      reason: "The host model classified the source provisionally.",
      policyVersion: SCREEN_02_SOURCE_POLICY_VERSION,
    };
    const aiClassifiedHtml = renderSession(aiClassified, {
      reviewedItemId: "candidate-b",
    });
    expect(aiClassifiedHtml).toContain(
      "Source authority needs verification",
    );
    expect(aiClassifiedHtml).not.toContain(">Official source</span>");
  });

  it("keeps reviewing separate from choosing and uses event-verification continuation", () => {
    const session = createFindSession();
    session.selectedItemId = "candidate-b";
    const html = renderSession(session);
    expect(html).toContain("Chosen shock");
    expect(html).toContain("Grid Reliability Order");
    expect(html).toContain("s2-result-row--chosen");
    expect(html).toContain("Continue: Verify the event");
    expect(html).toContain(
      "Select a shock to review its facts, preliminary assessment, and supporting evidence.",
    );

    session.lockedChoice = {
      status: "locked",
      itemId: "candidate-b",
      itemFingerprint: "fnv1a64:candidate-b",
      lockedAtRevision: 3,
      mode: "find",
      shockName: "Grid Reliability Order",
      knownShockAnchor: null,
      primaryRepresentationType: null,
      primaryConstruct: null,
      baselineFingerprint: session.screen01Fingerprint,
      downstreamStatus: "screen-03-ready",
    };
    const lockedHtml = renderSession(session);
    expect(lockedHtml).toContain("Change chosen shock");
    expect(lockedHtml).not.toContain(
      "Continue: Verify the event",
    );
  });

  it("keeps a source-free lead tentatively chosen but blocks event verification", () => {
    const session = createFindSession();
    const chosen = session.items.find((item) => item.id === "candidate-b")!;
    chosen.sources = [];
    chosen.sourceSummary = {
      uniqueSourceCount: 0,
      byAuthorityTier: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
      strongestAuthorityTier: null,
      authorityScore: null,
    };
    session.selectedItemId = chosen.id;

    const html = renderSession(session, { reviewedItemId: chosen.id });
    expect(html).toContain("Chosen shock");
    expect(html).toContain(
      "This lead can remain tentatively chosen, but it needs at least one factual source before event verification can begin.",
    );
    expect(html).toMatch(
      /<button class="s2-primary-action" type="button" disabled="" title="Locate at least one factual source before event verification">Continue: Verify the event<\/button>/,
    );
  });

  it("presents Audit mode as event identity confirmation and a shock dossier", () => {
    const session = createAuditSession();
    const html = renderSession(session);
    expect(html).toContain("Confirm and assess your known shock");
    expect(html).toContain("Possible matches");
    expect(html).toContain("One possible match was located");
    expect(html).toContain("California Consumer Privacy Act of 2018");
    expect(html).toContain("Known-shock dossier");
    expect(html).toContain("Factual background and early assessment");
    expect(html).toContain("Find/resolve shock matches again");
    expect(html).toContain("Event matches submitted");
    expect(html).toContain(
      "not a blanket statement about all ShockAudit source coverage",
    );
    expect(html).toContain("This is my shock");
    expect(html).toContain("Correct the shock name in Screen 1");
    expect(html).not.toContain("Compare representations of the known shock");
    expect(html).not.toContain("Suggested representations");
    expect(html).not.toContain("Choose this representation");
  });

  it("keeps source-coverage expansion distinct and available after a zero-result native round", () => {
    const session = createAuditSession();
    const round = session.interaction.searchRounds.at(-1)!;
    round.itemIdsRetained = [];
    round.manifest.coverage = {
      ...round.manifest.coverage,
      itemsRetained: 0,
      uniqueSourcesLocated: 0,
      status: "no-results",
    };
    session.searchManifest = round.manifest;

    const html = renderSession(session, {
      expandCoverageAvailable: true,
    });
    expect(html).toContain("Expand source coverage");
    expect(html).toContain(
      "state, local, tribal, foreign, or supranational sources",
    );
    expect(html).toContain("provisional until verified");
    expect(html).not.toContain("Tier 6");

    const withResults = renderSession(createAuditSession(), {
      expandCoverageAvailable: true,
    });
    expect(withResults).toContain("Expand source coverage");
    expect(withResults).toContain("Retry preliminary assessment");

    const afterReview = createAuditSession();
    afterReview.interaction.searchRounds.at(-1)!.stage = "ai-review";
    const afterReviewHtml = renderSession(afterReview, {
      expandCoverageAvailable: true,
    });
    expect(afterReviewHtml).not.toContain("Expand source coverage");
  });

  it("keeps factual cards and one neutral status when no assessment is available", () => {
    const session = createFindSession();
    const item = session.items[1]!;
    item.scorecard.componentDetails.exposureObservability =
      detail("system-computed", "observable");
    item.scorecard.componentDetails.timeSupport =
      detail("system-computed", "adequate");
    item.scorecard.componentDetails.variation =
      detail("system-computed", "unknown");
    delete item.externalShockPlausibility;
    const html = renderSession(session, {
      reviewedItemId: item.id,
    });
    expect(html).toContain("Date or timing lead");
    expect(html).toContain("Official documentation located");
    expect(html).toContain("Official record for Grid Reliability Order");
    expect(html).toContain('data-testid="screen02-assessment-neutral"');
    expect(html).toContain("Preliminary assessment not completed");
    expect(html.match(/Preliminary assessment not completed/g)).toHaveLength(1);
    expect(html).not.toContain("Methodological details");
    expect(html).not.toContain("Assessment unavailable");
  });

  it("disables search but keeps reset available while a request is pending", () => {
    const session = createFindSession();
    session.interaction.pendingRequest = {
      id: "request-pending",
      baseRevision: 2,
      expectedRevision: 3,
      requestType: "refine",
      status: "awaiting-response",
      exactText: "Rank energy-sector events higher.",
      criteria: [{ kind: "prefer", text: "energy sector" }],
    };
    const html = renderSession(session, {
      notice: {
        status: "pending",
        message: "Search in progress.",
      },
    });
    expect(html).toContain("Waiting for the candidate search");
    expect(html).toContain('aria-busy="true"');
    expect(html).toMatch(
      /class="s2-reset-button"[^>]*aria-haspopup="dialog"/,
    );
    expect(html).not.toMatch(
      /class="s2-reset-button"[^>]*disabled=""/,
    );
  });
});
