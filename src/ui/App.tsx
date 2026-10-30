import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SetStateAction,
} from "react";
import { flushSync } from "react-dom";

import {
  confirmScopeContract,
  createInitialState,
  scopeContextMarkdown,
  type ConfirmScopeResult,
} from "../core/screen01-service";
import {
  STAGE1_PROOF_TIMEOUT_MS,
  isStage1ProofOpenResult,
  type Stage1AssessmentResult,
} from "../core/stage1-assessment-proof";
import {
  beginScreen02InteractionRequest,
  clearScreen02InteractionRequest,
  createScreen02Session,
  lockScreen02Choice,
  rejectScreen02Item,
  restartScreen02Session,
  restoreScreen02Session,
  sameDeterministicJson,
  selectScreen02Item,
  unlockScreen02Choice,
} from "../core/screen02-service";
import { buildScreen02ToScreen03Handoff } from "../core/screen02-screen03-handoff";
import { buildScreen01StudyContext } from "../core/study-context";
import { requireReadyScreen01Context } from "../core/study-context";
import {
  restoreScreen02WorkflowClientSnapshot,
  stateFromScreen02WorkflowClientSnapshot,
  type Screen02WorkflowClientSnapshot,
} from "../core/screen02-workflow-client";
import {
  fingerprintHostReasoningValue,
  type HostReasoningTaskType,
} from "../core/host-reasoning-task";
import type { HostReasoningRunAuditBundle } from
  "../core/host-reasoning-audit";
import {
  createScreen03LoadingState,
  fingerprintScreen03VerificationState,
  restoreScreen03VerificationState,
  screen03FactualClaims,
  type Screen03VerificationState,
} from "../core/screen03-workflow";
import {
  screen04EntryGate,
  screen04EventCardBindingIsCurrent,
  type Screen04EventCardBinding,
} from "../core/screen04-event-card-binding";
import {
  createScreen04WorkflowState,
  markScreen04WorkflowStale,
  reconcileScreen04EventCardBinding,
  restoreScreen04WorkflowState,
  type Screen04WorkflowState,
} from "../core/screen04-workflow";
import type { Screen03ClientAction } from "../core/screen03-workflow-client";
import {
  SCREEN_02_HOST_ASSESSMENT_DEADLINE_MS,
  type Screen02WorkflowState,
} from "../core/screen02-workflow-types";
import type {
  Ambiguity,
  Screen01State,
  Screen01StudyContext,
} from "../core/scope-types";
import type { Screen02Session } from "../core/screen02-types";
import {
  acceptStage1AssessmentResult,
  arbitrateScreen02DiscoveryResult,
  assertScreen02ModelContextFits,
  canAdoptInitialScreen01ToolState,
  claimScreen02AiReviewRequest,
  releaseExpiredScreen02AiReviewClaim,
  screen02AiReviewClaimBlocksMutation,
  screen01StateMatchesBaseline,
  screen02SessionReconcilesPendingRequest,
  screen02SessionMatchesBaseline,
  screen02AiReviewRequestKey,
  screen02PendingAiReviewMarkerIsExpired,
  screen02PendingAiReviewMarkerMatchesSession,
  screen03HistoricalHostBriefingCompatibilityEnabled,
  SCREEN_02_AI_REVIEW_DELAYED_NOTICE_MS,
  SCREEN_02_AI_REVIEW_PENDING_TTL_MS,
  ShockAuditBridge,
  shouldAcceptToolState,
  type HostView,
  type Screen02WorkflowActionName,
  type Screen02WorkflowWidgetSnapshot,
  type Screen02PendingAiReviewMarker,
  type Screen02WorkflowOperationAttribution,
  type Stage1ProofWidgetSnapshot,
} from "./mcp-bridge";
import Screen01, {
  screen02OpenFailureMessage,
} from "./screen-01/Screen01";
import {
  screen02HasCompletedAiReview,
  type Screen02Notice,
  type Screen02PreferenceDraft,
} from "./screen-02/Screen02";
import type {
  Screen02FindProps,
  Screen02FindSearchState,
} from "./screen-02-find/Screen02Find";
import {
  screen02FindCoverageSummary,
  screen02FindTerminalNotice,
} from
  "./screen-02-find/find-view-model";
import Screen02AuditLoadBoundary from
  "./screen-02-audit/screen02-audit-load-boundary";
import Screen02WorkflowShell from "./screen-02/Screen02WorkflowShell";
import type { HostTaskStatus } from "./host-task/HostTaskStatusPanel";
import Screen02HostReviewDetails from
  "./host-task/Screen02HostReviewDetails";
import {
  hostReasoningTaskIsTerminal,
  hostReasoningModeAllowsTask,
  privateCoordinatesFromPrepared,
  screen02HostReviewSummary,
  updatePrivateHostTaskCoordinates,
  type HostReasoningPrivateTaskCoordinates,
  type HostReasoningPublicTaskState,
  type HostReasoningTaskPrepareCoordinates,
} from "./host-task/host-task-client";
import {
  createHostTaskReconciler,
  type HostTaskReconciler,
} from "./host-task/host-task-reconciler";
import {
  screen02HostReviewApplicationIsCurrent,
  screen03HostEvidenceMappingApplicationIsCurrent,
} from "./host-task/host-task-panel-reconciliation";
import {
  claimScreen02HostResultAcknowledgement,
  finalizeScreen02HostResultAfterPaint,
  releaseScreen02HostResultAcknowledgement,
  screen02HostResultMarkerElementMatches,
  screen02HostResultRenderMarkerMatches,
  SCREEN02_HOST_RESULT_RENDER_MARKER_SCHEMA_VERSION,
  type Screen02HostResultMarkerElement,
  type Screen02HostResultRenderMarker,
} from "./host-task/screen02-host-post-render";
import {
  screen03HostOverviewResultIsCurrent,
} from "./host-task/Screen03HostOverview";
import type {
  Screen03BulkReviewMode,
  Screen03HostBriefingDecision,
  Screen03HostBriefingReview,
  Screen03HostReasoningStatus,
  Screen03ReviewDecision,
} from "./screen-03/Screen03";
import Screen03LoadBoundary from "./screen-03/screen03-load-boundary";
import {
  SCREEN_03_HOST_DRAFT_DEFAULT_CAPABILITY_TTL_MS,
  type Screen03HostDraftClientBatch,
  type Screen03HostDraftReceiptNotice,
} from "../core/screen03-host-draft-client";
import {
  SCREEN_03_WIDGET_SCHEMA_VERSION,
  screen03WidgetMatchesScreen02,
  type Screen03HostBriefingBootstrap,
  type Screen03WorkflowWidgetSnapshot,
} from "./screen-03/screen03-widget-state";
import Stage1AssessmentProof from "./stage1-proof/Stage1AssessmentProof";
import Screen04LoadBoundary from "./screen-04/screen04-load-boundary";
import {
  SCREEN_04_WIDGET_SCHEMA_VERSION,
  type Screen04WorkflowWidgetSnapshot,
} from "./screen-04/screen04-widget-state";

const Screen02Find = lazy(() => import("./screen-02-find/Screen02Find"));
const Screen02Audit = lazy(() => import("./screen-02-audit/Screen02Audit"));
const Screen03 = lazy(() => import("./screen-03/Screen03"));
const Screen04 = lazy(() => import("./screen-04/Screen04"));

async function restoreDeferredHostReasoningRunAuditBundle(value: unknown) {
  const { restoreHostReasoningRunAuditBundle } = await import(
    "../core/host-reasoning-audit"
  );
  return restoreHostReasoningRunAuditBundle(value);
}

type HostReasoningAuditCacheEntry = {
  bundle: HostReasoningRunAuditBundle;
  screen04BindingFingerprint: string;
};

const screen02WorkflowRefreshRetryMs = 2_500;
export const SCREEN_02_FIND_MAX_RETRIEVAL_TOOL_CALLS = 16;
export const SCREEN_03_HOST_DRAFT_POLL_INTERVAL_MS = 2_500;
export const SCREEN_03_HOST_DRAFT_RECONCILE_TIMEOUT_MS = 5_000;
export const SCREEN_03_HOST_NATIVE_RENDER_WINDOW_MS = 120_000;
const screen02DelayedAssessmentMessage =
  "The preliminary assessment is taking longer than expected and may still complete in this conversation. Source-backed factual cards remain usable. Reset Screen 2 if you need to cancel this attempt.";

type Screen02WorkflowMutationOptions = {
  openedMatchSnapshotId?: string | null;
  requestAssessment?: boolean;
  silent?: boolean;
  restoration?: boolean;
};

type PendingScreen02ForegroundMutation = {
  runId: string;
  lifecycleGeneration: number;
  operationId: string;
  action: Screen02WorkflowActionName;
  payload: Record<string, unknown>;
  options?: Screen02WorkflowMutationOptions;
  settle: (result: Screen02WorkflowMutationCompletion) => void;
};

export type Screen02WorkflowMutationCompletion =
  | {
      outcome: "committed";
      operationId: string;
      snapshot: Screen02WorkflowClientSnapshot;
    }
  | {
      outcome: "failed";
      operationId: string;
      error: Error;
    };

export type Screen02WorkflowMutationResult =
  | Screen02WorkflowMutationCompletion
  | {
      outcome: "queued";
      operationId: string;
      completion: Promise<Screen02WorkflowMutationCompletion>;
    };

type Screen03HostDraftAttempt = {
  lifecycleGeneration: number;
  parentStateFingerprint: string;
  baseline: Screen03HostDraftFreshnessBaseline;
  requestId: string | null;
};

export type Screen03HostDraftFreshnessBaseline = {
  runId: string;
  handoffFingerprint: string;
  revision: number;
  stateFingerprint: string;
  hostIntegrationEventIds: string[];
};

export function screen03HostDraftStateIsFresh(
  state: Screen03VerificationState,
  baseline: Screen03HostDraftFreshnessBaseline,
) {
  return state.runId === baseline.runId &&
    state.upstream.handoffFingerprint === baseline.handoffFingerprint &&
    state.interpretation?.origin === "chatgpt-host" &&
    state.revision > baseline.revision &&
    state.integrity.stateFingerprint !== baseline.stateFingerprint &&
    state.history.some(
      (event) =>
        event.action === "host-interpretation-integrated" &&
        !baseline.hostIntegrationEventIds.includes(event.id),
    );
}

export type Screen03HostDraftWatchdog = {
  startPolling: () => void;
  reconcileNow: () => Promise<boolean>;
  stop: () => void;
};

/**
 * Reconcile a model-only Screen 3 write even when its host receipt is missed.
 * The absolute deadline starts when this controller is created. The app uses
 * one controller to bound task preparation, then starts a fresh controller
 * when the signed capability is issued so its deadline matches that authority.
 * Its deadline callback always performs one final fresh read.
 */
export function createScreen03HostDraftWatchdog(input: {
  reconcile: () => Promise<boolean>;
  onUnavailable: () => void;
  timeoutMs?: number;
  pollIntervalMs?: number;
  reconcileTimeoutMs?: number;
}): Screen03HostDraftWatchdog {
  const timeoutMs = input.timeoutMs ??
    SCREEN_03_HOST_DRAFT_DEFAULT_CAPABILITY_TTL_MS;
  const pollIntervalMs = input.pollIntervalMs ??
    SCREEN_03_HOST_DRAFT_POLL_INTERVAL_MS;
  const reconcileTimeoutMs = input.reconcileTimeoutMs ??
    SCREEN_03_HOST_DRAFT_RECONCILE_TIMEOUT_MS;
  let active = true;
  let polling = false;
  let pollTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
  let deadlineTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
  let inFlight: Promise<boolean> | null = null;

  const clearPoll = () => {
    if (pollTimer !== null) globalThis.clearTimeout(pollTimer);
    pollTimer = null;
  };
  const stop = () => {
    if (!active) return;
    active = false;
    polling = false;
    clearPoll();
    if (deadlineTimer !== null) globalThis.clearTimeout(deadlineTimer);
    deadlineTimer = null;
  };
  const reconcileOnce = () => {
    if (!active) return Promise.resolve(false);
    if (inFlight) return inFlight;
    let timeout: ReturnType<typeof globalThis.setTimeout> | null = null;
    const operation = input.reconcile().catch(() => false);
    const bounded = Promise.race([
      operation,
      new Promise<false>((resolve) => {
        timeout = globalThis.setTimeout(() => resolve(false), reconcileTimeoutMs);
      }),
    ]).finally(() => {
      if (timeout !== null) globalThis.clearTimeout(timeout);
      if (inFlight === bounded) inFlight = null;
    });
    inFlight = bounded;
    return inFlight;
  };
  const schedulePoll = () => {
    if (!active || !polling || pollTimer !== null) return;
    pollTimer = globalThis.setTimeout(async () => {
      pollTimer = null;
      const reconciled = await reconcileOnce();
      if (!active) return;
      if (reconciled) {
        stop();
        return;
      }
      schedulePoll();
    }, pollIntervalMs);
  };
  const reconcileNow = async () => {
    const reconciled = await reconcileOnce();
    if (active && reconciled) stop();
    return reconciled;
  };

  deadlineTimer = globalThis.setTimeout(async () => {
    if (!active) return;
    polling = false;
    clearPoll();
    if (inFlight) await inFlight;
    if (!active) return;
    // Do not reuse a poll that began before the deadline. This is the final
    // canonical read required before the UI declares the host draft unavailable.
    const reconciled = await reconcileOnce();
    if (!active) return;
    if (reconciled) {
      stop();
      return;
    }
    stop();
    input.onUnavailable();
  }, timeoutMs);

  return {
    startPolling: () => {
      if (!active) return;
      polling = true;
      schedulePoll();
    },
    reconcileNow,
    stop,
  };
}

function screen02AssessmentPreparedAtMs(
  request: Screen02WorkflowState["assessmentRequests"][number],
) {
  const preparedAt = request.lifecycle.find(
    (event) => event.status === "prepared",
  )?.at;
  const parsed = preparedAt ? Date.parse(preparedAt) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : Date.parse(request.updatedAt);
}

function screen02AssessmentDeadlineAtMs(
  state: Screen02WorkflowState,
  requestIds: readonly string[],
) {
  const requestIdSet = new Set(requestIds);
  const preparedTimes = state.assessmentRequests
    .filter((request) => requestIdSet.has(request.requestId))
    .map(screen02AssessmentPreparedAtMs)
    .filter(Number.isFinite);
  return (
    (preparedTimes.length > 0 ? Math.min(...preparedTimes) : Date.now()) +
    SCREEN_02_HOST_ASSESSMENT_DEADLINE_MS
  );
}

function screen02CandidateAvailabilityMessage(visibleCandidateCount: number) {
  const count = Number.isSafeInteger(visibleCandidateCount) &&
      visibleCandidateCount > 0
    ? visibleCandidateCount
    : 0;
  if (count === 0) {
    return "No source-backed candidate results are currently available.";
  }
  if (count === 1) {
    return "One source-backed candidate result remains available.";
  }
  return `${count} source-backed candidate results remain available.`;
}

export function screen02HostTaskMessage(
  phase: HostTaskStatus["phase"],
  visibleCandidateCount: number,
) {
  const availability = screen02CandidateAvailabilityMessage(
    visibleCandidateCount,
  );
  if (phase === "idle") return "Optional wider search is ready.";
  if (phase === "starting") {
    return "Preparing one bounded review of the current candidate pool…";
  }
  if (phase === "waiting") {
    return `The wider search is reviewing industry relevance. ${availability}`;
  }
  if (phase === "applying") {
    return "Additional suggestions received. Checking the suggested source leads…";
  }
  if (phase === "completed") {
    return "Additional source suggestions received and validated. Source-backed qualification remains in control.";
  }
  if (phase === "timed-out") {
    return `The wider search did not return a structured review in the wait window. ${availability}`;
  }
  return `The wider search did not return a valid structured review. ${availability}`;
}

function screen02HostTaskStatus(
  state: Screen02WorkflowState,
): HostTaskStatus | null {
  const request = state.assessmentRequests.at(-1);
  if (!request || request.status === "prepared") return null;
  const failed = [
    "delivery-rejected",
    "service-unavailable",
    "no-tool-submission",
    "validation-failed",
    "retry-exhausted",
  ].includes(request.status);
  const phase: HostTaskStatus["phase"] = request.status === "completed"
    ? "completed"
    : request.status === "timed-out"
      ? "timed-out"
      : failed
        ? "failed"
        : "waiting";
  return {
    taskId: request.requestId,
    phase,
    title: "Wider search",
    message: request.status === "completed"
      ? "The structured review was applied here."
      : failed || request.status === "timed-out"
        ? screen02HostTaskMessage(
            phase,
            visibleFindCandidateCount(state),
          )
        : "The wider search is in progress; results appear here.",
    retryCount: request.attempt > 1 ? 1 : 0,
  };
}

function visibleFindCandidateCount(state: Screen02WorkflowState | null) {
  if (!state || state.mode !== "find" || !state.activeCandidateSetSnapshotId) {
    return 0;
  }
  return state.candidateSets.find(
    (candidateSet) =>
      candidateSet.candidateSetSnapshotId ===
        state.activeCandidateSetSnapshotId,
  )?.candidateSnapshotIds.length ?? 0;
}

function idleFindSearchState(
  state: Screen02WorkflowState | null,
): Screen02FindSearchState {
  return {
    operationId: null,
    phase: "idle",
    message: "Candidate search is ready.",
    startedRevision: null,
    settledRevision: null,
    visibleCandidateCount: visibleFindCandidateCount(state),
    errorCode: null,
    recovery: "none",
  };
}

function completedFindSearchPhase(
  state: Extract<Screen02WorkflowState, { mode: "find" }>,
): Screen02FindSearchState["phase"] {
  if (screen02FindCoverageSummary(state).incomplete) return "incomplete";
  return visibleFindCandidateCount(state) === 0
    ? "completed-empty"
    : "completed";
}

function screen02FindDiscoveryIsSearching(
  state: Screen02WorkflowState | null,
) {
  return state?.mode === "find" &&
    state.discoveryRequests.at(-1)?.status === "searching";
}

function initialFindSearchState(
  state: Screen02WorkflowState | null,
): Screen02FindSearchState {
  if (!screen02FindDiscoveryIsSearching(state)) {
    return idleFindSearchState(state);
  }
  return {
    operationId: null,
    phase: "searching",
    message: "Resuming the bounded source search…",
    startedRevision: state?.revision ?? null,
    settledRevision: null,
    visibleCandidateCount: visibleFindCandidateCount(state),
    errorCode: null,
    recovery: "preserved-results",
  };
}

function findSearchErrorCode(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("SA-S2-TOOL-CALL-TIMEOUT")) return "tool-call-timeout";
  if (message.includes("SA-S2-RESULT-METADATA-TIMEOUT")) {
    return "result-metadata-timeout";
  }
  if (message.includes("SA-S2-OPERATION-NOT-APPLIED")) {
    return "operation-not-applied";
  }
  if (/retired|stale|mismatch/iu.test(message)) return "stale-result";
  return "delivery-failure";
}

function screen02VisibleFailureMessage(
  error: unknown,
  fallback: string,
) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const diagnosticCode = message.match(/\[SA-S2-[A-Z0-9-]+\]/u)?.[0];
  return diagnosticCode ? `${fallback} ${diagnosticCode}` : fallback;
}

export function screen02MutationAttributionAllowsCommit(
  attribution: Screen02WorkflowOperationAttribution | null,
  operationId: string,
  action: Screen02WorkflowActionName,
) {
  if (
    !attribution || !attribution.attributable ||
    attribution.kind !== "mutation" ||
    attribution.operationId !== operationId ||
    attribution.binding !== "exact-operation-seal-or-correlation"
  ) return false;
  if (action === "refresh") {
    return attribution.outcome === "refreshed" ||
      attribution.outcome === "replayed" ||
      attribution.outcome === "conflict";
  }
  return attribution.outcome === "applied" ||
    attribution.outcome === "replayed" ||
    attribution.outcome === "conflict";
}

type HostReasoningTaskEntry = {
  coordinates: HostReasoningPrivateTaskCoordinates;
  task: HostReasoningPublicTaskState | null;
  ui: HostTaskStatus;
};

type Screen02PendingHostResultAcknowledgement = {
  marker: Screen02HostResultRenderMarker;
  coordinates: HostReasoningPrivateTaskCoordinates;
  workflow: Screen02WorkflowClientSnapshot;
  lifecycleGeneration: number;
  openedMatchSnapshotId: string | null;
};

type HostReasoningTaskEntries = Partial<Record<
  HostReasoningTaskType,
  HostReasoningTaskEntry
>>;

const hostReasoningTaskTitles: Record<HostReasoningTaskType, string> = {
  "screen02-search-review": "Optional wider search",
  "screen03-evidence-mapping": "Optional ChatGPT passage mapping",
  "screen03-overview-improvement": "Optional ChatGPT overview",
  "screen04-study-event-assessment": "Screen 4 study-event assessment",
  "screen05-theoretical-planning": "Screen 5 theoretical planning",
  "screen05-study-mechanism-comparison": "Screen 5 mechanism comparison",
  "six-screen-policy-fact-proof": "Six-screen factual transport proof",
  "six-screen-mechanism-proof": "Six-screen mechanism transport proof",
};
const screen03HostReasoningTaskTypes = [
  "screen03-evidence-mapping",
  "screen03-overview-improvement",
] as const satisfies readonly HostReasoningTaskType[];

function hostReasoningTaskMessage(
  taskType: HostReasoningTaskType,
  phase: HostTaskStatus["phase"],
) {
  if (taskType === "screen02-search-review") {
    // Entry construction does not always have the live candidate pool. Use
    // conservative zero-result wording until Screen 2 derives the current
    // count from canonical workflow state during render.
    return screen02HostTaskMessage(phase, 0);
  }
  if (taskType === "screen03-evidence-mapping") {
    if (phase === "starting") return "Preparing the current claims and bounded official passages…";
    if (phase === "waiting") return "ChatGPT is checking the supplied passages in this conversation. Official evidence already found remains available.";
    if (phase === "applying") return "Passage suggestions received. Checking exact quotes and reopening the current Event Card…";
    if (phase === "completed") return "Passage suggestions received and validated. Confirming each claim remains your decision.";
    if (phase === "timed-out") return "ChatGPT did not return a mapping in the wait window. The official evidence already found remains available.";
    return "ChatGPT did not return a valid mapping. The official evidence already found remains available.";
  }
  if (phase === "starting") return "Preparing directly supported facts for one optional overview…";
  if (phase === "waiting") return "ChatGPT is improving the explanation in this conversation. The fixed orientation remains visible.";
  if (phase === "applying") return "An overview was received. Checking it against the supported facts…";
  if (phase === "completed") return "The optional overview was validated. It remains noncanonical and does not replace Event Card facts.";
  if (phase === "timed-out") return "ChatGPT did not return an overview in the wait window. The fixed source-derived orientation remains available.";
  return "ChatGPT did not return a valid overview. The fixed source-derived orientation remains available.";
}

function hostReasoningTaskPhase(
  status: HostReasoningPrivateTaskCoordinates["status"],
  panelStatus?: HostReasoningPublicTaskState["panelReconciliation"]["status"],
): HostTaskStatus["phase"] {
  if (status === "prepared" || status === "message-requested") return "starting";
  if (status === "message-accepted" || status === "awaiting-submission") return "waiting";
  if (status === "submission-received" || status === "validating") return "applying";
  if (status === "applied") {
    return panelStatus === "reconciled" ? "completed" : "applying";
  }
  if (status === "expired") return "timed-out";
  return "failed";
}

function hostReasoningTaskEntry(
  coordinates: HostReasoningPrivateTaskCoordinates,
  task: HostReasoningPublicTaskState | null = null,
): HostReasoningTaskEntry {
  const status = task?.status ?? coordinates.status;
  const phase = hostReasoningTaskPhase(
    status,
    task?.panelReconciliation.status,
  );
  return {
    coordinates,
    task,
    ui: {
      taskId: coordinates.taskId,
      phase,
      title: hostReasoningTaskTitles[coordinates.taskType],
      message: hostReasoningTaskMessage(coordinates.taskType, phase),
      requestedAt: coordinates.createdAt,
      ...(task?.messageChannel
        ? { route: task.messageChannel }
        : {}),
      retryCount: task?.retryCount ?? coordinates.retryCount,
    },
  };
}

export function screen03HostBriefingDecision(
  state: Screen03VerificationState,
): Screen03HostBriefingDecision | null {
  const briefing = state.briefing;
  if (!briefing || briefing.proposals.length === 0) return null;
  if (
    briefing.confirmedIsCurrent &&
    briefing.confirmed &&
    briefing.activeProposalId === briefing.confirmed.proposalId
  ) {
    return briefing.decisions.find(
        (decision) => decision.decisionId === briefing.confirmed?.decisionId,
      )?.action === "revise"
      ? "revised"
      : "confirmed";
  }
  if (briefing.activeProposalId) return "proposed";
  const latestDecision = briefing.decisions.at(-1);
  return latestDecision?.action === "reject" ? "rejected" : null;
}

const defaultHostView: HostView = {
  connected: false,
  embedded: window.parent !== window,
  displayMode: window.parent === window ? "fullscreen" : "inline",
  canFullscreen: false,
  canSendMessage: false,
  canRequestAiReview: false,
  hostReasoningMode: "disabled",
};

type ConfirmToolOutput = {
  state: Screen01State;
  ambiguities: Ambiguity[];
  ok: boolean;
  error: string;
  studyContext: Screen01StudyContext;
};

function stateFromBaseline(
  context:
    | Screen02Session["screen01Baseline"]
    | Screen02WorkflowState["screen01Baseline"],
): Screen01State {
  return {
    revision: context.revision,
    mode: context.startingPoint,
    sentence: context.studySentence,
    contractSourceSentence: context.contractSourceSentence,
    scope: { ...context.scopeContract },
    knownShock: context.knownShock,
    resolvedKeys: [...context.resolvedKeys],
    acknowledgedDifferences: (context.acknowledgedDifferences ?? []).map(
      (acknowledgment) => ({ ...acknowledgment }),
    ),
    scopeDirty: context.scopeDirty,
    confirmed: context.confirmed,
  };
}

function sameContextWithProducer(
  rebuilt: Screen01StudyContext,
  preserved: Screen01StudyContext,
) {
  return sameDeterministicJson(
    {
      ...rebuilt,
      appVersion: preserved.appVersion,
    },
    preserved,
  );
}

let screen02RequestSequence = 0;
let screen02RunSequence = 0;
let screen02WorkflowOperationSequence = 0;
let screen04RunSequence = 0;

function nextScreen02RequestId() {
  screen02RequestSequence += 1;
  const randomId = globalThis.crypto?.randomUUID?.();
  return randomId
    ? `screen02-request-${randomId}`
    : `screen02-request-${Date.now()}-${screen02RequestSequence}`;
}

function nextScreen02RunId() {
  screen02RunSequence += 1;
  const randomId = globalThis.crypto?.randomUUID?.();
  return randomId
    ? `screen02-run-${randomId}`
    : `screen02-run-${Date.now()}-${screen02RunSequence}`;
}

function nextScreen02WorkflowOperationId() {
  screen02WorkflowOperationSequence += 1;
  const randomId = globalThis.crypto?.randomUUID?.();
  return randomId
    ? `screen02-ui-${randomId}`
    : `screen02-ui-${Date.now()}-${screen02WorkflowOperationSequence}`;
}

function nextScreen04RunId() {
  screen04RunSequence += 1;
  const randomId = globalThis.crypto?.randomUUID?.();
  return randomId
    ? `screen04-run-${randomId}`
    : `screen04-run-${Date.now()}-${screen04RunSequence}`;
}

