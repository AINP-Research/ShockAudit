import { describe, expect, it } from "vitest";

import {
  applyPolicyEventCardClaimDecision,
  applyPolicyTreatmentClockDecision,
  beginPolicyEventCardReview,
  decideStudyDesignAdvice,
  lockReviewedPolicyEventCard,
  openScreen3,
  screen3HandoffDependencyManifest,
} from
  "../../src/core/six-screen/workflow";
import { createPolicyBriefing } from
  "../../src/core/six-screen/policy-review";
import {
  browserEventCardFixtureAt,
  createBrowserEventCardFixture,
} from
  "../browser/six-screen-event-card-review-fixture";

describe("Screen 3 handoff dependency manifest", () => {
  it("ignores operational view, revision, and timestamp progress", () => {
    const state = createBrowserEventCardFixture().state;
    const progressed = structuredClone(state);
    progressed.activeScreen = 6;
    progressed.revision += 7;
    progressed.updatedAt = "2026-09-25T20:25:00.000Z";

    expect(screen3HandoffDependencyManifest(progressed))
      .toEqual(screen3HandoffDependencyManifest(state));
  });

  it("ignores policy retrieval bookkeeping that deterministic guidance does not read", () => {
    const state = createBrowserEventCardFixture().state;
    expect(state.policyReview).not.toBeNull();
    const progressed = structuredClone(state);
    progressed.policyReview!.progress.receivedBytes += 8_192;
    progressed.policyReview!.progress.activeResearchMs += 250;
    progressed.policyReview!.progress.interruptedOperations += 1;
    progressed.policyReview!.plan.updatedAt = "2026-09-25T20:25:00.000Z";
    progressed.policyReview!.plan.steps[0]!.attempts += 1;
    progressed.policyReview!.plan.steps[0]!.lastAttemptedAt =
      "2026-09-25T20:25:00.000Z";

    expect(screen3HandoffDependencyManifest(progressed))
      .toEqual(screen3HandoffDependencyManifest(state));
  });

  it("changes for policy evidence used by deterministic guidance", () => {
    const state = createBrowserEventCardFixture().state;
    expect(state.policyReview?.claims.length).toBeGreaterThan(0);
    const changed = structuredClone(state);
    changed.policyReview!.claims[0]!.statement += " Corrected version.";

    expect(screen3HandoffDependencyManifest(changed).dependencyFingerprint)
      .not.toBe(
        screen3HandoffDependencyManifest(state).dependencyFingerprint,
      );
  });

  it("changes for the confirmed identity", () => {
    const state = createBrowserEventCardFixture().state;
    const identityChanged = structuredClone(state);
    identityChanged.confirmedShock = {
      ...identityChanged.confirmedShock!,
      identityFingerprint: "fnv1a64:0123456789abcdef",
    };

    const original = screen3HandoffDependencyManifest(state)
      .dependencyFingerprint;
    expect(screen3HandoffDependencyManifest(identityChanged)
      .dependencyFingerprint).not.toBe(original);
  });

  it("changes for clarification-bound current Screen 3 guidance", () => {
    const base = createBrowserEventCardFixture().state;
    const state = openScreen3(base, {
      expectedRevision: base.revision,
      study: {
        ...base.study,
        policySideConcept: "market access rules",
        initialExplanation:
          "Expanded access may change operator operating margins.",
        proposedTreatment: "operators after 2020",
        proposedComparison: "operators before 2020",
      },
      proposedTiming: {
        mode: "year",
        year: 2020,
        milestoneReference: null,
      },
      clarifications: {},
      openedAt: "2026-09-25T20:00:00.000Z",
    }).state;
    const entry = state.screen3StudyEntryContexts?.at(-1);
    const advice = state.studyDesignAdvices?.at(-1);
    expect(entry).toBeDefined();
    expect(advice).toBeDefined();

    const clarificationChanged = structuredClone(state);
    clarificationChanged.screen3StudyEntryContexts!.at(-1)!
      .clarificationFingerprint = "fnv1a64:0123456789abcdef";
    expect(screen3HandoffDependencyManifest(clarificationChanged)
      .dependencyFingerprint).not.toBe(
        screen3HandoffDependencyManifest(state).dependencyFingerprint,
      );

    const adviceChanged = structuredClone(state);
    adviceChanged.studyDesignAdvices!.at(-1)!.adviceFingerprint =
      "fnv1a64:fedcba9876543210";
    expect(screen3HandoffDependencyManifest(adviceChanged)
      .dependencyFingerprint).not.toBe(
        screen3HandoffDependencyManifest(state).dependencyFingerprint,
      );
  });

  it("binds current Screen 3 record identity and actual content", () => {
    const base = createBrowserEventCardFixture().state;
    const state = openScreen3(base, {
      expectedRevision: base.revision,
      study: {
        ...base.study,
        policySideConcept: "market access rules",
        initialExplanation:
          "Expanded access may change operator operating margins.",
        proposedTreatment: "operators after 2020",
        proposedComparison: "operators before 2020",
      },
      proposedTiming: {
        mode: "year",
        year: 2020,
        milestoneReference: null,
      },
      clarifications: {},
      openedAt: "2026-09-25T20:00:00.000Z",
    }).state;
    const original = screen3HandoffDependencyManifest(state)
      .dependencyFingerprint;

    const entryIdentityChanged = structuredClone(state);
    entryIdentityChanged.screen3StudyEntryContexts!.at(-1)!.id += "-changed";
    expect(screen3HandoffDependencyManifest(entryIdentityChanged)
      .dependencyFingerprint).not.toBe(original);

    const entryContentChanged = structuredClone(state);
    entryContentChanged.screen3StudyEntryContexts!.at(-1)!.evidence.limitation =
      "A different scientific limitation applies.";
    expect(screen3HandoffDependencyManifest(entryContentChanged)
      .dependencyFingerprint).not.toBe(original);

    const adviceIdentityChanged = structuredClone(state);
    adviceIdentityChanged.studyDesignAdvices!.at(-1)!.adviceId += "-changed";
    expect(screen3HandoffDependencyManifest(adviceIdentityChanged)
      .dependencyFingerprint).not.toBe(original);

    const adviceContentChanged = structuredClone(state);
    adviceContentChanged.studyDesignAdvices!.at(-1)!.clarifications.moderator =
      "A changed moderator";
    expect(screen3HandoffDependencyManifest(adviceContentChanged)
      .dependencyFingerprint).not.toBe(original);
  });

  it("binds the current researcher method choice but not its save time", () => {
    const base = createBrowserEventCardFixture().state;
    const opened = openScreen3(base, {
      expectedRevision: base.revision,
      study: {
        ...base.study,
        policySideConcept: "market access rules",
        initialExplanation:
          "Expanded access may change operator operating margins.",
        proposedTreatment: "operators after 2020",
        proposedComparison: "operators before 2020",
      },
      proposedTiming: {
        mode: "year",
        year: 2020,
        milestoneReference: null,
      },
      clarifications: {},
      openedAt: "2026-09-25T20:00:00.000Z",
    });
    const advice = opened.state.studyDesignAdvices!.at(-1)!;
    const decideAt = (selectedAt: string) => decideStudyDesignAdvice(
      opened.state,
      {
        expectedRevision: opened.state.revision,
        adviceId: advice.adviceId,
        expectedAdviceFingerprint: advice.adviceFingerprint,
        decision: { mode: "no_selection" },
        rationale: "Keep the method undecided pending diagnostics.",
        selectedAt,
      },
    ).state;
    const first = decideAt("2026-09-25T20:01:00.000Z");
    const later = decideAt("2026-09-25T20:02:00.000Z");

    expect(screen3HandoffDependencyManifest(first).dependencyFingerprint)
      .not.toBe(
        screen3HandoffDependencyManifest(opened.state).dependencyFingerprint,
      );
    expect(screen3HandoffDependencyManifest(later))
      .toEqual(screen3HandoffDependencyManifest(first));
  });

  it("ignores Event Card and briefing timestamps but retains their semantics", () => {
    const briefingState = createBrowserEventCardFixture().state;
    briefingState.policyReview!.briefing = createPolicyBriefing({
      title: briefingState.confirmedShock!.officialTitle,
      claims: briefingState.policyReview!.claims,
      requirements: briefingState.policyReview!.requirements,
      generatedAt: "2026-09-25T20:00:00.000Z",
    });
    const briefingRetimed = structuredClone(briefingState);
    briefingRetimed.policyReview!.briefing!.generatedAt =
      "2026-09-25T20:01:00.000Z";
    expect(screen3HandoffDependencyManifest(briefingRetimed))
      .toEqual(screen3HandoffDependencyManifest(briefingState));
    const briefingChanged = structuredClone(briefingState);
    briefingChanged.policyReview!.briefing!.overview += " Corrected summary.";
    expect(screen3HandoffDependencyManifest(briefingChanged)
      .dependencyFingerprint).not.toBe(
        screen3HandoffDependencyManifest(briefingState).dependencyFingerprint,
      );

    const lockedAtOffset = (offset: number) => {
      const fixture = createBrowserEventCardFixture();
      let state = fixture.state;
      let outcome = beginPolicyEventCardReview(state, {
        expectedRevision: state.revision,
        reviewId: "policy-event-card-review-retimed-fixture",
        projection: fixture.projection,
        startedAt: browserEventCardFixtureAt(offset),
      });
      state = outcome.state;
      let review = outcome.review;
      for (const claim of review.claimReviews) {
        outcome = applyPolicyEventCardClaimDecision(state, {
          expectedRevision: state.revision,
          reviewId: review.id,
          projection: fixture.projection,
          expectedReviewRevision: review.revision,
          expectedReviewFingerprint: review.reviewFingerprint,
          actionId: `retimed-fixture-accept-${claim.claimId}`,
          claimId: claim.claimId,
          decision: "accepted",
          rationale: "Retain the exact source-linked fact.",
          actor: "researcher_ui",
          decidedAt: browserEventCardFixtureAt(offset + 1 + review.revision),
        });
        state = outcome.state;
        review = outcome.review;
      }
      const clock = applyPolicyTreatmentClockDecision(state, {
        expectedRevision: state.revision,
        reviewId: review.id,
        projection: fixture.projection,
        expectedReviewRevision: review.revision,
        expectedReviewFingerprint: review.reviewFingerprint,
        actionId: "retimed-fixture-no-treatment-clock",
        decision: { mode: "no_selection" },
        rationale: "No legal stage establishes unit-level timing.",
        actor: "researcher_ui",
        decidedAt: browserEventCardFixtureAt(offset + 20),
      });
      return lockReviewedPolicyEventCard(clock.state, {
        expectedRevision: clock.state.revision,
        reviewId: clock.review.id,
        projection: fixture.projection,
        expectedReviewRevision: clock.review.revision,
        expectedReviewFingerprint: clock.review.reviewFingerprint,
        actionId: "retimed-fixture-lock-event-card",
        eventCardSnapshotId: "policy-event-card-retimed-fixture",
        rationale: "Lock this source-linked Event Card.",
        actor: "researcher_ui",
        lockedAt: browserEventCardFixtureAt(offset + 21),
      }).state;
    };
    const eventState = lockedAtOffset(30);
    const retimed = lockedAtOffset(90);
    expect(screen3HandoffDependencyManifest(retimed))
      .toEqual(screen3HandoffDependencyManifest(eventState));

    const corrected = structuredClone(eventState);
    corrected.policyEventCardReviews!.at(-1)!.lockedEventCard!.claims[0]!
      .effectiveStatement += " Researcher correction.";
    expect(screen3HandoffDependencyManifest(corrected).dependencyFingerprint)
      .not.toBe(
        screen3HandoffDependencyManifest(eventState).dependencyFingerprint,
      );
    const sourceVersionChanged = structuredClone(eventState);
    sourceVersionChanged.policyEventCardReviews!.at(-1)!.binding
      .evidenceSnapshotRevision += 1;
    expect(screen3HandoffDependencyManifest(sourceVersionChanged)
      .dependencyFingerprint).not.toBe(
        screen3HandoffDependencyManifest(eventState).dependencyFingerprint,
      );
  });
});
