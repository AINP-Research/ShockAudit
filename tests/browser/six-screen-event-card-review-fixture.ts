import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import type { PolicyReview, SixScreenWorkflowState } from
  "../../src/core/six-screen/contracts";
import {
  createEvidenceSnapshot,
  type EvidenceCollection,
} from "../../src/core/six-screen/evidence";
import { createPolicyChronologySourcePanel } from
  "../../src/core/six-screen/policy-chronology";
import {
  createFederalRegisterPolicyEvidencePlan,
  recordPolicyEvidencePlanAttempt,
} from "../../src/core/six-screen/policy-evidence-plan";
import {
  projectPolicyEvidenceClaims,
  unsearchedFederalRegisterPolicyRequirements,
} from "../../src/core/six-screen/policy-review";
import {
  applyPolicyEventCardClaimDecision,
  applyPolicyTreatmentClockDecision,
  applyIdentityResolution,
  applyPolicyReview,
  beginPolicyEventCardReview,
  beginIdentityResolution,
  confirmDisplayedShock,
  createSixScreenWorkflow,
  lockReviewedPolicyEventCard,
  openScreen2,
  openScreen3,
} from "../../src/core/six-screen/workflow";

export const browserEventCardFixtureRunId = `sa6r_${"b".repeat(43)}`;
export const browserEventCardFixtureAccessToken = `sa6a_${"c".repeat(43)}`;
export const browserEventCardFixtureCreatedAt = "2026-09-12T12:00:00.000Z";

export function browserEventCardFixtureAt(second: number) {
  return new Date(
    Date.parse(browserEventCardFixtureCreatedAt) + second * 1_000,
  ).toISOString();
}

