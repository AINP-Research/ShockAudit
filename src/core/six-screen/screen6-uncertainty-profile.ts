import {
  fingerprintSixScreenValue,
  sameSixScreenValue,
} from "./canonical";
import {
  requireBoundedIdentifier,
  requireCanonicalInstant,
  requireFingerprint,
  type ConfirmedShock,
  type StudyContext,
} from "./contracts";
import type {
  CausalDesignDecision,
  CausalDesignSet,
} from "./causal-comparison";
import type { CoEventSearchMatrix } from "./co-event-search";
import type { CoEventSearchExecution } from "./co-event-execution";
import type { CoEventOccurrenceReview } from
  "./co-event-occurrence-review";
import {
  coEventRelationReviewCoverage,
  type CoEventRelationReview,
} from "./co-event-relation-review";
import type { MechanismLiteraturePlan } from
  "./mechanism-literature-plan";
import type { MechanismSynthesisInputPacket } from
  "./mechanism-synthesis-input";
import type {
  MechanismReview,
  PredictionMatrix,
} from "./mechanism-review";
import {
  createPolicyEventCardReference,
  type PolicyEventCardReference,
  type PolicyEventCardReviewState,
} from "./policy-event-card-review";

export const SIX_SCREEN_UNCERTAINTY_PROFILE_VERSION =
  "screen-06-uncertainty-profile-v1" as const;
export const SIX_SCREEN_UNCERTAINTY_PROFILE_MAX_REVISIONS = 24;
export const SIX_SCREEN_UNCERTAINTY_PROFILE_MAX_BYTES = 128_000;
export const SIX_SCREEN_UNCERTAINTY_PROFILE_COLLECTION_MAX_BYTES = 1_000_000;

export const SCREEN6_UNCERTAINTY_DIMENSIONS = [
  "institutional_evidence",
  "assignment_exposure",
  "timing",
  "counterfactual_comparison",
  "competing_events",
  "interference",
  "treatment_versions",
  "outcome_measurement_sample_composition",
  "statistical_inference",
  "mechanism_attribution",
] as const;

export type Screen6UncertaintyDimensionId =
  (typeof SCREEN6_UNCERTAINTY_DIMENSIONS)[number];

export const SCREEN6_UNCERTAINTY_STATES = [
  "not_assessed",
  "planned",
  "evidence_needed",
  "concern_detected",
  "inconclusive",
  "concern_reduced_under_stated_assumptions",
] as const;

export type Screen6UncertaintyState =
  (typeof SCREEN6_UNCERTAINTY_STATES)[number];

export type Screen6UpstreamModuleId =
  | "screen_2_policy_record"
  | "screen_3_comparison"
  | "screen_4_competing_events"
  | "screen_5_mechanism_review";

export type Screen6GapCode =
  | "policy_record_not_assessed"
  | "comparison_review_not_assessed"
  | "comparison_not_selected"
  | "coevent_review_not_assessed"
  | "coevent_execution_incomplete"
  | "coevent_relations_not_assessed"
  | "mechanism_literature_not_assessed"
  | "mechanism_review_not_assessed"
  | "diagnostic_inputs_not_recorded"
  | "diagnostic_results_not_supplied";

export type Screen6ProfileContext = {
  study: StudyContext;
  identityRevision: number;
  confirmedShock: ConfirmedShock;
  eventCardReview: PolicyEventCardReviewState | null;
  designSet: CausalDesignSet | null;
  designDecision: CausalDesignDecision | null;
  coEventMatrix: CoEventSearchMatrix | null;
  coEventExecution: CoEventSearchExecution | null;
  coEventOccurrenceReviews?: CoEventOccurrenceReview[];
  coEventRelationReviews?: CoEventRelationReview[];
  mechanismLiteraturePlan: MechanismLiteraturePlan | null;
  mechanismSynthesisInput: MechanismSynthesisInputPacket | null;
  mechanismReview: MechanismReview | null;
  predictionMatrix: PredictionMatrix | null;
};

