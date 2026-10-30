import {
  fingerprintSixScreenValue,
  sameSixScreenValue,
} from "./canonical";
import {
  requireBoundedIdentifier,
  requireCanonicalInstant,
  requireFingerprint,
  type ConflictRecord,
  type ReviewStatus,
  type SupportStatus,
} from "./contracts";
import {
  SIX_SCREEN_POLICY_CHRONOLOGY_SCHEMA_VERSION,
  type PolicyChronologyClock,
  type PolicyChronologySourcePanelProjection,
  type PolicySourcePanelClaim,
  type PolicyTreatmentClockCandidate,
  type PolicyUnresolvedRequirement,
} from "./policy-chronology";
import {
  mergePolicyLifecycleStageContributionsIntoChronology,
  validatePolicyLifecycleStageEventCardContribution,
  type PolicyLifecycleStageEventCardContribution,
} from "./policy-lifecycle-stage-revision";

export const SIX_SCREEN_POLICY_EVENT_CARD_REVIEW_SCHEMA_VERSION =
  "screen-02-policy-event-card-review-v1" as const;
export const SIX_SCREEN_REVIEWED_EVENT_CARD_SCHEMA_VERSION =
  "screen-02-reviewed-event-card-v1" as const;
export const SIX_SCREEN_EVENT_CARD_REFERENCE_SCHEMA_VERSION =
  "screen-02-event-card-reference-v1" as const;

export const SIX_SCREEN_POLICY_EVENT_CARD_MAX_HISTORY = 256;
export const SIX_SCREEN_POLICY_EVENT_CARD_MAX_REVISIONS = 32;
export const SIX_SCREEN_POLICY_EVENT_CARD_MAX_LIFECYCLE_STAGE_REVISIONS = 32;
export const SIX_SCREEN_POLICY_EVENT_CARD_REVIEW_MAX_BYTES = 96_000;

export type PolicyEventCardBinding =
  PolicyChronologySourcePanelProjection["binding"] & {
    projectionFingerprint: string;
  };

export type PolicyClaimReviewDecision =
  | "unreviewed"
  | "accepted"
  | "provisional"
  | "rejected"
  | "needs_more_evidence"
  | "corrected";

export type PolicyEventCardClaimLineage = {
  direction: "supporting" | "opposing";
  passageId: string;
  documentVersionId: string;
  sourceId: string;
};

export type PolicyEventCardClaimReview = {
  claimId: string;
  claimProjectionFingerprint: string;
  predicate: string;
  sourceStatement: string;
  sourceTypedValue: unknown;
  scope: string;
  supportStatus: SupportStatus;
  sourceReviewStatus: ReviewStatus;
  criticalFor: string[];
  conflictIds: string[];
  lineages: PolicyEventCardClaimLineage[];
  decision: PolicyClaimReviewDecision;
  effectiveStatement: string;
  effectiveTypedValue: unknown | null;
  statementOrigin: "evidence_claim" | "researcher_supplied";
  rationale: string | null;
  decidedAt: string | null;
  decisionEventId: string | null;
};

export type PolicyTreatmentClockDecision =
  | {
      mode: "unreviewed";
      candidateId: null;
      rationale: null;
      decidedAt: null;
      decisionEventId: null;
    }
  | {
      mode: "selected";
      candidateId: string;
      rationale: string;
      decidedAt: string;
      decisionEventId: string;
    }
  | {
      mode: "no_selection";
      candidateId: null;
      rationale: string;
      decidedAt: string;
      decisionEventId: string;
    };

type ClaimDecisionSnapshot = Pick<
  PolicyEventCardClaimReview,
  | "decision"
  | "effectiveStatement"
  | "effectiveTypedValue"
  | "statementOrigin"
  | "rationale"
  | "decidedAt"
  | "decisionEventId"
>;

export type PolicyEventCardReviewHistoryEvent =
  | {
      id: string;
      revision: number;
      kind: "claim_decision";
      actor: "researcher";
      at: string;
      projectionFingerprint: string;
      operationFingerprint: string;
      claimId: string;
      previous: ClaimDecisionSnapshot;
      next: ClaimDecisionSnapshot;
      summary: string;
    }
  | {
      id: string;
      revision: number;
      kind: "treatment_clock_decision";
      actor: "researcher";
      at: string;
      projectionFingerprint: string;
      operationFingerprint: string;
      previous: PolicyTreatmentClockDecision;
      next: PolicyTreatmentClockDecision;
      summary: string;
    }
  | {
      id: string;
      revision: number;
      kind: "event_card_locked";
      actor: "researcher";
      at: string;
      projectionFingerprint: string;
      operationFingerprint: string;
      eventCardSnapshotId: string;
      eventCardFingerprint: string;
      lifecycleStageRevisionFingerprints?: string[];
      rationale: string;
      summary: string;
    };

export type PolicyReviewedEventCardLimitation = {
  code:
    | "unreviewed_claim"
    | "provisional_claim"
    | "rejected_claim"
    | "needs_more_evidence"
    | "researcher_supplied_correction"
    | "unresolved_requirement"
    | "unresolved_conflict"
    | "no_treatment_clock";
  relatedIds: string[];
  summary: string;
};

export type PolicySelectedTreatmentClock = Omit<
  PolicyTreatmentClockCandidate,
  "status" | "selected"
> & {
  status: "selected";
  selected: true;
};

export type PolicyReviewedEventCard = {
  schemaVersion: typeof SIX_SCREEN_REVIEWED_EVENT_CARD_SCHEMA_VERSION;
  snapshotId: string;
  reviewId: string;
  reviewSeriesId: string;
  reviewOrdinal: number;
  reviewRevision: number;
  binding: PolicyEventCardBinding;
  claims: PolicyEventCardClaimReview[];
  chronology: PolicyChronologySourcePanelProjection["chronology"];
  treatmentClock:
    | {
        mode: "selected";
        candidate: PolicySelectedTreatmentClock;
        rationale: string;
        decidedAt: string;
        decisionEventId: string;
      }
    | {
        mode: "no_selection";
        candidate: null;
        rationale: string;
        decidedAt: string;
        decisionEventId: string;
      };
  unresolvedRequirements: PolicyUnresolvedRequirement[];
  conflicts: ConflictRecord[];
  limitations: PolicyReviewedEventCardLimitation[];
  decisionHistoryFingerprint: string;
  reviewedAt: string;
  semanticReview: {
    coherentOverview: null;
    consequentialSemanticReview: null;
    status: "blocked";
    reason: "genuine_intelligence_path_unverified";
  };
  /** Optional so Event Cards locked before lifecycle-stage review remain readable. */
  lifecycleStageRevisions?: PolicyLifecycleStageEventCardContribution[];
  eventCardFingerprint: string;
};

export type PolicyEventCardReviewSupersedes = {
  reviewId: string;
  reviewFingerprint: string;
  eventCardSnapshotId: string;
  eventCardFingerprint: string;
  reason: string;
  at: string;
};

export type PolicyEventCardReviewState = {
  schemaVersion: typeof SIX_SCREEN_POLICY_EVENT_CARD_REVIEW_SCHEMA_VERSION;
  id: string;
  seriesId: string;
  ordinal: number;
  revision: number;
  status: "in_review" | "locked";
  binding: PolicyEventCardBinding;
  supersedes: PolicyEventCardReviewSupersedes | null;
  claimReviews: PolicyEventCardClaimReview[];
  treatmentClockDecision: PolicyTreatmentClockDecision;
  changeHistory: PolicyEventCardReviewHistoryEvent[];
  lockedEventCard: PolicyReviewedEventCard | null;
  createdAt: string;
  updatedAt: string;
  reviewFingerprint: string;
};

export type PolicyEventCardReference = {
  schemaVersion: typeof SIX_SCREEN_EVENT_CARD_REFERENCE_SCHEMA_VERSION;
  eventCardSnapshotId: string;
  eventCardFingerprint: string;
  reviewId: string;
  reviewSeriesId: string;
  reviewOrdinal: number;
  binding: PolicyEventCardBinding;
  reviewedAt: string;
  referenceFingerprint: string;
};

export type PolicyEventCardReferenceChange =
  | "identity_changed"
  | "evidence_snapshot_changed"
  | "evidence_snapshot_revision_changed"
  | "evidence_snapshot_fingerprint_changed"
  | "evidence_collection_changed"
  | "projection_changed"
  | "event_card_review_changed";

export type PolicyEventCardReferenceAssessment = {
  status: "current" | "review_required" | "superseded";
  changes: PolicyEventCardReferenceChange[];
  proposedReviewId: string | null;
  currentEventCardSnapshotId: string | null;
};

type ReviewStateBody = Omit<PolicyEventCardReviewState, "reviewFingerprint">;

