import { describe, expect, it } from "vitest";

import { buildScreen02WorkflowHandoff } from "../../src/core/screen02-workflow-handoff";
import {
  encodeScreen02FindWorkflowStateEnvelope,
} from "../../src/core/screen02-workflow-envelope";
import {
  requireScreen02FindState,
} from "../../src/core/screen02-workflow-state";
import {
  applyScreen03Action,
  createScreen03LoadingState,
  fingerprintScreen03VerificationState,
  fingerprintScreen03Value,
  SHOCKAUDIT_V030_LEGACY_RELEASE_LABEL,
  type Screen03VerificationState,
} from "../../src/core/screen03-workflow";
import {
  DurableObjectScreen02WorkflowStore,
} from "../../src/worker/screen02-workflow-store";
import {
  DurableObjectScreen03WorkflowStore,
  InMemoryScreen03WorkflowStore,
  SCREEN_03_WORKFLOW_STORE_RECORD_SCHEMA_VERSION,
  type Screen03WorkflowCoordinates,
  type Screen03WorkflowStore,
  type Screen03WorkflowStoreRecord,
} from "../../src/worker/screen03-workflow-store";
import { buildReadyFindState } from "../core/screen02-workflow-fixtures";

const parentRunId = `s2r_${"R".repeat(43)}`;
const parentFingerprint = fingerprintScreen03Value("screen-02-parent-v1");
const openedAt = "2026-08-09T18:00:10.000Z";
const expiresAt = "2026-08-16T18:00:09.000Z";

function parentGuard(stateFingerprint = parentFingerprint) {
  return {
    runId: parentRunId,
    generation: 0,
    revision: canonicalParentState().revision,
    stateFingerprint,
    expiresAt,
  };
}

function canonicalParentState() {
  const raw = structuredClone(buildReadyFindState());
  raw.runId = parentRunId;
  delete raw.shockGlances;
  return requireScreen02FindState(raw);
}

function canonicalHandoff() {
  const state = canonicalParentState();
  return buildScreen02WorkflowHandoff(state, "0.3.3", state.updatedAt);
}

const handoffProducerAppVersion = canonicalHandoff().producerAppVersion;

function loadingState() {
  return createScreen03LoadingState(canonicalHandoff(), openedAt);
}

function reviewedSuccessor(
  state: Screen03VerificationState,
  at = "2026-08-09T18:00:11.000Z",
) {
  const proposalId = state.proposals.identity[0]?.id;
  if (!proposalId) throw new Error("Expected a carried identity proposal.");
  return applyScreen03Action(state, {
    type: "review-field",
    proposalId,
    decision: "reject",
    reason: "Keep the carried Screen 2 identity proposal in history while exact support is checked.",
    at,
  });
}

function coordinates(
  record: Screen03WorkflowStoreRecord,
): Screen03WorkflowCoordinates {
  return {
    revision: record.stateRevision,
    stateFingerprint: record.stateFingerprint,
    generation: record.generation,
  };
}

