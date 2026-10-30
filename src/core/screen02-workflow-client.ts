import type { Screen02WorkflowHandoff } from "./screen02-workflow-handoff";
import { restoreScreen02WorkflowHandoff } from "./screen02-workflow-handoff";
import {
  decodeScreen02AuditWorkflowStateEnvelope,
  type Screen02AuditWorkflowStateEnvelope,
} from "./screen02-audit-workflow-envelope";
import {
  decodeScreen02FindWorkflowStateEnvelope,
  type Screen02FindWorkflowStateEnvelope,
} from "./screen02-workflow-envelope";
import {
  fingerprintScreen02WorkflowState,
  requireScreen02WorkflowState,
} from "./screen02-workflow-state";
import type {
  Screen02WorkflowState,
} from "./screen02-workflow-types";

export const SCREEN_02_WORKFLOW_CLIENT_SCHEMA_VERSION =
  "screen-02-workflow-client-v1" as const;
export const SCREEN_02_WORKFLOW_ASSESSMENT_BATCH_SCHEMA_VERSION =
  "screen-02-workflow-assessment-batch-v1" as const;
export const SCREEN_02_WORKFLOW_ASSESSMENT_BATCH_MAX_REQUESTS = 2;
export const SCREEN_02_WORKFLOW_SUMMARY_SCHEMA_VERSION =
  "screen-02-workflow-summary-v1" as const;
export const SCREEN_02_WORKFLOW_RECEIPT_NOTICE_SCHEMA_VERSION =
  "screen-02-workflow-receipt-notice-v1" as const;
export const SCREEN_02_WORKFLOW_META_KEY =
  "shockaudit/screen02-workflow-v021" as const;
export const SCREEN_02_WORKFLOW_CORRELATION_META_KEY =
  "shockaudit/screen02-workflow-correlation-v1" as const;
export const SCREEN_02_WORKFLOW_CORRELATION_SCHEMA_VERSION =
  "screen-02-workflow-correlation-v1" as const;
export const SCREEN_02_WORKFLOW_CREATE_SCHEMA_VERSION =
  "screen-02-workflow-create-v1" as const;
export const SCREEN_02_WORKFLOW_CREATE_TOOL_V023 =
  "create_screen02_workflow_v023" as const;
export const SCREEN_02_WORKFLOW_CREATE_TOOL_V024 =
  "create_screen02_workflow_v024" as const;
export const SCREEN_02_WORKFLOW_CREATE_SCHEMA_VERSION_V024 =
  "screen-02-workflow-create-v2" as const;
export const SCREEN_02_WORKFLOW_OPEN_REQUEST_PREFIX =
  "screen02-v021-open-" as const;

export type Screen02WorkflowStateEnvelope =
  | Screen02FindWorkflowStateEnvelope
  | Screen02AuditWorkflowStateEnvelope;

export type Screen02WorkflowAssessmentBatch = {
  schemaVersion: typeof SCREEN_02_WORKFLOW_ASSESSMENT_BATCH_SCHEMA_VERSION;
  batchId: string;
  runId: string;
  mode: "find" | "audit";
  requestIds: string[];
  requiredTool:
    | "submit_screen02_find_assessment_draft_v021"
    | "submit_screen02_audit_draft_v021";
  modelContext: Record<string, unknown>;
  prompt: string;
  issuedAt: string;
  expiresAt: string;
};

/**
 * Complete plaintext v2.1 state is deliberately component-only. Current MCP
 * structuredContent carries a compact summary plus an authenticated encrypted
 * snapshot; the plaintext snapshot travels only in optional result `_meta`
 * and the widget's private state so the bearer token and canonical envelope
 * are never added to model context by accident.
 */
export type Screen02WorkflowClientSnapshot = {
  schemaVersion: typeof SCREEN_02_WORKFLOW_CLIENT_SCHEMA_VERSION;
  runId: string;
  accessToken: string;
  mode: "find" | "audit";
  revision: number;
  stateFingerprint: string;
  stateEnvelope: Screen02WorkflowStateEnvelope;
  assessmentAvailable: boolean;
  assessmentBatch: Screen02WorkflowAssessmentBatch | null;
  handoff: Screen02WorkflowHandoff | null;
};

