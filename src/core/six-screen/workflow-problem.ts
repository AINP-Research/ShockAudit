import {
  fingerprintSixScreenValue,
  serializeSixScreenValue,
} from "./canonical";

export const SIX_SCREEN_WORKFLOW_PROBLEM_SCHEMA_VERSION =
  "shockaudit-six-screen-workflow-problem-v1" as const;
export const SIX_SCREEN_WORKFLOW_PROBLEM_TEXT_PREFIX =
  "SHOCKAUDIT_WORKFLOW_PROBLEM_V1:" as const;
export const SIX_SCREEN_WORKFLOW_PROBLEM_MAX_TEXT_BYTES = 4_096;

export const SIX_SCREEN_WORKFLOW_PROBLEM_CODES = [
  "field_validation",
  "request_contract",
  "revision_conflict",
  "operation_identity_conflict",
  "authorization",
  "core_state_invalid",
  "execution_failure",
  "persistence_failure",
  "projection_failure",
  "response_contract",
  "delivery_failure",
  "build_incompatible",
  "configuration_unavailable",
  "source_unavailable",
  "provider_rejected",
  "external_outcome_unknown",
  "unclassified",
] as const;

export const SIX_SCREEN_WORKFLOW_PROBLEM_STAGES = [
  "request_validation",
  "authorization",
  "revision_check",
  "execution",
  "commit",
  "projection",
  "serialization",
  "host_delivery",
  "widget_persistence",
  "render",
] as const;

export const SIX_SCREEN_WORKFLOW_PROBLEM_RECOVERIES = [
  "correct_fields",
  "check_status",
  "guarded_rebase",
  "retry_local",
  "restore_local_artifact",
  "reconnect",
  "update_client",
  "observe_external",
  "none",
] as const;

export const SIX_SCREEN_WORKFLOW_COMMIT_CERTAINTIES = [
  "not_committed", "committed", "unknown",
] as const;
export const SIX_SCREEN_WORKFLOW_DISPATCH_CERTAINTIES = [
  "not_dispatched", "dispatched", "unknown",
] as const;
export const SIX_SCREEN_WORKFLOW_PROBLEM_DIAGNOSTIC_SCOPES = [
  "local_only", "persisted_event",
] as const;

export type SixScreenWorkflowProblemCode =
  (typeof SIX_SCREEN_WORKFLOW_PROBLEM_CODES)[number];
export type SixScreenWorkflowProblemStage =
  (typeof SIX_SCREEN_WORKFLOW_PROBLEM_STAGES)[number];
export type SixScreenWorkflowProblemRecovery =
  (typeof SIX_SCREEN_WORKFLOW_PROBLEM_RECOVERIES)[number];
export type SixScreenWorkflowCommitCertainty =
  (typeof SIX_SCREEN_WORKFLOW_COMMIT_CERTAINTIES)[number];
export type SixScreenWorkflowDispatchCertainty =
  (typeof SIX_SCREEN_WORKFLOW_DISPATCH_CERTAINTIES)[number];
export type SixScreenWorkflowProblemDiagnosticScope =
  (typeof SIX_SCREEN_WORKFLOW_PROBLEM_DIAGNOSTIC_SCOPES)[number];

export const SIX_SCREEN_WORKFLOW_SAFE_CAUSE_CODES = [
  "abort_error",
  "authorization_expired",
  "authorization_failed",
  "build_mismatch",
  "cause_cycle",
  "cause_depth_limit",
  "conflicting_machine_codes",
  "configuration_unavailable",
  "core_state_invalid",
  "delivery_interrupted",
  "execution_failed",
  "external_outcome_unknown",
  "field_validation_failed",
  "invalid_argument",
  "mcp_wrapper",
  "operation_conflict",
  "persistence_failed",
  "projection_failed",
  "provider_rejected",
  "request_schema_invalid",
  "response_contract_invalid",
  "response_contract_version",
  "response_coordinate_mismatch",
  "response_payload_invalid",
  "run_unavailable",
  "screen3_rebuild_binding_invalid",
  "source_operation_conflict",
  "source_receipt_unavailable",
  "source_unavailable",
  "stale_revision",
  "timeout",
  "transport_error",
  "unclassified_error",
  "unsupported_cause_wrapper",
  "unsupported_machine_code",
  "zod_error",
] as const;

