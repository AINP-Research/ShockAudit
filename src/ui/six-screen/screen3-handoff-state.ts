import type { SixScreenOperationStatus } from
  "../../core/six-screen/operation-status";
import type { SafeSixScreenWorkflowProblem } from
  "../../core/six-screen/workflow-problem";
import { createSixScreenWorkflowProblem } from
  "../../core/six-screen/workflow-problem";
import { sixScreenActionPolicy } from
  "../../core/six-screen/action-policy";
import type { SixScreenWorkflowResponseOperationBinding } from
  "../../core/six-screen/workflow-response-contract";
import type { SixScreenWorkflowState } from
  "../../core/six-screen/contracts";
import { fingerprintSixScreenValue } from
  "../../core/six-screen/canonical";
import {
  screen3HandoffDependencyManifest,
  type StudyContextDraft,
} from "../../core/six-screen/workflow";
import {
  EMPTY_STUDY_DESIGN_CLARIFICATIONS,
  currentProposedTreatmentTiming,
  currentScreen3StudyEntryContext,
  currentStudyDesignAdvice,
  normalizeStudyDesignClarifications,
  type ProposedTreatmentTimingInput,
  type StudyDesignClarifications,
} from "../../core/six-screen/study-design-advice";
import { normalizeScreen3StudyDraft } from
  "../../core/six-screen/screen3-entry-validation";
import type { Screen3HandoffRecovery } from "./bridge";

export type Screen3HandoffTaskStage =
  | "saving"
  | "checking"
  | "outcome_unknown"
  | "committed_display_pending"
  | "local_rebuild_required"
  | "saved_historical"
  | "saved_display_unavailable"
  | "operation_conflict"
  | "error";

export type Screen3HandoffTaskState = Screen3HandoffRecovery & {
  stage: Screen3HandoffTaskStage;
  message: string;
  problem: SafeSixScreenWorkflowProblem | null;
  latestVerifiedRevision?: number | null;
};

export type Screen3HandoffStatusDisposition =
  | "restore_current"
  | "outcome_unknown"
  | "operation_conflict"
  | "local_rebuild_required"
  | "saved_historical"
  | "saved_display_unavailable";

export type Screen3HandoffPersistenceEffect =
  | "preserve"
  | "persist"
  | "clear";

export type Screen3HandoffStatusPlan = {
  disposition: Screen3HandoffStatusDisposition;
  stage: Screen3HandoffTaskStage;
  recoveryState: Screen3HandoffRecovery["state"];
  persistence: Screen3HandoffPersistenceEffect;
  requiresCanonicalRefresh: boolean;
  /** Status recovery is read-only and never authorizes replaying the mutation. */
  automaticMutation: "never";
};

export type Screen3HandoffStagePolicy = {
  canCheckSavedStatus: boolean;
  canRestoreLocally: boolean;
  blocksPrimarySubmit: boolean;
  clearsAfterScientificEdit: boolean;
  sameInputTerminal: boolean;
  automaticMutation: "never";
};

export type Screen3HandoffScientificPayload = {
  study: StudyContextDraft;
  proposedTiming: ProposedTreatmentTimingInput;
  clarifications: Partial<StudyDesignClarifications>;
};

const STAGE_POLICIES: Readonly<
  Record<Screen3HandoffTaskStage, Screen3HandoffStagePolicy>
> = {
  saving: {
    canCheckSavedStatus: false,
    canRestoreLocally: false,
    blocksPrimarySubmit: true,
    clearsAfterScientificEdit: false,
    sameInputTerminal: false,
    automaticMutation: "never",
  },
  checking: {
    canCheckSavedStatus: false,
    canRestoreLocally: false,
    blocksPrimarySubmit: true,
    clearsAfterScientificEdit: false,
    sameInputTerminal: false,
    automaticMutation: "never",
  },
  outcome_unknown: {
    canCheckSavedStatus: true,
    canRestoreLocally: false,
    blocksPrimarySubmit: true,
    clearsAfterScientificEdit: true,
    sameInputTerminal: false,
    automaticMutation: "never",
  },
  committed_display_pending: {
    canCheckSavedStatus: true,
    canRestoreLocally: false,
    blocksPrimarySubmit: true,
    clearsAfterScientificEdit: true,
    sameInputTerminal: false,
    automaticMutation: "never",
  },
  local_rebuild_required: {
    canCheckSavedStatus: false,
    canRestoreLocally: true,
    blocksPrimarySubmit: true,
    clearsAfterScientificEdit: true,
    sameInputTerminal: false,
    automaticMutation: "never",
  },
  saved_historical: {
    canCheckSavedStatus: false,
    canRestoreLocally: false,
    blocksPrimarySubmit: false,
    clearsAfterScientificEdit: true,
    sameInputTerminal: true,
    automaticMutation: "never",
  },
  saved_display_unavailable: {
    canCheckSavedStatus: false,
    canRestoreLocally: false,
    blocksPrimarySubmit: true,
    clearsAfterScientificEdit: true,
    sameInputTerminal: true,
    automaticMutation: "never",
  },
  operation_conflict: {
    canCheckSavedStatus: false,
    canRestoreLocally: false,
    blocksPrimarySubmit: true,
    clearsAfterScientificEdit: true,
    sameInputTerminal: true,
    automaticMutation: "never",
  },
  error: {
    canCheckSavedStatus: false,
    canRestoreLocally: false,
    blocksPrimarySubmit: false,
    clearsAfterScientificEdit: true,
    sameInputTerminal: true,
    automaticMutation: "never",
  },
};

