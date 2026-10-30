import { fingerprintSixScreenValue } from "./canonical";
import {
  SIX_SCREEN_RESEARCH_TASK_SCHEMA_VERSION,
  requireBoundedIdentifier,
  requireCanonicalInstant,
  requireFingerprint,
  type Dependencies,
} from "./contracts";

export type ResearchTaskKind =
  | "identity"
  | "policy"
  | "coevent"
  | "mechanism"
  | "gap";
export type ResearchTaskProfileName =
  | "identity-standard"
  | "policy-standard"
  | "policy-deep"
  | "coevent-standard"
  | "coevent-deep"
  | "coevent-multisource-v3"
  | "mechanism-standard"
  | "mechanism-deep"
  | "gap-standard";

export type ResourceAccount = {
  sourceQueries: number;
  metadataRecords: number;
  documentAttempts: number;
  usefulDocuments: number;
  transportHops: number;
  receivedBytes: number;
  decodedBytes: number;
  activeResearchMs: number;
  cpuMs: number;
  providerCostUnits: Record<string, number>;
};

export type ResearchTaskLimits = ResourceAccount & {
  maximumHtmlOrStructuredDocumentBytes: number;
  maximumPdfDocumentBytes: number;
  maximumPdfPages: number;
  maximumConcurrentPublishers: number;
  maximumRequestsPerPublisher: number;
};

export type ResearchTaskState =
  | "queued"
  | "running"
  | "waiting_source"
  | "paused"
  | "partial"
  | "completed"
  | "cancelled"
  | "failed"
  | "superseded";

export type ResearchTaskOperationReservation = {
  sourceQueries: number;
  metadataRecords: number;
  documentAttempts: number;
  usefulDocuments: number;
  transportHops: number;
  maximumReceivedBytes: number;
  maximumDecodedBytes: number;
  maximumActiveResearchMs: number;
  maximumCpuMs: number;
  providerCostUnits: Record<string, number>;
};

export type ResearchTaskOperationUsage = Omit<
  ResearchTaskOperationReservation,
  | "maximumReceivedBytes"
  | "maximumDecodedBytes"
  | "maximumActiveResearchMs"
  | "maximumCpuMs"
> & {
  receivedBytes: number;
  decodedBytes: number;
  activeResearchMs: number;
  cpuMs: number;
};

export type ResearchTaskOperation = {
  operationId: string;
  inputFingerprint: string;
  generation: number;
  status: "reserved" | "committed" | "failed" | "ambiguous";
  reservation: ResearchTaskOperationReservation;
  actualUsage: ResearchTaskOperationUsage | null;
  reservedAt: string;
  leaseExpiresAt: string;
  resolvedAt: string | null;
  resultFingerprint: string | null;
};

export type ResearchTask = {
  schemaVersion: typeof SIX_SCREEN_RESEARCH_TASK_SCHEMA_VERSION;
  id: string;
  runId: string;
  lineageId: string;
  kind: ResearchTaskKind;
  parent: Dependencies;
  requestHash: string;
  immutableRequest: unknown;
  revision: number;
  state: ResearchTaskState;
  profileName: ResearchTaskProfileName;
  profileVersion: "six-screen-research-profiles-v1";
  limits: ResearchTaskLimits;
  usage: ResourceAccount;
  reserved: ResourceAccount;
  operations: ResearchTaskOperation[];
  pendingWorkIds: string[];
  completedWorkIds: string[];
  unresolvedRequirementIds: string[];
  stopReason: string | null;
  continuationMode: "panel_driven" | "automatic_standard" | "independent";
  createdAt: string;
  updatedAt: string;
  absoluteDeadline: string;
  expiresAt: string;
};

const MIB = 1024 * 1024;

const commonLimits = {
  transportHops: 48,
  cpuMs: 30_000,
  maximumHtmlOrStructuredDocumentBytes: 2 * MIB,
  maximumPdfDocumentBytes: 6 * MIB,
  maximumPdfPages: 40,
  maximumConcurrentPublishers: 3,
  maximumRequestsPerPublisher: 1,
} as const;