function evidenceCollection(): EvidenceCollection {
  const sourceId = "source-provider-neutral-official-fixture";
  const documentVersionId = "document-provider-neutral-official-fixture";
  const passages = [
    {
      id: "passage-operative",
      exactText:
        "Covered operators must establish a market-participation process.",
      qualification: null,
    },
    {
      id: "passage-coverage",
      exactText:
        "The requirement applies to operators serving the covered market.",
      qualification:
        "Organization-level coverage still requires contemporaneous unit evidence.",
    },
    {
      id: "passage-implementation",
      exactText:
        "A filing is due within 270 days, followed by 365 days to implement.",
      qualification:
        "The passage states deadlines, not actual unit-level implementation.",
    },
    {
      id: "passage-effective",
      exactText: "The final rule takes legal effect on 2020-03-01.",
      qualification:
        "Legal effect is not automatically the study treatment date.",
    },
  ];
  return {
    sources: [{
      id: sourceId,
      provider: "provider-neutral-official-fixture",
      nativeId: "fixture-final-rule-2020",
      canonicalUrl: "https://example.gov/policy/final-rule-2020",
      publisher: "Official fixture publisher",
      issuer: "Example Commission",
      author: null,
      jurisdiction: "United States",
      role: "controlling legal text",
      documentType: "final rule",
      language: "en",
      publicationDate: "2020-01-02",
      legalVersionDates: [],
      retrievedAt: browserEventCardFixtureCreatedAt,
      documentVersionId,
      contentHash: `sha256:${"1".repeat(64)}`,
      acquisitionProvenance: "direct",
      accessStatus: "retained_passage",
      rightsStatus: "public-government-record",
      parserVersion: "provider-neutral-browser-fixture-v1",
      textQualityStatus: "usable",
      inspectedText: "full",
    }],
    documentVersions: [{
      id: documentVersionId,
      sourceId,
      representation: "html",
      language: "en",
      versionLabel: "retained official fixture version",
      retrievedAt: browserEventCardFixtureCreatedAt,
      contentHash: `sha256:${"1".repeat(64)}`,
      parserVersion: "provider-neutral-browser-fixture-v1",
      parsedTextLength: 640,
    }],
    passages: passages.map((passage) => ({
      ...passage,
      sourceId,
      documentVersionId,
      locator: `Section ${passage.id}`,
      startOffset: null,
      endOffset: null,
      unresolvedCrossReferences: [],
    })),
    claims: [
      {
        id: "claim-operative",
        eventId: "identity-policy-browser-fixture",
        predicate: "operative_change",
        typedValue: { action: "establish_market_participation_process" },
        statement:
          "Covered operators must establish a market-participation process.",
        scope: "Covered market operators",
        supportingPassageIds: ["passage-operative"],
        opposingPassageIds: [],
        supportStatus: "direct",
        reviewStatus: "unreviewed",
        criticalFor: ["screen-2"],
      },
      {
        id: "claim-coverage",
        eventId: "identity-policy-browser-fixture",
        predicate: "coverage_condition",
        typedValue: { population: "covered market operators" },
        statement:
          "The requirement applies to operators serving the covered market.",
        scope: "Organizational coverage",
        supportingPassageIds: ["passage-coverage"],
        opposingPassageIds: [],
        supportStatus: "direct",
        reviewStatus: "unreviewed",
        criticalFor: ["screen-2"],
      },
      {
        id: "claim-implementation",
        eventId: "identity-policy-browser-fixture",
        predicate: "implementation_schedule",
        typedValue: {
          filingDeadlineDaysAfterPublication: 270,
          implementationWindowDaysAfterFilingDeadline: 365,
        },
        statement:
          "A filing is due within 270 days, followed by 365 days to implement.",
        scope: "Covered market operators",
        supportingPassageIds: ["passage-implementation"],
        opposingPassageIds: [],
        supportStatus: "direct",
        reviewStatus: "unreviewed",
        criticalFor: ["screen-2"],
      },
      {
        id: "claim-effective",
        eventId: "identity-policy-browser-fixture",
        predicate: "legal_effect_date",
        typedValue: { date: "2020-03-01", stage: "legal_effect" },
        statement: "The final rule takes legal effect on 2020-03-01.",
        scope: "Confirmed final-rule episode",
        supportingPassageIds: ["passage-effective"],
        opposingPassageIds: [],
        supportStatus: "direct",
        reviewStatus: "unreviewed",
        criticalFor: ["screen-2-chronology"],
      },
    ],
    conflicts: [],
    requirements: [
      {
        id: "requirement-operative",
        kind: "operative_change",
        description: "Establish the operative change.",
        status: "supported",
        criticality: "critical",
        supportingClaimIds: ["claim-operative"],
      },
      {
        id: "requirement-coverage",
        kind: "coverage",
        description: "Establish organizational coverage.",
        status: "supported",
        criticality: "critical",
        supportingClaimIds: ["claim-coverage"],
      },
      {
        id: "requirement-implementation",
        kind: "implementation",
        description: "Establish implementation timing.",
        status: "supported",
        criticality: "material",
        supportingClaimIds: ["claim-implementation"],
      },
      {
        id: "requirement-temporal",
        kind: "temporal_stage",
        description: "Keep the legal-effect clock distinct.",
        status: "supported",
        criticality: "critical",
        supportingClaimIds: ["claim-effective"],
      },
      {
        id: "requirement-exemption",
        kind: "exemption",
        description: "Establish material exemptions.",
        status: "not_found",
        criticality: "critical",
        supportingClaimIds: [],
      },
    ],
  };
}

