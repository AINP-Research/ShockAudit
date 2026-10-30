import {
  decodeScreen02AuditWorkflowStateEnvelope,
  encodeScreen02AuditWorkflowStateEnvelope,
  type Screen02AuditWorkflowStateEnvelope,
} from "../core/screen02-audit-workflow-envelope";
import {
  decodeScreen02FindWorkflowStateEnvelope,
  encodeScreen02FindWorkflowStateEnvelope,
  type Screen02FindWorkflowStateEnvelope,
} from "../core/screen02-workflow-envelope";
import {
  fingerprintScreen02WorkflowState,
} from "../core/screen02-workflow-state";
import {
  SCREEN_02_AUDIT_STATE_KIND,
  SCREEN_02_FIND_STATE_KIND,
  type Screen02WorkflowState,
} from "../core/screen02-workflow-types";
import { serializeDeterministicJson } from "../core/screen02-service";
import {
  SCREEN_02_WORKFLOW_STORE_ABSOLUTE_RETENTION_MS,
  SCREEN_02_WORKFLOW_STORE_CLEANUP_BATCH_SIZE,
  SCREEN_02_WORKFLOW_STORE_CONTINUED_RETENTION_MS,
  SCREEN_02_WORKFLOW_STORE_IDLE_RETENTION_MS,
} from "./screen02-retention-policy";

export {
  SCREEN_02_WORKFLOW_STORE_ABSOLUTE_RETENTION_MS,
  SCREEN_02_WORKFLOW_STORE_CLEANUP_BATCH_SIZE,
  SCREEN_02_WORKFLOW_STORE_CONTINUED_RETENTION_MS,
  SCREEN_02_WORKFLOW_STORE_IDLE_RETENTION_MS,
} from "./screen02-retention-policy";

export const SCREEN_02_WORKFLOW_STORE_RECORD_SCHEMA_VERSION =
  "screen-02-workflow-store-record-v2" as const;
export const SCREEN_02_WORKFLOW_STORE_RUN_IDENTITY_ASSUMPTION =
  "server-generated-unguessable-256-bit-v1" as const;
export const SCREEN_02_WORKFLOW_STORE_MAX_BUFFERED_RECEIPTS = 96;
export const SCREEN_02_WORKFLOW_STORE_MAX_RECEIPT_TOKEN_CHARACTERS =
  64 * 1024;
export const SCREEN_02_WORKFLOW_STORE_MAX_BUFFERED_RECEIPT_CHARACTERS =
  1024 * 1024;
export const SCREEN_02_WORKFLOW_STORE_MAX_OPERATION_REPLAYS = 64;
export const SCREEN_02_WORKFLOW_STORE_MAX_CONTINUATION_ACCESS_TOKENS = 4;
export const SCREEN_02_WORKFLOW_STORE_MAX_REPLAY_RESULT_CHARACTERS =
  64 * 1024;
export const SCREEN_02_WORKFLOW_STORE_MAX_REPLAY_RESULT_TOTAL_CHARACTERS =
  256 * 1024;
const STORE_KEY_PREFIX = "screen02-workflow-v021:";
const EXPIRY_KEY_PREFIX = "screen02-workflow-expiry-v1:";
const OPEN_OPERATION_KEY_PREFIX = "screen02-workflow-open-operation-v1:";
const OPEN_OPERATION_RUN_KEY_PREFIX =
  "screen02-workflow-open-operation-run-v1:";
const PENDING_CHILD_CASCADE_KEY_PREFIX =
  "screen02-workflow-pending-child-cascade-v1:";
const SCREEN_02_WORKFLOW_PENDING_CHILD_CASCADE_SCHEMA_VERSION =
  "screen02-workflow-pending-child-cascade-v1" as const;
const CLEANUP_RETRY_AT = "1970-01-01T00:00:00.000Z";
const SCREEN_02_WORKFLOW_OPEN_OPERATION_SCHEMA_VERSION_V1 =
  "screen02-workflow-open-operation-v1" as const;
const SCREEN_02_WORKFLOW_OPEN_OPERATION_SCHEMA_VERSION =
  "screen02-workflow-open-operation-v2" as const;
const SCREEN_02_WORKFLOW_OPEN_OPERATION_RUN_SCHEMA_VERSION =
  "screen02-workflow-open-operation-run-v1" as const;
const IDENTIFIER_MAX_CHARACTERS = 200;
const RUN_ID_PATTERN = /^s2r_[A-Za-z0-9_-]{43,128}$/;
const ACCESS_TOKEN_PATTERN = /^s2a_[A-Za-z0-9_-]{43,128}$/;
const OPEN_IDENTITY_NONCE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SIGNING_KEY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const SHA256_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const FIND_RECEIPT_TOKEN_TYPE = "sa2f-receipt-v1";
const AUDIT_RECEIPT_TOKEN_TYPE = "sa2a-receipt-v1";
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

export type Screen02WorkflowStoreEnvelope =
  | Screen02FindWorkflowStateEnvelope
  | Screen02AuditWorkflowStateEnvelope;

export type Screen02WorkflowStoreCoordinates = {
  generation: number;
  revision: number;
  stateFingerprint: string;
};

/**
 * Internal coordinates used by sibling workflow records that must prove their
 * parent still exists inside the same Durable Object storage transaction.
 */
export type Screen02WorkflowStoreParentGuard =
  Screen02WorkflowStoreCoordinates & {
    runId: string;
    expiresAt: string;
  };

export type Screen02WorkflowBufferedReceipt = {
  receiptId: string;
  requestId: string;
  assessmentMode:
    | "find-discovery-plan"
    | "find-candidate"
    | "find-criterion"
    | "audit-dossier"
    | "audit-confirmed-event";
  receiptToken: string;
  receivedAt: string;
};

export type Screen02WorkflowOperationReplay = {
  operationId: string;
  operationKind: string;
  committedGeneration: number;
  completedAt: string;
  result: unknown;
};

export type Screen02WorkflowStoreRecord = {
  schemaVersion: typeof SCREEN_02_WORKFLOW_STORE_RECORD_SCHEMA_VERSION;
  runIdentityAssumption: typeof SCREEN_02_WORKFLOW_STORE_RUN_IDENTITY_ASSUMPTION;
  runId: string;
  accessTokenSha256: string;
  /**
   * Hash-only, bounded aliases minted after a validated render-tool handoff.
   * They let the latest widget continue the same run without exposing or
   * replacing the primary possession token retained by an earlier widget.
   */
  continuationAccessTokenSha256s: string[];
  mode: "find" | "audit";
  screen01Fingerprint: string;
  stateEnvelope: Screen02WorkflowStoreEnvelope;
  stateRevision: number;
  stateFingerprint: string;
  bufferedReceipts: Screen02WorkflowBufferedReceipt[];
  generation: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  operationReplays: Screen02WorkflowOperationReplay[];
};

export type Screen02WorkflowStoreCreateResult =
  | { outcome: "created"; record: Screen02WorkflowStoreRecord }
  | { outcome: "replayed"; record: Screen02WorkflowStoreRecord }
  | { outcome: "unauthorized" }
  | { outcome: "conflict"; record: Screen02WorkflowStoreRecord }
  | {
      outcome: "open-operation-blocked";
      reason: "baseline-mismatch" | "initialization-mismatch";
    }
  | {
      outcome: "open-operation-raced";
      binding: Screen02WorkflowOpenOperationBinding;
    };

export type Screen02WorkflowOpenOperationBinding = {
  schemaVersion: typeof SCREEN_02_WORKFLOW_OPEN_OPERATION_SCHEMA_VERSION;
  operationIdSha256: string;
  runId: string;
  accessTokenSha256: string;
  screen01Fingerprint: string;
  identityNonce: string;
  signingKeyId: string;
  initialState: "standard" | "blank";
};

export type Screen02WorkflowOpenOperationReadResult =
  | { outcome: "not-found" }
  | {
      outcome: "bound";
      binding: Screen02WorkflowOpenOperationBinding;
    };

export type Screen02WorkflowStoreReadResult =
  | { outcome: "authenticated"; record: Screen02WorkflowStoreRecord }
  | { outcome: "not-found" }
  | { outcome: "unauthorized" };

export type Screen02WorkflowStoreTrustedReadResult =
  | { outcome: "found"; record: Screen02WorkflowStoreRecord }
  | { outcome: "not-found" };

export type Screen02WorkflowStoreContinuationResult =
  | {
      outcome: "added" | "existing";
      record: Screen02WorkflowStoreRecord;
    }
  | { outcome: "not-found" }
  | {
      outcome: "conflict";
      record: Screen02WorkflowStoreRecord;
      current: Screen02WorkflowStoreCoordinates;
    };

export type Screen02WorkflowStoreUpdatePlan = {
  stateEnvelope: unknown;
  bufferedReceipts: Screen02WorkflowBufferedReceipt[];
  updatedAt: string;
  replayResult: unknown;
  /**
   * Persist a same-transaction retry marker before a parent state change can
   * make an existing Screen 3 child stale. The caller acknowledges it only
   * after child retirement succeeds.
   */
  markPendingChildCascade?: true | {
    kind: "screen03-stale-after-host-review";
    originatingTaskId: string;
  };
};

export type Screen02WorkflowStoreUpdateResult =
  | {
      outcome: "updated";
      record: Screen02WorkflowStoreRecord;
      replayResult: unknown;
    }
  | {
      outcome: "replayed";
      record: Screen02WorkflowStoreRecord;
      replayResult: unknown;
    }
  | { outcome: "not-found" }
  | { outcome: "unauthorized" }
  | {
      outcome: "conflict";
      record: Screen02WorkflowStoreRecord;
      current: Screen02WorkflowStoreCoordinates;
    };

