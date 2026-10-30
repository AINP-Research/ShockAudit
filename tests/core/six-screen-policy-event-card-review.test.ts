import { describe, expect, it } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import type { PolicyReview } from
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
  assessPolicyEventCardReference,
  createPolicyEventCardReference,
  createPolicyEventCardReview,
  createPolicyEventCardReviewRevision,
  decidePolicyTreatmentClock,
  lockPolicyEventCardReview,
  reviewPolicyEventCardClaim,
  validatePolicyEventCardReview,
  type PolicyClaimReviewDecision,
  type PolicyEventCardReviewState,
} from "../../src/core/six-screen/policy-event-card-review";
import {
  applyIdentityResolution,
  applyPolicyEventCardClaimDecision,
  applyPolicyReview,
  applyPolicyTreatmentClockDecision,
  beginIdentityResolution,
  beginPolicyEventCardReview,
  confirmDisplayedShock,
  createSixScreenWorkflow,
  lockReviewedPolicyEventCard,
  openScreen2,
} from "../../src/core/six-screen/workflow";
import {
  InMemorySixScreenWorkflowStorage,
  SixScreenWorkflowStore,
} from "../../src/worker/six-screen-workflow-store";
import { SixScreenEvidenceStore } from
  "../../src/worker/six-screen-evidence-store";
import { SixScreenWorkflowRuntime } from
  "../../src/worker/six-screen-workflow-runtime";

const eventId = "identity-policy-review-fixture";
const identityFingerprint = fingerprintSixScreenValue({ eventId });
const t0 = "2026-09-12T12:00:00.000Z";

function at(second: number) {
  return `2026-09-12T12:00:${String(second).padStart(2, "0")}.000Z`;
}

