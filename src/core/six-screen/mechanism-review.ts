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
  type MechanismSynthesisAcceptedClaim,
  type MechanismSynthesisInputPacket,
} from "./mechanism-synthesis-input";

export const SIX_SCREEN_MECHANISM_REVIEW_VERSION =
  "screen-05-mechanism-review-v1" as const;
export const SIX_SCREEN_PREDICTION_MATRIX_VERSION =
  "screen-05-prediction-matrix-v1" as const;
export const SIX_SCREEN_MECHANISM_REVIEW_MAX_REVISIONS = 24;
export const SIX_SCREEN_MECHANISM_REVIEW_COLLECTION_MAX_BYTES = 2_000_000;

export const MECHANISM_ROLES = [
  "focal",
  "rival",
  "complementary",
  "offsetting",
  "independent_coevent",
  "measurement_alternative",
] as const;
export type MechanismRole = (typeof MECHANISM_ROLES)[number];

export const MECHANISM_REVIEW_DECISIONS = [
  "retained",
  "rejected",
  "deferred",
] as const;
export type MechanismReviewDecision =
  (typeof MECHANISM_REVIEW_DECISIONS)[number];

export const MECHANISM_EVIDENCE_LEVELS = [
  "source_grounded",
  "partially_source_grounded",
  "researcher_hypothesis",
] as const;
export type MechanismEvidenceLevel =
  (typeof MECHANISM_EVIDENCE_LEVELS)[number];

export const MECHANISM_CLAIM_TARGETS = [
  "total_effect_only",
  "compare_mechanisms_without_identification",
  "seek_unique_mechanism_evidence",
] as const;
export type MechanismClaimTarget =
  (typeof MECHANISM_CLAIM_TARGETS)[number];

export const PREDICTION_DIRECTIONS = [
  "increase",
  "decrease",
  "no_change",
  "nonlinear",
  "ambiguous",
  "not_applicable",
] as const;
export type PredictionDirection = (typeof PREDICTION_DIRECTIONS)[number];

export const PREDICTION_FEASIBILITY = [
  "feasible_now",
  "feasible_with_additional_data",
  "not_currently_feasible",
] as const;
export type PredictionFeasibility =
  (typeof PREDICTION_FEASIBILITY)[number];

export type MechanismClaimReference = {
  extractionId: string;
  extractionFingerprint: string;
  reviewId: string;
  reviewFingerprint: string;
};

export type MechanismCardDraft = {
  id: string;
  label: string;
  role: MechanismRole;
  decision: MechanismReviewDecision;
  causalSequence: string[];
  theoreticalAnchor: string;
  policyConnection: string;
  contextualFit: string;
  uncertainty: string;
  evidenceLevel: MechanismEvidenceLevel;
  acceptedClaimReferences: MechanismClaimReference[];
  researcherRationale: string;
};

export type PredictionPatternDraft = {
  mechanismId: string;
  direction: PredictionDirection;
  detail: string;
};

export type PredictionRowDraft = {
  id: string;
  observation: string;
  feasibleMeasure: string;
  timing: string;
  dataSource: string;
  feasibility: PredictionFeasibility;
  priority: "high" | "medium" | "low";
  assumptions: string[];
  patterns: PredictionPatternDraft[];
};

export type MechanismReviewDraft = {
  intendedClaim: MechanismClaimTarget;
  focalMechanismId: string | null;
  mechanisms: MechanismCardDraft[];
  predictions: PredictionRowDraft[];
  overallRationale: string;
};

const REVIEW_BOUNDARY =
  "This MechanismReview records explicit researcher-authored hypotheses and decisions. Source references support only the reviewed scholarly claims they identify. The review does not establish mediation, identify a unique mechanism, estimate an effect, or convert an unsupported hypothesis into evidence.";
const MATRIX_BOUNDARY =
  "This PredictionMatrix records researcher-authored observable implications and a transparent greedy evidence-plan ordering. Different predicted patterns may help discriminate hypotheses, but consistency with one pattern does not identify mediation or prove a mechanism.";

