import {
  fingerprintSixScreenValue,
  sameSixScreenValue,
} from "./canonical";
import {
  requireBoundedIdentifier,
  requireCanonicalInstant,
  requireFingerprint,
  type ConfirmedShock,
} from "./contracts";
import {
  validateCoEventCandidateOccurrence,
  type CoEventCandidateOccurrence,
  type CoEventSearchExecution,
} from "./co-event-execution";
import {
  validateCoEventOccurrenceReview,
  type CoEventDuplicateReview,
  type CoEventOccurrenceReview,
} from "./co-event-occurrence-review";
import {
  createPolicyEventCardReference,
  validatePolicyEventCardReview,
  type PolicyEventCardReference,
  type PolicyEventCardReviewState,
} from "./policy-event-card-review";

export const SIX_SCREEN_COEVENT_POLICY_LIFECYCLE_HANDOFF_VERSION =
  "screen-04-policy-lifecycle-handoff-v1" as const;
export const SIX_SCREEN_COEVENT_MAX_POLICY_LIFECYCLE_HANDOFFS = 32;
export const SIX_SCREEN_COEVENT_POLICY_LIFECYCLE_HANDOFF_MAX_BYTES = 96_000;

const POLICY_LIFECYCLE_HANDOFF_BOUNDARY =
  "This researcher-owned handoff asks Screen 2 to review a possible stage of the already confirmed focal policy. It preserves the source occurrence and prior Event Card, does not verify the stage relationship, does not create an independent co-event or assess comparison-specific causal relevance, and leaves downstream design artifacts out of date until a new Event Card is reviewed and locked.";

export const COEVENT_POLICY_LIFECYCLE_STAGE_KINDS = [
  "implementation_delay",
  "litigation_or_court_order",
  "amendment",
  "suspension",
  "repeal",
  "enforcement",
  "other",
] as const;

export type CoEventPolicyLifecycleStageKind =
  typeof COEVENT_POLICY_LIFECYCLE_STAGE_KINDS[number];

export type CoEventPolicyLifecycleHandoff = {
  schemaVersion: typeof SIX_SCREEN_COEVENT_POLICY_LIFECYCLE_HANDOFF_VERSION;
  id: string;
  ordinal: number;
  candidateReference: {
    candidateId: string;
    candidateFingerprint: string;
    providerId: CoEventCandidateOccurrence["providerId"];
  };
  occurrenceReviewReference: {
    reviewId: string;
    reviewFingerprint: string;
    decision: "retained" | "corrected";
  };
  sourceExecutionReference: {
    executionSnapshotId: string;
    executionFingerprint: string;
    matrixSnapshotId: string;
    matrixFingerprint: string;
  };
  focalPolicyReference: {
    confirmedShockId: string;
    identityFingerprint: string;
    officialTitle: string;
    eventCardReference: PolicyEventCardReference;
  };
  proposedStage: {
    kind: CoEventPolicyLifecycleStageKind;
    status: "researcher_proposed_for_review";
  };
  destination: {
    screen: 2;
    purpose: "event_card_revision_review";
    policyEventCardReviewId: string;
    policyEventCardReviewSeriesId: string;
    policyEventCardReviewOrdinal: number;
  };
  rationale: string;
  actor: "researcher";
  routedAt: string;
  preservesSourceOccurrence: true;
  preservesPriorEventCard: true;
  independentEventClassification: "not_assessed";
  relationToComparison: {
    status: "not_assessed";
    reason: "genuine_intelligence_path_unverified";
  };
  claimBoundary: typeof POLICY_LIFECYCLE_HANDOFF_BOUNDARY;
  handoffFingerprint: string;
};

type HandoffBody = Omit<
  CoEventPolicyLifecycleHandoff,
  "handoffFingerprint"
>;

function bytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function requireText(value: string, label: string, max = 2_000) {
  if (!value || value !== value.trim() || value.length > max) {
    throw new Error(
      `${label} must be non-empty canonical text of at most ${max} characters.`,
    );
  }
  return value;
}

function handoffBody(handoff: CoEventPolicyLifecycleHandoff) {
  const { handoffFingerprint: _fingerprint, ...body } = handoff;
  return body;
}

