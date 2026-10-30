import { fingerprintScreen03Value } from "./screen03-workflow";
import type { Screen04AdvancedReasonCategory } from "./screen04-advanced-diagnostics";
import type {
  Screen04EventCardBinding,
  Screen04ExposureDimensionKind,
} from "./screen04-event-card-binding";
import type {
  Screen04ScientificFinding,
  Screen04ScientificOverallJudgment,
} from "./screen04-scientific-assessment";

export const SCREEN_04_SAMPLE_PROFILE_SCHEMA_VERSION =
  "screen-04-sample-profile-v1" as const;
export const SCREEN_04_STORED_ASSESSMENT_RESULT_SCHEMA_VERSION =
  "screen-04-stored-assessment-result-v1" as const;

export const SCREEN_04_COMPARISON_BASES = [
  "geography",
  "industry",
  "size-or-threshold",
  "organization-type",
  "legal-eligibility",
  "staggered-adoption",
  "another-distinction",
] as const;

export const SCREEN_04_GEOGRAPHIC_CONCEPTS = [
  "headquarters",
  "operating-location",
  "incorporation",
  "residence",
  "establishment-or-facility-location",
  "another-geographic-concept",
] as const;

export const SCREEN_04_ASSIGNMENT_UNITS = [
  "firm",
  "parent-company",
  "subsidiary",
  "establishment",
  "facility",
  "individual",
  "geographic-area",
  "another-unit",
] as const;

export type Screen04Mode = "dataset" | "nodata";
export type Screen04ComparisonBasis =
  (typeof SCREEN_04_COMPARISON_BASES)[number];
export type Screen04GeographicConcept =
  (typeof SCREEN_04_GEOGRAPHIC_CONCEPTS)[number];
export type Screen04AssignmentUnit =
  (typeof SCREEN_04_ASSIGNMENT_UNITS)[number];
export type Screen04AssignmentCrosswalkStatus =
  | "unknown"
  | "missing"
  | "partial"
  | "complete";
export type Screen04WithinAggregateExposure =
  | "unknown"
  | "uniform"
  | "mixed";

export type Screen04SampleDescription = {
  unitOfAnalysis: string | null;
  sampleUnits: string | null;
  dataFrequency: string | null;
  sampleStartYear: number | null;
  sampleEndYear: number | null;
  researcherTreatmentYear: number | null;
  treatmentGroupDescription: string | null;
  controlGroupDescription: string | null;
  comparisonBasis: Screen04ComparisonBasis | null;
  /** Geographic concept used to construct the proposed groups. */
  geographicConcept: Screen04GeographicConcept | null;
  /** Researcher-confirmed geographic concept governing shock coverage. */
  shockGeographicConcept: Screen04GeographicConcept | null;
  datasetAssignmentUnit: Screen04AssignmentUnit | null;
  shockAssignmentUnit: Screen04AssignmentUnit | null;
};

export type Screen04DatasetFieldMappings = {
  unitIdentifier: string | null;
  annualTime: string | null;
  treatmentGroup: string | null;
  treatedValue: string | null;
  comparisonValue: string | null;
  organizationName: string | null;
  geography: string | null;
  treatmentGeographicValues: string | null;
  controlGeographicValues: string | null;
  /** Exact CSV identifier at the shock's lower assignment level. */
  assignmentLowerLevelIdentifier: string | null;
  /** Exact CSV identifier linking the lower-level record to the dataset unit. */
  assignmentAggregateIdentifier: string | null;
  exposureFields: Readonly<Record<string, string>>;
};

/**
 * Bounded researcher-authored package of already mapped exposure rules.
 * Numeric positions bind only to the deterministic primary/additional rule
 * order and are never rendered as identifiers.
 */
export type Screen04CombinedExposureScenario = {
  name: string | null;
  ruleIndexes: readonly number[];
};

export type Screen04ExposureConditionKind =
  | "categorical-equals"
  | "numeric-threshold"
  | "exemption"
  | "effective-year";

export type Screen04NumericOperator = ">" | ">=" | "<" | "<=";

/**
 * A deliberately form-friendly condition draft. Nullable fields let the widget
 * preserve an unfinished rule without pretending that it is executable.
 */
export type Screen04ExposureCondition = {
  id: string;
  dimension: Screen04ExposureDimensionKind;
  /** Reader-provided name used to group conditions for one dated stage. */
  stageGroup: string | null;
  kind: Screen04ExposureConditionKind;
  column: string | null;
  operator: Screen04NumericOperator | null;
  value: string | number | null;
  /** Unit used by the verified threshold. */
  unit: string | null;
  /** Unit represented by the selected CSV column. */
  sourceUnit: string | null;
  /** Historical measurement year required by the verified threshold. */
  historicalYear: number | null;
  /** Historical year actually represented by the selected CSV values. */
  mappedHistoricalYear: number | null;
  /** Whether the selected column is already historical or varies by panel year. */
  historicalValueSource: "column-values" | "panel-year" | null;
  effectiveYear: number | null;
  nestedAnyGroup: readonly {
    id: string;
    column: string | null;
    operator: Screen04NumericOperator | null;
    threshold: number | null;
    unit: string | null;
    sourceUnit: string | null;
    historicalYear: number | null;
    mappedHistoricalYear: number | null;
    historicalValueSource: "column-values" | "panel-year" | null;
  }[];
};

export type Screen04DatasetExposureMapping =
  | {
      approach: "coverage-variable";
      column: string | null;
      coveredValue: string | null;
    }
  | {
      approach: "conditions";
      combination: "all" | "any";
      conditions: readonly Screen04ExposureCondition[];
    };

export type Screen04ScientificFindingCategory =
  Screen04ScientificFinding["category"];

/** Reader-safe finding text. Technical issue/proposal/evidence IDs stay out. */
export type Screen04SampleProfileFinding = Screen04ScientificFinding;

export type Screen04SampleProfileCompletion = {
  status: "incomplete" | "ready" | "saved";
  savedAt: string | null;
};

export type Screen04DatasetAssessmentSummary = {
  rowCount: number;
  uniqueUnits: number;
  dataFrequency: "annual";
  sampleStartYear: number;
  sampleEndYear: number;
};

export type Screen04DatasetCompletedAssessmentProvenance = {
  status: "completed";
  csvFingerprint: string;
  assessmentInputFingerprint: string;
  /** Added in v0.4.02; absent only on a restored v0.4.01 assessment. */
  resultFingerprint?: string;
  assessedAt: string;
  /** Added in v0.4.02; absent only on a restored v0.4.01 assessment. */
  summary?: Screen04DatasetAssessmentSummary;
};

export type Screen04DatasetStaleAssessmentProvenance = {
  status: "stale";
  priorCsvFingerprint: string;
  priorAssessmentInputFingerprint: string;
  priorResultFingerprint: string;
  assessedAt: string;
  invalidatedAt: string;
  reason: "Your sample setup changed" | "Assessment rerun started";
};

export type Screen04DatasetAssessmentProvenance =
  | Screen04DatasetCompletedAssessmentProvenance
  | Screen04DatasetStaleAssessmentProvenance;

export type Screen04DatasetSampleProfile = {
  description: Screen04SampleDescription;
  fieldMappings: Screen04DatasetFieldMappings;
  exposureMapping: Screen04DatasetExposureMapping | null;
  combinedExposureScenario: Screen04CombinedExposureScenario | null;
  assignmentCrosswalkStatus: Screen04AssignmentCrosswalkStatus;
  withinAggregateExposure: Screen04WithinAggregateExposure;
  overallJudgment: Screen04ScientificOverallJudgment | null;
  scientificFindings: readonly Screen04SampleProfileFinding[];
  unresolvedResearcherChoices: readonly string[];
  assessment: Screen04DatasetAssessmentProvenance | null;
  completion: Screen04SampleProfileCompletion;
};

export type Screen04NodataSampleProfile = {
  description: Screen04SampleDescription;
  scientificFindings: readonly Screen04SampleProfileFinding[];
  unresolvedResearcherChoices: readonly string[];
  completion: Screen04SampleProfileCompletion;
};

export type Screen04SampleProfileBinding = {
  screen02RunId: string;
  selectedEventId: string;
  selectedEventFingerprint: string;
  handoffFingerprint: string;
  screen03RunId: string;
  eventCardId: string;
  eventCardVersion: string;
  eventCardFingerprint: string;
  bindingFingerprint: string;
  verifiedShockName: string;
};

export type Screen04SampleProfile = {
  schemaVersion: typeof SCREEN_04_SAMPLE_PROFILE_SCHEMA_VERSION;
  activeMode: Screen04Mode;
  internalBinding: Screen04SampleProfileBinding;
  dataset: Screen04DatasetSampleProfile;
  nodata: Screen04NodataSampleProfile;
  createdAt: string;
  updatedAt: string;
  integrity: {
    profileFingerprint: string;
  };
};

