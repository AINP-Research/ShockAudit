import { describe, expect, it } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import {
  commitResearchTaskOperation,
  createResearchTask,
  expireResearchTaskOperation,
  reserveResearchTaskOperation,
} from "../../src/core/six-screen/research-task";
import { SixScreenResearchTaskStore } from
  "../../src/worker/six-screen-research-task-store";
import { InMemorySixScreenWorkflowStorage } from
  "../../src/worker/six-screen-workflow-store";

const runId = `sa6r_${"r".repeat(43)}`;
const accessToken = `sa6a_${"a".repeat(43)}`;
const identityFingerprint = "fnv1a64:0123456789abcdef";

function task() {
  return createResearchTask({
    id: "policy-task-1",
    runId,
    kind: "policy",
    parent: {
      studyRevision: 3,
      identityFingerprint,
      eventCardSnapshotId: null,
      selectedDesignSnapshotId: null,
      coeventSnapshotId: null,
      mechanismSnapshotId: null,
    },
    immutableRequest: { eventId: "event-1", questions: ["coverage", "timing"] },
    profileName: "policy-standard",
    pendingWorkIds: ["coverage", "timing"],
    unresolvedRequirementIds: ["requirement-coverage", "requirement-timing"],
    continuationMode: "panel_driven",
    createdAt: "2026-09-12T10:00:00.000Z",
    absoluteDeadline: "2026-09-12T10:02:00.000Z",
    expiresAt: "2026-09-13T10:00:00.000Z",
  });
}

function fixture() {
  const storage = new InMemorySixScreenWorkflowStorage();
  return { storage, store: new SixScreenResearchTaskStore(storage) };
}