const UNREVIEWED_TREATMENT_CLOCK: PolicyTreatmentClockDecision = {
  mode: "unreviewed",
  candidateId: null,
  rationale: null,
  decidedAt: null,
  decisionEventId: null,
};

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requireRationale(value: string, label: string) {
  if (value !== value.trim() || !value || value.length > 2_000) {
    throw new Error(`${label} must be non-empty canonical text of at most 2,000 characters.`);
  }
  return value;
}

function requireStatement(value: string, label: string) {
  if (value !== value.trim() || !value || value.length > 4_000) {
    throw new Error(`${label} must be non-empty canonical text of at most 4,000 characters.`);
  }
  return value;
}

function projectionBody(
  projection: PolicyChronologySourcePanelProjection,
) {
  const { projectionFingerprint: _fingerprint, ...body } = projection;
  return body;
}

function requireProjection(
  projection: PolicyChronologySourcePanelProjection,
) {
  if (
    projection.schemaVersion !== SIX_SCREEN_POLICY_CHRONOLOGY_SCHEMA_VERSION ||
    projection.projectionFingerprint !==
      fingerprintSixScreenValue(projectionBody(projection))
  ) {
    throw new Error("Policy Event Card review requires an untampered chronology/source-panel projection.");
  }
  requireBoundedIdentifier(projection.binding.eventId, "Policy Event Card event id");
  requireBoundedIdentifier(
    projection.binding.evidenceSnapshotId,
    "Policy Event Card evidence snapshot id",
  );
  requireFingerprint(
    projection.binding.identityFingerprint,
    "Policy Event Card identity fingerprint",
  );
  requireFingerprint(
    projection.binding.evidenceSnapshotFingerprint,
    "Policy Event Card evidence snapshot fingerprint",
  );
  requireFingerprint(
    projection.binding.evidenceCollectionFingerprint,
    "Policy Event Card evidence collection fingerprint",
  );
  requireFingerprint(
    projection.projectionFingerprint,
    "Policy Event Card projection fingerprint",
  );
  if (
    !Number.isSafeInteger(projection.binding.evidenceSnapshotRevision) ||
    projection.binding.evidenceSnapshotRevision < 0
  ) {
    throw new Error("Policy Event Card evidence snapshot revision is invalid.");
  }
  if (
    projection.interpretationGate.status !== "blocked" ||
    projection.interpretationGate.reason !==
      "genuine_intelligence_path_unverified" ||
    projection.interpretationGate.coherentOverview !== null ||
    projection.interpretationGate.consequentialSemanticReview !== null ||
    projection.interpretationGate.reviewedEventCard !== null
  ) {
    throw new Error("Policy Event Card review cannot bypass the semantic-intelligence gate.");
  }
  if (
    projection.treatmentClockReview.selectedCandidateId !== null ||
    projection.treatmentClockReview.selectionOwner !== "researcher" ||
    projection.treatmentClockReview.candidates.some((candidate) =>
      candidate.status !== "unreviewed" || candidate.selected ||
      candidate.selectionOwner !== "researcher"
    )
  ) {
    throw new Error("Policy treatment clocks must enter review without an inferred selection.");
  }
  return projection;
}

function bindingFor(
  projection: PolicyChronologySourcePanelProjection,
): PolicyEventCardBinding {
  return {
    ...structuredClone(projection.binding),
    projectionFingerprint: projection.projectionFingerprint,
  };
}

function allClocks(projection: PolicyChronologySourcePanelProjection) {
  return [
    ...projection.chronology.absoluteClocks,
    ...projection.chronology.relativeClocks,
    ...projection.chronology.undatedClocks,
  ];
}

function claimCatalog(projection: PolicyChronologySourcePanelProjection) {
  const claims = new Map<string, PolicySourcePanelClaim>();
  const lineages = new Map<string, PolicyEventCardClaimLineage[]>();
  for (const source of projection.sourcePanel.sources) {
    for (const claim of source.claims) {
      const existing = claims.get(claim.claimId);
      if (existing && !sameSixScreenValue(existing, claim)) {
        throw new Error(`Policy claim ${claim.claimId} differs across source-panel entries.`);
      }
      claims.set(claim.claimId, claim);
    }
    for (const passage of source.passages) {
      for (const [direction, claimIds] of [
        ["supporting", passage.supportingClaimIds],
        ["opposing", passage.opposingClaimIds],
      ] as const) {
        for (const claimId of claimIds) {
          const values = lineages.get(claimId) ?? [];
          values.push({
            direction,
            passageId: passage.passageId,
            documentVersionId: passage.documentVersionId,
            sourceId: source.sourceId,
          });
          lineages.set(claimId, values);
        }
      }
    }
  }
  return { claims, lineages };
}

function consequentialClaimIds(
  projection: PolicyChronologySourcePanelProjection,
  claims: Map<string, PolicySourcePanelClaim>,
) {
  const ids = new Set<string>();
  for (const claim of claims.values()) {
    if (claim.criticalFor.some((screen) =>
      screen === "screen-2" || screen.startsWith("screen-2-") ||
      screen === "screen-3" || screen.startsWith("screen-3-")
    )) ids.add(claim.claimId);
  }
  for (const clock of allClocks(projection)) {
    for (const statement of clock.statements) ids.add(statement.claimId);
  }
  for (const requirement of projection.unresolvedRequirements) {
    if (requirement.criticality === "contextual") continue;
    for (const claimId of requirement.supportingClaimIds) ids.add(claimId);
  }
  return [...ids].sort(compareText);
}

function staticClaimReview(
  claim: PolicySourcePanelClaim,
  rawLineages: readonly PolicyEventCardClaimLineage[],
) {
  const lineages = [...new Map(
    rawLineages.map((lineage) => [
      [
        lineage.direction,
        lineage.passageId,
        lineage.documentVersionId,
        lineage.sourceId,
      ].join(":"),
      lineage,
    ]),
  ).values()].sort((left, right) =>
    compareText(
      `${left.direction}:${left.passageId}:${left.sourceId}`,
      `${right.direction}:${right.passageId}:${right.sourceId}`,
    )
  );
  const staticValue = {
    claimId: claim.claimId,
    predicate: claim.predicate,
    sourceStatement: claim.statement,
    sourceTypedValue: structuredClone(claim.typedValue),
    scope: claim.scope,
    supportStatus: claim.supportStatus,
    sourceReviewStatus: claim.reviewStatus,
    criticalFor: [...claim.criticalFor],
    conflictIds: [...claim.conflictIds],
    lineages,
  };
  return {
    ...staticValue,
    claimProjectionFingerprint: fingerprintSixScreenValue(staticValue),
  };
}

function initialClaimReviews(
  projection: PolicyChronologySourcePanelProjection,
) {
  const { claims, lineages } = claimCatalog(projection);
  return consequentialClaimIds(projection, claims).map((claimId) => {
    const claim = claims.get(claimId);
    if (!claim) {
      throw new Error(`Consequential policy claim ${claimId} is missing from the source panel.`);
    }
    const staticValue = staticClaimReview(claim, lineages.get(claimId) ?? []);
    if (!staticValue.lineages.length) {
      throw new Error(`Consequential policy claim ${claimId} has no retained passage lineage.`);
    }
    return {
      ...staticValue,
      decision: "unreviewed" as const,
      effectiveStatement: claim.statement,
      effectiveTypedValue: null,
      statementOrigin: "evidence_claim" as const,
      rationale: null,
      decidedAt: null,
      decisionEventId: null,
    };
  });
}

function claimDecisionSnapshot(
  claim: PolicyEventCardClaimReview,
): ClaimDecisionSnapshot {
  return {
    decision: claim.decision,
    effectiveStatement: claim.effectiveStatement,
    effectiveTypedValue: structuredClone(claim.effectiveTypedValue),
    statementOrigin: claim.statementOrigin,
    rationale: claim.rationale,
    decidedAt: claim.decidedAt,
    decisionEventId: claim.decisionEventId,
  };
}

function claimStaticValue(claim: PolicyEventCardClaimReview) {
  return {
    claimId: claim.claimId,
    predicate: claim.predicate,
    sourceStatement: claim.sourceStatement,
    sourceTypedValue: structuredClone(claim.sourceTypedValue),
    scope: claim.scope,
    supportStatus: claim.supportStatus,
    sourceReviewStatus: claim.sourceReviewStatus,
    criticalFor: [...claim.criticalFor],
    conflictIds: [...claim.conflictIds],
    lineages: structuredClone(claim.lineages),
  };
}

function reviewBody(review: PolicyEventCardReviewState): ReviewStateBody {
  const { reviewFingerprint: _fingerprint, ...body } = review;
  return body;
}

function serializedBytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function fingerprintedReview(body: ReviewStateBody): PolicyEventCardReviewState {
  const review = {
    ...body,
    reviewFingerprint: fingerprintSixScreenValue(body),
  };
  if (serializedBytes(review) > SIX_SCREEN_POLICY_EVENT_CARD_REVIEW_MAX_BYTES) {
    throw new Error("Policy Event Card review exceeds its bounded persistence capacity.");
  }
  return review;
}

function eventCardBody(eventCard: PolicyReviewedEventCard) {
  const { eventCardFingerprint: _fingerprint, ...body } = eventCard;
  return body;
}

function referenceBody(reference: PolicyEventCardReference) {
  const { referenceFingerprint: _fingerprint, ...body } = reference;
  return body;
}

function requireReviewCoordinates(input: {
  review: PolicyEventCardReviewState;
  expectedRevision: number;
  expectedReviewFingerprint: string;
}) {
  if (
    input.review.revision !== input.expectedRevision ||
    input.review.reviewFingerprint !== input.expectedReviewFingerprint
  ) {
    throw new Error(
      `Stale Policy Event Card review coordinates: current revision is ${input.review.revision}.`,
    );
  }
  if (input.review.status !== "in_review" || input.review.lockedEventCard) {
    throw new Error("A locked Policy Event Card review is immutable; begin a new review revision.");
  }
}

function actionReplay(
  review: PolicyEventCardReviewState,
  actionId: string,
  operationFingerprint: string,
) {
  const existing = review.changeHistory.find(({ id }) => id === actionId);
  if (!existing) return null;
  if (existing.operationFingerprint !== operationFingerprint) {
    throw new Error("Policy Event Card action id was reused for a different decision.");
  }
  return review;
}

function appendHistory(
  review: PolicyEventCardReviewState,
  event: PolicyEventCardReviewHistoryEvent,
  updatedAt: string,
  updates: Partial<Pick<
    PolicyEventCardReviewState,
    "claimReviews" | "treatmentClockDecision" | "status" | "lockedEventCard"
  >>,
) {
  if (review.changeHistory.length >= SIX_SCREEN_POLICY_EVENT_CARD_MAX_HISTORY) {
    throw new Error("Policy Event Card review history reached its bounded operation limit.");
  }
  if (updatedAt < review.updatedAt) {
    throw new Error("Policy Event Card decisions cannot move backward in time.");
  }
  return fingerprintedReview({
    ...structuredClone(reviewBody(review)),
    ...structuredClone(updates),
    revision: review.revision + 1,
    changeHistory: [...structuredClone(review.changeHistory), structuredClone(event)],
    updatedAt,
  });
}

function createReview(input: {
  reviewId: string;
  seriesId: string;
  ordinal: number;
  projection: PolicyChronologySourcePanelProjection;
  supersedes: PolicyEventCardReviewSupersedes | null;
  createdAt: string;
}) {
  requireBoundedIdentifier(input.reviewId, "Policy Event Card review id");
  requireBoundedIdentifier(input.seriesId, "Policy Event Card review series id");
  requireCanonicalInstant(input.createdAt, "Policy Event Card review createdAt");
  requireProjection(input.projection);
  if (!Number.isSafeInteger(input.ordinal) || input.ordinal < 1) {
    throw new Error("Policy Event Card review ordinal must be a positive integer.");
  }
  return fingerprintedReview({
    schemaVersion: SIX_SCREEN_POLICY_EVENT_CARD_REVIEW_SCHEMA_VERSION,
    id: input.reviewId,
    seriesId: input.seriesId,
    ordinal: input.ordinal,
    revision: 0,
    status: "in_review",
    binding: bindingFor(input.projection),
    supersedes: structuredClone(input.supersedes),
    claimReviews: initialClaimReviews(input.projection),
    treatmentClockDecision: structuredClone(UNREVIEWED_TREATMENT_CLOCK),
    changeHistory: [],
    lockedEventCard: null,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  });
}

/** Starts a fresh researcher review without accepting any claim or clock. */
export function createPolicyEventCardReview(input: {
  reviewId: string;
  projection: PolicyChronologySourcePanelProjection;
  createdAt: string;
}) {
  return createReview({
    reviewId: input.reviewId,
    seriesId: input.reviewId,
    ordinal: 1,
    projection: input.projection,
    supersedes: null,
    createdAt: input.createdAt,
  });
}

/**
 * Starts a proposed revision while leaving the previous locked Event Card and
 * its immutable evidence binding untouched.
 */
export function createPolicyEventCardReviewRevision(input: {
  previousReview: PolicyEventCardReviewState;
  reviewId: string;
  projection: PolicyChronologySourcePanelProjection;
  reason: string;
  createdAt: string;
}) {
  validatePolicyEventCardReview({ review: input.previousReview });
  requireProjection(input.projection);
  if (!input.previousReview.lockedEventCard) {
    throw new Error("A Policy Event Card revision must supersede a locked review.");
  }
  if (
    input.previousReview.binding.eventId !== input.projection.binding.eventId ||
    input.previousReview.binding.identityFingerprint !==
      input.projection.binding.identityFingerprint
  ) {
    throw new Error("A different controlling identity must begin a new review series through Screen 1.");
  }
  if (input.reviewId === input.previousReview.id) {
    throw new Error("A Policy Event Card revision requires a new review id.");
  }
  if (input.createdAt < input.previousReview.updatedAt) {
    throw new Error("A Policy Event Card revision cannot predate the review it supersedes.");
  }
  const reason = requireRationale(input.reason, "Policy Event Card revision reason");
  return createReview({
    reviewId: input.reviewId,
    seriesId: input.previousReview.seriesId,
    ordinal: input.previousReview.ordinal + 1,
    projection: input.projection,
    supersedes: {
      reviewId: input.previousReview.id,
      reviewFingerprint: input.previousReview.reviewFingerprint,
      eventCardSnapshotId: input.previousReview.lockedEventCard.snapshotId,
      eventCardFingerprint:
        input.previousReview.lockedEventCard.eventCardFingerprint,
      reason,
      at: input.createdAt,
    },
    createdAt: input.createdAt,
  });
}

export function reviewPolicyEventCardClaim(input: {
  review: PolicyEventCardReviewState;
  projection: PolicyChronologySourcePanelProjection;
  expectedRevision: number;
  expectedReviewFingerprint: string;
  actionId: string;
  claimId: string;
  decision: Exclude<PolicyClaimReviewDecision, "unreviewed">;
  correctedStatement?: string | null;
  rationale: string;
  actor: "researcher_ui" | "model" | "system";
  decidedAt: string;
}) {
  requireBoundedIdentifier(input.actionId, "Policy claim-review action id");
  requireBoundedIdentifier(input.claimId, "Policy claim-review claim id");
  if (input.actor !== "researcher_ui") {
    throw new Error("Only an explicit researcher UI action can review a Policy Event Card claim.");
  }
  const rationale = requireRationale(input.rationale, "Policy claim-review rationale");
  const correctedStatement = input.decision === "corrected"
    ? requireStatement(
        input.correctedStatement ?? "",
        "Corrected policy claim statement",
      )
    : null;
  if (input.decision !== "corrected" && input.correctedStatement != null) {
    throw new Error("Only a corrected claim decision may provide replacement text.");
  }
  const operationFingerprint = fingerprintSixScreenValue({
    kind: "claim_decision",
    claimId: input.claimId,
    decision: input.decision,
    correctedStatement,
    rationale,
    actor: "researcher",
  });
  validatePolicyEventCardReview({
    review: input.review,
    projection: input.projection,
  });
  const replay = actionReplay(input.review, input.actionId, operationFingerprint);
  if (replay) return replay;
  requireCanonicalInstant(input.decidedAt, "Policy claim-review decision time");
  requireReviewCoordinates(input);
  const index = input.review.claimReviews.findIndex(
    ({ claimId }) => claimId === input.claimId,
  );
  if (index < 0) {
    throw new Error("Policy claim is not a consequential Event Card review target.");
  }
  const currentClaim = input.review.claimReviews[index]!;
  if (input.decision === "accepted" && currentClaim.supportStatus === "unsupported") {
    throw new Error(
      "Unsupported policy text cannot be accepted as verified; keep it provisional, reject it, request evidence, or record a researcher-supplied correction.",
    );
  }
  if (
    input.decision === "corrected" &&
    correctedStatement === currentClaim.sourceStatement
  ) {
    throw new Error("A corrected policy claim must differ from the source claim statement.");
  }
  const nextClaim: PolicyEventCardClaimReview = {
    ...structuredClone(currentClaim),
    decision: input.decision,
    effectiveStatement: correctedStatement ?? currentClaim.sourceStatement,
    effectiveTypedValue:
      input.decision === "accepted" || input.decision === "provisional"
        ? structuredClone(currentClaim.sourceTypedValue)
        : null,
    statementOrigin: input.decision === "corrected"
      ? "researcher_supplied"
      : "evidence_claim",
    rationale,
    decidedAt: input.decidedAt,
    decisionEventId: input.actionId,
  };
  const claimReviews = structuredClone(input.review.claimReviews);
  claimReviews[index] = nextClaim;
  const summary = input.decision === "corrected"
    ? `Researcher corrected claim ${input.claimId}; the edit remains explicitly researcher-supplied.`
    : `Researcher marked claim ${input.claimId} ${input.decision.replaceAll("_", " ")}.`;
  return appendHistory(input.review, {
    id: input.actionId,
    revision: input.review.revision + 1,
    kind: "claim_decision",
    actor: "researcher",
    at: input.decidedAt,
    projectionFingerprint: input.review.binding.projectionFingerprint,
    operationFingerprint,
    claimId: input.claimId,
    previous: claimDecisionSnapshot(currentClaim),
    next: claimDecisionSnapshot(nextClaim),
    summary,
  }, input.decidedAt, { claimReviews });
}

