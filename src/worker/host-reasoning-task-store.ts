import {
  HOST_REASONING_TASK_TYPES,
  HOST_REASONING_TASK_SCHEMA_VERSION,
  fingerprintHostReasoningValue,
  isHostReasoningTaskTerminal,
  requireHostReasoningTask,
  serializeHostReasoningValue,
  transitionHostReasoningTask,
  type HostReasoningMessageChannel,
  type HostReasoningTask,
  type HostReasoningTaskLifecycleEvent,
  type HostReasoningTaskType,
} from "../core/host-reasoning-task";
import {
  HOST_REASONING_RUN_AUDIT_BUNDLE_MAX_BYTES,
  HOST_REASONING_RUN_AUDIT_BUNDLE_MAX_TASKS,
  HOST_REASONING_RUN_AUDIT_BUNDLE_SCHEMA_VERSION,
  HOST_REASONING_RUN_AUDIT_BUNDLE_TYPE,
  HOST_REASONING_TASK_AUDIT_BUNDLE_SCHEMA_VERSION,
  HOST_REASONING_TASK_AUDIT_BUNDLE_TYPE,
  projectHostReasoningAuditProposal,
  requireHostReasoningRunAuditBundle,
  requireHostReasoningTaskAuditBundle,
  type HostReasoningRunAuditBundle,
  type HostReasoningTaskAuditBundle,
} from "../core/host-reasoning-audit";
import {
  validateHostReasoningInput,
  validateHostReasoningProposal,
} from "./host-reasoning-task-security";
import {
  screen02WorkflowStoreParentRecordKey,
  screen02WorkflowStoreParentRecordMatches,
  type Screen02WorkflowStoreParentGuard,
} from "./screen02-workflow-store";
import {
  sixScreenWorkflowStoreParentRecordKey,
  sixScreenWorkflowStoreParentRecordMatches,
  type SixScreenWorkflowStoreParentGuard,
} from "./six-screen-workflow-store";

export const HOST_REASONING_TASK_STORE_RECORD_SCHEMA_VERSION =
  "shockaudit-host-reasoning-task-store-record-v1" as const;
export const HOST_REASONING_TASK_STORE_MAX_LIFECYCLE_EVENTS = 32;
export const HOST_REASONING_TASK_STORE_MAX_OPERATION_REPLAYS = 32;
export const HOST_REASONING_TASK_STORE_MAX_RESULT_BYTES = 64 * 1024;

export {
  HOST_REASONING_RUN_AUDIT_BUNDLE_MAX_BYTES,
  HOST_REASONING_RUN_AUDIT_BUNDLE_MAX_TASKS,
  HOST_REASONING_RUN_AUDIT_BUNDLE_SCHEMA_VERSION,
  HOST_REASONING_RUN_AUDIT_BUNDLE_TYPE,
  HOST_REASONING_TASK_AUDIT_BUNDLE_SCHEMA_VERSION,
  HOST_REASONING_TASK_AUDIT_BUNDLE_TYPE,
};
export type {
  HostReasoningRunAuditBundle,
  HostReasoningTaskAuditBundle,
};

const recordPrefix = "host-reasoning-task-v1:";
const activePrefix = "host-reasoning-active-v1:";
const expiryPrefix = "host-reasoning-expiry-v1:";
const operationPrefix = "host-reasoning-operation-v1:";
const retryPrefix = "host-reasoning-retry-v1:";
const runPrefix = "host-reasoning-run-v2:";
const runTaskTypePrefix = "host-reasoning-run-task-type-v2:";
// v0.4.03 wrote unescaped run indexes without creation timestamps. Retain
// read/delete support so a post-upgrade parent cascade cannot orphan those
// tasks. New writes use only the collision-safe v2 indexes above.
const legacyRunPrefix = "host-reasoning-run-v1:";
const legacyRunTaskTypePrefix = "host-reasoning-run-task-type-v1:";
const cleanupRetryAt = "1970-01-01T00:00:00.000Z";

export type HostReasoningTaskStoreOperationReplay = {
  operationId: string;
  operationKind: string;
  inputFingerprint: string;
  completedAt: string;
  resultFingerprint: string;
};

export const HOST_REASONING_PANEL_RECONCILIATION_STATUSES = [
  "not-ready",
  "pending",
  "reconciled",
  "failed",
] as const;

export type HostReasoningPanelReconciliation = {
  status: (typeof HOST_REASONING_PANEL_RECONCILIATION_STATUSES)[number];
  lastCheckedAt: string | null;
  reconciledAt: string | null;
  failureCode: string | null;
  failureExplanation: string | null;
};

export type HostReasoningTaskStoreRecord = {
  schemaVersion: typeof HOST_REASONING_TASK_STORE_RECORD_SCHEMA_VERSION;
  task: HostReasoningTask;
  boundedInput: unknown;
  allowedSourceIds: string[];
  retryOfTaskId: string | null;
  capabilityIdConsumed: string | null;
  submissionFingerprint: string | null;
  proposal: unknown | null;
  sourceIdsReferenced: string[];
  lifecycle: HostReasoningTaskLifecycleEvent[];
  panelReconciliation: HostReasoningPanelReconciliation;
  operationReplays: HostReasoningTaskStoreOperationReplay[];
};

export type HostReasoningTaskStoreReadResult =
  | { outcome: "found"; record: HostReasoningTaskStoreRecord }
  | { outcome: "not-found" };

export type HostReasoningTaskPrepareResult =
  | { outcome: "created" | "replayed"; record: HostReasoningTaskStoreRecord }
  | { outcome: "parent-unavailable" }
  | { outcome: "retry-exhausted"; record: HostReasoningTaskStoreRecord };

export type HostReasoningTaskParentGuard =
  | Screen02WorkflowStoreParentGuard
  | SixScreenWorkflowStoreParentGuard;

export type HostReasoningTaskMutationResult =
  | { outcome: "updated" | "replayed"; record: HostReasoningTaskStoreRecord }
  | { outcome: "terminal"; record: HostReasoningTaskStoreRecord }
  | { outcome: "not-found" | "stale" };

type Transaction = {
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<unknown>;
};

export type HostReasoningTaskStoreBackend = {
  get(key: string): Promise<unknown>;
  list(input: { prefix: string; limit?: number }): Promise<Map<string, unknown>>;
  transaction<T>(callback: (transaction: Transaction) => Promise<T>): Promise<T>;
};

const recordKeys = [
  "schemaVersion", "task", "boundedInput", "allowedSourceIds",
  "retryOfTaskId", "capabilityIdConsumed", "submissionFingerprint", "proposal",
  "sourceIdsReferenced", "lifecycle", "panelReconciliation", "operationReplays",
] as const;
const lifecycleKeys = ["from", "to", "at", "failureCode", "note"] as const;
const panelReconciliationKeys = [
  "status", "lastCheckedAt", "reconciledAt", "failureCode",
  "failureExplanation",
] as const;
const replayKeys = [
  "operationId", "operationKind", "inputFingerprint", "completedAt",
  "resultFingerprint",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

function id(value: unknown, label: string) {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(value)
  ) {
    throw new Error(`${label} is invalid.`);
  }
  return value;
}

function fingerprint(value: unknown, label: string) {
  if (
    typeof value !== "string" ||
    !/^(?:fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})$/.test(value)
  ) {
    throw new Error(`${label} is invalid.`);
  }
  return value;
}

function time(value: unknown, label: string) {
  if (typeof value !== "string") throw new Error(`${label} is invalid.`);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    throw new Error(`${label} is invalid.`);
  }
  return value;
}

function clone<T>(value: T): T {
  return JSON.parse(serializeHostReasoningValue(value)) as T;
}

function uniqueIds(value: unknown, label: string) {
  if (
    !Array.isArray(value) || value.length > 100 ||
    value.some((item) => typeof item !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(item)) ||
    new Set(value).size !== value.length
  ) {
    throw new Error(`${label} is invalid.`);
  }
  return [...value] as string[];
}

function recordKey(taskId: string) {
  return `${recordPrefix}${id(taskId, "taskId")}`;
}

function indexComponent(value: string, label: string) {
  return encodeURIComponent(id(value, label));
}

function activeKey(runId: string, taskType: HostReasoningTaskType) {
  return `${activePrefix}${indexComponent(runId, "runId")}:${taskType}`;
}

function legacyActiveKey(runId: string, taskType: HostReasoningTaskType) {
  return `${activePrefix}${id(runId, "runId")}:${taskType}`;
}

function expiryKey(task: HostReasoningTask) {
  return `${expiryPrefix}${task.expiresAt}|${task.taskId}`;
}

function optionalId(value: unknown) {
  try {
    return id(value, "indexed taskId");
  } catch {
    return null;
  }
}

function parseExpiryIndex(key: string, indexedTaskId: unknown) {
  if (!key.startsWith(expiryPrefix)) return null;
  const separator = key.indexOf("|", expiryPrefix.length);
  if (separator < 0) return null;
  try {
    const expiresAt = time(
      key.slice(expiryPrefix.length, separator),
      "indexed expiration",
    );
    const taskId = id(key.slice(separator + 1), "indexed taskId");
    return indexedTaskId === taskId ? { expiresAt, taskId } : null;
  } catch {
    return null;
  }
}

