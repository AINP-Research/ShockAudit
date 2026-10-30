import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "@modelcontextprotocol/ext-apps";

import {
  RECORD_SHOCKAUDIT_HOST_MESSAGE_DELIVERY_TOOL,
  type HostReasoningPrivateTaskCoordinates,
  type HostReasoningPreparedResult,
} from "../../src/ui/host-task/host-task-client";
import { SixScreenBridge } from "../../src/ui/six-screen/bridge";
import { completeReportFixture } from "../fixtures/complete-report";
import { restoreSixScreenWorkflowToolResponse } from "../../src/ui/six-screen/workflow-response";
import { attachHostTaskTransport } from
  "../../src/core/host-task-transport";
import {
  SIX_SCREEN_WORKFLOW_META_KEY,
  SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY,
} from
  "../../src/core/six-screen/metadata-keys";
import { fingerprintSixScreenValue, serializeSixScreenValue } from
  "../../src/core/six-screen/canonical";
import {
  SixScreenWorkflowProblemError,
  createSixScreenWorkflowProblem,
  encodeSixScreenWorkflowProblemText,
} from "../../src/core/six-screen/workflow-problem";
import {
  SIX_SCREEN_OPERATION_STATUS_SCHEMA_VERSION,
  SIX_SCREEN_OPERATION_STATUS_TOOL,
  createSixScreenOperationStatus,
  sixScreenOperationReference,
  sixScreenOperationRequestFingerprint,
} from "../../src/core/six-screen/operation-status";
import {
  SIX_SCREEN_RECOVERY_SNAPSHOT_TOOL,
  createSixScreenRecoverySnapshot,
} from "../../src/core/six-screen/recovery-snapshot";
import {
  SIX_SCREEN_HYDRATED_STATE_PAYLOAD_META_KEY,
  SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID,
  SIX_SCREEN_WORKFLOW_STATE_CHUNK_SCHEMA_VERSION,
  SIX_SCREEN_WORKFLOW_STATE_CHUNK_TOOL,
  createSixScreenWorkflowResponseContract,
  encodeSixScreenWorkflowPayload,
  sixScreenWorkflowStateChunks,
} from
  "../../src/core/six-screen/workflow-response-contract";
import {
  SHOCKAUDIT_VERSION,
  SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI,
} from "../../src/version";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const prepared: HostReasoningPreparedResult = {
  schemaVersion: "shockaudit-host-task-prepared-result-v1",
  phase: "prepared",
  taskId: "six-proof-task-one",
  taskType: "six-screen-policy-fact-proof",
  screen: "screen-02",
  runId: `sa6r_${"r".repeat(43)}`,
  candidatePoolId: null,
  selectedEventId: "event-one",
  claimGroupId: null,
  status: "prepared",
  messageChannel: null,
  messageDeliveryStatus: null,
  createdAt: "2026-09-14T12:00:00.000Z",
  expiresAt: "2026-09-14T12:05:00.000Z",
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
  visibleMessage:
    "Complete ShockAudit proof task six-proof-task-one with its structured submission tool.",
  privateModelContext: {
    schemaVersion: "shockaudit-host-reasoning-model-input-v1",
    task: {
      taskId: "six-proof-task-one",
      taskType: "six-screen-policy-fact-proof",
      runId: `sa6r_${"r".repeat(43)}`,
      candidatePoolId: null,
      selectedEventId: "event-one",
      claimGroupId: null,
      allowedSourceIds: ["source-one"],
    },
    instructions: ["Use only the frozen reviewed claims."],
    boundedFacts: { evidence: { sourceFacts: [] } },
    submission: {
      tool: "submit_six_screen_policy_fact_proof",
      schemaVersion: "shockaudit-six-screen-policy-fact-proof-submission-v1",
      capability: "signed-private-capability",
    },
    sourceContentIsUntrustedData: true,
    outcomeValuesInspected: false,
  },
};

const coordinates: HostReasoningPrivateTaskCoordinates = {
  schemaVersion: "shockaudit-private-host-task-coordinates-v1",
  taskId: prepared.taskId,
  taskType: prepared.taskType,
  screen: prepared.screen,
  runId: prepared.runId,
  candidatePoolId: prepared.candidatePoolId,
  selectedEventId: prepared.selectedEventId,
  claimGroupId: prepared.claimGroupId,
  expectedParentRevision: 12,
  expectedScopeFingerprint: "fnv1a64:0011223344556677",
  expectedCandidatePoolFingerprint: null,
  expectedEventFingerprint: "fnv1a64:1122334455667788",
  createdAt: prepared.createdAt,
  expiresAt: prepared.expiresAt,
  status: prepared.status,
  retryCount: prepared.retryCount,
  resultId: prepared.resultId,
};

function installApp(bridge: SixScreenBridge, app: Record<string, unknown>) {
  (bridge as unknown as { app: Record<string, unknown> }).app = app;
}

function receipt(accepted: boolean | null, channel = "ui/message") {
  return {
    schemaVersion: "shockaudit-host-task-message-record-result-v1",
    disposition: "updated",
    taskId: prepared.taskId,
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

function removeNullObjectProperties(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removeNullObjectProperties);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .filter(([, item]) => item !== null)
      .map(([key, item]) => [key, removeNullObjectProperties(item)]));
  }
  return value;
}