function clockByCandidate(
  projection: PolicyChronologySourcePanelProjection,
  candidateId: string,
) {
  const candidate = projection.treatmentClockReview.candidates.find(
    ({ id }) => id === candidateId,
  );
  if (!candidate) return null;
  const clock = allClocks(projection).find(({ id }) => id === candidate.clockId);
  return clock ? { candidate, clock } : null;
}

function requireSelectedClockUsable(
  review: PolicyEventCardReviewState,
  projection: PolicyChronologySourcePanelProjection,
  candidateId: string,
) {
  const resolved = clockByCandidate(projection, candidateId);
  if (!resolved) {
    throw new Error("Treatment-clock decision names a candidate outside this projection.");
  }
  const linkedClaimIds = resolved.clock.statements.map(({ claimId }) => claimId);
  if (!linkedClaimIds.length) return resolved;
  const decisions = linkedClaimIds.map((claimId) =>
    review.claimReviews.find((claim) => claim.claimId === claimId)
  );
  if (decisions.some((claim) => !claim || claim.decision === "unreviewed")) {
    throw new Error("A claim-linked treatment clock requires its consequential claims to be reviewed first.");
  }
  if (decisions.every((claim) =>
    claim?.decision === "rejected" ||
    claim?.decision === "needs_more_evidence"
  )) {
    throw new Error("A treatment clock cannot rely only on rejected or unresolved claims.");
  }
  return resolved;
}

export function decidePolicyTreatmentClock(input: {
  review: PolicyEventCardReviewState;
  projection: PolicyChronologySourcePanelProjection;
  expectedRevision: number;
  expectedReviewFingerprint: string;
  actionId: string;
  decision:
    | { mode: "selected"; candidateId: string }
    | { mode: "no_selection"; candidateId?: never };
  rationale: string;
  actor: "researcher_ui" | "model" | "system";
  decidedAt: string;
}) {
  requireBoundedIdentifier(input.actionId, "Treatment-clock decision action id");
  if (input.actor !== "researcher_ui") {
    throw new Error("Only an explicit researcher UI action can choose a treatment clock.");
  }
  const rationale = requireRationale(input.rationale, "Treatment-clock decision rationale");
  if (input.decision.mode === "selected") {
    requireBoundedIdentifier(
      input.decision.candidateId,
      "Treatment-clock candidate id",
    );
  }
  const operationFingerprint = fingerprintSixScreenValue({
    kind: "treatment_clock_decision",
    decision: input.decision,
    rationale,
    actor: "researcher",
  });
  validatePolicyEventCardReview({
    review: input.review,
    projection: input.projection,
  });
  const replay = actionReplay(input.review, input.actionId, operationFingerprint);
  if (replay) return replay;
  requireCanonicalInstant(input.decidedAt, "Treatment-clock decision time");
  requireReviewCoordinates(input);
  if (input.decision.mode === "selected") {
    requireSelectedClockUsable(
      input.review,
      input.projection,
      input.decision.candidateId,
    );
  }
  const next: PolicyTreatmentClockDecision = input.decision.mode === "selected"
    ? {
        mode: "selected",
        candidateId: input.decision.candidateId,
        rationale,
        decidedAt: input.decidedAt,
        decisionEventId: input.actionId,
      }
    : {
        mode: "no_selection",
        candidateId: null,
        rationale,
        decidedAt: input.decidedAt,
        decisionEventId: input.actionId,
      };
  const summary = next.mode === "selected"
    ? `Researcher selected treatment-clock candidate ${next.candidateId}.`
    : "Researcher explicitly continued without selecting a treatment clock.";
  return appendHistory(input.review, {
    id: input.actionId,
    revision: input.review.revision + 1,
    kind: "treatment_clock_decision",
    actor: "researcher",
    at: input.decidedAt,
    projectionFingerprint: input.review.binding.projectionFingerprint,
    operationFingerprint,
    previous: structuredClone(input.review.treatmentClockDecision),
    next: structuredClone(next),
    summary,
  }, input.decidedAt, { treatmentClockDecision: next });
}

function limitation(
  code: PolicyReviewedEventCardLimitation["code"],
  relatedIds: string[],
  summary: string,
): PolicyReviewedEventCardLimitation {
  return { code, relatedIds: [...relatedIds].sort(compareText), summary };
}

function eventCardLimitations(input: {
  claims: readonly PolicyEventCardClaimReview[];
  treatmentClockDecision: PolicyTreatmentClockDecision;
  unresolvedRequirements: readonly PolicyUnresolvedRequirement[];
  conflicts: readonly ConflictRecord[];
}) {
  const values: PolicyReviewedEventCardLimitation[] = [];
  const addClaims = (
    decision: PolicyClaimReviewDecision,
    code: PolicyReviewedEventCardLimitation["code"],
    summary: string,
  ) => {
    const ids = input.claims
      .filter((claim) => claim.decision === decision)
      .map(({ claimId }) => claimId);
    if (ids.length) values.push(limitation(code, ids, summary));
  };
  addClaims(
    "unreviewed",
    "unreviewed_claim",
    "One or more consequential source claims remain unreviewed and cannot be used as accepted premises.",
  );
  addClaims(
    "provisional",
    "provisional_claim",
    "One or more consequential claims remain provisional.",
  );
  addClaims(
    "rejected",
    "rejected_claim",
    "One or more source claims were rejected and are not accepted premises.",
  );
  addClaims(
    "needs_more_evidence",
    "needs_more_evidence",
    "One or more consequential claims require additional evidence.",
  );
  addClaims(
    "corrected",
    "researcher_supplied_correction",
    "One or more corrections are researcher-supplied assertions and do not upgrade source support.",
  );
  if (input.unresolvedRequirements.length) {
    values.push(limitation(
      "unresolved_requirement",
      input.unresolvedRequirements.map(({ requirementId }) => requirementId),
      "The evidence snapshot retains unresolved policy requirements.",
    ));
  }
  const unresolvedConflicts = input.conflicts.filter(
    ({ resolution }) => resolution === null,
  );
  if (unresolvedConflicts.length) {
    values.push(limitation(
      "unresolved_conflict",
      unresolvedConflicts.map(({ id }) => id),
      "The evidence snapshot retains unresolved conflicting accounts.",
    ));
  }
  if (input.treatmentClockDecision.mode === "no_selection") {
    values.push(limitation(
      "no_treatment_clock",
      [],
      "The researcher explicitly continued without selecting a treatment clock.",
    ));
  }
  return values;
}