function recoverableExpiryTaskIds(key: string, indexedTaskId: unknown) {
  const values = new Set<string>();
  const indexed = optionalId(indexedTaskId);
  if (indexed) values.add(indexed);
  const separator = key.lastIndexOf("|");
  const fromKey = separator < 0 ? null : optionalId(key.slice(separator + 1));
  if (fromKey) values.add(fromKey);
  return [...values];
}

function operationKey(operationId: string) {
  return `${operationPrefix}${fingerprintHostReasoningValue(id(operationId, "operationId"))}`;
}

function retryKey(predecessorTaskId: string) {
  return `${retryPrefix}${id(predecessorTaskId, "predecessorTaskId")}`;
}

function runKey(runId: string, createdAt: string, taskId: string) {
  return `${runIndexPrefix(runId)}${time(createdAt, "run index creation time")}|${indexComponent(
    taskId,
    "taskId",
  )}`;
}

function runIndexPrefix(runId: string) {
  return `${runPrefix}${indexComponent(runId, "runId")}:`;
}

function legacyRunKey(runId: string, taskId: string) {
  return `${legacyRunIndexPrefix(runId)}${id(taskId, "taskId")}`;
}

function legacyRunIndexPrefix(runId: string) {
  return `${legacyRunPrefix}${id(runId, "runId")}:`;
}

function runTaskTypeKey(
  runId: string,
  taskType: HostReasoningTaskType,
  createdAt: string,
  taskId: string,
) {
  return `${runTaskTypeIndexPrefix(runId, taskType)}${time(
    createdAt,
    "run task-type index creation time",
  )}|${indexComponent(
    taskId,
    "taskId",
  )}`;
}

function runTaskTypeIndexPrefix(
  runId: string,
  taskType: HostReasoningTaskType,
) {
  return `${runTaskTypePrefix}${indexComponent(runId, "runId")}:${taskType}:`;
}

function legacyRunTaskTypeKey(
  runId: string,
  taskType: HostReasoningTaskType,
  taskId: string,
) {
  return `${legacyRunTaskTypeIndexPrefix(runId, taskType)}${id(
    taskId,
    "taskId",
  )}`;
}

function legacyRunTaskTypeIndexPrefix(
  runId: string,
  taskType: HostReasoningTaskType,
) {
  return `${legacyRunTaskTypePrefix}${id(runId, "runId")}:${taskType}:`;
}

function indexedCreationTime(
  indexKey: string,
  prefix: string,
  taskId: string,
) {
  const suffix = `|${indexComponent(taskId, "indexed taskId")}`;
  if (!indexKey.startsWith(prefix) || !indexKey.endsWith(suffix)) return null;
  try {
    const createdAt = time(
      indexKey.slice(prefix.length, -suffix.length),
      "indexed task creation time",
    );
    return indexKey === `${prefix}${createdAt}${suffix}` ? createdAt : null;
  } catch {
    return null;
  }
}

function parseLifecycle(value: unknown): HostReasoningTaskLifecycleEvent[] {
  if (!Array.isArray(value) || value.length < 1 ||
    value.length > HOST_REASONING_TASK_STORE_MAX_LIFECYCLE_EVENTS) {
    throw new Error("Host-task lifecycle is invalid.");
  }
  return value.map((entry, index) => {
    if (!isRecord(entry) || !exactKeys(entry, lifecycleKeys)) {
      throw new Error(`Host-task lifecycle[${index}] is invalid.`);
    }
    const parsed: HostReasoningTaskLifecycleEvent = {
      from: entry.from as HostReasoningTaskLifecycleEvent["from"],
      to: entry.to as HostReasoningTaskLifecycleEvent["to"],
      at: time(entry.at, `lifecycle[${index}].at`),
      failureCode: entry.failureCode === null
        ? null
        : id(entry.failureCode, `lifecycle[${index}].failureCode`),
      note: entry.note === null
        ? null
        : typeof entry.note === "string" && entry.note.length <= 2_000
          ? entry.note
          : (() => { throw new Error(`lifecycle[${index}].note is invalid.`); })(),
    };
    return parsed;
  });
}

function parseReplays(value: unknown): HostReasoningTaskStoreOperationReplay[] {
  if (!Array.isArray(value) || value.length > HOST_REASONING_TASK_STORE_MAX_OPERATION_REPLAYS) {
    throw new Error("Host-task operation replay list is invalid.");
  }
  return value.map((entry, index) => {
    if (!isRecord(entry) || !exactKeys(entry, replayKeys)) {
      throw new Error(`Host-task operation replay[${index}] is invalid.`);
    }
    return {
      operationId: id(entry.operationId, `operationReplays[${index}].operationId`),
      operationKind: id(entry.operationKind, `operationReplays[${index}].operationKind`),
      inputFingerprint: fingerprint(entry.inputFingerprint, `operationReplays[${index}].inputFingerprint`),
      completedAt: time(entry.completedAt, `operationReplays[${index}].completedAt`),
      resultFingerprint: fingerprint(entry.resultFingerprint, `operationReplays[${index}].resultFingerprint`),
    };
  });
}

function parsePanelReconciliation(value: unknown): HostReasoningPanelReconciliation {
  if (!isRecord(value) || !exactKeys(value, panelReconciliationKeys) ||
    !HOST_REASONING_PANEL_RECONCILIATION_STATUSES.includes(
      value.status as HostReasoningPanelReconciliation["status"],
    )) {
    throw new Error("Host-task panel reconciliation is invalid.");
  }
  const parsed: HostReasoningPanelReconciliation = {
    status: value.status as HostReasoningPanelReconciliation["status"],
    lastCheckedAt: value.lastCheckedAt === null
      ? null
      : time(value.lastCheckedAt, "panelReconciliation.lastCheckedAt"),
    reconciledAt: value.reconciledAt === null
      ? null
      : time(value.reconciledAt, "panelReconciliation.reconciledAt"),
    failureCode: value.failureCode === null
      ? null
      : id(value.failureCode, "panelReconciliation.failureCode"),
    failureExplanation: value.failureExplanation === null
      ? null
      : typeof value.failureExplanation === "string" &&
          value.failureExplanation.length > 0 &&
          value.failureExplanation.length <= 2_000 &&
          value.failureExplanation.trim() === value.failureExplanation
        ? value.failureExplanation
        : (() => { throw new Error("panelReconciliation.failureExplanation is invalid."); })(),
  };
  const checked = parsed.lastCheckedAt !== null;
  if (
    (parsed.status === "not-ready" &&
      (checked || parsed.reconciledAt !== null || parsed.failureCode !== null ||
        parsed.failureExplanation !== null)) ||
    (parsed.status === "pending" &&
      (parsed.reconciledAt !== null || parsed.failureCode !== null ||
        parsed.failureExplanation !== null)) ||
    (parsed.status === "reconciled" &&
      (!checked || parsed.reconciledAt === null || parsed.failureCode !== null ||
        parsed.failureExplanation !== null)) ||
    (parsed.status === "failed" &&
      (!checked || parsed.reconciledAt !== null || parsed.failureCode === null ||
        parsed.failureExplanation === null))
  ) {
    throw new Error("Host-task panel reconciliation fields disagree.");
  }
  return parsed;
}

export function requireHostReasoningTaskStoreRecord(
  value: unknown,
): HostReasoningTaskStoreRecord {
  if (!isRecord(value) || !exactKeys(value, recordKeys) ||
    value.schemaVersion !== HOST_REASONING_TASK_STORE_RECORD_SCHEMA_VERSION) {
    throw new Error("Stored host-reasoning task is malformed.");
  }
  const task = requireHostReasoningTask(value.task);
  const boundedInput = validateHostReasoningInput(value.boundedInput);
  if (fingerprintHostReasoningValue(boundedInput) !== task.inputFingerprint) {
    throw new Error("Stored host-task input fingerprint is invalid.");
  }
  const allowedSourceIds = uniqueIds(value.allowedSourceIds, "allowedSourceIds");
  if (fingerprintHostReasoningValue([...allowedSourceIds].sort()) !==
      task.sourcePoolFingerprint) {
    throw new Error("Stored host-task source fingerprint is invalid.");
  }
  const sourceIdsReferenced = uniqueIds(
    value.sourceIdsReferenced,
    "sourceIdsReferenced",
  );
  if (sourceIdsReferenced.some((sourceId) => !allowedSourceIds.includes(sourceId))) {
    throw new Error("Stored host-task proposal cites an unknown source.");
  }
  const proposal = value.proposal === null
    ? null
    : validateHostReasoningProposal(value.proposal);
  const capabilityIdConsumed = value.capabilityIdConsumed === null
    ? null
    : id(value.capabilityIdConsumed, "capabilityIdConsumed");
  const submissionFingerprint = value.submissionFingerprint === null
    ? null
    : fingerprint(value.submissionFingerprint, "submissionFingerprint");
  if ((capabilityIdConsumed === null) !== (submissionFingerprint === null)) {
    throw new Error("Stored host-task consumption fields disagree.");
  }
  if (
    (["validating", "applied"].includes(task.status) && proposal === null) ||
    (proposal !== null && capabilityIdConsumed === null) ||
    (sourceIdsReferenced.length > 0 && proposal === null)
  ) {
    throw new Error("Stored host-task proposal and reservation state disagree.");
  }
  if (
    [
      "prepared", "message-requested", "message-accepted", "message-rejected",
      "awaiting-submission", "submission-received", "cancelled",
    ].includes(task.status) && capabilityIdConsumed !== null
  ) {
    throw new Error("Stored host-task capability was consumed before reservation.");
  }
  const lifecycle = parseLifecycle(value.lifecycle);
  if (
    lifecycle[0]?.from !== null || lifecycle[0]?.to !== "prepared" ||
    lifecycle.at(-1)?.to !== task.status
  ) {
    throw new Error("Stored host-task lifecycle does not match task status.");
  }
  const panelReconciliation = parsePanelReconciliation(value.panelReconciliation);
  if (
    (task.status === "applied") ===
      (panelReconciliation.status === "not-ready")
  ) {
    throw new Error("Stored host-task panel reconciliation disagrees with task status.");
  }
  return {
    schemaVersion: HOST_REASONING_TASK_STORE_RECORD_SCHEMA_VERSION,
    task,
    boundedInput,
    allowedSourceIds,
    retryOfTaskId: value.retryOfTaskId === null
      ? null
      : id(value.retryOfTaskId, "retryOfTaskId"),
    capabilityIdConsumed,
    submissionFingerprint,
    proposal,
    sourceIdsReferenced,
    lifecycle,
    panelReconciliation,
    operationReplays: parseReplays(value.operationReplays),
  };
}

