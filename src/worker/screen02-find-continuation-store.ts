import { serializeDeterministicJson } from
  "../core/screen02-deterministic-json";
import {
  SCREEN_02_DOCUMENT_ACQUISITION_MAX_RECORDED_TOTAL_BYTES,
} from "../core/screen02-document-acquisition";
import { fingerprintScreen02WorkflowValue } from
  "../core/screen02-workflow-state";
import {
  screen02WorkflowStoreParentRecordKey,
  screen02WorkflowStoreParentRecordMatches,
  type Screen02WorkflowStoreParentGuard,
  type Screen02WorkflowStoreRecord,
} from "./screen02-workflow-store";

export const SCREEN_02_FIND_CONTINUATION_STORE_SCHEMA_VERSION =
  "screen-02-find-continuation-store-v2" as const;
const SCREEN_02_FIND_CONTINUATION_STORE_LEGACY_SCHEMA_VERSION =
  "screen-02-find-continuation-store-v1" as const;
export const SCREEN_02_FIND_CONTINUATION_PLATFORM_SUBREQUEST_LIMIT = 50;
export const SCREEN_02_FIND_CONTINUATION_MAX_JOURNAL_ENTRIES = 64;
export const SCREEN_02_FIND_CONTINUATION_MAX_CHECKPOINT_BYTES = 1024 * 1024;
export const SCREEN_02_FIND_CONTINUATION_CLEANUP_BATCH_SIZE = 32;

const RECORD_PREFIX = "screen02-find-continuation-v1:";
const EXPIRY_PREFIX = "screen02-find-continuation-expiry-v1:";
const CLEANUP_RETRY_AT = "1970-01-01T00:00:00.000Z";
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
const FINGERPRINT_PATTERN = /^(?:fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})$/;

export type Screen02FindContinuationParentBinding = {
  runId: string;
  accessTokenSha256: string;
  screen01Fingerprint: string;
  parent: Screen02WorkflowStoreParentGuard;
};

const authenticatedBindings = new WeakSet<object>();

export type Screen02FindContinuationLimits = {
  maxSourceQueries: number;
  maxConnectorFetches: number;
  maxDocumentAttempts: number;
  maxTransportHops: number;
  maxRedirectHops: number;
  maxRetries: number;
  maxReceivedBytes: number;
  maxContinuationRequests: number;
  requiredPlatformSubrequestHeadroom: number;
};

export type Screen02FindContinuationUsage = {
  sourceQueries: number;
  connectorFetches: number;
  documentAttempts: number;
  transportHops: number;
  redirectHops: number;
  retries: number;
  receivedBytes: number;
  continuationRequests: number;
  platformSubrequests: number;
};

export type Screen02FindContinuationWork = Omit<
  Screen02FindContinuationUsage,
  "continuationRequests" | "platformSubrequests"
>;

export type Screen02FindContinuationReservation = Omit<
  Screen02FindContinuationWork,
  "receivedBytes"
> & {
  maximumReceivedBytes: number;
};

export type Screen02FindContinuationJournalEntry = {
  operationId: string;
  inputFingerprint: string;
  leaseGeneration: number;
  status: "reserved" | "committed" | "ambiguous" | "failed";
  reservedAt: string;
  leaseExpiresAt: string;
  resolvedAt: string | null;
  reservation: Screen02FindContinuationReservation;
  actualUsage: Screen02FindContinuationWork | null;
  outcomeFingerprint: string | null;
};

export type Screen02FindContinuationLease = {
  operationId: string;
  inputFingerprint: string;
  leaseGeneration: number;
  reservedAt: string;
  expiresAt: string;
  reservation: Screen02FindContinuationReservation;
};

export type Screen02FindContinuationStatus =
  | "active"
  | "completed"
  | "partial"
  | "failed"
  | "cancelled";

export const SCREEN_02_FIND_CONTINUATION_FAILURE_CLASSES = [
  "source-unavailability",
  "request-construction",
  "dns-transport",
  "parser-identity-rejection",
  "checkpoint-capacity",
  "final-state-capacity",
  "stale-conflicting-operation",
  "unexpected-internal",
] as const;

export type Screen02FindContinuationFailureClass =
  (typeof SCREEN_02_FIND_CONTINUATION_FAILURE_CLASSES)[number];

export const SCREEN_02_FIND_CONTINUATION_FAILURE_STAGES = [
  "source-retrieval",
  "checkpoint-persistence",
  "final-state-persistence",
  "continuation-settlement",
] as const;

export type Screen02FindContinuationFailureStage =
  (typeof SCREEN_02_FIND_CONTINUATION_FAILURE_STAGES)[number];

export type Screen02FindContinuationFailure = {
  stage: Screen02FindContinuationFailureStage;
  failureClass: Screen02FindContinuationFailureClass;
  operationId: string;
  leaseGeneration: number;
  lastSavedRevision: number;
  lastSavedCursor: number;
  checkpointBytes: number | null;
  finalStateBytes: number | null;
  resourceUsage: Screen02FindContinuationUsage;
  retryable: boolean;
  diagnosticReference: string;
  failedAt: string;
};

export type Screen02FindContinuationRecord = {
  schemaVersion: typeof SCREEN_02_FIND_CONTINUATION_STORE_SCHEMA_VERSION;
  continuationId: string;
  runId: string;
  accessTokenSha256: string;
  screen01Fingerprint: string;
  parent: Screen02WorkflowStoreParentGuard;
  discoveryRequestId: string;
  searchRoundId: string;
  candidateSetSnapshotId: string | null;
  exactRequest: unknown;
  requestFingerprint: string;
  criteriaFingerprint: string;
  relevanceProfileFingerprint: string;
  discoveryVersion: string;
  sourcePolicyVersion: string;
  parserVersion: string;
  qualificationVersion: string;
  status: Screen02FindContinuationStatus;
  revision: number;
  cursor: number;
  nextLeaseGeneration: number;
  limits: Screen02FindContinuationLimits;
  usage: Screen02FindContinuationUsage;
  checkpoint: unknown;
  checkpointFingerprint: string;
  lease: Screen02FindContinuationLease | null;
  journal: Screen02FindContinuationJournalEntry[];
  creation: {
    operationId: string;
    inputFingerprint: string;
  };
  cancellation: {
    operationId: string;
    inputFingerprint: string;
    reason: string;
    cancelledAt: string;
  } | null;
  failure: Screen02FindContinuationFailure | null;
  createdAt: string;
  updatedAt: string;
  absoluteDeadline: string;
  expiresAt: string;
};

export type Screen02FindContinuationStoreTransaction = {
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<unknown>;
};

export type Screen02FindContinuationStoreBackend = {
  get(key: string): Promise<unknown>;
  list(input: {
    prefix: string;
    limit?: number;
  }): Promise<Map<string, unknown>>;
  transaction<T>(callback: (
    transaction: Screen02FindContinuationStoreTransaction,
  ) => Promise<T>): Promise<T>;
};

export type Screen02FindContinuationCoordinates = {
  revision: number;
  cursor: number;
};

export type Screen02FindContinuationCreateInput = {
  binding: Screen02FindContinuationParentBinding;
  continuationId: string;
  operationId: string;
  inputFingerprint: string;
  discoveryRequestId: string;
  searchRoundId: string;
  candidateSetSnapshotId: string | null;
  exactRequest: unknown;
  criteriaFingerprint: string;
  relevanceProfileFingerprint: string;
  discoveryVersion: string;
  sourcePolicyVersion: string;
  parserVersion: string;
  qualificationVersion: string;
  limits: Screen02FindContinuationLimits;
  checkpoint: unknown;
  createdAt: string;
  absoluteDeadline: string;
  expiresAt: string;
};

export type Screen02FindContinuationCreateResult =
  | { outcome: "created" | "replayed"; record: Screen02FindContinuationRecord }
  | { outcome: "conflict"; record: Screen02FindContinuationRecord }
  | { outcome: "parent-unavailable" };

export type Screen02FindContinuationReadResult =
  | { outcome: "found"; record: Screen02FindContinuationRecord }
  | { outcome: "not-found" | "unauthorized" | "parent-unavailable" };

export type Screen02FindContinuationReserveInput = {
  binding: Screen02FindContinuationParentBinding;
  continuationId: string;
  expected: Screen02FindContinuationCoordinates;
  operationId: string;
  inputFingerprint: string;
  reservation: Screen02FindContinuationReservation;
  reservedAt: string;
  leaseExpiresAt: string;
};

