import { describe, expect, it } from "vitest";

import {
  runScreen04ScientificAssessment,
  type Screen04ScientificAssessmentInput,
} from "../../src/core/screen04-scientific-assessment";
import type { Screen04RuleExpression } from "../../src/core/screen04-rule-ast";

function baseInput(
  csvText: string,
  overrides: Partial<Screen04ScientificAssessmentInput> = {},
): Screen04ScientificAssessmentInput {
  return {
    csvText,
    verifiedShockName: "Verified clean-air rule",
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
      sampleUnitDescription: "Public firms",
      dataFrequency: "annual",
      treatmentGroupDescription: "Firms in the proposed treatment group",
      comparisonGroupDescription: "Firms in the proposed comparison group",
      mainComparisonBasis: "legal-eligibility",
      datasetAssignmentUnit: "firm",
      shockAssignmentUnit: "firm",
    },
    verifiedDates: [{
      label: "Implementation date",
      date: "2020-01-01",
      role: "implementation",
    }],
    exposureRule: {
      approach: "coverage-variable",
      column: "covered",
      coveredValue: "yes",
      effectiveYear: 2020,
    },
    ...overrides,
  };
}

function balancedPanel(unitCount = 10) {
  const rows = ["unit_id,year,group,covered"];
  for (const group of ["T", "C"] as const) {
    for (let index = 1; index <= unitCount; index += 1) {
      for (const year of [2018, 2019, 2020, 2021]) {
        rows.push(
          `${group}${index},${year},${group},${group === "T" ? "yes" : "no"}`,
        );
      }
    }
  }
  return rows.join("\n");
}