describe("six-screen signed-in proof bridge", () => {
  it("accepts a delayed compatibility globals result and removes its listener", async () => {
    let globalsListener: ((event: Event) => void) | null = null;
    const addEventListener = vi.fn((name: string,
      listener: (event: Event) => void) => {
      if (name === "openai:set_globals") globalsListener = listener;
    });
    const removeEventListener = vi.fn();
    const fakeWindow: Record<string, unknown> & { openai: Record<string, unknown> } = {
      openai: {}, addEventListener, removeEventListener,
    };
    fakeWindow.parent = fakeWindow;
    vi.stubGlobal("window", fakeWindow);
    const onToolResult = vi.fn();
    const bridge = new SixScreenBridge();
    await bridge.connect({ onHostView: vi.fn(), onToolResult });
    expect(addEventListener).toHaveBeenCalledWith(
      "openai:set_globals", expect.any(Function));
    const structuredContent = { runId: prepared.runId, revision: 4 };
    const fullResult = {
      structuredContent,
      _meta: { [SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY]: {
        toolName: "get_six_screen_workflow_v1",
      } },
    };
    (globalsListener as ((event: Event) => void) | null)?.({
      type: "openai:set_globals",
      detail: { globals: {
        toolOutput: structuredContent,
        toolResponseMetadata: { mcp_tool_result: fullResult },
      } },
    } as unknown as Event);
    expect(onToolResult).toHaveBeenCalledExactlyOnceWith({
      structuredContent,
      content: [],
      metadata: fullResult._meta,
      trace: expect.objectContaining({
        toolName: "get_six_screen_workflow_v1",
        bridgePath: "chatgpt-compatibility",
      }),
    });
    bridge.disconnect();
    expect(removeEventListener).toHaveBeenCalledWith(
      "openai:set_globals", expect.any(Function));
  });

  it("registers standards-host result and cancellation handlers before connect", async () => {
    vi.stubGlobal("window", { parent: {}, openai: {} });
    const registrationAtConnect: Array<Record<string, boolean>> = [];
    const listeners = new Map<string, (params: unknown) => void>();
    vi.spyOn(App.prototype, "addEventListener").mockImplementation(
      (name, listener) => {
        listeners.set(String(name), listener as (params: unknown) => void);
      },
    );
    vi.spyOn(App.prototype, "removeEventListener").mockImplementation(
      () => undefined,
    );
    vi.spyOn(App.prototype, "connect").mockImplementation(async function(
      this: App,
    ) {
      registrationAtConnect.push({
        toolResult: listeners.has("toolresult"),
        toolCancelled: listeners.has("toolcancelled"),
        hostContext: typeof this.onhostcontextchanged === "function",
      });
    });
    vi.spyOn(App.prototype, "getHostContext").mockReturnValue(undefined);
    vi.spyOn(App.prototype, "close").mockResolvedValue(undefined);
    const onToolResult = vi.fn();
    const onToolCancelled = vi.fn();
    const bridge = new SixScreenBridge();

    await bridge.connect({
      onHostView: vi.fn(),
      onToolResult,
      onToolCancelled,
    });

    expect(registrationAtConnect).toEqual([{
      toolResult: true,
      toolCancelled: true,
      hostContext: true,
    }]);
    listeners.get("toolresult")?.({
      content: [{ type: "text", text: "controlled" }],
      structuredContent: { runId: `sa6r_${"r".repeat(43)}`, revision: 2 },
      _meta: {
        [SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY]: {
          toolName: "get_six_screen_workflow_v1",
        },
      },
    });
    expect(onToolResult).toHaveBeenCalledWith(expect.objectContaining({
      trace: expect.objectContaining({
        toolName: "get_six_screen_workflow_v1",
        bridgePath: "mcp-app",
      }),
    }));
    listeners.get("toolcancelled")?.({ reason: " user action\n" });
    expect(onToolCancelled).toHaveBeenCalledWith("user action");
    bridge.disconnect();
  });

  it.each([
    "personalize_screen3_advice",
    "analyze_study_first_events",
    "advance_study_first_mechanism_job",
    "personalize_screen6_plan",
  ])("allows the bounded provider window for %s without dispatching a provider", async (action) => {
    vi.stubGlobal("window", { openai: {} });
    const callServerTool = vi.fn(async () => ({
      structuredContent: { status: "controlled-response" },
      _meta: {},
    }));
    const bridge = new SixScreenBridge();
    installApp(bridge, {
      getHostCapabilities: () => ({ serverTools: {} }),
      callServerTool,
    });
    const arguments_ = {
      runId: "controlled-run",
      mutation: { action, operationId: "controlled-operation" },
    };

    await bridge.callToolWithMetadata(
      "mutate_six_screen_workflow_v1", arguments_,
    );
    expect(callServerTool).toHaveBeenCalledExactlyOnceWith({
      name: "mutate_six_screen_workflow_v1",
      arguments: arguments_,
    }, { timeout: 360_000 });
  });

  it("keeps reads, ordinary mutations and unknown actions at the SDK default window", async () => {
    vi.stubGlobal("window", { openai: {} });
    const callServerTool = vi.fn(async () => ({
      structuredContent: { status: "controlled-response" },
      _meta: {},
    }));
    const bridge = new SixScreenBridge();
    installApp(bridge, {
      getHostCapabilities: () => ({ serverTools: {} }),
      callServerTool,
    });
    const operations = [
      { name: "get_six_screen_workflow_v1", args: { runId: "controlled-run" } },
      { name: "mutate_six_screen_workflow_v1", args: {
        mutation: { action: "open_screen_3" },
      } },
      { name: "mutate_six_screen_workflow_v1", args: {
        mutation: { action: "unknown_future_action" },
      } },
      { name: "mutate_six_screen_workflow_v1", args: {
        action: "personalize_screen3_advice",
      } },
    ];
    for (const { name, args } of operations) {
      await bridge.callToolWithMetadata(name, args);
      expect(callServerTool).toHaveBeenLastCalledWith({
        name, arguments: args,
      }, { timeout: 60_000 });
    }
    expect(callServerTool).toHaveBeenCalledTimes(operations.length);
  });

  it("does not claim a local SDK deadline for the compatibility bridge", async () => {
    const callTool = vi.fn(async () => ({
      structuredContent: { status: "controlled-response" },
    }));
    vi.stubGlobal("window", { openai: { callTool } });
    const args = { mutation: { action: "personalize_screen3_advice" } };

    const result = await new SixScreenBridge().callToolWithMetadata(
      "mutate_six_screen_workflow_v1", args,
    );

    expect(callTool).toHaveBeenCalledExactlyOnceWith(
      "mutate_six_screen_workflow_v1", args,
    );
    expect(result.trace.bridgePath).toBe("chatgpt-compatibility");
  });

  it("requests fullscreen through the standards host bridge and reflects the result", async () => {
    vi.stubGlobal("window", { parent: {}, openai: {} });
    const callback = vi.fn();
    const requestDisplayMode = vi.fn(async () => ({ mode: "fullscreen" as const }));
    const bridge = new SixScreenBridge();
    installApp(bridge, {
      requestDisplayMode,
      getHostContext: () => ({
        displayMode: "inline",
        availableDisplayModes: ["inline", "fullscreen"],
      }),
    });
    (bridge as unknown as {
      hostViewCallback: (view: Record<string, unknown>) => void;
    }).hostViewCallback = callback;

    await expect(bridge.requestDisplayMode("fullscreen")).resolves.toBe(true);
    expect(requestDisplayMode).toHaveBeenCalledWith({ mode: "fullscreen" });
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      connected: true,
      displayMode: "fullscreen",
      canFullscreen: true,
    }));
  });

  it("uses the advertised ChatGPT compatibility display-mode method when needed", async () => {
    const requestDisplayMode = vi.fn(async () => ({ mode: "fullscreen" as const }));
    vi.stubGlobal("window", {
      parent: {},
      openai: { requestDisplayMode },
    });
    const bridge = new SixScreenBridge();

    await expect(bridge.requestDisplayMode("fullscreen")).resolves.toBe(true);
    expect(requestDisplayMode).toHaveBeenCalledWith({ mode: "fullscreen" });
  });

  it("joins compatibility-call public content to the matching full MCP metadata wrapper", async () => {
    const direct = { structuredContent: { ok: true, revision: 4 } };
    const privateSnapshot = { runId: "private-run-coordinate" };
    vi.stubGlobal("window", {
      openai: {
        callTool: vi.fn(async () => direct),
        toolResponseMetadata: {
          status: "complete",
          mcp_tool_result: {
            ...direct,
            _meta: {
              "shockaudit/six-screen-workflow-v1": privateSnapshot,
            },
          },
        },
      },
    });
    const response = await new SixScreenBridge().callToolWithMetadata<{
      ok: boolean;
      revision: number;
    }>("compatibility_tool", { operationId: "compatibility-call" });
    expect(response.structuredContent).toEqual(direct.structuredContent);
    expect(response.metadata).toEqual({
      "shockaudit/six-screen-workflow-v1": privateSnapshot,
    });
  });

  it("restores the workflow when ChatGPT exposes raw response metadata without a result wrapper", async () => {
    const state = completeReportFixture();
    const privateSnapshot = { schemaVersion: "shockaudit-six-screen-private-v1",
      runId: state.runId, accessToken: `sa6a_${"a".repeat(43)}`,
      revision: state.revision, stateFingerprint: fingerprintSixScreenValue(state), state };
    const publicProjection = { schemaVersion: "shockaudit-six-screen-public-v1",
      runId: state.runId, revision: state.revision, activeScreen: 4, nullableField: null };
    const contract = createSixScreenWorkflowResponseContract({ appVersion: SHOCKAUDIT_VERSION,
      uiResourceUri: SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI,
      toolName: "get_six_screen_workflow_v1", operationStage: "status",
      publicProjection: publicProjection as never, privateSnapshot: privateSnapshot as never });
    const { state: _, ...coordinates } = privateSnapshot;
    const metadata = { [SIX_SCREEN_WORKFLOW_META_KEY]: coordinates,
      [SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY]: contract };
    const callTool = vi.fn(async () => ({ structuredContent: { ...publicProjection, nullableField: undefined } }));
    vi.stubGlobal("window", { openai: { callTool, toolResponseMetadata: metadata } });
    const response = await new SixScreenBridge().callToolWithMetadata("get_six_screen_workflow_v1",
      { runId: state.runId, accessToken: privateSnapshot.accessToken });
    const restored = restoreSixScreenWorkflowToolResponse({ ...response, metadata: response.metadata });
    expect(restored.snapshot.state).toEqual(state);
    expect(restored.projection).toEqual(publicProjection);
    expect(callTool).toHaveBeenCalledTimes(1);
  });

  it.each(["run", "revision"])("does not attach stale raw host metadata with a different %s", async (mismatch) => {
    const runId = `sa6r_${"r".repeat(43)}`;
    vi.stubGlobal("window", { openai: {
      callTool: vi.fn(async () => ({ structuredContent: { runId, revision: 8 } })),
      toolResponseMetadata: { [SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY]: {
        runId: mismatch === "run" ? "another-workflow" : runId,
        revision: mismatch === "revision" ? 7 : 8,
      } },
    } });
    const response = await new SixScreenBridge().callToolWithMetadata("get_six_screen_workflow_v1", { runId });
    expect(response.metadata).toEqual({});
  });

  it("classifies a lost workflow payload for canonical recovery without resending the action", async () => {
    const callTool = vi.fn(async () => ({ content: [{ type: "text", text: "Interrupted display" }] }));
    vi.stubGlobal("window", { openai: { callTool } });
    let failure: unknown;
    try { await new SixScreenBridge().callToolWithMetadata("mutate_six_screen_workflow_v1", {
      mutation: { action: "open_screen_5", expectedRevision: 12, operationId: "one-screen5-navigation" },
    }); } catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(SixScreenWorkflowProblemError);
    expect((failure as SixScreenWorkflowProblemError).problem).toMatchObject({
      action: "open_screen_5", stage: "serialization", commitCertainty: "unknown", recovery: "check_status",
    });
    expect(callTool).toHaveBeenCalledTimes(1);
  });

  it("joins a null-elided host-task receipt to its canonical metadata wrapper", async () => {
    const canonical = attachHostTaskTransport({
      schemaVersion: "shockaudit-host-task-status-result-v1",
      outcome: "found",
      task: {
        taskId: "task-one",
        resultId: null,
        failureCode: null,
      },
    }, "status");
    const direct = {
      structuredContent: removeNullObjectProperties(canonical) as
        Record<string, unknown>,
    };
    const privateSnapshot = { runId: "private-run-coordinate" };
    vi.stubGlobal("window", {
      openai: {
        callTool: vi.fn(async () => direct),
        toolResponseMetadata: {
          call_tool_result: {
            structuredContent: canonical,
            _meta: {
              "shockaudit/six-screen-workflow-v1": privateSnapshot,
            },
          },
        },
      },
    });
    const response = await new SixScreenBridge().callToolWithMetadata(
      "compatibility_tool",
      { operationId: "compatibility-call" },
    );
    expect(response.structuredContent).toEqual(direct.structuredContent);
    expect(response.metadata).toEqual({
      "shockaudit/six-screen-workflow-v1": privateSnapshot,
    });
  });

  it("does not join conflicting canonical host-task wrappers", async () => {
    const first = attachHostTaskTransport({
      schemaVersion: "shockaudit-host-task-status-result-v1",
      outcome: "not-found",
      task: null,
    }, "status");
    const conflicting = attachHostTaskTransport({
      schemaVersion: "shockaudit-host-task-status-result-v1",
      outcome: "found",
      task: { taskId: "different-task" },
    }, "status");
    const direct = {
      structuredContent: removeNullObjectProperties(first) as
        Record<string, unknown>,
    };
    vi.stubGlobal("window", {
      openai: {
        callTool: vi.fn(async () => direct),
        toolResponseMetadata: {
          call_tool_result: {
            structuredContent: conflicting,
            _meta: { privateValue: true },
          },
        },
      },
    });
    const response = await new SixScreenBridge().callToolWithMetadata(
      "compatibility_tool",
      { operationId: "conflicting-call" },
    );
    expect(response.structuredContent).toEqual(direct.structuredContent);
    expect(response.metadata).toEqual({});
  });

  it("recovers a committed authenticated workflow result from a lost direct receipt", async () => {
    const runId = `sa6r_${"r".repeat(43)}`;
    const accessToken = `sa6a_${"a".repeat(43)}`;
    const committed = {
      structuredContent: { runId, revision: 9, status: "shock_confirmed" },
      _meta: {
        "shockaudit/sixScreenWorkflow": {
          runId,
          accessToken,
          revision: 9,
        },
      },
    };
    vi.stubGlobal("window", {
      openai: {
        callTool: vi.fn(async () => ({
          isError: true,
          content: [{
            type: "text",
            text: "MCP error -32000 INVALID_ARGUMENT after the server commit",
          }],
        })),
        toolResponseMetadata: { call_tool_result: committed },
      },
    });

    await expect(new SixScreenBridge().callToolWithMetadata(
      "mutate_six_screen_workflow_v1",
      {
        runId,
        accessToken,
        mutation: { expectedRevision: 8, operationId: "same-operation" },
      },
    )).resolves.toEqual({
      structuredContent: committed.structuredContent,
      content: [],
      metadata: committed._meta,
      trace: {
        toolName: "mutate_six_screen_workflow_v1",
        bridgePath: "chatgpt-compatibility",
        metadataKeys: ["shockaudit/sixScreenWorkflow"],
        structuredContentKeys: ["runId", "revision", "status"],
      },
    });
  });

  it("rejects a nested lost-receipt result bound to different workflow coordinates", async () => {
    const runId = `sa6r_${"r".repeat(43)}`;
    const accessToken = `sa6a_${"a".repeat(43)}`;
    vi.stubGlobal("window", {
      openai: {
        callTool: vi.fn(async () => ({
          isError: true,
          content: [{
            type: "text",
            text: "MCP error -32000 INVALID_ARGUMENT after the server commit",
          }],
        })),
        toolResponseMetadata: {
          call_tool_result: {
            structuredContent: { runId: "different-run", revision: 9 },
            _meta: {
              "shockaudit/sixScreenWorkflow": {
                runId: "different-run",
                accessToken,
                revision: 9,
              },
            },
          },
        },
      },
    });

    let caught: unknown;
    try {
      await new SixScreenBridge().callToolWithMetadata(
        "mutate_six_screen_workflow_v1",
        { runId, accessToken, mutation: { expectedRevision: 8 } },
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SixScreenWorkflowProblemError);
    expect((caught as SixScreenWorkflowProblemError).problem).toMatchObject({
      code: "response_contract",
      stage: "serialization",
      commitCertainty: "unknown",
      recovery: "check_status",
    });
  });

  it("sanitizes a returned nested MCP wrapper error", async () => {
    vi.stubGlobal("window", {
      openai: {
        callTool: vi.fn(async () => ({
          isError: true,
          content: [{
            type: "text",
            text: "MCP error -32000 INVALID_ARGUMENT RuntimeException TextContent(sa6a_PRIVATE)",
          }],
        })),
      },
    });
    let caught: unknown;
    try {
      await new SixScreenBridge().callToolWithMetadata(
        "compatibility_tool",
        {},
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SixScreenWorkflowProblemError);
    expect((caught as SixScreenWorkflowProblemError).problem).toMatchObject({
      code: "response_contract",
      stage: "serialization",
      recovery: "check_status",
      safeCauseCodes: ["response_contract_invalid"],
    });
    expect(JSON.stringify(caught)).not.toContain("sa6a_PRIVATE");
  });

  it("requires a saved-status check when a transport interruption has an unknown outcome", async () => {
    vi.stubGlobal("window", {
      openai: {
        callTool: vi.fn(async () => ({
          isError: true,
          content: [{
            type: "text",
            text:
              "MCP error -32000: Error: Transport response interrupted after tool completion. sa6r_PRIVATE",
          }],
        })),
      },
    });
    let caught: unknown;
    try {
      await new SixScreenBridge().callToolWithMetadata(
        "compatibility_tool",
        {},
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SixScreenWorkflowProblemError);
    expect((caught as SixScreenWorkflowProblemError).problem).toMatchObject({
      code: "response_contract",
      stage: "serialization",
      commitCertainty: "unknown",
      recovery: "check_status",
    });
    expect(JSON.stringify(caught)).not.toContain("sa6r_PRIVATE");
  });

  it.each(["mcp-app", "chatgpt-compatibility"] as const)(
    "decodes typed Screen 3 request-contract failures on the %s bridge without retry",
    async (path) => {
      const problem = createSixScreenWorkflowProblem({
        code: "request_contract",
        action: "open_screen_3",
        operationId: "screen3-open-controlled",
        screen: 3,
        fieldIssues: [{
          fieldPath: "proposedTiming.year",
          code: "invalid_type",
        }],
      });
      const toolResult = {
        isError: true,
        content: [{
          type: "text",
          text: encodeSixScreenWorkflowProblemText(problem),
        }],
      };
      const args = {
        runId: `sa6r_${"r".repeat(43)}`,
        accessToken: `sa6a_${"a".repeat(43)}`,
        mutation: {
          action: "open_screen_3",
          expectedRevision: 7,
          operationId: "screen3-open-controlled",
          proposedTiming: {
            mode: "year",
            year: "2020",
            milestoneReference: null,
          },
        },
      };
      const call = vi.fn(async () => toolResult);
      const bridge = new SixScreenBridge();
      if (path === "mcp-app") {
        vi.stubGlobal("window", { openai: {} });
        installApp(bridge, {
          getHostCapabilities: () => ({ serverTools: {} }),
          callServerTool: call,
        });
      } else {
        vi.stubGlobal("window", { openai: { callTool: call } });
      }
      let caught: unknown;
      try {
        await bridge.callToolWithMetadata(
          "mutate_six_screen_workflow_v1",
          args,
        );
      } catch (error) {
        caught = error;
      }
      expect(call).toHaveBeenCalledTimes(1);
      expect(caught).toBeInstanceOf(SixScreenWorkflowProblemError);
      expect((caught as SixScreenWorkflowProblemError).problem).toEqual(
        problem,
      );
      expect((caught as SixScreenWorkflowProblemError).problem.fieldIssues)
        .toEqual([{
          fieldPath: "proposedTiming.year",
          code: "invalid_type",
        }]);
    },
  );

  it("persists and clears only the matching Screen 3 recovery coordinates", async () => {
    const runId = `sa6r_${"r".repeat(43)}`;
    const recovery = {
      schemaVersion: "screen-03-handoff-recovery-v1" as const,
      runId,
      operationId: "screen3-open-0011223344556677",
      operationKind: "open_screen_3" as const,
      inputFingerprint: "fnv1a64:0011223344556677",
      dependencyFingerprint: "fnv1a64:1122334455667788",
      state: "outcome_unknown" as const,
    };
    let widgetState: Record<string, unknown> = {
      privateContent: { retained: "controlled" },
    };
    vi.stubGlobal("window", { openai: {
      get widgetState() { return widgetState; },
      setWidgetState: vi.fn(async (next: Record<string, unknown>) => {
        widgetState = next;
      }),
    } });
    const bridge = new SixScreenBridge();

    await bridge.saveScreen3HandoffRecovery(recovery);
    expect(bridge.getInitialScreen3HandoffRecovery(runId)).toEqual(recovery);
    await bridge.clearScreen3HandoffRecovery({
      runId,
      operationId: "different-operation",
    });
    expect(bridge.getInitialScreen3HandoffRecovery(runId)).toEqual(recovery);
    await bridge.clearScreen3HandoffRecovery({
      runId,
      operationId: recovery.operationId,
    });
    expect(bridge.getInitialScreen3HandoffRecovery(runId)).toBeNull();
    const terminal = {
      ...recovery,
      state: "saved_display_unavailable" as const,
    };
    await bridge.saveScreen3HandoffRecovery(terminal);
    expect(bridge.getInitialScreen3HandoffRecovery(runId)).toEqual(terminal);
    expect((widgetState.privateContent as Record<string, unknown>).retained)
      .toBe("controlled");
  });

  it.each(["mcp-app", "chatgpt-compatibility"] as const)(
    "strictly binds compact operation status on the %s bridge",
    async (path) => {
      const request = {
        runId: `sa6r_${"r".repeat(43)}`,
        operationId: "screen3-open-0011223344556677",
        operationKind: "open_screen_3",
        inputFingerprint: "fnv1a64:0011223344556677",
      };
      const status = createSixScreenOperationStatus({
        schemaVersion: SIX_SCREEN_OPERATION_STATUS_SCHEMA_VERSION,
        buildId: SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID,
        appVersion: SHOCKAUDIT_VERSION,
        uiResourceUri: SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI,
        toolName: SIX_SCREEN_OPERATION_STATUS_TOOL,
        requestFingerprint: sixScreenOperationRequestFingerprint(request),
        runId: request.runId,
        revision: 8,
        stateFingerprint: "fnv1a64:1122334455667788",
        operationReference: sixScreenOperationReference(
          request.operationId,
        ),
        operationKind: request.operationKind,
        inputFingerprint: request.inputFingerprint,
        lookup: "unknown_or_expired",
        commitCertainty: "unknown",
        committedRevision: null,
        mutationOutcome: null,
        completedAt: null,
        resultFingerprint: null,
        receiptValidated: false,
        screen3Receipt: null,
        destination: {
          screen: 3,
          state: "unknown",
          displayReady: false,
          localRebuildAvailable: false,
          safeCode: "operation_receipt_unknown",
        },
      });
      const call = vi.fn(async () => ({ structuredContent: status }));
      const bridge = new SixScreenBridge();
      if (path === "mcp-app") {
        vi.stubGlobal("window", { openai: {} });
        installApp(bridge, {
          getHostCapabilities: () => ({ serverTools: {} }),
          callServerTool: call,
        });
      } else {
        vi.stubGlobal("window", { openai: { callTool: call } });
      }

      await expect(bridge.getSixScreenOperationStatus({
        accessToken: `sa6a_${"a".repeat(43)}`,
        request,
      })).resolves.toEqual(status);
      expect(call).toHaveBeenCalledTimes(1);
      if (path === "mcp-app") {
        expect(call).toHaveBeenCalledWith({
          name: SIX_SCREEN_OPERATION_STATUS_TOOL,
          arguments: {
            ...request,
            accessToken: `sa6a_${"a".repeat(43)}`,
          },
        }, { timeout: 60_000 });
      } else {
        expect(call).toHaveBeenCalledWith(
          SIX_SCREEN_OPERATION_STATUS_TOOL,
          { ...request, accessToken: `sa6a_${"a".repeat(43)}` },
        );
      }
    },
  );

  it.each(["mcp-app", "chatgpt-compatibility"] as const)(
    "restores a compressed canonical snapshot on the %s bridge",
    async (path) => {
      const runId = `sa6r_${"r".repeat(43)}`;
      const accessToken = `sa6a_${"a".repeat(43)}`;
      const state = {
        schemaVersion: "shockaudit-six-screen-workflow-v1",
        runId,
        revision: 8,
        activeScreen: 3,
      };
      const projection = {
        schemaVersion: "shockaudit-six-screen-public-v1",
        runId,
        revision: 8,
        activeScreen: 3,
      };
      const result = await createSixScreenRecoverySnapshot({
        appVersion: SHOCKAUDIT_VERSION,
        uiResourceUri: SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI,
        state,
        publicProjection: projection,
      });
      const call = vi.fn(async () => ({ structuredContent: result }));
      const bridge = new SixScreenBridge();
      if (path === "mcp-app") {
        vi.stubGlobal("window", { openai: {} });
        installApp(bridge, {
          getHostCapabilities: () => ({ serverTools: {} }),
          callServerTool: call,
        });
      } else {
        vi.stubGlobal("window", { openai: { callTool: call } });
      }

      await expect(bridge.getSixScreenRecoverySnapshot({
        runId,
        accessToken,
      })).resolves.toMatchObject({
        snapshot: {
          runId,
          accessToken,
          revision: 8,
          state,
        },
        projection,
      });
      expect(call).toHaveBeenCalledTimes(1);
      if (path === "mcp-app") {
        expect(call).toHaveBeenCalledWith({
          name: SIX_SCREEN_RECOVERY_SNAPSHOT_TOOL,
          arguments: { runId, accessToken },
        }, { timeout: 60_000 });
      } else {
        expect(call).toHaveBeenCalledWith(
          SIX_SCREEN_RECOVERY_SNAPSHOT_TOOL,
          { runId, accessToken },
        );
      }
    },
  );

  it.each(["mcp-app", "chatgpt-compatibility"] as const)(
    "restores a large committed workflow in one compressed call on the %s bridge",
    async (path) => {
      const runId = `sa6r_${"r".repeat(43)}`;
      const accessToken = `sa6a_${"a".repeat(43)}`;
      let seed = 0x9e3779b9;
      const alphabet =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      let retained = "";
      for (let index = 0; index < 420_000; index += 1) {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        retained += alphabet[seed >>> 26];
      }
      const state = {
        schemaVersion: "shockaudit-six-screen-workflow-v1",
        runId,
        revision: 18,
        activeScreen: 6,
        retained,
      };
      const projection = {
        schemaVersion: "shockaudit-six-screen-public-v1",
        runId,
        revision: 18,
        activeScreen: 6,
      };
      const compressed = await createSixScreenRecoverySnapshot({
        appVersion: SHOCKAUDIT_VERSION,
        uiResourceUri: SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI,
        state,
        publicProjection: projection,
      });
      const call = vi.fn(async (...callArguments: unknown[]) => {
        const request = path === "mcp-app"
          ? callArguments[0] as { name: string;
              arguments: Record<string, unknown> }
          : { name: callArguments[0] as string,
              arguments: callArguments[1] as Record<string, unknown> };
        expect(request.name).toBe(SIX_SCREEN_RECOVERY_SNAPSHOT_TOOL);
        return { structuredContent: compressed };
      });
      const bridge = new SixScreenBridge();
      if (path === "mcp-app") {
        vi.stubGlobal("window", { openai: {} });
        installApp(bridge, {
          getHostCapabilities: () => ({ serverTools: {} }),
          callServerTool: call,
        });
      } else {
        vi.stubGlobal("window", { openai: { callTool: call } });
      }

      await expect(bridge.getSixScreenRecoverySnapshot({
        runId,
        accessToken,
      })).resolves.toMatchObject({
        snapshot: { runId, accessToken, revision: 18, state },
        projection,
      });
      expect(call).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    ["mcp-app", "declared structured chunk", false],
    ["chatgpt-compatibility", "declared structured chunk", false],
    ["mcp-app", "authenticated recovery fallback", true],
    ["chatgpt-compatibility", "authenticated recovery fallback", true],
  ] as const)(
    "retains authenticated large-state hydration on the %s bridge with %s",
    async (path, _mode, recoveryFallback) => {
      const runId = `sa6r_${"r".repeat(43)}`;
      const accessToken = `sa6a_${"a".repeat(43)}`;
      let seed = 0x9e3779b9;
      const alphabet =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      let retained = "";
      for (let index = 0; index < 420_000; index += 1) {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        retained += alphabet[seed >>> 26];
      }
      const state = {
        schemaVersion: "shockaudit-six-screen-workflow-v1",
        runId,
        revision: 18,
        activeScreen: 6,
        retained,
      };
      const projection = {
        schemaVersion: "shockaudit-six-screen-public-v1",
        runId,
        revision: 18,
        activeScreen: 6,
      };
      const stateFingerprint = fingerprintSixScreenValue(state);
      const contract = createSixScreenWorkflowResponseContract({
        appVersion: SHOCKAUDIT_VERSION,
        uiResourceUri: SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI,
        toolName: "get_six_screen_workflow_v1",
        operationStage: "read",
        publicProjection: projection,
        privateSnapshot: {
          schemaVersion: "shockaudit-six-screen-private-v1",
          runId,
          revision: 18,
          stateFingerprint,
          state,
        },
      });
      expect(contract.statePayloadMode).toBe("chunked");
      const encoded = encodeSixScreenWorkflowPayload(
        serializeSixScreenValue(state),
      );
      const chunks = sixScreenWorkflowStateChunks(encoded.encodedPayload);
      const recovery = await createSixScreenRecoverySnapshot({
        appVersion: SHOCKAUDIT_VERSION,
        uiResourceUri: SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI,
        state,
        publicProjection: projection,
      });
      const initial = {
        structuredContent: projection,
        _meta: {
          [SIX_SCREEN_WORKFLOW_META_KEY]: {
            schemaVersion: "shockaudit-six-screen-private-v1",
            runId,
            accessToken,
            revision: 18,
            stateFingerprint,
          },
          [SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY]: contract,
        },
      };
      const call = vi.fn(async (...callArguments: unknown[]) => {
        const request = path === "mcp-app"
          ? callArguments[0] as { name: string;
              arguments: Record<string, unknown> }
          : { name: callArguments[0] as string,
              arguments: callArguments[1] as Record<string, unknown> };
        if (request.name === "get_six_screen_workflow_v1") return initial;
        if (request.name === SIX_SCREEN_RECOVERY_SNAPSHOT_TOOL) {
          return { structuredContent: recovery };
        }
        expect(request.name).toBe(SIX_SCREEN_WORKFLOW_STATE_CHUNK_TOOL);
        const chunkIndex = request.arguments.chunkIndex as number;
        const chunk = chunks[chunkIndex]!;
        const body = {
          schemaVersion: SIX_SCREEN_WORKFLOW_STATE_CHUNK_SCHEMA_VERSION,
          buildId: SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID,
          appVersion: SHOCKAUDIT_VERSION,
          uiResourceUri: SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI,
          toolName: SIX_SCREEN_WORKFLOW_STATE_CHUNK_TOOL,
          transferId: contract.stateTransferId,
          runId,
          revision: 18,
          stateFingerprint,
          encodedStateBytes: contract.encodedStateBytes,
          canonicalStateBytes: contract.canonicalStateBytes,
          chunkIndex,
          chunkCount: chunks.length,
          chunkBytes: new TextEncoder().encode(chunk).byteLength,
          chunkFingerprint: fingerprintSixScreenValue(chunk),
          ...(recoveryFallback ? {} : { encodedStateChunk: chunk }),
        };
        return {
          structuredContent: {
            ...body,
            responseFingerprint: fingerprintSixScreenValue(body),
          },
        };
      });
      const bridge = new SixScreenBridge();
      if (path === "mcp-app") {
        vi.stubGlobal("window", { openai: {} });
        installApp(bridge, {
          getHostCapabilities: () => ({ serverTools: {} }),
          callServerTool: call,
        });
      } else {
        vi.stubGlobal("window", { openai: { callTool: call } });
      }

      const response = await bridge.callToolWithMetadata(
        "get_six_screen_workflow_v1",
        { runId, accessToken },
      );
      expect(response.structuredContent).toEqual(projection);
      expect(response.metadata[SIX_SCREEN_HYDRATED_STATE_PAYLOAD_META_KEY])
        .toBe(encoded.encodedPayload);
      expect(call).toHaveBeenCalledTimes(
        recoveryFallback ? 3 : 1 + chunks.length,
      );
    },
  );

  it.each(["mcp-app", "chatgpt-compatibility"] as const)(
    "decodes a typed problem from a rejected %s bridge promise without retry",
    async (path) => {
      const problem = createSixScreenWorkflowProblem({
        code: "revision_conflict",
        action: "open_screen_3",
        operationId: "screen3-open-controlled",
        screen: 3,
        expectedRevision: 7,
        actualRevision: 8,
      });
      const call = vi.fn(async () => {
        throw new Error(
          `MCP error -32603: ${encodeSixScreenWorkflowProblemText(problem)}`,
        );
      });
      const bridge = new SixScreenBridge();
      if (path === "mcp-app") {
        vi.stubGlobal("window", { openai: {} });
        installApp(bridge, {
          getHostCapabilities: () => ({ serverTools: {} }),
          callServerTool: call,
        });
      } else {
        vi.stubGlobal("window", { openai: { callTool: call } });
      }
      let caught: unknown;
      try {
        await bridge.callToolWithMetadata(
          "mutate_six_screen_workflow_v1",
          {
            runId: `sa6r_${"r".repeat(43)}`,
            accessToken: `sa6a_${"a".repeat(43)}`,
            mutation: {
              action: "open_screen_3",
              expectedRevision: 7,
              operationId: "screen3-open-controlled",
            },
          },
        );
      } catch (error) {
        caught = error;
      }
      expect(call).toHaveBeenCalledTimes(1);
      expect(caught).toBeInstanceOf(SixScreenWorkflowProblemError);
      expect((caught as SixScreenWorkflowProblemError).problem).toEqual(
        problem,
      );
    },
  );

  it("refuses to deliver a task under mismatched private coordinates", async () => {
    const bridge = new SixScreenBridge();
    await expect(bridge.deliverSixScreenIntelligenceProof({
      prepared,
      coordinates: { ...coordinates, selectedEventId: "another-event" },
      accessToken: `sa6a_${"a".repeat(43)}`,
    })).rejects.toThrow("mismatched proof-task coordinates");
  });

  it("journals an unavailable private context as a terminal rejection", async () => {
    vi.stubGlobal("window", { openai: {} });
    const sendMessage = vi.fn();
    const callServerTool = vi.fn(async (call: {
      name: string;
      arguments: Record<string, unknown>;
    }) => ({
      isError: false,
      structuredContent: receipt(false, "unavailable"),
    }));
    const bridge = new SixScreenBridge();
    installApp(bridge, {
      getHostCapabilities: () => ({
        serverTools: {},
        message: { text: {} },
      }),
      callServerTool,
      sendMessage,
    });

    const delivery = await bridge.deliverSixScreenIntelligenceProof({
      prepared,
      coordinates,
      accessToken: `sa6a_${"a".repeat(43)}`,
    });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(callServerTool).toHaveBeenCalledOnce();
    expect(callServerTool).toHaveBeenCalledWith({
      name: RECORD_SHOCKAUDIT_HOST_MESSAGE_DELIVERY_TOOL,
      arguments: expect.objectContaining({
        phase: "resolved",
        requestOperationId: null,
        channel: "unavailable",
        accepted: false,
        failureCode: "private-context-unavailable",
      }),
    }, { timeout: 60_000 });
    expect(delivery).toMatchObject({
      accepted: false,
      channel: "unavailable",
      failureCode: "private-context-unavailable",
      record: {
        status: "message-rejected",
        messageDeliveryStatus: "rejected",
      },
    });
  });

  it("publishes private context and journals before opening one visible turn", async () => {
    vi.stubGlobal("window", { openai: {} });
    const order: string[] = [];
    const callServerTool = vi.fn(async (call: {
      name: string;
      arguments: { phase?: string };
    }) => {
      order.push(`journal:${call.arguments.phase}`);
      return {
        isError: false,
        structuredContent: receipt(
          call.arguments.phase === "requested" ? null : true,
        ),
      };
    });
    const updateModelContext = vi.fn(async () => {
      order.push("private-context");
    });
    const sendMessage = vi.fn(async () => {
      order.push("visible-message");
      return { isError: false };
    });
    const bridge = new SixScreenBridge();
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

    const delivery = await bridge.deliverSixScreenIntelligenceProof({
      prepared,
      coordinates,
      accessToken: `sa6a_${"a".repeat(43)}`,
    });

    expect(order).toEqual([
      "private-context",
      "journal:requested",
      "visible-message",
      "journal:resolved",
    ]);
    expect(sendMessage).toHaveBeenCalledOnce();
    expect(delivery).toMatchObject({
      accepted: true,
      channel: "ui/message",
      failureCode: null,
      record: {
        status: "awaiting-submission",
        messageDeliveryStatus: "accepted",
      },
    });
  });

  it("scrubs a private context write that settles after its delivery timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", { openai: {} });
    let settlePublication!: () => void;
    const pendingPublication = new Promise<void>((resolve) => {
      settlePublication = () => resolve();
    });
    const updateModelContext = vi.fn()
      .mockImplementationOnce(async () => pendingPublication)
      .mockResolvedValue(undefined);
    const sendMessage = vi.fn();
    const callServerTool = vi.fn(async () => ({
      isError: false,
      structuredContent: receipt(false, "unavailable"),
    }));
    const bridge = new SixScreenBridge();
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

    const deliveryPromise = bridge.deliverSixScreenIntelligenceProof({
      prepared,
      coordinates,
      accessToken: `sa6a_${"a".repeat(43)}`,
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(updateModelContext).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(5_000);
    await expect(deliveryPromise).resolves.toMatchObject({
      accepted: false,
      channel: "unavailable",
      failureCode: "private-context-unavailable",
    });
    expect(sendMessage).not.toHaveBeenCalled();

    settlePublication();
    for (let index = 0; index < 8; index += 1) await Promise.resolve();
    expect(updateModelContext).toHaveBeenCalledTimes(2);
    expect(updateModelContext.mock.calls[1]?.[0]).toMatchObject({
      structuredContent: {
        schemaVersion: "shockaudit-private-host-task-cleared-v1",
        status: "cleared",
        outcomeValuesInspected: false,
      },
    });
  });
});
