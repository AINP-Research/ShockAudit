import { describe, expect, it } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import {
  SCREEN6_UNCERTAINTY_DIMENSIONS,
  validateScreen6UncertaintyProfile,
  type Screen6UncertaintyProfile,
} from "../../src/core/six-screen/screen6-uncertainty-profile";
import {
  createSixScreenWorkflow,
  currentScreen6UncertaintyProfile,
  initializeScreen6UncertaintyProfile,
  openScreen6,
  screen6PrerequisiteReport,
  updateStudyContext,
  type StudyContextDraft,
} from "../../src/core/six-screen/workflow";
import {
  createBrowserEventCardFixture,
  createLockedBrowserEventCardFixture,
} from "../browser/six-screen-event-card-review-fixture";

function at(second: number) {
  return new Date(Date.parse("2026-09-15T15:00:00.000Z") + second * 1_000)
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
    initialExplanation: state.study.initialExplanation,
    proposedTreatment: state.study.proposedTreatment,
    proposedComparison: state.study.proposedComparison,
    resultsPreviouslyInspected: state.study.resultsPreviouslyInspected,
  };
}

function refingerprint(profile: Screen6UncertaintyProfile) {
  const { profileFingerprint: _fingerprint, ...body } = profile;
  return {
    ...body,
    profileFingerprint: fingerprintSixScreenValue(body),
  } satisfies Screen6UncertaintyProfile;
}

function initializedFixture() {
  const fixture = createBrowserEventCardFixture();
  const opened = openScreen6(fixture.state, {
    expectedRevision: fixture.state.revision,
    openedAt: at(1),
  });
  const initialized = initializeScreen6UncertaintyProfile(opened.state, {
    expectedRevision: opened.state.revision,
    snapshotId: "screen6-profile-one",
    actor: "researcher_ui",
    createdAt: at(2),
  });
  return { fixture, opened, initialized };
}

