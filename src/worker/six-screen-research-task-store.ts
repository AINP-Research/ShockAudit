import { fingerprintSixScreenValue } from
  "../core/six-screen/canonical";
import {
  SIX_SCREEN_RESEARCH_TASK_SCHEMA_VERSION,
} from "../core/six-screen/contracts";
import type { ResearchTask } from
  "../core/six-screen/research-task";
import type {
  SixScreenWorkflowStorage,
} from "./six-screen-workflow-store";

export const SIX_SCREEN_RESEARCH_TASK_STORE_SCHEMA_VERSION =
  "shockaudit-six-screen-research-task-store-v1" as const;
export const SIX_SCREEN_RESEARCH_TASK_MAX_REPLAYS = 96;
export const SIX_SCREEN_RESEARCH_TASK_CLEANUP_BATCH_SIZE = 32;

const RECORD_PREFIX = "six-screen-research-task-v1:";
const EXPIRY_PREFIX = "six-screen-research-task-expiry-v1:";
const RUN_ID_PATTERN = /^sa6r_[A-Za-z0-9_-]{43}$/u;
const ACCESS_TOKEN_PATTERN = /^sa6a_[A-Za-z0-9_-]{43}$/u;
const FINGERPRINT_PATTERN = /^fnv1a64:[0-9a-f]{16}$/u;

export type SixScreenResearchTaskAuthentication = {
  runId: string;
  taskId: string;
  accessToken: string;
};

export type SixScreenResearchTaskReplay = {
  operationId: string;
  operationKind: string;
  inputFingerprint: string;
  committedRevision: number;
  result: unknown;
  completedAt: string;
};

export type SixScreenResearchTaskRecord = {
  schemaVersion: typeof SIX_SCREEN_RESEARCH_TASK_STORE_SCHEMA_VERSION;
  runId: string;
  taskId: string;
  accessTokenSha256: string;
  createInputFingerprint: string;
  task: ResearchTask;
  taskFingerprint: string;
  generation: number;
  operationReplays: SixScreenResearchTaskReplay[];
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

export type SixScreenResearchTaskMutationInput =
  SixScreenResearchTaskAuthentication & {
    expectedRevision: number;
    operationId: string;
    operationKind: string;
    inputFingerprint: string;
    updatedAt: string;
  };

function recordKey(runId: string, taskId: string) {
  return `${RECORD_PREFIX}${runId}:${taskId}`;
}

function expiryKey(expiresAt: string, runId: string, taskId: string) {
  return `${EXPIRY_PREFIX}${expiresAt}:${runId}:${taskId}`;
}

function requireInstant(value: unknown, label: string) {
  if (typeof value !== "string") throw new Error(`${label} must be an ISO instant.`);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    throw new Error(`${label} must be a canonical ISO instant.`);
  }
  return value;
}

function requireCoordinate(value: string, label: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u.test(value)) {
    throw new Error(`${label} is invalid.`);
  }
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
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

function requireAuthentication(authentication: SixScreenResearchTaskAuthentication) {
  if (!RUN_ID_PATTERN.test(authentication.runId)) {
    throw new Error("Six-screen research task run id is invalid.");
  }
  requireCoordinate(authentication.taskId, "Six-screen research task id");
  if (!ACCESS_TOKEN_PATTERN.test(authentication.accessToken)) {
    throw new Error("Six-screen research task access token is invalid.");
  }
}

function requireRecord(value: unknown): SixScreenResearchTaskRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Stored six-screen research task record is invalid.");
  }
  const record = value as Partial<SixScreenResearchTaskRecord>;
  if (
    record.schemaVersion !== SIX_SCREEN_RESEARCH_TASK_STORE_SCHEMA_VERSION ||
    typeof record.runId !== "string" || !RUN_ID_PATTERN.test(record.runId) ||
    typeof record.taskId !== "string" ||
    typeof record.accessTokenSha256 !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(record.accessTokenSha256) ||
    typeof record.createInputFingerprint !== "string" ||
    !FINGERPRINT_PATTERN.test(record.createInputFingerprint) ||
    !record.task || record.task.schemaVersion !== SIX_SCREEN_RESEARCH_TASK_SCHEMA_VERSION ||
    record.task.id !== record.taskId || record.task.runId !== record.runId ||
    typeof record.taskFingerprint !== "string" ||
    record.taskFingerprint !== fingerprintSixScreenValue(record.task) ||
    !Number.isSafeInteger(record.generation) || (record.generation ?? -1) < 0 ||
    !Array.isArray(record.operationReplays)
  ) {
    throw new Error("Stored six-screen research task record is invalid.");
  }
  requireCoordinate(record.taskId, "Stored six-screen research task id");
  requireInstant(record.createdAt, "Stored research task createdAt");
  requireInstant(record.updatedAt, "Stored research task updatedAt");
  requireInstant(record.expiresAt, "Stored research task expiresAt");
  return record as SixScreenResearchTaskRecord;
}