export type Screen04SampleProfileHandoff = {
  schemaVersion: typeof SCREEN_04_SAMPLE_PROFILE_SCHEMA_VERSION;
  mode: Screen04Mode;
  internalBinding: Screen04SampleProfileBinding;
  description: Screen04SampleDescription;
  datasetFieldMappings: Screen04DatasetFieldMappings | null;
  exposureMapping: Screen04DatasetExposureMapping | null;
  combinedExposureScenario: Screen04CombinedExposureScenario | null;
  overallJudgment: Screen04ScientificOverallJudgment | null;
  scientificFindings: readonly Screen04SampleProfileFinding[];
  unresolvedResearcherChoices: readonly string[];
  assessment: Screen04DatasetAssessmentProvenance | null;
  completionStatus: Screen04SampleProfileCompletion["status"];
};

export type Screen04DatasetProfilePatch = {
  description?: Partial<Screen04SampleDescription>;
  fieldMappings?: Partial<Screen04DatasetFieldMappings>;
  exposureMapping?: Screen04DatasetExposureMapping | null;
  combinedExposureScenario?: Screen04CombinedExposureScenario | null;
  assignmentCrosswalkStatus?: Screen04AssignmentCrosswalkStatus;
  withinAggregateExposure?: Screen04WithinAggregateExposure;
};

export type Screen04NodataProfilePatch = {
  description?: Partial<Screen04SampleDescription>;
};

export type Screen04DatasetAssessmentRecord = {
  overallJudgment: Screen04ScientificOverallJudgment;
  scientificFindings: readonly Screen04SampleProfileFinding[];
  unresolvedResearcherChoices: readonly string[];
  provenance: Screen04DatasetCompletedAssessmentProvenance;
};

export type Screen04StoredAssessmentResultProjection = {
  overallJudgment: Screen04ScientificOverallJudgment;
  scientificFindings: readonly Screen04SampleProfileFinding[];
  unresolvedResearcherChoices: readonly string[];
  summary: Screen04DatasetAssessmentSummary;
};

export type Screen04DatasetAssessmentExpectation = Pick<
  Screen04DatasetCompletedAssessmentProvenance,
  "csvFingerprint" | "assessmentInputFingerprint"
>;

const SCREEN_04_OVERALL_JUDGMENTS: readonly Screen04ScientificOverallJudgment[] = [
  "The proposed exposure design is broadly usable",
  "Review several exposure choices",
  "Revise the treatment or comparison definition",
  "More information is needed before exposure can be checked",
  "Fix the dataset setup before continuing",
];

const emptyDescription = (): Screen04SampleDescription => ({
  unitOfAnalysis: null,
  sampleUnits: null,
  dataFrequency: null,
  sampleStartYear: null,
  sampleEndYear: null,
  researcherTreatmentYear: null,
  treatmentGroupDescription: null,
  controlGroupDescription: null,
  comparisonBasis: null,
  geographicConcept: null,
  shockGeographicConcept: null,
  datasetAssignmentUnit: null,
  shockAssignmentUnit: null,
});

const emptyFieldMappings = (): Screen04DatasetFieldMappings => ({
  unitIdentifier: null,
  annualTime: null,
  treatmentGroup: null,
  treatedValue: null,
  comparisonValue: null,
  organizationName: null,
  geography: null,
  treatmentGeographicValues: null,
  controlGeographicValues: null,
  assignmentLowerLevelIdentifier: null,
  assignmentAggregateIdentifier: null,
  exposureFields: {},
});

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Fingerprint only the bounded result projection that is actually persisted.
 * This makes restoration independently verifiable without retaining metrics
 * beyond the reader-facing summary, setup diagnostics, or any raw CSV rows.
 */
export function fingerprintScreen04StoredAssessmentResult(
  value: Screen04StoredAssessmentResultProjection,
): string {
  return fingerprintScreen03Value({
    schemaVersion: SCREEN_04_STORED_ASSESSMENT_RESULT_SCHEMA_VERSION,
    overallJudgment: value.overallJudgment,
    scientificFindings: value.scientificFindings,
    unresolvedResearcherChoices: value.unresolvedResearcherChoices,
    summary: value.summary,
  });
}

function fail(message: string): never {
  throw new Error(message);
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

function onlyKeys(
  value: unknown,
  keys: readonly string[],
  label: string,
) {
  if (
    !record(value) ||
    Object.keys(value).some((key) => !keys.includes(key))
  ) {
    fail(`${label} has unexpected fields.`);
  }
}

function utc(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) {
    fail(`${label} must be an exact UTC timestamp.`);
  }
}

function safeText(
  value: string | null,
  label: string,
  maximum = 600,
) {
  if (
    value !== null &&
    (value.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value))
  ) {
    fail(`${label} is invalid.`);
  }
}

function populated(value: string | null): value is string {
  return value !== null && value.trim().length > 0;
}

function year(value: number | null, label: string) {
  if (
    value !== null &&
    (!Number.isInteger(value) || value < 1000 || value > 9999)
  ) {
    fail(`${label} is invalid.`);
  }
}

function validateDescription(value: Screen04SampleDescription) {
  if (!exactKeys(value as unknown as Record<string, unknown>, [
    "unitOfAnalysis",
    "sampleUnits",
    "dataFrequency",
    "sampleStartYear",
    "sampleEndYear",
    "researcherTreatmentYear",
    "treatmentGroupDescription",
    "controlGroupDescription",
    "comparisonBasis",
    "geographicConcept",
    "shockGeographicConcept",
    "datasetAssignmentUnit",
    "shockAssignmentUnit",
  ])) fail("Sample description has unexpected fields.");
  safeText(value.unitOfAnalysis, "Unit of analysis");
  safeText(value.sampleUnits, "Sample units");
  safeText(value.dataFrequency, "Data frequency");
  safeText(value.treatmentGroupDescription, "Treatment-group description", 1_000);
  safeText(value.controlGroupDescription, "Control-group description", 1_000);
  year(value.sampleStartYear, "Sample start year");
  year(value.sampleEndYear, "Sample end year");
  year(value.researcherTreatmentYear, "Treatment year");
  if (
    value.comparisonBasis !== null &&
    !(SCREEN_04_COMPARISON_BASES as readonly string[]).includes(
      value.comparisonBasis,
    )
  ) fail("Comparison basis is invalid.");
  if (
    value.geographicConcept !== null &&
    !(SCREEN_04_GEOGRAPHIC_CONCEPTS as readonly string[]).includes(
      value.geographicConcept,
    )
  ) fail("Geographic concept is invalid.");
  if (
    value.shockGeographicConcept !== null &&
    !(SCREEN_04_GEOGRAPHIC_CONCEPTS as readonly string[]).includes(
      value.shockGeographicConcept,
    )
  ) fail("Shock geographic concept is invalid.");
  if (
    value.datasetAssignmentUnit !== null &&
    !(SCREEN_04_ASSIGNMENT_UNITS as readonly string[]).includes(
      value.datasetAssignmentUnit,
    )
  ) fail("Dataset assignment unit is invalid.");
  if (
    value.shockAssignmentUnit !== null &&
    !(SCREEN_04_ASSIGNMENT_UNITS as readonly string[]).includes(
      value.shockAssignmentUnit,
    )
  ) fail("Shock assignment unit is invalid.");
  if (value.comparisonBasis !== "geography" && value.geographicConcept !== null) {
    fail("A geographic concept requires geography as the comparison basis.");
  }
}

function validateFieldMappings(value: Screen04DatasetFieldMappings) {
  if (!exactKeys(value as unknown as Record<string, unknown>, [
    "unitIdentifier",
    "annualTime",
    "treatmentGroup",
    "treatedValue",
    "comparisonValue",
    "organizationName",
    "geography",
    "treatmentGeographicValues",
    "controlGeographicValues",
    "assignmentLowerLevelIdentifier",
    "assignmentAggregateIdentifier",
    "exposureFields",
  ])) fail("Dataset field mappings have unexpected fields.");
  safeText(value.unitIdentifier, "Unit identifier mapping");
  safeText(value.annualTime, "Annual time mapping");
  safeText(value.treatmentGroup, "Treatment-group mapping");
  safeText(value.treatedValue, "Treated value");
  safeText(value.comparisonValue, "Comparison value");
  safeText(value.organizationName, "Organization name mapping");
  safeText(value.geography, "Geography mapping");
  safeText(
    value.treatmentGeographicValues,
    "Treatment-group geographic values",
    1_000,
  );
  safeText(
    value.controlGeographicValues,
    "Control-group geographic values",
    1_000,
  );
  safeText(
    value.assignmentLowerLevelIdentifier,
    "Lower-level assignment identifier mapping",
  );
  safeText(
    value.assignmentAggregateIdentifier,
    "Aggregate assignment identifier mapping",
  );
  if (!record(value.exposureFields) || Object.keys(value.exposureFields).length > 16) {
    fail("Exposure field mappings are invalid.");
  }
  for (const [dimension, column] of Object.entries(value.exposureFields)) {
    safeText(dimension, "Exposure dimension", 160);
    safeText(column, "Exposure field mapping");
    if (!dimension || !column) fail("Exposure field mappings cannot be empty.");
  }
}