/**
 * Model-visible status only. Run identity and compare-and-swap coordinates
 * duplicate the private client snapshot and are deliberately excluded.
 */
export type Screen02WorkflowSummary = {
  schemaVersion: typeof SCREEN_02_WORKFLOW_SUMMARY_SCHEMA_VERSION;
  screen: "screen-02";
  ok: boolean;
  outcome: "created" | "applied" | "replayed" | "refreshed" | "conflict";
  mode: "find" | "audit";
  assessmentAvailable: boolean;
  preparedRequestCount: number;
  deliveredRequestCount: number;
  completedRequestCount: number;
  continuationReady: boolean;
  message: string;
};

/**
 * Opaque request correlation for component-only workflow results. ChatGPT may
 * return the public summary from `tools/call` and deliver the private snapshot
 * later through a tool-result notification or `toolResponseMetadata`. Keeping
 * the operation ID beside the hidden snapshot lets the widget join those two
 * delivery paths without accepting an unrelated or stale workflow.
 */
export type Screen02WorkflowCorrelation = {
  schemaVersion: typeof SCREEN_02_WORKFLOW_CORRELATION_SCHEMA_VERSION;
  operationId: string;
  kind: "open" | "mutation";
  runId: string;
  mode: "find" | "audit";
  revision: number;
  stateFingerprint: string;
};

/**
 * Public completion signal for the model-only assessment tool. These opaque
 * IDs let the mounted widget correlate and deduplicate the host-delivered tool
 * result; they grant no authority. Capability and signed-receipt tokens are
 * never returned here, and canonical revision/fingerprint coordinates remain
 * private in the client snapshot.
 */
export type Screen02WorkflowReceiptNotice = {
  schemaVersion: typeof SCREEN_02_WORKFLOW_RECEIPT_NOTICE_SCHEMA_VERSION;
  phase: "canonical-receipt-result";
  runId: string;
  mode: "find" | "audit";
  requestId: string;
  receiptId: string;
  disposition:
    | "apply"
    | "buffered-awaiting-delivery"
    | "duplicate"
    | "stale"
    | "terminal"
    | "unknown-request";
  reason: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function nonempty(value: unknown, maximum = 4_000): value is string {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    value.length > 0 &&
    value.length <= maximum
  );
}

