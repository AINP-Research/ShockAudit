import type {
  HostReasoningMessageChannel,
  HostReasoningMessageDeliveryStatus,
  HostReasoningTaskStatus,
  HostReasoningTaskType,
} from "../../core/host-reasoning-task";
import { isScreen02StudyRelevanceProfile } from
  "../../core/screen02-relevance-profile";
import { restoreHostTaskTransport } from
  "../../core/host-task-transport";

export const HOST_REASONING_MODE_META_KEY =
  "shockaudit/hostReasoningMode" as const;
export const HOST_REASONING_META_KEY = "shockaudit/hostReasoning" as const;

export const HOST_REASONING_PREPARE_INPUT_SCHEMA_VERSION =
  "shockaudit-host-task-prepare-input-v1" as const;
export const HOST_REASONING_PREPARED_RESULT_SCHEMA_VERSION =
  "shockaudit-host-task-prepared-result-v1" as const;
export const HOST_REASONING_STATUS_INPUT_SCHEMA_VERSION =
  "shockaudit-host-task-status-input-v1" as const;
export const HOST_REASONING_STATUS_RESULT_SCHEMA_VERSION =
  "shockaudit-host-task-status-result-v1" as const;
export const HOST_REASONING_CANCEL_INPUT_SCHEMA_VERSION =
  "shockaudit-host-task-cancel-input-v1" as const;
export const HOST_REASONING_CANCEL_RESULT_SCHEMA_VERSION =
  "shockaudit-host-task-cancel-result-v1" as const;
export const HOST_REASONING_MESSAGE_RECORD_SCHEMA_VERSION =
  "shockaudit-host-task-message-record-v1" as const;
export const HOST_REASONING_MESSAGE_RECORD_RESULT_SCHEMA_VERSION =
  "shockaudit-host-task-message-record-result-v1" as const;
export const HOST_REASONING_PANEL_RECORD_SCHEMA_VERSION =
  "shockaudit-host-task-panel-record-v1" as const;
export const HOST_REASONING_PANEL_RECORD_RESULT_SCHEMA_VERSION =
  "shockaudit-host-task-panel-record-result-v1" as const;
export const HOST_REASONING_MODEL_CONTEXT_SCHEMA_VERSION =
  "shockaudit-host-reasoning-model-input-v1" as const;
export const HOST_REASONING_PRIVATE_CONTEXT_META_KEY =
  "shockaudit/privateHostReasoningContext" as const;
export const HOST_REASONING_PRIVATE_CONTEXT_META_SCHEMA_VERSION =
  "shockaudit-private-host-reasoning-context-meta-v1" as const;

export const PREPARE_SHOCKAUDIT_HOST_TASK_TOOL =
  "prepare_shockaudit_host_task" as const;
export const GET_SHOCKAUDIT_HOST_TASK_STATUS_TOOL =
  "get_shockaudit_host_task_status" as const;
export const CANCEL_SHOCKAUDIT_HOST_TASK_TOOL =
  "cancel_shockaudit_host_task" as const;
export const RECORD_SHOCKAUDIT_HOST_MESSAGE_DELIVERY_TOOL =
  "record_shockaudit_host_message_delivery" as const;
export const RECORD_SHOCKAUDIT_HOST_PANEL_RECONCILIATION_TOOL =
  "record_shockaudit_host_panel_reconciliation" as const;

export const HOST_REASONING_PRIVATE_TASK_REGISTRY_SCHEMA_VERSION =
  "shockaudit-private-host-task-registry-v1" as const;
export const HOST_REASONING_PRIVATE_TASK_COORDINATES_SCHEMA_VERSION =
  "shockaudit-private-host-task-coordinates-v1" as const;

export type HostReasoningMode =
  | "disabled"
  | "app-only"
  | "screen02-only"
  | "full";

export function hostReasoningModeAllowsTask(
  mode: HostReasoningMode | undefined,
  taskType: HostReasoningTaskType,
) {
  if (taskType === "screen05-theoretical-planning" ||
      taskType === "screen05-study-mechanism-comparison") return false;
  return mode === "full" ||
    (mode === "screen02-only" && taskType === "screen02-search-review");
}

export type HostReasoningTaskPrepareCoordinates = {
  taskType: HostReasoningTaskType;
  runId: string;
  accessToken: string;
  /** Private panel coordinate; it is never sent to the generic prepare tool. */
  expectedParentRevision: number;
  candidatePoolId: string | null;
  selectedEventId: string | null;
  claimGroupId: string | null;
  expectedScopeFingerprint: string;
  expectedCandidatePoolFingerprint: string | null;
  expectedEventFingerprint: string | null;
};

export type HostReasoningPrepareInput =
  Omit<HostReasoningTaskPrepareCoordinates, "expectedParentRevision"> & {
    schemaVersion: typeof HOST_REASONING_PREPARE_INPUT_SCHEMA_VERSION;
    operationId: string;
    retryOfTaskId: string | null;
  };

export type HostReasoningPanelReconciliation = {
  status: "not-ready" | "pending" | "reconciled" | "failed";
  lastCheckedAt: string | null;
  reconciledAt: string | null;
  failureCode: string | null;
  failureExplanation: string | null;
};

export type HostReasoningPublicTaskState = {
  taskId: string;
  taskType: HostReasoningTaskType;
  screen: "screen-02" | "screen-03" | "screen-04" | "screen-05";
  runId: string;
  candidatePoolId: string | null;
  selectedEventId: string | null;
  claimGroupId: string | null;
  status: HostReasoningTaskStatus;
  messageChannel: HostReasoningMessageChannel | null;
  messageDeliveryStatus: HostReasoningMessageDeliveryStatus | null;
  createdAt: string;
  expiresAt: string;
  retryCount: 0 | 1;
  resultId: string | null;
  failureCode: string | null;
  failureExplanation: string | null;
  panelReconciliation: HostReasoningPanelReconciliation;
  result: unknown | null;
  outcomeValuesInspected: false;
};