function collection(): EvidenceCollection {
  const source = (index: number) => ({
    id: `source-${index}`,
    provider: `official-fixture-${index}`,
    nativeId: `record-${index}`,
    canonicalUrl: `https://example.gov/policy/${index}`,
    publisher: `Official publisher ${index}`,
    issuer: "Example Commission",
    author: null,
    jurisdiction: "United States",
    role: index === 1
      ? "controlling legal text"
      : "official implementation record",
    documentType: "final rule",
    language: "en",
    publicationDate: index === 1 ? "2020-01-02" : null,
    legalVersionDates: [],
    retrievedAt: t0,
    documentVersionId: `document-${index}`,
    contentHash: `sha256:${String(index).repeat(64)}`,
    acquisitionProvenance: "direct" as const,
    accessStatus: "retained_passage" as const,
    rightsStatus: "public-government-record",
    parserVersion: "fixture-v1",
    textQualityStatus: "usable",
    inspectedText: "full" as const,
  });
  const passage = (
    id: string,
    sourceId: string,
    exactText: string,
    qualification: string | null = null,
  ) => ({
    id,
    sourceId,
    documentVersionId: sourceId.replace("source", "document"),
    locator: `Section ${id}`,
    exactText,
    startOffset: null,
    endOffset: null,
    qualification,
    unresolvedCrossReferences: [],
  });
  return {
    sources: [source(1), source(2)],
    documentVersions: [1, 2].map((index) => ({
      id: `document-${index}`,
      sourceId: `source-${index}`,
      representation: "html",
      language: "en",
      versionLabel: `official version ${index}`,
      retrievedAt: t0,
      contentHash: `sha256:${String(index).repeat(64)}`,
      parserVersion: "fixture-v1",
      parsedTextLength: 500,
    })),
    passages: [
      passage(
        "passage-operative",
        "source-1",
        "Covered operators must establish a participation process.",
      ),
      passage(
        "passage-coverage",
        "source-1",
        "The requirement applies to operators serving the covered market.",
      ),
      passage(
        "passage-implementation",
        "source-1",
        "A filing is due within 270 days, followed by 365 days to implement.",
        "The passage states deadlines, not actual unit-level implementation.",
      ),
      passage(
        "passage-date-a",
        "source-1",
        "The rule takes legal effect on 2020-03-01.",
        "Another official record states a different date.",
      ),
      passage(
        "passage-date-b",
        "source-2",
        "The rule takes legal effect on 2020-04-01.",
        "The controlling date remains unresolved.",
      ),
    ],
    claims: [
      {
        id: "claim-operative",
        eventId,
        predicate: "operative_change",
        typedValue: { action: "establish_participation_process" },
        statement: "Covered operators must establish a participation process.",
        scope: "Covered market operators",
        supportingPassageIds: ["passage-operative"],
        opposingPassageIds: [],
        supportStatus: "direct",
        reviewStatus: "unreviewed",
        criticalFor: ["screen-2"],
      },
      {
        id: "claim-coverage",
        eventId,
        predicate: "coverage_condition",
        typedValue: { population: "covered market operators" },
        statement: "The requirement applies to operators serving the covered market.",
        scope: "Organizational coverage",
        supportingPassageIds: ["passage-coverage"],
        opposingPassageIds: [],
        supportStatus: "direct",
        reviewStatus: "unreviewed",
        criticalFor: ["screen-2"],
      },
      {
        id: "claim-implementation",
        eventId,
        predicate: "implementation_schedule",
        typedValue: {
          filingDeadlineDaysAfterPublication: 270,
          implementationWindowDaysAfterFilingDeadline: 365,
        },
        statement: "A filing is due within 270 days, followed by 365 days to implement.",
        scope: "Covered market operators",
        supportingPassageIds: ["passage-implementation"],
        opposingPassageIds: [],
        supportStatus: "direct",
        reviewStatus: "unreviewed",
        criticalFor: ["screen-2"],
      },
      {
        id: "claim-date-a",
        eventId,
        predicate: "legal_effect_date",
        typedValue: { date: "2020-03-01", stage: "legal_effect" },
        statement: "The rule takes legal effect on 2020-03-01.",
        scope: "Confirmed episode",
        supportingPassageIds: ["passage-date-a"],
        opposingPassageIds: ["passage-date-b"],
        supportStatus: "conflicting",
        reviewStatus: "unreviewed",
        criticalFor: ["screen-2-chronology"],
      },
      {
        id: "claim-date-b",
        eventId,
        predicate: "legal_effect_date",
        typedValue: { date: "2020-04-01", stage: "legal_effect" },
        statement: "The rule takes legal effect on 2020-04-01.",
        scope: "Confirmed episode",
        supportingPassageIds: ["passage-date-b"],
        opposingPassageIds: ["passage-date-a"],
        supportStatus: "conflicting",
        reviewStatus: "unreviewed",
        criticalFor: ["screen-2-chronology"],
      },
    ],
    conflicts: [{
      id: "conflict-legal-effect",
      eventId,
      predicate: "legal_effect_date",
      claimIds: ["claim-date-a", "claim-date-b"],
      competingValues: [{ date: "2020-03-01" }, { date: "2020-04-01" }],
      scopes: ["Confirmed episode", "Confirmed episode"],
      sourceRoles: ["controlling legal text", "official implementation record"],
      kind: "substantive",
      resolution: null,
      reviewStatus: "unreviewed",
    }],
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
        description: "Resolve the legal-effective date conflict.",
        status: "conflicting",
        criticality: "critical",
        supportingClaimIds: ["claim-date-a", "claim-date-b"],
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

function projection(input: {
  snapshotId?: string;
  snapshotRevision?: number;
  snapshotCreatedAt?: string;
  evidence?: EvidenceCollection;
  identityFingerprint?: string;
} = {}) {
  const evidence = input.evidence ?? collection();
  const snapshot = createEvidenceSnapshot({
    id: input.snapshotId ?? "evidence-policy-r1",
    revision: input.snapshotRevision ?? 1,
    eventId,
    createdAt: input.snapshotCreatedAt ?? at(1),
    collection: evidence,
  });
  return createPolicyChronologySourcePanel({
    identityFingerprint: input.identityFingerprint ?? identityFingerprint,
    snapshot,
    collection: evidence,
  });
}

function workflowReadyForReview(
  runId = "workflow-event-card-review",
) {
  let state = createSixScreenWorkflow({
    runId,
    studyId: "study-event-card-review",
    study: {
      population: "Covered market operators",
      analysisUnit: "Operator",
      geography: ["United States"],
      industry: ["Energy"],
      period: { start: "2019", end: "2023" },
      outcome: "Market participation",
      intendedConstruct: "Policy-induced participation",
      initialExplanation: null,
      proposedTreatment: null,
      proposedComparison: null,
      resultsPreviouslyInspected: "no",
    },
    shockInput: "Example participation rule",
    requestedJurisdiction: "United States",
    approximateYear: "2020",
    intendedEpisode: "final rule",
    createdAt: t0,
  });
  const identitySources = [{
    id: "identity-source-review",
    title: "Example Participation Rule",
    locator: "https://www.federalregister.gov/documents/2020/01/02/2020-12345/example",
    publisher: "Federal Register",
    publishedDate: "2020-01-02",
    authorityTier: "primary",
    retrievedAt: at(1),
  }];
  const started = beginIdentityResolution(state, {
    expectedRevision: 0,
    requestId: "identity-request-event-card",
    requestedAt: at(1),
  });
  state = applyIdentityResolution(started.state, {
    expectedRevision: 1,
    request: started.request,
    candidates: [{
      id: eventId,
      officialTitle: "Example Participation Rule",
      aliases: ["Participation rule"],
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
        passageIds: ["identity-passage-review"],
      }],
      identitySourceIds: ["identity-source-review"],
      sourceSnapshotId: "identity-snapshot-review",
      sourceSnapshotFingerprint: fingerprintSixScreenValue(identitySources),
      identitySources,
      displayedDescription:
        "The official record identifies the requested final-rule episode; operative details remain for Screen 2.",
      matchExplanation: "Title, issuer, identifier, and episode align.",
      materialMismatches: [],
      retrievedAt: at(1),
    }],
    appliedAt: at(2),
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
    interactionId: "identity-confirm-interaction",
    decisionId: "identity-confirm-decision",
    actor: "researcher_ui",
    confirmedAt: at(3),
  });
  state = openScreen2(state, {
    expectedRevision: 3,
    openedAt: at(4),
  }).state;
  const currentProjection = projection({
    identityFingerprint: candidate.identityFingerprint,
  });
  let plan = createFederalRegisterPolicyEvidencePlan({
    id: "policy-plan-event-card",
    identityFingerprint: candidate.identityFingerprint,
    documentNumber: "2020-12345",
    createdAt: at(4),
  });
  plan = recordPolicyEvidencePlanAttempt(plan, {
    stepId: plan.steps[0]!.id,
    outcome: "searched",
    attemptedAt: at(5),
    failureCode: null,
    note: "The exact official representation was retained.",
  });
  const evidence = collection();
  const requirementStatus = new Map(
    evidence.requirements.map(({ kind, status }) => [kind, status]),
  );
  const requirements = unsearchedFederalRegisterPolicyRequirements(
    "2020-12345",
  ).map(({ kind, description, status, criticality }) => ({
    kind: kind as PolicyReview["requirements"][number]["kind"],
    description,
    status: requirementStatus.get(kind) ?? status,
    criticality,
  }));
  const claims = projectPolicyEvidenceClaims(evidence);
  const policyReview: PolicyReview = {
    protocolVersion: "screen-02-federal-register-policy-v2",
    taskId: "policy-task-event-card",
    status: "partial",
    failureCode: null,
    documentNumber: "2020-12345",
    identityFingerprint: candidate.identityFingerprint,
    evidenceSnapshotId: currentProjection.binding.evidenceSnapshotId,
    evidenceSnapshotFingerprint:
      currentProjection.binding.evidenceSnapshotFingerprint,
    artifactStatus: "current",
    sourceCount: evidence.sources.length,
    passageCount: evidence.passages.length,
    claimCount: claims.length,
    claims,
    plan,
    progress: {
      searchedSteps: 1,
      totalSteps: plan.steps.length,
      retainedDocuments: evidence.documentVersions.length,
      chargedDocumentAttempts: 1,
      interruptedOperations: 0,
      receivedBytes: 1_000,
      activeResearchMs: 100,
      continuationMode: "panel_driven",
    },
    requirements,
    attemptedSources: [evidence.sources[0]!.canonicalUrl],
    unresolved: requirements
      .filter(({ status }) => status !== "supported" && status !== "not_applicable")
      .map(({ kind }) => kind),
    limitation: "The conflicting date and missing exemption remain explicit.",
    researchedAt: at(5),
    invalidatedAt: null,
    invalidationReason: null,
  };
  state = applyPolicyReview(state, {
    expectedRevision: 4,
    review: policyReview,
    appliedAt: at(5),
  });
  return { state, projection: currentProjection };
}

