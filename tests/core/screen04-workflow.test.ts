import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { fingerprintScreen03Value } from "../../src/core/screen03-workflow";
import { screen04CompileExposureRules } from "../../src/ui/screen-04/Screen04";
import {
  fingerprintScreen04Headers,
  inspectScreen04CsvHeader,
  runScreen04FeasibilitySlice,
} from "../../src/core/screen04-feasibility";
import {
  SCREEN_04_EVENT_CARD_BINDING_SCHEMA_VERSION,
  type Screen04EventCardBinding,
} from "../../src/core/screen04-event-card-binding";
import { runScreen04ScientificAssessment } from "../../src/core/screen04-scientific-assessment";
import {
  attachScreen04Upload,
  beginScreen04ScientificAssessment,
  createScreen04WorkflowState,
  mapScreen04Columns,
  markScreen04WorkflowStale,
  recordScreen04Calculation,
  recordScreen04ScientificAssessment,
  reconcileScreen04EventCardBinding,
  requireScreen04WorkflowState,
  restoreScreen04WorkflowState,
  saveScreen04SampleProfile,
  screen04AssessmentInputFingerprint,
  screen04DefaultTimelineProposalId,
  serializeScreen04WorkflowState,
  switchScreen04Mode,
  updateScreen04DatasetProfile,
  updateScreen04NodataProfile,
  SCREEN_04_LEGACY_RELEASE_LABEL,
  SCREEN_04_LEGACY_WORKFLOW_SCHEMA_VERSION,
  SCREEN_04_RELEASE_LABEL,
  SCREEN_04_WORKFLOW_SCHEMA_VERSION,
  type Screen04CalculationRecord,
  type Screen04WorkflowMappings,
} from "../../src/core/screen04-workflow";

function binding(overrides: Partial<Screen04EventCardBinding> = {}) {
  const base = {
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
      version: "locked-at:2026-08-23T12:00:00.000Z",
      fingerprint: "fnv1a64:4444444444444444",
      lockedAt: "2026-08-23T12:00:00.000Z",
    },
    verifiedShockName: "Verified shock",
    verifiedTimeline: [{
      proposalId: "effective-date",
      label: "Effective date",
      stage: "effective" as const,
      proposedDate: "2020-01-01",
      resolvedDate: "2020-01-01",
      sourceIds: ["official-source"],
      passageIds: ["official-passage"],
    }],
    focalClock: {
      selected: {
        proposalId: "effective-date",
        label: "Effective date",
        stage: "effective" as const,
        proposedDate: "2020-01-01",
        resolvedDate: "2020-01-01",
        sourceIds: ["official-source"],
        passageIds: ["official-passage"],
      },
      alternatives: [],
    },
    assignmentUnit: [],
    geographicCoverage: [],
    eligibilityConditions: [],
    thresholds: [],
    exemptions: [],
    treatmentComponents: [],
    amendmentsAndVersions: [],
    exposureDimensions: [],
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
  const merged = { ...base, ...overrides } as Omit<
    Screen04EventCardBinding,
    "bindingFingerprint"
  >;
  return {
    ...merged,
    bindingFingerprint: fingerprintScreen03Value(merged),
  } as Screen04EventCardBinding;
}

const headers = ["GVKEY", "year", "treated", "operating_state", "secret_outcome"];
const csv = [
  headers.join(","),
  "001,2019,1,CA,private-a",
  "001,2020,1,CA,private-b",
  "002,2019,0,NV,private-c",
  "002,2020,0,NV,private-d",
].join("\n");

const mappings: Screen04WorkflowMappings = {
  structure: {
    unitIdentifier: "GVKEY",
    year: "year",
    treatmentGroup: "treated",
    researcherTreatmentYear: 2020,
    treatedValue: "1",
    comparisonValue: "0",
  },
  verifiedTimelineProposalId: "effective-date",
  optional: {
    organizationName: null,
    existingPostPeriod: null,
    existingUnitPeriodTreatment: null,
  },
  eventRequirements: {
    "operating-location": "operating_state",
  },
};

function exportRefs(): Screen04CalculationRecord["exports"] {
  const expiresAt = "2026-08-23T14:00:00.000Z";
  return {
    auditedExposure: {
      opaqueFileRef: "export-audited",
      fingerprint: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      filename: "shockaudit-screen04-audited-exposure.csv",
      expiresAt,
    },
    affectedCases: {
      opaqueFileRef: "export-affected",
      fingerprint: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      filename: "shockaudit-screen04-affected-cases.csv",
      expiresAt,
    },
    auditReport: {
      opaqueFileRef: "export-report",
      fingerprint: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      filename: "shockaudit-screen04-exposure-audit.json",
      expiresAt,
    },
  };
}

