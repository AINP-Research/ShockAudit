import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const appHarness = vi.hoisted(() => {
  const browserWindow: Record<string, unknown> = { openai: {} };
  browserWindow.parent = browserWindow;
  (globalThis as unknown as { window: Record<string, unknown> }).window =
    browserWindow;
  return {
    screen01Props: null as Record<string, unknown> | null,
    legacyProps: null as Record<string, unknown> | null,
    findProps: null as Record<string, unknown> | null,
    auditProps: null as Record<string, unknown> | null,
  };
});

vi.mock("../../src/ui/screen-01/Screen01", () => ({
  default: (props: Record<string, unknown>) => {
    appHarness.screen01Props = props;
    return createElement("div", { "data-app-route": "screen-01" });
  },
}));

vi.mock("../../src/ui/screen-02/Screen02", () => ({
  default: (props: Record<string, unknown>) => {
    appHarness.legacyProps = props;
    return createElement("div", { "data-app-route": "legacy-screen-02" });
  },
  screen02HasCompletedAiReview: () => false,
}));

vi.mock("../../src/ui/screen-02-find/Screen02Find", () => ({
  default: (props: Record<string, unknown>) => {
    appHarness.findProps = props;
    return createElement("div", { "data-app-route": "workflow-find" });
  },
}));

vi.mock("../../src/ui/screen-02-audit/Screen02Audit", () => ({
  default: (props: Record<string, unknown>) => {
    appHarness.auditProps = props;
    return createElement("div", { "data-app-route": "workflow-audit" });
  },
}));

vi.mock("../../src/ui/stage1-proof/Stage1AssessmentProof", () => ({
  default: () => createElement("div", { "data-app-route": "stage-1-proof" }),
}));

import {
  SCREEN_02_WORKFLOW_CLIENT_SCHEMA_VERSION,
  restoreScreen02WorkflowClientSnapshot,
  type Screen02WorkflowClientSnapshot,
} from "../../src/core/screen02-workflow-client";
import { createInitialState } from "../../src/core/screen01-service";
import { getAmbiguities } from "../../src/core/scope-validation";
import type { Ambiguity, Screen01State } from "../../src/core/scope-types";
import { encodeScreen02AuditWorkflowStateEnvelope } from "../../src/core/screen02-audit-workflow-envelope";
import { encodeScreen02FindWorkflowStateEnvelope } from "../../src/core/screen02-workflow-envelope";
import {
  beginScreen02FindDiscovery,
  failScreen02FindDiscovery,
} from "../../src/core/screen02-find-workflow";
import { fingerprintScreen02WorkflowState } from "../../src/core/screen02-workflow-state";
import type { Screen02WorkflowState } from "../../src/core/screen02-workflow-types";
import App, {
  screen02HostTaskMessage,
  screen02MutationAttributionAllowsCommit,
} from "../../src/ui/App";
import { screen02FindTerminalNotice } from
  "../../src/ui/screen-02-find/find-view-model";
import {
  SCREEN_02_WORKFLOW_WIDGET_SCHEMA_VERSION,
  ShockAuditBridge,
  type Screen02WorkflowWidgetSnapshot,
} from "../../src/ui/mcp-bridge";
import {
  buildAuditIdentityState,
  buildFixedQualifiedFindState,
  buildFindFactsState,
  legacyAuditSessionFixture,
} from "../core/screen02-workflow-fixtures";

const appSource = readFileSync(
  new URL("../../src/ui/App.tsx", import.meta.url),
  "utf8",
);
const compactAppSource = appSource.replace(/\s+/g, " ");

function workflowSnapshot(
  state: Screen02WorkflowState,
): Screen02WorkflowClientSnapshot {
  const candidate: Screen02WorkflowClientSnapshot = {
    schemaVersion: SCREEN_02_WORKFLOW_CLIENT_SCHEMA_VERSION,
    runId: state.runId,
    accessToken: `app-workflow-${state.mode}-token-`.padEnd(64, "x"),
    mode: state.mode,
    revision: state.revision,
    stateFingerprint: fingerprintScreen02WorkflowState(state),
    stateEnvelope:
      state.mode === "find"
        ? encodeScreen02FindWorkflowStateEnvelope(state)
        : encodeScreen02AuditWorkflowStateEnvelope(state),
    assessmentAvailable: false,
    assessmentBatch: null,
    handoff: null,
  };
  const restored = restoreScreen02WorkflowClientSnapshot(candidate);
  if (!restored) throw new Error("App workflow fixture is invalid.");
  return restored;
}

function workflowWidget(
  workflow: Screen02WorkflowClientSnapshot,
  activeScreen: 1 | 2,
  openedMatchSnapshotId: string | null = null,
): Screen02WorkflowWidgetSnapshot {
  return {
    schemaVersion: SCREEN_02_WORKFLOW_WIDGET_SCHEMA_VERSION,
    workflow,
    activeScreen,
    openedMatchSnapshotId,
  };
}

function setWidgetState(widgetState: Record<string, unknown>) {
  window.openai = {
    widgetState: {
      modelContent: "ShockAudit private restoration state.",
      privateContent: widgetState,
    },
  };
}

function resetCapturedRoutes() {
  appHarness.screen01Props = null;
  appHarness.legacyProps = null;
  appHarness.findProps = null;
  appHarness.auditProps = null;
}

afterEach(() => {
  vi.restoreAllMocks();
  resetCapturedRoutes();
  window.openai = { widgetState: {} };
});