function canonicalIso(value: unknown): value is string {
  return (
    nonempty(value, 100) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

const privateAssessmentContextKeys = new Set([
  "accessToken",
  "stateEnvelope",
  "handoff",
  "widgetState",
  "_meta",
]);

function containsPrivateAssessmentContextField(
  value: unknown,
  depth = 0,
): boolean {
  if (depth > 24) return true;
  if (Array.isArray(value)) {
    return value.some((entry) =>
      containsPrivateAssessmentContextField(entry, depth + 1),
    );
  }
  if (!isRecord(value)) return false;
  return Object.entries(value).some(
    ([key, entry]) =>
      privateAssessmentContextKeys.has(key) ||
      containsPrivateAssessmentContextField(entry, depth + 1),
  );
}

export function decodeScreen02WorkflowClientEnvelope(
  envelope: unknown,
):
  | { ok: true; state: Screen02WorkflowState; envelope: Screen02WorkflowStateEnvelope }
  | { ok: false; message: string } {
  const find = decodeScreen02FindWorkflowStateEnvelope(envelope);
  if (find.ok) {
    return { ok: true, state: find.state, envelope: find.envelope };
  }
  const audit = decodeScreen02AuditWorkflowStateEnvelope(envelope);
  if (audit.ok) {
    return { ok: true, state: audit.state, envelope: audit.envelope };
  }
  return {
    ok: false,
    message: `Find envelope: ${find.code}. Audit envelope: ${audit.code}.`,
  };
}

function restoreAssessmentBatch(
  value: unknown,
  state: Screen02WorkflowState,
): Screen02WorkflowAssessmentBatch | null {
  if (!isRecord(value)) return null;
  if (
    !exactKeys(value, [
      "schemaVersion",
      "batchId",
      "runId",
      "mode",
      "requestIds",
      "requiredTool",
      "modelContext",
      "prompt",
      "issuedAt",
      "expiresAt",
    ]) ||
    value.schemaVersion !== SCREEN_02_WORKFLOW_ASSESSMENT_BATCH_SCHEMA_VERSION ||
    !nonempty(value.batchId, 200) ||
    value.runId !== state.runId ||
    value.mode !== state.mode ||
    !Array.isArray(value.requestIds) ||
    value.requestIds.length < 1 ||
    value.requestIds.length > SCREEN_02_WORKFLOW_ASSESSMENT_BATCH_MAX_REQUESTS ||
    value.requestIds.some((id) => !nonempty(id, 200)) ||
    new Set(value.requestIds).size !== value.requestIds.length ||
    (state.mode === "find"
      ? value.requiredTool !== "submit_screen02_find_assessment_draft_v021"
      : value.requiredTool !== "submit_screen02_audit_draft_v021") ||
    !isRecord(value.modelContext) ||
    containsPrivateAssessmentContextField(value.modelContext) ||
    !nonempty(value.prompt, 12_000) ||
    !canonicalIso(value.issuedAt) ||
    !canonicalIso(value.expiresAt) ||
    Date.parse(value.expiresAt) <= Date.parse(value.issuedAt)
  ) {
    return null;
  }
  const preparedIds = new Set(
    state.assessmentRequests
      .filter((request) => request.status === "prepared")
      .map((request) => request.requestId),
  );
  if (value.requestIds.some((requestId) => !preparedIds.has(requestId))) {
    return null;
  }
  try {
    if (JSON.stringify(value.modelContext).length > 512 * 1024) return null;
  } catch {
    return null;
  }
  return JSON.parse(JSON.stringify(value)) as Screen02WorkflowAssessmentBatch;
}

export function restoreScreen02WorkflowClientSnapshot(
  value: unknown,
): Screen02WorkflowClientSnapshot | null {
  try {
    if (!isRecord(value)) return null;
    if (
      !exactKeys(value, [
        "schemaVersion",
        "runId",
        "accessToken",
        "mode",
        "revision",
        "stateFingerprint",
        "stateEnvelope",
        "assessmentAvailable",
        "assessmentBatch",
        "handoff",
      ]) ||
      value.schemaVersion !== SCREEN_02_WORKFLOW_CLIENT_SCHEMA_VERSION ||
      !nonempty(value.runId, 200) ||
      !nonempty(value.accessToken, 512) ||
      (value.mode !== "find" && value.mode !== "audit") ||
      !Number.isSafeInteger(value.revision) ||
      (value.revision as number) < 0 ||
      !nonempty(value.stateFingerprint, 80) ||
      typeof value.assessmentAvailable !== "boolean"
    ) {
      return null;
    }
    const decoded = decodeScreen02WorkflowClientEnvelope(value.stateEnvelope);
    if (!decoded.ok) return null;
    const state = requireScreen02WorkflowState(decoded.state);
    if (
      state.runId !== value.runId ||
      state.mode !== value.mode ||
      state.revision !== value.revision ||
      fingerprintScreen02WorkflowState(state) !== value.stateFingerprint
    ) {
      return null;
    }
    const assessmentBatch =
      value.assessmentBatch === null
        ? null
        : restoreAssessmentBatch(value.assessmentBatch, state);
    if (value.assessmentBatch !== null && !assessmentBatch) return null;
    if (
      assessmentBatch &&
      JSON.stringify(assessmentBatch).includes(value.accessToken)
    ) {
      return null;
    }
    const handoff =
      value.handoff === null
        ? null
        : restoreScreen02WorkflowHandoff(value.handoff, state);
    if (value.handoff !== null && !handoff) return null;
    return {
      schemaVersion: SCREEN_02_WORKFLOW_CLIENT_SCHEMA_VERSION,
      runId: value.runId,
      accessToken: value.accessToken,
      mode: value.mode,
      revision: value.revision as number,
      stateFingerprint: value.stateFingerprint,
      stateEnvelope: decoded.envelope,
      assessmentAvailable: value.assessmentAvailable,
      assessmentBatch,
      handoff,
    };
  } catch {
    return null;
  }
}

export function restoreScreen02WorkflowCorrelation(
  value: unknown,
): Screen02WorkflowCorrelation | null {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "schemaVersion",
      "operationId",
      "kind",
      "runId",
      "mode",
      "revision",
      "stateFingerprint",
    ]) ||
    value.schemaVersion !== SCREEN_02_WORKFLOW_CORRELATION_SCHEMA_VERSION ||
    !nonempty(value.operationId, 200) ||
    (value.kind !== "open" && value.kind !== "mutation") ||
    !nonempty(value.runId, 200) ||
    (value.mode !== "find" && value.mode !== "audit") ||
    !Number.isSafeInteger(value.revision) ||
    (value.revision as number) < 0 ||
    !nonempty(value.stateFingerprint, 80)
  ) {
    return null;
  }
  return {
    schemaVersion: SCREEN_02_WORKFLOW_CORRELATION_SCHEMA_VERSION,
    operationId: value.operationId,
    kind: value.kind,
    runId: value.runId,
    mode: value.mode,
    revision: value.revision as number,
    stateFingerprint: value.stateFingerprint,
  };
}

