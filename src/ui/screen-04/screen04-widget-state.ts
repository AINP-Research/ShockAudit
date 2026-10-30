import {
  restoreScreen04WorkflowState,
  type Screen04WorkflowState,
} from "../../core/screen04-workflow";
import {
  screen04EventCardBindingIsCurrent,
  type Screen04EventCardBinding,
} from "../../core/screen04-event-card-binding";
import type { HostReasoningRunAuditBundle } from
  "../../core/host-reasoning-audit";

export const SCREEN_04_WIDGET_SCHEMA_VERSION =
  "screen-04-workflow-widget-v2" as const;
export const SCREEN_04_LEGACY_WIDGET_SCHEMA_VERSION =
  "screen-04-workflow-widget-v1" as const;

export type Screen04WorkflowWidgetSnapshot = {
  schemaVersion: typeof SCREEN_04_WIDGET_SCHEMA_VERSION;
  state: Screen04WorkflowState;
  activeScreen: 3 | 4;
  hostReasoningTaskAudit?: HostReasoningRunAuditBundle;
  hostReasoningTaskAuditBindingFingerprint?: string;
};

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

function restoreHostReasoningAuditEnvelope(
  value: unknown,
): HostReasoningRunAuditBundle | null {
  if (!record(value) || !exactKeys(value, [
    "schemaVersion", "type", "runId", "includedTaskCount", "truncated",
    "tasks", "outcomeValuesInspected",
  ]) || value.schemaVersion !==
      "shockaudit-host-reasoning-run-audit-bundle-v1" ||
    value.type !== "host-reasoning-run-audit-bundle" ||
    typeof value.runId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u.test(value.runId) ||
    typeof value.includedTaskCount !== "number" ||
    !Number.isInteger(value.includedTaskCount) ||
    value.includedTaskCount < 0 || value.includedTaskCount > 32 ||
    typeof value.truncated !== "boolean" || !Array.isArray(value.tasks) ||
    value.tasks.length !== value.includedTaskCount ||
    value.outcomeValuesInspected !== false) return null;
  for (const taskValue of value.tasks) {
    if (!record(taskValue) || taskValue.schemaVersion !==
        "shockaudit-host-reasoning-task-audit-bundle-v1" ||
      taskValue.type !== "host-reasoning-task-audit-bundle" ||
      taskValue.outcomeValuesInspected !== false ||
      !record(taskValue.task) || !record(taskValue.task.coordinates) ||
      taskValue.task.coordinates.runId !== value.runId) return null;
  }
  try {
    const serialized = JSON.stringify(value);
    if (new TextEncoder().encode(serialized).byteLength > 96 * 1024) {
      return null;
    }
    // This is only a bounded transport envelope. App performs the full parser
    // through the Screen 4-time lazy boundary before it can be persisted again.
    return structuredClone(value) as HostReasoningRunAuditBundle;
  } catch {
    return null;
  }
}

/**
 * Restore only the versioned private sibling. The core parser rejects raw CSV,
 * export bodies, unselected headers, and malformed parent coordinates.
 */
export function restoreScreen04WorkflowWidgetSnapshot(
  value: unknown,
): Screen04WorkflowWidgetSnapshot | null {
  const carriesHostAudit = record(value) &&
    "hostReasoningTaskAudit" in value;
  const carriesHostAuditBinding = record(value) &&
    "hostReasoningTaskAuditBindingFingerprint" in value;
  if (
    !record(value) ||
    (!exactKeys(value, ["schemaVersion", "state", "activeScreen"]) &&
      !exactKeys(value, [
        "schemaVersion", "state", "activeScreen", "hostReasoningTaskAudit",
        "hostReasoningTaskAuditBindingFingerprint",
      ])) ||
    (value.schemaVersion !== SCREEN_04_WIDGET_SCHEMA_VERSION &&
      value.schemaVersion !== SCREEN_04_LEGACY_WIDGET_SCHEMA_VERSION) ||
    (value.activeScreen !== 3 && value.activeScreen !== 4) ||
    carriesHostAudit !== carriesHostAuditBinding ||
    carriesHostAudit && value.schemaVersion !== SCREEN_04_WIDGET_SCHEMA_VERSION
  ) {
    return null;
  }
  const state = restoreScreen04WorkflowState(value.state);
  if (!state) return null;
  let hostReasoningTaskAudit: HostReasoningRunAuditBundle | undefined;
  let hostReasoningTaskAuditBindingFingerprint: string | undefined;
  if ("hostReasoningTaskAudit" in value) {
    const restored = restoreHostReasoningAuditEnvelope(
      value.hostReasoningTaskAudit,
    );
    const bindingFingerprint = value.hostReasoningTaskAuditBindingFingerprint;
    if (!restored ||
      restored.runId !== state.eventCardBinding.screen02.runId ||
      typeof bindingFingerprint !== "string" ||
      !/^(?:fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})$/u.test(
        bindingFingerprint,
      ) ||
      bindingFingerprint !== state.eventCardBinding.bindingFingerprint) {
      return null;
    }
    hostReasoningTaskAudit = restored;
    hostReasoningTaskAuditBindingFingerprint = bindingFingerprint;
  }
  return {
    schemaVersion: SCREEN_04_WIDGET_SCHEMA_VERSION,
    state,
    activeScreen: value.activeScreen,
    ...(hostReasoningTaskAudit === undefined
      ? {}
      : {
          hostReasoningTaskAudit,
          hostReasoningTaskAuditBindingFingerprint,
        }),
  };
}

export function screen04WidgetMatchesEventCard(
  widget: Screen04WorkflowWidgetSnapshot,
  currentBinding: Screen04EventCardBinding,
) {
  return screen04EventCardBindingIsCurrent(
    widget.state.eventCardBinding,
    currentBinding,
  );
}