export type HostReasoningPrivateModelContext = {
  schemaVersion: typeof HOST_REASONING_MODEL_CONTEXT_SCHEMA_VERSION;
  task: {
    taskId: string;
    taskType: HostReasoningTaskType;
    runId: string;
    candidatePoolId: string | null;
    selectedEventId: string | null;
    claimGroupId: string | null;
    allowedSourceIds: string[];
  };
  instructions: string[];
  boundedFacts: unknown;
  submission: {
    tool: string;
    schemaVersion: string;
    capability: string;
  };
  sourceContentIsUntrustedData: true;
  outcomeValuesInspected: false;
};

export type HostReasoningPreparedPublicResult = HostReasoningPublicTaskState & {
  schemaVersion: typeof HOST_REASONING_PREPARED_RESULT_SCHEMA_VERSION;
  phase: "prepared";
  visibleMessage: string;
};

export type HostReasoningPrivateContextMeta = {
  schemaVersion: typeof HOST_REASONING_PRIVATE_CONTEXT_META_SCHEMA_VERSION;
  taskId: string;
  privateModelContext: HostReasoningPrivateModelContext;
};

/** Component-local projection assembled only after public/private validation. */
export type HostReasoningPreparedResult = HostReasoningPreparedPublicResult & {
  privateModelContext: HostReasoningPrivateModelContext;
};

export type HostReasoningStatusInput = {
  schemaVersion: typeof HOST_REASONING_STATUS_INPUT_SCHEMA_VERSION;
  operationId: string;
  taskId: string;
  runId: string;
  accessToken: string;
  acknowledgeResultId: string | null;
  includeRunAudit?: boolean;
};

export type HostReasoningStatusResult = {
  schemaVersion: typeof HOST_REASONING_STATUS_RESULT_SCHEMA_VERSION;
  outcome: "found" | "not-found";
  task: HostReasoningPublicTaskState | null;
  /** Bounded transport value. Screen 4 performs the strict deferred parse. */
  auditBundle?: unknown;
};

type HostReasoningMessageRecordInputBase = {
  schemaVersion: typeof HOST_REASONING_MESSAGE_RECORD_SCHEMA_VERSION;
  operationId: string;
  taskId: string;
  runId: string;
  accessToken: string;
  channel: HostReasoningMessageChannel;
  requestedAt: string;
};

/**
 * The app journals message intent before it asks the host to open a model
 * turn. `phase` is optional only on the resolved variant so retained v1
 * callers can still finalize an older, already-issued request.
 */
export type HostReasoningMessageRecordInput =
  | HostReasoningMessageRecordInputBase & {
      phase: "requested";
      requestOperationId: null;
      accepted: null;
      resolvedAt: null;
      failureCode: null;
      failureExplanation: null;
    }
  | HostReasoningMessageRecordInputBase & {
      phase?: "resolved";
      requestOperationId?: string | null;
      accepted: boolean;
      resolvedAt: string;
      failureCode: string | null;
      failureExplanation: string | null;
    };

export type HostReasoningMessageRecordResult = {
  schemaVersion: typeof HOST_REASONING_MESSAGE_RECORD_RESULT_SCHEMA_VERSION;
  disposition: "updated" | "replayed" | "not-found" | "stale" | "terminal";
  taskId: string;
  status: HostReasoningTaskStatus | null;
  messageChannel: HostReasoningMessageChannel | null;
  messageDeliveryStatus: HostReasoningMessageDeliveryStatus | null;
};

export type HostReasoningPanelRecordInput = {
  schemaVersion: typeof HOST_REASONING_PANEL_RECORD_SCHEMA_VERSION;
  operationId: string;
  taskId: string;
  runId: string;
  accessToken: string;
  resultId: string;
  checkedAt: string;
  failureCode: string;
  failureExplanation: string;
};

export type HostReasoningPanelRecordResult = {
  schemaVersion: typeof HOST_REASONING_PANEL_RECORD_RESULT_SCHEMA_VERSION;
  disposition: "updated" | "replayed" | "not-found" | "stale" | "terminal";
  taskId: string;
  status: HostReasoningTaskStatus | null;
  panelStatus: HostReasoningPanelReconciliation["status"] | null;
};

export type HostReasoningCancelInput = {
  schemaVersion: typeof HOST_REASONING_CANCEL_INPUT_SCHEMA_VERSION;
  operationId: string;
  taskId: string;
  runId: string;
  accessToken: string;
  reason: string;
};

export type HostReasoningCancelResult = {
  schemaVersion: typeof HOST_REASONING_CANCEL_RESULT_SCHEMA_VERSION;
  disposition: "updated" | "replayed" | "not-found" | "stale" | "terminal";
  taskId: string;
  status: HostReasoningTaskStatus | null;
};

export type HostReasoningMessageDelivery = {
  taskId: string;
  channel: HostReasoningMessageChannel;
  accepted: boolean;
  requestedAt: string;
  resolvedAt: string;
  retryCount: 0 | 1;
  failureCode: string | null;
  failureExplanation: string | null;
  record: HostReasoningMessageRecordResult | null;
};

export type Screen02HostCandidateReviewSummary = {
  candidateId: string;
  proposedClass: "direct" | "adjacent" | "broad" | "mismatch";
  industryBridge: string;
  sampleConnection: string;
  outcomePathway: string;
  mainMismatchOrUncertainty: string;
  needsFollowUpRetrieval: boolean;
};

export type Screen02HostReviewSummary = {
  candidateReviewCount: number;
  candidateReviews: Screen02HostCandidateReviewSummary[];
  followUpQueries: string[];
  sourceLeadCount: number;
  rationale: string;
};

