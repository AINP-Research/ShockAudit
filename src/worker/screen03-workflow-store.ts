import {
  fingerprintScreen03VerificationState,
  requireScreen03VerificationState,
  type Screen03VerificationState,
} from "../core/screen03-workflow";
import { isScreen03SafeRunRef } from "../core/screen03-briefing";
import {
  screen02WorkflowStoreParentRecordKey,
  screen02WorkflowStoreParentRecordMatches,
  type Screen02WorkflowStoreParentGuard,
} from "./screen02-workflow-store";

export const SCREEN_03_WORKFLOW_STORE_RECORD_SCHEMA_VERSION =
  "screen-03-workflow-store-record-v1" as const;

const RECORD_PREFIX = "screen03-workflow-v030:";
const EXPIRY_PREFIX = "screen03-workflow-expiry-v1:";
const SAFE_RUN_REF_PREFIX = "screen03-safe-run-ref-v1:";
const CLEANUP_RETRY_AT = "1970-01-01T00:00:00.000Z";
const MAX_STATE_CHARACTERS = 768 * 1024;
const RUN_ID = /^s2r_[A-Za-z0-9_-]{43,128}$/;

export type Screen03WorkflowStoreRecord = {
  schemaVersion: typeof SCREEN_03_WORKFLOW_STORE_RECORD_SCHEMA_VERSION;
  parentRunId: string;
  parentStateFingerprint: string;
  /** Present after the v0.3.14 continuation migration. */
  parentGeneration?: number;
  /** Present after the v0.3.14 continuation migration. */
  parentRevision?: number;
  /** Original Screen 2 handoff producer version; present after migration. */
  handoffProducerAppVersion?: string;
  handoffFingerprint: string;
  state: Screen03VerificationState;
  stateRevision: number;
  stateFingerprint: string;
  generation: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

export type Screen03WorkflowCoordinates = {
  revision: number;
  stateFingerprint: string;
  generation: number;
};

export type Screen03WorkflowStoreReadResult =
  | { outcome: "found"; record: Screen03WorkflowStoreRecord }
  | { outcome: "not-found" };

export type Screen03WorkflowStoreWriteResult =
  | {
      outcome: "created" | "replaced" | "updated";
      record: Screen03WorkflowStoreRecord;
    }
  | {
      outcome: "existing" | "conflict";
      record: Screen03WorkflowStoreRecord;
    };

export interface Screen03WorkflowStore {
  read(parentRunId: string): Promise<Screen03WorkflowStoreReadResult>;
  /** Opaque model-visible lookup; implementations must verify the state owns the index. */
  readBySafeRunRef?(
    safeRunRef: string,
  ): Promise<Screen03WorkflowStoreReadResult>;
  createOrReplace(input: {
    parentRunId: string;
    parentStateFingerprint: string;
    handoffProducerAppVersion: string;
    parentGuard: Screen02WorkflowStoreParentGuard;
    state: Screen03VerificationState;
    expiresAt: string;
  }): Promise<Screen03WorkflowStoreWriteResult>;
  update(input: {
    parentRunId: string;
    parentStateFingerprint: string;
    handoffProducerAppVersion: string;
    parentGuard: Screen02WorkflowStoreParentGuard;
    expected: Screen03WorkflowCoordinates;
    state: Screen03VerificationState;
    expiresAt: string;
  }): Promise<Screen03WorkflowStoreWriteResult>;
  retire(parentRunId: string): Promise<void>;
  cleanupExpired(at: string, limit?: number): Promise<number>;
  nextExpirationAt(): Promise<string | null>;
}

type Transaction = {
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
};

type Backend = Transaction & {
  list(input: { prefix: string; limit?: number }): Promise<Map<string, unknown>>;
  transaction<T>(callback: (transaction: Transaction) => Promise<T>): Promise<T>;
};

function iso(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?Z$/.test(
      value,
    ) &&
    Number.isFinite(Date.parse(value))
  );
}