function auditFailureStage(
  record: HostReasoningTaskStoreRecord,
): HostReasoningTaskAuditBundle["failure"]["stage"] {
  const { task } = record;
  if (task.failureCode === null) return null;
  if (task.status === "message-rejected") return "message-delivery";
  if (
    task.status === "validation-failed" &&
    record.proposal !== null
  ) return "application";
  if (task.status === "validation-failed") return "validation";
  if (task.status === "expired") return "expiration";
  if (task.status === "retry-exhausted") return "retry";
  if (task.status === "cancelled") return "cancellation";
  return null;
}

/**
 * Produces the finite, portable audit seam for one stored host task. Frozen
 * model input, capabilities, access credentials, operation replay ids, and
 * conversation content deliberately have no representation in this shape.
 */
export function projectHostReasoningTaskAuditBundle(
  value: unknown,
): HostReasoningTaskAuditBundle {
  const record = requireHostReasoningTaskStoreRecord(value);
  const { task } = record;
  const messageResolvedAt = [...record.lifecycle].reverse().find(
    (event) =>
      event.to === "message-accepted" || event.to === "message-rejected",
  )?.at ?? null;
  const validationFailureRecorded = record.lifecycle.some(
    (event) => event.to === "validation-failed",
  );
  const applicationFailed = validationFailureRecorded &&
    record.proposal !== null;
  const validationDisposition: HostReasoningTaskAuditBundle["validation"]["disposition"] =
    task.status === "validating" ||
        task.status === "superseded" && record.proposal !== null &&
          !validationFailureRecorded
      ? "pending"
      : task.status === "applied" || applicationFailed
      ? "accepted"
      : validationFailureRecorded
        ? "rejected"
        : "not-reached";
  const applicationDisposition: HostReasoningTaskAuditBundle["application"]["disposition"] =
    task.status === "applied"
      ? "applied"
      : applicationFailed
        ? "failed"
        : record.proposal !== null
          ? "pending"
          : "not-reached";
  const proposal = record.proposal === null
    ? null
    : projectHostReasoningAuditProposal({
        taskId: task.taskId,
        taskType: task.taskType,
        proposal: record.proposal,
      });
  const auditProposalFingerprint = proposal === null
    ? null
    : fingerprintHostReasoningValue({
        schemaVersion: "shockaudit-host-audit-proposal-fingerprint-v1",
        taskType: task.taskType,
        proposal,
      });
  const bundle: HostReasoningTaskAuditBundle = {
    schemaVersion: HOST_REASONING_TASK_AUDIT_BUNDLE_SCHEMA_VERSION,
    type: HOST_REASONING_TASK_AUDIT_BUNDLE_TYPE,
    task: {
      taskId: task.taskId,
      taskType: task.taskType,
      screen: task.screen,
      status: task.status,
      coordinates: {
        runId: task.runId,
        candidateId: task.candidateId,
        candidatePoolId: task.candidatePoolId,
        selectedEventId: task.selectedEventId,
        claimGroupId: task.claimGroupId,
        scopeFingerprint: task.scopeFingerprint,
        candidatePoolFingerprint: task.candidatePoolFingerprint,
        eventFingerprint: task.eventFingerprint,
        sourcePoolFingerprint: task.sourcePoolFingerprint,
      },
      promptVersion: task.promptVersion,
      workflowVersion: task.workflowVersion,
      requiredSubmissionSchemaVersion: task.requiredSubmissionSchemaVersion,
      createdAt: task.createdAt,
      expiresAt: task.expiresAt,
    },
    release: {
      appVersion: task.appVersion,
      uiResourceUri: task.uiResourceUri,
    },
    message: {
      channel: task.messageChannel,
      disposition: task.messageDeliveryStatus ?? "not-requested",
      requestedAt: task.messageRequestedAt,
      resolvedAt: messageResolvedAt,
      acceptedAt: task.messageAcceptedAt,
    },
    retry: {
      retryCount: task.retryCount,
      retryOfTaskId: record.retryOfTaskId,
    },
    submission: {
      disposition: task.submissionReceivedAt === null
        ? "not-received"
        : "received",
      receivedAt: task.submissionReceivedAt,
    },
    validation: {
      disposition: validationDisposition,
      validatedAt: task.validatedAt,
    },
    application: {
      disposition: applicationDisposition,
      resultOrigin: applicationDisposition === "not-reached"
        ? null
        : "chatgpt-host",
      resultId: task.resultId,
      appliedAt: task.appliedAt,
    },
    failure: {
      stage: auditFailureStage(record),
    },
    fingerprints: {
      input: task.inputFingerprint,
      auditProposal: auditProposalFingerprint,
    },
    sourceIds: {
      allowed: [...record.allowedSourceIds].sort(),
      referenced: [...record.sourceIdsReferenced].sort(),
    },
    lifecycle: record.lifecycle.map((event) => ({
      from: event.from,
      to: event.to,
      at: event.at,
      failed: event.failureCode !== null,
    })),
    panelReconciliation: {
      status: record.panelReconciliation.status,
      lastCheckedAt: record.panelReconciliation.lastCheckedAt,
      reconciledAt: record.panelReconciliation.reconciledAt,
      failed: record.panelReconciliation.failureCode !== null,
    },
    proposal,
    outcomeValuesInspected: false,
  };
  return requireHostReasoningTaskAuditBundle(bundle);
}

function initialRecord(input: {
  task: HostReasoningTask;
  boundedInput: unknown;
  allowedSourceIds: readonly string[];
  retryOfTaskId: string | null;
  operationId: string;
}): HostReasoningTaskStoreRecord {
  const task = requireHostReasoningTask(input.task);
  if (task.status !== "prepared") {
    throw new Error("A stored host task must begin prepared.");
  }
  const record: HostReasoningTaskStoreRecord = {
    schemaVersion: HOST_REASONING_TASK_STORE_RECORD_SCHEMA_VERSION,
    task,
    boundedInput: validateHostReasoningInput(input.boundedInput),
    allowedSourceIds: uniqueIds([...input.allowedSourceIds], "allowedSourceIds"),
    retryOfTaskId: input.retryOfTaskId,
    capabilityIdConsumed: null,
    submissionFingerprint: null,
    proposal: null,
    sourceIdsReferenced: [],
    lifecycle: [{
      from: null,
      to: "prepared",
      at: task.createdAt,
      failureCode: null,
      note: null,
    }],
    panelReconciliation: {
      status: "not-ready",
      lastCheckedAt: null,
      reconciledAt: null,
      failureCode: null,
      failureExplanation: null,
    },
    operationReplays: [{
      operationId: id(input.operationId, "operationId"),
      operationKind: "prepare",
      inputFingerprint: task.inputFingerprint,
      completedAt: task.createdAt,
      resultFingerprint: fingerprintHostReasoningValue({
        taskId: task.taskId,
        status: task.status,
      }),
    }],
  };
  return requireHostReasoningTaskStoreRecord(record);
}

function sameRetryCoordinates(left: HostReasoningTask, right: HostReasoningTask) {
  const ignored = new Set([
    "taskId", "retryCount", "createdAt", "expiresAt", "status",
    "messageChannel", "messageDeliveryStatus", "messageRequestedAt",
    "messageAcceptedAt", "submissionReceivedAt", "validatedAt", "appliedAt",
    "resultId", "failureCode", "failureExplanation",
  ]);
  const select = (task: HostReasoningTask) => Object.fromEntries(
    Object.entries(task).filter(([key]) => !ignored.has(key)),
  );
  return serializeHostReasoningValue(select(left)) ===
    serializeHostReasoningValue(select(right));
}

function withTransition(
  record: HostReasoningTaskStoreRecord,
  transition: Parameters<typeof transitionHostReasoningTask>[1],
) {
  const next = transitionHostReasoningTask(record.task, transition);
  return requireHostReasoningTaskStoreRecord({
    ...record,
    task: next.task,
    lifecycle: [...record.lifecycle, next.event],
  });
}

