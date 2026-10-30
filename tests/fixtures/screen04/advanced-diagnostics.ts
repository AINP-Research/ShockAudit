import type {
  Screen04AdvancedAssignmentContext,
  Screen04AdvancedCaseFact,
  Screen04AdvancedReasonCategory,
  Screen04AdvancedScenario,
  Screen04AdvancedTreatmentStage,
} from "../../../src/core/screen04-advanced-diagnostics";
import type { Screen04ExposureStatus } from "../../../src/core/screen04-feasibility";

export function advancedFact(
  unitIdentifier: string,
  year: number,
  proposedGroup: "treated" | "comparison",
  auditedStatus: Screen04ExposureStatus,
  reasonCategories: readonly Screen04AdvancedReasonCategory[] = [],
  missingRepairVariables: readonly string[] = [],
  lowerLevelRepairRequirement: string | null = null,
): Screen04AdvancedCaseFact {
  return {
    unitIdentifier,
    year,
    proposedGroup,
    auditedStatus,
    reasonCategories,
    missingRepairVariables,
    lowerLevelRepairRequirement,
  };
}

export function advancedScenario(input: {
  id: string;
  name?: string;
  date?: string;
  stage?: Screen04AdvancedTreatmentStage;
  coverageVersion?: string;
  kind?: "component" | "package";
  componentName?: string;
  columns?: readonly string[];
  cases: readonly Screen04AdvancedCaseFact[];
}): Screen04AdvancedScenario {
  return {
    id: input.id,
    name: input.name ?? input.id,
    treatmentDate: input.date ?? "2020-01-01",
    treatmentStage: input.stage ?? "implementation",
    coverageVersion: input.coverageVersion ?? "Version 1",
    componentOrPackage: {
      kind: input.kind ?? "component",
      name: input.componentName ?? "Coverage component",
    },
    sourceBasis: {
      eventCardBasis: `Supplied basis for ${input.name ?? input.id}`,
      selectedColumns: input.columns ?? ["coverage"],
    },
    cases: input.cases,
  };
}

const stableCases = [
  advancedFact("T1", 2020, "treated", "exposed"),
  advancedFact("C1", 2020, "comparison", "unexposed"),
];

export const stabilityFixtures = {
  stable: [
    advancedScenario({ id: "stable-reference", cases: stableCases }),
    advancedScenario({
      id: "stable-alternative",
      coverageVersion: "Version 1",
      cases: stableCases,
    }),
  ],
  amendmentChangesMeaningfulUnits: [
    advancedScenario({ id: "amendment-reference", cases: stableCases }),
    advancedScenario({
      id: "amendment",
      date: "2022-01-01",
      stage: "amendment",
      coverageVersion: "Amended version",
      cases: [
        advancedFact("T1", 2020, "treated", "exposed"),
        advancedFact("C1", 2020, "comparison", "exposed", ["threshold"]),
      ],
    }),
  ],
  timingOnly: [
    advancedScenario({
      id: "timing-reference",
      name: "Treatment-date choice",
      date: "2020-01-01",
      cases: [advancedFact("T1", 2020, "treated", "exposed")],
    }),
    advancedScenario({
      id: "later-date",
      name: "Treatment-date choice",
      date: "2021-01-01",
      stage: "compliance",
      cases: [advancedFact("T1", 2020, "treated", "not_applicable", ["timing"])],
    }),
  ],
  packageVsComponent: [
    advancedScenario({
      id: "package",
      kind: "package",
      componentName: "Whole package",
      cases: stableCases,
    }),
    advancedScenario({
      id: "component",
      componentName: "Threshold component",
      cases: [
        advancedFact("T1", 2020, "treated", "unexposed", ["threshold"]),
        advancedFact("C1", 2020, "comparison", "unexposed"),
      ],
    }),
  ],
} as const;

export const disagreementFixture = advancedScenario({
  id: "disagreements",
  cases: [
    advancedFact("GEO", 2020, "treated", "unexposed", ["geography"]),
    advancedFact("THRESH", 2020, "treated", "unexposed", ["threshold"]),
    advancedFact("EXEMPT", 2020, "treated", "unexposed", ["exemption"]),
    advancedFact("TIME", 2020, "treated", "unexposed", ["timing"]),
    advancedFact("UNIT", 2020, "treated", "unexposed", ["assignment-unit"]),
    advancedFact(
      "MULTI",
      2020,
      "comparison",
      "exposed",
      ["geography", "threshold"],
    ),
  ],
});

export const expandedDisagreementFixture = advancedScenario({
  id: "expanded-disagreements",
  cases: [
    advancedFact("ORG", 2020, "treated", "unexposed", ["organization-type"]),
    advancedFact("AMEND", 2020, "comparison", "exposed", ["amendment"]),
    advancedFact(
      "MISSING",
      2020,
      "treated",
      "unknown",
      ["coverage-condition"],
      ["filing_status"],
    ),
    advancedFact(
      "COMPONENT",
      2020,
      "treated",
      "unexposed",
      ["treatment-component"],
    ),
    advancedFact(
      "MULTI-EXPANDED",
      2020,
      "comparison",
      "exposed",
      ["organization-type", "amendment", "treatment-component"],
    ),
  ],
});

function comparisonCases(statuses: readonly Screen04ExposureStatus[]) {
  return statuses.map((status, index) =>
    advancedFact(
      `C${index + 1}`,
      2020,
      "comparison",
      status,
      status === "unknown" ? ["coverage-condition"] : [],
    )
  );
}

