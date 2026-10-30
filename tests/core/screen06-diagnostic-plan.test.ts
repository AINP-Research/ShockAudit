import { describe, expect, it } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import {
  INITIAL_SCREEN6_DIAGNOSTIC_LIBRARY,
  SCREEN6_DIAGNOSTIC_LIBRARY_ENTRY_IDS,
  SIX_SCREEN_DIAGNOSTIC_LIBRARY_FINGERPRINT,
  createScreen6DiagnosticPlan,
  createScreen6DiagnosticPlanInput,
  screen6ReviewedDiagnosticLibrary,
  selectScreen6ReviewedDiagnostics,
  validateScreen6DiagnosticPlanCollection,
  type Screen6DiagnosticPlan,
} from "../../src/core/six-screen/screen6-diagnostic-plan";
import { createCausalComparisonInput } from
  "../../src/core/six-screen/causal-comparison";
import {
  buildCausalComparison,
  currentScreen6DiagnosticPlan,
  currentScreen6UncertaintyProfile,
  decideCausalComparison,
  initializeScreen6UncertaintyProfile,
  openScreen3,
  openScreen6,
  saveScreen6DiagnosticPlan,
  updateStudyContext,
  type StudyContextDraft,
} from "../../src/core/six-screen/workflow";
import {
  browserEventCardFixtureAt,
  createBrowserEventCardFixture,
  createLockedBrowserEventCardFixture,
} from "../browser/six-screen-event-card-review-fixture";

function diagnosticInput(overrides: Partial<Parameters<
  typeof createScreen6DiagnosticPlanInput
>[0]> = {}) {
  return createScreen6DiagnosticPlanInput({
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
      description: "Policy assignment varies by market and adoption cohort.",
      timingPattern: "staggered",
      dependence: "grouped_or_clustered",
      independentGroupCount: 12,
      groupingVariables: ["market_id"],
    },
    feasibleDiagnosticVariables: {
      status: "available",
      values: ["outcome", "market_id", "first_eligibility_year"],
    },
    practicalConstraints: {
      status: "reported",
      values: ["Historical unit-level exposure is available only annually."],
    },
    reportedConcerns: [
      "remaining_trend_concern",
      "announcement_before_implementation",
      "staggered_adoption",
      "relevant_coevent",
      "comparison_contamination",
      "package_component_ambiguity",
      "outcome_or_sample_discontinuity",
      "proposed_negative_control",
      "group_level_assignment_or_dependence",
      "unique_mechanism_claim",
    ],
    ...overrides,
  });
}

function initializedFixture() {
  const fixture = createBrowserEventCardFixture();
  const opened = openScreen6(fixture.state, {
    expectedRevision: fixture.state.revision,
    openedAt: browserEventCardFixtureAt(30),
  });
  const initialized = initializeScreen6UncertaintyProfile(opened.state, {
    expectedRevision: opened.state.revision,
    snapshotId: "screen6-diagnostic-parent-profile",
    actor: "researcher_ui",
    createdAt: browserEventCardFixtureAt(31),
  });
  return { fixture, opened, initialized };
}