function replay(
  record: HostReasoningTaskStoreRecord,
  input: {
    operationId: string;
    operationKind: string;
    inputFingerprint: string;
    completedAt: string;
  },
) {
  const prior = record.operationReplays.find(
    (item) => item.operationId === input.operationId,
  );
  if (prior) {
    if (
      prior.operationKind !== input.operationKind ||
      prior.inputFingerprint !== input.inputFingerprint
    ) {
      throw new Error("A host-task operation ID cannot be reused with different input.");
    }
    return { replayed: true, record } as const;
  }
  const next = requireHostReasoningTaskStoreRecord({
    ...record,
    operationReplays: [...record.operationReplays, {
      ...input,
      resultFingerprint: fingerprintHostReasoningValue({
        taskId: record.task.taskId,
        status: record.task.status,
        inputFingerprint: input.inputFingerprint,
      }),
    }].slice(-HOST_REASONING_TASK_STORE_MAX_OPERATION_REPLAYS),
  });
  return { replayed: false, record: next } as const;
}

export class HostReasoningTaskStore {
  constructor(
    private readonly backend: HostReasoningTaskStoreBackend,
    private readonly options: { enforceParentGuard?: boolean } = {},
  ) {}

  async read(taskId: string): Promise<HostReasoningTaskStoreReadResult> {
    const value = await this.backend.get(recordKey(taskId));
    return value === undefined
      ? { outcome: "not-found" }
      : { outcome: "found", record: requireHostReasoningTaskStoreRecord(value) };
  }

  async readActive(runId: string, taskType: HostReasoningTaskType) {
    const taskId = await this.backend.get(activeKey(runId, taskType));
    if (typeof taskId !== "string") return { outcome: "not-found" } as const;
    const read = await this.read(taskId);
    return read.outcome === "found" && !isHostReasoningTaskTerminal(read.record.task.status)
      ? read
      : { outcome: "not-found" } as const;
  }

  /**
   * Read a finite, sanitized lifecycle export for one retained workflow run.
   * The returned task projections contain no storage-index keys, signed
   * capabilities, operation replay identifiers, frozen model input, or
   * conversation transcript. This is an internal export seam, not an
   * authorization boundary or an MCP tool.
   */
  async exportRunAuditBundle(
    runId: string,
    limit = HOST_REASONING_RUN_AUDIT_BUNDLE_MAX_TASKS,
  ): Promise<HostReasoningRunAuditBundle> {
    const canonicalRunId = id(runId, "runId");
    if (
      !Number.isInteger(limit) || limit < 1 ||
      limit > HOST_REASONING_RUN_AUDIT_BUNDLE_MAX_TASKS
    ) {
      throw new Error("Host-task audit export limit is invalid.");
    }
    const prefix = runIndexPrefix(canonicalRunId);
    const indexed = await this.backend.list({
      prefix,
      limit: HOST_REASONING_RUN_AUDIT_BUNDLE_MAX_TASKS + 1,
    });
    const orderedIndexes = [...indexed.entries()].sort(([left], [right]) =>
      left.localeCompare(right)
    );
    const projected: HostReasoningTaskAuditBundle[] = [];
    for (const [indexKey, indexedTaskId] of orderedIndexes.slice(0, limit)) {
      const taskId = id(indexedTaskId, "indexed taskId");
      const raw = await this.backend.get(recordKey(taskId));
      if (raw === undefined) {
        throw new Error("Host-task audit run index has no retained task.");
      }
      const record = requireHostReasoningTaskStoreRecord(raw);
      if (
        record.task.runId !== canonicalRunId ||
        indexKey !== runKey(
          canonicalRunId,
          record.task.createdAt,
          taskId,
        )
      ) {
        throw new Error("Host-task audit run index points outside its run.");
      }
      projected.push(projectHostReasoningTaskAuditBundle(record));
    }
    projected.sort((left, right) =>
      left.task.createdAt.localeCompare(right.task.createdAt) ||
      left.task.taskId.localeCompare(right.task.taskId)
    );

    let truncated = orderedIndexes.length > limit;
    const tasks: HostReasoningTaskAuditBundle[] = [];
    for (const task of projected) {
      const candidate: HostReasoningRunAuditBundle = {
        schemaVersion: HOST_REASONING_RUN_AUDIT_BUNDLE_SCHEMA_VERSION,
        type: HOST_REASONING_RUN_AUDIT_BUNDLE_TYPE,
        runId: canonicalRunId,
        includedTaskCount: tasks.length + 1,
        truncated,
        tasks: [...tasks, task],
        outcomeValuesInspected: false,
      };
      const byteLength = new TextEncoder().encode(
        serializeHostReasoningValue(candidate),
      ).byteLength;
      if (byteLength > HOST_REASONING_RUN_AUDIT_BUNDLE_MAX_BYTES) {
        truncated = true;
        break;
      }
      tasks.push(task);
    }
    return requireHostReasoningRunAuditBundle({
      schemaVersion: HOST_REASONING_RUN_AUDIT_BUNDLE_SCHEMA_VERSION,
      type: HOST_REASONING_RUN_AUDIT_BUNDLE_TYPE,
      runId: canonicalRunId,
      includedTaskCount: tasks.length,
      truncated,
      tasks,
      outcomeValuesInspected: false,
    });
  }

  async prepare(input: {
    task: HostReasoningTask;
    boundedInput: unknown;
    allowedSourceIds: readonly string[];
    retryOfTaskId?: string | null;
    operationId: string;
    parentGuard?: HostReasoningTaskParentGuard;
  }): Promise<HostReasoningTaskPrepareResult> {
    const requested = initialRecord({
      ...input,
      retryOfTaskId: input.retryOfTaskId ?? null,
    });
    return this.backend.transaction(async (transaction) => {
      if (this.options.enforceParentGuard) {
        if (!input.parentGuard || input.parentGuard.runId !== requested.task.runId) {
          throw new Error("A guarded host task requires its exact workflow parent.");
        }
        if (requested.task.createdAt >= input.parentGuard.expiresAt) {
          return { outcome: "parent-unavailable" };
        }
        const sixScreen = "parentKind" in input.parentGuard &&
          input.parentGuard.parentKind === "six-screen";
        const parent = await transaction.get(sixScreen
          ? sixScreenWorkflowStoreParentRecordKey(requested.task.runId)
          : screen02WorkflowStoreParentRecordKey(requested.task.runId));
        const matches = sixScreen
          ? sixScreenWorkflowStoreParentRecordMatches(
              parent,
              input.parentGuard as SixScreenWorkflowStoreParentGuard,
            )
          : screen02WorkflowStoreParentRecordMatches(
              parent,
              input.parentGuard as Screen02WorkflowStoreParentGuard,
            );
        if (!matches) {
          return { outcome: "parent-unavailable" };
        }
      }
      const priorOperationTaskId = await transaction.get(
        operationKey(input.operationId),
      );
      if (typeof priorOperationTaskId === "string") {
        const prior = await transaction.get(recordKey(priorOperationTaskId));
        const record = requireHostReasoningTaskStoreRecord(prior);
        if (
          record.task.taskId !== requested.task.taskId ||
          record.task.inputFingerprint !== requested.task.inputFingerprint ||
          record.task.taskType !== requested.task.taskType ||
          record.task.runId !== requested.task.runId ||
          record.retryOfTaskId !== requested.retryOfTaskId
        ) {
          throw new Error("A host-task prepare operation cannot be rebound.");
        }
        return { outcome: "replayed", record };
      }

      if (requested.task.retryCount === 1) {
        if (!requested.retryOfTaskId) {
          throw new Error("A retry task requires its predecessor task ID.");
        }
        const priorValue = await transaction.get(recordKey(requested.retryOfTaskId));
        if (priorValue === undefined) {
          throw new Error("A retry task predecessor was not found.");
        }
        const prior = requireHostReasoningTaskStoreRecord(priorValue);
        if (
          prior.task.retryCount === 1 &&
          sameRetryCoordinates(prior.task, requested.task) &&
          [
            "message-rejected", "validation-failed", "expired",
            "retry-exhausted",
          ].includes(prior.task.status)
        ) {
          const exhausted = prior.task.status === "retry-exhausted"
            ? prior
            : withTransition(prior, {
                status: "retry-exhausted",
                at: requested.task.createdAt,
                failureCode: "retry-exhausted",
                failureExplanation:
                  "This host task already used its one explicit retry.",
              });
          if (exhausted !== prior) {
            await transaction.put(
              recordKey(requested.retryOfTaskId),
              exhausted,
            );
            await transaction.delete(expiryKey(prior.task));
            const priorActiveKey = activeKey(
              prior.task.runId,
              prior.task.taskType,
            );
            if (
              await transaction.get(priorActiveKey) ===
                requested.retryOfTaskId
            ) {
              await transaction.delete(priorActiveKey);
            }
          }
          return { outcome: "retry-exhausted", record: exhausted };
        }
        if (
          prior.task.retryCount !== 0 ||
          !["message-rejected", "validation-failed", "expired"].includes(
            prior.task.status,
          ) ||
          requested.task.createdAt < prior.lifecycle.at(-1)!.at ||
          !sameRetryCoordinates(prior.task, requested.task)
        ) {
          throw new Error("A retry task does not match one retryable predecessor.");
        }
        const existingRetryTaskId = await transaction.get(
          retryKey(requested.retryOfTaskId),
        );
        if (
          typeof existingRetryTaskId === "string" &&
          existingRetryTaskId !== requested.task.taskId
        ) {
          throw new Error("A host task permits only one explicit retry.");
        }
      } else if (requested.retryOfTaskId !== null) {
        throw new Error("An initial host task cannot name a retry predecessor.");
      }

      const activeIndexKey = activeKey(
        requested.task.runId,
        requested.task.taskType,
      );
      const activeTaskId = await transaction.get(activeIndexKey);
      if (typeof activeTaskId === "string" && activeTaskId !== requested.task.taskId) {
        const activeValue = await transaction.get(recordKey(activeTaskId));
        if (activeValue !== undefined) {
          const active = requireHostReasoningTaskStoreRecord(activeValue);
          if (!isHostReasoningTaskTerminal(active.task.status)) {
            const superseded = withTransition(active, {
              status: "superseded",
              at: requested.task.createdAt,
            });
            await transaction.put(recordKey(activeTaskId), superseded);
            await transaction.delete(expiryKey(active.task));
          }
        }
      }
      await transaction.put(recordKey(requested.task.taskId), requested);
      await transaction.put(
        runKey(
          requested.task.runId,
          requested.task.createdAt,
          requested.task.taskId,
        ),
        requested.task.taskId,
      );
      await transaction.put(
        runTaskTypeKey(
          requested.task.runId,
          requested.task.taskType,
          requested.task.createdAt,
          requested.task.taskId,
        ),
        requested.task.taskId,
      );
      if (requested.retryOfTaskId) {
        await transaction.put(
          retryKey(requested.retryOfTaskId),
          requested.task.taskId,
        );
      }
      await transaction.put(activeIndexKey, requested.task.taskId);
      await transaction.put(operationKey(input.operationId), requested.task.taskId);
      await transaction.put(expiryKey(requested.task), requested.task.taskId);
      return { outcome: "created", record: requested };
    });
  }

