import { describe, expect, it } from "vitest";

import { replaceScreen02FindCriteria } from "../../src/core/screen02-find-workflow";
import { encodeScreen02FindWorkflowStateEnvelope } from "../../src/core/screen02-workflow-envelope";
import {
  createScreen02FindState,
  fingerprintScreen02WorkflowState,
} from "../../src/core/screen02-workflow-state";
import type { Screen02FindState } from "../../src/core/screen02-workflow-types";
import {
  DurableObjectScreen02WorkflowStore,
  InMemoryScreen02WorkflowStore,
  SCREEN_02_WORKFLOW_STORE_ABSOLUTE_RETENTION_MS,
  SCREEN_02_WORKFLOW_STORE_CONTINUED_RETENTION_MS,
  SCREEN_02_WORKFLOW_STORE_IDLE_RETENTION_MS,
  SCREEN_02_WORKFLOW_STORE_MAX_BUFFERED_RECEIPTS,
  SCREEN_02_WORKFLOW_STORE_MAX_REPLAY_RESULT_CHARACTERS,
  SCREEN_02_WORKFLOW_STORE_RECORD_SCHEMA_VERSION,
  SCREEN_02_WORKFLOW_STORE_RUN_IDENTITY_ASSUMPTION,
  Screen02WorkflowStoreValidationError,
  createScreen02WorkflowStoreIdentity,
  screen02WorkflowRetentionExpiresAt,
  type Screen02WorkflowBufferedReceipt,
  type Screen02WorkflowStoreCoordinates,
  type Screen02WorkflowStoreRecord,
} from "../../src/worker/screen02-workflow-store";
import { confirmedWorkflowFindContext } from "../core/screen02-workflow-fixtures";

const openedAt = "2026-08-10T18:00:00.000Z";

function coordinates(
  record: Screen02WorkflowStoreRecord,
): Screen02WorkflowStoreCoordinates {
  return {
    generation: record.generation,
    revision: record.stateRevision,
    stateFingerprint: record.stateFingerprint,
  };
}

function openFindRun() {
  const identity = createScreen02WorkflowStoreIdentity();
  const state = createScreen02FindState(
    confirmedWorkflowFindContext(),
    identity.runId,
    openedAt,
  );
  return {
    ...identity,
    state,
    envelope: encodeScreen02FindWorkflowStateEnvelope(state),
  };
}

function successor(
  state: Screen02FindState,
  criterionId: string,
  at: string,
) {
  return replaceScreen02FindCriteria(
    state,
    [
      {
        criterionId,
        kind: "only-include",
        text: `Only include criterion ${criterionId}.`,
        exactRequest: `Only include events matching ${criterionId}.`,
        source: "researcher",
      },
    ],
    {
      at,
      reason: `Add ${criterionId}.`,
    },
  );
}

function findReceipt(
  index: number,
  receivedAt = "2026-08-10T18:01:00.000Z",
): Screen02WorkflowBufferedReceipt {
  return {
    receiptId: `receipt-${index}`,
    requestId: `request-${index}`,
    assessmentMode: "find-candidate",
    receiptToken: `sa2f-receipt-v1.e30.${index
      .toString(36)
      .padStart(43, "A")}`,
    receivedAt,
  };
}

function durableStorageHarness() {
  const records = new Map<string, unknown>();
  let transactionCalls = 0;
  const clone = <T>(value: T) => structuredClone(value);
  const storage = {
    get: async (key: string) =>
      records.has(key) ? clone(records.get(key)) : undefined,
    list: async ({
      prefix = "",
      limit = Number.POSITIVE_INFINITY,
    }: {
      prefix?: string;
      limit?: number;
    }) =>
      new Map(
        [...records.entries()]
          .filter(([key]) => key.startsWith(prefix))
          .sort(([left], [right]) => left.localeCompare(right))
          .slice(0, limit)
          .map(([key, value]) => [key, clone(value)]),
      ),
    transaction: async <T>(
      callback: (transaction: DurableObjectTransaction) => Promise<T>,
    ) => {
      transactionCalls += 1;
      const writes = new Map<string, unknown>();
      const deletions = new Set<string>();
      const transaction = {
        get: async (key: string) => {
          const value = deletions.has(key)
            ? undefined
            : writes.has(key)
              ? writes.get(key)
              : records.get(key);
          return value === undefined ? undefined : clone(value);
        },
        put: async (key: string, value: unknown) => {
          deletions.delete(key);
          writes.set(key, clone(value));
        },
        delete: async (key: string) => {
          writes.delete(key);
          deletions.add(key);
        },
      } as unknown as DurableObjectTransaction;
      const result = await callback(transaction);
      for (const key of deletions) records.delete(key);
      for (const [key, value] of writes) records.set(key, value);
      return result;
    },
  } as unknown as DurableObjectStorage;
  return {
    storage,
    records,
    transactionCalls: () => transactionCalls,
  };
}

