import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  initializeScreen6UncertaintyProfile,
  openScreen6,
  createScreen6ResearchExportRecord,
  recordScreen6DiagnosticResult,
  recordScreen6ResearchPlanningDisposition,
  reviewScreen6DiagnosticResult,
  saveScreen6ConditionalClaimBoundary,
  saveScreen6DiagnosticPlan,
  screen6PrerequisiteReport,
} from "../../src/core/six-screen/workflow";
import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import { createScreen6DiagnosticPlanInput } from
  "../../src/core/six-screen/screen6-diagnostic-plan";
import { createScreen6DiagnosticResultInput } from
  "../../src/core/six-screen/screen6-diagnostic-result";
import { createScreen6ClaimBoundaryInput } from
  "../../src/core/six-screen/screen6-claim-boundary";
import type { Screen6UncertaintyWorkspace } from
  "../../src/worker/six-screen-workflow-runtime";
import { Screen6UncertaintyPanel } from
  "../../src/ui/six-screen/Screen6UncertaintyPanel";
import {
  browserEventCardFixtureAt,
  createLockedBrowserEventCardFixture,
} from "../browser/six-screen-event-card-review-fixture";

const claimBoundary =
  "The uncertainty profile and any reviewed-library cards are prospective planning records. They contain no diagnostic result, credibility score, causal certificate, conditional claim boundary, disposition, or Design Record.";

function screen6Fixture() {
  const fixture = createLockedBrowserEventCardFixture();
  const report = screen6PrerequisiteReport(fixture.state);
  const opened = openScreen6(fixture.state, {
    expectedRevision: fixture.state.revision,
    openedAt: browserEventCardFixtureAt(30),
  });
  const initialized = initializeScreen6UncertaintyProfile(opened.state, {
    expectedRevision: opened.state.revision,
    snapshotId: "screen6-profile-render-fixture",
    actor: "researcher_ui",
    createdAt: browserEventCardFixtureAt(31),
  });
  const planned = saveScreen6DiagnosticPlan(initialized.state, {
    expectedRevision: initialized.state.revision,
    snapshotId: "screen6-plan-render-fixture",
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
        description: "Assignment varies across market groups.",
        timingPattern: "single_time",
        dependence: "grouped_or_clustered",
        independentGroupCount: 12,
        groupingVariables: ["market_id"],
      },
      feasibleDiagnosticVariables: {
        status: "available",
        values: ["outcome", "market_id"],
      },
      practicalConstraints: {
        status: "none_reported",
        values: [],
      },
      reportedConcerns: [
        "outcome_or_sample_discontinuity",
        "proposed_negative_control",
        "group_level_assignment_or_dependence",
      ],
    }),
    actor: "researcher_ui",
    createdAt: browserEventCardFixtureAt(32),
  });
  return { fixture, report, initialized, planned };
}