const variedDecisions: PolicyClaimReviewDecision[] = [
  "accepted",
  "provisional",
  "corrected",
  "rejected",
  "needs_more_evidence",
];

function decideEveryClaim(input: {
  review: PolicyEventCardReviewState;
  projection: ReturnType<typeof projection>;
  decisions?: PolicyClaimReviewDecision[];
  startSecond?: number;
}) {
  let review = input.review;
  const decisions = input.decisions ?? input.review.claimReviews.map(() => "accepted");
  input.review.claimReviews.forEach((claim, index) => {
    const decision = decisions[index] as Exclude<
      PolicyClaimReviewDecision,
      "unreviewed"
    >;
    review = reviewPolicyEventCardClaim({
      review,
      projection: input.projection,
      expectedRevision: review.revision,
      expectedReviewFingerprint: review.reviewFingerprint,
      actionId: `claim-action-${input.startSecond ?? 2}-${index}`,
      claimId: claim.claimId,
      decision,
      ...(decision === "corrected"
        ? { correctedStatement: `${claim.sourceStatement} Researcher correction.` }
        : {}),
      rationale: `Researcher rationale for ${claim.claimId}.`,
      actor: "researcher_ui",
      decidedAt: at((input.startSecond ?? 2) + index),
    });
  });
  return review;
}

