import { describe, expect, it } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import {
  SIX_SCREEN_RESEARCH_PROFILES,
  cancelResearchTask,
  commitResearchTaskOperation,
  createResearchTask,
  expireResearchTaskOperation,
  extendResearchTask,
  researchTaskStatus,
  reserveResearchTaskOperation,
  type ResearchTaskOperationReservation,
  type ResearchTaskOperationUsage,
} from "../../src/core/six-screen/research-task";

const t0 = "2026-09-12T10:00:00.000Z";
const t1 = "2026-09-12T10:00:01.000Z";
const t2 = "2026-09-12T10:00:02.000Z";

function task() {
  return createResearchTask({
    id: "task-1",
    runId: "run-1",
    kind: "policy",
    parent: {
      studyRevision: 2,
      identityFingerprint: fingerprintSixScreenValue("identity"),
      eventCardSnapshotId: null,
      selectedDesignSnapshotId: null,
      coeventSnapshotId: null,
      mechanismSnapshotId: null,
    },
    immutableRequest: { question: "What changed?" },
    profileName: "policy-standard",
    pendingWorkIds: ["definitions", "effective-date"],
    unresolvedRequirementIds: ["requirement-1"],
    continuationMode: "panel_driven",
    createdAt: t0,
    absoluteDeadline: "2026-09-12T10:02:00.000Z",
    expiresAt: "2026-09-13T10:00:00.000Z",
  });
}

const reservation: ResearchTaskOperationReservation = {
  sourceQueries: 1,
  metadataRecords: 4,
  documentAttempts: 2,
  usefulDocuments: 1,
  transportHops: 3,
  maximumReceivedBytes: 1_000,
  maximumDecodedBytes: 2_000,
  maximumActiveResearchMs: 5_000,
  maximumCpuMs: 500,
  providerCostUnits: {},
};

const usage: ResearchTaskOperationUsage = {
  sourceQueries: 1,
  metadataRecords: 3,
  documentAttempts: 1,
  usefulDocuments: 1,
  transportHops: 2,
  receivedBytes: 800,
  decodedBytes: 1_500,
  activeResearchMs: 4_000,
  cpuMs: 300,
  providerCostUnits: {},
};

function reserve(current = task(), overrides: Record<string, unknown> = {}) {
  return reserveResearchTaskOperation(current, {
    expectedRevision: current.revision,
    operationId: "operation-1",
    inputFingerprint: fingerprintSixScreenValue({ work: "definitions" }),
    reservation,
    reservedAt: t1,
    leaseExpiresAt: "2026-09-12T10:00:21.000Z",
    ...overrides,
  });
}

