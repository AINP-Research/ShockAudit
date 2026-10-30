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
  validateCoEventCandidateOccurrence,
  type CoEventCandidateOccurrence,
} from "./co-event-execution";

export const SIX_SCREEN_COEVENT_OCCURRENCE_REVIEW_VERSION =
  "screen-04-coevent-occurrence-review-v1" as const;
export const SIX_SCREEN_COEVENT_DUPLICATE_REVIEW_VERSION =
  "screen-04-coevent-duplicate-review-v1" as const;
export const SIX_SCREEN_COEVENT_MAX_OCCURRENCE_REVIEWS = 200;
export const SIX_SCREEN_COEVENT_MAX_DUPLICATE_REVIEWS = 100;
export const SIX_SCREEN_COEVENT_REVIEW_MAX_BYTES = 192_000;

const PARTIAL_DATE = /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/u;
const CORRECTABLE_DATE_KINDS: ReadonlySet<string> = new Set([
  "event",
  "publication",
  "effective",
  "incident_start",
]);
const CORRECTION_LIMITATION =
  "Researcher-supplied corrections do not alter or upgrade the retained source metadata and require separate evidence before they can be treated as verified occurrence facts.";
const OCCURRENCE_REVIEW_BOUNDARY =
  "This explicit researcher review changes no retained source evidence and assesses no causal relation. A retained record is not a confounder finding; a rejected record remains auditable; and every correction remains researcher-supplied.";
const DUPLICATE_REVIEW_BOUNDARY =
  "This explicit researcher review links two retained occurrence records. A same-event decision deduplicates occurrence identity for display while preserving both source records; distinct stages remain separate. No decision assesses causal relevance or recommends a control.";

export type CoEventOccurrenceCorrectionDraft = {
  title: string | null;
  typedDates: Array<{
    kind: CoEventCandidateOccurrence["typedDates"][number]["kind"];
    value: string;
  }>;
  affectedActivityOrPopulationLabels: string[];
  geographyLabels: string[];
};

export type CoEventOccurrenceCorrection = {
  title: string | null;
  typedDates: Array<{
    kind: CoEventCandidateOccurrence["typedDates"][number]["kind"];
    value: string;
    precision: "day" | "month" | "year";
  }>;
  affectedActivityOrPopulationLabels: string[];
  geographyLabels: string[];
  provenance: "researcher_supplied";
  limitation: typeof CORRECTION_LIMITATION;
};

export type CoEventOccurrenceReviewDecision =
  | { mode: "retained" }
  | { mode: "rejected" }
  | { mode: "deferred" }
  | {
      mode: "corrected";
      correction: CoEventOccurrenceCorrectionDraft;
    };

export type CoEventOccurrenceReview = {
  schemaVersion: typeof SIX_SCREEN_COEVENT_OCCURRENCE_REVIEW_VERSION;
  id: string;
  ordinal: number;
  candidateReference: {
    candidateId: string;
    candidateFingerprint: string;
    providerId: CoEventCandidateOccurrence["providerId"];
  };
  previousReview: {
    reviewId: string;
    reviewFingerprint: string;
  } | null;
  decision: CoEventOccurrenceReviewDecision["mode"];
  correction: CoEventOccurrenceCorrection | null;
  rationale: string;
  actor: "researcher";
  reviewedAt: string;
  reusableAcrossDesignRevisions: true;
  relationAssessment: {
    status: "not_assessed";
    reason: "genuine_intelligence_path_unverified";
  };
  claimBoundary: typeof OCCURRENCE_REVIEW_BOUNDARY;
  reviewFingerprint: string;
};

export type CoEventDuplicateReviewDecision =
  | {
      mode: "same_event_representation";
      canonicalCandidateId: string;
    }
  | { mode: "distinct_stage" }
  | { mode: "different_event" }
  | { mode: "deferred" };

export type CoEventDuplicateReviewMember = {
  candidateId: string;
  candidateFingerprint: string;
  providerId: CoEventCandidateOccurrence["providerId"];
};

export type CoEventDuplicateReview = {
  schemaVersion: typeof SIX_SCREEN_COEVENT_DUPLICATE_REVIEW_VERSION;
  id: string;
  ordinal: number;
  pairFingerprint: string;
  members: [CoEventDuplicateReviewMember, CoEventDuplicateReviewMember];
  previousReview: {
    reviewId: string;
    reviewFingerprint: string;
  } | null;
  decision: CoEventDuplicateReviewDecision["mode"];
  canonicalCandidateId: string | null;
  rationale: string;
  actor: "researcher";
  reviewedAt: string;
  preservesAllCandidateRecords: true;
  reusableAcrossDesignRevisions: true;
  relationAssessment: {
    status: "not_assessed";
    reason: "genuine_intelligence_path_unverified";
  };
  claimBoundary: typeof DUPLICATE_REVIEW_BOUNDARY;
  reviewFingerprint: string;
};