const screen02ReviewClasses = new Set([
  "direct", "adjacent", "broad", "mismatch",
]);
const screen02ProfileAdditionKeys = new Set([
  "industryAliases", "internationalVariants", "subsectors", "products",
  "services", "industryActors", "regulatedActivities",
  "platformRelationships", "contrastTerms", "falseFriends",
  "jurisdictionAliases",
]);
const screen02ReviewKeys = [
  "schemaVersion", "taskId", "capability", "profileAdditions",
  "candidateReviews", "followUpQueries", "officialSourceLeads",
  "conciseRationale", "hostModel",
] as const;
const screen02CandidateReviewKeys = [
  "candidateId", "proposedClass", "industryBridge", "profileTermsUsed",
  "sourceIdsUsed", "sourceSpansUsed", "sampleConnection", "outcomePathway",
  "mainMismatchOrUncertainty", "needsFollowUpRetrieval", "rankingAdjustment",
] as const;

function isScreen02ReviewText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.length > 0 &&
    value.length <= maximum && value.trim() === value &&
    !/[\u0000-\u001f\u007f]/u.test(value);
}

function isScreen02ReviewTextList(
  value: unknown,
  maximumItems: number,
  maximumLength: number,
  identifiers = false,
): value is string[] {
  return Array.isArray(value) && value.length <= maximumItems &&
    new Set(value).size === value.length && value.every((entry) =>
      identifiers
        ? isIdentifier(entry) && entry.length <= maximumLength
        : isScreen02ReviewText(entry, maximumLength)
    );
}

function screen02CandidateReviewSummary(
  value: unknown,
): Screen02HostCandidateReviewSummary | null {
  if (!isRecord(value) || !hasExactKeys(value, screen02CandidateReviewKeys) ||
      !isIdentifier(value.candidateId) ||
      !screen02ReviewClasses.has(String(value.proposedClass)) ||
      !isScreen02ReviewText(value.industryBridge, 640) ||
      !isScreen02ReviewTextList(value.profileTermsUsed, 12, 160) ||
      !isScreen02ReviewTextList(value.sourceIdsUsed, 12, 160, true) ||
      !Array.isArray(value.sourceSpansUsed) || value.sourceSpansUsed.length > 12 ||
      !isScreen02ReviewText(value.sampleConnection, 640) ||
      !isScreen02ReviewText(value.outcomePathway, 640) ||
      !isScreen02ReviewText(value.mainMismatchOrUncertainty, 400) ||
      typeof value.needsFollowUpRetrieval !== "boolean" ||
      !Number.isInteger(value.rankingAdjustment) ||
      Math.abs(value.rankingAdjustment as number) > 3) return null;
  const sourceIds = new Set(value.sourceIdsUsed as string[]);
  if (!value.sourceSpansUsed.every((span) =>
    isRecord(span) && hasExactKeys(span, ["sourceId", "text"]) &&
    isIdentifier(span.sourceId) && sourceIds.has(span.sourceId) &&
    isScreen02ReviewText(span.text, 500)
  )) return null;
  return {
    candidateId: value.candidateId,
    proposedClass: value.proposedClass as
      Screen02HostCandidateReviewSummary["proposedClass"],
    industryBridge: value.industryBridge,
    sampleConnection: value.sampleConnection,
    outcomePathway: value.outcomePathway,
    mainMismatchOrUncertainty: value.mainMismatchOrUncertainty,
    needsFollowUpRetrieval: value.needsFollowUpRetrieval,
  };
}

function isScreen02OfficialSourceLead(value: unknown) {
  if (!isRecord(value) || !hasExactKeys(value, [
    "url", "title", "issuingBody", "jurisdiction", "reasonForRetrieval",
    "candidateIdIfKnown",
  ]) || !isScreen02ReviewText(value.url, 500) ||
      !isScreen02ReviewText(value.title, 200) ||
      (value.issuingBody !== null &&
        !isScreen02ReviewText(value.issuingBody, 200)) ||
      (value.jurisdiction !== null &&
        !isScreen02ReviewText(value.jurisdiction, 200)) ||
      !isScreen02ReviewText(value.reasonForRetrieval, 400) ||
      !isNullableIdentifier(value.candidateIdIfKnown)) return false;
  try {
    const url = new URL(value.url);
    return url.protocol === "https:" && !url.username && !url.password &&
      (url.port === "" || url.port === "443");
  } catch {
    return false;
  }
}

function isScreen02HostRanking(value: unknown) {
  return isRecord(value) && hasExactKeys(value, [
    "candidateId", "classification", "eligible", "baseScore",
    "proposedClass", "eligibilityUnchanged", "rankingAdjustment",
    "totalScore",
  ]) && isIdentifier(value.candidateId) &&
    screen02ReviewClasses.has(String(value.classification)) &&
    screen02ReviewClasses.has(String(value.proposedClass)) &&
    typeof value.eligible === "boolean" &&
    value.eligibilityUnchanged === true &&
    typeof value.baseScore === "number" && Number.isFinite(value.baseScore) &&
    Number.isInteger(value.rankingAdjustment) &&
    Math.abs(value.rankingAdjustment as number) <= 3 &&
    typeof value.totalScore === "number" && Number.isFinite(value.totalScore) &&
    value.totalScore >= 0 && value.totalScore <= 100;
}

