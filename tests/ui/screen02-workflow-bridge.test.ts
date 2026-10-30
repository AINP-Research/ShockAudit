import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SCREEN_02_WORKFLOW_ASSESSMENT_BATCH_SCHEMA_VERSION,
  SCREEN_02_WORKFLOW_CLIENT_SCHEMA_VERSION,
  SCREEN_02_WORKFLOW_CORRELATION_META_KEY,
  SCREEN_02_WORKFLOW_CREATE_SCHEMA_VERSION_V024,
  SCREEN_02_WORKFLOW_CREATE_TOOL_V024,
  SCREEN_02_WORKFLOW_META_KEY,
  SCREEN_02_WORKFLOW_OPEN_REQUEST_PREFIX,
  SCREEN_02_WORKFLOW_RECEIPT_NOTICE_SCHEMA_VERSION,
  SCREEN_02_WORKFLOW_SUMMARY_SCHEMA_VERSION,
  createScreen02WorkflowCorrelation,
  restoreScreen02WorkflowClientSnapshot,
  type Screen02WorkflowAssessmentBatch,
  type Screen02WorkflowClientSnapshot,
  type Screen02WorkflowReceiptNotice,
  type Screen02WorkflowSummary,
} from "../../src/core/screen02-workflow-client";
import { sealScreen02WorkflowClientSnapshot } from "../../src/core/screen02-sealed-result";
import { encodeScreen02AuditWorkflowStateEnvelope } from "../../src/core/screen02-audit-workflow-envelope";
import { openScreen02FindCandidate } from "../../src/core/screen02-find-workflow";
import { encodeScreen02FindWorkflowStateEnvelope } from "../../src/core/screen02-workflow-envelope";
import {
  fingerprintScreen02WorkflowState,
  prepareScreen02AssessmentRequest,
} from "../../src/core/screen02-workflow-state";
import {
  screen02FindAssessmentPartIds,
  type Screen02FindState,
  type Screen02WorkflowState,
} from "../../src/core/screen02-workflow-types";
import {
  SCREEN_02_WORKFLOW_ACTION_SCHEMA_VERSION_V024,
  SCREEN_02_WORKFLOW_ACTION_TOOL_V024,
  SCREEN_02_WORKFLOW_WIDGET_SCHEMA_VERSION,
  ShockAuditBridge,
  arbitrateScreen02WorkflowSnapshots,
  collectScreen02WorkflowToolResults,
  restoreScreen02WorkflowWidgetSnapshot,
  type BridgeCallbacks,
  type Screen02WorkflowWidgetSnapshot,
} from "../../src/ui/mcp-bridge";
import {
  buildAuditIdentityState,
  buildFindFactsState,
  confirmedWorkflowAuditContext,
  confirmedWorkflowFindContext,
} from "../core/screen02-workflow-fixtures";

const accessToken = "workflow-access-token-".padEnd(64, "x");
const nativeSetTimeout = globalThis.setTimeout;

async function waitForExternalAsyncWork(condition: () => boolean) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (condition()) return;
    await new Promise<void>((resolve) => nativeSetTimeout(resolve, 1));
  }
  throw new Error("Timed out waiting for external asynchronous test work.");
}

function snapshotFor(
  state: Screen02WorkflowState,
  options: {
    accessToken?: string;
    assessmentBatch?: Screen02WorkflowAssessmentBatch | null;
  } = {},
) {
  const candidate: Screen02WorkflowClientSnapshot = {
    schemaVersion: SCREEN_02_WORKFLOW_CLIENT_SCHEMA_VERSION,
    runId: state.runId,
    accessToken: options.accessToken ?? accessToken,
    mode: state.mode,
    revision: state.revision,
    stateFingerprint: fingerprintScreen02WorkflowState(state),
    stateEnvelope:
      state.mode === "find"
        ? encodeScreen02FindWorkflowStateEnvelope(state)
        : encodeScreen02AuditWorkflowStateEnvelope(state),
    assessmentAvailable: options.assessmentBatch !== undefined,
    assessmentBatch: options.assessmentBatch ?? null,
    handoff: null,
  };
  const restored = restoreScreen02WorkflowClientSnapshot(candidate);
  if (!restored) throw new Error("Fixture workflow snapshot is invalid.");
  return restored;
}

function workflowSummary(
  mode: "find" | "audit",
  outcome: Screen02WorkflowSummary["outcome"],
): Screen02WorkflowSummary {
  return {
    schemaVersion: SCREEN_02_WORKFLOW_SUMMARY_SCHEMA_VERSION,
    screen: "screen-02",
    ok: outcome !== "conflict",
    outcome,
    mode,
    assessmentAvailable: false,
    preparedRequestCount: 0,
    deliveredRequestCount: 0,
    completedRequestCount: 0,
    continuationReady: false,
    message: `Fixture ${outcome} result.`,
  };
}

function widgetFor(
  workflow = snapshotFor(buildFindFactsState()),
): Screen02WorkflowWidgetSnapshot {
  return {
    schemaVersion: SCREEN_02_WORKFLOW_WIDGET_SCHEMA_VERSION,
    workflow,
    activeScreen: 2,
    openedMatchSnapshotId: "gdpr-candidate-snapshot-v1",
  };
}

function openedVariant(decisionId: string, at: string) {
  return openScreen02FindCandidate(buildFindFactsState(), {
    candidateSnapshotId: "gdpr-candidate-snapshot-v1",
    decisionId,
    at,
  });
}

function receiptFor(
  workflow = snapshotFor(buildFindFactsState()),
): Screen02WorkflowReceiptNotice {
  return {
    schemaVersion: SCREEN_02_WORKFLOW_RECEIPT_NOTICE_SCHEMA_VERSION,
    phase: "canonical-receipt-result",
    runId: workflow.runId,
    mode: workflow.mode,
    requestId: "find-request-1",
    receiptId: "find-receipt-1",
    disposition: "buffered-awaiting-delivery",
    reason: "The canonical receipt arrived before delivery acknowledgment.",
  };
}

function assessmentTransportFixture(label: string) {
  const requestId = `${label}-request`;
  const capabilityToken = `${label}-capability`;
  const requiredTool = "submit_screen02_find_assessment_draft_v021";
  const prepared = prepareScreen02AssessmentRequest(
    buildFindFactsState(),
    {
      jobId: `${label}-job`,
      requestId,
      mode: "find-candidate",
      candidateSnapshotId: "gdpr-candidate-snapshot-v1",
      attempt: 1,
      requestedPartIds: [...screen02FindAssessmentPartIds],
      at: "2026-08-10T12:00:01.000Z",
    },
  ) as Screen02FindState;
  const modelContext = {
    schemaVersion: "bounded-find-context-v1",
    requests: [
      {
        requestId,
        capabilityToken,
        requestedPartIds: [...screen02FindAssessmentPartIds],
      },
    ],
    outcomeValuesInspected: false,
  };
  const assessmentBatch: Screen02WorkflowAssessmentBatch = {
    schemaVersion: SCREEN_02_WORKFLOW_ASSESSMENT_BATCH_SCHEMA_VERSION,
    batchId: `${label}-batch`,
    runId: prepared.runId,
    mode: "find",
    requestIds: [requestId],
    requiredTool,
    modelContext,
    prompt: `Use the exact bounded Find context and call ${requiredTool} exactly once.`,
    issuedAt: "2026-08-10T12:00:02.000Z",
    expiresAt: "2026-08-10T12:05:02.000Z",
  };
  return {
    requestId,
    capabilityToken,
    requiredTool,
    modelContext,
    assessmentBatch,
    workflow: snapshotFor(prepared, { assessmentBatch }),
  };
}

function notifyWorkflowToolResult(
  bridge: ShockAuditBridge,
  value: unknown,
) {
  const listeners = (
    bridge as unknown as {
      screen02WorkflowToolResultListeners: Set<
        (result: unknown) => void
      >;
    }
  ).screen02WorkflowToolResultListeners;
  for (const listener of [...listeners]) listener(value);
}

