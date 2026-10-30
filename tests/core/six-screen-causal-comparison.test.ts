import { describe, expect, it, vi } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import { createEvidenceSnapshot } from
  "../../src/core/six-screen/evidence";
import {
  createCausalComparisonInput,
  createCausalDesignDecision,
  createCausalDesignSet,
  parseStructuredEligibilityRule,
  validateCausalDesignDecision,
  validateCausalDesignSet,
  type CausalComparisonInput,
} from "../../src/core/six-screen/causal-comparison";
import {
  createCoEventSearchScopeInput,
  validateCoEventSearchMatrix,
} from "../../src/core/six-screen/co-event-search";
import {
  createCoEventExecutionPlan,
  validateCoEventCandidateOccurrence,
  validateCoEventExecutionPlan,
  type CoEventCandidateOccurrence,
} from "../../src/core/six-screen/co-event-execution";
import {
  applyPolicyEventCardClaimDecision,
  applyPolicyTreatmentClockDecision,
  beginPolicyEventCardReview,
  buildCausalComparison,
  currentCausalDesignDecision,
  currentCausalDesignSet,
  currentCoEventExecutionPlan,
  currentCoEventSearchMatrix,
  currentCoEventSearchExecution,
  decideCausalComparison,
  lockReviewedPolicyEventCard,
  openScreen2,
  openScreen3,
  openScreen4,
  recordCoEventSearchExecution,
  recordPolicyLifecycleStageDocumentAcquisition,
  proposePolicyLifecycleStageRevision,
  reviewCoEventDuplicatePair,
  reviewCoEventOccurrence,
  reviewCoEventRelation,
  reviewPolicyLifecycleStageDocument,
  reviewPolicyLifecycleStageRevision,
  routeCoEventPolicyStageToScreen2,
  saveCoEventSearchMatrix,
  screen3PrerequisiteReport,
  screen4PrerequisiteReport,
  updateStudyContext,
  type StudyContextDraft,
} from "../../src/core/six-screen/workflow";
import { createPolicyChronologySourcePanel } from
  "../../src/core/six-screen/policy-chronology";
import {
  createBrowserEventCardFixture,
} from "../browser/six-screen-event-card-review-fixture";
import {
  coEventProviderExecutionCapabilities,
  executeCoEventProviderStep,
} from "../../src/worker/screen04-coevent-execution";
import { buildSixScreenSourceRegister } from
  "../../src/worker/six-screen-source-register";
import { validateCoEventPolicyLifecycleHandoffCollection } from
  "../../src/core/six-screen/co-event-policy-lifecycle-handoff";
import {
  SIX_SCREEN_POLICY_LIFECYCLE_STAGE_SOURCE_VERSION,
  createPolicyLifecycleStageDocumentAcquisition,
  createPolicyLifecycleStageOfficialSource,
  policyLifecycleStageLegalVersionDates,
  validatePolicyLifecycleStageReviewCollections,
} from "../../src/core/six-screen/policy-lifecycle-stage-review";
import {
  policyLifecycleStageSourceDateOptions,
  validatePolicyLifecycleStageRevisionCollections,
} from "../../src/core/six-screen/policy-lifecycle-stage-revision";

function at(second: number) {
  return new Date(Date.parse("2026-09-13T10:00:00.000Z") + second * 1_000)
    .toISOString();
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
    initialExplanation:
      "How does the policy affect market participation among covered operators?",
    proposedTreatment: "Covered market operators",
    proposedComparison: "Otherwise comparable uncovered market operators",
    resultsPreviouslyInspected: state.study.resultsPreviouslyInspected,
  };
}

function projectionWithEligibilityRule(
  projection: ReturnType<typeof createBrowserEventCardFixture>["projection"],
) {
  const next = structuredClone(projection);
  for (const source of next.sourcePanel.sources) {
    const coverage = source.claims.find(({ claimId }) =>
      claimId === "claim-coverage");
    if (!coverage) continue;
    coverage.typedValue = {
      schemaVersion: "policy-eligibility-rule-v1",
      complete: true,
      logic: "all",
      assignmentUnit: "Operator",
      conditions: [
        {
          id: "capacity-cutoff",
          kind: "threshold",
          description: "Historical storage capacity is at least 100 MW.",
          variable: "historical_storage_capacity_mw",
          operator: "gte",
          value: 100,
          unit: "MW",
          referencePeriod: "2019",
        },
        {
          id: "market-status",
          kind: "categorical",
          description: "The operator serves the organized market.",
          variable: "organized_market_operator",
          operator: "eq",
          value: true,
          unit: null,
          referencePeriod: "2019",
        },
      ],
      exemptions: ["Operators under an approved transition waiver"],
      grandfathering: [],
      historicalMeasurementYears: ["2019"],
    };
  }
  const { projectionFingerprint: _fingerprint, ...body } = next;
  next.projectionFingerprint = fingerprintSixScreenValue(body);
  return next;
}

function projectionWithCoverageConflict(
  fixture: ReturnType<typeof createBrowserEventCardFixture>,
) {
  const collection = structuredClone(fixture.collection);
  const coverage = collection.claims.find(({ id }) => id === "claim-coverage")!;
  collection.passages.push({
    id: "passage-coverage-conflict",
    sourceId: collection.sources[0]!.id,
    documentVersionId: collection.documentVersions[0]!.id,
    locator: "Section passage-coverage-conflict",
    exactText:
      "Operators under an approved transition waiver are outside the covered market.",
    startOffset: null,
    endOffset: null,
    qualification: "The scope of the transition waiver is unresolved.",
    unresolvedCrossReferences: [],
  });
  coverage.supportStatus = "conflicting";
  coverage.opposingPassageIds = ["passage-coverage-conflict"];
  collection.claims.push({
    id: "claim-coverage-transition-waiver",
    eventId: coverage.eventId,
    predicate: "coverage_condition",
    typedValue: { population: "transition-waiver operators", covered: false },
    statement:
      "Operators under an approved transition waiver are outside the covered market.",
    scope: "Organizational coverage",
    supportingPassageIds: ["passage-coverage-conflict"],
    opposingPassageIds: ["passage-coverage"],
    supportStatus: "conflicting",
    reviewStatus: "unreviewed",
    criticalFor: ["screen-2", "screen-3"],
  });
  collection.conflicts.push({
    id: "conflict-coverage-waiver",
    eventId: coverage.eventId,
    predicate: "coverage_condition",
    claimIds: ["claim-coverage", "claim-coverage-transition-waiver"],
    competingValues: [
      { population: "covered market operators" },
      { population: "transition-waiver operators", covered: false },
    ],
    scopes: ["Organizational coverage", "Organizational coverage"],
    sourceRoles: ["controlling legal text", "controlling legal text"],
    kind: "substantive",
    resolution: null,
    reviewStatus: "unreviewed",
  });
  const snapshot = createEvidenceSnapshot({
    id: fixture.evidenceSnapshot.id,
    revision: fixture.evidenceSnapshot.revision,
    eventId: coverage.eventId,
    createdAt: fixture.evidenceSnapshot.createdAt,
    collection,
  });
  return createPolicyChronologySourcePanel({
    identityFingerprint: fixture.state.confirmedShock!.identityFingerprint,
    snapshot,
    collection,
  });
}

function projectionWithCompleteCoverage(
  fixture: ReturnType<typeof createBrowserEventCardFixture>,
) {
  const collection = structuredClone(fixture.collection);
  const exemption = collection.requirements.find(({ kind }) =>
    kind === "exemption");
  if (exemption) exemption.status = "not_applicable";
  const snapshot = createEvidenceSnapshot({
    id: fixture.evidenceSnapshot.id,
    revision: fixture.evidenceSnapshot.revision,
    eventId: fixture.state.confirmedShock!.id,
    createdAt: fixture.evidenceSnapshot.createdAt,
    collection,
  });
  return createPolicyChronologySourcePanel({
    identityFingerprint: fixture.state.confirmedShock!.identityFingerprint,
    snapshot,
    collection,
  });
}

