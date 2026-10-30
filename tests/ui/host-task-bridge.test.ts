import { afterEach, describe, expect, it, vi } from "vitest";

import { ShockAuditBridge } from "../../src/ui/mcp-bridge";
import {
  CANCEL_SHOCKAUDIT_HOST_TASK_TOOL,
  GET_SHOCKAUDIT_HOST_TASK_STATUS_TOOL,
  HOST_REASONING_META_KEY,
  HOST_REASONING_PRIVATE_CONTEXT_META_KEY,
  HOST_REASONING_PRIVATE_CONTEXT_META_SCHEMA_VERSION,
  PREPARE_SHOCKAUDIT_HOST_TASK_TOOL,
  RECORD_SHOCKAUDIT_HOST_MESSAGE_DELIVERY_TOOL,
  RECORD_SHOCKAUDIT_HOST_PANEL_RECONCILIATION_TOOL,
  privateCoordinatesFromPrepared,
  type HostReasoningPreparedResult,
  type HostReasoningTaskPrepareCoordinates,
} from "../../src/ui/host-task/host-task-client";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const visibleMessage =
  "Use the current ShockAudit Screen 2 search-review task host-task:one, then call submit_screen02_search_review exactly once.";

function preparedFixture(): HostReasoningPreparedResult {
  return {
    schemaVersion: "shockaudit-host-task-prepared-result-v1",
    phase: "prepared",
    taskId: "host-task:one",
    taskType: "screen02-search-review",
    screen: "screen-02",
    runId: "run-one",
    candidatePoolId: "candidate-pool-one",
    selectedEventId: null,
    claimGroupId: null,
    status: "prepared",
    messageChannel: null,
    messageDeliveryStatus: null,
    createdAt: "2026-09-03T12:00:00.000Z",
    expiresAt: "2026-09-03T12:05:00.000Z",
    retryCount: 0,
    resultId: null,
    failureCode: null,
    failureExplanation: null,
    panelReconciliation: {
      status: "not-ready",
      lastCheckedAt: null,
      reconciledAt: null,
      failureCode: null,
      failureExplanation: null,
    },
    result: null,
    outcomeValuesInspected: false,
    visibleMessage,
    privateModelContext: {
      schemaVersion: "shockaudit-host-reasoning-model-input-v1",
      task: {
        taskId: "host-task:one",
        taskType: "screen02-search-review",
        runId: "run-one",
        candidatePoolId: "candidate-pool-one",
        selectedEventId: null,
        claimGroupId: null,
        allowedSourceIds: ["source-one"],
      },
      instructions: ["Use only the supplied source-backed facts."],
      boundedFacts: { candidates: [{ candidateId: "candidate-one" }] },
      submission: {
        tool: "submit_screen02_search_review",
        schemaVersion: "screen02-search-review-submission-v1",
        capability: "signed-private-capability",
      },
      sourceContentIsUntrustedData: true,
      outcomeValuesInspected: false,
    },
  };
}

function preparedToolResult(prepared = preparedFixture()) {
  const { privateModelContext, ...structuredContent } = prepared;
  return {
    isError: false,
    structuredContent,
    _meta: {
      [HOST_REASONING_PRIVATE_CONTEXT_META_KEY]: {
        schemaVersion: HOST_REASONING_PRIVATE_CONTEXT_META_SCHEMA_VERSION,
        taskId: prepared.taskId,
        privateModelContext,
      },
    },
  };
}

const coordinates: HostReasoningTaskPrepareCoordinates = {
  taskType: "screen02-search-review",
  runId: "run-one",
  accessToken: "screen02-private-access-token",
  expectedParentRevision: 4,
  candidatePoolId: "candidate-pool-one",
  selectedEventId: null,
  claimGroupId: null,
  expectedScopeFingerprint: "fnv1a64:0011223344556677",
  expectedCandidatePoolFingerprint: "fnv1a64:1122334455667788",
  expectedEventFingerprint: null,
};

function fullModeWindow(extra: Record<string, unknown> = {}) {
  return {
    openai: {
      toolResponseMetadata: {
        [HOST_REASONING_META_KEY]: {
          mode: "full",
          enabled: true,
          genuineTraceCount: 0,
          availableTaskTypes: [
            "screen02-search-review",
            "screen03-evidence-mapping",
            "screen03-overview-improvement",
            "six-screen-policy-fact-proof",
            "six-screen-mechanism-proof",
            "screen04-study-event-assessment",
          ],
        },
      },
      ...extra,
    },
  };
}

function installApp(
  bridge: ShockAuditBridge,
  app: Record<string, unknown>,
) {
  (bridge as unknown as { app: Record<string, unknown> }).app = app;
}