function tamperSealedCiphertext<T extends { ciphertext: string }>(
  sealed: T,
): T {
  return {
    ...sealed,
    ciphertext: `${sealed.ciphertext[0] === "A" ? "B" : "A"}${sealed.ciphertext.slice(1)}`,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Screen 2 v2.1 workflow bridge", () => {
  it("strictly restores and saves a versioned widget snapshot without replacing siblings", async () => {
    const widget = widgetFor();
    expect(restoreScreen02WorkflowWidgetSnapshot(widget)).toEqual(widget);
    expect(
      restoreScreen02WorkflowWidgetSnapshot({ ...widget, extra: true }),
    ).toBeNull();

    let widgetState: Record<string, unknown> = {
      screen01: { sentinel: "screen-01" },
      screen02: { sentinel: "legacy-screen-02" },
      futureScreen: { sentinel: "future" },
    };
    const setWidgetState = vi.fn(async (next: Record<string, unknown>) => {
      widgetState = next;
      window.openai!.widgetState = next;
    });
    vi.stubGlobal("window", {
      openai: { widgetState, setWidgetState },
    });

    const bridge = new ShockAuditBridge();
    await bridge.saveScreen02WorkflowWidgetSnapshot(widget);

    const privateContent = widgetState.privateContent as Record<
      string,
      unknown
    >;
    expect(privateContent.screen01).toEqual({ sentinel: "screen-01" });
    expect(privateContent.screen02).toEqual({
      sentinel: "legacy-screen-02",
    });
    expect(privateContent.futureScreen).toEqual({ sentinel: "future" });
    expect(privateContent.screen02Workflow).toEqual(widget);
    expect(widgetState).not.toHaveProperty("screen02Workflow");
    expect(JSON.stringify(widgetState.modelContent)).not.toContain(
      widget.workflow.accessToken,
    );
    expect(
      JSON.stringify({ ...widgetState, privateContent: null }),
    ).not.toContain("stateEnvelope");
    expect(bridge.getInitialScreen02WorkflowWidgetSnapshot()).toEqual(
      widget,
    );

    await bridge.clearScreen02WorkflowWidgetSnapshot();
    expect(widgetState).toEqual({
      modelContent:
        "ShockAudit keeps widget restoration data private. Use explicit tool results and bounded model-context updates for research facts.",
      privateContent: {
        screen01: { sentinel: "screen-01" },
        screen02: { sentinel: "legacy-screen-02" },
        futureScreen: { sentinel: "future" },
      },
    });
  });

  it("settles strict Screen 2 persistence only after the host write settles", async () => {
    const widget = widgetFor();
    let releaseWrite!: () => void;
    const writeBarrier = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    const setWidgetState = vi.fn(async (next: Record<string, unknown>) => {
      await writeBarrier;
      window.openai!.widgetState = next;
    });
    vi.stubGlobal("window", {
      openai: { widgetState: {}, setWidgetState },
    });
    const bridge = new ShockAuditBridge();
    let settled = false;

    const persistence = bridge.persistScreen02WorkflowWidgetSnapshot(widget)
      .then((result) => {
        settled = true;
        return result;
      });
    await vi.waitFor(() => expect(setWidgetState).toHaveBeenCalledOnce());
    await Promise.resolve();
    expect(settled).toBe(false);

    releaseWrite();
    await expect(persistence).resolves.toBe(true);
    expect(
      (window.openai!.widgetState as {
        privateContent: { screen02Workflow: unknown };
      }).privateContent.screen02Workflow,
    ).toEqual(widget);
  });

  it("fails strict Screen 2 persistence without a usable settled host write", async () => {
    const widget = widgetFor();
    vi.stubGlobal("window", { openai: { widgetState: {} } });
    await expect(
      new ShockAuditBridge().persistScreen02WorkflowWidgetSnapshot(widget),
    ).resolves.toBe(false);

    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const setWidgetState = vi.fn(async () => {
      throw new Error("host persistence rejected");
    });
    vi.stubGlobal("window", {
      openai: { widgetState: {}, setWidgetState },
    });
    await expect(
      new ShockAuditBridge().persistScreen02WorkflowWidgetSnapshot(widget),
    ).resolves.toBe(false);
    expect(warning).toHaveBeenCalledWith(
      "ShockAudit could not confirm Screen 2 workflow persistence.",
      expect.any(Error),
    );
  });

  it("rejects a raw model-visible v2.1 bearer snapshot while migrating legacy drafts", () => {
    const widget = widgetFor();
    vi.stubGlobal("window", {
      openai: {
        widgetState: {
          screen01: { sentinel: "legacy-screen-01" },
          screen02Workflow: widget,
        },
      },
    });
    const bridge = new ShockAuditBridge();
    expect(bridge.getInitialScreen02WorkflowWidgetSnapshot()).toBeNull();
  });

  it("restores a valid private workflow despite malformed or unrelated compatibility metadata", () => {
    const workflow = snapshotFor(buildFindFactsState());
    const widget = widgetFor(workflow);
    const unrelated = restoreScreen02WorkflowClientSnapshot({
      ...workflow,
      accessToken: "unrelated-restoration-token-".padEnd(64, "u"),
    });
    expect(unrelated).not.toBeNull();
    vi.stubGlobal("window", {
      openai: {
        widgetState: {
          modelContent: "Private ShockAudit restoration state.",
          privateContent: { screen02Workflow: widget },
        },
        toolResponseMetadata: {
          mcp_tool_result: {
            _meta: {
              [SCREEN_02_WORKFLOW_META_KEY]: { mode: "find" },
            },
          },
          call_tool_result: {
            _meta: {
              [SCREEN_02_WORKFLOW_META_KEY]: unrelated,
            },
          },
        },
      },
    });

    expect(
      new ShockAuditBridge().getInitialScreen02WorkflowWidgetSnapshot(),
    ).toEqual(widget);
  });

  it("fails closed when valid same-chain restoration metadata conflicts with stored canonical state", () => {
    const first = snapshotFor(
      openedVariant(
        "restoration-conflict-a",
        "2026-08-11T18:40:00.000Z",
      ),
    );
    const second = snapshotFor(
      openedVariant(
        "restoration-conflict-b",
        "2026-08-11T18:40:01.000Z",
      ),
    );
    expect(first.revision).toBe(second.revision);
    expect(first.stateFingerprint).not.toBe(second.stateFingerprint);
    vi.stubGlobal("window", {
      openai: {
        widgetState: {
          modelContent: "Private ShockAudit restoration state.",
          privateContent: { screen02Workflow: widgetFor(first) },
        },
        toolResponseMetadata: {
          mcp_tool_result: {
            _meta: {
              [SCREEN_02_WORKFLOW_META_KEY]: second,
            },
          },
        },
      },
    });

    expect(
      new ShockAuditBridge().getInitialScreen02WorkflowWidgetSnapshot(),
    ).toBeNull();
  });

  it("collects only hidden snapshots and canonical receipts through documented wrappers to depth two", () => {
    const workflow = snapshotFor(buildFindFactsState());
    const receipt = receiptFor(workflow);
    const direct = collectScreen02WorkflowToolResults({
      _meta: { [SCREEN_02_WORKFLOW_META_KEY]: workflow },
      structuredContent: receipt,
    });
    expect(direct).toEqual({
      snapshots: [workflow],
      correlatedSnapshots: [],
      receipts: [receipt],
      conflict: false,
    });

    const wrapped = collectScreen02WorkflowToolResults({
      mcp_tool_result: {
        call_tool_result: {
          [SCREEN_02_WORKFLOW_META_KEY]: workflow,
          structuredContent: receipt,
        },
      },
    });
    expect(wrapped.snapshots).toEqual([workflow]);
    expect(wrapped.receipts).toEqual([receipt]);
    expect(wrapped.conflict).toBe(false);

    const tooDeep = collectScreen02WorkflowToolResults({
      mcp_tool_result: {
        call_tool_result: {
          mcpToolResult: {
            _meta: { [SCREEN_02_WORKFLOW_META_KEY]: workflow },
          },
        },
      },
    });
    expect(tooDeep.snapshots).toEqual([]);
    expect(
      collectScreen02WorkflowToolResults({
        structuredContent: workflow,
      }).snapshots,
    ).toEqual([]);
  });

  it("serializes a later workflow clear after an earlier delayed save", async () => {
    const widget = widgetFor();
    let widgetState: Record<string, unknown> = {
      screen01: { sentinel: "screen-01" },
    };
    let releaseFirstWrite!: () => void;
    const firstWrite = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });
    const setWidgetState = vi.fn(
      async (next: Record<string, unknown>) => {
        if (setWidgetState.mock.calls.length === 1) {
          await firstWrite;
        }
        widgetState = next;
        window.openai!.widgetState = next;
      },
    );
    vi.stubGlobal("window", {
      openai: { widgetState, setWidgetState },
    });
    const bridge = new ShockAuditBridge();

    const saving = bridge.saveScreen02WorkflowWidgetSnapshot(widget);
    await vi.waitFor(() => expect(setWidgetState).toHaveBeenCalledOnce());
    const clearing = bridge.clearScreen02WorkflowWidgetSnapshot();
    expect(setWidgetState).toHaveBeenCalledOnce();

    releaseFirstWrite();
    await Promise.all([saving, clearing]);
    expect(setWidgetState).toHaveBeenCalledTimes(2);
    expect(widgetState).toEqual({
      modelContent:
        "ShockAudit keeps widget restoration data private. Use explicit tool results and bounded model-context updates for research facts.",
      privateContent: {
        screen01: { sentinel: "screen-01" },
      },
    });
  });

  it("rejects corrupt metadata and cross-conflicting snapshots for one run revision", () => {
    const first = snapshotFor(
      openedVariant("open-decision-a", "2026-08-09T18:00:02.000Z"),
    );
    const second = snapshotFor(
      openedVariant("open-decision-b", "2026-08-09T18:00:03.000Z"),
    );
    expect(first.revision).toBe(second.revision);
    expect(first.stateFingerprint).not.toBe(second.stateFingerprint);

    const conflict = collectScreen02WorkflowToolResults({
      mcp_tool_result: {
        _meta: { [SCREEN_02_WORKFLOW_META_KEY]: first },
      },
      call_tool_result: {
        _meta: { [SCREEN_02_WORKFLOW_META_KEY]: second },
      },
    });
    expect(conflict.conflict).toBe(true);

    const corrupt = collectScreen02WorkflowToolResults({
      _meta: {
        [SCREEN_02_WORKFLOW_META_KEY]: {
          ...first,
          stateFingerprint: "fnv1a64:0000000000000000",
        },
      },
    });
    expect(corrupt.snapshots).toEqual([]);
    expect(corrupt.conflict).toBe(true);
  });

  it("lets only strictly newer metadata from the same token, run, and mode outrank widget state", () => {
    const widget = snapshotFor(buildFindFactsState());
    const newer = snapshotFor(
      openedVariant("open-newer", "2026-08-09T18:00:02.000Z"),
    );
    expect(arbitrateScreen02WorkflowSnapshots(widget, [newer])).toEqual({
      snapshot: newer,
      source: "metadata",
      conflict: false,
    });

    const otherToken = snapshotFor(
      openedVariant("open-other-token", "2026-08-09T18:00:02.000Z"),
      { accessToken: "other-workflow-token-".padEnd(64, "y") },
    );
    expect(
      arbitrateScreen02WorkflowSnapshots(widget, [otherToken]),
    ).toEqual({ snapshot: widget, source: "widget", conflict: false });

    const reissuedSameCanonicalState = restoreScreen02WorkflowClientSnapshot({
      ...widget,
      assessmentAvailable: true,
    });
    expect(reissuedSameCanonicalState).not.toBeNull();
    expect(
      arbitrateScreen02WorkflowSnapshots(widget, [
        reissuedSameCanonicalState!,
      ]),
    ).toEqual({ snapshot: widget, source: "widget", conflict: false });

    const sameRevisionConflict = snapshotFor(
      openedVariant(
        "open-same-revision-conflict",
        "2026-08-09T18:00:04.000Z",
      ),
    );
    expect(
      arbitrateScreen02WorkflowSnapshots(newer, [sameRevisionConflict]),
    ).toEqual({ snapshot: null, source: "none", conflict: true });
  });

  it("opens, mutates, and retires through the current tools with exact workflow and CAS fields", async () => {
    const opened = snapshotFor(buildFindFactsState());
    const updated = snapshotFor(
      openedVariant("open-through-bridge", "2026-08-09T18:00:02.000Z"),
    );
    const callTool = vi.fn(
      async (name: string, arguments_: Record<string, unknown>) => {
        if (name === "retire_screen02_workflow_v021") {
          return {
            structuredContent: {
              schemaVersion: "screen-02-workflow-retire-result-v1",
              screen: "screen-02",
              ok: true,
              outcome: "retired",
              runId: opened.runId,
              message: "The prior Screen 2 run was deleted after replacement.",
            },
          };
        }
        const workflow =
          name === SCREEN_02_WORKFLOW_CREATE_TOOL_V024 ? opened : updated;
        const operationId = String(arguments_.operationId);
        return {
          structuredContent: { ok: true },
          _meta: {
            [SCREEN_02_WORKFLOW_META_KEY]: workflow,
            [SCREEN_02_WORKFLOW_CORRELATION_META_KEY]:
              createScreen02WorkflowCorrelation(
                workflow,
                operationId,
                name === SCREEN_02_WORKFLOW_CREATE_TOOL_V024
                  ? "open"
                  : "mutation",
              ),
          },
        };
      },
    );
    vi.stubGlobal("window", {
      openai: { widgetState: {}, callTool },
    });
    const bridge = new ShockAuditBridge();
    const studyContext = confirmedWorkflowFindContext();

    await expect(bridge.openScreen02Workflow(studyContext)).resolves.toEqual(
      opened,
    );
    const [openToolName, openArguments] = callTool.mock.calls[0]!;
    expect(openToolName).toBe(SCREEN_02_WORKFLOW_CREATE_TOOL_V024);
    expect(openArguments).toMatchObject({
      schemaVersion: SCREEN_02_WORKFLOW_CREATE_SCHEMA_VERSION_V024,
      studyContext,
    });
    expect(openArguments).not.toHaveProperty("initialState");
    expect(openArguments.responseKeyId).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(openArguments.responseKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(openArguments.operationId).toMatch(
      new RegExp(`^${SCREEN_02_WORKFLOW_OPEN_REQUEST_PREFIX}`),
    );

    await expect(
      bridge.mutateScreen02Workflow(
        opened,
        "find-open",
        { candidateSnapshotId: "gdpr-candidate-snapshot-v1" },
        "operation-open-gdpr",
      ),
    ).resolves.toEqual(updated);
    const [toolName, action] = callTool.mock.calls[1]!;
    expect(toolName).toBe(SCREEN_02_WORKFLOW_ACTION_TOOL_V024);
    expect(Object.keys(action).sort()).toEqual(
      [
        "schemaVersion",
        "operationId",
        "responseKeyId",
        "responseKey",
        "runId",
        "accessToken",
        "expectedRevision",
        "expectedStateFingerprint",
        "action",
        "payload",
      ].sort(),
    );
    expect(action).toMatchObject({
      schemaVersion: SCREEN_02_WORKFLOW_ACTION_SCHEMA_VERSION_V024,
      operationId: "operation-open-gdpr",
      runId: opened.runId,
      accessToken: opened.accessToken,
      expectedRevision: opened.revision,
      expectedStateFingerprint: opened.stateFingerprint,
      action: "find-open",
      payload: { candidateSnapshotId: "gdpr-candidate-snapshot-v1" },
    });
    expect(action.responseKeyId).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(action.responseKey).toMatch(/^[A-Za-z0-9_-]{43}$/);

    await expect(bridge.retireScreen02Workflow(opened)).resolves.toMatchObject({
      outcome: "retired",
      runId: opened.runId,
    });
    expect(callTool.mock.calls[2]).toEqual([
      "retire_screen02_workflow_v021",
      {
        schemaVersion: "screen-02-workflow-retire-v1",
        runId: opened.runId,
        accessToken: opened.accessToken,
        expectedRevision: opened.revision,
        expectedStateFingerprint: opened.stateFingerprint,
      },
    ]);
  });

  it("sends blank initialization only for an explicit reset open", async () => {
    const opened = snapshotFor(buildFindFactsState());
    const callTool = vi.fn(
      async (_name: string, arguments_: Record<string, unknown>) => ({
        structuredContent: { ok: true },
        _meta: {
          [SCREEN_02_WORKFLOW_META_KEY]: opened,
          [SCREEN_02_WORKFLOW_CORRELATION_META_KEY]:
            createScreen02WorkflowCorrelation(
              opened,
              String(arguments_.operationId),
              "open",
            ),
        },
      }),
    );
    vi.stubGlobal("window", {
      openai: { widgetState: {}, callTool },
    });
    const bridge = new ShockAuditBridge();

    await expect(
      bridge.openScreen02Workflow(confirmedWorkflowFindContext(), "blank"),
    ).resolves.toEqual(opened);
    expect(callTool.mock.calls[0]?.[1]).toMatchObject({
      schemaVersion: SCREEN_02_WORKFLOW_CREATE_SCHEMA_VERSION_V024,
      initialState: "blank",
      studyContext: confirmedWorkflowFindContext(),
    });
  });

  it("opens and mutates from encrypted structuredContent when the host delivers no hidden metadata", async () => {
    const opened = snapshotFor(buildFindFactsState());
    const updated = snapshotFor(
      openedVariant("sealed-direct-mutation", "2026-08-11T18:00:00.000Z"),
    );
    vi.stubGlobal("window", { openai: {} });
    const callServerTool = vi.fn(
      async (call: {
        name: string;
        arguments: Record<string, unknown>;
      }) => {
        const kind =
          call.name === SCREEN_02_WORKFLOW_CREATE_TOOL_V024
            ? "open"
            : "mutation";
        const workflow = kind === "open" ? opened : updated;
        const sealedSnapshot = await sealScreen02WorkflowClientSnapshot(
          workflow,
          {
            operationId: String(call.arguments.operationId),
            kind,
            responseKey: {
              keyId: String(call.arguments.responseKeyId),
              key: String(call.arguments.responseKey),
            },
          },
        );
        return { structuredContent: { ok: true, sealedSnapshot } };
      },
    );
    const bridge = new ShockAuditBridge();
    (
      bridge as unknown as {
        app: {
          getHostCapabilities: () => { serverTools: object };
          callServerTool: typeof callServerTool;
        };
      }
    ).app = {
      getHostCapabilities: () => ({ serverTools: {} }),
      callServerTool,
    };

    await expect(
      bridge.openScreen02Workflow(confirmedWorkflowFindContext()),
    ).resolves.toEqual(opened);
    await expect(
      bridge.mutateScreen02Workflow(
        opened,
        "find-open",
        { candidateSnapshotId: "gdpr-candidate-snapshot-v1" },
        "sealed-direct-operation",
      ),
    ).resolves.toEqual(updated);

    expect(callServerTool.mock.calls.map(([call]) => call.name)).toEqual([
      SCREEN_02_WORKFLOW_CREATE_TOOL_V024,
      SCREEN_02_WORKFLOW_ACTION_TOOL_V024,
    ]);
    expect(window.openai?.callTool).toBeUndefined();
  });

  it("sends continuation chunks as empty, independently attributed mutations", async () => {
    const opened = snapshotFor(buildFindFactsState());
    vi.stubGlobal("window", { openai: {} });
    const callServerTool = vi.fn(
      async (call: {
        name: string;
        arguments: Record<string, unknown>;
      }) => {
        const sealedSnapshot = await sealScreen02WorkflowClientSnapshot(
          opened,
          {
            operationId: String(call.arguments.operationId),
            kind: "mutation",
            responseKey: {
              keyId: String(call.arguments.responseKeyId),
              key: String(call.arguments.responseKey),
            },
          },
        );
        return {
          structuredContent: {
            ...workflowSummary("find", "applied"),
            sealedSnapshot,
          },
        };
      },
    );
    const bridge = new ShockAuditBridge();
    (
      bridge as unknown as {
        app: {
          getHostCapabilities: () => { serverTools: object };
          callServerTool: typeof callServerTool;
        };
      }
    ).app = {
      getHostCapabilities: () => ({ serverTools: {} }),
      callServerTool,
    };

    const first = await bridge.mutateScreen02Workflow(
      opened,
      "find-search-continue",
      {},
      "continuation-operation-1",
    );
    expect(
      bridge.screen02WorkflowOperationAttribution(first),
    ).toMatchObject({
      operationId: "continuation-operation-1",
      outcome: "applied",
      attributable: true,
    });
    const second = await bridge.mutateScreen02Workflow(
      first,
      "find-search-continue",
      {},
      "continuation-operation-2",
    );

    expect(second).toEqual(opened);
    expect(callServerTool).toHaveBeenCalledTimes(2);
    expect(callServerTool.mock.calls.map(([call]) => ({
      name: call.name,
      action: call.arguments.action,
      operationId: call.arguments.operationId,
      payload: call.arguments.payload,
      runId: call.arguments.runId,
      expectedRevision: call.arguments.expectedRevision,
      expectedStateFingerprint: call.arguments.expectedStateFingerprint,
    }))).toEqual([
      {
        name: SCREEN_02_WORKFLOW_ACTION_TOOL_V024,
        action: "find-search-continue",
        operationId: "continuation-operation-1",
        payload: {},
        runId: opened.runId,
        expectedRevision: opened.revision,
        expectedStateFingerprint: opened.stateFingerprint,
      },
      {
        name: SCREEN_02_WORKFLOW_ACTION_TOOL_V024,
        action: "find-search-continue",
        operationId: "continuation-operation-2",
        payload: {},
        runId: opened.runId,
        expectedRevision: opened.revision,
        expectedStateFingerprint: opened.stateFingerprint,
      },
    ]);
    expect(
      bridge.screen02WorkflowOperationAttribution(second),
    ).toMatchObject({
      operationId: "continuation-operation-2",
      outcome: "applied",
      attributable: true,
    });
  });

  it("records only an exact applied or replayed operation as attributable", async () => {
    const opened = snapshotFor(buildFindFactsState());
    const updated = snapshotFor(
      openedVariant(
        "attributed-mutation",
        "2026-08-09T18:00:05.000Z",
      ),
    );
    vi.stubGlobal("window", { openai: {} });
    const bridge = new ShockAuditBridge();
    const callServerTool = vi.fn(async (call: {
      arguments: Record<string, unknown>;
    }) => {
      const sealedSnapshot = await sealScreen02WorkflowClientSnapshot(
        updated,
        {
          operationId: String(call.arguments.operationId),
          kind: "mutation",
          responseKey: {
            keyId: String(call.arguments.responseKeyId),
            key: String(call.arguments.responseKey),
          },
        },
      );
      return {
        structuredContent: {
          ...workflowSummary("find", "applied"),
          sealedSnapshot,
        },
      };
    });
    (
      bridge as unknown as {
        app: {
          getHostCapabilities: () => { serverTools: object };
          callServerTool: typeof callServerTool;
        };
      }
    ).app = {
      getHostCapabilities: () => ({ serverTools: {} }),
      callServerTool,
    };

    const result = await bridge.mutateScreen02Workflow(
      opened,
      "find-open",
      { candidateSnapshotId: "gdpr-candidate-snapshot-v1" },
      "attributed-mutation-operation",
    );
    expect(result).toEqual(updated);
    expect(bridge.screen02WorkflowOperationAttribution(result)).toEqual({
      operationId: "attributed-mutation-operation",
      kind: "mutation",
      outcome: "applied",
      attributable: true,
      binding: "exact-operation-seal-or-correlation",
    });
  });

  it("returns an exact conflict-sealed canonical winner without treating the losing mutation as applied", async () => {
    const opened = snapshotFor(buildFindFactsState());
    const winner = snapshotFor(
      openedVariant(
        "attributed-conflict-winner",
        "2026-08-09T18:00:06.000Z",
      ),
    );
    vi.stubGlobal("window", { openai: {} });
    const bridge = new ShockAuditBridge();
    const callServerTool = vi.fn(async (call: {
      arguments: Record<string, unknown>;
    }) => {
      const sealedSnapshot = await sealScreen02WorkflowClientSnapshot(
        winner,
        {
          operationId: String(call.arguments.operationId),
          kind: "mutation",
          responseKey: {
            keyId: String(call.arguments.responseKeyId),
            key: String(call.arguments.responseKey),
          },
        },
      );
      return {
        structuredContent: {
          ...workflowSummary("find", "conflict"),
          sealedSnapshot,
        },
      };
    });
    (
      bridge as unknown as {
        app: {
          getHostCapabilities: () => { serverTools: object };
          callServerTool: typeof callServerTool;
        };
      }
    ).app = {
      getHostCapabilities: () => ({ serverTools: {} }),
      callServerTool,
    };

    const result = await bridge.mutateScreen02Workflow(
      opened,
      "find-open",
      { candidateSnapshotId: "gdpr-candidate-snapshot-v1" },
      "attributed-conflict-operation",
    );
    expect(result).toEqual(winner);
    expect(bridge.screen02WorkflowOperationAttribution(result)).toEqual({
      operationId: "attributed-conflict-operation",
      kind: "mutation",
      outcome: "conflict",
      attributable: true,
      binding: "exact-operation-seal-or-correlation",
    });
  });

  it("returns an exact private result as visibly recoverable but unattributed when its public outcome is absent", async () => {
    const opened = snapshotFor(buildFindFactsState());
    vi.stubGlobal("window", { openai: {} });
    const bridge = new ShockAuditBridge();
    const callServerTool = vi.fn(async (call: {
      arguments: Record<string, unknown>;
    }) => {
      const sealedSnapshot = await sealScreen02WorkflowClientSnapshot(
        opened,
        {
          operationId: String(call.arguments.operationId),
          kind: "mutation",
          responseKey: {
            keyId: String(call.arguments.responseKeyId),
            key: String(call.arguments.responseKey),
          },
        },
      );
      return { structuredContent: { ok: true, sealedSnapshot } };
    });
    (
      bridge as unknown as {
        app: {
          getHostCapabilities: () => { serverTools: object };
          callServerTool: typeof callServerTool;
        };
      }
    ).app = {
      getHostCapabilities: () => ({ serverTools: {} }),
      callServerTool,
    };

    const result = await bridge.mutateScreen02Workflow(
      opened,
      "find-open",
      { candidateSnapshotId: "gdpr-candidate-snapshot-v1" },
      "unattributed-mutation-operation",
    );
    expect(bridge.screen02WorkflowOperationAttribution(result)).toMatchObject({
      operationId: "unattributed-mutation-operation",
      outcome: "unattributed",
      attributable: false,
    });
  });

  it("opens Find and Audit from a valid seal while optional compatibility metadata is stale, redacted, split, or unrelated", async () => {
    const modes = [
      {
        context: confirmedWorkflowFindContext(),
        workflow: snapshotFor(buildFindFactsState()),
      },
      {
        context: confirmedWorkflowAuditContext(),
        workflow: snapshotFor(buildAuditIdentityState()),
      },
    ];
    const scenarios = [
      "stale-operation",
      "redacted",
      "split-current-operation",
      "mismatched-current-operation",
      "conflicting-unrelated-receipts",
    ] as const;

    for (const { context, workflow } of modes) {
      for (const scenario of scenarios) {
        const openai: {
          toolResponseMetadata?: Record<string, unknown>;
        } = {};
        vi.stubGlobal("window", { openai });
        const callServerTool = vi.fn(
          async (call: {
            name: string;
            arguments: Record<string, unknown>;
          }) => {
            const operationId = String(call.arguments.operationId);
            const correlation = createScreen02WorkflowCorrelation(
              workflow,
              operationId,
              "open",
            );
            if (scenario === "stale-operation") {
              openai.toolResponseMetadata = {
                mcp_tool_result: {
                  _meta: {
                    [SCREEN_02_WORKFLOW_META_KEY]: workflow,
                    [SCREEN_02_WORKFLOW_CORRELATION_META_KEY]: {
                      ...correlation,
                      operationId: "screen02-v021-open-stale-operation",
                    },
                  },
                },
              };
            } else if (scenario === "redacted") {
              openai.toolResponseMetadata = {
                mcp_tool_result: {
                  _meta: {
                    [SCREEN_02_WORKFLOW_META_KEY]: {
                      schemaVersion: workflow.schemaVersion,
                      mode: workflow.mode,
                    },
                    [SCREEN_02_WORKFLOW_CORRELATION_META_KEY]: {
                      schemaVersion: correlation.schemaVersion,
                      operationId,
                    },
                  },
                },
              };
            } else if (scenario === "split-current-operation") {
              openai.toolResponseMetadata = {
                mcp_tool_result: {
                  _meta: {
                    [SCREEN_02_WORKFLOW_META_KEY]: workflow,
                  },
                },
                call_tool_result: {
                  _meta: {
                    [SCREEN_02_WORKFLOW_CORRELATION_META_KEY]: correlation,
                  },
                },
              };
            } else if (scenario === "mismatched-current-operation") {
              openai.toolResponseMetadata = {
                mcp_tool_result: {
                  _meta: {
                    [SCREEN_02_WORKFLOW_META_KEY]: workflow,
                    [SCREEN_02_WORKFLOW_CORRELATION_META_KEY]: {
                      ...correlation,
                      stateFingerprint: "fnv1a64:0000000000000000",
                    },
                  },
                },
              };
            } else {
              const receipt = receiptFor(
                snapshotFor(buildFindFactsState()),
              );
              openai.toolResponseMetadata = {
                mcp_tool_result: { structuredContent: receipt },
                call_tool_result: {
                  structuredContent: {
                    ...receipt,
                    reason: "A conflicting unrelated receipt copy.",
                  },
                },
              };
            }
            const sealedSnapshot =
              await sealScreen02WorkflowClientSnapshot(workflow, {
                operationId,
                kind: "open",
                responseKey: {
                  keyId: String(call.arguments.responseKeyId),
                  key: String(call.arguments.responseKey),
                },
              });
            return { structuredContent: { ok: true, sealedSnapshot } };
          },
        );
        const bridge = new ShockAuditBridge();
        (
          bridge as unknown as {
            app: {
              getHostCapabilities: () => { serverTools: object };
              callServerTool: typeof callServerTool;
            };
          }
        ).app = {
          getHostCapabilities: () => ({ serverTools: {} }),
          callServerTool,
        };

        await expect(bridge.openScreen02Workflow(context)).resolves.toEqual(
          workflow,
        );
      }
    }
  });

  it("ignores a valid prior-operation sealed notification before current Find and Audit opens", async () => {
    const modes = [
      {
        context: confirmedWorkflowFindContext(),
        workflow: snapshotFor(buildFindFactsState()),
      },
      {
        context: confirmedWorkflowAuditContext(),
        workflow: snapshotFor(buildAuditIdentityState()),
      },
    ];

    for (const { context, workflow } of modes) {
      vi.stubGlobal("window", { openai: {} });
      const bridge = new ShockAuditBridge();
      const callServerTool = vi.fn(
        async (call: { arguments: Record<string, unknown> }) => {
          const responseKey = {
            keyId: String(call.arguments.responseKeyId),
            key: String(call.arguments.responseKey),
          };
          const priorSeal = await sealScreen02WorkflowClientSnapshot(
            workflow,
            {
              operationId: "screen02-v021-open-prior-notification",
              kind: "open",
              responseKey,
            },
          );
          notifyWorkflowToolResult(bridge, {
            structuredContent: { ok: true, sealedSnapshot: priorSeal },
          });
          const currentSeal = await sealScreen02WorkflowClientSnapshot(
            workflow,
            {
              operationId: String(call.arguments.operationId),
              kind: "open",
              responseKey,
            },
          );
          return {
            structuredContent: { ok: true, sealedSnapshot: currentSeal },
          };
        },
      );
      (
        bridge as unknown as {
          app: {
            getHostCapabilities: () => { serverTools: object };
            callServerTool: typeof callServerTool;
          };
        }
      ).app = {
        getHostCapabilities: () => ({ serverTools: {} }),
        callServerTool,
      };

      await expect(bridge.openScreen02Workflow(context)).resolves.toEqual(
        workflow,
      );
    }
  });

  it("ignores a valid prior-operation sealed notification before a current mutation", async () => {
    const opened = snapshotFor(buildFindFactsState());
    const updated = snapshotFor(
      openedVariant(
        "stale-sealed-notification-mutation",
        "2026-08-11T18:35:00.000Z",
      ),
    );
    vi.stubGlobal("window", { openai: {} });
    const bridge = new ShockAuditBridge();
    const callServerTool = vi.fn(
      async (call: { arguments: Record<string, unknown> }) => {
        const responseKey = {
          keyId: String(call.arguments.responseKeyId),
          key: String(call.arguments.responseKey),
        };
        const priorSeal = await sealScreen02WorkflowClientSnapshot(updated, {
          operationId: "screen02-v021-mutation-prior-notification",
          kind: "mutation",
          responseKey,
        });
        notifyWorkflowToolResult(bridge, {
          structuredContent: { ok: true, sealedSnapshot: priorSeal },
        });
        const currentSeal = await sealScreen02WorkflowClientSnapshot(updated, {
          operationId: String(call.arguments.operationId),
          kind: "mutation",
          responseKey,
        });
        return {
          structuredContent: { ok: true, sealedSnapshot: currentSeal },
        };
      },
    );
    (
      bridge as unknown as {
        app: {
          getHostCapabilities: () => { serverTools: object };
          callServerTool: typeof callServerTool;
        };
      }
    ).app = {
      getHostCapabilities: () => ({ serverTools: {} }),
      callServerTool,
    };

    await expect(
      bridge.mutateScreen02Workflow(
        opened,
        "find-open",
        { candidateSnapshotId: "gdpr-candidate-snapshot-v1" },
        "current-mutation-after-stale-seal",
      ),
    ).resolves.toEqual(updated);
  });

  it("fails closed on an exact-current tampered sealed notification even when the direct seal is valid", async () => {
    const modes = [
      {
        context: confirmedWorkflowFindContext(),
        workflow: snapshotFor(buildFindFactsState()),
      },
      {
        context: confirmedWorkflowAuditContext(),
        workflow: snapshotFor(buildAuditIdentityState()),
      },
    ];

    for (const { context, workflow } of modes) {
      vi.stubGlobal("window", { openai: {} });
      const bridge = new ShockAuditBridge();
      const callServerTool = vi.fn(
        async (call: { arguments: Record<string, unknown> }) => {
          const operationId = String(call.arguments.operationId);
          const responseKey = {
            keyId: String(call.arguments.responseKeyId),
            key: String(call.arguments.responseKey),
          };
          const sealed = await sealScreen02WorkflowClientSnapshot(workflow, {
            operationId,
            kind: "open",
            responseKey,
          });
          notifyWorkflowToolResult(bridge, {
            structuredContent: {
              ok: true,
              sealedSnapshot: tamperSealedCiphertext(sealed),
            },
          });
          return { structuredContent: { ok: true, sealedSnapshot: sealed } };
        },
      );
      (
        bridge as unknown as {
          app: {
            getHostCapabilities: () => { serverTools: object };
            callServerTool: typeof callServerTool;
          };
        }
      ).app = {
        getHostCapabilities: () => ({ serverTools: {} }),
        callServerTool,
      };

      await expect(bridge.openScreen02Workflow(context)).rejects.toThrow(
        "[SA-S2-SEALED-RESULT-INVALID]",
      );
    }
  });

  it("fails closed on a tampered direct seal for both Find and Audit", async () => {
    const modes = [
      {
        context: confirmedWorkflowFindContext(),
        workflow: snapshotFor(buildFindFactsState()),
      },
      {
        context: confirmedWorkflowAuditContext(),
        workflow: snapshotFor(buildAuditIdentityState()),
      },
    ];

    for (const { context, workflow } of modes) {
      vi.stubGlobal("window", { openai: {} });
      const callServerTool = vi.fn(
        async (call: { arguments: Record<string, unknown> }) => {
          const sealed = await sealScreen02WorkflowClientSnapshot(workflow, {
            operationId: String(call.arguments.operationId),
            kind: "open",
            responseKey: {
              keyId: String(call.arguments.responseKeyId),
              key: String(call.arguments.responseKey),
            },
          });
          return {
            structuredContent: {
              ok: true,
              sealedSnapshot: tamperSealedCiphertext(sealed),
            },
          };
        },
      );
      const bridge = new ShockAuditBridge();
      (
        bridge as unknown as {
          app: {
            getHostCapabilities: () => { serverTools: object };
            callServerTool: typeof callServerTool;
          };
        }
      ).app = {
        getHostCapabilities: () => ({ serverTools: {} }),
        callServerTool,
      };

      await expect(bridge.openScreen02Workflow(context)).rejects.toThrow(
        "[SA-S2-SEALED-RESULT-INVALID]",
      );
    }
  });

  it("fails closed when an exact-current sealed notification and direct seal conflict", async () => {
    const directWorkflow = snapshotFor(buildFindFactsState());
    const notifiedWorkflow = snapshotFor(
      openedVariant(
        "current-sealed-notification-conflict",
        "2026-08-11T18:36:00.000Z",
      ),
    );
    vi.stubGlobal("window", { openai: {} });
    const bridge = new ShockAuditBridge();
    const callServerTool = vi.fn(
      async (call: { arguments: Record<string, unknown> }) => {
        const operationId = String(call.arguments.operationId);
        const responseKey = {
          keyId: String(call.arguments.responseKeyId),
          key: String(call.arguments.responseKey),
        };
        const notifiedSeal = await sealScreen02WorkflowClientSnapshot(
          notifiedWorkflow,
          { operationId, kind: "open", responseKey },
        );
        notifyWorkflowToolResult(bridge, {
          structuredContent: {
            ok: true,
            sealedSnapshot: notifiedSeal,
          },
        });
        const directSeal = await sealScreen02WorkflowClientSnapshot(
          directWorkflow,
          { operationId, kind: "open", responseKey },
        );
        return {
          structuredContent: { ok: true, sealedSnapshot: directSeal },
        };
      },
    );
    (
      bridge as unknown as {
        app: {
          getHostCapabilities: () => { serverTools: object };
          callServerTool: typeof callServerTool;
        };
      }
    ).app = {
      getHostCapabilities: () => ({ serverTools: {} }),
      callServerTool,
    };

    await expect(
      bridge.openScreen02Workflow(confirmedWorkflowFindContext()),
    ).rejects.toThrow("[SA-S2-RESULT-CONFLICT]");
  });

  it("fails closed when valid current metadata is notified before a conflicting direct seal", async () => {
    const directWorkflow = snapshotFor(buildFindFactsState());
    const notifiedWorkflow = snapshotFor(
      openedVariant(
        "current-metadata-notification-conflict",
        "2026-08-11T18:37:00.000Z",
      ),
    );
    vi.stubGlobal("window", { openai: {} });
    const bridge = new ShockAuditBridge();
    const callServerTool = vi.fn(
      async (call: { arguments: Record<string, unknown> }) => {
        const operationId = String(call.arguments.operationId);
        notifyWorkflowToolResult(bridge, {
          _meta: {
            [SCREEN_02_WORKFLOW_META_KEY]: notifiedWorkflow,
            [SCREEN_02_WORKFLOW_CORRELATION_META_KEY]:
              createScreen02WorkflowCorrelation(
                notifiedWorkflow,
                operationId,
                "open",
              ),
          },
        });
        const sealedSnapshot = await sealScreen02WorkflowClientSnapshot(
          directWorkflow,
          {
            operationId,
            kind: "open",
            responseKey: {
              keyId: String(call.arguments.responseKeyId),
              key: String(call.arguments.responseKey),
            },
          },
        );
        return { structuredContent: { ok: true, sealedSnapshot } };
      },
    );
    (
      bridge as unknown as {
        app: {
          getHostCapabilities: () => { serverTools: object };
          callServerTool: typeof callServerTool;
        };
      }
    ).app = {
      getHostCapabilities: () => ({ serverTools: {} }),
      callServerTool,
    };

    await expect(
      bridge.openScreen02Workflow(confirmedWorkflowFindContext()),
    ).rejects.toThrow("[SA-S2-RESULT-CONFLICT]");
  });

  it("does not let a malformed notification poison a later valid sealed Find result", async () => {
    const opened = snapshotFor(buildFindFactsState());
    vi.stubGlobal("window", { openai: {} });
    const bridge = new ShockAuditBridge();
    const callServerTool = vi.fn(
      async (call: {
        arguments: Record<string, unknown>;
      }) => {
        const listeners = (
          bridge as unknown as {
            screen02WorkflowToolResultListeners: Set<
              (value: unknown) => void
            >;
          }
        ).screen02WorkflowToolResultListeners;
        for (const listener of [...listeners]) {
          listener({
            _meta: {
              [SCREEN_02_WORKFLOW_META_KEY]: { mode: "find" },
              [SCREEN_02_WORKFLOW_CORRELATION_META_KEY]: {
                operationId: String(call.arguments.operationId),
              },
            },
          });
        }
        const sealedSnapshot =
          await sealScreen02WorkflowClientSnapshot(opened, {
            operationId: String(call.arguments.operationId),
            kind: "open",
            responseKey: {
              keyId: String(call.arguments.responseKeyId),
              key: String(call.arguments.responseKey),
            },
          });
        return { structuredContent: { ok: true, sealedSnapshot } };
      },
    );
    (
      bridge as unknown as {
        app: {
          getHostCapabilities: () => { serverTools: object };
          callServerTool: typeof callServerTool;
        };
      }
    ).app = {
      getHostCapabilities: () => ({ serverTools: {} }),
      callServerTool,
    };

    await expect(
      bridge.openScreen02Workflow(confirmedWorkflowFindContext()),
    ).resolves.toEqual(opened);
  });

  it("fails closed when a valid seal and valid current-operation metadata genuinely disagree", async () => {
    const opened = snapshotFor(buildFindFactsState());
    const conflicting = snapshotFor(
      openedVariant(
        "sealed-current-operation-conflict",
        "2026-08-11T18:30:00.000Z",
      ),
    );
    const openai: {
      toolResponseMetadata?: Record<string, unknown>;
    } = {};
    vi.stubGlobal("window", { openai });
    const bridge = new ShockAuditBridge();
    const callServerTool = vi.fn(
      async (call: { arguments: Record<string, unknown> }) => {
        const operationId = String(call.arguments.operationId);
        openai.toolResponseMetadata = {
          mcp_tool_result: {
            _meta: {
              [SCREEN_02_WORKFLOW_META_KEY]: conflicting,
              [SCREEN_02_WORKFLOW_CORRELATION_META_KEY]:
                createScreen02WorkflowCorrelation(
                  conflicting,
                  operationId,
                  "open",
                ),
            },
          },
        };
        const sealedSnapshot =
          await sealScreen02WorkflowClientSnapshot(opened, {
            operationId,
            kind: "open",
            responseKey: {
              keyId: String(call.arguments.responseKeyId),
              key: String(call.arguments.responseKey),
            },
          });
        return { structuredContent: { ok: true, sealedSnapshot } };
      },
    );
    (
      bridge as unknown as {
        app: {
          getHostCapabilities: () => { serverTools: object };
          callServerTool: typeof callServerTool;
        };
      }
    ).app = {
      getHostCapabilities: () => ({ serverTools: {} }),
      callServerTool,
    };

    await expect(
      bridge.openScreen02Workflow(confirmedWorkflowFindContext()),
    ).rejects.toThrow("[SA-S2-RESULT-CONFLICT]");
  });

  it("joins a compact legacy callTool response with delayed ChatGPT metadata", async () => {
    vi.useFakeTimers();
    const opened = snapshotFor(buildFindFactsState());
    const openai: {
      callTool?: (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<Record<string, unknown>>;
      toolResponseMetadata?: Record<string, unknown>;
    } = {};
    openai.callTool = vi.fn(async (_name, args) => {
      const operationId = String(args.operationId);
      setTimeout(() => {
        openai.toolResponseMetadata = {
          mcp_tool_result: {
            _meta: {
              [SCREEN_02_WORKFLOW_META_KEY]: opened,
              [SCREEN_02_WORKFLOW_CORRELATION_META_KEY]:
                createScreen02WorkflowCorrelation(
                  opened,
                  operationId,
                  "open",
                ),
            },
          },
        };
      }, 25);
      return { structuredContent: { ok: true } };
    });
    vi.stubGlobal("window", { openai });
    const bridge = new ShockAuditBridge();

    const opening = bridge.openScreen02Workflow(
      confirmedWorkflowFindContext(),
    );
    await waitForExternalAsyncWork(() =>
      Boolean(
        openai.callTool &&
          vi.mocked(openai.callTool).mock.calls.length >= 1,
      ),
    );
    await vi.advanceTimersByTimeAsync(75);

    await expect(opening).resolves.toEqual(opened);
  });

  it("joins a compact standard tools/call response with a delayed tool-result notification", async () => {
    vi.useFakeTimers();
    const opened = snapshotFor(buildFindFactsState());
    const updated = snapshotFor(
      openedVariant(
        "notification-mutation",
        "2026-08-09T18:00:05.000Z",
      ),
    );
    vi.stubGlobal("window", { openai: {} });
    const bridge = new ShockAuditBridge();
    const callServerTool = vi.fn(
      async (call: {
        name: string;
        arguments: Record<string, unknown>;
      }) => {
        const operationId = String(call.arguments.operationId);
        setTimeout(() => {
          const notification = {
            _meta: {
              [SCREEN_02_WORKFLOW_META_KEY]: updated,
              [SCREEN_02_WORKFLOW_CORRELATION_META_KEY]:
                createScreen02WorkflowCorrelation(
                  updated,
                  operationId,
                  "mutation",
                ),
            },
          };
          const listeners = (
            bridge as unknown as {
              screen02WorkflowToolResultListeners: Set<
                (value: unknown) => void
              >;
            }
          ).screen02WorkflowToolResultListeners;
          for (const listener of [...listeners]) listener(notification);
        }, 25);
        return { structuredContent: { ok: true } };
      },
    );
    (
      bridge as unknown as {
        app: {
          getHostCapabilities: () => { serverTools: object };
          callServerTool: typeof callServerTool;
        };
      }
    ).app = {
      getHostCapabilities: () => ({ serverTools: {} }),
      callServerTool,
    };

    const mutation = bridge.mutateScreen02Workflow(
      opened,
      "find-open",
      { candidateSnapshotId: "gdpr-candidate-snapshot-v1" },
      "notification-operation",
    );
    await waitForExternalAsyncWork(
      () => callServerTool.mock.calls.length >= 1,
    );
    await vi.advanceTimersByTimeAsync(75);

    await expect(mutation).resolves.toEqual(updated);
  });

  it("routes receipts but cannot globally precommit an anonymous snapshot while an exact operation owns the result race", async () => {
    const opened = snapshotFor(buildFindFactsState());
    const updated = snapshotFor(
      openedVariant(
        "exact-result-after-anonymous-notification",
        "2026-08-09T18:00:05.000Z",
      ),
    );
    const unrelated = snapshotFor(buildAuditIdentityState());
    vi.stubGlobal("window", { openai: {} });
    let resolveDirect!: (value: Record<string, unknown>) => void;
    const directResult = new Promise<Record<string, unknown>>((resolve) => {
      resolveDirect = resolve;
    });
    const callServerTool = vi.fn(
      (_call: { name: string; arguments: Record<string, unknown> }) =>
        directResult,
    );
    const bridge = new ShockAuditBridge();
    (
      bridge as unknown as {
        app: {
          getHostCapabilities: () => { serverTools: object };
          callServerTool: typeof callServerTool;
        };
      }
    ).app = {
      getHostCapabilities: () => ({ serverTools: {} }),
      callServerTool,
    };
    const onScreen02WorkflowSnapshot = vi.fn();
    const onScreen02WorkflowReceipt = vi.fn();
    const callbacks: BridgeCallbacks = {
      onHostView: vi.fn(),
      onToolState: vi.fn(),
      onScreen02WorkflowSnapshot,
      onScreen02WorkflowReceipt,
    };
    const internals = bridge as unknown as {
      dispatchToolResultNotification: (
        result: Record<string, unknown>,
        callbacks: BridgeCallbacks,
      ) => void;
      screen02WorkflowToolResultListeners: Set<(value: unknown) => void>;
    };

    const mutation = bridge.mutateScreen02Workflow(
      opened,
      "find-open",
      { candidateSnapshotId: "gdpr-candidate-snapshot-v1" },
      "exact-result-race-operation",
    );
    await waitForExternalAsyncWork(() => callServerTool.mock.calls.length > 0);
    expect(internals.screen02WorkflowToolResultListeners.size).toBe(1);

    internals.dispatchToolResultNotification(
      {
        structuredContent: receiptFor(opened),
        _meta: { [SCREEN_02_WORKFLOW_META_KEY]: unrelated },
      },
      callbacks,
    );
    expect(onScreen02WorkflowSnapshot).not.toHaveBeenCalled();
    expect(onScreen02WorkflowReceipt).toHaveBeenCalledOnce();
    expect(onScreen02WorkflowReceipt).toHaveBeenCalledWith(receiptFor(opened));

    const call = callServerTool.mock.calls[0]![0];
    const sealedSnapshot = await sealScreen02WorkflowClientSnapshot(
      updated,
      {
        operationId: String(call.arguments.operationId),
        kind: "mutation",
        responseKey: {
          keyId: String(call.arguments.responseKeyId),
          key: String(call.arguments.responseKey),
        },
      },
    );
    resolveDirect({
      structuredContent: {
        ...workflowSummary("find", "applied"),
        sealedSnapshot,
      },
    });

    const result = await mutation;
    expect(result).toEqual(updated);
    expect(bridge.screen02WorkflowOperationAttribution(result)).toMatchObject({
      operationId: "exact-result-race-operation",
      outcome: "applied",
      attributable: true,
    });
    expect(onScreen02WorkflowSnapshot).not.toHaveBeenCalled();
    expect(internals.screen02WorkflowToolResultListeners.size).toBe(0);
  });

  it("replays a lost assessment-delivery response once with the same operation ID", async () => {
    const opened = snapshotFor(buildFindFactsState());
    const updated = snapshotFor(
      openedVariant(
        "assessment-delivery-replay",
        "2026-08-09T18:00:05.000Z",
      ),
    );
    const bridge = new ShockAuditBridge();
    const mutation = vi
      .spyOn(bridge, "mutateScreen02Workflow")
      .mockRejectedValueOnce(new Error("The first response was lost."))
      .mockResolvedValueOnce(updated);

    await expect(
      bridge.recordScreen02AssessmentDelivery(
        opened,
        ["assessment-request-1"],
        true,
      ),
    ).resolves.toEqual(updated);

    expect(mutation).toHaveBeenCalledTimes(2);
    expect(mutation.mock.calls[0]?.slice(0, 3)).toEqual([
      opened,
      "assessment-delivery",
      { requestIds: ["assessment-request-1"], delivered: true },
    ]);
    expect(mutation.mock.calls[1]?.slice(0, 3)).toEqual(
      mutation.mock.calls[0]?.slice(0, 3),
    );
    expect(mutation.mock.calls[1]?.[3]).toBe(mutation.mock.calls[0]?.[3]);

    mutation.mockReset();
    mutation.mockRejectedValue(new Error("The delivery record is unavailable."));
    await expect(
      bridge.recordScreen02AssessmentDelivery(
        opened,
        ["assessment-request-2"],
        false,
      ),
    ).rejects.toThrow(/after one safe retry.*request was not sent again/i);
    expect(mutation).toHaveBeenCalledTimes(2);
  });

  it("rejects a delayed exact-current tampered seal even when metadata in the same notification resolves first", async () => {
    vi.useFakeTimers();
    const opened = snapshotFor(buildFindFactsState());
    vi.stubGlobal("window", { openai: {} });
    const bridge = new ShockAuditBridge();
    let notificationScheduled = false;
    const callServerTool = vi.fn(
      async (call: { arguments: Record<string, unknown> }) => {
        const operationId = String(call.arguments.operationId);
        const sealed = await sealScreen02WorkflowClientSnapshot(opened, {
          operationId,
          kind: "open",
          responseKey: {
            keyId: String(call.arguments.responseKeyId),
            key: String(call.arguments.responseKey),
          },
        });
        setTimeout(() => {
          notifyWorkflowToolResult(bridge, {
            structuredContent: {
              ok: true,
              sealedSnapshot: tamperSealedCiphertext(sealed),
            },
            _meta: {
              [SCREEN_02_WORKFLOW_META_KEY]: opened,
              [SCREEN_02_WORKFLOW_CORRELATION_META_KEY]:
                createScreen02WorkflowCorrelation(
                  opened,
                  operationId,
                  "open",
                ),
            },
          });
        }, 25);
        notificationScheduled = true;
        return { structuredContent: { ok: true } };
      },
    );
    (
      bridge as unknown as {
        app: {
          getHostCapabilities: () => { serverTools: object };
          callServerTool: typeof callServerTool;
        };
      }
    ).app = {
      getHostCapabilities: () => ({ serverTools: {} }),
      callServerTool,
    };

    const opening = bridge.openScreen02Workflow(
      confirmedWorkflowFindContext(),
    );
    const expectation = expect(opening).rejects.toThrow(
      "[SA-S2-SEALED-RESULT-INVALID]",
    );
    await waitForExternalAsyncWork(() => notificationScheduled);
    await vi.advanceTimersByTimeAsync(75);
    await expectation;
  });

  it("rejects a delayed valid Audit seal that conflicts with metadata in the same notification", async () => {
    vi.useFakeTimers();
    const metadataWorkflow = snapshotFor(buildAuditIdentityState());
    const sealedWorkflow = snapshotFor(buildAuditIdentityState(), {
      accessToken: "conflicting-audit-notification-token-".padEnd(64, "c"),
    });
    vi.stubGlobal("window", { openai: {} });
    const bridge = new ShockAuditBridge();
    let notificationScheduled = false;
    const callServerTool = vi.fn(
      async (call: { arguments: Record<string, unknown> }) => {
        const operationId = String(call.arguments.operationId);
        const sealed = await sealScreen02WorkflowClientSnapshot(
          sealedWorkflow,
          {
            operationId,
            kind: "open",
            responseKey: {
              keyId: String(call.arguments.responseKeyId),
              key: String(call.arguments.responseKey),
            },
          },
        );
        setTimeout(() => {
          notifyWorkflowToolResult(bridge, {
            structuredContent: { ok: true, sealedSnapshot: sealed },
            _meta: {
              [SCREEN_02_WORKFLOW_META_KEY]: metadataWorkflow,
              [SCREEN_02_WORKFLOW_CORRELATION_META_KEY]:
                createScreen02WorkflowCorrelation(
                  metadataWorkflow,
                  operationId,
                  "open",
                ),
            },
          });
        }, 25);
        notificationScheduled = true;
        return { structuredContent: { ok: true } };
      },
    );
    (
      bridge as unknown as {
        app: {
          getHostCapabilities: () => { serverTools: object };
          callServerTool: typeof callServerTool;
        };
      }
    ).app = {
      getHostCapabilities: () => ({ serverTools: {} }),
      callServerTool,
    };

    const opening = bridge.openScreen02Workflow(
      confirmedWorkflowAuditContext(),
    );
    const expectation = expect(opening).rejects.toThrow(
      "[SA-S2-RESULT-CONFLICT]",
    );
    await waitForExternalAsyncWork(() => notificationScheduled);
    await vi.advanceTimersByTimeAsync(75);
    await expectation;
  });

  it("replays a summary-only standards call through the ChatGPT compatibility bridge with the same operation", async () => {
    const opened = snapshotFor(buildFindFactsState());
    const standardCalls: Array<{
      name: string;
      arguments: Record<string, unknown>;
    }> = [];
    const callServerTool = vi.fn(
      async (call: {
        name: string;
        arguments: Record<string, unknown>;
      }) => {
        standardCalls.push(call);
        return { structuredContent: { ok: true } };
      },
    );
    const compatibilityCalls: Array<{
      name: string;
      arguments: Record<string, unknown>;
    }> = [];
    const callTool = vi.fn(
      async (name: string, arguments_: Record<string, unknown>) => {
        compatibilityCalls.push({ name, arguments: arguments_ });
        const operationId = String(arguments_.operationId);
        return {
          structuredContent: { ok: true },
          _meta: {
            [SCREEN_02_WORKFLOW_META_KEY]: opened,
            [SCREEN_02_WORKFLOW_CORRELATION_META_KEY]:
              createScreen02WorkflowCorrelation(
                opened,
                operationId,
                "open",
              ),
          },
        };
      },
    );
    vi.stubGlobal("window", {
      openai: { widgetState: {}, callTool },
    });
    const bridge = new ShockAuditBridge();
    (
      bridge as unknown as {
        app: {
          getHostCapabilities: () => { serverTools: object };
          callServerTool: typeof callServerTool;
        };
      }
    ).app = {
      getHostCapabilities: () => ({ serverTools: {} }),
      callServerTool,
    };

    await expect(
      bridge.openScreen02Workflow(confirmedWorkflowFindContext()),
    ).resolves.toEqual(opened);

    expect(standardCalls).toHaveLength(1);
    expect(compatibilityCalls).toHaveLength(1);
    expect(compatibilityCalls[0]).toEqual(standardCalls[0]);
    expect(standardCalls[0]!.arguments.operationId).toMatch(
      new RegExp(`^${SCREEN_02_WORKFLOW_OPEN_REQUEST_PREFIX}`),
    );
  });

  it("buffers a matching standard notification that arrives before the direct promise", async () => {
    vi.useFakeTimers();
    const opened = snapshotFor(buildFindFactsState());
    vi.stubGlobal("window", { openai: {} });
    const bridge = new ShockAuditBridge();
    const callServerTool = vi.fn(
      async (call: { arguments: Record<string, unknown> }) => {
        const operationId = String(call.arguments.operationId);
        setTimeout(() => {
          const notification = {
            _meta: {
              [SCREEN_02_WORKFLOW_META_KEY]: opened,
              [SCREEN_02_WORKFLOW_CORRELATION_META_KEY]:
                createScreen02WorkflowCorrelation(
                  opened,
                  operationId,
                  "open",
                ),
            },
          };
          const listeners = (
            bridge as unknown as {
              screen02WorkflowToolResultListeners: Set<
                (value: unknown) => void
              >;
            }
          ).screen02WorkflowToolResultListeners;
          for (const listener of [...listeners]) listener(notification);
        }, 5);
        await new Promise((resolve) => setTimeout(resolve, 25));
        return { structuredContent: { ok: true } };
      },
    );
    (
      bridge as unknown as {
        app: {
          getHostCapabilities: () => { serverTools: object };
          callServerTool: typeof callServerTool;
        };
      }
    ).app = {
      getHostCapabilities: () => ({ serverTools: {} }),
      callServerTool,
    };

    const opening = bridge.openScreen02Workflow(
      confirmedWorkflowFindContext(),
    );
    await waitForExternalAsyncWork(
      () => callServerTool.mock.calls.length >= 1,
    );
    await vi.advanceTimersByTimeAsync(30);

    await expect(opening).resolves.toEqual(opened);
  });

  it("ignores mismatched optional metadata and times out when no valid result arrives", async () => {
    vi.useFakeTimers();
    const opened = snapshotFor(buildFindFactsState());
    const conflicting = snapshotFor(
      openedVariant(
        "mismatched-correlation",
        "2026-08-09T18:00:06.000Z",
      ),
    );
    const callTool = vi.fn(
      async (_name: string, args: Record<string, unknown>) => ({
        structuredContent: { ok: true },
        _meta: {
          [SCREEN_02_WORKFLOW_META_KEY]: conflicting,
          [SCREEN_02_WORKFLOW_CORRELATION_META_KEY]:
            createScreen02WorkflowCorrelation(
              opened,
              String(args.operationId),
              "open",
            ),
        },
      }),
    );
    vi.stubGlobal("window", {
      openai: { widgetState: {}, callTool },
    });
    const bridge = new ShockAuditBridge();

    const opening = bridge.openScreen02Workflow(
      confirmedWorkflowFindContext(),
    );
    const expectation = expect(opening).rejects.toThrow(
      /The Screen 2 request completed, but its workflow state was not delivered.*\[SA-S2-RESULT-METADATA-TIMEOUT\]/,
    );
    await waitForExternalAsyncWork(() => callTool.mock.calls.length >= 1);
    await vi.advanceTimersByTimeAsync(5_050);
    await expectation;
  });

  it("cancels an outstanding private-result wait on disconnect", async () => {
    const callTool = vi.fn(async () => ({
      structuredContent: { ok: true },
    }));
    vi.stubGlobal("window", {
      openai: {
        widgetState: {},
        callTool,
      },
    });
    const bridge = new ShockAuditBridge();
    const opening = bridge.openScreen02Workflow(
      confirmedWorkflowFindContext(),
    );
    await waitForExternalAsyncWork(() => callTool.mock.calls.length >= 1);
    bridge.disconnect();

    await expect(opening).rejects.toThrow(
      "[SA-S2-RESULT-DISCONNECTED]",
    );
  });

  it("times out honestly when ChatGPT returns only the compact summary", async () => {
    vi.useFakeTimers();
    const callTool = vi.fn(async () => ({
      structuredContent: { ok: true },
    }));
    vi.stubGlobal("window", {
      openai: {
        widgetState: {},
        callTool,
      },
    });
    const bridge = new ShockAuditBridge();

    const opening = bridge.openScreen02Workflow(
      confirmedWorkflowFindContext(),
    );
    const expectation = expect(opening).rejects.toThrow(
      "[SA-S2-RESULT-METADATA-TIMEOUT]",
    );
    await waitForExternalAsyncWork(() => callTool.mock.calls.length >= 1);
    await vi.advanceTimersByTimeAsync(5_050);

    await expectation;
  });

  it("bounds a pending workflow tool promise before the separate metadata wait", async () => {
    vi.useFakeTimers();
    const callTool = vi.fn(
      () => new Promise<Record<string, unknown>>(() => undefined),
    );
    vi.stubGlobal("window", {
      openai: { widgetState: {}, callTool },
    });
    const bridge = new ShockAuditBridge({
      screen02WorkflowToolCallTimeoutMs: 80,
      screen02WorkflowMetadataTimeoutMs: 25,
    });

    const opening = bridge.openScreen02Workflow(
      confirmedWorkflowFindContext(),
    );
    const expectation = expect(opening).rejects.toThrow(
      "[SA-S2-TOOL-CALL-TIMEOUT]",
    );
    await waitForExternalAsyncWork(() => callTool.mock.calls.length >= 1);
    await vi.advanceTimersByTimeAsync(79);
    await Promise.resolve();
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    await vi.advanceTimersByTimeAsync(1);
    await expectation;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not launch a compatibility replay after the shared dispatch deadline", async () => {
    vi.useFakeTimers();
    const callTool = vi.fn(async () => ({ structuredContent: { ok: true } }));
    vi.stubGlobal("window", {
      openai: { widgetState: {}, callTool },
    });
    const callServerTool = vi.fn(
      (_call: { name: string; arguments: Record<string, unknown> }) =>
        new Promise<Record<string, unknown>>(() => undefined),
    );
    const bridge = new ShockAuditBridge({
      screen02WorkflowToolCallTimeoutMs: 80,
      screen02WorkflowMetadataTimeoutMs: 25,
    });
    (
      bridge as unknown as {
        app: {
          getHostCapabilities: () => { serverTools: object };
          callServerTool: typeof callServerTool;
        };
      }
    ).app = {
      getHostCapabilities: () => ({ serverTools: {} }),
      callServerTool,
    };

    const opening = bridge.openScreen02Workflow(
      confirmedWorkflowFindContext(),
    );
    const expectation = expect(opening).rejects.toThrow(
      "[SA-S2-TOOL-CALL-TIMEOUT]",
    );
    await waitForExternalAsyncWork(
      () => callServerTool.mock.calls.length >= 1,
    );
    await vi.advanceTimersByTimeAsync(80);
    await expectation;

    expect(callServerTool).toHaveBeenCalledOnce();
    expect(callTool).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reuses the same idempotent open operation after a metadata timeout", async () => {
    vi.useFakeTimers();
    const opened = snapshotFor(buildFindFactsState());
    const operationIds: string[] = [];
    const callTool = vi.fn(
      async (_name: string, args: Record<string, unknown>) => {
        const operationId = String(args.operationId);
        operationIds.push(operationId);
        if (operationIds.length === 1) {
          return { structuredContent: { ok: true } };
        }
        return {
          structuredContent: { ok: true },
          _meta: {
            [SCREEN_02_WORKFLOW_META_KEY]: opened,
            [SCREEN_02_WORKFLOW_CORRELATION_META_KEY]:
              createScreen02WorkflowCorrelation(
                opened,
                operationId,
                "open",
              ),
          },
        };
      },
    );
    vi.stubGlobal("window", {
      openai: { widgetState: {}, callTool },
    });
    const bridge = new ShockAuditBridge();
    const context = confirmedWorkflowFindContext();

    const first = bridge.openScreen02Workflow(context);
    const firstExpectation = expect(first).rejects.toThrow(
      "[SA-S2-RESULT-METADATA-TIMEOUT]",
    );
    await waitForExternalAsyncWork(() => callTool.mock.calls.length >= 1);
    await vi.advanceTimersByTimeAsync(5_050);
    await firstExpectation;

    await expect(bridge.openScreen02Workflow(context)).resolves.toEqual(
      opened,
    );
    expect(operationIds).toHaveLength(2);
    expect(operationIds[1]).toBe(operationIds[0]);
  });

  it("does not reuse a timed-out standard opener for a blank reset", async () => {
    vi.useFakeTimers();
    const opened = snapshotFor(buildFindFactsState());
    const calls: Array<Record<string, unknown>> = [];
    const callTool = vi.fn(
      async (_name: string, args: Record<string, unknown>) => {
        calls.push(args);
        if (calls.length === 1) {
          return { structuredContent: { ok: true } };
        }
        return {
          structuredContent: { ok: true },
          _meta: {
            [SCREEN_02_WORKFLOW_META_KEY]: opened,
            [SCREEN_02_WORKFLOW_CORRELATION_META_KEY]:
              createScreen02WorkflowCorrelation(
                opened,
                String(args.operationId),
                "open",
              ),
          },
        };
      },
    );
    vi.stubGlobal("window", {
      openai: { widgetState: {}, callTool },
    });
    const bridge = new ShockAuditBridge();
    const context = confirmedWorkflowFindContext();

    const first = bridge.openScreen02Workflow(context, "standard");
    const firstExpectation = expect(first).rejects.toThrow(
      "[SA-S2-RESULT-METADATA-TIMEOUT]",
    );
    await waitForExternalAsyncWork(() => callTool.mock.calls.length >= 1);
    await vi.advanceTimersByTimeAsync(5_050);
    await firstExpectation;

    await expect(
      bridge.openScreen02Workflow(context, "blank"),
    ).resolves.toEqual(opened);
    expect(calls).toHaveLength(2);
    expect(calls[0]).not.toHaveProperty("initialState");
    expect(calls[1]).toMatchObject({ initialState: "blank" });
    expect(calls[1]!.operationId).not.toBe(calls[0]!.operationId);
  });

  it("reports an unavailable Screen 2 assessment channel without provider wording", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T12:00:00.000Z"));
    const { workflow } = assessmentTransportFixture(
      "unavailable-assessment-channel",
    );
    vi.stubGlobal("window", { openai: {} });
    const bridge = new ShockAuditBridge();

    const delivery = await bridge.requestScreen02WorkflowAssessment(workflow);

    expect(delivery).toMatchObject({
      delivered: false,
      channel: "unavailable",
      message:
        "This view cannot start the preliminary assessment. Source facts remain available.",
    });
    expect(delivery.message).not.toMatch(
      /ChatGPT|host|model|MCP|provider|fallback/i,
    );
  });

  it("publishes private context before one identity-only standards assessment message", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T12:00:00.000Z"));
    const { assessmentBatch, modelContext, workflow } =
      assessmentTransportFixture("standards-only-assessment");
    expect(
      restoreScreen02WorkflowClientSnapshot({
        ...workflow,
        assessmentBatch: {
          ...assessmentBatch,
          modelContext: {
            ...modelContext,
            accessToken: "not-even-the-real-token",
          },
        },
      }),
    ).toBeNull();
    expect(
      restoreScreen02WorkflowClientSnapshot({
        ...workflow,
        assessmentBatch: {
          ...assessmentBatch,
          prompt: `${assessmentBatch.prompt} ${workflow.accessToken}`,
        },
      }),
    ).toBeNull();
    const updateModelContext = vi.fn(async (_value: unknown) => undefined);
    const sendMessage = vi.fn(async (_value: unknown) => ({
      isError: false,
    }));
    vi.stubGlobal("window", { openai: {} });
    const bridge = new ShockAuditBridge();
    (
      bridge as unknown as {
        app: {
          getHostCapabilities: () => {
            message: { text: object };
            updateModelContext: { structuredContent: object };
          };
          updateModelContext: typeof updateModelContext;
          sendMessage: typeof sendMessage;
        };
      }
    ).app = {
      getHostCapabilities: () => ({
        message: { text: {} },
        updateModelContext: { structuredContent: {} },
      }),
      updateModelContext,
      sendMessage,
    };

    await expect(
      bridge.requestScreen02WorkflowAssessment(workflow),
    ).resolves.toMatchObject({
      delivered: true,
      channel: "mcp-apps",
      route: "ui/message",
      result: "accepted",
      message: "The bounded assessment request was accepted.",
      retryCount: 0,
      requestedAt: expect.any(String),
      settledAt: expect.any(String),
    });
    expect(updateModelContext).toHaveBeenCalledOnce();
    expect(updateModelContext.mock.invocationCallOrder[0]).toBeLessThan(
      sendMessage.mock.invocationCallOrder[0]!,
    );
    expect(sendMessage).toHaveBeenCalledOnce();
    const standardRequest = sendMessage.mock.calls[0]?.[0] as {
      role: string;
      content: Array<{ type: string; text: string }>;
    };
    expect(standardRequest).toMatchObject({
      role: "user",
      content: [{ type: "text" }],
    });
    expect(standardRequest.content[0]?.text).toContain(assessmentBatch.requestIds[0]);
    expect(standardRequest.content[0]?.text).not.toContain(assessmentBatch.prompt);
    expect(standardRequest.content[0]?.text).not.toContain(JSON.stringify(modelContext));
    expect(JSON.stringify(updateModelContext.mock.calls)).toContain(
      modelContext.requests[0]!.capabilityToken,
    );
    expect(JSON.stringify(sendMessage.mock.calls)).not.toContain(
      workflow.accessToken,
    );
    expect(JSON.stringify(sendMessage.mock.calls)).not.toContain(
      "stateEnvelope",
    );
  });

  it("prefers one private-context standards message when both channels exist", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T12:00:00.000Z"));
    const {
      assessmentBatch,
      capabilityToken,
      modelContext,
      requestId,
      requiredTool,
      workflow,
    } = assessmentTransportFixture("compatibility-assessment");
    const privateContent = {
      activeScreen: 2,
      screen02Workflow: { preserve: "private workflow state" },
    };
    const imageIds = ["image-preserved-by-screen-02"];
    let widgetState: Record<string, unknown> = {
      modelContent: "previous model context",
      privateContent,
      imageIds,
    };
    const setWidgetState = vi.fn(
      (_state: Record<string, unknown>) =>
        new Promise<void>(() => undefined),
    );
    const sendFollowUpMessage = vi.fn(async (_value: unknown) => undefined);
    const compatibilityHost = {
      widgetState,
      setWidgetState,
      sendFollowUpMessage,
    };
    vi.stubGlobal("window", { openai: compatibilityHost });
    const updateModelContext = vi.fn(async (_value: unknown) => undefined);
    const sendMessage = vi.fn(async (_value: unknown) => ({
      isError: false,
    }));
    const bridge = new ShockAuditBridge();
    (
      bridge as unknown as {
        app: {
          getHostCapabilities: () => {
            message: { text: object };
            updateModelContext: { structuredContent: object };
          };
          updateModelContext: typeof updateModelContext;
          sendMessage: typeof sendMessage;
        };
      }
    ).app = {
      getHostCapabilities: () => ({
        message: { text: {} },
        updateModelContext: { structuredContent: {} },
      }),
      updateModelContext,
      sendMessage,
    };

    await expect(
      bridge.requestScreen02WorkflowAssessment(workflow),
    ).resolves.toMatchObject({
      delivered: true,
      channel: "mcp-apps",
      message: "The bounded assessment request was accepted.",
    });
    expect(updateModelContext).toHaveBeenCalledOnce();
    expect(sendMessage).toHaveBeenCalledOnce();
    const standardRequest = sendMessage.mock.calls[0]?.[0] as {
      role: string;
      content: Array<{ type: string; text: string }>;
    };
    expect(standardRequest.content[0]?.text).toContain(requestId);
    expect(standardRequest.content[0]?.text).not.toContain(assessmentBatch.prompt);
    expect(standardRequest.content[0]?.text).not.toContain(capabilityToken);
    expect(standardRequest.content[0]?.text).not.toContain(requiredTool);
    expect(setWidgetState).not.toHaveBeenCalled();
    expect(sendFollowUpMessage).not.toHaveBeenCalled();
    expect(standardRequest.content[0]?.text).not.toContain(workflow.accessToken);
    expect(standardRequest.content[0]?.text).not.toContain("stateEnvelope");
  });

  it("uses compatibility only after publishing private task context", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T12:00:00.000Z"));
    const {
      assessmentBatch,
      capabilityToken,
      modelContext,
      requestId,
      requiredTool,
      workflow,
    } = assessmentTransportFixture("compatibility-mirror-rejection");
    const setWidgetState = vi.fn(
      (_state: Record<string, unknown>) =>
        new Promise<void>(() => undefined),
    );
    const sendFollowUpMessage = vi.fn(async (_value: unknown) => undefined);
    const compatibilityHost = {
      widgetState: {
        privateContent: { activeScreen: 2 },
      },
      setWidgetState,
      sendFollowUpMessage,
    };
    vi.stubGlobal("window", { openai: compatibilityHost });
    const updateModelContext = vi.fn(async (_value: unknown) => undefined);
    const sendMessage = vi.fn(async (_value: unknown) => ({ isError: false }));
    const bridge = new ShockAuditBridge();
    (
      bridge as unknown as {
        app: {
          getHostCapabilities: () => { updateModelContext: { structuredContent: object } };
          updateModelContext: typeof updateModelContext;
          sendMessage: typeof sendMessage;
        };
      }
    ).app = {
      getHostCapabilities: () => ({ updateModelContext: { structuredContent: {} } }),
      updateModelContext,
      sendMessage,
    };

    await expect(
      bridge.requestScreen02WorkflowAssessment(workflow),
    ).resolves.toMatchObject({
      delivered: true,
      channel: "chatgpt-compatibility",
      route: "sendFollowUpMessage",
      result: "accepted",
      message: "The bounded assessment request was accepted.",
    });
    expect(setWidgetState).not.toHaveBeenCalled();
    expect(sendFollowUpMessage).toHaveBeenCalledOnce();
    const compatibilityRequest = sendFollowUpMessage.mock.calls[0]?.[0] as {
      prompt: string;
      scrollToBottom?: boolean;
    };
    expect(compatibilityRequest.scrollToBottom).toBe(false);
    expect(compatibilityRequest.prompt).toContain(requestId);
    expect(compatibilityRequest.prompt).not.toContain(assessmentBatch.prompt);
    expect(compatibilityRequest.prompt).not.toContain(JSON.stringify(modelContext));
    expect(compatibilityRequest.prompt).not.toContain(capabilityToken);
    expect(compatibilityRequest.prompt).not.toContain(requiredTool);
    expect(updateModelContext).toHaveBeenCalledOnce();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("fails closed after one ambiguous compatibility-only message rejection", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T12:00:00.000Z"));
    const { assessmentBatch, modelContext, workflow } =
      assessmentTransportFixture("compatibility-message-rejection");
    const sendFollowUpMessage = vi.fn(async (_value: unknown) => {
      throw new Error("compatibility message delivery was ambiguous");
    });
    const setWidgetState = vi.fn(
      (_state: Record<string, unknown>) =>
        new Promise<void>(() => undefined),
    );
    vi.stubGlobal("window", {
      openai: { sendFollowUpMessage, setWidgetState },
    });
    const updateModelContext = vi.fn(async (_value: unknown) => undefined);
    const sendMessage = vi.fn(async () => ({ isError: false }));
    const bridge = new ShockAuditBridge();
    (
      bridge as unknown as {
        app: {
          getHostCapabilities: () => { updateModelContext: { structuredContent: object } };
          updateModelContext: typeof updateModelContext;
          sendMessage: typeof sendMessage;
        };
      }
    ).app = {
      getHostCapabilities: () => ({ updateModelContext: { structuredContent: {} } }),
      updateModelContext,
      sendMessage,
    };

    await expect(
      bridge.requestScreen02WorkflowAssessment(workflow),
    ).resolves.toMatchObject({
      delivered: false,
      channel: "message-rejected",
      message:
        "The bounded assessment could not start. No second request was sent; the source-derived assessment remains available.",
    });
    expect(sendFollowUpMessage).toHaveBeenCalledOnce();
    expect(sendFollowUpMessage).toHaveBeenCalledWith({
      prompt: expect.stringContaining(assessmentBatch.requestIds[0]!),
      scrollToBottom: false,
    });
    expect(sendFollowUpMessage.mock.calls[0]?.[0]).toMatchObject({
      prompt: expect.not.stringContaining(assessmentBatch.prompt),
    });
    expect(setWidgetState).not.toHaveBeenCalled();
    expect(updateModelContext).toHaveBeenCalledOnce();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("fails closed when private context publication is rejected", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T12:00:00.000Z"));
    const { assessmentBatch, modelContext, workflow } = assessmentTransportFixture(
      "standards-context-rejection",
    );
    const setWidgetState = vi.fn(
      (_state: Record<string, unknown>) =>
        new Promise<void>(() => undefined),
    );
    vi.stubGlobal("window", {
      openai: {
        widgetState: { privateContent: { activeScreen: 2 } },
        setWidgetState,
      },
    });
    const updateModelContext = vi.fn(async () => {
      throw new Error("private context rejected");
    });
    const sendMessage = vi.fn(async (_value: unknown) => ({ isError: false }));
    const bridge = new ShockAuditBridge();
    (
      bridge as unknown as {
        app: {
          getHostCapabilities: () => {
            message: { text: object };
            updateModelContext: { structuredContent: object };
          };
          updateModelContext: typeof updateModelContext;
          sendMessage: typeof sendMessage;
        };
      }
    ).app = {
      getHostCapabilities: () => ({
        message: { text: {} },
        updateModelContext: { structuredContent: {} },
      }),
      updateModelContext,
      sendMessage,
    };

    await expect(
      bridge.requestScreen02WorkflowAssessment(workflow),
    ).resolves.toMatchObject({
      delivered: false,
      channel: "context-rejected",
      message:
        "The private assessment context could not be prepared. The assessment request was not sent; source facts remain available.",
    });
    expect(updateModelContext).toHaveBeenCalledOnce();
    expect(setWidgetState).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("never falls through to compatibility after an ambiguous standards message rejection", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T12:00:00.000Z"));
    const { assessmentBatch, modelContext, workflow } =
      assessmentTransportFixture("standards-message-rejection");
    const sendFollowUpMessage = vi.fn(async (_value: unknown) => undefined);
    const setWidgetState = vi.fn(
      (_state: Record<string, unknown>) =>
        new Promise<void>(() => undefined),
    );
    vi.stubGlobal("window", {
      openai: { sendFollowUpMessage, setWidgetState },
    });
    const updateModelContext = vi.fn(async (_value: unknown) => undefined);
    const sendMessage = vi.fn(async (_value: unknown) => {
      throw new Error("standard message delivery was ambiguous");
    });
    const bridge = new ShockAuditBridge();
    (
      bridge as unknown as {
        app: {
          getHostCapabilities: () => {
            message: { text: object };
            updateModelContext: { structuredContent: object };
          };
          updateModelContext: typeof updateModelContext;
          sendMessage: typeof sendMessage;
        };
      }
    ).app = {
      getHostCapabilities: () => ({
        message: { text: {} },
        updateModelContext: { structuredContent: {} },
      }),
      updateModelContext,
      sendMessage,
    };

    await expect(
      bridge.requestScreen02WorkflowAssessment(workflow),
    ).resolves.toMatchObject({
      delivered: false,
      channel: "message-rejected",
      message:
        "The bounded assessment could not start. No second request was sent; the source-derived assessment remains available.",
    });
    expect(updateModelContext).toHaveBeenCalledOnce();
    expect(sendMessage).toHaveBeenCalledOnce();
    expect(sendMessage).toHaveBeenCalledWith({
      role: "user",
      content: [
        {
          type: "text",
          text: expect.stringContaining(assessmentBatch.requestIds[0]!),
        },
      ],
    });
    expect(JSON.stringify(sendMessage.mock.calls)).not.toContain(
      JSON.stringify(modelContext),
    );
    expect(sendFollowUpMessage).not.toHaveBeenCalled();
    expect(setWidgetState).not.toHaveBeenCalled();
  });
});