export function createBrowserEventCardFixture() {
  const eventId = "identity-policy-browser-fixture";
  const identityFingerprint = fingerprintSixScreenValue({ eventId });
  let state = createSixScreenWorkflow({
    runId: browserEventCardFixtureRunId,
    studyId: "study-policy-browser-fixture",
    study: {
      population: "Covered market operators",
      analysisUnit: "Operator",
      geography: ["United States"],
      industry: ["Energy"],
      period: { start: "2019", end: "2023" },
      outcome: "Market participation",
      intendedConstruct: "Policy-induced participation",
      initialExplanation:
        "How does the policy affect market participation among covered operators?",
      proposedTreatment: "Covered market operators",
      proposedComparison: "Otherwise comparable uncovered market operators",
      resultsPreviouslyInspected: "no",
    },
    shockInput: "Provider-neutral participation rule fixture",
    requestedJurisdiction: "United States",
    approximateYear: "2020",
    intendedEpisode: "final rule",
    createdAt: browserEventCardFixtureCreatedAt,
  });
  const identitySources = [{
    id: "identity-source-browser-fixture",
    title: "Provider-neutral Participation Final Rule",
    locator: "https://example.gov/policy/final-rule-2020",
    publisher: "Official fixture publisher",
    publishedDate: "2020-01-02",
    authorityTier: "primary",
    retrievedAt: browserEventCardFixtureAt(1),
  }];
  const started = beginIdentityResolution(state, {
    expectedRevision: 0,
    requestId: "identity-request-browser-fixture",
    requestedAt: browserEventCardFixtureAt(1),
  });
  state = applyIdentityResolution(started.state, {
    expectedRevision: 1,
    request: started.request,
    candidates: [{
      id: eventId,
      officialTitle: "Provider-neutral Participation Final Rule",
      aliases: ["Participation rule fixture"],
      issuer: "Example Commission",
      issuingJurisdiction: "United States",
      instrumentType: "Final rule",
      formalIdentifiers: ["2020-12345"],
      episode: "final rule",
      versionScope: "Final rule published January 2, 2020",
      typedDates: [{
        start: "2020-01-02",
        end: null,
        precision: "day",
        kind: "publication",
        passageIds: [],
      }],
      identitySourceIds: ["identity-source-browser-fixture"],
      sourceSnapshotId: "identity-snapshot-browser-fixture",
      sourceSnapshotFingerprint: fingerprintSixScreenValue(identitySources),
      identitySources,
      displayedDescription:
        "The frozen official fixture identifies the requested final-rule episode; operative details remain evidence-bound in Screen 2.",
      matchExplanation:
        "Title, issuer, formal identifier, and episode align in the frozen fixture.",
      materialMismatches: [],
      retrievedAt: browserEventCardFixtureAt(1),
    }],
    appliedAt: browserEventCardFixtureAt(2),
  });
  const candidate = state.candidates[0]!;
  state = confirmDisplayedShock(state, {
    expectedRevision: 2,
    candidateId: candidate.id,
    displayedIdentityFingerprint: candidate.identityFingerprint,
    sourceSnapshotId: candidate.sourceSnapshotId,
    sourceSnapshotFingerprint: candidate.sourceSnapshotFingerprint,
    originalRequestFingerprint: state.originalRequestFingerprint,
    currentRequestFingerprint: state.currentRequestFingerprint,
    identityRevision: state.identityRevision,
    interactionId: "identity-confirm-browser-fixture",
    decisionId: "identity-confirm-decision-browser-fixture",
    actor: "researcher_ui",
    confirmedAt: browserEventCardFixtureAt(3),
  });
  state = openScreen2(state, {
    expectedRevision: 3,
    openedAt: browserEventCardFixtureAt(4),
  }).state;

  const collection = evidenceCollection();
  const evidenceSnapshot = createEvidenceSnapshot({
    id: "policy-evidence-browser-fixture-r1",
    revision: 1,
    eventId,
    createdAt: browserEventCardFixtureAt(5),
    collection,
  });
  const projection = createPolicyChronologySourcePanel({
    identityFingerprint: candidate.identityFingerprint,
    snapshot: evidenceSnapshot,
    collection,
  });
  let plan = createFederalRegisterPolicyEvidencePlan({
    id: "policy-plan-browser-fixture",
    identityFingerprint: candidate.identityFingerprint,
    documentNumber: "2020-12345",
    createdAt: browserEventCardFixtureAt(4),
  });
  plan = recordPolicyEvidencePlanAttempt(plan, {
    stepId: plan.steps[0]!.id,
    outcome: "searched",
    attemptedAt: browserEventCardFixtureAt(5),
    failureCode: null,
    note: "The frozen provider-neutral official representation was retained.",
  });
  const requirementStatus = new Map(
    collection.requirements.map(({ kind, status }) => [kind, status]),
  );
  const requirements = unsearchedFederalRegisterPolicyRequirements(
    "2020-12345",
  ).map(({ kind, description, status, criticality }) => ({
    kind: kind as PolicyReview["requirements"][number]["kind"],
    description,
    status: requirementStatus.get(kind) ?? status,
    criticality,
  }));
  const claims = projectPolicyEvidenceClaims(collection);
  const review: PolicyReview = {
    protocolVersion: "screen-02-federal-register-policy-v2",
    taskId: "policy-task-browser-fixture",
    status: "partial",
    failureCode: null,
    documentNumber: "2020-12345",
    identityFingerprint: candidate.identityFingerprint,
    evidenceSnapshotId: evidenceSnapshot.id,
    evidenceSnapshotFingerprint: evidenceSnapshot.snapshotFingerprint,
    artifactStatus: "current",
    sourceCount: collection.sources.length,
    passageCount: collection.passages.length,
    claimCount: claims.length,
    claims,
    plan,
    progress: {
      searchedSteps: 1,
      totalSteps: plan.steps.length,
      retainedDocuments: collection.documentVersions.length,
      chargedDocumentAttempts: 1,
      interruptedOperations: 0,
      receivedBytes: 640,
      activeResearchMs: 10,
      continuationMode: "panel_driven",
    },
    requirements,
    attemptedSources: [collection.sources[0]!.canonicalUrl],
    unresolved: requirements
      .filter(({ status }) => status !== "supported" && status !== "not_applicable")
      .map(({ kind }) => kind),
    limitation:
      "Material exemptions and unit-level implementation remain unresolved.",
    researchedAt: browserEventCardFixtureAt(5),
    invalidatedAt: null,
    invalidationReason: null,
  };
  state = applyPolicyReview(state, {
    expectedRevision: 4,
    review,
    appliedAt: browserEventCardFixtureAt(5),
  });
  return { state, collection, evidenceSnapshot, projection };
}