export type MechanismReview = {
  schemaVersion: typeof SIX_SCREEN_MECHANISM_REVIEW_VERSION;
  snapshotId: string;
  ordinal: number;
  binding: {
    synthesisInputSnapshotId: string;
    synthesisInputFingerprint: string;
    literaturePlanSnapshotId: string;
    literaturePlanFingerprint: string;
    claimPacketSnapshotId: string;
    claimPacketFingerprint: string;
    studyRevision: number;
    identityFingerprint: string;
    eventCardSnapshotId: string;
    eventCardFingerprint: string;
  };
  previousReview: {
    snapshotId: string;
    reviewFingerprint: string;
  } | null;
  intendedClaim: MechanismClaimTarget;
  focalMechanismId: string | null;
  mechanisms: MechanismCardDraft[];
  overallRationale: string;
  actor: "researcher";
  origin: "researcher_authored";
  semanticAssistance: {
    status: "not_used";
    reason: "genuine_intelligence_path_unverified";
  };
  causalStatus: "hypotheses_not_estimates";
  reviewedAt: string;
  claimBoundary: typeof REVIEW_BOUNDARY;
  reviewFingerprint: string;
};

export type PredictionMatrix = {
  schemaVersion: typeof SIX_SCREEN_PREDICTION_MATRIX_VERSION;
  snapshotId: string;
  ordinal: number;
  binding: MechanismReview["binding"] & {
    mechanismReviewSnapshotId: string;
    mechanismReviewFingerprint: string;
  };
  rows: PredictionRowDraft[];
  pairwiseDistinctions: Array<{
    leftMechanismId: string;
    rightMechanismId: string;
    distinguishingPredictionIds: string[];
  }>;
  compactEvidencePlan: {
    method: "transparent_greedy_pair_coverage_v1";
    selectedPredictionIds: string[];
    coveredPairCount: number;
    totalPairCount: number;
    remainingIndistinguishablePairs: Array<{
      leftMechanismId: string;
      rightMechanismId: string;
    }>;
  };
  actor: "researcher";
  origin: "researcher_authored_predictions";
  semanticAssistance: MechanismReview["semanticAssistance"];
  createdAt: string;
  claimBoundary: typeof MATRIX_BOUNDARY;
  matrixFingerprint: string;
};

type ReviewBody = Omit<MechanismReview, "reviewFingerprint">;
type MatrixBody = Omit<PredictionMatrix, "matrixFingerprint">;

function bytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function requireText(value: string, label: string, maximum = 4_000) {
  if (!value || value !== value.trim() || value.length > maximum) {
    throw new Error(
      `${label} must be non-empty canonical text of at most ${maximum} characters.`,
    );
  }
  return value;
}

function requireUniqueTexts(
  values: readonly string[],
  label: string,
  minimum: number,
  maximum: number,
) {
  if (
    values.length < minimum || values.length > maximum ||
    new Set(values).size !== values.length
  ) throw new Error(`${label} must be a bounded unique list.`);
  values.forEach((value) => requireText(value, label, 1_000));
}

function acceptedReference(claim: MechanismSynthesisAcceptedClaim) {
  return {
    extractionId: claim.extractionReference.extractionId,
    extractionFingerprint: claim.extractionReference.extractionFingerprint,
    reviewId: claim.reviewReference.reviewId,
    reviewFingerprint: claim.reviewReference.reviewFingerprint,
  } satisfies MechanismClaimReference;
}

function binding(input: MechanismSynthesisInputPacket): MechanismReview["binding"] {
  return {
    synthesisInputSnapshotId: input.snapshotId,
    synthesisInputFingerprint: input.packetFingerprint,
    literaturePlanSnapshotId: input.binding.literaturePlanSnapshotId,
    literaturePlanFingerprint: input.binding.literaturePlanFingerprint,
    claimPacketSnapshotId: input.binding.claimPacketSnapshotId,
    claimPacketFingerprint: input.binding.claimPacketFingerprint,
    studyRevision: input.binding.studyRevision,
    identityFingerprint: input.binding.identityFingerprint,
    eventCardSnapshotId: input.binding.eventCardSnapshotId,
    eventCardFingerprint: input.binding.eventCardFingerprint,
  };
}