function limits(input: {
  sourceQueries: number;
  documentAttempts: number;
  usefulDocuments: number;
  metadataRecords: number;
  activeResearchMs: number;
  decodedBytes: number;
}): ResearchTaskLimits {
  return {
    ...commonLimits,
    ...input,
    receivedBytes: input.decodedBytes,
    providerCostUnits: {},
  };
}

export const SIX_SCREEN_RESEARCH_PROFILES: Readonly<
  Record<ResearchTaskProfileName, { kind: ResearchTaskKind; limits: ResearchTaskLimits }>
> = Object.freeze({
  "identity-standard": {
    kind: "identity",
    limits: {
      ...limits({
        activeResearchMs: 90_000,
        documentAttempts: 12,
        usefulDocuments: 6,
        sourceQueries: 12,
        // Congress.gov can expose as many as 20 text versions with 12
        // formats apiece for one public law. Screen 1 still validates only a
        // few documents/candidates, but it must be able to account for that
        // bounded representation inventory before selecting the best text.
        metadataRecords: 300,
        decodedBytes: 32 * MIB,
      }),
      // Screen 1 may try three name variants; the first productive variant
      // can then inspect two older result pages. The combined ceiling is five.
      maximumRequestsPerPublisher: 5,
      providerCostUnits: { openstates: 5 },
    },
  },
  "policy-standard": {
    kind: "policy",
    limits: {
      ...limits({
        activeResearchMs: 120_000,
        documentAttempts: 24,
        usefulDocuments: 12,
        sourceQueries: 16,
        metadataRecords: 60,
        decodedBytes: 32 * MIB,
      }),
      // Screen 2 may use one bounded three-request Open States search,
      // one explicit retry, and one model-assisted web-source discovery when
      // deterministic routes leave the core explanation unresolved.
      providerCostUnits: { openstates: 6, openai_web_search: 1 },
    },
  },
  "policy-deep": {
    kind: "policy",
    limits: {
      ...limits({
        activeResearchMs: 300_000,
        documentAttempts: 40,
        usefulDocuments: 20,
        sourceQueries: 24,
        metadataRecords: 60,
        decodedBytes: 64 * MIB,
      }),
      providerCostUnits: { openstates: 12, openai_web_search: 3 },
    },
  },
  "coevent-standard": {
    kind: "coevent",
    limits: limits({
      activeResearchMs: 180_000,
      documentAttempts: 24,
      usefulDocuments: 12,
      sourceQueries: 24,
      metadataRecords: 100,
      decodedBytes: 32 * MIB,
    }),
  },
  "coevent-deep": {
    kind: "coevent",
    limits: limits({
      activeResearchMs: 300_000,
      documentAttempts: 40,
      usefulDocuments: 20,
      sourceQueries: 36,
      metadataRecords: 100,
      decodedBytes: 64 * MIB,
    }),
  },
  "coevent-multisource-v3": {
    kind: "coevent",
    limits: {
      ...limits({
        // The v4 Screen 4 plan can use fourteen bounded routes, including
        // one inspected GovInfo/Congress chain. This ceiling admits the
        // complete saved plan while every adapter retains its own timeout.
        activeResearchMs: 480_000,
        documentAttempts: 40,
        usefulDocuments: 40,
        sourceQueries: 32,
        metadataRecords: 300,
        decodedBytes: 48 * MIB,
      }),
      transportHops: 72,
    },
  },
  "mechanism-standard": {
    kind: "mechanism",
    limits: limits({
      activeResearchMs: 180_000,
      documentAttempts: 16,
      usefulDocuments: 8,
      sourceQueries: 16,
      metadataRecords: 80,
      decodedBytes: 32 * MIB,
    }),
  },
  "mechanism-deep": {
    kind: "mechanism",
    limits: limits({
      activeResearchMs: 300_000,
      documentAttempts: 32,
      usefulDocuments: 16,
      sourceQueries: 24,
      metadataRecords: 80,
      decodedBytes: 64 * MIB,
    }),
  },
  "gap-standard": {
    kind: "gap",
    limits: limits({
      activeResearchMs: 90_000,
      documentAttempts: 8,
      usefulDocuments: 4,
      sourceQueries: 6,
      metadataRecords: 20,
      decodedBytes: 32 * MIB,
    }),
  },
});

