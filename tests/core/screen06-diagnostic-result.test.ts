import { describe, expect, it } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import { createScreen6DiagnosticPlanInput } from
  "../../src/core/six-screen/screen6-diagnostic-plan";
import { createCausalComparisonInput } from
  "../../src/core/six-screen/causal-comparison";
import {
  createScreen6DiagnosticResult,
  createScreen6DiagnosticResultInput,
  screen6DiagnosticResultPayloadFingerprint,
  validateScreen6DiagnosticResultCollections,
  type Screen6DiagnosticResult,
} from "../../src/core/six-screen/screen6-diagnostic-result";
import {
  currentScreen6DiagnosticResultReviews,
  currentScreen6DiagnosticResults,
  buildCausalComparison,
  decideCausalComparison,
  initializeScreen6UncertaintyProfile,
  openScreen3,
  openScreen6,
  recordScreen6DiagnosticResult,
  reviewScreen6DiagnosticResult,
  saveScreen6DiagnosticPlan,
} from "../../src/core/six-screen/workflow";
import {
  browserEventCardFixtureAt,
  createLockedBrowserEventCardFixture,
} from "../browser/six-screen-event-card-review-fixture";

function plannedFixture() {
  const fixture = createLockedBrowserEventCardFixture();
  const opened = openScreen6(fixture.state, {
    expectedRevision: fixture.state.revision,
    openedAt: browserEventCardFixtureAt(30),
  });
  const initialized = initializeScreen6UncertaintyProfile(opened.state, {
    expectedRevision: opened.state.revision,
    snapshotId: "screen6-result-profile",
    actor: "researcher_ui",
    createdAt: browserEventCardFixtureAt(31),
  });
  const planned = saveScreen6DiagnosticPlan(initialized.state, {
    expectedRevision: initialized.state.revision,
    snapshotId: "screen6-result-plan",
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
        description: "Assignment and dependence occur by market group.",
        timingPattern: "single_time",
        dependence: "grouped_or_clustered",
        independentGroupCount: 24,
        groupingVariables: ["market_id"],
      },
      feasibleDiagnosticVariables: {
        status: "available",
        values: ["outcome", "market_id"],
      },
      practicalConstraints: { status: "none_reported", values: [] },
      reportedConcerns: ["group_level_assignment_or_dependence"],
    }),
    actor: "researcher_ui",
    createdAt: browserEventCardFixtureAt(32),
  });
  const card = planned.plan.cards[0]!;
  return { fixture, initialized, planned, card };
}

function plannedDidFixture() {
  const fixture = createLockedBrowserEventCardFixture();
  const opened3 = openScreen3(fixture.state, {
    expectedRevision: fixture.state.revision,
    openedAt: browserEventCardFixtureAt(30),
  });
  const built = buildCausalComparison(opened3.state, {
    expectedRevision: opened3.state.revision,
    snapshotId: "screen6-result-did-set",
    comparisonInput: createCausalComparisonInput({
      policyTarget: "full_policy_package",
      targetDetail: null,
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
    snapshotId: "screen6-result-did-decision",
    designSetSnapshotId: built.designSet.snapshotId,
    expectedDesignSetFingerprint: built.designSet.designSetFingerprint,
    decision: { mode: "selected", optionId: built.designSet.options[0]!.id },
    rationale: "Carry this DiD comparison into diagnostic review.",
    actor: "researcher_ui",
    decidedAt: browserEventCardFixtureAt(32),
  });
  const opened6 = openScreen6(decided.state, {
    expectedRevision: decided.state.revision,
    openedAt: browserEventCardFixtureAt(33),
  });
  const initialized = initializeScreen6UncertaintyProfile(opened6.state, {
    expectedRevision: opened6.state.revision,
    snapshotId: "screen6-result-did-profile",
    actor: "researcher_ui",
    createdAt: browserEventCardFixtureAt(34),
  });
  const planned = saveScreen6DiagnosticPlan(initialized.state, {
    expectedRevision: initialized.state.revision,
    snapshotId: "screen6-result-did-plan",
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
        description: "Assignment occurs once across market groups.",
        timingPattern: "single_time",
        dependence: "grouped_or_clustered",
        independentGroupCount: 24,
        groupingVariables: ["market_id"],
      },
      feasibleDiagnosticVariables: {
        status: "available",
        values: ["outcome", "market_id", "event_time"],
      },
      practicalConstraints: { status: "none_reported", values: [] },
      reportedConcerns: [],
    }),
    actor: "researcher_ui",
    createdAt: browserEventCardFixtureAt(35),
  });
  const card = planned.plan.cards.find(({ libraryEntryId }) =>
    libraryEntryId === "did-pre-treatment-dynamics-v1")!;
  return { planned, card };
}

