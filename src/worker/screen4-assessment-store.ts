import { fingerprintSixScreenValue } from
  "../core/six-screen/canonical";
import type { Screen4InterpretationAttempt } from
  "../core/six-screen/screen4-interpretation-queue";
import type { SixScreenWorkflowStorage } from
  "./six-screen-workflow-store";

export const SCREEN4_ASSESSMENT_STORE_SCHEMA_VERSION =
  "shockaudit-screen4-assessment-store-v1" as const;
export const SCREEN4_ASSESSMENT_MANIFEST_VERSION =
  "shockaudit-screen4-assessment-manifest-v1" as const;
export const SCREEN4_ASSESSMENT_MAX_ATTEMPTS = 12;
export const SCREEN4_ASSESSMENT_CLEANUP_BATCH_SIZE = 32;

const RECORD_PREFIX = "screen4-assessment-v1:";
const EXPIRY_PREFIX = "screen4-assessment-expiry-v1:";
const RUN_ID_PATTERN = /^sa6r_[A-Za-z0-9_-]{43}$/u;
const ACCESS_TOKEN_PATTERN = /^sa6a_[A-Za-z0-9_-]{43}$/u;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const FINGERPRINT_PATTERN = /^fnv1a64:[0-9a-f]{16}$/u;

export type Screen4AssessmentManifest = {
  schemaVersion: typeof SCREEN4_ASSESSMENT_MANIFEST_VERSION;
  runId: string;
  sourceTaskId: string;
  plannedInvestigationSnapshotId: string;
  investigationSnapshotId: string;
  investigationFingerprint: string;
  contextFingerprint: string;
  planFingerprint: string;
  presentationFingerprint: string;
  visibleEventIds: string[];
  taskFingerprint: string;
  manifestFingerprint: string;
};

export type Screen4AssessmentStoreRecord = {
  schemaVersion: typeof SCREEN4_ASSESSMENT_STORE_SCHEMA_VERSION;
  runId: string;
  taskFingerprint: string;
  accessTokenSha256: string;
  manifest: Screen4AssessmentManifest;
  attempts: Screen4InterpretationAttempt[];
  generation: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

export type Screen4AssessmentAuthentication = {
  runId: string;
  taskFingerprint: string;
  accessToken: string;
};

function recordKey(runId: string, taskFingerprint: string) {
  return `${RECORD_PREFIX}${runId}:${taskFingerprint}`;
}

function expiryKey(expiresAt: string, runId: string,
  taskFingerprint: string) {
  return `${EXPIRY_PREFIX}${expiresAt}:${runId}:${taskFingerprint}`;
}

function requireInstant(value: unknown, label: string) {
  if (typeof value !== "string") throw new Error(`${label} must be an ISO instant.`);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) ||
      new Date(milliseconds).toISOString() !== value) {
    throw new Error(`${label} must be a canonical ISO instant.`);
  }
  return value;
}

function requireCoordinate(value: unknown, label: string) {
  if (typeof value !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u.test(value)) {
    throw new Error(`${label} is invalid.`);
  }
  return value;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (value) =>
    value.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  ));
  return `sha256:${bytesToHex(digest)}`;
}

function constantTimeEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  let different = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    different |= (leftBytes[index % leftBytes.length] ?? 0) ^
      (rightBytes[index % rightBytes.length] ?? 0);
  }
  return different === 0;
}

function requireAuthentication(input: Screen4AssessmentAuthentication) {
  if (!RUN_ID_PATTERN.test(input.runId) ||
      !FINGERPRINT_PATTERN.test(input.taskFingerprint) ||
      !ACCESS_TOKEN_PATTERN.test(input.accessToken)) {
    throw new Error("Screen 4 assessment authentication is invalid.");
  }
}

