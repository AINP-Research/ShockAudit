import { describe, expect, it } from "vitest";

import {
  applyScreen02FindCandidateSourceFallback,
  applyScreen02FindCandidateDraftReceipt,
  applyScreen02FindCriterionDraftReceipt,
  beginScreen02FindDiscovery,
  buildScreen02FindAssessmentPrompt,
  buildScreen02FindModelContext,
  clearScreen02FindOpenedCandidate,
  completeScreen02FindDiscovery,
  createScreen02FindDraftReceipt,
  deriveScreen02FindComparison,
  failScreen02FindDiscovery,
  markScreen02FindRequestsDelivered,
  openScreen02FindCandidate,
  removeScreen02FindCandidate,
  replaceScreen02FindCriteria,
  retryScreen02FindAssessmentRequest,
  SCREEN_02_FIND_SUBMIT_DRAFT_TOOL_V021,
  screen02FindRequestProof,
  type Screen02FindSearchCandidateInput,
} from "../../src/core/screen02-find-workflow";
import {
  createScreen02FindState,
  finalizeScreen02FindCandidateAssessmentRequest,
  finalizeScreen02FindCriterionAssessmentRequest,
  fingerprintScreen02WorkflowValue,
  prepareScreen02AssessmentRequest,
  requireScreen02FindState,
  restoreScreen02FindState,
  screen02FindCandidateGate,
  transitionScreen02AssessmentRequest,
} from "../../src/core/screen02-workflow-state";
import {
  SCREEN_02_FIND_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE,
  buildScreen02RetainedResultBinding,
  screen02FindAssessmentPartIds,
  type Screen02FindCandidateAssessment,
  type Screen02FindState,
} from "../../src/core/screen02-workflow-types";
import { buildScreen02FindViewModel } from "../../src/ui/screen-02-find/find-view-model";
import {
  buildFindFactsState,
  buildReadyFindState,
  cloneFixture,
  confirmedWorkflowFindContext,
  workflowManifest,
  workflowSource,
} from "./screen02-workflow-fixtures";

function prepareCandidate(state: Screen02FindState, requestId: string, at: string) {
  return prepareScreen02AssessmentRequest(state, {
    mode: "find-candidate",
    candidateSnapshotId: "gdpr-candidate-snapshot-v1",
    jobId: "candidate-retry-job",
    requestId,
    attempt: 1,
    requestedPartIds: [...screen02FindAssessmentPartIds],
    at,
  }) as Screen02FindState;
}

function completeFirstCandidateWithSourceFallback(
  state: Screen02FindState,
  requestId: string,
) {
  const candidate = state.candidates[0];
  if (!candidate) throw new Error("Expected one Find candidate.");
  let prepared = prepareScreen02AssessmentRequest(state, {
    mode: "find-candidate",
    candidateSnapshotId: candidate.candidateSnapshotId,
    jobId: `${requestId}:job`,
    requestId,
    attempt: 1,
    requestedPartIds: [...screen02FindAssessmentPartIds],
    at: "2026-08-10T18:55:00.000Z",
  }) as Screen02FindState;
  prepared = markScreen02FindRequestsDelivered(prepared, [requestId], {
    at: "2026-08-10T18:55:01.000Z",
    delivered: true,
  });
  return applyScreen02FindCandidateSourceFallback(
    prepared,
    requestId,
    "2026-08-10T18:55:02.000Z",
  );
}

function refreshFirstCandidateFingerprint(state: Screen02FindState) {
  const candidate = state.candidates[0];
  if (!candidate) throw new Error("Expected one Find candidate.");
  const { candidateFingerprint: _priorFingerprint, ...fingerprintInput } =
    candidate;
  candidate.candidateFingerprint = fingerprintScreen02WorkflowValue(
    fingerprintInput,
  );
  return requireScreen02FindState(state);
}

function applyInvalidCandidate(
  state: Screen02FindState,
  requestId: string,
  at: string,
) {
  const delivered = markScreen02FindRequestsDelivered(state, [requestId], {
    at,
    delivered: true,
  });
  const request = delivered.assessmentRequests.find(
    (item) => item.requestId === requestId,
  )!;
  return applyScreen02FindCandidateDraftReceipt(
    delivered,
    createScreen02FindDraftReceipt({
      receiptId: `${requestId}:receipt`,
      kind: "find-candidate",
      receivedAt: at,
      submissions: [
        {
          requestId,
          requestProof: screen02FindRequestProof(request),
          draft: {},
        },
      ],
    }),
    at,
  );
}

function applyInvalidCriterion(
  state: Screen02FindState,
  requestId: string,
  at: string,
) {
  const delivered = markScreen02FindRequestsDelivered(state, [requestId], {
    at,
    delivered: true,
  });
  const request = delivered.assessmentRequests.find(
    (item) => item.requestId === requestId,
  )!;
  return applyScreen02FindCriterionDraftReceipt(
    delivered,
    createScreen02FindDraftReceipt({
      receiptId: `${requestId}:receipt`,
      kind: "find-criterion",
      receivedAt: at,
      submissions: [
        {
          requestId,
          requestProof: screen02FindRequestProof(request),
          draft: { unexpected: true },
        },
      ],
    }),
    at,
  );
}

function orderingCandidate(
  template: Screen02FindState["candidates"][number],
  input: {
    id: string;
    title: string;
    sourceIds: string[];
  },
): Screen02FindSearchCandidateInput {
  const { candidateFingerprint: _fingerprint, ...candidate } =
    cloneFixture(template);
  const evidenceSourceIds = [input.sourceIds[0]!];
  return {
    ...candidate,
    candidateId: input.id,
    candidateSnapshotId: `${input.id}-snapshot-v1`,
    searchRoundId: "ordering-round",
    identity: {
      ...candidate.identity,
      canonicalTitle: input.title,
      commonNames: [input.title],
      formalIdentifier: `${input.id.toUpperCase()}-2018`,
    },
    description: {
      ...candidate.description,
      id: `${input.id}-description`,
      text: `${input.title} is a source-backed privacy-regulation event lead.`,
      sourceIds: evidenceSourceIds,
    },
    dateLeads: candidate.dateLeads.map((lead, index) => ({
      ...lead,
      id: `${input.id}-date-${index + 1}`,
      sourceIds: evidenceSourceIds,
    })),
    broadCoverage: candidate.broadCoverage.map((claim, index) => ({
      ...claim,
      id: `${input.id}-coverage-${index + 1}`,
      sourceIds: evidenceSourceIds,
    })),
    sourceIds: [...input.sourceIds],
    recordedAt: "2026-08-10T19:31:00.000Z",
  };
}

