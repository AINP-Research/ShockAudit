import { describe, expect, it } from "vitest";

import { fingerprintScreen03Value } from "../../src/core/screen03-workflow";
import {
  SCREEN_04_EVENT_CARD_BINDING_SCHEMA_VERSION,
  type Screen04EventCardBinding,
} from "../../src/core/screen04-event-card-binding";
import {
  buildScreen04SampleProfileHandoff,
  createScreen04SampleProfile,
  recordScreen04DatasetAssessment,
  requireScreen04SampleProfile,
  restoreScreen04SampleProfile,
  saveScreen04ActiveSampleProfile,
  screen04NodataConsistencyFindings,
  switchScreen04SampleProfileMode,
  updateScreen04DatasetSampleProfile,
  updateScreen04NodataSampleProfile,
  type Screen04DatasetProfilePatch,
} from "../../src/core/screen04-sample-profile";

function binding(): Screen04EventCardBinding {
  const enactment = {
    proposalId: "enactment",
    label: "Enactment",
    stage: "enactment" as const,
    proposedDate: "2018-06-28",
    resolvedDate: "2018-06-28",
    sourceIds: ["official-source"],
    passageIds: ["official-enactment"],
  };
  const effective = {
    proposalId: "effective",
    label: "Main obligations begin",
    stage: "effective" as const,
    proposedDate: "2020-01-01",
    resolvedDate: "2020-01-01",
    sourceIds: ["official-source"],
    passageIds: ["official-effective"],
  };
  const input = {
    schemaVersion: SCREEN_04_EVENT_CARD_BINDING_SCHEMA_VERSION,
    screen02: {
      runId: "screen02-run",
      mode: "audit" as const,
      selectedEventId: "ccpa",
      selectedEventFingerprint: "fnv1a64:1111111111111111",
      handoffFingerprint: "fnv1a64:2222222222222222",
    },
    screen03: {
      runId: "screen03-run",
      stateFingerprint: "fnv1a64:3333333333333333",
    },
    eventCard: {
      id: "screen03:screen03-run:event-card",
      version: "locked-at:2026-08-23T12:00:00.000Z",
      fingerprint: "fnv1a64:4444444444444444",
      lockedAt: "2026-08-23T12:00:00.000Z",
    },
    verifiedShockName: "California Consumer Privacy Act",
    verifiedTimeline: [enactment, effective],
    focalClock: { selected: null, alternatives: [enactment, effective] },
    assignmentUnit: [],
    geographicCoverage: [],
    eligibilityConditions: [],
    thresholds: [],
    exemptions: [],
    treatmentComponents: [],
    amendmentsAndVersions: [],
    exposureDimensions: [{
      id: "screen04-exposure-geography" as const,
      kind: "geography" as const,
      label: "Geographic coverage",
      summary: "Doing business in California",
      claimIds: ["coverage"],
      evidenceIds: ["official-source"],
    }],
    unresolvedLimitations: {
      gaps: [],
      unknownProposalIds: [],
      rejectedProposalIds: [],
      unsupportedProposalIds: [],
      uncertainties: [],
    },
    compilerLimitations: [],
    linkedEvidenceIds: ["official-source"],
  };
  return {
    ...input,
    bindingFingerprint: fingerprintScreen03Value(input),
  };
}

const completeDescription = {
  unitOfAnalysis: "Firm-year",
  sampleUnits: "Public technology firms",
  dataFrequency: "Annual",
  sampleStartYear: 2010,
  sampleEndYear: 2015,
  researcherTreatmentYear: 2013,
  treatmentGroupDescription: "Firms headquartered in California",
  controlGroupDescription: "Firms headquartered outside California",
  comparisonBasis: "geography" as const,
  geographicConcept: "headquarters" as const,
  shockGeographicConcept: "operating-location" as const,
  datasetAssignmentUnit: "firm" as const,
  shockAssignmentUnit: "establishment" as const,
};