export const SIX_SCREEN_WORKFLOW_FIELD_ISSUE_CODES = [
  "custom",
  "invalid_element",
  "invalid_field",
  "invalid_format",
  "invalid_key",
  "invalid_type",
  "invalid_union",
  "invalid_value",
  "request_shape",
  "required",
  "too_big",
  "too_small",
  "unrecognized_keys",
] as const;

export type SixScreenWorkflowSafeCauseCode =
  (typeof SIX_SCREEN_WORKFLOW_SAFE_CAUSE_CODES)[number];
export type SixScreenWorkflowFieldIssueCode =
  (typeof SIX_SCREEN_WORKFLOW_FIELD_ISSUE_CODES)[number];

export type SixScreenWorkflowFieldIssue = {
  fieldPath: string;
  code: SixScreenWorkflowFieldIssueCode;
};

export type SafeSixScreenWorkflowProblem = {
  schemaVersion: typeof SIX_SCREEN_WORKFLOW_PROBLEM_SCHEMA_VERSION;
  code: SixScreenWorkflowProblemCode;
  stage: SixScreenWorkflowProblemStage;
  operationReference: string | null;
  action: string;
  screen: number | null;
  expectedRevision: number | null;
  actualRevision: number | null;
  commitCertainty: SixScreenWorkflowCommitCertainty;
  dispatchCertainty: SixScreenWorkflowDispatchCertainty;
  recovery: SixScreenWorkflowProblemRecovery;
  fieldIssues: SixScreenWorkflowFieldIssue[];
  safeCauseCodes: SixScreenWorkflowSafeCauseCode[];
  diagnosticScope: SixScreenWorkflowProblemDiagnosticScope;
  occurrenceReference: string | null;
  diagnosticReference: string;
};

type ProblemDefaults = Pick<SafeSixScreenWorkflowProblem,
  "stage" | "commitCertainty" | "dispatchCertainty" | "recovery">;

export const SIX_SCREEN_WORKFLOW_PROBLEM_DEFAULTS: Readonly<
  Record<SixScreenWorkflowProblemCode, ProblemDefaults>
> = {
  field_validation: {
    stage: "request_validation", commitCertainty: "not_committed",
    dispatchCertainty: "not_dispatched", recovery: "correct_fields",
  },
  request_contract: {
    stage: "request_validation", commitCertainty: "not_committed",
    dispatchCertainty: "not_dispatched", recovery: "none",
  },
  revision_conflict: {
    stage: "revision_check", commitCertainty: "not_committed",
    dispatchCertainty: "not_dispatched", recovery: "guarded_rebase",
  },
  operation_identity_conflict: {
    stage: "revision_check", commitCertainty: "not_committed",
    dispatchCertainty: "not_dispatched", recovery: "none",
  },
  authorization: {
    stage: "authorization", commitCertainty: "not_committed",
    dispatchCertainty: "not_dispatched", recovery: "reconnect",
  },
  core_state_invalid: {
    stage: "request_validation", commitCertainty: "unknown",
    dispatchCertainty: "not_dispatched", recovery: "none",
  },
  execution_failure: {
    stage: "execution", commitCertainty: "unknown",
    dispatchCertainty: "unknown", recovery: "check_status",
  },
  persistence_failure: {
    stage: "commit", commitCertainty: "unknown",
    dispatchCertainty: "unknown", recovery: "check_status",
  },
  projection_failure: {
    stage: "projection", commitCertainty: "committed",
    dispatchCertainty: "unknown", recovery: "restore_local_artifact",
  },
  response_contract: {
    stage: "serialization", commitCertainty: "unknown",
    dispatchCertainty: "unknown", recovery: "check_status",
  },
  delivery_failure: {
    stage: "host_delivery", commitCertainty: "unknown",
    dispatchCertainty: "unknown", recovery: "check_status",
  },
  build_incompatible: {
    stage: "serialization", commitCertainty: "unknown",
    dispatchCertainty: "unknown", recovery: "update_client",
  },
  configuration_unavailable: {
    stage: "execution", commitCertainty: "not_committed",
    dispatchCertainty: "not_dispatched", recovery: "none",
  },
  source_unavailable: {
    stage: "execution", commitCertainty: "not_committed",
    dispatchCertainty: "unknown", recovery: "none",
  },
  provider_rejected: {
    stage: "execution", commitCertainty: "not_committed",
    dispatchCertainty: "dispatched", recovery: "none",
  },
  external_outcome_unknown: {
    stage: "execution", commitCertainty: "unknown",
    dispatchCertainty: "unknown", recovery: "observe_external",
  },
  unclassified: {
    stage: "execution", commitCertainty: "unknown",
    dispatchCertainty: "unknown", recovery: "none",
  },
};