  private async mutate(
    taskId: string,
    input: {
      operationId: string;
      operationKind: string;
      inputFingerprint: string;
      at: string;
      refuseBeforeReplay?: (record: HostReasoningTaskStoreRecord) => boolean;
      refuseMutation?: (record: HostReasoningTaskStoreRecord) => boolean;
      apply: (record: HostReasoningTaskStoreRecord) =>
        HostReasoningTaskStoreRecord;
    },
  ): Promise<HostReasoningTaskMutationResult> {
    return this.backend.transaction(async (transaction) => {
      const value = await transaction.get(recordKey(taskId));
      if (value === undefined) return { outcome: "not-found" };
      const current = requireHostReasoningTaskStoreRecord(value);
      if (input.refuseBeforeReplay?.(current)) {
        return { outcome: "terminal", record: current };
      }
      const checked = replay(current, {
        operationId: input.operationId,
        operationKind: input.operationKind,
        inputFingerprint: input.inputFingerprint,
        completedAt: input.at,
      });
      if (checked.replayed) return { outcome: "replayed", record: current };
      if (input.refuseMutation?.(current)) {
        return { outcome: "terminal", record: current };
      }
      const next = input.apply(checked.record);
      await transaction.put(recordKey(taskId), next);
      if (isHostReasoningTaskTerminal(next.task.status)) {
        const key = activeKey(next.task.runId, next.task.taskType);
        if (await transaction.get(key) === taskId) await transaction.delete(key);
        await transaction.delete(expiryKey(current.task));
      }
      return { outcome: "updated", record: next };
    });
  }

  async recordMessage(input: {
    taskId: string;
    operationId: string;
    channel: HostReasoningMessageChannel;
    phase?: "requested" | "resolved";
    requestOperationId?: string | null;
    /** Authoritative server receipt time; excluded from replay identity. */
    recordedAt?: string;
    accepted: boolean | null;
    requestedAt: string;
    resolvedAt: string | null;
    failureCode?: string;
    failureExplanation?: string;
  }) {
    const phase = input.phase ?? "resolved";
    const requestOperationId = input.requestOperationId === undefined ||
        input.requestOperationId === null
      ? null
      : id(input.requestOperationId, "requestOperationId");
    // Keep the v1 resolution fingerprint and operation kind stable for an
    // older app retrying a possibly committed delivery write after rollout.
    // The new request phase is unambiguous because it always carries `phase`.
    const {
      phase: _phase,
      requestOperationId: _requestOperationId,
      recordedAt: _recordedAt,
      ...legacyResolutionInput
    } = input;
    const inputFingerprint = fingerprintHostReasoningValue(
      phase === "requested"
        ? {
            ...legacyResolutionInput,
            phase: "requested",
            requestOperationId: null,
          }
        : requestOperationId === null
          ? legacyResolutionInput
          : { ...legacyResolutionInput, requestOperationId },
    );
    if (phase === "requested") {
      if (
        requestOperationId !== null || input.channel === "unavailable" ||
        input.accepted !== null ||
        input.resolvedAt !== null || input.failureCode !== undefined ||
        input.failureExplanation !== undefined
      ) {
        throw new Error("A message request journal has invalid resolution fields.");
      }
      const journaledAt = input.recordedAt ?? input.requestedAt;
      return this.mutate(input.taskId, {
        operationId: input.operationId,
        operationKind: "record-message-request",
        inputFingerprint,
        at: journaledAt,
        refuseMutation: (record) => record.task.status !== "prepared",
        apply: (record) => withTransition(record, {
          status: "message-requested",
          at: journaledAt,
          messageChannel: input.channel,
        }),
      });
    }
    if (input.accepted === null || input.resolvedAt === null) {
      throw new Error("A message resolution journal is incomplete.");
    }
    const accepted = input.accepted;
    const resolvedAt = requestOperationId === null
      ? input.resolvedAt
      : input.recordedAt ?? input.resolvedAt;
    return this.mutate(input.taskId, {
      operationId: input.operationId,
      operationKind: requestOperationId === null
        ? "record-message-delivery"
        : "record-message-resolution",
      inputFingerprint,
      at: resolvedAt,
      refuseMutation: (record) =>
        record.task.status !== "prepared" &&
        record.task.status !== "message-requested",
      apply: (record) => {
        if (record.task.status === "message-requested") {
          const requestReplay = requestOperationId === null
            ? undefined
            : record.operationReplays.find((entry) =>
                entry.operationId === requestOperationId &&
                entry.operationKind === "record-message-request"
              );
          if (
            !requestReplay ||
            requestReplay.completedAt !== record.task.messageRequestedAt
          ) {
            throw new Error(
              "Message resolution does not own the durable request journal.",
            );
          }
        } else if (requestOperationId !== null) {
          throw new Error(
            "A legacy message resolution cannot name a request journal.",
          );
        }
        let next = record.task.status === "prepared"
          ? withTransition(record, {
              status: "message-requested",
              at: input.requestedAt,
              messageChannel: input.channel,
            })
          : record;
        if (next.task.messageChannel !== input.channel) {
          throw new Error(
            "Message resolution changed its journaled request coordinates.",
          );
        }
        next = withTransition(next, accepted
          ? { status: "message-accepted", at: resolvedAt }
          : {
              status: "message-rejected",
              at: resolvedAt,
              failureCode: input.failureCode ?? "message-request-rejected",
              failureExplanation: input.failureExplanation ??
                "The host rejected the visible message request.",
            });
        if (accepted) {
          next = withTransition(next, {
            status: "awaiting-submission",
            at: resolvedAt,
          });
        }
        return next;
      },
    });
  }

  async reserveSubmission(input: {
    taskId: string;
    operationId: string;
    capabilityId: string;
    submissionFingerprint: string;
    proposal: unknown;
    sourceIdsReferenced: readonly string[];
    receivedAt: string;
  }): Promise<HostReasoningTaskMutationResult> {
    const capabilityId = id(input.capabilityId, "capabilityId");
    const submissionFingerprint = fingerprint(
      input.submissionFingerprint,
      "submissionFingerprint",
    );
    const proposal = validateHostReasoningProposal(input.proposal);
    const referenced = uniqueIds(
      [...input.sourceIdsReferenced],
      "sourceIdsReferenced",
    );
    const inputFingerprint = fingerprintHostReasoningValue({
      capabilityId,
      submissionFingerprint,
      proposal,
      referenced,
    });
    return this.backend.transaction(async (transaction) => {
      const value = await transaction.get(recordKey(input.taskId));
      if (value === undefined) return { outcome: "not-found" };
      let record = requireHostReasoningTaskStoreRecord(value);
      if (record.capabilityIdConsumed !== null) {
        return record.capabilityIdConsumed === capabilityId &&
            record.submissionFingerprint === submissionFingerprint
          ? { outcome: "replayed", record }
          : { outcome: "terminal", record };
      }
      if (
        record.task.status !== "message-requested" &&
        record.task.status !== "awaiting-submission" &&
        record.task.status !== "message-accepted"
      ) {
        return isHostReasoningTaskTerminal(record.task.status)
          ? { outcome: "terminal", record }
          : { outcome: "stale" };
      }
      if (referenced.some((sourceId) => !record.allowedSourceIds.includes(sourceId))) {
        return { outcome: "stale" };
      }
      const withReplay = replay(record, {
        operationId: input.operationId,
        operationKind: "reserve-submission",
        inputFingerprint,
        completedAt: input.receivedAt,
      });
      if (withReplay.replayed) return { outcome: "replayed", record };
      record = withReplay.record.task.status === "message-requested"
        ? withTransition(withReplay.record, {
            status: "message-accepted",
            at: input.receivedAt,
          })
        : withReplay.record;
      record = withTransition(record, {
        status: "submission-received",
        at: input.receivedAt,
      });
      const validating = transitionHostReasoningTask(record.task, {
        status: "validating",
        at: input.receivedAt,
      });
      record = requireHostReasoningTaskStoreRecord({
        ...record,
        task: validating.task,
        capabilityIdConsumed: capabilityId,
        submissionFingerprint,
        proposal,
        sourceIdsReferenced: referenced,
        lifecycle: [...record.lifecycle, validating.event],
      });
      await transaction.put(recordKey(input.taskId), record);
      return { outcome: "updated", record };
    });
  }

