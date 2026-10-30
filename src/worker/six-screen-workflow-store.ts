import type { SixScreenWorkflowState } from
  "../core/six-screen/contracts";
import {
  SIX_SCREEN_OPTIONAL_ANALYSIS_RECOVERY_VERSION,
  SIX_SCREEN_WORKFLOW_SCHEMA_VERSION,
} from
  "../core/six-screen/contracts";
import {
  fingerprintSixScreenValue,
  sameSixScreenValue,
  SIX_SCREEN_FINGERPRINT_PATTERN,
} from
  "../core/six-screen/canonical";
import { validateScreen5MechanismProviderReceipt } from
  "../core/six-screen/screen5-mechanism";
import { validateScreen3ContextualCritique } from
  "./screen3-contextualizer";
import {
  validatePolicyEventCardReviewCollection,
} from "../core/six-screen/policy-event-card-review";
import {
  validateCausalDesignCollections,
} from "../core/six-screen/causal-comparison";
import {
  validateStudyDesignCollections,
} from "../core/six-screen/study-design-advice";
import {
  validateCoEventSearchCollections,
} from "../core/six-screen/co-event-search";
import {
  validateCoEventExecutionCollections,
} from "../core/six-screen/co-event-execution";
import {
  validateCoEventReviewCollections,
} from "../core/six-screen/co-event-occurrence-review";
import {
  validateCoEventRelationReviewCollection,
} from "../core/six-screen/co-event-relation-review";
import {
  validateCoEventPolicyLifecycleHandoffCollection,
} from "../core/six-screen/co-event-policy-lifecycle-handoff";
import {
  validatePolicyLifecycleStageReviewCollections,
} from "../core/six-screen/policy-lifecycle-stage-review";
import {
  validatePolicyLifecycleStageRevisionCollections,
} from "../core/six-screen/policy-lifecycle-stage-revision";
import {
  validateMechanismLiteraturePlanCollection,
} from "../core/six-screen/mechanism-literature-plan";
import {
  validateMechanismLiteratureExecutionCollections,
} from "../core/six-screen/mechanism-literature-execution";
import {
  validateScholarlyDocumentCollections,
} from "../core/six-screen/mechanism-scholarly-document";
import {
  validateScholarlyClaimCollections,
} from "../core/six-screen/mechanism-scholarly-claim-review";
import {
  validateMechanismSynthesisInputCollection,
} from "../core/six-screen/mechanism-synthesis-input";
import {
  validateScreen6UncertaintyProfileCollection,
} from "../core/six-screen/screen6-uncertainty-profile";
import {
  validateScreen6DiagnosticPlanCollection,
} from "../core/six-screen/screen6-diagnostic-plan";
import {
  validateScreen6DiagnosticResultCollections,
} from "../core/six-screen/screen6-diagnostic-result";
import {
  validateScreen6ClaimBoundaryCollections,
} from "../core/six-screen/screen6-claim-boundary";
import {
  validateScreen6ResearchExportCollection,
} from "../core/six-screen/screen6-research-export";
import {
  validateStudyFirstEventInvestigationCollections,
} from "../core/six-screen/study-first-event-investigation";
import { knownObservedProviderHttpFailure,
  screen4InterpretationTaskFingerprint,
  validateScreen4InterpretationAttempts } from
  "../core/six-screen/screen4-interpretation-queue";
import {
  parseSavedScreen4InterpretationReceipt,
  prepareScreen4Interpretation,
  validateStoredScreen4Interpretation,
} from "./screen4-openai-interpretation";
import {
  validateStudyFirstMechanismInputs,
  validateStudyFirstMechanismRuns,
} from
  "../core/six-screen/study-first-mechanism-comparison";
import {
  createScreen6CurrentPlan,
  screen6CompatibleInputFingerprints,
} from "../core/six-screen/screen6-current-plan";
import {
  validateScreen6Contextualization,
  validateScreen6ContextualizationShape,
} from "./screen6-contextualizer";

export const SIX_SCREEN_WORKFLOW_STORE_SCHEMA_VERSION =
  "shockaudit-six-screen-workflow-store-v1" as const;
export const SIX_SCREEN_WORKFLOW_RESUME_RETENTION_MS = 24 * 60 * 60 * 1_000;
export const SIX_SCREEN_WORKFLOW_MAX_OPERATION_REPLAYS = 64;
export const SIX_SCREEN_WORKFLOW_CLEANUP_BATCH_SIZE = 32;

const RECORD_PREFIX = "six-screen-workflow-v1:";
const EXPIRY_PREFIX = "six-screen-workflow-expiry-v1:";
const OPTIONAL_ANALYSIS_ARCHIVE_PREFIX =
  "six-screen-optional-analysis-archive-v1:";
export const SIX_SCREEN_OPTIONAL_ANALYSIS_ISOLATION_VERSION =
  "six-screen-optional-analysis-isolation-v1" as const;
const RUN_ID_PATTERN = /^sa6r_[A-Za-z0-9_-]{43}$/u;
const ACCESS_TOKEN_PATTERN = /^sa6a_[A-Za-z0-9_-]{43}$/u;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const OPERATION_COORDINATE_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u;
const CLEANUP_RETRY_AT = "1970-01-01T00:00:00.000Z";
const LEGACY_PUBLIC_PROJECTION_SCHEMA_VERSION =
  "shockaudit-six-screen-public-v1";

/**
 * Older Screen 3/6 contextualization checkpoints copied the full public
 * workflow into their bounded replay entries. The canonical state already
 * contains that data and direct responses rebuild the projection from it, so
 * keeping each copy can make a readable Durable Object impossible to update.
 */
function compactLegacyPublicProjectionReplayResult(
  result: unknown,
  runId: string,
  operationKind: string,
) {
  const contextualizationCheckpoint =
    operationKind.startsWith("screen3_contextualization_") ||
    operationKind.startsWith("screen6_contextualization_");
  if (contextualizationCheckpoint &&
      typeof result === "object" && result !== null &&
      !Array.isArray(result)) {
    const candidate = result as Record<string, unknown>;
    if (candidate.schemaVersion === LEGACY_PUBLIC_PROJECTION_SCHEMA_VERSION &&
        candidate.runId === runId &&
        Number.isSafeInteger(candidate.revision) &&
        [1, 2, 3, 4, 5, 6].includes(Number(candidate.activeScreen)) &&
        Object.hasOwn(candidate, "causalComparisonWorkspace") &&
        Object.hasOwn(candidate, "modelCapability")) {
      return null;
    }
  }
  return structuredClone(result);
}

function validateScreen4InterpretationState(state: SixScreenWorkflowState) {
  const investigations = state.studyFirstEventInvestigations ?? [];
  const attempts = state.screen4InterpretationAttempts ?? [];
  validateScreen4InterpretationAttempts({
    runId: state.runId, investigations, attempts,
  });
  for (const attempt of attempts) {
    const investigation = investigations.find((item) =>
      item.snapshotId === attempt.investigationSnapshotId &&
        item.investigationFingerprint === attempt.investigationFingerprint)!;
    const currentTaskFingerprint = screen4InterpretationTaskFingerprint({
      runId: state.runId, investigation,
    });
    // Completed v1/v2 attempts remain readable audit history, but only the
    // current slot-based contract is eligible for replay or display.
    if (attempt.taskFingerprint !== currentTaskFingerprint) {
      if (attempt.receipt) validateScreen5MechanismProviderReceipt(
        attempt.receipt);
      continue;
    }
    const prepared = prepareScreen4Interpretation({
      investigation, eventIds: attempt.eventIds,
    });
    if (prepared.packetFingerprint !== attempt.packetFingerprint) {
      throw new Error("Saved Screen 4 interpretation packet binding is invalid.");
    }
    if (attempt.receipt) validateScreen5MechanismProviderReceipt(
      attempt.receipt);
    if (attempt.status === "completed") {
      const validated = validateStoredScreen4Interpretation(
        attempt.result, prepared);
      const fromReceipt = parseSavedScreen4InterpretationReceipt({
        receipt: attempt.receipt!, prepared,
      });
      if (!sameSixScreenValue(validated, fromReceipt)) {
        throw new Error("Saved Screen 4 interpretation differs from its receipt.");
      }
    }
  }
}