const publicMessages: Record<SixScreenWorkflowProblemCode, string> = {
  field_validation: "Review the identified study fields.",
  request_contract: "ShockAudit rejected a malformed workflow request.",
  revision_conflict: "The saved study changed before this action could be applied.",
  operation_identity_conflict:
    "ShockAudit rejected a reused operation identity with different input.",
  authorization: "This saved workflow could not be authorized.",
  core_state_invalid: "The saved workflow core could not be validated.",
  execution_failure: "ShockAudit could not complete the workflow action.",
  persistence_failure:
    "ShockAudit could not verify that the workflow action was saved.",
  projection_failure:
    "The saved workflow changed, but one display module is unavailable.",
  response_contract:
    "ShockAudit rejected an invalid workflow response contract.",
  delivery_failure:
    "The workflow response was interrupted; the action may already be saved.",
  build_incompatible:
    "The Local Preview UI and backend use incompatible contracts.",
  configuration_unavailable:
    "The local model configuration is unavailable. Saved guidance remains readable.",
  source_unavailable: "A required source route was unavailable.",
  provider_rejected:
    "The provider rejected the request before a validated result was saved.",
  external_outcome_unknown:
    "The external request outcome is unknown; do not resend it automatically.",
  unclassified: "ShockAudit could not classify the workflow failure safely.",
};

const privateValuePattern =
  /(?:sa6[ar]_[A-Za-z0-9_-]+|\bBearer\b|\bsk-[A-Za-z0-9_-]+|api[_-]?key|access[_-]?token|authorization|password|secret)/iu;
const actionPattern = /^[a-z][a-z0-9_]{0,79}$/u;
const pathSegmentPattern = /^[A-Za-z][A-Za-z0-9_-]{0,47}$/u;
const numericPathSegmentPattern = /^\d{1,4}$/u;
const operationReferencePattern = /^OP-[0-9A-F]{12}$/u;
const occurrenceReferencePattern = /^EV-[0-9A-F]{12}$/u;
const diagnosticReferencePattern = /^SA-[0-9A-F]{12}$/u;
const encoder = new TextEncoder();

function isOneOf<T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

function safeRevision(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) >= 0
    ? Number(value) : null;
}

function safeScreen(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) >= 1 && Number(value) <= 6
    ? Number(value) : null;
}

function safeAction(value: unknown) {
  return typeof value === "string" && actionPattern.test(value) &&
      !privateValuePattern.test(value)
    ? value
    : "unknown";
}

function opaqueReference(prefix: "OP" | "EV", value: unknown) {
  if (typeof value !== "string" || value.length === 0 || value.length > 4_096) {
    return null;
  }
  return `${prefix}-${fingerprintSixScreenValue(value).slice(-12).toUpperCase()}`;
}

function pathSegments(value: unknown): Array<string | number> | null {
  if (Array.isArray(value)) return value.slice(0, 9) as Array<string | number>;
  if (typeof value !== "string" || value.length === 0 || value.length > 384) {
    return null;
  }
  let normalized = value.startsWith("$.") ? value.slice(2) : value;
  normalized = normalized.replace(/\[(\d{1,4})\]/gu, ".$1");
  if (normalized.startsWith(".") || /[\[\]]/u.test(normalized)) return null;
  return normalized.split(".");
}

/** Return a structural field path only; arbitrary labels and values are dropped. */
export function sanitizeSixScreenWorkflowFieldPath(value: unknown) {
  const segments = pathSegments(value);
  if (!segments || segments.length === 0 || segments.length > 8) return null;
  const safe: string[] = [];
  for (const segment of segments) {
    if (typeof segment === "number") {
      if (!Number.isSafeInteger(segment) || segment < 0 || segment > 9_999) {
        return null;
      }
      safe.push(String(segment));
      continue;
    }
    if (typeof segment !== "string" ||
        !(pathSegmentPattern.test(segment) ||
          numericPathSegmentPattern.test(segment)) ||
        privateValuePattern.test(segment)) return null;
    safe.push(segment);
  }
  return safe.join(".");
}

