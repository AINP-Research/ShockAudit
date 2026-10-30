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
  validateMechanismLiteraturePlan,
  type MechanismExplanationInput,
  type MechanismLiteraturePlan,
  type MechanismPolicyPremise,
} from "./mechanism-literature-plan";
import type { ScholarlyEvidencePacket } from
  "./mechanism-literature-execution";
import {
  validateScholarlyClaimExtractionLineage,
  validateScholarlyClaimReview,
  type ScholarlyClaimExtraction,
  type ScholarlyClaimFields,
  type ScholarlyClaimPacket,
  type ScholarlyClaimReview,
} from "./mechanism-scholarly-claim-review";
import type {
  ScholarlyDocumentAcquisition,
  ScholarlyPassagePacket,
} from "./mechanism-scholarly-document";

export const SIX_SCREEN_MECHANISM_SYNTHESIS_INPUT_VERSION =
  "screen-05-mechanism-synthesis-input-v1" as const;
export const SIX_SCREEN_MECHANISM_SYNTHESIS_INPUT_MAX_PACKETS = 24;
export const SIX_SCREEN_MECHANISM_SYNTHESIS_INPUT_MAX_BYTES = 512_000;
export const SIX_SCREEN_MECHANISM_SYNTHESIS_INPUT_COLLECTION_MAX_BYTES =
  4_000_000;

const SYNTHESIS_INPUT_BOUNDARY =
  "This frozen packet contains only reviewed policy premises, the saved study outcome and construct, the researcher's starting explanation and known alternatives, and accepted or corrected scholarly claims with exact source lineage. Fixed software prepared it without a network or model call. It is not a theory card, mechanism, inferred bridge, prediction, measure recommendation, causal estimate, or researcher mechanism decision.";

export type MechanismSynthesisAcceptedClaim = {
  extractionReference: {
    extractionId: string;
    extractionFingerprint: string;
  };
  reviewReference: {
    reviewId: string;
    reviewFingerprint: string;
    decision: "accepted" | "corrected";
    rationale: string;
    reviewedAt: string;
  };
  sourceLineage: {
    acquisitionReference: ScholarlyClaimExtraction["acquisitionReference"];
    documentReference: ScholarlyClaimExtraction["documentReference"];
    passageReference: ScholarlyClaimExtraction["passageReference"];
  };
  originalFields: ScholarlyClaimFields;
  reviewedFields: ScholarlyClaimFields;
  reviewedFieldsFingerprint: string;
};

export type MechanismSynthesisInputPacket = {
  schemaVersion: typeof SIX_SCREEN_MECHANISM_SYNTHESIS_INPUT_VERSION;
  snapshotId: string;
  ordinal: number;
  binding: {
    literaturePlanSnapshotId: string;
    literaturePlanFingerprint: string;
    studyRevision: number;
    identityFingerprint: string;
    eventCardSnapshotId: string;
    eventCardFingerprint: string;
    metadataPacketSnapshotId: string;
    metadataPacketFingerprint: string;
    passagePacketSnapshotId: string;
    passagePacketFingerprint: string;
    claimPacketSnapshotId: string;
    claimPacketFingerprint: string;
  };
  policyPremises: MechanismPolicyPremise[];
  study: {
    outcome: string;
    intendedConstruct: string;
    resultsPreviouslyInspected:
      MechanismLiteraturePlan["study"]["resultsPreviouslyInspected"];
  };
  researcherContext: {
    initialExplanation: MechanismExplanationInput;
    knownAlternativeAccounts: string[];
  };
  knownConstraints: {
    designReview: MechanismLiteraturePlan["upstreamStatus"]["designReview"];
    coEventReview: MechanismLiteraturePlan["upstreamStatus"]["coEventReview"];
    coEventRelationAnalysis:
      MechanismLiteraturePlan["upstreamStatus"]["coEventRelationAnalysis"];
    scholarlyCoverage: "bounded_exact_partial_text_only";
  };
  acceptedScholarlyClaims: MechanismSynthesisAcceptedClaim[];
  eligibility: {
    includedReviewDecisions: ["accepted", "corrected"];
    excludedMaterial: [
      "unreviewed_claims",
      "rejected_claims",
      "deferred_claims",
      "abstract_only_passages",
      "metadata_only_records",
    ];
  };
  preparation: {
    actor: "researcher";
    method: "deterministic_fixed_software";
    networkRequests: 0;
    modelCalls: 0;
  };
  synthesis: {
    status: "blocked";
    reasons: [
      "genuine_intelligence_path_unverified",
      "mechanism_synthesis_not_implemented",
    ];
  };
  nonOutputs: {
    theoryCards: [];
    mechanismCandidates: [];
    inferredBridges: [];
    predictions: [];
    measurementRecommendations: [];
    causalEstimates: [];
    mechanismReview: null;
    predictionMatrix: null;
  };
  claimBoundary: typeof SYNTHESIS_INPUT_BOUNDARY;
  preparedAt: string;
  packetFingerprint: string;
};