export default function App() {
  const bridge = useMemo(() => new ShockAuditBridge(), []);
  const restoredStage1Proof = useMemo(
    () => bridge.getInitialStage1ProofSnapshot(),
    [bridge],
  );
  const restoredWorkflowWidget = useMemo(
    () => bridge.getInitialScreen02WorkflowWidgetSnapshot(),
    [bridge],
  );
  const restoredWorkflowState = useMemo(() => {
    if (!restoredWorkflowWidget) return null;
    try {
      return stateFromScreen02WorkflowClientSnapshot(
        restoredWorkflowWidget.workflow,
      );
    } catch {
      return null;
    }
  }, [restoredWorkflowWidget]);
  const restoredScreen02 = useMemo(
    () => bridge.getInitialScreen02Session(),
    [bridge],
  );
  const restoredSnapshot = useMemo(
    () => bridge.getInitialSnapshot(),
    [bridge],
  );
  const usableRestoredScreen02 = useMemo(() => {
    if (restoredWorkflowState) return null;
    if (!restoredScreen02) return null;
    if (!restoredSnapshot) return restoredScreen02;
    return restoredSnapshot.studyContext.confirmed &&
      screen02SessionMatchesBaseline(
        restoredScreen02,
        restoredSnapshot.studyContext,
      )
      ? restoredScreen02
      : null;
  }, [restoredScreen02, restoredSnapshot, restoredWorkflowState]);
  const usableRestoredWorkflow = useMemo(() => {
    if (!restoredWorkflowWidget || !restoredWorkflowState) return null;
    if (
      restoredSnapshot &&
      !restoredSnapshot.studyContext.confirmed
    ) {
      return null;
    }
    if (
      restoredSnapshot?.studyContext.confirmed &&
      !sameDeterministicJson(
        restoredSnapshot.studyContext,
        restoredWorkflowState.screen01Baseline,
      )
    ) {
      return null;
    }
    return restoredWorkflowWidget;
  }, [restoredSnapshot, restoredWorkflowState, restoredWorkflowWidget]);
  const restoredScreen03Widget = useMemo(
    () =>
      bridge.getInitialScreen03WorkflowWidgetSnapshot(
        usableRestoredWorkflow?.workflow ?? null,
      ),
    [bridge, usableRestoredWorkflow],
  );
  const restoredScreen04Widget = useMemo(
    () => bridge.getInitialScreen04WorkflowWidgetSnapshot(),
    [bridge],
  );
  const restoredScreen03HostBriefingBootstrap = useMemo(
    () => bridge.getInitialScreen03HostBriefingBootstrap(),
    [bridge, restoredScreen03Widget],
  );
  const storedPendingAiReviewMarker = useMemo(
    () => bridge.getInitialScreen02PendingAiReviewMarker(),
    [bridge],
  );
  const matchingRestoredPendingAiReviewMarker = useMemo(
    () =>
      storedPendingAiReviewMarker &&
      usableRestoredScreen02 &&
      screen02PendingAiReviewMarkerMatchesSession(
        storedPendingAiReviewMarker,
        usableRestoredScreen02,
      )
        ? storedPendingAiReviewMarker
        : null,
    [storedPendingAiReviewMarker, usableRestoredScreen02],
  );
  const restoredPendingAiReviewMarker = useMemo(
    () =>
      matchingRestoredPendingAiReviewMarker &&
      !screen02PendingAiReviewMarkerIsExpired(
        matchingRestoredPendingAiReviewMarker,
      )
        ? matchingRestoredPendingAiReviewMarker
        : null,
    [matchingRestoredPendingAiReviewMarker],
  );
  const restoredExpiredAiReviewMarker =
    matchingRestoredPendingAiReviewMarker &&
    !restoredPendingAiReviewMarker
      ? matchingRestoredPendingAiReviewMarker
      : null;
  const firstState = useMemo(
    () =>
      usableRestoredWorkflow?.activeScreen === 2 && restoredWorkflowState
        ? stateFromBaseline(restoredWorkflowState.screen01Baseline)
        : (restoredSnapshot?.state ??
          (usableRestoredWorkflow && restoredWorkflowState
            ? stateFromBaseline(restoredWorkflowState.screen01Baseline)
            : usableRestoredScreen02
              ? stateFromBaseline(usableRestoredScreen02.screen01Baseline)
              : createInitialState())),
    [
      restoredSnapshot,
      restoredWorkflowState,
      usableRestoredScreen02,
      usableRestoredWorkflow,
    ],
  );
  const [hostView, setHostView] = useState(defaultHostView);
  const hostViewRef = useRef(defaultHostView);
  const [stateRevision, setStateRevision] = useState(0);
  const [screen01State, setScreen01State] = useState<Screen01State>(
    firstState,
  );
  const screen01StateRef = useRef(firstState);
  const initialScreen01ToolStatePendingRef = useRef(
    !restoredSnapshot &&
      !usableRestoredScreen02 &&
      !usableRestoredWorkflow &&
      sameDeterministicJson(firstState, createInitialState()),
  );
  const [draftsByMode, setDraftsByMode] = useState(
    usableRestoredWorkflow?.activeScreen === 2
      ? {
          ...(restoredSnapshot?.draftsByMode ?? {}),
          [firstState.mode]: firstState,
        }
      : restoredSnapshot?.draftsByMode ?? { [firstState.mode]: firstState },
  );
  const initialConfirmedBaseline =
    restoredSnapshot?.studyContext.confirmed
      ? restoredSnapshot.studyContext
      : usableRestoredWorkflow && restoredWorkflowState
        ? (JSON.parse(
            JSON.stringify(restoredWorkflowState.screen01Baseline),
          ) as Screen01StudyContext)
      : usableRestoredScreen02
        ? (JSON.parse(
            JSON.stringify(usableRestoredScreen02.screen01Baseline),
          ) as Screen01StudyContext)
        : null;
  const confirmedBaselineRef = useRef<Screen01StudyContext | null>(
    initialConfirmedBaseline,
  );
  const [screen02Session, setScreen02Session] =
    useState<Screen02Session | null>(usableRestoredScreen02);
  const screen02SessionRef = useRef<Screen02Session | null>(
    usableRestoredScreen02,
  );
  const [screen02Workflow, setScreen02Workflow] =
    useState<Screen02WorkflowClientSnapshot | null>(
      usableRestoredWorkflow?.workflow ?? null,
    );
  const screen02WorkflowRef =
    useRef<Screen02WorkflowClientSnapshot | null>(
      usableRestoredWorkflow?.workflow ?? null,
    );
  const usableRestoredScreen03 =
    restoredScreen03Widget &&
    usableRestoredWorkflow &&
    screen03WidgetMatchesScreen02(
      restoredScreen03Widget,
      usableRestoredWorkflow.workflow,
    )
      ? restoredScreen03Widget
      : null;
  const restoredScreen04Gate = useMemo(
    () =>
      usableRestoredScreen03 && usableRestoredWorkflow?.workflow.handoff
        ? screen04EntryGate(
            usableRestoredScreen03.state,
            usableRestoredWorkflow.workflow.handoff,
          )
        : null,
    [usableRestoredScreen03, usableRestoredWorkflow],
  );
  const usableRestoredScreen04 = useMemo(() => {
    if (!restoredScreen04Widget || !restoredScreen04Gate?.ready) return null;
    if (
      screen04EventCardBindingIsCurrent(
        restoredScreen04Widget.state.eventCardBinding,
        restoredScreen04Gate.binding,
      )
    ) {
      return restoredScreen04Widget;
    }
    try {
      return {
        schemaVersion: SCREEN_04_WIDGET_SCHEMA_VERSION,
        activeScreen: restoredScreen04Widget.activeScreen,
        state: reconcileScreen04EventCardBinding(
          restoredScreen04Widget.state,
          restoredScreen04Gate.binding,
          new Date().toISOString(),
        ),
      } satisfies Screen04WorkflowWidgetSnapshot;
    } catch {
      return null;
    }
  }, [restoredScreen04Gate, restoredScreen04Widget]);
  const [screen03Workflow, setScreen03Workflow] =
    useState<Screen03VerificationState | null>(
      usableRestoredScreen03?.state ?? null,
    );
  const screen03WorkflowRef = useRef<Screen03VerificationState | null>(
    usableRestoredScreen03?.state ?? null,
  );
  const restoredHostReasoningTasks = useMemo(() => {
    const runId = usableRestoredWorkflow?.workflow.runId;
    if (!runId) return {} satisfies HostReasoningTaskEntries;
    const entries: HostReasoningTaskEntries = {};
    for (const coordinates of bridge.getInitialHostReasoningTasks(runId)) {
      entries[coordinates.taskType] = hostReasoningTaskEntry(coordinates);
    }
    return entries;
  }, [bridge, usableRestoredWorkflow?.workflow.runId]);
  const [hostReasoningTasks, setHostReasoningTasks] =
    useState<HostReasoningTaskEntries>(restoredHostReasoningTasks);
  const [hostReasoningTransientStatus, setHostReasoningTransientStatus] =
    useState<Partial<Record<HostReasoningTaskType, HostTaskStatus>>>({});
  const hostReasoningTasksRef =
    useRef<HostReasoningTaskEntries>(restoredHostReasoningTasks);
  const [screen02HostResultMarker, setScreen02HostResultMarker] =
    useState<Screen02HostResultRenderMarker | null>(null);
  const screen02HostResultMarkerRef =
    useRef<Screen02HostResultRenderMarker | null>(null);
  const pendingScreen02HostResultAcknowledgementRef =
    useRef<Screen02PendingHostResultAcknowledgement | null>(null);
  const paintedScreen02HostResultRef = useRef<{
    marker: Screen02HostResultRenderMarker;
    element: Screen02HostResultMarkerElement;
  } | null>(null);
  const screen02HostResultAcknowledgementInFlightRef =
    useRef<string | null>(null);
  const hostReasoningReconcilersRef = useRef(
    new Map<HostReasoningTaskType, HostTaskReconciler>(),
  );
  const hostReasoningChecksRef = useRef(
    new Map<HostReasoningTaskType, Promise<boolean>>(),
  );
  const hostReasoningStartsRef = useRef(
    new Map<HostReasoningTaskType, symbol>(),
  );
  const hostReasoningAuditRef = useRef<HostReasoningAuditCacheEntry | null>(
    null,
  );
  const hostReasoningAuditRequestsRef = useRef(new Set<string>());
  const [screen04Workflow, setScreen04Workflow] =
    useState<Screen04WorkflowState | null>(
      usableRestoredScreen04?.state ?? null,
    );
  const screen04WorkflowRef = useRef<Screen04WorkflowState | null>(
    usableRestoredScreen04?.state ?? null,
  );
  const [screen03Busy, setScreen03Busy] = useState(false);
  const screen03OperationActiveRef =
    useRef<false | "research" | "mutation">(false);
  const screen03LifecycleGenerationRef = useRef(0);
  const [screen03Error, setScreen03Error] = useState<string | null>(null);
  const [screen03HostReasoningStatus, setScreen03HostReasoningStatus] =
    useState<Screen03HostReasoningStatus>(
      usableRestoredScreen03?.state.briefing?.activeProposalId ||
          usableRestoredScreen03?.state.interpretation?.origin === "chatgpt-host"
        ? "complete"
        : "idle",
    );
  const screen03HostBriefingBootstrapRef =
    useRef<Screen03HostBriefingBootstrap | null>(
      restoredScreen03HostBriefingBootstrap,
    );
  const screen03HostDraftBatchRef =
    useRef<Screen03HostDraftClientBatch | null>(null);
  const pendingScreen03HostDraftReceiptRef =
    useRef<Screen03HostDraftReceiptNotice | null>(null);
  const screen03HostDraftDeliveryAcknowledgedRef = useRef(false);
  const screen03HostDraftAttemptRef =
    useRef<Screen03HostDraftAttempt | null>(null);
  const screen03HostDraftWatchdogRef =
    useRef<Screen03HostDraftWatchdog | null>(null);
  const screen03HostNativeMessageTimeoutRef = useRef<number | null>(null);
  const [openedAuditMatch, setOpenedAuditMatch] = useState<string | null>(
    usableRestoredWorkflow?.openedMatchSnapshotId ?? null,
  );
  const openedAuditMatchRef = useRef<string | null>(
    usableRestoredWorkflow?.openedMatchSnapshotId ?? null,
  );
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [workflowOpenStatus, setWorkflowOpenStatus] = useState<
    "idle" | "opening" | "failed"
  >("idle");
  const workflowMutationActiveRef = useRef(false);
  const workflowMutationKindRef = useRef<
    "background" | "foreground" | null
  >(null);
  const workflowMutationOwnerRef = useRef<symbol | null>(null);
  const pendingWorkflowForegroundMutationRef =
    useRef<PendingScreen02ForegroundMutation | null>(null);
  const workflowResetRequestedRunRef = useRef<string | null>(null);
  const workflowLifecycleGenerationRef = useRef(0);
  const pendingWorkflowRefreshRunRef = useRef<string | null>(null);
  const workflowRestorationRefreshRef = useRef<string | null>(null);
  const workflowTimeoutsRef = useRef(new Map<string, number>());
  const workflowPollTimeoutRef = useRef<number | null>(null);
  const findSearchDriverOwnerRef = useRef<{
    runId: string;
    owner: symbol;
  } | null>(null);
  const [workflowNotice, setWorkflowNotice] = useState<{
    status: "info" | "success" | "warning" | "error";
    message: string;
  } | null>(null);
  const [findSearchState, setFindSearchState] =
    useState<Screen02FindSearchState>(() =>
      initialFindSearchState(restoredWorkflowState)
    );
  const findSearchStateRef = useRef(findSearchState);
  const updateFindSearchState = (
    next: Screen02FindSearchState | ((current: Screen02FindSearchState) => Screen02FindSearchState),
  ) => {
    const resolved = typeof next === "function"
      ? next(findSearchStateRef.current)
      : next;
    findSearchStateRef.current = resolved;
    setFindSearchState(resolved);
  };

  function claimFindSearchDriver(runId: string) {
    if (findSearchDriverOwnerRef.current) return null;
    const owner = Symbol("screen02-find-search-driver");
    findSearchDriverOwnerRef.current = { runId, owner };
    return owner;
  }

  function findSearchDriverBelongsTo(runId: string, owner: symbol) {
    const current = findSearchDriverOwnerRef.current;
    return current?.runId === runId && current.owner === owner;
  }

  function releaseFindSearchDriver(runId: string, owner: symbol) {
    if (!findSearchDriverBelongsTo(runId, owner)) return false;
    findSearchDriverOwnerRef.current = null;
    return true;
  }

  function detachFindSearchDriver() {
    findSearchDriverOwnerRef.current = null;
  }

  function claimWorkflowMutation(
    kind: "background" | "foreground",
  ) {
    if (workflowMutationActiveRef.current) return null;
    const owner = Symbol(`screen02-${kind}-operation`);
    workflowMutationOwnerRef.current = owner;
    workflowMutationActiveRef.current = true;
    workflowMutationKindRef.current = kind;
    return owner;
  }

  function workflowMutationBelongsTo(owner: symbol) {
    return workflowMutationActiveRef.current &&
      workflowMutationOwnerRef.current === owner;
  }

  function releaseWorkflowMutation(owner: symbol) {
    if (!workflowMutationBelongsTo(owner)) return false;
    workflowMutationOwnerRef.current = null;
    workflowMutationActiveRef.current = false;
    workflowMutationKindRef.current = null;
    return true;
  }

  function detachWorkflowMutation() {
    workflowMutationOwnerRef.current = null;
    workflowMutationActiveRef.current = false;
    workflowMutationKindRef.current = null;
  }
  const [activeScreen, setActiveScreen] = useState<1 | 2 | 3 | 4>(
    usableRestoredWorkflow?.activeScreen === 2 &&
        usableRestoredScreen03?.activeScreen === 3 &&
        usableRestoredScreen04?.activeScreen === 4
      ? 4
      : usableRestoredWorkflow?.activeScreen === 2 &&
        usableRestoredScreen03?.activeScreen === 3
      ? 3
      : usableRestoredWorkflow
      ? usableRestoredWorkflow.activeScreen
      : usableRestoredScreen02
        ? 2
        : 1,
  );
  const activeScreenRef = useRef<1 | 2 | 3 | 4>(
    usableRestoredWorkflow?.activeScreen === 2 &&
        usableRestoredScreen03?.activeScreen === 3 &&
        usableRestoredScreen04?.activeScreen === 4
      ? 4
      : usableRestoredWorkflow?.activeScreen === 2 &&
        usableRestoredScreen03?.activeScreen === 3
      ? 3
      : usableRestoredWorkflow
      ? usableRestoredWorkflow.activeScreen
      : usableRestoredScreen02
        ? 2
        : 1,
  );
  const [researchNotice, setResearchNotice] =
    useState<Screen02Notice | null>(() =>
      restoredPendingAiReviewMarker
        ? {
            status: "pending",
            message:
              restoredPendingAiReviewMarker.purpose ===
              "coverage-expansion"
                ? "Targeted source expansion is still pending and may complete in this conversation. The retrieved facts remain visible; reset Screen 2 to cancel this attempt."
                : "The preliminary assessment is still pending and may complete in this conversation. Source-backed factual cards remain usable; reset Screen 2 to cancel this attempt.",
          }
        : restoredExpiredAiReviewMarker
          ? {
              status: "warning",
              message:
                "The previous preliminary assessment reached its delivery limit. That older request may still finish, but Retry is now available.",
            }
        : null,
    );
  const aiReviewPendingRoundKeysRef = useRef(
    new Set<string>(
      restoredPendingAiReviewMarker
        ? [restoredPendingAiReviewMarker.roundKey]
        : [],
    ),
  );
  const pendingAiReviewMarkerRef =
    useRef<Screen02PendingAiReviewMarker | null>(
      restoredPendingAiReviewMarker,
    );
  const aiReviewTimeoutsRef = useRef(new Set<number>());
  const [stage1ProofSnapshot, setStage1ProofSnapshot] =
    useState<Stage1ProofWidgetSnapshot | null>(restoredStage1Proof);
  const stage1ProofSnapshotRef =
    useRef<Stage1ProofWidgetSnapshot | null>(restoredStage1Proof);
  const stage1ProofTimeoutRef = useRef<number | null>(null);
  const stage1PendingResultRef = useRef<Stage1AssessmentResult | null>(
    null,
  );

  function workflowState(
    snapshot = screen02WorkflowRef.current,
  ): Screen02WorkflowState | null {
    if (!snapshot) return null;
    try {
      return stateFromScreen02WorkflowClientSnapshot(snapshot);
    } catch {
      return null;
    }
  }

  function cancelActiveFindSearch(
    recovery: Screen02FindSearchState["recovery"],
    errorCode = "workflow-changed",
  ) {
    if (findSearchStateRef.current.phase !== "searching") return;
    updateFindSearchState((currentSearch) => ({
      ...currentSearch,
      phase: "cancelled",
      message: "Search cancelled because this Screen 2 run changed.",
      settledRevision: null,
      errorCode,
      recovery,
    }));
  }

  function terminalizeFindDeliveryFailure(
    snapshot: Screen02WorkflowClientSnapshot,
    error: unknown,
    operationId: string,
  ) {
    const currentSearch = findSearchStateRef.current;
    if (
      currentSearch.phase === "searching" &&
      pendingWorkflowForegroundMutationRef.current?.operationId ===
        currentSearch.operationId
    ) {
      return;
    }
    const visibleState = workflowState(screen02WorkflowRef.current) ??
      workflowState(snapshot);
    if (!visibleState || visibleState.mode !== "find") return;
    const visibleCandidateCount = visibleFindCandidateCount(visibleState);
    updateFindSearchState({
      operationId: currentSearch.operationId ?? operationId,
      phase: "delivery-failure",
      message:
        "The search result could not be safely applied. Previous results remain available.",
      startedRevision: currentSearch.startedRevision ?? snapshot.revision,
      settledRevision: null,
      visibleCandidateCount,
      errorCode: findSearchErrorCode(error),
      recovery: visibleCandidateCount > 0 ? "preserved-results" : "retry",
    });
  }

  function saveWorkflowWidget(
    snapshot: Screen02WorkflowClientSnapshot,
    screen: 1 | 2,
    openedMatchSnapshotId = openedAuditMatchRef.current,
  ) {
    const widget: Screen02WorkflowWidgetSnapshot = {
      schemaVersion: "screen-02-workflow-widget-v1",
      workflow: snapshot,
      activeScreen: screen,
      openedMatchSnapshotId:
        snapshot.mode === "audit" ? openedMatchSnapshotId : null,
    };
    void bridge.saveScreen02WorkflowWidgetSnapshot(widget);
  }

  function saveScreen03Widget(
    state: Screen03VerificationState,
    screen: 2 | 3,
  ) {
    const widget: Screen03WorkflowWidgetSnapshot = {
      schemaVersion: SCREEN_03_WIDGET_SCHEMA_VERSION,
      state,
      activeScreen: screen,
    };
    void bridge.saveScreen03WorkflowWidgetSnapshot(widget);
  }

  function saveScreen04Widget(
    state: Screen04WorkflowState,
    screen: 3 | 4,
  ) {
    const hostReasoningTaskAudit = hostReasoningAuditRef.current;
    const widget: Screen04WorkflowWidgetSnapshot = {
      schemaVersion: SCREEN_04_WIDGET_SCHEMA_VERSION,
      state,
      activeScreen: screen,
      ...(hostReasoningTaskAudit?.bundle.runId ===
            state.eventCardBinding.screen02.runId &&
          hostReasoningTaskAudit.screen04BindingFingerprint ===
            state.eventCardBinding.bindingFingerprint
        ? {
            hostReasoningTaskAudit: hostReasoningTaskAudit.bundle,
            hostReasoningTaskAuditBindingFingerprint:
              hostReasoningTaskAudit.screen04BindingFingerprint,
          }
        : {}),
    };
    void bridge.saveScreen04WorkflowWidgetSnapshot(widget);
  }

  function carryHostReasoningAuditIntoScreen04(
    bundle: HostReasoningRunAuditBundle,
    binding: Screen04EventCardBinding,
  ) {
    const gate = currentScreen04Gate();
    if (
      bundle.runId !== screen02WorkflowRef.current?.runId ||
      !gate.ready ||
      !screen04EventCardBindingIsCurrent(gate.binding, binding)
    ) return;
    hostReasoningAuditRef.current = {
      bundle,
      screen04BindingFingerprint: binding.bindingFingerprint,
    };
    const screen04 = screen04WorkflowRef.current;
    if (
      screen04 &&
      screen04.eventCardBinding.screen02.runId === bundle.runId &&
      screen04.eventCardBinding.bindingFingerprint ===
        binding.bindingFingerprint
    ) {
      saveScreen04Widget(
        screen04,
        activeScreenRef.current === 4 ? 4 : 3,
      );
    }
  }

  useEffect(() => {
    if (!usableRestoredScreen04) return;
    const candidate = usableRestoredScreen04?.hostReasoningTaskAudit;
    const bindingFingerprint = usableRestoredScreen04
      ?.hostReasoningTaskAuditBindingFingerprint;
    if (candidate === undefined || bindingFingerprint === undefined) return;
    const binding = usableRestoredScreen04.state.eventCardBinding;
    if (bindingFingerprint !== binding.bindingFingerprint) return;
    let current = true;
    void restoreDeferredHostReasoningRunAuditBundle(candidate)
      .then((bundle) => {
        if (!current || !bundle) return;
        hostReasoningAuditRequestsRef.current.add(binding.bindingFingerprint);
        carryHostReasoningAuditIntoScreen04(bundle, binding);
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [
    usableRestoredScreen04?.hostReasoningTaskAudit,
    usableRestoredScreen04?.hostReasoningTaskAuditBindingFingerprint,
    usableRestoredScreen04?.state.eventCardBinding,
  ]);

  function currentScreen04Gate(
    screen03 = screen03WorkflowRef.current,
  ) {
    const handoff = screen02WorkflowRef.current?.handoff;
    return screen03 && handoff
      ? screen04EntryGate(screen03, handoff)
      : {
          ready: false as const,
          code: "SCREEN04_EVENT_CARD_NOT_LOCKED" as const,
          title: "Finish verifying the shock first" as const,
          message:
            "Resolve all visible factual claims and lock the Event Card before auditing exposure in your sample.",
        };
  }

  function commitScreen04State(
    value: Screen04WorkflowState,
    navigate = true,
  ) {
    const state = restoreScreen04WorkflowState(value);
    const gate = currentScreen04Gate();
    if (
      !state ||
      !gate.ready ||
      !screen04EventCardBindingIsCurrent(
        state.eventCardBinding,
        gate.binding,
      )
    ) {
      return false;
    }
    const current = screen04WorkflowRef.current;
    if (
      current &&
      state.runId === current.runId &&
      (state.revision < current.revision ||
        (state.revision === current.revision &&
          state.integrity.stateFingerprint !==
            current.integrity.stateFingerprint))
    ) {
      return false;
    }
    screen04WorkflowRef.current = state;
    setScreen04Workflow(state);
    if (navigate) {
      activeScreenRef.current = 4;
      setActiveScreen(4);
    }
    saveScreen04Widget(state, navigate ? 4 : 3);
    return true;
  }

  function markCurrentScreen04Stale(
    currentEventCardFingerprint: string | null,
    reason =
      "The verified shock changed. This exposure audit was calculated from an earlier Event Card version. Rerun the audit before relying on its classifications.",
  ) {
    const current = screen04WorkflowRef.current;
    if (!current) return null;
    const stale = markScreen04WorkflowStale(
      current,
      currentEventCardFingerprint,
      reason,
      new Date().toISOString(),
    );
    screen04WorkflowRef.current = stale;
    setScreen04Workflow(stale);
    saveScreen04Widget(stale, activeScreenRef.current === 4 ? 4 : 3);
    return stale;
  }

  function openScreen04Workflow(
    screen03 = screen03WorkflowRef.current,
    forceFresh = false,
  ) {
    const gate = currentScreen04Gate(screen03);
    if (!gate.ready) {
      setScreen03Error(gate.message);
      return false;
    }
    void requestHostReasoningAuditForScreen04(gate.binding);
    const existing = screen04WorkflowRef.current;
    if (
      existing &&
      !screen04EventCardBindingIsCurrent(
        existing.eventCardBinding,
        gate.binding,
      )
    ) {
      if (forceFresh) {
        return commitScreen04State(
          createScreen04WorkflowState(
            gate.binding,
            nextScreen04RunId(),
            new Date().toISOString(),
          ),
          true,
        );
      }
      const stale = markCurrentScreen04Stale(
        gate.binding.eventCard.fingerprint,
      );
      activeScreenRef.current = 4;
      setActiveScreen(4);
      if (stale) saveScreen04Widget(stale, 4);
      return true;
    }
    const at = new Date().toISOString();
    const next = !existing || forceFresh || existing.status === "stale"
      ? createScreen04WorkflowState(
          gate.binding,
          nextScreen04RunId(),
          at,
        )
      : reconcileScreen04EventCardBinding(existing, gate.binding, at);
    setScreen03Error(null);
    return commitScreen04State(next, true);
  }

  function commitScreen03State(
    value: Screen03VerificationState,
    navigate = true,
  ) {
    const state = restoreScreen03VerificationState(value);
    const parent = screen02WorkflowRef.current;
    if (
      !state ||
      !parent?.handoff ||
      state.runId !== parent.runId ||
      state.upstream.handoffFingerprint !==
        parent.handoff.integrity.handoffFingerprint
    ) {
      return false;
    }
    const current = screen03WorkflowRef.current;
    const sameChildLineage =
      current?.upstream.handoffFingerprint ===
      state.upstream.handoffFingerprint;
    if (
      current &&
      (state.runId !== current.runId ||
        (sameChildLineage &&
          (state.revision < current.revision ||
            (state.revision === current.revision &&
              state.integrity.stateFingerprint !==
                current.integrity.stateFingerprint))))
    ) {
      return false;
    }
    screen03WorkflowRef.current = state;
    setScreen03Workflow(state);
    const screen04 = screen04WorkflowRef.current;
    if (screen04) {
      const gate = parent.handoff
        ? screen04EntryGate(state, parent.handoff)
        : null;
      const reconciled = gate?.ready
        ? reconcileScreen04EventCardBinding(
            screen04,
            gate.binding,
            new Date().toISOString(),
          )
        : markScreen04WorkflowStale(
            screen04,
            null,
            "The verified shock changed. This exposure audit was calculated from an earlier Event Card version. Rerun the audit before relying on its classifications.",
            new Date().toISOString(),
          );
      if (
        reconciled.eventCardBinding.bindingFingerprint !==
          screen04.eventCardBinding.bindingFingerprint
      ) {
        hostReasoningAuditRequestsRef.current.clear();
        hostReasoningAuditRef.current = null;
      }
      screen04WorkflowRef.current = reconciled;
      setScreen04Workflow(reconciled);
      saveScreen04Widget(
        reconciled,
        !navigate && activeScreenRef.current === 4 ? 4 : 3,
      );
    }
    if (state.briefing?.activeProposalId) {
      clearScreen03HostDraftTimeout();
      setScreen03HostReasoningStatus("complete");
    }
    if (
      state.status === "locked" &&
      (screen03HostDraftAttemptRef.current ||
        screen03HostDraftWatchdogRef.current)
    ) {
      // Every host-draft capability is bound to the Screen 3 revision that
      // prepared it. A successful lock advances that revision, so any draft
      // still in flight can no longer be applied and must not keep polling the
      // canonical workflow after the Event Card is final.
      retireScreen03HostDraftAttempt(
        state.interpretation?.origin === "chatgpt-host"
          ? "complete"
          : "unavailable",
      );
    }
    if (navigate) {
      activeScreenRef.current = 3;
      setActiveScreen(3);
    }
    saveScreen03Widget(state, navigate ? 3 : 2);
    return true;
  }

  async function openScreen03Workflow(
    snapshot = screen02WorkflowRef.current,
    refresh = false,
    targetProposalId?: string,
  ) {
    if (!snapshot?.handoff || screen03OperationActiveRef.current) return;
    const lifecycleGeneration = screen03LifecycleGenerationRef.current;
    const existing = screen03WorkflowRef.current;
    if (
      existing &&
      existing.runId === snapshot.runId &&
      existing.upstream.handoffFingerprint ===
        snapshot.handoff.integrity.handoffFingerprint
    ) {
      commitScreen03State(existing, true);
    } else {
      const openedAt = new Date(
        Math.max(Date.now(), Date.parse(snapshot.handoff.builtAt)),
      ).toISOString();
      const loading = createScreen03LoadingState(
        snapshot.handoff,
        openedAt,
      );
      commitScreen03State(loading, true);
    }
    screen03OperationActiveRef.current = "research";
    setScreen03Busy(true);
    setScreen03Error(null);
    try {
      const result = await bridge.openScreen03Workflow(
        snapshot,
        refresh,
        targetProposalId,
      );
      if (
        screen03LifecycleGenerationRef.current !== lifecycleGeneration
      ) {
        return;
      }
      const latestParent = screen02WorkflowRef.current;
      if (
        !latestParent ||
        latestParent.runId !== snapshot.runId ||
        !commitScreen03State(
          result.state,
          activeScreenRef.current === 3,
        )
      ) {
        throw new Error(
          "ShockAudit ignored a Screen 3 result for a changed Screen 2 event.",
        );
      }
      if (!result.ok) setScreen03Error(result.message);
    } catch (error) {
      if (
        screen03LifecycleGenerationRef.current !== lifecycleGeneration
      ) {
        return;
      }
      setScreen03Error(
        error instanceof Error
          ? error.message
          : "ShockAudit could not complete the Screen 3 evidence search.",
      );
    } finally {
      if (screen03LifecycleGenerationRef.current === lifecycleGeneration) {
        screen03OperationActiveRef.current = false;
        setScreen03Busy(false);
      }
    }
  }

  function commitHostReasoningTaskEntry(
    taskType: HostReasoningTaskType,
    entry: HostReasoningTaskEntry,
  ) {
    const next = {
      ...hostReasoningTasksRef.current,
      [taskType]: entry,
    };
    hostReasoningTasksRef.current = next;
    setHostReasoningTasks(next);
    setHostReasoningTransientStatus((current) => {
      if (!current[taskType]) return current;
      const nextStatus = { ...current };
      delete nextStatus[taskType];
      return nextStatus;
    });
  }

  function clearScreen02HostResultReconciliation(
    expectedOperationId?: string,
  ) {
    const marker = screen02HostResultMarkerRef.current;
    if (
      expectedOperationId !== undefined &&
      marker?.operationId !== expectedOperationId
    ) return;
    pendingScreen02HostResultAcknowledgementRef.current = null;
    paintedScreen02HostResultRef.current = null;
    screen02HostResultMarkerRef.current = null;
    setScreen02HostResultMarker((current) =>
      expectedOperationId === undefined ||
        current?.operationId === expectedOperationId
        ? null
        : current
    );
  }

  function screen02HostResultReconciliationIsCurrent(
    pending: Screen02PendingHostResultAcknowledgement,
    requirePaintedMarker: boolean,
  ) {
    const marker = pending.marker;
    const currentWorkflow = screen02WorkflowRef.current;
    const entry = hostReasoningTasksRef.current["screen02-search-review"];
    if (
      pendingScreen02HostResultAcknowledgementRef.current !== pending ||
      activeScreenRef.current !== 2 ||
      workflowLifecycleGenerationRef.current !== pending.lifecycleGeneration ||
      !screen02HostResultRenderMarkerMatches(
        screen02HostResultMarkerRef.current,
        marker,
      ) ||
      !currentWorkflow || currentWorkflow.mode !== "find" ||
      currentWorkflow !== pending.workflow ||
      currentWorkflow.runId !== marker.runId ||
      currentWorkflow.revision !== marker.workflowRevision ||
      currentWorkflow.stateFingerprint !== marker.workflowStateFingerprint ||
      !entry || entry.coordinates !== pending.coordinates || !entry.task ||
      entry.coordinates.taskId !== marker.taskId ||
      entry.coordinates.runId !== marker.runId ||
      entry.coordinates.expectedParentRevision !==
        marker.expectedParentRevision ||
      entry.coordinates.status !== "applied" ||
      entry.coordinates.resultId !== marker.resultId ||
      entry.task.status !== "applied" ||
      entry.task.taskId !== marker.taskId ||
      entry.task.runId !== marker.runId ||
      entry.task.resultId !== marker.resultId ||
      entry.task.panelReconciliation.status === "reconciled" ||
      !screen02HostReviewSummary(entry.task.result) ||
      fingerprintHostReasoningValue(entry.task.result) !==
        marker.resultFingerprint
    ) return false;
    const state = workflowState(currentWorkflow);
    if (!state || state.mode !== "find") return false;
    const application = state.candidateSets.find(
      (candidateSet) =>
        candidateSet.status === "active" &&
        candidateSet.candidateSetSnapshotId ===
          state.activeCandidateSetSnapshotId,
    )?.manifest.hostReviewApplication;
    if (
      application?.applicationFingerprint !== marker.applicationFingerprint ||
      !screen02HostReviewApplicationIsCurrent(state, {
        previousRevision: marker.expectedParentRevision,
        taskId: marker.taskId,
        resultId: marker.resultId,
        runId: marker.runId,
        expectedScopeFingerprint:
          entry.coordinates.expectedScopeFingerprint,
        originalCandidatePoolId: entry.coordinates.candidatePoolId ?? "",
        originalCandidatePoolFingerprint:
          entry.coordinates.expectedCandidatePoolFingerprint ?? "",
      })
    ) return false;
    if (!requirePaintedMarker) return true;
    const painted = paintedScreen02HostResultRef.current;
    return Boolean(
      painted &&
        screen02HostResultRenderMarkerMatches(painted.marker, marker) &&
        screen02HostResultMarkerElementMatches(painted.element, marker),
    );
  }

  function stageScreen02HostResultAcknowledgement(input: {
    coordinates: HostReasoningPrivateTaskCoordinates;
    task: HostReasoningPublicTaskState;
    workflow: Screen02WorkflowClientSnapshot;
    operationId: string;
    lifecycleGeneration: number;
  }) {
    // A previous host write or acknowledgement may settle after navigation or
    // timeout. Keep its lease until that finalizer settles so a replacement
    // result cannot race it through the same private-state/server boundary.
    if (screen02HostResultAcknowledgementInFlightRef.current !== null) {
      return false;
    }
    const state = workflowState(input.workflow);
    const summary = screen02HostReviewSummary(input.task.result);
    if (!state || state.mode !== "find" || !summary) return false;
    const application = state.candidateSets.find(
      (candidateSet) =>
        candidateSet.status === "active" &&
        candidateSet.candidateSetSnapshotId ===
          state.activeCandidateSetSnapshotId,
    )?.manifest.hostReviewApplication;
    if (!input.task.resultId || !application) return false;
    const marker: Screen02HostResultRenderMarker = {
      schemaVersion: SCREEN02_HOST_RESULT_RENDER_MARKER_SCHEMA_VERSION,
      runId: input.workflow.runId,
      taskId: input.coordinates.taskId,
      resultId: input.task.resultId,
      expectedParentRevision: input.coordinates.expectedParentRevision,
      workflowRevision: input.workflow.revision,
      workflowStateFingerprint: input.workflow.stateFingerprint,
      applicationFingerprint: application.applicationFingerprint,
      resultFingerprint: fingerprintHostReasoningValue(input.task.result),
      operationId: input.operationId,
    };
    const pending: Screen02PendingHostResultAcknowledgement = {
      marker,
      coordinates: input.coordinates,
      workflow: input.workflow,
      lifecycleGeneration: input.lifecycleGeneration,
      openedMatchSnapshotId: openedAuditMatchRef.current,
    };
    paintedScreen02HostResultRef.current = null;
    pendingScreen02HostResultAcknowledgementRef.current = pending;
    screen02HostResultMarkerRef.current = marker;
    setScreen02HostResultMarker(marker);
    return true;
  }

  function screen02HostResultMarkerPainted(
    marker: Screen02HostResultRenderMarker,
    element: Screen02HostResultMarkerElement,
  ) {
    const pending = pendingScreen02HostResultAcknowledgementRef.current;
    if (
      !pending ||
      !screen02HostResultRenderMarkerMatches(pending.marker, marker) ||
      !screen02HostResultMarkerElementMatches(element, marker)
    ) return;
    paintedScreen02HostResultRef.current = { marker, element };
    if (!screen02HostResultReconciliationIsCurrent(pending, true)) return;
    const operationId = marker.operationId;
    if (!claimScreen02HostResultAcknowledgement(
      screen02HostResultAcknowledgementInFlightRef,
      operationId,
    )) return;
    void finalizeScreen02HostResultAfterPaint({
      marker,
      isCurrent: () =>
        screen02HostResultReconciliationIsCurrent(pending, true),
      persist: () => bridge.persistScreen02WorkflowWidgetSnapshot({
        schemaVersion: "screen-02-workflow-widget-v1",
        workflow: pending.workflow,
        activeScreen: 2,
        openedMatchSnapshotId: pending.openedMatchSnapshotId,
      }),
      acknowledge: () => bridge.acknowledgeHostReasoningTaskResult(
        pending.coordinates,
        pending.workflow.accessToken,
        marker.resultId,
        marker.operationId,
      ),
      acknowledgementMatches: (acknowledgement) =>
        acknowledgement.outcome === "found" &&
        acknowledgement.task?.status === "applied" &&
        acknowledgement.task.taskId === marker.taskId &&
        acknowledgement.task.runId === marker.runId &&
        acknowledgement.task.resultId === marker.resultId &&
        Boolean(screen02HostReviewSummary(acknowledgement.task.result)) &&
        fingerprintHostReasoningValue(acknowledgement.task.result) ===
          marker.resultFingerprint &&
        acknowledgement.task.panelReconciliation.status === "reconciled",
    }).then((outcome) => {
      if (outcome.outcome !== "acknowledged") {
        clearScreen02HostResultReconciliation(operationId);
        return;
      }
      // The acknowledgement promise and this continuation are separate
      // microtasks. Reset/navigation can win in that narrow interval, so do
      // not resurrect the retired task entry after the server has absorbed
      // an otherwise valid acknowledgement.
      if (!screen02HostResultReconciliationIsCurrent(pending, true)) {
        clearScreen02HostResultReconciliation(operationId);
        return;
      }
      const task = outcome.acknowledgement.task;
      const coordinates = task
        ? updatePrivateHostTaskCoordinates(pending.coordinates, task)
        : null;
      if (!task || !coordinates) {
        clearScreen02HostResultReconciliation(operationId);
        return;
      }
      pendingScreen02HostResultAcknowledgementRef.current = null;
      commitHostReasoningTaskEntry(
        "screen02-search-review",
        hostReasoningTaskEntry(coordinates, task),
      );
      hostReasoningReconcilersRef.current
        .get("screen02-search-review")?.stop();
      clearScreen02HostResultReconciliation(operationId);
    }).catch((error) => {
      console.warn(
        "ShockAudit could not confirm the painted Screen 2 host result.",
        error,
      );
      clearScreen02HostResultReconciliation(operationId);
    }).finally(() => {
      releaseScreen02HostResultAcknowledgement(
        screen02HostResultAcknowledgementInFlightRef,
        operationId,
      );
    });
  }

  function screen02HostResultMarkerRemoved(
    marker: Screen02HostResultRenderMarker,
    element: Screen02HostResultMarkerElement,
  ) {
    const painted = paintedScreen02HostResultRef.current;
    if (
      painted?.element === element &&
      screen02HostResultRenderMarkerMatches(painted.marker, marker)
    ) {
      paintedScreen02HostResultRef.current = null;
    }
  }

  function currentHostReasoningCoordinates(
    taskType: HostReasoningTaskType,
  ): HostReasoningTaskPrepareCoordinates {
    const parent = screen02WorkflowRef.current;
    const screen02 = workflowState(parent);
    if (!parent || !screen02) {
      throw new Error("The current Screen 2 run is unavailable. Reopen Screen 2 and try again.");
    }
    if (taskType === "screen02-search-review") {
      if (screen02.mode !== "find" || !screen02.activeCandidateSetSnapshotId) {
        throw new Error("Run the source-backed candidate search before requesting an optional review.");
      }
      const activeSet = screen02.candidateSets.find(
        (candidateSet) =>
          candidateSet.candidateSetSnapshotId ===
            screen02.activeCandidateSetSnapshotId &&
          candidateSet.status === "active",
      );
      if (!activeSet) {
        throw new Error("The current candidate pool changed. Refresh Screen 2 and try again.");
      }
      return {
        taskType,
        runId: parent.runId,
        accessToken: parent.accessToken,
        expectedParentRevision: parent.revision,
        candidatePoolId: activeSet.candidateSetSnapshotId,
        selectedEventId: null,
        claimGroupId: null,
        expectedScopeFingerprint: screen02.screen01Fingerprint,
        expectedCandidatePoolFingerprint: activeSet.candidateSetFingerprint,
        expectedEventFingerprint: null,
      };
    }

    const screen03 = screen03WorkflowRef.current;
    if (
      !screen03 || !parent.handoff || screen03.runId !== parent.runId ||
      screen03.upstream.handoffFingerprint !==
        parent.handoff.integrity.handoffFingerprint
    ) {
      throw new Error("The current Screen 3 event is unavailable. Reopen Screen 3 and try again.");
    }
    const selectedEventId = screen03.orientation?.current.selectedEventId ??
      screen03.history[0]?.targetId;
    if (!selectedEventId) {
      throw new Error("The current Screen 3 event has no saved event identity.");
    }
    const claimGroupId = taskType === "screen03-evidence-mapping"
      ? (() => {
          const claimIds = screen03FactualClaims(screen03.proposals)
            .filter((claim) => claim.support !== "direct")
            .slice(0, 15)
            .map((claim) => claim.id)
            .sort();
          if (claimIds.length === 0) {
            throw new Error("Every current factual claim already has direct support; no passage-mapping task is needed.");
          }
          return `screen03-claims:${
            fingerprintHostReasoningValue(claimIds).slice(8)
          }`;
        })()
      : null;
    return {
      taskType,
      runId: parent.runId,
      accessToken: parent.accessToken,
      expectedParentRevision: parent.revision,
      candidatePoolId: null,
      selectedEventId,
      claimGroupId,
      expectedScopeFingerprint: screen02.screen01Fingerprint,
      expectedCandidatePoolFingerprint: null,
      expectedEventFingerprint: screen03.upstream.eventFingerprint,
    };
  }

  function hostReasoningCoordinatesAreCurrent(
    expected: HostReasoningTaskPrepareCoordinates,
  ) {
    try {
      const current = currentHostReasoningCoordinates(expected.taskType);
      return current.runId === expected.runId &&
        current.expectedParentRevision === expected.expectedParentRevision &&
        current.candidatePoolId === expected.candidatePoolId &&
        current.selectedEventId === expected.selectedEventId &&
        current.claimGroupId === expected.claimGroupId &&
        current.expectedScopeFingerprint === expected.expectedScopeFingerprint &&
        current.expectedCandidatePoolFingerprint ===
          expected.expectedCandidatePoolFingerprint &&
        current.expectedEventFingerprint === expected.expectedEventFingerprint;
    } catch {
      return false;
    }
  }

  function hostReasoningLifecycleGeneration(taskType: HostReasoningTaskType) {
    return taskType === "screen02-search-review"
      ? workflowLifecycleGenerationRef.current
      : screen03LifecycleGenerationRef.current;
  }

  function hostReasoningTaskEntryIsCurrent(
    taskType: HostReasoningTaskType,
    taskId: string,
  ) {
    return hostReasoningTasksRef.current[taskType]?.coordinates.taskId ===
      taskId;
  }

  async function abandonPreparedHostReasoningTask(
    coordinates: HostReasoningPrivateTaskCoordinates,
    accessToken: string,
    reason: string,
  ) {
    await bridge.forgetHostReasoningTasks([coordinates.taskId]).catch(
      () => undefined,
    );
    if (!hostReasoningTaskIsTerminal(coordinates.status)) {
      await bridge.cancelHostReasoningTask({
        task: coordinates,
        accessToken,
        reason,
      }).catch(() => undefined);
    }
  }

  function setHostReasoningTaskTimeout(taskType: HostReasoningTaskType) {
    const current = hostReasoningTasksRef.current[taskType];
    if (!current) return;
    if (taskType === "screen02-search-review") {
      clearScreen02HostResultReconciliation();
    }
    commitHostReasoningTaskEntry(taskType, {
      ...current,
      ui: {
        ...current.ui,
        phase: "timed-out",
        message: hostReasoningTaskMessage(taskType, "timed-out"),
      },
    });
    if (
      current.task?.status === "applied" && current.task.resultId &&
      current.task.panelReconciliation.status !== "reconciled"
    ) {
      const access = screen02WorkflowRef.current;
      if (access?.runId === current.coordinates.runId) {
        void bridge.recordHostReasoningPanelFailure({
          task: current.coordinates,
          accessToken: access.accessToken,
          resultId: current.task.resultId,
          failureCode: "panel-reconciliation-timeout",
          failureExplanation:
            "The original ShockAudit panel could not incorporate the stored result within its bounded reconciliation window.",
        }).catch(() => undefined);
      }
    }
  }

  function armHostReasoningReconciler(taskType: HostReasoningTaskType) {
    hostReasoningReconcilersRef.current.get(taskType)?.stop();
    const controller = createHostTaskReconciler({
      reconcile: () => reconcileHostReasoningTask(taskType),
      onTimeout: () => setHostReasoningTaskTimeout(taskType),
      // Retrying creates a freshly prepared, separately signed task below.
      onRetry: () => undefined,
    });
    hostReasoningReconcilersRef.current.set(taskType, controller);
    controller.start();
    return controller;
  }

  async function requestHostReasoningAuditForScreen04(
    binding: Screen04EventCardBinding,
  ) {
    const runId = binding.screen02.runId;
    const requestKey = binding.bindingFingerprint;
    if (hostReasoningAuditRequestsRef.current.has(requestKey)) return;
    const parent = screen02WorkflowRef.current;
    if (!parent || parent.runId !== runId) return;
    const task = Object.values(hostReasoningTasksRef.current)
      .filter((entry): entry is HostReasoningTaskEntry =>
        Boolean(entry) && entry!.coordinates.runId === runId &&
        (entry!.coordinates.taskType === "screen02-search-review" ||
          entry!.coordinates.selectedEventId ===
            binding.screen02.selectedEventId &&
          entry!.coordinates.expectedEventFingerprint ===
            binding.screen02.selectedEventFingerprint)
      )
      .sort((left, right) =>
        right.coordinates.createdAt.localeCompare(left.coordinates.createdAt) ||
        right.coordinates.taskId.localeCompare(left.coordinates.taskId)
    )[0]?.coordinates;
    if (!task) return;
    hostReasoningAuditRequestsRef.current.add(requestKey);
    try {
      const result = await bridge.getHostReasoningTaskStatus(
        task,
        parent.accessToken,
        null,
        true,
      );
      if (result.auditBundle !== undefined) {
        const auditBundle = await restoreDeferredHostReasoningRunAuditBundle(
          result.auditBundle,
        );
        if (auditBundle) {
          carryHostReasoningAuditIntoScreen04(auditBundle, binding);
          return;
        }
      }
      hostReasoningAuditRequestsRef.current.delete(requestKey);
    } catch {
      // Optional provenance never blocks the deterministic workflow.
      hostReasoningAuditRequestsRef.current.delete(requestKey);
    }
  }

  async function reconcileHostReasoningTaskInternal(
    taskType: HostReasoningTaskType,
  ): Promise<boolean> {
    const entry = hostReasoningTasksRef.current[taskType];
    const parent = screen02WorkflowRef.current;
    if (!entry || !parent || parent.runId !== entry.coordinates.runId) {
      return true;
    }
    if (taskType === "screen02-search-review") {
      const pending = pendingScreen02HostResultAcknowledgementRef.current;
      if (pending) {
        if (screen02HostResultReconciliationIsCurrent(pending, false)) {
          return false;
        }
        clearScreen02HostResultReconciliation(pending.marker.operationId);
      }
      // Do not refresh or commit an unpersisted replacement while an older
      // host write/acknowledgement can still settle. Its finalizer owns the
      // lease until settlement, even if navigation removed its DOM marker.
      if (screen02HostResultAcknowledgementInFlightRef.current !== null) {
        return false;
      }
    }
    const taskId = entry.coordinates.taskId;
    const lifecycleGeneration = hostReasoningLifecycleGeneration(taskType);
    const entryIsCurrent = () =>
      hostReasoningLifecycleGeneration(taskType) === lifecycleGeneration &&
      hostReasoningTaskEntryIsCurrent(taskType, taskId);
    try {
      const result = await bridge.getHostReasoningTaskStatus(
        entry.coordinates,
        parent.accessToken,
      );
      if (!entryIsCurrent()) return true;
      if (result.outcome !== "found" || !result.task) {
        commitHostReasoningTaskEntry(taskType, {
          ...entry,
          ui: {
            ...entry.ui,
            phase: "failed",
            message: hostReasoningTaskMessage(taskType, "failed"),
          },
        });
        return true;
      }
      const coordinates = updatePrivateHostTaskCoordinates(
        entry.coordinates,
        result.task,
      );
      if (!coordinates) {
        commitHostReasoningTaskEntry(taskType, {
          ...entry,
          ui: {
            ...entry.ui,
            phase: "failed",
            message: "ShockAudit ignored a result for different task coordinates. The source-backed state was preserved.",
          },
        });
        return true;
      }
      let nextEntry = hostReasoningTaskEntry(coordinates, result.task);
      commitHostReasoningTaskEntry(taskType, nextEntry);

      if (result.task.status === "applied" && result.task.resultId) {
        if (taskType === "screen02-search-review") {
          if (result.task.panelReconciliation.status === "reconciled") {
            return true;
          }
          const currentParent = screen02WorkflowRef.current;
          if (
            !currentParent || currentParent.runId !== coordinates.runId ||
            !coordinates.candidatePoolId ||
            !coordinates.expectedCandidatePoolFingerprint ||
            !screen02HostReviewSummary(result.task.result) ||
            activeScreenRef.current !== 2
          ) {
            return false;
          }
          const mutationOwner = claimWorkflowMutation("background");
          if (!mutationOwner) return false;
          try {
            const refreshOperationId = nextScreen02WorkflowOperationId();
            const refreshed = await bridge.mutateScreen02Workflow(
              currentParent,
              "refresh",
              {},
              refreshOperationId,
            );
            if (
              !entryIsCurrent() ||
              !workflowMutationBelongsTo(mutationOwner)
            ) return true;
            if (
              !workflowMutationIsOperationAttributable(
                refreshed,
                refreshOperationId,
                "refresh",
              )
            ) {
              commitHostReasoningTaskEntry(taskType, {
                ...nextEntry,
                ui: {
                  ...nextEntry.ui,
                  phase: "failed",
                  message: screen02HostTaskMessage(
                    "failed",
                    visibleFindCandidateCount(
                      workflowState(screen02WorkflowRef.current),
                    ),
                  ),
                },
              });
              return true;
            }
            const refreshedState = workflowState(refreshed);
            if (
              activeScreenRef.current !== 2 || !refreshedState ||
              !screen02HostReviewApplicationIsCurrent(refreshedState, {
                previousRevision: coordinates.expectedParentRevision,
                taskId: coordinates.taskId,
                resultId: result.task.resultId,
                runId: coordinates.runId,
                expectedScopeFingerprint:
                  coordinates.expectedScopeFingerprint,
                originalCandidatePoolId: coordinates.candidatePoolId,
                originalCandidatePoolFingerprint:
                  coordinates.expectedCandidatePoolFingerprint,
              }) ||
              !commitWorkflowSnapshot(refreshed, {
                navigate: true,
                persist: false,
              })
            ) {
              return false;
            }
            const committedWorkflow = screen02WorkflowRef.current;
            if (
              !committedWorkflow ||
              !stageScreen02HostResultAcknowledgement({
                coordinates,
                task: result.task,
                workflow: committedWorkflow,
                operationId: refreshOperationId,
                lifecycleGeneration,
              })
            ) {
              return false;
            }
            // Keep the reconciler deadline alive while the mounted panel
            // completes its paint -> persistence -> acknowledgement barrier.
            return false;
          } finally {
            if (releaseWorkflowMutation(mutationOwner)) {
              if (!drainPendingWorkflowForegroundMutation()) {
                drainPendingWorkflowRefresh();
              }
            }
          }
        } else if (taskType === "screen03-evidence-mapping") {
          const currentParent = screen02WorkflowRef.current;
          if (!currentParent?.handoff || currentParent.runId !== coordinates.runId) {
            return false;
          }
          const reopened = await bridge.openScreen03Workflow(currentParent, false);
          if (!entryIsCurrent()) return true;
          if (
            !coordinates.selectedEventId ||
            !coordinates.claimGroupId ||
            !coordinates.expectedEventFingerprint ||
            !screen03HostEvidenceMappingApplicationIsCurrent(
              reopened.state,
              {
                resultId: result.task.resultId,
                runId: coordinates.runId,
                selectedEventId: coordinates.selectedEventId,
                claimGroupId: coordinates.claimGroupId,
                expectedEventFingerprint: coordinates.expectedEventFingerprint,
              },
            ) ||
            !commitScreen03State(
              reopened.state,
              activeScreenRef.current === 3,
            )
          ) {
            return false;
          }
        } else {
          const currentParent = screen02WorkflowRef.current;
          if (!currentParent?.handoff || currentParent.runId !== coordinates.runId) {
            return false;
          }
          const reopened = await bridge.openScreen03Workflow(currentParent, false);
          if (!entryIsCurrent()) return true;
          if (
            !coordinates.selectedEventId ||
            !coordinates.expectedEventFingerprint ||
            !screen03HostOverviewResultIsCurrent(
              result.task.result,
              {
                runId: reopened.state.runId,
                selectedEventId:
                  reopened.state.orientation?.current.selectedEventId ??
                  reopened.state.history[0]?.targetId ?? null,
                eventFingerprint: reopened.state.upstream.eventFingerprint,
                stateFingerprint:
                  fingerprintScreen03VerificationState(reopened.state),
                activeSourceIds: reopened.state.evidence
                  .filter((evidence) => evidence.status !== "changed")
                  .map((evidence) => evidence.id),
              },
              {
                runId: coordinates.runId,
                selectedEventId: coordinates.selectedEventId,
                expectedEventFingerprint: coordinates.expectedEventFingerprint,
              },
            ) ||
            !commitScreen03State(
              reopened.state,
              activeScreenRef.current === 3,
            )
          ) {
            return false;
          }
        }
        if (!entryIsCurrent()) return true;
        const acknowledged = await bridge.acknowledgeHostReasoningTaskResult(
          coordinates,
          parent.accessToken,
          result.task.resultId,
        );
        if (!entryIsCurrent()) return true;
        if (acknowledged.outcome !== "found" || !acknowledged.task) {
          return false;
        }
        const acknowledgedCoordinates = updatePrivateHostTaskCoordinates(
          coordinates,
          acknowledged.task,
        );
        if (!acknowledgedCoordinates) return false;
        nextEntry = hostReasoningTaskEntry(
          acknowledgedCoordinates,
          acknowledged.task,
        );
        commitHostReasoningTaskEntry(taskType, nextEntry);
        return true;
      }
      return hostReasoningTaskIsTerminal(result.task.status);
    } catch (error) {
      if (!entryIsCurrent()) return true;
      if (
        taskType === "screen02-search-review" &&
        /\[SA-S2-(?:OPERATION-NOT-APPLIED|RESULT-CONFLICT)\]/u.test(
          error instanceof Error ? error.message : String(error ?? ""),
        )
      ) {
        commitHostReasoningTaskEntry(taskType, {
          ...entry,
          ui: {
            ...entry.ui,
            phase: "failed",
            message: screen02HostTaskMessage(
              "failed",
              visibleFindCandidateCount(
                workflowState(screen02WorkflowRef.current),
              ),
            ),
          },
        });
        return true;
      }
      // Transport failures remain recoverable through the bounded next check.
      return false;
    }
  }

  function reconcileHostReasoningTask(taskType: HostReasoningTaskType) {
    const inFlight = hostReasoningChecksRef.current.get(taskType);
    if (inFlight) return inFlight;
    const operation = reconcileHostReasoningTaskInternal(taskType).finally(
      () => {
        if (hostReasoningChecksRef.current.get(taskType) === operation) {
          hostReasoningChecksRef.current.delete(taskType);
        }
      },
    );
    hostReasoningChecksRef.current.set(taskType, operation);
    return operation;
  }

  async function startHostReasoningTask(
    taskType: HostReasoningTaskType,
    retryOfTaskId: string | null = null,
  ) {
    if (
      !hostReasoningModeAllowsTask(
        hostViewRef.current.hostReasoningMode,
        taskType,
      ) ||
      !hostViewRef.current.canRequestAiReview ||
      hostReasoningStartsRef.current.has(taskType)
    ) return;
    const existing = hostReasoningTasksRef.current[taskType];
    if (
      !retryOfTaskId && existing &&
      !hostReasoningTaskIsTerminal(existing.coordinates.status) &&
      existing.ui.phase !== "timed-out"
    ) return;
    if (taskType === "screen02-search-review") {
      clearScreen02HostResultReconciliation();
    }
    const startOperation = Symbol(taskType);
    const lifecycleGeneration = hostReasoningLifecycleGeneration(taskType);
    const startIsCurrent = () =>
      hostReasoningStartsRef.current.get(taskType) === startOperation &&
      hostReasoningLifecycleGeneration(taskType) === lifecycleGeneration;
    hostReasoningStartsRef.current.set(taskType, startOperation);
    setHostReasoningTransientStatus((current) => ({
      ...current,
      [taskType]: {
        taskId: `preparing-${taskType}`,
        phase: "starting",
        title: hostReasoningTaskTitles[taskType],
        message: hostReasoningTaskMessage(taskType, "starting"),
        retryCount: retryOfTaskId ? 1 : 0,
      },
    }));
    try {
      const coordinates = currentHostReasoningCoordinates(taskType);
      const prepared = await bridge.prepareHostReasoningTask(coordinates, {
        retryOfTaskId,
      });
      const privateCoordinates = privateCoordinatesFromPrepared(
        coordinates,
        prepared,
      );
      if (
        !privateCoordinates || !startIsCurrent() ||
        !hostReasoningCoordinatesAreCurrent(coordinates)
      ) {
        if (privateCoordinates) {
          await abandonPreparedHostReasoningTask(
            privateCoordinates,
            coordinates.accessToken,
            "The workflow changed while the optional host task was being prepared.",
          );
        }
        return;
      }
      commitHostReasoningTaskEntry(
        taskType,
        hostReasoningTaskEntry(privateCoordinates, prepared),
      );
      const delivery = await bridge.deliverHostReasoningTask(
        prepared,
        { runId: coordinates.runId, accessToken: coordinates.accessToken },
        () =>
          startIsCurrent() &&
          hostReasoningCoordinatesAreCurrent(coordinates),
      );
      if (
        !startIsCurrent() ||
        !hostReasoningTaskEntryIsCurrent(taskType, prepared.taskId) ||
        !hostReasoningCoordinatesAreCurrent(coordinates)
      ) {
        await abandonPreparedHostReasoningTask(
          privateCoordinates,
          coordinates.accessToken,
          "The workflow changed before the optional host task delivery settled.",
        );
        return;
      }
      const deliveredStatus = delivery.record?.status ??
        (delivery.accepted ? "message-accepted" : "message-rejected");
      const deliveredCoordinates: HostReasoningPrivateTaskCoordinates = {
        ...privateCoordinates,
        status: deliveredStatus,
      };
      const deliveredEntry = hostReasoningTaskEntry(deliveredCoordinates);
      deliveredEntry.ui = {
        ...deliveredEntry.ui,
        phase: delivery.accepted ? "waiting" : "failed",
        message: hostReasoningTaskMessage(
          taskType,
          delivery.accepted ? "waiting" : "failed",
        ),
        route: delivery.channel,
        requestedAt: delivery.requestedAt,
        settledAt: delivery.resolvedAt,
        retryCount: delivery.retryCount,
      };
      commitHostReasoningTaskEntry(taskType, deliveredEntry);
      if (delivery.accepted) {
        const controller = armHostReasoningReconciler(taskType);
        void controller.reconcileNow();
      }
    } catch (error) {
      if (!startIsCurrent()) return;
      setHostReasoningTransientStatus((current) => ({
        ...current,
        [taskType]: {
          taskId: `unavailable-${taskType}`,
          phase: "failed",
          title: hostReasoningTaskTitles[taskType],
          message: taskType === "screen02-search-review"
            ? hostReasoningTaskMessage(taskType, "failed")
            : error instanceof Error
              ? error.message
              : hostReasoningTaskMessage(taskType, "failed"),
          retryCount: retryOfTaskId ? 1 : 0,
        },
      }));
    } finally {
      if (hostReasoningStartsRef.current.get(taskType) === startOperation) {
        hostReasoningStartsRef.current.delete(taskType);
      }
    }
  }

  async function retryHostReasoningTask(taskType: HostReasoningTaskType) {
    const entry = hostReasoningTasksRef.current[taskType];
    if (!entry) {
      await startHostReasoningTask(taskType);
      return;
    }
    if (entry.coordinates.retryCount !== 0 ||
        hostReasoningStartsRef.current.has(taskType)) return;
    const parent = screen02WorkflowRef.current;
    if (!parent || parent.runId !== entry.coordinates.runId) return;
    const lifecycleGeneration = hostReasoningLifecycleGeneration(taskType);
    hostReasoningReconcilersRef.current.get(taskType)?.stop();
    if (!hostReasoningTaskIsTerminal(entry.coordinates.status)) {
      try {
        await bridge.cancelHostReasoningTask({
          task: entry.coordinates,
          accessToken: parent.accessToken,
          reason: "The researcher requested the single permitted retry after the panel wait ended.",
        });
      } catch {
        return;
      }
    }
    if (
      hostReasoningLifecycleGeneration(taskType) !== lifecycleGeneration ||
      !hostReasoningTaskEntryIsCurrent(taskType, entry.coordinates.taskId)
    ) return;
    await startHostReasoningTask(taskType, entry.coordinates.taskId);
  }

  function reconcileHostReasoningTasksForScreen(screen: 2 | 3) {
    if (hostViewRef.current.hostReasoningMode === "disabled") return;
    const taskTypes: HostReasoningTaskType[] = screen === 2
      ? ["screen02-search-review"]
      : ["screen03-evidence-mapping", "screen03-overview-improvement"];
    for (const taskType of taskTypes) {
      if (hostReasoningTasksRef.current[taskType]) {
        void reconcileHostReasoningTask(taskType);
      }
    }
  }

  function resumeStoredHostReasoningTasks(screen: 2 | 3) {
    if (hostViewRef.current.hostReasoningMode === "disabled") return;
    const taskTypes: HostReasoningTaskType[] = screen === 2
      ? ["screen02-search-review"]
      : ["screen03-evidence-mapping", "screen03-overview-improvement"];
    for (const taskType of taskTypes) {
      const entry = hostReasoningTasksRef.current[taskType];
      if (!entry) continue;
      if (
        !hostReasoningTaskIsTerminal(entry.coordinates.status) ||
        entry.ui.phase === "applying"
      ) {
        const controller = armHostReasoningReconciler(taskType);
        void controller.reconcileNow();
      }
    }
  }

  function retireHostReasoningTasks(
    parent: Screen02WorkflowClientSnapshot | null,
    reason: string,
  ) {
    clearScreen02HostResultReconciliation();
    const retiredEntries = Object.values(hostReasoningTasksRef.current)
      .filter((entry): entry is HostReasoningTaskEntry => Boolean(entry));
    for (const controller of hostReasoningReconcilersRef.current.values()) {
      controller.stop();
    }
    hostReasoningReconcilersRef.current.clear();
    hostReasoningChecksRef.current.clear();
    hostReasoningStartsRef.current.clear();
    hostReasoningAuditRequestsRef.current.clear();
    hostReasoningAuditRef.current = null;
    void bridge.forgetHostReasoningTasks(
      retiredEntries.map((entry) => entry.coordinates.taskId),
    ).catch(() => undefined);
    if (parent) {
      for (const entry of retiredEntries) {
        if (
          entry.coordinates.runId === parent.runId &&
          !hostReasoningTaskIsTerminal(entry.coordinates.status)
        ) {
          void bridge.cancelHostReasoningTask({
            task: entry.coordinates,
            accessToken: parent.accessToken,
            reason,
          }).catch(() => undefined);
        }
      }
    }
    hostReasoningTasksRef.current = {};
    setHostReasoningTasks({});
    setHostReasoningTransientStatus({});
  }

  function retireScreen03HostReasoningTasks(
    parent: Screen02WorkflowClientSnapshot | null,
    reason: string,
  ) {
    const retiredEntries = screen03HostReasoningTaskTypes.flatMap(
      (taskType) => {
        hostReasoningReconcilersRef.current.get(taskType)?.stop();
        hostReasoningReconcilersRef.current.delete(taskType);
        hostReasoningChecksRef.current.delete(taskType);
        hostReasoningStartsRef.current.delete(taskType);
        const entry = hostReasoningTasksRef.current[taskType];
        return entry ? [entry] : [];
      },
    );
    const nextEntries = { ...hostReasoningTasksRef.current };
    for (const taskType of screen03HostReasoningTaskTypes) {
      delete nextEntries[taskType];
    }
    hostReasoningTasksRef.current = nextEntries;
    setHostReasoningTasks(nextEntries);
    setHostReasoningTransientStatus((current) => {
      const next = { ...current };
      for (const taskType of screen03HostReasoningTaskTypes) {
        delete next[taskType];
      }
      return next;
    });
    void bridge.forgetHostReasoningTasks(
      retiredEntries.map((entry) => entry.coordinates.taskId),
    ).catch(() => undefined);
    if (!parent) return;
    for (const entry of retiredEntries) {
      if (
        entry.coordinates.runId === parent.runId &&
        !hostReasoningTaskIsTerminal(entry.coordinates.status)
      ) {
        void bridge.cancelHostReasoningTask({
          task: entry.coordinates,
          accessToken: parent.accessToken,
          reason,
        }).catch(() => undefined);
      }
    }
  }

  function clearScreen03HostDraftTimeout() {
    if (screen03HostNativeMessageTimeoutRef.current !== null) {
      window.clearTimeout(screen03HostNativeMessageTimeoutRef.current);
      screen03HostNativeMessageTimeoutRef.current = null;
    }
    screen03HostDraftWatchdogRef.current?.stop();
    screen03HostDraftWatchdogRef.current = null;
    screen03HostDraftAttemptRef.current = null;
  }

  function retireScreen03HostDraftAttempt(
    status: "complete" | "unavailable",
  ) {
    clearScreen03HostDraftTimeout();
    screen03HostDraftBatchRef.current = null;
    pendingScreen03HostDraftReceiptRef.current = null;
    screen03HostDraftDeliveryAcknowledgedRef.current = false;
    setScreen03HostReasoningStatus(status);
    setScreen03Error(null);
  }

  function screen03HostDraftAttemptIsCurrent(
    attempt: Screen03HostDraftAttempt,
  ) {
    const parent = screen02WorkflowRef.current;
    return screen03HostDraftAttemptRef.current === attempt &&
      screen03LifecycleGenerationRef.current === attempt.lifecycleGeneration &&
      parent?.handoff !== null && parent?.handoff !== undefined &&
      parent.runId === attempt.baseline.runId &&
      parent.stateFingerprint === attempt.parentStateFingerprint &&
      parent.handoff.integrity.handoffFingerprint ===
        attempt.baseline.handoffFingerprint;
  }

  function finishScreen03HostDraftAttempt(
    attempt: Screen03HostDraftAttempt,
    status: "complete" | "unavailable",
  ) {
    if (!screen03HostDraftAttemptIsCurrent(attempt)) return;
    retireScreen03HostDraftAttempt(status);
  }

  async function reconcileScreen03HostDraftAttempt(
    attempt: Screen03HostDraftAttempt,
  ) {
    if (!screen03HostDraftAttemptIsCurrent(attempt)) return false;
    const parent = screen02WorkflowRef.current;
    if (!parent?.handoff) return false;
    const result = await bridge.openScreen03Workflow(parent, false);
    if (
      !screen03HostDraftAttemptIsCurrent(attempt) ||
      !screen03HostDraftStateIsFresh(result.state, attempt.baseline) ||
      !commitScreen03State(result.state, activeScreenRef.current === 3)
    ) {
      return false;
    }
    finishScreen03HostDraftAttempt(attempt, "complete");
    return true;
  }

  function invalidateScreen03Sibling() {
    screen03LifecycleGenerationRef.current += 1;
    // A Screen 2 event change can retain the same run ID. Clear both the
    // completed audit and in-flight request keys before the stale Screen 4
    // snapshot is saved so a late response cannot be rebound to the new card.
    hostReasoningAuditRequestsRef.current.clear();
    hostReasoningAuditRef.current = null;
    retireScreen03HostReasoningTasks(
      screen02WorkflowRef.current,
      "The selected Screen 2 event changed, so its optional Screen 3 host tasks are no longer current.",
    );
    markCurrentScreen04Stale(null);
    clearScreen03HostDraftTimeout();
    screen03HostDraftBatchRef.current = null;
    pendingScreen03HostDraftReceiptRef.current = null;
    screen03HostDraftDeliveryAcknowledgedRef.current = false;
    screen03OperationActiveRef.current = false;
    screen03WorkflowRef.current = null;
    setScreen03Workflow(null);
    setScreen03Busy(false);
    setScreen03Error(null);
    setScreen03HostReasoningStatus("idle");
    screen03HostBriefingBootstrapRef.current = null;
    void bridge.clearScreen03WorkflowWidgetSnapshot();
  }

  async function acceptScreen03HostDraftReceipt(
    receipt: Screen03HostDraftReceiptNotice,
  ) {
    const attempt = screen03HostDraftAttemptRef.current;
    const batch = screen03HostDraftBatchRef.current;
    const parent = screen02WorkflowRef.current;
    if (
      !attempt ||
      !batch ||
      !parent?.handoff ||
      batch.requestId !== receipt.requestId ||
      attempt.requestId !== receipt.requestId ||
      parent.runId !== receipt.runId ||
      !screen03HostDraftAttemptIsCurrent(attempt)
    ) {
      return;
    }
    pendingScreen03HostDraftReceiptRef.current = null;
    if (receipt.disposition === "duplicate") {
      // The authenticated submit boundary only returns duplicate after the
      // validated explanation is already saved or exactly matches the current
      // one. Read once so a replay can recover an earlier applied write whose
      // receipt was missed. If the canonical state is unchanged but already
      // has a host overview, terminate the no-op refresh; an initially empty
      // panel keeps polling to the bounded deadline instead.
      const reconciled = await screen03HostDraftWatchdogRef.current
        ?.reconcileNow() ?? false;
      if (reconciled || !screen03HostDraftAttemptIsCurrent(attempt)) return;
      if (screen03WorkflowRef.current?.interpretation?.origin === "chatgpt-host") {
        finishScreen03HostDraftAttempt(attempt, "complete");
      }
      return;
    }
    if (receipt.disposition !== "applied") {
      finishScreen03HostDraftAttempt(attempt, "unavailable");
      return;
    }
    // A receipt can race canonical persistence. Reconcile now, but retain the
    // absolute watchdog and polling if the fresh state is not readable yet.
    await screen03HostDraftWatchdogRef.current?.reconcileNow();
  }

  async function requestScreen03HostReasoning(
    parent = screen02WorkflowRef.current,
  ) {
    if (
      !parent?.handoff ||
      screen03OperationActiveRef.current ||
      screen03WorkflowRef.current?.status === "loading" ||
      screen03HostReasoningStatus === "requesting" ||
      screen03HostReasoningStatus === "waiting"
    ) {
      return;
    }
    const existing = screen03WorkflowRef.current;
    if (
      !existing ||
      !screen03HistoricalHostBriefingCompatibilityEnabled(existing)
    ) return;
    const lifecycleGeneration = screen03LifecycleGenerationRef.current;
    const parentStateFingerprint = parent.stateFingerprint;
    const stateFingerprint = existing.integrity.stateFingerprint;
    const isCurrent = () => {
      const latestParent = screen02WorkflowRef.current;
      const latestState = screen03WorkflowRef.current;
      return screen03LifecycleGenerationRef.current === lifecycleGeneration &&
        activeScreenRef.current === 3 &&
        latestParent?.runId === parent.runId &&
        latestParent.stateFingerprint === parentStateFingerprint &&
        latestParent.handoff?.integrity.handoffFingerprint ===
          parent.handoff?.integrity.handoffFingerprint &&
        latestState?.runId === existing.runId &&
        latestState.integrity.stateFingerprint === stateFingerprint;
    };

    clearScreen03HostDraftTimeout();
    setScreen03HostReasoningStatus("requesting");
    try {
      const delivery = await bridge.requestScreen03HostNativeBriefing(
        existing,
        isCurrent,
      );
      if (!isCurrent()) return;
      if (!delivery.delivered) {
        setScreen03HostReasoningStatus("unavailable");
        return;
      }
      setScreen03HostReasoningStatus("waiting");
      screen03HostNativeMessageTimeoutRef.current = window.setTimeout(() => {
        screen03HostNativeMessageTimeoutRef.current = null;
        if (isCurrent()) setScreen03HostReasoningStatus("unavailable");
      }, SCREEN_03_HOST_NATIVE_RENDER_WINDOW_MS);
    } catch (error) {
      if (!isCurrent()) return;
      setScreen03HostReasoningStatus("unavailable");
      console.warn(
        "ShockAudit could not start the host-native ChatGPT briefing.",
        error,
      );
    }
  }

  async function reviewScreen03HostBriefing(
    decision: Screen03HostBriefingReview,
  ) {
    const state = screen03WorkflowRef.current;
    const initialBootstrap = screen03HostBriefingBootstrapRef.current;
    const proposalId = state?.briefing?.activeProposalId;
    if (
      !state ||
      !initialBootstrap ||
      !proposalId ||
      screen03OperationActiveRef.current
    ) return;
    const lifecycleGeneration = screen03LifecycleGenerationRef.current;
    screen03OperationActiveRef.current = "mutation";
    setScreen03Busy(true);
    setScreen03Error(null);
    try {
      let bootstrap = initialBootstrap;
      if (Date.parse(bootstrap.continuationExpiresAt) <= Date.now()) {
        const parent = screen02WorkflowRef.current;
        if (!parent) {
          throw new Error(
            "ShockAudit cannot refresh briefing review authorization because the saved Screen 2 parent is unavailable.",
          );
        }
        bootstrap = await bridge.refreshScreen03HostBriefingBootstrap(
          parent,
          state,
          proposalId,
        );
        screen03HostBriefingBootstrapRef.current = bootstrap;
      }
      const decisionResult = await bridge.decideScreen03HostBriefing(
        bootstrap,
        state,
        proposalId,
        decision,
      );
      if (screen03LifecycleGenerationRef.current !== lifecycleGeneration) {
        return;
      }
      screen03HostBriefingBootstrapRef.current = decisionResult.bootstrap;
      if (!commitScreen03State(decisionResult.bootstrap.widget.state, true)) {
        throw new Error(
          "ShockAudit rejected an inconsistent briefing decision result.",
        );
      }
      if (decisionResult.outcome === "conflict") {
        setScreen03Error(decisionResult.message);
      }
    } catch (error) {
      setScreen03Error(
        error instanceof Error
          ? error.message
          : "The Screen 3 briefing decision could not be recorded.",
      );
    } finally {
      if (screen03LifecycleGenerationRef.current === lifecycleGeneration) {
        screen03OperationActiveRef.current = false;
        setScreen03Busy(false);
      }
    }
  }

  function openOrResumeScreen03FromScreen2() {
    const parent = screen02WorkflowRef.current;
    if (!parent?.handoff) return;
    const child = screen03WorkflowRef.current;
    const matchingChild =
      child?.runId === parent.runId &&
      child.upstream.handoffFingerprint ===
        parent.handoff.integrity.handoffFingerprint;
    if (!matchingChild) {
      void openScreen03Workflow(parent, false).finally(() =>
        reconcileHostReasoningTasksForScreen(3)
      );
      return;
    }
    activeScreenRef.current = 3;
    setActiveScreen(3);
    saveScreen03Widget(child, 3);
    // Re-open normally even when the saved child is not loading. The server
    // restores the canonical child without starting a duplicate research run,
    // which also recovers a host-task result missed while this iframe was
    // hidden or unmounted.
    void openScreen03Workflow(parent, false).finally(() =>
      reconcileHostReasoningTasksForScreen(3)
    );
  }

  async function mutateScreen03(action: Screen03ClientAction) {
    const parent = screen02WorkflowRef.current;
    const state = screen03WorkflowRef.current;
    if (!parent || !state || screen03OperationActiveRef.current) return;
    const lifecycleGeneration = screen03LifecycleGenerationRef.current;
    screen03OperationActiveRef.current = "mutation";
    setScreen03Busy(true);
    setScreen03Error(null);
    try {
      const result = await bridge.mutateScreen03Workflow(
        parent,
        state,
        action,
      );
      if (
        screen03LifecycleGenerationRef.current !== lifecycleGeneration
      ) {
        return;
      }
      if (
        !commitScreen03State(
          result.state,
          activeScreenRef.current === 3,
        )
      ) {
        throw new Error("ShockAudit rejected an inconsistent Screen 3 result.");
      }
      if (!result.ok) setScreen03Error(result.message);
      if (
        result.ok &&
        action.type === "lock-event-card" &&
        result.state.status === "locked"
      ) {
        openScreen04Workflow(result.state);
      }
    } catch (error) {
      if (
        screen03LifecycleGenerationRef.current !== lifecycleGeneration
      ) {
        return;
      }
      setScreen03Error(
        error instanceof Error
          ? error.message
          : "ShockAudit could not save the Screen 3 review decision.",
      );
    } finally {
      if (screen03LifecycleGenerationRef.current === lifecycleGeneration) {
        screen03OperationActiveRef.current = false;
        setScreen03Busy(false);
      }
    }
  }

  function commitWorkflowSnapshot(
    value: Screen02WorkflowClientSnapshot,
    options?: {
      allowNewRun?: boolean;
      openedMatchSnapshotId?: string | null;
      navigate?: boolean;
      persist?: boolean;
    },
  ) {
    const snapshot = restoreScreen02WorkflowClientSnapshot(value);
    if (!snapshot) return false;
    const current = screen02WorkflowRef.current;
    if (
      current &&
      !options?.allowNewRun &&
      (snapshot.runId !== current.runId ||
        snapshot.accessToken !== current.accessToken ||
        snapshot.mode !== current.mode ||
        snapshot.revision < current.revision ||
        (snapshot.revision === current.revision &&
          snapshot.stateFingerprint !== current.stateFingerprint))
    ) {
      return false;
    }
    let state: Screen02WorkflowState;
    try {
      state = stateFromScreen02WorkflowClientSnapshot(snapshot);
    } catch {
      return false;
    }
    const baseline = JSON.parse(
      JSON.stringify(state.screen01Baseline),
    ) as Screen01StudyContext;
    const confirmed = confirmedBaselineRef.current;
    if (
      confirmed &&
      !sameDeterministicJson(confirmed, baseline)
    ) {
      return false;
    }
    if (!confirmed) {
      rememberConfirmedBaseline(baseline);
    }
    if (current && current.runId !== snapshot.runId) {
      retireHostReasoningTasks(
        current,
        "The researcher replaced the Screen 2 run, so its optional host task is no longer current.",
      );
    }
    const hostResultMarker = screen02HostResultMarkerRef.current;
    if (
      hostResultMarker &&
      (snapshot.runId !== hostResultMarker.runId ||
        snapshot.revision !== hostResultMarker.workflowRevision ||
        snapshot.stateFingerprint !==
          hostResultMarker.workflowStateFingerprint)
    ) {
      clearScreen02HostResultReconciliation(hostResultMarker.operationId);
    }
    const replacedRun = !current || current.runId !== snapshot.runId;
    screen02WorkflowRef.current = snapshot;
    setScreen02Workflow(snapshot);
    if (state.mode === "find") {
      updateFindSearchState(
        replacedRun
          ? idleFindSearchState(state)
          : (currentSearch) => ({
              ...currentSearch,
              visibleCandidateCount: visibleFindCandidateCount(state),
            }),
      );
    }
    screen02SessionRef.current = null;
    setScreen02Session(null);
    const hasOpenedMatchOverride = Boolean(
      options &&
        Object.prototype.hasOwnProperty.call(
          options,
          "openedMatchSnapshotId",
        ),
    );
    const nextOpened =
      snapshot.mode === "audit"
        ? hasOpenedMatchOverride
          ? options?.openedMatchSnapshotId ?? null
          : openedAuditMatchRef.current
        : null;
    openedAuditMatchRef.current = nextOpened;
    setOpenedAuditMatch(nextOpened);
    const shouldNavigate = options?.navigate !== false;
    if (shouldNavigate) {
      activeScreenRef.current = 2;
      setActiveScreen(2);
    }
    if (options?.persist !== false) {
      saveWorkflowWidget(
        snapshot,
        shouldNavigate ? 2 : activeScreenRef.current === 1 ? 1 : 2,
        nextOpened,
      );
    }
    return true;
  }

  function clearWorkflowTimeouts() {
    for (const timeout of workflowTimeoutsRef.current.values()) {
      window.clearTimeout(timeout);
    }
    workflowTimeoutsRef.current.clear();
  }

  function clearWorkflowPolling() {
    if (workflowPollTimeoutRef.current !== null) {
      window.clearTimeout(workflowPollTimeoutRef.current);
      workflowPollTimeoutRef.current = null;
    }
  }

  function scheduleWorkflowPolling(
    snapshot: Screen02WorkflowClientSnapshot,
  ) {
    clearWorkflowPolling();
    const state = workflowState(snapshot);
    const restorationRefreshPending =
      workflowRestorationRefreshRef.current !== snapshot.runId;
    if (
      !state ||
      activeScreenRef.current !== 2 ||
      (!hostViewRef.current.connected &&
        !hostViewRef.current.canRequestAiReview) ||
      workflowResetRequestedRunRef.current === snapshot.runId ||
      (!restorationRefreshPending &&
        !state.assessmentRequests.some(
          (request) => request.status === "message-delivered",
        ))
    ) {
      return;
    }
    workflowPollTimeoutRef.current = window.setTimeout(() => {
      workflowPollTimeoutRef.current = null;
      const current = screen02WorkflowRef.current;
      if (
        !current ||
        current.runId !== snapshot.runId ||
        activeScreenRef.current !== 2
      ) {
        return;
      }
      const retryingRestoration =
        workflowRestorationRefreshRef.current !== current.runId;
      if (retryingRestoration) {
        workflowRestorationRefreshRef.current = current.runId;
      }
      void mutateWorkflow("refresh", {}, {
        requestAssessment: true,
        silent: true,
        restoration: retryingRestoration,
      });
    }, screen02WorkflowRefreshRetryMs);
  }

  function drainPendingWorkflowRefresh() {
    const pendingRunId = pendingWorkflowRefreshRunRef.current;
    if (!pendingRunId || workflowMutationActiveRef.current) return;
    pendingWorkflowRefreshRunRef.current = null;
    if (workflowResetRequestedRunRef.current === pendingRunId) return;
    const current = screen02WorkflowRef.current;
    if (!current || current.runId !== pendingRunId) {
      return;
    }
    void mutateWorkflow("refresh", {}, { requestAssessment: true });
  }

  function cancelPendingWorkflowForegroundMutation(reason: string) {
    const pending = pendingWorkflowForegroundMutationRef.current;
    pendingWorkflowForegroundMutationRef.current = null;
    if (!pending) return;
    pending.settle({
      outcome: "failed",
      operationId: pending.operationId,
      error: new Error(reason),
    });
  }

  function drainPendingWorkflowForegroundMutation() {
    if (workflowMutationActiveRef.current) return false;
    const pending = pendingWorkflowForegroundMutationRef.current;
    if (!pending) return false;
    pendingWorkflowForegroundMutationRef.current = null;
    const current = screen02WorkflowRef.current;
    if (
      !current ||
      current.runId !== pending.runId ||
      workflowLifecycleGenerationRef.current !==
        pending.lifecycleGeneration ||
      workflowResetRequestedRunRef.current === pending.runId
    ) {
      setWorkflowBusy(false);
      pending.settle({
        outcome: "failed",
        operationId: pending.operationId,
        error: new Error(
          "ShockAudit cancelled a queued Screen 2 action because its workflow changed.",
        ),
      });
      return false;
    }
    void mutateWorkflow(
      pending.action,
      pending.payload,
      pending.options,
      pending.operationId,
    ).then(async (result) => {
      pending.settle(
        result.outcome === "queued"
          ? await result.completion
          : result,
      );
    });
    return true;
  }

  function workflowMutationIsOperationAttributable(
    snapshot: Screen02WorkflowClientSnapshot,
    operationId: string,
    action: Screen02WorkflowActionName,
  ) {
    return screen02MutationAttributionAllowsCommit(
      bridge.screen02WorkflowOperationAttribution(snapshot),
      operationId,
      action,
    );
  }

  function scheduleWorkflowTimeouts(
    snapshot: Screen02WorkflowClientSnapshot,
    minimumDelayMs = 1,
  ) {
    const state = workflowState(snapshot);
    if (
      !state ||
      (!hostViewRef.current.connected &&
        !hostViewRef.current.canRequestAiReview) ||
      activeScreenRef.current !== 2 ||
      workflowResetRequestedRunRef.current === snapshot.runId
    ) {
      clearWorkflowTimeouts();
      return;
    }
    const delivered = state.assessmentRequests.filter(
      (request) => request.status === "message-delivered",
    );
    const live = new Set(delivered.map((request) => request.requestId));
    for (const [requestId, timeout] of workflowTimeoutsRef.current) {
      if (!live.has(requestId)) {
        window.clearTimeout(timeout);
        workflowTimeoutsRef.current.delete(requestId);
      }
    }
    for (const request of delivered) {
      if (workflowTimeoutsRef.current.has(request.requestId)) continue;
      const remaining =
        screen02AssessmentPreparedAtMs(request) +
        SCREEN_02_HOST_ASSESSMENT_DEADLINE_MS -
        Date.now();
      const expire = () => {
        const currentSnapshot = screen02WorkflowRef.current;
        const requestStillPending =
          currentSnapshot?.runId === snapshot.runId &&
          workflowState(currentSnapshot)?.assessmentRequests.some(
            (candidate) =>
              candidate.requestId === request.requestId &&
              candidate.status === "message-delivered",
          );
        if (!requestStillPending) {
          workflowTimeoutsRef.current.delete(request.requestId);
          return;
        }
        // A refresh can be in flight at the exact assessment deadline. Keep
        // the timeout live instead of dropping the fallback mutation while
        // another canonical Screen 2 mutation owns the single-flight guard.
        if (workflowMutationActiveRef.current) {
          const retry = window.setTimeout(
            expire,
            screen02WorkflowRefreshRetryMs,
          );
          workflowTimeoutsRef.current.set(request.requestId, retry);
          return;
        }
        workflowTimeoutsRef.current.delete(request.requestId);
        if (
          (!hostViewRef.current.connected &&
            !hostViewRef.current.canRequestAiReview) ||
          activeScreenRef.current !== 2
        ) {
          return;
        }
        void mutateWorkflow("assessment-timeout", {
          requestId: request.requestId,
        });
      };
      const timeout = window.setTimeout(
        expire,
        Math.max(minimumDelayMs, remaining),
      );
      workflowTimeoutsRef.current.set(request.requestId, timeout);
    }
  }

  async function requestWorkflowAssessment(
    snapshot: Screen02WorkflowClientSnapshot,
  ) {
    const batch = snapshot.assessmentBatch;
    const currentAtEntry = screen02WorkflowRef.current;
    if (
      !batch ||
      activeScreenRef.current !== 2 ||
      workflowMutationActiveRef.current ||
      workflowResetRequestedRunRef.current === snapshot.runId ||
      !currentAtEntry ||
      currentAtEntry.runId !== snapshot.runId ||
      currentAtEntry.accessToken !== snapshot.accessToken ||
      currentAtEntry.mode !== snapshot.mode ||
      currentAtEntry.revision !== snapshot.revision ||
      currentAtEntry.stateFingerprint !== snapshot.stateFingerprint
    ) {
      return;
    }
    const lifecycleGeneration = workflowLifecycleGenerationRef.current;
    const assessmentParentIsCurrent = () => {
      const current = screen02WorkflowRef.current;
      return workflowLifecycleGenerationRef.current === lifecycleGeneration &&
        Boolean(current) &&
        current!.runId === snapshot.runId &&
        current!.accessToken === snapshot.accessToken &&
        current!.mode === snapshot.mode &&
        current!.revision === snapshot.revision &&
        current!.stateFingerprint === snapshot.stateFingerprint;
    };
    const batchRequests = Array.isArray(batch.modelContext.requests)
      ? batch.modelContext.requests
      : [];
    const isDiscoveryPlanningBatch = batchRequests.some(
      (request) =>
        typeof request === "object" &&
        request !== null &&
        "mode" in request &&
        request.mode === "find-discovery-plan",
    );
    if (!hostViewRef.current.canRequestAiReview) {
      const mutationOwner = claimWorkflowMutation("background");
      if (!mutationOwner) return;
      try {
        const deliveryOperationId = nextScreen02WorkflowOperationId();
        const fixed = await bridge.recordScreen02AssessmentDelivery(
          snapshot,
          batch.requestIds,
          false,
          deliveryOperationId,
        );
        if (!assessmentParentIsCurrent()) return;
        if (
          !workflowMutationIsOperationAttributable(
            fixed,
            deliveryOperationId,
            "assessment-delivery",
          )
        ) {
          throw new Error(
            "ShockAudit could not attribute the source-search completion to its exact operation. Previous results remain available. [SA-S2-OPERATION-NOT-APPLIED]",
          );
        }
        if (!commitWorkflowSnapshot(fixed, {
          navigate: activeScreenRef.current === 2,
        })) throw new Error("ShockAudit rejected the source-derived assessment result.");
        setWorkflowNotice({
          status: "warning",
          message: isDiscoveryPlanningBatch
            ? "Source-backed candidates are ready."
            : "A source-derived assessment was completed because the optional preliminary review is unavailable.",
        });
        scheduleWorkflowTimeouts(fixed);
        scheduleWorkflowPolling(fixed);
      } catch (error) {
        if (!assessmentParentIsCurrent()) return;
        terminalizeFindDeliveryFailure(
          snapshot,
          error,
          nextScreen02WorkflowOperationId(),
        );
        setWorkflowNotice({
          status: "error",
          message: screen02VisibleFailureMessage(
            error,
            "ShockAudit could not safely apply the source-derived result. Previous results remain available.",
          ),
        });
      } finally {
        if (
          workflowLifecycleGenerationRef.current === lifecycleGeneration &&
          releaseWorkflowMutation(mutationOwner)
        ) {
          if (!drainPendingWorkflowForegroundMutation()) {
            drainPendingWorkflowRefresh();
          }
        }
      }
      return;
    }
    let followUpAssessment: Screen02WorkflowClientSnapshot | null = null;
    const mutationOwner = claimWorkflowMutation("background");
    if (!mutationOwner) return;
    const progressAtSend = workflowState(snapshot);
    const assessmentTaskTotal = progressAtSend?.assessmentRequests.length ?? 0;
    const assessmentTaskComplete =
      progressAtSend?.assessmentRequests.filter(
        (request) => request.status === "completed",
      ).length ?? 0;
    setWorkflowNotice({
      status: "info",
      message: isDiscoveryPlanningBatch
        ? "Preparing bounded search phrases. The supported official-source search starts automatically when they are ready."
        : `Reviewing ${batch.requestIds.length} source-grounded item${batch.requestIds.length === 1 ? "" : "s"}. No action is needed; results will appear here automatically. ${assessmentTaskComplete} of ${assessmentTaskTotal} are ready.`,
    });
    try {
      const absoluteDeadline = progressAtSend
        ? screen02AssessmentDeadlineAtMs(
            progressAtSend,
            batch.requestIds,
          )
        : Date.now() + SCREEN_02_HOST_ASSESSMENT_DEADLINE_MS;
      let hostDeadlineTimeout: number | null = null;
      const deliveryAttempt = bridge.requestScreen02WorkflowAssessment(
        snapshot,
      );
      const settledDelivery = deliveryAttempt.then(
        (delivery) => ({ kind: "delivery" as const, delivery }),
        (error: unknown) => ({ kind: "error" as const, error }),
      );
      const outcome = await Promise.race([
        settledDelivery,
        new Promise<{ kind: "deadline" }>((resolve) => {
          hostDeadlineTimeout = window.setTimeout(() => {
            hostDeadlineTimeout = null;
            resolve({ kind: "deadline" });
          }, Math.max(1, absoluteDeadline - Date.now()));
        }),
      ]);
      if (hostDeadlineTimeout !== null) {
        window.clearTimeout(hostDeadlineTimeout);
      }
      if (outcome.kind === "error") throw outcome.error;
      const current = screen02WorkflowRef.current;
      if (
        workflowLifecycleGenerationRef.current !== lifecycleGeneration ||
        !current ||
        current.runId !== snapshot.runId ||
        current.revision !== snapshot.revision ||
        current.stateFingerprint !== snapshot.stateFingerprint
      ) {
        return;
      }
      if (outcome.kind === "deadline") {
        let next = current;
        for (const requestId of batch.requestIds) {
          const currentState = workflowState(next);
          const currentRequest = currentState?.assessmentRequests.find(
            (request) => request.requestId === requestId,
          );
          if (
            !currentRequest ||
            !["prepared", "message-delivered"].includes(
              currentRequest.status,
            )
          ) {
            continue;
          }
          const timeoutOperationId = nextScreen02WorkflowOperationId();
          const timedOut = await bridge.mutateScreen02Workflow(
            next,
            "assessment-timeout",
            { requestId },
            timeoutOperationId,
          );
          if (!assessmentParentIsCurrent()) return;
          if (
            !workflowMutationIsOperationAttributable(
              timedOut,
              timeoutOperationId,
              "assessment-timeout",
            )
          ) {
            throw new Error(
              "ShockAudit could not attribute the bounded assessment timeout to its exact operation. Previous results remain available. [SA-S2-OPERATION-NOT-APPLIED]",
            );
          }
          next = timedOut;
        }
        if (
          !commitWorkflowSnapshot(next, {
            navigate: activeScreenRef.current === 2,
          })
        ) {
          throw new Error(
            "ShockAudit rejected an inconsistent canonical assessment-timeout response.",
          );
        }
        if (
          next.assessmentBatch &&
          next.assessmentBatch.requestIds.some(
            (requestId) => !batch.requestIds.includes(requestId),
          )
        ) {
          followUpAssessment = next;
        }
        setWorkflowNotice({
          status: "warning",
          message: isDiscoveryPlanningBatch
            ? "The search-planning step did not finish before the bounded deadline, so ShockAudit continued with the source-backed search plan."
            : "The preliminary review did not finish before the bounded deadline, so ShockAudit completed the conservative source-derived assessment instead.",
        });
        scheduleWorkflowTimeouts(next);
        scheduleWorkflowPolling(next);
        return;
      }
      const delivery = outcome.delivery;
      const deliveryOperationId = nextScreen02WorkflowOperationId();
      const next = await bridge.recordScreen02AssessmentDelivery(
        current,
        batch.requestIds,
        delivery.delivered,
        deliveryOperationId,
      );
      if (!assessmentParentIsCurrent()) return;
      if (
        !workflowMutationIsOperationAttributable(
          next,
          deliveryOperationId,
          "assessment-delivery",
        )
      ) {
        throw new Error(
          "ShockAudit could not attribute the assessment delivery result to its exact operation. Previous results remain available. [SA-S2-OPERATION-NOT-APPLIED]",
        );
      }
      if (
        !commitWorkflowSnapshot(next, {
          navigate: activeScreenRef.current === 2,
        })
      ) {
        throw new Error(
          "ShockAudit rejected an inconsistent canonical delivery response.",
        );
      }
      if (
        next.assessmentBatch &&
        next.assessmentBatch.requestIds.some(
          (requestId) => !batch.requestIds.includes(requestId),
        )
      ) {
        followUpAssessment = next;
      }
      setWorkflowNotice({
        status: delivery.delivered ? "info" : "warning",
        message: delivery.delivered
          ? isDiscoveryPlanningBatch
            ? "Preparing bounded search vocabulary. It can broaden supported source retrieval but cannot establish event facts, eligibility, or ranking."
            : `Reviewing the source results now. ${assessmentTaskComplete} of ${assessmentTaskTotal} were already ready; each completed interpretation will appear here automatically.`
          : delivery.message,
      });
      scheduleWorkflowTimeouts(next);
      scheduleWorkflowPolling(next);
    } catch (error) {
      if (
        workflowLifecycleGenerationRef.current !== lifecycleGeneration
      ) {
        return;
      }
      terminalizeFindDeliveryFailure(
        snapshot,
        error,
        nextScreen02WorkflowOperationId(),
      );
      setWorkflowNotice({
        status: "error",
        message: screen02VisibleFailureMessage(
          error,
          "ShockAudit could not safely apply the bounded assessment result. Previous results remain available.",
        ),
      });
    } finally {
      if (
        workflowLifecycleGenerationRef.current === lifecycleGeneration &&
        releaseWorkflowMutation(mutationOwner)
      ) {
        if (drainPendingWorkflowForegroundMutation()) {
          return;
        }
        if (
          followUpAssessment &&
          activeScreenRef.current === 2 &&
          workflowResetRequestedRunRef.current !== followUpAssessment.runId
        ) {
          void requestWorkflowAssessment(followUpAssessment);
        } else {
          drainPendingWorkflowRefresh();
        }
      }
    }
  }

  async function mutateWorkflow(
    action: Screen02WorkflowActionName,
    payload: Record<string, unknown>,
    options?: Screen02WorkflowMutationOptions,
    operationId = nextScreen02WorkflowOperationId(),
  ): Promise<Screen02WorkflowMutationResult> {
    const current = screen02WorkflowRef.current;
    const backgroundMutation =
      action === "refresh" ||
      action === "assessment-timeout" ||
      Boolean(options?.restoration);
    if (
      !current ||
      workflowResetRequestedRunRef.current === current.runId
    ) {
      return {
        outcome: "failed",
        operationId,
        error: new Error(
          "ShockAudit could not start the Screen 2 action because this workflow is unavailable or resetting.",
        ),
      };
    }
    if (workflowMutationActiveRef.current) {
      if (
        !backgroundMutation &&
        workflowMutationKindRef.current === "background" &&
        !pendingWorkflowForegroundMutationRef.current
      ) {
        let settle!: (result: Screen02WorkflowMutationCompletion) => void;
        const completion = new Promise<Screen02WorkflowMutationCompletion>(
          (resolve) => {
            settle = resolve;
          },
        );
        pendingWorkflowForegroundMutationRef.current = {
          runId: current.runId,
          lifecycleGeneration: workflowLifecycleGenerationRef.current,
          operationId,
          action,
          payload: { ...payload },
          ...(options ? { options: { ...options } } : {}),
          settle,
        };
        setWorkflowBusy(true);
        setWorkflowNotice({
          status: "info",
          message:
            "Finishing the current assessment update, then saving your action…",
        });
        return { outcome: "queued", operationId, completion };
      }
      return {
        outcome: "failed",
        operationId,
        error: new Error(
          "ShockAudit ignored a duplicate Screen 2 action while another foreground action was still running.",
        ),
      };
    }
    const lifecycleGeneration = workflowLifecycleGenerationRef.current;
    const mutationOwner = claimWorkflowMutation(
      backgroundMutation
        ? "background"
        : "foreground",
    );
    if (!mutationOwner) {
      return {
        outcome: "failed",
        operationId,
        error: new Error(
          "ShockAudit could not acquire the Screen 2 operation lock.",
        ),
      };
    }
    if (!backgroundMutation) setWorkflowBusy(true);
    let restoredOperationConflict = false;
    try {
      const next = await bridge.mutateScreen02Workflow(
        current,
        action,
        payload,
        operationId,
      );
      const attribution = bridge.screen02WorkflowOperationAttribution(next);
      if (!screen02MutationAttributionAllowsCommit(
        attribution,
        operationId,
        action,
      )) {
        throw new Error(
          "ShockAudit restored canonical Screen 2 data, but could not attribute it to this exact action. Previous results remain available. [SA-S2-OPERATION-NOT-APPLIED]",
        );
      }
      restoredOperationConflict = attribution?.outcome === "conflict";
      const latest = screen02WorkflowRef.current;
      if (
        workflowLifecycleGenerationRef.current !== lifecycleGeneration ||
        !workflowMutationBelongsTo(mutationOwner) ||
        !latest ||
        latest.runId !== current.runId ||
        latest.accessToken !== current.accessToken ||
        latest.mode !== current.mode
      ) {
        throw new Error(
          "ShockAudit ignored a Screen 2 response for a retired workflow.",
        );
      }
      const hasOpenedMatchOverride = Boolean(
        !restoredOperationConflict && options &&
          Object.prototype.hasOwnProperty.call(
            options,
            "openedMatchSnapshotId",
          ),
      );
      if (
        !commitWorkflowSnapshot(next, {
          ...(hasOpenedMatchOverride
            ? { openedMatchSnapshotId: options?.openedMatchSnapshotId ?? null }
            : {}),
          navigate: activeScreenRef.current === 2,
        })
      ) {
        throw new Error(
          "ShockAudit rejected an inconsistent canonical workflow response.",
        );
      }
      if (restoredOperationConflict) {
        throw new Error(
          "Screen 2 restored the canonical result for this operation. The requested action did not win its canonical write. [SA-S2-OPERATION-NOT-APPLIED]",
        );
      }
      if (
        action === "find-clear-selection" &&
        current.handoff &&
        !next.handoff
      ) {
        invalidateScreen03Sibling();
      }
      const opensScreen03 =
        action === "find-continue" ||
        action === "find-continue-without-assessment" ||
        action === "audit-continue" ||
        action === "audit-continue-without-assessment";
      if (opensScreen03) {
        if (!next.handoff) {
          throw new Error(
            "Screen 2 completed without its validated Screen 3 event handoff.",
          );
        }
        const released = releaseWorkflowMutation(mutationOwner);
        if (released && !backgroundMutation) setWorkflowBusy(false);
        if (released) pendingWorkflowForegroundMutationRef.current = null;
        if (activeScreenRef.current === 2) {
          void openScreen03Workflow(next);
        } else {
          setWorkflowNotice({
            status: "success",
            message:
              "Shock locked. Return to Screen 2 to open Screen 3.",
          });
        }
        return { outcome: "committed", operationId, snapshot: next };
      }
      if (!options?.silent) {
        setWorkflowNotice({
          status: "success",
          message:
            action === "refresh"
              ? "Canonical Screen 2 state refreshed."
              : "Screen 2 restored the canonical result for this operation.",
        });
      }
      scheduleWorkflowTimeouts(next);
      scheduleWorkflowPolling(next);
      const released = releaseWorkflowMutation(mutationOwner);
      if (released && !backgroundMutation) setWorkflowBusy(false);
      const drainedForeground = released &&
        drainPendingWorkflowForegroundMutation();
      if (released && !drainedForeground &&
        options?.requestAssessment !== false &&
        activeScreenRef.current === 2 &&
        workflowResetRequestedRunRef.current !== next.runId &&
        next.assessmentBatch
      ) {
        void requestWorkflowAssessment(next);
      } else if (released && !drainedForeground) {
        drainPendingWorkflowRefresh();
      }
      return { outcome: "committed", operationId, snapshot: next };
    } catch (error) {
      if (
        workflowLifecycleGenerationRef.current !== lifecycleGeneration
      ) {
        return {
          outcome: "failed",
          operationId,
          error: new Error(
            "ShockAudit ignored a Screen 2 result after this workflow was replaced.",
          ),
        };
      }
      const normalizedError = error instanceof Error
        ? error
        : new Error("ShockAudit could not save the Screen 2 update.");
      if (!workflowMutationBelongsTo(mutationOwner)) {
        return {
          outcome: "failed",
          operationId,
          error: new Error(
            "ShockAudit ignored a Screen 2 result after its operation ownership changed.",
          ),
        };
      }
      if (action === "assessment-timeout") {
        terminalizeFindDeliveryFailure(current, normalizedError, operationId);
      }
      if (!options?.silent) {
        setWorkflowNotice({
          status: restoredOperationConflict ? "warning" : "error",
          message: screen02VisibleFailureMessage(
            normalizedError,
            restoredOperationConflict
              ? "Screen 2 restored the canonical result for this operation. The requested action did not win its canonical write."
              : "ShockAudit could not safely apply the Screen 2 result. Previous results remain available.",
          ),
        });
      }
      const released = releaseWorkflowMutation(mutationOwner);
      if (released && !backgroundMutation) setWorkflowBusy(false);
      if (
        options?.restoration &&
        workflowRestorationRefreshRef.current === current.runId
      ) {
        workflowRestorationRefreshRef.current = null;
      }
      const latest = screen02WorkflowRef.current;
      if (latest && activeScreenRef.current === 2) {
        scheduleWorkflowTimeouts(
          latest,
          action === "assessment-timeout"
            ? screen02WorkflowRefreshRetryMs
            : 1,
        );
        scheduleWorkflowPolling(latest);
      }
      if (released && !drainPendingWorkflowForegroundMutation()) {
        drainPendingWorkflowRefresh();
      }
      return { outcome: "failed", operationId, error: normalizedError };
    }
  }

  function findSearchDriverMayContinue(
    startingSnapshot: Screen02WorkflowClientSnapshot,
    lifecycleGeneration: number,
    logicalOperationId: string,
    driverOwner: symbol,
  ) {
    const current = screen02WorkflowRef.current;
    return findSearchDriverBelongsTo(startingSnapshot.runId, driverOwner) &&
      workflowLifecycleGenerationRef.current === lifecycleGeneration &&
      activeScreenRef.current === 2 &&
      workflowResetRequestedRunRef.current !== startingSnapshot.runId &&
      current?.runId === startingSnapshot.runId &&
      current.accessToken === startingSnapshot.accessToken &&
      current.mode === "find" &&
      findSearchStateRef.current.phase === "searching" &&
      findSearchStateRef.current.operationId === logicalOperationId;
  }

  function markFindSearchContinuationLimit(
    snapshot: Screen02WorkflowClientSnapshot,
    logicalOperationId: string,
    startedRevision: number,
  ) {
    const state = workflowState(snapshot);
    if (!state || state.mode !== "find") return;
    const visibleCandidateCount = visibleFindCandidateCount(state);
    updateFindSearchState((current) =>
      current.operationId !== logicalOperationId
        ? current
        : {
            operationId: logicalOperationId,
            phase: "incomplete",
            message:
              "Automatic search continuation reached its 16-request safety limit. Qualified partial results remain available; refresh this workspace to resume the same server-owned search.",
            startedRevision,
            settledRevision: null,
            visibleCandidateCount,
            errorCode: "continuation-limit",
            recovery: visibleCandidateCount > 0
              ? "preserved-results"
              : "retry",
            elapsedLabel:
              `${SCREEN_02_FIND_MAX_RETRIEVAL_TOOL_CALLS} of ${SCREEN_02_FIND_MAX_RETRIEVAL_TOOL_CALLS} bounded server requests completed.`,
          }
    );
    setWorkflowNotice({
      status: "warning",
      message:
        "The bounded client continuation limit was reached before the server marked source retrieval complete. Current qualified results are preserved. Refresh this workspace to resume the same canonical search; ShockAudit will not silently start a new search.",
    });
  }

  function settleFindSearch(
    snapshot: Screen02WorkflowClientSnapshot,
    logicalOperationId: string,
    startedRevision: number,
    completedToolCallCount: number,
  ) {
    if (!commitWorkflowSnapshot(snapshot, { navigate: true })) {
      throw new Error("ShockAudit rejected the source-backed search result.");
    }
    const state = workflowState(snapshot);
    if (
      !state || state.mode !== "find" ||
      screen02FindDiscoveryIsSearching(state)
    ) {
      throw new Error(
        "ShockAudit could not read a terminal source-search result.",
      );
    }
    const terminalPhase = completedFindSearchPhase(state);
    updateFindSearchState((current) =>
      current.operationId !== logicalOperationId
        ? current
        : {
            operationId: logicalOperationId,
            phase: terminalPhase,
            message: terminalPhase === "completed"
              ? "Candidate search completed."
              : terminalPhase === "completed-empty"
                ? "Search completed with no qualified candidates."
                : "Search completed with incomplete source coverage.",
            startedRevision,
            settledRevision: snapshot.revision,
            visibleCandidateCount: visibleFindCandidateCount(state),
            errorCode: null,
            recovery: terminalPhase === "incomplete" ? "retry" : "none",
            ...(completedToolCallCount > 0
              ? {
                  elapsedLabel:
                    `${completedToolCallCount} bounded server request${completedToolCallCount === 1 ? "" : "s"} completed.`,
                }
              : {}),
          }
    );
    setWorkflowNotice(screen02FindTerminalNotice(state));
  }

  async function continueFindSearchChunks(input: {
    snapshot: Screen02WorkflowClientSnapshot;
    startingSnapshot: Screen02WorkflowClientSnapshot;
    lifecycleGeneration: number;
    logicalOperationId: string;
    startedRevision: number;
    driverOwner: symbol;
    completedToolCallCount: number;
  }): Promise<
    | {
        outcome: "completed";
        snapshot: Screen02WorkflowClientSnapshot;
        completedToolCallCount: number;
      }
    | { outcome: "paused" | "limit" }
  > {
    let snapshot = input.snapshot;
    let completedToolCallCount = input.completedToolCallCount;
    let state = workflowState(snapshot);
    if (!state || state.mode !== "find") {
      throw new Error("ShockAudit could not read the source-search operation result.");
    }

    while (screen02FindDiscoveryIsSearching(state)) {
      if (!findSearchDriverMayContinue(
        input.startingSnapshot,
        input.lifecycleGeneration,
        input.logicalOperationId,
        input.driverOwner,
      )) {
        return { outcome: "paused" };
      }
      if (
        completedToolCallCount >=
          SCREEN_02_FIND_MAX_RETRIEVAL_TOOL_CALLS
      ) {
        markFindSearchContinuationLimit(
          snapshot,
          input.logicalOperationId,
          input.startedRevision,
        );
        return { outcome: "limit" };
      }

      const continuationOperationId = nextScreen02WorkflowOperationId();
      completedToolCallCount += 1;
      updateFindSearchState((current) =>
        current.operationId !== input.logicalOperationId
          ? current
          : {
              ...current,
              message:
                "Continuing the bounded source search automatically…",
              visibleCandidateCount: visibleFindCandidateCount(state),
              elapsedLabel:
                `${completedToolCallCount} of ${SCREEN_02_FIND_MAX_RETRIEVAL_TOOL_CALLS} bounded server requests.`,
            }
      );
      const requested = await mutateWorkflow(
        "find-search-continue",
        {},
        { requestAssessment: false, silent: true },
        continuationOperationId,
      );
      const mutation = requested.outcome === "queued"
        ? await requested.completion
        : requested;
      if (mutation.outcome === "failed") throw mutation.error;
      snapshot = mutation.snapshot;

      if (!findSearchDriverMayContinue(
        input.startingSnapshot,
        input.lifecycleGeneration,
        input.logicalOperationId,
        input.driverOwner,
      )) {
        return { outcome: "paused" };
      }
      state = workflowState(snapshot);
      if (!state || state.mode !== "find") {
        throw new Error(
          "ShockAudit could not read the continued source-search result.",
        );
      }
      updateFindSearchState((current) =>
        current.operationId !== input.logicalOperationId
          ? current
          : {
              ...current,
              visibleCandidateCount: visibleFindCandidateCount(state),
            }
      );
    }

    return { outcome: "completed", snapshot, completedToolCallCount };
  }

  async function resumeSearchingFind(
    snapshot: Screen02WorkflowClientSnapshot,
  ) {
    const state = workflowState(snapshot);
    if (
      !hostViewRef.current.connected || activeScreenRef.current !== 2 ||
      !state || state.mode !== "find" ||
      !screen02FindDiscoveryIsSearching(state) ||
      workflowResetRequestedRunRef.current === snapshot.runId
    ) return;
    const driverOwner = claimFindSearchDriver(snapshot.runId);
    if (!driverOwner) return;
    const lifecycleGeneration = workflowLifecycleGenerationRef.current;
    const currentSearch = findSearchStateRef.current;
    const logicalOperationId =
      currentSearch.phase === "searching" && currentSearch.operationId
        ? currentSearch.operationId
        : nextScreen02WorkflowOperationId();
    const startedRevision = currentSearch.phase === "searching"
      ? currentSearch.startedRevision ?? snapshot.revision
      : snapshot.revision;
    updateFindSearchState({
      operationId: logicalOperationId,
      phase: "searching",
      message: "Resuming the bounded source search automatically…",
      startedRevision,
      settledRevision: null,
      visibleCandidateCount: visibleFindCandidateCount(state),
      errorCode: null,
      recovery: "preserved-results",
    });
    try {
      const continued = await continueFindSearchChunks({
        snapshot,
        startingSnapshot: snapshot,
        lifecycleGeneration,
        logicalOperationId,
        startedRevision,
        driverOwner,
        completedToolCallCount: 0,
      });
      if (continued.outcome !== "completed") return;
      if (!findSearchDriverMayContinue(
        snapshot,
        lifecycleGeneration,
        logicalOperationId,
        driverOwner,
      )) return;
      settleFindSearch(
        continued.snapshot,
        logicalOperationId,
        startedRevision,
        continued.completedToolCallCount,
      );
    } catch (error) {
      const stale =
        workflowLifecycleGenerationRef.current !== lifecycleGeneration ||
        workflowResetRequestedRunRef.current === snapshot.runId ||
        !findSearchDriverBelongsTo(snapshot.runId, driverOwner);
      if (stale) return;
      const currentState = workflowState(screen02WorkflowRef.current) ?? state;
      const visibleCandidateCount = visibleFindCandidateCount(currentState);
      updateFindSearchState({
        operationId: logicalOperationId,
        phase: "delivery-failure",
        message:
          "The resumed search could not safely continue. Canonical partial results remain available.",
        startedRevision,
        settledRevision: null,
        visibleCandidateCount,
        errorCode: findSearchErrorCode(error),
        recovery: visibleCandidateCount > 0 ? "preserved-results" : "retry",
      });
      setWorkflowNotice({
        status: "error",
        message: screen02VisibleFailureMessage(
          error,
          "ShockAudit could not safely resume the canonical source search. Refresh once to reconcile its latest server-owned state.",
        ),
      });
    } finally {
      releaseFindSearchDriver(snapshot.runId, driverOwner);
    }
  }

  function reconcileRestoredFindSearch(
    snapshot: Screen02WorkflowClientSnapshot,
  ) {
    const state = workflowState(snapshot);
    if (!state || state.mode !== "find") return;
    if (screen02FindDiscoveryIsSearching(state)) {
      void resumeSearchingFind(snapshot);
      return;
    }
    const currentSearch = findSearchStateRef.current;
    if (
      currentSearch.phase !== "searching" ||
      currentSearch.operationId !== null
    ) return;
    const logicalOperationId = nextScreen02WorkflowOperationId();
    updateFindSearchState({ ...currentSearch, operationId: logicalOperationId });
    settleFindSearch(
      snapshot,
      logicalOperationId,
      currentSearch.startedRevision ?? snapshot.revision,
      0,
    );
  }

  async function runDeterministicFind(
    criteria: Parameters<Screen02FindProps["onSearch"]>[0],
  ) {
    const startingSnapshot = screen02WorkflowRef.current;
    const startingState = workflowState(startingSnapshot);
    if (
      !startingSnapshot || startingState?.mode !== "find" ||
      findSearchStateRef.current.phase === "searching" ||
      workflowResetRequestedRunRef.current === startingSnapshot.runId
    ) return;
    const driverOwner = claimFindSearchDriver(startingSnapshot.runId);
    if (!driverOwner) return;
    const lifecycleGeneration = workflowLifecycleGenerationRef.current;
    const operationId = nextScreen02WorkflowOperationId();
    let completionOwner: symbol | null = null;
    let completedToolCallCount = 0;
    const previousCandidateCount = visibleFindCandidateCount(startingState);
    updateFindSearchState({
      operationId,
      phase: "searching",
      message: "Searching sources for candidate shocks…",
      startedRevision: startingSnapshot.revision,
      settledRevision: null,
      visibleCandidateCount: previousCandidateCount,
      errorCode: null,
      recovery: previousCandidateCount > 0
        ? "preserved-results"
        : "none",
      elapsedLabel:
        `1 of ${SCREEN_02_FIND_MAX_RETRIEVAL_TOOL_CALLS} bounded server requests.`,
    });
    try {
      completedToolCallCount += 1;
      const requested = await mutateWorkflow(
        "find-search",
        { criteria },
        { requestAssessment: false },
        operationId,
      );
      const mutation = requested.outcome === "queued"
        ? await requested.completion
        : requested;
      if (mutation.outcome === "failed") throw mutation.error;
      if (
        workflowLifecycleGenerationRef.current !== lifecycleGeneration ||
        findSearchStateRef.current.operationId !== operationId ||
        workflowResetRequestedRunRef.current === startingSnapshot.runId
      ) {
        return;
      }
      let completed = mutation.snapshot;
      const plannedState = workflowState(completed);
      if (!plannedState || plannedState.mode !== "find") {
        throw new Error(
          "ShockAudit could not read the source-search operation result.",
        );
      }
      const batch = completed.assessmentBatch;
      const requests = Array.isArray(batch?.modelContext.requests)
        ? batch.modelContext.requests
        : [];
      const isDiscoveryPlan = requests.some(
        (request) =>
          typeof request === "object" && request !== null &&
          "mode" in request && request.mode === "find-discovery-plan",
      );
      if (batch && isDiscoveryPlan) {
        if (
          completedToolCallCount >=
            SCREEN_02_FIND_MAX_RETRIEVAL_TOOL_CALLS
        ) {
          markFindSearchContinuationLimit(
            completed,
            operationId,
            startingSnapshot.revision,
          );
          return;
        }
        completionOwner = claimWorkflowMutation("foreground");
        if (!completionOwner) {
          throw new Error(
            "ShockAudit could not retain ownership of the source-search completion.",
          );
        }
        setWorkflowBusy(true);
        const deliveryOperationId = nextScreen02WorkflowOperationId();
        completedToolCallCount += 1;
        completed = await bridge.recordScreen02AssessmentDelivery(
          completed,
          batch.requestIds,
          false,
          deliveryOperationId,
        );
        const completionAttribution =
          bridge.screen02WorkflowOperationAttribution(completed);
        if (
          !screen02MutationAttributionAllowsCommit(
            completionAttribution,
            deliveryOperationId,
            "assessment-delivery",
          )
        ) {
          throw new Error(
            "ShockAudit could not attribute the completed source search to its exact delivery operation. Previous results remain available. [SA-S2-OPERATION-NOT-APPLIED]",
          );
        }
        if (!commitWorkflowSnapshot(completed, { navigate: true })) {
          throw new Error(
            "ShockAudit rejected the source-search planning result.",
          );
        }
        if (releaseWorkflowMutation(completionOwner)) {
          setWorkflowBusy(false);
        }
        completionOwner = null;
      }
      if (
        workflowLifecycleGenerationRef.current !== lifecycleGeneration ||
        (completionOwner !== null &&
          !workflowMutationBelongsTo(completionOwner)) ||
        findSearchStateRef.current.operationId !== operationId ||
        workflowResetRequestedRunRef.current === startingSnapshot.runId
      ) {
        return;
      }
      const continued = await continueFindSearchChunks({
        snapshot: completed,
        startingSnapshot,
        lifecycleGeneration,
        logicalOperationId: operationId,
        startedRevision: startingSnapshot.revision,
        driverOwner,
        completedToolCallCount,
      });
      if (continued.outcome !== "completed") return;
      if (!findSearchDriverMayContinue(
        startingSnapshot,
        lifecycleGeneration,
        operationId,
        driverOwner,
      )) return;
      settleFindSearch(
        continued.snapshot,
        operationId,
        startingSnapshot.revision,
        continued.completedToolCallCount,
      );
    } catch (error) {
      const stale =
        workflowLifecycleGenerationRef.current !== lifecycleGeneration ||
        workflowResetRequestedRunRef.current === startingSnapshot.runId;
      if (
        findSearchStateRef.current.operationId === operationId
      ) {
        updateFindSearchState({
          operationId,
          phase: stale ? "cancelled" : "delivery-failure",
          message: stale
            ? "Search cancelled because this Screen 2 run changed."
            : "The search result could not be safely applied. Previous results remain available.",
          startedRevision: startingSnapshot.revision,
          settledRevision: null,
          visibleCandidateCount: visibleFindCandidateCount(
            workflowState(screen02WorkflowRef.current),
          ),
          errorCode: stale ? "stale-result" : findSearchErrorCode(error),
          recovery: stale
            ? "reset"
            : previousCandidateCount > 0
              ? "preserved-results"
              : "retry",
        });
      }
      if (stale) return;
      setWorkflowNotice({
        status: "error",
        message: screen02VisibleFailureMessage(
          error,
          "ShockAudit could not safely apply the source-backed search result. Previous results remain available.",
        ),
      });
    } finally {
      if (completionOwner !== null) {
        if (releaseWorkflowMutation(completionOwner)) {
          setWorkflowBusy(false);
          if (!drainPendingWorkflowForegroundMutation()) {
            drainPendingWorkflowRefresh();
          }
        }
      } else if (
        workflowLifecycleGenerationRef.current === lifecycleGeneration &&
        findSearchStateRef.current.operationId === operationId &&
        !workflowMutationActiveRef.current
      ) {
        setWorkflowBusy(false);
      }
      releaseFindSearchDriver(startingSnapshot.runId, driverOwner);
    }
  }

  function clearStage1ProofTimeout() {
    if (stage1ProofTimeoutRef.current !== null) {
      window.clearTimeout(stage1ProofTimeoutRef.current);
      stage1ProofTimeoutRef.current = null;
    }
  }

  function commitStage1ProofSnapshot(snapshot: Stage1ProofWidgetSnapshot) {
    stage1ProofSnapshotRef.current = snapshot;
    setStage1ProofSnapshot(snapshot);
    void bridge.saveStage1ProofState(snapshot);
  }

  function scheduleStage1ProofExpiry(
    snapshot: Stage1ProofWidgetSnapshot,
  ) {
    clearStage1ProofTimeout();
    const deadlineBasis =
      snapshot.status === "sending"
        ? snapshot.sendStartedAt
        : snapshot.status === "message-delivered"
          ? snapshot.messageDeliveredAt
          : undefined;
    if (!deadlineBasis) {
      return;
    }
    const requestId = snapshot.open.request.requestId;
    const expiresAt =
      Date.parse(deadlineBasis) + STAGE1_PROOF_TIMEOUT_MS;
    const expire = () => {
      stage1ProofTimeoutRef.current = null;
      const pending = stage1ProofSnapshotRef.current;
      if (
        !pending ||
        pending.open.request.requestId !== requestId ||
        (pending.status !== "sending" &&
          pending.status !== "message-delivered") ||
        pending.result
      ) {
        return;
      }
      stage1PendingResultRef.current = null;
      commitStage1ProofSnapshot({
        ...pending,
        status:
          pending.status === "sending"
            ? "delivery-rejected"
            : "timed-out",
        ...(pending.status === "message-delivered"
          ? { timedOutAt: new Date().toISOString() }
          : {}),
      });
    };
    const remaining = expiresAt - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) {
      expire();
      return;
    }
    stage1ProofTimeoutRef.current = window.setTimeout(expire, remaining);
  }

  function rememberConfirmedBaseline(context: Screen01StudyContext) {
    confirmedBaselineRef.current = context;
  }

  function scheduleScreen02AiReviewTimeout(
    callback: () => void,
    delay: number,
  ) {
    const timeout = window.setTimeout(() => {
      aiReviewTimeoutsRef.current.delete(timeout);
      callback();
    }, delay);
    aiReviewTimeoutsRef.current.add(timeout);
    return timeout;
  }

  function invalidateScreen02() {
    const retiredWorkflow = screen02WorkflowRef.current;
    cancelActiveFindSearch("reset", "scope-invalidated");
    workflowLifecycleGenerationRef.current += 1;
    detachFindSearchDriver();
    retireHostReasoningTasks(
      retiredWorkflow,
      "The researcher changed the confirmed study, so its optional host task is no longer current.",
    );
    void bridge.clearScreen02WorkflowWidgetSnapshot();
    if (retiredWorkflow) {
      void bridge.retireScreen02Workflow(retiredWorkflow).catch((error) => {
        // The client snapshot is cleared immediately so the retired run is no
        // longer reachable here. Canonical expiry remains the deletion
        // backstop if a concurrent writer wins or the host is offline.
        console.warn(
          "ShockAudit could not immediately delete the retired Screen 2 run.",
          error,
        );
      });
    }
    const active = screen02SessionRef.current;
    const pendingMarker = pendingAiReviewMarkerRef.current;
    const activeReviewKey = active
      ? screen02AiReviewRequestKey(active)
      : undefined;
    aiReviewPendingRoundKeysRef.current.clear();
    pendingAiReviewMarkerRef.current = null;
    void bridge.clearScreen02PendingAiReviewMarker(
      pendingMarker?.roundKey ?? activeReviewKey ?? undefined,
      active,
      pendingMarker?.expiresAt,
    );
    confirmedBaselineRef.current = null;
    clearScreen03HostDraftTimeout();
    screen03HostDraftBatchRef.current = null;
    pendingScreen03HostDraftReceiptRef.current = null;
    screen03HostDraftDeliveryAcknowledgedRef.current = false;
    setScreen03HostReasoningStatus("idle");
    screen03HostBriefingBootstrapRef.current = null;
    screen03WorkflowRef.current = null;
    setScreen03Workflow(null);
    setScreen03Error(null);
    screen03OperationActiveRef.current = false;
    setScreen03Busy(false);
    void bridge.clearScreen03WorkflowWidgetSnapshot();
    screen04WorkflowRef.current = null;
    setScreen04Workflow(null);
    void bridge.clearScreen04WorkflowWidgetSnapshot();
    screen02SessionRef.current = null;
    setScreen02Session(null);
    screen02WorkflowRef.current = null;
    setScreen02Workflow(null);
    openedAuditMatchRef.current = null;
    setOpenedAuditMatch(null);
    detachWorkflowMutation();
    cancelPendingWorkflowForegroundMutation(
      "ShockAudit cancelled the queued Screen 2 action because the confirmed study changed.",
    );
    setWorkflowBusy(false);
    pendingWorkflowRefreshRunRef.current = null;
    clearWorkflowTimeouts();
    clearWorkflowPolling();
    setWorkflowNotice(null);
    setResearchNotice(null);
    activeScreenRef.current = 1;
    setActiveScreen(1);
  }

  function releaseExpiredScreen02AiReview(
    marker: Screen02PendingAiReviewMarker,
  ) {
    if (!screen02PendingAiReviewMarkerIsExpired(marker)) {
      scheduleScreen02AiReviewTimeout(
        () => releaseExpiredScreen02AiReview(marker),
        Math.max(1, marker.expiresAt - Date.now()),
      );
      return;
    }
    const active = screen02SessionRef.current;
    if (
      !active ||
      !screen02PendingAiReviewMarkerMatchesSession(marker, active) ||
      !aiReviewPendingRoundKeysRef.current.has(marker.roundKey) ||
      pendingAiReviewMarkerRef.current?.expiresAt !== marker.expiresAt
    ) {
      return;
    }
    if (
      !releaseExpiredScreen02AiReviewClaim(
        aiReviewPendingRoundKeysRef.current,
        marker,
      )
    ) {
      return;
    }
    pendingAiReviewMarkerRef.current = null;
    void bridge.clearScreen02PendingAiReviewMarker(
      marker.roundKey,
      active,
      marker.expiresAt,
    );
      setResearchNotice({
        status: "warning",
        message:
          "The preliminary assessment reached its 120-second delivery limit. That older request may still finish, but Retry is now available.",
    });
  }

  useEffect(
    () => () => {
      for (const timeout of aiReviewTimeoutsRef.current) {
        window.clearTimeout(timeout);
      }
      aiReviewTimeoutsRef.current.clear();
      clearWorkflowTimeouts();
      clearWorkflowPolling();
      clearStage1ProofTimeout();
      clearScreen03HostDraftTimeout();
      for (const controller of hostReasoningReconcilersRef.current.values()) {
        controller.stop();
      }
      hostReasoningReconcilersRef.current.clear();
      pendingScreen02HostResultAcknowledgementRef.current = null;
      paintedScreen02HostResultRef.current = null;
      screen02HostResultMarkerRef.current = null;
      screen02HostResultAcknowledgementInFlightRef.current = null;
    },
    [],
  );

  useEffect(() => {
    activeScreenRef.current = activeScreen;
    if (activeScreen !== 2 && screen02HostResultMarkerRef.current) {
      clearScreen02HostResultReconciliation(
        screen02HostResultMarkerRef.current.operationId,
      );
    }
  }, [activeScreen]);

  useEffect(() => {
    if (
      !hostView.connected ||
      activeScreenRef.current !== 3 ||
      !screen02WorkflowRef.current?.handoff ||
      screen03OperationActiveRef.current
    ) {
      return;
    }
    const child = screen03WorkflowRef.current;
    if (child?.status === "loading") {
      void openScreen03Workflow(screen02WorkflowRef.current, false);
    } else if (
      child?.briefing?.safeRunRef &&
      screen03HistoricalHostBriefingCompatibilityEnabled(child)
    ) {
      void bridge.updateScreen03SafeModelContext(child);
    }
  }, [hostView.connected]);

  useEffect(() => {
    const reconcileVisibleTask = () => {
      if (document.visibilityState === "hidden") return;
      if (activeScreenRef.current === 2 && screen02WorkflowRef.current) {
        void mutateWorkflow("refresh", {}, {
          requestAssessment: false,
          silent: true,
        });
      } else if (
        activeScreenRef.current === 3 &&
        screen02WorkflowRef.current?.handoff
      ) {
        const child = screen03WorkflowRef.current;
        if (child?.status === "loading") {
          void openScreen03Workflow(screen02WorkflowRef.current, false);
        } else if (
          child?.briefing?.safeRunRef &&
          screen03HistoricalHostBriefingCompatibilityEnabled(child)
        ) {
          // Retained historical widgets already own their sealed state. Opening
          // research when the iframe first receives focus races and discards
          // the same click that requests their one visible ChatGPT turn.
          void bridge.updateScreen03SafeModelContext(child);
        } else {
          void openScreen03Workflow(screen02WorkflowRef.current, false);
        }
      }
      if (activeScreenRef.current === 2 || activeScreenRef.current === 3) {
        reconcileHostReasoningTasksForScreen(activeScreenRef.current);
      }
    };
    window.addEventListener("focus", reconcileVisibleTask);
    document.addEventListener("visibilitychange", reconcileVisibleTask);
    return () => {
      window.removeEventListener("focus", reconcileVisibleTask);
      document.removeEventListener("visibilitychange", reconcileVisibleTask);
    };
  }, []);

  useEffect(() => {
    const restored = stage1ProofSnapshotRef.current;
    if (
      restored?.status === "sending" ||
      restored?.status === "message-delivered"
    ) {
      scheduleStage1ProofExpiry(restored);
    }
  }, []);

  function screen02AiReviewBlocksAction(session: Screen02Session) {
    const marker = pendingAiReviewMarkerRef.current;
    if (
      marker &&
      screen02PendingAiReviewMarkerMatchesSession(marker, session) &&
      screen02PendingAiReviewMarkerIsExpired(marker)
    ) {
      releaseExpiredScreen02AiReview(marker);
      return false;
    }
    const claimIsActive = screen02AiReviewClaimBlocksMutation(
      aiReviewPendingRoundKeysRef.current,
      marker,
      session,
    );
    if (!claimIsActive) return false;
    const latestRound = session.interaction.searchRounds.at(-1);
    const rootRound =
      latestRound?.stage === "preliminary-assessment"
        ? session.interaction.searchRounds.find(
            (round) => round.id === latestRound.rootNativeRoundId,
          )
        : latestRound;
    const activeCriterionIds = new Set(
      rootRound?.preferenceCriteriaIds ?? [],
    );
    // Selection and a fresh search remain available while ordinary guidance
    // is generated. Only unresolved strict inclusion/exclusion criteria pause
    // mutations because those criteria determine candidate eligibility.
    return session.interaction.preferences.criteria.some(
      (criterion) =>
        activeCriterionIds.has(criterion.id) &&
        (criterion.kind === "require" || criterion.kind === "avoid"),
    );
  }

  useEffect(() => {
    if (
      storedPendingAiReviewMarker &&
      !matchingRestoredPendingAiReviewMarker
    ) {
      void bridge.clearScreen02PendingAiReviewMarker(
        storedPendingAiReviewMarker.roundKey,
        usableRestoredScreen02,
        storedPendingAiReviewMarker.expiresAt,
      );
      return;
    }
    if (restoredExpiredAiReviewMarker) {
      void bridge.clearScreen02PendingAiReviewMarker(
        restoredExpiredAiReviewMarker.roundKey,
        usableRestoredScreen02,
        restoredExpiredAiReviewMarker.expiresAt,
      );
      return;
    }
    if (!restoredPendingAiReviewMarker) return;
    const delayedNoticeAt =
      restoredPendingAiReviewMarker.expiresAt -
      SCREEN_02_AI_REVIEW_PENDING_TTL_MS +
      SCREEN_02_AI_REVIEW_DELAYED_NOTICE_MS;
    const delayedNoticeTimeout = window.setTimeout(() => {
      const active = screen02SessionRef.current;
      if (
        !active ||
        !screen02PendingAiReviewMarkerMatchesSession(
          restoredPendingAiReviewMarker,
          active,
        ) ||
        !aiReviewPendingRoundKeysRef.current.has(
          restoredPendingAiReviewMarker.roundKey,
        ) ||
        pendingAiReviewMarkerRef.current?.expiresAt !==
          restoredPendingAiReviewMarker.expiresAt
      ) {
        return;
      }
      setResearchNotice({
        status: "pending",
        message: screen02DelayedAssessmentMessage,
      });
    }, Math.max(0, delayedNoticeAt - Date.now()));
    const expiryTimeout = window.setTimeout(
      () =>
        releaseExpiredScreen02AiReview(
          restoredPendingAiReviewMarker,
        ),
      Math.max(
        0,
        restoredPendingAiReviewMarker.expiresAt - Date.now(),
      ),
    );
    return () => {
      window.clearTimeout(delayedNoticeTimeout);
      window.clearTimeout(expiryTimeout);
    };
  }, [
    bridge,
    matchingRestoredPendingAiReviewMarker,
    restoredExpiredAiReviewMarker,
    restoredPendingAiReviewMarker,
    storedPendingAiReviewMarker,
    usableRestoredScreen02,
  ]);

  useEffect(() => {
    void bridge.connect({
      onHostView: (view) => {
        hostViewRef.current = view;
        setHostView(view);
        if (!view.connected && !view.canRequestAiReview) {
          clearWorkflowTimeouts();
          clearWorkflowPolling();
          return;
        }
        const current = screen02WorkflowRef.current;
        if (current && activeScreenRef.current === 2) {
          scheduleWorkflowTimeouts(current);
          scheduleWorkflowPolling(current);
        }
        if (
          view.hostReasoningMode !== "disabled" &&
          (activeScreenRef.current === 2 || activeScreenRef.current === 3)
        ) {
          resumeStoredHostReasoningTasks(activeScreenRef.current);
        }
      },
      onStage1ProofOpen: (open) => {
        const current = stage1ProofSnapshotRef.current;
        if (
          current &&
          current.open.request.requestId !== open.request.requestId
        ) {
          return;
        }
        if (current) return;
        stage1PendingResultRef.current = null;
        commitStage1ProofSnapshot({ open, status: "prepared" });
      },
      onStage1AssessmentResult: (result) => {
        const current = stage1ProofSnapshotRef.current;
        if (!current) return;
        const accepted = acceptStage1AssessmentResult(current, result);
        if (accepted === current) return;
        if (current.status === "sending") {
          // A host may deliver the tool notification before resolving the
          // ui/message request. Hold the receipt until delivery is explicitly
          // acknowledged so Completed never lacks delivery evidence.
          stage1PendingResultRef.current = result;
          return;
        }
        clearStage1ProofTimeout();
        commitStage1ProofSnapshot(accepted);
      },
      onToolState: (state, studyContext) => {
        const current = screen01StateRef.current;
        const adoptInitialToolState = canAdoptInitialScreen01ToolState({
          pending: initialScreen01ToolStatePendingRef.current,
          current,
          activeScreen:
            activeScreenRef.current === 3 || activeScreenRef.current === 4
              ? 2
              : activeScreenRef.current,
          hasConfirmedBaseline: Boolean(confirmedBaselineRef.current),
          hasScreen02Session: Boolean(screen02SessionRef.current),
          hasScreen02Workflow: Boolean(screen02WorkflowRef.current),
        });
        initialScreen01ToolStatePendingRef.current = false;
        if (!adoptInitialToolState) {
          if (state.mode !== current.mode) {
            setDraftsByMode((drafts) => {
              const existingDraft = drafts[state.mode];
              if (
                existingDraft &&
                !shouldAcceptToolState(existingDraft, state)
              ) {
                return drafts;
              }
              return { ...drafts, [state.mode]: state };
            });
            return;
          }
          if (!shouldAcceptToolState(current, state)) return;
        }

        screen01StateRef.current = state;
        if (state.confirmed && studyContext) {
          const activeSession = screen02SessionRef.current;
          const activeCanonicalWorkflow = workflowState();
          if (
            (activeSession &&
              !screen02SessionMatchesBaseline(
                activeSession,
                studyContext,
              )) ||
            (activeCanonicalWorkflow &&
              !sameDeterministicJson(
                activeCanonicalWorkflow.screen01Baseline,
                studyContext,
              ))
          ) {
            invalidateScreen02();
          }
          rememberConfirmedBaseline(studyContext);
        } else if (!state.confirmed) {
          invalidateScreen02();
        }
        setScreen01State(state);
        setStateRevision((revision) => revision + 1);
        setDraftsByMode((drafts) => ({
          ...drafts,
          [state.mode]: state,
        }));
      },
      onScreen02WorkflowSnapshot: (snapshot) => {
        const hadCurrentWorkflow = Boolean(screen02WorkflowRef.current);
        let state: Screen02WorkflowState;
        try {
          state = stateFromScreen02WorkflowClientSnapshot(snapshot);
        } catch {
          return;
        }
        if (workflowMutationActiveRef.current) {
          const current = screen02WorkflowRef.current;
          if (
            current && current.runId === snapshot.runId &&
            current.mode === snapshot.mode
          ) {
            pendingWorkflowRefreshRunRef.current = current.runId;
          }
          return;
        }
        if (!confirmedBaselineRef.current) {
          if (
            workflowLifecycleGenerationRef.current > 0 ||
            screen02WorkflowRef.current ||
            !sameDeterministicJson(
              screen01StateRef.current,
              createInitialState(),
            )
          ) {
            return;
          }
          const baseline = JSON.parse(
            JSON.stringify(state.screen01Baseline),
          ) as Screen01StudyContext;
          try {
            requireReadyScreen01Context(baseline);
          } catch {
            return;
          }
          rememberConfirmedBaseline(baseline);
          const restoredState = stateFromBaseline(baseline);
          screen01StateRef.current = restoredState;
          setScreen01State(restoredState);
          setStateRevision((revision) => revision + 1);
          setDraftsByMode((drafts) => ({
            ...drafts,
            [restoredState.mode]: restoredState,
          }));
        }
        const committed = commitWorkflowSnapshot(snapshot, {
          navigate: hadCurrentWorkflow
            ? activeScreenRef.current === 2
            : true,
        });
        if (committed) {
          scheduleWorkflowTimeouts(snapshot);
          scheduleWorkflowPolling(snapshot);
          reconcileRestoredFindSearch(snapshot);
          if (
            !hadCurrentWorkflow &&
            activeScreenRef.current === 2 &&
            snapshot.assessmentBatch
          ) {
            void requestWorkflowAssessment(snapshot);
          }
        }
      },
      onScreen02WorkflowReceipt: (receipt) => {
        const current = screen02WorkflowRef.current;
        if (
          !current ||
          current.runId !== receipt.runId ||
          current.mode !== receipt.mode
        ) {
          return;
        }
        if (workflowMutationActiveRef.current) {
          pendingWorkflowRefreshRunRef.current = receipt.runId;
        } else {
          void mutateWorkflow("refresh", {}, {
            requestAssessment: true,
          });
        }
      },
      onScreen03HostDraftReceipt: (receipt) => {
        const batch = screen03HostDraftBatchRef.current;
        if (
          !batch ||
          batch.requestId !== receipt.requestId ||
          screen02WorkflowRef.current?.runId !== receipt.runId
        ) {
          return;
        }
        if (!screen03HostDraftDeliveryAcknowledgedRef.current) {
          const pending = pendingScreen03HostDraftReceiptRef.current;
          if (
            !pending ||
            (pending.disposition === receipt.disposition &&
              pending.reason === receipt.reason)
          ) {
            pendingScreen03HostDraftReceiptRef.current = receipt;
          }
          return;
        }
        void acceptScreen03HostDraftReceipt(receipt);
      },
      onScreen02Session: (session) => {
        if (screen02WorkflowRef.current) return;
        let activeBaseline = confirmedBaselineRef.current;
        if (!activeBaseline) {
          // Standards-only hosts may deliver the mounting Screen 2 result only
          // after ui/initialize. Adopt its validated baseline only while the
          // local Screen 1 workspace is still pristine; never replace a draft
          // the researcher has already started editing.
          if (
            screen02SessionRef.current ||
            !sameDeterministicJson(
              screen01StateRef.current,
              createInitialState(),
            )
          ) {
            return;
          }
          try {
            activeBaseline = requireReadyScreen01Context(
              session.screen01Baseline as Screen01StudyContext,
            );
          } catch {
            return;
          }
          rememberConfirmedBaseline(activeBaseline);
          const restoredState = stateFromBaseline(activeBaseline);
          screen01StateRef.current = restoredState;
          setScreen01State(restoredState);
          setStateRevision((revision) => revision + 1);
          setDraftsByMode((drafts) => ({
            ...drafts,
            [restoredState.mode]: restoredState,
          }));
        }
        if (
          !screen02SessionMatchesBaseline(session, activeBaseline)
        ) {
          return;
        }
        const current = screen02SessionRef.current;
        if (
          current &&
          (current.screen01Fingerprint !==
            session.screen01Fingerprint ||
            current.runId !== session.runId ||
            !sameDeterministicJson(
              current.screen01Baseline,
              session.screen01Baseline,
            ))
        ) {
          return;
        }
        if (current && session.revision < current.revision) {
          return;
        }
        if (
          current?.interaction.pendingRequest &&
          !screen02SessionReconcilesPendingRequest(current, session)
        ) {
          return;
        }
        if (
          current?.lockedChoice &&
          (!session.lockedChoice ||
            session.lockedChoice.itemId !==
              current.lockedChoice.itemId)
        ) {
          return;
        }
        if (
          current &&
          session.revision === current.revision &&
          !sameDeterministicJson(session, current)
        ) {
          return;
        }
        screen02SessionRef.current = session;
        setScreen02Session(session);
        activeScreenRef.current = 2;
        setActiveScreen(2);
        const completedAiReview =
          screen02HasCompletedAiReview(session);
        const completedPendingRequest =
          current?.interaction.pendingRequest &&
          session.revision >=
            current.interaction.pendingRequest.expectedRevision &&
          session.interaction.pendingRequest === null;
        const latestRound = session.interaction.searchRounds.at(-1);
        if (
          (latestRound?.stage === "preliminary-assessment" &&
            latestRound.rootNativeRoundId) ||
          (latestRound?.stage === "ai-review" && latestRound.parentRoundId)
        ) {
          const rootRoundId =
            latestRound.stage === "preliminary-assessment"
              ? latestRound.rootNativeRoundId!
              : latestRound.parentRoundId!;
          const parentRound = session.interaction.searchRounds.find(
            (round) => round.id === rootRoundId,
          );
          if (parentRound) {
            // The marker keys the exact session revision sent for review.
            // Selection/rejection history can advance that revision after the
            // native parent round, while the accepted AI child advances it
            // exactly once more.
            const completedReviewKey = `${session.runId}:${rootRoundId}:${latestRound.revision - 1}`;
            const completedMarker = pendingAiReviewMarkerRef.current;
            aiReviewPendingRoundKeysRef.current.delete(completedReviewKey);
            if (completedMarker?.roundKey === completedReviewKey) {
              pendingAiReviewMarkerRef.current = null;
            }
            void bridge.clearScreen02PendingAiReviewMarker(
              completedReviewKey,
              session,
              completedMarker?.roundKey === completedReviewKey
                ? completedMarker.expiresAt
                : undefined,
            );
          }
        }
        const nativeReviewKey = screen02AiReviewRequestKey(session);
        setResearchNotice((priorNotice) =>
          nativeReviewKey &&
          aiReviewPendingRoundKeysRef.current.has(nativeReviewKey) &&
          priorNotice?.status === "pending"
            ? priorNotice
            : session.interaction.pendingScopeRevision
            ? {
                status: "warning",
                message:
                  "The authoritative response requires a Screen 1 scope revision before Screen 2 can continue.",
              }
            : completedPendingRequest
              ? {
                  status: "success",
                  message:
                    "The pending request was reconciled with this authoritative Screen 2 revision.",
                }
              : completedAiReview
                ? {
                  status: "success",
                  message:
                    "Preliminary assessments are complete. Compare each candidate's study fit, outcome path, concern, evidence, and next checks, then choose the shock to verify.",
                  }
              : {
                  status: "success",
                  message:
                    "Candidate records received. Review the evidence, unknowns, and search limitations before choosing one.",
                },
        );
        void bridge.syncScreen02Workspace(session);
      },
    });
    return () => {
      clearScreen03HostDraftTimeout();
      bridge.disconnect();
    };
  }, [bridge]);

  useEffect(() => {
    const current = screen02WorkflowRef.current;
    if (!hostView.connected || !current) return;
    if (workflowRestorationRefreshRef.current === current.runId) return;
    workflowRestorationRefreshRef.current = current.runId;
    void (async () => {
      const refreshed = await mutateWorkflow("refresh", {}, {
        requestAssessment: activeScreenRef.current === 2,
        restoration: true,
      });
      const completion = refreshed.outcome === "queued"
        ? await refreshed.completion
        : refreshed;
      if (completion.outcome === "committed") {
        reconcileRestoredFindSearch(completion.snapshot);
      }
    })();
  }, [hostView.connected]);

  async function requestStage1ProofAssessment() {
    const current = stage1ProofSnapshotRef.current;
    if (!current) return;

    if (
      ["rejected", "delivery-rejected", "timed-out"].includes(
        current.status,
      )
    ) {
      clearStage1ProofTimeout();
      stage1PendingResultRef.current = null;
      try {
        const output = await bridge.callTool<Record<string, unknown>>(
          "open_stage1_assessment_proof",
          {},
        );
        if (!isStage1ProofOpenResult(output)) {
          throw new Error("The proof opener returned an invalid packet.");
        }
        commitStage1ProofSnapshot({ open: output, status: "prepared" });
      } catch (error) {
        console.warn(
          "ShockAudit could not prepare a fresh Stage 1 proof request.",
          error,
        );
      }
      return;
    }

    if (current.status !== "prepared") return;
    const requestId = current.open.request.requestId;
    stage1PendingResultRef.current = null;
    const sendingSnapshot: Stage1ProofWidgetSnapshot = {
      ...current,
      status: "sending",
      sendStartedAt: new Date().toISOString(),
    };
    commitStage1ProofSnapshot(sendingSnapshot);
    scheduleStage1ProofExpiry(sendingSnapshot);
    const delivered = await bridge.requestStage1ProofAssessment(
      current.open,
    );
    const latest = stage1ProofSnapshotRef.current;
    if (
      !latest ||
      latest.open.request.requestId !== requestId ||
      latest.status !== "sending"
    ) {
      return;
    }
    if (!delivered) {
      stage1PendingResultRef.current = null;
      commitStage1ProofSnapshot({
        ...latest,
        status: "delivery-rejected",
      });
      return;
    }

    const deliveredSnapshot: Stage1ProofWidgetSnapshot = {
      ...latest,
      status: "message-delivered",
      messageDeliveredAt: new Date().toISOString(),
    };
    const pendingResult = stage1PendingResultRef.current;
    stage1PendingResultRef.current = null;
    const resolvedSnapshot = pendingResult
      ? acceptStage1AssessmentResult(deliveredSnapshot, pendingResult)
      : deliveredSnapshot;
    commitStage1ProofSnapshot(resolvedSnapshot);
    if (resolvedSnapshot.status === "message-delivered") {
      scheduleStage1ProofExpiry(resolvedSnapshot);
    } else {
      clearStage1ProofTimeout();
    }
  }

  async function saveState(state: Screen01State, ambiguities: Ambiguity[]) {
    // Screen 1 briefly mounts its default draft before the host supplies the
    // opening workspace. Its timer/unmount callback must not publish that
    // placeholder, or replace a newer canonical scope after hydration.
    if (
      (initialScreen01ToolStatePendingRef.current &&
        sameDeterministicJson(state, createInitialState())) ||
      !sameDeterministicJson(state, screen01StateRef.current)
    ) {
      return;
    }
    const rebuiltStudyContext = buildScreen01StudyContext(
      state,
      ambiguities,
    );
    const preservedBaseline = confirmedBaselineRef.current;
    const studyContext =
      state.confirmed &&
      preservedBaseline &&
      sameContextWithProducer(rebuiltStudyContext, preservedBaseline)
        ? preservedBaseline
        : rebuiltStudyContext;
    const snapshot = {
      state,
      draftsByMode: { ...draftsByMode, [state.mode]: state },
      ambiguities,
      studyContext,
    };
    await bridge.syncWorkspace(
      snapshot,
      scopeContextMarkdown(studyContext),
    );
  }

  async function confirmState(
    state: Screen01State,
  ): Promise<ConfirmScopeResult> {
    initialScreen01ToolStatePendingRef.current = false;
    const localResult = confirmScopeContract(state);
    if (!hostView.connected) {
      if (localResult.ok) {
        rememberConfirmedBaseline(
          buildScreen01StudyContext(
            localResult.state,
            localResult.ambiguities,
          ),
        );
      }
      return localResult;
    }

    try {
      const serverResult = await bridge.callTool<ConfirmToolOutput>(
        "confirm_scope_contract",
        {
          revision: state.revision,
          mode: state.mode,
          sentence: state.sentence,
          contractSourceSentence: state.contractSourceSentence,
          scope: state.scope,
          knownShock: state.knownShock,
          resolvedKeys: state.resolvedKeys,
          acknowledgedDifferences: state.acknowledgedDifferences ?? [],
          scopeDirty: state.scopeDirty,
        },
      );
      if (serverResult?.ok) {
        const preserved = requireReadyScreen01Context(
          serverResult.studyContext,
        );
        const rebuilt = buildScreen01StudyContext(
          serverResult.state,
          serverResult.ambiguities,
        );
        if (!sameContextWithProducer(rebuilt, preserved)) {
          throw new Error(
            "The Screen 1 server context did not exactly match its confirmed state.",
          );
        }
        rememberConfirmedBaseline(preserved);
        return serverResult;
      }
      if (serverResult) return serverResult;
    } catch (error) {
      console.warn("Server confirmation unavailable.", error);
    }

    return {
      ...localResult,
      ok: false,
      error:
        "The deployed ShockAudit server could not verify this scope. Your draft is safe; please try again before continuing.",
      state: { ...localResult.state, confirmed: false },
    };
  }

  async function openNextScreen(
    context: Screen01StudyContext,
    options?: {
      forceNew?: boolean;
      initialState?: "standard" | "blank";
    },
  ) {
    const confirmed = confirmedBaselineRef.current;
    const preserved =
      confirmed &&
      sameContextWithProducer(context, confirmed)
        ? confirmed
        : context;
    const ready = requireReadyScreen01Context(preserved);
    rememberConfirmedBaseline(ready);
    const resumableSnapshot = screen02WorkflowRef.current;
    const resumableState = workflowState(resumableSnapshot);
    if (
      !options?.forceNew &&
      resumableSnapshot &&
      resumableState &&
      sameDeterministicJson(resumableState.screen01Baseline, ready)
    ) {
      activeScreenRef.current = 2;
      setActiveScreen(2);
      setWorkflowOpenStatus("idle");
      saveWorkflowWidget(
        resumableSnapshot,
        2,
        openedAuditMatchRef.current,
      );
      scheduleWorkflowTimeouts(resumableSnapshot);
      scheduleWorkflowPolling(resumableSnapshot);
      setWorkflowNotice({
        status: "success",
        message:
          "Resumed the existing Screen 2 run with its results, decisions, and assessment progress intact.",
      });
      reconcileRestoredFindSearch(resumableSnapshot);
      return true;
    }
    const retiredMarker = pendingAiReviewMarkerRef.current;
    aiReviewPendingRoundKeysRef.current.clear();
    pendingAiReviewMarkerRef.current = null;
    if (hostView.connected) {
      const lifecycleGeneration = workflowLifecycleGenerationRef.current;
      const openOwner = claimWorkflowMutation("foreground");
      if (!openOwner) return false;
      setWorkflowOpenStatus("opening");
      activeScreenRef.current = 2;
      setActiveScreen(2);
      setWorkflowBusy(true);
      setWorkflowNotice({
        status: "info",
        message: "Creating an isolated canonical Screen 2 run…",
      });
      try {
        const snapshot = await bridge.openScreen02Workflow(
          ready,
          options?.initialState ?? "standard",
        );
        if (
          workflowLifecycleGenerationRef.current !== lifecycleGeneration ||
          !workflowMutationBelongsTo(openOwner)
        ) {
          throw new Error(
            "ShockAudit ignored a Screen 2 opener for a retired study boundary.",
          );
        }
        if (
          !commitWorkflowSnapshot(snapshot, {
            allowNewRun: true,
            openedMatchSnapshotId: null,
            navigate: activeScreenRef.current === 2,
          })
        ) {
          throw new Error(
            "ShockAudit rejected the new Screen 2 run because it did not preserve the confirmed study.",
          );
        }
        clearWorkflowTimeouts();
        clearWorkflowPolling();
        workflowRestorationRefreshRef.current = snapshot.runId;
        setResearchNotice(null);
        setWorkflowNotice({
          status: "success",
          message:
            snapshot.mode === "find"
              ? "Screen 2 Find is ready for a bounded factual search."
              : options?.initialState === "blank"
                ? "Screen 2 Audit reset to the exact named-shock anchor and is ready for a fresh identity search."
              : "Screen 2 Audit preserved the exact anchor and found possible identity records for review.",
        });
        setWorkflowOpenStatus("idle");
        if (releaseWorkflowMutation(openOwner)) {
          setWorkflowBusy(false);
          if (snapshot.assessmentBatch) {
            void requestWorkflowAssessment(snapshot);
          } else {
            drainPendingWorkflowRefresh();
          }
        }
        return true;
      } catch (error) {
        const failure =
          error instanceof Error
            ? error
            : new Error(
                "ShockAudit could not create the canonical Screen 2 run.",
              );
        if (
          workflowLifecycleGenerationRef.current !== lifecycleGeneration ||
          !workflowMutationBelongsTo(openOwner)
        ) {
          throw failure;
        }
        setWorkflowNotice({
          status: "error",
          message: screen02VisibleFailureMessage(
            failure,
            "ShockAudit could not safely open Screen 2. The confirmed study remains available.",
          ),
        });
        setWorkflowOpenStatus("failed");
        if (releaseWorkflowMutation(openOwner)) {
          setWorkflowBusy(false);
          drainPendingWorkflowRefresh();
        }
        throw failure;
      }
    }

    // Standalone development has no durable owner. Keep the old local capsule
    // view available for inspection, but production mutations require the
    // connected canonical v2.1 path above.
    const runId = nextScreen02RunId();
    const session = createScreen02Session(ready, runId);
    void bridge.clearScreen02PendingAiReviewMarker(
      retiredMarker?.roundKey,
      session,
      retiredMarker?.expiresAt,
    );
    screen02SessionRef.current = session;
    setScreen02Session(session);
    setWorkflowOpenStatus("idle");
    activeScreenRef.current = 2;
    setActiveScreen(2);
    setResearchNotice({
      status: "warning",
      message:
        "This standalone view is read-only. Open ShockAudit in a connected workspace to start an updated Screen 2 run.",
    });
    void bridge.syncScreen02Workspace(session);
    return true;
  }

  function updateScreen01State(
    update: SetStateAction<Screen01State>,
  ) {
    initialScreen01ToolStatePendingRef.current = false;
    if (typeof update === "function") {
      const current = screen01StateRef.current;
      const next = update(current);
      if (!sameDeterministicJson(current, next)) {
        invalidateScreen02();
      }
      screen01StateRef.current = next;
      setScreen01State(next);
      return;
    }
    const confirmedBaseline = confirmedBaselineRef.current;
    if (
      !update.confirmed ||
      !confirmedBaseline ||
      !screen01StateMatchesBaseline(update, confirmedBaseline)
    ) {
      invalidateScreen02();
    }
    screen01StateRef.current = update;
    setScreen01State(update);
  }

  function selectScreen02(id: string) {
    const current = screen02SessionRef.current;
    if (
      !current ||
      current.interaction.pendingRequest ||
      screen02AiReviewBlocksAction(current)
    ) {
      return;
    }
    try {
      const selected = selectScreen02Item(current, id);
      screen02SessionRef.current = selected;
      setScreen02Session(selected);
      setResearchNotice({
        status: "info",
        message:
          "Chosen shock recorded. Review its evidence and uncertainties before continuing to event verification.",
      });
      void bridge.syncScreen02Workspace(selected);
    } catch (error) {
      setResearchNotice({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "ShockAudit could not select this option.",
      });
    }
  }

  function rejectScreen02(id: string, reason: string) {
    const current = screen02SessionRef.current;
    if (
      !current ||
      current.interaction.pendingRequest ||
      screen02AiReviewBlocksAction(current)
    ) {
      return;
    }
    try {
      const next = rejectScreen02Item(current, id, reason);
      screen02SessionRef.current = next;
      setScreen02Session(next);
      setResearchNotice({
        status: "info",
        message: "The option remains in the audit history as rejected.",
      });
      void bridge.syncScreen02Workspace(next);
    } catch (error) {
      setResearchNotice({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "ShockAudit could not reject this option.",
      });
    }
  }

  function lockScreen02() {
    const current = screen02SessionRef.current;
    if (
      !current ||
      current.interaction.pendingRequest ||
      screen02AiReviewBlocksAction(current)
    ) {
      return;
    }
    if (!screen02HasCompletedAiReview(current)) {
      setResearchNotice({
        status: "warning",
        message:
          "Finish the preliminary assessment for every displayed shock before continuing. You can still choose an option or run another search while ordinary assessments are in progress.",
      });
      return;
    }
    try {
      const next = lockScreen02Choice(current);
      // Build the versioned downstream contract before accepting the lock in
      // UI state. This keeps Find and Audit subject to the same Screen 3 gate.
      buildScreen02ToScreen03Handoff(next);
      // Also prove that the exact state capsule plus compact handoff fits the
      // bounded host context before reporting a successful handoff.
      assertScreen02ModelContextFits(next);
      screen02SessionRef.current = next;
      setScreen02Session(next);
      setResearchNotice({
        status: "success",
        message:
          "The chosen shock is ready for event verification. Event facts, exposure construction, and design validity remain provisional.",
      });
      void bridge.syncScreen02Workspace(next);
    } catch (error) {
      setResearchNotice({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "ShockAudit could not confirm this choice.",
      });
    }
  }

  function unlockScreen02(reason: string) {
    if (!screen02Session) return;
    const next = unlockScreen02Choice(screen02Session, reason);
    screen02SessionRef.current = next;
    setScreen02Session(next);
    setResearchNotice({
      status: "warning",
      message:
        "The earlier choice remains in the audit history, and the next verification step was cleared.",
    });
    void bridge.syncScreen02Workspace(next);
  }

  async function resetScreen02Workflow() {
    const requestedWorkflow = screen02WorkflowRef.current;
    const requestedState = workflowState(requestedWorkflow);
    if (!requestedWorkflow || !requestedState) return;
    if (
      workflowResetRequestedRunRef.current === requestedWorkflow.runId
    ) {
      return;
    }
    const requestedRunId = requestedWorkflow.runId;
    workflowResetRequestedRunRef.current = requestedRunId;
    cancelActiveFindSearch("reset", "reset-requested");
    // Detach any old in-flight request immediately. Its generation check will
    // discard a late result, while the replacement opener can proceed without
    // waiting on a hung host call.
    workflowLifecycleGenerationRef.current += 1;
    detachFindSearchDriver();
    const resetLifecycleGeneration = workflowLifecycleGenerationRef.current;
    const resetStillOwnsLifecycle = () =>
      workflowLifecycleGenerationRef.current === resetLifecycleGeneration &&
      workflowResetRequestedRunRef.current === requestedRunId;
    detachWorkflowMutation();
    cancelPendingWorkflowForegroundMutation(
      "ShockAudit cancelled the queued Screen 2 action because Reset Screen 2 started.",
    );
    setWorkflowBusy(false);
    pendingWorkflowRefreshRunRef.current = null;
    clearWorkflowTimeouts();
    clearWorkflowPolling();
    setWorkflowNotice({
      status: "info",
      message:
        "Starting a blank replacement while preserving the confirmed Screen 1 study…",
    });
    let replacementReady = false;
    try {
      const retiredWorkflow = screen02WorkflowRef.current;
      const state = workflowState(retiredWorkflow);
      if (
        !retiredWorkflow ||
        !state ||
        retiredWorkflow.runId !== requestedRunId
      ) {
        return;
      }
      const baseline = JSON.parse(
        JSON.stringify(state.screen01Baseline),
      ) as Screen01StudyContext;
      clearWorkflowTimeouts();
      clearWorkflowPolling();
      let replaced = false;
      try {
        replaced = await openNextScreen(baseline, {
          forceNew: true,
          initialState: "blank",
        });
      } catch (error) {
        if (!resetStillOwnsLifecycle()) return;
        // The original run remains canonical when replacement creation fails.
        // Restore its lifecycle and leave an actionable retry in place.
        const retained = screen02WorkflowRef.current;
        if (retained?.runId === requestedRunId) {
          setWorkflowOpenStatus("idle");
          setWorkflowNotice({
            status: "error",
            message: `${
              error instanceof Error
                ? error.message
                : "ShockAudit could not create the blank replacement."
            } The existing Screen 2 run is unchanged; retry Reset Screen 2.`,
          });
          scheduleWorkflowTimeouts(retained);
          scheduleWorkflowPolling(retained);
        }
        return;
      }
      if (!resetStillOwnsLifecycle()) return;
      if (!replaced) {
        const retained = screen02WorkflowRef.current;
        if (retained?.runId === requestedRunId) {
          setWorkflowOpenStatus("idle");
          setWorkflowNotice({
            status: "error",
            message:
              "ShockAudit could not create the blank replacement. The existing Screen 2 run is unchanged; retry Reset Screen 2.",
          });
          scheduleWorkflowTimeouts(retained);
          scheduleWorkflowPolling(retained);
        }
        return;
      }
      replacementReady = true;
      clearScreen03HostDraftTimeout();
      screen03HostDraftBatchRef.current = null;
      pendingScreen03HostDraftReceiptRef.current = null;
      screen03HostDraftDeliveryAcknowledgedRef.current = false;
      setScreen03HostReasoningStatus("idle");
      screen03HostBriefingBootstrapRef.current = null;
      screen03WorkflowRef.current = null;
      setScreen03Workflow(null);
      setScreen03Error(null);
      void bridge.clearScreen03WorkflowWidgetSnapshot();
      screen04WorkflowRef.current = null;
      setScreen04Workflow(null);
      void bridge.clearScreen04WorkflowWidgetSnapshot();
      try {
        const retirement = await bridge.retireScreen02Workflow(
          retiredWorkflow,
        );
        if (!resetStillOwnsLifecycle()) return;
        if (retirement.outcome === "conflict") {
          setWorkflowNotice({
            status: "warning",
            message:
              "The fresh Screen 2 run is ready. A concurrent update prevented immediate deletion of the prior run, which is now unreachable here and will expire automatically.",
          });
        }
      } catch (error) {
        if (!resetStillOwnsLifecycle()) return;
        console.warn(
          "ShockAudit could not immediately delete the replaced Screen 2 run.",
          error,
        );
        setWorkflowNotice({
          status: "warning",
          message:
            "The fresh Screen 2 run is ready. The prior run is unreachable here and remains scheduled for automatic expiry.",
        });
      }
    } finally {
      if (resetStillOwnsLifecycle()) {
        workflowResetRequestedRunRef.current = null;
      }
      if (
        workflowLifecycleGenerationRef.current === resetLifecycleGeneration &&
        !replacementReady
      ) {
        const retained = screen02WorkflowRef.current;
        if (retained?.runId === requestedRunId) {
          scheduleWorkflowTimeouts(retained);
          scheduleWorkflowPolling(retained);
        }
      }
    }
  }

  function editStudyFromWorkflow() {
    const current = screen02WorkflowRef.current;
    const state = workflowState(current);
    if (!current || !state) return;
    activeScreenRef.current = 1;
    setActiveScreen(1);
    clearWorkflowTimeouts();
    clearWorkflowPolling();
    setWorkflowOpenStatus("idle");
    setWorkflowNotice(null);
    saveWorkflowWidget(current, 1, openedAuditMatchRef.current);
    if (screen03WorkflowRef.current) {
      saveScreen03Widget(screen03WorkflowRef.current, 2);
    }
    if (screen04WorkflowRef.current) {
      saveScreen04Widget(screen04WorkflowRef.current, 3);
    }
    void bridge.updateModelContext(
      scopeContextMarkdown(
        JSON.parse(
          JSON.stringify(state.screen01Baseline),
        ) as Screen01StudyContext,
      ),
      JSON.parse(JSON.stringify(state.screen01Baseline)) as Screen01StudyContext,
    );
  }

  async function resetScreen02() {
    const current = screen02SessionRef.current;
    if (!current) return;
    const retiredMarker = pendingAiReviewMarkerRef.current;
    aiReviewPendingRoundKeysRef.current.clear();
    pendingAiReviewMarkerRef.current = null;
    const restarted = restartScreen02Session(
      current,
      nextScreen02RunId(),
    );
    screen02SessionRef.current = restarted;
    setScreen02Session(restarted);
    setResearchNotice({
      status: "success",
      message:
        "Screen 2 was reset to a blank search. Its criteria, results, review, and choice were cleared; the confirmed Screen 1 boundary is unchanged.",
    });
    await bridge.clearScreen02PendingAiReviewMarker(
      retiredMarker?.roundKey,
      restarted,
      retiredMarker?.expiresAt,
    );
    await bridge.syncScreen02Workspace(restarted);
  }

  async function requestScreen02AiReviewOnce(
    authoritative: Screen02Session,
    exactRequest: string,
    criteria: Screen02PreferenceDraft[],
    requestRunId: string,
    purpose: "interpretation" | "coverage-expansion" = "interpretation",
    requestedCandidateIds?: readonly string[],
  ) {
    if (
      !screen02AiReviewRequestKey(authoritative) ||
      authoritative.runId !== requestRunId
    ) {
      return;
    }
    if (!hostView.canRequestAiReview) {
      setResearchNotice({
        status: "warning",
        message:
          "The preliminary assessment is unavailable in this view. Source-backed factual cards remain usable for screening, but they are not finished assessments; any strict criteria remain unresolved.",
      });
      return;
    }

    const reviewKey = claimScreen02AiReviewRequest(
      aiReviewPendingRoundKeysRef.current,
      authoritative,
    );
    if (!reviewKey) return;
    let installedReviewMarker: Screen02PendingAiReviewMarker | null = null;
    setResearchNotice({
      status: "pending",
      message:
        purpose === "coverage-expansion"
          ? "A bounded source-expansion assessment is checking uncovered jurisdiction- and language-specific routes. The factual cards remain usable while it finishes; unresolved strict criteria still pause choosing."
          : "A concise preliminary assessment is being prepared for each candidate. The factual cards remain visible while it finishes.",
    });
    const releaseStaleReviewClaim = async () => {
      aiReviewPendingRoundKeysRef.current.delete(reviewKey);
      if (installedReviewMarker) {
        if (
          pendingAiReviewMarkerRef.current?.expiresAt ===
          installedReviewMarker.expiresAt
        ) {
          pendingAiReviewMarkerRef.current = null;
        }
        const cleared = await bridge.clearScreen02PendingAiReviewMarker(
          reviewKey,
          screen02SessionRef.current,
          installedReviewMarker.expiresAt,
        );
        if (!cleared) return;
      }
      setResearchNotice((notice) =>
        notice?.status === "pending" &&
        /\b(?:AI|interpretation|assessment|sources?|source[- ]expansion)\b/i.test(
          notice.message,
        )
          ? {
              status: "warning",
              message:
                "The preliminary assessment was cancelled because Screen 2 changed. The current source-backed results remain usable as factual screening records.",
            }
          : notice,
      );
    };
    await bridge.syncScreen02Workspace(authoritative);
    const afterSync = screen02SessionRef.current;
    if (
      afterSync?.runId !== requestRunId ||
      afterSync.revision !== authoritative.revision
    ) {
      await releaseStaleReviewClaim();
      return;
    }
    const persistedMarker =
      await bridge.persistScreen02PendingAiReviewMarker(
        authoritative,
        purpose,
      );
    if (!persistedMarker || persistedMarker.roundKey !== reviewKey) {
      aiReviewPendingRoundKeysRef.current.delete(reviewKey);
      const existingMarker =
        bridge.getInitialScreen02PendingAiReviewMarker();
      if (
        existingMarker &&
        !screen02PendingAiReviewMarkerIsExpired(existingMarker) &&
        screen02PendingAiReviewMarkerMatchesSession(
          existingMarker,
          authoritative,
        )
      ) {
        pendingAiReviewMarkerRef.current = existingMarker;
        aiReviewPendingRoundKeysRef.current.add(existingMarker.roundKey);
        setResearchNotice({
          status: "pending",
          message:
            "A preliminary assessment is already pending for this result set. ShockAudit will not submit a duplicate request.",
        });
      } else {
        setResearchNotice({
          status: "warning",
          message:
            "ShockAudit could not establish a safe assessment delivery marker, so it did not submit the request. Retry is available.",
        });
      }
      return;
    }
    installedReviewMarker = persistedMarker;
    pendingAiReviewMarkerRef.current = persistedMarker;
    scheduleScreen02AiReviewTimeout(() => {
      const active = screen02SessionRef.current;
      if (
        active?.runId !== requestRunId ||
        active.revision !== authoritative.revision ||
        !aiReviewPendingRoundKeysRef.current.has(reviewKey) ||
        pendingAiReviewMarkerRef.current?.expiresAt !==
          persistedMarker.expiresAt
      ) {
        return;
      }
      setResearchNotice({
        status: "pending",
        message: screen02DelayedAssessmentMessage,
      });
    }, SCREEN_02_AI_REVIEW_DELAYED_NOTICE_MS);
    scheduleScreen02AiReviewTimeout(
      () => releaseExpiredScreen02AiReview(persistedMarker),
      Math.max(0, persistedMarker.expiresAt - Date.now()),
    );
    const afterMarkerPersist = screen02SessionRef.current;
    if (
      afterMarkerPersist?.runId !== requestRunId ||
      afterMarkerPersist.revision !== authoritative.revision
    ) {
      await releaseStaleReviewClaim();
      return;
    }
    const sent = await bridge.requestScreen02AiReview(
      authoritative,
      exactRequest,
      criteria,
      () => {
        const active = screen02SessionRef.current;
        return (
          active?.runId === requestRunId &&
          active.revision === authoritative.revision
        );
      },
      purpose,
      requestedCandidateIds,
    );
    const afterAiRequest = screen02SessionRef.current;
    if (
      afterAiRequest?.runId !== requestRunId ||
      afterAiRequest.revision !== authoritative.revision
    ) {
      await releaseStaleReviewClaim();
      return;
    }
    if (screen02PendingAiReviewMarkerIsExpired(persistedMarker)) {
      releaseExpiredScreen02AiReview(persistedMarker);
      return;
    }
    if (!sent) {
      aiReviewPendingRoundKeysRef.current.delete(reviewKey);
      if (
        pendingAiReviewMarkerRef.current?.expiresAt ===
        persistedMarker.expiresAt
      ) {
        pendingAiReviewMarkerRef.current = null;
      }
      await bridge.clearScreen02PendingAiReviewMarker(
        reviewKey,
        afterAiRequest,
        persistedMarker.expiresAt,
      );
    }
    setResearchNotice(
      sent
        ? {
            status: "pending",
            message:
              purpose === "coverage-expansion"
                ? "Targeted source expansion was requested. Retrieved facts remain visible while additional routes are checked."
                : "Preliminary assessments are in progress. Retrieved facts remain visible while each candidate is evaluated.",
          }
        : {
            status: "warning",
            message:
              "The preliminary assessment request could not start. Source-backed factual results remain available for screening; strict criteria are still unresolved.",
        },
    );
  }

  async function requestScreen02Search(
    requestType: "find-more" | "refine" | "none-fit",
    exactRequest: string,
    criteria: Screen02PreferenceDraft[],
    followUpPurpose: "coverage-expansion" | null = null,
  ) {
    const current = screen02SessionRef.current;
    if (
      !current ||
      current.interaction.pendingRequest ||
      current.interaction.pendingScopeRevision ||
      current.lockedChoice ||
      screen02AiReviewBlocksAction(current)
    ) {
      return;
    }
    const requestId = nextScreen02RequestId();
    const requestRunId = current.runId;
    // The guard above serializes native and model turns. Clear only stale or
    // expired local claims before creating the next documented native round.
    aiReviewPendingRoundKeysRef.current.clear();
    pendingAiReviewMarkerRef.current = null;
    let pending: Screen02Session;
    try {
      pending = beginScreen02InteractionRequest(current, {
        id: requestId,
        requestType,
        exactText: exactRequest,
        criteria,
      });
      screen02SessionRef.current = pending;
      setScreen02Session(pending);
      setResearchNotice({
        status: "pending",
        message:
          "Saving the exact Screen 2 request before running the documented search…",
      });
      await bridge.clearScreen02PendingAiReviewMarker(undefined, pending);
      await bridge.syncScreen02Workspace(pending);
      const afterSync = screen02SessionRef.current;
      if (
        afterSync?.runId !== requestRunId ||
        afterSync.interaction.pendingRequest?.id !== requestId
      ) {
        return;
      }
      let authoritative: Screen02Session | null = null;
      let discoveryError: unknown = null;
      try {
        authoritative = await bridge.discoverScreen02Options(
          pending,
          requestType,
          exactRequest,
          criteria,
        );
      } catch (error) {
        discoveryError = error;
      }
      const latest = screen02SessionRef.current;
      if (latest?.runId !== requestRunId) {
        return;
      }
      const arbitration = arbitrateScreen02DiscoveryResult(
        pending,
        latest,
        authoritative,
      );
      if (arbitration.status === "conflict") {
        throw new Error(
          "ShockAudit received two conflicting versions of the same candidate search. Your prior Screen 2 state was preserved; reset Screen 2 and retry.",
        );
      }
      if (arbitration.session) {
        const reconciled = arbitration.session;
        screen02SessionRef.current = reconciled;
        // Commit the factual native cards before requesting the comparative
        // model assessment. This keeps successful retrieval visible even
        // when the follow-up message is slow or unavailable.
        flushSync(() => {
          setScreen02Session(reconciled);
        });
        const latestNativeRound =
          reconciled.interaction.searchRounds.at(-1);
        const hasNativeResults =
          latestNativeRound?.stage === "native-retrieval" &&
          latestNativeRound.itemIdsRetained.length > 0;
        const shouldRequestComparativeReview =
          hostView.canRequestAiReview &&
          hasNativeResults;
        if (shouldRequestComparativeReview) {
          setResearchNotice({
            status: "info",
            message:
              followUpPurpose === "coverage-expansion"
                ? "The fresh source record is ready. Starting the bounded coverage-expansion review…"
                : "Source-backed factual cards are ready. Starting the candidate-specific preliminary assessments…",
          });
          void requestScreen02AiReviewOnce(
            reconciled,
            exactRequest,
            criteria,
            requestRunId,
            followUpPurpose ?? "interpretation",
          );
        } else {
          setResearchNotice({
            status:
              hasNativeResults && !hostView.canRequestAiReview
                ? "warning"
                : "success",
            message:
              hasNativeResults && !hostView.canRequestAiReview
                ? "Source-backed factual cards are ready. The preliminary assessment is unavailable in this view, so these records remain useful for screening but are not finished assessments."
                : "Source discovery is complete. Review the coverage record before revising or rerunning the search.",
          });
        }
        return;
      }
      throw (
        discoveryError ??
        new Error(
          "ShockAudit did not receive a complete response for this candidate search. Your criteria remain available; retry the search.",
        )
      );
    } catch (error) {
      const latest = screen02SessionRef.current;
      const errorMessage =
        error instanceof Error
          ? error.message
          : "ShockAudit could not send this Screen 2 request.";
      if (latest?.interaction.pendingRequest?.id === requestId) {
        const cleared = clearScreen02InteractionRequest(
          latest,
          requestId,
          errorMessage,
        );
        screen02SessionRef.current = cleared;
        setScreen02Session(cleared);
        await bridge.syncScreen02Workspace(cleared);
      }
      if (screen02SessionRef.current?.runId === requestRunId) {
        setResearchNotice({
          status: "error",
          message: errorMessage,
        });
      }
    }
  }

  function requestOptionalScreen02AiReview(
    purpose: "interpretation" | "coverage-expansion" = "interpretation",
    requestedCandidateIds?: readonly string[],
  ) {
    const current = screen02SessionRef.current;
    const latestRound = current?.interaction.searchRounds.at(-1);
    const sourceRound =
      current && latestRound?.stage === "preliminary-assessment"
        ? current.interaction.searchRounds.find(
            (round) => round.id === latestRound.rootNativeRoundId,
          )
        : latestRound;
    if (
      !current ||
      !latestRound ||
      !sourceRound ||
      !screen02AiReviewRequestKey(current) ||
      current.interaction.pendingRequest ||
      current.interaction.pendingScopeRevision ||
      current.lockedChoice ||
      screen02AiReviewBlocksAction(current)
    ) {
      return;
    }
    const criteria = sourceRound.preferenceCriteriaIds
      .map((criterionId) =>
        current.interaction.preferences.criteria.find(
          (criterion) => criterion.id === criterionId,
        ),
      )
      .filter(
        (
          criterion,
        ): criterion is Screen02Session["interaction"]["preferences"]["criteria"][number] =>
          Boolean(criterion),
      )
      .map(({ kind, text }) => ({ kind, text }));
    void requestScreen02AiReviewOnce(
      current,
      purpose === "coverage-expansion"
        ? `Assess the candidates returned by the fresh source-coverage search without changing the confirmed study boundary. Original request: ${sourceRound.exactRequest}`
        : sourceRound.exactRequest,
      criteria,
      current.runId,
      purpose,
      requestedCandidateIds,
    );
  }

  function requestScreen02CoverageExpansion() {
    const current = screen02SessionRef.current;
    const latestRound = current?.interaction.searchRounds.at(-1);
    const sourceRound =
      current && latestRound?.stage === "preliminary-assessment"
        ? current.interaction.searchRounds.find(
            (round) => round.id === latestRound.rootNativeRoundId,
          )
        : latestRound;
    if (
      !current ||
      !latestRound ||
      !sourceRound ||
      current.interaction.pendingRequest ||
      current.interaction.pendingScopeRevision ||
      current.lockedChoice ||
      screen02AiReviewBlocksAction(current)
    ) {
      return;
    }
    const criteria = sourceRound.preferenceCriteriaIds
      .map((criterionId) =>
        current.interaction.preferences.criteria.find(
          (criterion) => criterion.id === criterionId,
        ),
      )
      .filter(
        (
          criterion,
        ): criterion is Screen02Session["interaction"]["preferences"]["criteria"][number] =>
          Boolean(criterion),
      )
      .map(({ kind, text }) => ({ kind, text }));

    void requestScreen02Search(
      "refine",
      `Run a fresh documented source search for targeted coverage expansion without changing the confirmed study boundary. Preserve the current criteria and investigate uncovered jurisdiction- and language-specific routes. Previous request: ${sourceRound.exactRequest}`,
      criteria,
      "coverage-expansion",
    );
  }

  const activeScreen02ReviewKey = screen02Session
    ? screen02AiReviewRequestKey(screen02Session)
    : null;
  const screen02AiReviewPending = Boolean(
    activeScreen02ReviewKey &&
      aiReviewPendingRoundKeysRef.current.has(activeScreen02ReviewKey),
  );

  function retryScreen02Open() {
    const baseline = confirmedBaselineRef.current;
    if (!baseline || workflowOpenStatus === "opening") return;
    void openNextScreen(
      JSON.parse(JSON.stringify(baseline)) as Screen01StudyContext,
    ).catch(() => undefined);
  }

  function returnToScopeAfterScreen02OpenFailure() {
    const current = screen02WorkflowRef.current;
    activeScreenRef.current = 1;
    setActiveScreen(1);
    setWorkflowOpenStatus("idle");
    setWorkflowNotice(null);
    clearWorkflowTimeouts();
    clearWorkflowPolling();
    if (current) {
      saveWorkflowWidget(current, 1, openedAuditMatchRef.current);
    }
  }
  const activeWorkflowState = workflowState(screen02Workflow);
  const inlineScreen02Mode =
    activeWorkflowState?.mode ?? screen02Session?.mode ?? null;
  const screen02Baseline =
    activeWorkflowState?.screen01Baseline ?? confirmedBaselineRef.current;

  if (stage1ProofSnapshot) {
    return (
      <Stage1AssessmentProof
        snapshot={stage1ProofSnapshot}
        hostView={hostView}
        onRequestAssessment={() =>
          void requestStage1ProofAssessment()
        }
        onRequestFullscreen={() => bridge.requestFullscreen()}
      />
    );
  }

  if (hostView.embedded && hostView.displayMode === "inline") {
    return (
      <main className="inline-launcher">
        <div className="inline-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="inline-copy">
          <span className="inline-kicker">
            Step {activeScreen} of 7
          </span>
          <h1>
            {activeScreen === 1
              ? "Describe your study"
              : activeScreen === 4
                ? "Audit exposure in your sample"
              : activeScreen === 3
                ? "Verify what changed and when"
              : inlineScreen02Mode === "audit"
                ? "Identify and understand your shock"
                : "Choose a feasible shock"}
          </h1>
          <p>
            {activeScreen === 1
              ? "Set the study boundary, resolve scope decisions, and confirm a Scope Contract before the shock workflow begins."
              : activeScreen === 4
                ? "Upload your sample data, map exact case-sensitive variables, and compile a source-linked exposure audit with fixed software."
              : activeScreen === 3
                ? "Review the event timeline, operative changes, eligibility conditions, and exact supporting passages before saving the Event Card."
              : inlineScreen02Mode === "audit"
                ? "Resolve the exact named event before any study assessment while the confirmed Screen 1 baseline remains unchanged."
                : "Compare evidence and feasibility while the confirmed Screen 1 baseline remains unchanged."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void bridge.requestFullscreen()}
          disabled={!hostView.canFullscreen}
        >
          {hostView.canFullscreen
            ? "Open full workspace"
            : "Fullscreen unavailable"}
          <span aria-hidden="true">→</span>
        </button>
        <p className="inline-note">
          The conversation remains available in fullscreen.
        </p>
      </main>
    );
  }

  if (
    activeScreen === 2 &&
    workflowOpenStatus !== "idle" &&
    screen02Baseline
  ) {
    const visibleFailure = screen02OpenFailureMessage(
      workflowNotice?.status === "error"
        ? new Error(workflowNotice.message)
        : undefined,
    );
    return (
      <Screen02WorkflowShell
        baseline={screen02Baseline}
        hostView={hostView}
        status={workflowOpenStatus}
        errorMessage={visibleFailure}
        onBack={returnToScopeAfterScreen02OpenFailure}
        onRetry={retryScreen02Open}
        onRequestFullscreen={() => bridge.requestFullscreen()}
      />
    );
  }

  if (
    activeScreen === 4 &&
    screen02Workflow &&
    activeWorkflowState &&
    screen03Workflow &&
    screen04Workflow
  ) {
    const returnToScreen3 = () => {
      activeScreenRef.current = 3;
      setActiveScreen(3);
      saveWorkflowWidget(screen02Workflow, 2, openedAuditMatchRef.current);
      saveScreen03Widget(screen03Workflow, 3);
      const currentScreen04 = screen04WorkflowRef.current;
      if (currentScreen04) saveScreen04Widget(currentScreen04, 3);
      setScreen03Error(null);
    };
    return (
      <Screen02WorkflowShell
        baseline={activeWorkflowState.screen01Baseline}
        hostView={hostView}
        activeStep={4}
        onBack={editStudyFromWorkflow}
        onReturnToScreen2={() => {
          activeScreenRef.current = 2;
          setActiveScreen(2);
          saveWorkflowWidget(
            screen02Workflow,
            2,
            openedAuditMatchRef.current,
          );
          saveScreen03Widget(screen03Workflow, 2);
          const currentScreen04 = screen04WorkflowRef.current;
          if (currentScreen04) saveScreen04Widget(currentScreen04, 3);
        }}
        onReturnToScreen3={returnToScreen3}
        onRequestFullscreen={() => bridge.requestFullscreen()}
      >
        <Screen04LoadBoundary onReload={() => window.location.reload()}>
          <Suspense
            fallback={
              <div className="workflow-notice" role="status">
                Loading the Screen 4 exposure audit…
              </div>
            }
          >
            <Screen04
              key={screen04Workflow.runId}
              state={screen04Workflow}
              onStateChange={(next) => {
                if (!commitScreen04State(next, true)) {
                  setScreen03Error(
                    "ShockAudit rejected a Screen 4 update because its locked Event Card binding changed.",
                  );
                }
              }}
              onBack={returnToScreen3}
              onStartFresh={() => openScreen04Workflow(screen03Workflow, true)}
            />
          </Suspense>
        </Screen04LoadBoundary>
      </Screen02WorkflowShell>
    );
  }

  if (
    activeScreen === 3 &&
    screen02Workflow &&
    activeWorkflowState &&
    screen03Workflow
  ) {
    const historicalHostBriefing =
      screen03HistoricalHostBriefingCompatibilityEnabled(screen03Workflow);
    const hostReasoningFull =
      hostView.hostReasoningMode === "full" &&
      hostView.canRequestAiReview === true;
    const evidenceTaskEntry =
      hostReasoningTasks["screen03-evidence-mapping"];
    const overviewTaskEntry =
      hostReasoningTasks["screen03-overview-improvement"];
    const evidenceTaskStatus =
      hostReasoningTransientStatus["screen03-evidence-mapping"] ??
      evidenceTaskEntry?.ui ?? null;
    const overviewTaskStatus =
      hostReasoningTransientStatus["screen03-overview-improvement"] ??
      overviewTaskEntry?.ui ?? null;
    const currentHostOverviewResult =
      overviewTaskEntry?.ui.phase === "completed" &&
        overviewTaskEntry.task?.resultId &&
        overviewTaskEntry.coordinates.selectedEventId &&
        overviewTaskEntry.coordinates.expectedEventFingerprint &&
        screen03HostOverviewResultIsCurrent(
          overviewTaskEntry.task.result,
          {
            runId: screen03Workflow.runId,
            selectedEventId:
              screen03Workflow.orientation?.current.selectedEventId ??
              screen03Workflow.history[0]?.targetId ?? null,
            eventFingerprint: screen03Workflow.upstream.eventFingerprint,
            stateFingerprint:
              fingerprintScreen03VerificationState(screen03Workflow),
            activeSourceIds: screen03Workflow.evidence
              .filter((evidence) => evidence.status !== "changed")
              .map((evidence) => evidence.id),
          },
          {
            runId: overviewTaskEntry.coordinates.runId,
            selectedEventId: overviewTaskEntry.coordinates.selectedEventId,
            expectedEventFingerprint:
              overviewTaskEntry.coordinates.expectedEventFingerprint,
          },
        )
        ? overviewTaskEntry.task.result
        : null;
    const returnToScreen2 = () => {
      activeScreenRef.current = 2;
      setActiveScreen(2);
      saveWorkflowWidget(
        screen02Workflow,
        2,
        openedAuditMatchRef.current,
      );
      saveScreen03Widget(screen03Workflow, 2);
      if (screen04WorkflowRef.current) {
        saveScreen04Widget(screen04WorkflowRef.current, 3);
      }
      setScreen03Error(null);
      reconcileHostReasoningTasksForScreen(2);
    };
    const reviewField = (
      proposalId: string,
      decision: Screen03ReviewDecision,
      editedValue?: string,
      note?: string,
    ) => {
      void mutateScreen03({
        type: "review-field",
        proposalId,
        decision,
        ...(editedValue ? { editedValue } : {}),
        reason:
          note ??
          `Researcher ${decision === "accept" ? "accepted" : decision === "edit" ? "edited" : decision === "reject" ? "rejected" : "left unresolved"} this Screen 3 field in the evidence review.`,
      });
    };
    return (
      <Screen02WorkflowShell
        baseline={activeWorkflowState.screen01Baseline}
        hostView={hostView}
        activeStep={3}
        onBack={editStudyFromWorkflow}
        onReturnToScreen2={returnToScreen2}
        onResumeScreen4={
          screen03Workflow.status === "locked"
            ? () => openScreen04Workflow(screen03Workflow)
            : undefined
        }
        onRequestFullscreen={() => bridge.requestFullscreen()}
      >
        <Screen03LoadBoundary onReload={() => window.location.reload()}>
        <Suspense
          fallback={
            <div className="workflow-notice" role="status">
              Loading the Screen 3 evidence workspace…
            </div>
          }
        >
        <Screen03
          state={screen03Workflow}
          busy={screen03Busy}
          researchBusy={screen03OperationActiveRef.current === "research"}
          errorMessage={screen03Error}
          onRetryResearch={() =>
            void openScreen03Workflow(screen02Workflow, true)
          }
          onFindDirectSupport={(proposalId) =>
            void openScreen03Workflow(screen02Workflow, true, proposalId)
          }
          hostReasoningMode={hostView.hostReasoningMode ?? "disabled"}
          hostEvidenceTaskStatus={evidenceTaskStatus}
          hostOverviewTaskStatus={overviewTaskStatus}
          hostOverviewResult={currentHostOverviewResult}
          onRequestEvidenceMapping={hostReasoningFull
            ? () => void startHostReasoningTask("screen03-evidence-mapping")
            : undefined}
          onCheckEvidenceMapping={evidenceTaskStatus
            ? () => void reconcileHostReasoningTask(
                "screen03-evidence-mapping",
              )
            : undefined}
          onRetryEvidenceMapping={
            hostReasoningFull && evidenceTaskStatus &&
              ["failed", "timed-out"].includes(evidenceTaskStatus.phase) &&
              (evidenceTaskStatus.retryCount ?? 0) === 0
              ? () => void retryHostReasoningTask(
                  "screen03-evidence-mapping",
                )
              : undefined
          }
          onRequestOverviewImprovement={hostReasoningFull
            ? () => void startHostReasoningTask(
                "screen03-overview-improvement",
              )
            : undefined}
          onCheckOverviewImprovement={overviewTaskStatus
            ? () => void reconcileHostReasoningTask(
                "screen03-overview-improvement",
              )
            : undefined}
          onRetryOverviewImprovement={
            hostReasoningFull && overviewTaskStatus &&
              ["failed", "timed-out"].includes(overviewTaskStatus.phase) &&
              (overviewTaskStatus.retryCount ?? 0) === 0
              ? () => void retryHostReasoningTask(
                  "screen03-overview-improvement",
                )
              : undefined
          }
          hostReasoningStatus={
            historicalHostBriefing ? screen03HostReasoningStatus : undefined
          }
          hostBriefingDecision={
            historicalHostBriefing
              ? screen03HostBriefingDecision(screen03Workflow) ?? undefined
              : undefined
          }
          onRequestHostReasoning={historicalHostBriefing
            ? () => void requestScreen03HostReasoning(screen02Workflow)
            : undefined}
          onReviewHostBriefing={historicalHostBriefing &&
              screen03HostBriefingBootstrapRef.current &&
              screen03Workflow.briefing?.activeProposalId
            ? (decision) => void reviewScreen03HostBriefing(decision)
            : undefined}
          onReviewField={reviewField}
          onReviewAll={(mode: Screen03BulkReviewMode) =>
            void mutateScreen03({
              type: "review-all-fields",
              mode,
              reason:
                mode === "confirm"
                  ? "Researcher used the bulk shortcut; fixed software confirmed only eligible claims with active direct support, left every other claim unchanged, and kept nonconfirmable undecided claims for manual review."
                  : "Researcher returned every factual Screen 3 claim to review without deleting evidence.",
            })
          }
          onLockEventCard={() =>
            void mutateScreen03({
              type: "lock-event-card",
              reason:
                "Researcher locked the fully reviewed, directly supported Event Card for this run.",
            })
          }
          onOpenScreen4={
            screen03Workflow.status === "locked"
              ? () => openScreen04Workflow(screen03Workflow)
              : undefined
          }
          onBack={returnToScreen2}
        />
        </Suspense>
        </Screen03LoadBoundary>
      </Screen02WorkflowShell>
    );
  }

  if (activeScreen === 2 && screen02Workflow && activeWorkflowState) {
    const activeFindCandidateSet = activeWorkflowState.mode === "find"
      ? activeWorkflowState.candidateSets.find(
          (candidateSet) =>
            candidateSet.candidateSetSnapshotId ===
              activeWorkflowState.activeCandidateSetSnapshotId &&
            candidateSet.status === "active",
        )
      : undefined;
    const hasFixedQualifiedFindCandidate = activeWorkflowState.mode === "find" &&
      activeFindCandidateSet?.candidateSnapshotIds.some((snapshotId) =>
        activeWorkflowState.candidates.some(
          (candidate) =>
            candidate.candidateSnapshotId === snapshotId &&
            candidate.qualification?.eligible === true,
        )
      ) === true;
    const notice = workflowNotice ? (
      <div
        className={`workflow-notice workflow-notice--${workflowNotice.status}`}
        role={workflowNotice.status === "error" ? "alert" : "status"}
        aria-live="polite"
      >
        {workflowNotice.message}
      </div>
    ) : null;
    const assessmentUnavailableNotice =
      !screen02Workflow.assessmentAvailable &&
        !hasFixedQualifiedFindCandidate ? (
        <div
          className="workflow-notice workflow-notice--warning"
          role="status"
          aria-live="polite"
        >
          Preliminary assessment is unavailable in this view. Source-backed
          facts remain visible and can be chosen tentatively. After you choose
          a sourced event, you can continue to Screen 3 with the missing
          assessment recorded and every verification check made mandatory.
        </div>
      ) : null;
    if (activeWorkflowState.mode === "find") {
      const hostReasoningFull =
        hostReasoningModeAllowsTask(
          hostView.hostReasoningMode,
          "screen02-search-review",
        ) &&
        hostView.canRequestAiReview === true;
      const discoveryPlanningRequest = activeWorkflowState.assessmentRequests
        .filter((request) => request.target.mode === "find-discovery-plan")
        .at(-1);
      const discoveryPlanningActive = Boolean(
        hostReasoningFull && discoveryPlanningRequest &&
          [
            "prepared",
            "message-delivered",
            "draft-received",
            "validating",
          ].includes(discoveryPlanningRequest.status),
      );
      const assessmentHostTaskStatus =
        screen02HostTaskStatus(activeWorkflowState);
      const genericHostTaskEntry =
        hostReasoningTasks["screen02-search-review"];
      const genericHostTaskStatus =
        hostReasoningTransientStatus["screen02-search-review"] ??
        genericHostTaskEntry?.ui ?? null;
      const currentGenericHostTaskReview = screen02HostReviewSummary(
        genericHostTaskEntry?.task?.status === "applied" &&
          genericHostTaskEntry.task?.resultId &&
          genericHostTaskEntry.coordinates.candidatePoolId &&
          genericHostTaskEntry.coordinates.expectedCandidatePoolFingerprint &&
          screen02HostReviewApplicationIsCurrent(activeWorkflowState, {
            previousRevision:
              genericHostTaskEntry.coordinates.expectedParentRevision,
            taskId: genericHostTaskEntry.coordinates.taskId,
            resultId: genericHostTaskEntry.task.resultId,
            runId: genericHostTaskEntry.coordinates.runId,
            expectedScopeFingerprint:
              genericHostTaskEntry.coordinates.expectedScopeFingerprint,
            originalCandidatePoolId:
              genericHostTaskEntry.coordinates.candidatePoolId,
            originalCandidatePoolFingerprint:
              genericHostTaskEntry.coordinates.expectedCandidatePoolFingerprint,
          })
          ? genericHostTaskEntry.task.result
          : null,
      );
      const currentGenericHostTaskMarker =
        currentGenericHostTaskReview && screen02HostResultMarker &&
          genericHostTaskEntry?.task?.resultId ===
            screen02HostResultMarker.resultId &&
          genericHostTaskEntry.coordinates.taskId ===
            screen02HostResultMarker.taskId &&
          genericHostTaskEntry.coordinates.runId ===
            screen02HostResultMarker.runId &&
          genericHostTaskEntry.coordinates.expectedParentRevision ===
            screen02HostResultMarker.expectedParentRevision &&
          screen02Workflow.revision ===
            screen02HostResultMarker.workflowRevision &&
          screen02Workflow.stateFingerprint ===
            screen02HostResultMarker.workflowStateFingerprint &&
          activeFindCandidateSet?.manifest.hostReviewApplication
              ?.applicationFingerprint ===
            screen02HostResultMarker.applicationFingerprint &&
          fingerprintHostReasoningValue(genericHostTaskEntry.task.result) ===
            screen02HostResultMarker.resultFingerprint
          ? screen02HostResultMarker
          : null;
      const visibleCandidateCount =
        visibleFindCandidateCount(activeWorkflowState);
      const hostTaskStatus = genericHostTaskStatus
        ? {
            ...genericHostTaskStatus,
            message: screen02HostTaskMessage(
              genericHostTaskStatus.phase,
              visibleCandidateCount,
            ),
          }
        : hostReasoningFull
          ? assessmentHostTaskStatus
          : null;
      const visibleFindSearchState =
        discoveryPlanningActive && findSearchState.phase === "idle"
          ? {
              ...findSearchState,
              phase: "searching" as const,
              message: discoveryPlanningRequest?.status === "prepared"
                ? "Preparing bounded source-search vocabulary…"
                : "Planning the source search; candidates will appear automatically…",
              startedRevision: screen02Workflow.revision,
              visibleCandidateCount,
              recovery: "preserved-results" as const,
            }
          : findSearchState;
      return (
        <Screen02WorkflowShell
          baseline={activeWorkflowState.screen01Baseline}
          hostView={hostView}
          notice={
            <>
              {assessmentUnavailableNotice}
              {notice}
            </>
          }
          onBack={editStudyFromWorkflow}
          onResumeScreen3={
            screen02Workflow.handoff
              ? openOrResumeScreen03FromScreen2
              : undefined
          }
          screen3ActionLabel={
            screen03Workflow ? "Resume Screen 3" : "Open Screen 3"
          }
          onRequestFullscreen={() => bridge.requestFullscreen()}
        >
          <Suspense fallback={<div className="workflow-notice" role="status">Loading candidate results…</div>}>
          <Screen02Find
            key={screen02Workflow.runId}
            state={activeWorkflowState}
            busy={workflowBusy || findSearchState.phase === "searching"}
            searchState={visibleFindSearchState}
            chatGptPlanningAvailable={hostReasoningFull}
            hostReasoningMode={hostView.hostReasoningMode ?? "disabled"}
            hostTaskStatus={hostTaskStatus}
            hostReviewDetails={currentGenericHostTaskReview
              ? <Screen02HostReviewDetails
                  review={currentGenericHostTaskReview}
                  candidates={activeWorkflowState.candidates}
                  reconciliationMarker={currentGenericHostTaskMarker}
                  onReconciliationMarkerPainted={
                    screen02HostResultMarkerPainted
                  }
                  onReconciliationMarkerRemoved={
                    screen02HostResultMarkerRemoved
                  }
                />
              : null}
            onCheckHostTask={genericHostTaskStatus
              ? () => void reconcileHostReasoningTask(
                  "screen02-search-review",
                )
              : hostReasoningFull
                ? () => void mutateWorkflow("refresh", {}, {
                    requestAssessment: false,
                    silent: true,
                  })
                : undefined
            }
            onRetryHostTask={genericHostTaskStatus && hostReasoningFull &&
                ["failed", "timed-out"].includes(
                  genericHostTaskStatus.phase,
                ) && (genericHostTaskStatus.retryCount ?? 0) === 0
              ? () => void retryHostReasoningTask("screen02-search-review")
              : hostReasoningFull && screen02Workflow.assessmentBatch
                ? () => void requestWorkflowAssessment(screen02Workflow)
                : undefined}
            onSearch={(criteria) => void runDeterministicFind(criteria)}
            onAskChatGPT={hostReasoningFull
              ? () => void startHostReasoningTask("screen02-search-review")
              : undefined}
            onOpenCandidate={(candidateSnapshotId) =>
              void mutateWorkflow("find-open", { candidateSnapshotId })
            }
            onRemoveCandidate={(candidateSnapshotId, reason) =>
              void mutateWorkflow("find-remove", {
                candidateSnapshotId,
                reason,
              })
            }
            onRetryCandidate={(candidateSnapshotId) =>
              void mutateWorkflow("find-retry", { candidateSnapshotId })
            }
            onOverrideCriterion={(findingId, reason) =>
              void mutateWorkflow("find-override", { findingId, reason })
            }
            onSelectCandidate={(candidateSnapshotId) =>
              void mutateWorkflow("find-select", { candidateSnapshotId })
            }
            onClearSelection={() =>
              void mutateWorkflow("find-clear-selection", {})
            }
            onContinue={() => void mutateWorkflow("find-continue", {})}
            onContinueWithoutAssessment={(reason, acknowledgment) =>
              void mutateWorkflow("find-continue-without-assessment", {
                reason,
                acknowledgment,
              })
            }
            onSaveRelevanceProfile={(edit) =>
              void mutateWorkflow("find-update-relevance-profile", { edit }, {
                requestAssessment: false,
              })
            }
            onEditStudy={editStudyFromWorkflow}
            onReset={() => void resetScreen02Workflow()}
          />
          </Suspense>
        </Screen02WorkflowShell>
      );
    }
    return (
      <Screen02WorkflowShell
        baseline={activeWorkflowState.screen01Baseline}
        hostView={hostView}
        notice={
          <>
            {assessmentUnavailableNotice}
            {notice}
          </>
        }
        onBack={editStudyFromWorkflow}
        onResumeScreen3={
          screen02Workflow.handoff
            ? openOrResumeScreen03FromScreen2
            : undefined
        }
        screen3ActionLabel={
          screen03Workflow ? "Resume Screen 3" : "Open Screen 3"
        }
        onRequestFullscreen={() => bridge.requestFullscreen()}
      >
        <Screen02AuditLoadBoundary onReload={() => window.location.reload()}>
          <Suspense
            fallback={
              <div className="workflow-notice" role="status">
                Loading the Screen 2 identity audit…
              </div>
            }
          >
            <Screen02Audit
              key={screen02Workflow.runId}
              state={activeWorkflowState}
              busy={workflowBusy}
              openedMatchSnapshotId={openedAuditMatch}
              onReviseAnchor={(fields, reason) =>
                void mutateWorkflow("audit-revise-anchor", { fields, reason }, {
                  openedMatchSnapshotId: null,
                })
              }
              onOpenMatch={(matchSnapshotId) => {
                void mutateWorkflow(
                  "audit-open",
                  { matchSnapshotId },
                  { openedMatchSnapshotId: matchSnapshotId },
                );
              }}
              onConfirmMatch={(matchSnapshotId, reason) =>
                void mutateWorkflow("audit-confirm", {
                  matchSnapshotId,
                  reason,
                })
              }
              onChooseRelatedVersion={(matchSnapshotId, reason) =>
                void mutateWorkflow("audit-related", {
                  matchSnapshotId,
                  reason,
                })
              }
              onRejectMatch={(matchSnapshotId, reason) =>
                void mutateWorkflow("audit-reject", {
                  matchSnapshotId,
                  reason,
                })
              }
              onNoMatch={(reason) =>
                void mutateWorkflow("audit-no-match", { reason }, {
                  openedMatchSnapshotId: null,
                })
              }
              onRetryDossier={(matchSnapshotId) =>
                void mutateWorkflow("audit-retry-dossier", { matchSnapshotId })
              }
              onRetryAssessment={(confirmationSnapshotId) =>
                void mutateWorkflow("audit-retry-assessment", {
                  confirmationSnapshotId,
                })
              }
              onContinue={() => void mutateWorkflow("audit-continue", {})}
              onContinueWithoutAssessment={(reason, acknowledgment) =>
                void mutateWorkflow("audit-continue-without-assessment", {
                  reason,
                  acknowledgment,
                })
              }
              onReconsiderIdentity={(reason) =>
                void mutateWorkflow("audit-reconsider", { reason })
              }
              onEditStudy={editStudyFromWorkflow}
              onReset={() => void resetScreen02Workflow()}
            />
          </Suspense>
        </Screen02AuditLoadBoundary>
      </Screen02WorkflowShell>
    );
  }

  if (activeScreen === 2 && screen02Session) {
    return (
      <section className="legacy-screen02" aria-labelledby="legacy-screen02-title">
        <div className="legacy-screen02__notice" role="status">
          <h1 id="legacy-screen02-title">Saved Screen 2 — read-only</h1>
          <p>
            This conversation contains a v0.2.20 client-held session. Its
            evidence and decisions remain visible, but new writes require a
            fresh server-owned v2.1 run.
          </p>
          <button
            type="button"
            onClick={() =>
              void openNextScreen(
                screen02Session.screen01Baseline as Screen01StudyContext,
              ).catch(() => undefined)
            }
            disabled={!hostView.connected || workflowBusy}
          >
            Start updated Screen 2
          </button>
        </div>
        <p aria-label="Read-only saved Screen 2">
          {screen02Session.items.length} saved candidate record{screen02Session.items.length === 1 ? "" : "s"} remain preserved in this historical run.
        </p>
      </section>
    );
  }

  return (
    <>
      {workflowNotice?.status === "error" && (
        <div className="workflow-notice workflow-notice--error" role="alert">
          {workflowNotice.message}
        </div>
      )}
      <Screen01
        key={stateRevision}
        state={screen01State}
        onStateChange={updateScreen01State}
        draftsByMode={draftsByMode}
        onRememberDraft={(mode, draft) => {
          initialScreen01ToolStatePendingRef.current = false;
          setDraftsByMode((drafts) => ({ ...drafts, [mode]: draft }));
        }}
        hostView={hostView}
        onSaveState={saveState}
        onConfirm={confirmState}
        onOpenNext={openNextScreen}
        onRequestFullscreen={() => bridge.requestFullscreen()}
      />
    </>
  );
}