export type SixScreenWorkflowOperationReplay = {
  operationId: string;
  operationKind: string;
  inputFingerprint: string;
  committedRevision: number;
  /** Absent on records written before unchanged operations were supported. */
  mutationOutcome?: "changed" | "unchanged";
  result: unknown;
  completedAt: string;
};

export type SixScreenWorkflowStoreRecord = {
  schemaVersion: typeof SIX_SCREEN_WORKFLOW_STORE_SCHEMA_VERSION;
  runId: string;
  accessTokenSha256: string;
  createInputFingerprint: string;
  state: SixScreenWorkflowState;
  stateFingerprint: string;
  generation: number;
  operationReplays: SixScreenWorkflowOperationReplay[];
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  /** Audit references only. Original private records, including receipts, stay in storage. */
  optionalAnalysisIsolations?: SixScreenOptionalAnalysisIsolation[];
};

export type SixScreenOptionalAnalysisIsolation = {
  schemaVersion: typeof SIX_SCREEN_OPTIONAL_ANALYSIS_ISOLATION_VERSION;
  sourceStateFingerprint: string;
  archiveKey: string;
  isolatedAt: string;
  items: Array<{
    collection: "screen3Contextualizations" | "screen4InterpretationAttempts" |
      "studyFirstMechanismRuns" | "screen6Personalizations";
    index: number | null;
    safeReason: "invalid_optional_analysis_record";
  }>;
};

/**
 * Same-storage coordinates used by proof-only child records. The discriminator
 * lets the shared host-task store choose the six-screen parent namespace
 * without changing the legacy Screen 2 guard contract.
 */
export type SixScreenWorkflowStoreParentGuard = {
  parentKind: "six-screen";
  runId: string;
  generation: number;
  revision: number;
  stateFingerprint: string;
  expiresAt: string;
};

export type SixScreenWorkflowStorageTransaction = {
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<unknown>;
};

export type SixScreenWorkflowStorage = {
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<unknown>;
  list(input: { prefix: string; limit?: number }): Promise<Map<string, unknown>>;
  transaction<T>(callback: (
    transaction: SixScreenWorkflowStorageTransaction,
  ) => Promise<T>): Promise<T>;
};

export type SixScreenWorkflowAuthentication = {
  runId: string;
  accessToken: string;
};

export type SixScreenWorkflowMutationInput =
  SixScreenWorkflowAuthentication & {
    expectedRevision: number;
    operationId: string;
    operationKind: string;
    inputFingerprint: string;
    updatedAt: string;
  };

export type SixScreenWorkflowOperationReceiptLookupInput =
  SixScreenWorkflowAuthentication & {
    operationId: string;
    operationKind: string;
    inputFingerprint: string;
  };

/**
 * Private store result for classifying a response whose delivery was lost.
 * A missing bounded replay is deliberately uncertain: retention expiry is not
 * evidence that the original operation failed to commit.
 */
export type SixScreenWorkflowOperationReceiptLookupResult =
  | {
    outcome: "committed";
    record: SixScreenWorkflowStoreRecord;
    receipt: SixScreenWorkflowOperationReplay;
    result: unknown;
  }
  | {
    outcome: "unknown_or_expired";
    record: SixScreenWorkflowStoreRecord;
  }
  | {
    outcome: "conflict";
    record: SixScreenWorkflowStoreRecord;
    committedOperationKind: string;
    committedInputFingerprint: string;
  }
  | { outcome: "unauthorized" }
  | { outcome: "not_found" };

export type SixScreenWorkflowMutationPlan = {
  state: SixScreenWorkflowState;
  result: unknown;
};

/** Deterministic test/development backend; production uses Durable Object storage. */
export class InMemorySixScreenWorkflowStorage
  implements SixScreenWorkflowStorage {
  readonly values = new Map<string, unknown>();

  async get(key: string) {
    return structuredClone(this.values.get(key));
  }

  async put(key: string, value: unknown) {
    this.values.set(key, structuredClone(value));
  }

  async delete(key: string) {
    return this.values.delete(key);
  }

  async list(input: { prefix: string; limit?: number }) {
    return new Map(
      [...this.values.entries()]
        .filter(([key]) => key.startsWith(input.prefix))
        .sort(([left], [right]) => left.localeCompare(right))
        .slice(0, input.limit),
    );
  }

  async transaction<T>(callback: (
    transaction: SixScreenWorkflowStorageTransaction,
  ) => Promise<T>) {
    return callback(this);
  }
}

function recordKey(runId: string) {
  return `${RECORD_PREFIX}${runId}`;
}

function optionalAnalysisArchiveKey(runId: string, stateFingerprint: string) {
  return `${OPTIONAL_ANALYSIS_ARCHIVE_PREFIX}${runId}:${stateFingerprint}`;
}

export function sixScreenWorkflowStoreParentRecordKey(runId: string) {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new Error("Six-screen parent run id is invalid.");
  }
  return recordKey(runId);
}

export function sixScreenWorkflowStoreParentRecordMatches(
  value: unknown,
  expected: SixScreenWorkflowStoreParentGuard,
) {
  try {
    if (
      expected.parentKind !== "six-screen" ||
      !RUN_ID_PATTERN.test(expected.runId) ||
      !Number.isSafeInteger(expected.generation) || expected.generation < 0 ||
      !Number.isSafeInteger(expected.revision) || expected.revision < 0 ||
      !SIX_SCREEN_FINGERPRINT_PATTERN.test(expected.stateFingerprint) ||
      new Date(expected.expiresAt).toISOString() !== expected.expiresAt
    ) return false;
    const record = requireRecordEnvelope(value);
    requireCoreCollections(record.state);
    return record.runId === expected.runId &&
      record.generation === expected.generation &&
      record.state.revision === expected.revision &&
      record.stateFingerprint === expected.stateFingerprint &&
      record.expiresAt === expected.expiresAt;
  } catch {
    return false;
  }
}

function expiryKey(expiresAt: string, runId: string) {
  return `${EXPIRY_PREFIX}${expiresAt}:${runId}`;
}

function requireIso(value: unknown, label: string) {
  if (typeof value !== "string") throw new Error(`${label} must be an ISO instant.`);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    throw new Error(`${label} must be a canonical ISO instant.`);
  }
  return value;
}

function requireOperationCoordinate(value: unknown, label: string) {
  if (typeof value !== "string" || !OPERATION_COORDINATE_PATTERN.test(value)) {
    throw new Error(`${label} is invalid.`);
  }
  return value;
}

function requireOperationReplays(
  value: unknown,
  currentRevision: number,
): asserts value is SixScreenWorkflowOperationReplay[] {
  if (!Array.isArray(value) ||
    value.length > SIX_SCREEN_WORKFLOW_MAX_OPERATION_REPLAYS) {
    throw new Error("Stored six-screen operation replay journal is invalid.");
  }
  const operationIds = new Set<string>();
  for (const [index, candidate] of value.entries()) {
    if (typeof candidate !== "object" || candidate === null ||
      Array.isArray(candidate)) {
      throw new Error(
        `Stored six-screen operation replay ${index} is invalid.`,
      );
    }
    const replay = candidate as Partial<SixScreenWorkflowOperationReplay>;
    requireOperationCoordinate(
      replay.operationId,
      `Stored six-screen operation replay ${index} id`,
    );
    requireOperationCoordinate(
      replay.operationKind,
      `Stored six-screen operation replay ${index} kind`,
    );
    if (operationIds.has(replay.operationId!)) {
      throw new Error("Stored six-screen operation replay ids are not unique.");
    }
    operationIds.add(replay.operationId!);
    if (typeof replay.inputFingerprint !== "string" ||
      !SIX_SCREEN_FINGERPRINT_PATTERN.test(replay.inputFingerprint) ||
      !Number.isSafeInteger(replay.committedRevision) ||
      replay.committedRevision! < 0 ||
      replay.committedRevision! > currentRevision ||
      !Object.hasOwn(replay, "result") ||
      replay.mutationOutcome !== undefined &&
        replay.mutationOutcome !== "changed" &&
        replay.mutationOutcome !== "unchanged") {
      throw new Error(
        `Stored six-screen operation replay ${index} coordinates are invalid.`,
      );
    }
    requireIso(
      replay.completedAt,
      `Stored six-screen operation replay ${index} completedAt`,
    );
  }
}

