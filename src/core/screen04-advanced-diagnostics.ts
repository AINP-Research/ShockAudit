import type { Screen04AssignmentUnit } from "./screen04-scientific-assessment";
import type {
  Screen04ExposureStatus,
} from "./screen04-feasibility";

export const SCREEN_04_ADVANCED_DIAGNOSTIC_SCHEMA_VERSION =
  "screen-04-advanced-diagnostics-v1" as const;

/**
 * Fixed work bounds keep the advanced pass linear in selected case facts. The
 * caller may scan at most the existing 20,000-row CSV boundary, but scenario,
 * component, repair-variable, and reader-detail growth is independently
 * bounded here. No cross-product of scenarios is generated.
 */
export const SCREEN_04_ADVANCED_DIAGNOSTIC_LIMITS = Object.freeze({
  maximumScenarios: 8,
  maximumComponents: 8,
  maximumRepairVariables: 8,
  maximumCaseFactsPerScenario: 20_000,
  maximumSelectedColumns: 16,
  maximumAffectedDetails: 25,
  maximumPriorityFindings: 5,
  materialUnknownShare: 0.2,
  peripheralUnknownShare: 0.05,
});

export const SCREEN_04_V0403_SEVERITIES = [
  "Design blocker",
  "Major design concern",
  "Review before analysis",
  "Informational",
] as const;

export type Screen04V0403Severity =
  (typeof SCREEN_04_V0403_SEVERITIES)[number];

export type Screen04AdvancedTreatmentStage =
  | "announcement"
  | "enactment"
  | "effective"
  | "implementation"
  | "compliance"
  | "enforcement"
  | "amendment"
  | "repeal-or-delay"
  | "other";

export type Screen04AdvancedProposedGroup = "treated" | "comparison";

export type Screen04AdvancedReasonCategory =
  | "geography"
  | "organization-type"
  | "threshold"
  | "exemption"
  | "timing"
  | "amendment"
  | "assignment-unit"
  | "missing-information"
  | "treatment-component"
  | "coverage-condition"
  | "multi-condition";

/**
 * This is the only row-derived integration seam. It deliberately accepts only
 * the selected identifier, year, proposed group, audited status, bounded
 * reason categories, and missing-variable names. Arbitrary/raw CSV values are
 * rejected at runtime and never appear in the result.
 */
export type Screen04AdvancedCaseFact = {
  unitIdentifier: string;
  year: number;
  proposedGroup: Screen04AdvancedProposedGroup;
  auditedStatus: Screen04ExposureStatus;
  reasonCategories: readonly Screen04AdvancedReasonCategory[];
  missingRepairVariables: readonly string[];
  /** Explicit lower-level need supplied by the caller; never inferred from a column name. */
  lowerLevelRepairRequirement?: string | null;
};

export type Screen04AdvancedSourceBasis = {
  /** Supplied reader-safe Event Card/date/rule basis; not an invented ID. */
  eventCardBasis: string;
  /** Exact selected CSV columns. Values from those columns are never returned. */
  selectedColumns: readonly string[];
};

export type Screen04AdvancedScenario = {
  id: string;
  /** Plain reader-facing scenario name. */
  name: string;
  treatmentDate: string;
  treatmentStage: Screen04AdvancedTreatmentStage;
  coverageVersion: string;
  componentOrPackage: {
    kind: "component" | "package";
    name: string;
  };
  sourceBasis: Screen04AdvancedSourceBasis;
  /** Exact deterministic classification for every selected case fact. */
  cases: readonly Screen04AdvancedCaseFact[];
};

export type Screen04AdvancedAssignmentContext = {
  datasetUnit: Screen04AssignmentUnit | null;
  shockUnit: Screen04AssignmentUnit | null;
  crosswalkStatus:
    | "not-required"
    | "complete"
    | "partial"
    | "missing"
    | "unknown";
  withinAggregateExposure: "uniform" | "mixed" | "unknown" | null;
  /**
   * Optional selected-column facts used only when the researcher explicitly
   * maps both a lower-level and aggregate identifier. They are reduced to
   * bounded counts and shares and never returned row-by-row.
   */
  aggregateExposureFacts?: readonly Screen04AdvancedAggregateExposureFact[];
};

export type Screen04AdvancedAggregateExposureFact = {
  aggregateUnitIdentifier: string;
  lowerLevelUnitIdentifier: string;
  year: number;
  auditedStatus: Screen04ExposureStatus;
};

export type Screen04AdvancedDiagnosticInput = {
  scenarios: readonly Screen04AdvancedScenario[];
  referenceScenarioId?: string;
  assignmentContext?: Screen04AdvancedAssignmentContext | null;
};

export type Screen04AdvancedClassificationCounts = Record<
  Screen04ExposureStatus,
  number
> & { total: number };

export type Screen04AdvancedScenarioSummary = Omit<
  Screen04AdvancedScenario,
  "cases"
> & {
  classificationCounts: Screen04AdvancedClassificationCounts;
};

export type Screen04AdvancedAffectedDetail = {
  scenarioName: string;
  unitIdentifier: string;
  year: number;
  treatmentStage: Screen04AdvancedTreatmentStage;
  proposedGroup: Screen04AdvancedProposedGroup;
  auditedStatus: Screen04ExposureStatus;
  reasonCategories: readonly Screen04AdvancedReasonCategory[];
};

export type Screen04AdvancedWhereItOccurs = {
  details: readonly Screen04AdvancedAffectedDetail[];
  truncatedDetailCount: number;
};

export type Screen04V0403ConsequenceOrder =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type Screen04AdvancedFindingCode =
  | "SCREEN04_ADVANCED_PROPOSED_CODING_DISAGREEMENT"
  | "SCREEN04_ADVANCED_COMPARISON_SURVIVAL"
  | "SCREEN04_ADVANCED_TREATMENT_STABILITY"
  | "SCREEN04_ADVANCED_VERSION_SEPARABILITY"
  | "SCREEN04_ADVANCED_ASSIGNMENT_AGGREGATION"
  | "SCREEN04_ADVANCED_UNKNOWN_COMPOSITION"
  | "SCREEN04_ADVANCED_REPAIR_PRIORITY";

export type Screen04AdvancedFinding = {
  code: Screen04AdvancedFindingCode;
  severity: Screen04V0403Severity;
  consequenceOrder: Screen04V0403ConsequenceOrder;
  title: string;
  whatFound: string;
  whyItMatters: string;
  possibleNextStep: string | null;
  aggregate: {
    affectedObservations: number;
    affectedUnits: number;
    shareOfReferenceObservations: number;
  };
  whereItOccurs: Screen04AdvancedWhereItOccurs;
};

export type Screen04TreatmentStabilityComparison = {
  referenceScenarioId: string;
  alternativeScenarioId: string;
  comparedObservations: number;
  changedObservations: number;
  changedUnits: number;
  changedShare: number;
  drivers: readonly (
    | "treatment-date-stage"
    | "coverage-version"
    | "component-or-package"
    | "source-basis"
  )[];
  timingOnly: boolean;
};

export type Screen04TreatmentStabilityDiagnostic = {
  conclusion: "stable" | "classification-sensitive";
  comparisons: readonly Screen04TreatmentStabilityComparison[];
};

export type Screen04DisagreementDiagnostic = {
  disagreementObservations: number;
  disagreementUnits: number;
  disagreementShare: number;
  multiReasonObservations: number;
  reasonCounts: Record<Screen04AdvancedReasonCategory, number>;
};

export type Screen04ComparisonSurvivalDiagnostic = {
  conclusion:
    | "stays-unexposed"
    | "gradual-post-implementation-exposure"
    | "amendment-only-exposure"
    | "contaminated"
    | "remains-unknown";
  stages: readonly {
    scenarioId: string;
    scenarioName: string;
    treatmentDate: string;
    treatmentStage: Screen04AdvancedTreatmentStage;
    comparisonObservations: number;
    comparisonUnits: number;
    exposed: number;
    exposedUnits: number;
    unexposed: number;
    unexposedUnits: number;
    unknown: number;
    unknownUnits: number;
    notApplicable: number;
    notApplicableUnits: number;
    exposedShare: number;
    exposedUnitShare: number;
    byYear: readonly {
      year: number;
      comparisonObservations: number;
      comparisonUnits: number;
      exposed: number;
      exposedUnits: number;
      unexposed: number;
      unexposedUnits: number;
      unknown: number;
      unknownUnits: number;
      notApplicable: number;
      notApplicableUnits: number;
      exposedShare: number;
      exposedUnitShare: number;
    }[];
  }[];
};

export type Screen04VersionSeparabilityDiagnostic = {
  conclusion:
    | "independent-components"
    | "perfectly-bundled"
    | "nested-stages"
    | "package-only";
  definitionsCompared: number;
  distinctExposurePatterns: number;
  versions: readonly {
    scenarioId: string;
    scenarioName: string;
    treatmentStage: Screen04AdvancedTreatmentStage;
    coverageVersion: string;
    componentOrPackage: Screen04AdvancedScenario["componentOrPackage"];
    exposedObservations: number;
    exposedUnits: number;
    exposedPeriods: readonly number[];
    standaloneExposedObservations: number;
    standaloneExposedUnits: number;
    standaloneExposedPeriods: readonly number[];
  }[];
  pairwiseCoOccurrence: readonly {
    leftScenarioId: string;
    rightScenarioId: string;
    coExposedObservations: number;
    leftOnlyObservations: number;
    rightOnlyObservations: number;
    leftAlwaysAccompaniesRight: boolean;
    rightAlwaysAccompaniesLeft: boolean;
    perfectlyBundled: boolean;
  }[];
};