describe("Screen 4 common sample profile", () => {
  it("persists bounded assignment-crosswalk facts and restores legacy defaults", () => {
    const bound = binding();
    const created = createScreen04SampleProfile(
      bound,
      "2026-08-23T12:00:00.000Z",
    );
    expect(created.dataset).toMatchObject({
      fieldMappings: {
        assignmentLowerLevelIdentifier: null,
        assignmentAggregateIdentifier: null,
      },
      combinedExposureScenario: null,
      assignmentCrosswalkStatus: "unknown",
      withinAggregateExposure: "unknown",
    });

    let profile = updateScreen04DatasetSampleProfile(created, {
      description: completeDescription,
    }, "2026-08-23T12:01:00.000Z");
    profile = updateScreen04DatasetSampleProfile(profile, {
      assignmentCrosswalkStatus: "complete",
      withinAggregateExposure: "mixed",
      fieldMappings: {
        assignmentLowerLevelIdentifier: "EstablishmentID",
        assignmentAggregateIdentifier: "GVKEY",
      },
    }, "2026-08-23T12:02:00.000Z");
    expect(requireScreen04SampleProfile(profile).dataset).toMatchObject({
      assignmentCrosswalkStatus: "complete",
      withinAggregateExposure: "mixed",
      fieldMappings: {
        assignmentLowerLevelIdentifier: "EstablishmentID",
        assignmentAggregateIdentifier: "GVKEY",
      },
    });

    profile = updateScreen04DatasetSampleProfile(profile, {
      assignmentCrosswalkStatus: "partial",
    }, "2026-08-23T12:03:00.000Z");
    expect(profile.dataset).toMatchObject({
      assignmentCrosswalkStatus: "partial",
      withinAggregateExposure: "unknown",
      fieldMappings: {
        assignmentLowerLevelIdentifier: "EstablishmentID",
        assignmentAggregateIdentifier: "GVKEY",
      },
    });

    const withoutCrosswalk = updateScreen04DatasetSampleProfile(profile, {
      assignmentCrosswalkStatus: "missing",
    }, "2026-08-23T12:03:30.000Z");
    expect(withoutCrosswalk.dataset.fieldMappings).toMatchObject({
      assignmentLowerLevelIdentifier: null,
      assignmentAggregateIdentifier: null,
    });

    const legacy = JSON.parse(JSON.stringify(created)) as Record<string, unknown>;
    const legacyDataset = legacy.dataset as Record<string, unknown>;
    const legacyFieldMappings = legacyDataset.fieldMappings as Record<
      string,
      unknown
    >;
    delete legacyFieldMappings.assignmentLowerLevelIdentifier;
    delete legacyFieldMappings.assignmentAggregateIdentifier;
    delete legacyDataset.combinedExposureScenario;
    delete legacyDataset.assignmentCrosswalkStatus;
    delete legacyDataset.withinAggregateExposure;
    delete legacy.integrity;
    legacy.integrity = {
      profileFingerprint: fingerprintScreen03Value(legacy),
    };
    expect(restoreScreen04SampleProfile(legacy)?.dataset).toMatchObject({
      fieldMappings: {
        assignmentLowerLevelIdentifier: null,
        assignmentAggregateIdentifier: null,
      },
      combinedExposureScenario: null,
      assignmentCrosswalkStatus: "unknown",
      withinAggregateExposure: "unknown",
    });

    const incompleteLegacy = JSON.parse(JSON.stringify(created)) as Record<
      string,
      unknown
    >;
    delete (incompleteLegacy.dataset as Record<string, unknown>)
      .withinAggregateExposure;
    delete incompleteLegacy.integrity;
    incompleteLegacy.integrity = {
      profileFingerprint: fingerprintScreen03Value(incompleteLegacy),
    };
    expect(restoreScreen04SampleProfile(incompleteLegacy)).toBeNull();
  });

  it("carries the selected combined exposure scenario only for dataset handoffs", () => {
    let profile = createScreen04SampleProfile(
      binding(),
      "2026-08-23T12:00:00.000Z",
    );
    profile = updateScreen04DatasetSampleProfile(profile, {
      combinedExposureScenario: {
        name: "Implementation plus threshold",
        ruleIndexes: [0, 2],
      },
    }, "2026-08-23T12:01:00.000Z");

    expect(buildScreen04SampleProfileHandoff(profile)).toMatchObject({
      mode: "dataset",
      combinedExposureScenario: {
        name: "Implementation plus threshold",
        ruleIndexes: [0, 2],
      },
    });

    const remapped = updateScreen04DatasetSampleProfile(profile, {
      exposureMapping: {
        approach: "coverage-variable",
        column: "Covered",
        coveredValue: "Yes",
      },
    }, "2026-08-23T12:01:30.000Z");
    expect(remapped.dataset.combinedExposureScenario).toBeNull();

    profile = switchScreen04SampleProfileMode(
      profile,
      "nodata",
      "2026-08-23T12:02:00.000Z",
    );
    expect(buildScreen04SampleProfileHandoff(profile)).toMatchObject({
      mode: "nodata",
      combinedExposureScenario: null,
    });
  });

  it("preserves independent dataset and nodata work through reversible switches", () => {
    const bound = binding();
    let profile = createScreen04SampleProfile(
      bound,
      "2026-08-23T12:00:00.000Z",
    );
    profile = updateScreen04DatasetSampleProfile(profile, {
      description: completeDescription,
      fieldMappings: {
        unitIdentifier: "GVKEY",
        annualTime: "Year",
        treatmentGroup: "ProposedGroup",
        treatedValue: "T",
        comparisonValue: "C",
        geography: "HeadquartersState",
        treatmentGeographicValues: "CA",
        controlGeographicValues: "NV, OR, WA",
      },
      exposureMapping: {
        approach: "coverage-variable",
        column: "CCPAApplicabilityStatus",
        coveredValue: "Eligible",
      },
    }, "2026-08-23T12:01:00.000Z");
    profile = switchScreen04SampleProfileMode(
      profile,
      "nodata",
      "2026-08-23T12:02:00.000Z",
    );
    profile = updateScreen04NodataSampleProfile(profile, bound, {
      description: {
        ...completeDescription,
        sampleUnits: "Manually described firms",
      },
    }, "2026-08-23T12:03:00.000Z");
    profile = switchScreen04SampleProfileMode(
      profile,
      "dataset",
      "2026-08-23T12:04:00.000Z",
    );

    expect(profile.dataset).toMatchObject({
      description: { sampleUnits: "Public technology firms" },
      fieldMappings: {
        unitIdentifier: "GVKEY",
        treatmentGeographicValues: "CA",
      },
      exposureMapping: {
        approach: "coverage-variable",
        column: "CCPAApplicabilityStatus",
      },
    });
    expect(profile.nodata.description.sampleUnits).toBe(
      "Manually described firms",
    );
    expect(requireScreen04SampleProfile(profile)).toEqual(profile);
  });

  it("produces direct nodata timing checks and a stable saved handoff", () => {
    const bound = binding();
    const findings = screen04NodataConsistencyFindings(bound, {
      ...completeDescription,
      sampleStartYear: 2020,
      sampleEndYear: 2020,
      researcherTreatmentYear: 2019,
    });
    expect(findings.map((finding) => finding.title)).toEqual(
      expect.arrayContaining([
        "The treatment year precedes the sample",
        "More than one verified event date may matter",
        "The selected treatment year differs from the verified dates",
        "The shock has a possible anticipation period",
      ]),
    );
    expect(JSON.stringify(findings)).not.toMatch(/SCREEN04_|proposal|evidence/iu);

    let profile = createScreen04SampleProfile(
      bound,
      "2026-08-23T12:00:00.000Z",
    );
    profile = switchScreen04SampleProfileMode(
      profile,
      "nodata",
      "2026-08-23T12:01:00.000Z",
    );
    profile = updateScreen04NodataSampleProfile(
      profile,
      bound,
      { description: completeDescription },
      "2026-08-23T12:02:00.000Z",
    );
    expect(profile.nodata.completion.status).toBe("ready");
    profile = saveScreen04ActiveSampleProfile(
      profile,
      "2026-08-23T12:03:00.000Z",
    );
    const handoff = buildScreen04SampleProfileHandoff(profile);
    expect(handoff).toMatchObject({
      schemaVersion: "screen-04-sample-profile-v1",
      mode: "nodata",
      description: { unitOfAnalysis: "Firm-year" },
      datasetFieldMappings: null,
      exposureMapping: null,
      completionStatus: "saved",
    });
    expect(JSON.stringify(handoff)).not.toContain("rawRows");
  });

  it("rejects tampering, raw-row additions, and more than eight conditions", () => {
    const bound = binding();
    const profile = createScreen04SampleProfile(
      bound,
      "2026-08-23T12:00:00.000Z",
    );
    const raw = JSON.parse(JSON.stringify(profile)) as Record<string, unknown>;
    raw.rawRows = [{ GVKEY: "secret" }];
    expect(restoreScreen04SampleProfile(raw)).toBeNull();

    const tampered = JSON.parse(JSON.stringify(profile)) as {
      internalBinding: { verifiedShockName: string };
    };
    tampered.internalBinding.verifiedShockName = "Changed without fingerprint";
    expect(restoreScreen04SampleProfile(tampered)).toBeNull();

    expect(() => updateScreen04DatasetSampleProfile(profile, {
      exposureMapping: {
        approach: "conditions",
        combination: "all",
        conditions: Array.from({ length: 9 }, (_unused, index) => ({
          id: `condition-${index + 1}`,
          dimension: "threshold" as const,
          stageGroup: null,
          kind: "numeric-threshold" as const,
          column: "Revenue",
          operator: ">=" as const,
          value: 25_000_000,
          unit: "USD",
          sourceUnit: "USD",
          historicalYear: 2017,
          mappedHistoricalYear: 2017,
          historicalValueSource: "column-values" as const,
          effectiveYear: 2020,
          nestedAnyGroup: [],
        })),
      },
    }, "2026-08-23T12:01:00.000Z")).toThrow(/Exposure-condition mapping/u);
  });

  it("permits completion only through a current atomic assessment record", () => {
    let profile = createScreen04SampleProfile(
      binding(),
      "2026-08-23T12:00:00.000Z",
    );
    profile = updateScreen04DatasetSampleProfile(profile, {
      description: completeDescription,
      fieldMappings: {
        unitIdentifier: "GVKEY",
        annualTime: "Year",
        treatmentGroup: "ProposedGroup",
        treatedValue: "T",
        comparisonValue: "C",
      },
    }, "2026-08-23T12:01:00.000Z");

    expect(profile.dataset.completion.status).toBe("incomplete");
    expect(() => saveScreen04ActiveSampleProfile(
      profile,
      "2026-08-23T12:02:00.000Z",
      {
        csvFingerprint: "sha256:current-csv",
        assessmentInputFingerprint: "fnv1a64:1111111111111111",
      },
    )).toThrow(/current dataset assessment/u);
    expect(() => updateScreen04DatasetSampleProfile(
      profile,
      {
        completion: { status: "saved", savedAt: "2026-08-23T12:02:00.000Z" },
        scientificFindings: [],
      } as unknown as Screen04DatasetProfilePatch,
      "2026-08-23T12:02:00.000Z",
    )).toThrow(/unexpected fields/u);

    profile = recordScreen04DatasetAssessment(profile, {
      overallJudgment: "The proposed exposure design is broadly usable",
      // A clean assessment is complete even when there is nothing to flag.
      scientificFindings: [],
      unresolvedResearcherChoices: [],
      provenance: {
        status: "completed",
        csvFingerprint: "sha256:current-csv",
        assessmentInputFingerprint: "fnv1a64:1111111111111111",
        assessedAt: "2026-08-23T12:02:00.000Z",
      },
    }, "2026-08-23T12:02:00.000Z");
    expect(profile.dataset).toMatchObject({
      overallJudgment: "The proposed exposure design is broadly usable",
      scientificFindings: [],
      completion: { status: "ready", savedAt: null },
      assessment: { status: "completed" },
    });
    expect(() => saveScreen04ActiveSampleProfile(
      profile,
      "2026-08-23T12:03:00.000Z",
      {
        csvFingerprint: "sha256:different-csv",
        assessmentInputFingerprint: "fnv1a64:1111111111111111",
      },
    )).toThrow(/no longer current/u);

    profile = saveScreen04ActiveSampleProfile(
      profile,
      "2026-08-23T12:03:00.000Z",
      {
        csvFingerprint: "sha256:current-csv",
        assessmentInputFingerprint: "fnv1a64:1111111111111111",
      },
    );
    expect(buildScreen04SampleProfileHandoff(profile)).toMatchObject({
      overallJudgment: "The proposed exposure design is broadly usable",
      scientificFindings: [],
      assessment: {
        csvFingerprint: "sha256:current-csv",
        assessmentInputFingerprint: "fnv1a64:1111111111111111",
      },
      completionStatus: "saved",
    });

    profile = updateScreen04DatasetSampleProfile(profile, {
      description: { sampleUnits: "A revised sample" },
    }, "2026-08-23T12:04:00.000Z");
    expect(profile.dataset).toMatchObject({
      overallJudgment: null,
      scientificFindings: [],
      unresolvedResearcherChoices: [],
      assessment: {
        status: "stale",
        reason: "Your sample setup changed",
      },
      completion: { status: "incomplete", savedAt: null },
    });
  });

  it("restores bounded advanced finding codes, ordering, and aggregate evidence", () => {
    let profile = createScreen04SampleProfile(
      binding(),
      "2026-08-23T12:00:00.000Z",
    );
    profile = updateScreen04DatasetSampleProfile(profile, {
      description: completeDescription,
      fieldMappings: {
        unitIdentifier: "GVKEY",
        annualTime: "Year",
        treatmentGroup: "ProposedGroup",
        treatedValue: "T",
        comparisonValue: "C",
      },
    }, "2026-08-23T12:01:00.000Z");
    profile = recordScreen04DatasetAssessment(profile, {
      overallJudgment: "Revise the treatment or comparison definition",
      scientificFindings: [{
        category: "Treatment definition",
        title: "Proposed coding disagrees with verified coverage",
        whatFound: "2 observations across 1 unit disagree.",
        whyItMatters: "The proposed groups do not represent coverage.",
        possibleNextStep: "Review the listed unit.",
        priority: "high",
        severity: "Major design concern",
        diagnosticTitle:
          "Why does your treatment coding differ from the shock rules?",
        code: "SCREEN04_ADVANCED_PROPOSED_CODING_DISAGREEMENT",
        consequenceOrder: 2,
        aggregate: {
          affectedObservations: 2,
          affectedUnits: 1,
          shareOfReferenceObservations: 0.25,
        },
        whereItOccurs: {
          details: [{
            scenarioName: "Original coverage",
            unitIdentifier: "FIRM-1",
            year: 2020,
            treatmentStage: "implementation",
            proposedGroup: "treated",
            auditedStatus: "unexposed",
            reasonCategories: ["threshold"],
          }],
          truncatedDetailCount: 0,
        },
      }],
      unresolvedResearcherChoices: [],
      provenance: {
        status: "completed",
        csvFingerprint: "sha256:current-csv",
        assessmentInputFingerprint: "fnv1a64:1111111111111111",
        assessedAt: "2026-08-23T12:02:00.000Z",
      },
    }, "2026-08-23T12:02:00.000Z");

    const restored = restoreScreen04SampleProfile(
      JSON.parse(JSON.stringify(profile)),
    );
    expect(restored?.dataset.scientificFindings[0]).toMatchObject({
      code: "SCREEN04_ADVANCED_PROPOSED_CODING_DISAGREEMENT",
      consequenceOrder: 2,
      aggregate: {
        affectedObservations: 2,
        affectedUnits: 1,
        shareOfReferenceObservations: 0.25,
      },
    });
  });
});