describe("App canonical Screen 2 workflow integration", () => {
  it("makes wider-search availability copy reflect the visible candidate count", () => {
    for (const phase of ["waiting", "timed-out", "failed"] as const) {
      const emptyMessage = screen02HostTaskMessage(phase, 0);
      expect(emptyMessage).toContain(
        "No source-backed candidate results are currently available.",
      );
      expect(emptyMessage).not.toMatch(
        /source-backed (?:candidate )?results? remains? (?:available|usable)/iu,
      );
    }

    expect(screen02HostTaskMessage("timed-out", 1)).toContain(
      "One source-backed candidate result remains available.",
    );
    expect(screen02HostTaskMessage("failed", 2)).toContain(
      "2 source-backed candidate results remain available.",
    );
  });

  it("requires exact-operation attribution before a foreground result can commit", () => {
    const exactApplied = {
      operationId: "screen02-ui-attribution-test",
      kind: "mutation" as const,
      outcome: "applied" as const,
      attributable: true,
      binding: "exact-operation-seal-or-correlation" as const,
    };
    expect(screen02MutationAttributionAllowsCommit(
      exactApplied,
      exactApplied.operationId,
      "find-search",
    )).toBe(true);
    expect(screen02MutationAttributionAllowsCommit(
      { ...exactApplied, outcome: "replayed" },
      exactApplied.operationId,
      "find-search",
    )).toBe(true);
    expect(screen02MutationAttributionAllowsCommit(
      { ...exactApplied, outcome: "conflict" },
      exactApplied.operationId,
      "find-search",
    )).toBe(true);
    expect(screen02MutationAttributionAllowsCommit(
      null,
      exactApplied.operationId,
      "find-search",
    )).toBe(false);
    expect(screen02MutationAttributionAllowsCommit(
      { ...exactApplied, operationId: "another-operation" },
      exactApplied.operationId,
      "find-search",
    )).toBe(false);
    expect(screen02MutationAttributionAllowsCommit(
      { ...exactApplied, outcome: "refreshed" },
      exactApplied.operationId,
      "find-search",
    )).toBe(false);
    expect(screen02MutationAttributionAllowsCommit(
      { ...exactApplied, binding: undefined as never },
      exactApplied.operationId,
      "find-search",
    )).toBe(false);
  });

  it("restores Find, Audit, and persisted Screen 1 routes from the private widget snapshot", async () => {
    const find = workflowSnapshot(buildFindFactsState());
    setWidgetState({ screen02Workflow: workflowWidget(find, 2) });
    let findHtml = "";
    await vi.waitFor(() => {
      findHtml = renderToStaticMarkup(<App />);
      expect(appHarness.findProps).not.toBeNull();
    });
    expect(findHtml).toContain('data-app-route="workflow-find"');
    expect(findHtml).toContain(
      "Preliminary assessment is unavailable in this view.",
    );
    expect(
      (appHarness.findProps?.state as Screen02WorkflowState).mode,
    ).toBe("find");
    expect(appHarness.findProps?.busy).toBe(false);

    resetCapturedRoutes();
    const auditState = buildAuditIdentityState();
    const audit = workflowSnapshot(auditState);
    const openedMatchSnapshotId =
      auditState.possibleMatches[0]!.matchSnapshotId;
    setWidgetState({
      screen02Workflow: workflowWidget(
        audit,
        2,
        openedMatchSnapshotId,
      ),
    });
    await vi.waitFor(() => {
      expect(renderToStaticMarkup(<App />)).toContain(
        'data-app-route="workflow-audit"',
      );
    });
    expect(appHarness.auditProps?.openedMatchSnapshotId).toBe(
      openedMatchSnapshotId,
    );
    expect(appHarness.auditProps?.busy).toBe(false);

    resetCapturedRoutes();
    setWidgetState({ screen02Workflow: workflowWidget(find, 1) });
    expect(renderToStaticMarkup(<App />)).toContain(
      'data-app-route="screen-01"',
    );
    expect(appHarness.findProps).toBeNull();

    resetCapturedRoutes();
    setWidgetState({
      screen01: createInitialState("find"),
      screen02Workflow: workflowWidget(find, 2),
    });
    expect(renderToStaticMarkup(<App />)).toContain(
      'data-app-route="screen-01"',
    );
    expect(appHarness.findProps).toBeNull();
  });

  it("suppresses pending bootstrap autosaves while allowing the researcher's current edit to sync", async () => {
    window.openai = { widgetState: {} };
    const sync = vi.spyOn(ShockAuditBridge.prototype, "syncWorkspace")
      .mockResolvedValue(undefined);
    renderToStaticMarkup(<App />);
    const save = appHarness.screen01Props!.onSaveState as
      (state: Screen01State, ambiguities: Ambiguity[]) => Promise<void>;
    const update = appHarness.screen01Props!.onStateChange as
      (state: Screen01State) => void;
    const initial = appHarness.screen01Props!.state as Screen01State;
    expect(initial).toEqual(createInitialState());

    await save(initial, getAmbiguities(initial));
    expect(sync).not.toHaveBeenCalled();

    const edited: Screen01State = {
      ...initial,
      revision: initial.revision + 1,
      sentence: "Find a regulation affecting U.S. technology firms from 2015 to 2023.",
      scopeDirty: true,
    };
    update(edited);
    // A delayed callback from the earlier render is also obsolete after an edit.
    await save(initial, getAmbiguities(initial));
    expect(sync).not.toHaveBeenCalled();
    await save(edited, getAmbiguities(edited));
    expect(sync).toHaveBeenCalledOnce();
    expect(sync.mock.calls[0]![0]).toMatchObject({
      state: edited,
      studyContext: { studySentence: edited.sentence, revision: edited.revision },
    });
    expect(sync.mock.calls[0]![1]).toContain(edited.sentence);
  });

  it("rejects an old default unmount save after canonical Audit hydration and preserves valid confirmed-scope sync", async () => {
    const audit = workflowSnapshot(buildAuditIdentityState());
    setWidgetState({ screen02Workflow: workflowWidget(audit, 1) });
    const sync = vi.spyOn(ShockAuditBridge.prototype, "syncWorkspace")
      .mockResolvedValue(undefined);
    renderToStaticMarkup(<App />);
    const save = appHarness.screen01Props!.onSaveState as
      (state: Screen01State, ambiguities: Ambiguity[]) => Promise<void>;
    const canonical = appHarness.screen01Props!.state as Screen01State;
    expect(canonical).toMatchObject({ mode: "audit", confirmed: true });
    const staleDefault = createInitialState();
    await save(staleDefault, getAmbiguities(staleDefault));
    expect(sync).not.toHaveBeenCalled();

    await save(canonical, getAmbiguities(canonical));
    expect(sync).toHaveBeenCalledOnce();
    expect(sync.mock.calls[0]![0]).toMatchObject({
      state: canonical,
      studyContext: buildAuditIdentityState().screen01Baseline,
    });
    expect(sync.mock.calls[0]![1]).toContain("California Consumer Privacy Act");
    expect(sync.mock.calls[0]![1]).not.toContain('"Manufacturing"');
  });

  it("does not show the legacy assessment-unavailable warning for an active fixed-qualified Find result", async () => {
    const qualified = buildFixedQualifiedFindState(
      "app-fixed-qualified-find-run",
    );
    expect(qualified.candidates.some(
      (candidate) => candidate.qualification?.eligible === true,
    )).toBe(true);
    setWidgetState({
      screen02Workflow: workflowWidget(workflowSnapshot(qualified), 2),
    });

    let html = "";
    await vi.waitFor(() => {
      html = renderToStaticMarkup(<App />);
      expect(appHarness.findProps).not.toBeNull();
    });
    expect(html).toContain('data-app-route="workflow-find"');
    expect(html).not.toContain(
      "Preliminary assessment is unavailable in this view.",
    );
  });

  it("keeps a v0.2.20 Audit session read-only and exposes only its explicit v2.1 restart", () => {
    setWidgetState({ screen02: legacyAuditSessionFixture() });
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain("Saved Screen 2 — read-only");
    expect(html).toContain("Start updated Screen 2");
    expect(html).toContain('aria-label="Read-only saved Screen 2"');
    expect(html).toContain("saved candidate record");
    expect(appHarness.legacyProps).toBeNull();
  });

  it("locks a canonical mutation synchronously against double clicks", async () => {
    const find = workflowSnapshot(buildFindFactsState());
    setWidgetState({ screen02Workflow: workflowWidget(find, 2) });
    let resolveMutation!: (snapshot: Screen02WorkflowClientSnapshot) => void;
    const pending = new Promise<Screen02WorkflowClientSnapshot>((resolve) => {
      resolveMutation = resolve;
    });
    const mutate = vi
      .spyOn(ShockAuditBridge.prototype, "mutateScreen02Workflow")
      .mockReturnValue(pending);
    vi.spyOn(
      ShockAuditBridge.prototype,
      "screen02WorkflowOperationAttribution",
    ).mockImplementation(() => ({
      operationId: String(mutate.mock.calls.at(-1)?.[3]),
      kind: "mutation",
      outcome: "applied",
      attributable: true,
      binding: "exact-operation-seal-or-correlation",
    }));
    renderToStaticMarkup(<App />);
    const onSearch = appHarness.findProps?.onSearch as
      | ((criteria: unknown[]) => void)
      | undefined;
    expect(onSearch).toBeTypeOf("function");

    onSearch!([]);
    onSearch!([{ kind: "include", text: "privacy regulation" }]);
    expect(mutate).toHaveBeenCalledOnce();
    expect(mutate).toHaveBeenCalledWith(
      find,
      "find-search",
      { criteria: [] },
      expect.stringMatching(/^screen02-ui-/u),
    );

    resolveMutation(find);
    await pending;
    await Promise.resolve();
  });

  it("automatically continues a searching Find result with a fresh empty operation", async () => {
    const initial = buildFindFactsState();
    const searching = beginScreen02FindDiscovery(initial, {
      discoveryRequestId: "find-discovery-request-v2",
      searchRoundId: "find-round-2",
      candidateSetSnapshotId: "find-candidate-set-v2",
      exactRequest: "Continue the bounded official-source fixture search.",
      at: "2026-08-09T18:00:02.000Z",
    });
    const terminal = failScreen02FindDiscovery(searching, {
      discoveryRequestId: "find-discovery-request-v2",
      failureCodes: ["routes-exhausted"],
      at: "2026-08-09T18:00:03.000Z",
      note: "The bounded fixture route was exhausted.",
    });
    const initialSnapshot = workflowSnapshot(initial);
    const searchingSnapshot = workflowSnapshot(searching);
    const terminalSnapshot = workflowSnapshot(terminal);
    setWidgetState({
      screen02Workflow: workflowWidget(initialSnapshot, 2),
    });
    const mutate = vi
      .spyOn(ShockAuditBridge.prototype, "mutateScreen02Workflow")
      .mockResolvedValueOnce(searchingSnapshot)
      .mockResolvedValueOnce(terminalSnapshot);
    vi.spyOn(
      ShockAuditBridge.prototype,
      "screen02WorkflowOperationAttribution",
    ).mockImplementation(() => ({
      operationId: String(mutate.mock.calls.at(-1)?.[3]),
      kind: "mutation",
      outcome: "applied",
      attributable: true,
      binding: "exact-operation-seal-or-correlation",
    }));

    renderToStaticMarkup(<App />);
    const onSearch = appHarness.findProps?.onSearch as
      | ((criteria: unknown[]) => void)
      | undefined;
    expect(onSearch).toBeTypeOf("function");
    onSearch!([]);

    await vi.waitFor(() => expect(mutate).toHaveBeenCalledTimes(2));
    expect(mutate.mock.calls.map((call) => ({
      action: call[1],
      payload: call[2],
      operationId: call[3],
    }))).toEqual([
      {
        action: "find-search",
        payload: { criteria: [] },
        operationId: expect.stringMatching(/^screen02-ui-/u),
      },
      {
        action: "find-search-continue",
        payload: {},
        operationId: expect.stringMatching(/^screen02-ui-/u),
      },
    ]);
    expect(mutate.mock.calls[1]?.[3]).not.toBe(mutate.mock.calls[0]?.[3]);
  });

  it("does not commit a late attributed search result after reset detaches its workflow", async () => {
    const find = workflowSnapshot(buildFindFactsState());
    const late = find;
    setWidgetState({ screen02Workflow: workflowWidget(find, 2) });
    let resolveMutation!: (snapshot: Screen02WorkflowClientSnapshot) => void;
    const pendingMutation = new Promise<Screen02WorkflowClientSnapshot>(
      (resolve) => {
        resolveMutation = resolve;
      },
    );
    const mutate = vi
      .spyOn(ShockAuditBridge.prototype, "mutateScreen02Workflow")
      .mockReturnValue(pendingMutation);
    const attribution = vi.spyOn(
      ShockAuditBridge.prototype,
      "screen02WorkflowOperationAttribution",
    ).mockImplementation(() => ({
      operationId: String(mutate.mock.calls[0]?.[3]),
      kind: "mutation",
      outcome: "applied",
      attributable: true,
      binding: "exact-operation-seal-or-correlation",
    }));
    vi.spyOn(
      ShockAuditBridge.prototype,
      "openScreen02Workflow",
    ).mockReturnValue(new Promise(() => undefined));
    const save = vi.spyOn(
      ShockAuditBridge.prototype,
      "saveScreen02WorkflowWidgetSnapshot",
    );

    renderToStaticMarkup(<App />);
    const onSearch = appHarness.findProps?.onSearch as
      | ((criteria: unknown[]) => void)
      | undefined;
    const onReset = appHarness.findProps?.onReset as (() => void) | undefined;
    expect(onSearch).toBeTypeOf("function");
    expect(onReset).toBeTypeOf("function");

    onSearch!([]);
    expect(mutate).toHaveBeenCalledOnce();
    onReset!();
    resolveMutation(late);
    await pendingMutation;
    await vi.waitFor(() => expect(attribution).toHaveBeenCalledOnce());
    expect(save).not.toHaveBeenCalled();
  });

  it("keeps a replacement mutation locked when a retired host-task refresh settles", async () => {
    const findState = buildFindFactsState();
    const find = workflowSnapshot(findState);
    const activeSet = findState.candidateSets.find(
      (candidateSet) =>
        candidateSet.candidateSetSnapshotId ===
          findState.activeCandidateSetSnapshotId,
    );
    if (!activeSet) throw new Error("Expected an active candidate set.");
    const taskId = "host-task:retired-refresh";
    const createdAt = "2026-09-03T12:00:00.000Z";
    const expiresAt = "2026-09-03T12:05:00.000Z";
    setWidgetState({
      screen02Workflow: workflowWidget(find, 2),
      hostReasoningTasks: {
        schemaVersion: "shockaudit-private-host-task-registry-v1",
        tasks: [{
          schemaVersion: "shockaudit-private-host-task-coordinates-v1",
          taskId,
          taskType: "screen02-search-review",
          screen: "screen-02",
          runId: find.runId,
          candidatePoolId: activeSet.candidateSetSnapshotId,
          selectedEventId: null,
          claimGroupId: null,
          expectedParentRevision: find.revision,
          expectedScopeFingerprint: findState.screen01Fingerprint,
          expectedCandidatePoolFingerprint:
            activeSet.candidateSetFingerprint,
          expectedEventFingerprint: null,
          createdAt,
          expiresAt,
          status: "applied",
          retryCount: 0,
          resultId: "host-result:retired-refresh",
        }],
      },
    });
    vi.spyOn(
      ShockAuditBridge.prototype,
      "getHostReasoningTaskStatus",
    ).mockResolvedValue({
      schemaVersion: "shockaudit-host-task-status-result-v1",
      outcome: "found",
      task: {
        taskId,
        taskType: "screen02-search-review",
        screen: "screen-02",
        runId: find.runId,
        candidatePoolId: activeSet.candidateSetSnapshotId,
        selectedEventId: null,
        claimGroupId: null,
        status: "applied",
        messageChannel: "ui/message",
        messageDeliveryStatus: "accepted",
        createdAt,
        expiresAt,
        retryCount: 0,
        resultId: "host-result:retired-refresh",
        failureCode: null,
        failureExplanation: null,
        panelReconciliation: {
          status: "pending",
          lastCheckedAt: createdAt,
          reconciledAt: null,
          failureCode: null,
          failureExplanation: null,
        },
        result: {
          schemaVersion: "shockaudit-screen02-host-review-result-v1",
          origin: "chatgpt-host",
          nonCanonical: true,
          review: {
            schemaVersion: "screen-02-pool-host-review-v1",
            taskId,
            capability: "screen-02-pool-review",
            profileAdditions: {},
            candidateReviews: [],
            followUpQueries: [],
            officialSourceLeads: [],
            conciseRationale:
              "No additional candidate suggestion was required for this lease-race fixture.",
            hostModel: "fixture-host-model",
          },
          enrichedProfile: findState.relevanceProfile,
          rankings: [],
          outcomeValuesInspected: false,
        },
        outcomeValuesInspected: false,
      },
    });
    let resolveOldRefresh!: (snapshot: Screen02WorkflowClientSnapshot) => void;
    let resolveReplacement!: (
      snapshot: Screen02WorkflowClientSnapshot,
    ) => void;
    const oldRefresh = new Promise<Screen02WorkflowClientSnapshot>((resolve) => {
      resolveOldRefresh = resolve;
    });
    const replacement = new Promise<Screen02WorkflowClientSnapshot>(
      (resolve) => {
        resolveReplacement = resolve;
      },
    );
    const mutate = vi
      .spyOn(ShockAuditBridge.prototype, "mutateScreen02Workflow")
      .mockImplementation((_snapshot, action) =>
        action === "refresh" ? oldRefresh : replacement
      );
    vi.spyOn(
      ShockAuditBridge.prototype,
      "screen02WorkflowOperationAttribution",
    ).mockImplementation(() => ({
      operationId: String(mutate.mock.calls.at(-1)?.[3]),
      kind: "mutation",
      outcome: "applied",
      attributable: true,
      binding: "exact-operation-seal-or-correlation",
    }));
    vi.spyOn(
      ShockAuditBridge.prototype,
      "retireScreen02Workflow",
    ).mockResolvedValue({ outcome: "retired" } as never);
    const save = vi.spyOn(
      ShockAuditBridge.prototype,
      "saveScreen02WorkflowWidgetSnapshot",
    );

    renderToStaticMarkup(<App />);
    const onCheckHostTask = appHarness.findProps?.onCheckHostTask as
      | (() => void)
      | undefined;
    const onReset = appHarness.findProps?.onReset as (() => void) | undefined;
    const onSearch = appHarness.findProps?.onSearch as
      | ((criteria: unknown[]) => void)
      | undefined;
    expect(onCheckHostTask).toBeTypeOf("function");
    expect(onReset).toBeTypeOf("function");
    expect(onSearch).toBeTypeOf("function");

    onCheckHostTask!();
    await vi.waitFor(() => expect(mutate).toHaveBeenCalledOnce());
    expect(mutate.mock.calls[0]?.[1]).toBe("refresh");
    onReset!();
    await vi.waitFor(() =>
      expect(ShockAuditBridge.prototype.retireScreen02Workflow)
        .toHaveBeenCalledOnce()
    );
    onSearch!([]);
    await vi.waitFor(() => expect(mutate).toHaveBeenCalledTimes(2));
    expect(mutate.mock.calls[1]?.[1]).toBe("find-search");

    resolveOldRefresh(find);
    await oldRefresh;
    await Promise.resolve();
    onSearch!([{ kind: "include", text: "must remain locked" }]);
    expect(mutate).toHaveBeenCalledTimes(2);
    expect(save).not.toHaveBeenCalled();

    resolveReplacement(find);
    await replacement;
    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
  });

  it("does not optimistically persist a second Audit match while the first open is pending", async () => {
    const auditState = buildAuditIdentityState();
    const audit = workflowSnapshot(auditState);
    setWidgetState({ screen02Workflow: workflowWidget(audit, 2) });
    let resolveMutation!: (snapshot: Screen02WorkflowClientSnapshot) => void;
    const pending = new Promise<Screen02WorkflowClientSnapshot>((resolve) => {
      resolveMutation = resolve;
    });
    const mutate = vi
      .spyOn(ShockAuditBridge.prototype, "mutateScreen02Workflow")
      .mockReturnValue(pending);
    vi.spyOn(
      ShockAuditBridge.prototype,
      "screen02WorkflowOperationAttribution",
    ).mockImplementation(() => ({
      operationId: String(mutate.mock.calls.at(-1)?.[3]),
      kind: "mutation",
      outcome: "applied",
      attributable: true,
      binding: "exact-operation-seal-or-correlation",
    }));
    const save = vi.spyOn(
      ShockAuditBridge.prototype,
      "saveScreen02WorkflowWidgetSnapshot",
    );
    renderToStaticMarkup(<App />);
    const onOpenMatch = appHarness.auditProps?.onOpenMatch as
      | ((matchSnapshotId: string) => void)
      | undefined;
    expect(onOpenMatch).toBeTypeOf("function");

    onOpenMatch!("ccpa-match-snapshot-v1");
    onOpenMatch!("ignored-second-match");
    expect(mutate).toHaveBeenCalledOnce();
    expect(save).not.toHaveBeenCalled();

    resolveMutation(audit);
    await pending;
    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0]?.[0]).toMatchObject({
      activeScreen: 2,
      openedMatchSnapshotId: "ccpa-match-snapshot-v1",
    });
  });

  it("keeps reset confirmation inside the embedded app instead of using a native modal", () => {
    const find = workflowSnapshot(buildFindFactsState());
    setWidgetState({ screen02Workflow: workflowWidget(find, 2) });
    renderToStaticMarkup(<App />);

    const onReset = appHarness.findProps?.onReset as (() => void) | undefined;
    expect(onReset).toBeTypeOf("function");
    const resetSource = compactAppSource.slice(
      compactAppSource.indexOf("async function resetScreen02Workflow()"),
      compactAppSource.indexOf("function editStudyFromWorkflow()"),
    );
    expect(resetSource).not.toContain("window.confirm");
    expect(resetSource).toContain(
      "workflowResetRequestedRunRef.current = requestedRunId",
    );
    expect(resetSource).toContain(
      "workflowLifecycleGenerationRef.current += 1",
    );
    expect(resetSource).toContain(
      'cancelActiveFindSearch("reset", "reset-requested")',
    );
  });

  it("opens a valid replacement before retiring the prior canonical run", () => {
    const resetSource = compactAppSource.slice(
      compactAppSource.indexOf("async function resetScreen02Workflow()"),
      compactAppSource.indexOf("function editStudyFromWorkflow()"),
    );
    expect(resetSource).toContain(
      'initialState: "blank"',
    );
    expect(
      resetSource.indexOf(
        "replaced = await openNextScreen(baseline",
      ),
    ).toBeLessThan(
      resetSource.indexOf("await bridge.retireScreen02Workflow"),
    );
    expect(resetSource).not.toContain(
      "while (workflowMutationActiveRef.current)",
    );
    expect(resetSource).toContain(
      "The existing Screen 2 run is unchanged; retry Reset Screen 2.",
    );
    expect(resetSource).toContain("scheduleWorkflowTimeouts(retained)");
    expect(resetSource).toContain("scheduleWorkflowPolling(retained)");
    const mutationSource = compactAppSource.slice(
      compactAppSource.indexOf("async function mutateWorkflow("),
      compactAppSource.indexOf("function clearStage1ProofTimeout()"),
    );
    expect(mutationSource).toContain(
      "workflowLifecycleGenerationRef.current !== lifecycleGeneration",
    );
    expect(mutationSource).toContain(
      "workflowResetRequestedRunRef.current === current.runId",
    );
    const assessmentSource = compactAppSource.slice(
      compactAppSource.indexOf("async function requestWorkflowAssessment("),
      compactAppSource.indexOf("async function mutateWorkflow("),
    );
    expect(assessmentSource).toContain(
      "workflowLifecycleGenerationRef.current !== lifecycleGeneration",
    );
    expect(assessmentSource).toContain(
      "workflowLifecycleGenerationRef.current === lifecycleGeneration",
    );
    expect(assessmentSource).toContain(
      "bridge.recordScreen02AssessmentDelivery(",
    );
    const invalidationSource = compactAppSource.slice(
      compactAppSource.indexOf("function invalidateScreen02()"),
      compactAppSource.indexOf("function releaseExpiredScreen02AiReview"),
    );
    expect(invalidationSource).toContain(
      "const retiredWorkflow = screen02WorkflowRef.current",
    );
    expect(invalidationSource).toContain(
      "bridge.retireScreen02Workflow(retiredWorkflow)",
    );
  });

  it("keeps callback/action payloads aligned with the canonical controller contract", () => {
    expect(compactAppSource.match(/busy=\{workflowBusy\}/g)).toHaveLength(1);
    expect(compactAppSource).toContain(
      'busy={workflowBusy || findSearchState.phase === "searching"}',
    );
    for (const expected of [
      "runDeterministicFind(criteria)",
      'mutateWorkflow( "find-search-continue", {}, { requestAssessment: false, silent: true }, continuationOperationId, )',
      'mutateWorkflow("find-open", { candidateSnapshotId })',
      'mutateWorkflow("find-remove", { candidateSnapshotId, reason, })',
      'mutateWorkflow("find-retry", { candidateSnapshotId })',
      'mutateWorkflow("find-override", { findingId, reason })',
      'mutateWorkflow("find-select", { candidateSnapshotId })',
      'mutateWorkflow("find-clear-selection", {})',
      'mutateWorkflow("find-continue", {})',
      'mutateWorkflow("find-continue-without-assessment", { reason, acknowledgment, })',
      'mutateWorkflow("audit-revise-anchor", { fields, reason }',
      'mutateWorkflow( "audit-open", { matchSnapshotId }',
      'mutateWorkflow("audit-confirm", { matchSnapshotId, reason, })',
      'mutateWorkflow("audit-related", { matchSnapshotId, reason, })',
      'mutateWorkflow("audit-reject", { matchSnapshotId, reason, })',
      'mutateWorkflow("audit-no-match", { reason }',
      'mutateWorkflow("audit-retry-dossier", { matchSnapshotId })',
      'mutateWorkflow("audit-retry-assessment", { confirmationSnapshotId, })',
      'mutateWorkflow("audit-continue", {})',
      'mutateWorkflow("audit-continue-without-assessment", { reason, acknowledgment, })',
      'mutateWorkflow("audit-reconsider", { reason })',
    ]) {
      expect(compactAppSource).toContain(expected);
    }
  });

  it("keeps background assessment delivery and polling from flickering the workspace controls", () => {
    const assessmentSource = compactAppSource.slice(
      compactAppSource.indexOf("async function requestWorkflowAssessment("),
      compactAppSource.indexOf("async function mutateWorkflow("),
    );
    expect(assessmentSource).not.toContain("setWorkflowBusy(");

    const mutationSource = compactAppSource.slice(
      compactAppSource.indexOf("async function mutateWorkflow("),
      compactAppSource.indexOf("function clearStage1ProofTimeout()"),
    );
    expect(mutationSource).toContain(
      'const backgroundMutation = action === "refresh" || action === "assessment-timeout" || Boolean(options?.restoration)',
    );
    expect(mutationSource).toContain(
      'const mutationOwner = claimWorkflowMutation( backgroundMutation ? "background" : "foreground", )',
    );
    expect(mutationSource).toContain(
      "const released = releaseWorkflowMutation(mutationOwner); if (released && !backgroundMutation) setWorkflowBusy(false)",
    );
  });

  it("queues one foreground action behind hidden assessment work and drains it first", () => {
    const assessmentSource = compactAppSource.slice(
      compactAppSource.indexOf("async function requestWorkflowAssessment("),
      compactAppSource.indexOf("async function mutateWorkflow("),
    );
    const mutationSource = compactAppSource.slice(
      compactAppSource.indexOf("async function mutateWorkflow("),
      compactAppSource.indexOf("function clearStage1ProofTimeout()"),
    );
    expect(assessmentSource).toContain(
      'claimWorkflowMutation("background")',
    );
    expect(mutationSource).toContain(
      '!backgroundMutation && workflowMutationKindRef.current === "background" && !pendingWorkflowForegroundMutationRef.current',
    );
    expect(mutationSource).toContain(
      "pendingWorkflowForegroundMutationRef.current = { runId: current.runId, lifecycleGeneration: workflowLifecycleGenerationRef.current, operationId, action, payload: { ...payload }",
    );
    expect(mutationSource).toContain(
      "Finishing the current assessment update, then saving your action…",
    );
    expect(
      assessmentSource.indexOf(
        "if (drainPendingWorkflowForegroundMutation())",
      ),
    ).toBeLessThan(
      assessmentSource.indexOf(
        "void requestWorkflowAssessment(followUpAssessment)",
      ),
    );
    expect(
      mutationSource.indexOf(
        "if (drainPendingWorkflowForegroundMutation())",
      ),
    ).toBeLessThan(
      mutationSource.indexOf("void requestWorkflowAssessment(next)"),
    );

    const findSource = compactAppSource.slice(
      compactAppSource.indexOf("async function runDeterministicFind("),
      compactAppSource.indexOf("function clearStage1ProofTimeout()"),
    );
    const queuedCompletion =
      'const mutation = requested.outcome === "queued" ? await requested.completion : requested';
    const delivery =
      "completed = await bridge.recordScreen02AssessmentDelivery( completed, batch.requestIds, false, deliveryOperationId, )";
    const exactDeliveryAttribution =
      'screen02MutationAttributionAllowsCommit( completionAttribution, deliveryOperationId, "assessment-delivery", )';
    expect(findSource).toContain(queuedCompletion);
    expect(findSource).toContain(delivery);
    expect(findSource).toContain(exactDeliveryAttribution);
    expect(findSource.indexOf(queuedCompletion)).toBeLessThan(
      findSource.indexOf(delivery),
    );
    expect(findSource.indexOf(delivery)).toBeLessThan(
      findSource.indexOf(exactDeliveryAttribution),
    );
    expect(findSource.indexOf(exactDeliveryAttribution)).toBeLessThan(
      findSource.indexOf("const continued = await continueFindSearchChunks"),
    );
    expect(findSource).toContain(
      'phase: stale ? "cancelled" : "delivery-failure"',
    );
  });

  it("drives one bounded server-owned Find search through continuation calls", () => {
    const continuationSource = compactAppSource.slice(
      compactAppSource.indexOf("async function continueFindSearchChunks("),
      compactAppSource.indexOf("async function resumeSearchingFind("),
    );
    expect(compactAppSource).toContain(
      "export const SCREEN_02_FIND_MAX_RETRIEVAL_TOOL_CALLS = 16",
    );
    expect(continuationSource).toContain(
      "while (screen02FindDiscoveryIsSearching(state))",
    );
    expect(continuationSource).toContain(
      "completedToolCallCount >= SCREEN_02_FIND_MAX_RETRIEVAL_TOOL_CALLS",
    );
    expect(continuationSource).toContain(
      "const continuationOperationId = nextScreen02WorkflowOperationId()",
    );
    expect(continuationSource).toContain(
      'mutateWorkflow( "find-search-continue", {}, { requestAssessment: false, silent: true }, continuationOperationId, )',
    );
    expect(continuationSource).not.toMatch(/cursor/iu);
    expect(continuationSource).toContain(
      "findSearchDriverMayContinue( input.startingSnapshot, input.lifecycleGeneration, input.logicalOperationId, input.driverOwner, )",
    );
    expect(compactAppSource).toContain(
      "workflowLifecycleGenerationRef.current += 1; detachFindSearchDriver()",
    );
    expect(compactAppSource).toContain(
      "reconcileRestoredFindSearch(completion.snapshot)",
    );
  });

  it("preserves navigation on refresh and derives inline copy from canonical or legacy mode", () => {
    const receiptHandler = compactAppSource.slice(
      compactAppSource.indexOf("onScreen02WorkflowReceipt:"),
      compactAppSource.indexOf("onScreen02Session:"),
    );
    expect(receiptHandler).toContain("pendingWorkflowRefreshRunRef.current");
    expect(receiptHandler).toContain('mutateWorkflow("refresh", {}');
    expect(receiptHandler).not.toContain("activeScreenRef.current !== 2");
    expect(compactAppSource).toContain(
      "activeWorkflowState?.mode ?? screen02Session?.mode ?? null",
    );
    expect(compactAppSource).toContain(
      "options?.requestAssessment !== false && activeScreenRef.current === 2 && workflowResetRequestedRunRef.current !== next.runId && next.assessmentBatch",
    );
    expect(compactAppSource).toContain(
      "workflowLifecycleGenerationRef.current !== lifecycleGeneration",
    );
    expect(compactAppSource).toContain(
      "void bridge.clearScreen02WorkflowWidgetSnapshot()",
    );
    expect(compactAppSource).toContain(
      "activeCanonicalWorkflow.screen01Baseline, studyContext",
    );
    expect(compactAppSource).toContain(
      "usableRestoredWorkflow?.activeScreen === 2 && restoredWorkflowState",
    );
    expect(compactAppSource).toContain(
      "!batch || activeScreenRef.current !== 2 || workflowMutationActiveRef.current",
    );
    expect(compactAppSource).toContain(
      "!hadCurrentWorkflow && activeScreenRef.current === 2 && snapshot.assessmentBatch",
    );
    expect(compactAppSource).toContain(
      "const latest = screen02WorkflowRef.current; if (latest && activeScreenRef.current === 2) {",
    );
    expect(compactAppSource).toContain(
      "scheduleWorkflowPolling(latest); } if (released && !drainPendingWorkflowForegroundMutation()) { drainPendingWorkflowRefresh(); }",
    );
    expect(compactAppSource).toContain(
      "if (!view.connected && !view.canRequestAiReview) { clearWorkflowTimeouts(); clearWorkflowPolling(); return; } const current = screen02WorkflowRef.current; if (current && activeScreenRef.current === 2) { scheduleWorkflowTimeouts(current); scheduleWorkflowPolling(current); }",
    );
    expect(compactAppSource).toContain(
      "const restorationRefreshPending = workflowRestorationRefreshRef.current !== snapshot.runId",
    );
    expect(compactAppSource).toContain(
      "options?.restoration && workflowRestorationRefreshRef.current === current.runId",
    );
    expect(compactAppSource).toContain(
      "workflowRestorationRefreshRef.current = null; } const latest",
    );
    expect(compactAppSource).toContain(
      'action === "assessment-timeout" ? screen02WorkflowRefreshRetryMs : 1',
    );
    expect(compactAppSource).toContain(
      "screen02AssessmentPreparedAtMs(request) + SCREEN_02_HOST_ASSESSMENT_DEADLINE_MS - Date.now()",
    );
    expect(compactAppSource).toContain(
      "const requestStillPending = currentSnapshot?.runId === snapshot.runId && workflowState(currentSnapshot)?.assessmentRequests.some(",
    );
    expect(compactAppSource).toContain(
      "const retry = window.setTimeout( expire, screen02WorkflowRefreshRetryMs, ); workflowTimeoutsRef.current.set(request.requestId, retry); return;",
    );
    expect(compactAppSource).toContain(
      "const outcome = await Promise.race([ settledDelivery, new Promise<{ kind: \"deadline\" }>",
    );
    expect(compactAppSource).toContain(
      'const timedOut = await bridge.mutateScreen02Workflow( next, "assessment-timeout", { requestId }, timeoutOperationId, )',
    );
    expect(compactAppSource).toContain(
      "(!hostViewRef.current.connected && !hostViewRef.current.canRequestAiReview) || activeScreenRef.current !== 2",
    );
  });

  it("keeps Screen 2 progress and delivery notices provider-neutral", () => {
    const oldVisibleCopy = [
      "ChatGPT relevance review",
      "Optional ChatGPT relevance review",
      "The review is running in ChatGPT",
      "Host reasoning is experimental-off",
      "ChatGPT is planning bounded search phrases",
      "ChatGPT did not settle before the bounded deadline",
      "ChatGPT is preparing bounded search vocabulary",
      "ChatGPT is reviewing the source results",
      "asking ChatGPT to improve relevance",
      "ChatGPT is preparing bounded source-search vocabulary",
      "ChatGPT is planning the source search",
    ];
    for (const phrase of oldVisibleCopy) {
      expect(appSource).not.toContain(phrase);
    }
    expect(appSource).toContain("Optional wider search");
    expect(appSource).toContain("Preparing bounded search phrases");
    expect(appSource).toContain(
      "setWorkflowNotice(screen02FindTerminalNotice(state))",
    );
    expect(appSource).toContain("Planning the source search");
  });

  it("derives the Find terminal notice from the committed result", () => {
    expect(screen02FindTerminalNotice(buildFindFactsState())).toMatchObject({
      status: "success",
      message: expect.stringContaining("candidates are ready"),
    });
    expect(appSource).not.toContain(
      'setWorkflowNotice({\n        status: "success",\n        message:\n          "Source-backed candidates are ready.',
    );
  });
});