function validateMechanisms(
  mechanisms: readonly MechanismCardDraft[],
  synthesisInput: MechanismSynthesisInputPacket,
) {
  if (mechanisms.length < 1 || mechanisms.length > 4) {
    throw new Error("A mechanism review requires one to four mechanism cards.");
  }
  const ids = new Set<string>();
  const accepted = new Set(
    synthesisInput.acceptedScholarlyClaims.map((claim) =>
      JSON.stringify(acceptedReference(claim))),
  );
  for (const mechanism of mechanisms) {
    requireBoundedIdentifier(mechanism.id, "Mechanism id");
    if (ids.has(mechanism.id)) throw new Error("Mechanism ids must be unique.");
    ids.add(mechanism.id);
    requireText(mechanism.label, "Mechanism label", 200);
    if (!MECHANISM_ROLES.includes(mechanism.role)) {
      throw new Error("Mechanism role is invalid.");
    }
    if (!MECHANISM_REVIEW_DECISIONS.includes(mechanism.decision)) {
      throw new Error("Mechanism decision is invalid.");
    }
    if (!MECHANISM_EVIDENCE_LEVELS.includes(mechanism.evidenceLevel)) {
      throw new Error("Mechanism evidence level is invalid.");
    }
    requireUniqueTexts(
      mechanism.causalSequence,
      "Mechanism causal sequence",
      2,
      6,
    );
    requireText(mechanism.theoreticalAnchor, "Mechanism theoretical anchor");
    requireText(mechanism.policyConnection, "Mechanism policy connection");
    requireText(mechanism.contextualFit, "Mechanism contextual fit");
    requireText(mechanism.uncertainty, "Mechanism uncertainty");
    requireText(mechanism.researcherRationale, "Mechanism rationale");
    if (
      mechanism.acceptedClaimReferences.length > 12 ||
      new Set(mechanism.acceptedClaimReferences.map((value) =>
        JSON.stringify(value))).size !== mechanism.acceptedClaimReferences.length ||
      mechanism.acceptedClaimReferences.some((value) =>
        !accepted.has(JSON.stringify(value)))
    ) throw new Error("A mechanism cites a claim outside the frozen accepted packet.");
    if (
      mechanism.evidenceLevel === "source_grounded" &&
      !mechanism.acceptedClaimReferences.length
    ) throw new Error("A source-grounded mechanism requires an accepted claim reference.");
  }
  if (!mechanisms.some(({ decision }) => decision === "retained")) {
    throw new Error("A mechanism review requires at least one retained hypothesis.");
  }
  return ids;
}

function validatePredictions(
  rows: readonly PredictionRowDraft[],
  mechanisms: readonly MechanismCardDraft[],
) {
  if (rows.length < 1 || rows.length > 12) {
    throw new Error("A prediction matrix requires one to twelve rows.");
  }
  const activeIds = mechanisms.filter(({ decision }) => decision !== "rejected")
    .map(({ id }) => id).sort();
  const rowIds = new Set<string>();
  for (const row of rows) {
    requireBoundedIdentifier(row.id, "Prediction id");
    if (rowIds.has(row.id)) throw new Error("Prediction ids must be unique.");
    rowIds.add(row.id);
    requireText(row.observation, "Predicted observation");
    requireText(row.feasibleMeasure, "Prediction measure");
    requireText(row.timing, "Prediction timing");
    requireText(row.dataSource, "Prediction data source");
    if (!PREDICTION_FEASIBILITY.includes(row.feasibility)) {
      throw new Error("Prediction feasibility is invalid.");
    }
    if (!["high", "medium", "low"].includes(row.priority)) {
      throw new Error("Prediction priority is invalid.");
    }
    requireUniqueTexts(row.assumptions, "Prediction assumptions", 0, 10);
    const patternIds = row.patterns.map(({ mechanismId }) => mechanismId).sort();
    if (!sameSixScreenValue(patternIds, activeIds)) {
      throw new Error("Every prediction row must cover each non-rejected mechanism exactly once.");
    }
    for (const pattern of row.patterns) {
      requireBoundedIdentifier(pattern.mechanismId, "Prediction mechanism id");
      if (!PREDICTION_DIRECTIONS.includes(pattern.direction)) {
        throw new Error("Prediction direction is invalid.");
      }
      requireText(pattern.detail, "Prediction pattern detail");
    }
  }
}