describe("canonical Screen 2 workflow persistence", () => {
  it("writes an explicit pending child cascade atomically with a successful parent update", async () => {
    const store = new InMemoryScreen02WorkflowStore();
    const run = openFindRun();
    const created = await store.create({
      runId: run.runId,
      accessToken: run.accessToken,
      stateEnvelope: run.envelope,
    });
    if (created.outcome !== "created") throw new Error("Run was not created.");
    const at = "2026-08-10T18:01:00.000Z";
    const next = successor(run.state, "child-cascade", at);
    const mutationCascade = {
      kind: "screen03-stale-after-host-review" as const,
      originatingTaskId: "host-task:applied-screen02-review",
    };
    const updated = await store.updateTrusted({
      runId: run.runId,
      expected: coordinates(created.record),
      operationId: "mark-child-cascade",
      operationKind: "test-parent-update",
      mutate: () => ({
        stateEnvelope: encodeScreen02FindWorkflowStateEnvelope(next),
        bufferedReceipts: [],
        updatedAt: at,
        replayResult: { updated: true },
        markPendingChildCascade: mutationCascade,
      }),
    });
    expect(updated.outcome).toBe("updated");
    await expect(store.listPendingChildCascades()).resolves.toEqual({
      runIds: [run.runId],
      batchLimitReached: false,
    });
    const pending = await store.readPendingChildCascade(run.runId);
    expect(pending).toEqual({
      outcome: "found",
      cascade: {
        ...mutationCascade,
        runId: run.runId,
      },
    });

    if (pending.outcome !== "found") throw new Error("Marker was not stored.");
    await store.acknowledgePendingChildCascade(run.runId, pending.cascade);
    let staleMutationCalled = false;
    const conflicted = await store.updateTrusted({
      runId: run.runId,
      expected: coordinates(created.record),
      operationId: "conflicted-child-cascade",
      operationKind: "test-parent-update",
      mutate: () => {
        staleMutationCalled = true;
        return {
          stateEnvelope: encodeScreen02FindWorkflowStateEnvelope(next),
          bufferedReceipts: [],
          updatedAt: at,
          replayResult: { updated: false },
          markPendingChildCascade: mutationCascade,
        };
      },
    });
    expect(conflicted.outcome).toBe("conflict");
    expect(staleMutationCalled).toBe(false);
    await expect(store.listPendingChildCascades()).resolves.toEqual({
      runIds: [],
      batchLimitReached: false,
    });
  });

  it("applies idle, continued, and absolute retention against a fake clock", async () => {
    const store = new InMemoryScreen02WorkflowStore();
    const run = openFindRun();
    const created = await store.create({
      runId: run.runId,
      accessToken: run.accessToken,
      stateEnvelope: run.envelope,
    });
    if (created.outcome !== "created") throw new Error("Run was not created.");

    const idleExpiration = new Date(
      Date.parse(openedAt) + SCREEN_02_WORKFLOW_STORE_IDLE_RETENTION_MS,
    ).toISOString();
    expect(created.record.expiresAt).toBe(idleExpiration);
    await expect(store.nextExpirationAt()).resolves.toBe(idleExpiration);

    const firstUpdateAt = new Date(
      Date.parse(openedAt) + 23 * 60 * 60 * 1_000,
    ).toISOString();
    const firstState = successor(run.state, "idle-extension", firstUpdateAt);
    const firstUpdate = await store.update({
      runId: run.runId,
      accessToken: run.accessToken,
      expected: coordinates(created.record),
      operationId: "extend-idle-retention",
      operationKind: "replace-criteria",
      mutate: () => ({
        stateEnvelope: encodeScreen02FindWorkflowStateEnvelope(firstState),
        bufferedReceipts: [],
        updatedAt: firstUpdateAt,
        replayResult: null,
      }),
    });
    if (firstUpdate.outcome !== "updated") {
      throw new Error("Idle-retention update did not commit.");
    }
    expect(firstUpdate.record.expiresAt).toBe(
      new Date(
        Date.parse(firstUpdateAt) + SCREEN_02_WORKFLOW_STORE_IDLE_RETENTION_MS,
      ).toISOString(),
    );

    const nearAbsoluteAt = new Date(
      Date.parse(openedAt) +
        SCREEN_02_WORKFLOW_STORE_ABSOLUTE_RETENTION_MS -
        60 * 60 * 1_000,
    ).toISOString();
    const nearAbsoluteState = successor(
      firstState,
      "absolute-clamp",
      nearAbsoluteAt,
    );
    const nearAbsoluteUpdate = await store.update({
      runId: run.runId,
      accessToken: run.accessToken,
      expected: coordinates(firstUpdate.record),
      operationId: "clamp-absolute-retention",
      operationKind: "replace-criteria",
      mutate: () => ({
        stateEnvelope:
          encodeScreen02FindWorkflowStateEnvelope(nearAbsoluteState),
        bufferedReceipts: [],
        updatedAt: nearAbsoluteAt,
        replayResult: null,
      }),
    });
    if (nearAbsoluteUpdate.outcome !== "updated") {
      throw new Error("Absolute-retention update did not commit.");
    }
    expect(nearAbsoluteUpdate.record.expiresAt).toBe(
      new Date(
        Date.parse(openedAt) +
          SCREEN_02_WORKFLOW_STORE_ABSOLUTE_RETENTION_MS,
      ).toISOString(),
    );

    const continuedState = structuredClone(run.state);
    continuedState.decision.continuedRevision = continuedState.revision;
    expect(
      screen02WorkflowRetentionExpiresAt({
        state: continuedState,
        createdAt: openedAt,
        updatedAt: firstUpdateAt,
      }),
    ).toBe(
      new Date(
        Date.parse(firstUpdateAt) +
          SCREEN_02_WORKFLOW_STORE_CONTINUED_RETENTION_MS,
      ).toISOString(),
    );
  });

  it("keeps a run until the exact expiry boundary, then removes record and index", async () => {
    const store = new InMemoryScreen02WorkflowStore();
    const run = openFindRun();
    const created = await store.create({
      runId: run.runId,
      accessToken: run.accessToken,
      stateEnvelope: run.envelope,
    });
    if (created.outcome !== "created") throw new Error("Run was not created.");
    const expiresAtMs = Date.parse(created.record.expiresAt);

    await expect(
      store.cleanupExpired(new Date(expiresAtMs - 1).toISOString()),
    ).resolves.toEqual({
      deletedRunIds: [],
      nextExpirationAt: created.record.expiresAt,
      batchLimitReached: false,
    });
    await expect(
      store.read({ runId: run.runId, accessToken: run.accessToken }),
    ).resolves.toMatchObject({ outcome: "authenticated" });

    await expect(
      store.cleanupExpired(created.record.expiresAt),
    ).resolves.toEqual({
      deletedRunIds: [run.runId],
      nextExpirationAt: null,
      batchLimitReached: false,
    });
    await expect(
      store.read({ runId: run.runId, accessToken: run.accessToken }),
    ).resolves.toEqual({ outcome: "not-found" });
    await expect(store.nextExpirationAt()).resolves.toBeNull();
    await expect(
      store.cleanupExpired(created.record.expiresAt),
    ).resolves.toEqual({
      deletedRunIds: [],
      nextExpirationAt: null,
      batchLimitReached: false,
    });
  });

  it("retires only the possessed run at exact coordinates and deletes its expiry index", async () => {
    const store = new InMemoryScreen02WorkflowStore();
    const run = openFindRun();
    const created = await store.create({
      runId: run.runId,
      accessToken: run.accessToken,
      stateEnvelope: run.envelope,
    });
    if (created.outcome !== "created") throw new Error("Run was not created.");

    const otherToken = createScreen02WorkflowStoreIdentity().accessToken;
    await expect(
      store.retire({
        runId: run.runId,
        accessToken: otherToken,
        expected: coordinates(created.record),
      }),
    ).resolves.toEqual({ outcome: "unauthorized" });

    const nextState = successor(
      run.state,
      "retirement-race",
      "2026-08-10T18:01:00.000Z",
    );
    const updated = await store.update({
      runId: run.runId,
      accessToken: run.accessToken,
      expected: coordinates(created.record),
      operationId: "retirement-race-winner",
      operationKind: "replace-criteria",
      mutate: () => ({
        stateEnvelope: encodeScreen02FindWorkflowStateEnvelope(nextState),
        bufferedReceipts: [],
        updatedAt: nextState.updatedAt,
        replayResult: null,
      }),
    });
    if (updated.outcome !== "updated") {
      throw new Error("Retirement race setup did not commit.");
    }

    await expect(
      store.retire({
        runId: run.runId,
        accessToken: run.accessToken,
        expected: coordinates(created.record),
      }),
    ).resolves.toMatchObject({
      outcome: "conflict",
      current: coordinates(updated.record),
    });
    await expect(
      store.retire({
        runId: run.runId,
        accessToken: run.accessToken,
        expected: coordinates(updated.record),
      }),
    ).resolves.toEqual({ outcome: "retired", runId: run.runId });
    await expect(store.readTrusted({ runId: run.runId })).resolves.toEqual({
      outcome: "not-found",
    });
    await expect(store.nextExpirationAt()).resolves.toBeNull();
  });

  it("stores only the access-token digest and supports bounded trusted reads", async () => {
    const store = new InMemoryScreen02WorkflowStore();
    const run = openFindRun();

    await expect(
      store.create({
        runId: run.runId,
        accessToken: run.accessToken,
        stateEnvelope: run.envelope,
        bufferedReceipts: [
          {
            receiptId: "token-smuggling-receipt",
            requestId: "token-smuggling-request",
            assessmentMode: "find-candidate",
            receiptToken: `sa2f-receipt-v1.${run.accessToken}.${"A".repeat(43)}`,
            receivedAt: openedAt,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(Screen02WorkflowStoreValidationError);

    const created = await store.create({
      runId: run.runId,
      accessToken: run.accessToken,
      stateEnvelope: run.envelope,
    });

    expect(created.outcome).toBe("created");
    if (created.outcome !== "created") throw new Error("Run was not created.");
    expect(created.record).toMatchObject({
      schemaVersion: SCREEN_02_WORKFLOW_STORE_RECORD_SCHEMA_VERSION,
      runIdentityAssumption:
        SCREEN_02_WORKFLOW_STORE_RUN_IDENTITY_ASSUMPTION,
      runId: run.runId,
      mode: "find",
      generation: 0,
      stateRevision: 0,
      stateFingerprint: fingerprintScreen02WorkflowState(run.state),
    });
    expect(created.record.accessTokenSha256).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(JSON.stringify(created.record)).not.toContain(run.accessToken);

    await expect(
      store.update({
        runId: run.runId,
        accessToken: run.accessToken,
        expected: coordinates(created.record),
        operationId: "raw-token-replay-result",
        operationKind: "test",
        mutate: () => ({
          stateEnvelope: run.envelope,
          bufferedReceipts: [],
          updatedAt: "2026-08-10T18:00:01.000Z",
          replayResult: { accidentallyPersisted: run.accessToken },
        }),
      }),
    ).rejects.toBeInstanceOf(Screen02WorkflowStoreValidationError);

    const trusted = await store.readTrusted({ runId: run.runId });
    expect(trusted).toMatchObject({
      outcome: "found",
      record: { generation: 0 },
    });
    const missing = createScreen02WorkflowStoreIdentity();
    await expect(store.readTrusted({ runId: missing.runId })).resolves.toEqual({
      outcome: "not-found",
    });
  });

  it("adds bounded hash-only continuation aliases without replacing the primary token", async () => {
    const store = new InMemoryScreen02WorkflowStore();
    const run = openFindRun();
    const created = await store.create({
      runId: run.runId,
      accessToken: run.accessToken,
      stateEnvelope: run.envelope,
    });
    if (created.outcome !== "created") throw new Error("Run was not created.");
    expect(created.record.continuationAccessTokenSha256s).toEqual([]);

    const continuationTokens = Array.from(
      { length: 5 },
      () => createScreen02WorkflowStoreIdentity().accessToken,
    );
    const first = await store.addContinuationAccessTokenTrusted({
      runId: run.runId,
      accessToken: continuationTokens[0]!,
      expected: coordinates(created.record),
      expectedExpiresAt: created.record.expiresAt,
    });
    expect(first).toMatchObject({
      outcome: "added",
      record: {
        generation: created.record.generation,
        stateFingerprint: created.record.stateFingerprint,
        continuationAccessTokenSha256s: [expect.stringMatching(/^sha256:/)],
      },
    });
    expect(JSON.stringify(first)).not.toContain(continuationTokens[0]);
    await expect(
      store.read({ runId: run.runId, accessToken: run.accessToken }),
    ).resolves.toMatchObject({ outcome: "authenticated" });
    await expect(
      store.read({ runId: run.runId, accessToken: continuationTokens[0]! }),
    ).resolves.toMatchObject({ outcome: "authenticated" });

    await expect(
      store.addContinuationAccessTokenTrusted({
        runId: run.runId,
        accessToken: continuationTokens[0]!,
        expected: coordinates(created.record),
        expectedExpiresAt: created.record.expiresAt,
      }),
    ).resolves.toMatchObject({ outcome: "existing" });
    await expect(
      store.addContinuationAccessTokenTrusted({
        runId: run.runId,
        accessToken: continuationTokens[1]!,
        expected: {
          ...coordinates(created.record),
          generation: created.record.generation + 1,
        },
        expectedExpiresAt: created.record.expiresAt,
      }),
    ).resolves.toMatchObject({ outcome: "conflict" });

    for (const accessToken of continuationTokens.slice(1)) {
      const added = await store.addContinuationAccessTokenTrusted({
        runId: run.runId,
        accessToken,
        expected: coordinates(created.record),
        expectedExpiresAt: created.record.expiresAt,
      });
      expect(added.outcome).toBe("added");
    }
    const trusted = await store.readTrusted({ runId: run.runId });
    if (trusted.outcome !== "found") throw new Error("Run disappeared.");
    expect(trusted.record.continuationAccessTokenSha256s).toHaveLength(4);
    await expect(
      store.read({ runId: run.runId, accessToken: continuationTokens[0]! }),
    ).resolves.toEqual({ outcome: "unauthorized" });
    await expect(
      store.read({ runId: run.runId, accessToken: continuationTokens[4]! }),
    ).resolves.toMatchObject({ outcome: "authenticated" });
  });

  it("serializes authenticated and trusted concurrent successors so only one wins", async () => {
    const store = new InMemoryScreen02WorkflowStore();
    const run = openFindRun();
    const created = await store.create({
      runId: run.runId,
      accessToken: run.accessToken,
      stateEnvelope: run.envelope,
    });
    if (created.outcome !== "created") throw new Error("Run was not created.");
    const expected = coordinates(created.record);
    const first = successor(
      run.state,
      "government-imposed",
      "2026-08-10T18:01:00.000Z",
    );
    const second = successor(
      run.state,
      "population-matched",
      "2026-08-10T18:01:01.000Z",
    );

    const results = await Promise.all([
      store.update({
        runId: run.runId,
        accessToken: run.accessToken,
        expected,
        operationId: "authenticated-successor",
        operationKind: "replace-criteria",
        mutate: () => ({
          stateEnvelope: encodeScreen02FindWorkflowStateEnvelope(first),
          bufferedReceipts: [],
          updatedAt: first.updatedAt,
          replayResult: { winner: "authenticated" },
        }),
      }),
      store.updateTrusted({
        runId: run.runId,
        expected,
        operationId: "trusted-successor",
        operationKind: "replace-criteria",
        mutate: () => ({
          stateEnvelope: encodeScreen02FindWorkflowStateEnvelope(second),
          bufferedReceipts: [],
          updatedAt: second.updatedAt,
          replayResult: { winner: "trusted" },
        }),
      }),
    ]);

    expect(results.map((result) => result.outcome).sort()).toEqual([
      "conflict",
      "updated",
    ]);
    const winner = results.find((result) => result.outcome === "updated");
    if (!winner || winner.outcome !== "updated") {
      throw new Error("No concurrent update won.");
    }
    const read = await store.read({
      runId: run.runId,
      accessToken: run.accessToken,
    });
    expect(read).toMatchObject({
      outcome: "authenticated",
      record: {
        generation: 1,
        stateRevision: 1,
        stateFingerprint: winner.record.stateFingerprint,
      },
    });
  });

  it("replays a committed operation before stale-CAS evaluation and never reruns mutate", async () => {
    const store = new InMemoryScreen02WorkflowStore();
    const run = openFindRun();
    const created = await store.create({
      runId: run.runId,
      accessToken: run.accessToken,
      stateEnvelope: run.envelope,
    });
    if (created.outcome !== "created") throw new Error("Run was not created.");
    const expected = coordinates(created.record);

    await expect(
      store.updateTrusted({
        runId: run.runId,
        expected,
        operationId: "oversized-result",
        operationKind: "receipt-buffer",
        mutate: () => ({
          stateEnvelope: run.envelope,
          bufferedReceipts: [],
          updatedAt: "2026-08-10T18:00:01.000Z",
          replayResult: "x".repeat(
            SCREEN_02_WORKFLOW_STORE_MAX_REPLAY_RESULT_CHARACTERS + 1,
          ),
        }),
      }),
    ).rejects.toBeInstanceOf(Screen02WorkflowStoreValidationError);

    let mutateCalls = 0;
    const input = {
      runId: run.runId,
      expected,
      operationId: "receipt-buffer-1",
      operationKind: "receipt-buffer",
      mutate: () => {
        mutateCalls += 1;
        return {
          stateEnvelope: run.envelope,
          bufferedReceipts: [findReceipt(1)],
          updatedAt: "2026-08-10T18:01:00.000Z",
          replayResult: { acceptedReceiptId: "receipt-1" },
        };
      },
    };
    const updated = await store.updateTrusted(input);
    const replayed = await store.updateTrusted(input);

    expect(updated).toMatchObject({
      outcome: "updated",
      record: { generation: 1, stateRevision: 0 },
      replayResult: { acceptedReceiptId: "receipt-1" },
    });
    expect(replayed).toMatchObject({
      outcome: "replayed",
      record: { generation: 1 },
      replayResult: { acceptedReceiptId: "receipt-1" },
    });
    expect(mutateCalls).toBe(1);

    const kindCollision = await store.updateTrusted({
      ...input,
      operationKind: "different-kind",
      mutate: () => {
        throw new Error("A replay collision must not invoke mutate.");
      },
    });
    expect(kindCollision).toMatchObject({
      outcome: "conflict",
      current: { generation: 1 },
    });
  });

  it("rejects a token from another run before mutation", async () => {
    const store = new InMemoryScreen02WorkflowStore();
    const first = openFindRun();
    const second = openFindRun();
    const firstCreated = await store.create({
      runId: first.runId,
      accessToken: first.accessToken,
      stateEnvelope: first.envelope,
    });
    await store.create({
      runId: second.runId,
      accessToken: second.accessToken,
      stateEnvelope: second.envelope,
    });
    if (firstCreated.outcome !== "created") {
      throw new Error("First run was not created.");
    }

    await expect(
      store.read({ runId: first.runId, accessToken: second.accessToken }),
    ).resolves.toEqual({ outcome: "unauthorized" });
    let mutateCalls = 0;
    const rejected = await store.update({
      runId: first.runId,
      accessToken: second.accessToken,
      expected: coordinates(firstCreated.record),
      operationId: "cross-run-update",
      operationKind: "test",
      mutate: () => {
        mutateCalls += 1;
        return {
          stateEnvelope: first.envelope,
          bufferedReceipts: [],
          updatedAt: "2026-08-10T18:01:00.000Z",
          replayResult: null,
        };
      },
    });
    expect(rejected).toEqual({ outcome: "unauthorized" });
    expect(mutateCalls).toBe(0);

    const missing = openFindRun();
    await expect(
      store.updateTrusted({
        runId: missing.runId,
        expected: {
          generation: 0,
          revision: 0,
          stateFingerprint: fingerprintScreen02WorkflowState(missing.state),
        },
        operationId: "missing-update",
        operationKind: "test",
        mutate: () => {
          throw new Error("A missing update must not invoke mutate.");
        },
      }),
    ).resolves.toEqual({ outcome: "not-found" });
  });

  it("rejects corrupt and non-canonical envelopes without committing", async () => {
    const store = new InMemoryScreen02WorkflowStore();
    const run = openFindRun();
    const corrupted = {
      ...run.envelope,
      checksum:
        run.envelope.checksum === "fnv1a64:0000000000000000"
          ? "fnv1a64:0000000000000001"
          : "fnv1a64:0000000000000000",
    };

    await expect(
      store.create({
        runId: run.runId,
        accessToken: run.accessToken,
        stateEnvelope: corrupted,
      }),
    ).rejects.toBeInstanceOf(Screen02WorkflowStoreValidationError);
    await expect(
      store.read({ runId: run.runId, accessToken: run.accessToken }),
    ).resolves.toEqual({ outcome: "not-found" });

    const created = await store.create({
      runId: run.runId,
      accessToken: run.accessToken,
      stateEnvelope: run.envelope,
    });
    if (created.outcome !== "created") throw new Error("Run was not created.");
    await expect(
      store.updateTrusted({
        runId: run.runId,
        expected: coordinates(created.record),
        operationId: "corrupt-successor",
        operationKind: "test",
        mutate: () => ({
          stateEnvelope: { ...run.envelope, unexpected: true },
          bufferedReceipts: [],
          updatedAt: "2026-08-10T18:01:00.000Z",
          replayResult: null,
        }),
      }),
    ).rejects.toBeInstanceOf(Screen02WorkflowStoreValidationError);
    const unchanged = await store.readTrusted({ runId: run.runId });
    expect(unchanged).toMatchObject({
      outcome: "found",
      record: { generation: 0, operationReplays: [] },
    });
  });

  it("enforces receipt count and workflow-mode bounds", async () => {
    const store = new InMemoryScreen02WorkflowStore();
    const run = openFindRun();
    const created = await store.create({
      runId: run.runId,
      accessToken: run.accessToken,
      stateEnvelope: run.envelope,
    });
    if (created.outcome !== "created") throw new Error("Run was not created.");
    const expected = coordinates(created.record);
    const tooMany = Array.from(
      { length: SCREEN_02_WORKFLOW_STORE_MAX_BUFFERED_RECEIPTS + 1 },
      (_, index) => findReceipt(index),
    );
    await expect(
      store.updateTrusted({
        runId: run.runId,
        expected,
        operationId: "too-many-receipts",
        operationKind: "receipt-buffer",
        mutate: () => ({
          stateEnvelope: run.envelope,
          bufferedReceipts: tooMany,
          updatedAt: "2026-08-10T18:01:00.000Z",
          replayResult: null,
        }),
      }),
    ).rejects.toBeInstanceOf(Screen02WorkflowStoreValidationError);

    const maximum = Array.from(
      { length: SCREEN_02_WORKFLOW_STORE_MAX_BUFFERED_RECEIPTS },
      (_, index) => findReceipt(index),
    );
    const accepted = await store.updateTrusted({
      runId: run.runId,
      expected,
      operationId: "maximum-receipts",
      operationKind: "receipt-buffer",
      mutate: () => ({
        stateEnvelope: run.envelope,
        bufferedReceipts: maximum,
        updatedAt: "2026-08-10T18:01:00.000Z",
        replayResult: { count: maximum.length },
      }),
    });
    if (accepted.outcome !== "updated") {
      throw new Error("Bounded receipt buffer was not accepted.");
    }
    expect(accepted.record.bufferedReceipts).toHaveLength(
      SCREEN_02_WORKFLOW_STORE_MAX_BUFFERED_RECEIPTS,
    );

    await expect(
      store.updateTrusted({
        runId: run.runId,
        expected: coordinates(accepted.record),
        operationId: "wrong-mode-receipt",
        operationKind: "receipt-buffer",
        mutate: () => ({
          stateEnvelope: run.envelope,
          bufferedReceipts: [
            {
              receiptId: "audit-receipt",
              requestId: "audit-request",
              assessmentMode: "audit-dossier",
              receiptToken: `sa2a-receipt-v1.payload.${"A".repeat(43)}`,
              receivedAt: "2026-08-10T18:02:00.000Z",
            },
          ],
          updatedAt: "2026-08-10T18:02:00.000Z",
          replayResult: null,
        }),
      }),
    ).rejects.toBeInstanceOf(Screen02WorkflowStoreValidationError);
    expect(await store.readTrusted({ runId: run.runId })).toMatchObject({
      outcome: "found",
      record: {
        generation: 1,
        bufferedReceipts: { length: maximum.length },
      },
    });
  });

  it("uses Durable Object transactions and rejects a corrupted stored envelope", async () => {
    const harness = durableStorageHarness();
    const store = new DurableObjectScreen02WorkflowStore(harness.storage);
    const run = openFindRun();
    await store.create({
      runId: run.runId,
      accessToken: run.accessToken,
      stateEnvelope: run.envelope,
    });
    expect(harness.transactionCalls()).toBe(1);

    const key = [...harness.records.keys()][0];
    if (!key) throw new Error("Durable Object record was not persisted.");
    const stored = structuredClone(harness.records.get(key)) as {
      stateEnvelope: Record<string, unknown>;
    };
    stored.stateEnvelope = { ...stored.stateEnvelope, unexpected: true };
    harness.records.set(key, stored);

    await expect(
      store.readTrusted({ runId: run.runId }),
    ).rejects.toBeInstanceOf(Screen02WorkflowStoreValidationError);
  });

  it("retains a retriable child-cascade marker after expired parent deletion", async () => {
    const harness = durableStorageHarness();
    const store = new DurableObjectScreen02WorkflowStore(harness.storage);
    const run = openFindRun();
    const created = await store.create({
      runId: run.runId,
      accessToken: run.accessToken,
      stateEnvelope: run.envelope,
      openOperation: {
        operationId: "expired-corrupt-open-operation",
        identityNonce: "C".repeat(43),
        signingKeyId: "cleanup-recovery-key",
      },
    });
    if (created.outcome !== "created") {
      throw new Error("Recovery fixture was not created.");
    }
    const recordEntry = [...harness.records.entries()].find(([key]) =>
      key.startsWith("screen02-workflow-v021:"),
    );
    if (!recordEntry) throw new Error("Workflow record was not persisted.");
    const [recordKey, current] = recordEntry;
    harness.records.set(recordKey, {
      ...(current as Record<string, unknown>),
      stateEnvelope: { malformed: true },
    });
    const primaryBindingEntry = [...harness.records.entries()].find(
      ([, value]) =>
        typeof value === "object" &&
        value !== null &&
        "schemaVersion" in value &&
        value.schemaVersion === "screen02-workflow-open-operation-v2",
    );
    if (!primaryBindingEntry) {
      throw new Error("Primary open-operation binding was not persisted.");
    }
    harness.records.set(primaryBindingEntry[0], { malformed: true });

    await expect(
      store.cleanupExpired(created.record.expiresAt),
    ).resolves.toEqual({
      deletedRunIds: [run.runId],
      nextExpirationAt: "1970-01-01T00:00:00.000Z",
      batchLimitReached: false,
    });
    await expect(store.listPendingChildCascades()).resolves.toEqual({
      runIds: [run.runId],
      batchLimitReached: false,
    });
    await expect(store.readPendingChildCascade(run.runId)).resolves.toEqual({
      outcome: "found",
      cascade: {
        kind: "parent-retired",
        runId: run.runId,
        originatingTaskId: null,
      },
    });
    // A transient Screen 3 or host-task cleanup failure deliberately leaves
    // the marker unacknowledged, so the next alarm can rediscover the run.
    await expect(store.nextExpirationAt()).resolves.toBe(
      "1970-01-01T00:00:00.000Z",
    );
    await expect(store.listPendingChildCascades()).resolves.toEqual({
      runIds: [run.runId],
      batchLimitReached: false,
    });
    await store.acknowledgePendingChildCascade(run.runId);
    await expect(store.nextExpirationAt()).resolves.toBeNull();
    expect(harness.records.size).toBe(0);
  });

  it("repairs a malformed future expiry index without deleting its active record", async () => {
    const harness = durableStorageHarness();
    const store = new DurableObjectScreen02WorkflowStore(harness.storage);
    const run = openFindRun();
    const created = await store.create({
      runId: run.runId,
      accessToken: run.accessToken,
      stateEnvelope: run.envelope,
    });
    if (created.outcome !== "created") {
      throw new Error("Index-repair fixture was not created.");
    }
    const expiryEntry = [...harness.records.entries()].find(([key]) =>
      key.startsWith("screen02-workflow-expiry-v1:"),
    );
    if (!expiryEntry) throw new Error("Expiry index was not persisted.");
    harness.records.delete(expiryEntry[0]);
    harness.records.set(
      `screen02-workflow-expiry-v1:malformed|${run.runId}`,
      "not-a-run-id",
    );

    await expect(store.cleanupExpired(openedAt)).resolves.toEqual({
      deletedRunIds: [],
      nextExpirationAt: created.record.expiresAt,
      batchLimitReached: false,
    });
    await expect(
      store.read({ runId: run.runId, accessToken: run.accessToken }),
    ).resolves.toMatchObject({ outcome: "authenticated" });
    expect(
      [...harness.records.keys()].filter((key) =>
        key.startsWith("screen02-workflow-expiry-v1:"),
      ),
    ).toEqual([
      `screen02-workflow-expiry-v1:${created.record.expiresAt}|${run.runId}`,
    ]);
  });

  it("purges both stale and current due indexes without duplicating the deleted run", async () => {
    const harness = durableStorageHarness();
    const store = new DurableObjectScreen02WorkflowStore(harness.storage);
    const run = openFindRun();
    const created = await store.create({
      runId: run.runId,
      accessToken: run.accessToken,
      stateEnvelope: run.envelope,
    });
    if (created.outcome !== "created") {
      throw new Error("Stale-index fixture was not created.");
    }
    const staleExpiresAt = new Date(
      Date.parse(created.record.expiresAt) - 1_000,
    ).toISOString();
    harness.records.set(
      `screen02-workflow-expiry-v1:${staleExpiresAt}|${run.runId}`,
      run.runId,
    );

    await expect(
      store.cleanupExpired(created.record.expiresAt),
    ).resolves.toEqual({
      deletedRunIds: [run.runId],
      nextExpirationAt: "1970-01-01T00:00:00.000Z",
      batchLimitReached: false,
    });
    await store.acknowledgePendingChildCascade(run.runId);
    expect(harness.records.size).toBe(0);
  });

  it("re-arms cleanup while more than one malformed-index batch remains", async () => {
    const harness = durableStorageHarness();
    const store = new DurableObjectScreen02WorkflowStore(harness.storage);
    for (let index = 0; index < 130; index += 1) {
      harness.records.set(
        `screen02-workflow-expiry-v1:malformed-${index
          .toString()
          .padStart(3, "0")}`,
        "not-a-run-id",
      );
    }

    await expect(store.cleanupExpired(openedAt)).resolves.toEqual({
      deletedRunIds: [],
      nextExpirationAt: "1970-01-01T00:00:00.000Z",
      batchLimitReached: true,
    });
    expect(harness.records.size).toBe(2);
  });

  it("keeps active open-operation secrets out of durable storage and removes the binding on retirement", async () => {
    const harness = durableStorageHarness();
    const store = new DurableObjectScreen02WorkflowStore(harness.storage);
    const run = openFindRun();
    const operationId =
      "durable-open-operation-raw-value-must-not-be-persisted";
    const created = await store.create({
      runId: run.runId,
      accessToken: run.accessToken,
      stateEnvelope: run.envelope,
      openOperation: {
        operationId,
        identityNonce: "N".repeat(43),
        signingKeyId: "durable-open-test-key",
        initialState: "blank",
      },
    });
    if (created.outcome !== "created") {
      throw new Error("Bound Durable Object run was not created.");
    }

    const persisted = JSON.stringify([...harness.records.entries()]);
    expect(persisted).not.toContain(operationId);
    expect(persisted).not.toContain(run.accessToken);
    await expect(store.readOpenOperation(operationId)).resolves.toMatchObject({
      outcome: "bound",
      binding: {
        runId: run.runId,
        identityNonce: "N".repeat(43),
        signingKeyId: "durable-open-test-key",
        initialState: "blank",
      },
    });

    const persistedOpenBinding = [...harness.records.values()].find(
      (value) =>
        typeof value === "object" &&
        value !== null &&
        "schemaVersion" in value &&
        value.schemaVersion === "screen02-workflow-open-operation-v2",
    );
    expect(persistedOpenBinding).toMatchObject({
      schemaVersion: "screen02-workflow-open-operation-v2",
      initialState: "blank",
    });

    const otherRun = openFindRun();
    await expect(
      store.create({
        runId: otherRun.runId,
        accessToken: otherRun.accessToken,
        stateEnvelope: otherRun.envelope,
        openOperation: {
          operationId,
          identityNonce: "O".repeat(43),
          signingKeyId: "durable-open-test-key",
          initialState: "standard",
        },
      }),
    ).resolves.toEqual({
      outcome: "open-operation-blocked",
      reason: "initialization-mismatch",
    });

    await expect(
      store.retire({
        runId: run.runId,
        accessToken: run.accessToken,
        expected: coordinates(created.record),
      }),
    ).resolves.toEqual({ outcome: "retired", runId: run.runId });
    await expect(store.readOpenOperation(operationId)).resolves.toEqual({
      outcome: "not-found",
    });
    expect(harness.records.size).toBe(0);
  });

  it("restores retained v1 open bindings as standard initialization", async () => {
    const harness = durableStorageHarness();
    const store = new DurableObjectScreen02WorkflowStore(harness.storage);
    const run = openFindRun();
    const operationId = "durable-legacy-open-binding";
    const created = await store.create({
      runId: run.runId,
      accessToken: run.accessToken,
      stateEnvelope: run.envelope,
      openOperation: {
        operationId,
        identityNonce: "L".repeat(43),
        signingKeyId: "durable-open-test-key",
      },
    });
    if (created.outcome !== "created") {
      throw new Error("Legacy binding fixture was not created.");
    }
    const entry = [...harness.records.entries()].find(
      ([, value]) =>
        typeof value === "object" &&
        value !== null &&
        "schemaVersion" in value &&
        value.schemaVersion === "screen02-workflow-open-operation-v2",
    );
    if (!entry) throw new Error("Open-operation binding was not persisted.");
    const [key, current] = entry;
    const { initialState: _ignored, ...legacy } = current as Record<
      string,
      unknown
    >;
    harness.records.set(key, {
      ...legacy,
      schemaVersion: "screen02-workflow-open-operation-v1",
    });

    await expect(store.readOpenOperation(operationId)).resolves.toMatchObject({
      outcome: "bound",
      binding: {
        runId: run.runId,
        schemaVersion: "screen02-workflow-open-operation-v2",
        initialState: "standard",
      },
    });
  });
});