export type Screen02FindContinuationReserveResult =
  | {
      outcome: "reserved" | "replayed";
      record: Screen02FindContinuationRecord;
      lease: Screen02FindContinuationLease;
    }
  | {
      outcome: "replayed-resolved" | "recovered-ambiguous" | "busy" |
        "conflict" | "terminal";
      record: Screen02FindContinuationRecord;
    }
  | {
      outcome: "limit-exceeded";
      reason: keyof Screen02FindContinuationLimits | "absoluteDeadline";
      record: Screen02FindContinuationRecord;
    }
  | { outcome: "not-found" | "unauthorized" | "parent-unavailable" };

export type Screen02FindContinuationAdvanceInput = {
  binding: Screen02FindContinuationParentBinding;
  continuationId: string;
  expected: Screen02FindContinuationCoordinates;
  operationId: string;
  inputFingerprint: string;
  leaseGeneration: number;
  completedAt: string;
  actualUsage: Screen02FindContinuationWork;
  checkpoint: unknown;
  status: Exclude<Screen02FindContinuationStatus, "cancelled" | "failed">;
  outcomeFingerprint: string;
};

export type Screen02FindContinuationMutationResult =
  | { outcome: "advanced" | "cancelled" | "failed" | "replayed"; record: Screen02FindContinuationRecord }
  | { outcome: "conflict" | "busy" | "terminal"; record: Screen02FindContinuationRecord }
  | { outcome: "not-found" | "unauthorized" | "parent-unavailable" };

export type Screen02FindContinuationCancelInput = {
  binding: Screen02FindContinuationParentBinding;
  continuationId: string;
  expected: Screen02FindContinuationCoordinates;
  operationId: string;
  inputFingerprint: string;
  reason: string;
  cancelledAt: string;
};

export type Screen02FindContinuationFailInput = {
  binding: Screen02FindContinuationParentBinding;
  continuationId: string;
  expected: Screen02FindContinuationCoordinates;
  operationId: string;
  inputFingerprint: string;
  leaseGeneration: number;
  failedAt: string;
  /** Null means the external outcome is ambiguous, so the full reservation is charged. */
  actualUsage: Screen02FindContinuationWork | null;
  /** Exact already-materialized step, saved only while the same lease owns it. */
  checkpoint?: unknown;
  stage: Screen02FindContinuationFailureStage;
  failureClass: Screen02FindContinuationFailureClass;
  checkpointBytes: number | null;
  finalStateBytes: number | null;
  retryable: boolean;
  diagnosticReference: string;
};

export class Screen02FindContinuationStoreValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Screen02FindContinuationStoreValidationError";
  }
}

function fail(message: string): never {
  throw new Screen02FindContinuationStoreValidationError(message);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

function requireObject(value: unknown, keys: readonly string[], label: string) {
  if (!isObject(value) || !exactKeys(value, keys)) {
    fail(`${label} must contain exactly the supported fields.`);
  }
  return value;
}

function requireId(value: unknown, label: string) {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    fail(`${label} is invalid.`);
  }
  return value;
}

function requireFingerprint(value: unknown, label: string) {
  if (typeof value !== "string" || !FINGERPRINT_PATTERN.test(value)) {
    fail(`${label} is invalid.`);
  }
  return value;
}

function requireDigest(value: unknown, label: string) {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    fail(`${label} is invalid.`);
  }
  return value;
}

function requireText(value: unknown, label: string, maximum = 200) {
  if (
    typeof value !== "string" || value.length < 1 || value.length > maximum ||
    value.trim() !== value
  ) fail(`${label} is invalid.`);
  return value;
}

function requireInteger(value: unknown, label: string, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > maximum) {
    fail(`${label} is invalid.`);
  }
  return value as number;
}

function requirePositiveInteger(value: unknown, label: string, maximum: number) {
  const parsed = requireInteger(value, label, maximum);
  if (parsed < 1) fail(`${label} must be positive.`);
  return parsed;
}

function requireTimestamp(value: unknown, label: string) {
  if (
    typeof value !== "string" || !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  ) fail(`${label} is invalid.`);
  return value;
}

function requireBoolean(value: unknown, label: string) {
  if (typeof value !== "boolean") fail(`${label} is invalid.`);
  return value;
}

function requireNullableInteger(value: unknown, label: string) {
  return value === null ? null : requireInteger(value, label);
}

function cloneJson<T>(value: T, label: string): T {
  const serialized = serializeDeterministicJson(value);
  return JSON.parse(serialized) as T;
}

function boundedJson<T>(value: T, label: string, maximumBytes: number): T {
  const serialized = serializeDeterministicJson(value);
  if (new TextEncoder().encode(serialized).byteLength > maximumBytes) {
    fail(`${label} exceeds its byte limit.`);
  }
  return JSON.parse(serialized) as T;
}

