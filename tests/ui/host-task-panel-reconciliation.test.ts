import { describe, expect, it } from "vitest";

import type { Screen02WorkflowState } from "../../src/core/screen02-workflow-types";
import type {
  Screen03VerificationState,
} from "../../src/core/screen03-workflow";
import {
  fingerprintScreen02WorkflowValue,
} from "../../src/core/screen02-workflow-state";
import {
  screen02HostReviewApplicationIsCurrent,
  screen03HostEvidenceMappingApplicationIsCurrent,
} from "../../src/ui/host-task/host-task-panel-reconciliation";
import {
  screen03HostOverviewResultIsCurrent,
} from "../../src/ui/host-task/Screen03HostOverview";

const originalPoolId = "candidate-pool-original";
const originalPoolFingerprint = "fnv1a64:0011223344556677";
const successorPoolId = "candidate-pool-successor";
const resultId = "host-result-one";
const taskId = "host-task-one";

function screen02State(revision = 5) {
  const profileAdditions = {};
  const hostQueryExecution = {
    submittedTerms: [],
    plannedTerms: [],
    executedTerms: [],
    skipped: [],
  };
  const officialSourceLeadAudit: never[] = [];
  const rankingAdjustments: never[] = [];
  const applicationWithoutFingerprint = {
    schemaVersion: "screen-02-host-review-application-v1" as const,
    taskId,
    resultId,
    resultOrigin: "chatgpt-host" as const,
    taskInputFingerprint: "fnv1a64:33445566778899aa",
    submissionFingerprint: "fnv1a64:445566778899aabb",
    originalCandidatePoolId: originalPoolId,
    originalCandidatePoolFingerprint: originalPoolFingerprint,
    successorCandidatePoolId: successorPoolId,
    priorProfileFingerprint: "fnv1a64:5566778899aabbcc",
    profileAdditions,
    profileAdditionsFingerprint:
      fingerprintScreen02WorkflowValue(profileAdditions),
    profileAdditionCount: 0,
    appliedProfileFingerprint: "fnv1a64:5566778899aabbcc",
    candidateReviewsFingerprint: "fnv1a64:66778899aabbccdd",
    candidateReviewCount: 0,
    followUpQueriesFingerprint: fingerprintScreen02WorkflowValue([]),
    appliedAt: "2026-09-03T12:00:10.000Z",
    followUpQueryCount: 0,
    hostQueryExecution,
    hostQueryExecutionFingerprint:
      fingerprintScreen02WorkflowValue(hostQueryExecution),
    proposedOfficialSourceLeadCount: 0,
    verifiedOfficialSourceLeadCount: 0,
    officialSourceLeadsFingerprint: "fnv1a64:778899aabbccddee",
    officialSourceLeadAudit,
    officialSourceLeadAuditFingerprint:
      fingerprintScreen02WorkflowValue(officialSourceLeadAudit),
    rankingAdjustmentCount: 0,
    rankingAdjustments,
    rankingAdjustmentsFingerprint:
      fingerprintScreen02WorkflowValue(rankingAdjustments),
    validatedRetrievalContributionCount: 0,
    outcomeValuesInspected: false as const,
  };
  const hostReviewApplication = {
    ...applicationWithoutFingerprint,
    applicationFingerprint:
      fingerprintScreen02WorkflowValue(applicationWithoutFingerprint),
  };
  return {
    mode: "find",
    runId: "run-one",
    screen01Fingerprint: "fnv1a64:1122334455667788",
    revision,
    activeCandidateSetSnapshotId: successorPoolId,
    candidateSets: [
      {
        candidateSetSnapshotId: originalPoolId,
        candidateSetFingerprint: originalPoolFingerprint,
        status: "superseded",
        supersededBySnapshotId: successorPoolId,
        manifest: {},
      },
      {
        candidateSetSnapshotId: successorPoolId,
        candidateSetFingerprint: "fnv1a64:2233445566778899",
        status: "active",
        supersededBySnapshotId: null,
        manifest: {
          hostReviewApplication,
        },
      },
    ],
  } as unknown as Screen02WorkflowState;
}

const screen02Coordinates = {
  previousRevision: 4,
  taskId,
  resultId,
  runId: "run-one",
  expectedScopeFingerprint: "fnv1a64:1122334455667788",
  originalCandidatePoolId: originalPoolId,
  originalCandidatePoolFingerprint: originalPoolFingerprint,
};

function overviewResult() {
  return {
    schemaVersion: "shockaudit-screen03-host-overview-result-v1",
    origin: "chatgpt-host",
    nonCanonical: true,
    summary: "A bounded optional overview.",
    keyPoints: ["Supported point."],
    uncertainties: ["Timing remains uncertain."],
    sourceIds: ["source-one"],
    conciseRationale: "Uses only supported facts.",
    hostModel: "host_model_not_exposed",
    stateFingerprintInspected: "fnv1a64:33445566778899aa",
    outcomeValuesInspected: false,
  };
}