export type Screen04RepairPriorityDiagnostic = {
  unknownObservations: number;
  unknownUnits: number;
  noBoundedRepairPathObservations: number;
  noBoundedRepairPathUnits: number;
  singleFieldYields: readonly {
    variable: string;
    unknownObservations: number;
    unknownUnits: number;
    onlyObstacleObservations: number;
    onlyObstacleUnits: number;
    potentiallyClassifiableObservations: number;
    potentiallyClassifiableUnits: number;
  }[];
  greedyOrder: readonly {
    step: number;
    variable: string;
    incrementalPotentiallyClassifiableObservations: number;
    cumulativePotentiallyClassifiableObservations: number;
    incrementalPotentiallyClassifiableUnits: number;
    cumulativePotentiallyClassifiableUnits: number;
  }[];
  lowerLevelRequirements: readonly {
    requirement: string;
    unknownObservations: number;
    unknownUnits: number;
  }[];
};

export type Screen04AssignmentAggregationDiagnostic = {
  conclusion:
    | "not-assessed"
    | "aligned"
    | "resolved-by-crosswalk"
    | "crosswalk-required"
    | "partial-crosswalk"
    | "mixed-lower-level-exposure"
    | "insufficient-crosswalk-information";
  concern: boolean;
  aggregateSummary: {
    aggregateUnits: number;
    aggregateUnitPeriods: number;
    fullyExposedAggregateUnits: number;
    partiallyExposedAggregateUnits: number;
    unexposedAggregateUnits: number;
    unknownAggregateUnits: number;
    fullyExposedAggregateUnitPeriods: number;
    partiallyExposedAggregateUnitPeriods: number;
    unexposedAggregateUnitPeriods: number;
    unknownAggregateUnitPeriods: number;
    exposureShareSummary: {
      calculatedAggregateUnitPeriods: number;
      minimum: number | null;
      maximum: number | null;
      mean: number | null;
    };
  } | null;
};

export type Screen04UnknownCompositionBounds = {
  totalOperative: number;
  knownExposed: number;
  knownUnexposed: number;
  unknown: number;
  minimumExposed: number;
  maximumExposed: number;
  minimumExposedShare: number;
  maximumExposedShare: number;
};

export type Screen04UnknownCompositionDiagnostic = {
  conclusion:
    | "none"
    | "few-peripheral"
    | "bounded-review"
    | "material"
    | "concentrated-in-comparison";
  overall: Screen04UnknownCompositionBounds;
  treated: Screen04UnknownCompositionBounds;
  comparison: Screen04UnknownCompositionBounds;
  assumptions: {
    allUnknownExposed: Screen04UnknownCompositionAssumption;
    allUnknownUnexposed: Screen04UnknownCompositionAssumption;
    unknownExcluded: Screen04UnknownCompositionAssumption;
  };
  controlContaminationRange: {
    minimumExposedObservations: number;
    maximumExposedObservations: number;
    minimumExposedUnits: number;
    maximumExposedUnits: number;
    minimumShare: number;
    maximumShare: number;
  };
  mostAffectedPeriods: readonly {
    year: number;
    unknownObservations: number;
    unknownUnits: number;
    proposedComparisonUnknownUnits: number;
    unknownShare: number;
  }[];
  pivotalUnits: readonly {
    unitIdentifier: string;
    proposedGroup: Screen04AdvancedProposedGroup | "mixed";
    unknownObservations: number;
    years: readonly number[];
  }[];
  truncatedPivotalUnitCount: number;
};

export type Screen04UnknownCompositionAssumption = {
  exposedObservations: number;
  unexposedObservations: number;
  excludedUnknownObservations: number;
  exposedUnits: number;
  unexposedUnits: number;
  excludedUnknownUnits: number;
  proposedControlExposedObservations: number;
  proposedControlExposedUnits: number;
  proposedControlContaminationShare: number;
};

export type Screen04AdvancedDiagnosticResult = {
  schemaVersion: typeof SCREEN_04_ADVANCED_DIAGNOSTIC_SCHEMA_VERSION;
  referenceScenarioId: string;
  selectedColumns: readonly string[];
  scenarios: readonly Screen04AdvancedScenarioSummary[];
  treatmentDefinitionStability: Screen04TreatmentStabilityDiagnostic;
  proposedCodingDisagreement: Screen04DisagreementDiagnostic;
  comparisonGroupSurvival: Screen04ComparisonSurvivalDiagnostic;
  treatmentVersionSeparability: Screen04VersionSeparabilityDiagnostic;
  dataRepairPriority: Screen04RepairPriorityDiagnostic;
  assignmentLevelAggregation: Screen04AssignmentAggregationDiagnostic;
  unknownExposureComposition: Screen04UnknownCompositionDiagnostic;
  priorityFindings: readonly Screen04AdvancedFinding[];
  otherFindings: readonly Screen04AdvancedFinding[];
};

type DetailSeed = {
  scenario: Screen04AdvancedScenario;
  fact: Screen04AdvancedCaseFact;
  reasons?: readonly Screen04AdvancedReasonCategory[];
};

const statuses: readonly Screen04ExposureStatus[] = [
  "exposed",
  "unexposed",
  "unknown",
  "not_applicable",
];

const stages: readonly Screen04AdvancedTreatmentStage[] = [
  "announcement",
  "enactment",
  "effective",
  "implementation",
  "compliance",
  "enforcement",
  "amendment",
  "repeal-or-delay",
  "other",
];

const reasonCategories: readonly Screen04AdvancedReasonCategory[] = [
  "geography",
  "organization-type",
  "threshold",
  "exemption",
  "timing",
  "amendment",
  "assignment-unit",
  "missing-information",
  "treatment-component",
  "coverage-condition",
  "multi-condition",
];

const severityOrder: Record<Screen04V0403Severity, number> = {
  "Design blocker": 0,
  "Major design concern": 1,
  "Review before analysis": 2,
  Informational: 3,
};

function fail(message: string): never {
  throw new Error(message);
}

function unique<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values));
}

function share(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function safeText(value: string, label: string, maximum = 300): string {
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (!normalized || normalized.length > maximum) {
    fail(`${label} must be non-empty and at most ${maximum} characters.`);
  }
  return normalized;
}

function exactDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return parsed.getUTCFullYear() === Number(match[1]) &&
    parsed.getUTCMonth() + 1 === Number(match[2]) &&
    parsed.getUTCDate() === Number(match[3]);
}

function exactKeys(value: object, allowed: readonly string[], label: string) {
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    fail(`${label} contains unsupported or raw fields.`);
  }
}

function normalizeReasons(
  values: readonly Screen04AdvancedReasonCategory[],
): Screen04AdvancedReasonCategory[] {
  const supplied = unique(values);
  if (supplied.some((value) => !reasonCategories.includes(value))) {
    fail("A case fact contains an unsupported disagreement reason.");
  }
  const substantive = supplied.filter((value) => value !== "multi-condition");
  return supplied.includes("multi-condition") || substantive.length > 1
    ? [...substantive, "multi-condition"]
    : substantive;
}

