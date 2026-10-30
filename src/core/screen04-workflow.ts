import { serializeDeterministicJson } from "./screen02-deterministic-json";
import { fingerprintScreen03Value } from "./screen03-workflow";
import {
  SCREEN_04_STAGE_A_LIMITS,
  fingerprintScreen04Headers,
  type Screen04ExactMappings,
  type Screen04PublicFeasibilityResult,
} from "./screen04-feasibility";
import type { Screen04AuditPublicResult } from "./screen04-audit";
import {
  SCREEN_04_EVENT_CARD_BINDING_SCHEMA_VERSION,
  screen04EventCardBindingIsCurrent,
  type Screen04EventCardBinding,
} from "./screen04-event-card-binding";
import {
  createScreen04SampleProfile,
  fingerprintScreen04StoredAssessmentResult,
  invalidateScreen04DatasetAssessment,
  rebindScreen04SampleProfile,
  recordScreen04DatasetAssessment,
  requireScreen04SampleProfile,
  saveScreen04ActiveSampleProfile,
  screen04DatasetAssessmentReadiness,
  screen04DatasetReadiness,
  screen04SampleProfileBindingIsCurrent,
  switchScreen04SampleProfileMode,
  updateScreen04DatasetSampleProfile,
  updateScreen04NodataSampleProfile,
  type Screen04DatasetProfilePatch,
  type Screen04Mode,
  type Screen04NodataProfilePatch,
  type Screen04SampleProfile,
} from "./screen04-sample-profile";
import type { Screen04ScientificAssessmentResult } from "./screen04-scientific-assessment";
import { SCREEN_04_SCIENTIFIC_ASSESSMENT_SCHEMA_VERSION } from "./screen04-scientific-schema";

export const SCREEN_04_WORKFLOW_SCHEMA_VERSION =
  "screen-04-workflow-state-v3" as const;
export const SCREEN_04_RELEASE_LABEL = "v0.4.03" as const;
export const SCREEN_04_V0401_WORKFLOW_SCHEMA_VERSION =
  "screen-04-workflow-state-v2" as const;
export const SCREEN_04_V0401_RELEASE_LABEL = "v0.4.01" as const;
export const SCREEN_04_LEGACY_WORKFLOW_SCHEMA_VERSION =
  "screen-04-workflow-state-v1" as const;
export const SCREEN_04_LEGACY_RELEASE_LABEL = "v0.4.00" as const;
export const SCREEN_04_ASSESSMENT_INPUT_SCHEMA_VERSION =
  "screen-04-assessment-input-v1" as const;

export type Screen04WorkflowStatus =
  | "no-file"
  | "file-loaded"
  | "mapping-incomplete"
  | "ready-to-assess"
  | "assessing"
  | "assessment-complete"
  | "assessment-stale"
  | "assessment-error"
  // Live orthogonal states for nodata, downstream handoff, and a changed card.
  | "describing-sample"
  | "ready-to-continue"
  | "stale";

type Screen04HistoricalWorkflowStatus =
  | "awaiting-upload"
  | "mapping"
  | "ready-to-calculate"
  | "calculated"
  | "failed";

export type Screen04OpaqueUploadReference = {
  schemaVersion: "screen-04-upload-reference-v1";
  opaqueFileRef: string;
  csvFingerprint: string;
  headerFingerprint: string;
  byteLength: number;
  headerCount: number;
  uploadedAt: string;
  expiresAt: string;
};

export type Screen04WorkflowMappings = {
  structure: Screen04ExactMappings;
  verifiedTimelineProposalId: string;
  optional: {
    organizationName: string | null;
    existingPostPeriod: string | null;
    existingUnitPeriodTreatment: string | null;
  };
  eventRequirements: Readonly<Record<string, string | null>>;
  exposureRule?: {
    kind: "categorical-equals";
    requirementId: string;
    exactValue: string;
  };
  exposureRules?: {
    combination: "all" | "any";
    requirements: Readonly<Record<string, {
      kind: "categorical-equals";
      exactValue: string;
    }>>;
  };
};

export type Screen04StoredExportReference = {
  opaqueFileRef: string;
  fingerprint: string;
  filename: string;
  expiresAt: string;
};

export type Screen04CalculationRecord = {
  calculatedAt: string;
  csvFingerprint: string;
  eventCardFingerprint: string;
  resultFingerprint: string;
  publicResult: Screen04PublicFeasibilityResult | Screen04AuditPublicResult;
  /** Legacy v0.4.00 restoration only; current reader workflows omit exports. */
  exports?: {
    auditedExposure: Screen04StoredExportReference;
    affectedCases: Screen04StoredExportReference;
    auditReport: Screen04StoredExportReference;
  };
};

export type Screen04WorkflowFailure = {
  stage: "upload" | "header" | "mapping" | "validation" | "calculation" | "export";
  code: string;
  safeMessage: string;
  failedAt: string;
};

export type Screen04WorkflowState = {
  schemaVersion: typeof SCREEN_04_WORKFLOW_SCHEMA_VERSION;
  releaseLabel: typeof SCREEN_04_RELEASE_LABEL;
  status: Screen04WorkflowStatus;
  runId: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  eventCardBinding: Screen04EventCardBinding;
  sampleProfile: Screen04SampleProfile;
  upload: Screen04OpaqueUploadReference | null;
  mappings: Screen04WorkflowMappings | null;
  calculation: Screen04CalculationRecord | null;
  failure: Screen04WorkflowFailure | null;
  stale: {
    isStale: boolean;
    detectedAt: string | null;
    priorEventCardFingerprint: string | null;
    currentEventCardFingerprint: string | null;
    reason: string | null;
  };
  integrity: {
    stateFingerprint: string;
  };
};

function fail(message: string): never {
  throw new Error(message);
}

function clone<T>(value: T): T {
  return JSON.parse(serializeDeterministicJson(value)) as T;
}