/** Strictly validates and projects the noncanonical Screen 2 display summary. */
export function screen02HostReviewSummary(
  value: unknown,
): Screen02HostReviewSummary | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    "schemaVersion", "origin", "nonCanonical", "review", "enrichedProfile",
    "rankings", "outcomeValuesInspected",
  ])) return null;
  const review = value.review;
  if (
    value.schemaVersion !== "shockaudit-screen02-host-review-result-v1" ||
    value.origin !== "chatgpt-host" || value.nonCanonical !== true ||
    value.outcomeValuesInspected !== false ||
    !isScreen02StudyRelevanceProfile(value.enrichedProfile) ||
    !Array.isArray(value.rankings) || value.rankings.length > 20 ||
    !value.rankings.every(isScreen02HostRanking) || !isRecord(review) ||
    !hasExactKeys(review, screen02ReviewKeys) ||
    review.schemaVersion !== "screen-02-pool-host-review-v1" ||
    review.capability !== "screen-02-pool-review" ||
    !isIdentifier(review.taskId) || !isRecord(review.profileAdditions) ||
    Object.keys(review.profileAdditions).some((key) =>
      !screen02ProfileAdditionKeys.has(key) ||
      !isScreen02ReviewTextList(
        (review.profileAdditions as Record<string, unknown>)[key],
        12,
        160,
      )
    ) || !Array.isArray(review.candidateReviews) ||
    review.candidateReviews.length > 20 ||
    !isScreen02ReviewTextList(review.followUpQueries, 6, 200) ||
    !Array.isArray(review.officialSourceLeads) ||
    review.officialSourceLeads.length > 8 ||
    !review.officialSourceLeads.every(isScreen02OfficialSourceLead) ||
    !isScreen02ReviewText(review.conciseRationale, 1_000) ||
    !isScreen02ReviewText(review.hostModel, 120)
  ) return null;
  const candidateReviews = review.candidateReviews.map(
    screen02CandidateReviewSummary,
  );
  if (candidateReviews.some((candidate) => candidate === null)) return null;
  const candidateIds = candidateReviews.map((candidate) => candidate!.candidateId);
  const rankingIds = (value.rankings as Array<Record<string, unknown>>)
    .map((ranking) => ranking.candidateId as string);
  if (new Set(candidateIds).size !== candidateIds.length ||
      new Set(rankingIds).size !== rankingIds.length ||
      candidateIds.some((candidateId) => !rankingIds.includes(candidateId))) {
    return null;
  }
  return {
    candidateReviewCount: candidateReviews.length,
    candidateReviews: candidateReviews as Screen02HostCandidateReviewSummary[],
    followUpQueries: [...review.followUpQueries] as string[],
    sourceLeadCount: review.officialSourceLeads.length,
    rationale: review.conciseRationale,
  };
}

/**
 * This is deliberately only non-secret reconciliation state. The workflow's
 * access token remains in its existing private Screen 2 snapshot, while the
 * signed one-use capability exists only in the transient model-context write.
 */
export type HostReasoningPrivateTaskCoordinates = {
  schemaVersion:
    typeof HOST_REASONING_PRIVATE_TASK_COORDINATES_SCHEMA_VERSION;
  taskId: string;
  taskType: HostReasoningTaskType;
  screen: "screen-02" | "screen-03" | "screen-04" | "screen-05";
  runId: string;
  candidatePoolId: string | null;
  selectedEventId: string | null;
  claimGroupId: string | null;
  expectedParentRevision: number;
  expectedScopeFingerprint: string;
  expectedCandidatePoolFingerprint: string | null;
  expectedEventFingerprint: string | null;
  createdAt: string;
  expiresAt: string;
  status: HostReasoningTaskStatus;
  retryCount: 0 | 1;
  resultId: string | null;
};

export type HostReasoningPrivateTaskRegistry = {
  schemaVersion: typeof HOST_REASONING_PRIVATE_TASK_REGISTRY_SCHEMA_VERSION;
  tasks: HostReasoningPrivateTaskCoordinates[];
};

const taskTypes = new Set<HostReasoningTaskType>([
  "screen02-search-review",
  "screen03-evidence-mapping",
  "screen03-overview-improvement",
  "six-screen-policy-fact-proof",
  "six-screen-mechanism-proof",
  "screen04-study-event-assessment",
  "screen05-theoretical-planning",
  "screen05-study-mechanism-comparison",
]);
const activeFullTaskTypes = new Set<HostReasoningTaskType>([
  "screen02-search-review",
  "screen03-evidence-mapping",
  "screen03-overview-improvement",
  "six-screen-policy-fact-proof",
  "six-screen-mechanism-proof",
  "screen04-study-event-assessment",
]);
const taskStatuses = new Set<HostReasoningTaskStatus>([
  "prepared",
  "message-requested",
  "message-accepted",
  "message-rejected",
  "awaiting-submission",
  "submission-received",
  "validating",
  "applied",
  "validation-failed",
  "expired",
  "superseded",
  "retry-exhausted",
  "cancelled",
]);
const messageChannels = new Set<HostReasoningMessageChannel>([
  "ui/message",
  "sendFollowUpMessage",
  "unavailable",
]);
const deliveryStatuses = new Set<HostReasoningMessageDeliveryStatus>([
  "requested",
  "accepted",
  "rejected",
]);
const terminalStatuses = new Set<HostReasoningTaskStatus>([
  "applied",
  "message-rejected",
  "validation-failed",
  "expired",
  "superseded",
  "retry-exhausted",
  "cancelled",
]);
const recordDispositions = new Set<
  HostReasoningMessageRecordResult["disposition"]
