import {
  SIX_SCREEN_FINGERPRINT_PATTERN,
  fingerprintSixScreenValue,
} from "./canonical";
import type { PolicyEventCardReviewState } from
  "./policy-event-card-review";
import type {
  CausalDesignDecision,
  CausalDesignSet,
} from "./causal-comparison";
import type {
  ProposedTreatmentTiming,
  Screen3StudyEntryContext,
  StudyDesignAdvice,
  StudyDesignSelection,
} from "./study-design-advice";
import type { CoEventSearchMatrix } from "./co-event-search";
import type {
  CoEventCandidateOccurrence,
  CoEventDiscoveryLead,
  CoEventExecutionPlan,
  CoEventSearchExecution,
} from "./co-event-execution";
import type {
  CoEventDuplicateReview,
  CoEventOccurrenceReview,
} from "./co-event-occurrence-review";
import type { CoEventRelationReview } from
  "./co-event-relation-review";
import type { CoEventPolicyLifecycleHandoff } from
  "./co-event-policy-lifecycle-handoff";
import type {
  PolicyLifecycleStageDisposition,
  PolicyLifecycleStageDocumentAcquisition,
} from "./policy-lifecycle-stage-review";
import type {
  PolicyLifecycleStageRevisionProposal,
  PolicyLifecycleStageRevisionReview,
} from "./policy-lifecycle-stage-revision";
import type { MechanismLiteraturePlan } from
  "./mechanism-literature-plan";
import type {
  MechanismLiteratureExecution,
  MechanismLiteratureExecutionPlan,
  ScholarlyEvidencePacket,
  ScholarlyMetadataRecord,
} from "./mechanism-literature-execution";
import type {
  ScholarlyDocumentAcquisition,
  ScholarlyPassagePacket,
} from "./mechanism-scholarly-document";
import type {
  ScholarlyClaimExtraction,
  ScholarlyClaimPacket,
  ScholarlyClaimReview,
} from "./mechanism-scholarly-claim-review";
import type { MechanismSynthesisInputPacket } from
  "./mechanism-synthesis-input";
import type {
  MechanismReview,
  PredictionMatrix,
} from "./mechanism-review";
import type { Screen6UncertaintyProfile } from
  "./screen6-uncertainty-profile";
import type { Screen6DiagnosticPlan } from
  "./screen6-diagnostic-plan";
import type {
  Screen6DiagnosticResult,
  Screen6DiagnosticResultReview,
} from "./screen6-diagnostic-result";
import type {
  Screen6ConditionalClaimBoundary,
  Screen6ResearchPlanningDisposition,
} from "./screen6-claim-boundary";
import type { Screen6ResearchExport } from
  "./screen6-research-export";
import type {
  StudyFirstEventInvestigation,
  StudyFirstEventScreen5Handoff,
} from "./study-first-event-investigation";
import type { Screen4InterpretationAttempt } from
  "./screen4-interpretation-queue";
import type {
  StudyFirstMechanismInput,
  StudyFirstMechanismRun,
} from
  "./study-first-mechanism-comparison";

export const SIX_SCREEN_WORKFLOW_SCHEMA_VERSION =
  "shockaudit-six-screen-workflow-v1" as const;
export const SIX_SCREEN_EVIDENCE_SCHEMA_VERSION =
  "shockaudit-evidence-snapshot-v1" as const;
export const SIX_SCREEN_RESEARCH_TASK_SCHEMA_VERSION =
  "shockaudit-research-task-v1" as const;

export type ReviewStatus =
  | "unreviewed"
  | "accepted"
  | "rejected"
  | "uncertain";
export type SupportStatus =
  | "direct"
  | "indirect"
  | "unsupported"
  | "conflicting";
export type EvidenceRequirementStatus =
  | "supported"
  | "partially_supported"
  | "conflicting"
  | "not_applicable"
  | "searched_not_found"
  | "source_unavailable"
  | "unsupported_route"
  | "not_found"
  | "inaccessible"
  | "unparsed"
  | "not_yet_searched";
export type ResultsInspectionStatus = "yes" | "no" | "not_disclosed";
export type SixScreenNumber = 1 | 2 | 3 | 4 | 5 | 6;