function requireRecordEnvelope(value: unknown): SixScreenWorkflowStoreRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Stored six-screen workflow record is invalid.");
  }
  const record = value as Partial<SixScreenWorkflowStoreRecord>;
  if (
    record.schemaVersion !== SIX_SCREEN_WORKFLOW_STORE_SCHEMA_VERSION ||
    typeof record.runId !== "string" || !RUN_ID_PATTERN.test(record.runId) ||
    typeof record.accessTokenSha256 !== "string" ||
    !SHA256_PATTERN.test(record.accessTokenSha256) ||
    typeof record.createInputFingerprint !== "string" ||
    !/^fnv1a64:[0-9a-f]{16}$/u.test(record.createInputFingerprint) ||
    typeof record.state !== "object" || record.state === null ||
    record.state.schemaVersion !== SIX_SCREEN_WORKFLOW_SCHEMA_VERSION ||
    record.state.runId !== record.runId ||
    !Number.isSafeInteger(record.state.revision) ||
    record.state.revision < 0 ||
    ![1, 2, 3, 4, 5, 6].includes(record.state.activeScreen) ||
    typeof record.stateFingerprint !== "string" ||
    !Number.isSafeInteger(record.generation) || (record.generation ?? -1) < 0 ||
    !Array.isArray(record.operationReplays)
  ) {
    throw new Error("Stored six-screen workflow record is invalid.");
  }
  requireIso(record.createdAt, "Stored workflow createdAt");
  requireIso(record.updatedAt, "Stored workflow updatedAt");
  requireIso(record.expiresAt, "Stored workflow expiresAt");
  if (record.stateFingerprint !== fingerprintSixScreenValue(record.state)) {
    throw new Error("Stored six-screen workflow fingerprint is invalid.");
  }
  requireOperationReplays(record.operationReplays, record.state.revision);
  const recovery = record.state.optionalAnalysisRecovery;
  if (recovery !== undefined &&
    (recovery.schemaVersion !== SIX_SCREEN_OPTIONAL_ANALYSIS_RECOVERY_VERSION ||
      !Array.isArray(recovery.blockedScreens) ||
      recovery.blockedScreens.some((screen) =>
        ![3, 4, 5, 6].includes(screen)) ||
      new Set(recovery.blockedScreens).size !==
        recovery.blockedScreens.length ||
      typeof recovery.isolatedCounts !== "object" ||
      recovery.isolatedCounts === null ||
      ["screen3", "screen4", "screen5", "screen6"].some((key) =>
        !Number.isSafeInteger(recovery.isolatedCounts[
          key as keyof typeof recovery.isolatedCounts]) ||
        recovery.isolatedCounts[
          key as keyof typeof recovery.isolatedCounts] < 0) ||
      ![3, 4, 5, 6].every((screen) =>
        recovery.blockedScreens.includes(screen as 3 | 4 | 5 | 6) ===
          (recovery.isolatedCounts[
            `screen${screen}` as keyof typeof recovery.isolatedCounts] > 0)))) {
    throw new Error("Stored optional analysis recovery status is invalid.");
  }
  if (record.optionalAnalysisIsolations !== undefined &&
    !Array.isArray(record.optionalAnalysisIsolations)) {
    throw new Error("Stored optional analysis isolation audit is invalid.");
  }
  for (const isolation of record.optionalAnalysisIsolations ?? []) {
    if (typeof isolation !== "object" || isolation === null ||
      isolation.schemaVersion !==
        SIX_SCREEN_OPTIONAL_ANALYSIS_ISOLATION_VERSION ||
      !SIX_SCREEN_FINGERPRINT_PATTERN.test(isolation.sourceStateFingerprint) ||
      isolation.archiveKey !== optionalAnalysisArchiveKey(
        record.runId, isolation.sourceStateFingerprint) ||
      !Array.isArray(isolation.items) || isolation.items.length === 0 ||
      isolation.items.some((item) =>
        typeof item !== "object" || item === null ||
        !["screen3Contextualizations", "screen4InterpretationAttempts",
          "studyFirstMechanismRuns", "screen6Personalizations"]
          .includes(item.collection) ||
        (item.index !== null &&
          (!Number.isSafeInteger(item.index) || item.index < 0)) ||
        item.safeReason !== "invalid_optional_analysis_record")) {
      throw new Error("Stored optional analysis isolation audit is invalid.");
    }
    requireIso(isolation.isolatedAt, "Optional analysis isolation time");
  }
  return record as SixScreenWorkflowStoreRecord;
}

function requireCoreCollections(state: SixScreenWorkflowState) {
  requirePolicyEventCardReviews(state);
  requireCausalDesigns(state);
  validateStudyDesignCollections(state);
  requireCoEventSearchMatrices(state);
  validateStudyFirstEventInvestigationCollections({
    investigations: state.studyFirstEventInvestigations,
    handoffs: state.studyFirstEventScreen5Handoffs,
  });
  validateStudyFirstMechanismInputs(state.studyFirstMechanismInputs ?? []);
  requireMechanismLiteraturePlans(state);
  requireScreen6Collections(state);
}

function requireOptionalAnalysisCollections(state: SixScreenWorkflowState) {
  requireScreen3Collections(state);
  validateScreen4InterpretationState(state);
  if (state.studyFirstMechanismRuns !== undefined &&
    !Array.isArray(state.studyFirstMechanismRuns)) {
    throw new Error("Stored Screen 5 mechanism-run history is invalid.");
  }
  validateStudyFirstMechanismRuns(state.studyFirstMechanismRuns ?? []);
  requireScreen6Personalizations(state);
}

function requireRecord(value: unknown): SixScreenWorkflowStoreRecord {
  const record = requireRecordEnvelope(value);
  requireCoreCollections(record.state);
  requireOptionalAnalysisCollections(record.state);
  return record;
}

type OptionalCollection = SixScreenOptionalAnalysisIsolation["items"][number]["collection"];

/**
 * This migration only handles independently validated model-analysis histories.
 * It never removes source evidence, researcher input, choices, or the allowance
 * ledger. A trial prefix preserves every valid earlier item and quarantines
 * only entries that cannot pass their own collection's full validator.
 */