async function sha256Digest(value: string) {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
  return `sha256:${[...bytes]
    .map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function digestBytes(value: string) {
  const bytes = new Uint8Array(32);
  let valid = SHA256_PATTERN.test(value);
  const hex = valid ? value.slice(7) : "";
  for (let index = 0; index < bytes.length; index += 1) {
    const byte = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
    if (!Number.isFinite(byte)) valid = false;
    bytes[index] = Number.isFinite(byte) ? byte : 0;
  }
  return { bytes, valid };
}

function constantTimeDigestEqual(left: string, right: string) {
  const first = digestBytes(left);
  const second = digestBytes(right);
  let mismatch = first.valid && second.valid ? 0 : 1;
  for (let index = 0; index < first.bytes.length; index += 1) {
    mismatch |= first.bytes[index]! ^ second.bytes[index]!;
  }
  return mismatch === 0;
}

/**
 * Authenticates one raw parent possession token and returns an ephemeral,
 * non-serializable authority. Only its SHA-256 digest is persisted.
 */
export async function createScreen02FindContinuationBinding(
  parentRecord: Screen02WorkflowStoreRecord,
  accessToken: string,
): Promise<Screen02FindContinuationParentBinding> {
  const parent: Screen02WorkflowStoreParentGuard = {
    runId: parentRecord.runId,
    generation: parentRecord.generation,
    revision: parentRecord.stateRevision,
    stateFingerprint: parentRecord.stateFingerprint,
    expiresAt: parentRecord.expiresAt,
  };
  if (
    parentRecord.mode !== "find" ||
    !screen02WorkflowStoreParentRecordMatches(parentRecord, parent)
  ) fail("The continuation parent record is invalid or is not a Find run.");
  const accessTokenSha256 = await sha256Digest(accessToken);
  if (![parentRecord.accessTokenSha256, ...parentRecord.continuationAccessTokenSha256s]
    .some((digest) => constantTimeDigestEqual(digest, accessTokenSha256))) {
    fail("The continuation parent access token is unauthorized.");
  }
  const binding: Screen02FindContinuationParentBinding = {
    runId: parentRecord.runId,
    accessTokenSha256,
    screen01Fingerprint: parentRecord.screen01Fingerprint,
    parent: Object.freeze({ ...parent }),
  };
  authenticatedBindings.add(binding);
  return Object.freeze(binding);
}

function requireBinding(value: Screen02FindContinuationParentBinding) {
  if (!authenticatedBindings.has(value)) {
    fail("A continuation binding must come from authenticated parent state.");
  }
  return value;
}

const limitsKeys = [
  "maxSourceQueries", "maxConnectorFetches", "maxDocumentAttempts",
  "maxTransportHops", "maxRedirectHops", "maxRetries", "maxReceivedBytes",
  "maxContinuationRequests", "requiredPlatformSubrequestHeadroom",
] as const;
const workKeys = [
  "sourceQueries", "connectorFetches", "documentAttempts", "transportHops",
  "redirectHops", "retries", "receivedBytes",
] as const;
const reservationKeys = [
  "sourceQueries", "connectorFetches", "documentAttempts", "transportHops",
  "redirectHops", "retries", "maximumReceivedBytes",
] as const;
const usageKeys = [...workKeys, "continuationRequests", "platformSubrequests"] as const;

function validateLimits(value: unknown): Screen02FindContinuationLimits {
  const input = requireObject(value, limitsKeys, "Continuation limits");
  const limits = {
    maxSourceQueries: requirePositiveInteger(input.maxSourceQueries, "maxSourceQueries", 64),
    maxConnectorFetches: requirePositiveInteger(input.maxConnectorFetches, "maxConnectorFetches", 64),
    maxDocumentAttempts: requirePositiveInteger(input.maxDocumentAttempts, "maxDocumentAttempts", 24),
    maxTransportHops: requirePositiveInteger(input.maxTransportHops, "maxTransportHops", 96),
    maxRedirectHops: requirePositiveInteger(input.maxRedirectHops, "maxRedirectHops", 72),
    maxRetries: requirePositiveInteger(input.maxRetries, "maxRetries", 24),
    // The extra byte is the persisted diagnostic sentinel for a response
    // rejected at the 6 MiB accepted-byte policy; it is not usable capacity.
    maxReceivedBytes: requirePositiveInteger(
      input.maxReceivedBytes,
      "maxReceivedBytes",
      SCREEN_02_DOCUMENT_ACQUISITION_MAX_RECORDED_TOTAL_BYTES,
    ),
    maxContinuationRequests: requirePositiveInteger(input.maxContinuationRequests, "maxContinuationRequests", SCREEN_02_FIND_CONTINUATION_MAX_JOURNAL_ENTRIES),
    requiredPlatformSubrequestHeadroom: requirePositiveInteger(input.requiredPlatformSubrequestHeadroom, "requiredPlatformSubrequestHeadroom", SCREEN_02_FIND_CONTINUATION_PLATFORM_SUBREQUEST_LIMIT - 1),
  };
  return limits;
}

function validateWork(value: unknown, label: string): Screen02FindContinuationWork {
  const input = requireObject(value, workKeys, label);
  return {
    sourceQueries: requireInteger(input.sourceQueries, `${label} sourceQueries`, 64),
    connectorFetches: requireInteger(input.connectorFetches, `${label} connectorFetches`, 64),
    documentAttempts: requireInteger(input.documentAttempts, `${label} documentAttempts`, 24),
    transportHops: requireInteger(input.transportHops, `${label} transportHops`, 96),
    redirectHops: requireInteger(input.redirectHops, `${label} redirectHops`, 72),
    retries: requireInteger(input.retries, `${label} retries`, 24),
    receivedBytes: requireInteger(
      input.receivedBytes,
      `${label} receivedBytes`,
      SCREEN_02_DOCUMENT_ACQUISITION_MAX_RECORDED_TOTAL_BYTES,
    ),
  };
}

function validateReservation(value: unknown): Screen02FindContinuationReservation {
  const input = requireObject(value, reservationKeys, "Continuation reservation");
  const reservation = {
    sourceQueries: requireInteger(input.sourceQueries, "reservation sourceQueries", 64),
    connectorFetches: requireInteger(input.connectorFetches, "reservation connectorFetches", 64),
    documentAttempts: requireInteger(input.documentAttempts, "reservation documentAttempts", 24),
    transportHops: requireInteger(input.transportHops, "reservation transportHops", 96),
    redirectHops: requireInteger(input.redirectHops, "reservation redirectHops", 72),
    retries: requireInteger(input.retries, "reservation retries", 24),
    maximumReceivedBytes: requireInteger(
      input.maximumReceivedBytes,
      "reservation maximumReceivedBytes",
      SCREEN_02_DOCUMENT_ACQUISITION_MAX_RECORDED_TOTAL_BYTES,
    ),
  };
  if (
    reservation.transportHops <
      reservation.documentAttempts + reservation.redirectHops
  ) {
    fail("Reservation transportHops must cover every document and redirect hop.");
  }
  return reservation;
}

function validateUsage(value: unknown): Screen02FindContinuationUsage {
  const input = requireObject(value, usageKeys, "Continuation usage");
  const work = validateWork(Object.fromEntries(workKeys.map((key) => [key, input[key]])), "Continuation usage");
  const usage = {
    ...work,
    continuationRequests: requireInteger(input.continuationRequests, "usage continuationRequests", SCREEN_02_FIND_CONTINUATION_MAX_JOURNAL_ENTRIES),
    platformSubrequests: requireInteger(input.platformSubrequests, "usage platformSubrequests"),
  };
  return usage;
}

/** Persisted subrequests actually dispatched by the reviewed fixed-host
 * adapter: one Worker fetch for each connector or document/redirect hop. */
export function screen02FindContinuationPlatformSubrequests(
  work: Pick<Screen02FindContinuationWork, "connectorFetches" | "transportHops">,
) {
  return work.connectorFetches + work.transportHops;
}

/** Reservation-only worst case retained for admission/headroom. A future
 * peer-bound arbitrary-host hop may require A + AAAA + one socket. */
export function screen02FindContinuationReservedPlatformSubrequests(
  work: Pick<Screen02FindContinuationWork, "connectorFetches" | "transportHops">,
) {
  return work.connectorFetches + work.transportHops * 3;
}

export function fingerprintScreen02FindContinuationOutcome(input: {
  actualUsage: Screen02FindContinuationWork;
  checkpoint: unknown;
  status: Exclude<Screen02FindContinuationStatus, "cancelled">;
}) {
  return fingerprintScreen02WorkflowValue({
    schemaVersion: "screen-02-find-continuation-outcome-v1",
    actualUsage: input.actualUsage,
    checkpoint: input.checkpoint,
    status: input.status,
  });
}

function emptyUsage(): Screen02FindContinuationUsage {
  return {
    sourceQueries: 0, connectorFetches: 0, documentAttempts: 0,
    transportHops: 0, redirectHops: 0, retries: 0, receivedBytes: 0,
    continuationRequests: 0, platformSubrequests: 0,
  };
}

function recordKey(id: string) {
  return `${RECORD_PREFIX}${requireId(id, "continuationId")}`;
}

function expiryKey(expiresAt: string, id: string) {
  return `${EXPIRY_PREFIX}${expiresAt}:${requireId(id, "continuationId")}`;
}

function parseExpiryKey(key: string) {
  if (!key.startsWith(EXPIRY_PREFIX)) return null;
  const suffix = key.slice(EXPIRY_PREFIX.length);
  const split = suffix.indexOf(":", 24);
  if (split < 0) return null;
  try {
    return {
      expiresAt: requireTimestamp(suffix.slice(0, split), "indexed expiration"),
      continuationId: requireId(suffix.slice(split + 1), "indexed continuationId"),
    };
  } catch {
    return null;
  }
}

function requireCoordinates(value: Screen02FindContinuationCoordinates) {
  return {
    revision: requireInteger(value.revision, "expected revision"),
    cursor: requireInteger(value.cursor, "expected cursor"),
  };
}

function sameCoordinates(record: Screen02FindContinuationRecord, expected: Screen02FindContinuationCoordinates) {
  return record.revision === expected.revision && record.cursor === expected.cursor;
}

function status(value: unknown): Screen02FindContinuationStatus {
  if (!["active", "completed", "partial", "failed", "cancelled"].includes(value as string)) {
    fail("Continuation status is invalid.");
  }
  return value as Screen02FindContinuationStatus;
}

function addUsage(
  current: Screen02FindContinuationUsage,
  work: Screen02FindContinuationWork,
): Screen02FindContinuationUsage {
  const next = { ...current };
  for (const key of workKeys) next[key] += work[key];
  next.platformSubrequests += screen02FindContinuationPlatformSubrequests(work);
  return next;
}

function reservationAsAmbiguousWork(reservation: Screen02FindContinuationReservation) {
  const { maximumReceivedBytes, ...work } = reservation;
  return { ...work, receivedBytes: maximumReceivedBytes };
}

function assertActualWithinReservation(
  actual: Screen02FindContinuationWork,
  reservation: Screen02FindContinuationReservation,
) {
  for (const key of workKeys) {
    const maximum = key === "receivedBytes"
      ? reservation.maximumReceivedBytes
      : reservation[key];
    if (actual[key] > maximum) fail(`Actual ${key} exceeds its reservation.`);
  }
}

function limitFailure(record: Screen02FindContinuationRecord, reservation: Screen02FindContinuationReservation) {
  const { usage, limits } = record;
  const comparisons: Array<[keyof Screen02FindContinuationLimits, number, number]> = [
    ["maxSourceQueries", usage.sourceQueries + reservation.sourceQueries, limits.maxSourceQueries],
    ["maxConnectorFetches", usage.connectorFetches + reservation.connectorFetches, limits.maxConnectorFetches],
    ["maxDocumentAttempts", usage.documentAttempts + reservation.documentAttempts, limits.maxDocumentAttempts],
    ["maxTransportHops", usage.transportHops + reservation.transportHops, limits.maxTransportHops],
    ["maxRedirectHops", usage.redirectHops + reservation.redirectHops, limits.maxRedirectHops],
    ["maxRetries", usage.retries + reservation.retries, limits.maxRetries],
    ["maxReceivedBytes", usage.receivedBytes + reservation.maximumReceivedBytes, limits.maxReceivedBytes],
    ["maxContinuationRequests", usage.continuationRequests + 1, limits.maxContinuationRequests],
  ];
  return comparisons.find(([, next, maximum]) => next > maximum)?.[0] ?? null;
}

function usageIncludesSnapshot(
  current: Screen02FindContinuationUsage,
  snapshot: Screen02FindContinuationUsage,
) {
  return usageKeys.every((key) => current[key] >= snapshot[key]);
}

export function screen02FindContinuationHasPendingRetry(
  record: Screen02FindContinuationRecord,
) {
  const failure = record.failure;
  const latest = record.journal.at(-1);
  return record.status === "active" && record.lease === null &&
    failure?.retryable === true &&
    record.usage.retries < record.limits.maxRetries &&
    latest?.status === "failed" &&
    latest.operationId === failure.operationId &&
    latest.leaseGeneration === failure.leaseGeneration;
}

const legacyRecordKeys = [
  "schemaVersion", "continuationId", "runId", "accessTokenSha256",
  "screen01Fingerprint", "parent", "discoveryRequestId", "searchRoundId",
  "candidateSetSnapshotId", "exactRequest", "requestFingerprint",
  "criteriaFingerprint", "relevanceProfileFingerprint", "discoveryVersion",
  "sourcePolicyVersion", "parserVersion", "qualificationVersion", "status",
  "revision", "cursor", "nextLeaseGeneration", "limits", "usage",
  "checkpoint", "checkpointFingerprint", "lease", "journal", "creation",
  "cancellation", "createdAt", "updatedAt", "absoluteDeadline", "expiresAt",
] as const;
const recordKeys = [
  ...legacyRecordKeys,
  "failure",
] as const;
const parentKeys = ["runId", "generation", "revision", "stateFingerprint", "expiresAt"] as const;
const leaseKeys = ["operationId", "inputFingerprint", "leaseGeneration", "reservedAt", "expiresAt", "reservation"] as const;
const journalKeys = ["operationId", "inputFingerprint", "leaseGeneration", "status", "reservedAt", "leaseExpiresAt", "resolvedAt", "reservation", "actualUsage", "outcomeFingerprint"] as const;
const creationKeys = ["operationId", "inputFingerprint"] as const;
const cancellationKeys = ["operationId", "inputFingerprint", "reason", "cancelledAt"] as const;
const failureKeys = [
  "stage", "failureClass", "operationId", "leaseGeneration",
  "lastSavedRevision", "lastSavedCursor", "checkpointBytes",
  "finalStateBytes", "resourceUsage", "retryable", "diagnosticReference",
  "failedAt",
] as const;

function validateFailure(
  value: unknown,
): Screen02FindContinuationFailure | null {
  if (value === null) return null;
  const input = requireObject(value, failureKeys, "Continuation failure");
  if (!(SCREEN_02_FIND_CONTINUATION_FAILURE_STAGES as readonly unknown[])
    .includes(input.stage)) {
    fail("Continuation failure stage is invalid.");
  }
  if (!(SCREEN_02_FIND_CONTINUATION_FAILURE_CLASSES as readonly unknown[])
    .includes(input.failureClass)) {
    fail("Continuation failure class is invalid.");
  }
  return {
    stage: input.stage as Screen02FindContinuationFailureStage,
    failureClass: input.failureClass as Screen02FindContinuationFailureClass,
    operationId: requireId(input.operationId, "failure operationId"),
    leaseGeneration: requirePositiveInteger(
      input.leaseGeneration,
      "failure leaseGeneration",
      Number.MAX_SAFE_INTEGER,
    ),
    lastSavedRevision: requireInteger(
      input.lastSavedRevision,
      "failure lastSavedRevision",
    ),
    lastSavedCursor: requireInteger(
      input.lastSavedCursor,
      "failure lastSavedCursor",
    ),
    checkpointBytes: requireNullableInteger(
      input.checkpointBytes,
      "failure checkpointBytes",
    ),
    finalStateBytes: requireNullableInteger(
      input.finalStateBytes,
      "failure finalStateBytes",
    ),
    resourceUsage: validateUsage(input.resourceUsage),
    retryable: requireBoolean(input.retryable, "failure retryable"),
    diagnosticReference: requireFingerprint(
      input.diagnosticReference,
      "failure diagnosticReference",
    ),
    failedAt: requireTimestamp(input.failedAt, "failure failedAt"),
  };
}

function validateRecord(value: unknown): Screen02FindContinuationRecord {
  if (!isObject(value)) fail("Continuation record must be an object.");
  const legacy = value.schemaVersion ===
    SCREEN_02_FIND_CONTINUATION_STORE_LEGACY_SCHEMA_VERSION;
  const input = requireObject(
    value,
    legacy ? legacyRecordKeys : recordKeys,
    "Continuation record",
  );
  if (
    input.schemaVersion !== SCREEN_02_FIND_CONTINUATION_STORE_SCHEMA_VERSION &&
    !legacy
  ) {
    fail("Continuation record schema version is unsupported.");
  }
  const parentInput = requireObject(input.parent, parentKeys, "Continuation parent");
  const parent: Screen02WorkflowStoreParentGuard = {
    runId: requireText(parentInput.runId, "parent runId"),
    generation: requireInteger(parentInput.generation, "parent generation"),
    revision: requireInteger(parentInput.revision, "parent revision"),
    stateFingerprint: requireFingerprint(parentInput.stateFingerprint, "parent stateFingerprint"),
    expiresAt: requireTimestamp(parentInput.expiresAt, "parent expiresAt"),
  };
  const parseLease = (value: unknown): Screen02FindContinuationLease | null => {
    if (value === null) return null;
    const item = requireObject(value, leaseKeys, "Continuation lease");
    return {
      operationId: requireId(item.operationId, "lease operationId"),
      inputFingerprint: requireFingerprint(item.inputFingerprint, "lease inputFingerprint"),
      leaseGeneration: requirePositiveInteger(item.leaseGeneration, "lease generation", Number.MAX_SAFE_INTEGER),
      reservedAt: requireTimestamp(item.reservedAt, "lease reservedAt"),
      expiresAt: requireTimestamp(item.expiresAt, "lease expiresAt"),
      reservation: validateReservation(item.reservation),
    };
  };
  if (!Array.isArray(input.journal) || input.journal.length > SCREEN_02_FIND_CONTINUATION_MAX_JOURNAL_ENTRIES) {
    fail("Continuation journal is not a bounded array.");
  }
  const journal = input.journal.map((value, index): Screen02FindContinuationJournalEntry => {
    const item = requireObject(value, journalKeys, `Continuation journal ${index + 1}`);
    if (!["reserved", "committed", "ambiguous", "failed"].includes(item.status as string)) {
      fail("Continuation journal status is invalid.");
    }
    const entry: Screen02FindContinuationJournalEntry = {
      operationId: requireId(item.operationId, "journal operationId"),
      inputFingerprint: requireFingerprint(item.inputFingerprint, "journal inputFingerprint"),
      leaseGeneration: requirePositiveInteger(item.leaseGeneration, "journal leaseGeneration", Number.MAX_SAFE_INTEGER),
      status: item.status as Screen02FindContinuationJournalEntry["status"],
      reservedAt: requireTimestamp(item.reservedAt, "journal reservedAt"),
      leaseExpiresAt: requireTimestamp(item.leaseExpiresAt, "journal leaseExpiresAt"),
      resolvedAt: item.resolvedAt === null ? null : requireTimestamp(item.resolvedAt, "journal resolvedAt"),
      reservation: validateReservation(item.reservation),
      actualUsage: item.actualUsage === null ? null : validateWork(item.actualUsage, "journal actualUsage"),
      outcomeFingerprint: item.outcomeFingerprint === null ? null : requireFingerprint(item.outcomeFingerprint, "journal outcomeFingerprint"),
    };
    if (
      entry.status === "reserved" &&
        (entry.resolvedAt !== null || entry.actualUsage !== null || entry.outcomeFingerprint !== null) ||
      entry.status === "committed" &&
        (entry.resolvedAt === null || entry.actualUsage === null || entry.outcomeFingerprint === null) ||
      entry.status === "ambiguous" &&
        (entry.resolvedAt === null || entry.actualUsage !== null || entry.outcomeFingerprint !== null) ||
      entry.status === "failed" &&
        (entry.resolvedAt === null || entry.outcomeFingerprint === null)
    ) fail("Continuation journal resolution fields disagree with its status.");
    if (entry.actualUsage) {
      assertActualWithinReservation(entry.actualUsage, entry.reservation);
    }
    return entry;
  });
  const creationInput = requireObject(input.creation, creationKeys, "Continuation creation");
  const cancellationInput = input.cancellation === null ? null : requireObject(input.cancellation, cancellationKeys, "Continuation cancellation");
  const parsedUsage = validateUsage(input.usage);
  const record: Screen02FindContinuationRecord = {
    schemaVersion: SCREEN_02_FIND_CONTINUATION_STORE_SCHEMA_VERSION,
    continuationId: requireId(input.continuationId, "continuationId"),
    runId: requireText(input.runId, "runId"),
    accessTokenSha256: requireDigest(input.accessTokenSha256, "accessTokenSha256"),
    screen01Fingerprint: requireText(input.screen01Fingerprint, "screen01Fingerprint"),
    parent,
    discoveryRequestId: requireId(input.discoveryRequestId, "discoveryRequestId"),
    searchRoundId: requireId(input.searchRoundId, "searchRoundId"),
    candidateSetSnapshotId: input.candidateSetSnapshotId === null ? null : requireId(input.candidateSetSnapshotId, "candidateSetSnapshotId"),
    exactRequest: boundedJson(input.exactRequest, "exactRequest", 128 * 1024),
    requestFingerprint: requireFingerprint(input.requestFingerprint, "requestFingerprint"),
    criteriaFingerprint: requireFingerprint(input.criteriaFingerprint, "criteriaFingerprint"),
    relevanceProfileFingerprint: requireFingerprint(input.relevanceProfileFingerprint, "relevanceProfileFingerprint"),
    discoveryVersion: requireText(input.discoveryVersion, "discoveryVersion"),
    sourcePolicyVersion: requireText(input.sourcePolicyVersion, "sourcePolicyVersion"),
    parserVersion: requireText(input.parserVersion, "parserVersion"),
    qualificationVersion: requireText(input.qualificationVersion, "qualificationVersion"),
    status: status(input.status),
    revision: requireInteger(input.revision, "revision"),
    cursor: requireInteger(input.cursor, "cursor"),
    nextLeaseGeneration: requireInteger(input.nextLeaseGeneration, "nextLeaseGeneration"),
    limits: validateLimits(input.limits),
    usage: legacy
      ? {
          ...parsedUsage,
          platformSubrequests:
            screen02FindContinuationPlatformSubrequests(parsedUsage),
        }
      : parsedUsage,
    checkpoint: boundedJson(input.checkpoint, "checkpoint", SCREEN_02_FIND_CONTINUATION_MAX_CHECKPOINT_BYTES),
    checkpointFingerprint: requireFingerprint(input.checkpointFingerprint, "checkpointFingerprint"),
    lease: parseLease(input.lease),
    journal,
    creation: {
      operationId: requireId(creationInput.operationId, "creation operationId"),
      inputFingerprint: requireFingerprint(creationInput.inputFingerprint, "creation inputFingerprint"),
    },
    cancellation: cancellationInput === null ? null : {
      operationId: requireId(cancellationInput.operationId, "cancellation operationId"),
      inputFingerprint: requireFingerprint(cancellationInput.inputFingerprint, "cancellation inputFingerprint"),
      reason: requireText(cancellationInput.reason, "cancellation reason", 500),
      cancelledAt: requireTimestamp(cancellationInput.cancelledAt, "cancelledAt"),
    },
    failure: legacy ? null : validateFailure(input.failure),
    createdAt: requireTimestamp(input.createdAt, "createdAt"),
    updatedAt: requireTimestamp(input.updatedAt, "updatedAt"),
    absoluteDeadline: requireTimestamp(input.absoluteDeadline, "absoluteDeadline"),
    expiresAt: requireTimestamp(input.expiresAt, "expiresAt"),
  };
  const operationIds = new Set(record.journal.map((entry) => entry.operationId));
  const leaseGenerations = new Set(record.journal.map((entry) => entry.leaseGeneration));
  const derivedUsage = record.journal.reduce((usage, entry) => {
    usage.continuationRequests += 1;
    if (entry.status === "committed") return addUsage(usage, entry.actualUsage!);
    if (entry.status === "ambiguous" ||
        (entry.status === "failed" && entry.actualUsage === null)) {
      return addUsage(usage, reservationAsAmbiguousWork(entry.reservation));
    }
    if (entry.status === "failed") return addUsage(usage, entry.actualUsage!);
    return usage;
  }, emptyUsage());
  const maximumLeaseGeneration = record.journal.reduce(
    (maximum, entry) => Math.max(maximum, entry.leaseGeneration),
    0,
  );
  const usageExceedsLimits =
    record.usage.sourceQueries > record.limits.maxSourceQueries ||
    record.usage.connectorFetches > record.limits.maxConnectorFetches ||
    record.usage.documentAttempts > record.limits.maxDocumentAttempts ||
    record.usage.transportHops > record.limits.maxTransportHops ||
    record.usage.redirectHops > record.limits.maxRedirectHops ||
    record.usage.retries > record.limits.maxRetries ||
    record.usage.receivedBytes > record.limits.maxReceivedBytes ||
    record.usage.continuationRequests > record.limits.maxContinuationRequests;
  if (record.runId !== parent.runId || record.expiresAt > parent.expiresAt ||
      record.absoluteDeadline > record.expiresAt || record.createdAt > record.absoluteDeadline ||
      record.checkpointFingerprint !== fingerprintScreen02WorkflowValue(record.checkpoint) ||
      record.requestFingerprint !== fingerprintScreen02WorkflowValue(record.exactRequest) ||
      record.cursor > record.revision || operationIds.size !== record.journal.length ||
      leaseGenerations.size !== record.journal.length ||
      record.nextLeaseGeneration !== maximumLeaseGeneration ||
      serializeDeterministicJson(record.usage) !== serializeDeterministicJson(derivedUsage) ||
      record.usage.platformSubrequests !== screen02FindContinuationPlatformSubrequests(record.usage) ||
      usageExceedsLimits ||
      (record.status === "cancelled") !== (record.cancellation !== null) ||
      (!legacy && record.status === "failed" && record.failure === null) ||
      (record.status !== "active" && record.lease !== null) ||
      (record.lease === null) !== !record.journal.some((entry) => entry.status === "reserved")) {
    fail("Continuation record invariants disagree.");
  }
  if (record.lease && !record.journal.some((entry) =>
    entry.status === "reserved" && entry.operationId === record.lease!.operationId &&
    entry.leaseGeneration === record.lease!.leaseGeneration)) {
    fail("Continuation lease does not match its journal reservation.");
  }
  if (record.failure) {
    const failedJournal = record.journal.find((entry) =>
      entry.status === "failed" &&
      entry.operationId === record.failure!.operationId &&
      entry.leaseGeneration === record.failure!.leaseGeneration
    );
    if (
      !failedJournal ||
      failedJournal.resolvedAt !== record.failure.failedAt ||
      failedJournal.outcomeFingerprint !==
        record.failure.diagnosticReference ||
      record.failure.lastSavedRevision + 1 > record.revision ||
      record.failure.lastSavedCursor + 1 > record.cursor ||
      !usageIncludesSnapshot(record.usage, record.failure.resourceUsage) ||
      (record.status === "failed" &&
        record.journal.at(-1) !== failedJournal) ||
      (record.status === "active" &&
        record.journal.at(-1)?.status === "failed" &&
        !screen02FindContinuationHasPendingRetry(record))
    ) {
      fail("Continuation failure does not match its settled journal entry.");
    }
  }
  return cloneJson(record, "Continuation record");
}

function authorize(record: Screen02FindContinuationRecord, binding: Screen02FindContinuationParentBinding) {
  return record.runId === binding.runId && record.screen01Fingerprint === binding.screen01Fingerprint &&
    constantTimeDigestEqual(record.accessTokenSha256, binding.accessTokenSha256) &&
    serializeDeterministicJson(record.parent) === serializeDeterministicJson(binding.parent);
}

export class Screen02FindContinuationStore {
  constructor(
    private readonly backend: Screen02FindContinuationStoreBackend,
    private readonly options: { enforceParentGuard?: boolean } = {},
  ) {}

  private async parentAvailable(
    transaction: Pick<Screen02FindContinuationStoreTransaction, "get">,
    binding: Screen02FindContinuationParentBinding,
  ) {
    if (this.options.enforceParentGuard === false) return true;
    const parent = await transaction.get(screen02WorkflowStoreParentRecordKey(binding.runId));
    return screen02WorkflowStoreParentRecordMatches(parent, binding.parent);
  }

  async create(input: Screen02FindContinuationCreateInput): Promise<Screen02FindContinuationCreateResult> {
    const binding = requireBinding(input.binding);
    const continuationId = requireId(input.continuationId, "continuationId");
    const operationId = requireId(input.operationId, "operationId");
    const inputFingerprint = requireFingerprint(input.inputFingerprint, "inputFingerprint");
    const createdAt = requireTimestamp(input.createdAt, "createdAt");
    const absoluteDeadline = requireTimestamp(input.absoluteDeadline, "absoluteDeadline");
    const expiresAt = requireTimestamp(input.expiresAt, "expiresAt");
    if (createdAt >= absoluteDeadline || absoluteDeadline > expiresAt || expiresAt > binding.parent.expiresAt) {
      fail("Continuation deadlines exceed the authenticated parent lifetime.");
    }
    const exactRequest = boundedJson(input.exactRequest, "exactRequest", 128 * 1024);
    const checkpoint = boundedJson(input.checkpoint, "checkpoint", SCREEN_02_FIND_CONTINUATION_MAX_CHECKPOINT_BYTES);
    const limits = validateLimits(input.limits);
    const record: Screen02FindContinuationRecord = validateRecord({
      schemaVersion: SCREEN_02_FIND_CONTINUATION_STORE_SCHEMA_VERSION,
      continuationId, runId: binding.runId,
      accessTokenSha256: binding.accessTokenSha256,
      screen01Fingerprint: binding.screen01Fingerprint,
      parent: binding.parent,
      discoveryRequestId: requireId(input.discoveryRequestId, "discoveryRequestId"),
      searchRoundId: requireId(input.searchRoundId, "searchRoundId"),
      candidateSetSnapshotId: input.candidateSetSnapshotId === null ? null : requireId(input.candidateSetSnapshotId, "candidateSetSnapshotId"),
      exactRequest,
      requestFingerprint: fingerprintScreen02WorkflowValue(exactRequest),
      criteriaFingerprint: requireFingerprint(input.criteriaFingerprint, "criteriaFingerprint"),
      relevanceProfileFingerprint: requireFingerprint(input.relevanceProfileFingerprint, "relevanceProfileFingerprint"),
      discoveryVersion: requireText(input.discoveryVersion, "discoveryVersion"),
      sourcePolicyVersion: requireText(input.sourcePolicyVersion, "sourcePolicyVersion"),
      parserVersion: requireText(input.parserVersion, "parserVersion"),
      qualificationVersion: requireText(input.qualificationVersion, "qualificationVersion"),
      status: "active", revision: 0, cursor: 0, nextLeaseGeneration: 0,
      limits, usage: emptyUsage(), checkpoint,
      checkpointFingerprint: fingerprintScreen02WorkflowValue(checkpoint),
      lease: null, journal: [], creation: { operationId, inputFingerprint },
      cancellation: null, failure: null, createdAt, updatedAt: createdAt,
      absoluteDeadline, expiresAt,
    });
    return this.backend.transaction(async (transaction) => {
      if (!await this.parentAvailable(transaction, binding)) return { outcome: "parent-unavailable" as const };
      const existingValue = await transaction.get(recordKey(continuationId));
      if (existingValue !== undefined) {
        const existing = validateRecord(existingValue);
        if (!authorize(existing, binding)) return { outcome: "conflict" as const, record: existing };
        const immutable = (value: Screen02FindContinuationRecord) => ({
          continuationId: value.continuationId,
          runId: value.runId,
          accessTokenSha256: value.accessTokenSha256,
          screen01Fingerprint: value.screen01Fingerprint,
          parent: value.parent,
          discoveryRequestId: value.discoveryRequestId,
          searchRoundId: value.searchRoundId,
          candidateSetSnapshotId: value.candidateSetSnapshotId,
          exactRequest: value.exactRequest,
          requestFingerprint: value.requestFingerprint,
          criteriaFingerprint: value.criteriaFingerprint,
          relevanceProfileFingerprint: value.relevanceProfileFingerprint,
          discoveryVersion: value.discoveryVersion,
          sourcePolicyVersion: value.sourcePolicyVersion,
          parserVersion: value.parserVersion,
          qualificationVersion: value.qualificationVersion,
          limits: value.limits,
          createdAt: value.createdAt,
          absoluteDeadline: value.absoluteDeadline,
          expiresAt: value.expiresAt,
          creation: value.creation,
        });
        const replayed = existing.creation.operationId === operationId &&
          existing.creation.inputFingerprint === inputFingerprint &&
          serializeDeterministicJson(immutable(existing)) ===
            serializeDeterministicJson(immutable(record));
        return { outcome: replayed ? "replayed" as const : "conflict" as const, record: existing };
      }
      await transaction.put(recordKey(continuationId), record);
      await transaction.put(expiryKey(expiresAt, continuationId), continuationId);
      return { outcome: "created" as const, record };
    });
  }

  async read(bindingValue: Screen02FindContinuationParentBinding, continuationIdValue: string): Promise<Screen02FindContinuationReadResult> {
    const binding = requireBinding(bindingValue);
    const continuationId = requireId(continuationIdValue, "continuationId");
    const value = await this.backend.get(recordKey(continuationId));
    if (value === undefined) return { outcome: "not-found" };
    const record = validateRecord(value);
    if (!authorize(record, binding)) return { outcome: "unauthorized" };
    if (!await this.parentAvailable({ get: (key) => this.backend.get(key) }, binding)) {
      return { outcome: "parent-unavailable" };
    }
    return { outcome: "found", record };
  }

  private ambiguous(record: Screen02FindContinuationRecord, at: string) {
    if (!record.lease) return record;
    const lease = record.lease;
    const journal = record.journal.map((entry) => entry.operationId === lease.operationId && entry.leaseGeneration === lease.leaseGeneration
      ? { ...entry, status: "ambiguous" as const, resolvedAt: at }
      : entry);
    return validateRecord({
      ...record,
      revision: record.revision + 1,
      cursor: record.cursor + 1,
      usage: addUsage(record.usage, reservationAsAmbiguousWork(lease.reservation)),
      lease: null,
      journal,
      updatedAt: at,
    });
  }

  async reserve(input: Screen02FindContinuationReserveInput): Promise<Screen02FindContinuationReserveResult> {
    const binding = requireBinding(input.binding);
    const continuationId = requireId(input.continuationId, "continuationId");
    const expected = requireCoordinates(input.expected);
    const operationId = requireId(input.operationId, "operationId");
    const inputFingerprint = requireFingerprint(input.inputFingerprint, "inputFingerprint");
    const reservedAt = requireTimestamp(input.reservedAt, "reservedAt");
    const leaseExpiresAt = requireTimestamp(input.leaseExpiresAt, "leaseExpiresAt");
    const reservation = validateReservation(input.reservation);
    const perInvocation =
      screen02FindContinuationReservedPlatformSubrequests(reservation);
    return this.backend.transaction(async (transaction) => {
      const value = await transaction.get(recordKey(continuationId));
      if (value === undefined) return { outcome: "not-found" as const };
      let record = validateRecord(value);
      if (!authorize(record, binding)) return { outcome: "unauthorized" as const };
      if (!await this.parentAvailable(transaction, binding)) return { outcome: "parent-unavailable" as const };
      const replay = record.journal.find((entry) => entry.operationId === operationId);
      if (replay) {
        if (replay.inputFingerprint !== inputFingerprint ||
          serializeDeterministicJson(replay.reservation) !== serializeDeterministicJson(reservation)) {
          fail("A continuation operation cannot be rebound.");
        }
        if (replay.status === "reserved" && record.lease?.operationId === operationId) {
          if (record.lease.expiresAt <= reservedAt) {
            record = this.ambiguous(record, reservedAt);
            await transaction.put(recordKey(continuationId), record);
            return { outcome: "recovered-ambiguous" as const, record };
          }
          return { outcome: "replayed" as const, record, lease: record.lease };
        }
        return { outcome: "replayed-resolved" as const, record };
      }
      if (record.status !== "active") return { outcome: "terminal" as const, record };
      const retryCharge = screen02FindContinuationHasPendingRetry(record)
        ? 1
        : 0;
      if (reservation.retries !== retryCharge) {
        fail(
          retryCharge === 1
            ? "A retryable continuation failure requires one bounded retry charge."
            : "A continuation operation cannot charge an unbound retry.",
        );
      }
      if (reservedAt < record.updatedAt) fail("Reservation time cannot move backwards.");
      if (record.lease && record.lease.expiresAt <= reservedAt) {
        record = this.ambiguous(record, reservedAt);
        await transaction.put(recordKey(continuationId), record);
        return { outcome: "recovered-ambiguous" as const, record };
      }
      if (record.lease) return { outcome: "busy" as const, record };
      if (!sameCoordinates(record, expected)) return { outcome: "conflict" as const, record };
      if (reservedAt >= record.absoluteDeadline || leaseExpiresAt <= reservedAt || leaseExpiresAt > record.absoluteDeadline) {
        return { outcome: "limit-exceeded" as const, reason: "absoluteDeadline" as const, record };
      }
      if (perInvocation > SCREEN_02_FIND_CONTINUATION_PLATFORM_SUBREQUEST_LIMIT - record.limits.requiredPlatformSubrequestHeadroom) {
        return { outcome: "limit-exceeded" as const, reason: "requiredPlatformSubrequestHeadroom" as const, record };
      }
      const exceeded = limitFailure(record, reservation);
      if (exceeded) return { outcome: "limit-exceeded" as const, reason: exceeded, record };
      const leaseGeneration = record.nextLeaseGeneration + 1;
      const lease: Screen02FindContinuationLease = {
        operationId, inputFingerprint, leaseGeneration, reservedAt,
        expiresAt: leaseExpiresAt, reservation,
      };
      record = validateRecord({
        ...record,
        revision: record.revision + 1,
        nextLeaseGeneration: leaseGeneration,
        usage: { ...record.usage, continuationRequests: record.usage.continuationRequests + 1 },
        lease,
        journal: [...record.journal, {
          operationId, inputFingerprint, leaseGeneration, status: "reserved",
          reservedAt, leaseExpiresAt, resolvedAt: null, reservation,
          actualUsage: null, outcomeFingerprint: null,
        }],
        updatedAt: reservedAt,
      });
      await transaction.put(recordKey(continuationId), record);
      return { outcome: "reserved" as const, record, lease };
    });
  }

  async advance(input: Screen02FindContinuationAdvanceInput): Promise<Screen02FindContinuationMutationResult> {
    const binding = requireBinding(input.binding);
    const continuationId = requireId(input.continuationId, "continuationId");
    const expected = requireCoordinates(input.expected);
    const operationId = requireId(input.operationId, "operationId");
    const inputFingerprint = requireFingerprint(input.inputFingerprint, "inputFingerprint");
    const outcomeFingerprint = requireFingerprint(input.outcomeFingerprint, "outcomeFingerprint");
    const leaseGeneration = requirePositiveInteger(input.leaseGeneration, "leaseGeneration", Number.MAX_SAFE_INTEGER);
    const completedAt = requireTimestamp(input.completedAt, "completedAt");
    const actualUsage = validateWork(input.actualUsage, "actualUsage");
    const checkpoint = boundedJson(input.checkpoint, "checkpoint", SCREEN_02_FIND_CONTINUATION_MAX_CHECKPOINT_BYTES);
    const nextStatus = status(input.status);
    if (nextStatus === "cancelled" || nextStatus === "failed") {
      fail("advance cannot cancel or fail a continuation.");
    }
    const expectedOutcomeFingerprint = fingerprintScreen02FindContinuationOutcome({
      actualUsage,
      checkpoint,
      status: nextStatus,
    });
    if (outcomeFingerprint !== expectedOutcomeFingerprint) {
      fail("Continuation outcome fingerprint does not bind its exact result.");
    }
    return this.backend.transaction(async (transaction) => {
      const value = await transaction.get(recordKey(continuationId));
      if (value === undefined) return { outcome: "not-found" as const };
      let record = validateRecord(value);
      if (!authorize(record, binding)) return { outcome: "unauthorized" as const };
      if (!await this.parentAvailable(transaction, binding)) return { outcome: "parent-unavailable" as const };
      const replay = record.journal.find((entry) => entry.operationId === operationId);
      if (replay?.status === "committed") {
        if (replay.inputFingerprint !== inputFingerprint || replay.leaseGeneration !== leaseGeneration ||
          replay.outcomeFingerprint !== outcomeFingerprint ||
          serializeDeterministicJson(replay.actualUsage) !== serializeDeterministicJson(actualUsage)) {
          fail("A committed continuation operation cannot be rebound.");
        }
        return { outcome: "replayed" as const, record };
      }
      if (record.status !== "active") return { outcome: "terminal" as const, record };
      if (!sameCoordinates(record, expected)) return { outcome: "conflict" as const, record };
      if (!record.lease || record.lease.operationId !== operationId ||
          record.lease.inputFingerprint !== inputFingerprint ||
          record.lease.leaseGeneration !== leaseGeneration) {
        return { outcome: "busy" as const, record };
      }
      if (completedAt < record.lease.reservedAt) {
        fail("Completion time cannot precede its reservation.");
      }
      // The lease expiry closes admission for new source work; it is not a
      // settlement deadline for the exact owner. A bounded acquisition may
      // return just after that clock while still carrying a proven checkpoint
      // and usage record. Persist it while the same lease is still present.
      // If another caller already recovered the expired lease, the coordinate
      // and ownership checks above reject this late result.
      assertActualWithinReservation(actualUsage, record.lease.reservation);
      if (
        nextStatus === "active" &&
        Object.values(actualUsage).every((value) => value === 0) &&
        fingerprintScreen02WorkflowValue(checkpoint) === record.checkpointFingerprint
      ) fail("An active continuation step must make observable progress.");
      const journal = record.journal.map((entry) => entry.operationId === operationId && entry.leaseGeneration === leaseGeneration
        ? { ...entry, status: "committed" as const, resolvedAt: completedAt, actualUsage, outcomeFingerprint }
        : entry);
      record = validateRecord({
        ...record,
        status: nextStatus,
        revision: record.revision + 1,
        cursor: record.cursor + 1,
        usage: addUsage(record.usage, actualUsage),
        checkpoint,
        checkpointFingerprint: fingerprintScreen02WorkflowValue(checkpoint),
        lease: null,
        journal,
        updatedAt: completedAt,
      });
      await transaction.put(recordKey(continuationId), record);
      return { outcome: "advanced" as const, record };
    });
  }

  async fail(input: Screen02FindContinuationFailInput): Promise<Screen02FindContinuationMutationResult> {
    const binding = requireBinding(input.binding);
    const continuationId = requireId(input.continuationId, "continuationId");
    const expected = requireCoordinates(input.expected);
    const operationId = requireId(input.operationId, "operationId");
    const inputFingerprint = requireFingerprint(
      input.inputFingerprint,
      "inputFingerprint",
    );
    const leaseGeneration = requirePositiveInteger(
      input.leaseGeneration,
      "leaseGeneration",
      Number.MAX_SAFE_INTEGER,
    );
    const failedAt = requireTimestamp(input.failedAt, "failedAt");
    const actualUsage = input.actualUsage === null
      ? null
      : validateWork(input.actualUsage, "actualUsage");
    const failureCheckpoint = input.checkpoint === undefined
      ? undefined
      : boundedJson(
          input.checkpoint,
          "failure checkpoint",
          SCREEN_02_FIND_CONTINUATION_MAX_CHECKPOINT_BYTES,
        );
    if (failureCheckpoint !== undefined && actualUsage === null) {
      fail("An ambiguous failure cannot save an unproven checkpoint.");
    }
    if (!(SCREEN_02_FIND_CONTINUATION_FAILURE_STAGES as readonly unknown[])
      .includes(input.stage)) {
      fail("Continuation failure stage is invalid.");
    }
    if (!(SCREEN_02_FIND_CONTINUATION_FAILURE_CLASSES as readonly unknown[])
      .includes(input.failureClass)) {
      fail("Continuation failure class is invalid.");
    }
    const checkpointBytes = requireNullableInteger(
      input.checkpointBytes,
      "checkpointBytes",
    );
    const finalStateBytes = requireNullableInteger(
      input.finalStateBytes,
      "finalStateBytes",
    );
    const retryable = requireBoolean(input.retryable, "retryable");
    const diagnosticReference = requireFingerprint(
      input.diagnosticReference,
      "diagnosticReference",
    );
    return this.backend.transaction(async (transaction) => {
      const value = await transaction.get(recordKey(continuationId));
      if (value === undefined) return { outcome: "not-found" as const };
      const record = validateRecord(value);
      if (!authorize(record, binding)) return { outcome: "unauthorized" as const };
      if (!await this.parentAvailable(transaction, binding)) {
        return { outcome: "parent-unavailable" as const };
      }
      if (record.failure?.operationId === operationId) {
        const replayJournal = record.journal.find((entry) =>
          entry.status === "failed" && entry.operationId === operationId &&
          entry.leaseGeneration === leaseGeneration
        );
        if (
          !replayJournal ||
          replayJournal.inputFingerprint !== inputFingerprint ||
          serializeDeterministicJson(replayJournal.actualUsage) !==
            serializeDeterministicJson(actualUsage) ||
          record.failure.stage !== input.stage ||
          record.failure.failureClass !== input.failureClass ||
          record.failure.checkpointBytes !== checkpointBytes ||
          record.failure.finalStateBytes !== finalStateBytes ||
          record.failure.retryable !== retryable ||
          record.failure.diagnosticReference !== diagnosticReference ||
          (failureCheckpoint !== undefined &&
            serializeDeterministicJson(record.checkpoint) !==
              serializeDeterministicJson(failureCheckpoint))
        ) {
          fail("A failed continuation operation cannot be rebound.");
        }
        return { outcome: "replayed" as const, record };
      }
      if (record.status !== "active") {
        return { outcome: "terminal" as const, record };
      }
      if (!sameCoordinates(record, expected)) {
        return { outcome: "conflict" as const, record };
      }
      if (
        !record.lease || record.lease.operationId !== operationId ||
        record.lease.inputFingerprint !== inputFingerprint ||
        record.lease.leaseGeneration !== leaseGeneration
      ) {
        return { outcome: "busy" as const, record };
      }
      if (failedAt < record.lease.reservedAt) {
        fail("Failure time cannot precede its reservation.");
      }
      if (actualUsage) {
        assertActualWithinReservation(actualUsage, record.lease.reservation);
      }
      const chargedWork = actualUsage ??
        reservationAsAmbiguousWork(record.lease.reservation);
      const resourceUsage = addUsage(record.usage, chargedWork);
      const journal = record.journal.map((entry) =>
        entry.operationId === operationId &&
          entry.leaseGeneration === leaseGeneration
          ? {
              ...entry,
              status: "failed" as const,
              resolvedAt: failedAt,
              actualUsage,
              outcomeFingerprint: diagnosticReference,
            }
          : entry
      );
      const failure: Screen02FindContinuationFailure = {
        stage: input.stage,
        failureClass: input.failureClass,
        operationId,
        leaseGeneration,
        lastSavedRevision: record.revision,
        lastSavedCursor: record.cursor,
        checkpointBytes,
        finalStateBytes,
        resourceUsage,
        retryable,
        diagnosticReference,
        failedAt,
      };
      // An unknown external outcome is charged conservatively and is never
      // replayed: no retry can prove which source work already committed.
      const retryRemains = retryable && actualUsage !== null &&
        resourceUsage.retries < record.limits.maxRetries &&
        failedAt < record.absoluteDeadline;
      const next = validateRecord({
        ...record,
        status: retryRemains ? "active" : "failed",
        revision: record.revision + 1,
        cursor: record.cursor + 1,
        usage: resourceUsage,
        ...(failureCheckpoint === undefined
          ? {}
          : {
              checkpoint: failureCheckpoint,
              checkpointFingerprint:
                fingerprintScreen02WorkflowValue(failureCheckpoint),
            }),
        lease: null,
        journal,
        failure,
        updatedAt: failedAt,
      });
      await transaction.put(recordKey(continuationId), next);
      return { outcome: "failed" as const, record: next };
    });
  }

  async cancel(input: Screen02FindContinuationCancelInput): Promise<Screen02FindContinuationMutationResult> {
    const binding = requireBinding(input.binding);
    const continuationId = requireId(input.continuationId, "continuationId");
    const expected = requireCoordinates(input.expected);
    const operationId = requireId(input.operationId, "operationId");
    const inputFingerprint = requireFingerprint(input.inputFingerprint, "inputFingerprint");
    const cancelledAt = requireTimestamp(input.cancelledAt, "cancelledAt");
    const reason = requireText(input.reason, "cancellation reason", 500);
    return this.backend.transaction(async (transaction) => {
      const value = await transaction.get(recordKey(continuationId));
      if (value === undefined) return { outcome: "not-found" as const };
      let record = validateRecord(value);
      if (!authorize(record, binding)) return { outcome: "unauthorized" as const };
      if (!await this.parentAvailable(transaction, binding)) return { outcome: "parent-unavailable" as const };
      if (record.cancellation?.operationId === operationId) {
        if (record.cancellation.inputFingerprint !== inputFingerprint ||
          record.cancellation.reason !== reason) fail("A cancellation operation cannot be rebound.");
        return { outcome: "replayed" as const, record };
      }
      if (record.status !== "active") return { outcome: "terminal" as const, record };
      if (!sameCoordinates(record, expected)) return { outcome: "conflict" as const, record };
      if (cancelledAt < record.updatedAt) fail("Cancellation time cannot move backwards.");
      if (record.lease) record = this.ambiguous(record, cancelledAt);
      record = validateRecord({
        ...record,
        status: "cancelled",
        revision: record.revision + 1,
        cursor: record.cursor + 1,
        cancellation: { operationId, inputFingerprint, reason, cancelledAt },
        updatedAt: cancelledAt,
      });
      await transaction.put(recordKey(continuationId), record);
      return { outcome: "cancelled" as const, record };
    });
  }

  async delete(bindingValue: Screen02FindContinuationParentBinding, continuationIdValue: string) {
    const binding = requireBinding(bindingValue);
    const continuationId = requireId(continuationIdValue, "continuationId");
    return this.backend.transaction(async (transaction) => {
      const value = await transaction.get(recordKey(continuationId));
      if (value === undefined) return { outcome: "not-found" as const };
      const record = validateRecord(value);
      if (!authorize(record, binding)) return { outcome: "unauthorized" as const };
      await transaction.delete(recordKey(continuationId));
      await transaction.delete(expiryKey(record.expiresAt, continuationId));
      return { outcome: "deleted" as const };
    });
  }

  async cleanupExpired(atValue: string, limit = SCREEN_02_FIND_CONTINUATION_CLEANUP_BATCH_SIZE) {
    const at = requireTimestamp(atValue, "cleanup time");
    if (!Number.isInteger(limit) || limit < 1 || limit > SCREEN_02_FIND_CONTINUATION_CLEANUP_BATCH_SIZE) {
      fail("Continuation cleanup limit is invalid.");
    }
    const entries = await this.backend.list({ prefix: EXPIRY_PREFIX, limit: limit + 1 });
    let removed = 0;
    let batchLimitReached = false;
    for (const [key, indexedId] of entries) {
      const parsed = parseExpiryKey(key);
      if (parsed && parsed.expiresAt > at && indexedId === parsed.continuationId) break;
      if (removed >= limit) { batchLimitReached = true; break; }
      await this.backend.transaction(async (transaction) => {
        const id = parsed?.continuationId ?? (typeof indexedId === "string" && ID_PATTERN.test(indexedId) ? indexedId : null);
        if (id) {
          const raw = await transaction.get(recordKey(id));
          if (raw !== undefined) {
            try {
              const record = validateRecord(raw);
              if (record.expiresAt > at) {
                await transaction.delete(key);
                await transaction.put(expiryKey(record.expiresAt, id), id);
                return;
              }
              await transaction.delete(recordKey(id));
              await transaction.delete(expiryKey(record.expiresAt, id));
            } catch {
              // A malformed due record fails closed and is still removable.
              await transaction.delete(recordKey(id));
            }
          }
        }
        await transaction.delete(key);
      });
      removed += 1;
    }
    return { removed, batchLimitReached, nextExpirationAt: await this.nextExpirationAt() };
  }

  async nextExpirationAt(): Promise<string | null> {
    const entries = await this.backend.list({ prefix: EXPIRY_PREFIX, limit: 1 });
    for (const [key, value] of entries) {
      const parsed = parseExpiryKey(key);
      return parsed && value === parsed.continuationId ? parsed.expiresAt : CLEANUP_RETRY_AT;
    }
    return null;
  }
}

export class InMemoryScreen02FindContinuationStoreBackend
  implements Screen02FindContinuationStoreBackend {
  private readonly records = new Map<string, unknown>();
  private transactionTail: Promise<void> = Promise.resolve();

  async get(key: string) {
    return this.records.has(key) ? cloneJson(this.records.get(key), "stored value") : undefined;
  }

  async list({ prefix, limit = Number.POSITIVE_INFINITY }: { prefix: string; limit?: number }) {
    return new Map([...this.records.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(0, limit)
      .map(([key, value]) => [key, cloneJson(value, "stored value")]));
  }

  async transaction<T>(callback: (transaction: Screen02FindContinuationStoreTransaction) => Promise<T>) {
    const prior = this.transactionTail;
    let release!: () => void;
    this.transactionTail = new Promise<void>((resolve) => { release = resolve; });
    await prior;
    const writes = new Map<string, unknown>();
    const deletions = new Set<string>();
    const transaction: Screen02FindContinuationStoreTransaction = {
      get: async (key) => deletions.has(key) ? undefined
        : writes.has(key) ? cloneJson(writes.get(key), "stored value")
        : this.records.has(key) ? cloneJson(this.records.get(key), "stored value") : undefined,
      put: async (key, value) => {
        deletions.delete(key);
        writes.set(key, cloneJson(value, "stored value"));
      },
      delete: async (key) => {
        writes.delete(key);
        return deletions.add(key);
      },
    };
    try {
      const result = await callback(transaction);
      for (const key of deletions) this.records.delete(key);
      for (const [key, value] of writes) this.records.set(key, cloneJson(value, "stored value"));
      return result;
    } finally {
      release();
    }
  }
}
