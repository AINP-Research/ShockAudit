import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { fingerprintScreen03Value } from "../../src/core/screen03-workflow";
import {
  SCREEN_04_EVENT_CARD_BINDING_SCHEMA_VERSION,
  type Screen04EventCardBinding,
} from "../../src/core/screen04-event-card-binding";
import {
  SCREEN_04_SCIENTIFIC_ASSESSMENT_SCHEMA_VERSION,
  type Screen04ScientificAssessmentResult,
  type Screen04ScientificFinding,
} from "../../src/core/screen04-scientific-assessment";
import {
  attachScreen04Upload,
  beginScreen04ScientificAssessment,
  createScreen04WorkflowState,
  markScreen04WorkflowStale,
  recordScreen04ScientificAssessment,
  restoreScreen04WorkflowState,
  saveScreen04SampleProfile,
  switchScreen04Mode,
  updateScreen04DatasetProfile,
  updateScreen04NodataProfile,
  type Screen04WorkflowState,
} from "../../src/core/screen04-workflow";
import type { Screen04DatasetExposureMapping } from "../../src/core/screen04-sample-profile";
import Screen04, {
  screen04CombinedExposureScenarioInput,
  screen04CompileExposureRules,
  screen04LocalAssessmentMayRender,
  screen04OperationStateGuard,
  screen04OperationStateIsCurrent,
  screen04TransientHeaderReadiness,
} from "../../src/ui/screen-04/Screen04";

const at = "2026-08-23T12:00:00.000Z";

function binding(): Screen04EventCardBinding {
  const input = {
    schemaVersion: SCREEN_04_EVENT_CARD_BINDING_SCHEMA_VERSION,
    screen02: {
      runId: "screen02-run",
      mode: "find" as const,
      selectedEventId: "selected-event",
      selectedEventFingerprint: "fnv1a64:1111111111111111",
      handoffFingerprint: "fnv1a64:2222222222222222",
    },
    screen03: {
      runId: "screen03-run",
      stateFingerprint: "fnv1a64:3333333333333333",
    },
    eventCard: {
      id: "screen03:screen03-run:event-card",
      version: "locked-at:2026-08-23T11:59:00.000Z",
      fingerprint: "fnv1a64:4444444444444444",
      lockedAt: "2026-08-23T11:59:00.000Z",
    },
    verifiedShockName: "Verified Clean Air Rule",
    verifiedTimeline: [{
      proposalId: "screen03-proposal-effective",
      label: "Effective date",
      stage: "effective" as const,
      proposedDate: "2020-07-01",
      resolvedDate: "2020-07-01",
      sourceIds: ["screen03-evidence-source"],
      passageIds: ["screen03-evidence-passage"],
    }],
    focalClock: {
      selected: {
        proposalId: "screen03-proposal-effective",
        label: "Effective date",
        stage: "effective" as const,
        proposedDate: "2020-07-01",
        resolvedDate: "2020-07-01",
        sourceIds: ["screen03-evidence-source"],
        passageIds: ["screen03-evidence-passage"],
      },
      alternatives: [],
    },
    assignmentUnit: [],
    geographicCoverage: [],
    eligibilityConditions: [{
      proposalId: "screen03-proposal-coverage",
      label: "Covered operations",
      resolvedValue: "Operates in the covered jurisdiction",
      sourceIds: ["screen03-evidence-source"],
      passageIds: ["screen03-evidence-passage"],
    }],
    thresholds: [],
    exemptions: [],
    treatmentComponents: [],
    amendmentsAndVersions: [],
    exposureDimensions: [{
      id: "screen04-exposure-geography" as const,
      kind: "geography" as const,
      label: "Geographic coverage",
      summary: "Operations in the covered jurisdiction determine this condition.",
      claimIds: ["screen03-proposal-coverage"],
      evidenceIds: ["screen03-evidence-source"],
    }],
    unresolvedLimitations: {
      gaps: ["Internal source-coverage gap"],
      unknownProposalIds: ["screen03-proposal-unknown"],
      rejectedProposalIds: [],
      unsupportedProposalIds: [],
      uncertainties: [],
    },
    compilerLimitations: [{
      code: "SCREEN04_ASSIGNMENT_UNIT_NOT_MACHINE_TYPED" as const,
      message: "The internal assignment-unit contract is not machine-typed.",
    }],
    linkedEvidenceIds: ["screen03-evidence-source"],
  };
  return {
    ...input,
    bindingFingerprint: fingerprintScreen03Value(input),
  };
}

function initialState() {
  return createScreen04WorkflowState(binding(), "screen04-run", at);
}

function render(state: Screen04WorkflowState) {
  return renderToStaticMarkup(
    <Screen04
      state={state}
      onStateChange={vi.fn()}
      onBack={vi.fn()}
      onStartFresh={vi.fn()}
    />,
  );
}