function safeFieldIssueCode(value: unknown): SixScreenWorkflowFieldIssueCode {
  const normalized = typeof value === "string"
    ? value.trim().toLowerCase().replaceAll("-", "_") : "";
  return isOneOf(SIX_SCREEN_WORKFLOW_FIELD_ISSUE_CODES, normalized)
    ? normalized
    : "invalid_field";
}

function safeFieldIssues(value: unknown): SixScreenWorkflowFieldIssue[] {
  if (!Array.isArray(value)) return [];
  const result: SixScreenWorkflowFieldIssue[] = [];
  for (const item of value.slice(0, 16)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const fieldPath = sanitizeSixScreenWorkflowFieldPath(record.fieldPath ??
      record.path);
    if (!fieldPath) continue;
    const issue = { fieldPath, code: safeFieldIssueCode(record.code) };
    if (!result.some((candidate) => candidate.fieldPath === issue.fieldPath &&
      candidate.code === issue.code)) result.push(issue);
  }
  return result.sort((left, right) =>
    `${left.fieldPath}:${left.code}`.localeCompare(
      `${right.fieldPath}:${right.code}`,
    ));
}

function safeCauseCodes(value: unknown): SixScreenWorkflowSafeCauseCode[] {
  if (!Array.isArray(value)) return [];
  const result = value.filter((item): item is SixScreenWorkflowSafeCauseCode =>
    isOneOf(SIX_SCREEN_WORKFLOW_SAFE_CAUSE_CODES, item));
  return [...new Set(result)].sort();
}

function diagnosticBody(problem: Omit<SafeSixScreenWorkflowProblem,
  "diagnosticReference">) {
  const {
    occurrenceReference: _occurrenceReference,
    diagnosticScope: _diagnosticScope,
    ...stable
  } = problem;
  return stable;
}

function diagnosticReference(problem: Omit<SafeSixScreenWorkflowProblem,
  "diagnosticReference">) {
  return `SA-${fingerprintSixScreenValue(diagnosticBody(problem))
    .slice(-12).toUpperCase()}`;
}

export type CreateSixScreenWorkflowProblemInput = {
  code: SixScreenWorkflowProblemCode;
  stage?: SixScreenWorkflowProblemStage;
  operationId?: string | null;
  action?: string | null;
  screen?: number | null;
  expectedRevision?: number | null;
  actualRevision?: number | null;
  commitCertainty?: SixScreenWorkflowCommitCertainty;
  dispatchCertainty?: SixScreenWorkflowDispatchCertainty;
  recovery?: SixScreenWorkflowProblemRecovery;
  fieldIssues?: ReadonlyArray<{ fieldPath?: unknown; path?: unknown;
    code?: unknown }>;
  safeCauseCodes?: readonly unknown[];
  occurrenceId?: string | null;
};

export function createSixScreenWorkflowProblem(
  input: CreateSixScreenWorkflowProblemInput,
): SafeSixScreenWorkflowProblem {
  if (!isOneOf(SIX_SCREEN_WORKFLOW_PROBLEM_CODES, input.code)) {
    throw new Error("Workflow problem category is invalid.");
  }
  if ((input.stage !== undefined &&
        !isOneOf(SIX_SCREEN_WORKFLOW_PROBLEM_STAGES, input.stage)) ||
      (input.commitCertainty !== undefined &&
        !isOneOf(SIX_SCREEN_WORKFLOW_COMMIT_CERTAINTIES,
          input.commitCertainty)) ||
      (input.dispatchCertainty !== undefined &&
        !isOneOf(SIX_SCREEN_WORKFLOW_DISPATCH_CERTAINTIES,
          input.dispatchCertainty)) ||
      (input.recovery !== undefined &&
        !isOneOf(SIX_SCREEN_WORKFLOW_PROBLEM_RECOVERIES, input.recovery))) {
    throw new Error("Workflow problem policy value is invalid.");
  }
  const defaults = SIX_SCREEN_WORKFLOW_PROBLEM_DEFAULTS[input.code];
  const occurrenceReference = opaqueReference("EV", input.occurrenceId);
  const withoutReference: Omit<SafeSixScreenWorkflowProblem,
    "diagnosticReference"> = {
    schemaVersion: SIX_SCREEN_WORKFLOW_PROBLEM_SCHEMA_VERSION,
    code: input.code,
    stage: input.stage ?? defaults.stage,
    operationReference: opaqueReference("OP", input.operationId),
    action: safeAction(input.action),
    screen: safeScreen(input.screen),
    expectedRevision: safeRevision(input.expectedRevision),
    actualRevision: safeRevision(input.actualRevision),
    commitCertainty: input.commitCertainty ?? defaults.commitCertainty,
    dispatchCertainty: input.dispatchCertainty ?? defaults.dispatchCertainty,
    recovery: input.recovery ?? defaults.recovery,
    fieldIssues: safeFieldIssues(input.fieldIssues),
    safeCauseCodes: safeCauseCodes(input.safeCauseCodes),
    diagnosticScope: occurrenceReference ? "persisted_event" : "local_only",
    occurrenceReference,
  };
  return {
    ...withoutReference,
    diagnosticReference: diagnosticReference(withoutReference),
  };
}