export type StudyContext = {
  id: string;
  revision: number;
  population: string | null;
  analysisUnit: string | null;
  geography: string[];
  industry: string[];
  period: { start: string | null; end: string | null };
  /** Outcome-side concept, retained under the released field name. */
  outcome: string | null;
  /** Optional operational measure for the outcome concept. */
  outcomeMeasure?: string | null;
  /**
   * Legacy outcome-side theoretical construct. This field is never migrated
   * implicitly because older studies may have used its label ambiguously.
   */
  intendedConstruct: string | null;
  /** Optional policy-side concept, separate from outcome and exposure. */
  policySideConcept?: string | null;
  initialExplanation: string | null;
  proposedTreatment: string | null;
  proposedComparison: string | null;
  resultsPreviouslyInspected: ResultsInspectionStatus;
  createdAt: string;
  updatedAt: string;
};

export type TypedDate = {
  start: string | null;
  end: string | null;
  precision: "day" | "month" | "year" | "interval" | "unknown";
  /** Optional source-provided milestone label retained for chronology display. */
  label?: string;
  kind:
    | "initiation"
    | "announcement"
    | "adoption"
    | "publication"
    | "scheduled_effect"
    | "legal_effect"
    | "compliance"
    | "implementation"
    | "enforcement"
    | "amendment"
    | "injunction"
    | "invalidation"
    | "withdrawal"
    | "suspension"
    | "repeal"
    | "supersession"
    | "other";
  passageIds: string[];
};

export type ShockIdentity = {
  id: string;
  originalRequest: string;
  officialTitle: string;
  aliases: string[];
  issuer: string;
  issuingJurisdiction: string;
  instrumentType: string;
  formalIdentifiers: string[];
  episode: string;
  versionScope: string;
  typedDates: TypedDate[];
  identitySourceIds: string[];
  identityFingerprint: string;
};

export type IdentityCandidate = ShockIdentity & {
  candidateRevision: number;
  sourceSnapshotId: string;
  sourceSnapshotFingerprint: string;
  identitySources: {
    id: string;
    title: string;
    locator: string;
    publisher: string;
    publishedDate: string | null;
    authorityTier: string;
    retrievedAt: string;
    provider?: string;
    nativeId?: string | null;
    routeId?: string;
    routeVersion?: string;
    accessStatus?: SourceAccessStatus;
    inspectedText?: InspectedText;
    contentHash?: string | null;
    retainedText?: string | null;
    limitation?: string | null;
  }[];
  displayedDescription: string;
  matchExplanation: string;
  materialMismatches: string[];
  retrievedAt: string;
};

export type ShockConfirmationReceipt = {
  decisionId: string;
  actor: "researcher";
  interactionId: string;
  workflowRevision: number;
  identityRevision: number;
  candidateId: string;
  sourceSnapshotId: string;
  sourceSnapshotFingerprint: string;
  displayedIdentityFingerprint: string;
  originalRequestFingerprint: string;
  currentRequestFingerprint: string;
  confirmedAt: string;
};

export type ConfirmedShock = ShockIdentity & {
  confirmation: ShockConfirmationReceipt;
};

export type SourceAccessStatus =
  | "available_metadata"
  | "retrieved_document"
  | "parsed_text"
  | "retained_passage"
  | "unavailable"
  | "inaccessible"
  | "unsupported_format";
export type InspectedText = "full" | "partial" | "abstract" | "metadata_only";

export type SourceRecord = {
  id: string;
  provider: string;
  nativeId: string;
  canonicalUrl: string;
  publisher: string;
  issuer: string | null;
  author: string | null;
  jurisdiction: string | null;
  role: string;
  documentType: string;
  language: string;
  publicationDate: string | null;
  legalVersionDates: TypedDate[];
  retrievedAt: string;
  documentVersionId: string;
  contentHash: string | null;
  acquisitionProvenance: "direct" | "third_party" | "upload";
  accessStatus: SourceAccessStatus;
  rightsStatus: string;
  parserVersion: string | null;
  textQualityStatus: string;
  inspectedText: InspectedText;
};

export type DocumentVersion = {
  id: string;
  sourceId: string;
  representation: string;
  language: string;
  versionLabel: string | null;
  retrievedAt: string;
  contentHash: string | null;
  parserVersion: string | null;
  parsedTextLength: number | null;
};

export type Passage = {
  id: string;
  sourceId: string;
  documentVersionId: string;
  locator: string;
  exactText: string;
  startOffset: number | null;
  endOffset: number | null;
  qualification: string | null;
  unresolvedCrossReferences: string[];
};

