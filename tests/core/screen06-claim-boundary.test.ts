import { describe, expect, it } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import { createCausalComparisonInput } from
  "../../src/core/six-screen/causal-comparison";
import { createScreen6DiagnosticPlanInput } from
  "../../src/core/six-screen/screen6-diagnostic-plan";
import { createScreen6DiagnosticResultInput } from
  "../../src/core/six-screen/screen6-diagnostic-result";
import {
  createScreen6ClaimBoundaryInput,
  createScreen6ConditionalClaimBoundary,
  validateScreen6ClaimBoundaryCollections,
  type Screen6ConditionalClaimBoundary,
  type Screen6ResearchPlanningDisposition,
} from "../../src/core/six-screen/screen6-claim-boundary";
import {
  buildCausalComparison,
  currentScreen6ConditionalClaimBoundary,
  currentScreen6ResearchPlanningDisposition,
  decideCausalComparison,
  initializeScreen6UncertaintyProfile,
  openScreen3,
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

function plannedFixture(
  policyTarget: "full_policy_package" | "policy_component" =
    "full_policy_package",
) {
  const fixture = createLockedBrowserEventCardFixture();
  const opened3 = openScreen3(fixture.state, {
    expectedRevision: fixture.state.revision,
    openedAt: browserEventCardFixtureAt(30),
  });
  const built = buildCausalComparison(opened3.state, {
    expectedRevision: opened3.state.revision,
    snapshotId: `screen6-boundary-design-${policyTarget}`,
    comparisonInput: createCausalComparisonInput({
      policyTarget,
      targetDetail: policyTarget === "policy_component"
        ? "The independently varying reporting component"
        : null,
      targetClaimIds: ["claim-operative"],
      variationClaimIds: ["claim-coverage"],
      assignmentUnit: "Operator",
      proposedTreatedGroup: "Covered operators",
      proposedComparisonGroup: "Uncovered operators",
      dataAvailability: "available",
      dataFrequency: "annual",
      historicalEligibilityFields: ["coverage_status"],
      designConstraints: [],
    }),
    builtAt: browserEventCardFixtureAt(31),
  });
  const decided = decideCausalComparison(built.state, {
    expectedRevision: built.state.revision,
    snapshotId: `screen6-boundary-decision-${policyTarget}`,
    designSetSnapshotId: built.designSet.snapshotId,
    expectedDesignSetFingerprint: built.designSet.designSetFingerprint,
    decision: { mode: "selected", optionId: built.designSet.options[0]!.id },
    rationale: "Use this comparison for the prospective claim boundary.",
    actor: "researcher_ui",
    decidedAt: browserEventCardFixtureAt(32),
  });
  const opened6 = openScreen6(decided.state, {
    expectedRevision: decided.state.revision,
    openedAt: browserEventCardFixtureAt(33),
  });
  const initialized = initializeScreen6UncertaintyProfile(opened6.state, {
    expectedRevision: opened6.state.revision,
    snapshotId: `screen6-boundary-profile-${policyTarget}`,
    actor: "researcher_ui",
    createdAt: browserEventCardFixtureAt(34),
  });
  const planned = saveScreen6DiagnosticPlan(initialized.state, {
    expectedRevision: initialized.state.revision,
    snapshotId: `screen6-boundary-plan-${policyTarget}`,
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
        description: "Assignment occurs once across operators.",
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
      reportedConcerns: [
        "package_component_ambiguity",
        "unique_mechanism_claim",
      ],
    }),
    actor: "researcher_ui",
    createdAt: browserEventCardFixtureAt(35),
  });
  return { initialized, planned };
}

function packageClaimInput(description =
  "the effect of legal eligibility for the policy package on the stated outcome") {
  return createScreen6ClaimBoundaryInput({
    intendedClaimLevel: "package_effect",
    targetDescription: description,
  });
}