type PacketBody = Omit<MechanismSynthesisInputPacket, "packetFingerprint">;

type SynthesisContext = {
  literaturePlan: MechanismLiteraturePlan;
  metadataPacket: ScholarlyEvidencePacket;
  passagePacket: ScholarlyPassagePacket;
  passagePackets: readonly ScholarlyPassagePacket[];
  claimPacket: ScholarlyClaimPacket;
  acquisitions: readonly ScholarlyDocumentAcquisition[];
  extractions: readonly ScholarlyClaimExtraction[];
  reviews: readonly ScholarlyClaimReview[];
};

function bytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function packetBody(packet: MechanismSynthesisInputPacket): PacketBody {
  const { packetFingerprint: _packetFingerprint, ...body } = packet;
  return body;
}

function validateUpstream(context: SynthesisContext) {
  validateMechanismLiteraturePlan(context.literaturePlan);
  if (
    context.metadataPacket.binding.literaturePlanSnapshotId !==
      context.literaturePlan.snapshotId ||
    context.metadataPacket.binding.literaturePlanFingerprint !==
      context.literaturePlan.planFingerprint ||
    context.passagePacket.binding.metadataPacketSnapshotId !==
      context.metadataPacket.snapshotId ||
    context.passagePacket.binding.metadataPacketFingerprint !==
      context.metadataPacket.packetFingerprint ||
    context.claimPacket.binding.metadataPacketSnapshotId !==
      context.metadataPacket.snapshotId ||
    context.claimPacket.binding.metadataPacketFingerprint !==
      context.metadataPacket.packetFingerprint ||
    context.claimPacket.binding.passagePacketSnapshotId !==
      context.passagePacket.snapshotId ||
    context.claimPacket.binding.passagePacketFingerprint !==
      context.passagePacket.packetFingerprint
  ) throw new Error("Synthesis input lost its current Screen 5 packet lineage.");

  const acquisitionMap = new Map(context.acquisitions.map((acquisition) =>
    [acquisition.id, acquisition]
  ));
  for (const extraction of context.extractions) {
    const acquisition = acquisitionMap.get(
      extraction.acquisitionReference.acquisitionId,
    );
    const extractionPassagePacket = context.passagePackets.find((packet) =>
      packet.snapshotId === extraction.binding.passagePacketSnapshotId &&
      packet.packetFingerprint === extraction.binding.passagePacketFingerprint
    );
    if (!acquisition || !extractionPassagePacket) {
      throw new Error("Synthesis input lost scholarly source lineage.");
    }
    validateScholarlyClaimExtractionLineage(
      extraction,
      extractionPassagePacket,
      acquisition,
    );
  }
  const priorReviews: ScholarlyClaimReview[] = [];
  const extractionMap = new Map(context.extractions.map((extraction) =>
    [extraction.id, extraction]
  ));
  for (const review of context.reviews) {
    const extraction = extractionMap.get(
      review.extractionReference.extractionId,
    );
    if (!extraction) {
      throw new Error("Synthesis input lost a scholarly extraction.");
    }
    validateScholarlyClaimReview(review, extraction, priorReviews);
    priorReviews.push(review);
  }
}