function isolateInvalidOptionalAnalyses(
  original: SixScreenWorkflowState,
  isolatedAt: string,
) {
  const state = structuredClone(original);
  const mutable = state as unknown as Record<string, unknown>;
  const items: SixScreenOptionalAnalysisIsolation["items"] = [];
  const validators: Array<{
    collection: OptionalCollection;
    validate: (candidate: unknown[]) => void;
  }> = [
    { collection: "screen3Contextualizations",
      validate: (candidate) => requireScreen3Collections({
        ...state, screen3Contextualizations: candidate as
          NonNullable<SixScreenWorkflowState["screen3Contextualizations"]>,
      }) },
    { collection: "screen4InterpretationAttempts",
      validate: (candidate) => validateScreen4InterpretationState({
        ...state, screen4InterpretationAttempts: candidate as
          NonNullable<SixScreenWorkflowState["screen4InterpretationAttempts"]>,
      }) },
    { collection: "studyFirstMechanismRuns",
      validate: (candidate) => validateStudyFirstMechanismRuns(candidate as
        NonNullable<SixScreenWorkflowState["studyFirstMechanismRuns"]>) },
    { collection: "screen6Personalizations",
      validate: (candidate) => requireScreen6Personalizations({
        ...state, screen6Personalizations: candidate as
          NonNullable<SixScreenWorkflowState["screen6Personalizations"]>,
      }) },
  ];
  for (const { collection, validate } of validators) {
    const saved = mutable[collection];
    if (saved === undefined) continue;
    if (!Array.isArray(saved)) {
      items.push({ collection, index: null,
        safeReason: "invalid_optional_analysis_record" });
      mutable[collection] = [];
      continue;
    }
    const retained: unknown[] = [];
    for (const [index, item] of saved.entries()) {
      try {
        validate([...retained, item]);
        retained.push(item);
      } catch {
        items.push({ collection, index,
          safeReason: "invalid_optional_analysis_record" });
      }
    }
    mutable[collection] = retained;
  }
  if (items.length === 0) return null;
  const isolatedCounts = {
    screen3: state.optionalAnalysisRecovery?.isolatedCounts.screen3 ?? 0,
    screen4: state.optionalAnalysisRecovery?.isolatedCounts.screen4 ?? 0,
    screen5: state.optionalAnalysisRecovery?.isolatedCounts.screen5 ?? 0,
    screen6: state.optionalAnalysisRecovery?.isolatedCounts.screen6 ?? 0,
  };
  for (const { collection } of items) {
    const screen = collection === "screen3Contextualizations" ? "screen3" :
      collection === "screen4InterpretationAttempts" ? "screen4" :
        collection === "studyFirstMechanismRuns" ? "screen5" : "screen6";
    isolatedCounts[screen] += 1;
  }
  state.optionalAnalysisRecovery = {
    schemaVersion: SIX_SCREEN_OPTIONAL_ANALYSIS_RECOVERY_VERSION,
    blockedScreens: ([3, 4, 5, 6] as const).filter((screen) =>
      isolatedCounts[`screen${screen}`] > 0),
    isolatedCounts,
  };
  state.revision += 1;
  state.updatedAt = isolatedAt;
  requireCoreCollections(state);
  requireOptionalAnalysisCollections(state);
  return { state, items };
}

async function readAuthenticatedRecord(
  transaction: SixScreenWorkflowStorageTransaction,
  value: unknown,
  accessTokenSha256: string,
) {
  const original = requireRecordEnvelope(value);
  if (!constantTimeEqual(original.accessTokenSha256, accessTokenSha256)) {
    return { outcome: "unauthorized" as const };
  }
  // Root integrity and documentary/source records remain strict. A failure here
  // never starts a quarantine or produces a new apparently canonical study.
  requireCoreCollections(original.state);
  try {
    requireOptionalAnalysisCollections(original.state);
    return { outcome: "found" as const, record: original };
  } catch {
    const isolatedAt = new Date().toISOString();
    const isolated = isolateInvalidOptionalAnalyses(original.state, isolatedAt);
    if (!isolated) throw new Error(
      "Stored optional analysis is invalid outside the supported isolation scope.",
    );
    const archiveKey = optionalAnalysisArchiveKey(
      original.runId, original.stateFingerprint);
    const existingArchive = await transaction.get(archiveKey);
    if (existingArchive !== undefined &&
      !sameSixScreenValue((existingArchive as { original?: unknown }).original,
        original)) {
      throw new Error("An existing optional analysis archive does not match.");
    }
    const isolation: SixScreenOptionalAnalysisIsolation = {
      schemaVersion: SIX_SCREEN_OPTIONAL_ANALYSIS_ISOLATION_VERSION,
      sourceStateFingerprint: original.stateFingerprint,
      archiveKey,
      isolatedAt,
      items: isolated.items,
    };
    const migrated: SixScreenWorkflowStoreRecord = {
      ...original,
      state: isolated.state,
      stateFingerprint: fingerprintSixScreenValue(isolated.state),
      generation: original.generation + 1,
      updatedAt: isolatedAt,
      optionalAnalysisIsolations: [
        ...(original.optionalAnalysisIsolations ?? []), isolation,
      ],
    };
    requireRecord(migrated);
    if (existingArchive === undefined) {
      await transaction.put(archiveKey, {
        schemaVersion: SIX_SCREEN_OPTIONAL_ANALYSIS_ISOLATION_VERSION,
        sourceStateFingerprint: original.stateFingerprint,
        isolatedAt,
        original,
      });
    }
    await transaction.put(recordKey(original.runId), migrated);
    return { outcome: "found" as const, record: migrated };
  }
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
  return `sha256:${bytesToHex(digest)}`;
}

function constantTimeEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  let different = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    different |= (leftBytes[index % leftBytes.length] ?? 0) ^
      (rightBytes[index % rightBytes.length] ?? 0);
  }
  return different === 0;
}

function requireAuthentication(authentication: SixScreenWorkflowAuthentication) {
  if (!RUN_ID_PATTERN.test(authentication.runId)) {
    throw new Error("Six-screen workflow run id is invalid.");
  }
  if (!ACCESS_TOKEN_PATTERN.test(authentication.accessToken)) {
    throw new Error("Six-screen workflow access token is invalid.");
  }
}

function exactExpiryRecord(value: unknown, runId: string, expiresAt: string) {
  return typeof value === "object" && value !== null && !Array.isArray(value) &&
    (value as Record<string, unknown>).runId === runId &&
    (value as Record<string, unknown>).expiresAt === expiresAt;
}

function requirePolicyEventCardReviews(state: SixScreenWorkflowState) {
  if (state.policyEventCardReviews === undefined) return;
  if (!Array.isArray(state.policyEventCardReviews)) {
    throw new Error("Stored Policy Event Card review collection is invalid.");
  }
  validatePolicyEventCardReviewCollection(state.policyEventCardReviews);
}

function requireCausalDesigns(state: SixScreenWorkflowState) {
  if (
    state.causalDesignSets !== undefined &&
    !Array.isArray(state.causalDesignSets)
  ) throw new Error("Stored causal design set collection is invalid.");
  if (
    state.causalDesignDecisions !== undefined &&
    !Array.isArray(state.causalDesignDecisions)
  ) throw new Error("Stored causal design decision collection is invalid.");
  validateCausalDesignCollections({
    designSets: state.causalDesignSets ?? [],
    decisions: state.causalDesignDecisions ?? [],
  });
}