function validateCombinedExposureScenario(
  value: Screen04CombinedExposureScenario | null,
) {
  if (value === null) return;
  if (!exactKeys(value as unknown as Record<string, unknown>, [
    "name",
    "ruleIndexes",
  ])) fail("Combined exposure scenario has unexpected fields.");
  safeText(value.name, "Combined exposure scenario name", 200);
  if (
    !Array.isArray(value.ruleIndexes) ||
    value.ruleIndexes.length > 8 ||
    value.ruleIndexes.some((index) =>
      !Number.isSafeInteger(index) || index < 0 || index > 7
    ) ||
    new Set(value.ruleIndexes).size !== value.ruleIndexes.length ||
    value.ruleIndexes.some((index, position) =>
      position > 0 && index <= value.ruleIndexes[position - 1]!
    )
  ) fail("Combined exposure scenario rule selection is invalid.");
}

function validateNestedThreshold(
  value: Screen04ExposureCondition["nestedAnyGroup"][number],
) {
  if (!exactKeys(value as unknown as Record<string, unknown>, [
    "id",
    "column",
    "operator",
    "threshold",
    "unit",
    "sourceUnit",
    "historicalYear",
    "mappedHistoricalYear",
    "historicalValueSource",
  ])) fail("Nested threshold condition has unexpected fields.");
  safeText(value.id, "Nested threshold ID", 160);
  safeText(value.column, "Nested threshold column");
  safeText(value.unit, "Nested threshold unit");
  safeText(value.sourceUnit, "Nested threshold CSV unit");
  if (!value.id || (value.operator !== null && ![">", ">=", "<", "<="].includes(value.operator))) {
    fail("Nested threshold condition is invalid.");
  }
  if (value.threshold !== null && !Number.isFinite(value.threshold)) {
    fail("Nested threshold value is invalid.");
  }
  year(value.historicalYear, "Nested threshold historical year");
  year(value.mappedHistoricalYear, "Nested threshold mapped historical year");
  if (
    value.historicalValueSource !== null &&
    !["column-values", "panel-year"].includes(value.historicalValueSource)
  ) fail("Nested threshold historical-value source is invalid.");
}

function validateExposureMapping(value: Screen04DatasetExposureMapping | null) {
  if (value === null) return;
  if (value.approach === "coverage-variable") {
    if (!exactKeys(value as unknown as Record<string, unknown>, [
      "approach",
      "column",
      "coveredValue",
    ])) fail("Coverage-variable mapping has unexpected fields.");
    safeText(value.column, "Coverage column");
    safeText(value.coveredValue, "Covered value");
    return;
  }
  if (
    value.approach !== "conditions" ||
    !exactKeys(value as unknown as Record<string, unknown>, [
      "approach",
      "combination",
      "conditions",
    ]) ||
    !["all", "any"].includes(value.combination) ||
    !Array.isArray(value.conditions) ||
    value.conditions.length > 8
  ) fail("Exposure-condition mapping is invalid.");
  const ids = new Set<string>();
  for (const condition of value.conditions) {
    if (!exactKeys(condition as unknown as Record<string, unknown>, [
      "id",
      "dimension",
      "stageGroup",
      "kind",
      "column",
      "operator",
      "value",
      "unit",
      "sourceUnit",
      "historicalYear",
      "mappedHistoricalYear",
      "historicalValueSource",
      "effectiveYear",
      "nestedAnyGroup",
    ])) fail("Exposure condition has unexpected fields.");
    safeText(condition.id, "Exposure condition ID", 160);
    safeText(condition.stageGroup, "Exposure stage or version name", 160);
    safeText(condition.column, "Exposure condition column");
    safeText(condition.unit, "Exposure condition unit");
    safeText(condition.sourceUnit, "Exposure condition CSV unit");
    if (
      !condition.id ||
      ids.has(condition.id) ||
      ![
        "geography",
        "organization-type",
        "threshold",
        "exemption",
        "implementation-stage",
        "treatment-component",
        "amendment-version",
      ].includes(condition.dimension) ||
      ![
        "categorical-equals",
        "numeric-threshold",
        "exemption",
        "effective-year",
      ].includes(condition.kind) ||
      (condition.operator !== null &&
        ![">", ">=", "<", "<="].includes(condition.operator)) ||
      !Array.isArray(condition.nestedAnyGroup) ||
      condition.nestedAnyGroup.length > 8
    ) fail("Exposure condition is invalid.");
    ids.add(condition.id);
    if (typeof condition.value === "string") {
      safeText(condition.value, "Exposure condition value");
    } else if (
      condition.value !== null &&
      (typeof condition.value !== "number" || !Number.isFinite(condition.value))
    ) fail("Exposure condition value is invalid.");
    year(condition.historicalYear, "Historical measurement year");
    year(condition.mappedHistoricalYear, "Mapped historical measurement year");
    if (
      condition.historicalValueSource !== null &&
      !["column-values", "panel-year"].includes(condition.historicalValueSource)
    ) fail("Historical-value source is invalid.");
    year(condition.effectiveYear, "Effective year");
    condition.nestedAnyGroup.forEach(validateNestedThreshold);
  }
}

function validateAssignmentCrosswalk(
  dataset: Screen04DatasetSampleProfile,
) {
  if (
    !["unknown", "missing", "partial", "complete"].includes(
      dataset.assignmentCrosswalkStatus,
    )
  ) fail("Assignment crosswalk status is invalid.");
  if (
    !["unknown", "uniform", "mixed"].includes(
      dataset.withinAggregateExposure,
    )
  ) fail("Within-aggregate exposure is invalid.");
  if (
    dataset.assignmentCrosswalkStatus !== "complete" &&
    dataset.withinAggregateExposure !== "unknown"
  ) {
    fail("Within-aggregate exposure requires a complete assignment crosswalk.");
  }
  const unitsRequireCrosswalk =
    dataset.description.datasetAssignmentUnit !== null &&
    dataset.description.shockAssignmentUnit !== null &&
    dataset.description.datasetAssignmentUnit !==
      dataset.description.shockAssignmentUnit;
  if (
    !unitsRequireCrosswalk &&
    (dataset.assignmentCrosswalkStatus !== "unknown" ||
      dataset.withinAggregateExposure !== "unknown")
  ) {
    fail("Assignment crosswalk facts require different confirmed assignment units.");
  }
  const hasCrosswalkColumn =
    dataset.fieldMappings.assignmentLowerLevelIdentifier !== null ||
    dataset.fieldMappings.assignmentAggregateIdentifier !== null;
  if (
    hasCrosswalkColumn &&
    (!unitsRequireCrosswalk || !["partial", "complete"].includes(
      dataset.assignmentCrosswalkStatus,
    ))
  ) {
    fail("Assignment crosswalk columns require a partial or complete crosswalk.");
  }
}

// Keep persistence aligned with every supported diagnostic reason without
// importing the deferred calculation engine into the workflow restore path.
const persistedAdvancedReasonCategories = Object.keys({
  geography: true,
  "organization-type": true,
  threshold: true,
  exemption: true,
  timing: true,
  amendment: true,
  "assignment-unit": true,
  "missing-information": true,
  "treatment-component": true,
  "coverage-condition": true,
  "multi-condition": true,
} satisfies Record<Screen04AdvancedReasonCategory, true>);