function messageReceipt(
  accepted: boolean | null = true,
  channel: "ui/message" | "sendFollowUpMessage" | "unavailable" =
    "ui/message",
) {
  return {
    schemaVersion: "shockaudit-host-task-message-record-result-v1",
    disposition: "updated",
    taskId: "host-task:one",
    status: accepted === null
      ? "message-requested"
      : accepted
        ? "awaiting-submission"
        : "message-rejected",
    messageChannel: channel,
    messageDeliveryStatus: accepted === null
      ? "requested"
      : accepted
        ? "accepted"
        : "rejected",
  };
}

describe("generic host-task MCP Apps bridge", () => {
  it("persists only coordinates, publishes private context first, and sends one identity-only standards message", async () => {
    const setWidgetState = vi.fn(async (_state: unknown) => undefined);
    vi.stubGlobal("window", fullModeWindow({ setWidgetState }));
    const prepared = preparedFixture();
    const callServerTool = vi.fn(async (call: {
      name: string;
      arguments?: { phase?: string };
    }) =>
      call.name === PREPARE_SHOCKAUDIT_HOST_TASK_TOOL
        ? preparedToolResult(prepared)
        : {
            isError: false,
            structuredContent: messageReceipt(
              call.arguments?.phase === "requested" ? null : true,
            ),
          }
    );
    const updateModelContext = vi.fn(async (_update: unknown) => undefined);
    const sendMessage = vi.fn(async (_message: unknown) => ({ isError: false }));
    const bridge = new ShockAuditBridge();
    installApp(bridge, {
      getHostCapabilities: () => ({
        serverTools: {},
        message: { text: {} },
        updateModelContext: { structuredContent: {} },
      }),
      callServerTool,
      updateModelContext,
      sendMessage,
    });

    const result = await bridge.prepareHostReasoningTask(coordinates);
    const delivery = await bridge.deliverHostReasoningTask(result, {
      runId: coordinates.runId,
      accessToken: coordinates.accessToken,
    });

    expect(delivery.accepted).toBe(true);
    expect(callServerTool.mock.calls[0]?.[0]).toMatchObject({
      name: PREPARE_SHOCKAUDIT_HOST_TASK_TOOL,
      arguments: {
        schemaVersion: "shockaudit-host-task-prepare-input-v1",
        taskType: "screen02-search-review",
        runId: "run-one",
        retryOfTaskId: null,
      },
    });
    expect((callServerTool.mock.calls[0]?.[0] as unknown as {
      arguments: Record<string, unknown>;
    }).arguments)
      .not.toHaveProperty("expectedParentRevision");
    expect(updateModelContext).toHaveBeenCalledOnce();
    expect(sendMessage).toHaveBeenCalledOnce();
    expect(sendMessage).toHaveBeenCalledWith({
      role: "user",
      content: [{ type: "text", text: visibleMessage }],
    });
    const requestRecordIndex = callServerTool.mock.calls.findIndex(([call]) =>
      call.arguments?.phase === "requested"
    );
    const resolutionRecordIndex = callServerTool.mock.calls.findIndex(([call]) =>
      call.arguments?.phase === "resolved"
    );
    expect(requestRecordIndex).toBeGreaterThan(0);
    expect(resolutionRecordIndex).toBeGreaterThan(requestRecordIndex);
    expect(updateModelContext.mock.invocationCallOrder[0])
      .toBeLessThan(callServerTool.mock.invocationCallOrder[requestRecordIndex]!);
    expect(callServerTool.mock.invocationCallOrder[requestRecordIndex])
      .toBeLessThan(sendMessage.mock.invocationCallOrder[0]!);
    expect(sendMessage.mock.invocationCallOrder[0])
      .toBeLessThan(
        callServerTool.mock.invocationCallOrder[resolutionRecordIndex]!,
      );
    const privateUpdate = updateModelContext.mock.calls[0]?.[0] as {
      structuredContent: Record<string, unknown>;
    };
    expect(JSON.stringify(privateUpdate.structuredContent))
      .toContain("signed-private-capability");
    expect(JSON.stringify(sendMessage.mock.calls[0]?.[0]))
      .not.toContain("signed-private-capability");

    const saved = setWidgetState.mock.calls.at(-1)?.[0] as {
      privateContent: Record<string, unknown>;
    };
    expect(JSON.stringify(saved.privateContent.hostReasoningTasks))
      .not.toContain("signed-private-capability");
    expect(saved.privateContent.hostReasoningTasks).toMatchObject({
      schemaVersion: "shockaudit-private-host-task-registry-v1",
      tasks: [{
        taskId: "host-task:one",
        runId: "run-one",
        expectedParentRevision: 4,
      }],
    });
  });

  it("durably journals the request before ui/message can trigger an in-flight model submission", async () => {
    const setWidgetState = vi.fn(async (_state: unknown) => undefined);
    vi.stubGlobal("window", fullModeWindow({ setWidgetState }));
    let submissionTriggered = false;
    const callServerTool = vi.fn(async (call: {
      name: string;
      arguments?: { phase?: string };
    }) => {
      if (call.arguments?.phase === "requested") {
        return {
          isError: false,
          structuredContent: messageReceipt(null),
        };
      }
      if (call.arguments?.phase === "resolved") {
        return {
          isError: false,
          structuredContent: {
            ...messageReceipt(true),
            disposition: "terminal",
            status: "applied",
          },
        };
      }
      throw new Error(`Unexpected tool ${call.name}`);
    });
    const sendMessage = vi.fn(async () => {
      expect(callServerTool.mock.calls.some(([call]) =>
        call.arguments?.phase === "requested"
      )).toBe(true);
      submissionTriggered = true;
      // The host acknowledgement may be ambiguous even though the model-only
      // submission already proved that the turn was delivered.
      return { isError: true };
    });
    const bridge = new ShockAuditBridge();
    installApp(bridge, {
      getHostCapabilities: () => ({
        serverTools: {},
        message: { text: {} },
        updateModelContext: { structuredContent: {} },
      }),
      callServerTool,
      updateModelContext: vi.fn(async () => undefined),
      sendMessage,
    });

    const delivery = await bridge.deliverHostReasoningTask(
      preparedFixture(),
      { runId: coordinates.runId, accessToken: coordinates.accessToken },
    );

    expect(submissionTriggered).toBe(true);
    expect(delivery).toMatchObject({
      accepted: true,
      failureCode: null,
      record: {
        disposition: "terminal",
        status: "applied",
        messageDeliveryStatus: "accepted",
      },
    });
  });

  it("joins a compatibility prepare result only through its exact full-result metadata wrapper", async () => {
    const preparedResult = preparedToolResult();
    const setWidgetState = vi.fn(async (_state: unknown) => undefined);
    const updateModelContext = vi.fn(async (_update: unknown) => undefined);
    const sendMessage = vi.fn(async (_message: unknown) => ({ isError: false }));
    const openai = fullModeWindow({ setWidgetState }).openai as
      Record<string, unknown> & {
      toolResponseMetadata?: Record<string, unknown>;
    };
    const callTool = vi.fn(async (
      name: string,
      args?: { phase?: string },
    ) => {
      if (name === PREPARE_SHOCKAUDIT_HOST_TASK_TOOL) {
        openai.toolResponseMetadata = {
          status: "complete",
          mcp_tool_result: preparedResult,
        };
        return {
          isError: false,
          structuredContent: preparedResult.structuredContent,
        };
      }
      return {
        isError: false,
        structuredContent: messageReceipt(
          args?.phase === "requested" ? null : true,
        ),
      };
    });
    openai.callTool = callTool;
    vi.stubGlobal("window", { openai });
    const bridge = new ShockAuditBridge();
    installApp(bridge, {
      getHostCapabilities: () => ({
        message: { text: {} },
        updateModelContext: { structuredContent: {} },
      }),
      updateModelContext,
      sendMessage,
    });

    const prepared = await bridge.prepareHostReasoningTask(coordinates);
    const delivery = await bridge.deliverHostReasoningTask(prepared, {
      runId: coordinates.runId,
      accessToken: coordinates.accessToken,
    });

    expect(delivery).toMatchObject({
      accepted: true,
      channel: "ui/message",
    });
    expect(callTool.mock.calls.map(([name]) => name)).toStrictEqual([
      PREPARE_SHOCKAUDIT_HOST_TASK_TOOL,
      RECORD_SHOCKAUDIT_HOST_MESSAGE_DELIVERY_TOOL,
      RECORD_SHOCKAUDIT_HOST_MESSAGE_DELIVERY_TOOL,
    ]);
    expect(JSON.stringify(updateModelContext.mock.calls[0]?.[0]))
      .toContain("signed-private-capability");
    expect(JSON.stringify(sendMessage.mock.calls[0]?.[0]))
      .not.toContain("signed-private-capability");
  });

  it.each(["missing", "malformed"] as const)(
    "fails closed when standard prepare metadata is %s",
    async (scenario) => {
      const setWidgetState = vi.fn(async (_state: unknown) => undefined);
      const preparedResult = preparedToolResult();
      const windowValue = fullModeWindow({ setWidgetState });
      vi.stubGlobal("window", windowValue);
      const callServerTool = vi.fn(async () => ({
        isError: false,
        structuredContent: preparedResult.structuredContent,
        ...(scenario === "malformed"
          ? {
              _meta: {
                [HOST_REASONING_PRIVATE_CONTEXT_META_KEY]: {
                  ...preparedResult._meta[
                    HOST_REASONING_PRIVATE_CONTEXT_META_KEY
                  ],
                  taskId: "host-task:other",
                },
              },
            }
          : {}),
      }));
      const bridge = new ShockAuditBridge();
      (windowValue.openai as {
        toolResponseMetadata?: Record<string, unknown>;
      }).toolResponseMetadata = {
        mcp_tool_result: preparedResult,
      };
      installApp(bridge, {
        getHostCapabilities: () => ({ serverTools: {} }),
        callServerTool,
      });

      await expect(bridge.prepareHostReasoningTask(coordinates)).rejects
        .toThrow("unreadable or mismatched host-task preparation result");
      expect(setWidgetState).not.toHaveBeenCalled();
    },
  );

  it("uses the compatibility message only when standards messaging is absent", async () => {
    const sendFollowUpMessage = vi.fn(async (_message: unknown) => undefined);
    vi.stubGlobal("window", fullModeWindow({ sendFollowUpMessage }));
    const updateModelContext = vi.fn(async (_update: unknown) => undefined);
    const callServerTool = vi.fn(async (call: {
      arguments?: { phase?: string };
    }) => ({
      isError: false,
      structuredContent: {
        ...messageReceipt(
          call.arguments?.phase === "requested" ? null : true,
          "sendFollowUpMessage",
        ),
      },
    }));
    const bridge = new ShockAuditBridge();
    installApp(bridge, {
      getHostCapabilities: () => ({
        serverTools: {},
        updateModelContext: { structuredContent: {} },
      }),
      callServerTool,
      updateModelContext,
      sendMessage: vi.fn(),
    });

    const delivery = await bridge.deliverHostReasoningTask(
      preparedFixture(),
      { runId: coordinates.runId, accessToken: coordinates.accessToken },
    );

    expect(delivery.channel).toBe("sendFollowUpMessage");
    expect(sendFollowUpMessage).toHaveBeenCalledOnce();
    expect(sendFollowUpMessage).toHaveBeenCalledWith({
      prompt: visibleMessage,
      scrollToBottom: false,
    });
    expect(JSON.stringify(sendFollowUpMessage.mock.calls[0]?.[0]))
      .not.toContain("signed-private-capability");
    expect(updateModelContext.mock.invocationCallOrder[0])
      .toBeLessThan(sendFollowUpMessage.mock.invocationCallOrder[0]!);
  });

  it("never falls back after a standards message rejection", async () => {
    const sendFollowUpMessage = vi.fn(async (_message: unknown) => undefined);
    vi.stubGlobal("window", fullModeWindow({ sendFollowUpMessage }));
    const sendMessage = vi.fn(async () => ({ isError: true }));
    const callServerTool = vi.fn(async (call: {
      arguments?: { phase?: string };
    }) => ({
      isError: false,
      structuredContent: messageReceipt(
        call.arguments?.phase === "requested" ? null : false,
      ),
    }));
    const bridge = new ShockAuditBridge();
    installApp(bridge, {
      getHostCapabilities: () => ({
        serverTools: {},
        message: { text: {} },
        updateModelContext: { structuredContent: {} },
      }),
      callServerTool,
      updateModelContext: vi.fn(async () => undefined),
      sendMessage,
    });

    const delivery = await bridge.deliverHostReasoningTask(
      preparedFixture(),
      { runId: coordinates.runId, accessToken: coordinates.accessToken },
    );

    expect(delivery.accepted).toBe(false);
    expect(delivery.channel).toBe("ui/message");
    expect(sendMessage).toHaveBeenCalledOnce();
    expect(sendFollowUpMessage).not.toHaveBeenCalled();
  });

  it("does not create a visible turn when private context publication fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const sendFollowUpMessage = vi.fn(async () => undefined);
    vi.stubGlobal("window", fullModeWindow({ sendFollowUpMessage }));
    const sendMessage = vi.fn(async () => ({ isError: false }));
    const callServerTool = vi.fn(async (_call: {
      name: string;
      arguments?: Record<string, unknown>;
    }) => ({
      isError: false,
      structuredContent: messageReceipt(false),
    }));
    const bridge = new ShockAuditBridge();
    installApp(bridge, {
      getHostCapabilities: () => ({
        serverTools: {},
        message: { text: {} },
        updateModelContext: { structuredContent: {} },
      }),
      callServerTool,
      updateModelContext: vi.fn(async () => {
        throw new Error("rejected");
      }),
      sendMessage,
    });

    const delivery = await bridge.deliverHostReasoningTask(
      preparedFixture(),
      { runId: coordinates.runId, accessToken: coordinates.accessToken },
    );

    expect(delivery.accepted).toBe(false);
    expect(delivery.failureCode).toBe("private-context-rejected");
    expect(sendMessage).not.toHaveBeenCalled();
    expect(sendFollowUpMessage).not.toHaveBeenCalled();
  });

  it("does not send or resolve a request journal owned by another delivery", async () => {
    vi.stubGlobal("window", fullModeWindow());
    const sendMessage = vi.fn(async () => ({ isError: false }));
    const callServerTool = vi.fn(async (_call: {
      name: string;
      arguments?: Record<string, unknown>;
    }) => ({
      isError: false,
      structuredContent: {
        ...messageReceipt(null),
        disposition: "terminal",
      },
    }));
    const bridge = new ShockAuditBridge();
    installApp(bridge, {
      getHostCapabilities: () => ({
        serverTools: {},
        message: { text: {} },
        updateModelContext: { structuredContent: {} },
      }),
      callServerTool,
      updateModelContext: vi.fn(async () => undefined),
      sendMessage,
    });

    await expect(bridge.deliverHostReasoningTask(
      preparedFixture(),
      { runId: coordinates.runId, accessToken: coordinates.accessToken },
    )).resolves.toMatchObject({
      accepted: false,
      failureCode: "host-message-journal-unavailable",
      record: null,
    });
    expect(sendMessage).not.toHaveBeenCalled();
    expect(callServerTool).toHaveBeenCalledOnce();
    expect(callServerTool.mock.calls[0]?.[0]).toMatchObject({
      name: RECORD_SHOCKAUDIT_HOST_MESSAGE_DELIVERY_TOOL,
      arguments: {
        phase: "requested",
        channel: "ui/message",
        accepted: null,
        resolvedAt: null,
      },
    });
  });

  it("rejects a journaled delivery when newer model context replaces its private task", async () => {
    vi.stubGlobal("window", fullModeWindow());
    let resolveRequestJournal: ((value: unknown) => void) | undefined;
    const callServerTool = vi.fn((call: {
      arguments?: { phase?: string };
    }) => {
      if (call.arguments?.phase === "requested") {
        return new Promise((resolve) => {
          resolveRequestJournal = resolve;
        });
      }
      return Promise.resolve({
        isError: false,
        structuredContent: messageReceipt(false),
      });
    });
    const updateModelContext = vi.fn(async (_update: unknown) => undefined);
    const sendMessage = vi.fn(async () => ({ isError: false }));
    const bridge = new ShockAuditBridge();
    installApp(bridge, {
      getHostCapabilities: () => ({
        serverTools: {},
        message: { text: {} },
        updateModelContext: { structuredContent: {} },
      }),
      callServerTool,
      updateModelContext,
      sendMessage,
    });

    const delivery = bridge.deliverHostReasoningTask(
      preparedFixture(),
      { runId: coordinates.runId, accessToken: coordinates.accessToken },
    );
    await vi.waitFor(() => expect(callServerTool).toHaveBeenCalledOnce());
    await bridge.updateModelContext(
      "replacement Screen 1 context",
      { replacementMarker: "newer-context" } as never,
    );
    resolveRequestJournal?.({
      isError: false,
      structuredContent: messageReceipt(null),
    });

    await expect(delivery).resolves.toMatchObject({
      accepted: false,
      failureCode: "private-context-superseded",
    });
    expect(sendMessage).not.toHaveBeenCalled();
    expect(callServerTool.mock.calls.map(([call]) => call.arguments?.phase))
      .toEqual(["requested", "resolved"]);
    const requestArguments = callServerTool.mock.calls[0]?.[0].arguments as {
      operationId: string;
    };
    expect(callServerTool.mock.calls[1]?.[0]).toMatchObject({
      arguments: {
        phase: "resolved",
        requestOperationId: requestArguments.operationId,
      },
    });
  });

  it("keeps a timed-out private write ahead of its replacement until the host settles it", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const setWidgetState = vi.fn(async (_state: unknown) => undefined);
    vi.stubGlobal("window", fullModeWindow({ setWidgetState }));
    let settleOldWrite: (() => void) | undefined;
    const appliedUpdates: unknown[] = [];
    const updateModelContext = vi.fn((update: unknown) => {
      if (updateModelContext.mock.calls.length === 1) {
        return new Promise<void>((resolve) => {
          settleOldWrite = () => {
            appliedUpdates.push(update);
            resolve();
          };
        });
      }
      appliedUpdates.push(update);
      return Promise.resolve();
    });
    const sendMessage = vi.fn(async () => ({ isError: false }));
    const callServerTool = vi.fn(async () => ({
      isError: false,
      structuredContent: messageReceipt(false, "unavailable"),
    }));
    const bridge = new ShockAuditBridge();
    installApp(bridge, {
      getHostCapabilities: () => ({
        serverTools: {},
        message: { text: {} },
        updateModelContext: { structuredContent: {} },
      }),
      callServerTool,
      updateModelContext,
      sendMessage,
    });

    const oldDelivery = bridge.deliverHostReasoningTask(
      preparedFixture(),
      { runId: coordinates.runId, accessToken: coordinates.accessToken },
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(updateModelContext).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(5_000);
    await expect(oldDelivery).resolves.toMatchObject({
      accepted: false,
      failureCode: "private-context-rejected",
    });

    const replacement = bridge.updateModelContext(
      "replacement Screen 1 context",
      { replacementMarker: "latest-context" } as never,
    );
    await Promise.resolve();
    expect(updateModelContext).toHaveBeenCalledOnce();
    expect(appliedUpdates).toEqual([]);

    settleOldWrite?.();
    await replacement;
    expect(updateModelContext).toHaveBeenCalledTimes(2);
    expect(appliedUpdates).toHaveLength(2);
    expect(JSON.stringify(appliedUpdates[0])).toContain(
      "signed-private-capability",
    );
    expect(JSON.stringify(appliedUpdates.at(-1))).toContain("latest-context");
    expect(JSON.stringify(appliedUpdates.at(-1))).not.toContain(
      "signed-private-capability",
    );
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("automatically clears a private task context that settles after timeout", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("window", fullModeWindow());
    let settlePrivateWrite: (() => void) | undefined;
    const appliedUpdates: unknown[] = [];
    const updateModelContext = vi.fn((update: unknown) => {
      if (updateModelContext.mock.calls.length === 1) {
        return new Promise<void>((resolve) => {
          settlePrivateWrite = () => {
            appliedUpdates.push(update);
            resolve();
          };
        });
      }
      appliedUpdates.push(update);
      return Promise.resolve();
    });
    const sendMessage = vi.fn(async () => ({ isError: false }));
    const bridge = new ShockAuditBridge();
    installApp(bridge, {
      getHostCapabilities: () => ({
        serverTools: {},
        message: { text: {} },
        updateModelContext: { structuredContent: {} },
      }),
      callServerTool: vi.fn(async () => ({
        isError: false,
        structuredContent: messageReceipt(false, "unavailable"),
      })),
      updateModelContext,
      sendMessage,
    });

    const delivery = bridge.deliverHostReasoningTask(
      preparedFixture(),
      { runId: coordinates.runId, accessToken: coordinates.accessToken },
    );
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(5_000);
    await expect(delivery).resolves.toMatchObject({
      accepted: false,
      failureCode: "private-context-rejected",
    });

    settlePrivateWrite?.();
    await (bridge as unknown as { modelContextQueue: Promise<void> })
      .modelContextQueue;
    expect(updateModelContext).toHaveBeenCalledTimes(2);
    expect(appliedUpdates).toHaveLength(2);
    expect(JSON.stringify(appliedUpdates[0])).toContain(
      "signed-private-capability",
    );
    expect(JSON.stringify(appliedUpdates[1])).toContain(
      "shockaudit-private-host-task-cleared-v1",
    );
    expect(JSON.stringify(appliedUpdates[1])).not.toContain(
      "signed-private-capability",
    );
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("requires a usable server or compatibility tool-call route for AI review", () => {
    vi.stubGlobal("window", fullModeWindow());
    const bridge = new ShockAuditBridge();
    const hostView = () =>
      (bridge as unknown as {
        hostView: (
          context: undefined,
          connected: boolean,
        ) => { canRequestAiReview?: boolean };
      }).hostView(undefined, true);
    installApp(bridge, {
      getHostCapabilities: () => ({
        message: { text: {} },
        updateModelContext: { structuredContent: {} },
      }),
    });
    expect(hostView()).toMatchObject({ canRequestAiReview: false });

    installApp(bridge, {
      getHostCapabilities: () => ({
        serverTools: {},
        message: { text: {} },
        updateModelContext: { structuredContent: {} },
      }),
    });
    expect(hostView()).toMatchObject({ canRequestAiReview: true });

    vi.stubGlobal("window", fullModeWindow({ callTool: vi.fn() }));
    installApp(bridge, {
      getHostCapabilities: () => ({
        message: { text: {} },
        updateModelContext: { structuredContent: {} },
      }),
    });
    expect(hostView()).toMatchObject({ canRequestAiReview: true });
  });

  it("replays a lost delivery record once with the identical operation body", async () => {
    vi.stubGlobal("window", fullModeWindow());
    const callServerTool = vi.fn()
      .mockRejectedValueOnce(new Error("lost response"))
      .mockResolvedValueOnce({
        isError: false,
        structuredContent: messageReceipt(),
      });
    const bridge = new ShockAuditBridge();
    installApp(bridge, {
      getHostCapabilities: () => ({ serverTools: {} }),
      callServerTool,
    });

    await expect(bridge.recordHostReasoningMessageDelivery({
      taskId: "host-task:one",
      runId: "run-one",
      accessToken: coordinates.accessToken,
      channel: "ui/message",
      accepted: true,
      requestedAt: "2026-09-03T12:00:01.000Z",
      resolvedAt: "2026-09-03T12:00:02.000Z",
      failureCode: null,
      failureExplanation: null,
    }, "host-operation:stable")).resolves.toMatchObject({
      taskId: "host-task:one",
    });

    expect(callServerTool).toHaveBeenCalledTimes(2);
    expect(callServerTool.mock.calls[0]?.[0])
      .toStrictEqual(callServerTool.mock.calls[1]?.[0]);
    expect(callServerTool.mock.calls[0]?.[0]).toMatchObject({
      name: RECORD_SHOCKAUDIT_HOST_MESSAGE_DELIVERY_TOOL,
      arguments: { operationId: "host-operation:stable" },
    });
  });

  it("uses typed status, panel-failure, and cancellation tools", async () => {
    vi.stubGlobal("window", fullModeWindow());
    const prepared = preparedFixture();
    const taskCoordinates = privateCoordinatesFromPrepared(coordinates, prepared);
    if (!taskCoordinates) throw new Error("fixture mismatch");
    const callServerTool = vi.fn(async (call: { name: string }) => {
      if (call.name === GET_SHOCKAUDIT_HOST_TASK_STATUS_TOOL) {
        const {
          schemaVersion: _schemaVersion,
          phase: _phase,
          visibleMessage: _visibleMessage,
          privateModelContext: _privateModelContext,
          ...publicTask
        } = prepared;
        return {
          isError: false,
          structuredContent: {
            schemaVersion: "shockaudit-host-task-status-result-v1",
            outcome: "found",
            task: {
              ...publicTask,
              status: "applied",
              resultId: "host-result:one",
              panelReconciliation: {
                ...prepared.panelReconciliation,
                status: "pending",
                lastCheckedAt: "2026-09-03T12:00:03.000Z",
              },
              result: { normalized: true },
            },
          },
        };
      }
      if (call.name === RECORD_SHOCKAUDIT_HOST_PANEL_RECONCILIATION_TOOL) {
        return {
          isError: false,
          structuredContent: {
            schemaVersion: "shockaudit-host-task-panel-record-result-v1",
            disposition: "updated",
            taskId: "host-task:one",
            status: "applied",
            panelStatus: "failed",
          },
        };
      }
      return {
        isError: false,
        structuredContent: {
          schemaVersion: "shockaudit-host-task-cancel-result-v1",
          disposition: "updated",
          taskId: "host-task:one",
          status: "cancelled",
        },
      };
    });
    const bridge = new ShockAuditBridge();
    installApp(bridge, {
      getHostCapabilities: () => ({ serverTools: {} }),
      callServerTool,
    });

    await bridge.getHostReasoningTaskStatus(
      taskCoordinates,
      coordinates.accessToken,
      null,
      true,
    );
    await bridge.recordHostReasoningPanelFailure({
      task: { ...taskCoordinates, status: "applied", resultId: "host-result:one" },
      accessToken: coordinates.accessToken,
      resultId: "host-result:one",
      failureCode: "panel-reconciliation-timeout",
      failureExplanation: "The bounded panel reconciliation window ended.",
    });
    await bridge.cancelHostReasoningTask({
      task: taskCoordinates,
      accessToken: coordinates.accessToken,
      reason: "Researcher requested the one permitted retry.",
    });

    expect(callServerTool.mock.calls.map((call) => call[0].name)).toStrictEqual([
      GET_SHOCKAUDIT_HOST_TASK_STATUS_TOOL,
      RECORD_SHOCKAUDIT_HOST_PANEL_RECONCILIATION_TOOL,
      CANCEL_SHOCKAUDIT_HOST_TASK_TOOL,
    ]);
    expect(callServerTool.mock.calls[0]?.[0]).toMatchObject({
      arguments: {
        schemaVersion: "shockaudit-host-task-status-input-v1",
        taskId: "host-task:one",
        acknowledgeResultId: null,
        includeRunAudit: true,
      },
    });
    expect(callServerTool.mock.calls[1]?.[0]).toMatchObject({
      arguments: {
        schemaVersion: "shockaudit-host-task-panel-record-v1",
        resultId: "host-result:one",
      },
    });
    expect(callServerTool.mock.calls[2]?.[0]).toMatchObject({
      arguments: {
        schemaVersion: "shockaudit-host-task-cancel-input-v1",
        reason: "Researcher requested the one permitted retry.",
      },
    });
  });

  it("uses the caller-supplied refresh operation for exact result acknowledgement", async () => {
    vi.stubGlobal("window", fullModeWindow());
    const prepared = preparedFixture();
    const taskCoordinates = privateCoordinatesFromPrepared(coordinates, prepared);
    if (!taskCoordinates) throw new Error("fixture mismatch");
    const callServerTool = vi.fn(async (_call: {
      name: string;
      arguments?: Record<string, unknown>;
    }) => {
      const {
        schemaVersion: _schemaVersion,
        phase: _phase,
        visibleMessage: _visibleMessage,
        privateModelContext: _privateModelContext,
        ...publicTask
      } = prepared;
      return {
        isError: false,
        structuredContent: {
          schemaVersion: "shockaudit-host-task-status-result-v1",
          outcome: "found",
          task: {
            ...publicTask,
            status: "applied",
            resultId: "host-result:one",
            panelReconciliation: {
              status: "reconciled",
              lastCheckedAt: "2026-09-03T12:00:04.000Z",
              reconciledAt: "2026-09-03T12:00:04.000Z",
              failureCode: null,
              failureExplanation: null,
            },
            result: { normalized: true },
          },
        },
      };
    });
    const bridge = new ShockAuditBridge();
    installApp(bridge, {
      getHostCapabilities: () => ({ serverTools: {} }),
      callServerTool,
    });

    await expect(bridge.acknowledgeHostReasoningTaskResult(
      taskCoordinates,
      coordinates.accessToken,
      "host-result:one",
      "screen02-refresh:exact",
    )).resolves.toMatchObject({ outcome: "found" });

    expect(callServerTool).toHaveBeenCalledOnce();
    expect(callServerTool.mock.calls[0]?.[0]).toMatchObject({
      name: GET_SHOCKAUDIT_HOST_TASK_STATUS_TOOL,
      arguments: {
        operationId: "screen02-refresh:exact",
        taskId: "host-task:one",
        runId: "run-one",
        acknowledgeResultId: "host-result:one",
      },
    });
    expect(callServerTool.mock.calls[0]?.[0].arguments)
      .not.toHaveProperty("includeRunAudit");
  });

  it("forgets one task monotonically while preserving sibling private state", async () => {
    const screen02Task = privateCoordinatesFromPrepared(
      coordinates,
      preparedFixture(),
    );
    if (!screen02Task) throw new Error("fixture mismatch");
    const screen03Task = {
      ...screen02Task,
      taskId: "host-task:screen3",
      taskType: "screen03-overview-improvement" as const,
      screen: "screen-03" as const,
      candidatePoolId: null,
      selectedEventId: "event-one",
      expectedCandidatePoolFingerprint: null,
      expectedEventFingerprint: "fnv1a64:2233445566778899",
    };
    const setWidgetState = vi.fn(async (state: unknown) => {
      (window.openai as { widgetState?: unknown }).widgetState = state;
    });
    vi.stubGlobal("window", fullModeWindow({
      widgetState: {
        privateContent: {
          sentinel: { preserved: true },
          hostReasoningTasks: {
            schemaVersion: "shockaudit-private-host-task-registry-v1",
            tasks: [screen02Task, screen03Task],
          },
        },
      },
      setWidgetState,
    }));
    let resolveStatus!: (value: unknown) => void;
    const callServerTool = vi.fn(() => new Promise((resolve) => {
      resolveStatus = resolve;
    }));
    const bridge = new ShockAuditBridge();
    installApp(bridge, {
      getHostCapabilities: () => ({ serverTools: {} }),
      callServerTool,
    });

    const lateStatus = bridge.getHostReasoningTaskStatus(
      screen03Task,
      coordinates.accessToken,
    );
    await vi.waitFor(() => expect(callServerTool).toHaveBeenCalledOnce());
    await bridge.forgetHostReasoningTasks([screen03Task.taskId]);
    resolveStatus({
      isError: false,
      structuredContent: {
        schemaVersion: "shockaudit-host-task-status-result-v1",
        outcome: "found",
        task: {
          taskId: screen03Task.taskId,
          taskType: screen03Task.taskType,
          screen: screen03Task.screen,
          runId: screen03Task.runId,
          candidatePoolId: screen03Task.candidatePoolId,
          selectedEventId: screen03Task.selectedEventId,
          claimGroupId: screen03Task.claimGroupId,
          status: "awaiting-submission",
          messageChannel: "ui/message",
          messageDeliveryStatus: "accepted",
          createdAt: screen03Task.createdAt,
          expiresAt: screen03Task.expiresAt,
          retryCount: screen03Task.retryCount,
          resultId: null,
          failureCode: null,
          failureExplanation: null,
          panelReconciliation: {
            status: "not-ready",
            lastCheckedAt: null,
            reconciledAt: null,
            failureCode: null,
            failureExplanation: null,
          },
          result: null,
          outcomeValuesInspected: false,
        },
      },
    });
    await lateStatus;

    const saved = setWidgetState.mock.calls.at(-1)?.[0] as {
      privateContent: Record<string, unknown> & {
        hostReasoningTasks: { tasks: Array<{ taskId: string }> };
      };
    };
    expect(saved.privateContent).toMatchObject({
      sentinel: { preserved: true },
    });
    expect(saved.privateContent.hostReasoningTasks.tasks.map((task) => task.taskId))
      .toStrictEqual([screen02Task.taskId]);
  });
});