function validateAndNormalizeInput(
  input: Screen04AdvancedDiagnosticInput,
): {
  scenarios: Screen04AdvancedScenario[];
  reference: Screen04AdvancedScenario;
  assignmentContext: Screen04AdvancedAssignmentContext | null;
} {
  if (!Array.isArray(input.scenarios) || input.scenarios.length === 0) {
    fail("Advanced Screen 4 diagnostics require at least one scenario.");
  }
  if (input.scenarios.length > SCREEN_04_ADVANCED_DIAGNOSTIC_LIMITS.maximumScenarios) {
    fail(`Advanced Screen 4 diagnostics support at most ${SCREEN_04_ADVANCED_DIAGNOSTIC_LIMITS.maximumScenarios} scenarios.`);
  }
  const scenarioIds = new Set<string>();
  const components = new Set<string>();
  const scenariosNormalized: Screen04AdvancedScenario[] = input.scenarios.map((
    scenario: Screen04AdvancedScenario,
    scenarioIndex: number,
  ): Screen04AdvancedScenario => {
    exactKeys(scenario, [
      "id",
      "name",
      "treatmentDate",
      "treatmentStage",
      "coverageVersion",
      "componentOrPackage",
      "sourceBasis",
      "cases",
    ], `Scenario ${scenarioIndex + 1}`);
    const id = safeText(scenario.id, "Scenario ID", 120);
    if (scenarioIds.has(id)) fail(`Duplicate advanced scenario ID ${id}.`);
    scenarioIds.add(id);
    if (!exactDate(scenario.treatmentDate)) {
      fail(`Scenario ${id} requires an exact source-supported date.`);
    }
    if (!stages.includes(scenario.treatmentStage)) {
      fail(`Scenario ${id} has an unsupported treatment stage.`);
    }
    exactKeys(
      scenario.componentOrPackage,
      ["kind", "name"],
      `Scenario ${id} component/package`,
    );
    if (!["component", "package"].includes(scenario.componentOrPackage.kind)) {
      fail(`Scenario ${id} has an invalid component/package kind.`);
    }
    const componentName = safeText(
      scenario.componentOrPackage.name,
      `Scenario ${id} component/package name`,
    );
    components.add(`${scenario.componentOrPackage.kind}:${componentName}`);
    exactKeys(
      scenario.sourceBasis,
      ["eventCardBasis", "selectedColumns"],
      `Scenario ${id} source basis`,
    );
    const selectedColumns = unique<string>(scenario.sourceBasis.selectedColumns.map(
      (column: string) => safeText(column, `Scenario ${id} selected column`, 160),
    )).sort((left, right) => left.localeCompare(right, "en-US"));
    if (selectedColumns.length >
      SCREEN_04_ADVANCED_DIAGNOSTIC_LIMITS.maximumSelectedColumns) {
      fail(`Scenario ${id} selects too many columns.`);
    }
    if (!Array.isArray(scenario.cases) || scenario.cases.length >
      SCREEN_04_ADVANCED_DIAGNOSTIC_LIMITS.maximumCaseFactsPerScenario) {
      fail(`Scenario ${id} exceeds the selected-case-fact bound.`);
    }
    const caseKeys = new Set<string>();
    const cases = scenario.cases.map((
      fact: Screen04AdvancedCaseFact,
      factIndex: number,
    ) => {
      exactKeys(fact, [
        "unitIdentifier",
        "year",
        "proposedGroup",
        "auditedStatus",
        "reasonCategories",
        "missingRepairVariables",
        "lowerLevelRepairRequirement",
      ], `Scenario ${id} case fact ${factIndex + 1}`);
      const unitIdentifier = safeText(
        fact.unitIdentifier,
        `Scenario ${id} unit identifier`,
        200,
      );
      if (!Number.isInteger(fact.year) || fact.year < 1000 || fact.year > 9999) {
        fail(`Scenario ${id} contains an invalid annual year.`);
      }
      if (!["treated", "comparison"].includes(fact.proposedGroup)) {
        fail(`Scenario ${id} contains an invalid proposed group.`);
      }
      if (!statuses.includes(fact.auditedStatus)) {
        fail(`Scenario ${id} contains an invalid audited status.`);
      }
      const key = JSON.stringify([unitIdentifier, fact.year]);
      if (caseKeys.has(key)) {
        fail(`Scenario ${id} contains a duplicate selected unit-year.`);
      }
      caseKeys.add(key);
      return {
        unitIdentifier,
        year: fact.year,
        proposedGroup: fact.proposedGroup,
        auditedStatus: fact.auditedStatus,
        reasonCategories: normalizeReasons(fact.reasonCategories),
        missingRepairVariables: unique<string>(fact.missingRepairVariables.map(
          (variable: string) => safeText(variable, "Repair variable", 160),
        )).sort((left, right) => left.localeCompare(right, "en-US")),
        lowerLevelRepairRequirement:
          fact.lowerLevelRepairRequirement === undefined ||
            fact.lowerLevelRepairRequirement === null
            ? null
            : safeText(
              fact.lowerLevelRepairRequirement,
              "Lower-level repair requirement",
              200,
            ),
      } satisfies Screen04AdvancedCaseFact;
    });
    return {
      id,
      name: safeText(scenario.name, `Scenario ${id} name`, 200),
      treatmentDate: scenario.treatmentDate,
      treatmentStage: scenario.treatmentStage,
      coverageVersion: safeText(
        scenario.coverageVersion,
        `Scenario ${id} coverage version`,
        200,
      ),
      componentOrPackage: {
        kind: scenario.componentOrPackage.kind,
        name: componentName,
      },
      sourceBasis: {
        eventCardBasis: safeText(
          scenario.sourceBasis.eventCardBasis,
          `Scenario ${id} Event Card basis`,
          600,
        ),
        selectedColumns,
      },
      cases,
    } satisfies Screen04AdvancedScenario;
  });
  if (components.size > SCREEN_04_ADVANCED_DIAGNOSTIC_LIMITS.maximumComponents) {
    fail(`Advanced Screen 4 diagnostics support at most ${SCREEN_04_ADVANCED_DIAGNOSTIC_LIMITS.maximumComponents} components/packages.`);
  }
  const selectedColumnUnion = unique<string>(scenariosNormalized.flatMap(
    (scenario) => scenario.sourceBasis.selectedColumns,
  ));
  if (selectedColumnUnion.length >
    SCREEN_04_ADVANCED_DIAGNOSTIC_LIMITS.maximumSelectedColumns) {
    fail(`Advanced Screen 4 diagnostics support at most ${SCREEN_04_ADVANCED_DIAGNOSTIC_LIMITS.maximumSelectedColumns} selected columns across all scenarios.`);
  }
  const repairVariables = unique<string>(scenariosNormalized.flatMap((scenario) =>
    scenario.cases.flatMap((fact: Screen04AdvancedCaseFact) =>
      fact.missingRepairVariables
    )
  ));
  if (repairVariables.length >
    SCREEN_04_ADVANCED_DIAGNOSTIC_LIMITS.maximumRepairVariables) {
    fail(`Advanced Screen 4 diagnostics support at most ${SCREEN_04_ADVANCED_DIAGNOSTIC_LIMITS.maximumRepairVariables} repair variables.`);
  }
  const reference = input.referenceScenarioId === undefined
    ? scenariosNormalized[0]
    : scenariosNormalized.find(
        (scenario) => scenario.id === input.referenceScenarioId,
      );
  if (!reference) fail("The reference scenario is unavailable.");
  let assignmentContext: Screen04AdvancedAssignmentContext | null = null;
  if (input.assignmentContext) {
    exactKeys(input.assignmentContext, [
      "datasetUnit",
      "shockUnit",
      "crosswalkStatus",
      "withinAggregateExposure",
      "aggregateExposureFacts",
    ], "Assignment context");
    const aggregateExposureFacts = input.assignmentContext.aggregateExposureFacts ?? [];
    if (aggregateExposureFacts.length >
      SCREEN_04_ADVANCED_DIAGNOSTIC_LIMITS.maximumCaseFactsPerScenario) {
      fail("Assignment aggregation exceeds the selected-case-fact bound.");
    }
    assignmentContext = {
      datasetUnit: input.assignmentContext.datasetUnit,
      shockUnit: input.assignmentContext.shockUnit,
      crosswalkStatus: input.assignmentContext.crosswalkStatus,
      withinAggregateExposure: input.assignmentContext.withinAggregateExposure,
      aggregateExposureFacts: aggregateExposureFacts.map((fact, index) => {
        exactKeys(fact, [
          "aggregateUnitIdentifier",
          "lowerLevelUnitIdentifier",
          "year",
          "auditedStatus",
        ], `Assignment aggregation fact ${index + 1}`);
        if (!Number.isInteger(fact.year) || fact.year < 1000 || fact.year > 9999) {
          fail("An assignment aggregation fact contains an invalid annual year.");
        }
        if (!statuses.includes(fact.auditedStatus)) {
          fail("An assignment aggregation fact contains an invalid audited status.");
        }
        return {
          aggregateUnitIdentifier: safeText(
            fact.aggregateUnitIdentifier,
            "Aggregate unit identifier",
            200,
          ),
          lowerLevelUnitIdentifier: safeText(
            fact.lowerLevelUnitIdentifier,
            "Lower-level unit identifier",
            200,
          ),
          year: fact.year,
          auditedStatus: fact.auditedStatus,
        };
      }),
    };
  }
  return {
    scenarios: scenariosNormalized,
    reference,
    assignmentContext,
  };
}

function classificationCounts(
  facts: readonly Screen04AdvancedCaseFact[],
): Screen04AdvancedClassificationCounts {
  const counts: Screen04AdvancedClassificationCounts = {
    exposed: 0,
    unexposed: 0,
    unknown: 0,
    not_applicable: 0,
    total: facts.length,
  };
  for (const fact of facts) counts[fact.auditedStatus] += 1;
  return counts;
}

function caseKey(fact: Screen04AdvancedCaseFact): string {
  return JSON.stringify([fact.unitIdentifier, fact.year]);
}

function boundedWhere(
  seeds: readonly DetailSeed[],
): Screen04AdvancedWhereItOccurs {
  const deduplicated = new Map<string, Screen04AdvancedAffectedDetail>();
  for (const seed of seeds) {
    const reasons = normalizeReasons(seed.reasons ?? seed.fact.reasonCategories);
    const detail: Screen04AdvancedAffectedDetail = {
      scenarioName: seed.scenario.name,
      unitIdentifier: seed.fact.unitIdentifier,
      year: seed.fact.year,
      treatmentStage: seed.scenario.treatmentStage,
      proposedGroup: seed.fact.proposedGroup,
      auditedStatus: seed.fact.auditedStatus,
      reasonCategories: reasons,
    };
    deduplicated.set(JSON.stringify(detail), detail);
  }
  const ordered = [...deduplicated.values()].sort((left, right) =>
    left.scenarioName.localeCompare(right.scenarioName, "en-US") ||
    left.unitIdentifier.localeCompare(right.unitIdentifier, "en-US") ||
    left.year - right.year ||
    left.proposedGroup.localeCompare(right.proposedGroup, "en-US") ||
    left.auditedStatus.localeCompare(right.auditedStatus, "en-US")
  );
  const details = ordered.slice(
    0,
    SCREEN_04_ADVANCED_DIAGNOSTIC_LIMITS.maximumAffectedDetails,
  );
  return {
    details,
    truncatedDetailCount: ordered.length - details.length,
  };
}

function finding(input: {
  code: Screen04AdvancedFindingCode;
  severity: Screen04V0403Severity;
  consequenceOrder: Screen04V0403ConsequenceOrder;
  title: string;
  whatFound: string;
  whyItMatters: string;
  possibleNextStep: string | null;
  seeds: readonly DetailSeed[];
  referenceObservationCount: number;
}): Screen04AdvancedFinding {
  const affectedObservationKeys = new Set(
    input.seeds.map((seed) => caseKey(seed.fact)),
  );
  const affectedUnits = new Set(
    input.seeds.map((seed) => seed.fact.unitIdentifier),
  ).size;
  return {
    code: input.code,
    severity: input.severity,
    consequenceOrder: input.consequenceOrder,
    title: input.title,
    whatFound: input.whatFound,
    whyItMatters: input.whyItMatters,
    possibleNextStep: input.possibleNextStep,
    aggregate: {
      affectedObservations: affectedObservationKeys.size,
      affectedUnits,
      shareOfReferenceObservations: share(
        affectedObservationKeys.size,
        input.referenceObservationCount,
      ),
    },
    whereItOccurs: boundedWhere(input.seeds),
  };
}

