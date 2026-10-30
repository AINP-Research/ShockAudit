import {
  fingerprintSixScreenValue,
  sameSixScreenValue,
} from "./canonical";
import {
  requireBoundedIdentifier,
  requireCanonicalInstant,
  requireFingerprint,
  requireSanitizedSourceUrl,
} from "./contracts";
import {
  canonicalScholarlyVisibleText,
  validateScholarlyDocumentAcquisition,
  type ScholarlyDocumentAcquisition,
  type ScholarlyPassagePacket,
} from "./mechanism-scholarly-document";

export const SIX_SCREEN_SCHOLARLY_CLAIM_EXTRACTION_VERSION =
  "screen-05-scholarly-claim-extraction-v1" as const;
export const SIX_SCREEN_SCHOLARLY_CLAIM_REVIEW_VERSION =
  "screen-05-scholarly-claim-review-v1" as const;
export const SIX_SCREEN_SCHOLARLY_CLAIM_PACKET_VERSION =
  "screen-05-scholarly-claim-packet-v1" as const;

export const SIX_SCREEN_SCHOLARLY_CLAIM_MAX_EXTRACTIONS = 64;
export const SIX_SCREEN_SCHOLARLY_CLAIM_MAX_REVIEWS = 128;
export const SIX_SCREEN_SCHOLARLY_CLAIM_MAX_REVIEWS_PER_EXTRACTION = 2;
export const SIX_SCREEN_SCHOLARLY_CLAIM_COLLECTION_MAX_BYTES = 768_000;

const EXTRACTION_BOUNDARY =
  "This structured claim is authored by the researcher from one retained eligible passage. Fixed software preserves the exact passage, document, version, offsets and hashes but does not infer the claim or verify the researcher's interpretation.";
const REVIEW_BOUNDARY =
  "This explicit researcher decision preserves the original extraction and source passage. Accept or correct makes only a reviewed scholarly premise available to a later synthesis step; reject and defer do not. No decision creates a mechanism, prediction, measure recommendation, causal estimate or identification claim.";
const PACKET_BOUNDARY =
  "This immutable packet records source-linked researcher-authored scholarly claims and their explicit reviews. Mechanism and prediction generation remain blocked until a genuine intelligence route and a separately implemented synthesis/review path exist.";

export type ScholarlyEvidenceLevel =
  | "established_theoretical_argument"
  | "empirical_evidence_different_setting"
  | "empirical_evidence_focal_setting"
  | "agency_or_stakeholder_expectation";

export type ScholarlyContextualFitAssessment =
  | "focal_setting"
  | "adjacent_setting"
  | "different_setting"
  | "theory_only"
  | "uncertain";

export type ScholarlyClaimFieldsDraft = {
  theoreticalProposition: string | null;
  empiricalSetting: string | null;
  levelOfAnalysis: string | null;
  measuredVariables: string[];
  relevantResultOrQualification: string | null;
  contextualFit: {
    assessment: ScholarlyContextualFitAssessment;
    rationale: string;
  };
  evidenceLevel: ScholarlyEvidenceLevel;
};

export type ScholarlyClaimFields = ScholarlyClaimFieldsDraft & {
  fieldProvenance: "researcher_supplied";
};

export type ScholarlyClaimExtraction = {
  schemaVersion: typeof SIX_SCREEN_SCHOLARLY_CLAIM_EXTRACTION_VERSION;
  id: string;
  ordinal: number;
  binding: {
    literaturePlanSnapshotId: string;
    literaturePlanFingerprint: string;
    metadataExecutionSnapshotId: string;
    metadataExecutionFingerprint: string;
    metadataPacketSnapshotId: string;
    metadataPacketFingerprint: string;
    passagePacketSnapshotId: string;
    passagePacketFingerprint: string;
  };
  acquisitionReference: {
    acquisitionId: string;
    acquisitionFingerprint: string;
  };
  documentReference: {
    documentId: string;
    documentFingerprint: string;
    documentVersionId: string;
    canonicalUrl: string;
    title: string;
    doi: string | null;
    contentHash: string;
    normalizedTextHash: string;
    inspectionStatus: "partial_text";
  };
  passageReference: {
    passageId: string;
    passageFingerprint: string;
    sourceId: string;
    documentVersionId: string;
    quoteHash: string;
    exactOffsets: { start: number; end: number };
    exactText: string;
    locator: string;
    qualification: string;
    detailedClaimUse: "eligible_for_later_researcher_review";
  };
  fields: ScholarlyClaimFields;
  actor: "researcher";
  extractionMethod: "researcher_authored_from_exact_passage";
  extractedAt: string;
  claimBoundary: typeof EXTRACTION_BOUNDARY;
  extractionFingerprint: string;
};

export type ScholarlyClaimReviewDecision =
  | { mode: "accepted" }
  | { mode: "rejected" }
  | { mode: "deferred" }
  | { mode: "corrected"; correction: ScholarlyClaimFieldsDraft };

