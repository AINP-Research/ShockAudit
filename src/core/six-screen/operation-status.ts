import {
  fingerprintSixScreenValue,
  sameSixScreenValue,
} from "./canonical";
import {
  requireShockIdentity,
  type SixScreenWorkflowState,
} from "./contracts";
import {
  currentProposedTreatmentTiming,
  currentScreen3StudyEntryContext,
  currentStudyDesignAdvice,
  normalizeStudyDesignClarifications,
  type StudyDesignClarifications,
} from "./study-design-advice";
import type { Screen3StartReceipt } from "./workflow";
import {
  SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID,
} from "./workflow-response-contract";

export const SIX_SCREEN_OPERATION_STATUS_SCHEMA_VERSION =
  "shockaudit-six-screen-operation-status-v1" as const;
export const SIX_SCREEN_OPERATION_STATUS_TOOL =
  "get_six_screen_operation_status_v1" as const;

const FINGERPRINT_PATTERN = /^fnv1a64:[0-9a-f]{16}$/u;
const RUN_ID_PATTERN = /^sa6r_[A-Za-z0-9_-]{43}$/u;
const OPERATION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u;
const ISO_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const MAX_STATUS_BYTES = 64 * 1024;

export type SixScreenOperationStatusRequest = {
  runId: string;
  operationId: string;
  operationKind: string;
  inputFingerprint: string;
};

export type Screen3StartReceiptSummary = {
  workflowRevision: number;
  studyRevision: number;
  identityFingerprint: string;
  timingId: string;
  timingFingerprint: string;
  entryContextId: string;
  entryContextFingerprint: string;
  adviceId: string;
  adviceFingerprint: string;
  evidenceStatus:
    | "available"
    | "partial"
    | "conflicting"
    | "unavailable"
    | "not_researched";
  openedAt: string;
};

export type SixScreenOperationDestination = {
  screen: 3 | null;
  state:
    | "current"
    | "historical"
    | "locally_recoverable"
    | "unavailable"
    | "not_applicable"
    | "unknown";
  displayReady: boolean;
  localRebuildAvailable: boolean;
  safeCode: string;
};

export type SixScreenOperationStatus = {
  schemaVersion: typeof SIX_SCREEN_OPERATION_STATUS_SCHEMA_VERSION;
  buildId: typeof SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID;
  appVersion: string;
  uiResourceUri: string;
  toolName: typeof SIX_SCREEN_OPERATION_STATUS_TOOL;
  requestFingerprint: string;
  runId: string;
  revision: number;
  stateFingerprint: string;
  operationReference: string;
  operationKind: string;
  inputFingerprint: string;
  lookup: "committed" | "unknown_or_expired" | "conflict";
  commitCertainty: "committed" | "unknown";
  committedRevision: number | null;
  mutationOutcome: "changed" | "unchanged" | "legacy_unknown" | null;
  completedAt: string | null;
  resultFingerprint: string | null;
  receiptValidated: boolean;
  screen3Receipt: Screen3StartReceiptSummary | null;
  destination: SixScreenOperationDestination;
  responseFingerprint: string;
};

export type SixScreenOperationStatusBody = Omit<
  SixScreenOperationStatus,
  "responseFingerprint"
>;

export function sixScreenOperationRequestFingerprint(
  request: SixScreenOperationStatusRequest,
) {
  return fingerprintSixScreenValue(request);
}

export function sixScreenOperationReference(operationId: string) {
  return fingerprintSixScreenValue(operationId).slice(-12).toUpperCase();
}

export function createSixScreenOperationStatus(
  body: SixScreenOperationStatusBody,
): SixScreenOperationStatus {
  const status = {
    ...body,
    responseFingerprint: fingerprintSixScreenValue(body),
  };
  if (new TextEncoder().encode(JSON.stringify(status)).byteLength >
      MAX_STATUS_BYTES) {
    throw new Error("The operation status exceeds its bounded wire size.");
  }
  return status;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const actual = Object.keys(value).sort();
  return sameSixScreenValue(actual, [...expected].sort());
}

function validIso(value: unknown): value is string {
  return typeof value === "string" && ISO_INSTANT_PATTERN.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(Date.parse(value)).toISOString() === value;
}

function validSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

