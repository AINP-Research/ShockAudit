export const HOST_REASONING_TASK_SCHEMA_VERSION =
  "shockaudit-host-reasoning-task-v1" as const;

export const HOST_REASONING_TASK_TYPES = [
  "screen02-search-review",
  "screen03-evidence-mapping",
  "screen03-overview-improvement",
  "six-screen-policy-fact-proof",
  "six-screen-mechanism-proof",
  "screen04-study-event-assessment",
  "screen05-theoretical-planning",
  "screen05-study-mechanism-comparison",
] as const;

export const HOST_REASONING_TASK_STATUSES = [
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
] as const;

export const HOST_REASONING_MESSAGE_CHANNELS = [
  "ui/message",
  "sendFollowUpMessage",
  "unavailable",
] as const;

export const HOST_REASONING_MESSAGE_DELIVERY_STATUSES = [
  "requested",
  "accepted",
  "rejected",
] as const;

export type HostReasoningTaskType =
  (typeof HOST_REASONING_TASK_TYPES)[number];
export type HostReasoningTaskStatus =
  (typeof HOST_REASONING_TASK_STATUSES)[number];
export type HostReasoningMessageChannel =
  (typeof HOST_REASONING_MESSAGE_CHANNELS)[number];
export type HostReasoningMessageDeliveryStatus =
  (typeof HOST_REASONING_MESSAGE_DELIVERY_STATUSES)[number];

export type HostReasoningTask = {
  schemaVersion: typeof HOST_REASONING_TASK_SCHEMA_VERSION;
  taskId: string;
  taskType: HostReasoningTaskType;
  screen: "screen-02" | "screen-03" | "screen-04" | "screen-05";
  runId: string;
  candidateId: string | null;
  candidatePoolId: string | null;
  selectedEventId: string | null;
  claimGroupId: string | null;
  scopeFingerprint: string;
  candidatePoolFingerprint: string | null;
  eventFingerprint: string | null;
  sourcePoolFingerprint: string;
  inputFingerprint: string;
  promptVersion: string;
  workflowVersion: string;
  requiredSubmissionSchemaVersion: string;
  createdAt: string;
  expiresAt: string;
  status: HostReasoningTaskStatus;
  messageChannel: HostReasoningMessageChannel | null;
  messageDeliveryStatus: HostReasoningMessageDeliveryStatus | null;
  messageRequestedAt: string | null;
  messageAcceptedAt: string | null;
  submissionReceivedAt: string | null;
  validatedAt: string | null;
  appliedAt: string | null;
  resultId: string | null;
  retryCount: 0 | 1;
  failureCode: string | null;
  failureExplanation: string | null;
  appVersion: string;
  uiResourceUri: string;
  hostModel: string;
  outcomeValuesInspected: false;
};

export type HostReasoningTaskCoordinates = Pick<
  HostReasoningTask,
  | "taskId"
  | "taskType"
  | "screen"
  | "runId"
  | "candidateId"
  | "candidatePoolId"
  | "selectedEventId"
  | "claimGroupId"
  | "scopeFingerprint"
  | "candidatePoolFingerprint"
  | "eventFingerprint"
  | "sourcePoolFingerprint"
  | "inputFingerprint"
  | "promptVersion"
  | "workflowVersion"
  | "requiredSubmissionSchemaVersion"
  | "retryCount"
>;

export type HostReasoningTaskLifecycleEvent = {
  from: HostReasoningTaskStatus | null;
  to: HostReasoningTaskStatus;
  at: string;
  failureCode: string | null;
  note: string | null;
};