function latestDuplicateDecisionsAt(
  reviews: readonly CoEventDuplicateReview[],
  candidateId: string,
  at: string,
) {
  const latestByPair = new Map<string, CoEventDuplicateReview>();
  for (const review of reviews) {
    if (
      review.reviewedAt <= at &&
      review.members.some((member) => member.candidateId === candidateId)
    ) latestByPair.set(review.pairFingerprint, review);
  }
  return [...latestByPair.values()];
}

function requireCanonicalDuplicateMember(input: {
  candidateId: string;
  duplicateReviews: readonly CoEventDuplicateReview[];
  routedAt: string;
}) {
  const noncanonical = latestDuplicateDecisionsAt(
    input.duplicateReviews,
    input.candidateId,
    input.routedAt,
  ).find((review) =>
    review.decision === "same_event_representation" &&
    review.canonicalCandidateId !== input.candidateId
  );
  if (noncanonical) {
    throw new Error(
      "Route the canonical Screen 4 occurrence representation to Screen 2.",
    );
  }
}

export function createCoEventPolicyLifecycleHandoff(input: {
  id: string;
  ordinal: number;
  candidate: CoEventCandidateOccurrence;
  occurrenceReview: CoEventOccurrenceReview;
  duplicateReviews: readonly CoEventDuplicateReview[];
  sourceExecution: CoEventSearchExecution;
  confirmedShock: ConfirmedShock;
  priorEventCardReview: PolicyEventCardReviewState;
  targetEventCardReview: PolicyEventCardReviewState;
  stageKind: CoEventPolicyLifecycleStageKind;
  rationale: string;
  actor: "researcher_ui" | "model" | "system";
  routedAt: string;
}) {
  if (input.actor !== "researcher_ui") {
    throw new Error(
      "Only an explicit researcher UI action can route a possible policy stage to Screen 2.",
    );
  }
  requireBoundedIdentifier(input.id, "Screen 4 policy-lifecycle handoff id");
  requireCanonicalInstant(input.routedAt, "Screen 4 policy-lifecycle handoff time");
  const rationale = requireText(
    input.rationale,
    "Screen 4 policy-lifecycle handoff rationale",
  );
  if (!COEVENT_POLICY_LIFECYCLE_STAGE_KINDS.includes(input.stageKind)) {
    throw new Error("Screen 4 policy-lifecycle stage kind is invalid.");
  }
  validateCoEventCandidateOccurrence(input.candidate);
  validateCoEventOccurrenceReview(input.occurrenceReview, input.candidate);
  if (![
    "retained",
    "corrected",
  ].includes(input.occurrenceReview.decision)) {
    throw new Error(
      "A possible policy-stage handoff requires a retained or corrected occurrence review.",
    );
  }
  if (
    !input.sourceExecution.candidateOccurrenceIds.includes(input.candidate.id) ||
    input.sourceExecution.recordedAt > input.routedAt ||
    input.occurrenceReview.reviewedAt > input.routedAt
  ) {
    throw new Error(
      "The policy-stage handoff does not match its reviewed Screen 4 execution evidence.",
    );
  }
  requireCanonicalDuplicateMember({
    candidateId: input.candidate.id,
    duplicateReviews: input.duplicateReviews,
    routedAt: input.routedAt,
  });
  validatePolicyEventCardReview({ review: input.priorEventCardReview });
  validatePolicyEventCardReview({ review: input.targetEventCardReview });
  if (!input.priorEventCardReview.lockedEventCard) {
    throw new Error(
      "A policy-stage handoff requires the prior locked Event Card to remain immutable.",
    );
  }
  const eventCardReference = createPolicyEventCardReference({
    review: input.priorEventCardReview,
  });
  const target = input.targetEventCardReview;
  if (
    target.status !== "in_review" || target.lockedEventCard !== null ||
    target.createdAt !== input.routedAt ||
    target.seriesId !== input.priorEventCardReview.seriesId ||
    target.ordinal !== input.priorEventCardReview.ordinal + 1 ||
    target.supersedes?.reviewId !== input.priorEventCardReview.id ||
    target.supersedes.eventCardSnapshotId !==
      eventCardReference.eventCardSnapshotId ||
    target.supersedes.eventCardFingerprint !==
      eventCardReference.eventCardFingerprint ||
    !sameSixScreenValue(target.binding, input.priorEventCardReview.binding)
  ) {
    throw new Error(
      "The policy-stage handoff does not open the required source-bound Event Card revision.",
    );
  }
  if (
    input.confirmedShock.id !== eventCardReference.binding.eventId ||
    input.confirmedShock.identityFingerprint !==
      eventCardReference.binding.identityFingerprint
  ) {
    throw new Error(
      "The policy-stage handoff does not match the current confirmed focal policy.",
    );
  }
  const body: HandoffBody = {
    schemaVersion: SIX_SCREEN_COEVENT_POLICY_LIFECYCLE_HANDOFF_VERSION,
    id: input.id,
    ordinal: input.ordinal,
    candidateReference: {
      candidateId: input.candidate.id,
      candidateFingerprint: input.candidate.candidateFingerprint,
      providerId: input.candidate.providerId,
    },
    occurrenceReviewReference: {
      reviewId: input.occurrenceReview.id,
      reviewFingerprint: input.occurrenceReview.reviewFingerprint,
      decision: input.occurrenceReview.decision as "retained" | "corrected",
    },
    sourceExecutionReference: {
      executionSnapshotId: input.sourceExecution.snapshotId,
      executionFingerprint: input.sourceExecution.executionFingerprint,
      matrixSnapshotId: input.sourceExecution.matrixSnapshotId,
      matrixFingerprint: input.sourceExecution.matrixFingerprint,
    },
    focalPolicyReference: {
      confirmedShockId: input.confirmedShock.id,
      identityFingerprint: input.confirmedShock.identityFingerprint,
      officialTitle: input.confirmedShock.officialTitle,
      eventCardReference,
    },
    proposedStage: {
      kind: input.stageKind,
      status: "researcher_proposed_for_review",
    },
    destination: {
      screen: 2,
      purpose: "event_card_revision_review",
      policyEventCardReviewId: target.id,
      policyEventCardReviewSeriesId: target.seriesId,
      policyEventCardReviewOrdinal: target.ordinal,
    },
    rationale,
    actor: "researcher",
    routedAt: input.routedAt,
    preservesSourceOccurrence: true,
    preservesPriorEventCard: true,
    independentEventClassification: "not_assessed",
    relationToComparison: {
      status: "not_assessed",
      reason: "genuine_intelligence_path_unverified",
    },
    claimBoundary: POLICY_LIFECYCLE_HANDOFF_BOUNDARY,
  };
  const handoff = {
    ...body,
    handoffFingerprint: fingerprintSixScreenValue(body),
  };
  validateCoEventPolicyLifecycleHandoff(handoff, {
    candidate: input.candidate,
    occurrenceReview: input.occurrenceReview,
    duplicateReviews: input.duplicateReviews,
    sourceExecution: input.sourceExecution,
    priorEventCardReview: input.priorEventCardReview,
    targetEventCardReview: target,
  });
  return handoff;
}