export type Screen6UncertaintyProfile = {
  schemaVersion: typeof SIX_SCREEN_UNCERTAINTY_PROFILE_VERSION;
  snapshotId: string;
  ordinal: number;
  binding: {
    studyRevision: number;
    identityRevision: number;
    identityFingerprint: string;
    eventCardReference: PolicyEventCardReference | null;
    design: {
      designSetSnapshotId: string;
      designSetFingerprint: string;
      decisionSnapshotId: string;
      decisionFingerprint: string;
      decision: CausalDesignDecision["decision"];
      selectedDesignSnapshotId: string | null;
    } | null;
    coEvent: {
      kind: "matrix" | "execution";
      snapshotId: string;
      fingerprint: string;
      executionStatus: CoEventSearchExecution["status"] | null;
    } | null;
    coEventRelationReviewReferences?: Array<{
      reviewId: string;
      reviewFingerprint: string;
      candidateId: string;
      decision: CoEventRelationReview["decision"];
      category: CoEventRelationReview["relation"]["category"];
    }>;
    coEventRelationCoverage?: {
      retainedOccurrenceCount: number;
      assessedCandidateCount: number;
      complete: boolean;
    };
    mechanismInput: {
      kind: "literature_plan" | "synthesis_input";
      snapshotId: string;
      fingerprint: string;
    } | null;
    mechanismReview: {
      reviewSnapshotId: string;
      reviewFingerprint: string;
      predictionMatrixSnapshotId: string;
      predictionMatrixFingerprint: string;
      intendedClaim: MechanismReview["intendedClaim"];
      retainedMechanismCount: number;
      predictionCount: number;
      remainingIndistinguishablePairCount: number;
    } | null;
  };
  study: StudyContext;
  policy: {
    identityRevision: number;
    identityFingerprint: string;
    officialTitle: string;
    episode: string;
  };
  upstreamModules: Array<{
    module: Screen6UpstreamModuleId;
    availability: "available" | "partial" | "not_assessed";
    snapshotId: string | null;
    limitation: string | null;
  }>;
  gaps: Array<{
    code: Screen6GapCode;
    message: string;
  }>;
  dimensions: Array<{
    dimension: Screen6UncertaintyDimensionId;
    label: string;
    state: Screen6UncertaintyState;
    concern: string;
    sourceOrAssumption: string;
    sourceSnapshotId: string | null;
    proposedDiagnostic: null;
    currentEvidence: string | null;
    unresolvedLimitation: string;
    response: null;
  }>;
  diagnosticPlanning: {
    status: "not_started";
    methodLibraryVersion: null;
    selectedDiagnosticIds: [];
    cards: [];
  };
  resultsReview: {
    status: "not_supplied";
    history: [];
  };
  credibilitySummary: {
    aggregateScore: null;
    universalBadge: null;
    certification: "not_available";
  };
  nonOutputs: {
    diagnosticResults: [];
    conditionalClaimBoundary: null;
    disposition: null;
    designRecord: null;
  };
  preparation: {
    actor: "researcher";
    method: "deterministic_fixed_software";
    networkRequests: 0;
    modelCalls: 0;
  };
  claimBoundary: string;
  inputFingerprint: string;
  createdAt: string;
  profileFingerprint: string;
};

type ProfileBody = Omit<Screen6UncertaintyProfile, "profileFingerprint">;
type ProfileSeed = Pick<
  Screen6UncertaintyProfile,
  "binding" | "study" | "policy"
>;

const CLAIM_BOUNDARY =
  "This deterministic Screen 6 foundation inventories current upstream gaps across ten separate uncertainty dimensions. It contains no selected diagnostic, diagnostic result, aggregate credibility score, universal badge, conditional causal claim, disposition, or Design Record. An unassessed area is not satisfactory.";

const DIMENSION_DEFINITIONS: ReadonlyArray<{
  dimension: Screen6UncertaintyDimensionId;
  label: string;
  source:
    | "study"
    | "screen_2"
    | "screen_3"
    | "screen_4"
    | "screen_5";
  concern: string;
  unresolvedLimitation: string;
}> = [
  {
    dimension: "institutional_evidence",
    label: "Institutional evidence",
    source: "screen_2",
    concern:
      "Whether the institutional record supports the intended policy and exposure definitions.",
    unresolvedLimitation:
      "No Screen 6 institutional diagnostic has assessed completeness, conflicts, or remaining documentary assumptions.",
  },
  {
    dimension: "assignment_exposure",
    label: "Assignment and exposure",
    source: "screen_3",
    concern:
      "Whether observed assignment and exposure match the selected policy contrast.",
    unresolvedLimitation:
      "Assignment measurement, eligibility reconstruction, compliance, and exposure misclassification have not been assessed in Screen 6.",
  },
  {
    dimension: "timing",
    label: "Timing",
    source: "screen_2",
    concern:
      "Whether announcement, legal effect, compliance, enforcement, and observed response clocks are distinguished correctly.",
    unresolvedLimitation:
      "Anticipation, delayed implementation, and alternative timing definitions have not been assessed in Screen 6.",
  },
  {
    dimension: "counterfactual_comparison",
    label: "Counterfactual comparison",
    source: "screen_3",
    concern:
      "Whether the proposed comparison identifies a credible untreated counterfactual for the intended estimand.",
    unresolvedLimitation:
      "Counterfactual trends, comparator eligibility, and contamination have not been assessed in Screen 6.",
  },
  {
    dimension: "competing_events",
    label: "Competing events",
    source: "screen_4",
    concern:
      "Whether other events could differentially affect the selected comparison or study window.",
    unresolvedLimitation:
      "Occurrence discovery does not establish comparison-specific relevance; relation analysis remains unassessed.",
  },
  {
    dimension: "interference",
    label: "Interference",
    source: "screen_3",
    concern:
      "Whether spillovers, displacement, or shared markets compromise the intended unit-level contrast.",
    unresolvedLimitation:
      "Interference pathways, exposure mapping, and the population consequences of exclusions have not been assessed.",
  },
  {
    dimension: "treatment_versions",
    label: "Treatment versions",
    source: "screen_2",
    concern:
      "Whether units receive materially different policy packages, stages, or implementation versions.",
    unresolvedLimitation:
      "Package, component, stage, and implementation-version separability have not been assessed in Screen 6.",
  },
  {
    dimension: "outcome_measurement_sample_composition",
    label: "Outcome measurement and sample composition",
    source: "study",
    concern:
      "Whether outcome definitions, reporting rules, attrition, or composition changes alter the observed series.",
    unresolvedLimitation:
      "Measurement consistency, reporting changes, missingness, and sample composition have not been assessed.",
  },
  {
    dimension: "statistical_inference",
    label: "Statistical inference",
    source: "screen_3",
    concern:
      "Whether the assignment level, dependence structure, uncertainty calculation, and effective sample support the planned inference.",
    unresolvedLimitation:
      "Inference units, clustering, few-cluster risk, power, and multiplicity have not been assessed in Screen 6.",
  },
  {
    dimension: "mechanism_attribution",
    label: "Mechanism attribution",
    source: "screen_5",
    concern:
      "Whether available evidence can distinguish a mechanism-specific claim from a package-effect claim.",
    unresolvedLimitation:
      "No reviewed mechanism set, discriminating prediction matrix, or mechanism-specific evidence result is available.",
  },
];

function bytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function profileBody(profile: Screen6UncertaintyProfile): ProfileBody {
  const { profileFingerprint: _profileFingerprint, ...body } = profile;
  return body;
}

function seedFromContext(context: Screen6ProfileContext): ProfileSeed {
  const eventCardReference = context.eventCardReview
    ? createPolicyEventCardReference({ review: context.eventCardReview })
    : null;
  const design = context.designSet && context.designDecision
    ? {
        designSetSnapshotId: context.designSet.snapshotId,
        designSetFingerprint: context.designSet.designSetFingerprint,
        decisionSnapshotId: context.designDecision.snapshotId,
        decisionFingerprint: context.designDecision.decisionFingerprint,
        decision: context.designDecision.decision,
        selectedDesignSnapshotId:
          context.designDecision.selectedDesign?.snapshotId ?? null,
      }
    : null;
  const coEvent = context.coEventExecution
    ? {
        kind: "execution" as const,
        snapshotId: context.coEventExecution.snapshotId,
        fingerprint: context.coEventExecution.executionFingerprint,
        executionStatus: context.coEventExecution.status,
      }
    : context.coEventMatrix
    ? {
        kind: "matrix" as const,
        snapshotId: context.coEventMatrix.snapshotId,
        fingerprint: context.coEventMatrix.matrixFingerprint,
        executionStatus: null,
      }
    : null;
  const mechanismInput = context.mechanismSynthesisInput
    ? {
        kind: "synthesis_input" as const,
        snapshotId: context.mechanismSynthesisInput.snapshotId,
        fingerprint: context.mechanismSynthesisInput.packetFingerprint,
      }
    : context.mechanismLiteraturePlan
    ? {
        kind: "literature_plan" as const,
        snapshotId: context.mechanismLiteraturePlan.snapshotId,
        fingerprint: context.mechanismLiteraturePlan.planFingerprint,
      }
    : null;
  const mechanismReview = context.mechanismReview && context.predictionMatrix &&
      context.mechanismSynthesisInput &&
      context.mechanismReview.binding.synthesisInputSnapshotId ===
        context.mechanismSynthesisInput.snapshotId &&
      context.mechanismReview.binding.synthesisInputFingerprint ===
        context.mechanismSynthesisInput.packetFingerprint &&
      context.predictionMatrix.binding.mechanismReviewSnapshotId ===
        context.mechanismReview.snapshotId &&
      context.predictionMatrix.binding.mechanismReviewFingerprint ===
        context.mechanismReview.reviewFingerprint
    ? {
        reviewSnapshotId: context.mechanismReview.snapshotId,
        reviewFingerprint: context.mechanismReview.reviewFingerprint,
        predictionMatrixSnapshotId: context.predictionMatrix.snapshotId,
        predictionMatrixFingerprint: context.predictionMatrix.matrixFingerprint,
        intendedClaim: context.mechanismReview.intendedClaim,
        retainedMechanismCount: context.mechanismReview.mechanisms.filter(
          ({ decision }) => decision === "retained",
        ).length,
        predictionCount: context.predictionMatrix.rows.length,
        remainingIndistinguishablePairCount:
          context.predictionMatrix.compactEvidencePlan
            .remainingIndistinguishablePairs.length,
      }
    : null;
  const currentCandidateIds = context.coEventExecution
    ?.candidateOccurrenceIds ?? [];
  const currentCandidateIdSet = new Set(currentCandidateIds);
  const relationReviews = (context.coEventRelationReviews ?? []).filter(
    (review) => currentCandidateIdSet.has(review.binding.candidateId),
  );
  const relationCoverage = coEventRelationReviewCoverage({
    currentCandidateIds,
    occurrenceReviews: context.coEventOccurrenceReviews ?? [],
    relationReviews,
  });
  const latestOccurrenceByCandidate = new Map<string, CoEventOccurrenceReview>();
  for (const review of context.coEventOccurrenceReviews ?? []) {
    if (currentCandidateIdSet.has(review.candidateReference.candidateId)) {
      latestOccurrenceByCandidate.set(
        review.candidateReference.candidateId,
        review,
      );
    }
  }
  const occurrenceReviewComplete = currentCandidateIds.every((candidateId) => {
    const review = latestOccurrenceByCandidate.get(candidateId);
    return Boolean(review && review.decision !== "deferred");
  });
  return {
    binding: {
      studyRevision: context.study.revision,
      identityRevision: context.identityRevision,
      identityFingerprint: context.confirmedShock.identityFingerprint,
      eventCardReference,
      design,
      coEvent,
      coEventRelationReviewReferences: relationReviews.map((review) => ({
        reviewId: review.id,
        reviewFingerprint: review.reviewFingerprint,
        candidateId: review.binding.candidateId,
        decision: review.decision,
        category: review.relation.category,
      })),
      coEventRelationCoverage: {
        retainedOccurrenceCount:
          relationCoverage.retainedOccurrenceIds.length,
        assessedCandidateCount: relationCoverage.assessedCandidateIds.length,
        complete: Boolean(
          context.coEventExecution?.status === "complete" &&
          occurrenceReviewComplete &&
          relationCoverage.complete,
        ),
      },
      mechanismInput,
      mechanismReview,
    },
    study: structuredClone(context.study),
    policy: {
      identityRevision: context.identityRevision,
      identityFingerprint: context.confirmedShock.identityFingerprint,
      officialTitle: context.confirmedShock.officialTitle,
      episode: context.confirmedShock.episode,
    },
  };
}