function exact(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function requireRunId(value: unknown) {
  if (typeof value !== "string" || !RUN_ID.test(value)) {
    throw new Error("Screen 3 requires a canonical Screen 2 run ID.");
  }
  return value;
}

function recordKey(parentRunId: string) {
  return `${RECORD_PREFIX}${requireRunId(parentRunId)}`;
}

function safeRunRefKey(value: unknown) {
  if (!isScreen03SafeRunRef(value)) {
    throw new Error("Screen 3 briefing safe run reference is invalid.");
  }
  return `${SAFE_RUN_REF_PREFIX}${value}`;
}

function recordSafeRunRef(record: Screen03WorkflowStoreRecord) {
  return record.state.briefing?.safeRunRef ?? null;
}

function expiryKey(record: Pick<Screen03WorkflowStoreRecord, "expiresAt" | "parentRunId">) {
  return `${EXPIRY_PREFIX}${record.expiresAt}:${record.parentRunId}`;
}

function expirationFromKey(key: string) {
  if (!key.startsWith(EXPIRY_PREFIX)) return null;
  const suffix = key.slice(EXPIRY_PREFIX.length);
  const separator = suffix.indexOf(":s2r_");
  if (separator < 1) return null;
  const expiresAt = suffix.slice(0, separator);
  const parentRunId = suffix.slice(separator + 1);
  return iso(expiresAt) && RUN_ID.test(parentRunId)
    ? { expiresAt, parentRunId }
    : null;
}

function parentRunIdFromExpirationKey(key: string) {
  if (!key.startsWith(EXPIRY_PREFIX)) return null;
  const suffix = key.slice(EXPIRY_PREFIX.length);
  const separator = suffix.indexOf(":s2r_");
  if (separator < 0) return null;
  const parentRunId = suffix.slice(separator + 1);
  return RUN_ID.test(parentRunId) ? parentRunId : null;
}

function persistedExpiration(value: unknown) {
  if (
    typeof value !== "object" ||
    value === null ||
    !("expiresAt" in value) ||
    !iso(value.expiresAt)
  ) {
    return null;
  }
  return value.expiresAt;
}

function requireFingerprint(value: unknown, label: string) {
  if (typeof value !== "string" || !/^fnv1a64:[0-9a-f]{16}$/.test(value)) {
    throw new Error(`${label} is invalid.`);
  }
  return value;
}

function requireProducerAppVersion(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length > 200 ||
    value.trim().length === 0 ||
    value !== value.trim()
  ) {
    throw new Error("Screen 3 handoff producer app version is invalid.");
  }
  return value;
}