export type Screen02WorkflowStoreUpdateInput = {
  runId: string;
  accessToken: string;
  expected: Screen02WorkflowStoreCoordinates;
  operationId: string;
  operationKind: string;
  mutate: (
    current: Screen02WorkflowStoreRecord,
  ) =>
    | Screen02WorkflowStoreUpdatePlan
    | Promise<Screen02WorkflowStoreUpdatePlan>;
};

export type Screen02WorkflowStoreTrustedUpdateInput = Omit<
  Screen02WorkflowStoreUpdateInput,
  "accessToken"
>;

export type Screen02WorkflowStoreTrustedUpdateResult = Exclude<
  Screen02WorkflowStoreUpdateResult,
  { outcome: "unauthorized" }
>;

export type Screen02WorkflowStoreRetireResult =
  | { outcome: "retired"; runId: string }
  | { outcome: "not-found"; runId: string }
  | { outcome: "unauthorized" }
  | {
      outcome: "conflict";
      record: Screen02WorkflowStoreRecord;
      current: Screen02WorkflowStoreCoordinates;
    };

export type Screen02WorkflowStoreCleanupResult = {
  deletedRunIds: string[];
  nextExpirationAt: string | null;
  batchLimitReached: boolean;
};

export type Screen02WorkflowPendingChildCascades = {
  runIds: string[];
  batchLimitReached: boolean;
};

export type Screen02WorkflowPendingChildCascade =
  | {
      kind: "parent-retired";
      runId: string;
      originatingTaskId: null;
    }
  | {
      kind: "screen03-stale-after-host-review";
      runId: string;
      originatingTaskId: string;
    };

export type Screen02WorkflowPendingChildCascadeReadResult =
  | {
      outcome: "found";
      cascade: Screen02WorkflowPendingChildCascade;
    }
  | { outcome: "not-found" };

export interface Screen02WorkflowStore {
  create(input: {
    runId: string;
    accessToken: string;
    stateEnvelope: unknown;
    bufferedReceipts?: Screen02WorkflowBufferedReceipt[];
    openOperation?: {
      operationId: string;
      identityNonce: string;
      signingKeyId: string;
      initialState?: "standard" | "blank";
    };
  }): Promise<Screen02WorkflowStoreCreateResult>;

  /**
   * Read the durable idempotent-open binding without exposing its raw
   * operation ID. The active binding's random identity nonce prevents a
   * retired or expired possession token from being derived again when the
   * same operation ID later starts a new retained run.
   */
  readOpenOperation(
    operationId: string,
  ): Promise<Screen02WorkflowOpenOperationReadResult>;

  read(input: {
    runId: string;
    accessToken: string;
  }): Promise<Screen02WorkflowStoreReadResult>;

  /**
   * Server-internal read for a caller that has already verified an HMAC-bound
   * capability. Never expose this method through an untrusted client route.
   */
  readTrusted(input: {
    runId: string;
  }): Promise<Screen02WorkflowStoreTrustedReadResult>;

  /**
   * Server-internal continuation boundary. The caller must first verify the
   * signed Screen 3 packet and exact parent coordinates. Only the token digest
   * is persisted; the raw token is returned to a component through hidden
   * tool-result metadata by the caller.
   */
  addContinuationAccessTokenTrusted?(input: {
    runId: string;
    accessToken: string;
    expected: Screen02WorkflowStoreCoordinates;
    expectedExpiresAt: string;
  }): Promise<Screen02WorkflowStoreContinuationResult>;

  update(
    input: Screen02WorkflowStoreUpdateInput,
  ): Promise<Screen02WorkflowStoreUpdateResult>;

  /**
   * Server-internal update for a caller that has already verified an
   * HMAC-bound capability. It intentionally omits the client access token but
   * still requires the unguessable run ID, operation replay identity, and
   * exact CAS coordinates. It shares the same serialized write path as update.
   */
  updateTrusted(
    input: Screen02WorkflowStoreTrustedUpdateInput,
  ): Promise<Screen02WorkflowStoreTrustedUpdateResult>;

  /**
   * Delete one authenticated run after an explicit researcher reset or after
   * Screen 1 editing retires the immutable boundary. A failed replacement
   * opener must never call this method.
   */
  retire(input: {
    runId: string;
    accessToken: string;
    expected: Screen02WorkflowStoreCoordinates;
  }): Promise<Screen02WorkflowStoreRetireResult>;

  /** Delete expired records in a bounded batch and report the next alarm. */
  cleanupExpired(at: string): Promise<Screen02WorkflowStoreCleanupResult>;

  /** Return the earliest currently indexed expiration, if any. */
  nextExpirationAt(): Promise<string | null>;

  /** Internal durable continuation for Screen 3 and host-task retirement. */
  listPendingChildCascades?(
    limit?: number,
  ): Promise<Screen02WorkflowPendingChildCascades>;

  /** Resolve whether the marker represents parent deletion or child refresh. */
  readPendingChildCascade?(
    runId: string,
  ): Promise<Screen02WorkflowPendingChildCascadeReadResult>;

  /** Acknowledge only the marker that the caller actually finished. */
  acknowledgePendingChildCascade?(
    runId: string,
    expected?: Screen02WorkflowPendingChildCascade,
  ): Promise<void>;
}

export class Screen02WorkflowStoreValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Screen02WorkflowStoreValidationError";
  }
}

type StoreTransaction = {
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
};

type StoreBackend = {
  get(key: string): Promise<unknown>;
  list(input: {
    prefix: string;
    limit: number;
  }): Promise<Map<string, unknown>>;
  transaction<T>(
    callback: (transaction: StoreTransaction) => Promise<T>,
  ): Promise<T>;
};

const legacyRecordKeys = [
  "schemaVersion",
  "runIdentityAssumption",
  "runId",
  "accessTokenSha256",
  "mode",
  "screen01Fingerprint",
  "stateEnvelope",
  "stateRevision",
  "stateFingerprint",
  "bufferedReceipts",
  "generation",
  "createdAt",
  "updatedAt",
  "expiresAt",
  "operationReplays",
] as const;

const recordKeys = [
  ...legacyRecordKeys,
  "continuationAccessTokenSha256s",
] as const;

const bufferedReceiptKeys = [
  "receiptId",
  "requestId",
  "assessmentMode",
  "receiptToken",
  "receivedAt",
] as const;

const operationReplayKeys = [
  "operationId",
  "operationKind",
  "committedGeneration",
  "completedAt",
  "result",
] as const;

const openOperationKeysV1 = [
  "schemaVersion",
  "operationIdSha256",
  "runId",
  "accessTokenSha256",
  "screen01Fingerprint",
  "identityNonce",
  "signingKeyId",
] as const;

const openOperationKeys = [...openOperationKeysV1, "initialState"] as const;

const openOperationRunKeys = [
  "schemaVersion",
  "runId",
  "operationIdSha256",
] as const;

type Screen02WorkflowOpenOperationRunBinding = {
  schemaVersion: typeof SCREEN_02_WORKFLOW_OPEN_OPERATION_RUN_SCHEMA_VERSION;
  runId: string;
  operationIdSha256: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return (
    actual.length === wanted.length &&
    actual.every((key, index) => key === wanted[index])
  );
}

function canonicalClone<T>(value: T, label: string): T {
  try {
    const serialized = serializeDeterministicJson(value);
    return JSON.parse(serialized) as T;
  } catch {
    throw new Screen02WorkflowStoreValidationError(
      `${label} must contain only bounded canonical JSON values.`,
    );
  }
}

function canonicalSize(value: unknown, label: string) {
  try {
    return serializeDeterministicJson(value).length;
  } catch {
    throw new Screen02WorkflowStoreValidationError(
      `${label} must contain only canonical JSON values.`,
    );
  }
}

function assertRawAccessTokenAbsent(
  value: unknown,
  accessToken: string,
  label: string,
) {
  if (serializeDeterministicJson(value).includes(accessToken)) {
    throw new Screen02WorkflowStoreValidationError(
      `The raw workflow access token cannot be stored in ${label}.`,
    );
  }
}

function requireIdentifier(value: unknown, label: string) {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    value.length < 1 ||
    value.length > IDENTIFIER_MAX_CHARACTERS
  ) {
    throw new Screen02WorkflowStoreValidationError(
      `${label} must be a bounded canonical identifier.`,
    );
  }
  return value;
}

function requireTimestamp(value: unknown, label: string) {
  if (typeof value !== "string") {
    throw new Screen02WorkflowStoreValidationError(
      `${label} must be a canonical ISO timestamp.`,
    );
  }
  const milliseconds = Date.parse(value);
  if (
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString() !== value
  ) {
    throw new Screen02WorkflowStoreValidationError(
      `${label} must be a canonical ISO timestamp.`,
    );
  }
  return value;
}

function requireFingerprint(value: unknown, label: string) {
  if (
    typeof value !== "string" ||
    !/^fnv1a64:[0-9a-f]{16}$/.test(value)
  ) {
    throw new Screen02WorkflowStoreValidationError(
      `${label} must be a canonical workflow fingerprint.`,
    );
  }
  return value;
}

function requireRunId(value: unknown) {
  if (typeof value !== "string" || !RUN_ID_PATTERN.test(value)) {
    throw new Screen02WorkflowStoreValidationError(
      "Screen 2 persisted run IDs must be generated by the server from at least 256 random bits.",
    );
  }
  return value;
}

