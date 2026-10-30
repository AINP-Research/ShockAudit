import {
  Screen04CoreError,
  inspectScreen04CsvHeader,
  scanScreen04SelectedCsv,
  type Screen04ExposureStatus,
} from "./screen04-feasibility";
import {
  evaluateScreen04RuleExpression,
  type Screen04RuleExpression,
} from "./screen04-rule-ast";
import {
  SCREEN_04_SCIENTIFIC_HEURISTICS,
  screen04Number,
  screen04Percent,
  screen04Ratio,
  screen04Share,
} from "./screen04-heuristics";
import type { Screen04ExposureDimension } from "./screen04-event-card-binding";
import { SCREEN_04_SCIENTIFIC_ASSESSMENT_SCHEMA_VERSION } from "./screen04-scientific-schema";
import type {
  Screen04AdvancedFinding,
  Screen04AdvancedFindingCode,
  Screen04AdvancedAggregateExposureFact,
  Screen04AdvancedAssignmentContext,
  Screen04AdvancedCaseFact,
  Screen04AdvancedDiagnosticResult,
  Screen04AdvancedReasonCategory,
  Screen04AdvancedScenario,
  Screen04AdvancedTreatmentStage,
  Screen04AdvancedWhereItOccurs,
  Screen04V0403ConsequenceOrder,
  Screen04V0403Severity,
} from "./screen04-advanced-diagnostics";

export { SCREEN_04_SCIENTIFIC_ASSESSMENT_SCHEMA_VERSION } from "./screen04-scientific-schema";

export type Screen04ComparisonBasis =
  | "geography"
  | "industry"
  | "size-or-threshold"
  | "organization-type"
  | "legal-eligibility"
  | "staggered-adoption"
  | "another-distinction";

export type Screen04GeographicConcept =
  | "headquarters"
  | "operating-location"
  | "incorporation"
  | "residence"
  | "establishment-or-facility-location"
  | "another-geographic-concept";

export type Screen04AssignmentUnit =
  | "firm"
  | "parent-company"
  | "subsidiary"
  | "establishment"
  | "facility"
  | "individual"
  | "geographic-area"
  | "another-unit";

export type Screen04VerifiedDateRole =
  | "announcement"
  | "enactment"
  | "effective"
  | "implementation"
  | "compliance"
  | "enforcement"
  | "amendment"
  | "repeal-or-delay"
  | "other";

export type Screen04ScientificFindingCategory =
  | "Treatment definition"
  | "Timing"
  | "Comparison group"
  | "Sample support"
  | "Treatment variation";

export type Screen04ScientificOverallJudgment =
  | "The proposed exposure design is broadly usable"
  | "Review several exposure choices"
  | "Revise the treatment or comparison definition"
  | "More information is needed before exposure can be checked"
  | "Fix the dataset setup before continuing";

export type Screen04ScientificFinding = {
  category: Screen04ScientificFindingCategory;
  title: string;
  whatFound: string;
  whyItMatters: string;
  possibleNextStep: string | null;
  priority: "high" | "medium" | "review";
  /** Additive v0.4.03 reader-facing fields; legacy saved findings omit them. */
  severity?: Screen04V0403Severity;
  diagnosticTitle?: string;
  whereItOccurs?: Screen04AdvancedWhereItOccurs;
  code?: Screen04AdvancedFindingCode;
  consequenceOrder?: Screen04V0403ConsequenceOrder;
  aggregate?: Screen04AdvancedFinding["aggregate"];
};

export type Screen04SetupIssue = {
  field:
    | "file"
    | "unitIdentifier"
    | "year"
    | "treatmentGroup"
    | "treatmentYear"
    | "treatedValue"
    | "comparisonValue"
    | "treatmentGroupDescription"
    | "comparisonGroupDescription"
    | "comparisonBasis"
    | "geographicConcept"
    | "assignmentUnit"
    | "exposureRule";
  title: string;
  message: string;
  blocking: boolean;
};

export type Screen04ScientificDatasetMappings = {
  unitIdentifier: string;
  year: string;
  treatmentGroup: string;
  researcherTreatmentYear: number;
  treatedValue: string;
  comparisonValue: string;
  /** Explicit only: ShockAudit never infers assignment crosswalk columns. */
  assignmentLowerLevelIdentifier?: string | null;
  assignmentAggregateIdentifier?: string | null;
};

export type Screen04ScientificStudyDescription = {
  unitOfAnalysis: string;
  sampleUnitDescription: string;
  dataFrequency: "annual" | string;
  treatmentGroupDescription: string;
  comparisonGroupDescription: string;
  mainComparisonBasis: Screen04ComparisonBasis;
  groupGeographicConcept?: Screen04GeographicConcept | null;
  shockGeographicConcept?: Screen04GeographicConcept | null;
  groupGeographyColumn?: string | null;
  treatmentGroupGeographicValues?: string | null;
  comparisonGroupGeographicValues?: string | null;
  datasetAssignmentUnit?: Screen04AssignmentUnit | null;
  shockAssignmentUnit?: Screen04AssignmentUnit | null;
};

export type Screen04VerifiedDate = {
  label: string;
  date: string;
  role: Screen04VerifiedDateRole;
};

export type Screen04ThresholdMeasurement = {
  csvColumn: string;
  threshold: number;
  thresholdUnit: string;
  sourceUnit: string;
  /** Whether the selected column already represents the historical year or
   * values must be taken from that year of the annual panel. */
  historicalValueSource?: "column-values" | "panel-year";
  requiredHistoricalMeasurementYear?: number | null;
  mappedHistoricalMeasurementYear?: number | null;
};

export type Screen04CoverageVariableRule = {
  approach: "coverage-variable";
  column: string;
  coveredValue: string;
  effectiveYear: number;
  label?: string;
  component?: string;
  version?: string;
};

export type Screen04ConditionRule = {
  approach: "conditions";
  expression: Screen04RuleExpression;
  effectiveYear: number;
  label?: string;
  component?: string;
  version?: string;
  thresholdMeasurements?: readonly Screen04ThresholdMeasurement[];
};

export type Screen04ScientificExposureRule =
  | Screen04CoverageVariableRule
  | Screen04ConditionRule;

export type Screen04ScientificAssessmentInput = {
  csvText: string;
  verifiedShockName: string;
  mappings: Screen04ScientificDatasetMappings;
  studyDescription: Screen04ScientificStudyDescription;
  verifiedDates: readonly Screen04VerifiedDate[];
  /** Reader-facing consolidated dimensions projected by the v2 Event Card binding. */
  exposureDimensions?: readonly Pick<
    Screen04ExposureDimension,
    "kind" | "label" | "summary"
  >[];
  exposureRule: Screen04ScientificExposureRule | null;
  /** Explicit v0.4.03 coverage-route choice. Omitted inputs retain legacy
   * inference; only an explicit skip makes a null rule a neutral choice. */
  coverageMatchingIntent?: "skip" | "coverage-variable" | "conditions";
  /** Later stages, components, or amendments that can change exposure. */
  additionalExposureRules?: readonly Screen04ScientificExposureRule[];
  /** Researcher-selected packages; indexes address the filtered rule list. */
  combinedExposureScenarios?: readonly {
    name: string;
    ruleIndexes: readonly number[];
  }[];
  /** Optional supplied crosswalk facts. They are never inferred from labels. */
  assignmentCrosswalk?: Pick<
    Screen04AdvancedAssignmentContext,
    "crosswalkStatus" | "withinAggregateExposure"
  > | null;
};

export type Screen04GroupSupportMetrics = {
  uniqueUnits: number;
  unitPeriodObservations: number;
  preTreatmentYears: number;
  postTreatmentYears: number;
  unitsObservedOnBothSides: number;
  unitsObservedOnlyBefore: number;
  unitsObservedOnlyAfter: number;
  unitsEnteringAfterTreatment: number;
  unitsExitingBeforeOrImmediatelyAfterTreatment: number;
  unitsWithInternalGaps: number;
};

export type Screen04ThresholdReviewMetrics = {
  column: string;
  threshold: number;
  exactlyAtThreshold: number;
  withinFivePercent: number;
  missingOrInvalid: number;
  unitMismatch: boolean;
  historicalMeasurementYearMismatch: boolean;
};

export type Screen04ScientificMetrics = {
  rowCount: number;
  observedYearRange: { earliest: number; latest: number };
  treatedToComparisonUnitRatio: number | null;
  treated: Screen04GroupSupportMetrics;
  comparison: Screen04GroupSupportMetrics;
  internalMissingYears: number;
  groupCountsByYear: readonly {
    year: number;
    treatedUnits: number;
    comparisonUnits: number;
  }[];
  exposure: {
    exposedObservations: number;
    unexposedObservations: number;
    unknownObservations: number;
    notApplicableObservations: number;
    proposedTreatedAuditedUnexposedUnits: number;
    proposedTreatedAuditedUnexposedObservations: number;
    proposedTreatedAuditedUnexposedYears: readonly number[];
    proposedTreatedAuditedUnexposedReasons: readonly string[];
    proposedComparisonAuditedExposedUnits: number;
    proposedComparisonAuditedExposedObservations: number;
    proposedComparisonAuditedExposedYears: readonly number[];
    proposedComparisonAuditedExposedReasons: readonly string[];
    unknownExposureUnits: number;
    unknownExposureObservations: number;
  };
  thresholdReviews: readonly Screen04ThresholdReviewMetrics[];
};

export type Screen04ScientificAssessmentResult = {
  schemaVersion: typeof SCREEN_04_SCIENTIFIC_ASSESSMENT_SCHEMA_VERSION;
  verifiedShockName: string;
  overallJudgment: Screen04ScientificOverallJudgment;
  setupIssues: readonly Screen04SetupIssue[];
  metrics: Screen04ScientificMetrics | null;
  priorityFindings: readonly Screen04ScientificFinding[];
  otherFindings: readonly Screen04ScientificFinding[];
  unresolvedResearcherChoices: readonly string[];
  /** Neutral process notes are separate from setup issues and findings. */
  assessmentNotes?: readonly string[];
  /** Additive v0.4.03 evidence; absent/legacy saved results remain valid. */
  advancedDiagnostics?: Screen04AdvancedDiagnosticResult | null;
};

type ParsedRow = {
  unitId: string;
  year: number;
  group: string;
  values: Readonly<Record<string, string>>;
  exposure: Screen04ExposureStatus;
  componentExposure: readonly Screen04ExposureStatus[];
};

type RuleValidation = {
  usableRules: Screen04ScientificExposureRule[];
  unusableRuleEffectiveYears: number[];
  selectedColumns: string[];
  thresholdMeasurements: Screen04ThresholdMeasurement[];
  setupIssues: Screen04SetupIssue[];
};

const roleLabels: Record<Screen04VerifiedDateRole, string> = {
  announcement: "announcement",
  enactment: "enactment",
  effective: "effective date",
  implementation: "implementation",
  compliance: "compliance",
  enforcement: "enforcement",
  amendment: "amendment",
  "repeal-or-delay": "repeal or delay",
  other: "event stage",
};

const findingCategoryOrder: Record<Screen04ScientificFindingCategory, number> = {
  "Treatment definition": 0,
  Timing: 1,
  "Comparison group": 2,
  "Sample support": 3,
  "Treatment variation": 4,
};

const findingPriorityOrder = { high: 0, medium: 1, review: 2 } as const;

export const SCREEN_04_MAX_ROW_SETUP_ISSUE_DETAILS = 8;

function coverageMatchingWasExplicitlySkipped(
  input: Screen04ScientificAssessmentInput,
): boolean {
  return input.coverageMatchingIntent === "skip" && input.exposureRule === null;
}

function unique<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values));
}

function plural(count: number, singular: string, pluralValue = `${singular}s`) {
  return count === 1 ? singular : pluralValue;
}

function readerExcerpt(value: string, maximum = 160): string {
  const normalized = value.replace(/\s+/gu, " ").trim();
  return normalized.length <= maximum
    ? normalized
    : `${normalized.slice(0, maximum - 1).trimEnd()}…`;
}

function exactYear(date: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(date);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isInteger(year) &&
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() + 1 === month &&
      parsed.getUTCDate() === day
    ? year
    : null;
}

function finding(
  category: Screen04ScientificFindingCategory,
  title: string,
  whatFound: string,
  whyItMatters: string,
  possibleNextStep: string | null,
  priority: Screen04ScientificFinding["priority"],
): Screen04ScientificFinding {
  return {
    category,
    title,
    whatFound,
    whyItMatters,
    possibleNextStep,
    priority,
  };
}

function setupIssue(
  field: Screen04SetupIssue["field"],
  title: string,
  message: string,
  blocking: boolean,
): Screen04SetupIssue {
  return { field, title, message, blocking };
}

function deduplicateSetupIssues(
  issues: readonly Screen04SetupIssue[],
): Screen04SetupIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = JSON.stringify(issue);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function leafColumns(expression: Screen04RuleExpression): string[] {
  if (expression.kind === "all" || expression.kind === "any") {
    return expression.rules.flatMap(leafColumns);
  }
  if (expression.kind === "not") return leafColumns(expression.rule);
  return [expression.csvColumn];
}