>(["updated", "replayed", "not-found", "stale", "terminal"]);
const panelStatuses = new Set<HostReasoningPanelReconciliation["status"]>([
  "not-ready", "pending", "reconciled", "failed",
]);
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
const fingerprintPattern = /^(?:fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})$/;
const publicTaskKeys = [
  "taskId", "taskType", "screen", "runId", "candidatePoolId",
  "selectedEventId", "claimGroupId", "status", "messageChannel",
  "messageDeliveryStatus", "createdAt", "expiresAt", "retryCount",
  "resultId", "failureCode", "failureExplanation", "panelReconciliation",
  "result", "outcomeValuesInspected",
] as const;
const preparedTaskKeys = [
  ...publicTaskKeys,
  "schemaVersion", "phase", "visibleMessage",
] as const;
const privateContextMetaKeys = [
  "schemaVersion", "taskId", "privateModelContext",
] as const;
const privateModelContextKeys = [
  "schemaVersion", "task", "instructions", "boundedFacts", "submission",
  "sourceContentIsUntrustedData", "outcomeValuesInspected",
] as const;
const privateModelTaskKeys = [
  "taskId", "taskType", "runId", "candidatePoolId", "selectedEventId",
  "claimGroupId", "allowedSourceIds",
] as const;
const privateModelSubmissionKeys = [
  "tool", "schemaVersion", "capability",
] as const;
const statusResultKeys = ["schemaVersion", "outcome", "task"] as const;
const statusResultWithAuditKeys = [
  ...statusResultKeys,
  "auditBundle",
] as const;
const messageRecordResultKeys = [
  "schemaVersion", "disposition", "taskId", "status", "messageChannel",
  "messageDeliveryStatus",
] as const;
const panelRecordResultKeys = [
  "schemaVersion", "disposition", "taskId", "status", "panelStatus",
] as const;
const cancelResultKeys = [
  "schemaVersion", "disposition", "taskId", "status",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
) {
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  return actual.length === canonical.length &&
    actual.every((key, index) => key === canonical[index]);
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && identifierPattern.test(value);
}