const SCREEN3_LEGACY_RECEIPT_KEYS = [
  "runId",
  "workflowRevision",
  "studyRevision",
  "confirmedShock",
  "timingId",
  "timingFingerprint",
  "entryContextId",
  "entryContextFingerprint",
  "adviceId",
  "adviceFingerprint",
  "evidenceStatus",
  "openedAt",
] as const;

const SCREEN3_CURRENT_RECEIPT_KEYS = [
  ...SCREEN3_LEGACY_RECEIPT_KEYS,
  "clarifications",
  "clarificationFingerprint",
] as const;

const SCREEN3_CLARIFICATION_KEYS = [
  "adoptionPattern", "treatmentProcess", "dataStructure", "effectInterest",
  "assignmentUnit", "reportedPolicyAssignments", "comparisonSupport",
  "moderator", "moderatorTime", "rd",
] as const;

const SCREEN3_RD_KEYS = [
  "runningVariable", "cutoff", "operator", "assignmentRule",
  "treatmentTarget", "assignmentRelation", "verification",
  "otherConditions", "bindingStatus", "probabilityJump",
] as const;

function boundedNullableText(value: unknown, maximum = 4_000) {
  return value === null || typeof value === "string" &&
    value.length <= maximum;
}

function validatedScreen3Clarifications(
  value: unknown,
): StudyDesignClarifications | null {
  const clarifications = record(value);
  if (!clarifications ||
      !exactKeys(clarifications, SCREEN3_CLARIFICATION_KEYS) ||
      !["unknown", "common", "staggered"].includes(
        String(clarifications.adoptionPattern),
      ) ||
      !["unknown", "absorbing", "reversible", "continuous_dose"].includes(
        String(clarifications.treatmentProcess),
      ) ||
      !["unknown", "panel", "repeated_cross_sections"].includes(
        String(clarifications.dataStructure),
      ) ||
      !["undecided", "overall", "dynamic", "subgroup"].includes(
        String(clarifications.effectInterest),
      ) ||
      !boundedNullableText(clarifications.assignmentUnit) ||
      !(clarifications.reportedPolicyAssignments === null ||
        Number.isSafeInteger(clarifications.reportedPolicyAssignments) &&
        Number(clarifications.reportedPolicyAssignments) >= 1 &&
        Number(clarifications.reportedPolicyAssignments) <= 1_000_000) ||
      ![
        "unknown", "available", "unavailable_after_adoption",
      ].includes(String(clarifications.comparisonSupport)) ||
      !boundedNullableText(clarifications.moderator) ||
      !["unknown", "baseline", "post_treatment"].includes(
        String(clarifications.moderatorTime),
      )) return null;
  if (clarifications.rd !== null) {
    const rd = record(clarifications.rd);
    if (!rd || !exactKeys(rd, SCREEN3_RD_KEYS) ||
        typeof rd.runningVariable !== "string" ||
        rd.runningVariable.length > 1_000 ||
        typeof rd.cutoff !== "string" || rd.cutoff.length > 500 ||
        !["<", "<=", ">", ">="].includes(String(rd.operator)) ||
        typeof rd.assignmentRule !== "string" ||
        rd.assignmentRule.length > 4_000 ||
        !["eligibility", "receipt"].includes(String(rd.treatmentTarget)) ||
        !["unknown", "sharp", "fuzzy"].includes(
          String(rd.assignmentRelation),
        ) ||
        !["researcher_reported", "policy_documented"].includes(
          String(rd.verification),
        ) ||
        !boundedNullableText(rd.otherConditions) ||
        !["unknown", "binding", "nonbinding"].includes(
          String(rd.bindingStatus),
        ) ||
        !["not_reported", "researcher_reported"].includes(
          String(rd.probabilityJump),
        )) return null;
  }
  try {
    const normalized = normalizeStudyDesignClarifications(
      clarifications as StudyDesignClarifications,
    );
    return sameSixScreenValue(normalized, clarifications) ? normalized : null;
  } catch {
    return null;
  }
}