function leafCount(expression: Screen04RuleExpression): number {
  return leafColumns(expression).length;
}

function numericLeaves(
  expression: Screen04RuleExpression,
): Array<Extract<Screen04RuleExpression, { kind: "numeric-threshold" }>> {
  if (expression.kind === "all" || expression.kind === "any") {
    return expression.rules.flatMap(numericLeaves);
  }
  if (expression.kind === "not") return numericLeaves(expression.rule);
  return expression.kind === "numeric-threshold" ? [expression] : [];
}

const exposureDimensionReasonLabels: Partial<
  Record<Screen04ExposureDimension["kind"], string>
> = {
  geography: "geography",
  "organization-type": "organization type",
  threshold: "threshold",
  exemption: "exemption",
  "implementation-stage": "implementation stage",
  "treatment-component": "treatment component",
  "amendment-version": "amendment or version",
};

function expressionReasonCategories(
  expression: Screen04RuleExpression,
): string[] {
  if (expression.kind === "all" || expression.kind === "any") {
    return unique(expression.rules.flatMap(expressionReasonCategories));
  }
  if (expression.kind === "not") {
    return expressionReasonCategories(expression.rule);
  }
  const dimension = expression.requirementId.split(":", 1)[0] as
    Screen04ExposureDimension["kind"];
  return [exposureDimensionReasonLabels[dimension] ?? "coverage condition"];
}

function ruleReasonCategories(
  rules: readonly Screen04ScientificExposureRule[],
): string[] {
  return unique(rules.flatMap((rule) =>
    rule.approach === "coverage-variable"
      ? ["coverage variable"]
      : expressionReasonCategories(rule.expression)
  ));
}

function expressionIsComplete(expression: Screen04RuleExpression): boolean {
  if (expression.kind === "all" || expression.kind === "any") {
    return expression.rules.length > 0 && expression.rules.every(expressionIsComplete);
  }
  if (expression.kind === "not") return expressionIsComplete(expression.rule);
  if (!expression.csvColumn || !expression.requirementId) return false;
  if (expression.kind === "categorical-equals") return expression.value.length > 0;
  return Number.isFinite(expression.threshold) &&
    expression.thresholdUnit.length > 0 &&
    expression.sourceUnit.length > 0;
}

/**
 * Ordinary condition rules allow one nested "at least one threshold" group.
 * NOT is reserved for one explicit categorical exemption.
 */
function expressionUsesSupportedNesting(expression: Screen04RuleExpression): boolean {
  let nestedAnyCount = 0;
  const visit = (node: Screen04RuleExpression, depth: number): boolean => {
    if (node.kind === "not") {
      return depth <= 1 && node.rule.kind === "categorical-equals";
    }
    if (node.kind !== "all" && node.kind !== "any") return true;
    if (depth > 1) return false;
    if (depth === 1) {
      if (node.kind !== "any" ||
        !node.rules.every((rule) => rule.kind === "numeric-threshold")) {
        return false;
      }
      nestedAnyCount += 1;
      if (nestedAnyCount > 1) return false;
    }
    return node.rules.every((rule) => visit(rule, depth + 1));
  };
  return visit(expression, 0);
}

function validateRules(
  input: Screen04ScientificAssessmentInput,
  headers: readonly string[],
): RuleValidation {
  const proposed = coverageMatchingWasExplicitlySkipped(input) ? [] : [
    ...(input.exposureRule ? [input.exposureRule] : []),
    ...(input.additionalExposureRules ?? []),
  ];
  const setupIssues: Screen04SetupIssue[] = [];
  const usableRules: Screen04ScientificExposureRule[] = [];
  const unusableRuleEffectiveYears: number[] = [];
  const selectedColumns: string[] = [];
  const thresholdMeasurements: Screen04ThresholdMeasurement[] = [];
  const totalConditions = proposed.reduce(
    (sum, rule) => sum + (rule.approach === "coverage-variable" ? 1 : leafCount(rule.expression)),
    0,
  );
  if (totalConditions > SCREEN_04_SCIENTIFIC_HEURISTICS.maximumExposureConditions) {
    setupIssues.push(setupIssue(
      "exposureRule",
      "Too many exposure conditions",
      `Use at most ${SCREEN_04_SCIENTIFIC_HEURISTICS.maximumExposureConditions} exposure conditions. Other checks can still run.`,
      false,
    ));
    unusableRuleEffectiveYears.push(
      ...proposed.map((rule) =>
        Number.isInteger(rule.effectiveYear)
          ? rule.effectiveYear
          : input.mappings.researcherTreatmentYear
      ),
    );
    return {
      usableRules,
      unusableRuleEffectiveYears,
      selectedColumns,
      thresholdMeasurements,
      setupIssues,
    };
  }
  for (const rule of proposed) {
    if (!Number.isInteger(rule.effectiveYear)) {
      unusableRuleEffectiveYears.push(input.mappings.researcherTreatmentYear);
      setupIssues.push(setupIssue(
        "exposureRule",
        "Effective year is incomplete",
        "Enter a four-digit effective year. Other checks can still run.",
        false,
      ));
      continue;
    }
    const columns = rule.approach === "coverage-variable"
      ? [rule.column]
      : leafColumns(rule.expression);
    const complete = rule.approach === "coverage-variable"
      ? rule.column.length > 0 && rule.coveredValue.length > 0
      : expressionIsComplete(rule.expression) &&
        expressionUsesSupportedNesting(rule.expression);
    if (!complete) {
      unusableRuleEffectiveYears.push(rule.effectiveYear);
      setupIssues.push(setupIssue(
        "exposureRule",
        "Exposure rule is incomplete",
        "Complete the columns, values, and condition logic. Other checks can still run.",
        false,
      ));
      continue;
    }
    const missing = columns.filter((column) => !headers.includes(column));
    if (missing.length > 0) {
      unusableRuleEffectiveYears.push(rule.effectiveYear);
      for (const column of unique(missing)) {
        const caseMatch = headers.find(
          (header) => header.toLocaleLowerCase("en-US") ===
            column.toLocaleLowerCase("en-US"),
        );
        setupIssues.push(setupIssue(
          "exposureRule",
          "Column not found",
          caseMatch
            ? `The dataset contains \`${caseMatch}\`, not \`${column}\`. Select the exact name; other checks can still run.`
            : `The dataset lacks exact column \`${column}\`. Other checks can still run.`,
          false,
        ));
      }
      continue;
    }
    usableRules.push(rule);
    selectedColumns.push(...columns);
    if (rule.approach === "conditions") {
      const supplied = rule.thresholdMeasurements ?? [];
      thresholdMeasurements.push(...supplied);
      for (const leaf of numericLeaves(rule.expression)) {
        if (supplied.some((item) => item.csvColumn === leaf.csvColumn)) continue;
        thresholdMeasurements.push({
          csvColumn: leaf.csvColumn,
          threshold: leaf.threshold,
          thresholdUnit: leaf.thresholdUnit,
          sourceUnit: leaf.sourceUnit,
        });
      }
    }
  }
  if (input.exposureRule === null &&
    !coverageMatchingWasExplicitlySkipped(input)) {
    if (input.coverageMatchingIntent === undefined) {
      setupIssues.push(setupIssue(
        "exposureRule",
        "Some exposure conditions are not mapped",
        "Other checks can run, but ShockAudit cannot classify every unit's coverage.",
        false,
      ));
    } else {
      const route = input.coverageMatchingIntent === "coverage-variable"
        ? "selected coverage variable"
        : "selected coverage conditions";
      setupIssues.push(setupIssue(
        "exposureRule",
        `The ${route} are not mapped`,
        `Complete the ${route} to classify row-level coverage. Other checks can still run.`,
        false,
      ));
    }
  }
  return {
    usableRules,
    unusableRuleEffectiveYears,
    selectedColumns: unique(selectedColumns),
    thresholdMeasurements,
    setupIssues,
  };
}

function structuralMappingIssues(
  input: Screen04ScientificAssessmentInput,
  headers: readonly string[],
): Screen04SetupIssue[] {
  const issues: Screen04SetupIssue[] = [];
  const exactMappings = [
    ["unitIdentifier", "Unit identifier", input.mappings.unitIdentifier],
    ["year", "Annual time variable", input.mappings.year],
    ["treatmentGroup", "Treatment-group variable", input.mappings.treatmentGroup],
  ] as const;
  for (const [field, label, column] of exactMappings) {
    if (!column) {
      issues.push(setupIssue(
        field,
        `${label} is required`,
        `Select the exact CSV column for ${label.toLocaleLowerCase("en-US")}.`,
        true,
      ));
      continue;
    }
    if (headers.includes(column)) continue;
    const caseMatch = headers.find(
      (header) => header.toLocaleLowerCase("en-US") ===
        column.toLocaleLowerCase("en-US"),
    );
    const whitespaceMatch = headers.find(
      (header) => header.trim() === column.trim(),
    );
    issues.push(setupIssue(
      field,
      "Column not found",
      caseMatch
        ? `The dataset contains \`${caseMatch}\`, not \`${column}\`. Select the exact column name.`
        : whitespaceMatch
          ? `The dataset contains \`${whitespaceMatch}\` with different whitespace. Select or rename the exact column.`
          : `The dataset does not contain the exact column \`${column}\`.`,
      true,
    ));
  }
  const lowerLevelColumn = input.mappings.assignmentLowerLevelIdentifier?.trim() || "";
  const aggregateColumn = input.mappings.assignmentAggregateIdentifier?.trim() || "";
  if (Boolean(lowerLevelColumn) !== Boolean(aggregateColumn)) {
    issues.push(setupIssue(
      "assignmentUnit",
      "Both assignment identifiers are needed",
      "Select both the lower-level identifier and its aggregate-unit identifier to calculate assignment-level exposure. Other checks can still run.",
      false,
    ));
  }
  for (const [label, column] of [
    ["lower-level identifier", lowerLevelColumn],
    ["aggregate-unit identifier", aggregateColumn],
  ] as const) {
    if (column && !headers.includes(column)) {
      issues.push(setupIssue(
        "assignmentUnit",
        "Assignment identifier column not found",
        `The dataset lacks exact ${label} column \`${column}\`. Other checks can still run.`,
        false,
      ));
    }
  }
  if (lowerLevelColumn && lowerLevelColumn === aggregateColumn) {
    issues.push(setupIssue(
      "assignmentUnit",
      "Assignment identifiers must be distinct",
      "Choose different lower-level and aggregate-unit identifier columns.",
      false,
    ));
  }
  if (
    new Set(exactMappings.map(([, , column]) => column).filter(Boolean)).size !==
      exactMappings.filter(([, , column]) => Boolean(column)).length
  ) {
    issues.push(setupIssue(
      "file",
      "Required columns must be distinct",
      "Use different exact columns for the unit identifier, annual time variable, and treatment-group variable.",
      true,
    ));
  }
  if (!Number.isInteger(input.mappings.researcherTreatmentYear) ||
    input.mappings.researcherTreatmentYear < 1000 ||
    input.mappings.researcherTreatmentYear > 9999) {
    issues.push(setupIssue(
      "treatmentYear",
      "Treatment year is invalid",
      "Enter a four-digit annual treatment year.",
      true,
    ));
  }
  if (!input.mappings.treatedValue) {
    issues.push(setupIssue(
      "treatedValue",
      "Treated value is required",
      "Enter the exact dataset value that identifies the proposed treatment group.",
      true,
    ));
  }
  if (!input.mappings.comparisonValue) {
    issues.push(setupIssue(
      "comparisonValue",
      "Comparison value is required",
      "Enter the exact dataset value that identifies the proposed comparison group.",
      true,
    ));
  }
  if (input.mappings.treatedValue &&
    input.mappings.treatedValue === input.mappings.comparisonValue) {
    issues.push(setupIssue(
      "comparisonValue",
      "Treated and comparison values are the same",
      "Choose two different exact values for the proposed groups.",
      true,
    ));
  }
  if (input.studyDescription.dataFrequency !== "annual") {
    issues.push(setupIssue(
      "file",
      "Unsupported file structure",
      "This Screen 4 assessment currently supports annual unit-period CSV data.",
      true,
    ));
  }
  if (!input.studyDescription.treatmentGroupDescription.trim()) {
    issues.push(setupIssue(
      "treatmentGroupDescription",
      "Treatment-group description is required",
      "Describe in plain language what the proposed treatment group represents.",
      true,
    ));
  }
  if (!input.studyDescription.comparisonGroupDescription.trim()) {
    issues.push(setupIssue(
      "comparisonGroupDescription",
      "Comparison-group description is required",
      "Describe in plain language what the proposed comparison group represents.",
      true,
    ));
  }
  if (input.studyDescription.mainComparisonBasis === "geography" &&
    !input.studyDescription.groupGeographicConcept) {
    issues.push(setupIssue(
      "geographicConcept",
      "Geographic concept is required",
      "Confirm the geographic concept used by the groups.",
      true,
    ));
  }
  return issues;
}