function selectedBasisChanged(
  left: Screen04AdvancedScenario,
  right: Screen04AdvancedScenario,
): boolean {
  return left.sourceBasis.eventCardBasis !== right.sourceBasis.eventCardBasis ||
    JSON.stringify(left.sourceBasis.selectedColumns) !==
      JSON.stringify(right.sourceBasis.selectedColumns);
}

function stabilityDiagnostic(
  scenariosInput: readonly Screen04AdvancedScenario[],
  reference: Screen04AdvancedScenario,
): {
  diagnostic: Screen04TreatmentStabilityDiagnostic;
  seeds: DetailSeed[];
} {
  const referenceByKey = new Map(reference.cases.map((fact) => [caseKey(fact), fact]));
  const seeds: DetailSeed[] = [];
  const comparisons = scenariosInput
    .filter((scenario) => scenario.id !== reference.id)
    .map((scenario): Screen04TreatmentStabilityComparison => {
      const alternativeByKey = new Map(
        scenario.cases.map((fact) => [caseKey(fact), fact]),
      );
      const changed: Array<{
        reference: Screen04AdvancedCaseFact;
        alternative: Screen04AdvancedCaseFact;
      }> = [];
      for (const [key, referenceFact] of referenceByKey) {
        const alternative = alternativeByKey.get(key);
        if (alternative &&
          alternative.auditedStatus !== referenceFact.auditedStatus) {
          changed.push({ reference: referenceFact, alternative });
          seeds.push({ scenario, fact: alternative });
        }
      }
      const drivers: Screen04TreatmentStabilityComparison["drivers"][number][] = [];
      if (scenario.treatmentDate !== reference.treatmentDate ||
        scenario.treatmentStage !== reference.treatmentStage) {
        drivers.push("treatment-date-stage");
      }
      if (scenario.coverageVersion !== reference.coverageVersion) {
        drivers.push("coverage-version");
      }
      if (scenario.componentOrPackage.kind !== reference.componentOrPackage.kind ||
        scenario.componentOrPackage.name !== reference.componentOrPackage.name) {
        drivers.push("component-or-package");
      }
      if (selectedBasisChanged(reference, scenario)) {
        drivers.push("source-basis");
      }
      const timingOnly = drivers.length === 1 &&
        drivers[0] === "treatment-date-stage" &&
        changed.length > 0 &&
        changed.every(({ reference: left, alternative: right }) =>
          (left.auditedStatus === "not_applicable") !==
            (right.auditedStatus === "not_applicable")
        );
      return {
        referenceScenarioId: reference.id,
        alternativeScenarioId: scenario.id,
        comparedObservations: Math.min(referenceByKey.size, alternativeByKey.size),
        changedObservations: changed.length,
        changedUnits: new Set(
          changed.map(({ alternative }) => alternative.unitIdentifier),
        ).size,
        changedShare: share(changed.length, referenceByKey.size),
        drivers,
        timingOnly,
      };
    });
  return {
    diagnostic: {
      conclusion: comparisons.some((item) => item.changedObservations > 0)
        ? "classification-sensitive"
        : "stable",
      comparisons,
    },
    seeds,
  };
}

function disagreementDiagnostic(
  reference: Screen04AdvancedScenario,
): { diagnostic: Screen04DisagreementDiagnostic; seeds: DetailSeed[] } {
  const disagreements = reference.cases.filter((fact) =>
    (fact.proposedGroup === "treated" && fact.auditedStatus === "unexposed") ||
    (fact.proposedGroup === "comparison" && fact.auditedStatus === "exposed") ||
    fact.auditedStatus === "unknown"
  );
  const counts = Object.fromEntries(
    reasonCategories.map((reason) => [reason, 0]),
  ) as Record<Screen04AdvancedReasonCategory, number>;
  for (const fact of disagreements) {
    const reasons = normalizeReasons([
      ...fact.reasonCategories,
      ...(fact.auditedStatus === "unknown"
        ? ["missing-information" as const]
        : []),
    ]);
    const counted = reasons.length === 0
      ? ["coverage-condition" as const]
      : reasons;
    for (const reason of counted) counts[reason] += 1;
  }
  return {
    diagnostic: {
      disagreementObservations: disagreements.length,
      disagreementUnits: new Set(
        disagreements.map((fact) => fact.unitIdentifier),
      ).size,
      disagreementShare: share(disagreements.length, reference.cases.length),
      multiReasonObservations: disagreements.filter((fact) =>
        normalizeReasons([
          ...fact.reasonCategories,
          ...(fact.auditedStatus === "unknown"
            ? ["missing-information" as const]
            : []),
        ]).includes("multi-condition")
      ).length,
      reasonCounts: counts,
    },
    seeds: disagreements.map((fact) => ({
      scenario: reference,
      fact,
      reasons: normalizeReasons([
        ...fact.reasonCategories,
        ...(fact.auditedStatus === "unknown"
          ? ["missing-information" as const]
          : []),
      ]),
    })),
  };
}

function uniqueStatusUnits(
  facts: readonly Screen04AdvancedCaseFact[],
  status?: Screen04ExposureStatus,
): number {
  return new Set(facts
    .filter((fact) => status === undefined || fact.auditedStatus === status)
    .map((fact) => fact.unitIdentifier)).size;
}

function comparisonMetrics(
  facts: readonly Screen04AdvancedCaseFact[],
) {
  const counts = classificationCounts(facts);
  const operativeCount = counts.exposed + counts.unexposed + counts.unknown;
  const operativeUnits = uniqueStatusUnits(facts.filter(
    (fact) => fact.auditedStatus !== "not_applicable",
  ));
  const exposedUnits = uniqueStatusUnits(facts, "exposed");
  return {
    comparisonObservations: facts.length,
    comparisonUnits: uniqueStatusUnits(facts),
    exposed: counts.exposed,
    exposedUnits,
    unexposed: counts.unexposed,
    unexposedUnits: uniqueStatusUnits(facts, "unexposed"),
    unknown: counts.unknown,
    unknownUnits: uniqueStatusUnits(facts, "unknown"),
    notApplicable: counts.not_applicable,
    notApplicableUnits: uniqueStatusUnits(facts, "not_applicable"),
    exposedShare: share(counts.exposed, operativeCount),
    exposedUnitShare: share(exposedUnits, operativeUnits),
  };
}

function comparisonSurvivalDiagnostic(
  scenariosInput: readonly Screen04AdvancedScenario[],
): {
  diagnostic: Screen04ComparisonSurvivalDiagnostic;
  seeds: DetailSeed[];
} {
  const ordered = [...scenariosInput].sort((left, right) =>
    left.treatmentDate.localeCompare(right.treatmentDate, "en-US") ||
    stages.indexOf(left.treatmentStage) - stages.indexOf(right.treatmentStage) ||
    left.name.localeCompare(right.name, "en-US")
  );
  const stageMetrics = ordered.map((scenario) => {
    const comparison = scenario.cases.filter(
      (fact) => fact.proposedGroup === "comparison",
    );
    const metrics = comparisonMetrics(comparison);
    const byYear = unique(comparison.map((fact) => fact.year))
      .sort((left, right) => left - right)
      .map((year) => ({
        year,
        ...comparisonMetrics(comparison.filter((fact) => fact.year === year)),
      }));
    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      treatmentDate: scenario.treatmentDate,
      treatmentStage: scenario.treatmentStage,
      ...metrics,
      byYear,
    };
  });
  const firstExposed = stageMetrics.findIndex((stage) => stage.exposed > 0);
  const anyUnknown = stageMetrics.some((stage) => stage.unknown > 0);
  let conclusion: Screen04ComparisonSurvivalDiagnostic["conclusion"];
  if (firstExposed < 0) {
    conclusion = anyUnknown ? "remains-unknown" : "stays-unexposed";
  } else if (
    stageMetrics[firstExposed].treatmentStage === "amendment" &&
    stageMetrics.slice(0, firstExposed).every((stage) => stage.exposed === 0)
  ) {
    conclusion = "amendment-only-exposure";
  } else {
    const shares = stageMetrics.map((stage) => stage.exposedUnitShare);
    const nondecreasing = shares.every(
      (value, index) => index === 0 || value >= shares[index - 1],
    );
    const gradual = firstExposed > 0 && nondecreasing &&
      new Set(shares).size > 1 && shares.at(-1)! < 1;
    conclusion = gradual
      ? "gradual-post-implementation-exposure"
      : "contaminated";
  }
  const seeds = ordered.flatMap((scenario) => scenario.cases
    .filter((fact) =>
      fact.proposedGroup === "comparison" &&
      (fact.auditedStatus === "exposed" ||
        (conclusion === "remains-unknown" && fact.auditedStatus === "unknown"))
    )
    .map((fact) => ({ scenario, fact })));
  return { diagnostic: { conclusion, stages: stageMetrics }, seeds };
}

function exposedSet(scenario: Screen04AdvancedScenario): Set<string> {
  return new Set(scenario.cases
    .filter((fact) => fact.auditedStatus === "exposed")
    .map(caseKey));
}

function isSubset(left: Set<string>, right: Set<string>): boolean {
  return [...left].every((value) => right.has(value));
}

