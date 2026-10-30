import { describe, expect, it } from "vitest";

import {
  createMechanismLiteraturePlan,
  createMechanismLiteraturePlanInput,
  validateMechanismLiteraturePlan,
  validateMechanismLiteraturePlanCollection,
  type MechanismLiteraturePlan,
} from "../../src/core/six-screen/mechanism-literature-plan";
import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import {
  applyPolicyEventCardClaimDecision,
  applyPolicyTreatmentClockDecision,
  beginPolicyEventCardReview,
  currentMechanismLiteraturePlan,
  lockReviewedPolicyEventCard,
  openScreen5,
  screen5PrerequisiteReport,
  updateStudyContext,
  type StudyContextDraft,
} from "../../src/core/six-screen/workflow";
import { buildSixScreenSourceRegister } from
  "../../src/worker/six-screen-source-register";
import {
  createBrowserEventCardFixture,
} from "../browser/six-screen-event-card-review-fixture";
import { createHistoricalMechanismPlan } from
  "../fixtures/archived-legacy-screen5-plan";

function at(second: number) {
  return new Date(Date.parse("2026-09-15T12:00:00.000Z") + second * 1_000)
    .toISOString();
}

function lockedFixture() {
  const fixture = createBrowserEventCardFixture();
  let state = fixture.state;
  let begun = beginPolicyEventCardReview(state, {
    expectedRevision: state.revision,
    reviewId: "screen5-event-card-review",
    projection: fixture.projection,
    startedAt: at(1),
  });
  state = begun.state;
  let review = begun.review;
  for (const claim of review.claimReviews) {
    const accepted = applyPolicyEventCardClaimDecision(state, {
      expectedRevision: state.revision,
      reviewId: review.id,
      projection: fixture.projection,
      expectedReviewRevision: review.revision,
      expectedReviewFingerprint: review.reviewFingerprint,
      actionId: `screen5-accept-${claim.claimId}`,
      claimId: claim.claimId,
      decision: "accepted",
      rationale: "Retain this reviewed policy premise for literature planning.",
      actor: "researcher_ui",
      decidedAt: at(2 + review.revision),
    });
    state = accepted.state;
    review = accepted.review;
  }
  const clock = applyPolicyTreatmentClockDecision(state, {
    expectedRevision: state.revision,
    reviewId: review.id,
    projection: fixture.projection,
    expectedReviewRevision: review.revision,
    expectedReviewFingerprint: review.reviewFingerprint,
    actionId: "screen5-no-clock",
    decision: { mode: "no_selection" },
    rationale: "No reviewed legal stage establishes unit-level treatment timing.",
    actor: "researcher_ui",
    decidedAt: at(20),
  });
  const locked = lockReviewedPolicyEventCard(clock.state, {
    expectedRevision: clock.state.revision,
    reviewId: clock.review.id,
    projection: fixture.projection,
    expectedReviewRevision: clock.review.revision,
    expectedReviewFingerprint: clock.review.reviewFingerprint,
    actionId: "screen5-lock-event-card",
    eventCardSnapshotId: "screen5-event-card-current",
    rationale: "Lock the reviewed policy record without resolving later modules.",
    actor: "researcher_ui",
    lockedAt: at(21),
  });
  return { ...fixture, state: locked.state, review: locked.review };
}