export type ScholarlyClaimReview = {
  schemaVersion: typeof SIX_SCREEN_SCHOLARLY_CLAIM_REVIEW_VERSION;
  id: string;
  ordinal: number;
  extractionReference: {
    extractionId: string;
    extractionFingerprint: string;
    passageId: string;
    passageFingerprint: string;
  };
  previousReview: {
    reviewId: string;
    reviewFingerprint: string;
    decision: ScholarlyClaimReviewDecision["mode"];
  } | null;
  decision: ScholarlyClaimReviewDecision["mode"];
  finalFields: ScholarlyClaimFields | null;
  acceptedForLaterSynthesis: boolean;
  rationale: string;
  actor: "researcher";
  reviewedAt: string;
  sourceEvidenceMutation: "none";
  mechanismMutation: "none";
  claimBoundary: typeof REVIEW_BOUNDARY;
  reviewFingerprint: string;
};

export type ScholarlyClaimPacketChangeReference =
  | {
      kind: "claim_extracted";
      id: string;
      fingerprint: string;
    }
  | {
      kind: "claim_reviewed";
      id: string;
      fingerprint: string;
    };

export type ScholarlyClaimPacket = {
  schemaVersion: typeof SIX_SCREEN_SCHOLARLY_CLAIM_PACKET_VERSION;
  snapshotId: string;
  ordinal: number;
  binding: {
    metadataPacketSnapshotId: string;
    metadataPacketFingerprint: string;
    passagePacketSnapshotId: string;
    passagePacketFingerprint: string;
    previousClaimPacketSnapshotId: string | null;
  };
  changeReference: ScholarlyClaimPacketChangeReference;
  extractionReferences: Array<{
    extractionId: string;
    extractionFingerprint: string;
    passageId: string;
    passageFingerprint: string;
  }>;
  reviewReferences: Array<{
    reviewId: string;
    reviewFingerprint: string;
    extractionId: string;
    decision: ScholarlyClaimReviewDecision["mode"];
    acceptedForLaterSynthesis: boolean;
  }>;
  unreviewedExtractionIds: string[];
  deferredExtractionIds: string[];
  rejectedExtractionIds: string[];
  acceptedClaimReferences: Array<{
    extractionId: string;
    extractionFingerprint: string;
    reviewId: string;
    reviewFingerprint: string;
    finalFieldsFingerprint: string;
  }>;
  detailedClaims: {
    status:
      | "extracted_pending_review"
      | "reviewed_none_accepted"
      | "reviewed_with_accepted_claims";
    extractionCount: number;
    reviewCount: number;
    acceptedCount: number;
  };
  mechanismGeneration: {
    status: "blocked";
    reasons: Array<
      | "genuine_intelligence_path_unverified"
      | "scholarly_claims_not_accepted"
      | "mechanism_synthesis_not_implemented"
    >;
  };
  mechanismCandidates: [];
  predictionMatrix: null;
  claimBoundary: typeof PACKET_BOUNDARY;
  createdAt: string;
  packetFingerprint: string;
};

type ExtractionBody = Omit<
  ScholarlyClaimExtraction,
  "extractionFingerprint"
>;
type ReviewBody = Omit<ScholarlyClaimReview, "reviewFingerprint">;
type PacketBody = Omit<ScholarlyClaimPacket, "packetFingerprint">;

function bytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function requireText(value: string, label: string, maximum = 2_000) {
  if (!value || value !== value.trim() || value.length > maximum) {
    throw new Error(
      `${label} must be non-empty canonical text within its bounded length.`,
    );
  }
  return value;
}

function canonicalOptionalText(
  value: string | null,
  label: string,
  maximum: number,
) {
  if (value === null) return null;
  const canonical = canonicalScholarlyVisibleText(value);
  return requireText(canonical, label, maximum);
}

function normalizeFields(draft: ScholarlyClaimFieldsDraft): ScholarlyClaimFields {
  const assessments: readonly ScholarlyContextualFitAssessment[] = [
    "focal_setting",
    "adjacent_setting",
    "different_setting",
    "theory_only",
    "uncertain",
  ];
  const levels: readonly ScholarlyEvidenceLevel[] = [
    "established_theoretical_argument",
    "empirical_evidence_different_setting",
    "empirical_evidence_focal_setting",
    "agency_or_stakeholder_expectation",
  ];
  if (!assessments.includes(draft.contextualFit.assessment)) {
    throw new Error("Scholarly claim contextual-fit assessment is invalid.");
  }
  if (!levels.includes(draft.evidenceLevel)) {
    throw new Error("Scholarly claim evidence level is invalid.");
  }
  const measuredVariables = draft.measuredVariables.map((value) =>
    requireText(
      canonicalScholarlyVisibleText(value),
      "Scholarly claim measured variable",
      500,
    )
  );
  if (
    measuredVariables.length > 24 ||
    new Set(measuredVariables).size !== measuredVariables.length
  ) throw new Error("Scholarly claim measured variables must be bounded and unique.");
  const fields: ScholarlyClaimFields = {
    theoreticalProposition: canonicalOptionalText(
      draft.theoreticalProposition,
      "Scholarly theoretical proposition",
      4_000,
    ),
    empiricalSetting: canonicalOptionalText(
      draft.empiricalSetting,
      "Scholarly empirical setting",
      2_000,
    ),
    levelOfAnalysis: canonicalOptionalText(
      draft.levelOfAnalysis,
      "Scholarly level of analysis",
      1_000,
    ),
    measuredVariables,
    relevantResultOrQualification: canonicalOptionalText(
      draft.relevantResultOrQualification,
      "Scholarly result or qualification",
      4_000,
    ),
    contextualFit: {
      assessment: draft.contextualFit.assessment,
      rationale: requireText(
        canonicalScholarlyVisibleText(draft.contextualFit.rationale),
        "Scholarly contextual-fit rationale",
        2_000,
      ),
    },
    evidenceLevel: draft.evidenceLevel,
    fieldProvenance: "researcher_supplied",
  };
  if (
    fields.theoreticalProposition === null &&
    fields.empiricalSetting === null &&
    fields.levelOfAnalysis === null &&
    fields.measuredVariables.length === 0 &&
    fields.relevantResultOrQualification === null
  ) {
    throw new Error(
      "A scholarly extraction must record at least one substantive claim field.",
    );
  }
  return fields;
}