function createLockedEventCard(input: {
  review: PolicyEventCardReviewState;
  projection: PolicyChronologySourcePanelProjection;
  lifecycleStageRevisions: readonly PolicyLifecycleStageEventCardContribution[];
  eventCardSnapshotId: string;
  reviewedAt: string;
}) {
  const decision = input.review.treatmentClockDecision;
  if (decision.mode === "unreviewed") {
    throw new Error("Locking an Event Card requires an explicit treatment-clock or no-selection decision.");
  }
  const treatmentClock: PolicyReviewedEventCard["treatmentClock"] =
    decision.mode === "selected"
      ? {
          mode: "selected",
          candidate: {
            ...structuredClone(
              input.projection.treatmentClockReview.candidates.find(
                ({ id }) => id === decision.candidateId,
              )!,
            ),
            status: "selected",
            selected: true,
          },
          rationale: decision.rationale,
          decidedAt: decision.decidedAt,
          decisionEventId: decision.decisionEventId,
        }
      : {
          mode: "no_selection",
          candidate: null,
          rationale: decision.rationale,
          decidedAt: decision.decidedAt,
          decisionEventId: decision.decisionEventId,
        };
  const body: Omit<PolicyReviewedEventCard, "eventCardFingerprint"> = {
    schemaVersion: SIX_SCREEN_REVIEWED_EVENT_CARD_SCHEMA_VERSION,
    snapshotId: input.eventCardSnapshotId,
    reviewId: input.review.id,
    reviewSeriesId: input.review.seriesId,
    reviewOrdinal: input.review.ordinal,
    reviewRevision: input.review.revision + 1,
    binding: structuredClone(input.review.binding),
    claims: structuredClone(input.review.claimReviews),
    chronology: mergePolicyLifecycleStageContributionsIntoChronology(
      input.projection.chronology,
      input.lifecycleStageRevisions,
    ),
    treatmentClock,
    unresolvedRequirements: structuredClone(
      input.projection.unresolvedRequirements,
    ),
    conflicts: structuredClone(input.projection.conflicts),
    limitations: eventCardLimitations({
      claims: input.review.claimReviews,
      treatmentClockDecision: decision,
      unresolvedRequirements: input.projection.unresolvedRequirements,
      conflicts: input.projection.conflicts,
    }),
    decisionHistoryFingerprint: fingerprintSixScreenValue(
      input.review.changeHistory,
    ),
    reviewedAt: input.reviewedAt,
    semanticReview: {
      coherentOverview: null,
      consequentialSemanticReview: null,
      status: "blocked",
      reason: "genuine_intelligence_path_unverified",
    },
    ...(input.lifecycleStageRevisions.length
      ? {
          lifecycleStageRevisions: structuredClone(
            [...input.lifecycleStageRevisions],
          ),
        }
      : {}),
  };
  return {
    ...body,
    eventCardFingerprint: fingerprintSixScreenValue(body),
  };
}

export function lockPolicyEventCardReview(input: {
  review: PolicyEventCardReviewState;
  projection: PolicyChronologySourcePanelProjection;
  lifecycleStageRevisions?: readonly PolicyLifecycleStageEventCardContribution[];
  expectedRevision: number;
  expectedReviewFingerprint: string;
  actionId: string;
  eventCardSnapshotId: string;
  rationale: string;
  actor: "researcher_ui" | "model" | "system";
  lockedAt: string;
}) {
  requireBoundedIdentifier(input.actionId, "Policy Event Card lock action id");
  requireBoundedIdentifier(
    input.eventCardSnapshotId,
    "Reviewed Policy Event Card snapshot id",
  );
  if (
    input.review.supersedes?.eventCardSnapshotId ===
    input.eventCardSnapshotId
  ) {
    throw new Error("A Policy Event Card revision requires a new snapshot id.");
  }
  if (input.actor !== "researcher_ui") {
    throw new Error("Only an explicit researcher UI action can lock a Policy Event Card.");
  }
  const rationale = requireRationale(input.rationale, "Policy Event Card lock rationale");
  const lifecycleStageRevisions = structuredClone(
    input.lifecycleStageRevisions ?? [],
  );
  if (
    lifecycleStageRevisions.length >
      SIX_SCREEN_POLICY_EVENT_CARD_MAX_LIFECYCLE_STAGE_REVISIONS ||
    new Set(lifecycleStageRevisions.map(({ contributionFingerprint }) =>
      contributionFingerprint)).size !== lifecycleStageRevisions.length ||
    new Set(lifecycleStageRevisions.map(({ proposalReference }) =>
      proposalReference.proposalId)).size !== lifecycleStageRevisions.length
  ) {
    throw new Error("Policy Event Card lifecycle-stage revisions exceed bounded unique capacity.");
  }
  lifecycleStageRevisions.forEach((contribution) => {
    validatePolicyLifecycleStageEventCardContribution(contribution);
    if (
      contribution.targetPolicyEventCardReviewId !== input.review.id ||
      contribution.includedAt !== input.lockedAt
    ) {
      throw new Error("Policy Event Card lifecycle-stage revision coordinates are invalid.");
    }
  });
  const lifecycleStageRevisionFingerprints = lifecycleStageRevisions.map(
    ({ contributionFingerprint }) => contributionFingerprint,
  );
  const operationFingerprint = fingerprintSixScreenValue({
    kind: "event_card_locked",
    eventCardSnapshotId: input.eventCardSnapshotId,
    ...(lifecycleStageRevisionFingerprints.length
      ? { lifecycleStageRevisionFingerprints }
      : {}),
    rationale,
    actor: "researcher",
  });
  validatePolicyEventCardReview({
    review: input.review,
    projection: input.projection,
  });
  const replay = actionReplay(input.review, input.actionId, operationFingerprint);
  if (replay) return replay;
  requireCanonicalInstant(input.lockedAt, "Policy Event Card lock time");
  requireReviewCoordinates(input);
  if (input.review.treatmentClockDecision.mode === "unreviewed") {
    throw new Error("Locking an Event Card requires an explicit treatment-clock or no-selection decision.");
  }
  if (input.review.treatmentClockDecision.mode === "selected") {
    requireSelectedClockUsable(
      input.review,
      input.projection,
      input.review.treatmentClockDecision.candidateId,
    );
  }
  if (input.projection.unresolvedRequirements.some((requirement) =>
    requirement.kind === "identity" &&
    requirement.criticality === "critical" &&
    requirement.status === "conflicting"
  )) {
    throw new Error("A contradicted controlling identity must return to Screen 1.");
  }
  const lockedEventCard = createLockedEventCard({
    review: input.review,
    projection: input.projection,
    lifecycleStageRevisions,
    eventCardSnapshotId: input.eventCardSnapshotId,
    reviewedAt: input.lockedAt,
  });
  return appendHistory(input.review, {
    id: input.actionId,
    revision: input.review.revision + 1,
    kind: "event_card_locked",
    actor: "researcher",
    at: input.lockedAt,
    projectionFingerprint: input.review.binding.projectionFingerprint,
    operationFingerprint,
    eventCardSnapshotId: lockedEventCard.snapshotId,
    eventCardFingerprint: lockedEventCard.eventCardFingerprint,
    ...(lifecycleStageRevisionFingerprints.length
      ? { lifecycleStageRevisionFingerprints }
      : {}),
    rationale,
    summary:
      `Researcher locked Event Card ${lockedEventCard.snapshotId} against immutable evidence snapshot ${lockedEventCard.binding.evidenceSnapshotId}${lifecycleStageRevisionFingerprints.length ? ` with ${lifecycleStageRevisionFingerprints.length} accepted lifecycle-stage revision${lifecycleStageRevisionFingerprints.length === 1 ? "" : "s"}` : ""}.`,
  }, input.lockedAt, {
    status: "locked",
    lockedEventCard,
  });
}

function validateDecisionState(claim: PolicyEventCardClaimReview) {
  if (claim.decision === "unreviewed") {
    if (
      claim.effectiveStatement !== claim.sourceStatement ||
      claim.effectiveTypedValue !== null ||
      claim.statementOrigin !== "evidence_claim" ||
      claim.rationale !== null || claim.decidedAt !== null ||
      claim.decisionEventId !== null
    ) {
      throw new Error(`Unreviewed policy claim ${claim.claimId} contains an inferred decision.`);
    }
    return;
  }
  requireRationale(claim.rationale ?? "", `Policy claim ${claim.claimId} rationale`);
  requireCanonicalInstant(
    claim.decidedAt ?? "",
    `Policy claim ${claim.claimId} decision time`,
  );
  requireBoundedIdentifier(
    claim.decisionEventId ?? "",
    `Policy claim ${claim.claimId} decision event id`,
  );
  if (claim.decision === "corrected") {
    requireStatement(
      claim.effectiveStatement,
      `Policy claim ${claim.claimId} corrected statement`,
    );
    if (
      claim.statementOrigin !== "researcher_supplied" ||
      claim.effectiveStatement === claim.sourceStatement ||
      claim.effectiveTypedValue !== null
    ) {
      throw new Error("A corrected policy claim must remain a distinct researcher-supplied assertion.");
    }
  } else if (
    claim.statementOrigin !== "evidence_claim" ||
    claim.effectiveStatement !== claim.sourceStatement
  ) {
    throw new Error("A policy claim decision cannot silently edit its source statement.");
  }
  if (
    (claim.decision === "accepted" || claim.decision === "provisional")
      ? !sameSixScreenValue(
          claim.effectiveTypedValue,
          claim.sourceTypedValue,
        )
      : claim.effectiveTypedValue !== null
  ) {
    throw new Error("A policy claim decision cannot silently alter its source typed value.");
  }
  if (claim.decision === "accepted" && claim.supportStatus === "unsupported") {
    throw new Error("An unsupported policy claim cannot be upgraded to accepted verified fact.");
  }
}