function upstreamModules(seed: ProfileSeed): Screen6UncertaintyProfile["upstreamModules"] {
  const eventCard = seed.binding.eventCardReference;
  const design = seed.binding.design;
  const coEvent = seed.binding.coEvent;
  const mechanism = seed.binding.mechanismInput;
  const mechanismReview = seed.binding.mechanismReview;
  const coEventRelationsComplete =
    seed.binding.coEventRelationCoverage?.complete === true;
  return [
    {
      module: "screen_2_policy_record",
      availability: eventCard ? "available" : "not_assessed",
      snapshotId: eventCard?.eventCardSnapshotId ?? null,
      limitation: eventCard
        ? null
        : "No current reviewed Event Card is bound to this profile.",
    },
    {
      module: "screen_3_comparison",
      availability: design ? "available" : "not_assessed",
      snapshotId: design?.decisionSnapshotId ?? null,
      limitation: !design
        ? "No current researcher comparison decision is bound to this profile."
        : design.decision === "no_selection"
        ? "The current researcher decision records no selected comparison."
        : null,
    },
    {
      module: "screen_4_competing_events",
      availability: !coEvent
        ? "not_assessed"
        : coEventRelationsComplete
        ? "available"
        : "partial",
      snapshotId: coEvent?.snapshotId ?? null,
      limitation: !coEvent
        ? "No current Screen 4 occurrence-work snapshot is bound to this profile."
        : coEvent.kind === "matrix" || coEvent.executionStatus !== "complete"
        ? "Screen 4 occurrence work is incomplete and relation analysis is not available."
        : coEventRelationsComplete
        ? null
        : "Screen 4 occurrence work is available, but comparison-specific researcher relation review is incomplete.",
    },
    {
      module: "screen_5_mechanism_review",
      availability: mechanismReview
        ? "available"
        : mechanism
        ? "partial"
        : "not_assessed",
      snapshotId: mechanismReview?.reviewSnapshotId ??
        mechanism?.snapshotId ?? null,
      limitation: !mechanism
        ? "No current Screen 5 literature or synthesis-input snapshot is bound to this profile."
        : mechanismReview
        ? null
        : "Screen 5 documentary inputs are available, but no MechanismReview or PredictionMatrix exists.",
    },
  ];
}