export type Claim = {
  id: string;
  eventId: string;
  predicate: string;
  typedValue: unknown;
  statement: string;
  scope: string;
  supportingPassageIds: string[];
  opposingPassageIds: string[];
  supportStatus: SupportStatus;
  reviewStatus: ReviewStatus;
  criticalFor: string[];
};

export type ConflictRecord = {
  id: string;
  eventId: string;
  predicate: string;
  claimIds: string[];
  competingValues: unknown[];
  scopes: string[];
  sourceRoles: string[];
  kind: "substantive" | "stage_or_version";
  resolution: string | null;
  reviewStatus: ReviewStatus;
};

export type EvidenceRequirement = {
  id: string;
  kind:
    | "identity"
    | "operative_change"
    | "previous_baseline"
    | "coverage"
    | "exemption"
    | "temporal_stage"
    | "version"
    | "implementation"
    | "enforcement"
    | "penalty"
    | "other";
  description: string;
  status: EvidenceRequirementStatus;
  criticality: "critical" | "material" | "contextual";
  supportingClaimIds: string[];
  /** Independently assessed dimensions; an umbrella claim cannot complete them. */
  subrequirements?: Array<{
    id: string;
    label: string;
    status: EvidenceRequirementStatus;
    supportingClaimIds: string[];
  }>;
};

export type EvidenceSnapshot = {
  schemaVersion: typeof SIX_SCREEN_EVIDENCE_SCHEMA_VERSION;
  id: string;
  revision: number;
  eventId: string;
  createdAt: string;
  sourceIds: string[];
  documentVersionIds: string[];
  passageIds: string[];
  claimIds: string[];
  conflictIds: string[];
  requirementIds: string[];
  snapshotFingerprint: string;
};

export const SIX_SCREEN_POLICY_REVIEW_PROTOCOL_VERSION =
  "screen-02-federal-register-policy-v2" as const;

export const SIX_SCREEN_POLICY_EVIDENCE_PLAN_SCHEMA_VERSION =
  "screen-02-policy-evidence-plan-v1" as const;

export type PolicyReviewFailureCode =
  | "source_unavailable"
  | "source_not_configured"
  | "unsupported_format"
  | "wrong_document"
  | "unparsed"
  | "cfr_coordinates_unavailable"
  | "historical_date_unavailable"
  | "response_limit"
  | "checkpoint_capacity";

export type PolicyEvidenceRequirementKind = Exclude<
  EvidenceRequirement["kind"],
  "identity" | "other"
>;

export type PolicyEvidencePlanStep = {
  id: string;
  label: string;
  objective: string;
  requirementKinds: PolicyEvidenceRequirementKind[];
  sourceRoute:
    | "complementary_policy_explanations"
    | "confirmed_federal_register_record"
    | "federal_register_ecfr_history"
    | "regulations_gov_docket"
    | "confirmed_official_document"
    | "official_document_relationships"
    | "future_official_context_routes";
  priority: number;
  status:
    | "not_started"
    | "searched"
    | "not_needed"
    | "waiting_source"
    | "blocked";
  attempts: number;
  lastAttemptedAt: string | null;
  failureCode: PolicyReviewFailureCode | null;
  note: string | null;
};