function safeCoreIssue(error: unknown): Screen04SetupIssue {
  if (error instanceof Screen04CoreError) {
    const title = error.code === "SCREEN04_EMPTY_CSV"
      ? "CSV is empty"
      : error.code === "SCREEN04_DUPLICATE_HEADER"
        ? "Duplicate CSV header"
        : error.code === "SCREEN04_FILE_LIMIT_EXCEEDED" ||
            error.code === "SCREEN04_ROW_LIMIT_EXCEEDED" ||
            error.code === "SCREEN04_COLUMN_LIMIT_EXCEEDED"
          ? "CSV exceeds the supported limit"
          : "Unsupported file structure";
    return setupIssue("file", title, error.message, true);
  }
  return setupIssue(
    "file",
    "CSV could not be read",
    "Save the file as a bounded UTF-8 CSV with one header row and try again.",
    true,
  );
}

function evaluateOneRule(
  rule: Screen04ScientificExposureRule,
  year: number,
  values: Readonly<Record<string, string>>,
): Screen04ExposureStatus {
  if (year < rule.effectiveYear) return "not_applicable";
  if (rule.approach === "coverage-variable") {
    const value = values[rule.column];
    return value === undefined || value.length === 0
      ? "unknown"
      : value === rule.coveredValue
        ? "exposed"
        : "unexposed";
  }
  const evaluation = evaluateScreen04RuleExpression(rule.expression, values);
  return evaluation.matched === true
    ? "exposed"
    : evaluation.matched === false
      ? "unexposed"
      : "unknown";
}

function aggregateExposure(
  componentExposure: readonly Screen04ExposureStatus[],
): Screen04ExposureStatus {
  if (componentExposure.length === 0) return "unknown";
  if (componentExposure.every((status) => status === "not_applicable")) {
    return "not_applicable";
  }
  if (componentExposure.some((status) => status === "exposed")) {
    return "exposed";
  }
  if (componentExposure.some((status) => status === "unknown")) {
    return "unknown";
  }
  return "unexposed";
}

function parseYear(value: string): number | null {
  if (!/^\d{4}$/u.test(value)) return null;
  const year = Number(value);
  return year >= 1000 && year <= 9999 ? year : null;
}

function parseRows(
  input: Screen04ScientificAssessmentInput,
  headers: readonly string[],
  ruleValidation: RuleValidation,
): { rows: ParsedRow[]; setupIssues: Screen04SetupIssue[] } {
  const setupIssues: Screen04SetupIssue[] = [];
  let detailedRowIssueCount = 0;
  let omittedRowIssueCount = 0;
  const addRowIssue = (issue: Screen04SetupIssue) => {
    if (detailedRowIssueCount < SCREEN_04_MAX_ROW_SETUP_ISSUE_DETAILS) {
      setupIssues.push(issue);
      detailedRowIssueCount += 1;
    } else {
      omittedRowIssueCount += 1;
    }
  };
  const rows: ParsedRow[] = [];
  const mapping = input.mappings;
  const selectedColumns = unique([
    mapping.unitIdentifier,
    mapping.year,
    mapping.treatmentGroup,
    mapping.assignmentLowerLevelIdentifier ?? "",
    mapping.assignmentAggregateIdentifier ?? "",
    ...ruleValidation.selectedColumns,
  ]).filter((column) => column.length > 0 && headers.includes(column));
  const unitYears = new Set<string>();
  const groupByUnit = new Map<string, string>();
  let treatedRows = 0;
  let comparisonRows = 0;
  try {
    scanScreen04SelectedCsv(input.csvText, selectedColumns, (values, recordNumber) => {
      const unitId = values[mapping.unitIdentifier] ?? "";
      const year = parseYear(values[mapping.year] ?? "");
      const group = values[mapping.treatmentGroup] ?? "";
      if (!unitId) {
        addRowIssue(setupIssue(
          "unitIdentifier",
          "Unit identifier is missing",
          `The selected unit identifier is empty at record ${recordNumber}.`,
          true,
        ));
      }
      if (year === null) {
        addRowIssue(setupIssue(
          "year",
          "Annual time value is invalid",
          `Record ${recordNumber} does not contain an exact four-digit year in the selected time column.`,
          true,
        ));
      }
      if (group !== mapping.treatedValue && group !== mapping.comparisonValue) {
        addRowIssue(setupIssue(
          "treatmentGroup",
          "Treatment-group value is invalid",
          `Record ${recordNumber} contains a missing or unselected group value.`,
          true,
        ));
      }
      if (!unitId || year === null ||
        (group !== mapping.treatedValue && group !== mapping.comparisonValue)) {
        return;
      }
      const unitYear = JSON.stringify([unitId, year]);
      if (unitYears.has(unitYear)) {
        addRowIssue(setupIssue(
          "file",
          "Duplicate unit-year",
          `More than one observation uses the same selected unit and year at record ${recordNumber}.`,
          true,
        ));
      }
      unitYears.add(unitYear);
      const priorGroup = groupByUnit.get(unitId);
      if (priorGroup !== undefined && priorGroup !== group) {
        addRowIssue(setupIssue(
          "treatmentGroup",
          "Treatment-group membership changes",
          "At least one unit changes groups. Confirm whether that is intended.",
          true,
        ));
      }
      groupByUnit.set(unitId, group);
      if (group === mapping.treatedValue) treatedRows += 1;
      if (group === mapping.comparisonValue) comparisonRows += 1;
      const componentExposure = [
        ...ruleValidation.usableRules.map((rule) =>
          evaluateOneRule(rule, year, values)
        ),
        ...ruleValidation.unusableRuleEffectiveYears.map((effectiveYear) =>
          year < effectiveYear ? "not_applicable" as const : "unknown" as const
        ),
      ];
      rows.push({
        unitId,
        year,
        group,
        values,
        componentExposure,
        exposure: aggregateExposure(componentExposure),
      });
    });
  } catch (error) {
    setupIssues.push(safeCoreIssue(error));
  }
  if (omittedRowIssueCount > 0) {
    setupIssues.push(setupIssue(
      "file",
      "Additional row problems were omitted",
      `${omittedRowIssueCount} additional row-level ${plural(omittedRowIssueCount, "problem")} were found after the first ${SCREEN_04_MAX_ROW_SETUP_ISSUE_DETAILS} bounded details.`,
      true,
    ));
  }
  const historicalMeasurements = ruleValidation.thresholdMeasurements.filter(
    (measurement) =>
      measurement.historicalValueSource === "panel-year" &&
      ((measurement.requiredHistoricalMeasurementYear !== undefined &&
        measurement.requiredHistoricalMeasurementYear !== null) ||
      (measurement.mappedHistoricalMeasurementYear !== undefined &&
        measurement.mappedHistoricalMeasurementYear !== null)),
  );
  if (historicalMeasurements.length > 0) {
    for (const unitRows of rowsByUnit(rows).values()) {
      const historicalValues: Record<string, string> = {};
      for (const measurement of historicalMeasurements) {
        const mappedYear = measurement.mappedHistoricalMeasurementYear;
        const source = mappedYear === undefined || mappedYear === null
          ? undefined
          : unitRows.find((row) => row.year === mappedYear);
        // A missing/unconfirmed historical observation stays unknown. Never
        // fall back to a contemporaneous value for a historically defined
        // legal threshold.
        historicalValues[measurement.csvColumn] =
          source?.values[measurement.csvColumn] ?? "";
      }
      if (Object.keys(historicalValues).length === 0) continue;
      for (const row of unitRows) {
        row.values = { ...row.values, ...historicalValues };
        row.componentExposure = [
          ...ruleValidation.usableRules.map((rule) =>
            evaluateOneRule(rule, row.year, row.values)
          ),
          ...ruleValidation.unusableRuleEffectiveYears.map((effectiveYear) =>
            row.year < effectiveYear
              ? "not_applicable" as const
              : "unknown" as const
          ),
        ];
        row.exposure = aggregateExposure(row.componentExposure);
      }
    }
  }
  if (rows.length > 0 && treatedRows === 0) {
    setupIssues.push(setupIssue(
      "treatedValue",
      "No treated value is present",
      `No observation contains the exact treated value \`${mapping.treatedValue}\`.`,
      true,
    ));
  }
  if (rows.length > 0 && comparisonRows === 0) {
    setupIssues.push(setupIssue(
      "comparisonValue",
      "No comparison value is present",
      `No observation contains the exact comparison value \`${mapping.comparisonValue}\`.`,
      true,
    ));
  }
  return { rows, setupIssues };
}

type AdvancedRuleEntry = {
  rule: Screen04ScientificExposureRule;
  ruleIndex: number;
  componentIndex: number;
  verifiedDate: Screen04VerifiedDate;
};

type DerivedAdvancedScenarios = {
  scenarios: Screen04AdvancedScenario[];
  omittedScenarioCount: number;
  boundaryMessages: string[];
};

function advancedReasonForRequirement(
  requirementId: string,
  expressionKind?: Screen04RuleExpression["kind"],
): Screen04AdvancedReasonCategory {
  const normalized = requirementId.toLocaleLowerCase("en-US");
  if (/exempt|exception|carve.?out/u.test(normalized)) return "exemption";
  if (/organization.?type|entity.?type|business.?type|provider.?type|firm.?type/u.test(normalized)) {
    return "organization-type";
  }
  if (/geograph|location|state|resident|nexus|headquarter|incorporat/u.test(normalized)) {
    return "geography";
  }
  if (expressionKind === "numeric-threshold" ||
    /threshold|revenue|volume|employee|size/u.test(normalized)) {
    return "threshold";
  }
  if (/amend|version|expansion/u.test(normalized)) return "amendment";
  if (/component|package|stage.?specific/u.test(normalized)) {
    return "treatment-component";
  }
  if (/timing|date|effective|implement|compliance|enforce/u.test(normalized)) {
    return "timing";
  }
  if (/assign|crosswalk|parent|subsidiary|establishment|facility|unit/u.test(normalized)) {
    return "assignment-unit";
  }
  return "coverage-condition";
}

function expressionExposureStatus(
  expression: Screen04RuleExpression,
  values: Readonly<Record<string, string>>,
): Exclude<Screen04ExposureStatus, "not_applicable"> {
  const evaluation = evaluateScreen04RuleExpression(expression, values);
  return evaluation.matched === true
    ? "exposed"
    : evaluation.matched === false
      ? "unexposed"
      : "unknown";
}

function advancedExpressionContributors(
  expression: Screen04RuleExpression,
  values: Readonly<Record<string, string>>,
  target: Exclude<Screen04ExposureStatus, "not_applicable">,
): Screen04AdvancedReasonCategory[] {
  if (expression.kind === "not") {
    const childTarget = target === "exposed"
      ? "unexposed"
      : target === "unexposed"
        ? "exposed"
        : "unknown";
    return advancedExpressionContributors(expression.rule, values, childTarget);
  }
  if (expression.kind === "all" || expression.kind === "any") {
    const childTarget = target;
    const contributing = expression.rules.filter((rule) =>
      expressionExposureStatus(rule, values) === childTarget
    );
    const rawReasons = contributing.flatMap((rule) =>
      advancedExpressionContributors(rule, values, childTarget)
    ).filter((reason) => reason !== "multi-condition");
    const reasons = unique(rawReasons);
    return rawReasons.length > 1
      ? [...reasons, "multi-condition"]
      : reasons;
  }
  return [advancedReasonForRequirement(expression.requirementId, expression.kind)];
}

function advancedReasonsForRule(
  rule: Screen04ScientificExposureRule,
  status: Screen04ExposureStatus,
  values: Readonly<Record<string, string>>,
  assignmentLevelUnresolved: boolean,
): Screen04AdvancedReasonCategory[] {
  const reasons: Screen04AdvancedReasonCategory[] = status === "not_applicable"
    ? ["timing"]
    : rule.approach === "coverage-variable"
      ? ["coverage-condition"]
      : advancedExpressionContributors(rule.expression, values, status);
  if (status === "unknown") reasons.push("missing-information");
  if (assignmentLevelUnresolved && status !== "not_applicable") {
    reasons.push("assignment-unit");
  }
  return unique(reasons);
}

function advancedMissingVariables(
  rule: Screen04ScientificExposureRule,
  row: ParsedRow,
): string[] {
  const columns = rule.approach === "coverage-variable"
    ? [rule.column]
    : leafColumns(rule.expression);
  return unique(columns.filter((column) =>
    (row.values[column] ?? "").trim().length === 0
  )).slice(0, SCREEN_04_SCIENTIFIC_HEURISTICS.maximumExposureConditions);
}

function verifiedDateForEffectiveYear(
  rule: Screen04ScientificExposureRule,
  verifiedDates: readonly Screen04VerifiedDate[],
): Screen04VerifiedDate | null {
  return [...verifiedDates]
    .filter((item) => exactYear(item.date) === rule.effectiveYear)
    .sort((left, right) =>
      left.date.localeCompare(right.date, "en-US") ||
      left.role.localeCompare(right.role, "en-US") ||
      left.label.localeCompare(right.label, "en-US")
    )[0] ?? null;
}