export function createLockedBrowserEventCardFixture() {
  const fixture = createBrowserEventCardFixture();
  let state = fixture.state;
  let outcome = beginPolicyEventCardReview(state, {
    expectedRevision: state.revision,
    reviewId: "policy-event-card-review-locked-fixture",
    projection: fixture.projection,
    startedAt: browserEventCardFixtureAt(6),
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
      actionId: `locked-fixture-accept-${claim.claimId}`,
      claimId: claim.claimId,
      decision: "accepted",
      rationale: "Retain the exact source-linked fact in the locked fixture.",
      actor: "researcher_ui",
      decidedAt: browserEventCardFixtureAt(7 + review.revision),
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
    actionId: "locked-fixture-no-treatment-clock",
    decision: { mode: "no_selection" },
    rationale: "No legal stage establishes unit-level treatment timing.",
    actor: "researcher_ui",
    decidedAt: browserEventCardFixtureAt(20),
  });
  const locked = lockReviewedPolicyEventCard(clock.state, {
    expectedRevision: clock.state.revision,
    reviewId: clock.review.id,
    projection: fixture.projection,
    expectedReviewRevision: clock.review.revision,
    expectedReviewFingerprint: clock.review.reviewFingerprint,
    actionId: "locked-fixture-lock-event-card",
    eventCardSnapshotId: "policy-event-card-locked-fixture",
    rationale: "Lock this source-linked Event Card for downstream tests.",
    actor: "researcher_ui",
    lockedAt: browserEventCardFixtureAt(21),
  });
  return {
    ...fixture,
    state: locked.state,
    review: locked.review,
    eventCard: locked.eventCard,
  };
}

export const frozenV24Screen6InputFingerprint =
  "fnv1a64:bf42f2fb76dde935" as const;