function isFingerprint(value: unknown): value is string {
  return typeof value === "string" && fingerprintPattern.test(value);
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function isNullableIdentifier(value: unknown): value is string | null {
  return value === null || isIdentifier(value);
}

function isNullableFingerprint(value: unknown): value is string | null {
  return value === null || isFingerprint(value);
}

function normalizeAdvertisedMode(value: unknown): HostReasoningMode | null {
  if (value === "full" || value === "on") return "full";
  if (value === "screen02-only") return "screen02-only";
  if (value === "app-only") return "app-only";
  if (value === "disabled" || value === "experimental-off") return "disabled";
  return null;
}

function modesFromMeta(value: unknown) {
  if (!isRecord(value)) return [] as HostReasoningMode[];
  const modes: HostReasoningMode[] = [];
  const direct = normalizeAdvertisedMode(value[HOST_REASONING_MODE_META_KEY]);
  if (direct) modes.push(direct);
  const advertised = value[HOST_REASONING_META_KEY];
  if (advertised !== undefined) {
    if (!isRecord(advertised) || !hasExactKeys(advertised, [
      "mode", "enabled", "genuineTraceCount", "availableTaskTypes",
    ])) {
      modes.push("disabled");
      return modes;
    }
    let rich = normalizeAdvertisedMode(advertised.mode);
    const availableTaskTypes = advertised.availableTaskTypes;
    const validTraceCount = Number.isSafeInteger(advertised.genuineTraceCount) &&
      (advertised.genuineTraceCount as number) >= 0;
    const exactFullTaskList = Array.isArray(availableTaskTypes) &&
      availableTaskTypes.length === activeFullTaskTypes.size &&
      new Set(availableTaskTypes).size === activeFullTaskTypes.size &&
      availableTaskTypes.every((taskType) =>
        activeFullTaskTypes.has(taskType as HostReasoningTaskType)
      );
    const exactScreen02TaskList = Array.isArray(availableTaskTypes) &&
      availableTaskTypes.length === 1 &&
      availableTaskTypes[0] === "screen02-search-review";
    if (
      !rich || !validTraceCount ||
      (rich === "full" &&
        (advertised.enabled !== true || !exactFullTaskList)) ||
      (rich === "screen02-only" &&
        (advertised.enabled !== true || !exactScreen02TaskList)) ||
      (rich !== "full" && rich !== "screen02-only" &&
        (advertised.enabled !== false ||
          !Array.isArray(availableTaskTypes) ||
          availableTaskTypes.length !== 0))
    ) {
      rich = "disabled";
    }
    modes.push(rich);
  }
  return modes;
}

/** Read only known result/metadata envelopes; never inspect arbitrary source data. */
export function hostReasoningModeFromMetadata(
  ...values: unknown[]
): HostReasoningMode | null {
  const modes: HostReasoningMode[] = [];
  for (const value of values) {
    if (!isRecord(value)) continue;
    modes.push(...modesFromMeta(value), ...modesFromMeta(value._meta));
    for (const key of [
      "mcp_tool_result",
      "call_tool_result",
      "mcpToolResult",
      "callToolResult",
    ]) {
      const result = value[key];
      if (isRecord(result)) {
        modes.push(...modesFromMeta(result), ...modesFromMeta(result._meta));
      }
    }
  }
  if (modes.length === 0) return null;
  return modes.every((mode) => mode === modes[0]) ? modes[0]! : "disabled";
}

function isPanelReconciliation(
  value: unknown,
): value is HostReasoningPanelReconciliation {
  return isRecord(value) && hasExactKeys(value, [
    "status", "lastCheckedAt", "reconciledAt", "failureCode",
    "failureExplanation",
  ]) &&
    ["not-ready", "pending", "reconciled", "failed"].includes(
      String(value.status),
    ) &&
    (value.lastCheckedAt === null || isTimestamp(value.lastCheckedAt)) &&
    (value.reconciledAt === null || isTimestamp(value.reconciledAt)) &&
    (value.failureCode === null || isIdentifier(value.failureCode)) &&
    (value.failureExplanation === null ||
      typeof value.failureExplanation === "string");
}

export function isHostReasoningPublicTaskState(
  value: unknown,
): value is HostReasoningPublicTaskState {
  if (!isRecord(value)) return false;
  const taskType = value.taskType as HostReasoningTaskType;
  const status = value.status as HostReasoningTaskStatus;
  return isIdentifier(value.taskId) && taskTypes.has(taskType) &&
    (value.screen === "screen-02" || value.screen === "screen-03" ||
      value.screen === "screen-04" || value.screen === "screen-05") &&
    isIdentifier(value.runId) &&
    isNullableIdentifier(value.candidatePoolId) &&
    isNullableIdentifier(value.selectedEventId) &&
    isNullableIdentifier(value.claimGroupId) && taskStatuses.has(status) &&
    (value.messageChannel === null ||
      messageChannels.has(value.messageChannel as HostReasoningMessageChannel)) &&
    (value.messageDeliveryStatus === null || deliveryStatuses.has(
      value.messageDeliveryStatus as HostReasoningMessageDeliveryStatus,
    )) && isTimestamp(value.createdAt) && isTimestamp(value.expiresAt) &&
    (value.retryCount === 0 || value.retryCount === 1) &&
    isNullableIdentifier(value.resultId) &&
    (value.failureCode === null || isIdentifier(value.failureCode)) &&
    (value.failureExplanation === null ||
      typeof value.failureExplanation === "string") &&
    isPanelReconciliation(value.panelReconciliation) &&
    value.outcomeValuesInspected === false;
}

function isPrivateModelContext(
  value: unknown,
): value is HostReasoningPrivateModelContext {
  if (!isRecord(value) ||
      !hasExactKeys(value, privateModelContextKeys) ||
      value.schemaVersion !== HOST_REASONING_MODEL_CONTEXT_SCHEMA_VERSION ||
      !isRecord(value.task) ||
      !hasExactKeys(value.task, privateModelTaskKeys) ||
      !isRecord(value.submission) ||
      !hasExactKeys(value.submission, privateModelSubmissionKeys)) return false;
  return isIdentifier(value.task.taskId) &&
    taskTypes.has(value.task.taskType as HostReasoningTaskType) &&
    isIdentifier(value.task.runId) &&
    isNullableIdentifier(value.task.candidatePoolId) &&
    isNullableIdentifier(value.task.selectedEventId) &&
    isNullableIdentifier(value.task.claimGroupId) &&
    Array.isArray(value.task.allowedSourceIds) &&
    value.task.allowedSourceIds.every(isIdentifier) &&
    Array.isArray(value.instructions) &&
    value.instructions.every((entry) =>
      typeof entry === "string" && entry.length > 0
    ) && typeof value.submission.tool === "string" &&
    isIdentifier(value.submission.schemaVersion) &&
    typeof value.submission.capability === "string" &&
    value.submission.capability.length > 0 &&
    value.sourceContentIsUntrustedData === true &&
    value.outcomeValuesInspected === false;
}

export function restoreHostReasoningPreparedResult(
  publicValue: unknown,
  metadataValue: unknown,
): HostReasoningPreparedResult | null {
  const restoredPublic = restoreHostTaskTransport(
    publicValue,
    "prepared-public",
  );
  const restoredMetadata = restoreHostTaskTransport(
    metadataValue,
    "prepared-private-context",
  );
  const publicResult = restoredPublic?.value;
  const metadata = restoredMetadata?.value;
  if (!publicResult ||
      !hasExactKeys(publicResult, preparedTaskKeys) ||
      publicResult.schemaVersion !==
        HOST_REASONING_PREPARED_RESULT_SCHEMA_VERSION ||
      publicResult.phase !== "prepared" ||
      typeof publicResult.visibleMessage !== "string" ||
      publicResult.visibleMessage.length < 1 ||
      publicResult.visibleMessage.length > 2_000 ||
      !isHostReasoningPublicTaskState(publicResult) ||
      !metadata ||
      !hasExactKeys(metadata, privateContextMetaKeys) ||
      metadata.schemaVersion !==
        HOST_REASONING_PRIVATE_CONTEXT_META_SCHEMA_VERSION ||
      metadata.taskId !== publicResult.taskId ||
      !isPrivateModelContext(metadata.privateModelContext)) return null;
  const publicPrepared = publicResult as HostReasoningPreparedPublicResult;
  const privateModelContext = metadata.privateModelContext;
  if (
    privateModelContext.task.taskId !== publicPrepared.taskId ||
    privateModelContext.task.taskType !== publicPrepared.taskType ||
    privateModelContext.task.runId !== publicPrepared.runId ||
    privateModelContext.task.candidatePoolId !==
      publicPrepared.candidatePoolId ||
    privateModelContext.task.selectedEventId !==
      publicPrepared.selectedEventId ||
    privateModelContext.task.claimGroupId !== publicPrepared.claimGroupId ||
    publicPrepared.visibleMessage.includes(
      privateModelContext.submission.capability,
    )
  ) return null;
  return structuredClone({
    ...publicPrepared,
    privateModelContext,
  }) as HostReasoningPreparedResult;
}

export function restoreHostReasoningStatusResult(
  value: unknown,
): HostReasoningStatusResult | null {
  const restored = restoreHostTaskTransport(value, "status");
  const result = restored?.value;
  if (!result ||
      (!hasExactKeys(result, statusResultKeys) &&
        !hasExactKeys(result, statusResultWithAuditKeys)) ||
      result.schemaVersion !== HOST_REASONING_STATUS_RESULT_SCHEMA_VERSION ||
      (result.outcome !== "found" && result.outcome !== "not-found")) {
    return null;
  }
  const auditBundle = "auditBundle" in result
    ? hostReasoningRunAuditEnvelope(result.auditBundle)
    : undefined;
  if (auditBundle === null) return null;
  if (result.outcome === "not-found") {
    return result.task === null && auditBundle === undefined
      ? structuredClone(result) as HostReasoningStatusResult
      : null;
  }
  const auditRunId = auditBundle === undefined
    ? undefined
    : isRecord(auditBundle) && isIdentifier(auditBundle.runId)
      ? auditBundle.runId
      : null;
  return isRecord(result.task) && hasExactKeys(result.task, publicTaskKeys) &&
      isHostReasoningPublicTaskState(result.task) &&
      (auditRunId === undefined || auditRunId === result.task.runId)
    ? structuredClone(result) as HostReasoningStatusResult
    : null;
}

function hostReasoningRunAuditEnvelope(
  value: unknown,
): unknown | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    "schemaVersion", "type", "runId", "includedTaskCount", "truncated",
    "tasks", "outcomeValuesInspected",
  ]) || value.schemaVersion !==
      "shockaudit-host-reasoning-run-audit-bundle-v1" ||
    value.type !== "host-reasoning-run-audit-bundle" ||
    !isIdentifier(value.runId) || typeof value.includedTaskCount !== "number" ||
    !Number.isInteger(value.includedTaskCount) ||
    value.includedTaskCount < 0 || value.includedTaskCount > 32 ||
    typeof value.truncated !== "boolean" || !Array.isArray(value.tasks) ||
    value.tasks.length !== value.includedTaskCount ||
    value.outcomeValuesInspected !== false) return null;
  for (const taskValue of value.tasks) {
    if (!isRecord(taskValue) || taskValue.schemaVersion !==
        "shockaudit-host-reasoning-task-audit-bundle-v1" ||
      taskValue.type !== "host-reasoning-task-audit-bundle" ||
      taskValue.outcomeValuesInspected !== false ||
      !isRecord(taskValue.task) || !isRecord(taskValue.task.coordinates) ||
      taskValue.task.coordinates.runId !== value.runId) return null;
  }
  try {
    const serialized = JSON.stringify(value);
    if (new TextEncoder().encode(serialized).byteLength > 96 * 1024) {
      return null;
    }
    return structuredClone(value);
  } catch {
    return null;
  }
}