function studyDraft(state: ReturnType<typeof lockedFixture>["state"]): StudyContextDraft {
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

function savePlan(input: {
  explanation?:
    | { mode: "stated"; text: string }
    | { mode: "undecided"; text: null };
} = {}) {
  const fixture = lockedFixture();
  const opened = openScreen5(fixture.state, {
    expectedRevision: fixture.state.revision,
    openedAt: at(22),
  });
  const capabilities = buildSixScreenSourceRegister();
  const saved = createHistoricalMechanismPlan(opened.state, {
    snapshotId: "mechanism-literature-plan-1",
    planInput: createMechanismLiteraturePlanInput({
      explanation: input.explanation ?? {
        mode: "stated",
        text:
          "The participation process may reduce barriers to market entry.",
      },
      suppliedWorks: [{
        id: "researcher-work-1",
        kind: "doi",
        value: "10.1234/example.2026.1",
      }],
      preferredConstructs: ["organizational adaptation"],
      feasibleDataSources: ["dated market participation filings"],
      knownAlternativeAccounts: ["concurrent market redesign"],
    }),
    capabilities: {
      openalex: capabilities.openalex,
      crossref: capabilities.crossref,
    },
    createdAt: at(23),
  });
  return { fixture, opened, saved };
}

function refingerprintPlan(plan: MechanismLiteraturePlan) {
  const { planFingerprint: _fingerprint, ...body } = plan;
  return {
    ...body,
    planFingerprint: fingerprintSixScreenValue(body),
  } satisfies MechanismLiteraturePlan;
}

describe("Screen 5 saved literature plan", () => {
  it("opens from policy premises without falsely requiring completed design or co-event reviews", () => {
    const fixture = lockedFixture();
    const report = screen5PrerequisiteReport(fixture.state);
    expect(report.ready).toBe(true);
    expect(report.legacyExecutionAvailable).toBe(false);
    expect(report.blockers).toEqual([]);
    expect(report.limitations.map(({ code }) => code)).toEqual([
      "design_review_not_assessed",
      "coevent_review_not_assessed",
      "coevent_relations_not_assessed",
    ]);

    const opened = openScreen5(fixture.state, {
      expectedRevision: fixture.state.revision,
      openedAt: at(22),
    });
    expect(opened.state.activeScreen).toBe(5);
    expect(opened.receipt).toMatchObject({
      designDecisionSnapshotId: null,
      coEventSnapshotId: null,
    });
  });

  it("reads three separate historical unrun branches with policy lineage and capability boundaries", () => {
    const { saved } = savePlan();
    expect(saved.plan.rows.map(({ branch }) => branch)).toEqual([
      "exact_policy_and_response",
      "analogous_intervention_and_process",
      "theory_contrary_findings_and_boundaries",
    ]);
    expect(saved.plan.rows.every(({ outcome }) =>
      outcome.status === "not_started" &&
      outcome.scholarlyRecordIds.length === 0 &&
      outcome.inspectedTextIds.length === 0)).toBe(true);
    expect(saved.plan.rows.reduce((sum, row) =>
      sum + row.plannedLimit.sourceQueries, 0)).toBe(16);
    expect(saved.plan.rows.reduce((sum, row) =>
      sum + row.plannedLimit.metadataRecords, 0)).toBe(80);
    expect(saved.plan.policyPremises.length).toBeGreaterThan(0);
    expect(saved.plan.policyPremises.every((premise) =>
      premise.passageIds.length > 0 && premise.sourceIds.length > 0)).toBe(
        true,
      );
    expect(saved.plan.providerCapabilities).toMatchObject([
      {
        id: "openalex",
        status: "not_configured",
        implemented: true,
        searchRecords: true,
        fetchRepresentation: false,
      },
      {
        id: "crossref",
        status: "enabled_not_tested",
        implemented: true,
        fetchRepresentation: false,
      },
    ]);
    expect(saved.plan.evidenceStatus).toMatchObject({
      suppliedWorks: "not_inspected",
      scholarlyMetadata: "not_retrieved",
      scholarlyText: "not_inspected",
    });
    expect(saved.plan.intelligenceAnalysis).toEqual({
      status: "blocked",
      reason: "genuine_intelligence_path_unverified",
    });
    expect(currentMechanismLiteraturePlan(saved.state)?.snapshotId).toBe(
      saved.plan.snapshotId,
    );
  });

  it("records an explicit undecided state without manufacturing extra mechanisms", () => {
    const { saved } = savePlan({
      explanation: { mode: "undecided", text: null },
    });
    expect(saved.plan.input.explanation).toEqual({
      mode: "undecided",
      text: null,
    });
    expect(saved.plan.rows[2]!.question).toMatch(
      /without presuming a focal mechanism/iu,
    );
    expect(JSON.stringify(saved.plan)).not.toMatch(
      /mechanismCandidate|predictionMatrix|effect size/iu,
    );
  });

  it("marks the plan out of date when prior-results disclosure changes", () => {
    const { saved } = savePlan();
    const changed = updateStudyContext(saved.state, {
      expectedRevision: saved.state.revision,
      study: {
        ...studyDraft(saved.state),
        resultsPreviouslyInspected: "yes",
      },
      updatedAt: at(24),
    });
    expect(currentMechanismLiteraturePlan(changed)).toBeNull();
    expect(changed.artifacts.find(({ snapshotId }) =>
      snapshotId === saved.plan.snapshotId)).toMatchObject({
      status: "out_of_date",
      invalidationReason:
        "The researcher changed a study field used by this result.",
    });
  });

  it("rejects missing construct, malformed supplied identifiers, and changed plan content", () => {
    const fixture = lockedFixture();
    const incomplete = structuredClone(fixture.state);
    incomplete.study.intendedConstruct = null;
    expect(screen5PrerequisiteReport(incomplete)).toMatchObject({
      ready: true,
      legacyExecutionAvailable: false,
    });
    const review = incomplete.policyEventCardReviews!.at(-1)!;
    const sources = buildSixScreenSourceRegister();
    expect(() => createMechanismLiteraturePlan({
      snapshotId: "historical-plan-missing-construct",
      ordinal: 1,
      planInput: createMechanismLiteraturePlanInput({
        explanation: { mode: "undecided", text: null },
        suppliedWorks: [],
        preferredConstructs: [],
        feasibleDataSources: [],
        knownAlternativeAccounts: [],
      }),
      study: incomplete.study,
      confirmedShock: incomplete.confirmedShock!,
      eventCard: review.lockedEventCard!,
      eventCardReview: review,
      designSet: null,
      designDecision: null,
      coEventMatrix: null,
      coEventExecution: null,
      capabilities: { openalex: sources.openalex, crossref: sources.crossref },
      createdAt: at(24),
    })).toThrow(/intended construct/iu);
    expect(() => createMechanismLiteraturePlanInput({
      explanation: { mode: "undecided", text: null },
      suppliedWorks: [{
        id: "bad-doi",
        kind: "doi",
        value: "https://doi.org/10.1234/example",
      }],
      preferredConstructs: [],
      feasibleDataSources: [],
      knownAlternativeAccounts: [],
    })).toThrow(/DOI/iu);

    const { saved } = savePlan();
    const changed = structuredClone(saved.plan);
    changed.rows[0]!.outcome.note = "A search ran successfully.";
    expect(() => validateMechanismLiteraturePlan(changed)).toThrow(
      /fingerprint/iu,
    );
  });

  it("rejects re-fingerprinted partial bindings and forged Event Card lineage", () => {
    const { saved } = savePlan();
    const partialBinding = structuredClone(saved.plan);
    partialBinding.binding.designSetFingerprint =
      fingerprintSixScreenValue("forged-design");
    expect(() => validateMechanismLiteraturePlan(
      refingerprintPlan(partialBinding),
    )).toThrow(/design binding/iu);

    const missingDocumentLineage = structuredClone(saved.plan);
    missingDocumentLineage.policyPremises[0]!.documentVersionIds = [];
    expect(() => validateMechanismLiteraturePlan(
      refingerprintPlan(missingDocumentLineage),
    )).toThrow(/document/iu);

    const forgedReference = structuredClone(saved.plan);
    forgedReference.binding.eventCardReference.reviewId = "forged-review";
    const {
      referenceFingerprint: _referenceFingerprint,
      ...referenceBody
    } = forgedReference.binding.eventCardReference;
    forgedReference.binding.eventCardReference.referenceFingerprint =
      fingerprintSixScreenValue(referenceBody);
    const forgedPlan = refingerprintPlan(forgedReference);
    expect(() => validateMechanismLiteraturePlan(forgedPlan)).not.toThrow();
    expect(() => validateMechanismLiteraturePlanCollection({
      plans: [forgedPlan],
      eventCardReviews: saved.state.policyEventCardReviews ?? [],
      designSets: saved.state.causalDesignSets ?? [],
      designDecisions: saved.state.causalDesignDecisions ?? [],
      coEventMatrices: saved.state.coEventSearchMatrices ?? [],
      coEventExecutions: saved.state.coEventSearchExecutions ?? [],
    })).toThrow(/Event Card lineage/iu);
  });
});
