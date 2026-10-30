import { performance } from "node:perf_hooks";

import { describe, expect, it } from "vitest";

import {
  SCREEN_04_ADVANCED_DIAGNOSTIC_LIMITS,
  runScreen04AdvancedDiagnostics,
  type Screen04AdvancedCaseFact,
  type Screen04AdvancedScenario,
  type Screen04AdvancedTreatmentStage,
} from "../../src/core/screen04-advanced-diagnostics";

const documentedAssessmentDeadlineMs = 15_000;
const repairVariables = Array.from(
  { length: 8 },
  (_unused, index) => `repair-variable-${index + 1}`,
);
const treatmentStages: readonly Screen04AdvancedTreatmentStage[] = [
  "announcement",
  "enactment",
  "effective",
  "implementation",
  "compliance",
  "enforcement",
  "amendment",
  "repeal-or-delay",
];

function caseFacts(scenarioIndex: number): Screen04AdvancedCaseFact[] {
  return Array.from(
    {
      length:
        SCREEN_04_ADVANCED_DIAGNOSTIC_LIMITS.maximumCaseFactsPerScenario,
    },
    (_unused, factIndex): Screen04AdvancedCaseFact => {
      const proposedGroup = factIndex % 2 === 0 ? "treated" : "comparison";
      const statusSlot = (factIndex + scenarioIndex) % 10;
      const auditedStatus = statusSlot < 2
        ? "unknown"
        : proposedGroup === "treated"
          ? statusSlot < 4
            ? "unexposed"
            : "exposed"
          : statusSlot < 6
            ? "exposed"
            : "unexposed";
      const reasonCategories = auditedStatus === "unknown"
        ? ["coverage-condition" as const]
        : proposedGroup === "treated" && auditedStatus === "unexposed"
          ? ["threshold" as const]
          : proposedGroup === "comparison" && auditedStatus === "exposed"
            ? ["geography" as const]
            : [];

      return {
        unitIdentifier: `unit-${String(factIndex + 1).padStart(5, "0")}`,
        year: 2020,
        proposedGroup,
        auditedStatus,
        reasonCategories,
        missingRepairVariables: auditedStatus === "unknown"
          ? [repairVariables[factIndex % repairVariables.length]!]
          : [],
      };
    },
  );
}

function maximumScenarios(): Screen04AdvancedScenario[] {
  return Array.from(
    { length: SCREEN_04_ADVANCED_DIAGNOSTIC_LIMITS.maximumScenarios },
    (_unused, scenarioIndex): Screen04AdvancedScenario => ({
      id: `maximum-scenario-${scenarioIndex + 1}`,
      name: `Maximum bounded scenario ${scenarioIndex + 1}`,
      treatmentDate: `202${scenarioIndex}-01-01`,
      treatmentStage: treatmentStages[scenarioIndex]!,
      coverageVersion: `Coverage version ${scenarioIndex + 1}`,
      componentOrPackage: {
        kind: scenarioIndex === 0 ? "package" : "component",
        name: `Treatment definition ${scenarioIndex + 1}`,
      },
      sourceBasis: {
        eventCardBasis: `Verified bounded basis ${scenarioIndex + 1}`,
        selectedColumns: [
          `selected-column-${scenarioIndex * 2 + 1}`,
          `selected-column-${scenarioIndex * 2 + 2}`,
        ],
      },
      cases: caseFacts(scenarioIndex),
    }),
  );
}

describe("Screen 4 advanced diagnostic bounded performance", () => {
  it("completes every documented maximum inside the assessment deadline", () => {
    expect(SCREEN_04_ADVANCED_DIAGNOSTIC_LIMITS).toMatchObject({
      maximumScenarios: 8,
      maximumComponents: 8,
      maximumRepairVariables: 8,
      maximumCaseFactsPerScenario: 20_000,
      maximumSelectedColumns: 16,
    });

    const scenarios = maximumScenarios();
    expect(scenarios).toHaveLength(8);
    expect(scenarios.every((scenario) => scenario.cases.length === 20_000))
      .toBe(true);
    expect(Object.keys(scenarios[0]!.cases[0]!).sort()).toEqual([
      "auditedStatus",
      "missingRepairVariables",
      "proposedGroup",
      "reasonCategories",
      "unitIdentifier",
      "year",
    ]);

    // Measure one cold, fully bounded invocation. Input construction stays
    // outside the timer so this records the deterministic assessment itself.
    const started = performance.now();
    const result = runScreen04AdvancedDiagnostics({
      scenarios,
      referenceScenarioId: scenarios[0]!.id,
    });
    const elapsedMs = performance.now() - started;

    console.info(
      `Screen 4 maximum advanced diagnostic elapsed: ${elapsedMs.toFixed(2)} ms`,
    );
    expect(elapsedMs).toBeLessThan(documentedAssessmentDeadlineMs);
    expect(result.scenarios).toHaveLength(8);
    expect(result.scenarios.every(
      (scenario) => scenario.classificationCounts.total === 20_000,
    )).toBe(true);
    expect(new Set(result.scenarios.map((scenario) =>
      `${scenario.componentOrPackage.kind}:${scenario.componentOrPackage.name}`
    )).size).toBe(8);
    expect(result.selectedColumns).toHaveLength(16);
    expect(result.dataRepairPriority.singleFieldYields).toHaveLength(8);
    expect(result.dataRepairPriority.greedyOrder).toHaveLength(8);
    expect(result.scenarios.every((scenario) => !Object.hasOwn(scenario, "cases")))
      .toBe(true);
    expect(JSON.stringify(result.scenarios)).not.toContain('"cases"');
    expect(JSON.stringify(result)).not.toMatch(/rawRow|rawRows|csvText/u);
  }, 30_000);
});