/** Frozen v24 records used revision-bound Screen 3 study coordinates. */
function freezeV24Screen3Coordinates(
  current: SixScreenWorkflowState,
): SixScreenWorkflowState {
  const state = structuredClone(current);
  state.study.intendedConstruct = null;
  const studyFingerprint = fingerprintSixScreenValue({
    id: state.study.id,
    revision: state.study.revision,
    population: state.study.population,
    analysisUnit: state.study.analysisUnit,
    geography: state.study.geography,
    industry: state.study.industry,
    period: state.study.period,
    outcome: state.study.outcome,
    outcomeMeasure: state.study.outcomeMeasure ?? null,
    intendedConstruct: state.study.intendedConstruct,
    policySideConcept: state.study.policySideConcept ?? null,
    initialExplanation: state.study.initialExplanation,
    proposedTreatment: state.study.proposedTreatment,
    proposedComparison: state.study.proposedComparison,
    resultsPreviouslyInspected: state.study.resultsPreviouslyInspected,
  });
  const entry = state.screen3StudyEntryContexts?.at(-1);
  const advice = state.studyDesignAdvices?.at(-1);
  if (!entry || !advice) throw new Error("Expected frozen Screen 3 records.");
  const entryFingerprint = fingerprintSixScreenValue({
    identityFingerprint: entry.identityFingerprint,
    studyRevision: entry.studyRevision,
    studyFingerprint,
    timingId: entry.timingId,
    timingFingerprint: entry.timingFingerprint,
    evidence: entry.evidence,
    clarificationFingerprint: entry.clarificationFingerprint,
  });
  entry.studyFingerprint = studyFingerprint;
  entry.entryFingerprint = entryFingerprint;
  entry.id = `screen3-entry-${entryFingerprint.slice("fnv1a64:".length)}`;
  const optionIds = new Map(advice.options.map((option) => [
    option.optionId,
    `method-${option.entryId.toLowerCase()}-${entryFingerprint.slice(
      "fnv1a64:".length,
    )}`,
  ]));
  advice.options = advice.options.map((option) => ({
    ...option,
    optionId: optionIds.get(option.optionId)!,
  }));
  advice.warnings = advice.warnings.map((warning) => {
    const { warningId: _warningId, ...saved } = warning;
    const content = {
      ...saved,
      affectedOptionIds: saved.affectedOptionIds.map((id) =>
        optionIds.get(id) ?? id),
    };
    return {
      warningId: `warning-${fingerprintSixScreenValue(content).slice(
        "fnv1a64:".length,
      )}`,
      ...content,
    };
  });
  advice.binding.studyFingerprint = studyFingerprint;
  const {
    schemaVersion: _schemaVersion,
    adviceId: _adviceId,
    createdAt: _createdAt,
    adviceFingerprint: _adviceFingerprint,
    ...adviceContent
  } = advice;
  advice.adviceFingerprint = fingerprintSixScreenValue(adviceContent);
  advice.adviceId = `screen3-advice-${advice.adviceFingerprint.slice(
    "fnv1a64:".length,
  )}`;
  return state;
}

/** One exact v24-era state used to prove compatible result restoration. */
export function createFrozenV24Screen6Fixture() {
  const fixture = createLockedBrowserEventCardFixture();
  const opened = openScreen3(fixture.state, {
    expectedRevision: fixture.state.revision,
    study: {
      population: "U.S. firms",
      analysisUnit: "firm-year",
      geography: ["United States"],
      industry: ["Energy"],
      period: { start: "2018", end: "2024" },
      outcome: "Firm performance",
      outcomeMeasure: "Return on assets",
      intendedConstruct: null,
      policySideConcept: "Participation flexibility",
      initialExplanation: "Through operating choices.",
      proposedTreatment: "Eligible firms",
      proposedComparison: "Other firms",
      resultsPreviouslyInspected: "not_disclosed",
    },
    proposedTiming: {
      mode: "year",
      year: 2020,
      milestoneReference: null,
    },
    openedAt: "2026-09-25T13:00:00.000Z",
  });
  const state = freezeV24Screen3Coordinates(opened.state);
  const planFingerprint = state.studyDesignAdvices?.at(-1)?.adviceFingerprint;
  if (!planFingerprint) throw new Error("Expected a frozen v24 advice binding.");
  return { ...fixture, state };
}