function requireCoEventSearchMatrices(state: SixScreenWorkflowState) {
  if (
    state.coEventSearchMatrices !== undefined &&
    !Array.isArray(state.coEventSearchMatrices)
  ) throw new Error("Stored Screen 4 search-matrix collection is invalid.");
  validateCoEventSearchCollections({
    matrices: state.coEventSearchMatrices ?? [],
    designSets: state.causalDesignSets ?? [],
    decisions: state.causalDesignDecisions ?? [],
  });
  for (const [value, label] of [
    [state.coEventExecutionPlans, "execution-plan"],
    [state.coEventSearchExecutions, "execution"],
    [state.coEventCandidates, "candidate"],
    [state.coEventDiscoveryLeads, "discovery-lead"],
    [state.coEventOccurrenceReviews, "occurrence-review"],
    [state.coEventDuplicateReviews, "duplicate-review"],
    [state.coEventRelationReviews, "relation-review"],
    [state.coEventPolicyLifecycleHandoffs, "policy-lifecycle-handoff"],
    [
      state.policyLifecycleStageDocumentAcquisitions,
      "policy-lifecycle-stage-document-acquisition",
    ],
    [
      state.policyLifecycleStageDispositions,
      "policy-lifecycle-stage-disposition",
    ],
    [
      state.policyLifecycleStageRevisionProposals,
      "policy-lifecycle-stage-revision-proposal",
    ],
    [
      state.policyLifecycleStageRevisionReviews,
      "policy-lifecycle-stage-revision-review",
    ],
  ] as const) {
    if (value !== undefined && !Array.isArray(value)) {
      throw new Error(`Stored Screen 4 ${label} collection is invalid.`);
    }
  }
  validateCoEventExecutionCollections({
    matrices: state.coEventSearchMatrices ?? [],
    plans: state.coEventExecutionPlans ?? [],
    executions: state.coEventSearchExecutions ?? [],
    candidates: state.coEventCandidates ?? [],
    leads: state.coEventDiscoveryLeads ?? [],
  });
  validateCoEventReviewCollections({
    candidates: state.coEventCandidates ?? [],
    occurrenceReviews: state.coEventOccurrenceReviews ?? [],
    duplicateReviews: state.coEventDuplicateReviews ?? [],
  });
  validateCoEventRelationReviewCollection({
    matrices: state.coEventSearchMatrices ?? [],
    designSets: state.causalDesignSets ?? [],
    designDecisions: state.causalDesignDecisions ?? [],
    candidates: state.coEventCandidates ?? [],
    occurrenceReviews: state.coEventOccurrenceReviews ?? [],
    relationReviews: state.coEventRelationReviews ?? [],
  });
  validateCoEventPolicyLifecycleHandoffCollection({
    candidates: state.coEventCandidates ?? [],
    occurrenceReviews: state.coEventOccurrenceReviews ?? [],
    duplicateReviews: state.coEventDuplicateReviews ?? [],
    executions: state.coEventSearchExecutions ?? [],
    policyEventCardReviews: state.policyEventCardReviews ?? [],
    handoffs: state.coEventPolicyLifecycleHandoffs ?? [],
  });
  validatePolicyLifecycleStageReviewCollections({
    candidates: state.coEventCandidates ?? [],
    handoffs: state.coEventPolicyLifecycleHandoffs ?? [],
    acquisitions: state.policyLifecycleStageDocumentAcquisitions ?? [],
    dispositions: state.policyLifecycleStageDispositions ?? [],
  });
  validatePolicyLifecycleStageRevisionCollections({
    handoffs: state.coEventPolicyLifecycleHandoffs ?? [],
    acquisitions: state.policyLifecycleStageDocumentAcquisitions ?? [],
    dispositions: state.policyLifecycleStageDispositions ?? [],
    proposals: state.policyLifecycleStageRevisionProposals ?? [],
    reviews: state.policyLifecycleStageRevisionReviews ?? [],
    eventCardReviews: state.policyEventCardReviews ?? [],
  });
}

function requireMechanismLiteraturePlans(state: SixScreenWorkflowState) {
  if (
    state.mechanismLiteraturePlans !== undefined &&
    !Array.isArray(state.mechanismLiteraturePlans)
  ) throw new Error("Stored Screen 5 literature-plan collection is invalid.");
  validateMechanismLiteraturePlanCollection({
    plans: state.mechanismLiteraturePlans ?? [],
    eventCardReviews: state.policyEventCardReviews ?? [],
    designSets: state.causalDesignSets ?? [],
    designDecisions: state.causalDesignDecisions ?? [],
    coEventMatrices: state.coEventSearchMatrices ?? [],
    coEventExecutions: state.coEventSearchExecutions ?? [],
    coEventRelationReviews: state.coEventRelationReviews ?? [],
  });
  for (const [value, label] of [
    [state.mechanismLiteratureExecutionPlans, "execution-plan"],
    [state.mechanismLiteratureExecutions, "execution"],
    [state.scholarlyMetadataRecords, "scholarly-metadata"],
    [state.scholarlyEvidencePackets, "evidence-packet"],
    [state.scholarlyDocumentAcquisitions, "document-acquisition"],
    [state.scholarlyPassagePackets, "passage-packet"],
    [state.scholarlyClaimExtractions, "claim-extraction"],
    [state.scholarlyClaimReviews, "claim-review"],
    [state.scholarlyClaimPackets, "claim-packet"],
    [state.mechanismSynthesisInputPackets, "synthesis-input-packet"],
  ] as const) {
    if (value !== undefined && !Array.isArray(value)) {
      throw new Error(`Stored Screen 5 ${label} collection is invalid.`);
    }
  }
  validateMechanismLiteratureExecutionCollections({
    literaturePlans: state.mechanismLiteraturePlans ?? [],
    executionPlans: state.mechanismLiteratureExecutionPlans ?? [],
    executions: state.mechanismLiteratureExecutions ?? [],
    records: state.scholarlyMetadataRecords ?? [],
    packets: state.scholarlyEvidencePackets ?? [],
  });
  validateScholarlyDocumentCollections({
    literaturePlans: state.mechanismLiteraturePlans ?? [],
    metadataExecutions: state.mechanismLiteratureExecutions ?? [],
    metadataRecords: state.scholarlyMetadataRecords ?? [],
    metadataPackets: state.scholarlyEvidencePackets ?? [],
    acquisitions: state.scholarlyDocumentAcquisitions ?? [],
    passagePackets: state.scholarlyPassagePackets ?? [],
  });
  validateScholarlyClaimCollections({
    acquisitions: state.scholarlyDocumentAcquisitions ?? [],
    passagePackets: state.scholarlyPassagePackets ?? [],
    extractions: state.scholarlyClaimExtractions ?? [],
    reviews: state.scholarlyClaimReviews ?? [],
    claimPackets: state.scholarlyClaimPackets ?? [],
  });
  validateMechanismSynthesisInputCollection({
    literaturePlans: state.mechanismLiteraturePlans ?? [],
    metadataPackets: state.scholarlyEvidencePackets ?? [],
    passagePackets: state.scholarlyPassagePackets ?? [],
    acquisitions: state.scholarlyDocumentAcquisitions ?? [],
    extractions: state.scholarlyClaimExtractions ?? [],
    reviews: state.scholarlyClaimReviews ?? [],
    claimPackets: state.scholarlyClaimPackets ?? [],
    synthesisInputPackets: state.mechanismSynthesisInputPackets ?? [],
  });
}

function storedKnownContextualizationRejection(record: {
  dispatchState?: "not_dispatched" | "dispatched" | "unknown";
  failureCode?: string | null;
  failureStage?: string | null;
}) {
  return record.dispatchState === "dispatched" &&
    knownObservedProviderHttpFailure(record);
}