export type PolicyEvidencePlan = {
  schemaVersion: typeof SIX_SCREEN_POLICY_EVIDENCE_PLAN_SCHEMA_VERSION;
  id: string;
  identityFingerprint: string;
  documentNumber: string | null;
  jurisdiction: string;
  instrumentFamily: "federal_rule" | "federal_statute" | "official_document";
  steps: PolicyEvidencePlanStep[];
  nextStepId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PolicyReviewClaimProjection = {
  claimId: string;
  predicate:
    | "policy_explanation"
    | "operative_change"
    | "substantive_obligation"
    | "legal_effect_date"
    | "policy_date"
    | "implementation_schedule"
    | "coverage_condition"
    | "territorial_nexus"
    | "threshold_condition"
    | "exemption_rule"
    | "enforcement_authority"
    | "remedy"
    | "penalty"
    | "previous_baseline"
    | "historical_version_change"
    | "contemporaneous_amendment_record";
  statement: string;
  typedValue: unknown;
  supportStatus: SupportStatus;
  qualification: string | null;
  citation: {
    passageId: string;
    exactText: string;
    locator: string;
    documentVersionId: string;
    sourceId: string;
    sourceTitle: string;
    provider?: string;
    canonicalUrl: string;
    sourceRole: string;
    documentType?: string;
    author?: string | null;
    publicationDate?: string | null;
    versionLabel?: string | null;
    inspectedText: InspectedText;
  };
};

export const SIX_SCREEN_POLICY_INTERPRETATION_SCHEMA_VERSION =
  "screen-02-hybrid-policy-interpretation-v2" as const;

export type PolicyInterpretationFinding = {
  label: string;
  text: string;
  claimIds: string[];
};

/**
 * Optional model-assisted synthesis over already normalized, source-linked
 * claims. The model never owns claim IDs, dates, source coordinates, or raw
 * document parsing; those bindings are attached and validated by the server.
 */
export type PolicyInterpretation = {
  schemaVersion: typeof SIX_SCREEN_POLICY_INTERPRETATION_SCHEMA_VERSION;
  method: "openai_bounded_claim_synthesis";
  inputFingerprint: string;
  overview: string;
  overviewClaimIds: string[];
  acceptedTimelineClaimIds: string[];
  whatChanged: PolicyInterpretationFinding[];
  coverage: PolicyInterpretationFinding[];
  enforcement: PolicyInterpretationFinding[];
  unresolvedQuestions: string[];
  generatedAt: string;
};

export type PolicyBriefingBoxAssessment = {
  box:
    | "overview"
    | "what_changed"
    | "coverage"
    | "timeline"
    | "implementation_enforcement";
  status: "sufficient" | "partial" | "missing" | "conflicting";
  supportingClaimIds: string[];
  missingRequirementKinds: PolicyEvidenceRequirementKind[];
  note: string;
};

export type PolicyBriefingQualityAssessment = {
  boxes: PolicyBriefingBoxAssessment[];
  readyForSynthesis: boolean;
  requiresAdditionalSources: boolean;
  assessedAt: string;
};

/**
 * Visible execution record for the optional plain-language rewrite. This is
 * intentionally separate from the source-derived briefing so a provider
 * problem can never erase the saved evidence or masquerade as model output.
 */
export type PolicyReviewSynthesis = {
  status:
    | "not_attempted"
    | "completed"
    | "skipped_insufficient_evidence"
    | "unavailable"
    | "failed";
  provider: "openai" | null;
  model: string | null;
  attemptedAt: string | null;
  completedAt: string | null;
  safeFailureCode: string | null;
  claimCount: number;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  } | null;
};

export type PolicyReview = {
  protocolVersion: typeof SIX_SCREEN_POLICY_REVIEW_PROTOCOL_VERSION;
  taskId: string;
  status: "ready" | "partial" | "waiting_source" | "unsupported";
  failureCode: PolicyReviewFailureCode | null;
  documentNumber: string | null;
  identityFingerprint: string;
  evidenceSnapshotId: string | null;
  evidenceSnapshotFingerprint: string | null;
  artifactStatus: WorkflowArtifactStatus;
  sourceCount: number;
  passageCount: number;
  claimCount: number;
  claims: PolicyReviewClaimProjection[];
  /** Box-level evidence sufficiency used to route further acquisition. */
  briefingQuality?: PolicyBriefingQualityAssessment;
  /** Optional bounded synthesis; exact claims and citations remain canonical. */
  interpretation?: PolicyInterpretation | null;
  /** Visible provider outcome; deterministic fallback is never mislabeled. */
  synthesis?: PolicyReviewSynthesis;
  /** Render-ready, evidence-derived briefing. */
  briefing?: PolicyBriefing;
  plan: PolicyEvidencePlan;
  progress: {
    searchedSteps: number;
    totalSteps: number;
    retainedDocuments: number;
    chargedDocumentAttempts: number;
    interruptedOperations: number;
    receivedBytes: number;
    activeResearchMs: number;
    /** Legacy snapshots may retain panel_driven; new Screen 2 runs exhaust the saved standard plan automatically. */
    continuationMode: "panel_driven" | "automatic_standard";
  };
  requirements: Array<{
    kind: PolicyEvidenceRequirementKind;
    description: string;
    status: EvidenceRequirementStatus;
    criticality: EvidenceRequirement["criticality"];
  }>;
  attemptedSources: string[];
  unresolved: string[];
  limitation: string | null;
  researchedAt: string;
  invalidatedAt: string | null;
  invalidationReason: string | null;
};