type OccurrenceReviewBody = Omit<
  CoEventOccurrenceReview,
  "reviewFingerprint"
>;
type DuplicateReviewBody = Omit<CoEventDuplicateReview, "reviewFingerprint">;

function bytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requireText(value: string, label: string, max = 2_000) {
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
  values.forEach((value) => requireText(value, label, 500));
}

function requirePartialDate(value: string, label: string) {
  if (!PARTIAL_DATE.test(value)) throw new Error(`${label} must be an ISO date.`);
  const [year, month = "01", day = "01"] = value.split("-");
  const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() + 1 !== Number(month) ||
    date.getUTCDate() !== Number(day)
  ) throw new Error(`${label} must be a valid ISO date.`);
}

function datePrecision(value: string): "day" | "month" | "year" {
  return value.length === 10 ? "day" : value.length === 7 ? "month" : "year";
}

function occurrenceReviewBody(review: CoEventOccurrenceReview) {
  const { reviewFingerprint: _fingerprint, ...body } = review;
  return body;
}

function duplicateReviewBody(review: CoEventDuplicateReview) {
  const { reviewFingerprint: _fingerprint, ...body } = review;
  return body;
}

function candidateReference(
  candidate: CoEventCandidateOccurrence,
): CoEventOccurrenceReview["candidateReference"] {
  validateCoEventCandidateOccurrence(candidate);
  return {
    candidateId: candidate.id,
    candidateFingerprint: candidate.candidateFingerprint,
    providerId: candidate.providerId,
  };
}

function correctionFromDraft(
  draft: CoEventOccurrenceCorrectionDraft,
): CoEventOccurrenceCorrection {
  const title = draft.title === null
    ? null
    : requireText(draft.title, "Screen 4 corrected occurrence title", 1_000);
  if (draft.typedDates.length > 12) {
    throw new Error("Screen 4 occurrence correction has too many dates.");
  }
  const typedDates = draft.typedDates.map((date) => {
    if (!CORRECTABLE_DATE_KINDS.has(date.kind)) {
      throw new Error("Screen 4 corrected occurrence date kind is invalid.");
    }
    requirePartialDate(date.value, "Screen 4 corrected occurrence date");
    return {
      kind: date.kind,
      value: date.value,
      precision: datePrecision(date.value),
    };
  });
  const dateKeys = typedDates.map(({ kind, value }) => `${kind}:${value}`);
  if (new Set(dateKeys).size !== dateKeys.length) {
    throw new Error("Screen 4 corrected occurrence dates must be unique.");
  }
  requireUniqueTextList(
    draft.affectedActivityOrPopulationLabels,
    "Screen 4 corrected affected activity or population",
    24,
  );
  requireUniqueTextList(
    draft.geographyLabels,
    "Screen 4 corrected occurrence geography",
    24,
  );
  if (
    title === null && !typedDates.length &&
    !draft.affectedActivityOrPopulationLabels.length &&
    !draft.geographyLabels.length
  ) throw new Error("A Screen 4 occurrence correction must change at least one field.");
  return {
    title,
    typedDates,
    affectedActivityOrPopulationLabels: [
      ...draft.affectedActivityOrPopulationLabels,
    ],
    geographyLabels: [...draft.geographyLabels],
    provenance: "researcher_supplied",
    limitation: CORRECTION_LIMITATION,
  };
}

function correctionDiffersFromCandidate(
  correction: CoEventOccurrenceCorrection,
  candidate: CoEventCandidateOccurrence,
) {
  if (correction.title !== null && correction.title !== candidate.title) {
    return true;
  }
  if (correction.typedDates.length) {
    const correctionDates = correction.typedDates
      .map(({ kind, value }) => `${kind}\u0000${value}`).sort(compareText);
    const candidateDates = candidate.typedDates
      .map(({ kind, value }) => `${kind}\u0000${value}`).sort(compareText);
    if (!sameSixScreenValue(correctionDates, candidateDates)) return true;
  }
  if (
    correction.affectedActivityOrPopulationLabels.length &&
    !sameSixScreenValue(
      [...correction.affectedActivityOrPopulationLabels].sort(compareText),
      [...candidate.affectedActivityOrPopulation.labels].sort(compareText),
    )
  ) return true;
  if (
    correction.geographyLabels.length &&
    !sameSixScreenValue(
      [...correction.geographyLabels].sort(compareText),
      [...candidate.geography.labels].sort(compareText),
    )
  ) return true;
  return false;
}