function validateFields(fields: ScholarlyClaimFields) {
  const { fieldProvenance, ...draft } = fields;
  if (fieldProvenance !== "researcher_supplied") {
    throw new Error("Scholarly claim field provenance is invalid.");
  }
  const normalized = normalizeFields(draft);
  if (!sameSixScreenValue(fields, normalized)) {
    throw new Error("Scholarly claim fields are not canonical.");
  }
  return fields;
}

function extractionBody(value: ScholarlyClaimExtraction): ExtractionBody {
  const { extractionFingerprint: _fingerprint, ...body } = value;
  return body;
}

function reviewBody(value: ScholarlyClaimReview): ReviewBody {
  const { reviewFingerprint: _fingerprint, ...body } = value;
  return body;
}

function packetBody(value: ScholarlyClaimPacket): PacketBody {
  const { packetFingerprint: _fingerprint, ...body } = value;
  return body;
}

export function createScholarlyClaimExtraction(input: {
  extractionId: string;
  passagePacket: ScholarlyPassagePacket;
  acquisition: ScholarlyDocumentAcquisition;
  priorExtractions: readonly ScholarlyClaimExtraction[];
  fields: ScholarlyClaimFieldsDraft;
  actor: "researcher_ui" | "model" | "system";
  extractedAt: string;
}): ScholarlyClaimExtraction {
  requireBoundedIdentifier(input.extractionId, "Scholarly extraction id");
  requireCanonicalInstant(input.extractedAt, "Scholarly extraction time");
  if (input.actor !== "researcher_ui") {
    throw new Error(
      "Only an explicit researcher UI action can author a scholarly claim extraction.",
    );
  }
  validateScholarlyDocumentAcquisition(input.acquisition);
  const document = input.acquisition.document;
  const passage = input.acquisition.passage;
  if (
    !document || !passage || document.inspectionStatus !== "partial_text" ||
    passage.inspectionStatus !== "partial_text" ||
    passage.detailedClaimUse !== "eligible_for_later_researcher_review" ||
    !input.passagePacket.eligiblePassageIds.includes(passage.id) ||
    !input.passagePacket.passageReferences.some((reference) =>
      reference.passageId === passage.id &&
      reference.passageFingerprint === passage.passageFingerprint)
  ) {
    throw new Error(
      "A scholarly claim extraction requires one exact eligible partial-text passage.",
    );
  }
  const sameParent = input.priorExtractions.filter((claim) =>
    claim.binding.metadataPacketSnapshotId ===
      input.passagePacket.binding.metadataPacketSnapshotId
  );
  const body: ExtractionBody = {
    schemaVersion: SIX_SCREEN_SCHOLARLY_CLAIM_EXTRACTION_VERSION,
    id: input.extractionId,
    ordinal: sameParent.length + 1,
    binding: {
      literaturePlanSnapshotId:
        input.passagePacket.binding.literaturePlanSnapshotId,
      literaturePlanFingerprint:
        input.passagePacket.binding.literaturePlanFingerprint,
      metadataExecutionSnapshotId:
        input.passagePacket.binding.metadataExecutionSnapshotId,
      metadataExecutionFingerprint:
        input.passagePacket.binding.metadataExecutionFingerprint,
      metadataPacketSnapshotId:
        input.passagePacket.binding.metadataPacketSnapshotId,
      metadataPacketFingerprint:
        input.passagePacket.binding.metadataPacketFingerprint,
      passagePacketSnapshotId: input.passagePacket.snapshotId,
      passagePacketFingerprint: input.passagePacket.packetFingerprint,
    },
    acquisitionReference: {
      acquisitionId: input.acquisition.id,
      acquisitionFingerprint: input.acquisition.acquisitionFingerprint,
    },
    documentReference: {
      documentId: document.id,
      documentFingerprint: document.documentFingerprint,
      documentVersionId: document.documentVersionId,
      canonicalUrl: document.canonicalUrl,
      title: document.title,
      doi: document.doi,
      contentHash: document.contentHash,
      normalizedTextHash: document.normalizedTextHash,
      inspectionStatus: "partial_text",
    },
    passageReference: {
      passageId: passage.id,
      passageFingerprint: passage.passageFingerprint,
      sourceId: passage.sourceId,
      documentVersionId: passage.documentVersionId,
      quoteHash: passage.quoteHash,
      exactOffsets: {
        start: passage.startOffset,
        end: passage.endOffset,
      },
      exactText: passage.exactText,
      locator: passage.locator,
      qualification: passage.qualification,
      detailedClaimUse: "eligible_for_later_researcher_review",
    },
    fields: normalizeFields(input.fields),
    actor: "researcher",
    extractionMethod: "researcher_authored_from_exact_passage",
    extractedAt: input.extractedAt,
    claimBoundary: EXTRACTION_BOUNDARY,
  };
  return validateScholarlyClaimExtraction({
    ...body,
    extractionFingerprint: fingerprintSixScreenValue(body),
  });
}

