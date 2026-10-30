import {
  fingerprintSixScreenValue,
  sameSixScreenValue,
} from "./canonical";
import {
  requireBoundedIdentifier,
  requireCanonicalInstant,
  requireFingerprint,
} from "./contracts";
import {
  validateCausalDesignDecision,
  type CausalDesignDecision,
  type CausalDesignSet,
} from "./causal-comparison";
import {
  validateCoEventCandidateOccurrence,
  type CoEventCandidateOccurrence,
} from "./co-event-execution";
import {
  validateCoEventOccurrenceReview,
  type CoEventOccurrenceReview,
} from "./co-event-occurrence-review";
import {
  validateCoEventSearchMatrix,
  type CoEventSearchMatrix,
} from "./co-event-search";

export const SIX_SCREEN_COEVENT_RELATION_REVIEW_VERSION =
  "screen-04-coevent-relation-review-v1" as const;
export const SIX_SCREEN_COEVENT_MAX_RELATION_REVIEWS = 200;
export const SIX_SCREEN_COEVENT_RELATION_REVIEW_MAX_BYTES = 384_000;

export const COEVENT_RELATION_CATEGORIES = [
  "independent_concurrent_event",
  "same_policy_package",
  "downstream_response",
  "spillover_or_comparison_contamination",
  "measurement_or_sample_change",
  "temporal_coincidence_no_established_relevance",
  "unresolved_relationship",
] as const;

export type CoEventRelationCategory =
  (typeof COEVENT_RELATION_CATEGORIES)[number];

export type CoEventRelationReviewDecision = {
  mode: "retained" | "rejected" | "deferred";
  category: CoEventRelationCategory;
  priority: "high" | "medium" | "low" | "unresolved";
  affectedGroupRoles: Array<"treatment" | "comparison" | "both" | "unknown">;
  plausibleOutcomePathway: string;
  differentialRelevance: string;
  assumptions: string[];
  unresolvedQuestions: string[];
  proposedResponses: string[];
};

const RELATION_REVIEW_BOUNDARY =
  "This comparison-specific relation is an explicit researcher judgment, not a model finding or occurrence fact. It does not establish confounding, mediation, spillover, exposure, sample overlap, or a valid adjustment variable. Rejected and deferred judgments remain auditable, and proposed responses require separate design review before they change the estimand, population, comparison, or analysis.";

export type CoEventRelationReview = {
  schemaVersion: typeof SIX_SCREEN_COEVENT_RELATION_REVIEW_VERSION;
  id: string;
  ordinal: number;
  binding: {
    matrixSnapshotId: string;
    matrixFingerprint: string;
    matrixMode: CoEventSearchMatrix["mode"];
    designDecisionSnapshotId: string;
    designDecisionFingerprint: string;
    designDecision: CausalDesignDecision["decision"];
    candidateId: string;
    candidateFingerprint: string;
    occurrenceReviewId: string;
    occurrenceReviewFingerprint: string;
  };
  previousReview: {
    reviewId: string;
    reviewFingerprint: string;
  } | null;
  decision: CoEventRelationReviewDecision["mode"];
  relation: Omit<CoEventRelationReviewDecision, "mode">;
  rationale: string;
  actor: "researcher";
  origin: "researcher_authored";
  semanticAssistance: {
    status: "not_used";
    reason: "genuine_intelligence_path_unverified";
  };
  comparisonSpecific: true;
  reviewedAt: string;
  claimBoundary: typeof RELATION_REVIEW_BOUNDARY;
  reviewFingerprint: string;
};

type ReviewBody = Omit<CoEventRelationReview, "reviewFingerprint">;

function bytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function reviewBody(review: CoEventRelationReview): ReviewBody {
  const { reviewFingerprint: _fingerprint, ...body } = review;
  return body;
}

function requireText(value: string, label: string, max = 4_000) {
  if (!value || value !== value.trim() || value.length > max) {
    throw new Error(
      `${label} must be non-empty canonical text of at most ${max} characters.`,
    );
  }
  return value;
}

function requireUniqueTextList(
  values: readonly string[],
  label: string,
  maxEntries: number,
) {
  if (
    values.length > maxEntries || new Set(values).size !== values.length
  ) throw new Error(`${label} must be a bounded unique list.`);
  values.forEach((value) => requireText(value, label, 1_000));
}