function validateFindings(value: readonly Screen04SampleProfileFinding[]) {
  if (!Array.isArray(value) || value.length > 50) {
    fail("Scientific findings are invalid.");
  }
  for (const finding of value) {
    const legacyShape = exactKeys(finding as unknown as Record<string, unknown>, [
      "category",
      "title",
      "whatFound",
      "whyItMatters",
      "possibleNextStep",
      "priority",
    ]);
    const advancedShape = exactKeys(finding as unknown as Record<string, unknown>, [
      "category",
      "title",
      "whatFound",
      "whyItMatters",
      "possibleNextStep",
      "priority",
      "severity",
      "diagnosticTitle",
      "whereItOccurs",
    ]);
    const enrichedAdvancedShape = exactKeys(
      finding as unknown as Record<string, unknown>,
      [
        "category",
        "title",
        "whatFound",
        "whyItMatters",
        "possibleNextStep",
        "priority",
        "severity",
        "diagnosticTitle",
        "whereItOccurs",
        "code",
        "consequenceOrder",
        "aggregate",
      ],
    );
    if (!legacyShape && !advancedShape && !enrichedAdvancedShape) {
      fail("Scientific finding has unexpected fields.");
    }
    if (![
      "Treatment definition",
      "Timing",
      "Comparison group",
      "Sample support",
      "Treatment variation",
    ].includes(finding.category)) fail("Scientific finding category is invalid.");
    safeText(finding.title, "Finding title", 240);
    safeText(finding.whatFound, "Finding description", 1_200);
    safeText(finding.whyItMatters, "Finding consequence", 1_200);
    safeText(finding.possibleNextStep, "Finding next step", 1_200);
    if (
      !finding.title ||
      !finding.whatFound ||
      !finding.whyItMatters ||
      !["high", "medium", "review"].includes(finding.priority)
    ) fail("Scientific finding is invalid.");
    if (advancedShape || enrichedAdvancedShape) {
      if (![
        "Design blocker",
        "Major design concern",
        "Review before analysis",
        "Informational",
      ].includes(finding.severity ?? "")) {
        fail("Scientific finding severity is invalid.");
      }
      safeText(finding.diagnosticTitle ?? null, "Finding diagnostic title", 240);
      if (!finding.diagnosticTitle || !finding.whereItOccurs ||
        !exactKeys(
          finding.whereItOccurs as unknown as Record<string, unknown>,
          ["details", "truncatedDetailCount"],
        ) ||
        !Array.isArray(finding.whereItOccurs.details) ||
        finding.whereItOccurs.details.length > 25 ||
        !Number.isSafeInteger(finding.whereItOccurs.truncatedDetailCount) ||
        finding.whereItOccurs.truncatedDetailCount < 0) {
        fail("Scientific finding affected-detail summary is invalid.");
      }
      for (const detail of finding.whereItOccurs.details) {
        if (!exactKeys(detail as unknown as Record<string, unknown>, [
          "scenarioName",
          "unitIdentifier",
          "year",
          "treatmentStage",
          "proposedGroup",
          "auditedStatus",
          "reasonCategories",
        ])) fail("Scientific finding affected detail is invalid.");
        safeText(detail.scenarioName, "Finding scenario name", 240);
        safeText(detail.unitIdentifier, "Finding unit identifier", 240);
        year(detail.year, "Finding affected year");
        if (![
          "announcement", "enactment", "effective", "implementation",
          "compliance", "enforcement", "amendment", "repeal-or-delay",
          "other",
        ].includes(detail.treatmentStage) ||
          !["treated", "comparison"].includes(detail.proposedGroup) ||
          !["exposed", "unexposed", "unknown", "not_applicable"].includes(
            detail.auditedStatus,
          ) ||
          !Array.isArray(detail.reasonCategories) ||
          detail.reasonCategories.length > persistedAdvancedReasonCategories.length ||
          detail.reasonCategories.some((reason: string) =>
            !persistedAdvancedReasonCategories.includes(reason))) {
          fail("Scientific finding affected detail is invalid.");
        }
      }
      if (enrichedAdvancedShape) {
        if (![
          "SCREEN04_ADVANCED_PROPOSED_CODING_DISAGREEMENT",
          "SCREEN04_ADVANCED_COMPARISON_SURVIVAL",
          "SCREEN04_ADVANCED_TREATMENT_STABILITY",
          "SCREEN04_ADVANCED_VERSION_SEPARABILITY",
          "SCREEN04_ADVANCED_ASSIGNMENT_AGGREGATION",
          "SCREEN04_ADVANCED_UNKNOWN_COMPOSITION",
          "SCREEN04_ADVANCED_REPAIR_PRIORITY",
        ].includes(finding.code ?? "") ||
          !Number.isSafeInteger(finding.consequenceOrder) ||
          (finding.consequenceOrder ?? 0) < 1 ||
          (finding.consequenceOrder ?? 0) > 10 ||
          !finding.aggregate ||
          !exactKeys(
            finding.aggregate as unknown as Record<string, unknown>,
            [
              "affectedObservations",
              "affectedUnits",
              "shareOfReferenceObservations",
            ],
          ) ||
          !Number.isSafeInteger(finding.aggregate.affectedObservations) ||
          finding.aggregate.affectedObservations < 0 ||
          !Number.isSafeInteger(finding.aggregate.affectedUnits) ||
          finding.aggregate.affectedUnits < 0 ||
          !Number.isFinite(finding.aggregate.shareOfReferenceObservations) ||
          finding.aggregate.shareOfReferenceObservations < 0 ||
          finding.aggregate.shareOfReferenceObservations > 1) {
          fail("Scientific finding aggregate evidence is invalid.");
        }
      }
    }
  }
}

function validateChoices(value: readonly string[]) {
  if (!Array.isArray(value) || value.length > 24) {
    fail("Unresolved researcher choices are invalid.");
  }
  for (const choice of value) {
    safeText(choice, "Unresolved researcher choice", 600);
    if (!choice.trim()) fail("Unresolved researcher choices cannot be empty.");
  }
}

function validateCompletion(value: Screen04SampleProfileCompletion) {
  if (!exactKeys(value as unknown as Record<string, unknown>, ["status", "savedAt"])) {
    fail("Sample-profile completion has unexpected fields.");
  }
  if (!["incomplete", "ready", "saved"].includes(value.status)) {
    fail("Sample-profile completion status is invalid.");
  }
  if (value.savedAt !== null) utc(value.savedAt, "Sample-profile save time");
  if ((value.status === "saved") !== (value.savedAt !== null)) {
    fail("Only a saved sample profile may have a save time.");
  }
}

function validateOverallJudgment(
  value: Screen04ScientificOverallJudgment | null,
) {
  if (
    value !== null &&
    !(SCREEN_04_OVERALL_JUDGMENTS as readonly string[]).includes(value)
  ) {
    fail("Scientific overall judgment is invalid.");
  }
}

function validateAssessment(
  value: Screen04DatasetAssessmentProvenance | null,
) {
  if (value === null) return;
  if (value.status === "completed") {
    const provenanceRecord = value as unknown as Record<string, unknown>;
    const legacyShape = exactKeys(provenanceRecord, [
      "status",
      "csvFingerprint",
      "assessmentInputFingerprint",
      "assessedAt",
    ]);
    const currentShape = exactKeys(provenanceRecord, [
      "status",
      "csvFingerprint",
      "assessmentInputFingerprint",
      "resultFingerprint",
      "assessedAt",
      "summary",
    ]);
    if (!legacyShape && !currentShape) {
      fail("Dataset assessment provenance is invalid.");
    }
    safeText(value.csvFingerprint, "Assessment CSV fingerprint", 160);
    safeText(
      value.assessmentInputFingerprint,
      "Assessment-input fingerprint",
      160,
    );
    safeText(
      value.resultFingerprint ?? null,
      "Assessment-result fingerprint",
      160,
    );
    if (
      !value.csvFingerprint ||
      value.csvFingerprint.trim() !== value.csvFingerprint ||
      !value.assessmentInputFingerprint ||
      value.assessmentInputFingerprint.trim() !==
        value.assessmentInputFingerprint ||
      (currentShape && (!value.resultFingerprint ||
        value.resultFingerprint.trim() !== value.resultFingerprint))
    ) {
      fail("Dataset assessment fingerprints are invalid.");
    }
    utc(value.assessedAt, "Dataset assessment time");
    if (legacyShape) return;
    if (!value.summary ||
      !exactKeys(value.summary as unknown as Record<string, unknown>, [
      "rowCount",
      "uniqueUnits",
      "dataFrequency",
      "sampleStartYear",
      "sampleEndYear",
      ]) ||
      !Number.isSafeInteger(value.summary.rowCount) ||
      value.summary.rowCount < 1 ||
      !Number.isSafeInteger(value.summary.uniqueUnits) ||
      value.summary.uniqueUnits < 1 ||
      value.summary.dataFrequency !== "annual") {
      fail("Dataset assessment summary is invalid.");
    }
    year(value.summary.sampleStartYear, "Assessment sample start year");
    year(value.summary.sampleEndYear, "Assessment sample end year");
    if (value.summary.sampleStartYear > value.summary.sampleEndYear) {
      fail("Dataset assessment summary year range is invalid.");
    }
    return;
  }
  if (value.status !== "stale" ||
    !exactKeys(value as unknown as Record<string, unknown>, [
      "status",
      "priorCsvFingerprint",
      "priorAssessmentInputFingerprint",
      "priorResultFingerprint",
      "assessedAt",
      "invalidatedAt",
      "reason",
    ])) fail("Stale dataset assessment provenance is invalid.");
  safeText(value.priorCsvFingerprint, "Prior assessment CSV fingerprint", 160);
  safeText(
    value.priorAssessmentInputFingerprint,
    "Prior assessment-input fingerprint",
    160,
  );
  safeText(
    value.priorResultFingerprint,
    "Prior assessment-result fingerprint",
    160,
  );
  if (!value.priorCsvFingerprint ||
    !value.priorAssessmentInputFingerprint ||
    !value.priorResultFingerprint ||
    !["Your sample setup changed", "Assessment rerun started"].includes(
      value.reason,
    )) {
    fail("Stale dataset assessment provenance is incomplete.");
  }
  utc(value.assessedAt, "Prior dataset assessment time");
  utc(value.invalidatedAt, "Dataset assessment invalidation time");
  if (Date.parse(value.invalidatedAt) < Date.parse(value.assessedAt)) {
    fail("Dataset assessment was invalidated before it was completed.");
  }
}