function versionSeparabilityDiagnostic(
  scenariosInput: readonly Screen04AdvancedScenario[],
): Screen04VersionSeparabilityDiagnostic {
  const definitions = unique(scenariosInput.map((scenario) =>
    `${scenario.componentOrPackage.kind}:${scenario.componentOrPackage.name}:${scenario.coverageVersion}`
  ));
  const sets = scenariosInput.map(exposedSet);
  const pairwiseCoOccurrence: Screen04VersionSeparabilityDiagnostic["pairwiseCoOccurrence"][number][] = [];
  for (let leftIndex = 0; leftIndex < sets.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < sets.length; rightIndex += 1) {
      const left = sets[leftIndex]!;
      const right = sets[rightIndex]!;
      const coExposed = [...left].filter((key) => right.has(key)).length;
      const leftOnly = [...left].filter((key) => !right.has(key)).length;
      const rightOnly = [...right].filter((key) => !left.has(key)).length;
      pairwiseCoOccurrence.push({
        leftScenarioId: scenariosInput[leftIndex]!.id,
        rightScenarioId: scenariosInput[rightIndex]!.id,
        coExposedObservations: coExposed,
        leftOnlyObservations: leftOnly,
        rightOnlyObservations: rightOnly,
        leftAlwaysAccompaniesRight: leftOnly === 0,
        rightAlwaysAccompaniesLeft: rightOnly === 0,
        perfectlyBundled: leftOnly === 0 && rightOnly === 0,
      });
    }
  }
  const allCaseKeys = unique(scenariosInput.flatMap((scenario) =>
    scenario.cases.map(caseKey)
  ));
  const distinctExposurePatterns = new Set(allCaseKeys.map((key) =>
    sets.map((set) => set.has(key) ? "1" : "0").join("")
  )).size;
  const versions = scenariosInput.map((scenario, scenarioIndex) => {
    const exposed = scenario.cases.filter((fact) => fact.auditedStatus === "exposed");
    const otherSets = sets.filter((_set, index) => index !== scenarioIndex);
    const standalone = exposed.filter((fact) =>
      otherSets.every((set) => !set.has(caseKey(fact)))
    );
    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      treatmentStage: scenario.treatmentStage,
      coverageVersion: scenario.coverageVersion,
      componentOrPackage: scenario.componentOrPackage,
      exposedObservations: exposed.length,
      exposedUnits: uniqueStatusUnits(exposed),
      exposedPeriods: unique(exposed.map((fact) => fact.year)).sort(
        (left, right) => left - right,
      ),
      standaloneExposedObservations: standalone.length,
      standaloneExposedUnits: uniqueStatusUnits(standalone),
      standaloneExposedPeriods: unique(standalone.map((fact) => fact.year)).sort(
        (left, right) => left - right,
      ),
    };
  });
  const base = {
    definitionsCompared: definitions.length,
    distinctExposurePatterns,
    versions,
    pairwiseCoOccurrence,
  };
  if (definitions.length === 1 &&
    scenariosInput.every((scenario) => scenario.componentOrPackage.kind === "package")) {
    return { conclusion: "package-only", ...base };
  }
  if (sets.length < 2) {
    return {
      conclusion: scenariosInput[0]?.componentOrPackage.kind === "package"
        ? "package-only"
        : "independent-components",
      ...base,
    };
  }
  const signatures = sets.map((set) => [...set].sort().join("\u0000"));
  if (new Set(signatures).size === 1) {
    return {
      conclusion: "perfectly-bundled",
      ...base,
    };
  }
  const nested = sets.every((left, leftIndex) =>
    sets.every((right, rightIndex) =>
      leftIndex === rightIndex || isSubset(left, right) || isSubset(right, left)
    )
  );
  return {
    conclusion: nested ? "nested-stages" : "independent-components",
    ...base,
  };
}

function repairPriorityDiagnostic(
  reference: Screen04AdvancedScenario,
): {
  diagnostic: Screen04RepairPriorityDiagnostic;
  seeds: DetailSeed[];
} {
  const unknown = reference.cases.filter(
    (fact) => fact.auditedStatus === "unknown",
  );
  const repairable = unknown.filter(
    (fact) => fact.missingRepairVariables.length > 0,
  );
  const variables = unique(repairable.flatMap(
    (fact) => fact.missingRepairVariables,
  )).sort((left, right) => left.localeCompare(right, "en-US"));
  const singleFieldYields = variables.map((variable) => {
    const associated = repairable.filter((fact) =>
      fact.missingRepairVariables.includes(variable)
    );
    const onlyObstacle = repairable.filter((fact) =>
      fact.missingRepairVariables.length === 1 &&
      fact.missingRepairVariables[0] === variable
    );
    return {
      variable,
      unknownObservations: associated.length,
      unknownUnits: uniqueStatusUnits(associated),
      onlyObstacleObservations: onlyObstacle.length,
      onlyObstacleUnits: uniqueStatusUnits(onlyObstacle),
      // Backward-compatible reader name: a single field can make only these
      // already-complete cases potentially classifiable by itself.
      potentiallyClassifiableObservations: onlyObstacle.length,
      potentiallyClassifiableUnits: uniqueStatusUnits(onlyObstacle),
    };
  });
  const selected = new Set<string>();
  let currentlyPotentialKeys = new Set<string>();
  let currentlyPotentialUnits = new Set<string>();
  const greedyOrder: Screen04RepairPriorityDiagnostic["greedyOrder"][number][] = [];
  while (selected.size < variables.length) {
    const remaining = variables.filter((variable) => !selected.has(variable));
    const options = remaining.map((variable) => {
      const candidate = new Set([...selected, variable]);
      const cumulativeFacts = repairable.filter((fact) =>
        fact.missingRepairVariables.every((item) => candidate.has(item))
      );
      const cumulativeKeys = new Set(cumulativeFacts.map(caseKey));
      const cumulativeUnits = new Set(cumulativeFacts.map(
        (fact) => fact.unitIdentifier,
      ));
      const occurrence = repairable.filter((fact) =>
        fact.missingRepairVariables.includes(variable)
      ).length;
      return {
        variable,
        cumulativeKeys,
        cumulativeUnits,
        incremental: [...cumulativeKeys].filter(
          (key) => !currentlyPotentialKeys.has(key),
        ).length,
        incrementalUnits: [...cumulativeUnits].filter(
          (unit) => !currentlyPotentialUnits.has(unit),
        ).length,
        occurrence,
      };
    }).sort((left, right) =>
      right.incremental - left.incremental ||
      right.occurrence - left.occurrence ||
      left.variable.localeCompare(right.variable, "en-US")
    );
    const next = options[0];
    if (!next) break;
    selected.add(next.variable);
    currentlyPotentialKeys = next.cumulativeKeys;
    currentlyPotentialUnits = next.cumulativeUnits;
    greedyOrder.push({
      step: greedyOrder.length + 1,
      variable: next.variable,
      incrementalPotentiallyClassifiableObservations: next.incremental,
      cumulativePotentiallyClassifiableObservations: next.cumulativeKeys.size,
      incrementalPotentiallyClassifiableUnits: next.incrementalUnits,
      cumulativePotentiallyClassifiableUnits: next.cumulativeUnits.size,
    });
  }
  const lowerLevelRequirements = unique(unknown.map(
    (fact) => fact.lowerLevelRepairRequirement,
  ).filter((value): value is string => Boolean(value))).sort(
    (left, right) => left.localeCompare(right, "en-US"),
  ).map((requirement) => {
    const affected = unknown.filter(
      (fact) => fact.lowerLevelRepairRequirement === requirement,
    );
    return {
      requirement,
      unknownObservations: affected.length,
      unknownUnits: uniqueStatusUnits(affected),
    };
  });
  const noBoundedRepairPath = unknown.filter(
    (fact) => fact.missingRepairVariables.length === 0,
  );
  return {
    diagnostic: {
      unknownObservations: unknown.length,
      unknownUnits: new Set(unknown.map((fact) => fact.unitIdentifier)).size,
      noBoundedRepairPathObservations: noBoundedRepairPath.length,
      noBoundedRepairPathUnits: uniqueStatusUnits(noBoundedRepairPath),
      singleFieldYields,
      greedyOrder,
      lowerLevelRequirements,
    },
    seeds: repairable.map((fact) => ({ scenario: reference, fact })),
  };
}

type AggregateClassification = "fully-exposed" | "partially-exposed" |
  "unexposed" | "unknown";

