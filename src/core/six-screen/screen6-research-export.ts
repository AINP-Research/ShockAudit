import {
  fingerprintSixScreenValue,
  sameSixScreenValue,
} from "./canonical";
import {
  requireBoundedIdentifier,
  requireCanonicalInstant,
  requireFingerprint,
  requireSanitizedSourceUrl,
  requireShockIdentity,
  type ConfirmedShock,
  type SixScreenWorkflowState,
} from "./contracts";
import type { Screen6DiagnosticPlan } from "./screen6-diagnostic-plan";
import type {
  Screen6DiagnosticResult,
  Screen6DiagnosticResultReview,
} from "./screen6-diagnostic-result";
import type {
  Screen6ConditionalClaimBoundary,
  Screen6ResearchPlanningDisposition,
} from "./screen6-claim-boundary";
import type { Screen6UncertaintyProfile } from
  "./screen6-uncertainty-profile";
import { SHOCKAUDIT_VERSION } from "../shockaudit-version";

export const SIX_SCREEN_CREDIBILITY_PLAN_EXPORT_VERSION =
  "screen-06-credibility-plan-export-v1" as const;
export const SIX_SCREEN_DESIGN_RECORD_VERSION =
  "screen-06-final-design-record-v1" as const;
export const SIX_SCREEN_SOURCE_DECISION_TRAIL_VERSION =
  "screen-06-source-linked-decision-trail-v1" as const;
export const SIX_SCREEN_RESEARCH_EXPORT_MANIFEST_VERSION =
  "screen-06-research-export-manifest-v1" as const;
export const SIX_SCREEN_RESEARCH_EXPORT_VERSION =
  "screen-06-research-export-v1" as const;
export const SIX_SCREEN_RESEARCH_EXPORT_BUNDLE_VERSION =
  "shockaudit-research-export-bundle-v1" as const;

export const SIX_SCREEN_RESEARCH_EXPORT_MAX_RECORDS = 8;
export const SIX_SCREEN_RESEARCH_EXPORT_MAX_BYTES = 2_000_000;
export const SIX_SCREEN_RESEARCH_EXPORT_COLLECTION_MAX_BYTES = 8_000_000;

type EventCardReview = NonNullable<
  SixScreenWorkflowState["policyEventCardReviews"]
>[number];
type CausalDesignSet = NonNullable<
  SixScreenWorkflowState["causalDesignSets"]
>[number];
type CausalDesignDecision = NonNullable<
  SixScreenWorkflowState["causalDesignDecisions"]
>[number];
type CoEventMatrix = NonNullable<
  SixScreenWorkflowState["coEventSearchMatrices"]
>[number];
type CoEventExecution = NonNullable<
  SixScreenWorkflowState["coEventSearchExecutions"]
>[number];
type CoEventCandidate = NonNullable<
  SixScreenWorkflowState["coEventCandidates"]
>[number];
type CoEventOccurrenceReview = NonNullable<
  SixScreenWorkflowState["coEventOccurrenceReviews"]
>[number];
type CoEventDuplicateReview = NonNullable<
  SixScreenWorkflowState["coEventDuplicateReviews"]
>[number];
type CoEventRelationReview = NonNullable<
  SixScreenWorkflowState["coEventRelationReviews"]
>[number];
type MechanismLiteraturePlan = NonNullable<
  SixScreenWorkflowState["mechanismLiteraturePlans"]
>[number];
type MechanismSynthesisInput = NonNullable<
  SixScreenWorkflowState["mechanismSynthesisInputPackets"]
>[number];
type MechanismReview = NonNullable<
  SixScreenWorkflowState["mechanismReviews"]
>[number];
type PredictionMatrix = NonNullable<
  SixScreenWorkflowState["predictionMatrices"]
>[number];
type ScholarlyClaimReview = NonNullable<
  SixScreenWorkflowState["scholarlyClaimReviews"]
>[number];
type ScholarlyClaimExtraction = NonNullable<
  SixScreenWorkflowState["scholarlyClaimExtractions"]
>[number];

export type Screen6ExportSourceLink = {
  id: string;
  sourceId: string;
  screen: 1 | 2 | 4 | 5;
  role:
    | "confirmed_identity_reference"
    | "reviewed_policy_evidence_reference"
    | "coevent_occurrence_metadata"
    | "scholarly_document_reference";
  title: string | null;
  locator: string | null;
  publisher: string | null;
  documentVersionId: string | null;
  contentHash: string | null;
  passageIds: string[];
  evidenceStatus:
    | "reference_only"
    | "source_metadata_documented"
    | "inspected_partial_text";
  exportedContent: "metadata_and_reference_only";
};

export type Screen6ExportClaimLink = {
  id: string;
  screen: 2 | 4 | 5 | 6;
  kind:
    | "reviewed_policy_claim"
    | "coevent_occurrence_record"
    | "reviewed_scholarly_claim"
    | "researcher_mechanism_hypothesis"
    | "prospective_conditional_claim";
  statement: string;
  reviewStatus: string;
  provenance: string;
  sourceIds: string[];
  passageIds: string[];
  artifactIds: string[];
};

export type Screen6ExportDecision = {
  id: string;
  screen: 1 | 2 | 3 | 4 | 5 | 6;
  kind: string;
  actor: "researcher";
  decision: string;
  rationale: string | null;
  at: string;
  sourceIds: string[];
  artifactIds: string[];
  decisionFingerprint: string;
};

export type Screen6CredibilityPlanExport = {
  schemaVersion: typeof SIX_SCREEN_CREDIBILITY_PLAN_EXPORT_VERSION;
  profileReference: {
    snapshotId: string;
    profileFingerprint: string;
  };
  diagnosticPlanReference: {
    snapshotId: string;
    planFingerprint: string;
  };
  methodLibrary: Screen6DiagnosticPlan["methodLibrary"];
  dimensions: Screen6ConditionalClaimBoundary["dimensionStatuses"];
  diagnosticStatuses: Screen6ConditionalClaimBoundary["diagnosticStatuses"];
  resultsInspectionHistory: Array<{
    result: Screen6DiagnosticResult;
    reviews: Screen6DiagnosticResultReview[];
  }>;
  conditionalClaimBoundary: {
    snapshotId: string;
    boundaryFingerprint: string;
    currentDesignTarget:
      Screen6ConditionalClaimBoundary["currentDesignTarget"];
    claimLevels: Screen6ConditionalClaimBoundary["claimLevels"];
    intendedClaim: Screen6ConditionalClaimBoundary["intendedClaim"];
    statement: string;
  };
  researchPlanningDisposition: Screen6ResearchPlanningDisposition;
  proposedDesignOrClaimRevisions: Array<{
    source:
      | "diagnostic_result_review"
      | "research_planning_disposition";
    sourceId: string;
    text: string;
  }>;
  unassessedModules: Screen6ConditionalClaimBoundary["unassessedModules"];
  unresolvedHighConsequenceIssues:
    Screen6ConditionalClaimBoundary["unresolvedHighConsequenceIssues"];
  recommendationType: "research_planning_not_causal_certification";
  nonOutputs: {
    aggregateScore: null;
    universalBadge: null;
    causalCertification: "not_available";
    assumptionProof: null;
    attributionUpgrade: null;
    automaticDesignMutation: null;
  };
  credibilityPlanFingerprint: string;
};

export type Screen6FinalDesignRecord = {
  schemaVersion: typeof SIX_SCREEN_DESIGN_RECORD_VERSION;
  recordStatus:
    | "final_current_snapshot_complete"
    | "final_current_snapshot_partial";
  study: Screen6UncertaintyProfile["study"];
  confirmedShock: ConfirmedShock;
  policyRecord: {
    status: "reviewed_event_card" | "not_assessed";
    eventCard: EventCardReview["lockedEventCard"];
  };
  causalComparison: {
    status: "selected" | "no_selection" | "not_assessed";
    designSet: CausalDesignSet | null;
    decision: CausalDesignDecision | null;
  };
  competingEvents: {
    status: "execution_bound" | "matrix_only" | "not_assessed";
    matrix: CoEventMatrix | null;
    execution: CoEventExecution | null;
    candidates: CoEventCandidate[];
    occurrenceReviews: CoEventOccurrenceReview[];
    duplicateReviews: CoEventDuplicateReview[];
    relationReviews: CoEventRelationReview[];
    relationAssessment:
      | "researcher_reviewed_records_available"
      | "not_assessed";
  };
  mechanisms: {
    status:
      | "researcher_review_and_predictions"
      | "accepted_inputs_frozen_synthesis_blocked"
      | "literature_plan_only"
      | "not_assessed";
    literaturePlan: MechanismLiteraturePlan | null;
    synthesisInputReference: {
      snapshotId: string;
      packetFingerprint: string;
    } | null;
    claimExtractions: Array<{
      id: string;
      extractionFingerprint: string;
      documentReference: ScholarlyClaimExtraction["documentReference"];
      passageReference: Omit<
        ScholarlyClaimExtraction["passageReference"],
        "exactText"
      > & { exactText: "omitted_from_default_export" };
      fields: ScholarlyClaimExtraction["fields"];
      extractedAt: string;
    }>;
    claimReviews: ScholarlyClaimReview[];
    synthesisStatus:
      | MechanismSynthesisInput["synthesis"]
      | { status: "not_available"; reasons: string[] };
    mechanismReview: MechanismReview | null;
    mechanismCandidates: MechanismReview["mechanisms"];
    predictionMatrix: PredictionMatrix | null;
  };
  credibilityPlanReference: {
    boundarySnapshotId: string;
    boundaryFingerprint: string;
    dispositionId: string;
    dispositionFingerprint: string;
    credibilityPlanFingerprint: string;
  };
  finalConditionalClaim: string;
  finalDisposition: Screen6ResearchPlanningDisposition["decision"];
  unresolvedItems: string[];
  nonOutputs: {
    treatmentEffectEstimate: null;
    aggregateScore: null;
    universalBadge: null;
    causalCertification: "not_available";
    automaticAttributionUpgrade: null;
    automaticDesignMutation: null;
  };
  designRecordFingerprint: string;
};

