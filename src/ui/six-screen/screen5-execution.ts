import { fingerprintSixScreenValue } from
  "../../core/six-screen/canonical";
import { SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID } from
  "../../core/six-screen/workflow-response-contract";
import { SHOCKAUDIT_UI_BUILD_LABEL } from "../../version";
import type { StudyFirstMechanismRun } from
  "../../core/six-screen/study-first-mechanism-comparison";
import type { HistoricalScreen5Provider, HistoricalScreen5Model } from
  "../../core/six-screen/screen5-historical-record";
import type { Screen5MechanismValidationIssue } from
  "../../core/six-screen/screen5-mechanism";
import type { HostReasoningPublicTaskState } from
  "../host-task/host-task-client";
import type { Screen5ExecutionReadiness } from
  "../../worker/six-screen-workflow-runtime";
import {
  SCREEN04_STUDY_EVENT_ASSESSMENT_TASK,
  SCREEN05_STUDY_MECHANISM_COMPARISON_TASK,
  SCREEN05_THEORETICAL_PLANNING_TASK,
  screen04StudyEventAssessmentResultSchema,
  screen05StudyMechanismComparisonResultSchema,
  screen05TheoreticalPlanningResultSchema,
  type StudyFirstHostTaskType,
} from "../../worker/study-first-host-intelligence";

export const STUDY_FIRST_HOST_TERMINAL_STATUSES = [
  "applied",
  "message-rejected",
  "validation-failed",
  "expired",
  "superseded",
  "retry-exhausted",
  "cancelled",
] as const;

const terminalStatuses = new Set<string>(
  STUDY_FIRST_HOST_TERMINAL_STATUSES,
);

export function studyFirstHostTaskIsTerminal(
  task: HostReasoningPublicTaskState,
) {
  return terminalStatuses.has(task.status);
}

export function studyFirstHostResult(
  taskType: typeof SCREEN04_STUDY_EVENT_ASSESSMENT_TASK,
  value: unknown,
): ReturnType<typeof screen04StudyEventAssessmentResultSchema.parse> | null;
export function studyFirstHostResult(
  taskType: typeof SCREEN05_THEORETICAL_PLANNING_TASK,
  value: unknown,
): ReturnType<typeof screen05TheoreticalPlanningResultSchema.parse> | null;
export function studyFirstHostResult(
  taskType: typeof SCREEN05_STUDY_MECHANISM_COMPARISON_TASK,
  value: unknown,
): ReturnType<typeof screen05StudyMechanismComparisonResultSchema.parse> | null;
export function studyFirstHostResult(
  taskType: StudyFirstHostTaskType,
  value: unknown,
): ReturnType<typeof screen04StudyEventAssessmentResultSchema.parse> |
  ReturnType<typeof screen05TheoreticalPlanningResultSchema.parse> |
  ReturnType<typeof screen05StudyMechanismComparisonResultSchema.parse> |
  null;
export function studyFirstHostResult(
  taskType: StudyFirstHostTaskType,
  value: unknown,
): ReturnType<typeof screen04StudyEventAssessmentResultSchema.parse> |
  ReturnType<typeof screen05TheoreticalPlanningResultSchema.parse> |
  ReturnType<typeof screen05StudyMechanismComparisonResultSchema.parse> |
  null {
  const parsed = taskType === SCREEN04_STUDY_EVENT_ASSESSMENT_TASK
    ? screen04StudyEventAssessmentResultSchema.safeParse(value)
    : taskType === SCREEN05_THEORETICAL_PLANNING_TASK
      ? screen05TheoreticalPlanningResultSchema.safeParse(value)
      : taskType === SCREEN05_STUDY_MECHANISM_COMPARISON_TASK
        ? screen05StudyMechanismComparisonResultSchema.safeParse(value)
        : null;
  if (!parsed) return null;
  return parsed.success ? parsed.data : null;
}

export function screen5EvidenceOperationId(input: {
  runId: string;
  planningTaskId: string;
  planningResultId: string;
}) {
  const fingerprint = fingerprintSixScreenValue(input).slice("fnv1a64:".length);
  return `screen5-evidence:${fingerprint}`;
}