function gaps(seed: ProfileSeed): Screen6UncertaintyProfile["gaps"] {
  const values: Screen6UncertaintyProfile["gaps"] = [];
  if (!seed.binding.eventCardReference) values.push({
    code: "policy_record_not_assessed",
    message: "Screen 2 has no current reviewed Event Card.",
  });
  if (!seed.binding.design) values.push({
    code: "comparison_review_not_assessed",
    message: "Screen 3 has no current researcher comparison decision.",
  });
  else if (seed.binding.design.decision === "no_selection") values.push({
    code: "comparison_not_selected",
    message: "Screen 3 records an explicit no-selection comparison decision.",
  });
  if (!seed.binding.coEvent) values.push({
    code: "coevent_review_not_assessed",
    message: "Screen 4 has no current occurrence-work snapshot.",
  });
  else if (
    seed.binding.coEvent.kind === "matrix" ||
    seed.binding.coEvent.executionStatus !== "complete"
  ) values.push({
    code: "coevent_execution_incomplete",
    message: "The current Screen 4 occurrence-work plan is incomplete.",
  });
  if (seed.binding.coEventRelationCoverage?.complete !== true) values.push({
    code: "coevent_relations_not_assessed",
    message:
      "Comparison-specific researcher judgments for retained occurrences are incomplete.",
  });
  if (!seed.binding.mechanismInput) values.push({
    code: "mechanism_literature_not_assessed",
    message: "Screen 5 has no current literature or synthesis-input snapshot.",
  });
  if (!seed.binding.mechanismReview) values.push({
    code: "mechanism_review_not_assessed",
    message: "No current MechanismReview or PredictionMatrix is available.",
  });
  values.push(
    {
      code: "diagnostic_inputs_not_recorded",
      message:
        "Screen 6 diagnostic periods, frequency, structure, variables, and constraints have not been recorded.",
    },
    {
      code: "diagnostic_results_not_supplied",
      message:
        "No diagnostic results were supplied; later diagnostics must begin as plans.",
    },
  );
  return values;
}

export function screen6UncertaintyProfileGaps(
  context: Screen6ProfileContext,
) {
  return gaps(seedFromContext(context));
}

export function screen6UncertaintyProfileInputFingerprint(
  context: Screen6ProfileContext,
) {
  return fingerprintSixScreenValue(seedFromContext(context));
}

function moduleFor(
  modules: Screen6UncertaintyProfile["upstreamModules"],
  id: Screen6UpstreamModuleId,
) {
  return modules.find(({ module }) => module === id)!;
}

function dimensions(seed: ProfileSeed): Screen6UncertaintyProfile["dimensions"] {
  const modules = upstreamModules(seed);
  const sourceFor = (source: (typeof DIMENSION_DEFINITIONS)[number]["source"]) => {
    if (source === "study") return {
      available: Boolean(seed.study.outcome),
      sourceOrAssumption:
        "Current saved study inputs; no Screen 6 measurement review has occurred.",
      sourceSnapshotId: null,
      currentEvidence: seed.study.outcome
        ? "The current study revision names an outcome, population, analysis unit, and period where supplied."
        : null,
    };
    const moduleId = source === "screen_2"
      ? "screen_2_policy_record"
      : source === "screen_3"
      ? "screen_3_comparison"
      : source === "screen_4"
      ? "screen_4_competing_events"
      : "screen_5_mechanism_review";
    const module = moduleFor(modules, moduleId);
    return {
      available: module.availability !== "not_assessed",
      sourceOrAssumption: module.snapshotId
        ? `Current ${moduleId.replaceAll("_", " ")} snapshot; its Screen 6 implications are unassessed.`
        : `Missing ${moduleId.replaceAll("_", " ")} snapshot.`,
      sourceSnapshotId: module.snapshotId,
      currentEvidence: module.snapshotId
        ? `A ${module.availability} upstream snapshot is bound; it is not a Screen 6 diagnostic result.`
        : null,
    };
  };
  return DIMENSION_DEFINITIONS.map((definition) => {
    const source = sourceFor(definition.source);
    const needsEvidence = !source.available ||
      definition.dimension === "competing_events" ||
      definition.dimension === "mechanism_attribution" ||
      ((definition.dimension === "counterfactual_comparison" ||
        definition.dimension === "interference" ||
        definition.dimension === "statistical_inference") &&
        seed.binding.design?.decision === "no_selection");
    return {
      dimension: definition.dimension,
      label: definition.label,
      state: needsEvidence ? "evidence_needed" : "not_assessed",
      concern: definition.concern,
      sourceOrAssumption: source.sourceOrAssumption,
      sourceSnapshotId: source.sourceSnapshotId,
      proposedDiagnostic: null,
      currentEvidence: source.currentEvidence,
      unresolvedLimitation: definition.unresolvedLimitation,
      response: null,
    };
  });
}

function expectedBody(input: {
  snapshotId: string;
  ordinal: number;
  seed: ProfileSeed;
  createdAt: string;
}): ProfileBody {
  const inputFingerprint = fingerprintSixScreenValue(input.seed);
  return {
    schemaVersion: SIX_SCREEN_UNCERTAINTY_PROFILE_VERSION,
    snapshotId: input.snapshotId,
    ordinal: input.ordinal,
    binding: structuredClone(input.seed.binding),
    study: structuredClone(input.seed.study),
    policy: structuredClone(input.seed.policy),
    upstreamModules: upstreamModules(input.seed),
    gaps: gaps(input.seed),
    dimensions: dimensions(input.seed),
    diagnosticPlanning: {
      status: "not_started",
      methodLibraryVersion: null,
      selectedDiagnosticIds: [],
      cards: [],
    },
    resultsReview: { status: "not_supplied", history: [] },
    credibilitySummary: {
      aggregateScore: null,
      universalBadge: null,
      certification: "not_available",
    },
    nonOutputs: {
      diagnosticResults: [],
      conditionalClaimBoundary: null,
      disposition: null,
      designRecord: null,
    },
    preparation: {
      actor: "researcher",
      method: "deterministic_fixed_software",
      networkRequests: 0,
      modelCalls: 0,
    },
    claimBoundary: CLAIM_BOUNDARY,
    inputFingerprint,
    createdAt: input.createdAt,
  };
}