function advancedSourceBasis(
  rules: readonly Screen04ScientificExposureRule[],
  dates: readonly Screen04VerifiedDate[],
): string {
  const dateBasis = unique(dates.map((item) =>
    `${item.label} (${item.role.replaceAll("-", " ")}, ${item.date})`
  ));
  const ruleBasis = unique(rules.flatMap((rule) => [
    rule.label?.trim(),
    rule.component?.trim(),
    rule.version?.trim(),
  ].filter((value): value is string => Boolean(value))));
  return readerExcerpt(
    [...dateBasis, ...ruleBasis].join("; ") || "Selected verified date and mapped coverage rule",
    600,
  );
}

function advancedCaseFact(
  row: ParsedRow,
  input: Screen04ScientificAssessmentInput,
  status: Screen04ExposureStatus,
  rules: readonly Screen04ScientificExposureRule[],
  contextualReasons: readonly Screen04AdvancedReasonCategory[] = [],
): Screen04AdvancedCaseFact {
  const assignmentUnitsDiffer = Boolean(
    input.studyDescription.datasetAssignmentUnit &&
    input.studyDescription.shockAssignmentUnit &&
    input.studyDescription.datasetAssignmentUnit !==
      input.studyDescription.shockAssignmentUnit,
  );
  const crosswalkResolvesAssignment =
    input.assignmentCrosswalk?.crosswalkStatus === "complete" &&
    input.assignmentCrosswalk.withinAggregateExposure === "uniform";
  const perRuleReasons = rules.map((rule) =>
    advancedReasonsForRule(
      rule,
      status,
      row.values,
      assignmentUnitsDiffer && !crosswalkResolvesAssignment,
    )
  );
  const reasons = unique([...perRuleReasons.flat(), ...contextualReasons]);
  if (rules.length > 1 && reasons.length > 0 &&
    !reasons.includes("multi-condition")) {
    reasons.push("multi-condition");
  }
  const missingRepairVariables = status === "unknown"
    ? unique(rules.flatMap((rule) => advancedMissingVariables(rule, row))).slice(
        0,
        SCREEN_04_SCIENTIFIC_HEURISTICS.maximumExposureConditions,
      )
    : [];
  return {
    unitIdentifier: row.unitId,
    year: row.year,
    proposedGroup: row.group === input.mappings.treatedValue
      ? "treated"
      : "comparison",
    auditedStatus: status,
    reasonCategories: reasons,
    missingRepairVariables,
    lowerLevelRepairRequirement:
      status === "unknown" && assignmentUnitsDiffer && !crosswalkResolvesAssignment
        ? "lower-level assignment crosswalk"
        : null,
  };
}

function combinedPackageExposure(
  statuses: readonly Screen04ExposureStatus[],
): Screen04ExposureStatus {
  if (statuses.some((status) => status === "unexposed")) return "unexposed";
  if (statuses.length > 0 && statuses.every((status) => status === "exposed")) {
    return "exposed";
  }
  if (statuses.some((status) => status === "unknown")) return "unknown";
  return "not_applicable";
}

function advancedCombinedCaseFact(
  row: ParsedRow,
  input: Screen04ScientificAssessmentInput,
  entries: readonly AdvancedRuleEntry[],
): Screen04AdvancedCaseFact {
  const statuses = entries.map((entry) =>
    evaluateOneRule(entry.rule, row.year, row.values)
  );
  const status = combinedPackageExposure(statuses);
  const assignmentUnitsDiffer = Boolean(
    input.studyDescription.datasetAssignmentUnit &&
    input.studyDescription.shockAssignmentUnit &&
    input.studyDescription.datasetAssignmentUnit !==
      input.studyDescription.shockAssignmentUnit,
  );
  const crosswalkResolvesAssignment =
    input.assignmentCrosswalk?.crosswalkStatus === "complete";
  const contributingIndexes = status === "exposed"
    ? entries.map((_entry, index) => index)
    : statuses.map((_item, index) => index).filter((index) =>
      statuses[index] === status
    );
  const reasons = unique(contributingIndexes.flatMap((index) => {
    const entry = entries[index]!;
    const entryStatus = statuses[index]!;
    return [
      ...advancedReasonsForRule(
        entry.rule,
        entryStatus,
        row.values,
        assignmentUnitsDiffer && !crosswalkResolvesAssignment,
      ),
      ...(entry.verifiedDate.role === "amendment"
        ? ["amendment" as const]
        : []),
      ...(entry.rule.component?.trim()
        ? ["treatment-component" as const]
        : []),
    ];
  }));
  if (reasons.length > 1 && !reasons.includes("multi-condition")) {
    reasons.push("multi-condition");
  }
  const missingRepairVariables = status === "unknown"
    ? unique(entries.flatMap((entry) =>
      advancedMissingVariables(entry.rule, row)
    )).slice(0, SCREEN_04_SCIENTIFIC_HEURISTICS.maximumExposureConditions)
    : [];
  return {
    unitIdentifier: row.unitId,
    year: row.year,
    proposedGroup: row.group === input.mappings.treatedValue
      ? "treated"
      : "comparison",
    auditedStatus: status,
    reasonCategories: reasons,
    missingRepairVariables,
    lowerLevelRepairRequirement:
      status === "unknown" && assignmentUnitsDiffer && !crosswalkResolvesAssignment
        ? "lower-level assignment crosswalk"
        : null,
  };
}

function deriveAdvancedScenarios(
  input: Screen04ScientificAssessmentInput,
  rows: readonly ParsedRow[],
  ruleValidation: RuleValidation,
): DerivedAdvancedScenarios {
  if (coverageMatchingWasExplicitlySkipped(input)) {
    return { scenarios: [], omittedScenarioCount: 0, boundaryMessages: [] };
  }
  const orderedRules = [
    ...(input.exposureRule ? [input.exposureRule] : []),
    ...(input.additionalExposureRules ?? []),
  ];
  const entries = orderedRules.map((rule, ruleIndex) => ({
    rule,
    ruleIndex,
    componentIndex: ruleIndex,
    verifiedDate: ruleValidation.usableRules.includes(rule)
      ? verifiedDateForEffectiveYear(rule, input.verifiedDates)
      : null,
  })).filter((entry): entry is AdvancedRuleEntry => entry.verifiedDate !== null);
  if (entries.length === 0) {
    return {
      scenarios: [],
      omittedScenarioCount: 0,
      boundaryMessages: (input.combinedExposureScenarios ?? []).length > 0
        ? ["Combined exposure scenarios require at least two complete mapped rules with source-supported dates."]
        : [],
    };
  }

  const scenarioForEntry = (
    entry: AdvancedRuleEntry,
    id: string,
    suppliedName?: string,
    sourceDates: readonly Screen04VerifiedDate[] = [entry.verifiedDate],
  ): Screen04AdvancedScenario => {
    const rule = entry.rule;
    const selectedColumns = unique([
      ...(rule.approach === "coverage-variable"
        ? [rule.column]
        : leafColumns(rule.expression)),
      ...(input.mappings.assignmentLowerLevelIdentifier
        ? [input.mappings.assignmentLowerLevelIdentifier]
        : []),
      ...(input.mappings.assignmentAggregateIdentifier
        ? [input.mappings.assignmentAggregateIdentifier]
        : []),
    ]).sort((left, right) =>
        left.localeCompare(right, "en-US")
    );
    const name = suppliedName || rule.label?.trim() || rule.component?.trim() ||
      rule.version?.trim() || (entry.componentIndex === 0
        ? "Primary mapped coverage definition"
        : entry.verifiedDate.label);
    const componentName = rule.component?.trim() || name;
    return {
      id,
      name: readerExcerpt(name, 200),
      treatmentDate: entry.verifiedDate.date,
      treatmentStage: entry.verifiedDate.role as Screen04AdvancedTreatmentStage,
      coverageVersion: readerExcerpt(
        rule.version?.trim() || "Mapped coverage in force",
        200,
      ),
      componentOrPackage: {
        kind: rule.component ? "component" : "package",
        name: readerExcerpt(componentName, 200),
      },
      sourceBasis: {
        eventCardBasis: advancedSourceBasis([rule], sourceDates),
        selectedColumns,
      },
      cases: rows.map((row) => {
        const status = evaluateOneRule(rule, row.year, row.values);
        return advancedCaseFact(row, input, status, [rule], [
          ...(entry.verifiedDate.role === "amendment"
            ? ["amendment" as const]
            : []),
          ...(rule.component?.trim()
            ? ["treatment-component" as const]
            : []),
        ]);
      }),
    };
  };

  const primary = entries[0]!;
  // Alternative Event Card dates are timing alternatives only when there is
  // one mapped rule. With multiple dated rules, each date is already the
  // supplied stage/version for that rule and must not be crossed with the
  // primary rule. Every timing alternative carries the same complete supplied
  // date basis so that a date choice changes timing, not its source basis.
  const alternativeDates = entries.length === 1
    ? input.verifiedDates
      .filter((date) => exactYear(date.date) !== null)
      .filter((date) => date.date !== primary.verifiedDate.date)
      .sort((left, right) =>
        left.date.localeCompare(right.date, "en-US") ||
        left.role.localeCompare(right.role, "en-US") ||
        left.label.localeCompare(right.label, "en-US")
      )
    : [];
  const sharedTimingSourceDates = [primary.verifiedDate, ...alternativeDates];
  const candidateScenarios: Screen04AdvancedScenario[] = entries.map(
    (entry, index) => scenarioForEntry(
      entry,
      index === 0
        ? "mapped-primary-coverage"
        : `mapped-coverage-alternative-${index}`,
      undefined,
      entries.length === 1 ? sharedTimingSourceDates : [entry.verifiedDate],
    ),
  );
  alternativeDates.forEach((date, index) => {
    const alternativeRule = {
      ...primary.rule,
      effectiveYear: exactYear(date.date)!,
    } satisfies Screen04ScientificExposureRule;
    candidateScenarios.push(scenarioForEntry({
      rule: alternativeRule,
      ruleIndex: primary.ruleIndex,
      componentIndex: primary.componentIndex,
      verifiedDate: date,
    }, `mapped-date-alternative-${index + 1}`,
    `${date.label} timing alternative`, sharedTimingSourceDates));
  });
  const boundaryMessages: string[] = [];
  const combinedSelections = input.combinedExposureScenarios ?? [];
  if (combinedSelections.length > 8) {
    boundaryMessages.push(
      "At most eight researcher-selected combined exposure scenarios can be assessed in one run.",
    );
  } else combinedSelections.forEach((selection, index) => {
    const name = selection.name.replace(/\s+/gu, " ").trim();
    const indexes = unique(selection.ruleIndexes);
    const invalidIndex = indexes.some((ruleIndex) =>
      !Number.isInteger(ruleIndex) || ruleIndex < 0 || ruleIndex >= orderedRules.length
    );
    if (!name || name.length > 200 || indexes.length < 2 || indexes.length > 8 ||
      indexes.length !== selection.ruleIndexes.length || invalidIndex) {
      boundaryMessages.push(
        `Combined exposure scenario ${index + 1} is invalid. Give it a 1–200 character name and select at least two distinct valid rule indexes.`,
      );
      return;
    }
    const selectedEntries = indexes.map((ruleIndex) =>
      entries.find((entry) => entry.ruleIndex === ruleIndex)
    );
    if (selectedEntries.some((entry) => entry === undefined)) {
      boundaryMessages.push(
        `Combined exposure scenario “${readerExcerpt(name, 120)}” refers to a rule without a complete mapped condition and source-supported date.`,
      );
      return;
    }
    const packageEntries = selectedEntries as AdvancedRuleEntry[];
    const sourceDates = packageEntries.map((entry) => entry.verifiedDate);
    const operativeEntry = [...packageEntries].sort((left, right) =>
      right.verifiedDate.date.localeCompare(left.verifiedDate.date, "en-US")
    )[0]!;
    const selectedColumns = unique([
      ...packageEntries.flatMap((entry) =>
        entry.rule.approach === "coverage-variable"
          ? [entry.rule.column]
          : leafColumns(entry.rule.expression)
      ),
      ...(input.mappings.assignmentLowerLevelIdentifier
        ? [input.mappings.assignmentLowerLevelIdentifier]
        : []),
      ...(input.mappings.assignmentAggregateIdentifier
        ? [input.mappings.assignmentAggregateIdentifier]
        : []),
    ]).sort((left, right) => left.localeCompare(right, "en-US"));
    candidateScenarios.push({
      id: `researcher-combined-${index + 1}`,
      name,
      treatmentDate: operativeEntry.verifiedDate.date,
      treatmentStage:
        operativeEntry.verifiedDate.role as Screen04AdvancedTreatmentStage,
      coverageVersion: readerExcerpt(unique(packageEntries.map((entry) =>
        entry.rule.version?.trim() || "Mapped coverage in force"
      )).join(" + "), 200),
      componentOrPackage: { kind: "package", name },
      sourceBasis: {
        eventCardBasis: advancedSourceBasis(
          packageEntries.map((entry) => entry.rule),
          sourceDates,
        ),
        selectedColumns,
      },
      cases: rows.map((row) =>
        advancedCombinedCaseFact(row, input, packageEntries)
      ),
    });
  });
  const scenarios = candidateScenarios.slice(0, 8);
  return {
    scenarios,
    omittedScenarioCount: Math.max(0, candidateScenarios.length - scenarios.length),
    boundaryMessages,
  };
}