function hasDisposition(value: Record<string, unknown>) {
  return recordDispositions.has(
    value.disposition as HostReasoningMessageRecordResult["disposition"],
  );
}

export function restoreHostReasoningMessageRecordResult(
  value: unknown,
): HostReasoningMessageRecordResult | null {
  const result = restoreHostTaskTransport(value, "message-record")?.value;
  if (!result ||
      !hasExactKeys(result, messageRecordResultKeys) ||
      result.schemaVersion !==
        HOST_REASONING_MESSAGE_RECORD_RESULT_SCHEMA_VERSION ||
      !hasDisposition(result) || !isIdentifier(result.taskId) ||
      (result.status !== null &&
        !taskStatuses.has(result.status as HostReasoningTaskStatus)) ||
      (result.messageChannel !== null &&
        !messageChannels.has(result.messageChannel as HostReasoningMessageChannel)) ||
      (result.messageDeliveryStatus !== null && !deliveryStatuses.has(
        result.messageDeliveryStatus as HostReasoningMessageDeliveryStatus,
      )) ||
      (result.status === null) !== (result.disposition === "not-found") ||
      (result.messageChannel === null) !==
        (result.messageDeliveryStatus === null) ||
      (result.disposition === "not-found" && result.messageChannel !== null) ||
      ((result.disposition === "updated" || result.disposition === "replayed") &&
        result.messageChannel === null)) return null;
  return structuredClone(result) as HostReasoningMessageRecordResult;
}

export function restoreHostReasoningPanelRecordResult(
  value: unknown,
): HostReasoningPanelRecordResult | null {
  const result = restoreHostTaskTransport(value, "panel-record")?.value;
  if (!result ||
      !hasExactKeys(result, panelRecordResultKeys) ||
      result.schemaVersion !== HOST_REASONING_PANEL_RECORD_RESULT_SCHEMA_VERSION ||
      !hasDisposition(result) || !isIdentifier(result.taskId) ||
      (result.status !== null &&
        !taskStatuses.has(result.status as HostReasoningTaskStatus)) ||
      (result.panelStatus !== null &&
        !panelStatuses.has(
          result.panelStatus as HostReasoningPanelReconciliation["status"],
        )) ||
      (result.status === null) !== (result.disposition === "not-found") ||
      (result.panelStatus === null) !==
        (result.disposition === "not-found")) return null;
  return structuredClone(result) as HostReasoningPanelRecordResult;
}

export function restoreHostReasoningCancelResult(
  value: unknown,
): HostReasoningCancelResult | null {
  const result = restoreHostTaskTransport(value, "cancel")?.value;
  if (!result ||
      !hasExactKeys(result, cancelResultKeys) ||
      result.schemaVersion !== HOST_REASONING_CANCEL_RESULT_SCHEMA_VERSION ||
      !hasDisposition(result) || !isIdentifier(result.taskId) ||
      (result.status !== null &&
        !taskStatuses.has(result.status as HostReasoningTaskStatus)) ||
      (result.status === null) !== (result.disposition === "not-found")) return null;
  return structuredClone(result) as HostReasoningCancelResult;
}

function privateCoordinates(value: unknown):
  HostReasoningPrivateTaskCoordinates | null {
  if (!isRecord(value) ||
      value.schemaVersion !==
        HOST_REASONING_PRIVATE_TASK_COORDINATES_SCHEMA_VERSION ||
      !isIdentifier(value.taskId) ||
      !taskTypes.has(value.taskType as HostReasoningTaskType) ||
      (value.screen !== "screen-02" && value.screen !== "screen-03" &&
        value.screen !== "screen-04" && value.screen !== "screen-05") ||
      !isIdentifier(value.runId) ||
      !isNullableIdentifier(value.candidatePoolId) ||
      !isNullableIdentifier(value.selectedEventId) ||
      !isNullableIdentifier(value.claimGroupId) ||
      !Number.isSafeInteger(value.expectedParentRevision) ||
      (value.expectedParentRevision as number) < 0 ||
      !isFingerprint(value.expectedScopeFingerprint) ||
      !isNullableFingerprint(value.expectedCandidatePoolFingerprint) ||
      !isNullableFingerprint(value.expectedEventFingerprint) ||
      !isTimestamp(value.createdAt) || !isTimestamp(value.expiresAt) ||
      !taskStatuses.has(value.status as HostReasoningTaskStatus) ||
      (value.retryCount !== 0 && value.retryCount !== 1) ||
      !isNullableIdentifier(value.resultId)) return null;
  return {
    schemaVersion: HOST_REASONING_PRIVATE_TASK_COORDINATES_SCHEMA_VERSION,
    taskId: value.taskId,
    taskType: value.taskType as HostReasoningTaskType,
    screen: value.screen,
    runId: value.runId,
    candidatePoolId: value.candidatePoolId,
    selectedEventId: value.selectedEventId,
    claimGroupId: value.claimGroupId,
    expectedParentRevision: value.expectedParentRevision as number,
    expectedScopeFingerprint: value.expectedScopeFingerprint,
    expectedCandidatePoolFingerprint: value.expectedCandidatePoolFingerprint,
    expectedEventFingerprint: value.expectedEventFingerprint,
    createdAt: value.createdAt,
    expiresAt: value.expiresAt,
    status: value.status as HostReasoningTaskStatus,
    retryCount: value.retryCount,
    resultId: value.resultId,
  };
}