export type Screen6SourceLinkedDecisionTrail = {
  schemaVersion: typeof SIX_SCREEN_SOURCE_DECISION_TRAIL_VERSION;
  sources: Screen6ExportSourceLink[];
  claims: Screen6ExportClaimLink[];
  decisions: Screen6ExportDecision[];
  workflowChanges: SixScreenWorkflowState["changeLog"];
  sourceExcerptPolicy:
    "exact_source_excerpts_omitted_from_default_export_references_retained";
  privateDataPolicy:
    "no_access_tokens_credentials_private_restoration_state_hidden_reasoning_or_raw_user_data";
  trailFingerprint: string;
};

export type Screen6ResearchExportManifest = {
  schemaVersion: typeof SIX_SCREEN_RESEARCH_EXPORT_MANIFEST_VERSION;
  applicationVersion: typeof SHOCKAUDIT_VERSION;
  exportSchemaVersion: typeof SIX_SCREEN_RESEARCH_EXPORT_VERSION;
  bundleFormat: typeof SIX_SCREEN_RESEARCH_EXPORT_BUNDLE_VERSION;
  completenessStatus: "complete" | "partial";
  methodVersions: {
    diagnosticLibraryVersion: string;
    diagnosticLibraryFingerprint: string;
    causalMethodLibraryVersion: string | null;
  };
  includedModules: string[];
  excludedOrUnassessedEvidence: string[];
  files: Array<{
    name: string;
    mediaType: "application/json" | "text/markdown" | "text/csv";
    byteLength: number;
    contentFingerprint: string;
  }>;
  payloadFileCount: number;
  payloadByteLength: number;
  fingerprintSemantics:
    "integrity_coordinate_detects_change_not_source_truth_or_signature";
  manifestFingerprint: string;
};

export type Screen6ResearchExport = {
  schemaVersion: typeof SIX_SCREEN_RESEARCH_EXPORT_VERSION;
  id: string;
  ordinal: number;
  previousExport: {
    id: string;
    exportFingerprint: string;
  } | null;
  binding: {
    runId: string;
    workflowRevision: number;
    changeLogLength: number;
    profileSnapshotId: string;
    profileFingerprint: string;
    planSnapshotId: string;
    planFingerprint: string;
    resultHistoryLength: number;
    reviewHistoryLength: number;
    boundarySnapshotId: string;
    boundaryFingerprint: string;
    dispositionId: string;
    dispositionFingerprint: string;
    lineageFingerprint: string;
  };
  completeness: {
    status: "complete" | "partial";
    includedModules: string[];
    excludedOrUnassessedEvidence: string[];
    unresolvedItems: string[];
  };
  credibilityPlan: Screen6CredibilityPlanExport;
  designRecord: Screen6FinalDesignRecord;
  sourceLinkedDecisionTrail: Screen6SourceLinkedDecisionTrail;
  searchManifest: {
    policy: {
      status: "reviewed_event_card" | "not_assessed";
      evidenceSnapshotId: string | null;
      evidenceSnapshotFingerprint: string | null;
    };
    coevents: {
      status: "complete" | "active" | "matrix_only" | "not_assessed";
      matrixSnapshotId: string | null;
      executionSnapshotId: string | null;
      sourceQueries: number;
      retainedCandidates: number;
      remainingSteps: number;
    };
    mechanisms: {
      status:
        | "researcher_review_and_predictions"
        | "accepted_inputs_frozen_synthesis_blocked"
        | "literature_plan_only"
        | "not_assessed";
      literaturePlanSnapshotId: string | null;
      synthesisInputSnapshotId: string | null;
      mechanismReviewSnapshotId: string | null;
      predictionMatrixSnapshotId: string | null;
      semanticSynthesis: "not_used";
    };
    diagnostics: {
      planSnapshotId: string;
      methodLibraryVersion: string;
      diagnosticCardCount: number;
      resultRecordCount: number;
      resultReviewCount: number;
    };
  };
  readableReport: {
    title: string;
    markdown: string;
    reportFingerprint: string;
  };
  manifest: Screen6ResearchExportManifest;
  preparation: {
    actor: "researcher";
    method: "deterministic_fixed_software";
    networkRequests: 0;
    modelCalls: 0;
    localRoutineCalls: 0;
    exportAction: "explicit";
  };
  nonOutputs: {
    treatmentEffectEstimate: null;
    aggregateScore: null;
    universalBadge: null;
    causalCertification: "not_available";
    assumptionProof: null;
    attributionUpgrade: null;
    automaticDesignMutation: null;
  };
  claimBoundary: string;
  exportedAt: string;
  exportFingerprint: string;
};

export type Screen6ResearchExportFile = {
  name: string;
  mediaType: "application/json" | "text/markdown" | "text/csv";
  content: string;
};

export type Screen6ResearchExportBundle = {
  schemaVersion: typeof SIX_SCREEN_RESEARCH_EXPORT_BUNDLE_VERSION;
  exportId: string;
  exportFingerprint: string;
  completenessStatus: Screen6ResearchExport["completeness"]["status"];
  manifest: Screen6ResearchExportManifest;
  files: Screen6ResearchExportFile[];
};

type ExportBody = Omit<Screen6ResearchExport, "exportFingerprint">;
type CredibilityBody = Omit<
  Screen6CredibilityPlanExport,
  "credibilityPlanFingerprint"
>;
type DesignRecordBody = Omit<
  Screen6FinalDesignRecord,
  "designRecordFingerprint"
>;
type TrailBody = Omit<
  Screen6SourceLinkedDecisionTrail,
  "trailFingerprint"
>;
type ManifestBody = Omit<
  Screen6ResearchExportManifest,
  "manifestFingerprint"
>;

const EXPORT_BOUNDARY =
  "This explicit export preserves the current source-linked research-planning record. It is not a treatment-effect estimate, proof of an identifying assumption, automatic design revision, aggregate credibility score, universal badge, attribution upgrade, or causal certificate. Partial and unassessed work remains labeled.";

function bytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function textBytes(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function unique<T>(values: readonly T[]) {
  return [...new Set(values)];
}

function json(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function csvCell(value: string | number | null) {
  if (value === null) return "";
  const text = String(value);
  return /[",\r\n]/u.test(text)
    ? `"${text.replaceAll('"', '""')}"`
    : text;
}

function csv(rows: Array<Array<string | number | null>>) {
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function validateConfirmedShockForProfile(
  shock: ConfirmedShock,
  profile: Screen6UncertaintyProfile,
) {
  requireShockIdentity(shock);
  if (
    shock.identityFingerprint !== profile.binding.identityFingerprint ||
    shock.identityFingerprint !== profile.policy.identityFingerprint ||
    shock.confirmation.displayedIdentityFingerprint !==
      shock.identityFingerprint ||
    shock.confirmation.identityRevision !== profile.binding.identityRevision ||
    shock.confirmation.actor !== "researcher"
  ) throw new Error("Screen 6 export lost its confirmed policy identity.");
  return shock;
}

function findParents(input: {
  state: SixScreenWorkflowState;
  profile: Screen6UncertaintyProfile;
}) {
  const { state, profile } = input;
  const eventCardReview = profile.binding.eventCardReference
    ? (state.policyEventCardReviews ?? []).find(({ id }) =>
        id === profile.binding.eventCardReference!.reviewId)
    : null;
  if (
    profile.binding.eventCardReference &&
    (!eventCardReview?.lockedEventCard ||
      eventCardReview.lockedEventCard.snapshotId !==
        profile.binding.eventCardReference.eventCardSnapshotId ||
      eventCardReview.lockedEventCard.eventCardFingerprint !==
        profile.binding.eventCardReference.eventCardFingerprint)
  ) throw new Error("Screen 6 export lost its reviewed Event Card.");

  const designSet = profile.binding.design
    ? (state.causalDesignSets ?? []).find(({ snapshotId }) =>
        snapshotId === profile.binding.design!.designSetSnapshotId) ?? null
    : null;
  const designDecision = profile.binding.design
    ? (state.causalDesignDecisions ?? []).find(({ snapshotId }) =>
        snapshotId === profile.binding.design!.decisionSnapshotId) ?? null
    : null;
  if (
    profile.binding.design &&
    (!designSet || !designDecision ||
      designSet.designSetFingerprint !==
        profile.binding.design.designSetFingerprint ||
      designDecision.decisionFingerprint !==
        profile.binding.design.decisionFingerprint)
  ) throw new Error("Screen 6 export lost its causal-comparison lineage.");

  let coEventMatrix: CoEventMatrix | null = null;
  let coEventExecution: CoEventExecution | null = null;
  if (profile.binding.coEvent?.kind === "execution") {
    coEventExecution = (state.coEventSearchExecutions ?? []).find(
      ({ snapshotId }) => snapshotId === profile.binding.coEvent!.snapshotId,
    ) ?? null;
    if (
      !coEventExecution || coEventExecution.executionFingerprint !==
        profile.binding.coEvent.fingerprint
    ) throw new Error("Screen 6 export lost its co-event execution.");
    coEventMatrix = (state.coEventSearchMatrices ?? []).find(({ snapshotId }) =>
      snapshotId === coEventExecution!.matrixSnapshotId) ?? null;
  } else if (profile.binding.coEvent?.kind === "matrix") {
    coEventMatrix = (state.coEventSearchMatrices ?? []).find(({ snapshotId }) =>
      snapshotId === profile.binding.coEvent!.snapshotId) ?? null;
    if (
      !coEventMatrix || coEventMatrix.matrixFingerprint !==
        profile.binding.coEvent.fingerprint
    ) throw new Error("Screen 6 export lost its co-event matrix.");
  }
  const candidateIds = new Set(coEventExecution?.candidateOccurrenceIds ?? []);
  const coEventCandidates = (state.coEventCandidates ?? []).filter(({ id }) =>
    candidateIds.has(id));
  if (coEventCandidates.length !== candidateIds.size) {
    throw new Error("Screen 6 export lost bound co-event candidates.");
  }
  const coEventOccurrenceReviews = (state.coEventOccurrenceReviews ?? [])
    .filter(({ candidateReference }) =>
      candidateIds.has(candidateReference.candidateId));
  const coEventDuplicateReviews = (state.coEventDuplicateReviews ?? []).filter(
    ({ members }) => members.every(({ candidateId }) =>
      candidateIds.has(candidateId)),
  );
  const relationReviewById = new Map(
    (state.coEventRelationReviews ?? []).map((review) => [review.id, review]),
  );
  const coEventRelationReviews = (
    profile.binding.coEventRelationReviewReferences ?? []
  ).map((reference) => {
    const review = relationReviewById.get(reference.reviewId);
    if (
      !review ||
      review.reviewFingerprint !== reference.reviewFingerprint ||
      review.binding.candidateId !== reference.candidateId ||
      review.decision !== reference.decision ||
      review.relation.category !== reference.category ||
      !candidateIds.has(review.binding.candidateId)
    ) {
      throw new Error("Screen 6 export lost a bound co-event relation review.");
    }
    return review;
  });

  let mechanismLiteraturePlan: MechanismLiteraturePlan | null = null;
  let mechanismSynthesisInput: MechanismSynthesisInput | null = null;
  if (profile.binding.mechanismInput?.kind === "synthesis_input") {
    mechanismSynthesisInput = (state.mechanismSynthesisInputPackets ?? []).find(
      ({ snapshotId }) =>
        snapshotId === profile.binding.mechanismInput!.snapshotId,
    ) ?? null;
    if (
      !mechanismSynthesisInput || mechanismSynthesisInput.packetFingerprint !==
        profile.binding.mechanismInput.fingerprint
    ) throw new Error("Screen 6 export lost its mechanism-input packet.");
    mechanismLiteraturePlan = (state.mechanismLiteraturePlans ?? []).find(
      ({ snapshotId }) => snapshotId ===
        mechanismSynthesisInput!.binding.literaturePlanSnapshotId,
    ) ?? null;
  } else if (profile.binding.mechanismInput?.kind === "literature_plan") {
    mechanismLiteraturePlan = (state.mechanismLiteraturePlans ?? []).find(
      ({ snapshotId }) =>
        snapshotId === profile.binding.mechanismInput!.snapshotId,
    ) ?? null;
    if (
      !mechanismLiteraturePlan || mechanismLiteraturePlan.planFingerprint !==
        profile.binding.mechanismInput.fingerprint
    ) throw new Error("Screen 6 export lost its mechanism literature plan.");
  }
  if (
    mechanismSynthesisInput &&
    (!mechanismLiteraturePlan || mechanismLiteraturePlan.planFingerprint !==
      mechanismSynthesisInput.binding.literaturePlanFingerprint)
  ) throw new Error("Screen 6 export lost the mechanism plan behind its input.");

  let mechanismReview: MechanismReview | null = null;
  let predictionMatrix: PredictionMatrix | null = null;
  if (profile.binding.mechanismReview) {
    mechanismReview = (state.mechanismReviews ?? []).find(({ snapshotId }) =>
      snapshotId === profile.binding.mechanismReview!.reviewSnapshotId
    ) ?? null;
    predictionMatrix = (state.predictionMatrices ?? []).find(({ snapshotId }) =>
      snapshotId ===
        profile.binding.mechanismReview!.predictionMatrixSnapshotId
    ) ?? null;
    if (
      !mechanismSynthesisInput || !mechanismReview || !predictionMatrix ||
      mechanismReview.reviewFingerprint !==
        profile.binding.mechanismReview.reviewFingerprint ||
      predictionMatrix.matrixFingerprint !==
        profile.binding.mechanismReview.predictionMatrixFingerprint ||
      mechanismReview.binding.synthesisInputSnapshotId !==
        mechanismSynthesisInput.snapshotId ||
      mechanismReview.binding.synthesisInputFingerprint !==
        mechanismSynthesisInput.packetFingerprint ||
      predictionMatrix.binding.mechanismReviewSnapshotId !==
        mechanismReview.snapshotId ||
      predictionMatrix.binding.mechanismReviewFingerprint !==
        mechanismReview.reviewFingerprint
    ) throw new Error("Screen 6 export lost its mechanism-review lineage.");
  }

  const claimPacket = mechanismSynthesisInput
    ? (state.scholarlyClaimPackets ?? []).find(({ snapshotId }) =>
        snapshotId ===
          mechanismSynthesisInput!.binding.claimPacketSnapshotId) ?? null
    : null;
  if (
    mechanismSynthesisInput &&
    (!claimPacket || claimPacket.packetFingerprint !==
      mechanismSynthesisInput.binding.claimPacketFingerprint)
  ) throw new Error("Screen 6 export lost the reviewed scholarly-claim packet.");
  const extractionIds = new Set(
    claimPacket?.extractionReferences.map(({ extractionId }) => extractionId) ??
      [],
  );
  const reviewIds = new Set(
    claimPacket?.reviewReferences.map(({ reviewId }) => reviewId) ?? [],
  );
  const scholarlyClaimExtractions = (state.scholarlyClaimExtractions ?? [])
    .filter(({ id }) => extractionIds.has(id));
  const scholarlyClaimReviews = (state.scholarlyClaimReviews ?? [])
    .filter(({ id }) => reviewIds.has(id));
  if (
    scholarlyClaimExtractions.length !== extractionIds.size ||
    scholarlyClaimReviews.length !== reviewIds.size
  ) throw new Error("Screen 6 export lost scholarly extraction/review history.");

  return {
    eventCardReview: eventCardReview ?? null,
    designSet,
    designDecision,
    coEventMatrix,
    coEventExecution,
    coEventCandidates,
    coEventOccurrenceReviews,
    coEventDuplicateReviews,
    coEventRelationReviews,
    mechanismLiteraturePlan,
    mechanismSynthesisInput,
    mechanismReview,
    predictionMatrix,
    scholarlyClaimExtractions,
    scholarlyClaimReviews,
  };
}

function resultHistory(input: {
  state: SixScreenWorkflowState;
  boundary: Screen6ConditionalClaimBoundary;
}) {
  const results = (input.state.screen6DiagnosticResults ?? []).slice(
    0,
    input.boundary.binding.resultHistoryLength,
  ).filter(({ binding }) =>
    binding.planSnapshotId === input.boundary.binding.planSnapshotId &&
    binding.planFingerprint === input.boundary.binding.planFingerprint);
  const resultIds = new Set(results.map(({ id }) => id));
  const reviews = (input.state.screen6DiagnosticResultReviews ?? []).slice(
    0,
    input.boundary.binding.reviewHistoryLength,
  ).filter(({ resultReference }) =>
    resultIds.has(resultReference.resultId));
  return results.map((result) => ({
    result: structuredClone(result),
    reviews: reviews.filter(({ resultReference }) =>
      resultReference.resultId === result.id).map((review) =>
        structuredClone(review)),
  }));
}

function proposedRevisions(
  history: Screen6CredibilityPlanExport["resultsInspectionHistory"],
  disposition: Screen6ResearchPlanningDisposition,
) {
  const revisions: Screen6CredibilityPlanExport[
    "proposedDesignOrClaimRevisions"
  ] = [];
  for (const { reviews } of history) {
    for (const review of reviews) {
      for (const text of review.followUpActions) {
        revisions.push({
          source: "diagnostic_result_review",
          sourceId: review.id,
          text,
        });
      }
    }
  }
  for (const text of disposition.specifiedRevisions) {
    revisions.push({
      source: "research_planning_disposition",
      sourceId: disposition.id,
      text,
    });
  }
  return revisions.filter((revision, index) =>
    revisions.findIndex((candidate) =>
      candidate.source === revision.source &&
      candidate.sourceId === revision.sourceId &&
      candidate.text === revision.text) === index);
}

function completeness(input: {
  profile: Screen6UncertaintyProfile;
  boundary: Screen6ConditionalClaimBoundary;
  disposition: Screen6ResearchPlanningDisposition;
}) {
  const excluded = input.boundary.unassessedModules.map(({ module, availability }) =>
    `${module}:${availability}`);
  if (!input.boundary.binding.resultReferences.length) {
    excluded.push("screen_6_diagnostic_results:not_supplied");
  }
  if (input.disposition.decision !== "proceed_with_documented_analysis_plan") {
    excluded.push(`screen_6_disposition:${input.disposition.decision}`);
  }
  const unresolvedItems = unique([
    ...input.boundary.unresolvedHighConsequenceIssues.map(({ message }) =>
      message),
    ...input.disposition.specifiedRevisions,
  ]);
  const includedModules = [
    "study_context",
    "confirmed_policy_identity",
    ...input.profile.upstreamModules
      .filter(({ availability }) => availability === "available")
      .map(({ module }) => module),
    "screen_6_credibility_plan",
    "screen_6_conditional_claim_boundary",
    "screen_6_research_planning_disposition",
  ];
  return {
    status: excluded.length || unresolvedItems.length ? "partial" as const :
      "complete" as const,
    includedModules: unique(includedModules),
    excludedOrUnassessedEvidence: unique(excluded),
    unresolvedItems,
  };
}

function sourceLinks(input: {
  shock: ConfirmedShock;
  eventCardReview: EventCardReview | null;
  coEventCandidates: CoEventCandidate[];
  scholarlyClaimExtractions: ScholarlyClaimExtraction[];
}) {
  const links: Screen6ExportSourceLink[] = [];
  for (const sourceId of input.shock.identitySourceIds) {
    links.push({
      id: `screen1:${sourceId}`,
      sourceId,
      screen: 1,
      role: "confirmed_identity_reference",
      title: null,
      locator: null,
      publisher: null,
      documentVersionId: null,
      contentHash: null,
      passageIds: [],
      evidenceStatus: "reference_only",
      exportedContent: "metadata_and_reference_only",
    });
  }
  const eventCard = input.eventCardReview?.lockedEventCard;
  const policyBySource = new Map<string, Screen6ExportSourceLink>();
  for (const claim of eventCard?.claims ?? []) {
    for (const lineage of claim.lineages) {
      const id = `screen2:${lineage.sourceId}:${lineage.documentVersionId}`;
      const existing = policyBySource.get(id);
      policyBySource.set(id, {
        id,
        sourceId: lineage.sourceId,
        screen: 2,
        role: "reviewed_policy_evidence_reference",
        title: null,
        locator: null,
        publisher: null,
        documentVersionId: lineage.documentVersionId,
        contentHash: null,
        passageIds: unique([
          ...(existing?.passageIds ?? []),
          lineage.passageId,
        ]),
        evidenceStatus: "reference_only",
        exportedContent: "metadata_and_reference_only",
      });
    }
  }
  links.push(...policyBySource.values());
  for (const candidate of input.coEventCandidates) {
    for (const source of candidate.evidence) {
      links.push({
        id: `screen4:${candidate.id}:${source.sourceId}`,
        sourceId: source.sourceId,
        screen: 4,
        role: "coevent_occurrence_metadata",
        title: source.title,
        locator: source.locator,
        publisher: source.publisher,
        documentVersionId: null,
        contentHash: null,
        passageIds: [],
        evidenceStatus: "source_metadata_documented",
        exportedContent: "metadata_and_reference_only",
      });
    }
  }
  for (const extraction of input.scholarlyClaimExtractions) {
    links.push({
      id: `screen5:${extraction.documentReference.documentId}`,
      sourceId: extraction.passageReference.sourceId,
      screen: 5,
      role: "scholarly_document_reference",
      title: extraction.documentReference.title,
      locator: extraction.documentReference.canonicalUrl,
      publisher: null,
      documentVersionId: extraction.documentReference.documentVersionId,
      contentHash: extraction.documentReference.contentHash,
      passageIds: [extraction.passageReference.passageId],
      evidenceStatus: "inspected_partial_text",
      exportedContent: "metadata_and_reference_only",
    });
  }
  const deduplicated = new Map<string, Screen6ExportSourceLink>();
  for (const link of links) {
    const existing = deduplicated.get(link.id);
    deduplicated.set(link.id, existing
      ? {
          ...existing,
          passageIds: unique([...existing.passageIds, ...link.passageIds]),
        }
      : link);
  }
  return [...deduplicated.values()];
}

function claimLinks(input: {
  boundary: Screen6ConditionalClaimBoundary;
  disposition: Screen6ResearchPlanningDisposition;
  eventCardReview: EventCardReview | null;
  coEventCandidates: CoEventCandidate[];
  coEventOccurrenceReviews: CoEventOccurrenceReview[];
  mechanismSynthesisInput: MechanismSynthesisInput | null;
  mechanismReview: MechanismReview | null;
}) {
  const links: Screen6ExportClaimLink[] = [];
  for (const claim of input.eventCardReview?.lockedEventCard?.claims ?? []) {
    links.push({
      id: `screen2:${claim.claimId}`,
      screen: 2,
      kind: "reviewed_policy_claim",
      statement: claim.effectiveStatement,
      reviewStatus: claim.decision,
      provenance: claim.statementOrigin,
      sourceIds: unique(claim.lineages.map(({ sourceId }) => sourceId)),
      passageIds: unique(claim.lineages.map(({ passageId }) => passageId)),
      artifactIds: [input.eventCardReview!.lockedEventCard!.snapshotId],
    });
  }
  for (const candidate of input.coEventCandidates) {
    const review = [...input.coEventOccurrenceReviews].reverse().find(
      ({ candidateReference }) =>
        candidateReference.candidateId === candidate.id,
    );
    links.push({
      id: `screen4:${candidate.id}`,
      screen: 4,
      kind: "coevent_occurrence_record",
      statement: `${candidate.title}: ${candidate.description}`,
      reviewStatus: review?.decision ?? "unreviewed",
      provenance: candidate.occurrenceStatus,
      sourceIds: candidate.evidence.map(({ sourceId }) => sourceId),
      passageIds: [],
      artifactIds: [candidate.id, ...(review ? [review.id] : [])],
    });
  }
  for (const claim of input.mechanismSynthesisInput?.acceptedScholarlyClaims ?? []) {
    const statement = [
      claim.reviewedFields.theoreticalProposition,
      claim.reviewedFields.relevantResultOrQualification,
    ].filter((value): value is string => Boolean(value)).join(" ");
    links.push({
      id: `screen5:${claim.extractionReference.extractionId}`,
      screen: 5,
      kind: "reviewed_scholarly_claim",
      statement: statement ||
        "Reviewed scholarly claim retained without a proposition or result statement.",
      reviewStatus: claim.reviewReference.decision,
      provenance: claim.reviewedFields.fieldProvenance,
      sourceIds: [claim.sourceLineage.passageReference.sourceId],
      passageIds: [claim.sourceLineage.passageReference.passageId],
      artifactIds: [
        claim.extractionReference.extractionId,
        claim.reviewReference.reviewId,
      ],
    });
  }
  const acceptedClaims = new Map(
    (input.mechanismSynthesisInput?.acceptedScholarlyClaims ?? []).map(
      (claim) => [claim.extractionReference.extractionId, claim],
    ),
  );
  for (const mechanism of input.mechanismReview?.mechanisms ?? []) {
    const claims = mechanism.acceptedClaimReferences.flatMap((reference) => {
      const claim = acceptedClaims.get(reference.extractionId);
      return claim ? [claim] : [];
    });
    links.push({
      id: `screen5:${input.mechanismReview!.snapshotId}:${mechanism.id}`,
      screen: 5,
      kind: "researcher_mechanism_hypothesis",
      statement:
        `${mechanism.label}: ${mechanism.causalSequence.join(" → ")}`,
      reviewStatus: mechanism.decision,
      provenance: `${input.mechanismReview!.origin}:${mechanism.evidenceLevel}`,
      sourceIds: unique(claims.map((claim) =>
        claim.sourceLineage.passageReference.sourceId)),
      passageIds: unique(claims.map((claim) =>
        claim.sourceLineage.passageReference.passageId)),
      artifactIds: [
        input.mechanismReview!.snapshotId,
        ...mechanism.acceptedClaimReferences.flatMap((reference) => [
          reference.extractionId,
          reference.reviewId,
        ]),
      ],
    });
  }
  links.push({
    id: `screen6:${input.boundary.snapshotId}`,
    screen: 6,
    kind: "prospective_conditional_claim",
    statement: input.boundary.intendedClaim.prospectiveStatement,
    reviewStatus: input.disposition.decision,
    provenance: "researcher_selected_target_fixed_software_boundary",
    sourceIds: [],
    passageIds: [],
    artifactIds: [input.boundary.snapshotId, input.disposition.id],
  });
  return links;
}

function decisionEntry(input: Omit<Screen6ExportDecision, "decisionFingerprint">) {
  return {
    ...input,
    decisionFingerprint: fingerprintSixScreenValue(input),
  };
}

function decisions(input: {
  shock: ConfirmedShock;
  boundary: Screen6ConditionalClaimBoundary;
  disposition: Screen6ResearchPlanningDisposition;
  eventCardReview: EventCardReview | null;
  designDecision: CausalDesignDecision | null;
  coEventOccurrenceReviews: CoEventOccurrenceReview[];
  coEventDuplicateReviews: CoEventDuplicateReview[];
  coEventRelationReviews: CoEventRelationReview[];
  scholarlyClaimReviews: ScholarlyClaimReview[];
  mechanismReview: MechanismReview | null;
  resultHistory: Screen6CredibilityPlanExport["resultsInspectionHistory"];
  exportedAt: string;
  exportId: string;
}) {
  const values: Screen6ExportDecision[] = [];
  values.push(decisionEntry({
    id: input.shock.confirmation.decisionId,
    screen: 1,
    kind: "confirmed_policy_identity",
    actor: "researcher",
    decision: "confirmed",
    rationale: null,
    at: input.shock.confirmation.confirmedAt,
    sourceIds: [...input.shock.identitySourceIds],
    artifactIds: [input.shock.id],
  }));
  for (const event of input.eventCardReview?.changeHistory ?? []) {
    values.push(decisionEntry({
      id: event.id,
      screen: 2,
      kind: event.kind,
      actor: "researcher",
      decision: event.summary,
      rationale: event.kind === "event_card_locked" ? event.rationale : null,
      at: event.at,
      sourceIds: [],
      artifactIds: event.kind === "event_card_locked"
        ? [event.eventCardSnapshotId]
        : [input.eventCardReview!.id],
    }));
  }
  if (input.designDecision) {
    values.push(decisionEntry({
      id: input.designDecision.snapshotId,
      screen: 3,
      kind: "causal_comparison_decision",
      actor: "researcher",
      decision: input.designDecision.decision,
      rationale: input.designDecision.rationale,
      at: input.designDecision.decidedAt,
      sourceIds: [],
      artifactIds: [input.designDecision.designSetSnapshotId],
    }));
  }
  for (const review of input.coEventOccurrenceReviews) {
    values.push(decisionEntry({
      id: review.id,
      screen: 4,
      kind: "coevent_occurrence_review",
      actor: "researcher",
      decision: review.decision,
      rationale: review.rationale,
      at: review.reviewedAt,
      sourceIds: [],
      artifactIds: [review.candidateReference.candidateId],
    }));
  }
  for (const review of input.coEventDuplicateReviews) {
    values.push(decisionEntry({
      id: review.id,
      screen: 4,
      kind: "coevent_duplicate_or_stage_review",
      actor: "researcher",
      decision: review.decision,
      rationale: review.rationale,
      at: review.reviewedAt,
      sourceIds: [],
      artifactIds: review.members.map(({ candidateId }) => candidateId),
    }));
  }
  for (const review of input.coEventRelationReviews) {
    values.push(decisionEntry({
      id: review.id,
      screen: 4,
      kind: "coevent_comparison_relation_review",
      actor: "researcher",
      decision: `${review.decision}:${review.relation.category}`,
      rationale: review.rationale,
      at: review.reviewedAt,
      sourceIds: [],
      artifactIds: [
        review.binding.candidateId,
        review.binding.matrixSnapshotId,
        review.binding.designDecisionSnapshotId,
      ],
    }));
  }
  for (const review of input.scholarlyClaimReviews) {
    values.push(decisionEntry({
      id: review.id,
      screen: 5,
      kind: "scholarly_claim_review",
      actor: "researcher",
      decision: review.decision,
      rationale: review.rationale,
      at: review.reviewedAt,
      sourceIds: [],
      artifactIds: [review.extractionReference.extractionId],
    }));
  }
  if (input.mechanismReview) {
    values.push(decisionEntry({
      id: input.mechanismReview.snapshotId,
      screen: 5,
      kind: "mechanism_review",
      actor: "researcher",
      decision: input.mechanismReview.intendedClaim,
      rationale: input.mechanismReview.overallRationale,
      at: input.mechanismReview.reviewedAt,
      sourceIds: [],
      artifactIds: [
        input.mechanismReview.binding.synthesisInputSnapshotId,
        ...input.mechanismReview.mechanisms.map(({ id }) => id),
      ],
    }));
  }
  for (const { reviews } of input.resultHistory) {
    for (const review of reviews) {
      values.push(decisionEntry({
        id: review.id,
        screen: 6,
        kind: "diagnostic_result_review",
        actor: "researcher",
        decision: review.decision,
        rationale: review.rationale,
        at: review.reviewedAt,
        sourceIds: [],
        artifactIds: [review.resultReference.resultId],
      }));
    }
  }
  values.push(decisionEntry({
    id: input.boundary.snapshotId,
    screen: 6,
    kind: "conditional_claim_boundary",
    actor: "researcher",
    decision: input.boundary.intendedClaim.claimLevel,
    rationale: input.boundary.intendedClaim.targetDescription,
    at: input.boundary.createdAt,
    sourceIds: [],
    artifactIds: [input.boundary.binding.planSnapshotId],
  }));
  values.push(decisionEntry({
    id: input.disposition.id,
    screen: 6,
    kind: "research_planning_disposition",
    actor: "researcher",
    decision: input.disposition.decision,
    rationale: input.disposition.rationale,
    at: input.disposition.decidedAt,
    sourceIds: [],
    artifactIds: [input.boundary.snapshotId],
  }));
  values.push(decisionEntry({
    id: input.exportId,
    screen: 6,
    kind: "research_export_created",
    actor: "researcher",
    decision: "export_current_source_linked_record",
    rationale: null,
    at: input.exportedAt,
    sourceIds: [],
    artifactIds: [input.boundary.snapshotId, input.disposition.id],
  }));
  return values;
}

function reportMarkdown(input: {
  profile: Screen6UncertaintyProfile;
  plan: Screen6DiagnosticPlan;
  boundary: Screen6ConditionalClaimBoundary;
  disposition: Screen6ResearchPlanningDisposition;
  completeness: Screen6ResearchExport["completeness"];
  resultHistory: Screen6CredibilityPlanExport["resultsInspectionHistory"];
  mechanismReview: MechanismReview | null;
  predictionMatrix: PredictionMatrix | null;
  sourceCount: number;
  decisionCount: number;
}) {
  const diagnosticLines = input.boundary.diagnosticStatuses.length
    ? input.boundary.diagnosticStatuses.map((status) =>
        `- ${status.label}: ${status.status.replaceAll("_", " ")}`).join("\n")
    : "- No reviewed diagnostic trigger selected a card.";
  const issueLines = input.completeness.unresolvedItems.length
    ? input.completeness.unresolvedItems.map((issue) => `- ${issue}`).join("\n")
    : "- No unresolved item is recorded in this bounded snapshot.";
  const revisionLines = input.disposition.specifiedRevisions.length
    ? input.disposition.specifiedRevisions.map((revision) =>
        `- ${revision}`).join("\n")
    : "- No disposition-level revision was specified.";
  const mechanismSummary = input.mechanismReview && input.predictionMatrix
    ? `${input.mechanismReview.mechanisms.length} researcher-authored mechanism card${input.mechanismReview.mechanisms.length === 1 ? "" : "s"} and ${input.predictionMatrix.rows.length} observable prediction${input.predictionMatrix.rows.length === 1 ? "" : "s"} are bound. ${input.predictionMatrix.compactEvidencePlan.remainingIndistinguishablePairs.length} mechanism pair${input.predictionMatrix.compactEvidencePlan.remainingIndistinguishablePairs.length === 1 ? " remains" : "s remain"} indistinguishable in the current matrix.`
    : "No current researcher-authored mechanism review and prediction matrix is bound.";
  return `# ShockAudit design record\n\n` +
    `Export status: ${input.completeness.status}.\n\n` +
    `## Study and confirmed policy\n\n` +
    `Study: ${input.profile.study.id}, revision ${input.profile.study.revision}.\n\n` +
    `Confirmed policy: ${input.profile.policy.officialTitle} (${input.profile.policy.episode}).\n\n` +
    `Outcome: ${input.profile.study.outcome ?? "not recorded"}.\n\n` +
    `## Current design target and conditional claim\n\n` +
    `${input.boundary.currentDesignTarget.basis}\n\n` +
    `${input.boundary.intendedClaim.prospectiveStatement}\n\n` +
    `Attribution ceiling: ${input.boundary.intendedClaim.attributionCeiling}\n\n` +
    `## Mechanism review\n\n${mechanismSummary}\n\n` +
    `## Diagnostic status\n\n${diagnosticLines}\n\n` +
    `The results-inspection history contains ${input.resultHistory.length} result record${input.resultHistory.length === 1 ? "" : "s"}. ` +
    `The reviewed method library is ${input.plan.methodLibrary.version}.\n\n` +
    `## Research-planning disposition\n\n` +
    `${input.disposition.decision.replaceAll("_", " ")}: ${input.disposition.rationale}\n\n` +
    `Proposed revisions:\n${revisionLines}\n\n` +
    `## Unresolved items\n\n${issueLines}\n\n` +
    `## Source-linked trail\n\n` +
    `${input.sourceCount} source reference${input.sourceCount === 1 ? "" : "s"} and ` +
    `${input.decisionCount} researcher decision${input.decisionCount === 1 ? "" : "s"} are retained in the machine-readable files. Exact source excerpts are omitted from the default export; source, document, passage, hash and artifact references remain where available.\n\n` +
    `## Boundary\n\n${EXPORT_BOUNDARY}\n`;
}

function baseFiles(input: {
  credibilityPlan: Screen6CredibilityPlanExport;
  designRecord: Screen6FinalDesignRecord;
  trail: Screen6SourceLinkedDecisionTrail;
  searchManifest: Screen6ResearchExport["searchManifest"];
  readableReport: Screen6ResearchExport["readableReport"];
}) {
  const eventCard = input.designRecord.policyRecord.eventCard;
  const sources = input.trail.sources;
  const claims = input.trail.claims;
  return [
    {
      name: "design-record.md",
      mediaType: "text/markdown" as const,
      content: input.readableReport.markdown,
    },
    {
      name: "README.md",
      mediaType: "text/markdown" as const,
      content:
        `# ShockAudit research export\n\nStatus: ${input.designRecord.recordStatus}.\n\n` +
        "This bundle is a source-linked research-planning record. Read manifest.json for completeness, exclusions, versions and file fingerprints. Exact source excerpts, credentials, access tokens, private restoration state, hidden reasoning and raw user data are omitted by default.\n",
    },
    {
      name: "study.json",
      mediaType: "application/json" as const,
      content: json(input.designRecord.study),
    },
    {
      name: "confirmed-shock.json",
      mediaType: "application/json" as const,
      content: json(input.designRecord.confirmedShock),
    },
    {
      name: "event-card.json",
      mediaType: "application/json" as const,
      content: json({
        status: input.designRecord.policyRecord.status,
        eventCard,
      }),
    },
    {
      name: "designs.json",
      mediaType: "application/json" as const,
      content: json(input.designRecord.causalComparison),
    },
    {
      name: "coevents.json",
      mediaType: "application/json" as const,
      content: json(input.designRecord.competingEvents),
    },
    {
      name: "mechanisms.json",
      mediaType: "application/json" as const,
      content: json(input.designRecord.mechanisms),
    },
    {
      name: "credibility-plan.json",
      mediaType: "application/json" as const,
      content: json(input.credibilityPlan),
    },
    {
      name: "sources.csv",
      mediaType: "text/csv" as const,
      content: csv([
        [
          "id", "source_id", "screen", "role", "title", "locator",
          "publisher", "document_version_id", "content_hash", "passage_ids",
          "evidence_status", "exported_content",
        ],
        ...sources.map((source) => [
          source.id,
          source.sourceId,
          source.screen,
          source.role,
          source.title,
          source.locator,
          source.publisher,
          source.documentVersionId,
          source.contentHash,
          source.passageIds.join(";"),
          source.evidenceStatus,
          source.exportedContent,
        ]),
      ]),
    },
    {
      name: "claims.csv",
      mediaType: "text/csv" as const,
      content: csv([
        [
          "id", "screen", "kind", "statement", "review_status",
          "provenance", "source_ids", "passage_ids", "artifact_ids",
        ],
        ...claims.map((claim) => [
          claim.id,
          claim.screen,
          claim.kind,
          claim.statement,
          claim.reviewStatus,
          claim.provenance,
          claim.sourceIds.join(";"),
          claim.passageIds.join(";"),
          claim.artifactIds.join(";"),
        ]),
      ]),
    },
    {
      name: "search-manifest.json",
      mediaType: "application/json" as const,
      content: json(input.searchManifest),
    },
    {
      name: "decisions.json",
      mediaType: "application/json" as const,
      content: json({
        schemaVersion: input.trail.schemaVersion,
        decisions: input.trail.decisions,
        workflowChanges: input.trail.workflowChanges,
        trailFingerprint: input.trail.trailFingerprint,
      }),
    },
  ] satisfies Screen6ResearchExportFile[];
}

function manifestFor(input: {
  completeness: Screen6ResearchExport["completeness"];
  plan: Screen6DiagnosticPlan;
  designSet: CausalDesignSet | null;
  files: Screen6ResearchExportFile[];
}) {
  const body: ManifestBody = {
    schemaVersion: SIX_SCREEN_RESEARCH_EXPORT_MANIFEST_VERSION,
    applicationVersion: SHOCKAUDIT_VERSION,
    exportSchemaVersion: SIX_SCREEN_RESEARCH_EXPORT_VERSION,
    bundleFormat: SIX_SCREEN_RESEARCH_EXPORT_BUNDLE_VERSION,
    completenessStatus: input.completeness.status,
    methodVersions: {
      diagnosticLibraryVersion: input.plan.methodLibrary.version,
      diagnosticLibraryFingerprint: input.plan.methodLibrary.fingerprint,
      causalMethodLibraryVersion: input.designSet?.methodLibraryVersion ?? null,
    },
    includedModules: [...input.completeness.includedModules],
    excludedOrUnassessedEvidence:
      [...input.completeness.excludedOrUnassessedEvidence],
    files: input.files.map((file) => ({
      name: file.name,
      mediaType: file.mediaType,
      byteLength: textBytes(file.content),
      contentFingerprint: fingerprintSixScreenValue(file.content),
    })),
    payloadFileCount: input.files.length,
    payloadByteLength: input.files.reduce((total, file) =>
      total + textBytes(file.content), 0),
    fingerprintSemantics:
      "integrity_coordinate_detects_change_not_source_truth_or_signature",
  };
  return {
    ...body,
    manifestFingerprint: fingerprintSixScreenValue(body),
  };
}

function expectedBody(input: {
  state: SixScreenWorkflowState;
  exportId: string;
  profile: Screen6UncertaintyProfile;
  plan: Screen6DiagnosticPlan;
  boundary: Screen6ConditionalClaimBoundary;
  disposition: Screen6ResearchPlanningDisposition;
  confirmedShock: ConfirmedShock;
  priorExports: readonly Screen6ResearchExport[];
  workflowRevision: number;
  changeLogLength: number;
  exportedAt: string;
}): ExportBody {
  requireBoundedIdentifier(input.exportId, "Screen 6 research export id");
  requireCanonicalInstant(input.exportedAt, "Screen 6 export exportedAt");
  validateConfirmedShockForProfile(input.confirmedShock, input.profile);
  if (
    input.plan.binding.profileSnapshotId !== input.profile.snapshotId ||
    input.plan.binding.profileFingerprint !== input.profile.profileFingerprint ||
    input.boundary.binding.profileSnapshotId !== input.profile.snapshotId ||
    input.boundary.binding.profileFingerprint !== input.profile.profileFingerprint ||
    input.boundary.binding.planSnapshotId !== input.plan.snapshotId ||
    input.boundary.binding.planFingerprint !== input.plan.planFingerprint ||
    input.disposition.boundaryReference.snapshotId !== input.boundary.snapshotId ||
    input.disposition.boundaryReference.boundaryFingerprint !==
      input.boundary.boundaryFingerprint
  ) throw new Error("Screen 6 export lineage is inconsistent.");
  if (
    !Number.isSafeInteger(input.workflowRevision) ||
    !Number.isSafeInteger(input.changeLogLength) ||
    input.workflowRevision < 0 ||
    input.changeLogLength < 0 ||
    input.changeLogLength > input.state.changeLog.length ||
    input.workflowRevision !== input.changeLogLength
  ) throw new Error("Screen 6 export workflow cutoff is invalid.");
  if (Date.parse(input.exportedAt) < Date.parse(input.disposition.decidedAt)) {
    throw new Error("A Screen 6 export predates its planning disposition.");
  }
  const previous = input.priorExports.at(-1) ?? null;
  if (previous && Date.parse(input.exportedAt) < Date.parse(previous.exportedAt)) {
    throw new Error("Screen 6 export history is not chronological.");
  }
  if (input.priorExports.some((record) =>
    record.binding.dispositionId === input.disposition.id)) {
    throw new Error("A Screen 6 disposition can create only one research export.");
  }
  const parents = findParents({ state: input.state, profile: input.profile });
  const inspectedResults = resultHistory({
    state: input.state,
    boundary: input.boundary,
  });
  const revisions = proposedRevisions(inspectedResults, input.disposition);
  const complete = completeness({
    profile: input.profile,
    boundary: input.boundary,
    disposition: input.disposition,
  });
  const credibilityBody: CredibilityBody = {
    schemaVersion: SIX_SCREEN_CREDIBILITY_PLAN_EXPORT_VERSION,
    profileReference: {
      snapshotId: input.profile.snapshotId,
      profileFingerprint: input.profile.profileFingerprint,
    },
    diagnosticPlanReference: {
      snapshotId: input.plan.snapshotId,
      planFingerprint: input.plan.planFingerprint,
    },
    methodLibrary: structuredClone(input.plan.methodLibrary),
    dimensions: structuredClone(input.boundary.dimensionStatuses),
    diagnosticStatuses: structuredClone(input.boundary.diagnosticStatuses),
    resultsInspectionHistory: inspectedResults,
    conditionalClaimBoundary: {
      snapshotId: input.boundary.snapshotId,
      boundaryFingerprint: input.boundary.boundaryFingerprint,
      currentDesignTarget:
        structuredClone(input.boundary.currentDesignTarget),
      claimLevels: structuredClone(input.boundary.claimLevels),
      intendedClaim: structuredClone(input.boundary.intendedClaim),
      statement: input.boundary.claimBoundary,
    },
    researchPlanningDisposition: structuredClone(input.disposition),
    proposedDesignOrClaimRevisions: revisions,
    unassessedModules: structuredClone(input.boundary.unassessedModules),
    unresolvedHighConsequenceIssues:
      structuredClone(input.boundary.unresolvedHighConsequenceIssues),
    recommendationType: "research_planning_not_causal_certification",
    nonOutputs: {
      aggregateScore: null,
      universalBadge: null,
      causalCertification: "not_available",
      assumptionProof: null,
      attributionUpgrade: null,
      automaticDesignMutation: null,
    },
  };
  const credibilityPlan: Screen6CredibilityPlanExport = {
    ...credibilityBody,
    credibilityPlanFingerprint: fingerprintSixScreenValue(credibilityBody),
  };
  const sanitizedExtractions = parents.scholarlyClaimExtractions.map(
    (extraction) => ({
      id: extraction.id,
      extractionFingerprint: extraction.extractionFingerprint,
      documentReference: structuredClone(extraction.documentReference),
      passageReference: {
        ...structuredClone(extraction.passageReference),
        exactText: "omitted_from_default_export" as const,
      },
      fields: structuredClone(extraction.fields),
      extractedAt: extraction.extractedAt,
    }),
  );
  const designBody: DesignRecordBody = {
    schemaVersion: SIX_SCREEN_DESIGN_RECORD_VERSION,
    recordStatus: complete.status === "complete"
      ? "final_current_snapshot_complete"
      : "final_current_snapshot_partial",
    study: structuredClone(input.profile.study),
    confirmedShock: structuredClone(input.confirmedShock),
    policyRecord: {
      status: parents.eventCardReview?.lockedEventCard
        ? "reviewed_event_card"
        : "not_assessed",
      eventCard: parents.eventCardReview?.lockedEventCard
        ? structuredClone(parents.eventCardReview.lockedEventCard)
        : null,
    },
    causalComparison: {
      status: parents.designDecision?.decision ?? "not_assessed",
      designSet: parents.designSet ? structuredClone(parents.designSet) : null,
      decision: parents.designDecision
        ? structuredClone(parents.designDecision)
        : null,
    },
    competingEvents: {
      status: parents.coEventExecution
        ? "execution_bound"
        : parents.coEventMatrix
        ? "matrix_only"
        : "not_assessed",
      matrix: parents.coEventMatrix
        ? structuredClone(parents.coEventMatrix)
        : null,
      execution: parents.coEventExecution
        ? structuredClone(parents.coEventExecution)
        : null,
      candidates: structuredClone(parents.coEventCandidates),
      occurrenceReviews: structuredClone(parents.coEventOccurrenceReviews),
      duplicateReviews: structuredClone(parents.coEventDuplicateReviews),
      relationReviews: structuredClone(parents.coEventRelationReviews),
      relationAssessment: parents.coEventRelationReviews.length
        ? "researcher_reviewed_records_available"
        : "not_assessed",
    },
    mechanisms: {
      status: parents.mechanismReview && parents.predictionMatrix
        ? "researcher_review_and_predictions"
        : parents.mechanismSynthesisInput
        ? "accepted_inputs_frozen_synthesis_blocked"
        : parents.mechanismLiteraturePlan
        ? "literature_plan_only"
        : "not_assessed",
      literaturePlan: parents.mechanismLiteraturePlan
        ? structuredClone(parents.mechanismLiteraturePlan)
        : null,
      synthesisInputReference: parents.mechanismSynthesisInput
        ? {
            snapshotId: parents.mechanismSynthesisInput.snapshotId,
            packetFingerprint: parents.mechanismSynthesisInput.packetFingerprint,
          }
        : null,
      claimExtractions: sanitizedExtractions,
      claimReviews: structuredClone(parents.scholarlyClaimReviews),
      synthesisStatus: parents.mechanismSynthesisInput
        ? structuredClone(parents.mechanismSynthesisInput.synthesis)
        : {
            status: "not_available",
            reasons: ["mechanism_synthesis_input_not_available"],
          },
      mechanismReview: parents.mechanismReview
        ? structuredClone(parents.mechanismReview)
        : null,
      mechanismCandidates: parents.mechanismReview
        ? structuredClone(parents.mechanismReview.mechanisms)
        : [],
      predictionMatrix: parents.predictionMatrix
        ? structuredClone(parents.predictionMatrix)
        : null,
    },
    credibilityPlanReference: {
      boundarySnapshotId: input.boundary.snapshotId,
      boundaryFingerprint: input.boundary.boundaryFingerprint,
      dispositionId: input.disposition.id,
      dispositionFingerprint: input.disposition.dispositionFingerprint,
      credibilityPlanFingerprint: credibilityPlan.credibilityPlanFingerprint,
    },
    finalConditionalClaim: input.boundary.intendedClaim.prospectiveStatement,
    finalDisposition: input.disposition.decision,
    unresolvedItems: [...complete.unresolvedItems],
    nonOutputs: {
      treatmentEffectEstimate: null,
      aggregateScore: null,
      universalBadge: null,
      causalCertification: "not_available",
      automaticAttributionUpgrade: null,
      automaticDesignMutation: null,
    },
  };
  const designRecord: Screen6FinalDesignRecord = {
    ...designBody,
    designRecordFingerprint: fingerprintSixScreenValue(designBody),
  };
  const sources = sourceLinks({
    shock: input.confirmedShock,
    eventCardReview: parents.eventCardReview,
    coEventCandidates: parents.coEventCandidates,
    scholarlyClaimExtractions: parents.scholarlyClaimExtractions,
  });
  const claims = claimLinks({
    boundary: input.boundary,
    disposition: input.disposition,
    eventCardReview: parents.eventCardReview,
    coEventCandidates: parents.coEventCandidates,
    coEventOccurrenceReviews: parents.coEventOccurrenceReviews,
    mechanismSynthesisInput: parents.mechanismSynthesisInput,
    mechanismReview: parents.mechanismReview,
  });
  const decisionTrail = decisions({
    shock: input.confirmedShock,
    boundary: input.boundary,
    disposition: input.disposition,
    eventCardReview: parents.eventCardReview,
    designDecision: parents.designDecision,
    coEventOccurrenceReviews: parents.coEventOccurrenceReviews,
    coEventDuplicateReviews: parents.coEventDuplicateReviews,
    coEventRelationReviews: parents.coEventRelationReviews,
    scholarlyClaimReviews: parents.scholarlyClaimReviews,
    mechanismReview: parents.mechanismReview,
    resultHistory: inspectedResults,
    exportedAt: input.exportedAt,
    exportId: input.exportId,
  });
  const trailBody: TrailBody = {
    schemaVersion: SIX_SCREEN_SOURCE_DECISION_TRAIL_VERSION,
    sources,
    claims,
    decisions: decisionTrail,
    workflowChanges: structuredClone(
      input.state.changeLog.slice(0, input.changeLogLength),
    ),
    sourceExcerptPolicy:
      "exact_source_excerpts_omitted_from_default_export_references_retained",
    privateDataPolicy:
      "no_access_tokens_credentials_private_restoration_state_hidden_reasoning_or_raw_user_data",
  };
  const sourceLinkedDecisionTrail: Screen6SourceLinkedDecisionTrail = {
    ...trailBody,
    trailFingerprint: fingerprintSixScreenValue(trailBody),
  };
  const searchManifest: Screen6ResearchExport["searchManifest"] = {
    policy: {
      status: parents.eventCardReview?.lockedEventCard
        ? "reviewed_event_card"
        : "not_assessed",
      evidenceSnapshotId:
        input.profile.binding.eventCardReference?.binding.evidenceSnapshotId ??
          null,
      evidenceSnapshotFingerprint:
        input.profile.binding.eventCardReference?.binding
          .evidenceSnapshotFingerprint ?? null,
    },
    coevents: {
      status: parents.coEventExecution?.status ??
        (parents.coEventMatrix ? "matrix_only" : "not_assessed"),
      matrixSnapshotId: parents.coEventMatrix?.snapshotId ?? null,
      executionSnapshotId: parents.coEventExecution?.snapshotId ?? null,
      sourceQueries:
        parents.coEventExecution?.actualSearchBoundary.sourceQueries ?? 0,
      retainedCandidates: parents.coEventCandidates.length,
      remainingSteps: parents.coEventExecution?.remainingStepIds.length ?? 0,
    },
    mechanisms: {
      status: parents.mechanismReview && parents.predictionMatrix
        ? "researcher_review_and_predictions"
        : parents.mechanismSynthesisInput
        ? "accepted_inputs_frozen_synthesis_blocked"
        : parents.mechanismLiteraturePlan
        ? "literature_plan_only"
        : "not_assessed",
      literaturePlanSnapshotId:
        parents.mechanismLiteraturePlan?.snapshotId ?? null,
      synthesisInputSnapshotId:
        parents.mechanismSynthesisInput?.snapshotId ?? null,
      mechanismReviewSnapshotId:
        parents.mechanismReview?.snapshotId ?? null,
      predictionMatrixSnapshotId:
        parents.predictionMatrix?.snapshotId ?? null,
      semanticSynthesis: "not_used",
    },
    diagnostics: {
      planSnapshotId: input.plan.snapshotId,
      methodLibraryVersion: input.plan.methodLibrary.version,
      diagnosticCardCount: input.plan.cards.length,
      resultRecordCount: inspectedResults.length,
      resultReviewCount: inspectedResults.reduce((count, entry) =>
        count + entry.reviews.length, 0),
    },
  };
  const report = reportMarkdown({
    profile: input.profile,
    plan: input.plan,
    boundary: input.boundary,
    disposition: input.disposition,
    completeness: complete,
    resultHistory: inspectedResults,
    mechanismReview: parents.mechanismReview,
    predictionMatrix: parents.predictionMatrix,
    sourceCount: sources.length,
    decisionCount: decisionTrail.length,
  });
  const readableReport = {
    title: `ShockAudit design record — ${input.profile.policy.officialTitle}`,
    markdown: report,
    reportFingerprint: fingerprintSixScreenValue(report),
  };
  const files = baseFiles({
    credibilityPlan,
    designRecord,
    trail: sourceLinkedDecisionTrail,
    searchManifest,
    readableReport,
  });
  const manifest = manifestFor({
    completeness: complete,
    plan: input.plan,
    designSet: parents.designSet,
    files,
  });
  const lineageFingerprint = fingerprintSixScreenValue({
    runId: input.state.runId,
    profileSnapshotId: input.profile.snapshotId,
    profileFingerprint: input.profile.profileFingerprint,
    planSnapshotId: input.plan.snapshotId,
    planFingerprint: input.plan.planFingerprint,
    resultHistoryLength: input.boundary.binding.resultHistoryLength,
    reviewHistoryLength: input.boundary.binding.reviewHistoryLength,
    boundarySnapshotId: input.boundary.snapshotId,
    boundaryFingerprint: input.boundary.boundaryFingerprint,
    dispositionId: input.disposition.id,
    dispositionFingerprint: input.disposition.dispositionFingerprint,
  });
  return {
    schemaVersion: SIX_SCREEN_RESEARCH_EXPORT_VERSION,
    id: input.exportId,
    ordinal: input.priorExports.length + 1,
    previousExport: previous
      ? { id: previous.id, exportFingerprint: previous.exportFingerprint }
      : null,
    binding: {
      runId: input.state.runId,
      workflowRevision: input.workflowRevision,
      changeLogLength: input.changeLogLength,
      profileSnapshotId: input.profile.snapshotId,
      profileFingerprint: input.profile.profileFingerprint,
      planSnapshotId: input.plan.snapshotId,
      planFingerprint: input.plan.planFingerprint,
      resultHistoryLength: input.boundary.binding.resultHistoryLength,
      reviewHistoryLength: input.boundary.binding.reviewHistoryLength,
      boundarySnapshotId: input.boundary.snapshotId,
      boundaryFingerprint: input.boundary.boundaryFingerprint,
      dispositionId: input.disposition.id,
      dispositionFingerprint: input.disposition.dispositionFingerprint,
      lineageFingerprint,
    },
    completeness: complete,
    credibilityPlan,
    designRecord,
    sourceLinkedDecisionTrail,
    searchManifest,
    readableReport,
    manifest,
    preparation: {
      actor: "researcher",
      method: "deterministic_fixed_software",
      networkRequests: 0,
      modelCalls: 0,
      localRoutineCalls: 0,
      exportAction: "explicit",
    },
    nonOutputs: {
      treatmentEffectEstimate: null,
      aggregateScore: null,
      universalBadge: null,
      causalCertification: "not_available",
      assumptionProof: null,
      attributionUpgrade: null,
      automaticDesignMutation: null,
    },
    claimBoundary: EXPORT_BOUNDARY,
    exportedAt: input.exportedAt,
  };
}

function exportBody(record: Screen6ResearchExport): ExportBody {
  const { exportFingerprint: _exportFingerprint, ...body } = record;
  return body;
}

export function createScreen6ResearchExport(input: {
  state: SixScreenWorkflowState;
  exportId: string;
  profile: Screen6UncertaintyProfile;
  plan: Screen6DiagnosticPlan;
  boundary: Screen6ConditionalClaimBoundary;
  disposition: Screen6ResearchPlanningDisposition;
  priorExports: readonly Screen6ResearchExport[];
  actor: "researcher_ui" | "model" | "system";
  exportedAt: string;
}) {
  if (input.actor !== "researcher_ui") {
    throw new Error(
      "Only an explicit researcher UI action can create the Screen 6 research export.",
    );
  }
  if (input.priorExports.length >= SIX_SCREEN_RESEARCH_EXPORT_MAX_RECORDS) {
    throw new Error("Screen 6 research-export history reached capacity.");
  }
  const body = expectedBody({
    ...input,
    confirmedShock: input.state.confirmedShock ?? (() => {
      throw new Error("Screen 6 export requires the current confirmed policy identity.");
    })(),
    workflowRevision: input.state.revision,
    changeLogLength: input.state.changeLog.length,
  });
  const record = {
    ...body,
    exportFingerprint: fingerprintSixScreenValue(body),
  };
  return validateScreen6ResearchExport(record, input.state, input.priorExports);
}

export function validateScreen6ResearchExport(
  record: Screen6ResearchExport,
  state: SixScreenWorkflowState,
  priorExports: readonly Screen6ResearchExport[],
) {
  const profile = (state.screen6UncertaintyProfiles ?? []).find(
    ({ snapshotId }) => snapshotId === record.binding.profileSnapshotId,
  );
  const plan = (state.screen6DiagnosticPlans ?? []).find(({ snapshotId }) =>
    snapshotId === record.binding.planSnapshotId);
  const boundary = (state.screen6ConditionalClaimBoundaries ?? []).find(
    ({ snapshotId }) => snapshotId === record.binding.boundarySnapshotId,
  );
  const disposition = (state.screen6ResearchPlanningDispositions ?? []).find(
    ({ id }) => id === record.binding.dispositionId,
  );
  if (!profile || !plan || !boundary || !disposition) {
    throw new Error("Stored Screen 6 research export lost its exact lineage.");
  }
  const expected = expectedBody({
    state,
    exportId: record.id,
    profile,
    plan,
    boundary,
    disposition,
    confirmedShock: record.designRecord.confirmedShock,
    priorExports,
    workflowRevision: record.binding.workflowRevision,
    changeLogLength: record.binding.changeLogLength,
    exportedAt: record.exportedAt,
  });
  if (
    record.schemaVersion !== SIX_SCREEN_RESEARCH_EXPORT_VERSION ||
    record.exportFingerprint !==
      fingerprintSixScreenValue(exportBody(record)) ||
    !sameSixScreenValue(exportBody(record), expected) ||
    record.preparation.actor !== "researcher" ||
    record.preparation.exportAction !== "explicit" ||
    record.preparation.networkRequests !== 0 ||
    record.preparation.modelCalls !== 0 ||
    record.preparation.localRoutineCalls !== 0 ||
    record.nonOutputs.treatmentEffectEstimate !== null ||
    record.nonOutputs.aggregateScore !== null ||
    record.nonOutputs.universalBadge !== null ||
    record.nonOutputs.causalCertification !== "not_available" ||
    record.nonOutputs.assumptionProof !== null ||
    record.nonOutputs.attributionUpgrade !== null ||
    record.nonOutputs.automaticDesignMutation !== null ||
    bytes(record) > SIX_SCREEN_RESEARCH_EXPORT_MAX_BYTES
  ) throw new Error("Screen 6 research export is invalid.");
  requireFingerprint(
    record.binding.lineageFingerprint,
    "Screen 6 export lineage fingerprint",
  );
  requireFingerprint(
    record.credibilityPlan.credibilityPlanFingerprint,
    "Screen 6 CredibilityPlan fingerprint",
  );
  requireFingerprint(
    record.designRecord.designRecordFingerprint,
    "Screen 6 DesignRecord fingerprint",
  );
  requireFingerprint(
    record.sourceLinkedDecisionTrail.trailFingerprint,
    "Screen 6 source-linked trail fingerprint",
  );
  requireFingerprint(
    record.manifest.manifestFingerprint,
    "Screen 6 export manifest fingerprint",
  );
  requireFingerprint(record.exportFingerprint, "Screen 6 export fingerprint");
  for (const source of record.sourceLinkedDecisionTrail.sources) {
    requireBoundedIdentifier(source.id, "Screen 6 export source-link id");
    requireBoundedIdentifier(source.sourceId, "Screen 6 export source id");
    if (source.locator) requireSanitizedSourceUrl(source.locator);
  }
  return record;
}

export function validateScreen6ResearchExportCollection(
  state: SixScreenWorkflowState,
) {
  const records = state.screen6ResearchExports ?? [];
  if (!records.length) return records;
  if (
    records.length > SIX_SCREEN_RESEARCH_EXPORT_MAX_RECORDS ||
    bytes(records) > SIX_SCREEN_RESEARCH_EXPORT_COLLECTION_MAX_BYTES
  ) throw new Error("Stored Screen 6 research-export history exceeds its bounded contract.");
  const occupied = new Set<string>();
  for (const collection of [
    state.screen6UncertaintyProfiles ?? [],
    state.screen6DiagnosticPlans ?? [],
    state.screen6DiagnosticResults ?? [],
    state.screen6DiagnosticResultReviews ?? [],
    state.screen6ConditionalClaimBoundaries ?? [],
    state.screen6ResearchPlanningDispositions ?? [],
  ]) {
    for (const value of collection) {
      const candidate = value as { id?: string; snapshotId?: string };
      occupied.add(candidate.id ?? candidate.snapshotId!);
    }
  }
  const prior: Screen6ResearchExport[] = [];
  for (const record of records) {
    if (occupied.has(record.id)) {
      throw new Error("Stored Screen 6 research-export ids must be unique.");
    }
    validateScreen6ResearchExport(record, state, prior);
    occupied.add(record.id);
    prior.push(record);
  }
  return records;
}

export function createScreen6ResearchExportFiles(
  record: Screen6ResearchExport,
): Screen6ResearchExportFile[] {
  const files = baseFiles({
    credibilityPlan: record.credibilityPlan,
    designRecord: record.designRecord,
    trail: record.sourceLinkedDecisionTrail,
    searchManifest: record.searchManifest,
    readableReport: record.readableReport,
  });
  const expectedManifest = manifestFor({
    completeness: record.completeness,
    plan: {
      methodLibrary: record.credibilityPlan.methodLibrary,
    } as Screen6DiagnosticPlan,
    designSet: record.designRecord.causalComparison.designSet,
    files,
  });
  if (!sameSixScreenValue(record.manifest, expectedManifest)) {
    throw new Error("Screen 6 research-export manifest does not match its files.");
  }
  return [
    ...files,
    {
      name: "manifest.json",
      mediaType: "application/json",
      content: json(record.manifest),
    },
  ];
}

export function createScreen6ResearchExportBundle(
  record: Screen6ResearchExport,
): Screen6ResearchExportBundle {
  return {
    schemaVersion: SIX_SCREEN_RESEARCH_EXPORT_BUNDLE_VERSION,
    exportId: record.id,
    exportFingerprint: record.exportFingerprint,
    completenessStatus: record.completeness.status,
    manifest: structuredClone(record.manifest),
    files: createScreen6ResearchExportFiles(record),
  };
}