function acceptedClaims(context: SynthesisContext) {
  validateUpstream(context);
  const extractionMap = new Map(context.extractions.map((extraction) =>
    [extraction.id, extraction]
  ));
  const reviewMap = new Map(context.reviews.map((review) =>
    [review.id, review]
  ));
  const latestReview = new Map<string, ScholarlyClaimReview>();
  for (const review of context.reviews) {
    latestReview.set(review.extractionReference.extractionId, review);
  }
  const expectedReferences = context.extractions.flatMap((extraction) => {
    const review = latestReview.get(extraction.id);
    return review?.acceptedForLaterSynthesis && review.finalFields
      ? [{
          extractionId: extraction.id,
          extractionFingerprint: extraction.extractionFingerprint,
          reviewId: review.id,
          reviewFingerprint: review.reviewFingerprint,
          finalFieldsFingerprint: fingerprintSixScreenValue(
            review.finalFields,
          ),
        }]
      : [];
  });
  if (!sameSixScreenValue(
    context.claimPacket.acceptedClaimReferences,
    expectedReferences,
  )) throw new Error("Synthesis input did not include every accepted claim.");
  const claims = context.claimPacket.acceptedClaimReferences.map((reference) => {
    const extraction = extractionMap.get(reference.extractionId);
    const review = reviewMap.get(reference.reviewId);
    if (
      !extraction || !review || latestReview.get(extraction.id)?.id !==
        review.id ||
      extraction.extractionFingerprint !== reference.extractionFingerprint ||
      review.reviewFingerprint !== reference.reviewFingerprint ||
      !review.acceptedForLaterSynthesis || !review.finalFields ||
      (review.decision !== "accepted" && review.decision !== "corrected") ||
      fingerprintSixScreenValue(review.finalFields) !==
        reference.finalFieldsFingerprint
    ) throw new Error("Synthesis input contains an unaccepted scholarly claim.");
    return {
      extractionReference: {
        extractionId: extraction.id,
        extractionFingerprint: extraction.extractionFingerprint,
      },
      reviewReference: {
        reviewId: review.id,
        reviewFingerprint: review.reviewFingerprint,
        decision: review.decision,
        rationale: review.rationale,
        reviewedAt: review.reviewedAt,
      },
      sourceLineage: {
        acquisitionReference: structuredClone(extraction.acquisitionReference),
        documentReference: structuredClone(extraction.documentReference),
        passageReference: structuredClone(extraction.passageReference),
      },
      originalFields: structuredClone(extraction.fields),
      reviewedFields: structuredClone(review.finalFields),
      reviewedFieldsFingerprint: reference.finalFieldsFingerprint,
    } satisfies MechanismSynthesisAcceptedClaim;
  });
  if (!claims.length) {
    throw new Error(
      "Synthesis input requires at least one accepted or corrected claim.",
    );
  }
  return claims;
}

