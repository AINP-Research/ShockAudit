import { describe, expect, it } from "vitest";

import {
  applyReviewedScreen02FindDiscovery,
} from "../../src/core/screen02-find-discovery";
import {
  activeScreen02FindCriteria,
  beginScreen02FindDiscovery,
  completeScreen02FindDiscovery,
  markScreen02FindRequestsDelivered,
  openScreen02FindCandidate,
  prepareScreen02FindAssessmentJobs,
  replaceScreen02FindCriteria,
  updateScreen02FindRelevanceProfile,
} from "../../src/core/screen02-find-workflow";
import {
  buildScreen02WorkflowHandoff,
  restoreScreen02WorkflowHandoff,
} from "../../src/core/screen02-workflow-handoff";
import {
  decodeScreen02FindWorkflowStateEnvelope,
  encodeScreen02FindWorkflowStateEnvelope,
  screen02FindWorkflowEnvelopeIdentity,
} from "../../src/core/screen02-workflow-envelope";
import {
  continueScreen02FindCandidate,
  createScreen02FindState,
  requireScreen02FindState,
  screen02FindCandidateGate,
  selectScreen02FindCandidate,
} from "../../src/core/screen02-workflow-state";
import type {
  Screen02FindState,
} from "../../src/core/screen02-workflow-types";
import {
  SCREEN_02_FIND_DRAFT_SUBMISSION_SCHEMA_VERSION,
  createScreen02FindAssessmentCapability,
  createSignedScreen02FindNormalizedReceipt,
  verifySignedScreen02FindNormalizedReceipt,
  type Screen02FindAssessmentCapability,
  type Screen02FindSigningConfig,
} from "../../src/worker/screen02-find-assessment-security";
import {
  applySignedScreen02FindReceiptEnvelope,
} from "../../src/worker/screen02-find-assessment-service";
import {
  buildSourceQualifiedFindDiscoveryFixture,
  confirmedWorkflowFindContext,
} from "../core/screen02-workflow-fixtures";

const signingConfig: Screen02FindSigningConfig = {
  keyId: "stage3-vertical-key",
  key: "stage3-vertical-test-key-0123456789abcdef",
};

const times = {
  created: "2026-08-10T15:00:00.000Z",
  criteria: "2026-08-10T15:00:01.000Z",
  discoveryStarted: "2026-08-10T15:00:02.000Z",
  discoveryCompleted: "2026-08-10T15:00:03.000Z",
  jobsPrepared: "2026-08-10T15:00:04.000Z",
  capabilityIssued: "2026-08-10T15:00:05.000Z",
  delivered: "2026-08-10T15:00:06.000Z",
  candidateReceived: "2026-08-10T15:00:07.000Z",
  firstCriterionReceived: "2026-08-10T15:00:08.000Z",
  secondCriterionReceived: "2026-08-10T15:00:09.000Z",
  opened: "2026-08-10T15:00:10.000Z",
  selected: "2026-08-10T15:00:11.000Z",
  continued: "2026-08-10T15:00:12.000Z",
  handoffBuilt: "2026-08-10T15:00:13.000Z",
} as const;

const exactRequest =
  "Find a source-backed privacy regulation affecting U.S. publicly listed technology firms between 2016 and 2020 that may influence innovation.";

const goldCriteria = [
  {
    criterionId: "government-imposed",
    kind: "only-include" as const,
    text: "Government imposed",
    exactRequest: "Only include shocks imposed by a government authority.",
    source: "researcher" as const,
  },
  {
    criterionId: "proprietary-employee-data",
    kind: "do-not-show" as const,
    text: "Requires proprietary employee data",
    exactRequest:
      "Do not show shocks that require proprietary employee data to measure exposure.",
    source: "researcher" as const,
  },
] as const;

type PreparedFindScenario = {
  state: Screen02FindState;
  gdprSnapshotId: string;
  peerSnapshotId: string;
  candidateRequestId: string;
  criterionRequestIds: string[];
};

function requestFor(
  state: Screen02FindState,
  candidateSnapshotId: string,
  criterionId?: string,
) {
  const request = state.assessmentRequests.find((item) => {
    if (
      item.target.mode !== "find-candidate" &&
      item.target.mode !== "find-criterion"
    ) {
      return false;
    }
    if (item.target.candidateSnapshotId !== candidateSnapshotId) return false;
    return criterionId
      ? item.target.mode === "find-criterion" &&
          item.target.criterionId === criterionId
      : item.target.mode === "find-candidate";
  });
  if (!request) throw new Error("Expected deterministic Find assessment request.");
  return request;
}