export function screen3HandoffStagePolicy(
  stage: Screen3HandoffTaskStage,
): Screen3HandoffStagePolicy {
  return STAGE_POLICIES[stage];
}

export function screen3HandoffStageNeedsCanonicalCompatibilityCheck(
  stage: Screen3HandoffTaskStage,
) {
  return stage === "local_rebuild_required" ||
    stage === "saved_display_unavailable" ||
    stage === "operation_conflict";
}

export function shouldReconcileScreen3HandoffAfterCanonicalAcceptance(input: {
  acceptedCanonicalEpoch: number;
  markerCanonicalFloor: number;
}) {
  return Number.isSafeInteger(input.acceptedCanonicalEpoch) &&
    Number.isSafeInteger(input.markerCanonicalFloor) &&
    input.acceptedCanonicalEpoch > input.markerCanonicalFloor;
}

export function screen3OperationStatusDisposition(
  status: Pick<SixScreenOperationStatus, "lookup" | "destination">,
): Screen3HandoffStatusDisposition {
  if (status.lookup === "unknown_or_expired") return "outcome_unknown";
  if (status.lookup === "conflict") return "operation_conflict";
  if (status.destination.state === "current" &&
      status.destination.displayReady) return "restore_current";
  if (status.destination.state === "locally_recoverable" &&
      status.destination.localRebuildAvailable) {
    return "local_rebuild_required";
  }
  if (status.destination.state === "historical") return "saved_historical";
  return "saved_display_unavailable";
}

export function screen3HandoffStatusPlan(
  status: Pick<SixScreenOperationStatus, "lookup" | "destination">,
): Screen3HandoffStatusPlan {
  const disposition = screen3OperationStatusDisposition(status);
  switch (disposition) {
    case "restore_current":
      return {
        disposition,
        stage: "checking",
        recoveryState: "committed_display_pending",
        persistence: "preserve",
        requiresCanonicalRefresh: true,
        automaticMutation: "never",
      };
    case "outcome_unknown":
      return {
        disposition,
        stage: "outcome_unknown",
        recoveryState: "outcome_unknown",
        persistence: "persist",
        requiresCanonicalRefresh: false,
        automaticMutation: "never",
      };
    case "operation_conflict":
      return {
        disposition,
        stage: "operation_conflict",
        recoveryState: "operation_conflict",
        persistence: "persist",
        requiresCanonicalRefresh: false,
        automaticMutation: "never",
      };
    case "local_rebuild_required":
      return {
        disposition,
        stage: "local_rebuild_required",
        recoveryState: "local_rebuild_required",
        persistence: "persist",
        requiresCanonicalRefresh: false,
        automaticMutation: "never",
      };
    case "saved_historical":
      return {
        disposition,
        stage: "saved_historical",
        // Historical is deliberately a display state only. It is not persisted
        // as a current recovery marker, whose wire schema has no history state.
        recoveryState: "committed_display_pending",
        persistence: "clear",
        requiresCanonicalRefresh: false,
        automaticMutation: "never",
      };
    case "saved_display_unavailable":
      return {
        disposition,
        stage: "saved_display_unavailable",
        recoveryState: "saved_display_unavailable",
        persistence: "persist",
        requiresCanonicalRefresh: false,
        automaticMutation: "never",
      };
  }
}

export function screen3StatusReceiptMatchesCurrentState(input: {
  status: Pick<
    SixScreenOperationStatus,
    "lookup" | "receiptValidated" | "screen3Receipt" | "destination"
  >;
  state: SixScreenWorkflowState;
}) {
  const receipt = input.status.screen3Receipt;
  if (input.status.lookup !== "committed" ||
      !input.status.receiptValidated || !receipt ||
      input.status.destination.state !== "current" ||
      !input.status.destination.displayReady) return false;
  const identity = input.state.confirmedShock;
  const timing = currentProposedTreatmentTiming(input.state);
  const entry = currentScreen3StudyEntryContext(input.state);
  const advice = currentStudyDesignAdvice(input.state);
  return identity?.identityFingerprint === receipt.identityFingerprint &&
    timing?.id === receipt.timingId &&
    timing.timingFingerprint === receipt.timingFingerprint &&
    entry?.id === receipt.entryContextId &&
    entry.entryFingerprint === receipt.entryContextFingerprint &&
    advice?.adviceId === receipt.adviceId &&
    advice.adviceFingerprint === receipt.adviceFingerprint;
}