function requireRecord(value: unknown): Screen03WorkflowStoreRecord {
  const candidateRecord = value as Record<string, unknown>;
  const hasParentCoordinates = Boolean(
    value && typeof value === "object" && !Array.isArray(value) &&
      Object.prototype.hasOwnProperty.call(value, "parentGeneration") &&
      Object.prototype.hasOwnProperty.call(value, "parentRevision"),
  );
  const hasHandoffProducerAppVersion = Boolean(
    value && typeof value === "object" && !Array.isArray(value) &&
      Object.prototype.hasOwnProperty.call(
        value,
        "handoffProducerAppVersion",
      ),
  );
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !exact(candidateRecord, [
      "schemaVersion",
      "parentRunId",
      "parentStateFingerprint",
      ...(hasParentCoordinates
        ? ["parentGeneration", "parentRevision"]
        : []),
      ...(hasHandoffProducerAppVersion
        ? ["handoffProducerAppVersion"]
        : []),
      "handoffFingerprint",
      "state",
      "stateRevision",
      "stateFingerprint",
      "generation",
      "createdAt",
      "updatedAt",
      "expiresAt",
    ])
  ) {
    throw new Error("Stored Screen 3 workflow state is malformed.");
  }
  const candidate = candidateRecord;
  const state = requireScreen03VerificationState(candidate.state);
  const parentRunId = requireRunId(candidate.parentRunId);
  const parentStateFingerprint = requireFingerprint(
    candidate.parentStateFingerprint,
    "Screen 3 parent fingerprint",
  );
  const stateFingerprint = requireFingerprint(
    candidate.stateFingerprint,
    "Screen 3 state fingerprint",
  );
  if (
    candidate.schemaVersion !== SCREEN_03_WORKFLOW_STORE_RECORD_SCHEMA_VERSION ||
    state.runId !== parentRunId ||
    candidate.handoffFingerprint !== state.upstream.handoffFingerprint ||
    candidate.stateRevision !== state.revision ||
    stateFingerprint !== fingerprintScreen03VerificationState(state) ||
    (hasParentCoordinates &&
      (!Number.isSafeInteger(candidate.parentGeneration) ||
        (candidate.parentGeneration as number) < 0 ||
        !Number.isSafeInteger(candidate.parentRevision) ||
        (candidate.parentRevision as number) < 0)) ||
    (hasHandoffProducerAppVersion &&
      requireProducerAppVersion(candidate.handoffProducerAppVersion) !==
        candidate.handoffProducerAppVersion) ||
    !Number.isSafeInteger(candidate.generation) ||
    (candidate.generation as number) < 1 ||
    !iso(candidate.createdAt) ||
    !iso(candidate.updatedAt) ||
    !iso(candidate.expiresAt) ||
    (candidate.createdAt as string) > (candidate.updatedAt as string) ||
    (candidate.updatedAt as string) >= (candidate.expiresAt as string) ||
    JSON.stringify(state).length > MAX_STATE_CHARACTERS
  ) {
    throw new Error("Stored Screen 3 workflow state failed validation.");
  }
  return {
    schemaVersion: SCREEN_03_WORKFLOW_STORE_RECORD_SCHEMA_VERSION,
    parentRunId,
    parentStateFingerprint,
    ...(hasParentCoordinates
      ? {
          parentGeneration: candidate.parentGeneration as number,
          parentRevision: candidate.parentRevision as number,
        }
      : {}),
    ...(hasHandoffProducerAppVersion
      ? {
          handoffProducerAppVersion: requireProducerAppVersion(
            candidate.handoffProducerAppVersion,
          ),
        }
      : {}),
    handoffFingerprint: state.upstream.handoffFingerprint,
    state,
    stateRevision: state.revision,
    stateFingerprint,
    generation: candidate.generation as number,
    createdAt: candidate.createdAt as string,
    updatedAt: candidate.updatedAt as string,
    expiresAt: candidate.expiresAt as string,
  };
}

function nextRecord(input: {
  current?: Screen03WorkflowStoreRecord;
  parentRunId: string;
  parentStateFingerprint: string;
  handoffProducerAppVersion: string;
  parentGuard: Screen02WorkflowStoreParentGuard;
  state: Screen03VerificationState;
  expiresAt: string;
}) {
  const state = requireScreen03VerificationState(input.state);
  const parentRunId = requireRunId(input.parentRunId);
  const parentStateFingerprint = requireFingerprint(
    input.parentStateFingerprint,
    "Screen 3 parent fingerprint",
  );
  const handoffProducerAppVersion = requireProducerAppVersion(
    input.handoffProducerAppVersion,
  );
  if (
    input.current?.handoffProducerAppVersion !== undefined &&
    input.current.handoffProducerAppVersion !== handoffProducerAppVersion
  ) {
    throw new Error(
      "A Screen 3 child cannot change its original handoff producer app version.",
    );
  }
  if (
    state.runId !== parentRunId ||
    !iso(input.expiresAt) ||
    state.updatedAt >= input.expiresAt ||
    JSON.stringify(state).length > MAX_STATE_CHARACTERS
  ) {
    throw new Error("Screen 3 workflow state cannot be stored.");
  }
  return requireRecord({
    schemaVersion: SCREEN_03_WORKFLOW_STORE_RECORD_SCHEMA_VERSION,
    parentRunId,
    parentStateFingerprint,
    parentGeneration: input.parentGuard.generation,
    parentRevision: input.parentGuard.revision,
    handoffProducerAppVersion,
    handoffFingerprint: state.upstream.handoffFingerprint,
    state,
    stateRevision: state.revision,
    stateFingerprint: fingerprintScreen03VerificationState(state),
    generation: (input.current?.generation ?? 0) + 1,
    createdAt: input.current?.createdAt ?? state.createdAt,
    updatedAt: state.updatedAt,
    expiresAt: input.expiresAt,
  });
}

