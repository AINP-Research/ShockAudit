import { describe, expect, it } from "vitest";

import {
  createHostReasoningTask,
  fingerprintHostReasoningValue,
  type HostReasoningTaskType,
} from "../../src/core/host-reasoning-task";
import { requireHostReasoningTaskAuditBundle } from
  "../../src/core/host-reasoning-audit";
import {
  HOST_REASONING_RUN_AUDIT_BUNDLE_MAX_BYTES,
  HOST_REASONING_RUN_AUDIT_BUNDLE_SCHEMA_VERSION,
  HOST_REASONING_RUN_AUDIT_BUNDLE_TYPE,
  HOST_REASONING_TASK_AUDIT_BUNDLE_SCHEMA_VERSION,
  HOST_REASONING_TASK_AUDIT_BUNDLE_TYPE,
  HostReasoningTaskStore,
  InMemoryHostReasoningTaskStoreBackend,
  projectHostReasoningTaskAuditBundle,
  requireHostReasoningTaskStoreRecord,
  type HostReasoningTaskStoreBackend,
} from "../../src/worker/host-reasoning-task-store";

const frozenSourcePassage =
  "PRIVATE FROZEN SOURCE PASSAGE: do not include in an audit bundle.";
const frozenAccessCredential =
  "PRIVATE ACCESS CREDENTIAL: do not include in an audit bundle.";
const frozenConversationContent =
  "PRIVATE CONVERSATION CONTENT: do not include in an audit bundle.";
const boundedInput = {
  study: { industry: "video games" },
  sourceIds: ["source-1"],
  sources: [{ sourceId: "source-1", passageText: frozenSourcePassage }],
  accessCredential: frozenAccessCredential,
  conversationContent: frozenConversationContent,
};

function screen02AuditReadyProposal(taskId: string) {
  return {
    schemaVersion: "shockaudit-screen02-host-review-result-v1",
    origin: "chatgpt-host",
    nonCanonical: true,
    review: {
      schemaVersion: "screen-02-pool-host-review-v1",
      taskId,
      capability: "screen-02-pool-review",
      profileAdditions: {
        services: ["PRIVATE PROPOSAL PROFILE ADDITION"],
      },
      candidateReviews: [{
        candidateId: "candidate-audit",
        proposedClass: "direct",
        industryBridge: "PRIVATE PROPOSAL INDUSTRY BRIDGE",
        profileTermsUsed: ["video games"],
        sourceIdsUsed: ["source-1"],
        sourceSpansUsed: [{
          sourceId: "source-1",
          text: "PRIVATE PROPOSAL SOURCE SPAN",
        }],
        sampleConnection: "PRIVATE PROPOSAL SAMPLE CONNECTION",
        outcomePathway: "PRIVATE PROPOSAL OUTCOME PATHWAY",
        mainMismatchOrUncertainty: "PRIVATE PROPOSAL UNCERTAINTY",
        needsFollowUpRetrieval: false,
        rankingAdjustment: 0,
      }],
      followUpQueries: ["PRIVATE PROPOSAL FOLLOW-UP QUERY"],
      officialSourceLeads: [{
        url: "https://www.federalregister.gov/documents/2026/09/03/example",
        title: "PRIVATE PROPOSAL SOURCE TITLE",
        issuingBody: "PRIVATE PROPOSAL ISSUING BODY",
        jurisdiction: "United States",
        reasonForRetrieval: "PRIVATE PROPOSAL RETRIEVAL REASON",
        candidateIdIfKnown: "candidate-audit",
      }],
      conciseRationale: "PRIVATE PROPOSAL RATIONALE",
      hostModel: "host_model_not_exposed",
    },
    // These canonical policy products are represented only by bounded counts
    // in the audit DTO, so their contents deliberately need no audit shape.
    enrichedProfile: { privateValue: "PRIVATE ENRICHED PROFILE" },
    rankings: [{ privateValue: "PRIVATE RANKING" }],
    outcomeValuesInspected: false,
  };
}

function task(input: {
  taskId: string;
  taskType?: HostReasoningTaskType;
  createdAt?: string;
  expiresAt?: string;
  retryCount?: 0 | 1;
  runId?: string;
}) {
  const taskType = input.taskType ?? "screen02-search-review";
  const screen03 = taskType !== "screen02-search-review";
  return createHostReasoningTask({
    taskId: input.taskId,
    taskType,
    screen: screen03 ? "screen-03" : "screen-02",
    runId: input.runId ?? "run-1",
    candidateId: null,
    candidatePoolId: screen03 ? null : "pool-1",
    selectedEventId: screen03 ? "event-1" : null,
    claimGroupId: taskType === "screen03-evidence-mapping"
      ? "claim-group-1"
      : null,
    scopeFingerprint: fingerprintHostReasoningValue("scope"),
    candidatePoolFingerprint: screen03
      ? null
      : fingerprintHostReasoningValue("pool"),
    eventFingerprint: screen03
      ? fingerprintHostReasoningValue("event")
      : null,
    sourcePoolFingerprint: fingerprintHostReasoningValue(["source-1"]),
    inputFingerprint: fingerprintHostReasoningValue(boundedInput),
    promptVersion: screen03 ? `${taskType}-prompt-v1` : "prompt-v1",
    workflowVersion: "workflow-v1",
    requiredSubmissionSchemaVersion: screen03
      ? `${taskType}-submission-v1`
      : "screen02-search-review-submission-v1",
    createdAt: input.createdAt ?? "2026-09-03T00:00:00.000Z",
    expiresAt: input.expiresAt ?? "2026-09-03T00:05:00.000Z",
    retryCount: input.retryCount ?? 0,
    appVersion: "0.4.4",
    uiResourceUri: "ui://shockaudit/workspace-v0.4.04.html",
    hostModel: "host_model_not_exposed",
  });
}

function store() {
  return new HostReasoningTaskStore(
    new InMemoryHostReasoningTaskStoreBackend(),
  );
}