export function createCoEventOccurrenceReview(input: {
  reviewId: string;
  candidate: CoEventCandidateOccurrence;
  previousReview: CoEventOccurrenceReview | null;
  decision: CoEventOccurrenceReviewDecision;
  rationale: string;
  actor: "researcher_ui" | "model" | "system";
  reviewedAt: string;
}): CoEventOccurrenceReview {
  requireBoundedIdentifier(input.reviewId, "Screen 4 occurrence review id");
  requireCanonicalInstant(input.reviewedAt, "Screen 4 occurrence review time");
  requireText(input.rationale, "Screen 4 occurrence review rationale");
  if (input.actor !== "researcher_ui") {
    throw new Error(
      "Only an explicit researcher UI action can review Screen 4 occurrence evidence.",
    );
  }
  validateCoEventCandidateOccurrence(input.candidate);
  if (input.previousReview) {
    validateCoEventOccurrenceReview(
      input.previousReview,
      input.candidate,
    );
  }
  const correction = input.decision.mode === "corrected"
    ? correctionFromDraft(input.decision.correction)
    : null;
  if (correction && !correctionDiffersFromCandidate(correction, input.candidate)) {
    throw new Error(
      "A Screen 4 occurrence correction must differ from the retained source metadata.",
    );
  }
  const body: OccurrenceReviewBody = {
    schemaVersion: SIX_SCREEN_COEVENT_OCCURRENCE_REVIEW_VERSION,
    id: input.reviewId,
    ordinal: (input.previousReview?.ordinal ?? 0) + 1,
    candidateReference: candidateReference(input.candidate),
    previousReview: input.previousReview
      ? {
          reviewId: input.previousReview.id,
          reviewFingerprint: input.previousReview.reviewFingerprint,
        }
      : null,
    decision: input.decision.mode,
    correction,
    rationale: input.rationale,
    actor: "researcher",
    reviewedAt: input.reviewedAt,
    reusableAcrossDesignRevisions: true,
    relationAssessment: {
      status: "not_assessed",
      reason: "genuine_intelligence_path_unverified",
    },
    claimBoundary: OCCURRENCE_REVIEW_BOUNDARY,
  };
  const review = {
    ...body,
    reviewFingerprint: fingerprintSixScreenValue(body),
  };
  validateCoEventOccurrenceReview(review, input.candidate, input.previousReview);
  return review;
}