function pairKey(left: string, right: string) {
  return left < right ? `${left}\u0000${right}` : `${right}\u0000${left}`;
}

function pairwiseDistinctions(
  mechanisms: readonly MechanismCardDraft[],
  rows: readonly PredictionRowDraft[],
): PredictionMatrix["pairwiseDistinctions"] {
  const active = mechanisms.filter(({ decision }) => decision !== "rejected")
    .map(({ id }) => id);
  const pairs: PredictionMatrix["pairwiseDistinctions"] = [];
  for (let leftIndex = 0; leftIndex < active.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < active.length; rightIndex += 1) {
      const left = active[leftIndex]!;
      const right = active[rightIndex]!;
      const distinguishingPredictionIds = rows.flatMap((row) => {
        const leftPattern = row.patterns.find(({ mechanismId }) =>
          mechanismId === left);
        const rightPattern = row.patterns.find(({ mechanismId }) =>
          mechanismId === right);
        const usable = leftPattern && rightPattern &&
          !["ambiguous", "not_applicable"].includes(leftPattern.direction) &&
          !["ambiguous", "not_applicable"].includes(rightPattern.direction) &&
          leftPattern.direction !== rightPattern.direction;
        return usable ? [row.id] : [];
      });
      pairs.push({
        leftMechanismId: left,
        rightMechanismId: right,
        distinguishingPredictionIds,
      });
    }
  }
  return pairs;
}

function compactEvidencePlan(
  rows: readonly PredictionRowDraft[],
  pairs: PredictionMatrix["pairwiseDistinctions"],
): PredictionMatrix["compactEvidencePlan"] {
  const uncovered = new Set(pairs.filter(({ distinguishingPredictionIds }) =>
    distinguishingPredictionIds.length).map(({ leftMechanismId, rightMechanismId }) =>
      pairKey(leftMechanismId, rightMechanismId)));
  const eligible = rows.filter(({ feasibility }) =>
    feasibility !== "not_currently_feasible");
  const selected: string[] = [];
  const priority = { high: 0, medium: 1, low: 2 } as const;
  while (uncovered.size && selected.length < 6) {
    const candidates = eligible.filter(({ id }) => !selected.includes(id))
      .map((row, index) => ({
        row,
        index,
        coverage: pairs.filter((pair) =>
          uncovered.has(pairKey(pair.leftMechanismId, pair.rightMechanismId)) &&
          pair.distinguishingPredictionIds.includes(row.id)).length,
      })).filter(({ coverage }) => coverage > 0)
      .sort((left, right) =>
        right.coverage - left.coverage ||
        priority[left.row.priority] - priority[right.row.priority] ||
        left.index - right.index);
    const winner = candidates[0]?.row;
    if (!winner) break;
    selected.push(winner.id);
    for (const pair of pairs) {
      if (pair.distinguishingPredictionIds.includes(winner.id)) {
        uncovered.delete(pairKey(pair.leftMechanismId, pair.rightMechanismId));
      }
    }
  }
  if (!selected.length && eligible[0]) selected.push(eligible[0].id);
  const remainingIndistinguishablePairs = pairs.filter((pair) =>
    !pair.distinguishingPredictionIds.some((id) => selected.includes(id)))
    .map(({ leftMechanismId, rightMechanismId }) => ({
      leftMechanismId,
      rightMechanismId,
    }));
  return {
    method: "transparent_greedy_pair_coverage_v1",
    selectedPredictionIds: selected,
    coveredPairCount: pairs.length - remainingIndistinguishablePairs.length,
    totalPairCount: pairs.length,
    remainingIndistinguishablePairs,
  };
}