export function classifyScreen3StartReceipt(input: {
  state: SixScreenWorkflowState;
  result: unknown;
  committedRevision: number;
}): {
  validated: boolean;
  summary: Screen3StartReceiptSummary | null;
  destination: SixScreenOperationDestination;
} {
  const value = record(input.result);
  const unavailable = (safeCode: string) => ({
    validated: false,
    summary: null,
    destination: {
      screen: 3 as const,
      state: "unavailable" as const,
      displayReady: false,
      localRebuildAvailable: false,
      safeCode,
    },
  });
  const legacyShape = Boolean(value &&
    exactKeys(value, SCREEN3_LEGACY_RECEIPT_KEYS));
  const currentShape = Boolean(value &&
    exactKeys(value, SCREEN3_CURRENT_RECEIPT_KEYS));
  if (!value || (!legacyShape && !currentShape)) {
    return unavailable("screen3_receipt_shape_invalid");
  }
  const receipt = value as unknown as Screen3StartReceipt;
  let rebuildInputValidated = false;
  if (currentShape) {
    const clarifications = validatedScreen3Clarifications(
      receipt.clarifications,
    );
    if (!clarifications ||
        typeof receipt.clarificationFingerprint !== "string" ||
        !FINGERPRINT_PATTERN.test(receipt.clarificationFingerprint) ||
        fingerprintSixScreenValue(clarifications) !==
          receipt.clarificationFingerprint) {
      return unavailable("screen3_receipt_clarifications_invalid");
    }
    rebuildInputValidated = true;
  }
  try {
    requireShockIdentity(receipt.confirmedShock);
  } catch {
    return unavailable("screen3_receipt_identity_invalid");
  }
  if (
    receipt.runId !== input.state.runId ||
    !validSafeInteger(receipt.workflowRevision) ||
    receipt.workflowRevision !== input.committedRevision ||
    !validSafeInteger(receipt.studyRevision) ||
    typeof receipt.timingId !== "string" ||
    !OPERATION_PATTERN.test(receipt.timingId) ||
    !FINGERPRINT_PATTERN.test(receipt.timingFingerprint) ||
    typeof receipt.entryContextId !== "string" ||
    !OPERATION_PATTERN.test(receipt.entryContextId) ||
    !FINGERPRINT_PATTERN.test(receipt.entryContextFingerprint) ||
    typeof receipt.adviceId !== "string" ||
    !OPERATION_PATTERN.test(receipt.adviceId) ||
    !FINGERPRINT_PATTERN.test(receipt.adviceFingerprint) ||
    ![
      "available", "partial", "conflicting", "unavailable",
      "not_researched",
    ].includes(receipt.evidenceStatus) ||
    !validIso(receipt.openedAt)
  ) return unavailable("screen3_receipt_coordinates_invalid");

  const timing = (input.state.proposedTreatmentTimings ?? []).find((item) =>
    item.id === receipt.timingId &&
    item.timingFingerprint === receipt.timingFingerprint);
  const entry = (input.state.screen3StudyEntryContexts ?? []).find((item) =>
    item.id === receipt.entryContextId &&
    item.entryFingerprint === receipt.entryContextFingerprint);
  const advice = (input.state.studyDesignAdvices ?? []).find((item) =>
    item.adviceId === receipt.adviceId &&
    item.adviceFingerprint === receipt.adviceFingerprint);
  const refsBound = Boolean(timing && entry && advice &&
    entry!.identityFingerprint === receipt.confirmedShock.identityFingerprint &&
    entry!.studyRevision === receipt.studyRevision &&
    entry!.timingId === receipt.timingId &&
    entry!.timingFingerprint === receipt.timingFingerprint &&
    entry!.evidence.status === receipt.evidenceStatus &&
    advice!.binding.identityFingerprint ===
      receipt.confirmedShock.identityFingerprint &&
    advice!.binding.studyRevision === receipt.studyRevision &&
    advice!.binding.timingFingerprint === receipt.timingFingerprint &&
    advice!.binding.clarificationFingerprint === entry!.clarificationFingerprint);
  const summary: Screen3StartReceiptSummary = {
    workflowRevision: receipt.workflowRevision,
    studyRevision: receipt.studyRevision,
    identityFingerprint: receipt.confirmedShock.identityFingerprint,
    timingId: receipt.timingId,
    timingFingerprint: receipt.timingFingerprint,
    entryContextId: receipt.entryContextId,
    entryContextFingerprint: receipt.entryContextFingerprint,
    adviceId: receipt.adviceId,
    adviceFingerprint: receipt.adviceFingerprint,
    evidenceStatus: receipt.evidenceStatus,
    openedAt: receipt.openedAt,
  };
  const currentEntry = currentScreen3StudyEntryContext(input.state);
  if (!refsBound) {
    const currentTiming = currentProposedTreatmentTiming(input.state);
    const currentBasis =
      input.state.confirmedShock?.identityFingerprint ===
        receipt.confirmedShock.identityFingerprint &&
      input.state.study.revision === receipt.studyRevision &&
      currentTiming?.id === receipt.timingId &&
      currentTiming.timingFingerprint === receipt.timingFingerprint &&
      entry?.id === receipt.entryContextId &&
      entry.entryFingerprint === receipt.entryContextFingerprint &&
      entry.identityFingerprint === receipt.confirmedShock.identityFingerprint &&
      entry.studyRevision === receipt.studyRevision &&
      entry.timingId === receipt.timingId &&
      entry.timingFingerprint === receipt.timingFingerprint &&
      entry.evidence.status === receipt.evidenceStatus &&
      rebuildInputValidated &&
      entry.clarificationFingerprint === receipt.clarificationFingerprint &&
      currentEntry?.id === receipt.entryContextId &&
      currentEntry.entryFingerprint === receipt.entryContextFingerprint &&
      currentEntry.clarificationFingerprint ===
        receipt.clarificationFingerprint;
    return {
      validated: true,
      summary,
      destination: {
        screen: 3,
        state: currentBasis ? "locally_recoverable" : "unavailable",
        displayReady: false,
        localRebuildAvailable: currentBasis,
        safeCode: currentBasis
          ? "screen3_guidance_rebuild_available"
          : "screen3_saved_guidance_unavailable",
      },
    };
  }
  const currentTiming = currentProposedTreatmentTiming(input.state);
  const currentAdvice = currentStudyDesignAdvice(input.state);
  const isCurrent =
    input.state.confirmedShock?.identityFingerprint ===
      receipt.confirmedShock.identityFingerprint &&
    input.state.study.revision === receipt.studyRevision &&
    currentTiming?.id === receipt.timingId &&
    currentTiming.timingFingerprint === receipt.timingFingerprint &&
    currentEntry?.id === receipt.entryContextId &&
    currentEntry.entryFingerprint === receipt.entryContextFingerprint &&
    currentAdvice?.adviceId === receipt.adviceId &&
    currentAdvice.adviceFingerprint === receipt.adviceFingerprint;
  return {
    validated: true,
    summary,
    destination: {
      screen: 3,
      state: isCurrent ? "current" : "historical",
      displayReady: isCurrent,
      localRebuildAvailable: false,
      safeCode: isCurrent
        ? "screen3_guidance_current"
        : "screen3_guidance_historical",
    },
  };
}