function requireRelationDecision(decision: CoEventRelationReviewDecision) {
  if (!(["retained", "rejected", "deferred"] as const).includes(
    decision.mode,
  )) throw new Error("Screen 4 relation decision is invalid.");
  if (!COEVENT_RELATION_CATEGORIES.includes(decision.category)) {
    throw new Error("Screen 4 relation category is invalid.");
  }
  if (!(["high", "medium", "low", "unresolved"] as const).includes(
    decision.priority,
  )) throw new Error("Screen 4 relation priority is invalid.");
  if (
    !decision.affectedGroupRoles.length ||
    decision.affectedGroupRoles.length > 4 ||
    new Set(decision.affectedGroupRoles).size !==
      decision.affectedGroupRoles.length ||
    decision.affectedGroupRoles.some((role) =>
      !(["treatment", "comparison", "both", "unknown"] as const).includes(
        role,
      )
    )
  ) throw new Error("Screen 4 affected comparison roles are invalid.");
  requireText(
    decision.plausibleOutcomePathway,
    "Screen 4 plausible outcome pathway",
  );
  requireText(
    decision.differentialRelevance,
    "Screen 4 differential relevance",
  );
  requireUniqueTextList(decision.assumptions, "Screen 4 relation assumptions", 16);
  requireUniqueTextList(
    decision.unresolvedQuestions,
    "Screen 4 unresolved relation questions",
    16,
  );
  requireUniqueTextList(
    decision.proposedResponses,
    "Screen 4 proposed responses",
    16,
  );
  if (
    decision.mode === "retained" && !decision.proposedResponses.length
  ) {
    throw new Error(
      "A retained Screen 4 relation needs at least one proposed response.",
    );
  }
  return decision;
}

function expectedBinding(input: {
  designSet: CausalDesignSet;
  matrix: CoEventSearchMatrix;
  designDecision: CausalDesignDecision;
  candidate: CoEventCandidateOccurrence;
  occurrenceReview: CoEventOccurrenceReview;
}): CoEventRelationReview["binding"] {
  validateCausalDesignDecision(input.designDecision, input.designSet);
  validateCoEventSearchMatrix(
    input.matrix,
    input.designSet,
    input.designDecision,
  );
  validateCoEventCandidateOccurrence(input.candidate);
  validateCoEventOccurrenceReview(input.occurrenceReview, input.candidate);
  if (
    input.occurrenceReview.decision !== "retained" &&
    input.occurrenceReview.decision !== "corrected"
  ) {
    throw new Error(
      "Screen 4 relation review requires retained occurrence evidence.",
    );
  }
  if (
    input.matrix.binding.designDecisionSnapshotId !==
      input.designDecision.snapshotId ||
    input.matrix.binding.designDecisionFingerprint !==
      input.designDecision.decisionFingerprint
  ) throw new Error("Screen 4 relation review lost its comparison binding.");
  return {
    matrixSnapshotId: input.matrix.snapshotId,
    matrixFingerprint: input.matrix.matrixFingerprint,
    matrixMode: input.matrix.mode,
    designDecisionSnapshotId: input.designDecision.snapshotId,
    designDecisionFingerprint: input.designDecision.decisionFingerprint,
    designDecision: input.designDecision.decision,
    candidateId: input.candidate.id,
    candidateFingerprint: input.candidate.candidateFingerprint,
    occurrenceReviewId: input.occurrenceReview.id,
    occurrenceReviewFingerprint: input.occurrenceReview.reviewFingerprint,
  };
}

export function createCoEventRelationReview(input: {
  reviewId: string;
  designSet: CausalDesignSet;
  matrix: CoEventSearchMatrix;
  designDecision: CausalDesignDecision;
  candidate: CoEventCandidateOccurrence;
  occurrenceReview: CoEventOccurrenceReview;
  previousReview: CoEventRelationReview | null;
  decision: CoEventRelationReviewDecision;
  rationale: string;
  actor: "researcher_ui" | "model" | "system";
  reviewedAt: string;
}): CoEventRelationReview {
  requireBoundedIdentifier(input.reviewId, "Screen 4 relation review id");
  requireCanonicalInstant(input.reviewedAt, "Screen 4 relation review time");
  requireText(input.rationale, "Screen 4 relation review rationale");
  if (input.actor !== "researcher_ui") {
    throw new Error(
      "Only an explicit researcher UI action can record a Screen 4 relation judgment.",
    );
  }
  const binding = expectedBinding(input);
  requireRelationDecision(input.decision);
  if (input.previousReview) {
    validateCoEventRelationReview(input.previousReview, {
      matrix: input.matrix,
      designSet: input.designSet,
      designDecision: input.designDecision,
      candidate: input.candidate,
      occurrenceReview: input.occurrenceReview,
      allowPriorOccurrenceReview: true,
    });
  }
  const {
    mode: decision,
    ...relation
  } = structuredClone(input.decision);
  const body: ReviewBody = {
    schemaVersion: SIX_SCREEN_COEVENT_RELATION_REVIEW_VERSION,
    id: input.reviewId,
    ordinal: (input.previousReview?.ordinal ?? 0) + 1,
    binding,
    previousReview: input.previousReview
      ? {
          reviewId: input.previousReview.id,
          reviewFingerprint: input.previousReview.reviewFingerprint,
        }
      : null,
    decision,
    relation,
    rationale: input.rationale,
    actor: "researcher",
    origin: "researcher_authored",
    semanticAssistance: {
      status: "not_used",
      reason: "genuine_intelligence_path_unverified",
    },
    comparisonSpecific: true,
    reviewedAt: input.reviewedAt,
    claimBoundary: RELATION_REVIEW_BOUNDARY,
  };
  const review = {
    ...body,
    reviewFingerprint: fingerprintSixScreenValue(body),
  };
  return validateCoEventRelationReview(review, input);
}