function lockedFixture(input: {
  threshold?: boolean;
  conflict?: boolean;
  completeCoverage?: boolean;
  selectClock?: boolean;
} = {}) {
  const fixture = createBrowserEventCardFixture();
  let state = updateStudyContext(fixture.state, {
    expectedRevision: fixture.state.revision,
    study: studyDraft(fixture.state),
    updatedAt: at(1),
  });
  const projection = input.threshold
    ? projectionWithEligibilityRule(fixture.projection)
    : input.conflict
      ? projectionWithCoverageConflict(fixture)
      : input.completeCoverage
        ? projectionWithCompleteCoverage(fixture)
        : fixture.projection;
  if (input.conflict || input.completeCoverage) {
    state.policyReview!.evidenceSnapshotFingerprint =
      projection.binding.evidenceSnapshotFingerprint;
  }
  let begun = beginPolicyEventCardReview(state, {
    expectedRevision: state.revision,
    reviewId: "screen3-event-card-review",
    projection,
    startedAt: at(2),
  });
  state = begun.state;
  let review = begun.review;
  for (const claim of review.claimReviews) {
    const outcome = applyPolicyEventCardClaimDecision(state, {
      expectedRevision: state.revision,
      reviewId: review.id,
      projection,
      expectedReviewRevision: review.revision,
      expectedReviewFingerprint: review.reviewFingerprint,
      actionId: `accept-${claim.claimId}`,
      claimId: claim.claimId,
      decision: "accepted",
      rationale: "Retain this source-linked premise for conditional design work.",
      actor: "researcher_ui",
      decidedAt: at(3 + review.revision),
    });
    state = outcome.state;
    review = outcome.review;
  }
  const clockDecision = input.selectClock
    ? {
        mode: "selected" as const,
        candidateId: projection.treatmentClockReview.candidates.find(
          ({ stage }) => stage === "legal_effect",
        )!.id,
      }
    : { mode: "no_selection" as const };
  const clock = applyPolicyTreatmentClockDecision(state, {
    expectedRevision: state.revision,
    reviewId: review.id,
    projection,
    expectedReviewRevision: review.revision,
    expectedReviewFingerprint: review.reviewFingerprint,
    actionId: "screen3-clock-decision",
    decision: clockDecision,
    rationale: input.selectClock
      ? "Use legal effect as a candidate study clock while retaining its qualification."
      : "No legal stage yet establishes unit-level treatment timing.",
    actor: "researcher_ui",
    decidedAt: at(20),
  });
  state = clock.state;
  review = clock.review;
  const locked = lockReviewedPolicyEventCard(state, {
    expectedRevision: state.revision,
    reviewId: review.id,
    projection,
    expectedReviewRevision: review.revision,
    expectedReviewFingerprint: review.reviewFingerprint,
    actionId: "lock-screen3-event-card",
    eventCardSnapshotId: "event-card-screen3-current",
    rationale: "Lock the reviewed evidence while preserving every limitation.",
    actor: "researcher_ui",
    lockedAt: at(21),
  });
  state = openScreen3(locked.state, {
    expectedRevision: locked.state.revision,
    openedAt: at(22),
  }).state;
  return {
    state,
    review: locked.review,
    eventCard: locked.eventCard,
    projection,
  };
}

function comparisonInput(
  overrides: Partial<Omit<
    CausalComparisonInput,
    "schemaVersion" | "inputFingerprint"
  >> = {},
) {
  return createCausalComparisonInput({
    policyTarget: "full_policy_package",
    targetDetail: null,
    targetClaimIds: ["claim-operative"],
    variationClaimIds: ["claim-coverage"],
    assignmentUnit: "Operator",
    proposedTreatedGroup: "Covered market operators",
    proposedComparisonGroup: "Otherwise comparable uncovered operators",
    dataAvailability: "not_assessed",
    dataFrequency: null,
    historicalEligibilityFields: [],
    designConstraints: [],
    ...overrides,
  });
}

function designSet(input: {
  threshold?: boolean;
  conflict?: boolean;
  completeCoverage?: boolean;
  selectClock?: boolean;
  comparison?: CausalComparisonInput;
} = {}) {
  const fixture = lockedFixture(input);
  return {
    fixture,
    designSet: createCausalDesignSet({
      snapshotId: "causal-design-set-1",
      ordinal: 1,
      comparisonInput: input.comparison ?? comparisonInput(),
      study: fixture.state.study,
      confirmedShock: fixture.state.confirmedShock!,
      eventCard: fixture.eventCard,
      eventCardReview: fixture.review,
      createdAt: at(23),
    }),
  };
}