export type PolicyBriefingTimelineItem = {
  claimId: string;
  /** All source-linked claims consolidated into this displayed milestone. */
  claimIds?: string[];
  label: string;
  date: TypedDate;
  statement: string;
  qualification: string | null;
};

export type PolicyBriefingSection = {
  title: string;
  claimIds: string[];
  paragraphs: string[];
  /** Finding-level citation binding for current briefings; paragraphs remain for old snapshots. */
  findings?: Array<{
    label: string;
    text: string;
    claimIds: string[];
  }>;
  status: "supported" | "partial" | "unresolved" | "conflicting";
};

export type PolicyBriefing = {
  mode: "deterministic_source_reconstruction" |
    "hybrid_validated_interpretation";
  overview: string;
  overviewClaimIds: string[];
  timeline: PolicyBriefingTimelineItem[];
  /** Dated stages after the saved study window, disclosed separately from the main axis. */
  laterTimeline?: PolicyBriefingTimelineItem[];
  undatedTimelineClaimIds: string[];
  whatChanged: PolicyBriefingSection;
  coverage: PolicyBriefingSection;
  enforcement: PolicyBriefingSection;
  unresolvedQuestions: string[];
  generatedAt: string;
};

export type Dependencies = {
  studyRevision: number;
  identityFingerprint: string;
  eventCardSnapshotId: string | null;
  selectedDesignSnapshotId: string | null;
  coeventSnapshotId: string | null;
  mechanismSnapshotId: string | null;
};

export type WorkflowArtifactStatus =
  | "not_assessed"
  | "current"
  | "out_of_date"
  | "archived";

export type WorkflowArtifactReference = {
  snapshotId: string;
  screen: Exclude<SixScreenNumber, 1>;
  status: WorkflowArtifactStatus;
  dependencies: Dependencies;
  invalidatedAt: string | null;
  invalidationReason: string | null;
};

export type CandidateDecision = {
  id: string;
  candidateId: string;
  identityRevision: number;
  action: "confirmed" | "different_version" | "rejected" | "source_added";
  actor: "researcher";
  at: string;
  note: string | null;
};

export type IdentityResolutionRequest = {
  id: string;
  workflowRevision: number;
  identityRevision: number;
  originalRequestFingerprint: string;
  currentRequestFingerprint: string;
  requestedAt: string;
};

export type IdentityResolutionSummary = {
  requestId: string;
  taskId: string | null;
  status:
    | "resolved"
    | "not_resolved"
    | "not_enough_information"
    | "unsupported_for_request"
    | "source_unavailable";
  attemptedSources: string[];
  unresolved: string[];
  limitation: string | null;
  completedAt: string;
};

/** Safe public status only; private archives keep the original model receipts. */
export const SIX_SCREEN_OPTIONAL_ANALYSIS_RECOVERY_VERSION =
  "six-screen-optional-analysis-recovery-v1" as const;

export type SixScreenOptionalAnalysisRecovery = {
  schemaVersion: typeof SIX_SCREEN_OPTIONAL_ANALYSIS_RECOVERY_VERSION;
  blockedScreens: Array<3 | 4 | 5 | 6>;
  isolatedCounts: {
    screen3: number;
    screen4: number;
    screen5: number;
    screen6: number;
  };
};