export function createScreen6UncertaintyProfile(input: {
  snapshotId: string;
  ordinal: number;
  context: Screen6ProfileContext;
  actor: "researcher_ui" | "model" | "system";
  createdAt: string;
}) {
  requireBoundedIdentifier(input.snapshotId, "Screen 6 profile id");
  requireCanonicalInstant(input.createdAt, "Screen 6 profile createdAt");
  if (input.actor !== "researcher_ui") {
    throw new Error(
      "Only an explicit researcher UI action can initialize Screen 6.",
    );
  }
  if (!Number.isSafeInteger(input.ordinal) || input.ordinal < 1) {
    throw new Error("Screen 6 profile ordinal is invalid.");
  }
  const body = expectedBody({
    snapshotId: input.snapshotId,
    ordinal: input.ordinal,
    seed: seedFromContext(input.context),
    createdAt: input.createdAt,
  });
  return validateScreen6UncertaintyProfile({
    ...body,
    profileFingerprint: fingerprintSixScreenValue(body),
  });
}

export function validateScreen6UncertaintyProfile(
  profile: Screen6UncertaintyProfile,
) {
  const relationReferences =
    profile.binding.coEventRelationReviewReferences ?? [];
  const relationCoverage = profile.binding.coEventRelationCoverage;
  const expected = expectedBody({
    snapshotId: profile.snapshotId,
    ordinal: profile.ordinal,
    seed: {
      binding: profile.binding,
      study: profile.study,
      policy: profile.policy,
    },
    createdAt: profile.createdAt,
  });
  if (
    profile.schemaVersion !== SIX_SCREEN_UNCERTAINTY_PROFILE_VERSION ||
    profile.profileFingerprint !==
      fingerprintSixScreenValue(profileBody(profile)) ||
    !sameSixScreenValue(profileBody(profile), expected) ||
    profile.dimensions.length !== SCREEN6_UNCERTAINTY_DIMENSIONS.length ||
    profile.dimensions.some(({ state, proposedDiagnostic, response }) =>
      (state !== "not_assessed" && state !== "evidence_needed") ||
      proposedDiagnostic !== null || response !== null
    ) ||
    profile.preparation.networkRequests !== 0 ||
    profile.preparation.modelCalls !== 0 ||
    new Set(relationReferences.map(({ reviewId }) => reviewId)).size !==
      relationReferences.length ||
    relationReferences.some(({ reviewId, reviewFingerprint, candidateId }) =>
      !reviewId || !reviewFingerprint || !candidateId
    ) ||
    (relationCoverage !== undefined && (
      !Number.isSafeInteger(relationCoverage.retainedOccurrenceCount) ||
      relationCoverage.retainedOccurrenceCount < 0 ||
      !Number.isSafeInteger(relationCoverage.assessedCandidateCount) ||
      relationCoverage.assessedCandidateCount < 0 ||
      relationCoverage.assessedCandidateCount >
        relationCoverage.retainedOccurrenceCount ||
      (relationCoverage.complete &&
        relationCoverage.assessedCandidateCount !==
          relationCoverage.retainedOccurrenceCount)
    )) ||
    bytes(profile) > SIX_SCREEN_UNCERTAINTY_PROFILE_MAX_BYTES
  ) throw new Error("Screen 6 uncertainty profile is invalid.");
  requireBoundedIdentifier(profile.snapshotId, "Screen 6 profile id");
  requireBoundedIdentifier(profile.study.id, "Screen 6 study id");
  requireCanonicalInstant(profile.createdAt, "Screen 6 profile createdAt");
  requireCanonicalInstant(
    profile.study.createdAt,
    "Screen 6 bound study createdAt",
  );
  requireCanonicalInstant(
    profile.study.updatedAt,
    "Screen 6 bound study updatedAt",
  );
  requireFingerprint(
    profile.binding.identityFingerprint,
    "Screen 6 identity fingerprint",
  );
  requireFingerprint(
    profile.inputFingerprint,
    "Screen 6 profile input fingerprint",
  );
  requireFingerprint(
    profile.profileFingerprint,
    "Screen 6 profile fingerprint",
  );
  if (
    !Number.isSafeInteger(profile.ordinal) || profile.ordinal < 1 ||
    !Number.isSafeInteger(profile.binding.studyRevision) ||
    profile.binding.studyRevision < 0 ||
    !Number.isSafeInteger(profile.binding.identityRevision) ||
    profile.binding.identityRevision < 0 ||
    profile.study.revision !== profile.binding.studyRevision ||
    profile.policy.identityRevision !== profile.binding.identityRevision ||
    profile.policy.identityFingerprint !== profile.binding.identityFingerprint
  ) throw new Error("Screen 6 uncertainty profile binding is inconsistent.");
  return profile;
}