async function buildAdvancedDiagnostics(
  input: Screen04ScientificAssessmentInput,
  rows: readonly ParsedRow[],
  ruleValidation: RuleValidation,
): Promise<{
  diagnostics: Screen04AdvancedDiagnosticResult | null;
  notes: string[];
}> {
  const derived = deriveAdvancedScenarios(input, rows, ruleValidation);
  if (derived.boundaryMessages.length > 0) {
    return {
      diagnostics: null,
      notes: derived.boundaryMessages.map((message) =>
        `Advanced treatment-definition diagnostics could not run: ${message}`
      ),
    };
  }
  if (derived.scenarios.length === 0) {
    return { diagnostics: null, notes: [] };
  }
  if (derived.omittedScenarioCount > 0) {
    return {
      diagnostics: null,
      notes: [
        `Advanced treatment-definition diagnostics could not run: the eight-scenario limit would omit ${derived.omittedScenarioCount} additional source-supported timing or coverage alternative${derived.omittedScenarioCount === 1 ? "" : "s"}. Assess a narrower source-supported scenario set, then run the assessment again.`,
      ],
    };
  }
  const datasetUnit = input.studyDescription.datasetAssignmentUnit ?? null;
  const shockUnit = input.studyDescription.shockAssignmentUnit ?? null;
  const unitsAlign = datasetUnit !== null && datasetUnit === shockUnit;
  const lowerLevelColumn = input.mappings.assignmentLowerLevelIdentifier?.trim();
  const aggregateColumn = input.mappings.assignmentAggregateIdentifier?.trim();
  const referenceCases = derived.scenarios[0]!.cases;
  const aggregateExposureFacts: Screen04AdvancedAggregateExposureFact[] = [];
  if (lowerLevelColumn && aggregateColumn && lowerLevelColumn !== aggregateColumn) {
    rows.forEach((row, index) => {
      const lowerLevelUnitIdentifier = (row.values[lowerLevelColumn] ?? "").trim();
      const aggregateUnitIdentifier = (row.values[aggregateColumn] ?? "").trim();
      const referenceCase = referenceCases[index];
      if (!lowerLevelUnitIdentifier || !aggregateUnitIdentifier || !referenceCase) {
        return;
      }
      aggregateExposureFacts.push({
        aggregateUnitIdentifier,
        lowerLevelUnitIdentifier,
        year: row.year,
        auditedStatus: referenceCase.auditedStatus,
      });
    });
  }
  const mappedCrosswalkStatus = lowerLevelColumn && aggregateColumn
    ? aggregateExposureFacts.length === rows.length
      ? "complete" as const
      : aggregateExposureFacts.length > 0
        ? "partial" as const
        : "missing" as const
    : null;
  const aggregateStatuses = new Map<string, Set<Screen04ExposureStatus>>();
  for (const fact of aggregateExposureFacts) {
    if (fact.auditedStatus === "not_applicable") continue;
    const key = JSON.stringify([fact.aggregateUnitIdentifier, fact.year]);
    const values = aggregateStatuses.get(key) ?? new Set();
    values.add(fact.auditedStatus);
    aggregateStatuses.set(key, values);
  }
  const calculatedWithinAggregateExposure = aggregateExposureFacts.length === 0
    ? null
    : aggregateStatuses.size === 0
      ? "unknown" as const
    : [...aggregateStatuses.values()].some((values) =>
      values.has("exposed") && values.has("unexposed")
    )
      ? "mixed" as const
      : [...aggregateStatuses.values()].some((values) => values.has("unknown"))
        ? "unknown" as const
        : "uniform" as const;
  const assignmentContext: Screen04AdvancedAssignmentContext = {
    datasetUnit,
    shockUnit,
    crosswalkStatus: unitsAlign
      ? "not-required"
      : mappedCrosswalkStatus ??
        input.assignmentCrosswalk?.crosswalkStatus ?? "unknown",
    withinAggregateExposure: unitsAlign
      ? "uniform"
      : calculatedWithinAggregateExposure ??
        input.assignmentCrosswalk?.withinAggregateExposure ?? "unknown",
    aggregateExposureFacts,
  };
  try {
    const { runScreen04AdvancedDiagnostics } = await import(
      "./screen04-advanced-diagnostics"
    );
    return {
      diagnostics: runScreen04AdvancedDiagnostics({
      scenarios: derived.scenarios,
      referenceScenarioId: derived.scenarios[0]!.id,
      assignmentContext,
      }),
      notes: [],
    };
  } catch (error) {
    const message = error instanceof Error
      ? readerExcerpt(error.message, 300)
      : "The supplied scenario packet was outside the supported boundary.";
    return {
      diagnostics: null,
      notes: [
        `Advanced treatment-definition diagnostics could not run: ${message} Use at most eight scenarios, eight treatment components, eight repair fields, sixteen selected columns, and 20,000 rows, then assess again.`,
      ],
    };
  }
}

function advancedFindingPresentation(
  finding: Screen04AdvancedFinding,
): {
  category: Screen04ScientificFindingCategory;
  diagnosticTitle: string;
} {
  switch (finding.code) {
    case "SCREEN04_ADVANCED_PROPOSED_CODING_DISAGREEMENT":
      return {
        category: "Treatment definition",
        diagnosticTitle: "Why does your treatment coding differ from the shock rules?",
      };
    case "SCREEN04_ADVANCED_COMPARISON_SURVIVAL":
      return {
        category: "Comparison group",
        diagnosticTitle: "Does your control group remain untreated?",
      };
    case "SCREEN04_ADVANCED_TREATMENT_STABILITY":
      return {
        category: "Treatment definition",
        diagnosticTitle: "How stable is your treatment definition?",
      };
    case "SCREEN04_ADVANCED_VERSION_SEPARABILITY":
      return {
        category: "Treatment variation",
        diagnosticTitle: "Can your data distinguish the treatment stages?",
      };
    case "SCREEN04_ADVANCED_ASSIGNMENT_AGGREGATION":
      return {
        category: "Treatment definition",
        diagnosticTitle: "Is exposure assigned at the same level as your data?",
      };
    case "SCREEN04_ADVANCED_UNKNOWN_COMPOSITION":
      return {
        category: "Treatment definition",
        diagnosticTitle: "How much could unknown exposure change your groups?",
      };
    case "SCREEN04_ADVANCED_REPAIR_PRIORITY":
      return {
        category: "Treatment definition",
        diagnosticTitle: "What information should you collect first?",
      };
  }
}

function scientificFindingFromAdvanced(
  finding: Screen04AdvancedFinding,
): Screen04ScientificFinding {
  const presentation = advancedFindingPresentation(finding);
  return {
    category: presentation.category,
    title: finding.title,
    whatFound: finding.whatFound,
    whyItMatters: finding.whyItMatters,
    possibleNextStep: finding.possibleNextStep,
    priority: finding.severity === "Design blocker" ||
        finding.severity === "Major design concern"
      ? "high"
      : finding.severity === "Review before analysis"
        ? "medium"
        : "review",
    severity: finding.severity,
    diagnosticTitle: presentation.diagnosticTitle,
    whereItOccurs: finding.whereItOccurs,
    code: finding.code,
    consequenceOrder: finding.consequenceOrder,
    aggregate: finding.aggregate,
  };
}

function basicFindingConsequenceOrder(
  findingValue: Screen04ScientificFinding,
): number {
  if ([
    "The sample has no usable exposed-unexposed contrast",
    "No sampled unit appears exposed",
    "The sample begins after universal exposure",
  ].includes(findingValue.title)) return 1;
  if ([
    "Proposed groups do not fully match apparent coverage",
    "Some proposed treated units appear unexposed",
    "Some proposed comparison units appear exposed",
    "The group geography may not represent exposure",
  ].includes(findingValue.title)) return 2;
  if (findingValue.category === "Comparison group") return 3;
  if (findingValue.category === "Timing") return 4;
  if (findingValue.title ===
    "The dataset unit differs from the exposure-assignment unit") return 7;
  if (findingValue.title === "Some units cannot be classified") return 8;
  if (findingValue.category === "Treatment variation") return 6;
  if (findingValue.category === "Treatment definition") return 5;
  return 10;
}

function basicFindingDuplicatesAdvanced(
  findingValue: Screen04ScientificFinding,
  advancedCodes: ReadonlySet<Screen04AdvancedFinding["code"]>,
) {
  if (advancedCodes.has(
    "SCREEN04_ADVANCED_PROPOSED_CODING_DISAGREEMENT",
  ) && [
    "Proposed groups do not fully match apparent coverage",
    "Some proposed treated units appear unexposed",
    "Some proposed comparison units appear exposed",
  ].includes(findingValue.title)) return true;
  if (advancedCodes.has("SCREEN04_ADVANCED_COMPARISON_SURVIVAL") && [
    "The proposed comparison group becomes universally exposed",
    "A later stage exposes some proposed comparison units",
  ].includes(findingValue.title)) return true;
  if (advancedCodes.has("SCREEN04_ADVANCED_ASSIGNMENT_AGGREGATION") &&
    findingValue.title ===
      "The dataset unit differs from the exposure-assignment unit") return true;
  if (advancedCodes.has("SCREEN04_ADVANCED_UNKNOWN_COMPOSITION") &&
    findingValue.title === "Some units cannot be classified") return true;
  if (advancedCodes.has("SCREEN04_ADVANCED_VERSION_SEPARABILITY") && [
    "The shock has multiple mapped stages or versions",
    "Mapped treatment components are perfectly bundled",
  ].includes(findingValue.title)) return true;
  return false;
}

function rowsByUnit(rows: readonly ParsedRow[]): Map<string, ParsedRow[]> {
  const byUnit = new Map<string, ParsedRow[]>();
  for (const row of rows) {
    const unitRows = byUnit.get(row.unitId) ?? [];
    unitRows.push(row);
    byUnit.set(row.unitId, unitRows);
  }
  for (const unitRows of byUnit.values()) {
    unitRows.sort((left, right) => left.year - right.year);
  }
  return byUnit;
}

function missingYears(unitRows: readonly ParsedRow[]): number {
  if (unitRows.length < 2) return 0;
  let missing = 0;
  for (let index = 1; index < unitRows.length; index += 1) {
    missing += Math.max(0, unitRows[index]!.year - unitRows[index - 1]!.year - 1);
  }
  return missing;
}

function groupSupportMetrics(
  rows: readonly ParsedRow[],
  treatmentYear: number,
  latestObservedYear: number,
): Screen04GroupSupportMetrics {
  const byUnit = rowsByUnit(rows);
  let both = 0;
  let onlyBefore = 0;
  let onlyAfter = 0;
  let enteringAfter = 0;
  let exiting = 0;
  let withGaps = 0;
  for (const unitRows of byUnit.values()) {
    const years = unitRows.map((row) => row.year);
    const hasBefore = years.some((year) => year < treatmentYear);
    const hasAfter = years.some((year) => year >= treatmentYear);
    if (hasBefore && hasAfter) both += 1;
    else if (hasBefore) onlyBefore += 1;
    else onlyAfter += 1;
    const first = years[0]!;
    const last = years.at(-1)!;
    if (first > treatmentYear) enteringAfter += 1;
    if (last < latestObservedYear && last <= treatmentYear + 1) exiting += 1;
    if (missingYears(unitRows) > 0) withGaps += 1;
  }
  return {
    uniqueUnits: byUnit.size,
    unitPeriodObservations: rows.length,
    preTreatmentYears: unique(
      rows.filter((row) => row.year < treatmentYear).map((row) => row.year),
    ).length,
    postTreatmentYears: unique(
      rows.filter((row) => row.year >= treatmentYear).map((row) => row.year),
    ).length,
    unitsObservedOnBothSides: both,
    unitsObservedOnlyBefore: onlyBefore,
    unitsObservedOnlyAfter: onlyAfter,
    unitsEnteringAfterTreatment: enteringAfter,
    unitsExitingBeforeOrImmediatelyAfterTreatment: exiting,
    unitsWithInternalGaps: withGaps,
  };
}