const problemKeys = [
  "action", "actualRevision", "code", "commitCertainty",
  "diagnosticReference", "diagnosticScope", "dispatchCertainty",
  "expectedRevision", "fieldIssues", "occurrenceReference",
  "operationReference", "recovery", "safeCauseCodes", "schemaVersion",
  "screen", "stage",
] as const;

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

function assertProblem(value: unknown): asserts value is SafeSixScreenWorkflowProblem {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Workflow problem payload is not an object.");
  }
  const problem = value as Record<string, unknown>;
  if (!exactKeys(problem, problemKeys) ||
      problem.schemaVersion !== SIX_SCREEN_WORKFLOW_PROBLEM_SCHEMA_VERSION ||
      !isOneOf(SIX_SCREEN_WORKFLOW_PROBLEM_CODES, problem.code) ||
      !isOneOf(SIX_SCREEN_WORKFLOW_PROBLEM_STAGES, problem.stage) ||
      !isOneOf(SIX_SCREEN_WORKFLOW_COMMIT_CERTAINTIES,
        problem.commitCertainty) ||
      !isOneOf(SIX_SCREEN_WORKFLOW_DISPATCH_CERTAINTIES,
        problem.dispatchCertainty) ||
      !isOneOf(SIX_SCREEN_WORKFLOW_PROBLEM_RECOVERIES, problem.recovery) ||
      !isOneOf(SIX_SCREEN_WORKFLOW_PROBLEM_DIAGNOSTIC_SCOPES,
        problem.diagnosticScope) ||
      typeof problem.action !== "string" ||
      safeAction(problem.action) !== problem.action ||
      !(problem.screen === null || safeScreen(problem.screen) === problem.screen) ||
      !(problem.expectedRevision === null ||
        safeRevision(problem.expectedRevision) === problem.expectedRevision) ||
      !(problem.actualRevision === null ||
        safeRevision(problem.actualRevision) === problem.actualRevision) ||
      !(problem.operationReference === null ||
        (typeof problem.operationReference === "string" &&
          operationReferencePattern.test(problem.operationReference))) ||
      !(problem.occurrenceReference === null ||
        (typeof problem.occurrenceReference === "string" &&
          occurrenceReferencePattern.test(problem.occurrenceReference))) ||
      (problem.diagnosticScope === "local_only" &&
        problem.occurrenceReference !== null) ||
      (problem.diagnosticScope === "persisted_event" &&
        problem.occurrenceReference === null) ||
      typeof problem.diagnosticReference !== "string" ||
      !diagnosticReferencePattern.test(problem.diagnosticReference)) {
    throw new Error("Workflow problem payload has an invalid contract shape.");
  }
  const fields = safeFieldIssues(problem.fieldIssues);
  const causes = safeCauseCodes(problem.safeCauseCodes);
  if (!Array.isArray(problem.fieldIssues) ||
      !Array.isArray(problem.safeCauseCodes) ||
      serializeSixScreenValue(fields) !==
        serializeSixScreenValue(problem.fieldIssues) ||
      serializeSixScreenValue(causes) !==
        serializeSixScreenValue(problem.safeCauseCodes)) {
    throw new Error("Workflow problem payload has invalid bounded diagnostics.");
  }
  const body = problem as unknown as Omit<SafeSixScreenWorkflowProblem,
    "diagnosticReference"> & { diagnosticReference: string };
  const { diagnosticReference: received, ...withoutReference } = body;
  if (diagnosticReference(withoutReference) !== received) {
    throw new Error("Workflow problem diagnostic reference is invalid.");
  }
}