export type Screen5ExecutionDiagnostic = {
  schemaVersion: "shockaudit-screen5-execution-diagnostic-v4";
  uiBuild: string;
  workflowResponseBuild: string;
  hostMode: "unknown" | "disabled" | "app-only" | "screen02-only" | "full";
  runStatus: StudyFirstMechanismRun["status"];
  planningStatus:
    | NonNullable<StudyFirstMechanismRun["planning"]>["status"]
    | "unavailable";
  planningTaskStatus: HostReasoningPublicTaskState["status"] | "not_prepared";
  planningResultPresent: boolean;
  comparisonTaskStatus:
    | HostReasoningPublicTaskState["status"]
    | "not_prepared";
  comparisonResultPresent: boolean;
  evidenceWorkCount: number;
  abstractCount: number;
  completedProviderQueries: number;
  totalProviderQueries: number;
  provider: "openai" | HistoricalScreen5Provider | null;
  modelRequested: "gpt-6-luna" | HistoricalScreen5Model | null;
  reasoningEffort: "medium" | null;
  providerInferenceAttempts: number;
  providerObservedTokens: number;
  providerReasoningTokens: number | null;
  providerCachedInputTokens: number | null;
  providerHeldTokens: number;
  directExecutionId: string | null;
  directPhase: NonNullable<StudyFirstMechanismRun["providerExecution"]>["phase"] |
    null;
  plannedCandidateCount: number;
  assessmentBatchCount: number;
  completedAssessmentBatchCount: number;
  selectedEvidenceIds: string[];
  budgetOmittedEvidenceIds: string[];
  latestReceipt: null | {
    status: "received" | "schema_valid" | "quarantined" | "aggregate_saved";
    contentFingerprint: string;
    stage: "planning" | "assessment";
    wireVersion: string;
    checkpoint: "none" | "planning" | "assessment";
    validationIssues: Screen5MechanismValidationIssue[];
    wireFingerprint: string | null;
  };
  savedComparison: null | {
    id: string;
    comparisonFingerprint: string;
    completionStatus: "partial" | "completed";
  };
  directReadiness: null | Pick<Screen5ExecutionReadiness,
    | "selectedBackend"
    | "route"
    | "configuration"
    | "missingSettings"
    | "keyPresent"
    | "credentialStatus"
    | "ledgerState"
    | "authorization"
    | "activeOrigin"
    | "migration"
    | "canDispatch"
    | "nextAction"
  >;
  nextAction:
    | "wait_for_planning"
    | "resume_planning"
    | "continue_evidence"
    | "wait_for_comparison"
    | "resume_comparison"
    | "review_result"
    | Screen5ExecutionReadiness["nextAction"];
};

