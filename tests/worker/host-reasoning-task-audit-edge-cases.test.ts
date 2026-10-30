import { describe, expect, it } from "vitest";

import {
  createHostReasoningTask,
  fingerprintHostReasoningValue,
} from "../../src/core/host-reasoning-task";
import { requireHostReasoningRunAuditBundle } from
  "../../src/core/host-reasoning-audit";
import {
  HostReasoningTaskStore,
  InMemoryHostReasoningTaskStoreBackend,
} from "../../src/worker/host-reasoning-task-store";

const boundedInput = {
  study: { industry: "video games" },
  sourceIds: ["source-1"],
};

function task(input: {
  taskId: string;
  createdAt?: string;
  expiresAt?: string;
  retryCount?: 0 | 1;
  appVersion?: string;
  uiResourceUri?: string;
}) {
  return createHostReasoningTask({
    taskId: input.taskId,
    taskType: "screen02-search-review",
    screen: "screen-02",
    runId: "run-audit-edge",
    candidateId: null,
    candidatePoolId: "pool-1",
    selectedEventId: null,
    claimGroupId: null,
    scopeFingerprint: fingerprintHostReasoningValue("scope"),
    candidatePoolFingerprint: fingerprintHostReasoningValue("pool"),
    eventFingerprint: null,
    sourcePoolFingerprint: fingerprintHostReasoningValue(["source-1"]),
    inputFingerprint: fingerprintHostReasoningValue(boundedInput),
    promptVersion: "prompt-v1",
    workflowVersion: "workflow-v1",
    requiredSubmissionSchemaVersion:
      "screen02-search-review-submission-v1",
    createdAt: input.createdAt ?? "2026-09-03T00:00:00.000Z",
    expiresAt: input.expiresAt ?? "2026-09-03T00:05:00.000Z",
    retryCount: input.retryCount ?? 0,
    appVersion: input.appVersion ?? "0.4.4",
    uiResourceUri: input.uiResourceUri ??
      "ui://shockaudit/workspace-v0.4.04.html",
    hostModel: "host_model_not_exposed",
  });
}

function proposal(taskId: string) {
  return {
    schemaVersion: "shockaudit-screen02-host-review-result-v1",
    origin: "chatgpt-host",
    nonCanonical: true,
    review: {
      schemaVersion: "screen-02-pool-host-review-v1",
      taskId,
      capability: "screen-02-pool-review",
      profileAdditions: {},
      candidateReviews: [{
        candidateId: "candidate-1",
        proposedClass: "direct",
        industryBridge: "Source-supported industry bridge.",
        profileTermsUsed: ["video games"],
        sourceIdsUsed: ["source-1"],
        sourceSpansUsed: [{
          sourceId: "source-1",
          text: "Source-supported passage.",
        }],
        sampleConnection: "The candidate matches the sample.",
        outcomePathway: "The event can affect the study population.",
        mainMismatchOrUncertainty: "No material mismatch was identified.",
        needsFollowUpRetrieval: false,
        rankingAdjustment: 0,
      }],
      followUpQueries: [],
      officialSourceLeads: [],
      conciseRationale: "The supplied source supports this bounded review.",
      hostModel: "host_model_not_exposed",
    },
    enrichedProfile: {},
    rankings: [],
    outcomeValuesInspected: false,
  };
}

function store() {
  return new HostReasoningTaskStore(
    new InMemoryHostReasoningTaskStoreBackend(),
  );
}

async function prepare(
  target: HostReasoningTaskStore,
  value: ReturnType<typeof task>,
  retryOfTaskId: string | null = null,
) {
  return target.prepare({
    task: value,
    boundedInput,
    allowedSourceIds: ["source-1"],
    retryOfTaskId,
    operationId: `prepare-${value.taskId}`,
  });
}

async function rejectMessage(
  target: HostReasoningTaskStore,
  taskId: string,
  requestedAt: string,
  resolvedAt: string,
) {
  await target.recordMessage({
    taskId,
    operationId: `delivery-${taskId}`,
    channel: "unavailable",
    accepted: false,
    requestedAt,
    resolvedAt,
  });
}