function reviewBody(review: MechanismReview): ReviewBody {
  const { reviewFingerprint: _fingerprint, ...body } = review;
  return body;
}

function matrixBody(matrix: PredictionMatrix): MatrixBody {
  const { matrixFingerprint: _fingerprint, ...body } = matrix;
  return body;
}

export function createMechanismReview(input: {
  reviewSnapshotId: string;
  matrixSnapshotId: string;
  synthesisInput: MechanismSynthesisInputPacket;
  previousReview: MechanismReview | null;
  draft: MechanismReviewDraft;
  actor: "researcher_ui" | "model" | "system";
  reviewedAt: string;
}) {
  requireBoundedIdentifier(input.reviewSnapshotId, "Mechanism review id");
  requireBoundedIdentifier(input.matrixSnapshotId, "Prediction matrix id");
  requireCanonicalInstant(input.reviewedAt, "Mechanism review time");
  requireText(input.draft.overallRationale, "Mechanism review rationale");
  if (input.actor !== "researcher_ui") {
    throw new Error("Only an explicit researcher UI action can save a mechanism review.");
  }
  if (!MECHANISM_CLAIM_TARGETS.includes(input.draft.intendedClaim)) {
    throw new Error("The intended mechanism claim is invalid.");
  }
  const mechanismIds = validateMechanisms(
    input.draft.mechanisms,
    input.synthesisInput,
  );
  validatePredictions(input.draft.predictions, input.draft.mechanisms);
  if (input.draft.focalMechanismId !== null) {
    if (!mechanismIds.has(input.draft.focalMechanismId) ||
        input.draft.mechanisms.find(({ id }) =>
          id === input.draft.focalMechanismId)?.decision !== "retained") {
      throw new Error("The focal mechanism must be a retained mechanism card.");
    }
  }
  const expectedBinding = binding(input.synthesisInput);
  if (input.previousReview) {
    if (!sameSixScreenValue(input.previousReview.binding, expectedBinding)) {
      throw new Error("A mechanism review revision changed its frozen input packet.");
    }
    validateMechanismReview(input.previousReview, input.synthesisInput);
  }
  const body: ReviewBody = {
    schemaVersion: SIX_SCREEN_MECHANISM_REVIEW_VERSION,
    snapshotId: input.reviewSnapshotId,
    ordinal: (input.previousReview?.ordinal ?? 0) + 1,
    binding: expectedBinding,
    previousReview: input.previousReview
      ? {
          snapshotId: input.previousReview.snapshotId,
          reviewFingerprint: input.previousReview.reviewFingerprint,
        }
      : null,
    intendedClaim: input.draft.intendedClaim,
    focalMechanismId: input.draft.focalMechanismId,
    mechanisms: structuredClone(input.draft.mechanisms),
    overallRationale: input.draft.overallRationale,
    actor: "researcher",
    origin: "researcher_authored",
    semanticAssistance: {
      status: "not_used",
      reason: "genuine_intelligence_path_unverified",
    },
    causalStatus: "hypotheses_not_estimates",
    reviewedAt: input.reviewedAt,
    claimBoundary: REVIEW_BOUNDARY,
  };
  const review = validateMechanismReview({
    ...body,
    reviewFingerprint: fingerprintSixScreenValue(body),
  }, input.synthesisInput, input.previousReview);
  const distinctions = pairwiseDistinctions(
    review.mechanisms,
    input.draft.predictions,
  );
  const matrixBase: MatrixBody = {
    schemaVersion: SIX_SCREEN_PREDICTION_MATRIX_VERSION,
    snapshotId: input.matrixSnapshotId,
    ordinal: review.ordinal,
    binding: {
      ...expectedBinding,
      mechanismReviewSnapshotId: review.snapshotId,
      mechanismReviewFingerprint: review.reviewFingerprint,
    },
    rows: structuredClone(input.draft.predictions),
    pairwiseDistinctions: distinctions,
    compactEvidencePlan: compactEvidencePlan(
      input.draft.predictions,
      distinctions,
    ),
    actor: "researcher",
    origin: "researcher_authored_predictions",
    semanticAssistance: structuredClone(review.semanticAssistance),
    createdAt: input.reviewedAt,
    claimBoundary: MATRIX_BOUNDARY,
  };
  const matrix = validatePredictionMatrix({
    ...matrixBase,
    matrixFingerprint: fingerprintSixScreenValue(matrixBase),
  }, review, input.synthesisInput);
  return { review, matrix };
}