function requireAccessToken(value: unknown) {
  if (typeof value !== "string" || !ACCESS_TOKEN_PATTERN.test(value)) {
    throw new Screen02WorkflowStoreValidationError(
      "Screen 2 workflow access token must be an unguessable server-generated token.",
    );
  }
  return value;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function randomToken(prefix: "s2r_" | "s2a_") {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `${prefix}${bytesToBase64Url(bytes)}`;
}

/**
 * Generates the two possession credentials used by the canonical store. The
 * access token must be returned to the app through a private host channel; the
 * store persists only its SHA-256 digest.
 */
export function createScreen02WorkflowStoreIdentity() {
  return {
    runId: randomToken("s2r_"),
    accessToken: randomToken("s2a_"),
  };
}

async function sha256Digest(value: string) {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
  return `sha256:${[...digest]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

function digestBytes(value: string) {
  const bytes = new Uint8Array(32);
  let valid = SHA256_DIGEST_PATTERN.test(value);
  const hex = valid ? value.slice("sha256:".length) : "";
  for (let index = 0; index < bytes.length; index += 1) {
    const parsed = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
    if (!Number.isFinite(parsed)) valid = false;
    bytes[index] = Number.isFinite(parsed) ? parsed : 0;
  }
  return { bytes, valid };
}

/** Compare fixed-size digests without returning at the first mismatch. */
function constantTimeDigestEqual(left: string, right: string) {
  const first = digestBytes(left);
  const second = digestBytes(right);
  let mismatch = first.valid && second.valid ? 0 : 1;
  for (let index = 0; index < first.bytes.length; index += 1) {
    mismatch |= first.bytes[index]! ^ second.bytes[index]!;
  }
  return mismatch === 0;
}

function validateContinuationAccessTokenDigests(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Screen02WorkflowStoreValidationError(
      "Persisted continuation access-token digests must be a bounded array.",
    );
  }
  if (
    value.length > SCREEN_02_WORKFLOW_STORE_MAX_CONTINUATION_ACCESS_TOKENS
  ) {
    throw new Screen02WorkflowStoreValidationError(
      "Persisted continuation access-token digests exceed the bounded limit.",
    );
  }
  const digests = value.map((digest, index) =>
    requireSha256Digest(
      digest,
      `continuation access-token digest ${index + 1}`,
    )
  );
  if (new Set(digests).size !== digests.length) {
    throw new Screen02WorkflowStoreValidationError(
      "Persisted continuation access-token digests must be unique.",
    );
  }
  return digests;
}

function recordAcceptsAccessTokenDigest(
  record: Screen02WorkflowStoreRecord,
  candidateDigest: string,
) {
  // Evaluate every bounded digest so an alias match does not short-circuit at
  // a position-dependent time. The primary credential remains valid.
  let accepted = constantTimeDigestEqual(
    record.accessTokenSha256,
    candidateDigest,
  )
    ? 1
    : 0;
  for (const digest of record.continuationAccessTokenSha256s) {
    accepted |= constantTimeDigestEqual(digest, candidateDigest) ? 1 : 0;
  }
  return accepted === 1;
}

function storeKey(runId: string) {
  return `${STORE_KEY_PREFIX}${runId}`;
}

function pendingChildCascadeKey(runId: string) {
  return `${PENDING_CHILD_CASCADE_KEY_PREFIX}${requireRunId(runId)}`;
}

function pendingChildCascade(
  key: string,
  value: unknown,
): Screen02WorkflowPendingChildCascade | null {
  if (!key.startsWith(PENDING_CHILD_CASCADE_KEY_PREFIX)) return null;
  const runId = key.slice(PENDING_CHILD_CASCADE_KEY_PREFIX.length);
  if (!RUN_ID_PATTERN.test(runId)) return null;
  // String values are the original durable marker written when the parent is
  // deleted. Keep accepting them so an in-flight pre-upgrade cascade remains
  // recoverable after deployment.
  if (value === runId) {
    return { kind: "parent-retired", runId, originatingTaskId: null };
  }
  if (
    !isRecord(value) ||
    Object.keys(value).sort().join("|") !==
      "kind|originatingTaskId|runId|schemaVersion" ||
    value.schemaVersion !==
      SCREEN_02_WORKFLOW_PENDING_CHILD_CASCADE_SCHEMA_VERSION ||
    value.kind !== "screen03-stale-after-host-review" ||
    value.runId !== runId
  ) {
    return null;
  }
  try {
    return {
      kind: value.kind,
      runId,
      originatingTaskId: requireIdentifier(
        value.originatingTaskId,
        "pending child-cascade originating taskId",
      ),
    };
  } catch {
    return null;
  }
}

function pendingChildCascadeMarker(
  runId: string,
  request: NonNullable<Screen02WorkflowStoreUpdatePlan["markPendingChildCascade"]>,
) {
  if (request === true) return runId;
  return {
    schemaVersion: SCREEN_02_WORKFLOW_PENDING_CHILD_CASCADE_SCHEMA_VERSION,
    kind: request.kind,
    runId,
    originatingTaskId: requireIdentifier(
      request.originatingTaskId,
      "pending child-cascade originating taskId",
    ),
  };
}

function requireSha256Digest(value: unknown, label: string) {
  if (typeof value !== "string" || !SHA256_DIGEST_PATTERN.test(value)) {
    throw new Screen02WorkflowStoreValidationError(
      `${label} must be a canonical SHA-256 digest.`,
    );
  }
  return value;
}

function openOperationKey(operationIdSha256: string) {
  return `${OPEN_OPERATION_KEY_PREFIX}${requireSha256Digest(
    operationIdSha256,
    "open operation ID digest",
  )}`;
}

function openOperationRunKey(runId: string) {
  return `${OPEN_OPERATION_RUN_KEY_PREFIX}${requireRunId(runId)}`;
}

function validateOpenOperationBinding(
  value: unknown,
): Screen02WorkflowOpenOperationBinding {
  if (!isRecord(value)) {
    throw new Screen02WorkflowStoreValidationError(
      "Persisted Screen 2 open-operation binding has an invalid exact-key shape.",
    );
  }
  const isLegacy =
    value.schemaVersion === SCREEN_02_WORKFLOW_OPEN_OPERATION_SCHEMA_VERSION_V1 &&
    exactKeys(value, openOperationKeysV1);
  const isCurrent =
    value.schemaVersion === SCREEN_02_WORKFLOW_OPEN_OPERATION_SCHEMA_VERSION &&
    exactKeys(value, openOperationKeys);
  if (!isLegacy && !isCurrent) {
    throw new Screen02WorkflowStoreValidationError(
      "Persisted Screen 2 open-operation binding has an invalid exact-key shape or schema.",
    );
  }
  if (
    typeof value.identityNonce !== "string" ||
    !OPEN_IDENTITY_NONCE_PATTERN.test(value.identityNonce)
  ) {
    throw new Screen02WorkflowStoreValidationError(
      "Persisted Screen 2 open-operation identity nonce is invalid.",
    );
  }
  const initialState = isLegacy ? "standard" : value.initialState;
  if (initialState !== "standard" && initialState !== "blank") {
    throw new Screen02WorkflowStoreValidationError(
      "Persisted Screen 2 open-operation initialization profile is invalid.",
    );
  }
  if (
    typeof value.signingKeyId !== "string" ||
    !SIGNING_KEY_ID_PATTERN.test(value.signingKeyId)
  ) {
    throw new Screen02WorkflowStoreValidationError(
      "Persisted Screen 2 open-operation signing key ID is invalid.",
    );
  }
  return {
    schemaVersion: SCREEN_02_WORKFLOW_OPEN_OPERATION_SCHEMA_VERSION,
    operationIdSha256: requireSha256Digest(
      value.operationIdSha256,
      "open operation ID digest",
    ),
    runId: requireRunId(value.runId),
    accessTokenSha256: requireSha256Digest(
      value.accessTokenSha256,
      "open operation access-token digest",
    ),
    screen01Fingerprint: requireFingerprint(
      value.screen01Fingerprint,
      "open operation Screen 1 fingerprint",
    ),
    identityNonce: value.identityNonce,
    signingKeyId: value.signingKeyId,
    initialState,
  };
}

function validateOpenOperationRunBinding(
  value: unknown,
): Screen02WorkflowOpenOperationRunBinding {
  if (!isRecord(value) || !exactKeys(value, openOperationRunKeys)) {
    throw new Screen02WorkflowStoreValidationError(
      "Persisted Screen 2 open-operation run binding has an invalid exact-key shape.",
    );
  }
  if (
    value.schemaVersion !==
    SCREEN_02_WORKFLOW_OPEN_OPERATION_RUN_SCHEMA_VERSION
  ) {
    throw new Screen02WorkflowStoreValidationError(
      "Persisted Screen 2 open-operation run binding has an invalid schema.",
    );
  }
  return {
    schemaVersion: SCREEN_02_WORKFLOW_OPEN_OPERATION_RUN_SCHEMA_VERSION,
    runId: requireRunId(value.runId),
    operationIdSha256: requireSha256Digest(
      value.operationIdSha256,
      "open operation ID digest",
    ),
  };
}

function expiryKey(expiresAt: string, runId: string) {
  return `${EXPIRY_KEY_PREFIX}${expiresAt}|${runId}`;
}

function continuedWorkflow(state: Screen02WorkflowState) {
  return state.mode === "find"
    ? state.decision.continuedRevision !== null
    : state.continuationHistory.length > 0;
}

export function screen02WorkflowRetentionExpiresAt(input: {
  state: Screen02WorkflowState;
  createdAt: string;
  updatedAt: string;
}) {
  const createdAt = Date.parse(requireTimestamp(input.createdAt, "createdAt"));
  const updatedAt = Date.parse(requireTimestamp(input.updatedAt, "updatedAt"));
  const candidates = [
    createdAt + SCREEN_02_WORKFLOW_STORE_ABSOLUTE_RETENTION_MS,
    updatedAt + SCREEN_02_WORKFLOW_STORE_IDLE_RETENTION_MS,
  ];
  if (continuedWorkflow(input.state)) {
    candidates.push(
      updatedAt + SCREEN_02_WORKFLOW_STORE_CONTINUED_RETENTION_MS,
    );
  }
  return new Date(Math.min(...candidates)).toISOString();
}

function expirationFromKey(key: string) {
  if (!key.startsWith(EXPIRY_KEY_PREFIX)) return null;
  const suffix = key.slice(EXPIRY_KEY_PREFIX.length);
  const separator = suffix.indexOf("|");
  if (separator < 1) return null;
  const expiresAt = suffix.slice(0, separator);
  const runId = suffix.slice(separator + 1);
  try {
    requireTimestamp(expiresAt, "expiration index time");
    requireRunId(runId);
    return { expiresAt, runId };
  } catch {
    return null;
  }
}

function runIdFromExpirationKey(key: string) {
  if (!key.startsWith(EXPIRY_KEY_PREFIX)) return null;
  const separator = key.indexOf("|", EXPIRY_KEY_PREFIX.length);
  if (separator < 0) return null;
  const runId = key.slice(separator + 1);
  return RUN_ID_PATTERN.test(runId) ? runId : null;
}

function decodeCanonicalEnvelope(value: unknown): {
  mode: "find" | "audit";
  state: Screen02WorkflowState;
  envelope: Screen02WorkflowStoreEnvelope;
} {
  if (!isRecord(value)) {
    throw new Screen02WorkflowStoreValidationError(
      "Persisted Screen 2 state requires a canonical v2.1 envelope.",
    );
  }
  if (value.stateKind === SCREEN_02_FIND_STATE_KIND) {
    const decoded = decodeScreen02FindWorkflowStateEnvelope(value);
    if (!decoded.ok) {
      throw new Screen02WorkflowStoreValidationError(
        `Persisted Find envelope failed validation: ${decoded.code}.`,
      );
    }
    const canonical = encodeScreen02FindWorkflowStateEnvelope(decoded.state);
    if (
      serializeDeterministicJson(canonical) !==
      serializeDeterministicJson(value)
    ) {
      throw new Screen02WorkflowStoreValidationError(
        "Persisted Find envelope is valid but not the exact canonical encoding.",
      );
    }
    return { mode: "find", state: decoded.state, envelope: canonical };
  }
  if (value.stateKind === SCREEN_02_AUDIT_STATE_KIND) {
    const decoded = decodeScreen02AuditWorkflowStateEnvelope(value);
    if (!decoded.ok) {
      throw new Screen02WorkflowStoreValidationError(
        `Persisted Audit envelope failed validation: ${decoded.code}.`,
      );
    }
    const canonical = encodeScreen02AuditWorkflowStateEnvelope(decoded.state);
    if (
      serializeDeterministicJson(canonical) !==
      serializeDeterministicJson(value)
    ) {
      throw new Screen02WorkflowStoreValidationError(
        "Persisted Audit envelope is valid but not the exact canonical encoding.",
      );
    }
    return { mode: "audit", state: decoded.state, envelope: canonical };
  }
  throw new Screen02WorkflowStoreValidationError(
    "Persisted Screen 2 envelope has an unsupported state kind.",
  );
}

function validateBufferedReceipts(
  value: unknown,
  workflowMode: "find" | "audit",
) {
  if (
    !Array.isArray(value) ||
    value.length > SCREEN_02_WORKFLOW_STORE_MAX_BUFFERED_RECEIPTS
  ) {
    throw new Screen02WorkflowStoreValidationError(
      `Buffered receipts must contain at most ${SCREEN_02_WORKFLOW_STORE_MAX_BUFFERED_RECEIPTS} records.`,
    );
  }
  const receipts = value.map((candidate, index) => {
    if (!isRecord(candidate) || !exactKeys(candidate, bufferedReceiptKeys)) {
      throw new Screen02WorkflowStoreValidationError(
        `bufferedReceipts[${index}] has an invalid shape.`,
      );
    }
    const assessmentMode = candidate.assessmentMode;
    const validAssessmentMode =
      workflowMode === "find"
        ? assessmentMode === "find-discovery-plan" ||
          assessmentMode === "find-candidate" ||
          assessmentMode === "find-criterion"
        : assessmentMode === "audit-dossier" ||
          assessmentMode === "audit-confirmed-event";
    if (!validAssessmentMode) {
      throw new Screen02WorkflowStoreValidationError(
        `bufferedReceipts[${index}] targets the wrong workflow mode.`,
      );
    }
    const receiptToken = candidate.receiptToken;
    const requiredType =
      workflowMode === "find"
        ? FIND_RECEIPT_TOKEN_TYPE
        : AUDIT_RECEIPT_TOKEN_TYPE;
    const tokenParts =
      typeof receiptToken === "string" ? receiptToken.split(".") : [];
    if (
      typeof receiptToken !== "string" ||
      receiptToken.length < 1 ||
      receiptToken.length >
        SCREEN_02_WORKFLOW_STORE_MAX_RECEIPT_TOKEN_CHARACTERS ||
      tokenParts.length !== 3 ||
      tokenParts[0] !== requiredType ||
      !BASE64URL_PATTERN.test(tokenParts[1] ?? "") ||
      (tokenParts[1]?.length ?? 0) % 4 === 1 ||
      !BASE64URL_PATTERN.test(tokenParts[2] ?? "") ||
      tokenParts[2]?.length !== 43
    ) {
      throw new Screen02WorkflowStoreValidationError(
        `bufferedReceipts[${index}] is not a bounded signed ${workflowMode} receipt token.`,
      );
    }
    return {
      receiptId: requireIdentifier(
        candidate.receiptId,
        `bufferedReceipts[${index}].receiptId`,
      ),
      requestId: requireIdentifier(
        candidate.requestId,
        `bufferedReceipts[${index}].requestId`,
      ),
      assessmentMode,
      receiptToken,
      receivedAt: requireTimestamp(
        candidate.receivedAt,
        `bufferedReceipts[${index}].receivedAt`,
      ),
    } as Screen02WorkflowBufferedReceipt;
  });
  if (
    new Set(receipts.map((receipt) => receipt.receiptId)).size !==
      receipts.length ||
    new Set(receipts.map((receipt) => receipt.requestId)).size !==
      receipts.length ||
    new Set(receipts.map((receipt) => receipt.receiptToken)).size !==
      receipts.length
  ) {
    throw new Screen02WorkflowStoreValidationError(
      "Buffered receipt, request, and signed-token identities must be unique.",
    );
  }
  if (
    receipts.reduce(
      (total, receipt) => total + receipt.receiptToken.length,
      0,
    ) > SCREEN_02_WORKFLOW_STORE_MAX_BUFFERED_RECEIPT_CHARACTERS
  ) {
    throw new Screen02WorkflowStoreValidationError(
      "Buffered signed receipts exceed the aggregate storage limit.",
    );
  }
  return canonicalClone(receipts, "bufferedReceipts");
}

function validateOperationReplays(
  value: unknown,
  generation: number,
  accessToken?: string,
) {
  if (
    !Array.isArray(value) ||
    value.length > SCREEN_02_WORKFLOW_STORE_MAX_OPERATION_REPLAYS
  ) {
    throw new Screen02WorkflowStoreValidationError(
      `Operation replay history must contain at most ${SCREEN_02_WORKFLOW_STORE_MAX_OPERATION_REPLAYS} records.`,
    );
  }
  const replays = value.map((candidate, index) => {
    if (!isRecord(candidate) || !exactKeys(candidate, operationReplayKeys)) {
      throw new Screen02WorkflowStoreValidationError(
        `operationReplays[${index}] has an invalid shape.`,
      );
    }
    if (
      !Number.isSafeInteger(candidate.committedGeneration) ||
      (candidate.committedGeneration as number) < 1 ||
      (candidate.committedGeneration as number) > generation
    ) {
      throw new Screen02WorkflowStoreValidationError(
        `operationReplays[${index}] has an invalid committed generation.`,
      );
    }
    const result = canonicalClone(
      candidate.result,
      `operationReplays[${index}].result`,
    );
    const serialized = serializeDeterministicJson(result);
    if (
      serialized.length >
      SCREEN_02_WORKFLOW_STORE_MAX_REPLAY_RESULT_CHARACTERS
    ) {
      throw new Screen02WorkflowStoreValidationError(
        `operationReplays[${index}].result exceeds the per-result limit.`,
      );
    }
    if (accessToken && serialized.includes(accessToken)) {
      throw new Screen02WorkflowStoreValidationError(
        "The raw workflow access token cannot be stored in an operation replay result.",
      );
    }
    return {
      operationId: requireIdentifier(
        candidate.operationId,
        `operationReplays[${index}].operationId`,
      ),
      operationKind: requireIdentifier(
        candidate.operationKind,
        `operationReplays[${index}].operationKind`,
      ),
      committedGeneration: candidate.committedGeneration as number,
      completedAt: requireTimestamp(
        candidate.completedAt,
        `operationReplays[${index}].completedAt`,
      ),
      result,
    };
  });
  if (
    new Set(replays.map((replay) => replay.operationId)).size !==
    replays.length
  ) {
    throw new Screen02WorkflowStoreValidationError(
      "Operation replay IDs must be unique within a run.",
    );
  }
  if (
    replays.reduce(
      (total, replay) => total + canonicalSize(replay.result, "replay result"),
      0,
    ) > SCREEN_02_WORKFLOW_STORE_MAX_REPLAY_RESULT_TOTAL_CHARACTERS
  ) {
    throw new Screen02WorkflowStoreValidationError(
      "Operation replay results exceed the aggregate storage limit.",
    );
  }
  return canonicalClone(replays, "operationReplays");
}

function validateRecord(value: unknown): Screen02WorkflowStoreRecord {
  if (
    !isRecord(value) ||
    (!exactKeys(value, legacyRecordKeys) && !exactKeys(value, recordKeys))
  ) {
    throw new Screen02WorkflowStoreValidationError(
      "Persisted Screen 2 workflow record has an invalid exact-key shape.",
    );
  }
  if (
    value.schemaVersion !== SCREEN_02_WORKFLOW_STORE_RECORD_SCHEMA_VERSION ||
    value.runIdentityAssumption !==
      SCREEN_02_WORKFLOW_STORE_RUN_IDENTITY_ASSUMPTION
  ) {
    throw new Screen02WorkflowStoreValidationError(
      "Persisted Screen 2 workflow record uses an unsupported schema or run identity assumption.",
    );
  }
  const runId = requireRunId(value.runId);
  if (
    typeof value.accessTokenSha256 !== "string" ||
    !SHA256_DIGEST_PATTERN.test(value.accessTokenSha256)
  ) {
    throw new Screen02WorkflowStoreValidationError(
      "Persisted workflow access-token digest is invalid.",
    );
  }
  if (value.mode !== "find" && value.mode !== "audit") {
    throw new Screen02WorkflowStoreValidationError(
      "Persisted Screen 2 workflow mode is invalid.",
    );
  }
  const screen01Fingerprint = requireFingerprint(
    value.screen01Fingerprint,
    "screen01Fingerprint",
  );
  if (
    !Number.isSafeInteger(value.stateRevision) ||
    (value.stateRevision as number) < 0 ||
    !Number.isSafeInteger(value.generation) ||
    (value.generation as number) < 0
  ) {
    throw new Screen02WorkflowStoreValidationError(
      "Persisted Screen 2 revision and generation must be non-negative safe integers.",
    );
  }
  const stateFingerprint = requireFingerprint(
    value.stateFingerprint,
    "stateFingerprint",
  );
  const decoded = decodeCanonicalEnvelope(value.stateEnvelope);
  if (
    decoded.mode !== value.mode ||
    decoded.state.runId !== runId ||
    decoded.state.screen01Fingerprint !== screen01Fingerprint ||
    decoded.state.revision !== value.stateRevision ||
    fingerprintScreen02WorkflowState(decoded.state) !== stateFingerprint
  ) {
    throw new Screen02WorkflowStoreValidationError(
      "Persisted Screen 2 envelope does not match its immutable metadata.",
    );
  }
  const createdAt = requireTimestamp(value.createdAt, "createdAt");
  const updatedAt = requireTimestamp(value.updatedAt, "updatedAt");
  if (Date.parse(updatedAt) < Date.parse(createdAt)) {
    throw new Screen02WorkflowStoreValidationError(
      "Persisted Screen 2 record time cannot move backward.",
    );
  }
  const expiresAt = requireTimestamp(value.expiresAt, "expiresAt");
  const expectedExpiresAt = screen02WorkflowRetentionExpiresAt({
    state: decoded.state,
    createdAt,
    updatedAt,
  });
  if (expiresAt !== expectedExpiresAt) {
    throw new Screen02WorkflowStoreValidationError(
      "Persisted Screen 2 expiration does not match the released retention policy.",
    );
  }
  const generation = value.generation as number;
  const continuationAccessTokenSha256s =
    "continuationAccessTokenSha256s" in value
      ? validateContinuationAccessTokenDigests(
          value.continuationAccessTokenSha256s,
        )
      : [];
  const record: Screen02WorkflowStoreRecord = {
    schemaVersion: SCREEN_02_WORKFLOW_STORE_RECORD_SCHEMA_VERSION,
    runIdentityAssumption:
      SCREEN_02_WORKFLOW_STORE_RUN_IDENTITY_ASSUMPTION,
    runId,
    accessTokenSha256: value.accessTokenSha256,
    continuationAccessTokenSha256s,
    mode: value.mode,
    screen01Fingerprint,
    stateEnvelope: decoded.envelope,
    stateRevision: value.stateRevision as number,
    stateFingerprint,
    bufferedReceipts: validateBufferedReceipts(
      value.bufferedReceipts,
      value.mode,
    ),
    generation,
    createdAt,
    updatedAt,
    expiresAt,
    operationReplays: validateOperationReplays(
      value.operationReplays,
      generation,
    ),
  };
  return canonicalClone(record, "Screen02WorkflowStoreRecord");
}

/** Internal sibling-store key; never expose the persisted record to a client. */
export function screen02WorkflowStoreParentRecordKey(runId: string) {
  return storeKey(requireRunId(runId));
}

/**
 * Fully validate a raw parent record and compare exact coordinates. Screen 3
 * calls this only from the transaction that writes its child record.
 */
export function screen02WorkflowStoreParentRecordMatches(
  value: unknown,
  expected: Screen02WorkflowStoreParentGuard,
) {
  const runId = requireRunId(expected.runId);
  if (
    !Number.isSafeInteger(expected.generation) ||
    expected.generation < 0 ||
    !Number.isSafeInteger(expected.revision) ||
    expected.revision < 0
  ) {
    throw new Screen02WorkflowStoreValidationError(
      "Screen 3 parent guard coordinates are invalid.",
    );
  }
  const stateFingerprint = requireFingerprint(
    expected.stateFingerprint,
    "Screen 3 parent guard state fingerprint",
  );
  const expiresAt = requireTimestamp(
    expected.expiresAt,
    "Screen 3 parent guard expiration",
  );
  if (value === undefined) return false;
  const record = validateRecord(value);
  return (
    record.runId === runId &&
    record.generation === expected.generation &&
    record.stateRevision === expected.revision &&
    record.stateFingerprint === stateFingerprint &&
    record.expiresAt === expiresAt
  );
}

function coordinates(record: Screen02WorkflowStoreRecord) {
  return {
    generation: record.generation,
    revision: record.stateRevision,
    stateFingerprint: record.stateFingerprint,
  };
}

function sameCoordinates(
  left: Screen02WorkflowStoreCoordinates,
  right: Screen02WorkflowStoreCoordinates,
) {
  return (
    left.generation === right.generation &&
    left.revision === right.revision &&
    left.stateFingerprint === right.stateFingerprint
  );
}

function sameEnvelope(left: unknown, right: unknown) {
  return (
    serializeDeterministicJson(left) === serializeDeterministicJson(right)
  );
}

function pruneOperationReplays(
  replays: Screen02WorkflowOperationReplay[],
) {
  const retained = [...replays];
  while (
    retained.length > SCREEN_02_WORKFLOW_STORE_MAX_OPERATION_REPLAYS ||
    retained.reduce(
      (total, replay) => total + canonicalSize(replay.result, "replay result"),
      0,
    ) > SCREEN_02_WORKFLOW_STORE_MAX_REPLAY_RESULT_TOTAL_CHARACTERS
  ) {
    retained.shift();
  }
  return retained;
}

class Screen02WorkflowStoreBase implements Screen02WorkflowStore {
  constructor(
    private readonly backend: StoreBackend,
    private readonly trackChildCascades = false,
  ) {}

  private async removeOpenOperationBinding(
    transaction: StoreTransaction,
    record: Screen02WorkflowStoreRecord,
  ) {
    const runBindingValue = await transaction.get(
      openOperationRunKey(record.runId),
    );
    if (runBindingValue === undefined) return;
    const runBinding = validateOpenOperationRunBinding(runBindingValue);
    if (runBinding.runId !== record.runId) {
      throw new Screen02WorkflowStoreValidationError(
        "The Screen 2 open-operation run key does not match its binding.",
      );
    }
    const bindingValue = await transaction.get(
      openOperationKey(runBinding.operationIdSha256),
    );
    if (bindingValue === undefined) {
      throw new Screen02WorkflowStoreValidationError(
        "The Screen 2 open-operation run binding has no primary binding.",
      );
    }
    const binding = validateOpenOperationBinding(bindingValue);
    if (
      binding.operationIdSha256 !== runBinding.operationIdSha256 ||
      binding.runId !== record.runId ||
      binding.screen01Fingerprint !== record.screen01Fingerprint ||
      !constantTimeDigestEqual(
        binding.accessTokenSha256,
        record.accessTokenSha256,
      )
    ) {
      throw new Screen02WorkflowStoreValidationError(
        "The Screen 2 open-operation binding does not match its canonical run.",
      );
    }
    await transaction.delete(openOperationKey(binding.operationIdSha256));
    await transaction.delete(openOperationRunKey(record.runId));
  }

  /**
   * Expiry cleanup must remain self-healing across schema upgrades and
   * interrupted multi-key writes. An unreadable expired workflow is already
   * unusable through every authenticated read path; keeping its auxiliary
   * binding must not poison every later MCP request.
   */
  private async removeOpenOperationBindingForCleanup(
    transaction: StoreTransaction,
    runId: string,
  ) {
    const runKey = openOperationRunKey(runId);
    const runBindingValue = await transaction.get(runKey);
    if (runBindingValue === undefined) return;
    let runBinding: Screen02WorkflowOpenOperationRunBinding | null = null;
    try {
      runBinding = validateOpenOperationRunBinding(runBindingValue);
    } catch {
      // Without a valid digest, cleanup cannot safely identify a primary
      // operation key. The run-scoped binding is still safe to remove.
    }
    if (runBinding?.runId === runId) {
      const bindingKey = openOperationKey(
        runBinding.operationIdSha256,
      );
      const bindingValue = await transaction.get(bindingKey);
      if (bindingValue !== undefined) {
        let belongsToExpiredRun = false;
        try {
          const binding = validateOpenOperationBinding(bindingValue);
          belongsToExpiredRun =
            binding.runId === runId &&
            binding.operationIdSha256 ===
              runBinding.operationIdSha256;
        } catch {
          // The key is derived from the validated run binding. An unreadable
          // primary at that exact digest cannot authorize a workflow and is
          // safe to purge with its expired run.
          belongsToExpiredRun = true;
        }
        if (belongsToExpiredRun) {
          await transaction.delete(bindingKey);
        }
      }
    }
    await transaction.delete(runKey);
  }

  async create(input: {
    runId: string;
    accessToken: string;
    stateEnvelope: unknown;
    bufferedReceipts?: Screen02WorkflowBufferedReceipt[];
    openOperation?: {
      operationId: string;
      identityNonce: string;
      signingKeyId: string;
      initialState?: "standard" | "blank";
    };
  }): Promise<Screen02WorkflowStoreCreateResult> {
    const runId = requireRunId(input.runId);
    const accessToken = requireAccessToken(input.accessToken);
    const accessTokenSha256 = await sha256Digest(accessToken);
    const operationIdSha256 = input.openOperation
      ? await sha256Digest(
          requireIdentifier(
            input.openOperation.operationId,
            "openOperation.operationId",
          ),
        )
      : null;
    const decoded = decodeCanonicalEnvelope(input.stateEnvelope);
    if (decoded.state.runId !== runId) {
      throw new Screen02WorkflowStoreValidationError(
        "The server-generated run ID does not match the canonical workflow state.",
      );
    }
    const requestedRecord = validateRecord({
      schemaVersion: SCREEN_02_WORKFLOW_STORE_RECORD_SCHEMA_VERSION,
      runIdentityAssumption:
        SCREEN_02_WORKFLOW_STORE_RUN_IDENTITY_ASSUMPTION,
      runId,
      accessTokenSha256,
      continuationAccessTokenSha256s: [],
      mode: decoded.mode,
      screen01Fingerprint: decoded.state.screen01Fingerprint,
      stateEnvelope: decoded.envelope,
      stateRevision: decoded.state.revision,
      stateFingerprint: fingerprintScreen02WorkflowState(decoded.state),
      bufferedReceipts: input.bufferedReceipts ?? [],
      generation: 0,
      createdAt: decoded.state.createdAt,
      updatedAt: decoded.state.updatedAt,
      expiresAt: screen02WorkflowRetentionExpiresAt({
        state: decoded.state,
        createdAt: decoded.state.createdAt,
        updatedAt: decoded.state.updatedAt,
      }),
      operationReplays: [],
    });
    assertRawAccessTokenAbsent(
      requestedRecord,
      accessToken,
      "a workflow record",
    );
    const requestedBinding = operationIdSha256
      ? validateOpenOperationBinding({
          schemaVersion: SCREEN_02_WORKFLOW_OPEN_OPERATION_SCHEMA_VERSION,
          operationIdSha256,
          runId,
          accessTokenSha256,
          screen01Fingerprint: requestedRecord.screen01Fingerprint,
          identityNonce: input.openOperation?.identityNonce,
          signingKeyId: input.openOperation?.signingKeyId,
          initialState: input.openOperation?.initialState ?? "standard",
        })
      : null;
    const requestedRunBinding = operationIdSha256
      ? validateOpenOperationRunBinding({
          schemaVersion:
            SCREEN_02_WORKFLOW_OPEN_OPERATION_RUN_SCHEMA_VERSION,
          runId,
          operationIdSha256,
        })
      : null;

    return this.backend.transaction(async (transaction) => {
      let existingBinding: Screen02WorkflowOpenOperationBinding | null = null;
      if (requestedBinding && requestedRunBinding) {
        const bindingValue = await transaction.get(
          openOperationKey(requestedBinding.operationIdSha256),
        );
        if (bindingValue !== undefined) {
          existingBinding = validateOpenOperationBinding(bindingValue);
          if (
            existingBinding.operationIdSha256 !==
            requestedBinding.operationIdSha256
          ) {
            throw new Screen02WorkflowStoreValidationError(
              "The Screen 2 open-operation key does not match its binding.",
            );
          }
          if (
            existingBinding.screen01Fingerprint !==
            requestedBinding.screen01Fingerprint
          ) {
            return {
              outcome: "open-operation-blocked" as const,
              reason: "baseline-mismatch" as const,
            };
          }
          if (
            existingBinding.initialState !== requestedBinding.initialState
          ) {
            return {
              outcome: "open-operation-blocked" as const,
              reason: "initialization-mismatch" as const,
            };
          }
          const runBindingValue = await transaction.get(
            openOperationRunKey(existingBinding.runId),
          );
          if (runBindingValue === undefined) {
            throw new Screen02WorkflowStoreValidationError(
              "The active Screen 2 open operation is missing its run binding.",
            );
          }
          const runBinding = validateOpenOperationRunBinding(runBindingValue);
          if (
            runBinding.runId !== existingBinding.runId ||
            runBinding.operationIdSha256 !==
              existingBinding.operationIdSha256
          ) {
            throw new Screen02WorkflowStoreValidationError(
              "The Screen 2 open-operation run binding is inconsistent.",
            );
          }
          if (
            existingBinding.runId !== requestedBinding.runId ||
            !constantTimeDigestEqual(
              existingBinding.accessTokenSha256,
              requestedBinding.accessTokenSha256,
            ) ||
            existingBinding.identityNonce !== requestedBinding.identityNonce ||
            existingBinding.signingKeyId !== requestedBinding.signingKeyId
          ) {
            return {
              outcome: "open-operation-raced" as const,
              binding: existingBinding,
            };
          }
        } else {
          const runBindingValue = await transaction.get(
            openOperationRunKey(requestedBinding.runId),
          );
          if (runBindingValue !== undefined) {
            throw new Screen02WorkflowStoreValidationError(
              "A Screen 2 open-operation run binding has no primary binding.",
            );
          }
        }
      }

      const persistRequestedBinding = async () => {
        if (!requestedBinding || !requestedRunBinding || existingBinding) {
          return;
        }
        await transaction.put(
          openOperationKey(requestedBinding.operationIdSha256),
          requestedBinding,
        );
        await transaction.put(
          openOperationRunKey(requestedRunBinding.runId),
          requestedRunBinding,
        );
      };

      const existingValue = await transaction.get(storeKey(runId));
      if (existingValue !== undefined) {
        const existing = validateRecord(existingValue);
        if (
          !constantTimeDigestEqual(
            existing.accessTokenSha256,
            accessTokenSha256,
          )
        ) {
          return { outcome: "unauthorized" as const };
        }
        if (
          requestedBinding &&
          existing.screen01Fingerprint !==
            requestedBinding.screen01Fingerprint
        ) {
          return {
            outcome: "open-operation-blocked" as const,
            reason: "baseline-mismatch" as const,
          };
        }
        await persistRequestedBinding();
        if (
          existing.generation === 0 &&
          existing.mode === requestedRecord.mode &&
          existing.screen01Fingerprint ===
            requestedRecord.screen01Fingerprint &&
          existing.stateRevision === requestedRecord.stateRevision &&
          existing.stateFingerprint === requestedRecord.stateFingerprint &&
          sameEnvelope(existing.stateEnvelope, requestedRecord.stateEnvelope) &&
          serializeDeterministicJson(existing.bufferedReceipts) ===
            serializeDeterministicJson(requestedRecord.bufferedReceipts)
        ) {
          return { outcome: "replayed" as const, record: existing };
        }
        return { outcome: "conflict" as const, record: existing };
      }
      if (existingBinding) {
        throw new Screen02WorkflowStoreValidationError(
          "An active Screen 2 open operation is missing its canonical run.",
        );
      }
      await persistRequestedBinding();
      await transaction.put(storeKey(runId), requestedRecord);
      await transaction.put(
        expiryKey(requestedRecord.expiresAt, requestedRecord.runId),
        requestedRecord.runId,
      );
      return { outcome: "created" as const, record: requestedRecord };
    });
  }

  async readOpenOperation(
    operationId: string,
  ): Promise<Screen02WorkflowOpenOperationReadResult> {
    const operationIdSha256 = await sha256Digest(
      requireIdentifier(operationId, "open operationId"),
    );
    const value = await this.backend.get(openOperationKey(operationIdSha256));
    if (value === undefined) return { outcome: "not-found" };
    const binding = validateOpenOperationBinding(value);
    if (binding.operationIdSha256 !== operationIdSha256) {
      throw new Screen02WorkflowStoreValidationError(
        "The Screen 2 open-operation key does not match its binding.",
      );
    }
    return { outcome: "bound", binding };
  }

  async read(input: {
    runId: string;
    accessToken: string;
  }): Promise<Screen02WorkflowStoreReadResult> {
    const runId = requireRunId(input.runId);
    const accessTokenSha256 = await sha256Digest(
      requireAccessToken(input.accessToken),
    );
    const value = await this.backend.get(storeKey(runId));
    if (value === undefined) return { outcome: "not-found" };
    const record = validateRecord(value);
    if (!recordAcceptsAccessTokenDigest(record, accessTokenSha256)) {
      return { outcome: "unauthorized" };
    }
    return { outcome: "authenticated", record };
  }

  /**
   * Trust boundary: the caller must have verified the model receipt's signed
   * HMAC capability before using this tokenless read.
   */
  async readTrusted(input: {
    runId: string;
  }): Promise<Screen02WorkflowStoreTrustedReadResult> {
    const runId = requireRunId(input.runId);
    const value = await this.backend.get(storeKey(runId));
    if (value === undefined) return { outcome: "not-found" };
    return { outcome: "found", record: validateRecord(value) };
  }

  async addContinuationAccessTokenTrusted(input: {
    runId: string;
    accessToken: string;
    expected: Screen02WorkflowStoreCoordinates;
    expectedExpiresAt: string;
  }): Promise<Screen02WorkflowStoreContinuationResult> {
    const runId = requireRunId(input.runId);
    const accessToken = requireAccessToken(input.accessToken);
    const accessTokenSha256 = await sha256Digest(accessToken);
    const expectedExpiresAt = requireTimestamp(
      input.expectedExpiresAt,
      "continuation parent expiration",
    );
    if (
      !Number.isSafeInteger(input.expected.generation) ||
      input.expected.generation < 0 ||
      !Number.isSafeInteger(input.expected.revision) ||
      input.expected.revision < 0
    ) {
      throw new Screen02WorkflowStoreValidationError(
        "Continuation parent coordinates must be non-negative safe integers.",
      );
    }
    requireFingerprint(
      input.expected.stateFingerprint,
      "continuation parent state fingerprint",
    );
    return this.backend.transaction(async (transaction) => {
      const value = await transaction.get(storeKey(runId));
      if (value === undefined) return { outcome: "not-found" as const };
      const current = validateRecord(value);
      if (
        !sameCoordinates(coordinates(current), input.expected) ||
        current.expiresAt !== expectedExpiresAt
      ) {
        return {
          outcome: "conflict" as const,
          record: current,
          current: coordinates(current),
        };
      }
      if (recordAcceptsAccessTokenDigest(current, accessTokenSha256)) {
        return { outcome: "existing" as const, record: current };
      }
      const continuationAccessTokenSha256s = [
        ...current.continuationAccessTokenSha256s,
        accessTokenSha256,
      ].slice(-SCREEN_02_WORKFLOW_STORE_MAX_CONTINUATION_ACCESS_TOKENS);
      const next = validateRecord({
        ...current,
        continuationAccessTokenSha256s,
      });
      assertRawAccessTokenAbsent(
        next,
        accessToken,
        "a workflow continuation record",
      );
      await transaction.put(storeKey(runId), next);
      return { outcome: "added" as const, record: next };
    });
  }

  async update(
    input: Screen02WorkflowStoreUpdateInput,
  ): Promise<Screen02WorkflowStoreUpdateResult> {
    const accessToken = requireAccessToken(input.accessToken);
    const accessTokenSha256 = await sha256Digest(accessToken);
    return this.updateSerialized(input, {
      accessToken,
      accessTokenSha256,
    });
  }

  /**
   * Trust boundary: the caller must have verified the model receipt's signed
   * HMAC capability before using this tokenless update. CAS and operation
   * replay checks remain mandatory and execute in the same transaction.
   */
  async updateTrusted(
    input: Screen02WorkflowStoreTrustedUpdateInput,
  ): Promise<Screen02WorkflowStoreTrustedUpdateResult> {
    const result = await this.updateSerialized(input);
    if (result.outcome === "unauthorized") {
      throw new Screen02WorkflowStoreValidationError(
        "Trusted workflow update reached an impossible authorization outcome.",
      );
    }
    return result;
  }

  private async updateSerialized(
    input: Screen02WorkflowStoreTrustedUpdateInput,
    authentication?: {
      accessToken: string;
      accessTokenSha256: string;
    },
  ): Promise<Screen02WorkflowStoreUpdateResult> {
    const runId = requireRunId(input.runId);
    const operationId = requireIdentifier(input.operationId, "operationId");
    const operationKind = requireIdentifier(
      input.operationKind,
      "operationKind",
    );
    if (
      !Number.isSafeInteger(input.expected.generation) ||
      input.expected.generation < 0 ||
      !Number.isSafeInteger(input.expected.revision) ||
      input.expected.revision < 0
    ) {
      throw new Screen02WorkflowStoreValidationError(
        "Expected store generation and state revision must be non-negative safe integers.",
      );
    }
    requireFingerprint(
      input.expected.stateFingerprint,
      "expected.stateFingerprint",
    );

    return this.backend.transaction(async (transaction) => {
      const value = await transaction.get(storeKey(runId));
      if (value === undefined) return { outcome: "not-found" as const };
      const current = validateRecord(value);
      if (
        authentication &&
        !recordAcceptsAccessTokenDigest(
          current,
          authentication.accessTokenSha256,
        )
      ) {
        return { outcome: "unauthorized" as const };
      }

      const priorReplay = current.operationReplays.find(
        (replay) => replay.operationId === operationId,
      );
      if (priorReplay) {
        if (priorReplay.operationKind !== operationKind) {
          return {
            outcome: "conflict" as const,
            record: current,
            current: coordinates(current),
          };
        }
        return {
          outcome: "replayed" as const,
          record: current,
          replayResult: canonicalClone(
            priorReplay.result,
            "operation replay result",
          ),
        };
      }

      if (!sameCoordinates(coordinates(current), input.expected)) {
        return {
          outcome: "conflict" as const,
          record: current,
          current: coordinates(current),
        };
      }

      const plan = await input.mutate(
        canonicalClone(current, "current workflow store record"),
      );
      if (
        plan.markPendingChildCascade !== undefined &&
        plan.markPendingChildCascade !== true &&
        (
          !isRecord(plan.markPendingChildCascade) ||
          plan.markPendingChildCascade.kind !==
            "screen03-stale-after-host-review" ||
          typeof plan.markPendingChildCascade.originatingTaskId !== "string"
        )
      ) {
        throw new Screen02WorkflowStoreValidationError(
          "A workflow update has an invalid pending child-cascade marker.",
        );
      }
      const updatedAt = requireTimestamp(plan.updatedAt, "updatedAt");
      if (Date.parse(updatedAt) < Date.parse(current.updatedAt)) {
        throw new Screen02WorkflowStoreValidationError(
          "Workflow store update time cannot move backward.",
        );
      }
      const successor = decodeCanonicalEnvelope(plan.stateEnvelope);
      if (
        successor.state.runId !== current.runId ||
        successor.mode !== current.mode ||
        successor.state.screen01Fingerprint !== current.screen01Fingerprint
      ) {
        throw new Screen02WorkflowStoreValidationError(
          "A canonical workflow update cannot replace its run, mode, or Screen 1 baseline.",
        );
      }
      const successorFingerprint = fingerprintScreen02WorkflowState(
        successor.state,
      );
      if (
        successor.state.revision < current.stateRevision ||
        (successor.state.revision === current.stateRevision &&
          successorFingerprint !== current.stateFingerprint)
      ) {
        throw new Screen02WorkflowStoreValidationError(
          "A workflow update cannot move backward or rewrite a state revision.",
        );
      }
      const bufferedReceipts = validateBufferedReceipts(
        plan.bufferedReceipts,
        current.mode,
      );
      const existingReceipts = new Map(
        current.bufferedReceipts.map((receipt) => [receipt.receiptId, receipt]),
      );
      for (const receipt of bufferedReceipts) {
        const prior = existingReceipts.get(receipt.receiptId);
        if (
          prior &&
          serializeDeterministicJson(prior) !==
            serializeDeterministicJson(receipt)
        ) {
          throw new Screen02WorkflowStoreValidationError(
            `Buffered receipt ${receipt.receiptId} cannot be rewritten.`,
          );
        }
      }
      const replayResult = canonicalClone(
        plan.replayResult,
        "operation replay result",
      );
      const replaySerialized = serializeDeterministicJson(replayResult);
      if (
        replaySerialized.length >
        SCREEN_02_WORKFLOW_STORE_MAX_REPLAY_RESULT_CHARACTERS
      ) {
        throw new Screen02WorkflowStoreValidationError(
          "Operation replay result exceeds its bounded storage limit.",
        );
      }
      if (
        authentication &&
        replaySerialized.includes(authentication.accessToken)
      ) {
        throw new Screen02WorkflowStoreValidationError(
          "The raw workflow access token cannot be stored in an operation replay result.",
        );
      }

      const nextGeneration = current.generation + 1;
      const operationReplays = pruneOperationReplays([
        ...current.operationReplays,
        {
          operationId,
          operationKind,
          committedGeneration: nextGeneration,
          completedAt: updatedAt,
          result: replayResult,
        },
      ]);
      const next = validateRecord({
        ...current,
        stateEnvelope: successor.envelope,
        stateRevision: successor.state.revision,
        stateFingerprint: successorFingerprint,
        bufferedReceipts,
        generation: nextGeneration,
        updatedAt,
        expiresAt: screen02WorkflowRetentionExpiresAt({
          state: successor.state,
          createdAt: current.createdAt,
          updatedAt,
        }),
        operationReplays,
      });
      if (authentication) {
        assertRawAccessTokenAbsent(
          next,
          authentication.accessToken,
          "a workflow record",
        );
      }
      await transaction.delete(expiryKey(current.expiresAt, current.runId));
      await transaction.put(storeKey(runId), next);
      await transaction.put(
        expiryKey(next.expiresAt, next.runId),
        next.runId,
      );
      if (plan.markPendingChildCascade !== undefined) {
        await transaction.put(
          pendingChildCascadeKey(runId),
          pendingChildCascadeMarker(runId, plan.markPendingChildCascade),
        );
      }
      return {
        outcome: "updated" as const,
        record: next,
        replayResult,
      };
    });
  }

  async retire(input: {
    runId: string;
    accessToken: string;
    expected: Screen02WorkflowStoreCoordinates;
  }): Promise<Screen02WorkflowStoreRetireResult> {
    const runId = requireRunId(input.runId);
    const accessTokenSha256 = await sha256Digest(
      requireAccessToken(input.accessToken),
    );
    if (
      !Number.isSafeInteger(input.expected.generation) ||
      input.expected.generation < 0 ||
      !Number.isSafeInteger(input.expected.revision) ||
      input.expected.revision < 0
    ) {
      throw new Screen02WorkflowStoreValidationError(
        "Retirement coordinates must be non-negative safe integers.",
      );
    }
    requireFingerprint(
      input.expected.stateFingerprint,
      "retirement state fingerprint",
    );
    return this.backend.transaction(async (transaction) => {
      const value = await transaction.get(storeKey(runId));
      if (value === undefined) {
        return { outcome: "not-found" as const, runId };
      }
      const current = validateRecord(value);
      if (!recordAcceptsAccessTokenDigest(current, accessTokenSha256)) {
        return { outcome: "unauthorized" as const };
      }
      if (!sameCoordinates(coordinates(current), input.expected)) {
        return {
          outcome: "conflict" as const,
          record: current,
          current: coordinates(current),
        };
      }
      await this.removeOpenOperationBinding(transaction, current);
      await transaction.delete(storeKey(runId));
      await transaction.delete(expiryKey(current.expiresAt, runId));
      return { outcome: "retired" as const, runId };
    });
  }

  async cleanupExpired(
    at: string,
  ): Promise<Screen02WorkflowStoreCleanupResult> {
    const now = Date.parse(requireTimestamp(at, "cleanup time"));
    const entries = await this.backend.list({
      prefix: EXPIRY_KEY_PREFIX,
      limit: SCREEN_02_WORKFLOW_STORE_CLEANUP_BATCH_SIZE + 1,
    });
    const due = [...entries.entries()].filter(([key, indexedRunId]) => {
      const parsed = expirationFromKey(key);
      return (
        !parsed ||
        indexedRunId !== parsed.runId ||
        Date.parse(parsed.expiresAt) <= now
      );
    });
    const batchLimitReached =
      due.length > SCREEN_02_WORKFLOW_STORE_CLEANUP_BATCH_SIZE;
    const deletedRunIds: string[] = [];
    for (const [key, indexedRunId] of due.slice(
      0,
      SCREEN_02_WORKFLOW_STORE_CLEANUP_BATCH_SIZE,
    )) {
      const parsed = expirationFromKey(key);
      const deletedRunId = await this.backend.transaction(
        async (transaction) => {
          const fallbackRunId =
            typeof indexedRunId === "string" &&
            RUN_ID_PATTERN.test(indexedRunId)
              ? indexedRunId
              : null;
          const runId =
            parsed?.runId ??
            runIdFromExpirationKey(key) ??
            fallbackRunId;
          if (!runId) {
            await transaction.delete(key);
            return null;
          }
          const value = await transaction.get(storeKey(runId));
          if (value === undefined) {
            await this.removeOpenOperationBindingForCleanup(
              transaction,
              runId,
            );
            if (this.trackChildCascades) {
              await transaction.put(pendingChildCascadeKey(runId), runId);
            }
            await transaction.delete(key);
            return runId;
          }
          let storedExpiresAt: string | null = null;
          if (isRecord(value)) {
            try {
              storedExpiresAt = requireTimestamp(
                value.expiresAt,
                "persisted cleanup expiration",
              );
            } catch {
              storedExpiresAt = null;
            }
          }
          if (
            storedExpiresAt !== null &&
            (
              !parsed ||
              indexedRunId !== parsed.runId ||
              storedExpiresAt !== parsed.expiresAt
            )
          ) {
            await transaction.delete(key);
            if (Date.parse(storedExpiresAt) > now) {
              let currentRecord: Screen02WorkflowStoreRecord | null = null;
              try {
                currentRecord = validateRecord(value);
              } catch {
                // An unreadable record fails closed below; a single future
                // timestamp cannot extend retention for invalid state.
              }
              if (
                currentRecord?.runId === runId &&
                currentRecord.expiresAt === storedExpiresAt
              ) {
                await transaction.put(
                  expiryKey(storedExpiresAt, runId),
                  runId,
                );
                return null;
              }
            }
          }
          // Do not fully decode an already-due record merely to delete it.
          // Old, malformed, or partially written envelopes must fail closed
          // through reads while remaining removable at their retention bound.
          await this.removeOpenOperationBindingForCleanup(
            transaction,
            runId,
          );
          // Persist the parent identity in the same transaction that deletes
          // it. Child cleanup acknowledges this marker only after both the
          // Screen 3 record and every bounded host-task batch are gone.
          if (this.trackChildCascades) {
            await transaction.put(pendingChildCascadeKey(runId), runId);
          }
          await transaction.delete(storeKey(runId));
          if (storedExpiresAt !== null) {
            await transaction.delete(expiryKey(storedExpiresAt, runId));
          }
          await transaction.delete(key);
          return runId;
        },
      );
      if (
        deletedRunId !== null &&
        !deletedRunIds.includes(deletedRunId)
      ) {
        deletedRunIds.push(deletedRunId);
      }
    }
    return {
      deletedRunIds,
      nextExpirationAt: await this.nextExpirationAt(),
      batchLimitReached,
    };
  }

  async listPendingChildCascades(
    limit = SCREEN_02_WORKFLOW_STORE_CLEANUP_BATCH_SIZE,
  ): Promise<Screen02WorkflowPendingChildCascades> {
    if (!Number.isInteger(limit) || limit < 1 ||
      limit > SCREEN_02_WORKFLOW_STORE_CLEANUP_BATCH_SIZE) {
      throw new Screen02WorkflowStoreValidationError(
        "Pending child-cascade limit is invalid.",
      );
    }
    const entries = await this.backend.list({
      prefix: PENDING_CHILD_CASCADE_KEY_PREFIX,
      limit: limit + 1,
    });
    const runIds: string[] = [];
    for (const [key, value] of entries) {
      const cascade = pendingChildCascade(key, value);
      if (cascade) {
        runIds.push(cascade.runId);
        continue;
      }
      // A malformed continuation marker must not permanently arm the retry
      // alarm. It cannot safely identify a child, so delete only that marker.
      await this.backend.transaction(async (transaction) => {
        await transaction.delete(key);
      });
    }
    return {
      runIds: runIds.slice(0, limit),
      batchLimitReached: runIds.length > limit,
    };
  }

  async readPendingChildCascade(
    runId: string,
  ): Promise<Screen02WorkflowPendingChildCascadeReadResult> {
    const canonicalRunId = requireRunId(runId);
    const value = await this.backend.get(pendingChildCascadeKey(canonicalRunId));
    if (value === undefined) return { outcome: "not-found" };
    const cascade = pendingChildCascade(
      pendingChildCascadeKey(canonicalRunId),
      value,
    );
    if (!cascade) {
      throw new Screen02WorkflowStoreValidationError(
        "The pending child-cascade marker is malformed.",
      );
    }
    return { outcome: "found", cascade };
  }

  async acknowledgePendingChildCascade(
    runId: string,
    expected?: Screen02WorkflowPendingChildCascade,
  ) {
    const canonicalRunId = requireRunId(runId);
    await this.backend.transaction(async (transaction) => {
      const key = pendingChildCascadeKey(canonicalRunId);
      if (expected) {
        const current = pendingChildCascade(key, await transaction.get(key));
        if (
          !current || current.kind !== expected.kind ||
          current.runId !== expected.runId ||
          current.originatingTaskId !== expected.originatingTaskId
        ) return;
      }
      await transaction.delete(key);
    });
  }

  async nextExpirationAt() {
    const pendingCascades = await this.backend.list({
      prefix: PENDING_CHILD_CASCADE_KEY_PREFIX,
      limit: 1,
    });
    if (pendingCascades.size > 0) return CLEANUP_RETRY_AT;
    const entries = await this.backend.list({
      prefix: EXPIRY_KEY_PREFIX,
      limit: 16,
    });
    for (const [key, indexedRunId] of entries) {
      const parsed = expirationFromKey(key);
      if (!parsed || indexedRunId !== parsed.runId) {
        // A finite past timestamp makes the Durable Object re-arm cleanup at
        // its one-second floor until malformed index rows are exhausted.
        return CLEANUP_RETRY_AT;
      }
      return parsed.expiresAt;
    }
    return null;
  }
}

/**
 * Deterministic in-memory implementation used by focused contract tests. The
 * mutex models serialized Durable Object transactions, including rollback on
 * a rejected mutation.
 */
export class InMemoryScreen02WorkflowStore extends Screen02WorkflowStoreBase {
  constructor() {
    let backend: StoreBackend;
    const records = new Map<string, unknown>();
    let queue: Promise<void> = Promise.resolve();

    const locked = async <T>(callback: () => Promise<T>) => {
      const previous = queue;
      let release!: () => void;
      queue = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        return await callback();
      } finally {
        release();
      }
    };

    backend = {
      get: (key) =>
        locked(async () =>
          records.has(key)
            ? canonicalClone(records.get(key), "in-memory store value")
            : undefined,
        ),
      list: ({ prefix, limit }) =>
        locked(async () =>
          new Map(
            [...records.entries()]
              .filter(([key]) => key.startsWith(prefix))
              .sort(([left], [right]) => left.localeCompare(right))
              .slice(0, limit)
              .map(([key, value]) => [
                key,
                canonicalClone(value, "in-memory list value"),
              ]),
          ),
        ),
      transaction: (callback) =>
        locked(async () => {
          const writes = new Map<string, unknown>();
          const deletions = new Set<string>();
          const result = await callback({
            get: async (key) => {
              const value = deletions.has(key)
                ? undefined
                : writes.has(key)
                  ? writes.get(key)
                  : records.get(key);
              return value === undefined
                ? undefined
                : canonicalClone(value, "in-memory transaction value");
            },
            put: async (key, value) => {
              deletions.delete(key);
              writes.set(
                key,
                canonicalClone(value, "in-memory transaction write"),
              );
            },
            delete: async (key) => {
              writes.delete(key);
              deletions.add(key);
            },
          });
          for (const key of deletions) records.delete(key);
          for (const [key, value] of writes) records.set(key, value);
          return result;
        }),
    };
    super(backend);
  }
}

/**
 * Durable Object implementation. The callback supplied to update must remain
 * deterministic and side-effect free because Durable Object transactions may
 * retry it after a storage conflict.
 */
export class DurableObjectScreen02WorkflowStore extends Screen02WorkflowStoreBase {
  constructor(storage: DurableObjectStorage) {
    const backend: StoreBackend = {
      get: (key) => storage.get(key),
      list: ({ prefix, limit }) => storage.list({ prefix, limit }),
      transaction: (callback) =>
        storage.transaction((transaction) =>
          callback({
            get: (key) => transaction.get(key),
            put: (key, value) => transaction.put(key, value),
            delete: async (key) => {
              await transaction.delete(key);
            },
          }),
        ),
    };
    super(backend, true);
  }
}