describe("Screen 3 reviewed causal-comparison engine", () => {
  it("does not treat an isolated number or incomplete object as a threshold rule", () => {
    expect(parseStructuredEligibilityRule(100)).toBeNull();
    expect(parseStructuredEligibilityRule({
      schemaVersion: "policy-eligibility-rule-v1",
      complete: false,
      threshold: 100,
    })).toBeNull();
  });

  it("creates a source-linked DiD option while retaining missing clock and data prerequisites", () => {
    const { designSet: set } = designSet();

    expect(set.status).toBe("options_available");
    expect(set.options).toHaveLength(1);
    expect(set.options[0]).toMatchObject({
      family: "difference_in_differences",
      status: "needs_institutional_review",
      assignmentUnit: "Operator",
      analysisUnit: "Operator",
      eligibilityRule: null,
      supportingEvidence: expect.arrayContaining([
        expect.objectContaining({
          claimId: "claim-coverage",
          passageIds: ["passage-coverage"],
          sourceIds: ["source-provider-neutral-official-fixture"],
        }),
      ]),
    });
    expect(set.options[0]!.missingPrerequisites.join(" ")).toMatch(
      /treatment clock|data frequency|historical fields/iu,
    );
    expect(set.options[0]!.unsupportedClaims.join(" ")).toMatch(
      /parallel trends|caused/iu,
    );
    expect(set.excludedMethods).toContainEqual(expect.objectContaining({
      methodLibraryEntryId: "threshold-reviewed-v1",
    }));
    expect(set.semanticExplanation).toEqual({
      status: "blocked",
      reason: "genuine_intelligence_path_unverified",
    });
    expect(() => validateCausalDesignSet(set)).not.toThrow();
  });

  it("distinguishes missing data from a fully specified conditional option", () => {
    const needsData = designSet({
      completeCoverage: true,
      selectClock: true,
    }).designSet.options[0]!;
    expect(needsData.status).toBe("needs_data");
    expect(needsData.missingPrerequisites.join(" ")).toMatch(
      /data are available|data frequency|historical fields/iu,
    );

    const conditional = designSet({
      completeCoverage: true,
      selectClock: true,
      comparison: comparisonInput({
        dataAvailability: "available",
        dataFrequency: "annual",
        historicalEligibilityFields: ["historical_coverage_status"],
      }),
    }).designSet.options[0]!;
    expect(conditional.status).toBe("conditional");
    expect(conditional.missingPrerequisites).toEqual([]);
    expect(conditional.unsupportedClaims.join(" ")).toMatch(
      /does not establish|does not show/iu,
    );
  });

  it("offers a threshold option only from a complete structured assignment rule", () => {
    const input = comparisonInput({
      dataAvailability: "available",
      dataFrequency: "annual",
      historicalEligibilityFields: [
        "historical_storage_capacity_mw",
        "organized_market_operator",
      ],
    });
    const { designSet: set } = designSet({
      threshold: true,
      selectClock: true,
      comparison: input,
    });

    expect(set.options.map(({ family }) => family)).toEqual([
      "difference_in_differences",
      "threshold_eligibility",
    ]);
    const threshold = set.options.find(({ family }) =>
      family === "threshold_eligibility")!;
    expect(threshold.eligibilityRule).toMatchObject({
      complete: true,
      logic: "all",
      exemptions: ["Operators under an approved transition waiver"],
      historicalMeasurementYears: ["2019"],
    });
    expect(threshold.treatmentDefinition).toMatch(
      /historical_storage_capacity_mw ≥ 100 MW/iu,
    );
    expect(threshold.dataRequirements.join(" ")).toMatch(
      /every other eligibility condition|unknown/iu,
    );
  });

  it("returns no option with explicit exclusions when selected evidence supplies no supported variation", () => {
    const { designSet: set } = designSet({
      comparison: comparisonInput({
        variationClaimIds: ["claim-implementation"],
      }),
    });

    expect(set.status).toBe("no_supported_option");
    expect(set.options).toEqual([]);
    expect(set.excludedMethods.map(({ methodLibraryEntryId }) =>
      methodLibraryEntryId)).toEqual([
      "did-reviewed-v1",
      "threshold-reviewed-v1",
    ]);
  });

  it("does not infer a component effect from package-level timing or coverage alone", () => {
    const { designSet: set } = designSet({
      comparison: comparisonInput({
        policyTarget: "policy_component",
        targetDetail: "the participation-process component",
      }),
    });

    expect(set.options[0]!.status).toBe("needs_institutional_review");
    expect(set.options[0]!.missingPrerequisites.join(" ")).toMatch(
      /changes the named component independently/iu,
    );
    expect(set.options[0]!.unsupportedClaims.join(" ")).toMatch(
      /calendar separation.*does not/iu,
    );
  });

  it("carries a selected unresolved conflict into evidence lineage and review status", () => {
    const { designSet: set } = designSet({
      comparison: comparisonInput(),
      conflict: true,
    });

    expect(set.options).toHaveLength(1);
    expect(set.options[0]).toMatchObject({
      status: "needs_institutional_review",
      supportingEvidence: expect.arrayContaining([
        expect.objectContaining({
          claimId: "claim-coverage",
          conflictIds: ["conflict-coverage-waiver"],
        }),
      ]),
    });
    expect(set.options[0]!.missingPrerequisites.join(" ")).toContain(
      "conflict-coverage-waiver",
    );
  });

  it("records researcher selection or explicit no-selection without certifying validity", () => {
    const { designSet: set } = designSet();
    const selected = createCausalDesignDecision({
      snapshotId: "causal-decision-selected",
      designSet: set,
      decision: { mode: "selected", optionId: set.options[0]!.id },
      rationale: "Carry this conditional comparison forward for further review.",
      actor: "researcher_ui",
      decidedAt: at(24),
    });
    expect(selected.selectedDesign).toMatchObject({
      status: "selected_for_review",
      sourceOptionStatus: "needs_institutional_review",
    });
    expect(selected.selectedDesign!.unsupportedClaims.join(" ")).toMatch(
      /does not establish|does not show/iu,
    );
    expect(() => validateCausalDesignDecision(selected, set)).not.toThrow();

    const none = createCausalDesignDecision({
      snapshotId: "causal-decision-none",
      designSet: set,
      decision: { mode: "no_selection" },
      rationale: "The current evidence does not yet support a defensible comparison.",
      actor: "researcher_ui",
      decidedAt: at(25),
    });
    expect(none).toMatchObject({
      decision: "no_selection",
      selectedOptionId: null,
      selectedDesign: null,
    });
    expect(() => createCausalDesignDecision({
      snapshotId: "causal-decision-system",
      designSet: set,
      decision: { mode: "no_selection" },
      rationale: "A system cannot own this decision.",
      actor: "system",
      decidedAt: at(26),
    })).toThrow(/researcher UI/iu);
  });

  it("detects a changed option even when the surrounding object is retained", () => {
    const { designSet: set } = designSet();
    const changed = structuredClone(set);
    changed.options[0]!.estimand = "A stronger causal claim.";
    expect(() => validateCausalDesignSet(changed)).toThrow(/invalid|changed/iu);
  });

  it("persists selection through back-navigation and rejects it after an upstream study change", () => {
    const fixture = lockedFixture({ selectClock: true });
    const built = buildCausalComparison(fixture.state, {
      expectedRevision: fixture.state.revision,
      snapshotId: "workflow-causal-design-set",
      comparisonInput: comparisonInput({
        dataAvailability: "available",
        dataFrequency: "annual",
        historicalEligibilityFields: ["coverage_status"],
      }),
      builtAt: at(30),
    });
    expect(currentCausalDesignSet(built.state)?.snapshotId).toBe(
      "workflow-causal-design-set",
    );
    const option = built.designSet.options[0]!;
    const decided = decideCausalComparison(built.state, {
      expectedRevision: built.state.revision,
      snapshotId: "workflow-causal-decision",
      designSetSnapshotId: built.designSet.snapshotId,
      expectedDesignSetFingerprint: built.designSet.designSetFingerprint,
      decision: { mode: "selected", optionId: option.id },
      rationale: "Retain this conditional option for the next review screens.",
      actor: "researcher_ui",
      decidedAt: at(31),
    });
    expect(currentCausalDesignDecision(decided.state)?.decision).toBe(
      "selected",
    );

    const back = openScreen2(decided.state, {
      expectedRevision: decided.state.revision,
      openedAt: at(32),
    }).state;
    const reopened = openScreen3(back, {
      expectedRevision: back.revision,
      openedAt: at(33),
    }).state;
    expect(reopened.activeScreen).toBe(3);
    expect(currentCausalDesignDecision(reopened)?.snapshotId).toBe(
      "workflow-causal-decision",
    );

    const changed = updateStudyContext(reopened, {
      expectedRevision: reopened.revision,
      study: {
        ...studyDraft(reopened),
        outcome: "Entry by storage providers",
      },
      updatedAt: at(34),
    });
    expect(screen3PrerequisiteReport(changed).ready).toBe(true);
    expect(currentCausalDesignSet(changed)).toBeNull();
    expect(changed.artifacts.find(({ snapshotId }) =>
      snapshotId === built.designSet.snapshotId)).toMatchObject({
      status: "out_of_date",
      invalidationReason:
        "The researcher changed a study field used by this result.",
    });
    expect(() => decideCausalComparison(changed, {
      expectedRevision: changed.revision,
      snapshotId: "stale-causal-decision",
      designSetSnapshotId: built.designSet.snapshotId,
      expectedDesignSetFingerprint: built.designSet.designSetFingerprint,
      decision: { mode: "selected", optionId: option.id },
      rationale: "This stale option must not be applied.",
      actor: "researcher_ui",
      decidedAt: at(35),
    })).toThrow(/current design set/iu);
  });

  it("reports finite transition blockers instead of requiring complete Screen 2 research", () => {
    const fixture = createBrowserEventCardFixture();
    const incomplete = structuredClone(fixture.state);
    incomplete.study.initialExplanation = null;
    const report = screen3PrerequisiteReport(incomplete);
    expect(report.ready).toBe(false);
    expect(report.blockers.map(({ code }) => code)).toEqual([
      "study_question",
      "proposed_timing",
    ]);
    expect(report.blockers.every(({ classification }) =>
      classification === "screen_3_prerequisite")).toBe(true);
  });
});

function decidedScreen3(mode: "selected" | "no_selection") {
  const fixture = lockedFixture({ selectClock: true });
  const built = buildCausalComparison(fixture.state, {
    expectedRevision: fixture.state.revision,
    snapshotId: `screen4-design-${mode}`,
    comparisonInput: comparisonInput({
      dataAvailability: "partially_available",
      dataFrequency: "annual",
      historicalEligibilityFields: ["historical_coverage_status"],
    }),
    builtAt: at(40),
  });
  const decision = decideCausalComparison(built.state, {
    expectedRevision: built.state.revision,
    snapshotId: `screen4-decision-${mode}`,
    designSetSnapshotId: built.designSet.snapshotId,
    expectedDesignSetFingerprint: built.designSet.designSetFingerprint,
    decision: mode === "selected"
      ? { mode, optionId: built.designSet.options[0]!.id }
      : { mode },
    rationale: mode === "selected"
      ? "Carry this conditional comparison into a bounded co-event search."
      : "No comparison is defensible yet; retain a contextual search only.",
    actor: "researcher_ui",
    decidedAt: at(41),
  });
  return { ...fixture, built, decided: decision };
}

function coEventExecutionFixture() {
  const fixture = decidedScreen3("selected");
  const opened = openScreen4(fixture.decided.state, {
    expectedRevision: fixture.decided.state.revision,
    openedAt: at(60),
  });
  const saved = saveCoEventSearchMatrix(opened.state, {
    expectedRevision: opened.state.revision,
    snapshotId: "screen4-execution-matrix",
    scopeInput: createCoEventSearchScopeInput({
      anticipationLookback: { amount: 2, unit: "years" },
      contextLookforward: { amount: 1, unit: "years" },
      knownCoEvents: ["Documented capacity auction redesign"],
      importantEntities: [
        { kind: "regulator", label: "Market oversight commission" },
      ],
      includeMeasurementChanges: true,
    }),
    savedAt: at(61),
  });
  const plan = createCoEventExecutionPlan({
    id: "screen4-execution-plan",
    matrix: saved.matrix,
    designSet: fixture.built.designSet,
    designDecision: fixture.decided.decision,
    capabilities: coEventProviderExecutionCapabilities({
      matrix: saved.matrix,
      sourceRegister: buildSixScreenSourceRegister(),
    }),
    createdAt: at(62),
  });
  return { ...fixture, saved, plan };
}