class Screen03WorkflowStoreBackend implements Screen03WorkflowStore {
  constructor(
    private readonly backend: Backend,
    private readonly enforceParentGuard: boolean,
  ) {}

  private async assertCanonicalParent(
    transaction: Transaction,
    parentRunId: string,
    parentStateFingerprint: string,
    expiresAt: string,
    parentGuard: Screen02WorkflowStoreParentGuard,
  ) {
    if (
      parentGuard.runId !== parentRunId ||
      parentGuard.stateFingerprint !== parentStateFingerprint ||
      parentGuard.expiresAt !== expiresAt
    ) {
      throw new Error(
        "Screen 3 parent fingerprint, expiration, or run guard does not match the requested child coordinates.",
      );
    }
    if (!this.enforceParentGuard) return;
    const parent = await transaction.get(
      screen02WorkflowStoreParentRecordKey(parentRunId),
    );
    if (!screen02WorkflowStoreParentRecordMatches(parent, parentGuard)) {
      throw new Error(
        "The canonical Screen 2 parent became unavailable or changed before Screen 3 could be stored.",
      );
    }
  }

  async read(parentRunId: string): Promise<Screen03WorkflowStoreReadResult> {
    const value = await this.backend.get(recordKey(parentRunId));
    return value === undefined
      ? { outcome: "not-found" }
      : { outcome: "found", record: requireRecord(value) };
  }

  async readBySafeRunRef(
    safeRunRef: string,
  ): Promise<Screen03WorkflowStoreReadResult> {
    const indexedRunId = await this.backend.get(safeRunRefKey(safeRunRef));
    if (typeof indexedRunId !== "string" || !RUN_ID.test(indexedRunId)) {
      return { outcome: "not-found" };
    }
    const read = await this.read(indexedRunId);
    return read.outcome === "found" &&
        recordSafeRunRef(read.record) === safeRunRef
      ? read
      : { outcome: "not-found" };
  }

  async createOrReplace(input: {
    parentRunId: string;
    parentStateFingerprint: string;
    handoffProducerAppVersion: string;
    parentGuard: Screen02WorkflowStoreParentGuard;
    state: Screen03VerificationState;
    expiresAt: string;
  }): Promise<Screen03WorkflowStoreWriteResult> {
    return this.backend.transaction(async (transaction) => {
      await this.assertCanonicalParent(
        transaction,
        input.parentRunId,
        input.parentStateFingerprint,
        input.expiresAt,
        input.parentGuard,
      );
      const key = recordKey(input.parentRunId);
      const raw = await transaction.get(key);
      const current = raw === undefined ? undefined : requireRecord(raw);
      if (
        current &&
        current.parentStateFingerprint === input.parentStateFingerprint &&
        current.handoffProducerAppVersion ===
          input.handoffProducerAppVersion &&
        current.handoffFingerprint === input.state.upstream.handoffFingerprint
      ) {
        return { outcome: "existing", record: current };
      }
      const record = nextRecord({ ...input, ...(current ? { current } : {}) });
      const nextSafeRunRef = recordSafeRunRef(record);
      if (nextSafeRunRef) {
        const indexedRunId = await transaction.get(
          safeRunRefKey(nextSafeRunRef),
        );
        if (
          indexedRunId !== undefined && indexedRunId !== record.parentRunId
        ) {
          throw new Error("Screen 3 briefing safe run reference is already in use.");
        }
      }
      if (current) await transaction.delete(expiryKey(current));
      const currentSafeRunRef = current ? recordSafeRunRef(current) : null;
      if (currentSafeRunRef && currentSafeRunRef !== nextSafeRunRef) {
        await transaction.delete(safeRunRefKey(currentSafeRunRef));
      }
      await transaction.put(key, record);
      await transaction.put(expiryKey(record), record.parentRunId);
      if (nextSafeRunRef) {
        await transaction.put(safeRunRefKey(nextSafeRunRef), record.parentRunId);
      }
      return {
        outcome: current ? "replaced" : "created",
        record,
      };
    });
  }