export function validateScholarlyClaimExtraction(
  extraction: ScholarlyClaimExtraction,
) {
  if (
    extraction.schemaVersion !== SIX_SCREEN_SCHOLARLY_CLAIM_EXTRACTION_VERSION ||
    extraction.extractionFingerprint !==
      fingerprintSixScreenValue(extractionBody(extraction)) ||
    !Number.isSafeInteger(extraction.ordinal) || extraction.ordinal < 1 ||
    extraction.actor !== "researcher" ||
    extraction.extractionMethod !==
      "researcher_authored_from_exact_passage" ||
    extraction.documentReference.inspectionStatus !== "partial_text" ||
    extraction.passageReference.detailedClaimUse !==
      "eligible_for_later_researcher_review" ||
    extraction.passageReference.documentVersionId !==
      extraction.documentReference.documentVersionId ||
    extraction.passageReference.exactOffsets.start < 0 ||
    extraction.passageReference.exactOffsets.end <=
      extraction.passageReference.exactOffsets.start ||
    extraction.passageReference.exactOffsets.end -
      extraction.passageReference.exactOffsets.start !==
        extraction.passageReference.exactText.length ||
    extraction.claimBoundary !== EXTRACTION_BOUNDARY
  ) throw new Error("Scholarly claim extraction is invalid.");
  [
    extraction.id,
    extraction.binding.literaturePlanSnapshotId,
    extraction.binding.metadataExecutionSnapshotId,
    extraction.binding.metadataPacketSnapshotId,
    extraction.binding.passagePacketSnapshotId,
    extraction.acquisitionReference.acquisitionId,
    extraction.documentReference.documentId,
    extraction.documentReference.documentVersionId,
    extraction.passageReference.passageId,
    extraction.passageReference.sourceId,
  ].forEach((id) => requireBoundedIdentifier(id, "Scholarly claim coordinate"));
  [
    extraction.binding.literaturePlanFingerprint,
    extraction.binding.metadataExecutionFingerprint,
    extraction.binding.metadataPacketFingerprint,
    extraction.binding.passagePacketFingerprint,
    extraction.acquisitionReference.acquisitionFingerprint,
    extraction.documentReference.documentFingerprint,
    extraction.passageReference.passageFingerprint,
  ].forEach((value) => requireFingerprint(value, "Scholarly claim lineage"));
  [
    extraction.documentReference.contentHash,
    extraction.documentReference.normalizedTextHash,
    extraction.passageReference.quoteHash,
  ].forEach((value) => {
    if (!/^sha256:[0-9a-f]{64}$/u.test(value)) {
      throw new Error("Scholarly claim content hash is invalid.");
    }
  });
  requireSanitizedSourceUrl(extraction.documentReference.canonicalUrl);
  requireText(extraction.documentReference.title, "Scholarly document title", 2_000);
  requireText(
    extraction.passageReference.exactText,
    "Scholarly claim exact passage",
    4_000,
  );
  requireText(extraction.passageReference.locator, "Scholarly claim locator", 500);
  requireText(
    extraction.passageReference.qualification,
    "Scholarly claim source qualification",
    2_000,
  );
  requireCanonicalInstant(extraction.extractedAt, "Scholarly extraction time");
  validateFields(extraction.fields);
  return extraction;
}