function createPreparedFindScenario(): PreparedFindScenario {
  let state = createScreen02FindState(
    confirmedWorkflowFindContext(),
    "stage3-find-vertical-run",
    times.created,
  );
  state = updateScreen02FindRelevanceProfile(state, {
    edits: {
      regulatedActivities: [
        "personal data processing",
        "consumer privacy",
      ],
    },
    at: "2026-08-10T15:00:00.500Z",
    reason:
      "Exercise the privacy-event lifecycle with explicit researcher relevance vocabulary.",
  });
  state = replaceScreen02FindCriteria(state, goldCriteria, {
    at: times.criteria,
    reason: "Apply the approved Stage 3 gold-example criteria.",
  });

  const discovery = buildSourceQualifiedFindDiscoveryFixture(state, {
    searchRoundId: "stage3-reviewed-round-1",
    at: times.discoveryCompleted,
    exactRequest,
    maximumCandidates: 5,
  });
  state = beginScreen02FindDiscovery(state, {
    discoveryRequestId: "stage3-reviewed-discovery-1",
    candidateSetSnapshotId: "stage3-reviewed-set-1",
    searchRoundId: "stage3-reviewed-round-1",
    exactRequest,
    at: times.discoveryStarted,
  });
  state = completeScreen02FindDiscovery(state, {
    discoveryRequestId: "stage3-reviewed-discovery-1",
    at: times.discoveryCompleted,
    ...discovery,
  });

  const activeSet = state.candidateSets.find(
    (set) => set.candidateSetSnapshotId === state.activeCandidateSetSnapshotId,
  );
  if (!activeSet) throw new Error("Expected an active reviewed candidate set.");
  const activeCriteria = activeScreen02FindCriteria(state);
  state = prepareScreen02FindAssessmentJobs(
    state,
    {
      candidate: activeSet.candidateSnapshotIds.map(
        (candidateSnapshotId, candidateIndex) => ({
          candidateSnapshotId,
          jobId: `stage3-candidate-job-${candidateIndex + 1}`,
          requestId: `stage3-candidate-request-${candidateIndex + 1}`,
        }),
      ),
      criteria: activeSet.candidateSnapshotIds.flatMap(
        (candidateSnapshotId, candidateIndex) =>
          activeCriteria.map((criterion, criterionIndex) => ({
            candidateSnapshotId,
            criterionId: criterion.criterionId,
            criterionVersion: criterion.version,
            jobId: `stage3-criterion-job-${candidateIndex + 1}-${criterionIndex + 1}`,
            requestId: `stage3-criterion-request-${candidateIndex + 1}-${criterionIndex + 1}`,
          })),
      ),
    },
    times.jobsPrepared,
  );

  const gdpr = state.candidates.find(
    (candidate) => candidate.candidateId === "registry-eu-gdpr-2018",
  );
  if (!gdpr) throw new Error("Reviewed discovery must retain GDPR.");
  const peerSnapshotId = activeSet.candidateSnapshotIds.find(
    (candidateSnapshotId) => candidateSnapshotId !== gdpr.candidateSnapshotId,
  );
  if (!peerSnapshotId) throw new Error("Expected at least one comparison peer.");
  return {
    state,
    gdprSnapshotId: gdpr.candidateSnapshotId,
    peerSnapshotId,
    candidateRequestId: requestFor(state, gdpr.candidateSnapshotId).requestId,
    criterionRequestIds: goldCriteria.map(
      (criterion) =>
        requestFor(state, gdpr.candidateSnapshotId, criterion.criterionId)
          .requestId,
    ),
  };
}

async function issueCapability(
  state: Screen02FindState,
  requestId: string,
  ordinal: number,
) {
  return createScreen02FindAssessmentCapability(
    {
      state,
      requestId,
      capabilityId: `stage3-capability-${ordinal}`,
      issuedAt: times.capabilityIssued,
    },
    signingConfig,
  );
}

async function signDraft(
  capabilityToken: string,
  capability: Screen02FindAssessmentCapability,
  draft: unknown,
  receiptId: string,
  receivedAt: string,
) {
  return createSignedScreen02FindNormalizedReceipt(
    {
      submission: {
        schemaVersion: SCREEN_02_FIND_DRAFT_SUBMISSION_SCHEMA_VERSION,
        capabilityToken,
        requestId: capability.requestId,
        draft,
      },
      receiptId,
      receivedAt,
    },
    signingConfig,
  );
}

