import { describe, expect, it } from "vitest";

import { encodeScreen02FindWorkflowStateEnvelope } from
  "../../src/core/screen02-workflow-envelope";
import {
  createScreen02FindState,
  fingerprintScreen02WorkflowValue,
} from "../../src/core/screen02-workflow-state";
import {
  InMemoryScreen02FindContinuationStoreBackend,
  SCREEN_02_FIND_CONTINUATION_MAX_CHECKPOINT_BYTES,
  Screen02FindContinuationStore,
  createScreen02FindContinuationBinding,
  fingerprintScreen02FindContinuationOutcome,
  screen02FindContinuationPlatformSubrequests,
  screen02FindContinuationReservedPlatformSubrequests,
  type Screen02FindContinuationCreateInput,
  type Screen02FindContinuationParentBinding,
  type Screen02FindContinuationReservation,
  type Screen02FindContinuationWork,
} from "../../src/worker/screen02-find-continuation-store";
import {
  InMemoryScreen02WorkflowStore,
  createScreen02WorkflowStoreIdentity,
  type Screen02WorkflowStoreRecord,
} from "../../src/worker/screen02-workflow-store";
import { confirmedWorkflowFindContext } from "../core/screen02-workflow-fixtures";

const createdAt = "2026-09-09T12:00:00.000Z";
const absoluteDeadline = "2026-09-09T12:05:00.000Z";
const expiresAt = "2026-09-09T12:10:00.000Z";

const limits = {
  maxSourceQueries: 8,
  maxConnectorFetches: 8,
  maxDocumentAttempts: 24,
  maxTransportHops: 24,
  maxRedirectHops: 12,
  maxRetries: 8,
  maxReceivedBytes: 6 * 1024 * 1024,
  maxContinuationRequests: 8,
  requiredPlatformSubrequestHeadroom: 5,
};

const reservation: Screen02FindContinuationReservation = {
  sourceQueries: 1,
  connectorFetches: 2,
  documentAttempts: 2,
  transportHops: 2,
  redirectHops: 0,
  retries: 0,
  maximumReceivedBytes: 2048,
};

const actualUsage: Screen02FindContinuationWork = {
  sourceQueries: 1,
  connectorFetches: 2,
  documentAttempts: 2,
  transportHops: 2,
  redirectHops: 0,
  retries: 0,
  receivedBytes: 1024,
};

async function parent() {
  const identity = createScreen02WorkflowStoreIdentity();
  const state = createScreen02FindState(
    confirmedWorkflowFindContext(),
    identity.runId,
    createdAt,
  );
  const parentStore = new InMemoryScreen02WorkflowStore();
  const result = await parentStore.create({
    ...identity,
    stateEnvelope: encodeScreen02FindWorkflowStateEnvelope(state),
  });
  if (result.outcome !== "created") throw new Error("Parent creation failed.");
  const binding = await createScreen02FindContinuationBinding(
    result.record,
    identity.accessToken,
  );
  return { ...identity, record: result.record, binding };
}

function createInput(
  binding: Screen02FindContinuationParentBinding,
  overrides: Partial<Screen02FindContinuationCreateInput> = {},
): Screen02FindContinuationCreateInput {
  return {
    binding,
    continuationId: "continuation-1",
    operationId: "create-1",
    inputFingerprint: fingerprintScreen02WorkflowValue("create-1"),
    discoveryRequestId: "discovery-1",
    searchRoundId: "round-1",
    candidateSetSnapshotId: null,
    exactRequest: { query: "energy shock" },
    criteriaFingerprint: fingerprintScreen02WorkflowValue("criteria"),
    relevanceProfileFingerprint: fingerprintScreen02WorkflowValue("profile"),
    discoveryVersion: "discovery-v1",
    sourcePolicyVersion: "source-policy-v1",
    parserVersion: "parser-v1",
    qualificationVersion: "qualification-v1",
    limits,
    checkpoint: { nextSource: 0, acceptedLeadIds: [] },
    createdAt,
    absoluteDeadline,
    expiresAt,
    ...overrides,
  };
}