export function validateCoEventRelationReview(
  review: CoEventRelationReview,
  context: {
    matrix: CoEventSearchMatrix;
    designSet: CausalDesignSet;
    designDecision: CausalDesignDecision;
    candidate: CoEventCandidateOccurrence;
    occurrenceReview: CoEventOccurrenceReview;
    expectedPrevious?: CoEventRelationReview | null;
    allowPriorOccurrenceReview?: boolean;
  },
) {
  const expected = expectedBinding(context);
  const reviewDecision: CoEventRelationReviewDecision = {
    mode: review.decision,
    ...structuredClone(review.relation),
  };
  requireRelationDecision(reviewDecision);
  if (
    review.schemaVersion !== SIX_SCREEN_COEVENT_RELATION_REVIEW_VERSION ||
    review.reviewFingerprint !== fingerprintSixScreenValue(reviewBody(review)) ||
    review.actor !== "researcher" ||
    review.origin !== "researcher_authored" ||
    review.semanticAssistance.status !== "not_used" ||
    review.semanticAssistance.reason !==
      "genuine_intelligence_path_unverified" ||
    review.comparisonSpecific !== true ||
    review.claimBoundary !== RELATION_REVIEW_BOUNDARY ||
    !Number.isSafeInteger(review.ordinal) || review.ordinal < 1
  ) throw new Error("Screen 4 relation review is invalid or changed.");
  requireBoundedIdentifier(review.id, "Screen 4 relation review id");
  requireFingerprint(review.reviewFingerprint, "Screen 4 relation fingerprint");
  requireCanonicalInstant(review.reviewedAt, "Screen 4 relation review time");
  requireText(review.rationale, "Screen 4 relation review rationale");
  const comparableBinding = context.allowPriorOccurrenceReview
    ? {
        ...review.binding,
        occurrenceReviewId: expected.occurrenceReviewId,
        occurrenceReviewFingerprint: expected.occurrenceReviewFingerprint,
      }
    : review.binding;
  if (!sameSixScreenValue(comparableBinding, expected)) {
    throw new Error("Screen 4 relation review does not match its evidence binding.");
  }
  if (
    !context.allowPriorOccurrenceReview &&
    review.reviewedAt < context.occurrenceReview.reviewedAt
  ) {
    throw new Error("Screen 4 relation review predates occurrence review.");
  }
  if (review.previousReview) {
    requireBoundedIdentifier(
      review.previousReview.reviewId,
      "Screen 4 previous relation review id",
    );
    requireFingerprint(
      review.previousReview.reviewFingerprint,
      "Screen 4 previous relation review fingerprint",
    );
    if (review.previousReview.reviewId === review.id || review.ordinal < 2) {
      throw new Error("Screen 4 relation review lineage is invalid.");
    }
  } else if (review.ordinal !== 1) {
    throw new Error("The first Screen 4 relation review must have ordinal one.");
  }
  if (context.expectedPrevious !== undefined) {
    if (context.expectedPrevious === null) {
      if (review.previousReview !== null || review.ordinal !== 1) {
        throw new Error("Screen 4 relation review has an unexpected predecessor.");
      }
    } else if (
      review.previousReview?.reviewId !== context.expectedPrevious.id ||
      review.previousReview.reviewFingerprint !==
        context.expectedPrevious.reviewFingerprint ||
      review.ordinal !== context.expectedPrevious.ordinal + 1 ||
      review.reviewedAt < context.expectedPrevious.reviewedAt
    ) {
      throw new Error("Screen 4 relation review predecessor is invalid.");
    }
  }
  if (bytes(review) > SIX_SCREEN_COEVENT_RELATION_REVIEW_MAX_BYTES) {
    throw new Error("Screen 4 relation review exceeds its byte budget.");
  }
  return review;
}