export function createScreen4AssessmentManifest(input: Omit<
  Screen4AssessmentManifest,
  "schemaVersion" | "manifestFingerprint"
>): Screen4AssessmentManifest {
  if (!RUN_ID_PATTERN.test(input.runId) ||
      !FINGERPRINT_PATTERN.test(input.taskFingerprint) ||
      !FINGERPRINT_PATTERN.test(input.investigationFingerprint) ||
      !FINGERPRINT_PATTERN.test(input.contextFingerprint) ||
      !FINGERPRINT_PATTERN.test(input.planFingerprint) ||
      !FINGERPRINT_PATTERN.test(input.presentationFingerprint) ||
      input.visibleEventIds.length < 1 || input.visibleEventIds.length > 10 ||
      new Set(input.visibleEventIds).size !== input.visibleEventIds.length) {
    throw new Error("Screen 4 assessment manifest input is invalid.");
  }
  requireCoordinate(input.sourceTaskId, "Screen 4 source task id");
  requireCoordinate(input.plannedInvestigationSnapshotId,
    "Screen 4 planned investigation id");
  requireCoordinate(input.investigationSnapshotId,
    "Screen 4 completed investigation id");
  for (const eventId of input.visibleEventIds) {
    requireCoordinate(eventId, "Screen 4 visible event id");
  }
  const body = {
    schemaVersion: SCREEN4_ASSESSMENT_MANIFEST_VERSION,
    ...structuredClone(input),
  };
  return {
    ...body,
    manifestFingerprint: fingerprintSixScreenValue(body),
  };
}

function requireManifest(value: unknown): Screen4AssessmentManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Stored Screen 4 assessment manifest is invalid.");
  }
  const manifest = value as Screen4AssessmentManifest;
  const { manifestFingerprint, ...body } = manifest;
  if (manifest.schemaVersion !== SCREEN4_ASSESSMENT_MANIFEST_VERSION ||
      !FINGERPRINT_PATTERN.test(manifestFingerprint) ||
      manifestFingerprint !== fingerprintSixScreenValue(body)) {
    throw new Error("Stored Screen 4 assessment manifest is invalid.");
  }
  const rebuilt = createScreen4AssessmentManifest({
    runId: manifest.runId,
    sourceTaskId: manifest.sourceTaskId,
    plannedInvestigationSnapshotId:
      manifest.plannedInvestigationSnapshotId,
    investigationSnapshotId: manifest.investigationSnapshotId,
    investigationFingerprint: manifest.investigationFingerprint,
    contextFingerprint: manifest.contextFingerprint,
    planFingerprint: manifest.planFingerprint,
    presentationFingerprint: manifest.presentationFingerprint,
    visibleEventIds: manifest.visibleEventIds,
    taskFingerprint: manifest.taskFingerprint,
  });
  if (rebuilt.manifestFingerprint !== manifestFingerprint) {
    throw new Error("Stored Screen 4 assessment manifest changed.");
  }
  return manifest;
}

function requireRecord(value: unknown): Screen4AssessmentStoreRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Stored Screen 4 assessment record is invalid.");
  }
  const record = value as Screen4AssessmentStoreRecord;
  const manifest = requireManifest(record.manifest);
  if (record.schemaVersion !== SCREEN4_ASSESSMENT_STORE_SCHEMA_VERSION ||
      record.runId !== manifest.runId ||
      record.taskFingerprint !== manifest.taskFingerprint ||
      !SHA256_PATTERN.test(record.accessTokenSha256) ||
      !Array.isArray(record.attempts) ||
      record.attempts.length > SCREEN4_ASSESSMENT_MAX_ATTEMPTS ||
      new Set(record.attempts.map(({ id }) => id)).size !==
        record.attempts.length ||
      !Number.isSafeInteger(record.generation) || record.generation < 0) {
    throw new Error("Stored Screen 4 assessment record is invalid.");
  }
  requireInstant(record.createdAt, "Screen 4 assessment createdAt");
  requireInstant(record.updatedAt, "Screen 4 assessment updatedAt");
  requireInstant(record.expiresAt, "Screen 4 assessment expiresAt");
  return record;
}