export function validateMechanismReview(
  review: MechanismReview,
  synthesisInput: MechanismSynthesisInputPacket,
  expectedPrevious?: MechanismReview | null,
) {
  validateMechanisms(review.mechanisms, synthesisInput);
  if (
    review.schemaVersion !== SIX_SCREEN_MECHANISM_REVIEW_VERSION ||
    !sameSixScreenValue(review.binding, binding(synthesisInput)) ||
    review.reviewFingerprint !== fingerprintSixScreenValue(reviewBody(review)) ||
    review.actor !== "researcher" || review.origin !== "researcher_authored" ||
    review.semanticAssistance.status !== "not_used" ||
    review.semanticAssistance.reason !== "genuine_intelligence_path_unverified" ||
    review.causalStatus !== "hypotheses_not_estimates" ||
    review.claimBoundary !== REVIEW_BOUNDARY ||
    !MECHANISM_CLAIM_TARGETS.includes(review.intendedClaim) ||
    !Number.isSafeInteger(review.ordinal) || review.ordinal < 1
  ) throw new Error("MechanismReview is invalid or changed.");
  requireBoundedIdentifier(review.snapshotId, "Mechanism review id");
  requireFingerprint(review.reviewFingerprint, "Mechanism review fingerprint");
  requireCanonicalInstant(review.reviewedAt, "Mechanism review time");
  requireText(review.overallRationale, "Mechanism review rationale");
  if (review.focalMechanismId !== null &&
      review.mechanisms.find(({ id }) => id === review.focalMechanismId)
        ?.decision !== "retained") {
    throw new Error("MechanismReview focal mechanism is not retained.");
  }
  if (expectedPrevious !== undefined) {
    if (expectedPrevious === null) {
      if (review.previousReview !== null || review.ordinal !== 1) {
        throw new Error("The first MechanismReview has an unexpected predecessor.");
      }
    } else if (
      review.previousReview?.snapshotId !== expectedPrevious.snapshotId ||
      review.previousReview.reviewFingerprint !==
        expectedPrevious.reviewFingerprint ||
      review.ordinal !== expectedPrevious.ordinal + 1 ||
      review.reviewedAt < expectedPrevious.reviewedAt
    ) throw new Error("MechanismReview predecessor is invalid.");
  }
  if (bytes(review) > 512_000) throw new Error("MechanismReview exceeds its byte budget.");
  return review;
}

