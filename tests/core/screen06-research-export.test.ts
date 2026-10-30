import { describe, expect, it } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import { createScreen6DiagnosticPlanInput } from
  "../../src/core/six-screen/screen6-diagnostic-plan";
import { createScreen6DiagnosticResultInput } from
  "../../src/core/six-screen/screen6-diagnostic-result";
import { createScreen6ClaimBoundaryInput } from
  "../../src/core/six-screen/screen6-claim-boundary";
import {
  createScreen6ResearchExport,
  createScreen6ResearchExportBundle,
  validateScreen6ResearchExportCollection,
  type Screen6ResearchExport,
} from "../../src/core/six-screen/screen6-research-export";
import {
  createScreen6ResearchExportRecord,
  currentScreen6ResearchExport,
  initializeScreen6UncertaintyProfile,
  openScreen6,
  recordScreen6DiagnosticResult,
  recordScreen6ResearchPlanningDisposition,
  reviewScreen6DiagnosticResult,
  saveScreen6ConditionalClaimBoundary,
  saveScreen6DiagnosticPlan,
} from "../../src/core/six-screen/workflow";
import {
  browserEventCardFixtureAt,
  createLockedBrowserEventCardFixture,
} from "../browser/six-screen-event-card-review-fixture";

function exportReadyFixture() {
  const fixture = createLockedBrowserEventCardFixture();
  const opened = openScreen6(fixture.state, {
    expectedRevision: fixture.state.revision,
    openedAt: browserEventCardFixtureAt(30),
  });
  const initialized = initializeScreen6UncertaintyProfile(opened.state, {
    expectedRevision: opened.state.revision,
    snapshotId: "screen6-export-profile",
    actor: "researcher_ui",
    createdAt: browserEventCardFixtureAt(31),
  });
  const planned = saveScreen6DiagnosticPlan(initialized.state, {
    expectedRevision: initialized.state.revision,
    snapshotId: "screen6-export-plan",
    diagnosticInput: createScreen6DiagnosticPlanInput({
      preTreatmentPeriods: {
        status: "available",
        count: 4,
        description: "2016 through 2019",
      },
      postTreatmentPeriods: {
        status: "available",
        count: 4,
        description: "2020 through 2023",
      },
      outcomeFrequency: { status: "known", value: "annual" },
      assignmentStructure: {
        status: "described",
        description: "Assignment varies across operators.",
        timingPattern: "single_time",
        dependence: "independent_units",
        independentGroupCount: null,
        groupingVariables: [],
      },
      feasibleDiagnosticVariables: {
        status: "available",
        values: ["outcome", "coverage_status"],
      },
      practicalConstraints: { status: "none_reported", values: [] },
      reportedConcerns: ["package_component_ambiguity"],
    }),
    actor: "researcher_ui",
    createdAt: browserEventCardFixtureAt(32),
  });
  const bounded = saveScreen6ConditionalClaimBoundary(planned.state, {
    expectedRevision: planned.state.revision,
    snapshotId: "screen6-export-boundary",
    expectedPlanFingerprint: planned.plan.planFingerprint,
    claimInput: createScreen6ClaimBoundaryInput({
      intendedClaimLevel: "package_effect",
      targetDescription:
        "the effect of legal eligibility for the policy package on the stated outcome",
    }),
    actor: "researcher_ui",
    createdAt: browserEventCardFixtureAt(33),
  });
  const disposed = recordScreen6ResearchPlanningDisposition(bounded.state, {
    expectedRevision: bounded.state.revision,
    dispositionId: "screen6-export-disposition",
    expectedBoundaryFingerprint: bounded.boundary.boundaryFingerprint,
    decision: "current_information_insufficient_for_intended_claim",
    rationale:
      "The current record does not establish a selected comparison for the intended claim.",
    specifiedRevisions: [],
    actor: "researcher_ui",
    decidedAt: browserEventCardFixtureAt(34),
  });
  return { bounded, disposed, initialized, planned };
}

function refingerprint(record: Screen6ResearchExport) {
  const { exportFingerprint: _fingerprint, ...body } = record;
  return {
    ...body,
    exportFingerprint: fingerprintSixScreenValue(body),
  } as Screen6ResearchExport;
}

