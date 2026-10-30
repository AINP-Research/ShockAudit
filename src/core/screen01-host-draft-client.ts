import type { Ambiguity, Mode, Screen01State } from "./scope-types";

/**
 * Browser-safe transport surface for the signed Screen 1 host-draft flow.
 * The Worker performs the authoritative capability, state, and draft checks;
 * the widget only verifies enough structure to route the task and receipt.
 */
export const SCREEN_01_HOST_DRAFT_PREPARE_TOOL_V036 =
  "prepare_screen01_scope_draft_v036" as const;
export const SCREEN_01_HOST_DRAFT_SUBMIT_TOOL_V036 =
  "submit_screen01_scope_draft_v036" as const;
export const SCREEN_01_HOST_DRAFT_APPLY_TOOL_V036 =
  "apply_screen01_scope_draft_v036" as const;
export const SCREEN_01_HOST_DRAFT_TASK_SCHEMA_VERSION =
  "screen-01-host-draft-task-v1" as const;
export const SCREEN_01_HOST_DRAFT_PREPARE_INPUT_SCHEMA_VERSION =
  "screen-01-host-draft-prepare-input-v1" as const;
export const SCREEN_01_HOST_DRAFT_MODEL_CONTEXT_SCHEMA_VERSION =
  "screen-01-host-draft-model-context-v1" as const;
export const SCREEN_01_HOST_DRAFT_SUBMISSION_SCHEMA_VERSION =
  "screen-01-host-draft-submission-v1" as const;
export const SCREEN_01_HOST_DRAFT_RECEIPT_SCHEMA_VERSION =
  "screen-01-host-draft-receipt-v1" as const;
export const SCREEN_01_HOST_DRAFT_APPLY_INPUT_SCHEMA_VERSION =
  "screen-01-host-draft-apply-input-v1" as const;
export const SCREEN_01_HOST_DRAFT_APPLICATION_SCHEMA_VERSION =
  "screen-01-host-draft-application-v1" as const;
export const SCREEN_01_HOST_DRAFT_TIMEOUT_MS = 120_000;

export type Screen01HostDraftPreparedTask = {
  schemaVersion: typeof SCREEN_01_HOST_DRAFT_TASK_SCHEMA_VERSION;
  phase: "prepared";
  operationId: string;
  requestId: string;
  sourceRevision: number;
  sourceStateDigest: string;
  mode: Mode;
  sentence: string;
  issuedAt: string;
  expiresAt: string;
  requiredTool: typeof SCREEN_01_HOST_DRAFT_SUBMIT_TOOL_V036;
  prompt: string;
  modelContext: Record<string, unknown>;
};

export type Screen01HostDraftReceiptNotice = {
  schemaVersion: typeof SCREEN_01_HOST_DRAFT_RECEIPT_SCHEMA_VERSION;
  phase: "signed-receipt";
  operationId: string;
  requestId: string;
  receiptId: string;
  sourceRevision: number;
  sourceStateDigest: string;
  receivedAt: string;
  receiptToken: string;
};

export type Screen01HostDraftApplication = {
  schemaVersion: typeof SCREEN_01_HOST_DRAFT_APPLICATION_SCHEMA_VERSION;
  phase: "applied";
  ok: true;
  operationId: string;
  requestId: string;
  receiptId: string;
  sourceRevision: number;
  sourceStateDigest: string;
  proposedState: Screen01State;
  ambiguities: Ambiguity[];
  message: string;
};

export type Screen01HostDraftUiStatus =
  | "idle"
  | "preparing"
  | "sending"
  | "waiting"
  | "applying"
  | "completed"
  | "error"
  | "timed-out";