export function createScreen3HandoffSavingTask(
  recovery: Screen3HandoffRecovery,
): Screen3HandoffTaskState {
  return {
    ...recovery,
    state: "pending",
    stage: "saving",
    message:
      "Saving the study and proposed timing, then preparing local comparison guidance. No source search or model request is part of this handoff.",
    problem: null,
  };
}

export function createScreen3HandoffCheckingTask(
  recovery: Screen3HandoffRecovery,
): Screen3HandoffTaskState {
  return {
    ...recovery,
    stage: "checking",
    message:
      "ShockAudit is reading the exact local operation receipt. This sends no workflow mutation, source search, or model request.",
    problem: null,
  };
}

export function createScreen3HandoffProblemTask(input: {
  recovery: Screen3HandoffRecovery;
  problem: SafeSixScreenWorkflowProblem;
  problemMessage: string;
}): Screen3HandoffTaskState {
  const knownNotCommitted = input.problem.commitCertainty === "not_committed";
  return {
    ...input.recovery,
    state: knownNotCommitted ? "pending" : "outcome_unknown",
    stage: knownNotCommitted ? "error" : "outcome_unknown",
    message: knownNotCommitted
      ? `${input.problemMessage} The visible draft is retained.`
      : `${input.problemMessage} No automatic resend was made; check this exact operation before repeating it.`,
    problem: input.problem,
  };
}

export function shouldNavigateAfterScreen3Handoff(input: {
  startingDraftVersion: number;
  currentDraftVersion: number;
  startingViewVersion: number;
  currentViewVersion: number;
  currentScreen: number;
}) {
  return input.startingDraftVersion === input.currentDraftVersion &&
    input.startingViewVersion === input.currentViewVersion &&
    input.currentScreen === 2;
}

export function screen3WidgetPersistenceFailurePlan() {
  return {
    canonicalAccepted: true as const,
    automaticMutation: "never" as const,
    warning:
      "The saved study is available now, but this host could not keep the current panel state for reopening. Check saved status if you reopen it.",
  };
}

function evidenceDependencyFingerprint(state: SixScreenWorkflowState) {
  const manifest = screen3HandoffDependencyManifest(state);
  return fingerprintSixScreenValue({
    schemaVersion: "screen-03-handoff-evidence-dependencies-v1",
    identityFingerprint: manifest.identityFingerprint,
    identityRevision: manifest.identityRevision,
    currentRequestFingerprint: manifest.currentRequestFingerprint,
    policyReviewFingerprint: manifest.policyReviewFingerprint,
    policyEventCardReviewFingerprint:
      manifest.policyEventCardReviewFingerprint,
    rejectedClaimIds: manifest.rejectedClaimIds,
  });
}

export function createScreen3HandoffScientificBinding(
  state: SixScreenWorkflowState,
  payload: Screen3HandoffScientificPayload,
): NonNullable<Screen3HandoffRecovery["scientificBinding"]> {
  return {
    schemaVersion: "screen-03-handoff-scientific-binding-v1",
    studyFingerprint: fingerprintSixScreenValue(
      normalizeScreen3StudyDraft(payload.study),
    ),
    timingFingerprint: fingerprintSixScreenValue(payload.proposedTiming),
    clarificationFingerprint: fingerprintSixScreenValue(
      normalizeStudyDesignClarifications(payload.clarifications),
    ),
    evidenceDependencyFingerprint: evidenceDependencyFingerprint(state),
  };
}