function bindingFromEventCard(
  binding: Screen04EventCardBinding,
): Screen04SampleProfileBinding {
  return {
    screen02RunId: binding.screen02.runId,
    selectedEventId: binding.screen02.selectedEventId,
    selectedEventFingerprint: binding.screen02.selectedEventFingerprint,
    handoffFingerprint: binding.screen02.handoffFingerprint,
    screen03RunId: binding.screen03.runId,
    eventCardId: binding.eventCard.id,
    eventCardVersion: binding.eventCard.version,
    eventCardFingerprint: binding.eventCard.fingerprint,
    bindingFingerprint: binding.bindingFingerprint,
    verifiedShockName: binding.verifiedShockName,
  };
}

function fingerprintInput(profile: Screen04SampleProfile) {
  const { integrity: _integrity, ...input } = profile;
  return input;
}

function validateProfile(profile: Screen04SampleProfile) {
  if (!exactKeys(profile as unknown as Record<string, unknown>, [
    "schemaVersion",
    "activeMode",
    "internalBinding",
    "dataset",
    "nodata",
    "createdAt",
    "updatedAt",
    "integrity",
  ])) fail("Sample profile has unexpected fields.");
  if (
    profile.schemaVersion !== SCREEN_04_SAMPLE_PROFILE_SCHEMA_VERSION ||
    (profile.activeMode !== "dataset" && profile.activeMode !== "nodata")
  ) fail("Sample-profile root is invalid.");
  utc(profile.createdAt, "Sample-profile creation time");
  utc(profile.updatedAt, "Sample-profile update time");
  if (Date.parse(profile.updatedAt) < Date.parse(profile.createdAt)) {
    fail("Sample-profile update time precedes creation.");
  }
  if (!exactKeys(profile.internalBinding as unknown as Record<string, unknown>, [
    "screen02RunId",
    "selectedEventId",
    "selectedEventFingerprint",
    "handoffFingerprint",
    "screen03RunId",
    "eventCardId",
    "eventCardVersion",
    "eventCardFingerprint",
    "bindingFingerprint",
    "verifiedShockName",
  ])) fail("Sample-profile binding has unexpected fields.");
  for (const [label, value] of Object.entries(profile.internalBinding)) {
    safeText(value, `Sample-profile binding ${label}`, 600);
    if (!value) fail("Sample-profile binding is incomplete.");
  }
  if (!exactKeys(profile.dataset as unknown as Record<string, unknown>, [
    "description",
    "fieldMappings",
    "exposureMapping",
    "combinedExposureScenario",
    "assignmentCrosswalkStatus",
    "withinAggregateExposure",
    "overallJudgment",
    "scientificFindings",
    "unresolvedResearcherChoices",
    "assessment",
    "completion",
  ])) fail("Dataset sample profile has unexpected fields.");
  validateDescription(profile.dataset.description);
  validateFieldMappings(profile.dataset.fieldMappings);
  validateExposureMapping(profile.dataset.exposureMapping);
  validateCombinedExposureScenario(profile.dataset.combinedExposureScenario);
  validateAssignmentCrosswalk(profile.dataset);
  validateOverallJudgment(profile.dataset.overallJudgment);
  validateFindings(profile.dataset.scientificFindings);
  validateChoices(profile.dataset.unresolvedResearcherChoices);
  validateAssessment(profile.dataset.assessment);
  validateCompletion(profile.dataset.completion);
  if (
    profile.dataset.assessment === null ||
    profile.dataset.assessment.status === "stale"
  ) {
    if (
      profile.dataset.overallJudgment !== null ||
      profile.dataset.scientificFindings.length > 0 ||
      profile.dataset.unresolvedResearcherChoices.length > 0 ||
      profile.dataset.completion.status !== "incomplete"
    ) {
      fail("Dataset assessment output requires completed provenance.");
    }
  } else {
    if (
      profile.dataset.overallJudgment === null ||
      profile.dataset.completion.status === "incomplete" ||
      Date.parse(profile.dataset.assessment.assessedAt) >
        Date.parse(profile.updatedAt) ||
      (profile.dataset.completion.savedAt !== null &&
        Date.parse(profile.dataset.completion.savedAt) <
          Date.parse(profile.dataset.assessment.assessedAt))
    ) {
      fail("Dataset assessment completion is inconsistent.");
    }
    if (
      profile.dataset.assessment.resultFingerprint !== undefined &&
      profile.dataset.assessment.summary !== undefined &&
      profile.dataset.assessment.resultFingerprint !==
        fingerprintScreen04StoredAssessmentResult({
          overallJudgment: profile.dataset.overallJudgment,
          scientificFindings: profile.dataset.scientificFindings,
          unresolvedResearcherChoices:
            profile.dataset.unresolvedResearcherChoices,
          summary: profile.dataset.assessment.summary,
        })
    ) {
      fail("Dataset assessment result fingerprint is invalid.");
    }
  }
  if (!exactKeys(profile.nodata as unknown as Record<string, unknown>, [
    "description",
    "scientificFindings",
    "unresolvedResearcherChoices",
    "completion",
  ])) fail("Nodata sample profile has unexpected fields.");
  validateDescription(profile.nodata.description);
  validateFindings(profile.nodata.scientificFindings);
  validateChoices(profile.nodata.unresolvedResearcherChoices);
  validateCompletion(profile.nodata.completion);
  if (
    !record(profile.integrity) ||
    !exactKeys(profile.integrity, ["profileFingerprint"]) ||
    profile.integrity.profileFingerprint !==
      fingerprintScreen03Value(fingerprintInput(profile))
  ) fail("Sample-profile fingerprint is invalid.");
}

function withIntegrity(
  input: Omit<Screen04SampleProfile, "integrity">,
): Screen04SampleProfile {
  const profile = {
    ...clone(input),
    integrity: { profileFingerprint: "fnv1a64:0000000000000000" },
  } as Screen04SampleProfile;
  profile.integrity.profileFingerprint = fingerprintScreen03Value(
    fingerprintInput(profile),
  );
  validateProfile(profile);
  return clone(profile);
}

function descriptionReadiness(description: Screen04SampleDescription) {
  const missing: string[] = [];
  if (!populated(description.unitOfAnalysis)) missing.push("Unit of analysis");
  if (!populated(description.sampleUnits)) missing.push("Sample units");
  if (!populated(description.dataFrequency)) missing.push("Data frequency");
  if (description.sampleStartYear === null) missing.push("Sample start year");
  if (description.sampleEndYear === null) missing.push("Sample end year");
  if (description.researcherTreatmentYear === null) missing.push("Treatment year");
  if (!populated(description.treatmentGroupDescription)) {
    missing.push("Treatment-group description");
  }
  if (!populated(description.controlGroupDescription)) {
    missing.push("Control-group description");
  }
  if (description.comparisonBasis === null) missing.push("Main comparison basis");
  if (
    description.comparisonBasis === "geography" &&
    description.geographicConcept === null
  ) missing.push("Geographic concept");
  if (
    description.sampleStartYear !== null &&
    description.sampleEndYear !== null &&
    description.sampleStartYear > description.sampleEndYear
  ) missing.push("A valid sample-year range");
  return Array.from(new Set(missing));
}