describe("researcher-owned Policy Event Card review", () => {
  it("starts with exact immutable bindings and no inferred claim or clock decision", () => {
    const currentProjection = projection();
    const review = createPolicyEventCardReview({
      reviewId: "policy-event-card-review-1",
      projection: currentProjection,
      createdAt: at(2),
    });

    expect(review).toMatchObject({
      revision: 0,
      status: "in_review",
      binding: {
        eventId,
        identityFingerprint,
        evidenceSnapshotId: "evidence-policy-r1",
        projectionFingerprint: currentProjection.projectionFingerprint,
      },
      treatmentClockDecision: { mode: "unreviewed", candidateId: null },
      changeHistory: [],
      lockedEventCard: null,
    });
    expect(review.claimReviews).toHaveLength(5);
    expect(review.claimReviews.every(({ decision }) => decision === "unreviewed"))
      .toBe(true);
    expect(review.claimReviews.every(({ lineages }) => lineages.length >= 1))
      .toBe(true);
    expect(validatePolicyEventCardReview({
      review,
      projection: currentProjection,
    })).toBe(review);

    expect(() => lockPolicyEventCardReview({
      review,
      projection: currentProjection,
      expectedRevision: 0,
      expectedReviewFingerprint: review.reviewFingerprint,
      actionId: "lock-too-soon",
      eventCardSnapshotId: "event-card-too-soon",
      rationale: "Attempted before explicit decisions.",
      actor: "researcher_ui",
      lockedAt: at(3),
    })).toThrow(/explicit treatment-clock or no-selection/u);
    expect(() => reviewPolicyEventCardClaim({
      review,
      projection: currentProjection,
      expectedRevision: 0,
      expectedReviewFingerprint: review.reviewFingerprint,
      actionId: "model-decision",
      claimId: review.claimReviews[0]!.claimId,
      decision: "accepted",
      rationale: "Model attempt must not become authoritative.",
      actor: "model",
      decidedAt: at(3),
    })).toThrow(/Only an explicit researcher UI action/u);
  });

  it("keeps claim revisions append-only, idempotent, and visibly user-supplied", () => {
    const currentProjection = projection();
    const initial = createPolicyEventCardReview({
      reviewId: "policy-event-card-review-history",
      projection: currentProjection,
      createdAt: at(2),
    });
    const claim = initial.claimReviews[0]!;
    const first = reviewPolicyEventCardClaim({
      review: initial,
      projection: currentProjection,
      expectedRevision: 0,
      expectedReviewFingerprint: initial.reviewFingerprint,
      actionId: "claim-history-action",
      claimId: claim.claimId,
      decision: "provisional",
      rationale: "Coverage remains uncertain for the proposed sample.",
      actor: "researcher_ui",
      decidedAt: at(3),
    });
    const replay = reviewPolicyEventCardClaim({
      review: first,
      projection: currentProjection,
      expectedRevision: 0,
      expectedReviewFingerprint: initial.reviewFingerprint,
      actionId: "claim-history-action",
      claimId: claim.claimId,
      decision: "provisional",
      rationale: "Coverage remains uncertain for the proposed sample.",
      actor: "researcher_ui",
      decidedAt: at(9),
    });
    expect(replay).toBe(first);

    const corrected = reviewPolicyEventCardClaim({
      review: first,
      projection: currentProjection,
      expectedRevision: first.revision,
      expectedReviewFingerprint: first.reviewFingerprint,
      actionId: "claim-history-correction",
      claimId: claim.claimId,
      decision: "corrected",
      correctedStatement:
        "The researcher describes the relevant duty as a sample-specific participation process.",
      rationale: "This sample-specific wording is not established by the cited provision.",
      actor: "researcher_ui",
      decidedAt: at(4),
    });
    const current = corrected.claimReviews.find(
      ({ claimId }) => claimId === claim.claimId,
    )!;
    expect(current).toMatchObject({
      decision: "corrected",
      statementOrigin: "researcher_supplied",
      supportStatus: claim.supportStatus,
      sourceTypedValue: claim.sourceTypedValue,
      effectiveTypedValue: null,
    });
    expect(corrected.changeHistory).toEqual([
      expect.objectContaining({
        kind: "claim_decision",
        previous: expect.objectContaining({ decision: "unreviewed" }),
        next: expect.objectContaining({ decision: "provisional" }),
      }),
      expect.objectContaining({
        kind: "claim_decision",
        previous: expect.objectContaining({ decision: "provisional" }),
        next: expect.objectContaining({
          decision: "corrected",
          statementOrigin: "researcher_supplied",
        }),
        summary: expect.stringContaining("explicitly researcher-supplied"),
      }),
    ]);
    expect(() => reviewPolicyEventCardClaim({
      review: corrected,
      projection: currentProjection,
      expectedRevision: corrected.revision,
      expectedReviewFingerprint: corrected.reviewFingerprint,
      actionId: "claim-history-action",
      claimId: claim.claimId,
      decision: "rejected",
      rationale: "Different payload under a used action id.",
      actor: "researcher_ui",
      decidedAt: at(5),
    })).toThrow(/reused for a different decision/u);
  });

  it("refuses unbounded correction history before it can inflate workflow persistence", () => {
    const currentProjection = projection();
    let review = createPolicyEventCardReview({
      reviewId: "policy-event-card-review-capacity",
      projection: currentProjection,
      createdAt: at(2),
    });
    const claim = review.claimReviews[0]!;
    expect(() => {
      for (let index = 0; index < 100; index += 1) {
        const corrected = index % 2 === 0;
        review = reviewPolicyEventCardClaim({
          review,
          projection: currentProjection,
          expectedRevision: review.revision,
          expectedReviewFingerprint: review.reviewFingerprint,
          actionId: `capacity-decision-${index}`,
          claimId: claim.claimId,
          decision: corrected ? "corrected" : "provisional",
          ...(corrected
            ? { correctedStatement: `Researcher assertion ${"R".repeat(3_900)}` }
            : {}),
          rationale: "Exercise the bounded append-only persistence contract.",
          actor: "researcher_ui",
          decidedAt: at(5),
        });
      }
    }).toThrow(/exceeds its bounded persistence capacity/u);
    expect(review.changeHistory.length).toBeLessThan(256);
  });

  it("locks an explicit partial review while preserving unreviewed claims as limitations", () => {
    const currentProjection = projection();
    let review = createPolicyEventCardReview({
      reviewId: "policy-event-card-review-unreviewed-partial",
      projection: currentProjection,
      createdAt: at(2),
    });
    review = decidePolicyTreatmentClock({
      review,
      projection: currentProjection,
      expectedRevision: review.revision,
      expectedReviewFingerprint: review.reviewFingerprint,
      actionId: "clock-explicitly-none-unreviewed-partial",
      decision: { mode: "no_selection" },
      rationale: "The current evidence does not establish a defensible study treatment clock.",
      actor: "researcher_ui",
      decidedAt: at(3),
    });

    const locked = lockPolicyEventCardReview({
      review,
      projection: currentProjection,
      expectedRevision: review.revision,
      expectedReviewFingerprint: review.reviewFingerprint,
      actionId: "lock-unreviewed-partial-card",
      eventCardSnapshotId: "event-card-unreviewed-partial",
      rationale: "Continue with every unreviewed claim visible as a limitation.",
      actor: "researcher_ui",
      lockedAt: at(4),
    });

    expect(locked.lockedEventCard!.claims.every(({ decision }) =>
      decision === "unreviewed"
    )).toBe(true);
    expect(locked.lockedEventCard!.limitations).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "unreviewed_claim" }),
      expect.objectContaining({ code: "no_treatment_clock" }),
    ]));
    expect(validatePolicyEventCardReview({
      review: locked,
      projection: currentProjection,
    })).toBe(locked);
  });

  it("locks a useful partial card only after explicit no-selection and preserves conflicts", () => {
    const currentProjection = projection();
    let review = createPolicyEventCardReview({
      reviewId: "policy-event-card-review-partial",
      projection: currentProjection,
      createdAt: at(2),
    });
    review = decideEveryClaim({
      review,
      projection: currentProjection,
      decisions: variedDecisions,
      startSecond: 3,
    });
    expect(() => lockPolicyEventCardReview({
      review,
      projection: currentProjection,
      expectedRevision: review.revision,
      expectedReviewFingerprint: review.reviewFingerprint,
      actionId: "lock-without-clock-decision",
      eventCardSnapshotId: "event-card-partial",
      rationale: "Claims are reviewed but timing remains undecided.",
      actor: "researcher_ui",
      lockedAt: at(9),
    })).toThrow(/explicit treatment-clock or no-selection/u);

    review = decidePolicyTreatmentClock({
      review,
      projection: currentProjection,
      expectedRevision: review.revision,
      expectedReviewFingerprint: review.reviewFingerprint,
      actionId: "clock-explicitly-none",
      decision: { mode: "no_selection" },
      rationale: "No available legal stage is yet a defensible unit-level treatment clock.",
      actor: "researcher_ui",
      decidedAt: at(9),
    });
    const locked = lockPolicyEventCardReview({
      review,
      projection: currentProjection,
      expectedRevision: review.revision,
      expectedReviewFingerprint: review.reviewFingerprint,
      actionId: "lock-partial-card",
      eventCardSnapshotId: "event-card-partial",
      rationale: "Continue conditionally with every unresolved premise visible.",
      actor: "researcher_ui",
      lockedAt: at(10),
    });

    expect(locked.lockedEventCard).toMatchObject({
      snapshotId: "event-card-partial",
      binding: {
        evidenceSnapshotId: "evidence-policy-r1",
        evidenceSnapshotFingerprint:
          currentProjection.binding.evidenceSnapshotFingerprint,
      },
      treatmentClock: { mode: "no_selection", candidate: null },
      conflicts: [{ id: "conflict-legal-effect", resolution: null }],
      semanticReview: {
        coherentOverview: null,
        consequentialSemanticReview: null,
        status: "blocked",
        reason: "genuine_intelligence_path_unverified",
      },
    });
    expect(locked.lockedEventCard!.limitations.map(({ code }) => code)).toEqual([
      "provisional_claim",
      "rejected_claim",
      "needs_more_evidence",
      "researcher_supplied_correction",
      "unresolved_requirement",
      "unresolved_conflict",
      "no_treatment_clock",
    ]);
    expect(locked.changeHistory).toHaveLength(7);

    const restored = JSON.parse(JSON.stringify(locked)) as
      PolicyEventCardReviewState;
    expect(validatePolicyEventCardReview({
      review: restored,
      projection: currentProjection,
    })).toBe(restored);
    expect(() => reviewPolicyEventCardClaim({
      review: restored,
      projection: currentProjection,
      expectedRevision: restored.revision,
      expectedReviewFingerprint: restored.reviewFingerprint,
      actionId: "edit-after-lock",
      claimId: restored.claimReviews[0]!.claimId,
      decision: "accepted",
      rationale: "A locked card must remain immutable.",
      actor: "researcher_ui",
      decidedAt: at(11),
    })).toThrow(/locked .* immutable/u);
  });

  it("requires reviewed clock premises and never erases an underlying date conflict", () => {
    const currentProjection = projection();
    let review = createPolicyEventCardReview({
      reviewId: "policy-event-card-review-clock",
      projection: currentProjection,
      createdAt: at(2),
    });
    const dateClock = currentProjection.chronology.absoluteClocks.find(
      (clock) => clock.statements.some(
        ({ claimId }) => claimId === "claim-date-a",
      ),
    )!;
    const candidate = currentProjection.treatmentClockReview.candidates.find(
      ({ clockId }) => clockId === dateClock.id,
    )!;
    expect(() => decidePolicyTreatmentClock({
      review,
      projection: currentProjection,
      expectedRevision: 0,
      expectedReviewFingerprint: review.reviewFingerprint,
      actionId: "select-before-review",
      decision: { mode: "selected", candidateId: candidate.id },
      rationale: "Premise has not yet been reviewed.",
      actor: "researcher_ui",
      decidedAt: at(3),
    })).toThrow(/requires its consequential claims to be reviewed first/u);

    const decisions = review.claimReviews.map(({ claimId }) =>
      claimId === "claim-date-b" ? "rejected" : "accepted"
    ) as PolicyClaimReviewDecision[];
    review = decideEveryClaim({
      review,
      projection: currentProjection,
      decisions,
      startSecond: 3,
    });
    review = decidePolicyTreatmentClock({
      review,
      projection: currentProjection,
      expectedRevision: review.revision,
      expectedReviewFingerprint: review.reviewFingerprint,
      actionId: "select-conflicting-clock",
      decision: { mode: "selected", candidateId: candidate.id },
      rationale: "Use the controlling-text date provisionally while retaining the conflict.",
      actor: "researcher_ui",
      decidedAt: at(9),
    });
    review = reviewPolicyEventCardClaim({
      review,
      projection: currentProjection,
      expectedRevision: review.revision,
      expectedReviewFingerprint: review.reviewFingerprint,
      actionId: "reject-selected-clock-premise",
      claimId: "claim-date-a",
      decision: "rejected",
      rationale: "Temporarily reject the only premise for the selected date.",
      actor: "researcher_ui",
      decidedAt: at(10),
    });
    expect(validatePolicyEventCardReview({
      review,
      projection: currentProjection,
    })).toBe(review);
    expect(() => lockPolicyEventCardReview({
      review,
      projection: currentProjection,
      expectedRevision: review.revision,
      expectedReviewFingerprint: review.reviewFingerprint,
      actionId: "lock-rejected-clock-premise",
      eventCardSnapshotId: "event-card-rejected-clock-premise",
      rationale: "This selected clock has no usable reviewed premise.",
      actor: "researcher_ui",
      lockedAt: at(11),
    })).toThrow(/cannot rely only on rejected or unresolved claims/u);
    review = reviewPolicyEventCardClaim({
      review,
      projection: currentProjection,
      expectedRevision: review.revision,
      expectedReviewFingerprint: review.reviewFingerprint,
      actionId: "restore-selected-clock-premise",
      claimId: "claim-date-a",
      decision: "accepted",
      rationale: "Accept this account for conditional use without resolving the conflict.",
      actor: "researcher_ui",
      decidedAt: at(11),
    });
    const locked = lockPolicyEventCardReview({
      review,
      projection: currentProjection,
      expectedRevision: review.revision,
      expectedReviewFingerprint: review.reviewFingerprint,
      actionId: "lock-selected-clock",
      eventCardSnapshotId: "event-card-selected-clock",
      rationale: "The explicit selection does not resolve the competing record.",
      actor: "researcher_ui",
      lockedAt: at(12),
    });
    expect(locked.lockedEventCard!.treatmentClock).toMatchObject({
      mode: "selected",
      candidate: { id: candidate.id, selected: true, status: "selected" },
    });
    expect(candidate).toMatchObject({ selected: false, status: "unreviewed" });
    expect(locked.lockedEventCard!.limitations).toContainEqual(
      expect.objectContaining({
        code: "unresolved_conflict",
        relatedIds: ["conflict-legal-effect"],
      }),
    );
  });

  it("distinguishes proposed evidence review from a genuinely superseded locked card", () => {
    const firstProjection = projection();
    let firstReview = createPolicyEventCardReview({
      reviewId: "policy-event-card-review-r1",
      projection: firstProjection,
      createdAt: at(2),
    });
    firstReview = decideEveryClaim({
      review: firstReview,
      projection: firstProjection,
      startSecond: 3,
    });
    firstReview = decidePolicyTreatmentClock({
      review: firstReview,
      projection: firstProjection,
      expectedRevision: firstReview.revision,
      expectedReviewFingerprint: firstReview.reviewFingerprint,
      actionId: "clock-r1-none",
      decision: { mode: "no_selection" },
      rationale: "No treatment clock is selected in revision one.",
      actor: "researcher_ui",
      decidedAt: at(9),
    });
    firstReview = lockPolicyEventCardReview({
      review: firstReview,
      projection: firstProjection,
      expectedRevision: firstReview.revision,
      expectedReviewFingerprint: firstReview.reviewFingerprint,
      actionId: "lock-r1",
      eventCardSnapshotId: "event-card-r1",
      rationale: "Lock revision one with explicit limitations.",
      actor: "researcher_ui",
      lockedAt: at(10),
    });
    const reference = createPolicyEventCardReference({ review: firstReview });
    expect(assessPolicyEventCardReference({
      reference,
      currentProjection: firstProjection,
      currentReview: firstReview,
    })).toEqual({
      status: "current",
      changes: [],
      proposedReviewId: null,
      currentEventCardSnapshotId: "event-card-r1",
    });

    const differentIdentityProjection = projection({
      identityFingerprint: fingerprintSixScreenValue("different identity"),
    });
    expect(() => createPolicyEventCardReviewRevision({
      previousReview: firstReview,
      reviewId: "policy-event-card-review-wrong-identity",
      projection: differentIdentityProjection,
      reason: "This must return to Screen 1 instead of changing identity in place.",
      createdAt: at(11),
    })).toThrow(/different controlling identity .* Screen 1/u);

    const secondProjection = projection({
      snapshotId: "evidence-policy-r2",
      snapshotRevision: 2,
      snapshotCreatedAt: at(11),
    });
    let secondReview = createPolicyEventCardReviewRevision({
      previousReview: firstReview,
      reviewId: "policy-event-card-review-r2",
      projection: secondProjection,
      reason: "A new immutable evidence revision is available for review.",
      createdAt: at(12),
    });
    const pending = assessPolicyEventCardReference({
      reference,
      currentProjection: secondProjection,
      currentReview: secondReview,
    });
    expect(pending).toMatchObject({
      status: "review_required",
      proposedReviewId: "policy-event-card-review-r2",
      currentEventCardSnapshotId: null,
      changes: expect.arrayContaining([
        "evidence_snapshot_changed",
        "evidence_snapshot_revision_changed",
        "evidence_snapshot_fingerprint_changed",
        "projection_changed",
      ]),
    });
    expect(firstReview.lockedEventCard!.binding).toEqual(reference.binding);

    secondReview = decideEveryClaim({
      review: secondReview,
      projection: secondProjection,
      startSecond: 13,
    });
    secondReview = decidePolicyTreatmentClock({
      review: secondReview,
      projection: secondProjection,
      expectedRevision: secondReview.revision,
      expectedReviewFingerprint: secondReview.reviewFingerprint,
      actionId: "clock-r2-none",
      decision: { mode: "no_selection" },
      rationale: "No treatment clock is selected in revision two.",
      actor: "researcher_ui",
      decidedAt: at(19),
    });
    secondReview = lockPolicyEventCardReview({
      review: secondReview,
      projection: secondProjection,
      expectedRevision: secondReview.revision,
      expectedReviewFingerprint: secondReview.reviewFingerprint,
      actionId: "lock-r2",
      eventCardSnapshotId: "event-card-r2",
      rationale: "Lock the reviewed second evidence revision.",
      actor: "researcher_ui",
      lockedAt: at(20),
    });
    expect(assessPolicyEventCardReference({
      reference,
      currentProjection: secondProjection,
      currentReview: secondReview,
    })).toMatchObject({
      status: "superseded",
      currentEventCardSnapshotId: "event-card-r2",
      changes: expect.arrayContaining(["event_card_review_changed"]),
    });
    expect(firstReview.lockedEventCard!.binding.evidenceSnapshotId).toBe(
      "evidence-policy-r1",
    );
  });

  it("commits review decisions and the locked card through canonical workflow revisions", () => {
    const ready = workflowReadyForReview();
    let state = ready.state;
    delete state.policyEventCardReviews;
    const wrongProjection = projection({
      snapshotId: "evidence-policy-wrong",
      identityFingerprint: state.confirmedShock!.identityFingerprint,
    });
    expect(() => beginPolicyEventCardReview(state, {
      expectedRevision: state.revision,
      reviewId: "workflow-review-wrong-evidence",
      projection: wrongProjection,
      startedAt: at(6),
    })).toThrow(/does not match .* current confirmed shock and evidence snapshot/u);

    let begun = beginPolicyEventCardReview(state, {
      expectedRevision: state.revision,
      reviewId: "workflow-policy-event-card-review",
      projection: ready.projection,
      startedAt: at(6),
    });
    state = begun.state;
    let review = begun.review;
    expect(state.policyEventCardReviews).toEqual([review]);
    expect(state.changeLog.at(-1)?.summary).toMatch(/no inferred claim or treatment-clock decisions/u);

    for (const [index, claim] of review.claimReviews.entries()) {
      const applied = applyPolicyEventCardClaimDecision(state, {
        expectedRevision: state.revision,
        reviewId: review.id,
        projection: ready.projection,
        expectedReviewRevision: review.revision,
        expectedReviewFingerprint: review.reviewFingerprint,
        actionId: `workflow-claim-decision-${index}`,
        claimId: claim.claimId,
        decision: "accepted",
        rationale: `Accept ${claim.claimId} while preserving its source status.`,
        actor: "researcher_ui",
        decidedAt: at(7 + index),
      });
      state = applied.state;
      review = applied.review;
    }
    const clock = applyPolicyTreatmentClockDecision(state, {
      expectedRevision: state.revision,
      reviewId: review.id,
      projection: ready.projection,
      expectedReviewRevision: review.revision,
      expectedReviewFingerprint: review.reviewFingerprint,
      actionId: "workflow-clock-none",
      decision: { mode: "no_selection" },
      rationale: "Do not infer a sample treatment date from legal-stage clocks.",
      actor: "researcher_ui",
      decidedAt: at(13),
    });
    state = clock.state;
    review = clock.review;
    const locked = lockReviewedPolicyEventCard(state, {
      expectedRevision: state.revision,
      reviewId: review.id,
      projection: ready.projection,
      expectedReviewRevision: review.revision,
      expectedReviewFingerprint: review.reviewFingerprint,
      actionId: "workflow-lock-event-card",
      eventCardSnapshotId: "workflow-event-card-snapshot-1",
      rationale: "Lock the reviewed partial card for conditional downstream use.",
      actor: "researcher_ui",
      lockedAt: at(14),
    });
    state = locked.state;

    expect(state.policyEventCardReviews?.at(-1)).toEqual(locked.review);
    expect(locked.eventCard.binding).toMatchObject({
      identityFingerprint: state.confirmedShock!.identityFingerprint,
      evidenceSnapshotId: state.policyReview!.evidenceSnapshotId,
      evidenceSnapshotFingerprint:
        state.policyReview!.evidenceSnapshotFingerprint,
    });
    expect(state.artifacts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        snapshotId: "workflow-event-card-snapshot-1",
        screen: 2,
        status: "current",
      }),
    ]));
    expect(state.changeLog.at(-1)?.summary).toContain(
      "Researcher locked Event Card workflow-event-card-snapshot-1",
    );
  });

  it("persists partial and rejected decisions across a fresh workflow-store instance", async () => {
    const runId = `sa6r_${"A".repeat(43)}`;
    const accessToken = `sa6a_${"B".repeat(43)}`;
    const ready = workflowReadyForReview(runId);
    let state = ready.state;
    let begun = beginPolicyEventCardReview(state, {
      expectedRevision: state.revision,
      reviewId: "policy-event-card-review-persisted",
      projection: ready.projection,
      startedAt: at(6),
    });
    state = begun.state;
    let review = begun.review;
    for (const [index, decision] of (["rejected", "corrected"] as const).entries()) {
      const claim = review.claimReviews[index]!;
      const applied = applyPolicyEventCardClaimDecision(state, {
        expectedRevision: state.revision,
        reviewId: review.id,
        projection: ready.projection,
        expectedReviewRevision: review.revision,
        expectedReviewFingerprint: review.reviewFingerprint,
        actionId: `persisted-decision-${index}`,
        claimId: claim.claimId,
        decision,
        ...(decision === "corrected"
          ? { correctedStatement: `${claim.sourceStatement} User clarification.` }
          : {}),
        rationale: `Persist ${decision} state without changing evidence.`,
        actor: "researcher_ui",
        decidedAt: at(7 + index),
      });
      state = applied.state;
      review = applied.review;
    }
    const storage = new InMemorySixScreenWorkflowStorage();
    const firstStore = new SixScreenWorkflowStore(storage);
    await firstStore.create({
      state,
      accessToken,
      createInputFingerprint: fingerprintSixScreenValue("persistence-create"),
      createdAt: t0,
      expiresAt: "2026-09-13T12:00:00.000Z",
    });

    const restored = await new SixScreenWorkflowStore(storage).read({
      runId,
      accessToken,
    });
    expect(restored.outcome).toBe("found");
    if (restored.outcome !== "found") throw new Error("Expected saved review.");
    const restoredReview = restored.record.state.policyEventCardReviews![0]!;
    expect(restoredReview.claimReviews.slice(0, 2).map(({ decision }) => decision))
      .toEqual(["rejected", "corrected"]);
    expect(restoredReview.changeHistory).toHaveLength(2);
    expect(validatePolicyEventCardReview({
      review: restoredReview,
      projection: ready.projection,
    })).toBe(restoredReview);

    const remainingClaim = restoredReview.claimReviews[2]!;
    const resumedStore = new SixScreenWorkflowStore(storage);
    const mutation = await resumedStore.mutate({
      runId,
      accessToken,
      expectedRevision: restored.record.state.revision,
      operationId: "decision-after-restart-operation",
      operationKind: "review_policy_event_card_claim",
      inputFingerprint: fingerprintSixScreenValue({
        claimId: remainingClaim.claimId,
        decision: "provisional",
      }),
      updatedAt: at(10),
    }, (storedState) => {
      const active = storedState.policyEventCardReviews!.at(-1)!;
      const applied = applyPolicyEventCardClaimDecision(storedState, {
        expectedRevision: storedState.revision,
        reviewId: active.id,
        projection: ready.projection,
        expectedReviewRevision: active.revision,
        expectedReviewFingerprint: active.reviewFingerprint,
        actionId: "decision-after-restart",
        claimId: remainingClaim.claimId,
        decision: "provisional",
        rationale: "Continue the same append-only review after restart.",
        actor: "researcher_ui",
        decidedAt: at(10),
      });
      return { state: applied.state, result: applied.review };
    });
    expect(mutation.outcome).toBe("updated");
    if (mutation.outcome !== "updated") throw new Error("Expected mutation.");
    const continued = mutation.record.state.policyEventCardReviews!.at(-1)!;
    expect(continued.changeHistory.map(({ id }) => id)).toEqual([
      "persisted-decision-0",
      "persisted-decision-1",
      "decision-after-restart",
    ]);
    const secondRestart = await new SixScreenWorkflowStore(storage).read({
      runId,
      accessToken,
    });
    expect(secondRestart.outcome).toBe("found");
    if (secondRestart.outcome !== "found") throw new Error("Expected review.");
    expect(secondRestart.record.state.policyEventCardReviews!.at(-1))
      .toEqual(continued);

    const storedEntry = [...storage.values.entries()].find(([key]) =>
      key.startsWith("six-screen-workflow-v1:")
    )!;
    const tampered = structuredClone(storedEntry[1]) as {
      state: ReturnType<typeof createSixScreenWorkflow>;
      stateFingerprint: string;
    };
    tampered.state.policyEventCardReviews![0]!.claimReviews[0]!
      .effectiveStatement = "A silent persisted rewrite.";
    tampered.stateFingerprint = fingerprintSixScreenValue(tampered.state);
    storage.values.set(storedEntry[0], tampered);
    await expect(new SixScreenWorkflowStore(storage).read({
      runId,
      accessToken,
    })).rejects.toThrow(/Policy Event Card review fingerprint is invalid/u);
  });

  it("reconstructs immutable evidence server-side for authenticated runtime decisions and replay", async () => {
    const runId = `sa6r_${"r".repeat(43)}`;
    const accessToken = `sa6a_${"a".repeat(43)}`;
    const ready = workflowReadyForReview(runId);
    const evidence = collection();
    const snapshot = createEvidenceSnapshot({
      id: "evidence-policy-r1",
      revision: 1,
      eventId,
      createdAt: at(1),
      collection: evidence,
    });
    expect(snapshot.snapshotFingerprint).toBe(
      ready.projection.binding.evidenceSnapshotFingerprint,
    );
    const storage = new InMemorySixScreenWorkflowStorage();
    const store = new SixScreenWorkflowStore(storage);
    const evidenceStore = new SixScreenEvidenceStore(storage);
    await store.create({
      state: ready.state,
      accessToken,
      createInputFingerprint: fingerprintSixScreenValue("runtime-review-fixture"),
      createdAt: t0,
      expiresAt: "2026-09-13T12:00:00.000Z",
    });
    await evidenceStore.create({
      runId,
      accessToken,
      snapshot,
      collection: evidence,
      expiresAt: "2026-09-13T12:00:00.000Z",
    });
    const queuedTimes = Array.from({ length: 40 }, (_, index) =>
      new Date(Date.parse(at(6)) + index * 1_000).toISOString()
    );
    const runtime = new SixScreenWorkflowRuntime({
      store,
      evidenceStore,
      signingKey: "runtime-event-card-review-test-key-1234567890",
      now: () => queuedTimes.shift() ?? "2026-09-12T12:01:00.000Z",
      fetch: async () => new Response(null, { status: 503 }),
    });
    const authentication = { runId, accessToken };

    const status = await runtime.status(authentication);
    expect(status.projection.policyEventCardWorkspace).toMatchObject({
      availability: "ready",
      reviewStatus: "not_started",
      projection: {
        projectionFingerprint: ready.projection.projectionFingerprint,
        interpretationGate: {
          status: "blocked",
          reason: "genuine_intelligence_path_unverified",
        },
      },
    });

    const begun = await runtime.beginPolicyEventCardReview(authentication, {
      expectedRevision: ready.state.revision,
      operationId: "runtime-begin-review",
      revisionReason: null,
      // A JavaScript caller can add fields, but no client-authored projection is
      // read by the runtime or represented in the tool schema.
      projection: { projectionFingerprint: "fnv1a64:0000000000000000" },
    } as Parameters<typeof runtime.beginPolicyEventCardReview>[1] & {
      projection: { projectionFingerprint: string };
    });
    expect(begun.review.binding.projectionFingerprint).toBe(
      ready.projection.projectionFingerprint,
    );
    expect(begun.projection.policyEventCardWorkspace).toMatchObject({
      availability: "ready",
      reviewStatus: "in_review",
      activeReview: {
        revision: 0,
        treatmentClockDecision: { mode: "unreviewed" },
      },
    });

    let workflowRevision = begun.projection.revision;
    let review = begun.review;
    let firstDecisionInput: Parameters<
      typeof runtime.reviewPolicyEventCardClaim
    >[1] | null = null;
    for (const [index, claim] of review.claimReviews.entries()) {
      const decision = index === 0 ? "corrected" as const : "accepted" as const;
      const decisionInput = {
        expectedRevision: workflowRevision,
        operationId: `runtime-claim-${index}`,
        reviewId: review.id,
        expectedReviewRevision: review.revision,
        expectedReviewFingerprint: review.reviewFingerprint,
        claimId: claim.claimId,
        decision,
        ...(decision === "corrected"
          ? { correctedStatement: `${claim.sourceStatement} Researcher clarification.` }
          : {}),
        rationale: `Researcher checked consequential claim ${index + 1}.`,
      };
      if (index === 0) firstDecisionInput = decisionInput;
      const decided = await runtime.reviewPolicyEventCardClaim(
        authentication,
        decisionInput,
      );
      workflowRevision = decided.projection.revision;
      review = decided.review;
    }
    expect(review.claimReviews[0]).toMatchObject({
      decision: "corrected",
      statementOrigin: "researcher_supplied",
      effectiveTypedValue: null,
    });
    expect(review.claimReviews[0]!.sourceStatement).not.toBe(
      review.claimReviews[0]!.effectiveStatement,
    );

    const timed = await runtime.decidePolicyTreatmentClock(authentication, {
      expectedRevision: workflowRevision,
      operationId: "runtime-no-treatment-clock",
      reviewId: review.id,
      expectedReviewRevision: review.revision,
      expectedReviewFingerprint: review.reviewFingerprint,
      decision: { mode: "no_selection" },
      rationale: "The study treatment clock is not established by this evidence.",
    });
    workflowRevision = timed.projection.revision;
    review = timed.review;
    const locked = await runtime.lockPolicyEventCard(authentication, {
      expectedRevision: workflowRevision,
      operationId: "runtime-lock-event-card",
      reviewId: review.id,
      expectedReviewRevision: review.revision,
      expectedReviewFingerprint: review.reviewFingerprint,
      rationale: "Lock the explicit partial record without inventing a treatment date.",
    });
    expect(locked.projection.policyEventCardWorkspace).toMatchObject({
      availability: "ready",
      reviewStatus: "current",
      revisions: [{ status: "current" }],
      activeReview: {
        status: "locked",
        lockedEventCard: {
          treatmentClock: { mode: "no_selection" },
          semanticReview: {
            status: "blocked",
            reason: "genuine_intelligence_path_unverified",
          },
        },
      },
    });
    expect(locked.eventCard.claims[0]).toMatchObject({
      statementOrigin: "researcher_supplied",
      effectiveTypedValue: null,
    });

    const pendingRevision = await runtime.beginPolicyEventCardReview(
      authentication,
      {
        expectedRevision: locked.projection.revision,
        operationId: "runtime-begin-review-revision",
        revisionReason: "Recheck every decision while the first locked card remains preserved.",
      },
    );
    expect(pendingRevision.projection.policyEventCardWorkspace).toMatchObject({
      availability: "ready",
      reviewStatus: "pending_revision",
      revisions: [
        { ordinal: 1, status: "review_required" },
        { ordinal: 2, status: "pending_revision" },
      ],
    });
    expect(
      pendingRevision.privateSnapshot.state.policyEventCardReviews?.[0]
        ?.lockedEventCard?.eventCardFingerprint,
    ).toBe(locked.eventCard.eventCardFingerprint);

    workflowRevision = pendingRevision.projection.revision;
    review = pendingRevision.review;
    for (const [index, claim] of review.claimReviews.entries()) {
      const decided = await runtime.reviewPolicyEventCardClaim(authentication, {
        expectedRevision: workflowRevision,
        operationId: `runtime-revision-claim-${index}`,
        reviewId: review.id,
        expectedReviewRevision: review.revision,
        expectedReviewFingerprint: review.reviewFingerprint,
        claimId: claim.claimId,
        decision: "accepted",
        rationale: `Researcher rechecked revision-two claim ${index + 1}.`,
      });
      workflowRevision = decided.projection.revision;
      review = decided.review;
    }
    const revisedTiming = await runtime.decidePolicyTreatmentClock(
      authentication,
      {
        expectedRevision: workflowRevision,
        operationId: "runtime-revision-no-treatment-clock",
        reviewId: review.id,
        expectedReviewRevision: review.revision,
        expectedReviewFingerprint: review.reviewFingerprint,
        decision: { mode: "no_selection" },
        rationale: "Revision two still does not establish the study treatment clock.",
      },
    );
    const revisedLocked = await runtime.lockPolicyEventCard(authentication, {
      expectedRevision: revisedTiming.projection.revision,
      operationId: "runtime-lock-event-card-revision",
      reviewId: revisedTiming.review.id,
      expectedReviewRevision: revisedTiming.review.revision,
      expectedReviewFingerprint: revisedTiming.review.reviewFingerprint,
      rationale: "Lock revision two while retaining revision one's immutable history.",
    });
    expect(revisedLocked.projection.policyEventCardWorkspace).toMatchObject({
      availability: "ready",
      reviewStatus: "current",
      revisions: [
        { ordinal: 1, status: "superseded" },
        { ordinal: 2, status: "current" },
      ],
    });
    expect(revisedLocked.eventCard.eventCardFingerprint).not.toBe(
      locked.eventCard.eventCardFingerprint,
    );

    const replayed = await runtime.reviewPolicyEventCardClaim(
      authentication,
      firstDecisionInput!,
    );
    expect(replayed.replayed).toBe(true);
    expect(replayed.projection.revision).toBe(revisedLocked.projection.revision);
    expect(replayed.projection.policyEventCardWorkspace).toMatchObject({
      availability: "ready",
      reviewStatus: "current",
    });
  });
});