function requireScreen3Collections(state: SixScreenWorkflowState) {
  const records = state.screen3Contextualizations ?? [];
  if (!Array.isArray(records) || records.length > 40 ||
    new Set(records.map(({ id }) => id)).size !== records.length ||
    new Set(records.map(({ reservationId }) => reservationId)).size !== records.length) {
    throw new Error("Stored Screen 3 contextualization history is invalid.");
  }
  for (const [index, record] of records.entries()) {
    const advice = (state.studyDesignAdvices ?? []).find((item) =>
      item.adviceFingerprint === record.adviceFingerprint);
    const prior = records.slice(0, index).filter((item) =>
      item.adviceFingerprint === record.adviceFingerprint &&
      (item.packetFingerprint ?? null) ===
        (record.packetFingerprint ?? null));
    const priorUnknown = prior.at(-1);
    const explicitUnknownRetry = record.retryUnknownAttemptId !== undefined &&
      record.retryUnknownAttemptId === priorUnknown?.id &&
      priorUnknown?.status === "outcome_unknown" && priorUnknown.receipt === null &&
      Boolean(record.claimOperationId) && record.claimOperationId !== priorUnknown.claimOperationId;
    if (!advice || !/^screen3-critique-[0-9a-f]{16}(?:-a\d{1,2})?$/u.test(record.id) ||
      !SIX_SCREEN_FINGERPRINT_PATTERN.test(record.adviceFingerprint) ||
      (record.attemptOrdinal !== undefined &&
        !SIX_SCREEN_FINGERPRINT_PATTERN.test(record.packetFingerprint ?? "")) ||
      (record.packetFingerprint !== undefined &&
        !SIX_SCREEN_FINGERPRINT_PATTERN.test(record.packetFingerprint)) ||
      !/^screen3-contextualization-[0-9a-f]{16}(?:-a\d{1,2})?$/u.test(record.reservationId) ||
      !["pending", "receipt_saved", "validation_failed", "completed", "failed", "outcome_unknown"].includes(record.status) ||
      (record.attemptOrdinal !== undefined &&
        (!Number.isSafeInteger(record.attemptOrdinal) ||
          record.attemptOrdinal !== prior.length + 1)) ||
      (record.claimOperationId !== undefined &&
        record.claimOperationId !== null &&
        (typeof record.claimOperationId !== "string" ||
          record.claimOperationId.length < 1 ||
          record.claimOperationId.length > 200)) ||
      (record.retryUnknownAttemptId !== undefined && !explicitUnknownRetry) ||
      (prior.length > 0 && !explicitUnknownRetry &&
        (prior.at(-1)?.status !== "failed" ||
          prior.at(-1)?.receipt !== null ||
          (prior.at(-1)?.dispatchState !== "not_dispatched" &&
            !storedKnownContextualizationRejection(prior.at(-1)!)))) ||
      (record.dispatchState !== undefined &&
        !["not_dispatched", "dispatched", "unknown"].includes(record.dispatchState)) ||
      (record.failureCode !== undefined && record.failureCode !== null &&
        !/^[a-z][a-z0-9_]{0,79}$/u.test(record.failureCode)) ||
      (record.failureStage !== undefined && record.failureStage !== null &&
        !["local_configuration", "admission", "network",
          "response_headers", "response_body", "model_output",
          "persistence", "projection"].includes(record.failureStage)) ||
      (record.status === "completed" && (!record.receipt || !record.supplement)) ||
      (["receipt_saved", "validation_failed"].includes(record.status) && !record.receipt) ||
      (record.status === "outcome_unknown" && record.receipt !== null) ||
      (record.receipt !== null && record.status === "pending") ||
      (record.error !== null && (typeof record.error !== "string" ||
        record.error.length > 400)) ||
      (!["failed", "validation_failed", "outcome_unknown"].includes(record.status) && record.error !== null)) {
      throw new Error("Stored Screen 3 contextualization record is invalid.");
    }
    requireIso(record.updatedAt, "Screen 3 contextualization updatedAt");
    if (record.receipt) validateScreen5MechanismProviderReceipt(record.receipt);
    if (record.status === "completed") {
      validateScreen3ContextualCritique(record.supplement, advice);
    }
  }
}

function requireScreen6Personalizations(state: SixScreenWorkflowState) {
  const personalized = state.screen6Personalizations ?? [];
  if (!Array.isArray(personalized) || personalized.length > 40 ||
    new Set(personalized.map(({ id }) => id)).size !== personalized.length ||
    new Set(personalized.map(({ reservationId }) => reservationId)).size !== personalized.length) {
    throw new Error("Stored Screen 6 personalization history is invalid.");
  }
  const currentPlan = createScreen6CurrentPlan(state);
  const compatibleInputFingerprints = new Set(
    screen6CompatibleInputFingerprints(currentPlan),
  );
  for (const [index, entry] of personalized.entries()) {
    const prior = personalized.slice(0, index).filter((item) =>
      item.inputFingerprint === entry.inputFingerprint);
    if (!/^screen6-plan-[0-9a-f]{16}(?:-a\d{1,2})?$/u.test(entry.id) ||
      !SIX_SCREEN_FINGERPRINT_PATTERN.test(entry.inputFingerprint) ||
      !/^screen6-contextualization-[0-9a-f]{16}(?:-a\d{1,2})?$/u.test(entry.reservationId) ||
      !["pending", "receipt_saved", "validation_failed", "completed", "failed", "outcome_unknown"].includes(entry.status) ||
      (entry.attemptOrdinal !== undefined &&
        (!Number.isSafeInteger(entry.attemptOrdinal) ||
          entry.attemptOrdinal !== prior.length + 1)) ||
      (entry.claimOperationId !== undefined &&
        entry.claimOperationId !== null &&
        (typeof entry.claimOperationId !== "string" ||
          entry.claimOperationId.length < 1 ||
          entry.claimOperationId.length > 200)) ||
      (prior.length > 0 &&
        (prior.at(-1)?.status !== "failed" ||
          prior.at(-1)?.receipt !== null ||
          (prior.at(-1)?.dispatchState !== "not_dispatched" &&
            !storedKnownContextualizationRejection(prior.at(-1)!)))) ||
      (entry.dispatchState !== undefined &&
        !["not_dispatched", "dispatched", "unknown"].includes(entry.dispatchState)) ||
      (entry.failureCode !== undefined && entry.failureCode !== null &&
        !/^[a-z][a-z0-9_]{0,79}$/u.test(entry.failureCode)) ||
      (entry.failureStage !== undefined && entry.failureStage !== null &&
        !["local_configuration", "admission", "network",
          "response_headers", "response_body", "model_output",
          "persistence", "projection"].includes(entry.failureStage)) ||
      (entry.status === "completed" && (!entry.receipt || !entry.supplement)) ||
      (entry.status !== "completed" && entry.supplement !== null) ||
      (["receipt_saved", "validation_failed"].includes(entry.status) && !entry.receipt) ||
      (entry.status === "outcome_unknown" && entry.receipt !== null) ||
      (entry.receipt !== null && entry.status === "pending") ||
      (entry.error !== null && (typeof entry.error !== "string" || entry.error.length > 400)) ||
      (!["failed", "validation_failed", "outcome_unknown"].includes(entry.status) && entry.error !== null)) {
      throw new Error("Stored Screen 6 personalization record is invalid.");
    }
    requireIso(entry.updatedAt, "Screen 6 personalization updatedAt");
    if (entry.receipt) validateScreen5MechanismProviderReceipt(entry.receipt);
    if (entry.status === "completed") {
      const receipt = entry.receipt;
      if (!receipt) {
        throw new Error("Stored Screen 6 personalization receipt is missing.");
      }
      const validate = compatibleInputFingerprints.has(entry.inputFingerprint)
        ? (value: unknown) => validateScreen6Contextualization(
          value, currentPlan)
        : validateScreen6ContextualizationShape;
      const supplement = validate(entry.supplement);
      let fromReceipt: ReturnType<typeof validate>;
      try {
        fromReceipt = validate(JSON.parse(receipt.finalContent));
      } catch {
        throw new Error(
          "Stored Screen 6 personalization receipt content is invalid.",
        );
      }
      if (!sameSixScreenValue(supplement, fromReceipt) ||
        receipt.wireFingerprint !== null &&
        receipt.wireFingerprint !== fingerprintSixScreenValue(fromReceipt)) {
        throw new Error(
          "Stored Screen 6 personalization differs from its receipt.",
        );
      }
    }
  }
}