export function screen3HandoffRecoveryCompatibility(input: {
  recovery: Screen3HandoffRecovery;
  state: SixScreenWorkflowState;
}): "compatible" | "incompatible" | "unknown_legacy" {
  const expected = input.recovery.scientificBinding;
  const timing = currentProposedTreatmentTiming(input.state);
  if (!timing) return "incompatible";
  const timingInput: ProposedTreatmentTimingInput = {
    mode: timing.mode,
    year: timing.mode === "year" ? timing.year : null,
    milestoneReference: timing.milestoneReference,
  };
  const entry = currentScreen3StudyEntryContext(input.state);
  const advice = currentStudyDesignAdvice(input.state);
  if (entry && advice && entry.clarificationFingerprint !==
      advice.binding.clarificationFingerprint) return "unknown_legacy";
  const currentClarificationFingerprint =
    entry?.clarificationFingerprint ??
    advice?.binding.clarificationFingerprint ??
    fingerprintSixScreenValue(EMPTY_STUDY_DESIGN_CLARIFICATIONS);
  const currentStudy: StudyContextDraft = {
    population: input.state.study.population,
    analysisUnit: input.state.study.analysisUnit,
    geography: [...input.state.study.geography],
    industry: [...input.state.study.industry],
    period: structuredClone(input.state.study.period),
    outcome: input.state.study.outcome,
    outcomeMeasure: input.state.study.outcomeMeasure ?? null,
    intendedConstruct: input.state.study.intendedConstruct,
    policySideConcept: input.state.study.policySideConcept ?? null,
    initialExplanation: input.state.study.initialExplanation,
    proposedTreatment: input.state.study.proposedTreatment,
    proposedComparison: input.state.study.proposedComparison,
    resultsPreviouslyInspected:
      input.state.study.resultsPreviouslyInspected,
  };
  if (!expected) {
    const recoverableClarifications = advice?.clarifications ??
      (!entry || entry.clarificationFingerprint ===
          fingerprintSixScreenValue(EMPTY_STUDY_DESIGN_CLARIFICATIONS)
        ? EMPTY_STUDY_DESIGN_CLARIFICATIONS
        : null);
    if (!recoverableClarifications) return "unknown_legacy";
    const currentInputFingerprint = fingerprintSixScreenValue({
      study: normalizeScreen3StudyDraft(currentStudy),
      proposedTiming: timingInput,
      clarifications: normalizeStudyDesignClarifications(
        recoverableClarifications,
      ),
    });
    // A legacy marker did not retain component fingerprints. A mismatch is
    // still conclusive; an exact input match remains unknown because its
    // earlier evidence dependency cannot be safely reconstructed.
    return currentInputFingerprint === input.recovery.inputFingerprint
      ? "unknown_legacy"
      : "incompatible";
  }
  const current = {
    schemaVersion: "screen-03-handoff-scientific-binding-v1" as const,
    studyFingerprint: fingerprintSixScreenValue(
      normalizeScreen3StudyDraft(currentStudy),
    ),
    timingFingerprint: fingerprintSixScreenValue(timingInput),
    clarificationFingerprint: currentClarificationFingerprint,
    evidenceDependencyFingerprint: evidenceDependencyFingerprint(input.state),
  };
  return expected.schemaVersion === current.schemaVersion &&
      expected.studyFingerprint === current.studyFingerprint &&
      expected.timingFingerprint === current.timingFingerprint &&
      expected.clarificationFingerprint ===
        current.clarificationFingerprint &&
      expected.evidenceDependencyFingerprint ===
        current.evidenceDependencyFingerprint
    ? "compatible"
    : "incompatible";
}

export function reconcileScreen3HandoffTaskWithCanonical(input: {
  task: Screen3HandoffTaskState;
  state: SixScreenWorkflowState;
}) {
  const compatibility = screen3HandoffRecoveryCompatibility({
    recovery: input.task,
    state: input.state,
  });
  if (!screen3HandoffStageNeedsCanonicalCompatibilityCheck(
    input.task.stage,
  ) || compatibility !== "incompatible") {
    return {
      task: input.task,
      persistence: "preserve" as const,
      statusRead: "none" as const,
      automaticMutation: "never" as const,
      compatibility,
    };
  }
  return {
    task: {
      ...input.task,
      state: "committed_display_pending" as const,
      stage: "saved_historical" as const,
      message:
        "This retained handoff belongs to earlier scientific input. It remains history, does not block the current draft, and was not reread or resent.",
      problem: null,
    },
    persistence: "clear" as const,
    statusRead: "none" as const,
    automaticMutation: "never" as const,
    compatibility,
  };
}

export function claimScreen3HandoffAction(
  activeActions: Set<string>,
  key: string,
) {
  if (activeActions.has(key)) return false;
  activeActions.add(key);
  return true;
}

export function obsoleteBoundMutationProblem(input: {
  binding: Exclude<SixScreenWorkflowResponseOperationBinding, null>;
  incomingRevision: number;
  currentRevision: number;
}) {
  const policy = sixScreenActionPolicy(input.binding.operationKind);
  return createSixScreenWorkflowProblem({
    code: "delivery_failure",
    action: input.binding.operationKind,
    operationId: input.binding.operationId,
    screen: policy?.destinationScreen ?? null,
    expectedRevision: input.incomingRevision,
    actualRevision: input.currentRevision,
    stage: "host_delivery",
    commitCertainty: "unknown",
    dispatchCertainty: "not_dispatched",
    recovery: policy?.failureRecovery === "operation_status"
      ? "check_status"
      : "none",
    safeCauseCodes: ["response_coordinate_mismatch"],
  });
}