describe("durable six-screen research task store", () => {
  it("persists, authenticates, and idempotently replays task creation", async () => {
    const { storage, store } = fixture();
    const current = task();
    const createInputFingerprint = fingerprintSixScreenValue(current.immutableRequest);
    const created = await store.create({
      task: current,
      accessToken,
      createInputFingerprint,
    });
    const replayed = await store.create({
      task: current,
      accessToken,
      createInputFingerprint,
    });
    expect(created.outcome).toBe("created");
    expect(replayed.outcome).toBe("replayed");
    expect(JSON.stringify([...storage.values.values()])).not.toContain(accessToken);
    expect((await store.read({ runId, taskId: current.id, accessToken })).outcome)
      .toBe("found");
    expect((await store.read({
      runId,
      taskId: current.id,
      accessToken: `sa6a_${"z".repeat(43)}`,
    })).outcome).toBe("unauthorized");
  });

  it("commits a reservation and result once across retry and stale delivery", async () => {
    const { storage, store } = fixture();
    const current = task();
    await store.create({
      task: current,
      accessToken,
      createInputFingerprint: current.requestHash,
    });
    const auth = { runId, taskId: current.id, accessToken };
    const reserveFingerprint = fingerprintSixScreenValue({ query: "coverage" });
    const reserveInput = {
      ...auth,
      expectedRevision: 0,
      operationId: "persist-reservation-1",
      operationKind: "reserve",
      inputFingerprint: reserveFingerprint,
      updatedAt: "2026-09-12T10:00:01.000Z",
    };
    const reservation = {
      sourceQueries: 1,
      metadataRecords: 3,
      documentAttempts: 1,
      usefulDocuments: 1,
      transportHops: 1,
      maximumReceivedBytes: 10_000,
      maximumDecodedBytes: 20_000,
      maximumActiveResearchMs: 5_000,
      maximumCpuMs: 1_000,
      providerCostUnits: {},
    };
    const reserved = await store.mutate(reserveInput, (stored) => {
      const outcome = reserveResearchTaskOperation(stored, {
        expectedRevision: 0,
        operationId: "source-operation-1",
        inputFingerprint: reserveFingerprint,
        reservation,
        reservedAt: reserveInput.updatedAt,
        leaseExpiresAt: "2026-09-12T10:00:31.000Z",
      });
      if (outcome.outcome !== "reserved") throw new Error("Expected reservation.");
      return { task: outcome.task, result: outcome.operation };
    });
    expect(reserved.outcome).toBe("updated");
    if (reserved.outcome !== "updated") throw new Error("Expected update.");

    const replay = await store.mutate(reserveInput, () => {
      throw new Error("A replay must not run the updater twice.");
    });
    expect(replay.outcome).toBe("replayed");

    const resultFingerprint = fingerprintSixScreenValue({ sourceIds: ["source-1"] });
    // Simulate a Worker isolate restart: the reservation must be resumable from
    // durable storage rather than process memory.
    const resumedStore = new SixScreenResearchTaskStore(storage);
    const committed = await resumedStore.mutate({
      ...auth,
      expectedRevision: 1,
      operationId: "persist-commit-1",
      operationKind: "commit",
      inputFingerprint: resultFingerprint,
      updatedAt: "2026-09-12T10:00:02.000Z",
    }, (stored) => {
      const outcome = commitResearchTaskOperation(stored, {
        expectedRevision: 1,
        operationId: "source-operation-1",
        inputFingerprint: reserveFingerprint,
        generation: 1,
        actualUsage: {
          sourceQueries: 1,
          metadataRecords: 2,
          documentAttempts: 1,
          usefulDocuments: 1,
          transportHops: 1,
          receivedBytes: 5_000,
          decodedBytes: 7_000,
          activeResearchMs: 200,
          cpuMs: 20,
          providerCostUnits: {},
        },
        completedWorkIds: ["coverage"],
        remainingWorkIds: ["timing"],
        unresolvedRequirementIds: ["requirement-timing"],
        nextState: "partial",
        stopReason: "Initial source family exhausted.",
        resultFingerprint,
        committedAt: "2026-09-12T10:00:02.000Z",
      });
      return { task: outcome.task, result: outcome.outcome };
    });
    expect(committed.outcome).toBe("updated");
    if (committed.outcome !== "updated") throw new Error("Expected commit.");
    expect(committed.record.task).toMatchObject({
      revision: 2,
      state: "partial",
      completedWorkIds: ["coverage"],
      pendingWorkIds: ["timing"],
      usage: { sourceQueries: 1, usefulDocuments: 1 },
      reserved: { sourceQueries: 0, usefulDocuments: 0 },
    });

    const stale = await resumedStore.mutate({
      ...auth,
      expectedRevision: 0,
      operationId: "stale-operation",
      operationKind: "reserve",
      inputFingerprint: reserveFingerprint,
      updatedAt: "2026-09-12T10:00:03.000Z",
    }, () => {
      throw new Error("A stale updater must not run.");
    });
    expect(stale.outcome).toBe("stale");
  });

  it("retains a bounded ambiguous source hold without consuming unrelated step budget", () => {
    const current = createResearchTask({
      id: "coevent-step-budget-task",
      runId,
      kind: "coevent",
      parent: {
        studyRevision: 3,
        identityFingerprint,
        eventCardSnapshotId: null,
        selectedDesignSnapshotId: null,
        coeventSnapshotId: "screen4-investigation-fixture",
        mechanismSnapshotId: null,
      },
      immutableRequest: { steps: ["source-a", "source-b"] },
      profileName: "coevent-multisource-v3",
      pendingWorkIds: ["source-a", "source-b"],
      unresolvedRequirementIds: [],
      continuationMode: "panel_driven",
      createdAt: "2026-09-12T10:00:00.000Z",
      absoluteDeadline: "2026-09-12T10:10:00.000Z",
      expiresAt: "2026-09-13T10:00:00.000Z",
    });
    const stepFingerprint = fingerprintSixScreenValue({ step: "source-a" });
    const perStepReservation = {
      sourceQueries: 1,
      metadataRecords: 6,
      documentAttempts: 6,
      usefulDocuments: 0,
      transportHops: 7,
      maximumReceivedBytes: 14 * 1024 * 1024,
      maximumDecodedBytes: 14 * 1024 * 1024,
      maximumActiveResearchMs: 30_000,
      maximumCpuMs: 0,
      providerCostUnits: {},
    };
    const reserved = reserveResearchTaskOperation(current, {
      expectedRevision: current.revision,
      operationId: "source-a-attempt",
      inputFingerprint: stepFingerprint,
      reservation: perStepReservation,
      reservedAt: "2026-09-12T10:00:01.000Z",
      leaseExpiresAt: "2026-09-12T10:01:31.000Z",
    });
    expect(reserved.outcome).toBe("reserved");
    if (reserved.outcome !== "reserved") throw new Error("Expected reservation.");
    const expired = expireResearchTaskOperation(reserved.task, {
      expectedRevision: reserved.task.revision,
      operationId: reserved.operation.operationId,
      inputFingerprint: stepFingerprint,
      generation: reserved.operation.generation,
      expiredAt: "2026-09-12T10:01:31.000Z",
    });
    expect(expired.task).toMatchObject({
      state: "queued",
      usage: {
        sourceQueries: 1,
        documentAttempts: 6,
        transportHops: 7,
        activeResearchMs: 30_000,
      },
      operations: [{ status: "ambiguous", actualUsage: {
        sourceQueries: 1, documentAttempts: 6,
      } }],
    });
    const second = reserveResearchTaskOperation(expired.task, {
      expectedRevision: expired.task.revision,
      operationId: "source-b-attempt",
      inputFingerprint: fingerprintSixScreenValue({ step: "source-b" }),
      reservation: { ...perStepReservation, documentAttempts: 0,
        transportHops: 1, maximumReceivedBytes: 2 * 1024 * 1024,
        maximumDecodedBytes: 2 * 1024 * 1024 },
      reservedAt: "2026-09-12T10:01:32.000Z",
      leaseExpiresAt: "2026-09-12T10:03:02.000Z",
    });
    expect(second.outcome).toBe("reserved");
    if (second.outcome !== "reserved") throw new Error("Expected reservation.");
    expect(second.task).toMatchObject({
      usage: { sourceQueries: 1 },
      reserved: { sourceQueries: 1 },
      operations: [
        { status: "ambiguous" },
        { status: "reserved", operationId: "source-b-attempt" },
      ],
    });
    expect(second.task.usage.sourceQueries + second.task.reserved.sourceQueries)
      .toBeLessThan(second.task.limits.sourceQueries);
  });

  it("finds only the latest authorized task for the exact policy identity", async () => {
    const { store } = fixture();
    const first = task();
    const second = createResearchTask({
      id: "policy-task-2",
      runId,
      kind: "policy",
      parent: {
        studyRevision: 8,
        identityFingerprint,
        eventCardSnapshotId: null,
        selectedDesignSnapshotId: null,
        coeventSnapshotId: null,
        mechanismSnapshotId: null,
      },
      immutableRequest: { eventId: "event-1", questions: ["coverage"] },
      profileName: "policy-standard",
      pendingWorkIds: ["coverage"],
      unresolvedRequirementIds: ["requirement-coverage"],
      continuationMode: "automatic_standard",
      createdAt: "2026-09-12T10:00:05.000Z",
      absoluteDeadline: "2026-09-12T10:02:05.000Z",
      expiresAt: "2026-09-13T10:00:05.000Z",
    });
    for (const current of [first, second]) {
      await store.create({
        task: current,
        accessToken,
        createInputFingerprint: current.requestHash,
      });
    }

    const found = await store.readLatestPolicyForIdentity({
      runId,
      accessToken,
      identityFingerprint,
    });
    expect(found).toMatchObject({
      outcome: "found",
      record: { taskId: "policy-task-2" },
    });
    expect((await store.readLatestPolicyForIdentity({
      runId,
      accessToken,
      identityFingerprint: "fnv1a64:fedcba9876543210",
    })).outcome).toBe("not_found");
    expect((await store.readLatestPolicyForIdentity({
      runId,
      accessToken: `sa6a_${"z".repeat(43)}`,
      identityFingerprint,
    })).outcome).toBe("unauthorized");
  });

  it("keeps status reads mutation-free and removes only expired tasks", async () => {
    const { store } = fixture();
    const current = task();
    await store.create({
      task: current,
      accessToken,
      createInputFingerprint: current.requestHash,
    });
    const auth = { runId, taskId: current.id, accessToken };
    const first = await store.read(auth);
    const second = await store.read(auth);
    expect(second).toEqual(first);
    expect((await store.cleanupExpired("2026-09-13T09:59:59.000Z")).deleted)
      .toBe(0);
    expect((await store.cleanupExpired("2026-09-13T10:00:00.000Z")).deleted)
      .toBe(1);
    expect((await store.read(auth)).outcome).toBe("not_found");
  });
});