function requireScreen6Collections(state: SixScreenWorkflowState) {
  if (
    state.screen6UncertaintyProfiles !== undefined &&
    !Array.isArray(state.screen6UncertaintyProfiles)
  ) throw new Error("Stored Screen 6 uncertainty-profile collection is invalid.");
  if (
    state.screen6DiagnosticPlans !== undefined &&
    !Array.isArray(state.screen6DiagnosticPlans)
  ) throw new Error("Stored Screen 6 diagnostic-plan collection is invalid.");
  if (
    state.screen6DiagnosticResults !== undefined &&
    !Array.isArray(state.screen6DiagnosticResults)
  ) throw new Error("Stored Screen 6 diagnostic-result collection is invalid.");
  if (
    state.screen6DiagnosticResultReviews !== undefined &&
    !Array.isArray(state.screen6DiagnosticResultReviews)
  ) throw new Error("Stored Screen 6 diagnostic-result review collection is invalid.");
  if (
    state.screen6ConditionalClaimBoundaries !== undefined &&
    !Array.isArray(state.screen6ConditionalClaimBoundaries)
  ) throw new Error("Stored Screen 6 conditional-claim collection is invalid.");
  if (
    state.screen6ResearchPlanningDispositions !== undefined &&
    !Array.isArray(state.screen6ResearchPlanningDispositions)
  ) throw new Error("Stored Screen 6 research-disposition collection is invalid.");
  if (
    state.screen6ResearchExports !== undefined &&
    !Array.isArray(state.screen6ResearchExports)
  ) throw new Error("Stored Screen 6 research-export collection is invalid.");
  validateScreen6UncertaintyProfileCollection({
    profiles: state.screen6UncertaintyProfiles ?? [],
    eventCardReviews: state.policyEventCardReviews ?? [],
    designSets: state.causalDesignSets ?? [],
    designDecisions: state.causalDesignDecisions ?? [],
    coEventMatrices: state.coEventSearchMatrices ?? [],
    coEventExecutions: state.coEventSearchExecutions ?? [],
    coEventRelationReviews: state.coEventRelationReviews ?? [],
    mechanismLiteraturePlans: state.mechanismLiteraturePlans ?? [],
    mechanismSynthesisInputs: state.mechanismSynthesisInputPackets ?? [],
    mechanismReviews: state.mechanismReviews ?? [],
    predictionMatrices: state.predictionMatrices ?? [],
  });
  validateScreen6DiagnosticPlanCollection({
    plans: state.screen6DiagnosticPlans ?? [],
    profiles: state.screen6UncertaintyProfiles ?? [],
    designSets: state.causalDesignSets ?? [],
    designDecisions: state.causalDesignDecisions ?? [],
  });
  validateScreen6DiagnosticResultCollections({
    plans: state.screen6DiagnosticPlans ?? [],
    results: state.screen6DiagnosticResults ?? [],
    reviews: state.screen6DiagnosticResultReviews ?? [],
  });
  validateScreen6ClaimBoundaryCollections({
    profiles: state.screen6UncertaintyProfiles ?? [],
    plans: state.screen6DiagnosticPlans ?? [],
    results: state.screen6DiagnosticResults ?? [],
    reviews: state.screen6DiagnosticResultReviews ?? [],
    boundaries: state.screen6ConditionalClaimBoundaries ?? [],
    dispositions: state.screen6ResearchPlanningDispositions ?? [],
  });
  if (state.screen6ResearchExports?.length) {
    validateScreen6ResearchExportCollection(state);
  }
}

export class SixScreenWorkflowStore {
  constructor(private readonly storage: SixScreenWorkflowStorage) {}

  async create(input: {
    state: SixScreenWorkflowState;
    accessToken: string;
    createInputFingerprint: string;
    createdAt: string;
    expiresAt: string;
  }) {
    requireAuthentication({
      runId: input.state.runId,
      accessToken: input.accessToken,
    });
    requireCoreCollections(input.state);
    requireOptionalAnalysisCollections(input.state);
    requireIso(input.createdAt, "Six-screen workflow createdAt");
    requireIso(input.expiresAt, "Six-screen workflow expiresAt");
    const accessTokenSha256 = await sha256(input.accessToken);
    return this.storage.transaction(async (transaction) => {
      const key = recordKey(input.state.runId);
      const existingValue = await transaction.get(key);
      if (existingValue !== undefined) {
        const envelope = requireRecordEnvelope(existingValue);
        if (!constantTimeEqual(envelope.accessTokenSha256, accessTokenSha256) ||
          envelope.createInputFingerprint !== input.createInputFingerprint) {
          return { outcome: "conflict" as const };
        }
        const existing = await readAuthenticatedRecord(
          transaction, existingValue, accessTokenSha256);
        if (existing.outcome !== "found") throw new Error(
          "Authenticated workflow replay could not be read.",
        );
        return { outcome: "replayed" as const, record: existing.record };
      }
      const record: SixScreenWorkflowStoreRecord = {
        schemaVersion: SIX_SCREEN_WORKFLOW_STORE_SCHEMA_VERSION,
        runId: input.state.runId,
        accessTokenSha256,
        createInputFingerprint: input.createInputFingerprint,
        state: structuredClone(input.state),
        stateFingerprint: fingerprintSixScreenValue(input.state),
        generation: 0,
        operationReplays: [],
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
        expiresAt: input.expiresAt,
      };
      await transaction.put(key, record);
      await transaction.put(expiryKey(input.expiresAt, input.state.runId), {
        runId: input.state.runId,
        expiresAt: input.expiresAt,
      });
      return { outcome: "created" as const, record };
    });
  }

  async read(authentication: SixScreenWorkflowAuthentication) {
    requireAuthentication(authentication);
    const token = await sha256(authentication.accessToken);
    return this.storage.transaction(async (transaction) => {
      const value = await transaction.get(recordKey(authentication.runId));
      return value === undefined
        ? { outcome: "not_found" as const }
        : readAuthenticatedRecord(transaction, value, token);
    });
  }

  /** Remove one authenticated workflow only after its dependent records have
   * been retired. The primary record is deleted last so a failed child
   * cleanup never presents a partially reset workspace as successful. */
  async retire(authentication: SixScreenWorkflowAuthentication) {
    requireAuthentication(authentication);
    const token = await sha256(authentication.accessToken);
    return this.storage.transaction(async (transaction) => {
      const key = recordKey(authentication.runId);
      const value = await transaction.get(key);
      if (value === undefined) return { outcome: "not_found" as const };
      const authenticated = await readAuthenticatedRecord(
        transaction,
        value,
        token,
      );
      if (authenticated.outcome !== "found") {
        return { outcome: "unauthorized" as const };
      }
      const record = authenticated.record;
      for (const isolation of record.optionalAnalysisIsolations ?? []) {
        await transaction.delete(isolation.archiveKey);
      }
      await transaction.delete(expiryKey(record.expiresAt, record.runId));
      await transaction.delete(key);
      return { outcome: "retired" as const };
    });
  }

  /**
   * Authenticated, read-only lookup for a bounded operation receipt. This path
   * intentionally does not validate or migrate optional analysis collections,
   * project public state, inspect ledgers/tasks, or perform any work besides a
   * direct canonical-record read. Callers must action-validate `result` before
   * applying it.
   */
  async readOperationReceipt(
    input: SixScreenWorkflowOperationReceiptLookupInput,
  ): Promise<SixScreenWorkflowOperationReceiptLookupResult> {
    requireAuthentication(input);
    requireOperationCoordinate(input.operationId, "Six-screen operation id");
    requireOperationCoordinate(
      input.operationKind,
      "Six-screen operation kind",
    );
    if (!SIX_SCREEN_FINGERPRINT_PATTERN.test(input.inputFingerprint)) {
      throw new Error("Six-screen operation input fingerprint is invalid.");
    }
    const token = await sha256(input.accessToken);
    const value = await this.storage.get(recordKey(input.runId));
    if (value === undefined) return { outcome: "not_found" };
    // Authenticate the opaque envelope before validating state, receipt, or
    // optional-record details. An unauthenticated caller must not learn that
    // a known run has a particular corruption or receipt shape.
    const candidateToken = typeof value === "object" && value !== null &&
        !Array.isArray(value) &&
        typeof (value as Record<string, unknown>).accessTokenSha256 ===
          "string" &&
        SHA256_PATTERN.test(
          (value as Record<string, unknown>).accessTokenSha256 as string,
        )
      ? (value as Record<string, unknown>).accessTokenSha256 as string
      : `sha256:${"0".repeat(64)}`;
    if (!constantTimeEqual(candidateToken, token)) {
      return { outcome: "unauthorized" };
    }
    const record = requireRecordEnvelope(value);
    if (record.runId !== input.runId) {
      throw new Error("Stored six-screen workflow run binding is invalid.");
    }
    // Root/documentary integrity stays strict, while malformed optional model
    // output cannot make receipt recovery write, migrate, or quarantine state.
    requireCoreCollections(record.state);
    const receipt = record.operationReplays.find(
      ({ operationId }) => operationId === input.operationId,
    );
    if (!receipt) return { outcome: "unknown_or_expired", record };
    if (receipt.operationKind !== input.operationKind ||
      receipt.inputFingerprint !== input.inputFingerprint) {
      return {
        outcome: "conflict",
        record,
        committedOperationKind: receipt.operationKind,
        committedInputFingerprint: receipt.inputFingerprint,
      };
    }
    const privateReceipt = structuredClone(receipt);
    return {
      outcome: "committed",
      record,
      receipt: privateReceipt,
      result: structuredClone(privateReceipt.result),
    };
  }