describe("Screen 4 versioned workflow state", () => {
  it("stores opaque upload metadata and selected mappings but never all CSV headers", async () => {
    const bound = binding();
    let state = createScreen04WorkflowState(
      bound,
      "screen04-run",
      "2026-08-23T12:01:00.000Z",
    );
    expect(screen04DefaultTimelineProposalId(bound)).toBe("effective-date");
    const result = await runScreen04FeasibilitySlice({
      csvText: csv,
      mappings: mappings.structure,
      eventCard: {
        eventCardId: bound.eventCard.id,
        eventCardVersion: bound.eventCard.version,
        eventCardFingerprint: bound.eventCard.fingerprint,
        verifiedShockName: bound.verifiedShockName,
        rule: {
          kind: "categorical-equals",
          ruleId: "operating-location",
          requirementLabel: "Operates in California",
          csvColumn: "operating_state",
          exposedValue: "CA",
          exposureStartYear: 2020,
          exposureComponent: "duty",
          exposureVersion: "original",
          evidenceIds: ["official-source"],
        },
      },
    });
    state = attachScreen04Upload(state, {
      schemaVersion: "screen-04-upload-reference-v1",
      opaqueFileRef: "opaque-upload-token",
      csvFingerprint: result.publicResult.csvFingerprint,
      headerFingerprint: fingerprintScreen04Headers(headers),
      byteLength: new TextEncoder().encode(csv).byteLength,
      headerCount: headers.length,
      uploadedAt: "2026-08-23T12:02:00.000Z",
      expiresAt: "2026-08-23T14:00:00.000Z",
    }, "2026-08-23T12:02:00.000Z");
    state = mapScreen04Columns(
      state,
      mappings,
      headers,
      "2026-08-23T12:03:00.000Z",
    );
    state = recordScreen04Calculation(
      state,
      result.publicResult,
      exportRefs(),
      "2026-08-23T12:04:00.000Z",
    );

    expect(state.status).toBe("mapping-incomplete");
    expect(requireScreen04WorkflowState(state)).toEqual(state);
    const calculatedFingerprint = state.calculation!.resultFingerprint;
    state = markScreen04WorkflowStale(
      state,
      null,
      "Screen 3 no longer has a locked Event Card.",
      "2026-08-23T12:05:00.000Z",
    );
    expect(state).toMatchObject({
      status: "stale",
      calculation: { resultFingerprint: calculatedFingerprint },
      stale: { currentEventCardFingerprint: null },
    });
    expect(state.mappings).not.toBeNull();
    expect(requireScreen04WorkflowState(state)).toEqual(state);
    const serialized = serializeScreen04WorkflowState(state);
    expect(serialized).toContain("opaque-upload-token");
    expect(serialized).toContain("operating_state");
    expect(serialized).not.toContain("secret_outcome");
    expect(serialized).not.toContain("private-a");
    expect(serialized).not.toContain("unit_id,time");
  });

  it("blocks case changes and timeline choices absent from the locked Event Card", () => {
    let state = createScreen04WorkflowState(
      binding(),
      "screen04-run",
      "2026-08-23T12:01:00.000Z",
    );
    state = attachScreen04Upload(state, {
      schemaVersion: "screen-04-upload-reference-v1",
      opaqueFileRef: "opaque-upload-token",
      csvFingerprint: "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      headerFingerprint: fingerprintScreen04Headers(headers),
      byteLength: 100,
      headerCount: headers.length,
      uploadedAt: "2026-08-23T12:02:00.000Z",
      expiresAt: "2026-08-23T14:00:00.000Z",
    }, "2026-08-23T12:02:00.000Z");
    expect(() => mapScreen04Columns(state, {
      ...mappings,
      structure: { ...mappings.structure, unitIdentifier: "gvkey" },
    }, headers, "2026-08-23T12:03:00.000Z")).toThrow(/case-sensitive/u);
    expect(() => mapScreen04Columns(state, {
      ...mappings,
      verifiedTimelineProposalId: "announcement-date",
    }, headers, "2026-08-23T12:03:00.000Z")).toThrow(/locked Event Card/u);
    expect(() => mapScreen04Columns(
      state,
      mappings,
      headers,
      "2026-08-23T14:00:00.000Z",
    )).toThrow(/temporary Screen 4 file reference expired/u);
  });

  it("preserves work across context-only refreshes and marks an Event Card change stale", () => {
    const initial = binding();
    let state = createScreen04WorkflowState(
      initial,
      "screen04-run",
      "2026-08-23T12:01:00.000Z",
    );
    const contextInput = {
      ...initial,
      screen03: {
        ...initial.screen03,
        stateFingerprint: "fnv1a64:9999999999999999",
      },
      bindingFingerprint: undefined,
    };
    const { bindingFingerprint: _discard, ...contextWithoutFingerprint } = contextInput;
    const contextOnly = {
      ...contextWithoutFingerprint,
      bindingFingerprint: fingerprintScreen03Value(contextWithoutFingerprint),
    } as Screen04EventCardBinding;
    state = reconcileScreen04EventCardBinding(
      state,
      contextOnly,
      "2026-08-23T12:02:00.000Z",
    );
    expect(state.status).toBe("no-file");
    expect(state.stale.isStale).toBe(false);

    const changedInput = {
      ...contextOnly,
      eventCard: {
        ...contextOnly.eventCard,
        fingerprint: "fnv1a64:5555555555555555",
      },
    };
    const { bindingFingerprint: _old, ...changedWithoutFingerprint } = changedInput;
    const changed = {
      ...changedWithoutFingerprint,
      bindingFingerprint: fingerprintScreen03Value(changedWithoutFingerprint),
    } as Screen04EventCardBinding;
    state = reconcileScreen04EventCardBinding(
      state,
      changed,
      "2026-08-23T12:03:00.000Z",
    );
    expect(state).toMatchObject({
      status: "stale",
      stale: {
        isStale: true,
        priorEventCardFingerprint: initial.eventCard.fingerprint,
        currentEventCardFingerprint: changed.eventCard.fingerprint,
      },
    });
    expect(state.stale.reason).toContain("The verified shock changed");
  });

  it("preserves independent dataset and nodata drafts across reversible mode switches", () => {
    let state = createScreen04WorkflowState(
      binding(),
      "screen04-modes",
      "2026-08-23T12:00:00.000Z",
    );
    expect(state).toMatchObject({
      schemaVersion: SCREEN_04_WORKFLOW_SCHEMA_VERSION,
      releaseLabel: SCREEN_04_RELEASE_LABEL,
      sampleProfile: { activeMode: "dataset" },
    });
    state = updateScreen04DatasetProfile(state, {
      description: {
        treatmentGroupDescription: "Firms headquartered in California",
        controlGroupDescription: "Firms headquartered outside California",
      },
      fieldMappings: {
        unitIdentifier: "GVKEY",
      },
    }, "2026-08-23T12:01:00.000Z");
    state = switchScreen04Mode(
      state,
      "nodata",
      "2026-08-23T12:02:00.000Z",
    );
    expect(state.status).toBe("describing-sample");
    state = updateScreen04NodataProfile(state, {
      description: {
        unitOfAnalysis: "Firm-year",
        sampleUnits: "Public technology firms",
        dataFrequency: "Annual",
        sampleStartYear: 2010,
        sampleEndYear: 2015,
        researcherTreatmentYear: 2013,
        treatmentGroupDescription: "Firms headquartered in California",
        controlGroupDescription: "Firms headquartered outside California",
        comparisonBasis: "geography",
        geographicConcept: "headquarters",
      },
    }, "2026-08-23T12:03:00.000Z");
    expect(state.sampleProfile.nodata.completion.status).toBe("ready");
    state = saveScreen04SampleProfile(
      state,
      "2026-08-23T12:04:00.000Z",
    );
    expect(state).toMatchObject({
      status: "ready-to-continue",
      sampleProfile: {
        activeMode: "nodata",
        nodata: { completion: { status: "saved" } },
      },
    });
    state = switchScreen04Mode(
      state,
      "dataset",
      "2026-08-23T12:05:00.000Z",
    );
    expect(state.status).toBe("no-file");
    expect(state.sampleProfile.dataset).toMatchObject({
      description: {
        treatmentGroupDescription: "Firms headquartered in California",
        controlGroupDescription: "Firms headquartered outside California",
      },
      fieldMappings: { unitIdentifier: "GVKEY" },
    });
    state = switchScreen04Mode(
      state,
      "nodata",
      "2026-08-23T12:06:00.000Z",
    );
    expect(state.status).toBe("ready-to-continue");
    expect(state.sampleProfile.nodata.description.sampleUnits).toBe(
      "Public technology firms",
    );
  });

  it("fingerprints persisted crosswalk facts and resets them on unit or file changes", async () => {
    const inspected = await inspectScreen04CsvHeader(csv);
    let state = createScreen04WorkflowState(
      binding(),
      "screen04-crosswalk-state",
      "2026-08-23T12:00:00.000Z",
    );
    state = attachScreen04Upload(state, {
      schemaVersion: "screen-04-upload-reference-v1",
      opaqueFileRef: "crosswalk-upload",
      csvFingerprint: inspected.csvFingerprint,
      headerFingerprint: inspected.headerFingerprint,
      byteLength: inspected.byteLength,
      headerCount: inspected.headerCount,
      uploadedAt: "2026-08-23T12:01:00.000Z",
      expiresAt: "2026-08-23T14:00:00.000Z",
    }, "2026-08-23T12:01:00.000Z");
    state = updateScreen04DatasetProfile(state, {
      description: {
        unitOfAnalysis: "Firm-year",
        sampleUnits: "Public firms",
        dataFrequency: "annual",
        researcherTreatmentYear: 2020,
        treatmentGroupDescription: "Firms operating in California",
        controlGroupDescription: "Firms operating outside California",
        comparisonBasis: "geography",
        geographicConcept: "operating-location",
        datasetAssignmentUnit: "firm",
        shockAssignmentUnit: "facility",
      },
      fieldMappings: {
        unitIdentifier: "GVKEY",
        annualTime: "year",
        treatmentGroup: "treated",
        treatedValue: "1",
        comparisonValue: "0",
      },
    }, "2026-08-23T12:02:00.000Z");
    const defaultFingerprint = screen04AssessmentInputFingerprint(state);
    const legacyState = JSON.parse(JSON.stringify(state)) as Record<
      string,
      unknown
    >;
    const legacyProfile = legacyState.sampleProfile as Record<string, unknown>;
    const legacyDataset = legacyProfile.dataset as Record<string, unknown>;
    const legacyFieldMappings = legacyDataset.fieldMappings as Record<
      string,
      unknown
    >;
    delete legacyFieldMappings.assignmentLowerLevelIdentifier;
    delete legacyFieldMappings.assignmentAggregateIdentifier;
    delete legacyDataset.combinedExposureScenario;
    delete legacyDataset.assignmentCrosswalkStatus;
    delete legacyDataset.withinAggregateExposure;
    delete legacyProfile.integrity;
    legacyProfile.integrity = {
      profileFingerprint: fingerprintScreen03Value(legacyProfile),
    };
    delete legacyState.integrity;
    legacyState.integrity = {
      stateFingerprint: fingerprintScreen03Value(legacyState),
    };
    expect(restoreScreen04WorkflowState(legacyState)?.sampleProfile.dataset)
      .toMatchObject({
        assignmentCrosswalkStatus: "unknown",
        withinAggregateExposure: "unknown",
      });

    const withCombinedScenario = updateScreen04DatasetProfile(state, {
      combinedExposureScenario: {
        name: "Implementation and enforcement package",
        ruleIndexes: [0, 1],
      },
    }, "2026-08-23T12:02:30.000Z");
    expect(screen04AssessmentInputFingerprint(withCombinedScenario)).not.toBe(
      defaultFingerprint,
    );
    expect(
      restoreScreen04WorkflowState(
        JSON.parse(serializeScreen04WorkflowState(withCombinedScenario)),
      )?.sampleProfile.dataset.combinedExposureScenario,
    ).toEqual({
      name: "Implementation and enforcement package",
      ruleIndexes: [0, 1],
    });
    const remappedExposure = updateScreen04DatasetProfile(
      withCombinedScenario,
      {
        exposureMapping: {
          approach: "coverage-variable",
          column: "operating_state",
          coveredValue: "CA",
        },
      },
      "2026-08-23T12:02:45.000Z",
    );
    expect(remappedExposure.sampleProfile.dataset.combinedExposureScenario)
      .toBeNull();

    const withCrosswalk = updateScreen04DatasetProfile(state, {
      assignmentCrosswalkStatus: "complete",
      withinAggregateExposure: "mixed",
      fieldMappings: {
        assignmentLowerLevelIdentifier: "operating_state",
        assignmentAggregateIdentifier: "GVKEY",
      },
    }, "2026-08-23T12:03:00.000Z");
    expect(withCrosswalk.sampleProfile.dataset).toMatchObject({
      assignmentCrosswalkStatus: "complete",
      withinAggregateExposure: "mixed",
      fieldMappings: {
        assignmentLowerLevelIdentifier: "operating_state",
        assignmentAggregateIdentifier: "GVKEY",
      },
    });
    expect(screen04AssessmentInputFingerprint(withCrosswalk)).not.toBe(
      defaultFingerprint,
    );
    expect(
      restoreScreen04WorkflowState(
        JSON.parse(serializeScreen04WorkflowState(withCrosswalk)),
      )?.sampleProfile.dataset,
    ).toMatchObject({
      assignmentCrosswalkStatus: "complete",
      withinAggregateExposure: "mixed",
      fieldMappings: {
        assignmentLowerLevelIdentifier: "operating_state",
        assignmentAggregateIdentifier: "GVKEY",
      },
    });

    const changedWhileAssessing = updateScreen04DatasetProfile(
      beginScreen04ScientificAssessment(
        withCrosswalk,
        "2026-08-23T12:03:30.000Z",
      ),
      { assignmentCrosswalkStatus: "partial" },
      "2026-08-23T12:04:00.000Z",
    );
    expect(changedWhileAssessing.status).toBe("ready-to-assess");
    expect(changedWhileAssessing.sampleProfile.dataset).toMatchObject({
      assignmentCrosswalkStatus: "partial",
      withinAggregateExposure: "unknown",
      assessment: null,
    });

    const unitsChanged = updateScreen04DatasetProfile(withCrosswalk, {
      description: { shockAssignmentUnit: "parent-company" },
    }, "2026-08-23T12:04:00.000Z");
    expect(unitsChanged.sampleProfile.dataset).toMatchObject({
      assignmentCrosswalkStatus: "unknown",
      withinAggregateExposure: "unknown",
      fieldMappings: {
        assignmentLowerLevelIdentifier: null,
        assignmentAggregateIdentifier: null,
      },
    });

    const sameUpload = attachScreen04Upload(withCrosswalk, {
      schemaVersion: "screen-04-upload-reference-v1",
      opaqueFileRef: "same-crosswalk-upload",
      csvFingerprint: inspected.csvFingerprint,
      headerFingerprint: inspected.headerFingerprint,
      byteLength: inspected.byteLength,
      headerCount: inspected.headerCount,
      uploadedAt: "2026-08-23T12:04:00.000Z",
      expiresAt: "2026-08-23T14:00:00.000Z",
    }, "2026-08-23T12:04:00.000Z");
    expect(sameUpload.sampleProfile.dataset).toMatchObject({
      assignmentCrosswalkStatus: "complete",
      withinAggregateExposure: "mixed",
      fieldMappings: {
        assignmentLowerLevelIdentifier: "operating_state",
        assignmentAggregateIdentifier: "GVKEY",
      },
    });

    const replacedUpload = attachScreen04Upload(withCrosswalk, {
      schemaVersion: "screen-04-upload-reference-v1",
      opaqueFileRef: "replacement-crosswalk-upload",
      csvFingerprint:
        "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      headerFingerprint: inspected.headerFingerprint,
      byteLength: inspected.byteLength,
      headerCount: inspected.headerCount,
      uploadedAt: "2026-08-23T12:04:00.000Z",
      expiresAt: "2026-08-23T14:00:00.000Z",
    }, "2026-08-23T12:04:00.000Z");
    expect(replacedUpload.sampleProfile.dataset).toMatchObject({
      assignmentCrosswalkStatus: "unknown",
      withinAggregateExposure: "unknown",
      fieldMappings: {
        assignmentLowerLevelIdentifier: null,
        assignmentAggregateIdentifier: null,
      },
    });
  });

  it("records and restores real issue-rich advanced findings without dropping missing-information details", async () => {
    const csvText = readFileSync(new URL(
      "../fixtures/screen04/CCPA_Screen4_issue_rich.csv", import.meta.url,
    ), "utf8");
    const bound = binding({ verifiedShockName: "California Consumer Privacy Act" });
    const at = "2026-08-23T12:00:00.000Z";
    const inspection = await inspectScreen04CsvHeader(csvText);
    let state = createScreen04WorkflowState(bound, "screen04-issue-rich", at);
    state = attachScreen04Upload(state, {
      schemaVersion: "screen-04-upload-reference-v1",
      opaqueFileRef: "issue-rich-local-upload",
      csvFingerprint: inspection.csvFingerprint,
      headerFingerprint: inspection.headerFingerprint,
      byteLength: inspection.byteLength,
      headerCount: inspection.headerCount,
      uploadedAt: at,
      expiresAt: "2026-08-23T14:00:00.000Z",
    }, at);
    const conditionDefaults = {
      stageGroup: null, operator: null, unit: null, sourceUnit: null,
      historicalYear: null, mappedHistoricalYear: null,
      historicalValueSource: null, effectiveYear: null, nestedAnyGroup: [],
    };
    state = updateScreen04DatasetProfile(state, {
      description: {
        unitOfAnalysis: "Firm-year", sampleUnits: "Public technology firms",
        dataFrequency: "annual", researcherTreatmentYear: 2020,
        treatmentGroupDescription: "Firms headquartered in California",
        controlGroupDescription: "Firms headquartered outside California",
        comparisonBasis: "geography", geographicConcept: "headquarters",
        shockGeographicConcept: "operating-location",
        datasetAssignmentUnit: "parent-company", shockAssignmentUnit: "firm",
      },
      fieldMappings: {
        unitIdentifier: "GVKEY", annualTime: "Year", treatmentGroup: "ProposedGroup",
        treatedValue: "T", comparisonValue: "C",
      },
      exposureMapping: {
        approach: "conditions", combination: "all", conditions: [
          { ...conditionDefaults, id: "business-nexus", dimension: "geography",
            kind: "categorical-equals", column: "DoesBusinessCA", value: "yes", effectiveYear: 2020 },
          { ...conditionDefaults, id: "revenue", dimension: "threshold",
            kind: "numeric-threshold", column: "Revenue2017M", operator: ">=", value: 25,
            unit: "USD millions", sourceUnit: "USD millions", historicalYear: 2017,
            mappedHistoricalYear: 2017, historicalValueSource: "column-values",
            nestedAnyGroup: [{ id: "data-volume", column: "DataVolumeThousands", operator: ">=",
              threshold: 50, unit: "thousands", sourceUnit: "thousands", historicalYear: 2017,
              mappedHistoricalYear: 2017, historicalValueSource: "column-values" }] },
          { ...conditionDefaults, id: "exemption", dimension: "exemption",
            kind: "exemption", column: "Exempt", value: "yes" },
        ],
      },
    }, at);
    const result = await runScreen04ScientificAssessment({
      csvText, verifiedShockName: bound.verifiedShockName,
      mappings: {
        unitIdentifier: "GVKEY", year: "Year", treatmentGroup: "ProposedGroup",
        researcherTreatmentYear: 2020, treatedValue: "T", comparisonValue: "C",
      },
      studyDescription: {
        unitOfAnalysis: "Firm-year", sampleUnitDescription: "Public technology firms",
        dataFrequency: "annual",
        treatmentGroupDescription: "Firms headquartered in California",
        comparisonGroupDescription: "Firms headquartered outside California",
        mainComparisonBasis: "geography", groupGeographicConcept: "headquarters",
        shockGeographicConcept: "operating-location",
        datasetAssignmentUnit: "parent-company", shockAssignmentUnit: "firm",
      },
      verifiedDates: [{ label: "Effective date", date: "2020-01-01", role: "effective" }],
      coverageMatchingIntent: "conditions",
      ...screen04CompileExposureRules(state.sampleProfile.dataset.exposureMapping, 2020),
    });
    expect(result.setupIssues.some((issue) => issue.blocking)).toBe(false);
    expect(result.advancedDiagnostics).not.toBeNull();
    expect(result.overallJudgment).toBe("Revise the treatment or comparison definition");
    expect(result.metrics?.exposure).toMatchObject({
      proposedTreatedAuditedUnexposedObservations: 16,
      proposedTreatedAuditedUnexposedUnits: 16,
      proposedComparisonAuditedExposedObservations: 8,
      proposedComparisonAuditedExposedUnits: 8,
      unknownExposureObservations: 10,
      unknownExposureUnits: 10,
    });
    const findings = [...result.priorityFindings, ...result.otherFindings];
    expect(findings.find((finding) => finding.code === "SCREEN04_ADVANCED_PROPOSED_CODING_DISAGREEMENT")?.aggregate)
      .toMatchObject({ affectedObservations: 34, affectedUnits: 34 });
    expect(findings.flatMap((finding) => finding.whereItOccurs?.details ?? [])
      .flatMap((detail) => detail.reasonCategories)).toContain("missing-information");
    const assessing = beginScreen04ScientificAssessment(state, at);
    const recorded = recordScreen04ScientificAssessment(assessing, result, at);
    expect(recorded.status).toBe("assessment-complete");
    expect(recorded.sampleProfile.dataset.scientificFindings).toEqual(findings);
    expect(restoreScreen04WorkflowState(JSON.parse(JSON.stringify(recorded)))).toEqual(recorded);

    const allReasons = [
      "geography", "organization-type", "threshold", "exemption", "timing",
      "amendment", "assignment-unit", "missing-information", "treatment-component",
      "coverage-condition", "multi-condition",
    ] as const;
    const fullTaxonomy = structuredClone(result);
    const fullDetail = [...fullTaxonomy.priorityFindings, ...fullTaxonomy.otherFindings]
      .flatMap((finding) => finding.whereItOccurs?.details ?? [])[0]!;
    fullDetail.reasonCategories = allReasons;
    const allReasonsRecorded = recordScreen04ScientificAssessment(assessing, fullTaxonomy, at);
    expect(restoreScreen04WorkflowState(JSON.parse(JSON.stringify(allReasonsRecorded))))
      .toEqual(allReasonsRecorded);
    fullDetail.reasonCategories = [...allReasons, "geography"];
    expect(() => recordScreen04ScientificAssessment(assessing, fullTaxonomy, at))
      .toThrow("Scientific finding affected detail is invalid.");

    for (const invalid of ["invented-reason", "", "missing-information "]) {
      const malformed = structuredClone(result);
      const detail = [...malformed.priorityFindings, ...malformed.otherFindings]
        .flatMap((finding) => finding.whereItOccurs?.details ?? [])[0]!;
      (detail as unknown as { reasonCategories: string[] }).reasonCategories = [invalid];
      expect(() => recordScreen04ScientificAssessment(assessing, malformed, at))
        .toThrow("Scientific finding affected detail is invalid.");
    }
    const extraField = structuredClone(result);
    const detail = [...extraField.priorityFindings, ...extraField.otherFindings]
      .flatMap((finding) => finding.whereItOccurs?.details ?? [])[0]!;
    Object.assign(detail, { rawCsvValue: "must not persist" });
    expect(() => recordScreen04ScientificAssessment(assessing, extraField, at))
      .toThrow("Scientific finding affected detail is invalid.");
  });

  it("atomically records a current clean assessment and invalidates it on edits or uploads", async () => {
    const bound = binding();
    const inspection = await inspectScreen04CsvHeader(csv);
    let state = createScreen04WorkflowState(
      bound,
      "screen04-assessment-integrity",
      "2026-08-23T12:00:00.000Z",
    );
    state = attachScreen04Upload(state, {
      schemaVersion: "screen-04-upload-reference-v1",
      opaqueFileRef: "assessment-upload",
      csvFingerprint: inspection.csvFingerprint,
      headerFingerprint: inspection.headerFingerprint,
      byteLength: inspection.byteLength,
      headerCount: inspection.headerCount,
      uploadedAt: "2026-08-23T12:01:00.000Z",
      expiresAt: "2026-08-23T14:00:00.000Z",
    }, "2026-08-23T12:01:00.000Z");
    state = updateScreen04DatasetProfile(state, {
      description: {
        unitOfAnalysis: "Firm-year",
        sampleUnits: "Public firms",
        dataFrequency: "annual",
        researcherTreatmentYear: 2020,
        treatmentGroupDescription: "Firms operating in California",
        controlGroupDescription: "Firms operating outside California",
        comparisonBasis: "geography",
        geographicConcept: "operating-location",
        shockGeographicConcept: "operating-location",
        datasetAssignmentUnit: "firm",
        shockAssignmentUnit: "firm",
      },
      fieldMappings: {
        unitIdentifier: "GVKEY",
        annualTime: "year",
        treatmentGroup: "treated",
        treatedValue: "1",
        comparisonValue: "0",
      },
      exposureMapping: {
        approach: "coverage-variable",
        column: "operating_state",
        coveredValue: "CA",
      },
    }, "2026-08-23T12:02:00.000Z");
    const completeButUnassessed = updateScreen04DatasetProfile(state, {
      description: { sampleStartYear: 2019, sampleEndYear: 2020 },
    }, "2026-08-23T12:02:00.000Z");
    expect(() => saveScreen04SampleProfile(
      completeButUnassessed,
      "2026-08-23T12:03:00.000Z",
    )).toThrow(/current dataset assessment/u);

    const calculated = await runScreen04ScientificAssessment({
      csvText: csv,
      verifiedShockName: bound.verifiedShockName,
      mappings: {
        unitIdentifier: "GVKEY",
        year: "year",
        treatmentGroup: "treated",
        researcherTreatmentYear: 2020,
        treatedValue: "1",
        comparisonValue: "0",
      },
      studyDescription: {
        unitOfAnalysis: "Firm-year",
        sampleUnitDescription: "Public firms",
        dataFrequency: "annual",
        treatmentGroupDescription: "Firms operating in California",
        comparisonGroupDescription: "Firms operating outside California",
        mainComparisonBasis: "geography",
        groupGeographicConcept: "operating-location",
        shockGeographicConcept: "operating-location",
        datasetAssignmentUnit: "firm",
        shockAssignmentUnit: "firm",
      },
      verifiedDates: [{
        label: "Effective date",
        date: "2020-01-01",
        role: "effective",
      }],
      exposureRule: {
        approach: "coverage-variable",
        column: "operating_state",
        coveredValue: "CA",
        effectiveYear: 2020,
      },
    });
    expect(calculated.metrics).not.toBeNull();
    expect(calculated.setupIssues.some((issue) => issue.blocking)).toBe(false);

    // Completion is based on a completed deterministic run, not finding count.
    const cleanResult = {
      ...calculated,
      overallJudgment: "The proposed exposure design is broadly usable" as const,
      priorityFindings: [],
      otherFindings: [],
      unresolvedResearcherChoices: [],
    };
    state = beginScreen04ScientificAssessment(
      state,
      "2026-08-23T12:02:30.000Z",
    );
    expect(state.status).toBe("assessing");
    state = recordScreen04ScientificAssessment(
      state,
      cleanResult,
      "2026-08-23T12:03:00.000Z",
    );
    expect(state.sampleProfile.dataset).toMatchObject({
      description: { sampleStartYear: 2019, sampleEndYear: 2020 },
      overallJudgment: "The proposed exposure design is broadly usable",
      scientificFindings: [],
      unresolvedResearcherChoices: [],
      completion: { status: "ready", savedAt: null },
      assessment: {
        status: "completed",
        csvFingerprint: inspection.csvFingerprint,
        resultFingerprint: expect.stringMatching(/^fnv1a64:/u),
        assessedAt: "2026-08-23T12:03:00.000Z",
        summary: {
          rowCount: 4,
          uniqueUnits: 2,
          dataFrequency: "annual",
          sampleStartYear: 2019,
          sampleEndYear: 2020,
        },
      },
    });
    expect(state.sampleProfile.dataset.assessment).toMatchObject({
      status: "completed",
      assessmentInputFingerprint: screen04AssessmentInputFingerprint(state),
    });

    const assessed = state;
    let crosswalkAssessed = updateScreen04DatasetProfile(assessed, {
      description: { shockAssignmentUnit: "facility" },
    }, "2026-08-23T12:03:10.000Z");
    crosswalkAssessed = updateScreen04DatasetProfile(crosswalkAssessed, {
      assignmentCrosswalkStatus: "complete",
      withinAggregateExposure: "uniform",
      fieldMappings: {
        assignmentLowerLevelIdentifier: "operating_state",
        assignmentAggregateIdentifier: "GVKEY",
      },
    }, "2026-08-23T12:03:20.000Z");
    crosswalkAssessed = beginScreen04ScientificAssessment(
      crosswalkAssessed,
      "2026-08-23T12:03:30.000Z",
    );
    crosswalkAssessed = recordScreen04ScientificAssessment(
      crosswalkAssessed,
      cleanResult,
      "2026-08-23T12:03:40.000Z",
    );
    const crosswalkInvalidated = updateScreen04DatasetProfile(
      crosswalkAssessed,
      { withinAggregateExposure: "mixed" },
      "2026-08-23T12:03:50.000Z",
    );
    expect(crosswalkInvalidated.sampleProfile.dataset).toMatchObject({
      assignmentCrosswalkStatus: "complete",
      withinAggregateExposure: "mixed",
      overallJudgment: null,
      scientificFindings: [],
      assessment: {
        status: "stale",
        reason: "Your sample setup changed",
      },
    });

    const rerunning = beginScreen04ScientificAssessment(
      assessed,
      "2026-08-23T12:03:30.000Z",
    );
    expect(rerunning).toMatchObject({
      status: "assessing",
      sampleProfile: {
        dataset: {
          overallJudgment: null,
          scientificFindings: [],
          unresolvedResearcherChoices: [],
          completion: { status: "incomplete", savedAt: null },
          assessment: {
            status: "stale",
            reason: "Assessment rerun started",
          },
        },
      },
    });
    const rerunResult = {
      ...cleanResult,
      overallJudgment: "Review several exposure choices" as const,
      priorityFindings: [{
        category: "Sample support" as const,
        title: "Review the repeated sample assessment",
        whatFound: "The explicit rerun produced a new bounded finding.",
        whyItMatters: "Only the completed rerun may publish its findings.",
        possibleNextStep: null,
        priority: "medium" as const,
      }],
    };
    const rerunComplete = recordScreen04ScientificAssessment(
      rerunning,
      rerunResult,
      "2026-08-23T12:04:00.000Z",
    );
    expect(rerunComplete).toMatchObject({
      status: "assessment-complete",
      sampleProfile: {
        dataset: {
          overallJudgment: "Review several exposure choices",
          scientificFindings: [{
            title: "Review the repeated sample assessment",
          }],
          assessment: { status: "completed" },
        },
      },
    });

    const saved = saveScreen04SampleProfile(
      assessed,
      "2026-08-23T12:04:00.000Z",
    );
    expect(saved).toMatchObject({
      status: "ready-to-continue",
      sampleProfile: {
        dataset: { completion: { status: "saved" } },
      },
    });

    const invalidatedByEdits = [
      updateScreen04DatasetProfile(assessed, {
        description: { controlGroupDescription: "A revised comparison group" },
      }, "2026-08-23T12:04:00.000Z"),
      updateScreen04DatasetProfile(assessed, {
        fieldMappings: { treatmentGroup: "operating_state" },
      }, "2026-08-23T12:04:00.000Z"),
      updateScreen04DatasetProfile(assessed, {
        exposureMapping: {
          approach: "coverage-variable",
          column: "operating_state",
          coveredValue: "NV",
        },
      }, "2026-08-23T12:04:00.000Z"),
    ];
    for (const invalidated of invalidatedByEdits) {
      expect(invalidated.sampleProfile.dataset).toMatchObject({
        overallJudgment: null,
        scientificFindings: [],
        unresolvedResearcherChoices: [],
        assessment: {
          status: "stale",
          reason: "Your sample setup changed",
        },
        completion: { status: "incomplete", savedAt: null },
      });
    }
    const rerunningAfterEdit = beginScreen04ScientificAssessment(
      invalidatedByEdits[0]!,
      "2026-08-23T12:04:30.000Z",
    );
    expect(rerunningAfterEdit.sampleProfile.dataset.assessment).toMatchObject({
      status: "stale",
      reason: "Assessment rerun started",
    });
    const edited = invalidatedByEdits[0]!;
    expect(() => saveScreen04SampleProfile(
      edited,
      "2026-08-23T12:05:00.000Z",
    )).toThrow(/current dataset assessment/u);

    const replacedUpload = attachScreen04Upload(assessed, {
      schemaVersion: "screen-04-upload-reference-v1",
      opaqueFileRef: "replacement-upload",
      csvFingerprint: "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      headerFingerprint: inspection.headerFingerprint,
      byteLength: inspection.byteLength,
      headerCount: inspection.headerCount,
      uploadedAt: "2026-08-23T12:04:00.000Z",
      expiresAt: "2026-08-23T14:00:00.000Z",
    }, "2026-08-23T12:04:00.000Z");
    expect(replacedUpload.sampleProfile.dataset).toMatchObject({
      overallJudgment: null,
      scientificFindings: [],
      unresolvedResearcherChoices: [],
      assessment: {
        status: "stale",
        reason: "Your sample setup changed",
      },
      completion: { status: "incomplete", savedAt: null },
    });

    const tampered = JSON.parse(JSON.stringify(assessed)) as Record<string, unknown>;
    const tamperedProfile = tampered.sampleProfile as Record<string, unknown>;
    const tamperedDataset = tamperedProfile.dataset as Record<string, unknown>;
    const tamperedAssessment = tamperedDataset.assessment as Record<string, unknown>;
    tamperedAssessment.assessmentInputFingerprint =
      "fnv1a64:9999999999999999";
    const { integrity: _profileIntegrity, ...profileFingerprintInput } =
      tamperedProfile;
    tamperedProfile.integrity = {
      profileFingerprint: fingerprintScreen03Value(profileFingerprintInput),
    };
    const { integrity: _stateIntegrity, ...stateFingerprintInput } = tampered;
    tampered.integrity = {
      stateFingerprint: fingerprintScreen03Value(stateFingerprintInput),
    };
    expect(restoreScreen04WorkflowState(tampered)).toBeNull();

    const tamperedResult = JSON.parse(JSON.stringify(assessed)) as Record<string, unknown>;
    const tamperedResultProfile = tamperedResult.sampleProfile as Record<string, unknown>;
    const tamperedResultDataset = tamperedResultProfile.dataset as Record<string, unknown>;
    const tamperedResultAssessment = tamperedResultDataset.assessment as Record<string, unknown>;
    tamperedResultAssessment.resultFingerprint =
      "fnv1a64:8888888888888888";
    const {
      integrity: _tamperedResultProfileIntegrity,
      ...tamperedResultProfileInput
    } = tamperedResultProfile;
    tamperedResultProfile.integrity = {
      profileFingerprint: fingerprintScreen03Value(
        tamperedResultProfileInput,
      ),
    };
    const {
      integrity: _tamperedResultStateIntegrity,
      ...tamperedResultStateInput
    } = tamperedResult;
    tamperedResult.integrity = {
      stateFingerprint: fingerprintScreen03Value(tamperedResultStateInput),
    };
    expect(restoreScreen04WorkflowState(tamperedResult)).toBeNull();
  });

  it("rejects historical v0.4.00 statuses in a direct v3 restore", () => {
    for (const status of [
      "awaiting-upload",
      "mapping",
      "ready-to-calculate",
      "calculated",
      "failed",
    ]) {
      const directV3 = JSON.parse(JSON.stringify(
        createScreen04WorkflowState(
          binding(),
          `screen04-direct-v3-${status}`,
          "2026-08-23T12:00:00.000Z",
        ),
      )) as Record<string, unknown>;
      directV3.status = status;
      delete directV3.integrity;
      directV3.integrity = {
        stateFingerprint: fingerprintScreen03Value(directV3),
      };
      expect(restoreScreen04WorkflowState(directV3), status).toBeNull();
    }
  });

  it("migrates a fingerprint-valid v0.4.00 workflow to dataset mode without raw rows", () => {
    let current = createScreen04WorkflowState(
      binding(),
      "screen04-legacy",
      "2026-08-23T12:00:00.000Z",
    );
    current = attachScreen04Upload(current, {
      schemaVersion: "screen-04-upload-reference-v1",
      opaqueFileRef: "legacy-upload",
      csvFingerprint:
        "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      headerFingerprint: fingerprintScreen04Headers(headers),
      byteLength: 100,
      headerCount: headers.length,
      uploadedAt: "2026-08-23T12:01:00.000Z",
      expiresAt: "2026-08-23T14:00:00.000Z",
    }, "2026-08-23T12:01:00.000Z");
    current = mapScreen04Columns(
      current,
      mappings,
      headers,
      "2026-08-23T12:02:00.000Z",
    );

    const legacy = JSON.parse(JSON.stringify(current)) as Record<string, unknown>;
    delete legacy.sampleProfile;
    legacy.schemaVersion = SCREEN_04_LEGACY_WORKFLOW_SCHEMA_VERSION;
    legacy.releaseLabel = SCREEN_04_LEGACY_RELEASE_LABEL;
    const legacyBinding = legacy.eventCardBinding as Record<string, unknown>;
    delete legacyBinding.exposureDimensions;
    legacyBinding.schemaVersion = "screen-03-to-screen-04-event-card-v1";
    delete legacyBinding.bindingFingerprint;
    legacyBinding.bindingFingerprint = fingerprintScreen03Value(legacyBinding);
    delete legacy.integrity;
    legacy.integrity = {
      stateFingerprint: fingerprintScreen03Value(legacy),
    };

    const migrated = restoreScreen04WorkflowState(legacy);
    expect(migrated).toMatchObject({
      schemaVersion: SCREEN_04_WORKFLOW_SCHEMA_VERSION,
      releaseLabel: SCREEN_04_RELEASE_LABEL,
      status: "mapping-incomplete",
      sampleProfile: {
        activeMode: "dataset",
        dataset: {
          description: { researcherTreatmentYear: 2020 },
          fieldMappings: {
            unitIdentifier: "GVKEY",
            annualTime: "year",
            treatmentGroup: "treated",
            exposureFields: { "operating-location": "operating_state" },
          },
          overallJudgment: null,
          assessment: null,
          completion: { status: "incomplete", savedAt: null },
        },
      },
    });
    expect(JSON.stringify(migrated)).not.toContain("private-a");

    const tampered = JSON.parse(JSON.stringify(legacy)) as Record<string, unknown>;
    tampered.runId = "tampered";
    expect(restoreScreen04WorkflowState(tampered)).toBeNull();
  });
});