export function screen04NodataConsistencyFindings(
  binding: Screen04EventCardBinding,
  description: Screen04SampleDescription,
): Screen04SampleProfileFinding[] {
  const findings: Screen04SampleProfileFinding[] = [];
  const start = description.sampleStartYear;
  const end = description.sampleEndYear;
  const treatment = description.researcherTreatmentYear;
  const add = (
    title: string,
    whatFound: string,
    whyItMatters: string,
    possibleNextStep: string | null,
    priority: Screen04SampleProfileFinding["priority"],
  ) => findings.push({
    category: "Timing",
    title,
    whatFound,
    whyItMatters,
    possibleNextStep,
    priority,
  });
  if (start !== null && end !== null && start > end) {
    add(
      "The sample years are reversed",
      `The stated sample begins in ${start} and ends in ${end}.`,
      "A sample cannot end before it begins, so timing support cannot yet be described.",
      "Correct the sample start or end year.",
      "high",
    );
  } else if (start !== null && end !== null && treatment !== null) {
    if (treatment < start) {
      add(
        "The treatment year precedes the sample",
        `The treatment year is ${treatment}, while the sample begins in ${start}.`,
        "The described sample contains no observed pre-treatment period.",
        "Review the treatment year or extend the sample earlier if the design requires pre-treatment observations.",
        "high",
      );
    } else if (treatment > end) {
      add(
        "The treatment year follows the sample",
        `The treatment year is ${treatment}, while the sample ends in ${end}.`,
        "The described sample contains no observed post-treatment period.",
        "Review the treatment year or extend the sample later if the design requires post-treatment observations.",
        "high",
      );
    } else {
      const preYears = treatment - start;
      const postYears = end - treatment + 1;
      if (preYears === 0) {
        add(
          "No pre-treatment year is described",
          `The sample and treatment both begin in ${treatment}.`,
          "The sample description contains no earlier annual observation.",
          "Consider whether an earlier sample period is available.",
          "high",
        );
      } else if (preYears === 1) {
        add(
          "Only one pre-treatment year is described",
          `The sample contains one stated year before ${treatment}.`,
          "Timing support before the shock is limited in the current sample description.",
          "Review whether a longer pre-treatment window is available.",
          "review",
        );
      }
      if (postYears === 1) {
        add(
          "Only one post-treatment year is described",
          `The sample contains only the ${treatment} treatment year at or after treatment.`,
          "Timing support after the shock is limited in the current sample description.",
          "Review whether a longer post-treatment window is available.",
          "review",
        );
      }
    }
  }

  const verifiedYears = Array.from(new Set(binding.verifiedTimeline.map(
    (entry) => Number(entry.resolvedDate.slice(0, 4)),
  ).filter(Number.isInteger)));
  if (binding.verifiedTimeline.length > 1) {
    add(
      "More than one verified event date may matter",
      `The verified shock includes ${binding.verifiedTimeline.length} reviewed dates across ${Array.from(new Set(binding.verifiedTimeline.map((entry) => entry.stage))).join(", ")} stages.`,
      "Different dates may represent different stages of the shock rather than interchangeable treatment dates.",
      "Confirm which stage the selected treatment year is intended to represent.",
      "medium",
    );
  }
  if (treatment !== null && verifiedYears.length > 0 && !verifiedYears.includes(treatment)) {
    add(
      "The selected treatment year differs from the verified dates",
      `The selected treatment year is ${treatment}; the verified timeline year${verifiedYears.length === 1 ? " is" : "s are"} ${verifiedYears.join(", ")}.`,
      "The selected year may represent a different stage or an unsupported timing choice.",
      "Review the verified dates and record which stage the treatment year represents.",
      "medium",
    );
  }
  const early = binding.verifiedTimeline
    .filter((entry) => entry.stage === "announcement" || entry.stage === "enactment")
    .sort((left, right) => left.resolvedDate.localeCompare(right.resolvedDate))[0];
  const operative = binding.verifiedTimeline
    .filter((entry) => entry.stage === "effective" || entry.stage === "implementation")
    .sort((left, right) => left.resolvedDate.localeCompare(right.resolvedDate))[0];
  if (early && operative && early.resolvedDate < operative.resolvedDate) {
    add(
      "The shock has a possible anticipation period",
      `${early.label} is dated ${early.resolvedDate}, before ${operative.label.toLocaleLowerCase("en-US")} on ${operative.resolvedDate}.`,
      "The intervening period may contain preparation or anticipatory responses; this check does not claim that such responses occurred.",
      "Decide whether the interval should be treated as an ordinary untreated period.",
      "medium",
    );
  }
  const priorityOrder = { high: 0, medium: 1, review: 2 } as const;
  return findings.sort(
    (left, right) =>
      priorityOrder[left.priority] - priorityOrder[right.priority],
  );
}

export function screen04NodataResearcherChoices(
  binding: Screen04EventCardBinding,
  description: Screen04SampleDescription,
): string[] {
  const choices: string[] = [];
  if (binding.verifiedTimeline.length === 0) {
    choices.push(
      "Confirm the verified date and the event stage represented by the selected treatment year.",
    );
  }
  if (binding.verifiedTimeline.some((entry) =>
    entry.stage === "other" || entry.stage === "occurrence" ||
    entry.stage === "rulemaking"
  )) {
    choices.push(
      "Confirm the role of each verified date whose stage is not yet identified as announcement, enactment, implementation, enforcement, or amendment.",
    );
  }
  if (binding.verifiedTimeline.length > 1) {
    choices.push(
      "Confirm which verified event stage the proposed treatment year is intended to represent.",
    );
  }
  if (
    description.comparisonBasis === "geography" &&
    description.shockGeographicConcept === null
  ) {
    choices.push(
      "Confirm the geographic concept that determines exposure to the verified shock.",
    );
  }
  if (
    description.datasetAssignmentUnit !== null &&
    description.shockAssignmentUnit === null
  ) {
    choices.push("Confirm the unit to which the verified shock applies.");
  }
  return Array.from(new Set(choices));
}

export function screen04NodataReadiness(
  description: Screen04SampleDescription,
) {
  const missingFields = descriptionReadiness(description);
  return { ready: missingFields.length === 0, missingFields } as const;
}

function assignmentCrosswalkMappingGaps(
  dataset: Screen04DatasetSampleProfile,
): string[] {
  if (!["partial", "complete"].includes(dataset.assignmentCrosswalkStatus)) {
    return [];
  }
  const missing: string[] = [];
  if (!populated(dataset.fieldMappings.assignmentLowerLevelIdentifier)) {
    missing.push("Lower-level assignment identifier mapping");
  }
  if (!populated(dataset.fieldMappings.assignmentAggregateIdentifier)) {
    missing.push("Dataset-unit crosswalk identifier mapping");
  }
  return missing;
}

export function screen04DatasetReadiness(
  dataset: Screen04DatasetSampleProfile,
) {
  const missingFields = descriptionReadiness(dataset.description);
  if (!populated(dataset.fieldMappings.unitIdentifier)) {
    missingFields.push("Unit identifier mapping");
  }
  if (!populated(dataset.fieldMappings.annualTime)) {
    missingFields.push("Annual time mapping");
  }
  if (!populated(dataset.fieldMappings.treatmentGroup)) {
    missingFields.push("Treatment-group mapping");
  }
  if (!populated(dataset.fieldMappings.treatedValue)) {
    missingFields.push("Treated value");
  }
  if (!populated(dataset.fieldMappings.comparisonValue)) {
    missingFields.push("Comparison value");
  }
  if (
    populated(dataset.fieldMappings.treatedValue) &&
    dataset.fieldMappings.treatedValue === dataset.fieldMappings.comparisonValue
  ) missingFields.push("Different treated and comparison values");
  missingFields.push(...assignmentCrosswalkMappingGaps(dataset));
  return {
    ready: missingFields.length === 0,
    missingFields: Array.from(new Set(missingFields)),
  } as const;
}

/**
 * Readiness for the explicit assessment action. Observed sample bounds are
 * calculated from the CSV and therefore are intentionally not required here.
 */
export function screen04DatasetAssessmentReadiness(
  dataset: Screen04DatasetSampleProfile,
) {
  const missingFields: string[] = [];
  const description = dataset.description;
  if (!populated(description.unitOfAnalysis)) missingFields.push("Unit of analysis");
  if (!populated(description.sampleUnits)) missingFields.push("Sample units");
  if (!populated(description.dataFrequency)) missingFields.push("Data frequency");
  if (description.researcherTreatmentYear === null) missingFields.push("Treatment year");
  if (!populated(description.treatmentGroupDescription)) {
    missingFields.push("Treatment-group description");
  }
  if (!populated(description.controlGroupDescription)) {
    missingFields.push("Control-group description");
  }
  if (description.comparisonBasis === null) missingFields.push("Main comparison basis");
  if (
    description.comparisonBasis === "geography" &&
    description.geographicConcept === null
  ) missingFields.push("Geographic concept");
  if (!populated(dataset.fieldMappings.unitIdentifier)) {
    missingFields.push("Unit identifier mapping");
  }
  if (!populated(dataset.fieldMappings.annualTime)) {
    missingFields.push("Annual time mapping");
  }
  if (!populated(dataset.fieldMappings.treatmentGroup)) {
    missingFields.push("Treatment-group mapping");
  }
  if (!populated(dataset.fieldMappings.treatedValue)) {
    missingFields.push("Treated value");
  }
  if (!populated(dataset.fieldMappings.comparisonValue)) {
    missingFields.push("Comparison value");
  }
  if (
    populated(dataset.fieldMappings.treatedValue) &&
    dataset.fieldMappings.treatedValue === dataset.fieldMappings.comparisonValue
  ) missingFields.push("Different treated and comparison values");
  missingFields.push(...assignmentCrosswalkMappingGaps(dataset));
  return {
    ready: missingFields.length === 0,
    missingFields: Array.from(new Set(missingFields)),
  } as const;
}