function thresholdReviewMetrics(
  rows: readonly ParsedRow[],
  measurements: readonly Screen04ThresholdMeasurement[],
): Screen04ThresholdReviewMetrics[] {
  const uniqueMeasurements = new Map<string, Screen04ThresholdMeasurement>();
  for (const measurement of measurements) {
    uniqueMeasurements.set(JSON.stringify([
      measurement.csvColumn,
      measurement.threshold,
      measurement.thresholdUnit,
      measurement.sourceUnit,
      measurement.requiredHistoricalMeasurementYear ?? null,
      measurement.mappedHistoricalMeasurementYear ?? null,
      measurement.historicalValueSource ?? "column-values",
    ]), measurement);
  }
  const unitRows = rowsByUnit(rows);
  return [...uniqueMeasurements.values()].map((measurement) => {
    const exactUnits = new Set<string>();
    const nearUnits = new Set<string>();
    const missingUnits = new Set<string>();
    const panelYearValues = measurement.historicalValueSource === "panel-year";
    const mappedYear = measurement.mappedHistoricalMeasurementYear ?? null;
    const requiredYear = measurement.requiredHistoricalMeasurementYear ?? null;
    const preferredYear = mappedYear ?? requiredYear;
    for (const [unitId, observations] of unitRows) {
      // Prefer the researcher-confirmed historical observation when it is
      // actually present. Otherwise use the earliest observation, so the
      // review is deterministic even when the same panel rows are reordered.
      if (panelYearValues && requiredYear !== null && mappedYear === null) {
        missingUnits.add(unitId);
        continue;
      }
      const row = !panelYearValues || preferredYear === null
        ? observations[0]
        : observations.find((item) => item.year === preferredYear);
      if (!row) {
        missingUnits.add(unitId);
        continue;
      }
      const raw = row.values[measurement.csvColumn];
      const value = raw !== undefined &&
          /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(raw)
        ? Number(raw)
        : Number.NaN;
      if (!Number.isFinite(value)) {
        missingUnits.add(unitId);
        continue;
      }
      if (value === measurement.threshold) exactUnits.add(unitId);
      const band = Math.abs(measurement.threshold) *
        SCREEN_04_SCIENTIFIC_HEURISTICS.thresholdReviewBandShare;
      if (Math.abs(value - measurement.threshold) <= band) {
        nearUnits.add(unitId);
      }
    }
    return {
      column: measurement.csvColumn,
      threshold: measurement.threshold,
      exactlyAtThreshold: exactUnits.size,
      withinFivePercent: nearUnits.size,
      missingOrInvalid: missingUnits.size,
      unitMismatch: measurement.thresholdUnit !== measurement.sourceUnit,
      historicalMeasurementYearMismatch:
        measurement.requiredHistoricalMeasurementYear !== undefined &&
        measurement.requiredHistoricalMeasurementYear !== null &&
        measurement.mappedHistoricalMeasurementYear !==
          measurement.requiredHistoricalMeasurementYear,
    };
  });
}

function buildMetrics(
  rows: readonly ParsedRow[],
  input: Screen04ScientificAssessmentInput,
  ruleValidation: RuleValidation,
): Screen04ScientificMetrics {
  const years = rows.map((row) => row.year);
  const earliest = Math.min(...years);
  const latest = Math.max(...years);
  const treatedRows = rows.filter(
    (row) => row.group === input.mappings.treatedValue,
  );
  const comparisonRows = rows.filter(
    (row) => row.group === input.mappings.comparisonValue,
  );
  const treated = groupSupportMetrics(
    treatedRows,
    input.mappings.researcherTreatmentYear,
    latest,
  );
  const comparison = groupSupportMetrics(
    comparisonRows,
    input.mappings.researcherTreatmentYear,
    latest,
  );
  const yearCounts = unique(years).sort((left, right) => left - right).map(
    (year) => ({
      year,
      treatedUnits: new Set(
        treatedRows.filter((row) => row.year === year).map((row) => row.unitId),
      ).size,
      comparisonUnits: new Set(
        comparisonRows.filter((row) => row.year === year).map((row) => row.unitId),
      ).size,
    }),
  );
  const activeExposureRows = rows.filter(
    (row) => row.year >= input.mappings.researcherTreatmentYear,
  );
  const treatedUnexposed = activeExposureRows.filter(
    (row) => row.group === input.mappings.treatedValue &&
      row.exposure === "unexposed",
  );
  const comparisonExposed = activeExposureRows.filter(
    (row) => row.group === input.mappings.comparisonValue &&
      row.exposure === "exposed",
  );
  const unknown = activeExposureRows.filter((row) => row.exposure === "unknown");
  const reasonCategories = ruleReasonCategories(ruleValidation.usableRules);
  const reasonSummary = reasonCategories.join(", ");
  const unexposedReasons = reasonCategories.length > 0
    ? [`the mapped ${reasonSummary} ${reasonCategories.length === 1 ? "condition was" : "conditions were"} not met`]
    : [];
  const exposedReasons = reasonCategories.length > 0
    ? [`the mapped ${reasonSummary} ${reasonCategories.length === 1 ? "condition was" : "conditions were"} satisfied`]
    : [];
  const exposureCount = (status: Screen04ExposureStatus) =>
    rows.filter((row) => row.exposure === status).length;
  return {
    rowCount: rows.length,
    observedYearRange: { earliest, latest },
    treatedToComparisonUnitRatio: screen04Ratio(
      treated.uniqueUnits,
      comparison.uniqueUnits,
    ),
    treated,
    comparison,
    internalMissingYears: [...rowsByUnit(rows).values()].reduce(
      (sum, unitRows) => sum + missingYears(unitRows),
      0,
    ),
    groupCountsByYear: yearCounts,
    exposure: {
      exposedObservations: exposureCount("exposed"),
      unexposedObservations: exposureCount("unexposed"),
      unknownObservations: exposureCount("unknown"),
      notApplicableObservations: exposureCount("not_applicable"),
      proposedTreatedAuditedUnexposedUnits:
        new Set(treatedUnexposed.map((row) => row.unitId)).size,
      proposedTreatedAuditedUnexposedObservations: treatedUnexposed.length,
      proposedTreatedAuditedUnexposedYears: unique(
        treatedUnexposed.map((row) => row.year),
      ).sort((left, right) => left - right),
      proposedTreatedAuditedUnexposedReasons: unexposedReasons,
      proposedComparisonAuditedExposedUnits:
        new Set(comparisonExposed.map((row) => row.unitId)).size,
      proposedComparisonAuditedExposedObservations: comparisonExposed.length,
      proposedComparisonAuditedExposedYears: unique(
        comparisonExposed.map((row) => row.year),
      ).sort((left, right) => left - right),
      proposedComparisonAuditedExposedReasons: exposedReasons,
      unknownExposureUnits: new Set(unknown.map((row) => row.unitId)).size,
      unknownExposureObservations: unknown.length,
    },
    thresholdReviews: thresholdReviewMetrics(
      rows,
      ruleValidation.thresholdMeasurements,
    ),
  };
}

function sampleSupportFindings(
  metrics: Screen04ScientificMetrics,
): Screen04ScientificFinding[] {
  const findings: Screen04ScientificFinding[] = [];
  const treatedCount = metrics.treated.uniqueUnits;
  const comparisonCount = metrics.comparison.uniqueUnits;
  const smaller = Math.min(treatedCount, comparisonCount);
  const larger = Math.max(treatedCount, comparisonCount);
  if (
    treatedCount < SCREEN_04_SCIENTIFIC_HEURISTICS.smallGroupMaximumExclusive ||
    comparisonCount < SCREEN_04_SCIENTIFIC_HEURISTICS.smallGroupMaximumExclusive
  ) {
    findings.push(finding(
      "Sample support",
      "One proposed group is very small",
      `The proposed treatment group contains ${screen04Number(treatedCount)} unique ${plural(treatedCount, "unit")}, while the comparison group contains ${screen04Number(comparisonCount)}.`,
      "A very small group can make results depend on a few units; this does not invalidate the design by itself.",
      "Check that the smaller group and its observations match the intended population.",
      "medium",
    ));
  }
  if (smaller > 0 &&
    larger / smaller >= SCREEN_04_SCIENTIFIC_HEURISTICS.numericalImbalanceRatio) {
    findings.push(finding(
      "Sample support",
      "The proposed groups are numerically imbalanced",
      `The larger group contains ${screen04Number(larger)} unique units, at least ${SCREEN_04_SCIENTIFIC_HEURISTICS.numericalImbalanceRatio} times the ${screen04Number(smaller)} units in the smaller group.`,
      "This does not invalidate the design, but results may depend on the smaller group.",
      "Review the units in the smaller group.",
      "medium",
    ));
  }
  const preYears = Math.min(
    metrics.treated.preTreatmentYears,
    metrics.comparison.preTreatmentYears,
  );
  const postYears = Math.min(
    metrics.treated.postTreatmentYears,
    metrics.comparison.postTreatmentYears,
  );
  if (preYears === 0 || postYears === 0) {
    const missing = preYears === 0 ? "pre-treatment" : "post-treatment";
    findings.push(finding(
      "Sample support",
      `No ${missing} period is observed for both groups`,
      `At least one proposed group has no observed ${missing} year.`,
      "The intended comparison lacks one side of treatment; this is not a parallel-trends test.",
      "Review the treatment year or sample window.",
      "high",
    ));
  } else if (
    preYears <= SCREEN_04_SCIENTIFIC_HEURISTICS.weakOneSideSupportYears ||
    postYears <= SCREEN_04_SCIENTIFIC_HEURISTICS.weakOneSideSupportYears
  ) {
    const side = preYears <= SCREEN_04_SCIENTIFIC_HEURISTICS.weakOneSideSupportYears
      ? "pre-treatment"
      : "post-treatment";
    findings.push(finding(
      "Sample support",
      `Only one ${side} year supports the comparison`,
      `The shared sample support includes ${side === "pre-treatment" ? preYears : postYears} ${side} year for at least one group.`,
      "One year gives limited support for the intended before-after comparison; this is not an assumption test.",
      "Consider a longer, theoretically appropriate sample window.",
      "medium",
    ));
  }
  const treatedMissingSide = metrics.treated.unitsObservedOnlyBefore +
    metrics.treated.unitsObservedOnlyAfter;
  const comparisonMissingSide = metrics.comparison.unitsObservedOnlyBefore +
    metrics.comparison.unitsObservedOnlyAfter;
  const treatedMissingShare = screen04Share(
    treatedMissingSide,
    metrics.treated.uniqueUnits,
  );
  const comparisonMissingShare = screen04Share(
    comparisonMissingSide,
    metrics.comparison.uniqueUnits,
  );
  if (
    treatedMissingShare >=
      SCREEN_04_SCIENTIFIC_HEURISTICS.substantialMissingSideShare ||
    comparisonMissingShare >=
      SCREEN_04_SCIENTIFIC_HEURISTICS.substantialMissingSideShare
  ) {
    findings.push(finding(
      "Sample support",
      "Many units are observed on only one side of treatment",
      `${screen04Percent(treatedMissingShare)} of treated units and ${screen04Percent(comparisonMissingShare)} of comparison units are observed only before or only after the selected treatment year.`,
      "Different units may represent the groups before and after treatment.",
      "Review entry and exit by group.",
      "medium",
    ));
  }
  if (metrics.internalMissingYears > 0) {
    findings.push(finding(
      "Sample support",
      "The annual panel contains internal gaps",
      `${screen04Number(metrics.internalMissingYears)} annual ${plural(metrics.internalMissingYears, "observation")} are missing inside unit histories; ${screen04Number(metrics.treated.unitsWithInternalGaps)} treated and ${screen04Number(metrics.comparison.unitsWithInternalGaps)} comparison units have gaps.`,
      "Gaps change which units contribute in each year.",
      "Check whether gaps reflect missing data, entry or exit, or the sample definition.",
      "review",
    ));
  }
  const entering = metrics.treated.unitsEnteringAfterTreatment +
    metrics.comparison.unitsEnteringAfterTreatment;
  const exiting = metrics.treated.unitsExitingBeforeOrImmediatelyAfterTreatment +
    metrics.comparison.unitsExitingBeforeOrImmediatelyAfterTreatment;
  if (entering > 0 || exiting > 0) {
    findings.push(finding(
      "Sample support",
      "Sample membership changes around treatment",
      `${screen04Number(entering)} ${plural(entering, "unit")} enter after treatment; ${screen04Number(exiting)} ${plural(exiting, "unit")} leave before or shortly after it while later years remain.`,
      "Entry and exit change sample composition but do not prove attrition bias.",
      "Inspect entry and exit reasons by group.",
      "review",
    ));
  }
  let largestCompositionChange = 0;
  for (let index = 1; index < metrics.groupCountsByYear.length; index += 1) {
    const prior = metrics.groupCountsByYear[index - 1]!;
    const current = metrics.groupCountsByYear[index]!;
    for (const group of ["treatedUnits", "comparisonUnits"] as const) {
      if (prior[group] === 0) continue;
      largestCompositionChange = Math.max(
        largestCompositionChange,
        Math.abs(current[group] - prior[group]) / prior[group],
      );
    }
  }
  if (largestCompositionChange >=
    SCREEN_04_SCIENTIFIC_HEURISTICS.substantialCompositionChangeShare) {
    findings.push(finding(
      "Sample support",
      "Group composition changes materially across years",
      `At least one proposed group's observed unit count changes by ${screen04Percent(largestCompositionChange)} between adjacent sample years.`,
      "A large count change can alter group composition over time.",
      "Review annual group counts and the source of the change.",
      "review",
    ));
  }
  return findings;
}