export function validateCoEventOccurrenceReview(
  review: CoEventOccurrenceReview,
  candidate: CoEventCandidateOccurrence,
  expectedPrevious?: CoEventOccurrenceReview | null,
) {
  validateCoEventCandidateOccurrence(candidate);
  if (
    review.schemaVersion !== SIX_SCREEN_COEVENT_OCCURRENCE_REVIEW_VERSION ||
    review.reviewFingerprint !==
      fingerprintSixScreenValue(occurrenceReviewBody(review)) ||
    review.actor !== "researcher" ||
    review.reusableAcrossDesignRevisions !== true ||
    review.relationAssessment.status !== "not_assessed" ||
    review.relationAssessment.reason !==
      "genuine_intelligence_path_unverified" ||
    review.claimBoundary !== OCCURRENCE_REVIEW_BOUNDARY ||
    !["retained", "rejected", "deferred", "corrected"].includes(
      review.decision,
    )
  ) throw new Error("Screen 4 occurrence review is invalid or changed.");
  requireBoundedIdentifier(review.id, "Screen 4 occurrence review id");
  requireFingerprint(
    review.reviewFingerprint,
    "Screen 4 occurrence review fingerprint",
  );
  requireCanonicalInstant(review.reviewedAt, "Screen 4 occurrence review time");
  requireText(review.rationale, "Screen 4 occurrence review rationale");
  if (
    review.candidateReference.candidateId !== candidate.id ||
    review.candidateReference.candidateFingerprint !==
      candidate.candidateFingerprint ||
    review.candidateReference.providerId !== candidate.providerId ||
    review.reviewedAt < candidate.recordedAt ||
    !Number.isSafeInteger(review.ordinal) || review.ordinal < 1
  ) throw new Error("Screen 4 occurrence review does not match its candidate.");
  requireBoundedIdentifier(
    review.candidateReference.candidateId,
    "Screen 4 reviewed candidate id",
  );
  requireFingerprint(
    review.candidateReference.candidateFingerprint,
    "Screen 4 reviewed candidate fingerprint",
  );
  if (review.previousReview) {
    requireBoundedIdentifier(
      review.previousReview.reviewId,
      "Screen 4 previous occurrence review id",
    );
    requireFingerprint(
      review.previousReview.reviewFingerprint,
      "Screen 4 previous occurrence review fingerprint",
    );
    if (review.ordinal < 2 || review.previousReview.reviewId === review.id) {
      throw new Error("Screen 4 occurrence review lineage is invalid.");
    }
  } else if (review.ordinal !== 1) {
    throw new Error("Screen 4 first occurrence review must have ordinal one.");
  }
  if (expectedPrevious !== undefined) {
    if (expectedPrevious === null) {
      if (review.previousReview !== null || review.ordinal !== 1) {
        throw new Error("Screen 4 occurrence review has an unexpected predecessor.");
      }
    } else if (
      review.previousReview?.reviewId !== expectedPrevious.id ||
      review.previousReview.reviewFingerprint !==
        expectedPrevious.reviewFingerprint ||
      review.ordinal !== expectedPrevious.ordinal + 1 ||
      review.reviewedAt < expectedPrevious.reviewedAt
    ) {
      throw new Error("Screen 4 occurrence review predecessor is invalid.");
    }
  }
  if (review.decision === "corrected") {
    if (!review.correction) {
      throw new Error("A corrected Screen 4 occurrence review needs a correction.");
    }
    const recreated = correctionFromDraft({
      title: review.correction.title,
      typedDates: review.correction.typedDates.map(({ kind, value }) => ({
        kind,
        value,
      })),
      affectedActivityOrPopulationLabels:
        review.correction.affectedActivityOrPopulationLabels,
      geographyLabels: review.correction.geographyLabels,
    });
    if (
      !sameSixScreenValue(recreated, review.correction) ||
      !correctionDiffersFromCandidate(review.correction, candidate)
    ) throw new Error("Screen 4 occurrence correction is invalid or unchanged.");
  } else if (review.correction !== null) {
    throw new Error("Only a corrected Screen 4 occurrence review may add fields.");
  }
  return review;
}

function duplicateMember(
  candidate: CoEventCandidateOccurrence,
): CoEventDuplicateReviewMember {
  validateCoEventCandidateOccurrence(candidate);
  return {
    candidateId: candidate.id,
    candidateFingerprint: candidate.candidateFingerprint,
    providerId: candidate.providerId,
  };
}

function sortedMembers(
  left: CoEventCandidateOccurrence,
  right: CoEventCandidateOccurrence,
): [CoEventDuplicateReviewMember, CoEventDuplicateReviewMember] {
  if (left.id === right.id) {
    throw new Error("A Screen 4 duplicate review requires two different candidates.");
  }
  const members = [duplicateMember(left), duplicateMember(right)].sort(
    (a, b) => compareText(a.candidateId, b.candidateId),
  );
  return [members[0]!, members[1]!];
}

function memberPairFingerprint(
  members: readonly CoEventDuplicateReviewMember[],
) {
  return fingerprintSixScreenValue({ members });
}