function assignmentAggregateSummary(
  facts: readonly Screen04AdvancedAggregateExposureFact[],
): Screen04AssignmentAggregationDiagnostic["aggregateSummary"] {
  const byUnitPeriod = new Map<string, Screen04AdvancedAggregateExposureFact[]>();
  for (const fact of facts) {
    const key = JSON.stringify([fact.aggregateUnitIdentifier, fact.year]);
    const group = byUnitPeriod.get(key) ?? [];
    group.push(fact);
    byUnitPeriod.set(key, group);
  }
  const periods: Array<{
    aggregateUnitIdentifier: string;
    classification: AggregateClassification;
    exposureShare: number | null;
  }> = [];
  for (const group of byUnitPeriod.values()) {
    const byLowerLevel = new Map<string, Set<Screen04ExposureStatus>>();
    for (const fact of group) {
      const observed = byLowerLevel.get(fact.lowerLevelUnitIdentifier) ?? new Set();
      observed.add(fact.auditedStatus);
      byLowerLevel.set(fact.lowerLevelUnitIdentifier, observed);
    }
    const operative = [...byLowerLevel.entries()].map(([
      lowerLevelUnitIdentifier,
      observed,
    ]) => ({
      lowerLevelUnitIdentifier,
      auditedStatus: observed.size === 1
        ? [...observed][0]!
        : "unknown" as const,
    })).filter((fact) => fact.auditedStatus !== "not_applicable");
    if (operative.length === 0) continue;
    const exposed = operative.filter(
      (fact) => fact.auditedStatus === "exposed",
    ).length;
    const unexposed = operative.filter(
      (fact) => fact.auditedStatus === "unexposed",
    ).length;
    const unknown = operative.filter(
      (fact) => fact.auditedStatus === "unknown",
    ).length;
    const classification: AggregateClassification = exposed > 0 && unexposed > 0
      ? "partially-exposed"
      : unknown > 0
        ? "unknown"
        : exposed > 0
          ? "fully-exposed"
          : "unexposed";
    periods.push({
      aggregateUnitIdentifier: group[0]!.aggregateUnitIdentifier,
      classification,
      exposureShare: unknown === 0 && exposed + unexposed > 0
        ? exposed / (exposed + unexposed)
        : null,
    });
  }
  if (periods.length === 0) return null;
  const byUnit = new Map<string, Set<AggregateClassification>>();
  for (const period of periods) {
    const classifications = byUnit.get(period.aggregateUnitIdentifier) ?? new Set();
    classifications.add(period.classification);
    byUnit.set(period.aggregateUnitIdentifier, classifications);
  }
  const classifyAggregateUnit = (
    classifications: ReadonlySet<AggregateClassification>,
  ): AggregateClassification => {
    if (classifications.has("partially-exposed") ||
      (classifications.has("fully-exposed") && classifications.has("unexposed"))) {
      return "partially-exposed";
    }
    if (classifications.has("unknown")) return "unknown";
    if (classifications.has("fully-exposed")) return "fully-exposed";
    return "unexposed";
  };
  const unitClassifications = [...byUnit.values()].map(classifyAggregateUnit);
  const shares = periods
    .map((period) => period.exposureShare)
    .filter((value): value is number => value !== null);
  const countUnits = (classification: AggregateClassification) =>
    unitClassifications.filter((item) => item === classification).length;
  const countPeriods = (classification: AggregateClassification) =>
    periods.filter((item) => item.classification === classification).length;
  return {
    aggregateUnits: byUnit.size,
    aggregateUnitPeriods: periods.length,
    fullyExposedAggregateUnits: countUnits("fully-exposed"),
    partiallyExposedAggregateUnits: countUnits("partially-exposed"),
    unexposedAggregateUnits: countUnits("unexposed"),
    unknownAggregateUnits: countUnits("unknown"),
    fullyExposedAggregateUnitPeriods: countPeriods("fully-exposed"),
    partiallyExposedAggregateUnitPeriods: countPeriods("partially-exposed"),
    unexposedAggregateUnitPeriods: countPeriods("unexposed"),
    unknownAggregateUnitPeriods: countPeriods("unknown"),
    exposureShareSummary: {
      calculatedAggregateUnitPeriods: shares.length,
      minimum: shares.length > 0 ? Math.min(...shares) : null,
      maximum: shares.length > 0 ? Math.max(...shares) : null,
      mean: shares.length > 0
        ? shares.reduce((sum, value) => sum + value, 0) / shares.length
        : null,
    },
  };
}

function assignmentDiagnostic(
  context: Screen04AdvancedAssignmentContext | null,
): Screen04AssignmentAggregationDiagnostic {
  const aggregateSummary = assignmentAggregateSummary(
    context?.aggregateExposureFacts ?? [],
  );
  if (!context || context.datasetUnit === null || context.shockUnit === null) {
    return { conclusion: "not-assessed", concern: false, aggregateSummary };
  }
  if (context.datasetUnit === context.shockUnit) {
    return { conclusion: "aligned", concern: false, aggregateSummary };
  }
  if (context.crosswalkStatus === "missing") {
    return { conclusion: "crosswalk-required", concern: true, aggregateSummary };
  }
  if (context.crosswalkStatus === "partial") {
    return { conclusion: "partial-crosswalk", concern: true, aggregateSummary };
  }
  if (context.crosswalkStatus === "not-required" ||
    context.crosswalkStatus === "unknown" ||
    context.withinAggregateExposure === null ||
    context.withinAggregateExposure === "unknown") {
    return {
      conclusion: "insufficient-crosswalk-information",
      concern: false,
      aggregateSummary,
    };
  }
  if (context.crosswalkStatus === "complete" && (
    context.withinAggregateExposure === "mixed" ||
    (aggregateSummary?.partiallyExposedAggregateUnits ?? 0) > 0
  )) {
    return {
      conclusion: "mixed-lower-level-exposure",
      concern: true,
      aggregateSummary,
    };
  }
  return {
    conclusion: "resolved-by-crosswalk",
    concern: false,
    aggregateSummary,
  };
}

function unknownBounds(
  facts: readonly Screen04AdvancedCaseFact[],
): Screen04UnknownCompositionBounds {
  const operative = facts.filter(
    (fact) => fact.auditedStatus !== "not_applicable",
  );
  const knownExposed = operative.filter(
    (fact) => fact.auditedStatus === "exposed",
  ).length;
  const knownUnexposed = operative.filter(
    (fact) => fact.auditedStatus === "unexposed",
  ).length;
  const unknown = operative.filter(
    (fact) => fact.auditedStatus === "unknown",
  ).length;
  return {
    totalOperative: operative.length,
    knownExposed,
    knownUnexposed,
    unknown,
    minimumExposed: knownExposed,
    maximumExposed: knownExposed + unknown,
    minimumExposedShare: share(knownExposed, operative.length),
    maximumExposedShare: share(knownExposed + unknown, operative.length),
  };
}

function unknownAssumption(
  facts: readonly Screen04AdvancedCaseFact[],
  assumption: "exposed" | "unexposed" | "excluded",
): Screen04UnknownCompositionAssumption {
  const operative = facts.filter(
    (fact) => fact.auditedStatus !== "not_applicable",
  );
  const included = operative.filter(
    (fact) => fact.auditedStatus !== "unknown" || assumption !== "excluded",
  );
  const statusFor = (fact: Screen04AdvancedCaseFact) =>
    fact.auditedStatus === "unknown" ? assumption : fact.auditedStatus;
  const exposed = included.filter((fact) => statusFor(fact) === "exposed");
  const unexposed = included.filter((fact) => statusFor(fact) === "unexposed");
  const excludedUnknown = operative.filter(
    (fact) => fact.auditedStatus === "unknown" && assumption === "excluded",
  );
  const byUnit = new Map<string, Screen04AdvancedCaseFact[]>();
  for (const fact of included) {
    const unitFacts = byUnit.get(fact.unitIdentifier) ?? [];
    unitFacts.push(fact);
    byUnit.set(fact.unitIdentifier, unitFacts);
  }
  const exposedUnits = [...byUnit.values()].filter((unitFacts) =>
    unitFacts.some((fact) => statusFor(fact) === "exposed")
  ).length;
  const unexposedUnits = [...byUnit.values()].filter((unitFacts) =>
    !unitFacts.some((fact) => statusFor(fact) === "exposed") &&
    unitFacts.some((fact) => statusFor(fact) === "unexposed")
  ).length;
  const proposedControls = included.filter(
    (fact) => fact.proposedGroup === "comparison",
  );
  const proposedControlExposed = proposedControls.filter(
    (fact) => statusFor(fact) === "exposed",
  );
  const proposedControlUnits = new Set(
    proposedControls.map((fact) => fact.unitIdentifier),
  );
  const proposedControlExposedUnits = new Set(
    proposedControlExposed.map((fact) => fact.unitIdentifier),
  );
  return {
    exposedObservations: exposed.length,
    unexposedObservations: unexposed.length,
    excludedUnknownObservations: excludedUnknown.length,
    exposedUnits,
    unexposedUnits,
    excludedUnknownUnits: uniqueStatusUnits(excludedUnknown),
    proposedControlExposedObservations: proposedControlExposed.length,
    proposedControlExposedUnits: proposedControlExposedUnits.size,
    proposedControlContaminationShare: share(
      proposedControlExposedUnits.size,
      proposedControlUnits.size,
    ),
  };
}

function unknownCompositionDiagnostic(
  reference: Screen04AdvancedScenario,
): {
  diagnostic: Screen04UnknownCompositionDiagnostic;
  seeds: DetailSeed[];
} {
  const overall = unknownBounds(reference.cases);
  const treated = unknownBounds(reference.cases.filter(
    (fact) => fact.proposedGroup === "treated",
  ));
  const comparison = unknownBounds(reference.cases.filter(
    (fact) => fact.proposedGroup === "comparison",
  ));
  const overallShare = share(overall.unknown, overall.totalOperative);
  const comparisonShare = share(comparison.unknown, comparison.totalOperative);
  const allUnknownExposed = unknownAssumption(reference.cases, "exposed");
  const allUnknownUnexposed = unknownAssumption(reference.cases, "unexposed");
  const unknownExcluded = unknownAssumption(reference.cases, "excluded");
  const unknownFacts = reference.cases.filter(
    (fact) => fact.auditedStatus === "unknown",
  );
  const periodFacts = new Map<number, Screen04AdvancedCaseFact[]>();
  for (const fact of reference.cases.filter(
    (item) => item.auditedStatus !== "not_applicable",
  )) {
    const facts = periodFacts.get(fact.year) ?? [];
    facts.push(fact);
    periodFacts.set(fact.year, facts);
  }
  const mostAffectedPeriods = [...periodFacts.entries()].map(([year, facts]) => {
    const unknownForYear = facts.filter(
      (fact) => fact.auditedStatus === "unknown",
    );
    return {
      year,
      unknownObservations: unknownForYear.length,
      unknownUnits: uniqueStatusUnits(unknownForYear),
      proposedComparisonUnknownUnits: uniqueStatusUnits(
        unknownForYear.filter((fact) => fact.proposedGroup === "comparison"),
      ),
      unknownShare: share(unknownForYear.length, facts.length),
    };
  }).filter((item) => item.unknownObservations > 0)
    .sort((left, right) =>
      right.unknownShare - left.unknownShare ||
      right.unknownObservations - left.unknownObservations ||
      left.year - right.year
    ).slice(0, 5);
  const pivotalByUnit = new Map<string, Screen04AdvancedCaseFact[]>();
  for (const fact of unknownFacts) {
    const facts = pivotalByUnit.get(fact.unitIdentifier) ?? [];
    facts.push(fact);
    pivotalByUnit.set(fact.unitIdentifier, facts);
  }
  const allPivotalUnits = [...pivotalByUnit.entries()].map(
    ([unitIdentifier, facts]) => {
      const groups = unique(facts.map((fact) => fact.proposedGroup));
      return {
        unitIdentifier,
        proposedGroup: groups.length === 1 ? groups[0]! : "mixed" as const,
        unknownObservations: facts.length,
        years: unique(facts.map((fact) => fact.year)).sort(
          (left, right) => left - right,
        ),
      };
    },
  ).sort((left, right) =>
    right.unknownObservations - left.unknownObservations ||
    left.unitIdentifier.localeCompare(right.unitIdentifier, "en-US")
  );
  const pivotalUnits = allPivotalUnits.slice(
    0,
    SCREEN_04_ADVANCED_DIAGNOSTIC_LIMITS.maximumAffectedDetails,
  );
  let conclusion: Screen04UnknownCompositionDiagnostic["conclusion"];
  if (overall.unknown === 0) conclusion = "none";
  else if (
    comparisonShare >= SCREEN_04_ADVANCED_DIAGNOSTIC_LIMITS.materialUnknownShare &&
    comparisonShare > share(treated.unknown, treated.totalOperative)
  ) conclusion = "concentrated-in-comparison";
  else if (overallShare >= SCREEN_04_ADVANCED_DIAGNOSTIC_LIMITS.materialUnknownShare) {
    conclusion = "material";
  } else if (
    overallShare <= SCREEN_04_ADVANCED_DIAGNOSTIC_LIMITS.peripheralUnknownShare
  ) conclusion = "few-peripheral";
  else conclusion = "bounded-review";
  return {
    diagnostic: {
      conclusion,
      overall,
      treated,
      comparison,
      assumptions: {
        allUnknownExposed,
        allUnknownUnexposed,
        unknownExcluded,
      },
      controlContaminationRange: {
        minimumExposedObservations:
          allUnknownUnexposed.proposedControlExposedObservations,
        maximumExposedObservations:
          allUnknownExposed.proposedControlExposedObservations,
        minimumExposedUnits: allUnknownUnexposed.proposedControlExposedUnits,
        maximumExposedUnits: allUnknownExposed.proposedControlExposedUnits,
        minimumShare: allUnknownUnexposed.proposedControlContaminationShare,
        maximumShare: allUnknownExposed.proposedControlContaminationShare,
      },
      mostAffectedPeriods,
      pivotalUnits,
      truncatedPivotalUnitCount: allPivotalUnits.length - pivotalUnits.length,
    },
    seeds: unknownFacts
      .map((fact) => ({ scenario: reference, fact })),
  };
}