function exactExpiryRecord(
  value: unknown,
  runId: string,
  taskId: string,
  expiresAt: string,
) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) &&
    (value as Record<string, unknown>).runId === runId &&
    (value as Record<string, unknown>).taskId === taskId &&
    (value as Record<string, unknown>).expiresAt === expiresAt);
}

export class SixScreenResearchTaskStore {
  constructor(private readonly storage: SixScreenWorkflowStorage) {}

  async create(input: {
    task: ResearchTask;
    accessToken: string;
    createInputFingerprint: string;
  }) {
    requireAuthentication({
      runId: input.task.runId,
      taskId: input.task.id,
      accessToken: input.accessToken,
    });
    if (!FINGERPRINT_PATTERN.test(input.createInputFingerprint)) {
      throw new Error("Research task create fingerprint is invalid.");
    }
    const accessTokenSha256 = await sha256(input.accessToken);
    return this.storage.transaction(async (transaction) => {
      const key = recordKey(input.task.runId, input.task.id);
      const existingValue = await transaction.get(key);
      if (existingValue !== undefined) {
        const existing = requireRecord(existingValue);
        return constantTimeEqual(existing.accessTokenSha256, accessTokenSha256) &&
            existing.createInputFingerprint === input.createInputFingerprint
          ? { outcome: "replayed" as const, record: existing }
          : { outcome: "conflict" as const };
      }
      const record: SixScreenResearchTaskRecord = {
        schemaVersion: SIX_SCREEN_RESEARCH_TASK_STORE_SCHEMA_VERSION,
        runId: input.task.runId,
        taskId: input.task.id,
        accessTokenSha256,
        createInputFingerprint: input.createInputFingerprint,
        task: structuredClone(input.task),
        taskFingerprint: fingerprintSixScreenValue(input.task),
        generation: 0,
        operationReplays: [],
        createdAt: input.task.createdAt,
        updatedAt: input.task.updatedAt,
        expiresAt: input.task.expiresAt,
      };
      await transaction.put(key, record);
      await transaction.put(
        expiryKey(record.expiresAt, record.runId, record.taskId),
        { runId: record.runId, taskId: record.taskId, expiresAt: record.expiresAt },
      );
      return { outcome: "created" as const, record };
    });
  }