describe("Screen 4 immutable search scope and matrix", () => {
  it("saves a targeted matrix that searches both selected groups without claiming execution", () => {
    const fixture = decidedScreen3("selected");
    const prerequisites = screen4PrerequisiteReport(fixture.decided.state);
    expect(prerequisites).toMatchObject({
      ready: true,
      mode: "targeted",
      modeLabel: "Targeted event scan — selected comparison retained",
      currentDesignSetSnapshotId: fixture.built.designSet.snapshotId,
      currentDesignDecisionSnapshotId: fixture.decided.decision.snapshotId,
    });
    const opened = openScreen4(fixture.decided.state, {
      expectedRevision: fixture.decided.state.revision,
      openedAt: at(42),
    });
    const scopeInput = createCoEventSearchScopeInput({
      anticipationLookback: { amount: 2, unit: "years" },
      contextLookforward: { amount: 1, unit: "years" },
      knownCoEvents: ["Documented capacity auction redesign"],
      importantEntities: [
        { kind: "regulator", label: "Market oversight commission" },
        { kind: "market", label: "Regional capacity market" },
      ],
      includeMeasurementChanges: true,
    });
    const saved = saveCoEventSearchMatrix(opened.state, {
      expectedRevision: opened.state.revision,
      snapshotId: "screen4-targeted-matrix",
      scopeInput,
      savedAt: at(43),
    });

    expect(saved.matrix).toMatchObject({
      mode: "targeted",
      rows: expect.arrayContaining([
        expect.objectContaining({ branch: "overlapping_policy" }),
        expect.objectContaining({ branch: "implementation_or_litigation" }),
        expect.objectContaining({ branch: "independent_industry_or_market" }),
        expect.objectContaining({ branch: "disaster_or_disruption" }),
        expect.objectContaining({ branch: "comparison_spillover" }),
        expect.objectContaining({ branch: "measurement_or_sample_change" }),
      ]),
      execution: {
        status: "planned",
        executedRowIds: [],
        unavailableProviderIds: [],
        unavailableLanguages: [],
        actualSearchBoundary: null,
      },
      semanticRelationAnalysis: {
        status: "blocked",
        reason: "genuine_intelligence_path_unverified",
      },
    });
    expect(saved.matrix.rows).toHaveLength(6);
    expect(saved.matrix.rows.every((row) =>
      row.affectedGroups.some(({ role }) => role === "treatment") &&
      row.affectedGroups.some(({ role }) => role === "comparison") &&
      row.outcome.status === "not_started"
    )).toBe(true);
    expect(saved.matrix.claimBoundary).toMatch(
      /not an executed search|not.*causal diagnosis|not.*add controls/iu,
    );
    expect(currentCoEventSearchMatrix(saved.state)).toEqual(saved.matrix);
    expect(saved.state.artifacts.find(({ snapshotId }) =>
      snapshotId === saved.matrix.snapshotId)).toMatchObject({
      screen: 4,
      status: "current",
      dependencies: {
        coeventSnapshotId: saved.matrix.snapshotId,
        selectedDesignSnapshotId:
          fixture.decided.decision.selectedDesign!.snapshotId,
      },
    });
  });

  it("uses the exact contextual label and makes no differential-group claim after explicit no-selection", () => {
    const fixture = decidedScreen3("no_selection");
    expect(screen4PrerequisiteReport(fixture.decided.state)).toMatchObject({
      ready: true,
      mode: "contextual",
      modeLabel: "Contextual event scan — comparison not specified.",
    });
    const opened = openScreen4(fixture.decided.state, {
      expectedRevision: fixture.decided.state.revision,
      openedAt: at(44),
    });
    const saved = saveCoEventSearchMatrix(opened.state, {
      expectedRevision: opened.state.revision,
      snapshotId: "screen4-contextual-matrix",
      scopeInput: createCoEventSearchScopeInput({
        anticipationLookback: { amount: 6, unit: "months" },
        contextLookforward: { amount: 0, unit: "months" },
        knownCoEvents: [],
        importantEntities: [],
        includeMeasurementChanges: false,
      }),
      savedAt: at(45),
    });

    expect(saved.matrix.modeLabel).toBe(
      "Contextual event scan — comparison not specified.",
    );
    expect(saved.matrix.rows).toHaveLength(5);
    expect(saved.matrix.rows.every((row) =>
      row.affectedGroups.every(({ role }) => role === "population")
    )).toBe(true);
    expect(saved.matrix.rows.find(({ branch }) =>
      branch === "comparison_spillover")?.question).toMatch(
      /if a comparison group is specified later/iu,
    );
  });

  it("preserves immutable matrix history while invalidating current interpretation after a study change", () => {
    const fixture = decidedScreen3("selected");
    const opened = openScreen4(fixture.decided.state, {
      expectedRevision: fixture.decided.state.revision,
      openedAt: at(46),
    });
    const saved = saveCoEventSearchMatrix(opened.state, {
      expectedRevision: opened.state.revision,
      snapshotId: "screen4-matrix-before-study-change",
      scopeInput: createCoEventSearchScopeInput({
        anticipationLookback: { amount: 1, unit: "years" },
        contextLookforward: { amount: 1, unit: "years" },
        knownCoEvents: [],
        importantEntities: [],
        includeMeasurementChanges: true,
      }),
      savedAt: at(47),
    });
    const changed = updateStudyContext(saved.state, {
      expectedRevision: saved.state.revision,
      study: {
        ...studyDraft(saved.state),
        outcome: "A revised organizational outcome",
      },
      updatedAt: at(48),
    });

    expect(currentCoEventSearchMatrix(changed)).toBeNull();
    expect(changed.coEventSearchMatrices).toHaveLength(1);
    expect(changed.coEventSearchMatrices![0]).toEqual(saved.matrix);
    expect(changed.artifacts.find(({ snapshotId }) =>
      snapshotId === saved.matrix.snapshotId)).toMatchObject({
      status: "out_of_date",
      invalidationReason:
        "The researcher changed a study field used by this result.",
    });
    expect(screen4PrerequisiteReport(changed).blockers.map(({ code }) => code))
      .toContain("current_causal_design_decision");
  });

  it("detects any change to the saved search matrix", () => {
    const fixture = decidedScreen3("selected");
    const opened = openScreen4(fixture.decided.state, {
      expectedRevision: fixture.decided.state.revision,
      openedAt: at(49),
    });
    const saved = saveCoEventSearchMatrix(opened.state, {
      expectedRevision: opened.state.revision,
      snapshotId: "screen4-matrix-tamper-test",
      scopeInput: createCoEventSearchScopeInput({
        anticipationLookback: { amount: 1, unit: "years" },
        contextLookforward: { amount: 1, unit: "years" },
        knownCoEvents: [],
        importantEntities: [],
        includeMeasurementChanges: true,
      }),
      savedAt: at(50),
    });
    const changed = structuredClone(saved.matrix);
    changed.rows[0]!.question = "A stronger and unreviewed claim.";
    expect(() => validateCoEventSearchMatrix(
      changed,
      fixture.built.designSet,
      fixture.decided.decision,
    )).toThrow(/invalid|changed/iu);
  });

  it("creates a bounded capability-aware plan and retains occurrence-only evidence", async () => {
    const fixture = coEventExecutionFixture();
    const pending = fixture.plan.steps.filter(({ initialStatus }) =>
      initialStatus === "pending");

    expect(fixture.plan).toMatchObject({
      searchPeriod: { start: "2017-01-01", end: "2024-12-31" },
      sourceQueryCeiling: 24,
      metadataCandidateCeiling: 100,
      continuationMode: "panel_driven",
    });
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.length).toBeLessThanOrEqual(24);
    expect(pending.reduce((sum, { plannedLimit }) =>
      sum + plannedLimit, 0)).toBeLessThanOrEqual(100);
    expect(fixture.plan.steps.map(({ initialStatus }) => initialStatus))
      .toEqual(expect.arrayContaining([
        "pending",
        "not_implemented",
        "operation_not_supported",
      ]));
    expect(() => validateCoEventExecutionPlan(
      fixture.plan,
      fixture.saved.matrix,
    )).not.toThrow();
    const reorderedPeriodPlan = {
      ...fixture.plan,
      searchPeriod: {
        end: fixture.plan.searchPeriod.end,
        start: fixture.plan.searchPeriod.start,
      },
    };
    expect(() => validateCoEventExecutionPlan(
      reorderedPeriodPlan,
      fixture.saved.matrix,
    )).not.toThrow();

    const step = pending.find(({ providerId }) =>
      providerId === "federal_register")!;
    let second = 70;
    let monotonic = 0;
    const fetch = vi.fn(async () => new Response(JSON.stringify({
      count: 1,
      results: [{
        document_number: "2021-12345",
        title: "Capacity Market Reliability Rule",
        type: "Rule",
        abstract: "The commission changed capacity-market reliability rules.",
        action: "Final rule.",
        excerpts: ["Capacity-market reliability rules changed."],
        html_url:
          "https://www.federalregister.gov/documents/2021/05/20/2021-12345/example",
        publication_date: "2021-05-20",
        effective_on: "2021-06-21",
        agencies: [{ name: "Federal Energy Regulatory Commission" }],
      }],
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    const result = await executeCoEventProviderStep({
      attemptId: "screen4-occurrence-attempt",
      plan: fixture.plan,
      matrix: fixture.saved.matrix,
      step,
      fetch,
      now: () => at(second++),
      monotonicNow: () => (monotonic += 7),
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.attempt).toMatchObject({
      providerId: "federal_register",
      outcome: "candidates_found",
      failureCode: null,
      usage: { sourceQueries: 1, documentAttempts: 0 },
    });
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      occurrenceStatus: "source_metadata_documented",
      affectedActivityOrPopulation: {
        status: "not_established",
        labels: [],
      },
      relationToComparison: {
        status: "not_assessed",
        reason: "genuine_intelligence_path_unverified",
      },
      reusableAcrossDesignRevisions: true,
      evidence: [expect.objectContaining({
        evidenceRole: "occurrence_metadata",
      })],
    });

    const recorded = recordCoEventSearchExecution(fixture.saved.state, {
      expectedRevision: fixture.saved.state.revision,
      snapshotId: "screen4-occurrence-execution",
      plan: fixture.plan,
      attempt: result.attempt,
      candidates: result.candidates,
      discoveryLeads: result.leads,
      recordedAt: at(72),
    });
    expect(currentCoEventExecutionPlan(recorded.state)).toEqual(fixture.plan);
    expect(currentCoEventSearchExecution(recorded.state)).toMatchObject({
      status: "active",
      candidateOccurrenceIds: [result.candidates[0]!.id],
      semanticRelationAnalysis: { status: "blocked" },
      actualSearchBoundary: {
        sourceQueries: 1,
        retainedCandidateCount: 1,
      },
    });

    const changedStudy = updateStudyContext(recorded.state, {
      expectedRevision: recorded.state.revision,
      study: {
        ...studyDraft(recorded.state),
        outcome: "A revised organizational outcome",
      },
      updatedAt: at(73),
    });
    expect(currentCoEventSearchExecution(changedStudy)).toBeNull();
    expect(changedStudy.coEventCandidates).toEqual(result.candidates);
    const changedCandidate = structuredClone(result.candidates[0]!);
    changedCandidate.title = "A stronger unverified title";
    expect(() => validateCoEventCandidateOccurrence(changedCandidate))
      .toThrow(/invalid|changed/iu);
  });

  it("separates no-match, outage, and bibliographic-lead outcomes", async () => {
    const fixture = coEventExecutionFixture();
    const federal = fixture.plan.steps.find(({ providerId, initialStatus }) =>
      providerId === "federal_register" && initialStatus === "pending")!;
    let second = 80;
    const execute = (step: typeof federal, fetch: typeof globalThis.fetch) =>
      executeCoEventProviderStep({
        attemptId: `screen4-outcome-${second}`,
        plan: fixture.plan,
        matrix: fixture.saved.matrix,
        step,
        fetch,
        now: () => at(second++),
      });
    const noMatch = await execute(federal, async () => new Response(
      JSON.stringify({ count: 0, results: [] }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
    const outage = await execute(federal, async () =>
      new Response(null, { status: 503 }));
    expect(noMatch.attempt).toMatchObject({
      outcome: "no_match",
      failureCode: null,
      recordsReceived: 0,
    });
    expect(outage.attempt).toMatchObject({
      outcome: "source_unavailable",
      failureCode: expect.any(String),
      recordsReceived: 0,
    });

    const crossref = fixture.plan.steps.find(({ providerId, initialStatus }) =>
      providerId === "crossref" && initialStatus === "pending")!;
    const leadOnly = await execute(crossref, async () => new Response(
      JSON.stringify({ message: { items: [{
        DOI: "10.1234/coevent.1",
        title: ["Capacity-market reform and operator outcomes"],
        publisher: "Research publisher",
        published: { "date-parts": [[2022, 4, 2]] },
        URL: "https://doi.org/10.1234/coevent.1",
      }] } }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
    expect(leadOnly.attempt).toMatchObject({
      outcome: "discovery_leads_only",
      candidateOccurrenceIds: [],
      discoveryLeadIds: [leadOnly.leads[0]!.id],
    });
    expect(leadOnly.candidates).toEqual([]);
    expect(leadOnly.leads[0]).toMatchObject({
      occurrenceStatus: "not_established",
      relationStatus: "not_assessed",
      sourceRole: "contextual_secondary_metadata",
    });
    expect(leadOnly.leads[0]!.limitation).toMatch(
      /not an event date|occurrence evidence/iu,
    );
  });

  it("keeps occurrence corrections and duplicate-stage review separate from immutable evidence", async () => {
    const fixture = coEventExecutionFixture();
    const federalSteps = fixture.plan.steps.filter(({ providerId, initialStatus }) =>
      providerId === "federal_register" && initialStatus === "pending")
      .slice(0, 2);
    expect(federalSteps).toHaveLength(2);
    let second = 90;
    let state = fixture.saved.state;
    const retainedCandidates: CoEventCandidateOccurrence[] = [];
    for (const [index, step] of federalSteps.entries()) {
      const result = await executeCoEventProviderStep({
        attemptId: `screen4-review-attempt-${index + 1}`,
        plan: fixture.plan,
        matrix: fixture.saved.matrix,
        step,
        fetch: async () => new Response(JSON.stringify({
          count: 1,
          results: [{
            document_number: `2021-1234${index}`,
            title: index === 0
              ? "Capacity Market Reliability Rule"
              : "Capacity Market Reliability Rule Implementation Notice",
            type: "Rule",
            abstract: "The commission reported a capacity-market change.",
            action: "Final rule.",
            excerpts: ["A capacity-market change was reported."],
            html_url:
              `https://www.federalregister.gov/documents/2021/05/2${index}/2021-1234${index}/example`,
            publication_date: `2021-05-2${index}`,
            effective_on: `2021-06-2${index}`,
            agencies: [{ name: "Federal Energy Regulatory Commission" }],
          }],
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
        now: () => at(second++),
      });
      retainedCandidates.push(result.candidates[0]!);
      state = recordCoEventSearchExecution(state, {
        expectedRevision: state.revision,
        snapshotId: `screen4-review-execution-${index + 1}`,
        plan: fixture.plan,
        attempt: result.attempt,
        candidates: result.candidates,
        discoveryLeads: result.leads,
        recordedAt: at(second++),
      }).state;
    }
    expect(currentCoEventSearchExecution(state)?.candidateOccurrenceIds)
      .toEqual(retainedCandidates.map(({ id }) => id));
    const immutableCandidates = structuredClone(state.coEventCandidates);

    const retained = reviewCoEventOccurrence(state, {
      expectedRevision: state.revision,
      reviewId: "screen4-workflow-occurrence-review-1",
      candidateId: retainedCandidates[0]!.id,
      expectedCandidateFingerprint:
        retainedCandidates[0]!.candidateFingerprint,
      decision: { mode: "retained" },
      rationale:
        "Retain this source-documented occurrence for later relation review.",
      actor: "researcher_ui",
      reviewedAt: at(second++),
    });
    const corrected = reviewCoEventOccurrence(retained.state, {
      expectedRevision: retained.state.revision,
      reviewId: "screen4-workflow-occurrence-review-2",
      candidateId: retainedCandidates[0]!.id,
      expectedCandidateFingerprint:
        retainedCandidates[0]!.candidateFingerprint,
      decision: {
        mode: "corrected",
        correction: {
          title: "Capacity Market Reliability Implementation Rule",
          typedDates: [{ kind: "effective", value: "2021-06-21" }],
          affectedActivityOrPopulationLabels: ["Regional market operators"],
          geographyLabels: [],
        },
      },
      rationale:
        "Keep this researcher interpretation separate from the source metadata.",
      actor: "researcher_ui",
      reviewedAt: at(second++),
    });
    const related = reviewCoEventRelation(corrected.state, {
      expectedRevision: corrected.state.revision,
      reviewId: "screen4-workflow-relation-review-1",
      candidateId: retainedCandidates[0]!.id,
      expectedCandidateFingerprint:
        retainedCandidates[0]!.candidateFingerprint,
      expectedOccurrenceReviewId: corrected.review.id,
      expectedOccurrenceReviewFingerprint: corrected.review.reviewFingerprint,
      decision: {
        mode: "retained",
        category: "independent_concurrent_event",
        priority: "high",
        affectedGroupRoles: ["treatment", "comparison"],
        plausibleOutcomePathway:
          "The market rule could alter participation costs independently of the focal policy.",
        differentialRelevance:
          "Eligibility and market position could expose the proposed groups differently.",
        assumptions: [
          "The reported rule operated during the comparison window.",
        ],
        unresolvedQuestions: [
          "Which sampled organizations were eligible under the historical rule?",
        ],
        proposedResponses: [
          "Obtain historical eligibility and compare exposure before revising the design.",
        ],
      },
      rationale:
        "Retain the relation as a researcher-owned concern pending exposure evidence.",
      actor: "researcher_ui",
      reviewedAt: at(second++),
    });
    const duplicate = reviewCoEventDuplicatePair(related.state, {
      expectedRevision: related.state.revision,
      reviewId: "screen4-workflow-duplicate-review-1",
      leftCandidateId: retainedCandidates[0]!.id,
      leftCandidateFingerprint:
        retainedCandidates[0]!.candidateFingerprint,
      rightCandidateId: retainedCandidates[1]!.id,
      rightCandidateFingerprint:
        retainedCandidates[1]!.candidateFingerprint,
      decision: { mode: "distinct_stage" },
      rationale:
        "The final rule and implementation notice are linked stages, not duplicate records to collapse.",
      actor: "researcher_ui",
      reviewedAt: at(second++),
    });

    expect(duplicate.state.coEventCandidates).toEqual(immutableCandidates);
    expect(duplicate.state.coEventOccurrenceReviews).toHaveLength(2);
    expect(duplicate.state.coEventRelationReviews).toEqual([
      expect.objectContaining({
        decision: "retained",
        origin: "researcher_authored",
        relation: expect.objectContaining({
          category: "independent_concurrent_event",
          priority: "high",
        }),
        semanticAssistance: {
          status: "not_used",
          reason: "genuine_intelligence_path_unverified",
        },
      }),
    ]);
    expect(duplicate.state.coEventRelationReviews![0]!.claimBoundary).toMatch(
      /not.*model finding|does not establish confounding|valid adjustment/iu,
    );
    expect(duplicate.state.coEventDuplicateReviews).toEqual([
      expect.objectContaining({
        decision: "distinct_stage",
        preservesAllCandidateRecords: true,
        relationAssessment: expect.objectContaining({
          status: "not_assessed",
        }),
      }),
    ]);
    expect(currentCoEventSearchExecution(duplicate.state)?.snapshotId).toBe(
      "screen4-review-execution-2",
    );
    expect(() => reviewCoEventOccurrence(duplicate.state, {
      expectedRevision: duplicate.state.revision,
      reviewId: "screen4-workflow-stale-candidate-review",
      candidateId: retainedCandidates[0]!.id,
      expectedCandidateFingerprint:
        retainedCandidates[1]!.candidateFingerprint,
      decision: { mode: "deferred" },
      rationale: "This fingerprint belongs to another candidate.",
      actor: "researcher_ui",
      reviewedAt: at(second++),
    })).toThrow(/changed before researcher review/iu);

    expect(() => routeCoEventPolicyStageToScreen2(duplicate.state, {
      expectedRevision: duplicate.state.revision,
      handoffId: "screen4-policy-lifecycle-unreviewed",
      targetReviewId: "screen2-policy-lifecycle-unreviewed",
      candidateId: retainedCandidates[1]!.id,
      expectedCandidateFingerprint:
        retainedCandidates[1]!.candidateFingerprint,
      expectedOccurrenceReviewId: "missing-occurrence-review",
      expectedOccurrenceReviewFingerprint: "fnv1a64:0000000000000000",
      stageKind: "implementation_delay",
      rationale: "This unreviewed occurrence must not leave Screen 4.",
      projection: fixture.projection,
      actor: "researcher_ui",
      routedAt: at(second++),
    })).toThrow(/occurrence review changed/iu);

    const priorReview = duplicate.state.policyEventCardReviews!.at(-1)!;
    const priorReviewSnapshot = structuredClone(priorReview);
    const routed = routeCoEventPolicyStageToScreen2(duplicate.state, {
      expectedRevision: duplicate.state.revision,
      handoffId: "screen4-policy-lifecycle-handoff-1",
      targetReviewId: "screen2-policy-lifecycle-review-2",
      candidateId: retainedCandidates[0]!.id,
      expectedCandidateFingerprint:
        retainedCandidates[0]!.candidateFingerprint,
      expectedOccurrenceReviewId: corrected.review.id,
      expectedOccurrenceReviewFingerprint: corrected.review.reviewFingerprint,
      stageKind: "implementation_delay",
      rationale:
        "The retained implementation record may be a later stage of the focal policy and needs Event Card review.",
      projection: fixture.projection,
      actor: "researcher_ui",
      routedAt: at(second++),
    });
    expect(routed.state.activeScreen).toBe(2);
    expect(routed.state.coEventCandidates).toEqual(immutableCandidates);
    expect(routed.state.policyEventCardReviews?.at(-1)).toMatchObject({
      id: "screen2-policy-lifecycle-review-2",
      ordinal: priorReview.ordinal + 1,
      status: "in_review",
      lockedEventCard: null,
      supersedes: {
        reviewId: priorReview.id,
        eventCardSnapshotId: priorReview.lockedEventCard!.snapshotId,
      },
    });
    expect(routed.state.policyEventCardReviews?.at(-2)).toEqual(
      priorReviewSnapshot,
    );
    expect(routed.handoff).toMatchObject({
      id: "screen4-policy-lifecycle-handoff-1",
      candidateReference: { candidateId: retainedCandidates[0]!.id },
      occurrenceReviewReference: {
        reviewId: corrected.review.id,
        decision: "corrected",
      },
      proposedStage: {
        kind: "implementation_delay",
        status: "researcher_proposed_for_review",
      },
      destination: {
        screen: 2,
        policyEventCardReviewId: "screen2-policy-lifecycle-review-2",
      },
      preservesSourceOccurrence: true,
      preservesPriorEventCard: true,
      independentEventClassification: "not_assessed",
      relationToComparison: { status: "not_assessed" },
    });
    expect(routed.state.artifacts.find(({ snapshotId }) =>
      snapshotId === priorReview.lockedEventCard!.snapshotId)).toMatchObject({
        screen: 2,
        status: "out_of_date",
      });
    expect(routed.state.artifacts.filter(({ screen }) => screen >= 3))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ screen: 3, status: "out_of_date" }),
        expect.objectContaining({ screen: 4, status: "out_of_date" }),
      ]));
    expect(currentCoEventSearchExecution(routed.state)).toBeNull();
    expect(screen3PrerequisiteReport(routed.state).blockers.map(({ code }) =>
      code)).not.toContain("current_event_card");
    expect(() => validateCoEventPolicyLifecycleHandoffCollection({
      candidates: routed.state.coEventCandidates ?? [],
      occurrenceReviews: routed.state.coEventOccurrenceReviews ?? [],
      duplicateReviews: routed.state.coEventDuplicateReviews ?? [],
      executions: routed.state.coEventSearchExecutions ?? [],
      policyEventCardReviews: routed.state.policyEventCardReviews ?? [],
      handoffs: routed.state.coEventPolicyLifecycleHandoffs ?? [],
    })).not.toThrow();
    const changedHandoffs = structuredClone(
      routed.state.coEventPolicyLifecycleHandoffs!,
    );
    changedHandoffs[0]!.rationale = "A stronger unverified lifecycle claim.";
    expect(() => validateCoEventPolicyLifecycleHandoffCollection({
      candidates: routed.state.coEventCandidates ?? [],
      occurrenceReviews: routed.state.coEventOccurrenceReviews ?? [],
      duplicateReviews: routed.state.coEventDuplicateReviews ?? [],
      executions: routed.state.coEventSearchExecutions ?? [],
      policyEventCardReviews: routed.state.policyEventCardReviews ?? [],
      handoffs: changedHandoffs,
    })).toThrow(/invalid|changed/iu);

    const focalIdentifier = routed.state.confirmedShock!.formalIdentifiers[0]!;
    const retainedText =
      `This official implementation document cites ${focalIdentifier} and preserves a later implementation schedule for review.`;
    const focalStart = retainedText.indexOf(focalIdentifier);
    const source = createPolicyLifecycleStageOfficialSource({
      schemaVersion: SIX_SCREEN_POLICY_LIFECYCLE_STAGE_SOURCE_VERSION,
      sourceId: "policy-lifecycle-source-core-1",
      documentVersionId: "policy-lifecycle-document-core-1",
      provider: "federal_register",
      nativeDocumentNumber:
        retainedCandidates[0]!.formalIdentifiers[0]!,
      title: retainedCandidates[0]!.title,
      publisher: "Federal Energy Regulatory Commission",
      issuer: null,
      author: null,
      jurisdiction: "United States",
      role: "official structured record",
      documentType: "Federal Register publication representation",
      language: "en",
      canonicalUrl: retainedCandidates[0]!.evidence[0]!.locator,
      publicationDate: "2021-05-20",
      legalVersionDates:
        policyLifecycleStageLegalVersionDates(retainedCandidates[0]!),
      retrievedAt: at(second),
      representation: "html",
      contentHash: `sha256:${"a".repeat(64)}`,
      acquisitionProvenance: "direct",
      accessStatus: "retained_passage",
      rightsStatus: "public-government-record",
      parserVersion: "policy-lifecycle-core-fixture-v1",
      textQualityStatus:
        "visible-text parsed; bounded exact retained spans",
      inspectedText: "partial",
      parsedTextLength: retainedText.length,
      retainedPassages: [{
        id: "policy-lifecycle-passage-core-1",
        sourceId: "policy-lifecycle-source-core-1",
        documentVersionId: "policy-lifecycle-document-core-1",
        exactText: retainedText,
        locator: `visible text offsets 0-${retainedText.length}`,
        startOffset: 0,
        endOffset: retainedText.length,
        focalPolicyAnchorKinds: ["formal_identifier"],
        qualification:
          `The exact ${focalIdentifier} mention does not by itself establish the lifecycle relationship.`,
        unresolvedCrossReferences: [],
      }],
      focalPolicyReferenceStatus: "exact_identifier_found",
    });
    expect(focalStart).toBeGreaterThan(0);
    const acquisition = createPolicyLifecycleStageDocumentAcquisition({
      id: "policy-lifecycle-acquisition-core-1",
      ordinal: 1,
      handoff: routed.handoff,
      candidate: retainedCandidates[0]!,
      adapterVersion: "policy-lifecycle-core-fixture-v1",
      attemptedSources: [source.canonicalUrl],
      outcome: "document_retained",
      failureCode: null,
      limitation:
        "Bounded exact passages were retained for explicit researcher disposition.",
      source,
      usage: {
        sourceQueries: 0,
        metadataRecords: 0,
        documentAttempts: 1,
        usefulDocuments: 1,
        transportHops: 1,
        receivedBytes: 1_024,
        decodedBytes: retainedText.length,
        activeResearchMs: 10,
        cpuMs: 0,
        providerCostUnits: {},
      },
      acquiredAt: at(second++),
    });
    const targetBeforeAcquisition = structuredClone(
      routed.state.policyEventCardReviews!.at(-1),
    );
    const artifactsBeforeAcquisition = structuredClone(routed.state.artifacts);
    const recordedAcquisition =
      recordPolicyLifecycleStageDocumentAcquisition(routed.state, {
        expectedRevision: routed.state.revision,
        acquisition,
        recordedAt: acquisition.acquiredAt,
      });
    expect(recordedAcquisition.state.policyLifecycleStageDocumentAcquisitions)
      .toEqual([acquisition]);
    expect(recordedAcquisition.state.policyEventCardReviews!.at(-1))
      .toEqual(targetBeforeAcquisition);
    expect(recordedAcquisition.state.artifacts).toEqual(
      artifactsBeforeAcquisition,
    );

    const disposition = reviewPolicyLifecycleStageDocument(
      recordedAcquisition.state,
      {
        expectedRevision: recordedAcquisition.state.revision,
        dispositionId: "policy-lifecycle-disposition-core-1",
        handoffId: routed.handoff.id,
        expectedHandoffFingerprint: routed.handoff.handoffFingerprint,
        acquisitionId: acquisition.id,
        expectedAcquisitionFingerprint: acquisition.acquisitionFingerprint,
        decision: "accepted_for_event_card_review",
        rationale:
          "Accept the exact official document for a later source-grounded Event Card revision step.",
        actor: "researcher_ui",
        reviewedAt: at(second++),
      },
    );
    expect(disposition.disposition).toMatchObject({
      decision: "accepted_for_event_card_review",
      legalVerificationStatus: "researcher_decision_not_legal_verification",
      chronologyMutation: "none",
      eventCardMutation: "none",
      independentEventClassification: "not_assessed",
    });
    expect(disposition.state.policyEventCardReviews!.at(-1)).toEqual(
      targetBeforeAcquisition,
    );
    expect(disposition.state.artifacts).toEqual(artifactsBeforeAcquisition);
    expect(() => validatePolicyLifecycleStageReviewCollections({
      candidates: disposition.state.coEventCandidates ?? [],
      handoffs: disposition.state.coEventPolicyLifecycleHandoffs ?? [],
      acquisitions:
        disposition.state.policyLifecycleStageDocumentAcquisitions ?? [],
      dispositions: disposition.state.policyLifecycleStageDispositions ?? [],
    })).not.toThrow();

    const sourceDate = policyLifecycleStageSourceDateOptions(source)[0]!;
    const targetBeforeProposal = structuredClone(
      disposition.state.policyEventCardReviews!.at(-1),
    );
    const artifactsBeforeProposal = structuredClone(disposition.state.artifacts);
    const proposed = proposePolicyLifecycleStageRevision(disposition.state, {
      expectedRevision: disposition.state.revision,
      proposalId: "policy-lifecycle-stage-proposal-core-1",
      handoffId: routed.handoff.id,
      expectedHandoffFingerprint: routed.handoff.handoffFingerprint,
      dispositionId: disposition.disposition.id,
      expectedDispositionFingerprint:
        disposition.disposition.dispositionFingerprint,
      chronologyStage: "implementation",
      sourceDateId: sourceDate.id,
      rationale:
        "Propose the publication-dated implementation record as a separate chronology stage without retyping its source date.",
      actor: "researcher_ui",
      proposedAt: at(second++),
    });
    expect(proposed.proposal).toMatchObject({
      chronologyMutation: "proposal_only",
      eventCardMutation: "proposal_only",
      stage: {
        chronologyStage: "implementation",
        sourceDateId: sourceDate.id,
        sourceTypedDate: {
          start: "2021-05-20",
          kind: "publication",
        },
        timing: { mode: "absolute", start: "2021-05-20" },
        supportStatus: "indirect",
        reviewStatus: "unreviewed",
      },
    });
    expect(proposed.state.policyEventCardReviews!.at(-1)).toEqual(
      targetBeforeProposal,
    );
    expect(proposed.state.artifacts).toEqual(artifactsBeforeProposal);

    const rejectedProposalBranch = reviewPolicyLifecycleStageRevision(
      proposed.state,
      {
        expectedRevision: proposed.state.revision,
        reviewId: "policy-lifecycle-stage-proposal-review-rejected-core-1",
        proposalId: proposed.proposal.id,
        expectedProposalFingerprint: proposed.proposal.proposalFingerprint,
        decision: "rejected",
        rationale:
          "Reject this interpretation while preserving the source and unchanged Event Card.",
        actor: "researcher_ui",
        reviewedAt: at(second++),
      },
    );
    expect(rejectedProposalBranch.state.policyEventCardReviews!.at(-1))
      .toEqual(targetBeforeProposal);
    expect(rejectedProposalBranch.state.artifacts).toEqual(
      artifactsBeforeProposal,
    );

    const deferredProposalReview = reviewPolicyLifecycleStageRevision(
      proposed.state,
      {
        expectedRevision: proposed.state.revision,
        reviewId: "policy-lifecycle-stage-proposal-review-deferred-core-1",
        proposalId: proposed.proposal.id,
        expectedProposalFingerprint: proposed.proposal.proposalFingerprint,
        decision: "deferred",
        rationale:
          "Defer this interpretation for a second explicit decision without applying it.",
        actor: "researcher_ui",
        reviewedAt: at(second++),
      },
    );
    expect(deferredProposalReview.state.policyEventCardReviews!.at(-1))
      .toEqual(targetBeforeProposal);
    expect(deferredProposalReview.state.artifacts).toEqual(
      artifactsBeforeProposal,
    );

    const proposalReview = reviewPolicyLifecycleStageRevision(
      deferredProposalReview.state,
      {
        expectedRevision: deferredProposalReview.state.revision,
        reviewId: "policy-lifecycle-stage-proposal-review-core-1",
        proposalId: proposed.proposal.id,
        expectedProposalFingerprint: proposed.proposal.proposalFingerprint,
        decision: "accepted_for_event_card_revision",
        rationale:
          "Accept this bounded source interpretation for inclusion only when the pending Event Card is explicitly locked.",
        actor: "researcher_ui",
        reviewedAt: at(second++),
      },
    );
    expect(proposalReview.review).toMatchObject({
      decision: "accepted_for_event_card_revision",
      chronologyMutation: "none",
      eventCardMutation: "none",
      sourceDocumentPreserved: true,
    });
    expect(proposalReview.state.policyEventCardReviews!.at(-1)).toEqual(
      targetBeforeProposal,
    );
    expect(proposalReview.state.artifacts).toEqual(artifactsBeforeProposal);
    expect(() => validatePolicyLifecycleStageRevisionCollections({
      handoffs: proposalReview.state.coEventPolicyLifecycleHandoffs ?? [],
      acquisitions:
        proposalReview.state.policyLifecycleStageDocumentAcquisitions ?? [],
      dispositions:
        proposalReview.state.policyLifecycleStageDispositions ?? [],
      proposals:
        proposalReview.state.policyLifecycleStageRevisionProposals ?? [],
      reviews: proposalReview.state.policyLifecycleStageRevisionReviews ?? [],
      eventCardReviews: proposalReview.state.policyEventCardReviews ?? [],
    })).not.toThrow();
    const changedProposals = structuredClone(
      proposalReview.state.policyLifecycleStageRevisionProposals!,
    );
    changedProposals[0]!.stage.statement =
      "A stronger lifecycle claim unsupported by the immutable proposal.";
    expect(() => validatePolicyLifecycleStageRevisionCollections({
      handoffs: proposalReview.state.coEventPolicyLifecycleHandoffs ?? [],
      acquisitions:
        proposalReview.state.policyLifecycleStageDocumentAcquisitions ?? [],
      dispositions:
        proposalReview.state.policyLifecycleStageDispositions ?? [],
      proposals: changedProposals,
      reviews: proposalReview.state.policyLifecycleStageRevisionReviews ?? [],
      eventCardReviews: proposalReview.state.policyEventCardReviews ?? [],
    })).toThrow(/invalid|changed/iu);

    let lockReadyState = proposalReview.state;
    for (const claim of targetBeforeProposal!.claimReviews) {
      const active = lockReadyState.policyEventCardReviews!.at(-1)!;
      lockReadyState = applyPolicyEventCardClaimDecision(lockReadyState, {
        expectedRevision: lockReadyState.revision,
        reviewId: active.id,
        projection: fixture.projection,
        expectedReviewRevision: active.revision,
        expectedReviewFingerprint: active.reviewFingerprint,
        actionId: `policy-lifecycle-claim-${claim.claimId}`,
        claimId: claim.claimId,
        decision: "accepted",
        rationale: "Accept the evidence-bound claim for this Event Card revision.",
        actor: "researcher_ui",
        decidedAt: at(second++),
      }).state;
    }
    let active = lockReadyState.policyEventCardReviews!.at(-1)!;
    lockReadyState = applyPolicyTreatmentClockDecision(lockReadyState, {
      expectedRevision: lockReadyState.revision,
      reviewId: active.id,
      projection: fixture.projection,
      expectedReviewRevision: active.revision,
      expectedReviewFingerprint: active.reviewFingerprint,
      actionId: "policy-lifecycle-no-treatment-clock",
      decision: { mode: "no_selection" },
      rationale:
        "Keep the lifecycle stage separate from the researcher-owned treatment-clock decision.",
      actor: "researcher_ui",
      decidedAt: at(second++),
    }).state;
    active = lockReadyState.policyEventCardReviews!.at(-1)!;
    const locked = lockReviewedPolicyEventCard(lockReadyState, {
      expectedRevision: lockReadyState.revision,
      reviewId: active.id,
      projection: fixture.projection,
      expectedReviewRevision: active.revision,
      expectedReviewFingerprint: active.reviewFingerprint,
      actionId: "policy-lifecycle-event-card-lock",
      eventCardSnapshotId: "policy-lifecycle-event-card-core-2",
      rationale:
        "Lock the reviewed Event Card and explicitly include the separately accepted lifecycle-stage proposal.",
      actor: "researcher_ui",
      lockedAt: at(second++),
    });
    expect(locked.eventCard.lifecycleStageRevisions).toEqual([
      expect.objectContaining({
        proposalReference: { proposalId: proposed.proposal.id,
          proposalFingerprint: proposed.proposal.proposalFingerprint },
        reviewReference: expect.objectContaining({
          reviewId: proposalReview.review.id,
          decision: "accepted_for_event_card_revision",
        }),
        sourceDateId: sourceDate.id,
        sourceTypedDate: expect.objectContaining({
          start: "2021-05-20",
          kind: "publication",
        }),
        inclusionStatus: "included_by_explicit_event_card_lock",
      }),
    ]);
    expect(locked.eventCard.chronology.absoluteClocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: proposed.proposal.stage.clockId,
          stage: "implementation",
          timing: expect.objectContaining({ start: "2021-05-20" }),
        }),
      ]),
    );
    expect(locked.state.policyEventCardReviews!.at(-2)).toEqual(
      priorReviewSnapshot,
    );
    expect(() => validatePolicyLifecycleStageRevisionCollections({
      handoffs: locked.state.coEventPolicyLifecycleHandoffs ?? [],
      acquisitions:
        locked.state.policyLifecycleStageDocumentAcquisitions ?? [],
      dispositions: locked.state.policyLifecycleStageDispositions ?? [],
      proposals: locked.state.policyLifecycleStageRevisionProposals ?? [],
      reviews: locked.state.policyLifecycleStageRevisionReviews ?? [],
      eventCardReviews: locked.state.policyEventCardReviews ?? [],
    })).not.toThrow();

    const changedAcquisitions = structuredClone(
      disposition.state.policyLifecycleStageDocumentAcquisitions!,
    );
    changedAcquisitions[0]!.source!.retainedPassages[0]!.exactText =
      "A stronger unsupported lifecycle statement.";
    expect(() => validatePolicyLifecycleStageReviewCollections({
      candidates: disposition.state.coEventCandidates ?? [],
      handoffs: disposition.state.coEventPolicyLifecycleHandoffs ?? [],
      acquisitions: changedAcquisitions,
      dispositions: disposition.state.policyLifecycleStageDispositions ?? [],
    })).toThrow(/invalid|changed/iu);

    const changedStudy = updateStudyContext(disposition.state, {
      expectedRevision: disposition.state.revision,
      study: {
        ...studyDraft(duplicate.state),
        outcome: "A later revised outcome",
      },
      updatedAt: at(second++),
    });
    expect(currentCoEventSearchExecution(changedStudy)).toBeNull();
    expect(changedStudy.coEventCandidates).toEqual(immutableCandidates);
    expect(changedStudy.coEventOccurrenceReviews).toEqual(
      duplicate.state.coEventOccurrenceReviews,
    );
    expect(changedStudy.coEventDuplicateReviews).toEqual(
      duplicate.state.coEventDuplicateReviews,
    );
    expect(changedStudy.coEventPolicyLifecycleHandoffs).toEqual(
      routed.state.coEventPolicyLifecycleHandoffs,
    );
    expect(changedStudy.policyLifecycleStageDocumentAcquisitions).toEqual(
      disposition.state.policyLifecycleStageDocumentAcquisitions,
    );
    expect(changedStudy.policyLifecycleStageDispositions).toEqual(
      disposition.state.policyLifecycleStageDispositions,
    );
  });
});