describe("Screen 6 uncertainty-profile panel", () => {
  it("shows the pre-initialization gaps and a single explicit action", () => {
    const { report } = screen6Fixture();
    const workspace: Screen6UncertaintyWorkspace = {
      schemaVersion: "screen-06-uncertainty-workspace-v1",
      profile: null,
      diagnosticPlan: null,
      diagnosticResults: [],
      diagnosticResultReviews: [],
      conditionalClaimBoundary: null,
      researchPlanningDisposition: null,
      researchExport: null,
      revisions: [],
      diagnosticPlanRevisions: [],
      diagnosticResultRevisions: [],
      diagnosticResultReviewRevisions: [],
      conditionalClaimBoundaryRevisions: [],
      researchPlanningDispositionRevisions: [],
      researchExportRevisions: [],
      claimBoundary,
    };
    const markup = renderToStaticMarkup(createElement(
      Screen6UncertaintyPanel,
      {
        workspace,
        limitations: report.limitations,
        disabled: false,
        canInitialize: true,
        canSaveDiagnosticPlan: false,
        canRecordDiagnosticResult: false,
        canReviewDiagnosticResult: false,
        canSaveConditionalClaimBoundary: false,
        canRecordResearchPlanningDisposition: false,
        canCreateResearchExport: false,
        onInitialize: vi.fn(async () => undefined),
        onSaveDiagnosticPlan: vi.fn(async () => undefined),
        onRecordDiagnosticResult: vi.fn(async () => undefined),
        onReviewDiagnosticResult: vi.fn(async () => undefined),
        onSaveConditionalClaimBoundary: vi.fn(async () => undefined),
        onRecordResearchPlanningDisposition: vi.fn(async () => undefined),
        onCreateResearchExport: vi.fn(async () => undefined),
      },
    ));
    expect(markup).toContain("Initialize the uncertainty profile");
    expect(markup).toContain("Ten dimensions · no aggregate score");
    expect(markup).toContain("Initialize ten-dimension profile");
    expect(markup).toContain("no current researcher comparison decision");
    expect(markup).toContain("No current MechanismReview or PredictionMatrix");
    expect(markup).toContain(claimBoundary);
  });

  it("renders ten separate non-favorable dimensions and no invented result", () => {
    const { report, initialized } = screen6Fixture();
    const profile = initialized.profile;
    const workspace: Screen6UncertaintyWorkspace = {
      schemaVersion: "screen-06-uncertainty-workspace-v1",
      profile,
      diagnosticPlan: null,
      diagnosticResults: [],
      diagnosticResultReviews: [],
      conditionalClaimBoundary: null,
      researchPlanningDisposition: null,
      researchExport: null,
      revisions: [{
        profileSnapshotId: profile.snapshotId,
        ordinal: profile.ordinal,
        createdAt: profile.createdAt,
        gapCount: profile.gaps.length,
        notAssessedCount: profile.dimensions.filter(({ state }) =>
          state === "not_assessed").length,
        evidenceNeededCount: profile.dimensions.filter(({ state }) =>
          state === "evidence_needed").length,
        artifactStatus: "current",
      }],
      diagnosticPlanRevisions: [],
      diagnosticResultRevisions: [],
      diagnosticResultReviewRevisions: [],
      conditionalClaimBoundaryRevisions: [],
      researchPlanningDispositionRevisions: [],
      researchExportRevisions: [],
      claimBoundary,
    };
    const markup = renderToStaticMarkup(createElement(
      Screen6UncertaintyPanel,
      {
        workspace,
        limitations: report.limitations,
        disabled: false,
        canInitialize: false,
        canSaveDiagnosticPlan: true,
        canRecordDiagnosticResult: false,
        canReviewDiagnosticResult: false,
        canSaveConditionalClaimBoundary: false,
        canRecordResearchPlanningDisposition: false,
        canCreateResearchExport: false,
        onInitialize: vi.fn(async () => undefined),
        onSaveDiagnosticPlan: vi.fn(async () => undefined),
        onRecordDiagnosticResult: vi.fn(async () => undefined),
        onReviewDiagnosticResult: vi.fn(async () => undefined),
        onSaveConditionalClaimBoundary: vi.fn(async () => undefined),
        onRecordResearchPlanningDisposition: vi.fn(async () => undefined),
        onCreateResearchExport: vi.fn(async () => undefined),
      },
    ));
    expect(markup).toContain("Identification uncertainty remains separated");
    expect(markup).toContain("No diagnostics or results exist yet");
    expect(markup).toContain("Plan the identification challenges");
    expect(markup).toContain("Create planned diagnostic cards");
    for (const label of [
      "Institutional evidence",
      "Assignment and exposure",
      "Timing",
      "Counterfactual comparison",
      "Competing events",
      "Interference",
      "Treatment versions",
      "Outcome measurement and sample composition",
      "Statistical inference",
      "Mechanism attribution",
    ]) expect(markup).toContain(label);
    expect(markup.match(/Not planned in this foundation\./gu)).toHaveLength(10);
    expect(markup).not.toContain("87%");
    expect(markup).not.toContain("Diagnostic result retained");
  });

  it("renders reviewed planned cards without a pass, result, score, or certificate", () => {
    const { report, initialized, planned } = screen6Fixture();
    const profile = initialized.profile;
    const plan = planned.plan;
    const workspace: Screen6UncertaintyWorkspace = {
      schemaVersion: "screen-06-uncertainty-workspace-v1",
      profile,
      diagnosticPlan: plan,
      diagnosticResults: [],
      diagnosticResultReviews: [],
      conditionalClaimBoundary: null,
      researchPlanningDisposition: null,
      researchExport: null,
      revisions: [{
        profileSnapshotId: profile.snapshotId,
        ordinal: profile.ordinal,
        createdAt: profile.createdAt,
        gapCount: profile.gaps.length,
        notAssessedCount: profile.dimensions.filter(({ state }) =>
          state === "not_assessed").length,
        evidenceNeededCount: profile.dimensions.filter(({ state }) =>
          state === "evidence_needed").length,
        artifactStatus: "current",
      }],
      diagnosticPlanRevisions: [{
        planSnapshotId: plan.snapshotId,
        ordinal: plan.ordinal,
        createdAt: plan.createdAt,
        cardCount: plan.cards.length,
        primaryCardCount: plan.priorityPlan.primaryCardCount,
        inputGapCount: plan.diagnosticInputGaps.length,
        artifactStatus: "current",
      }],
      diagnosticResultRevisions: [],
      diagnosticResultReviewRevisions: [],
      conditionalClaimBoundaryRevisions: [],
      researchPlanningDispositionRevisions: [],
      researchExportRevisions: [],
      claimBoundary,
    };
    const markup = renderToStaticMarkup(createElement(
      Screen6UncertaintyPanel,
      {
        workspace,
        limitations: report.limitations,
        disabled: false,
        canInitialize: false,
        canSaveDiagnosticPlan: true,
        canRecordDiagnosticResult: true,
        canReviewDiagnosticResult: false,
        canSaveConditionalClaimBoundary: true,
        canRecordResearchPlanningDisposition: false,
        canCreateResearchExport: false,
        onInitialize: vi.fn(async () => undefined),
        onSaveDiagnosticPlan: vi.fn(async () => undefined),
        onRecordDiagnosticResult: vi.fn(async () => undefined),
        onReviewDiagnosticResult: vi.fn(async () => undefined),
        onSaveConditionalClaimBoundary: vi.fn(async () => undefined),
        onRecordResearchPlanningDisposition: vi.fn(async () => undefined),
        onCreateResearchExport: vi.fn(async () => undefined),
      },
    ));
    expect(markup).toContain("Prospective challenge plan");
    expect(markup).toContain("13 reviewed entries");
    expect(markup).toContain("Outcome measurement and sample continuity");
    expect(markup).toContain("Negative-control justification");
    expect(markup).toContain("Assignment unit, dependence, and clustering");
    expect(markup).toContain("No diagnostic results exist");
    expect(markup).toContain("Not supplied or calculated. This card is planned only.");
    expect(markup).toContain("cannot prescribe a design-specific estimator");
    expect(markup).toContain("Revise researcher-owned diagnostic inputs");
    expect(markup).not.toContain("87%");
    expect(markup).not.toMatch(/>Passed</u);
    expect(markup).not.toContain("causally valid");
  });

  it("renders provenance, readiness, and interpretation separately", () => {
    const { report, initialized, planned } = screen6Fixture();
    const card = planned.plan.cards.find(({ libraryEntryId }) =>
      libraryEntryId === "outcome-sample-continuity-v1")!;
    const recorded = recordScreen6DiagnosticResult(planned.state, {
      expectedRevision: planned.state.revision,
      resultId: "screen6-render-result",
      cardId: card.id,
      expectedPlanFingerprint: planned.plan.planFingerprint,
      expectedCardFingerprint: fingerprintSixScreenValue(card),
      resultInput: createScreen6DiagnosticResultInput({
        resultKind: "qualitative_or_documentary",
        provenance: {
          kind: "user_reported",
          sourceDescription: "Researcher review of the retained sample table",
        },
        summary: "The panel composition remained stable across the focal date.",
        reportedStatistics: [],
        covariance: {
          status: "not_applicable",
          dimension: null,
          values: [],
        },
        uncertaintyContext: {
          status: "not_applicable",
          description: "This documentary continuity check reports no estimate.",
        },
        specificationContext:
          "The same declared market panel and annual outcome definition were inspected.",
        power: {
          status: "not_applicable",
          description: "This is not a null-hypothesis test.",
        },
        multipleTesting: {
          status: "not_applicable",
          description: "No family of statistical tests was interpreted.",
        },
        sampleComposition: {
          status: "assessed",
          description: "Market entry and exit were checked around the focal date.",
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
      reviewId: "screen6-render-review",
      resultId: recorded.result.id,
      expectedResultFingerprint: recorded.result.resultFingerprint,
      decision: "concern_reduced",
      rationale:
        "The documentary check reduces this narrow composition concern but does not establish identification.",
      followUpActions: [],
      actor: "researcher_ui",
      reviewedAt: browserEventCardFixtureAt(34),
    });
    const workspace: Screen6UncertaintyWorkspace = {
      schemaVersion: "screen-06-uncertainty-workspace-v1",
      profile: initialized.profile,
      diagnosticPlan: planned.plan,
      diagnosticResults: [recorded.result],
      diagnosticResultReviews: [reviewed.review],
      conditionalClaimBoundary: null,
      researchPlanningDisposition: null,
      researchExport: null,
      revisions: [],
      diagnosticPlanRevisions: [],
      diagnosticResultRevisions: [],
      diagnosticResultReviewRevisions: [],
      conditionalClaimBoundaryRevisions: [],
      researchPlanningDispositionRevisions: [],
      researchExportRevisions: [],
      claimBoundary,
    };
    const markup = renderToStaticMarkup(createElement(
      Screen6UncertaintyPanel,
      {
        workspace,
        limitations: report.limitations,
        disabled: false,
        canInitialize: false,
        canSaveDiagnosticPlan: true,
        canRecordDiagnosticResult: true,
        canReviewDiagnosticResult: false,
        canSaveConditionalClaimBoundary: true,
        canRecordResearchPlanningDisposition: false,
        canCreateResearchExport: false,
        onInitialize: vi.fn(async () => undefined),
        onSaveDiagnosticPlan: vi.fn(async () => undefined),
        onRecordDiagnosticResult: vi.fn(async () => undefined),
        onReviewDiagnosticResult: vi.fn(async () => undefined),
        onSaveConditionalClaimBoundary: vi.fn(async () => undefined),
        onRecordResearchPlanningDisposition: vi.fn(async () => undefined),
        onCreateResearchExport: vi.fn(async () => undefined),
      },
    ));
    expect(markup).toContain("User-reported result");
    expect(markup).toContain("not reproducible from submission");
    expect(markup).toContain("concern reduced");
    expect(markup).toContain("does not prove the identifying assumption");
    expect(markup).toContain("Record a later immutable result revision");
    expect(markup).not.toContain("87%");
    expect(markup).not.toContain("causally valid");
  });

  it("renders the prospective claim boundary, stronger-claim requirements, and researcher disposition separately", () => {
    const { report, initialized, planned } = screen6Fixture();
    const saved = saveScreen6ConditionalClaimBoundary(planned.state, {
      expectedRevision: planned.state.revision,
      snapshotId: "screen6-render-claim-boundary",
      expectedPlanFingerprint: planned.plan.planFingerprint,
      claimInput: createScreen6ClaimBoundaryInput({
        intendedClaimLevel: "package_effect",
        targetDescription:
          "the effect of legal eligibility for the policy package on operating margin",
      }),
      actor: "researcher_ui",
      createdAt: browserEventCardFixtureAt(33),
    });
    const recorded = recordScreen6ResearchPlanningDisposition(saved.state, {
      expectedRevision: saved.state.revision,
      dispositionId: "screen6-render-disposition",
      expectedBoundaryFingerprint: saved.boundary.boundaryFingerprint,
      decision: "current_information_insufficient_for_intended_claim",
      rationale:
        "No current selected comparison establishes the intended package-effect claim.",
      specifiedRevisions: [],
      actor: "researcher_ui",
      decidedAt: browserEventCardFixtureAt(34),
    });
    const workspace: Screen6UncertaintyWorkspace = {
      schemaVersion: "screen-06-uncertainty-workspace-v1",
      profile: initialized.profile,
      diagnosticPlan: planned.plan,
      diagnosticResults: [],
      diagnosticResultReviews: [],
      conditionalClaimBoundary: saved.boundary,
      researchPlanningDisposition: recorded.disposition,
      researchExport: null,
      revisions: [],
      diagnosticPlanRevisions: [],
      diagnosticResultRevisions: [],
      diagnosticResultReviewRevisions: [],
      conditionalClaimBoundaryRevisions: [],
      researchPlanningDispositionRevisions: [],
      researchExportRevisions: [],
      claimBoundary,
    };
    const markup = renderToStaticMarkup(createElement(
      Screen6UncertaintyPanel,
      {
        workspace,
        limitations: report.limitations,
        disabled: false,
        canInitialize: false,
        canSaveDiagnosticPlan: true,
        canRecordDiagnosticResult: true,
        canReviewDiagnosticResult: false,
        canSaveConditionalClaimBoundary: true,
        canRecordResearchPlanningDisposition: false,
        canCreateResearchExport: true,
        onInitialize: vi.fn(async () => undefined),
        onSaveDiagnosticPlan: vi.fn(async () => undefined),
        onRecordDiagnosticResult: vi.fn(async () => undefined),
        onReviewDiagnosticResult: vi.fn(async () => undefined),
        onSaveConditionalClaimBoundary: vi.fn(async () => undefined),
        onRecordResearchPlanningDisposition: vi.fn(async () => undefined),
        onCreateResearchExport: vi.fn(async () => undefined),
      },
    ));
    expect(markup).toContain("Prospective conditional boundary");
    expect(markup).toContain("Permitted prospective statement");
    expect(markup).toContain("is intended to estimate");
    expect(markup).toContain("What each claim level requires");
    expect(markup).toContain("component specific effect");
    expect(markup).toContain("mechanism specific effect");
    expect(markup).toContain("Unassessed or partial modules");
    expect(markup).toContain("Researcher disposition: current information insufficient for intended claim");
    expect(markup).toContain("not causal certification");
    expect(markup).toContain("Create source-linked design record");
    expect(markup).toContain("Revise the intended claim boundary");
    expect(markup).not.toContain("87%");
    expect(markup).toContain("does not state that the policy caused an outcome");

    const exported = createScreen6ResearchExportRecord(recorded.state, {
      expectedRevision: recorded.state.revision,
      exportId: "screen6-render-research-export",
      expectedDispositionFingerprint:
        recorded.disposition.dispositionFingerprint,
      actor: "researcher_ui",
      exportedAt: browserEventCardFixtureAt(35),
    });
    const exportWorkspace: Screen6UncertaintyWorkspace = {
      ...workspace,
      researchExport: exported.researchExport,
      researchExportRevisions: [{
        exportId: exported.researchExport.id,
        ordinal: exported.researchExport.ordinal,
        boundarySnapshotId:
          exported.researchExport.binding.boundarySnapshotId,
        dispositionId: exported.researchExport.binding.dispositionId,
        completenessStatus: exported.researchExport.completeness.status,
        exportedAt: exported.researchExport.exportedAt,
        artifactStatus: "current",
      }],
    };
    const exportMarkup = renderToStaticMarkup(createElement(
      Screen6UncertaintyPanel,
      {
        workspace: exportWorkspace,
        limitations: report.limitations,
        disabled: false,
        canInitialize: false,
        canSaveDiagnosticPlan: true,
        canRecordDiagnosticResult: true,
        canReviewDiagnosticResult: false,
        canSaveConditionalClaimBoundary: true,
        canRecordResearchPlanningDisposition: false,
        canCreateResearchExport: false,
        onInitialize: vi.fn(async () => undefined),
        onSaveDiagnosticPlan: vi.fn(async () => undefined),
        onRecordDiagnosticResult: vi.fn(async () => undefined),
        onReviewDiagnosticResult: vi.fn(async () => undefined),
        onSaveConditionalClaimBoundary: vi.fn(async () => undefined),
        onRecordResearchPlanningDisposition: vi.fn(async () => undefined),
        onCreateResearchExport: vi.fn(async () => undefined),
      },
    ));
    expect(exportMarkup).toContain("Immutable source-linked export");
    expect(exportMarkup).toContain("bundle files");
    expect(exportMarkup).toContain("credibility-plan.json");
    expect(exportMarkup).toContain("manifest.json");
    expect(exportMarkup).toContain("Download portable JSON bundle");
    expect(exportMarkup).toContain("Exact excerpts are omitted by default");
    expect(exportMarkup).not.toContain("causally valid");
  });
});
