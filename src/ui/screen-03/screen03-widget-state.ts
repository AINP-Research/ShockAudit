import type { Screen02WorkflowClientSnapshot } from "../../core/screen02-workflow-client";
import {
  restoreScreen03VerificationState,
  type Screen03VerificationState,
} from "../../core/screen03-workflow";

export const SCREEN_03_WIDGET_SCHEMA_VERSION =
  "screen-03-workflow-widget-v1" as const;
export const SCREEN_03_WORKFLOW_META_KEY =
  "shockaudit/screen03Workflow" as const;
export const SCREEN_03_HOST_BRIEFING_BOOTSTRAP_META_KEY =
  "shockaudit/screen03Bootstrap" as const;
export const SCREEN_03_HOST_BRIEFING_BOOTSTRAP_SCHEMA_VERSION =
  "screen-03-host-briefing-bootstrap-v1" as const;

export type Screen03WorkflowWidgetSnapshot = {
  schemaVersion: typeof SCREEN_03_WIDGET_SCHEMA_VERSION;
  state: Screen03VerificationState;
  activeScreen: 2 | 3;
};

export type Screen03HostBriefingBootstrap = {
  schemaVersion: typeof SCREEN_03_HOST_BRIEFING_BOOTSTRAP_SCHEMA_VERSION;
  widget: Screen03WorkflowWidgetSnapshot;
  continuationToken: string;
  continuationExpiresAt: string;
  responseKeyId: string;
  responseKey: string;
};