function completeInput(summary = "Clustered inference remained materially imprecise.") {
  return createScreen6DiagnosticResultInput({
    resultKind: "quantitative",
    provenance: {
      kind: "user_reported",
      sourceDescription: "Researcher-entered output from the declared model",
    },
    summary,
    reportedStatistics: [{
      label: "Policy estimate",
      estimate: 0.12,
      standardError: 0.08,
      confidenceInterval: { levelPercent: 95, lower: -0.04, upper: 0.28 },
      pValue: 0.14,
    }],
    covariance: { status: "not_applicable", dimension: null, values: [] },
    uncertaintyContext: {
      status: "assessed",
      description: "Cluster-robust uncertainty is reported above.",
    },
    specificationContext:
      "Annual outcome model with market fixed effects and clustered uncertainty.",
    power: {
      status: "assessed",
      description: "The interval includes effects of substantive importance.",
    },
    multipleTesting: {
      status: "not_applicable",
      description: "One prespecified focal estimate was inspected.",
    },
    sampleComposition: {
      status: "assessed",
      description: "The same 24 market groups enter each period.",
    },
    precision: {
      status: "assessed",
      description: "The interval is too wide to exclude important effects.",
    },
    postInspectionChange: { status: "none_reported", description: null },
  });
}

function recordCompleteResult() {
  const setup = plannedFixture();
  const recorded = recordScreen6DiagnosticResult(setup.planned.state, {
    expectedRevision: setup.planned.state.revision,
    resultId: "screen6-result-one",
    cardId: setup.card.id,
    expectedPlanFingerprint: setup.planned.plan.planFingerprint,
    expectedCardFingerprint: fingerprintSixScreenValue(setup.card),
    resultInput: completeInput(),
    actor: "researcher_ui",
    submittedAt: browserEventCardFixtureAt(33),
  });
  return { ...setup, recorded };
}

function refingerprint(result: Screen6DiagnosticResult) {
  const { resultFingerprint: _fingerprint, ...body } = result;
  return {
    ...body,
    resultFingerprint: fingerprintSixScreenValue(body),
  } as Screen6DiagnosticResult;
}