export type Screen01HostDraftUiState = {
  available: boolean;
  status: Screen01HostDraftUiStatus;
  message?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

function isIdentifier(value: unknown) {
  return typeof value === "string" && value.length >= 1 && value.length <= 200;
}

function isTimestamp(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function isScreen01HostDraftClientTask(
  value: unknown,
): value is Screen01HostDraftPreparedTask {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "schemaVersion",
      "phase",
      "operationId",
      "requestId",
      "sourceRevision",
      "sourceStateDigest",
      "mode",
      "sentence",
      "issuedAt",
      "expiresAt",
      "requiredTool",
      "prompt",
      "modelContext",
    ]) ||
    value.schemaVersion !== SCREEN_01_HOST_DRAFT_TASK_SCHEMA_VERSION ||
    value.phase !== "prepared" ||
    !isIdentifier(value.operationId) ||
    !isIdentifier(value.requestId) ||
    !Number.isSafeInteger(value.sourceRevision) ||
    (value.sourceRevision as number) < 0 ||
    typeof value.sourceStateDigest !== "string" ||
    !/^sha256:[0-9a-f]{64}$/.test(value.sourceStateDigest) ||
    (value.mode !== "find" && value.mode !== "audit") ||
    typeof value.sentence !== "string" ||
    value.sentence.length < 20 ||
    value.sentence.length > 350 ||
    !isTimestamp(value.issuedAt) ||
    !isTimestamp(value.expiresAt) ||
    Date.parse(value.expiresAt as string) <= Date.parse(value.issuedAt as string) ||
    value.requiredTool !== SCREEN_01_HOST_DRAFT_SUBMIT_TOOL_V036 ||
    typeof value.prompt !== "string" ||
    value.prompt.length < 1 ||
    value.prompt.length > 4_000 ||
    !isRecord(value.modelContext)
  ) {
    return false;
  }
  const context = value.modelContext;
  if (
    context.schemaVersion !== SCREEN_01_HOST_DRAFT_MODEL_CONTEXT_SCHEMA_VERSION ||
    context.operationId !== value.operationId ||
    context.requestId !== value.requestId ||
    !isRecord(context.submission)
  ) {
    return false;
  }
  return context.submission.tool === SCREEN_01_HOST_DRAFT_SUBMIT_TOOL_V036 &&
    context.submission.schemaVersion ===
      SCREEN_01_HOST_DRAFT_SUBMISSION_SCHEMA_VERSION &&
    typeof context.submission.capabilityToken === "string" &&
    context.submission.capabilityToken.startsWith("sa1-capability-v1.") &&
    context.submission.capabilityToken.length <= 64 * 1024;
}

export function isScreen01HostDraftClientReceipt(
  value: unknown,
): value is Screen01HostDraftReceiptNotice {
  return isRecord(value) &&
    exactKeys(value, [
      "schemaVersion",
      "phase",
      "operationId",
      "requestId",
      "receiptId",
      "sourceRevision",
      "sourceStateDigest",
      "receivedAt",
      "receiptToken",
    ]) &&
    value.schemaVersion === SCREEN_01_HOST_DRAFT_RECEIPT_SCHEMA_VERSION &&
    value.phase === "signed-receipt" &&
    isIdentifier(value.operationId) &&
    isIdentifier(value.requestId) &&
    isIdentifier(value.receiptId) &&
    Number.isSafeInteger(value.sourceRevision) &&
    (value.sourceRevision as number) >= 0 &&
    typeof value.sourceStateDigest === "string" &&
    /^sha256:[0-9a-f]{64}$/.test(value.sourceStateDigest) &&
    isTimestamp(value.receivedAt) &&
    typeof value.receiptToken === "string" &&
    value.receiptToken.startsWith("sa1-receipt-v1.") &&
    value.receiptToken.length <= 64 * 1024;
}

/** The Worker has already revalidated the signed receipt and proposed state. */
export function isScreen01HostDraftClientApplication(
  value: unknown,
): value is Screen01HostDraftApplication {
  return isRecord(value) &&
    exactKeys(value, [
      "schemaVersion",
      "phase",
      "ok",
      "operationId",
      "requestId",
      "receiptId",
      "sourceRevision",
      "sourceStateDigest",
      "proposedState",
      "ambiguities",
      "message",
    ]) &&
    value.schemaVersion === SCREEN_01_HOST_DRAFT_APPLICATION_SCHEMA_VERSION &&
    value.phase === "applied" &&
    value.ok === true &&
    isIdentifier(value.operationId) &&
    isIdentifier(value.requestId) &&
    isIdentifier(value.receiptId) &&
    Number.isSafeInteger(value.sourceRevision) &&
    (value.sourceRevision as number) >= 0 &&
    typeof value.sourceStateDigest === "string" &&
    /^sha256:[0-9a-f]{64}$/.test(value.sourceStateDigest) &&
    isRecord(value.proposedState) &&
    Array.isArray(value.ambiguities) &&
    typeof value.message === "string";
}