function exactExpiryRecord(value: unknown, runId: string,
  taskFingerprint: string, expiresAt: string) {
  return Boolean(value && typeof value === "object" &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>).runId === runId &&
    (value as Record<string, unknown>).taskFingerprint === taskFingerprint &&
    (value as Record<string, unknown>).expiresAt === expiresAt);
}

/**
 * Small Screen 4 model artifacts live beside, not inside, the monolithic
 * workflow record. The source-task aggregate remains authoritative and is
 * never copied into this store.
 */
export class Screen4AssessmentStore {
  constructor(private readonly storage: SixScreenWorkflowStorage) {}

  async create(input: {
    manifest: Screen4AssessmentManifest;
    accessToken: string;
    createdAt: string;
    expiresAt: string;
  }) {
    requireAuthentication({
      runId: input.manifest.runId,
      taskFingerprint: input.manifest.taskFingerprint,
      accessToken: input.accessToken,
    });
    requireManifest(input.manifest);
    requireInstant(input.createdAt, "Screen 4 assessment createdAt");
    requireInstant(input.expiresAt, "Screen 4 assessment expiresAt");
    const accessTokenSha256 = await sha256(input.accessToken);
    return this.storage.transaction(async (transaction) => {
      const key = recordKey(input.manifest.runId,
        input.manifest.taskFingerprint);
      const existingValue = await transaction.get(key);
      if (existingValue !== undefined) {
        const existing = requireRecord(existingValue);
        return constantTimeEqual(existing.accessTokenSha256,
          accessTokenSha256) &&
            existing.manifest.manifestFingerprint ===
              input.manifest.manifestFingerprint
          ? { outcome: "replayed" as const, record: existing }
          : { outcome: "conflict" as const };
      }
      const record: Screen4AssessmentStoreRecord = {
        schemaVersion: SCREEN4_ASSESSMENT_STORE_SCHEMA_VERSION,
        runId: input.manifest.runId,
        taskFingerprint: input.manifest.taskFingerprint,
        accessTokenSha256,
        manifest: structuredClone(input.manifest),
        attempts: [],
        generation: 0,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
        expiresAt: input.expiresAt,
      };
      await transaction.put(key, record);
      await transaction.put(expiryKey(record.expiresAt, record.runId,
        record.taskFingerprint), {
        runId: record.runId,
        taskFingerprint: record.taskFingerprint,
        expiresAt: record.expiresAt,
      });
      return { outcome: "created" as const, record };
    });
  }

  async read(authentication: Screen4AssessmentAuthentication) {
    requireAuthentication(authentication);
    const value = await this.storage.get(recordKey(
      authentication.runId,
      authentication.taskFingerprint,
    ));
    if (value === undefined) return { outcome: "not_found" as const };
    const record = requireRecord(value);
    const token = await sha256(authentication.accessToken);
    return constantTimeEqual(record.accessTokenSha256, token)
      ? { outcome: "found" as const, record }
      : { outcome: "unauthorized" as const };
  }

  async retireRun(input: { runId: string; accessToken: string }, limit = 64) {
    if (!RUN_ID_PATTERN.test(input.runId) ||
        !ACCESS_TOKEN_PATTERN.test(input.accessToken) ||
        !Number.isInteger(limit) || limit < 1 || limit > 64) {
      throw new Error("Screen 4 retirement coordinates are invalid.");
    }
    const entries = await this.storage.list({
      prefix: `${RECORD_PREFIX}${input.runId}:`,
      limit: limit + 1,
    });
    if (entries.size > limit) {
      return { outcome: "capacity" as const, removed: 0 };
    }
    const token = await sha256(input.accessToken);
    const records = [...entries.entries()].map(([key, value]) => ({
      key,
      record: requireRecord(value),
    }));
    if (records.some(({ record }) =>
      record.runId !== input.runId ||
      !constantTimeEqual(record.accessTokenSha256, token)
    )) return { outcome: "unauthorized" as const, removed: 0 };
    await this.storage.transaction(async (transaction) => {
      for (const { key, record } of records) {
        const current = await transaction.get(key);
        if (current === undefined) continue;
        const verified = requireRecord(current);
        if (verified.runId !== input.runId ||
            !constantTimeEqual(verified.accessTokenSha256, token)) {
          throw new Error("Screen 4 assessment changed during retirement.");
        }
        await transaction.delete(expiryKey(
          verified.expiresAt,
          verified.runId,
          verified.taskFingerprint,
        ));
        await transaction.delete(key);
      }
    });
    return { outcome: "retired" as const, removed: records.length };
  }

