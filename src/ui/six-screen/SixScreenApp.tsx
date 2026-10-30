import { screen5SetupRecovered } from "./screen5-recovery";
import { cleanPolicyPresentationText, uniquePolicyBriefingSections } from "../../core/six-screen/policy-presentation";
export { cleanPolicyPresentationText } from "../../core/six-screen/policy-presentation";
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import {
  currentStudyFirstMechanismRunForState,
  screen3HandoffDependencyManifest,
  type StudyContextDraft,
} from "../../core/six-screen/workflow";
import type { StudyFirstMechanismRun } from
  "../../core/six-screen/study-first-mechanism-comparison";
import { fingerprintSixScreenValue, sameSixScreenValue } from
  "../../core/six-screen/canonical";
import { modelTaskProfile } from
  "../../core/six-screen/model-task-profiles";
import {
  SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID,
  sixScreenWorkflowMutationRequestBinding,
  type SixScreenWorkflowResponseOperationBinding,
} from "../../core/six-screen/workflow-response-contract";
import { sixScreenActionPolicy } from
  "../../core/six-screen/action-policy";
import {
  SixScreenWorkflowProblemError,
  createSixScreenWorkflowProblem,
  type SafeSixScreenWorkflowProblem,
} from "../../core/six-screen/workflow-problem";
import { isHistoricalScreen5Provider } from
  "../../core/six-screen/screen5-historical-record";
import {
  SixScreenWorkflowResponseError,
  restoreSixScreenWorkflowToolResponse,
  workflowSnapshotResponseDisposition,
  type SixScreenWorkflowResponseDiagnostic,
} from "./workflow-response";
import type {
  PolicyEventCardClaimReview,
  PolicyEventCardReviewState,
  PolicyClaimReviewDecision,
} from "../../core/six-screen/policy-event-card-review";
import {
  SIX_SCREEN_POLICY_EVENT_CARD_WORKSPACE_META_KEY,
  SIX_SCREEN_POLICY_LIFECYCLE_STAGE_WORKSPACE_META_KEY,
} from "../../core/six-screen/metadata-keys";
import type {
  PolicyChronologyStage,
  PolicyChronologyTiming,
} from
  "../../core/six-screen/policy-chronology";
import type {
  ConfirmedShock,
  IdentityCandidate,
  PolicyBriefingTimelineItem,
  PolicyBriefingSection,
  PolicyReview,
  SixScreenWorkflowState,
  TypedDate,
} from
  "../../core/six-screen/contracts";
import type {
  CausalComparisonInput,
  CausalDesignOption,
  CausalPolicyTarget,
} from "../../core/six-screen/causal-comparison";
import {
  EMPTY_STUDY_DESIGN_CLARIFICATIONS,
  SIX_SCREEN_TREATMENT_YEAR_MAX,
  SIX_SCREEN_TREATMENT_YEAR_MIN,
  currentScreen3StudyEntryContext,
  currentStudyDesignAdvice,
  currentStudyDesignSelection,
  currentProposedTreatmentTiming,
  type ProposedTreatmentTimingInput,
  type Screen3StudyEntryContext,
  type StudyDesignClarifications,
  type StudyDesignAdvice,
  type StudyDesignMethodOption,
} from "../../core/six-screen/study-design-advice";
import {
  validateScreen3EntryDraft,
  type Screen3EntryFieldId,
  type Screen3EntryIssue,
} from "../../core/six-screen/screen3-entry-validation";
import type {
  CoEventImportantEntity,
  CoEventSearchScopeInput,
  CoEventWindowOffset,
} from "../../core/six-screen/co-event-search";
import type {
  CoEventDuplicateReviewDecision,
  CoEventOccurrenceReviewDecision,
} from "../../core/six-screen/co-event-occurrence-review";
import type { CoEventRelationReviewDecision } from
  "../../core/six-screen/co-event-relation-review";
import type { MechanismLiteraturePlanInput } from
  "../../core/six-screen/mechanism-literature-plan";
import type { MechanismReviewDraft } from
  "../../core/six-screen/mechanism-review";
import type { StudyFirstEventContext } from
  "../../core/six-screen/study-first-event-investigation";
import { currentStudyFirstEventInvestigation } from
  "../../core/six-screen/study-first-event-investigation";
import type { Screen6DiagnosticPlanInput } from
  "../../core/six-screen/screen6-diagnostic-plan";
import { createScreen6DesignMapProjection } from
  "../../core/six-screen/screen6-design-map";
import type {
  Screen6DiagnosticResultInput,
  Screen6DiagnosticResultReviewDecision,
} from "../../core/six-screen/screen6-diagnostic-result";
import type {
  Screen6ClaimBoundaryInput,
  Screen6ResearchPlanningDispositionDecision,
} from "../../core/six-screen/screen6-claim-boundary";
import type { ScholarlyDocumentInspectionInput } from
  "../../core/six-screen/mechanism-scholarly-document";
import type {
  ScholarlyClaimFieldsDraft,
  ScholarlyClaimReviewDecision,
} from "../../core/six-screen/mechanism-scholarly-claim-review";
import type { CoEventPolicyLifecycleStageKind } from
  "../../core/six-screen/co-event-policy-lifecycle-handoff";
import type { PolicyLifecycleStageDispositionDecision } from
  "../../core/six-screen/policy-lifecycle-stage-review";
import type { PolicyLifecycleStageRevisionDecision } from
  "../../core/six-screen/policy-lifecycle-stage-revision";
import type { PolicyReviewedEventCard } from
  "../../core/six-screen/policy-event-card-review";
import { createLegacyReadOnlyExport } from
  "../../core/six-screen/legacy-compatibility";
import {
  createWorkflowResearchExportBundle,
  workflowResearchExportAvailability,
  type WorkflowResearchExportAvailability,
} from "../../core/six-screen/workflow-research-export";
import type {
  SixScreenWorkflowPrivateSnapshot,
  SixScreenWorkflowPublicProjection,
  PolicyEventCardWorkspace,
  CausalComparisonWorkspace,
  CoEventSearchWorkspace,
  StudyFirstEventInvestigationWorkspace,
  StudyFirstMechanismWorkspace,
  Screen5ExecutionReadiness,
  PolicyLifecycleStageReviewWorkspace,
} from "../../worker/six-screen-workflow-runtime";
import { SCREEN4_INTERPRETATION_MAX_BATCHES } from
  "../../core/six-screen/screen4-interpretation-queue";
import { isScreen3SpecificCritique,
  type Screen3ContextualCritique } from
  "../../worker/screen3-contextualizer";
import { projectAnalysisResultState } from "./analysis-result-state";
import {
  sixScreenMechanismProofResultSchema,
  sixScreenPolicyFactProofResultSchema,
} from "../../worker/six-screen-intelligence-proof";
import {
  SCREEN04_STUDY_EVENT_ASSESSMENT_TASK,
  SCREEN05_STUDY_MECHANISM_COMPARISON_TASK,
  SCREEN05_THEORETICAL_PLANNING_TASK,
  type StudyFirstHostTaskType,
} from "../../worker/study-first-host-intelligence";
import type {
  HostReasoningMode,
  HostReasoningPrivateTaskCoordinates,
  HostReasoningPublicTaskState,
} from "../host-task/host-task-client";
import {
  SixScreenBridge,
  type Screen3HandoffRecovery,
  type Screen5MechanismDraft,
  type SixScreenHostView,
  type SixScreenToolResponse,
  type SixScreenToolResponseTrace,
} from "./bridge";
import {
  createScreen3HandoffCheckingTask,
  createScreen3HandoffProblemTask,
  createScreen3HandoffSavingTask,
  createScreen3HandoffScientificBinding,
  claimScreen3HandoffAction,
  obsoleteBoundMutationProblem,
  reconcileScreen3HandoffTaskWithCanonical,
  screen3HandoffStagePolicy,
  screen3HandoffStageNeedsCanonicalCompatibilityCheck,
  screen3HandoffStatusPlan,
  screen3OperationStatusDisposition,
  screen3StatusReceiptMatchesCurrentState,
  screen3WidgetPersistenceFailurePlan,
  shouldReconcileScreen3HandoffAfterCanonicalAcceptance,
  shouldNavigateAfterScreen3Handoff,
  type Screen3HandoffTaskState,
  type Screen3HandoffScientificPayload,
} from "./screen3-handoff-state";
import { MechanismLiteraturePlanPanel } from
  "./MechanismLiteraturePlanPanel";
const Screen6CurrentPlanPanel = lazy(() =>
  import("./Screen6CurrentPlanPanel").then((module) =>
    ({ default: module.Screen6CurrentPlanPanel })));
const Screen6UncertaintyPanel = lazy(() =>
  import("./Screen6UncertaintyPanel").then((module) =>
    ({ default: module.Screen6UncertaintyPanel })));
import {
  screen5EvidenceOperationId,
  screen5ExecutionDiagnostic,
  studyFirstHostResult,
  studyFirstHostTaskIsTerminal,
} from "./screen5-execution";
import {
  screen5ArgumentSupportScope,
  screen5CompactMechanismHeading,
  screen5DirectionLabel,
  screen5EvidenceProgress,
  screen5EvidenceStatus,
  screen5PolicyAnchoredPath,
  screen5ProposedDirectionLabel,
  screen5OutcomeTarget,
  screen5SourceCitationLabel,
  screen5PredictionEmptyMessage,
  screen5PrimaryArgument,
  screen5UniqueArguments,
  type Screen5PresentationCheckState,
} from "./screen5-presentation";

const steps = [
  "Your study and policy",
  "Understand the policy",
  "Suggested Approach",
  "Check other events",
  "Compare explanations",
  "Design summary",
] as const;

export function screen3StudyContextBlockers(
  study: SixScreenWorkflowState["study"] | null | undefined,
) {
  const candidate = study ?? {
    population: null,
    analysisUnit: null,
    geography: [],
    industry: [],
    period: { start: null, end: null },
    outcome: null,
    outcomeMeasure: null,
    intendedConstruct: null,
    policySideConcept: null,
    initialExplanation: null,
    proposedTreatment: null,
    proposedComparison: null,
    resultsPreviouslyInspected: "not_disclosed" as const,
  };
  return validateScreen3EntryDraft({
    study: candidate,
    timing: { mode: "undecided", year: null },
  })
    .issues.filter(({ code }) =>
      code !== "proposed_timing" && code !== "treatment_year")
    .map(({ code, message }) => ({ code, message }));
}
type SixScreenProofTaskType =
  | "six-screen-policy-fact-proof"
  | "six-screen-mechanism-proof";

type SixScreenProofEntry = {
  coordinates: HostReasoningPrivateTaskCoordinates;
  task: HostReasoningPublicTaskState;
};

type StudyFirstHostEntry = {
  coordinates: HostReasoningPrivateTaskCoordinates;
  task: HostReasoningPublicTaskState;
};

type StudyFirstHostEntries = Record<string, StudyFirstHostEntry | undefined>;

function studyFirstHostEntryKey(
  taskType: StudyFirstHostTaskType,
  selectedEventId: string,
) {
  return `${taskType}:${selectedEventId}`;
}

type PolicyAutomationState = {
  identityFingerprint: string | null;
  status: "idle" | "running" | "complete" | "paused";
  message: string;
  detail?: string;
};

type SafeAnalysisRecoveryTrace = {
  version: "shockaudit-analysis-recovery-v1";
  action: string;
  stage: SafeSixScreenWorkflowProblem["stage"] | "canonical_validation" |
    "canonical_reconciliation";
  safeCode: string;
  /** Preserve the initiating diagnosis while reconciliation is reported. */
  failureStage: SafeSixScreenWorkflowProblem["stage"] |
    "canonical_validation";
  failureCode: string;
  reconciliationStatus: "not_started" | "verified" | "unavailable";
  operationReference: string | null;
  clientRevision: number;
  latestVerifiedRevision: number | null;
  responseBuild: string;
  dispatchCertainty: "not_dispatched" | "dispatched" | "unknown";
  receiptSaved: boolean;
  validatedArtifactSaved: boolean;
  canonicalAccepted: boolean;
  widgetPersistenceSaved: boolean | null;
  taskStatus?: string | null;
  taskFailureCode?: string | null;
  taskFailureStage?: string | null;
};

export function analysisFailureDescriptor(caught: unknown): Pick<
  SafeAnalysisRecoveryTrace,
  "failureStage" | "failureCode" | "dispatchCertainty"
> {
  const problem = caught instanceof SixScreenWorkflowProblemError
    ? caught.problem
    : null;
  return {
    failureStage: problem?.stage ??
      (caught instanceof SixScreenWorkflowResponseError
        ? "canonical_validation" : "host_delivery"),
    failureCode: problem?.safeCauseCodes[0] ?? problem?.code ??
      (caught instanceof SixScreenWorkflowResponseError
        ? caught.code : "tool_delivery_unclassified"),
    dispatchCertainty: problem?.dispatchCertainty ?? "unknown",
  };
}

type FormState = {
  shockInput: string;
  officialSource: string;
  requestedJurisdiction: string;
  approximateYear: string;
  intendedEpisode: string;
  population: string;
  analysisUnit: string;
  geography: string;
  industry: string;
  periodStart: string;
  periodEnd: string;
  outcome: string;
  outcomeMeasure: string;
  intendedConstruct: string;
  policySideConcept: string;
  initialExplanation: string;
  proposedTreatment: string;
  proposedComparison: string;
  resultsPreviouslyInspected: "yes" | "no" | "not_disclosed";
};

type TimingFormState = {
  mode: "" | ProposedTreatmentTimingInput["mode"];
  year: string;
};

const emptyTimingForm: TimingFormState = { mode: "", year: "" };
type RdRuleDraft = NonNullable<StudyDesignClarifications["rd"]>;
function emptyRdRuleDraft(): RdRuleDraft {
  return {
    runningVariable: "", cutoff: "", operator: ">=", assignmentRule: "",
    treatmentTarget: "eligibility", assignmentRelation: "unknown",
    verification: "researcher_reported", otherConditions: null,
    bindingStatus: "unknown", probabilityJump: "not_reported",
  };
}

function timingFormFromSnapshot(
  snapshot: SixScreenWorkflowPrivateSnapshot | null,
): TimingFormState {
  const currentIdentity = snapshot?.state.confirmedShock?.identityFingerprint;
  const timing = [...(snapshot?.state.proposedTreatmentTimings ?? [])]
    .reverse().find(({ identityFingerprint }) =>
      identityFingerprint === currentIdentity);
  if (timing) {
    return {
      mode: timing.mode,
      year: timing.mode === "year" ? String(timing.year) : "",
    };
  }
  const legacyReview = [...(snapshot?.state.policyEventCardReviews ?? [])]
    .reverse().find(({ lockedEventCard }) => {
      if (!lockedEventCard) return false;
      return lockedEventCard.binding.identityFingerprint === currentIdentity &&
        lockedEventCard.treatmentClock.mode === "selected";
    });
  const selected = legacyReview?.lockedEventCard?.treatmentClock;
  const year = selected?.mode === "selected" &&
      selected.candidate.timing.mode === "absolute"
    ? /^(\d{4})/u.exec(selected.candidate.timing.start)?.[1] ?? ""
    : "";
  return year ? { mode: "year", year } : emptyTimingForm;
}

export function screen3RdRuleDraftFromSnapshot(
  snapshot: SixScreenWorkflowPrivateSnapshot | null,
): RdRuleDraft | null {
  if (!snapshot) return null;
  const { state } = snapshot;
  if (!state.study || !state.confirmedShock) return null;
  const adviceContentIsCanonical = (advice: StudyDesignAdvice) => {
    const {
      schemaVersion: _schemaVersion,
      adviceId,
      createdAt: _createdAt,
      adviceFingerprint,
      ...content
    } = advice;
    return fingerprintSixScreenValue(content) === adviceFingerprint &&
      adviceId === `screen3-advice-${
        adviceFingerprint.slice("fnv1a64:".length)
      }`;
  };
  const entryContentIsCanonical = (entry: Screen3StudyEntryContext) => {
    const {
      schemaVersion: _schemaVersion,
      id,
      createdAt: _createdAt,
      entryFingerprint,
      ...content
    } = entry;
    return fingerprintSixScreenValue(content) === entryFingerprint &&
      id === `screen3-entry-${
        entryFingerprint.slice("fnv1a64:".length)
      }`;
  };
  const clarificationIsCanonical = (advice: StudyDesignAdvice) =>
    fingerprintSixScreenValue(advice.clarifications) ===
      advice.binding.clarificationFingerprint;
  const currentEntry = currentScreen3StudyEntryContext(state);
  if (currentEntry) {
    if (!entryContentIsCanonical(currentEntry)) return null;
    const compatible = (state.studyDesignAdvices ?? []).filter((advice) =>
      advice.binding.identityFingerprint ===
        currentEntry.identityFingerprint &&
      advice.binding.studyRevision === currentEntry.studyRevision &&
      advice.binding.studyFingerprint === currentEntry.studyFingerprint &&
      advice.binding.timingFingerprint === currentEntry.timingFingerprint &&
      advice.binding.evidenceSnapshotIdOrNull ===
        currentEntry.evidence.snapshotId &&
      advice.binding.evidenceFingerprintOrNull ===
        currentEntry.evidence.snapshotFingerprint &&
      advice.binding.clarificationFingerprint ===
        currentEntry.clarificationFingerprint &&
      adviceContentIsCanonical(advice) &&
      clarificationIsCanonical(advice)
    );
    const distinctAdvice = new Set(compatible.map(({ adviceId,
      adviceFingerprint }) => `${adviceId}:${adviceFingerprint}`));
    if (distinctAdvice.size !== 1) return null;
    return compatible.at(-1)?.clarifications.rd ?? null;
  }

  // A snapshot predating entry-context persistence can still restore one
  // self-consistent current advice. Once any entry history exists, however,
  // the absence of a current entry is meaningful and an advice fallback is
  // no longer safe.
  if ((state.screen3StudyEntryContexts?.length ?? 0) > 0) return null;
  const currentAdvice = currentStudyDesignAdvice(state);
  if (!currentAdvice) return null;
  const currentScopeAdvices = (state.studyDesignAdvices ?? []).filter(
    (advice) =>
      advice.binding.identityFingerprint ===
        state.confirmedShock?.identityFingerprint &&
      advice.binding.studyRevision === state.study.revision,
  );
  if (
    currentScopeAdvices.length !== 1 ||
    currentScopeAdvices[0] !== currentAdvice ||
    !adviceContentIsCanonical(currentAdvice) ||
    !clarificationIsCanonical(currentAdvice)
  ) return null;
  return currentAdvice.clarifications.rd ?? null;
}

const emptyForm: FormState = {
  shockInput: "",
  officialSource: "",
  requestedJurisdiction: "",
  approximateYear: "",
  intendedEpisode: "",
  population: "",
  analysisUnit: "",
  geography: "",
  industry: "",
  periodStart: "",
  periodEnd: "",
  outcome: "",
  outcomeMeasure: "",
  intendedConstruct: "",
  policySideConcept: "",
  initialExplanation: "",
  proposedTreatment: "",
  proposedComparison: "",
  resultsPreviouslyInspected: "not_disclosed",
};

function operationId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function nullable(value: string) {
  return value.trim() ? value.trim() : null;
}

function list(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function officialInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return { sourceUrl: null, identifier: null };
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:"
      ? { sourceUrl: url.toString(), identifier: null }
      : { sourceUrl: null, identifier: trimmed };
  } catch {
    return { sourceUrl: null, identifier: trimmed };
  }
}

function studyFromForm(form: FormState): StudyContextDraft {
  return {
    population: nullable(form.population),
    analysisUnit: nullable(form.analysisUnit),
    geography: list(form.geography),
    industry: list(form.industry),
    period: {
      start: nullable(form.periodStart),
      end: nullable(form.periodEnd),
    },
    outcome: nullable(form.outcome),
    outcomeMeasure: nullable(form.outcomeMeasure),
    intendedConstruct: nullable(form.intendedConstruct),
    policySideConcept: nullable(form.policySideConcept),
    initialExplanation: nullable(form.initialExplanation),
    proposedTreatment: nullable(form.proposedTreatment),
    proposedComparison: nullable(form.proposedComparison),
    resultsPreviouslyInspected: form.resultsPreviouslyInspected,
  };
}

export function validateVisibleScreen3Draft(
  form: FormState,
  timing: TimingFormState,
) {
  return validateScreen3EntryDraft({
    study: studyFromForm(form),
    timing,
  });
}

export function shouldApplyCanonicalDraftRefresh(
  startingDraftEditVersion: number,
  currentDraftEditVersion: number,
) {
  return startingDraftEditVersion === currentDraftEditVersion;
}

function formFromSnapshot(snapshot: SixScreenWorkflowPrivateSnapshot): FormState {
  const state = snapshot.state;
  return {
    shockInput: state.currentShockInput,
    officialSource:
      state.officialIdentifier ?? state.officialSourceLocators.at(-1) ?? "",
    requestedJurisdiction: state.requestedJurisdiction ?? "",
    approximateYear: state.approximateYear ?? "",
    intendedEpisode: state.intendedEpisode ?? "",
    population: state.study.population ?? "",
    analysisUnit: state.study.analysisUnit ?? "",
    geography: state.study.geography.join(", "),
    industry: state.study.industry.join(", "),
    periodStart: state.study.period.start ?? "",
    periodEnd: state.study.period.end ?? "",
    outcome: state.study.outcome ?? "",
    outcomeMeasure: state.study.outcomeMeasure ?? "",
    intendedConstruct: state.study.intendedConstruct ?? "",
    policySideConcept: state.study.policySideConcept ?? "",
    initialExplanation: state.study.initialExplanation ?? "",
    proposedTreatment: state.study.proposedTreatment ?? "",
    proposedComparison: state.study.proposedComparison ?? "",
    resultsPreviouslyInspected: state.study.resultsPreviouslyInspected,
  };
}

function currentLockedEventCard(
  snapshot: SixScreenWorkflowPrivateSnapshot | null,
) {
  if (!snapshot) return null;
  const currentSnapshotIds = new Set(
    snapshot.state.artifacts
      .filter(({ screen, status }) => screen === 2 && status === "current")
      .map(({ snapshotId }) => snapshotId),
  );
  return [...(snapshot.state.policyEventCardReviews ?? [])]
    .reverse()
    .find((review) =>
      review.status === "locked" && review.lockedEventCard &&
      currentSnapshotIds.has(review.lockedEventCard.snapshotId)
    )?.lockedEventCard ?? null;
}

export function policyResearchStepCommitted(
  before: SixScreenWorkflowPrivateSnapshot,
  after: SixScreenWorkflowPrivateSnapshot,
  stepId: string,
) {
  if (
    before.runId !== after.runId || after.revision <= before.revision ||
    before.state.confirmedShock?.identityFingerprint !==
      after.state.confirmedShock?.identityFingerprint
  ) return false;
  const previous = before.state.policyReview;
  const current = after.state.policyReview;
  if (!current) return false;
  if (!previous) {
    return current.progress.searchedSteps > 0 ||
      current.plan.steps.some(({ status }) => status === "searched");
  }
  if (previous.taskId !== current.taskId) return false;
  const previousStep = previous.plan.steps.find(({ id }) => id === stepId);
  const currentStep = current.plan.steps.find(({ id }) => id === stepId);
  return (currentStep?.attempts ?? 0) > (previousStep?.attempts ?? 0) ||
    current.progress.searchedSteps > previous.progress.searchedSteps ||
    (previous.plan.nextStepId === stepId && current.plan.nextStepId !== stepId) ||
    (previousStep?.status !== "searched" && currentStep?.status === "searched");
}

function policyPlanProgress(review: PolicyReview) {
  const searched = review.plan.steps.filter(({ status }) =>
    status === "searched").length;
  const notNeeded = review.plan.steps.filter(({ status }) =>
    status === "not_needed").length;
  const unavailable = review.plan.steps.filter(({ status }) =>
    status === "blocked").length;
  const finished = searched + notNeeded + unavailable;
  return { searched, notNeeded, unavailable, finished };
}

function completedPolicyResearchMessage(review: PolicyReview) {
  return `Done! Please see below. ${review.claimCount} source-linked finding${review.claimCount === 1 ? " is" : "s are"} ready.`;
}

export async function reconcilePolicyResearchStep(input: {
  before: SixScreenWorkflowPrivateSnapshot;
  stepId: string;
  mutate: (
    snapshot: SixScreenWorkflowPrivateSnapshot,
  ) => Promise<SixScreenWorkflowPrivateSnapshot>;
  refresh: (
    snapshot: SixScreenWorkflowPrivateSnapshot,
  ) => Promise<SixScreenWorkflowPrivateSnapshot>;
}) {
  let firstFailure: unknown = null;
  try {
    const response = await input.mutate(input.before);
    if (policyResearchStepCommitted(input.before, response, input.stepId)) {
      return response;
    }
  } catch (caught) {
    firstFailure = caught;
  }

  let canonical: SixScreenWorkflowPrivateSnapshot;
  try {
    canonical = await input.refresh(input.before);
  } catch {
    const detail = firstFailure instanceof Error
      ? ` ${firstFailure.message}`
      : "";
    throw new Error(
      `The research receipt could not be verified against canonical workspace state, so ShockAudit did not retry the mutation.${detail}`,
    );
  }
  if (policyResearchStepCommitted(input.before, canonical, input.stepId)) {
    return canonical;
  }
  if (canonical.revision !== input.before.revision) {
    throw new Error(
      "Canonical workspace state changed without completing this research step. Refresh the panel before resuming; no mutation was replayed.",
    );
  }

  throw new Error(
    "The canonical workspace did not record the requested research step. The standard plan is paused without automatically repeating the source request; resume it explicitly after checking status.",
  );
}

export function proofCoordinatesMatchSnapshot(
  coordinates: HostReasoningPrivateTaskCoordinates,
  snapshot: SixScreenWorkflowPrivateSnapshot | null,
) {
  const eventCard = currentLockedEventCard(snapshot);
  return Boolean(
    snapshot && eventCard && coordinates.runId === snapshot.runId &&
      coordinates.expectedParentRevision === snapshot.revision &&
      coordinates.expectedScopeFingerprint ===
        fingerprintSixScreenValue(snapshot.state) &&
      coordinates.expectedEventFingerprint === eventCard.eventCardFingerprint,
  );
}

export function studyFirstHostCoordinatesMatchSnapshot(
  coordinates: HostReasoningPrivateTaskCoordinates,
  snapshot: SixScreenWorkflowPrivateSnapshot | null,
  expectedEventFingerprint: string | null =
    coordinates.expectedEventFingerprint,
) {
  return Boolean(
    snapshot && expectedEventFingerprint &&
      coordinates.runId === snapshot.runId &&
      coordinates.expectedParentRevision === snapshot.revision &&
      coordinates.expectedScopeFingerprint ===
        fingerprintSixScreenValue(snapshot.state) &&
      coordinates.expectedEventFingerprint === expectedEventFingerprint,
  );
}

function initialViewScreen(snapshot: SixScreenWorkflowPrivateSnapshot | null) {
  return snapshot?.state.activeScreen === 6
    ? 6 as const
    : snapshot?.state.activeScreen === 5
    ? 5 as const
    : snapshot?.state.activeScreen === 4
    ? 4 as const
    : snapshot?.state.activeScreen === 3
    ? 3 as const
    : snapshot?.state.activeScreen === 2
      ? 2 as const
      : 1 as const;
}

function privateSnapshotFromWidgetState() {
  const widget = window.openai?.widgetState;
  if (!widget || typeof widget !== "object") return null;
  const privateContent = "privateContent" in widget &&
      widget.privateContent && typeof widget.privateContent === "object"
    ? widget.privateContent
    : null;
  if (!privateContent) return null;
  const candidate = (privateContent as Record<string, unknown>)
    .sixScreenWorkflow;
  return isPrivateSnapshot(candidate) ? candidate : null;
}

function hasLegacySavedState() {
  const widget = window.openai?.widgetState;
  if (!widget || typeof widget !== "object") return false;
  const privateContent = "privateContent" in widget &&
      widget.privateContent && typeof widget.privateContent === "object"
    ? widget.privateContent
    : widget;
  const record = privateContent as Record<string, unknown>;
  return Boolean(
    !record.sixScreenWorkflow &&
      (record.screen01 || record.screen02 || record.screen02Workflow ||
        record.screen03Workflow || record.screen04Workflow),
  );
}

function isPrivateSnapshot(value: unknown): value is SixScreenWorkflowPrivateSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const snapshot = value as Partial<SixScreenWorkflowPrivateSnapshot>;
  return snapshot.schemaVersion === "shockaudit-six-screen-private-v1" &&
    typeof snapshot.runId === "string" &&
    typeof snapshot.accessToken === "string" &&
    Number.isSafeInteger(snapshot.revision) &&
    typeof snapshot.stateFingerprint === "string" &&
    typeof snapshot.state === "object" && snapshot.state !== null;
}

export { workflowSnapshotResponseDisposition } from "./workflow-response";

export function screen3SubmissionBaseMatches(
  before: SixScreenWorkflowPrivateSnapshot,
  after: SixScreenWorkflowPrivateSnapshot,
) {
  const beforeIdentity = before.state.confirmedShock?.identityFingerprint ?? null;
  const afterIdentity = after.state.confirmedShock?.identityFingerprint ?? null;
  const latestTiming = (snapshot: SixScreenWorkflowPrivateSnapshot) =>
    [...(snapshot.state.proposedTreatmentTimings ?? [])].reverse().find(
      ({ identityFingerprint }) => identityFingerprint === beforeIdentity,
    ) ?? null;
  return before.runId === after.runId &&
    beforeIdentity !== null && beforeIdentity === afterIdentity &&
    screen3HandoffDependencyManifest(before.state).dependencyFingerprint ===
      screen3HandoffDependencyManifest(after.state).dependencyFingerprint &&
    sameSixScreenValue(before.state.study, after.state.study) &&
    sameSixScreenValue(latestTiming(before), latestTiming(after));
}

export function screen3HandoffOperationCoordinates(
  snapshot: SixScreenWorkflowPrivateSnapshot,
  payload: Screen3HandoffScientificPayload,
) {
  const inputFingerprint = fingerprintSixScreenValue(payload);
  const dependencyFingerprint = screen3HandoffDependencyManifest(
    snapshot.state,
  ).dependencyFingerprint;
  const operationFingerprint = fingerprintSixScreenValue({
    schemaVersion: "screen-03-handoff-operation-v1",
    runId: snapshot.runId,
    operationKind: "open_screen_3",
    inputFingerprint,
    dependencyFingerprint,
  });
  return {
    schemaVersion: "screen-03-handoff-recovery-v1" as const,
    runId: snapshot.runId,
    operationId:
      `screen3-open-${operationFingerprint.slice("fnv1a64:".length)}`,
    operationKind: "open_screen_3" as const,
    inputFingerprint,
    dependencyFingerprint,
    scientificBinding: createScreen3HandoffScientificBinding(
      snapshot.state,
      payload,
    ),
  };
}

export { screen3OperationStatusDisposition } from "./screen3-handoff-state";

export function isTerminalScreen3RebuildProblem(
  problem: SafeSixScreenWorkflowProblem,
) {
  return problem.commitCertainty === "not_committed" &&
    problem.safeCauseCodes.some((code) => [
      "screen3_rebuild_binding_invalid",
      "source_operation_conflict",
      "source_receipt_unavailable",
    ].includes(code));
}

function isPolicyEventCardWorkspace(
  value: unknown,
): value is PolicyEventCardWorkspace {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const workspace = value as Partial<PolicyEventCardWorkspace>;
  if (
    workspace.schemaVersion !== "screen-02-policy-event-card-workspace-v1" ||
    !Array.isArray(workspace.revisions) ||
    !(workspace.activeReview === null ||
      (typeof workspace.activeReview === "object" && workspace.activeReview))
  ) return false;
  return workspace.availability === "ready"
    ? Boolean(workspace.projection && typeof workspace.projection === "object")
    : workspace.availability === "unavailable" && workspace.projection === null;
}

function isPolicyLifecycleStageReviewWorkspace(
  value: unknown,
): value is PolicyLifecycleStageReviewWorkspace {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const workspace = value as Partial<PolicyLifecycleStageReviewWorkspace>;
  return workspace.schemaVersion ===
      "screen-02-policy-lifecycle-stage-workspace-v1" &&
    Array.isArray(workspace.entries) &&
    typeof workspace.claimBoundary === "string";
}

function projectionFromToolResponse(
  projection: SixScreenWorkflowPublicProjection,
  metadata: Record<string, unknown>,
) {
  if (projection.schemaVersion !== "shockaudit-six-screen-public-v1") {
    throw new Error("The canonical workflow response used an unsupported public-state contract.");
  }
  const metadataWorkspace = metadata[
    SIX_SCREEN_POLICY_EVENT_CARD_WORKSPACE_META_KEY
  ];
  const metadataLifecycleStageWorkspace = metadata[
    SIX_SCREEN_POLICY_LIFECYCLE_STAGE_WORKSPACE_META_KEY
  ];
  return {
    ...projection,
    policyEventCardWorkspace: isPolicyEventCardWorkspace(metadataWorkspace)
      ? metadataWorkspace
      : isPolicyEventCardWorkspace(projection.policyEventCardWorkspace)
        ? projection.policyEventCardWorkspace
        : null,
    policyLifecycleStageReviewWorkspace:
      isPolicyLifecycleStageReviewWorkspace(metadataLifecycleStageWorkspace)
        ? metadataLifecycleStageWorkspace
        : isPolicyLifecycleStageReviewWorkspace(
            projection.policyLifecycleStageReviewWorkspace,
          )
          ? projection.policyLifecycleStageReviewWorkspace
          : null,
  };
}

export function message(error: unknown) {
  if (!(error instanceof Error)) return "ShockAudit could not complete the request.";
  if (error.name === "AbortError") return "";
  if (error instanceof SixScreenWorkflowProblemError) {
    const problem = error.problem;
    const stage = problem.stage.replaceAll("_", " ");
    return `${error.message} Failed stage: ${stage}. [${problem.diagnosticReference}]`;
  }
  if (error instanceof SixScreenWorkflowResponseError) {
    return `${error.message} [SA-${error.reference}]`;
  }
  const sanitized = error.message
    .replace(/sa6[ar]_[A-Za-z0-9_-]+/gu, "[private workflow coordinate]")
    .slice(0, 500);
  if (/\b(?:connection|fetch|network|response|transport)\b.*\b(?:failed|interrupted|lost|reset|timed?\s*out|unavailable)\b|\b(?:failed|interrupted|lost|reset|timed?\s*out)\b.*\b(?:connection|fetch|network|response|transport)\b/iu.test(sanitized)) {
    const reference = fingerprintSixScreenValue(sanitized).slice(-8)
      .toUpperCase();
    return `The workspace response was interrupted after your action may have been saved. Check saved status before repeating the action. [SA-${reference}]`;
  }
  if (/\b(?:MCP error|RuntimeException|TextContent\s*\(|INVALID_ARGUMENT)\b/iu.test(sanitized)) {
    const reference = fingerprintSixScreenValue(sanitized).slice(-8)
      .toUpperCase();
    return `ShockAudit could not reconcile the workspace response. Check saved status before repeating the action. [SA-${reference}]`;
  }
  return sanitized;
}

/**
 * A screen-entry response can be rejected after the new active screen and its
 * checkpoint have been committed. Resolve
 * that exact ambiguity through the authenticated recovery read and never
 * resend the navigation action automatically.
 */
export function screen4EntryMatchesSelection(
  before: SixScreenWorkflowPrivateSnapshot,
  after: SixScreenWorkflowPrivateSnapshot,
) {
  const state = after.state;
  return state.activeScreen === 4 && after.revision >= before.revision &&
    state.runId === before.state.runId &&
    state.study.revision === before.state.study.revision &&
    state.confirmedShock?.identityFingerprint ===
      before.state.confirmedShock?.identityFingerprint &&
    (currentStudyDesignSelection(state)?.selectionFingerprint ?? null) ===
      (currentStudyDesignSelection(before.state)?.selectionFingerprint ?? null) &&
    Boolean(currentStudyFirstEventInvestigation({
      studyFirstEventInvestigations: state.studyFirstEventInvestigations,
      confirmedShock: state.confirmedShock, study: state.study,
      entryContext: currentScreen3StudyEntryContext(state),
      timing: currentProposedTreatmentTiming(state),
      advice: currentStudyDesignAdvice(state), selection: currentStudyDesignSelection(state),
    }));
}

export function savedStudyDesignDecisionMatchesRequest(
  before: SixScreenWorkflowPrivateSnapshot,
  after: SixScreenWorkflowPrivateSnapshot,
  mutation: Record<string, unknown>,
) {
  const selected = currentStudyDesignSelection(after.state);
  return after.state.runId === before.state.runId &&
    after.revision > before.revision &&
    after.state.study.revision === before.state.study.revision &&
    after.state.confirmedShock?.identityFingerprint ===
      before.state.confirmedShock?.identityFingerprint &&
    selected?.adviceId === mutation.adviceId &&
    selected?.adviceFingerprint === mutation.expectedAdviceFingerprint &&
    sameSixScreenValue(selected?.decision, mutation.decision) &&
    selected?.rationale === mutation.rationale;
}

export async function openScreenWithCanonicalRecovery(input: {
  targetScreen: 4 | 5 | 6;
  open: () => Promise<SixScreenWorkflowPrivateSnapshot>;
  recover: () => Promise<SixScreenWorkflowPrivateSnapshot>;
  acceptRecovered?: (snapshot: SixScreenWorkflowPrivateSnapshot) => boolean;
}) {
  try {
    return { snapshot: await input.open(), recovered: false } as const;
  } catch (caught) {
    const mayHaveCommitted = caught instanceof SixScreenWorkflowResponseError ||
      caught instanceof SixScreenWorkflowProblemError &&
        caught.problem.commitCertainty !== "not_committed" &&
        ["serialization", "host_delivery", "projection"].includes(
          caught.problem.stage,
        );
    if (!mayHaveCommitted) throw caught;
    let recovered: SixScreenWorkflowPrivateSnapshot;
    try {
      recovered = await input.recover();
    } catch {
      // Preserve the original actionable navigation failure. A secondary
      // read failure must not disguise its commit certainty or diagnostic.
      throw caught;
    }
    if (recovered.state.activeScreen !== input.targetScreen ||
        input.acceptRecovered && !input.acceptRecovered(recovered)) throw caught;
    return { snapshot: recovered, recovered: true } as const;
  }
}

/**
 * Screen 5 saves several consecutive checkpoints from one explicit generation
 * request.  Mechanisms can become visible before the final checkpoint returns,
 * so Screen 6 navigation must not race either of these two client actions.
 */
export function screen5CheckpointIsActive(
  activeActions: ReadonlySet<string>,
) {
  return activeActions.has("compare-study-first-mechanisms") ||
    activeActions.has("advance-direct-screen5");
}

function WorkflowErrorAlert(props: {
  message: string;
  diagnostic: SixScreenWorkflowResponseDiagnostic | null;
  onCheckSavedStatus?: () => void;
}) {
  if (!props.message) return null;
  return (
    <div className="six-alert six-alert--error" role="alert">
      <p>{props.message}</p>
      {props.diagnostic ? (
        <details className="six-technical-details">
          <summary>Inspect sanitized response diagnostics</summary>
          <p>
            These local diagnostics contain build and schema labels, equality
            checks, revisions, non-secret fingerprints, and field-shape
            differences. They omit workflow access tokens and state values.
          </p>
          <pre>{JSON.stringify(props.diagnostic, null, 2)}</pre>
        </details>
      ) : null}
      {props.onCheckSavedStatus ? (
        <button type="button" className="six-primary"
          onClick={props.onCheckSavedStatus}>
          Check saved status
        </button>
      ) : null}
    </div>
  );
}

function focusScreen3Field(fieldId: Screen3EntryFieldId | undefined) {
  if (!fieldId) return;
  window.requestAnimationFrame(() => {
    const field = document.getElementById(`screen3-${fieldId}`);
    if (!(field instanceof HTMLElement)) return;
    field.focus();
    field.scrollIntoView?.({ behavior: "smooth", block: "center" });
  });
}

function Field(props: {
  label: string;
  name: keyof FormState;
  value: string;
  onChange: (name: keyof FormState, value: string) => void;
  required?: boolean;
  hint?: string;
  type?: "text" | "url";
  disabled?: boolean;
  id?: string;
  error?: string;
}) {
  const errorId = props.error && props.id ? `${props.id}-error` : undefined;
  return (
    <label className="six-field">
      <span>{props.label}{props.required ? " *" : ""}</span>
      <input
        id={props.id}
        name={props.name}
        type={props.type ?? "text"}
        value={props.value}
        required={props.required}
        disabled={props.disabled}
        aria-invalid={Boolean(props.error)}
        aria-describedby={errorId}
        onChange={(event) => props.onChange(props.name, event.target.value)}
      />
      {props.hint ? <small>{props.hint}</small> : null}
      {props.error ? (
        <small id={errorId} className="six-field-error" role="alert">
          {props.error}
        </small>
      ) : null}
    </label>
  );
}

type ReadyPolicyEventCardWorkspace = Extract<
  PolicyEventCardWorkspace,
  { availability: "ready" }
>;

const claimDecisionOptions: Array<{
  value: Exclude<PolicyClaimReviewDecision, "unreviewed">;
  label: string;
}> = [
  { value: "accepted", label: "Accept as supported" },
  { value: "provisional", label: "Use provisionally" },
  { value: "rejected", label: "Reject this claim" },
  { value: "needs_more_evidence", label: "Needs more evidence" },
  { value: "corrected", label: "Record my correction" },
];

function readable(value: string) {
  return value.replaceAll("_", " ");
}

export function prerequisiteBlockerMessages(
  blockers: ReadonlyArray<{ message: string }> | null | undefined,
) {
  return blockers?.map(({ message }) => message.trim()).filter(Boolean).join(" ") ??
    "";
}

function timingLabel(timing: PolicyChronologyTiming) {
  if (timing.mode === "absolute") {
    return timing.end && timing.end !== timing.start
      ? `${timing.start} to ${timing.end}`
      : timing.start;
  }
  if (timing.mode === "relative") {
    const anchor = timing.anchorStage
      ? readable(timing.anchorStage)
      : "the cited anchor";
    return `${timing.offsetDays} days after ${anchor}; no calendar date inferred`;
  }
  return "The retained source did not establish a normalized date.";
}

function ClaimDecisionForm(props: {
  claim: PolicyEventCardClaimReview;
  review: PolicyEventCardReviewState;
  disabled: boolean;
  onSave: (input: {
    claimId: string;
    decision: Exclude<PolicyClaimReviewDecision, "unreviewed">;
    correctedStatement?: string | null;
    rationale: string;
  }) => Promise<void>;
}) {
  type ConsequentialDecision = Exclude<
    PolicyClaimReviewDecision,
    "unreviewed"
  >;
  const [decision, setDecision] = useState<ConsequentialDecision | "">(
    props.claim.decision === "unreviewed" ? "" : props.claim.decision,
  );
  const [correction, setCorrection] = useState(
    props.claim.decision === "corrected"
      ? props.claim.effectiveStatement
      : "",
  );
  const [rationale, setRationale] = useState(props.claim.rationale ?? "");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!decision) return;
    await props.onSave({
      claimId: props.claim.claimId,
      decision,
      ...(decision === "corrected"
        ? { correctedStatement: correction.trim() }
        : {}),
      rationale: rationale.trim(),
    });
  }

  return (
    <article className="six-review-claim" data-decision={props.claim.decision}>
      <div className="six-review-claim-heading">
        <div>
          <p className="six-kicker">{readable(props.claim.predicate)}</p>
          <strong>{props.claim.sourceStatement}</strong>
        </div>
        <span>{readable(props.claim.decision)}</span>
      </div>
      <dl className="six-review-facts">
        <div><dt>Evidence support</dt><dd>{readable(props.claim.supportStatus)}</dd></div>
        <div><dt>Source review</dt><dd>{readable(props.claim.sourceReviewStatus)}</dd></div>
        <div><dt>Scope</dt><dd>{props.claim.scope}</dd></div>
      </dl>
      {props.claim.conflictIds.length ? (
        <p className="six-policy-qualification">
          This claim has {props.claim.conflictIds.length} unresolved source conflict
          {props.claim.conflictIds.length === 1 ? "" : "s"}.
        </p>
      ) : null}
      <details>
        <summary>Inspect typed value and source lineage</summary>
        <pre>{JSON.stringify(props.claim.sourceTypedValue, null, 2)}</pre>
        <ul className="six-lineage-list">
          {props.claim.lineages.map((lineage) => (
            <li key={`${lineage.direction}:${lineage.passageId}`}>
              {readable(lineage.direction)} · passage {lineage.passageId} · source {lineage.sourceId}
            </li>
          ))}
        </ul>
      </details>
      {props.claim.statementOrigin === "researcher_supplied" ? (
        <div className="six-researcher-correction">
          <strong>Researcher-supplied correction</strong>
          <p>{props.claim.effectiveStatement}</p>
          <small>
            This correction is stored separately from the source statement and does
            not inherit its typed value or support status.
          </small>
        </div>
      ) : null}
      {props.review.status === "in_review" ? (
        <form className="six-review-form" onSubmit={(event) => void submit(event)}>
          <label>
            <span>Decision</span>
            <select
              aria-label={`Decision for ${readable(props.claim.predicate)}`}
              value={decision}
              disabled={props.disabled}
              onChange={(event) => setDecision(event.target.value as typeof decision)}
            >
              <option value="" disabled>Choose a decision</option>
              {claimDecisionOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          {decision === "corrected" ? (
            <label>
              <span>Your corrected statement</span>
              <textarea
                value={correction}
                required
                maxLength={4_000}
                disabled={props.disabled}
                onChange={(event) => setCorrection(event.target.value)}
              />
              <small>The original source statement remains unchanged above.</small>
            </label>
          ) : null}
          <label>
            <span>Reason for this decision</span>
            <textarea
              value={rationale}
              required
              maxLength={2_000}
              disabled={props.disabled}
              onChange={(event) => setRationale(event.target.value)}
            />
          </label>
          <button
            type="submit"
            className="six-secondary"
            disabled={props.disabled || !decision || !rationale.trim() ||
              (decision === "corrected" && !correction.trim())}
          >
            Save claim decision
          </button>
        </form>
      ) : null}
    </article>
  );
}

function TreatmentClockForm(props: {
  workspace: ReadyPolicyEventCardWorkspace;
  review: PolicyEventCardReviewState;
  disabled: boolean;
  onSave: (input: {
    decision:
      | { mode: "selected"; candidateId: string }
      | { mode: "no_selection" };
    rationale: string;
  }) => Promise<void>;
}) {
  const current = props.review.treatmentClockDecision;
  const [selection, setSelection] = useState(
    current.mode === "selected"
      ? current.candidateId
      : current.mode === "no_selection"
        ? "no_selection"
        : "",
  );
  const [rationale, setRationale] = useState(current.rationale ?? "");

  function choose(value: string) {
    setSelection(value);
    if (!rationale.trim()) {
      setRationale(value === "no_selection"
        ? "No retained legal stage is yet a defensible study treatment clock."
        : "Use this reviewed legal stage as the study clock while preserving its stated qualifications.");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selection) return;
    await props.onSave({
      decision: selection === "no_selection"
        ? { mode: "no_selection" }
        : { mode: "selected", candidateId: selection },
      rationale: rationale.trim(),
    });
  }

  return (
    <form className="six-clock-review" onSubmit={(event) => void submit(event)}>
      <div className="six-card-heading">
        <div>
          <p className="six-kicker">Researcher-owned choice</p>
          <h3>Choose the study treatment clock</h3>
        </div>
        <span>{readable(current.mode)}</span>
      </div>
      <p>
        Evidence can establish several legal or implementation clocks. ShockAudit
        will not select one as the study intervention date for you.
      </p>
      <fieldset disabled={props.disabled || props.review.status === "locked"}>
        <legend>Treatment timing decision</legend>
        {props.workspace.projection.treatmentClockReview.candidates.map((candidate) => (
          <label key={candidate.id} className="six-clock-option">
            <input
              type="radio"
              name={`treatment-clock-${props.review.id}`}
              value={candidate.id}
              checked={selection === candidate.id}
              onChange={() => choose(candidate.id)}
            />
            <span>
              <strong>{candidate.label}</strong>
              <small>{timingLabel(candidate.timing)}</small>
              <small>{candidate.qualification}</small>
            </span>
          </label>
        ))}
        <label className="six-clock-option">
          <input
            type="radio"
            name={`treatment-clock-${props.review.id}`}
            value="no_selection"
            checked={selection === "no_selection"}
            onChange={() => choose("no_selection")}
          />
          <span>
            <strong>Continue without selecting a treatment clock</strong>
            <small>The locked Event Card will preserve this as an explicit limitation.</small>
          </span>
        </label>
      </fieldset>
      {props.review.status === "in_review" ? (
        <>
          <label>
            <span>Reason for this timing decision</span>
            <textarea
              value={rationale}
              required
              maxLength={2_000}
              disabled={props.disabled}
              onChange={(event) => setRationale(event.target.value)}
            />
          </label>
          <button
            type="submit"
            className="six-secondary"
            disabled={props.disabled || !selection || !rationale.trim()}
          >
            Save treatment timing
          </button>
        </>
      ) : null}
    </form>
  );
}

function ChronologyAndSourcePanel(props: {
  workspace: ReadyPolicyEventCardWorkspace;
}) {
  const chronology = props.workspace.projection.chronology;
  const clocks = [
    ...chronology.absoluteClocks,
    ...chronology.relativeClocks,
    ...chronology.undatedClocks,
  ];
  return (
    <div className="six-evidence-workspace">
      <section aria-label="Evidence chronology">
        <div className="six-card-heading">
          <div>
            <p className="six-kicker">Server-reconstructed chronology</p>
            <h3>Separate policy clocks</h3>
          </div>
          <span>{clocks.length} retained clock{clocks.length === 1 ? "" : "s"}</span>
        </div>
        {clocks.length ? (
          <ol className="six-chronology">
            {clocks.map((clock) => (
              <li key={clock.id} data-conflict={clock.hasUnresolvedConflict}>
                <strong>{clock.label}</strong>
                <span>{timingLabel(clock.timing)}</span>
                {clock.qualifications.map((qualification) => (
                  <small key={qualification}>{qualification}</small>
                ))}
              </li>
            ))}
          </ol>
        ) : (
          <p>No supported policy clock was retained; the absence remains explicit.</p>
        )}
      </section>
      <details className="six-source-panel">
        <summary>
          Inspect {props.workspace.projection.sourcePanel.sourceCount} official source
          {props.workspace.projection.sourcePanel.sourceCount === 1 ? "" : "s"} and exact passages
        </summary>
        {props.workspace.projection.sourcePanel.sources.map((source) => (
          <article key={source.sourceId}>
            <div>
              <strong>{source.publisher}</strong>
              <span>{source.role}</span>
            </div>
            <a href={source.canonicalUrl} target="_blank" rel="noreferrer">
              Open official source
            </a>
            <p>
              {readable(source.inspectedText)} text inspected · {source.passages.length}
              {" "}retained passage{source.passages.length === 1 ? "" : "s"}
            </p>
            {source.passages.map((passage) => (
              <blockquote key={passage.passageId}>
                <strong>{passage.locator}</strong>
                <span>{passage.exactText}</span>
                {passage.qualification ? <small>{passage.qualification}</small> : null}
              </blockquote>
            ))}
          </article>
        ))}
      </details>
    </div>
  );
}

export function EventCardReviewPanel(props: {
  workspace: PolicyEventCardWorkspace | null;
  stageWorkspace?: PolicyLifecycleStageReviewWorkspace | null;
  restoredReview: PolicyEventCardReviewState | null;
  policyTitle?: string;
  episode?: string;
  unresolvedQuestions?: readonly string[];
  disabled: boolean;
  onBegin: (revisionReason: string | null) => Promise<void>;
  onClaim: (
    review: PolicyEventCardReviewState,
    input: {
      claimId: string;
      decision: Exclude<PolicyClaimReviewDecision, "unreviewed">;
      correctedStatement?: string | null;
      rationale: string;
    },
  ) => Promise<void>;
  onClock: (
    review: PolicyEventCardReviewState,
    input: {
      decision:
        | { mode: "selected"; candidateId: string }
        | { mode: "no_selection" };
      rationale: string;
    },
  ) => Promise<void>;
  onLock: (review: PolicyEventCardReviewState, rationale: string) => Promise<void>;
}) {
  const [revisionReason, setRevisionReason] = useState("");
  const [lockRationale, setLockRationale] = useState(
    "Continue with the current findings while preserving every unresolved item as an explicit limitation.",
  );
  const workspace = props.workspace;
  const activeReview = workspace?.activeReview ?? props.restoredReview;

  if (!workspace) {
    return activeReview ? (
      <section id="screen2-event-card-review" className="six-event-review" aria-label="Policy Event Card review">
        <div className="six-alert">
          The saved review is preserved. Reconnect the workspace to reconstruct and
          validate its immutable evidence before making another decision.
        </div>
      </section>
    ) : null;
  }
  if (workspace.availability === "unavailable") {
    return (
      <section id="screen2-event-card-review" className="six-event-review" aria-label="Policy Event Card review">
        <div className="six-alert six-alert--warning">
          <strong>Evidence-backed review is read-only.</strong> The saved decisions
          remain preserved, but the immutable evidence snapshot could not be
          reconstructed. No decision can be changed or locked in this state.
        </div>
        {workspace.revisions.length ? (
          <ol className="six-revision-history">
            {workspace.revisions.map((revision) => (
              <li key={revision.reviewId}>
                <div>
                  <strong>Revision {revision.ordinal}</strong>
                  <span>{readable(revision.status)}</span>
                </div>
              </li>
            ))}
          </ol>
        ) : null}
      </section>
    );
  }

  const reviewCanChange = Boolean(
    activeReview?.status === "in_review" &&
      (workspace.reviewStatus === "in_review" ||
        workspace.reviewStatus === "pending_revision"),
  );
  const unreviewedClaims = activeReview?.claimReviews.filter(
    ({ decision }) => decision === "unreviewed",
  ).length ?? 0;
  const timingUnreviewed = activeReview?.treatmentClockDecision.mode ===
    "unreviewed";
  const lifecycleStageBlockers = activeReview
    ? (props.stageWorkspace?.entries ?? []).filter((entry) =>
        entry.targetPolicyEventCardReviewId === activeReview.id &&
        (!entry.latestDisposition ||
          (entry.latestDisposition.decision ===
              "accepted_for_event_card_review" &&
            (!entry.latestProposal || !entry.latestProposalReview)))
      )
    : [];
  const canBegin = workspace.reviewStatus === "not_started" ||
    workspace.reviewStatus === "current" ||
    workspace.reviewStatus === "review_required";
  const beginNeedsReason = Boolean(activeReview);
  const beginLabel = workspace.reviewStatus === "current"
    ? "Open a new Event Card revision"
    : workspace.reviewStatus === "review_required"
      ? "Review the current evidence"
      : "Review and continue";
  const retainedClaims = workspace.projection.sourcePanel.sources.flatMap(
    ({ claims }) => claims ?? [],
  );
  const componentClaims = retainedClaims.length
    ? retainedClaims
    : activeReview?.claimReviews ?? [];
  const componentLabels = [...new Set(componentClaims.map(({ predicate }) =>
    readable(predicate)))].slice(0, 5);
  const coverageClaimCount = componentClaims.filter(({ predicate }) =>
    [
      "coverage_condition", "territorial_nexus", "threshold_condition",
      "exemption_rule",
    ].includes(predicate)
  ).length;
  const clocks = [
    ...workspace.projection.chronology.absoluteClocks,
    ...workspace.projection.chronology.relativeClocks,
    ...workspace.projection.chronology.undatedClocks,
  ];
  const unresolvedQuestions = props.unresolvedQuestions ??
    (workspace.projection.unresolvedRequirements ?? []).map(({ description }) =>
      description);

  return (
    <section id="screen2-event-card-review" className="six-event-review" aria-label="Policy Event Card review">
      <div className="six-card-heading">
        <div>
          <p className="six-kicker">Screen 2 review</p>
          <h3>Review the handoff to Screen 3</h3>
        </div>
        <span className="six-review-status">{readable(workspace.reviewStatus)}</span>
      </div>
      <dl className="six-event-review-summary">
        <div>
          <dt>Intended episode</dt>
          <dd>{props.policyTitle ?? "Confirmed policy"} ·
            {" "}{props.episode ?? "confirmed episode"}</dd>
        </div>
        <div>
          <dt>Policy components</dt>
          <dd>{componentLabels.length
            ? componentLabels.join(", ")
            : "No consequential component is retained yet."}</dd>
        </div>
        <div>
          <dt>Formal coverage</dt>
          <dd>{coverageClaimCount
            ? coverageClaimCount + " source-linked condition" +
              (coverageClaimCount === 1 ? "" : "s") +
              "; historical unit facts still determine assignment."
            : "Coverage conditions remain unresolved."}</dd>
        </div>
        <div>
          <dt>Timing</dt>
          <dd>{clocks.length
            ? clocks.length + " distinct legal-stage clock" +
              (clocks.length === 1 ? "" : "s") +
              "; no empirical treatment date is inferred."
            : "No source-supported policy clock is retained."}</dd>
        </div>
      </dl>
      {unresolvedQuestions.length ? (
        <div className="six-review-open-issues">
          <strong>Remaining material issues</strong>
          <ul>
            {unresolvedQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <details className="six-review-evidence-details">
        <summary>Inspect chronology, exact passages, and source lineage</summary>
        <ChronologyAndSourcePanel workspace={workspace} />
      </details>

      {canBegin && beginNeedsReason ? (
        <form
          className="six-begin-review"
          onSubmit={(event) => {
            event.preventDefault();
            void props.onBegin(revisionReason.trim() || null);
          }}
        >
          {beginNeedsReason ? (
            <label>
              <span>Reason for opening this review</span>
              <textarea
                value={revisionReason}
                required
                maxLength={2_000}
                disabled={props.disabled}
                onChange={(event) => setRevisionReason(event.target.value)}
              />
            </label>
          ) : null}
          <button
            type="submit"
            className="six-primary"
            disabled={props.disabled || (beginNeedsReason && !revisionReason.trim())}
          >
            {beginLabel}
          </button>
        </form>
      ) : null}

      {activeReview && reviewCanChange ? (
        <>
          <div className="six-review-progress" role="status">
            <strong>{activeReview.claimReviews.length - unreviewedClaims}/
              {activeReview.claimReviews.length}</strong>
            <span>consequential claims decided</span>
          </div>
          <details className="six-review-claims" aria-label="Consequential claim decisions">
            <summary>
              Review individual source claims ({unreviewedClaims} not yet decided)
            </summary>
            {activeReview.claimReviews.map((claim) => (
              <ClaimDecisionForm
                key={`${claim.claimId}:${claim.decisionEventId ?? "new"}`}
                claim={claim}
                review={activeReview}
                disabled={props.disabled}
                onSave={(input) => props.onClaim(activeReview, input)}
              />
            ))}
          </details>
          <TreatmentClockForm
            key={activeReview.treatmentClockDecision.decisionEventId ?? "new-clock"}
            workspace={workspace}
            review={activeReview}
            disabled={props.disabled}
            onSave={(input) => props.onClock(activeReview, input)}
          />
          <form
            className="six-lock-review"
            onSubmit={(event) => {
              event.preventDefault();
              void props.onLock(activeReview, lockRationale.trim());
            }}
          >
            <h3>Lock this Event Card</h3>
            <p>
              Locking preserves accepted decisions and carries undecided or unresolved
              claims forward only as explicit limitations. It does not classify firms
              as treated.
            </p>
            {unreviewedClaims ? (
              <p className="six-policy-qualification">
                {unreviewedClaims} claim
                {unreviewedClaims === 1 ? " remains" : "s remain"} unreviewed
                and will be retained as limitations, not accepted premises.
              </p>
            ) : null}
            {timingUnreviewed ? (
              <p className="six-policy-qualification">
                Choose a treatment clock or explicitly continue without one before
                saving this review.
              </p>
            ) : null}
            {lifecycleStageBlockers.length ? (
              <p className="six-policy-qualification">
                Complete document disposition and, when accepted, the separate
                stage proposal review for {lifecycleStageBlockers.length} routed
                lifecycle item{lifecycleStageBlockers.length === 1 ? "" : "s"}
                {" "}before locking.
              </p>
            ) : null}
            <label>
              <span>Reason for locking this reviewed record</span>
              <textarea
                value={lockRationale}
                required
                maxLength={2_000}
                disabled={props.disabled}
                onChange={(event) => setLockRationale(event.target.value)}
              />
            </label>
            <button
              type="submit"
              className="six-primary"
              disabled={props.disabled || timingUnreviewed ||
                Boolean(lifecycleStageBlockers.length) ||
                !lockRationale.trim()}
            >
              {unreviewedClaims
                ? "Save this partial review"
                : "Save reviewed Event Card"}
            </button>
          </form>
        </>
      ) : null}

      {activeReview?.lockedEventCard ? (
        <section className="six-locked-card" aria-label="Locked reviewed Event Card">
          <div className="six-card-heading">
            <div>
              <p className="six-kicker">Immutable reviewed record</p>
              <h3>Event Card revision {activeReview.ordinal} is locked</h3>
            </div>
            <span>{activeReview.lockedEventCard.reviewedAt}</span>
          </div>
          <p>
            {activeReview.lockedEventCard.claims.length} claim decisions and
            {" "}{activeReview.lockedEventCard.limitations.length} explicit limitation
            {activeReview.lockedEventCard.limitations.length === 1 ? "" : "s"} were retained.
          </p>
          {activeReview.lockedEventCard.limitations.length ? (
            <ul>
              {activeReview.lockedEventCard.limitations.map((limitation) => (
                <li key={`${limitation.code}:${limitation.relatedIds.join(":")}`}>
                  {limitation.summary}
                </li>
              ))}
            </ul>
          ) : null}
          {activeReview.lockedEventCard.lifecycleStageRevisions?.length ? (
            <div className="six-alert six-alert--success">
              <strong>
                {activeReview.lockedEventCard.lifecycleStageRevisions.length}
                {" "}accepted lifecycle-stage revision
                {activeReview.lockedEventCard.lifecycleStageRevisions.length === 1
                  ? ""
                  : "s"} included by this lock
              </strong>
              <ul>
                {activeReview.lockedEventCard.lifecycleStageRevisions.map(
                  (revision) => (
                    <li key={revision.contributionFingerprint}>
                      {revision.clock.label} · {timingLabel(revision.clock.timing)}
                      {" · "}{revision.sourceReference.nativeDocumentNumber}
                    </li>
                  ),
                )}
              </ul>
              <small>
                Each source, proposal decision, passage lineage, and original
                typed date remains fingerprint-bound in the Event Card.
              </small>
            </div>
          ) : null}
        </section>
      ) : null}

      {workspace.revisions.length ? (
        <details className="six-review-history" aria-label="Event Card revision history">
          <summary>Event Card revision history</summary>
          <ol className="six-revision-history">
            {[...workspace.revisions].reverse().map((revision) => (
              <li key={revision.reviewId}>
                <div>
                  <strong>Revision {revision.ordinal}</strong>
                  <span>{readable(revision.status)}</span>
                </div>
                <small>{revision.updatedAt}</small>
                {revision.changes.length ? (
                  <ul>
                    {revision.changes.map((change) => (
                      <li key={`${revision.reviewId}:${change.revision}`}>
                        {change.summary}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No decisions recorded yet.</p>
                )}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </section>
  );
}

type CausalComparisonDraft = {
  policyTarget: CausalPolicyTarget;
  targetDetail: string;
  targetClaimIds: string[];
  variationClaimIds: string[];
  assignmentUnit: string;
  proposedTreatedGroup: string;
  proposedComparisonGroup: string;
  dataAvailability:
    | "not_assessed"
    | "available"
    | "partially_available"
    | "unavailable";
  dataFrequency: string;
  historicalEligibilityFields: string;
  designConstraints: string;
};

function selectedEvidenceIds(
  current: readonly string[],
  id: string,
  checked: boolean,
) {
  return checked
    ? [...new Set([...current, id])]
    : current.filter((value) => value !== id);
}

function CausalDesignDecisionForm(props: {
  option: CausalDesignOption;
  disabled: boolean;
  onDecide: (input: {
    decision: { mode: "selected"; optionId: string };
    rationale: string;
  }) => Promise<void>;
}) {
  const [rationale, setRationale] = useState("");
  return (
    <form
      className="six-design-decision"
      onSubmit={(event) => {
        event.preventDefault();
        void props.onDecide({
          decision: { mode: "selected", optionId: props.option.id },
          rationale: rationale.trim(),
        });
      }}
    >
      <label>
        <span>Why carry this comparison forward?</span>
        <textarea
          required
          maxLength={2_000}
          value={rationale}
          disabled={props.disabled}
          onChange={(event) => setRationale(event.target.value)}
        />
      </label>
      <button
        type="submit"
        className="six-primary"
        disabled={props.disabled || !rationale.trim() ||
          props.option.status === "not_supported_by_current_variation"}
      >
        Select for further review
      </button>
    </form>
  );
}

function EvidenceSelection(props: {
  legend: string;
  hint: string;
  claims: PolicyReviewedEventCard["claims"];
  selected: string[];
  disabled: boolean;
  onChange: (ids: string[]) => void;
}) {
  return (
    <fieldset className="six-design-evidence" disabled={props.disabled}>
      <legend>{props.legend}</legend>
      <p>{props.hint}</p>
      {props.claims.map((claim) => (
        <label key={`${props.legend}:${claim.claimId}`}>
          <input
            type="checkbox"
            checked={props.selected.includes(claim.claimId)}
            onChange={(event) => props.onChange(selectedEvidenceIds(
              props.selected,
              claim.claimId,
              event.target.checked,
            ))}
          />
          <span>
            <strong>{readable(claim.predicate)}</strong>
            <small>{claim.effectiveStatement}</small>
            <small>
              {readable(claim.decision)} · {readable(claim.supportStatus)}
              {claim.statementOrigin === "researcher_supplied"
                ? " · researcher supplied"
                : ""}
            </small>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

export function CausalComparisonPanel(props: {
  workspace: CausalComparisonWorkspace;
  eventCard: PolicyReviewedEventCard;
  policyReview: PolicyReview | null;
  study: SixScreenWorkflowPublicProjection["study"];
  disabled: boolean;
  onBuild: (input: Omit<
    CausalComparisonInput,
    "schemaVersion" | "inputFingerprint"
  >) => Promise<void>;
  onDecide: (input: {
    decision:
      | { mode: "selected"; optionId: string }
      | { mode: "no_selection" };
    rationale: string;
  }) => Promise<void>;
}) {
  const usableClaims = props.eventCard.claims.filter(({ decision }) =>
    decision === "accepted" || decision === "provisional" ||
    decision === "corrected"
  );
  const [showBuilder, setShowBuilder] = useState(!props.workspace.designSet);
  const [draft, setDraft] = useState<CausalComparisonDraft>({
    policyTarget: "full_policy_package",
    targetDetail: "",
    targetClaimIds: [],
    variationClaimIds: [],
    assignmentUnit: props.study.analysisUnit ?? "",
    proposedTreatedGroup: props.study.proposedTreatment ?? "",
    proposedComparisonGroup: props.study.proposedComparison ?? "",
    dataAvailability: "not_assessed",
    dataFrequency: "",
    historicalEligibilityFields: "",
    designConstraints: "",
  });
  const [noSelectionRationale, setNoSelectionRationale] = useState("");
  const designSet = props.workspace.designSet;
  const decision = props.workspace.decision;
  const citations = new Map(
    (props.policyReview?.claims ?? []).map((claim) => [claim.claimId, claim]),
  );
  const targetNeedsDetail = draft.policyTarget === "policy_component" ||
    draft.policyTarget === "other_defined_exposure";

  function updateDraft<K extends keyof CausalComparisonDraft>(
    key: K,
    value: CausalComparisonDraft[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function submitBuild(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void props.onBuild({
      policyTarget: draft.policyTarget,
      targetDetail: targetNeedsDetail ? nullable(draft.targetDetail) : null,
      targetClaimIds: draft.targetClaimIds,
      variationClaimIds: draft.variationClaimIds,
      assignmentUnit: draft.assignmentUnit.trim(),
      proposedTreatedGroup: nullable(draft.proposedTreatedGroup),
      proposedComparisonGroup: nullable(draft.proposedComparisonGroup),
      dataAvailability: draft.dataAvailability,
      dataFrequency: nullable(draft.dataFrequency),
      historicalEligibilityFields: list(draft.historicalEligibilityFields),
      designConstraints: list(draft.designConstraints),
    });
  }

  return (
    <section className="six-causal-comparison" aria-label="Causal comparison workspace">
      <section className="six-card six-design-context">
        <p className="six-kicker">Current source-bound handoff</p>
        <h2>What comparison could answer your question?</h2>
        <dl className="six-identification-context">
          <div><dt>Study question</dt><dd>{props.study.initialExplanation}</dd></div>
          <div><dt>Population</dt><dd>{props.study.population}</dd></div>
          <div><dt>Outcome</dt><dd>{props.study.outcome}</dd></div>
          <div><dt>Geography</dt><dd>{props.study.geography.join(", ")}</dd></div>
          <div>
            <dt>Study period</dt>
            <dd>{props.study.period.start} to {props.study.period.end}</dd>
          </div>
          <div>
            <dt>Prior results inspection</dt>
            <dd>{readable(props.study.resultsPreviouslyInspected)}</dd>
          </div>
          <div>
            <dt>Event Card</dt>
            <dd>Revision {props.eventCard.reviewOrdinal} · {props.eventCard.snapshotId}</dd>
          </div>
          <div>
            <dt>Treatment timing</dt>
            <dd>
              {props.eventCard.treatmentClock.mode === "selected"
                ? props.eventCard.treatmentClock.candidate.label
                : "Explicitly not selected in Screen 2"}
            </dd>
          </div>
        </dl>
        {[
          ...props.eventCard.chronology.absoluteClocks,
          ...props.eventCard.chronology.relativeClocks,
          ...props.eventCard.chronology.undatedClocks,
        ].length ? (
          <details className="six-alternative-clocks">
            <summary>Alternative policy clocks retained from Screen 2</summary>
            <ul>
              {[
                ...props.eventCard.chronology.absoluteClocks,
                ...props.eventCard.chronology.relativeClocks,
                ...props.eventCard.chronology.undatedClocks,
              ].map((clock) => (
                <li key={clock.id}>
                  <strong>{clock.label}</strong>
                  <span>{timingLabel(clock.timing)}</span>
                  {clock.qualifications.map((qualification) => (
                    <small key={qualification}>{qualification}</small>
                  ))}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        <div className="six-alert six-alert--warning">
          These options organize evidence and assumptions. They do not certify
          exogeneity, parallel trends, local random assignment, or causal validity.
        </div>
      </section>

      {showBuilder ? (
        <form className="six-card six-design-builder" onSubmit={submitBuild}>
          <div className="six-card-heading">
            <div>
              <p className="six-kicker">Researcher-owned inputs</p>
              <h3>Define the intended contrast</h3>
            </div>
            <span>Dataset optional</span>
          </div>
          <div className="six-grid">
            <label className="six-field">
              <span>Policy exposure you want to study *</span>
              <select
                value={draft.policyTarget}
                disabled={props.disabled}
                onChange={(event) => updateDraft(
                  "policyTarget",
                  event.target.value as CausalPolicyTarget,
                )}
              >
                <option value="full_policy_package">Full policy package</option>
                <option value="policy_component">A particular component</option>
                <option value="legal_eligibility">Legal eligibility</option>
                <option value="actual_compliance">Actual compliance</option>
                <option value="other_defined_exposure">Another defined exposure</option>
              </select>
            </label>
            {targetNeedsDetail ? (
              <label className="six-field">
                <span>Exact target definition *</span>
                <input
                  required
                  value={draft.targetDetail}
                  disabled={props.disabled}
                  onChange={(event) => updateDraft(
                    "targetDetail",
                    event.target.value,
                  )}
                />
              </label>
            ) : null}
            <label className="six-field">
              <span>Unit assigned to the policy *</span>
              <input
                required
                value={draft.assignmentUnit}
                disabled={props.disabled}
                onChange={(event) => updateDraft(
                  "assignmentUnit",
                  event.target.value,
                )}
              />
              <small>This can differ from the unit observed in your data.</small>
            </label>
            <label className="six-field">
              <span>Proposed treated group</span>
              <input
                value={draft.proposedTreatedGroup}
                disabled={props.disabled}
                onChange={(event) => updateDraft(
                  "proposedTreatedGroup",
                  event.target.value,
                )}
              />
              <small>“Not decided” may be left blank.</small>
            </label>
            <label className="six-field">
              <span>Proposed comparison group</span>
              <input
                value={draft.proposedComparisonGroup}
                disabled={props.disabled}
                onChange={(event) => updateDraft(
                  "proposedComparisonGroup",
                  event.target.value,
                )}
              />
              <small>“Not decided” may be left blank.</small>
            </label>
            <label className="six-field">
              <span>Relevant data availability</span>
              <select
                value={draft.dataAvailability}
                disabled={props.disabled}
                onChange={(event) => updateDraft(
                  "dataAvailability",
                  event.target.value as CausalComparisonDraft["dataAvailability"],
                )}
              >
                <option value="not_assessed">Not assessed</option>
                <option value="available">Available</option>
                <option value="partially_available">Partly available</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </label>
            <label className="six-field">
              <span>Data frequency</span>
              <input
                value={draft.dataFrequency}
                disabled={props.disabled}
                placeholder="For example, annual or monthly"
                onChange={(event) => updateDraft(
                  "dataFrequency",
                  event.target.value,
                )}
              />
            </label>
            <label className="six-field">
              <span>Historical eligibility fields</span>
              <input
                value={draft.historicalEligibilityFields}
                disabled={props.disabled}
                onChange={(event) => updateDraft(
                  "historicalEligibilityFields",
                  event.target.value,
                )}
              />
              <small>Separate field names with commas. Current values are not substituted.</small>
            </label>
            <label className="six-field">
              <span>Design constraints</span>
              <input
                value={draft.designConstraints}
                disabled={props.disabled}
                onChange={(event) => updateDraft(
                  "designConstraints",
                  event.target.value,
                )}
              />
              <small>Separate constraints with commas.</small>
            </label>
          </div>
          <EvidenceSelection
            legend="Facts that define the target exposure"
            hint="Select at least one reviewed Event Card claim. This does not change its review status."
            claims={usableClaims}
            selected={draft.targetClaimIds}
            disabled={props.disabled}
            onChange={(ids) => updateDraft("targetClaimIds", ids)}
          />
          <EvidenceSelection
            legend="Facts that may create the comparison"
            hint="Select reviewed coverage, exemption, timing, or assignment facts that could create variation."
            claims={usableClaims}
            selected={draft.variationClaimIds}
            disabled={props.disabled}
            onChange={(ids) => updateDraft("variationClaimIds", ids)}
          />
          <button
            type="submit"
            className="six-primary"
            disabled={props.disabled || !draft.assignmentUnit.trim() ||
              !draft.targetClaimIds.length || !draft.variationClaimIds.length ||
              (targetNeedsDetail && !draft.targetDetail.trim())}
          >
            Build source-linked comparison options
          </button>
        </form>
      ) : designSet ? (
        <button
          type="button"
          className="six-secondary six-revise-design"
          disabled={props.disabled}
          onClick={() => setShowBuilder(true)}
        >
          Revise comparison inputs
        </button>
      ) : null}

      {designSet ? (
        <section className="six-card six-identification-map">
          <div className="six-card-heading">
            <div>
              <p className="six-kicker">Identification Map</p>
              <h3>
                {designSet.options.length
                  ? `${designSet.options.length} conditional option${designSet.options.length === 1 ? "" : "s"}`
                  : "No option supported by the selected variation"}
              </h3>
            </div>
            <span>Revision {designSet.ordinal}</span>
          </div>
          {designSet.options.map((option) => (
            <article className="six-design-option" key={option.id}>
              <div className="six-card-heading">
                <div>
                  <p className="six-kicker">{readable(option.family)}</p>
                  <h4>{option.label}</h4>
                </div>
                <span data-status={option.status}>{readable(option.status)}</span>
              </div>
              <dl className="six-identification-fields">
                <div><dt>Treatment</dt><dd>{option.treatmentDefinition}</dd></div>
                <div><dt>Comparator</dt><dd>{option.comparisonDefinition ?? "Not decided"}</dd></div>
                <div><dt>Assignment unit</dt><dd>{option.assignmentUnit}</dd></div>
                <div><dt>Observation unit</dt><dd>{option.analysisUnit}</dd></div>
                <div><dt>Population</dt><dd>{designSet.population}</dd></div>
                <div><dt>Timing</dt><dd>{option.timingDefinition}</dd></div>
                <div><dt>Conditional estimand</dt><dd>{option.estimand}</dd></div>
              </dl>
              <section>
                <h5>Source-linked variation</h5>
                <p>{option.factualVariation}</p>
                <ul className="six-design-citations">
                  {option.supportingEvidence.map((evidence) => {
                    const citation = citations.get(evidence.claimId);
                    return (
                      <li key={`${option.id}:${evidence.claimId}`}>
                        <span>{evidence.statement}</span>
                        {citation ? (
                          <a
                            href={citation.citation.canonicalUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {citation.citation.sourceTitle} · {citation.citation.locator}
                          </a>
                        ) : (
                          <small>
                            Passage {evidence.passageIds.join(", ")} · source {evidence.sourceIds.join(", ")}
                          </small>
                        )}
                        {evidence.conflictIds.length ? (
                          <small>
                            Unresolved source conflict: {evidence.conflictIds.join(", ")}
                          </small>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
              <div className="six-design-columns">
                <section>
                  <h5>Assumptions</h5>
                  <ul>{option.identifyingAssumptions.map((value) =>
                    <li key={value}>{value}</li>)}</ul>
                </section>
                <section>
                  <h5>Important threats</h5>
                  <ul>{option.importantThreats.map((value) =>
                    <li key={value}>{value}</li>)}</ul>
                </section>
                <section>
                  <h5>Missing prerequisites</h5>
                  {option.missingPrerequisites.length ? (
                    <ul>{option.missingPrerequisites.map((value) =>
                      <li key={value}>{value}</li>)}</ul>
                  ) : <p>No missing prerequisite is recorded. Assumptions still require testing.</p>}
                </section>
                <section>
                  <h5>Minimum data</h5>
                  <ul>{option.dataRequirements.map((value) =>
                    <li key={value}>{value}</li>)}</ul>
                </section>
              </div>
              <details>
                <summary>Claims this option does not support</summary>
                <ul>{option.unsupportedClaims.map((value) =>
                  <li key={value}>{value}</li>)}</ul>
              </details>
              {!decision ? (
                <CausalDesignDecisionForm
                  option={option}
                  disabled={props.disabled}
                  onDecide={props.onDecide}
                />
              ) : null}
            </article>
          ))}
          {designSet.excludedMethods.length ? (
            <details className="six-method-exclusions" open={!designSet.options.length}>
              <summary>Why the initial method library returned fewer options</summary>
              <ul>
                {designSet.excludedMethods.map((excluded) => (
                  <li key={excluded.methodLibraryEntryId}>
                    <strong>{readable(excluded.methodLibraryEntryId)}</strong>
                    <span>{excluded.reason}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          {!decision ? (
            <form
              className="six-no-design"
              onSubmit={(event) => {
                event.preventDefault();
                void props.onDecide({
                  decision: { mode: "no_selection" },
                  rationale: noSelectionRationale.trim(),
                });
              }}
            >
              <h4>I do not yet have a defensible comparison</h4>
              <p>This is a valid Screen 3 result and will remain explicit downstream.</p>
              <label>
                <span>Why no comparison is selected</span>
                <textarea
                  required
                  maxLength={2_000}
                  value={noSelectionRationale}
                  disabled={props.disabled}
                  onChange={(event) => setNoSelectionRationale(event.target.value)}
                />
              </label>
              <button
                type="submit"
                className="six-secondary"
                disabled={props.disabled || !noSelectionRationale.trim()}
              >
                Save no-selection decision
              </button>
            </form>
          ) : null}
        </section>
      ) : null}

      {decision ? (
        <section className="six-card six-design-selected" role="status">
          <p className="six-kicker">Researcher decision saved</p>
          <h3>
            {decision.decision === "selected"
              ? `${decision.selectedDesign!.label} selected for review`
              : "No causal comparison selected"}
          </h3>
          <p>{decision.rationale}</p>
          <small>
            This decision is a plan, not proof. Revise the comparison inputs to
            create a new immutable Design Set.
          </small>
        </section>
      ) : null}

      {props.workspace.revisions.length ? (
        <details className="six-card six-design-history">
          <summary>Comparison revision history</summary>
          <ol>
            {[...props.workspace.revisions].reverse().map((revision) => (
              <li key={revision.designSetSnapshotId}>
                <div>
                  <strong>Revision {revision.ordinal}</strong>
                  <span>{readable(revision.artifactStatus)}</span>
                </div>
                <small>
                  {revision.optionCount} option{revision.optionCount === 1 ? "" : "s"}
                  {" · "}{readable(revision.decision)}
                  {revision.selectedOptionLabel
                    ? ` · ${revision.selectedOptionLabel}`
                    : ""}
                </small>
                <small>
                  Event Card {revision.eventCardSnapshotId} · {revision.createdAt}
                </small>
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      <details className="six-card six-method-library">
        <summary>Initial reviewed method library</summary>
        {props.workspace.methodLibrary.map((method) => (
          <section key={method.id}>
            <strong>{method.label}</strong>
            <p>{method.documentedFeature}</p>
            <small>{method.claimBoundary}</small>
          </section>
        ))}
      </details>
    </section>
  );
}

type CoEventScopeDraft = {
  lookbackAmount: string;
  lookbackUnit: CoEventWindowOffset["unit"];
  lookforwardAmount: string;
  lookforwardUnit: CoEventWindowOffset["unit"];
  knownCoEvents: string;
  suppliers: string;
  customers: string;
  regulators: string;
  markets: string;
  otherEntities: string;
  includeMeasurementChanges: boolean;
};

const initialCoEventScopeDraft: CoEventScopeDraft = {
  lookbackAmount: "1",
  lookbackUnit: "years",
  lookforwardAmount: "1",
  lookforwardUnit: "years",
  knownCoEvents: "",
  suppliers: "",
  customers: "",
  regulators: "",
  markets: "",
  otherEntities: "",
  includeMeasurementChanges: true,
};

function coEventEntities(draft: CoEventScopeDraft) {
  const fields: Array<[
    CoEventImportantEntity["kind"],
    keyof Pick<
      CoEventScopeDraft,
      "suppliers" | "customers" | "regulators" | "markets" | "otherEntities"
    >,
  ]> = [
    ["supplier", "suppliers"],
    ["customer", "customers"],
    ["regulator", "regulators"],
    ["market", "markets"],
    ["other", "otherEntities"],
  ];
  return fields.flatMap(([kind, field]) =>
    list(draft[field]).map((label) => ({ kind, label }))
  );
}

type CoEventOccurrenceReviewRequest = {
  candidateId: string;
  expectedCandidateFingerprint: string;
  decision: CoEventOccurrenceReviewDecision;
  rationale: string;
};

type CoEventDuplicateReviewRequest = {
  leftCandidateId: string;
  leftCandidateFingerprint: string;
  rightCandidateId: string;
  rightCandidateFingerprint: string;
  decision: CoEventDuplicateReviewDecision;
  rationale: string;
};

type CoEventRelationReviewRequest = {
  candidateId: string;
  expectedCandidateFingerprint: string;
  expectedOccurrenceReviewId: string;
  expectedOccurrenceReviewFingerprint: string;
  decision: CoEventRelationReviewDecision;
  rationale: string;
};

type CoEventPolicyLifecycleHandoffRequest = {
  candidateId: string;
  expectedCandidateFingerprint: string;
  expectedOccurrenceReviewId: string;
  expectedOccurrenceReviewFingerprint: string;
  stageKind: CoEventPolicyLifecycleStageKind;
  rationale: string;
};

type PolicyLifecycleStageAcquisitionRequest = {
  handoffId: string;
  expectedHandoffFingerprint: string;
};

type PolicyLifecycleStageDispositionRequest = {
  handoffId: string;
  expectedHandoffFingerprint: string;
  acquisitionId: string;
  expectedAcquisitionFingerprint: string;
  decision: PolicyLifecycleStageDispositionDecision;
  rationale: string;
};

type PolicyLifecycleStageRevisionProposalRequest = {
  handoffId: string;
  expectedHandoffFingerprint: string;
  dispositionId: string;
  expectedDispositionFingerprint: string;
  chronologyStage: PolicyChronologyStage;
  sourceDateId: string | null;
  rationale: string;
};

type PolicyLifecycleStageRevisionReviewRequest = {
  proposalId: string;
  expectedProposalFingerprint: string;
  decision: PolicyLifecycleStageRevisionDecision;
  rationale: string;
};

function CoEventOccurrenceReviewControls(props: {
  candidate: CoEventSearchWorkspace["candidates"][number];
  latestReview: CoEventSearchWorkspace["occurrenceReviews"][number] | null;
  disabled: boolean;
  onReview: (input: CoEventOccurrenceReviewRequest) => Promise<void>;
}) {
  const [mode, setMode] = useState<
    CoEventOccurrenceReviewDecision["mode"]
  >("deferred");
  const [rationale, setRationale] = useState("");
  const [correctedTitle, setCorrectedTitle] = useState("");
  const [correctedDateKind, setCorrectedDateKind] = useState<
    "event" | "publication" | "effective" | "incident_start"
  >("event");
  const [correctedDate, setCorrectedDate] = useState("");
  const [correctedPopulation, setCorrectedPopulation] = useState("");
  const [correctedGeography, setCorrectedGeography] = useState("");
  const hasCorrection = Boolean(
    correctedTitle.trim() || correctedDate.trim() ||
    list(correctedPopulation).length || list(correctedGeography).length,
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const decision: CoEventOccurrenceReviewDecision = mode === "corrected"
      ? {
          mode,
          correction: {
            title: correctedTitle.trim() || null,
            typedDates: correctedDate.trim()
              ? [{ kind: correctedDateKind, value: correctedDate.trim() }]
              : [],
            affectedActivityOrPopulationLabels: list(correctedPopulation),
            geographyLabels: list(correctedGeography),
          },
        }
      : { mode };
    void props.onReview({
      candidateId: props.candidate.id,
      expectedCandidateFingerprint: props.candidate.candidateFingerprint,
      decision,
      rationale: rationale.trim(),
    });
  }

  return (
    <details className="six-coevent-review-controls">
      <summary>Review this occurrence record</summary>
      {props.latestReview ? (
        <div className="six-coevent-review-summary">
          <strong>
            Current researcher decision: {readable(props.latestReview.decision)}
          </strong>
          <small>
            Revision {props.latestReview.ordinal} · {props.latestReview.reviewedAt}
          </small>
          <p>{props.latestReview.rationale}</p>
          {props.latestReview.correction ? (
            <div className="six-alert six-alert--warning">
              <strong>Researcher-supplied correction</strong>
              <p>
                {[
                  props.latestReview.correction.title
                    ? `title: ${props.latestReview.correction.title}`
                    : null,
                  ...props.latestReview.correction.typedDates.map(({ kind, value }) =>
                    `${readable(kind)}: ${value}`),
                  props.latestReview.correction
                      .affectedActivityOrPopulationLabels.length
                    ? `affected activity/population: ${props.latestReview.correction.affectedActivityOrPopulationLabels.join(", ")}`
                    : null,
                  props.latestReview.correction.geographyLabels.length
                    ? `geography: ${props.latestReview.correction.geographyLabels.join(", ")}`
                    : null,
                ].filter(Boolean).join(" · ")}
              </p>
              <small>{props.latestReview.correction.limitation}</small>
            </div>
          ) : null}
        </div>
      ) : (
        <p>No researcher occurrence decision has been recorded.</p>
      )}
      <form className="six-coevent-review-form" onSubmit={submit}>
        <label className="six-field">
          <span>Occurrence decision *</span>
          <select
            value={mode}
            disabled={props.disabled}
            onChange={(event) => setMode(
              event.target.value as CoEventOccurrenceReviewDecision["mode"],
            )}
          >
            <option value="retained">Retain for later relation review</option>
            <option value="deferred">Defer occurrence review</option>
            <option value="rejected">Reject this occurrence record</option>
            <option value="corrected">Record my correction</option>
          </select>
        </label>
        {mode === "corrected" ? (
          <div className="six-coevent-correction-fields">
            <div className="six-alert six-alert--warning">
              Corrections are saved beside—not over—the source record. They do
              not become verified evidence without a separate supporting source.
            </div>
            <label className="six-field">
              <span>Corrected title</span>
              <input
                value={correctedTitle}
                maxLength={1_000}
                disabled={props.disabled}
                onChange={(event) => setCorrectedTitle(event.target.value)}
              />
            </label>
            <div className="six-grid">
              <label className="six-field">
                <span>Corrected date kind</span>
                <select
                  value={correctedDateKind}
                  disabled={props.disabled}
                  onChange={(event) => setCorrectedDateKind(
                    event.target.value as typeof correctedDateKind,
                  )}
                >
                  <option value="event">event</option>
                  <option value="publication">publication</option>
                  <option value="effective">effective</option>
                  <option value="incident_start">incident start</option>
                </select>
              </label>
              <label className="six-field">
                <span>Corrected date</span>
                <input
                  value={correctedDate}
                  placeholder="YYYY, YYYY-MM, or YYYY-MM-DD"
                  pattern="\d{4}(-\d{2}(-\d{2})?)?"
                  disabled={props.disabled}
                  onChange={(event) => setCorrectedDate(event.target.value)}
                />
              </label>
            </div>
            <label className="six-field">
              <span>Corrected affected activity or population</span>
              <input
                value={correctedPopulation}
                disabled={props.disabled}
                onChange={(event) => setCorrectedPopulation(event.target.value)}
              />
              <small>Separate exact labels with commas.</small>
            </label>
            <label className="six-field">
              <span>Corrected geography</span>
              <input
                value={correctedGeography}
                disabled={props.disabled}
                onChange={(event) => setCorrectedGeography(event.target.value)}
              />
              <small>Separate exact labels with commas.</small>
            </label>
          </div>
        ) : null}
        <label className="six-field">
          <span>Researcher rationale *</span>
          <textarea
            required
            value={rationale}
            maxLength={2_000}
            disabled={props.disabled}
            onChange={(event) => setRationale(event.target.value)}
          />
        </label>
        <button
          type="submit"
          className="six-secondary"
          disabled={props.disabled || !rationale.trim() ||
            (mode === "corrected" && !hasCorrection)}
        >
          Save occurrence review
        </button>
        <small>
          This action reviews occurrence metadata only. It does not classify a
          confounder, mediator, spillover, or control.
        </small>
      </form>
    </details>
  );
}

function CoEventRelationReviewControls(props: {
  candidate: CoEventSearchWorkspace["candidates"][number];
  occurrenceReview: CoEventSearchWorkspace["occurrenceReviews"][number];
  latestReview: CoEventSearchWorkspace["relationReviews"][number] | null;
  mode: "targeted" | "contextual";
  disabled: boolean;
  onReview: (input: CoEventRelationReviewRequest) => Promise<void>;
}) {
  const [decisionMode, setDecisionMode] = useState<
    CoEventRelationReviewDecision["mode"]
  >("deferred");
  const [category, setCategory] = useState<
    CoEventRelationReviewDecision["category"]
  >("unresolved_relationship");
  const [priority, setPriority] = useState<
    CoEventRelationReviewDecision["priority"]
  >("unresolved");
  const [affectedRole, setAffectedRole] = useState<
    CoEventRelationReviewDecision["affectedGroupRoles"][number]
  >("unknown");
  const [pathway, setPathway] = useState("");
  const [differentialRelevance, setDifferentialRelevance] = useState("");
  const [assumptions, setAssumptions] = useState("");
  const [questions, setQuestions] = useState("");
  const [responses, setResponses] = useState("");
  const [rationale, setRationale] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void props.onReview({
      candidateId: props.candidate.id,
      expectedCandidateFingerprint: props.candidate.candidateFingerprint,
      expectedOccurrenceReviewId: props.occurrenceReview.id,
      expectedOccurrenceReviewFingerprint:
        props.occurrenceReview.reviewFingerprint,
      decision: {
        mode: decisionMode,
        category,
        priority,
        affectedGroupRoles: [affectedRole],
        plausibleOutcomePathway: pathway.trim(),
        differentialRelevance: differentialRelevance.trim(),
        assumptions: list(assumptions),
        unresolvedQuestions: list(questions),
        proposedResponses: list(responses),
      },
      rationale: rationale.trim(),
    });
  }

  return (
    <details className="six-coevent-relation-controls">
      <summary>Classify relation to the comparison</summary>
      {props.latestReview ? (
        <div className="six-coevent-relation-summary">
          <div className="six-card-heading">
            <strong>{readable(props.latestReview.relation.category)}</strong>
            <span>
              {readable(props.latestReview.decision)} · {readable(
                props.latestReview.relation.priority,
              )} priority
            </span>
          </div>
          <p>{props.latestReview.rationale}</p>
          <dl>
            <div>
              <dt>Plausible outcome pathway</dt>
              <dd>{props.latestReview.relation.plausibleOutcomePathway}</dd>
            </div>
            <div>
              <dt>Comparison relevance</dt>
              <dd>{props.latestReview.relation.differentialRelevance}</dd>
            </div>
            <div>
              <dt>Proposed response</dt>
              <dd>{props.latestReview.relation.proposedResponses.length
                ? props.latestReview.relation.proposedResponses.join(" · ")
                : "none recorded"}</dd>
            </div>
          </dl>
          <small>
            Researcher-authored revision {props.latestReview.ordinal} · semantic
            assistance not used
          </small>
        </div>
      ) : (
        <p>
          No comparison-specific judgment has been recorded. Occurrence timing
          alone cannot classify an independent cause, mediator, package
          component, spillover, or measurement change.
        </p>
      )}
      <form className="six-coevent-relation-form" onSubmit={submit}>
        <div className="six-grid">
          <label className="six-field">
            <span>Relation decision *</span>
            <select
              value={decisionMode}
              disabled={props.disabled}
              onChange={(event) => setDecisionMode(
                event.target.value as typeof decisionMode,
              )}
            >
              <option value="retained">Retain as a current concern</option>
              <option value="rejected">Reject this proposed relation</option>
              <option value="deferred">Defer relation judgment</option>
            </select>
          </label>
          <label className="six-field">
            <span>Relation category *</span>
            <select
              value={category}
              disabled={props.disabled}
              onChange={(event) => setCategory(
                event.target.value as typeof category,
              )}
            >
              <option value="independent_concurrent_event">Independent concurrent event</option>
              <option value="same_policy_package">Same policy package</option>
              <option value="downstream_response">Downstream response</option>
              <option value="spillover_or_comparison_contamination">Spillover or comparison contamination</option>
              <option value="measurement_or_sample_change">Measurement or sample change</option>
              <option value="temporal_coincidence_no_established_relevance">Temporal coincidence; no established relevance</option>
              <option value="unresolved_relationship">Unresolved relationship</option>
            </select>
          </label>
          <label className="six-field">
            <span>Priority *</span>
            <select
              value={priority}
              disabled={props.disabled}
              onChange={(event) => setPriority(
                event.target.value as typeof priority,
              )}
            >
              <option value="unresolved">Unresolved</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label className="six-field">
            <span>{props.mode === "targeted"
              ? "Potentially affected comparison side *"
              : "Potentially affected population *"}</span>
            <select
              value={affectedRole}
              disabled={props.disabled}
              onChange={(event) => setAffectedRole(
                event.target.value as typeof affectedRole,
              )}
            >
              <option value="unknown">Unknown</option>
              <option value="treatment">Treatment side</option>
              <option value="comparison">Comparison side</option>
              <option value="both">Both sides</option>
            </select>
          </label>
        </div>
        <label className="six-field">
          <span>Plausible pathway to the study outcome *</span>
          <textarea
            required
            value={pathway}
            maxLength={4_000}
            disabled={props.disabled}
            onChange={(event) => setPathway(event.target.value)}
          />
        </label>
        <label className="six-field">
          <span>{props.mode === "targeted"
            ? "Why relevance could differ across the comparison *"
            : "Why this could matter for the study population *"}</span>
          <textarea
            required
            value={differentialRelevance}
            maxLength={4_000}
            disabled={props.disabled}
            onChange={(event) => setDifferentialRelevance(event.target.value)}
          />
        </label>
        <div className="six-grid">
          <label className="six-field">
            <span>Assumptions</span>
            <input
              value={assumptions}
              disabled={props.disabled}
              onChange={(event) => setAssumptions(event.target.value)}
            />
            <small>Separate concise assumptions with commas.</small>
          </label>
          <label className="six-field">
            <span>Unresolved questions</span>
            <input
              value={questions}
              disabled={props.disabled}
              onChange={(event) => setQuestions(event.target.value)}
            />
          </label>
          <label className="six-field">
            <span>Proposed responses{decisionMode === "retained" ? " *" : ""}</span>
            <input
              required={decisionMode === "retained"}
              value={responses}
              disabled={props.disabled}
              onChange={(event) => setResponses(event.target.value)}
            />
            <small>
              Examples: obtain exposure evidence, revise the comparator, retain
              a limitation. This does not add a regression control.
            </small>
          </label>
        </div>
        <label className="six-field">
          <span>Researcher rationale *</span>
          <textarea
            required
            value={rationale}
            maxLength={2_000}
            disabled={props.disabled}
            onChange={(event) => setRationale(event.target.value)}
          />
        </label>
        <button
          type="submit"
          className="six-secondary"
          disabled={props.disabled || !pathway.trim() ||
            !differentialRelevance.trim() || !rationale.trim() ||
            (decisionMode === "retained" && !list(responses).length)}
        >
          Save relation judgment
        </button>
        <p className="six-claim-boundary">
          This researcher-authored judgment is separate from the immutable
          occurrence evidence. It is not proof of confounding, mediation,
          spillover, exposure, sample overlap, or a valid control choice.
        </p>
      </form>
    </details>
  );
}

function CoEventPolicyLifecycleHandoffControls(props: {
  candidate: CoEventSearchWorkspace["candidates"][number];
  occurrenceReview: CoEventSearchWorkspace["occurrenceReviews"][number];
  disabled: boolean;
  onRoute: (input: CoEventPolicyLifecycleHandoffRequest) => Promise<void>;
}) {
  const [stageKind, setStageKind] =
    useState<CoEventPolicyLifecycleStageKind>("implementation_delay");
  const [rationale, setRationale] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void props.onRoute({
      candidateId: props.candidate.id,
      expectedCandidateFingerprint: props.candidate.candidateFingerprint,
      expectedOccurrenceReviewId: props.occurrenceReview.id,
      expectedOccurrenceReviewFingerprint:
        props.occurrenceReview.reviewFingerprint,
      stageKind,
      rationale: rationale.trim(),
    });
  }

  return (
    <details className="six-coevent-lifecycle-controls">
      <summary>Could this belong to the focal policy lifecycle?</summary>
      <div className="six-alert six-alert--warning">
        Routing records a possible stage for Screen 2 review. It does not verify
        the relationship, create an independent event, or assess causal relevance.
      </div>
      <form className="six-coevent-review-form" onSubmit={submit}>
        <label className="six-field">
          <span>Possible focal-policy stage *</span>
          <select
            value={stageKind}
            disabled={props.disabled}
            onChange={(event) => setStageKind(
              event.target.value as CoEventPolicyLifecycleStageKind,
            )}
          >
            <option value="implementation_delay">Implementation delay</option>
            <option value="litigation_or_court_order">
              Litigation or court order
            </option>
            <option value="amendment">Amendment</option>
            <option value="suspension">Suspension</option>
            <option value="repeal">Repeal</option>
            <option value="enforcement">Enforcement</option>
            <option value="other">Other possible stage</option>
          </select>
        </label>
        <label className="six-field">
          <span>Why this may be part of the focal policy *</span>
          <textarea
            required
            value={rationale}
            maxLength={2_000}
            disabled={props.disabled}
            onChange={(event) => setRationale(event.target.value)}
          />
        </label>
        <button
          type="submit"
          className="six-primary"
          disabled={props.disabled || !rationale.trim()}
        >
          Send possible policy stage to Screen 2
        </button>
        <small>
          This opens a new Event Card review revision and marks Screens 3–6 out
          of date. The prior Event Card and source occurrence stay immutable.
        </small>
      </form>
    </details>
  );
}

function PolicyLifecycleStageDispositionControls(props: {
  entry: PolicyLifecycleStageReviewWorkspace["entries"][number];
  disabled: boolean;
  onDisposition: (
    input: PolicyLifecycleStageDispositionRequest,
  ) => Promise<void>;
}) {
  const [decision, setDecision] =
    useState<PolicyLifecycleStageDispositionDecision>("deferred");
  const [rationale, setRationale] = useState("");
  const acquisition = props.entry.latestAcquisition;
  if (!acquisition?.source) return null;
  const canAccept = acquisition.source.focalPolicyReferenceStatus !==
    "not_found_in_retained_passages";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!acquisition) return;
    void props.onDisposition({
      handoffId: props.entry.handoffId,
      expectedHandoffFingerprint: props.entry.handoffFingerprint,
      acquisitionId: acquisition.id,
      expectedAcquisitionFingerprint: acquisition.acquisitionFingerprint,
      decision,
      rationale: rationale.trim(),
    });
  }

  return (
    <form
      className="six-policy-lifecycle-disposition"
      aria-label="Possible stage document disposition"
      onSubmit={submit}
    >
      <label className="six-field">
        <span>Researcher disposition *</span>
        <select
          value={decision}
          disabled={props.disabled || !props.entry.canDispose}
          onChange={(event) => setDecision(
            event.target.value as PolicyLifecycleStageDispositionDecision,
          )}
        >
          <option value="deferred">Defer pending more review</option>
          <option
            value="accepted_for_event_card_review"
            disabled={!canAccept}
          >
            Accept for later Event Card review
          </option>
          <option value="rejected_as_focal_policy_stage">
            Reject as a focal-policy stage
          </option>
        </select>
      </label>
      <label className="six-field">
        <span>Reason for this disposition *</span>
        <textarea
          required
          maxLength={2_000}
          value={rationale}
          disabled={props.disabled || !props.entry.canDispose}
          onChange={(event) => setRationale(event.target.value)}
        />
      </label>
      {!canAccept ? (
        <small>
          Acceptance is unavailable because the retained passages contain no
          exact focal-policy identifier or title anchor. Defer or reject while
          keeping the official document.
        </small>
      ) : null}
      <button
        type="submit"
        className="six-primary"
        disabled={props.disabled || !props.entry.canDispose ||
          !rationale.trim() || (!canAccept &&
            decision === "accepted_for_event_card_review")}
      >
        Save stage-document disposition
      </button>
      <small>
        This saves a researcher decision only. It does not change chronology,
        rewrite or lock the Event Card, or classify causal relevance.
      </small>
    </form>
  );
}

function PolicyLifecycleStageRevisionProposalControls(props: {
  entry: PolicyLifecycleStageReviewWorkspace["entries"][number];
  disabled: boolean;
  onPropose: (
    input: PolicyLifecycleStageRevisionProposalRequest,
  ) => Promise<void>;
}) {
  const [chronologyStage, setChronologyStage] = useState<
    PolicyChronologyStage | ""
  >("");
  const [sourceDateId, setSourceDateId] = useState("");
  const [rationale, setRationale] = useState("");
  const disposition = props.entry.latestDisposition;
  if (
    !disposition ||
    disposition.decision !== "accepted_for_event_card_review"
  ) return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!disposition || !chronologyStage || !sourceDateId) return;
    void props.onPropose({
      handoffId: props.entry.handoffId,
      expectedHandoffFingerprint: props.entry.handoffFingerprint,
      dispositionId: disposition.id,
      expectedDispositionFingerprint: disposition.dispositionFingerprint,
      chronologyStage,
      sourceDateId: sourceDateId === "undated" ? null : sourceDateId,
      rationale: rationale.trim(),
    });
  }

  return (
    <form
      className="six-policy-lifecycle-disposition"
      aria-label="Lifecycle-stage chronology proposal"
      onSubmit={submit}
    >
      <div className="six-card-heading">
        <div>
          <p className="six-kicker">Source-bound proposal</p>
          <h5>Propose one chronology stage for later review</h5>
        </div>
        <span>Does not apply the change</span>
      </div>
      <label className="six-field">
        <span>Chronology stage *</span>
        <select
          required
          value={chronologyStage}
          disabled={props.disabled || !props.entry.canProposeRevision}
          onChange={(event) => setChronologyStage(
            event.target.value as PolicyChronologyStage | "",
          )}
        >
          <option value="">Select a stage</option>
          {props.entry.chronologyStageOptions.map((stage) => (
            <option key={stage} value={stage}>{readable(stage)}</option>
          ))}
        </select>
      </label>
      <label className="six-field">
        <span>Exact source date to preserve *</span>
        <select
          required
          value={sourceDateId}
          disabled={props.disabled || !props.entry.canProposeRevision}
          onChange={(event) => setSourceDateId(event.target.value)}
        >
          <option value="">Select source metadata or undated</option>
          {props.entry.sourceDateOptions.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
          <option value="undated">No normalized source date</option>
        </select>
      </label>
      <label className="six-field">
        <span>Why this document supports the proposed stage *</span>
        <textarea
          required
          maxLength={2_000}
          value={rationale}
          disabled={props.disabled || !props.entry.canProposeRevision}
          onChange={(event) => setRationale(event.target.value)}
        />
      </label>
      <button
        type="submit"
        className="six-primary"
        disabled={props.disabled || !props.entry.canProposeRevision ||
          !chronologyStage || !sourceDateId || !rationale.trim()}
      >
        Save immutable stage proposal
      </button>
      <small>
        The source date keeps its original metadata type. This action creates a
        proposal only; it does not change the timeline or Event Card.
      </small>
    </form>
  );
}

function PolicyLifecycleStageRevisionReviewControls(props: {
  entry: PolicyLifecycleStageReviewWorkspace["entries"][number];
  disabled: boolean;
  onReview: (
    input: PolicyLifecycleStageRevisionReviewRequest,
  ) => Promise<void>;
}) {
  const [decision, setDecision] = useState<
    PolicyLifecycleStageRevisionDecision | ""
  >("");
  const [rationale, setRationale] = useState("");
  const proposal = props.entry.latestProposal;
  if (!proposal) return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!proposal || !decision) return;
    void props.onReview({
      proposalId: proposal.id,
      expectedProposalFingerprint: proposal.proposalFingerprint,
      decision,
      rationale: rationale.trim(),
    });
  }

  return (
    <form
      className="six-policy-lifecycle-disposition"
      aria-label="Lifecycle-stage proposal review"
      onSubmit={submit}
    >
      <label className="six-field">
        <span>Separate proposal decision *</span>
        <select
          required
          value={decision}
          disabled={props.disabled || !props.entry.canReviewRevision}
          onChange={(event) => setDecision(
            event.target.value as PolicyLifecycleStageRevisionDecision | "",
          )}
        >
          <option value="">Select a decision</option>
          <option value="accepted_for_event_card_revision">
            Accept for the next explicit Event Card lock
          </option>
          <option value="rejected">Reject this stage proposal</option>
          <option value="deferred">Defer this stage proposal</option>
        </select>
      </label>
      <label className="six-field">
        <span>Reason for this proposal decision *</span>
        <textarea
          required
          maxLength={2_000}
          value={rationale}
          disabled={props.disabled || !props.entry.canReviewRevision}
          onChange={(event) => setRationale(event.target.value)}
        />
      </label>
      <button
        type="submit"
        className="six-secondary"
        disabled={props.disabled || !props.entry.canReviewRevision ||
          !decision || !rationale.trim()}
      >
        Save proposal decision
      </button>
      <small>
        Accept, reject, and defer are all non-mutating review records. Only a
        later explicit Event Card lock can include an accepted proposal.
      </small>
    </form>
  );
}

export function PolicyLifecycleHandoffPanel(props: {
  workspace: CoEventSearchWorkspace;
  stageWorkspace?: PolicyLifecycleStageReviewWorkspace | null;
  disabled?: boolean;
  onAcquire?: (input: PolicyLifecycleStageAcquisitionRequest) => Promise<void>;
  onDisposition?: (
    input: PolicyLifecycleStageDispositionRequest,
  ) => Promise<void>;
  onProposeRevision?: (
    input: PolicyLifecycleStageRevisionProposalRequest,
  ) => Promise<void>;
  onReviewRevision?: (
    input: PolicyLifecycleStageRevisionReviewRequest,
  ) => Promise<void>;
}) {
  if (!props.workspace.policyLifecycleHandoffs.length) return null;
  return (
    <section
      className="six-card six-policy-lifecycle-handoffs"
      aria-label="Possible focal-policy lifecycle handoffs"
    >
      <div className="six-card-heading">
        <div>
          <p className="six-kicker">Screen 4 → Screen 2 review handoff</p>
          <h3>Review possible stages of the focal policy</h3>
        </div>
        <span>Researcher proposed · not verified</span>
      </div>
      <div className="six-alert six-alert--warning">
        The prior Event Card and source occurrence remain unchanged. Each item
        below is a source-preserving prompt for review—not an independent-event,
        relation, causal, or control classification.
      </div>
      <ol className="six-policy-lifecycle-list">
        {[...props.workspace.policyLifecycleHandoffs].reverse().map((entry) => {
          const eventCard =
            entry.handoff.focalPolicyReference.eventCardReference;
          const stageReview = props.stageWorkspace?.entries.find(
            ({ handoffId }) => handoffId === entry.handoff.id,
          ) ?? null;
          const acquisition = stageReview?.latestAcquisition ?? null;
          return (
            <li key={entry.handoff.id}>
              <div className="six-card-heading">
                <div>
                  <p className="six-kicker">
                    Possible {readable(entry.handoff.proposedStage.kind)} stage
                  </p>
                  <h4>{entry.candidate.title}</h4>
                </div>
                <span>{readable(entry.targetReviewStatus)}</span>
              </div>
              <p>{entry.candidate.description}</p>
              <p>
                <strong>Researcher routing rationale:</strong>{" "}
                {entry.handoff.rationale}
              </p>
              <dl className="six-policy-lifecycle-lineage">
                <div>
                  <dt>Prior Event Card</dt>
                  <dd>
                    Revision {eventCard.reviewOrdinal} · immutable snapshot
                    {" "}{eventCard.eventCardSnapshotId}
                  </dd>
                </div>
                <div>
                  <dt>Opened review</dt>
                  <dd>
                    Revision {entry.handoff.destination.policyEventCardReviewOrdinal}
                    {" · "}{entry.handoff.routedAt}
                  </dd>
                </div>
                <div>
                  <dt>Occurrence decision</dt>
                  <dd>{readable(entry.occurrenceReview.decision)}</dd>
                </div>
              </dl>
              <div className="six-policy-lifecycle-source">
                <strong>Immutable Screen 4 source occurrence</strong>
                {entry.candidate.typedDates.length ? (
                  <small>
                    {entry.candidate.typedDates.map(({ kind, value }) =>
                      `${readable(kind)}: ${value}`).join(" · ")}
                  </small>
                ) : null}
                <ul>
                  {entry.candidate.evidence.map((source) => (
                    <li key={source.sourceId}>
                      <a href={source.locator} target="_blank" rel="noreferrer">
                        {source.publisher}: {source.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              {entry.occurrenceReview.correction ? (
                <div className="six-alert six-alert--warning">
                  <strong>Researcher-supplied occurrence correction</strong>
                  <p>
                    {[
                      entry.occurrenceReview.correction.title
                        ? `title: ${entry.occurrenceReview.correction.title}`
                        : null,
                      ...entry.occurrenceReview.correction.typedDates.map(
                        ({ kind, value }) => `${readable(kind)}: ${value}`,
                      ),
                      entry.occurrenceReview.correction
                          .affectedActivityOrPopulationLabels.length
                        ? `affected activity/population: ${entry.occurrenceReview.correction.affectedActivityOrPopulationLabels.join(", ")}`
                        : null,
                      entry.occurrenceReview.correction.geographyLabels.length
                        ? `geography: ${entry.occurrenceReview.correction.geographyLabels.join(", ")}`
                        : null,
                    ].filter(Boolean).join(" · ")}
                  </p>
                  <small>{entry.occurrenceReview.correction.limitation}</small>
                </div>
              ) : null}
              <section
                className="six-policy-lifecycle-document"
                aria-label={`Official document review for ${entry.candidate.title}`}
              >
                <div className="six-card-heading">
                  <div>
                    <p className="six-kicker">Bounded Screen 2 evidence step</p>
                    <h5>Acquire and dispose the official stage document</h5>
                  </div>
                  <span>
                    {acquisition
                      ? readable(acquisition.outcome)
                      : "not acquired"}
                  </span>
                </div>
                {!stageReview ||
                    stageReview.adapterAvailability === "unsupported_source" ? (
                  <div className="six-alert">
                    This first deterministic adapter supports exact Federal
                    Register records only. The handoff remains preserved for a
                    later source-family adapter.
                  </div>
                ) : null}
                {stageReview?.canAcquire && props.onAcquire ? (
                  <button
                    type="button"
                    className="six-primary"
                    disabled={Boolean(props.disabled)}
                    onClick={() => void props.onAcquire?.({
                      handoffId: stageReview.handoffId,
                      expectedHandoffFingerprint:
                        stageReview.handoffFingerprint,
                    })}
                  >
                    {stageReview.canRetry
                      ? "Retry official stage document"
                      : "Acquire official stage document"}
                  </button>
                ) : null}
                {stageReview && stageReview.acquisitions.length > 1 ? (
                  <small>
                    {stageReview.acquisitions.length} bounded document attempts
                    retained; transient failures remain distinct from success.
                  </small>
                ) : null}
                {acquisition?.limitation ? (
                  <div className={acquisition.source
                    ? "six-alert"
                    : "six-alert six-alert--warning"}>
                    {acquisition.limitation}
                  </div>
                ) : null}
                {acquisition?.source ? (
                  <div className="six-policy-lifecycle-official-source">
                    <p>
                      <strong>Immutable official document:</strong>{" "}
                      <a
                        href={acquisition.source.canonicalUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {acquisition.source.title}
                      </a>
                    </p>
                    <small>
                      Federal Register {acquisition.source.nativeDocumentNumber}
                      {" · "}{readable(
                        acquisition.source.focalPolicyReferenceStatus,
                      )}
                      {" · partial inspected text · content hash retained"}
                    </small>
                    <ol className="six-policy-lifecycle-passages">
                      {acquisition.source.retainedPassages.map((passage) => (
                        <li key={passage.id}>
                          <blockquote>{passage.exactText}</blockquote>
                          <small>
                            {passage.locator} · {passage.qualification}
                          </small>
                        </li>
                      ))}
                    </ol>
                    {stageReview?.latestDisposition ? (
                      <div className="six-alert six-alert--success">
                        <strong>Latest researcher disposition:</strong>{" "}
                        {readable(stageReview.latestDisposition.decision)}
                        <p>{stageReview.latestDisposition.rationale}</p>
                        <small>
                          Researcher decision—not legal verification. Source,
                          chronology, and Event Card remain unchanged.
                        </small>
                      </div>
                    ) : null}
                    {stageReview && props.onDisposition ? (
                      <PolicyLifecycleStageDispositionControls
                        entry={stageReview}
                        disabled={Boolean(props.disabled)}
                        onDisposition={props.onDisposition}
                      />
                    ) : null}
                    {stageReview?.canProposeRevision &&
                        props.onProposeRevision ? (
                      <PolicyLifecycleStageRevisionProposalControls
                        entry={stageReview}
                        disabled={Boolean(props.disabled)}
                        onPropose={props.onProposeRevision}
                      />
                    ) : null}
                    {stageReview?.latestProposal ? (
                      <div className="six-alert six-alert--warning">
                        <strong>Immutable lifecycle-stage proposal:</strong>{" "}
                        {readable(
                          stageReview.latestProposal.stage.chronologyStage,
                        )}
                        <p>{stageReview.latestProposal.stage.statement}</p>
                        <small>
                          {timingLabel(stageReview.latestProposal.stage.timing)}
                          {" · source date type: "}
                          {stageReview.latestProposal.stage.sourceTypedDate
                            ? readable(
                                stageReview.latestProposal.stage.sourceTypedDate
                                  .kind,
                              )
                            : "undated"}
                          {" · chronology and Event Card unchanged"}
                        </small>
                        <p>
                          <strong>Proposal rationale:</strong>{" "}
                          {stageReview.latestProposal.rationale}
                        </p>
                      </div>
                    ) : null}
                    {stageReview?.latestProposalReview ? (
                      <div className={
                        stageReview.latestProposalReview.decision ===
                            "accepted_for_event_card_revision"
                          ? "six-alert six-alert--success"
                          : "six-alert"
                      }>
                        <strong>Latest proposal decision:</strong>{" "}
                        {readable(stageReview.latestProposalReview.decision)}
                        <p>{stageReview.latestProposalReview.rationale}</p>
                        <small>
                          This decision did not mutate chronology or the Event
                          Card. Accepted content enters only through an explicit
                          lock.
                        </small>
                      </div>
                    ) : null}
                    {stageReview?.canReviewRevision &&
                        props.onReviewRevision ? (
                      <PolicyLifecycleStageRevisionReviewControls
                        entry={stageReview}
                        disabled={Boolean(props.disabled)}
                        onReview={props.onReviewRevision}
                      />
                    ) : null}
                  </div>
                ) : null}
              </section>
              <p className="six-claim-boundary">
                {entry.handoff.claimBoundary}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function CoEventDuplicateReviewPanel(props: {
  candidates: CoEventSearchWorkspace["candidates"];
  reviews: CoEventSearchWorkspace["duplicateReviews"];
  disabled: boolean;
  onReview: (input: CoEventDuplicateReviewRequest) => Promise<void>;
}) {
  const [leftId, setLeftId] = useState(props.candidates[0]?.id ?? "");
  const [rightId, setRightId] = useState(props.candidates[1]?.id ?? "");
  const [mode, setMode] = useState<CoEventDuplicateReviewDecision["mode"]>(
    "deferred",
  );
  const [canonicalId, setCanonicalId] = useState(
    props.candidates[0]?.id ?? "",
  );
  const [rationale, setRationale] = useState("");
  const left = props.candidates.find(({ id }) => id === leftId) ?? null;
  const right = props.candidates.find(({ id }) => id === rightId) ?? null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!left || !right || left.id === right.id) return;
    const decision: CoEventDuplicateReviewDecision =
      mode === "same_event_representation"
        ? { mode, canonicalCandidateId: canonicalId }
        : { mode };
    void props.onReview({
      leftCandidateId: left.id,
      leftCandidateFingerprint: left.candidateFingerprint,
      rightCandidateId: right.id,
      rightCandidateFingerprint: right.candidateFingerprint,
      decision,
      rationale: rationale.trim(),
    });
  }

  return (
    <section className="six-card six-coevent-duplicate-review">
      <div className="six-card-heading">
        <div>
          <p className="six-kicker">Researcher-owned record linkage</p>
          <h3>Duplicate and policy-stage review</h3>
        </div>
        <span>Source records stay retained</span>
      </div>
      <p>
        Compare two retained occurrence records. Deduplicate copies as one
        event with a canonical display record, preserve distinct amendments or
        stages, distinguish different events, or defer the decision.
      </p>
      <form className="six-coevent-review-form" onSubmit={submit}>
        <div className="six-grid">
          <label className="six-field">
            <span>First record *</span>
            <select
              value={leftId}
              disabled={props.disabled}
              onChange={(event) => {
                const nextLeftId = event.target.value;
                setLeftId(nextLeftId);
                if (canonicalId === leftId) setCanonicalId(nextLeftId);
              }}
            >
              {props.candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.title}
                </option>
              ))}
            </select>
          </label>
          <label className="six-field">
            <span>Second record *</span>
            <select
              value={rightId}
              disabled={props.disabled}
              onChange={(event) => {
                const nextRightId = event.target.value;
                setRightId(nextRightId);
                if (canonicalId === rightId) setCanonicalId(nextRightId);
              }}
            >
              {props.candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="six-field">
          <span>Record relationship *</span>
          <select
            value={mode}
            disabled={props.disabled}
            onChange={(event) => setMode(
              event.target.value as CoEventDuplicateReviewDecision["mode"],
            )}
          >
            <option value="deferred">Defer duplicate review</option>
            <option value="same_event_representation">
              Same event, separate representations
            </option>
            <option value="distinct_stage">Distinct amendment or stage</option>
            <option value="different_event">Different events</option>
          </select>
        </label>
        {mode === "same_event_representation" ? (
          <label className="six-field">
            <span>Canonical display record *</span>
            <select
              value={canonicalId}
              disabled={props.disabled}
              onChange={(event) => setCanonicalId(event.target.value)}
            >
              {[left, right].filter((candidate) => candidate !== null)
                .map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.title}
                  </option>
                ))}
            </select>
          </label>
        ) : null}
        <label className="six-field">
          <span>Researcher rationale *</span>
          <textarea
            required
            value={rationale}
            maxLength={2_000}
            disabled={props.disabled}
            onChange={(event) => setRationale(event.target.value)}
          />
        </label>
        <button
          type="submit"
          className="six-secondary"
          disabled={props.disabled || !left || !right || left.id === right.id ||
            !rationale.trim() ||
            (mode === "same_event_representation" &&
              ![left.id, right.id].includes(canonicalId))}
        >
          Save duplicate/stage review
        </button>
        <small>
          Both immutable source records remain available. Same-event linkage
          deduplicates occurrence identity only; no linkage assesses relevance
          to the selected comparison.
        </small>
      </form>
      {props.reviews.length ? (
        <details className="six-coevent-duplicate-history">
          <summary>{props.reviews.length} saved pair decision{props.reviews.length === 1 ? "" : "s"}</summary>
          <ol>
            {[...props.reviews].reverse().map((review) => (
              <li key={review.id}>
                <strong>{readable(review.decision)}</strong>
                <span>
                  {review.members.map(({ candidateId }) =>
                    props.candidates.find(({ id }) => id === candidateId)?.title ??
                      candidateId).join(" ↔ ")}
                </span>
                <p>{review.rationale}</p>
                <small>
                  Revision {review.ordinal} · {review.reviewedAt} · both records retained
                </small>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
      <p className="six-claim-boundary">
        Duplicate linkage, policy-stage identity, and causal relevance are
        separate decisions. No relation category or control is inferred here.
      </p>
    </section>
  );
}

export function CoEventSearchPanel(props: {
  workspace: CoEventSearchWorkspace;
  mode: "targeted" | "contextual";
  modeLabel: string;
  disabled: boolean;
  canContinue: boolean;
  onSave: (input: Omit<
    CoEventSearchScopeInput,
    "schemaVersion" | "inputFingerprint"
  >) => Promise<void>;
  onContinue: () => Promise<void>;
  onReviewOccurrence: (
    input: CoEventOccurrenceReviewRequest,
  ) => Promise<void>;
  onReviewDuplicate: (
    input: CoEventDuplicateReviewRequest,
  ) => Promise<void>;
  onReviewRelation: (
    input: CoEventRelationReviewRequest,
  ) => Promise<void>;
  onRoutePolicyStage: (
    input: CoEventPolicyLifecycleHandoffRequest,
  ) => Promise<void>;
}) {
  const [draft, setDraft] = useState(initialCoEventScopeDraft);
  const [showScope, setShowScope] = useState(!props.workspace.matrix);
  const matrix = props.workspace.matrix;
  const executionPlan = props.workspace.executionPlan;
  const execution = props.workspace.execution;
  const attemptsByStep = new Map(
    props.workspace.attempts.map((attempt) => [attempt.stepId, attempt]),
  );
  const latestOccurrenceReviewByCandidate = new Map<
    string,
    CoEventSearchWorkspace["occurrenceReviews"][number]
  >();
  for (const review of props.workspace.occurrenceReviews) {
    latestOccurrenceReviewByCandidate.set(
      review.candidateReference.candidateId,
      review,
    );
  }
  const latestRelationReviewByCandidate = new Map<
    string,
    CoEventSearchWorkspace["relationReviews"][number]
  >();
  for (const review of props.workspace.relationReviews) {
    latestRelationReviewByCandidate.set(review.binding.candidateId, review);
  }

  function updateDraft<K extends keyof CoEventScopeDraft>(
    key: K,
    value: CoEventScopeDraft[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void props.onSave({
      anticipationLookback: {
        amount: Number(draft.lookbackAmount),
        unit: draft.lookbackUnit,
      },
      contextLookforward: {
        amount: Number(draft.lookforwardAmount),
        unit: draft.lookforwardUnit,
      },
      knownCoEvents: list(draft.knownCoEvents),
      importantEntities: coEventEntities(draft),
      includeMeasurementChanges: draft.includeMeasurementChanges,
    });
  }

  return (
    <section className="six-coevent-search" aria-label="Other-event search workspace">
      <section className="six-card six-coevent-context">
        <p className="six-kicker">{props.modeLabel}</p>
        <h2>Inspect the search boundary before retrieval</h2>
        <p>
          Screen 4 plans separate searches for overlapping policies,
          implementation or litigation, market changes, disruptions,
          spillovers, and—when relevant—measurement changes.
        </p>
        <div className="six-alert six-alert--warning">
          The matrix is not an exhaustive event list or a causal diagnosis.
          Coincidence alone does not establish relevance, and no candidate will
          be added to a model automatically.
        </div>
      </section>

      {showScope ? (
        <form className="six-card six-coevent-scope" onSubmit={submit}>
          <div className="six-card-heading">
            <div>
              <p className="six-kicker">Researcher-owned scope</p>
              <h3>Set the anticipation and context window</h3>
            </div>
            <span>Queries generated deterministically</span>
          </div>
          <div className="six-grid">
            <label className="six-field">
              <span>Look back before the study window *</span>
              <div className="six-offset-field">
                <input
                  required
                  type="number"
                  min="0"
                  max="120"
                  step="1"
                  value={draft.lookbackAmount}
                  disabled={props.disabled}
                  onChange={(event) => updateDraft(
                    "lookbackAmount",
                    event.target.value,
                  )}
                />
                <select
                  value={draft.lookbackUnit}
                  disabled={props.disabled}
                  onChange={(event) => updateDraft(
                    "lookbackUnit",
                    event.target.value as CoEventWindowOffset["unit"],
                  )}
                >
                  <option value="days">days</option>
                  <option value="months">months</option>
                  <option value="years">years</option>
                </select>
              </div>
            </label>
            <label className="six-field">
              <span>Look forward after the study window *</span>
              <div className="six-offset-field">
                <input
                  required
                  type="number"
                  min="0"
                  max="120"
                  step="1"
                  value={draft.lookforwardAmount}
                  disabled={props.disabled}
                  onChange={(event) => updateDraft(
                    "lookforwardAmount",
                    event.target.value,
                  )}
                />
                <select
                  value={draft.lookforwardUnit}
                  disabled={props.disabled}
                  onChange={(event) => updateDraft(
                    "lookforwardUnit",
                    event.target.value as CoEventWindowOffset["unit"],
                  )}
                >
                  <option value="days">days</option>
                  <option value="months">months</option>
                  <option value="years">years</option>
                </select>
              </div>
            </label>
            <label className="six-field">
              <span>Known co-events</span>
              <input
                value={draft.knownCoEvents}
                disabled={props.disabled}
                onChange={(event) => updateDraft(
                  "knownCoEvents",
                  event.target.value,
                )}
              />
              <small>Separate exact event names with commas.</small>
            </label>
            <label className="six-field">
              <span>Important suppliers</span>
              <input
                value={draft.suppliers}
                disabled={props.disabled}
                onChange={(event) => updateDraft("suppliers", event.target.value)}
              />
            </label>
            <label className="six-field">
              <span>Important customers</span>
              <input
                value={draft.customers}
                disabled={props.disabled}
                onChange={(event) => updateDraft("customers", event.target.value)}
              />
            </label>
            <label className="six-field">
              <span>Important regulators</span>
              <input
                value={draft.regulators}
                disabled={props.disabled}
                onChange={(event) => updateDraft("regulators", event.target.value)}
              />
            </label>
            <label className="six-field">
              <span>Important markets</span>
              <input
                value={draft.markets}
                disabled={props.disabled}
                onChange={(event) => updateDraft("markets", event.target.value)}
              />
            </label>
            <label className="six-field">
              <span>Other important entities</span>
              <input
                value={draft.otherEntities}
                disabled={props.disabled}
                onChange={(event) => updateDraft(
                  "otherEntities",
                  event.target.value,
                )}
              />
            </label>
          </div>
          <label className="six-coevent-measurement">
            <input
              type="checkbox"
              checked={draft.includeMeasurementChanges}
              disabled={props.disabled}
              onChange={(event) => updateDraft(
                "includeMeasurementChanges",
                event.target.checked,
              )}
            />
            <span>
              Include a separate measurement, reporting, sampling, and
              data-collection branch.
            </span>
          </label>
          <button
            type="submit"
            className="six-primary"
            disabled={props.disabled || !draft.lookbackAmount ||
              !draft.lookforwardAmount}
          >
            Save deterministic search matrix
          </button>
        </form>
      ) : matrix ? (
        <button
          type="button"
          className="six-secondary six-revise-design"
          disabled={props.disabled}
          onClick={() => setShowScope(true)}
        >
          Revise scope and create a new matrix
        </button>
      ) : null}

      {matrix ? (
        <section className="six-card six-search-matrix">
          <div className="six-card-heading">
            <div>
              <p className="six-kicker">Saved search matrix</p>
              <h3>{matrix.rows.length} substantive branches</h3>
            </div>
            <span>
              Revision {matrix.ordinal} · {execution?.status ?? "planned"}
            </span>
          </div>
          <dl className="six-identification-context">
            <div><dt>Mode</dt><dd>{matrix.modeLabel}</dd></div>
            <div>
              <dt>Study window</dt>
              <dd>{matrix.scope.studyPeriod.start} to {matrix.scope.studyPeriod.end}</dd>
            </div>
            <div>
              <dt>Anticipation lookback</dt>
              <dd>
                {matrix.scope.anticipationLookback.amount}{" "}
                {matrix.scope.anticipationLookback.unit}
              </dd>
            </div>
            <div>
              <dt>Context lookforward</dt>
              <dd>
                {matrix.scope.contextLookforward.amount}{" "}
                {matrix.scope.contextLookforward.unit}
              </dd>
            </div>
          </dl>
          <div className="six-matrix-rows">
            {matrix.rows.map((row) => (
              <article key={row.id}>
                <div className="six-card-heading">
                  <div>
                    <p className="six-kicker">
                      {row.branch.replaceAll("_", " ")}
                    </p>
                    <h4>{row.question}</h4>
                  </div>
                  <span>{row.outcome.status.replaceAll("_", " ")}</span>
                </div>
                <dl>
                  <div>
                    <dt>Affected groups</dt>
                    <dd>{row.affectedGroups.map(({ role, label }) =>
                      `${readable(role)}: ${label}`).join(" · ")}</dd>
                  </div>
                  <div><dt>Event family</dt><dd>{row.eventFamily}</dd></div>
                  <div>
                    <dt>Geography / market</dt>
                    <dd>{row.geographyOrMarket.join(", ")}</dd>
                  </div>
                  <div>
                    <dt>Planned providers</dt>
                    <dd>
                      {row.providers.map(({ id }) => readable(id)).join(", ")}
                      {" · availability not checked"}
                    </dd>
                  </div>
                  <div>
                    <dt>Generated query terms</dt>
                    <dd>{row.queryTerms.join(" · ")}</dd>
                  </div>
                  <div><dt>Planned limit</dt><dd>{row.plannedLimit} metadata results</dd></div>
                </dl>
              </article>
            ))}
          </div>
          {executionPlan ? (
            <details className="six-coevent-plan" open={!execution}>
              <summary>
                Provider plan · {executionPlan.steps.filter(({ initialStatus }) =>
                  initialStatus === "pending").length} runnable of{" "}
                {executionPlan.steps.length} routes
              </summary>
              <p>
                Search period {executionPlan.searchPeriod.start} to{" "}
                {executionPlan.searchPeriod.end} · at most{" "}
                {executionPlan.sourceQueryCeiling} source queries and{" "}
                {executionPlan.metadataCandidateCeiling} metadata records
              </p>
              <ul className="six-coevent-routes">
                {executionPlan.steps.map((step) => {
                  const attempt = attemptsByStep.get(step.id);
                  return (
                    <li key={step.id}>
                      <div>
                        <strong>{step.provider}</strong>
                        <span>{readable(step.branch)}</span>
                      </div>
                      <small>
                        {attempt
                          ? readable(attempt.outcome)
                          : `${readable(step.initialStatus)} · capability ${readable(step.capabilityStatus)}`}
                        {step.statusNote ? ` · ${step.statusNote}` : ""}
                      </small>
                    </li>
                  );
                })}
              </ul>
              <p className="six-claim-boundary">
                {executionPlan.claimBoundary}
              </p>
            </details>
          ) : null}
          {execution ? (
            <section className="six-coevent-boundary" aria-label="Actual search boundary">
              <div className="six-card-heading">
                <div>
                  <p className="six-kicker">Actual search boundary</p>
                  <h4>{readable(execution.status)}</h4>
                </div>
                <span>
                  {execution.completedStepIds.length} processed ·{" "}
                  {execution.remainingStepIds.length} remaining
                </span>
              </div>
              <dl className="six-identification-context">
                <div>
                  <dt>Period</dt>
                  <dd>
                    {execution.actualSearchBoundary.periodStart} to{" "}
                    {execution.actualSearchBoundary.periodEnd}
                  </dd>
                </div>
                <div>
                  <dt>Source queries</dt>
                  <dd>{execution.actualSearchBoundary.sourceQueries} / {executionPlan?.sourceQueryCeiling ?? 24}</dd>
                </div>
                <div>
                  <dt>Metadata records</dt>
                  <dd>{execution.actualSearchBoundary.metadataRecords} / {executionPlan?.metadataCandidateCeiling ?? 100}</dd>
                </div>
                <div>
                  <dt>Providers queried</dt>
                  <dd>{execution.actualSearchBoundary.searchedProviderIds.length
                    ? execution.actualSearchBoundary.searchedProviderIds
                      .map(readable).join(", ")
                    : "none"}</dd>
                </div>
                <div>
                  <dt>Unavailable provider routes</dt>
                  <dd>{execution.unavailableProviderIds.length
                    ? execution.unavailableProviderIds.map(readable).join(", ")
                    : "none recorded"}</dd>
                </div>
                <div>
                  <dt>Stop reason</dt>
                  <dd>{execution.actualSearchBoundary.stopReason
                    ? readable(execution.actualSearchBoundary.stopReason)
                    : "paused after one provider step"}</dd>
                </div>
              </dl>
              <p className="six-claim-boundary">
                Automated semantic causal-relation analysis is unavailable.
                Researcher-authored comparison judgments, when present below,
                remain separate from occurrence facts and are not model findings.
                {" "}{execution.claimBoundary}
              </p>
            </section>
          ) : (
            <div className="six-alert">
              <strong>Retrieval has not run.</strong> Provider capability,
              provider outcomes, candidate evidence, and the actual search
              boundary remain unrecorded.
            </div>
          )}
          {props.canContinue ? (
            <div className="six-coevent-run">
              <button
                type="button"
                className="six-primary"
                disabled={props.disabled}
                onClick={() => void props.onContinue()}
              >
                Run next bounded provider step
              </button>
              <small>
                One saved route runs per click. Status reads never continue
                retrieval, and no relation judgment runs here.
              </small>
            </div>
          ) : null}
          <p className="six-claim-boundary">{matrix.claimBoundary}</p>
        </section>
      ) : null}

      {props.workspace.attempts.length ? (
        <section className="six-card six-coevent-results">
          <div className="six-card-heading">
            <div>
              <p className="six-kicker">Provider outcomes</p>
              <h3>{props.workspace.attempts.length} bounded attempt{props.workspace.attempts.length === 1 ? "" : "s"}</h3>
            </div>
            <span>Outage is not no match</span>
          </div>
          <ol className="six-coevent-attempts">
            {[...props.workspace.attempts].reverse().map((attempt) => (
              <li key={attempt.id}>
                <div>
                  <strong>{readable(attempt.providerId)}</strong>
                  <span>{readable(attempt.outcome)}</span>
                </div>
                <p>{attempt.note}</p>
                <small>
                  {attempt.recordsReceived} received · {attempt.recordsAccepted}{" "}
                  accepted · {attempt.usage.sourceQueries} source{" "}
                  {attempt.usage.sourceQueries === 1 ? "query" : "queries"}
                </small>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {props.workspace.candidates.length ? (
        <section className="six-card six-coevent-results">
          <div className="six-card-heading">
            <div>
              <p className="six-kicker">
                Occurrence evidence + separate researcher relation review
              </p>
              <h3>{props.workspace.candidates.length} documented candidate{props.workspace.candidates.length === 1 ? "" : "s"}</h3>
            </div>
            <span>Relation judgments are not occurrence facts</span>
          </div>
          <div className="six-coevent-candidates">
            {props.workspace.candidates.map((candidate) => {
              const latestReview =
                latestOccurrenceReviewByCandidate.get(candidate.id) ?? null;
              return (
              <article key={candidate.id}>
                <h4>{candidate.title}</h4>
                <p>{candidate.description}</p>
                <small>
                  {candidate.typedDates.map(({ kind, value }) =>
                    `${readable(kind)}: ${value}`).join(" · ")}
                </small>
                <p>
                  <strong>Affected activity or population:</strong>{" "}
                  {readable(candidate.affectedActivityOrPopulation.status)} ·{" "}
                  <strong>Geography:</strong>{" "}
                  {candidate.geography.labels.length
                    ? candidate.geography.labels.join(", ")
                    : readable(candidate.geography.status)}
                </p>
                <ul>
                  {candidate.evidence.map((source) => (
                    <li key={source.sourceId}>
                      <a href={source.locator} target="_blank" rel="noreferrer">
                        {source.publisher}: {source.title}
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="six-claim-boundary">{candidate.claimBoundary}</p>
                <CoEventOccurrenceReviewControls
                  candidate={candidate}
                  latestReview={latestReview}
                  disabled={props.disabled}
                  onReview={props.onReviewOccurrence}
                />
                {latestReview && ["retained", "corrected"].includes(
                  latestReview.decision,
                ) ? (
                  <CoEventRelationReviewControls
                    candidate={candidate}
                    occurrenceReview={latestReview}
                    latestReview={
                      latestRelationReviewByCandidate.get(candidate.id) ?? null
                    }
                    mode={props.mode}
                    disabled={props.disabled}
                    onReview={props.onReviewRelation}
                  />
                ) : null}
                {latestReview && ["retained", "corrected"].includes(
                  latestReview.decision,
                ) ? (
                  <CoEventPolicyLifecycleHandoffControls
                    candidate={candidate}
                    occurrenceReview={latestReview}
                    disabled={props.disabled}
                    onRoute={props.onRoutePolicyStage}
                  />
                ) : null}
              </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {props.workspace.candidates.length > 1 ? (
        <CoEventDuplicateReviewPanel
          candidates={props.workspace.candidates}
          reviews={props.workspace.duplicateReviews}
          disabled={props.disabled}
          onReview={props.onReviewDuplicate}
        />
      ) : null}

      {props.workspace.discoveryLeads.length ? (
        <section className="six-card six-coevent-results">
          <div className="six-card-heading">
            <div>
              <p className="six-kicker">Contextual metadata leads</p>
              <h3>{props.workspace.discoveryLeads.length} lead{props.workspace.discoveryLeads.length === 1 ? "" : "s"}</h3>
            </div>
            <span>Occurrence not established</span>
          </div>
          <ul className="six-coevent-leads">
            {props.workspace.discoveryLeads.map((lead) => (
              <li key={lead.id}>
                <a href={lead.locator} target="_blank" rel="noreferrer">
                  {lead.title}
                </a>
                <small>{lead.publisher} · {lead.publishedDate ?? "publication date unavailable"}</small>
                <p>{lead.limitation}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {props.workspace.revisions.length ? (
        <details className="six-card six-design-history">
          <summary>Search-matrix revision history</summary>
          <ol>
            {[...props.workspace.revisions].reverse().map((revision) => (
              <li key={revision.matrixSnapshotId}>
                <div>
                  <strong>Revision {revision.ordinal}</strong>
                  <span>{readable(revision.artifactStatus)}</span>
                </div>
                <small>
                  {readable(revision.mode)} · {revision.rowCount} branches ·{" "}
                  {readable(revision.executionStatus)}
                </small>
                <small>{revision.createdAt}</small>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </section>
  );
}

function proofResult(value: unknown) {
  const factual = sixScreenPolicyFactProofResultSchema.safeParse(value);
  if (factual.success) {
    return {
      kind: "Factual finding" as const,
      summary: factual.data.answer,
      details: factual.data.uncertainties,
    };
  }
  const mechanism = sixScreenMechanismProofResultSchema.safeParse(value);
  if (mechanism.success) {
    return {
      kind: "Mechanism hypothesis" as const,
      summary: mechanism.data.mechanismHypothesis,
      details: [
        ...mechanism.data.steps.map((item) => `Step: ${item}`),
        ...mechanism.data.assumptions.map((item) =>
          `Assumption or boundary: ${item}`
        ),
      ],
    };
  }
  return null;
}

export function IntelligenceProofPanel(props: {
  mode: HostReasoningMode;
  ready: boolean;
  busy: SixScreenProofTaskType | null;
  entries: Partial<Record<SixScreenProofTaskType, SixScreenProofEntry>>;
  notice: string;
  disabled: boolean;
  onRun: (taskType: SixScreenProofTaskType) => void;
}) {
  if (props.mode !== "full") return null;
  const tasks: Array<{
    taskType: SixScreenProofTaskType;
    label: string;
    explanation: string;
  }> = [{
    taskType: "six-screen-policy-fact-proof",
    label: "Run factual round trip",
    explanation:
      "One source-bounded factual answer from the reviewed Event Card packet.",
  }, {
    taskType: "six-screen-mechanism-proof",
    label: "Run mechanism round trip",
    explanation:
      "One explicitly hypothetical pathway tied to the stated outcome; no literature support is supplied.",
  }];
  return (
    <section className="six-screen-gate six-proof-panel" aria-label="Signed-in intelligence proof">
      <p className="six-kicker">Developer acceptance harness · proof only</p>
      <h3>Verify the signed-in intelligence round trip</h3>
      <p>
        These tasks freeze the current reviewed source packet, require one
        structured model-only submission, validate and persist a noncanonical
        result, then reconcile it into this panel. They cannot change the Event
        Card, classify another event, or record a researcher decision.
      </p>
      <div className="six-proof-grid">
        {tasks.map(({ taskType, label, explanation }) => {
          const entry = props.entries[taskType];
          const result = proofResult(entry?.task.result);
          return (
            <article key={taskType}>
              <strong>{label}</strong>
              <p>{explanation}</p>
              <button
                type="button"
                className="six-secondary"
                disabled={props.disabled || !props.ready || props.busy !== null}
                onClick={() => props.onRun(taskType)}
              >
                {props.busy === taskType ? "Waiting for signed-in response…" : label}
              </button>
              {entry ? (
                <p className="six-proof-status" data-status={entry.task.status}>
                  {entry.task.status.replaceAll("-", " ")}
                  {entry.task.panelReconciliation.status === "reconciled"
                    ? " · reconciled in this panel"
                    : ""}
                </p>
              ) : null}
              {result ? (
                <div className="six-proof-result">
                  <small>{result.kind} · noncanonical</small>
                  <p>{result.summary}</p>
                  {result.details.length ? (
                    <ul>{result.details.map((detail, index) => (
                      <li key={`${taskType}-${index}`}>{detail}</li>
                    ))}</ul>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
      {!props.ready ? (
        <p className="six-alert six-alert--warning">
          Lock a current Event Card with at least one accepted source-linked
          claim before running either proof task.
        </p>
      ) : null}
      {props.notice ? <p aria-live="polite">{props.notice}</p> : null}
      <small>
        A persisted fixture or local submission is not signed-in evidence.
        Capability remains disabled until both genuine task traces and their
        same-panel reconciliation are reviewed separately.
      </small>
    </section>
  );
}

export function ResearchExportDrawer(props: {
  open: boolean;
  state: SixScreenWorkflowState | null;
  availability: WorkflowResearchExportAvailability | null;
  onClose: () => void;
  onDownload: () => void;
}) {
  if (!props.open) return null;
  const available = props.availability?.available ?? false;
  return (
    <aside
      id="six-screen-report-drawer"
      className="six-report-drawer"
      role="dialog"
      aria-modal="false"
      aria-labelledby="six-report-title"
    >
      <div className="six-report-heading">
        <div>
          <p className="six-kicker">Shared report drawer</p>
          <h2 id="six-report-title">Research record and export</h2>
        </div>
        <button
          type="button"
          className="six-secondary"
          onClick={props.onClose}
          aria-label="Close report drawer"
        >
          Close
        </button>
      </div>
      {available && props.availability ? (
        <>
          <p className="six-report-status" data-status={
            props.availability.completenessStatus
          }>
            {props.availability.completenessStatus === "complete"
              ? "Complete current-snapshot export"
              : "Partial current-snapshot export"}
          </p>
          <p>
            The export follows the current saved workflow revision and keeps
            missing or unassessed work explicit. It never includes private
            authorization material or exact source excerpts by default.
          </p>
          <div className="six-report-columns">
            <section>
              <h3>Included now</h3>
              <ul>
                {props.availability.includedModules.map((module) => (
                  <li key={module}>{readable(module)}</li>
                ))}
              </ul>
            </section>
            <section>
              <h3>Still partial or unassessed</h3>
              <ul>
                {props.availability.excludedOrUnassessedEvidence.map(
                  (item) => <li key={item}>{item}</li>,
                )}
              </ul>
            </section>
          </div>
          <button
            type="button"
            className="six-primary"
            onClick={props.onDownload}
          >
            Download current research bundle (.json)
          </button>
          <small>
            Fingerprints detect change; they do not prove that a source or
            interpretation is true. The bundle is not a causal certificate.
          </small>
        </>
      ) : (
        <div className="six-report-unavailable">
          <h3>Available after identity resolution</h3>
          <p>
            Resolve a policy identity first. A confirmation is not required
            merely to preserve the resolved candidate record, but unconfirmed
            identity remains prominently labeled.
          </p>
        </div>
      )}
      {props.state ? (
        <small>
          Workflow {props.state.runId} · revision {props.state.revision}
        </small>
      ) : null}
    </aside>
  );
}

function PolicyClaimSources(props: {
  claims: PolicyReview["claims"];
  claimIds: readonly string[];
  label?: string;
  compact?: boolean;
}) {
  const groups = new Map<string, {
    key: string;
    claim: PolicyReview["claims"][number];
    claims: PolicyReview["claims"];
  }>();
  for (const claimId of props.claimIds) {
    const claim = props.claims.find((candidate) => candidate.claimId === claimId);
    if (!claim) continue;
    const key = claim.citation.documentVersionId || [
      claim.citation.sourceId,
      claim.citation.versionLabel ?? "unlabelled-version",
      claim.citation.canonicalUrl,
    ].join("|");
    const group = groups.get(key) ?? { key, claim, claims: [] };
    if (!group.claims.some((member) => member.claimId === claim.claimId)) {
      group.claims.push(claim);
    }
    groups.set(key, group);
  }
  const sources = [...groups.values()];
  if (!sources.length) return null;
  if (props.compact) {
    return (
      <div className="six-policy-source-links six-policy-compact-sources">
        <strong>{props.label ?? "Sources"}:</strong>
        {sources.map((source, index) => (
          <details key={source.key}
            data-document-version-id={source.claim.citation.documentVersionId}>
            <summary
              aria-label={
                "Evidence " + (index + 1) + ": " + source.claim.citation.sourceTitle
              }
              title={
                source.claim.citation.sourceTitle + " — " +
                  (source.claim.citation.versionLabel ?? "saved version")
              }
            >
              [{index + 1}]
            </summary>
            <div>
              <a
                href={source.claim.citation.canonicalUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open {source.claim.citation.sourceTitle}
              </a>
              <small>
                {source.claim.citation.versionLabel
                  ? source.claim.citation.versionLabel
                  : ""}
              </small>
              {source.claims.map((claim) => <section
                key={`${claim.claimId}:${claim.citation.passageId}`}>
                <blockquote>{cleanPolicyPresentationText(
                  claim.citation.exactText,
                )}</blockquote>
                <small>
                  {/^https?:\/\//iu.test(claim.citation.locator)
                    ? <a href={claim.citation.locator} target="_blank"
                        rel="noreferrer">Open cited passage</a>
                    : claim.citation.locator}
                  {" · "}claim {claim.claimId} · passage{" "}
                  {claim.citation.passageId}
                </small>
              </section>)}
            </div>
          </details>
        ))}
      </div>
    );
  }
  return (
    <div className="six-policy-source-links">
      <strong>{props.label ?? "Sources"}:</strong>
      {sources.map((source) => (
        <details key={source.key}
          data-document-version-id={source.claim.citation.documentVersionId}>
          <summary>
            Source text · {source.claim.citation.sourceTitle}
            {source.claim.citation.versionLabel
              ? ` (${source.claim.citation.versionLabel})`
              : ""}
            <small>{source.claims.length} cited passage{source.claims.length === 1
              ? "" : "s"}</small>
          </summary>
          <a
            href={source.claim.citation.canonicalUrl}
            target="_blank"
            rel="noreferrer"
            title={`${source.claim.citation.sourceTitle} — ${source.claim.citation.versionLabel ?? "saved version"}`}
          >
            Open this saved document version
          </a>
          <ul>{source.claims.map((claim) => <li
            key={`${claim.claimId}:${claim.citation.passageId}`}>
            <p>{cleanPolicyPresentationText(claim.statement)}</p>
            <blockquote>{cleanPolicyPresentationText(
              claim.citation.exactText,
            )}</blockquote>
            <small>
              {/^https?:\/\//iu.test(claim.citation.locator)
                ? <a href={claim.citation.locator} target="_blank"
                    rel="noreferrer">Open cited passage</a>
                : claim.citation.locator}
              {" · "}claim {claim.claimId} · passage{" "}
              {claim.citation.passageId}
            </small>
          </li>)}</ul>
        </details>
      ))}
    </div>
  );
}

function PolicyBriefingSectionView(props: {
  review: PolicyReview;
  section: PolicyBriefingSection;
  className?: string;
}) {
  const statusLabel = {
    supported: "Supported by sources",
    partial: "More evidence needed",
    unresolved: "Not yet established",
    conflicting: "Sources conflict",
  }[props.section.status];
  return (
    <section className={props.className} data-status={props.section.status}>
      <div className="six-policy-section-heading">
        <h3>{props.section.title}</h3>
        <span>{statusLabel}</span>
      </div>
      {props.section.findings?.length ? (
        <div className="six-policy-findings">
          {props.section.findings.map((finding, index) => (
            <article key={`${finding.label}:${index}`}>
              <p>
                <strong>{finding.label}</strong>
                <span>{cleanPolicyPresentationText(finding.text)}</span>
              </p>
              <PolicyClaimSources
                claims={props.review.claims}
                claimIds={finding.claimIds}
                label="Evidence"
                compact
              />
            </article>
          ))}
        </div>
      ) : (
        <>
          {props.section.paragraphs.map((paragraph, index) => (
            <p key={`${props.section.title}-${index}`}>
              {cleanPolicyPresentationText(paragraph)}
            </p>
          ))}
          <PolicyClaimSources
            claims={props.review.claims}
            claimIds={props.section.claimIds}
          />
        </>
      )}
    </section>
  );
}

export function cleanPolicyOverviewText(value: string) {
  return cleanPolicyPresentationText(value)
    .replace(
      /^The acquired official representations support a substantive partial briefing\.\s*/iu,
      "",
    )
    .replace(
      /^Consequential missing or partial requirements remain queued or explicitly unresolved\.\s*/iu,
      "",
    )
    .trim();
}

function PolicySynthesisStatus(props: { review: PolicyReview }) {
  const synthesis = props.review.synthesis;
  if (!synthesis || synthesis.status === "completed" ||
      synthesis.status === "not_attempted") return null;
  return (
    <div className="six-alert six-alert--warning" data-status={synthesis.status}>
      Some wording could not be simplified, so the source-based version is
      shown below.
    </div>
  );
}

function PolicyResearchStatus(props: {
  automation: PolicyAutomationState;
  detail: string;
  review?: PolicyReview | null;
  busy: boolean;
  connected: boolean;
  onRetry: () => void | Promise<void>;
}) {
  const active = props.automation.status === "running";
  const complete = props.automation.status === "complete" || Boolean(
    props.review && !props.review.plan.nextStepId,
  );
  const paused = props.automation.status === "paused";
  const progress = props.review ? policyPlanProgress(props.review) : null;
  return (
    <div className="six-policy-progress" data-status={props.automation.status}>
      {paused ? <strong role="status">Search paused</strong> : null}
      {!active && !complete && !paused ? (
        <strong role="status">Preparing the search</strong>
      ) : null}
      <ProcessingStatus
        active={active}
        stage="Still searching"
        complete={complete}
        completeMessage="Done! Please see below."
        completedCount={progress?.finished}
        totalCount={props.review?.plan.steps.length}
      />
      <p>
        {props.detail}
      </p>
      {paused ? (
        <button
          type="button"
          className="six-primary"
          disabled={props.busy || !props.connected}
          onClick={() => void props.onRetry()}
        >
          Retry standard research
        </button>
      ) : null}
    </div>
  );
}

const POLICY_TIMELINE_LABELS: Partial<Record<TypedDate["kind"], string>> = {
  initiation: "Initiated",
  announcement: "Announced",
  adoption: "Passed or adopted",
  publication: "Published",
  scheduled_effect: "Scheduled to take effect",
  legal_effect: "Effective",
  compliance: "Compliance begins",
  implementation: "Implemented",
  enforcement: "Enforcement begins",
  amendment: "Amended or expanded",
  injunction: "Stayed or enjoined",
  invalidation: "Invalidated or vacated",
  withdrawal: "Withdrawn",
  suspension: "Suspended",
  repeal: "Repealed",
  supersession: "Superseded",
  other: "Documented milestone",
};

const POLICY_TIMELINE_ORDER: Partial<Record<TypedDate["kind"], number>> = {
  initiation: 0,
  announcement: 1,
  adoption: 2,
  publication: 3,
  scheduled_effect: 4,
  legal_effect: 5,
  compliance: 6,
  implementation: 7,
  enforcement: 8,
  amendment: 9,
  injunction: 10,
  invalidation: 11,
  withdrawal: 12,
  suspension: 13,
  repeal: 14,
  supersession: 15,
  other: 16,
};

type PolicyTimelineDisplayItem = PolicyBriefingTimelineItem & {
  origin: "briefing" | "confirmed_identity";
};

export function policyTimelineItems(
  review: PolicyReview,
  identity?: ConfirmedShock | null,
): PolicyTimelineDisplayItem[] {
  const briefing = review.briefing;
  if (!briefing) return [];
  const items = new Map<string, PolicyTimelineDisplayItem>();
  for (const item of [
    ...briefing.timeline,
    ...(briefing.laterTimeline ?? []),
  ]) {
    const key = [item.date.start, item.date.end, item.date.kind].join(":" );
    items.set(key, { ...item, origin: "briefing" });
  }
  for (const [index, date] of (identity?.typedDates ?? []).entries()) {
    if (!date.start) continue;
    const key = [date.start, date.end, date.kind].join(":" );
    if (items.has(key)) continue;
    const label = date.label ?? POLICY_TIMELINE_LABELS[date.kind] ??
      "Documented milestone";
    items.set(key, {
      claimId: `confirmed-identity-date-${index}`,
      label,
      date,
      statement: `${label} in the confirmed policy chronology.`,
      qualification: "This date comes from the confirmed identity sources.",
      origin: "confirmed_identity",
    });
  }
  return [...items.values()].sort((left, right) =>
    (left.date.start ?? "9999-12-31").localeCompare(
      right.date.start ?? "9999-12-31",
    ) ||
    (POLICY_TIMELINE_ORDER[left.date.kind] ?? 99) -
      (POLICY_TIMELINE_ORDER[right.date.kind] ?? 99)
  );
}

function PolicyTimeline(props: {
  review: PolicyReview;
  identity?: ConfirmedShock | null;
  identityCandidate?: IdentityCandidate | null;
}) {
  const viewport = useRef<HTMLOListElement>(null);
  const briefing = props.review.briefing;
  if (!briefing) return null;
  const timeline = policyTimelineItems(props.review, props.identity);
  const identitySources = timeline.some(({ origin }) =>
      origin === "confirmed_identity")
    ? props.identityCandidate?.identitySources ?? []
    : [];
  const undatedClaims = briefing.undatedTimelineClaimIds.flatMap((claimId) => {
    const claim = props.review.claims.find((candidate) =>
      candidate.claimId === claimId
    );
    return claim ? [claim] : [];
  });
  const currentStatusKinds = new Set([
    "legal_effect", "implementation", "enforcement", "injunction",
    "invalidation", "withdrawal", "suspension", "repeal", "supersession",
  ]);
  const currentStatusLabels: Record<string, string> = {
    legal_effect: "In legal effect",
    implementation: "Implemented",
    enforcement: "Enforcement documented",
    injunction: "Stayed or enjoined",
    invalidation: "Invalidated or vacated",
    withdrawal: "Withdrawn",
    suspension: "Suspended",
    repeal: "Repealed or removed",
    supersession: "Superseded or amended",
  };
  const currentStatus = timeline.filter((item) => item.date.start &&
    currentStatusKinds.has(item.date.kind))
    .sort((left, right) =>
      (right.date.start ?? "").localeCompare(left.date.start ?? ""))[0];
  const scroll = (direction: -1 | 1) => {
    const element = viewport.current;
    if (!element) return;
    element.scrollBy({
      left: direction * Math.max(240, element.clientWidth * 0.78),
      behavior: "smooth",
    });
  };
  return (
    <section className="six-policy-timeline" aria-label="Policy timeline">
      <div className="six-card-heading">
        <div>
          <p className="six-kicker">Chronology</p>
          <h3>Distinct legal stages</h3>
        </div>
        {timeline.length > 1 ? (
          <div className="six-policy-timeline-controls" aria-label="Timeline controls">
            <button
              type="button"
              className="six-secondary"
              aria-label="Scroll policy timeline left"
              onClick={() => scroll(-1)}
            >
              ←
            </button>
            <button
              type="button"
              className="six-secondary"
              aria-label="Scroll policy timeline right"
              onClick={() => scroll(1)}
            >
              →
            </button>
          </div>
        ) : null}
      </div>
      {currentStatus ? (
        <div className="six-policy-current-status" role="status">
          <p className="six-kicker">Current documented status</p>
          <strong>
            {currentStatusLabels[currentStatus.date.kind] ??
              currentStatus.label}
          </strong>
          <p>{cleanPolicyPresentationText(currentStatus.statement)}</p>
          <small>
            Latest source-linked status milestone: {currentStatus.date.start}
          </small>
        </div>
      ) : null}
      {timeline.length ? (
        <ol className="six-policy-timeline-viewport" ref={viewport} tabIndex={0}>
          {timeline.map((item) => (
            <li key={`${item.claimId}-${item.date.kind}`}>
              <time>{item.date.start ?? "Date unresolved"}</time>
              <strong>{item.label}</strong>
              <p>{cleanPolicyPresentationText(item.statement)}</p>
              {item.origin === "briefing" ? (
                <PolicyClaimSources
                  claims={props.review.claims}
                  claimIds={item.claimIds ?? [item.claimId]}
                  label="Evidence"
                  compact
                />
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p>No source-bound legal-stage date is established yet.</p>
      )}
      {undatedClaims.length ? (
        <details className="six-policy-undated">
          <summary>Relative or undated milestones ({undatedClaims.length})</summary>
          <ul>
            {undatedClaims.map((claim) => (
              <li key={claim.claimId}>
                <p>{cleanPolicyPresentationText(claim.statement)}</p>
                <PolicyClaimSources
                  claims={props.review.claims}
                  claimIds={[claim.claimId]}
                  label="Evidence"
                  compact
                />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {identitySources.length ? (
        <details className="six-policy-later">
          <summary>Confirmed identity sources ({identitySources.length})</summary>
          <p>These sources support the confirmed policy identity and its
            chronology. No date is automatically selected as the study's
            treatment date.</p>
          <ul>
            {identitySources.map((source) => (
              <li key={source.id}>
                <a href={source.locator} target="_blank" rel="noreferrer">
                  {source.title}
                </a>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

export function StudyFields(props: {
  form: FormState;
  disabled: boolean;
  required: boolean;
  onChange: (name: keyof FormState, value: string) => void;
  errors?: Partial<Record<Screen3EntryFieldId, string>>;
}) {
  return (
    <>
      <section className="six-study-field-section">
      <h4>Sample and scope</h4>
      <div className="six-study-fields-grid">
        <Field
          label="Sample"
          name="population"
          value={props.form.population}
          onChange={props.onChange}
          required={props.required}
          disabled={props.disabled}
          id="screen3-population"
          error={props.errors?.population}
        />
        <Field
          label="Unit of analysis"
          name="analysisUnit"
          value={props.form.analysisUnit}
          onChange={props.onChange}
          required={props.required}
          disabled={props.disabled}
          id="screen3-analysisUnit"
          error={props.errors?.analysisUnit}
        />
        <Field
          label="Geography"
          name="geography"
          value={props.form.geography}
          onChange={props.onChange}
          required={props.required}
          disabled={props.disabled}
          hint="Separate multiple places with commas."
          id="screen3-geography"
          error={props.errors?.geography}
        />
        <Field
          label="Study period start"
          name="periodStart"
          value={props.form.periodStart}
          onChange={props.onChange}
          required={props.required}
          disabled={props.disabled}
          id="screen3-periodStart"
          error={props.errors?.periodStart}
        />
        <Field
          label="Study period end"
          name="periodEnd"
          value={props.form.periodEnd}
          onChange={props.onChange}
          required={props.required}
          disabled={props.disabled}
          id="screen3-periodEnd"
          error={props.errors?.periodEnd}
        />
        <Field
          label="Industry"
          name="industry"
          value={props.form.industry}
          onChange={props.onChange}
          disabled={props.disabled}
          hint="Separate multiple industries with commas."
        />
      </div>
      </section>
      <section className="six-study-field-section">
      <h4>Research question</h4>
      <div className="six-study-fields-grid">
        <Field
          label="Outcome"
          name="outcome"
          value={props.form.outcome}
          onChange={props.onChange}
          required={props.required}
          disabled={props.disabled}
          id="screen3-outcome"
          error={props.errors?.outcome}
        />
        <Field
          label="Outcome measure"
          name="outcomeMeasure"
          value={props.form.outcomeMeasure}
          onChange={props.onChange}
          disabled={props.disabled}
          hint="Example: return on assets."
        />
        <Field
          label="Theoretical construct of the shock"
          name="policySideConcept"
          value={props.form.policySideConcept}
          onChange={props.onChange}
          disabled={props.disabled}
          hint="The idea or theoretical change this shock represents in your study."
        />
      </div>
      {props.form.intendedConstruct && !props.form.policySideConcept ? (
        <div className="six-legacy-construct" role="note">
          <p>An older study saved “{props.form.intendedConstruct}” in a different field. Review its meaning before using it as the shock construct.</p>
          <button type="button" className="six-secondary" disabled={props.disabled}
            onClick={() => props.onChange("policySideConcept", props.form.intendedConstruct)}>
            Use this prior wording for the shock construct
          </button>
        </div>
      ) : null}
      <label className="six-field">
        <span>How the shock affects the outcome (i.e., mechanism){props.required ? " *" : ""}</span>
        <textarea
          id="screen3-initialExplanation"
          name="initialExplanation"
          value={props.form.initialExplanation}
          required={props.required}
          disabled={props.disabled}
          aria-invalid={Boolean(props.errors?.initialExplanation)}
          aria-describedby={props.errors?.initialExplanation
            ? "screen3-initialExplanation-error"
            : undefined}
          onChange={(event) =>
            props.onChange("initialExplanation", event.target.value)}
        />
        <small>Describe the proposed route from the shock to the outcome. Older saved questions remain as originally entered until you revise them.</small>
        {props.errors?.initialExplanation ? (
          <small id="screen3-initialExplanation-error" className="six-field-error" role="alert">
            {props.errors.initialExplanation}
          </small>
        ) : null}
      </label>
      </section>
      <section className="six-study-field-section">
      <h4>Proposed comparison</h4>
      <div className="six-study-fields-grid">
        <Field
          label="Treatment group"
          name="proposedTreatment"
          value={props.form.proposedTreatment}
          onChange={props.onChange}
          disabled={props.disabled}
        />
        <Field
          label="Control group"
          name="proposedComparison"
          value={props.form.proposedComparison}
          onChange={props.onChange}
          disabled={props.disabled}
        />
      </div>
      </section>
      <label className="six-field">
        <span>Have you already examined results for this question?</span>
        <select
          value={props.form.resultsPreviouslyInspected}
          disabled={props.disabled}
          onChange={(event) => props.onChange(
            "resultsPreviouslyInspected",
            event.target.value,
          )}
        >
          <option value="not_disclosed">Not disclosed</option>
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>
      </label>
    </>
  );
}

/** Read-only compatibility export for older component tests and saved hosts. */
export function Screen3StudyDetailsForm(props: {
  form: FormState;
  disabled: boolean;
  onChange: (name: keyof FormState, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="six-handoff-study-form" onSubmit={props.onSubmit}>
      <div>
        <h4>Complete the study handoff here</h4>
        <p>
          Known values are prefilled. Current navigation also requires an explicit
          proposed timing choice; policy-claim approval is not required.
        </p>
      </div>
      <StudyFields
        form={props.form}
        disabled={props.disabled}
        required
        onChange={props.onChange}
      />
      <button type="submit" className="six-primary" disabled={props.disabled}>
        Save study details
      </button>
    </form>
  );
}

export function TreatmentTimingEditor(props: {
  value: TimingFormState;
  disabled: boolean;
  error?: string;
  onChange: (value: TimingFormState) => void;
}) {
  return (
    <fieldset
      id="screen3-proposedTiming"
      className="six-timing-editor"
      aria-invalid={Boolean(props.error)}
      aria-describedby={props.error ? "screen3-timing-error" : undefined}
      tabIndex={-1}
    >
      <legend>Proposed treatment timing *</legend>
      <div className="six-timing-options">
        <label>
          <input
            type="radio"
            name="proposed-timing-mode"
            checked={props.value.mode === "year"}
            disabled={props.disabled}
            onChange={() => props.onChange({ mode: "year", year: props.value.year })}
          />
          <span>Use a proposed year</span>
        </label>
        <label>
          <input
            type="radio"
            name="proposed-timing-mode"
            checked={props.value.mode === "varies_by_group"}
            disabled={props.disabled}
            onChange={() => props.onChange({ mode: "varies_by_group", year: "" })}
          />
          <span className="six-timing-option-copy">
            <strong>Staggered timing — treatment starts in different years</strong>
            <small>
              Choose this when states, firms, or other groups first experience
              the shock in different years during the study period.
            </small>
          </span>
        </label>
      </div>
      {props.value.mode === "year" ? (
        <label className="six-field six-year-field">
          <span>Treatment year</span>
          <input
            id="screen3-treatmentYear"
            inputMode="numeric"
            pattern="[0-9]{4}"
            min={SIX_SCREEN_TREATMENT_YEAR_MIN}
            max={SIX_SCREEN_TREATMENT_YEAR_MAX}
            value={props.value.year}
            disabled={props.disabled}
            aria-invalid={Boolean(props.error)}
            aria-describedby={props.error ? "screen3-timing-error" : undefined}
            onChange={(event) => props.onChange({
              mode: "year",
              year: event.target.value,
            })}
          />
        </label>
      ) : null}
      {props.error ? (
        <p id="screen3-timing-error" className="six-field-error" role="alert">
          {props.error}
        </p>
      ) : null}
    </fieldset>
  );
}

function screen3FieldErrors(issues: readonly Screen3EntryIssue[]) {
  const errors: Partial<Record<Screen3EntryFieldId, string>> = {};
  for (const issue of issues) {
    for (const fieldId of issue.fieldIds) errors[fieldId] ??= issue.message;
  }
  return errors;
}

export function StudyHandoffPanel(props: {
  form: FormState;
  timing: TimingFormState;
  issues: readonly Screen3EntryIssue[];
  showErrors: boolean;
  submissionError: string;
  handoffTask: Screen3HandoffTaskState | null;
  ready: boolean;
  disabled: boolean;
  connected: boolean;
  canCancel: boolean;
  onChange: (name: keyof FormState, value: string) => void;
  onTimingChange: (value: TimingFormState) => void;
  rdRule: RdRuleDraft | null;
  onRdRuleChange: (value: RdRuleDraft | null) => void;
  onBack: () => void;
  onCancel: () => void;
  onContinue: () => void;
  onCheckSavedStatus: () => void;
  onRestoreComparisonGuidance?: () => void;
}) {
  const visibleIssues = props.showErrors ? props.issues : [];
  const errors = screen3FieldErrors(visibleIssues);
  const timingError = errors.treatmentYear ?? errors.proposedTiming;
  const handoffPolicy = props.handoffTask
    ? screen3HandoffStagePolicy(props.handoffTask.stage)
    : null;
  const showHandoffTask = Boolean(props.handoffTask && ![
    "saving", "checking", "saved_historical",
  ].includes(props.handoffTask.stage));
  return (
    <section className="six-study-handoff" aria-label="Your study for the next step"
      aria-busy={props.handoffTask?.stage === "saving" ||
        props.handoffTask?.stage === "checking" || undefined}>
      <div className="six-study-handoff-heading">
        <div>
          <p className="six-kicker">Screen 2 → Screen 3</p>
          <h3>Your study for the next step</h3>
          <p>
            You can edit again the study information saved for later screens.
          </p>
        </div>
        <span>{props.ready ? "Study fields ready" : "Needs study details"}</span>
      </div>
      <StudyFields
        form={props.form}
        disabled={props.disabled}
        required
        onChange={props.onChange}
        errors={errors}
      />
      <TreatmentTimingEditor
        value={props.timing}
        disabled={props.disabled}
        error={timingError}
        onChange={props.onTimingChange}
      />
      {props.timing.mode === "year" ? (
        <fieldset className="six-threshold-editor">
          <legend>Treatment specification</legend>
          <label><input type="radio" name="assignment-path"
            checked={!props.rdRule} disabled={props.disabled}
            onChange={() => props.onRdRuleChange(null)} /> Treatment year</label>
          <label><input type="radio" name="assignment-path"
            checked={Boolean(props.rdRule)} disabled={props.disabled}
            onChange={() => props.onRdRuleChange(emptyRdRuleDraft())} />
            Threshold and treatment year</label>
          {props.rdRule ? (
            <div className="six-threshold-fields">
              <p>This is your proposed assignment rule. A cutoff alone does not establish a valid regression discontinuity (RD).</p>
              <div className="six-study-fields-grid">
                <label className="six-field"><span>Running variable and units, when relevant *</span>
                  <input value={props.rdRule.runningVariable} disabled={props.disabled}
                    onChange={(event) => props.onRdRuleChange({
                      ...props.rdRule!, runningVariable: event.target.value })} /></label>
                <label className="six-field"><span>Cutoff *</span>
                  <input value={props.rdRule.cutoff} disabled={props.disabled}
                    onChange={(event) => props.onRdRuleChange({
                      ...props.rdRule!, cutoff: event.target.value })} /></label>
                <label className="six-field"><span>Treated side</span>
                  <select value={props.rdRule.operator} disabled={props.disabled}
                    onChange={(event) => props.onRdRuleChange({
                      ...props.rdRule!, operator: event.target.value as RdRuleDraft["operator"] })}>
                    <option value=">=">At or above (≥)</option><option value=">">Above (&gt;)</option>
                    <option value="<=">At or below (≤)</option><option value="<">Below (&lt;)</option>
                  </select></label>
                <label className="six-field"><span>What the cutoff assigns</span>
                  <select value={props.rdRule.treatmentTarget} disabled={props.disabled}
                    onChange={(event) => props.onRdRuleChange({
                      ...props.rdRule!, treatmentTarget: event.target.value as RdRuleDraft["treatmentTarget"] })}>
                    <option value="eligibility">Eligibility</option><option value="receipt">Treatment receipt</option>
                  </select></label>
                <label className="six-field"><span>Assignment or receipt relation</span>
                  <select value={props.rdRule.assignmentRelation} disabled={props.disabled}
                    onChange={(event) => props.onRdRuleChange({
                      ...props.rdRule!, assignmentRelation: event.target.value as RdRuleDraft["assignmentRelation"] })}>
                    <option value="unknown">Unknown</option><option value="sharp">Reported sharp</option>
                    <option value="fuzzy">Reported fuzzy</option>
                  </select></label>
              </div>
              <label className="six-field"><span>Other eligibility conditions</span>
                <textarea value={props.rdRule.otherConditions ?? ""} disabled={props.disabled}
                  onChange={(event) => props.onRdRuleChange({
                    ...props.rdRule!, otherConditions: event.target.value || null })} /></label>
              <small>Unknown assignment details remain unknown. Screen 3 will assess whether the rule could support an RD comparison.</small>
            </div>
          ) : null}
        </fieldset>
      ) : null}
      {props.timing.mode === "year" && /^\d{4}$/u.test(props.timing.year) &&
          props.form.periodStart && props.form.periodEnd && (
            Number(props.timing.year) <= Number(props.form.periodStart.slice(0, 4)) ||
            Number(props.timing.year) >= Number(props.form.periodEnd.slice(0, 4))
          ) ? (
          <div className="six-alert six-alert--warning">
            <strong>Proposed-window support needs attention.</strong>
            <p>
              The selected year is outside or at a boundary of the proposed study
              window. This warning is nonblocking and does not assert how many
              observations exist or change either date.
            </p>
          </div>
        ) : null}
      {visibleIssues.length || props.submissionError ? (
        <div className="six-field-error" role="alert" aria-live="polite">
          <strong>Review the highlighted study details.</strong>
          {visibleIssues.length ? (
            <ul className="six-inline-errors">
              {visibleIssues.map((issue) => (
                <li key={issue.code}>{issue.message}</li>
              ))}
            </ul>
          ) : null}
          {props.submissionError ? <p>{props.submissionError}</p> : null}
        </div>
      ) : null}
      {props.handoffTask && showHandoffTask ? (
        <div
          id="screen3-handoff-task-alert"
          tabIndex={-1}
          className={props.handoffTask.stage === "saving" ||
              props.handoffTask.stage === "checking" ||
              props.handoffTask.stage === "saved_historical"
            ? "six-alert"
            : "six-alert six-alert--error"}
          role={props.handoffTask.stage === "saving" ||
              props.handoffTask.stage === "checking" ||
              props.handoffTask.stage === "saved_historical"
            ? "status" : "alert"}
          aria-live="polite"
        >
          <strong>
            {props.handoffTask.stage === "saving"
              ? "Saving the study handoff"
              : props.handoffTask.stage === "checking"
                ? "Checking the exact saved operation"
                : props.handoffTask.stage === "saved_historical"
                  ? "Earlier handoff retained as history"
                  : props.handoffTask.stage === "local_rebuild_required"
                    ? "Saved handoff needs local restoration"
                : "Study handoff needs attention"}
          </strong>
          <p>{props.handoffTask.message}</p>
          {props.handoffTask.problem ? (
            <small>
              Stage: {props.handoffTask.problem.stage.replaceAll("_", " ")} · {props.handoffTask.problem.diagnosticReference}
            </small>
          ) : null}
          {handoffPolicy?.canCheckSavedStatus ? (
            <button type="button" className="six-secondary"
              disabled={!props.connected}
              onClick={props.onCheckSavedStatus}>
              Check saved status
            </button>
          ) : null}
          {handoffPolicy?.canRestoreLocally &&
              props.onRestoreComparisonGuidance ? (
            <button type="button" className="six-secondary"
              disabled={props.disabled || !props.connected}
              onClick={props.onRestoreComparisonGuidance}>
              Restore comparison guidance
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="six-actions six-normal-flow-actions">
        <button
          type="button"
          className="six-secondary"
          disabled={props.disabled}
          onClick={props.onBack}
        >
          Back
        </button>
        <button
          type="button"
          className="six-secondary"
          disabled={props.disabled || !props.canCancel}
          onClick={props.onCancel}
        >
          Cancel unsaved edits
        </button>
        <button
          type="button"
          className="six-primary"
          disabled={props.disabled || !props.connected ||
            handoffPolicy?.blocksPrimarySubmit}
          onClick={props.onContinue}
        >
          {props.handoffTask?.stage === "saving"
            ? "Saving study and opening comparison guidance…"
            : props.handoffTask?.stage === "checking"
              ? "Checking saved handoff…"
              : "Continue to comparison guidance"}
        </button>
      </div>
    </section>
  );
}

function MethodOptionCard(props: {
  option: StudyDesignMethodOption;
  selected: boolean;
  disabled: boolean;
  selecting?: boolean;
  onSelect: (optionId: string) => void;
}) {
  const option = props.option;
  return (
    <article className="six-method-option" data-applicability={option.applicability}>
      <div className="six-method-option-heading">
        <div>
          <p className="six-kicker">Conditional method guidance</p>
          <h3>{option.label}</h3>
        </div>
        <span>{option.applicability.replaceAll("_", " ")}</span>
      </div>
      <section className="six-method-visible-section">
        <h4>Why this method</h4>
        <p>{option.whyThisAppears}</p>
      </section>
      <dl className="six-method-summary">
        <div><dt>Proposed contrast</dt><dd>{option.proposedContrast}</dd></div>
        <div><dt>Intended effect</dt><dd>{option.effectTarget}</dd></div>
      </dl>
      <section className="six-method-visible-section">
        <h4>Suggested specification</h4>
        {(option.modelRecipes ?? []).map((recipe) => (
          <article className="six-model-recipe" key={recipe.recipeId}>
            <div className="six-model-recipe-heading">
              <strong>{recipe.label}</strong>
              <span>{recipe.applicableDataStructure.replaceAll("_", " ")}</span>
            </div>
            <p className="six-equation" aria-label={recipe.accessibleDescription}>
              <code>{recipe.equationOrAlgorithm}</code>
            </p>
            <p>{recipe.accessibleDescription}</p>
            <dl className="six-symbol-definitions">
              {recipe.symbols.map((symbol) => (
                <div key={`${recipe.recipeId}-${symbol.symbol}`}>
                  <dt><code>{symbol.symbol}</code></dt>
                  <dd>{symbol.meaning}</dd>
                </div>
              ))}
            </dl>
            <p><strong>Effect represented:</strong> {recipe.targetEffect}</p>
          </article>
        ))}
      </section>
      {option.incompatibilities.length ? (
        <div className="six-alert six-alert--warning">
          <strong>Reported incompatibility</strong>
          <ul>{option.incompatibilities.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      ) : null}
      {option.unknowns.length ? (
        <div className="six-method-unknowns">
          <strong>Specific missing information</strong>
          <ul>{option.unknowns.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      ) : null}
      <section className="six-method-visible-section">
        <h4>Assumptions to examine</h4>
        <ul>{option.assumptions.map((item) => <li key={item}>{item}</li>)}</ul>
        <h4>Data requirements</h4>
        <ul>{option.dataNeeds.map((item) => <li key={item}>{item}</li>)}</ul>
        <h4>Estimator and inference considerations</h4>
        <ul>{option.inferenceNotes.map((item) => <li key={item}>{item}</li>)}</ul>
        {option.estimatorVariants.map((variant) => (
          <section key={variant.label} className="six-method-variant">
            <strong>{variant.label}</strong>
            <p>{variant.description}</p>
          </section>
        ))}
        {option.extensions.map((extension) => (
          <section key={extension.entryId} className="six-method-variant">
            <strong>{extension.label}</strong>
            <p>{extension.description}</p>
            <small>{extension.status.replaceAll("_", " ")}</small>
          </section>
        ))}
      </section>
      <details>
        <summary>Technical qualifications and sources</summary>
        <h4>Claims this guidance does not make</h4>
        <ul>{option.prohibitedClaims.map((item) => <li key={item}>{item}</li>)}</ul>
        <p><small>Primary method references: {option.referenceIds.join(", ")}</small></p>
      </details>
      <button
        type="button"
        className={props.selected ? "six-secondary" : "six-primary"}
        disabled={props.disabled || props.selected || props.selecting}
        aria-busy={props.selecting || undefined}
        onClick={() => props.onSelect(option.optionId)}
      >
        {props.selecting ? "Saving comparison…" : props.selected ? "Selected for review" : "Use this comparison for review"}
      </button>
    </article>
  );
}

export function StudyDesignAdvicePanel(props: {
  workspace: CausalComparisonWorkspace["studyFirst"];
  policyReview?: PolicyReview | null;
  policyTitle?: string | null;
  disabled: boolean;
  pendingSelectionId?: string | null;
  contextualizationBusy?: boolean;
  analysisRecoveryBlocked?: boolean;
  modelUnavailableReason?: string | null;
  modelAuthorizationDetails?: string | null;
  onContextualize?: () => void;
  /** Compatibility-only callback. The refinement UI is no longer rendered. */
  onRefine?: (clarifications: StudyDesignClarifications) => void;
  onDecide: (input: {
    decision: { mode: "selected"; optionId: string } | { mode: "no_selection" };
    rationale: string;
  }) => void;
  onEdit: () => void;
}) {
  const advice = props.workspace.advice;
  if (!advice || !props.workspace.entryContext || !props.workspace.timing) {
    return (
      <section className="six-card">
        <p className="six-kicker">Study-first advice unavailable</p>
        <h2>Return to Screen 2 to create the handoff</h2>
      </section>
    );
  }
  const echo = advice.proposalEcho;
  const selection = props.workspace.selection;
  const prioritizedWarnings = [...advice.warnings].sort((left, right) => {
    const severity = { substantive_incompatibility: 0, caution: 1, information: 2 };
    const basis = { reported_input_inconsistency: 0,
      documentary_design_concern: 1, empirical_requirement: 2 };
    return severity[left.severity] - severity[right.severity] ||
      basis[left.basis ?? "empirical_requirement"] -
        basis[right.basis ?? "empirical_requirement"];
  });
  const warningBasis = (value: typeof prioritizedWarnings[number]) =>
    value.basis === "reported_input_inconsistency" ? "Input inconsistency" :
    value.basis === "documentary_design_concern" ? "Source-informed concern" :
    "Needs empirical investigation";
  const contextualization = props.workspace.contextualization;
  const retryEligibility = contextualization && "retryEligibility" in contextualization
    ? contextualization.retryEligibility : "none";
  const critique = contextualization?.status === "completed" &&
    contextualization.supplement
    ? contextualization.supplement as Screen3ContextualCritique : null;
  const specificCritique = critique && isScreen3SpecificCritique(critique)
    ? critique : null;
  const legacyCritique = critique && !("schema_version" in critique)
    ? critique : null;
  const resultState = projectAnalysisResultState({
    currentArtifact: Boolean(critique),
    completedItems: critique?.concerns.length ?? 0,
    completedWithNoAdditionalItems: Boolean(critique &&
      critique.concerns.length === 0),
    rawReceipt: contextualization?.status === "receipt_saved" ||
      contextualization?.status === "validation_failed",
    phase: props.contextualizationBusy ||
      contextualization?.status === "pending" &&
        contextualization.dispatchState === "dispatched" ? "running" :
      contextualization?.status === "pending" ? "preparing" : "not_started",
    failure: contextualization?.status === "outcome_unknown"
      ? "outcome_unknown" : contextualization?.status === "failed"
        ? contextualization.dispatchState === "not_dispatched"
          ? "before_dispatch"
          : contextualization.dispatchState === "dispatched"
            ? "provider_rejected" : "outcome_unknown" : null,
    configurationAvailable: !props.modelUnavailableReason,
  });
  const designStatus = props.analysisRecoveryBlocked
    ? "Saved analysis requires local recovery."
    : resultState === "running" || resultState === "preparing"
      ? "Reviewing your policy and proposed comparison…"
      : contextualization?.status === "validation_failed"
        ? "The saved response needs a local recheck."
        : resultState === "receipt_saved"
          ? "Response received; local processing is pending."
          : resultState === "outcome_unknown"
            ? "The provider outcome is unknown. Check the saved task status before another request."
            : resultState === "configuration_unavailable"
              ? "Study-specific assessment is unavailable until the local model is configured."
              : resultState === "provider_rejected"
                ? "The assessment request was rejected."
                : resultState === "failed_before_dispatch"
                  ? "The assessment stopped before dispatch."
                  : null;
  const claimById = new Map((props.policyReview?.claims ?? []).map((claim) =>
    [claim.claimId, claim]));
  const readerConcern = (value: string) => value
    .replace(/\bnot_researched\b/gu, "not yet researched")
    .replace(/\bwaiting_source\b/gu, "waiting for more source evidence")
    .replace(/\bnot_yet_searched\b/gu, "not yet searched");
  const inputLabels: Record<string, string> = {
    population: "Study population", analysisUnit: "Observation unit",
    geography: "Study geography", industry: "Industry",
    period: "Study period", outcome: "Outcome",
    outcomeMeasure: "Outcome measure",
    policySideConcept: "Theoretical construct of the shock",
    initialExplanation: "Proposed pathway",
    question: "Earlier question wording",
    proposedTreatment: "Proposed affected group",
    proposedComparison: "Proposed comparison group",
    resultsPreviouslyInspected: "Earlier results disclosure",
    timing: "Proposed treatment timing",
    clarifications: "Method clarifications",
  };
  function sourceReferences(referencedIds: string[]) {
    const groups = new Map<string, {
      key: string;
      documentVersionId: string;
      sourceId: string;
      title: string;
      url: string;
      date: string | null | undefined;
      version: string | null | undefined;
      claims: Array<{
        key: string;
        claimId: string;
        passageId: string;
        locator: string;
        exactText: string;
        support: PolicyReview["claims"][number]["supportStatus"];
        qualification: string | null;
        proposition: string;
      }>;
    }>();
    const seenClaims = new Set<string>();
    for (const id of referencedIds) {
      if (seenClaims.has(id)) continue;
      seenClaims.add(id);
      const claim = claimById.get(id);
      if (!claim) continue;
      const source = claim.citation;
      const key = source.documentVersionId || [
        source.sourceId,
        source.versionLabel ?? "unlabelled-version",
        source.canonicalUrl,
      ].join("|");
      const existing = groups.get(key) ?? {
        key,
        documentVersionId: source.documentVersionId,
        sourceId: source.sourceId,
        title: source.sourceTitle,
        url: source.canonicalUrl,
        date: source.publicationDate,
        version: source.versionLabel,
        claims: [],
      };
      existing.claims.push({
        key: `${id}:${source.passageId}`,
        claimId: id,
        passageId: source.passageId,
        locator: source.locator,
        exactText: source.exactText,
        support: claim.supportStatus,
        qualification: claim.qualification,
        proposition: claim.statement,
      });
      groups.set(key, existing);
    }
    return [...groups.values()];
  }
  function sourceGroupDetails(
    sources: ReturnType<typeof sourceReferences>,
  ) {
    return sources.map((source) => (
      <section className="six-design-source-group" key={source.key}>
        <div className="six-design-source-heading">
          {/^https?:\/\//iu.test(source.url)
            ? <a href={source.url} target="_blank" rel="noreferrer">
                {source.title}
              </a>
            : <strong>{source.title}</strong>}
          <small>
            {[source.date, source.version].filter(Boolean).join(" · ") ||
              "Saved document version"}
          </small>
        </div>
        <ul>
          {source.claims.map((claim) => (
            <li key={claim.key}>
              <p>{claim.proposition}</p>
              <small>
                {claim.support.replaceAll("_", " ")} support
                {claim.qualification ? ` · ${claim.qualification}` : ""}
              </small>
              <details>
                <summary>Passage and saved identifiers</summary>
                <blockquote>{claim.exactText}</blockquote>
                <p>
                  {/^https?:\/\//iu.test(claim.locator)
                    ? <a href={claim.locator} target="_blank" rel="noreferrer">
                        Open cited passage
                      </a>
                    : <>Locator: {claim.locator}</>}
                  {" · "}Claim {claim.claimId} · passage {claim.passageId}
                </p>
              </details>
            </li>
          ))}
        </ul>
      </section>
    ));
  }
  function namedResearcherInputs(fields: string[]) {
    return [...new Set(fields.flatMap((field) =>
      inputLabels[field] ? [inputLabels[field]] : []))];
  }
  function concernCard(item: typeof prioritizedWarnings[number]) {
    const sources = sourceReferences(item.triggerEvidenceRefs);
    const fieldKeys = item.triggerInputRefs.map((value) =>
      value.startsWith("proposedTiming.")
        ? "timing" : value.startsWith("clarifications.")
          ? "clarifications" : value.replace(/^study\./u, "").split(".")[0]!);
    const namedInputs = namedResearcherInputs(fieldKeys);
    return (
      <article key={item.warningId} className="six-design-concern">
        <div className="six-design-concern-heading">
          <h4>{item.message}</h4>
          <span className="six-design-concern-badge">{warningBasis(item)}</span>
        </div>
        <p>{readerConcern(item.whyItMatters)}</p>
        <p><strong>Next step.</strong> {item.whatToCheck}</p>
        {(sources.length || namedInputs.length || item.methodReferenceIds.length) ? (
          <details className="six-design-concern-basis">
            <summary>Proposal basis, sources and method references</summary>
            {namedInputs.length ? <p>Researcher proposal: {namedInputs.join(", ")}</p> : null}
            {sources.length ? <div className="six-design-source-groups">
              {sourceGroupDetails(sources)}
            </div> : null}
          {item.methodReferenceIds.length ? (
            <p><strong>Method references.</strong> {item.methodReferenceIds.join(", ")}</p>
          ) : null}
          </details>
        ) : null}
      </article>
    );
  }
  function critiqueCard(input: { id: string; heading: string;
    fact: string; implication: string; question: string; check: string;
    limit: string | null; priority: string | null;
    priorityReason: string | null; claimIds: string[]; fields: string[];
  }) {
    const sources = sourceReferences(input.claimIds);
    const namedInputs = namedResearcherInputs(input.fields);
    return <article key={input.id} className="six-design-concern six-design-specific-issue">
      <div className="six-design-concern-heading">
        <h4>{input.heading}</h4>
        {input.priority ? <span className="six-design-concern-badge">
          {input.priority} priority</span> : null}
      </div>
      <p><strong>Relevant fact or proposal.</strong> {input.fact}</p>
      <p>{input.implication}</p>
      <p><strong>Open question.</strong> {input.question}</p>
      <p><strong>Next check.</strong> {input.check}</p>
      {input.limit ? <p className="six-design-check-limit">
        <strong>What this cannot establish.</strong> {input.limit}</p> : null}
      {(sources.length || namedInputs.length || input.priorityReason) ? (
        <details>
          <summary>Basis, sources and priority</summary>
          {namedInputs.length ? <p>Researcher proposal: {namedInputs.join(", ")}</p> : null}
          {input.priorityReason ? <p>Priority: {input.priorityReason}</p> : null}
          {sources.length ? <div className="six-design-source-groups">
            {sourceGroupDetails(sources)}
          </div> : null}
        </details>
      ) : null}
    </article>;
  }
  function decide(decision: {
    mode: "selected"; optionId: string;
  } | { mode: "no_selection" }) {
    const option = decision.mode === "selected"
      ? props.workspace.advice?.options.find(({ optionId }) =>
          optionId === decision.optionId)
      : null;
    props.onDecide({
      decision,
      rationale: option
        ? `Selected ${option.label} from the current conditional guidance.`
        : "No comparison method was selected at this stage.",
    });
  }
  return (
    <section className="six-card six-study-design-advice">
      <div className="six-card-heading">
        <div>
          <p className="six-kicker">Your proposed design</p>
          <h2>Suggested Approach</h2>
        </div>
      </div>
      <div className="six-study-context-strip">
        <div><span>Outcome</span><strong>{echo.outcome}{echo.outcomeMeasure ? ` · ${echo.outcomeMeasure}` : ""}</strong></div>
        <div><span>Observation unit</span><strong>{echo.analysisUnit ?? "Undecided"}</strong></div>
        <div><span>Study period</span><strong>{echo.period.start ?? "?"}–{echo.period.end ?? "?"}</strong></div>
        <div><span>Proposed timing</span><strong>{echo.timing.mode === "year"
          ? echo.timing.year
          : echo.timing.mode === "varies_by_group"
            ? "Different groups may first experience the shock in different years"
            : echo.timing.mode.replaceAll("_", " ")}</strong></div>
      </div>
      <section className="six-proposed-comparison">
        <div>
          <p className="six-kicker">Your proposed comparison</p>
          <h3>{echo.proposedTreatment ?? "Affected group undecided"} <span>vs.</span> {echo.proposedComparison ?? "comparison group undecided"}</h3>
          {echo.initialExplanation ?? echo.question ? (
            <p><strong>Proposed pathway:</strong> {echo.initialExplanation ?? echo.question}</p>
          ) : null}
        </div>
        <button type="button" className="six-secondary" onClick={props.onEdit}>
          Edit study details
        </button>
      </section>
      <section id="screen3-study-specific-assessment" className="six-study-warnings six-study-specific-result"
        data-result-state={resultState} aria-label="Study-specific design assessment">
        <p className="six-kicker">Research design assessment</p>
        <h3>Study-specific design assessment</h3>
        {designStatus ? <p role="status" className="six-design-result-status">
          {designStatus}
        </p> : null}
        {props.analysisRecoveryBlocked ? (
          <p className="six-readonly-note" role="status">Saved optional
            analysis needs local recovery. Earlier response and usage were
            preserved; no new model request will be sent. Other saved study
            information remains readable.</p>
        ) : null}
        {!critique && (!contextualization || retryEligibility === "new_request" ||
            retryEligibility === "local_revalidation" || contextualization.status === "outcome_unknown") && props.onContextualize &&
            !props.analysisRecoveryBlocked ? (
          <div className="six-contextual-action">
            {retryEligibility === "local_revalidation" ||
                !props.modelUnavailableReason ? (
              <button type="button" className="six-primary"
                disabled={props.disabled || props.contextualizationBusy}
                onClick={() => props.onContextualize?.()}>
                {retryEligibility === "local_revalidation"
                  ? "Recheck saved response"
                  : contextualization && contextualization.status !== "outcome_unknown"
                    ? "Generate study-specific assessment (new attempt)"
                    : "Generate study-specific assessment"}
              </button>
            ) : null}
            <ProcessingStatus
              active={Boolean(props.contextualizationBusy)}
              stage="Reviewing study design…"
            />
            {retryEligibility === "local_revalidation" ? (
              <small>Checks the saved response locally; no new model request.</small>
            ) : props.modelUnavailableReason ? (
              <small>{props.modelUnavailableReason}</small>
            ) : props.modelAuthorizationDetails ? (
              <details><summary>Request scope</summary>
                <p>{props.modelAuthorizationDetails}</p></details>
            ) : null}
          </div>
        ) : null}
        {contextualization?.error &&
            ["failed", "validation_failed", "outcome_unknown"]
              .includes(contextualization.status) ? (
          <details className="six-design-task-error">
            <summary>Why the assessment stopped</summary>
            <p>{contextualization.error}</p>
          </details>
        ) : null}
        {specificCritique ? <section className="six-design-framework-checks"
          aria-label="API-authored six-dimension design assessment">
          <div className="six-model-assessment-heading">
            <p className="six-kicker">Study-specific assessment</p>
            <h4>Six structured checks to carry into the design</h4>
          </div>
          <div className="six-design-assessment-grid">
            {specificCritique.concerns.map((item) => {
              const sources = sourceReferences(item.documentary_claim_ids);
              const namedInputs = namedResearcherInputs(
                item.researcher_input_fields,
              );
              return <article key={item.issue_id}
                className="six-design-assessment-item">
                <div>
                  <h4>{item.specific_heading}</h4>
                </div>
                <p><strong>Assessment.</strong>{" "}
                  {item.relevant_fact_or_proposal} {item.why_it_matters}</p>
                <p><strong>What to check next.</strong> {item.next_check}</p>
                <details>
                  <summary>Open question, limit, and basis</summary>
                  <p><strong>Open question.</strong> {item.unresolved_question}</p>
                  <p><strong>What the check cannot establish.</strong>{" "}
                    {item.check_limit}</p>
                  <p><strong>Priority.</strong> {item.priority} ·{" "}
                    {item.priority_reason}</p>
                  {namedInputs.length ? <p>Researcher proposal: {namedInputs.join(", ")}</p> : null}
                  {sources.length ? <div className="six-design-source-groups">
                    {sourceGroupDetails(sources)}
                  </div> : null}
                </details>
              </article>;
            })}
          </div>
        </section> : null}
        {legacyCritique ? <>
          <p className="six-readonly-note">Earlier saved assessment. The original
            issue categories and source limits are preserved.</p>
          {legacyCritique.concerns.map((item) => critiqueCard({
            id: item.rule_id, heading: item.unresolved_question,
            fact: item.known_from_sources,
            implication: item.study_specific_reason,
            question: item.unresolved_question,
            check: item.next_check, limit: null,
            priority: null, priorityReason: null,
            claimIds: item.documentary_claim_ids ?? [],
            fields: item.researcher_input_fields ?? [],
          }))}
        </> : null}
        {critique ? <p className="six-readonly-note"><strong>Interpretation limit.</strong>{" "}
          {critique.synthesis_limit}</p> : null}
      </section>
      <details className="six-study-warnings six-general-design-checks">
        <summary>Method assumptions and next checks ({prioritizedWarnings.length})</summary>
        <p>These are rule-based checks triggered by the study details you
          entered. They flag assumptions or missing evidence to examine; they
          are not test results and do not declare the design valid or invalid.</p>
        {prioritizedWarnings.length
          ? prioritizedWarnings.map(concernCard)
          : <p>No general check was triggered by the saved proposal.</p>}
      </details>
      <div className="six-method-options">
        {advice.options.length ? advice.options.map((option) => (
          <MethodOptionCard
            key={option.optionId}
            option={option}
            selected={selection?.decision.mode === "selected" && selection.decision.optionId === option.optionId}
            disabled={props.disabled}
            selecting={props.pendingSelectionId === option.optionId}
            onSelect={(optionId) => decide({ mode: "selected", optionId })}
          />
        )) : (
          <div className="six-method-empty-state">
            <strong>Comparison choice remains open</strong>
            <p>Add affected and comparison groups—or a complete cutoff rule—if
              you want method-specific options. You can continue reviewing the
              shock and return to this choice later.</p>
          </div>
        )}
      </div>
      {!selection ? (
        <section className="six-method-decision">
          <button type="button" className="six-secondary" disabled={props.disabled} onClick={() => decide({ mode: "no_selection" })}>Retain no selection</button>
        </section>
      ) : <p className="six-decision-saved">Researcher decision saved: {selection.decision.mode.replaceAll("_", " ")}. No assumption was certified.</p>}
      <details className="six-method-provenance">
        <summary>Method-library scope and provenance</summary>
        <p>{advice.execution.disclosure}</p>
        <p>Library {props.workspace.methodLibraryVersion}. Enabled: common/staggered DiD, dynamic/subgroup extensions, sharp/fuzzy RD. Deferred: triple differences and synthetic control.</p>
      </details>
    </section>
  );
}

export function StudyFirstEventInvestigationPanel(props: {
  workspace: StudyFirstEventInvestigationWorkspace;
  disabled?: boolean;
  sourceBusy?: boolean;
  onResumeSource?: () => void | Promise<void>;
  refreshAvailable?: boolean;
  refreshBusy?: boolean;
  onRefresh?: () => void | Promise<void>;
  interpretationBusy?: boolean;
  analysisRecoveryBlocked?: boolean;
  onAnalyze?: () => void | Promise<void>;
  hostEntries?: StudyFirstHostEntries;
  hostNotices?: Record<string, string | undefined>;
}) {
  const investigation = props.workspace.investigation;
  const discoveryTask = props.workspace.discoveryTask;
  const queue = props.workspace.interpretationQueue;
  const presentation = investigation?.presentation;
  const occurrencesById = new Map(
    (props.workspace.documentedOccurrences ?? []).map((occurrence) =>
      [occurrence.id, occurrence] as const),
  );
  for (const occurrence of investigation?.occurrences ?? []) {
    occurrencesById.set(occurrence.id, occurrence);
  }
  // Presentation ordering remains first, while durable step checkpoints stay
  // visible before optional screening or presentation construction finishes.
  const visibleIds = presentation
    ? [...presentation.visibleEventIds]
    : [...occurrencesById.keys()];
  const candidateEvents = visibleIds.flatMap((id) => {
    const occurrence = occurrencesById.get(id);
    const analysis = investigation?.analyses.find((item) => item.eventId === id);
    if (!occurrence) return [];
    const eventFingerprint = fingerprintSixScreenValue({
      occurrenceFingerprint: occurrence.candidateFingerprint,
      analysisFingerprint: analysis?.analysisFingerprint ?? null,
    });
    const hostKey = studyFirstHostEntryKey(
      SCREEN04_STUDY_EVENT_ASSESSMENT_TASK,
      occurrence.id,
    );
    const hostEntry = props.hostEntries?.[hostKey];
    const hostResult = hostEntry &&
        hostEntry.coordinates.expectedEventFingerprint === eventFingerprint
      ? studyFirstHostResult(
          SCREEN04_STUDY_EVENT_ASSESSMENT_TASK,
          hostEntry.task.result,
        )
      : null;
    return [{
      occurrence,
      analysis,
      eventFingerprint,
      hostKey,
      hostResult,
    }];
  });
  // Older saved scans can contain separate publication/effective records for
  // the same named action. Consolidate those exact-title duplicates in the
  // current display while refreshed v3 scans merge their evidence upstream.
  const displayEventsByKey = new Map<string, typeof candidateEvents[number]>();
  for (const event of candidateEvents) {
    const titleKey = event.occurrence.title.toLocaleLowerCase("en-US")
      .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    const key = titleKey || event.occurrence.id;
    const existing = displayEventsByKey.get(key);
    if (!existing) {
      displayEventsByKey.set(key, event);
      continue;
    }
    const existingAssessed = queue?.results.some(({ eventId }) =>
      eventId === existing.occurrence.id) ?? false;
    const nextAssessed = queue?.results.some(({ eventId }) =>
      eventId === event.occurrence.id) ?? false;
    if ((!existingAssessed && nextAssessed) ||
        (!existing.analysis && event.analysis) ||
        event.occurrence.evidence.length > existing.occurrence.evidence.length) {
      displayEventsByKey.set(key, event);
    }
  }
  const visibleEvents = [...displayEventsByKey.values()];
  const consolidatedDisplayCount = candidateEvents.length - visibleEvents.length;
  const assessedEventIds = new Set(visibleEvents.flatMap(({ occurrence }) =>
    queue?.results.some(({ eventId }) => eventId === occurrence.id)
      ? [occurrence.id] : []));
  const assessedCount = assessedEventIds.size;
  const pendingCount = visibleEvents.length - assessedCount;
  const historicalHostEvents = candidateEvents.filter(({ hostResult }) =>
    Boolean(hostResult));
  const displayedIds = visibleEvents.map(({ occurrence }) =>
    occurrence.id);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    displayedIds[0] ?? null,
  );
  useEffect(() => {
    if (!selectedEventId || !displayedIds.includes(selectedEventId)) {
      setSelectedEventId(displayedIds[0] ?? null);
    }
  }, [selectedEventId, displayedIds.join("\u0000")]);
  if (!investigation) {
    return (
      <section className="six-card">
        <p className="six-kicker">Automatic bounded scan</p>
        <h2>Preparing the study-first event investigation</h2>
        <p>The saved study context remains intact. No event or no-event conclusion has been recorded.</p>
        <ProcessingStatus
          active={Boolean(props.sourceBusy)}
          stage="Still searching for other events"
        />
        {props.sourceBusy ? <p>If interrupted, the search can resume from its
          saved checkpoint.</p> : null}
        {props.analysisRecoveryBlocked ? <p role="status">Saved optional
          analysis needs local recovery; earlier response and usage were
          preserved. No new request will be sent.</p> : null}
      </section>
    );
  }
  const selected = visibleEvents.find(({ occurrence }) =>
    occurrence.id === selectedEventId) ?? visibleEvents[0] ?? null;
  const selectedResult = queue?.results.find(({ eventId }) =>
    eventId === selected?.occurrence.id) ?? null;
  const resultSourceLinks = selectedResult?.sourceIds.flatMap((sourceId) => {
    const evidence = selected?.occurrence.evidence.find((source) =>
      source.sourceId === sourceId);
    return evidence ? [evidence] : [];
  }) ?? [];
  const sourceAttempts = investigation.attempts.filter((item) =>
    item.providerId && item.usage.sourceQueries > 0);
  const queryCount = discoveryTask?.queryCount ??
    investigation.attempts.reduce((sum, item) =>
      sum + item.usage.sourceQueries, 0);
  const documentCount = discoveryTask?.documentCount ??
    investigation.attempts.reduce((sum, item) =>
      sum + (item.usage.documentAttempts ?? 0), 0);
  const sourceRoutes = [...new Set(sourceAttempts.map((item) =>
    item.providerId))];
  const sourceAction = discoveryTask?.nextAction === "start" ||
      discoveryTask?.nextAction === "resume"
    ? {
        label: discoveryTask.stage === "local_processing" ||
            discoveryTask.stage === "artifact_storage"
          ? "Finish source results"
          : discoveryTask.nextAction === "start"
            ? "Find alternative shocks"
            : "Resume source scan",
      }
    : null;
  const sourceTaskHeading = discoveryTask?.state === "not_started"
    ? "Source scan ready"
    : discoveryTask?.state === "preparing"
      ? "Preparing saved source work"
      : discoveryTask?.state === "active"
        ? "Source step active"
        : discoveryTask?.state === "partial" &&
            discoveryTask.stage === "local_processing"
          ? "Source steps saved; finish locally"
          : discoveryTask?.state === "partial"
            ? "Partial source coverage saved"
            : discoveryTask?.state === "complete" ||
                discoveryTask?.state === "complete_zero"
              ? "Saved source result ready"
              : discoveryTask?.state === "failed"
                ? "Source discovery stopped"
                : discoveryTask?.state === "outcome_unknown"
                  ? "Source outcome unknown"
                  : discoveryTask?.state === "outdated"
                    ? "Saved source task outdated"
                    : "Source discovery task";
  const sourceTaskDetail = discoveryTask?.state === "not_started"
    ? "One click runs the bounded source plan. Any retained alternative shocks appear before study-specific assessment."
    : discoveryTask?.state === "active"
      ? "A saved lease is active; reopening does not dispatch another search."
      : discoveryTask?.state === "outcome_unknown"
        ? "Do not resend. Reconcile the saved lease; retained records stay visible."
        : discoveryTask?.state === "outdated"
          ? "This task is outdated. Its records remain historical, not current."
          : discoveryTask?.state === "failed" &&
              discoveryTask.nextAction !== "resume"
            ? "This task cannot resume safely. Records and the stop reason remain."
            : "One click completes the remaining bounded source plan from its saved checkpoint. It does not call ChatGPT.";
  const sourceTaskVisible = Boolean(discoveryTask &&
    (investigation.status === "planned" || props.sourceBusy));
  const documentedText = (
    event: typeof visibleEvents[number],
  ) => event.analysis?.whatHappened || event.occurrence.description ||
    event.occurrence.evidence.map(({ factText }) => factText).find(Boolean) ||
    "The source documents this occurrence; general screening is pending.";
  const eventDates = (event: typeof visibleEvents[number]) => {
    if (event.analysis) {
      return {
        publication: event.analysis.documentEventDistinction.publicationDate,
        occurrence: event.analysis.documentEventDistinction.substantiveOccurrenceDate,
      };
    }
    const publication = event.occurrence.typedDates.find(({ kind }) =>
      kind === "publication")?.value ?? event.occurrence.evidence.find(
      ({ publishedDate }) => Boolean(publishedDate))?.publishedDate ?? null;
    const occurrence = event.occurrence.typedDates.find(({ kind }) =>
      ["incident_start", "effective", "event"].includes(kind))?.value ?? null;
    return { publication, occurrence };
  };
  return (
    <section className="six-card six-study-first-events">
      <div className="six-card-heading">
        <div>
          <p className="six-kicker">Study-first event investigation</p>
          <h2>Check other events</h2>
          <p>Review source-documented events that could provide competing
            explanations for the study outcome.</p>
        </div>
      </div>
      <dl className="six-event-scope-strip">
        <div><dt>Population</dt><dd>{investigation.context.study.population}</dd></div>
        <div><dt>Window</dt><dd>{investigation.context.effectiveScope.occurrenceStart}–{investigation.context.effectiveScope.occurrenceEnd}</dd></div>
        <div><dt>Groups</dt><dd>{investigation.context.groupsPresent ? `${investigation.context.study.proposedTreatment} vs. ${investigation.context.study.proposedComparison}` : "No complete comparison pair supplied"}</dd></div>
        <div>
          <dt>Relevance</dt>
          <dd>
            {visibleEvents.length
              ? `${assessedCount} of ${visibleEvents.length} events assessed`
              : "No event ready for assessment"}
          </dd>
        </div>
      </dl>
      <details className="six-study-context-details">
        <summary>Full saved study context used for this assessment</summary>
        <dl>
          <div><dt>Observation unit</dt><dd>{investigation.context.study.analysisUnit ?? "Explicitly unspecified"}</dd></div>
          <div><dt>Industry or activity</dt><dd>{investigation.context.study.industry?.join(", ") || "Explicitly unspecified"}</dd></div>
          <div><dt>Geography</dt><dd>{investigation.context.study.geography?.join(", ") || "Explicitly unspecified"}</dd></div>
          <div><dt>Outcome concept</dt><dd>{investigation.context.study.outcome}</dd></div>
          <div><dt>Outcome measure</dt><dd>{investigation.context.study.outcomeMeasure ?? "Explicitly unspecified"}</dd></div>
          <div><dt>Theoretical construct of the shock</dt><dd>{investigation.context.study.policySideConcept ?? "Not specified"}</dd></div>
          <div><dt>Researcher explanation</dt><dd>{investigation.context.study.initialExplanation ?? "Explicitly blank"}</dd></div>
          <div><dt>Proposed timing</dt><dd>{investigation.context.timing?.mode === "year"
            ? `${investigation.context.timing.year} (${investigation.context.timing.precision} precision)`
            : investigation.context.timing?.mode === "varies_by_group"
              ? "Different groups may first experience the shock in different years"
              : investigation.context.timing?.mode.replaceAll("_", " ") ?? "Unresolved"}</dd></div>
          <div><dt>Method choice</dt><dd>{investigation.context.methodSelection?.decision.mode === "selected" ? investigation.context.methodSelection.decision.optionId : investigation.context.methodSelection ? "No method selected" : "Not supplied"}</dd></div>
          <div><dt>Prior-results disclosure</dt><dd>{investigation.context.study.resultsPreviouslyInspected?.replaceAll("_", " ") ?? "not disclosed"}</dd></div>
        </dl>
      </details>
      {props.refreshAvailable && props.onRefresh ? (
        <section className="six-event-refresh" aria-label="Refresh source discovery">
          <div>
            <h3>Expanded source search available</h3>
            <p>This saved search used an earlier source route. Refresh starts the
              current bounded plan and retains the earlier result in history.
              One click completes its bounded saved steps.</p>
          </div>
          <button type="button" className="six-secondary"
            disabled={props.disabled || props.refreshBusy}
            onClick={() => void props.onRefresh?.()}>
            {props.refreshBusy ? "Refreshing other-event search…" :
              "Refresh other-event search"}
          </button>
          <ProcessingStatus
            active={Boolean(props.refreshBusy)}
            stage="Refreshing official event sources…"
          />
        </section>
      ) : null}
      {sourceTaskVisible ? (
        <section className="six-event-source-task" aria-label="Source discovery task"
          aria-busy={props.sourceBusy || undefined}>
          <div>
            <h3>{sourceTaskHeading}</h3>
            <p>{sourceTaskDetail}</p>
            {discoveryTask ? <p className="six-event-source-facts">
              <strong>{discoveryTask.completedStepCount} of{" "}
                {discoveryTask.totalStepCount} source steps saved</strong>
              {" · "}{discoveryTask.pendingStepCount} pending · {queryCount}{" "}
              quer{queryCount === 1 ? "y" : "ies"} · {documentCount}{" "}
              document fetch{documentCount === 1 ? "" : "es"} ·{" "}
              {discoveryTask.recordsAccepted} record
              {discoveryTask.recordsAccepted === 1 ? "" : "s"} retained
            </p> : null}
            {!props.sourceBusy && discoveryTask?.nextAction === "observe"
              ? <p role="status">No new source request is available while this
                saved operation is being observed.</p> : null}
            {discoveryTask ? <p className="six-readonly-note">
              {discoveryTask.continuationDisclosure}</p> : null}
            {discoveryTask?.stopReason ? <details>
              <summary>Saved stop reason</summary>
              <p>{discoveryTask.stopReason}</p>
            </details> : null}
          </div>
          {sourceAction && props.onResumeSource ? <button type="button"
            className="six-primary"
            disabled={props.disabled || props.sourceBusy}
            onClick={() => void props.onResumeSource?.()}>
            {props.sourceBusy ? "Finishing source scan…" :
              sourceAction.label}
          </button> : null}
          <ProcessingStatus
            active={Boolean(props.sourceBusy)}
            stage="Searching official event sources…"
            completedCount={discoveryTask?.completedStepCount}
            totalCount={discoveryTask?.totalStepCount}
          />
        </section>
      ) : null}
      {props.analysisRecoveryBlocked && !visibleEvents.length ? (
        <p role="status">Saved optional analysis needs local recovery;
          earlier response and usage were preserved. No new request will
          be sent.</p>
      ) : null}
      {visibleEvents.length && queue && props.onAnalyze &&
          queue.status !== "completed" ? (
        <section id="screen4-relevance" className="six-host-assessment six-host-assessment--queue"
          aria-label="Study-specific event assessment">
          <div>
            {props.analysisRecoveryBlocked ? (
              <p role="status">Saved optional analysis needs local recovery;
                earlier response and usage were preserved. No new request will
                be sent. The documented event records remain readable below.</p>
            ) : null}
            <h3>Study-specific event assessment</h3>
            <p>
              {assessedCount
                  ? `${assessedCount} of ${visibleEvents.length} assessments are saved. One action completes the remaining assessments. All source-documented shocks remain visible below.`
                  : `Generate one study-specific assessment for each of the ${visibleEvents.length} source-documented shocks shown below. ChatGPT will add the three assessment sections to every card.`}
            </p>
            {queue.readiness.blocker && (queue.status === "ready" ||
                queue.retryEligibility === "new_request") ? (
              <p className="six-event-task-blocker">
                {queue.readiness.blocker}</p>
            ) : null}
            {queue.status === "in_progress" || props.interpretationBusy ? (
              <p role="status">Assessing event relevance… {assessedCount} of{" "}
                {visibleEvents.length} saved. Source-documented shocks remain
                visible while assessments are completed.</p>
            ) : null}
            {queue.status === "partial" ? (
              <p role="status">{assessedCount} saved assessments remain
                available. {queue.retryEligibility === "observe"
                  ? "The remaining task is being reconciled; no duplicate request is sent."
                  : queue.retryEligibility === "local_revalidation"
                    ? "The saved response can be checked locally."
                    : "Use the assessment action once to complete the remaining bounded queue."}</p>
            ) : null}
            {queue.status === "outcome_unknown" ? (
              <p role="status">The provider outcome is unknown. Reconcile
                this saved attempt before authorizing another request.</p>
            ) : null}
            {queue.status === "validation_failed" ? (
              <p role="status">A provider response was saved but its
                interpretation did not pass local validation.</p>
            ) : null}
            {queue.status === "failed" ? (
              <p role="alert">Assessment stopped with {pendingCount} event
                {pendingCount === 1 ? "" : "s"} pending. Linked source records
                and saved assessments remain available below.</p>
            ) : null}
            {queue.error ? <details>
              <summary>Interpretation task details</summary>
              <p>{queue.error}</p>
            </details> : null}
          </div>
          {queue.status === "ready" ||
              ["new_request", "local_revalidation"].includes(
                queue.retryEligibility) ? (
            <button type="button" className="six-primary"
              disabled={props.disabled || props.analysisRecoveryBlocked ||
                props.interpretationBusy ||
                (queue.retryEligibility !== "local_revalidation" &&
                  !queue.readiness.canDispatch)}
              onClick={() => void props.onAnalyze?.()}>
              {props.interpretationBusy ? "Assessing event relevance…" :
                queue.retryEligibility === "local_revalidation"
                  ? "Recheck saved event response" :
                    "Assess relevance to my study"}
            </button>
          ) : null}
          <ProcessingStatus
            active={Boolean(props.interpretationBusy)}
            stage="Assessing event relevance…"
            completedCount={assessedCount}
            totalCount={visibleEvents.length}
          />
          {queue.retryEligibility === "local_revalidation" ? (
            <small>Uses the saved response locally; no new provider request
              is sent.</small>
          ) : null}
        </section>
      ) : null}
      {!visibleEvents.length && presentation?.status === "scan_failed" ? (
        <section className="six-event-empty-state">
          <h3>The scan could not be completed</h3>
          <p>No planned structured source route completed successfully. This differs from a completed zero-event result.</p>
        </section>
      ) : !visibleEvents.length && presentation?.status === "completed_zero_events" ? (
        <section className="six-event-empty-state">
          <h3>No display-ready event was found in this bounded scan</h3>
          <p>This result covers only the displayed period, branches, and effective source routes. It does not establish that no relevant event exists.</p>
        </section>
      ) : visibleEvents.length ? (
        <div className="six-event-investigation-layout">
          <section className="six-event-list" aria-label="Alternative shocks">
            <h3>Alternative shocks</h3>
            {visibleEvents.map((event) => {
              const { occurrence } = event;
              const dates = eventDates(event);
              const assessed = assessedEventIds.has(occurrence.id);
              return <button
                  type="button"
                  key={occurrence.id}
                  className={occurrence.id === selected?.occurrence.id ? "is-selected" : ""}
                  aria-pressed={occurrence.id === selected?.occurrence.id}
                  onClick={() => setSelectedEventId(occurrence.id)}
                >
                  <strong>{occurrence.title}</strong>
                  <span>
                    {dates.occurrence
                      ? `${occurrence.typedDates.some(({ kind }) => kind === "incident_start")
                        ? "Incident began" : occurrence.providerId === "govinfo" &&
                          occurrence.eventFamily === "Federal statute"
                          ? "Enacted/approved" : occurrence.typedDates.some(
                            ({ kind }) => kind === "effective")
                            ? "Effective" : "Event dated"} ${dates.occurrence}${dates.publication ? ` · published ${dates.publication}` : ""}`
                      : dates.publication
                        ? `Published ${dates.publication} · occurrence date unresolved`
                        : "Date not established"}
                  </span>
                  <small>
                    {assessed
                      ? "Reviewed"
                      : "Source documented · assessment pending"}
                  </small>
                </button>;
            })}
            {presentation?.overflowEventIds.length ? (
              <p className="six-readonly-note">
                {presentation.overflowEventIds.length} additional deduplicated occurrence{presentation.overflowEventIds.length === 1 ? " is" : "s are"} retained outside the ten-event display ceiling.
              </p>
            ) : null}
            {consolidatedDisplayCount ? (
              <p className="six-readonly-note">{consolidatedDisplayCount}{" "}related source record{consolidatedDisplayCount === 1 ? " was" : "s were"} consolidated with an exact-title event in this view.</p>
            ) : null}
          </section>
          {selected ? (
            <article className="six-event-inspector">
              <div className="six-event-inspector-heading">
                <div>
                  <p className="six-kicker">Source-documented alternative shock</p>
                  <h3>{selected.occurrence.title}</h3>
                </div>
                {!selectedResult ? <span>Assessment pending</span> : null}
              </div>
              <section className="six-event-source-preview">
                <h4>Source record</h4>
                <p>{documentedText(selected)}</p>
                <dl className="six-event-date-roles">
                  <div><dt>Publication</dt><dd>{eventDates(selected).publication ?? "Not documented"}</dd></div>
                  <div><dt>{selected.occurrence.providerId === "govinfo" &&
                    selected.occurrence.eventFamily === "Federal statute"
                    ? "Enactment/approval" : "Substantive occurrence"}</dt><dd>{eventDates(selected).occurrence ?? "Not established by this record"}</dd></div>
                </dl>
                <p className="six-inline-citations">
                  Sources: {selected.occurrence.evidence.map((source) => (
                    <a key={`${source.sourceId}-${source.locator}`}
                      href={source.locator} target="_blank" rel="noreferrer">
                      {source.title}
                    </a>
                  ))}
                </p>
                {!selectedResult ? <p className="six-readonly-note">
                  The study-specific assessment has not been generated. Use
                  the single assessment action above to add it for every
                  displayed shock.</p> : null}
              </section>
              {selectedResult ? <>
                <section className="six-event-assessment-section">
                  <p className="six-kicker">Study-specific assessment</p>
                  <h4>What it is</h4>
                  <p>{selectedResult.documentedChange}</p>
                  <p className="six-inline-citations">
                    Sources: {resultSourceLinks.map((source) => (
                      <a key={`${source.sourceId}-${source.locator}`}
                        href={source.locator} target="_blank" rel="noreferrer">
                        {source.title}
                      </a>
                    ))}
                  </p>
                </section>
                <section className="six-event-assessment-section">
                  <h4>Why it may matter</h4>
                  <p>{selectedResult.outcomePathway}</p>
                </section>
                <section className="six-event-assessment-section">
                  <h4>What should you check next</h4>
                  <p>{selectedResult.nextCheck}</p>
                </section>
              </> : null}
              <details className="six-event-provenance">
                <summary>Evidence and general screening notes</summary>
                <p><strong>Documented record:</strong> {documentedText(selected)}</p>
                {selectedResult && selected.analysis ? <>
                <p><strong>Date distinction:</strong> {selected.analysis.documentEventDistinction.explanation}</p>
                <p><strong>General screening, before study-specific assessment:</strong> {selected.analysis.whyRelevant}</p>
                {selectedResult ? <p><strong>Provisional relationship:</strong>{" "}
                  {selectedResult.relationshipType.replaceAll("_", " ")}.</p>
                  : null}
                <p><strong>Conditional pathway:</strong> {selected.analysis.outcomePathway}</p>
                <p><strong>Comparison question:</strong> {selected.analysis.comparisonImplication}</p>
                <p><strong>Timing question:</strong> {selected.analysis.temporalInterpretation}</p>
                {selected.analysis.nextChecks.slice(1).map((item) => <p key={item}><strong>Additional check:</strong> {item}</p>)}
                {selected.analysis.uncertainties.slice(2).map((item) => <p key={item}>{item}</p>)}
                {selected.analysis.causalChain?.length ? (
                  <ol className="six-causal-chain">
                    {selected.analysis.causalChain.map((link, index) => (
                      <li key={`${link.from}-${link.to}-${index}`}>
                        <span>{link.from} → {link.to}</span>
                        <small>{link.status.replaceAll("_", " ")}{link.assumption ? ` · ${link.assumption}` : ""}</small>
                      </li>
                    ))}
                  </ol>
                ) : <p>No causal chain was created for this screened lead.</p>}
                </> : <p className="six-readonly-note">Study-specific
                  interpretation is pending. Only the documentary source
                  record is shown.</p>}
                <ul className="six-event-sources">
                  {selected.occurrence.evidence.map((source) => (
                    <li key={`${source.sourceId}-${source.locator}`}>
                      <a href={source.locator} target="_blank" rel="noreferrer">{source.title}</a>
                      <span>{source.publisher}{source.publishedDate ? ` · published ${source.publishedDate}` : ""} · retrieved {source.retrievedAt}</span>
                      {source.factText ? <p>{source.factText}</p> : null}
                    </li>
                  ))}
                </ul>
                {selectedResult &&
                  selected.analysis?.relationshipEvidence?.explanation
                  ? <p>{selected.analysis.relationshipEvidence.explanation}</p>
                  : null}
              </details>
            </article>
          ) : null}
        </div>
      ) : null}
      {historicalHostEvents.length ? (
        <details className="six-event-history">
          <summary>{historicalHostEvents.length} earlier signed-host
            assessment{historicalHostEvents.length === 1 ? "" : "s"}{" "}
            (read only)</summary>
          <p>These earlier assessments are historical. Current event
            interpretation comes from the saved server queue.</p>
          <ul>{historicalHostEvents.map(({ occurrence, hostResult, hostKey }) => (
            <li key={occurrence.id}>
              <strong>{occurrence.title}</strong>{" "}
              {hostResult?.screeningDisposition.replaceAll("_", " ")};{" "}
              {hostResult?.relevanceArgument}
              {props.hostNotices?.[hostKey] ? (
                <p>{props.hostNotices[hostKey]}</p>
              ) : null}
            </li>
          ))}</ul>
        </details>
      ) : null}
      <details className="six-event-coverage">
        <summary>Search coverage and remaining gaps</summary>
        <p>Saved investigation {investigation.snapshotId}; source plan{" "}
          {investigation.plan.discoveryVersion ?? "earlier version"}. The
          listed source attempts were recorded when this investigation ran;
          opening this screen performs no new search.</p>
        <p>{queryCount} source quer{queryCount === 1 ? "y" : "ies"} and{" "}
          {documentCount} document fetch{documentCount === 1 ? "" : "es"}{" "}
          recorded{sourceRoutes.length ? <> across {sourceRoutes.length}{" "}
            finalized source route{sourceRoutes.length === 1 ? "" : "s"}</>
            : discoveryTask?.completedStepCount
              ? " in durable source-step checkpoints" : ""}.{" "}
          {occurrencesById.size} deduplicated occurrence
          {occurrencesById.size === 1 ? "" : "s"} retained;{" "}
          {visibleEvents.length} shown and {investigation.analyses.filter(
            ({ eligibility }) => eligibility?.status &&
              eligibility.status !== "qualifying").length}
          {" "}retained as background or excluded after general screening.
          The separate study-specific assessment covers {assessedCount} of{" "}
          {visibleEvents.length} visible events.</p>
        {discoveryTask && investigation.status === "planned" ? <p>
          {discoveryTask.completedStepCount} of {discoveryTask.totalStepCount}{" "}
          source steps saved. Final attempt rows appear after local processing;
          aggregate counts do not identify a route.</p> : null}
        {investigation.plan.sourceCapabilityVersion ? (
          <p>Source capability: {investigation.plan.sourceCapabilityVersion}.
            Earlier search versions are kept in the investigation history.</p>
        ) : null}
        <ul>
          {investigation.attempts.map((item) => (
            <li key={item.id}>
              <strong>{item.providerId?.replaceAll("_", " ") ?? "No supported route"}</strong>
              {" "}({item.branch.replaceAll("_", " ")}):{" "}
              {item.outcome.replaceAll("_", " ")} via{" "}
              {item.usage.sourceQueries} search{item.usage.sourceQueries === 1 ? "" : "es"}
              {" "}and {item.usage.documentAttempts ?? 0} document fetches;{" "}
              {item.recordsReceived} record{item.recordsReceived === 1 ? "" : "s"} returned
              {item.recordsAccepted !== item.recordsReceived
                ? `, ${item.recordsAccepted} retained` : ""}.
              <small>Query subject: {item.queryTerms.join(" ") || "source-native geography/date filters"};
                {" "}{item.providerId === "govinfo" ?
                  "publication-date search" : item.providerId ===
                    "openfema" ? "incident date window" :
                    item.providerId === "reviewed_official_documents" ?
                      "reviewed index window" : "source search window"}{" "}
                {item.occurrenceWindow.start}–{item.occurrenceWindow.end}.</small>
              <small>{item.note}</small>
            </li>
          ))}
        </ul>
        {investigation.analyses.some(({ eligibility }) =>
          eligibility?.status && eligibility.status !== "qualifying") ? <details>
            <summary>Background and excluded source records</summary>
            <ul>{investigation.analyses.filter(({ eligibility }) =>
              eligibility?.status && eligibility.status !== "qualifying")
              .map((analysis) => {
                const occurrence = investigation.occurrences.find(({ id }) =>
                  id === analysis.eventId);
                return <li key={analysis.id}>
                  {occurrence?.title ?? analysis.eventId}: {analysis.eligibility?.reason}
                </li>;
              })}</ul>
          </details> : null}
        <p>{props.workspace.claimBoundary}</p>
      </details>
      <p className="six-readonly-note">
        Selecting an event, expanding details, or opening a source does not mutate the study, timing, policy evidence, sample definition, method decision, or scientific completion state.
      </p>
    </section>
  );
}

export function studyFirstEventAnalysisMutation(input: {
  expectedRevision: number;
  operationId: string;
  expectedInvestigationFingerprint: string;
}) {
  return {
    action: "analyze_study_first_events" as const,
    expectedRevision: input.expectedRevision,
    operationId: input.operationId,
    expectedInvestigationFingerprint:
      input.expectedInvestigationFingerprint,
  };
}

function mechanismRunStatusLabel(
  status: NonNullable<StudyFirstMechanismWorkspace["currentRun"]>["status"],
) {
  if (status === "planning_ready") {
    return "Theoretical planning ready · retrieval not started";
  }
  if (status === "scholarly_evidence_ready") {
    return "Evidence inspected · synthesis pending or complete below";
  }
  if (status === "metadata_only") {
    return "Metadata leads found · no abstract inspected";
  }
  if (status === "completed_no_records") {
    return "Bounded search completed · no records retained";
  }
  if (status === "retrieval_partial") {
    return "Partial scholarly retrieval";
  }
  if (status === "retrieval_unavailable") {
    return "Scholarly retrieval unavailable";
  }
  return "Mechanism needs clarification";
}

function screen5ReadinessActionLabel(
  action: Screen5ExecutionReadiness["nextAction"],
) {
  const labels = {
    configure_direct_mode:
      "Direct comparison is unavailable in this preview. Restore the preview provider configuration, then restart the same local preview.",
    provide_server_key:
      "The server-only provider credential is missing. Restore it through the existing local configuration helper, then restart this preview.",
    configure_pilot_ledger:
      "The saved inference allowance is unavailable. Restore its persistent accounting without resetting prior use.",
    initialize_pilot_ledger:
      "Use Compare mechanisms once to initialize the configured ledger without sending an inference request.",
    request_execution_authorization:
      "Review the saved input and confirm the next eligible bounded provider action. An uncertain prior request is never resent automatically.",
    recheck_saved_response:
      "Recheck the saved response against the recorded contract. This makes no model or search request.",
    restore_saved_mechanisms:
      "Restore the saved validated mechanism proposals. This makes no model or search request.",
    restore_saved_comparison:
      "Restore the comparison from the validated saved batch. This makes no model or search request.",
    read_saved_diagnostic:
      "The saved response remains quarantined under the current validator. Its safe field diagnosis is available below; repeating this check cannot change the result.",
    ensure_direct_job:
      "Use Compare mechanisms to link this unchanged input to its OpenAI job.",
    resume_direct_job:
      "Resume the saved direct comparison from its next durable checkpoint.",
    read_completed_result:
      "The saved direct result is ready to read; viewing it makes no model request.",
    continue_host_legacy:
      "This Worker is still using its legacy host route.",
    none: "No execution action is required.",
  } as const;
  return labels[action];
}

type Screen5DirectActionStage =
  | "saving_focal"
  | "authorizing"
  | "generating_alternatives"
  | "starting_literature"
  | "retrieving_literature"
  | "assessing_evidence"
  | "restoring_saved_result";

function screen5DirectActionLabel(stage: Screen5DirectActionStage) {
  const labels: Record<Screen5DirectActionStage, string> = {
    saving_focal: "Saving the focal mechanism…",
    authorizing: "Recording this bounded authorization…",
    generating_alternatives: "Generating alternative mechanisms…",
    starting_literature: "Saving scholarly citation suggestions…",
    retrieving_literature: "Preparing the evidence assessment…",
    assessing_evidence: "Assessing saved evidence…",
    restoring_saved_result: "Restoring the saved result locally…",
  };
  return labels[stage];
}

function localScreen5RecoveryStage(
  phase: string,
  authorizing: boolean,
  localRecovery = false,
): Screen5DirectActionStage {
  if (localRecovery) return "restoring_saved_result";
  if (authorizing) return "authorizing";
  if (phase === "planning_queued" || phase === "planning_running") {
    return "generating_alternatives";
  }
  if (phase === "plan_ready") return "starting_literature";
  if (phase === "retrieving") return "retrieving_literature";
  return "assessing_evidence";
}

function directScreen5StatusLabel(
  execution: NonNullable<StudyFirstMechanismWorkspace["currentRun"]>["providerExecution"],
) {
  if (!execution) return "Direct comparison unavailable";
  if (execution.phase === "planning_queued") return "Ready for confirmation";
  if (execution.phase === "planning_running") return "Preparing explanations";
  if (execution.phase === "plan_ready") {
    return "Alternatives and citation suggestions saved";
  }
  if (execution.phase === "retrieving") return "Preparing evidence assessment";
  if (execution.phase === "waiting_for_rate_limit") {
    return execution.comparison
      ? "Partial comparison saved · next batch waiting"
      : "Evidence saved · assessment waiting safely";
  }
  if (execution.phase === "evidence_ready") {
    return "Citation suggestions saved · assessment not started";
  }
  if (execution.phase === "assessment_running") return "Assessing mechanisms";
  if (execution.phase === "validating") return "Checking the saved response";
  if (execution.phase === "completed") return "Comparison complete";
  if (execution.phase === "assessment_partial") {
    return "Partial comparison saved · more assessment pending";
  }
  if (execution.phase === "blocked") return "Assessment blocked safely";
  if (execution.phase === "configuration_required") {
    return "Direct comparison unavailable";
  }
  if (execution.phase === "outcome_unknown") {
    return "Response unverified · no automatic retry";
  }
  if (execution.phase === "failed") {
    if (execution.lastError?.httpStatus === 401) return "Authentication failed";
    if (execution.lastError?.networkInvocation === "not_started") {
      return "Local request blocked";
    }
    return "Evidence assessment unavailable";
  }
  return execution.phase.replaceAll("_", " ");
}

function screen5DispositionIsInactive(status?: string) {
  return [
    "merged",
    "excluded",
    "not_supported_for_study",
  ].includes(status ?? "proposed");
}

const unresolvedScreen5Readiness: Screen5ExecutionReadiness = {
  schemaVersion: "screen-05-execution-readiness-v2",
  selectedBackend: "unresolved",
  provider: "openai",
  model: "gpt-6-luna",
  route: "direct_setup_required",
  configuration: "unresolved",
  missingSettings: [],
  keyPresent: false,
  credentialStatus: "not_tested",
  ledgerState: "unresolved",
  allowance: null,
  authorization: "unresolved",
  authorizedStages: [],
  activeOrigin: "none",
  activeExecutionId: null,
  migration: "unresolved",
  canEnsure: false,
  canAdvanceWithoutInference: false,
  canDispatch: false,
  serverObservedAt: null,
  nextAction: "none",
};

export function StudyFirstMechanismPanel(props: {
  workspace: StudyFirstMechanismWorkspace;
  study: SixScreenWorkflowState["study"];
  context: StudyFirstEventContext | null;
  initialDraft?: Screen5MechanismDraft | null;
  onDraftChange?: (draft: {
    theoreticalPerspective: string;
    proposedMechanism: string;
  }) => void | Promise<void>;
  disabled?: boolean;
  hostReasoningMode?: HostReasoningMode | null;
  planningHostEntry?: StudyFirstHostEntry;
  planningHostBusy?: boolean;
  planningHostNotice?: string;
  hostEntry?: StudyFirstHostEntry;
  hostBusy?: boolean;
  hostNotice?: string;
  modelBusy?: boolean;
  directActionStage?: Screen5DirectActionStage | null;
  onCompare: (input: {
    theoreticalPerspective: string | null;
    proposedMechanism: string;
  }) => void | Promise<void>;
  onAdvanceProvider?: (
    retry: boolean,
    authorizeCurrentJob: boolean,
  ) => void | Promise<void>;
  generationUnavailableReason?: string | null;
  onEditStudy?: () => void;
}) {
  const currentInput = props.workspace.currentInput;
  const currentRun = props.workspace.currentRun;
  const context = currentRun?.context ?? props.context;
  const initialDraftIsDirty = Boolean(
    props.initialDraft && (
      props.initialDraft.proposedMechanism !==
        (currentInput?.proposedMechanism ?? props.study.initialExplanation ?? "") ||
      (props.initialDraft.theoreticalPerspective.trim() || null) !==
        (currentInput?.theoreticalPerspective ?? null)
    ),
  );
  const [perspective, setPerspective] = useState(
    props.initialDraft
      ? props.initialDraft.theoreticalPerspective
      : currentInput?.theoreticalPerspective ?? "",
  );
  const [mechanism, setMechanism] = useState(
    props.initialDraft
      ? props.initialDraft.proposedMechanism
      : currentInput?.proposedMechanism ?? props.study.initialExplanation ?? "",
  );
  const [formError, setFormError] = useState("");
  const [editingMechanism, setEditingMechanism] = useState(
    !currentInput || initialDraftIsDirty,
  );
  const [diagnosticCopyNotice, setDiagnosticCopyNotice] = useState("");
  const [diagnosticFallback, setDiagnosticFallback] = useState("");
  const directActionBusy = Boolean(props.directActionStage);
  const mechanismProcessingActive = directActionBusy ||
    Boolean(props.planningHostBusy) || Boolean(props.hostBusy) ||
    Boolean(props.modelBusy);
  const mechanismProcessingStage = props.directActionStage
    ? screen5DirectActionLabel(props.directActionStage)
    : props.hostBusy
      ? "Assessing mechanism evidence…"
      : "Preparing mechanism comparison…";
  const restoredInputFingerprint = useRef(
    currentInput?.inputFingerprint ?? null,
  );
  const draftDirty = useRef(initialDraftIsDirty);
  const perspectiveRef = useRef(perspective);
  const mechanismRef = useRef(mechanism);
  perspectiveRef.current = perspective;
  mechanismRef.current = mechanism;
  useEffect(() => {
    const fingerprint = currentInput?.inputFingerprint ?? null;
    if (fingerprint === restoredInputFingerprint.current) return;
    restoredInputFingerprint.current = fingerprint;
    const savedPerspective = currentInput?.theoreticalPerspective ?? "";
    const savedMechanism = currentInput?.proposedMechanism ??
      props.study.initialExplanation ?? "";
    const draftMatchesSaved = mechanismRef.current === savedMechanism &&
      (perspectiveRef.current.trim() || null) ===
        (currentInput?.theoreticalPerspective ?? null);
    if (draftDirty.current && !draftMatchesSaved) {
      setEditingMechanism(true);
      return;
    }
    draftDirty.current = false;
    setPerspective(savedPerspective);
    setMechanism(savedMechanism);
    setFormError("");
    setEditingMechanism(false);
  }, [
    currentInput?.inputFingerprint,
    currentInput?.proposedMechanism,
    currentInput?.theoreticalPerspective,
    props.study.initialExplanation,
  ]);

  function preserveDraft(
    nextPerspective: string,
    nextMechanism: string,
  ) {
    draftDirty.current = true;
    void props.onDraftChange?.({
      theoreticalPerspective: nextPerspective,
      proposedMechanism: nextMechanism,
    });
  }

  const expectedHostKey = currentRun
    ? studyFirstHostEntryKey(
        SCREEN05_STUDY_MECHANISM_COMPARISON_TASK,
        currentRun.id,
      )
    : null;
  const planningTask = currentRun && props.planningHostEntry &&
      props.planningHostEntry.coordinates.selectedEventId === currentRun.id &&
      props.planningHostEntry.coordinates.expectedEventFingerprint ===
        currentRun.runFingerprint
    ? props.planningHostEntry.task
    : undefined;
  const comparisonTask = currentRun && props.hostEntry &&
      props.hostEntry.coordinates.selectedEventId === currentRun.id &&
      props.hostEntry.coordinates.expectedEventFingerprint ===
        currentRun.runFingerprint
    ? props.hostEntry.task
    : undefined;
  const readiness = props.workspace.executionReadiness ??
    unresolvedScreen5Readiness;
  const directRouteActive = true;
  const hostResult = !directRouteActive && currentRun && props.hostEntry &&
      props.hostEntry.coordinates.selectedEventId === currentRun.id &&
      props.hostEntry.coordinates.expectedEventFingerprint ===
        currentRun.runFingerprint
    ? studyFirstHostResult(
        SCREEN05_STUDY_MECHANISM_COMPARISON_TASK,
        props.hostEntry.task.result,
      )
    : null;
  const directExecution = currentRun?.providerExecution ?? null;
  const automaticAdvanceKey = useRef<string | null>(null);
  const advanceProviderRef = useRef(props.onAdvanceProvider);
  advanceProviderRef.current = props.onAdvanceProvider;
  useEffect(() => {
    if (!directExecution || directActionBusy || props.disabled ||
        props.generationUnavailableReason || !advanceProviderRef.current) return;
    const phase = directExecution.phase;
    const broadOneClickAuthorization =
      readiness.authorizedStages.includes("planning") &&
      readiness.authorizedStages.includes("assessment");
    const deterministicContinuation = broadOneClickAuthorization &&
      ["plan_ready", "retrieving"].includes(phase);
    const authorizedInference = readiness.authorization === "authorized" &&
      ["planning_queued", "evidence_ready", "waiting_for_rate_limit",
        "assessment_partial"].includes(phase);
    if (!deterministicContinuation && !authorizedInference) return;
    let delay = 0;
    if (phase === "waiting_for_rate_limit") {
      const eligibleAt = directExecution.nextEligibleAt
        ? Date.parse(directExecution.nextEligibleAt) : Number.NaN;
      const observedAt = readiness.serverObservedAt
        ? Date.parse(readiness.serverObservedAt) : Date.now();
      if (!Number.isFinite(eligibleAt)) return;
      delay = Math.max(0, eligibleAt -
        (Number.isFinite(observedAt) ? observedAt : Date.now()) + 75);
    }
    const key = [directExecution.id, directExecution.executionFingerprint,
      phase, directExecution.updatedAt, directExecution.nextEligibleAt,
      readiness.authorization, readiness.nextAction].join(":");
    if (automaticAdvanceKey.current === key) return;
    const timer = globalThis.setTimeout(() => {
      automaticAdvanceKey.current = key;
      void advanceProviderRef.current?.(false, false);
    }, delay);
    return () => globalThis.clearTimeout(timer);
  }, [
    directExecution?.id,
    directExecution?.executionFingerprint,
    directExecution?.phase,
    directExecution?.updatedAt,
    directExecution?.nextEligibleAt,
    directActionBusy,
    props.disabled,
    props.generationUnavailableReason,
    readiness.authorization,
    readiness.authorizedStages.join("\u0000"),
    readiness.nextAction,
    readiness.serverObservedAt,
  ]);
  const directComparison = directExecution?.comparison ?? null;
  const directPlan = currentRun?.planning?.origin === "openai" ||
      isHistoricalScreen5Provider(currentRun?.planning?.origin)
    ? currentRun.planning.plan
    : null;
  const directEvidencePacket = directExecution?.evidencePacket ?? null;
  const savedOutcome = currentRun?.theoreticalProblem?.outcome?.concept ??
    props.study.outcome;
  const savedMeasure = currentRun?.theoreticalProblem?.outcome
    ? currentRun.theoreticalProblem.outcome.measure
    : props.study.outcomeMeasure;
  const screen5SourceTitles = [
    ...(directComparison?.bibliography ?? []).map(({ title }) => title),
    ...(currentRun?.works ?? []).map(({ title }) => title),
  ];
  function suggestedScholarlyCitations(
    candidateId: string | null,
    focal: boolean,
  ) {
    if (!directPlan) return [];
    if (focal) return directPlan.focalSuggestedCitations ?? [];
    return directPlan.candidates.find(({ id }) => id === candidateId)
      ?.suggestedCitations ?? [];
  }
  const allSuggestedCitations = [
    ...(directPlan?.focalSuggestedCitations ?? []).map((citation) => ({
      mechanismLabel: "Researcher-proposed focal mechanism", citation,
    })),
    ...(directPlan?.candidates ?? []).flatMap((candidate) =>
      (candidate.suggestedCitations ?? []).map((citation) => ({
        mechanismLabel: candidate.conceptLabel, citation,
      }))),
  ].filter((item, index, items) => items.findIndex((candidate) =>
    candidate.citation.id === item.citation.id) === index);
  const directFocal = directComparison?.mechanisms.find(({ relation }) =>
    relation === "focal") ?? null;
  const assessedMechanismsById = new Map(
    (directComparison?.mechanisms ?? []).map((item) => [
      item.candidateId ?? item.id,
      item,
    ]),
  );
  const dispositionsById = new Map(
    (directComparison?.dispositions ?? []).map((item) => [
      item.candidateId,
      item,
    ]),
  );
  const displayablePlanCandidates = (directPlan?.candidates ?? []).filter(
    (candidate) => typeof candidate.conceptLabel === "string" &&
      Array.isArray(candidate.processNodes),
  );
  const activeDirectCandidates = displayablePlanCandidates.filter(
    ({ id }) => !screen5DispositionIsInactive(
      dispositionsById.get(id)?.status,
    ),
  );
  const historicalDirectCandidates = displayablePlanCandidates.filter(
    ({ id }) => screen5DispositionIsInactive(
      dispositionsById.get(id)?.status,
    ),
  );
  const plannedCandidateIds = new Set(displayablePlanCandidates.map(({ id }) =>
    id));
  const unmatchedAssessedAlternatives = (directComparison?.mechanisms ?? [])
    .filter((item) => item.relation !== "focal" &&
      !plannedCandidateIds.has(item.candidateId ?? item.id) &&
      !screen5DispositionIsInactive(
        dispositionsById.get(item.candidateId ?? item.id)?.status,
      ));
  const bibliographyEvidenceIds = new Set(
    (directComparison?.bibliography ?? []).map(({ evidenceId }) => evidenceId),
  );
  const hasDisplayedScholarlySupport = (
    card: NonNullable<typeof directComparison>["mechanisms"][number],
  ) => card.argument.some(({ basis, supportStatus, evidenceIds }) =>
    basis === "inspected_proposition" && supportStatus === "source_linked" &&
    evidenceIds.some((evidenceId) => bibliographyEvidenceIds.has(evidenceId)));
  const assessedPlannedAlternatives = activeDirectCandidates.flatMap(
    (candidate) => {
      const assessed = assessedMechanismsById.get(candidate.id);
      return assessed && assessed.relation !== "focal"
        ? [{ candidate, assessed }] : [];
    },
  );
  const provisionalPlannedAlternatives = activeDirectCandidates.filter(
    (candidate) => !assessedMechanismsById.has(candidate.id),
  );
  const predictionMechanisms = (directComparison?.mechanisms ?? []).filter(
    (card) => card.relation === "focal" || hasDisplayedScholarlySupport(card),
  );
  const alternativeEvidenceStates: Screen5PresentationCheckState[] = [
    ...activeDirectCandidates.map((candidate) => {
      const assessed = assessedMechanismsById.get(candidate.id);
      return assessed
        ? screen5EvidenceStatus({
            assessed: true,
            sourceCheckStatus: assessed.sourceCheckStatus,
          }).state
        : "pending" as const;
    }),
    ...unmatchedAssessedAlternatives.map((assessed) =>
      screen5EvidenceStatus({
        assessed: true,
        sourceCheckStatus: assessed.sourceCheckStatus,
      }).state),
  ];
  const alternativeProgress = screen5EvidenceProgress(
    alternativeEvidenceStates,
  );
  const lastDirectAttempt = directExecution?.attempts?.at(-1);
  const alternativeResultState = projectAnalysisResultState({
    currentArtifact: Boolean(directPlan),
    completedItems: directPlan?.candidates.length ?? 0,
    completedWithNoAdditionalItems: Boolean(directPlan &&
      !directPlan.candidates.length),
    savedArtifact: Boolean(lastDirectAttempt?.stage === "planning" &&
      lastDirectAttempt.wireCheckpoint && !directPlan),
    rawReceipt: Boolean(lastDirectAttempt?.stage === "planning" &&
      lastDirectAttempt.responseReceipt && !lastDirectAttempt.wireCheckpoint),
    stale: Boolean(currentInput && !currentRun),
    configurationAvailable: directExecution?.phase !== "configuration_required",
    failure: directExecution?.phase === "outcome_unknown"
      ? "outcome_unknown"
      : directExecution?.phase === "failed"
        ? lastDirectAttempt?.networkInvocation === "not_started"
          ? "before_dispatch" : "provider_rejected"
        : null,
    phase: ["planning_running", "validating"].includes(
      directExecution?.phase ?? "",
    ) ? "running" : directExecution?.phase === "planning_queued"
      ? "preparing" : "not_started",
  });
  const directAuthorizationNeeded = !readiness.canAdvanceWithoutInference &&
    readiness.nextAction !== "read_saved_diagnostic" &&
    (readiness.authorization === "required" ||
    readiness.authorization === "job_mismatch");
  const localRecovery = readiness.nextAction === "recheck_saved_response" ||
    readiness.nextAction === "restore_saved_comparison" ||
    readiness.nextAction === "restore_saved_mechanisms";
  const recoveryLabel = "Finish saved assessment";
  const automaticContinuationActive = Boolean(directExecution &&
    ((readiness.authorizedStages.includes("planning") &&
      readiness.authorizedStages.includes("assessment") &&
      ["plan_ready", "retrieving"].includes(directExecution.phase)) ||
    (readiness.authorization === "authorized" &&
      ["planning_queued", "evidence_ready", "waiting_for_rate_limit",
        "assessment_partial"].includes(directExecution.phase))));
  const mechanismCards = hostResult
    ? [hostResult.focal, ...hostResult.alternatives]
    : [];
  const executionDiagnostic = currentRun
    ? screen5ExecutionDiagnostic({
        hostMode: props.hostReasoningMode ?? "unknown",
        run: currentRun,
        readiness,
        planningTask,
        comparisonTask,
      })
    : null;

  function compare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mechanism.trim()) {
      setFormError(
        "Describe the process between the policy and outcome. The theoretical perspective may be blank.",
      );
      setEditingMechanism(true);
      return;
    }
    setFormError("");
    preserveDraft(perspective, mechanism);
    setEditingMechanism(false);
    void props.onCompare({
      theoreticalPerspective: perspective.trim() ? perspective : null,
      proposedMechanism: mechanism,
    });
  }

  async function copyExecutionDiagnostic() {
    if (!executionDiagnostic) return;
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard access is unavailable.");
      }
      await navigator.clipboard.writeText(
        `${JSON.stringify(executionDiagnostic, null, 2)}\n`,
      );
      setDiagnosticFallback("");
      setDiagnosticCopyNotice("Safe execution diagnostic copied.");
    } catch {
      setDiagnosticFallback(JSON.stringify(executionDiagnostic, null, 2));
      setDiagnosticCopyNotice(
        "Clipboard access is unavailable. Select the safe diagnostic text below.",
      );
    }
  }

  function renderArgumentEvidence(
    cardId: string,
    argument: NonNullable<
      NonNullable<typeof directComparison>
    >["mechanisms"][number]["argument"][number],
    occurrence: string,
  ) {
    if (!argument.evidenceIds.length && !argument.citations.length) return null;
    const knownLabels = argument.evidenceIds.flatMap((id) => {
      const source = directComparison?.bibliography?.find(
        (entry) => entry.evidenceId === id);
      return source ? [screen5SourceCitationLabel(source)] : [];
    });
    const citationLabel = knownLabels.length
      ? `(${[...new Set(knownLabels)].join("; ")})`
      : argument.citations.length
        ? `(${argument.citations.join("; ")})`
        : "Source details · citation label unavailable";
    return (
      <details className="six-claim-citation">
        <summary aria-label={`Show saved source details for ${citationLabel}`}>
          {citationLabel}
        </summary>
        <p>{screen5ArgumentSupportScope(argument)}</p>
        {!knownLabels.length && argument.citations.length ? (
          <p>Historical saved citation label; source metadata is unavailable here.</p>
        ) : null}
        {argument.evidenceIds.length ? (
          <ul>
            {argument.evidenceIds.map((evidenceId) => {
              const source = directComparison?.bibliography?.find(
                (entry) => entry.evidenceId === evidenceId,
              );
              return (
                <li key={`${cardId}-${occurrence}-${evidenceId}`}>
                  {source ? screen5SourceCitationLabel(source) : evidenceId}
                  {source?.title ? ` · ${source.title}` : ""}
                  {source?.accessLevel ? ` · Access: ${source.accessLevel.replaceAll("_", " ")}` : ""}
                  {source?.claimBoundary ? ` · Access/claim limit: ${source.claimBoundary}` : ""}
                  {source?.stableLocators?.[0] ? (
                    <> · <a href={source.stableLocators[0]} target="_blank" rel="noreferrer">Open stable record</a></>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </details>
    );
  }

  function renderMechanismCitation(input: {
    inspectedLabels?: string[];
    suggestedCitations?: ReturnType<typeof suggestedScholarlyCitations>;
  }) {
    const inspectedLabels = [...new Set(input.inspectedLabels ?? [])];
    const suggestedLabels = [...new Set((input.suggestedCitations ?? []).map(
      ({ citationLabel }) => citationLabel))];
    if (inspectedLabels.length) return (
      <p className="six-mechanism-inline-citation">
        <strong>Relevant scholarly support:</strong>{" "}
        <cite>({inspectedLabels.join("; ")})</cite>
      </p>
    );
    if (suggestedLabels.length) return (
      <p className="six-mechanism-inline-citation">
        <cite>({suggestedLabels.join("; ")})</cite>
        <small> ChatGPT-suggested scholarly citation; verify before publication.</small>
      </p>
    );
    return (
      <p className="six-mechanism-inline-citation six-readonly-note">
        No ChatGPT-suggested citation is stored for this earlier run.
      </p>
    );
  }

  function renderDirectMechanismCard(
    card: NonNullable<typeof directComparison>["mechanisms"][number],
    disposition?: NonNullable<
      NonNullable<typeof directComparison>["dispositions"]
    >[number],
  ) {
    const savedCandidate = displayablePlanCandidates.find((candidate) =>
      candidate.id === (card.candidateId ?? card.id));
    const directionLabel = screen5DirectionLabel(
      card.direction, savedOutcome, savedMeasure,
      savedCandidate?.proposedDirection,
    );
    const pathway = screen5PolicyAnchoredPath({
      policyName: context?.policy.officialTitle ?? "Saved policy",
      originalNodes: card.chain,
      outcomeEndpoint: directionLabel,
      neutralOutcome: savedOutcome ?? undefined,
      neutralMeasure: savedMeasure,
    });
    const primaryArgument = screen5PrimaryArgument(card.argument);
    const evidenceStatus = screen5EvidenceStatus({
      assessed: true,
      sourceCheckStatus: card.sourceCheckStatus,
      primaryArgument,
    });
    const uniqueArguments = screen5UniqueArguments(card.argument);
    const cardCitationLabels = [...new Set(card.argument.flatMap((argument) =>
      argument.evidenceIds.flatMap((evidenceId) => {
        const source = directComparison?.bibliography.find((entry) =>
          entry.evidenceId === evidenceId);
        return source ? [screen5SourceCitationLabel(source)] : [];
      })))];
    const suggestedCitations = suggestedScholarlyCitations(
      card.candidateId ?? card.id,
      card.relation === "focal",
    );
    const visibleMaterialCondition = [card.direction?.condition, card.limit]
      .map((value) => value?.trim()).filter((value, index, values) =>
        Boolean(value) && values.indexOf(value) === index).join(" ");
    const heading = screen5CompactMechanismHeading({
      concept: card.concept, processNodes: card.chain,
      sourceTitles: screen5SourceTitles,
      policyName: context?.policy.officialTitle, outcome: savedOutcome,
      fallback: card.relation === "focal"
        ? "Researcher-proposed process" : "Alternative process",
    });
    return (
      <article
        key={card.id}
        data-relation={card.relation}
        data-evidence-state={evidenceStatus.state}
      >
        <div className="six-mechanism-card-heading">
          <h4>{heading}</h4>
          <span>{evidenceStatus.label}</span>
        </div>
        <ol className="six-process-path" aria-label="Causal pathway">
          {pathway.map((node, index) => (
            <li key={`${card.id}-path-${index}`}>
              <span>{index === pathway.length - 1
                ? <strong>{node}</strong> : node}</span>
              {index < pathway.length - 1 ? (
                <span className="six-process-arrow" aria-hidden="true">→</span>
              ) : null}
            </li>
          ))}
        </ol>
        {primaryArgument ? (
          <div className="six-card-explanation">
            <p>{primaryArgument.text}</p>
            {renderArgumentEvidence(card.id, primaryArgument, "primary")}
            <p className="six-readonly-note">{screen5ArgumentSupportScope(primaryArgument)}</p>
          </div>
        ) : (
          <p>No connected explanation was recorded in this assessment.</p>
        )}
        <p className="six-material-gap">
          <strong>Material condition or support gap:</strong>{" "}
          {visibleMaterialCondition || "No material condition was recorded."}
        </p>
        <details className="six-mechanism-card-details">
          <summary>Details and evidence</summary>
          {heading !== card.concept ? (
            <p><strong>Original saved concept:</strong> {card.concept}</p>
          ) : null}
          <p><strong>Original saved sequence:</strong> {card.chain.join(" → ")}</p>
          {card.direction ? (
            <p>
              <strong>Saved direction assessment:</strong>{" "}
              mechanism response {card.direction.mechanismResponse.replaceAll("_", " ")}; outcome implication {card.direction.outcomeImplication.replaceAll("_", " ")}. {card.direction.condition}
            </p>
          ) : (
            <p><strong>Saved direction assessment:</strong> Not specified.</p>
          )}
          {card.theory ? (
            <p>
              <strong>Theoretical lens:</strong> {card.theory}{" "}
              <small>({card.theoryBasis.replaceAll("_", " ")})</small>
            </p>
          ) : null}
          {uniqueArguments.length ? (
            <div>
              <strong>Full connected argument</strong>
              <ol className="six-full-arguments">
                {uniqueArguments.map((argument, index) => (
                  <li key={`${card.id}-argument-${index}`}>
                    <p>{argument.text}</p>
                    {renderArgumentEvidence(card.id, argument, `full-${index}`)}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          <p><strong>Fit to this study:</strong> {card.fit}</p>
          <p><strong>Saved transfer limit:</strong> {card.limit}</p>
          {disposition?.reason ? (
            <p><strong>Saved disposition:</strong> {disposition.reason}</p>
          ) : null}
          {card.support ? (
            <p><strong>Saved support classification:</strong> {card.support.replaceAll("_", " ")}</p>
          ) : null}
        </details>
        {renderMechanismCitation({
          inspectedLabels: cardCitationLabels,
          suggestedCitations,
        })}
      </article>
    );
  }

  function renderProvisionalMechanismCard(
    candidate: NonNullable<typeof directPlan>["candidates"][number],
  ) {
    const directionLabel = screen5ProposedDirectionLabel(
      candidate.proposedDirection,
      true,
      { outcome: savedOutcome, measure: savedMeasure },
    );
    const pathway = screen5PolicyAnchoredPath({
      policyName: context?.policy.officialTitle ?? "Saved policy",
      originalNodes: candidate.processNodes,
      outcomeEndpoint: directionLabel,
      neutralOutcome: savedOutcome ?? undefined,
      neutralMeasure: savedMeasure,
    });
    const coverage = directEvidencePacket?.coverageMap?.find((item) =>
      item.candidateId === candidate.id);
    const literatureLeads = (coverage?.inspectedEvidenceIds ?? []).flatMap(
      (evidenceId) => {
        const entry = directEvidencePacket?.entries.find((item) =>
          item.evidenceId === evidenceId);
        return entry ? [entry] : [];
      },
    );
    const suggestedCitations = suggestedScholarlyCitations(
      candidate.id, false);
    const heading = screen5CompactMechanismHeading({
      concept: candidate.conceptLabel,
      processNodes: candidate.processNodes,
      sourceTitles: screen5SourceTitles,
      policyName: context?.policy.officialTitle,
      outcome: savedOutcome,
      fallback: "Alternative process",
    });
    return <article key={candidate.id} data-relation={candidate.relationToFocal}
      data-evidence-state="pending">
      <div className="six-mechanism-card-heading">
        <h4>{heading}</h4>
        <span>Generated hypothesis · evidence check pending</span>
      </div>
      <ol className="six-process-path" aria-label="Proposed causal pathway">
        {pathway.map((node, index) => <li key={`${candidate.id}-path-${index}`}>
          <span>{index === pathway.length - 1
            ? <strong>{node}</strong> : node}</span>
          {index < pathway.length - 1 ? (
            <span className="six-process-arrow" aria-hidden="true">→</span>
          ) : null}
        </li>)}
      </ol>
      <div className="six-card-explanation">
        <p><strong>How it differs from the focal process.</strong>{" "}
          {candidate.distinctionFromFocal}</p>
        <p><strong>Material condition.</strong>{" "}
          {candidate.condition ?? candidate.contextualConditions.join("; ")}</p>
      </div>
      {literatureLeads.length ? <details className="six-claim-citation">
        <summary>Literature identities and claim limits</summary>
        <ul>{literatureLeads.map((entry) => <li key={entry.evidenceId}>
          {entry.citationLabel} · {entry.title}. {entry.claimBoundary}
          {entry.stableLocators[0] ? <> · <a href={entry.stableLocators[0]}
            target="_blank" rel="noreferrer">Open stable record</a></> : null}
        </li>)}</ul>
      </details> : null}
      {renderMechanismCitation({
        inspectedLabels: literatureLeads.map((entry) => entry.citationLabel),
        suggestedCitations,
      })}
    </article>;
  }

  function renderFocalReferenceCard() {
    if (!currentRun) return null;
    const x = currentRun.theoreticalProblem?.theoreticalChange?.originalText ??
      "Saved theoretical change X";
    const y = screen5OutcomeTarget(savedOutcome, savedMeasure);
    const pathway = screen5PolicyAnchoredPath({
      policyName: context?.policy.officialTitle ?? "Saved policy",
      originalNodes: [x, currentRun.input.proposedMechanism, y],
      outcomeEndpoint: `${y} — direction not yet assessed`,
      neutralOutcome: y,
    });
    return (
      <article data-relation="focal" data-evidence-state="pending">
        <div className="six-mechanism-card-heading">
          <h4>Researcher-proposed process</h4>
          <span>Evidence check pending</span>
        </div>
        <p>{currentRun.input.proposedMechanism}</p>
        <ol className="six-process-path" aria-label="Researcher-proposed causal pathway">
          {pathway.map((node, index) => (
            <li key={`focal-path-${index}`}>
              <span>{index === pathway.length - 1
                ? <strong>{node}</strong> : node}</span>
              {index < pathway.length - 1 ? (
                <span className="six-process-arrow" aria-hidden="true">→</span>
              ) : null}
            </li>
          ))}
        </ol>
        <details className="six-mechanism-card-details">
          <summary>Details and evidence</summary>
          <p>The exact finalized researcher text remains the focal reference and is not counted as an alternative.</p>
        </details>
        {renderMechanismCitation({
          suggestedCitations: suggestedScholarlyCitations(null, true),
        })}
      </article>
    );
  }

  return (
    <section className="six-card six-study-first-mechanisms">
      <div className="six-card-heading">
        <div>
          <p className="six-kicker">Study-specific mechanism comparison</p>
          <h2>Compare explanations</h2>
          <p>
            Compare theoretical pathways and the observations that could
            distinguish them in this saved study.
          </p>
        </div>
        <button
          type="button"
          className="six-link-button"
          onClick={props.onEditStudy}
        >
          Edit study details
        </button>
      </div>

      <p className="six-mechanism-context-note">
        The pathways interpret {context?.policy.officialTitle ?? "the saved policy"}
        {" "}through your selected study construct. They do not estimate a
        total policy effect.
      </p>

      <dl className="six-mechanism-context-strip">
        <div><dt>Policy</dt><dd>{context?.policy.officialTitle ?? "Saved policy"}</dd></div>
        <div><dt>Study construct</dt><dd>{currentRun?.theoreticalProblem?.theoreticalChange?.originalText ?? props.study.policySideConcept ?? "Unresolved"}</dd></div>
        <div><dt>Outcome · measure</dt><dd>{savedOutcome ?? "Unknown"}{savedMeasure ? ` · ${savedMeasure}` : " · measure unspecified"}</dd></div>
        <div><dt>Study context</dt><dd>{props.study.population ?? "Unknown population"}{props.study.analysisUnit ? ` · ${props.study.analysisUnit}` : " · unit unknown"} · {props.study.period.start ?? "?"}–{props.study.period.end ?? "?"}</dd></div>
      </dl>
      <details className="six-study-context-details">
        <summary>Full study context and separate design annotations</summary>
        <dl>
          <div><dt>Proposed groups</dt><dd>{props.study.proposedTreatment && props.study.proposedComparison ? `${props.study.proposedTreatment} versus ${props.study.proposedComparison}` : "No complete comparison pair supplied"}</dd></div>
          <div><dt>Geography</dt><dd>{props.study.geography.length ? props.study.geography.join(", ") : "Unspecified"}</dd></div>
          <div><dt>Industry</dt><dd>{props.study.industry.length ? props.study.industry.join(", ") : "Unspecified"}</dd></div>
          <div><dt>Theoretical construct of the shock</dt><dd>{props.study.policySideConcept ?? "Not specified"}</dd></div>
          <div><dt>Researcher question or explanation</dt><dd>{props.study.initialExplanation ?? "Explicitly blank"}</dd></div>
          <div><dt>Policy episode</dt><dd>{context?.policy.episode ?? "Unresolved"}</dd></div>
          <div><dt>Later design timing (separate)</dt><dd>{context?.timing?.mode === "year" ? `${context.timing.year} (${context.timing.precision} precision)` : context?.timing?.mode.replaceAll("_", " ") ?? "Unresolved"}</dd></div>
          <div><dt>Method choice</dt><dd>{context?.methodSelection?.decision.mode === "selected" ? context.methodSelection.decision.optionId : context?.methodSelection ? "No method selected" : "Not supplied"}</dd></div>
          <div><dt>Prior-results disclosure</dt><dd>{props.study.resultsPreviouslyInspected.replaceAll("_", " ")}</dd></div>
        </dl>
      </details>

      {!currentInput || editingMechanism ? (
        <form className="six-mechanism-input" onSubmit={compare}>
          <div className="six-section-heading">
            <div>
              <p className="six-kicker">Focal reference</p>
              <h3>{currentInput ? "Edit your proposed mechanism" : "Propose a mechanism"}</h3>
            </div>
            {currentInput ? (
              <button
                type="button"
                className="six-link-button"
                onClick={() => setEditingMechanism(false)}
              >
                Close editor
              </button>
            ) : null}
          </div>
          {currentInput ? (
            <p className="six-readonly-note">
              Saved focal: “{currentInput.proposedMechanism}”
              {currentInput.theoreticalPerspective
                ? ` · Perspective: ${currentInput.theoreticalPerspective}` : ""}
            </p>
          ) : null}
          <div className="six-study-fields-grid">
            <label className="six-field">
              <span>Theoretical perspective <small>optional</small></span>
              <input
                value={perspective}
                maxLength={1_000}
                disabled={props.disabled}
                placeholder="e.g., agency theory"
                onChange={(event) => {
                  const value = event.target.value;
                  setPerspective(value);
                  preserveDraft(value, mechanismRef.current);
                  setFormError("");
                }}
              />
            </label>
            <label className="six-field six-field--wide">
              <span>Process mechanism to investigate <small>required for a new comparison</small></span>
              <textarea
                value={mechanism}
                maxLength={4_000}
                disabled={props.disabled}
                placeholder="Who responds, what changes, and how might that process reach the saved outcome?"
                onChange={(event) => {
                  const value = event.target.value;
                  setMechanism(value);
                  preserveDraft(perspectiveRef.current, value);
                  setFormError("");
                }}
              />
            </label>
          </div>
          {currentInput && (
              mechanism !== currentInput.proposedMechanism ||
              (perspective.trim() || null) !== currentInput.theoreticalPerspective
            ) ? (
            <p className="six-readonly-note" role="status">
              Unsaved draft preserved. Existing analysis remains bound to finalized
              input revision {currentInput.revision} until you compare this draft.
            </p>
          ) : null}
          <p className="six-readonly-note">
            Your exact text is saved as a versioned researcher input. Any later
            decomposition or comparison remains separate and conditional.
          </p>
          {formError ? <p className="six-field-error" role="alert">{formError}</p> : null}
          <button
            type="submit"
            className="six-primary"
            disabled={props.disabled || directActionBusy}
          >
            {props.directActionStage === "saving_focal"
              ? "Saving and preparing mechanisms…"
              : props.disabled
                ? "Saving mechanism…"
              : currentInput && !currentRun
                ? "Generate for revised study"
                : "Generate study-specific mechanisms"}
          </button>
          <ProcessingStatus
            active={mechanismProcessingActive}
            stage={mechanismProcessingStage}
          />
          <small className="six-readonly-note">
            One click authorizes this bounded job to generate alternatives,
            suggest scholarly citations, and assess all saved batches.
            Suggested citations come from the same ChatGPT response and must
            be checked before publication. Rate-limit waits resume
            automatically; an uncertain provider outcome is never resent.
          </small>
        </form>
      ) : (
        <section className="six-focal-summary" aria-labelledby="screen5-focal-heading">
          <div className="six-section-heading">
            <div>
              <p className="six-kicker">Focal reference</p>
              <h3 id="screen5-focal-heading">Your finalized focal mechanism</h3>
            </div>
            <button
              type="button"
              className="six-link-button"
              onClick={() => setEditingMechanism(true)}
            >
              Edit mechanism
            </button>
          </div>
          <p>{currentInput.proposedMechanism}</p>
          {currentInput.theoreticalPerspective ? (
            <small>Theoretical perspective: {currentInput.theoreticalPerspective}</small>
          ) : null}
          {!currentRun ? (
            <div className="six-alert six-alert--info" role="status">
              <p>The saved focal wording is preserved. Other study details changed, so its earlier comparison remains historical.</p>
              <button type="button" className="six-secondary"
                disabled={props.disabled || directActionBusy}
                onClick={() => void props.onCompare({
                  theoreticalPerspective: currentInput.theoreticalPerspective,
                  proposedMechanism: currentInput.proposedMechanism,
                })}>
                Generate for revised study
              </button>
              <ProcessingStatus
                active={mechanismProcessingActive}
                stage={mechanismProcessingStage}
              />
              <small>This saves the same wording, generates alternatives, and asks ChatGPT for a scholarly citation for each mechanism.</small>
            </div>
          ) : null}
          {currentRun ? <details>
            <summary>Focal assessment and evidence</summary>
            <div className="six-mechanism-comparison-cards six-mechanism-comparison-cards--focal">
              {directFocal
                ? renderDirectMechanismCard(directFocal)
                : renderFocalReferenceCard()}
            </div>
          </details> : null}
        </section>
      )}

      {!currentRun ? (
        <section className="six-mechanism-results" id="screen5-alternative-results"
          aria-label="Alternative mechanisms result"
          aria-busy={directActionBusy || undefined} aria-live="polite">
          <p className="six-kicker">Study-specific result</p>
          <h3>Alternative mechanisms — Not yet generated</h3>
          <p>The button above saves your exact focal wording, generates
            distinct hypotheses, and asks ChatGPT for a scholarly citation for
            each mechanism. A proposed pathway or citation is not a finding.</p>
          {props.generationUnavailableReason ? (
            <p className="six-readonly-note" role="status">
              {props.generationUnavailableReason}
            </p>
          ) : null}
          {props.directActionStage ? <p className="six-direct-action-status"
            role="status">{screen5DirectActionLabel(
              props.directActionStage)}</p> : null}
        </section>
      ) : null}

      {currentRun ? (
        <section className="six-mechanism-results" aria-live="polite"
          aria-busy={directActionBusy || undefined}>
          <div className="six-section-heading" id="screen5-alternative-results">
            <div>
              <p className="six-kicker">Study-specific result</p>
              <h3>Alternative mechanisms{alternativeResultState === "not_started"
                ? " — Not yet generated" : alternativeResultState === "receipt_saved"
                  ? " — Response saved for local recheck" : alternativeResultState === "complete_zero"
                    ? " — No additional proposal retained" : ""}</h3>
              <p>{directPlan || directComparison
                ? directComparison
                  ? "The proposed explanations and their saved evidence checks appear below. These are hypotheses, not verified causal pathways."
                  : "The generated hypotheses appear below immediately. Literature leads and source-linked support are added only when the separate evidence checks succeed."
                : "Propose distinct pathways that could explain this outcome alongside your mechanism. The alternatives and ChatGPT-suggested scholarly citations will appear here."}</p>
            </div>
          </div>
          <div className="six-mechanism-status">
            <div>
              <p className="six-kicker">Saved assessment status</p>
              <h3>{directComparison
                ? "Mechanism comparison saved"
                : directPlan
                  ? "Alternative mechanisms generated"
                  : directExecution
                    ? directScreen5StatusLabel(directExecution)
                : mechanismRunStatusLabel(currentRun.status)}</h3>
            </div>
            <span>Input revision {currentRun.input.revision}</span>
          </div>
          {props.directActionStage ? <p className="six-direct-action-status"
            role="status">{screen5DirectActionLabel(
              props.directActionStage)} Saved input and results remain
              readable.</p> : null}
          {props.generationUnavailableReason ? (
            <div className="six-alert six-alert--info" role="status">
              <strong>New alternatives are temporarily unavailable</strong>
              <p>{props.generationUnavailableReason}</p>
            </div>
          ) : null}

          {currentRun.inputAssessment.status === "needs_clarification" ? (
            <div className="six-alert six-alert--info">
              <strong>A process statement is still needed</strong>
              <p>{currentRun.inputAssessment.clarification}</p>
            </div>
          ) : (
            <>
              {currentRun.status === "retrieval_unavailable" ? (
                <div className="six-alert six-alert--info">
                  <strong>Retrieval did not complete</strong>
                  <p>No failed source request is being interpreted as an absence of scholarship or support.</p>
                </div>
              ) : currentRun.status === "completed_no_records" &&
                  !allSuggestedCitations.length ? (
                <div className="six-alert six-alert--info">
                  <strong>No record was retained in this bounded search</strong>
                  <p>This is not a claim that no relevant scholarship exists.</p>
                </div>
              ) : null}

              {directComparison || directPlan ? (
                <section className="six-mechanism-comparison six-direct-comparison">
                  <div className="six-section-heading">
                    <div>
                      <p className="six-kicker">Alternative pathways</p>
                      <h3>Competing and complementary mechanisms</h3>
                    </div>
                    <span>
                      {directComparison
                        ? directComparison.completion?.status === "partial"
                          ? "Partial assessment · saved"
                          : "Complete assessment · saved"
                        : "Evidence checks pending"}
                    </span>
                  </div>
                  <section aria-label="Generated additional mechanisms">
                    <div className="six-alternative-heading">
                      <h4>Generated alternative mechanisms ({
                        directComparison
                          ? assessedPlannedAlternatives.length +
                            unmatchedAssessedAlternatives.length +
                            provisionalPlannedAlternatives.length
                          : activeDirectCandidates.length})</h4>
                      <p role="status">{directComparison
                        ? alternativeProgress.label
                        : "Hypotheses and scholarly citation suggestions saved"}</p>
                    </div>
                    {directComparison ? <div className="six-mechanism-comparison-cards">
                      {assessedPlannedAlternatives.map(({ candidate, assessed }) =>
                        renderDirectMechanismCard(
                          assessed,
                          dispositionsById.get(candidate.id),
                        ))}
                      {unmatchedAssessedAlternatives.map((card) =>
                        renderDirectMechanismCard(
                          card,
                          dispositionsById.get(card.candidateId ?? card.id),
                        ))}
                      {provisionalPlannedAlternatives.map(
                        renderProvisionalMechanismCard)}
                    </div> : (
                      <div className="six-mechanism-comparison-cards"
                        aria-label="Generated alternative mechanism hypotheses">
                        {activeDirectCandidates.map(
                          renderProvisionalMechanismCard)}
                      </div>
                    )}
                  </section>
                  {historicalDirectCandidates.length ? (
                    <details className="six-study-context-details">
                      <summary>
                        Merged or excluded candidate history ({historicalDirectCandidates.length})
                      </summary>
                      <ul>
                        {historicalDirectCandidates.map((candidate) => {
                          const disposition = dispositionsById.get(candidate.id);
                          return (
                            <li key={candidate.id}>
                              <strong>{candidate.conceptLabel}</strong>: {disposition?.status.replaceAll("_", " ")}
                              {disposition?.mergedInto
                                ? ` into ${disposition.mergedInto}`
                                : ""}. {disposition?.reason}
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                  ) : null}
                  {directComparison?.predictions.length ? (
                    <div className="six-prediction-matrix" tabIndex={0}>
                    <table>
                      <caption>Compare observable predictions</caption>
                      <thead>
                        <tr>
                          <th scope="col">Observation to collect</th>
                          {predictionMechanisms.map((card) => (
                            <th scope="col" key={card.id}>{card.concept}</th>
                          ))}
                          <th scope="col">Measurement boundary</th>
                        </tr>
                      </thead>
                      <tbody>
                        {directComparison.predictions.map((row) => (
                          <tr key={row.id}>
                            <th scope="row">
                              {row.observation}<br />
                              <small>{row.measure}</small>
                            </th>
                            {predictionMechanisms.map((mechanism) => {
                              const pattern = row.patterns.find((item) =>
                                item.mechanismId === mechanism.id);
                              return <td key={mechanism.id}
                                data-label={mechanism.concept}>
                                <small>{(pattern?.status ?? "not_assessed").replaceAll("_", " ")}</small><br />
                                {pattern?.detail ??
                                  "Not assessed in the saved bounded batch."}
                                {pattern?.citations?.length
                                  ? <><br /><cite>{pattern.citations.join("; ")}</cite></>
                                  : null}
                              </td>;
                            })}
                            <td data-label="Measurement boundary">
                              {row.timing} · {row.level}<br />
                              <small>{row.caution}</small>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  ) : null}
                  {directComparison && !directComparison.predictions.length ? (
                    <div className="six-mechanism-empty-state">
                      <h3>Observable predictions</h3>
                      <p>{screen5PredictionEmptyMessage({
                        completionStatus: directComparison.completion?.status,
                        executionPhase: directExecution?.phase,
                      })}</p>
                    </div>
                  ) : null}
                  {directComparison ? (
                    <details className="six-study-context-details">
                      <summary>Overall assessment and unresolved distinctions</summary>
                      <p>{directComparison.summary}</p>
                      {directComparison.gaps.length ? (
                        <ul>{directComparison.gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul>
                      ) : <p>No additional evidence gap was recorded.</p>}
                    </details>
                  ) : null}
                  {directExecution && directExecution.phase !== "completed" ? (
                    <section className="six-direct-execution six-direct-execution--partial">
                      <h4>{directPlan
                        ? "Alternative mechanisms saved"
                        : directScreen5StatusLabel(directExecution)}</h4>
                      {automaticContinuationActive ? (
                        <p className="six-direct-action-status" role="status">
                          Finishing the requested mechanism and literature
                          checks from the saved checkpoint…
                        </p>
                      ) : null}
                      {directExecution.nextEligibleAt ? (
                        <p className="six-readonly-note" role="status">
                          Next batch eligible after {new Date(
                            directExecution.nextEligibleAt,
                          ).toLocaleTimeString()}. {readiness.canDispatch
                            ? "The saved job can resume from its next durable checkpoint."
                            : "The saved partial comparison will not spend another inference until the next batch is explicitly authorized."}
                        </p>
                      ) : null}
                      {!automaticContinuationActive ? (
                        <p className="six-readonly-note">
                          The generated alternatives remain available. Any
                          unfinished evidence assessment does not change the
                          saved mechanism set.
                        </p>
                      ) : null}
                      {directAuthorizationNeeded ? (
                        <p className="six-readonly-note">
                          Continuing authorizes another bounded model assessment
                          for this saved input. The existing scope, due time,
                          allowance, and one-retry limit are unchanged.
                        </p>
                      ) : null}
                      {props.onAdvanceProvider && !automaticContinuationActive &&
                          (localRecovery || directAuthorizationNeeded ||
                            readiness.canAdvanceWithoutInference ||
                            readiness.canDispatch) ? (
                        <button
                          type="button"
                          className={directAuthorizationNeeded
                            ? "six-screen5-execution-primary" : "six-secondary"}
                          disabled={props.disabled ||
                            directActionBusy ||
                            (Boolean(props.generationUnavailableReason) && !localRecovery) ||
                            (directExecution.phase === "waiting_for_rate_limit" &&
                              !directAuthorizationNeeded)}
                          onClick={() => void props.onAdvanceProvider?.(
                            false,
                            directAuthorizationNeeded,
                          )}
                        >
                          {localRecovery ? recoveryLabel : "Continue evidence checks"}
                        </button>
                      ) : null}
                      <ProcessingStatus
                        active={mechanismProcessingActive}
                        stage={mechanismProcessingStage}
                      />
                    </section>
                  ) : null}
                </section>
              ) : hostResult ? (
                <section className="six-mechanism-comparison">
                  <div className="six-section-heading">
                    <div><p className="six-kicker">Conceptual mechanism synthesis</p><h3>Focal process and distinct alternatives</h3></div>
                    <span>Validated · noncanonical</span>
                  </div>
                  <div className="six-mechanism-comparison-cards">
                    {mechanismCards.map((card) => (
                      <article key={card.id} data-relation={card.relationToFocal}>
                        <div><span>{card.relationToFocal.replaceAll("_", " ")}</span><h4>{card.conceptLabel}</h4></div>
                        <p className="six-process-chain">{card.processChain.join(" → ")}</p>
                        {card.perspective ? <p><strong>Perspective:</strong> {card.perspective} <small>({card.perspectiveOrigin.replaceAll("_", " ")})</small></p> : null}
                        <p>{card.connectedArgument}</p>
                        <p><strong>Fit to this study:</strong> {card.fitToStudy}</p>
                        <p><strong>Material transfer limit:</strong> {card.materialTransferLimit}</p>
                        <p><strong>Evidence basis:</strong> {card.evidenceStatus.replaceAll("_", " ")}</p>
                        {card.propositions.length ? (
                          <details>
                            <summary>Source-linked propositions</summary>
                            <ul>{card.propositions.map((proposition, index) => {
                              const work = currentRun.works.find(({ id }) => id === proposition.workId);
                              return <li key={`${proposition.workId}-${index}`}>
                                {proposition.supportedStatement} ({work?.authors[0] ?? "Source"}, {work?.publicationYear ?? "year unknown"}). <small>{proposition.transferLimit}</small>
                              </li>;
                            })}</ul>
                          </details>
                        ) : <p className="six-readonly-note">No inspected scholarly passage is claimed as support for this analytical hypothesis.</p>}
                      </article>
                    ))}
                  </div>
                  {hostResult.predictionMatrix.length ? (
                    <div className="six-prediction-matrix" tabIndex={0}>
                      <table>
                        <caption>Compare observable predictions</caption>
                        <thead><tr><th scope="col">Observation and candidate measure</th>{mechanismCards.map((card) => <th scope="col" key={card.id}>{card.conceptLabel}</th>)}<th scope="col">Design and feasibility</th></tr></thead>
                        <tbody>
                          {hostResult.predictionMatrix.map((row) => (
                            <tr key={row.id}>
                              <th scope="row">{row.observationConcept}<br /><small>{row.candidateMeasure}{row.dataSource ? ` · ${row.dataSource}` : " · data source not established"}</small></th>
                              {mechanismCards.map((card) => <td key={card.id} data-label={card.conceptLabel}>{row.patterns.find(({ mechanismId }) => mechanismId === card.id)?.expectedPattern ?? "No unique prediction stated"}</td>)}
                              <td data-label="Design and feasibility">{row.timing} · {row.level}<br /><small>{row.aggregationRequirement} · {row.conditions} · {row.distinction.replaceAll("_", " ")} · feasibility {row.feasibility.replaceAll("_", " ")}</small></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                  {!hostResult.predictionMatrix.length ? (
                    <div className="six-mechanism-empty-state">
                      <h3>Observable predictions</h3>
                      <p>No comparison predictions were generated in this assessment.</p>
                    </div>
                  ) : null}
                  <p>{hostResult.overallQualification}</p>
                  <details>
                    <summary>Evidence and identification limitations</summary>
                    <ul>{hostResult.evidenceLimitations.map((item) => <li key={item}>{item}</li>)}</ul>
                  </details>
                  <p className="six-readonly-note">
                    Reading these cards or matrix cells does not accept a mechanism, mutate the study, inspect outcome values, or run a new analysis.
                  </p>
                </section>
              ) : directExecution ? (
                <section className="six-host-assessment six-host-assessment--mechanism six-direct-execution">
                  <p className="six-kicker">Alternative mechanisms and evidence checks</p>
                  <h3>{directScreen5StatusLabel(directExecution)}</h3>
                  {![
                    "planning_running",
                    "assessment_running",
                    "validating",
                    "completed",
                  ].includes(directExecution.phase) ? (
                    <p>{screen5ReadinessActionLabel(readiness.nextAction)}</p>
                  ) : null}
                  <p>
                    {currentRun.planning?.plan
                      ? `${currentRun.planning.plan.candidates.length} provisional alternative${currentRun.planning.plan.candidates.length === 1 ? "" : "s"} and their ChatGPT-suggested citations are saved.`
                      : "The saved setup preserves the exact focal process and proposes only a compact, provisional search plan."}
                  </p>
                  {directExecution.phase === "waiting_for_rate_limit" &&
                      directExecution.nextEligibleAt ? (
                    <p className="six-readonly-note" role="status">
                      Evidence assessment is eligible after {new Date(
                        directExecution.nextEligibleAt,
                      ).toLocaleTimeString()}. {readiness.canDispatch
                        ? "The saved job can resume from its next durable checkpoint."
                        : "The checkpoint remains saved; another inference is not sent without the required authorization and allowance."}
                    </p>
                  ) : null}
                  {directExecution.lastError ? (
                    <div className="six-alert six-alert--info">
                      <strong>{directExecution.lastError.code.replaceAll("_", " ")}</strong>
                      <p>{directExecution.lastError.message}</p>
                    </div>
                  ) : null}
                  {automaticContinuationActive ? (
                    <p className="six-direct-action-status" role="status">
                      Finishing the requested mechanism assessment
                      from the saved checkpoint…
                    </p>
                  ) : null}
                  {directAuthorizationNeeded ? (
                    <p className="six-readonly-note">
                      Continuing authorizes the next bounded model assessment
                      for this saved input and its existing remaining stages.
                      Revised input asks again here; no PowerShell ID is needed.
                    </p>
                  ) : null}
                  {localRecovery && props.onAdvanceProvider ? (
                    <button type="button" className="six-secondary"
                      disabled={props.disabled || directActionBusy}
                      onClick={() => void props.onAdvanceProvider?.(false, false)}>
                      {recoveryLabel} · no model request
                    </button>
                  ) : directExecution.lastError?.retryable &&
                      directExecution.retryCount < 1 &&
                      props.onAdvanceProvider ? (
                    <button
                      type="button"
                      className={directAuthorizationNeeded
                        ? "six-screen5-execution-primary" : "six-secondary"}
                      disabled={props.disabled || directActionBusy ||
                        Boolean(props.generationUnavailableReason)}
                      onClick={() =>
                        void props.onAdvanceProvider?.(
                          true,
                          directAuthorizationNeeded,
                        )}
                    >
                      {directAuthorizationNeeded
                        ? "Authorize one bounded retry"
                        : "Use the job’s one bounded retry"}
                    </button>
                  ) : !automaticContinuationActive && ![
                      "completed",
                      "configuration_required",
                      "failed",
                      "outcome_unknown",
                    ].includes(directExecution.phase) &&
                      props.onAdvanceProvider ? (
                    <button
                      type="button"
                      className={directAuthorizationNeeded
                        ? "six-screen5-execution-primary" : "six-secondary"}
                      disabled={props.disabled || directActionBusy ||
                        Boolean(props.generationUnavailableReason) ||
                        (directExecution.phase === "waiting_for_rate_limit" &&
                          !directAuthorizationNeeded)}
                      onClick={() =>
                        void props.onAdvanceProvider?.(
                          false,
                          directAuthorizationNeeded,
                        )}
                    >
                      {directAuthorizationNeeded
                        ? directExecution.phase === "planning_queued"
                          ? "Generate alternative mechanisms"
                          : "Continue evidence checks"
                        : directExecution.phase === "planning_queued"
                          ? "Generate alternative mechanisms"
                          : directPlan
                            ? "Continue mechanism assessment"
                            : "Continue evidence checks"}
                    </button>
                  ) : null}
                  <ProcessingStatus
                    active={mechanismProcessingActive}
                    stage={mechanismProcessingStage}
                  />
                  <p className="six-readonly-note">
                    The key remains server-only. Status reads do not spend an
                    inference attempt, and an uncertain request is never resent
                    automatically.
                  </p>
                </section>
              ) : directRouteActive ? (
                <section className="six-host-assessment six-host-assessment--mechanism six-direct-execution">
                  <p className="six-kicker">Alternative mechanisms</p>
                  <h3>Generation unavailable</h3>
                  <p>{screen5ReadinessActionLabel(readiness.nextAction)}</p>
                  <p className="six-readonly-note">
                    The historical host run remains readable, but this route will not prepare, deliver, restore, or poll a signed host task.
                  </p>
                  <button
                    type="button"
                    className="six-link-button"
                    onClick={() => void copyExecutionDiagnostic()}
                  >
                    Copy safe diagnostic summary
                  </button>
                  {diagnosticCopyNotice ? (
                    <p className="six-readonly-note" role="status">
                      {diagnosticCopyNotice}
                    </p>
                  ) : null}
                  {diagnosticFallback ? (
                    <textarea
                      className="six-diagnostic-fallback"
                      aria-label="Selectable safe execution diagnostic"
                      readOnly
                      value={diagnosticFallback}
                    />
                  ) : null}
                </section>
              ) : (
                <section className="six-host-assessment six-host-assessment--mechanism">
                  <p className="six-kicker">Screen 5 execution</p>
                  <h3>
                    {currentRun.planning?.plan && comparisonTask
                      ? `Evidence assessment · ${comparisonTask.status.replaceAll("-", " ")}`
                      : currentRun.planning?.plan
                        ? "Mechanisms and evidence saved · assessment ready"
                        : planningTask
                          ? `Mechanism planning · ${planningTask.status.replaceAll("-", " ")}`
                          : "Ready to plan alternatives"}
                  </h3>
                  {currentRun.planning?.plan ? (
                    <p>
                      {currentRun.planning.plan.candidates.length} provisional
                      candidate{currentRun.planning.plan.candidates.length === 1
                        ? ""
                        : "s"}; no prediction was inferred from labels.
                    </p>
                  ) : (
                    <p>
                      Mechanism planning preserves your exact focal process,
                      proposes bounded alternatives, and adds one scholarly
                      citation suggestion to each pathway.
                    </p>
                  )}
                  <p>{currentRun.hostComparison.limitation}</p>
                  {(planningTask && !studyFirstHostTaskIsTerminal(planningTask)) ||
                      (comparisonTask &&
                        !studyFirstHostTaskIsTerminal(comparisonTask)) ? (
                    <p className="six-readonly-note" role="status">
                      This saved signed task continues after the foreground
                      wait. ShockAudit checks it automatically while the panel
                      is open and restores it after reopening.
                    </p>
                  ) : null}
                  <p className="six-readonly-note">
                    Historical Screen 5 host state is view-only. ShockAudit
                    will not prepare, deliver, poll, retry, or resume this task;
                    saved inputs and evidence remain inspectable.
                  </p>
                  <button
                    type="button"
                    className="six-link-button"
                    onClick={() => void copyExecutionDiagnostic()}
                  >
                    Copy safe diagnostic summary
                  </button>
                  {diagnosticCopyNotice ? (
                    <p className="six-readonly-note" role="status">
                      {diagnosticCopyNotice}
                    </p>
                  ) : null}
                  {diagnosticFallback ? (
                    <textarea
                      className="six-diagnostic-fallback"
                      aria-label="Selectable safe execution diagnostic"
                      readOnly
                      value={diagnosticFallback}
                    />
                  ) : null}
                </section>
              )}
              <details className="six-scholarship-evidence">
                <summary>
                  Literature and source access ({
                    allSuggestedCitations.length + currentRun.works.length})
                </summary>
                {allSuggestedCitations.length ? (
                  <>
                  <p className="six-readonly-note">
                    ChatGPT suggested these scholarly works for narrow
                    propositions in the mechanism cards. ShockAudit did not use
                    OpenAlex or Crossref and has not independently verified the
                    bibliographic details. Check the original publication before
                    citing it in research output.
                  </p>
                  <div className="six-scholarship-grid">
                    {allSuggestedCitations.map(({ mechanismLabel, citation }) => (
                      <article key={citation.id}>
                        <div className="six-scholarship-card-heading">
                          <h4>{citation.title}</h4>
                          <span data-access="model_suggested">
                            ChatGPT suggested
                          </span>
                        </div>
                        <p><strong>Mechanism:</strong> {mechanismLabel}</p>
                        <p className="six-full-citation">
                          {citation.fullCitation}
                        </p>
                        <p><strong>Claim it may support:</strong>{" "}
                          {citation.supportScope}</p>
                        {citation.stableUrl ? <p><a
                          href={citation.stableUrl} target="_blank"
                          rel="noreferrer">Open suggested publication record</a></p>
                          : <p className="six-readonly-note">No DOI or stable URL was supplied. Verify the title, authors, venue, and year manually.</p>}
                      </article>
                    ))}
                  </div>
                  </>
                ) : null}
                {currentRun.works.length ? <details
                  className="six-study-context-details">
                  <summary>Earlier provider-derived literature records ({
                    currentRun.works.length})</summary>
                  <p className="six-readonly-note">These records belong to an
                    earlier saved workflow. New Screen 5 runs no longer call
                    OpenAlex or Crossref.</p>
                  <div className="six-scholarship-grid">
                    {currentRun.works.map((work) => <article key={work.id}>
                      <div className="six-scholarship-card-heading">
                        <h4>{work.title}</h4>
                        <span data-access={work.access.level}>{
                          work.access.level === "abstract_inspected"
                            ? "Abstract inspected" : "Metadata only"}</span>
                      </div>
                      <p className="six-full-citation">{work.authors.length
                        ? work.authors.join(", ") : "Author unavailable"}{" "}
                        ({work.publicationYear ?? "year unknown"}).{" "}
                        <cite>{work.title}</cite>{work.publicationVenue
                          ? `. ${work.publicationVenue}.` : "."}</p>
                      <p>{work.claimBoundary}</p>
                      <ul>{work.stableLocators.map((locator) => <li
                        key={locator}><a href={locator} target="_blank"
                        rel="noreferrer">Open stable record</a></li>)}</ul>
                    </article>)}
                  </div>
                </details> : null}
                {!allSuggestedCitations.length && !currentRun.works.length ? (
                  <p>No scholarly citation is stored for this earlier run.</p>
                ) : null}
              </details>
            </>
          )}
          {props.planningHostNotice ? (
            <p className="six-readonly-note" role="status">
              {props.planningHostNotice}
            </p>
          ) : null}
          {props.hostNotice ? <p className="six-readonly-note" role="status">{props.hostNotice}</p> : null}
          {planningTask?.status === "applied" &&
              !studyFirstHostResult(
                SCREEN05_THEORETICAL_PLANNING_TASK,
                planningTask.result,
              ) ? (
            <p className="six-field-error" role="alert">
              The stored planning result did not match the theoretical-planning
              contract, so retrieval did not start.
            </p>
          ) : null}
          {expectedHostKey && props.hostEntry && !hostResult &&
              props.hostEntry.task.status === "applied" ? (
            <p className="six-field-error" role="alert">
              The stored signed-host result did not match the current evidence binding and was not rendered.
            </p>
          ) : null}
        </section>
      ) : (
        <section className="six-mechanism-empty-state">
          <h3>Start with your proposed process</h3>
          <p>
            No mechanism search has run. Opening this screen does not invent a
            theory, accept the legacy explanation, or spend a retrieval budget.
          </p>
        </section>
      )}

      {props.workspace.previousCompatibleRun && currentRun &&
          props.workspace.previousCompatibleRun.input.inputFingerprint !==
            currentRun.input.inputFingerprint ? (
        <details className="six-event-coverage">
          <summary>Previous compatible evidence run</summary>
          <p>
            The earlier run is preserved for input revision {props.workspace.previousCompatibleRun.input.revision}, with {props.workspace.previousCompatibleRun.works.length} work record{props.workspace.previousCompatibleRun.works.length === 1 ? "" : "s"}. It is not presented as answering the edited focal process.
          </p>
        </details>
      ) : null}
    </section>
  );
}

function usesCanonicalFailureRecovery(action: unknown) {
  return sixScreenActionPolicy(action)?.failureRecovery ===
    "canonical_status";
}

function savedAnalysisCheckpoint(
  snapshot: SixScreenWorkflowPrivateSnapshot,
  mutation: Record<string, unknown>,
  projection?: SixScreenWorkflowPublicProjection | null,
) {
  if (mutation.action === "open_screen_4") {
    const expected = typeof mutation.expectedInvestigationFingerprint ===
        "string"
      ? mutation.expectedInvestigationFingerprint
      : null;
    const investigation = [...(snapshot.state.studyFirstEventInvestigations ?? [])]
      .reverse().find((item) => !expected ||
        item.investigationFingerprint === expected);
    return {
      // Source dispatch and task receipts live in the durable research-task
      // record rather than the workflow snapshot. Do not infer either here.
      dispatchCertainty: "unknown" as const,
      receiptSaved: false,
      validatedArtifactSaved: Boolean(investigation &&
        investigation.status !== "planned"),
    };
  }
  if (mutation.action === "refresh_study_first_events") {
    const prior = (snapshot.state.studyFirstEventInvestigations ?? []).find(
      (item) => item.investigationFingerprint ===
        mutation.expectedInvestigationFingerprint,
    );
    const refreshed = prior
      ? [...(snapshot.state.studyFirstEventInvestigations ?? [])].reverse()
        .find((item) => item.previousSnapshotId === prior.snapshotId)
      : null;
    return {
      dispatchCertainty: "unknown" as const,
      receiptSaved: false,
      validatedArtifactSaved: Boolean(refreshed &&
        refreshed.status !== "planned"),
    };
  }
  if (mutation.action === "personalize_screen3_advice" ||
    mutation.action === "personalize_screen6_plan") {
    const entries = mutation.action === "personalize_screen3_advice"
      ? snapshot.state.screen3Contextualizations ?? []
      : snapshot.state.screen6Personalizations ?? [];
    const item = [...entries].reverse().find((entry) =>
      mutation.action === "personalize_screen3_advice"
        ? "adviceFingerprint" in entry &&
          entry.adviceFingerprint === mutation.expectedAdviceFingerprint
        : "inputFingerprint" in entry &&
          entry.inputFingerprint === mutation.expectedPlanFingerprint);
    return {
      taskStatus: item?.status ?? null,
      taskFailureCode: item?.failureCode ?? null,
      taskFailureStage: item?.failureStage ?? null,
      dispatchCertainty: item?.dispatchState ?? "unknown" as const,
      receiptSaved: Boolean(item?.receipt),
      validatedArtifactSaved: item?.status === "completed" &&
        item.supplement !== null,
    };
  }
  if (mutation.action === "analyze_study_first_events") {
    const workspace = projection?.studyFirstEventInvestigationWorkspace;
    const investigation = workspace?.investigation;
    const queue = workspace?.interpretationQueue;
    if (investigation && queue &&
        investigation.investigationFingerprint ===
          mutation.expectedInvestigationFingerprint) {
      const providerStep = queue.diagnosis?.steps.find(({ id }) =>
        id === "provider_dispatch");
      const dispatchCertainty = queue.completedCount > 0 ||
          providerStep?.status === "complete" ||
          queue.diagnostic?.dispatchState === "dispatched"
        ? "dispatched" as const
        : queue.diagnostic?.dispatchState === "not_dispatched" ||
            queue.diagnosis?.currentStep === "packet_preparation" ||
            queue.diagnosis?.currentStep === "allowance_reservation"
          ? "not_dispatched" as const
          : "unknown" as const;
      return {
        dispatchCertainty,
        receiptSaved: queue.completedCount > 0 ||
          Boolean(queue.diagnostic?.receiptSaved),
        validatedArtifactSaved: queue.completedCount > 0,
      };
    }
    const item = [...(snapshot.state.screen4InterpretationAttempts ?? [])]
      .reverse().find((entry) => entry.investigationFingerprint ===
        mutation.expectedInvestigationFingerprint);
    return {
      dispatchCertainty: item?.dispatchState ?? "unknown" as const,
      receiptSaved: Boolean(item?.receipt),
      validatedArtifactSaved: item?.status === "completed" &&
        item.result !== null,
    };
  }
  const attempt = snapshot.state.studyFirstMechanismRuns?.at(-1)
    ?.providerExecution?.attempts.at(-1);
  return {
    dispatchCertainty: attempt?.networkInvocation === "not_started"
      ? "not_dispatched" as const : attempt?.networkInvocation === "invoked"
        ? "dispatched" as const : "unknown" as const,
    receiptSaved: Boolean(attempt?.responseReceipt),
    validatedArtifactSaved: Boolean(attempt?.wireCheckpoint),
  };
}

function screen4AssessmentProgressFingerprint(
  projection: SixScreenWorkflowPublicProjection | null | undefined,
  mutation: Record<string, unknown>,
) {
  if (!projection || mutation.action !== "analyze_study_first_events" ||
      typeof mutation.expectedInvestigationFingerprint !== "string") {
    return null;
  }
  const workspace = projection.studyFirstEventInvestigationWorkspace;
  const investigation = workspace.investigation;
  const queue = workspace.interpretationQueue;
  if (!investigation?.presentation || !queue ||
      investigation.investigationFingerprint !==
        mutation.expectedInvestigationFingerprint) return null;
  const visibleEventIds = investigation.presentation.visibleEventIds;
  const resultEventIds = queue.results.map(({ eventId }) => eventId);
  if (queue.totalCount !== visibleEventIds.length ||
      queue.completedCount !== resultEventIds.length ||
      new Set(resultEventIds).size !== resultEventIds.length ||
      resultEventIds.some((id) => !visibleEventIds.includes(id))) return null;
  return {
    runId: projection.runId,
    investigationFingerprint: investigation.investigationFingerprint,
    taskFingerprint: queue.taskFingerprint,
    completedCount: queue.completedCount,
    facts: fingerprintSixScreenValue({
      status: queue.status,
      retryEligibility: queue.retryEligibility,
      completedCount: queue.completedCount,
      totalCount: queue.totalCount,
      results: queue.results,
      error: queue.error,
      diagnostic: queue.diagnostic,
      diagnosis: queue.diagnosis ? {
        currentStep: queue.diagnosis.currentStep,
        batchNumber: queue.diagnosis.batchNumber,
        batchCount: queue.diagnosis.batchCount,
        steps: queue.diagnosis.steps.map(({ id, status, detail }) => ({
          id, status, detail,
        })),
      } : null,
    }),
  };
}

/** Compact Screen 4 assessments intentionally do not change the monolithic
 * workflow revision. A verified recovery projection is nevertheless durable:
 * it is read from the authenticated assessment store and is bound to the
 * exact investigation, task, and displayed event IDs. */
function screen4AssessmentProgressRecovered(
  before: SixScreenWorkflowPublicProjection | null | undefined,
  after: SixScreenWorkflowPublicProjection | null | undefined,
  mutation: Record<string, unknown>,
) {
  if (!before || !after || before.runId !== after.runId) return false;
  const prior = screen4AssessmentProgressFingerprint(before, mutation);
  const current = screen4AssessmentProgressFingerprint(after, mutation);
  if (!current) return false;
  if (!prior) {
    return current.completedCount > 0 ||
      after.studyFirstEventInvestigationWorkspace.interpretationQueue
        ?.status !== "ready";
  }
  return current.taskFingerprint === prior.taskFingerprint &&
    current.investigationFingerprint === prior.investigationFingerprint &&
    current.facts !== prior.facts;
}

type Screen4AssessmentQueue = NonNullable<
  StudyFirstEventInvestigationWorkspace["interpretationQueue"]
>;

/** One explicit UI action may advance every bounded Screen 4 batch, while
 * each callback invocation remains one independently acknowledged tool call.
 * A missing or unchanged checkpoint stops the sequence rather than risking a
 * duplicate model request. */
export async function advanceScreen4AssessmentQueue(input: {
  initialQueue: Screen4AssessmentQueue;
  advance: (
    queue: Screen4AssessmentQueue,
    batchIndex: number,
  ) => Promise<Screen4AssessmentQueue | null>;
}) {
  let latest = input.initialQueue;
  for (let batch = 0; batch < SCREEN4_INTERPRETATION_MAX_BATCHES;
    batch += 1) {
    if (latest.status === "completed" || latest.retryEligibility === "none") {
      break;
    }
    if (!["new_request", "local_revalidation"].includes(
      latest.retryEligibility)) break;
    if (latest.retryEligibility !== "local_revalidation" &&
        !latest.readiness.canDispatch) break;
    const next = await input.advance(latest, batch);
    if (!next || next.taskFingerprint !== latest.taskFingerprint) break;
    const advanced = next.completedCount !== latest.completedCount ||
      next.status !== latest.status ||
      next.retryEligibility !== latest.retryEligibility;
    latest = next;
    if (!advanced) break;
  }
  return latest;
}

function screen4DiscoveryProgressFingerprint(
  projection: SixScreenWorkflowPublicProjection,
) {
  const workspace = projection.studyFirstEventInvestigationWorkspace;
  const task = workspace.discoveryTask;
  const investigation = workspace.investigation;
  if (!task || !investigation) return null;
  return {
    runId: projection.runId,
    snapshotId: investigation.snapshotId,
    previousSnapshotId: investigation.previousSnapshotId,
    investigationFingerprint: investigation.investigationFingerprint,
    planFingerprint: investigation.plan.planFingerprint,
    taskId: task.taskId,
    facts: fingerprintSixScreenValue({
      investigationStatus: investigation.status,
      presentationFingerprint:
        investigation.presentation?.presentationFingerprint ?? null,
      visibleEvents: (investigation.presentation?.visibleEventIds ?? [])
        .map((id) => {
          const occurrence = investigation.occurrences.find((item) =>
            item.id === id);
          return {
            id,
            candidateFingerprint: occurrence?.candidateFingerprint ?? null,
          };
        }),
      state: task.state,
      stage: task.stage,
      nextAction: task.nextAction,
      completedStepCount: task.completedStepCount,
      totalStepCount: task.totalStepCount,
      pendingStepCount: task.pendingStepCount,
      queryCount: task.queryCount,
      documentCount: task.documentCount,
      recordsReceived: task.recordsReceived,
      recordsAccepted: task.recordsAccepted,
      stopReason: task.stopReason,
      documentedOccurrences: workspace.documentedOccurrences.map((item) => ({
        id: item.id,
        candidateFingerprint: item.candidateFingerprint,
      })),
    }),
  };
}

function screen4DiscoveryProgressRecovered(
  before: SixScreenWorkflowPublicProjection | null | undefined,
  after: SixScreenWorkflowPublicProjection | null | undefined,
  mutation: Record<string, unknown>,
) {
  if (!before || !after || before.runId !== after.runId ||
      !["open_screen_4", "refresh_study_first_events"].includes(
        String(mutation.action))) return false;
  const prior = screen4DiscoveryProgressFingerprint(before);
  const current = screen4DiscoveryProgressFingerprint(after);
  if (!current || current.runId !== after.runId) return false;
  const priorInvestigation = before.studyFirstEventInvestigationWorkspace
    .investigation;
  const currentInvestigation = after.studyFirstEventInvestigationWorkspace
    .investigation;
  if (!currentInvestigation) return false;
  if (mutation.action === "refresh_study_first_events") {
    const expected = mutation.expectedInvestigationFingerprint;
    if (typeof expected !== "string" || !prior || !priorInvestigation ||
        priorInvestigation.investigationFingerprint !== expected) return false;
    const sameBoundTask =
      currentInvestigation.investigationFingerprint ===
        priorInvestigation.investigationFingerprint &&
      currentInvestigation.snapshotId === priorInvestigation.snapshotId &&
      current.planFingerprint === prior.planFingerprint &&
      current.taskId === prior.taskId;
    const boundRefresh = currentInvestigation.previousSnapshotId ===
      priorInvestigation.snapshotId;
    if (!sameBoundTask && !boundRefresh) return false;
  } else {
    const expected = mutation.expectedInvestigationFingerprint;
    if (typeof expected === "string" &&
        current.investigationFingerprint !== expected) return false;
    if (prior) {
      const sameBoundTask = current.snapshotId === prior.snapshotId &&
        current.investigationFingerprint === prior.investigationFingerprint &&
        current.planFingerprint === prior.planFingerprint &&
        current.taskId === prior.taskId;
      const finalizedBoundTask =
        current.previousSnapshotId === prior.snapshotId &&
        current.planFingerprint === prior.planFingerprint &&
        current.taskId === prior.taskId &&
        ["complete", "complete_zero"].includes(
          after.studyFirstEventInvestigationWorkspace.discoveryTask?.state ??
            "") &&
        after.studyFirstEventInvestigationWorkspace.discoveryTask
          ?.nextAction === "none";
      if (!sameBoundTask && !finalizedBoundTask) return false;
    }
  }
  // A changed view, loading flag or workflow revision is not part of this
  // fingerprint. Only authenticated durable task facts and occurrence IDs can
  // establish same-revision recovery. On the first Screen 4 open the earlier
  // public projection can legitimately have no discovery task even though the
  // canonical state already contains its planned investigation. A verified
  // current task with source facts is therefore sufficient to recover that
  // first display; requiring a prior public task left a stale serialization
  // warning above otherwise usable alternative shocks.
  if (!prior) {
    const recoveredWorkspace =
      after.studyFirstEventInvestigationWorkspace;
    return mutation.action === "open_screen_4" && Boolean(
      current.taskId && (
        recoveredWorkspace.documentedOccurrences.length > 0 ||
        ["partial", "complete", "complete_zero"].includes(
          recoveredWorkspace.discoveryTask?.state ?? "",
        )
      ),
    );
  }
  return current.facts !== prior.facts;
}

function screen5AnalysisOutputFingerprint(
  run: StudyFirstMechanismRun,
) {
  const plan = run.planning?.status === "completed"
    ? run.planning.plan
    : null;
  const comparison = run.providerExecution?.comparison ?? null;
  const evidence = run.providerExecution?.evidencePacket ?? null;
  const receipts = (run.providerExecution?.attempts ?? []).flatMap((attempt) => {
    const receipt = attempt.responseReceipt;
    return receipt && ["schema_valid", "aggregate_saved"].includes(receipt.status) &&
      receipt.wireFingerprint && !receipt.validationIssues.length
      ? [{ stage: attempt.stage, wireFingerprint: receipt.wireFingerprint,
          contentFingerprint: receipt.contentFingerprint }] : [];
  });
  const terminalReceipts = (run.providerExecution?.attempts ?? [])
    .flatMap((attempt) => {
      const receipt = attempt.responseReceipt;
      return receipt && ["failed", "outcome_unknown"].includes(attempt.status)
        ? [{
          id: attempt.id,
          stage: attempt.stage,
          status: attempt.status,
          errorCode: attempt.errorCode,
          receiptStatus: receipt.status,
          contentFingerprint: receipt.contentFingerprint,
          validationIssues: receipt.validationIssues.map((issue) => ({
            code: issue.code,
            path: issue.path,
            validationRevision: issue.validationRevision ?? null,
          })),
        }]
        : [];
    });
  if (!plan && !comparison && !evidence && !receipts.length &&
      !terminalReceipts.length) return null;
  return fingerprintSixScreenValue({
    planFingerprint: plan?.planFingerprint ?? null,
    comparisonFingerprint: comparison?.comparisonFingerprint ?? null,
    evidencePacketFingerprint: evidence?.packetFingerprint ?? null,
    receipts,
    terminalReceipts,
  });
}

/**
 * Accepts a recovered Screen 5 artifact only on the frozen job that the
 * failed panel call actually advanced. Runs are immutable checkpoints, so the
 * recovered current run must descend from the exact pre-call run while
 * retaining its input, context, theoretical problem, and provider job.
 */
export function screen5AnalysisArtifactRecovered(input: {
  beforeRun: StudyFirstMechanismRun | null;
  afterRun: StudyFirstMechanismRun | null;
  afterRuns: readonly StudyFirstMechanismRun[];
  operationId: unknown;
}) {
  const { beforeRun, afterRun } = input;
  const beforeExecution = beforeRun?.providerExecution;
  const afterExecution = afterRun?.providerExecution;
  if (
    !beforeRun || !afterRun || !beforeExecution || !afterExecution ||
    typeof input.operationId !== "string" || !input.operationId.trim() ||
    beforeRun.id === afterRun.id ||
    beforeRun.context.contextFingerprint !==
      afterRun.context.contextFingerprint ||
    beforeRun.input.id !== afterRun.input.id ||
    beforeRun.input.revision !== afterRun.input.revision ||
    beforeRun.input.inputFingerprint !== afterRun.input.inputFingerprint ||
    beforeRun.theoreticalProblem?.problemFingerprint !==
      afterRun.theoreticalProblem?.problemFingerprint ||
    beforeExecution.id !== afterExecution.id ||
    beforeExecution.provider !== afterExecution.provider ||
    beforeExecution.modelRequested !== afterExecution.modelRequested ||
    beforeExecution.pilotId !== afterExecution.pilotId ||
    beforeExecution.createdAt !== afterExecution.createdAt ||
    beforeExecution.inputFingerprint !== afterExecution.inputFingerprint ||
    beforeExecution.problemFingerprint !== afterExecution.problemFingerprint
  ) return false;

  const runsById = new Map(input.afterRuns.map((run) => [run.id, run]));
  const retainedAnchor = runsById.get(beforeRun.id);
  if (!retainedAnchor ||
      retainedAnchor.runFingerprint !== beforeRun.runFingerprint) return false;
  const visited = new Set<string>();
  let cursor: StudyFirstMechanismRun | undefined = afterRun;
  let descendsFromAttemptedRun = false;
  while (cursor && !visited.has(cursor.id)) {
    visited.add(cursor.id);
    if (cursor.previousRunId === beforeRun.id) {
      descendsFromAttemptedRun = true;
      break;
    }
    cursor = cursor.previousRunId
      ? runsById.get(cursor.previousRunId)
      : undefined;
  }
  if (!descendsFromAttemptedRun) return false;

  const beforeOutput = screen5AnalysisOutputFingerprint(beforeRun);
  const afterOutput = screen5AnalysisOutputFingerprint(afterRun);
  return afterOutput !== null && afterOutput !== beforeOutput;
}

/** Keep the established tool input shape for hosts with a cached catalog. */
export function screen3AssessmentMutation(input: {
  expectedRevision: number; operationId: string; expectedAdviceFingerprint: string;
}) {
  return { action: "personalize_screen3_advice" as const,
    expectedRevision: input.expectedRevision, operationId: input.operationId,
    expectedAdviceFingerprint: input.expectedAdviceFingerprint };
}

/** Only a bound durable task artifact or validated result constitutes recovery. */
export function analysisArtifactRecovered(
  before: SixScreenWorkflowPrivateSnapshot,
  after: SixScreenWorkflowPrivateSnapshot,
  mutation: Record<string, unknown>,
  beforeProjection?: SixScreenWorkflowPublicProjection | null,
  afterProjection?: SixScreenWorkflowPublicProjection | null,
) {
  if (after.runId !== before.runId) {
    return false;
  }
  if (mutation.action === "renew_model_allowance" &&
    typeof mutation.operationId === "string") {
    const allowance = afterProjection?.modelCapability?.allowance;
    return allowance?.lastRenewalId === fingerprintSixScreenValue({
      runId: before.runId, operationId: mutation.operationId,
    }) && allowance.lastRenewalWindow === (mutation.allowanceWindow ?? "standard") &&
      (mutation.allowanceWindow !== "reviewer" || ["reviewer", "unlimited"].includes(allowance.policyMode ?? ""));
  }
  if (screen5SetupRecovered(before, after, mutation)) return true;
  if (screen4DiscoveryProgressRecovered(
    beforeProjection, afterProjection, mutation)) return true;
  if (screen4AssessmentProgressRecovered(
    beforeProjection, afterProjection, mutation)) return true;
  if (after.revision <= before.revision) return false;
  if (mutation.action === "personalize_screen3_advice") {
    const saved = after.state.screen3Contextualizations?.find((item) =>
      item.claimOperationId === mutation.operationId &&
      item.adviceFingerprint === mutation.expectedAdviceFingerprint);
    const previous = before.state.screen3Contextualizations?.find((item) => item.id === saved?.id);
    if (saved && (mutation.retryUnknownAttemptId === undefined ||
      saved.retryUnknownAttemptId === mutation.retryUnknownAttemptId) &&
      ["failed", "outcome_unknown", "validation_failed", "receipt_saved"].includes(saved.status) &&
      (!previous || fingerprintSixScreenValue(previous) !== fingerprintSixScreenValue(saved))) {
      // A verified failure is a displayable task outcome, never a completed
      // assessment. Clearing a transport warning must not resend inference.
      return true;
    }
    const count = (state: typeof after.state) =>
      (state.screen3Contextualizations ?? []).filter((item) =>
        item.adviceFingerprint === mutation.expectedAdviceFingerprint &&
        item.status === "completed" && item.supplement !== null).length;
    return count(after.state) > count(before.state);
  }
  if (mutation.action === "open_screen_4") {
    const fingerprint = typeof mutation.expectedInvestigationFingerprint ===
        "string"
      ? mutation.expectedInvestigationFingerprint
      : null;
    const keys = (state: typeof after.state) => new Set(
      (state.studyFirstEventInvestigations ?? [])
        .filter((item) => !fingerprint ||
          item.investigationFingerprint === fingerprint)
        .map((item) => `${item.snapshotId}:${item.investigationFingerprint}`),
    );
    const prior = keys(before.state);
    return [...keys(after.state)].some((key) => !prior.has(key));
  }
  if (mutation.action === "refresh_study_first_events") {
    const expected = typeof mutation.expectedInvestigationFingerprint ===
        "string"
      ? mutation.expectedInvestigationFingerprint
      : null;
    const previousSnapshots = new Set(
      (before.state.studyFirstEventInvestigations ?? [])
        .filter((item) => !expected ||
          item.investigationFingerprint === expected)
        .map((item) => item.snapshotId),
    );
    const priorKeys = new Set(
      (before.state.studyFirstEventInvestigations ?? []).map((item) =>
        `${item.snapshotId}:${item.investigationFingerprint}`),
    );
    return (after.state.studyFirstEventInvestigations ?? []).some((item) =>
      !priorKeys.has(`${item.snapshotId}:${item.investigationFingerprint}`) &&
      (!expected || item.previousSnapshotId !== null &&
        previousSnapshots.has(item.previousSnapshotId)));
  }
  if (mutation.action === "personalize_screen6_plan") {
    const count = (state: typeof after.state) =>
      (state.screen6Personalizations ?? []).filter((item) =>
        item.inputFingerprint === mutation.expectedPlanFingerprint &&
        item.status === "completed" && item.supplement !== null).length;
    return count(after.state) > count(before.state);
  }
  if (mutation.action === "analyze_study_first_events") {
    const count = (state: typeof after.state) =>
      (state.screen4InterpretationAttempts ?? []).filter((item) =>
        item.investigationFingerprint ===
          mutation.expectedInvestigationFingerprint &&
        item.status === "completed" && item.result !== null).length;
    return count(after.state) > count(before.state);
  }
  if (mutation.action === "advance_study_first_mechanism_job") {
    if (mutation.expectedRevision !== before.revision) return false;
    try {
      return screen5AnalysisArtifactRecovered({
        beforeRun: currentStudyFirstMechanismRunForState(before.state),
        afterRun: currentStudyFirstMechanismRunForState(after.state),
        afterRuns: after.state.studyFirstMechanismRuns ?? [],
        operationId: mutation.operationId,
      });
    } catch {
      // A malformed optional Screen 5 collection cannot prove recovery.
      return false;
    }
  }
  return false;
}

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function ProcessingStatus(props: {
  active: boolean;
  stage: string;
  complete?: boolean;
  completeMessage?: string;
  completedCount?: number;
  totalCount?: number;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!props.active) {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    setElapsed(0);
    const timer = globalThis.setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1_000)));
    }, 1_000);
    return () => globalThis.clearInterval(timer);
  }, [props.active]);
  if (!props.active && !props.complete) return null;
  const count = props.completedCount !== undefined &&
      props.totalCount !== undefined && props.totalCount > 0
    ? `${props.completedCount} of ${props.totalCount} steps complete` : null;
  return (
    <section className="six-processing-status" role="status"
      aria-live="polite" aria-busy={props.active || undefined}>
      <span className="six-processing-indicator" aria-hidden="true" />
      <div>
        <strong>{props.active
          ? elapsed >= 120
            ? "Still working; saved progress is preserved."
            : props.stage
          : props.completeMessage ?? "Done — the assessment is ready below."}</strong>
        {props.active ? (
          <small>
            {count ? `${count} · ` : ""}Elapsed {formatElapsed(elapsed)} · Usually about 1–2 minutes
          </small>
        ) : null}
      </div>
    </section>
  );
}

export default function SixScreenApp() {
  const bridge = useMemo(() => new SixScreenBridge(), []);
  const restored = useMemo(privateSnapshotFromWidgetState, []);
  const restoredScreen5Draft = useMemo(
    () => bridge.getInitialScreen5MechanismDraft(restored?.runId),
    [bridge, restored?.runId],
  );
  const restoredScreen3Handoff = useMemo(
    () => bridge.getInitialScreen3HandoffRecovery(restored?.runId),
    [bridge, restored?.runId],
  );
  const [hostView, setHostView] = useState<SixScreenHostView>({
    connected: false,
    embedded: window.parent !== window,
    displayMode: window.parent === window ? "fullscreen" : "inline",
    canFullscreen: false,
  });
  const [privateSnapshot, setPrivateSnapshot] =
    useState<SixScreenWorkflowPrivateSnapshot | null>(restored);
  const privateSnapshotRef = useRef(privateSnapshot);
  privateSnapshotRef.current = privateSnapshot;
  const [projection, setProjection] =
    useState<SixScreenWorkflowPublicProjection | null>(null);
  const projectionRef = useRef(projection);
  projectionRef.current = projection;
  const [form, setForm] = useState<FormState>(
    restored ? formFromSnapshot(restored) : emptyForm,
  );
  const [timingForm, setTimingForm] = useState<TimingFormState>(
    timingFormFromSnapshot(restored),
  );
  const [rdRuleDraft, setRdRuleDraft] = useState<RdRuleDraft | null>(
    screen3RdRuleDraftFromSnapshot(restored),
  );
  const [screen3ValidationAttempted, setScreen3ValidationAttempted] =
    useState(false);
  const [screen3SubmissionError, setScreen3SubmissionError] = useState("");
  const [screen3HandoffTask, setScreen3HandoffTask] =
    useState<Screen3HandoffTaskState | null>(() =>
      restoredScreen3Handoff
        ? {
          ...restoredScreen3Handoff,
          stage: restoredScreen3Handoff.state === "local_rebuild_required"
            ? "local_rebuild_required"
            : restoredScreen3Handoff.state === "saved_display_unavailable"
              ? "saved_display_unavailable"
              : restoredScreen3Handoff.state === "operation_conflict"
                ? "operation_conflict"
                : restoredScreen3Handoff.state ===
                    "committed_display_pending"
                  ? "committed_display_pending"
                  : "outcome_unknown",
          message: restoredScreen3Handoff.state === "local_rebuild_required"
            ? "The study handoff is saved and its comparison guidance can be restored locally. No external request is needed."
            : restoredScreen3Handoff.state === "saved_display_unavailable"
              ? "The handoff is saved, but the unchanged display response is invalid. It will not be rechecked or resent automatically."
              : restoredScreen3Handoff.state === "operation_conflict"
                ? "The retained operation identity conflicts with different input. Nothing will be applied or resent."
                : restoredScreen3Handoff.state ===
                    "committed_display_pending"
                  ? "The study save was verified, but comparison guidance still needs display restoration. No workflow mutation will be resent."
                  : "A prior handoff did not finish in this panel. Check its exact saved operation before repeating it.",
          problem: null,
        }
        : null);
  const [canonicalAcceptanceEpoch, setCanonicalAcceptanceEpoch] = useState(0);
  const canonicalAcceptanceEpochRef = useRef(0);
  const screen3HandoffCanonicalFloors = useRef(new Map<string, number>());
  const restoredScreen3HandoffChecked = useRef(false);
  const draftEditVersion = useRef(0);
  const [busy, setBusy] = useState(false);
  const [identitySearchState, setIdentitySearchState] = useState<
    "idle" | "searching" | "success" | "empty" | "error"
  >("idle");
  const identityResultsRef = useRef<HTMLHeadingElement | null>(null);
  const [pendingStudyDesignSelection, setPendingStudyDesignSelection] = useState<string | null>(null);
  type ModelTaskBusyKey = "screen3" | "screen4_source" |
    "screen4_refresh" | "screen4_interpretation" | "screen5";
  const [modelTasksBusy, setModelTasksBusy] =
    useState<ReadonlySet<ModelTaskBusyKey>>(() => new Set());
  function markModelTaskBusy(key: ModelTaskBusyKey, running: boolean) {
    setModelTasksBusy((current) => {
      const next = new Set(current);
      if (running) next.add(key);
      else next.delete(key);
      return next;
    });
  }
  type WorkflowScreenNumber = 1 | 2 | 3 | 4 | 5 | 6;
  const [screenErrors, setScreenErrors] =
    useState<Partial<Record<WorkflowScreenNumber, string>>>({});
  const [responseDiagnostic, setResponseDiagnostic] =
    useState<SixScreenWorkflowResponseDiagnostic | null>(null);
  const [lastAnalysisTrace, setLastAnalysisTrace] =
    useState<SafeAnalysisRecoveryTrace | null>(null);
  const [widgetPersistenceWarning, setWidgetPersistenceWarning] = useState("");
  const [screenNotices, setScreenNotices] =
    useState<Partial<Record<WorkflowScreenNumber, string>>>({});
  const [screen5DirectAction, setScreen5DirectAction] =
    useState<Screen5DirectActionStage | null>(null);
  const [hostReasoningMode, setHostReasoningMode] =
    useState<HostReasoningMode | null>(null);
  const [proofEntries, setProofEntries] = useState<
    Partial<Record<SixScreenProofTaskType, SixScreenProofEntry>>
  >({});
  const [proofBusy, setProofBusy] = useState<SixScreenProofTaskType | null>(
    null,
  );
  const [proofNotice, setProofNotice] = useState("");
  const restoredProofRun = useRef<string | null>(null);
  const [studyFirstHostEntries, setStudyFirstHostEntries] =
    useState<StudyFirstHostEntries>({});
  const [studyFirstHostBusyKey, setStudyFirstHostBusyKey] =
    useState<string | null>(null);
  const [studyFirstHostNotices, setStudyFirstHostNotices] =
    useState<Record<string, string | undefined>>({});
  const restoredStudyFirstHostRun = useRef<string | null>(null);
  const [policyAutomation, setPolicyAutomation] =
    useState<PolicyAutomationState>({
      identityFingerprint: null,
      status: "idle",
      message: "",
    });
  // Entering a saved Screen 2 by sidebar is a read-only view change. The
  // automatic documentary plan is armed by the explicit identity transition.
  const standardResearchArmed = useRef(false);
  const [showWebsiteFallback, setShowWebsiteFallback] = useState(false);
  const [showScreen3StudyDetails, setShowScreen3StudyDetails] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [restartBusy, setRestartBusy] = useState(false);
  const [displayModeBusy, setDisplayModeBusy] = useState(false);
  const [displayModeNotice, setDisplayModeNotice] = useState("");
  const activeActions = useRef(new Set<string>());
  const retiredRunIds = useRef(new Set<string>());
  const canonicalRecovery = useRef<{
    runId: string;
    promise: Promise<SixScreenWorkflowPrivateSnapshot>;
  } | null>(null);
  const retryableOperations = useRef(new Map<string, {
    operationId: string;
    inputFingerprint: string;
  }>());
  const recoveredAnalysisOperations = useRef(new Set<string>());
  const hostToolResultHandlerRef = useRef<(
    response: SixScreenToolResponse<
      SixScreenWorkflowPublicProjection & Record<string, unknown>
    >,
  ) => void>(() => undefined);
  const hostToolCancellationHandlerRef = useRef<(
    reason: string | null,
  ) => void>(() => undefined);
  function consumeRecoveredAnalysisOperation(operationId: string) {
    return recoveredAnalysisOperations.current.delete(operationId);
  }
  const [viewScreen, setViewScreenState] = useState<WorkflowScreenNumber>(
    initialViewScreen(restored),
  );
  const error = screenErrors[viewScreen] ?? "";
  const notice = screenNotices[viewScreen] ?? "";
  function setError(value: string, screen: WorkflowScreenNumber = viewScreen) {
    setScreenErrors((current) => {
      const next = { ...current };
      if (value) next[screen] = value;
      else delete next[screen];
      return next;
    });
  }
  function setNotice(value: string, screen: WorkflowScreenNumber = viewScreen) {
    setScreenNotices((current) => {
      const next = { ...current };
      if (value) next[screen] = value;
      else delete next[screen];
      return next;
    });
  }
  useEffect(() => {
    if (identitySearchState !== "success") return;
    const heading = identityResultsRef.current;
    if (!heading) return;
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [identitySearchState]);
  function clearTerminalScreen3HandoffForEditedInput() {
    const current = screen3HandoffTask;
    if (!current || !screen3HandoffStagePolicy(current.stage)
      .clearsAfterScientificEdit) return;
    clearPersistedScreen3HandoffRecovery(current);
    setScreen3HandoffTask(null);
  }
  useEffect(() => {
    const task = screen3HandoffTask;
    const snapshot = privateSnapshot;
    if (!task || !snapshot ||
        !screen3HandoffStageNeedsCanonicalCompatibilityCheck(task.stage) ||
        !shouldReconcileScreen3HandoffAfterCanonicalAcceptance({
          acceptedCanonicalEpoch: canonicalAcceptanceEpoch,
          markerCanonicalFloor:
            screen3HandoffCanonicalFloors.current.get(task.operationId) ?? 0,
        })) {
      return;
    }
    const reconciliation = reconcileScreen3HandoffTaskWithCanonical({
      task,
      state: snapshot.state,
    });
    if (reconciliation.persistence !== "clear") return;
    clearPersistedScreen3HandoffRecovery(task);
    setScreen3HandoffTask((current) =>
      current?.operationId === task.operationId
        ? reconciliation.task
        : current
    );
  }, [
    canonicalAcceptanceEpoch,
    privateSnapshot?.stateFingerprint,
    screen3HandoffTask?.operationId,
    screen3HandoffTask?.stage,
  ]);
  const viewEditVersion = useRef(0);
  const screenScrollPositions = useRef<Partial<Record<1 | 2 | 3 | 4 | 5 | 6, number>>>(
    {},
  );
  function beginAction(key: string) {
    if (!claimScreen3HandoffAction(activeActions.current, key)) return false;
    setResponseDiagnostic(null);
    return true;
  }
  function endAction(key: string) {
    activeActions.current.delete(key);
  }
  function retryableOperationId(key: string, payload: unknown) {
    const inputFingerprint = fingerprintSixScreenValue(payload);
    const existing = retryableOperations.current.get(key);
    if (existing?.inputFingerprint === inputFingerprint) {
      return existing.operationId;
    }
    const next = {
      operationId: operationId(key),
      inputFingerprint,
    };
    retryableOperations.current.set(key, next);
    return next.operationId;
  }
  function completeRetryableOperation(key: string, completedId: string) {
    if (retryableOperations.current.get(key)?.operationId === completedId) {
      retryableOperations.current.delete(key);
    }
  }
  function setViewScreen(next: 1 | 2 | 3 | 4 | 5 | 6) {
    screenScrollPositions.current[viewScreen] =
      document.scrollingElement?.scrollTop ?? window.scrollY;
    viewEditVersion.current += 1;
    setViewScreenState(next);
  }
  async function openWorkspace() {
    if (displayModeBusy) return;
    setDisplayModeBusy(true);
    setDisplayModeNotice("");
    try {
      const changed = await bridge.requestDisplayMode("fullscreen");
      if (!changed) {
        setDisplayModeNotice(
          "This ChatGPT host did not make a full workspace available; the saved state is unchanged.",
        );
      } else {
        try {
          sessionStorage.setItem(
            "shockaudit-six-screen-display-mode",
            "fullscreen",
          );
        } catch {
          // Session preference is optional; workflow state never depends on it.
        }
      }
    } finally {
      setDisplayModeBusy(false);
    }
  }
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({
        top: screenScrollPositions.current[viewScreen] ?? 0,
        behavior: "auto",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [viewScreen]);
  const currentProofEntries = useMemo(() => Object.fromEntries(
    Object.entries(proofEntries).filter((entry): entry is [
      SixScreenProofTaskType,
      SixScreenProofEntry,
    ] => Boolean(
      entry[1] && proofCoordinatesMatchSnapshot(
        entry[1].coordinates,
        privateSnapshot,
      ),
    )),
  ) as Partial<Record<SixScreenProofTaskType, SixScreenProofEntry>>, [
    privateSnapshot,
    proofEntries,
  ]);
  const currentStudyFirstHostEntries = useMemo(() => Object.fromEntries(
    Object.entries(studyFirstHostEntries).filter((entry): entry is [
      string,
      StudyFirstHostEntry,
    ] => Boolean(
      entry[1] && studyFirstHostCoordinatesMatchSnapshot(
        entry[1].coordinates,
        privateSnapshot,
      ),
    )),
  ) as StudyFirstHostEntries, [privateSnapshot, studyFirstHostEntries]);
  const legacyState = useMemo(hasLegacySavedState, []);
  const restoredConfirmedShock = privateSnapshot?.state.confirmedShock;
  const visibleConfirmedShock = projection?.confirmedShock ??
    (restoredConfirmedShock
      ? {
          id: restoredConfirmedShock.id,
          officialTitle: restoredConfirmedShock.officialTitle,
          issuer: restoredConfirmedShock.issuer,
          issuingJurisdiction: restoredConfirmedShock.issuingJurisdiction,
          formalIdentifiers: restoredConfirmedShock.formalIdentifiers,
          episode: restoredConfirmedShock.episode,
          versionScope: restoredConfirmedShock.versionScope,
          identityFingerprint: restoredConfirmedShock.identityFingerprint,
          confirmedAt: restoredConfirmedShock.confirmation.confirmedAt,
        }
      : null);
  const selectedIdentityCandidate = projection?.candidates.find(
    ({ selected }) => selected,
  ) ?? null;
  const screen2IsOpen = Boolean(visibleConfirmedShock);
  const visiblePolicyReview = projection?.policyReview ??
    privateSnapshot?.state.policyReview ?? null;
  const confirmedIdentityCandidate = privateSnapshot?.state.candidates.find(
    ({ id }) =>
      id === privateSnapshot.state.confirmedShock?.confirmation.candidateId,
  ) ?? null;
  const visibleEventCardWorkspace = projection?.policyEventCardWorkspace ?? null;
  const restoredEventCardReview =
    privateSnapshot?.state.policyEventCardReviews?.at(-1) ?? null;
  const visibleActiveEventCardReview =
    visibleEventCardWorkspace?.activeReview ?? restoredEventCardReview;
  const visibleCurrentEventCard =
    visibleEventCardWorkspace?.reviewStatus === "current"
      ? visibleEventCardWorkspace.activeReview?.lockedEventCard ?? null
      : currentLockedEventCard(privateSnapshot);
  const screen3EntryValidation = useMemo(() =>
    validateVisibleScreen3Draft(form, timingForm), [form, timingForm]);
  const screen3Ready = Boolean(
    visibleConfirmedShock && screen3EntryValidation.ready,
  );
  const visibleCausalComparisonWorkspace =
    projection?.causalComparisonWorkspace ?? null;
  const visibleCoEventSearchWorkspace =
    projection?.coEventSearchWorkspace ?? null;
  const visibleStudyFirstEventWorkspace =
    projection?.studyFirstEventInvestigationWorkspace ?? null;
  const visibleStudyFirstMechanismWorkspace =
    projection?.studyFirstMechanismWorkspace ?? null;
  type SharedModelCapability = NonNullable<
    StudyFirstMechanismWorkspace["executionReadiness"]
  >;
  const projectionModelCapability = projection
    ? (projection as SixScreenWorkflowPublicProjection & {
        modelCapability?: SharedModelCapability;
      }).modelCapability
    : undefined;
  // Prefer the task-agnostic capability projection when the runtime supplies
  // it. The compatibility projection is populated even before a Screen 5 run;
  // it must never be derived from whether a mechanism job exists or succeeds.
  const sharedModelReadiness = projectionModelCapability ??
    visibleStudyFirstMechanismWorkspace?.executionReadiness;
  function modelTaskUnavailableReason() {
    if (sharedModelReadiness?.configuration !== "ready") {
      return "The local OpenAI model is not configured. Reviewed guidance remains available.";
    }
    return sharedModelReadiness.allowance ? null : "Saved model usage is unavailable.";
  }
  function modelTaskAuthorizationDetails(
    profile: "screen3_design_critique",
  ) {
    const task = modelTaskProfile(profile);
    return `One explicit OpenAI request: up to ${task.inputCeiling.toLocaleString()} input and ${task.outputCeiling.toLocaleString()} output tokens (including reasoning). API charges and account limits apply.`;
  }
  const visibleMechanismLiteratureWorkspace =
    projection?.mechanismLiteratureWorkspace ?? null;
  const visibleScreen6UncertaintyWorkspace =
    projection?.screen6UncertaintyWorkspace ?? null;
  const visiblePolicyLifecycleStageWorkspace =
    projection?.policyLifecycleStageReviewWorkspace ?? null;
  const screen3IsOpen = Boolean(
    projection?.canOpenScreen3 || projection?.activeScreen === 3 ||
      privateSnapshot?.state.activeScreen === 3 ||
      visibleCausalComparisonWorkspace?.studyFirst.advice ||
      visibleCausalComparisonWorkspace?.designSet,
  );
  const screen4IsOpen = Boolean(
    projection?.canOpenScreen4 || projection?.activeScreen === 4 ||
      privateSnapshot?.state.activeScreen === 4 ||
      visibleCoEventSearchWorkspace?.matrix ||
      visibleStudyFirstEventWorkspace?.investigation,
  );
  const screen5IsOpen = Boolean(
    projection?.canOpenScreen5 || projection?.activeScreen === 5 ||
      privateSnapshot?.state.activeScreen === 5 ||
      visibleStudyFirstMechanismWorkspace?.currentInput ||
      visibleMechanismLiteratureWorkspace?.plan,
  );
  const screen6IsOpen = Boolean(
    projection?.canOpenScreen6 || projection?.activeScreen === 6 ||
      privateSnapshot?.state.activeScreen === 6 ||
      visibleScreen6UncertaintyWorkspace?.profile,
  );
  const exportAvailability = useMemo(() =>
    privateSnapshot
      ? workflowResearchExportAvailability(privateSnapshot.state)
      : null, [privateSnapshot]);
  const navigationItems = steps.map((label, index) => {
    const number = (index + 1) as 1 | 2 | 3 | 4 | 5 | 6;
    const available = number === 1 ||
      (number === 2 && screen2IsOpen) ||
      (number === 3 && screen3IsOpen) ||
      (number === 4 && screen4IsOpen) ||
      (number === 5 && screen5IsOpen) ||
      (number === 6 && screen6IsOpen);
    const latestArtifact = [...(privateSnapshot?.state.artifacts ?? [])]
      .reverse().find(({ screen }) => screen === number);
    const status = number === 1
      ? visibleConfirmedShock
        ? "reviewed"
        : projection?.candidates.length
          ? "needs review"
          : "not assessed"
      : latestArtifact?.status === "out_of_date"
        ? "out of date"
        : number === 2 && visibleEventCardWorkspace?.reviewStatus === "current"
          ? "reviewed"
          : latestArtifact?.status === "current" ||
              (number === 2 && visiblePolicyReview)
            ? "partial review"
            : available
              ? "needs review"
              : "not assessed";
    const unmet = number === 2
      ? "Confirm a source-supported policy on Screen 1 first."
      : number === 3
        ? prerequisiteBlockerMessages(
          projection?.screen3Prerequisites.blockers,
        ) ||
          "Complete the study details and proposed timing on Screen 2 first."
        : number === 4
          ? prerequisiteBlockerMessages(
            projection?.screen4Prerequisites.blockers,
          ) ||
            "Complete the required comparison handoff first."
          : number === 5
            ? prerequisiteBlockerMessages(
              projection?.screen5Prerequisites.blockers,
            ) ||
              "Complete the required co-event handoff first."
            : number === 6
              ? prerequisiteBlockerMessages(
                projection?.screen6Prerequisites.blockers,
              ) ||
                "Complete the required mechanism handoff first."
              : "";
    return { number, label, available, status, unmet };
  });

  function clearLocalWorkspace(persistenceWarning = "") {
    privateSnapshotRef.current = null;
    projectionRef.current = null;
    setPrivateSnapshot(null);
    setProjection(null);
    setForm({ ...emptyForm });
    setTimingForm({ ...emptyTimingForm });
    setRdRuleDraft(null);
    setScreen3ValidationAttempted(false);
    setScreen3SubmissionError("");
    setScreen3HandoffTask(null);
    canonicalAcceptanceEpochRef.current += 1;
    setCanonicalAcceptanceEpoch(canonicalAcceptanceEpochRef.current);
    screen3HandoffCanonicalFloors.current.clear();
    restoredScreen3HandoffChecked.current = true;
    draftEditVersion.current += 1;
    setBusy(false);
    setIdentitySearchState("idle");
    setPendingStudyDesignSelection(null);
    setModelTasksBusy(new Set());
    setScreenErrors({});
    setResponseDiagnostic(null);
    setLastAnalysisTrace(null);
    setWidgetPersistenceWarning(persistenceWarning);
    setScreenNotices({});
    setScreen5DirectAction(null);
    setProofEntries({});
    setProofBusy(null);
    setProofNotice("");
    restoredProofRun.current = null;
    setStudyFirstHostEntries({});
    setStudyFirstHostBusyKey(null);
    setStudyFirstHostNotices({});
    restoredStudyFirstHostRun.current = null;
    setPolicyAutomation({
      identityFingerprint: null,
      status: "idle",
      message: "",
    });
    standardResearchArmed.current = false;
    setShowWebsiteFallback(false);
    setShowScreen3StudyDetails(false);
    setReportOpen(false);
    setRestartOpen(false);
    activeActions.current.clear();
    canonicalRecovery.current = null;
    retryableOperations.current.clear();
    recoveredAnalysisOperations.current.clear();
    viewEditVersion.current += 1;
    screenScrollPositions.current = {};
    setViewScreenState(1);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
  }

  async function restartWorkflow() {
    if (restartBusy) return;
    const snapshot = privateSnapshotRef.current;
    if (!snapshot) {
      clearLocalWorkspace();
      return;
    }
    setRestartBusy(true);
    setError("");
    try {
      const response = await bridge.callToolWithMetadata<{
        schemaVersion: string;
        runId: string;
        retired: boolean;
        outcomeValuesInspected: boolean;
      }>("retire_six_screen_workflow_v1", {
        runId: snapshot.runId,
        accessToken: snapshot.accessToken,
      });
      const retired = response.structuredContent;
      if (retired.schemaVersion !==
            "shockaudit-six-screen-retirement-v1" ||
          retired.runId !== snapshot.runId || retired.retired !== true ||
          retired.outcomeValuesInspected !== false) {
        throw new Error(
          "ShockAudit could not verify that the saved workspace was cleared.",
        );
      }
      retiredRunIds.current.add(snapshot.runId);
      let widgetCleared = false;
      for (let attempt = 0; attempt < 3 && !widgetCleared; attempt += 1) {
        try {
          await bridge.clearSixScreenWorkspace(snapshot.runId);
          widgetCleared = true;
        } catch {
          // The server retirement is already committed. Retry only the local
          // host-state write; never resend the destructive server action.
        }
      }
      clearLocalWorkspace(widgetCleared ? "" :
        "The new search is ready, but this host did not confirm removal of its local saved panel state. The retired workspace cannot be restored.");
    } catch (caught) {
      setRestartOpen(false);
      setError(message(caught));
    } finally {
      setRestartBusy(false);
    }
  }

  function downloadLegacyExport() {
    try {
      const exported = createLegacyReadOnlyExport(
        window.openai?.widgetState,
        new Date().toISOString(),
      );
      const url = URL.createObjectURL(new Blob([
        `${JSON.stringify(exported, null, 2)}\n`,
      ], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "shockaudit-legacy-read-only-export.json";
      link.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(message(caught));
    }
  }

  function downloadResearchExport() {
    const snapshot = privateSnapshotRef.current;
    if (!snapshot) {
      setError("The current workflow is not available for export.");
      return;
    }
    try {
      const exported = createWorkflowResearchExportBundle({
        state: snapshot.state,
        exportedAt: new Date().toISOString(),
      });
      const url = URL.createObjectURL(new Blob([
        `${JSON.stringify(exported, null, 2)}\n`,
      ], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = exported.completenessStatus === "complete"
        ? "shockaudit-complete-research-export.json"
        : `shockaudit-partial-research-export-r${snapshot.revision}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setNotice(
        exported.completenessStatus === "complete"
          ? "The current Screen 6 research bundle was downloaded."
          : "A partial current-snapshot research bundle was downloaded.",
      );
    } catch (caught) {
      setError(message(caught));
    }
  }

  hostToolResultHandlerRef.current = (response) => {
    const startingDraftEditVersion = draftEditVersion.current;
    const startingViewVersion = viewEditVersion.current;
    const alreadyProjected = Boolean(projectionRef.current);
    void (async () => {
      try {
        const nextPrivate = await acceptToolResponse(response);
        // A host-delivered launch result may arrive before the first explicit
        // status read. Later notifications can acknowledge app-originated
        // calls too, so they must not overwrite active drafts or move views.
        if (!alreadyProjected && shouldApplyCanonicalDraftRefresh(
          startingDraftEditVersion,
          draftEditVersion.current,
        )) {
          setForm(formFromSnapshot(nextPrivate));
          setTimingForm(timingFormFromSnapshot(nextPrivate));
          setRdRuleDraft(screen3RdRuleDraftFromSnapshot(nextPrivate));
        }
        if (!alreadyProjected &&
            startingViewVersion === viewEditVersion.current) {
          setViewScreen(initialViewScreen(nextPrivate));
        }
      } catch (caught) {
        // Unsolicited notifications can be delivered after a successful
        // direct result, with host-transformed metadata. Restore canonical
        // status before allowing that duplicate to replace a healthy view.
        const saved = privateSnapshotRef.current;
        if (saved) {
          try {
            await refreshCanonicalWorkflow(saved);
            setError("");
            return;
          } catch { /* A genuine unavailable response still needs attention. */ }
        }
        setError(message(caught));
      }
    })();
  };
  hostToolCancellationHandlerRef.current = (reason) => {
    setError(
      `The host cancelled a workspace action${reason ? ` (${reason})` : ""}. ` +
      "No retry was sent. Check saved status before another action.",
    );
  };

  useEffect(() => {
    void bridge.connect({
      onHostView: setHostView,
      onToolResult: (response) => hostToolResultHandlerRef.current(
        response as SixScreenToolResponse<
          SixScreenWorkflowPublicProjection & Record<string, unknown>
        >,
      ),
      onToolCancelled: (reason) =>
        hostToolCancellationHandlerRef.current(reason),
    });
    return () => bridge.disconnect();
  }, [bridge]);

  useEffect(() => {
    if (!hostView.connected || !privateSnapshotRef.current || projection) return;
    const snapshot = privateSnapshotRef.current;
    const startingDraftEditVersion = draftEditVersion.current;
    const startingViewVersion = viewEditVersion.current;
    void (async () => {
      try {
        const response = await bridge.getSixScreenRecoverySnapshot({
          runId: snapshot.runId,
          accessToken: snapshot.accessToken,
        });
        const nextPrivate = await acceptCanonicalWorkflow({
          nextPrivate: response.snapshot,
          nextProjection: projectionFromToolResponse(response.projection, {}),
        });
        if (shouldApplyCanonicalDraftRefresh(
          startingDraftEditVersion,
          draftEditVersion.current,
        )) {
          setForm(formFromSnapshot(nextPrivate));
          setTimingForm(timingFormFromSnapshot(nextPrivate));
          setRdRuleDraft(screen3RdRuleDraftFromSnapshot(nextPrivate));
        }
        if (startingViewVersion === viewEditVersion.current) {
          setViewScreen(initialViewScreen(nextPrivate));
        }
      } catch (caught) {
        setError(message(caught));
      }
    })();
  }, [bridge, hostView.connected, projection]);

  useEffect(() => {
    if (!hostView.connected || !restoredScreen3Handoff ||
        restoredScreen3HandoffChecked.current) return;
    if ([
      "local_rebuild_required",
      "saved_display_unavailable",
      "operation_conflict",
    ].includes(restoredScreen3Handoff.state)) {
      restoredScreen3HandoffChecked.current = true;
      return;
    }
    restoredScreen3HandoffChecked.current = true;
    void checkScreen3HandoffStatus({
      recovery: restoredScreen3Handoff,
      // Reopening verifies and restores saved content in place. It never
      // forces the researcher away from the screen they chose to reopen.
      navigateIfUnchanged: null,
    });
  }, [hostView.connected, restoredScreen3Handoff]);

  useEffect(() => {
    const identityFingerprint = visibleConfirmedShock?.identityFingerprint;
    if (
      !standardResearchArmed.current || !hostView.connected || !projection || busy || viewScreen !== 2 ||
      !identityFingerprint
    ) return;
    if (
      visiblePolicyReview?.artifactStatus === "current" &&
      !visiblePolicyReview.plan.nextStepId
    ) {
      if (
        policyAutomation.identityFingerprint !== identityFingerprint ||
        policyAutomation.status !== "complete"
      ) {
        setPolicyAutomation({
          identityFingerprint,
          status: "complete",
          message: completedPolicyResearchMessage(visiblePolicyReview),
        });
      }
      return;
    }
    if (
      policyAutomation.identityFingerprint === identityFingerprint &&
      (policyAutomation.status === "running" ||
        policyAutomation.status === "paused")
    ) return;
    standardResearchArmed.current = false;
    void runStandardPolicyResearch();
  }, [
    busy,
    hostView.connected,
    policyAutomation.identityFingerprint,
    policyAutomation.status,
    projection?.revision,
    viewScreen,
    visibleConfirmedShock?.identityFingerprint,
    visiblePolicyReview?.claimCount,
    visiblePolicyReview?.plan.nextStepId,
    visiblePolicyReview?.progress.searchedSteps,
    visiblePolicyReview?.progress.totalSteps,
  ]);

  useEffect(() => {
    const snapshot = privateSnapshot;
    const eventCard = currentLockedEventCard(snapshot);
    const restoreKey = snapshot
      ? `${snapshot.runId}:${snapshot.revision}`
      : null;
    if (
      hostReasoningMode !== "full" || !snapshot || !eventCard ||
      restoredProofRun.current === restoreKey
    ) return;
    restoredProofRun.current = restoreKey;
    const restored = bridge.getInitialHostReasoningTasks(snapshot.runId)
      .filter((task): task is HostReasoningPrivateTaskCoordinates & {
        taskType: SixScreenProofTaskType;
      } => (
        (task.taskType === "six-screen-policy-fact-proof" ||
          task.taskType === "six-screen-mechanism-proof") &&
        task.expectedParentRevision === snapshot.revision &&
        task.expectedEventFingerprint === eventCard.eventCardFingerprint
      ));
    if (!restored.length) return;
    void Promise.all(restored.map(async (coordinates) => {
      try {
        const update = (task: HostReasoningPublicTaskState) =>
          setProofEntries((current) => ({
            ...current,
            [coordinates.taskType]: { coordinates, task },
          }));
        let task = await bridge.getHostReasoningTaskStatus(
          coordinates,
          snapshot.accessToken,
        );
        update(task);
        if (!["applied", "message-rejected", "validation-failed", "expired",
          "superseded", "retry-exhausted", "cancelled"].includes(
            task.status,
          )) {
          task = await bridge.waitForHostReasoningTask({
            coordinates,
            accessToken: snapshot.accessToken,
            onUpdate: update,
          });
        }
        if (task.status === "applied" && task.resultId &&
            proofResult(task.result) &&
            proofCoordinatesMatchSnapshot(
              coordinates,
              privateSnapshotRef.current,
            ) &&
            task.panelReconciliation.status !== "reconciled") {
          task = await bridge.acknowledgeHostReasoningTask(
            coordinates,
            snapshot.accessToken,
            task.resultId,
          );
          update(task);
        }
      } catch {
        // A missing or expired saved proof task does not affect the workflow.
      }
    }));
  }, [bridge, hostReasoningMode, privateSnapshot]);

  useEffect(() => {
    const snapshot = privateSnapshot;
    const restoreKey = snapshot
      ? `${snapshot.runId}:${snapshot.revision}`
      : null;
    if (
      hostReasoningMode !== "full" || !snapshot ||
      restoredStudyFirstHostRun.current === restoreKey
    ) return;
    restoredStudyFirstHostRun.current = restoreKey;
    const restored = bridge.getInitialHostReasoningTasks(snapshot.runId)
      .filter((task): task is HostReasoningPrivateTaskCoordinates & {
        taskType: StudyFirstHostTaskType;
        selectedEventId: string;
        expectedEventFingerprint: string;
      } => (
        task.taskType === SCREEN04_STUDY_EVENT_ASSESSMENT_TASK &&
        typeof task.selectedEventId === "string" &&
        typeof task.expectedEventFingerprint === "string" &&
        studyFirstHostCoordinatesMatchSnapshot(task, snapshot)
      ));
    if (!restored.length) return;
    void Promise.all(restored.map(async (coordinates) => {
      const key = studyFirstHostEntryKey(
        coordinates.taskType,
        coordinates.selectedEventId,
      );
      try {
        await refreshStudyFirstHostTask({
          coordinates,
          snapshot,
          wait: true,
        });
      } catch (caught) {
        setStudyFirstHostNotices((current) => ({
          ...current,
          [key]:
            `ShockAudit could not restore this saved host task: ${message(caught)}`,
        }));
      }
    }));
  }, [
    bridge,
    hostReasoningMode,
    privateSnapshot,
  ]);

  useEffect(() => {
    const snapshot = privateSnapshot;
    if (hostReasoningMode !== "full" || !snapshot) return;
    const pending = Object.values(currentStudyFirstHostEntries).filter(
      (entry): entry is StudyFirstHostEntry =>
        Boolean(
          entry && !studyFirstHostTaskIsTerminal(entry.task) &&
          entry.coordinates.taskType ===
            SCREEN04_STUDY_EVENT_ASSESSMENT_TASK,
        ),
    );
    if (!pending.length) return;
    let cancelled = false;
    let timer: ReturnType<typeof globalThis.setTimeout> | null = null;
    const poll = async () => {
      let retryAfterFailure = false;
      await Promise.all(pending.map(async ({ coordinates }) => {
        const selectedEventId = coordinates.selectedEventId;
        if (!selectedEventId || !studyFirstHostCoordinatesMatchSnapshot(
          coordinates,
          privateSnapshotRef.current,
        )) return;
        const key = studyFirstHostEntryKey(
          coordinates.taskType as StudyFirstHostTaskType,
          selectedEventId,
        );
        try {
          await refreshStudyFirstHostTask({
            coordinates,
            snapshot,
            wait: false,
          });
        } catch {
          retryAfterFailure = true;
          setStudyFirstHostNotices((current) => ({
            ...current,
            [key]:
              "The saved task status could not be checked just now. ShockAudit will retry while this panel remains open.",
          }));
        }
      }));
      if (!cancelled && retryAfterFailure) {
        timer = globalThis.setTimeout(() => void poll(), 5_000);
      }
    };
    timer = globalThis.setTimeout(() => void poll(), 2_500);
    return () => {
      cancelled = true;
      if (timer !== null) globalThis.clearTimeout(timer);
    };
  }, [
    bridge,
    currentStudyFirstHostEntries,
    hostReasoningMode,
    privateSnapshot,
  ]);

  function updateForm(name: keyof FormState, value: string) {
    draftEditVersion.current += 1;
    clearTerminalScreen3HandoffForEditedInput();
    if (name === "shockInput" && value !== form.shockInput) setRdRuleDraft(null);
    if (name === "shockInput" || name === "officialSource") {
      setIdentitySearchState("idle");
    }
    setForm((current) => name === "shockInput" && value !== current.shockInput
      ? { ...current, shockInput: value, officialSource: "",
          requestedJurisdiction: "", approximateYear: "", intendedEpisode: "" }
      : { ...current, [name]: value });
    setError("");
    setResponseDiagnostic(null);
    setNotice("");
    setScreen3SubmissionError("");
  }

  async function acceptCanonicalWorkflow(input: {
    nextPrivate: SixScreenWorkflowPrivateSnapshot;
    nextProjection: SixScreenWorkflowPublicProjection;
    expectedOperationBinding?: SixScreenWorkflowResponseOperationBinding;
    legacyRecovery?: {
      recoveredState: boolean;
      recoveredProjection: boolean;
      diagnostic: unknown;
    };
  }) {
      const { nextPrivate, nextProjection, expectedOperationBinding } = input;
      if (retiredRunIds.current.has(nextPrivate.runId)) {
        throw new DOMException(
          "A response arrived for a workspace that has already been cleared.",
          "AbortError",
        );
      }
      const current = privateSnapshotRef.current;
      if (
        workflowSnapshotResponseDisposition(current, nextPrivate) ===
          "obsolete"
      ) {
        if (expectedOperationBinding) {
          throw new SixScreenWorkflowProblemError(
            obsoleteBoundMutationProblem({
              binding: expectedOperationBinding,
              incomingRevision: nextPrivate.revision,
              currentRevision: current!.revision,
            }),
          );
        }
        return current!;
      }
      if (input.legacyRecovery?.recoveredState ||
          input.legacyRecovery?.recoveredProjection) {
        console.warn(
          "ShockAudit restored canonical serialized workflow payloads after the host changed a legacy object projection.",
          input.legacyRecovery.diagnostic,
        );
      }
      setResponseDiagnostic(null);
      setScreenErrors((errors) => Object.fromEntries(Object.entries(errors)
        .filter(([_screen, text]) => !text?.startsWith(
          "ShockAudit rejected an invalid workflow response contract."))));
      setProjection(nextProjection);
      projectionRef.current = nextProjection;
      setPrivateSnapshot(nextPrivate);
      privateSnapshotRef.current = nextPrivate;
      canonicalAcceptanceEpochRef.current += 1;
      setCanonicalAcceptanceEpoch(canonicalAcceptanceEpochRef.current);
      setHostReasoningMode(bridge.getHostReasoningMode());
      try {
        await bridge.saveSixScreenWorkflow(nextPrivate);
        setWidgetPersistenceWarning("");
      } catch {
        // The authenticated server result is already accepted. A host widget
        // save failure cannot turn it into a failed inference or roll it back.
        const persistenceFailure = screen3WidgetPersistenceFailurePlan();
        setWidgetPersistenceWarning(persistenceFailure.warning);
        setLastAnalysisTrace({
          version: "shockaudit-analysis-recovery-v1",
          action: "canonical_snapshot",
          stage: "widget_persistence",
          safeCode: "host_widget_state_write_failed",
          failureStage: "widget_persistence",
          failureCode: "host_widget_state_write_failed",
          reconciliationStatus: "verified",
          operationReference: null,
          clientRevision: nextPrivate.revision,
          latestVerifiedRevision: nextPrivate.revision,
          responseBuild: SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID,
          dispatchCertainty: "unknown",
          receiptSaved: false,
          validatedArtifactSaved: false,
          canonicalAccepted: persistenceFailure.canonicalAccepted,
          widgetPersistenceSaved: false,
        });
      }
      return nextPrivate;
  }

  async function acceptToolResponse(response: {
    structuredContent: SixScreenWorkflowPublicProjection & Record<string, unknown>;
    metadata: Record<string, unknown>;
    trace: SixScreenToolResponseTrace;
  }, expectedOperationBinding?: SixScreenWorkflowResponseOperationBinding) {
    try {
      const restoredResponse = restoreSixScreenWorkflowToolResponse({
        ...response,
        ...(expectedOperationBinding !== undefined
          ? { expectedOperationBinding }
          : {}),
      });
      return await acceptCanonicalWorkflow({
        nextPrivate: restoredResponse.snapshot,
        nextProjection: projectionFromToolResponse(
          restoredResponse.projection,
          response.metadata,
        ),
        ...(expectedOperationBinding !== undefined
          ? { expectedOperationBinding }
          : {}),
        legacyRecovery: {
          recoveredState: restoredResponse.recoveredTransformedLegacyState,
          recoveredProjection:
            restoredResponse.recoveredTransformedLegacyProjection,
          diagnostic: restoredResponse.diagnostic,
        },
      });
    } catch (caught) {
      if (caught instanceof SixScreenWorkflowResponseError) {
        setResponseDiagnostic(caught.diagnostic);
      }
      throw caught;
    }
  }

  async function createIfNeeded() {
    if (privateSnapshotRef.current) return privateSnapshotRef.current;
    const locator = officialInput(form.officialSource);
    const createPayload = {
      shockInput: form.shockInput,
      study: studyFromForm(form),
      ...(locator.sourceUrl
        ? { officialSourceLocators: [locator.sourceUrl] }
        : {}),
      officialIdentifier: locator.identifier,
      requestedJurisdiction: nullable(form.requestedJurisdiction),
      approximateYear: nullable(form.approximateYear),
      intendedEpisode: nullable(form.intendedEpisode),
    };
    const createOperationId = retryableOperationId("create", createPayload);
    const response = await bridge.callToolWithMetadata<
      SixScreenWorkflowPublicProjection & Record<string, unknown>
    >("create_six_screen_workflow_v1", {
      operationId: createOperationId,
      ...createPayload,
    });
    const accepted = await acceptToolResponse(response);
    completeRetryableOperation("create", createOperationId);
    return accepted;
  }

  async function mutate(
    snapshot: SixScreenWorkflowPrivateSnapshot,
    mutation: Record<string, unknown>,
  ) {
    const beforeProjection = projectionRef.current;
    const expectedOperationBinding =
      sixScreenWorkflowMutationRequestBinding(mutation);
    try {
      const response = await bridge.callToolWithMetadata<
        SixScreenWorkflowPublicProjection & Record<string, unknown>
      >("mutate_six_screen_workflow_v1", {
        runId: snapshot.runId,
        accessToken: snapshot.accessToken,
        mutation,
      });
      return await acceptToolResponse(response, expectedOperationBinding);
    } catch (caught) {
      if (mutation.action === "decide_study_design_advice" &&
          (caught instanceof SixScreenWorkflowResponseError ||
            caught instanceof SixScreenWorkflowProblemError &&
              caught.problem.commitCertainty !== "not_committed" &&
              ["serialization", "host_delivery", "projection"].includes(
                caught.problem.stage))) {
        let saved: SixScreenWorkflowPrivateSnapshot;
        try { saved = await reconcileCanonicalAfterFailure(snapshot); }
        catch { throw caught; }
        if (!savedStudyDesignDecisionMatchesRequest(snapshot, saved, mutation)) {
          throw caught;
        }
        setError("", 3);
        setResponseDiagnostic(null);
        return saved;
      }
      if (!usesCanonicalFailureRecovery(mutation.action)) throw caught;
      if (["compare_study_first_mechanisms", "ensure_study_first_mechanism_job",
          "authorize_study_first_mechanism_job"].includes(String(mutation.action)) &&
          caught instanceof SixScreenWorkflowProblemError &&
          (caught.problem.commitCertainty === "not_committed" ||
            !["serialization", "host_delivery", "projection"].includes(caught.problem.stage))) throw caught;
      const typedProblem = caught instanceof SixScreenWorkflowProblemError
        ? caught.problem
        : null;
      const failure = analysisFailureDescriptor(caught);
      const initialTrace: SafeAnalysisRecoveryTrace = {
        version: "shockaudit-analysis-recovery-v1",
        action: String(mutation.action),
        stage: failure.failureStage,
        safeCode: failure.failureCode,
        failureStage: failure.failureStage,
        failureCode: failure.failureCode,
        reconciliationStatus: "not_started",
        operationReference: typeof mutation.operationId === "string"
          ? fingerprintSixScreenValue(mutation.operationId).slice(-8) : null,
        clientRevision: snapshot.revision,
        latestVerifiedRevision: null,
        responseBuild: SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID,
        dispatchCertainty: failure.dispatchCertainty,
        receiptSaved: false,
        validatedArtifactSaved: false,
        canonicalAccepted: false,
        widgetPersistenceSaved: null,
      };
      setLastAnalysisTrace(initialTrace);
      let recovered: SixScreenWorkflowPrivateSnapshot;
      try {
        recovered = await reconcileCanonicalAfterFailure(snapshot);
      } catch {
        setLastAnalysisTrace({ ...initialTrace,
          stage: "canonical_reconciliation",
          safeCode: "authenticated_status_unavailable",
          reconciliationStatus: "unavailable" });
        // A failed read-only status check must not erase an exact server-side
        // authorization, provider, request, or persistence diagnosis.
        if (typedProblem || caught instanceof SixScreenWorkflowResponseError) {
          throw caught;
        }
        throw new Error(
          "The analysis response was interrupted and saved status could not be verified. Your current view and drafts remain available. Check saved status before another model request.",
        );
      }
      setLastAnalysisTrace({ ...initialTrace,
        stage: "canonical_reconciliation",
        safeCode: "authenticated_status_verified",
        reconciliationStatus: "verified",
        latestVerifiedRevision: recovered.revision,
        ...savedAnalysisCheckpoint(recovered, mutation,
          projectionRef.current),
        canonicalAccepted: true,
        widgetPersistenceSaved: null });
      if (analysisArtifactRecovered(
        snapshot,
        recovered,
        mutation,
        beforeProjection,
        projectionRef.current,
      )) {
        if (typeof mutation.operationId === "string") {
          recoveredAnalysisOperations.current.add(mutation.operationId);
        }
        setError("");
        const screen3Task = projectionRef.current?.causalComparisonWorkspace.studyFirst.contextualization;
        if (mutation.action === "personalize_screen3_advice" &&
            screen3Task?.status !== "completed") {
          setNotice("");
          setError(screen3Task?.status === "receipt_saved"
            ? "The model response is saved, but the six assessments are not ready. Use Recheck saved response below to finish local processing."
            : screen3Task?.error ?? "The assessment has not completed. Review its saved status below.");
        } else {
          setNotice(mutation.action === "advance_study_first_mechanism_job"
            ? "Saved compatible Screen 5 task state recovered. View it on Screen 5."
            : mutation.action === "personalize_screen3_advice"
              ? "Saved assessment recovered."
              : "Saved task state recovered. View it on the originating screen.");
        }
        return recovered;
      }
      if (recovered.revision > snapshot.revision) {
        if (typedProblem || caught instanceof SixScreenWorkflowResponseError) {
          throw caught;
        }
        throw new Error(
          "Saved task status was refreshed, but a completed result was not verified. Review the current task stage before another model request.",
        );
      }
      throw caught;
    }
  }

  function reconcileCanonicalAfterFailure(
    snapshot: SixScreenWorkflowPrivateSnapshot,
  ) {
    if (canonicalRecovery.current?.runId === snapshot.runId) {
      return canonicalRecovery.current.promise;
    }
    const draftVersion = draftEditVersion.current;
    const previousForm = formFromSnapshot(snapshot);
    const previousTiming = timingFormFromSnapshot(snapshot);
    const pending = (async () => {
      // Recovery carries one compressed canonical state and projection instead
      // of repeating the large workspace across four host-delivery fields.
      // It remains an authenticated, read-only, strictly validated response.
      let timer: ReturnType<typeof globalThis.setTimeout> | undefined;
      const response = await Promise.race([
        bridge.getSixScreenRecoverySnapshot({
          runId: snapshot.runId,
          accessToken: snapshot.accessToken,
        }),
        new Promise<never>((_, reject) => {
          timer = globalThis.setTimeout(() => reject(new Error(
            "Saved status check timed out without a verified response.",
          )), 25_000);
        }),
      ]).finally(() => {
        if (timer !== undefined) globalThis.clearTimeout(timer);
      });
      const verified = await acceptCanonicalWorkflow({
        nextPrivate: response.snapshot,
        nextProjection: projectionFromToolResponse(response.projection, {}),
      });
      if (draftVersion === draftEditVersion.current) {
        if (sameSixScreenValue(form, previousForm)) {
          setForm(formFromSnapshot(verified));
        }
        if (sameSixScreenValue(timingForm, previousTiming)) {
          setTimingForm(timingFormFromSnapshot(verified));
          setRdRuleDraft(screen3RdRuleDraftFromSnapshot(verified));
        }
      }
      return verified;
    })();
    canonicalRecovery.current = { runId: snapshot.runId, promise: pending };
    void pending.finally(() => {
      if (canonicalRecovery.current?.promise === pending) {
        canonicalRecovery.current = null;
      }
    }).catch(() => undefined);
    return pending;
  }

  async function checkSavedStatus() {
    const snapshot = privateSnapshotRef.current;
    if (!snapshot || !beginAction("check-saved-status")) return;
    try {
      const verified = await reconcileCanonicalAfterFailure(snapshot);
      setError("");
      setNotice(verified.revision > snapshot.revision
        ? "Saved status is current. Any compatible result is shown on its screen."
        : "Saved status checked. No newer result is recorded for this study version.");
    } catch (caught) {
      setError(message(caught));
    } finally {
      endAction("check-saved-status");
    }
  }

  async function refreshCanonicalWorkflow(
    snapshot: SixScreenWorkflowPrivateSnapshot,
  ) {
    const response = await bridge.getSixScreenRecoverySnapshot({
      runId: snapshot.runId,
      accessToken: snapshot.accessToken,
    });
    return acceptCanonicalWorkflow({
      nextPrivate: response.snapshot,
      nextProjection: projectionFromToolResponse(response.projection, {}),
    });
  }

  function updateScreen3HandoffTask(
    operationId: string,
    update: Screen3HandoffTaskState | null,
  ) {
    setScreen3HandoffTask((current) =>
      current && current.operationId !== operationId ? current : update
    );
  }

  function persistScreen3HandoffRecovery(recovery: Screen3HandoffRecovery) {
    screen3HandoffCanonicalFloors.current.set(
      recovery.operationId,
      canonicalAcceptanceEpochRef.current,
    );
    void bridge.saveScreen3HandoffRecovery(recovery).catch(() => {
      setWidgetPersistenceWarning(
        "The handoff status remains available in this panel, but the host could not preserve its recovery coordinates for reopening.",
      );
    });
  }

  function clearPersistedScreen3HandoffRecovery(
    recovery: Pick<Screen3HandoffRecovery, "runId" | "operationId">,
  ) {
    screen3HandoffCanonicalFloors.current.delete(recovery.operationId);
    void bridge.clearScreen3HandoffRecovery(recovery).catch(() => {
      setWidgetPersistenceWarning(
        "The saved study is current, but this host could not clear the completed handoff marker.",
      );
    });
  }

  function screen3ProblemTask(
    recovery: Screen3HandoffRecovery,
    problem: SafeSixScreenWorkflowProblem,
  ): Screen3HandoffTaskState {
    return createScreen3HandoffProblemTask({
      recovery,
      problem,
      problemMessage: message(new SixScreenWorkflowProblemError(problem)),
    });
  }

  async function checkScreen3HandoffStatus(input?: {
    recovery?: Screen3HandoffRecovery;
    navigateIfUnchanged?: {
      draftVersion: number;
      viewVersion: number;
    } | null;
  }) {
    const currentTask = screen3HandoffTask;
    const recovery = input?.recovery ?? (currentTask
      ? {
        schemaVersion: currentTask.schemaVersion,
        runId: currentTask.runId,
        operationId: currentTask.operationId,
        operationKind: currentTask.operationKind,
        inputFingerprint: currentTask.inputFingerprint,
        dependencyFingerprint: currentTask.dependencyFingerprint,
        ...(currentTask.scientificBinding
          ? { scientificBinding: currentTask.scientificBinding }
          : {}),
        state: currentTask.state,
      } satisfies Screen3HandoffRecovery
      : null);
    const snapshot = privateSnapshotRef.current;
    if (!recovery || !snapshot || recovery.runId !== snapshot.runId) return;
    const actionKey = `screen3-operation-status:${recovery.operationId}`;
    if (!beginAction(actionKey)) return;
    updateScreen3HandoffTask(
      recovery.operationId,
      createScreen3HandoffCheckingTask(recovery),
    );
    try {
      const status = await bridge.getSixScreenOperationStatus({
        accessToken: snapshot.accessToken,
        request: {
          runId: recovery.runId,
          operationId: recovery.operationId,
          operationKind: recovery.operationKind,
          inputFingerprint: recovery.inputFingerprint,
        },
      });
      const statusPlan = screen3HandoffStatusPlan(status);
      const disposition = statusPlan.disposition;
      if (disposition === "restore_current") {
        try {
          const refreshed = await refreshCanonicalWorkflow(
            privateSnapshotRef.current ?? snapshot,
          );
          if (!screen3StatusReceiptMatchesCurrentState({
            status,
            state: refreshed.state,
          })) {
            clearPersistedScreen3HandoffRecovery(recovery);
            updateScreen3HandoffTask(recovery.operationId, {
              ...recovery,
              state: "committed_display_pending",
              stage: "saved_historical",
              latestVerifiedRevision: refreshed.revision,
              message:
                "The handoff was saved, but newer scientific input became current before restoration finished. The saved handoff remains history and was not applied or resent.",
              problem: null,
            });
            return;
          }
          updateScreen3HandoffTask(recovery.operationId, null);
          clearPersistedScreen3HandoffRecovery(recovery);
          completeRetryableOperation(
            "screen3-study-first",
            recovery.operationId,
          );
          setNotice(
            "The exact saved Screen 2 handoff was restored. Comparison guidance is available on Screen 3.",
            2,
          );
          const navigation = input?.navigateIfUnchanged;
          if (navigation && shouldNavigateAfterScreen3Handoff({
            startingDraftVersion: navigation.draftVersion,
            currentDraftVersion: draftEditVersion.current,
            startingViewVersion: navigation.viewVersion,
            currentViewVersion: viewEditVersion.current,
            currentScreen: viewScreen,
          })) {
            setViewScreen(3);
          }
          return;
        } catch (caught) {
          const pending: Screen3HandoffRecovery = {
            ...recovery,
            state: "committed_display_pending",
          };
          const problem = caught instanceof SixScreenWorkflowProblemError
            ? caught.problem : null;
          const contractFailure = caught instanceof SixScreenWorkflowResponseError ||
            problem?.code === "response_contract" ||
            problem?.code === "build_incompatible";
          if (contractFailure) {
            pending.state = "saved_display_unavailable";
            persistScreen3HandoffRecovery(pending);
          } else {
            persistScreen3HandoffRecovery(pending);
          }
          updateScreen3HandoffTask(recovery.operationId, {
            ...pending,
            stage: contractFailure
              ? "saved_display_unavailable"
              : "committed_display_pending",
            latestVerifiedRevision: status.revision,
            message:
              `The study handoff is saved at revision ${status.committedRevision ?? status.revision}, but comparison guidance could not be restored from the full display projection. No workflow mutation was resent. ${message(caught)}`,
            problem,
          });
          return;
        }
      }
      if (disposition === "outcome_unknown") {
        const unknown: Screen3HandoffRecovery = {
          ...recovery,
          state: statusPlan.recoveryState,
        };
        persistScreen3HandoffRecovery(unknown);
        updateScreen3HandoffTask(recovery.operationId, {
          ...unknown,
          stage: statusPlan.stage,
          latestVerifiedRevision: status.revision,
          message:
            "No matching retained receipt was found. The commit outcome remains unknown or the bounded receipt expired, so ShockAudit did not resend the handoff.",
          problem: null,
        });
        return;
      }
      if (disposition === "operation_conflict") {
        const blocked: Screen3HandoffRecovery = {
          ...recovery,
          state: statusPlan.recoveryState,
        };
        persistScreen3HandoffRecovery(blocked);
        updateScreen3HandoffTask(recovery.operationId, {
          ...blocked,
          stage: statusPlan.stage,
          latestVerifiedRevision: status.revision,
          message:
            "The saved operation identity belongs to different input. Nothing was applied or resent; review the current saved study before starting a new handoff.",
          problem: null,
        });
        return;
      }
      const pending: Screen3HandoffRecovery = {
        ...recovery,
        state: statusPlan.recoveryState,
      };
      if (statusPlan.persistence === "clear") {
        clearPersistedScreen3HandoffRecovery(recovery);
      } else {
        persistScreen3HandoffRecovery(pending);
      }
      updateScreen3HandoffTask(recovery.operationId, {
        ...pending,
        stage: statusPlan.stage,
        latestVerifiedRevision: status.revision,
        message: disposition === "local_rebuild_required"
          ? "The study handoff is saved, but its local comparison-guidance artifact needs a supported rebuild before it can be displayed. No workflow mutation or external request was sent."
          : disposition === "saved_historical"
            ? "The handoff is saved as history for earlier scientific input and was not applied to the current study. No workflow mutation was resent."
            : "The handoff is saved, but the comparison-guidance artifact is unavailable. Its receipt is retained and no workflow mutation was resent.",
        problem: null,
      });
    } catch (caught) {
      const problem = caught instanceof SixScreenWorkflowProblemError
        ? caught.problem
        : createSixScreenWorkflowProblem({
          code: "delivery_failure",
          action: "operation_status",
          operationId: recovery.operationId,
          screen: 3,
          stage: "host_delivery",
          commitCertainty: "unknown",
          recovery: "check_status",
          safeCauseCodes: ["delivery_interrupted"],
        });
      if (problem.code === "response_contract" ||
          problem.code === "build_incompatible") {
        const unavailable: Screen3HandoffRecovery = {
          ...recovery,
          state: "saved_display_unavailable",
        };
        persistScreen3HandoffRecovery(unavailable);
        updateScreen3HandoffTask(recovery.operationId, {
          ...unavailable,
          stage: "saved_display_unavailable",
          message:
            `${message(new SixScreenWorkflowProblemError(problem))} The unchanged invalid status will not be read again or cause an automatic resend; update the local preview pair before checking this receipt again.`,
          problem,
        });
        return;
      }
      const unknown: Screen3HandoffRecovery = {
        ...recovery,
        state: "outcome_unknown",
      };
      persistScreen3HandoffRecovery(unknown);
      updateScreen3HandoffTask(
        recovery.operationId,
        screen3ProblemTask(unknown, problem),
      );
    } finally {
      endAction(actionKey);
    }
  }

  async function restoreScreen3ComparisonGuidance() {
    const task = screen3HandoffTask;
    const snapshot = privateSnapshotRef.current;
    if (!task || task.stage !== "local_rebuild_required" || !snapshot) return;
    const actionKey = `screen3-local-rebuild:${task.operationId}`;
    if (!beginAction(actionKey)) return;
    const startingDraftVersion = draftEditVersion.current;
    const startingViewVersion = viewEditVersion.current;
    const rebuildFingerprint = fingerprintSixScreenValue({
      schemaVersion: "screen-03-guidance-rebuild-operation-v1",
      runId: task.runId,
      sourceOperationId: task.operationId,
      sourceInputFingerprint: task.inputFingerprint,
      dependencyFingerprint: task.dependencyFingerprint,
    });
    const rebuildOperationId =
      `screen3-rebuild-${rebuildFingerprint.slice("fnv1a64:".length)}`;
    updateScreen3HandoffTask(task.operationId, {
      ...task,
      stage: "checking",
      message:
        "Restoring the saved comparison-guidance artifact locally. This sends no source search or model request and does not repeat the Screen 2 save.",
      problem: null,
    });
    const submit = (
      base: SixScreenWorkflowPrivateSnapshot,
      expectedRevision: number,
    ) => mutate(base, {
      action: "rebuild_screen3_guidance",
      expectedRevision,
      operationId: rebuildOperationId,
      sourceOperationId: task.operationId,
      sourceInputFingerprint: task.inputFingerprint,
    });
    let checkCommittedStatus = true;
    try {
      try {
        await submit(snapshot, task.latestVerifiedRevision ?? snapshot.revision);
      } catch (caught) {
        if (!(caught instanceof SixScreenWorkflowProblemError) ||
            caught.problem.code !== "revision_conflict" ||
            caught.problem.recovery !== "guarded_rebase") throw caught;
        if (!shouldNavigateAfterScreen3Handoff({
          startingDraftVersion,
          currentDraftVersion: draftEditVersion.current,
          startingViewVersion,
          currentViewVersion: viewEditVersion.current,
          currentScreen: viewScreen,
        })) throw caught;
        const status = await bridge.getSixScreenOperationStatus({
          accessToken: snapshot.accessToken,
          request: {
            runId: task.runId,
            operationId: task.operationId,
            operationKind: task.operationKind,
            inputFingerprint: task.inputFingerprint,
          },
        });
        if (screen3OperationStatusDisposition(status) !==
            "local_rebuild_required") throw caught;
        await submit(privateSnapshotRef.current ?? snapshot, status.revision);
      }
    } catch (caught) {
      if (caught instanceof SixScreenWorkflowProblemError &&
          isTerminalScreen3RebuildProblem(caught.problem)) {
        checkCommittedStatus = false;
        const unavailable: Screen3HandoffRecovery = {
          ...task,
          state: "saved_display_unavailable",
        };
        persistScreen3HandoffRecovery(unavailable);
        updateScreen3HandoffTask(task.operationId, {
          ...unavailable,
          stage: "saved_display_unavailable",
          message:
            "The saved handoff remains retained, but its unchanged local restoration input is invalid or unavailable. ShockAudit will not repeat the same restoration automatically; edit the study to start a new handoff or retain this record as history.",
          problem: caught.problem,
        });
      }
      // Delivery loss or a known local failure never authorizes resending the
      // rebuild. The original receipt status below determines whether the
      // saved artifact is now current, still rebuildable, or unavailable.
    } finally {
      if (checkCommittedStatus) {
        await checkScreen3HandoffStatus({
          recovery: task,
          navigateIfUnchanged: {
            draftVersion: startingDraftVersion,
            viewVersion: startingViewVersion,
          },
        });
      }
      endAction(actionKey);
    }
  }

  async function runIntelligenceProof(taskType: SixScreenProofTaskType) {
    const snapshot = privateSnapshotRef.current;
    const eventCard = currentLockedEventCard(snapshot);
    const event = snapshot?.state.confirmedShock;
    if (!snapshot || !eventCard || !event) return;
    setProofBusy(taskType);
    setProofNotice("");
    setError("");
    try {
      const prepared = await bridge.prepareSixScreenIntelligenceProof({
        snapshot,
        taskType,
        eventId: event.id,
        eventCardFingerprint: eventCard.eventCardFingerprint,
      });
      setProofEntries((current) => ({
        ...current,
        [taskType]: {
          coordinates: prepared.coordinates,
          task: prepared.prepared,
        },
      }));
      const delivery = await bridge.deliverSixScreenIntelligenceProof({
        ...prepared,
        accessToken: snapshot.accessToken,
      });
      if (!delivery.accepted) {
        const task = await bridge.getHostReasoningTaskStatus(
          prepared.coordinates,
          snapshot.accessToken,
        );
        setProofEntries((current) => ({
          ...current,
          [taskType]: { coordinates: prepared.coordinates, task },
        }));
        setProofNotice(
          delivery.failureExplanation ??
            "The signed-in host did not accept the proof request.",
        );
        return;
      }
      let task = await bridge.waitForHostReasoningTask({
        coordinates: prepared.coordinates,
        accessToken: snapshot.accessToken,
        onUpdate: (next) => setProofEntries((current) => ({
          ...current,
          [taskType]: { coordinates: prepared.coordinates, task: next },
        })),
      });
      if (task.status === "applied" && task.resultId &&
          proofResult(task.result)) {
        if (!proofCoordinatesMatchSnapshot(
          prepared.coordinates,
          privateSnapshotRef.current,
        )) {
          setProofNotice(
            "The structured proof result belongs to an earlier workflow revision and was not acknowledged in the current panel state.",
          );
          return;
        }
        task = await bridge.acknowledgeHostReasoningTask(
          prepared.coordinates,
          snapshot.accessToken,
          task.resultId,
        );
        setProofEntries((current) => ({
          ...current,
          [taskType]: { coordinates: prepared.coordinates, task },
        }));
        setProofNotice(
          "The structured proof result was validated, persisted, and reconciled into this panel. Capability remains disabled pending review of both genuine signed-in traces.",
        );
      } else if (task.status === "applied") {
        setProofNotice(
          "The stored proof result could not be rendered safely in this panel; reconciliation was not acknowledged.",
        );
      } else if ([
        "message-rejected", "validation-failed", "expired", "superseded",
        "retry-exhausted", "cancelled",
      ].includes(task.status)) {
        setProofNotice(
          task.failureExplanation ??
            `The proof stopped at ${task.status.replaceAll("-", " ")}.`,
        );
      } else {
        setProofNotice(
          `The proof is still ${task.status.replaceAll("-", " ")}. Check the same panel again before treating it as evidence.`,
        );
      }
    } catch (caught) {
      setProofNotice(message(caught));
    } finally {
      setProofBusy(null);
    }
  }

  function updateStudyFirstHostTask(
    coordinates: HostReasoningPrivateTaskCoordinates,
    task: HostReasoningPublicTaskState,
  ) {
    if (!coordinates.selectedEventId) return;
    const key = studyFirstHostEntryKey(
      coordinates.taskType as StudyFirstHostTaskType,
      coordinates.selectedEventId,
    );
    setStudyFirstHostEntries((current) => ({
      ...current,
      [key]: { coordinates, task },
    }));
  }

  async function settleStudyFirstHostTask(input: {
    coordinates: HostReasoningPrivateTaskCoordinates;
    task: HostReasoningPublicTaskState;
    expectedEventFingerprint?: string;
  }) {
    const selectedEventId = input.coordinates.selectedEventId;
    if (!selectedEventId) return input.task;
    const key = studyFirstHostEntryKey(
      input.coordinates.taskType as StudyFirstHostTaskType,
      selectedEventId,
    );
    updateStudyFirstHostTask(input.coordinates, input.task);
    if (input.task.status === "applied") {
      await reconcileStudyFirstAppliedTask(input);
    } else {
      setStudyFirstHostNotices((current) => ({
        ...current,
        [key]: input.task.failureExplanation ??
          (studyFirstHostTaskIsTerminal(input.task)
            ? `The signed task stopped at ${input.task.status.replaceAll("-", " ")}.`
            : `The signed task is still ${input.task.status.replaceAll("-", " ")}. Automatic checks remain active.`),
      }));
    }
    return input.task;
  }

  async function refreshStudyFirstHostTask(input: {
    coordinates: HostReasoningPrivateTaskCoordinates;
    snapshot: SixScreenWorkflowPrivateSnapshot;
    wait: boolean;
  }) {
    let task = await bridge.getHostReasoningTaskStatus(
      input.coordinates,
      input.snapshot.accessToken,
    );
    updateStudyFirstHostTask(input.coordinates, task);
    if (input.wait && !studyFirstHostTaskIsTerminal(task)) {
      task = await bridge.waitForHostReasoningTask({
        coordinates: input.coordinates,
        accessToken: input.snapshot.accessToken,
        onUpdate: (next) => updateStudyFirstHostTask(
          input.coordinates,
          next,
        ),
      });
    }
    return settleStudyFirstHostTask({
      coordinates: input.coordinates,
      task,
    });
  }

  async function reconcileStudyFirstAppliedTask(input: {
    coordinates: HostReasoningPrivateTaskCoordinates;
    task: HostReasoningPublicTaskState;
    expectedEventFingerprint?: string;
  }) {
    const { coordinates } = input;
    const key = studyFirstHostEntryKey(
      coordinates.taskType as StudyFirstHostTaskType,
      coordinates.selectedEventId ?? "missing-event",
    );
    if (
      coordinates.taskType === SCREEN05_THEORETICAL_PLANNING_TASK ||
      coordinates.taskType === SCREEN05_STUDY_MECHANISM_COMPARISON_TASK
    ) {
      setStudyFirstHostNotices((current) => ({
        ...current,
        [key]:
          "Historical Screen 5 host output remains read-only; the retired host route was not polled, acknowledged, or continued.",
      }));
      return privateSnapshotRef.current;
    }
    if (input.task.status !== "applied" || !input.task.resultId ||
        !studyFirstHostResult(
          coordinates.taskType as StudyFirstHostTaskType,
          input.task.result,
        )) {
      setStudyFirstHostNotices((current) => ({
        ...current,
        [key]:
          "The stored result did not match the required Screen 4/5 schema and was not used.",
      }));
      return null;
    }
    const resultId = input.task.resultId;
    const snapshot = privateSnapshotRef.current;
    if (!studyFirstHostCoordinatesMatchSnapshot(
      coordinates,
      snapshot,
      input.expectedEventFingerprint ?? coordinates.expectedEventFingerprint,
    )) {
      setStudyFirstHostNotices((current) => ({
        ...current,
        [key]:
          "The result belongs to an earlier workflow revision and was not reconciled into the current panel.",
      }));
      return null;
    }

    let task = input.task;
    if (task.panelReconciliation.status !== "reconciled") {
      try {
        task = await bridge.acknowledgeHostReasoningTask(
          coordinates,
          snapshot!.accessToken,
          resultId,
        );
        setStudyFirstHostEntries((current) => ({
          ...current,
          [key]: { coordinates, task },
        }));
      } catch {
        setStudyFirstHostNotices((current) => ({
          ...current,
          [key]:
            "The signed result is valid and saved; its panel-reconciliation receipt is still pending.",
        }));
      }
    }

    setStudyFirstHostNotices((current) => ({
      ...current,
      [key]:
        "The structured Screen 4 result was validated against the frozen study and remains read-only, conditional, and noncanonical.",
    }));
    return snapshot;
  }

  async function runStudyFirstHostTask(input: {
    taskType: StudyFirstHostTaskType;
    selectedEventId: string;
    expectedEventFingerprint: string;
    snapshot?: SixScreenWorkflowPrivateSnapshot;
    retryOfTaskId?: string;
  }) {
    const snapshot = input.snapshot ?? privateSnapshotRef.current;
    if (!snapshot) return null;
    const key = studyFirstHostEntryKey(
      input.taskType,
      input.selectedEventId,
    );
    if (
      input.taskType === SCREEN05_THEORETICAL_PLANNING_TASK ||
      input.taskType === SCREEN05_STUDY_MECHANISM_COMPARISON_TASK
    ) {
      setStudyFirstHostNotices((current) => ({
        ...current,
        [key]:
          "Direct Screen 5 owns this saved input. No signed host task was prepared or delivered.",
      }));
      return null;
    }
    const currentHostMode = bridge.getHostReasoningMode();
    if (currentHostMode !== "full") {
      setStudyFirstHostNotices((current) => ({
        ...current,
        [key]: currentHostMode === null
          ? "Checking signed-in synthesis; saved work is unchanged."
          : "Signed-in synthesis is unavailable; saved work is unchanged.",
      }));
      return null;
    }
    setStudyFirstHostBusyKey(key);
    setStudyFirstHostNotices((current) => ({ ...current, [key]: undefined }));
    setError("");
    try {
      const prepared = await bridge.prepareSixScreenIntelligenceProof({
        snapshot,
        taskType: input.taskType,
        eventId: input.selectedEventId,
        eventCardFingerprint: input.expectedEventFingerprint,
        retryOfTaskId: input.retryOfTaskId,
      });
      const update = (task: HostReasoningPublicTaskState) =>
        setStudyFirstHostEntries((current) => ({
          ...current,
          [key]: { coordinates: prepared.coordinates, task },
        }));
      update(prepared.prepared);
      const delivery = await bridge.deliverSixScreenIntelligenceProof({
        ...prepared,
        accessToken: snapshot.accessToken,
      });
      if (!delivery.accepted) {
        const task = await bridge.getHostReasoningTaskStatus(
          prepared.coordinates,
          snapshot.accessToken,
        );
        update(task);
        setStudyFirstHostNotices((current) => ({
          ...current,
          [key]: delivery.failureExplanation ??
            "The signed-in host did not accept this bounded assessment request.",
        }));
        return task;
      }
      const task = await bridge.waitForHostReasoningTask({
        coordinates: prepared.coordinates,
        accessToken: snapshot.accessToken,
        onUpdate: update,
      });
      await settleStudyFirstHostTask({
        coordinates: prepared.coordinates,
        task,
        expectedEventFingerprint: input.expectedEventFingerprint,
      });
      return task;
    } catch (caught) {
      setStudyFirstHostNotices((current) => ({
        ...current,
        [key]: message(caught),
      }));
      return null;
    } finally {
      setStudyFirstHostBusyKey((current) => current === key ? null : current);
    }
  }

  async function compareStudyFirstMechanisms(input: {
    theoreticalPerspective: string | null;
    proposedMechanism: string;
  }) {
    const snapshot = privateSnapshotRef.current;
    if (!snapshot || !beginAction("compare-study-first-mechanisms")) return;
    setScreen5DirectAction("saving_focal");
    markModelTaskBusy("screen5", true);
    setError("");
    setNotice("");
    const operation = retryableOperationId(
      "compare-study-first-mechanisms",
      input,
    );
    try {
      let accepted = await mutate(snapshot, {
        action: "compare_study_first_mechanisms",
        expectedRevision: snapshot.revision,
        operationId: operation,
        theoreticalPerspective: input.theoreticalPerspective,
        proposedMechanism: input.proposedMechanism,
      });
      completeRetryableOperation("compare-study-first-mechanisms", operation);
      let run = currentStudyFirstMechanismRunForState(accepted.state);
      if (!run) {
        throw new Error(
          "The saved Screen 5 response did not contain the current mechanism derivation.",
        );
      }
      if (run.inputAssessment.status === "needs_clarification") {
        setNotice(
          "Your exact mechanism text was saved. Add a process—who responds, what changes, and how that could reach the outcome—to generate alternatives and citation suggestions.",
        );
        return;
      }
      const selectedRoute = projection?.studyFirstMechanismWorkspace
        .executionReadiness?.route;
      if (selectedRoute) {
        const ensurePayload = {
          inputFingerprint: run.input.inputFingerprint,
          runFingerprint: run.runFingerprint,
        };
        const ensureOperation = retryableOperationId(
          "ensure-study-first-mechanism-job",
          ensurePayload,
        );
        accepted = await mutate(accepted, {
          action: "ensure_study_first_mechanism_job",
          expectedRevision: accepted.revision,
          operationId: ensureOperation,
          expectedInputFingerprint: run.input.inputFingerprint,
          expectedRunFingerprint: run.runFingerprint,
        });
        completeRetryableOperation(
          "ensure-study-first-mechanism-job",
          ensureOperation,
        );
        run = currentStudyFirstMechanismRunForState(accepted.state);
        if (!run) {
          throw new Error(
            "The direct Screen 5 ensure operation did not preserve an active run.",
          );
        }
      }
      if (run.providerExecution) {
        if (run.providerExecution.phase === "configuration_required") {
          setNotice(
            "Your exact mechanism was preserved. Complete the Worker configuration shown below; no model request was sent.",
          );
          return;
        }
        // The submit button promises generation, so the same explicit click
        // authorizes and starts the prepared job. It also advances through the
        // deterministic post-planning checkpoint; no second click is needed
        // merely to start the work.
        await advanceDirectScreen5(false, true, accepted);
        return;
      }
      if (selectedRoute) {
        setNotice(
          "The saved comparison could not be prepared yet. The historical route was not resumed.",
        );
        return;
      }
      setNotice(
        "Your Screen 5 input was saved, but the comparison could not be prepared. The retired route was not invoked.",
      );
      return;
    } catch (caught) {
      setError(message(caught));
    } finally {
      setScreen5DirectAction(null);
      markModelTaskBusy("screen5", false);
      endAction("compare-study-first-mechanisms");
    }
  }

  async function advanceDirectScreen5(
    retry = false,
    authorizeCurrentJob = false,
    suppliedSnapshot?: SixScreenWorkflowPrivateSnapshot,
  ) {
    let snapshot = suppliedSnapshot ?? privateSnapshotRef.current;
    const initialRun = snapshot
      ? currentStudyFirstMechanismRunForState(snapshot.state)
      : null;
    let execution = initialRun?.providerExecution;
    if (!snapshot || !execution) return;
    const actionKey = "advance-direct-screen5";
    if (!beginAction(actionKey)) return;
    const initialActionStage: Screen5DirectActionStage = localScreen5RecoveryStage(
      execution.phase,
      authorizeCurrentJob,
      ["recheck_saved_response", "restore_saved_comparison",
        "restore_saved_mechanisms"].includes(
          projection?.studyFirstMechanismWorkspace.executionReadiness
            ?.nextAction ?? "",
        ),
    );
    setScreen5DirectAction(initialActionStage);
    markModelTaskBusy("screen5", true);
    setError("");
    try {
      if (authorizeCurrentJob) {
        const authorizationPayload = {
          jobId: execution.id,
          executionFingerprint: execution.executionFingerprint,
          phase: execution.phase,
          retry,
        };
        const authorizationOperation = retryableOperationId(
          "authorize-direct-screen5",
          authorizationPayload,
        );
        snapshot = await mutate(snapshot, {
          action: "authorize_study_first_mechanism_job",
          expectedRevision: snapshot.revision,
          operationId: authorizationOperation,
          expectedExecutionFingerprint: execution.executionFingerprint,
        });
        completeRetryableOperation(
          "authorize-direct-screen5",
          authorizationOperation,
        );
        execution = currentStudyFirstMechanismRunForState(snapshot.state)
          ?.providerExecution;
        if (!execution) {
          throw new Error(
            "The authorized Screen 5 response did not preserve its provider job.",
          );
        }
        setScreen5DirectAction(execution.phase === "planning_queued"
          ? "generating_alternatives"
          : execution.phase === "plan_ready"
            ? "starting_literature"
            : "assessing_evidence");
      }
      const operationKey = retry
        ? "retry-direct-screen5"
        : "advance-direct-screen5";
      const operation = retryableOperationId(operationKey, {
        jobId: execution.id,
        executionFingerprint: execution.executionFingerprint,
        phase: execution.phase,
        retry,
      });
      let accepted = await mutate(snapshot, {
          action: "advance_study_first_mechanism_job",
          expectedRevision: snapshot.revision,
          operationId: operation,
          retry,
        });
      completeRetryableOperation(operationKey, operation);
      // A lost host response can still leave a verified durable planning
      // checkpoint. Recovery completes this exact operation, so continue from
      // the recovered phase under the authorization granted by the same user
      // click instead of requiring a second click merely for delivery loss.
      consumeRecoveredAnalysisOperation(operation);
      execution = currentStudyFirstMechanismRunForState(accepted.state)
        ?.providerExecution;
      // One explicit authorization covers Stage A and the first evidence
      // assessment. Continue automatically through the non-inference
      // citation checkpoint, and through the already-authorized first
      // assessment only when it is immediately eligible.
      for (let continuation = 0; continuation < 2 && execution &&
        ["plan_ready", "evidence_ready"].includes(execution.phase);
        continuation += 1) {
        setScreen5DirectAction(execution.phase === "plan_ready"
          ? "retrieving_literature" : "assessing_evidence");
        snapshot = accepted;
        const continuationKey = execution.phase === "plan_ready"
          ? "retrieve-direct-screen5" : "assess-direct-screen5";
        const continuationOperation = retryableOperationId(continuationKey, {
          jobId: execution.id,
          executionFingerprint: execution.executionFingerprint,
          phase: execution.phase,
          retry: false,
        });
        accepted = await mutate(snapshot, {
          action: "advance_study_first_mechanism_job",
          expectedRevision: snapshot.revision,
          operationId: continuationOperation,
          retry: false,
        });
        completeRetryableOperation(
          continuationKey,
          continuationOperation,
        );
        // The authenticated recovery snapshot is the acknowledgement for the
        // interrupted operation. Its next durable phase can safely continue;
        // the same operation is never resent.
        consumeRecoveredAnalysisOperation(continuationOperation);
        execution = currentStudyFirstMechanismRunForState(accepted.state)
          ?.providerExecution;
      }
      const next = execution;
      if (next?.phase === "completed") {
        setNotice(
          "The direct scholarly mechanism comparison is saved and visible below.",
        );
      } else if (next?.phase === "waiting_for_rate_limit") {
        setNotice(
          "The proposed mechanisms and ChatGPT-suggested citations are saved. Evidence assessment can continue after the provider token window is eligible.",
        );
      } else if (next?.phase === "failed" ||
          next?.phase === "outcome_unknown") {
        setNotice(next.lastError?.message ?? "The saved Screen 5 job paused.");
      } else {
        setNotice("Screen 5 saved the next direct-provider checkpoint.");
      }
    } catch (caught) {
      setError(message(caught));
    } finally {
      setScreen5DirectAction(null);
      markModelTaskBusy("screen5", false);
      endAction(actionKey);
    }
  }

  async function syncDraft(snapshot: SixScreenWorkflowPrivateSnapshot) {
    let current = snapshot;
    const nextStudy = studyFromForm(form);
    const locator = officialInput(form.officialSource);
    const currentStudy = {
      population: current.state.study.population,
      analysisUnit: current.state.study.analysisUnit,
      geography: current.state.study.geography,
      industry: current.state.study.industry,
      period: current.state.study.period,
      outcome: current.state.study.outcome,
      outcomeMeasure: current.state.study.outcomeMeasure ?? null,
      intendedConstruct: current.state.study.intendedConstruct,
      policySideConcept: current.state.study.policySideConcept ?? null,
      initialExplanation: current.state.study.initialExplanation,
      proposedTreatment: current.state.study.proposedTreatment,
      proposedComparison: current.state.study.proposedComparison,
      resultsPreviouslyInspected: current.state.study.resultsPreviouslyInspected,
    };
    if (!sameSixScreenValue(currentStudy, nextStudy)) {
      const operationKey = "sync-study";
      const syncOperationId = retryableOperationId(operationKey, nextStudy);
      current = await mutate(current, {
        action: "update_study",
        expectedRevision: current.revision,
        operationId: syncOperationId,
        study: nextStudy,
      });
      completeRetryableOperation(operationKey, syncOperationId);
    }
    const changedPolicyName = current.state.currentShockInput !== form.shockInput;
    if (
      current.state.currentShockInput !== form.shockInput ||
      (current.state.officialIdentifier ?? null) !== locator.identifier ||
      (changedPolicyName && (current.state.requestedJurisdiction !== null ||
        current.state.approximateYear !== null ||
        current.state.intendedEpisode !== null))
    ) {
      const shockPayload = {
        shockInput: form.shockInput,
        officialIdentifier: locator.identifier,
        requestedJurisdiction: changedPolicyName ? null : current.state.requestedJurisdiction,
        approximateYear: changedPolicyName ? null : current.state.approximateYear,
        intendedEpisode: changedPolicyName ? null : current.state.intendedEpisode,
      };
      const operationKey = "sync-shock";
      const syncOperationId = retryableOperationId(operationKey, shockPayload);
      current = await mutate(current, {
        action: "update_shock",
        expectedRevision: current.revision,
        operationId: syncOperationId,
        ...shockPayload,
      });
      completeRetryableOperation(operationKey, syncOperationId);
    }
    const source = locator.sourceUrl;
    if (source && !current.state.officialSourceLocators.includes(source)) {
      const operationKey = "sync-source";
      const syncOperationId = retryableOperationId(operationKey, { source });
      current = await mutate(current, {
        action: "add_source",
        expectedRevision: current.revision,
        operationId: syncOperationId,
        sourceUrl: source,
      });
      completeRetryableOperation(operationKey, syncOperationId);
    }
    return current;
  }

  async function resolveIdentity(event: FormEvent) {
    event.preventDefault();
    if (!beginAction("resolve-identity")) return;
    setBusy(true);
    setIdentitySearchState("searching");
    setError("");
    setNotice("");
    try {
      let snapshot = await createIfNeeded();
      snapshot = await syncDraft(snapshot);
      if (snapshot.state.confirmedShock) {
        setIdentitySearchState("success");
        setNotice(
          "This shock is already confirmed. Change the policy identity fields or add a new source before resolving another identity.",
        );
        return;
      }
      const operationKey = "resolve-identity-operation";
      const resolveOperationId = retryableOperationId(operationKey, {
        runId: snapshot.runId,
        revision: snapshot.revision,
        requestFingerprint: snapshot.state.currentRequestFingerprint,
      });
      const next = await mutate(snapshot, {
        action: "resolve_shock",
        expectedRevision: snapshot.revision,
        operationId: resolveOperationId,
      });
      completeRetryableOperation(operationKey, resolveOperationId);
      setIdentitySearchState(next.state.candidates.length ? "success" : "empty");
      setNotice(
        next.state.lastIdentityResolution?.limitation ??
          (next.state.candidates.length
            ? "Identity candidates are ready for your review."
            : "ShockAudit did not resolve this event under the attempted protocol. Your study inputs were preserved."),
      );
    } catch (caught) {
      setIdentitySearchState("error");
      setError(message(caught));
    } finally {
      setBusy(false);
      endAction("resolve-identity");
    }
  }

  async function candidateAction(
    action: "display_identity" | "defer_identity" | "confirm_shock",
    candidateId: string,
    decision?: "different_version" | "rejected",
  ) {
    const actionGuard = `${action}:${candidateId}`;
    if (!beginAction(actionGuard)) return;
    let snapshot = privateSnapshotRef.current;
    const candidate = projection?.candidates.find(({ id }) => id === candidateId);
    if (!snapshot || !candidate) {
      endAction(actionGuard);
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (
        action === "confirm_shock" &&
        snapshot.state.displayedCandidateId !== candidateId &&
        snapshot.state.confirmedShock?.id !== candidateId
      ) {
        const displayKey = `display-before-confirmation:${candidateId}`;
        const displayOperationId = retryableOperationId(displayKey, {
          revision: snapshot.revision,
          candidateId,
        });
        snapshot = await mutate(snapshot, {
          action: "display_identity",
          candidateId,
          expectedRevision: snapshot.revision,
          operationId: displayOperationId,
        });
        completeRetryableOperation(displayKey, displayOperationId);
      }
      const payload = action === "display_identity"
        ? { action, candidateId }
        : action === "defer_identity"
          ? { action, candidateId, decision }
          : {
              action,
              candidateId,
              displayedIdentityFingerprint: candidate.identityFingerprint,
              sourceSnapshotId: candidate.sourceSnapshotId,
              sourceSnapshotFingerprint: candidate.sourceSnapshotFingerprint,
              originalRequestFingerprint: snapshot.state.originalRequestFingerprint,
              currentRequestFingerprint: snapshot.state.currentRequestFingerprint,
              identityRevision: snapshot.state.identityRevision,
            };
      const alreadyConfirmed = action === "confirm_shock" &&
        snapshot.state.confirmedShock?.id === candidateId &&
        snapshot.state.confirmedShock.identityFingerprint ===
          candidate.identityFingerprint;
      const operationKey = `${action}:${candidateId}`;
      let next = snapshot;
      if (!alreadyConfirmed) {
        const actionOperationId = retryableOperationId(operationKey, {
          revision: snapshot.revision,
          payload,
        });
        next = await mutate(snapshot, {
          ...payload,
          expectedRevision: snapshot.revision,
          operationId: actionOperationId,
        });
        completeRetryableOperation(operationKey, actionOperationId);
      }
      if (action === "confirm_shock") {
        setNotice("Shock confirmed");
        const openKey = `screen2-after-confirmation:${candidateId}`;
        const openOperationId = retryableOperationId(openKey, {
          revision: next.revision,
          identityFingerprint: candidate.identityFingerprint,
        });
        next = await mutate(next, {
          action: "open_screen_2",
          expectedRevision: next.revision,
          operationId: openOperationId,
        });
        completeRetryableOperation(openKey, openOperationId);
        standardResearchArmed.current = true;
        setViewScreen(2);
        setNotice("Shock confirmed. Screen 2 is open for the same saved identity.");
      }
      if (action === "defer_identity") {
        setNotice(
          decision === "rejected"
            ? "That match was rejected. Your study information is unchanged."
            : "That related match was set aside. Clarify the intended version or stage and resolve again.",
        );
      }
      if (action === "display_identity") setProjection((current) => current);
      privateSnapshotRef.current = next;
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
      endAction(actionGuard);
    }
  }

  async function continueToScreen2() {
    if (!beginAction("continue-screen2")) return;
    let snapshot = privateSnapshotRef.current;
    if (!snapshot) {
      endAction("continue-screen2");
      return;
    }
    setBusy(true);
    setError("");
    try {
      snapshot = await syncDraft(snapshot);
      const operationKey = "continue-screen2-operation";
      const openOperationId = retryableOperationId(operationKey, {
        runId: snapshot.runId,
        revision: snapshot.revision,
        confirmedIdentityFingerprint:
          snapshot.state.confirmedShock?.identityFingerprint ?? null,
      });
      await mutate(snapshot, {
        action: "open_screen_2",
        expectedRevision: snapshot.revision,
        operationId: openOperationId,
      });
      completeRetryableOperation(operationKey, openOperationId);
      standardResearchArmed.current = true;
      setViewScreen(2);
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
      endAction("continue-screen2");
    }
  }

  async function continueToScreen3() {
    const snapshot = privateSnapshotRef.current;
    if (!snapshot || !beginAction("continue-screen3")) return;
    const startingDraftVersion = draftEditVersion.current;
    const startingViewVersion = viewEditVersion.current;
    const validation = validateVisibleScreen3Draft(form, timingForm);
    setScreen3ValidationAttempted(true);
    setScreen3SubmissionError("");
    setError("");
    setNotice("");
    if (!validation.ready || !validation.proposedTiming) {
      focusScreen3Field(validation.issues[0]?.fieldIds[0]);
      endAction("continue-screen3");
      return;
    }
    if (rdRuleDraft && (!rdRuleDraft.runningVariable.trim() ||
      !rdRuleDraft.cutoff.trim() || timingForm.mode !== "year")) {
      setScreen3SubmissionError(
        "A threshold proposal needs a running variable, cutoff, treated side and treatment year. Review the fields above.",
      );
      endAction("continue-screen3");
      return;
    }
    let recovery: Screen3HandoffRecovery | null = null;
    try {
      const study = validation.study as StudyContextDraft;
      const proposedTiming = validation.proposedTiming;
      const previousClarifications =
        projection?.causalComparisonWorkspace.studyFirst.advice
          ?.clarifications ?? EMPTY_STUDY_DESIGN_CLARIFICATIONS;
      const clarifications: StudyDesignClarifications = {
        ...previousClarifications,
        adoptionPattern: proposedTiming.mode === "varies_by_group"
          ? "staggered"
          : previousClarifications.adoptionPattern === "staggered"
            ? "unknown"
            : previousClarifications.adoptionPattern,
        rd: rdRuleDraft ? {
          ...rdRuleDraft,
          verification: "researcher_reported",
          assignmentRule: `${rdRuleDraft.runningVariable.trim()} ${rdRuleDraft.operator} ${rdRuleDraft.cutoff.trim()}`,
        } : null,
      };
      const payload = { study, proposedTiming, clarifications };
      const coordinates = screen3HandoffOperationCoordinates(snapshot, payload);
      recovery = { ...coordinates, state: "pending" };
      setScreen3HandoffTask(createScreen3HandoffSavingTask(recovery));
      persistScreen3HandoffRecovery(recovery);
      const submit = (base: SixScreenWorkflowPrivateSnapshot) =>
        mutate(base, {
          action: "open_screen_3",
          expectedRevision: base.revision,
          operationId: recovery!.operationId,
          ...payload,
        });
      try {
        await submit(snapshot);
      } catch (caught) {
        if (!(caught instanceof SixScreenWorkflowProblemError) ||
            caught.problem.code !== "revision_conflict" ||
            caught.problem.recovery !== "guarded_rebase") throw caught;
        const refreshed = await refreshCanonicalWorkflow(
          privateSnapshotRef.current ?? snapshot,
        );
        if (startingDraftVersion === draftEditVersion.current) {
          setForm(formFromSnapshot(refreshed));
          setTimingForm(timingFormFromSnapshot(refreshed));
          setRdRuleDraft(screen3RdRuleDraftFromSnapshot(refreshed));
        }
        if (!screen3SubmissionBaseMatches(snapshot, refreshed) ||
            !shouldNavigateAfterScreen3Handoff({
              startingDraftVersion,
              currentDraftVersion: draftEditVersion.current,
              startingViewVersion,
              currentViewVersion: viewEditVersion.current,
              currentScreen: viewScreen,
            })) {
          throw new SixScreenWorkflowProblemError(
            createSixScreenWorkflowProblem({
              code: "revision_conflict",
              action: "open_screen_3",
              operationId: recovery.operationId,
              screen: 3,
              expectedRevision: snapshot.revision,
              actualRevision: refreshed.revision,
              recovery: "none",
              safeCauseCodes: ["stale_revision"],
            }),
          );
        }
        await submit(refreshed);
      }
      clearPersistedScreen3HandoffRecovery(recovery);
      updateScreen3HandoffTask(recovery.operationId, null);
      setScreen3ValidationAttempted(false);
      setNotice(
        "Screen 3 opened from your saved study and proposed timing. No policy claim was accepted and no empirical test ran.",
        2,
      );
      if (shouldNavigateAfterScreen3Handoff({
        startingDraftVersion,
        currentDraftVersion: draftEditVersion.current,
        startingViewVersion,
        currentViewVersion: viewEditVersion.current,
        currentScreen: viewScreen,
      })) {
        setViewScreen(3);
      }
    } catch (caught) {
      const activeRecovery = recovery;
      if (!activeRecovery) {
        setScreen3SubmissionError(message(caught));
      } else {
        const problem = caught instanceof SixScreenWorkflowProblemError
          ? caught.problem
          : createSixScreenWorkflowProblem({
            code: caught instanceof SixScreenWorkflowResponseError
              ? "response_contract" : "delivery_failure",
            action: "open_screen_3",
            operationId: activeRecovery.operationId,
            screen: 3,
            expectedRevision: snapshot.revision,
            stage: caught instanceof SixScreenWorkflowResponseError
              ? "serialization" : "host_delivery",
            commitCertainty: "unknown",
            recovery: "check_status",
            safeCauseCodes: [caught instanceof SixScreenWorkflowResponseError
              ? "response_contract_invalid" : "delivery_interrupted"],
          });
        const task = screen3ProblemTask(activeRecovery, problem);
        updateScreen3HandoffTask(activeRecovery.operationId, task);
        if (problem.commitCertainty === "not_committed") {
          clearPersistedScreen3HandoffRecovery(activeRecovery);
        } else {
          const unresolved: Screen3HandoffRecovery = {
            ...activeRecovery,
            state: "outcome_unknown",
          };
          persistScreen3HandoffRecovery(unresolved);
          await checkScreen3HandoffStatus({
            recovery: unresolved,
            navigateIfUnchanged: {
              draftVersion: startingDraftVersion,
              viewVersion: startingViewVersion,
            },
          });
        }
      }
    } finally {
      endAction("continue-screen3");
    }
  }

  async function refineStudyAdvice(clarifications: StudyDesignClarifications) {
    const snapshot = privateSnapshotRef.current;
    if (!snapshot) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await mutate(snapshot, {
        action: "refine_study_design_advice",
        expectedRevision: snapshot.revision,
        operationId: operationId("study-design-refine"),
        clarifications,
      });
      setNotice(
        "Conditional guidance was updated from your clarifications. Study fields, policy evidence, and prior decisions were not changed.",
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function decideStudyAdvice(input: {
    decision: { mode: "selected"; optionId: string } | { mode: "no_selection" };
    rationale: string;
  }) {
    const snapshot = privateSnapshotRef.current;
    const advice = projection?.causalComparisonWorkspace.studyFirst.advice;
    if (!snapshot || !advice || !beginAction("study-design-decision")) return;
    setBusy(true);
    setPendingStudyDesignSelection(input.decision.mode === "selected" ? input.decision.optionId : null);
    setError("");
    setNotice("");
    try {
      await mutate(snapshot, {
        action: "decide_study_design_advice",
        expectedRevision: snapshot.revision,
        operationId: operationId("study-design-decision"),
        adviceId: advice.adviceId,
        expectedAdviceFingerprint: advice.adviceFingerprint,
        decision: input.decision,
        rationale: input.rationale,
      });
      setNotice(
        input.decision.mode === "selected"
          ? "The method option was selected for further review; no assumption or effect was certified."
          : "The explicit no-selection decision was saved.",
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
      setPendingStudyDesignSelection(null);
      endAction("study-design-decision");
    }
  }

  async function continueToScreen4() {
    let snapshot = privateSnapshotRef.current;
    if (!snapshot || !beginAction("screen4-source-open")) return;
    const savedInvestigation = projection
      ?.studyFirstEventInvestigationWorkspace.investigation;
    const savedDiscoveryTask = projection
      ?.studyFirstEventInvestigationWorkspace.discoveryTask;
    const needsSourceAction = !savedInvestigation ||
      savedDiscoveryTask?.nextAction === "start" ||
      savedDiscoveryTask?.nextAction === "resume";
    markModelTaskBusy("screen4_source", needsSourceAction);
    setError("");
    setNotice("");
    setError("", 4);
    setNotice("", 4);
    setViewScreen(4);
    try {
      if (needsSourceAction) {
        const payload = {
          workflowRevision: snapshot.revision,
          activeScreen: snapshot.state.activeScreen,
          studyRevision: snapshot.state.study.revision,
          policyFingerprint: snapshot.state.confirmedShock?.identityFingerprint,
          adviceFingerprint:
            currentStudyDesignAdvice(snapshot.state)?.adviceFingerprint ?? null,
          selectionFingerprint: currentStudyDesignSelection(snapshot.state)
            ?.selectionFingerprint ?? null,
          timingFingerprint: currentProposedTreatmentTiming(snapshot.state)
            ?.timingFingerprint ?? null,
          investigationSnapshotId: savedInvestigation?.snapshotId ?? null,
          investigationFingerprint:
            savedInvestigation?.investigationFingerprint ?? null,
        };
        const openOperation = retryableOperationId(
          "screen4-source-open",
          payload,
        );
        const base = snapshot;
        const navigation = await openScreenWithCanonicalRecovery({
          targetScreen: 4,
          open: () => mutate(base, {
            action: "open_screen_4",
            expectedRevision: base.revision,
            operationId: openOperation,
          }),
          recover: () => refreshCanonicalWorkflow(base),
          acceptRecovered: (recovered) => screen4EntryMatchesSelection(base, recovered),
        });
        snapshot = navigation.snapshot;
        completeRetryableOperation("screen4-source-open", openOperation);
      }
      setError("", 4);
      setResponseDiagnostic(null);
      setLastAnalysisTrace(null);
      const studyFirstDecision =
        projection?.causalComparisonWorkspace.studyFirst.selection?.decision;
      setNotice(studyFirstDecision
        ? studyFirstDecision.mode === "selected"
          ? "Screen 4 is open from the saved comparison. Source-documented alternative shocks appear below before assessment."
          : "Screen 4 is open without selecting a method or inferring a group difference. Source results remain separate from assessment."
        : snapshot.state.causalDesignDecisions?.at(-1)?.decision === "selected"
          ? "Screen 4 is open from the saved comparison. Source results remain separate from assessment."
          : "Screen 4 is open without inferring a group difference. Source results remain separate from assessment.", 4);
    } catch (caught) {
      setError(message(caught), 4);
    } finally {
      markModelTaskBusy("screen4_source", false);
      endAction("screen4-source-open");
    }
  }

  async function refreshStudyFirstEvents() {
    const snapshot = privateSnapshotRef.current;
    const workspace = projection?.studyFirstEventInvestigationWorkspace;
    const investigation = workspace?.investigation;
    if (!snapshot || !investigation || !workspace.refreshAvailable ||
        workspace.sourceVersionCurrent) return;
    if (!beginAction("screen4-refresh")) return;
    markModelTaskBusy("screen4_refresh", true);
    setError("");
    setNotice("");
    try {
      const refreshOperation = retryableOperationId("screen4-refresh", {
        investigationSnapshotId: investigation.snapshotId,
        investigationFingerprint: investigation.investigationFingerprint,
        discoveryVersion: investigation.plan.discoveryVersion,
      });
      await mutate(snapshot, {
        action: "refresh_study_first_events",
        expectedRevision: snapshot.revision,
        operationId: refreshOperation,
        expectedInvestigationFingerprint: investigation.investigationFingerprint,
      });
      completeRetryableOperation("screen4-refresh", refreshOperation);
      setNotice("Source plan and checkpoint saved; earlier evidence remains in history.");
    } catch (caught) {
      setError(message(caught));
    } finally {
      markModelTaskBusy("screen4_refresh", false);
      endAction("screen4-refresh");
    }
  }

  async function analyzeStudyFirstEvents() {
    const snapshot = privateSnapshotRef.current;
    const workspace = projectionRef.current
      ?.studyFirstEventInvestigationWorkspace;
    const investigation = workspace?.investigation;
    const task = workspace?.interpretationQueue;
    // A click must never disappear silently. Clear an earlier source-opening
    // delivery warning first, then explain any current saved-state blocker in
    // the Screen 4 panel instead of leaving the stale warning in place.
    setError("", 4);
    setNotice("", 4);
    setResponseDiagnostic(null);
    setLastAnalysisTrace(null);
    if (!snapshot || !investigation || !task) {
      setError(
        "The saved Screen 4 assessment queue is not available yet. Reopen Screen 4 or check saved status; no ChatGPT request was sent.",
        4,
      );
      return;
    }
    if (task.status !== "ready" &&
        !["new_request", "local_revalidation"].includes(
          task.retryEligibility)) {
      setError(
        task.error ??
          "The saved Screen 4 assessment is not currently eligible to run. Check its task details; no ChatGPT request was sent.",
        4,
      );
      return;
    }
    if (task.retryEligibility !== "local_revalidation" &&
        !task.readiness.canDispatch) {
      setError(
        task.readiness.blocker ??
          "The Screen 4 model request is blocked by its saved readiness check; no ChatGPT request was sent.",
        4,
      );
      return;
    }
    if (!beginAction("screen4-interpretation")) {
      setNotice(
        "The Screen 4 assessment action is already running. No second request was sent.",
        4,
      );
      return;
    }
    markModelTaskBusy("screen4_interpretation", true);
    let currentSnapshot = snapshot;
    try {
      const latestQueue = await advanceScreen4AssessmentQueue({
        initialQueue: task,
        advance: async (currentQueue, batch) => {
          const operationKey = `screen4-assessment-batch-${batch + 1}`;
          const operation = retryableOperationId(operationKey, {
            investigationFingerprint: investigation.investigationFingerprint,
            taskFingerprint: currentQueue.taskFingerprint,
            completedCount: currentQueue.completedCount,
            batchNumber: currentQueue.diagnosis?.batchNumber ?? batch + 1,
            retryEligibility: currentQueue.retryEligibility,
          });
          currentSnapshot = await mutate(currentSnapshot, {
            action: "analyze_study_first_events",
            expectedRevision: currentSnapshot.revision,
            operationId: operation,
            expectedInvestigationFingerprint:
              investigation.investigationFingerprint,
          });
          completeRetryableOperation(operationKey, operation);
          consumeRecoveredAnalysisOperation(operation);
          const nextQueue = projectionRef.current
            ?.studyFirstEventInvestigationWorkspace.interpretationQueue;
          return nextQueue ?? null;
        },
      });
      if (latestQueue?.status === "completed") {
        setNotice("", 4);
      } else if (latestQueue?.error) {
        setError(latestQueue.error, 4);
      } else {
        setNotice(
          "Screen 4 saved the latest assessment checkpoint. Any remaining batch is shown below.",
          4,
        );
      }
    } catch (caught) {
      setError(message(caught), 4);
    } finally {
      markModelTaskBusy("screen4_interpretation", false);
      endAction("screen4-interpretation");
    }
  }

  async function continueToScreen5() {
    let snapshot = privateSnapshotRef.current;
    if (!snapshot) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      let recoveredNavigation = false;
      if (snapshot.state.activeScreen !== 5) {
        const base = snapshot;
        const navigation = await openScreenWithCanonicalRecovery({
          targetScreen: 5,
          open: () => mutate(base, {
            action: "open_screen_5",
            expectedRevision: base.revision,
            operationId: operationId("screen5"),
          }),
          recover: () => refreshCanonicalWorkflow(base),
        });
        snapshot = navigation.snapshot;
        recoveredNavigation = navigation.recovered;
      }
      setError("");
      setResponseDiagnostic(null);
      setError("", 5);
      setViewScreen(5);
      setNotice(
        recoveredNavigation
          ? "Screen 5 opened from the saved navigation result after the ordinary response was interrupted. The action was not sent twice."
          : projection?.screen5Prerequisites.handoffKind === "study_first_v2"
          ? "Screen 5 opened from the study-first reference; the legacy literature executor remains an explicit limitation."
          : "Screen 5 opened for a source-bound literature plan. Missing design or co-event reviews remain explicit limitations.",
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function continueToScreen6() {
    let snapshot = privateSnapshotRef.current;
    if (!snapshot) return;
    if (screen5CheckpointIsActive(activeActions.current)) {
      setError("", 5);
      setResponseDiagnostic(null);
      setNotice(
        "The mechanism assessment is still being saved. Stay on Screen 5; the continue button will become available when this step finishes.",
        5,
      );
      return;
    }
    const actionKey = "continue-screen6";
    if (!beginAction(actionKey)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      let recoveredNavigation = false;
      if (snapshot.state.activeScreen !== 6) {
        const base = snapshot;
        const navigation = await openScreenWithCanonicalRecovery({
          targetScreen: 6,
          open: () => mutate(base, {
            action: "open_screen_6",
            expectedRevision: base.revision,
            operationId: operationId("screen6"),
          }),
          recover: () => refreshCanonicalWorkflow(base),
        });
        snapshot = navigation.snapshot;
        recoveredNavigation = navigation.recovered;
      }
      setError("");
      setResponseDiagnostic(null);
      setError("", 6);
      setViewScreen(6);
      setNotice(
        recoveredNavigation
          ? "Screen 6 opened from the saved navigation result after the ordinary response was interrupted. The action was not sent twice."
          : "Screen 6 opened with every available current snapshot and all missing upstream work preserved as limitations.",
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
      endAction(actionKey);
    }
  }

  async function personalizeScreen3Advice() {
    const snapshot = privateSnapshotRef.current;
    const advice = projection?.causalComparisonWorkspace.studyFirst.advice;
    if (!snapshot || !advice) return;
    const retry = projection.causalComparisonWorkspace.studyFirst
      .contextualization?.retryEligibility;
    const task = projection.causalComparisonWorkspace.studyFirst.contextualization;
    const explicitNewAttempt = task?.status === "outcome_unknown";
    if (task && retry !== "new_request" && retry !== "local_revalidation" && !explicitNewAttempt) return;
    if (!beginAction("screen3-critique")) return;
    markModelTaskBusy("screen3", true);
    setError("");
    try {
      await mutate(snapshot, screen3AssessmentMutation({
        expectedRevision: snapshot.revision,
        operationId: operationId("screen3-contextualize"),
        expectedAdviceFingerprint: advice.adviceFingerprint,
      }));
    } catch (caught) {
      setError(message(caught));
    } finally {
      markModelTaskBusy("screen3", false);
      endAction("screen3-critique");
    }
  }

  async function initializeScreen6Profile() {
    const snapshot = privateSnapshotRef.current;
    if (!snapshot) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await mutate(snapshot, {
        action: "initialize_screen6_uncertainty_profile",
        expectedRevision: snapshot.revision,
        operationId: operationId("screen6-profile"),
      });
      setNotice(
        "Ten separate uncertainty dimensions were initialized. No diagnostic, result, score, or causal certification was created.",
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function saveScreen6DiagnosticPlan(
    diagnosticInput: Omit<
      Screen6DiagnosticPlanInput,
      "schemaVersion" | "inputFingerprint"
    >,
  ) {
    const snapshot = privateSnapshotRef.current;
    if (!snapshot) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await mutate(snapshot, {
        action: "save_screen6_diagnostic_plan",
        expectedRevision: snapshot.revision,
        operationId: operationId("screen6-diagnostic-plan"),
        diagnosticInput,
      });
      setNotice(
        "The reviewed Screen 6 method engine saved prospective diagnostic cards. No diagnostic ran and no result or credibility status was created.",
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function recordScreen6DiagnosticResult(input: {
    cardId: string;
    expectedPlanFingerprint: string;
    expectedCardFingerprint: string;
    resultInput: Omit<
      Screen6DiagnosticResultInput,
      "schemaVersion" | "inputFingerprint"
    >;
  }) {
    const snapshot = privateSnapshotRef.current;
    if (!snapshot) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await mutate(snapshot, {
        action: "record_screen6_diagnostic_result",
        expectedRevision: snapshot.revision,
        operationId: operationId("screen6-diagnostic-result"),
        ...input,
      });
      setNotice(
        "The researcher-supplied diagnostic result and its provenance were recorded immutably. It remains uninterpreted until a separate review.",
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function reviewScreen6DiagnosticResult(input: {
    resultId: string;
    expectedResultFingerprint: string;
    decision: Screen6DiagnosticResultReviewDecision;
    rationale: string;
    followUpActions: string[];
  }) {
    const snapshot = privateSnapshotRef.current;
    if (!snapshot) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await mutate(snapshot, {
        action: "review_screen6_diagnostic_result",
        expectedRevision: snapshot.revision,
        operationId: operationId("screen6-diagnostic-result-review"),
        ...input,
      });
      setNotice(
        "The interpretation was recorded separately from the immutable result. No assumption, score, certificate, or claim boundary was created.",
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function saveScreen6ConditionalClaimBoundary(input: {
    expectedPlanFingerprint: string;
    claimInput: Omit<
      Screen6ClaimBoundaryInput,
      "schemaVersion" | "inputFingerprint"
    >;
  }) {
    const snapshot = privateSnapshotRef.current;
    if (!snapshot) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await mutate(snapshot, {
        action: "save_screen6_conditional_claim_boundary",
        expectedRevision: snapshot.revision,
        operationId: operationId("screen6-conditional-claim"),
        ...input,
      });
      setNotice(
        "The prospective claim boundary was recorded with its current design target, stronger-claim requirements, and unresolved issues. It is not a causal certificate.",
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function recordScreen6ResearchPlanningDisposition(input: {
    expectedBoundaryFingerprint: string;
    decision: Screen6ResearchPlanningDispositionDecision;
    rationale: string;
    specifiedRevisions: string[];
  }) {
    const snapshot = privateSnapshotRef.current;
    if (!snapshot) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await mutate(snapshot, {
        action: "record_screen6_research_planning_disposition",
        expectedRevision: snapshot.revision,
        operationId: operationId("screen6-research-disposition"),
        ...input,
      });
      setNotice(
        "The research-planning disposition was recorded. It did not change the design, upgrade attribution, or create a final export.",
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function createScreen6ResearchExport(input: {
    expectedDispositionFingerprint: string;
  }) {
    const snapshot = privateSnapshotRef.current;
    if (!snapshot) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await mutate(snapshot, {
        action: "create_screen6_research_export",
        expectedRevision: snapshot.revision,
        operationId: operationId("screen6-research-export"),
        ...input,
      });
      setNotice(
        "The current CredibilityPlan, DesignRecord, and source-linked decision trail were frozen into an immutable export. Any partial or unassessed work remains labeled.",
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function navigateToScreen(screen: 1 | 2 | 3 | 4 | 5 | 6) {
    // Sidebar navigation is a view operation. It never submits a hidden draft,
    // revises the workflow, reruns source research or spends an inference.
    if (navigationItems.some((item) => item.number === screen &&
      item.available)) setViewScreen(screen);
  }

  async function buildComparison(
    comparisonInput: Omit<
      CausalComparisonInput,
      "schemaVersion" | "inputFingerprint"
    >,
  ) {
    const snapshot = privateSnapshotRef.current;
    if (!snapshot) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await mutate(snapshot, {
        action: "build_causal_comparison",
        expectedRevision: snapshot.revision,
        operationId: operationId("causal-comparison"),
        comparisonInput,
      });
      setNotice(
        "The source-linked Design Set was saved. Its assumptions and missing prerequisites remain explicit.",
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function decideComparison(input: {
    decision:
      | { mode: "selected"; optionId: string }
      | { mode: "no_selection" };
    rationale: string;
  }) {
    const snapshot = privateSnapshotRef.current;
    const designSet = projection?.causalComparisonWorkspace.designSet;
    if (!snapshot || !designSet) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await mutate(snapshot, {
        action: "decide_causal_comparison",
        expectedRevision: snapshot.revision,
        operationId: operationId("causal-decision"),
        designSetSnapshotId: designSet.snapshotId,
        expectedDesignSetFingerprint: designSet.designSetFingerprint,
        decision: input.decision,
        rationale: input.rationale,
      });
      setNotice(
        input.decision.mode === "selected"
          ? "The comparison was selected for further review; it is not certified as causally valid."
          : "The explicit no-selection decision was saved.",
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function saveCoEventMatrix(input: Omit<
    CoEventSearchScopeInput,
    "schemaVersion" | "inputFingerprint"
  >) {
    const snapshot = privateSnapshotRef.current;
    if (!snapshot) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await mutate(snapshot, {
        action: "save_coevent_search_matrix",
        expectedRevision: snapshot.revision,
        operationId: operationId("coevent-matrix"),
        scopeInput: input,
      });
      setNotice(
        "The Screen 4 scope and deterministic search matrix were saved. Retrieval and relation analysis have not run.",
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function saveLiteraturePlan(input: Omit<
    MechanismLiteraturePlanInput,
    "schemaVersion" | "inputFingerprint"
  >) {
    const snapshot = privateSnapshotRef.current;
    if (!snapshot) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await mutate(snapshot, {
        action: "save_mechanism_literature_plan",
        expectedRevision: snapshot.revision,
        operationId: operationId("mechanism-literature-plan"),
        planInput: input,
      });
      setNotice(
        "The three-branch Screen 5 literature plan was saved. No scholarly query or mechanism analysis was claimed.",
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function continueLiteratureSearch() {
    const snapshot = privateSnapshotRef.current;
    if (!snapshot) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = await mutate(snapshot, {
        action: "continue_mechanism_literature_search",
        expectedRevision: snapshot.revision,
        operationId: operationId("mechanism-literature-step"),
      });
      const execution = next.state.mechanismLiteratureExecutions?.at(-1);
      const attempt = execution?.attempt;
      setNotice(!attempt
        ? "No tested scholarly metadata route was executable. The source-access limitation was saved without claiming a no-match result."
        : attempt.outcome === "source_unavailable"
          ? "Crossref was unavailable. The failure was retained separately from a no-match result."
          : attempt.outcome === "metadata_leads_found"
            ? `Crossref retained ${attempt.recordsAccepted} metadata lead${attempt.recordsAccepted === 1 ? "" : "s"}. No abstract, full text, or theory claim was inspected.`
            : `Crossref recorded ${readable(attempt.outcome)}. No scholarly text or mechanism was assessed.`);
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function inspectScholarlyDocument(input: Omit<
    ScholarlyDocumentInspectionInput,
    "schemaVersion" | "inputFingerprint"
  >) {
    const snapshot = privateSnapshotRef.current;
    if (!snapshot) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = await mutate(snapshot, {
        action: "inspect_scholarly_document",
        expectedRevision: snapshot.revision,
        operationId: operationId("scholarly-document"),
        inspectionInput: input,
      });
      const acquisition = next.state.scholarlyDocumentAcquisitions?.at(-1);
      setNotice(acquisition?.document
        ? acquisition.outcome === "abstract_passage_retained"
          ? "The exact abstract passage and document hashes were retained. Abstract-only text remains ineligible for detailed claim support."
          : "The exact partial-text passage, offsets, document/version identity, and hashes were retained for later researcher review. No theory claim or mechanism was created."
        : acquisition
          ? `${readable(acquisition.outcome)} was recorded without inferring the document's contents.`
          : "The scholarly-document boundary was recorded.");
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function extractScholarlyClaim(input: {
    passageId: string;
    expectedPassageFingerprint: string;
    fields: ScholarlyClaimFieldsDraft;
  }) {
    const snapshot = privateSnapshotRef.current;
    if (!snapshot) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await mutate(snapshot, {
        action: "extract_scholarly_claim",
        expectedRevision: snapshot.revision,
        operationId: operationId("scholarly-claim-extraction"),
        ...input,
      });
      setNotice(
        "The researcher-authored structured claim was bound to the exact passage and saved pending a separate decision. No mechanism or prediction was created.",
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function reviewScholarlyClaim(input: {
    extractionId: string;
    expectedExtractionFingerprint: string;
    decision: ScholarlyClaimReviewDecision;
    rationale: string;
  }) {
    const snapshot = privateSnapshotRef.current;
    if (!snapshot) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await mutate(snapshot, {
        action: "review_scholarly_claim",
        expectedRevision: snapshot.revision,
        operationId: operationId("scholarly-claim-review"),
        ...input,
      });
      setNotice(input.decision.mode === "corrected"
        ? "The corrected researcher claim was accepted while preserving the original extraction and exact source lineage. Mechanism synthesis remains blocked."
        : `The researcher ${input.decision.mode} the structured claim. Source evidence is unchanged and mechanism synthesis remains blocked.`);
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function prepareMechanismSynthesisInput(
    expectedClaimPacketFingerprint: string,
  ) {
    const snapshot = privateSnapshotRef.current;
    if (!snapshot) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await mutate(snapshot, {
        action: "prepare_mechanism_synthesis_input",
        expectedRevision: snapshot.revision,
        operationId: operationId("mechanism-synthesis-input"),
        expectedClaimPacketFingerprint,
      });
      setNotice(
        "The accepted scholarly claims, reviewed policy premises, study outcome and construct, starting explanation, and known alternatives were frozen as deterministic inputs. No synthesis, theory card, mechanism, prediction, measure, or estimate was created.",
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function saveMechanismReviewRecord(input: {
    expectedSynthesisInputFingerprint: string;
    draft: MechanismReviewDraft;
  }) {
    const snapshot = privateSnapshotRef.current;
    if (!snapshot) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await mutate(snapshot, {
        action: "save_mechanism_review",
        expectedRevision: snapshot.revision,
        operationId: operationId("mechanism-review"),
        ...input,
      });
      setNotice(
        "The researcher-authored mechanism review and observable prediction matrix were saved with exact source and synthesis-input lineage. Fixed software created only the transparent compact evidence plan; no mechanism, pattern, measure, or effect was generated.",
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function continueCoEventSearch() {
    const snapshot = privateSnapshotRef.current;
    if (!snapshot) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = await mutate(snapshot, {
        action: "continue_coevent_search",
        expectedRevision: snapshot.revision,
        operationId: operationId("coevent-step"),
      });
      const attempt = next.state.coEventSearchExecutions?.at(-1)?.attempt;
      setNotice(attempt?.outcome === "source_unavailable"
        ? `${readable(attempt.providerId)} was unavailable; this was recorded separately from a no-match result.`
        : attempt?.outcome === "no_match"
          ? `${readable(attempt.providerId)} completed its bounded query with no match.`
          : attempt
            ? `${readable(attempt.providerId)} recorded ${readable(attempt.outcome)}. Causal relevance remains unassessed.`
            : "The saved plan has no executable provider route; its capability boundary is now recorded.");
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function reviewCoEventOccurrenceRecord(
    input: CoEventOccurrenceReviewRequest,
  ) {
    const snapshot = privateSnapshotRef.current;
    if (!snapshot) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await mutate(snapshot, {
        action: "review_coevent_occurrence",
        expectedRevision: snapshot.revision,
        operationId: operationId("coevent-occurrence-review"),
        ...input,
      });
      setNotice(
        input.decision.mode === "corrected"
          ? "The researcher-supplied occurrence correction was saved beside the unchanged source record."
          : `The occurrence record was marked ${readable(input.decision.mode)}; causal relevance remains unassessed.`,
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function reviewCoEventRelationRecord(
    input: CoEventRelationReviewRequest,
  ) {
    const snapshot = privateSnapshotRef.current;
    if (!snapshot) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await mutate(snapshot, {
        action: "review_coevent_relation",
        expectedRevision: snapshot.revision,
        operationId: operationId("coevent-relation-review"),
        ...input,
      });
      setNotice(
        `The researcher-authored ${readable(input.decision.category)} judgment was saved as ${readable(input.decision.mode)}. Occurrence evidence remains unchanged and no control was added.`,
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function reviewCoEventDuplicateRecords(
    input: CoEventDuplicateReviewRequest,
  ) {
    const snapshot = privateSnapshotRef.current;
    if (!snapshot) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await mutate(snapshot, {
        action: "review_coevent_duplicate_pair",
        expectedRevision: snapshot.revision,
        operationId: operationId("coevent-duplicate-review"),
        ...input,
      });
      setNotice(
        `The pair was marked ${readable(input.decision.mode)}; both source records and any separate comparison-specific relation judgments remain unchanged.`,
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function routeCoEventPolicyStage(
    input: CoEventPolicyLifecycleHandoffRequest,
  ) {
    const snapshot = privateSnapshotRef.current;
    if (!snapshot) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await mutate(snapshot, {
        action: "route_coevent_policy_stage_to_screen_2",
        expectedRevision: snapshot.revision,
        operationId: operationId("coevent-policy-stage"),
        ...input,
      });
      setViewScreen(2);
      setNotice(
        "Screen 2 opened a new Event Card review for the possible policy stage. The prior Event Card and Screen 4 source occurrence remain unchanged.",
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function acquirePolicyLifecycleStageDocument(
    input: PolicyLifecycleStageAcquisitionRequest,
  ) {
    const snapshot = privateSnapshotRef.current;
    if (!snapshot) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = await mutate(snapshot, {
        action: "acquire_policy_lifecycle_stage_document",
        expectedRevision: snapshot.revision,
        operationId: operationId("policy-lifecycle-stage-document"),
        ...input,
      });
      const acquisition = next.state.policyLifecycleStageDocumentAcquisitions
        ?.at(-1);
      setNotice(acquisition?.outcome === "document_retained"
        ? "The bounded official document and exact retained passages were saved. Review and explicitly accept, reject, or defer the possible stage."
        : acquisition?.limitation ??
          "The official-document attempt was saved without inferring a policy fact.");
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function reviewPolicyLifecycleStageDocumentRecord(
    input: PolicyLifecycleStageDispositionRequest,
  ) {
    const snapshot = privateSnapshotRef.current;
    if (!snapshot) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await mutate(snapshot, {
        action: "review_policy_lifecycle_stage_document",
        expectedRevision: snapshot.revision,
        operationId: operationId("policy-lifecycle-stage-disposition"),
        ...input,
      });
      setNotice(
        `The possible stage document was ${readable(input.decision)}. The official source remains immutable, and chronology and the Event Card remain unchanged.`,
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function proposePolicyLifecycleStageRevisionRecord(
    input: PolicyLifecycleStageRevisionProposalRequest,
  ) {
    const snapshot = privateSnapshotRef.current;
    if (!snapshot) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await mutate(snapshot, {
        action: "propose_policy_lifecycle_stage_revision",
        expectedRevision: snapshot.revision,
        operationId: operationId("policy-lifecycle-stage-proposal"),
        ...input,
      });
      setNotice(
        "The source-bound lifecycle-stage proposal was saved without changing chronology or the pending Event Card. Review it separately before locking.",
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function reviewPolicyLifecycleStageRevisionRecord(
    input: PolicyLifecycleStageRevisionReviewRequest,
  ) {
    const snapshot = privateSnapshotRef.current;
    if (!snapshot) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await mutate(snapshot, {
        action: "review_policy_lifecycle_stage_revision",
        expectedRevision: snapshot.revision,
        operationId: operationId("policy-lifecycle-stage-proposal-review"),
        ...input,
      });
      setNotice(
        `The lifecycle-stage proposal was ${readable(input.decision)}. Chronology and the Event Card remain unchanged until an explicit lock.`,
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function runStandardPolicyResearch() {
    const actionGuard = "automatic-standard-policy-research";
    if (!beginAction(actionGuard)) return;
    let current = privateSnapshotRef.current;
    const identity = current?.state.confirmedShock;
    if (!current || !identity) {
      endAction(actionGuard);
      return;
    }
    setError("");
    setNotice("");
    setPolicyAutomation({
      identityFingerprint: identity.identityFingerprint,
      status: "running",
      message: "Starting the bounded standard evidence plan…",
    });
    try {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const review = current.state.policyReview;
        if (review?.artifactStatus === "current" && !review.plan.nextStepId) {
          setPolicyAutomation({
            identityFingerprint: identity.identityFingerprint,
            status: "complete",
            message: completedPolicyResearchMessage(review),
          });
          setNotice("");
          return;
        }
        const action = review
          ? "continue_policy_research" as const
          : "research_policy" as const;
        const stepId = review?.plan.nextStepId ?? "initial-standard-step";
        const operationKey = [
          "automatic-policy-step",
          current.runId,
          review?.taskId ?? "new-task",
          stepId,
        ].join(":");
        const payload = {
          runId: current.runId,
          revision: current.revision,
          action,
          stepId,
          identityFingerprint: identity.identityFingerprint,
        };
        const policyOperationId = retryableOperationId(operationKey, payload);
        const mutation = {
          action,
          expectedRevision: current.revision,
          operationId: policyOperationId,
        };
        const step = review?.plan.steps.find(({ id }) => id === stepId);
        setPolicyAutomation({
          identityFingerprint: identity.identityFingerprint,
          status: "running",
          message: step
            ? `Researching ${step.label.toLowerCase()} (${policyPlanProgress(review!).finished + 1}/${review!.progress.totalSteps})…`
            : "Researching the first standard-plan source route…",
        });
        const beforeStep = current;
        current = await reconcilePolicyResearchStep({
          before: beforeStep,
          stepId,
          mutate: (snapshot) => mutate(snapshot, mutation),
          refresh: refreshCanonicalWorkflow,
        });
        completeRetryableOperation(operationKey, policyOperationId);
        const nextReview = current.state.policyReview;
        if (nextReview) {
          setPolicyAutomation({
            identityFingerprint: identity.identityFingerprint,
            status: nextReview.plan.nextStepId ? "running" : "complete",
            message: nextReview.plan.nextStepId
              ? `Standard research ${policyPlanProgress(nextReview).finished}/${nextReview.progress.totalSteps}: ${nextReview.claimCount} source-linked claims saved.`
              : completedPolicyResearchMessage(nextReview),
          });
        }
      }
      throw new Error(
        "The standard policy plan exceeded its bounded twelve-step client continuation limit.",
      );
    } catch (caught) {
      const detail = message(caught);
      setPolicyAutomation({
        identityFingerprint: identity.identityFingerprint,
        status: "paused",
        message:
          "Standard research paused safely. Saved inputs and verified results were preserved.",
        detail,
      });
    } finally {
      endAction(actionGuard);
    }
  }

  async function beginEventCardReview(revisionReason: string | null) {
    const snapshot = privateSnapshotRef.current;
    if (!snapshot) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await mutate(snapshot, {
        action: "begin_policy_event_card_review",
        expectedRevision: snapshot.revision,
        operationId: operationId("event-card-review"),
        revisionReason,
      });
      setNotice(
        "The evidence-bound Event Card review is open. No claim or treatment clock was selected automatically.",
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function saveEventCardClaim(
    review: PolicyEventCardReviewState,
    input: {
      claimId: string;
      decision: Exclude<PolicyClaimReviewDecision, "unreviewed">;
      correctedStatement?: string | null;
      rationale: string;
    },
  ) {
    const snapshot = privateSnapshotRef.current;
    if (!snapshot) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await mutate(snapshot, {
        action: "review_policy_event_card_claim",
        expectedRevision: snapshot.revision,
        operationId: operationId("claim-review"),
        reviewId: review.id,
        expectedReviewRevision: review.revision,
        expectedReviewFingerprint: review.reviewFingerprint,
        claimId: input.claimId,
        decision: input.decision,
        correctedStatement: input.correctedStatement ?? null,
        rationale: input.rationale,
      });
      setNotice("The claim decision and its reason were appended to review history.");
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function saveTreatmentClock(
    review: PolicyEventCardReviewState,
    input: {
      decision:
        | { mode: "selected"; candidateId: string }
        | { mode: "no_selection" };
      rationale: string;
    },
  ) {
    const snapshot = privateSnapshotRef.current;
    if (!snapshot) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await mutate(snapshot, {
        action: "decide_policy_treatment_clock",
        expectedRevision: snapshot.revision,
        operationId: operationId("treatment-clock"),
        reviewId: review.id,
        expectedReviewRevision: review.revision,
        expectedReviewFingerprint: review.reviewFingerprint,
        decision: input.decision,
        rationale: input.rationale,
      });
      setNotice("The explicit treatment-timing decision was saved.");
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function lockEventCard(
    review: PolicyEventCardReviewState,
    rationale: string,
  ) {
    const snapshot = privateSnapshotRef.current;
    if (!snapshot) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await mutate(snapshot, {
        action: "lock_policy_event_card",
        expectedRevision: snapshot.revision,
        operationId: operationId("event-card-lock"),
        reviewId: review.id,
        expectedReviewRevision: review.revision,
        expectedReviewFingerprint: review.reviewFingerprint,
        rationale,
      });
      setNotice(
        "The reviewed Event Card is locked against its immutable evidence snapshot.",
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  if (
    hostView.embedded && hostView.displayMode === "inline" &&
    hostView.canFullscreen
  ) {
    return (
      <main className="six-launcher">
        <div>
          <p className="six-kicker">ShockAudit · six-screen workspace</p>
          <h1>{privateSnapshot ? "Resume your policy study" : "Open ShockAudit"}</h1>
          <p>
            Confirm the exact policy, reconstruct source-linked facts, and carry
            one saved research record through all six screens.
          </p>
        </div>
        <button
          type="button"
          className="six-primary"
          disabled={displayModeBusy || !hostView.connected}
          onClick={() => void openWorkspace()}
        >
          {displayModeBusy
            ? "Opening workspace…"
            : privateSnapshot
              ? `Resume Screen ${viewScreen}`
              : "Open full workspace"}
        </button>
        {displayModeNotice ? (
          <p className="six-display-mode-notice" role="status">
            {displayModeNotice}
          </p>
        ) : null}
        <small>Saved state stays bound to this workspace.</small>
      </main>
    );
  }

  if (legacyState && !privateSnapshot) {
    return (
      <main className="six-legacy">
        <p className="six-kicker">ShockAudit saved workflow</p>
        <h1>Legacy run preserved</h1>
        <p>
          This saved run remains read-only and exportable. Its previously selected
          event will not be converted into a confirmed shock without a new researcher decision.
        </p>
        <WorkflowErrorAlert
          message={error}
          diagnostic={responseDiagnostic}
        />
        <button type="button" className="six-secondary" onClick={downloadLegacyExport}>
          Export saved run (.json)
        </button>
        <p>Open a new ShockAudit workspace to begin the six-screen workflow.</p>
      </main>
    );
  }

  return (
    <div className="six-shell" data-display-mode={hostView.displayMode}>
      <header className="six-header">
        <div>
          <p className="six-kicker">ShockAudit · natural experiment workspace</p>
          <h1>{viewScreen}. {steps[viewScreen - 1]}</h1>
        </div>
        <div className="six-header-actions">
          <div className="six-connection" data-connected={hostView.connected}>
            <span aria-hidden="true" />
            {hostView.connected ? "Saved workspace" : "Workspace connection unavailable"}
          </div>
          <button
            type="button"
            className="six-secondary six-report-toggle"
            onClick={() => setRestartOpen(true)}
          >
            Start a new search
          </button>
        </div>
      </header>

      {restartOpen ? (
        <div className="six-dialog-backdrop">
          <section className="six-dialog" role="dialog" aria-modal="true"
            aria-labelledby="six-restart-title"
            aria-describedby="six-restart-description">
            <p className="six-kicker">Start over</p>
            <h2 id="six-restart-title">Clear this workspace?</h2>
            <p id="six-restart-description">
              This will remove the current run, drafts, results, and active
              work, then return to a blank Screen 1. Download anything you
              need from Screen 6 before continuing.
            </p>
            <div className="six-actions">
              <button type="button" className="six-secondary"
                autoFocus
                disabled={restartBusy}
                onClick={() => setRestartOpen(false)}>
                Keep current workspace
              </button>
              <button type="button" className="six-primary"
                disabled={restartBusy}
                onClick={() => void restartWorkflow()}>
                {restartBusy ? "Clearing workspace…" : "Clear and start over"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <ResearchExportDrawer
        open={reportOpen}
        state={privateSnapshot?.state ?? null}
        availability={exportAvailability}
        onClose={() => setReportOpen(false)}
        onDownload={downloadResearchExport}
      />

      {(visibleConfirmedShock || privateSnapshot?.state.study.period.start ||
          privateSnapshot?.state.study.period.end) ? (
        <div className="six-context-strip" aria-label="Current study context">
          {visibleConfirmedShock ? (
            <p>
              <strong>{visibleConfirmedShock.officialTitle}</strong>
              <span>{visibleConfirmedShock.episode}</span>
            </p>
          ) : null}
          {(privateSnapshot?.state.study.period.start ||
              privateSnapshot?.state.study.period.end) ? (
            <p>
              <strong>Study period</strong>
              <span>
                {privateSnapshot?.state.study.period.start ?? "start undecided"}
                {" – "}
                {privateSnapshot?.state.study.period.end ?? "end undecided"}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="six-workspace-layout">
      <nav className="six-steps" aria-label="ShockAudit screens">
        {navigationItems.map(({ number, label, available, status, unmet }) => (
            <button
              key={label}
              type="button"
              className={number === viewScreen ? "is-active" : ""}
              disabled={!available}
              title={available
                ? `${label}: ${status}`
                : unmet}
              onClick={() => available &&
                void navigateToScreen(number)}
            >
              <span>{number}</span>
              <strong>{label}</strong>
              <small>{status}</small>
            </button>
          ))}
      </nav>

      <div className="six-content-column">
        <label className="six-step-selector">
          <span>Workflow screen</span>
          <select
            value={viewScreen}
            onChange={(event) => {
              const item = navigationItems.find(({ number }) =>
                number === Number(event.target.value)
              );
              if (item?.available) void navigateToScreen(item.number);
            }}
          >
            {navigationItems.map(({ number, label, available, status }) => (
              <option key={label} value={number} disabled={!available}>
                {number}. {label} — {status}
              </option>
            ))}
          </select>
          {!navigationItems[viewScreen - 1]?.available ? (
            <small>{navigationItems[viewScreen - 1]?.unmet}</small>
          ) : null}
        </label>

      <WorkflowErrorAlert
        message={error}
        diagnostic={responseDiagnostic}
        onCheckSavedStatus={privateSnapshot ? () => void checkSavedStatus() : undefined}
      />
      {widgetPersistenceWarning ? (
        <div className="six-alert" role="status">{widgetPersistenceWarning}</div>
      ) : null}
      {lastAnalysisTrace ? (
        <details className="six-technical-details six-analysis-diagnostic">
          <summary>Inspect safe task history</summary>
          <pre>{JSON.stringify(lastAnalysisTrace, null, 2)}</pre>
        </details>
      ) : null}
      {notice ? <div className="six-alert six-alert--success" role="status">{notice}</div> : null}
      {viewScreen === 6 ? (
        <main className="six-main">
          {visibleScreen6UncertaintyWorkspace &&
              projection?.screen6Prerequisites.ready ? (
            <>
              <Suspense fallback={<p role="status">
                Loading the saved Screen 6 challenge plan…</p>}>
              <Screen6CurrentPlanPanel
                plan={projection.screen6CurrentPlan}
                workflowState={privateSnapshot?.state}
                eventWorkspace={projection.studyFirstEventInvestigationWorkspace}
                onDownloadFile={(file) => bridge.downloadFile(file)}
                designMap={createScreen6DesignMapProjection(
                  projection.screen6CurrentPlan)}
              />
              </Suspense>
              <details className="six-legacy-screen6">
                <summary>Optional refinements, earlier records and diagnostic results</summary>
              <Suspense fallback={<p role="status">Loading earlier Screen 6 records…</p>}>
              <Screen6UncertaintyPanel
                key={`${visibleScreen6UncertaintyWorkspace.profile?.snapshotId ?? "new-screen6-profile"}:${visibleScreen6UncertaintyWorkspace.diagnosticPlan?.snapshotId ?? "new-screen6-plan"}:${visibleScreen6UncertaintyWorkspace.conditionalClaimBoundary?.snapshotId ?? "new-screen6-boundary"}:${visibleScreen6UncertaintyWorkspace.researchPlanningDisposition?.id ?? "new-screen6-disposition"}:${visibleScreen6UncertaintyWorkspace.researchExport?.id ?? "new-screen6-export"}`}
                workspace={visibleScreen6UncertaintyWorkspace}
                limitations={projection.screen6Prerequisites.limitations}
                disabled={busy || !hostView.connected ||
                  projection.activeScreen !== 6}
                canInitialize={
                  projection.canInitializeScreen6UncertaintyProfile
                }
                canSaveDiagnosticPlan={
                  projection.canSaveScreen6DiagnosticPlan
                }
                canRecordDiagnosticResult={
                  projection.canRecordScreen6DiagnosticResult
                }
                canReviewDiagnosticResult={
                  projection.canReviewScreen6DiagnosticResult
                }
                canSaveConditionalClaimBoundary={
                  projection.canSaveScreen6ConditionalClaimBoundary
                }
                canRecordResearchPlanningDisposition={
                  projection.canRecordScreen6ResearchPlanningDisposition
                }
                canCreateResearchExport={
                  projection.canCreateScreen6ResearchExport
                }
                onInitialize={initializeScreen6Profile}
                onSaveDiagnosticPlan={saveScreen6DiagnosticPlan}
                onRecordDiagnosticResult={recordScreen6DiagnosticResult}
                onReviewDiagnosticResult={reviewScreen6DiagnosticResult}
                onSaveConditionalClaimBoundary={
                  saveScreen6ConditionalClaimBoundary
                }
                onRecordResearchPlanningDisposition={
                  recordScreen6ResearchPlanningDisposition
                }
                onCreateResearchExport={createScreen6ResearchExport}
              />
              </Suspense>
              </details>
              <div className="six-actions six-screen-navigation">
                <button
                  type="button"
                  className="six-secondary"
                  onClick={() => void navigateToScreen(screen5IsOpen ? 5 : 2)}
                >
                  {screen5IsOpen
                    ? "Back to mechanism literature"
                    : "Back to reviewed policy record"}
                </button>
                <button
                  type="button"
                  className="six-secondary"
                  aria-expanded={reportOpen}
                  aria-controls="six-screen-report-drawer"
                  onClick={() => setReportOpen(true)}
                >
                  Report &amp; export
                </button>
              </div>
            </>
          ) : (
            <section className="six-card">
              <p className="six-kicker">Screen 6 handoff unavailable</p>
              <h2>Confirm the current policy identity</h2>
              <p>
                Screen 6 can preserve incomplete Screens 2–5 as explicit gaps,
                but it cannot open without the current researcher-confirmed
                policy identity and study revision.
              </p>
              <button
                type="button"
                className="six-secondary"
                onClick={() => void navigateToScreen(1)}
              >
                Return to policy identity
              </button>
            </section>
          )}
        </main>
      ) : viewScreen === 5 ? (
        <main className="six-main">
          {projection?.screen5Prerequisites.ready &&
              projection.screen5Prerequisites.handoffKind ===
                "study_first_v2" ? (
            <>
              <StudyFirstMechanismPanel
                workspace={visibleStudyFirstMechanismWorkspace ?? {
                  schemaVersion:
                    "screen-05-study-first-mechanism-workspace-v1",
                  currentInput: null,
                  currentRun: null,
                  previousCompatibleRun: null,
                  executionReadiness: {
                    schemaVersion: "screen-05-execution-readiness-v2",
                    selectedBackend: "unresolved",
                    provider: "openai",
                    model: "gpt-6-luna",
                    route: "direct_setup_required",
                    configuration: "unresolved",
                    missingSettings: [],
                    keyPresent: false,
                    credentialStatus: "not_tested",
                    ledgerState: "unresolved",
                    allowance: null,
                    authorization: "unresolved",
                    authorizedStages: [],
                    activeOrigin: "none",
                    activeExecutionId: null,
                    migration: "unresolved",
                    canEnsure: false,
                    canAdvanceWithoutInference: false,
                    canDispatch: false,
                    serverObservedAt: null,
                    nextAction: "none",
                  },
                  revisions: [],
                  claimBoundary:
                    "No mechanism input or scholarly comparison has been saved.",
                }}
                study={projection.study}
                context={
                  visibleStudyFirstEventWorkspace?.investigation?.context ??
                    null
                }
                initialDraft={restoredScreen5Draft}
                onDraftChange={(draft) => {
                  const activeRunId = privateSnapshotRef.current?.runId;
                  if (!activeRunId) return;
                  void bridge.saveScreen5MechanismDraft({
                    schemaVersion: "screen-05-mechanism-draft-v1",
                    runId: activeRunId,
                    baseInputFingerprint:
                      visibleStudyFirstMechanismWorkspace?.currentInput
                        ?.inputFingerprint ?? null,
                    theoreticalPerspective: draft.theoreticalPerspective,
                    proposedMechanism: draft.proposedMechanism,
                  });
                }}
                disabled={!hostView.connected}
                hostReasoningMode={hostReasoningMode}
                planningHostEntry={
                  visibleStudyFirstMechanismWorkspace?.currentRun
                    ? currentStudyFirstHostEntries[
                        studyFirstHostEntryKey(
                          SCREEN05_THEORETICAL_PLANNING_TASK,
                          visibleStudyFirstMechanismWorkspace.currentRun.id,
                        )
                      ]
                    : undefined
                }
                planningHostBusy={
                  visibleStudyFirstMechanismWorkspace?.currentRun
                    ? studyFirstHostBusyKey === studyFirstHostEntryKey(
                        SCREEN05_THEORETICAL_PLANNING_TASK,
                        visibleStudyFirstMechanismWorkspace.currentRun.id,
                      )
                    : false
                }
                planningHostNotice={
                  visibleStudyFirstMechanismWorkspace?.currentRun
                    ? studyFirstHostNotices[
                        studyFirstHostEntryKey(
                          SCREEN05_THEORETICAL_PLANNING_TASK,
                          visibleStudyFirstMechanismWorkspace.currentRun.id,
                        )
                      ]
                    : undefined
                }
                hostEntry={
                  visibleStudyFirstMechanismWorkspace?.currentRun
                    ? currentStudyFirstHostEntries[
                        studyFirstHostEntryKey(
                          SCREEN05_STUDY_MECHANISM_COMPARISON_TASK,
                          visibleStudyFirstMechanismWorkspace.currentRun.id,
                        )
                      ]
                    : undefined
                }
                hostBusy={
                  visibleStudyFirstMechanismWorkspace?.currentRun
                    ? studyFirstHostBusyKey === studyFirstHostEntryKey(
                        SCREEN05_STUDY_MECHANISM_COMPARISON_TASK,
                        visibleStudyFirstMechanismWorkspace.currentRun.id,
                      )
                    : false
                }
                hostNotice={
                  visibleStudyFirstMechanismWorkspace?.currentRun
                    ? studyFirstHostNotices[
                        studyFirstHostEntryKey(
                          SCREEN05_STUDY_MECHANISM_COMPARISON_TASK,
                          visibleStudyFirstMechanismWorkspace.currentRun.id,
                        )
                      ]
                    : undefined
                }
                modelBusy={modelTasksBusy.has("screen5")}
                directActionStage={screen5DirectAction}
                onCompare={compareStudyFirstMechanisms}
                onAdvanceProvider={advanceDirectScreen5}
                generationUnavailableReason={projection.optionalAnalysisRecovery.blockedScreens.includes(5)
                  ? `A saved optional Screen 5 record could not be validated (${projection.optionalAnalysisRecovery.isolatedCounts.screen5} isolated). The verified focal input remains readable. Inspect or repair this record before generating alternatives.`
                  : null}
                onEditStudy={() => void navigateToScreen(2)}
              />
              <section className="six-screen-gate" aria-label="Screen 6 readiness">
                <p className="six-kicker">Screen 5 → Screen 6</p>
                <h3>Open the design summary</h3>
                <p>
                  Screen 6 brings the proposed design, alternative events,
                  mechanisms, and remaining questions into one review.
                </p>
                <button
                  type="button"
                  className="six-primary"
                  disabled={busy || Boolean(screen5DirectAction) ||
                    modelTasksBusy.has("screen5") ||
                    studyFirstHostBusyKey !== null || !hostView.connected ||
                    !projection.screen6Prerequisites.ready}
                  onClick={() => void continueToScreen6()}
                >
                  {busy
                    ? "Opening design summary…"
                    : screen5DirectAction || modelTasksBusy.has("screen5") ||
                        studyFirstHostBusyKey !== null
                      ? "Preparing design summary…"
                      : "Continue to design summary"}
                </button>
              </section>
              <div className="six-actions six-screen-navigation">
                <button
                  type="button"
                  className="six-secondary"
                  onClick={() => void navigateToScreen(screen4IsOpen ? 4 : 3)}
                >
                  Back to other-event review
                </button>
              </div>
            </>
          ) : visibleMechanismLiteratureWorkspace &&
              (projection?.study ?? privateSnapshot?.state.study) &&
              projection?.screen5Prerequisites.handoffKind === "legacy_event_card" ? (
            <>
              <section className="six-card" role="status">
                <p className="six-kicker">Historical mechanism records</p>
                <h2>Earlier Screen 5 work is available to read</h2>
                <p>The historical literature route used an older saved construct field. Its records remain visible; new work uses the theoretical construct of the shock in the current study-first Screen 3 handoff.</p>
                <button type="button" className="six-secondary"
                  onClick={() => void navigateToScreen(3)}>
                  Open current study-first design
                </button>
              </section>
              {visibleMechanismLiteratureWorkspace.plan ||
                visibleMechanismLiteratureWorkspace.execution ||
                visibleMechanismLiteratureWorkspace.mechanismReview ? (
              <MechanismLiteraturePlanPanel
                key={
                  [
                    visibleMechanismLiteratureWorkspace.plan?.snapshotId ??
                      "new-mechanism-literature-plan",
                    visibleMechanismLiteratureWorkspace.synthesisInputPacket
                      ?.snapshotId ?? "no-synthesis-input",
                    visibleMechanismLiteratureWorkspace.mechanismReview
                      ?.snapshotId ?? "no-mechanism-review",
                  ].join(":")
                }
                workspace={visibleMechanismLiteratureWorkspace}
                study={projection?.study ?? privateSnapshot!.state.study}
                disabled={true}
                canContinue={false}
                canInspect={false}
                canExtractClaim={false}
                canReviewClaim={false}
                canPrepareSynthesisInput={false}
                canSaveMechanismReview={false}
                onSave={saveLiteraturePlan}
                onContinue={continueLiteratureSearch}
                onInspect={inspectScholarlyDocument}
                onExtractClaim={extractScholarlyClaim}
                onReviewClaim={reviewScholarlyClaim}
                onPrepareSynthesisInput={prepareMechanismSynthesisInput}
                onSaveMechanismReview={saveMechanismReviewRecord}
              />
              ) : null}
              <section className="six-screen-gate" aria-label="Screen 6 readiness">
                <p className="six-kicker">Screen 5 → Screen 6</p>
                <h3>
                  {projection?.screen6Prerequisites.ready
                    ? "Open the design summary"
                    : "Reconnect the Screen 6 identity binding"}
                </h3>
                <p>
                  Screen 6 brings the proposed design and the available
                  evidence into one summary. Missing work remains visible in
                  the detailed design checks.
                </p>
                {projection?.screen6Prerequisites.limitations.length ? (
                  <details>
                    <summary>Gaps that will remain visible</summary>
                    <ul>
                      {projection.screen6Prerequisites.limitations.map((gap) => (
                        <li key={gap.code}>{gap.message}</li>
                      ))}
                    </ul>
                  </details>
                ) : null}
                <button
                  type="button"
                  className="six-primary"
                  disabled={busy || Boolean(screen5DirectAction) ||
                    modelTasksBusy.has("screen5") ||
                    studyFirstHostBusyKey !== null || !hostView.connected ||
                    !projection?.screen6Prerequisites.ready}
                  onClick={() => void continueToScreen6()}
                >
                  {busy
                    ? "Opening design summary…"
                    : screen5DirectAction || modelTasksBusy.has("screen5") ||
                        studyFirstHostBusyKey !== null
                      ? "Preparing design summary…"
                      : "Continue to design summary"}
                </button>
              </section>
              <div className="six-actions six-screen-navigation">
                <button
                  type="button"
                  className="six-secondary"
                  onClick={() => void navigateToScreen(screen4IsOpen ? 4 : 2)}
                >
                  {screen4IsOpen
                    ? "Back to other-event review"
                    : "Back to reviewed Event Card"}
                </button>
              </div>
            </>
          ) : (
            <section className="six-card">
              <p className="six-kicker">Screen 5 handoff unavailable</p>
              <h2>Reconnect the policy premise and study construct</h2>
              <p>
                Screen 5 needs the current confirmed policy and outcome, plus
                the study-first reference or a preserved legacy Event Card.
                The current path uses the theoretical construct of the shock.
                Missing design or Screen 4 review remains a limitation.
              </p>
              {projection?.screen5Prerequisites.blockers.length ? (
                <ul>
                  {projection.screen5Prerequisites.blockers.map((blocker) => (
                    <li key={blocker.code}>{blocker.message}</li>
                  ))}
                </ul>
              ) : null}
              <button
                type="button"
                className="six-secondary"
                onClick={() => void navigateToScreen(2)}
              >
                Return to the reviewed Event Card
              </button>
            </section>
          )}
        </main>
      ) : viewScreen === 4 ? (
        <main className="six-main">
          {projection?.screen4Prerequisites.ready &&
              projection.screen4Prerequisites.handoffKind ===
                "study_first_v2" ? (
            <>
              <StudyFirstEventInvestigationPanel
                workspace={visibleStudyFirstEventWorkspace ?? {
                  investigation: null,
                  discoveryTask: null,
                  documentedOccurrences: [],
                  refreshAvailable: false,
                  sourceVersionCurrent: false,
                  interpretationQueue: null,
                  interpretationRevisions: [],
                  latestScreen5Handoff: null,
                  revisions: [],
                  claimBoundary: "The automatic study-first investigation has not published a result.",
                }}
                disabled={!hostView.connected}
                sourceBusy={modelTasksBusy.has("screen4_source")}
                onResumeSource={continueToScreen4}
                refreshAvailable={projection.studyFirstEventInvestigationWorkspace
                  .refreshAvailable &&
                  !projection.studyFirstEventInvestigationWorkspace
                    .sourceVersionCurrent}
                refreshBusy={modelTasksBusy.has("screen4_refresh")}
                onRefresh={refreshStudyFirstEvents}
                interpretationBusy={modelTasksBusy.has(
                  "screen4_interpretation")}
                analysisRecoveryBlocked={projection.optionalAnalysisRecovery
                  .blockedScreens.includes(4)}
                onAnalyze={analyzeStudyFirstEvents}
                hostEntries={currentStudyFirstHostEntries}
                hostNotices={studyFirstHostNotices}
              />
              <div className="six-actions six-screen-forward">
                <button
                  type="button"
                  className="six-primary"
                  disabled={busy || !hostView.connected ||
                    !projection.screen5Prerequisites.ready}
                  onClick={() => void continueToScreen5()}
                >
                  Continue to mechanism review
                </button>
              </div>
              <div className="six-actions six-screen-navigation">
                <button
                  type="button"
                  className="six-secondary"
                  onClick={() => void navigateToScreen(3)}
                >
                  Back to comparison guidance
                </button>
              </div>
            </>
          ) : visibleCoEventSearchWorkspace &&
              projection?.screen4Prerequisites.ready &&
              projection.screen4Prerequisites.legacyExecutionAvailable &&
              projection.screen4Prerequisites.mode &&
              projection.screen4Prerequisites.modeLabel ? (
            <>
              <CoEventSearchPanel
                workspace={visibleCoEventSearchWorkspace}
                mode={projection.screen4Prerequisites.mode}
                modeLabel={projection.screen4Prerequisites.modeLabel}
                disabled={busy || !hostView.connected ||
                  projection.activeScreen !== 4}
                canContinue={projection.canContinueCoEventSearch}
                onSave={saveCoEventMatrix}
                onContinue={continueCoEventSearch}
                onReviewOccurrence={reviewCoEventOccurrenceRecord}
                onReviewDuplicate={reviewCoEventDuplicateRecords}
                onReviewRelation={reviewCoEventRelationRecord}
                onRoutePolicyStage={routeCoEventPolicyStage}
              />
              <div className="six-actions six-screen-forward">
                <button
                  type="button"
                  className="six-primary"
                  disabled={busy || !hostView.connected ||
                    !projection?.screen5Prerequisites.ready}
                  onClick={() => void continueToScreen5()}
                >
                  Continue to mechanism literature plan
                </button>
              </div>
              <div className="six-actions six-screen-navigation">
                <button
                  type="button"
                  className="six-secondary"
                  onClick={() => void navigateToScreen(3)}
                >
                  Back to causal comparison
                </button>
              </div>
            </>
          ) : (
            <section className="six-card">
              <p className="six-kicker">Screen 4 handoff unavailable</p>
              <h2>Reconnect the current comparison decision</h2>
              <p>
                Screen 4 needs the current confirmed policy, study scope and
                window, plus a researcher selection or explicit no-selection
                decision from Screen 3. A locked Event Card is required only
                by preserved legacy execution records, not by the study-first route.
              </p>
              {projection?.screen4Prerequisites.blockers.length ? (
                <ul>
                  {projection.screen4Prerequisites.blockers.map((blocker) => (
                    <li key={blocker.code}>{blocker.message}</li>
                  ))}
                </ul>
              ) : null}
              <button
                type="button"
                className="six-secondary"
                onClick={() => void navigateToScreen(3)}
              >
                Return to Screen 3
              </button>
            </section>
          )}
        </main>
      ) : viewScreen === 3 ? (
        <main className="six-main">
          {visibleCausalComparisonWorkspace?.studyFirst.advice ? (
            <>
              <StudyDesignAdvicePanel
                workspace={visibleCausalComparisonWorkspace.studyFirst}
                policyReview={projection?.policyReview}
                policyTitle={projection?.confirmedShock?.officialTitle}
                contextualizationBusy={modelTasksBusy.has("screen3")}
                analysisRecoveryBlocked={Boolean(projection?.optionalAnalysisRecovery
                  ?.blockedScreens.includes(3))}
                pendingSelectionId={pendingStudyDesignSelection}
                disabled={busy || !hostView.connected ||
                  !projection?.screen3Prerequisites.ready}
                modelUnavailableReason={modelTaskUnavailableReason()}
                modelAuthorizationDetails={modelTaskAuthorizationDetails(
                  "screen3_design_critique")}
                onContextualize={() => void personalizeScreen3Advice()}
                onDecide={(input) => void decideStudyAdvice(input)}
                onEdit={() => {
                  setShowScreen3StudyDetails(true);
                  setViewScreen(2);
                }}
              />
              <section className="six-screen-gate" aria-label="Screen 4 readiness">
                  <p className="six-kicker">Screen 3 → Screen 4</p>

                  {projection?.screen4Prerequisites.blockers.length ? (
                    <ul>
                      {projection.screen4Prerequisites.blockers.map((blocker) => (
                        <li key={blocker.code}>{blocker.message}</li>
                      ))}
                    </ul>
                  ) : null}
                  <button
                    type="button"
                    className="six-primary"
                    disabled={busy || !hostView.connected ||
                      !projection?.screen4Prerequisites.ready}
                    onClick={() => void continueToScreen4()}
                  >
                    Continue to other-event review
                  </button>
                </section>
              <div className="six-actions six-screen-navigation">
                <button
                  type="button"
                  className="six-secondary"
                  onClick={() => void navigateToScreen(2)}
                >
                  Back to policy and study details
                </button>
              </div>
            </>
          ) : visibleCurrentEventCard && visibleCausalComparisonWorkspace &&
              (projection?.study ?? privateSnapshot?.state.study) ? (
            <>
              <CausalComparisonPanel
                workspace={visibleCausalComparisonWorkspace}
                eventCard={visibleCurrentEventCard}
                policyReview={visiblePolicyReview}
                study={(projection?.study ?? privateSnapshot!.state.study)}
                disabled={busy || !hostView.connected ||
                  projection?.activeScreen !== 3}
                onBuild={buildComparison}
                onDecide={decideComparison}
              />
              {visibleCausalComparisonWorkspace.decision ? (
                <section className="six-screen-gate" aria-label="Screen 4 readiness">
                  <p className="six-kicker">Screen 3 → Screen 4</p>

                  {projection?.screen4Prerequisites.blockers.length ? (
                    <ul>
                      {projection.screen4Prerequisites.blockers.map((blocker) => (
                        <li key={blocker.code}>{blocker.message}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>
                      Screen 4 will bind the current study window, reviewed
                      Event Card, and researcher decision into an immutable
                      search scope. It will not claim that a search ran.
                    </p>
                  )}
                  <button
                    type="button"
                    className="six-primary"
                    disabled={busy || !hostView.connected ||
                      !projection?.screen4Prerequisites.ready}
                    onClick={() => void continueToScreen4()}
                  >
                    Continue to other-event search scope
                  </button>
                </section>
              ) : null}
              <div className="six-actions six-screen-navigation">
                <button
                  type="button"
                  className="six-secondary"
                  onClick={() => void navigateToScreen(2)}
                >
                  Back to policy and study details
                </button>
              </div>
            </>
          ) : (
            <section className="six-card">
              <p className="six-kicker">Screen 3 handoff unavailable</p>
              <h2>Complete the study-first handoff</h2>
              <p>
                The saved workflow is preserved. Screen 3 needs a confirmed policy,
                the required study fields, and an explicit proposed timing choice;
                policy-claim approval is not required.
              </p>
              <button
                type="button"
                className="six-secondary"
                onClick={() => void navigateToScreen(2)}
              >
                Return to Screen 2
              </button>
            </section>
          )}
        </main>
      ) : viewScreen === 2 ? (
        <main className="six-main">
          <section className="six-card six-phase-card">
            <div className="six-card-heading six-screen2-heading">
              <div>
                <p className="six-kicker">Confirmed policy episode</p>
                <h2>Understand the policy change</h2>
                <p>What changed, who is covered, and which dates matter?</p>
              </div>
              <span className="six-review-status">
                {visiblePolicyReview
                  ? visiblePolicyReview.status.replaceAll("_", " ")
                  : "research starting"}
              </span>
            </div>
            {!visiblePolicyReview ? (
              <>
                <PolicyResearchStatus
                  automation={policyAutomation}
                  detail={policyAutomation.message ||
                    (policyAutomation.status === "paused"
                      ? "Your saved progress is preserved."
                      : "The standard source search is starting.")}
                  review={visiblePolicyReview}
                  busy={busy}
                  connected={hostView.connected}
                  onRetry={runStandardPolicyResearch}
                />
                <button
                  type="button"
                  className="six-secondary"
                  disabled={busy}
                  onClick={() => setViewScreen(1)}
                >
                  Review Screen 1
                </button>
              </>
            ) : visiblePolicyReview.status === "ready" ||
                visiblePolicyReview.status === "partial" ? (
              <>
                <PolicyResearchStatus
                  automation={policyAutomation}
                  detail={policyAutomation.message ||
                    (policyAutomation.status === "paused"
                      ? "Your saved progress is preserved."
                      : visiblePolicyReview.plan.nextStepId
                        ? "Results shown below are provisional until the standard search finishes."
                        : "The standard source search is complete.")}
                  review={visiblePolicyReview}
                  busy={busy}
                  connected={hostView.connected}
                  onRetry={runStandardPolicyResearch}
                />
                {visiblePolicyReview.briefing ? (
                  <section className="six-policy-briefing" aria-label="Source-linked policy briefing">
                    <div className="six-policy-overview">
                      <p className="six-kicker">Source-linked policy briefing</p>
                      <h3>Policy episode overview</h3>
                      {cleanPolicyOverviewText(
                        visiblePolicyReview.briefing.overview,
                      ) ? <p>{cleanPolicyOverviewText(
                          visiblePolicyReview.briefing.overview,
                        )}</p> : null}
                      <PolicyClaimSources
                        claims={visiblePolicyReview.claims}
                        claimIds={visiblePolicyReview.briefing.overviewClaimIds}
                      />
                      <PolicySynthesisStatus review={visiblePolicyReview} />
                    </div>
                    <PolicyTimeline
                      review={visiblePolicyReview}
                      identity={privateSnapshot?.state.confirmedShock}
                      identityCandidate={confirmedIdentityCandidate}
                    />
                    <div className="six-policy-briefing-grid">
                      {uniquePolicyBriefingSections([
                        visiblePolicyReview.briefing.whatChanged,
                        visiblePolicyReview.briefing.coverage,
                        visiblePolicyReview.briefing.enforcement,
                      ]).filter((section) => section.findings.length).map((section) => (
                        <PolicyBriefingSectionView
                          key={section.title}
                          review={visiblePolicyReview}
                          section={section}
                        />
                      ))}
                    </div>
                    {visiblePolicyReview.briefing.unresolvedQuestions.length ? (
                      <section className="six-policy-questions" aria-label="Policy facts that still need verification">
                        <h3>What still needs verification</h3>
                        <p>
                          These questions remain open in the sources reviewed so
                          far and may affect treatment assignment or timing.
                        </p>
                        <ul>
                          {visiblePolicyReview.briefing.unresolvedQuestions.map(
                            (question) => <li key={question}>
                              {cleanPolicyPresentationText(question)}
                            </li>,
                          )}
                        </ul>
                      </section>
                    ) : null}
                  </section>
                ) : (
                  <div className="six-alert six-alert--warning">
                    This saved v0.5.2 review predates the content-first briefing model.
                    Continue research to create a new source-bound projection without
                    overwriting its retained evidence.
                  </div>
                )}
                <details className="six-policy-evidence-details">
                  <summary>Sources, exact passages, and research activity</summary>
                  <div className="six-policy-summary">
                  <div><strong>{visiblePolicyReview.sourceCount}</strong><span>source</span></div>
                  <div><strong>{visiblePolicyReview.passageCount}</strong><span>exact passages</span></div>
                  <div><strong>{visiblePolicyReview.claimCount}</strong><span>source-linked claims</span></div>
                  <div>
                    <strong>
                      {policyPlanProgress(visiblePolicyReview).finished}/
                      {visiblePolicyReview.progress.totalSteps}
                    </strong>
                    <span>plan routes resolved</span>
                  </div>
                  <div>
                    <strong>{visiblePolicyReview.progress.chargedDocumentAttempts}</strong>
                    <span>document attempts charged</span>
                  </div>
                  </div>
                {visiblePolicyReview.briefingQuality ? (
                  <section className="six-policy-requirements" aria-label="Screen 2 information-box quality">
                    <h3>Information-box quality checks</h3>
                    <ul>
                      {visiblePolicyReview.briefingQuality.boxes.map((box) => (
                        <li key={box.box} data-status={box.status}>
                          <strong>{box.box.replaceAll("_", " ")}</strong>
                          <span>{box.status}</span>
                          <p>{box.note}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
                {visiblePolicyReview.claims.some(({ predicate }) =>
                    predicate === "legal_effect_date") &&
                    visiblePolicyReview.claims.some(({ predicate }) =>
                      predicate === "implementation_schedule") ? (
                  <div className="six-alert six-alert--warning">
                    <strong>Timing is not one date.</strong> Legal effect and the later
                    implementation schedule are retained as separate claims; neither is
                    automatically treated as the study intervention date.
                  </div>
                ) : null}
                {visiblePolicyReview.claims.some(({ predicate }) =>
                    predicate === "previous_baseline") &&
                    visiblePolicyReview.claims.some(({ predicate }) =>
                      predicate === "historical_version_change") ? (
                  <div className="six-alert six-alert--warning">
                    <strong>Historical version retained.</strong> The compact record
                    keeps the pre-effective boundary and effective-date addition as
                    separate, date-specific eCFR citations. It does not substitute
                    today&apos;s CFR text.
                  </div>
                ) : null}
                {visiblePolicyReview.claims.some(({ predicate }) =>
                    predicate === "contemporaneous_amendment_record") ? (
                  <div className="six-alert six-alert--warning">
                    <strong>Historical fallback retained.</strong> The exact
                    contemporaneous Federal Register amendatory instruction is saved,
                    but it does not establish either adjacent-date CFR version or an
                    official CFR legal edition. No current CFR text was substituted.
                  </div>
                ) : null}
                <div className="six-policy-claims" aria-label="Retained policy claims">
                  {visiblePolicyReview.claims.map((claim) => (
                    <article key={claim.claimId}>
                      <p className="six-kicker">{claim.predicate.replaceAll("_", " ")}</p>
                      <p>{cleanPolicyPresentationText(claim.statement)}</p>
                      <details>
                        <summary>Inspect exact passage and source</summary>
                        <blockquote>{cleanPolicyPresentationText(
                          claim.citation.exactText,
                        )}</blockquote>
                        {claim.qualification ? (
                          <p className="six-policy-qualification">
                            <strong>Qualification:</strong> {claim.qualification}
                          </p>
                        ) : null}
                        <a href={claim.citation.canonicalUrl} target="_blank" rel="noreferrer">
                          {claim.citation.sourceTitle} · {claim.citation.locator}
                        </a>
                        <dl className="six-policy-citation-provenance">
                          <div>
                            <dt>Source type</dt>
                            <dd>{claim.citation.documentType ?? claim.citation.sourceRole}</dd>
                          </div>
                          <div>
                            <dt>Authorship</dt>
                            <dd>{claim.citation.author ?? "Not established on the inspected page"}</dd>
                          </div>
                          <div>
                            <dt>Publication date</dt>
                            <dd>{claim.citation.publicationDate ?? "Not established on the inspected page"}</dd>
                          </div>
                          <div>
                            <dt>Version scope</dt>
                            <dd>{claim.citation.versionLabel ?? "Not separately labeled"}</dd>
                          </div>
                        </dl>
                      </details>
                    </article>
                  ))}
                </div>
                <section className="six-policy-plan" aria-label="Saved policy evidence plan">
                  <div className="six-card-heading">
                    <div>
                      <p className="six-kicker">Saved evidence plan</p>
                      <h3>What has been searched and what remains</h3>
                    </div>
                    <span>Automatic standard plan</span>
                  </div>
                  <ol>
                    {visiblePolicyReview.plan.steps.map((step) => (
                      <li key={step.id} data-status={step.status}>
                        <div>
                          <strong>{step.label}</strong>
                          <span>{step.status.replaceAll("_", " ")}</span>
                        </div>
                        <p>{step.objective}</p>
                        {step.note ? <small>{step.note}</small> : null}
                      </li>
                    ))}
                  </ol>
                  <p className="six-policy-pause">
                    The workspace advances this one saved task through its bounded
                    standard plan. Reading status never spends budget; interrupted work
                    pauses with an explicit resume control.
                  </p>
                </section>
                <section className="six-policy-requirements" aria-label="Policy evidence requirements">
                  <h3>Evidence gaps</h3>
                  <ul>
                    {visiblePolicyReview.requirements.map((requirement) => (
                      <li key={requirement.kind}>
                        <strong>{requirement.kind.replaceAll("_", " ")}</strong>
                        <span>{requirement.status.replaceAll("_", " ")}</span>
                        <p>{requirement.description}</p>
                      </li>
                    ))}
                  </ul>
                </section>
                </details>
                {visibleCoEventSearchWorkspace ? (
                  <PolicyLifecycleHandoffPanel
                    workspace={visibleCoEventSearchWorkspace}
                    stageWorkspace={visiblePolicyLifecycleStageWorkspace}
                    disabled={busy || !hostView.connected}
                    onAcquire={acquirePolicyLifecycleStageDocument}
                    onDisposition={
                      reviewPolicyLifecycleStageDocumentRecord
                    }
                    onProposeRevision={
                      proposePolicyLifecycleStageRevisionRecord
                    }
                    onReviewRevision={
                      reviewPolicyLifecycleStageRevisionRecord
                    }
                  />
                ) : null}
                {restoredEventCardReview ? (
                  <details className="six-legacy-review-record">
                    <summary>Historical Event Card decisions (preserved)</summary>
                    <p>
                      This older record remains inspectable, but it is not a Screen 3
                      prerequisite and no decision is replayed or relabeled.
                    </p>
                    <ul>
                      {restoredEventCardReview.claimReviews
                        .filter(({ decision }) => decision !== "unreviewed")
                        .map((claim) => (
                          <li key={claim.claimId}>
                            <strong>{claim.decision.replaceAll("_", " ")}:</strong>{" "}
                            {claim.effectiveStatement}
                          </li>
                        ))}
                    </ul>
                  </details>
                ) : null}
              </>
            ) : (
              <>
                <div className="six-alert six-alert--warning">
                  <strong>Official text was not retained.</strong>{" "}
                  {visiblePolicyReview.limitation}
                </div>
                <p>
                  Missing facts remain unresolved; ShockAudit has not substituted a
                  different document or invented an operative date.
                </p>
                <div className="six-actions">
                  {visiblePolicyReview.plan.nextStepId ? (
                    <button
                      type="button"
                      className="six-primary"
                      disabled={busy || !hostView.connected}
                      onClick={() => void runStandardPolicyResearch()}
                    >
                      Resume standard research
                    </button>
                  ) : null}
                  <button type="button" className="six-secondary" onClick={() => setViewScreen(1)}>
                    Review Screen 1
                  </button>
                </div>
              </>
            )}
            <StudyHandoffPanel
              form={form}
              timing={timingForm}
              issues={screen3EntryValidation.issues}
              showErrors={screen3ValidationAttempted}
              submissionError={screen3SubmissionError}
              handoffTask={screen3HandoffTask}
              ready={screen3Ready}
              disabled={busy}
              connected={hostView.connected}
              canCancel={Boolean(privateSnapshotRef.current)}
              onChange={updateForm}
              onTimingChange={(value) => {
                draftEditVersion.current += 1;
                clearTerminalScreen3HandoffForEditedInput();
                setTimingForm(value);
                if (value.mode !== "year") setRdRuleDraft(null);
                setScreen3SubmissionError("");
                setError("");
                setNotice("");
              }}
              rdRule={rdRuleDraft}
              onRdRuleChange={(value) => {
                draftEditVersion.current += 1;
                clearTerminalScreen3HandoffForEditedInput();
                setRdRuleDraft(value);
                setScreen3SubmissionError("");
              }}
              onBack={() => setViewScreen(1)}
              onCancel={() => {
                const saved = privateSnapshotRef.current;
                if (!saved) return;
                draftEditVersion.current += 1;
                setForm(formFromSnapshot(saved));
                setTimingForm(timingFormFromSnapshot(saved));
                setRdRuleDraft(screen3RdRuleDraftFromSnapshot(saved));
                setScreen3ValidationAttempted(false);
                setScreen3SubmissionError("");
                setError("");
                setNotice("Unsaved study and timing edits were discarded.");
              }}
              onContinue={() => void continueToScreen3()}
              onCheckSavedStatus={() => void checkScreen3HandoffStatus({
                navigateIfUnchanged: {
                  draftVersion: draftEditVersion.current,
                  viewVersion: viewEditVersion.current,
                },
              })}
              onRestoreComparisonGuidance={() =>
                void restoreScreen3ComparisonGuidance()}
            />
          </section>
        </main>
      ) : (
        <main className="six-main">
          <form className="six-card six-form" onSubmit={resolveIdentity}>
            <div className="six-card-heading">
              <div>
                <p className="six-kicker">Study and policy input</p>
                <h2>Find and confirm your policy</h2>
              </div>
            </div>

            <div className="six-grid six-grid--primary">
              <Field
                label="Policy or shock name"
                name="shockInput"
                value={form.shockInput}
                onChange={updateForm}
                required
                hint="Enter a name, abbreviation, or short description."
              />
            </div>

            <div className="six-actions six-find-policy-action">
              <button type="submit" className="six-primary" disabled={busy || !hostView.connected}>
                {busy ? "Searching…" : "Find my policy"}
              </button>
            </div>
            <div className="six-identity-search-status" role="status"
              aria-live="polite" data-state={identitySearchState}>
              {identitySearchState === "searching"
                ? "Searching the reviewed cache and live official sources…"
                : identitySearchState === "success"
                  ? `Done — ${projection?.candidates.length ?? 0} possible ${projection?.candidates.length === 1 ? "match is" : "matches are"} ready below.`
                  : identitySearchState === "empty"
                    ? "Search complete — no source-supported match was found."
                    : identitySearchState === "error"
                      ? "The search could not finish. Review the message below and try again."
                      : ""}
            </div>

            <button className="six-disclosure" type="button"
              aria-expanded={showWebsiteFallback}
              onClick={() => setShowWebsiteFallback((value) => !value)}>
              <span>Cannot find the right policy?</span>
              <span>{showWebsiteFallback ? "Hide" : "Show"}</span>
            </button>
            {showWebsiteFallback ? (
              <div className="six-website-fallback">
                <Field label="Webpage URL" name="officialSource"
                  value={form.officialSource} onChange={updateForm}
                  disabled={busy}
                  hint="If name search misses, add one public page about the policy. ShockAudit uses its title, headings, URL, and metadata as search cues, then continues through official sources even if the page cannot be reached. Confirmation remains your decision." />
                <button type="submit" className="six-secondary"
                  disabled={busy || !form.officialSource.trim() || !hostView.connected}>
                  Check this webpage
                </button>
              </div>
            ) : null}
            <section className="six-screen1-study-editor" aria-label="Study details">
              <h3>Study details</h3>
              <p>Please insert your study information below.</p>
              <StudyFields form={form} disabled={busy} required={false} onChange={updateForm} />
            </section>

          </form>

          {projection?.candidates.length ? (
            <section className="six-card six-identity">
              <div className="six-card-heading">
                <div>
                  <p className="six-kicker">Identity review</p>
                  <h2 ref={identityResultsRef} tabIndex={-1}>
                    Closest source-supported matches
                  </h2>
                </div>
                <span>{projection.candidates.length} plausible {projection.candidates.length === 1 ? "match" : "alternatives"}; no unrelated results are added.</span>
              </div>

              <div className="six-original-request">
                <h3>Your original request</h3>
                <blockquote>{projection.originalShockInput}</blockquote>
                {projection.currentShockInput !== projection.originalShockInput ? (
                  <p><strong>Current clarification:</strong> {projection.currentShockInput}</p>
                ) : null}
              </div>

              <fieldset className="six-candidate-picker">
                <legend>Select the exact policy or stage to confirm</legend>
                <div className="six-candidate-list">
                {projection.candidates.map((candidate, candidateIndex) => (
                  <article
                    className="six-candidate-card"
                    data-selected={candidate.selected}
                    key={candidate.id}
                  >
                    <div className="six-candidate-heading">
                      <div>
                        <p className="six-kicker">Match {candidateIndex + 1}</p>
                        <h3>{candidate.officialTitle}</h3>
                        {candidate.aliases.length ? (
                          <p><strong>Also known as:</strong> {candidate.aliases.join(", ")}</p>
                        ) : null}
                      </div>
                      <span className="six-ready-status">Available for policy review</span>
                    </div>
                    <label className="six-candidate-choice">
                      <input
                        type="radio"
                        name="six-screen-identity-candidate"
                        value={candidate.id}
                        checked={candidate.selected}
                        disabled={busy || projection.status === "shock_confirmed"}
                        onChange={() =>
                          void candidateAction("display_identity", candidate.id)}
                      />
                      <span>
                        Select {candidate.officialTitle}
                        <small>
                          Selection only. Confirmation and Screen 2 begin separately.
                        </small>
                      </span>
                    </label>
                    <dl className="six-candidate-facts">
                      <div><dt>Jurisdiction</dt><dd>{candidate.issuingJurisdiction}</dd></div>
                      <div><dt>Responsible authority</dt><dd>{candidate.issuer}</dd></div>
                      <div><dt>Instrument</dt><dd>{candidate.instrumentType}</dd></div>
                      <div>
                        <dt>Identifier</dt>
                        <dd>
                          {candidate.formalIdentifiers.length ? (
                            <ul className="six-identifier-list">
                              {candidate.formalIdentifiers.map((identifier) => (
                                <li key={identifier}>{identifier}</li>
                              ))}
                            </ul>
                          ) : "Not established"}
                        </dd>
                      </div>
                      <div><dt>Policy stage</dt><dd>{candidate.episode}</dd></div>
                      <div><dt>Version or scope</dt><dd>{candidate.versionScope}</dd></div>
                      {candidate.typedDates.slice(0, 2).map((date, index) => (
                        <div key={`${date.kind}-${index}`}>
                          <dt>{date.kind.replaceAll("_", " ")}</dt>
                          <dd>{date.start ?? "Unknown"}{date.end ? `–${date.end}` : ""}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="six-description">{candidate.displayedDescription}</p>
                    <p className="six-match-reason"><strong>Why this appears relevant:</strong> {candidate.matchExplanation}</p>
                    {candidate.materialMismatches.length ? (
                      <div className="six-alert six-alert--warning">
                        <strong>Material difference to resolve</strong>
                        <ul>{candidate.materialMismatches.map((item) => <li key={item}>{item}</li>)}</ul>
                      </div>
                    ) : null}
                    <p className="six-source-note">
                      {candidate.identitySources.length} official source representation{candidate.identitySources.length === 1 ? " is" : "s are"} retained for identity review; {candidate.identitySources.filter((source) => source.retainedText?.trim()).length} inspected text representation{candidate.identitySources.filter((source) => source.retainedText?.trim()).length === 1 ? "" : "s"} supports the bounded Screen 2 continuation. Confirmation does not establish sample exposure, the empirical treatment date, or causal validity.
                    </p>
                    <ul className="six-source-list" aria-label={`Identity sources for ${candidate.officialTitle}`}>
                      {candidate.identitySources.map((source) => (
                        <li key={source.id}>
                          <a href={source.locator} target="_blank" rel="noreferrer">
                            {source.title}
                          </a>
                          <span>{source.publisher}</span>
                        </li>
                      ))}
                    </ul>
                    <details className="six-technical-details">
                      <summary>Source and route details</summary>
                      <dl>
                        {candidate.identitySources.map((source) => (
                          <div key={source.id}>
                            <dt>{source.title}</dt>
                            <dd>
                              {source.provider ?? source.publisher} · {source.routeId ?? "retained source"} · {source.authorityTier.replaceAll("_", " ")}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  </article>
                ))}
                </div>
              </fieldset>

              <div className="six-decision-actions">
                <button
                  type="button"
                  className="six-primary"
                  disabled={busy || projection.status === "shock_confirmed" || !selectedIdentityCandidate}
                  onClick={() => selectedIdentityCandidate &&
                    void candidateAction("confirm_shock", selectedIdentityCandidate.id)}
                >
                  Confirm this policy and continue
                </button>
              </div>

            </section>
          ) : null}

          {projection?.identityResolution && !projection.candidates.length ? (
            <section className="six-card">
              <p className="six-kicker">
                {projection.identityResolution.status.replaceAll("_", " ")}
              </p>
              <h2>Identity not yet resolved</h2>
              <p>{projection.identityResolution.limitation}</p>
              {projection.identityResolution.unresolved.length ? (
                <p><strong>Still needed:</strong> {projection.identityResolution.unresolved.join(", ")}</p>
              ) : null}
              {!projection.identityResolution.limitation?.includes(
                "No policy from a different jurisdiction was substituted.",
              ) ? (
                <p>No policy from a different jurisdiction was substituted.</p>
              ) : null}
              <p>Your study inputs and exact original request remain saved.</p>
            </section>
          ) : null}

          {visibleConfirmedShock ? (
            <section className="six-card six-confirmed" aria-live="polite">
              <div>
                <p className="six-kicker">Shock confirmed</p>
                <h2>{visibleConfirmedShock.officialTitle}</h2>
                <p>{visibleConfirmedShock.episode} · {visibleConfirmedShock.issuingJurisdiction}</p>
              </div>
              <button type="button" className="six-primary" disabled={busy} onClick={() => void continueToScreen2()}>
                Continue to Screen 2
              </button>
            </section>
          ) : null}
        </main>
      )}
      </div>
      </div>
    </div>
  );
}