/** Encode only the structured safe envelope; an Error message is never copied. */
export function encodeSixScreenWorkflowProblemText(
  problem: SafeSixScreenWorkflowProblem,
) {
  assertProblem(problem);
  const encoded = SIX_SCREEN_WORKFLOW_PROBLEM_TEXT_PREFIX +
    serializeSixScreenValue(problem);
  if (encoder.encode(encoded).byteLength >
      SIX_SCREEN_WORKFLOW_PROBLEM_MAX_TEXT_BYTES) {
    throw new Error("Workflow problem text exceeds its safe size limit.");
  }
  return encoded;
}

/**
 * Return null for ordinary tool/research text. A recognized prefix is parsed
 * strictly and rejects extra keys, noncanonical JSON, or a forged reference.
 */
export function decodeSixScreenWorkflowProblemText(text: string) {
  if (!text.startsWith(SIX_SCREEN_WORKFLOW_PROBLEM_TEXT_PREFIX)) return null;
  if (encoder.encode(text).byteLength >
      SIX_SCREEN_WORKFLOW_PROBLEM_MAX_TEXT_BYTES) {
    throw new Error("Workflow problem text exceeds its safe size limit.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(SIX_SCREEN_WORKFLOW_PROBLEM_TEXT_PREFIX.length));
  } catch {
    throw new Error("Workflow problem text is not valid JSON.");
  }
  assertProblem(parsed);
  if (encodeSixScreenWorkflowProblemText(parsed) !== text) {
    throw new Error("Workflow problem text is not canonically encoded.");
  }
  return parsed;
}

export class SixScreenWorkflowProblemError extends Error {
  readonly problem: SafeSixScreenWorkflowProblem;

  constructor(problem: SafeSixScreenWorkflowProblem) {
    assertProblem(problem);
    super(publicMessages[problem.code]);
    this.name = "SixScreenWorkflowProblemError";
    this.problem = structuredClone(problem);
  }

  toToolResultText() {
    return encodeSixScreenWorkflowProblemText(this.problem);
  }
}

type MachineSignal = {
  code: SixScreenWorkflowProblemCode;
  cause: SixScreenWorkflowSafeCauseCode;
  fallback?: boolean;
};

const machineSignals: Record<string, MachineSignal | "wrapper"> = {
  FIELD_VALIDATION: { code: "field_validation",
    cause: "field_validation_failed" },
  REQUEST_CONTRACT: { code: "request_contract",
    cause: "request_schema_invalid" },
  SCHEMA_VALIDATION: { code: "request_contract",
    cause: "request_schema_invalid" },
  ZOD_ERROR: { code: "request_contract", cause: "zod_error" },
  INVALID_ARGUMENT: { code: "request_contract", cause: "invalid_argument",
    fallback: true },
  STALE_REVISION: { code: "revision_conflict", cause: "stale_revision" },
  REVISION_CONFLICT: { code: "revision_conflict", cause: "stale_revision" },
  OPERATION_CONFLICT: { code: "operation_identity_conflict",
    cause: "operation_conflict" },
  OPERATION_IDENTITY_CONFLICT: { code: "operation_identity_conflict",
    cause: "operation_conflict" },
  UNAUTHORIZED: { code: "authorization", cause: "authorization_failed" },
  AUTHORIZATION_FAILED: { code: "authorization",
    cause: "authorization_failed" },
  AUTHORIZATION_EXPIRED: { code: "authorization",
    cause: "authorization_expired" },
  RUN_NOT_FOUND: { code: "authorization", cause: "run_unavailable" },
  CORE_STATE_INVALID: { code: "core_state_invalid",
    cause: "core_state_invalid" },
  EXECUTION_FAILURE: { code: "execution_failure",
    cause: "execution_failed" },
  PERSISTENCE_FAILURE: { code: "persistence_failure",
    cause: "persistence_failed" },
  PROJECTION_FAILURE: { code: "projection_failure",
    cause: "projection_failed" },
  RESPONSE_CONTRACT: { code: "response_contract",
    cause: "response_contract_invalid" },
  RESPONSE_CONTRACT_MISSING: { code: "response_contract",
    cause: "response_contract_invalid" },
  PRIVATE_SNAPSHOT_MISSING: { code: "response_contract",
    cause: "response_contract_invalid" },
  RESPONSE_FINGERPRINT: { code: "response_contract",
    cause: "response_contract_invalid" },
  STATE_PAYLOAD: { code: "response_contract",
    cause: "response_payload_invalid" },
  PUBLIC_PAYLOAD: { code: "response_contract",
    cause: "response_payload_invalid" },
  STATE_FINGERPRINT: { code: "response_contract",
    cause: "response_coordinate_mismatch" },
  REVISION: { code: "response_contract",
    cause: "response_coordinate_mismatch" },
  RUN_ID: { code: "response_contract",
    cause: "response_coordinate_mismatch" },
  WRAPPER_RUN_ID: { code: "response_contract",
    cause: "response_coordinate_mismatch" },
  WRAPPER_REVISION: { code: "response_contract",
    cause: "response_coordinate_mismatch" },
  WRAPPER_STATE_FINGERPRINT: { code: "response_contract",
    cause: "response_coordinate_mismatch" },
  PUBLIC_RUN_ID: { code: "response_contract",
    cause: "response_coordinate_mismatch" },
  PUBLIC_REVISION: { code: "response_contract",
    cause: "response_coordinate_mismatch" },
  PUBLIC_FINGERPRINT: { code: "response_contract",
    cause: "response_coordinate_mismatch" },
  PRIVATE_SNAPSHOT_SHAPE: { code: "response_contract",
    cause: "response_contract_invalid" },
  PUBLIC_PROJECTION_SHAPE: { code: "response_contract",
    cause: "response_contract_invalid" },
  BUILD_INCOMPATIBLE: { code: "build_incompatible",
    cause: "build_mismatch" },
  CONFIGURATION_UNAVAILABLE: { code: "configuration_unavailable",
    cause: "configuration_unavailable" },
  RESPONSE_CONTRACT_VERSION: { code: "build_incompatible",
    cause: "response_contract_version" },
  DELIVERY_FAILURE: { code: "delivery_failure",
    cause: "delivery_interrupted" },
  TRANSPORT_INTERRUPTED: { code: "delivery_failure",
    cause: "transport_error" },
  NETWORK_ERROR: { code: "delivery_failure", cause: "transport_error",
    fallback: true },
  TIMEOUT: { code: "delivery_failure", cause: "timeout", fallback: true },
  ABORT_ERROR: { code: "delivery_failure", cause: "abort_error",
    fallback: true },
  SOURCE_UNAVAILABLE: { code: "source_unavailable",
    cause: "source_unavailable" },
  PROVIDER_REJECTED: { code: "provider_rejected",
    cause: "provider_rejected" },
  EXTERNAL_OUTCOME_UNKNOWN: { code: "external_outcome_unknown",
    cause: "external_outcome_unknown" },
  MCP_ERROR: "wrapper",
  RUNTIME_EXCEPTION: "wrapper",
  TOOL_ERROR: "wrapper",
};

function normalizedMachineCode(value: unknown) {
  if (typeof value === "number" && value === -32_000) return "MCP_ERROR";
  if (typeof value !== "string" || value.length === 0 || value.length > 80) {
    return null;
  }
  const normalized = value.trim().replace(/([a-z0-9])([A-Z])/gu, "$1_$2")
    .replace(/[^A-Za-z0-9]+/gu, "_").replace(/^_+|_+$/gu, "")
    .toUpperCase();
  return normalized || null;
}

function ownValue(value: object, key: string) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function errorName(error: Error) {
  try {
    return error.name;
  } catch {
    return "Error";
  }
}

type CollectedSignals = {
  signals: MachineSignal[];
  causes: SixScreenWorkflowSafeCauseCode[];
  nodes: object[];
  malformed: boolean;
  unknownCode: boolean;
};

function collectMachineSignals(error: Error): CollectedSignals {
  const signals: MachineSignal[] = [];
  const causes: SixScreenWorkflowSafeCauseCode[] = [];
  const nodes: object[] = [];
  const seen = new Set<object>();
  let malformed = false;
  let unknownCode = false;
  let current: unknown = error;
  for (let depth = 0; current !== undefined && current !== null; depth += 1) {
    if (depth >= 4) {
      causes.push("cause_depth_limit");
      malformed = true;
      break;
    }
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      causes.push("unsupported_cause_wrapper");
      malformed = true;
      break;
    }
    if (seen.has(current)) {
      causes.push("cause_cycle");
      malformed = true;
      break;
    }
    seen.add(current);
    nodes.push(current);
    const rawCode = ownValue(current, "code");
    const normalizedCode = normalizedMachineCode(rawCode);
    let signal = normalizedCode ? machineSignals[normalizedCode] : undefined;
    if (!signal && current instanceof Error) {
      const normalizedName = normalizedMachineCode(errorName(current));
      signal = normalizedName ? machineSignals[normalizedName] : undefined;
    }
    if (signal === "wrapper") causes.push("mcp_wrapper");
    else if (signal) {
      signals.push(signal);
      causes.push(signal.cause);
    } else if (rawCode !== undefined) {
      causes.push("unsupported_machine_code");
      unknownCode = true;
    }
    const cause = ownValue(current, "cause");
    if (cause === undefined || cause === null) break;
    current = cause;
  }
  return { signals, causes, nodes, malformed, unknownCode };
}