export function validateScholarlyClaimExtractionLineage(
  extraction: ScholarlyClaimExtraction,
  passagePacket: ScholarlyPassagePacket,
  acquisition: ScholarlyDocumentAcquisition,
) {
  validateScholarlyClaimExtraction(extraction);
  validateScholarlyDocumentAcquisition(acquisition);
  const document = acquisition.document;
  const passage = acquisition.passage;
  if (
    !document || !passage ||
    extraction.binding.passagePacketSnapshotId !== passagePacket.snapshotId ||
    extraction.binding.passagePacketFingerprint !==
      passagePacket.packetFingerprint ||
    extraction.binding.metadataPacketSnapshotId !==
      passagePacket.binding.metadataPacketSnapshotId ||
    extraction.binding.metadataPacketFingerprint !==
      passagePacket.binding.metadataPacketFingerprint ||
    extraction.acquisitionReference.acquisitionId !== acquisition.id ||
    extraction.acquisitionReference.acquisitionFingerprint !==
      acquisition.acquisitionFingerprint ||
    !sameSixScreenValue(extraction.documentReference, {
      documentId: document.id,
      documentFingerprint: document.documentFingerprint,
      documentVersionId: document.documentVersionId,
      canonicalUrl: document.canonicalUrl,
      title: document.title,
      doi: document.doi,
      contentHash: document.contentHash,
      normalizedTextHash: document.normalizedTextHash,
      inspectionStatus: "partial_text",
    }) ||
    !sameSixScreenValue(extraction.passageReference, {
      passageId: passage.id,
      passageFingerprint: passage.passageFingerprint,
      sourceId: passage.sourceId,
      documentVersionId: passage.documentVersionId,
      quoteHash: passage.quoteHash,
      exactOffsets: { start: passage.startOffset, end: passage.endOffset },
      exactText: passage.exactText,
      locator: passage.locator,
      qualification: passage.qualification,
      detailedClaimUse: "eligible_for_later_researcher_review",
    }) ||
    !passagePacket.eligiblePassageIds.includes(passage.id)
  ) throw new Error("Scholarly claim extraction changed its exact source lineage.");
  return extraction;
}

export function createScholarlyClaimReview(input: {
  reviewId: string;
  extraction: ScholarlyClaimExtraction;
  priorReviews: readonly ScholarlyClaimReview[];
  decision: ScholarlyClaimReviewDecision;
  rationale: string;
  actor: "researcher_ui" | "model" | "system";
  reviewedAt: string;
}): ScholarlyClaimReview {
  requireBoundedIdentifier(input.reviewId, "Scholarly claim review id");
  requireCanonicalInstant(input.reviewedAt, "Scholarly claim review time");
  requireText(
    canonicalScholarlyVisibleText(input.rationale),
    "Scholarly claim review rationale",
    2_000,
  );
  if (input.actor !== "researcher_ui") {
    throw new Error(
      "Only an explicit researcher UI action can review a scholarly claim.",
    );
  }
  validateScholarlyClaimExtraction(input.extraction);
  const sameClaim = input.priorReviews.filter((review) =>
    review.extractionReference.extractionId === input.extraction.id
  );
  if (
    sameClaim.length >= SIX_SCREEN_SCHOLARLY_CLAIM_MAX_REVIEWS_PER_EXTRACTION ||
    (sameClaim.length > 0 && sameClaim.at(-1)?.decision !== "deferred")
  ) {
    throw new Error(
      "A scholarly claim permits one review, plus one final review after deferral.",
    );
  }
  const corrected = input.decision.mode === "corrected"
    ? normalizeFields(input.decision.correction)
    : null;
  if (corrected && sameSixScreenValue(corrected, input.extraction.fields)) {
    throw new Error("A corrected scholarly claim must change at least one field.");
  }
  const finalFields = input.decision.mode === "accepted"
    ? structuredClone(input.extraction.fields)
    : corrected;
  const previous = sameClaim.at(-1) ?? null;
  const body: ReviewBody = {
    schemaVersion: SIX_SCREEN_SCHOLARLY_CLAIM_REVIEW_VERSION,
    id: input.reviewId,
    ordinal: sameClaim.length + 1,
    extractionReference: {
      extractionId: input.extraction.id,
      extractionFingerprint: input.extraction.extractionFingerprint,
      passageId: input.extraction.passageReference.passageId,
      passageFingerprint:
        input.extraction.passageReference.passageFingerprint,
    },
    previousReview: previous
      ? {
          reviewId: previous.id,
          reviewFingerprint: previous.reviewFingerprint,
          decision: previous.decision,
        }
      : null,
    decision: input.decision.mode,
    finalFields,
    acceptedForLaterSynthesis: finalFields !== null,
    rationale: canonicalScholarlyVisibleText(input.rationale),
    actor: "researcher",
    reviewedAt: input.reviewedAt,
    sourceEvidenceMutation: "none",
    mechanismMutation: "none",
    claimBoundary: REVIEW_BOUNDARY,
  };
  return validateScholarlyClaimReview({
    ...body,
    reviewFingerprint: fingerprintSixScreenValue(body),
  }, input.extraction, sameClaim);
}