export function createCoEventDuplicateReview(input: {
  reviewId: string;
  leftCandidate: CoEventCandidateOccurrence;
  rightCandidate: CoEventCandidateOccurrence;
  previousReview: CoEventDuplicateReview | null;
  decision: CoEventDuplicateReviewDecision;
  rationale: string;
  actor: "researcher_ui" | "model" | "system";
  reviewedAt: string;
}): CoEventDuplicateReview {
  requireBoundedIdentifier(input.reviewId, "Screen 4 duplicate review id");
  requireCanonicalInstant(input.reviewedAt, "Screen 4 duplicate review time");
  requireText(input.rationale, "Screen 4 duplicate review rationale");
  if (input.actor !== "researcher_ui") {
    throw new Error(
      "Only an explicit researcher UI action can review Screen 4 duplicate candidates.",
    );
  }
  const members = sortedMembers(input.leftCandidate, input.rightCandidate);
  const pairFingerprint = memberPairFingerprint(members);
  if (input.previousReview) {
    validateCoEventDuplicateReview(
      input.previousReview,
      [input.leftCandidate, input.rightCandidate],
    );
    if (input.previousReview.pairFingerprint !== pairFingerprint) {
      throw new Error("A Screen 4 duplicate-review revision changed its pair.");
    }
  }
  const canonicalCandidateId =
    input.decision.mode === "same_event_representation"
      ? input.decision.canonicalCandidateId
      : null;
  if (
    canonicalCandidateId !== null &&
    !members.some(({ candidateId }) => candidateId === canonicalCandidateId)
  ) throw new Error("A duplicate review canonical candidate must belong to the pair.");
  const body: DuplicateReviewBody = {
    schemaVersion: SIX_SCREEN_COEVENT_DUPLICATE_REVIEW_VERSION,
    id: input.reviewId,
    ordinal: (input.previousReview?.ordinal ?? 0) + 1,
    pairFingerprint,
    members,
    previousReview: input.previousReview
      ? {
          reviewId: input.previousReview.id,
          reviewFingerprint: input.previousReview.reviewFingerprint,
        }
      : null,
    decision: input.decision.mode,
    canonicalCandidateId,
    rationale: input.rationale,
    actor: "researcher",
    reviewedAt: input.reviewedAt,
    preservesAllCandidateRecords: true,
    reusableAcrossDesignRevisions: true,
    relationAssessment: {
      status: "not_assessed",
      reason: "genuine_intelligence_path_unverified",
    },
    claimBoundary: DUPLICATE_REVIEW_BOUNDARY,
  };
  const review = {
    ...body,
    reviewFingerprint: fingerprintSixScreenValue(body),
  };
  validateCoEventDuplicateReview(
    review,
    [input.leftCandidate, input.rightCandidate],
    input.previousReview,
  );
  return review;
}

export function validateCoEventDuplicateReview(
  review: CoEventDuplicateReview,
  candidates: readonly CoEventCandidateOccurrence[],
  expectedPrevious?: CoEventDuplicateReview | null,
) {
  if (
    review.schemaVersion !== SIX_SCREEN_COEVENT_DUPLICATE_REVIEW_VERSION ||
    review.reviewFingerprint !==
      fingerprintSixScreenValue(duplicateReviewBody(review)) ||
    review.actor !== "researcher" ||
    review.preservesAllCandidateRecords !== true ||
    review.reusableAcrossDesignRevisions !== true ||
    review.relationAssessment.status !== "not_assessed" ||
    review.relationAssessment.reason !==
      "genuine_intelligence_path_unverified" ||
    review.claimBoundary !== DUPLICATE_REVIEW_BOUNDARY ||
    ![
      "same_event_representation",
      "distinct_stage",
      "different_event",
      "deferred",
    ].includes(review.decision) ||
    !Number.isSafeInteger(review.ordinal) || review.ordinal < 1
  ) throw new Error("Screen 4 duplicate review is invalid or changed.");
  requireBoundedIdentifier(review.id, "Screen 4 duplicate review id");
  requireFingerprint(
    review.reviewFingerprint,
    "Screen 4 duplicate review fingerprint",
  );
  requireFingerprint(
    review.pairFingerprint,
    "Screen 4 duplicate pair fingerprint",
  );
  requireCanonicalInstant(review.reviewedAt, "Screen 4 duplicate review time");
  requireText(review.rationale, "Screen 4 duplicate review rationale");
  if (
    candidates.length !== 2 || candidates[0]?.id === candidates[1]?.id
  ) throw new Error("A Screen 4 duplicate review requires two candidates.");
  const expectedMembers = sortedMembers(candidates[0]!, candidates[1]!);
  if (
    !sameSixScreenValue(review.members, expectedMembers) ||
    review.pairFingerprint !== memberPairFingerprint(expectedMembers) ||
    review.reviewedAt < candidates[0]!.recordedAt ||
    review.reviewedAt < candidates[1]!.recordedAt
  ) throw new Error("Screen 4 duplicate review does not match its candidates.");
  if (review.previousReview) {
    requireBoundedIdentifier(
      review.previousReview.reviewId,
      "Screen 4 previous duplicate review id",
    );
    requireFingerprint(
      review.previousReview.reviewFingerprint,
      "Screen 4 previous duplicate review fingerprint",
    );
    if (review.ordinal < 2 || review.previousReview.reviewId === review.id) {
      throw new Error("Screen 4 duplicate review lineage is invalid.");
    }
  } else if (review.ordinal !== 1) {
    throw new Error("Screen 4 first duplicate review must have ordinal one.");
  }
  if (expectedPrevious !== undefined) {
    if (expectedPrevious === null) {
      if (review.previousReview !== null || review.ordinal !== 1) {
        throw new Error("Screen 4 duplicate review has an unexpected predecessor.");
      }
    } else if (
      review.previousReview?.reviewId !== expectedPrevious.id ||
      review.previousReview.reviewFingerprint !==
        expectedPrevious.reviewFingerprint ||
      review.ordinal !== expectedPrevious.ordinal + 1 ||
      review.pairFingerprint !== expectedPrevious.pairFingerprint ||
      review.reviewedAt < expectedPrevious.reviewedAt
    ) throw new Error("Screen 4 duplicate review predecessor is invalid.");
  }
  if (review.decision === "same_event_representation") {
    if (
      !review.canonicalCandidateId ||
      !review.members.some(({ candidateId }) =>
        candidateId === review.canonicalCandidateId)
    ) throw new Error("A same-event review requires a canonical pair member.");
  } else if (review.canonicalCandidateId !== null) {
    throw new Error("Only a same-event review may choose a canonical candidate.");
  }
  return review;
}

