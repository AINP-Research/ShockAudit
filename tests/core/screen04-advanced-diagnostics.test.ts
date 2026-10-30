import { describe, expect, it } from "vitest";

import {
  SCREEN_04_ADVANCED_DIAGNOSTIC_LIMITS,
  SCREEN_04_V0403_SEVERITIES,
  runScreen04AdvancedDiagnostics,
  type Screen04AdvancedScenario,
} from "../../src/core/screen04-advanced-diagnostics";
import {
  SCREEN_04_MAX_ROW_SETUP_ISSUE_DETAILS,
  runScreen04ScientificAssessment,
  type Screen04ScientificAssessmentInput,
} from "../../src/core/screen04-scientific-assessment";
import {
  advancedFact,
  advancedScenario,
  assignmentFixtures,
  comparisonSurvivalFixtures,
  disagreementFixture,
  expandedDisagreementFixture,
  multiPeriodComparisonSurvivalFixture,
  repairFixture,
  stabilityFixtures,
  unknownCompositionFixture,
  versionFixtures,
} from "../fixtures/screen04/advanced-diagnostics";

function run(
  scenarios: readonly Screen04AdvancedScenario[],
  assignmentContext = assignmentFixtures.alignedFirm,
) {
  return runScreen04AdvancedDiagnostics({
    scenarios,
    referenceScenarioId: scenarios[0]!.id,
    assignmentContext,
  });
}

function scientificInput(
  csvText: string,
  overrides: Partial<Screen04ScientificAssessmentInput> = {},
): Screen04ScientificAssessmentInput {
  return {
    csvText,
    verifiedShockName: "Verified coverage fixture",
    mappings: {
      unitIdentifier: "unit_id",
      year: "year",
      treatmentGroup: "group",
      researcherTreatmentYear: 2020,
      treatedValue: "T",
      comparisonValue: "C",
    },
    studyDescription: {
      unitOfAnalysis: "Firm-year",
      sampleUnitDescription: "Firms",
      dataFrequency: "annual",
      treatmentGroupDescription: "Proposed treated firms",
      comparisonGroupDescription: "Proposed comparison firms",
      mainComparisonBasis: "legal-eligibility",
      datasetAssignmentUnit: "firm",
      shockAssignmentUnit: "firm",
    },
    verifiedDates: [{
      label: "Implementation date",
      date: "2020-01-01",
      role: "implementation",
    }],
    coverageMatchingIntent: "coverage-variable",
    exposureRule: {
      approach: "coverage-variable",
      column: "covered",
      coveredValue: "yes",
      effectiveYear: 2020,
      label: "Supplied coverage variable",
      component: "Coverage component",
      version: "Version 1",
    },
    ...overrides,
  };
}

function cleanScientificCsv(unitCount = 24): string {
  const rows = ["unit_id,year,group,covered"];
  for (const group of ["T", "C"] as const) {
    for (let unit = 0; unit < unitCount; unit += 1) {
      for (const year of [2018, 2019, 2020, 2021]) {
        rows.push(
          `${group}${unit},${year},${group},${group === "T" ? "yes" : "no"}`,
        );
      }
    }
  }
  return rows.join("\n");
}