describe("Screen 6 diagnostic-result intake and review", () => {
  it("records a provenance-explicit result without calculation or favorable output", () => {
    const { recorded, planned } = recordCompleteResult();
    expect(recorded.result).toMatchObject({
      ordinal: 1,
      provenance: {
        kind: "user_reported",
        calculationReproducibility: "not_reproducible_from_submission",
        localRoutineExecution: "not_performed",
      },
      reviewReadiness: {
        status: "complete_for_researcher_review",
        gaps: [],
      },
      interpretationStatus: "awaiting_researcher_review",
      preparation: { networkRequests: 0, modelCalls: 0, localRoutineCalls: 0 },
      nonOutputs: {
        assumptionEstablished: false,
        diagnosticPass: null,
        aggregateScore: null,
        certification: "not_available",
        conditionalClaimBoundary: null,
        disposition: null,
        credibilityPlanExport: null,
        designRecord: null,
      },
    });
    expect(currentScreen6DiagnosticResults(recorded.state)).toEqual([
      recorded.result,
    ]);
    expect(recorded.state.screen6DiagnosticPlans).toEqual([
      planned.plan,
    ]);
  });

  it("keeps incomplete context reviewable but blocks a reduced-concern decision", () => {
    const setup = plannedFixture();
    const incomplete = createScreen6DiagnosticResultInput({
      ...completeInput(),
      provenance: {
        kind: "user_reported",
        sourceDescription: "Pasted coefficient from a screenshot",
      },
      power: { status: "not_assessed", description: null },
      precision: { status: "not_assessed", description: null },
      postInspectionChange: { status: "not_assessed", description: null },
    });
    const recorded = recordScreen6DiagnosticResult(setup.planned.state, {
      expectedRevision: setup.planned.state.revision,
      resultId: "screen6-result-incomplete",
      cardId: setup.card.id,
      expectedPlanFingerprint: setup.planned.plan.planFingerprint,
      expectedCardFingerprint: fingerprintSixScreenValue(setup.card),
      resultInput: incomplete,
      actor: "researcher_ui",
      submittedAt: browserEventCardFixtureAt(33),
    });
    expect(recorded.result.reviewReadiness.status).toBe("incomplete_context");
    expect(recorded.result.reviewReadiness.gaps).toEqual(expect.arrayContaining([
      "Power has not been assessed for interpretation.",
      "Precision has not been assessed for interpretation.",
      expect.stringMatching(/Post-result changes/iu),
    ]));
    expect(() => reviewScreen6DiagnosticResult(recorded.state, {
      expectedRevision: recorded.state.revision,
      reviewId: "screen6-review-invalid-reduced",
      resultId: recorded.result.id,
      expectedResultFingerprint: recorded.result.resultFingerprint,
      decision: "concern_reduced",
      rationale: "The estimate is not conventionally significant.",
      followUpActions: [],
      actor: "researcher_ui",
      reviewedAt: browserEventCardFixtureAt(34),
    })).toThrow(/incomplete.*cannot support.*reduced/iu);
    const reviewed = reviewScreen6DiagnosticResult(recorded.state, {
      expectedRevision: recorded.state.revision,
      reviewId: "screen6-review-inconclusive",
      resultId: recorded.result.id,
      expectedResultFingerprint: recorded.result.resultFingerprint,
      decision: "inconclusive",
      rationale: "Power, precision, and post-inspection changes remain unknown.",
      followUpActions: ["Assess precision and disclose any post-result changes."],
      actor: "researcher_ui",
      reviewedAt: browserEventCardFixtureAt(34),
    });
    expect(reviewed.review.assumptionEstablished).toBe(false);
    expect(reviewed.review.certification).toBe("not_available");
  });

  it("does not treat an event-study coefficient vector as a covariance matrix", () => {
    const { planned, card } = plannedDidFixture();
    const base = completeInput("Two pre-treatment coefficients were reported.");
    const resultInput = createScreen6DiagnosticResultInput({
      ...base,
      reportedStatistics: [
        {
          label: "Event time -2",
          estimate: 0.04,
          standardError: 0.03,
          confidenceInterval: { levelPercent: 95, lower: -0.02, upper: 0.10 },
          pValue: 0.18,
        },
        {
          label: "Event time -1",
          estimate: 0.07,
          standardError: 0.04,
          confidenceInterval: { levelPercent: 95, lower: -0.01, upper: 0.15 },
          pValue: 0.09,
        },
      ],
      covariance: { status: "not_supplied", dimension: null, values: [] },
    });
    const recorded = recordScreen6DiagnosticResult(planned.state, {
      expectedRevision: planned.state.revision,
      resultId: "screen6-event-study-vector-only",
      cardId: card.id,
      expectedPlanFingerprint: planned.plan.planFingerprint,
      expectedCardFingerprint: fingerprintSixScreenValue(card),
      resultInput,
      actor: "researcher_ui",
      submittedAt: browserEventCardFixtureAt(36),
    });
    expect(recorded.result.reviewReadiness).toMatchObject({
      status: "incomplete_context",
      gaps: expect.arrayContaining([
        expect.stringMatching(/needs its covariance matrix/iu),
      ]),
    });
    expect(() => reviewScreen6DiagnosticResult(recorded.state, {
      expectedRevision: recorded.state.revision,
      reviewId: "screen6-event-study-vector-review",
      resultId: recorded.result.id,
      expectedResultFingerprint: recorded.result.resultFingerprint,
      decision: "concern_reduced",
      rationale: "The point estimates appear small.",
      followUpActions: [],
      actor: "researcher_ui",
      reviewedAt: browserEventCardFixtureAt(37),
    })).toThrow(/incomplete.*cannot support.*reduced/iu);
  });

  it("stores a complete reduced-concern review without claiming proof", () => {
    const { recorded } = recordCompleteResult();
    const reviewed = reviewScreen6DiagnosticResult(recorded.state, {
      expectedRevision: recorded.state.revision,
      reviewId: "screen6-review-one",
      resultId: recorded.result.id,
      expectedResultFingerprint: recorded.result.resultFingerprint,
      decision: "concern_reduced",
      rationale:
        "The declared clustered analysis addresses this narrow inference concern, subject to the reported precision limits.",
      followUpActions: [],
      actor: "researcher_ui",
      reviewedAt: browserEventCardFixtureAt(34),
    });
    expect(currentScreen6DiagnosticResultReviews(reviewed.state)).toEqual([
      reviewed.review,
    ]);
    expect(reviewed.review).toMatchObject({
      decision: "concern_reduced",
      assumptionEstablished: false,
      automaticDesignMutation: "none",
      attributionUpgrade: "none",
      aggregateScore: null,
      certification: "not_available",
      conditionalClaimBoundary: null,
      credibilityPlanExport: null,
      designRecord: null,
    });
    expect(() => reviewScreen6DiagnosticResult(reviewed.state, {
      expectedRevision: reviewed.state.revision,
      reviewId: "screen6-review-two",
      resultId: recorded.result.id,
      expectedResultFingerprint: recorded.result.resultFingerprint,
      decision: "inconclusive",
      rationale: "A second interpretation should not overwrite history.",
      followUpActions: [],
      actor: "researcher_ui",
      reviewedAt: browserEventCardFixtureAt(35),
    })).toThrow(/only once/iu);
  });

  it("validates an imported artifact payload while preserving the reproducibility limit", () => {
    const setup = plannedFixture();
    const userInput = completeInput("Imported declared-model output.");
    const payloadFingerprint = screen6DiagnosticResultPayloadFingerprint(
      userInput,
    );
    const imported = createScreen6DiagnosticResultInput({
      ...userInput,
      provenance: {
        kind: "imported_validated_artifact",
        artifact: {
          schemaVersion: "screen-06-diagnostic-import-artifact-v1",
          artifactId: "analysis-output-1",
          artifactName: "Declared clustered model",
          producer: "Research team",
          methodName: "Clustered linear model",
          methodVersion: "1.0.0",
          generatedAt: browserEventCardFixtureAt(32),
          payloadFingerprint,
        },
      },
    });
    const recorded = recordScreen6DiagnosticResult(setup.planned.state, {
      expectedRevision: setup.planned.state.revision,
      resultId: "screen6-result-imported",
      cardId: setup.card.id,
      expectedPlanFingerprint: setup.planned.plan.planFingerprint,
      expectedCardFingerprint: fingerprintSixScreenValue(setup.card),
      resultInput: imported,
      actor: "researcher_ui",
      submittedAt: browserEventCardFixtureAt(33),
    });
    expect(recorded.result.provenance).toMatchObject({
      kind: "imported_validated_artifact",
      artifactValidation: "schema_and_payload_fingerprint_validated",
      calculationReproducibility: "not_established_by_import_validation",
      localRoutineExecution: "not_performed",
    });
    expect(() => createScreen6DiagnosticResultInput({
      ...userInput,
      provenance: {
        kind: "imported_validated_artifact",
        artifact: {
          ...(imported.provenance.kind === "imported_validated_artifact"
            ? imported.provenance.artifact
            : {}),
          schemaVersion: "screen-06-diagnostic-import-artifact-v1",
          artifactId: "analysis-output-bad",
          artifactName: "Declared clustered model",
          producer: "Research team",
          methodName: "Clustered linear model",
          methodVersion: "1.0.0",
          generatedAt: browserEventCardFixtureAt(32),
          payloadFingerprint: fingerprintSixScreenValue("wrong payload"),
        },
      },
    })).toThrow(/payload fingerprint does not match/iu);
  });

  it("rejects unavailable local execution and non-researcher ownership", () => {
    const { planned, card } = plannedFixture();
    expect(() => createScreen6DiagnosticResultInput({
      ...completeInput(),
      provenance: {
        kind: "reviewed_local_routine",
        routineId: "clustered-model",
        routineVersion: "1.0.0",
        executionId: "execution-1",
      },
    })).toThrow(/No reviewed pinned.*routine is enabled/iu);
    expect(() => createScreen6DiagnosticResult({
      id: "screen6-model-result",
      cardId: card.id,
      plan: planned.plan,
      resultInput: completeInput(),
      priorResults: [],
      actor: "model",
      submittedAt: browserEventCardFixtureAt(33),
    })).toThrow(/explicit researcher UI action/iu);
  });

  it("rejects invalid uncertainty vectors and covariance matrices", () => {
    const twoStatistics = [
      completeInput().reportedStatistics[0]!,
      {
        label: "Alternative estimate",
        estimate: 0.08,
        standardError: 0.06,
        confidenceInterval: {
          levelPercent: 95,
          lower: -0.04,
          upper: 0.20,
        },
        pValue: 0.19,
      },
    ];
    expect(() => createScreen6DiagnosticResultInput({
      ...completeInput(),
      reportedStatistics: twoStatistics,
      covariance: { status: "supplied", dimension: 1, values: [0.01] },
    })).toThrow(/dimension must match.*estimate vector/iu);
    expect(() => createScreen6DiagnosticResultInput({
      ...completeInput(),
      reportedStatistics: twoStatistics,
      covariance: {
        status: "supplied",
        dimension: 2,
        values: [1, 2, 2, 1],
      },
    })).toThrow(/positive semidefinite/iu);
    expect(() => createScreen6DiagnosticResultInput({
      ...completeInput(),
      reportedStatistics: [{
        ...completeInput().reportedStatistics[0]!,
        confidenceInterval: {
          levelPercent: 95,
          lower: 0.20,
          upper: 0.30,
        },
      }],
    })).toThrow(/confidence interval is invalid/iu);
  });

  it("rejects re-fingerprinted favorable-output tampering", () => {
    const { recorded, planned } = recordCompleteResult();
    const tampered = structuredClone(recorded.result);
    tampered.nonOutputs.assumptionEstablished = true as never;
    expect(() => validateScreen6DiagnosticResultCollections({
      plans: [planned.plan],
      results: [refingerprint(tampered)],
      reviews: [],
    })).toThrow(/diagnostic result is invalid/iu);
  });

  it("archives a reviewed result when the researcher records a later revision", () => {
    const { recorded, planned, card } = recordCompleteResult();
    const reviewed = reviewScreen6DiagnosticResult(recorded.state, {
      expectedRevision: recorded.state.revision,
      reviewId: "screen6-review-before-revision",
      resultId: recorded.result.id,
      expectedResultFingerprint: recorded.result.resultFingerprint,
      decision: "revision_needed",
      rationale: "A second declared specification is required.",
      followUpActions: ["Run the prespecified alternative specification."],
      actor: "researcher_ui",
      reviewedAt: browserEventCardFixtureAt(34),
    });
    const revised = recordScreen6DiagnosticResult(reviewed.state, {
      expectedRevision: reviewed.state.revision,
      resultId: "screen6-result-revision",
      cardId: card.id,
      expectedPlanFingerprint: planned.plan.planFingerprint,
      expectedCardFingerprint: fingerprintSixScreenValue(card),
      resultInput: completeInput("The prespecified alternative remained imprecise."),
      actor: "researcher_ui",
      submittedAt: browserEventCardFixtureAt(35),
    });
    expect(currentScreen6DiagnosticResults(revised.state)).toEqual([
      revised.result,
    ]);
    expect(currentScreen6DiagnosticResultReviews(revised.state)).toEqual([]);
    expect(revised.state.artifacts.find(({ snapshotId }) =>
      snapshotId === recorded.result.id)?.status).toBe("archived");
    expect(revised.state.artifacts.find(({ snapshotId }) =>
      snapshotId === reviewed.review.id)?.status).toBe("archived");
    const replanned = saveScreen6DiagnosticPlan(revised.state, {
      expectedRevision: revised.state.revision,
      snapshotId: "screen6-result-replanned",
      diagnosticInput: createScreen6DiagnosticPlanInput({
        ...planned.plan.diagnosticInput,
        reportedConcerns: [
          "group_level_assignment_or_dependence",
          "outcome_or_sample_discontinuity",
        ],
      }),
      actor: "researcher_ui",
      createdAt: browserEventCardFixtureAt(36),
    });
    expect(currentScreen6DiagnosticResults(replanned.state)).toEqual([]);
    expect(replanned.state.artifacts.find(({ snapshotId }) =>
      snapshotId === revised.result.id)?.status).toBe("archived");
  });
});