describe("six-screen research task accounting", () => {
  it("encodes every adopted standard and deeper cumulative profile", () => {
    expect(SIX_SCREEN_RESEARCH_PROFILES).toMatchObject({
      "identity-standard": { limits: { activeResearchMs: 90_000, documentAttempts: 12, usefulDocuments: 6, sourceQueries: 12, metadataRecords: 300 } },
      "policy-standard": { limits: { activeResearchMs: 120_000, documentAttempts: 24, usefulDocuments: 12, sourceQueries: 16, metadataRecords: 60 } },
      "policy-deep": { limits: { activeResearchMs: 300_000, documentAttempts: 40, usefulDocuments: 20, sourceQueries: 24 } },
      "coevent-standard": { limits: { activeResearchMs: 180_000, documentAttempts: 24, usefulDocuments: 12, sourceQueries: 24, metadataRecords: 100 } },
      "coevent-deep": { limits: { activeResearchMs: 300_000, documentAttempts: 40, usefulDocuments: 20, sourceQueries: 36 } },
      "mechanism-standard": { limits: { activeResearchMs: 180_000, documentAttempts: 16, usefulDocuments: 8, sourceQueries: 16, metadataRecords: 80 } },
      "mechanism-deep": { limits: { activeResearchMs: 300_000, documentAttempts: 32, usefulDocuments: 16, sourceQueries: 24 } },
      "gap-standard": { limits: { activeResearchMs: 90_000, documentAttempts: 8, usefulDocuments: 4, sourceQueries: 6 } },
    });
    expect(SIX_SCREEN_RESEARCH_PROFILES["identity-standard"].limits)
      .toMatchObject({
        maximumRequestsPerPublisher: 5,
        providerCostUnits: { openstates: 5 },
      });
    expect(SIX_SCREEN_RESEARCH_PROFILES["policy-standard"].limits)
      .toMatchObject({
        providerCostUnits: { openstates: 6 },
      });
    expect(SIX_SCREEN_RESEARCH_PROFILES["policy-deep"].limits)
      .toMatchObject({
        providerCostUnits: { openstates: 12 },
      });
    for (const [profileName, { limits }] of Object.entries(
      SIX_SCREEN_RESEARCH_PROFILES,
    )) {
      expect(limits.maximumHtmlOrStructuredDocumentBytes).toBe(2 * 1024 * 1024);
      expect(limits.maximumPdfDocumentBytes).toBe(6 * 1024 * 1024);
      expect(limits.maximumPdfPages).toBe(40);
      expect(limits.maximumConcurrentPublishers).toBe(3);
      expect(limits.maximumRequestsPerPublisher).toBe(
        profileName === "identity-standard" ? 5 : 1,
      );
    }
  });

  it("reserves before work and atomically settles actual cumulative usage", () => {
    const reserved = reserve();
    expect(reserved.outcome).toBe("reserved");
    if (reserved.outcome !== "reserved") throw new Error("fixture");
    expect(reserved.task.reserved).toMatchObject({
      sourceQueries: 1,
      documentAttempts: 2,
      decodedBytes: 2_000,
    });
    const settled = commitResearchTaskOperation(reserved.task, {
      expectedRevision: 1,
      operationId: reserved.operation.operationId,
      inputFingerprint: reserved.operation.inputFingerprint,
      generation: reserved.operation.generation,
      actualUsage: usage,
      completedWorkIds: ["definitions"],
      remainingWorkIds: ["effective-date"],
      unresolvedRequirementIds: ["requirement-1"],
      nextState: "queued",
      stopReason: null,
      resultFingerprint: fingerprintSixScreenValue({ claims: ["claim-1"] }),
      committedAt: t2,
    });
    expect(settled.outcome).toBe("committed");
    expect(settled.task.usage).toMatchObject({
      sourceQueries: 1,
      documentAttempts: 1,
      usefulDocuments: 1,
      transportHops: 2,
      receivedBytes: 800,
      decodedBytes: 1_500,
      activeResearchMs: 4_000,
      cpuMs: 300,
    });
    expect(settled.task.reserved).toMatchObject({
      sourceQueries: 0,
      documentAttempts: 0,
      decodedBytes: 0,
    });
    expect(settled.task.completedWorkIds).toEqual(["definitions"]);
    expect(settled.task.pendingWorkIds).toEqual(["effective-date"]);
  });

  it("makes double-click/retry reservation idempotent and rejects operation-id conflicts", () => {
    const first = reserve();
    expect(first.outcome).toBe("reserved");
    if (first.outcome !== "reserved") throw new Error("fixture");
    const replay = reserveResearchTaskOperation(first.task, {
      expectedRevision: 1,
      operationId: first.operation.operationId,
      inputFingerprint: first.operation.inputFingerprint,
      reservation,
      reservedAt: t2,
      leaseExpiresAt: "2026-09-12T10:00:22.000Z",
    });
    expect(replay.outcome).toBe("busy");
    expect(replay.task.revision).toBe(1);
    expect(replay.task.reserved.sourceQueries).toBe(1);
    expect(() => reserveResearchTaskOperation(first.task, {
      expectedRevision: 1,
      operationId: first.operation.operationId,
      inputFingerprint: fingerprintSixScreenValue("different"),
      reservation,
      reservedAt: t2,
      leaseExpiresAt: "2026-09-12T10:00:22.000Z",
    })).toThrow(/reused for different input/u);
  });

  it("conservatively charges an expired external lease before allowing another attempt", () => {
    const first = reserve();
    if (first.outcome !== "reserved") throw new Error("fixture");
    const expired = expireResearchTaskOperation(first.task, {
      expectedRevision: first.task.revision,
      operationId: first.operation.operationId,
      inputFingerprint: first.operation.inputFingerprint,
      generation: first.operation.generation,
      expiredAt: "2026-09-12T10:00:21.000Z",
    });
    expect(expired).toMatchObject({
      outcome: "expired",
      task: {
        state: "queued",
        usage: {
          sourceQueries: reservation.sourceQueries,
          documentAttempts: reservation.documentAttempts,
          receivedBytes: reservation.maximumReceivedBytes,
          activeResearchMs: reservation.maximumActiveResearchMs,
        },
        reserved: { sourceQueries: 0, documentAttempts: 0, receivedBytes: 0 },
        operations: [{ status: "ambiguous" }],
      },
    });
    const retry = reserveResearchTaskOperation(expired.task, {
      expectedRevision: expired.task.revision,
      operationId: "operation-2",
      inputFingerprint: fingerprintSixScreenValue({ work: "definitions-retry" }),
      reservation,
      reservedAt: "2026-09-12T10:00:22.000Z",
      leaseExpiresAt: "2026-09-12T10:00:42.000Z",
    });
    expect(retry.outcome).toBe("reserved");
  });

  it("does not permit retries, pagination, or alternate representations to exceed the lineage budget", () => {
    const current = task();
    const result = reserveResearchTaskOperation(current, {
      expectedRevision: 0,
      operationId: "oversized",
      inputFingerprint: fingerprintSixScreenValue("page-2"),
      reservation: {
        ...reservation,
        sourceQueries: 17,
      },
      reservedAt: t1,
      leaseExpiresAt: "2026-09-12T10:00:21.000Z",
    });
    expect(result).toMatchObject({
      outcome: "limit_exceeded",
      limit: "sourceQueries",
    });
    expect(result.task.operations).toEqual([]);
  });

  it("accounts for metadata records as a first-class cumulative limit", () => {
    const result = reserveResearchTaskOperation(task(), {
      expectedRevision: 0,
      operationId: "metadata-overflow",
      inputFingerprint: fingerprintSixScreenValue("oversized-result-page"),
      reservation: {
        ...reservation,
        metadataRecords: 61,
      },
      reservedAt: t1,
      leaseExpiresAt: "2026-09-12T10:00:21.000Z",
    });
    expect(result).toMatchObject({
      outcome: "limit_exceeded",
      limit: "metadataRecords",
    });
    expect(result.task.operations).toEqual([]);
  });

  it("keeps prior usage when the same lineage is explicitly extended", () => {
    const first = reserve();
    if (first.outcome !== "reserved") throw new Error("fixture");
    const settled = commitResearchTaskOperation(first.task, {
      expectedRevision: 1,
      operationId: first.operation.operationId,
      inputFingerprint: first.operation.inputFingerprint,
      generation: first.operation.generation,
      actualUsage: usage,
      completedWorkIds: ["definitions"],
      remainingWorkIds: ["effective-date"],
      unresolvedRequirementIds: ["requirement-1"],
      nextState: "partial",
      stopReason: "standard_profile_reached",
      resultFingerprint: fingerprintSixScreenValue("partial"),
      committedAt: t2,
    });
    const extended = extendResearchTask(settled.task, {
      expectedRevision: 2,
      extendedAt: "2026-09-12T10:00:03.000Z",
      newAbsoluteDeadline: "2026-09-12T10:05:00.000Z",
    });
    expect(extended.lineageId).toBe(settled.task.lineageId);
    expect(extended.profileName).toBe("policy-deep");
    expect(extended.usage).toEqual(settled.task.usage);
    expect(extended.limits).toMatchObject({
      sourceQueries: 24,
      documentAttempts: 40,
      usefulDocuments: 20,
      activeResearchMs: 300_000,
      decodedBytes: 64 * 1024 * 1024,
    });
  });

  it("admits the bounded Open States reservation used by Screen 2", () => {
    const result = reserveResearchTaskOperation(task(), {
      expectedRevision: 0,
      operationId: "openstates-policy-explanation",
      inputFingerprint: fingerprintSixScreenValue("openstates"),
      reservation: {
        ...reservation,
        sourceQueries: 4,
        providerCostUnits: { openstates: 3 },
      },
      reservedAt: t1,
      leaseExpiresAt: "2026-09-12T10:00:21.000Z",
    });
    expect(result).toMatchObject({
      outcome: "reserved",
      operation: {
        reservation: { providerCostUnits: { openstates: 3 } },
      },
    });
  });

  it("fails closed for unapproved provider cost units", () => {
    const result = reserveResearchTaskOperation(task(), {
      expectedRevision: 0,
      operationId: "paid-provider",
      inputFingerprint: fingerprintSixScreenValue("paid"),
      reservation: {
        ...reservation,
        providerCostUnits: { tavily: 1 },
      },
      reservedAt: t1,
      leaseExpiresAt: "2026-09-12T10:00:21.000Z",
    });
    expect(result).toMatchObject({
      outcome: "limit_exceeded",
      limit: "providerCostUnits.tavily",
    });
  });

  it("rejects settlement that exceeds its reservation", () => {
    const first = reserve();
    if (first.outcome !== "reserved") throw new Error("fixture");
    expect(() => commitResearchTaskOperation(first.task, {
      expectedRevision: 1,
      operationId: first.operation.operationId,
      inputFingerprint: first.operation.inputFingerprint,
      generation: first.operation.generation,
      actualUsage: { ...usage, decodedBytes: 2_001 },
      completedWorkIds: [],
      remainingWorkIds: ["definitions"],
      unresolvedRequirementIds: ["requirement-1"],
      nextState: "partial",
      stopReason: "capacity",
      resultFingerprint: fingerprintSixScreenValue("over"),
      committedAt: t2,
    })).toThrow(/more resources than it reserved/u);
  });

  it("keeps status reads read-only and labels panel-driven continuation", () => {
    const current = task();
    const before = structuredClone(current);
    const status = researchTaskStatus(current);
    expect(status).toMatchObject({
      state: "queued",
      continuationMode: "panel_driven",
      pendingWorkIds: ["definitions", "effective-date"],
    });
    expect(current).toEqual(before);
  });

  it("cancels future work without deleting committed partial state or replenishing usage", () => {
    const first = reserve();
    if (first.outcome !== "reserved") throw new Error("fixture");
    const settled = commitResearchTaskOperation(first.task, {
      expectedRevision: 1,
      operationId: first.operation.operationId,
      inputFingerprint: first.operation.inputFingerprint,
      generation: first.operation.generation,
      actualUsage: usage,
      completedWorkIds: ["definitions"],
      remainingWorkIds: ["effective-date"],
      unresolvedRequirementIds: ["requirement-1"],
      nextState: "paused",
      stopReason: "panel_disconnected",
      resultFingerprint: fingerprintSixScreenValue("saved"),
      committedAt: t2,
    });
    const cancelled = cancelResearchTask(settled.task, {
      expectedRevision: 2,
      reason: "Researcher cancelled remaining work.",
      cancelledAt: "2026-09-12T10:00:03.000Z",
    });
    expect(cancelled.state).toBe("cancelled");
    expect(cancelled.completedWorkIds).toEqual(["definitions"]);
    expect(cancelled.usage).toEqual(settled.task.usage);
    expect(cancelled.pendingWorkIds).toEqual(["effective-date"]);
  });
});