const STATUS_KEYS = [
  "schemaVersion", "buildId", "appVersion", "uiResourceUri", "toolName",
  "requestFingerprint", "runId", "revision", "stateFingerprint",
  "operationReference", "operationKind", "inputFingerprint", "lookup",
  "commitCertainty", "committedRevision", "mutationOutcome", "completedAt",
  "resultFingerprint", "receiptValidated", "screen3Receipt", "destination",
  "responseFingerprint",
] as const;

export function restoreSixScreenOperationStatus(input: {
  value: unknown;
  request: SixScreenOperationStatusRequest;
  expectedAppVersion: string;
  expectedUiResourceUri: string;
}): SixScreenOperationStatus {
  const value = record(input.value);
  const invalid = () => {
    throw new Error("The saved operation status used an invalid contract.");
  };
  if (!value || !exactKeys(value, STATUS_KEYS)) return invalid();
  const status = value as unknown as SixScreenOperationStatus;
  if (
    status.schemaVersion !== SIX_SCREEN_OPERATION_STATUS_SCHEMA_VERSION ||
    status.buildId !== SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID ||
    status.appVersion !== input.expectedAppVersion ||
    status.uiResourceUri !== input.expectedUiResourceUri ||
    status.toolName !== SIX_SCREEN_OPERATION_STATUS_TOOL ||
    status.requestFingerprint !==
      sixScreenOperationRequestFingerprint(input.request) ||
    status.runId !== input.request.runId ||
    !RUN_ID_PATTERN.test(status.runId) ||
    !validSafeInteger(status.revision) ||
    !FINGERPRINT_PATTERN.test(status.stateFingerprint) ||
    status.operationReference !==
      sixScreenOperationReference(input.request.operationId) ||
    status.operationKind !== input.request.operationKind ||
    !OPERATION_PATTERN.test(status.operationKind) ||
    status.inputFingerprint !== input.request.inputFingerprint ||
    !FINGERPRINT_PATTERN.test(status.inputFingerprint) ||
    !["committed", "unknown_or_expired", "conflict"].includes(status.lookup) ||
    !["committed", "unknown"].includes(status.commitCertainty) ||
    !(status.committedRevision === null ||
      validSafeInteger(status.committedRevision)) ||
    !(
      status.mutationOutcome === null ||
      status.mutationOutcome === "changed" ||
      status.mutationOutcome === "unchanged" ||
      status.mutationOutcome === "legacy_unknown"
    ) ||
    !(status.completedAt === null || validIso(status.completedAt)) ||
    !(status.resultFingerprint === null ||
      FINGERPRINT_PATTERN.test(status.resultFingerprint)) ||
    typeof status.receiptValidated !== "boolean"
  ) return invalid();
  const destination = record(status.destination);
  if (!destination || !exactKeys(destination, [
    "screen", "state", "displayReady", "localRebuildAvailable", "safeCode",
  ]) ||
    !(status.destination.screen === null || status.destination.screen === 3) ||
    ![
      "current", "historical", "locally_recoverable", "unavailable",
      "not_applicable", "unknown",
    ].includes(status.destination.state) ||
    typeof status.destination.displayReady !== "boolean" ||
    typeof status.destination.localRebuildAvailable !== "boolean" ||
    !/^[a-z][a-z0-9_]{0,79}$/u.test(status.destination.safeCode)
  ) return invalid();
  if (status.screen3Receipt !== null) {
    const summary = record(status.screen3Receipt);
    if (!summary || !exactKeys(summary, [
      "workflowRevision", "studyRevision", "identityFingerprint", "timingId",
      "timingFingerprint", "entryContextId", "entryContextFingerprint",
      "adviceId", "adviceFingerprint", "evidenceStatus", "openedAt",
    ]) ||
      !validSafeInteger(status.screen3Receipt.workflowRevision) ||
      !validSafeInteger(status.screen3Receipt.studyRevision) ||
      !FINGERPRINT_PATTERN.test(status.screen3Receipt.identityFingerprint) ||
      !OPERATION_PATTERN.test(status.screen3Receipt.timingId) ||
      !FINGERPRINT_PATTERN.test(status.screen3Receipt.timingFingerprint) ||
      !OPERATION_PATTERN.test(status.screen3Receipt.entryContextId) ||
      !FINGERPRINT_PATTERN.test(
        status.screen3Receipt.entryContextFingerprint,
      ) ||
      !OPERATION_PATTERN.test(status.screen3Receipt.adviceId) ||
      !FINGERPRINT_PATTERN.test(status.screen3Receipt.adviceFingerprint) ||
      ![
        "available", "partial", "conflicting", "unavailable",
        "not_researched",
      ].includes(status.screen3Receipt.evidenceStatus) ||
      !validIso(status.screen3Receipt.openedAt)) return invalid();
  }
  const committed = status.lookup === "committed";
  if (
    committed !== (status.commitCertainty === "committed") ||
    (committed && (
      status.committedRevision === null ||
      status.committedRevision > status.revision ||
      status.mutationOutcome === null ||
      status.completedAt === null ||
      status.resultFingerprint === null
    )) ||
    (!committed && (
      status.committedRevision !== null || status.completedAt !== null ||
      status.resultFingerprint !== null || status.screen3Receipt !== null ||
      status.receiptValidated
    )) ||
    (status.screen3Receipt !== null && (
      status.operationKind !== "open_screen_3" ||
      !status.receiptValidated ||
      status.screen3Receipt.workflowRevision !== status.committedRevision
    )) ||
    (status.operationKind === "open_screen_3" && committed &&
      status.receiptValidated !== (status.screen3Receipt !== null)) ||
    (status.lookup === "unknown_or_expired" &&
      status.destination.state !== "unknown") ||
    (status.lookup === "conflict" &&
      status.destination.state !== "unavailable") ||
    (status.destination.displayReady &&
      status.destination.state !== "current") ||
    (status.destination.localRebuildAvailable &&
      status.destination.state !== "locally_recoverable")
  ) return invalid();
  const { responseFingerprint: _responseFingerprint, ...body } = status;
  if (status.responseFingerprint !== fingerprintSixScreenValue(body)) {
    return invalid();
  }
  if (new TextEncoder().encode(JSON.stringify(status)).byteLength >
      MAX_STATUS_BYTES) return invalid();
  return structuredClone(status);
}