export function createScreen04SampleProfile(
  binding: Screen04EventCardBinding,
  at: string,
): Screen04SampleProfile {
  utc(at, "Sample-profile creation time");
  return withIntegrity({
    schemaVersion: SCREEN_04_SAMPLE_PROFILE_SCHEMA_VERSION,
    activeMode: "dataset",
    internalBinding: bindingFromEventCard(binding),
    dataset: {
      description: emptyDescription(),
      fieldMappings: emptyFieldMappings(),
      exposureMapping: null,
      combinedExposureScenario: null,
      assignmentCrosswalkStatus: "unknown",
      withinAggregateExposure: "unknown",
      overallJudgment: null,
      scientificFindings: [],
      unresolvedResearcherChoices: [],
      assessment: null,
      completion: { status: "incomplete", savedAt: null },
    },
    nodata: {
      description: emptyDescription(),
      scientificFindings: screen04NodataConsistencyFindings(
        binding,
        emptyDescription(),
      ),
      unresolvedResearcherChoices: screen04NodataResearcherChoices(
        binding,
        emptyDescription(),
      ),
      completion: { status: "incomplete", savedAt: null },
    },
    createdAt: at,
    updatedAt: at,
  });
}

export function restoreScreen04SampleProfile(
  value: unknown,
): Screen04SampleProfile | null {
  try {
    const profile = clone(value) as Screen04SampleProfile;
    try {
      validateProfile(profile);
      return Object.freeze(profile);
    } catch {
      const legacyDatasetKeys = [
        "description",
        "fieldMappings",
        "exposureMapping",
        "overallJudgment",
        "scientificFindings",
        "unresolvedResearcherChoices",
        "assessment",
        "completion",
      ] as const;
      const priorDatasetKeys = [
        ...legacyDatasetKeys,
        "assignmentCrosswalkStatus",
        "withinAggregateExposure",
      ] as const;
      const priorFieldMappingKeys = [
        "unitIdentifier",
        "annualTime",
        "treatmentGroup",
        "treatedValue",
        "comparisonValue",
        "organizationName",
        "geography",
        "treatmentGeographicValues",
        "controlGeographicValues",
        "exposureFields",
      ] as const;
      if (
        !record(profile) ||
        !record(profile.dataset) ||
        !record(profile.dataset.fieldMappings) ||
        !record(profile.integrity) ||
        (!exactKeys(profile.dataset, legacyDatasetKeys) &&
          !exactKeys(profile.dataset, priorDatasetKeys)) ||
        !exactKeys(profile.dataset.fieldMappings, priorFieldMappingKeys) ||
        typeof profile.integrity.profileFingerprint !== "string" ||
        profile.integrity.profileFingerprint !==
          fingerprintScreen03Value(fingerprintInput(profile))
      ) return null;
      const { integrity: _legacyIntegrity, ...legacyInput } = profile;
      const priorCrosswalk = Object.hasOwn(
        profile.dataset,
        "assignmentCrosswalkStatus",
      );
      const migrated = withIntegrity({
        ...clone(legacyInput),
        dataset: {
          ...clone(profile.dataset),
          fieldMappings: {
            ...clone(profile.dataset.fieldMappings),
            assignmentLowerLevelIdentifier: null,
            assignmentAggregateIdentifier: null,
          },
          combinedExposureScenario: null,
          assignmentCrosswalkStatus: priorCrosswalk
            ? profile.dataset.assignmentCrosswalkStatus
            : "unknown",
          withinAggregateExposure: priorCrosswalk
            ? profile.dataset.withinAggregateExposure
            : "unknown",
        },
      });
      return Object.freeze(migrated);
    }
  } catch {
    return null;
  }
}

export function requireScreen04SampleProfile(
  value: unknown,
): Screen04SampleProfile {
  const profile = restoreScreen04SampleProfile(value);
  if (!profile) fail("Screen 4 sample profile failed validation.");
  return profile;
}

export function switchScreen04SampleProfileMode(
  value: Screen04SampleProfile,
  mode: Screen04Mode,
  at: string,
): Screen04SampleProfile {
  const profile = requireScreen04SampleProfile(value);
  utc(at, "Sample-profile mode-switch time");
  return withIntegrity({
    ...clone(profile),
    activeMode: mode,
    updatedAt: at,
  });
}

function nextCompletion(ready: boolean): Screen04SampleProfileCompletion {
  return { status: ready ? "ready" : "incomplete", savedAt: null };
}

function staleAssessment(
  assessment: Screen04DatasetAssessmentProvenance | null,
  at: string,
  reason: Screen04DatasetStaleAssessmentProvenance["reason"],
): Screen04DatasetStaleAssessmentProvenance | null {
  if (assessment === null) return null;
  if (assessment.status === "stale") {
    return {
      ...clone(assessment),
      invalidatedAt: at,
      reason,
    };
  }
  return {
    status: "stale",
    priorCsvFingerprint: assessment.csvFingerprint,
    priorAssessmentInputFingerprint: assessment.assessmentInputFingerprint,
    priorResultFingerprint: assessment.resultFingerprint ??
      fingerprintScreen03Value(assessment),
    assessedAt: assessment.assessedAt,
    invalidatedAt: at,
    reason,
  };
}

export function updateScreen04DatasetSampleProfile(
  value: Screen04SampleProfile,
  patch: Screen04DatasetProfilePatch,
  at: string,
): Screen04SampleProfile {
  const profile = requireScreen04SampleProfile(value);
  utc(at, "Dataset sample-profile update time");
  onlyKeys(
    patch,
    [
      "description",
      "fieldMappings",
      "exposureMapping",
      "combinedExposureScenario",
      "assignmentCrosswalkStatus",
      "withinAggregateExposure",
    ],
    "Dataset sample-profile patch",
  );
  const description = patch.description
    ? { ...profile.dataset.description, ...clone(patch.description) }
    : clone(profile.dataset.description);
  const assignmentUnitsChanged =
    description.datasetAssignmentUnit !==
      profile.dataset.description.datasetAssignmentUnit ||
    description.shockAssignmentUnit !==
      profile.dataset.description.shockAssignmentUnit;
  const crosswalkStatusPatched = Object.hasOwn(
    patch,
    "assignmentCrosswalkStatus",
  );
  const requestedCrosswalkStatus = crosswalkStatusPatched
    ? patch.assignmentCrosswalkStatus!
    : profile.dataset.assignmentCrosswalkStatus;
  const assignmentCrosswalkStatus = assignmentUnitsChanged &&
      !crosswalkStatusPatched
    ? "unknown"
    : requestedCrosswalkStatus;
  const withinAggregateExposurePatched = Object.hasOwn(
    patch,
    "withinAggregateExposure",
  );
  const requestedWithinAggregateExposure = withinAggregateExposurePatched
    ? patch.withinAggregateExposure!
    : profile.dataset.withinAggregateExposure;
  const resetWithinAggregateExposure = assignmentUnitsChanged &&
    !withinAggregateExposurePatched;
  const withinAggregateExposure = resetWithinAggregateExposure ||
      assignmentCrosswalkStatus !== "complete"
      ? "unknown"
      : requestedWithinAggregateExposure;
  const crosswalkColumnsPatched = Boolean(
    patch.fieldMappings && (
      Object.hasOwn(patch.fieldMappings, "assignmentLowerLevelIdentifier") ||
      Object.hasOwn(patch.fieldMappings, "assignmentAggregateIdentifier")
    ),
  );
  const unitsRequireCrosswalk =
    description.datasetAssignmentUnit !== null &&
    description.shockAssignmentUnit !== null &&
    description.datasetAssignmentUnit !== description.shockAssignmentUnit;
  const crosswalkColumnsMayBeUsed = unitsRequireCrosswalk &&
    ["partial", "complete"].includes(assignmentCrosswalkStatus);
  const mergedFieldMappings: Screen04DatasetFieldMappings = {
    ...profile.dataset.fieldMappings,
    ...clone(patch.fieldMappings ?? {}),
    exposureFields: patch.fieldMappings?.exposureFields ??
      profile.dataset.fieldMappings.exposureFields,
  };
  const fieldMappings = !crosswalkColumnsMayBeUsed ||
      (assignmentUnitsChanged && !crosswalkColumnsPatched)
    ? {
        ...mergedFieldMappings,
        assignmentLowerLevelIdentifier: null,
        assignmentAggregateIdentifier: null,
      }
    : mergedFieldMappings;
  const combinedScenarioPatched = Object.hasOwn(
    patch,
    "combinedExposureScenario",
  );
  const exposureMappingPatched = Object.hasOwn(patch, "exposureMapping");
  const combinedExposureScenario = combinedScenarioPatched
    ? clone(patch.combinedExposureScenario ?? null)
    : exposureMappingPatched
      ? null
      : clone(profile.dataset.combinedExposureScenario);
  const dataset: Screen04DatasetSampleProfile = {
    ...clone(profile.dataset),
    description,
    fieldMappings,
    ...(Object.hasOwn(patch, "exposureMapping")
      ? { exposureMapping: clone(patch.exposureMapping ?? null) }
      : {}),
    combinedExposureScenario,
    assignmentCrosswalkStatus,
    withinAggregateExposure,
    overallJudgment: null,
    scientificFindings: [],
    unresolvedResearcherChoices: [],
    assessment: staleAssessment(
      profile.dataset.assessment,
      at,
      "Your sample setup changed",
    ),
    completion: { status: "incomplete", savedAt: null },
  };
  return withIntegrity({
    ...clone(profile),
    dataset,
    updatedAt: at,
  });
}