export type SixScreenWorkflowState = {
  schemaVersion: typeof SIX_SCREEN_WORKFLOW_SCHEMA_VERSION;
  runId: string;
  revision: number;
  activeScreen: SixScreenNumber;
  /** Safe migration status. Private original analyses remain in store archives. */
  optionalAnalysisRecovery?: SixScreenOptionalAnalysisRecovery;
  study: StudyContext;
  originalShockInput: string;
  currentShockInput: string;
  shockInputHistory: { value: string; revision: number; changedAt: string }[];
  originalRequestFingerprint: string;
  currentRequestFingerprint: string;
  officialSourceLocators: string[];
  /** Provider-context identifier entered separately from official URLs. */
  officialIdentifier?: string | null;
  requestedJurisdiction: string | null;
  approximateYear: string | null;
  intendedEpisode: string | null;
  identityRevision: number;
  pendingIdentityRequest: IdentityResolutionRequest | null;
  lastIdentityResolution: IdentityResolutionSummary | null;
  candidates: IdentityCandidate[];
  displayedCandidateId: string | null;
  candidateDecisions: CandidateDecision[];
  confirmedShock: ConfirmedShock | null;
  policyReview: PolicyReview | null;
  /** Optional so persisted workflow-v1 records from before Event Card review remain readable. */
  policyEventCardReviews?: PolicyEventCardReviewState[];
  /** Optional so workflow-v1 records saved before Screen 3 remain readable. */
  causalDesignSets?: CausalDesignSet[];
  /** Researcher-owned selections and explicit no-selection records. */
  causalDesignDecisions?: CausalDesignDecision[];
  /** Researcher-owned Screen 2 timing choices; year precision never implies January 1. */
  proposedTreatmentTimings?: ProposedTreatmentTiming[];
  /** Immutable study-first Screen 2 → 3 handoff contexts. */
  screen3StudyEntryContexts?: Screen3StudyEntryContext[];
  /** Deterministic, version-bound Screen 3 guidance; never a scientific decision. */
  studyDesignAdvices?: StudyDesignAdvice[];
  /** Explicit bounded critique bound to one exact Screen 3 advice revision. */
  screen3Contextualizations?: Array<{
    id: string;
    adviceFingerprint: string;
    /** Exact admitted evidence, advice, and task-version packet for this attempt. */
    packetFingerprint?: string;
    reservationId: string;
    status: "pending" | "receipt_saved" | "validation_failed" |
      "completed" | "failed" | "outcome_unknown";
    /** One scientific task can retain multiple explicitly authorized attempts. */
    attemptOrdinal?: number;
    /** Explicit researcher authorization to start a separate request after an unknown outcome. */
    retryUnknownAttemptId?: string;
    /** Durable owner of a pre-dispatch claim. Optional on v24 records. */
    claimOperationId?: string | null;
    dispatchState?: "not_dispatched" | "dispatched" | "unknown";
    failureCode?: string | null;
    failureStage?: "local_configuration" | "admission" | "network" |
      "response_headers" | "response_body" | "model_output" |
      "persistence" | "projection" | null;
    receipt: import("./screen5-mechanism").Screen5MechanismProviderReceipt | null;
    supplement: unknown | null;
    error: string | null;
    updatedAt: string;
  }>;
  /** Explicit researcher selections or no-selection records for v2 advice. */
  studyDesignSelections?: StudyDesignSelection[];
  /** Optional so workflow-v1 records saved before Screen 4 remain readable. */
  coEventSearchMatrices?: CoEventSearchMatrix[];
  /** Immutable capability-aware plans, retained across later design revisions. */
  coEventExecutionPlans?: CoEventExecutionPlan[];
  /** Append-only provider-step snapshots for Screen 4. */
  coEventSearchExecutions?: CoEventSearchExecution[];
  /** Occurrence-only evidence remains reusable when interpretation is stale. */
  coEventCandidates?: CoEventCandidateOccurrence[];
  /** Metadata leads are retained separately and never promoted to occurrence. */
  coEventDiscoveryLeads?: CoEventDiscoveryLead[];
  /** Append-only researcher decisions about retained occurrence metadata. */
  coEventOccurrenceReviews?: CoEventOccurrenceReview[];
  /** Versioned study-first Screen 4 scans; independent of legacy Event Cards. */
  studyFirstEventInvestigations?: StudyFirstEventInvestigation[];
  /** Explicit server-model event interpretation attempts, one per bounded batch. */
  screen4InterpretationAttempts?: Screen4InterpretationAttempt[];
  /** Exact Screen 4 result version carried into Screen 5 on navigation. */
  studyFirstEventScreen5Handoffs?: StudyFirstEventScreen5Handoff[];
  /** Pairwise duplicate/stage decisions that never collapse source records. */
  coEventDuplicateReviews?: CoEventDuplicateReview[];
  /** Comparison-specific researcher judgments remain separate from occurrence evidence. */
  coEventRelationReviews?: CoEventRelationReview[];
  /** Researcher-routed possible focal-policy stages awaiting Screen 2 review. */
  coEventPolicyLifecycleHandoffs?: CoEventPolicyLifecycleHandoff[];
  /** Bounded official-document attempts for routed possible policy stages. */
  policyLifecycleStageDocumentAcquisitions?:
    PolicyLifecycleStageDocumentAcquisition[];
  /** Append-only researcher accept/reject/defer decisions for retained stage documents. */
  policyLifecycleStageDispositions?: PolicyLifecycleStageDisposition[];
  /** Immutable source-grounded chronology/Event Card proposals for accepted stage documents. */
  policyLifecycleStageRevisionProposals?:
    PolicyLifecycleStageRevisionProposal[];
  /** Append-only researcher decisions about lifecycle-stage revision proposals. */
  policyLifecycleStageRevisionReviews?: PolicyLifecycleStageRevisionReview[];
  /** Saved Screen 5 intake and literature plans; no mechanism result is implied. */
  mechanismLiteraturePlans?: MechanismLiteraturePlan[];
  /** Exact append-only researcher inputs for the study-first Screen 5 path. */
  studyFirstMechanismInputs?: StudyFirstMechanismInput[];
  /** Bounded scholarly discovery results linked to exact saved inputs. */
  studyFirstMechanismRuns?: StudyFirstMechanismRun[];
  /** Immutable capability-aware metadata execution plans for Screen 5. */
  mechanismLiteratureExecutionPlans?: MechanismLiteratureExecutionPlan[];
  /** Append-only metadata execution snapshots; no text inspection is implied. */
  mechanismLiteratureExecutions?: MechanismLiteratureExecution[];
  /** Crossref bibliographic leads retained separately from scholarly passages. */
  scholarlyMetadataRecords?: ScholarlyMetadataRecord[];
  /** Immutable Screen 5 packets with explicit metadata-only support limits. */
  scholarlyEvidencePackets?: ScholarlyEvidencePacket[];
  /** One exact bounded scholarly-document attempt per explicit researcher action. */
  scholarlyDocumentAcquisitions?: ScholarlyDocumentAcquisition[];
  /** Cumulative passage packets remain separate from metadata-only packets. */
  scholarlyPassagePackets?: ScholarlyPassagePacket[];
  /** Researcher-authored structured claims remain separate from source passages. */
  scholarlyClaimExtractions?: ScholarlyClaimExtraction[];
  /** Append-only explicit researcher decisions preserve every original extraction. */
  scholarlyClaimReviews?: ScholarlyClaimReview[];
  /** Cumulative claim/review packets never contain mechanism or prediction output. */
  scholarlyClaimPackets?: ScholarlyClaimPacket[];
  /** Deterministic accepted-input freezes remain separate from synthesis output. */
  mechanismSynthesisInputPackets?: MechanismSynthesisInputPacket[];
  /** Append-only researcher-authored mechanism decisions with exact frozen-input lineage. */
  mechanismReviews?: MechanismReview[];
  /** One researcher-authored observable-prediction matrix per mechanism review. */
  predictionMatrices?: PredictionMatrix[];
  /** Initial Screen 6 gap inventories; no diagnostic result or credibility certificate is implied. */
  screen6UncertaintyProfiles?: Screen6UncertaintyProfile[];
  /** Prospective Screen 6 plans selected only from the reviewed diagnostic library. */
  screen6DiagnosticPlans?: Screen6DiagnosticPlan[];
  /** Immutable researcher-supplied diagnostic results with explicit provenance. */
  screen6DiagnosticResults?: Screen6DiagnosticResult[];
  /** Append-only researcher interpretations of immutable diagnostic results. */
  screen6DiagnosticResultReviews?: Screen6DiagnosticResultReview[];
  /** Immutable prospective claim boundaries derived from exact current Screen 6 lineage. */
  screen6ConditionalClaimBoundaries?: Screen6ConditionalClaimBoundary[];
  /** One researcher-owned planning disposition for each retained claim boundary. */
  screen6ResearchPlanningDispositions?: Screen6ResearchPlanningDisposition[];
  /** Explicit immutable source-linked CredibilityPlan and DesignRecord exports. */
  screen6ResearchExports?: Screen6ResearchExport[];
  /** One bounded model supplement per exact current study-plan input. */
  screen6Personalizations?: Array<{
    id: string;
    inputFingerprint: string;
    reservationId: string;
    status: "pending" | "receipt_saved" | "validation_failed" |
      "completed" | "failed" | "outcome_unknown";
    attemptOrdinal?: number;
    /** Durable owner of a pre-dispatch claim. Optional on v24 records. */
    claimOperationId?: string | null;
    dispatchState?: "not_dispatched" | "dispatched" | "unknown";
    failureCode?: string | null;
    failureStage?: "local_configuration" | "admission" | "network" |
      "response_headers" | "response_body" | "model_output" |
      "persistence" | "projection" | null;
    receipt: import("./screen5-mechanism").Screen5MechanismProviderReceipt | null;
    supplement: unknown | null;
    error: string | null;
    updatedAt: string;
  }>;
  artifacts: WorkflowArtifactReference[];
  changeLog: {
    revision: number;
    at: string;
    summary: string;
  }[];
  createdAt: string;
  updatedAt: string;
};