export function validatePredictionMatrix(
  matrix: PredictionMatrix,
  review: MechanismReview,
  synthesisInput: MechanismSynthesisInputPacket,
) {
  validatePredictions(matrix.rows, review.mechanisms);
  const expectedPairs = pairwiseDistinctions(review.mechanisms, matrix.rows);
  const expectedPlan = compactEvidencePlan(matrix.rows, expectedPairs);
  if (
    matrix.schemaVersion !== SIX_SCREEN_PREDICTION_MATRIX_VERSION ||
    matrix.ordinal !== review.ordinal ||
    !sameSixScreenValue(
      matrix.binding,
      {
        ...binding(synthesisInput),
        mechanismReviewSnapshotId: review.snapshotId,
        mechanismReviewFingerprint: review.reviewFingerprint,
      },
    ) ||
    !sameSixScreenValue(matrix.pairwiseDistinctions, expectedPairs) ||
    !sameSixScreenValue(matrix.compactEvidencePlan, expectedPlan) ||
    matrix.matrixFingerprint !== fingerprintSixScreenValue(matrixBody(matrix)) ||
    matrix.actor !== "researcher" ||
    matrix.origin !== "researcher_authored_predictions" ||
    matrix.semanticAssistance.status !== "not_used" ||
    matrix.semanticAssistance.reason !== "genuine_intelligence_path_unverified" ||
    matrix.claimBoundary !== MATRIX_BOUNDARY
  ) throw new Error("PredictionMatrix is invalid or changed.");
  requireBoundedIdentifier(matrix.snapshotId, "Prediction matrix id");
  requireFingerprint(matrix.matrixFingerprint, "Prediction matrix fingerprint");
  requireCanonicalInstant(matrix.createdAt, "Prediction matrix time");
  if (bytes(matrix) > 512_000) throw new Error("PredictionMatrix exceeds its byte budget.");
  return matrix;
}

export function validateMechanismReviewCollections(input: {
  synthesisInputs: readonly MechanismSynthesisInputPacket[];
  reviews: readonly MechanismReview[];
  predictionMatrices: readonly PredictionMatrix[];
}) {
  if (
    input.reviews.length > SIX_SCREEN_MECHANISM_REVIEW_MAX_REVISIONS ||
    input.predictionMatrices.length > SIX_SCREEN_MECHANISM_REVIEW_MAX_REVISIONS ||
    input.reviews.length !== input.predictionMatrices.length ||
    bytes({ reviews: input.reviews, predictionMatrices: input.predictionMatrices }) >
      SIX_SCREEN_MECHANISM_REVIEW_COLLECTION_MAX_BYTES
  ) throw new Error("Mechanism review history exceeds its bounded contract.");
  const synthesisMap = new Map(input.synthesisInputs.map((packet) =>
    [packet.snapshotId, packet]));
  const matrixByReview = new Map(input.predictionMatrices.map((matrix) =>
    [matrix.binding.mechanismReviewSnapshotId, matrix]));
  const reviewIds = new Set<string>();
  const matrixIds = new Set<string>();
  const previousByInput = new Map<string, MechanismReview>();
  for (const review of input.reviews) {
    if (reviewIds.has(review.snapshotId)) {
      throw new Error("MechanismReview ids must be unique.");
    }
    reviewIds.add(review.snapshotId);
    const packet = synthesisMap.get(review.binding.synthesisInputSnapshotId);
    if (!packet) throw new Error("MechanismReview lost its synthesis input.");
    const previous = previousByInput.get(packet.snapshotId) ?? null;
    validateMechanismReview(review, packet, previous);
    const matrix = matrixByReview.get(review.snapshotId);
    if (!matrix) throw new Error("MechanismReview lost its PredictionMatrix.");
    validatePredictionMatrix(matrix, review, packet);
    previousByInput.set(packet.snapshotId, review);
  }
  for (const matrix of input.predictionMatrices) {
    if (matrixIds.has(matrix.snapshotId)) {
      throw new Error("PredictionMatrix ids must be unique.");
    }
    matrixIds.add(matrix.snapshotId);
    if (!reviewIds.has(matrix.binding.mechanismReviewSnapshotId)) {
      throw new Error("PredictionMatrix lost its MechanismReview.");
    }
  }
  return input;
}

export function latestMechanismReviewForInput(
  reviews: readonly MechanismReview[],
  synthesisInputSnapshotId: string,
) {
  return [...reviews].reverse().find((review) =>
    review.binding.synthesisInputSnapshotId === synthesisInputSnapshotId
  ) ?? null;
}
