import { fingerprintSixScreenValue } from "./canonical";
import type { Screen5MechanismProviderReceipt } from "./screen5-mechanism";
import type { StudyFirstEventInvestigation } from
  "./study-first-event-investigation";

export const SCREEN4_INTERPRETATION_TASK_VERSION =
  "screen4-openai-event-descriptions-v5" as const;
const LEGACY_SCREEN4_INTERPRETATION_TASK_VERSIONS = [
  "screen4-openai-event-descriptions-v4",
  "screen4-openai-event-descriptions-v3",
  "screen4-openai-event-descriptions-v2",
  "screen4-openai-event-interpretation-v1",
] as const;
export const SCREEN4_INTERPRETATION_MAX_BATCH_SIZE = 4;
export const SCREEN4_INTERPRETATION_MAX_BATCHES = 3;
export const SCREEN4_INTERPRETATION_MAX_HISTORY = 72;

/** Public, bounded projection of the saved Screen 4 assessment queue. */
export type Screen4AssessmentQueue = {
  taskFingerprint: string;
  status: "ready" | "in_progress" | "completed" | "partial" |
    "validation_failed" | "failed" | "outcome_unknown";
  retryEligibility: "new_request" | "local_revalidation" | "observe" | "none";
  results: Array<{
    eventId: string;
    relationshipType: "potential_independent_event" | "related_policy_stage" |
      "possible_downstream_response" | "comparison_exposure_or_spillover" |
      "measurement_or_sample_change" | "uncertain";
    documentedChange: string;
    outcomePathway: string;
    nextCheck: string;
    sourceIds: string[];
  }>;
  error: string | null;
  diagnostic: null | {
    taskType: "screen4_event_interpretation";
    stage: "local_configuration" | "admission" | "network" |
      "response_headers" | "response_body" | "model_output" |
      "persistence" | "projection" | "request" | "validation" | "unknown";
    code: string;
    dispatchState: "not_dispatched" | "dispatched" | "unknown";
    receiptSaved: boolean;
    issuePaths: string[];
  };
  /** Temporary user-visible execution trace. It is omitted after every
   * displayed event has a saved assessment. */
  diagnosis: null | {
    reference: string;
    currentStep: "source_manifest" | "packet_preparation" |
      "allowance_reservation" | "provider_dispatch" |
      "response_validation" | "assessment_persistence" | "display_join";
    batchNumber: number | null;
    batchCount: number;
    updatedAt: string | null;
    steps: Array<{
      id: "source_manifest" | "packet_preparation" |
        "allowance_reservation" | "provider_dispatch" |
        "response_validation" | "assessment_persistence" | "display_join";
      label: string;
      status: "complete" | "current" | "waiting" | "failed";
      detail: string;
    }>;
  };
  completedCount: number;
  totalCount: number;
  readiness: {
    canDispatch: boolean;
    blocker: string | null;
    batchCount: number;
    maximumReservationTokens: number;
    nextReservationTokens: number;
    availableTokens: number | null;
    availableAttempts: number | null;
  };
};

/** Only a response whose non-success HTTP status was actually observed is a
 * known retryable rejection. A legacy untyped `http_error` remains readable;
 * once a stage is present, response-body/model-output failures are never
 * reclassified as safe new requests. */
export function knownObservedProviderHttpFailure(record: {
  failureCode?: string | null;
  failureStage?: string | null;
}) {
  return record.failureCode === "http_error" && record.failureStage == null ||
    record.failureStage === "response_headers" && Boolean(
      record.failureCode && (/^provider_http_\d{3}$/u.test(
        record.failureCode) || [
        "openai_authentication_failed", "openai_model_access_denied",
        "openai_quota_or_spend_limit_reached", "openai_rate_limited",
        "openai_schema_rejected",
      ].includes(record.failureCode)));
}