function completeOrderingAssessment(
  state: Screen02FindState,
  input: {
    candidateSnapshotId: string;
    requestId: string;
    times: [string, string, string, string, string];
    categories:
      | {
          studyFit: "strong";
          outcomePathway: "plausible";
          measurementPotential: "possible";
          overallJudgment: "promising-to-verify";
        }
      | {
          studyFit: "weak";
          outcomePathway: "unsupported";
          measurementPotential: "implausible";
          overallJudgment: "low-priority";
        };
  },
) {
  const [preparedAt, deliveredAt, draftAt, validatingAt, completedAt] =
    input.times;
  let next = prepareScreen02AssessmentRequest(state, {
    mode: "find-candidate",
    candidateSnapshotId: input.candidateSnapshotId,
    jobId: `${input.requestId}:job`,
    requestId: input.requestId,
    attempt: 1,
    requestedPartIds: [...screen02FindAssessmentPartIds],
    at: preparedAt,
  }) as Screen02FindState;
  for (const transition of [
    {
      status: "message-delivered" as const,
      at: deliveredAt,
      actor: "chatgpt-host" as const,
    },
    {
      status: "draft-received" as const,
      at: draftAt,
      actor: "chatgpt-host" as const,
      receiptId: `${input.requestId}:receipt`,
    },
    {
      status: "validating" as const,
      at: validatingAt,
      actor: "fixed-core" as const,
    },
  ]) {
    next = transitionScreen02AssessmentRequest(next, {
      requestId: input.requestId,
      ...transition,
    }) as Screen02FindState;
  }
  const candidate = next.candidates.find(
    (item) => item.candidateSnapshotId === input.candidateSnapshotId,
  )!;
  const evidenceSourceIds = [candidate.sourceIds[0]!];
  const assessment: Screen02FindCandidateAssessment = {
    assessmentId: `${input.requestId}:assessment`,
    candidateSnapshotId: input.candidateSnapshotId,
    requestId: input.requestId,
    status: "completed",
    studyFit: {
      category: input.categories.studyFit,
      explanation: `${candidate.identity.canonicalTitle} has a candidate-specific sample interpretation.`,
      evidenceSourceIds,
    },
    outcomePathway: {
      category: input.categories.outcomePathway,
      explanation: `${candidate.identity.canonicalTitle} has a candidate-specific outcome interpretation.`,
      evidenceSourceIds,
    },
    measurementPotential: {
      category: input.categories.measurementPotential,
      explanation: `${candidate.identity.canonicalTitle} has candidate-specific measurement indicators.`,
      evidenceSourceIds,
    },
    mainConcern: `The strongest unresolved concern for ${candidate.identity.canonicalTitle} remains candidate-specific coverage.`,
    nextChecks: [
      `Verify affected-unit coverage for ${candidate.identity.canonicalTitle}.`,
    ],
    evidenceSourceIds,
    acceptedFields: [...screen02FindAssessmentPartIds],
    overallJudgment: input.categories.overallJudgment,
    overallJudgmentMethod: "fixed-computation",
    recordedAt: completedAt,
  };
  return finalizeScreen02FindCandidateAssessmentRequest(next, {
    requestId: input.requestId,
    status: "completed",
    at: completedAt,
    note: "The ordering fixture assessment passed fixed validation.",
    acceptedPartIds: [...screen02FindAssessmentPartIds],
    failures: [],
    assessment,
  });
}

function buildOrderingState() {
  let state = buildFindFactsState();
  const template = state.candidates[0]!;
  const exactRequest = "Compare source strength without hidden judgment ranking.";
  state = beginScreen02FindDiscovery(state, {
    discoveryRequestId: "ordering-discovery",
    searchRoundId: "ordering-round",
    candidateSetSnapshotId: "ordering-set-v1",
    exactRequest,
    at: "2026-08-10T19:30:00.000Z",
  });
  const alphaSource = workflowSource("alpha-source", {
    title: "Alpha secondary source",
    authorityTier: 3,
  });
  const gammaSource = workflowSource("gamma-source", {
    title: "Gamma corroborating source",
    authorityTier: 2,
  });
  const manifest = workflowManifest(exactRequest, 3);
  manifest.retrievedAt = "2026-08-10T19:30:01.000Z";
  manifest.channels.forEach((channel) => {
    channel.retrievedAt = manifest.retrievedAt;
  });
  const candidates = [
    orderingCandidate(template, {
      id: "alpha",
      title: "Alpha Privacy Rule",
      sourceIds: [alphaSource.id],
    }),
    orderingCandidate(template, {
      id: "beta",
      title: "Beta Privacy Rule",
      sourceIds: ["gdpr-official"],
    }),
    orderingCandidate(template, {
      id: "gamma",
      title: "Gamma Privacy Rule",
      sourceIds: ["gdpr-official", gammaSource.id],
    }),
  ];
  manifest.queryMatrix[0]!.returnedRecordIds = candidates.map(
    (candidate) => candidate.candidateId,
  );
  manifest.retainedResultBinding = buildScreen02RetainedResultBinding(
    "find",
    {
      sourceRecordsRetrieved: manifest.funnel!.sourceRecordsRetrieved,
      uniqueEventLeads: manifest.funnel!.uniqueEventLeads,
    },
    candidates.map((candidate) => ({
      recordId: candidate.candidateId,
      snapshotId: candidate.candidateSnapshotId,
      sourceIds: [...candidate.sourceIds],
      qualificationLane: candidate.qualification?.lane ?? null,
      origins: [{
        kind: "query-result",
        retrievalLane: "official-baseline",
        evidenceRole: "identity",
        producerRecordId: candidate.candidateId,
        queryId: "query-1",
        returnedRecordIds: [candidate.candidateId],
        sourceIds: [...candidate.sourceIds],
      }],
    })),
  );
  state = completeScreen02FindDiscovery(state, {
    discoveryRequestId: "ordering-discovery",
    at: "2026-08-10T19:30:02.000Z",
    sources: [alphaSource, gammaSource],
    candidates,
    manifest,
  });
  state = completeOrderingAssessment(state, {
    candidateSnapshotId: "alpha-snapshot-v1",
    requestId: "alpha-assessment",
    times: [
      "2026-08-10T19:30:03.000Z",
      "2026-08-10T19:30:04.000Z",
      "2026-08-10T19:30:05.000Z",
      "2026-08-10T19:30:06.000Z",
      "2026-08-10T19:30:07.000Z",
    ],
    categories: {
      studyFit: "strong",
      outcomePathway: "plausible",
      measurementPotential: "possible",
      overallJudgment: "promising-to-verify",
    },
  });
  for (const [id, offset] of [
    ["beta", 8],
    ["gamma", 13],
  ] as const) {
    const timestamp = (seconds: number) =>
      `2026-08-10T19:30:${String(seconds).padStart(2, "0")}.000Z`;
    state = completeOrderingAssessment(state, {
      candidateSnapshotId: `${id}-snapshot-v1`,
      requestId: `${id}-assessment`,
      times: [0, 1, 2, 3, 4].map((step) =>
        timestamp(offset + step),
      ) as [string, string, string, string, string],
      categories: {
        studyFit: "weak",
        outcomePathway: "unsupported",
        measurementPotential: "implausible",
        overallJudgment: "low-priority",
      },
    });
  }
  return state;
}