export function createScreen02WorkflowCorrelation(
  snapshotValue: Screen02WorkflowClientSnapshot,
  operationId: string,
  kind: Screen02WorkflowCorrelation["kind"],
): Screen02WorkflowCorrelation {
  const snapshot = restoreScreen02WorkflowClientSnapshot(snapshotValue);
  if (!snapshot || !nonempty(operationId, 200)) {
    throw new Error("Screen 2 workflow correlation failed validation.");
  }
  return {
    schemaVersion: SCREEN_02_WORKFLOW_CORRELATION_SCHEMA_VERSION,
    operationId,
    kind,
    runId: snapshot.runId,
    mode: snapshot.mode,
    revision: snapshot.revision,
    stateFingerprint: snapshot.stateFingerprint,
  };
}

export function stateFromScreen02WorkflowClientSnapshot(
  snapshot: Screen02WorkflowClientSnapshot,
) {
  const restored = restoreScreen02WorkflowClientSnapshot(snapshot);
  if (!restored) {
    throw new Error("Screen 2 workflow client snapshot failed validation.");
  }
  const decoded = decodeScreen02WorkflowClientEnvelope(restored.stateEnvelope);
  if (!decoded.ok) throw new Error(decoded.message);
  return decoded.state;
}

export function isScreen02WorkflowReceiptNotice(
  value: unknown,
): value is Screen02WorkflowReceiptNotice {
  if (!isRecord(value)) return false;
  return (
    exactKeys(value, [
      "schemaVersion",
      "phase",
      "runId",
      "mode",
      "requestId",
      "receiptId",
      "disposition",
      "reason",
    ]) &&
    value.schemaVersion === SCREEN_02_WORKFLOW_RECEIPT_NOTICE_SCHEMA_VERSION &&
    value.phase === "canonical-receipt-result" &&
    nonempty(value.runId, 200) &&
    (value.mode === "find" || value.mode === "audit") &&
    nonempty(value.requestId, 200) &&
    nonempty(value.receiptId, 200) &&
    [
      "apply",
      "buffered-awaiting-delivery",
      "duplicate",
      "stale",
      "terminal",
      "unknown-request",
    ].includes(value.disposition as string) &&
    nonempty(value.reason, 2_000)
  );
}