function validateTreatmentDecision(
  decision: PolicyTreatmentClockDecision,
  projection?: PolicyChronologySourcePanelProjection,
) {
  if (decision.mode === "unreviewed") {
    if (
      decision.candidateId !== null || decision.rationale !== null ||
      decision.decidedAt !== null || decision.decisionEventId !== null
    ) throw new Error("Unreviewed treatment-clock state contains an inferred selection.");
    return;
  }
  requireRationale(decision.rationale, "Treatment-clock rationale");
  requireCanonicalInstant(decision.decidedAt, "Treatment-clock decision time");
  requireBoundedIdentifier(
    decision.decisionEventId,
    "Treatment-clock decision event id",
  );
  if (decision.mode === "selected") {
    requireBoundedIdentifier(decision.candidateId, "Treatment-clock candidate id");
    if (
      projection &&
      !projection.treatmentClockReview.candidates.some(
        ({ id }) => id === decision.candidateId,
      )
    ) {
      throw new Error("Selected treatment clock is outside the bound projection.");
    }
  } else if (decision.candidateId !== null) {
    throw new Error("An explicit no-selection record cannot name a treatment clock.");
  }
}

function sameBinding(
  left: PolicyEventCardBinding,
  right: PolicyEventCardBinding,
) {
  return sameSixScreenValue(left, right);
}

