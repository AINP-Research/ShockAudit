import { describe, expect, it } from "vitest";

import {
  createHostReasoningTask,
  fingerprintHostReasoningValue,
  requireHostReasoningTask,
  transitionHostReasoningTask,
  type HostReasoningTask,
} from "../../src/core/host-reasoning-task";

const input = {
  study: { industry: "video games", geography: "United States" },
  sources: [{ sourceId: "source-1", quotedText: "An official rule changed requirements." }],
};

function task(
  override: Partial<Parameters<typeof createHostReasoningTask>[0]> = {},
) {
  return createHostReasoningTask({
    taskId: "task-1",
    taskType: "screen02-search-review",
    screen: "screen-02",
    runId: "run-1",
    candidateId: null,
    candidatePoolId: "pool-1",
    selectedEventId: null,
    claimGroupId: null,
    scopeFingerprint: fingerprintHostReasoningValue("scope"),
    candidatePoolFingerprint: fingerprintHostReasoningValue("pool"),
    eventFingerprint: null,
    sourcePoolFingerprint: fingerprintHostReasoningValue(["source-1"]),
    inputFingerprint: fingerprintHostReasoningValue(input),
    promptVersion: "prompt-v1",
    workflowVersion: "workflow-v1",
    requiredSubmissionSchemaVersion: "screen02-search-review-submission-v1",
    createdAt: "2026-09-03T00:00:00.000Z",
    expiresAt: "2026-09-03T00:02:00.000Z",
    retryCount: 0,
    appVersion: "0.4.4",
    uiResourceUri: "ui://shockaudit/workspace-v0.4.04.html",
    hostModel: "host_model_not_exposed",
    ...override,
  });
}

describe("host reasoning task core", () => {
  it("creates the exact v1 task with null non-applicable coordinates", () => {
    const created = task();
    expect(created).toMatchObject({
      schemaVersion: "shockaudit-host-reasoning-task-v1",
      taskType: "screen02-search-review",
      status: "prepared",
      selectedEventId: null,
      claimGroupId: null,
      retryCount: 0,
      outcomeValuesInspected: false,
    });
    expect(() => requireHostReasoningTask({ ...created, surprise: true }))
      .toThrow(/unrecognized fields/);
  });

  it("rejects cross-screen and incomplete task coordinates", () => {
    expect(() => task({ screen: "screen-03" })).toThrow(/invalid coordinates/);
    expect(() => task({ candidateId: "candidate-1" })).toThrow(/invalid coordinates/);
    expect(() => task({
      taskType: "screen03-evidence-mapping",
      screen: "screen-03",
      candidatePoolId: null,
      candidatePoolFingerprint: null,
      selectedEventId: "event-1",
      eventFingerprint: fingerprintHostReasoningValue("event"),
      claimGroupId: null,
    })).toThrow(/requires a claim group/);
  });

  it("enforces lifecycle order and derives all lifecycle timestamps", () => {
    let current = task();
    current = transitionHostReasoningTask(current, {
      status: "message-requested",
      at: "2026-09-03T00:00:01.000Z",
      messageChannel: "ui/message",
    }).task;
    current = transitionHostReasoningTask(current, {
      status: "message-accepted",
      at: "2026-09-03T00:00:02.000Z",
    }).task;
    current = transitionHostReasoningTask(current, {
      status: "awaiting-submission",
      at: "2026-09-03T00:00:02.000Z",
    }).task;
    current = transitionHostReasoningTask(current, {
      status: "submission-received",
      at: "2026-09-03T00:00:03.000Z",
    }).task;
    current = transitionHostReasoningTask(current, {
      status: "validating",
      at: "2026-09-03T00:00:03.000Z",
    }).task;
    current = transitionHostReasoningTask(current, {
      status: "applied",
      at: "2026-09-03T00:00:04.000Z",
      resultId: "result-1",
    }).task;
    expect(current).toMatchObject({
      status: "applied",
      messageChannel: "ui/message",
      messageDeliveryStatus: "accepted",
      submissionReceivedAt: "2026-09-03T00:00:03.000Z",
      validatedAt: "2026-09-03T00:00:04.000Z",
      appliedAt: "2026-09-03T00:00:04.000Z",
      resultId: "result-1",
    });
    expect(() => transitionHostReasoningTask(current, {
      status: "cancelled",
      at: "2026-09-03T00:00:05.000Z",
      failureCode: "cancelled",
      failureExplanation: "Cancelled.",
    })).toThrow(/transition applied -> cancelled is invalid/);
  });

  it("requires explicit failure details and preserves outcome blindness", () => {
    const requested = transitionHostReasoningTask(task(), {
      status: "message-requested",
      at: "2026-09-03T00:00:01.000Z",
      messageChannel: "sendFollowUpMessage",
    }).task;
    expect(() => transitionHostReasoningTask(requested, {
      status: "message-rejected",
      at: "2026-09-03T00:00:02.000Z",
    })).toThrow(/failureCode/);
    expect(() => requireHostReasoningTask({
      ...task(),
      outcomeValuesInspected: true,
    } as unknown as HostReasoningTask)).toThrow(/invariant/);
  });

  it("allows a validating reservation to expire while preserving its receipt time", () => {
    let current = task();
    current = transitionHostReasoningTask(current, {
      status: "message-requested",
      at: "2026-09-03T00:00:01.000Z",
      messageChannel: "ui/message",
    }).task;
    current = transitionHostReasoningTask(current, {
      status: "message-accepted",
      at: "2026-09-03T00:00:02.000Z",
    }).task;
    current = transitionHostReasoningTask(current, {
      status: "submission-received",
      at: "2026-09-03T00:00:03.000Z",
    }).task;
    current = transitionHostReasoningTask(current, {
      status: "validating",
      at: "2026-09-03T00:00:03.000Z",
    }).task;
    current = transitionHostReasoningTask(current, {
      status: "expired",
      at: "2026-09-03T00:02:00.000Z",
      failureCode: "task-expired",
      failureExplanation: "The reserved submission did not finish before expiry.",
    }).task;

    expect(current).toMatchObject({
      status: "expired",
      submissionReceivedAt: "2026-09-03T00:00:03.000Z",
      validatedAt: null,
      appliedAt: null,
      failureCode: "task-expired",
    });
  });
});