  async mutate(input: Screen4AssessmentAuthentication & {
    expectedGeneration: number;
    updatedAt: string;
  }, updater: (record: Screen4AssessmentStoreRecord) =>
    Screen4AssessmentStoreRecord) {
    requireAuthentication(input);
    requireInstant(input.updatedAt, "Screen 4 assessment mutation time");
    const token = await sha256(input.accessToken);
    return this.storage.transaction(async (transaction) => {
      const key = recordKey(input.runId, input.taskFingerprint);
      const value = await transaction.get(key);
      if (value === undefined) return { outcome: "not_found" as const };
      const current = requireRecord(value);
      if (!constantTimeEqual(current.accessTokenSha256, token)) {
        return { outcome: "unauthorized" as const };
      }
      if (current.generation !== input.expectedGeneration) {
        return { outcome: "stale" as const, record: current };
      }
      const next = updater(structuredClone(current));
      next.generation = current.generation + 1;
      next.updatedAt = input.updatedAt;
      if (next.runId !== current.runId ||
          next.taskFingerprint !== current.taskFingerprint ||
          next.accessTokenSha256 !== current.accessTokenSha256 ||
          next.expiresAt !== current.expiresAt ||
          next.manifest.manifestFingerprint !==
            current.manifest.manifestFingerprint) {
        throw new Error("Screen 4 assessment mutation changed its frozen manifest.");
      }
      const valid = requireRecord(next);
      await transaction.put(key, valid);
      return { outcome: "updated" as const, record: valid };
    });
  }

  async cleanupExpired(now: string) {
    requireInstant(now, "Screen 4 assessment cleanup time");
    const entries = await this.storage.list({
      prefix: EXPIRY_PREFIX,
      limit: SCREEN4_ASSESSMENT_CLEANUP_BATCH_SIZE,
    });
    let deleted = 0;
    for (const [key, marker] of entries) {
      const suffix = key.slice(EXPIRY_PREFIX.length);
      const runStart = suffix.indexOf(":sa6r_");
      if (runStart < 0) continue;
      const expiresAt = suffix.slice(0, runStart);
      const remainder = suffix.slice(runStart + 1);
      const separator = remainder.indexOf(":fnv1a64:");
      if (separator < 0 || expiresAt > now) continue;
      const runId = remainder.slice(0, separator);
      const taskFingerprint = remainder.slice(separator + 1);
      await this.storage.transaction(async (transaction) => {
        const currentMarker = await transaction.get(key);
        if (!exactExpiryRecord(currentMarker, runId, taskFingerprint,
          expiresAt)) return;
        const assessmentKey = recordKey(runId, taskFingerprint);
        const value = await transaction.get(assessmentKey);
        if (value !== undefined &&
            requireRecord(value).expiresAt <= now) {
          await transaction.delete(assessmentKey);
        }
        await transaction.delete(key);
        deleted += 1;
      });
    }
    return { deleted,
      batchLimitReached:
        entries.size >= SCREEN4_ASSESSMENT_CLEANUP_BATCH_SIZE };
  }

  async nextExpirationAt() {
    const entries = await this.storage.list({ prefix: EXPIRY_PREFIX, limit: 1 });
    const first = entries.keys().next().value as string | undefined;
    if (!first) return null;
    const suffix = first.slice(EXPIRY_PREFIX.length);
    const separator = suffix.indexOf(":sa6r_");
    return separator < 0 ? null : suffix.slice(0, separator);
  }
}