describe("Screen 4 v0.4.03 advanced deterministic diagnostics", () => {
  it("distinguishes stable, amendment-sensitive, timing-only, and package/component definitions", () => {
    const stable = run(stabilityFixtures.stable);
    expect(stable.treatmentDefinitionStability.conclusion).toBe("stable");
    expect([
      ...stable.priorityFindings,
      ...stable.otherFindings,
    ].map((finding) => finding.code)).not.toContain(
      "SCREEN04_ADVANCED_TREATMENT_STABILITY",
    );

    const amendment = run(stabilityFixtures.amendmentChangesMeaningfulUnits);
    expect(amendment.treatmentDefinitionStability).toMatchObject({
      conclusion: "classification-sensitive",
      comparisons: [{
        changedObservations: 1,
        changedUnits: 1,
        drivers: expect.arrayContaining(["coverage-version"]),
        timingOnly: false,
      }],
    });

    const timing = run(stabilityFixtures.timingOnly);
    expect(timing.treatmentDefinitionStability.comparisons[0]).toMatchObject({
      changedObservations: 1,
      drivers: ["treatment-date-stage"],
      timingOnly: true,
    });
    expect([...timing.priorityFindings, ...timing.otherFindings].find(
      (finding) => finding.code === "SCREEN04_ADVANCED_TREATMENT_STABILITY",
    )?.title).toBe("Treatment-date choice changes timing classifications");

    const packageVsComponent = run(stabilityFixtures.packageVsComponent);
    expect(packageVsComponent.treatmentDefinitionStability.comparisons[0])
      .toMatchObject({
        changedUnits: 1,
        drivers: expect.arrayContaining(["component-or-package"]),
      });
  });

  it("decomposes exact disagreement reasons including multi-condition cases", () => {
    const result = run([disagreementFixture]);

    expect(result.proposedCodingDisagreement).toMatchObject({
      disagreementObservations: 6,
      disagreementUnits: 6,
      multiReasonObservations: 1,
      reasonCounts: {
        geography: 2,
        threshold: 2,
        exemption: 1,
        timing: 1,
        "assignment-unit": 1,
        "coverage-condition": 0,
        "multi-condition": 1,
      },
    });
    const disagreement = result.priorityFindings.find((finding) =>
      finding.code === "SCREEN04_ADVANCED_PROPOSED_CODING_DISAGREEMENT"
    );
    expect(disagreement?.whereItOccurs.details).toEqual(expect.arrayContaining([
      expect.objectContaining({
        unitIdentifier: "MULTI",
        proposedGroup: "comparison",
        auditedStatus: "exposed",
        reasonCategories: ["geography", "threshold", "multi-condition"],
      }),
    ]));
  });

  it("preserves organization, amendment, missing-information, and treatment-component reasons", () => {
    const result = run([expandedDisagreementFixture]);

    expect(result.proposedCodingDisagreement).toMatchObject({
      disagreementObservations: 5,
      disagreementUnits: 5,
      reasonCounts: {
        "organization-type": 2,
        amendment: 2,
        "missing-information": 1,
        "treatment-component": 2,
      },
    });
    expect(result.proposedCodingDisagreement.multiReasonObservations).toBe(2);
    expect(result.priorityFindings.find((finding) =>
      finding.code === "SCREEN04_ADVANCED_PROPOSED_CODING_DISAGREEMENT"
    )?.whereItOccurs.details).toEqual(expect.arrayContaining([
      expect.objectContaining({
        unitIdentifier: "MISSING",
        auditedStatus: "unknown",
        reasonCategories: [
          "coverage-condition",
          "missing-information",
          "multi-condition",
        ],
      }),
      expect.objectContaining({
        unitIdentifier: "MULTI-EXPANDED",
        reasonCategories: [
          "organization-type",
          "amendment",
          "treatment-component",
          "multi-condition",
        ],
      }),
    ]));
  });

  it("tracks whether comparison observations survive each supplied stage", () => {
    const staysUnexposed = run(comparisonSurvivalFixtures.staysUnexposed)
      .comparisonGroupSurvival;
    expect(staysUnexposed).toMatchObject({
      conclusion: "stays-unexposed",
      stages: [{
        comparisonObservations: 2,
        comparisonUnits: 2,
        exposed: 0,
        exposedUnits: 0,
        unexposed: 2,
        unexposedUnits: 2,
        unknown: 0,
        unknownUnits: 0,
      }],
    });
    expect(run(comparisonSurvivalFixtures.gradual)
      .comparisonGroupSurvival.conclusion).toBe(
      "gradual-post-implementation-exposure",
      );
    expect(run(comparisonSurvivalFixtures.amendmentOnly)
      .comparisonGroupSurvival.conclusion).toBe("amendment-only-exposure");
    expect(run(comparisonSurvivalFixtures.remainsUnknown)
      .comparisonGroupSurvival).toMatchObject({
        conclusion: "remains-unknown",
        stages: [{
          comparisonObservations: 2,
          comparisonUnits: 2,
          unknown: 1,
          unknownUnits: 1,
          unexposed: 1,
          unexposedUnits: 1,
        }],
      });
  });

  it("reports unique comparison units separately from observations for each year", () => {
    const result = run(multiPeriodComparisonSurvivalFixture)
      .comparisonGroupSurvival;

    expect(result.stages[0]).toMatchObject({
      comparisonObservations: 4,
      comparisonUnits: 2,
      exposed: 1,
      exposedUnits: 1,
      exposedUnitShare: 0.5,
      unexposed: 2,
      unexposedUnits: 2,
      unknown: 1,
      unknownUnits: 1,
      byYear: [{
        year: 2020,
        comparisonObservations: 2,
        comparisonUnits: 2,
        unexposed: 2,
        unexposedUnits: 2,
      }, {
        year: 2021,
        comparisonObservations: 2,
        comparisonUnits: 2,
        exposed: 1,
        exposedUnits: 1,
        exposedUnitShare: 0.5,
        unknown: 1,
        unknownUnits: 1,
      }],
    });
  });

  it("classifies component/version separability without inventing effects", () => {
    expect(run(versionFixtures.independent).treatmentVersionSeparability)
      .toMatchObject({
        conclusion: "independent-components",
        definitionsCompared: 2,
        distinctExposurePatterns: 2,
        versions: [{
          scenarioId: "component-a",
          exposedObservations: 1,
          exposedUnits: 1,
          exposedPeriods: [2020],
          standaloneExposedObservations: 1,
          standaloneExposedUnits: 1,
          standaloneExposedPeriods: [2020],
        }, {
          scenarioId: "component-b",
          exposedObservations: 1,
          exposedUnits: 1,
          exposedPeriods: [2020],
          standaloneExposedObservations: 1,
          standaloneExposedUnits: 1,
          standaloneExposedPeriods: [2020],
        }],
        pairwiseCoOccurrence: [{
          coExposedObservations: 0,
          leftOnlyObservations: 1,
          rightOnlyObservations: 1,
          leftAlwaysAccompaniesRight: false,
          rightAlwaysAccompaniesLeft: false,
          perfectlyBundled: false,
        }],
      });
    expect(run(versionFixtures.perfectlyBundled).treatmentVersionSeparability)
      .toMatchObject({
        conclusion: "perfectly-bundled",
        versions: [
          { standaloneExposedObservations: 0, standaloneExposedUnits: 0 },
          { standaloneExposedObservations: 0, standaloneExposedUnits: 0 },
        ],
        pairwiseCoOccurrence: [{
          coExposedObservations: 1,
          leftOnlyObservations: 0,
          rightOnlyObservations: 0,
          perfectlyBundled: true,
        }],
      });
    expect(run(versionFixtures.nestedStages).treatmentVersionSeparability)
      .toMatchObject({
        conclusion: "nested-stages",
        versions: [{
          scenarioId: "nested-a",
          standaloneExposedUnits: 0,
        }, {
          scenarioId: "nested-b",
          standaloneExposedUnits: 1,
          standaloneExposedPeriods: [2020],
        }],
        pairwiseCoOccurrence: [{
          leftAlwaysAccompaniesRight: true,
          rightAlwaysAccompaniesLeft: false,
        }],
      });
    expect(run(versionFixtures.packageOnly).treatmentVersionSeparability)
      .toMatchObject({ conclusion: "package-only" });

    expect(JSON.stringify(run(versionFixtures.independent))).not.toMatch(
      /parallel trends|matching|propensity|estimator|effect estimate|outcome value/iu,
    );
  });

  it("reports single-field and greedy repair yields as only potentially classifiable", () => {
    const result = run([repairFixture]);

    expect(result.dataRepairPriority).toMatchObject({
      unknownObservations: 5,
      unknownUnits: 5,
      noBoundedRepairPathObservations: 1,
      noBoundedRepairPathUnits: 1,
    });
    expect(result.dataRepairPriority.singleFieldYields).toEqual([{
      variable: "geography",
      unknownObservations: 2,
      unknownUnits: 2,
      onlyObstacleObservations: 1,
      onlyObstacleUnits: 1,
      potentiallyClassifiableObservations: 1,
      potentiallyClassifiableUnits: 1,
    }, {
      variable: "lower_level_crosswalk",
      unknownObservations: 1,
      unknownUnits: 1,
      onlyObstacleObservations: 1,
      onlyObstacleUnits: 1,
      potentiallyClassifiableObservations: 1,
      potentiallyClassifiableUnits: 1,
    }, {
      variable: "threshold",
      unknownObservations: 2,
      unknownUnits: 2,
      onlyObstacleObservations: 1,
      onlyObstacleUnits: 1,
      potentiallyClassifiableObservations: 1,
      potentiallyClassifiableUnits: 1,
    }]);
    expect(result.dataRepairPriority.greedyOrder).toEqual([{
      step: 1,
      variable: "geography",
      incrementalPotentiallyClassifiableObservations: 1,
      cumulativePotentiallyClassifiableObservations: 1,
      incrementalPotentiallyClassifiableUnits: 1,
      cumulativePotentiallyClassifiableUnits: 1,
    }, {
      step: 2,
      variable: "threshold",
      incrementalPotentiallyClassifiableObservations: 2,
      cumulativePotentiallyClassifiableObservations: 3,
      incrementalPotentiallyClassifiableUnits: 2,
      cumulativePotentiallyClassifiableUnits: 3,
    }, {
      step: 3,
      variable: "lower_level_crosswalk",
      incrementalPotentiallyClassifiableObservations: 1,
      cumulativePotentiallyClassifiableObservations: 4,
      incrementalPotentiallyClassifiableUnits: 1,
      cumulativePotentiallyClassifiableUnits: 4,
    }]);
    expect(result.dataRepairPriority.lowerLevelRequirements).toEqual([{
      requirement: "establishment-to-parent crosswalk",
      unknownObservations: 1,
      unknownUnits: 1,
    }]);
    const repairFinding = [...result.priorityFindings, ...result.otherFindings]
      .find((finding) => finding.code === "SCREEN04_ADVANCED_REPAIR_PRIORITY");
    expect(JSON.stringify(repairFinding)).toMatch(/potentially classifiable/iu);
    expect(JSON.stringify(repairFinding)).not.toMatch(/will be classified/iu);
    expect(JSON.stringify(repairFinding)).toMatch(/not guaranteed/iu);
  });

  it("raises assignment aggregation concern only from known unit/crosswalk facts", () => {
    expect(run(versionFixtures.packageOnly, assignmentFixtures.alignedFirm)
      .assignmentLevelAggregation).toEqual({
        conclusion: "aligned",
        concern: false,
        aggregateSummary: null,
      });
    expect(run(
      versionFixtures.packageOnly,
      assignmentFixtures.establishmentParentOnly,
    ).assignmentLevelAggregation).toEqual({
      conclusion: "crosswalk-required",
      concern: true,
      aggregateSummary: null,
    });
    expect(run(
      versionFixtures.packageOnly,
      assignmentFixtures.establishmentWithCrosswalk,
    ).assignmentLevelAggregation).toEqual({
      conclusion: "resolved-by-crosswalk",
      concern: false,
      aggregateSummary: null,
    });
    expect(run(versionFixtures.packageOnly, assignmentFixtures.mixedParent)
      .assignmentLevelAggregation).toEqual({
        conclusion: "mixed-lower-level-exposure",
        concern: true,
        aggregateSummary: null,
      });
    expect(runScreen04AdvancedDiagnostics({
      scenarios: versionFixtures.packageOnly,
    }).assignmentLevelAggregation).toEqual({
      conclusion: "not-assessed",
      concern: false,
      aggregateSummary: null,
    });

    expect(run(versionFixtures.packageOnly, {
      datasetUnit: "parent-company",
      shockUnit: "establishment",
      crosswalkStatus: "complete",
      withinAggregateExposure: "uniform",
      aggregateExposureFacts: [
        { aggregateUnitIdentifier: "A", lowerLevelUnitIdentifier: "A1", year: 2020, auditedStatus: "exposed" },
        { aggregateUnitIdentifier: "A", lowerLevelUnitIdentifier: "A2", year: 2020, auditedStatus: "unexposed" },
        { aggregateUnitIdentifier: "B", lowerLevelUnitIdentifier: "B1", year: 2020, auditedStatus: "exposed" },
        { aggregateUnitIdentifier: "B", lowerLevelUnitIdentifier: "B2", year: 2020, auditedStatus: "exposed" },
        { aggregateUnitIdentifier: "C", lowerLevelUnitIdentifier: "C1", year: 2020, auditedStatus: "unexposed" },
        { aggregateUnitIdentifier: "D", lowerLevelUnitIdentifier: "D1", year: 2020, auditedStatus: "unknown" },
      ],
    }).assignmentLevelAggregation).toEqual({
      conclusion: "mixed-lower-level-exposure",
      concern: true,
      aggregateSummary: {
        aggregateUnits: 4,
        aggregateUnitPeriods: 4,
        fullyExposedAggregateUnits: 1,
        partiallyExposedAggregateUnits: 1,
        unexposedAggregateUnits: 1,
        unknownAggregateUnits: 1,
        fullyExposedAggregateUnitPeriods: 1,
        partiallyExposedAggregateUnitPeriods: 1,
        unexposedAggregateUnitPeriods: 1,
        unknownAggregateUnitPeriods: 1,
        exposureShareSummary: {
          calculatedAggregateUnitPeriods: 3,
          minimum: 0,
          maximum: 1,
          mean: 0.5,
        },
      },
    });
  });

  it("calculates unknown-exposure composition bounds and suppresses material warnings when none or peripheral", () => {
    const none = run([unknownCompositionFixture({
      id: "none",
      treatedKnown: 10,
      treatedUnknown: 0,
      comparisonKnown: 10,
      comparisonUnknown: 0,
    })]);
    expect(none.unknownExposureComposition).toMatchObject({
      conclusion: "none",
      controlContaminationRange: {
        minimumExposedObservations: 0,
        maximumExposedObservations: 0,
        minimumExposedUnits: 0,
        maximumExposedUnits: 0,
        minimumShare: 0,
        maximumShare: 0,
      },
      mostAffectedPeriods: [],
      pivotalUnits: [],
      truncatedPivotalUnitCount: 0,
    });

    const peripheral = run([unknownCompositionFixture({
      id: "peripheral",
      treatedKnown: 10,
      treatedUnknown: 1,
      comparisonKnown: 9,
      comparisonUnknown: 0,
    })]);
    expect(peripheral.unknownExposureComposition.conclusion).toBe(
      "few-peripheral",
    );
    expect([...peripheral.priorityFindings, ...peripheral.otherFindings].map(
      (finding) => finding.code,
    )).not.toContain("SCREEN04_ADVANCED_UNKNOWN_COMPOSITION");

    const material = run([unknownCompositionFixture({
      id: "material",
      treatedKnown: 3,
      treatedUnknown: 2,
      comparisonKnown: 3,
      comparisonUnknown: 2,
    })]);
    expect(material.unknownExposureComposition).toMatchObject({
      conclusion: "material",
      overall: {
        totalOperative: 10,
        knownExposed: 3,
        knownUnexposed: 3,
        unknown: 4,
        minimumExposed: 3,
        maximumExposed: 7,
      },
      assumptions: {
        allUnknownExposed: {
          exposedObservations: 7,
          unexposedObservations: 3,
          excludedUnknownObservations: 0,
          exposedUnits: 7,
          unexposedUnits: 3,
          excludedUnknownUnits: 0,
          proposedControlExposedObservations: 2,
          proposedControlExposedUnits: 2,
          proposedControlContaminationShare: 0.4,
        },
        allUnknownUnexposed: {
          exposedObservations: 3,
          unexposedObservations: 7,
          excludedUnknownObservations: 0,
          exposedUnits: 3,
          unexposedUnits: 7,
          excludedUnknownUnits: 0,
          proposedControlExposedObservations: 0,
          proposedControlExposedUnits: 0,
          proposedControlContaminationShare: 0,
        },
        unknownExcluded: {
          exposedObservations: 3,
          unexposedObservations: 3,
          excludedUnknownObservations: 4,
          exposedUnits: 3,
          unexposedUnits: 3,
          excludedUnknownUnits: 4,
          proposedControlExposedObservations: 0,
          proposedControlExposedUnits: 0,
          proposedControlContaminationShare: 0,
        },
      },
      controlContaminationRange: {
        minimumExposedObservations: 0,
        maximumExposedObservations: 2,
        minimumExposedUnits: 0,
        maximumExposedUnits: 2,
        minimumShare: 0,
        maximumShare: 0.4,
      },
      mostAffectedPeriods: [{
        year: 2020,
        unknownObservations: 4,
        unknownUnits: 4,
        proposedComparisonUnknownUnits: 2,
        unknownShare: 0.4,
      }],
      pivotalUnits: expect.arrayContaining([{
        unitIdentifier: "CU0",
        proposedGroup: "comparison",
        unknownObservations: 1,
        years: [2020],
      }, {
        unitIdentifier: "TU0",
        proposedGroup: "treated",
        unknownObservations: 1,
        years: [2020],
      }]),
      truncatedPivotalUnitCount: 0,
    });

    const concentrated = run([unknownCompositionFixture({
      id: "concentrated",
      treatedKnown: 8,
      treatedUnknown: 0,
      comparisonKnown: 2,
      comparisonUnknown: 2,
    })]);
    expect(concentrated.unknownExposureComposition.conclusion).toBe(
      "concentrated-in-comparison",
    );
  });

  it("uses exact reader severities/order, limits priority to five, and bounds Where it occurs", () => {
    const reference = advancedScenario({
      id: "issue-rich-reference",
      kind: "package",
      componentName: "Package",
      columns: ["geography", "threshold"],
      cases: [
        advancedFact("T1", 2020, "treated", "unexposed", ["geography"]),
        advancedFact("C1", 2020, "comparison", "exposed", ["threshold"]),
        advancedFact(
          "U1",
          2020,
          "comparison",
          "unknown",
          ["geography"],
          ["geography"],
        ),
      ],
    });
    const alternative = advancedScenario({
      id: "issue-rich-amendment",
      date: "2022-01-01",
      stage: "amendment",
      coverageVersion: "Version 2",
      componentName: "Amendment component",
      columns: ["geography", "threshold"],
      cases: [
        advancedFact("T1", 2020, "treated", "exposed"),
        advancedFact("C1", 2020, "comparison", "exposed", ["threshold"]),
        advancedFact(
          "U1",
          2020,
          "comparison",
          "unknown",
          ["geography"],
          ["geography"],
        ),
      ],
    });
    const result = run(
      [reference, alternative],
      assignmentFixtures.establishmentParentOnly,
    );
    const all = [...result.priorityFindings, ...result.otherFindings];

    expect(result.priorityFindings).toHaveLength(
      SCREEN_04_ADVANCED_DIAGNOSTIC_LIMITS.maximumPriorityFindings,
    );
    expect(all.every((finding) =>
      SCREEN_04_V0403_SEVERITIES.includes(finding.severity)
    )).toBe(true);
    expect(all.map((finding) => finding.consequenceOrder)).toEqual(
      [...all.map((finding) => finding.consequenceOrder)].sort((a, b) => a - b),
    );

    const many = advancedScenario({
      id: "bounded-details",
      cases: Array.from({ length: 30 }, (_, index) =>
        advancedFact(`C${index}`, 2020, "comparison", "exposed", ["geography"])
      ),
    });
    const bounded = run([many]);
    const disagreement = bounded.priorityFindings.find((finding) =>
      finding.code === "SCREEN04_ADVANCED_PROPOSED_CODING_DISAGREEMENT"
    );
    expect(disagreement?.whereItOccurs).toMatchObject({
      details: expect.any(Array),
      truncatedDetailCount: 5,
    });
    expect(disagreement?.whereItOccurs.details).toHaveLength(25);
  });

  it("rejects arbitrary/raw case fields and never returns selected row values", () => {
    const unsafe = advancedScenario({
      id: "unsafe",
      cases: [{
        ...advancedFact("U1", 2020, "treated", "exposed"),
        rawRow: { outcome: "secret" },
      } as never],
    });
    expect(() => run([unsafe])).toThrow(/unsupported or raw fields/u);

    const safe = run([advancedScenario({
      id: "safe",
      columns: ["coverage"],
      cases: [advancedFact("U1", 2020, "treated", "exposed")],
    })]);
    expect(JSON.stringify(safe)).not.toContain("secret");
    expect(safe.scenarios[0]).not.toHaveProperty("cases");
  });

  it("enforces the selected-column limit across the scenario union", () => {
    const first = advancedScenario({
      id: "selected-columns-one",
      columns: Array.from({ length: 9 }, (_unused, index) => `column_${index + 1}`),
      cases: [advancedFact("T1", 2020, "treated", "exposed")],
    });
    const second = advancedScenario({
      id: "selected-columns-two",
      columns: Array.from({ length: 8 }, (_unused, index) => `column_${index + 10}`),
      cases: [advancedFact("T1", 2020, "treated", "exposed")],
    });

    expect(() => run([first, second])).toThrow(
      /at most 16 selected columns across all scenarios/u,
    );
  });
});