  async update(input: {
    parentRunId: string;
    parentStateFingerprint: string;
    handoffProducerAppVersion: string;
    parentGuard: Screen02WorkflowStoreParentGuard;
    expected: Screen03WorkflowCoordinates;
    state: Screen03VerificationState;
    expiresAt: string;
  }): Promise<Screen03WorkflowStoreWriteResult> {
    return this.backend.transaction(async (transaction) => {
      await this.assertCanonicalParent(
        transaction,
        input.parentRunId,
        input.parentStateFingerprint,
        input.expiresAt,
        input.parentGuard,
      );
      const key = recordKey(input.parentRunId);
      const raw = await transaction.get(key);
      if (raw === undefined) {
        throw new Error("The canonical Screen 3 workflow is unavailable.");
      }
      const current = requireRecord(raw);
      if (
        current.parentStateFingerprint !== input.parentStateFingerprint ||
        current.generation !== input.expected.generation ||
        current.stateRevision !== input.expected.revision ||
        current.stateFingerprint !== input.expected.stateFingerprint
      ) {
        return { outcome: "conflict", record: current };
      }
      const record = nextRecord({ ...input, current });
      const nextSafeRunRef = recordSafeRunRef(record);
      if (nextSafeRunRef) {
        const indexedRunId = await transaction.get(
          safeRunRefKey(nextSafeRunRef),
        );
        if (
          indexedRunId !== undefined && indexedRunId !== record.parentRunId
        ) {
          throw new Error("Screen 3 briefing safe run reference is already in use.");
        }
      }
      await transaction.delete(expiryKey(current));
      const currentSafeRunRef = recordSafeRunRef(current);
      if (currentSafeRunRef && currentSafeRunRef !== nextSafeRunRef) {
        await transaction.delete(safeRunRefKey(currentSafeRunRef));
      }
      await transaction.put(key, record);
      await transaction.put(expiryKey(record), record.parentRunId);
      if (nextSafeRunRef) {
        await transaction.put(safeRunRefKey(nextSafeRunRef), record.parentRunId);
      }
      return { outcome: "updated", record };
    });
  }

  async retire(parentRunId: string) {
    await this.backend.transaction(async (transaction) => {
      const key = recordKey(parentRunId);
      const raw = await transaction.get(key);
      if (raw !== undefined) {
        const expiresAt = persistedExpiration(raw);
        if (expiresAt) {
          await transaction.delete(
            expiryKey({ expiresAt, parentRunId }),
          );
        }
        try {
          const current = requireRecord(raw);
          const safeRunRef = recordSafeRunRef(current);
          if (safeRunRef) await transaction.delete(safeRunRefKey(safeRunRef));
        } catch {
          // The opaque index is harmless when orphaned: lookup requires a
          // decodable child that owns the same reference.
        }
      }
      await transaction.delete(key);
    });
  }