function expectedBody(input: {
  snapshotId: string;
  ordinal: number;
  context: SynthesisContext;
  preparedAt: string;
}): PacketBody {
  const { literaturePlan, metadataPacket, passagePacket, claimPacket } =
    input.context;
  return {
    schemaVersion: SIX_SCREEN_MECHANISM_SYNTHESIS_INPUT_VERSION,
    snapshotId: input.snapshotId,
    ordinal: input.ordinal,
    binding: {
      literaturePlanSnapshotId: literaturePlan.snapshotId,
      literaturePlanFingerprint: literaturePlan.planFingerprint,
      studyRevision: literaturePlan.binding.studyRevision,
      identityFingerprint: literaturePlan.binding.identityFingerprint,
      eventCardSnapshotId:
        literaturePlan.binding.eventCardReference.eventCardSnapshotId,
      eventCardFingerprint:
        literaturePlan.binding.eventCardReference.eventCardFingerprint,
      metadataPacketSnapshotId: metadataPacket.snapshotId,
      metadataPacketFingerprint: metadataPacket.packetFingerprint,
      passagePacketSnapshotId: passagePacket.snapshotId,
      passagePacketFingerprint: passagePacket.packetFingerprint,
      claimPacketSnapshotId: claimPacket.snapshotId,
      claimPacketFingerprint: claimPacket.packetFingerprint,
    },
    policyPremises: structuredClone(literaturePlan.policyPremises),
    study: {
      outcome: literaturePlan.study.outcome,
      intendedConstruct: literaturePlan.study.intendedConstruct,
      resultsPreviouslyInspected:
        literaturePlan.study.resultsPreviouslyInspected,
    },
    researcherContext: {
      initialExplanation: structuredClone(literaturePlan.input.explanation),
      knownAlternativeAccounts: [
        ...literaturePlan.input.knownAlternativeAccounts,
      ],
    },
    knownConstraints: {
      designReview: literaturePlan.upstreamStatus.designReview,
      coEventReview: literaturePlan.upstreamStatus.coEventReview,
      coEventRelationAnalysis:
        literaturePlan.upstreamStatus.coEventRelationAnalysis,
      scholarlyCoverage: "bounded_exact_partial_text_only",
    },
    acceptedScholarlyClaims: acceptedClaims(input.context),
    eligibility: {
      includedReviewDecisions: ["accepted", "corrected"],
      excludedMaterial: [
        "unreviewed_claims",
        "rejected_claims",
        "deferred_claims",
        "abstract_only_passages",
        "metadata_only_records",
      ],
    },
    preparation: {
      actor: "researcher",
      method: "deterministic_fixed_software",
      networkRequests: 0,
      modelCalls: 0,
    },
    synthesis: {
      status: "blocked",
      reasons: [
        "genuine_intelligence_path_unverified",
        "mechanism_synthesis_not_implemented",
      ],
    },
    nonOutputs: {
      theoryCards: [],
      mechanismCandidates: [],
      inferredBridges: [],
      predictions: [],
      measurementRecommendations: [],
      causalEstimates: [],
      mechanismReview: null,
      predictionMatrix: null,
    },
    claimBoundary: SYNTHESIS_INPUT_BOUNDARY,
    preparedAt: input.preparedAt,
  };
}

export function createMechanismSynthesisInputPacket(input: {
  snapshotId: string;
  ordinal: number;
  context: SynthesisContext;
  actor: "researcher_ui" | "model" | "system";
  preparedAt: string;
}) {
  requireBoundedIdentifier(input.snapshotId, "Synthesis-input packet id");
  requireCanonicalInstant(input.preparedAt, "Synthesis-input packet time");
  if (input.actor !== "researcher_ui") {
    throw new Error(
      "Only an explicit researcher UI action can freeze synthesis inputs.",
    );
  }
  if (!Number.isSafeInteger(input.ordinal) || input.ordinal < 1) {
    throw new Error("Synthesis-input packet ordinal is invalid.");
  }
  const body = expectedBody(input);
  return validateMechanismSynthesisInputPacket({
    ...body,
    packetFingerprint: fingerprintSixScreenValue(body),
  }, input.context);
}

export function validateMechanismSynthesisInputPacket(
  packet: MechanismSynthesisInputPacket,
  context: SynthesisContext,
) {
  const expected = expectedBody({
    snapshotId: packet.snapshotId,
    ordinal: packet.ordinal,
    context,
    preparedAt: packet.preparedAt,
  });
  if (
    packet.schemaVersion !== SIX_SCREEN_MECHANISM_SYNTHESIS_INPUT_VERSION ||
    packet.packetFingerprint !== fingerprintSixScreenValue(packetBody(packet)) ||
    !sameSixScreenValue(packetBody(packet), expected) ||
    packet.synthesis.status !== "blocked" ||
    packet.preparation.networkRequests !== 0 ||
    packet.preparation.modelCalls !== 0 ||
    packet.acceptedScholarlyClaims.length < 1 ||
    bytes(packet) > SIX_SCREEN_MECHANISM_SYNTHESIS_INPUT_MAX_BYTES
  ) throw new Error("Mechanism synthesis-input packet is invalid.");
  requireBoundedIdentifier(packet.snapshotId, "Synthesis-input packet id");
  requireCanonicalInstant(packet.preparedAt, "Synthesis-input packet time");
  requireFingerprint(
    packet.packetFingerprint,
    "Synthesis-input packet fingerprint",
  );
  return packet;
}