export function validateScholarlyClaimReview(
  review: ScholarlyClaimReview,
  extraction: ScholarlyClaimExtraction,
  priorReviews: readonly ScholarlyClaimReview[],
) {
  validateScholarlyClaimExtraction(extraction);
  const sameClaim = priorReviews.filter((item) =>
    item.extractionReference.extractionId === extraction.id
  );
  const previous = sameClaim.at(-1) ?? null;
  const decisions: readonly ScholarlyClaimReviewDecision["mode"][] = [
    "accepted",
    "rejected",
    "deferred",
    "corrected",
  ];
  if (
    review.schemaVersion !== SIX_SCREEN_SCHOLARLY_CLAIM_REVIEW_VERSION ||
    review.reviewFingerprint !== fingerprintSixScreenValue(reviewBody(review)) ||
    review.ordinal !== sameClaim.length + 1 ||
    !decisions.includes(review.decision) ||
    review.extractionReference.extractionId !== extraction.id ||
    review.extractionReference.extractionFingerprint !==
      extraction.extractionFingerprint ||
    review.extractionReference.passageId !==
      extraction.passageReference.passageId ||
    review.extractionReference.passageFingerprint !==
      extraction.passageReference.passageFingerprint ||
    !sameSixScreenValue(review.previousReview, previous
      ? {
          reviewId: previous.id,
          reviewFingerprint: previous.reviewFingerprint,
          decision: previous.decision,
        }
      : null) ||
    (sameClaim.length > 0 && previous?.decision !== "deferred") ||
    sameClaim.length >= SIX_SCREEN_SCHOLARLY_CLAIM_MAX_REVIEWS_PER_EXTRACTION ||
    review.acceptedForLaterSynthesis !==
      (review.decision === "accepted" || review.decision === "corrected") ||
    (review.acceptedForLaterSynthesis !== (review.finalFields !== null)) ||
    review.actor !== "researcher" ||
    review.sourceEvidenceMutation !== "none" ||
    review.mechanismMutation !== "none" ||
    review.claimBoundary !== REVIEW_BOUNDARY
  ) throw new Error("Scholarly claim review is invalid.");
  requireBoundedIdentifier(review.id, "Scholarly claim review id");
  requireText(review.rationale, "Scholarly claim review rationale", 2_000);
  requireCanonicalInstant(review.reviewedAt, "Scholarly claim review time");
  if (Date.parse(review.reviewedAt) < Date.parse(extraction.extractedAt)) {
    throw new Error("Scholarly claim review predates its extraction.");
  }
  if (review.finalFields) {
    validateFields(review.finalFields);
    if (
      review.decision === "corrected" &&
      sameSixScreenValue(review.finalFields, extraction.fields)
    ) throw new Error("Corrected scholarly claim fields did not change.");
    if (
      review.decision === "accepted" &&
      !sameSixScreenValue(review.finalFields, extraction.fields)
    ) throw new Error("Accepted scholarly claim fields changed during review.");
  }
  return review;
}

function latestReviews(
  extractions: readonly ScholarlyClaimExtraction[],
  reviews: readonly ScholarlyClaimReview[],
) {
  const latest = new Map<string, ScholarlyClaimReview>();
  for (const extraction of extractions) {
    const own = reviews.filter((review) =>
      review.extractionReference.extractionId === extraction.id
    );
    if (own.length) latest.set(extraction.id, own.at(-1)!);
  }
  return latest;
}

function expectedPacketBody(input: {
  snapshotId: string;
  passagePacket: ScholarlyPassagePacket;
  previous: ScholarlyClaimPacket | null;
  changeReference: ScholarlyClaimPacketChangeReference;
  extractions: readonly ScholarlyClaimExtraction[];
  reviews: readonly ScholarlyClaimReview[];
  createdAt: string;
}): PacketBody {
  const latest = latestReviews(input.extractions, input.reviews);
  const unreviewedExtractionIds = input.extractions.filter((extraction) =>
    !latest.has(extraction.id)
  ).map(({ id }) => id);
  const deferredExtractionIds = input.extractions.filter((extraction) =>
    latest.get(extraction.id)?.decision === "deferred"
  ).map(({ id }) => id);
  const rejectedExtractionIds = input.extractions.filter((extraction) =>
    latest.get(extraction.id)?.decision === "rejected"
  ).map(({ id }) => id);
  const acceptedClaimReferences = input.extractions.flatMap((extraction) => {
    const review = latest.get(extraction.id);
    return review?.acceptedForLaterSynthesis && review.finalFields
      ? [{
          extractionId: extraction.id,
          extractionFingerprint: extraction.extractionFingerprint,
          reviewId: review.id,
          reviewFingerprint: review.reviewFingerprint,
          finalFieldsFingerprint: fingerprintSixScreenValue(review.finalFields),
        }]
      : [];
  });
  const status = acceptedClaimReferences.length
    ? "reviewed_with_accepted_claims" as const
    : unreviewedExtractionIds.length || deferredExtractionIds.length
      ? "extracted_pending_review" as const
      : "reviewed_none_accepted" as const;
  return {
    schemaVersion: SIX_SCREEN_SCHOLARLY_CLAIM_PACKET_VERSION,
    snapshotId: input.snapshotId,
    ordinal: (input.previous?.ordinal ?? 0) + 1,
    binding: {
      metadataPacketSnapshotId:
        input.passagePacket.binding.metadataPacketSnapshotId,
      metadataPacketFingerprint:
        input.passagePacket.binding.metadataPacketFingerprint,
      passagePacketSnapshotId: input.passagePacket.snapshotId,
      passagePacketFingerprint: input.passagePacket.packetFingerprint,
      previousClaimPacketSnapshotId: input.previous?.snapshotId ?? null,
    },
    changeReference: structuredClone(input.changeReference),
    extractionReferences: input.extractions.map((extraction) => ({
      extractionId: extraction.id,
      extractionFingerprint: extraction.extractionFingerprint,
      passageId: extraction.passageReference.passageId,
      passageFingerprint: extraction.passageReference.passageFingerprint,
    })),
    reviewReferences: input.reviews.map((review) => ({
      reviewId: review.id,
      reviewFingerprint: review.reviewFingerprint,
      extractionId: review.extractionReference.extractionId,
      decision: review.decision,
      acceptedForLaterSynthesis: review.acceptedForLaterSynthesis,
    })),
    unreviewedExtractionIds,
    deferredExtractionIds,
    rejectedExtractionIds,
    acceptedClaimReferences,
    detailedClaims: {
      status,
      extractionCount: input.extractions.length,
      reviewCount: input.reviews.length,
      acceptedCount: acceptedClaimReferences.length,
    },
    mechanismGeneration: {
      status: "blocked",
      reasons: acceptedClaimReferences.length
        ? [
            "genuine_intelligence_path_unverified",
            "mechanism_synthesis_not_implemented",
          ]
        : [
            "genuine_intelligence_path_unverified",
            "scholarly_claims_not_accepted",
          ],
    },
    mechanismCandidates: [],
    predictionMatrix: null,
    claimBoundary: PACKET_BOUNDARY,
    createdAt: input.createdAt,
  };
}