const exactTaskKeys = [
  "schemaVersion", "taskId", "taskType", "screen", "runId", "candidateId",
  "candidatePoolId", "selectedEventId", "claimGroupId", "scopeFingerprint",
  "candidatePoolFingerprint", "eventFingerprint", "sourcePoolFingerprint",
  "inputFingerprint", "promptVersion", "workflowVersion",
  "requiredSubmissionSchemaVersion", "createdAt", "expiresAt", "status",
  "messageChannel", "messageDeliveryStatus", "messageRequestedAt",
  "messageAcceptedAt", "submissionReceivedAt", "validatedAt", "appliedAt",
  "resultId", "retryCount", "failureCode", "failureExplanation", "appVersion",
  "uiResourceUri", "hostModel", "outcomeValuesInspected",
] as const;

const fingerprintPattern = /^(?:fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})$/;
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
const versionPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

function requireIdentifier(value: unknown, label: string) {
  if (typeof value !== "string" || !identifierPattern.test(value)) {
    throw new Error(`${label} must be a bounded canonical identifier.`);
  }
  return value;
}

function requireVersion(value: unknown, label: string) {
  if (typeof value !== "string" || !versionPattern.test(value)) {
    throw new Error(`${label} must be a bounded version identifier.`);
  }
  return value;
}

function requireFingerprint(value: unknown, label: string) {
  if (typeof value !== "string" || !fingerprintPattern.test(value)) {
    throw new Error(`${label} must be a canonical fingerprint.`);
  }
  return value;
}

function requireNullableIdentifier(value: unknown, label: string) {
  return value === null ? null : requireIdentifier(value, label);
}

function requireNullableFingerprint(value: unknown, label: string) {
  return value === null ? null : requireFingerprint(value, label);
}