const reopenedScreen03 = {
  runId: "run-one",
  selectedEventId: "event-one",
  eventFingerprint: "fnv1a64:445566778899aabb",
  stateFingerprint: "fnv1a64:33445566778899aa",
  activeSourceIds: ["source-one"],
};

const overviewCoordinates = {
  runId: "run-one",
  selectedEventId: "event-one",
  expectedEventFingerprint: "fnv1a64:445566778899aabb",
};

const mappingCoordinates = {
  resultId,
  runId: "run-one",
  selectedEventId: "event-one",
  claimGroupId: "screen03-claims:one",
  expectedEventFingerprint: "fnv1a64:445566778899aabb",
};

function screen03EvidenceMappingState() {
  return {
    runId: mappingCoordinates.runId,
    upstream: {
      eventFingerprint: mappingCoordinates.expectedEventFingerprint,
    },
    orientation: {
      current: { selectedEventId: mappingCoordinates.selectedEventId },
    },
    history: [{
      id: "screen03-history:3:host-evidence-mapping-applied",
      action: "host-evidence-mapping-applied",
      actor: "chatgpt-host",
      targetId: mappingCoordinates.claimGroupId,
      value: mappingCoordinates.resultId,
    }],
  } as unknown as Screen03VerificationState;
}

describe("generic host-task panel reconciliation", () => {
  it("requires the exact newer canonical Screen 2 successor receipt", () => {
    expect(screen02HostReviewApplicationIsCurrent(
      screen02State(),
      screen02Coordinates,
    )).toBe(true);
    expect(screen02HostReviewApplicationIsCurrent(
      screen02State(4),
      screen02Coordinates,
    )).toBe(false);

    const wrongResult = structuredClone(screen02State()) as Screen02WorkflowState;
    if (wrongResult.mode === "find") {
      wrongResult.candidateSets[1]!.manifest.hostReviewApplication!.resultId =
        "different-result";
    }
    expect(screen02HostReviewApplicationIsCurrent(
      wrongResult,
      screen02Coordinates,
    )).toBe(false);
  });

  it("rejects an unchanged original pool even if its manifest claims success", () => {
    const unchanged = structuredClone(screen02State()) as Screen02WorkflowState;
    if (unchanged.mode === "find") {
      const receipt = unchanged.candidateSets[1]!.manifest.hostReviewApplication!;
      receipt.successorCandidatePoolId = originalPoolId;
      unchanged.activeCandidateSetSnapshotId = originalPoolId;
      unchanged.candidateSets[0]!.status = "active";
      unchanged.candidateSets[0]!.supersededBySnapshotId = null;
      unchanged.candidateSets[0]!.manifest.hostReviewApplication = receipt;
      unchanged.candidateSets.splice(1, 1);
    }
    expect(screen02HostReviewApplicationIsCurrent(
      unchanged,
      screen02Coordinates,
    )).toBe(false);
  });

  it("reconciles a no-change Screen 3 mapping only through its exact canonical marker", () => {
    expect(screen03HostEvidenceMappingApplicationIsCurrent(
      screen03EvidenceMappingState(),
      mappingCoordinates,
    )).toBe(true);

    const mutations: Array<(state: Screen03VerificationState) => void> = [
      (state) => { state.history[0]!.value = "different-result"; },
      (state) => { state.history[0]!.targetId = "different-claim-group"; },
      (state) => { state.history[0]!.actor = "researcher"; },
      (state) => { state.upstream.eventFingerprint = "fnv1a64:ffffffffffffffff"; },
      (state) => { state.history.push({ ...state.history[0]!, id: "duplicate" }); },
    ];
    for (const mutate of mutations) {
      const state = structuredClone(screen03EvidenceMappingState());
      mutate(state);
      expect(screen03HostEvidenceMappingApplicationIsCurrent(
        state,
        mappingCoordinates,
      )).toBe(false);
    }
  });

  it("binds a noncanonical Screen 3 overview to the exact reopened state", () => {
    expect(screen03HostOverviewResultIsCurrent(
      overviewResult(),
      reopenedScreen03,
      overviewCoordinates,
    )).toBe(true);
    expect(screen03HostOverviewResultIsCurrent(
      overviewResult(),
      { ...reopenedScreen03, stateFingerprint: "fnv1a64:ffffffffffffffff" },
      overviewCoordinates,
    )).toBe(false);
    expect(screen03HostOverviewResultIsCurrent(
      { ...overviewResult(), capability: "must-not-be-rendered" },
      reopenedScreen03,
      overviewCoordinates,
    )).toBe(false);
    expect(screen03HostOverviewResultIsCurrent(
      { ...overviewResult(), sourceIds: ["stale-source"] },
      reopenedScreen03,
      overviewCoordinates,
    )).toBe(false);
  });
});