export function validateMechanismSynthesisInputCollection(input: {
  literaturePlans: readonly MechanismLiteraturePlan[];
  metadataPackets: readonly ScholarlyEvidencePacket[];
  passagePackets: readonly ScholarlyPassagePacket[];
  acquisitions: readonly ScholarlyDocumentAcquisition[];
  extractions: readonly ScholarlyClaimExtraction[];
  reviews: readonly ScholarlyClaimReview[];
  claimPackets: readonly ScholarlyClaimPacket[];
  synthesisInputPackets: readonly MechanismSynthesisInputPacket[];
}) {
  if (
    input.synthesisInputPackets.length >
      SIX_SCREEN_MECHANISM_SYNTHESIS_INPUT_MAX_PACKETS ||
    bytes(input.synthesisInputPackets) >
      SIX_SCREEN_MECHANISM_SYNTHESIS_INPUT_COLLECTION_MAX_BYTES
  ) throw new Error("Stored synthesis-input history exceeds its bounded contract.");
  const ids = new Set<string>();
  const claimParents = new Set<string>();
  for (const [index, packet] of input.synthesisInputPackets.entries()) {
    if (
      ids.has(packet.snapshotId) ||
      claimParents.has(packet.binding.claimPacketSnapshotId) ||
      packet.ordinal !== index + 1
    ) throw new Error("Stored synthesis-input packet lineage is not unique.");
    ids.add(packet.snapshotId);
    claimParents.add(packet.binding.claimPacketSnapshotId);
    const literaturePlan = input.literaturePlans.find((plan) =>
      plan.snapshotId === packet.binding.literaturePlanSnapshotId &&
      plan.planFingerprint === packet.binding.literaturePlanFingerprint
    );
    const metadataPacket = input.metadataPackets.find((value) =>
      value.snapshotId === packet.binding.metadataPacketSnapshotId &&
      value.packetFingerprint === packet.binding.metadataPacketFingerprint
    );
    const passagePacket = input.passagePackets.find((value) =>
      value.snapshotId === packet.binding.passagePacketSnapshotId &&
      value.packetFingerprint === packet.binding.passagePacketFingerprint
    );
    const claimPacket = input.claimPackets.find((value) =>
      value.snapshotId === packet.binding.claimPacketSnapshotId &&
      value.packetFingerprint === packet.binding.claimPacketFingerprint
    );
    if (!literaturePlan || !metadataPacket || !passagePacket || !claimPacket) {
      throw new Error("Stored synthesis-input packet lost an upstream packet.");
    }
    const extractionIds = new Set(
      claimPacket.extractionReferences.map(({ extractionId }) => extractionId),
    );
    const reviewIds = new Set(
      claimPacket.reviewReferences.map(({ reviewId }) => reviewId),
    );
    const extractions = input.extractions.filter((extraction) =>
      extractionIds.has(extraction.id)
    );
    const reviews = input.reviews.filter((review) =>
      reviewIds.has(review.id)
    );
    if (
      extractions.length !== extractionIds.size ||
      reviews.length !== reviewIds.size ||
      extractions.some((extraction) =>
        extraction.binding.metadataPacketSnapshotId !== metadataPacket.snapshotId ||
        extraction.binding.metadataPacketFingerprint !==
          metadataPacket.packetFingerprint)
    ) throw new Error("Stored synthesis-input packet lost claim history.");
    validateMechanismSynthesisInputPacket(packet, {
      literaturePlan,
      metadataPacket,
      passagePacket,
      passagePackets: input.passagePackets,
      claimPacket,
      acquisitions: input.acquisitions,
      extractions,
      reviews,
    });
  }
  return input;
}