function requireTimestamp(value: unknown, label: string) {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a canonical ISO timestamp.`);
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    throw new Error(`${label} must be a canonical ISO timestamp.`);
  }
  return value;
}

function requireNullableTimestamp(value: unknown, label: string) {
  return value === null ? null : requireTimestamp(value, label);
}

function requireBoundedText(value: unknown, label: string, maximum: number) {
  if (
    typeof value !== "string" || value.length < 1 || value.length > maximum ||
    value.trim() !== value
  ) {
    throw new Error(`${label} must be bounded canonical text.`);
  }
  return value;
}

function requireNullableBoundedText(
  value: unknown,
  label: string,
  maximum: number,
) {
  return value === null ? null : requireBoundedText(value, label, maximum);
}

function validateCoordinateShape(task: HostReasoningTask) {
  if (
    task.taskType === "screen02-search-review" &&
    (task.screen !== "screen-02" || task.candidateId !== null ||
      task.candidatePoolId === null ||
      task.candidatePoolFingerprint === null || task.selectedEventId !== null ||
      task.claimGroupId !== null || task.eventFingerprint !== null)
  ) {
    throw new Error("A Screen 2 search-review task has invalid coordinates.");
  }
  if (
    (task.taskType === "screen03-evidence-mapping" ||
      task.taskType === "screen03-overview-improvement") &&
    (task.screen !== "screen-03" || task.selectedEventId === null ||
      task.eventFingerprint === null || task.candidateId !== null ||
      task.candidatePoolId !== null || task.candidatePoolFingerprint !== null)
  ) {
    throw new Error("A Screen 3 host-reasoning task has invalid coordinates.");
  }
  if (
    task.taskType === "screen03-evidence-mapping" && task.claimGroupId === null
  ) {
    throw new Error("A Screen 3 evidence-mapping task requires a claim group.");
  }
  if (
    task.taskType === "screen03-overview-improvement" &&
    task.claimGroupId !== null
  ) {
    throw new Error("A Screen 3 overview task cannot target a claim group.");
  }
  if (
    task.taskType === "six-screen-policy-fact-proof" &&
    (task.screen !== "screen-02" || task.selectedEventId === null ||
      task.eventFingerprint === null || task.candidateId !== null ||
      task.candidatePoolId !== null || task.candidatePoolFingerprint !== null ||
      task.claimGroupId !== null)
  ) {
    throw new Error("A six-screen factual proof task has invalid coordinates.");
  }
  if (
    task.taskType === "six-screen-mechanism-proof" &&
    (task.screen !== "screen-05" || task.selectedEventId === null ||
      task.eventFingerprint === null || task.candidateId !== null ||
      task.candidatePoolId !== null || task.candidatePoolFingerprint !== null ||
      task.claimGroupId !== null)
  ) {
    throw new Error("A six-screen mechanism proof task has invalid coordinates.");
  }
  if (
    task.taskType === "screen04-study-event-assessment" &&
    (task.screen !== "screen-04" || task.selectedEventId === null ||
      task.eventFingerprint === null || task.candidateId !== null ||
      task.candidatePoolId !== null || task.candidatePoolFingerprint !== null ||
      task.claimGroupId !== null)
  ) {
    throw new Error("A study-first Screen 4 assessment task has invalid coordinates.");
  }
  if (
    (task.taskType === "screen05-theoretical-planning" ||
      task.taskType === "screen05-study-mechanism-comparison") &&
    (task.screen !== "screen-05" || task.selectedEventId === null ||
      task.eventFingerprint === null || task.candidateId !== null ||
      task.candidatePoolId !== null || task.candidatePoolFingerprint !== null ||
      task.claimGroupId !== null)
  ) {
    throw new Error("A study-first Screen 5 task has invalid coordinates.");
  }
}

function validateLifecycleShape(task: HostReasoningTask) {
  const requested = task.messageDeliveryStatus !== null;
  if (
    requested !== (task.messageChannel !== null) ||
    requested !== (task.messageRequestedAt !== null)
  ) {
    throw new Error("Host-task message delivery fields are inconsistent.");
  }
  if (
    (task.messageDeliveryStatus === "accepted") !==
      (task.messageAcceptedAt !== null)
  ) {
    throw new Error("Host-task message acceptance fields are inconsistent.");
  }
  const hasSubmission = task.submissionReceivedAt !== null;
  const requiresSubmission = [
    "submission-received", "validating", "applied", "validation-failed",
  ].includes(task.status);
  const cannotHaveSubmission = [
    "prepared", "message-requested", "message-accepted", "message-rejected",
    "awaiting-submission", "cancelled",
  ].includes(task.status);
  if (requiresSubmission && !hasSubmission || cannotHaveSubmission && hasSubmission) {
    throw new Error("Host-task submission timestamp is inconsistent with status.");
  }
  const hasValidation = task.validatedAt !== null;
  const requiresValidation = ["applied", "validation-failed"].includes(task.status);
  const cannotHaveValidation = [
    "prepared", "message-requested", "message-accepted", "message-rejected",
    "awaiting-submission", "submission-received", "validating", "cancelled",
  ].includes(task.status);
  if (requiresValidation && !hasValidation || cannotHaveValidation && hasValidation) {
    throw new Error("Host-task validation timestamp is inconsistent with status.");
  }
  if (
    hasSubmission && task.messageDeliveryStatus !== "accepted" ||
    hasValidation && !hasSubmission
  ) {
    throw new Error("Host-task submission history is inconsistent.");
  }
  if (
    (task.status === "applied") !==
      (task.appliedAt !== null && task.resultId !== null)
  ) {
    throw new Error("Host-task application fields are inconsistent with status.");
  }
  const failed = [
    "message-rejected", "validation-failed", "expired", "retry-exhausted",
    "cancelled",
  ].includes(task.status);
  if (failed !== (task.failureCode !== null && task.failureExplanation !== null)) {
    throw new Error("Host-task failure fields are inconsistent with status.");
  }
}

export function requireHostReasoningTask(value: unknown): HostReasoningTask {
  if (!isRecord(value) || !exactKeys(value, exactTaskKeys)) {
    throw new Error("Host-reasoning task has unrecognized fields.");
  }
  const createdAt = requireTimestamp(value.createdAt, "createdAt");
  const expiresAt = requireTimestamp(value.expiresAt, "expiresAt");
  if (Date.parse(expiresAt) <= Date.parse(createdAt)) {
    throw new Error("Host-reasoning task expiration must follow creation.");
  }
  if (!HOST_REASONING_TASK_TYPES.includes(value.taskType as HostReasoningTaskType)) {
    throw new Error("Host-reasoning task type is unsupported.");
  }
  if (!HOST_REASONING_TASK_STATUSES.includes(value.status as HostReasoningTaskStatus)) {
    throw new Error("Host-reasoning task status is unsupported.");
  }
  const task: HostReasoningTask = {
    schemaVersion: value.schemaVersion as typeof HOST_REASONING_TASK_SCHEMA_VERSION,
    taskId: requireIdentifier(value.taskId, "taskId"),
    taskType: value.taskType as HostReasoningTaskType,
    screen: value.screen as HostReasoningTask["screen"],
    runId: requireIdentifier(value.runId, "runId"),
    candidateId: requireNullableIdentifier(value.candidateId, "candidateId"),
    candidatePoolId: requireNullableIdentifier(value.candidatePoolId, "candidatePoolId"),
    selectedEventId: requireNullableIdentifier(value.selectedEventId, "selectedEventId"),
    claimGroupId: requireNullableIdentifier(value.claimGroupId, "claimGroupId"),
    scopeFingerprint: requireFingerprint(value.scopeFingerprint, "scopeFingerprint"),
    candidatePoolFingerprint: requireNullableFingerprint(value.candidatePoolFingerprint, "candidatePoolFingerprint"),
    eventFingerprint: requireNullableFingerprint(value.eventFingerprint, "eventFingerprint"),
    sourcePoolFingerprint: requireFingerprint(value.sourcePoolFingerprint, "sourcePoolFingerprint"),
    inputFingerprint: requireFingerprint(value.inputFingerprint, "inputFingerprint"),
    promptVersion: requireVersion(value.promptVersion, "promptVersion"),
    workflowVersion: requireVersion(value.workflowVersion, "workflowVersion"),
    requiredSubmissionSchemaVersion: requireVersion(value.requiredSubmissionSchemaVersion, "requiredSubmissionSchemaVersion"),
    createdAt,
    expiresAt,
    status: value.status as HostReasoningTaskStatus,
    messageChannel: value.messageChannel as HostReasoningMessageChannel | null,
    messageDeliveryStatus:
      value.messageDeliveryStatus as HostReasoningMessageDeliveryStatus | null,
    messageRequestedAt: requireNullableTimestamp(value.messageRequestedAt, "messageRequestedAt"),
    messageAcceptedAt: requireNullableTimestamp(value.messageAcceptedAt, "messageAcceptedAt"),
    submissionReceivedAt: requireNullableTimestamp(value.submissionReceivedAt, "submissionReceivedAt"),
    validatedAt: requireNullableTimestamp(value.validatedAt, "validatedAt"),
    appliedAt: requireNullableTimestamp(value.appliedAt, "appliedAt"),
    resultId: requireNullableIdentifier(value.resultId, "resultId"),
    retryCount: value.retryCount as 0 | 1,
    failureCode: requireNullableIdentifier(value.failureCode, "failureCode"),
    failureExplanation: requireNullableBoundedText(value.failureExplanation, "failureExplanation", 2_000),
    appVersion: requireVersion(value.appVersion, "appVersion"),
    uiResourceUri: requireBoundedText(value.uiResourceUri, "uiResourceUri", 500),
    hostModel: requireVersion(value.hostModel, "hostModel"),
    outcomeValuesInspected: false,
  };
  if (
    value.schemaVersion !== HOST_REASONING_TASK_SCHEMA_VERSION ||
    (value.screen !== "screen-02" && value.screen !== "screen-03" &&
      value.screen !== "screen-04" && value.screen !== "screen-05") ||
    (value.retryCount !== 0 && value.retryCount !== 1) ||
    value.outcomeValuesInspected !== false ||
    (value.messageChannel !== null &&
      !HOST_REASONING_MESSAGE_CHANNELS.includes(value.messageChannel as HostReasoningMessageChannel)) ||
    (value.messageDeliveryStatus !== null &&
      !HOST_REASONING_MESSAGE_DELIVERY_STATUSES.includes(
        value.messageDeliveryStatus as HostReasoningMessageDeliveryStatus,
      ))
  ) {
    throw new Error("Host-reasoning task contains invalid enum or invariant values.");
  }
  for (const timestamp of [
    task.messageRequestedAt, task.messageAcceptedAt, task.submissionReceivedAt,
    task.validatedAt, task.appliedAt,
  ]) {
    if (timestamp && (timestamp < task.createdAt || timestamp >= task.expiresAt)) {
      throw new Error("Host-task lifecycle time falls outside task validity.");
    }
  }
  validateCoordinateShape(task);
  validateLifecycleShape(task);
  return structuredClone(task);
}

export function createHostReasoningTask(
  input: Omit<HostReasoningTask,
    | "schemaVersion" | "status" | "messageChannel" | "messageDeliveryStatus"
    | "messageRequestedAt" | "messageAcceptedAt" | "submissionReceivedAt"
    | "validatedAt" | "appliedAt" | "resultId" | "failureCode"
    | "failureExplanation" | "outcomeValuesInspected">
): HostReasoningTask {
  return requireHostReasoningTask({
    schemaVersion: HOST_REASONING_TASK_SCHEMA_VERSION,
    ...input,
    status: "prepared",
    messageChannel: null,
    messageDeliveryStatus: null,
    messageRequestedAt: null,
    messageAcceptedAt: null,
    submissionReceivedAt: null,
    validatedAt: null,
    appliedAt: null,
    resultId: null,
    failureCode: null,
    failureExplanation: null,
    outcomeValuesInspected: false,
  });
}

const transitions: Record<HostReasoningTaskStatus, readonly HostReasoningTaskStatus[]> = {
  prepared: ["message-requested", "expired", "superseded", "cancelled"],
  "message-requested": ["message-accepted", "message-rejected", "expired", "superseded", "cancelled"],
  "message-accepted": ["awaiting-submission", "submission-received", "expired", "superseded", "cancelled"],
  "message-rejected": ["retry-exhausted", "superseded"],
  "awaiting-submission": ["submission-received", "expired", "superseded", "cancelled"],
  "submission-received": ["validating", "superseded"],
  validating: ["applied", "validation-failed", "expired", "superseded"],
  applied: [],
  "validation-failed": ["retry-exhausted", "superseded"],
  expired: ["retry-exhausted", "superseded"],
  superseded: [],
  "retry-exhausted": [],
  cancelled: ["superseded"],
};

export type HostReasoningTaskTransition = {
  status: HostReasoningTaskStatus;
  at: string;
  messageChannel?: HostReasoningMessageChannel;
  resultId?: string;
  failureCode?: string;
  failureExplanation?: string;
};

export function transitionHostReasoningTask(
  value: HostReasoningTask,
  transition: HostReasoningTaskTransition,
): { task: HostReasoningTask; event: HostReasoningTaskLifecycleEvent } {
  const task = requireHostReasoningTask(value);
  const at = requireTimestamp(transition.at, "transition.at");
  if (
    at < task.createdAt ||
    at >= task.expiresAt &&
      transition.status !== "expired" &&
      transition.status !== "retry-exhausted"
  ) {
    throw new Error("Host-task transition falls outside task validity.");
  }
  if (!transitions[task.status].includes(transition.status)) {
    throw new Error(`Host-task transition ${task.status} -> ${transition.status} is invalid.`);
  }
  const next: HostReasoningTask = structuredClone(task);
  next.status = transition.status;
  if (transition.status === "message-requested") {
    if (!transition.messageChannel) {
      throw new Error("Message request transition requires its channel.");
    }
    next.messageChannel = transition.messageChannel;
    next.messageDeliveryStatus = "requested";
    next.messageRequestedAt = at;
  } else if (transition.status === "message-accepted") {
    next.messageDeliveryStatus = "accepted";
    next.messageAcceptedAt = at;
  } else if (transition.status === "message-rejected") {
    next.messageDeliveryStatus = "rejected";
  } else if (transition.status === "submission-received") {
    next.submissionReceivedAt = at;
  } else if (transition.status === "applied") {
    next.validatedAt = at;
    next.appliedAt = at;
    next.resultId = requireIdentifier(transition.resultId, "resultId");
  } else if (transition.status === "validation-failed") {
    next.validatedAt = at;
  }
  const failed = [
    "message-rejected", "validation-failed", "expired", "retry-exhausted",
    "cancelled",
  ].includes(transition.status);
  if (failed) {
    next.failureCode = requireIdentifier(transition.failureCode, "failureCode");
    next.failureExplanation = requireBoundedText(
      transition.failureExplanation,
      "failureExplanation",
      2_000,
    );
  }
  return {
    task: requireHostReasoningTask(next),
    event: {
      from: task.status,
      to: transition.status,
      at,
      failureCode: next.failureCode,
      note: failed ? next.failureExplanation : null,
    },
  };
}

export function serializeHostReasoningValue(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(serializeHostReasoningValue).join(",")}]`;
  }
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, child]) => child !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => `${JSON.stringify(key)}:${serializeHostReasoningValue(child)}`)
    .join(",")}}`;
}

export function fingerprintHostReasoningValue(value: unknown) {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(serializeHostReasoningValue(value))) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

export function hostReasoningTaskCoordinates(
  value: HostReasoningTask,
): HostReasoningTaskCoordinates {
  const task = requireHostReasoningTask(value);
  const {
    taskId, taskType, screen, runId, candidateId, candidatePoolId,
    selectedEventId, claimGroupId, scopeFingerprint, candidatePoolFingerprint,
    eventFingerprint, sourcePoolFingerprint, inputFingerprint, promptVersion,
    workflowVersion, requiredSubmissionSchemaVersion, retryCount,
  } = task;
  return {
    taskId, taskType, screen, runId, candidateId, candidatePoolId,
    selectedEventId, claimGroupId, scopeFingerprint, candidatePoolFingerprint,
    eventFingerprint, sourcePoolFingerprint, inputFingerprint, promptVersion,
    workflowVersion, requiredSubmissionSchemaVersion, retryCount,
  };
}

export function sameHostReasoningTaskCoordinates(
  left: HostReasoningTaskCoordinates,
  right: HostReasoningTaskCoordinates,
) {
  const normalize = (
    value: HostReasoningTaskCoordinates,
  ): HostReasoningTaskCoordinates => ({
    taskId: value.taskId,
    taskType: value.taskType,
    screen: value.screen,
    runId: value.runId,
    candidateId: value.candidateId,
    candidatePoolId: value.candidatePoolId,
    selectedEventId: value.selectedEventId,
    claimGroupId: value.claimGroupId,
    scopeFingerprint: value.scopeFingerprint,
    candidatePoolFingerprint: value.candidatePoolFingerprint,
    eventFingerprint: value.eventFingerprint,
    sourcePoolFingerprint: value.sourcePoolFingerprint,
    inputFingerprint: value.inputFingerprint,
    promptVersion: value.promptVersion,
    workflowVersion: value.workflowVersion,
    requiredSubmissionSchemaVersion: value.requiredSubmissionSchemaVersion,
    retryCount: value.retryCount,
  });
  return serializeHostReasoningValue(normalize(left)) ===
    serializeHostReasoningValue(normalize(right));
}

export function isHostReasoningTaskTerminal(status: HostReasoningTaskStatus) {
  return [
    "applied", "validation-failed", "expired", "superseded",
    "retry-exhausted", "cancelled", "message-rejected",
  ].includes(status);
}