  /** Authenticated private recovery access; no model call or automatic replay. */
  async readIsolationArchive(
    authentication: SixScreenWorkflowAuthentication,
    sourceStateFingerprint: string,
  ) {
    if (!SIX_SCREEN_FINGERPRINT_PATTERN.test(sourceStateFingerprint)) {
      throw new Error("Optional analysis archive reference is invalid.");
    }
    const read = await this.read(authentication);
    if (read.outcome !== "found") return { outcome: read.outcome };
    const entry = read.record.optionalAnalysisIsolations?.find((item) =>
      item.sourceStateFingerprint === sourceStateFingerprint);
    if (!entry) return { outcome: "not_found" as const };
    const archive = await this.storage.get(entry.archiveKey) as
      { original?: unknown; sourceStateFingerprint?: unknown } | undefined;
    if (archive?.sourceStateFingerprint !== sourceStateFingerprint) {
      throw new Error("Optional analysis archive binding is invalid.");
    }
    const original = requireRecordEnvelope(archive.original);
    if (original.runId !== read.record.runId ||
      original.stateFingerprint !== sourceStateFingerprint ||
      original.accessTokenSha256 !== read.record.accessTokenSha256) {
      throw new Error("Optional analysis archive identity is invalid.");
    }
    requireCoreCollections(original.state);
    return { outcome: "found" as const, original };
  }

  async readTrusted(runId: string) {
    if (!RUN_ID_PATTERN.test(runId)) {
      throw new Error("Six-screen trusted read run id is invalid.");
    }
    const value = await this.storage.get(recordKey(runId));
    return value === undefined
      ? { outcome: "not_found" as const }
      : { outcome: "found" as const, record: requireRecord(value) };
  }

  async mutate(
    input: SixScreenWorkflowMutationInput,
    updater: (state: SixScreenWorkflowState) => SixScreenWorkflowMutationPlan,
  ) {
    requireAuthentication(input);
    requireIso(input.updatedAt, "Six-screen workflow mutation time");
    requireOperationCoordinate(input.operationId, "Six-screen operation id");
    requireOperationCoordinate(input.operationKind, "Six-screen operation kind");
    if (!SIX_SCREEN_FINGERPRINT_PATTERN.test(input.inputFingerprint)) {
      throw new Error("Six-screen operation input fingerprint is invalid.");
    }
    const token = await sha256(input.accessToken);
    return this.storage.transaction(async (transaction) => {
      const key = recordKey(input.runId);
      const value = await transaction.get(key);
      if (value === undefined) return { outcome: "not_found" as const };
      const authenticated = await readAuthenticatedRecord(
        transaction, value, token);
      if (authenticated.outcome !== "found") {
        return { outcome: "unauthorized" as const };
      }
      const current = authenticated.record;
      const replay = current.operationReplays.find(
        ({ operationId }) => operationId === input.operationId,
      );
      if (replay) {
        if (
          replay.operationKind !== input.operationKind ||
          replay.inputFingerprint !== input.inputFingerprint
        ) {
          return { outcome: "operation_conflict" as const, record: current };
        }
        return {
          outcome: "replayed" as const,
          record: current,
          result: structuredClone(replay.result),
        };
      }
      if (current.state.revision !== input.expectedRevision) {
        return { outcome: "stale" as const, record: current };
      }
      const plan = updater(structuredClone(current.state));
      if (plan.state.runId !== current.runId) {
        throw new Error("Six-screen mutation cannot change its workflow run.");
      }
      const unchanged = sameSixScreenValue(plan.state, current.state);
      if (plan.state.revision < current.state.revision) {
        throw new Error("Six-screen mutation cannot move a workflow revision backward.");
      }
      if (plan.state.revision === current.state.revision && !unchanged) {
        throw new Error(
          "Six-screen mutation changed canonical state without advancing its scientific revision.",
        );
      }
      requireCoreCollections(plan.state);
      requireOptionalAnalysisCollections(plan.state);
      const replayEntry: SixScreenWorkflowOperationReplay = {
        operationId: input.operationId,
        operationKind: input.operationKind,
        inputFingerprint: input.inputFingerprint,
        committedRevision: plan.state.revision,
        mutationOutcome: unchanged ? "unchanged" : "changed",
        result: compactLegacyPublicProjectionReplayResult(
          plan.result,
          current.runId,
          input.operationKind,
        ),
        completedAt: input.updatedAt,
      };
      const compactedReplays = current.operationReplays.map((entry) => ({
        ...entry,
        result: compactLegacyPublicProjectionReplayResult(
          entry.result,
          current.runId,
          entry.operationKind,
        ),
      }));
      const record: SixScreenWorkflowStoreRecord = {
        ...current,
        state: structuredClone(plan.state),
        stateFingerprint: fingerprintSixScreenValue(plan.state),
        generation: current.generation + 1,
        operationReplays: [...compactedReplays, replayEntry].slice(
          -SIX_SCREEN_WORKFLOW_MAX_OPERATION_REPLAYS,
        ),
        updatedAt: input.updatedAt,
      };
      await transaction.put(key, record);
      return {
        outcome: unchanged ? "unchanged" as const : "updated" as const,
        record,
        result: structuredClone(replayEntry.result),
      };
    });
  }

  async cleanupExpired(now: string) {
    requireIso(now, "Six-screen cleanup time");
    const entries = await this.storage.list({
      prefix: EXPIRY_PREFIX,
      limit: SIX_SCREEN_WORKFLOW_CLEANUP_BATCH_SIZE,
    });
    let deleted = 0;
    for (const [key, marker] of entries) {
      const suffix = key.slice(EXPIRY_PREFIX.length);
      const separator = suffix.lastIndexOf(":sa6r_");
      if (separator < 0) continue;
      const expiresAt = suffix.slice(0, separator);
      const runId = suffix.slice(separator + 1);
      if (expiresAt > now && expiresAt !== CLEANUP_RETRY_AT) continue;
      await this.storage.transaction(async (transaction) => {
        const currentMarker = await transaction.get(key);
        if (!exactExpiryRecord(currentMarker, runId, expiresAt)) return;
        const value = await transaction.get(recordKey(runId));
        if (value !== undefined) {
          const record = requireRecord(value);
          if (record.expiresAt > now) {
            await transaction.delete(key);
            await transaction.put(expiryKey(record.expiresAt, runId), {
              runId,
              expiresAt: record.expiresAt,
            });
            return;
          }
          await transaction.delete(recordKey(runId));
          for (const isolation of record.optionalAnalysisIsolations ?? []) {
            await transaction.delete(isolation.archiveKey);
          }
        }
        await transaction.delete(key);
        deleted += 1;
      });
    }
    return { deleted, batchLimitReached: entries.size >= SIX_SCREEN_WORKFLOW_CLEANUP_BATCH_SIZE };
  }

  async nextExpirationAt() {
    const entries = await this.storage.list({ prefix: EXPIRY_PREFIX, limit: 1 });
    const first = entries.keys().next().value as string | undefined;
    if (!first) return null;
    const suffix = first.slice(EXPIRY_PREFIX.length);
    const separator = suffix.lastIndexOf(":sa6r_");
    return separator < 0 ? CLEANUP_RETRY_AT : suffix.slice(0, separator);
  }
}