function qualitativeResultInput() {
  return createScreen6DiagnosticResultInput({
    resultKind: "qualitative_or_documentary",
    provenance: {
      kind: "user_reported",
      sourceDescription: "Researcher review of component variation records",
    },
    summary:
      "The available records do not show independent component variation.",
    reportedStatistics: [],
    covariance: { status: "not_applicable", dimension: null, values: [] },
    uncertaintyContext: {
      status: "not_applicable",
      description: "This documentary check reports no numerical estimate.",
    },
    specificationContext:
      "Policy versions and implementation dates were compared across operators.",
    power: {
      status: "not_applicable",
      description: "This is not a null-hypothesis test.",
    },
    multipleTesting: {
      status: "not_applicable",
      description: "No statistical-test family was interpreted.",
    },
    sampleComposition: {
      status: "assessed",
      description: "The same operator records were used throughout the check.",
    },
    precision: {
      status: "not_applicable",
      description: "No numerical estimate was supplied.",
    },
    postInspectionChange: { status: "none_reported", description: null },
  });
}

function savePackageBoundary() {
  const setup = plannedFixture();
  const saved = saveScreen6ConditionalClaimBoundary(setup.planned.state, {
    expectedRevision: setup.planned.state.revision,
    snapshotId: "screen6-package-boundary-one",
    expectedPlanFingerprint: setup.planned.plan.planFingerprint,
    claimInput: packageClaimInput(),
    actor: "researcher_ui",
    createdAt: browserEventCardFixtureAt(36),
  });
  return { ...setup, saved };
}

function refingerprintBoundary(boundary: Screen6ConditionalClaimBoundary) {
  const { boundaryFingerprint: _fingerprint, ...body } = boundary;
  return {
    ...body,
    boundaryFingerprint: fingerprintSixScreenValue(body),
  } as Screen6ConditionalClaimBoundary;
}

function refingerprintDisposition(
  disposition: Screen6ResearchPlanningDisposition,
) {
  const { dispositionFingerprint: _fingerprint, ...body } = disposition;
  return {
    ...body,
    dispositionFingerprint: fingerprintSixScreenValue(body),
  } as Screen6ResearchPlanningDisposition;
}