export function updateScreen04NodataSampleProfile(
  value: Screen04SampleProfile,
  binding: Screen04EventCardBinding,
  patch: Screen04NodataProfilePatch,
  at: string,
): Screen04SampleProfile {
  const profile = requireScreen04SampleProfile(value);
  utc(at, "Nodata sample-profile update time");
  onlyKeys(patch, ["description"], "Nodata sample-profile patch");
  const description = patch.description
    ? { ...profile.nodata.description, ...clone(patch.description) }
    : clone(profile.nodata.description);
  const findings = screen04NodataConsistencyFindings(binding, description);
  const choices = screen04NodataResearcherChoices(binding, description);
  const readiness = screen04NodataReadiness(description);
  const nodata: Screen04NodataSampleProfile = {
    description,
    scientificFindings: clone(findings),
    unresolvedResearcherChoices: clone(choices),
    completion: nextCompletion(readiness.ready),
  };
  return withIntegrity({
    ...clone(profile),
    nodata,
    updatedAt: at,
  });
}

/** Clear all result-derived dataset fields while preserving the researcher draft. */
export function invalidateScreen04DatasetAssessment(
  value: Screen04SampleProfile,
  at: string,
  reason: Screen04DatasetStaleAssessmentProvenance["reason"] =
    "Your sample setup changed",
): Screen04SampleProfile {
  const profile = requireScreen04SampleProfile(value);
  utc(at, "Dataset assessment invalidation time");
  return withIntegrity({
    ...clone(profile),
    dataset: {
      ...clone(profile.dataset),
      overallJudgment: null,
      scientificFindings: [],
      unresolvedResearcherChoices: [],
      assessment: staleAssessment(profile.dataset.assessment, at, reason),
      completion: { status: "incomplete", savedAt: null },
    },
    updatedAt: at,
  });
}

/** Internal profile primitive used by the workflow's atomic assessment API. */
export function recordScreen04DatasetAssessment(
  value: Screen04SampleProfile,
  assessmentRecord: Screen04DatasetAssessmentRecord,
  at: string,
): Screen04SampleProfile {
  const profile = requireScreen04SampleProfile(value);
  utc(at, "Dataset assessment time");
  onlyKeys(
    assessmentRecord,
    [
      "overallJudgment",
      "scientificFindings",
      "unresolvedResearcherChoices",
      "provenance",
    ],
    "Dataset assessment record",
  );
  if (assessmentRecord.provenance.assessedAt !== at) {
    fail("Dataset assessment provenance must use the atomic record time.");
  }
  const readiness = screen04DatasetReadiness(profile.dataset);
  if (!readiness.ready) {
    fail(
      `Complete the dataset sample profile before recording its assessment: ${readiness.missingFields.join(", ")}.`,
    );
  }
  return withIntegrity({
    ...clone(profile),
    dataset: {
      ...clone(profile.dataset),
      overallJudgment: assessmentRecord.overallJudgment,
      scientificFindings: clone(assessmentRecord.scientificFindings),
      unresolvedResearcherChoices: clone(
        assessmentRecord.unresolvedResearcherChoices,
      ),
      assessment: clone(assessmentRecord.provenance),
      completion: { status: "ready", savedAt: null },
    },
    updatedAt: at,
  });
}

export function saveScreen04ActiveSampleProfile(
  value: Screen04SampleProfile,
  at: string,
  expectedDatasetAssessment?: Screen04DatasetAssessmentExpectation,
): Screen04SampleProfile {
  const profile = requireScreen04SampleProfile(value);
  utc(at, "Sample-profile save time");
  if (profile.activeMode === "nodata") {
    const readiness = screen04NodataReadiness(profile.nodata.description);
    if (!readiness.ready) {
      fail(`Complete the sample description before continuing: ${readiness.missingFields.join(", ")}.`);
    }
    return withIntegrity({
      ...clone(profile),
      nodata: {
        ...clone(profile.nodata),
        completion: { status: "saved", savedAt: at },
      },
      updatedAt: at,
    });
  }
  const readiness = screen04DatasetReadiness(profile.dataset);
  if (!readiness.ready) {
    fail(`Complete the dataset sample profile before continuing: ${readiness.missingFields.join(", ")}.`);
  }
  if (
    profile.dataset.assessment === null ||
    profile.dataset.assessment.status !== "completed" ||
    expectedDatasetAssessment === undefined
  ) {
    fail("Run the current dataset assessment before continuing.");
  }
  onlyKeys(
    expectedDatasetAssessment,
    ["csvFingerprint", "assessmentInputFingerprint"],
    "Dataset assessment expectation",
  );
  if (
    profile.dataset.assessment.csvFingerprint !==
      expectedDatasetAssessment.csvFingerprint ||
    profile.dataset.assessment.assessmentInputFingerprint !==
      expectedDatasetAssessment.assessmentInputFingerprint
  ) {
    fail("The saved dataset assessment is no longer current.");
  }
  if (
    Date.parse(at) < Date.parse(profile.dataset.assessment.assessedAt)
  ) {
    fail("Sample-profile save time precedes its assessment.");
  }
  return withIntegrity({
    ...clone(profile),
    dataset: {
      ...clone(profile.dataset),
      completion: { status: "saved", savedAt: at },
    },
    updatedAt: at,
  });
}

export function buildScreen04SampleProfileHandoff(
  value: Screen04SampleProfile,
): Screen04SampleProfileHandoff {
  const profile = requireScreen04SampleProfile(value);
  const active = profile.activeMode === "dataset"
    ? profile.dataset
    : profile.nodata;
  return clone({
    schemaVersion: SCREEN_04_SAMPLE_PROFILE_SCHEMA_VERSION,
    mode: profile.activeMode,
    internalBinding: profile.internalBinding,
    description: active.description,
    datasetFieldMappings:
      profile.activeMode === "dataset" ? profile.dataset.fieldMappings : null,
    exposureMapping:
      profile.activeMode === "dataset" ? profile.dataset.exposureMapping : null,
    combinedExposureScenario:
      profile.activeMode === "dataset"
        ? profile.dataset.combinedExposureScenario
        : null,
    overallJudgment:
      profile.activeMode === "dataset" ? profile.dataset.overallJudgment : null,
    scientificFindings: active.scientificFindings,
    unresolvedResearcherChoices: active.unresolvedResearcherChoices,
    assessment:
      profile.activeMode === "dataset" &&
        profile.dataset.assessment?.status === "completed"
        ? profile.dataset.assessment
        : null,
    completionStatus: active.completion.status,
  });
}

export function screen04SampleProfileBindingIsCurrent(
  profile: Screen04SampleProfile,
  binding: Screen04EventCardBinding,
) {
  const internal = requireScreen04SampleProfile(profile).internalBinding;
  return internal.screen02RunId === binding.screen02.runId &&
    internal.selectedEventId === binding.screen02.selectedEventId &&
    internal.selectedEventFingerprint ===
      binding.screen02.selectedEventFingerprint &&
    internal.handoffFingerprint === binding.screen02.handoffFingerprint &&
    internal.screen03RunId === binding.screen03.runId &&
    internal.eventCardId === binding.eventCard.id &&
    internal.eventCardVersion === binding.eventCard.version &&
    internal.eventCardFingerprint === binding.eventCard.fingerprint &&
    internal.bindingFingerprint === binding.bindingFingerprint &&
    internal.verifiedShockName === binding.verifiedShockName;
}

export function rebindScreen04SampleProfile(
  value: Screen04SampleProfile,
  binding: Screen04EventCardBinding,
  at: string,
): Screen04SampleProfile {
  const profile = requireScreen04SampleProfile(value);
  utc(at, "Sample-profile binding update time");
  return withIntegrity({
    ...clone(profile),
    internalBinding: bindingFromEventCard(binding),
    updatedAt: at,
  });
}