describe("Screen 6 uncertainty-profile foundation", () => {
  it("opens from a current confirmed identity and preserves missing Screens 2–5 as gaps", () => {
    const fixture = createBrowserEventCardFixture();
    const report = screen6PrerequisiteReport(fixture.state);
    expect(report.ready).toBe(true);
    expect(report.blockers).toEqual([]);
    expect(report.limitations.map(({ code }) => code)).toEqual([
      "policy_record_not_assessed",
      "comparison_review_not_assessed",
      "coevent_review_not_assessed",
      "coevent_relations_not_assessed",
      "mechanism_literature_not_assessed",
      "mechanism_review_not_assessed",
      "diagnostic_inputs_not_recorded",
      "diagnostic_results_not_supplied",
    ]);

    const opened = openScreen6(fixture.state, {
      expectedRevision: fixture.state.revision,
      openedAt: at(1),
    });
    expect(opened.state.activeScreen).toBe(6);
    expect(opened.receipt).toMatchObject({
      studyRevision: fixture.state.study.revision,
      identityRevision: fixture.state.identityRevision,
      currentEventCardSnapshotId: null,
      currentDesignDecisionSnapshotId: null,
      currentCoEventSnapshotId: null,
      currentMechanismInputSnapshotId: null,
    });
  });

  it("initializes all ten dimensions without diagnostics, results, scoring, or certification", () => {
    const { initialized } = initializedFixture();
    const profile = initialized.profile;
    expect(profile.dimensions.map(({ dimension }) => dimension)).toEqual(
      SCREEN6_UNCERTAINTY_DIMENSIONS,
    );
    expect(new Set(profile.dimensions.map(({ state }) => state))).toEqual(
      new Set(["evidence_needed", "not_assessed"]),
    );
    expect(profile.dimensions.every(({ proposedDiagnostic, response }) =>
      proposedDiagnostic === null && response === null)).toBe(true);
    expect(profile.diagnosticPlanning).toEqual({
      status: "not_started",
      methodLibraryVersion: null,
      selectedDiagnosticIds: [],
      cards: [],
    });
    expect(profile.resultsReview).toEqual({
      status: "not_supplied",
      history: [],
    });
    expect(profile.credibilitySummary).toEqual({
      aggregateScore: null,
      universalBadge: null,
      certification: "not_available",
    });
    expect(profile.nonOutputs).toEqual({
      diagnosticResults: [],
      conditionalClaimBoundary: null,
      disposition: null,
      designRecord: null,
    });
    expect(profile.preparation).toEqual({
      actor: "researcher",
      method: "deterministic_fixed_software",
      networkRequests: 0,
      modelCalls: 0,
    });
    expect(currentScreen6UncertaintyProfile(initialized.state)?.snapshotId)
      .toBe(profile.snapshotId);
    expect(initialized.state.artifacts.at(-1)).toMatchObject({
      snapshotId: profile.snapshotId,
      screen: 6,
      status: "current",
    });
  });

  it("binds a current reviewed Event Card while keeping its Screen 6 implications unassessed", () => {
    const fixture = createLockedBrowserEventCardFixture();
    const report = screen6PrerequisiteReport(fixture.state);
    expect(report.currentEventCardSnapshotId).toBe(
      fixture.review.lockedEventCard?.snapshotId,
    );
    expect(report.limitations.map(({ code }) => code)).not.toContain(
      "policy_record_not_assessed",
    );
    const opened = openScreen6(fixture.state, {
      expectedRevision: fixture.state.revision,
      openedAt: at(1),
    });
    const initialized = initializeScreen6UncertaintyProfile(opened.state, {
      expectedRevision: opened.state.revision,
      snapshotId: "screen6-profile-event-card",
      actor: "researcher_ui",
      createdAt: at(2),
    });
    expect(initialized.profile.binding.eventCardReference).toMatchObject({
      eventCardSnapshotId: fixture.review.lockedEventCard?.snapshotId,
      eventCardFingerprint: fixture.review.lockedEventCard?.eventCardFingerprint,
    });
    expect(initialized.profile.upstreamModules[0]).toMatchObject({
      module: "screen_2_policy_record",
      availability: "available",
      limitation: null,
    });
    expect(initialized.profile.dimensions.find(({ dimension }) =>
      dimension === "institutional_evidence")).toMatchObject({
        state: "not_assessed",
        sourceSnapshotId: fixture.review.lockedEventCard?.snapshotId,
        proposedDiagnostic: null,
      });
  });

  it("requires the explicit researcher action and rejects duplicate current inputs", () => {
    const fixture = createBrowserEventCardFixture();
    const opened = openScreen6(fixture.state, {
      expectedRevision: fixture.state.revision,
      openedAt: at(1),
    });
    expect(() => initializeScreen6UncertaintyProfile(opened.state, {
      expectedRevision: opened.state.revision,
      snapshotId: "screen6-profile-model",
      actor: "model",
      createdAt: at(2),
    })).toThrow(/explicit researcher UI action/iu);

    const initialized = initializeScreen6UncertaintyProfile(opened.state, {
      expectedRevision: opened.state.revision,
      snapshotId: "screen6-profile-researcher",
      actor: "researcher_ui",
      createdAt: at(2),
    });
    expect(() => initializeScreen6UncertaintyProfile(initialized.state, {
      expectedRevision: initialized.state.revision,
      snapshotId: "screen6-profile-same-inputs",
      actor: "researcher_ui",
      createdAt: at(3),
    })).toThrow(/reused current inputs/iu);
  });

  it("rejects favorable-status tampering even when the inner fingerprint is recomputed", () => {
    const { initialized } = initializedFixture();
    const tampered = structuredClone(initialized.profile);
    tampered.dimensions[0]!.state = "planned";
    expect(() => validateScreen6UncertaintyProfile(refingerprint(tampered)))
      .toThrow(/profile is invalid/iu);
  });

  it("makes the current profile noncurrent when a bound study field changes", () => {
    const { initialized } = initializedFixture();
    const draft = studyDraft(initialized.state);
    const revised = updateStudyContext(initialized.state, {
      expectedRevision: initialized.state.revision,
      study: {
        ...draft,
        outcome: `${draft.outcome ?? "Outcome"} revised`,
      },
      updatedAt: at(3),
    });
    expect(currentScreen6UncertaintyProfile(revised)).toBeNull();
    expect(revised.artifacts.find(({ snapshotId }) =>
      snapshotId === initialized.profile.snapshotId)).toMatchObject({
        status: "out_of_date",
      });
    expect(revised.screen6UncertaintyProfiles).toHaveLength(1);
  });

  it("blocks Screen 6 before identity confirmation", () => {
    const state = createSixScreenWorkflow({
      runId: "screen6-unconfirmed-run",
      studyId: "screen6-unconfirmed-study",
      study: {
        population: null,
        analysisUnit: null,
        geography: [],
        industry: [],
        period: { start: null, end: null },
        outcome: null,
        intendedConstruct: null,
        initialExplanation: null,
        proposedTreatment: null,
        proposedComparison: null,
        resultsPreviouslyInspected: "not_disclosed",
      },
      shockInput: "Unconfirmed policy",
      createdAt: at(0),
    });
    expect(screen6PrerequisiteReport(state)).toMatchObject({
      ready: false,
      blockers: [{ code: "confirmed_policy" }],
    });
    expect(() => openScreen6(state, {
      expectedRevision: state.revision,
      openedAt: at(1),
    })).toThrow(/researcher-confirmed policy identity/iu);
  });
});