function timingFindings(
  input: Screen04ScientificAssessmentInput,
  metrics: Screen04ScientificMetrics,
): Screen04ScientificFinding[] {
  const validDates = input.verifiedDates.filter((item) => exactYear(item.date) !== null);
  const findings: Screen04ScientificFinding[] = [];
  const sampleStartDate = `${metrics.observedYearRange.earliest}-01-01`;
  const sampleEndDate = `${metrics.observedYearRange.latest}-12-31`;
  const sampleRelevantDates = validDates.filter((item) =>
    item.date >= sampleStartDate && item.date <= sampleEndDate
  );
  const distinctDates = unique(sampleRelevantDates.map((item) => item.date));
  const distinctRoles = unique(sampleRelevantDates.map((item) => item.role));
  if (distinctDates.length > 1 && distinctRoles.length > 1) {
    const summary = sampleRelevantDates
      .map((item) => `${roleLabels[item.role]} (${item.date})`)
      .join(", ");
    findings.push(finding(
      "Timing",
      "More than one event date is relevant",
      `The verified timeline contains ${summary}.`,
      "The dates represent stages that may not be interchangeable.",
      "Confirm which stage the treatment year represents.",
      "medium",
    ));
  }
  const selectedYear = input.mappings.researcherTreatmentYear;
  const selectedRoles = validDates.filter((item) => exactYear(item.date) === selectedYear);
  if (validDates.length > 0 && selectedRoles.length === 0) {
    findings.push(finding(
      "Timing",
      "The selected treatment year differs from the verified dates",
      `The researcher selected ${selectedYear}, while the verified timeline contains ${unique(validDates.map((item) => exactYear(item.date)!)).sort().join(", ")}.`,
      "The selected year may represent another stage or unsupported timing.",
      "Confirm the event stage before coding treatment.",
      "medium",
    ));
  }
  const laterOperative = validDates.filter((item) =>
    ["effective", "implementation", "compliance"].includes(item.role) &&
    exactYear(item.date)! > selectedYear
  );
  if (selectedRoles.some((item) =>
    item.role === "announcement" || item.role === "enactment"
  ) && laterOperative.length > 0) {
    findings.push(finding(
      "Timing",
      "The treatment year represents an earlier event stage",
      `The selected year corresponds to ${selectedRoles.map((item) => roleLabels[item.role]).join(" or ")}, while ${roleLabels[laterOperative[0]!.role]} begins in ${exactYear(laterOperative[0]!.date)}.`,
      "The dates represent different shock stages.",
      "Choose the verified stage the design concerns.",
      "high",
    ));
  }
  const early = validDates
    .filter((item) => item.role === "announcement" || item.role === "enactment")
    .sort((left, right) => left.date.localeCompare(right.date))[0];
  const operative = validDates
    .filter((item) =>
      item.role === "effective" || item.role === "implementation" ||
      item.role === "compliance"
    )
    .sort((left, right) => left.date.localeCompare(right.date))[0];
  const selectedYearIsRelevant = early && operative &&
    selectedYear >= exactYear(early.date)! &&
    selectedYear <= exactYear(operative.date)!;
  const sampleOverlapsAnticipationInterval = early && operative &&
    sampleEndDate >= early.date && sampleStartDate < operative.date;
  if (
    early && operative && early.date < operative.date &&
    selectedYearIsRelevant && sampleOverlapsAnticipationInterval
  ) {
    findings.push(finding(
      "Timing",
      "The timeline contains a potential anticipation period",
      `The verified ${roleLabels[early.role]} date is ${early.date}, before ${roleLabels[operative.role]} on ${operative.date}.`,
      "The earlier date may allow preparation or anticipation; this finding does not claim that anticipation occurred.",
      "Review how to represent this interval in treatment.",
      "medium",
    ));
  }
  const mixedAnnual = validDates.find((item) => {
    const operativeYear = exactYear(item.date);
    return operativeYear !== null &&
      metrics.groupCountsByYear.some((entry) => entry.year === operativeYear) &&
      ["effective", "implementation", "compliance"].includes(item.role) &&
      !item.date.endsWith("-01-01");
  });
  if (input.studyDescription.dataFrequency === "annual" && mixedAnnual) {
    const month = Number(mixedAnnual.date.slice(5, 7));
    const day = Number(mixedAnnual.date.slice(8, 10));
    const start = new Date(`${mixedAnnual.date}T00:00:00.000Z`);
    const yearStart = new Date(`${mixedAnnual.date.slice(0, 4)}-01-01T00:00:00.000Z`);
    const daysBefore = Math.round(
      (start.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1_000),
    );
    findings.push(finding(
      "Timing",
      "The operative year mixes exposed and unexposed time",
      `The verified ${roleLabels[mixedAnnual.role]} date is ${mixedAnnual.date} (${screen04Number(daysBefore)} days after January 1; month ${month}, day ${day}).`,
      "That annual observation combines time before and after the operative date.",
      "Define how to code the mixed year.",
      "medium",
    ));
  }
  return findings;
}

function exposureFindings(
  rows: readonly ParsedRow[],
  metrics: Screen04ScientificMetrics,
  input: Screen04ScientificAssessmentInput,
  ruleValidation: RuleValidation,
): Screen04ScientificFinding[] {
  const hasUsableExposureRule = ruleValidation.usableRules.length > 0;
  const findings: Screen04ScientificFinding[] = [];
  const exposure = metrics.exposure;
  const treatedYears = exposure.proposedTreatedAuditedUnexposedYears.join(", ");
  const comparisonYears =
    exposure.proposedComparisonAuditedExposedYears.join(", ");
  const treatedReasons =
    exposure.proposedTreatedAuditedUnexposedReasons.join("; ");
  const comparisonReasons =
    exposure.proposedComparisonAuditedExposedReasons.join("; ");
  const treatedMismatch =
    `${screen04Number(exposure.proposedTreatedAuditedUnexposedUnits)} treated ${plural(exposure.proposedTreatedAuditedUnexposedUnits, "unit")} are unexposed in ${screen04Number(exposure.proposedTreatedAuditedUnexposedObservations)} observations (${treatedYears}): ${treatedReasons}.`;
  const comparisonMismatch =
    `${screen04Number(exposure.proposedComparisonAuditedExposedUnits)} comparison ${plural(exposure.proposedComparisonAuditedExposedUnits, "unit")} are exposed in ${screen04Number(exposure.proposedComparisonAuditedExposedObservations)} observations (${comparisonYears}): ${comparisonReasons}.`;
  if (
    hasUsableExposureRule &&
    exposure.proposedTreatedAuditedUnexposedUnits > 0 &&
    exposure.proposedComparisonAuditedExposedUnits > 0
  ) {
    findings.push(finding(
      "Treatment definition",
      "Proposed groups do not fully match apparent coverage",
      `${treatedMismatch} ${comparisonMismatch}`,
      "The current groups mix apparently exposed and unexposed units.",
      "Review whether verified coverage should define treatment.",
      "high",
    ));
  } else if (
    hasUsableExposureRule &&
    exposure.proposedTreatedAuditedUnexposedUnits > 0
  ) {
    findings.push(finding(
      "Treatment definition",
      "Some proposed treated units appear unexposed",
      treatedMismatch,
      "The treatment group may include units outside mapped coverage.",
      "Review the treatment definition and coverage inputs.",
      "high",
    ));
  } else if (
    hasUsableExposureRule &&
    exposure.proposedComparisonAuditedExposedUnits > 0
  ) {
    findings.push(finding(
      "Comparison group",
      "Some proposed comparison units appear exposed",
      comparisonMismatch,
      "These units may not be untreated for the focal shock.",
      "Review their group or treatment-stage coding.",
      "high",
    ));
  }
  if (hasUsableExposureRule && exposure.unknownExposureUnits > 0) {
    const unknownReasons = ruleReasonCategories(ruleValidation.usableRules);
    const missingInformation = unknownReasons.length > 0
      ? unknownReasons.join(", ")
      : "mapped exposure";
    findings.push(finding(
      "Treatment definition",
      "Some units cannot be classified",
      `${screen04Number(exposure.unknownExposureUnits)} ${plural(exposure.unknownExposureUnits, "unit")} have ${screen04Number(exposure.unknownExposureObservations)} post-treatment observations with missing or invalid ${missingInformation}.`,
      "Calling them unexposed would assume away unresolved exposure.",
      "Keep them unknown or retrieve the missing coverage information.",
      "high",
    ));
  }
  if (
    input.studyDescription.mainComparisonBasis === "geography" &&
    input.studyDescription.groupGeographicConcept &&
    input.studyDescription.shockGeographicConcept &&
    input.studyDescription.groupGeographicConcept !==
      input.studyDescription.shockGeographicConcept
  ) {
    const geographyDetails = [
      input.studyDescription.groupGeographyColumn
        ? `the ${readerExcerpt(input.studyDescription.groupGeographyColumn)} column`
        : null,
      input.studyDescription.treatmentGroupGeographicValues
        ? `treated values ${readerExcerpt(input.studyDescription.treatmentGroupGeographicValues)}`
        : null,
      input.studyDescription.comparisonGroupGeographicValues
        ? `comparison values ${readerExcerpt(input.studyDescription.comparisonGroupGeographicValues)}`
        : null,
    ].filter((value): value is string => value !== null).join(", ");
    findings.push(finding(
      "Treatment definition",
      "The group geography may not represent exposure",
      `Groups use ${input.studyDescription.groupGeographicConcept.replaceAll("-", " ")}${geographyDetails ? ` (${geographyDetails})` : ""}; shock coverage uses ${input.studyDescription.shockGeographicConcept.replaceAll("-", " ")}.`,
      "A different coverage geography can expose units outside the proposed group.",
      "Review whether coverage geography should define treatment.",
      "high",
    ));
  }
  if (
    input.studyDescription.datasetAssignmentUnit &&
    input.studyDescription.shockAssignmentUnit &&
    input.studyDescription.datasetAssignmentUnit !==
      input.studyDescription.shockAssignmentUnit &&
    !(input.assignmentCrosswalk?.crosswalkStatus === "complete" &&
      input.assignmentCrosswalk.withinAggregateExposure === "uniform")
  ) {
    findings.push(finding(
      "Treatment definition",
      "The dataset unit differs from the exposure-assignment unit",
      `The dataset is organized at the ${input.studyDescription.datasetAssignmentUnit.replaceAll("-", " ")} level, while the shock applies at the ${input.studyDescription.shockAssignmentUnit.replaceAll("-", " ")} level.`,
      "One dataset unit may combine exposed and unexposed subunits.",
      "Confirm aggregation or use assignment-unit data when available.",
      "high",
    ));
  }
  if (!hasUsableExposureRule) return findings;
  const activeRows = rows.filter(
    (row) => row.year >= input.mappings.researcherTreatmentYear,
  );
  const classifiable = activeRows.filter(
    (row) => row.exposure === "exposed" || row.exposure === "unexposed",
  );
  const exposed = classifiable.filter((row) => row.exposure === "exposed");
  const unexposed = classifiable.filter((row) => row.exposure === "unexposed");
  if (classifiable.length > 0 && unexposed.length === 0) {
    findings.push(finding(
      "Treatment variation",
      "The sample has no usable exposed-unexposed contrast",
      `Every one of the ${screen04Number(classifiable.length)} classifiable post-treatment observations is exposed under the mapped rule.`,
      "The sample has no observed unexposed comparison for this coverage definition.",
      "Revise the comparison, window, or treatment definition if variation is required.",
      "high",
    ));
  } else if (classifiable.length > 0 && exposed.length === 0) {
    findings.push(finding(
      "Treatment variation",
      "No sampled unit appears exposed",
      `None of the ${screen04Number(classifiable.length)} classifiable post-treatment observations satisfies the mapped rule.`,
      "The sample has no observed exposure for the focal shock.",
      "Review the rule, treatment year, and population.",
      "high",
    ));
  }
  const comparisonActive = activeRows.filter(
    (row) => row.group === input.mappings.comparisonValue,
  );
  if (comparisonActive.length > 0 &&
    comparisonActive.every((row) => row.exposure === "exposed")) {
    findings.push(finding(
      "Comparison group",
      "The proposed comparison group becomes universally exposed",
      `All ${screen04Number(comparisonActive.length)} comparison observations at or after the selected treatment year are classified as exposed.`,
      "The comparison supplies no unexposed contrast in those periods.",
      "Review another comparison or staged treatment definition.",
      "high",
    ));
  }
  const rules = ruleValidation.usableRules;
  if (rules.length > 1) {
    const laterExposedControls = activeRows.filter((row) =>
      row.group === input.mappings.comparisonValue &&
      row.componentExposure[0] !== "exposed" &&
      row.componentExposure.slice(1).some((status) => status === "exposed")
    );
    if (laterExposedControls.length > 0) {
      const units = new Set(laterExposedControls.map((row) => row.unitId)).size;
      findings.push(finding(
        "Comparison group",
        "A later stage exposes some proposed comparison units",
        `${screen04Number(units)} proposed comparison ${plural(units, "unit")} become exposed under a later mapped component or amendment in ${screen04Number(laterExposedControls.length)} observations.`,
        "The comparison may be untreated initially but exposed later.",
        "Review separate stage coding or a shorter comparison period.",
        "high",
      ));
    }
  }
  const earliestRuleYear = Math.min(...rules.map((rule) => rule.effectiveYear));
  const fullyClassifiedRows = rows.filter((row) =>
    row.exposure !== "unknown" && row.exposure !== "not_applicable"
  );
  if (metrics.observedYearRange.earliest >= earliestRuleYear &&
    fullyClassifiedRows.length === rows.length &&
    fullyClassifiedRows.every((row) => row.exposure === "exposed")) {
    findings.push(finding(
      "Treatment variation",
      "The sample begins after universal exposure",
      `The sample begins in ${metrics.observedYearRange.earliest}, at or after the first mapped exposure year, and every sampled observation is exposed.`,
      "No observed unit or period supplies an unexposed contrast.",
      "Review an earlier window or different comparison if variation is required.",
      "high",
    ));
  }
  const distinctStarts = unique(rules.map((rule) => rule.effectiveYear));
  const distinctVersions = unique(rules.map((rule) => rule.version).filter(Boolean));
  const distinctComponents = unique(rules.map((rule) => rule.component).filter(Boolean));
  if (distinctStarts.length > 1 || distinctVersions.length > 1 ||
    distinctComponents.length > 1) {
    findings.push(finding(
      "Treatment variation",
      "The shock has multiple mapped stages or versions",
      `${screen04Number(rules.length)} mapped exposure ${plural(rules.length, "rule")} represent ${screen04Number(distinctStarts.length)} start ${plural(distinctStarts.length, "year")}${distinctVersions.length > 1 ? ` and ${screen04Number(distinctVersions.length)} versions` : ""}.`,
      "One indicator may combine different forms or times of exposure.",
      "Review package-level versus separate stages or versions; no component effect is implied.",
      "medium",
    ));
  }
  const fullyActiveComponentRows = activeRows.filter((row) =>
    row.componentExposure.length > 1 &&
    row.componentExposure.every((status) => status !== "not_applicable" && status !== "unknown")
  );
  if (fullyActiveComponentRows.length > 0 &&
    fullyActiveComponentRows.every((row) =>
      new Set(row.componentExposure).size === 1
    )) {
    findings.push(finding(
      "Treatment variation",
      "Mapped treatment components are perfectly bundled",
      `All ${screen04Number(fullyActiveComponentRows.length)} observations with fully observed component rules have the same classification across components.`,
      "The sample has no independent variation across components.",
      "Use package-level exposure unless another sample supports separation.",
      "medium",
    ));
  }
  const thresholdFlags = metrics.thresholdReviews.filter((review) =>
    review.exactlyAtThreshold > 0 || review.withinFivePercent > 0 ||
    review.missingOrInvalid > 0 || review.unitMismatch ||
    review.historicalMeasurementYearMismatch
  );
  if (thresholdFlags.length > 0) {
    const exact = thresholdFlags.reduce(
      (sum, review) => sum + review.exactlyAtThreshold,
      0,
    );
    const near = thresholdFlags.reduce(
      (sum, review) => sum + review.withinFivePercent,
      0,
    );
    const missing = thresholdFlags.reduce(
      (sum, review) => sum + review.missingOrInvalid,
      0,
    );
    const extra = [
      thresholdFlags.some((review) => review.unitMismatch)
        ? "The mapped unit differs from the threshold unit."
        : "",
      thresholdFlags.some((review) => review.historicalMeasurementYearMismatch)
        ? "The mapped historical measurement year differs from the required year."
        : "",
    ].filter(Boolean).join(" ");
    findings.push(finding(
      "Treatment definition",
      "Some exposure classifications are sensitive to a threshold",
      `${screen04Number(exact)} ${plural(exact, "unit")} equal a threshold, ${screen04Number(near)} are within the five-percent review band, and ${screen04Number(missing)} lack valid threshold data.${extra ? ` ${extra}` : ""}`,
      "Near-threshold coding can change coverage; the five-percent band is only a review heuristic.",
      "Verify the unit, historical year, and near-boundary values.",
      "medium",
    ));
  }
  return findings;
}