function finding(
  index: number,
  category: Screen04ScientificFinding["category"] = "Sample support",
  priority: Screen04ScientificFinding["priority"] = "medium",
): Screen04ScientificFinding {
  return {
    category,
    title: `Reader-facing finding ${index}`,
    whatFound: `${index} units require review.`,
    whyItMatters: "The proposed comparison may rely on limited sample support.",
    possibleNextStep: index % 2 === 0 ? "Review the affected units." : null,
    priority,
  };
}

function datasetState(
  findings: readonly Screen04ScientificFinding[],
  unresolvedResearcherChoices: readonly string[] = [],
  exposureMapping: Screen04DatasetExposureMapping | null = {
    approach: "coverage-variable",
    column: "CCPAApplicabilityStatus",
    coveredValue: "Eligible",
  },
) {
  let state = attachScreen04Upload(initialState(), {
    schemaVersion: "screen-04-upload-reference-v1",
    opaqueFileRef: "opaque:screen04-render-test",
    csvFingerprint: "fnv1a64:5555555555555555",
    headerFingerprint: "fnv1a64:6666666666666666",
    byteLength: 1_024,
    headerCount: 8,
    uploadedAt: "2026-08-23T12:01:00.000Z",
    expiresAt: "2026-08-23T13:01:00.000Z",
  }, "2026-08-23T12:01:00.000Z");
  state = updateScreen04DatasetProfile(state, {
    description: {
      unitOfAnalysis: "Firm-year",
      sampleUnits: "Public technology firms",
      dataFrequency: "annual",
      sampleStartYear: 2017,
      sampleEndYear: 2022,
      researcherTreatmentYear: 2020,
      treatmentGroupDescription: "Firms headquartered in California",
      controlGroupDescription: "Firms headquartered outside California",
      comparisonBasis: "geography",
      geographicConcept: "headquarters",
      shockGeographicConcept: "operating-location",
      datasetAssignmentUnit: "firm",
      shockAssignmentUnit: "facility",
    },
    fieldMappings: {
      unitIdentifier: "GVKEY",
      annualTime: "Year",
      treatmentGroup: "ProposedGroup",
      treatedValue: "T",
      comparisonValue: "C",
      geography: "HeadquartersState",
      treatmentGeographicValues: "CA",
      controlGeographicValues: "All other states",
    },
    exposureMapping,
  }, "2026-08-23T12:02:00.000Z");
  const overallJudgment = findings.some((item) =>
    item.priority === "high" &&
    (item.category === "Treatment definition" ||
      item.category === "Comparison group" ||
      item.category === "Treatment variation")
  )
    ? "Revise the treatment or comparison definition" as const
    : findings.length > 0 || unresolvedResearcherChoices.length > 0
      ? "Review several exposure choices" as const
      : "The proposed exposure design is broadly usable" as const;
  const groupMetrics = {
    uniqueUnits: 6,
    unitPeriodObservations: 18,
    preTreatmentYears: 3,
    postTreatmentYears: 3,
    unitsObservedOnBothSides: 6,
    unitsObservedOnlyBefore: 0,
    unitsObservedOnlyAfter: 0,
    unitsEnteringAfterTreatment: 0,
    unitsExitingBeforeOrImmediatelyAfterTreatment: 0,
    unitsWithInternalGaps: 0,
  };
  const result: Screen04ScientificAssessmentResult = {
    schemaVersion: SCREEN_04_SCIENTIFIC_ASSESSMENT_SCHEMA_VERSION,
    verifiedShockName: binding().verifiedShockName,
    overallJudgment,
    setupIssues: [],
    metrics: {
      rowCount: 36,
      observedYearRange: { earliest: 2017, latest: 2022 },
      treatedToComparisonUnitRatio: 1,
      treated: groupMetrics,
      comparison: groupMetrics,
      internalMissingYears: 0,
      groupCountsByYear: [],
      exposure: {
        exposedObservations: 18,
        unexposedObservations: 18,
        unknownObservations: 0,
        notApplicableObservations: 0,
        proposedTreatedAuditedUnexposedUnits: 0,
        proposedTreatedAuditedUnexposedObservations: 0,
        proposedTreatedAuditedUnexposedYears: [],
        proposedTreatedAuditedUnexposedReasons: [],
        proposedComparisonAuditedExposedUnits: 0,
        proposedComparisonAuditedExposedObservations: 0,
        proposedComparisonAuditedExposedYears: [],
        proposedComparisonAuditedExposedReasons: [],
        unknownExposureUnits: 0,
        unknownExposureObservations: 0,
      },
      thresholdReviews: [],
    },
    priorityFindings: findings.slice(0, 5),
    otherFindings: findings.slice(5),
    unresolvedResearcherChoices,
  };
  state = beginScreen04ScientificAssessment(
    state,
    "2026-08-23T12:02:30.000Z",
  );
  return recordScreen04ScientificAssessment(
    state,
    result,
    "2026-08-23T12:03:00.000Z",
  );
}