export function validateCoEventPolicyLifecycleHandoff(
  handoff: CoEventPolicyLifecycleHandoff,
  references: {
    candidate: CoEventCandidateOccurrence;
    occurrenceReview: CoEventOccurrenceReview;
    duplicateReviews: readonly CoEventDuplicateReview[];
    sourceExecution: CoEventSearchExecution;
    priorEventCardReview: PolicyEventCardReviewState;
    targetEventCardReview: PolicyEventCardReviewState;
  },
) {
  if (
    handoff.schemaVersion !==
      SIX_SCREEN_COEVENT_POLICY_LIFECYCLE_HANDOFF_VERSION ||
    handoff.handoffFingerprint !==
      fingerprintSixScreenValue(handoffBody(handoff)) ||
    handoff.actor !== "researcher" ||
    handoff.preservesSourceOccurrence !== true ||
    handoff.preservesPriorEventCard !== true ||
    handoff.independentEventClassification !== "not_assessed" ||
    handoff.relationToComparison.status !== "not_assessed" ||
    handoff.relationToComparison.reason !==
      "genuine_intelligence_path_unverified" ||
    handoff.claimBoundary !== POLICY_LIFECYCLE_HANDOFF_BOUNDARY ||
    handoff.proposedStage.status !== "researcher_proposed_for_review" ||
    !COEVENT_POLICY_LIFECYCLE_STAGE_KINDS.includes(
      handoff.proposedStage.kind,
    ) ||
    handoff.destination.screen !== 2 ||
    handoff.destination.purpose !== "event_card_revision_review" ||
    !Number.isSafeInteger(handoff.ordinal) || handoff.ordinal < 1
  ) throw new Error("Screen 4 policy-lifecycle handoff is invalid or changed.");
  requireBoundedIdentifier(handoff.id, "Screen 4 policy-lifecycle handoff id");
  requireFingerprint(
    handoff.handoffFingerprint,
    "Screen 4 policy-lifecycle handoff fingerprint",
  );
  requireCanonicalInstant(handoff.routedAt, "Screen 4 policy-lifecycle handoff time");
  requireText(handoff.rationale, "Screen 4 policy-lifecycle handoff rationale");
  requireBoundedIdentifier(
    handoff.candidateReference.candidateId,
    "Screen 4 policy-lifecycle candidate id",
  );
  requireFingerprint(
    handoff.candidateReference.candidateFingerprint,
    "Screen 4 policy-lifecycle candidate fingerprint",
  );
  requireBoundedIdentifier(
    handoff.occurrenceReviewReference.reviewId,
    "Screen 4 policy-lifecycle occurrence review id",
  );
  requireFingerprint(
    handoff.occurrenceReviewReference.reviewFingerprint,
    "Screen 4 policy-lifecycle occurrence review fingerprint",
  );
  requireBoundedIdentifier(
    handoff.sourceExecutionReference.executionSnapshotId,
    "Screen 4 policy-lifecycle execution id",
  );
  requireFingerprint(
    handoff.sourceExecutionReference.executionFingerprint,
    "Screen 4 policy-lifecycle execution fingerprint",
  );
  requireBoundedIdentifier(
    handoff.destination.policyEventCardReviewId,
    "Screen 2 destination review id",
  );
  requireBoundedIdentifier(
    handoff.destination.policyEventCardReviewSeriesId,
    "Screen 2 destination review series id",
  );
  requireFingerprint(
    handoff.focalPolicyReference.identityFingerprint,
    "Policy-lifecycle focal identity fingerprint",
  );
  requireText(
    handoff.focalPolicyReference.officialTitle,
    "Policy-lifecycle focal policy title",
    1_000,
  );
  const expectedEventCardReference = createPolicyEventCardReference({
    review: references.priorEventCardReview,
  });
  if (
    handoff.candidateReference.candidateId !== references.candidate.id ||
    handoff.candidateReference.candidateFingerprint !==
      references.candidate.candidateFingerprint ||
    handoff.candidateReference.providerId !== references.candidate.providerId ||
    handoff.occurrenceReviewReference.reviewId !==
      references.occurrenceReview.id ||
    handoff.occurrenceReviewReference.reviewFingerprint !==
      references.occurrenceReview.reviewFingerprint ||
    handoff.occurrenceReviewReference.decision !==
      references.occurrenceReview.decision ||
    !["retained", "corrected"].includes(
      references.occurrenceReview.decision,
    ) ||
    handoff.sourceExecutionReference.executionSnapshotId !==
      references.sourceExecution.snapshotId ||
    handoff.sourceExecutionReference.executionFingerprint !==
      references.sourceExecution.executionFingerprint ||
    handoff.sourceExecutionReference.matrixSnapshotId !==
      references.sourceExecution.matrixSnapshotId ||
    handoff.sourceExecutionReference.matrixFingerprint !==
      references.sourceExecution.matrixFingerprint ||
    !references.sourceExecution.candidateOccurrenceIds.includes(
      references.candidate.id,
    ) ||
    !sameSixScreenValue(
      handoff.focalPolicyReference.eventCardReference,
      expectedEventCardReference,
    ) ||
    handoff.focalPolicyReference.confirmedShockId !==
      expectedEventCardReference.binding.eventId ||
    handoff.focalPolicyReference.identityFingerprint !==
      expectedEventCardReference.binding.identityFingerprint ||
    handoff.destination.policyEventCardReviewId !==
      references.targetEventCardReview.id ||
    handoff.destination.policyEventCardReviewSeriesId !==
      references.targetEventCardReview.seriesId ||
    handoff.destination.policyEventCardReviewOrdinal !==
      references.targetEventCardReview.ordinal ||
    references.targetEventCardReview.createdAt !== handoff.routedAt ||
    references.targetEventCardReview.supersedes?.reviewId !==
      references.priorEventCardReview.id ||
    references.targetEventCardReview.supersedes.eventCardSnapshotId !==
      expectedEventCardReference.eventCardSnapshotId ||
    references.targetEventCardReview.supersedes.eventCardFingerprint !==
      expectedEventCardReference.eventCardFingerprint ||
    handoff.routedAt < references.candidate.recordedAt ||
    handoff.routedAt < references.occurrenceReview.reviewedAt ||
    handoff.routedAt < references.sourceExecution.recordedAt
  ) throw new Error("Screen 4 policy-lifecycle handoff lineage is invalid.");
  requireCanonicalDuplicateMember({
    candidateId: references.candidate.id,
    duplicateReviews: references.duplicateReviews,
    routedAt: handoff.routedAt,
  });
  return handoff;
}