function inspectableBackend() {
  const records = new Map<string, unknown>();
  const backend: HostReasoningTaskStoreBackend = {
    get: async (key) => records.has(key)
      ? structuredClone(records.get(key))
      : undefined,
    list: async ({ prefix, limit = Number.POSITIVE_INFINITY }) => new Map(
      [...records.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .sort(([left], [right]) => left.localeCompare(right))
        .slice(0, limit)
        .map(([key, value]) => [key, structuredClone(value)]),
    ),
    transaction: async (callback) => callback({
      get: async (key) => records.has(key)
        ? structuredClone(records.get(key))
        : undefined,
      put: async (key, value) => {
        records.set(key, structuredClone(value));
      },
      delete: async (key) => records.delete(key),
    }),
  };
  return { backend, records };
}

async function prepare(
  value: ReturnType<typeof task>,
  target = store(),
  operationId = `prepare-${value.taskId}`,
  retryOfTaskId: string | null = null,
) {
  return {
    target,
    result: await target.prepare({
      task: value,
      boundedInput,
      allowedSourceIds: ["source-1"],
      operationId,
      retryOfTaskId,
    }),
  };
}

describe("host reasoning task store", () => {
  it("replays preparation idempotently and refuses operation rebinding", async () => {
    const target = store();
    const first = await prepare(task({ taskId: "task-1" }), target, "operation-1");
    const second = await prepare(task({ taskId: "task-1" }), target, "operation-1");
    expect(first.result.outcome).toBe("created");
    expect(second.result.outcome).toBe("replayed");
    await expect(prepare(task({ taskId: "task-2" }), target, "operation-1"))
      .rejects.toThrow(/cannot be rebound/);
  });

  it("keeps only one active task per run and type", async () => {
    const target = store();
    await prepare(task({ taskId: "task-1" }), target);
    await prepare(task({
      taskId: "task-2",
      createdAt: "2026-09-03T00:00:01.000Z",
    }), target);
    const prior = await target.read("task-1");
    const active = await target.readActive("run-1", "screen02-search-review");
    expect(prior.outcome === "found" && prior.record.task.status).toBe("superseded");
    expect(active.outcome === "found" && active.record.task.taskId).toBe("task-2");
  });

  it("binds a message resolution to the exact durable request journal", async () => {
    const target = store();
    await prepare(task({ taskId: "task-journal" }), target);
    await expect(target.recordMessage({
      taskId: "task-journal",
      operationId: "request-journal",
      phase: "requested",
      channel: "ui/message",
      accepted: null,
      requestedAt: "2026-09-03T00:00:01.000Z",
      resolvedAt: null,
    })).resolves.toMatchObject({
      outcome: "updated",
      record: {
        task: {
          status: "message-requested",
          messageDeliveryStatus: "requested",
        },
      },
    });

    await expect(target.recordMessage({
      taskId: "task-journal",
      operationId: "wrong-request-owner",
      phase: "resolved",
      requestOperationId: "another-request-journal",
      channel: "ui/message",
      accepted: true,
      requestedAt: "2026-09-03T00:00:01.000Z",
      resolvedAt: "2026-09-03T00:00:02.000Z",
    })).rejects.toThrow(/does not own the durable request journal/);
    await expect(target.recordMessage({
      taskId: "task-journal",
      operationId: "wrong-request-route",
      phase: "resolved",
      requestOperationId: "request-journal",
      channel: "sendFollowUpMessage",
      accepted: true,
      requestedAt: "2026-09-03T00:00:01.000Z",
      resolvedAt: "2026-09-03T00:00:02.000Z",
    })).rejects.toThrow(/journaled request coordinates/);
    const unchanged = await target.read("task-journal");
    expect(unchanged.outcome === "found" && unchanged.record.task).toMatchObject({
      status: "message-requested",
      messageChannel: "ui/message",
      messageRequestedAt: "2026-09-03T00:00:01.000Z",
    });

    await expect(target.recordMessage({
      taskId: "task-journal",
      operationId: "resolve-journal",
      phase: "resolved",
      requestOperationId: "request-journal",
      channel: "ui/message",
      accepted: true,
      requestedAt: "2026-09-03T00:00:01.500Z",
      resolvedAt: "2026-09-03T00:00:02.000Z",
    })).resolves.toMatchObject({
      outcome: "updated",
      record: { task: { status: "awaiting-submission" } },
    });

    const uncommitted = store();
    await prepare(task({ taskId: "task-uncommitted-request" }), uncommitted);
    await expect(uncommitted.recordMessage({
      taskId: "task-uncommitted-request",
      operationId: "resolve-uncommitted-request",
      phase: "resolved",
      requestOperationId: "missing-request-journal",
      channel: "ui/message",
      accepted: false,
      requestedAt: "2026-09-03T00:00:01.000Z",
      resolvedAt: "2026-09-03T00:00:02.000Z",
      failureCode: "host-message-journal-unavailable",
      failureExplanation: "The request journal was not committed.",
    })).rejects.toThrow(/legacy message resolution cannot name a request journal/);
    const preserved = await uncommitted.read("task-uncommitted-request");
    expect(preserved.outcome === "found" && preserved.record.task.status)
      .toBe("prepared");
  });

  it("preserves the v1 delivery operation identity for resolved-call replays", async () => {
    const target = store();
    await prepare(task({ taskId: "task-v1-delivery" }), target);
    const legacyInput = {
      taskId: "task-v1-delivery",
      operationId: "v1-delivery-operation",
      channel: "ui/message" as const,
      accepted: true,
      requestedAt: "2026-09-03T00:00:01.000Z",
      resolvedAt: "2026-09-03T00:00:02.000Z",
    };
    const first = await target.recordMessage(legacyInput);
    const replay = await target.recordMessage({
      ...legacyInput,
      phase: "resolved",
    });
    expect(first.outcome).toBe("updated");
    expect(replay.outcome).toBe("replayed");
    expect(first.outcome === "updated" && first.record.operationReplays.at(-1))
      .toMatchObject({ operationKind: "record-message-delivery" });
    expect(first.outcome === "updated" && first.record.task).toMatchObject({
      messageRequestedAt: "2026-09-03T00:00:01.000Z",
      messageAcceptedAt: "2026-09-03T00:00:02.000Z",
    });
    expect(first.outcome === "updated" && first.record.lifecycle.slice(-3))
      .toMatchObject([
        { to: "message-requested", at: "2026-09-03T00:00:01.000Z" },
        { to: "message-accepted", at: "2026-09-03T00:00:02.000Z" },
        { to: "awaiting-submission", at: "2026-09-03T00:00:02.000Z" },
      ]);
  });

  it("atomically applies one submission and replays only the identical one", async () => {
    const target = store();
    await prepare(task({ taskId: "task-1" }), target);
    await target.recordMessage({
      taskId: "task-1",
      operationId: "delivery-1",
      channel: "ui/message",
      accepted: true,
      requestedAt: "2026-09-03T00:00:01.000Z",
      resolvedAt: "2026-09-03T00:00:02.000Z",
    });
    const submissionFingerprint = fingerprintHostReasoningValue("submission-1");
    const first = await target.applySubmission({
      taskId: "task-1",
      operationId: "submission-operation-1",
      capabilityId: "capability-1",
      submissionFingerprint,
      proposal: { bridges: [{ text: "A bounded source-supported bridge." }] },
      sourceIdsReferenced: ["source-1"],
      resultId: "result-1",
      receivedAt: "2026-09-03T00:00:03.000Z",
      appliedAt: "2026-09-03T00:00:04.000Z",
    });
    const replay = await target.applySubmission({
      taskId: "task-1",
      operationId: "submission-operation-2",
      capabilityId: "capability-1",
      submissionFingerprint,
      proposal: { bridges: [{ text: "A bounded source-supported bridge." }] },
      sourceIdsReferenced: ["source-1"],
      resultId: "result-1",
      receivedAt: "2026-09-03T00:00:05.000Z",
      appliedAt: "2026-09-03T00:00:06.000Z",
    });
    const competing = await target.applySubmission({
      taskId: "task-1",
      operationId: "submission-operation-3",
      capabilityId: "capability-2",
      submissionFingerprint: fingerprintHostReasoningValue("submission-2"),
      proposal: { bridges: [] },
      sourceIdsReferenced: [],
      resultId: "result-2",
      receivedAt: "2026-09-03T00:00:05.000Z",
      appliedAt: "2026-09-03T00:00:06.000Z",
    });
    expect(first.outcome).toBe("updated");
    expect(replay.outcome).toBe("replayed");
    expect(competing.outcome).toBe("terminal");
    expect(first.outcome === "updated" && first.record.task.status).toBe("applied");
    expect(first.outcome === "updated" && first.record.task.outcomeValuesInspected)
      .toBe(false);
    expect(first.outcome === "updated" && first.record.panelReconciliation.status)
      .toBe("pending");
  });

  it("refuses cancellation of a consumed journal and preserves exact finalization", async () => {
    const target = store();
    await prepare(task({ taskId: "task-reserved" }), target);
    await target.recordMessage({
      taskId: "task-reserved",
      operationId: "delivery-reserved",
      channel: "ui/message",
      accepted: true,
      requestedAt: "2026-09-03T00:00:01.000Z",
      resolvedAt: "2026-09-03T00:00:02.000Z",
    });
    const submissionFingerprint = fingerprintHostReasoningValue(
      "reserved-submission",
    );
    const reserved = await target.reserveSubmission({
      taskId: "task-reserved",
      operationId: "reserve-application",
      capabilityId: "capability-reserved",
      submissionFingerprint,
      proposal: { bridges: [{ text: "A bounded source-supported bridge." }] },
      sourceIdsReferenced: ["source-1"],
      receivedAt: "2026-09-03T00:00:03.000Z",
    });
    if (reserved.outcome !== "updated") throw new Error("Reservation failed.");

    const refused = await target.cancel({
      taskId: "task-reserved",
      // Even an operation-ID collision cannot reinterpret or erase the
      // already-consumed application journal.
      operationId: "reserve-application",
      at: "2026-09-03T00:00:04.000Z",
      reason: "Do not erase a possibly committed application journal.",
    });
    expect(refused).toMatchObject({
      outcome: "terminal",
      record: { task: { status: "validating", failureCode: null } },
    });
    const preserved = await target.read("task-reserved");
    expect(preserved.outcome === "found" && preserved.record.lifecycle)
      .toEqual(reserved.record.lifecycle);
    expect(preserved.outcome === "found" && preserved.record.operationReplays)
      .toEqual(reserved.record.operationReplays);
    expect(preserved.outcome === "found" && preserved.record).toMatchObject({
      capabilityIdConsumed: "capability-reserved",
      submissionFingerprint,
      proposal: reserved.record.proposal,
    });

    const finalized = await target.finalizeSubmissionApplied({
      taskId: "task-reserved",
      operationId: "finalize-reserved",
      capabilityId: "capability-reserved",
      submissionFingerprint,
      resultId: "result-reserved",
      appliedAt: "2026-09-03T00:00:05.000Z",
    });
    expect(finalized).toMatchObject({
      outcome: "updated",
      record: {
        task: { status: "applied", resultId: "result-reserved" },
      },
    });
  });

  it("projects a finite applied-task audit bundle without frozen input or secrets", async () => {
    const target = store();
    await prepare(task({ taskId: "task-audit" }), target, "secret-prepare-operation");
    await target.recordMessage({
      taskId: "task-audit",
      operationId: "secret-delivery-operation",
      channel: "ui/message",
      accepted: true,
      requestedAt: "2026-09-03T00:00:01.000Z",
      resolvedAt: "2026-09-03T00:00:02.000Z",
    });
    const proposal = screen02AuditReadyProposal("task-audit");
    const projectedProposal = {
      type: "screen02-search-review",
      normalizedSchemaVersion: "shockaudit-screen02-host-review-result-v1",
      origin: "chatgpt-host",
      nonCanonical: true,
      profileAdditionFields: ["services"],
      candidateReviews: [{
        candidateId: "candidate-audit",
        proposedClass: "direct",
        sourceIdsUsed: ["source-1"],
        sourceSpanSourceIds: ["source-1"],
        needsFollowUpRetrieval: false,
        rankingAdjustment: 0,
      }],
      followUpQueryCount: 1,
      officialSourceLeadCount: 1,
      rankingCount: 1,
      outcomeValuesInspected: false,
    };
    const submissionFingerprint = fingerprintHostReasoningValue(
      "audit-submission",
    );
    const applied = await target.applySubmission({
      taskId: "task-audit",
      operationId: "secret-submission-operation",
      capabilityId: "secret-capability-id",
      submissionFingerprint,
      proposal,
      sourceIdsReferenced: ["source-1"],
      resultId: "result-audit",
      receivedAt: "2026-09-03T00:00:03.000Z",
      appliedAt: "2026-09-03T00:00:04.000Z",
    });
    expect(applied.outcome).toBe("updated");
    if (applied.outcome !== "updated") return;

    const bundle = projectHostReasoningTaskAuditBundle(applied.record);
    expect(bundle).toEqual(expect.objectContaining({
      schemaVersion: HOST_REASONING_TASK_AUDIT_BUNDLE_SCHEMA_VERSION,
      type: HOST_REASONING_TASK_AUDIT_BUNDLE_TYPE,
      task: expect.objectContaining({
        taskId: "task-audit",
        taskType: "screen02-search-review",
        screen: "screen-02",
        status: "applied",
        coordinates: expect.objectContaining({
          runId: "run-1",
          candidatePoolId: "pool-1",
          scopeFingerprint: expect.any(String),
          sourcePoolFingerprint: expect.any(String),
        }),
        promptVersion: "prompt-v1",
        workflowVersion: "workflow-v1",
        requiredSubmissionSchemaVersion:
          "screen02-search-review-submission-v1",
      }),
      release: {
        appVersion: "0.4.4",
        uiResourceUri: "ui://shockaudit/workspace-v0.4.04.html",
      },
      message: {
        channel: "ui/message",
        disposition: "accepted",
        requestedAt: "2026-09-03T00:00:01.000Z",
        resolvedAt: "2026-09-03T00:00:02.000Z",
        acceptedAt: "2026-09-03T00:00:02.000Z",
      },
      retry: { retryCount: 0, retryOfTaskId: null },
      submission: {
        disposition: "received",
        receivedAt: "2026-09-03T00:00:03.000Z",
      },
      validation: {
        disposition: "accepted",
        validatedAt: "2026-09-03T00:00:04.000Z",
      },
      application: {
        disposition: "applied",
        resultOrigin: "chatgpt-host",
        resultId: "result-audit",
        appliedAt: "2026-09-03T00:00:04.000Z",
      },
      failure: { stage: null },
      fingerprints: {
        input: applied.record.task.inputFingerprint,
        auditProposal: fingerprintHostReasoningValue({
          schemaVersion: "shockaudit-host-audit-proposal-fingerprint-v1",
          taskType: "screen02-search-review",
          proposal: projectedProposal,
        }),
      },
      sourceIds: { allowed: ["source-1"], referenced: ["source-1"] },
      lifecycle: applied.record.lifecycle.map((event) => ({
        from: event.from,
        to: event.to,
        at: event.at,
        failed: event.failureCode !== null,
      })),
      panelReconciliation: {
        status: "pending",
        lastCheckedAt: null,
        reconciledAt: null,
        failed: false,
      },
      proposal: projectedProposal,
      outcomeValuesInspected: false,
    }));
    expect(bundle).not.toHaveProperty("boundedInput");
    expect(bundle).not.toHaveProperty("capabilityIdConsumed");
    expect(bundle).not.toHaveProperty("operationReplays");
    const serialized = JSON.stringify(bundle);
    for (const omitted of [
      frozenSourcePassage,
      frozenAccessCredential,
      frozenConversationContent,
      "secret-capability-id",
      "secret-prepare-operation",
      "secret-delivery-operation",
      "secret-submission-operation",
      "PRIVATE PROPOSAL SOURCE SPAN",
      "PRIVATE PROPOSAL INDUSTRY BRIDGE",
      "PRIVATE PROPOSAL SAMPLE CONNECTION",
      "PRIVATE PROPOSAL OUTCOME PATHWAY",
      "PRIVATE PROPOSAL UNCERTAINTY",
      "PRIVATE PROPOSAL FOLLOW-UP QUERY",
      "PRIVATE PROPOSAL SOURCE TITLE",
      "PRIVATE PROPOSAL ISSUING BODY",
      "PRIVATE PROPOSAL RETRIEVAL REASON",
      "PRIVATE PROPOSAL RATIONALE",
      "PRIVATE ENRICHED PROFILE",
      "PRIVATE RANKING",
    ]) {
      expect(serialized).not.toContain(omitted);
    }
    expect(serialized).not.toContain("https://");

    if (bundle.proposal?.type !== "screen02-search-review") {
      throw new Error("Expected a Screen 2 audit projection.");
    }
    bundle.proposal.candidateReviews[0]!.rankingAdjustment = 1;
    bundle.sourceIds.referenced.push("mutated-source");
    bundle.lifecycle[0]!.failed = true;
    const projectedAgain = projectHostReasoningTaskAuditBundle(applied.record);
    expect(projectedAgain.proposal).toEqual(projectedProposal);
    expect(projectedAgain.sourceIds.referenced).toEqual(["source-1"]);
    expect(projectedAgain.lifecycle[0]?.failed).toBe(false);
    expect(() => projectHostReasoningTaskAuditBundle({
      ...applied.record,
      unexpected: true,
    })).toThrow(/stored host-reasoning task is malformed/i);
  });

  it("projects validation failure stage and code without its explanation", async () => {
    const target = store();
    await prepare(task({ taskId: "task-audit-failure" }), target);
    await target.recordMessage({
      taskId: "task-audit-failure",
      operationId: "delivery-audit-failure",
      channel: "sendFollowUpMessage",
      accepted: true,
      requestedAt: "2026-09-03T00:00:01.000Z",
      resolvedAt: "2026-09-03T00:00:02.000Z",
    });
    const failureExplanation =
      "PRIVATE FAILURE EXPLANATION: omit this diagnostic narrative.";
    const rejected = await target.rejectSubmission({
      taskId: "task-audit-failure",
      operationId: "reject-audit-failure",
      capabilityId: "failure-capability-id",
      submissionFingerprint: fingerprintHostReasoningValue("failed-submission"),
      receivedAt: "2026-09-03T00:00:03.000Z",
      validatedAt: "2026-09-03T00:00:04.000Z",
      failureCode: "unknown-source",
      failureExplanation,
    });
    expect(rejected.outcome).toBe("updated");
    if (rejected.outcome !== "updated") return;

    const bundle = projectHostReasoningTaskAuditBundle(rejected.record);
    expect(bundle.validation).toEqual({
      disposition: "rejected",
      validatedAt: "2026-09-03T00:00:04.000Z",
    });
    expect(bundle.application).toEqual({
      disposition: "not-reached",
      resultOrigin: null,
      resultId: null,
      appliedAt: null,
    });
    expect(bundle.failure).toEqual({ stage: "validation" });
    expect(JSON.stringify(bundle)).not.toContain(failureExplanation);
    expect(JSON.stringify(bundle)).not.toContain("failure-capability-id");
  });

  it("distinguishes validated application failure and enforces exact audit stages", async () => {
    const target = store();
    await prepare(task({ taskId: "task-application-failure" }), target);
    await target.recordMessage({
      taskId: "task-application-failure",
      operationId: "delivery-application-failure",
      channel: "ui/message",
      accepted: true,
      requestedAt: "2026-09-03T00:00:01.000Z",
      resolvedAt: "2026-09-03T00:00:02.000Z",
    });
    const submissionFingerprint = fingerprintHostReasoningValue(
      "application-failure-submission",
    );
    const reserved = await target.reserveSubmission({
      taskId: "task-application-failure",
      operationId: "reserve-application-failure",
      capabilityId: "application-failure-capability",
      submissionFingerprint,
      proposal: screen02AuditReadyProposal("task-application-failure"),
      sourceIdsReferenced: ["source-1"],
      receivedAt: "2026-09-03T00:00:03.000Z",
    });
    expect(reserved.outcome).toBe("updated");
    const failed = await target.finalizeSubmissionFailed({
      taskId: "task-application-failure",
      operationId: "finalize-application-failure",
      capabilityId: "application-failure-capability",
      submissionFingerprint,
      validatedAt: "2026-09-03T00:00:04.000Z",
      failureCode: "application-coordinate-stale",
      failureExplanation: "PRIVATE APPLICATION FAILURE EXPLANATION",
    });
    expect(failed.outcome).toBe("updated");
    if (failed.outcome !== "updated") return;
    const bundle = projectHostReasoningTaskAuditBundle(failed.record);
    expect(bundle.validation).toEqual({
      disposition: "accepted",
      validatedAt: "2026-09-03T00:00:04.000Z",
    });
    expect(bundle.application).toEqual({
      disposition: "failed",
      resultOrigin: "chatgpt-host",
      resultId: null,
      appliedAt: null,
    });
    expect(bundle.failure).toEqual({ stage: "application" });
    expect(JSON.stringify(bundle)).not.toContain(
      "PRIVATE APPLICATION FAILURE EXPLANATION",
    );

    expect(() => requireHostReasoningTaskAuditBundle({
      ...bundle,
      validation: { disposition: "rejected", validatedAt: bundle.validation.validatedAt },
    })).toThrow(/stage dispositions/i);
    expect(() => requireHostReasoningTaskAuditBundle({
      ...bundle,
      panelReconciliation: {
        status: "pending",
        lastCheckedAt: "2026-09-03T00:00:04.000Z",
        reconciledAt: null,
        failed: false,
      },
    })).toThrow(/panel reconciliation lifecycle/i);
  });

  it("exports one bounded sanitized audit bundle for only the requested run", async () => {
    const target = store();
    await prepare(task({
      taskId: "task-later",
      createdAt: "2026-09-03T00:00:02.000Z",
    }), target);
    await prepare(task({
      taskId: "task-earlier",
      taskType: "screen03-overview-improvement",
      createdAt: "2026-09-03T00:00:01.000Z",
    }), target);
    await prepare(task({
      taskId: "task-other-run",
      runId: "run-2",
    }), target);

    const bundle = await target.exportRunAuditBundle("run-1");
    expect(bundle).toMatchObject({
      schemaVersion: HOST_REASONING_RUN_AUDIT_BUNDLE_SCHEMA_VERSION,
      type: HOST_REASONING_RUN_AUDIT_BUNDLE_TYPE,
      runId: "run-1",
      includedTaskCount: 2,
      truncated: false,
      outcomeValuesInspected: false,
    });
    expect(bundle.tasks.map((entry) => entry.task.taskId)).toEqual([
      "task-earlier",
      "task-later",
    ]);
    const serialized = JSON.stringify(bundle);
    expect(new TextEncoder().encode(serialized).byteLength).toBeLessThanOrEqual(
      HOST_REASONING_RUN_AUDIT_BUNDLE_MAX_BYTES,
    );
    expect(serialized).not.toContain("task-other-run");
    expect(serialized).not.toContain(frozenSourcePassage);
    expect(serialized).not.toContain(frozenAccessCredential);
    expect(serialized).not.toContain(frozenConversationContent);
    expect(serialized).not.toContain("host-reasoning-run-v2:");
    expect(serialized).not.toContain("capabilityIdConsumed");
    expect(serialized).not.toContain("operationReplays");
    expect(serialized).not.toContain("https://");

    const limited = await target.exportRunAuditBundle("run-1", 1);
    expect(limited).toMatchObject({
      includedTaskCount: 1,
      truncated: true,
    });
    await expect(target.exportRunAuditBundle("run-1", 0)).rejects.toThrow(
      /audit export limit is invalid/i,
    );
  });

  it("encodes run-index coordinates and sorts before requested truncation", async () => {
    const harness = inspectableBackend();
    const target = new HostReasoningTaskStore(harness.backend);
    for (const [taskId, createdAt, taskType] of [
      ["task-middle", "2026-09-03T00:00:02.000Z", "screen02-search-review"],
      ["task-latest", "2026-09-03T00:00:03.000Z", "screen03-evidence-mapping"],
      ["task-earliest", "2026-09-03T00:00:01.000Z", "screen03-overview-improvement"],
    ] as const) {
      await prepare(task({ taskId, createdAt, taskType, runId: "run:encoded" }), target);
    }
    expect([...harness.records.keys()].some((key) =>
      key.startsWith("host-reasoning-run-v2:run%3Aencoded:")
    )).toBe(true);
    expect([...harness.records.keys()].some((key) =>
      key.startsWith("host-reasoning-run-v2:run:encoded:")
    )).toBe(false);

    const list = harness.backend.list.bind(harness.backend);
    harness.backend.list = async (input) => {
      const values = await list({ ...input, limit: 33 });
      return new Map([...values.entries()].reverse().slice(0, input.limit));
    };
    const bundle = await target.exportRunAuditBundle("run:encoded", 1);
    expect(bundle.tasks.map((entry) => entry.task.taskId)).toEqual([
      "task-earliest",
    ]);
    expect(bundle.truncated).toBe(true);

    await expect(target.retireRun("run:encoded", 3)).resolves.toEqual({
      removed: 3,
      batchLimitReached: false,
    });
    expect([...harness.records.keys()].some((key) =>
      key.startsWith("host-reasoning-run-v2:run%3Aencoded:")
    )).toBe(false);
  });

  it("retires retained v1 run indexes after the collision-safe v2 upgrade", async () => {
    const harness = inspectableBackend();
    const target = new HostReasoningTaskStore(harness.backend);
    const legacyRunId = "legacy-run";
    const legacyTask = task({
      taskId: "legacy-screen03-task",
      taskType: "screen03-evidence-mapping",
      runId: legacyRunId,
    });
    await prepare(legacyTask, target);

    const currentRunIndex = [...harness.records.keys()].find((key) =>
      key.startsWith(`host-reasoning-run-v2:${legacyRunId}:`)
    );
    const currentTypeIndex = [...harness.records.keys()].find((key) =>
      key.startsWith(
        `host-reasoning-run-task-type-v2:${legacyRunId}:screen03-evidence-mapping:`,
      )
    );
    expect(currentRunIndex).toBeDefined();
    expect(currentTypeIndex).toBeDefined();
    if (!currentRunIndex || !currentTypeIndex) {
      throw new Error("Expected current host-task run indexes.");
    }
    harness.records.delete(currentRunIndex);
    harness.records.delete(currentTypeIndex);
    harness.records.set(
      `host-reasoning-run-v1:${legacyRunId}:${legacyTask.taskId}`,
      legacyTask.taskId,
    );
    harness.records.set(
      `host-reasoning-run-task-type-v1:${legacyRunId}:${legacyTask.taskType}:${legacyTask.taskId}`,
      legacyTask.taskId,
    );

    await expect(target.retireRunTaskTypes(legacyRunId, [
      "screen03-evidence-mapping",
    ])).resolves.toEqual({ removed: 1, batchLimitReached: false });
    expect((await target.read(legacyTask.taskId)).outcome).toBe("not-found");
    expect([...harness.records.keys()].some((key) =>
      key.startsWith(`host-reasoning-run-v1:${legacyRunId}:`) ||
      key.startsWith(`host-reasoning-run-task-type-v1:${legacyRunId}:`)
    )).toBe(false);
  });

  it("keeps an applied result canonical when panel reconciliation fails", async () => {
    const target = store();
    await prepare(task({ taskId: "task-1" }), target);
    await target.recordMessage({
      taskId: "task-1",
      operationId: "delivery-1",
      channel: "ui/message",
      accepted: true,
      requestedAt: "2026-09-03T00:00:01.000Z",
      resolvedAt: "2026-09-03T00:00:02.000Z",
    });
    await target.applySubmission({
      taskId: "task-1",
      operationId: "submission-1",
      capabilityId: "capability-1",
      submissionFingerprint: fingerprintHostReasoningValue("submission-1"),
      proposal: screen02AuditReadyProposal("task-1"),
      sourceIdsReferenced: ["source-1"],
      resultId: "result-1",
      receivedAt: "2026-09-03T00:00:03.000Z",
      appliedAt: "2026-09-03T00:00:04.000Z",
    });
    const failed = await target.recordPanelReconciliation({
      taskId: "task-1",
      operationId: "panel-check-1",
      reconciled: false,
      checkedAt: "2026-09-03T00:00:45.000Z",
      failureCode: "panel-timeout",
      failureExplanation: "The bounded panel checks ended before reconciliation.",
    });
    expect(failed.outcome).toBe("updated");
    expect(failed.outcome === "updated" && failed.record.task.status).toBe("applied");
    expect(failed.outcome === "updated" && failed.record.task.failureCode).toBeNull();
    expect(failed.outcome === "updated" && failed.record.panelReconciliation)
      .toMatchObject({ status: "failed", failureCode: "panel-timeout" });
    if (failed.outcome !== "updated") return;
    expect(projectHostReasoningTaskAuditBundle(failed.record).panelReconciliation)
      .toEqual({
        status: "failed",
        lastCheckedAt: "2026-09-03T00:00:45.000Z",
        reconciledAt: null,
        failed: true,
      });
    const reconciled = await target.recordPanelReconciliation({
      taskId: "task-1",
      operationId: "panel-check-2",
      reconciled: true,
      checkedAt: "2026-09-03T00:00:46.000Z",
    });
    expect(reconciled.outcome).toBe("updated");
    if (reconciled.outcome !== "updated") return;
    expect(projectHostReasoningTaskAuditBundle(reconciled.record).panelReconciliation)
      .toEqual({
        status: "reconciled",
        lastCheckedAt: "2026-09-03T00:00:46.000Z",
        reconciledAt: "2026-09-03T00:00:46.000Z",
        failed: false,
      });
    const replayed = await target.recordPanelReconciliation({
      taskId: "task-1",
      operationId: "panel-check-2",
      reconciled: true,
      // Observation time is metadata, not semantic operation input.
      checkedAt: "2026-09-03T00:01:46.000Z",
    });
    expect(replayed.outcome).toBe("replayed");
    expect(replayed.outcome === "replayed" && replayed.record.panelReconciliation)
      .toEqual(reconciled.record.panelReconciliation);

    const duplicateSuccess = await target.recordPanelReconciliation({
      taskId: "task-1",
      operationId: "panel-check-duplicate-success",
      reconciled: true,
      checkedAt: "2026-09-03T00:02:16.000Z",
    });
    expect(duplicateSuccess.outcome).toBe("terminal");
    expect(
      duplicateSuccess.outcome === "terminal" &&
        duplicateSuccess.record.panelReconciliation,
    ).toEqual(reconciled.record.panelReconciliation);

    const lateFailure = await target.recordPanelReconciliation({
      taskId: "task-1",
      operationId: "panel-check-late-failure",
      reconciled: false,
      checkedAt: "2026-09-03T00:02:46.000Z",
      failureCode: "panel-timeout",
      failureExplanation:
        "A delayed client timeout must not replace a successful acknowledgement.",
    });
    expect(lateFailure.outcome).toBe("terminal");
    expect(
      lateFailure.outcome === "terminal" &&
        lateFailure.record.panelReconciliation,
    ).toEqual(reconciled.record.panelReconciliation);
  });

  it("persists a categorized validation failure and consumes the capability", async () => {
    const target = store();
    await prepare(task({ taskId: "task-1" }), target);
    await target.recordMessage({
      taskId: "task-1",
      operationId: "delivery-1",
      channel: "ui/message",
      accepted: true,
      requestedAt: "2026-09-03T00:00:01.000Z",
      resolvedAt: "2026-09-03T00:00:02.000Z",
    });
    const submissionFingerprint = fingerprintHostReasoningValue("malformed-1");
    const rejected = await target.rejectSubmission({
      taskId: "task-1",
      operationId: "reject-1",
      capabilityId: "capability-1",
      submissionFingerprint,
      receivedAt: "2026-09-03T00:00:03.000Z",
      validatedAt: "2026-09-03T00:00:04.000Z",
      failureCode: "unknown-source",
      failureExplanation: "The submission cited a source outside the frozen pool.",
    });
    const replay = await target.rejectSubmission({
      taskId: "task-1",
      operationId: "reject-2",
      capabilityId: "capability-1",
      submissionFingerprint,
      receivedAt: "2026-09-03T00:00:05.000Z",
      validatedAt: "2026-09-03T00:00:06.000Z",
      failureCode: "unknown-source",
      failureExplanation: "The submission cited a source outside the frozen pool.",
    });
    expect(rejected.outcome).toBe("updated");
    expect(rejected.outcome === "updated" && rejected.record.task)
      .toMatchObject({ status: "validation-failed", failureCode: "unknown-source" });
    expect(replay.outcome).toBe("replayed");
  });

  it("allows exactly one matching explicit retry", async () => {
    const target = store();
    await prepare(task({ taskId: "task-1" }), target);
    await target.recordMessage({
      taskId: "task-1",
      operationId: "delivery-1",
      channel: "ui/message",
      accepted: false,
      requestedAt: "2026-09-03T00:00:01.000Z",
      resolvedAt: "2026-09-03T00:00:02.000Z",
    });
    const retry = await prepare(task({
      taskId: "task-2",
      retryCount: 1,
      createdAt: "2026-09-03T00:00:03.000Z",
      expiresAt: "2026-09-03T00:05:03.000Z",
    }), target, "prepare-retry", "task-1");
    expect(retry.result.outcome).toBe("created");
    if (retry.result.outcome !== "created") throw new Error("Retry was not created.");
    expect(retry.result.record.retryOfTaskId).toBe("task-1");
    await expect(prepare(task({
      taskId: "task-duplicate-retry",
      retryCount: 1,
      createdAt: "2026-09-03T00:00:04.000Z",
      expiresAt: "2026-09-03T00:05:04.000Z",
    }), target, "prepare-duplicate-retry", "task-1"))
      .rejects.toThrow(/only one explicit retry/);
    await target.recordMessage({
      taskId: "task-2",
      operationId: "delivery-retry",
      channel: "unavailable",
      accepted: false,
      requestedAt: "2026-09-03T00:00:03.500Z",
      resolvedAt: "2026-09-03T00:00:03.750Z",
    });
    const exhausted = await prepare(task({
      taskId: "task-3",
      retryCount: 1,
      createdAt: "2026-09-03T00:00:04.000Z",
      expiresAt: "2026-09-03T00:05:04.000Z",
    }), target, "prepare-retry-2", "task-2");
    expect(exhausted.result).toMatchObject({
      outcome: "retry-exhausted",
      record: {
        task: {
          taskId: "task-2",
          status: "retry-exhausted",
          retryCount: 1,
          failureCode: "retry-exhausted",
        },
      },
    });
  });

  it("expires active work through the bounded cleanup path", async () => {
    const target = store();
    await prepare(task({
      taskId: "task-1",
      expiresAt: "2026-09-03T00:00:10.000Z",
    }), target);
    expect(await target.cleanupExpired("2026-09-03T00:00:10.000Z")).toBe(1);
    const read = await target.read("task-1");
    expect(read.outcome === "found" && read.record.task.status).toBe("expired");
    expect((await target.readActive("run-1", "screen02-search-review")).outcome)
      .toBe("not-found");
  });

  it("repairs malformed expiry rows instead of re-arming a hot loop", async () => {
    const harness = inspectableBackend();
    const target = new HostReasoningTaskStore(harness.backend);
    await prepare(task({ taskId: "task-1" }), target);
    const canonicalExpiryKey = [...harness.records.keys()].find((key) =>
      key.startsWith("host-reasoning-expiry-v1:")
    );
    if (!canonicalExpiryKey) throw new Error("Expected the canonical expiry index.");
    harness.records.delete(canonicalExpiryKey);
    harness.records.set(
      "host-reasoning-expiry-v1:not-a-time|task-1",
      "task-1",
    );

    expect(await target.nextExpirationAt()).toBe("1970-01-01T00:00:00.000Z");
    expect(await target.cleanupExpired("2026-09-03T00:00:01.000Z")).toBe(1);
    expect(await target.nextExpirationAt()).toBe("2026-09-03T00:05:00.000Z");
    expect((await target.read("task-1")).outcome).toBe("found");
    expect([...harness.records.keys()]).not.toContain(
      "host-reasoning-expiry-v1:not-a-time|task-1",
    );

    harness.records.set("host-reasoning-expiry-v1:unrecoverable", 42);
    expect(await target.cleanupExpired("2026-09-03T00:00:02.000Z")).toBe(1);
    expect([...harness.records.keys()]).not.toContain(
      "host-reasoning-expiry-v1:unrecoverable",
    );
  });

  it("preserves a crash-stranded reservation for exact late reconciliation", async () => {
    const target = store();
    const prepared = await prepare(task({
      taskId: "task-1",
      expiresAt: "2026-09-03T00:00:10.000Z",
    }), target);
    if (!("record" in prepared.result)) {
      throw new Error("Host task was not prepared.");
    }
    expect(projectHostReasoningTaskAuditBundle(
      prepared.result.record,
    ).application).toEqual({
      disposition: "not-reached",
      resultOrigin: null,
      resultId: null,
      appliedAt: null,
    });
    await target.recordMessage({
      taskId: "task-1",
      operationId: "delivery-1",
      channel: "ui/message",
      accepted: true,
      requestedAt: "2026-09-03T00:00:01.000Z",
      resolvedAt: "2026-09-03T00:00:02.000Z",
    });
    const submissionFingerprint = fingerprintHostReasoningValue("submission-1");
    const reserved = await target.reserveSubmission({
      taskId: "task-1",
      operationId: "reserve-1",
      capabilityId: "capability-1",
      submissionFingerprint,
      proposal: screen02AuditReadyProposal("task-1"),
      sourceIdsReferenced: ["source-1"],
      receivedAt: "2026-09-03T00:00:03.000Z",
    });

    expect(reserved.outcome).toBe("updated");
    expect(reserved.outcome === "updated" && reserved.record.task.status)
      .toBe("validating");
    if (reserved.outcome !== "updated") throw new Error("Reservation failed.");
    expect(projectHostReasoningTaskAuditBundle(
      reserved.record,
    ).application).toEqual({
      disposition: "pending",
      resultOrigin: "chatgpt-host",
      resultId: null,
      appliedAt: null,
    });
    expect(() => requireHostReasoningTaskStoreRecord({
      ...reserved.record,
      proposal: null,
      sourceIdsReferenced: [],
    })).toThrow(/reservation state disagree/);
    expect((await target.readActive("run-1", "screen02-search-review")).outcome)
      .toBe("found");

    expect(await target.cleanupExpired("2026-09-03T00:00:10.000Z")).toBe(1);
    expect(await target.nextExpirationAt()).toBeNull();
    const journal = await target.read("task-1");
    expect(journal.outcome === "found" && journal.record.task).toMatchObject({
      status: "validating",
      submissionReceivedAt: "2026-09-03T00:00:03.000Z",
      validatedAt: null,
      failureCode: null,
    });
    expect(await target.expireIfDue(
      "task-1",
      "2026-09-03T00:00:11.000Z",
    )).toMatchObject({ outcome: "replayed", record: { task: { status: "validating" } } });
    expect((await target.readActive("run-1", "screen02-search-review")).outcome)
      .toBe("found");
    const lateFinalize = await target.finalizeSubmissionApplied({
      taskId: "task-1",
      operationId: "finalize-late",
      capabilityId: "capability-1",
      submissionFingerprint,
      resultId: "result-1",
      appliedAt: "2026-09-03T00:00:09.000Z",
    });
    expect(lateFinalize.outcome).toBe("updated");
    expect(lateFinalize.outcome === "updated" && lateFinalize.record.task.status)
      .toBe("applied");
    expect((await target.readActive("run-1", "screen02-search-review")).outcome)
      .toBe("not-found");
  });

  it("exposes the next expiration and retires a run in a bounded cascade", async () => {
    const target = store();
    await prepare(task({
      taskId: "task-1",
      expiresAt: "2026-09-03T00:01:00.000Z",
    }), target);
    expect(await target.nextExpirationAt()).toBe("2026-09-03T00:01:00.000Z");
    expect(await target.retireRun("run-1")).toEqual({
      removed: 1,
      batchLimitReached: false,
    });
    expect((await target.read("task-1")).outcome).toBe("not-found");
    expect(await target.nextExpirationAt()).toBeNull();
  });

  it("retires more than 64 Screen 3 tasks in bounded batches while preserving an applied Screen 2 result", async () => {
    const harness = inspectableBackend();
    const target = new HostReasoningTaskStore(harness.backend);
    await prepare(task({ taskId: "screen02-applied" }), target);
    await target.recordMessage({
      taskId: "screen02-applied",
      operationId: "screen02-delivery",
      channel: "ui/message",
      accepted: true,
      requestedAt: "2026-09-03T00:00:01.000Z",
      resolvedAt: "2026-09-03T00:00:02.000Z",
    });
    await target.applySubmission({
      taskId: "screen02-applied",
      operationId: "screen02-submission",
      capabilityId: "screen02-capability",
      submissionFingerprint: fingerprintHostReasoningValue(
        "screen02-submission",
      ),
      proposal: { bridges: [{ text: "Preserve this applied result." }] },
      sourceIdsReferenced: ["source-1"],
      resultId: "screen02-result",
      receivedAt: "2026-09-03T00:00:03.000Z",
      appliedAt: "2026-09-03T00:00:04.000Z",
    });

    const screen03TaskIds: string[] = [];
    for (let index = 0; index < 65; index += 1) {
      const taskId = `screen03-evidence-${String(index).padStart(3, "0")}`;
      screen03TaskIds.push(taskId);
      await prepare(task({
        taskId,
        taskType: "screen03-evidence-mapping",
      }), target);
    }
    for (let index = 0; index < 2; index += 1) {
      const taskId = `screen03-overview-${String(index).padStart(3, "0")}`;
      screen03TaskIds.push(taskId);
      await prepare(task({
        taskId,
        taskType: "screen03-overview-improvement",
      }), target);
    }

    await expect(target.retireRunTaskTypes("run-1", [
      "screen03-evidence-mapping",
      "screen03-overview-improvement",
    ])).resolves.toEqual({ removed: 64, batchLimitReached: true });
    await expect(target.retireRunTaskTypes("run-1", [
      "screen03-evidence-mapping",
      "screen03-overview-improvement",
    ])).resolves.toEqual({ removed: 3, batchLimitReached: false });

    for (const taskId of screen03TaskIds) {
      expect((await target.read(taskId)).outcome).toBe("not-found");
    }
    const preserved = await target.read("screen02-applied");
    expect(preserved.outcome === "found" && preserved.record.task).toMatchObject({
      status: "applied",
      resultId: "screen02-result",
    });
    expect(preserved.outcome === "found" && preserved.record.proposal).toEqual({
      bridges: [{ text: "Preserve this applied result." }],
    });
    expect([...harness.records.keys()].filter((key) =>
      key.startsWith("host-reasoning-run-task-type-v2:run-1:screen03-")
    )).toEqual([]);

    const orphanCreatedAt = "2026-09-03T00:00:00.000Z";
    const orphanIndex =
      `host-reasoning-run-task-type-v2:run-1:screen03-evidence-mapping:${orphanCreatedAt}|orphan-task`;
    const orphanRunIndex =
      `host-reasoning-run-v2:run-1:${orphanCreatedAt}|orphan-task`;
    harness.records.set(orphanIndex, "orphan-task");
    harness.records.set(orphanRunIndex, "orphan-task");
    await expect(target.retireRunTaskTypes(
      "run-1",
      ["screen03-evidence-mapping"],
    )).resolves.toEqual({ removed: 0, batchLimitReached: false });
    expect(harness.records.has(orphanIndex)).toBe(false);
    expect(harness.records.has(orphanRunIndex)).toBe(false);
  });
});