export function createScholarlyClaimPacket(input: {
  snapshotId: string;
  passagePacket: ScholarlyPassagePacket;
  previous: ScholarlyClaimPacket | null;
  changeReference: ScholarlyClaimPacketChangeReference;
  extractions: readonly ScholarlyClaimExtraction[];
  reviews: readonly ScholarlyClaimReview[];
  createdAt: string;
}) {
  requireBoundedIdentifier(input.snapshotId, "Scholarly claim packet id");
  requireCanonicalInstant(input.createdAt, "Scholarly claim packet time");
  if (!input.extractions.length) {
    throw new Error("A scholarly claim packet requires an extraction.");
  }
  const body = expectedPacketBody(input);
  return validateScholarlyClaimPacket({
    ...body,
    packetFingerprint: fingerprintSixScreenValue(body),
  }, input);
}

export function validateScholarlyClaimPacket(
  packet: ScholarlyClaimPacket,
  context: {
    passagePacket: ScholarlyPassagePacket;
    previous: ScholarlyClaimPacket | null;
    changeReference: ScholarlyClaimPacketChangeReference;
    extractions: readonly ScholarlyClaimExtraction[];
    reviews: readonly ScholarlyClaimReview[];
    createdAt?: string;
  },
) {
  const expected = expectedPacketBody({
    snapshotId: packet.snapshotId,
    passagePacket: context.passagePacket,
    previous: context.previous,
    changeReference: context.changeReference,
    extractions: context.extractions,
    reviews: context.reviews,
    createdAt: context.createdAt ?? packet.createdAt,
  });
  if (
    packet.schemaVersion !== SIX_SCREEN_SCHOLARLY_CLAIM_PACKET_VERSION ||
    packet.packetFingerprint !== fingerprintSixScreenValue(packetBody(packet)) ||
    !sameSixScreenValue(packetBody(packet), expected) ||
    packet.mechanismGeneration.status !== "blocked" ||
    packet.mechanismCandidates.length !== 0 || packet.predictionMatrix !== null ||
    packet.claimBoundary !== PACKET_BOUNDARY ||
    bytes(packet) > SIX_SCREEN_SCHOLARLY_CLAIM_COLLECTION_MAX_BYTES
  ) throw new Error("Scholarly claim packet is invalid.");
  requireBoundedIdentifier(packet.snapshotId, "Scholarly claim packet id");
  requireCanonicalInstant(packet.createdAt, "Scholarly claim packet time");
  return packet;
}