export function validateScreen6UncertaintyProfileCollection(input: {
  profiles: readonly Screen6UncertaintyProfile[];
  eventCardReviews: readonly PolicyEventCardReviewState[];
  designSets: readonly CausalDesignSet[];
  designDecisions: readonly CausalDesignDecision[];
  coEventMatrices: readonly CoEventSearchMatrix[];
  coEventExecutions: readonly CoEventSearchExecution[];
  coEventRelationReviews: readonly CoEventRelationReview[];
  mechanismLiteraturePlans: readonly MechanismLiteraturePlan[];
  mechanismSynthesisInputs: readonly MechanismSynthesisInputPacket[];
  mechanismReviews: readonly MechanismReview[];
  predictionMatrices: readonly PredictionMatrix[];
}) {
  if (
    input.profiles.length > SIX_SCREEN_UNCERTAINTY_PROFILE_MAX_REVISIONS ||
    bytes(input.profiles) >
      SIX_SCREEN_UNCERTAINTY_PROFILE_COLLECTION_MAX_BYTES
  ) throw new Error("Stored Screen 6 profile history exceeds its bounded contract.");
  const ids = new Set<string>();
  const parents = new Set<string>();
  for (const [index, profile] of input.profiles.entries()) {
    validateScreen6UncertaintyProfile(profile);
    if (
      profile.ordinal !== index + 1 || ids.has(profile.snapshotId) ||
      parents.has(profile.inputFingerprint)
    ) throw new Error("Stored Screen 6 profile lineage is not unique.");
    ids.add(profile.snapshotId);
    parents.add(profile.inputFingerprint);
    const eventCard = profile.binding.eventCardReference;
    if (eventCard) {
      const review = input.eventCardReviews.find(({ id }) =>
        id === eventCard.reviewId
      );
      if (
        !review || !sameSixScreenValue(
          createPolicyEventCardReference({ review }),
          eventCard,
        )
      ) throw new Error("Stored Screen 6 profile lost its Event Card lineage.");
    }
    const design = profile.binding.design;
    if (design) {
      const set = input.designSets.find(({ snapshotId }) =>
        snapshotId === design.designSetSnapshotId
      );
      const decision = input.designDecisions.find(({ snapshotId }) =>
        snapshotId === design.decisionSnapshotId
      );
      if (
        !set || !decision || set.designSetFingerprint !==
          design.designSetFingerprint ||
        decision.decisionFingerprint !== design.decisionFingerprint ||
        decision.designSetSnapshotId !== set.snapshotId ||
        decision.decision !== design.decision ||
        (decision.selectedDesign?.snapshotId ?? null) !==
          design.selectedDesignSnapshotId ||
        set.binding.studyRevision !== profile.binding.studyRevision ||
        set.binding.identityFingerprint !==
          profile.binding.identityFingerprint ||
        !eventCard || !sameSixScreenValue(
          set.binding.eventCardReference,
          eventCard,
        )
      ) throw new Error("Stored Screen 6 profile lost its design lineage.");
    }
    const coEvent = profile.binding.coEvent;
    let coEventMatrix: CoEventSearchMatrix | null = null;
    let coEventExecution: CoEventSearchExecution | null = null;
    if (coEvent?.kind === "matrix") {
      const matrix = input.coEventMatrices.find(({ snapshotId }) =>
        snapshotId === coEvent.snapshotId
      );
      if (
        !matrix || matrix.matrixFingerprint !== coEvent.fingerprint ||
        coEvent.executionStatus !== null
      ) throw new Error("Stored Screen 6 profile lost its co-event lineage.");
      coEventMatrix = matrix;
    } else if (coEvent) {
      const execution = input.coEventExecutions.find(({ snapshotId }) =>
        snapshotId === coEvent.snapshotId
      );
      if (
        !execution || execution.executionFingerprint !== coEvent.fingerprint ||
        execution.status !== coEvent.executionStatus
      ) throw new Error("Stored Screen 6 profile lost its co-event lineage.");
      coEventExecution = execution;
      coEventMatrix = input.coEventMatrices.find((matrix) =>
        matrix.snapshotId === execution.matrixSnapshotId &&
        matrix.matrixFingerprint === execution.matrixFingerprint
      ) ?? null;
      if (
        !coEventMatrix || coEventMatrix.matrixFingerprint !==
          execution.matrixFingerprint
      ) throw new Error("Stored Screen 6 profile lost its co-event parent.");
    }
    if (coEventMatrix) {
      if (
        !design || coEventMatrix.binding.studyRevision !==
          profile.binding.studyRevision ||
        coEventMatrix.binding.identityFingerprint !==
          profile.binding.identityFingerprint ||
        coEventMatrix.binding.designSetSnapshotId !==
          design.designSetSnapshotId ||
        coEventMatrix.binding.designDecisionSnapshotId !==
          design.decisionSnapshotId ||
        !eventCard || !sameSixScreenValue(
          coEventMatrix.binding.eventCardReference,
          eventCard,
        )
      ) throw new Error("Stored Screen 6 profile combined mismatched co-event inputs.");
    }
    const relationReferenceIds = new Set<string>();
    for (const reference of
      profile.binding.coEventRelationReviewReferences ?? []) {
      const review = input.coEventRelationReviews.find(({ id }) =>
        id === reference.reviewId
      );
      if (
        relationReferenceIds.has(reference.reviewId) ||
        !review ||
        review.reviewFingerprint !== reference.reviewFingerprint ||
        review.binding.candidateId !== reference.candidateId ||
        review.decision !== reference.decision ||
        review.relation.category !== reference.category ||
        !coEventExecution?.candidateOccurrenceIds.includes(
          review.binding.candidateId,
        ) ||
        !coEventMatrix ||
        review.binding.matrixSnapshotId !== coEventMatrix.snapshotId ||
        review.binding.matrixFingerprint !== coEventMatrix.matrixFingerprint ||
        review.binding.designDecisionSnapshotId !==
          (design?.decisionSnapshotId ?? null) ||
        review.binding.designDecisionFingerprint !==
          (design?.decisionFingerprint ?? null)
      ) {
        throw new Error(
          "Stored Screen 6 profile lost its co-event relation-review lineage.",
        );
      }
      relationReferenceIds.add(reference.reviewId);
    }
    const mechanism = profile.binding.mechanismInput;
    let mechanismPlan: MechanismLiteraturePlan | null = null;
    if (mechanism?.kind === "literature_plan") {
      const plan = input.mechanismLiteraturePlans.find(({ snapshotId }) =>
        snapshotId === mechanism.snapshotId
      );
      if (!plan || plan.planFingerprint !== mechanism.fingerprint) {
        throw new Error("Stored Screen 6 profile lost its mechanism-input lineage.");
      }
      mechanismPlan = plan;
    } else if (mechanism) {
      const packet = input.mechanismSynthesisInputs.find(({ snapshotId }) =>
        snapshotId === mechanism.snapshotId
      );
      if (!packet || packet.packetFingerprint !== mechanism.fingerprint) {
        throw new Error("Stored Screen 6 profile lost its mechanism-input lineage.");
      }
      mechanismPlan = input.mechanismLiteraturePlans.find((plan) =>
        plan.snapshotId === packet.binding.literaturePlanSnapshotId &&
        plan.planFingerprint === packet.binding.literaturePlanFingerprint
      ) ?? null;
      if (!mechanismPlan) {
        throw new Error("Stored Screen 6 profile lost its mechanism-plan parent.");
      }
    }
    if (mechanismPlan) {
      if (
        mechanismPlan.binding.studyRevision !== profile.binding.studyRevision ||
        mechanismPlan.binding.identityFingerprint !==
          profile.binding.identityFingerprint ||
        !eventCard || !sameSixScreenValue(
          mechanismPlan.binding.eventCardReference,
          eventCard,
        ) ||
        mechanismPlan.binding.designDecisionSnapshotId !==
          (design?.decisionSnapshotId ?? null) ||
        mechanismPlan.binding.coEventSnapshotId !==
          (coEvent?.snapshotId ?? null)
      ) throw new Error("Stored Screen 6 profile combined mismatched mechanism inputs.");
    }
    const mechanismReview = profile.binding.mechanismReview;
    if (mechanismReview) {
      const review = input.mechanismReviews.find(({ snapshotId }) =>
        snapshotId === mechanismReview.reviewSnapshotId
      );
      const matrix = input.predictionMatrices.find(({ snapshotId }) =>
        snapshotId === mechanismReview.predictionMatrixSnapshotId
      );
      if (
        !review || !matrix || !mechanism ||
        review.reviewFingerprint !== mechanismReview.reviewFingerprint ||
        matrix.matrixFingerprint !==
          mechanismReview.predictionMatrixFingerprint ||
        matrix.binding.mechanismReviewSnapshotId !== review.snapshotId ||
        matrix.binding.mechanismReviewFingerprint !== review.reviewFingerprint ||
        review.binding.synthesisInputSnapshotId !== mechanism.snapshotId ||
        review.binding.synthesisInputFingerprint !== mechanism.fingerprint ||
        review.intendedClaim !== mechanismReview.intendedClaim ||
        review.mechanisms.filter(({ decision }) => decision === "retained")
          .length !== mechanismReview.retainedMechanismCount ||
        matrix.rows.length !== mechanismReview.predictionCount ||
        matrix.compactEvidencePlan.remainingIndistinguishablePairs.length !==
          mechanismReview.remainingIndistinguishablePairCount
      ) throw new Error("Stored Screen 6 profile lost its mechanism-review lineage.");
    }
  }
  return input;
}