  async cleanupExpired(at: string, limit = 64) {
    if (!iso(at) || !Number.isSafeInteger(limit) || limit < 1 || limit > 256) {
      throw new Error("Screen 3 cleanup coordinates are invalid.");
    }
    const indexed = await this.backend.list({
      prefix: EXPIRY_PREFIX,
      limit: limit + 1,
    });
    let deleted = 0;
    for (const [key, indexedParentRunId] of indexed) {
      const parsed = expirationFromKey(key);
      if (
        parsed &&
        indexedParentRunId === parsed.parentRunId &&
        parsed.expiresAt > at
      ) {
        break;
      }
      if (deleted >= limit) break;
      const removed = await this.backend.transaction(
        async (transaction) => {
          const fallbackParentRunId =
            typeof indexedParentRunId === "string" &&
            RUN_ID.test(indexedParentRunId)
              ? indexedParentRunId
              : null;
          const parentRunId =
            parsed?.parentRunId ??
            parentRunIdFromExpirationKey(key) ??
            fallbackParentRunId;
          if (!parentRunId) {
            await transaction.delete(key);
            return false;
          }
          const recordKeyValue = recordKey(parentRunId);
          const raw = await transaction.get(recordKeyValue);
          if (raw === undefined) {
            await transaction.delete(key);
            return false;
          }
          const storedExpiresAt = persistedExpiration(raw);
          if (
            storedExpiresAt !== null &&
            (
              !parsed ||
              indexedParentRunId !== parsed.parentRunId ||
              storedExpiresAt !== parsed.expiresAt
            )
          ) {
            await transaction.delete(key);
            if (storedExpiresAt > at) {
              let currentRecord: Screen03WorkflowStoreRecord | null = null;
              try {
                currentRecord = requireRecord(raw);
              } catch {
                // Invalid future state is purged below instead of extending
                // retention from one minimally parsed field.
              }
              if (
                currentRecord?.parentRunId === parentRunId &&
                currentRecord.expiresAt === storedExpiresAt
              ) {
                await transaction.put(
                  expiryKey({ expiresAt: storedExpiresAt, parentRunId }),
                  parentRunId,
                );
                return false;
              }
            }
          }
          // The indexed child is due. Delete it without requiring the current
          // release to decode an obsolete or interrupted stored state.
          try {
            const current = requireRecord(raw);
            const safeRunRef = recordSafeRunRef(current);
            if (safeRunRef) {
              await transaction.delete(safeRunRefKey(safeRunRef));
            }
          } catch {
            // An unreadable child cannot authorize a safe-reference lookup.
          }
          await transaction.delete(recordKeyValue);
          if (storedExpiresAt !== null) {
            await transaction.delete(
              expiryKey({ expiresAt: storedExpiresAt, parentRunId }),
            );
          }
          await transaction.delete(key);
          return true;
        },
      );
      if (removed) deleted += 1;
    }
    return deleted;
  }

  async nextExpirationAt() {
    const indexed = await this.backend.list({
      prefix: EXPIRY_PREFIX,
      limit: 64,
    });
    for (const [key, indexedParentRunId] of indexed) {
      const parsed = expirationFromKey(key);
      if (!parsed || indexedParentRunId !== parsed.parentRunId) {
        return CLEANUP_RETRY_AT;
      }
      return parsed.expiresAt;
    }
    return null;
  }
}

export class DurableObjectScreen03WorkflowStore extends Screen03WorkflowStoreBackend {
  constructor(storage: DurableObjectStorage) {
    super(
      {
        get: (key) => storage.get(key),
        put: (key, value) => storage.put(key, value),
        delete: (key) => storage.delete(key).then(() => undefined),
        list: (input) => storage.list(input),
        transaction: (callback) =>
          storage.transaction((transaction) =>
            callback({
              get: (key) => transaction.get(key),
              put: (key, value) => transaction.put(key, value),
              delete: (key) => transaction.delete(key).then(() => undefined),
            }),
          ),
      },
      true,
    );
  }
}

export class InMemoryScreen03WorkflowStore extends Screen03WorkflowStoreBackend {
  constructor() {
    const values = new Map<string, unknown>();
    let tail = Promise.resolve();
    const clone = <T>(value: T): T =>
      value === undefined ? value : JSON.parse(JSON.stringify(value));
    super(
      {
        get: async (key) => clone(values.get(key)),
        put: async (key, value) => void values.set(key, clone(value)),
        delete: async (key) => void values.delete(key),
        list: async ({ prefix, limit }) =>
          new Map(
            [...values.entries()]
              .filter(([key]) => key.startsWith(prefix))
              .sort(([left], [right]) => left.localeCompare(right))
              .slice(0, limit),
          ),
        transaction: async <T>(callback: (transaction: Transaction) => Promise<T>) => {
          let release!: () => void;
          const previous = tail;
          tail = new Promise<void>((resolve) => {
            release = resolve;
          });
          await previous;
          try {
            return await callback({
              get: async (key) => clone(values.get(key)),
              put: async (key, value) => void values.set(key, clone(value)),
              delete: async (key) => void values.delete(key),
            });
          } finally {
            release();
          }
        },
      },
      false,
    );
  }
}