function selectedDidFixture() {
  const fixture = createLockedBrowserEventCardFixture();
  const opened3 = openScreen3(fixture.state, {
    expectedRevision: fixture.state.revision,
    openedAt: browserEventCardFixtureAt(30),
  });
  const built = buildCausalComparison(opened3.state, {
    expectedRevision: opened3.state.revision,
    snapshotId: "screen6-diagnostic-did-set",
    comparisonInput: createCausalComparisonInput({
      policyTarget: "full_policy_package",
      targetDetail: null,
      targetClaimIds: ["claim-operative"],
      variationClaimIds: ["claim-coverage"],
      assignmentUnit: "Operator",
      proposedTreatedGroup: "Covered market operators",
      proposedComparisonGroup: "Uncovered market operators",
      dataAvailability: "available",
      dataFrequency: "annual",
      historicalEligibilityFields: ["coverage_status"],
      designConstraints: [],
    }),
    builtAt: browserEventCardFixtureAt(31),
  });
  const decided = decideCausalComparison(built.state, {
    expectedRevision: built.state.revision,
    snapshotId: "screen6-diagnostic-did-decision",
    designSetSnapshotId: built.designSet.snapshotId,
    expectedDesignSetFingerprint: built.designSet.designSetFingerprint,
    decision: {
      mode: "selected",
      optionId: built.designSet.options[0]!.id,
    },
    rationale:
      "Carry this conditional difference-in-differences comparison into Screen 6.",
    actor: "researcher_ui",
    decidedAt: browserEventCardFixtureAt(32),
  });
  const opened6 = openScreen6(decided.state, {
    expectedRevision: decided.state.revision,
    openedAt: browserEventCardFixtureAt(33),
  });
  const initialized = initializeScreen6UncertaintyProfile(opened6.state, {
    expectedRevision: opened6.state.revision,
    snapshotId: "screen6-diagnostic-did-profile",
    actor: "researcher_ui",
    createdAt: browserEventCardFixtureAt(34),
  });
  return { fixture, built, decided, initialized };
}

function studyDraft(
  state: ReturnType<typeof createBrowserEventCardFixture>["state"],
): StudyContextDraft {
  return {
    population: state.study.population,
    analysisUnit: state.study.analysisUnit,
    geography: [...state.study.geography],
    industry: [...state.study.industry],
    period: structuredClone(state.study.period),
    outcome: state.study.outcome,
    intendedConstruct: state.study.intendedConstruct,
    initialExplanation: state.study.initialExplanation,
    proposedTreatment: state.study.proposedTreatment,
    proposedComparison: state.study.proposedComparison,
    resultsPreviouslyInspected: state.study.resultsPreviouslyInspected,
  };
}

function refingerprint(plan: Screen6DiagnosticPlan) {
  const { planFingerprint: _fingerprint, ...body } = plan;
  return {
    ...body,
    planFingerprint: fingerprintSixScreenValue(body),
  } as Screen6DiagnosticPlan;
}

