import {
  isScreen02HostReviewApplication,
  type Screen02WorkflowState,
} from "../../core/screen02-workflow-types";
import type {
  Screen03VerificationState,
} from "../../core/screen03-workflow";

type Screen02HostReviewApplicationCoordinates = {
  previousRevision: number;
  taskId: string;
  resultId: string;
  runId: string;
  expectedScopeFingerprint: string;
  originalCandidatePoolId: string;
  originalCandidatePoolFingerprint: string;
};

/**
 * A task status of `applied` is not enough to update the panel. Require a
 * newer canonical state whose active successor carries the exact fixed-code
 * application receipt, and require the immutable original pool to point at
 * that successor. An unchanged refresh therefore cannot look green.
 */
export function screen02HostReviewApplicationIsCurrent(
  state: Screen02WorkflowState,
  coordinates: Screen02HostReviewApplicationCoordinates,
) {
  if (
    state.mode !== "find" || state.runId !== coordinates.runId ||
    state.screen01Fingerprint !== coordinates.expectedScopeFingerprint ||
    state.revision <= coordinates.previousRevision ||
    !state.activeCandidateSetSnapshotId
  ) {
    return false;
  }
  const successor = state.candidateSets.find(
    (candidateSet) =>
      candidateSet.status === "active" &&
      candidateSet.candidateSetSnapshotId ===
        state.activeCandidateSetSnapshotId,
  );
  const original = state.candidateSets.find(
    (candidateSet) =>
      candidateSet.candidateSetSnapshotId ===
        coordinates.originalCandidatePoolId &&
      candidateSet.candidateSetFingerprint ===
        coordinates.originalCandidatePoolFingerprint,
  );
  const application = successor?.manifest.hostReviewApplication;
  return Boolean(
    successor && original &&
      successor.candidateSetSnapshotId !==
        coordinates.originalCandidatePoolId &&
      original.status === "superseded" &&
      original.supersededBySnapshotId === successor.candidateSetSnapshotId &&
      isScreen02HostReviewApplication(application) &&
      application.taskId === coordinates.taskId &&
      application.resultId === coordinates.resultId &&
      application.originalCandidatePoolId ===
        coordinates.originalCandidatePoolId &&
      application.originalCandidatePoolFingerprint ===
        coordinates.originalCandidatePoolFingerprint &&
      application.successorCandidatePoolId ===
        successor.candidateSetSnapshotId,
  );
}

type Screen03HostEvidenceMappingCoordinates = {
  resultId: string;
  runId: string;
  selectedEventId: string;
  claimGroupId: string;
  expectedEventFingerprint: string;
};

/**
 * A no-change mapping result is complete only when the reopened canonical
 * Screen 3 state carries its unique, exact host-authored audit marker. The
 * proposal graph itself is intentionally not used as an acknowledgement gate.
 */
export function screen03HostEvidenceMappingApplicationIsCurrent(
  state: Screen03VerificationState,
  coordinates: Screen03HostEvidenceMappingCoordinates,
) {
  const selectedEventId = state.orientation?.current.selectedEventId ??
    state.history[0]?.targetId ?? null;
  if (
    state.runId !== coordinates.runId ||
    selectedEventId !== coordinates.selectedEventId ||
    state.upstream.eventFingerprint !== coordinates.expectedEventFingerprint
  ) {
    return false;
  }
  const markers = state.history.filter((event) =>
    event.action === "host-evidence-mapping-applied" &&
    event.actor === "chatgpt-host" &&
    event.targetId === coordinates.claimGroupId &&
    event.value === coordinates.resultId
  );
  return markers.length === 1;
}