export type Screen4InterpretationAttempt = {
  id: string;
  reservationId: string;
  taskFingerprint: string;
  packetFingerprint: string;
  investigationSnapshotId: string;
  investigationFingerprint: string;
  batchIndex: number;
  eventIds: string[];
  attemptOrdinal: number;
  /** A durable explicit mutation claim, set before this batch may dispatch. */
  claimOperationId: string | null;
  status: "pending" | "paused" | "receipt_saved" | "validation_failed" |
    "completed" | "failed" | "outcome_unknown";
  dispatchState: "not_dispatched" | "dispatched" | "unknown";
  failureCode: string | null;
  /** Optional on v24 records. */
  failureStage?: "local_configuration" | "admission" | "network" |
    "response_headers" | "response_body" | "model_output" |
    "persistence" | "projection" | null;
  receipt: Screen5MechanismProviderReceipt | null;
  /** Server-validated result; never populate from an unvalidated raw receipt. */
  result: unknown | null;
  error: string | null;
  /** Present on the compact assessment store; absent on legacy main-state
   * attempts written before stage diagnostics were introduced. */
  progressStage?: "packet_prepared" | "allowance_reserved" |
    "provider_dispatched" | "response_received" |
    "response_validated" | "assessment_saved" | "failed";
  updatedAt: string;
};

/** The task identity includes private run identity and source-scan lineage. */
export function screen4InterpretationTaskFingerprint(input: {
  runId: string;
  investigation: StudyFirstEventInvestigation;
}) {
  return screen4TaskFingerprintForVersion({
    ...input,
    taskVersion: SCREEN4_INTERPRETATION_TASK_VERSION,
  });
}

function screen4TaskFingerprintForVersion(input: {
  runId: string;
  investigation: StudyFirstEventInvestigation;
  taskVersion: typeof SCREEN4_INTERPRETATION_TASK_VERSION |
    (typeof LEGACY_SCREEN4_INTERPRETATION_TASK_VERSIONS)[number];
}) {
  return fingerprintSixScreenValue({
    runId: input.runId,
    taskVersion: input.taskVersion,
    investigationSnapshotId: input.investigation.snapshotId,
    investigationFingerprint: input.investigation.investigationFingerprint,
    contextFingerprint: input.investigation.context.contextFingerprint,
    visibleEventIds: input.investigation.presentation?.visibleEventIds ?? [],
  });
}

export function screen4InterpretationBatches(
  investigation: StudyFirstEventInvestigation,
) {
  if (!investigation.presentation ||
    !["completed", "completed_partial"].includes(investigation.status)) {
    throw new Error("A completed Screen 4 source scan is required before interpretation.");
  }
  const ids = investigation.presentation.visibleEventIds;
  if (!ids.length || ids.length > 10 ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !investigation.occurrences.some((item) =>
      item.id === id))) {
    throw new Error("Screen 4 has no valid shortlisted source events to interpret.");
  }
  const batches = Array.from({ length: Math.ceil(ids.length /
    SCREEN4_INTERPRETATION_MAX_BATCH_SIZE) }, (_, index) =>
    ids.slice(index * SCREEN4_INTERPRETATION_MAX_BATCH_SIZE,
      (index + 1) * SCREEN4_INTERPRETATION_MAX_BATCH_SIZE));
  if (batches.length > SCREEN4_INTERPRETATION_MAX_BATCHES) {
    throw new Error("Screen 4 interpretation exceeds three four-event batches.");
  }
  return batches;
}

export function screen4InterpretationAttemptIds(input: {
  taskFingerprint: string;
  batchIndex: number;
  attemptOrdinal: number;
}) {
  const suffix = `${input.taskFingerprint.slice("fnv1a64:".length)}` +
    `-b${input.batchIndex}-a${input.attemptOrdinal}`;
  return {
    id: `screen4-analysis-${suffix}`,
    reservationId: `screen4-interpretation-${suffix}`,
  };
}