function durableStorageHarness() {
  const records = new Map<string, unknown>();
  let transactionCalls = 0;
  const clone = <T>(value: T): T => structuredClone(value);
  const storage = {
    get: async (key: string) =>
      records.has(key) ? clone(records.get(key)) : undefined,
    put: async (key: string, value: unknown) => {
      records.set(key, clone(value));
    },
    delete: async (key: string) => records.delete(key),
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
          return true;
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

async function exerciseStore(
  store: Screen03WorkflowStore,
  input: {
    parentStateFingerprint: string;
    parentGuard: ReturnType<typeof parentGuard>;
    expiresAt: string;
  } = {
    parentStateFingerprint: parentFingerprint,
    parentGuard: parentGuard(),
    expiresAt,
  },
) {
  const state = loadingState();
  const created = await store.createOrReplace({
    parentRunId,
    handoffProducerAppVersion,
    parentStateFingerprint: input.parentStateFingerprint,
    parentGuard: input.parentGuard,
    state,
    expiresAt: input.expiresAt,
  });
  expect(created.outcome).toBe("created");
  expect(created.record).toMatchObject({
    schemaVersion: SCREEN_03_WORKFLOW_STORE_RECORD_SCHEMA_VERSION,
    parentRunId,
    parentStateFingerprint: input.parentStateFingerprint,
    handoffFingerprint: state.upstream.handoffFingerprint,
    stateRevision: 0,
    generation: 1,
    createdAt: openedAt,
    updatedAt: openedAt,
    expiresAt: input.expiresAt,
  });
  expect(created.record.stateFingerprint).toBe(
    fingerprintScreen03VerificationState(state),
  );

  const restored = await store.read(parentRunId);
  expect(restored).toEqual({ outcome: "found", record: created.record });

  const existing = await store.createOrReplace({
    parentRunId,
    handoffProducerAppVersion,
    parentStateFingerprint: input.parentStateFingerprint,
    parentGuard: input.parentGuard,
    state,
    expiresAt: input.expiresAt,
  });
  expect(existing).toEqual({ outcome: "existing", record: created.record });

  const successor = reviewedSuccessor(state);
  const updated = await store.update({
    parentRunId,
    handoffProducerAppVersion,
    parentStateFingerprint: input.parentStateFingerprint,
    parentGuard: input.parentGuard,
    expected: coordinates(created.record),
    state: successor,
    expiresAt: input.expiresAt,
  });
  expect(updated.outcome).toBe("updated");
  expect(updated.record).toMatchObject({
    stateRevision: 1,
    generation: 2,
    createdAt: openedAt,
    updatedAt: successor.updatedAt,
  });
  expect(updated.record.state.proposals.identity[0]?.reviewStatus).toBe(
    "rejected",
  );

  const stale = await store.update({
    parentRunId,
    handoffProducerAppVersion,
    parentStateFingerprint: input.parentStateFingerprint,
    parentGuard: input.parentGuard,
    expected: coordinates(created.record),
    state: successor,
    expiresAt: input.expiresAt,
  });
  expect(stale).toEqual({ outcome: "conflict", record: updated.record });

  return { state, created, successor, updated };
}

describe("canonical Screen 3 workflow persistence", () => {
  it("restores, stores, and updates a fingerprint-valid v0.3.00 child", async () => {
    const store = new InMemoryScreen03WorkflowStore();
    const legacy = structuredClone(loadingState());
    legacy.releaseLabel = SHOCKAUDIT_V030_LEGACY_RELEASE_LABEL;
    const { integrity: _integrity, ...fingerprintInput } = legacy;
    legacy.integrity.stateFingerprint = fingerprintScreen03Value(fingerprintInput);

    const created = await store.createOrReplace({
      parentRunId,
      handoffProducerAppVersion,
      parentStateFingerprint: parentFingerprint,
      parentGuard: parentGuard(),
      state: legacy,
      expiresAt,
    });
    expect(created.outcome).toBe("created");
    expect(created.record.state.releaseLabel).toBe(
      SHOCKAUDIT_V030_LEGACY_RELEASE_LABEL,
    );

    const successor = reviewedSuccessor(legacy);
    const updated = await store.update({
      parentRunId,
      handoffProducerAppVersion,
      parentStateFingerprint: parentFingerprint,
      parentGuard: parentGuard(),
      expected: coordinates(created.record),
      state: successor,
      expiresAt,
    });
    expect(updated.outcome).toBe("updated");
    expect(updated.record.state.releaseLabel).toBe(
      SHOCKAUDIT_V030_LEGACY_RELEASE_LABEL,
    );
  });

  it("creates, restores, updates, and rejects stale CAS coordinates in memory", async () => {
    const store = new InMemoryScreen03WorkflowStore();
    await exerciseStore(store);
  });

  it("uses the same validated transactional contract with Durable Object storage", async () => {
    const harness = durableStorageHarness();
    const parentStore = new DurableObjectScreen02WorkflowStore(harness.storage);
    const parent = await parentStore.create({
      runId: parentRunId,
      accessToken: `s2a_${"A".repeat(43)}`,
      stateEnvelope: encodeScreen02FindWorkflowStateEnvelope(
        canonicalParentState(),
      ),
    });
    if (parent.outcome !== "created") {
      throw new Error("Expected the canonical Screen 2 parent to be created.");
    }
    const store = new DurableObjectScreen03WorkflowStore(harness.storage);

    await exerciseStore(store, {
      parentStateFingerprint: parent.record.stateFingerprint,
      parentGuard: {
        runId: parent.record.runId,
        generation: parent.record.generation,
        revision: parent.record.stateRevision,
        stateFingerprint: parent.record.stateFingerprint,
        expiresAt: parent.record.expiresAt,
      },
      expiresAt: parent.record.expiresAt,
    });

    expect(harness.transactionCalls()).toBe(5);
    expect(
      [...harness.records.keys()].some((key) =>
        key.startsWith("screen03-workflow-v030:"),
      ),
    ).toBe(true);
    expect(
      [...harness.records.keys()].filter((key) =>
        key.startsWith("screen03-workflow-expiry-v1:"),
      ),
    ).toHaveLength(1);
  });

  it("migrates a persisted legacy child only from an explicit authenticated handoff producer", async () => {
    const harness = durableStorageHarness();
    const parentStore = new DurableObjectScreen02WorkflowStore(harness.storage);
    const parent = await parentStore.create({
      runId: parentRunId,
      accessToken: `s2a_${"M".repeat(43)}`,
      stateEnvelope: encodeScreen02FindWorkflowStateEnvelope(
        canonicalParentState(),
      ),
    });
    if (parent.outcome !== "created") {
      throw new Error("Expected the migration parent fixture to be created.");
    }
    const store = new DurableObjectScreen03WorkflowStore(harness.storage);
    const state = loadingState();
    const created = await store.createOrReplace({
      parentRunId,
      parentStateFingerprint: parent.record.stateFingerprint,
      handoffProducerAppVersion,
      parentGuard: {
        runId: parent.record.runId,
        generation: parent.record.generation,
        revision: parent.record.stateRevision,
        stateFingerprint: parent.record.stateFingerprint,
        expiresAt: parent.record.expiresAt,
      },
      state,
      expiresAt: parent.record.expiresAt,
    });
    const childEntry = [...harness.records.entries()].find(([key]) =>
      key.startsWith("screen03-workflow-v030:"),
    );
    if (!childEntry) throw new Error("Expected the migration child fixture.");
    const {
      handoffProducerAppVersion: _legacyMissingProducer,
      ...legacyRecord
    } = childEntry[1] as Screen03WorkflowStoreRecord;
    harness.records.set(childEntry[0], legacyRecord);

    const legacyRead = await store.read(parentRunId);
    expect(legacyRead.outcome).toBe("found");
    if (legacyRead.outcome !== "found") {
      throw new Error("Expected the legacy Screen 3 child to remain readable.");
    }
    expect(legacyRead.record).not.toHaveProperty(
      "handoffProducerAppVersion",
    );
    const successor = reviewedSuccessor(state);
    const migrated = await store.update({
      parentRunId,
      parentStateFingerprint: parent.record.stateFingerprint,
      handoffProducerAppVersion,
      parentGuard: {
        runId: parent.record.runId,
        generation: parent.record.generation,
        revision: parent.record.stateRevision,
        stateFingerprint: parent.record.stateFingerprint,
        expiresAt: parent.record.expiresAt,
      },
      expected: coordinates(created.record),
      state: successor,
      expiresAt: parent.record.expiresAt,
    });
    expect(migrated.outcome).toBe("updated");
    expect(migrated.record.handoffProducerAppVersion).toBe(
      handoffProducerAppVersion,
    );

    await expect(store.update({
      parentRunId,
      parentStateFingerprint: parent.record.stateFingerprint,
      handoffProducerAppVersion: "9.9.9",
      parentGuard: {
        runId: parent.record.runId,
        generation: parent.record.generation,
        revision: parent.record.stateRevision,
        stateFingerprint: parent.record.stateFingerprint,
        expiresAt: parent.record.expiresAt,
      },
      expected: coordinates(migrated.record),
      state: successor,
      expiresAt: parent.record.expiresAt,
    })).rejects.toThrow(/cannot change its original handoff producer/i);
  });

  it("repairs a malformed child expiry index and self-heals an unreadable due child", async () => {
    const harness = durableStorageHarness();
    const parentStore = new DurableObjectScreen02WorkflowStore(
      harness.storage,
    );
    const parent = await parentStore.create({
      runId: parentRunId,
      accessToken: `s2a_${"A".repeat(43)}`,
      stateEnvelope: encodeScreen02FindWorkflowStateEnvelope(
        canonicalParentState(),
      ),
    });
    if (parent.outcome !== "created") {
      throw new Error("Expected cleanup parent fixture to be created.");
    }
    const store = new DurableObjectScreen03WorkflowStore(harness.storage);
    await store.createOrReplace({
      parentRunId,
      handoffProducerAppVersion,
      parentStateFingerprint: parent.record.stateFingerprint,
      parentGuard: {
        runId: parent.record.runId,
        generation: parent.record.generation,
        revision: parent.record.stateRevision,
        stateFingerprint: parent.record.stateFingerprint,
        expiresAt: parent.record.expiresAt,
      },
      state: loadingState(),
      expiresAt: parent.record.expiresAt,
    });
    const expiryEntry = [...harness.records.entries()].find(([key]) =>
      key.startsWith("screen03-workflow-expiry-v1:"),
    );
    if (!expiryEntry) throw new Error("Child expiry index was not persisted.");
    harness.records.delete(expiryEntry[0]);
    harness.records.set(
      `screen03-workflow-expiry-v1:malformed:${parentRunId}`,
      "not-a-run-id",
    );

    await expect(store.cleanupExpired(openedAt)).resolves.toBe(0);
    await expect(store.nextExpirationAt()).resolves.toBe(
      parent.record.expiresAt,
    );
    const childEntry = [...harness.records.entries()].find(([key]) =>
      key.startsWith("screen03-workflow-v030:"),
    );
    if (!childEntry) throw new Error("Child workflow was not persisted.");
    harness.records.set(childEntry[0], {
      ...(childEntry[1] as Record<string, unknown>),
      state: { malformed: true },
    });

    await expect(
      store.cleanupExpired(parent.record.expiresAt),
    ).resolves.toBe(1);
    await expect(store.read(parentRunId)).resolves.toEqual({
      outcome: "not-found",
    });
    expect(
      [...harness.records.keys()].some((key) =>
        key.startsWith("screen03-workflow-expiry-v1:"),
      ),
    ).toBe(false);
    expect(
      [...harness.records.keys()].some((key) =>
        key.startsWith("screen02-workflow-v021:"),
      ),
    ).toBe(true);
  });

  it("retires an unreadable child idempotently after its parent is removed", async () => {
    const harness = durableStorageHarness();
    const parentStore = new DurableObjectScreen02WorkflowStore(
      harness.storage,
    );
    const parent = await parentStore.create({
      runId: parentRunId,
      accessToken: `s2a_${"A".repeat(43)}`,
      stateEnvelope: encodeScreen02FindWorkflowStateEnvelope(
        canonicalParentState(),
      ),
    });
    if (parent.outcome !== "created") {
      throw new Error("Expected cascade parent fixture to be created.");
    }
    const store = new DurableObjectScreen03WorkflowStore(harness.storage);
    await store.createOrReplace({
      parentRunId,
      handoffProducerAppVersion,
      parentStateFingerprint: parent.record.stateFingerprint,
      parentGuard: {
        runId: parent.record.runId,
        generation: parent.record.generation,
        revision: parent.record.stateRevision,
        stateFingerprint: parent.record.stateFingerprint,
        expiresAt: parent.record.expiresAt,
      },
      state: loadingState(),
      expiresAt: parent.record.expiresAt,
    });
    const childEntry = [...harness.records.entries()].find(([key]) =>
      key.startsWith("screen03-workflow-v030:"),
    );
    if (!childEntry) throw new Error("Child workflow was not persisted.");
    harness.records.set(childEntry[0], { malformed: true });

    await expect(store.retire(parentRunId)).resolves.toBeUndefined();
    await expect(store.retire(parentRunId)).resolves.toBeUndefined();
    expect(harness.records.has(childEntry[0])).toBe(false);
    await expect(store.cleanupExpired(parent.record.expiresAt)).resolves.toBe(
      0,
    );
    expect(
      [...harness.records.keys()].some((key) =>
        key.startsWith("screen03-workflow-expiry-v1:"),
      ),
    ).toBe(false);
  });

  it("re-arms cleanup while malformed child-index rows exceed one batch", async () => {
    const harness = durableStorageHarness();
    const store = new DurableObjectScreen03WorkflowStore(harness.storage);
    for (let index = 0; index < 70; index += 1) {
      harness.records.set(
        `screen03-workflow-expiry-v1:malformed-${index
          .toString()
          .padStart(3, "0")}`,
        "not-a-run-id",
      );
    }

    await expect(store.cleanupExpired(openedAt)).resolves.toBe(0);
    await expect(store.nextExpirationAt()).resolves.toBe(
      "1970-01-01T00:00:00.000Z",
    );
    expect(harness.records.size).toBe(5);
  });

  it("replaces a child only when its canonical parent fingerprint changes", async () => {
    const store = new InMemoryScreen03WorkflowStore();
    const state = loadingState();
    const first = await store.createOrReplace({
      parentRunId,
      handoffProducerAppVersion,
      parentStateFingerprint: parentFingerprint,
      parentGuard: parentGuard(),
      state,
      expiresAt,
    });
    const nextParentFingerprint = fingerprintScreen03Value(
      "screen-02-parent-v2",
    );
    const replaced = await store.createOrReplace({
      parentRunId,
      handoffProducerAppVersion,
      parentStateFingerprint: nextParentFingerprint,
      parentGuard: parentGuard(nextParentFingerprint),
      state,
      expiresAt,
    });

    expect(first.outcome).toBe("created");
    expect(replaced.outcome).toBe("replaced");
    expect(replaced.record).toMatchObject({
      parentStateFingerprint: nextParentFingerprint,
      generation: 2,
    });
  });

  it("rejects malformed coordinates and state integrity tampering before persistence", async () => {
    const store = new InMemoryScreen03WorkflowStore();
    const state = loadingState();
    const tampered = structuredClone(state);
    tampered.eventIdentity.canonicalTitle = "A client-supplied substitute event";

    await expect(store.createOrReplace({
      parentRunId,
      parentStateFingerprint: parentFingerprint,
      parentGuard: parentGuard(),
      state,
      expiresAt,
    } as never)).rejects.toThrow(/handoff producer app version/i);

    await expect(
      store.createOrReplace({
        parentRunId: "workflow-find-run",
        handoffProducerAppVersion,
        parentStateFingerprint: parentFingerprint,
        parentGuard: {
          ...parentGuard(),
          runId: "workflow-find-run",
        },
        state,
        expiresAt,
      }),
    ).rejects.toThrow(/canonical Screen 2 run ID/i);
    await expect(
      store.createOrReplace({
        parentRunId,
        handoffProducerAppVersion,
        parentStateFingerprint: "sha256:not-a-parent-fingerprint",
        parentGuard: parentGuard(),
        state,
        expiresAt,
      }),
    ).rejects.toThrow(/parent fingerprint/i);
    await expect(
      store.createOrReplace({
        parentRunId,
        handoffProducerAppVersion,
        parentStateFingerprint: parentFingerprint,
        parentGuard: parentGuard(),
        state: tampered,
        expiresAt,
      }),
    ).rejects.toThrow(/exact contract/i);
  });

  it("indexes expiration, cleans only due children, and retires the record and index", async () => {
    const store = new InMemoryScreen03WorkflowStore();
    await store.createOrReplace({
      parentRunId,
      handoffProducerAppVersion,
      parentStateFingerprint: parentFingerprint,
      parentGuard: parentGuard(),
      state: loadingState(),
      expiresAt,
    });

    await expect(store.nextExpirationAt()).resolves.toBe(expiresAt);
    await expect(
      store.cleanupExpired("2026-08-16T18:00:08.999Z"),
    ).resolves.toBe(0);
    await expect(store.read(parentRunId)).resolves.toMatchObject({
      outcome: "found",
    });
    await expect(store.cleanupExpired(expiresAt)).resolves.toBe(1);
    await expect(store.read(parentRunId)).resolves.toEqual({
      outcome: "not-found",
    });
    await expect(store.nextExpirationAt()).resolves.toBeNull();
  });
});