function numericFromNodes(nodes: readonly object[], keys: readonly string[]) {
  for (const node of nodes) {
    for (const key of keys) {
      const revision = safeRevision(ownValue(node, key));
      if (revision !== null) return revision;
    }
  }
  return null;
}

function zodFieldIssues(nodes: readonly object[]) {
  for (const node of nodes) {
    const issues = ownValue(node, "issues");
    if (!Array.isArray(issues)) continue;
    return safeFieldIssues(issues.map((issue) => {
      if (!issue || typeof issue !== "object" || Array.isArray(issue)) {
        return {};
      }
      return {
        path: ownValue(issue, "path"),
        code: ownValue(issue, "code"),
      };
    }));
  }
  return [];
}

export type ClassifySixScreenWorkflowProblemContext = Omit<
  CreateSixScreenWorkflowProblemInput,
  "code" | "fieldIssues" | "safeCauseCodes"
> & {
  fieldIssues?: CreateSixScreenWorkflowProblemInput["fieldIssues"];
};

/**
 * Classify only caught Error objects. Strings and research/model/source data
 * are deliberately ignored even if they contain error-looking words.
 */
export function classifySixScreenWorkflowProblem(
  error: unknown,
  context: ClassifySixScreenWorkflowProblemContext = {},
): SafeSixScreenWorkflowProblem | null {
  if (error instanceof SixScreenWorkflowProblemError) {
    return structuredClone(error.problem);
  }
  if (!(error instanceof Error)) return null;
  const collected = collectMachineSignals(error);
  const nonFallback = collected.signals.filter((signal) => !signal.fallback);
  const effective = nonFallback.length ? nonFallback : collected.signals;
  const categories = [...new Set(effective.map((signal) => signal.code))];
  const conflicting = categories.length > 1;
  const unsupported = collected.unknownCode;
  const code: SixScreenWorkflowProblemCode = conflicting || unsupported
    ? "unclassified"
    : categories[0] ?? "unclassified";
  const expectedRevision = context.expectedRevision !== undefined
    ? context.expectedRevision
    : numericFromNodes(collected.nodes, ["expectedRevision"]);
  const actualRevision = context.actualRevision !== undefined
    ? context.actualRevision
    : numericFromNodes(collected.nodes, ["actualRevision", "currentRevision"]);
  const fieldIssues = context.fieldIssues ?? zodFieldIssues(collected.nodes);
  const causes: SixScreenWorkflowSafeCauseCode[] = [
    ...collected.causes,
    ...(conflicting ? ["conflicting_machine_codes" as const] : []),
    ...(!effective.length && !unsupported
      ? ["unclassified_error" as const] : []),
  ];
  return createSixScreenWorkflowProblem({
    ...context,
    code,
    expectedRevision,
    actualRevision,
    fieldIssues,
    safeCauseCodes: causes,
    // A malformed or conflicting envelope never authorizes a retry even when
    // one useful outer machine code survived classification.
    ...(collected.malformed || conflicting || unsupported
      ? { recovery: "none" as const }
      : {}),
  });
}