export function validateCoEventPolicyLifecycleHandoffCollection(input: {
  candidates: readonly CoEventCandidateOccurrence[];
  occurrenceReviews: readonly CoEventOccurrenceReview[];
  duplicateReviews: readonly CoEventDuplicateReview[];
  executions: readonly CoEventSearchExecution[];
  policyEventCardReviews: readonly PolicyEventCardReviewState[];
  handoffs: readonly CoEventPolicyLifecycleHandoff[];
}) {
  if (
    input.handoffs.length > SIX_SCREEN_COEVENT_MAX_POLICY_LIFECYCLE_HANDOFFS ||
    bytes(input.handoffs) >
      SIX_SCREEN_COEVENT_POLICY_LIFECYCLE_HANDOFF_MAX_BYTES ||
    new Set(input.handoffs.map(({ id }) => id)).size !== input.handoffs.length
  ) throw new Error("Stored policy-lifecycle handoffs exceed bounded capacity.");
  const candidateMap = new Map(input.candidates.map((candidate) => [
    candidate.id,
    candidate,
  ]));
  const occurrenceReviewMap = new Map(input.occurrenceReviews.map((review) => [
    review.id,
    review,
  ]));
  const executionMap = new Map(input.executions.map((execution) => [
    execution.snapshotId,
    execution,
  ]));
  const policyReviewMap = new Map(input.policyEventCardReviews.map((review) => [
    review.id,
    review,
  ]));
  const routedCandidateCards = new Set<string>();
  const destinationReviewIds = new Set<string>();
  let previousAt: string | null = null;
  input.handoffs.forEach((handoff, index) => {
    const candidate = candidateMap.get(handoff.candidateReference.candidateId);
    const occurrenceReview = occurrenceReviewMap.get(
      handoff.occurrenceReviewReference.reviewId,
    );
    const sourceExecution = executionMap.get(
      handoff.sourceExecutionReference.executionSnapshotId,
    );
    const priorEventCardReview = policyReviewMap.get(
      handoff.focalPolicyReference.eventCardReference.reviewId,
    );
    const targetEventCardReview = policyReviewMap.get(
      handoff.destination.policyEventCardReviewId,
    );
    if (
      !candidate || !occurrenceReview || !sourceExecution ||
      !priorEventCardReview || !targetEventCardReview ||
      handoff.ordinal !== index + 1 ||
      (previousAt !== null && handoff.routedAt < previousAt)
    ) throw new Error("Stored policy-lifecycle handoff references are invalid.");
    const routeKey = `${candidate.id}\u0000${handoff.focalPolicyReference.eventCardReference.eventCardSnapshotId}`;
    if (
      routedCandidateCards.has(routeKey) ||
      destinationReviewIds.has(targetEventCardReview.id)
    ) throw new Error("Stored policy-lifecycle handoff was duplicated.");
    validateCoEventPolicyLifecycleHandoff(handoff, {
      candidate,
      occurrenceReview,
      duplicateReviews: input.duplicateReviews,
      sourceExecution,
      priorEventCardReview,
      targetEventCardReview,
    });
    routedCandidateCards.add(routeKey);
    destinationReviewIds.add(targetEventCardReview.id);
    previousAt = handoff.routedAt;
  });
  return input.handoffs;
}