export function latestCoEventOccurrenceReview(
  reviews: readonly CoEventOccurrenceReview[],
  candidateId: string,
) {
  return [...reviews].reverse().find((review) =>
    review.candidateReference.candidateId === candidateId) ?? null;
}

export function latestCoEventDuplicateReview(
  reviews: readonly CoEventDuplicateReview[],
  leftCandidateId: string,
  rightCandidateId: string,
) {
  const pair = [leftCandidateId, rightCandidateId]
    .sort(compareText).join("\u0000");
  return [...reviews].reverse().find((review) =>
    review.members.map(({ candidateId }) => candidateId).join("\u0000") === pair
  ) ?? null;
}

export function validateCoEventReviewCollections(input: {
  candidates: readonly CoEventCandidateOccurrence[];
  occurrenceReviews: readonly CoEventOccurrenceReview[];
  duplicateReviews: readonly CoEventDuplicateReview[];
}) {
  if (
    input.occurrenceReviews.length >
      SIX_SCREEN_COEVENT_MAX_OCCURRENCE_REVIEWS ||
    input.duplicateReviews.length > SIX_SCREEN_COEVENT_MAX_DUPLICATE_REVIEWS ||
    bytes({
      occurrenceReviews: input.occurrenceReviews,
      duplicateReviews: input.duplicateReviews,
    }) > SIX_SCREEN_COEVENT_REVIEW_MAX_BYTES ||
    new Set([
      ...input.occurrenceReviews.map(({ id }) => id),
      ...input.duplicateReviews.map(({ id }) => id),
    ]).size !==
      input.occurrenceReviews.length + input.duplicateReviews.length
  ) throw new Error("Stored Screen 4 review history exceeds its bounded capacity.");
  const candidateMap = new Map(input.candidates.map((candidate) => [
    candidate.id,
    validateCoEventCandidateOccurrence(candidate),
  ]));
  if (candidateMap.size !== input.candidates.length) {
    throw new Error("Stored Screen 4 candidates must be unique for review.");
  }
  const latestOccurrenceByCandidate = new Map<
    string,
    CoEventOccurrenceReview
  >();
  for (const review of input.occurrenceReviews) {
    const candidate = candidateMap.get(review.candidateReference.candidateId);
    if (!candidate) {
      throw new Error("Stored Screen 4 occurrence review cites missing evidence.");
    }
    const previous = latestOccurrenceByCandidate.get(candidate.id) ?? null;
    validateCoEventOccurrenceReview(review, candidate, previous);
    latestOccurrenceByCandidate.set(candidate.id, review);
  }
  const latestDuplicateByPair = new Map<string, CoEventDuplicateReview>();
  for (const review of input.duplicateReviews) {
    const candidates = review.members.map(({ candidateId }) =>
      candidateMap.get(candidateId));
    if (!candidates[0] || !candidates[1]) {
      throw new Error("Stored Screen 4 duplicate review cites missing evidence.");
    }
    const previous = latestDuplicateByPair.get(review.pairFingerprint) ?? null;
    validateCoEventDuplicateReview(
      review,
      [candidates[0], candidates[1]],
      previous,
    );
    latestDuplicateByPair.set(review.pairFingerprint, review);
  }
  return input;
}