export function restoreHostReasoningPrivateTaskRegistry(
  value: unknown,
): HostReasoningPrivateTaskRegistry {
  if (!isRecord(value) ||
      value.schemaVersion !==
        HOST_REASONING_PRIVATE_TASK_REGISTRY_SCHEMA_VERSION ||
      !Array.isArray(value.tasks)) {
    return {
      schemaVersion: HOST_REASONING_PRIVATE_TASK_REGISTRY_SCHEMA_VERSION,
      tasks: [],
    };
  }
  const tasks = value.tasks.flatMap((entry) => {
    const restored = privateCoordinates(entry);
    return restored ? [restored] : [];
  });
  const unique = new Map<string, HostReasoningPrivateTaskCoordinates>();
  for (const task of tasks) {
    const key = `${task.runId}:${task.taskType}`;
    const current = unique.get(key);
    if (!current || task.createdAt > current.createdAt) unique.set(key, task);
  }
  return {
    schemaVersion: HOST_REASONING_PRIVATE_TASK_REGISTRY_SCHEMA_VERSION,
    tasks: [...unique.values()].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt)
    ).slice(-12),
  };
}

export function privateCoordinatesFromPrepared(
  input: HostReasoningTaskPrepareCoordinates,
  prepared: HostReasoningPreparedResult,
): HostReasoningPrivateTaskCoordinates | null {
  if (
    prepared.taskType !== input.taskType || prepared.runId !== input.runId ||
    prepared.candidatePoolId !== input.candidatePoolId ||
    prepared.selectedEventId !== input.selectedEventId ||
    prepared.claimGroupId !== input.claimGroupId
  ) return null;
  return {
    schemaVersion: HOST_REASONING_PRIVATE_TASK_COORDINATES_SCHEMA_VERSION,
    taskId: prepared.taskId,
    taskType: prepared.taskType,
    screen: prepared.screen,
    runId: prepared.runId,
    candidatePoolId: prepared.candidatePoolId,
    selectedEventId: prepared.selectedEventId,
    claimGroupId: prepared.claimGroupId,
    expectedParentRevision: input.expectedParentRevision,
    expectedScopeFingerprint: input.expectedScopeFingerprint,
    expectedCandidatePoolFingerprint: input.expectedCandidatePoolFingerprint,
    expectedEventFingerprint: input.expectedEventFingerprint,
    createdAt: prepared.createdAt,
    expiresAt: prepared.expiresAt,
    status: prepared.status,
    retryCount: prepared.retryCount,
    resultId: prepared.resultId,
  };
}

export function updatePrivateHostTaskCoordinates(
  coordinates: HostReasoningPrivateTaskCoordinates,
  task: HostReasoningPublicTaskState,
) {
  if (!hostReasoningPublicTaskMatchesCoordinates(task, coordinates)) return null;
  return {
    ...coordinates,
    status: task.status,
    retryCount: task.retryCount,
    resultId: task.resultId,
    expiresAt: task.expiresAt,
  } satisfies HostReasoningPrivateTaskCoordinates;
}

export function hostReasoningPublicTaskMatchesCoordinates(
  task: HostReasoningPublicTaskState,
  coordinates: HostReasoningPrivateTaskCoordinates,
) {
  return task.taskId === coordinates.taskId &&
    task.taskType === coordinates.taskType &&
    task.screen === coordinates.screen && task.runId === coordinates.runId &&
    task.candidatePoolId === coordinates.candidatePoolId &&
    task.selectedEventId === coordinates.selectedEventId &&
    task.claimGroupId === coordinates.claimGroupId &&
    task.retryCount === coordinates.retryCount;
}

export function upsertPrivateHostTask(
  registryValue: unknown,
  task: HostReasoningPrivateTaskCoordinates,
) {
  const registry = restoreHostReasoningPrivateTaskRegistry(registryValue);
  return restoreHostReasoningPrivateTaskRegistry({
    schemaVersion: HOST_REASONING_PRIVATE_TASK_REGISTRY_SCHEMA_VERSION,
    tasks: [
      ...registry.tasks.filter((candidate) =>
        candidate.runId !== task.runId || candidate.taskType !== task.taskType
      ),
      task,
    ],
  });
}

export function hostReasoningTaskIsTerminal(
  status: HostReasoningTaskStatus,
) {
  return terminalStatuses.has(status);
}

export function hostReasoningTaskCanRetry(
  task: Pick<HostReasoningPublicTaskState, "status" | "retryCount"> |
    Pick<HostReasoningPrivateTaskCoordinates, "status" | "retryCount">,
) {
  return task.retryCount === 0 && [
    "message-rejected",
    "validation-failed",
    "expired",
    "cancelled",
  ].includes(task.status);
}