  async read(authentication: SixScreenResearchTaskAuthentication) {
    requireAuthentication(authentication);
    const value = await this.storage.get(
      recordKey(authentication.runId, authentication.taskId),
    );
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
      throw new Error("Research task retirement coordinates are invalid.");
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
          throw new Error("Research task changed during retirement.");
        }
        await transaction.delete(expiryKey(
          verified.expiresAt,
          verified.runId,
          verified.taskId,
        ));
        await transaction.delete(key);
      }
    });
    return { outcome: "retired" as const, removed: records.length };
  }

  async readLatestPolicyForIdentity(input: {
    runId: string;
    accessToken: string;
    identityFingerprint: string;
  }) {
    if (!RUN_ID_PATTERN.test(input.runId) ||
        !ACCESS_TOKEN_PATTERN.test(input.accessToken) ||
        !FINGERPRINT_PATTERN.test(input.identityFingerprint)) {
      throw new Error("Policy task lookup coordinates are invalid.");
    }
    const token = await sha256(input.accessToken);
    const entries = await this.storage.list({
      prefix: `${RECORD_PREFIX}${input.runId}:`,
      limit: 64,
    });
    const candidates: SixScreenResearchTaskRecord[] = [];
    for (const value of entries.values()) {
      const record = requireRecord(value);
      if (!constantTimeEqual(record.accessTokenSha256, token)) {
        return { outcome: "unauthorized" as const };
      }
      if (
        record.task.kind === "policy" &&
        record.task.parent.identityFingerprint === input.identityFingerprint
      ) candidates.push(record);
    }
    const record = candidates.sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt))[0];
    return record
      ? { outcome: "found" as const, record }
      : { outcome: "not_found" as const };
  }

  async mutate(
    input: SixScreenResearchTaskMutationInput,
    updater: (task: ResearchTask) => { task: ResearchTask; result: unknown },
  ) {
    requireAuthentication(input);
    requireCoordinate(input.operationId, "Research task operation id");
    if (!FINGERPRINT_PATTERN.test(input.inputFingerprint)) {
      throw new Error("Research task operation fingerprint is invalid.");
    }
    requireInstant(input.updatedAt, "Research task mutation time");
    const token = await sha256(input.accessToken);
    return this.storage.transaction(async (transaction) => {
      const key = recordKey(input.runId, input.taskId);
      const value = await transaction.get(key);
      if (value === undefined) return { outcome: "not_found" as const };
      const current = requireRecord(value);
      if (!constantTimeEqual(current.accessTokenSha256, token)) {
        return { outcome: "unauthorized" as const };
      }
      const replay = current.operationReplays.find(
        ({ operationId }) => operationId === input.operationId,
      );
      if (replay) {
        if (
          replay.operationKind !== input.operationKind ||
          replay.inputFingerprint !== input.inputFingerprint
        ) {
          return { outcome: "operation_conflict" as const, record: current };
        }
        return {
          outcome: "replayed" as const,
          record: current,
          result: structuredClone(replay.result),
        };
      }
      if (current.task.revision !== input.expectedRevision) {
        return { outcome: "stale" as const, record: current };
      }
      const plan = updater(structuredClone(current.task));
      if (
        plan.task.runId !== current.runId ||
        plan.task.id !== current.taskId ||
        plan.task.revision <= current.task.revision ||
        plan.task.expiresAt !== current.expiresAt
      ) {
        throw new Error(
          "Research task mutation must advance the same retained lineage exactly once.",
        );
      }
      const replayEntry: SixScreenResearchTaskReplay = {
        operationId: input.operationId,
        operationKind: input.operationKind,
        inputFingerprint: input.inputFingerprint,
        committedRevision: plan.task.revision,
        result: structuredClone(plan.result),
        completedAt: input.updatedAt,
      };
      const record: SixScreenResearchTaskRecord = {
        ...current,
        task: structuredClone(plan.task),
        taskFingerprint: fingerprintSixScreenValue(plan.task),
        generation: current.generation + 1,
        operationReplays: [...current.operationReplays, replayEntry].slice(
          -SIX_SCREEN_RESEARCH_TASK_MAX_REPLAYS,
        ),
        updatedAt: input.updatedAt,
      };
      await transaction.put(key, record);
      return {
        outcome: "updated" as const,
        record,
        result: structuredClone(plan.result),
      };
    });
  }

  async cleanupExpired(now: string) {
    requireInstant(now, "Research task cleanup time");
    const entries = await this.storage.list({
      prefix: EXPIRY_PREFIX,
      limit: SIX_SCREEN_RESEARCH_TASK_CLEANUP_BATCH_SIZE,
    });
    let deleted = 0;
    for (const [key, marker] of entries) {
      const suffix = key.slice(EXPIRY_PREFIX.length);
      const runStart = suffix.indexOf(":sa6r_");
      if (runStart < 0) continue;
      const expiresAt = suffix.slice(0, runStart);
      const remainder = suffix.slice(runStart + 1);
      const taskSeparator = remainder.indexOf(":");
      if (taskSeparator < 0 || expiresAt > now) continue;
      const runId = remainder.slice(0, taskSeparator);
      const taskId = remainder.slice(taskSeparator + 1);
      await this.storage.transaction(async (transaction) => {
        const currentMarker = await transaction.get(key);
        if (!exactExpiryRecord(currentMarker, runId, taskId, expiresAt)) return;
        const taskKey = recordKey(runId, taskId);
        const value = await transaction.get(taskKey);
        if (value !== undefined && requireRecord(value).expiresAt <= now) {
          await transaction.delete(taskKey);
        }
        await transaction.delete(key);
        deleted += 1;
      });
    }
    return {
      deleted,
      batchLimitReached: entries.size >= SIX_SCREEN_RESEARCH_TASK_CLEANUP_BATCH_SIZE,
    };
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