/** Validates persisted partial, rejected, corrected, or locked review state. */
export function validatePolicyEventCardReview(input: {
  review: PolicyEventCardReviewState;
  projection?: PolicyChronologySourcePanelProjection;
}) {
  const review = input.review;
  if (
    review.schemaVersion !== SIX_SCREEN_POLICY_EVENT_CARD_REVIEW_SCHEMA_VERSION ||
    review.reviewFingerprint !== fingerprintSixScreenValue(reviewBody(review)) ||
    serializedBytes(review) > SIX_SCREEN_POLICY_EVENT_CARD_REVIEW_MAX_BYTES
  ) {
    throw new Error("Policy Event Card review fingerprint is invalid.");
  }
  requireBoundedIdentifier(review.id, "Policy Event Card review id");
  requireBoundedIdentifier(review.seriesId, "Policy Event Card review series id");
  requireBoundedIdentifier(review.binding.eventId, "Policy Event Card event id");
  requireBoundedIdentifier(
    review.binding.evidenceSnapshotId,
    "Policy Event Card evidence snapshot id",
  );
  requireCanonicalInstant(review.createdAt, "Policy Event Card review createdAt");
  requireCanonicalInstant(review.updatedAt, "Policy Event Card review updatedAt");
  requireFingerprint(review.binding.identityFingerprint, "Policy Event Card identity fingerprint");
  requireFingerprint(review.binding.evidenceSnapshotFingerprint, "Policy Event Card evidence snapshot fingerprint");
  requireFingerprint(review.binding.evidenceCollectionFingerprint, "Policy Event Card evidence collection fingerprint");
  requireFingerprint(review.binding.projectionFingerprint, "Policy Event Card projection fingerprint");
  if (
    !Number.isSafeInteger(review.ordinal) || review.ordinal < 1 ||
    !Number.isSafeInteger(review.revision) || review.revision < 0 ||
    review.changeHistory.length !== review.revision ||
    review.changeHistory.length > SIX_SCREEN_POLICY_EVENT_CARD_MAX_HISTORY
  ) {
    throw new Error("Policy Event Card review revision/history is invalid.");
  }
  if (
    !Number.isSafeInteger(review.binding.evidenceSnapshotRevision) ||
    review.binding.evidenceSnapshotRevision < 0 ||
    review.updatedAt < review.createdAt
  ) {
    throw new Error("Policy Event Card review chronology is invalid.");
  }
  if (review.supersedes) {
    requireBoundedIdentifier(
      review.supersedes.reviewId,
      "Superseded Policy Event Card review id",
    );
    requireBoundedIdentifier(
      review.supersedes.eventCardSnapshotId,
      "Superseded Policy Event Card snapshot id",
    );
    requireFingerprint(
      review.supersedes.reviewFingerprint,
      "Superseded Policy Event Card review fingerprint",
    );
    requireFingerprint(
      review.supersedes.eventCardFingerprint,
      "Superseded Policy Event Card fingerprint",
    );
    requireRationale(
      review.supersedes.reason,
      "Policy Event Card revision reason",
    );
    requireCanonicalInstant(
      review.supersedes.at,
      "Policy Event Card revision time",
    );
    if (
      review.ordinal < 2 || review.supersedes.reviewId === review.id ||
      review.supersedes.at !== review.createdAt
    ) {
      throw new Error("Policy Event Card supersession lineage is invalid.");
    }
  } else if (review.ordinal !== 1 || review.seriesId !== review.id) {
    throw new Error("An initial Policy Event Card review must begin its own review series.");
  }
  if (new Set(review.claimReviews.map(({ claimId }) => claimId)).size !==
      review.claimReviews.length) {
    throw new Error("Policy Event Card claim-review ids must be unique.");
  }
  if (new Set(review.changeHistory.map(({ id }) => id)).size !==
      review.changeHistory.length) {
    throw new Error("Policy Event Card history action ids must be unique.");
  }
  for (const claim of review.claimReviews) {
    requireBoundedIdentifier(claim.claimId, "Policy Event Card claim id");
    requireFingerprint(
      claim.claimProjectionFingerprint,
      `Policy claim ${claim.claimId} projection fingerprint`,
    );
    if (
      claim.claimProjectionFingerprint !==
      fingerprintSixScreenValue(claimStaticValue(claim))
    ) {
      throw new Error(`Policy claim ${claim.claimId} projection binding is invalid.`);
    }
    validateDecisionState(claim);
  }
  validateTreatmentDecision(review.treatmentClockDecision, input.projection);
  const replayedClaims = new Map<string, ClaimDecisionSnapshot>(
    review.claimReviews.map((claim) => [
      claim.claimId,
      {
        decision: "unreviewed" as const,
        effectiveStatement: claim.sourceStatement,
        effectiveTypedValue: null,
        statementOrigin: "evidence_claim" as const,
        rationale: null,
        decidedAt: null,
        decisionEventId: null,
      } satisfies ClaimDecisionSnapshot,
    ]),
  );
  let replayedTreatment = structuredClone(UNREVIEWED_TREATMENT_CLOCK);
  let sawLock = false;
  let previousEventAt = review.createdAt;
  review.changeHistory.forEach((event, index) => {
    if (
      event.revision !== index + 1 ||
      event.projectionFingerprint !== review.binding.projectionFingerprint
    ) {
      throw new Error("Policy Event Card history is not an append-only projection-bound sequence.");
    }
    requireBoundedIdentifier(event.id, "Policy Event Card history action id");
    requireCanonicalInstant(event.at, "Policy Event Card history time");
    requireFingerprint(event.operationFingerprint, "Policy Event Card operation fingerprint");
    if (!event.summary.trim()) {
      throw new Error("Policy Event Card history requires a readable change summary.");
    }
    if (event.at < previousEventAt) {
      throw new Error("Policy Event Card history times must be append-only.");
    }
    previousEventAt = event.at;
    if (sawLock) {
      throw new Error("A locked Policy Event Card cannot have later history events.");
    }
    if (event.kind === "claim_decision") {
      const claim = review.claimReviews.find(
        ({ claimId }) => claimId === event.claimId,
      );
      const previous = replayedClaims.get(event.claimId);
      if (!claim || !previous || !sameSixScreenValue(event.previous, previous)) {
        throw new Error("Policy Event Card claim history does not replay from its prior decision.");
      }
      if (
        event.next.decisionEventId !== event.id ||
        event.next.decidedAt !== event.at
      ) {
        throw new Error("Policy Event Card claim history has inconsistent decision coordinates.");
      }
      validateDecisionState({ ...claim, ...event.next });
      const expectedOperationFingerprint = fingerprintSixScreenValue({
        kind: "claim_decision",
        claimId: event.claimId,
        decision: event.next.decision,
        correctedStatement: event.next.decision === "corrected"
          ? event.next.effectiveStatement
          : null,
        rationale: event.next.rationale,
        actor: "researcher",
      });
      if (event.operationFingerprint !== expectedOperationFingerprint) {
        throw new Error("Policy Event Card claim-history operation fingerprint is invalid.");
      }
      replayedClaims.set(event.claimId, structuredClone(event.next));
    } else if (event.kind === "treatment_clock_decision") {
      if (!sameSixScreenValue(event.previous, replayedTreatment)) {
        throw new Error("Policy treatment-clock history does not replay from its prior decision.");
      }
      if (
        event.next.decisionEventId !== event.id ||
        event.next.decidedAt !== event.at
      ) {
        throw new Error("Policy treatment-clock history has inconsistent decision coordinates.");
      }
      validateTreatmentDecision(event.next, input.projection);
      const expectedOperationFingerprint = fingerprintSixScreenValue({
        kind: "treatment_clock_decision",
        decision: event.next.mode === "selected"
          ? { mode: "selected", candidateId: event.next.candidateId }
          : { mode: "no_selection" },
        rationale: event.next.rationale,
        actor: "researcher",
      });
      if (event.operationFingerprint !== expectedOperationFingerprint) {
        throw new Error("Policy treatment-clock operation fingerprint is invalid.");
      }
      replayedTreatment = structuredClone(event.next);
    } else {
      requireBoundedIdentifier(
        event.eventCardSnapshotId,
        "Policy Event Card lock snapshot id",
      );
      requireFingerprint(
        event.eventCardFingerprint,
        "Policy Event Card lock fingerprint",
      );
      requireRationale(event.rationale, "Policy Event Card lock rationale");
      const lifecycleStageRevisionFingerprints =
        event.lifecycleStageRevisionFingerprints ?? [];
      if (
        (event.lifecycleStageRevisionFingerprints !== undefined &&
          lifecycleStageRevisionFingerprints.length === 0) ||
        lifecycleStageRevisionFingerprints.length >
          SIX_SCREEN_POLICY_EVENT_CARD_MAX_LIFECYCLE_STAGE_REVISIONS ||
        new Set(lifecycleStageRevisionFingerprints).size !==
          lifecycleStageRevisionFingerprints.length
      ) {
        throw new Error("Policy Event Card lock lifecycle-stage fingerprints are invalid.");
      }
      lifecycleStageRevisionFingerprints.forEach((fingerprint) =>
        requireFingerprint(
          fingerprint,
          "Policy Event Card lifecycle-stage revision fingerprint",
        ));
      const expectedOperationFingerprint = fingerprintSixScreenValue({
        kind: "event_card_locked",
        eventCardSnapshotId: event.eventCardSnapshotId,
        ...(lifecycleStageRevisionFingerprints.length
          ? { lifecycleStageRevisionFingerprints }
          : {}),
        rationale: event.rationale,
        actor: "researcher",
      });
      if (event.operationFingerprint !== expectedOperationFingerprint) {
        throw new Error("Policy Event Card lock operation fingerprint is invalid.");
      }
      sawLock = true;
    }
  });
  if (
    review.updatedAt !==
      (review.changeHistory.at(-1)?.at ?? review.createdAt)
  ) {
    throw new Error("Policy Event Card updatedAt does not match its append-only history.");
  }
  if (review.claimReviews.some((claim) =>
    !sameSixScreenValue(
      claimDecisionSnapshot(claim),
      replayedClaims.get(claim.claimId),
    )
  ) || !sameSixScreenValue(review.treatmentClockDecision, replayedTreatment)) {
    throw new Error("Policy Event Card current decisions do not match append-only history.");
  }
  if (
    (review.status === "locked") !== (review.lockedEventCard !== null) ||
    (review.lockedEventCard &&
      review.changeHistory.at(-1)?.kind !== "event_card_locked")
  ) {
    throw new Error("Policy Event Card lock status is inconsistent.");
  }
  if (review.lockedEventCard) {
    const eventCard = review.lockedEventCard;
    const lifecycleStageRevisions = eventCard.lifecycleStageRevisions ?? [];
    const lifecycleStageRevisionFingerprints = lifecycleStageRevisions.map(
      ({ contributionFingerprint }) => contributionFingerprint,
    );
    if (
      (eventCard.lifecycleStageRevisions !== undefined &&
        lifecycleStageRevisions.length === 0) ||
      lifecycleStageRevisions.length >
        SIX_SCREEN_POLICY_EVENT_CARD_MAX_LIFECYCLE_STAGE_REVISIONS ||
      new Set(lifecycleStageRevisionFingerprints).size !==
        lifecycleStageRevisionFingerprints.length ||
      new Set(lifecycleStageRevisions.map(({ proposalReference }) =>
        proposalReference.proposalId)).size !== lifecycleStageRevisions.length
    ) {
      throw new Error("Locked Policy Event Card lifecycle-stage revisions are not bounded and unique.");
    }
    lifecycleStageRevisions.forEach((contribution) => {
      validatePolicyLifecycleStageEventCardContribution(contribution);
      if (
        contribution.targetPolicyEventCardReviewId !== review.id ||
        contribution.includedAt !== eventCard.reviewedAt
      ) {
        throw new Error("Locked Policy Event Card lifecycle-stage revision coordinates are invalid.");
      }
    });
    requireBoundedIdentifier(
      eventCard.snapshotId,
      "Reviewed Policy Event Card snapshot id",
    );
    requireCanonicalInstant(
      eventCard.reviewedAt,
      "Reviewed Policy Event Card time",
    );
    requireFingerprint(
      eventCard.eventCardFingerprint,
      "Reviewed Policy Event Card fingerprint",
    );
    requireFingerprint(
      eventCard.decisionHistoryFingerprint,
      "Reviewed Policy Event Card decision-history fingerprint",
    );
    if (
      eventCard.schemaVersion !== SIX_SCREEN_REVIEWED_EVENT_CARD_SCHEMA_VERSION ||
      eventCard.eventCardFingerprint !==
        fingerprintSixScreenValue(eventCardBody(eventCard)) ||
      eventCard.reviewId !== review.id ||
      eventCard.reviewSeriesId !== review.seriesId ||
      eventCard.reviewOrdinal !== review.ordinal ||
      eventCard.reviewRevision !== review.revision ||
      !sameBinding(eventCard.binding, review.binding) ||
      !sameSixScreenValue(eventCard.claims, review.claimReviews) ||
      eventCard.semanticReview.status !== "blocked" ||
      eventCard.semanticReview.reason !== "genuine_intelligence_path_unverified" ||
      eventCard.semanticReview.coherentOverview !== null ||
      eventCard.semanticReview.consequentialSemanticReview !== null ||
      review.treatmentClockDecision.mode === "unreviewed"
    ) {
      throw new Error("Locked Policy Event Card is not an immutable projection-bound review snapshot.");
    }
    const lockEvent = review.changeHistory.at(-1)!;
    if (
      lockEvent.kind !== "event_card_locked" ||
      lockEvent.eventCardSnapshotId !== eventCard.snapshotId ||
      lockEvent.eventCardFingerprint !== eventCard.eventCardFingerprint ||
      !sameSixScreenValue(
        lockEvent.lifecycleStageRevisionFingerprints ?? [],
        lifecycleStageRevisionFingerprints,
      ) ||
      eventCard.reviewedAt !== lockEvent.at ||
      review.updatedAt !== lockEvent.at ||
      eventCard.decisionHistoryFingerprint !== fingerprintSixScreenValue(
        review.changeHistory.slice(0, -1),
      )
    ) {
      throw new Error("Locked Policy Event Card does not match its append-only lock event.");
    }
  }
  if (input.projection) {
    const projection = requireProjection(input.projection);
    if (!sameBinding(review.binding, bindingFor(projection))) {
      throw new Error("Policy Event Card review does not match the supplied projection and immutable evidence binding.");
    }
    const expectedClaims = initialClaimReviews(projection);
    const actualStatic = review.claimReviews.map((claim) => ({
      ...claim,
      decision: "unreviewed" as const,
      effectiveStatement: claim.sourceStatement,
      effectiveTypedValue: null,
      statementOrigin: "evidence_claim" as const,
      rationale: null,
      decidedAt: null,
      decisionEventId: null,
    }));
    if (!sameSixScreenValue(actualStatic, expectedClaims)) {
      throw new Error("Policy Event Card claim reviews do not match the consequential claims in the projection.");
    }
    if (review.lockedEventCard && (
      !sameSixScreenValue(
        review.lockedEventCard.chronology,
        mergePolicyLifecycleStageContributionsIntoChronology(
          projection.chronology,
          review.lockedEventCard.lifecycleStageRevisions ?? [],
        ),
      ) ||
      !sameSixScreenValue(
        review.lockedEventCard.unresolvedRequirements,
        projection.unresolvedRequirements,
      ) ||
      !sameSixScreenValue(
        review.lockedEventCard.conflicts,
        projection.conflicts,
      ) ||
      !sameSixScreenValue(
        review.lockedEventCard.limitations,
        eventCardLimitations({
          claims: review.claimReviews,
          treatmentClockDecision: review.treatmentClockDecision,
          unresolvedRequirements: projection.unresolvedRequirements,
          conflicts: projection.conflicts,
        }),
      ) ||
      (review.treatmentClockDecision.mode === "selected" &&
        !sameSixScreenValue(
          review.lockedEventCard.treatmentClock,
          {
            mode: "selected",
            candidate: {
              ...projection.treatmentClockReview.candidates.find(
                ({ id }) =>
                  id === review.treatmentClockDecision.candidateId,
              )!,
              status: "selected",
              selected: true,
            },
            rationale: review.treatmentClockDecision.rationale,
            decidedAt: review.treatmentClockDecision.decidedAt,
            decisionEventId: review.treatmentClockDecision.decisionEventId,
          },
        )) ||
      (review.treatmentClockDecision.mode === "no_selection" &&
        !sameSixScreenValue(
          review.lockedEventCard.treatmentClock,
          {
            mode: "no_selection",
            candidate: null,
            rationale: review.treatmentClockDecision.rationale,
            decidedAt: review.treatmentClockDecision.decidedAt,
            decisionEventId: review.treatmentClockDecision.decisionEventId,
          },
        ))
    )) {
      throw new Error("Locked Policy Event Card altered its evidence-derived chronology or limitations.");
    }
    if (
      review.lockedEventCard &&
      review.treatmentClockDecision.mode === "selected"
    ) {
      requireSelectedClockUsable(
        review,
        projection,
        review.treatmentClockDecision.candidateId,
      );
    }
  }
  return review;
}