const forbiddenReaderStrings = [
  "Locked Event Card",
  "Exact shock binding",
  "screen03-proposal-",
  "screen03-evidence-",
  "machine-executable",
  "compiler contract",
  "machine-typed",
  "Software / rule version",
  "screen-04-audit-engine",
  "screen-04-rule-ast",
  "SCREEN04_",
  "Blocks full exposure",
  "Result fingerprint",
  "Reproducible exports",
  "What was assessed",
  "What could not be assessed",
];

describe("Screen 4 reader workspace", () => {
  it("shows only the reader-safe shock identity and the reversible mode choice", () => {
    const html = render(initialState());

    expect(html).toContain("<h1>Audit exposure in your sample</h1>");
    expect(html).toContain("Shock being assessed: Verified Clean Air Rule");
    expect(html).toContain("Screen 4 uses the shock facts you confirmed in Screen 3.");
    expect(html).toContain("No dataset ready yet?");
    expect(html).toContain("Continue without a dataset");
    expect(html).toContain('data-testid="screen04-file-input"');
    expect(html).toContain('data-testid="screen04-action-bar"');
    expect(html).toContain("Choose a CSV to begin");
    expect(html).toContain('data-testid="screen04-calculate"');
    expect(html).toContain("disabled");
    expect(html).toContain("Private local file");
    expect(html).not.toMatch(/outcome (field|variable)/iu);
    expect(html).not.toMatch(/regression controls? (field|select)/iu);
    for (const forbidden of forbiddenReaderStrings) {
      expect(html, forbidden).not.toContain(forbidden);
    }
  });

  it("presents coverage matching as a collapsed optional check with Skip as the default", () => {
    const source = readFileSync(
      new URL("../../src/ui/screen-04/Screen04.tsx", import.meta.url),
      "utf8",
    );

    for (const copy of [
      "Optional: Check whether your groups match who was actually covered",
      "Use this section when your CSV contains information that helps determine whether each unit was covered by the shock, such as location, organization type, a size threshold, filing status, or an exemption.",
      "Adding this information lets ShockAudit check whether some proposed treated units may not have been covered, whether some proposed control units may have been exposed, and where exposure remains uncertain.",
      "You may skip this section. ShockAudit can still assess treatment timing, treatment and control group sizes, panel coverage, entry, exit, and missing periods.",
      "Skip this optional check",
      "I already have a variable showing who was covered",
      "Use dataset fields to determine who was covered",
    ]) expect(source).toContain(copy);
    expect(source).toContain("checked={currentExposure === null}");
    expect(source).toContain("onChange={() => updateExposureMapping(null)}");
    expect(source).toContain('data-testid="screen04-exposure-details"');
    expect(source).not.toContain("<details open");
    expect(source).not.toContain("Event-specific exposure mapping");
    expect(source).not.toContain("Show how exposure appears in your data");
    expect(source).not.toContain("noValidate");
    expect(source).toContain(
      "Can lower-level exposure be connected to each dataset unit?",
    );
    expect(source).toContain(
      "ShockAudit will not infer this from column names.",
    );
    expect(source).toContain("A complete crosswalk is available");
    expect(source).toContain(
      "Some dataset units contain both covered and uncovered lower-level units",
    );
    expect(source).toContain("assignmentCrosswalk:");
    expect(source).toContain("assignmentLowerLevelIdentifier:");
    expect(source).toContain("assignmentAggregateIdentifier:");
    expect(source).toContain(
      "Exact identifier for the unit covered by the shock",
    );
    expect(source).toContain(
      "Exact identifier connecting it to the dataset unit",
    );
    expect(source).toContain(
      "ShockAudit reads only these selected identifiers and does not guess a relationship from their names.",
    );
    expect(source).toContain(
      "Optional: compare one combined treatment package",
    );
    expect(source).toContain(
      "The selection never uses outcome values.",
    );
    expect(source).toContain("combinedExposureScenarios:");
  });

  it("binds remounted crosswalk choices to the persisted dataset profile", () => {
    const persisted = updateScreen04DatasetProfile(datasetState([]), {
      assignmentCrosswalkStatus: "complete",
      withinAggregateExposure: "mixed",
      fieldMappings: {
        assignmentLowerLevelIdentifier: "EstablishmentID",
        assignmentAggregateIdentifier: "GVKEY",
      },
    }, "2026-08-23T12:04:00.000Z");
    const remounted = restoreScreen04WorkflowState(
      JSON.parse(JSON.stringify(persisted)),
    );
    expect(remounted).not.toBeNull();
    expect(remounted!.sampleProfile.dataset).toMatchObject({
      assignmentCrosswalkStatus: "complete",
      withinAggregateExposure: "mixed",
      fieldMappings: {
        assignmentLowerLevelIdentifier: "EstablishmentID",
        assignmentAggregateIdentifier: "GVKEY",
      },
    });
    const source = readFileSync(
      new URL("../../src/ui/screen-04/Screen04.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain(
      "const assignmentCrosswalkStatus = dataset.assignmentCrosswalkStatus;",
    );
    expect(source).toContain(
      "const withinAggregateExposure = dataset.withinAggregateExposure;",
    );
    expect(source).toContain('data-testid="screen04-assignment-crosswalk-status"');
    expect(source).toContain('data-testid="screen04-within-aggregate-exposure"');
    expect(source).toContain(
      'data-testid="screen04-assignment-crosswalk-columns"',
    );
    expect(source).toMatch(
      /assignmentCrosswalkStatus:\s*event\.currentTarget\.value[\s\S]*?Screen04AssignmentCrosswalkStatus/u,
    );
    expect(source).toMatch(
      /withinAggregateExposure:\s*event\.currentTarget\.value[\s\S]*?Screen04WithinAggregateExposure/u,
    );
    expect(source).not.toContain("setAssignmentCrosswalkStatus");
    expect(source).not.toContain("setWithinAggregateExposure");

    const partial = updateScreen04DatasetProfile(remounted!, {
      assignmentCrosswalkStatus: "partial",
    }, "2026-08-23T12:05:00.000Z");
    expect(partial.sampleProfile.dataset.withinAggregateExposure).toBe(
      "unknown",
    );
    expect(source).toContain(
      '{assignmentCrosswalkStatus === "complete" && (',
    );
  });

  it("validates the bounded researcher-selected package without outcome data", () => {
    expect(screen04CombinedExposureScenarioInput({
      name: "  Implementation and enforcement  ",
      ruleIndexes: [2, 0],
    }, 3)).toEqual([{
      name: "Implementation and enforcement",
      ruleIndexes: [0, 2],
    }]);
    expect(screen04CombinedExposureScenarioInput({
      name: "One rule only",
      ruleIndexes: [0],
    }, 3)).toEqual([]);
    expect(screen04CombinedExposureScenarioInput({
      name: "Ninth total scenario",
      ruleIndexes: [0, 1],
    }, 8)).toEqual([]);

    const withExactCrosswalk = updateScreen04DatasetProfile(datasetState([]), {
      assignmentCrosswalkStatus: "partial",
      fieldMappings: {
        assignmentLowerLevelIdentifier: "EstablishmentID",
        assignmentAggregateIdentifier: "ParentFirmID",
      },
    }, "2026-08-23T12:04:00.000Z").sampleProfile.dataset;
    expect(screen04TransientHeaderReadiness(
      withExactCrosswalk,
      [
        "GVKEY",
        "Year",
        "ProposedGroup",
        "HeadquartersState",
        "CCPAApplicabilityStatus",
        "EstablishmentID",
        "ParentFirmID",
      ],
    ).ready).toBe(true);
    expect(screen04TransientHeaderReadiness(
      withExactCrosswalk,
      [
        "GVKEY",
        "Year",
        "ProposedGroup",
        "HeadquartersState",
        "CCPAApplicabilityStatus",
        "ParentFirmID",
      ],
    )).toEqual({ ready: false, missingMappings: ["CSV column mapping"] });
  });

  it("states neutrally when a completed assessment skipped coverage matching", () => {
    const html = render(datasetState([], [], null));

    expect(html).toContain(
      "Coverage matching was not included in this assessment.",
    );
    expect(html).not.toContain("Some exposure conditions are not mapped");
  });

  it("renders every nodata field, hides dataset controls, and preserves both drafts", () => {
    let state = updateScreen04DatasetProfile(initialState(), {
      description: { treatmentGroupDescription: "Preserved dataset draft" },
      fieldMappings: { unitIdentifier: "GVKEY" },
    }, "2026-08-23T12:01:00.000Z");
    state = switchScreen04Mode(state, "nodata", "2026-08-23T12:02:00.000Z");
    state = updateScreen04NodataProfile(state, {
      description: {
        unitOfAnalysis: "Firm-year",
        sampleUnits: "Public technology firms",
        dataFrequency: "annual",
        sampleStartYear: 2010,
        sampleEndYear: 2015,
        researcherTreatmentYear: 2013,
        treatmentGroupDescription: "Firms headquartered in California",
        controlGroupDescription: "Firms headquartered outside California",
        comparisonBasis: "geography",
        geographicConcept: "headquarters",
        datasetAssignmentUnit: "firm",
        shockAssignmentUnit: "facility",
      },
    }, "2026-08-23T12:03:00.000Z");

    const html = render(state);
    for (const label of [
      "Unit of analysis",
      "Sample units",
      "Data frequency",
      "Sample start year",
      "Sample end year",
      "Treatment year",
      "Treatment-group description",
      "Control-group description",
      "Main basis distinguishing the groups",
      "Geographic concept used for the groups",
    ]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("Upload a dataset instead");
    expect(html).toContain("Save this sample description and continue");
    expect(html).not.toContain('data-testid="screen04-file-input"');
    expect(html).not.toContain("Show how exposure appears in your data");
    expect(html).not.toContain('data-testid="screen04-results"');

    state = switchScreen04Mode(state, "dataset", "2026-08-23T12:04:00.000Z");
    expect(state.sampleProfile.dataset.description.treatmentGroupDescription)
      .toBe("Preserved dataset draft");
    expect(state.sampleProfile.dataset.fieldMappings.unitIdentifier).toBe("GVKEY");
    expect(state.sampleProfile.nodata.description.sampleStartYear).toBe(2010);
  });

  it("saves a nodata profile and states the current navigation boundary", () => {
    let state = switchScreen04Mode(
      initialState(),
      "nodata",
      "2026-08-23T12:01:00.000Z",
    );
    state = updateScreen04NodataProfile(state, {
      description: {
        unitOfAnalysis: "Firm-year",
        sampleUnits: "Public technology firms",
        dataFrequency: "annual",
        sampleStartYear: 2010,
        sampleEndYear: 2015,
        researcherTreatmentYear: 2013,
        treatmentGroupDescription: "Firms headquartered in California",
        controlGroupDescription: "Firms headquartered outside California",
        comparisonBasis: "geography",
        geographicConcept: "headquarters",
      },
    }, "2026-08-23T12:02:00.000Z");
    state = saveScreen04SampleProfile(state, "2026-08-23T12:03:00.000Z");

    const html = render(state);
    expect(html).toContain('data-testid="screen04-ready"');
    expect(html).toContain("Sample profile saved");
    expect(html).toContain("No later design screen is connected in this build");
  });

  it("restores a truthful judgment and caps the initially shown priority findings at five", () => {
    const findings = [
      finding(1, "Treatment definition", "high"),
      finding(2, "Timing", "high"),
      finding(3, "Comparison group", "medium"),
      finding(4, "Sample support", "medium"),
      finding(5, "Treatment variation", "review"),
      finding(6, "Sample support", "review"),
    ];
    const html = render(datasetState(findings));

    expect(html).toContain("Revise the treatment or comparison definition");
    expect(html.match(/data-testid="screen04-priority-finding"/gu)).toHaveLength(5);
    expect(html.match(/data-testid="screen04-other-finding"/gu)).toHaveLength(1);
    expect(html).toContain("Other points to review");
    expect(html).toContain("What ShockAudit found");
    expect(html).toContain("Why it matters");
    expect(html).toContain("Possible next step");
    expect(html).toContain("No automatic correction is recommended");
    for (const forbidden of forbiddenReaderStrings) {
      expect(html, forbidden).not.toContain(forbidden);
    }
  });

  it("persists and renders advanced severity, diagnostic question, and affected details", () => {
    const advancedFinding = {
      ...finding(1, "Comparison group", "high"),
      title: "The comparison group becomes exposed at the amendment stage",
      severity: "Major design concern",
      diagnosticTitle: "Does your control group remain untreated?",
      whereItOccurs: {
        details: [{
          scenarioName: "2022 amended coverage",
          unitIdentifier: "firm-17",
          year: 2022,
          treatmentStage: "amendment",
          proposedGroup: "comparison",
          auditedStatus: "exposed",
          reasonCategories: ["threshold", "timing"],
        }],
        truncatedDetailCount: 3,
      },
      code: "SCREEN04_ADVANCED_COMPARISON_SURVIVAL",
      consequenceOrder: 3,
      aggregate: {
        affectedObservations: 4,
        affectedUnits: 1,
        shareOfReferenceObservations: 0.25,
      },
    } satisfies Screen04ScientificFinding;
    const state = datasetState([advancedFinding]);
    const html = render(state);

    expect(state.sampleProfile.dataset.scientificFindings[0]).toEqual(
      advancedFinding,
    );
    expect(html).toContain("Major design concern");
    expect(html).toContain("Does your control group remain untreated?");
    expect(html).toContain("Where it occurs");
    expect(html).toContain("firm-17");
    expect(html).toContain("2022 amended coverage");
    expect(html).toContain("3 additional affected records");
    expect(html).toContain("Affected evidence:");
    expect(html).toContain("4 affected unit-period observations");
    expect(html).toContain("25% of the reference-scenario observations");
    expect(html).not.toContain("SCREEN04_ADVANCED");
  });

  it("does not invent a problem when a restored assessment has no findings", () => {
    const html = render(datasetState([]));

    expect(html).toContain("The proposed exposure design is broadly usable");
    expect(html).toContain(
      "No major exposure-design problem was identified by the available deterministic checks.",
    );
    expect(html).not.toContain("Review several exposure choices");
  });

  it("keeps unresolved researcher choices visible in the saved result", () => {
    const choice = "Confirm which verified event stage the treatment year represents.";
    const html = render(datasetState([], [choice]));

    expect(html).toContain("Review several exposure choices");
    expect(html).toContain("Choices to confirm");
    expect(html).toContain(choice);
    expect(html).not.toContain(
      "The proposed exposure design is broadly usable",
    );
  });

  it("does not show a prior assessment after a replacement CSV is attached", () => {
    let state = datasetState([finding(1, "Treatment definition", "high")]);
    expect(state.sampleProfile.dataset.assessment).not.toBeNull();
    state = attachScreen04Upload(state, {
      schemaVersion: "screen-04-upload-reference-v1",
      opaqueFileRef: "opaque:replacement-csv",
      csvFingerprint: "fnv1a64:7777777777777777",
      headerFingerprint: "fnv1a64:8888888888888888",
      byteLength: 2_048,
      headerCount: 9,
      uploadedAt: "2026-08-23T12:04:00.000Z",
      expiresAt: "2026-08-23T13:04:00.000Z",
    }, "2026-08-23T12:04:00.000Z");

    const html = render(state);
    expect(state.sampleProfile.dataset.assessment).toMatchObject({
      status: "stale",
      reason: "Your sample setup changed",
    });
    expect(state.sampleProfile.dataset.scientificFindings).toEqual([]);
    expect(state.sampleProfile.dataset.overallJudgment).toBeNull();
    expect(html).not.toContain('data-testid="screen04-saved-findings"');
    expect(html).not.toContain("Reader-facing finding 1");
    expect(html).toContain('data-testid="screen04-assessment-stale"');
    expect(html).toContain("Your sample setup changed");
    expect(html).toContain("Run the assessment again to update the findings.");
  });

  it("retires findings when the same CSV is explicitly selected again", () => {
    let state = datasetState([finding(1, "Treatment definition", "high")]);
    state = attachScreen04Upload(state, {
      schemaVersion: "screen-04-upload-reference-v1",
      opaqueFileRef: "opaque:same-csv-selected-again",
      csvFingerprint: "fnv1a64:5555555555555555",
      headerFingerprint: "fnv1a64:6666666666666666",
      byteLength: 1_024,
      headerCount: 8,
      uploadedAt: "2026-08-23T12:04:00.000Z",
      expiresAt: "2026-08-23T13:04:00.000Z",
    }, "2026-08-23T12:04:00.000Z");

    const html = render(state);
    expect(state.sampleProfile.dataset).toMatchObject({
      overallJudgment: null,
      scientificFindings: [],
      unresolvedResearcherChoices: [],
      assessment: {
        status: "stale",
        reason: "Your sample setup changed",
      },
    });
    expect(html).not.toContain("Reader-facing finding 1");
    expect(html).not.toContain('data-testid="screen04-saved-findings"');
  });

  it("requires every persisted column mapping to belong to the selected CSV", () => {
    const dataset = datasetState([]).sampleProfile.dataset;
    const exactHeaders = [
      "GVKEY",
      "Year",
      "ProposedGroup",
      "HeadquartersState",
      "CCPAApplicabilityStatus",
    ];

    expect(screen04TransientHeaderReadiness(dataset, exactHeaders)).toEqual({
      ready: true,
      missingMappings: [],
    });
    expect(screen04TransientHeaderReadiness(dataset, [
      "GVKEY",
      "year",
      "ProposedGroup",
      "HeadquartersState",
      "CCPAApplicabilityStatus",
    ])).toEqual({
      ready: false,
      missingMappings: ["CSV column mapping"],
    });
  });

  it("publishes a local assessment only after atomic workflow completion", () => {
    const completed = datasetState([]);
    const localResult = {
      metrics: { rowCount: 36 },
      setupIssues: [],
    } as unknown as Screen04ScientificAssessmentResult;
    const rerunning = beginScreen04ScientificAssessment(
      completed,
      "2026-08-23T12:04:00.000Z",
    );

    expect(screen04LocalAssessmentMayRender(completed, localResult)).toBe(true);
    expect(screen04LocalAssessmentMayRender(rerunning, localResult)).toBe(false);
    expect(rerunning.sampleProfile.dataset.assessment).toMatchObject({
      status: "stale",
      reason: "Assessment rerun started",
    });
    const rerunHtml = render(rerunning);
    expect(rerunHtml).not.toContain('data-testid="screen04-results"');
    expect(rerunHtml).not.toContain('data-testid="screen04-saved-findings"');
    expect(rerunHtml).not.toContain('data-testid="screen04-assessment-stale"');
  });

  it("keeps dataset findings absent until an explicit assessment completes", () => {
    let state = attachScreen04Upload(initialState(), {
      schemaVersion: "screen-04-upload-reference-v1",
      opaqueFileRef: "opaque:unassessed-csv",
      csvFingerprint: "fnv1a64:7777777777777777",
      headerFingerprint: "fnv1a64:8888888888888888",
      byteLength: 2_048,
      headerCount: 9,
      uploadedAt: "2026-08-23T12:01:00.000Z",
      expiresAt: "2026-08-23T13:01:00.000Z",
    }, "2026-08-23T12:01:00.000Z");
    state = updateScreen04DatasetProfile(state, {
      description: {
        unitOfAnalysis: "Firm-year",
        sampleUnits: "Public firms",
        dataFrequency: "annual",
        researcherTreatmentYear: 2020,
        treatmentGroupDescription: "Covered firms",
        controlGroupDescription: "Other firms",
        comparisonBasis: "legal-eligibility",
      },
      fieldMappings: {
        unitIdentifier: "GVKEY",
        annualTime: "Year",
        treatmentGroup: "ProposedGroup",
        treatedValue: "T",
        comparisonValue: "C",
      },
    }, "2026-08-23T12:02:00.000Z");

    const html = render(state);
    expect(state.status).toBe("ready-to-assess");
    expect(state.sampleProfile.dataset.assessment).toBeNull();
    expect(state.sampleProfile.dataset.scientificFindings).toEqual([]);
    expect(html).not.toContain('data-testid="screen04-results"');
    expect(html).not.toContain('data-testid="screen04-saved-findings"');
  });

  it("shows only a plain stale-state warning", () => {
    const stale = markScreen04WorkflowStale(
      initialState(),
      "fnv1a64:9999999999999999",
      "Internal binding metadata changed.",
      "2026-08-23T12:01:00.000Z",
    );
    const html = render(stale);

    expect(html).toContain("The verified shock changed");
    expect(html).toContain(
      "Review this sample again before relying on the earlier assessment.",
    );
    expect(html).toContain('data-testid="screen04-start-fresh"');
    expect(html).not.toContain("Internal binding metadata changed");
    expect(html).not.toContain('data-testid="screen04-file-input"');
  });

  it("invalidates a pending operation when the parent marks the workflow stale", () => {
    const current = initialState();
    const started = screen04OperationStateGuard(current);
    const stale = markScreen04WorkflowStale(
      current,
      "fnv1a64:9999999999999999",
      "Internal binding metadata changed.",
      "2026-08-23T12:01:00.000Z",
    );

    expect(screen04OperationStateIsCurrent(
      started,
      screen04OperationStateGuard(stale),
    )).toBe(false);
  });

  it("keeps setup errors field-local and file-input focus visible", () => {
    const source = readFileSync(
      new URL("../../src/ui/screen-04/Screen04.tsx", import.meta.url),
      "utf8",
    );
    const css = readFileSync(
      new URL("../../src/ui/screen-04/screen-04.css", import.meta.url),
      "utf8",
    );

    expect(source).toContain('data-testid="screen04-setup-message"');
    expect(source).not.toContain("Dataset setup messages");
    expect(source).toContain("treatmentGeographicValues");
    expect(source).toContain("controlGeographicValues");
    expect(source).toMatch(
      /function commitDataset[\s\S]*?cancelPendingOperation\(\)/u,
    );
    expect(source).toMatch(
      /function switchMode[\s\S]*?cancelPendingOperation\(\)/u,
    );
    expect(source).toContain("disabled={!canAssess}");
    expect(source).toContain('data-testid="screen04-action-bar"');
    expect(source).toContain('"Assess this dataset"');
    expect(css).toContain(".s4-file-button:has(input:focus-visible)");
    expect(css).toContain("outline: 3px solid");
    expect(css).toMatch(/\.s4-action-bar[\s\S]*?position: sticky/u);
    expect(css).toContain("bottom: calc(var(--s4-host-composer-clearance) + 2px)");
    expect(css).toContain("var(--host-safe-bottom, 0px)");
    expect(css).toContain("env(safe-area-inset-bottom, 0px)");
    expect(css).toContain("@media (max-height: 800px)");
    expect(css).toContain("scroll-margin-bottom");
  });

  it("compiles component and amendment conditions into reachable staged rules", () => {
    const mapping: Screen04DatasetExposureMapping = {
      approach: "conditions",
      combination: "all",
      conditions: [{
        id: "threshold",
        dimension: "threshold",
        stageGroup: null,
        kind: "numeric-threshold",
        column: "Revenue2017M",
        operator: ">=",
        value: 25,
        unit: "USD millions",
        sourceUnit: "USD",
        historicalYear: 2017,
        mappedHistoricalYear: 2018,
        historicalValueSource: "column-values",
        effectiveYear: 2020,
        nestedAnyGroup: [{
          id: "volume",
          column: "DataVolumeThousands",
          operator: ">=",
          threshold: 50,
          unit: "thousands",
          sourceUnit: "thousands",
          historicalYear: 2017,
          mappedHistoricalYear: 2017,
          historicalValueSource: "column-values",
        }],
      }, {
        id: "later-component",
        dimension: "treatment-component",
        stageGroup: "Later package",
        kind: "categorical-equals",
        column: "LaterComponent",
        operator: null,
        value: "covered",
        unit: null,
        sourceUnit: null,
        historicalYear: null,
        mappedHistoricalYear: null,
        historicalValueSource: "column-values",
        effectiveYear: 2021,
        nestedAnyGroup: [],
      }, {
        id: "amended-version",
        dimension: "amendment-version",
        stageGroup: "2022 amendment",
        kind: "categorical-equals",
        column: "AmendedCoverage",
        operator: null,
        value: "yes",
        unit: null,
        sourceUnit: null,
        historicalYear: null,
        mappedHistoricalYear: null,
        historicalValueSource: "column-values",
        effectiveYear: 2022,
        nestedAnyGroup: [],
      }, {
        id: "later-component-size",
        dimension: "treatment-component",
        stageGroup: "Later package",
        kind: "numeric-threshold",
        column: "LaterComponentSize",
        operator: ">=",
        value: 10,
        unit: "employees",
        sourceUnit: "employees",
        historicalYear: null,
        mappedHistoricalYear: null,
        historicalValueSource: "column-values",
        effectiveYear: 2021,
        nestedAnyGroup: [],
      }, {
        id: "later-implementation",
        dimension: "implementation-stage",
        stageGroup: "Later package",
        kind: "categorical-equals",
        column: "LaterImplementation",
        operator: null,
        value: "active",
        unit: null,
        sourceUnit: null,
        historicalYear: null,
        mappedHistoricalYear: null,
        historicalValueSource: "column-values",
        effectiveYear: null,
        nestedAnyGroup: [],
      }, {
        id: "later-timing",
        dimension: "implementation-stage",
        stageGroup: "Later package",
        kind: "effective-year",
        column: null,
        operator: null,
        value: null,
        unit: null,
        sourceUnit: null,
        historicalYear: null,
        mappedHistoricalYear: null,
        historicalValueSource: "column-values",
        effectiveYear: 2021,
        nestedAnyGroup: [],
      }, {
        id: "enforcement-stage",
        dimension: "implementation-stage",
        stageGroup: "Enforcement stage",
        kind: "categorical-equals",
        column: "EnforcementCoverage",
        operator: null,
        value: "yes",
        unit: null,
        sourceUnit: null,
        historicalYear: null,
        mappedHistoricalYear: null,
        historicalValueSource: "column-values",
        effectiveYear: 2023,
        nestedAnyGroup: [],
      }, {
        id: "independent-component",
        dimension: "treatment-component",
        stageGroup: "Independent component",
        kind: "categorical-equals",
        column: "IndependentCoverage",
        operator: null,
        value: "yes",
        unit: null,
        sourceUnit: null,
        historicalYear: null,
        mappedHistoricalYear: null,
        historicalValueSource: "column-values",
        effectiveYear: 2021,
        nestedAnyGroup: [],
      }],
    };

    const compiled = screen04CompileExposureRules(mapping, 2020);
    expect(compiled.exposureRule).toMatchObject({
      approach: "conditions",
      effectiveYear: 2020,
      thresholdMeasurements: [
        {
          csvColumn: "Revenue2017M",
          threshold: 25,
          thresholdUnit: "USD millions",
          sourceUnit: "USD",
          requiredHistoricalMeasurementYear: 2017,
          mappedHistoricalMeasurementYear: 2018,
        },
        { csvColumn: "DataVolumeThousands", threshold: 50 },
      ],
    });
    expect(compiled.additionalExposureRules).toHaveLength(4);
    expect(compiled.additionalExposureRules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        effectiveYear: 2021,
        component: "Later package",
        expression: expect.objectContaining({
          kind: "all",
          rules: expect.arrayContaining([
            expect.objectContaining({ csvColumn: "LaterComponent" }),
            expect.objectContaining({ csvColumn: "LaterComponentSize" }),
            expect.objectContaining({ csvColumn: "LaterImplementation" }),
          ]),
        }),
      }),
      expect.objectContaining({
        effectiveYear: 2022,
        version: "2022 amendment",
      }),
      expect.objectContaining({
        effectiveYear: 2023,
        component: "Enforcement stage",
      }),
      expect.objectContaining({
        effectiveYear: 2021,
        component: "Independent component",
      }),
    ]));
  });

  it("keeps an incomplete numeric condition incomplete instead of changing its meaning", () => {
    const compiled = screen04CompileExposureRules({
      approach: "conditions",
      combination: "all",
      conditions: [{
        id: "unfinished-threshold",
        dimension: "threshold",
        stageGroup: null,
        kind: "numeric-threshold",
        column: "Revenue",
        operator: ">=",
        value: 25,
        unit: null,
        sourceUnit: null,
        historicalYear: null,
        mappedHistoricalYear: null,
        historicalValueSource: "column-values",
        effectiveYear: 2020,
        nestedAnyGroup: [],
      }],
    }, 2020);

    expect(compiled.exposureRule).toMatchObject({
      approach: "conditions",
      expression: {
        kind: "categorical-equals",
        csvColumn: "",
        value: "",
      },
    });
  });
});