function unresolvedChoices(
  input: Screen04ScientificAssessmentInput,
  ruleValidation: RuleValidation,
  metrics: Screen04ScientificMetrics,
): string[] {
  const choices: string[] = [];
  if (ruleValidation.usableRules.length === 0 &&
    !coverageMatchingWasExplicitlySkipped(input)) {
    const dimensions = unique(
      (input.exposureDimensions ?? []).map((item) => item.label),
    );
    choices.push(dimensions.length > 0
      ? `Confirm how the relevant verified exposure dimensions appear in the dataset: ${dimensions.join(", ")}.`
      : "Confirm how coverage or eligibility appears in the dataset before interpreting row-level exposure.");
  }
  if (input.studyDescription.mainComparisonBasis === "geography" &&
    !input.studyDescription.shockGeographicConcept) {
    choices.push(
      "Confirm the geographic concept that determines exposure to the verified shock.",
    );
  }
  if (input.studyDescription.datasetAssignmentUnit &&
    !input.studyDescription.shockAssignmentUnit) {
    choices.push(
      "Confirm the unit to which the verified shock applies.",
    );
  }
  if (input.verifiedDates.length === 0) {
    choices.push(
      "Confirm the verified date and the event stage represented by the selected treatment year.",
    );
  }
  const sampleRelevantDates = input.verifiedDates.filter((item) => {
    const dateYear = exactYear(item.date);
    return dateYear !== null &&
      dateYear >= metrics.observedYearRange.earliest &&
      dateYear <= metrics.observedYearRange.latest;
  });
  if (sampleRelevantDates.some((item) => item.role === "other")) {
    choices.push(
      "Confirm the role of each verified date that is not yet identified as announcement, enactment, implementation, compliance, enforcement, amendment, repeal, or delay.",
    );
  }
  const validYears = unique(
    sampleRelevantDates.map((item) => exactYear(item.date)).filter(
      (value): value is number => value !== null,
    ),
  );
  if (validYears.length > 1 &&
    unique(sampleRelevantDates.map((item) => item.role)).length > 1) {
    choices.push(
      "Confirm which verified event stage the proposed treatment year is intended to represent.",
    );
  }
  return unique(choices);
}

function orderedFindings(
  findings: readonly Screen04ScientificFinding[],
): Screen04ScientificFinding[] {
  const seenTitles = new Set<string>();
  return findings
    .filter((item) => {
      if (seenTitles.has(item.title)) return false;
      seenTitles.add(item.title);
      return true;
    })
    .map((item, index) => ({ item, index }))
    .sort((left, right) =>
      findingPriorityOrder[left.item.priority] -
        findingPriorityOrder[right.item.priority] ||
      findingCategoryOrder[left.item.category] -
        findingCategoryOrder[right.item.category] ||
      left.index - right.index
    )
    .map(({ item }) => item);
}

function overallJudgment(
  setupIssues: readonly Screen04SetupIssue[],
  findings: readonly Screen04ScientificFinding[],
  metrics: Screen04ScientificMetrics | null,
  usableExposureRules: number,
  unresolvedResearcherChoices: readonly string[],
  coverageMatchingSkipped: boolean,
): Screen04ScientificOverallJudgment {
  if (setupIssues.some((issue) => issue.blocking)) {
    return "Fix the dataset setup before continuing";
  }
  if ((!coverageMatchingSkipped && usableExposureRules === 0) ||
    (!coverageMatchingSkipped && metrics !== null &&
      metrics.exposure.unknownObservations > 0 &&
      metrics.exposure.exposedObservations === 0 &&
      metrics.exposure.unexposedObservations === 0)) {
    return "More information is needed before exposure can be checked";
  }
  if (findings.some((item) =>
    item.priority === "high" &&
    (item.category === "Treatment definition" ||
      item.category === "Comparison group" ||
      item.category === "Treatment variation")
  )) {
    return "Revise the treatment or comparison definition";
  }
  return findings.length > 0 || unresolvedResearcherChoices.length > 0
    ? "Review several exposure choices"
    : "The proposed exposure design is broadly usable";
}

function emptyResult(
  input: Screen04ScientificAssessmentInput,
  setupIssues: readonly Screen04SetupIssue[],
): Screen04ScientificAssessmentResult {
  return {
    schemaVersion: SCREEN_04_SCIENTIFIC_ASSESSMENT_SCHEMA_VERSION,
    verifiedShockName: input.verifiedShockName,
    overallJudgment: "Fix the dataset setup before continuing",
    setupIssues: deduplicateSetupIssues(setupIssues),
    metrics: null,
    priorityFindings: [],
    otherFindings: [],
    unresolvedResearcherChoices: [],
    assessmentNotes: coverageMatchingWasExplicitlySkipped(input)
      ? ["Coverage matching was not included in this assessment."]
      : [],
    advancedDiagnostics: null,
  };
}

/**
 * Deterministic, outcome-blind Screen 4 assessment. Only explicitly selected
 * structural and exposure columns are scanned. No regression control, outcome,
 * model service, host reasoning, or treatment-effect calculation is accepted.
 */
export async function runScreen04ScientificAssessment(
  input: Screen04ScientificAssessmentInput,
): Promise<Screen04ScientificAssessmentResult> {
  let headers: readonly string[];
  try {
    headers = (await inspectScreen04CsvHeader(input.csvText)).exactHeaders;
  } catch (error) {
    return emptyResult(input, [safeCoreIssue(error)]);
  }
  const structuralIssues = structuralMappingIssues(input, headers);
  const ruleValidation = validateRules(input, headers);
  const initialIssues = deduplicateSetupIssues([
    ...structuralIssues,
    ...ruleValidation.setupIssues,
  ]);
  if (initialIssues.some((issue) => issue.blocking)) {
    return emptyResult(input, initialIssues);
  }
  const parsed = parseRows(input, headers, ruleValidation);
  const setupIssues = deduplicateSetupIssues([
    ...initialIssues,
    ...parsed.setupIssues,
  ]);
  if (setupIssues.some((issue) => issue.blocking) || parsed.rows.length === 0) {
    return emptyResult(input, setupIssues);
  }
  const metrics = buildMetrics(parsed.rows, input, ruleValidation);
  const advancedAssessment = await buildAdvancedDiagnostics(
    input,
    parsed.rows,
    ruleValidation,
  );
  const advancedDiagnostics = advancedAssessment.diagnostics;
  const basicFindings = orderedFindings([
    ...exposureFindings(parsed.rows, metrics, input, ruleValidation),
    ...timingFindings(input, metrics),
    ...sampleSupportFindings(metrics),
  ]);
  const advancedSourceFindings = advancedDiagnostics === null
    ? []
    : [
      ...advancedDiagnostics.priorityFindings,
      ...advancedDiagnostics.otherFindings,
    ];
  const advancedCodes = new Set(
    advancedSourceFindings.map((item) => item.code),
  );
  const boundaryFindings = advancedAssessment.notes.map((note) => finding(
    "Treatment definition",
    "The advanced assessment reached a supported boundary",
    note,
    "The full treatment-definition comparison was not completed, so the visible basic checks do not represent every requested scenario.",
    "Use a reduced CSV containing only the selected structural and coverage fields, or assess a narrower set of no more than eight source-supported scenarios.",
    "high",
  ));
  const findings = [
    ...advancedSourceFindings.map((item, index) => ({
      finding: scientificFindingFromAdvanced(item),
      consequenceOrder: item.consequenceOrder,
      sourceOrder: index,
    })),
    ...boundaryFindings.map((item, index) => ({
      finding: item,
      consequenceOrder: 1,
      sourceOrder: advancedSourceFindings.length + index,
    })),
    ...basicFindings
      .filter((item) => !basicFindingDuplicatesAdvanced(item, advancedCodes))
      .map((item, index) => ({
        finding: item,
        consequenceOrder: basicFindingConsequenceOrder(item),
        sourceOrder:
          advancedSourceFindings.length + boundaryFindings.length + index,
      })),
  ].sort((left, right) =>
    left.consequenceOrder - right.consequenceOrder ||
    left.sourceOrder - right.sourceOrder
  ).map((entry) => entry.finding);
  const researcherChoices = unresolvedChoices(input, ruleValidation, metrics);
  const priorityFindings = findings.slice(
    0,
    SCREEN_04_SCIENTIFIC_HEURISTICS.maximumPriorityFindings,
  );
  const otherFindings = findings.slice(
    SCREEN_04_SCIENTIFIC_HEURISTICS.maximumPriorityFindings,
  );
  return {
    schemaVersion: SCREEN_04_SCIENTIFIC_ASSESSMENT_SCHEMA_VERSION,
    verifiedShockName: input.verifiedShockName,
    overallJudgment: overallJudgment(
      setupIssues,
      findings,
      metrics,
      ruleValidation.usableRules.length,
      researcherChoices,
      coverageMatchingWasExplicitlySkipped(input),
    ),
    setupIssues,
    metrics,
    priorityFindings,
    otherFindings,
    unresolvedResearcherChoices: researcherChoices,
    assessmentNotes: coverageMatchingWasExplicitlySkipped(input)
      ? [
        "Coverage matching was not included in this assessment.",
        ...advancedAssessment.notes,
      ]
      : advancedAssessment.notes,
    advancedDiagnostics,
  };
}