export function validateScholarlyClaimCollections(input: {
  acquisitions: readonly ScholarlyDocumentAcquisition[];
  passagePackets: readonly ScholarlyPassagePacket[];
  extractions: readonly ScholarlyClaimExtraction[];
  reviews: readonly ScholarlyClaimReview[];
  claimPackets: readonly ScholarlyClaimPacket[];
}) {
  if (
    input.extractions.length > SIX_SCREEN_SCHOLARLY_CLAIM_MAX_EXTRACTIONS ||
    input.reviews.length > SIX_SCREEN_SCHOLARLY_CLAIM_MAX_REVIEWS ||
    input.claimPackets.length !== input.extractions.length + input.reviews.length ||
    bytes({
      extractions: input.extractions,
      reviews: input.reviews,
      claimPackets: input.claimPackets,
    }) > SIX_SCREEN_SCHOLARLY_CLAIM_COLLECTION_MAX_BYTES
  ) throw new Error("Stored scholarly claim history exceeds its bounded contract.");

  const passagePacketMap = new Map(input.passagePackets.map((packet) =>
    [packet.snapshotId, packet]
  ));
  const acquisitionMap = new Map(input.acquisitions.map((acquisition) =>
    [acquisition.id, acquisition]
  ));
  const extractionMap = new Map<string, ScholarlyClaimExtraction>();
  const extractionOrdinals = new Map<string, number>();
  for (const extraction of input.extractions) {
    if (extractionMap.has(extraction.id)) {
      throw new Error("Stored scholarly extraction ids must be unique.");
    }
    const passagePacket = passagePacketMap.get(
      extraction.binding.passagePacketSnapshotId,
    );
    const acquisition = acquisitionMap.get(
      extraction.acquisitionReference.acquisitionId,
    );
    if (!passagePacket || !acquisition) {
      throw new Error("Stored scholarly extraction lost its source lineage.");
    }
    validateScholarlyClaimExtractionLineage(
      extraction,
      passagePacket,
      acquisition,
    );
    const parent = extraction.binding.metadataPacketSnapshotId;
    const ordinal = (extractionOrdinals.get(parent) ?? 0) + 1;
    if (extraction.ordinal !== ordinal) {
      throw new Error("Stored scholarly extraction ordinal is invalid.");
    }
    extractionOrdinals.set(parent, ordinal);
    extractionMap.set(extraction.id, extraction);
  }

  const reviewMap = new Map<string, ScholarlyClaimReview>();
  const priorReviews = new Map<string, ScholarlyClaimReview[]>();
  for (const review of input.reviews) {
    if (reviewMap.has(review.id)) {
      throw new Error("Stored scholarly claim review ids must be unique.");
    }
    const extraction = extractionMap.get(
      review.extractionReference.extractionId,
    );
    if (!extraction) {
      throw new Error("Stored scholarly claim review lost its extraction.");
    }
    const prior = priorReviews.get(extraction.id) ?? [];
    validateScholarlyClaimReview(review, extraction, prior);
    priorReviews.set(extraction.id, [...prior, review]);
    reviewMap.set(review.id, review);
  }

  const packetIds = new Set<string>();
  const lastPacket = new Map<string, ScholarlyClaimPacket>();
  const cumulativeExtractions = new Map<string, ScholarlyClaimExtraction[]>();
  const cumulativeReviews = new Map<string, ScholarlyClaimReview[]>();
  const referencedExtractions = new Set<string>();
  const referencedReviews = new Set<string>();
  for (const packet of input.claimPackets) {
    if (packetIds.has(packet.snapshotId)) {
      throw new Error("Stored scholarly claim packet ids must be unique.");
    }
    packetIds.add(packet.snapshotId);
    const parent = packet.binding.metadataPacketSnapshotId;
    const passagePacket = passagePacketMap.get(
      packet.binding.passagePacketSnapshotId,
    );
    if (
      !passagePacket || packet.binding.passagePacketFingerprint !==
        passagePacket.packetFingerprint ||
      packet.binding.metadataPacketFingerprint !==
        passagePacket.binding.metadataPacketFingerprint
    ) throw new Error("Stored scholarly claim packet lost its passage parent.");
    const previous = lastPacket.get(parent) ?? null;
    const extractions = [...(cumulativeExtractions.get(parent) ?? [])];
    const reviews = [...(cumulativeReviews.get(parent) ?? [])];
    if (packet.changeReference.kind === "claim_extracted") {
      const extraction = extractionMap.get(packet.changeReference.id);
      if (
        !extraction || referencedExtractions.has(extraction.id) ||
        extraction.binding.metadataPacketSnapshotId !== parent ||
        extraction.extractionFingerprint !== packet.changeReference.fingerprint
      ) throw new Error("Scholarly claim packet extraction change is invalid.");
      extractions.push(extraction);
      referencedExtractions.add(extraction.id);
    } else {
      const review = reviewMap.get(packet.changeReference.id);
      const extraction = review
        ? extractionMap.get(review.extractionReference.extractionId)
        : null;
      if (
        !review || !extraction || referencedReviews.has(review.id) ||
        extraction.binding.metadataPacketSnapshotId !== parent ||
        !extractions.some(({ id }) => id === extraction.id) ||
        review.reviewFingerprint !== packet.changeReference.fingerprint
      ) throw new Error("Scholarly claim packet review change is invalid.");
      reviews.push(review);
      referencedReviews.add(review.id);
    }
    if (extractions.some((extraction) =>
      !passagePacket.passageReferences.some((reference) =>
        reference.passageId === extraction.passageReference.passageId &&
        reference.passageFingerprint ===
          extraction.passageReference.passageFingerprint &&
        reference.detailedClaimUse ===
          "eligible_for_later_researcher_review"
      )
    )) {
      throw new Error(
        "Scholarly claim packet does not preserve every source passage.",
      );
    }
    validateScholarlyClaimPacket(packet, {
      passagePacket,
      previous,
      changeReference: packet.changeReference,
      extractions,
      reviews,
    });
    lastPacket.set(parent, packet);
    cumulativeExtractions.set(parent, extractions);
    cumulativeReviews.set(parent, reviews);
  }
  if (
    referencedExtractions.size !== input.extractions.length ||
    referencedReviews.size !== input.reviews.length
  ) throw new Error("Stored scholarly claim history has an orphan record.");
  return input;
}