async function fixture(
  overrides: Partial<Screen02FindContinuationCreateInput> = {},
) {
  const owner = await parent();
  const backend = new InMemoryScreen02FindContinuationStoreBackend();
  const store = new Screen02FindContinuationStore(backend, {
    enforceParentGuard: false,
  });
  const result = await store.create(createInput(owner.binding, overrides));
  if (result.outcome !== "created") throw new Error("Continuation creation failed.");
  return { ...owner, backend, store, continuation: result.record };
}

function reserveInput(
  binding: Screen02FindContinuationParentBinding,
  revision = 0,
  cursor = 0,
  overrides: Record<string, unknown> = {},
) {
  return {
    binding,
    continuationId: "continuation-1",
    expected: { revision, cursor },
    operationId: "acquire-1",
    inputFingerprint: fingerprintScreen02WorkflowValue("acquire-1"),
    reservation,
    reservedAt: "2026-09-09T12:00:10.000Z",
    leaseExpiresAt: "2026-09-09T12:00:40.000Z",
    ...overrides,
  };
}

describe("Screen 2 Find continuation store", () => {
  it("derives an unforgeable hash-only binding from the parent access token", async () => {
    const owner = await parent();
    expect(owner.binding.accessTokenSha256).toMatch(/^sha256:/);
    expect(JSON.stringify(owner.binding)).not.toContain(owner.accessToken);
    await expect(createScreen02FindContinuationBinding(
      owner.record,
      createScreen02WorkflowStoreIdentity().accessToken,
    )).rejects.toThrow(/unauthorized/);

    const forged = structuredClone(owner.binding);
    const store = new Screen02FindContinuationStore(
      new InMemoryScreen02FindContinuationStoreBackend(),
      { enforceParentGuard: false },
    );
    await expect(store.create(createInput(forged))).rejects.toThrow(
      /authenticated parent state/,
    );
  });

  it("requires an exact parent guard and never outlives its parent", async () => {
    const owner = await parent();
    const guarded = new Screen02FindContinuationStore(
      new InMemoryScreen02FindContinuationStoreBackend(),
    );
    await expect(guarded.create(createInput(owner.binding))).resolves.toEqual({
      outcome: "parent-unavailable",
    });
    const unguarded = new Screen02FindContinuationStore(
      new InMemoryScreen02FindContinuationStoreBackend(),
      { enforceParentGuard: false },
    );
    await expect(unguarded.create(createInput(owner.binding, {
      expiresAt: "2099-01-01T00:00:00.000Z",
    }))).rejects.toThrow(/parent lifetime/);
  });

  it("replays only the same creation and preserves current progress", async () => {
    const value = await fixture();
    const reserved = await value.store.reserve(reserveInput(value.binding));
    expect(reserved.outcome).toBe("reserved");
    const replay = await value.store.create(createInput(value.binding));
    expect(replay.outcome).toBe("replayed");
    expect(replay.outcome === "replayed" && replay.record.revision).toBe(1);
    const rebound = await value.store.create(createInput(value.binding, {
      exactRequest: { query: "different" },
    }));
    expect(rebound.outcome).toBe("conflict");
  });

  it("reserves conservatively, serializes callers, and binds operation replay", async () => {
    const value = await fixture();
    expect(screen02FindContinuationPlatformSubrequests(reservation)).toBe(4);
    expect(screen02FindContinuationReservedPlatformSubrequests(reservation))
      .toBe(8);
    const first = await value.store.reserve(reserveInput(value.binding));
    expect(first.outcome).toBe("reserved");
    if (first.outcome !== "reserved") throw new Error("Reservation failed.");
    expect(first.record).toMatchObject({
      revision: 1,
      cursor: 0,
      usage: { continuationRequests: 1, platformSubrequests: 0 },
      lease: { leaseGeneration: 1 },
    });
    await expect(value.store.reserve(reserveInput(value.binding))).resolves
      .toMatchObject({ outcome: "replayed", lease: { leaseGeneration: 1 } });
    await expect(value.store.reserve(reserveInput(value.binding, 1, 0, {
      operationId: "acquire-2",
      inputFingerprint: fingerprintScreen02WorkflowValue("acquire-2"),
    }))).resolves.toMatchObject({ outcome: "busy" });
    await expect(value.store.reserve(reserveInput(value.binding, 1, 0, {
      reservation: { ...reservation, documentAttempts: 3, transportHops: 3 },
    }))).rejects.toThrow(/cannot be rebound/);
  });

  it("advances exact lease ownership and replays only the exact outcome", async () => {
    const value = await fixture();
    const reserved = await value.store.reserve(reserveInput(value.binding));
    if (reserved.outcome !== "reserved") throw new Error("Reservation failed.");
    const checkpoint = { nextSource: 2, acceptedLeadIds: ["lead-1"] };
    const status = "active" as const;
    const outcomeFingerprint = fingerprintScreen02FindContinuationOutcome({
      actualUsage,
      checkpoint,
      status,
    });
    const input = {
      binding: value.binding,
      continuationId: "continuation-1",
      expected: { revision: 1, cursor: 0 },
      operationId: "acquire-1",
      inputFingerprint: fingerprintScreen02WorkflowValue("acquire-1"),
      leaseGeneration: 1,
      completedAt: "2026-09-09T12:00:20.000Z",
      actualUsage,
      checkpoint,
      status,
      outcomeFingerprint,
    };
    const advanced = await value.store.advance(input);
    expect(advanced).toMatchObject({
      outcome: "advanced",
      record: {
        revision: 2,
        cursor: 1,
        usage: {
          continuationRequests: 1,
          documentAttempts: 2,
          receivedBytes: 1024,
          platformSubrequests: 4,
        },
        lease: null,
      },
    });
    await expect(value.store.advance(input)).resolves.toMatchObject({
      outcome: "replayed",
    });
    await expect(value.store.advance({
      ...input,
      checkpoint: { nextSource: 99 },
    })).rejects.toThrow(/does not bind its exact result/);
  });

  it("persists a proven result from the exact lease owner after acquisition time expires", async () => {
    const value = await fixture();
    const reserved = await value.store.reserve(reserveInput(value.binding));
    if (reserved.outcome !== "reserved") throw new Error("Reservation failed.");
    const checkpoint = { nextSource: 2, acceptedLeadIds: ["lead-1"] };
    const status = "active" as const;
    const outcomeFingerprint = fingerprintScreen02FindContinuationOutcome({
      actualUsage,
      checkpoint,
      status,
    });

    await expect(value.store.advance({
      binding: value.binding,
      continuationId: "continuation-1",
      expected: { revision: 1, cursor: 0 },
      operationId: "acquire-1",
      inputFingerprint: fingerprintScreen02WorkflowValue("acquire-1"),
      leaseGeneration: 1,
      completedAt: "2026-09-09T12:00:41.000Z",
      actualUsage,
      checkpoint,
      status,
      outcomeFingerprint,
    })).resolves.toMatchObject({
      outcome: "advanced",
      record: {
        revision: 2,
        cursor: 1,
        lease: null,
        usage: {
          continuationRequests: 1,
          documentAttempts: 2,
          receivedBytes: 1024,
          platformSubrequests: 4,
        },
      },
    });
  });

  it("migrates legacy worst-case platform accounting on authenticated read", async () => {
    const value = await fixture();
    const reserved = await value.store.reserve(reserveInput(value.binding));
    if (reserved.outcome !== "reserved") throw new Error("Reservation failed.");
    const checkpoint = { nextSource: 2, acceptedLeadIds: ["lead-1"] };
    const outcomeFingerprint = fingerprintScreen02FindContinuationOutcome({
      actualUsage,
      checkpoint,
      status: "active",
    });
    await value.store.advance({
      binding: value.binding,
      continuationId: "continuation-1",
      expected: { revision: 1, cursor: 0 },
      operationId: "acquire-1",
      inputFingerprint: fingerprintScreen02WorkflowValue("acquire-1"),
      leaseGeneration: 1,
      completedAt: "2026-09-09T12:00:20.000Z",
      actualUsage,
      checkpoint,
      status: "active",
      outcomeFingerprint,
    });
    const key = "screen02-find-continuation-v1:continuation-1";
    const current = await value.backend.get(key) as Record<string, unknown>;
    const { failure: _failure, ...legacy } = current;
    const legacyUsage = legacy.usage as Record<string, unknown>;
    await value.backend.transaction(async (transaction) => {
      await transaction.put(key, {
        ...legacy,
        schemaVersion: "screen-02-find-continuation-store-v1",
        usage: { ...legacyUsage, platformSubrequests: 8 },
      });
    });

    const restored = new Screen02FindContinuationStore(value.backend, {
      enforceParentGuard: false,
    });
    await expect(restored.read(value.binding, "continuation-1"))
      .resolves.toMatchObject({
        outcome: "found",
        record: {
          schemaVersion: "screen-02-find-continuation-store-v2",
          usage: { platformSubrequests: 4 },
          failure: null,
        },
      });
  });

  it("charges an expired lease as ambiguous before admitting more work", async () => {
    const value = await fixture();
    await value.store.reserve(reserveInput(value.binding));
    const recovered = await value.store.reserve(reserveInput(value.binding, 1, 0, {
      operationId: "acquire-2",
      inputFingerprint: fingerprintScreen02WorkflowValue("acquire-2"),
      reservedAt: "2026-09-09T12:00:41.000Z",
      leaseExpiresAt: "2026-09-09T12:01:00.000Z",
    }));
    expect(recovered).toMatchObject({
      outcome: "recovered-ambiguous",
      record: {
        revision: 2,
        cursor: 1,
        usage: {
          continuationRequests: 1,
          receivedBytes: 2048,
          platformSubrequests: 4,
        },
        journal: [{ status: "ambiguous" }],
        lease: null,
      },
    });
    const checkpoint = { tooLate: true };
    await expect(value.store.advance({
      binding: value.binding,
      continuationId: "continuation-1",
      expected: { revision: 1, cursor: 0 },
      operationId: "acquire-1",
      inputFingerprint: fingerprintScreen02WorkflowValue("acquire-1"),
      leaseGeneration: 1,
      completedAt: "2026-09-09T12:00:42.000Z",
      actualUsage,
      checkpoint,
      status: "active",
      outcomeFingerprint: fingerprintScreen02FindContinuationOutcome({
        actualUsage,
        checkpoint,
        status: "active",
      }),
    })).resolves.toMatchObject({ outcome: "conflict" });
  });

  it("enforces fixed per-invocation headroom and search-wide ceilings", async () => {
    const value = await fixture();
    await expect(value.store.reserve(reserveInput(value.binding, 0, 0, {
      reservation: { ...reservation, transportHops: 15 },
    }))).resolves.toMatchObject({
      outcome: "limit-exceeded",
      reason: "requiredPlatformSubrequestHeadroom",
    });
    await expect(value.store.reserve(reserveInput(value.binding, 0, 0, {
      reservation: { ...reservation, documentAttempts: 25 },
    }))).rejects.toThrow(/documentAttempts is invalid/);
  });

  it("admits the exact production chunk boundary and yields before one excess subrequest", async () => {
    const owner = await parent();
    const store = new Screen02FindContinuationStore(
      new InMemoryScreen02FindContinuationStoreBackend(),
      { enforceParentGuard: false },
    );
    const productionLimits = {
      maxSourceQueries: 19,
      maxConnectorFetches: 19,
      maxDocumentAttempts: 24,
      maxTransportHops: 96,
      maxRedirectHops: 72,
      maxRetries: 1,
      maxReceivedBytes: 6 * 1024 * 1024 + 1,
      maxContinuationRequests: 16,
      requiredPlatformSubrequestHeadroom: 7,
    };
    const created = await store.create(createInput(owner.binding, {
      limits: productionLimits,
    }));
    if (created.outcome !== "created") throw new Error("Continuation creation failed.");
    const maximumRedirectChunk = {
      sourceQueries: 19,
      connectorFetches: 19,
      documentAttempts: 2,
      transportHops: 8,
      redirectHops: 6,
      retries: 0,
      maximumReceivedBytes: 4 * 1024 * 1024 + 2,
    };

    await expect(store.reserve({
      ...reserveInput(owner.binding),
      reservation: maximumRedirectChunk,
    })).resolves.toMatchObject({
      outcome: "reserved",
      record: {
        usage: { continuationRequests: 1, platformSubrequests: 0 },
        lease: { reservation: maximumRedirectChunk },
      },
    });

    const nextStore = new Screen02FindContinuationStore(
      new InMemoryScreen02FindContinuationStoreBackend(),
      { enforceParentGuard: false },
    );
    const nextCreated = await nextStore.create(createInput(owner.binding, {
      limits: productionLimits,
    }));
    if (nextCreated.outcome !== "created") throw new Error("Continuation creation failed.");
    const rejected = await nextStore.reserve({
      ...reserveInput(owner.binding),
      reservation: {
        ...maximumRedirectChunk,
        sourceQueries: 20,
        connectorFetches: 20,
      },
    });
    expect(rejected).toMatchObject({
      outcome: "limit-exceeded",
      reason: "requiredPlatformSubrequestHeadroom",
      record: {
        usage: { continuationRequests: 0, platformSubrequests: 0 },
        journal: [],
        lease: null,
      },
    });
  });

  it("cancels with ambiguous lease charging and rejects late completion", async () => {
    const value = await fixture();
    await value.store.reserve(reserveInput(value.binding));
    const cancelled = await value.store.cancel({
      binding: value.binding,
      continuationId: "continuation-1",
      expected: { revision: 1, cursor: 0 },
      operationId: "cancel-1",
      inputFingerprint: fingerprintScreen02WorkflowValue("cancel-1"),
      reason: "Researcher reset the run.",
      cancelledAt: "2026-09-09T12:00:20.000Z",
    });
    expect(cancelled).toMatchObject({
      outcome: "cancelled",
      record: {
        status: "cancelled",
        revision: 3,
        cursor: 2,
        usage: { receivedBytes: 2048, platformSubrequests: 4 },
      },
    });
    const checkpoint = { tooLate: true };
    await expect(value.store.advance({
      binding: value.binding,
      continuationId: "continuation-1",
      expected: { revision: 1, cursor: 0 },
      operationId: "acquire-1",
      inputFingerprint: fingerprintScreen02WorkflowValue("acquire-1"),
      leaseGeneration: 1,
      completedAt: "2026-09-09T12:00:21.000Z",
      actualUsage,
      checkpoint,
      status: "active",
      outcomeFingerprint: fingerprintScreen02FindContinuationOutcome({
        actualUsage,
        checkpoint,
        status: "active",
      }),
    })).resolves.toMatchObject({ outcome: "terminal" });
  });

  it("settles and retries a typed failed lease without resetting work", async () => {
    const value = await fixture();
    await value.store.reserve(reserveInput(value.binding));
    const diagnosticReference = fingerprintScreen02WorkflowValue({
      class: "dns-transport",
      boundary: "source-retrieval",
    });
    const failedStepCheckpoint = {
      nextSource: 2,
      acceptedLeadIds: ["lead-1"],
    };
    const failureInput = {
      binding: value.binding,
      continuationId: "continuation-1",
      expected: { revision: 1, cursor: 0 },
      operationId: "acquire-1",
      inputFingerprint: fingerprintScreen02WorkflowValue("acquire-1"),
      leaseGeneration: 1,
      failedAt: "2026-09-09T12:00:20.000Z",
      actualUsage,
      checkpoint: failedStepCheckpoint,
      stage: "source-retrieval" as const,
      failureClass: "dns-transport" as const,
      checkpointBytes: 812_345,
      finalStateBytes: null,
      retryable: true,
      diagnosticReference,
    };
    const failed = await value.store.fail(failureInput);
    if (failed.outcome !== "failed") {
      throw new Error("Expected the failed operation to settle exactly.");
    }
    expect(failed).toMatchObject({
      outcome: "failed",
      record: {
        status: "active",
        revision: 2,
        cursor: 1,
        lease: null,
        usage: {
          continuationRequests: 1,
          documentAttempts: 2,
          receivedBytes: 1024,
          platformSubrequests: 4,
        },
        journal: [{
          status: "failed",
          actualUsage,
          outcomeFingerprint: diagnosticReference,
        }],
        checkpoint: failedStepCheckpoint,
        failure: {
          stage: "source-retrieval",
          failureClass: "dns-transport",
          operationId: "acquire-1",
          leaseGeneration: 1,
          lastSavedRevision: 1,
          lastSavedCursor: 0,
          checkpointBytes: 812_345,
          finalStateBytes: null,
          resourceUsage: {
            continuationRequests: 1,
            receivedBytes: 1024,
          },
          retryable: true,
          diagnosticReference,
          failedAt: "2026-09-09T12:00:20.000Z",
        },
      },
    });
    const restoredStore = new Screen02FindContinuationStore(value.backend, {
      enforceParentGuard: false,
    });
    await expect(restoredStore.fail(failureInput)).resolves.toMatchObject({
      outcome: "replayed",
      record: { status: "active", lease: null },
    });
    await expect(restoredStore.reserve(reserveInput(value.binding, 2, 1, {
      operationId: "acquire-2",
      inputFingerprint: fingerprintScreen02WorkflowValue("acquire-2"),
    }))).rejects.toThrow(/requires one bounded retry charge/);
    const retryReservation: Screen02FindContinuationReservation = {
      sourceQueries: 0,
      connectorFetches: 0,
      documentAttempts: 0,
      transportHops: 0,
      redirectHops: 0,
      retries: 1,
      maximumReceivedBytes: 0,
    };
    const retried = await restoredStore.reserve(
      reserveInput(value.binding, 2, 1, {
        operationId: "acquire-2",
        inputFingerprint: fingerprintScreen02WorkflowValue("acquire-2"),
        reservation: retryReservation,
        reservedAt: "2026-09-09T12:00:21.000Z",
        leaseExpiresAt: "2026-09-09T12:00:40.000Z",
      }),
    );
    expect(retried).toMatchObject({
      outcome: "reserved",
      record: {
        revision: 3,
        cursor: 1,
        usage: {
          retries: 0,
          sourceQueries: 1,
          connectorFetches: 2,
          documentAttempts: 2,
          receivedBytes: 1024,
        },
      },
      lease: { leaseGeneration: 2, reservation: retryReservation },
    });
    if (retried.outcome !== "reserved") {
      throw new Error("Expected a continuation-preserving retry lease.");
    }
    const retryUsage: Screen02FindContinuationWork = {
      sourceQueries: 0,
      connectorFetches: 0,
      documentAttempts: 0,
      transportHops: 0,
      redirectHops: 0,
      retries: 1,
      receivedBytes: 0,
    };
    const retryCheckpoint = failed.record.checkpoint;
    expect(retryCheckpoint).toEqual(failedStepCheckpoint);
    const retriedOutcome = fingerprintScreen02FindContinuationOutcome({
      actualUsage: retryUsage,
      checkpoint: retryCheckpoint,
      status: "active",
    });
    await expect(restoredStore.advance({
      binding: value.binding,
      continuationId: "continuation-1",
      expected: { revision: 3, cursor: 1 },
      operationId: "acquire-2",
      inputFingerprint: fingerprintScreen02WorkflowValue("acquire-2"),
      leaseGeneration: 2,
      completedAt: "2026-09-09T12:00:22.000Z",
      actualUsage: retryUsage,
      checkpoint: retryCheckpoint,
      status: "active",
      outcomeFingerprint: retriedOutcome,
    })).resolves.toMatchObject({
      outcome: "advanced",
      record: {
        status: "active",
        revision: 4,
        cursor: 2,
        usage: {
          retries: 1,
          sourceQueries: 1,
          connectorFetches: 2,
          documentAttempts: 2,
          receivedBytes: 1024,
          platformSubrequests: 4,
        },
        checkpoint: retryCheckpoint,
        failure: { failureClass: "dns-transport" },
      },
    });
    await expect(restoredStore.fail({
      ...failureInput,
      failureClass: "unexpected-internal",
    })).rejects.toThrow(/cannot be rebound/);
  });

  it("terminates a second retryable failure at the fixed retry ceiling", async () => {
    const value = await fixture({ limits: { ...limits, maxRetries: 1 } });
    await value.store.reserve(reserveInput(value.binding));
    const firstDiagnostic = fingerprintScreen02WorkflowValue("first-failure");
    await value.store.fail({
      binding: value.binding,
      continuationId: "continuation-1",
      expected: { revision: 1, cursor: 0 },
      operationId: "acquire-1",
      inputFingerprint: fingerprintScreen02WorkflowValue("acquire-1"),
      leaseGeneration: 1,
      failedAt: "2026-09-09T12:00:20.000Z",
      actualUsage,
      stage: "source-retrieval",
      failureClass: "source-unavailability",
      checkpointBytes: null,
      finalStateBytes: null,
      retryable: true,
      diagnosticReference: firstDiagnostic,
    });
    const retryReservation = {
      sourceQueries: 0,
      connectorFetches: 0,
      documentAttempts: 0,
      transportHops: 0,
      redirectHops: 0,
      retries: 1,
      maximumReceivedBytes: 0,
    };
    const retried = await value.store.reserve(
      reserveInput(value.binding, 2, 1, {
        operationId: "acquire-2",
        inputFingerprint: fingerprintScreen02WorkflowValue("acquire-2"),
        reservation: retryReservation,
        reservedAt: "2026-09-09T12:00:21.000Z",
        leaseExpiresAt: "2026-09-09T12:00:40.000Z",
      }),
    );
    if (retried.outcome !== "reserved") throw new Error("Retry was not reserved.");
    const retryUsage = {
      sourceQueries: 0,
      connectorFetches: 0,
      documentAttempts: 0,
      transportHops: 0,
      redirectHops: 0,
      retries: 1,
      receivedBytes: 0,
    };
    const secondDiagnostic = fingerprintScreen02WorkflowValue("second-failure");
    await expect(value.store.fail({
      binding: value.binding,
      continuationId: "continuation-1",
      expected: { revision: 3, cursor: 1 },
      operationId: "acquire-2",
      inputFingerprint: fingerprintScreen02WorkflowValue("acquire-2"),
      leaseGeneration: retried.lease.leaseGeneration,
      failedAt: "2026-09-09T12:00:22.000Z",
      actualUsage: retryUsage,
      stage: "source-retrieval",
      failureClass: "source-unavailability",
      checkpointBytes: null,
      finalStateBytes: null,
      retryable: true,
      diagnosticReference: secondDiagnostic,
    })).resolves.toMatchObject({
      outcome: "failed",
      record: {
        status: "failed",
        lease: null,
        usage: { retries: 1, continuationRequests: 2 },
        failure: {
          operationId: "acquire-2",
          leaseGeneration: 2,
          retryable: true,
          diagnosticReference: secondDiagnostic,
        },
      },
    });
  });

  it("charges the full reservation when a failed external outcome is ambiguous", async () => {
    const value = await fixture();
    await value.store.reserve(reserveInput(value.binding));
    const diagnosticReference = fingerprintScreen02WorkflowValue(
      "ambiguous-source-failure",
    );
    const failed = await value.store.fail({
      binding: value.binding,
      continuationId: "continuation-1",
      expected: { revision: 1, cursor: 0 },
      operationId: "acquire-1",
      inputFingerprint: fingerprintScreen02WorkflowValue("acquire-1"),
      leaseGeneration: 1,
      failedAt: "2026-09-09T12:00:41.000Z",
      actualUsage: null,
      stage: "source-retrieval",
      failureClass: "source-unavailability",
      checkpointBytes: null,
      finalStateBytes: null,
      retryable: true,
      diagnosticReference,
    });
    expect(failed).toMatchObject({
      outcome: "failed",
      record: {
        status: "failed",
        lease: null,
        usage: {
          sourceQueries: 1,
          connectorFetches: 2,
          documentAttempts: 2,
          transportHops: 2,
          receivedBytes: 2048,
          continuationRequests: 1,
          platformSubrequests: 4,
        },
        journal: [{ status: "failed", actualUsage: null }],
        failure: {
          resourceUsage: { receivedBytes: 2048 },
        },
      },
    });
    await expect(value.store.reserve(reserveInput(value.binding, 2, 1, {
      operationId: "ambiguous-retry",
      inputFingerprint:
        fingerprintScreen02WorkflowValue("ambiguous-retry"),
      reservedAt: "2026-09-09T12:00:42.000Z",
      leaseExpiresAt: "2026-09-09T12:01:00.000Z",
    }))).resolves.toMatchObject({ outcome: "terminal" });
  });

  it("bounds checkpoints and deletes expired records in finite batches", async () => {
    const value = await fixture();
    await expect(value.store.create(createInput(value.binding, {
      continuationId: "continuation-too-large",
      operationId: "create-too-large",
      inputFingerprint: fingerprintScreen02WorkflowValue("too-large"),
      checkpoint: "x".repeat(SCREEN_02_FIND_CONTINUATION_MAX_CHECKPOINT_BYTES),
    }))).rejects.toThrow(/checkpoint exceeds/);
    await expect(value.store.nextExpirationAt()).resolves.toBe(expiresAt);
    await expect(value.store.cleanupExpired("2026-09-09T12:10:00.000Z"))
      .resolves.toMatchObject({ removed: 1, nextExpirationAt: null });
    await expect(value.store.read(value.binding, "continuation-1")).resolves
      .toEqual({ outcome: "not-found" });
  });

  it("counts multibyte checkpoint bytes at the exact near/over-limit boundary", async () => {
    const value = await fixture();
    const nearCharacters = Math.floor(
      (SCREEN_02_FIND_CONTINUATION_MAX_CHECKPOINT_BYTES - 2) / 3,
    );
    await expect(value.store.create(createInput(value.binding, {
      continuationId: "continuation-multibyte-near",
      operationId: "create-multibyte-near",
      inputFingerprint: fingerprintScreen02WorkflowValue("multibyte-near"),
      checkpoint: "界".repeat(nearCharacters),
    }))).resolves.toMatchObject({ outcome: "created" });
    await expect(value.store.create(createInput(value.binding, {
      continuationId: "continuation-multibyte-over",
      operationId: "create-multibyte-over",
      inputFingerprint: fingerprintScreen02WorkflowValue("multibyte-over"),
      checkpoint: "界".repeat(nearCharacters + 1),
    }))).rejects.toThrow(/checkpoint exceeds its byte limit/);
  });

  it("accepts bindings from exact validated parent records only", async () => {
    const owner = await parent();
    const altered = {
      ...owner.record,
      mode: "audit",
    } as unknown as Screen02WorkflowStoreRecord;
    await expect(createScreen02FindContinuationBinding(
      altered,
      owner.accessToken,
    )).rejects.toThrow(/invalid or is not a Find run/);
  });
});