export const comparisonSurvivalFixtures = {
  staysUnexposed: [advancedScenario({
    id: "clean-controls",
    cases: comparisonCases(["unexposed", "unexposed"]),
  })],
  gradual: [
    advancedScenario({
      id: "initial-controls",
      date: "2020-01-01",
      cases: comparisonCases(["unexposed", "unexposed", "unexposed", "unexposed"]),
    }),
    advancedScenario({
      id: "some-controls",
      date: "2021-01-01",
      stage: "compliance",
      cases: comparisonCases(["exposed", "unexposed", "unexposed", "unexposed"]),
    }),
    advancedScenario({
      id: "more-controls",
      date: "2022-01-01",
      stage: "enforcement",
      cases: comparisonCases(["exposed", "exposed", "unexposed", "unexposed"]),
    }),
  ],
  amendmentOnly: [
    advancedScenario({
      id: "before-amendment",
      cases: comparisonCases(["unexposed", "unexposed"]),
    }),
    advancedScenario({
      id: "at-amendment",
      date: "2022-01-01",
      stage: "amendment",
      cases: comparisonCases(["exposed", "unexposed"]),
    }),
  ],
  remainsUnknown: [advancedScenario({
    id: "unknown-controls",
    cases: comparisonCases(["unknown", "unexposed"]),
  })],
} as const;

export const multiPeriodComparisonSurvivalFixture = [advancedScenario({
  id: "multi-period-controls",
  cases: [
    advancedFact("C1", 2020, "comparison", "unexposed"),
    advancedFact("C1", 2021, "comparison", "exposed"),
    advancedFact("C2", 2020, "comparison", "unexposed"),
    advancedFact("C2", 2021, "comparison", "unknown", ["missing-information"]),
  ],
})] as const;

const componentCases = {
  unit1: advancedFact("U1", 2020, "treated", "exposed"),
  unit2: advancedFact("U2", 2020, "treated", "exposed"),
  unit1No: advancedFact("U1", 2020, "treated", "unexposed"),
  unit2No: advancedFact("U2", 2020, "treated", "unexposed"),
};

export const versionFixtures = {
  independent: [
    advancedScenario({
      id: "component-a",
      componentName: "Component A",
      cases: [componentCases.unit1, componentCases.unit2No],
    }),
    advancedScenario({
      id: "component-b",
      componentName: "Component B",
      cases: [componentCases.unit1No, componentCases.unit2],
    }),
  ],
  perfectlyBundled: [
    advancedScenario({
      id: "bundle-a",
      componentName: "Component A",
      cases: [componentCases.unit1, componentCases.unit2No],
    }),
    advancedScenario({
      id: "bundle-b",
      componentName: "Component B",
      cases: [componentCases.unit1, componentCases.unit2No],
    }),
  ],
  nestedStages: [
    advancedScenario({
      id: "nested-a",
      componentName: "Stage A",
      cases: [componentCases.unit1, componentCases.unit2No],
    }),
    advancedScenario({
      id: "nested-b",
      date: "2021-01-01",
      stage: "amendment",
      componentName: "Stage B",
      cases: [componentCases.unit1, componentCases.unit2],
    }),
  ],
  packageOnly: [advancedScenario({
    id: "package-only",
    kind: "package",
    componentName: "Whole package",
    cases: [componentCases.unit1, componentCases.unit2No],
  })],
} as const;

export const repairFixture = advancedScenario({
  id: "repair",
  columns: ["geography", "threshold", "lower_level_crosswalk"],
  cases: [
    advancedFact("G", 2020, "treated", "unknown", ["geography"], ["geography"]),
    advancedFact("T", 2020, "treated", "unknown", ["threshold"], ["threshold"]),
    advancedFact(
      "GT",
      2020,
      "treated",
      "unknown",
      ["geography", "threshold"],
      ["geography", "threshold"],
    ),
    advancedFact(
      "X",
      2020,
      "treated",
      "unknown",
      ["assignment-unit"],
      ["lower_level_crosswalk"],
      "establishment-to-parent crosswalk",
    ),
    advancedFact("NONE", 2020, "treated", "unknown", ["coverage-condition"]),
  ],
});

export const assignmentFixtures: Record<string, Screen04AdvancedAssignmentContext> = {
  alignedFirm: {
    datasetUnit: "firm",
    shockUnit: "firm",
    crosswalkStatus: "not-required",
    withinAggregateExposure: "uniform",
  },
  establishmentParentOnly: {
    datasetUnit: "parent-company",
    shockUnit: "establishment",
    crosswalkStatus: "missing",
    withinAggregateExposure: null,
  },
  establishmentWithCrosswalk: {
    datasetUnit: "parent-company",
    shockUnit: "establishment",
    crosswalkStatus: "complete",
    withinAggregateExposure: "uniform",
  },
  mixedParent: {
    datasetUnit: "parent-company",
    shockUnit: "establishment",
    crosswalkStatus: "complete",
    withinAggregateExposure: "mixed",
  },
};

export function unknownCompositionFixture(input: {
  id: string;
  treatedKnown: number;
  treatedUnknown: number;
  comparisonKnown: number;
  comparisonUnknown: number;
}): Screen04AdvancedScenario {
  const cases: Screen04AdvancedCaseFact[] = [];
  for (let index = 0; index < input.treatedKnown; index += 1) {
    cases.push(advancedFact(`T${index}`, 2020, "treated", "exposed"));
  }
  for (let index = 0; index < input.treatedUnknown; index += 1) {
    cases.push(advancedFact(`TU${index}`, 2020, "treated", "unknown", ["threshold"]));
  }
  for (let index = 0; index < input.comparisonKnown; index += 1) {
    cases.push(advancedFact(`C${index}`, 2020, "comparison", "unexposed"));
  }
  for (let index = 0; index < input.comparisonUnknown; index += 1) {
    cases.push(advancedFact(`CU${index}`, 2020, "comparison", "unknown", ["geography"]));
  }
  return advancedScenario({ id: input.id, cases });
}