type Screen03ToolResultEnvelope = {
  isError?: unknown;
  structuredContent?: unknown;
  _meta?: unknown;
  mcp_tool_result?: unknown;
  call_tool_result?: unknown;
  mcpToolResult?: unknown;
  callToolResult?: unknown;
  screen03Workflow?: unknown;
  privateContent?: unknown;
  widgetState?: unknown;
};

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exact(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function boundedToken(value: unknown, maximum: number) {
  return typeof value === "string" && value.length >= 8 &&
    value.length <= maximum && value.trim() === value &&
    !/[\u0000-\u001f\u007f]/u.test(value);
}

function canonicalInstant(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

export function restoreScreen03WorkflowWidgetSnapshot(
  value: unknown,
): Screen03WorkflowWidgetSnapshot | null {
  if (
    !record(value) ||
    !exact(value, ["schemaVersion", "state", "activeScreen"]) ||
    value.schemaVersion !== SCREEN_03_WIDGET_SCHEMA_VERSION ||
    (value.activeScreen !== 2 && value.activeScreen !== 3)
  ) {
    return null;
  }
  const state = restoreScreen03VerificationState(value.state);
  return state
    ? {
        schemaVersion: SCREEN_03_WIDGET_SCHEMA_VERSION,
        state,
        activeScreen: value.activeScreen,
      }
    : null;
}

export function restoreScreen03HostBriefingBootstrap(
  value: unknown,
): Screen03HostBriefingBootstrap | null {
  if (
    !record(value) ||
    !exact(value, [
      "schemaVersion",
      "widget",
      "continuationToken",
      "continuationExpiresAt",
      "responseKeyId",
      "responseKey",
    ]) ||
    value.schemaVersion !== SCREEN_03_HOST_BRIEFING_BOOTSTRAP_SCHEMA_VERSION ||
    !boundedToken(value.continuationToken, 4_096) ||
    !boundedToken(value.responseKeyId, 256) ||
    !boundedToken(value.responseKey, 4_096) ||
    !canonicalInstant(value.continuationExpiresAt)
  ) {
    return null;
  }
  const widget = restoreScreen03WorkflowWidgetSnapshot(value.widget);
  if (!widget || widget.activeScreen !== 3) return null;
  return {
    schemaVersion: SCREEN_03_HOST_BRIEFING_BOOTSTRAP_SCHEMA_VERSION,
    widget,
    continuationToken: value.continuationToken as string,
    continuationExpiresAt: value.continuationExpiresAt as string,
    responseKeyId: value.responseKeyId as string,
    responseKey: value.responseKey as string,
  };
}

export function collectScreen03HostBriefingBootstraps(value: unknown) {
  const bootstraps: Screen03HostBriefingBootstrap[] = [];
  const seen = new Set<object>();
  const visit = (candidate: unknown, depth: number) => {
    if (depth > 3 || !record(candidate) || seen.has(candidate)) return;
    seen.add(candidate);
    const restored = restoreScreen03HostBriefingBootstrap(candidate);
    if (restored) bootstraps.push(restored);
    const envelope = candidate as Screen03ToolResultEnvelope;
    if (envelope.isError === true) return;
    for (const nested of [
      candidate[SCREEN_03_HOST_BRIEFING_BOOTSTRAP_META_KEY],
      envelope.structuredContent,
      envelope._meta,
      envelope.mcp_tool_result,
      envelope.call_tool_result,
      envelope.mcpToolResult,
      envelope.callToolResult,
    ]) {
      visit(nested, depth + 1);
    }
  };
  visit(value, 0);
  return bootstraps.filter(
    (bootstrap, index) =>
      bootstraps.findIndex((candidate) =>
        candidate.widget.state.runId === bootstrap.widget.state.runId &&
        candidate.widget.state.revision === bootstrap.widget.state.revision &&
        candidate.widget.state.integrity.stateFingerprint ===
          bootstrap.widget.state.integrity.stateFingerprint &&
        candidate.continuationToken === bootstrap.continuationToken
      ) === index,
  );
}

/**
 * Restore only the documented tool-result/widget wrappers used by ChatGPT.
 * The host briefing render tool mounts a new resource, so its latest Screen 3
 * sibling may arrive in tool-response metadata before private widget state has
 * been written by that new iframe.
 */
export function collectScreen03WorkflowWidgetSnapshots(value: unknown) {
  const snapshots: Screen03WorkflowWidgetSnapshot[] = [];
  const seen = new Set<object>();
  const visit = (candidate: unknown, depth: number) => {
    if (
      depth > 3 ||
      !record(candidate) ||
      seen.has(candidate)
    ) {
      return;
    }
    seen.add(candidate);
    const restored = restoreScreen03WorkflowWidgetSnapshot(candidate);
    if (restored) snapshots.push(restored);
    const bootstrap = restoreScreen03HostBriefingBootstrap(candidate);
    if (bootstrap) snapshots.push(bootstrap.widget);

    const envelope = candidate as Screen03ToolResultEnvelope;
    if (envelope.isError === true) return;
    for (const nested of [
      envelope.screen03Workflow,
      candidate[SCREEN_03_WORKFLOW_META_KEY],
      candidate[SCREEN_03_HOST_BRIEFING_BOOTSTRAP_META_KEY],
      envelope.structuredContent,
      envelope._meta,
      envelope.privateContent,
      envelope.widgetState,
      envelope.mcp_tool_result,
      envelope.call_tool_result,
      envelope.mcpToolResult,
      envelope.callToolResult,
    ]) {
      visit(nested, depth + 1);
    }
  };
  visit(value, 0);
  return snapshots.filter(
    (snapshot, index) =>
      snapshots.findIndex((candidate) =>
        candidate.state.runId === snapshot.state.runId &&
        candidate.state.revision === snapshot.state.revision &&
        candidate.state.integrity.stateFingerprint ===
          snapshot.state.integrity.stateFingerprint &&
        candidate.activeScreen === snapshot.activeScreen
      ) === index,
  );
}

export function screen03WidgetMatchesScreen02(
  widget: Screen03WorkflowWidgetSnapshot,
  screen02: Screen02WorkflowClientSnapshot,
) {
  const handoff = screen02.handoff;
  return Boolean(
    handoff &&
      widget.state.runId === screen02.runId &&
      widget.state.upstream.runId === screen02.runId &&
      widget.state.upstream.handoffFingerprint ===
        handoff.integrity.handoffFingerprint,
  );
}