/** Validates the bounded append-only collection stored with a workflow-v1 run. */
export function validatePolicyEventCardReviewCollection(
  reviews: readonly PolicyEventCardReviewState[],
) {
  if (
    reviews.length > SIX_SCREEN_POLICY_EVENT_CARD_MAX_REVISIONS ||
    new Set(reviews.map(({ id }) => id)).size !== reviews.length ||
    serializedBytes(reviews) > SIX_SCREEN_POLICY_EVENT_CARD_REVIEW_MAX_BYTES
  ) {
    throw new Error("Stored Policy Event Card review collection is invalid or exceeds its bounded persistence capacity.");
  }
  const priorById = new Map<string, PolicyEventCardReviewState>();
  for (const review of reviews) {
    validatePolicyEventCardReview({ review });
    if (review.supersedes) {
      const prior = priorById.get(review.supersedes.reviewId);
      if (
        !prior?.lockedEventCard ||
        prior.seriesId !== review.seriesId ||
        prior.ordinal + 1 !== review.ordinal ||
        prior.reviewFingerprint !== review.supersedes.reviewFingerprint ||
        prior.lockedEventCard.snapshotId !==
          review.supersedes.eventCardSnapshotId ||
        prior.lockedEventCard.eventCardFingerprint !==
          review.supersedes.eventCardFingerprint
      ) {
        throw new Error("Stored Policy Event Card supersession lineage is invalid.");
      }
    }
    priorById.set(review.id, review);
  }
  return reviews;
}

export function createPolicyEventCardReference(input: {
  review: PolicyEventCardReviewState;
}) {
  validatePolicyEventCardReview({ review: input.review });
  const eventCard = input.review.lockedEventCard;
  if (!eventCard) {
    throw new Error("A downstream reference requires a locked Policy Event Card.");
  }
  const body: Omit<PolicyEventCardReference, "referenceFingerprint"> = {
    schemaVersion: SIX_SCREEN_EVENT_CARD_REFERENCE_SCHEMA_VERSION,
    eventCardSnapshotId: eventCard.snapshotId,
    eventCardFingerprint: eventCard.eventCardFingerprint,
    reviewId: input.review.id,
    reviewSeriesId: input.review.seriesId,
    reviewOrdinal: input.review.ordinal,
    binding: structuredClone(eventCard.binding),
    reviewedAt: eventCard.reviewedAt,
  };
  return {
    ...body,
    referenceFingerprint: fingerprintSixScreenValue(body),
  };
}

function requireReference(reference: PolicyEventCardReference) {
  if (
    reference.schemaVersion !== SIX_SCREEN_EVENT_CARD_REFERENCE_SCHEMA_VERSION ||
    reference.referenceFingerprint !==
      fingerprintSixScreenValue(referenceBody(reference))
  ) {
    throw new Error("Policy Event Card downstream reference fingerprint is invalid.");
  }
  requireBoundedIdentifier(
    reference.eventCardSnapshotId,
    "Policy Event Card reference snapshot id",
  );
  requireBoundedIdentifier(reference.reviewId, "Policy Event Card reference review id");
  requireBoundedIdentifier(
    reference.reviewSeriesId,
    "Policy Event Card reference series id",
  );
  requireBoundedIdentifier(reference.binding.eventId, "Policy Event Card reference event id");
  requireBoundedIdentifier(
    reference.binding.evidenceSnapshotId,
    "Policy Event Card reference evidence snapshot id",
  );
  requireFingerprint(
    reference.eventCardFingerprint,
    "Policy Event Card reference Event Card fingerprint",
  );
  requireFingerprint(
    reference.binding.identityFingerprint,
    "Policy Event Card reference identity fingerprint",
  );
  requireFingerprint(
    reference.binding.evidenceSnapshotFingerprint,
    "Policy Event Card reference evidence fingerprint",
  );
  requireFingerprint(
    reference.binding.evidenceCollectionFingerprint,
    "Policy Event Card reference collection fingerprint",
  );
  requireFingerprint(
    reference.binding.projectionFingerprint,
    "Policy Event Card reference projection fingerprint",
  );
  requireCanonicalInstant(reference.reviewedAt, "Policy Event Card reference reviewedAt");
  if (
    !Number.isSafeInteger(reference.reviewOrdinal) ||
    reference.reviewOrdinal < 1 ||
    !Number.isSafeInteger(reference.binding.evidenceSnapshotRevision) ||
    reference.binding.evidenceSnapshotRevision < 0
  ) {
    throw new Error("Policy Event Card downstream reference revision is invalid.");
  }
  return reference;
}

/**
 * Compares a downstream binding without mutating either the old Event Card or
 * its evidence snapshot. New unreviewed evidence requests review; only a new
 * locked card supersedes the old reviewed card.
 */
export function assessPolicyEventCardReference(input: {
  reference: PolicyEventCardReference;
  currentProjection: PolicyChronologySourcePanelProjection;
  currentReview: PolicyEventCardReviewState | null;
}): PolicyEventCardReferenceAssessment {
  const reference = requireReference(input.reference);
  const projection = requireProjection(input.currentProjection);
  if (input.currentReview) validatePolicyEventCardReview({
    review: input.currentReview,
    ...(sameBinding(
      input.currentReview.binding,
      bindingFor(projection),
    ) ? { projection } : {}),
  });
  const currentBinding = bindingFor(projection);
  const changes: PolicyEventCardReferenceChange[] = [];
  if (reference.binding.identityFingerprint !== currentBinding.identityFingerprint) {
    changes.push("identity_changed");
  }
  if (reference.binding.evidenceSnapshotId !== currentBinding.evidenceSnapshotId) {
    changes.push("evidence_snapshot_changed");
  }
  if (
    reference.binding.evidenceSnapshotRevision !==
    currentBinding.evidenceSnapshotRevision
  ) changes.push("evidence_snapshot_revision_changed");
  if (
    reference.binding.evidenceSnapshotFingerprint !==
    currentBinding.evidenceSnapshotFingerprint
  ) changes.push("evidence_snapshot_fingerprint_changed");
  if (
    reference.binding.evidenceCollectionFingerprint !==
    currentBinding.evidenceCollectionFingerprint
  ) changes.push("evidence_collection_changed");
  if (
    reference.binding.projectionFingerprint !==
    currentBinding.projectionFingerprint
  ) changes.push("projection_changed");

  const currentCard = input.currentReview?.lockedEventCard ?? null;
  const sameCard = currentCard?.snapshotId === reference.eventCardSnapshotId &&
    currentCard.eventCardFingerprint === reference.eventCardFingerprint;
  if (currentCard && !sameCard) changes.push("event_card_review_changed");
  const uniqueChanges = [...new Set(changes)];
  if (currentCard && !sameCard) {
    return {
      status: "superseded",
      changes: uniqueChanges,
      proposedReviewId: null,
      currentEventCardSnapshotId: currentCard.snapshotId,
    };
  }
  if (uniqueChanges.length || (input.currentReview && !currentCard)) {
    return {
      status: "review_required",
      changes: uniqueChanges,
      proposedReviewId: input.currentReview?.id ?? null,
      currentEventCardSnapshotId: sameCard ? currentCard!.snapshotId : null,
    };
  }
  return {
    status: "current",
    changes: [],
    proposedReviewId: null,
    currentEventCardSnapshotId: currentCard?.snapshotId ??
      reference.eventCardSnapshotId,
  };
}

export function policyEventCardClockForCandidate(input: {
  projection: PolicyChronologySourcePanelProjection;
  candidateId: string;
}): PolicyChronologyClock | null {
  requireProjection(input.projection);
  return structuredClone(
    clockByCandidate(input.projection, input.candidateId)?.clock ?? null,
  );
}