export function validateScreen4InterpretationAttempts(input: {
  runId: string;
  investigations: StudyFirstEventInvestigation[];
  attempts: Screen4InterpretationAttempt[];
}) {
  if (!Array.isArray(input.attempts) ||
    input.attempts.length > SCREEN4_INTERPRETATION_MAX_HISTORY ||
    new Set(input.attempts.map(({ id }) => id)).size !==
      input.attempts.length ||
    new Set(input.attempts.map(({ reservationId }) => reservationId)).size !==
      input.attempts.length) {
    throw new Error("Stored Screen 4 interpretation history is invalid.");
  }
  for (const [index, item] of input.attempts.entries()) {
    const investigation = input.investigations.find((candidate) =>
      candidate.snapshotId === item.investigationSnapshotId &&
      candidate.investigationFingerprint === item.investigationFingerprint);
    if (!investigation) throw new Error("Screen 4 interpretation has no retained source scan.");
    const taskFingerprints = new Set([
      screen4InterpretationTaskFingerprint({
        runId: input.runId, investigation,
      }),
      ...LEGACY_SCREEN4_INTERPRETATION_TASK_VERSIONS.map((taskVersion) =>
        screen4TaskFingerprintForVersion({
          runId: input.runId, investigation, taskVersion,
        })),
    ]);
    const batches = screen4InterpretationBatches(investigation);
    const prior = input.attempts.slice(0, index).filter((record) =>
      record.taskFingerprint === item.taskFingerprint &&
      record.batchIndex === item.batchIndex);
    const ids = screen4InterpretationAttemptIds(item);
    const updated = Date.parse(item.updatedAt);
    const previous = prior.at(-1);
    const previousMayBeRetried = previous?.status === "failed" &&
      previous.receipt === null &&
      (previous.dispatchState === "not_dispatched" ||
        previous.dispatchState === "dispatched" &&
          knownObservedProviderHttpFailure(previous));
    if (!taskFingerprints.has(item.taskFingerprint) ||
      !/^fnv1a64:[0-9a-f]{16}$/u.test(item.packetFingerprint) ||
      item.batchIndex < 0 || item.batchIndex >= batches.length ||
      JSON.stringify(item.eventIds) !== JSON.stringify(
        batches[item.batchIndex]) ||
      !Number.isSafeInteger(item.attemptOrdinal) ||
      item.attemptOrdinal !== prior.length + 1 ||
      item.id !== ids.id || item.reservationId !== ids.reservationId ||
      !(item.claimOperationId === null ||
        typeof item.claimOperationId === "string" &&
        item.claimOperationId.length > 0 &&
        item.claimOperationId.length <= 200) ||
      !["pending", "paused", "receipt_saved", "validation_failed", "completed",
        "failed", "outcome_unknown"].includes(item.status) ||
      !["not_dispatched", "dispatched", "unknown"].includes(
        item.dispatchState) ||
      (item.failureCode !== null &&
        !/^[a-z][a-z0-9_]{0,79}$/u.test(item.failureCode)) ||
      (item.failureStage !== undefined && item.failureStage !== null &&
        !["local_configuration", "admission", "network",
          "response_headers", "response_body", "model_output",
          "persistence", "projection"].includes(item.failureStage)) ||
      (item.error !== null && (typeof item.error !== "string" ||
        item.error.length > 500)) ||
      (item.progressStage !== undefined && ![
        "packet_prepared", "allowance_reserved", "provider_dispatched",
        "response_received", "response_validated", "assessment_saved",
        "failed",
      ].includes(item.progressStage)) ||
      (!Number.isFinite(updated) ||
        new Date(updated).toISOString() !== item.updatedAt) ||
      ((item.status === "receipt_saved" ||
        item.status === "validation_failed" ||
        item.status === "completed") && !item.receipt) ||
      (item.status === "completed" && !item.result) ||
      (item.status !== "completed" && item.result !== null) ||
      (item.status === "outcome_unknown" && item.receipt !== null) ||
      (item.status === "pending" && item.receipt !== null) ||
      (item.status === "paused" && (item.receipt !== null ||
        item.dispatchState !== "not_dispatched")) ||
      (item.status === "pending" &&
        item.dispatchState === "unknown") ||
      (item.dispatchState !== "not_dispatched" &&
        item.claimOperationId === null) ||
      (item.status !== "pending" &&
        item.claimOperationId === null) ||
      (item.status === "completed" &&
        item.dispatchState !== "dispatched") ||
      (item.status === "failed" && item.receipt !== null) ||
      (prior.length > 0 && !previousMayBeRetried)) {
      throw new Error("Stored Screen 4 interpretation attempt is invalid.");
    }
  }
}