function candidateDraft(sourceId: string) {
  return {
    studyFit: {
      category: "strong",
      explanation:
        "GDPR's 2018 application-date lead falls within the confirmed study period and its territorial-scope lead can reach qualifying U.S. technology firms.",
      evidenceSourceIds: [sourceId],
    },
    outcomePathway: {
      category: "plausible",
      explanation:
        "Privacy compliance duties may redirect data and engineering resources and alter product experimentation connected to the innovation outcome family.",
      evidenceSourceIds: [sourceId],
    },
    measurementPotential: {
      category: "possible",
      explanation:
        "EU activity and monitoring indicators provide possible observable exposure variables, subject to later verification for each sampled firm.",
      evidenceSourceIds: [sourceId],
    },
    mainConcern:
      "The U.S. technology-firm population is broader than firms demonstrably covered by the current Article 3 territorial-scope lead.",
    nextChecks: [
      "Identify observable pre-2018 indicators of EU-facing activity for sampled firms.",
      "Determine whether exposure varies sufficiently across the sampled firms.",
    ],
  };
}

async function stateFromAppliedReceipt(
  state: Screen02FindState,
  receiptToken: string,
) {
  const applied = await applySignedScreen02FindReceiptEnvelope(
    {
      stateEnvelope: encodeScreen02FindWorkflowStateEnvelope(state),
      receiptToken,
    },
    signingConfig,
  );
  expect(applied.disposition).toBe("apply");
  expect(applied.applicationResults).toEqual([
    expect.objectContaining({ status: "completed" }),
  ]);
  const decoded = decodeScreen02FindWorkflowStateEnvelope(applied.stateEnvelope);
  if (!decoded.ok) throw new Error(decoded.message);
  return decoded.state;
}