  async finalizeSubmissionApplied(input: {
    taskId: string;
    operationId: string;
    capabilityId: string;
    submissionFingerprint: string;
    resultId: string;
    appliedAt: string;
  }): Promise<HostReasoningTaskMutationResult> {
    const capabilityId = id(input.capabilityId, "capabilityId");
    const submissionFingerprint = fingerprint(
      input.submissionFingerprint,
      "submissionFingerprint",
    );
    const resultId = id(input.resultId, "resultId");
    const inputFingerprint = fingerprintHostReasoningValue({
      capabilityId,
      submissionFingerprint,
      resultId,
    });
    return this.backend.transaction(async (transaction) => {
      const value = await transaction.get(recordKey(input.taskId));
      if (value === undefined) return { outcome: "not-found" };
      let record = requireHostReasoningTaskStoreRecord(value);
      if (
        record.capabilityIdConsumed !== capabilityId ||
        record.submissionFingerprint !== submissionFingerprint
      ) {
        return record.capabilityIdConsumed === null &&
            !isHostReasoningTaskTerminal(record.task.status)
          ? { outcome: "stale" }
          : { outcome: "terminal", record };
      }
      if (record.task.status !== "validating") {
        return { outcome: "replayed", record };
      }
      const withReplay = replay(record, {
        operationId: input.operationId,
        operationKind: "finalize-submission-applied",
        inputFingerprint,
        completedAt: input.appliedAt,
      });
      if (withReplay.replayed) return { outcome: "replayed", record };
      const applied = transitionHostReasoningTask(withReplay.record.task, {
        status: "applied",
        at: input.appliedAt,
        resultId,
      });
      record = requireHostReasoningTaskStoreRecord({
        ...withReplay.record,
        task: applied.task,
        lifecycle: [...withReplay.record.lifecycle, applied.event],
        panelReconciliation: {
          status: "pending",
          lastCheckedAt: null,
          reconciledAt: null,
          failureCode: null,
          failureExplanation: null,
        },
      });
      await transaction.put(recordKey(input.taskId), record);
      const key = activeKey(record.task.runId, record.task.taskType);
      if (await transaction.get(key) === input.taskId) await transaction.delete(key);
      await transaction.delete(expiryKey(record.task));
      return { outcome: "updated", record };
    });
  }

  async finalizeSubmissionFailed(input: {
    taskId: string;
    operationId: string;
    capabilityId: string;
    submissionFingerprint: string;
    validatedAt: string;
    failureCode: string;
    failureExplanation: string;
  }): Promise<HostReasoningTaskMutationResult> {
    const capabilityId = id(input.capabilityId, "capabilityId");
    const submissionFingerprint = fingerprint(
      input.submissionFingerprint,
      "submissionFingerprint",
    );
    const failureCode = id(input.failureCode, "failureCode");
    const inputFingerprint = fingerprintHostReasoningValue({
      capabilityId,
      submissionFingerprint,
      failureCode,
      failureExplanation: input.failureExplanation,
    });
    return this.backend.transaction(async (transaction) => {
      const value = await transaction.get(recordKey(input.taskId));
      if (value === undefined) return { outcome: "not-found" };
      let record = requireHostReasoningTaskStoreRecord(value);
      if (
        record.capabilityIdConsumed !== capabilityId ||
        record.submissionFingerprint !== submissionFingerprint
      ) {
        return record.capabilityIdConsumed === null &&
            !isHostReasoningTaskTerminal(record.task.status)
          ? { outcome: "stale" }
          : { outcome: "terminal", record };
      }
      if (record.task.status !== "validating") {
        return { outcome: "replayed", record };
      }
      const withReplay = replay(record, {
        operationId: input.operationId,
        operationKind: "finalize-submission-failed",
        inputFingerprint,
        completedAt: input.validatedAt,
      });
      if (withReplay.replayed) return { outcome: "replayed", record };
      const failed = transitionHostReasoningTask(withReplay.record.task, {
        status: "validation-failed",
        at: input.validatedAt,
        failureCode,
        failureExplanation: input.failureExplanation,
      });
      record = requireHostReasoningTaskStoreRecord({
        ...withReplay.record,
        task: failed.task,
        lifecycle: [...withReplay.record.lifecycle, failed.event],
      });
      await transaction.put(recordKey(input.taskId), record);
      const key = activeKey(record.task.runId, record.task.taskType);
      if (await transaction.get(key) === input.taskId) await transaction.delete(key);
      await transaction.delete(expiryKey(record.task));
      return { outcome: "updated", record };
    });
  }

  async applySubmission(input: {
    taskId: string;
    operationId: string;
    capabilityId: string;
    submissionFingerprint: string;
    proposal: unknown;
    sourceIdsReferenced: readonly string[];
    resultId: string;
    receivedAt: string;
    appliedAt: string;
  }): Promise<HostReasoningTaskMutationResult> {
    const reserved = await this.reserveSubmission({
      taskId: input.taskId,
      operationId: input.operationId,
      capabilityId: input.capabilityId,
      submissionFingerprint: input.submissionFingerprint,
      proposal: input.proposal,
      sourceIdsReferenced: input.sourceIdsReferenced,
      receivedAt: input.receivedAt,
    });
    if (reserved.outcome !== "updated") return reserved;
    return this.finalizeSubmissionApplied({
      taskId: input.taskId,
      operationId: `finalize:${fingerprintHostReasoningValue({
        operationId: input.operationId,
        resultId: input.resultId,
      }).slice(8)}`,
      capabilityId: input.capabilityId,
      submissionFingerprint: input.submissionFingerprint,
      resultId: input.resultId,
      appliedAt: input.appliedAt,
    });
  }

  async rejectSubmission(input: {
    taskId: string;
    operationId: string;
    capabilityId: string;
    submissionFingerprint: string;
    receivedAt: string;
    validatedAt: string;
    failureCode: string;
    failureExplanation: string;
  }): Promise<HostReasoningTaskMutationResult> {
    const capabilityId = id(input.capabilityId, "capabilityId");
    const submissionFingerprint = fingerprint(
      input.submissionFingerprint,
      "submissionFingerprint",
    );
    const inputFingerprint = fingerprintHostReasoningValue({
      capabilityId,
      submissionFingerprint,
      failureCode: input.failureCode,
      failureExplanation: input.failureExplanation,
    });
    return this.backend.transaction(async (transaction) => {
      const value = await transaction.get(recordKey(input.taskId));
      if (value === undefined) return { outcome: "not-found" };
      let record = requireHostReasoningTaskStoreRecord(value);
      if (record.capabilityIdConsumed !== null) {
        return record.capabilityIdConsumed === capabilityId &&
            record.submissionFingerprint === submissionFingerprint
          ? { outcome: "replayed", record }
          : { outcome: "terminal", record };
      }
      if (
        record.task.status !== "message-requested" &&
        record.task.status !== "awaiting-submission" &&
        record.task.status !== "message-accepted"
      ) {
        return isHostReasoningTaskTerminal(record.task.status)
          ? { outcome: "terminal", record }
          : { outcome: "stale" };
      }
      const withReplay = replay(record, {
        operationId: input.operationId,
        operationKind: "reject-submission",
        inputFingerprint,
        completedAt: input.validatedAt,
      });
      if (withReplay.replayed) return { outcome: "replayed", record };
      record = withReplay.record.task.status === "message-requested"
        ? withTransition(withReplay.record, {
            status: "message-accepted",
            at: input.receivedAt,
          })
        : withReplay.record;
      record = withTransition(record, {
        status: "submission-received",
        at: input.receivedAt,
      });
      const validating = transitionHostReasoningTask(record.task, {
        status: "validating",
        at: input.receivedAt,
      });
      const rejected = transitionHostReasoningTask(validating.task, {
        status: "validation-failed",
        at: input.validatedAt,
        failureCode: input.failureCode,
        failureExplanation: input.failureExplanation,
      });
      record = requireHostReasoningTaskStoreRecord({
        ...record,
        task: rejected.task,
        capabilityIdConsumed: capabilityId,
        submissionFingerprint,
        lifecycle: [...record.lifecycle, validating.event, rejected.event],
      });
      await transaction.put(recordKey(input.taskId), record);
      const key = activeKey(record.task.runId, record.task.taskType);
      if (await transaction.get(key) === input.taskId) await transaction.delete(key);
      await transaction.delete(expiryKey(record.task));
      return { outcome: "updated", record };
    });
  }