function utc(value: string, label: string): void {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) {
    fail(`${label} must be an exact UTC timestamp.`);
  }
}

function bounded(value: string, label: string, maximum = 300): void {
  if (value.length < 1 || value.length > maximum || value.trim() !== value) {
    fail(`${label} is invalid.`);
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

function bindingFingerprintInput(binding: Screen04EventCardBinding) {
  const { bindingFingerprint: _fingerprint, ...input } = binding;
  return input;
}

function validateBinding(binding: Screen04EventCardBinding): void {
  if (
    binding.schemaVersion !== SCREEN_04_EVENT_CARD_BINDING_SCHEMA_VERSION ||
    binding.bindingFingerprint !==
      fingerprintScreen03Value(bindingFingerprintInput(binding))
  ) {
    fail("Screen 4 Event Card binding failed validation.");
  }
}

function stateFingerprintInput(state: Screen04WorkflowState) {
  const { integrity: _integrity, ...input } = state;
  return input;
}

function assessmentBindingInput(binding: Screen04EventCardBinding) {
  const {
    bindingFingerprint: _bindingFingerprint,
    screen03,
    ...stableBinding
  } = binding;
  return {
    ...stableBinding,
    // A context-only Screen 3 refresh changes stateFingerprint but not any
    // scientific input. The locked run and Event Card coordinates remain.
    screen03: { runId: screen03.runId },
  };
}

function assessmentInputFingerprint(
  state: Screen04WorkflowState,
): string {
  if (state.upload === null) {
    fail("A dataset assessment requires a current CSV upload.");
  }
  const assignmentCrosswalkStatus =
    state.sampleProfile.dataset.assignmentCrosswalkStatus ?? "unknown";
  const withinAggregateExposure =
    state.sampleProfile.dataset.withinAggregateExposure ?? "unknown";
  const {
    assignmentLowerLevelIdentifier,
    assignmentAggregateIdentifier,
    ...legacyFieldMappings
  } = state.sampleProfile.dataset.fieldMappings;
  const fieldMappings = assignmentLowerLevelIdentifier === null &&
      assignmentAggregateIdentifier === null
    ? legacyFieldMappings
    : state.sampleProfile.dataset.fieldMappings;
  const combinedExposureScenario =
    state.sampleProfile.dataset.combinedExposureScenario ?? null;
  return fingerprintScreen03Value({
    schemaVersion: SCREEN_04_ASSESSMENT_INPUT_SCHEMA_VERSION,
    binding: assessmentBindingInput(state.eventCardBinding),
    csvFingerprint: state.upload.csvFingerprint,
    workflowMappings: state.mappings,
    dataset: {
      description: state.sampleProfile.dataset.description,
      fieldMappings,
      exposureMapping: state.sampleProfile.dataset.exposureMapping,
      ...(combinedExposureScenario === null
        ? {}
        : { combinedExposureScenario }),
      ...(assignmentCrosswalkStatus === "unknown" &&
          withinAggregateExposure === "unknown"
        ? {}
        : {
            assignmentCrosswalkStatus,
            withinAggregateExposure,
          }),
    },
  });
}

function withIntegrity(
  input: Omit<Screen04WorkflowState, "integrity">,
): Screen04WorkflowState {
  const provisional = {
    ...clone(input),
    integrity: { stateFingerprint: "fnv1a64:0000000000000000" },
  } as Screen04WorkflowState;
  provisional.integrity.stateFingerprint = fingerprintScreen03Value(
    stateFingerprintInput(provisional),
  );
  return requireScreen04WorkflowState(provisional);
}

function exactHeader(headers: readonly string[], value: string, label: string): void {
  if (!headers.includes(value)) {
    fail(`${label} must match an exact case-sensitive CSV header.`);
  }
}

function validateUpload(upload: Screen04OpaqueUploadReference): void {
  if (upload.schemaVersion !== "screen-04-upload-reference-v1") {
    fail("Screen 4 upload reference version is invalid.");
  }
  bounded(upload.opaqueFileRef, "Opaque file reference", 500);
  bounded(upload.csvFingerprint, "CSV fingerprint", 100);
  bounded(upload.headerFingerprint, "Header fingerprint", 100);
  utc(upload.uploadedAt, "Upload time");
  utc(upload.expiresAt, "Upload expiry");
  if (
    Date.parse(upload.expiresAt) <= Date.parse(upload.uploadedAt) ||
    upload.byteLength < 1 ||
    upload.byteLength > SCREEN_04_STAGE_A_LIMITS.maximumFileBytes ||
    upload.headerCount < 1 ||
    upload.headerCount > SCREEN_04_STAGE_A_LIMITS.maximumColumns
  ) {
    fail("Screen 4 upload metadata exceeds its bounded contract.");
  }
}

function validateMappings(
  mappings: Screen04WorkflowMappings,
  headers: readonly string[],
  binding: Screen04EventCardBinding,
): void {
  validatePersistedMappings(mappings, binding);
  exactHeader(headers, mappings.structure.unitIdentifier, "Unit identifier");
  exactHeader(headers, mappings.structure.year, "Time variable");
  exactHeader(headers, mappings.structure.treatmentGroup, "Treatment-group variable");
  if (
    !Number.isInteger(mappings.structure.researcherTreatmentYear) ||
    mappings.structure.treatedValue === mappings.structure.comparisonValue
  ) {
    fail("Screen 4 treatment mapping is invalid.");
  }
  for (const [label, value] of Object.entries(mappings.optional)) {
    if (value !== null) exactHeader(headers, value, label);
  }
  for (const [requirementId, value] of Object.entries(mappings.eventRequirements)) {
    bounded(requirementId, "Event requirement ID");
    if (value !== null) exactHeader(headers, value, `Event requirement ${requirementId}`);
  }
}

function validatePersistedMappings(
  mappings: Screen04WorkflowMappings,
  binding: Screen04EventCardBinding,
): void {
  bounded(mappings.structure.unitIdentifier, "Unit identifier mapping");
  bounded(mappings.structure.year, "Time mapping");
  bounded(mappings.structure.treatmentGroup, "Treatment-group mapping");
  bounded(mappings.structure.treatedValue, "Treated value");
  bounded(mappings.structure.comparisonValue, "Comparison value");
  if (
    !Number.isInteger(mappings.structure.researcherTreatmentYear) ||
    mappings.structure.treatedValue === mappings.structure.comparisonValue
  ) {
    fail("Persisted Screen 4 treatment mapping is invalid.");
  }
  bounded(mappings.verifiedTimelineProposalId, "Verified timeline choice");
  if (
    !binding.verifiedTimeline.some(
      (entry) => entry.proposalId === mappings.verifiedTimelineProposalId,
    )
  ) {
    fail("The selected timeline entry is not in the locked Event Card.");
  }
  for (const value of Object.values(mappings.optional)) {
    if (value !== null) bounded(value, "Optional exact mapping");
  }
  for (const [requirementId, value] of Object.entries(mappings.eventRequirements)) {
    bounded(requirementId, "Event requirement ID");
    if (value !== null) bounded(value, "Event requirement mapping");
  }
  if (mappings.exposureRule !== undefined) {
    const rule = mappings.exposureRule;
    if (
      rule.kind !== "categorical-equals" ||
      !Object.hasOwn(mappings.eventRequirements, rule.requirementId) ||
      mappings.eventRequirements[rule.requirementId] === null ||
      rule.exactValue.length < 1 ||
      rule.exactValue.length > 300 ||
      /[\u0000-\u001f\u007f]/u.test(rule.exactValue)
    ) {
      fail("The persisted Screen 4 categorical exposure rule is invalid.");
    }
    bounded(rule.requirementId, "Categorical exposure requirement ID");
  }
  if (mappings.exposureRules !== undefined) {
    const rules = mappings.exposureRules;
    if (
      (rules.combination !== "all" && rules.combination !== "any") ||
      Object.keys(rules.requirements).length === 0
    ) {
      fail("The persisted Screen 4 exposure-rule group is invalid.");
    }
    for (const [requirementId, rule] of Object.entries(rules.requirements)) {
      if (
        rule.kind !== "categorical-equals" ||
        !Object.hasOwn(mappings.eventRequirements, requirementId) ||
        mappings.eventRequirements[requirementId] === null ||
        rule.exactValue.length < 1 ||
        rule.exactValue.length > 300 ||
        /[\u0000-\u001f\u007f]/u.test(rule.exactValue)
      ) {
        fail("A persisted Screen 4 exposure-rule choice is invalid.");
      }
      bounded(requirementId, "Exposure-rule requirement ID");
    }
  }
}

function validateExportReference(reference: Screen04StoredExportReference): void {
  bounded(reference.opaqueFileRef, "Export file reference", 500);
  bounded(reference.fingerprint, "Export fingerprint", 100);
  bounded(reference.filename, "Export filename", 300);
  utc(reference.expiresAt, "Export expiry");
}

function validateState(state: Screen04WorkflowState): void {
  if (
    state.schemaVersion !== SCREEN_04_WORKFLOW_SCHEMA_VERSION ||
    state.releaseLabel !== SCREEN_04_RELEASE_LABEL ||
    ![
      "no-file",
      "file-loaded",
      "mapping-incomplete",
      "ready-to-assess",
      "assessing",
      "assessment-complete",
      "assessment-stale",
      "assessment-error",
      "describing-sample",
      "ready-to-continue",
      "stale",
    ].includes(state.status)
  ) {
    fail("Screen 4 workflow root is invalid.");
  }
  bounded(state.runId, "Screen 4 run ID");
  if (!Number.isInteger(state.revision) || state.revision < 0) {
    fail("Screen 4 revision is invalid.");
  }
  utc(state.createdAt, "Screen 4 creation time");
  utc(state.updatedAt, "Screen 4 update time");
  validateBinding(state.eventCardBinding);
  requireScreen04SampleProfile(state.sampleProfile);
  if (
    !screen04SampleProfileBindingIsCurrent(
      state.sampleProfile,
      state.eventCardBinding,
    )
  ) {
    fail("Screen 4 sample profile does not match its Event Card binding.");
  }
  if (state.upload !== null) validateUpload(state.upload);
  if (state.mappings !== null) {
    if (state.upload === null) fail("Mappings require an upload reference.");
    // Full headers remain transient and are deliberately absent from state.
    validatePersistedMappings(state.mappings, state.eventCardBinding);
  }
  const assessment = state.sampleProfile.dataset.assessment;
  if (assessment?.status === "completed") {
    if (
      state.upload === null ||
      assessment.csvFingerprint !== state.upload.csvFingerprint ||
      assessment.assessmentInputFingerprint !==
        assessmentInputFingerprint(state)
    ) {
      fail("The persisted Screen 4 assessment is no longer current.");
    }
  }
  if (state.calculation !== null) {
    if (state.upload === null || state.mappings === null) {
      fail("A calculation requires an upload and mappings.");
    }
    utc(state.calculation.calculatedAt, "Calculation time");
    if (
      state.calculation.csvFingerprint !== state.upload.csvFingerprint ||
      state.calculation.eventCardFingerprint !==
        state.eventCardBinding.eventCard.fingerprint ||
      state.calculation.resultFingerprint !==
        state.calculation.publicResult.resultFingerprint
    ) {
      fail("Screen 4 calculation binding is invalid.");
    }
    if (state.calculation.exports !== undefined) {
      validateExportReference(state.calculation.exports.auditedExposure);
      validateExportReference(state.calculation.exports.affectedCases);
      validateExportReference(state.calculation.exports.auditReport);
    }
  }
  if (state.stale.isStale !== (state.status === "stale")) {
    fail("Screen 4 stale flag and status differ.");
  }
  if (state.status === "no-file" && state.upload !== null) {
    fail("No-file state cannot already contain an upload.");
  }
  if (["file-loaded", "mapping-incomplete", "ready-to-assess", "assessing",
    "assessment-complete", "assessment-stale", "assessment-error"].includes(
      state.status,
    ) && state.upload === null) {
    fail("Dataset assessment state requires an upload.");
  }
  if (state.status === "assessment-complete" && assessment?.status !== "completed") {
    fail("Assessment-complete state requires completed provenance.");
  }
  if (state.status === "assessment-stale" && assessment?.status !== "stale") {
    fail("Assessment-stale state requires stale provenance.");
  }
  if (state.status === "assessment-error" && state.failure === null) {
    fail("Assessment-error state requires a safe failure record.");
  }
  if (
    state.status === "describing-sample" &&
    state.sampleProfile.activeMode !== "nodata"
  ) {
    fail("Only nodata mode may use the describing-sample status.");
  }
  if (state.status === "ready-to-continue") {
    const active = state.sampleProfile.activeMode === "dataset"
      ? state.sampleProfile.dataset
      : state.sampleProfile.nodata;
    if (active.completion.status !== "saved") {
      fail("Ready-to-continue state requires a saved sample profile.");
    }
  }
  if (
    state.integrity.stateFingerprint !==
      fingerprintScreen03Value(stateFingerprintInput(state))
  ) {
    fail("Screen 4 state fingerprint is invalid.");
  }
}

function migrateLegacyBinding(value: unknown): Screen04EventCardBinding | null {
  try {
    if (!record(value) || value.schemaVersion !== "screen-03-to-screen-04-event-card-v1") {
      return null;
    }
    const legacy = clone(value);
    if (
      !record(legacy) ||
      typeof legacy.bindingFingerprint !== "string"
    ) return null;
    const { bindingFingerprint: legacyFingerprint, ...legacyInput } = legacy;
    if (legacyFingerprint !== fingerprintScreen03Value(legacyInput)) return null;
    const currentInput = {
      ...legacyInput,
      schemaVersion: SCREEN_04_EVENT_CARD_BINDING_SCHEMA_VERSION,
      // v1 did not carry consolidated reader-facing dimensions. Preserve its
      // exact claims internally, but do not guess a dimension during restore.
      exposureDimensions: [],
    };
    const current = {
      ...currentInput,
      bindingFingerprint: fingerprintScreen03Value(currentInput),
    } as unknown as Screen04EventCardBinding;
    validateBinding(current);
    return current;
  } catch {
    return null;
  }
}

function migrateLegacyWorkflowState(value: unknown): Screen04WorkflowState | null {
  try {
    if (
      !record(value) ||
      !exactKeys(value, [
        "schemaVersion",
        "releaseLabel",
        "status",
        "runId",
        "revision",
        "createdAt",
        "updatedAt",
        "eventCardBinding",
        "upload",
        "mappings",
        "calculation",
        "failure",
        "stale",
        "integrity",
      ]) ||
      value.schemaVersion !== SCREEN_04_LEGACY_WORKFLOW_SCHEMA_VERSION ||
      value.releaseLabel !== SCREEN_04_LEGACY_RELEASE_LABEL ||
      !record(value.integrity) ||
      typeof value.integrity.stateFingerprint !== "string"
    ) return null;
    const legacy = clone(value);
    if (!record(legacy) || !record(legacy.integrity)) return null;
    const legacyFingerprint = legacy.integrity.stateFingerprint;
    const { integrity: _legacyIntegrity, ...legacyFingerprintInput } = legacy;
    if (
      legacyFingerprint !== fingerprintScreen03Value(legacyFingerprintInput)
    ) return null;
    const binding = migrateLegacyBinding(legacy.eventCardBinding);
    if (!binding) return null;
    if (
      typeof legacy.createdAt !== "string" ||
      typeof legacy.updatedAt !== "string"
    ) return null;
    let sampleProfile = createScreen04SampleProfile(
      binding,
      legacy.createdAt,
    );
    const mappings = legacy.mappings as Screen04WorkflowMappings | null;
    if (mappings !== null) {
      const exposureFields = Object.fromEntries(
        Object.entries(mappings.eventRequirements).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      );
      sampleProfile = updateScreen04DatasetSampleProfile(sampleProfile, {
        description: {
          dataFrequency: "annual",
          researcherTreatmentYear:
            mappings.structure.researcherTreatmentYear,
        },
        fieldMappings: {
          unitIdentifier: mappings.structure.unitIdentifier,
          annualTime: mappings.structure.year,
          treatmentGroup: mappings.structure.treatmentGroup,
          treatedValue: mappings.structure.treatedValue,
          comparisonValue: mappings.structure.comparisonValue,
          organizationName: mappings.optional.organizationName,
          exposureFields,
        },
      }, legacy.updatedAt);
    }
    const legacyIsStale = record(legacy.stale) && legacy.stale.isStale === true;
    const migratedStatus: Screen04WorkflowStatus = legacyIsStale
      ? "stale"
      : legacy.failure !== null && legacy.upload !== null
        ? "assessment-error"
        : legacy.upload === null
          ? "no-file"
          : screen04DatasetAssessmentReadiness(sampleProfile.dataset).ready
            ? "ready-to-assess"
            : mappings === null
              ? "file-loaded"
              : "mapping-incomplete";
    return withIntegrity({
      schemaVersion: SCREEN_04_WORKFLOW_SCHEMA_VERSION,
      releaseLabel: SCREEN_04_RELEASE_LABEL,
      status: migratedStatus,
      runId: legacy.runId as string,
      revision: legacy.revision as number,
      createdAt: legacy.createdAt,
      updatedAt: legacy.updatedAt,
      eventCardBinding: binding,
      sampleProfile,
      upload: legacy.upload as Screen04OpaqueUploadReference | null,
      mappings,
      calculation: legacy.calculation as Screen04CalculationRecord | null,
      failure: legacy.failure as Screen04WorkflowFailure | null,
      stale: legacy.stale as Screen04WorkflowState["stale"],
    });
  } catch {
    return null;
  }
}

function migrateV0401WorkflowState(value: unknown): Screen04WorkflowState | null {
  try {
    if (
      !record(value) ||
      value.schemaVersion !== SCREEN_04_V0401_WORKFLOW_SCHEMA_VERSION ||
      value.releaseLabel !== SCREEN_04_V0401_RELEASE_LABEL ||
      !record(value.integrity) ||
      typeof value.integrity.stateFingerprint !== "string"
    ) return null;
    const legacy = clone(value) as Record<string, unknown>;
    const legacyIntegrity = legacy.integrity as Record<string, unknown>;
    const { integrity: _legacyIntegrity, ...legacyInput } = legacy;
    if (
      legacyIntegrity.stateFingerprint !==
        fingerprintScreen03Value(legacyInput)
    ) return null;
    const profile = requireScreen04SampleProfile(legacy.sampleProfile);
    const upload = legacy.upload as Screen04OpaqueUploadReference | null;
    const failure = legacy.failure as Screen04WorkflowFailure | null;
    const oldStatus = legacy.status as
      | Screen04WorkflowStatus
      | Screen04HistoricalWorkflowStatus;
    const status: Screen04WorkflowStatus = oldStatus === "stale" ||
        oldStatus === "ready-to-continue" ||
        oldStatus === "describing-sample"
      ? oldStatus
      : failure !== null
        ? upload === null ? "no-file" : "assessment-error"
        : profile.dataset.assessment?.status === "completed"
          ? "assessment-complete"
          : upload === null
            ? "no-file"
            : screen04DatasetAssessmentReadiness(profile.dataset).ready
              ? "ready-to-assess"
              : "mapping-incomplete";
    return withIntegrity({
      ...(legacyInput as unknown as Omit<Screen04WorkflowState, "integrity">),
      schemaVersion: SCREEN_04_WORKFLOW_SCHEMA_VERSION,
      releaseLabel: SCREEN_04_RELEASE_LABEL,
      status,
    });
  } catch {
    return null;
  }
}

export function restoreScreen04WorkflowState(
  value: unknown,
): Screen04WorkflowState | null {
  try {
    if (
      record(value) &&
      value.schemaVersion === SCREEN_04_LEGACY_WORKFLOW_SCHEMA_VERSION
    ) {
      return migrateLegacyWorkflowState(value);
    }
    if (
      record(value) &&
      value.schemaVersion === SCREEN_04_V0401_WORKFLOW_SCHEMA_VERSION
    ) {
      return migrateV0401WorkflowState(value);
    }
    const state = clone(value) as Screen04WorkflowState;
    validateState(state);
    const restoredSampleProfile = requireScreen04SampleProfile(
      state.sampleProfile,
    );
    if (
      restoredSampleProfile.integrity.profileFingerprint !==
        state.sampleProfile.integrity.profileFingerprint
    ) {
      const { integrity: _legacyIntegrity, ...stateInput } = state;
      return Object.freeze(withIntegrity({
        ...stateInput,
        sampleProfile: restoredSampleProfile,
      }));
    }
    return Object.freeze(state);
  } catch {
    return null;
  }
}

export function requireScreen04WorkflowState(value: unknown): Screen04WorkflowState {
  const state = restoreScreen04WorkflowState(value);
  if (!state) fail("Screen 4 workflow state failed validation.");
  return state;
}

export function serializeScreen04WorkflowState(value: unknown): string {
  return serializeDeterministicJson(requireScreen04WorkflowState(value));
}

/** Deterministic fingerprint of all persisted inputs to the dataset assessment. */
export function screen04AssessmentInputFingerprint(
  stateValue: Screen04WorkflowState,
): string {
  return assessmentInputFingerprint(requireScreen04WorkflowState(stateValue));
}

/** Internal provenance only; this value is never rendered to the researcher. */
export function screen04AssessmentResultFingerprint(
  result: Screen04ScientificAssessmentResult,
): string {
  if (result.metrics === null) {
    fail("A blocking assessment has no persistable result fingerprint.");
  }
  return fingerprintScreen04StoredAssessmentResult({
    overallJudgment: result.overallJudgment,
    scientificFindings: [
      ...result.priorityFindings,
      ...result.otherFindings,
    ],
    unresolvedResearcherChoices: result.unresolvedResearcherChoices,
    summary: {
      rowCount: result.metrics.rowCount,
      uniqueUnits: result.metrics.treated.uniqueUnits +
        result.metrics.comparison.uniqueUnits,
      dataFrequency: "annual",
      sampleStartYear: result.metrics.observedYearRange.earliest,
      sampleEndYear: result.metrics.observedYearRange.latest,
    },
  });
}

export function createScreen04WorkflowState(
  bindingValue: Screen04EventCardBinding,
  runId: string,
  at: string,
): Screen04WorkflowState {
  validateBinding(bindingValue);
  bounded(runId, "Screen 4 run ID");
  utc(at, "Screen 4 creation time");
  return withIntegrity({
    schemaVersion: SCREEN_04_WORKFLOW_SCHEMA_VERSION,
    releaseLabel: SCREEN_04_RELEASE_LABEL,
    status: "no-file",
    runId,
    revision: 0,
    createdAt: at,
    updatedAt: at,
    eventCardBinding: clone(bindingValue),
    sampleProfile: createScreen04SampleProfile(bindingValue, at),
    upload: null,
    mappings: null,
    calculation: null,
    failure: null,
    stale: {
      isStale: false,
      detectedAt: null,
      priorEventCardFingerprint: null,
      currentEventCardFingerprint: null,
      reason: null,
    },
  });
}

/**
 * A UI may preselect only an explicit focal clock or a sole verified entry.
 * Multiple unranked entries require the researcher to choose; no "best" date
 * is inferred from prose, outcomes, or ordering.
 */
export function screen04DefaultTimelineProposalId(
  binding: Screen04EventCardBinding,
): string | null {
  validateBinding(binding);
  if (binding.focalClock.selected !== null) {
    return binding.focalClock.selected.proposalId;
  }
  return binding.verifiedTimeline.length === 1
    ? binding.verifiedTimeline[0]!.proposalId
    : null;
}

export function attachScreen04Upload(
  stateValue: Screen04WorkflowState,
  upload: Screen04OpaqueUploadReference,
  at: string,
): Screen04WorkflowState {
  const state = requireScreen04WorkflowState(stateValue);
  if (state.status === "stale") fail("A stale Screen 4 run cannot accept an upload.");
  validateUpload(upload);
  utc(at, "Screen 4 update time");
  const sampleProfile =
    state.upload?.csvFingerprint !== upload.csvFingerprint
      ? updateScreen04DatasetSampleProfile(
          state.sampleProfile,
          {
            fieldMappings: {
              assignmentLowerLevelIdentifier: null,
              assignmentAggregateIdentifier: null,
            },
            assignmentCrosswalkStatus: "unknown",
            withinAggregateExposure: "unknown",
          },
          at,
        )
      : invalidateScreen04DatasetAssessment(state.sampleProfile, at);
  const prepared = {
    ...state,
    sampleProfile,
    upload,
    mappings: null,
    calculation: null,
    failure: null,
  } as Screen04WorkflowState;
  return withIntegrity({
    ...clone(state),
    status: datasetWorkflowStatus(prepared, sampleProfile),
    revision: state.revision + 1,
    updatedAt: at,
    sampleProfile,
    upload: clone(upload),
    mappings: null,
    calculation: null,
    failure: null,
  });
}

export function mapScreen04Columns(
  stateValue: Screen04WorkflowState,
  mappings: Screen04WorkflowMappings,
  transientExactHeaders: readonly string[],
  at: string,
): Screen04WorkflowState {
  const state = requireScreen04WorkflowState(stateValue);
  if (state.upload === null || state.status === "stale") {
    fail("Screen 4 exact mappings require a current upload.");
  }
  utc(at, "Screen 4 update time");
  if (Date.parse(state.upload.expiresAt) <= Date.parse(at)) {
    fail(
      "The temporary Screen 4 file reference expired. Select the CSV again; saved mappings remain available.",
    );
  }
  if (
    transientExactHeaders.length !== state.upload.headerCount ||
    fingerprintScreen04Headers(transientExactHeaders) !==
      state.upload.headerFingerprint
  ) {
    fail("Transient CSV headers do not match the opaque upload metadata.");
  }
  validateMappings(mappings, transientExactHeaders, state.eventCardBinding);
  const sampleProfile = updateScreen04DatasetSampleProfile(
    state.sampleProfile,
    {
      description: {
        researcherTreatmentYear: mappings.structure.researcherTreatmentYear,
      },
      fieldMappings: {
        unitIdentifier: mappings.structure.unitIdentifier,
        annualTime: mappings.structure.year,
        treatmentGroup: mappings.structure.treatmentGroup,
        treatedValue: mappings.structure.treatedValue,
        comparisonValue: mappings.structure.comparisonValue,
        organizationName: mappings.optional.organizationName,
        exposureFields: Object.fromEntries(
          Object.entries(mappings.eventRequirements).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        ),
      },
    },
    at,
  );
  const prepared = {
    ...state,
    sampleProfile,
    mappings,
    calculation: null,
    failure: null,
  } as Screen04WorkflowState;
  return withIntegrity({
    ...clone(state),
    status: datasetWorkflowStatus(prepared, sampleProfile),
    revision: state.revision + 1,
    updatedAt: at,
    sampleProfile,
    mappings: clone(mappings),
    calculation: null,
    failure: null,
  });
}

export function recordScreen04Calculation(
  stateValue: Screen04WorkflowState,
  publicResult: Screen04PublicFeasibilityResult | Screen04AuditPublicResult,
  exports: Screen04CalculationRecord["exports"],
  at: string,
): Screen04WorkflowState {
  const state = requireScreen04WorkflowState(stateValue);
  if (
    state.upload === null ||
    state.mappings === null ||
    state.status === "stale"
  ) {
    fail("Screen 4 is not ready to record a calculation.");
  }
  if (
    publicResult.csvFingerprint !== state.upload.csvFingerprint ||
    publicResult.eventCardFingerprint !== state.eventCardBinding.eventCard.fingerprint ||
    publicResult.eventCardId !== state.eventCardBinding.eventCard.id ||
    publicResult.eventCardVersion !== state.eventCardBinding.eventCard.version
  ) {
    fail("Screen 4 calculation does not match its upload and Event Card binding.");
  }
  if (exports !== undefined) {
    validateExportReference(exports.auditedExposure);
    validateExportReference(exports.affectedCases);
    validateExportReference(exports.auditReport);
  }
  utc(at, "Screen 4 calculation time");
  const calculation: Screen04CalculationRecord = {
    calculatedAt: at,
    csvFingerprint: state.upload.csvFingerprint,
    eventCardFingerprint: state.eventCardBinding.eventCard.fingerprint,
    resultFingerprint: publicResult.resultFingerprint,
    publicResult: clone(publicResult),
    ...(exports === undefined ? {} : { exports: clone(exports) }),
  };
  const prepared = {
    ...state,
    calculation,
    failure: null,
  } as Screen04WorkflowState;
  return withIntegrity({
    ...clone(state),
    status: datasetWorkflowStatus(prepared),
    revision: state.revision + 1,
    updatedAt: at,
    calculation,
    failure: null,
  });
}

export function failScreen04Workflow(
  stateValue: Screen04WorkflowState,
  failure: Screen04WorkflowFailure,
): Screen04WorkflowState {
  const state = requireScreen04WorkflowState(stateValue);
  if (state.status === "stale") fail("A stale Screen 4 run cannot be failed again.");
  utc(failure.failedAt, "Screen 4 failure time");
  bounded(failure.code, "Screen 4 failure code");
  bounded(failure.safeMessage, "Screen 4 safe failure message", 1_000);
  return withIntegrity({
    ...clone(state),
    status: state.upload === null ? "no-file" : "assessment-error",
    revision: state.revision + 1,
    updatedAt: failure.failedAt,
    failure: clone(failure),
  });
}

function datasetWorkflowStatus(
  state: Screen04WorkflowState,
  profile = state.sampleProfile,
): Screen04WorkflowStatus {
  if (profile.dataset.completion.status === "saved") {
    return "ready-to-continue";
  }
  if (profile.dataset.assessment?.status === "stale") {
    return "assessment-stale";
  }
  if (state.failure !== null) {
    return state.upload === null ? "no-file" : "assessment-error";
  }
  if (profile.dataset.assessment?.status === "completed") {
    return "assessment-complete";
  }
  if (state.upload === null) return "no-file";
  if (screen04DatasetAssessmentReadiness(profile.dataset).ready) {
    return "ready-to-assess";
  }
  const hasStartedMapping = Object.values(profile.dataset.description).some(
    (value) => value !== null && value !== "",
  ) || Object.entries(profile.dataset.fieldMappings).some(([key, value]) =>
    key === "exposureFields"
      ? Object.keys(value as Readonly<Record<string, string>>).length > 0
      : value !== null && value !== ""
  ) || profile.dataset.exposureMapping !== null;
  return hasStartedMapping ? "mapping-incomplete" : "file-loaded";
}

/** Switch modes without clearing either mode's description or dataset work. */
export function switchScreen04Mode(
  stateValue: Screen04WorkflowState,
  mode: Screen04Mode,
  at: string,
): Screen04WorkflowState {
  const state = requireScreen04WorkflowState(stateValue);
  if (state.status === "stale") fail("A stale Screen 4 run cannot switch modes.");
  utc(at, "Screen 4 mode-switch time");
  const sampleProfile = switchScreen04SampleProfileMode(
    state.sampleProfile,
    mode,
    at,
  );
  const status = mode === "nodata"
    ? sampleProfile.nodata.completion.status === "saved"
      ? "ready-to-continue"
      : "describing-sample"
    : datasetWorkflowStatus(state, sampleProfile);
  return withIntegrity({
    ...clone(state),
    status,
    revision: state.revision + 1,
    updatedAt: at,
    sampleProfile,
  });
}

export function updateScreen04DatasetProfile(
  stateValue: Screen04WorkflowState,
  patch: Screen04DatasetProfilePatch,
  at: string,
): Screen04WorkflowState {
  const state = requireScreen04WorkflowState(stateValue);
  if (state.status === "stale") {
    fail("A stale Screen 4 run cannot update its sample profile.");
  }
  utc(at, "Screen 4 dataset-profile update time");
  const sampleProfile = updateScreen04DatasetSampleProfile(
    state.sampleProfile,
    patch,
    at,
  );
  const statusState = {
    ...state,
    calculation: null,
    failure: null,
  } as Screen04WorkflowState;
  return withIntegrity({
    ...clone(state),
    status: sampleProfile.activeMode === "dataset"
      ? datasetWorkflowStatus(statusState, sampleProfile)
      : state.status,
    revision: state.revision + 1,
    updatedAt: at,
    sampleProfile,
    calculation: null,
    failure: null,
  });
}

/** Record the explicit start of a deterministic assessment. */
export function beginScreen04ScientificAssessment(
  stateValue: Screen04WorkflowState,
  at: string,
): Screen04WorkflowState {
  const state = requireScreen04WorkflowState(stateValue);
  if (state.status === "stale" || state.upload === null) {
    fail("A current CSV and Event Card are required before assessment.");
  }
  if (!screen04DatasetAssessmentReadiness(state.sampleProfile.dataset).ready) {
    fail("Complete the required sample setup before assessment.");
  }
  utc(at, "Screen 4 assessment start time");
  // A rerun is itself consequential: retire any earlier completed result
  // before the deterministic engine starts so an error cannot leave the old
  // findings presented as the result of the new run.
  const sampleProfile = invalidateScreen04DatasetAssessment(
    state.sampleProfile,
    at,
    "Assessment rerun started",
  );
  return withIntegrity({
    ...clone(state),
    status: "assessing",
    revision: state.revision + 1,
    updatedAt: at,
    sampleProfile,
    failure: null,
  });
}

/**
 * Atomically persist the deterministic reader-facing result and the exact
 * upload/input provenance against which it was calculated.
 */
export function recordScreen04ScientificAssessment(
  stateValue: Screen04WorkflowState,
  result: Screen04ScientificAssessmentResult,
  at: string,
): Screen04WorkflowState {
  const state = requireScreen04WorkflowState(stateValue);
  if (state.status !== "assessing") {
    fail("Screen 4 must be assessing before it can record findings.");
  }
  if (state.sampleProfile.activeMode !== "dataset") {
    fail("A scientific dataset assessment requires dataset mode.");
  }
  utc(at, "Screen 4 assessment time");
  if (
    result.schemaVersion !==
      SCREEN_04_SCIENTIFIC_ASSESSMENT_SCHEMA_VERSION ||
    result.verifiedShockName !== state.eventCardBinding.verifiedShockName ||
    !Array.isArray(result.setupIssues) ||
    result.setupIssues.some((issue) => issue.blocking) ||
    result.metrics === null ||
    !Array.isArray(result.priorityFindings) ||
    result.priorityFindings.length > 5 ||
    !Array.isArray(result.otherFindings) ||
    !Array.isArray(result.unresolvedResearcherChoices)
  ) {
    fail("Only a completed current scientific assessment may be recorded.");
  }
  const preparedProfile = updateScreen04DatasetSampleProfile(
    state.sampleProfile,
    {
      description: {
        sampleStartYear: result.metrics.observedYearRange.earliest,
        sampleEndYear: result.metrics.observedYearRange.latest,
      },
    },
    at,
  );
  const assessmentState = {
    ...state,
    sampleProfile: preparedProfile,
  } as Screen04WorkflowState;
  const readiness = screen04DatasetReadiness(preparedProfile.dataset);
  if (!readiness.ready) {
    fail(
      `Complete the dataset sample profile before recording its assessment: ${readiness.missingFields.join(", ")}.`,
    );
  }
  if (state.upload === null) {
    fail("A dataset assessment requires a current CSV upload.");
  }
  const inputFingerprint = assessmentInputFingerprint(assessmentState);
  const sampleProfile = recordScreen04DatasetAssessment(
    preparedProfile,
    {
      overallJudgment: result.overallJudgment,
      scientificFindings: [
        ...clone(result.priorityFindings),
        ...clone(result.otherFindings),
      ],
      unresolvedResearcherChoices: clone(
        result.unresolvedResearcherChoices,
      ),
      provenance: {
        status: "completed",
        csvFingerprint: state.upload.csvFingerprint,
        assessmentInputFingerprint: inputFingerprint,
        resultFingerprint: screen04AssessmentResultFingerprint(result),
        assessedAt: at,
        summary: {
          rowCount: result.metrics.rowCount,
          uniqueUnits: result.metrics.treated.uniqueUnits +
            result.metrics.comparison.uniqueUnits,
          dataFrequency: "annual",
          sampleStartYear: result.metrics.observedYearRange.earliest,
          sampleEndYear: result.metrics.observedYearRange.latest,
        },
      },
    },
    at,
  );
  const statusState = {
    ...assessmentState,
    failure: null,
  } as Screen04WorkflowState;
  return withIntegrity({
    ...clone(state),
    status: "assessment-complete",
    revision: state.revision + 1,
    updatedAt: at,
    sampleProfile,
    failure: null,
  });
}

export function updateScreen04NodataProfile(
  stateValue: Screen04WorkflowState,
  patch: Screen04NodataProfilePatch,
  at: string,
): Screen04WorkflowState {
  const state = requireScreen04WorkflowState(stateValue);
  if (state.status === "stale") {
    fail("A stale Screen 4 run cannot update its sample profile.");
  }
  utc(at, "Screen 4 nodata-profile update time");
  const sampleProfile = updateScreen04NodataSampleProfile(
    state.sampleProfile,
    state.eventCardBinding,
    patch,
    at,
  );
  return withIntegrity({
    ...clone(state),
    status: sampleProfile.activeMode === "nodata"
      ? "describing-sample"
      : state.status,
    revision: state.revision + 1,
    updatedAt: at,
    sampleProfile,
  });
}

/** Marks the active profile as the stable downstream handoff. */
export function saveScreen04SampleProfile(
  stateValue: Screen04WorkflowState,
  at: string,
): Screen04WorkflowState {
  const state = requireScreen04WorkflowState(stateValue);
  if (state.status === "stale") {
    fail("A stale Screen 4 run cannot be saved for later screens.");
  }
  utc(at, "Screen 4 sample-profile save time");
  const expectedAssessment = state.sampleProfile.activeMode === "dataset"
    ? {
        csvFingerprint: state.upload?.csvFingerprint ?? "",
        assessmentInputFingerprint: assessmentInputFingerprint(state),
      }
    : undefined;
  const sampleProfile = saveScreen04ActiveSampleProfile(
    state.sampleProfile,
    at,
    expectedAssessment,
  );
  return withIntegrity({
    ...clone(state),
    status: "ready-to-continue",
    revision: state.revision + 1,
    updatedAt: at,
    sampleProfile,
  });
}

/**
 * Preserve upload and mapping after context-only refreshes; mark results stale
 * only when the selected event, handoff, Screen 3 run, or Event Card changes.
 */
export function reconcileScreen04EventCardBinding(
  stateValue: Screen04WorkflowState,
  currentBinding: Screen04EventCardBinding,
  at: string,
): Screen04WorkflowState {
  const state = requireScreen04WorkflowState(stateValue);
  validateBinding(currentBinding);
  utc(at, "Screen 4 binding check time");
  if (screen04EventCardBindingIsCurrent(state.eventCardBinding, currentBinding)) {
    return withIntegrity({
      ...clone(state),
      revision: state.revision + 1,
      updatedAt: at,
      eventCardBinding: clone(currentBinding),
      sampleProfile: rebindScreen04SampleProfile(
        state.sampleProfile,
        currentBinding,
        at,
      ),
    });
  }
  return markScreen04WorkflowStale(
    state,
    currentBinding.eventCard.fingerprint,
    "The verified shock changed. This exposure audit was calculated from an earlier Event Card version. Rerun the audit before relying on its classifications.",
    at,
  );
}

/**
 * Invalidate reuse even when Screen 3 no longer has a replacement locked card.
 * Prior upload metadata, mappings, calculation provenance, and export refs stay
 * available for review; the old binding is never rewritten as the new one.
 */
export function markScreen04WorkflowStale(
  stateValue: Screen04WorkflowState,
  currentEventCardFingerprint: string | null,
  reason: string,
  at: string,
): Screen04WorkflowState {
  const state = requireScreen04WorkflowState(stateValue);
  utc(at, "Screen 4 stale time");
  bounded(reason, "Screen 4 stale reason", 1_000);
  if (currentEventCardFingerprint !== null) {
    bounded(currentEventCardFingerprint, "Current Event Card fingerprint", 100);
  }
  return withIntegrity({
    ...clone(state),
    status: "stale",
    revision: state.revision + 1,
    updatedAt: at,
    stale: {
      isStale: true,
      detectedAt: at,
      priorEventCardFingerprint: state.eventCardBinding.eventCard.fingerprint,
      currentEventCardFingerprint,
      reason,
    },
  });
}