describe("Stage 3 Screen 2 Find vertical slice", () => {
  it("discovers, assesses, chooses, continues, and restores the GDPR handoff while a peer remains unassessed", async () => {
    const prepared = createPreparedFindScenario();
    const gdpr = prepared.state.candidates.find(
      (candidate) => candidate.candidateSnapshotId === prepared.gdprSnapshotId,
    );
    if (!gdpr) throw new Error("Expected the immutable GDPR snapshot.");
    expect(gdpr.identity).toMatchObject({
      canonicalTitle: "General Data Protection Regulation",
      issuer: "European Parliament and Council",
      issuingJurisdiction: "European Union",
    });
    expect(gdpr.dateLeads).toContainEqual(
      expect.objectContaining({ date: "2018-05-25", stage: "effective" }),
    );
    expect(prepared.state.discoveryRequests[0]).toMatchObject({
      status: "completed",
      lifecycle: [
        expect.objectContaining({ status: "searching" }),
        expect.objectContaining({ status: "completed" }),
      ],
    });

    const [candidateCapability, onlyIncludeCapability, doNotShowCapability] =
      await Promise.all([
        issueCapability(prepared.state, prepared.candidateRequestId, 1),
        issueCapability(prepared.state, prepared.criterionRequestIds[0]!, 2),
        issueCapability(prepared.state, prepared.criterionRequestIds[1]!, 3),
      ]);
    const deliveredRequestIds = [
      prepared.candidateRequestId,
      ...prepared.criterionRequestIds,
    ];
    let state = markScreen02FindRequestsDelivered(
      prepared.state,
      deliveredRequestIds,
      { at: times.delivered, delivered: true },
    );

    const [candidateReceipt, onlyIncludeReceipt, doNotShowReceipt] =
      await Promise.all([
        signDraft(
          candidateCapability.capabilityToken,
          candidateCapability.capability,
          candidateDraft(gdpr.sourceIds[0]!),
          "stage3-candidate-receipt",
          times.candidateReceived,
        ),
        signDraft(
          onlyIncludeCapability.capabilityToken,
          onlyIncludeCapability.capability,
          {
            result: "meets",
            reason:
              "The cited regulation was imposed by the European Parliament and Council through an official legislative instrument.",
            evidenceSourceIds: [gdpr.sourceIds[0]!],
          },
          "stage3-only-include-receipt",
          times.firstCriterionReceived,
        ),
        signDraft(
          doNotShowCapability.capabilityToken,
          doNotShowCapability.capability,
          {
            result: "does-not-violate",
            reason:
              "The source-backed lead offers public EU-activity indicators and does not require proprietary employee data for initial exposure research.",
            evidenceSourceIds: [gdpr.sourceIds[0]!],
          },
          "stage3-do-not-show-receipt",
          times.secondCriterionReceived,
        ),
      ]);
    expect(
      await verifySignedScreen02FindNormalizedReceipt(
        candidateReceipt.receiptToken,
        signingConfig,
      ),
    ).toMatchObject({ acceptedPartIds: candidateCapability.capability.requestedPartIds });

    state = await stateFromAppliedReceipt(state, candidateReceipt.receiptToken);
    state = await stateFromAppliedReceipt(state, onlyIncludeReceipt.receiptToken);
    state = await stateFromAppliedReceipt(state, doNotShowReceipt.receiptToken);

    expect(screen02FindCandidateGate(state, prepared.gdprSnapshotId)).toEqual({
      eligible: true,
      reasons: [],
    });
    expect(screen02FindCandidateGate(state, prepared.peerSnapshotId)).toEqual({
      eligible: true,
      reasons: [],
    });
    expect(
      state.assessmentRequests.find(
        (request) =>
          request.target.mode === "find-candidate" &&
          request.target.candidateSnapshotId === prepared.peerSnapshotId,
      )?.status,
    ).toBe("prepared");

    state = openScreen02FindCandidate(state, {
      candidateSnapshotId: prepared.gdprSnapshotId,
      decisionId: "stage3-open-gdpr",
      at: times.opened,
    });
    expect(state.decision.tentativeSelectionSnapshotId).toBeNull();
    state = selectScreen02FindCandidate(
      state,
      prepared.gdprSnapshotId,
      "stage3-select-gdpr",
      times.selected,
      "Choose the source-backed GDPR lead for event verification.",
    );
    state = continueScreen02FindCandidate(
      state,
      "stage3-continue-gdpr",
      times.continued,
      "Continue to verify the event in Screen 3.",
    );

    const handoff = buildScreen02WorkflowHandoff(
      state,
      "0.2.21",
      times.handoffBuilt,
    );
    const restored = restoreScreen02WorkflowHandoff(handoff, state);
    expect(restored).not.toBeNull();
    expect(restored).toMatchObject({
      mode: "find",
      destinationScreen: "screen-03",
      decision: {
        mode: "find",
        candidateSnapshotId: prepared.gdprSnapshotId,
      },
      event: {
        identity: {
          issuer: "European Parliament and Council",
          issuingJurisdiction: "European Union",
        },
        settlement: "preliminary-screen-02",
      },
      preliminaryAssessment: {
        judgment: "promising-to-verify",
        judgmentMethod: "fixed-computation",
      },
      outcomeValuesInspected: false,
    });
    expect(restored?.criteriaFindings).toHaveLength(2);
  });

  it("returns a late signed receipt as stale after a newer search supersedes its immutable target", async () => {
    const prepared = createPreparedFindScenario();
    const gdpr = prepared.state.candidates.find(
      (candidate) => candidate.candidateSnapshotId === prepared.gdprSnapshotId,
    );
    if (!gdpr) throw new Error("Expected the immutable GDPR snapshot.");
    const issued = await issueCapability(
      prepared.state,
      prepared.candidateRequestId,
      4,
    );
    let state = markScreen02FindRequestsDelivered(
      prepared.state,
      [prepared.candidateRequestId],
      { at: times.delivered, delivered: true },
    );
    const signed = await signDraft(
      issued.capabilityToken,
      issued.capability,
      candidateDraft(gdpr.sourceIds[0]!),
      "stage3-late-candidate-receipt",
      times.candidateReceived,
    );

    state = applyReviewedScreen02FindDiscovery(state, {
      discoveryRequestId: "stage3-reviewed-discovery-2",
      candidateSetSnapshotId: "stage3-reviewed-set-2",
      searchRoundId: "stage3-reviewed-round-2",
      at: times.firstCriterionReceived,
      exactRequest:
        "Run a new bounded reviewed privacy-regulation search for the confirmed study.",
      maximumCandidates: 3,
    });
    expect(
      state.assessmentRequests.find(
        (request) => request.requestId === prepared.candidateRequestId,
      )?.status,
    ).toBe("superseded");

    const before = encodeScreen02FindWorkflowStateEnvelope(state);
    const late = await applySignedScreen02FindReceiptEnvelope(
      { stateEnvelope: before, receiptToken: signed.receiptToken },
      signingConfig,
    );
    expect(late).toMatchObject({
      disposition: "stale",
      requestId: prepared.candidateRequestId,
      receiptId: "stage3-late-candidate-receipt",
      applicationResults: [],
    });
    expect(screen02FindWorkflowEnvelopeIdentity(late.stateEnvelope)).toBe(
      screen02FindWorkflowEnvelopeIdentity(before),
    );
    expect(requireScreen02FindState(state).assessments).toEqual([]);
  });
});