describe("Screen 6 source-linked research export", () => {
  it("creates an explicit partial CredibilityPlan and final current-snapshot DesignRecord", () => {
    const setup = exportReadyFixture();
    const created = createScreen6ResearchExportRecord(setup.disposed.state, {
      expectedRevision: setup.disposed.state.revision,
      exportId: "screen6-research-export-one",
      expectedDispositionFingerprint:
        setup.disposed.disposition.dispositionFingerprint,
      actor: "researcher_ui",
      exportedAt: browserEventCardFixtureAt(35),
    });

    expect(created.researchExport).toMatchObject({
      ordinal: 1,
      completeness: { status: "partial" },
      credibilityPlan: {
        recommendationType: "research_planning_not_causal_certification",
        nonOutputs: {
          aggregateScore: null,
          causalCertification: "not_available",
          assumptionProof: null,
          attributionUpgrade: null,
          automaticDesignMutation: null,
        },
      },
      designRecord: {
        recordStatus: "final_current_snapshot_partial",
        nonOutputs: {
          treatmentEffectEstimate: null,
          aggregateScore: null,
          causalCertification: "not_available",
          automaticAttributionUpgrade: null,
          automaticDesignMutation: null,
        },
      },
      preparation: {
        actor: "researcher",
        method: "deterministic_fixed_software",
        networkRequests: 0,
        modelCalls: 0,
        localRoutineCalls: 0,
        exportAction: "explicit",
      },
    });
    expect(created.researchExport.completeness.unresolvedItems.length)
      .toBeGreaterThan(0);
    expect(created.researchExport.sourceLinkedDecisionTrail.sources.length)
      .toBeGreaterThan(0);
    expect(created.researchExport.sourceLinkedDecisionTrail.claims.some(
      ({ kind }) => kind === "prospective_conditional_claim",
    )).toBe(true);
    expect(created.researchExport.sourceLinkedDecisionTrail.decisions.some(
      ({ kind }) => kind === "research_export_created",
    )).toBe(true);
    expect(currentScreen6ResearchExport(created.state)).toEqual(
      created.researchExport,
    );
  });

  it("materializes the documented file set and a fingerprinted manifest", () => {
    const setup = exportReadyFixture();
    const created = createScreen6ResearchExportRecord(setup.disposed.state, {
      expectedRevision: setup.disposed.state.revision,
      exportId: "screen6-research-export-files",
      expectedDispositionFingerprint:
        setup.disposed.disposition.dispositionFingerprint,
      actor: "researcher_ui",
      exportedAt: browserEventCardFixtureAt(35),
    });
    const bundle = createScreen6ResearchExportBundle(created.researchExport);
    expect(bundle.files.map(({ name }) => name)).toEqual([
      "design-record.md",
      "README.md",
      "study.json",
      "confirmed-shock.json",
      "event-card.json",
      "designs.json",
      "coevents.json",
      "mechanisms.json",
      "credibility-plan.json",
      "sources.csv",
      "claims.csv",
      "search-manifest.json",
      "decisions.json",
      "manifest.json",
    ]);
    expect(bundle.manifest.payloadFileCount).toBe(13);
    expect(bundle.manifest.files).toHaveLength(13);
    expect(bundle.manifest.files.every(({ contentFingerprint }) =>
      /^fnv1a64:[0-9a-f]{16}$/u.test(contentFingerprint))).toBe(true);
    expect(JSON.stringify(bundle)).not.toContain("accessToken");
    expect(bundle.files.find(({ name }) => name === "design-record.md")?.content)
      .toContain("not a treatment-effect estimate");
  });

  it("retains the complete results-inspection history and proposed revisions", () => {
    const setup = exportReadyFixture();
    const card = setup.planned.plan.cards[0]!;
    const recorded = recordScreen6DiagnosticResult(setup.planned.state, {
      expectedRevision: setup.planned.state.revision,
      resultId: "screen6-export-result",
      cardId: card.id,
      expectedPlanFingerprint: setup.planned.plan.planFingerprint,
      expectedCardFingerprint: fingerprintSixScreenValue(card),
      resultInput: createScreen6DiagnosticResultInput({
        resultKind: "qualitative_or_documentary",
        provenance: {
          kind: "user_reported",
          sourceDescription: "Researcher review of retained policy versions",
        },
        summary: "The reviewed records do not establish component separability.",
        reportedStatistics: [],
        covariance: {
          status: "not_applicable",
          dimension: null,
          values: [],
        },
        uncertaintyContext: {
          status: "not_applicable",
          description: "This documentary check reports no estimate.",
        },
        specificationContext:
          "The current package and component records were compared.",
        power: {
          status: "not_applicable",
          description: "This is not a null-hypothesis test.",
        },
        multipleTesting: {
          status: "not_applicable",
          description: "No family of tests was interpreted.",
        },
        sampleComposition: {
          status: "not_assessed",
          description: null,
        },
        precision: {
          status: "not_applicable",
          description: "No numerical estimate was supplied.",
        },
        postInspectionChange: {
          status: "none_reported",
          description: null,
        },
      }),
      actor: "researcher_ui",
      submittedAt: browserEventCardFixtureAt(33),
    });
    const reviewed = reviewScreen6DiagnosticResult(recorded.state, {
      expectedRevision: recorded.state.revision,
      reviewId: "screen6-export-result-review",
      resultId: recorded.result.id,
      expectedResultFingerprint: recorded.result.resultFingerprint,
      decision: "revision_needed",
      rationale: "The intended target must remain at package level.",
      followUpActions: ["Retain a package-level estimand."],
      actor: "researcher_ui",
      reviewedAt: browserEventCardFixtureAt(34),
    });
    const bounded = saveScreen6ConditionalClaimBoundary(reviewed.state, {
      expectedRevision: reviewed.state.revision,
      snapshotId: "screen6-export-results-boundary",
      expectedPlanFingerprint: setup.planned.plan.planFingerprint,
      claimInput: createScreen6ClaimBoundaryInput({
        intendedClaimLevel: "package_effect",
        targetDescription: "the package-level effect on the stated outcome",
      }),
      actor: "researcher_ui",
      createdAt: browserEventCardFixtureAt(35),
    });
    const disposed = recordScreen6ResearchPlanningDisposition(bounded.state, {
      expectedRevision: bounded.state.revision,
      dispositionId: "screen6-export-results-disposition",
      expectedBoundaryFingerprint: bounded.boundary.boundaryFingerprint,
      decision: "revise_specified_parts_first",
      rationale: "Resolve the remaining package-version ambiguity first.",
      specifiedRevisions: ["Document version-specific exposure."],
      actor: "researcher_ui",
      decidedAt: browserEventCardFixtureAt(36),
    });
    const exported = createScreen6ResearchExportRecord(disposed.state, {
      expectedRevision: disposed.state.revision,
      exportId: "screen6-research-export-results-history",
      expectedDispositionFingerprint:
        disposed.disposition.dispositionFingerprint,
      actor: "researcher_ui",
      exportedAt: browserEventCardFixtureAt(37),
    });

    expect(exported.researchExport.credibilityPlan.resultsInspectionHistory)
      .toEqual([{ result: recorded.result, reviews: [reviewed.review] }]);
    expect(exported.researchExport.credibilityPlan
      .proposedDesignOrClaimRevisions).toEqual([
        {
          source: "diagnostic_result_review",
          sourceId: reviewed.review.id,
          text: "Retain a package-level estimand.",
        },
        {
          source: "research_planning_disposition",
          sourceId: disposed.disposition.id,
          text: "Document version-specific exposure.",
        },
      ]);
    expect(exported.researchExport.searchManifest.diagnostics).toMatchObject({
      resultRecordCount: 1,
      resultReviewCount: 1,
    });
  });

  it("requires an explicit researcher action and archives an export when its boundary changes", () => {
    const setup = exportReadyFixture();
    expect(() => createScreen6ResearchExport({
      state: setup.disposed.state,
      exportId: "screen6-model-export",
      profile: setup.initialized.profile,
      plan: setup.planned.plan,
      boundary: setup.bounded.boundary,
      disposition: setup.disposed.disposition,
      priorExports: [],
      actor: "model",
      exportedAt: browserEventCardFixtureAt(35),
    })).toThrow(/explicit researcher UI action/iu);

    const created = createScreen6ResearchExportRecord(setup.disposed.state, {
      expectedRevision: setup.disposed.state.revision,
      exportId: "screen6-export-before-boundary-revision",
      expectedDispositionFingerprint:
        setup.disposed.disposition.dispositionFingerprint,
      actor: "researcher_ui",
      exportedAt: browserEventCardFixtureAt(35),
    });
    const revised = saveScreen6ConditionalClaimBoundary(created.state, {
      expectedRevision: created.state.revision,
      snapshotId: "screen6-export-boundary-revised",
      expectedPlanFingerprint: setup.planned.plan.planFingerprint,
      claimInput: createScreen6ClaimBoundaryInput({
        intendedClaimLevel: "package_effect",
        targetDescription:
          "the prospective package effect on the explicitly recorded outcome",
      }),
      actor: "researcher_ui",
      createdAt: browserEventCardFixtureAt(36),
    });
    expect(currentScreen6ResearchExport(revised.state)).toBeNull();
    expect(revised.state.artifacts.find(({ snapshotId }) =>
      snapshotId === created.researchExport.id)?.status).toBe("archived");
  });

  it("rejects re-fingerprinted favorable or manifest tampering", () => {
    const setup = exportReadyFixture();
    const created = createScreen6ResearchExportRecord(setup.disposed.state, {
      expectedRevision: setup.disposed.state.revision,
      exportId: "screen6-research-export-tamper",
      expectedDispositionFingerprint:
        setup.disposed.disposition.dispositionFingerprint,
      actor: "researcher_ui",
      exportedAt: browserEventCardFixtureAt(35),
    });
    const favorable = structuredClone(created.researchExport);
    favorable.nonOutputs.causalCertification = "available" as never;
    const favorableState = structuredClone(created.state);
    favorableState.screen6ResearchExports = [refingerprint(favorable)];
    expect(() => validateScreen6ResearchExportCollection(favorableState))
      .toThrow(/research export is invalid/iu);

    const manifestTamper = structuredClone(created.researchExport);
    manifestTamper.manifest.files[0]!.byteLength += 1;
    const { manifestFingerprint: _manifestFingerprint, ...manifestBody } =
      manifestTamper.manifest;
    manifestTamper.manifest.manifestFingerprint =
      fingerprintSixScreenValue(manifestBody);
    const manifestState = structuredClone(created.state);
    manifestState.screen6ResearchExports = [refingerprint(manifestTamper)];
    expect(() => validateScreen6ResearchExportCollection(manifestState))
      .toThrow(/research export is invalid/iu);
  });
});