  async recordPanelReconciliation(input: {
    taskId: string;
    operationId: string;
    reconciled: boolean;
    /** Observation metadata; excluded from the operation's replay identity. */
    checkedAt: string;
    failureCode?: string;
    failureExplanation?: string;
  }): Promise<HostReasoningTaskMutationResult> {
    const inputFingerprint = fingerprintHostReasoningValue({
      reconciled: input.reconciled,
      failureCode: input.failureCode ?? null,
      failureExplanation: input.failureExplanation ?? null,
    });
    return this.mutate(input.taskId, {
      operationId: input.operationId,
      operationKind: "record-panel-reconciliation",
      inputFingerprint,
      at: input.checkedAt,
      // A successful acknowledgement is absorbing. In particular, a delayed
      // panel-timeout report must not replace it after the client has already
      // confirmed the exact rendered and persisted result.
      refuseMutation: (record) =>
        record.panelReconciliation.status === "reconciled",
      apply: (record) => {
        if (record.task.status !== "applied") {
          throw new Error("Panel reconciliation can be recorded only for an applied task.");
        }
        const panelReconciliation: HostReasoningPanelReconciliation =
          input.reconciled
            ? {
                status: "reconciled",
                lastCheckedAt: time(input.checkedAt, "checkedAt"),
                reconciledAt: time(input.checkedAt, "checkedAt"),
                failureCode: null,
                failureExplanation: null,
              }
            : {
                status: "failed",
                lastCheckedAt: time(input.checkedAt, "checkedAt"),
                reconciledAt: null,
                failureCode: id(
                  input.failureCode ?? "panel-reconciliation-failed",
                  "failureCode",
                ),
                failureExplanation: input.failureExplanation === undefined
                  ? "The result was persisted but the panel did not reconcile it."
                  : typeof input.failureExplanation === "string" &&
                      input.failureExplanation.length > 0 &&
                      input.failureExplanation.length <= 2_000 &&
                      input.failureExplanation.trim() === input.failureExplanation
                    ? input.failureExplanation
                    : (() => { throw new Error("failureExplanation is invalid."); })(),
              };
        return requireHostReasoningTaskStoreRecord({
          ...record,
          panelReconciliation,
        });
      },
    });
  }

  async cancel(input: {
    taskId: string;
    operationId: string;
    at: string;
    reason: string;
  }) {
    return this.mutate(input.taskId, {
      operationId: input.operationId,
      operationKind: "cancel",
      inputFingerprint: fingerprintHostReasoningValue(input.reason),
      at: input.at,
      refuseBeforeReplay: (record) =>
        record.capabilityIdConsumed !== null ||
        record.task.status === "submission-received" ||
        record.task.status === "validating",
      refuseMutation: (record) =>
        isHostReasoningTaskTerminal(record.task.status),
      apply: (record) => withTransition(record, {
        status: "cancelled",
        at: input.at,
        failureCode: "cancelled-by-researcher",
        failureExplanation: input.reason,
      }),
    });
  }

  async expireIfDue(
    taskId: string,
    at: string,
  ): Promise<HostReasoningTaskMutationResult> {
    const canonicalTaskId = id(taskId, "taskId");
    const observedAt = time(at, "expiration observation");
    return this.backend.transaction(async (transaction) => {
      const value = await transaction.get(recordKey(canonicalTaskId));
      if (value === undefined) return { outcome: "not-found" };
      let record = requireHostReasoningTaskStoreRecord(value);
      if (isHostReasoningTaskTerminal(record.task.status)) {
        return { outcome: "terminal", record };
      }
      if (observedAt < record.task.expiresAt) return { outcome: "stale" };
      if (record.task.status === "validating") {
        // A consumed validating record is the durable intent journal for a
        // possibly committed canonical application. Never destroy it on the
        // task TTL: the exact canonical marker must be checked before the task
        // can be finalized, and that reconciliation must never re-run apply.
        // Removing the expiry index prevents an alarm loop; parent-run
        // retirement remains the finite retention boundary.
        await transaction.delete(expiryKey(record.task));
        return { outcome: "replayed", record };
      }
      record = withTransition(record, {
        status: "expired",
        at: record.task.expiresAt,
        failureCode: "task-expired",
        failureExplanation: "No valid structured submission arrived before expiry.",
      });
      await transaction.put(recordKey(canonicalTaskId), record);
      const active = activeKey(record.task.runId, record.task.taskType);
      if (await transaction.get(active) === canonicalTaskId) {
        await transaction.delete(active);
      }
      await transaction.delete(expiryKey(record.task));
      return { outcome: "updated", record };
    });
  }

  async cleanupExpired(at: string, limit = 64) {
    const now = time(at, "cleanup time");
    if (!Number.isInteger(limit) || limit < 1 || limit > 64) {
      throw new Error("Host-task cleanup limit is invalid.");
    }
    const indexed = await this.backend.list({ prefix: expiryPrefix, limit });
    let removed = 0;
    for (const [key, taskId] of indexed) {
      const parsed = parseExpiryIndex(key, taskId);
      if (!parsed) {
        await this.backend.transaction(async (transaction) => {
          await transaction.delete(key);
          for (const recoverableTaskId of recoverableExpiryTaskIds(key, taskId)) {
            const raw = await transaction.get(recordKey(recoverableTaskId));
            if (raw === undefined) continue;
            try {
              const record = requireHostReasoningTaskStoreRecord(raw);
              if (!isHostReasoningTaskTerminal(record.task.status)) {
                await transaction.put(expiryKey(record.task), record.task.taskId);
              }
            } catch {
              // Delete only the malformed index. An unreadable task remains
              // fail-closed and can still be removed through its run index.
            }
          }
        });
        removed += 1;
        continue;
      }
      if (parsed.expiresAt > now) continue;
      await this.backend.transaction(async (transaction) => {
        const value = await transaction.get(recordKey(parsed.taskId));
        if (value === undefined) {
          await transaction.delete(key);
          removed += 1;
          return;
        }
        let record: HostReasoningTaskStoreRecord;
        try {
          record = requireHostReasoningTaskStoreRecord(value);
        } catch {
          await transaction.delete(key);
          removed += 1;
          return;
        }
        if (expiryKey(record.task) !== key) {
          await transaction.delete(key);
          if (!isHostReasoningTaskTerminal(record.task.status)) {
            await transaction.put(expiryKey(record.task), record.task.taskId);
          }
          removed += 1;
          return;
        }
        if (
          !isHostReasoningTaskTerminal(record.task.status) &&
          record.task.status !== "validating"
        ) {
          record = withTransition(record, {
            status: "expired",
            at: record.task.expiresAt,
            failureCode: "task-expired",
            failureExplanation: "No valid structured submission arrived before expiry.",
          });
          await transaction.put(recordKey(parsed.taskId), record);
          const active = activeKey(record.task.runId, record.task.taskType);
          if (await transaction.get(active) === parsed.taskId) {
            await transaction.delete(active);
          }
        }
        await transaction.delete(key);
        removed += 1;
      });
    }
    return removed;
  }

  async nextExpirationAt(): Promise<string | null> {
    const indexed = await this.backend.list({ prefix: expiryPrefix, limit: 16 });
    for (const [key, indexedTaskId] of indexed) {
      const parsed = parseExpiryIndex(key, indexedTaskId);
      return parsed?.expiresAt ?? cleanupRetryAt;
    }
    return null;
  }