describe("Screen 6 reviewed diagnostic planning", () => {
  it("exposes the exact 13-entry reviewed manual library with complete limits and provenance", () => {
    const library = screen6ReviewedDiagnosticLibrary();
    expect(library.map(({ id }) => id)).toEqual(
      SCREEN6_DIAGNOSTIC_LIBRARY_ENTRY_IDS,
    );
    expect(library).toHaveLength(13);
    expect(fingerprintSixScreenValue(library)).toBe(
      SIX_SCREEN_DIAGNOSTIC_LIBRARY_FINGERPRINT,
    );
    expect(library.every((entry) =>
      entry.prerequisites.length > 0 &&
      entry.requiredData.length > 0 &&
      entry.procedure.length > 0 &&
      entry.patternsRaisingConcern.length > 0 &&
      entry.alternativeExplanations.length > 0 &&
      entry.interpretiveLimits.length > 0 &&
      entry.sourceReferences.length > 0 &&
      entry.possibleDesignResponses.length > 0
    )).toBe(true);
    expect(INITIAL_SCREEN6_DIAGNOSTIC_LIBRARY.find(({ id }) =>
      id === "did-pre-treatment-dynamics-v1")?.interpretiveLimits.join(" "))
      .toMatch(/does not prove parallel trends/iu);
  });

  it("selects only compatible reviewed entries from design and researcher triggers", () => {
    const input = diagnosticInput();
    const did = selectScreen6ReviewedDiagnostics({
      selectedDesignFamily: "difference_in_differences",
      policyTarget: "policy_component",
      hasCoEventSnapshot: true,
      hasMechanismSnapshot: true,
      diagnosticInput: input,
    });
    expect(did.map(({ entryId }) => entryId)).toEqual([
      "did-pre-treatment-dynamics-v1",
      "did-parallel-trends-sensitivity-v1",
      "timing-anticipation-v1",
      "did-staggered-adoption-v1",
      "coevent-exposure-alternatives-v1",
      "interference-spillover-mapping-v1",
      "treatment-package-separability-v1",
      "outcome-sample-continuity-v1",
      "negative-control-justification-v1",
      "group-inference-clustering-v1",
      "mechanism-discrimination-v1",
    ]);

    const threshold = selectScreen6ReviewedDiagnostics({
      selectedDesignFamily: "threshold_eligibility",
      policyTarget: "legal_eligibility",
      hasCoEventSnapshot: false,
      hasMechanismSnapshot: false,
      diagnosticInput: input,
    });
    expect(threshold.map(({ entryId }) => entryId)).toEqual([
      "timing-anticipation-v1",
      "rd-eligibility-cutoff-v1",
      "rd-functional-sensitivity-v1",
      "coevent-exposure-alternatives-v1",
      "interference-spillover-mapping-v1",
      "treatment-package-separability-v1",
      "outcome-sample-continuity-v1",
      "negative-control-justification-v1",
      "group-inference-clustering-v1",
      "mechanism-discrimination-v1",
    ]);
    expect(threshold.map(({ entryId }) => entryId)).not.toContain(
      "did-staggered-adoption-v1",
    );
  });

  it("keeps nested assignment and grouped-inference omissions visible", () => {
    const { initialized } = initializedFixture();
    const saved = saveScreen6DiagnosticPlan(initialized.state, {
      expectedRevision: initialized.state.revision,
      snapshotId: "screen6-diagnostic-group-gap-plan",
      diagnosticInput: diagnosticInput({
        assignmentStructure: {
          status: "described",
          description: "Policy assignment and dependence may occur by group.",
          timingPattern: "not_assessed",
          dependence: "grouped_or_clustered",
          independentGroupCount: null,
          groupingVariables: [],
        },
        reportedConcerns: ["group_level_assignment_or_dependence"],
      }),
      actor: "researcher_ui",
      createdAt: browserEventCardFixtureAt(32),
    });
    expect(saved.plan.diagnosticInputGaps).toEqual(expect.arrayContaining([
      "Assignment timing has not been assessed.",
      "The independent group count has not been recorded.",
      "Grouping variables have not been recorded.",
    ]));
    expect(saved.plan.cards).toHaveLength(1);
    expect(saved.plan.cards[0]?.missingPrerequisites).toEqual(
      expect.arrayContaining([
        "The independent group count is not recorded.",
        "Clustering or grouping variables are not recorded.",
      ]),
    );
  });

  it("saves concern-specific planned cards with explicit method and input gaps when no design is selected", () => {
    const { initialized } = initializedFixture();
    const input = diagnosticInput();
    const saved = saveScreen6DiagnosticPlan(initialized.state, {
      expectedRevision: initialized.state.revision,
      snapshotId: "screen6-diagnostic-plan-one",
      diagnosticInput: input,
      actor: "researcher_ui",
      createdAt: browserEventCardFixtureAt(32),
    });
    expect(saved.plan.methodSupport).toMatchObject({
      status: "no_selected_design",
      issueList: expect.arrayContaining([
        expect.stringMatching(/cannot prescribe a design-specific estimator/iu),
        expect.stringMatching(/no difference-in-differences design is selected/iu),
      ]),
    });
    expect(saved.plan.selectedDiagnosticIds).not.toContain(
      "did-pre-treatment-dynamics-v1",
    );
    expect(saved.plan.selectedDiagnosticIds).not.toContain(
      "did-staggered-adoption-v1",
    );
    expect(saved.plan.selectedDiagnosticIds).toEqual([
      "timing-anticipation-v1",
      "coevent-exposure-alternatives-v1",
      "interference-spillover-mapping-v1",
      "treatment-package-separability-v1",
      "outcome-sample-continuity-v1",
      "negative-control-justification-v1",
      "group-inference-clustering-v1",
      "mechanism-discrimination-v1",
    ]);
    expect(saved.plan.cards.map(({ libraryEntryId }) => libraryEntryId)).toEqual([
      "timing-anticipation-v1",
      "treatment-package-separability-v1",
      "outcome-sample-continuity-v1",
      "group-inference-clustering-v1",
      "interference-spillover-mapping-v1",
      "mechanism-discrimination-v1",
      "coevent-exposure-alternatives-v1",
      "negative-control-justification-v1",
    ]);
    expect(saved.plan.priorityPlan.rankingBasis).toBe(
      "identification_consequence_then_recorded_feasibility_then_reviewed_order",
    );
    expect(saved.plan.cards.every((card) =>
      card.status === "planned" && card.result === null &&
      card.resultInterpretation === null)).toBe(true);
    expect(saved.plan.nonOutputs).toEqual({
      diagnosticResults: [],
      aggregateScore: null,
      universalBadge: null,
      certification: "not_available",
      conditionalClaimBoundary: null,
      disposition: null,
      designRecord: null,
    });
    expect(saved.plan.preparation).toEqual({
      actor: "researcher",
      method: "deterministic_reviewed_library",
      networkRequests: 0,
      modelCalls: 0,
    });
    expect(currentScreen6DiagnosticPlan(saved.state)?.snapshotId).toBe(
      saved.plan.snapshotId,
    );
    expect(currentScreen6UncertaintyProfile(saved.state)?.snapshotId).toBe(
      initialized.profile.snapshotId,
    );
    expect(saved.state.artifacts.filter(({ screen, status }) =>
      screen === 6 && status === "current").map(({ snapshotId }) => snapshotId))
      .toEqual([initialized.profile.snapshotId, saved.plan.snapshotId]);
  });

  it("binds a selected DiD decision and automatically plans only its reviewed core checks", () => {
    const { initialized, decided } = selectedDidFixture();
    const input = diagnosticInput({ reportedConcerns: [] });
    const saved = saveScreen6DiagnosticPlan(initialized.state, {
      expectedRevision: initialized.state.revision,
      snapshotId: "screen6-diagnostic-did-plan",
      diagnosticInput: input,
      actor: "researcher_ui",
      createdAt: browserEventCardFixtureAt(35),
    });
    expect(saved.plan.designContext).toMatchObject({
      status: "selected",
      decisionSnapshotId: decided.decision.snapshotId,
      selectedDesignSnapshotId: decided.decision.selectedDesign?.snapshotId,
      selectedDesignFamily: "difference_in_differences",
      policyTarget: "full_policy_package",
    });
    expect(saved.plan.methodSupport).toEqual({
      status: "reviewed_design_family",
      issueList: [],
    });
    expect(saved.plan.selectedDiagnosticIds).toEqual([
      "did-pre-treatment-dynamics-v1",
      "did-parallel-trends-sensitivity-v1",
      "did-staggered-adoption-v1",
      "group-inference-clustering-v1",
    ]);
    expect(saved.plan.cards.find(({ libraryEntryId }) =>
      libraryEntryId === "did-pre-treatment-dynamics-v1")).toMatchObject({
        status: "planned",
        result: null,
        sourceSnapshotIds: [decided.decision.snapshotId],
        missingPrerequisites: [],
      });
    expect(saved.plan.dimensions.find(({ dimension }) =>
      dimension === "counterfactual_comparison")).toMatchObject({
        state: "planned",
        diagnosticCardIds: expect.arrayContaining([
          "screen6-diagnostic-did-plan-did-pre-treatment-dynamics-v1",
        ]),
      });
  });

  it("keeps immutable plan revisions, rejects duplicate inputs, and archives only the prior plan", () => {
    const { initialized } = initializedFixture();
    const firstInput = diagnosticInput({
      reportedConcerns: ["outcome_or_sample_discontinuity"],
    });
    const first = saveScreen6DiagnosticPlan(initialized.state, {
      expectedRevision: initialized.state.revision,
      snapshotId: "screen6-diagnostic-plan-first",
      diagnosticInput: firstInput,
      actor: "researcher_ui",
      createdAt: browserEventCardFixtureAt(32),
    });
    expect(() => saveScreen6DiagnosticPlan(first.state, {
      expectedRevision: first.state.revision,
      snapshotId: "screen6-diagnostic-plan-duplicate",
      diagnosticInput: firstInput,
      actor: "researcher_ui",
      createdAt: browserEventCardFixtureAt(33),
    })).toThrow(/inputs.*already used/iu);

    const secondInput = diagnosticInput({
      reportedConcerns: [
        "outcome_or_sample_discontinuity",
        "proposed_negative_control",
      ],
    });
    const second = saveScreen6DiagnosticPlan(first.state, {
      expectedRevision: first.state.revision,
      snapshotId: "screen6-diagnostic-plan-second",
      diagnosticInput: secondInput,
      actor: "researcher_ui",
      createdAt: browserEventCardFixtureAt(34),
    });
    expect(second.state.screen6DiagnosticPlans).toHaveLength(2);
    expect(currentScreen6DiagnosticPlan(second.state)?.snapshotId).toBe(
      second.plan.snapshotId,
    );
    expect(second.state.artifacts.find(({ snapshotId }) =>
      snapshotId === first.plan.snapshotId)).toMatchObject({
        status: "archived",
      });
    expect(second.state.artifacts.find(({ snapshotId }) =>
      snapshotId === initialized.profile.snapshotId)).toMatchObject({
        status: "current",
      });
  });

  it("rejects model ownership and re-fingerprinted interpretive tampering", () => {
    const { initialized } = initializedFixture();
    const input = diagnosticInput({
      reportedConcerns: ["proposed_negative_control"],
    });
    expect(() => createScreen6DiagnosticPlan({
      snapshotId: "screen6-diagnostic-plan-model",
      ordinal: 1,
      profile: initialized.profile,
      designSet: null,
      designDecision: null,
      diagnosticInput: input,
      actor: "model",
      createdAt: browserEventCardFixtureAt(32),
    })).toThrow(/explicit researcher UI action/iu);

    const saved = saveScreen6DiagnosticPlan(initialized.state, {
      expectedRevision: initialized.state.revision,
      snapshotId: "screen6-diagnostic-plan-tamper",
      diagnosticInput: input,
      actor: "researcher_ui",
      createdAt: browserEventCardFixtureAt(32),
    });
    const tampered = structuredClone(saved.plan) as Screen6DiagnosticPlan;
    tampered.cards[0]!.interpretiveLimits[0] =
      "This diagnostic proves the design is causally valid.";
    expect(() => validateScreen6DiagnosticPlanCollection({
      plans: [refingerprint(tampered)],
      profiles: [initialized.profile],
      designSets: [],
      designDecisions: [],
    })).toThrow(/diagnostic plan is invalid/iu);
  });

  it("makes the plan and its parent profile noncurrent after a study dependency changes", () => {
    const { initialized } = initializedFixture();
    const saved = saveScreen6DiagnosticPlan(initialized.state, {
      expectedRevision: initialized.state.revision,
      snapshotId: "screen6-diagnostic-plan-invalidation",
      diagnosticInput: diagnosticInput({
        reportedConcerns: ["outcome_or_sample_discontinuity"],
      }),
      actor: "researcher_ui",
      createdAt: browserEventCardFixtureAt(32),
    });
    const draft = studyDraft(saved.state);
    const changed = updateStudyContext(saved.state, {
      expectedRevision: saved.state.revision,
      study: { ...draft, outcome: `${draft.outcome} revised` },
      updatedAt: browserEventCardFixtureAt(33),
    });
    expect(currentScreen6UncertaintyProfile(changed)).toBeNull();
    expect(currentScreen6DiagnosticPlan(changed)).toBeNull();
    expect(changed.artifacts.filter(({ snapshotId }) =>
      snapshotId === initialized.profile.snapshotId ||
      snapshotId === saved.plan.snapshotId).every(({ status }) =>
        status === "out_of_date")).toBe(true);
  });
});