/** Stable substantive ordering shared by priority and overflow findings. */
export function orderScreen04V0403Findings(
  findings: readonly Screen04AdvancedFinding[],
): Screen04AdvancedFinding[] {
  return findings
    .map((item, index) => ({ item, index }))
    .sort((left, right) =>
      left.item.consequenceOrder - right.item.consequenceOrder ||
      severityOrder[left.item.severity] - severityOrder[right.item.severity] ||
      left.item.code.localeCompare(right.item.code, "en-US") ||
      left.index - right.index
    )
    .map(({ item }) => item);
}

export function runScreen04AdvancedDiagnostics(
  input: Screen04AdvancedDiagnosticInput,
): Screen04AdvancedDiagnosticResult {
  const { scenarios: scenariosInput, reference, assignmentContext } =
    validateAndNormalizeInput(input);
  const stability = stabilityDiagnostic(scenariosInput, reference);
  const disagreement = disagreementDiagnostic(reference);
  const comparisonSurvival = comparisonSurvivalDiagnostic(scenariosInput);
  const separability = versionSeparabilityDiagnostic(scenariosInput);
  const repairs = repairPriorityDiagnostic(reference);
  const assignment = assignmentDiagnostic(assignmentContext);
  const unknownComposition = unknownCompositionDiagnostic(reference);
  const candidates: Screen04AdvancedFinding[] = [];

  if (disagreement.diagnostic.disagreementObservations > 0) {
    const reasonSummary = Object.entries(disagreement.diagnostic.reasonCounts)
      .filter(([reason, count]) => reason !== "multi-condition" && count > 0)
      .sort((left, right) => right[1] - left[1] ||
        left[0].localeCompare(right[0], "en-US"));
    const largestReason = reasonSummary[0];
    candidates.push(finding({
      code: "SCREEN04_ADVANCED_PROPOSED_CODING_DISAGREEMENT",
      severity: "Major design concern",
      consequenceOrder: 2,
      title: "Proposed coding disagrees with verified coverage",
      whatFound:
        `${disagreement.diagnostic.disagreementObservations} observations across ${disagreement.diagnostic.disagreementUnits} units disagree with the deterministic coverage classification or remain unresolved. ${disagreement.diagnostic.multiReasonObservations} observations involve more than one contributing condition.${largestReason ? ` The largest recorded reason is ${largestReason[0].replaceAll("-", " ")} (${largestReason[1]} observations).` : ""}${reasonSummary.length > 1 ? ` Other recorded reasons: ${reasonSummary.slice(1).map(([reason, count]) => `${reason.replaceAll("-", " ")} ${count}`).join("; ")}.` : ""}`,
      whyItMatters:
        "The proposed treatment and comparison definitions do not consistently represent the verified shock coverage.",
      possibleNextStep:
        "Review the listed geography, organization type, threshold, exemption, timing, amendment, assignment-level, missing-information, and treatment-component reasons before finalizing the group coding.",
      seeds: disagreement.seeds,
      referenceObservationCount: reference.cases.length,
    }));
  }

  if (comparisonSurvival.diagnostic.conclusion !== "stays-unexposed") {
    const conclusion = comparisonSurvival.diagnostic.conclusion;
    const firstStage = comparisonSurvival.diagnostic.stages[0];
    const lastStage = comparisonSurvival.diagnostic.stages.at(-1);
    const comparisonUniversallyExposed =
      comparisonSurvival.diagnostic.stages.length > 0 &&
      comparisonSurvival.diagnostic.stages.every((stage) =>
        stage.exposed > 0 && stage.unexposed === 0 && stage.unknown === 0
      );
    candidates.push(finding({
      code: "SCREEN04_ADVANCED_COMPARISON_SURVIVAL",
      severity: conclusion === "remains-unknown"
        ? "Review before analysis"
        : "Major design concern",
      consequenceOrder: 3,
      title: comparisonUniversallyExposed
        ? "The proposed comparison group becomes universally exposed"
        : conclusion === "amendment-only-exposure"
        ? "The comparison group becomes exposed at the amendment stage"
        : conclusion === "gradual-post-implementation-exposure"
          ? "The comparison group loses unexposed support across stages"
          : conclusion === "remains-unknown"
            ? "Comparison-group exposure remains unknown"
            : "Some proposed comparison observations are exposed",
      whatFound:
        `${comparisonSurvival.seeds.length} comparison observations are exposed or remain unknown across the supplied treatment stages.${firstStage && lastStage ? ` At ${firstStage.scenarioName}, ${firstStage.unexposedUnits} of ${firstStage.comparisonUnits} proposed comparison units have unexposed observations, ${firstStage.exposedUnits} have exposed observations, ${firstStage.unknownUnits} remain unknown, and ${firstStage.notApplicableUnits} are not yet applicable. At ${lastStage.scenarioName}, the corresponding unique-unit counts are ${lastStage.unexposedUnits}, ${lastStage.exposedUnits}, ${lastStage.unknownUnits}, and ${lastStage.notApplicableUnits}. Year-specific unit counts are retained in the stage details.` : ""}`,
      whyItMatters:
        "The proposed comparison group may not remain unexposed to the verified shock throughout the intended study window.",
      possibleNextStep:
        "Review comparison-group membership by the listed stage and coverage version.",
      seeds: comparisonSurvival.seeds,
      referenceObservationCount: reference.cases.length,
    }));
  }

  if (stability.diagnostic.conclusion === "classification-sensitive") {
    const changed = stability.diagnostic.comparisons.reduce(
      (sum, item) => sum + item.changedObservations,
      0,
    );
    const changedUnits = new Set(
      stability.seeds.map((seed) => seed.fact.unitIdentifier),
    ).size;
    const allTimingOnly = stability.diagnostic.comparisons
      .filter((item) => item.changedObservations > 0)
      .every((item) => item.timingOnly);
    const hasVersionChange = stability.diagnostic.comparisons.some((item) =>
      item.changedObservations > 0 && item.drivers.includes("coverage-version")
    );
    const compared = stability.diagnostic.comparisons.reduce(
      (sum, item) => sum + item.comparedObservations,
      0,
    );
    const unchangedShare = compared === 0 ? 1 : 1 - changed / compared;
    const changedPeriods = new Set(
      stability.seeds.map((seed) => seed.fact.year),
    ).size;
    const controlsExposed = new Set(stability.seeds
      .filter((seed) =>
        seed.fact.proposedGroup === "comparison" &&
        seed.fact.auditedStatus === "exposed"
      )
      .map((seed) => seed.fact.unitIdentifier)).size;
    const treatedUnexposed = new Set(stability.seeds
      .filter((seed) =>
        seed.fact.proposedGroup === "treated" &&
        seed.fact.auditedStatus === "unexposed"
      )
      .map((seed) => seed.fact.unitIdentifier)).size;
    const driverSummary = unique(stability.diagnostic.comparisons
      .filter((item) => item.changedObservations > 0)
      .flatMap((item) => item.drivers))
      .map((driver) => driver.replaceAll("-", " ")).join(", ");
    candidates.push(finding({
      code: "SCREEN04_ADVANCED_TREATMENT_STABILITY",
      severity: hasVersionChange
        ? "Major design concern"
        : "Review before analysis",
      consequenceOrder: 5,
      title: allTimingOnly
        ? "Treatment-date choice changes timing classifications"
        : "The treatment definition changes classifications across scenarios",
      whatFound:
        `${percent(unchangedShare)} of compared unit-period classifications remain unchanged. ${changed} classifications across ${changedUnits} units and ${changedPeriods} periods change; ${controlsExposed} proposed control units become exposed and ${treatedUnexposed} proposed treated units become unexposed in at least one alternative. The recorded driver${driverSummary.includes(",") ? "s are" : " is"} ${driverSummary || "the supplied treatment definition"}.`,
      whyItMatters: allTimingOnly
        ? "The affected differences are confined to whether observations fall before or after the selected treatment stage."
        : "The treated population is sensitive to the supplied coverage version, component/package choice, or source basis.",
      possibleNextStep:
        "Choose and document the treatment date, coverage version, and component/package that match the intended design.",
      seeds: stability.seeds,
      referenceObservationCount: reference.cases.length,
    }));
  }

  // A single supplied package describes what was mapped; by itself it does
  // not establish that separable source-supported components exist and must
  // not manufacture a clean-file concern.
  if (separability.conclusion !== "independent-components" &&
    separability.definitionsCompared > 1) {
    const seeds = scenariosInput.flatMap((scenario) => scenario.cases
      .filter((fact) => fact.auditedStatus === "exposed")
      .map((fact) => ({ scenario, fact })));
    candidates.push(finding({
      code: "SCREEN04_ADVANCED_VERSION_SEPARABILITY",
      severity: "Review before analysis",
      consequenceOrder: 6,
      title: separability.conclusion === "perfectly-bundled"
        ? "Treatment components are perfectly bundled in this sample"
        : separability.conclusion === "nested-stages"
          ? "Treatment versions are observed only as nested stages"
          : "Only package-level treatment is distinguishable",
      whatFound:
        `${separability.definitionsCompared} supplied component/package definitions yield ${separability.distinctExposurePatterns} observed exposure pattern${separability.distinctExposurePatterns === 1 ? "" : "s"} and a ${separability.conclusion.replaceAll("-", " ")} classification pattern. ${separability.versions.map((version) => `${version.scenarioName}: ${version.exposedUnits} exposed units across ${version.exposedPeriods.length} periods, including ${version.standaloneExposedUnits} units seen only under that definition`).join("; ")}.`,
      whyItMatters:
        "The uploaded exposure data may not distinguish the supplied treatment versions as separate design contrasts.",
      possibleNextStep:
        "Keep a package-level definition or supply component-level variation that is separately observed.",
      seeds,
      referenceObservationCount: reference.cases.length,
    }));
  }

  if (assignment.concern) {
    const seeds = reference.cases.map((fact) => ({ scenario: reference, fact }));
    candidates.push(finding({
      code: "SCREEN04_ADVANCED_ASSIGNMENT_AGGREGATION",
      severity: assignment.conclusion === "crosswalk-required"
        ? "Design blocker"
        : "Major design concern",
      consequenceOrder: 7,
      title: assignment.conclusion === "mixed-lower-level-exposure"
        ? "Lower-level exposure is mixed within the dataset unit"
        : "The assignment level needs a unit crosswalk",
      whatFound:
        `The supplied assignment-level check concluded ${assignment.conclusion.replaceAll("-", " ")}.${assignment.aggregateSummary ? ` Across ${assignment.aggregateSummary.aggregateUnits} aggregate units and ${assignment.aggregateSummary.aggregateUnitPeriods} aggregate-unit periods, ${assignment.aggregateSummary.fullyExposedAggregateUnits} are fully exposed, ${assignment.aggregateSummary.partiallyExposedAggregateUnits} partially exposed, ${assignment.aggregateSummary.unexposedAggregateUnits} unexposed, and ${assignment.aggregateSummary.unknownAggregateUnits} unknown. Exact exposure shares are calculable for ${assignment.aggregateSummary.exposureShareSummary.calculatedAggregateUnitPeriods} aggregate-unit periods.` : ""}`,
      whyItMatters:
        "Aggregating a lower-level coverage rule to a different dataset unit can hide meaningful exposure differences.",
      possibleNextStep:
        "Supply or complete the lower-level crosswalk and retain separate classifications where exposure is mixed.",
      seeds,
      referenceObservationCount: reference.cases.length,
    }));
  }

  if (!["none", "few-peripheral"].includes(
    unknownComposition.diagnostic.conclusion,
  )) {
    const unknownShare = share(
      unknownComposition.diagnostic.overall.unknown,
      unknownComposition.diagnostic.overall.totalOperative,
    );
    candidates.push(finding({
      code: "SCREEN04_ADVANCED_UNKNOWN_COMPOSITION",
      severity: unknownComposition.diagnostic.conclusion === "bounded-review"
        ? "Review before analysis"
        : "Major design concern",
      consequenceOrder: 8,
      title: unknownComposition.diagnostic.conclusion ===
          "concentrated-in-comparison"
        ? "Unknown exposure is concentrated in the comparison group"
        : "Unknown exposure could materially change sample composition",
      whatFound:
        `${unknownComposition.diagnostic.overall.unknown} of ${unknownComposition.diagnostic.overall.totalOperative} operative classifications (${percent(unknownShare)}) are unknown. If all unknowns are exposed, the exposure-defined treated group contains ${unknownComposition.diagnostic.assumptions.allUnknownExposed.exposedUnits} units; if all are unexposed it contains ${unknownComposition.diagnostic.assumptions.allUnknownUnexposed.exposedUnits}; excluding unknowns leaves ${unknownComposition.diagnostic.assumptions.unknownExcluded.exposedUnits} exposed and ${unknownComposition.diagnostic.assumptions.unknownExcluded.unexposedUnits} unexposed units. Proposed-control exposure ranges from ${unknownComposition.diagnostic.controlContaminationRange.minimumExposedUnits} to ${unknownComposition.diagnostic.controlContaminationRange.maximumExposedUnits} units (${percent(unknownComposition.diagnostic.controlContaminationRange.minimumShare)} to ${percent(unknownComposition.diagnostic.controlContaminationRange.maximumShare)}).${unknownComposition.diagnostic.mostAffectedPeriods[0] ? ` ${unknownComposition.diagnostic.mostAffectedPeriods[0].year} is the most affected period (${unknownComposition.diagnostic.mostAffectedPeriods[0].unknownUnits} unknown units).` : ""} ${unknownComposition.diagnostic.pivotalUnits.length} pivotal units are retained in bounded detail. These are treatment-composition bounds, not treatment-effect bounds.`,
      whyItMatters:
        "The observed treated/comparison composition depends materially on classifications that the selected information cannot resolve.",
      possibleNextStep:
        "Use the repair priorities below or narrow claims to the known classifications.",
      seeds: unknownComposition.seeds,
      referenceObservationCount: reference.cases.length,
    }));
  }

  if (repairs.diagnostic.greedyOrder.length > 0) {
    const first = repairs.diagnostic.greedyOrder[0];
    candidates.push(finding({
      code: "SCREEN04_ADVANCED_REPAIR_PRIORITY",
      severity: "Review before analysis",
      consequenceOrder: 9,
      title: "Missing information has a deterministic repair priority",
      whatFound:
        `${repairs.diagnostic.unknownObservations} observations across ${repairs.diagnostic.unknownUnits} units are unknown. Obtaining ${first.variable} would make ${first.incrementalPotentiallyClassifiableObservations} additional observations across ${first.incrementalPotentiallyClassifiableUnits} units potentially classifiable at the first repair step; later steps report incremental and cumulative unit yields for combinations of missing fields.${repairs.diagnostic.lowerLevelRequirements.length > 0 ? ` ${repairs.diagnostic.lowerLevelRequirements.map((item) => `${item.unknownUnits} units require ${item.requirement}`).join("; ")}.` : ""}`,
      whyItMatters:
        "The greedy order identifies the largest bounded classification yield without promising that a repaired value will satisfy the coverage rule.",
      possibleNextStep:
        `Review missing information in this order: ${repairs.diagnostic.greedyOrder.slice(0, 5).map((item) => item.variable).join("; ")}. Counts mean potentially classifiable, not guaranteed exposed or unexposed.`,
      seeds: repairs.seeds,
      referenceObservationCount: reference.cases.length,
    }));
  }

  const ordered = orderScreen04V0403Findings(candidates);
  const actionable = ordered.filter(
    (item) => item.severity !== "Informational",
  );
  const priorityFindings = actionable.slice(
    0,
    SCREEN_04_ADVANCED_DIAGNOSTIC_LIMITS.maximumPriorityFindings,
  );
  const priorityCodes = new Set(priorityFindings.map((item) => item.code));
  const otherFindings = ordered.filter((item) => !priorityCodes.has(item.code));
  const selectedColumns = unique(scenariosInput.flatMap(
    (scenario) => scenario.sourceBasis.selectedColumns,
  )).sort((left, right) => left.localeCompare(right, "en-US"));

  return {
    schemaVersion: SCREEN_04_ADVANCED_DIAGNOSTIC_SCHEMA_VERSION,
    referenceScenarioId: reference.id,
    selectedColumns,
    scenarios: scenariosInput.map((scenario) => ({
      id: scenario.id,
      name: scenario.name,
      treatmentDate: scenario.treatmentDate,
      treatmentStage: scenario.treatmentStage,
      coverageVersion: scenario.coverageVersion,
      componentOrPackage: scenario.componentOrPackage,
      sourceBasis: scenario.sourceBasis,
      classificationCounts: classificationCounts(scenario.cases),
    })),
    treatmentDefinitionStability: stability.diagnostic,
    proposedCodingDisagreement: disagreement.diagnostic,
    comparisonGroupSurvival: comparisonSurvival.diagnostic,
    treatmentVersionSeparability: separability,
    dataRepairPriority: repairs.diagnostic,
    assignmentLevelAggregation: assignment,
    unknownExposureComposition: unknownComposition.diagnostic,
    priorityFindings,
    otherFindings,
  };
}