describe("host reasoning audit legal lifecycle edge cases", () => {
  it("exports retry exhaustion after a validated application failure", async () => {
    const target = store();
    await prepare(target, task({ taskId: "task-initial" }));
    await rejectMessage(
      target,
      "task-initial",
      "2026-09-03T00:00:01.000Z",
      "2026-09-03T00:00:02.000Z",
    );
    await prepare(target, task({
      taskId: "task-retry",
      retryCount: 1,
      createdAt: "2026-09-03T00:00:03.000Z",
      expiresAt: "2026-09-03T00:05:03.000Z",
    }), "task-initial");
    await target.recordMessage({
      taskId: "task-retry",
      operationId: "delivery-task-retry",
      channel: "ui/message",
      accepted: true,
      requestedAt: "2026-09-03T00:00:04.000Z",
      resolvedAt: "2026-09-03T00:00:05.000Z",
    });
    const submissionFingerprint = fingerprintHostReasoningValue("submission");
    await target.reserveSubmission({
      taskId: "task-retry",
      operationId: "reserve-task-retry",
      capabilityId: "capability-task-retry",
      submissionFingerprint,
      proposal: proposal("task-retry"),
      sourceIdsReferenced: ["source-1"],
      receivedAt: "2026-09-03T00:00:06.000Z",
    });
    await target.finalizeSubmissionFailed({
      taskId: "task-retry",
      operationId: "fail-task-retry",
      capabilityId: "capability-task-retry",
      submissionFingerprint,
      validatedAt: "2026-09-03T00:00:07.000Z",
      failureCode: "authoritative-application-failed",
      failureExplanation: "The canonical application did not commit.",
    });

    const exhausted = await prepare(target, task({
      taskId: "task-second-retry",
      retryCount: 1,
      createdAt: "2026-09-03T00:00:08.000Z",
      expiresAt: "2026-09-03T00:05:08.000Z",
    }), "task-retry");
    expect(exhausted.outcome).toBe("retry-exhausted");

    const bundle = await target.exportRunAuditBundle("run-audit-edge");
    const retry = bundle.tasks.find((entry) =>
      entry.task.taskId === "task-retry"
    );
    expect(retry).toMatchObject({
      task: { status: "retry-exhausted" },
      validation: { disposition: "accepted" },
      application: { disposition: "failed" },
      failure: { stage: "retry" },
    });
    expect(retry?.proposal?.type).toBe("screen02-search-review");
  });

  it("exports retry exhaustion recorded after the retry task expired", async () => {
    const target = store();
    await prepare(target, task({ taskId: "task-initial" }));
    await rejectMessage(
      target,
      "task-initial",
      "2026-09-03T00:00:01.000Z",
      "2026-09-03T00:00:02.000Z",
    );
    await prepare(target, task({
      taskId: "task-retry",
      retryCount: 1,
      createdAt: "2026-09-03T00:00:03.000Z",
      expiresAt: "2026-09-03T00:00:10.000Z",
    }), "task-initial");
    await target.cleanupExpired("2026-09-03T00:00:10.000Z");
    const exhausted = await prepare(target, task({
      taskId: "task-second-retry",
      retryCount: 1,
      createdAt: "2026-09-03T00:00:11.000Z",
      expiresAt: "2026-09-03T00:05:11.000Z",
    }), "task-retry");
    expect(exhausted.outcome).toBe("retry-exhausted");

    const bundle = await target.exportRunAuditBundle("run-audit-edge");
    const retry = bundle.tasks.find((entry) =>
      entry.task.taskId === "task-retry"
    );
    expect(retry?.lifecycle.at(-1)).toMatchObject({
      from: "expired",
      to: "retry-exhausted",
      at: "2026-09-03T00:00:11.000Z",
    });
  });

  it("exports a validating reservation superseded by a newer task", async () => {
    const target = store();
    await prepare(target, task({ taskId: "task-validating" }));
    await target.recordMessage({
      taskId: "task-validating",
      operationId: "delivery-task-validating",
      channel: "ui/message",
      accepted: true,
      requestedAt: "2026-09-03T00:00:01.000Z",
      resolvedAt: "2026-09-03T00:00:02.000Z",
    });
    await target.reserveSubmission({
      taskId: "task-validating",
      operationId: "reserve-task-validating",
      capabilityId: "capability-task-validating",
      submissionFingerprint: fingerprintHostReasoningValue("reservation"),
      proposal: proposal("task-validating"),
      sourceIdsReferenced: ["source-1"],
      receivedAt: "2026-09-03T00:00:03.000Z",
    });
    await prepare(target, task({
      taskId: "task-newer",
      createdAt: "2026-09-03T00:00:04.000Z",
      expiresAt: "2026-09-03T00:05:04.000Z",
    }));

    const bundle = await target.exportRunAuditBundle("run-audit-edge");
    const superseded = bundle.tasks.find((entry) =>
      entry.task.taskId === "task-validating"
    );
    expect(superseded).toMatchObject({
      task: { status: "superseded" },
      submission: { disposition: "received" },
      validation: { disposition: "pending" },
      application: { disposition: "pending" },
    });
    expect(superseded?.proposal?.type).toBe("screen02-search-review");
  });

  it("rejects truncated retry chains and mismatched immutable coordinates", async () => {
    const target = store();
    await prepare(target, task({ taskId: "task-initial" }));
    await rejectMessage(
      target,
      "task-initial",
      "2026-09-03T00:00:01.000Z",
      "2026-09-03T00:00:02.000Z",
    );
    await prepare(target, task({
      taskId: "task-retry",
      retryCount: 1,
      createdAt: "2026-09-03T00:00:03.000Z",
      expiresAt: "2026-09-03T00:05:03.000Z",
    }), "task-initial");
    const bundle = await target.exportRunAuditBundle("run-audit-edge");
    const retry = bundle.tasks.find((entry) =>
      entry.task.taskId === "task-retry"
    )!;

    expect(() => requireHostReasoningRunAuditBundle({
      ...bundle,
      includedTaskCount: 1,
      truncated: true,
      tasks: [retry],
    })).toThrow(/retry predecessor is missing/i);

    const mismatched = structuredClone(bundle);
    const mismatchedRetry = mismatched.tasks.find((entry) =>
      entry.task.taskId === "task-retry"
    )!;
    mismatchedRetry.task.promptVersion = "different-prompt-v1";
    expect(() => requireHostReasoningRunAuditBundle(mismatched)).toThrow(
      /retry does not match its predecessor/i,
    );

    const mismatchedUiRelease = structuredClone(bundle);
    const mismatchedUiRetry = mismatchedUiRelease.tasks.find((entry) =>
      entry.task.taskId === "task-retry"
    )!;
    mismatchedUiRetry.release.appVersion = "0.4.3";
    mismatchedUiRetry.release.uiResourceUri =
      "ui://shockaudit/workspace-v0.4.03.html";
    expect(() => requireHostReasoningRunAuditBundle(mismatchedUiRelease)).toThrow(
      /retry does not match its predecessor/i,
    );
  });

  it("refuses first retries of cancelled, superseded, and applied tasks", async () => {
    const cancelledStore = store();
    await prepare(cancelledStore, task({ taskId: "task-cancelled" }));
    await cancelledStore.cancel({
      taskId: "task-cancelled",
      operationId: "cancel-task-cancelled",
      at: "2026-09-03T00:00:01.000Z",
      reason: "The researcher ended this task.",
    });
    await expect(prepare(cancelledStore, task({
      taskId: "retry-cancelled",
      retryCount: 1,
      createdAt: "2026-09-03T00:00:02.000Z",
      expiresAt: "2026-09-03T00:05:02.000Z",
    }), "task-cancelled")).rejects.toThrow(/retryable predecessor/i);

    const supersededStore = store();
    await prepare(supersededStore, task({ taskId: "task-superseded" }));
    await prepare(supersededStore, task({
      taskId: "task-newer",
      createdAt: "2026-09-03T00:00:01.000Z",
      expiresAt: "2026-09-03T00:05:01.000Z",
    }));
    await expect(prepare(supersededStore, task({
      taskId: "retry-superseded",
      retryCount: 1,
      createdAt: "2026-09-03T00:00:02.000Z",
      expiresAt: "2026-09-03T00:05:02.000Z",
    }), "task-superseded")).rejects.toThrow(/retryable predecessor/i);

    const appliedStore = store();
    await prepare(appliedStore, task({ taskId: "task-applied" }));
    await appliedStore.recordMessage({
      taskId: "task-applied",
      operationId: "delivery-task-applied",
      channel: "ui/message",
      accepted: true,
      requestedAt: "2026-09-03T00:00:01.000Z",
      resolvedAt: "2026-09-03T00:00:02.000Z",
    });
    await appliedStore.applySubmission({
      taskId: "task-applied",
      operationId: "apply-task-applied",
      capabilityId: "capability-task-applied",
      submissionFingerprint: fingerprintHostReasoningValue("task-applied"),
      proposal: proposal("task-applied"),
      sourceIdsReferenced: ["source-1"],
      resultId: "result-task-applied",
      receivedAt: "2026-09-03T00:00:03.000Z",
      appliedAt: "2026-09-03T00:00:04.000Z",
    });
    await expect(prepare(appliedStore, task({
      taskId: "retry-applied",
      retryCount: 1,
      createdAt: "2026-09-03T00:00:05.000Z",
      expiresAt: "2026-09-03T00:05:05.000Z",
    }), "task-applied")).rejects.toThrow(/retryable predecessor/i);
  });

  it("refuses a retry created before its predecessor terminal event", async () => {
    const target = store();
    await prepare(target, task({ taskId: "task-predecessor" }));
    await rejectMessage(
      target,
      "task-predecessor",
      "2026-09-03T00:00:01.000Z",
      "2026-09-03T00:00:03.000Z",
    );

    await expect(prepare(target, task({
      taskId: "task-backdated-retry",
      retryCount: 1,
      createdAt: "2026-09-03T00:00:02.000Z",
      expiresAt: "2026-09-03T00:05:02.000Z",
    }), "task-predecessor")).rejects.toThrow(/retryable predecessor/i);
  });

  it("exports supported legacy UI release URIs", async () => {
    const target = store();
    await prepare(target, task({
      taskId: "task-legacy-ui",
      appVersion: "0.4.3",
      uiResourceUri: "ui://shockaudit/workspace-v0.4.03.html",
    }));

    const bundle = await target.exportRunAuditBundle("run-audit-edge");
    expect(bundle.tasks[0]?.release).toEqual({
      appVersion: "0.4.3",
      uiResourceUri: "ui://shockaudit/workspace-v0.4.03.html",
    });
  });

  it("rejects arbitrary stored UI resource text without reflecting it", async () => {
    const target = store();
    const secret = "PRIVATE_TOKEN_SHOULD_NOT_ESCAPE";
    await prepare(target, task({
      taskId: "task-unsafe-ui",
      uiResourceUri:
        `ui://shockaudit/workspace-v0.4.04.html?token=${secret}`,
    }));

    let error: unknown;
    try {
      await target.exportRunAuditBundle("run-audit-edge");
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/UI resource URI is not supported/i);
    expect((error as Error).message).not.toContain(secret);
  });

  it("rejects an arbitrary stored app version despite an allowlisted URI", async () => {
    const target = store();
    const secret = "PRIVATE_VERSION_SHOULD_NOT_ESCAPE";
    await prepare(target, task({
      taskId: "task-unsafe-version",
      appVersion: secret,
    }));

    let error: unknown;
    try {
      await target.exportRunAuditBundle("run-audit-edge");
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(
      /app version does not match its UI resource URI/i,
    );
    expect((error as Error).message).not.toContain(secret);
  });

  it("rejects a tampered audit UI resource URI without reflecting it", async () => {
    const target = store();
    await prepare(target, task({ taskId: "task-current-ui" }));
    const bundle = await target.exportRunAuditBundle("run-audit-edge");
    const secret = "ARBITRARY_STORED_VALUE";
    const tampered = structuredClone(bundle);
    (tampered.tasks[0]!.release as { uiResourceUri: unknown })
      .uiResourceUri = `https://attacker.invalid/${secret}`;

    let error: unknown;
    try {
      requireHostReasoningRunAuditBundle(tampered);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/UI resource URI is not supported/i);
    expect((error as Error).message).not.toContain(secret);
  });
});