describe("Stage 3 Screen 2 Find core writers", () => {
  it("preserves authenticated AI parts when fixed fallback fills only unresolved candidate parts", () => {
    const requestId = "candidate-partial-source-fallback";
    let state = prepareCandidate(
      buildFindFactsState(),
      requestId,
      "2026-08-10T18:50:00.000Z",
    );
    state = markScreen02FindRequestsDelivered(state, [requestId], {
      at: "2026-08-10T18:50:01.000Z",
      delivered: true,
    });
    const request = state.assessmentRequests.find(
      (item) => item.requestId === requestId,
    )!;
    const candidate = state.candidates.find(
      (item) =>
        item.candidateSnapshotId === "gdpr-candidate-snapshot-v1",
    )!;
    const aiStudyFit = {
      category: "strong" as const,
      explanation:
        `${candidate.identity.canonicalTitle} falls inside the confirmed study period, while organization-level coverage still needs verification.`,
      evidenceSourceIds: [candidate.sourceIds[0]!],
    };
    const partial = applyScreen02FindCandidateDraftReceipt(
      state,
      createScreen02FindDraftReceipt({
        receiptId: "candidate-partial-source-fallback-receipt",
        kind: "find-candidate",
        receivedAt: "2026-08-10T18:50:02.000Z",
        submissions: [{
          requestId,
          requestProof: screen02FindRequestProof(request),
          draft: { studyFit: aiStudyFit },
        }],
      }),
    );
    expect(partial.results[0]).toMatchObject({
      status: "partial",
      acceptedPartIds: ["studyFit"],
    });

    const completed = applyScreen02FindCandidateSourceFallback(
      partial.state,
      requestId,
      "2026-08-10T18:50:03.000Z",
    );
    const completedRequest = completed.state.assessmentRequests.find(
      (item) => item.requestId === requestId,
    )!;

    expect(completed.state.assessments).toHaveLength(1);
    expect(completed.assessment.studyFit).toEqual(aiStudyFit);
    expect(completed.assessment.outcomePathway).toMatchObject({
      category: "plausible",
    });
    expect(completed.assessment.outcomePathway?.explanation).toContain(
      "privacy-engineering and compliance work that may redirect research and development",
    );
    expect(completed.assessment.outcomePathway?.explanation).toContain(
      "not an observed or established causal effect",
    );
    expect(completed.assessment.outcomePathway?.explanation).not.toContain(
      "bounded sources do not establish how",
    );
    expect(completed.assessment.measurementPotential).toMatchObject({
      category: "unclear",
    });
    expect(completed.assessment.acceptedFields).toEqual(
      expect.arrayContaining([...screen02FindAssessmentPartIds]),
    );
    expect(completedRequest).toMatchObject({
      status: "completed",
      receiptIds: ["candidate-partial-source-fallback-receipt"],
      acceptedPartIds: [...screen02FindAssessmentPartIds],
    });
    expect(completedRequest.lifecycle).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "draft-received",
          actor: "chatgpt-host",
        }),
        expect.objectContaining({ status: "partial" }),
        expect.objectContaining({
          status: "completed",
          note:
            SCREEN_02_FIND_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE,
        }),
      ]),
    );
    expect(restoreScreen02FindState(completed.state)).not.toBeNull();
  });

  it("gives CCPA and Profitability a practical fixed-fallback hypothesis without claiming a causal result", () => {
    const completed = completeFirstCandidateWithSourceFallback(
      buildFindFactsState({
        candidate: "ccpa",
        outcomeFamily: "Profitability",
      }),
      "ccpa-profitability-source-fallback",
    );
    const pathway = completed.assessment.outcomePathway;

    expect(pathway).toMatchObject({
      category: "plausible",
      evidenceSourceIds: ["ccpa-official"],
    });
    expect(pathway?.explanation).toContain(
      "California Consumer Privacy Act could plausibly affect Profitability",
    );
    expect(pathway?.explanation).toContain(
      "compliance, technology, and data-governance costs",
    );
    expect(pathway?.explanation).toContain("data-enabled products");
    expect(pathway?.explanation).toContain("fines, litigation");
    expect(pathway?.explanation).toContain(
      "trust, retention, or loss-avoidance benefits",
    );
    expect(pathway?.explanation).toContain(
      "not an observed or established causal effect",
    );
    expect(pathway?.explanation).toContain(
      "direction and magnitude for Profitability remain unknown",
    );
    expect(pathway?.explanation).not.toContain(
      "bounded sources do not establish how",
    );
    expect(completed.assessment.overallJudgment).toBe("not-enough-evidence");
  });

  it("uses event-relevant mechanisms for a non-privacy fixed fallback", () => {
    const completed = completeFirstCandidateWithSourceFallback(
      buildFindFactsState({
        candidate: "minimum-wage",
        outcomeFamily: "Profitability",
      }),
      "minimum-wage-profitability-source-fallback",
    );
    const pathway = completed.assessment.outcomePathway;

    expect(pathway).toMatchObject({
      category: "plausible",
      evidenceSourceIds: ["california-minimum-wage-official"],
    });
    expect(pathway?.explanation).toContain(
      "California Statewide Minimum Wage Increase could plausibly affect Profitability",
    );
    expect(pathway?.explanation).toContain("labor and compliance costs");
    expect(pathway?.explanation).toContain(
      "staffing, scheduling, productivity, and retention",
    );
    expect(pathway?.explanation).toContain("prices and demand");
    expect(pathway?.explanation).not.toContain("data-enabled products");
    expect(pathway?.explanation).toContain(
      "not an observed or established causal effect",
    );
  });

  it("uses curated event-domain data for an acronym-only reviewed privacy event", () => {
    const state = structuredClone(buildFindFactsState({
      candidate: "ccpa",
      outcomeFamily: "Innovation",
    }));
    const candidate = state.candidates[0];
    if (!candidate) throw new Error("Expected one reviewed event candidate.");
    candidate.identity.canonicalTitle = "CPRA";
    candidate.identity.commonNames = [];
    candidate.identity.formalIdentifier = null;
    candidate.description.text =
      "The enacted measure changes covered-business obligations and enforcement exposure.";
    candidate.broadCoverage = [];

    const completed = completeFirstCandidateWithSourceFallback(
      refreshFirstCandidateFingerprint(state),
      "curated-alias-domain-source-fallback",
    );
    expect(completed.assessment.outcomePathway?.explanation).toContain(
      "privacy-engineering and compliance work",
    );
    expect(completed.assessment.outcomePathway?.explanation).toContain(
      "data-enabled product experiments",
    );
  });

  it("uses generic privacy evidence for an unfamiliar named event", () => {
    const state = structuredClone(buildFindFactsState({
      candidate: "ccpa",
      outcomeFamily: "Profitability",
    }));
    const candidate = state.candidates[0];
    if (!candidate) throw new Error("Expected one unfamiliar event candidate.");
    candidate.identity.canonicalTitle =
      "Quebec Personal Information Modernization Statute";
    candidate.identity.commonNames = ["Law 25 modernization"];
    candidate.identity.formalIdentifier = null;
    candidate.description.text =
      "The statute changes personal information governance and compliance obligations for covered organizations.";
    candidate.broadCoverage = [];

    const completed = completeFirstCandidateWithSourceFallback(
      refreshFirstCandidateFingerprint(state),
      "unfamiliar-privacy-domain-source-fallback",
    );
    expect(completed.assessment.outcomePathway?.explanation).toContain(
      "compliance, technology, and data-governance costs",
    );
    expect(completed.assessment.outcomePathway?.explanation).toContain(
      "data-enabled products",
    );
  });

  it("tailors one privacy shock to Innovation instead of repeating its Profitability channels", () => {
    const completed = completeFirstCandidateWithSourceFallback(
      buildFindFactsState({
        candidate: "ccpa",
        outcomeFamily: "Innovation",
      }),
      "ccpa-innovation-source-fallback",
    );
    const pathway = completed.assessment.outcomePathway;

    expect(pathway).toMatchObject({
      category: "plausible",
      evidenceSourceIds: ["ccpa-official"],
    });
    expect(pathway?.explanation).toContain(
      "privacy-engineering and compliance work that may redirect research and development",
    );
    expect(pathway?.explanation).toContain(
      "data-enabled product experiments",
    );
    expect(pathway?.explanation).toContain(
      "trust or customer adoption that may change incentives to innovate",
    );
    expect(pathway?.explanation).not.toContain(
      "data-enabled products, advertising, and revenue",
    );
    expect(pathway?.explanation).not.toContain("fines, litigation");
    expect(pathway?.explanation).toContain(
      "direction and magnitude for Innovation remain unknown",
    );
  });

  it("does not convert an unlinked candidate source into sourced outcome plausibility", () => {
    const unlinked = structuredClone(buildFindFactsState({
      candidate: "ccpa",
      outcomeFamily: "Profitability",
    }));
    const candidate = unlinked.candidates[0];
    if (!candidate) throw new Error("Expected the CCPA Find candidate.");
    candidate.description.sourceIds = [];
    for (const lead of candidate.dateLeads) lead.sourceIds = [];
    for (const claim of candidate.broadCoverage) claim.sourceIds = [];

    const completed = completeFirstCandidateWithSourceFallback(
      refreshFirstCandidateFingerprint(unlinked),
      "ccpa-unlinked-source-fallback",
    );
    expect(completed.assessment.outcomePathway).toMatchObject({
      category: "unclear",
      evidenceSourceIds: [],
    });
    expect(completed.assessment.outcomePathway?.explanation).toContain(
      "No source-linked description or coverage content currently supports this hypothesis",
    );
    expect(completed.assessment.outcomePathway?.explanation).not.toContain(
      candidate.description.text,
    );
  });

  it("keeps a date-only packet unclear and does not classify from unlinked event text", () => {
    const dateOnly = structuredClone(buildFindFactsState({
      candidate: "ccpa",
      outcomeFamily: "Profitability",
    }));
    const candidate = dateOnly.candidates[0];
    if (!candidate) throw new Error("Expected the CCPA Find candidate.");
    const unlinkedCoverageText = candidate.broadCoverage[0]?.text;
    if (!unlinkedCoverageText) throw new Error("Expected CCPA coverage text.");
    candidate.identity.canonicalTitle = "Illustrative Consumer Act";
    candidate.identity.commonNames = [];
    candidate.identity.formalIdentifier = "Illustrative Act 1";
    candidate.identity.issuer = "Example Legislature";
    candidate.identity.issuingJurisdiction = "Exampleland";
    candidate.description.sourceIds = [];
    for (const claim of candidate.broadCoverage) claim.sourceIds = [];

    const completed = completeFirstCandidateWithSourceFallback(
      refreshFirstCandidateFingerprint(dateOnly),
      "date-only-source-fallback",
    );
    expect(completed.assessment.outcomePathway).toMatchObject({
      category: "unclear",
      evidenceSourceIds: [],
    });
    expect(completed.assessment.studyFit?.evidenceSourceIds).toEqual([
      "ccpa-official",
    ]);
    expect(completed.assessment.studyFit?.explanation).toContain(
      "2020-01-01 (effective: Operative date lead)",
    );
    expect(completed.assessment.studyFit?.explanation).not.toContain(
      candidate.description.text,
    );
    expect(completed.assessment.studyFit?.explanation).not.toContain(
      unlinkedCoverageText,
    );
    expect(completed.assessment.outcomePathway?.explanation).toContain(
      "implementation and ongoing compliance costs",
    );
    expect(completed.assessment.outcomePathway?.explanation).not.toContain(
      "data-governance costs",
    );
    expect(completed.assessment.outcomePathway?.explanation).not.toContain(
      candidate.description.text,
    );
    expect(completed.assessment.outcomePathway?.explanation).not.toContain(
      unlinkedCoverageText,
    );
  });

  it("uses only linked coverage narration and evidence when description and dates are unlinked", () => {
    const coverageOnly = structuredClone(buildFindFactsState({
      candidate: "ccpa",
      outcomeFamily: "Profitability",
    }));
    const candidate = coverageOnly.candidates[0];
    if (!candidate) throw new Error("Expected the CCPA Find candidate.");
    const linkedCoverageText = candidate.broadCoverage[0]?.text;
    if (!linkedCoverageText) throw new Error("Expected CCPA coverage text.");
    candidate.description.sourceIds = [];
    for (const lead of candidate.dateLeads) lead.sourceIds = [];

    const completed = completeFirstCandidateWithSourceFallback(
      refreshFirstCandidateFingerprint(coverageOnly),
      "coverage-only-source-fallback",
    );
    expect(completed.assessment.outcomePathway).toMatchObject({
      category: "plausible",
      evidenceSourceIds: ["ccpa-official"],
    });
    expect(completed.assessment.outcomePathway?.explanation).toContain(
      "The source-linked coverage record says",
    );
    expect(completed.assessment.outcomePathway?.explanation).toContain(
      linkedCoverageText,
    );
    expect(completed.assessment.outcomePathway?.explanation).not.toContain(
      candidate.description.text,
    );
    expect(completed.assessment.measurementPotential?.evidenceSourceIds).toEqual([
      "ccpa-official",
    ]);
    expect(completed.assessment.measurementPotential?.explanation).toContain(
      "no source-backed operative date",
    );
  });

  it("exhausts a wholly invalid candidate job on attempt 3 with zero accepted parts", () => {
    let state = prepareCandidate(
      buildFindFactsState(),
      "candidate-retry-1",
      "2026-08-10T19:00:00.000Z",
    );
    let applied = applyInvalidCandidate(
      state,
      "candidate-retry-1",
      "2026-08-10T19:00:01.000Z",
    );
    expect(applied.results[0]?.status).toBe("validation-failed");
    state = retryScreen02FindAssessmentRequest(applied.state, {
      priorRequestId: "candidate-retry-1",
      requestId: "candidate-retry-2",
      at: "2026-08-10T19:00:02.000Z",
    });
    applied = applyInvalidCandidate(
      state,
      "candidate-retry-2",
      "2026-08-10T19:00:03.000Z",
    );
    state = retryScreen02FindAssessmentRequest(applied.state, {
      priorRequestId: "candidate-retry-2",
      requestId: "candidate-retry-3",
      at: "2026-08-10T19:00:04.000Z",
    });
    applied = applyInvalidCandidate(
      state,
      "candidate-retry-3",
      "2026-08-10T19:00:05.000Z",
    );

    expect(applied.results[0]).toMatchObject({
      status: "retry-exhausted",
      acceptedPartIds: [],
    });
    expect(
      applied.state.assessmentRequests.find(
        (request) => request.requestId === "candidate-retry-3",
      ),
    ).toMatchObject({
      status: "retry-exhausted",
      acceptedPartIds: [],
      failures: expect.arrayContaining([
        expect.objectContaining({ partId: "studyFit" }),
        expect.objectContaining({ partId: "nextChecks" }),
      ]),
    });
    expect(applied.state.assessments).toEqual([]);
    expect(restoreScreen02FindState(applied.state)).not.toBeNull();
  });

  it("records a technical-failure finding when a one-part criterion exhausts", () => {
    let state = replaceScreen02FindCriteria(
      buildFindFactsState(),
      [
        {
          criterionId: "government-imposed",
          kind: "only-include",
          text: "Government imposed",
          exactRequest: "Only include events imposed by a government authority.",
          source: "researcher",
        },
      ],
      {
        at: "2026-08-10T19:10:00.000Z",
        successorCandidateSetSnapshotId: "criterion-set-v1",
        reason: "Add a strict criterion.",
      },
    );
    const partId = "gdpr-candidate-snapshot-v1:government-imposed:1";
    state = prepareScreen02AssessmentRequest(state, {
      mode: "find-criterion",
      candidateSnapshotId: "gdpr-candidate-snapshot-v1",
      criterionId: "government-imposed",
      criterionVersion: 1,
      jobId: "criterion-retry-job",
      requestId: "criterion-retry-1",
      attempt: 1,
      requestedPartIds: [partId],
      at: "2026-08-10T19:10:01.000Z",
    }) as Screen02FindState;
    let applied = applyInvalidCriterion(
      state,
      "criterion-retry-1",
      "2026-08-10T19:10:02.000Z",
    );
    state = retryScreen02FindAssessmentRequest(applied.state, {
      priorRequestId: "criterion-retry-1",
      requestId: "criterion-retry-2",
      at: "2026-08-10T19:10:03.000Z",
    });
    applied = applyInvalidCriterion(
      state,
      "criterion-retry-2",
      "2026-08-10T19:10:04.000Z",
    );
    state = retryScreen02FindAssessmentRequest(applied.state, {
      priorRequestId: "criterion-retry-2",
      requestId: "criterion-retry-3",
      at: "2026-08-10T19:10:05.000Z",
    });
    applied = applyInvalidCriterion(
      state,
      "criterion-retry-3",
      "2026-08-10T19:10:06.000Z",
    );

    expect(applied.results[0]?.status).toBe("retry-exhausted");
    const finalFailure = applied.results[0]?.failures[0];
    expect(finalFailure?.codes).toContain("invalid-criterion-draft-shape");
    expect(finalFailure?.codes).toHaveLength(
      new Set(finalFailure?.codes ?? []).size,
    );
    expect(applied.state.criterionFindings).toContainEqual(
      expect.objectContaining({
        requestId: "criterion-retry-3",
        result: "technical-failure",
        evidenceSourceIds: [],
      }),
    );
    expect(screen02FindCandidateGate(
      applied.state,
      "gdpr-candidate-snapshot-v1",
    ).eligible).toBe(false);
  });

  it("keeps semantic targets alive across unrelated criterion-set successors", () => {
    let state = prepareCandidate(
      buildFindFactsState(),
      "stable-candidate-request",
      "2026-08-10T19:20:00.000Z",
    );
    state = replaceScreen02FindCriteria(
      state,
      [
        {
          criterionId: "public-data",
          kind: "rank-higher",
          text: "Public exposure data",
          exactRequest: "Rank events with public exposure data higher.",
          source: "researcher",
        },
      ],
      {
        at: "2026-08-10T19:20:01.000Z",
        successorCandidateSetSnapshotId: "stable-target-set-v2",
        reason: "Add an unrelated ranking preference.",
      },
    );
    state = prepareScreen02AssessmentRequest(state, {
      mode: "find-criterion",
      candidateSnapshotId: "gdpr-candidate-snapshot-v1",
      criterionId: "public-data",
      criterionVersion: 1,
      jobId: "stable-criterion-job",
      requestId: "stable-criterion-request",
      attempt: 1,
      requestedPartIds: ["gdpr-candidate-snapshot-v1:public-data:1"],
      at: "2026-08-10T19:20:02.000Z",
    }) as Screen02FindState;
    state = replaceScreen02FindCriteria(
      state,
      [
        {
          criterionId: "public-data",
          kind: "rank-higher",
          text: "Public exposure data",
          exactRequest: "Rank events with public exposure data higher.",
          source: "researcher",
        },
        {
          criterionId: "government-imposed",
          kind: "only-include",
          text: "Government imposed",
          exactRequest: "Only include government-imposed events.",
          source: "researcher",
        },
      ],
      {
        at: "2026-08-10T19:20:03.000Z",
        successorCandidateSetSnapshotId: "stable-target-set-v3",
        reason: "Add an unrelated strict criterion.",
      },
    );
    const request = state.assessmentRequests.find(
      (item) => item.requestId === "stable-candidate-request",
    )!;
    expect(request.status).toBe("prepared");
    expect(request.target).not.toHaveProperty("candidateSetSnapshotId");
    expect(request.target).not.toHaveProperty("candidateSetFingerprint");
    expect(
      state.assessmentRequests.find(
        (item) => item.requestId === "stable-criterion-request",
      )?.status,
    ).toBe("prepared");
    expect(() =>
      markScreen02FindRequestsDelivered(
        state,
        ["stable-candidate-request", "stable-criterion-request"],
        { at: "2026-08-10T19:20:04.000Z", delivered: true },
      ),
    ).not.toThrow();
  });

  it("orders by explicit ranking criteria and source strength, never the hidden preliminary judgment", () => {
    const state = buildOrderingState();
    const expectedSourceOrder = [
      "gamma-snapshot-v1",
      "beta-snapshot-v1",
      "alpha-snapshot-v1",
    ];
    const coreOrder = (value: Screen02FindState) =>
      deriveScreen02FindComparison(value).map(
        (row) => row.candidate.candidateSnapshotId,
      );
    const viewOrder = (value: Screen02FindState) =>
      buildScreen02FindViewModel(value).comparison.map(
        (row) => row.candidate.candidateSnapshotId,
      );

    expect(
      state.assessments.map((assessment) => [
        assessment.candidateSnapshotId,
        assessment.overallJudgment,
      ]),
    ).toEqual([
      ["alpha-snapshot-v1", "promising-to-verify"],
      ["beta-snapshot-v1", "low-priority"],
      ["gamma-snapshot-v1", "low-priority"],
    ]);
    expect(coreOrder(state)).toEqual(expectedSourceOrder);
    expect(viewOrder(state)).toEqual(expectedSourceOrder);
    expect(deriveScreen02FindComparison(state)[0]?.orderingReason).toBe(
      "Ordered by any met Rank higher criteria, source authority, source count, and stable title and record tie-breakers.",
    );
    expect(
      buildScreen02FindViewModel(state).comparison[0]?.orderingReason,
    ).not.toMatch(/judgment|assessment/i);

    const rejudgedRaw = cloneFixture(state);
    const alpha = rejudgedRaw.assessments.find(
      (assessment) =>
        assessment.candidateSnapshotId === "alpha-snapshot-v1",
    )!;
    alpha.studyFit!.category = "weak";
    alpha.outcomePathway!.category = "unsupported";
    alpha.measurementPotential!.category = "implausible";
    alpha.overallJudgment = "low-priority";
    const gamma = rejudgedRaw.assessments.find(
      (assessment) =>
        assessment.candidateSnapshotId === "gamma-snapshot-v1",
    )!;
    gamma.studyFit!.category = "strong";
    gamma.outcomePathway!.category = "plausible";
    gamma.measurementPotential!.category = "possible";
    gamma.overallJudgment = "promising-to-verify";
    const rejudged = requireScreen02FindState(rejudgedRaw);
    expect(coreOrder(rejudged)).toEqual(expectedSourceOrder);
    expect(viewOrder(rejudged)).toEqual(expectedSourceOrder);

    let ranked = replaceScreen02FindCriteria(
      rejudged,
      [
        {
          criterionId: "preferred-design",
          kind: "rank-higher",
          text: "Preferred research design",
          exactRequest: "Rank candidates matching the preferred design higher.",
          source: "researcher",
        },
      ],
      {
        at: "2026-08-10T19:30:18.000Z",
        successorCandidateSetSnapshotId: "ordering-set-v2",
        reason: "Add the researcher's explicit ordering preference.",
      },
    );
    const criterionPartId = "alpha-snapshot-v1:preferred-design:1";
    ranked = prepareScreen02AssessmentRequest(ranked, {
      mode: "find-criterion",
      candidateSnapshotId: "alpha-snapshot-v1",
      criterionId: "preferred-design",
      criterionVersion: 1,
      jobId: "alpha-preferred-design-job",
      requestId: "alpha-preferred-design-request",
      attempt: 1,
      requestedPartIds: [criterionPartId],
      at: "2026-08-10T19:30:19.000Z",
    }) as Screen02FindState;
    for (const transition of [
      {
        status: "message-delivered" as const,
        at: "2026-08-10T19:30:20.000Z",
        actor: "chatgpt-host" as const,
      },
      {
        status: "draft-received" as const,
        at: "2026-08-10T19:30:21.000Z",
        actor: "chatgpt-host" as const,
        receiptId: "alpha-preferred-design-receipt",
      },
      {
        status: "validating" as const,
        at: "2026-08-10T19:30:22.000Z",
        actor: "fixed-core" as const,
      },
    ]) {
      ranked = transitionScreen02AssessmentRequest(ranked, {
        requestId: "alpha-preferred-design-request",
        ...transition,
      }) as Screen02FindState;
    }
    ranked = finalizeScreen02FindCriterionAssessmentRequest(ranked, {
      requestId: "alpha-preferred-design-request",
      status: "completed",
      at: "2026-08-10T19:30:23.000Z",
      note: "The explicit ranking criterion passed fixed validation.",
      acceptedPartIds: [criterionPartId],
      failures: [],
      finding: {
        findingId: "alpha-preferred-design-finding",
        candidateSnapshotId: "alpha-snapshot-v1",
        criterionId: "preferred-design",
        criterionVersion: 1,
        result: "meets",
        reason: "The attached source supports the researcher's preferred design criterion.",
        evidenceSourceIds: ["alpha-source"],
        method: "source-backed-ai",
        requestId: "alpha-preferred-design-request",
        recordedAt: "2026-08-10T19:30:23.000Z",
        overrides: [],
      },
    });

    expect(coreOrder(ranked)).toEqual([
      "alpha-snapshot-v1",
      "gamma-snapshot-v1",
      "beta-snapshot-v1",
    ]);
    expect(viewOrder(ranked)).toEqual([
      "alpha-snapshot-v1",
      "gamma-snapshot-v1",
      "beta-snapshot-v1",
    ]);
  });

  it("prompts one singular capability-bound tool call per request", () => {
    const state = prepareCandidate(
      buildFindFactsState(),
      "prompt-candidate-request",
      "2026-08-10T19:25:00.000Z",
    );
    const prompt = buildScreen02FindAssessmentPrompt(
      buildScreen02FindModelContext(state, ["prompt-candidate-request"]),
    );

    expect(prompt).toContain(SCREEN_02_FIND_SUBMIT_DRAFT_TOOL_V021);
    expect(prompt.match(/submit_screen02_find_assessment_draft_v021/g)).toHaveLength(1);
    expect(prompt).toContain("one request per call");
    expect(prompt).toContain("capabilityToken");
    expect(prompt).toContain("exact requestId");
    expect(prompt).toContain("do not pass requestProof as a tool argument");
    expect(prompt).not.toContain("submit_screen02_find_candidate_drafts_v021");
    expect(prompt).not.toContain("submit_screen02_find_criterion_drafts_v021");
  });

  it("requires candidate-specific, decision-useful comparisons in the model context and prompt", () => {
    const state = prepareCandidate(
      buildFindFactsState(),
      "decision-usefulness-request",
      "2026-08-10T19:26:00.000Z",
    );
    const context = buildScreen02FindModelContext(state, [
      "decision-usefulness-request",
    ]);
    const prompt = buildScreen02FindAssessmentPrompt(context);
    const instructions = context.candidateAssessmentInstructions;

    expect(instructions.crossCandidateComparison).toContain(
      "Do not reuse interchangeable prose",
    );
    expect(instructions.studyFit).toContain("study period");
    expect(instructions.studyFit).toContain("issuing jurisdiction");
    expect(instructions.studyFit).toContain("study population");
    expect(instructions.studyFit).toContain("industry when supplied");
    expect(instructions.studyFit).toContain(
      "affect the research sample",
    );
    expect(instructions.studyFit).toContain(
      "AI inference to verify",
    );
    expect(instructions.studyFit).toContain(
      "When coverage is missing",
    );
    expect(instructions.outcomePathway).toContain(
      "candidate-specific mechanism",
    );
    expect(instructions.outcomePathway).toContain(
      "affect the confirmed outcome family",
    );
    expect(instructions.outcomePathway).toContain(
      "compliance and technology costs",
    );
    expect(instructions.outcomePathway).toContain("data-enabled revenue");
    expect(instructions.outcomePathway).toContain("fines or litigation");
    expect(instructions.outcomePathway).toContain(
      "trust, retention, or loss-avoidance benefits",
    );
    expect(instructions.outcomePathway).toContain(
      "not an established causal effect",
    );
    expect(instructions.measurementPotential).toContain(
      "observable timing, coverage, or exposure indicators",
    );
    expect(instructions.measurementPotential).toContain("data still missing");
    expect(instructions.mainConcern).toContain(
      "single strongest candidate-specific concern",
    );
    expect(instructions.nextChecks).toContain(
      "change this candidate's category, ordering, or selectability",
    );
    expect(prompt).toContain(
      "exact study population, supplied industry, geography, and period",
    );
    expect(prompt).toContain("issuing jurisdiction");
    expect(prompt).toContain(
      "comparison targets only, never candidate evidence",
    );
    expect(prompt).toContain(
      "When broadCoverage is empty, it may cautiously estimate",
    );
    expect(prompt).toContain("observable indicators and missing");
    expect(prompt).toContain(
      "Do not default to unclear merely because verification work remains",
    );
    expect(prompt).toContain(
      "The cited sources support the underlying event facts; they need not estimate the realized outcome",
    );
    expect(prompt).toContain(
      "Do not answer only that the bounded sources do not establish the effect",
    );
    expect(prompt).toContain("compliance and technology costs");
    expect(prompt).toContain("data-enabled revenue");
    expect(prompt).toContain("fines or litigation exposure");
    expect(prompt).toContain("not an observed or established causal effect");
    expect(prompt).toContain("direction and magnitude remain unknown");
    expect(prompt).toContain("discriminating next checks");
    expect(prompt).toContain("Do not reuse generic or interchangeable reasoning");
    expect(context.purpose).toContain(
      "study block preserves researcher-confirmed scope only as a comparison target",
    );
    expect(context.exclusions.join(" ")).toContain(
      "Never treat the researcher-confirmed study population, industry, geography",
    );
  });

  it("rejects source-ID-correct boilerplate that never identifies the candidate", () => {
    const requestId = "anti-boilerplate-request";
    const prepared = prepareCandidate(
      buildFindFactsState(),
      requestId,
      "2026-08-10T19:27:00.000Z",
    );
    const delivered = markScreen02FindRequestsDelivered(prepared, [requestId], {
      at: "2026-08-10T19:27:01.000Z",
      delivered: true,
    });
    const request = delivered.assessmentRequests.find(
      (item) => item.requestId === requestId,
    )!;
    const applied = applyScreen02FindCandidateDraftReceipt(
      delivered,
      createScreen02FindDraftReceipt({
        receiptId: "anti-boilerplate-receipt",
        kind: "find-candidate",
        receivedAt: "2026-08-10T19:27:02.000Z",
        submissions: [
          {
            requestId,
            requestProof: screen02FindRequestProof(request),
            draft: {
              studyFit: {
                category: "strong",
                explanation:
                  "The event appears to fall in the requested period and may affect sampled firms.",
                evidenceSourceIds: ["gdpr-official"],
              },
              outcomePathway: {
                category: "plausible",
                explanation:
                  "Compliance activity could redirect staff effort and change the selected outcome.",
                evidenceSourceIds: ["gdpr-official"],
              },
              measurementPotential: {
                category: "possible",
                explanation:
                  "Public indicators may support a preliminary exposure classification.",
                evidenceSourceIds: ["gdpr-official"],
              },
              mainConcern:
                "Formal coverage of individual sampled organizations remains unverified.",
              nextChecks: [
                "Verify organizational coverage before constructing a measure.",
              ],
            },
          },
        ],
      }),
    );

    expect(applied.results[0]).toMatchObject({
      status: "validation-failed",
      acceptedPartIds: [],
    });
    expect(
      applied.results[0]?.failures.flatMap((failure) => failure.codes),
    ).toContain("candidate-identity-grounding-missing");
    expect(applied.state.assessments).toEqual([]);
  });

  it("rejects restored candidate result statuses that were not written atomically", () => {
    let state = prepareCandidate(
      buildFindFactsState(),
      "non-atomic-request",
      "2026-08-10T19:30:00.000Z",
    );
    for (const transition of [
      {
        status: "message-delivered" as const,
        at: "2026-08-10T19:30:01.000Z",
        actor: "chatgpt-host" as const,
      },
      {
        status: "draft-received" as const,
        at: "2026-08-10T19:30:02.000Z",
        actor: "chatgpt-host" as const,
        receiptId: "non-atomic-receipt",
      },
      {
        status: "validating" as const,
        at: "2026-08-10T19:30:03.000Z",
        actor: "fixed-core" as const,
      },
    ]) {
      state = transitionScreen02AssessmentRequest(state, {
        requestId: "non-atomic-request",
        ...transition,
      }) as Screen02FindState;
    }
    const completed = cloneFixture(state);
    const request = completed.assessmentRequests[0]!;
    request.status = "completed";
    request.updatedAt = "2026-08-10T19:30:04.000Z";
    request.acceptedPartIds = [...screen02FindAssessmentPartIds];
    request.lifecycle.push({
      status: "completed",
      at: request.updatedAt,
      actor: "fixed-core",
      note: "Tampered completion without an assessment.",
    });
    completed.updatedAt = request.updatedAt;
    completed.revision += 1;
    expect(restoreScreen02FindState(completed)).toBeNull();

    const partial = cloneFixture(state);
    const partialRequest = partial.assessmentRequests[0]!;
    partialRequest.status = "partial";
    partialRequest.updatedAt = "2026-08-10T19:30:04.000Z";
    partialRequest.acceptedPartIds = ["studyFit"];
    partialRequest.failures = screen02FindAssessmentPartIds
      .filter((partId) => partId !== "studyFit")
      .map((partId) => ({ partId, codes: ["invalid"] }));
    partialRequest.lifecycle.push({
      status: "partial",
      at: partialRequest.updatedAt,
      actor: "fixed-core",
      note: "Tampered partial result without an assessment.",
    });
    partial.updatedAt = partialRequest.updatedAt;
    partial.revision += 1;
    expect(restoreScreen02FindState(partial)).toBeNull();
  });

  it("records discovery terminals, pure comparison, open-cleared, and removal without deleting facts", () => {
    let blank = createScreen02FindState(
      confirmedWorkflowFindContext(),
      "discovery-lifecycle-run",
      "2026-08-10T19:40:00.000Z",
    );
    blank = beginScreen02FindDiscovery(blank, {
      discoveryRequestId: "discovery-1",
      searchRoundId: "round-1",
      candidateSetSnapshotId: "set-1",
      exactRequest: "First bounded search.",
      at: "2026-08-10T19:40:01.000Z",
    });
    blank = beginScreen02FindDiscovery(blank, {
      discoveryRequestId: "discovery-2",
      searchRoundId: "round-2",
      candidateSetSnapshotId: "set-2",
      exactRequest: "Second bounded search.",
      at: "2026-08-10T19:40:02.000Z",
    });
    blank = failScreen02FindDiscovery(blank, {
      discoveryRequestId: "discovery-2",
      failureCodes: ["registry-unavailable"],
      at: "2026-08-10T19:40:03.000Z",
      note: "The bounded registry search failed.",
    });
    expect(blank.discoveryRequests.map((request) => request.status)).toEqual([
      "superseded",
      "failed",
    ]);
    expect(restoreScreen02FindState(blank)).not.toBeNull();
    blank = beginScreen02FindDiscovery(blank, {
      discoveryRequestId: "discovery-3",
      searchRoundId: "round-3",
      candidateSetSnapshotId: "set-3",
      exactRequest: "Empty bounded search.",
      at: "2026-08-10T19:40:04.000Z",
    });
    const emptyManifest = workflowManifest("Empty bounded search.", 0);
    emptyManifest.retrievedAt = "2026-08-10T19:40:05.000Z";
    emptyManifest.retainedResultBinding =
      buildScreen02RetainedResultBinding(
        "find",
        { sourceRecordsRetrieved: 0, uniqueEventLeads: 0 },
        [],
      );
    blank = completeScreen02FindDiscovery(blank, {
      discoveryRequestId: "discovery-3",
      at: "2026-08-10T19:40:06.000Z",
      sources: [],
      candidates: [],
      manifest: emptyManifest,
    });
    expect(blank.discoveryRequests.at(-1)?.status).toBe("completed-empty");

    const ready = buildReadyFindState();
    const before = JSON.stringify(ready);
    const orderingBefore = cloneFixture(ready.candidateSets[0]!.ordering);
    deriveScreen02FindComparison(ready);
    expect(JSON.stringify(ready)).toBe(before);
    expect(ready.candidateSets[0]!.ordering).toEqual(orderingBefore);

    let state = openScreen02FindCandidate(buildFindFactsState(), {
      candidateSnapshotId: "gdpr-candidate-snapshot-v1",
      decisionId: "open-before-clear",
      at: "2026-08-10T19:40:10.000Z",
    });
    state = clearScreen02FindOpenedCandidate(state, {
      decisionId: "clear-open",
      at: "2026-08-10T19:40:11.000Z",
      reason: "Close the detail panel.",
    });
    expect(state.decision.history.at(-1)?.action).toBe("open-cleared");
    state = removeScreen02FindCandidate(state, {
      candidateSnapshotId: "gdpr-candidate-snapshot-v1",
      successorCandidateSetSnapshotId: "removed-set-v2",
      decisionId: "remove-candidate",
      at: "2026-08-10T19:40:12.000Z",
      reason: "Remove this lead from the active comparison.",
    });
    expect(state.candidates).toHaveLength(1);
    expect(
      state.candidateSets.find(
        (set) => set.candidateSetSnapshotId === state.activeCandidateSetSnapshotId,
      )?.candidateSnapshotIds,
    ).toEqual([]);
    expect(state.decision.history.at(-1)?.action).toBe("removed");
    expect(
      screen02FindCandidateGate(state, "gdpr-candidate-snapshot-v1").eligible,
    ).toBe(false);

    const continued = buildReadyFindState();
    expect(() =>
      openScreen02FindCandidate(continued, {
        candidateSnapshotId: "gdpr-candidate-snapshot-v1",
        decisionId: "late-open",
        at: "2026-08-10T19:40:20.000Z",
      }),
    ).toThrow(/sealed/i);
    const selectedRaw = cloneFixture(continued);
    selectedRaw.decision.history = selectedRaw.decision.history.filter(
      (event) => event.action !== "continued",
    );
    selectedRaw.decision.continuedRevision = null;
    const selected = requireScreen02FindState(selectedRaw);
    expect(() =>
      removeScreen02FindCandidate(selected, {
        candidateSnapshotId: "gdpr-candidate-snapshot-v1",
        successorCandidateSetSnapshotId: "blocked-removal-set",
        decisionId: "blocked-removal",
        at: "2026-08-10T19:40:21.000Z",
        reason: "Attempt removal while selected.",
      }),
    ).toThrow(/selected candidate/i);
  });
});