const SENSITIVE_QUERY_PARAMETER = /^(?:api[_-]?key|key|token|access[_-]?token|authorization)$/iu;
const ISO_DATE_PATTERN = /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/u;

export function requireCanonicalInstant(value: string, label: string) {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    throw new Error(`${label} must be a canonical ISO instant.`);
  }
  return value;
}
export function requireBoundedIdentifier(value: string, label: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u.test(value)) {
    throw new Error(`${label} must be a bounded canonical identifier.`);
  }
  return value;
}

export function requireFingerprint(value: string, label: string) {
  if (!SIX_SCREEN_FINGERPRINT_PATTERN.test(value)) {
    throw new Error(`${label} must be a canonical six-screen fingerprint.`);
  }
  return value;
}

export function requireSanitizedSourceUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Source canonicalUrl must be an absolute URL.");
  }
  if (url.protocol !== "https:") {
    throw new Error("Source canonicalUrl must use HTTPS.");
  }
  for (const name of url.searchParams.keys()) {
    if (SENSITIVE_QUERY_PARAMETER.test(name)) {
      throw new Error("Source canonicalUrl must not contain credentials.");
    }
  }
  if (url.username || url.password || url.hash) {
    throw new Error("Source canonicalUrl must not contain credentials or fragments.");
  }
  return url.toString();
}

