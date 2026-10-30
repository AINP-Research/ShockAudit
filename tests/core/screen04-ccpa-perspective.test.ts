import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  runScreen04ScientificAssessment,
  type Screen04ScientificAssessmentInput,
} from "../../src/core/screen04-scientific-assessment";
import type { Screen04RuleExpression } from "../../src/core/screen04-rule-ast";

function fixture(name: string) {
  return readFileSync(
    new URL(`../fixtures/screen04/${name}`, import.meta.url),
    "utf8",
  );
}

const ccpaConditions: Screen04RuleExpression = {
  kind: "all",
  rules: [
    {
      kind: "categorical-equals",
      requirementId: "california-business-nexus",
      csvColumn: "DoesBusinessCA",
      value: "yes",
    },
    {
      kind: "any",
      rules: [
        {
          kind: "numeric-threshold",
          requirementId: "historical-revenue",
          csvColumn: "Revenue2017M",
          operator: ">=",
          threshold: 25,
          thresholdUnit: "USD millions",
          sourceUnit: "USD millions",
        },
        {
          kind: "numeric-threshold",
          requirementId: "data-volume",
          csvColumn: "DataVolumeThousands",
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
        requirementId: "explicit-exemption",
        csvColumn: "Exempt",
        value: "yes",
      },
    },
  ],
};

function ccpaInput(
  csvText: string,
  exposureRule: Screen04ScientificAssessmentInput["exposureRule"] = {
    approach: "conditions",
    expression: ccpaConditions,
    effectiveYear: 2020,
    component: "operative CCPA coverage",
    version: "2020 operative version",
    thresholdMeasurements: [
      {
        csvColumn: "Revenue2017M",
        threshold: 25,
        thresholdUnit: "USD millions",
        sourceUnit: "USD millions",
        requiredHistoricalMeasurementYear: 2017,
        mappedHistoricalMeasurementYear: 2017,
      },
      {
        csvColumn: "DataVolumeThousands",
        threshold: 50,
        thresholdUnit: "thousands",
        sourceUnit: "thousands",
      },
    ],
  },
): Screen04ScientificAssessmentInput {
  return {
    csvText,
    verifiedShockName: "California Consumer Privacy Act",
    mappings: {
      unitIdentifier: "GVKEY",
      year: "Year",
      treatmentGroup: "ProposedGroup",
      researcherTreatmentYear: 2020,
      treatedValue: "T",
      comparisonValue: "C",
    },
    studyDescription: {
      unitOfAnalysis: "Firm-year",
      sampleUnitDescription: "Public technology firms",
      dataFrequency: "annual",
      treatmentGroupDescription: "Firms headquartered in California",
      comparisonGroupDescription: "Firms headquartered outside California",
      mainComparisonBasis: "geography",
      groupGeographicConcept: "headquarters",
      shockGeographicConcept: "operating-location",
      datasetAssignmentUnit: "parent-company",
      shockAssignmentUnit: "firm",
    },
    verifiedDates: [
      { label: "Enactment", date: "2018-06-28", role: "enactment" },
      {
        label: "Operative date",
        date: "2020-01-01",
        role: "implementation",
      },
    ],
    exposureRule,
  };
}

function alignedCcpaInput(
  csvText: string,
  exposureRule?: Screen04ScientificAssessmentInput["exposureRule"],
) {
  const input = ccpaInput(csvText, exposureRule);
  input.studyDescription = {
    ...input.studyDescription,
    treatmentGroupDescription: "Firms operating in California",
    comparisonGroupDescription: "Firms not operating in California",
    groupGeographicConcept: "operating-location",
    shockGeographicConcept: "operating-location",
    datasetAssignmentUnit: "firm",
    shockAssignmentUnit: "firm",
  };
  return input;
}

describe("Screen 4 CCPA researcher perspective", () => {
  it("turns the issue-rich file into concise scientific findings", async () => {
    const result = await runScreen04ScientificAssessment(ccpaInput(
      fixture("CCPA_Screen4_issue_rich.csv"),
    ));
    const findings = [...result.priorityFindings, ...result.otherFindings];

    expect(result.metrics?.exposure).toMatchObject({
      proposedTreatedAuditedUnexposedUnits: 16,
      proposedTreatedAuditedUnexposedObservations: 16,
      proposedTreatedAuditedUnexposedYears: [2020],
      proposedComparisonAuditedExposedUnits: 8,
      proposedComparisonAuditedExposedObservations: 8,
      proposedComparisonAuditedExposedYears: [2020],
      unknownExposureUnits: 10,
      unknownExposureObservations: 10,
    });
    expect(result.overallJudgment).toBe(
      "Revise the treatment or comparison definition",
    );
    expect(findings.map((item) => item.title)).toEqual(expect.arrayContaining([
      "Proposed coding disagrees with verified coverage",
      "The group geography may not represent exposure",
      "Unknown exposure is concentrated in the comparison group",
      "Missing information has a deterministic repair priority",
    ]));
    expect(findings.map((item) => item.title)).not.toEqual(expect.arrayContaining([
      "More than one event date is relevant",
      "The timeline contains a potential anticipation period",
    ]));
    expect(findings.map((item) => item.title)).not.toContain(
      "The proposed comparison group becomes universally exposed",
    );
    expect(result.priorityFindings.length).toBeLessThanOrEqual(5);
    const readerCopy = JSON.stringify(findings.map((item) => ({
      title: item.title,
      whatFound: item.whatFound,
      whyItMatters: item.whyItMatters,
      possibleNextStep: item.possibleNextStep,
    })));
    expect(readerCopy).not.toMatch(
      /screen03-proposal|screen03-evidence|machine-executable|compiler|SCREEN04_|fingerprint|rule version|software/u,
    );
  });

  it("does not invent exposure disagreement in the clean fixture", async () => {
    const result = await runScreen04ScientificAssessment(alignedCcpaInput(
      fixture("CCPA_Screen4_clean.csv"),
    ));
    const titles = [...result.priorityFindings, ...result.otherFindings]
      .map((item) => item.title);

    expect(result.setupIssues).toEqual([]);
    expect(result.metrics?.exposure).toMatchObject({
      proposedTreatedAuditedUnexposedUnits: 0,
      proposedComparisonAuditedExposedUnits: 0,
      unknownExposureUnits: 0,
    });
    expect(titles).not.toContain(
      "Proposed groups do not fully match apparent coverage",
    );
    expect(titles).not.toContain(
      "Proposed coding disagrees with verified coverage",
    );
    expect(titles).not.toContain("Some units cannot be classified");
    expect(titles).not.toContain(
      "Unknown exposure is concentrated in the comparison group",
    );
    expect(titles).not.toContain("The proposed groups are numerically imbalanced");
    expect(titles).not.toContain("The group geography may not represent exposure");
    expect(titles).not.toContain(
      "The dataset unit differs from the exposure-assignment unit",
    );
    expect(titles).not.toContain(
      "The verified shock has components or versions to review",
    );
  });

  it("ignores twenty irrelevant columns and preserves the substantive result", async () => {
    const clean = await runScreen04ScientificAssessment(alignedCcpaInput(
      fixture("CCPA_Screen4_clean.csv"),
    ));
    const stress = await runScreen04ScientificAssessment(alignedCcpaInput(
      fixture("CCPA_Screen4_irrelevant_columns_stress.csv"),
    ));

    expect(stress.setupIssues).toEqual([]);
    expect(stress.metrics).toEqual(clean.metrics);
    expect(stress.overallJudgment).toBe(clean.overallJudgment);
    expect(stress.priorityFindings).toEqual(clean.priorityFindings);
    expect(stress.otherFindings).toEqual(clean.otherFindings);
  });

  it("shows duplicate and changing-group errors only as setup issues", async () => {
    const result = await runScreen04ScientificAssessment(ccpaInput(
      fixture("CCPA_Screen4_blocking_errors.csv"),
    ));

    expect(result.overallJudgment).toBe(
      "Fix the dataset setup before continuing",
    );
    expect(result.setupIssues.map((item) => item.title)).toEqual(
      expect.arrayContaining([
        "Duplicate unit-year",
        "Treatment-group membership changes",
      ]),
    );
    expect(result.metrics).toBeNull();
    expect(result.priorityFindings).toEqual([]);
    expect(result.otherFindings).toEqual([]);
  });

  it("supports an existing CCPA coverage variable as the quick approach", async () => {
    const result = await runScreen04ScientificAssessment(ccpaInput(
      fixture("CCPA_Screen4_clean.csv"),
      {
        approach: "coverage-variable",
        column: "CCPAApplicabilityStatus",
        coveredValue: "Eligible",
        effectiveYear: 2020,
      },
    ));

    expect(result.setupIssues).toEqual([]);
    expect(result.metrics?.exposure).toMatchObject({
      proposedTreatedAuditedUnexposedUnits: 0,
      proposedComparisonAuditedExposedUnits: 0,
      unknownExposureUnits: 0,
    });
  });
});