export function latestCoEventRelationReview(
  reviews: readonly CoEventRelationReview[],
  candidateId: string,
) {
  return [...reviews].reverse().find((review) =>
    review.binding.candidateId === candidateId
  ) ?? null;
}

export function validateCoEventRelationReviewCollection(input: {
  matrices: readonly CoEventSearchMatrix[];
  designSets: readonly CausalDesignSet[];
  designDecisions: readonly CausalDesignDecision[];
  candidates: readonly CoEventCandidateOccurrence[];
  occurrenceReviews: readonly CoEventOccurrenceReview[];
  relationReviews: readonly CoEventRelationReview[];
}) {
  if (input.relationReviews.length > SIX_SCREEN_COEVENT_MAX_RELATION_REVIEWS) {
    throw new Error("Screen 4 relation-review history exceeds its bounded capacity.");
  }
  const matrixMap = new Map(input.matrices.map((matrix) =>
    [matrix.snapshotId, matrix]));
  const designSetMap = new Map(input.designSets.map((designSet) =>
    [designSet.snapshotId, designSet]));
  const decisionMap = new Map(input.designDecisions.map((decision) =>
    [decision.snapshotId, decision]));
  const candidateMap = new Map(input.candidates.map((candidate) =>
    [candidate.id, candidate]));
  const occurrenceMap = new Map(input.occurrenceReviews.map((review) =>
    [review.id, review]));
  const priorByCandidate = new Map<string, CoEventRelationReview>();
  const ids = new Set<string>();
  for (const review of input.relationReviews) {
    if (ids.has(review.id)) {
      throw new Error("Screen 4 relation-review ids must be unique.");
    }
    ids.add(review.id);
    const matrix = matrixMap.get(review.binding.matrixSnapshotId);
    const designDecision = decisionMap.get(
      review.binding.designDecisionSnapshotId,
    );
    const designSet = designDecision
      ? designSetMap.get(designDecision.designSetSnapshotId)
      : undefined;
    const candidate = candidateMap.get(review.binding.candidateId);
    const occurrenceReview = occurrenceMap.get(
      review.binding.occurrenceReviewId,
    );
    if (
      !matrix || !designSet || !designDecision || !candidate ||
      !occurrenceReview
    ) {
      throw new Error("Screen 4 relation review lost an immutable dependency.");
    }
    const previous = priorByCandidate.get(candidate.id) ?? null;
    validateCoEventRelationReview(review, {
      matrix,
      designSet,
      designDecision,
      candidate,
      occurrenceReview,
      expectedPrevious: previous,
    });
    priorByCandidate.set(candidate.id, review);
  }
  if (bytes(input.relationReviews) > 4_000_000) {
    throw new Error("Screen 4 relation-review collection exceeds its byte budget.");
  }
  return input.relationReviews;
}

export function coEventRelationReviewCoverage(input: {
  currentCandidateIds: readonly string[];
  occurrenceReviews: readonly CoEventOccurrenceReview[];
  relationReviews: readonly CoEventRelationReview[];
}) {
  const currentIds = new Set(input.currentCandidateIds);
  const latestOccurrence = new Map<string, CoEventOccurrenceReview>();
  for (const review of input.occurrenceReviews) {
    if (currentIds.has(review.candidateReference.candidateId)) {
      latestOccurrence.set(review.candidateReference.candidateId, review);
    }
  }
  const retainedOccurrenceIds = [...latestOccurrence.entries()]
    .filter(([, review]) =>
      review.decision === "retained" || review.decision === "corrected"
    )
    .map(([candidateId]) => candidateId)
    .sort();
  const latestRelation = new Map<string, CoEventRelationReview>();
  for (const review of input.relationReviews) {
    if (currentIds.has(review.binding.candidateId)) {
      latestRelation.set(review.binding.candidateId, review);
    }
  }
  const assessedCandidateIds = retainedOccurrenceIds.filter((candidateId) => {
    const occurrence = latestOccurrence.get(candidateId)!;
    const relation = latestRelation.get(candidateId);
    return Boolean(
      relation && relation.decision !== "deferred" &&
      relation.binding.occurrenceReviewId === occurrence.id &&
      relation.binding.occurrenceReviewFingerprint ===
        occurrence.reviewFingerprint,
    );
  });
  return {
    retainedOccurrenceIds,
    assessedCandidateIds,
    deferredOrUnassessedCandidateIds: retainedOccurrenceIds.filter(
      (candidateId) => !assessedCandidateIds.includes(candidateId),
    ),
    complete: retainedOccurrenceIds.length === assessedCandidateIds.length,
  };
}