export function shockIdentityFingerprint(
  identity: Omit<ShockIdentity, "identityFingerprint">,
) {
  return fingerprintSixScreenValue(identity);
}

export function requireShockIdentity(identity: ShockIdentity) {
  requireBoundedIdentifier(identity.id, "Shock identity id");
  if (
    !identity.originalRequest.trim() || identity.originalRequest.length > 4_000 ||
    /[\u0000-\u001f\u007f]/u.test(identity.originalRequest)
  ) {
    throw new Error(
      "Shock identity originalRequest must preserve non-empty bounded user text.",
    );
  }
  for (const [name, field] of [
    ["officialTitle", identity.officialTitle],
    ["issuer", identity.issuer],
    ["issuingJurisdiction", identity.issuingJurisdiction],
    ["instrumentType", identity.instrumentType],
    ["episode", identity.episode],
    ["versionScope", identity.versionScope],
  ] as const) {
    if (!field.trim() || field !== field.trim()) {
      throw new Error(
        `Shock identity ${name} must be non-empty canonical text.`,
      );
    }
  }
  if (identity.identitySourceIds.length < 1) {
    throw new Error("A shock identity requires at least one identity source.");
  }
  for (const date of identity.typedDates) {
    if (date.start !== null && !ISO_DATE_PATTERN.test(date.start)) {
      throw new Error("Typed dates must retain day, month, year, or interval precision.");
    }
    if (date.end !== null && !ISO_DATE_PATTERN.test(date.end)) {
      throw new Error("Typed dates must retain day, month, year, or interval precision.");
    }
  }
  const fingerprintInput: Omit<ShockIdentity, "identityFingerprint"> = {
    id: identity.id,
    originalRequest: identity.originalRequest,
    officialTitle: identity.officialTitle,
    aliases: identity.aliases,
    issuer: identity.issuer,
    issuingJurisdiction: identity.issuingJurisdiction,
    instrumentType: identity.instrumentType,
    formalIdentifiers: identity.formalIdentifiers,
    episode: identity.episode,
    versionScope: identity.versionScope,
    typedDates: identity.typedDates,
    identitySourceIds: identity.identitySourceIds,
  };
  const expected = shockIdentityFingerprint(fingerprintInput);
  if (identity.identityFingerprint !== expected) {
    throw new Error("Shock identity fingerprint does not match its displayed fields.");
  }
  return identity;
}