describe("Screen 6 conditional claim boundary and planning disposition", () => {
  it("creates a prospective package-effect boundary without diagnostic data or certification", () => {
    const { saved } = savePackageBoundary();
    expect(saved.boundary).toMatchObject({
      ordinal: 1,
      currentDesignTarget: {
        status: "established",
        claimLevel: "package_effect",
      },
      intendedClaim: {
        claimLevel: "package_effect",
        relationshipToCurrentDesign: "matches_current_design_target",
        resultsAware: false,
      },
      researchPlanning: {
        dispositionStatus: "awaiting_researcher_disposition",
        automaticRecommendation: null,
      },
      preparation: {
        networkRequests: 0,
        modelCalls: 0,
        localRoutineCalls: 0,
      },
      nonOutputs: {
        causalCertification: "not_available",
        aggregateScore: null,
        universalBadge: null,
        credibilityPlanExport: null,
        reportBundle: null,
        designRecord: null,
      },
    });
    expect(saved.boundary.diagnosticStatuses.length).toBeGreaterThan(0);
    expect(saved.boundary.diagnosticStatuses.every(({ status }) =>
      status === "planned")).toBe(true);
    expect(saved.boundary.intendedClaim.prospectiveStatement).toContain(
      "is intended to estimate",
    );
    expect(saved.boundary.intendedClaim.prospectiveStatement).not.toMatch(
      /caused|proved|valid design/iu,
    );
    expect(saved.boundary.claimLevels.map(({ claimLevel }) => claimLevel)).toEqual([
      "package_effect",
      "component_specific_effect",
      "mechanism_specific_effect",
    ]);
    expect(saved.boundary.unassessedModules.length).toBeGreaterThan(0);
    expect(saved.boundary.unresolvedHighConsequenceIssues.length).toBeGreaterThan(0);
    expect(currentScreen6ConditionalClaimBoundary(saved.state)).toEqual(
      saved.boundary,
    );
  });

  it("distinguishes a component-specific current design target", () => {
    const setup = plannedFixture("policy_component");
    const claimInput = createScreen6ClaimBoundaryInput({
      intendedClaimLevel: "component_specific_effect",
      targetDescription:
        "the effect of the independently varying reporting component on the stated outcome",
    });
    const saved = saveScreen6ConditionalClaimBoundary(setup.planned.state, {
      expectedRevision: setup.planned.state.revision,
      snapshotId: "screen6-component-boundary",
      expectedPlanFingerprint: setup.planned.plan.planFingerprint,
      claimInput,
      actor: "researcher_ui",
      createdAt: browserEventCardFixtureAt(36),
    });
    expect(saved.boundary.currentDesignTarget.claimLevel).toBe(
      "component_specific_effect",
    );
    expect(saved.boundary.intendedClaim.relationshipToCurrentDesign).toBe(
      "matches_current_design_target",
    );
    expect(saved.boundary.claimLevels.find(({ claimLevel }) =>
      claimLevel === "mechanism_specific_effect")
      ?.relationshipToCurrentDesign).toBe("requires_stronger_identification");
  });

  it("blocks proceeding with a stronger mechanism claim but permits an insufficient-information disposition", () => {
    const setup = plannedFixture();
    const boundary = saveScreen6ConditionalClaimBoundary(setup.planned.state, {
      expectedRevision: setup.planned.state.revision,
      snapshotId: "screen6-mechanism-boundary",
      expectedPlanFingerprint: setup.planned.plan.planFingerprint,
      claimInput: createScreen6ClaimBoundaryInput({
        intendedClaimLevel: "mechanism_specific_effect",
        targetDescription:
          "the effect operating uniquely through the proposed information mechanism",
      }),
      actor: "researcher_ui",
      createdAt: browserEventCardFixtureAt(36),
    });
    expect(boundary.boundary.intendedClaim.relationshipToCurrentDesign).toBe(
      "requires_stronger_identification",
    );
    expect(() => recordScreen6ResearchPlanningDisposition(boundary.state, {
      expectedRevision: boundary.state.revision,
      dispositionId: "screen6-invalid-proceed",
      expectedBoundaryFingerprint: boundary.boundary.boundaryFingerprint,
      decision: "proceed_with_documented_analysis_plan",
      rationale: "Proceed despite the unsupported mechanism target.",
      specifiedRevisions: [],
      actor: "researcher_ui",
      decidedAt: browserEventCardFixtureAt(37),
    })).toThrow(/Proceed requires.*matches/iu);
    const disposition = recordScreen6ResearchPlanningDisposition(
      boundary.state,
      {
        expectedRevision: boundary.state.revision,
        dispositionId: "screen6-mechanism-insufficient",
        expectedBoundaryFingerprint: boundary.boundary.boundaryFingerprint,
        decision: "current_information_insufficient_for_intended_claim",
        rationale:
          "The current comparison cannot identify a unique mechanism and no discriminating evidence plan has been reviewed.",
        specifiedRevisions: [],
        actor: "researcher_ui",
        decidedAt: browserEventCardFixtureAt(37),
      },
    );
    expect(disposition.disposition).toMatchObject({
      recommendationType: "research_planning_not_causal_certification",
      automaticDesignMutation: "none",
      attributionUpgrade: "none",
      causalCertification: "not_available",
      aggregateScore: null,
      credibilityPlanExport: null,
      designRecord: null,
    });
  });

  it("requires concrete revisions only for the revise-first disposition", () => {
    const { saved } = savePackageBoundary();
    expect(() => recordScreen6ResearchPlanningDisposition(saved.state, {
      expectedRevision: saved.state.revision,
      dispositionId: "screen6-empty-revision",
      expectedBoundaryFingerprint: saved.boundary.boundaryFingerprint,
      decision: "revise_specified_parts_first",
      rationale: "The comparison needs revision.",
      specifiedRevisions: [],
      actor: "researcher_ui",
      decidedAt: browserEventCardFixtureAt(37),
    })).toThrow(/requires specified revisions/iu);
    const recorded = recordScreen6ResearchPlanningDisposition(saved.state, {
      expectedRevision: saved.state.revision,
      dispositionId: "screen6-revise-first",
      expectedBoundaryFingerprint: saved.boundary.boundaryFingerprint,
      decision: "revise_specified_parts_first",
      rationale: "Resolve package separability before estimation.",
      specifiedRevisions: [
        "Retain a package-level target unless independent component variation is documented.",
      ],
      actor: "researcher_ui",
      decidedAt: browserEventCardFixtureAt(37),
    });
    expect(currentScreen6ResearchPlanningDisposition(recorded.state)).toEqual(
      recorded.disposition,
    );
    expect(recorded.disposition.retainedHighConsequenceIssueCodes).toEqual(
      saved.boundary.unresolvedHighConsequenceIssues.map(({ code }) => code),
    );
  });

  it("archives a claim boundary when a new result changes its exact lineage", () => {
    const { planned, saved } = savePackageBoundary();
    const card = planned.plan.cards.find(({ libraryEntryId }) =>
      libraryEntryId === "treatment-package-separability-v1")!;
    const recorded = recordScreen6DiagnosticResult(saved.state, {
      expectedRevision: saved.state.revision,
      resultId: "screen6-boundary-result",
      cardId: card.id,
      expectedPlanFingerprint: planned.plan.planFingerprint,
      expectedCardFingerprint: fingerprintSixScreenValue(card),
      resultInput: qualitativeResultInput(),
      actor: "researcher_ui",
      submittedAt: browserEventCardFixtureAt(37),
    });
    expect(currentScreen6ConditionalClaimBoundary(recorded.state)).toBeNull();
    expect(recorded.state.artifacts.find(({ snapshotId }) =>
      snapshotId === saved.boundary.snapshotId)?.status).toBe("archived");
    const reviewed = reviewScreen6DiagnosticResult(recorded.state, {
      expectedRevision: recorded.state.revision,
      reviewId: "screen6-boundary-review",
      resultId: recorded.result.id,
      expectedResultFingerprint: recorded.result.resultFingerprint,
      decision: "revision_needed",
      rationale:
        "Independent component variation is not established, so the target should remain package-level.",
      followUpActions: ["Retain the package-level estimand."],
      actor: "researcher_ui",
      reviewedAt: browserEventCardFixtureAt(38),
    });
    const revisedBoundary = saveScreen6ConditionalClaimBoundary(
      reviewed.state,
      {
        expectedRevision: reviewed.state.revision,
        snapshotId: "screen6-package-boundary-results-aware",
        expectedPlanFingerprint: planned.plan.planFingerprint,
        claimInput: packageClaimInput(
          "the package-level effect of legal eligibility on the stated outcome",
        ),
        actor: "researcher_ui",
        createdAt: browserEventCardFixtureAt(39),
      },
    );
    expect(revisedBoundary.boundary.intendedClaim.resultsAware).toBe(true);
    expect(revisedBoundary.boundary.diagnosticStatuses.find(({ cardId }) =>
      cardId === card.id)?.status).toBe("revision_needed");
    expect(revisedBoundary.boundary.binding).toMatchObject({
      resultHistoryLength: 1,
      reviewHistoryLength: 1,
    });
    expect(() => validateScreen6ClaimBoundaryCollections({
      profiles: reviewed.state.screen6UncertaintyProfiles ?? [],
      plans: reviewed.state.screen6DiagnosticPlans ?? [],
      results: reviewed.state.screen6DiagnosticResults ?? [],
      reviews: reviewed.state.screen6DiagnosticResultReviews ?? [],
      boundaries: [saved.boundary, revisedBoundary.boundary],
      dispositions: [],
    })).not.toThrow();
  });

  it("retains immutable boundary and disposition revisions", () => {
    const { planned, saved } = savePackageBoundary();
    const disposition = recordScreen6ResearchPlanningDisposition(saved.state, {
      expectedRevision: saved.state.revision,
      dispositionId: "screen6-first-disposition",
      expectedBoundaryFingerprint: saved.boundary.boundaryFingerprint,
      decision: "revise_specified_parts_first",
      rationale: "Clarify the prospective outcome definition.",
      specifiedRevisions: ["Clarify the outcome definition before estimation."],
      actor: "researcher_ui",
      decidedAt: browserEventCardFixtureAt(37),
    });
    const revised = saveScreen6ConditionalClaimBoundary(disposition.state, {
      expectedRevision: disposition.state.revision,
      snapshotId: "screen6-package-boundary-two",
      expectedPlanFingerprint: planned.plan.planFingerprint,
      claimInput: packageClaimInput(
        "the effect of legal eligibility for the policy package on annual operating margin",
      ),
      actor: "researcher_ui",
      createdAt: browserEventCardFixtureAt(38),
    });
    expect(revised.state.screen6ConditionalClaimBoundaries).toHaveLength(2);
    expect(revised.state.screen6ResearchPlanningDispositions).toHaveLength(1);
    expect(revised.boundary.previousBoundary).toEqual({
      snapshotId: saved.boundary.snapshotId,
      boundaryFingerprint: saved.boundary.boundaryFingerprint,
    });
    expect(currentScreen6ConditionalClaimBoundary(revised.state)).toEqual(
      revised.boundary,
    );
    expect(currentScreen6ResearchPlanningDisposition(revised.state)).toBeNull();
    expect(revised.state.artifacts.find(({ snapshotId }) =>
      snapshotId === saved.boundary.snapshotId)?.status).toBe("archived");
    expect(revised.state.artifacts.find(({ snapshotId }) =>
      snapshotId === disposition.disposition.id)?.status).toBe("archived");
  });

  it("rejects non-researcher ownership and re-fingerprinted favorable tampering", () => {
    const setup = plannedFixture();
    expect(() => createScreen6ConditionalClaimBoundary({
      snapshotId: "screen6-model-boundary",
      profile: setup.initialized.profile,
      plan: setup.planned.plan,
      claimInput: packageClaimInput(),
      resultHistory: [],
      reviewHistory: [],
      priorBoundaries: [],
      actor: "model",
      createdAt: browserEventCardFixtureAt(36),
    })).toThrow(/explicit researcher UI action/iu);

    const saved = saveScreen6ConditionalClaimBoundary(setup.planned.state, {
      expectedRevision: setup.planned.state.revision,
      snapshotId: "screen6-tamper-boundary",
      expectedPlanFingerprint: setup.planned.plan.planFingerprint,
      claimInput: packageClaimInput(),
      actor: "researcher_ui",
      createdAt: browserEventCardFixtureAt(36),
    });
    const tamperedBoundary = structuredClone(saved.boundary);
    tamperedBoundary.nonOutputs.causalCertification = "available" as never;
    expect(() => validateScreen6ClaimBoundaryCollections({
      profiles: saved.state.screen6UncertaintyProfiles ?? [],
      plans: saved.state.screen6DiagnosticPlans ?? [],
      results: [],
      reviews: [],
      boundaries: [refingerprintBoundary(tamperedBoundary)],
      dispositions: [],
    })).toThrow(/conditional claim boundary is invalid/iu);

    const recorded = recordScreen6ResearchPlanningDisposition(saved.state, {
      expectedRevision: saved.state.revision,
      dispositionId: "screen6-tamper-disposition",
      expectedBoundaryFingerprint: saved.boundary.boundaryFingerprint,
      decision: "proceed_with_documented_analysis_plan",
      rationale:
        "Proceed prospectively while retaining every recorded limitation.",
      specifiedRevisions: [],
      actor: "researcher_ui",
      decidedAt: browserEventCardFixtureAt(37),
    });
    const tamperedDisposition = structuredClone(recorded.disposition);
    tamperedDisposition.attributionUpgrade = "automatic" as never;
    expect(() => validateScreen6ClaimBoundaryCollections({
      profiles: recorded.state.screen6UncertaintyProfiles ?? [],
      plans: recorded.state.screen6DiagnosticPlans ?? [],
      results: [],
      reviews: [],
      boundaries: [saved.boundary],
      dispositions: [refingerprintDisposition(tamperedDisposition)],
    })).toThrow(/research-planning disposition is invalid/iu);
  });
});