describe("Screen 4 scientific sample assessment", () => {
  it("returns a clean, outcome-blind result when sample and exposure support are usable", async () => {
    const result = await runScreen04ScientificAssessment(
      baseInput(balancedPanel()),
    );

    expect(result.setupIssues).toEqual([]);
    expect(result.overallJudgment).toBe(
      "The proposed exposure design is broadly usable",
    );
    expect(result.metrics).toMatchObject({
      rowCount: 80,
      treatedToComparisonUnitRatio: 1,
      treated: {
        uniqueUnits: 10,
        unitPeriodObservations: 40,
        preTreatmentYears: 2,
        postTreatmentYears: 2,
        unitsObservedOnBothSides: 10,
      },
      comparison: {
        uniqueUnits: 10,
        unitPeriodObservations: 40,
        unitsObservedOnBothSides: 10,
      },
      exposure: {
        proposedTreatedAuditedUnexposedUnits: 0,
        proposedComparisonAuditedExposedUnits: 0,
        unknownExposureUnits: 0,
      },
    });
    expect(result.priorityFindings).toEqual([]);
    expect(JSON.stringify(result)).not.toMatch(
      /outcome|regression|effect estimate|screen03-proposal|SCREEN04_/u,
    );
  });

  it("calculates small-group, four-to-one imbalance, and panel-support heuristics", async () => {
    const rows = ["unit_id,year,group,covered"];
    for (let index = 1; index <= 12; index += 1) {
      for (const year of [2018, 2019, 2020, 2021]) {
        rows.push(`T${index},${year},T,yes`);
      }
    }
    for (let index = 1; index <= 3; index += 1) {
      for (const year of [2018, 2019, 2020, 2021]) {
        rows.push(`C${index},${year},C,no`);
      }
    }
    const result = await runScreen04ScientificAssessment(
      baseInput(rows.join("\n")),
    );
    const findings = [...result.priorityFindings, ...result.otherFindings];

    expect(result.metrics?.treatedToComparisonUnitRatio).toBe(4);
    expect(findings.map((item) => item.title)).toEqual(
      expect.arrayContaining([
        "One proposed group is very small",
        "The proposed groups are numerically imbalanced",
      ]),
    );
    expect(findings.find((item) =>
      item.title === "The proposed groups are numerically imbalanced"
    )?.whyItMatters).toMatch(/does not invalidate/u);
  });

  it("calculates both-side support, only-side units, entry, exit, and internal gaps", async () => {
    const csv = [
      "unit_id,year,group,covered",
      "A,2018,T,no",
      "A,2020,T,yes",
      "A,2022,T,yes",
      "B,2018,T,no",
      "C,2021,C,no",
      "D,2018,C,no",
      "D,2019,C,no",
      "D,2020,C,no",
      "D,2021,C,no",
      "D,2022,C,no",
    ].join("\n");
    const result = await runScreen04ScientificAssessment(baseInput(csv));

    expect(result.metrics).toMatchObject({
      internalMissingYears: 2,
      treated: {
        unitsObservedOnBothSides: 1,
        unitsObservedOnlyBefore: 1,
        unitsObservedOnlyAfter: 0,
        unitsWithInternalGaps: 1,
      },
      comparison: {
        unitsObservedOnBothSides: 1,
        unitsObservedOnlyAfter: 1,
        unitsEnteringAfterTreatment: 1,
      },
    });
    expect([
      ...result.priorityFindings,
      ...result.otherFindings,
    ].map((item) => item.title)).toEqual(expect.arrayContaining([
      "Many units are observed on only one side of treatment",
      "The annual panel contains internal gaps",
      "Sample membership changes around treatment",
    ]));
  });

  it("distinguishes verified date roles, anticipation, and mixed annual exposure", async () => {
    const result = await runScreen04ScientificAssessment(baseInput(
      balancedPanel(),
      {
        mappings: {
          unitIdentifier: "unit_id",
          year: "year",
          treatmentGroup: "group",
          researcherTreatmentYear: 2018,
          treatedValue: "T",
          comparisonValue: "C",
        },
        verifiedDates: [
          { label: "Enactment", date: "2018-06-28", role: "enactment" },
          {
            label: "Operative date",
            date: "2020-07-01",
            role: "implementation",
          },
        ],
      },
    ));
    const titles = [
      ...result.priorityFindings,
      ...result.otherFindings,
    ].map((item) => item.title);

    expect(titles).toEqual(expect.arrayContaining([
      "More than one event date is relevant",
      "The treatment year represents an earlier event stage",
      "The timeline contains a potential anticipation period",
      "The operative year mixes exposed and unexposed time",
    ]));
    expect(JSON.stringify(result)).toMatch(/does not claim that anticipation occurred/u);
  });

  it("supports nested threshold logic and reports threshold, geography, assignment, and version review", async () => {
    const expression: Screen04RuleExpression = {
      kind: "all",
      rules: [
        {
          kind: "categorical-equals",
          requirementId: "nexus",
          csvColumn: "operates_ca",
          value: "yes",
        },
        {
          kind: "any",
          rules: [
            {
              kind: "numeric-threshold",
              requirementId: "revenue",
              csvColumn: "revenue",
              operator: ">=",
              threshold: 25,
              thresholdUnit: "USD millions",
              sourceUnit: "USD millions",
            },
            {
              kind: "numeric-threshold",
              requirementId: "volume",
              csvColumn: "volume",
              operator: ">=",
              threshold: 50,
              thresholdUnit: "thousands",
              sourceUnit: "thousands",
            },
          ],
        },
        {
          kind: "not",
          rule: {
            kind: "categorical-equals",
            requirementId: "exemption",
            csvColumn: "exempt",
            value: "yes",
          },
        },
      ],
    };
    const rows = [
      "unit_id,year,group,operates_ca,revenue,volume,exempt",
      "A,2018,T,yes,25,10,no",
      "A,2019,T,yes,25,10,no",
      "A,2020,T,yes,25,10,no",
      "B,2018,C,yes,24,10,no",
      "B,2019,C,yes,24,10,no",
      "B,2020,C,yes,24,10,no",
      "C,2018,C,yes,,10,no",
      "C,2019,C,yes,,10,no",
      "C,2020,C,yes,,10,no",
    ].join("\n");
    const result = await runScreen04ScientificAssessment(baseInput(rows, {
      studyDescription: {
        unitOfAnalysis: "Parent firm-year",
        sampleUnitDescription: "Public technology firms",
        dataFrequency: "annual",
        treatmentGroupDescription: "Firms headquartered in California",
        comparisonGroupDescription: "Firms headquartered elsewhere",
        mainComparisonBasis: "geography",
        groupGeographicConcept: "headquarters",
        shockGeographicConcept: "operating-location",
        datasetAssignmentUnit: "parent-company",
        shockAssignmentUnit: "establishment",
      },
      exposureDimensions: [{
        kind: "treatment-component",
        label: "Treatment component",
        summary: "The verified shock contains distinct obligations.",
      }, {
        kind: "amendment-version",
        label: "Amendment or version",
        summary: "A later verified version may change coverage.",
      }],
      exposureRule: {
        approach: "conditions",
        expression,
        effectiveYear: 2020,
        component: "initial obligations",
        version: "initial",
        thresholdMeasurements: [{
          csvColumn: "revenue",
          threshold: 25,
          thresholdUnit: "USD millions",
          sourceUnit: "USD millions",
          requiredHistoricalMeasurementYear: 2017,
          mappedHistoricalMeasurementYear: 2018,
        }],
      },
      additionalExposureRules: [{
        approach: "coverage-variable",
        column: "operates_ca",
        coveredValue: "yes",
        effectiveYear: 2021,
        component: "later obligations",
        version: "amended",
      }],
    }));
    const findings = [...result.priorityFindings, ...result.otherFindings];

    expect(result.metrics?.thresholdReviews[0]).toMatchObject({
      exactlyAtThreshold: 1,
      withinFivePercent: 2,
      missingOrInvalid: 1,
      historicalMeasurementYearMismatch: true,
    });
    expect(findings.map((item) => item.title)).toEqual(expect.arrayContaining([
      "The group geography may not represent exposure",
      "The dataset unit differs from the exposure-assignment unit",
      "The shock has multiple mapped stages or versions",
      "Some exposure classifications are sensitive to a threshold",
    ]));
    expect(findings.map((item) => item.title)).not.toContain(
      "The verified shock has components or versions to review",
    );
    expect(result.priorityFindings.length).toBeLessThanOrEqual(5);
    expect(findings.every((item) =>
      item.whatFound && item.whyItMatters &&
      Object.hasOwn(item, "possibleNextStep")
    )).toBe(true);
  });

  it("does not emit timing or component boilerplate without a relevant data trigger", async () => {
    const result = await runScreen04ScientificAssessment(baseInput(
      balancedPanel(),
      {
        verifiedDates: [
          { label: "Announcement", date: "2010-01-01", role: "announcement" },
          { label: "Implementation", date: "2012-01-01", role: "implementation" },
        ],
        exposureDimensions: [{
          kind: "treatment-component",
          label: "Treatment component",
          summary: "The Event Card records a possible component.",
        }],
      },
    ));
    const titles = [...result.priorityFindings, ...result.otherFindings]
      .map((item) => item.title);

    expect(titles).not.toContain("More than one event date is relevant");
    expect(titles).not.toContain(
      "The timeline contains a potential anticipation period",
    );
    expect(titles).not.toContain(
      "The verified shock has components or versions to review",
    );
  });

  it("keeps exact-header and structural failures in setupIssues", async () => {
    const caseMismatch = await runScreen04ScientificAssessment(baseInput(
      "GVKEY,year,group,covered\nA,2020,T,yes\nB,2020,C,no",
      {
        mappings: {
          unitIdentifier: "gvkey",
          year: "year",
          treatmentGroup: "group",
          researcherTreatmentYear: 2020,
          treatedValue: "T",
          comparisonValue: "C",
        },
      },
    ));
    expect(caseMismatch.metrics).toBeNull();
    expect(caseMismatch.overallJudgment).toBe(
      "Fix the dataset setup before continuing",
    );
    expect(caseMismatch.setupIssues).toContainEqual(expect.objectContaining({
      field: "unitIdentifier",
      title: "Column not found",
      message: expect.stringContaining("`GVKEY`, not `gvkey`"),
      blocking: true,
    }));
    expect(caseMismatch.priorityFindings).toEqual([]);

    const malformedGroups = await runScreen04ScientificAssessment(baseInput([
      "unit_id,year,group,covered",
      "A,2019,T,no",
      "A,2020,T,yes",
      "A,2020,T,yes",
      "B,2019,C,no",
      "B,2020,T,yes",
    ].join("\n")));
    expect(malformedGroups.setupIssues.map((item) => item.title)).toEqual(
      expect.arrayContaining([
        "Duplicate unit-year",
        "Treatment-group membership changes",
      ]),
    );
    expect(malformedGroups.metrics).toBeNull();
    expect(malformedGroups.priorityFindings).toEqual([]);
  });

  it("allows timing and sample checks when exposure mapping is unavailable", async () => {
    const result = await runScreen04ScientificAssessment(baseInput(
      balancedPanel(),
      {
        exposureRule: null,
        studyDescription: {
          unitOfAnalysis: "Parent firm-year",
          sampleUnitDescription: "Public firms",
          dataFrequency: "annual",
          treatmentGroupDescription: "Firms headquartered in California",
          comparisonGroupDescription: "Firms headquartered elsewhere",
          mainComparisonBasis: "geography",
          groupGeographicConcept: "headquarters",
          shockGeographicConcept: "operating-location",
          datasetAssignmentUnit: "parent-company",
          shockAssignmentUnit: "establishment",
        },
      },
    ));

    expect(result.metrics).not.toBeNull();
    expect(result.overallJudgment).toBe(
      "More information is needed before exposure can be checked",
    );
    expect(result.setupIssues).toContainEqual(expect.objectContaining({
      title: "Some exposure conditions are not mapped",
      blocking: false,
    }));
    expect(result.unresolvedResearcherChoices).toContain(
      "Confirm how coverage or eligibility appears in the dataset before interpreting row-level exposure.",
    );
    expect([
      ...result.priorityFindings,
      ...result.otherFindings,
    ].map((item) => item.title)).toEqual(expect.arrayContaining([
      "The group geography may not represent exposure",
      "The dataset unit differs from the exposure-assignment unit",
    ]));
  });

  it("uses the mapped historical year deterministically for threshold review", async () => {
    const header = "unit_id,year,group,revenue";
    const observations = [
      "A,2020,T,30",
      "A,2019,T,25",
      "B,2020,C,10",
      "B,2019,C,24",
    ];
    const input = (rows: readonly string[]) => baseInput(
      [header, ...rows].join("\n"),
      {
        exposureRule: {
          approach: "conditions",
          effectiveYear: 2020,
          expression: {
            kind: "numeric-threshold",
            requirementId: "historical-revenue",
            csvColumn: "revenue",
            operator: ">=",
            threshold: 25,
            thresholdUnit: "USD millions",
            sourceUnit: "USD millions",
          },
          thresholdMeasurements: [{
            csvColumn: "revenue",
            threshold: 25,
            thresholdUnit: "USD millions",
            sourceUnit: "USD millions",
            requiredHistoricalMeasurementYear: 2019,
            mappedHistoricalMeasurementYear: 2019,
            historicalValueSource: "panel-year",
          }],
        },
      },
    );
    const forward = await runScreen04ScientificAssessment(input(observations));
    const reversed = await runScreen04ScientificAssessment(
      input([...observations].reverse()),
    );

    expect(forward.metrics?.thresholdReviews).toEqual(
      reversed.metrics?.thresholdReviews,
    );
    expect(forward.metrics?.thresholdReviews[0]).toMatchObject({
      exactlyAtThreshold: 1,
      withinFivePercent: 2,
      missingOrInvalid: 0,
    });
    expect(forward.metrics?.exposure).toMatchObject({
      proposedTreatedAuditedUnexposedUnits: 0,
      proposedComparisonAuditedExposedUnits: 0,
    });
  });

  it("keeps a missing mapped historical observation unknown", async () => {
    const result = await runScreen04ScientificAssessment(baseInput([
      "unit_id,year,group,revenue",
      "A,2019,T,30",
      "A,2020,T,30",
      "B,2019,C,10",
      "B,2020,C,10",
    ].join("\n"), {
      exposureRule: {
        approach: "conditions",
        effectiveYear: 2020,
        expression: {
          kind: "numeric-threshold",
          requirementId: "threshold:historical-revenue",
          csvColumn: "revenue",
          operator: ">=",
          threshold: 25,
          thresholdUnit: "USD millions",
          sourceUnit: "USD millions",
        },
        thresholdMeasurements: [{
          csvColumn: "revenue",
          threshold: 25,
          thresholdUnit: "USD millions",
          sourceUnit: "USD millions",
          requiredHistoricalMeasurementYear: 2017,
          mappedHistoricalMeasurementYear: 2017,
          historicalValueSource: "panel-year",
        }],
      },
    }));

    expect(result.metrics?.exposure).toMatchObject({
      exposedObservations: 0,
      unexposedObservations: 0,
      unknownExposureUnits: 2,
      unknownExposureObservations: 2,
    });
    expect(result.metrics?.thresholdReviews[0]).toMatchObject({
      missingOrInvalid: 2,
    });
  });

  it("uses a dedicated historical column without requiring a historical panel row", async () => {
    const result = await runScreen04ScientificAssessment(baseInput([
      "unit_id,year,group,revenue_2017",
      "A,2019,T,30",
      "A,2020,T,30",
      "B,2019,C,10",
      "B,2020,C,10",
    ].join("\n"), {
      exposureRule: {
        approach: "conditions",
        effectiveYear: 2020,
        expression: {
          kind: "numeric-threshold",
          requirementId: "threshold:historical-revenue-column",
          csvColumn: "revenue_2017",
          operator: ">=",
          threshold: 25,
          thresholdUnit: "USD millions",
          sourceUnit: "USD millions",
        },
        thresholdMeasurements: [{
          csvColumn: "revenue_2017",
          threshold: 25,
          thresholdUnit: "USD millions",
          sourceUnit: "USD millions",
          requiredHistoricalMeasurementYear: 2017,
          mappedHistoricalMeasurementYear: 2017,
          historicalValueSource: "column-values",
        }],
      },
    }));

    expect(result.metrics?.exposure).toMatchObject({
      exposedObservations: 1,
      unexposedObservations: 1,
      unknownExposureUnits: 0,
      unknownExposureObservations: 0,
    });
    expect(result.metrics?.thresholdReviews[0]).toMatchObject({
      exactlyAtThreshold: 0,
      missingOrInvalid: 0,
    });
  });

  it("limits ordinary condition rules to eight leaves without blocking structural checks", async () => {
    const rules: Screen04RuleExpression[] = Array.from(
      { length: 9 },
      (_, index) => ({
        kind: "categorical-equals" as const,
        requirementId: `condition-${index}`,
        csvColumn: "covered",
        value: "yes",
      }),
    );
    const result = await runScreen04ScientificAssessment(baseInput(
      balancedPanel(),
      {
        exposureRule: {
          approach: "conditions",
          expression: { kind: "all", rules },
          effectiveYear: 2020,
        },
      },
    ));

    expect(result.metrics).not.toBeNull();
    expect(result.setupIssues).toContainEqual(expect.objectContaining({
      title: "Too many exposure conditions",
      blocking: false,
    }));
    expect(result.overallJudgment).toBe(
      "More information is needed before exposure can be checked",
    );
  });

  it("keeps an unusable later exposure rule unknown instead of treating it as false", async () => {
    const result = await runScreen04ScientificAssessment(baseInput(
      balancedPanel(),
      {
        additionalExposureRules: [{
          approach: "coverage-variable",
          column: "missing_amendment_coverage",
          coveredValue: "yes",
          effectiveYear: 2020,
          component: "later amendment",
        }],
      },
    ));

    expect(result.setupIssues).toContainEqual(expect.objectContaining({
      field: "exposureRule",
      title: "Column not found",
      blocking: false,
    }));
    expect(result.metrics?.exposure).toMatchObject({
      unknownExposureUnits: 10,
      unknownExposureObservations: 20,
      proposedComparisonAuditedExposedUnits: 0,
    });
  });

  it("detects samples with universal exposure or no observed exposure", async () => {
    const panelWithCoverage = (covered: "yes" | "no") => {
      const rows = ["unit_id,year,group,covered"];
      for (const group of ["T", "C"] as const) {
        for (let index = 1; index <= 10; index += 1) {
          for (const year of [2019, 2020, 2021]) {
            rows.push(`${group}${index},${year},${group},${covered}`);
          }
        }
      }
      return rows.join("\n");
    };

    const universal = await runScreen04ScientificAssessment(
      baseInput(panelWithCoverage("yes")),
    );
    expect([
      ...universal.priorityFindings,
      ...universal.otherFindings,
    ].map((item) => item.title)).toEqual(expect.arrayContaining([
      "The sample has no usable exposed-unexposed contrast",
      "The proposed comparison group becomes universally exposed",
    ]));
    expect(universal.priorityFindings.slice(0, 3).map((item) => ({
      title: item.title,
      diagnosticTitle: item.diagnosticTitle,
    }))).toEqual([
      {
        title: "The sample has no usable exposed-unexposed contrast",
        diagnosticTitle: undefined,
      },
      expect.objectContaining({
        diagnosticTitle:
          "Why does your treatment coding differ from the shock rules?",
      }),
      expect.objectContaining({
        diagnosticTitle: "Does your control group remain untreated?",
      }),
    ]);
    expect(universal.priorityFindings.find((item) =>
      item.diagnosticTitle ===
        "Why does your treatment coding differ from the shock rules?"
    )).toMatchObject({
      severity: "Major design concern",
      whereItOccurs: {
        details: expect.arrayContaining([
          expect.objectContaining({
            proposedGroup: "comparison",
            auditedStatus: "exposed",
          }),
        ]),
      },
    });

    const absent = await runScreen04ScientificAssessment(
      baseInput(panelWithCoverage("no")),
    );
    expect([
      ...absent.priorityFindings,
      ...absent.otherFindings,
    ].map((item) => item.title)).toContain("No sampled unit appears exposed");
  });

  it("requires unresolved date-role confirmation without inventing mixed annual exposure outside the sample", async () => {
    const unresolved = await runScreen04ScientificAssessment(baseInput(
      balancedPanel(),
      {
        verifiedDates: [{
          label: "Reviewed date",
          date: "2020-01-01",
          role: "other",
        }],
      },
    ));
    expect(unresolved.unresolvedResearcherChoices).toContain(
      "Confirm the role of each verified date that is not yet identified as announcement, enactment, implementation, compliance, enforcement, amendment, repeal, or delay.",
    );
    expect(unresolved.overallJudgment).toBe("Review several exposure choices");

    const outsideSample = await runScreen04ScientificAssessment(baseInput(
      balancedPanel(),
      {
        verifiedDates: [{
          label: "Later operative date",
          date: "2025-07-01",
          role: "implementation",
        }],
      },
    ));
    expect([
      ...outsideSample.priorityFindings,
      ...outsideSample.otherFindings,
    ].map((item) => item.title)).not.toContain(
      "The operative year mixes exposed and unexposed time",
    );

    const gapRows = ["unit_id,year,group,covered"];
    for (const group of ["T", "C"] as const) {
      for (let index = 1; index <= 10; index += 1) {
        gapRows.push(`${group}${index},2019,${group},${group === "T" ? "no" : "no"}`);
        gapRows.push(`${group}${index},2021,${group},${group === "T" ? "yes" : "no"}`);
      }
    }
    const gapYear = await runScreen04ScientificAssessment(baseInput(
      gapRows.join("\n"),
      {
        verifiedDates: [{
          label: "Unobserved operative year",
          date: "2020-07-01",
          role: "implementation",
        }],
      },
    ));
    expect([
      ...gapYear.priorityFindings,
      ...gapYear.otherFindings,
    ].map((item) => item.title)).not.toContain(
      "The operative year mixes exposed and unexposed time",
    );
  });

  it("completes the scientific assessment at the 20,000-row boundary", async () => {
    const rows = ["unit_id,year,group,covered"];
    for (const group of ["T", "C"] as const) {
      for (let index = 1; index <= 5_000; index += 1) {
        for (const year of [2019, 2020]) {
          rows.push(
            `${group}${index},${year},${group},${group === "T" ? "yes" : "no"}`,
          );
        }
      }
    }
    const started = performance.now();
    const result = await runScreen04ScientificAssessment(
      baseInput(rows.join("\n")),
    );
    const elapsedMs = performance.now() - started;

    expect(result.setupIssues).toEqual([]);
    expect(result.metrics).toMatchObject({
      rowCount: 20_000,
      treated: { uniqueUnits: 5_000 },
      comparison: { uniqueUnits: 5_000 },
    });
    expect(elapsedMs).toBeLessThan(5_000);
  }, 15_000);
});