  async retireRun(runId: string, limit = 64) {
    const canonicalRunId = id(runId, "runId");
    if (!Number.isInteger(limit) || limit < 1 || limit > 64) {
      throw new Error("Host-task retirement limit is invalid.");
    }
    const [currentIndexes, legacyIndexes] = await Promise.all([
      this.backend.list({
        prefix: runIndexPrefix(canonicalRunId),
        limit: limit + 1,
      }),
      this.backend.list({
        prefix: legacyRunIndexPrefix(canonicalRunId),
        limit: limit + 1,
      }),
    ]);
    const indexed = new Map([
      ...currentIndexes.entries(),
      ...legacyIndexes.entries(),
    ]);
    const entries = [...indexed.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(0, limit);
    let removed = 0;
    for (const [indexKey, indexedTaskId] of entries) {
      await this.backend.transaction(async (transaction) => {
        if (typeof indexedTaskId !== "string") {
          await transaction.delete(indexKey);
          return;
        }
        const legacy = indexKey.startsWith(
          legacyRunIndexPrefix(canonicalRunId),
        );
        const indexedCreatedAt = legacy
          ? null
          : indexedCreationTime(
              indexKey,
              runIndexPrefix(canonicalRunId),
              indexedTaskId,
            );
        if (!legacy && indexedCreatedAt === null) {
          await transaction.delete(indexKey);
          return;
        }
        const key = recordKey(indexedTaskId);
        const raw = await transaction.get(key);
        if (raw !== undefined) {
          const record = requireHostReasoningTaskStoreRecord(raw);
          if (legacy) {
            const exactLegacyKey = legacyRunKey(
              record.task.runId,
              record.task.taskId,
            );
            if (indexKey !== exactLegacyKey) {
              throw new Error("Legacy host-task run index is inconsistent.");
            }
            // An old unescaped prefix can overlap a different run whose id
            // begins with this run id. Never retire that valid foreign row.
            if (record.task.runId !== canonicalRunId) return;
          }
          if (
            record.task.runId !== canonicalRunId ||
            (!legacy && record.task.createdAt !== indexedCreatedAt)
          ) {
            throw new Error("Host-task run index points outside its run.");
          }
          await transaction.delete(expiryKey(record.task));
          const active = activeKey(record.task.runId, record.task.taskType);
          if (await transaction.get(active) === record.task.taskId) {
            await transaction.delete(active);
          }
          const legacyActive = legacyActiveKey(
            record.task.runId,
            record.task.taskType,
          );
          if (await transaction.get(legacyActive) === record.task.taskId) {
            await transaction.delete(legacyActive);
          }
          if (record.retryOfTaskId) {
            await transaction.delete(retryKey(record.retryOfTaskId));
          }
          await transaction.delete(retryKey(record.task.taskId));
          for (const replayEntry of record.operationReplays) {
            await transaction.delete(operationKey(replayEntry.operationId));
          }
          await transaction.delete(runTaskTypeKey(
            record.task.runId,
            record.task.taskType,
            record.task.createdAt,
            record.task.taskId,
          ));
          await transaction.delete(legacyRunTaskTypeKey(
            record.task.runId,
            record.task.taskType,
            record.task.taskId,
          ));
          await transaction.delete(runKey(
            record.task.runId,
            record.task.createdAt,
            record.task.taskId,
          ));
          await transaction.delete(legacyRunKey(
            record.task.runId,
            record.task.taskId,
          ));
          await transaction.delete(key);
          removed += 1;
        } else {
          if (indexedCreatedAt !== null) {
            for (const taskType of HOST_REASONING_TASK_TYPES) {
              await transaction.delete(runTaskTypeKey(
                canonicalRunId,
                taskType,
                indexedCreatedAt,
                indexedTaskId,
              ));
            }
          }
          for (const taskType of HOST_REASONING_TASK_TYPES) {
            await transaction.delete(legacyRunTaskTypeKey(
              canonicalRunId,
              taskType,
              indexedTaskId,
            ));
          }
        }
        await transaction.delete(indexKey);
      });
    }
    return {
      removed,
      batchLimitReached: indexed.size > limit,
    };
  }

  /**
   * Retire only the requested host-task families for one retained parent.
   * The type-specific run index makes the bounded cascade independent of any
   * Screen 2 result records that must remain available for reconciliation.
   */
  async retireRunTaskTypes(
    runId: string,
    taskTypes: readonly HostReasoningTaskType[],
    limit = 64,
  ) {
    const canonicalRunId = id(runId, "runId");
    if (!Number.isInteger(limit) || limit < 1 || limit > 64) {
      throw new Error("Host-task retirement limit is invalid.");
    }
    const knownTypes = new Set<HostReasoningTaskType>(
      HOST_REASONING_TASK_TYPES,
    );
    if (
      taskTypes.length < 1 ||
      new Set(taskTypes).size !== taskTypes.length ||
      taskTypes.some((taskType) => !knownTypes.has(taskType))
    ) {
      throw new Error("Host-task retirement types are invalid.");
    }

    let removed = 0;
    let batchLimitReached = false;
    for (const taskType of taskTypes) {
      const remaining = limit - removed;
      if (remaining === 0) {
        // A bounded follow-up pass will cheaply determine whether another
        // requested type actually has indexed rows.
        batchLimitReached = true;
        break;
      }
      const [currentIndexes, legacyIndexes] = await Promise.all([
        this.backend.list({
          prefix: runTaskTypeIndexPrefix(canonicalRunId, taskType),
          limit: remaining + 1,
        }),
        this.backend.list({
          prefix: legacyRunTaskTypeIndexPrefix(canonicalRunId, taskType),
          limit: remaining + 1,
        }),
      ]);
      const indexed = new Map([
        ...currentIndexes.entries(),
        ...legacyIndexes.entries(),
      ]);
      if (indexed.size > remaining) batchLimitReached = true;
      for (const [indexKey, indexedTaskId] of [...indexed.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .slice(0, remaining)) {
        const didRemove = await this.backend.transaction(
          async (transaction) => {
            if (typeof indexedTaskId !== "string") {
              await transaction.delete(indexKey);
              return false;
            }
            const taskId = id(indexedTaskId, "indexed taskId");
            const legacy = indexKey.startsWith(
              legacyRunTaskTypeIndexPrefix(canonicalRunId, taskType),
            );
            const indexedCreatedAt = legacy
              ? null
              : indexedCreationTime(
                  indexKey,
                  runTaskTypeIndexPrefix(canonicalRunId, taskType),
                  taskId,
                );
            if (!legacy && indexedCreatedAt === null) {
              await transaction.delete(indexKey);
              return false;
            }
            const key = recordKey(taskId);
            const raw = await transaction.get(key);
            if (raw === undefined) {
              if (indexedCreatedAt !== null) {
                await transaction.delete(runKey(
                  canonicalRunId,
                  indexedCreatedAt,
                  taskId,
                ));
              }
              await transaction.delete(legacyRunKey(canonicalRunId, taskId));
              await transaction.delete(indexKey);
              return false;
            }
            let record: HostReasoningTaskStoreRecord;
            try {
              record = requireHostReasoningTaskStoreRecord(raw);
            } catch {
              if (legacy) {
                // A v1 key is delimiter-ambiguous. Without a readable record
                // there is no authoritative run/type binding, so retain the
                // task and retry marker instead of deleting a possible
                // foreign task through an overlapping legacy prefix.
                throw new Error(
                  "Legacy host-task run task-type index has an unreadable record.",
                );
              }
              // The type-scoped index is sufficient authority to remove an
              // unusable record during a parent-owned child cascade. Its
              // unknown auxiliary indexes remain fail-closed and are repaired
              // by their respective bounded cleanup paths.
              if (indexedCreatedAt !== null) {
                await transaction.delete(runKey(
                  canonicalRunId,
                  indexedCreatedAt,
                  taskId,
                ));
              }
              await transaction.delete(legacyRunKey(canonicalRunId, taskId));
              await transaction.delete(indexKey);
              await transaction.delete(key);
              return true;
            }
            if (legacy) {
              const exactLegacyKey = legacyRunTaskTypeKey(
                record.task.runId,
                record.task.taskType,
                record.task.taskId,
              );
              if (indexKey !== exactLegacyKey) {
                throw new Error(
                  "Legacy host-task run task-type index is inconsistent.",
                );
              }
              if (record.task.runId !== canonicalRunId) return false;
            }
            if (
              record.task.runId !== canonicalRunId ||
              record.task.taskType !== taskType ||
              (!legacy && record.task.createdAt !== indexedCreatedAt) ||
              record.task.taskId !== taskId
            ) {
              // Never delete a valid record through a corrupt type index.
              await transaction.delete(indexKey);
              return false;
            }
            await transaction.delete(expiryKey(record.task));
            const active = activeKey(record.task.runId, record.task.taskType);
            if (await transaction.get(active) === record.task.taskId) {
              await transaction.delete(active);
            }
            const legacyActive = legacyActiveKey(
              record.task.runId,
              record.task.taskType,
            );
            if (await transaction.get(legacyActive) === record.task.taskId) {
              await transaction.delete(legacyActive);
            }
            if (record.retryOfTaskId) {
              await transaction.delete(retryKey(record.retryOfTaskId));
            }
            await transaction.delete(retryKey(record.task.taskId));
            for (const replayEntry of record.operationReplays) {
              await transaction.delete(operationKey(replayEntry.operationId));
            }
            await transaction.delete(runKey(
              canonicalRunId,
              record.task.createdAt,
              taskId,
            ));
            await transaction.delete(legacyRunKey(canonicalRunId, taskId));
            await transaction.delete(runTaskTypeKey(
              canonicalRunId,
              taskType,
              record.task.createdAt,
              taskId,
            ));
            await transaction.delete(legacyRunTaskTypeKey(
              canonicalRunId,
              taskType,
              taskId,
            ));
            await transaction.delete(indexKey);
            await transaction.delete(key);
            return true;
          },
        );
        if (didRemove) removed += 1;
      }
      if (batchLimitReached) break;
    }
    return { removed, batchLimitReached };
  }
}

export class InMemoryHostReasoningTaskStoreBackend
  implements HostReasoningTaskStoreBackend {
  private readonly records = new Map<string, unknown>();
  private transactionTail: Promise<void> = Promise.resolve();

  async get(key: string) {
    return this.records.has(key) ? clone(this.records.get(key)) : undefined;
  }

  async list({ prefix, limit = Number.POSITIVE_INFINITY }: {
    prefix: string;
    limit?: number;
  }) {
    return new Map([...this.records.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(0, limit)
      .map(([key, value]) => [key, clone(value)]));
  }

  async transaction<T>(callback: (transaction: Transaction) => Promise<T>) {
    const prior = this.transactionTail;
    let release!: () => void;
    this.transactionTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await prior;
    const writes = new Map<string, unknown>();
    const deletions = new Set<string>();
    const transaction: Transaction = {
      get: async (key) => deletions.has(key)
        ? undefined
        : writes.has(key) ? clone(writes.get(key))
        : this.records.has(key) ? clone(this.records.get(key)) : undefined,
      put: async (key, value) => {
        deletions.delete(key);
        writes.set(key, clone(value));
      },
      delete: async (key) => {
        writes.delete(key);
        deletions.add(key);
      },
    };
    try {
      const result = await callback(transaction);
      for (const key of deletions) this.records.delete(key);
      for (const [key, value] of writes) this.records.set(key, clone(value));
      return result;
    } finally {
      release();
    }
  }
}