export const EMPTY_RESOURCE_ACCOUNT: ResourceAccount = Object.freeze({
  sourceQueries: 0,
  metadataRecords: 0,
  documentAttempts: 0,
  usefulDocuments: 0,
  transportHops: 0,
  receivedBytes: 0,
  decodedBytes: 0,
  activeResearchMs: 0,
  cpuMs: 0,
  providerCostUnits: {},
});

function cloneAccount(account: ResourceAccount): ResourceAccount {
  return {
    ...account,
    providerCostUnits: { ...account.providerCostUnits },
  };
}

function requireNonnegativeInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a nonnegative safe integer.`);
  }
}

function validateCostUnits(units: Record<string, number>, label: string) {
  for (const [provider, value] of Object.entries(units)) {
    requireBoundedIdentifier(provider, `${label} provider`);
    requireNonnegativeInteger(value, `${label} ${provider}`);
  }
}

export function validateResourceAccount(account: ResourceAccount, label: string) {
  for (const [key, value] of Object.entries(account)) {
    if (key === "providerCostUnits") continue;
    requireNonnegativeInteger(value as number, `${label} ${key}`);
  }
  validateCostUnits(account.providerCostUnits, `${label} cost`);
  return account;
}

function addCostUnits(
  left: Record<string, number>,
  right: Record<string, number>,
) {
  const result = { ...left };
  for (const [provider, value] of Object.entries(right)) {
    result[provider] = (result[provider] ?? 0) + value;
  }
  return result;
}

function addAccount(
  account: ResourceAccount,
  increment: ResourceAccount,
): ResourceAccount {
  return {
    sourceQueries: account.sourceQueries + increment.sourceQueries,
    metadataRecords: account.metadataRecords + increment.metadataRecords,
    documentAttempts: account.documentAttempts + increment.documentAttempts,
    usefulDocuments: account.usefulDocuments + increment.usefulDocuments,
    transportHops: account.transportHops + increment.transportHops,
    receivedBytes: account.receivedBytes + increment.receivedBytes,
    decodedBytes: account.decodedBytes + increment.decodedBytes,
    activeResearchMs: account.activeResearchMs + increment.activeResearchMs,
    cpuMs: account.cpuMs + increment.cpuMs,
    providerCostUnits: addCostUnits(
      account.providerCostUnits,
      increment.providerCostUnits,
    ),
  };
}

function reservationAccount(
  reservation: ResearchTaskOperationReservation,
): ResourceAccount {
  return {
    sourceQueries: reservation.sourceQueries,
    metadataRecords: reservation.metadataRecords,
    documentAttempts: reservation.documentAttempts,
    usefulDocuments: reservation.usefulDocuments,
    transportHops: reservation.transportHops,
    receivedBytes: reservation.maximumReceivedBytes,
    decodedBytes: reservation.maximumDecodedBytes,
    activeResearchMs: reservation.maximumActiveResearchMs,
    cpuMs: reservation.maximumCpuMs,
    providerCostUnits: { ...reservation.providerCostUnits },
  };
}

function usageAccount(usage: ResearchTaskOperationUsage): ResourceAccount {
  return {
    sourceQueries: usage.sourceQueries,
    metadataRecords: usage.metadataRecords,
    documentAttempts: usage.documentAttempts,
    usefulDocuments: usage.usefulDocuments,
    transportHops: usage.transportHops,
    receivedBytes: usage.receivedBytes,
    decodedBytes: usage.decodedBytes,
    activeResearchMs: usage.activeResearchMs,
    cpuMs: usage.cpuMs,
    providerCostUnits: { ...usage.providerCostUnits },
  };
}

function subtractAccount(
  account: ResourceAccount,
  decrement: ResourceAccount,
): ResourceAccount {
  const providerCostUnits = { ...account.providerCostUnits };
  for (const [provider, value] of Object.entries(decrement.providerCostUnits)) {
    providerCostUnits[provider] = Math.max(0, (providerCostUnits[provider] ?? 0) - value);
    if (providerCostUnits[provider] === 0) delete providerCostUnits[provider];
  }
  return {
    sourceQueries: Math.max(0, account.sourceQueries - decrement.sourceQueries),
    metadataRecords: Math.max(0, account.metadataRecords - decrement.metadataRecords),
    documentAttempts: Math.max(0, account.documentAttempts - decrement.documentAttempts),
    usefulDocuments: Math.max(0, account.usefulDocuments - decrement.usefulDocuments),
    transportHops: Math.max(0, account.transportHops - decrement.transportHops),
    receivedBytes: Math.max(0, account.receivedBytes - decrement.receivedBytes),
    decodedBytes: Math.max(0, account.decodedBytes - decrement.decodedBytes),
    activeResearchMs: Math.max(0, account.activeResearchMs - decrement.activeResearchMs),
    cpuMs: Math.max(0, account.cpuMs - decrement.cpuMs),
    providerCostUnits,
  };
}

function firstExceededLimit(
  limits: ResearchTaskLimits,
  usage: ResourceAccount,
  reservation: ResourceAccount,
) {
  const total = addAccount(usage, reservation);
  for (const key of [
    "sourceQueries",
    "metadataRecords",
    "documentAttempts",
    "usefulDocuments",
    "transportHops",
    "receivedBytes",
    "decodedBytes",
    "activeResearchMs",
    "cpuMs",
  ] as const) {
    if (total[key] > limits[key]) return key;
  }
  for (const [provider, value] of Object.entries(total.providerCostUnits)) {
    const providerLimit = limits.providerCostUnits[provider];
    // Unconfigured providers have zero authorized cost. A profile must reserve
    // an explicit account-wide allowance before a paid request is admitted.
    if (providerLimit === undefined || value > providerLimit) {
      return `providerCostUnits.${provider}` as const;
    }
  }
  return null;
}

function operationUsageWithinReservation(
  usage: ResearchTaskOperationUsage,
  reservation: ResearchTaskOperationReservation,
) {
  return usage.sourceQueries <= reservation.sourceQueries &&
    usage.metadataRecords <= reservation.metadataRecords &&
    usage.documentAttempts <= reservation.documentAttempts &&
    usage.usefulDocuments <= reservation.usefulDocuments &&
    usage.transportHops <= reservation.transportHops &&
    usage.receivedBytes <= reservation.maximumReceivedBytes &&
    usage.decodedBytes <= reservation.maximumDecodedBytes &&
    usage.activeResearchMs <= reservation.maximumActiveResearchMs &&
    usage.cpuMs <= reservation.maximumCpuMs &&
    Object.entries(usage.providerCostUnits).every(
      ([provider, value]) => value <= (reservation.providerCostUnits[provider] ?? 0),
    );
}

function requireMutableTask(task: ResearchTask) {
  if (["completed", "cancelled", "failed", "superseded"].includes(task.state)) {
    throw new Error(`Research task is terminal (${task.state}).`);
  }
}

export function createResearchTask(input: {
  id: string;
  runId: string;
  lineageId?: string;
  kind: ResearchTaskKind;
  parent: Dependencies;
  immutableRequest: unknown;
  profileName: ResearchTaskProfileName;
  pendingWorkIds: string[];
  unresolvedRequirementIds: string[];
  continuationMode: "panel_driven" | "automatic_standard" | "independent";
  createdAt: string;
  absoluteDeadline: string;
  expiresAt: string;
}): ResearchTask {
  const profile = SIX_SCREEN_RESEARCH_PROFILES[input.profileName];
  if (profile.kind !== input.kind) {
    throw new Error(`Research profile ${input.profileName} cannot run a ${input.kind} task.`);
  }
  requireBoundedIdentifier(input.id, "Research task id");
  requireBoundedIdentifier(input.runId, "Research task run id");
  requireCanonicalInstant(input.createdAt, "Research task createdAt");
  requireCanonicalInstant(input.absoluteDeadline, "Research task deadline");
  requireCanonicalInstant(input.expiresAt, "Research task expiresAt");
  requireFingerprint(
    input.parent.identityFingerprint,
    "Research task parent identity fingerprint",
  );
  if (Date.parse(input.absoluteDeadline) > Date.parse(input.expiresAt)) {
    throw new Error("Research task deadline cannot outlive its resume expiry.");
  }
  const requestHash = fingerprintSixScreenValue(input.immutableRequest);
  return {
    schemaVersion: SIX_SCREEN_RESEARCH_TASK_SCHEMA_VERSION,
    id: input.id,
    runId: input.runId,
    lineageId: input.lineageId ?? input.id,
    kind: input.kind,
    parent: structuredClone(input.parent),
    requestHash,
    immutableRequest: structuredClone(input.immutableRequest),
    revision: 0,
    state: "queued",
    profileName: input.profileName,
    profileVersion: "six-screen-research-profiles-v1",
    limits: structuredClone(profile.limits),
    usage: cloneAccount(EMPTY_RESOURCE_ACCOUNT),
    reserved: cloneAccount(EMPTY_RESOURCE_ACCOUNT),
    operations: [],
    pendingWorkIds: [...new Set(input.pendingWorkIds)],
    completedWorkIds: [],
    unresolvedRequirementIds: [...new Set(input.unresolvedRequirementIds)],
    stopReason: null,
    continuationMode: input.continuationMode,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    absoluteDeadline: input.absoluteDeadline,
    expiresAt: input.expiresAt,
  };
}

export type ReserveResearchTaskResult =
  | { outcome: "reserved" | "replayed"; task: ResearchTask; operation: ResearchTaskOperation }
  | { outcome: "busy"; task: ResearchTask; operation: ResearchTaskOperation }
  | { outcome: "limit_exceeded"; task: ResearchTask; limit: string };

export function reserveResearchTaskOperation(
  current: ResearchTask,
  input: {
    expectedRevision: number;
    operationId: string;
    inputFingerprint: string;
    reservation: ResearchTaskOperationReservation;
    reservedAt: string;
    leaseExpiresAt: string;
  },
): ReserveResearchTaskResult {
  const task = structuredClone(current);
  requireMutableTask(task);
  requireBoundedIdentifier(input.operationId, "Research operation id");
  requireFingerprint(input.inputFingerprint, "Research operation input fingerprint");
  requireCanonicalInstant(input.reservedAt, "Research operation reservedAt");
  requireCanonicalInstant(input.leaseExpiresAt, "Research operation leaseExpiresAt");
  if (task.revision !== input.expectedRevision) {
    throw new Error(`Stale research task revision: expected ${task.revision}, received ${input.expectedRevision}.`);
  }
  validateResourceAccount(reservationAccount(input.reservation), "Research reservation");
  const prior = task.operations.find(({ operationId }) => operationId === input.operationId);
  if (prior) {
    if (prior.inputFingerprint !== input.inputFingerprint) {
      throw new Error("Research operation id was reused for different input.");
    }
    if (prior.status === "reserved" && Date.parse(prior.leaseExpiresAt) > Date.parse(input.reservedAt)) {
      return { outcome: "busy", task, operation: prior };
    }
    return { outcome: "replayed", task, operation: prior };
  }
  if (Date.parse(input.reservedAt) > Date.parse(task.absoluteDeadline)) {
    return { outcome: "limit_exceeded", task, limit: "absoluteDeadline" };
  }
  const proposedReserved = addAccount(task.reserved, reservationAccount(input.reservation));
  const exceeded = firstExceededLimit(task.limits, task.usage, proposedReserved);
  if (exceeded) return { outcome: "limit_exceeded", task, limit: exceeded };
  const operation: ResearchTaskOperation = {
    operationId: input.operationId,
    inputFingerprint: input.inputFingerprint,
    generation: task.operations.length + 1,
    status: "reserved",
    reservation: structuredClone(input.reservation),
    actualUsage: null,
    reservedAt: input.reservedAt,
    leaseExpiresAt: input.leaseExpiresAt,
    resolvedAt: null,
    resultFingerprint: null,
  };
  task.reserved = proposedReserved;
  task.operations.push(operation);
  task.state = "running";
  task.revision += 1;
  task.updatedAt = input.reservedAt;
  return { outcome: "reserved", task, operation };
}

export function commitResearchTaskOperation(
  current: ResearchTask,
  input: {
    expectedRevision: number;
    operationId: string;
    inputFingerprint: string;
    generation: number;
    actualUsage: ResearchTaskOperationUsage;
    completedWorkIds: string[];
    remainingWorkIds: string[];
    unresolvedRequirementIds: string[];
    nextState: "queued" | "waiting_source" | "paused" | "partial" | "completed";
    stopReason: string | null;
    resultFingerprint: string;
    committedAt: string;
  },
) {
  const task = structuredClone(current);
  requireMutableTask(task);
  if (task.revision !== input.expectedRevision) {
    throw new Error(`Stale research task revision: expected ${task.revision}, received ${input.expectedRevision}.`);
  }
  requireFingerprint(input.inputFingerprint, "Research operation input fingerprint");
  requireFingerprint(input.resultFingerprint, "Research operation result fingerprint");
  requireCanonicalInstant(input.committedAt, "Research operation committedAt");
  validateResourceAccount(usageAccount(input.actualUsage), "Research operation usage");
  const operation = task.operations.find(({ operationId }) => operationId === input.operationId);
  if (!operation || operation.inputFingerprint !== input.inputFingerprint) {
    throw new Error("Research operation does not match a reserved operation.");
  }
  if (operation.status === "committed") {
    if (operation.resultFingerprint !== input.resultFingerprint) {
      throw new Error("Committed research operation cannot be applied twice with different output.");
    }
    return { outcome: "replayed" as const, task };
  }
  if (operation.status !== "reserved" || operation.generation !== input.generation) {
    throw new Error("Research operation lease is stale or no longer active.");
  }
  if (!operationUsageWithinReservation(input.actualUsage, operation.reservation)) {
    throw new Error("Research operation used more resources than it reserved.");
  }
  task.reserved = subtractAccount(task.reserved, reservationAccount(operation.reservation));
  task.usage = addAccount(task.usage, usageAccount(input.actualUsage));
  const exceeded = firstExceededLimit(task.limits, task.usage, task.reserved);
  if (exceeded) throw new Error(`Committed research usage exceeds ${exceeded}.`);
  operation.status = "committed";
  operation.actualUsage = structuredClone(input.actualUsage);
  operation.resolvedAt = input.committedAt;
  operation.resultFingerprint = input.resultFingerprint;
  task.completedWorkIds = [...new Set([
    ...task.completedWorkIds,
    ...input.completedWorkIds,
  ])];
  task.pendingWorkIds = [...new Set(input.remainingWorkIds)].filter(
    (id) => !task.completedWorkIds.includes(id),
  );
  task.unresolvedRequirementIds = [...new Set(input.unresolvedRequirementIds)];
  task.state = input.nextState;
  task.stopReason = input.stopReason;
  task.revision += 1;
  task.updatedAt = input.committedAt;
  return { outcome: "committed" as const, task };
}

/**
 * Retires an expired lease without pretending the external GET did not run.
 * Unknown usage is charged at the full reservation before a retry is allowed.
 */
export function expireResearchTaskOperation(
  current: ResearchTask,
  input: {
    expectedRevision: number;
    operationId: string;
    inputFingerprint: string;
    generation: number;
    expiredAt: string;
  },
) {
  const task = structuredClone(current);
  requireMutableTask(task);
  if (task.revision !== input.expectedRevision) {
    throw new Error(`Stale research task revision: expected ${task.revision}, received ${input.expectedRevision}.`);
  }
  requireFingerprint(input.inputFingerprint, "Research operation input fingerprint");
  requireCanonicalInstant(input.expiredAt, "Research operation expiredAt");
  const operation = task.operations.find(
    ({ operationId }) => operationId === input.operationId,
  );
  if (
    !operation || operation.inputFingerprint !== input.inputFingerprint ||
    operation.generation !== input.generation
  ) {
    throw new Error("Expired research operation does not match its saved lease.");
  }
  if (operation.status !== "reserved") {
    return { outcome: "replayed" as const, task };
  }
  if (Date.parse(operation.leaseExpiresAt) > Date.parse(input.expiredAt)) {
    throw new Error("An active research lease cannot be retired as expired.");
  }
  const conservativeUsage: ResearchTaskOperationUsage = {
    sourceQueries: operation.reservation.sourceQueries,
    metadataRecords: operation.reservation.metadataRecords,
    documentAttempts: operation.reservation.documentAttempts,
    usefulDocuments: operation.reservation.usefulDocuments,
    transportHops: operation.reservation.transportHops,
    receivedBytes: operation.reservation.maximumReceivedBytes,
    decodedBytes: operation.reservation.maximumDecodedBytes,
    activeResearchMs: operation.reservation.maximumActiveResearchMs,
    cpuMs: operation.reservation.maximumCpuMs,
    providerCostUnits: { ...operation.reservation.providerCostUnits },
  };
  task.reserved = subtractAccount(
    task.reserved,
    reservationAccount(operation.reservation),
  );
  task.usage = addAccount(task.usage, usageAccount(conservativeUsage));
  operation.status = "ambiguous";
  operation.actualUsage = conservativeUsage;
  operation.resolvedAt = input.expiredAt;
  operation.resultFingerprint = null;
  task.state = "queued";
  task.stopReason = "An expired external-operation lease was conservatively charged before retry.";
  task.revision += 1;
  task.updatedAt = input.expiredAt;
  return { outcome: "expired" as const, task };
}

export function cancelResearchTask(
  current: ResearchTask,
  input: { expectedRevision: number; reason: string; cancelledAt: string },
) {
  const task = structuredClone(current);
  requireMutableTask(task);
  if (task.revision !== input.expectedRevision) {
    throw new Error(`Stale research task revision: expected ${task.revision}, received ${input.expectedRevision}.`);
  }
  requireCanonicalInstant(input.cancelledAt, "Research task cancelledAt");
  if (!input.reason.trim()) throw new Error("Cancellation requires a reason.");
  task.state = "cancelled";
  task.stopReason = input.reason.trim();
  task.revision += 1;
  task.updatedAt = input.cancelledAt;
  return task;
}

const DEEP_PROFILE: Partial<Record<ResearchTaskProfileName, ResearchTaskProfileName>> = {
  "policy-standard": "policy-deep",
  "coevent-standard": "coevent-deep",
  "mechanism-standard": "mechanism-deep",
};

export function extendResearchTask(
  current: ResearchTask,
  input: { expectedRevision: number; extendedAt: string; newAbsoluteDeadline: string },
) {
  const task = structuredClone(current);
  requireMutableTask(task);
  if (task.revision !== input.expectedRevision) {
    throw new Error(`Stale research task revision: expected ${task.revision}, received ${input.expectedRevision}.`);
  }
  const profileName = DEEP_PROFILE[task.profileName];
  if (!profileName) {
    throw new Error(`Research profile ${task.profileName} has no deeper extension.`);
  }
  requireCanonicalInstant(input.extendedAt, "Research task extendedAt");
  requireCanonicalInstant(input.newAbsoluteDeadline, "Research task new deadline");
  if (Date.parse(input.newAbsoluteDeadline) > Date.parse(task.expiresAt)) {
    throw new Error("Deep task deadline cannot outlive its original resume expiry.");
  }
  task.profileName = profileName;
  task.limits = structuredClone(SIX_SCREEN_RESEARCH_PROFILES[profileName].limits);
  task.absoluteDeadline = input.newAbsoluteDeadline;
  task.stopReason = null;
  task.state = task.pendingWorkIds.length ? "queued" : "partial";
  task.revision += 1;
  task.updatedAt = input.extendedAt;
  return task;
}

/** Status reads deliberately clone committed state and perform no advancement. */
export function researchTaskStatus(task: ResearchTask) {
  return structuredClone({
    taskId: task.id,
    runId: task.runId,
    lineageId: task.lineageId,
    revision: task.revision,
    state: task.state,
    profileName: task.profileName,
    usage: task.usage,
    reserved: task.reserved,
    pendingWorkIds: task.pendingWorkIds,
    completedWorkIds: task.completedWorkIds,
    unresolvedRequirementIds: task.unresolvedRequirementIds,
    stopReason: task.stopReason,
    continuationMode: task.continuationMode,
    expiresAt: task.expiresAt,
  });
}