describe("Screen 4 advanced diagnostics integration", () => {
  it("derives bounded source-supported diagnostics in the normal assessment action", async () => {
    const result = await runScreen04ScientificAssessment(
      scientificInput(cleanScientificCsv()),
    );

    expect(result.advancedDiagnostics).toMatchObject({
      referenceScenarioId: "mapped-primary-coverage",
      selectedColumns: ["covered"],
      scenarios: [{
        name: "Supplied coverage variable",
        treatmentDate: "2020-01-01",
        treatmentStage: "implementation",
        coverageVersion: "Version 1",
        componentOrPackage: {
          kind: "component",
          name: "Coverage component",
        },
        sourceBasis: {
          selectedColumns: ["covered"],
        },
        classificationCounts: {
          total: 192,
          exposed: 48,
          unexposed: 48,
          not_applicable: 96,
          unknown: 0,
        },
      }],
    });
    expect(result.advancedDiagnostics?.scenarios[0]).not.toHaveProperty("cases");
  });

  it("treats a verified alternative date as a timing-only stability change", async () => {
    const result = await runScreen04ScientificAssessment(scientificInput([
      "unit_id,year,group,covered",
      "T1,2019,T,yes",
      "T1,2020,T,yes",
      "T1,2021,T,yes",
      "C1,2019,C,no",
      "C1,2020,C,no",
      "C1,2021,C,no",
    ].join("\n"), {
      verifiedDates: [{
        label: "Implementation date",
        date: "2020-01-01",
        role: "implementation",
      }, {
        label: "Compliance date",
        date: "2021-01-01",
        role: "compliance",
      }],
    }));

    expect(result.advancedDiagnostics?.treatmentDefinitionStability)
      .toMatchObject({
        conclusion: "classification-sensitive",
        comparisons: [{
          drivers: ["treatment-date-stage"],
          timingOnly: true,
          changedObservations: 2,
        }],
      });
    expect(result.advancedDiagnostics?.scenarios.map((scenario) =>
      scenario.sourceBasis.eventCardBasis
    )).toEqual([
      result.advancedDiagnostics?.scenarios[0]?.sourceBasis.eventCardBasis,
      result.advancedDiagnostics?.scenarios[0]?.sourceBasis.eventCardBasis,
    ]);
    expect([
      ...result.priorityFindings,
      ...result.otherFindings,
    ].find((finding) =>
      finding.code === "SCREEN04_ADVANCED_TREATMENT_STABILITY"
    )).toMatchObject({
      title: "Treatment-date choice changes timing classifications",
      consequenceOrder: 5,
      aggregate: {
        affectedObservations: 2,
        affectedUnits: 2,
      },
    });
  });

  it("derives exact contributing leaf reasons, including same-category conditions", async () => {
    const result = await runScreen04ScientificAssessment(scientificInput([
      "unit_id,year,group,revenue,employees,region",
      "T1,2019,T,50,5,CA",
      "T1,2020,T,50,5,CA",
      "C1,2019,C,50,5,CA",
      "C1,2020,C,50,5,CA",
    ].join("\n"), {
      coverageMatchingIntent: "conditions",
      exposureRule: {
        approach: "conditions",
        effectiveYear: 2020,
        label: "Two-threshold eligibility",
        expression: {
          kind: "all",
          rules: [{
            kind: "numeric-threshold",
            requirementId: "revenue-threshold",
            csvColumn: "revenue",
            operator: ">=",
            threshold: 100,
            thresholdUnit: "count",
            sourceUnit: "count",
          }, {
            kind: "numeric-threshold",
            requirementId: "employee-threshold",
            csvColumn: "employees",
            operator: ">=",
            threshold: 10,
            thresholdUnit: "count",
            sourceUnit: "count",
          }, {
            kind: "categorical-equals",
            requirementId: "geography-location",
            csvColumn: "region",
            value: "CA",
          }],
        },
      },
    }));

    expect(result.advancedDiagnostics?.proposedCodingDisagreement)
      .toMatchObject({
        disagreementObservations: 1,
        multiReasonObservations: 1,
        reasonCounts: {
          geography: 0,
          threshold: 1,
          exemption: 0,
          timing: 0,
          "assignment-unit": 0,
          "coverage-condition": 0,
          "multi-condition": 1,
        },
      });
    const detail = result.advancedDiagnostics?.priorityFindings.find(
      (finding) =>
        finding.code === "SCREEN04_ADVANCED_PROPOSED_CODING_DISAGREEMENT",
    )?.whereItOccurs.details.find((item) => item.unitIdentifier === "T1");
    expect(detail?.reasonCategories).toEqual(["threshold", "multi-condition"]);
  });

  it("identifies amendment-only comparison exposure in the normal assessment", async () => {
    const result = await runScreen04ScientificAssessment(scientificInput([
      "unit_id,year,group,base_coverage,amended_coverage",
      "T1,2019,T,yes,yes",
      "T1,2020,T,yes,yes",
      "T1,2021,T,yes,yes",
      "T1,2022,T,yes,yes",
      "C1,2019,C,no,yes",
      "C1,2020,C,no,yes",
      "C1,2021,C,no,yes",
      "C1,2022,C,no,yes",
    ].join("\n"), {
      verifiedDates: [{
        label: "Implementation date",
        date: "2020-01-01",
        role: "implementation",
      }, {
        label: "Amendment date",
        date: "2022-01-01",
        role: "amendment",
      }],
      exposureRule: {
        approach: "coverage-variable",
        column: "base_coverage",
        coveredValue: "yes",
        effectiveYear: 2020,
        label: "Original coverage",
        component: "Original component",
        version: "Original version",
      },
      additionalExposureRules: [{
        approach: "coverage-variable",
        column: "amended_coverage",
        coveredValue: "yes",
        effectiveYear: 2022,
        label: "Amended coverage",
        component: "Amendment component",
        version: "Amended version",
      }],
    }));

    expect(result.advancedDiagnostics?.comparisonGroupSurvival).toMatchObject({
      conclusion: "amendment-only-exposure",
      stages: [{
        treatmentStage: "implementation",
        exposed: 0,
      }, {
        treatmentStage: "amendment",
        exposed: 1,
        notApplicable: 3,
      }],
    });
    expect([
      ...result.priorityFindings,
      ...result.otherFindings,
    ]).toContainEqual(expect.objectContaining({
      code: "SCREEN04_ADVANCED_COMPARISON_SURVIVAL",
      title: "The comparison group becomes exposed at the amendment stage",
      consequenceOrder: 3,
    }));
  });

  it("suppresses assignment concerns when a complete crosswalk confirms uniform exposure", async () => {
    const result = await runScreen04ScientificAssessment(scientificInput(
      cleanScientificCsv(),
      {
        studyDescription: {
          ...scientificInput(cleanScientificCsv()).studyDescription,
          unitOfAnalysis: "Establishment-year",
          sampleUnitDescription: "Establishments",
          datasetAssignmentUnit: "establishment",
          shockAssignmentUnit: "parent-company",
        },
        assignmentCrosswalk: {
          crosswalkStatus: "complete",
          withinAggregateExposure: "uniform",
        },
      },
    ));
    const findings = [...result.priorityFindings, ...result.otherFindings];

    expect(result.advancedDiagnostics?.assignmentLevelAggregation).toEqual({
      conclusion: "resolved-by-crosswalk",
      concern: false,
      aggregateSummary: null,
    });
    expect(findings.map((finding) => finding.code)).not.toContain(
      "SCREEN04_ADVANCED_ASSIGNMENT_AGGREGATION",
    );
    expect(findings.map((finding) => finding.title)).not.toContain(
      "The dataset unit differs from the exposure-assignment unit",
    );
  });

  it("calculates aggregate-unit exposure only from explicitly mapped crosswalk columns", async () => {
    const result = await runScreen04ScientificAssessment(scientificInput([
      "facility_id,parent_id,year,group,covered,unused_outcome",
      "A1,A,2020,T,yes,secret-1",
      "A2,A,2020,T,no,secret-2",
      "B1,B,2020,C,yes,secret-3",
      "B2,B,2020,C,yes,secret-4",
      "C1,C,2020,C,,secret-5",
    ].join("\n"), {
      mappings: {
        ...scientificInput(cleanScientificCsv()).mappings,
        unitIdentifier: "facility_id",
        assignmentLowerLevelIdentifier: "facility_id",
        assignmentAggregateIdentifier: "parent_id",
      },
      studyDescription: {
        ...scientificInput(cleanScientificCsv()).studyDescription,
        unitOfAnalysis: "Establishment-year",
        sampleUnitDescription: "Establishments",
        datasetAssignmentUnit: "establishment",
        shockAssignmentUnit: "parent-company",
      },
    }));

    expect(result.advancedDiagnostics?.selectedColumns).toEqual([
      "covered",
      "facility_id",
      "parent_id",
    ]);
    expect(result.advancedDiagnostics?.assignmentLevelAggregation).toEqual({
      conclusion: "mixed-lower-level-exposure",
      concern: true,
      aggregateSummary: {
        aggregateUnits: 3,
        aggregateUnitPeriods: 3,
        fullyExposedAggregateUnits: 1,
        partiallyExposedAggregateUnits: 1,
        unexposedAggregateUnits: 0,
        unknownAggregateUnits: 1,
        fullyExposedAggregateUnitPeriods: 1,
        partiallyExposedAggregateUnitPeriods: 1,
        unexposedAggregateUnitPeriods: 0,
        unknownAggregateUnitPeriods: 1,
        exposureShareSummary: {
          calculatedAggregateUnitPeriods: 2,
          minimum: 0.5,
          maximum: 1,
          mean: 0.75,
        },
      },
    });
    expect(JSON.stringify(result.advancedDiagnostics)).not.toContain("secret-");
  });

  it("evaluates only researcher-selected bounded combined rule packages", async () => {
    const result = await runScreen04ScientificAssessment(scientificInput([
      "unit_id,year,group,base,amended",
      "T1,2022,T,yes,yes",
      "T2,2022,T,yes,no",
      "C1,2022,C,no,yes",
      "C2,2022,C,yes,",
    ].join("\n"), {
      verifiedDates: [{
        label: "Implementation date",
        date: "2020-01-01",
        role: "implementation",
      }, {
        label: "Amendment date",
        date: "2022-01-01",
        role: "amendment",
      }],
      exposureRule: {
        approach: "coverage-variable",
        column: "base",
        coveredValue: "yes",
        effectiveYear: 2020,
        label: "Original coverage",
        component: "Original duty",
        version: "Original version",
      },
      additionalExposureRules: [{
        approach: "coverage-variable",
        column: "amended",
        coveredValue: "yes",
        effectiveYear: 2022,
        label: "Amended coverage",
        component: "Amended duty",
        version: "Amended version",
      }],
      combinedExposureScenarios: [{
        name: "Original and amended duties",
        ruleIndexes: [0, 1],
      }],
    }));

    expect(result.assessmentNotes).toEqual([]);
    expect(result.advancedDiagnostics?.scenarios).toContainEqual(
      expect.objectContaining({
        id: "researcher-combined-1",
        name: "Original and amended duties",
        treatmentDate: "2022-01-01",
        treatmentStage: "amendment",
        componentOrPackage: {
          kind: "package",
          name: "Original and amended duties",
        },
        sourceBasis: {
          eventCardBasis: expect.stringContaining("Amendment date"),
          selectedColumns: ["amended", "base"],
        },
        classificationCounts: {
          total: 4,
          exposed: 1,
          unexposed: 2,
          unknown: 1,
          not_applicable: 0,
        },
      }),
    );
  });

  it("rejects invalid combined selections visibly instead of running a partial scenario set", async () => {
    const input = scientificInput(cleanScientificCsv(), {
      additionalExposureRules: [{
        approach: "coverage-variable",
        column: "covered",
        coveredValue: "yes",
        effectiveYear: 2020,
        label: "Second supplied definition",
      }],
      combinedExposureScenarios: [{
        name: "Invalid duplicate selection",
        ruleIndexes: [0, 0],
      }],
    });
    const result = await runScreen04ScientificAssessment(input);

    expect(result.advancedDiagnostics).toBeNull();
    expect(result.assessmentNotes).toEqual([
      expect.stringMatching(/combined exposure scenario 1 is invalid/iu),
    ]);
    expect([...result.priorityFindings, ...result.otherFindings]).toContainEqual(
      expect.objectContaining({
        title: "The advanced assessment reached a supported boundary",
        whatFound: expect.stringMatching(/combined exposure scenario 1 is invalid/iu),
      }),
    );

    const unbounded = await runScreen04ScientificAssessment({
      ...input,
      combinedExposureScenarios: Array.from({ length: 9 }, (_unused, index) => ({
        name: `Combined definition ${index + 1}`,
        ruleIndexes: [0, 1],
      })),
    });
    expect(unbounded.advancedDiagnostics).toBeNull();
    expect(unbounded.assessmentNotes).toEqual([
      expect.stringMatching(/at most eight researcher-selected combined/iu),
    ]);
  });

  it("orders and deduplicates combined advanced and basic consequences", async () => {
    const result = await runScreen04ScientificAssessment(scientificInput([
      "unit_id,year,group,base_coverage,amended_coverage",
      "T1,2019,T,yes,yes",
      "T1,2020,T,no,yes",
      "T1,2022,T,no,yes",
      "C1,2019,C,no,yes",
      "C1,2020,C,no,yes",
      "C1,2022,C,no,yes",
    ].join("\n"), {
      verifiedDates: [{
        label: "Implementation date",
        date: "2020-01-01",
        role: "implementation",
      }, {
        label: "Amendment date",
        date: "2022-01-01",
        role: "amendment",
      }],
      exposureRule: {
        approach: "coverage-variable",
        column: "base_coverage",
        coveredValue: "yes",
        effectiveYear: 2020,
        label: "Original coverage",
        component: "Original component",
        version: "Original version",
      },
      additionalExposureRules: [{
        approach: "coverage-variable",
        column: "amended_coverage",
        coveredValue: "yes",
        effectiveYear: 2022,
        label: "Amended coverage",
        component: "Amendment component",
        version: "Amended version",
      }],
    }));
    const findings = [...result.priorityFindings, ...result.otherFindings];
    const indexForCode = (code: string) => findings.findIndex(
      (finding) => finding.code === code,
    );
    const indexForTitle = (title: string) => findings.findIndex(
      (finding) => finding.title === title,
    );

    expect(findings.map((finding) => finding.title)).not.toEqual(
      expect.arrayContaining([
        "Some proposed treated units appear unexposed",
        "A later stage exposes some proposed comparison units",
      ]),
    );
    expect(indexForCode("SCREEN04_ADVANCED_PROPOSED_CODING_DISAGREEMENT"))
      .toBeLessThan(indexForCode("SCREEN04_ADVANCED_COMPARISON_SURVIVAL"));
    expect(indexForCode("SCREEN04_ADVANCED_COMPARISON_SURVIVAL"))
      .toBeLessThan(indexForTitle("More than one event date is relevant"));
    expect(indexForTitle("More than one event date is relevant"))
      .toBeLessThan(indexForCode("SCREEN04_ADVANCED_TREATMENT_STABILITY"));
    expect(indexForCode("SCREEN04_ADVANCED_TREATMENT_STABILITY"))
      .toBeLessThan(indexForTitle("One proposed group is very small"));
    const enriched = findings.filter((finding) => finding.code !== undefined);
    expect(enriched.map((finding) => finding.consequenceOrder)).toEqual(
      [...enriched.map((finding) => finding.consequenceOrder)].sort(
        (left, right) => left! - right!,
      ),
    );
    expect(enriched.every((finding) =>
      finding.aggregate !== undefined &&
      Number.isFinite(finding.aggregate.shareOfReferenceObservations)
    )).toBe(true);
  });

  it("makes an over-eight scenario boundary visible without partial diagnostics", async () => {
    const verifiedDates = Array.from({ length: 9 }, (_unused, index) => ({
      label: index === 0 ? "Implementation date" : `Alternative ${index}`,
      date: `${2020 + index}-01-01`,
      role: index === 0 ? "implementation" as const : "other" as const,
    }));
    const result = await runScreen04ScientificAssessment(scientificInput(
      cleanScientificCsv(),
      { verifiedDates },
    ));
    const findings = [...result.priorityFindings, ...result.otherFindings];

    expect(result.advancedDiagnostics).toBeNull();
    expect(result.assessmentNotes).toEqual([
      expect.stringMatching(/eight-scenario limit would omit 1/u),
    ]);
    expect(findings).toContainEqual(expect.objectContaining({
      title: "The advanced assessment reached a supported boundary",
      priority: "high",
      whatFound: expect.stringMatching(/eight-scenario limit would omit 1/u),
    }));
  });

  it("treats only explicit null-rule Skip as neutral while preserving legacy guidance", async () => {
    const csv = cleanScientificCsv();
    const skipped = await runScreen04ScientificAssessment(scientificInput(csv, {
      coverageMatchingIntent: "skip",
      exposureRule: null,
    }));
    expect(skipped.setupIssues.filter((issue) => issue.field === "exposureRule"))
      .toEqual([]);
    expect(skipped.unresolvedResearcherChoices).toEqual([]);
    expect(skipped.assessmentNotes).toEqual([
      "Coverage matching was not included in this assessment.",
    ]);
    expect(skipped.advancedDiagnostics).toBeNull();
    expect(skipped.overallJudgment).not.toBe(
      "More information is needed before exposure can be checked",
    );

    const legacy = await runScreen04ScientificAssessment(scientificInput(csv, {
      coverageMatchingIntent: undefined,
      exposureRule: null,
    }));
    expect(legacy.setupIssues.some((issue) => issue.field === "exposureRule"))
      .toBe(true);
    expect(legacy.overallJudgment).toBe(
      "More information is needed before exposure can be checked",
    );
  });

  it("caps malformed-row setup issue growth with one bounded summary", async () => {
    const rows = ["unit_id,year,group,covered"];
    for (let index = 0; index < 30; index += 1) {
      rows.push(`U${index},2020,UNSELECTED,yes`);
    }
    const result = await runScreen04ScientificAssessment(
      scientificInput(rows.join("\n")),
    );
    const rowProblems = result.setupIssues.filter((issue) =>
      issue.title === "Treatment-group value is invalid"
    );
    expect(rowProblems).toHaveLength(SCREEN_04_MAX_ROW_SETUP_ISSUE_DETAILS);
    expect(result.setupIssues.find((issue) =>
      issue.title === "Additional row problems were omitted"
    )?.message).toContain("22 additional row-level problems");
  });
});