export function screen5ExecutionDiagnostic(input: {
  hostMode: Screen5ExecutionDiagnostic["hostMode"];
  run: StudyFirstMechanismRun;
  readiness?: Screen5ExecutionReadiness;
  planningTask?: HostReasoningPublicTaskState;
  comparisonTask?: HostReasoningPublicTaskState;
}): Screen5ExecutionDiagnostic {
  const { run, planningTask, comparisonTask } = input;
  const abstractCount = run.works.filter(({ access }) =>
    access.level === "abstract_inspected" && access.abstractText
  ).length;
  let nextAction: Screen5ExecutionDiagnostic["nextAction"];
  if (input.readiness?.route !== undefined) {
    nextAction = input.readiness.nextAction;
  } else if (comparisonTask?.status === "applied") nextAction = "review_result";
  else if (run.hostComparison.status === "available_via_signed_host_task") {
    nextAction = comparisonTask && !studyFirstHostTaskIsTerminal(comparisonTask)
      ? "wait_for_comparison"
      : "resume_comparison";
  } else if (planningTask?.status === "applied") {
    nextAction = "continue_evidence";
  } else if (planningTask && !studyFirstHostTaskIsTerminal(planningTask)) {
    nextAction = "wait_for_planning";
  } else {
    nextAction = "resume_planning";
  }
  const providerAttempts = run.providerExecution?.attempts ?? [];
  const latestReceiptAttempt = [...providerAttempts].reverse().find(
    ({ responseReceipt }) => responseReceipt,
  ) ?? null;
  const latestReceipt = latestReceiptAttempt?.responseReceipt ?? null;
  const savedComparison = run.providerExecution?.comparison ?? null;
  return {
    schemaVersion: "shockaudit-screen5-execution-diagnostic-v4",
    uiBuild: SHOCKAUDIT_UI_BUILD_LABEL,
    workflowResponseBuild: SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID,
    hostMode: input.hostMode,
    runStatus: run.status,
    planningStatus: run.planning?.status ?? "unavailable",
    planningTaskStatus: planningTask?.status ?? "not_prepared",
    planningResultPresent: planningTask?.result !== null &&
      planningTask?.result !== undefined,
    comparisonTaskStatus: comparisonTask?.status ?? "not_prepared",
    comparisonResultPresent: comparisonTask?.result !== null &&
      comparisonTask?.result !== undefined,
    evidenceWorkCount: run.works.length,
    abstractCount,
    completedProviderQueries: run.attempts.filter(({ status }) =>
      status === "completed"
    ).length,
    totalProviderQueries: run.attempts.length,
    provider: run.providerExecution?.provider ?? null,
    modelRequested: run.providerExecution?.modelRequested ?? null,
    reasoningEffort: run.providerExecution?.settings?.reasoningEffort ?? null,
    providerInferenceAttempts: providerAttempts.length,
    providerObservedTokens: providerAttempts.reduce(
      (total, attempt) => total + (attempt.usage?.totalTokens ?? 0),
      0,
    ),
    providerReasoningTokens: providerAttempts.every((attempt) =>
        !attempt.usage || attempt.usage.reasoningTokens !== null)
      ? providerAttempts.reduce(
          (total, attempt) => total + (attempt.usage?.reasoningTokens ?? 0),
          0,
        )
      : null,
    providerCachedInputTokens: providerAttempts.every((attempt) =>
        !attempt.usage || attempt.usage.cachedPromptTokens !== null)
      ? providerAttempts.reduce(
          (total, attempt) => total + (attempt.usage?.cachedPromptTokens ?? 0),
          0,
        )
      : null,
    providerHeldTokens: providerAttempts.reduce(
      (total, attempt) => total + (
        !attempt.usage && ["reserved", "running", "outcome_unknown"].includes(
            attempt.status,
          )
          ? attempt.reservedTokens
          : 0
      ),
      0,
    ),
    directExecutionId: run.providerExecution?.id ?? null,
    directPhase: run.providerExecution?.phase ?? null,
    plannedCandidateCount: run.planning?.plan?.candidates.length ?? 0,
    assessmentBatchCount:
      run.providerExecution?.assessmentBatchPlan?.batches.length ?? 0,
    completedAssessmentBatchCount: providerAttempts.filter((attempt) =>
      attempt.stage === "assessment" && attempt.status === "succeeded" &&
      attempt.wireCheckpoint?.kind === "assessment"
    ).length,
    selectedEvidenceIds: [...new Set(providerAttempts.flatMap((attempt) =>
      attempt.stage === "assessment" ? attempt.evidenceIds ?? [] : []
    ))],
    budgetOmittedEvidenceIds: [...new Set(providerAttempts.flatMap((attempt) =>
      attempt.stage === "assessment" ? attempt.omittedEvidenceIds ?? [] : []
    ))],
    latestReceipt: latestReceipt
      ? {
          status: latestReceipt.status,
          contentFingerprint: latestReceipt.contentFingerprint,
          stage: latestReceiptAttempt!.stage,
          wireVersion: latestReceiptAttempt!.stage === "planning"
            ? run.providerExecution!.planWireVersion
            : run.providerExecution!.comparisonWireVersion,
          checkpoint: latestReceiptAttempt!.wireCheckpoint?.kind ?? "none",
          validationIssues: structuredClone(latestReceipt.validationIssues),
          wireFingerprint: latestReceipt.wireFingerprint,
        }
      : null,
    savedComparison: savedComparison
      ? {
          id: savedComparison.id,
          comparisonFingerprint: savedComparison.comparisonFingerprint,
          completionStatus: savedComparison.completion?.status ?? "completed",
        }
      : null,
    directReadiness: input.readiness
      ? {
          selectedBackend: input.readiness.selectedBackend,
          route: input.readiness.route,
          configuration: input.readiness.configuration,
          missingSettings: [...input.readiness.missingSettings],
          keyPresent: input.readiness.keyPresent,
          credentialStatus: input.readiness.credentialStatus,
          ledgerState: input.readiness.ledgerState,
          authorization: input.readiness.authorization,
          activeOrigin: input.readiness.activeOrigin,
          migration: input.readiness.migration,
          canDispatch: input.readiness.canDispatch,
          nextAction: input.readiness.nextAction,
        }
      : null,
    nextAction,
  };
}
