import { fingerprintSixScreenValue, sameSixScreenValue } from "./canonical";
import {
  SIX_SCREEN_POLICY_REVIEW_PROTOCOL_VERSION,
  SIX_SCREEN_WORKFLOW_SCHEMA_VERSION,
  requireBoundedIdentifier,
  requireCanonicalInstant,
  requireFingerprint,
  requireSanitizedSourceUrl,
  requireShockIdentity,
  shockIdentityFingerprint,
  type CandidateDecision,
  type ConfirmedShock,
  type Dependencies,
  type IdentityCandidate,
  type IdentityResolutionSummary,
  type IdentityResolutionRequest,
  type PolicyReview,
  type ShockIdentity,
  type SixScreenWorkflowState,
  type StudyContext,
  type WorkflowArtifactReference,
} from "./contracts";
import {
  POLICY_EVIDENCE_REQUIREMENT_KINDS,
  validatePolicyEvidencePlan,
} from "./policy-evidence-plan";
import { createPolicyBriefing } from "./policy-review";
import {
  normalizeScreen3StudyDraft,
  validateScreen3EntryDraft,
} from "./screen3-entry-validation";
import {
  SIX_SCREEN_POLICY_EVENT_CARD_MAX_REVISIONS,
  createPolicyEventCardReview,
  createPolicyEventCardReviewRevision,
  decidePolicyTreatmentClock,
  lockPolicyEventCardReview,
  reviewPolicyEventCardClaim,
  validatePolicyEventCardReview,
  validatePolicyEventCardReviewCollection,
  type PolicyClaimReviewDecision,
  type PolicyEventCardReviewState,
} from "./policy-event-card-review";
import type {
  PolicyChronologySourcePanelProjection,
  PolicyChronologyStage,
} from
  "./policy-chronology";
import {
  SIX_SCREEN_CAUSAL_DESIGN_MAX_REVISIONS,
  createCausalDesignDecision,
  createCausalDesignSet,
  validateCausalDesignCollections,
  type CausalComparisonInput,
  type CausalDesignDecision,
  type CausalDesignSet,
} from "./causal-comparison";
import {
  EMPTY_STUDY_DESIGN_CLARIFICATIONS,
  SIX_SCREEN_STUDY_DESIGN_MAX_RECORDS,
  createProposedTreatmentTiming,
  createScreen3StudyEntryContext,
  createStudyDesignAdvice,
  createStudyDesignSelection,
  currentProposedTreatmentTiming,
  currentScreen3StudyEntryContext,
  currentStudyDesignAdvice,
  currentStudyDesignSelection,
  normalizeStudyDesignClarifications,
  sameProposedTreatmentTiming,
  validateProposedTreatmentTimingInput,
  type ProposedTreatmentTimingInput,
  type StudyDesignClarifications,
  type StudyDesignEvidenceStatus,
  type StudyDesignSelection,
} from "./study-design-advice";
import {
  STUDY_FIRST_EVENT_MAX_HISTORY,
  createCompletedStudyFirstEventInvestigation,
  createPlannedStudyFirstEventInvestigation,
  createStudyFirstEventContext,
  createStudyFirstEventScreen5Handoff,
  currentStudyFirstEventInvestigation,
  type StudyFirstEventInvestigation,
  type StudyFirstEventPresentation,
  type StudyFirstEventRelevanceAnalysis,
  type StudyFirstEventSearchAttempt,
} from "./study-first-event-investigation";
import {
  STUDY_FIRST_MECHANISM_MAX_HISTORY,
  currentStudyFirstMechanismRun,
  validateStudyFirstMechanismInput,
  validateStudyFirstMechanismInputs,
  validateStudyFirstMechanismRuns,
  type StudyFirstMechanismInput,
  type StudyFirstMechanismRun,
} from "./study-first-mechanism-comparison";
import {
  SIX_SCREEN_COEVENT_SEARCH_MAX_REVISIONS,
  createCoEventSearchMatrix,
  validateCoEventSearchCollections,
  type CoEventSearchMatrix,
  type CoEventSearchScopeInput,
} from "./co-event-search";
import {
  SIX_SCREEN_COEVENT_MAX_CANDIDATES,
  SIX_SCREEN_COEVENT_MAX_DISCOVERY_LEADS,
  SIX_SCREEN_COEVENT_MAX_EXECUTION_PLANS,
  SIX_SCREEN_COEVENT_MAX_EXECUTION_SNAPSHOTS,
  createCoEventSearchExecution,
  validateCoEventCandidateOccurrence,
  validateCoEventDiscoveryLead,
  validateCoEventExecutionCollections,
  validateCoEventExecutionPlan,
  validateCoEventProviderAttempt,
  type CoEventCandidateOccurrence,
  type CoEventDiscoveryLead,
  type CoEventExecutionPlan,
  type CoEventProviderAttempt,
  type CoEventSearchExecution,
} from "./co-event-execution";
import {
  createCoEventDuplicateReview,
  createCoEventOccurrenceReview,
  latestCoEventDuplicateReview,
  latestCoEventOccurrenceReview,
  validateCoEventReviewCollections,
  type CoEventDuplicateReview,
  type CoEventDuplicateReviewDecision,
  type CoEventOccurrenceReview,
  type CoEventOccurrenceReviewDecision,
} from "./co-event-occurrence-review";
import {
  SIX_SCREEN_COEVENT_MAX_RELATION_REVIEWS,
  coEventRelationReviewCoverage,
  createCoEventRelationReview,
  latestCoEventRelationReview,
  validateCoEventRelationReviewCollection,
  type CoEventRelationReview,
  type CoEventRelationReviewDecision,
} from "./co-event-relation-review";
import {
  SIX_SCREEN_COEVENT_MAX_POLICY_LIFECYCLE_HANDOFFS,
  createCoEventPolicyLifecycleHandoff,
  validateCoEventPolicyLifecycleHandoffCollection,
  type CoEventPolicyLifecycleHandoff,
  type CoEventPolicyLifecycleStageKind,
} from "./co-event-policy-lifecycle-handoff";
import {
  createPolicyLifecycleStageDisposition,
  validatePolicyLifecycleStageReviewCollections,
  type PolicyLifecycleStageDisposition,
  type PolicyLifecycleStageDispositionDecision,
  type PolicyLifecycleStageDocumentAcquisition,
} from "./policy-lifecycle-stage-review";
import {
  createPolicyLifecycleStageRevisionProposal,
  createPolicyLifecycleStageRevisionReview,
  policyLifecycleStageContributionsForEventCardLock,
  validatePolicyLifecycleStageRevisionCollections,
  type PolicyLifecycleStageRevisionDecision,
} from "./policy-lifecycle-stage-revision";
import {
  createPolicyEventCardReference,
  type PolicyReviewedEventCard,
} from "./policy-event-card-review";
import {
  SIX_SCREEN_MECHANISM_LITERATURE_MAX_REVISIONS,
  createMechanismLiteraturePlan,
  validateMechanismLiteraturePlanCollection,
  type MechanismLiteraturePlan,
  type MechanismLiteraturePlanInput,
} from "./mechanism-literature-plan";
import {
  SIX_SCREEN_MECHANISM_LITERATURE_MAX_EVIDENCE_PACKETS,
  SIX_SCREEN_MECHANISM_LITERATURE_MAX_EXECUTION_PLANS,
  SIX_SCREEN_MECHANISM_LITERATURE_MAX_EXECUTIONS,
  SIX_SCREEN_MECHANISM_LITERATURE_MAX_METADATA_RECORDS,
  createMechanismLiteratureExecution,
  createScholarlyEvidencePacket,
  validateMechanismLiteratureExecutionCollections,
  validateMechanismLiteratureExecutionPlan,
  validateMechanismLiteratureProviderAttempt,
  validateScholarlyMetadataRecord,
  type MechanismLiteratureExecution,
  type MechanismLiteratureExecutionPlan,
  type MechanismLiteratureProviderAttempt,
  type ScholarlyEvidencePacket,
  type ScholarlyMetadataRecord,
} from "./mechanism-literature-execution";
import {
  SIX_SCREEN_SCHOLARLY_DOCUMENT_MAX_ACQUISITIONS,
  createScholarlyPassagePacket,
  validateScholarlyDocumentAcquisition,
  validateScholarlyDocumentCollections,
  type ScholarlyDocumentAcquisition,
  type ScholarlyPassagePacket,
} from "./mechanism-scholarly-document";
import {
  SIX_SCREEN_SCHOLARLY_CLAIM_MAX_EXTRACTIONS,
  SIX_SCREEN_SCHOLARLY_CLAIM_MAX_REVIEWS,
  createScholarlyClaimExtraction,
  createScholarlyClaimPacket,
  createScholarlyClaimReview,
  validateScholarlyClaimCollections,
  type ScholarlyClaimExtraction,
  type ScholarlyClaimFieldsDraft,
  type ScholarlyClaimPacket,
  type ScholarlyClaimReview,
  type ScholarlyClaimReviewDecision,
} from "./mechanism-scholarly-claim-review";
import {
  SIX_SCREEN_MECHANISM_SYNTHESIS_INPUT_MAX_PACKETS,
  createMechanismSynthesisInputPacket,
  validateMechanismSynthesisInputCollection,
  type MechanismSynthesisInputPacket,
} from "./mechanism-synthesis-input";
import {
  SIX_SCREEN_MECHANISM_REVIEW_MAX_REVISIONS,
  createMechanismReview,
  latestMechanismReviewForInput,
  validateMechanismReviewCollections,
  type MechanismReview,
  type MechanismReviewDraft,
  type PredictionMatrix,
} from "./mechanism-review";
import {
  SIX_SCREEN_UNCERTAINTY_PROFILE_MAX_REVISIONS,
  createScreen6UncertaintyProfile,
  screen6UncertaintyProfileGaps,
  screen6UncertaintyProfileInputFingerprint,
  validateScreen6UncertaintyProfileCollection,
  type Screen6ProfileContext,
  type Screen6UncertaintyProfile,
} from "./screen6-uncertainty-profile";
import {
  SIX_SCREEN_DIAGNOSTIC_PLAN_MAX_REVISIONS,
  createScreen6DiagnosticPlan,
  validateScreen6DiagnosticPlanCollection,
  type Screen6DiagnosticPlan,
  type Screen6DiagnosticPlanInput,
} from "./screen6-diagnostic-plan";
import {
  createScreen6DiagnosticResult,
  createScreen6DiagnosticResultReview,
  latestScreen6DiagnosticResultsForPlan,
  reviewsForScreen6DiagnosticResults,
  validateScreen6DiagnosticResultCollections,
  type Screen6DiagnosticResult,
  type Screen6DiagnosticResultInput,
  type Screen6DiagnosticResultReview,
  type Screen6DiagnosticResultReviewDecision,
} from "./screen6-diagnostic-result";
import {
  SIX_SCREEN_CLAIM_BOUNDARY_MAX_REVISIONS,
  SIX_SCREEN_RESEARCH_DISPOSITION_MAX_RECORDS,
  createScreen6ConditionalClaimBoundary,
  createScreen6ResearchPlanningDisposition,
  validateScreen6ClaimBoundaryCollections,
  type Screen6ClaimBoundaryInput,
  type Screen6ConditionalClaimBoundary,
  type Screen6ResearchPlanningDisposition,
  type Screen6ResearchPlanningDispositionDecision,
} from "./screen6-claim-boundary";
import {
  SIX_SCREEN_RESEARCH_EXPORT_MAX_RECORDS,
  createScreen6ResearchExport as buildScreen6ResearchExport,
  validateScreen6ResearchExportCollection,
  type Screen6ResearchExport,
} from "./screen6-research-export";
import type { SourceCapability } from "./capabilities";

export type StudyContextDraft = Omit<
  StudyContext,
  "id" | "revision" | "createdAt" | "updatedAt"
>;

export type IdentityCandidateInput = Omit<
  IdentityCandidate,
  "identityFingerprint" | "candidateRevision" | "originalRequest"
>;

export type Screen2StartReceipt = {
  runId: string;
  workflowRevision: number;
  studyRevision: number;
  confirmedShock: ConfirmedShock;
  dependencies: Dependencies;
  startedAt: string;
};

export type Screen3PrerequisiteCode =
  | "confirmed_policy"
  | "population"
  | "analysis_unit"
  | "geography"
  | "outcome"
  | "study_period"
  | "study_period_order"
  | "study_question"
  | "proposed_timing"
  | "treatment_year";

export type Screen3PrerequisiteReport = {
  ready: boolean;
  blockers: Array<{
    code: Screen3PrerequisiteCode;
    message: string;
    classification: "screen_3_prerequisite";
  }>;
  currentEventCardSnapshotId: string | null;
  currentTimingId: string | null;
};

export type Screen3StartReceipt = {
  runId: string;
  workflowRevision: number;
  studyRevision: number;
  confirmedShock: ConfirmedShock;
  timingId: string;
  timingFingerprint: string;
  entryContextId: string;
  entryContextFingerprint: string;
  adviceId: string;
  adviceFingerprint: string;
  evidenceStatus: StudyDesignEvidenceStatus;
  /**
   * v26 receipts retain the exact normalized local-only input needed to
   * reconstruct deterministic guidance after a post-commit projection or
   * artifact failure. Older receipts omit these fields and remain readable,
   * but cannot authorize a reconstruction from guessed defaults.
   */
  clarifications?: StudyDesignClarifications;
  clarificationFingerprint?: string;
  openedAt: string;
};

export type Screen3GuidanceRebuildReceipt = {
  runId: string;
  workflowRevision: number;
  sourceWorkflowRevision: number;
  studyRevision: number;
  entryContextId: string;
  entryContextFingerprint: string;
  adviceId: string;
  adviceFingerprint: string;
  rebuiltAt: string;
};

export const SCREEN3_HANDOFF_DEPENDENCY_SCHEMA_VERSION =
  "screen-03-handoff-dependencies-v2" as const;

/**
 * Scientific inputs that can change deterministic Screen 3 guidance even
 * when the visible study/timing payload is unchanged. Operational revision,
 * active view, task heartbeat, receipt ids, and updated-at values are not
 * dependencies and therefore do not prevent one guarded rebase.
 */
export type Screen3HandoffDependencyManifest = {
  schemaVersion: typeof SCREEN3_HANDOFF_DEPENDENCY_SCHEMA_VERSION;
  identityFingerprint: string | null;
  identityRevision: number;
  currentRequestFingerprint: string;
  policyReviewFingerprint: string | null;
  policyEventCardReviewFingerprint: string | null;
  currentEntryContextId: string | null;
  currentEntryContextFingerprint: string | null;
  currentEntryContextContentFingerprint: string | null;
  currentAdviceId: string | null;
  currentAdviceFingerprint: string | null;
  currentAdviceContentFingerprint: string | null;
  currentClarificationFingerprint: string | null;
  currentClarificationContentFingerprint: string | null;
  currentStudyDesignSelectionFingerprint: string | null;
  rejectedClaimIds: string[];
  dependencyFingerprint: string;
};

export type Screen4PrerequisiteCode =
  | "confirmed_policy"
  | "current_event_card"
  | "current_causal_design_decision"
  | "population"
  | "geography"
  | "outcome"
  | "study_period";

export type Screen4PrerequisiteReport = {
  ready: boolean;
  blockers: Array<{
    code: Screen4PrerequisiteCode;
    message: string;
    classification: "screen_4_prerequisite";
  }>;
  mode: "targeted" | "contextual" | null;
  modeLabel: string | null;
  handoffKind: "study_first_v2" | "legacy_event_card" | null;
  legacyExecutionAvailable: boolean;
  currentEventCardSnapshotId: string | null;
  currentDesignSetSnapshotId: string | null;
  currentDesignDecisionSnapshotId: string | null;
  currentStudyEntryContextId: string | null;
  currentStudyAdviceId: string | null;
  currentStudySelectionId: string | null;
};

export type Screen4StartReceipt = {
  runId: string;
  workflowRevision: number;
  studyRevision: number;
  mode: "targeted" | "contextual";
  modeLabel: string;
  handoffKind: "study_first_v2" | "legacy_event_card";
  eventCardReference: ReturnType<typeof createPolicyEventCardReference> | null;
  designSetSnapshotId: string | null;
  designDecisionSnapshotId: string | null;
  studyEntryContextId: string | null;
  studyAdviceId: string | null;
  studySelectionId: string | null;
  studyFirstInvestigationSnapshotId: string | null;
  openedAt: string;
};

export type Screen5PrerequisiteCode =
  | "confirmed_policy"
  | "current_event_card"
  | "outcome"
  | "intended_construct";

export type Screen5PrerequisiteReport = {
  ready: boolean;
  blockers: Array<{
    code: Screen5PrerequisiteCode;
    message: string;
    classification: "screen_5_prerequisite";
  }>;
  limitations: Array<{
    code:
      | "design_review_not_assessed"
      | "coevent_review_not_assessed"
      | "coevent_relations_not_assessed";
    message: string;
  }>;
  handoffKind: "study_first_v2" | "legacy_event_card" | null;
  legacyExecutionAvailable: boolean;
  currentEventCardSnapshotId: string | null;
  currentDesignDecisionSnapshotId: string | null;
  currentCoEventSnapshotId: string | null;
  currentStudyEntryContextId: string | null;
  currentStudyAdviceId: string | null;
  currentStudySelectionId: string | null;
};

export type Screen5StartReceipt = {
  runId: string;
  workflowRevision: number;
  studyRevision: number;
  handoffKind: "study_first_v2" | "legacy_event_card";
  eventCardReference: ReturnType<typeof createPolicyEventCardReference> | null;
  designDecisionSnapshotId: string | null;
  coEventSnapshotId: string | null;
  studyEntryContextId: string | null;
  studyAdviceId: string | null;
  studySelectionId: string | null;
  studyFirstEventHandoffId: string | null;
  limitations: Screen5PrerequisiteReport["limitations"];
  openedAt: string;
};

export type Screen6PrerequisiteCode = "confirmed_policy";

export type Screen6PrerequisiteReport = {
  ready: boolean;
  blockers: Array<{
    code: Screen6PrerequisiteCode;
    message: string;
    classification: "screen_6_prerequisite";
  }>;
  limitations: Screen6UncertaintyProfile["gaps"];
  currentEventCardSnapshotId: string | null;
  currentDesignDecisionSnapshotId: string | null;
  currentCoEventSnapshotId: string | null;
  currentMechanismInputSnapshotId: string | null;
  currentStudyEntryContextId: string | null;
  currentStudyAdviceId: string | null;
  currentStudySelectionId: string | null;
};

export type Screen6StartReceipt = {
  runId: string;
  workflowRevision: number;
  studyRevision: number;
  identityRevision: number;
  identityFingerprint: string;
  limitations: Screen6PrerequisiteReport["limitations"];
  currentEventCardSnapshotId: string | null;
  currentDesignDecisionSnapshotId: string | null;
  currentCoEventSnapshotId: string | null;
  currentMechanismInputSnapshotId: string | null;
  openedAt: string;
};

function requireShockInput(value: string, label: string) {
  if (!value.trim()) throw new Error(`${label} is required.`);
  if (value.length > 4_000) throw new Error(`${label} exceeds 4,000 characters.`);
  return value;
}

function requireStudyDraft(draft: StudyContextDraft) {
  const normalized = normalizeScreen3StudyDraft(draft) as StudyContextDraft;
  if (
    normalized.period.start && normalized.period.end &&
    normalized.period.start > normalized.period.end
  ) {
    throw new Error("Study period start cannot follow its end.");
  }
  return normalized;
}

function appendChange(
  state: SixScreenWorkflowState,
  at: string,
  summary: string,
) {
  state.revision += 1;
  state.updatedAt = at;
  state.changeLog.push({ revision: state.revision, at, summary });
}

function requireRevision(state: SixScreenWorkflowState, expectedRevision: number) {
  if (state.revision !== expectedRevision) {
    throw new Error(
      `Stale six-screen workflow revision: expected ${state.revision}, received ${expectedRevision}.`,
    );
  }
}

function invalidateArtifacts(
  state: SixScreenWorkflowState,
  affectedScreens: readonly number[],
  reason: string,
  at: string,
  status: "out_of_date" | "archived" = "out_of_date",
) {
  const affected = new Set(affectedScreens);
  state.artifacts = state.artifacts.map((artifact) =>
    affected.has(artifact.screen) && artifact.status === "current"
      ? {
          ...artifact,
          status,
          invalidatedAt: at,
          invalidationReason: reason,
        }
      : artifact
  );
  if (affected.has(2) && state.policyReview?.artifactStatus === "current") {
    state.policyReview = {
      ...state.policyReview,
      artifactStatus: status,
      invalidatedAt: at,
      invalidationReason: reason,
    };
  }
}

export function createSixScreenWorkflow(input: {
  runId: string;
  studyId: string;
  study: StudyContextDraft;
  shockInput: string;
  officialSourceLocators?: string[];
  officialIdentifier?: string | null;
  requestedJurisdiction?: string | null;
  approximateYear?: string | null;
  intendedEpisode?: string | null;
  createdAt: string;
}): SixScreenWorkflowState {
  requireBoundedIdentifier(input.runId, "Six-screen run id");
  requireBoundedIdentifier(input.studyId, "Study id");
  requireCanonicalInstant(input.createdAt, "Workflow createdAt");
  const study = requireStudyDraft(input.study);
  requireShockInput(input.shockInput, "Policy/shock input");
  if ((input.officialIdentifier?.trim().length ?? 0) > 300) {
    throw new Error("Official identifier exceeds 300 characters.");
  }
  const officialSourceLocators = [...new Set(input.officialSourceLocators ?? [])]
    .map(requireSanitizedSourceUrl);
  const originalRequestFingerprint = fingerprintSixScreenValue(input.shockInput);
  return {
    schemaVersion: SIX_SCREEN_WORKFLOW_SCHEMA_VERSION,
    runId: input.runId,
    revision: 0,
    activeScreen: 1,
    study: {
      id: input.studyId,
      revision: 0,
      ...structuredClone(study),
      outcomeMeasure: study.outcomeMeasure ?? null,
      policySideConcept: study.policySideConcept ?? null,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    },
    originalShockInput: input.shockInput,
    currentShockInput: input.shockInput,
    shockInputHistory: [{
      value: input.shockInput,
      revision: 0,
      changedAt: input.createdAt,
    }],
    originalRequestFingerprint,
    currentRequestFingerprint: originalRequestFingerprint,
    officialSourceLocators,
    officialIdentifier: input.officialIdentifier?.trim() || null,
    requestedJurisdiction: input.requestedJurisdiction ?? null,
    approximateYear: input.approximateYear ?? null,
    intendedEpisode: input.intendedEpisode ?? null,
    identityRevision: 0,
    pendingIdentityRequest: null,
    lastIdentityResolution: null,
    candidates: [],
    displayedCandidateId: null,
    candidateDecisions: [],
    confirmedShock: null,
    policyReview: null,
    policyEventCardReviews: [],
    causalDesignSets: [],
    causalDesignDecisions: [],
    proposedTreatmentTimings: [],
    screen3StudyEntryContexts: [],
    studyDesignAdvices: [],
    studyDesignSelections: [],
    coEventSearchMatrices: [],
    coEventExecutionPlans: [],
    coEventSearchExecutions: [],
    coEventCandidates: [],
    coEventDiscoveryLeads: [],
    coEventOccurrenceReviews: [],
    coEventDuplicateReviews: [],
    coEventRelationReviews: [],
    coEventPolicyLifecycleHandoffs: [],
    policyLifecycleStageDocumentAcquisitions: [],
    policyLifecycleStageDispositions: [],
    policyLifecycleStageRevisionProposals: [],
    policyLifecycleStageRevisionReviews: [],
    mechanismLiteraturePlans: [],
    studyFirstMechanismInputs: [],
    studyFirstMechanismRuns: [],
    mechanismLiteratureExecutionPlans: [],
    mechanismLiteratureExecutions: [],
    scholarlyMetadataRecords: [],
    scholarlyEvidencePackets: [],
    scholarlyDocumentAcquisitions: [],
    scholarlyPassagePackets: [],
    scholarlyClaimExtractions: [],
    scholarlyClaimReviews: [],
    scholarlyClaimPackets: [],
    mechanismSynthesisInputPackets: [],
    mechanismReviews: [],
    predictionMatrices: [],
    screen6UncertaintyProfiles: [],
    screen6DiagnosticPlans: [],
    screen6DiagnosticResults: [],
    screen6DiagnosticResultReviews: [],
    screen6ConditionalClaimBoundaries: [],
    screen6ResearchPlanningDispositions: [],
    screen6ResearchExports: [],
    artifacts: [],
    changeLog: [],
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
}

export function updateStudyContext(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    study: StudyContextDraft;
    updatedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.updatedAt, "Study updatedAt");
  const validatedStudy = requireStudyDraft(input.study);
  // Keep the historical wording for old records and explicit researcher
  // promotion; new edits use only policySideConcept as the shock construct.
  const study = {
    ...validatedStudy,
    intendedConstruct: state.study.intendedConstruct,
  };
  const changed = (key: keyof StudyContextDraft) => {
    const currentValue = key === "outcomeMeasure" || key === "policySideConcept"
      ? state.study[key] ?? null
      : state.study[key];
    const nextValue = key === "outcomeMeasure" || key === "policySideConcept"
      ? study[key] ?? null
      : study[key];
    return !sameSixScreenValue(currentValue, nextValue);
  };
  const affected = new Set<number>();
  if (changed("period") || changed("population") || changed("geography") || changed("industry")) {
    for (const screen of [3, 4, 5, 6]) affected.add(screen);
  }
  if (
    changed("analysisUnit") || changed("outcome") ||
    changed("outcomeMeasure") ||
    changed("policySideConcept") || changed("initialExplanation") ||
    changed("proposedTreatment") || changed("proposedComparison")
  ) {
    for (const screen of [3, 4, 5, 6]) affected.add(screen);
  }
  if (changed("resultsPreviouslyInspected")) {
    affected.add(5);
    affected.add(6);
  }
  const {
    id: _studyId,
    revision: _studyRevision,
    createdAt: _studyCreatedAt,
    updatedAt: _studyUpdatedAt,
    ...currentStudy
  } = state.study;
  if (sameSixScreenValue(
    {
      ...currentStudy,
      outcomeMeasure: currentStudy.outcomeMeasure ?? null,
      policySideConcept: currentStudy.policySideConcept ?? null,
    },
    {
      ...study,
      outcomeMeasure: study.outcomeMeasure ?? null,
      policySideConcept: study.policySideConcept ?? null,
    },
  )) return state;
  state.study = {
    ...state.study,
    ...structuredClone(study),
    outcomeMeasure: study.outcomeMeasure ?? null,
    policySideConcept: study.policySideConcept ?? null,
    revision: state.study.revision + 1,
    updatedAt: input.updatedAt,
  };
  if (changed("period") && state.policyReview?.artifactStatus === "current" &&
      state.confirmedShock) {
    state.policyReview = {
      ...state.policyReview,
      briefing: createPolicyBriefing({
        title: state.confirmedShock.officialTitle,
        claims: state.policyReview.claims,
        requirements: state.policyReview.requirements,
        generatedAt: input.updatedAt,
        studyPeriod: state.study.period,
        interpretation: state.policyReview.interpretation,
      }),
    };
  }
  invalidateArtifacts(
    state,
    [...affected],
    "The researcher changed a study field used by this result.",
    input.updatedAt,
  );
  appendChange(state, input.updatedAt, "Study context revised; dependent results were marked out of date.");
  return state;
}

export function updateShockRequest(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    shockInput: string;
    officialIdentifier?: string | null;
    requestedJurisdiction?: string | null;
    approximateYear?: string | null;
    intendedEpisode?: string | null;
    updatedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.updatedAt, "Shock request updatedAt");
  requireShockInput(input.shockInput, "Policy/shock input");
  if ((input.officialIdentifier?.trim().length ?? 0) > 300) {
    throw new Error("Official identifier exceeds 300 characters.");
  }
  const nextOfficialIdentifier = input.officialIdentifier?.trim() || null;
  const nextRequestedJurisdiction = input.requestedJurisdiction ?? null;
  const nextApproximateYear = input.approximateYear ?? null;
  const nextIntendedEpisode = input.intendedEpisode ?? null;
  const identityAnchorChanged =
    state.currentShockInput.trim().toLocaleLowerCase("en-US") !==
      input.shockInput.trim().toLocaleLowerCase("en-US") ||
    (state.officialIdentifier ?? null) !== nextOfficialIdentifier ||
    state.requestedJurisdiction !== nextRequestedJurisdiction ||
    state.approximateYear !== nextApproximateYear ||
    state.intendedEpisode !== nextIntendedEpisode;
  const requestChanged = state.currentShockInput !== input.shockInput ||
    (state.officialIdentifier ?? null) !== nextOfficialIdentifier ||
    state.requestedJurisdiction !== nextRequestedJurisdiction ||
    state.approximateYear !== nextApproximateYear ||
    state.intendedEpisode !== nextIntendedEpisode;
  if (!requestChanged) return state;
  state.currentShockInput = input.shockInput;
  state.currentRequestFingerprint = fingerprintSixScreenValue(input.shockInput);
  state.officialIdentifier = nextOfficialIdentifier;
  if (identityAnchorChanged) {
    // These locators constrain the active identity request. Retained evidence
    // remains bound to archived policy tasks and artifacts for compatible reuse.
    state.officialSourceLocators = [];
  }
  state.requestedJurisdiction = nextRequestedJurisdiction;
  state.approximateYear = nextApproximateYear;
  state.intendedEpisode = nextIntendedEpisode;
  state.identityRevision += 1;
  state.pendingIdentityRequest = null;
  state.lastIdentityResolution = null;
  state.candidates = [];
  state.displayedCandidateId = null;
  state.confirmedShock = null;
  state.policyReview = null;
  state.activeScreen = 1;
  state.shockInputHistory.push({
    value: input.shockInput,
    revision: state.identityRevision,
    changedAt: input.updatedAt,
  });
  invalidateArtifacts(
    state,
    [2, 3, 4, 5, 6],
    "The intended policy episode changed and requires a new confirmation.",
    input.updatedAt,
    "archived",
  );
  appendChange(state, input.updatedAt, "Policy request revised; prior confirmation and downstream results were archived.");
  return state;
}

export function addOfficialIdentitySource(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    sourceUrl: string;
    interactionId: string;
    addedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireBoundedIdentifier(input.interactionId, "Identity source interaction id");
  requireCanonicalInstant(input.addedAt, "Identity source addedAt");
  const sourceUrl = requireSanitizedSourceUrl(input.sourceUrl);
  if (!state.officialSourceLocators.includes(sourceUrl)) {
    state.officialSourceLocators.push(sourceUrl);
  }
  state.identityRevision += 1;
  state.pendingIdentityRequest = null;
  state.lastIdentityResolution = null;
  state.candidates = [];
  state.displayedCandidateId = null;
  if (state.confirmedShock) {
    state.confirmedShock = null;
    state.policyReview = null;
    invalidateArtifacts(
      state,
      [2, 3, 4, 5, 6],
      "Identity evidence changed and requires reconfirmation.",
      input.addedAt,
      "archived",
    );
    state.activeScreen = 1;
  }
  state.candidateDecisions.push({
    id: input.interactionId,
    candidateId: "source-input",
    identityRevision: state.identityRevision,
    action: "source_added",
    actor: "researcher",
    at: input.addedAt,
    note: sourceUrl,
  });
  appendChange(state, input.addedAt, "Official identity source added; identity candidates must be resolved again.");
  return state;
}

export function beginIdentityResolution(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    requestId: string;
    requestedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireBoundedIdentifier(input.requestId, "Identity request id");
  requireCanonicalInstant(input.requestedAt, "Identity request requestedAt");
  if (state.pendingIdentityRequest?.id === input.requestId) {
    return { state, request: state.pendingIdentityRequest };
  }
  if (state.pendingIdentityRequest) {
    throw new Error("Another identity-resolution request is already pending.");
  }
  state.identityRevision += 1;
  state.candidates = [];
  state.displayedCandidateId = null;
  const request: IdentityResolutionRequest = {
    id: input.requestId,
    workflowRevision: state.revision + 1,
    identityRevision: state.identityRevision,
    originalRequestFingerprint: state.originalRequestFingerprint,
    currentRequestFingerprint: state.currentRequestFingerprint,
    requestedAt: input.requestedAt,
  };
  state.pendingIdentityRequest = request;
  state.lastIdentityResolution = null;
  appendChange(state, input.requestedAt, "Identity resolution started with a frozen policy request.");
  return { state, request };
}

export function createIdentityCandidate(input: {
  originalRequest: string;
  candidateRevision: number;
  candidate: IdentityCandidateInput;
}) {
  const fingerprintInput: Omit<ShockIdentity, "identityFingerprint"> = {
    id: input.candidate.id,
    originalRequest: input.originalRequest,
    officialTitle: input.candidate.officialTitle,
    aliases: [...input.candidate.aliases],
    issuer: input.candidate.issuer,
    issuingJurisdiction: input.candidate.issuingJurisdiction,
    instrumentType: input.candidate.instrumentType,
    formalIdentifiers: [...input.candidate.formalIdentifiers],
    episode: input.candidate.episode,
    versionScope: input.candidate.versionScope,
    typedDates: structuredClone(input.candidate.typedDates),
    identitySourceIds: [...input.candidate.identitySourceIds],
  };
  const candidate: IdentityCandidate = {
    ...structuredClone(input.candidate),
    ...fingerprintInput,
    candidateRevision: input.candidateRevision,
    identityFingerprint: shockIdentityFingerprint(fingerprintInput),
  };
  requireShockIdentity(candidate);
  requireBoundedIdentifier(candidate.sourceSnapshotId, "Identity source snapshot id");
  requireFingerprint(
    candidate.sourceSnapshotFingerprint,
    "Identity source snapshot fingerprint",
  );
  if (
    candidate.identitySources.length < 1 ||
    candidate.identitySources.length > 12 ||
    new Set(candidate.identitySources.map(({ id }) => id)).size !==
      candidate.identitySources.length
  ) {
    throw new Error("Identity candidate requires one to twelve unique source references.");
  }
  for (const source of candidate.identitySources) {
    requireBoundedIdentifier(source.id, "Identity source id");
    requireSanitizedSourceUrl(source.locator);
    requireCanonicalInstant(source.retrievedAt, "Identity source retrievedAt");
  }
  if (!sameSixScreenValue(
    [...candidate.identitySourceIds].sort(),
    candidate.identitySources.map(({ id }) => id).sort(),
  )) {
    throw new Error("Identity source ids do not match the retained source snapshot.");
  }
  if (
    candidate.sourceSnapshotFingerprint !==
      fingerprintSixScreenValue(candidate.identitySources)
  ) {
    throw new Error("Identity source snapshot fingerprint is invalid.");
  }
  if (!candidate.displayedDescription.trim() || candidate.displayedDescription.length > 1_500) {
    throw new Error("Identity candidate requires a bounded source-supported description.");
  }
  if (candidate.identitySourceIds.length > 0 && !candidate.sourceSnapshotId) {
    throw new Error("Identity candidate sources require a source snapshot.");
  }
  return candidate;
}

export function applyIdentityResolution(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    request: IdentityResolutionRequest;
    candidates: IdentityCandidateInput[];
    resolution?: Omit<IdentityResolutionSummary, "requestId" | "completedAt">;
    appliedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.appliedAt, "Identity result appliedAt");
  if (!state.pendingIdentityRequest || !sameSixScreenValue(state.pendingIdentityRequest, input.request)) {
    throw new Error("Stale identity result does not match the current request coordinates.");
  }
  if (
    input.request.workflowRevision !== state.revision ||
    input.request.identityRevision !== state.identityRevision ||
    input.request.originalRequestFingerprint !== state.originalRequestFingerprint ||
    input.request.currentRequestFingerprint !== state.currentRequestFingerprint
  ) {
    throw new Error("Identity result was produced for an older workflow or policy request.");
  }
  if (input.candidates.length > 3) {
    throw new Error("Identity resolution may display at most three plausible candidates.");
  }
  const candidates = input.candidates.map((candidate) =>
    createIdentityCandidate({
      originalRequest: state.currentShockInput,
      candidateRevision: state.identityRevision,
      candidate,
    })
  );
  if (new Set(candidates.map(({ id }) => id)).size !== candidates.length) {
    throw new Error("Identity candidates must have unique ids.");
  }
  state.candidates = candidates;
  state.displayedCandidateId = candidates[0]?.id ?? null;
  state.pendingIdentityRequest = null;
  state.lastIdentityResolution = {
    requestId: input.request.id,
    taskId: input.resolution?.taskId ?? null,
    status: input.resolution?.status ??
      (candidates.length ? "resolved" : "not_resolved"),
    attemptedSources: [...(input.resolution?.attemptedSources ?? [])],
    unresolved: [...(input.resolution?.unresolved ?? [])],
    limitation: input.resolution?.limitation ?? null,
    completedAt: input.appliedAt,
  };
  appendChange(
    state,
    input.appliedAt,
    candidates.length
      ? `Identity resolution retained ${candidates.length} plausible interpretation${candidates.length === 1 ? "" : "s"}.`
      : "Identity resolution did not resolve the event under the attempted protocol.",
  );
  return state;
}

export function displayIdentityCandidate(
  current: SixScreenWorkflowState,
  input: { expectedRevision: number; candidateId: string; displayedAt: string },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.displayedAt, "Identity candidate displayedAt");
  const candidate = state.candidates.find(({ id }) => id === input.candidateId);
  if (!candidate || candidate.candidateRevision !== state.identityRevision) {
    throw new Error("Displayed identity candidate is missing or stale.");
  }
  if (state.displayedCandidateId === candidate.id) return state;
  state.displayedCandidateId = candidate.id;
  appendChange(state, input.displayedAt, "Displayed identity interpretation changed; no confirmation was inferred.");
  return state;
}

function recordCandidateDecision(
  state: SixScreenWorkflowState,
  decision: CandidateDecision,
) {
  if (state.candidateDecisions.some(({ id }) => id === decision.id)) {
    throw new Error("Candidate decision id was already used.");
  }
  state.candidateDecisions.push(decision);
}

export function deferDisplayedCandidate(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    candidateId: string;
    action: "different_version" | "rejected";
    interactionId: string;
    note?: string | null;
    decidedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireBoundedIdentifier(input.interactionId, "Candidate decision id");
  requireCanonicalInstant(input.decidedAt, "Candidate decision time");
  if (state.displayedCandidateId !== input.candidateId) {
    throw new Error("Candidate decision does not match the identity currently displayed.");
  }
  const candidate = state.candidates.find(({ id }) => id === input.candidateId);
  if (!candidate || candidate.candidateRevision !== state.identityRevision) {
    throw new Error("Candidate decision targets a missing or stale identity.");
  }
  recordCandidateDecision(state, {
    id: input.interactionId,
    candidateId: input.candidateId,
    identityRevision: state.identityRevision,
    action: input.action,
    actor: "researcher",
    at: input.decidedAt,
    note: input.note?.trim() || null,
  });
  state.candidates = state.candidates.filter(({ id }) => id !== input.candidateId);
  state.displayedCandidateId = state.candidates[0]?.id ?? null;
  appendChange(
    state,
    input.decidedAt,
    input.action === "rejected"
      ? "Displayed identity was rejected; study inputs were preserved."
      : "Displayed identity was marked related; another version or stage is required.",
  );
  return state;
}

export function confirmDisplayedShock(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    candidateId: string;
    displayedIdentityFingerprint: string;
    sourceSnapshotId: string;
    sourceSnapshotFingerprint: string;
    originalRequestFingerprint: string;
    currentRequestFingerprint: string;
    identityRevision: number;
    interactionId: string;
    decisionId: string;
    actor: "researcher_ui" | "model" | "system";
    confirmedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.confirmedAt, "Shock confirmation time");
  requireBoundedIdentifier(input.interactionId, "Shock confirmation interaction id");
  requireBoundedIdentifier(input.decisionId, "Shock confirmation decision id");
  if (input.actor !== "researcher_ui") {
    throw new Error("Only an explicit researcher UI action can confirm a shock.");
  }
  if (state.displayedCandidateId !== input.candidateId) {
    throw new Error("Shock confirmation does not match the identity currently displayed.");
  }
  const candidate = state.candidates.find(({ id }) => id === input.candidateId);
  if (!candidate) throw new Error("Shock confirmation candidate is unavailable.");
  if (
    candidate.candidateRevision !== state.identityRevision ||
    input.identityRevision !== state.identityRevision ||
    input.displayedIdentityFingerprint !== candidate.identityFingerprint ||
    input.sourceSnapshotId !== candidate.sourceSnapshotId ||
    input.sourceSnapshotFingerprint !== candidate.sourceSnapshotFingerprint ||
    input.originalRequestFingerprint !== state.originalRequestFingerprint ||
    input.currentRequestFingerprint !== state.currentRequestFingerprint ||
    candidate.originalRequest !== state.currentShockInput
  ) {
    throw new Error("Shock confirmation coordinates do not match the displayed identity, source snapshot, or request revision.");
  }
  const { candidateRevision: _candidateRevision, sourceSnapshotId: _sourceSnapshotId,
    sourceSnapshotFingerprint: _sourceSnapshotFingerprint,
    identitySources: _identitySources,
    displayedDescription: _displayedDescription, matchExplanation: _matchExplanation,
    materialMismatches: _materialMismatches, retrievedAt: _retrievedAt,
    ...identity } = candidate;
  requireShockIdentity(identity);
  const confirmedShock: ConfirmedShock = {
    ...identity,
    confirmation: {
      decisionId: input.decisionId,
      actor: "researcher",
      interactionId: input.interactionId,
      workflowRevision: state.revision + 1,
      identityRevision: state.identityRevision,
      candidateId: candidate.id,
      sourceSnapshotId: candidate.sourceSnapshotId,
      sourceSnapshotFingerprint: candidate.sourceSnapshotFingerprint,
      displayedIdentityFingerprint: candidate.identityFingerprint,
      originalRequestFingerprint: state.originalRequestFingerprint,
      currentRequestFingerprint: state.currentRequestFingerprint,
      confirmedAt: input.confirmedAt,
    },
  };
  state.confirmedShock = confirmedShock;
  recordCandidateDecision(state, {
    id: input.decisionId,
    candidateId: candidate.id,
    identityRevision: state.identityRevision,
    action: "confirmed",
    actor: "researcher",
    at: input.confirmedAt,
    note: null,
  });
  appendChange(state, input.confirmedAt, `Shock confirmed — ${candidate.episode}.`);
  return state;
}

export function requireCurrentConfirmedShock(state: SixScreenWorkflowState) {
  const confirmed = state.confirmedShock;
  if (!confirmed) throw new Error("Screen 2 requires a researcher-confirmed shock.");
  const candidate = state.candidates.find(
    ({ id }) => id === confirmed.confirmation.candidateId,
  );
  if (!candidate || state.displayedCandidateId !== candidate.id) {
    throw new Error("Confirmed shock no longer matches the displayed identity.");
  }
  if (
    confirmed.confirmation.identityRevision !== state.identityRevision ||
    confirmed.confirmation.displayedIdentityFingerprint !== candidate.identityFingerprint ||
    confirmed.confirmation.sourceSnapshotId !== candidate.sourceSnapshotId ||
    confirmed.confirmation.sourceSnapshotFingerprint !== candidate.sourceSnapshotFingerprint ||
    confirmed.confirmation.originalRequestFingerprint !== state.originalRequestFingerprint ||
    confirmed.confirmation.currentRequestFingerprint !== state.currentRequestFingerprint ||
    confirmed.identityFingerprint !== candidate.identityFingerprint
  ) {
    throw new Error("Confirmed shock receipt is stale or does not match current identity evidence.");
  }
  return confirmed;
}

export function openScreen2(
  current: SixScreenWorkflowState,
  input: { expectedRevision: number; openedAt: string },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.openedAt, "Screen 2 openedAt");
  const confirmedShock = requireCurrentConfirmedShock(state);
  state.activeScreen = 2;
  appendChange(state, input.openedAt, "Screen 2 opened for the exact confirmed shock.");
  const dependencies: Dependencies = {
    studyRevision: state.study.revision,
    identityFingerprint: confirmedShock.identityFingerprint,
    eventCardSnapshotId: null,
    selectedDesignSnapshotId: null,
    coeventSnapshotId: null,
    mechanismSnapshotId: null,
  };
  return {
    state,
    receipt: {
      runId: state.runId,
      workflowRevision: state.revision,
      studyRevision: state.study.revision,
      confirmedShock: structuredClone(confirmedShock),
      dependencies,
      startedAt: input.openedAt,
    } satisfies Screen2StartReceipt,
  };
}

function designCollections(state: SixScreenWorkflowState) {
  const designSets = state.causalDesignSets ?? [];
  const decisions = state.causalDesignDecisions ?? [];
  validateCausalDesignCollections({ designSets, decisions });
  return { designSets, decisions };
}

function coEventCollections(state: SixScreenWorkflowState) {
  const matrices = state.coEventSearchMatrices ?? [];
  const plans = state.coEventExecutionPlans ?? [];
  const executions = state.coEventSearchExecutions ?? [];
  const candidates = state.coEventCandidates ?? [];
  const leads = state.coEventDiscoveryLeads ?? [];
  const occurrenceReviews = state.coEventOccurrenceReviews ?? [];
  const duplicateReviews = state.coEventDuplicateReviews ?? [];
  const relationReviews = state.coEventRelationReviews ?? [];
  const policyLifecycleHandoffs =
    state.coEventPolicyLifecycleHandoffs ?? [];
  const policyLifecycleStageDocumentAcquisitions =
    state.policyLifecycleStageDocumentAcquisitions ?? [];
  const policyLifecycleStageDispositions =
    state.policyLifecycleStageDispositions ?? [];
  const policyLifecycleStageRevisionProposals =
    state.policyLifecycleStageRevisionProposals ?? [];
  const policyLifecycleStageRevisionReviews =
    state.policyLifecycleStageRevisionReviews ?? [];
  const { designSets, decisions } = designCollections(state);
  validateCoEventSearchCollections({ matrices, designSets, decisions });
  validateCoEventExecutionCollections({
    matrices,
    plans,
    executions,
    candidates,
    leads,
  });
  validateCoEventReviewCollections({
    candidates,
    occurrenceReviews,
    duplicateReviews,
  });
  validateCoEventRelationReviewCollection({
    matrices,
    designSets,
    designDecisions: decisions,
    candidates,
    occurrenceReviews,
    relationReviews,
  });
  validateCoEventPolicyLifecycleHandoffCollection({
    candidates,
    occurrenceReviews,
    duplicateReviews,
    executions,
    policyEventCardReviews: state.policyEventCardReviews ?? [],
    handoffs: policyLifecycleHandoffs,
  });
  validatePolicyLifecycleStageReviewCollections({
    candidates,
    handoffs: policyLifecycleHandoffs,
    acquisitions: policyLifecycleStageDocumentAcquisitions,
    dispositions: policyLifecycleStageDispositions,
  });
  validatePolicyLifecycleStageRevisionCollections({
    handoffs: policyLifecycleHandoffs,
    acquisitions: policyLifecycleStageDocumentAcquisitions,
    dispositions: policyLifecycleStageDispositions,
    proposals: policyLifecycleStageRevisionProposals,
    reviews: policyLifecycleStageRevisionReviews,
    eventCardReviews: state.policyEventCardReviews ?? [],
  });
  return {
    matrices,
    plans,
    executions,
    candidates,
    leads,
    occurrenceReviews,
    duplicateReviews,
    relationReviews,
    policyLifecycleHandoffs,
    policyLifecycleStageDocumentAcquisitions,
    policyLifecycleStageDispositions,
    policyLifecycleStageRevisionProposals,
    policyLifecycleStageRevisionReviews,
    designSets,
    decisions,
  };
}

function currentReviewedEventCardRecord(state: SixScreenWorkflowState) {
  const currentArtifactIds = new Set(
    state.artifacts.filter(({ screen, status }) =>
      screen === 2 && status === "current").map(({ snapshotId }) => snapshotId),
  );
  return [...(state.policyEventCardReviews ?? [])].reverse().find((review) =>
    review.lockedEventCard &&
    currentArtifactIds.has(review.lockedEventCard.snapshotId)
  ) ?? null;
}

function policyEventCardDecisionDependency<
  T extends { decidedAt: string | null },
>(decision: T) {
  const { decidedAt: _decidedAt, ...semantic } = decision;
  return semantic;
}

function policyEventCardReviewDependency(
  review: PolicyEventCardReviewState,
) {
  const claim = (
    value: PolicyEventCardReviewState["claimReviews"][number],
  ) => policyEventCardDecisionDependency(value);
  const history = review.changeHistory.map((event) => {
    if (event.kind === "claim_decision") {
      const { at: _at, ...semantic } = event;
      return {
        ...semantic,
        previous: policyEventCardDecisionDependency(event.previous),
        next: policyEventCardDecisionDependency(event.next),
      };
    }
    if (event.kind === "treatment_clock_decision") {
      const { at: _at, ...semantic } = event;
      return {
        ...semantic,
        previous: policyEventCardDecisionDependency(event.previous),
        next: policyEventCardDecisionDependency(event.next),
      };
    }
    const {
      at: _at,
      operationFingerprint: _operationFingerprint,
      eventCardFingerprint: _eventCardFingerprint,
      lifecycleStageRevisionFingerprints: _lifecycleStageRevisionFingerprints,
      ...lockSemantic
    } = event;
    return lockSemantic;
  });
  const lockedEventCard = review.lockedEventCard
    ? (() => {
        const {
          reviewedAt: _reviewedAt,
          decisionHistoryFingerprint: _decisionHistoryFingerprint,
          eventCardFingerprint: _eventCardFingerprint,
          lifecycleStageRevisions,
          ...semantic
        } = review.lockedEventCard;
        return {
          ...semantic,
          claims: review.lockedEventCard.claims.map(claim),
          treatmentClock: policyEventCardDecisionDependency(
            review.lockedEventCard.treatmentClock,
          ),
          ...(lifecycleStageRevisions
            ? {
                lifecycleStageRevisions: lifecycleStageRevisions.map(
                  (contribution) => {
                    const {
                      includedAt: _includedAt,
                      contributionFingerprint: _contributionFingerprint,
                      proposalReference,
                      reviewReference,
                      ...contributionSemantic
                    } = contribution;
                    return {
                      ...contributionSemantic,
                      proposalReference: {
                        proposalId: proposalReference.proposalId,
                      },
                      reviewReference: {
                        reviewId: reviewReference.reviewId,
                        decision: reviewReference.decision,
                      },
                    };
                  },
                ),
              }
            : {}),
        };
      })()
    : null;
  const {
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    reviewFingerprint: _reviewFingerprint,
    supersedes,
    ...semantic
  } = review;
  return {
    ...semantic,
    supersedes: supersedes
      ? {
          reviewId: supersedes.reviewId,
          eventCardSnapshotId: supersedes.eventCardSnapshotId,
          reason: supersedes.reason,
        }
      : null,
    claimReviews: review.claimReviews.map(claim),
    treatmentClockDecision: policyEventCardDecisionDependency(
      review.treatmentClockDecision,
    ),
    changeHistory: history,
    lockedEventCard,
  };
}

function studyDesignSelectionDependency(
  selection: StudyDesignSelection | null,
) {
  if (!selection) return null;
  const {
    id: _id,
    selectedAt: _selectedAt,
    selectionFingerprint: _selectionFingerprint,
    ...semantic
  } = selection;
  return semantic;
}

export function screen3HandoffDependencyManifest(
  state: SixScreenWorkflowState,
): Screen3HandoffDependencyManifest {
  const currentPolicyReview = state.policyReview?.artifactStatus === "current"
    ? state.policyReview
    : null;
  const currentEventCardReview = currentReviewedEventCardRecord(state);
  const currentEntryContext = currentScreen3StudyEntryContext(state);
  const currentAdvice = currentStudyDesignAdvice(state);
  const currentSelection = currentStudyDesignSelection(state);
  const currentEntryContextContent = currentEntryContext
    ? (() => {
        const {
          createdAt: _createdAt,
          ...content
        } = currentEntryContext;
        return content;
      })()
    : null;
  const currentAdviceContent = currentAdvice
    ? (() => {
        const {
          createdAt: _createdAt,
          ...content
        } = currentAdvice;
        return content;
      })()
    : null;
  const rejectedClaimIds = [...new Set(
    (state.policyEventCardReviews ?? []).flatMap(({ claimReviews }) =>
      claimReviews.filter(({ decision }) => decision === "rejected")
        .map(({ claimId }) => claimId)),
  )].sort();
  const body = {
    schemaVersion: SCREEN3_HANDOFF_DEPENDENCY_SCHEMA_VERSION,
    identityFingerprint:
      state.confirmedShock?.identityFingerprint ?? null,
    identityRevision: state.identityRevision,
    currentRequestFingerprint: state.currentRequestFingerprint,
    // The handoff guidance reads admitted evidence, its qualifications, and
    // the render-ready chronology.  It does not read retrieval bookkeeping
    // such as attempts, byte counts, task progress, or last-attempt times.
    // Keeping those operational fields out permits one guarded rebase after
    // an unrelated heartbeat while still fencing every evidence change that
    // can alter the deterministic Screen 3 result.
    policyReviewFingerprint: currentPolicyReview
      ? fingerprintSixScreenValue({
          protocolVersion: currentPolicyReview.protocolVersion,
          status: currentPolicyReview.status,
          failureCode: currentPolicyReview.failureCode,
          documentNumber: currentPolicyReview.documentNumber,
          identityFingerprint: currentPolicyReview.identityFingerprint,
          evidenceSnapshotId: currentPolicyReview.evidenceSnapshotId,
          evidenceSnapshotFingerprint:
            currentPolicyReview.evidenceSnapshotFingerprint,
          artifactStatus: currentPolicyReview.artifactStatus,
          claims: currentPolicyReview.claims,
          briefingQuality: currentPolicyReview.briefingQuality,
          synthesis: currentPolicyReview.synthesis,
          briefing: currentPolicyReview.briefing
            ? (() => {
                const {
                  generatedAt: _generatedAt,
                  ...semantic
                } = currentPolicyReview.briefing;
                return semantic;
              })()
            : null,
          requirements: currentPolicyReview.requirements,
          unresolved: currentPolicyReview.unresolved,
          limitation: currentPolicyReview.limitation,
        })
      : null,
    policyEventCardReviewFingerprint: currentEventCardReview
      ? fingerprintSixScreenValue(
          policyEventCardReviewDependency(currentEventCardReview),
        )
      : null,
    currentEntryContextId: currentEntryContext?.id ?? null,
    currentEntryContextFingerprint:
      currentEntryContext?.entryFingerprint ?? null,
    currentEntryContextContentFingerprint: currentEntryContextContent
      ? fingerprintSixScreenValue(currentEntryContextContent)
      : null,
    currentAdviceId: currentAdvice?.adviceId ?? null,
    currentAdviceFingerprint: currentAdvice?.adviceFingerprint ?? null,
    currentAdviceContentFingerprint: currentAdviceContent
      ? fingerprintSixScreenValue(currentAdviceContent)
      : null,
    currentClarificationFingerprint:
      currentEntryContext?.clarificationFingerprint ?? null,
    currentClarificationContentFingerprint: currentAdvice
      ? fingerprintSixScreenValue(currentAdvice.clarifications)
      : null,
    currentStudyDesignSelectionFingerprint: currentSelection
      ? fingerprintSixScreenValue(
          studyDesignSelectionDependency(currentSelection),
        )
      : null,
    rejectedClaimIds,
  };
  return {
    ...body,
    dependencyFingerprint: fingerprintSixScreenValue(body),
  };
}

function requireLegacyCausalComparisonPrerequisites(
  state: SixScreenWorkflowState,
) {
  const confirmed = requireCurrentConfirmedShock(state);
  const review = currentReviewedEventCardRecord(state);
  const eventCard = review?.lockedEventCard ?? null;
  if (
    !review || !eventCard ||
    eventCard.binding.identityFingerprint !== confirmed.identityFingerprint
  ) {
    throw new Error(
      "The legacy claim-selected comparison builder requires its retained reviewed Event Card. The study-first advice route does not.",
    );
  }
  return { confirmed, review, eventCard };
}

function legacyProposedTreatmentTimingInput(
  state: SixScreenWorkflowState,
): ProposedTreatmentTimingInput | null {
  const clock = currentReviewedEventCardRecord(state)?.lockedEventCard
    ?.treatmentClock;
  if (!clock) return null;
  if (clock.mode === "no_selection") {
    return { mode: "undecided", year: null, milestoneReference: null };
  }
  if (clock.candidate.timing.mode !== "absolute") {
    return { mode: "undecided", year: null, milestoneReference: null };
  }
  const year = Number(/^(\d{4})/u.exec(clock.candidate.timing.start)?.[1]);
  if (!Number.isInteger(year)) return null;
  return {
    mode: "year",
    year,
    milestoneReference: null,
  };
}

export function screen3PrerequisiteReport(
  state: SixScreenWorkflowState,
): Screen3PrerequisiteReport {
  const blockers: Screen3PrerequisiteReport["blockers"] = [];
  let confirmed: ConfirmedShock | null = null;
  try {
    confirmed = requireCurrentConfirmedShock(state);
  } catch {
    blockers.push({
      code: "confirmed_policy",
      message: "Return to Screen 1 and confirm the current policy identity.",
      classification: "screen_3_prerequisite",
    });
  }
  const timing = currentProposedTreatmentTiming(state);
  const validation = validateScreen3EntryDraft({
    study: state.study,
    timing: timing ?? legacyProposedTreatmentTimingInput(state),
  });
  blockers.push(...validation.issues.map(({ code, message, classification }) => ({
    code,
    message,
    classification,
  })));
  return {
    ready: blockers.length === 0,
    blockers,
    currentEventCardSnapshotId:
      currentReviewedEventCardRecord(state)?.lockedEventCard?.snapshotId ?? null,
    currentTimingId: timing?.id ?? null,
  };
}

function requireScreen3Prerequisites(state: SixScreenWorkflowState) {
  const report = screen3PrerequisiteReport(state);
  if (!report.ready) {
    throw new Error(
      `Screen 3 prerequisites are incomplete: ${report.blockers.map(
        ({ code }) => code.replaceAll("_", " "),
      ).join(", ")}.`,
    );
  }
  return {
    confirmed: requireCurrentConfirmedShock(state),
    timing: currentProposedTreatmentTiming(state)!,
  };
}

export function openScreen3(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    study?: StudyContextDraft;
    proposedTiming?: ProposedTreatmentTimingInput;
    clarifications?: Partial<StudyDesignClarifications> | null;
    openedAt: string;
  },
) {
  requireRevision(current, input.expectedRevision);
  requireCanonicalInstant(input.openedAt, "Screen 3 openedAt");
  const currentStudyDraft: StudyContextDraft = {
    population: current.study.population,
    analysisUnit: current.study.analysisUnit,
    geography: [...current.study.geography],
    industry: [...current.study.industry],
    period: structuredClone(current.study.period),
    outcome: current.study.outcome,
    outcomeMeasure: current.study.outcomeMeasure ?? null,
    intendedConstruct: current.study.intendedConstruct,
    policySideConcept: current.study.policySideConcept ?? null,
    initialExplanation: current.study.initialExplanation,
    proposedTreatment: current.study.proposedTreatment,
    proposedComparison: current.study.proposedComparison,
    resultsPreviouslyInspected: current.study.resultsPreviouslyInspected,
  };
  const validation = validateScreen3EntryDraft({
    study: input.study ?? currentStudyDraft,
    timing: input.proposedTiming ?? legacyProposedTreatmentTimingInput(current),
  });
  if (!validation.ready || !validation.proposedTiming) {
    throw new Error(
      `Screen 3 prerequisites are incomplete: ${validation.issues.map(
        ({ code }) => code.replaceAll("_", " "),
      ).join(", ")}.`,
    );
  }
  const proposedTiming = validation.proposedTiming;
  validateProposedTreatmentTimingInput(proposedTiming);
  let state = updateStudyContext(current, {
    expectedRevision: input.expectedRevision,
    study: validation.study as StudyContextDraft,
    updatedAt: input.openedAt,
  });
  const confirmed = requireCurrentConfirmedShock(state);
  const existingTiming = currentProposedTreatmentTiming(state);
  let timing = existingTiming;
  if (!timing || !sameProposedTreatmentTiming(timing, proposedTiming)) {
    const priorIdentityTimings = (state.proposedTreatmentTimings ?? []).filter(
      ({ identityFingerprint }) =>
        identityFingerprint === confirmed.identityFingerprint,
    );
    timing = createProposedTreatmentTiming({
      value: proposedTiming,
      identityFingerprint: confirmed.identityFingerprint,
      revision: (priorIdentityTimings.at(-1)?.revision ?? 0) + 1,
      origin: input.proposedTiming
        ? "researcher_reported"
        : "legacy_explicit_decision",
      createdAt: input.openedAt,
    });
    state.proposedTreatmentTimings = [
      ...(state.proposedTreatmentTimings ?? []),
      timing,
    ].slice(-SIX_SCREEN_STUDY_DESIGN_MAX_RECORDS);
  }
  const report = screen3PrerequisiteReport(state);
  if (!report.ready) {
    throw new Error(
      `Screen 3 prerequisites are incomplete: ${report.blockers.map(
        ({ code }) => code.replaceAll("_", " "),
      ).join(", ")}.`,
    );
  }
  const clarifications = normalizeStudyDesignClarifications(
    input.clarifications ?? EMPTY_STUDY_DESIGN_CLARIFICATIONS,
  );
  const rejectedClaimIds = new Set(
    (state.policyEventCardReviews ?? []).flatMap(({ claimReviews }) =>
      claimReviews.filter(({ decision }) => decision === "rejected")
        .map(({ claimId }) => claimId)),
  );
  const entryContext = createScreen3StudyEntryContext({
    identityFingerprint: confirmed.identityFingerprint,
    study: state.study,
    timing,
    policyReview: state.policyReview?.artifactStatus === "current"
      ? state.policyReview
      : null,
    excludedLegacyRejectedClaimIds: [...rejectedClaimIds],
    clarifications,
    createdAt: input.openedAt,
  });
  const advice = createStudyDesignAdvice({
    study: state.study,
    timing,
    entryContext,
    policyReview: state.policyReview?.artifactStatus === "current"
      ? state.policyReview : null,
    clarifications,
    createdAt: input.openedAt,
  });
  const existingEntry = (state.screen3StudyEntryContexts ?? []).find(
    ({ entryFingerprint }) => entryFingerprint === entryContext.entryFingerprint,
  );
  const existingAdvice = (state.studyDesignAdvices ?? []).find(
    ({ adviceFingerprint }) => adviceFingerprint === advice.adviceFingerprint,
  );
  if (!existingEntry) {
    state.screen3StudyEntryContexts = [
      ...(state.screen3StudyEntryContexts ?? []),
      entryContext,
    ].slice(-SIX_SCREEN_STUDY_DESIGN_MAX_RECORDS);
  }
  if (!existingAdvice) {
    state.studyDesignAdvices = [
      ...(state.studyDesignAdvices ?? []),
      advice,
    ].slice(-SIX_SCREEN_STUDY_DESIGN_MAX_RECORDS);
  }
  const canonicalEntry = existingEntry ?? entryContext;
  const canonicalAdvice = existingAdvice ?? advice;
  const changed = !sameSixScreenValue(state, current);
  state.activeScreen = 3;
  if (changed || current.activeScreen !== 3) {
    appendChange(
      state,
      input.openedAt,
      "Screen 3 opened from the saved study, researcher-proposed timing, and available source status; no policy claim was accepted.",
    );
  }
  return {
    state,
    receipt: {
      runId: state.runId,
      workflowRevision: state.revision,
      studyRevision: state.study.revision,
      confirmedShock: structuredClone(confirmed),
      timingId: timing.id,
      timingFingerprint: timing.timingFingerprint,
      entryContextId: canonicalEntry.id,
      entryContextFingerprint: canonicalEntry.entryFingerprint,
      adviceId: canonicalAdvice.adviceId,
      adviceFingerprint: canonicalAdvice.adviceFingerprint,
      evidenceStatus: canonicalEntry.evidence.status,
      clarifications: structuredClone(clarifications),
      clarificationFingerprint: canonicalEntry.clarificationFingerprint,
      openedAt: input.openedAt,
    } satisfies Screen3StartReceipt,
  };
}

/**
 * Reconstruct only the deterministic Screen 3 guidance named by a previously
 * committed handoff receipt. This function cannot choose a method, accept a
 * policy claim, search a source, or invoke a model. Every scientific binding
 * must still match, and the rebuilt content must reproduce the receipt's
 * original advice identity exactly.
 */
export function rebuildScreen3Guidance(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    sourceReceipt: Screen3StartReceipt;
    rebuiltAt: string;
  },
) {
  requireRevision(current, input.expectedRevision);
  requireCanonicalInstant(input.rebuiltAt, "Screen 3 guidance rebuiltAt");
  const source = input.sourceReceipt;
  const clarifications = source.clarifications
    ? normalizeStudyDesignClarifications(source.clarifications)
    : null;
  if (!clarifications || !source.clarificationFingerprint ||
      fingerprintSixScreenValue(clarifications) !==
        source.clarificationFingerprint) {
    throw new Error(
      "The saved Screen 3 receipt does not retain a validated local rebuild input.",
    );
  }
  const confirmed = requireCurrentConfirmedShock(current);
  const timing = currentProposedTreatmentTiming(current);
  const currentEntry = currentScreen3StudyEntryContext(current);
  const entry = (current.screen3StudyEntryContexts ?? []).find((candidate) =>
    candidate.id === source.entryContextId &&
    candidate.entryFingerprint === source.entryContextFingerprint
  );
  if (
    source.runId !== current.runId ||
    source.confirmedShock.identityFingerprint !==
      confirmed.identityFingerprint ||
    source.studyRevision !== current.study.revision ||
    !timing || timing.id !== source.timingId ||
    timing.timingFingerprint !== source.timingFingerprint ||
    !entry || entry.identityFingerprint !== confirmed.identityFingerprint ||
    entry.studyRevision !== current.study.revision ||
    entry.timingId !== timing.id ||
    entry.timingFingerprint !== timing.timingFingerprint ||
    entry.clarificationFingerprint !== source.clarificationFingerprint ||
    entry.evidence.status !== source.evidenceStatus ||
    !currentEntry || currentEntry.id !== entry.id ||
    currentEntry.entryFingerprint !== entry.entryFingerprint ||
    currentEntry.clarificationFingerprint !==
      source.clarificationFingerprint
  ) {
    throw new Error(
      "The saved Screen 3 receipt is not compatible with the current scientific inputs.",
    );
  }
  const advice = createStudyDesignAdvice({
    study: current.study,
    timing,
    entryContext: entry,
    policyReview: current.policyReview?.artifactStatus === "current"
      ? current.policyReview : null,
    clarifications,
    createdAt: input.rebuiltAt,
  });
  if (
    advice.adviceId !== source.adviceId ||
    advice.adviceFingerprint !== source.adviceFingerprint
  ) {
    throw new Error(
      "The current evidence cannot reproduce the saved Screen 3 guidance identity.",
    );
  }
  const state = structuredClone(current);
  const existing = (state.studyDesignAdvices ?? []).find((candidate) =>
    candidate.adviceId === advice.adviceId &&
    candidate.adviceFingerprint === advice.adviceFingerprint
  );
  if (!existing) {
    state.studyDesignAdvices = [
      ...(state.studyDesignAdvices ?? []),
      advice,
    ].slice(-SIX_SCREEN_STUDY_DESIGN_MAX_RECORDS);
    appendChange(
      state,
      input.rebuiltAt,
      "Deterministic Screen 3 comparison guidance was restored from a validated saved handoff; no source or model work ran.",
    );
  }
  return {
    state,
    receipt: {
      runId: state.runId,
      workflowRevision: state.revision,
      sourceWorkflowRevision: source.workflowRevision,
      studyRevision: source.studyRevision,
      entryContextId: source.entryContextId,
      entryContextFingerprint: source.entryContextFingerprint,
      adviceId: source.adviceId,
      adviceFingerprint: source.adviceFingerprint,
      rebuiltAt: input.rebuiltAt,
    } satisfies Screen3GuidanceRebuildReceipt,
  };
}

export function refineStudyDesignAdvice(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    clarifications: Partial<StudyDesignClarifications>;
    refinedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.refinedAt, "Study design advice refinedAt");
  const { confirmed, timing } = requireScreen3Prerequisites(state);
  const clarifications = normalizeStudyDesignClarifications(input.clarifications);
  const rejectedClaimIds = new Set(
    (state.policyEventCardReviews ?? []).flatMap(({ claimReviews }) =>
      claimReviews.filter(({ decision }) => decision === "rejected")
        .map(({ claimId }) => claimId)),
  );
  const entryContext = createScreen3StudyEntryContext({
    identityFingerprint: confirmed.identityFingerprint,
    study: state.study,
    timing,
    policyReview: state.policyReview?.artifactStatus === "current"
      ? state.policyReview
      : null,
    excludedLegacyRejectedClaimIds: [...rejectedClaimIds],
    clarifications,
    createdAt: input.refinedAt,
  });
  const advice = createStudyDesignAdvice({
    study: state.study,
    timing,
    entryContext,
    policyReview: state.policyReview?.artifactStatus === "current"
      ? state.policyReview : null,
    clarifications,
    createdAt: input.refinedAt,
  });
  const currentAdvice = currentStudyDesignAdvice(state);
  if (currentAdvice?.adviceFingerprint === advice.adviceFingerprint) {
    return { state, advice: currentAdvice };
  }
  state.screen3StudyEntryContexts = [
    ...(state.screen3StudyEntryContexts ?? []),
    entryContext,
  ].slice(-SIX_SCREEN_STUDY_DESIGN_MAX_RECORDS);
  state.studyDesignAdvices = [
    ...(state.studyDesignAdvices ?? []),
    advice,
  ].slice(-SIX_SCREEN_STUDY_DESIGN_MAX_RECORDS);
  appendChange(
    state,
    input.refinedAt,
    "Screen 3 method guidance was regenerated from explicit researcher clarifications; the study and policy evidence were not changed.",
  );
  return { state, advice };
}

export function decideStudyDesignAdvice(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    adviceId: string;
    expectedAdviceFingerprint: string;
    decision: StudyDesignSelection["decision"];
    rationale: string;
    selectedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.selectedAt, "Study design decision selectedAt");
  const advice = currentStudyDesignAdvice(state);
  if (
    !advice || advice.adviceId !== input.adviceId ||
    advice.adviceFingerprint !== input.expectedAdviceFingerprint
  ) throw new Error("The Screen 3 advice changed before this decision was saved.");
  const selection = createStudyDesignSelection({
    advice,
    decision: input.decision,
    rationale: input.rationale,
    selectedAt: input.selectedAt,
  });
  const existing = currentStudyDesignSelection(state);
  if (existing?.selectionFingerprint === selection.selectionFingerprint) {
    return { state, selection: existing };
  }
  state.studyDesignSelections = [
    ...(state.studyDesignSelections ?? []),
    selection,
  ].slice(-SIX_SCREEN_STUDY_DESIGN_MAX_RECORDS);
  appendChange(
    state,
    input.selectedAt,
    input.decision.mode === "selected"
      ? "The researcher selected a Screen 3 method option for further review; no assumption was certified."
      : "The researcher saved an explicit no-selection decision for the current Screen 3 advice.",
  );
  return { state, selection };
}

export function currentCausalDesignSet(
  state: SixScreenWorkflowState,
): CausalDesignSet | null {
  const { designSets } = designCollections(state);
  const currentArtifactIds = new Set(
    state.artifacts.filter(({ screen, status }) =>
      screen === 3 && status === "current").map(({ snapshotId }) => snapshotId),
  );
  const designSet = [...designSets].reverse().find(({ snapshotId }) =>
    currentArtifactIds.has(snapshotId)) ?? null;
  if (!designSet) return null;
  const eventCard = currentReviewedEventCardRecord(state)?.lockedEventCard ?? null;
  if (
    !eventCard ||
    designSet.binding.studyRevision !== state.study.revision ||
    designSet.binding.identityFingerprint !==
      state.confirmedShock?.identityFingerprint ||
    designSet.binding.eventCardReference.eventCardSnapshotId !==
      eventCard.snapshotId
  ) return null;
  return designSet;
}

export function currentCausalDesignDecision(
  state: SixScreenWorkflowState,
): CausalDesignDecision | null {
  const designSet = currentCausalDesignSet(state);
  if (!designSet) return null;
  const { decisions } = designCollections(state);
  return [...decisions].reverse().find(({ designSetSnapshotId }) =>
    designSetSnapshotId === designSet.snapshotId) ?? null;
}

export function buildCausalComparison(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    snapshotId: string;
    comparisonInput: CausalComparisonInput;
    builtAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.builtAt, "Causal comparison builtAt");
  if (state.activeScreen !== 3) {
    throw new Error("Causal comparison construction requires Screen 3 to be open.");
  }
  const { confirmed, review, eventCard } =
    requireLegacyCausalComparisonPrerequisites(state);
  const { designSets, decisions } = designCollections(state);
  if (designSets.length >= SIX_SCREEN_CAUSAL_DESIGN_MAX_REVISIONS) {
    throw new Error("Causal comparison history reached its bounded revision limit.");
  }
  if (designSets.some(({ snapshotId }) => snapshotId === input.snapshotId)) {
    throw new Error("Causal design set snapshot id was already used.");
  }
  state.artifacts = state.artifacts.map((artifact) =>
    artifact.screen === 3 && artifact.status === "current"
      ? {
          ...artifact,
          status: "archived" as const,
          invalidatedAt: input.builtAt,
          invalidationReason:
            "The researcher created a newer causal-comparison design set.",
        }
      : artifact
  );
  invalidateArtifacts(
    state,
    [4, 5, 6],
    "A newer causal-comparison design set changed an upstream dependency.",
    input.builtAt,
  );
  const designSet = createCausalDesignSet({
    snapshotId: input.snapshotId,
    ordinal: designSets.length + 1,
    comparisonInput: input.comparisonInput,
    study: state.study,
    confirmedShock: confirmed,
    eventCard,
    eventCardReview: review,
    createdAt: input.builtAt,
  });
  state.causalDesignSets = [...designSets, designSet];
  state.causalDesignDecisions = decisions;
  state.artifacts.push({
    snapshotId: designSet.snapshotId,
    screen: 3,
    status: "current",
    dependencies: {
      studyRevision: state.study.revision,
      identityFingerprint: confirmed.identityFingerprint,
      eventCardSnapshotId: eventCard.snapshotId,
      selectedDesignSnapshotId: null,
      coeventSnapshotId: null,
      mechanismSnapshotId: null,
    },
    invalidatedAt: null,
    invalidationReason: null,
  });
  appendChange(
    state,
    input.builtAt,
    designSet.options.length
      ? `Screen 3 saved ${designSet.options.length} source-linked conditional design option${designSet.options.length === 1 ? "" : "s"}.`
      : "Screen 3 saved an explicit no-supported-option result from the current reviewed variation.",
  );
  return { state, designSet: structuredClone(designSet) };
}

export function decideCausalComparison(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    snapshotId: string;
    designSetSnapshotId: string;
    expectedDesignSetFingerprint: string;
    decision:
      | { mode: "selected"; optionId: string }
      | { mode: "no_selection"; optionId?: never };
    rationale: string;
    actor: "researcher_ui" | "model" | "system";
    decidedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  if (state.activeScreen !== 3) {
    throw new Error("Causal comparison selection requires Screen 3 to be open.");
  }
  requireLegacyCausalComparisonPrerequisites(state);
  const designSet = currentCausalDesignSet(state);
  if (
    !designSet || designSet.snapshotId !== input.designSetSnapshotId ||
    designSet.designSetFingerprint !== input.expectedDesignSetFingerprint
  ) throw new Error("Causal comparison decision does not target the current design set.");
  const { designSets, decisions } = designCollections(state);
  if (decisions.some(({ designSetSnapshotId }) =>
    designSetSnapshotId === designSet.snapshotId)) {
    throw new Error("The current causal design set already has a researcher decision.");
  }
  if (decisions.some(({ snapshotId }) => snapshotId === input.snapshotId)) {
    throw new Error("Causal design decision snapshot id was already used.");
  }
  const decision = createCausalDesignDecision({
    snapshotId: input.snapshotId,
    designSet,
    decision: input.decision,
    rationale: input.rationale,
    actor: input.actor,
    decidedAt: input.decidedAt,
  });
  state.causalDesignSets = designSets;
  state.causalDesignDecisions = [...decisions, decision];
  invalidateArtifacts(
    state,
    [4, 5, 6],
    "A new researcher-owned causal-comparison decision changed a downstream dependency.",
    input.decidedAt,
  );
  appendChange(
    state,
    input.decidedAt,
    decision.decision === "selected"
      ? `The researcher selected ${decision.selectedDesign!.label} for review; its assumptions and gaps remain explicit.`
      : "The researcher recorded that no defensible causal comparison is selected yet.",
  );
  return { state, decision: structuredClone(decision) };
}

function screen4Mode(decision: CausalDesignDecision) {
  const targeted = decision.decision === "selected" &&
    decision.selectedDesign?.comparisonDefinition !== null;
  return targeted
    ? {
        mode: "targeted" as const,
        modeLabel: "Targeted event scan — selected comparison retained",
      }
    : {
        mode: "contextual" as const,
        modeLabel: "Contextual event scan — comparison not specified.",
      };
}

function screen4StudyFirstMode(
  selection: StudyDesignSelection | null,
  study: SixScreenWorkflowState["study"],
) {
  const groupsPresent = Boolean(
    study.proposedTreatment?.trim() && study.proposedComparison?.trim(),
  );
  return groupsPresent
    ? {
        mode: "targeted" as const,
        modeLabel: selection?.decision.mode === "selected"
          ? "Comparison-aware event scan — proposed groups and optional method retained"
          : "Comparison-aware event scan — proposed groups retained",
      }
    : {
        mode: "contextual" as const,
        modeLabel: "Contextual event scan — comparison not specified.",
      };
}

export function screen4PrerequisiteReport(
  state: SixScreenWorkflowState,
): Screen4PrerequisiteReport {
  const blockers: Screen4PrerequisiteReport["blockers"] = [];
  let confirmed: ConfirmedShock | null = null;
  try {
    confirmed = requireCurrentConfirmedShock(state);
  } catch {
    blockers.push({
      code: "confirmed_policy",
      message: "Return to Screen 1 and confirm the current policy identity.",
      classification: "screen_4_prerequisite",
    });
  }
  const review = currentReviewedEventCardRecord(state);
  const eventCard = review?.lockedEventCard ?? null;
  const entryContext = currentScreen3StudyEntryContext(state);
  const studyAdvice = currentStudyDesignAdvice(state);
  const studySelection = currentStudyDesignSelection(state);
  const studyTiming = currentProposedTreatmentTiming(state);
  const legacyReviewPending = studyTiming?.origin ===
      "legacy_explicit_decision" &&
    (state.policyEventCardReviews?.at(-1)?.status === "in_review");
  const designSet = currentCausalDesignSet(state);
  const decision = currentCausalDesignDecision(state);
  const studyFirstHandoff = Boolean(
    entryContext && studyAdvice && !legacyReviewPending,
  );
  const legacyHandoff = Boolean(
    eventCard && confirmed &&
      eventCard.binding.identityFingerprint === confirmed.identityFingerprint &&
      designSet && decision,
  );
  if (!studyFirstHandoff && !legacyHandoff) blockers.push({
    code: "current_causal_design_decision",
    message: "Open the current study-first guidance in Screen 3 or save a preserved legacy comparison decision.",
    classification: "screen_4_prerequisite",
  });
  if (!state.study.population) blockers.push({
    code: "population",
    message: "Specify the study population in Screen 1.",
    classification: "screen_4_prerequisite",
  });
  if (!state.study.geography.length) blockers.push({
    code: "geography",
    message: "Specify the study geography in Screen 1.",
    classification: "screen_4_prerequisite",
  });
  if (!state.study.outcome) blockers.push({
    code: "outcome",
    message: "Specify the outcome in Screen 1.",
    classification: "screen_4_prerequisite",
  });
  if (!state.study.period.start || !state.study.period.end) blockers.push({
    code: "study_period",
    message: "Specify both boundaries of the study period in Screen 1.",
    classification: "screen_4_prerequisite",
  });
  // A preserved legacy call to openScreen3 derives its timing from the locked
  // Event Card. Keep that exact executor available. Any researcher-reported
  // study-first timing uses the new handoff even when old legacy artifacts are
  // still present; selecting a method is never required to enter Screen 4.
  const useStudyFirstHandoff = studyFirstHandoff && (
    !legacyHandoff || studyTiming?.origin !== "legacy_explicit_decision" ||
    Boolean(studySelection)
  );
  const handoffKind = useStudyFirstHandoff
    ? "study_first_v2" as const
    : legacyHandoff
      ? "legacy_event_card" as const
      : null;
  const route = useStudyFirstHandoff
    ? screen4StudyFirstMode(studySelection, state.study)
    : decision
      ? screen4Mode(decision)
      : null;
  return {
    ready: blockers.length === 0,
    blockers,
    mode: route?.mode ?? null,
    modeLabel: route?.modeLabel ?? null,
    handoffKind,
    legacyExecutionAvailable: handoffKind === "legacy_event_card",
    currentEventCardSnapshotId: eventCard?.snapshotId ?? null,
    currentDesignSetSnapshotId: designSet?.snapshotId ?? null,
    currentDesignDecisionSnapshotId: decision?.snapshotId ?? null,
    currentStudyEntryContextId: entryContext?.id ?? null,
    currentStudyAdviceId: studyAdvice?.adviceId ?? null,
    currentStudySelectionId: studySelection?.id ?? null,
  };
}

function requireScreen4Prerequisites(state: SixScreenWorkflowState) {
  const report = screen4PrerequisiteReport(state);
  if (!report.ready) {
    throw new Error(
      `Screen 4 prerequisites are incomplete: ${report.blockers.map(
        ({ code }) => code.replaceAll("_", " "),
      ).join(", ")}.`,
    );
  }
  return {
    report,
    confirmed: requireCurrentConfirmedShock(state),
    review: currentReviewedEventCardRecord(state),
    designSet: currentCausalDesignSet(state),
    decision: currentCausalDesignDecision(state),
  };
}

function requireLegacyScreen4ExecutionPrerequisites(
  state: SixScreenWorkflowState,
) {
  const prerequisites = requireScreen4Prerequisites(state);
  if (
    prerequisites.report.handoffKind !== "legacy_event_card" ||
    !prerequisites.review?.lockedEventCard || !prerequisites.designSet ||
    !prerequisites.decision
  ) {
    throw new Error(
      "The existing Screen 4 search executor requires the preserved legacy Event Card contract; the study-first handoff remains open and has not manufactured that review.",
    );
  }
  return {
    ...prerequisites,
    review: prerequisites.review,
    designSet: prerequisites.designSet,
    decision: prerequisites.decision,
  };
}

export function openScreen4(
  current: SixScreenWorkflowState,
  input: { expectedRevision: number; openedAt: string },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.openedAt, "Screen 4 openedAt");
  const { report, review } =
    requireScreen4Prerequisites(state);
  let studyFirstInvestigation = currentStudyFirstEventInvestigation({
    studyFirstEventInvestigations: state.studyFirstEventInvestigations,
    confirmedShock: state.confirmedShock,
    study: state.study,
    entryContext: currentScreen3StudyEntryContext(state),
    timing: currentProposedTreatmentTiming(state),
    advice: currentStudyDesignAdvice(state),
    selection: currentStudyDesignSelection(state),
  });
  if (report.handoffKind === "study_first_v2" && !studyFirstInvestigation) {
    const confirmed = requireCurrentConfirmedShock(state);
    const entryContext = currentScreen3StudyEntryContext(state)!;
    const advice = currentStudyDesignAdvice(state)!;
    const timing = currentProposedTreatmentTiming(state)!;
    const investigations = state.studyFirstEventInvestigations ?? [];
    if (investigations.length >= STUDY_FIRST_EVENT_MAX_HISTORY) {
      throw new Error("Study-first Screen 4 investigation history reached its bounded limit.");
    }
    const context = createStudyFirstEventContext({
      runId: state.runId,
      selectionGeneration: confirmed.confirmation.workflowRevision,
      confirmedShock: confirmed,
      study: state.study,
      timing,
      entryContext,
      advice,
      selection: currentStudyDesignSelection(state),
      createdAt: input.openedAt,
    });
    studyFirstInvestigation = createPlannedStudyFirstEventInvestigation({
      context,
      ordinal: investigations.length + 1,
    });
    state.studyFirstEventInvestigations = [
      ...investigations,
      studyFirstInvestigation,
    ];
  }
  state.activeScreen = 4;
  appendChange(
    state,
    input.openedAt,
    report.mode === "targeted"
      ? "Screen 4 opened in comparison-aware mode from the current study proposal; method selection remains optional."
      : "Screen 4 opened in contextual mode from the current study proposal without manufacturing a comparison or method decision.",
  );
  return {
    state,
    receipt: {
      runId: state.runId,
      workflowRevision: state.revision,
      studyRevision: state.study.revision,
      mode: report.mode!,
      modeLabel: report.modeLabel!,
      handoffKind: report.handoffKind!,
      eventCardReference: review?.lockedEventCard
        ? createPolicyEventCardReference({ review })
        : null,
      designSetSnapshotId: report.currentDesignSetSnapshotId,
      designDecisionSnapshotId: report.currentDesignDecisionSnapshotId,
      studyEntryContextId: report.currentStudyEntryContextId,
      studyAdviceId: report.currentStudyAdviceId,
      studySelectionId: report.currentStudySelectionId,
      studyFirstInvestigationSnapshotId:
        studyFirstInvestigation?.snapshotId ?? null,
      openedAt: input.openedAt,
    } satisfies Screen4StartReceipt,
  };
}

export function commitStudyFirstEventInvestigation(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    plannedSnapshotId: string;
    expectedPlanFingerprint: string;
    attempts: StudyFirstEventSearchAttempt[];
    occurrences: CoEventCandidateOccurrence[];
    analyses: StudyFirstEventRelevanceAnalysis[];
    presentation: StudyFirstEventPresentation;
    startedAt: string;
    completedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.startedAt, "Study-first Screen 4 startedAt");
  requireCanonicalInstant(input.completedAt, "Study-first Screen 4 completedAt");
  const investigations = state.studyFirstEventInvestigations ?? [];
  const planned = investigations.find(({ snapshotId }) =>
    snapshotId === input.plannedSnapshotId);
  if (!planned || planned.status !== "planned" ||
      planned.plan.planFingerprint !== input.expectedPlanFingerprint) {
    throw new Error("The study-first Screen 4 plan changed before its result was committed.");
  }
  const completed = createCompletedStudyFirstEventInvestigation({
    previous: planned,
    attempts: input.attempts,
    occurrences: input.occurrences,
    analyses: input.analyses,
    presentation: input.presentation,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
  });
  if (investigations.length >= STUDY_FIRST_EVENT_MAX_HISTORY) {
    // A planned entry can legitimately occupy the final history slot before
    // its durable source aggregate is attached. Do not strand a fully saved
    // Screen 4 task at 10/10 merely because completion would otherwise append
    // entry 25. When no Screen 5 handoff references the placeholder, replace
    // it with the completed immutable result. The completed record retains
    // previousSnapshotId, the full frozen plan, evidence and timestamps.
    const plannedIsReferenced = (state.studyFirstEventScreen5Handoffs ?? [])
      .some(({ investigationSnapshotId }) =>
        investigationSnapshotId === planned.snapshotId);
    if (plannedIsReferenced) {
      throw new Error(
        "Study-first Screen 4 investigation history reached its bounded limit.",
      );
    }
    state.studyFirstEventInvestigations = investigations.map(
      (investigation) => investigation.snapshotId === planned.snapshotId
        ? completed : investigation,
    );
  } else {
    state.studyFirstEventInvestigations = [...investigations, completed];
  }
  invalidateArtifacts(
    state,
    [5, 6],
    "A newer study-first Screen 4 investigation result changed an upstream dependency.",
    input.completedAt,
  );
  appendChange(
    state,
    input.completedAt,
    completed.status === "failed"
      ? "Screen 4 recorded that its bounded automatic source scan could not complete; this is not a zero-event result."
      : `Screen 4 completed a bounded automatic scan with ${completed.presentation?.visibleEventIds.length ?? 0} visible documented event candidate${completed.presentation?.visibleEventIds.length === 1 ? "" : "s"}; conditional relevance remains qualified.`,
  );
  return { state, investigation: structuredClone(completed) };
}

export function currentCoEventSearchMatrix(
  state: SixScreenWorkflowState,
): CoEventSearchMatrix | null {
  const { matrices } = coEventCollections(state);
  const currentArtifactIds = new Set(
    state.artifacts.filter(({ screen, status }) =>
      screen === 4 && status === "current").map(({ snapshotId }) => snapshotId),
  );
  const matrix = [...matrices].reverse().find(({ snapshotId }) =>
    currentArtifactIds.has(snapshotId)) ?? null;
  if (!matrix) return null;
  const report = screen4PrerequisiteReport(state);
  if (
    !report.ready || matrix.binding.studyRevision !== state.study.revision ||
    matrix.binding.identityFingerprint !==
      state.confirmedShock?.identityFingerprint ||
    matrix.binding.eventCardReference.eventCardSnapshotId !==
      report.currentEventCardSnapshotId ||
    matrix.binding.designSetSnapshotId !==
      report.currentDesignSetSnapshotId ||
    matrix.binding.designDecisionSnapshotId !==
      report.currentDesignDecisionSnapshotId
  ) return null;
  return matrix;
}

export function saveCoEventSearchMatrix(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    snapshotId: string;
    scopeInput: CoEventSearchScopeInput;
    savedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.savedAt, "Screen 4 matrix savedAt");
  if (state.activeScreen !== 4) {
    throw new Error("A co-event search matrix requires Screen 4 to be open.");
  }
  const { confirmed, designSet, decision } =
    requireLegacyScreen4ExecutionPrerequisites(state);
  const { matrices } = coEventCollections(state);
  if (matrices.length >= SIX_SCREEN_COEVENT_SEARCH_MAX_REVISIONS) {
    throw new Error("Screen 4 search-matrix history reached its bounded revision limit.");
  }
  if (matrices.some(({ snapshotId }) => snapshotId === input.snapshotId)) {
    throw new Error("Screen 4 search-matrix snapshot id was already used.");
  }
  const matrix = createCoEventSearchMatrix({
    snapshotId: input.snapshotId,
    ordinal: matrices.length + 1,
    scopeInput: input.scopeInput,
    study: state.study,
    confirmedShock: confirmed,
    designSet,
    designDecision: decision,
    createdAt: input.savedAt,
  });
  state.artifacts = state.artifacts.map((artifact) =>
    artifact.screen === 4 && artifact.status === "current"
      ? {
          ...artifact,
          status: "archived" as const,
          invalidatedAt: input.savedAt,
          invalidationReason:
            "The researcher saved a newer Screen 4 scope and search matrix.",
        }
      : artifact
  );
  invalidateArtifacts(
    state,
    [5, 6],
    "A newer Screen 4 scope and search matrix changed an upstream dependency.",
    input.savedAt,
  );
  state.coEventSearchMatrices = [...matrices, matrix];
  state.artifacts.push({
    snapshotId: matrix.snapshotId,
    screen: 4,
    status: "current",
    dependencies: {
      studyRevision: state.study.revision,
      identityFingerprint: confirmed.identityFingerprint,
      eventCardSnapshotId:
        matrix.binding.eventCardReference.eventCardSnapshotId,
      selectedDesignSnapshotId: matrix.binding.selectedDesignSnapshotId,
      coeventSnapshotId: matrix.snapshotId,
      mechanismSnapshotId: null,
    },
    invalidatedAt: null,
    invalidationReason: null,
  });
  appendChange(
    state,
    input.savedAt,
    `Screen 4 saved a ${matrix.mode} ${matrix.rows.length}-branch search matrix without claiming that retrieval ran.`,
  );
  return { state, matrix: structuredClone(matrix) };
}

export function currentCoEventExecutionPlan(
  state: SixScreenWorkflowState,
): CoEventExecutionPlan | null {
  const matrix = currentCoEventSearchMatrix(state);
  if (!matrix) return null;
  const { plans } = coEventCollections(state);
  return [...plans].reverse().find((plan) =>
    plan.matrixSnapshotId === matrix.snapshotId &&
    plan.matrixFingerprint === matrix.matrixFingerprint
  ) ?? null;
}

export function currentCoEventSearchExecution(
  state: SixScreenWorkflowState,
): CoEventSearchExecution | null {
  const matrix = currentCoEventSearchMatrix(state);
  if (!matrix) return null;
  const { executions } = coEventCollections(state);
  const currentArtifactIds = new Set(
    state.artifacts.filter(({ screen, status }) =>
      screen === 4 && status === "current").map(({ snapshotId }) => snapshotId),
  );
  return [...executions].reverse().find((execution) =>
    execution.matrixSnapshotId === matrix.snapshotId &&
    execution.matrixFingerprint === matrix.matrixFingerprint &&
    currentArtifactIds.has(execution.snapshotId)
  ) ?? null;
}

function mechanismLiteratureCollections(state: SixScreenWorkflowState) {
  const plans = state.mechanismLiteraturePlans ?? [];
  const {
    matrices,
    executions,
    designSets,
    decisions,
  } = coEventCollections(state);
  validateMechanismLiteraturePlanCollection({
    plans,
    eventCardReviews: state.policyEventCardReviews ?? [],
    designSets,
    designDecisions: decisions,
    coEventMatrices: matrices,
    coEventExecutions: executions,
    coEventRelationReviews: state.coEventRelationReviews ?? [],
  });
  return { plans };
}

export function screen5PrerequisiteReport(
  state: SixScreenWorkflowState,
  projectedStudyFirstInvestigation?: StudyFirstEventInvestigation | null,
): Screen5PrerequisiteReport {
  const blockers: Screen5PrerequisiteReport["blockers"] = [];
  let confirmed: ConfirmedShock | null = null;
  try {
    confirmed = requireCurrentConfirmedShock(state);
  } catch {
    blockers.push({
      code: "confirmed_policy",
      message: "Return to Screen 1 and confirm the current policy identity.",
      classification: "screen_5_prerequisite",
    });
  }
  const review = currentReviewedEventCardRecord(state);
  const eventCard = review?.lockedEventCard ?? null;
  const entryContext = currentScreen3StudyEntryContext(state);
  const studyAdvice = currentStudyDesignAdvice(state);
  const studySelection = currentStudyDesignSelection(state);
  const studyFirstHandoff = Boolean(entryContext && studyAdvice);
  const legacyHandoff = Boolean(
    eventCard && confirmed &&
      eventCard.binding.identityFingerprint === confirmed.identityFingerprint,
  );
  if (!studyFirstHandoff && !legacyHandoff) blockers.push({
    code: "current_event_card",
    message: "Open the study-first Screen 3 handoff or restore the preserved reviewed Event Card.",
    classification: "screen_5_prerequisite",
  });
  if (!state.study.outcome) blockers.push({
    code: "outcome",
    message: "Specify the study outcome in Screen 1.",
    classification: "screen_5_prerequisite",
  });
  // Historical intendedConstruct is retained in old records, never used as a
  // prerequisite for viewing them or as a fallback for the active construct.
  const designDecision = currentCausalDesignDecision(state);
  const coEventMatrix = currentCoEventSearchMatrix(state);
  const coEventExecution = currentCoEventSearchExecution(state);
  // Compact Screen 4 source work is durably retained outside the canonical
  // workflow record. Runtime projections may therefore know that the exact
  // current investigation is complete while the small canonical placeholder
  // still says `planned`. Let that authenticated projection supply the
  // completed record for readiness only; core callers keep the canonical
  // resolver by omitting this argument.
  const studyFirstInvestigation = projectedStudyFirstInvestigation ??
    currentStudyFirstEventInvestigation({
      studyFirstEventInvestigations: state.studyFirstEventInvestigations,
      confirmedShock: state.confirmedShock,
      study: state.study,
      entryContext,
      timing: currentProposedTreatmentTiming(state),
      advice: studyAdvice,
      selection: studySelection,
    });
  const coEventSnapshotId = studyFirstHandoff
    ? studyFirstInvestigation?.snapshotId ?? null
    : coEventExecution?.snapshotId ?? coEventMatrix?.snapshotId ?? null;
  const coEventState = coEventCollections(state);
  const currentCandidateIds = coEventExecution?.candidateOccurrenceIds ?? [];
  const latestOccurrenceByCandidate = new Map<string, CoEventOccurrenceReview>();
  for (const occurrenceReview of coEventState.occurrenceReviews) {
    if (currentCandidateIds.includes(
      occurrenceReview.candidateReference.candidateId,
    )) {
      latestOccurrenceByCandidate.set(
        occurrenceReview.candidateReference.candidateId,
        occurrenceReview,
      );
    }
  }
  const occurrenceReviewComplete = currentCandidateIds.every((candidateId) => {
    const occurrenceReview = latestOccurrenceByCandidate.get(candidateId);
    return Boolean(occurrenceReview && occurrenceReview.decision !== "deferred");
  });
  const relationCoverage = coEventRelationReviewCoverage({
    currentCandidateIds,
    occurrenceReviews: coEventState.occurrenceReviews,
    relationReviews: coEventState.relationReviews,
  });
  const coEventRelationAnalysisComplete = Boolean(
    coEventExecution?.status === "complete" && occurrenceReviewComplete &&
    relationCoverage.complete,
  );
  const limitations: Screen5PrerequisiteReport["limitations"] = [];
  if (!designDecision && !studySelection) limitations.push({
    code: "design_review_not_assessed",
    message:
      "No current Screen 3 design decision is available; design-dependent mechanism predictions will remain unassessed.",
  });
  if (studyFirstHandoff) {
    if (!studyFirstInvestigation) limitations.push({
      code: "coevent_review_not_assessed",
      message:
        "The automatic Screen 4 investigation has not started; Screen 5 will preserve that exact pending state.",
    });
    else if (studyFirstInvestigation.status === "planned" ||
      studyFirstInvestigation.status === "running") limitations.push({
        code: "coevent_review_not_assessed",
        message:
          "The Screen 4 investigation is pending; Screen 5 will freeze the currently available context without treating pending work as favorable evidence.",
      });
    else if (studyFirstInvestigation.status === "failed") limitations.push({
      code: "coevent_review_not_assessed",
      message:
        "The bounded Screen 4 scan failed or had no usable source route; this is not evidence that no other event occurred.",
    });
    else if (studyFirstInvestigation.status === "completed_partial") limitations.push({
      code: "coevent_review_not_assessed",
      message: studyFirstInvestigation.presentation?.coverage.limitation ??
        "The Screen 4 scan completed with partial source coverage.",
    });
    if (studyFirstInvestigation?.analyses.length) limitations.push({
      code: "coevent_relations_not_assessed",
      message:
        "Screen 4 relevance was ordered with bounded evidence rules. A signed host assessment may refine the visible comparison, but neither route is a verified confounder classification.",
    });
  } else {
    if (!coEventSnapshotId) limitations.push({
      code: "coevent_review_not_assessed",
      message:
        "Screen 4 is not available; possible co-event implications will remain unassessed.",
    });
    if (!coEventRelationAnalysisComplete) limitations.push({
      code: "coevent_relations_not_assessed",
      message:
        "Comparison-specific co-event relations are incomplete; occurrence work alone does not classify an alternative explanation.",
    });
  }
  const handoffKind = studyFirstHandoff
    ? "study_first_v2" as const
    : legacyHandoff
      ? "legacy_event_card" as const
      : null;
  return {
    ready: blockers.length === 0,
    blockers,
    limitations,
    handoffKind,
    legacyExecutionAvailable: false,
    currentEventCardSnapshotId: eventCard?.snapshotId ?? null,
    currentDesignDecisionSnapshotId: designDecision?.snapshotId ?? null,
    currentCoEventSnapshotId: coEventSnapshotId,
    currentStudyEntryContextId: entryContext?.id ?? null,
    currentStudyAdviceId: studyAdvice?.adviceId ?? null,
    currentStudySelectionId: studySelection?.id ?? null,
  };
}

function requireScreen5Prerequisites(state: SixScreenWorkflowState) {
  const report = screen5PrerequisiteReport(state);
  if (!report.ready) {
    throw new Error(
      `Screen 5 prerequisites are incomplete: ${report.blockers.map(
        ({ code }) => code.replaceAll("_", " "),
      ).join(", ")}.`,
    );
  }
  return {
    report,
    confirmed: requireCurrentConfirmedShock(state),
    review: currentReviewedEventCardRecord(state),
  };
}

function requireLegacyScreen5ExecutionPrerequisites(
  state: SixScreenWorkflowState,
) {
  const prerequisites = requireScreen5Prerequisites(state);
  // The earlier executor built new literature plans from intendedConstruct.
  // Its saved artifacts remain readable, but no new legacy operation may run.
  // New mechanism work uses the study-first route and policySideConcept.
  if (!prerequisites.report.legacyExecutionAvailable) {
    throw new Error(
      "The historical Screen 5 literature route is read-only. View its saved records, or open the current study-first Screen 3 handoff to work with the theoretical construct of the shock.",
    );
  }
  if (
    prerequisites.report.handoffKind !== "legacy_event_card" ||
    !prerequisites.review?.lockedEventCard
  ) {
    throw new Error(
      "The existing Screen 5 literature executor requires the preserved legacy Event Card contract; the study-first handoff remains open and has not manufactured that review.",
    );
  }
  return { ...prerequisites, review: prerequisites.review };
}

export function openScreen5(
  current: SixScreenWorkflowState,
  input: { expectedRevision: number; openedAt: string },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.openedAt, "Screen 5 openedAt");
  const { report, review } = requireScreen5Prerequisites(state);
  let studyFirstHandoffId: string | null = null;
  if (report.handoffKind === "study_first_v2") {
    const investigation = currentStudyFirstEventInvestigation({
      studyFirstEventInvestigations: state.studyFirstEventInvestigations,
      confirmedShock: state.confirmedShock,
      study: state.study,
      entryContext: currentScreen3StudyEntryContext(state),
      timing: currentProposedTreatmentTiming(state),
      advice: currentStudyDesignAdvice(state),
      selection: currentStudyDesignSelection(state),
    });
    if (investigation) {
      const handoff = createStudyFirstEventScreen5Handoff({
        investigation,
        createdAt: input.openedAt,
      });
      const handoffs = state.studyFirstEventScreen5Handoffs ?? [];
      const existing = handoffs.find(({ handoffFingerprint }) =>
        handoffFingerprint === handoff.handoffFingerprint);
      if (!existing) {
        if (handoffs.length >= STUDY_FIRST_EVENT_MAX_HISTORY) {
          throw new Error("Study-first Screen 5 handoff history reached its bounded limit.");
        }
        state.studyFirstEventScreen5Handoffs = [...handoffs, handoff];
      }
      studyFirstHandoffId = existing?.id ?? handoff.id;
    }
  }
  state.activeScreen = 5;
  appendChange(
    state,
    input.openedAt,
    report.limitations.length
      ? "Screen 5 opened with explicit missing upstream assessments."
      : "Screen 5 opened from current upstream review snapshots.",
  );
  return {
    state,
    receipt: {
      runId: state.runId,
      workflowRevision: state.revision,
      studyRevision: state.study.revision,
      handoffKind: report.handoffKind!,
      eventCardReference: review?.lockedEventCard
        ? createPolicyEventCardReference({ review })
        : null,
      designDecisionSnapshotId: report.currentDesignDecisionSnapshotId,
      coEventSnapshotId: report.currentCoEventSnapshotId,
      studyEntryContextId: report.currentStudyEntryContextId,
      studyAdviceId: report.currentStudyAdviceId,
      studySelectionId: report.currentStudySelectionId,
      studyFirstEventHandoffId: studyFirstHandoffId,
      limitations: structuredClone(report.limitations),
      openedAt: input.openedAt,
    } satisfies Screen5StartReceipt,
  };
}

export function currentStudyFirstMechanismContext(
  state: SixScreenWorkflowState,
  createdAt = state.updatedAt,
) {
  const report = screen5PrerequisiteReport(state);
  if (!report.ready || report.handoffKind !== "study_first_v2") return null;
  const confirmed = requireCurrentConfirmedShock(state);
  const entryContext = currentScreen3StudyEntryContext(state);
  const timing = currentProposedTreatmentTiming(state);
  const advice = currentStudyDesignAdvice(state);
  if (!entryContext || !timing || !advice) return null;
  const investigation = currentStudyFirstEventInvestigation({
    studyFirstEventInvestigations: state.studyFirstEventInvestigations,
    confirmedShock: state.confirmedShock,
    study: state.study,
    entryContext,
    timing,
    advice,
    selection: currentStudyDesignSelection(state),
  });
  return investigation?.context ?? createStudyFirstEventContext({
    runId: state.runId,
    selectionGeneration: confirmed.confirmation.workflowRevision,
    confirmedShock: confirmed,
    study: state.study,
    timing,
    entryContext,
    advice,
    selection: currentStudyDesignSelection(state),
    createdAt,
  });
}

export function currentStudyFirstMechanismRunForState(
  state: SixScreenWorkflowState,
) {
  const runs = state.studyFirstMechanismRuns ?? [];
  validateStudyFirstMechanismRuns(runs);
  const context = currentStudyFirstMechanismContext(state);
  const contextRun = currentStudyFirstMechanismRun({
    runs,
    contextFingerprint: context?.contextFingerprint ?? null,
  });
  if (!context) return null;
  const currentInput = currentStudyFirstMechanismInputForState(state);
  if (!currentInput) return contextRun;
  if (currentInput.contextFingerprint !== context.contextFingerprint) {
    return null;
  }
  return [...runs].reverse().find((run) =>
    run.context.contextFingerprint === currentInput.contextFingerprint &&
    run.input.inputFingerprint === currentInput.inputFingerprint
  ) ?? null;
}

export function currentStudyFirstMechanismInputForState(
  state: SixScreenWorkflowState,
) {
  const inputs = state.studyFirstMechanismInputs ?? [];
  validateStudyFirstMechanismInputs(inputs);
  return structuredClone(inputs.at(-1) ?? null);
}

export function saveStudyFirstMechanismInput(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    mechanismInput: StudyFirstMechanismInput;
    savedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.savedAt, "Study-first Screen 5 input savedAt");
  const report = requireScreen5Prerequisites(state).report;
  if (report.handoffKind !== "study_first_v2") {
    throw new Error(
      "A study-first mechanism input requires the current study-first Screen 5 workspace.",
    );
  }
  const inputs = state.studyFirstMechanismInputs ?? [];
  validateStudyFirstMechanismInputs(inputs);
  validateStudyFirstMechanismInput(input.mechanismInput);
  if (inputs.length >= STUDY_FIRST_MECHANISM_MAX_HISTORY) {
    throw new Error("Study-first Screen 5 mechanism-input history reached its bounded limit.");
  }
  const context = currentStudyFirstMechanismContext(state, input.savedAt);
  if (
    !context ||
    input.mechanismInput.contextFingerprint !== context.contextFingerprint ||
    input.mechanismInput.revision !== inputs.length + 1 ||
    inputs.some(({ id }) => id === input.mechanismInput.id)
  ) {
    throw new Error("The study-first Screen 5 mechanism input has stale or invalid lineage.");
  }
  state.studyFirstMechanismInputs = [
    ...inputs,
    structuredClone(input.mechanismInput),
  ];
  invalidateArtifacts(
    state,
    [6],
    "A newer study-first Screen 5 mechanism input changed an upstream dependency.",
    input.savedAt,
  );
  appendChange(
    state,
    input.savedAt,
    "Screen 5 saved an exact new researcher mechanism-input revision before bounded evidence retrieval.",
  );
  return { state, input: structuredClone(input.mechanismInput) };
}

export function commitStudyFirstMechanismRun(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    run: StudyFirstMechanismRun;
    savedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.savedAt, "Study-first Screen 5 savedAt");
  const report = requireScreen5Prerequisites(state).report;
  if (report.handoffKind !== "study_first_v2") {
    throw new Error(
      "A study-first Screen 5 mechanism run requires the current study-first handoff.",
    );
  }
  const runs = state.studyFirstMechanismRuns ?? [];
  const inputs = state.studyFirstMechanismInputs ?? [];
  validateStudyFirstMechanismInputs(inputs);
  validateStudyFirstMechanismRuns(runs);
  validateStudyFirstMechanismRuns([input.run]);
  if (runs.length >= STUDY_FIRST_MECHANISM_MAX_HISTORY) {
    throw new Error("Study-first Screen 5 mechanism history reached its bounded limit.");
  }
  if (runs.some(({ id }) => id === input.run.id)) {
    throw new Error("Study-first Screen 5 mechanism run id was already used.");
  }
  const context = currentStudyFirstMechanismContext(state, input.savedAt);
  const latestInput = [...inputs].reverse().find((value) =>
    value.contextFingerprint === context?.contextFingerprint
  );
  if (
    !context ||
    input.run.context.contextFingerprint !== context.contextFingerprint ||
    !latestInput ||
    input.run.input.inputFingerprint !== latestInput.inputFingerprint
  ) {
    throw new Error(
      "The study-first Screen 5 mechanism result was produced for stale study context.",
    );
  }
  if (
    input.run.ordinal !== runs.length + 1 ||
    input.run.previousRunId !== (runs.at(-1)?.id ?? null)
  ) {
    throw new Error("Study-first Screen 5 mechanism lineage is invalid.");
  }
  state.studyFirstMechanismRuns = [...runs, structuredClone(input.run)];
  state.artifacts = state.artifacts.map((artifact) =>
    artifact.screen === 5 && artifact.status === "current"
      ? {
          ...artifact,
          status: "archived" as const,
          invalidatedAt: input.savedAt,
          invalidationReason:
            "A newer study-first Screen 5 mechanism/evidence run was saved.",
        }
      : artifact
  );
  invalidateArtifacts(
    state,
    [6],
    "A newer study-first Screen 5 mechanism/evidence run changed an upstream dependency.",
    input.savedAt,
  );
  state.artifacts.push({
    snapshotId: input.run.id,
    screen: 5,
    status: "current",
    dependencies: {
      studyRevision: state.study.revision,
      identityFingerprint: context.policy.identityFingerprint,
      eventCardSnapshotId: report.currentEventCardSnapshotId,
      selectedDesignSnapshotId: report.currentDesignDecisionSnapshotId,
      coeventSnapshotId: report.currentCoEventSnapshotId,
      mechanismSnapshotId: input.run.id,
    },
    invalidatedAt: null,
    invalidationReason: null,
  });
  appendChange(
    state,
    input.savedAt,
    input.run.status === "needs_clarification"
      ? "Screen 5 preserved the exact proposed mechanism and requested a process-level clarification without running scholarship search."
      : `Screen 5 preserved the exact proposed mechanism and retained ${input.run.works.length} deduplicated scholarly lead${input.run.works.length === 1 ? "" : "s"} with explicit text-access limits.`,
  );
  return { state, run: structuredClone(input.run) };
}

export function currentMechanismLiteraturePlan(
  state: SixScreenWorkflowState,
): MechanismLiteraturePlan | null {
  const { plans } = mechanismLiteratureCollections(state);
  const currentArtifactIds = new Set(
    state.artifacts.filter(({ screen, status }) =>
      screen === 5 && status === "current").map(({ snapshotId }) => snapshotId),
  );
  const plan = [...plans].reverse().find(({ snapshotId }) =>
    currentArtifactIds.has(snapshotId)) ?? null;
  if (!plan) return null;
  const report = screen5PrerequisiteReport(state);
  if (
    !report.ready || plan.binding.studyRevision !== state.study.revision ||
    plan.binding.identityFingerprint !==
      state.confirmedShock?.identityFingerprint ||
    plan.binding.eventCardReference.eventCardSnapshotId !==
      report.currentEventCardSnapshotId ||
    plan.binding.designDecisionSnapshotId !==
      report.currentDesignDecisionSnapshotId ||
    plan.binding.coEventSnapshotId !== report.currentCoEventSnapshotId
  ) return null;
  return plan;
}

function mechanismLiteratureExecutionCollections(
  state: SixScreenWorkflowState,
) {
  const executionPlans = state.mechanismLiteratureExecutionPlans ?? [];
  const executions = state.mechanismLiteratureExecutions ?? [];
  const records = state.scholarlyMetadataRecords ?? [];
  const packets = state.scholarlyEvidencePackets ?? [];
  const documentAcquisitions = state.scholarlyDocumentAcquisitions ?? [];
  const passagePackets = state.scholarlyPassagePackets ?? [];
  const claimExtractions = state.scholarlyClaimExtractions ?? [];
  const claimReviews = state.scholarlyClaimReviews ?? [];
  const claimPackets = state.scholarlyClaimPackets ?? [];
  const synthesisInputPackets = state.mechanismSynthesisInputPackets ?? [];
  const mechanismReviews = state.mechanismReviews ?? [];
  const predictionMatrices = state.predictionMatrices ?? [];
  validateMechanismLiteratureExecutionCollections({
    literaturePlans: state.mechanismLiteraturePlans ?? [],
    executionPlans,
    executions,
    records,
    packets,
  });
  validateScholarlyDocumentCollections({
    literaturePlans: state.mechanismLiteraturePlans ?? [],
    metadataExecutions: executions,
    metadataRecords: records,
    metadataPackets: packets,
    acquisitions: documentAcquisitions,
    passagePackets,
  });
  validateScholarlyClaimCollections({
    acquisitions: documentAcquisitions,
    passagePackets,
    extractions: claimExtractions,
    reviews: claimReviews,
    claimPackets,
  });
  validateMechanismSynthesisInputCollection({
    literaturePlans: state.mechanismLiteraturePlans ?? [],
    metadataPackets: packets,
    passagePackets,
    acquisitions: documentAcquisitions,
    extractions: claimExtractions,
    reviews: claimReviews,
    claimPackets,
    synthesisInputPackets,
  });
  validateMechanismReviewCollections({
    synthesisInputs: synthesisInputPackets,
    reviews: mechanismReviews,
    predictionMatrices,
  });
  return {
    executionPlans,
    executions,
    records,
    packets,
    documentAcquisitions,
    passagePackets,
    claimExtractions,
    claimReviews,
    claimPackets,
    synthesisInputPackets,
    mechanismReviews,
    predictionMatrices,
  };
}

export function currentMechanismLiteratureExecutionPlan(
  state: SixScreenWorkflowState,
): MechanismLiteratureExecutionPlan | null {
  const literaturePlan = currentMechanismLiteraturePlan(state);
  if (!literaturePlan) return null;
  const { executionPlans } = mechanismLiteratureExecutionCollections(state);
  return [...executionPlans].reverse().find((plan) =>
    plan.literaturePlanSnapshotId === literaturePlan.snapshotId &&
    plan.literaturePlanFingerprint === literaturePlan.planFingerprint
  ) ?? null;
}

export function currentMechanismLiteratureExecution(
  state: SixScreenWorkflowState,
): MechanismLiteratureExecution | null {
  const literaturePlan = currentMechanismLiteraturePlan(state);
  if (!literaturePlan) return null;
  const { executions } = mechanismLiteratureExecutionCollections(state);
  const currentArtifactIds = new Set(
    state.artifacts.filter(({ screen, status }) =>
      screen === 5 && status === "current").map(({ snapshotId }) => snapshotId),
  );
  return [...executions].reverse().find((execution) =>
    execution.literaturePlanSnapshotId === literaturePlan.snapshotId &&
    execution.literaturePlanFingerprint === literaturePlan.planFingerprint &&
    currentArtifactIds.has(execution.snapshotId)
  ) ?? null;
}

export function currentScholarlyEvidencePacket(
  state: SixScreenWorkflowState,
): ScholarlyEvidencePacket | null {
  const execution = currentMechanismLiteratureExecution(state);
  if (!execution) return null;
  const { packets } = mechanismLiteratureExecutionCollections(state);
  return [...packets].reverse().find((packet) =>
    packet.binding.executionSnapshotId === execution.snapshotId &&
    packet.binding.executionFingerprint === execution.executionFingerprint
  ) ?? null;
}

export function currentScholarlyPassagePacket(
  state: SixScreenWorkflowState,
): ScholarlyPassagePacket | null {
  const metadataPacket = currentScholarlyEvidencePacket(state);
  if (!metadataPacket) return null;
  const { passagePackets } = mechanismLiteratureExecutionCollections(state);
  return [...passagePackets].reverse().find((packet) =>
    packet.binding.metadataPacketSnapshotId === metadataPacket.snapshotId &&
    packet.binding.metadataPacketFingerprint === metadataPacket.packetFingerprint
  ) ?? null;
}

export function currentScholarlyClaimPacket(
  state: SixScreenWorkflowState,
): ScholarlyClaimPacket | null {
  const metadataPacket = currentScholarlyEvidencePacket(state);
  if (!metadataPacket) return null;
  const { claimPackets } = mechanismLiteratureExecutionCollections(state);
  return [...claimPackets].reverse().find((packet) =>
    packet.binding.metadataPacketSnapshotId === metadataPacket.snapshotId &&
    packet.binding.metadataPacketFingerprint === metadataPacket.packetFingerprint
  ) ?? null;
}

export function currentMechanismSynthesisInputPacket(
  state: SixScreenWorkflowState,
): MechanismSynthesisInputPacket | null {
  const literaturePlan = currentMechanismLiteraturePlan(state);
  const metadataPacket = currentScholarlyEvidencePacket(state);
  const claimPacket = currentScholarlyClaimPacket(state);
  if (!literaturePlan || !metadataPacket || !claimPacket) return null;
  const { synthesisInputPackets } = mechanismLiteratureExecutionCollections(
    state,
  );
  return [...synthesisInputPackets].reverse().find((packet) =>
    packet.binding.literaturePlanSnapshotId === literaturePlan.snapshotId &&
    packet.binding.literaturePlanFingerprint ===
      literaturePlan.planFingerprint &&
    packet.binding.metadataPacketSnapshotId === metadataPacket.snapshotId &&
    packet.binding.metadataPacketFingerprint === metadataPacket.packetFingerprint &&
    packet.binding.claimPacketSnapshotId === claimPacket.snapshotId &&
    packet.binding.claimPacketFingerprint === claimPacket.packetFingerprint
  ) ?? null;
}

export function currentMechanismReview(
  state: SixScreenWorkflowState,
): MechanismReview | null {
  const synthesisInput = currentMechanismSynthesisInputPacket(state);
  if (!synthesisInput) return null;
  const { mechanismReviews } = mechanismLiteratureExecutionCollections(state);
  const currentArtifactIds = new Set(
    state.artifacts.filter(({ screen, status }) =>
      screen === 5 && status === "current").map(({ snapshotId }) => snapshotId),
  );
  return [...mechanismReviews].reverse().find((review) =>
    review.binding.synthesisInputSnapshotId === synthesisInput.snapshotId &&
    review.binding.synthesisInputFingerprint === synthesisInput.packetFingerprint &&
    currentArtifactIds.has(review.snapshotId)
  ) ?? null;
}

export function currentPredictionMatrix(
  state: SixScreenWorkflowState,
): PredictionMatrix | null {
  const review = currentMechanismReview(state);
  if (!review) return null;
  const { predictionMatrices } = mechanismLiteratureExecutionCollections(state);
  const currentArtifactIds = new Set(
    state.artifacts.filter(({ screen, status }) =>
      screen === 5 && status === "current").map(({ snapshotId }) => snapshotId),
  );
  return [...predictionMatrices].reverse().find((matrix) =>
    matrix.binding.mechanismReviewSnapshotId === review.snapshotId &&
    matrix.binding.mechanismReviewFingerprint === review.reviewFingerprint &&
    currentArtifactIds.has(matrix.snapshotId)
  ) ?? null;
}

function screen6ProfileContext(
  state: SixScreenWorkflowState,
  confirmedShock = requireCurrentConfirmedShock(state),
): Screen6ProfileContext {
  return {
    study: state.study,
    identityRevision: state.identityRevision,
    confirmedShock,
    eventCardReview: currentReviewedEventCardRecord(state),
    designSet: currentCausalDesignSet(state),
    designDecision: currentCausalDesignDecision(state),
    coEventMatrix: currentCoEventSearchMatrix(state),
    coEventExecution: currentCoEventSearchExecution(state),
    coEventOccurrenceReviews: state.coEventOccurrenceReviews ?? [],
    coEventRelationReviews: state.coEventRelationReviews ?? [],
    mechanismLiteraturePlan: currentMechanismLiteraturePlan(state),
    mechanismSynthesisInput: currentMechanismSynthesisInputPacket(state),
    mechanismReview: currentMechanismReview(state),
    predictionMatrix: currentPredictionMatrix(state),
  };
}

export function screen6PrerequisiteReport(
  state: SixScreenWorkflowState,
): Screen6PrerequisiteReport {
  let confirmedShock: ConfirmedShock;
  try {
    confirmedShock = requireCurrentConfirmedShock(state);
  } catch {
    return {
      ready: false,
      blockers: [{
        code: "confirmed_policy",
        message: "Return to Screen 1 and confirm the current policy identity.",
        classification: "screen_6_prerequisite",
      }],
      limitations: [],
      currentEventCardSnapshotId: null,
      currentDesignDecisionSnapshotId: null,
      currentCoEventSnapshotId: null,
      currentMechanismInputSnapshotId: null,
      currentStudyEntryContextId: null,
      currentStudyAdviceId: null,
      currentStudySelectionId: null,
    };
  }
  const context = screen6ProfileContext(state, confirmedShock);
  const entryContext = currentScreen3StudyEntryContext(state);
  const studyAdvice = currentStudyDesignAdvice(state);
  const studySelection = currentStudyDesignSelection(state);
  const studyFirstMechanismRun = currentStudyFirstMechanismRunForState(state);
  return {
    ready: true,
    blockers: [],
    limitations: screen6UncertaintyProfileGaps(context),
    currentEventCardSnapshotId:
      context.eventCardReview?.lockedEventCard?.snapshotId ?? null,
    currentDesignDecisionSnapshotId:
      context.designDecision?.snapshotId ?? null,
    currentCoEventSnapshotId:
      context.coEventExecution?.snapshotId ??
      context.coEventMatrix?.snapshotId ?? null,
    currentMechanismInputSnapshotId:
      context.mechanismReview?.snapshotId ??
      context.mechanismSynthesisInput?.snapshotId ??
      context.mechanismLiteraturePlan?.snapshotId ??
      studyFirstMechanismRun?.id ?? null,
    currentStudyEntryContextId: entryContext?.id ?? null,
    currentStudyAdviceId: studyAdvice?.adviceId ?? null,
    currentStudySelectionId: studySelection?.id ?? null,
  };
}

function requireScreen6Prerequisites(state: SixScreenWorkflowState) {
  const report = screen6PrerequisiteReport(state);
  if (!report.ready) {
    throw new Error("Screen 6 requires the current researcher-confirmed policy identity.");
  }
  return { report, context: screen6ProfileContext(state) };
}

export function openScreen6(
  current: SixScreenWorkflowState,
  input: { expectedRevision: number; openedAt: string },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.openedAt, "Screen 6 openedAt");
  const { report, context } = requireScreen6Prerequisites(state);
  state.activeScreen = 6;
  appendChange(
    state,
    input.openedAt,
    report.limitations.length
      ? "Screen 6 opened with explicit upstream and diagnostic gaps."
      : "Screen 6 opened from the current upstream snapshots.",
  );
  return {
    state,
    receipt: {
      runId: state.runId,
      workflowRevision: state.revision,
      studyRevision: state.study.revision,
      identityRevision: state.identityRevision,
      identityFingerprint: context.confirmedShock.identityFingerprint,
      limitations: structuredClone(report.limitations),
      currentEventCardSnapshotId: report.currentEventCardSnapshotId,
      currentDesignDecisionSnapshotId:
        report.currentDesignDecisionSnapshotId,
      currentCoEventSnapshotId: report.currentCoEventSnapshotId,
      currentMechanismInputSnapshotId:
        report.currentMechanismInputSnapshotId,
      openedAt: input.openedAt,
    } satisfies Screen6StartReceipt,
  };
}

function screen6Collections(state: SixScreenWorkflowState) {
  const profiles = state.screen6UncertaintyProfiles ?? [];
  const plans = state.screen6DiagnosticPlans ?? [];
  const results = state.screen6DiagnosticResults ?? [];
  const reviews = state.screen6DiagnosticResultReviews ?? [];
  const boundaries = state.screen6ConditionalClaimBoundaries ?? [];
  const dispositions = state.screen6ResearchPlanningDispositions ?? [];
  const exports = state.screen6ResearchExports ?? [];
  validateScreen6UncertaintyProfileCollection({
    profiles,
    eventCardReviews: state.policyEventCardReviews ?? [],
    designSets: state.causalDesignSets ?? [],
    designDecisions: state.causalDesignDecisions ?? [],
    coEventMatrices: state.coEventSearchMatrices ?? [],
    coEventExecutions: state.coEventSearchExecutions ?? [],
    coEventRelationReviews: state.coEventRelationReviews ?? [],
    mechanismLiteraturePlans: state.mechanismLiteraturePlans ?? [],
    mechanismSynthesisInputs: state.mechanismSynthesisInputPackets ?? [],
    mechanismReviews: state.mechanismReviews ?? [],
    predictionMatrices: state.predictionMatrices ?? [],
  });
  validateScreen6DiagnosticPlanCollection({
    plans,
    profiles,
    designSets: state.causalDesignSets ?? [],
    designDecisions: state.causalDesignDecisions ?? [],
  });
  validateScreen6DiagnosticResultCollections({ plans, results, reviews });
  validateScreen6ClaimBoundaryCollections({
    profiles,
    plans,
    results,
    reviews,
    boundaries,
    dispositions,
  });
  if (exports.length) validateScreen6ResearchExportCollection(state);
  return {
    profiles,
    plans,
    results,
    reviews,
    boundaries,
    dispositions,
    exports,
  };
}

export function currentScreen6UncertaintyProfile(
  state: SixScreenWorkflowState,
): Screen6UncertaintyProfile | null {
  const report = screen6PrerequisiteReport(state);
  if (!report.ready) return null;
  const currentArtifactIds = new Set(
    state.artifacts.filter(({ screen, status }) =>
      screen === 6 && status === "current").map(({ snapshotId }) => snapshotId),
  );
  const { profiles } = screen6Collections(state);
  const profile = [...profiles].reverse().find(({ snapshotId }) =>
    currentArtifactIds.has(snapshotId)
  ) ?? null;
  if (!profile) return null;
  return profile.inputFingerprint === screen6UncertaintyProfileInputFingerprint(
      screen6ProfileContext(state),
    )
    ? profile
    : null;
}

export function initializeScreen6UncertaintyProfile(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    snapshotId: string;
    actor: "researcher_ui" | "model" | "system";
    createdAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.createdAt, "Screen 6 profile createdAt");
  if (state.activeScreen !== 6) {
    throw new Error("The uncertainty profile can be initialized only from Screen 6.");
  }
  const { context } = requireScreen6Prerequisites(state);
  const { profiles } = screen6Collections(state);
  const inputFingerprint = screen6UncertaintyProfileInputFingerprint(context);
  if (
    profiles.length >= SIX_SCREEN_UNCERTAINTY_PROFILE_MAX_REVISIONS ||
    profiles.some((profile) =>
      profile.snapshotId === input.snapshotId ||
      profile.inputFingerprint === inputFingerprint)
  ) throw new Error("Screen 6 profile history reached capacity or reused current inputs.");
  const profile = createScreen6UncertaintyProfile({
    snapshotId: input.snapshotId,
    ordinal: profiles.length + 1,
    context,
    actor: input.actor,
    createdAt: input.createdAt,
  });
  const nextProfiles = [...profiles, profile];
  validateScreen6UncertaintyProfileCollection({
    profiles: nextProfiles,
    eventCardReviews: state.policyEventCardReviews ?? [],
    designSets: state.causalDesignSets ?? [],
    designDecisions: state.causalDesignDecisions ?? [],
    coEventMatrices: state.coEventSearchMatrices ?? [],
    coEventExecutions: state.coEventSearchExecutions ?? [],
    coEventRelationReviews: state.coEventRelationReviews ?? [],
    mechanismLiteraturePlans: state.mechanismLiteraturePlans ?? [],
    mechanismSynthesisInputs: state.mechanismSynthesisInputPackets ?? [],
    mechanismReviews: state.mechanismReviews ?? [],
    predictionMatrices: state.predictionMatrices ?? [],
  });
  state.artifacts = state.artifacts.map((artifact) =>
    artifact.screen === 6 && artifact.status === "current"
      ? {
          ...artifact,
          status: "archived" as const,
          invalidatedAt: input.createdAt,
          invalidationReason:
            "A newer Screen 6 uncertainty profile replaced this current view.",
        }
      : artifact
  );
  state.screen6UncertaintyProfiles = nextProfiles;
  state.artifacts.push({
    snapshotId: profile.snapshotId,
    screen: 6,
    status: "current",
    dependencies: {
      studyRevision: profile.binding.studyRevision,
      identityFingerprint: profile.binding.identityFingerprint,
      eventCardSnapshotId:
        profile.binding.eventCardReference?.eventCardSnapshotId ?? null,
      selectedDesignSnapshotId:
        profile.binding.design?.selectedDesignSnapshotId ?? null,
      coeventSnapshotId: profile.binding.coEvent?.snapshotId ?? null,
      mechanismSnapshotId:
        profile.binding.mechanismInput?.snapshotId ?? null,
    },
    invalidatedAt: null,
    invalidationReason: null,
  });
  appendChange(
    state,
    input.createdAt,
    `Researcher initialized ten separate Screen 6 uncertainty dimensions with ${profile.gaps.length} explicit gap${profile.gaps.length === 1 ? "" : "s"}; no diagnostic or result was created.`,
  );
  return { state, profile: structuredClone(profile) };
}

export function currentScreen6DiagnosticPlan(
  state: SixScreenWorkflowState,
): Screen6DiagnosticPlan | null {
  const profile = currentScreen6UncertaintyProfile(state);
  if (!profile) return null;
  const currentArtifactIds = new Set(
    state.artifacts.filter(({ screen, status }) =>
      screen === 6 && status === "current").map(({ snapshotId }) => snapshotId),
  );
  const { plans } = screen6Collections(state);
  return [...plans].reverse().find((plan) =>
    currentArtifactIds.has(plan.snapshotId) &&
    plan.binding.profileSnapshotId === profile.snapshotId &&
    plan.binding.profileFingerprint === profile.profileFingerprint
  ) ?? null;
}

export function saveScreen6DiagnosticPlan(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    snapshotId: string;
    diagnosticInput: Screen6DiagnosticPlanInput;
    actor: "researcher_ui" | "model" | "system";
    createdAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.createdAt, "Screen 6 diagnostic-plan createdAt");
  if (state.activeScreen !== 6) {
    throw new Error("A Screen 6 diagnostic plan can be saved only from Screen 6.");
  }
  requireScreen6Prerequisites(state);
  const profile = currentScreen6UncertaintyProfile(state);
  if (!profile) {
    throw new Error("Initialize the current Screen 6 uncertainty profile before planning diagnostics.");
  }
  const { profiles, plans } = screen6Collections(state);
  if (plans.length >= SIX_SCREEN_DIAGNOSTIC_PLAN_MAX_REVISIONS) {
    throw new Error("Screen 6 diagnostic-plan history reached capacity.");
  }
  const designSet = currentCausalDesignSet(state);
  const designDecision = currentCausalDesignDecision(state);
  const plan = createScreen6DiagnosticPlan({
    snapshotId: input.snapshotId,
    ordinal: plans.length + 1,
    profile,
    designSet,
    designDecision,
    diagnosticInput: input.diagnosticInput,
    actor: input.actor,
    createdAt: input.createdAt,
  });
  if (
    plans.some((candidate) =>
      candidate.snapshotId === plan.snapshotId ||
      candidate.planningInputFingerprint === plan.planningInputFingerprint)
  ) throw new Error("Screen 6 diagnostic-plan inputs or snapshot id were already used.");
  const nextPlans = [...plans, plan];
  validateScreen6DiagnosticPlanCollection({
    plans: nextPlans,
    profiles,
    designSets: state.causalDesignSets ?? [],
    designDecisions: state.causalDesignDecisions ?? [],
  });
  state.artifacts = state.artifacts.map((artifact) =>
    artifact.screen === 6 && artifact.status === "current" &&
        artifact.snapshotId !== profile.snapshotId
      ? {
          ...artifact,
          status: "archived" as const,
          invalidatedAt: input.createdAt,
          invalidationReason:
            "A newer researcher-owned Screen 6 diagnostic plan replaced this plan view.",
        }
      : artifact
  );
  state.screen6DiagnosticPlans = nextPlans;
  state.artifacts.push({
    snapshotId: plan.snapshotId,
    screen: 6,
    status: "current",
    dependencies: {
      studyRevision: profile.binding.studyRevision,
      identityFingerprint: profile.binding.identityFingerprint,
      eventCardSnapshotId:
        profile.binding.eventCardReference?.eventCardSnapshotId ?? null,
      selectedDesignSnapshotId:
        profile.binding.design?.selectedDesignSnapshotId ?? null,
      coeventSnapshotId: profile.binding.coEvent?.snapshotId ?? null,
      mechanismSnapshotId:
        profile.binding.mechanismInput?.snapshotId ?? null,
    },
    invalidatedAt: null,
    invalidationReason: null,
  });
  appendChange(
    state,
    input.createdAt,
    plan.cards.length
      ? `Researcher saved ${plan.cards.length} planned Screen 6 diagnostic card${plan.cards.length === 1 ? "" : "s"} from the reviewed library; no diagnostic result was created.`
      : "Researcher saved Screen 6 diagnostic inputs, but no reviewed trigger selected a diagnostic; no result was created.",
  );
  return { state, plan: structuredClone(plan) };
}

export function currentScreen6DiagnosticResults(
  state: SixScreenWorkflowState,
): Screen6DiagnosticResult[] {
  const plan = currentScreen6DiagnosticPlan(state);
  if (!plan) return [];
  const currentArtifactIds = new Set(
    state.artifacts.filter(({ screen, status }) =>
      screen === 6 && status === "current").map(({ snapshotId }) => snapshotId),
  );
  const { results } = screen6Collections(state);
  return latestScreen6DiagnosticResultsForPlan(results, plan).filter(({ id }) =>
    currentArtifactIds.has(id)
  );
}

export function currentScreen6DiagnosticResultReviews(
  state: SixScreenWorkflowState,
): Screen6DiagnosticResultReview[] {
  const results = currentScreen6DiagnosticResults(state);
  if (!results.length) return [];
  const currentArtifactIds = new Set(
    state.artifacts.filter(({ screen, status }) =>
      screen === 6 && status === "current").map(({ snapshotId }) => snapshotId),
  );
  const { reviews } = screen6Collections(state);
  return reviewsForScreen6DiagnosticResults(reviews, results).filter(({ id }) =>
    currentArtifactIds.has(id)
  );
}

function appendScreen6ResultArtifact(
  state: SixScreenWorkflowState,
  profile: Screen6UncertaintyProfile,
  snapshotId: string,
) {
  state.artifacts.push({
    snapshotId,
    screen: 6,
    status: "current",
    dependencies: {
      studyRevision: profile.binding.studyRevision,
      identityFingerprint: profile.binding.identityFingerprint,
      eventCardSnapshotId:
        profile.binding.eventCardReference?.eventCardSnapshotId ?? null,
      selectedDesignSnapshotId:
        profile.binding.design?.selectedDesignSnapshotId ?? null,
      coeventSnapshotId: profile.binding.coEvent?.snapshotId ?? null,
      mechanismSnapshotId: profile.binding.mechanismInput?.snapshotId ?? null,
    },
    invalidatedAt: null,
    invalidationReason: null,
  });
}

/** Records one immutable, provenance-explicit researcher-supplied result. */
export function recordScreen6DiagnosticResult(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    resultId: string;
    cardId: string;
    expectedPlanFingerprint: string;
    expectedCardFingerprint: string;
    resultInput: Screen6DiagnosticResultInput;
    actor: "researcher_ui" | "model" | "system";
    submittedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.submittedAt, "Screen 6 result submittedAt");
  if (state.activeScreen !== 6) {
    throw new Error("A Screen 6 diagnostic result can be recorded only from Screen 6.");
  }
  requireScreen6Prerequisites(state);
  const profile = currentScreen6UncertaintyProfile(state);
  const plan = currentScreen6DiagnosticPlan(state);
  if (!profile || !plan) {
    throw new Error("Save the current Screen 6 diagnostic plan before recording results.");
  }
  const { plans, results, reviews, boundaries, dispositions, exports } =
    screen6Collections(state);
  const card = plan.cards.find(({ id }) => id === input.cardId);
  if (
    plan.planFingerprint !== input.expectedPlanFingerprint ||
    !card ||
    fingerprintSixScreenValue(card) !== input.expectedCardFingerprint ||
    results.some(({ id }) => id === input.resultId) ||
    state.artifacts.some(({ snapshotId }) => snapshotId === input.resultId)
  ) throw new Error("The Screen 6 diagnostic plan or result coordinate is stale.");
  const result = createScreen6DiagnosticResult({
    id: input.resultId,
    cardId: input.cardId,
    plan,
    resultInput: input.resultInput,
    priorResults: results,
    actor: input.actor,
    submittedAt: input.submittedAt,
  });
  const nextResults = [...results, result];
  validateScreen6DiagnosticResultCollections({
    plans,
    results: nextResults,
    reviews,
  });
  const priorResultIds = new Set(results.filter((candidate) =>
    candidate.binding.planSnapshotId === plan.snapshotId &&
    candidate.binding.cardId === card.id
  ).map(({ id }) => id));
  const priorReviewIds = new Set(reviews.filter((review) =>
    priorResultIds.has(review.resultReference.resultId)
  ).map(({ id }) => id));
  const downstreamBoundaryIds = new Set(boundaries.map(({ snapshotId }) =>
    snapshotId));
  const downstreamDispositionIds = new Set(dispositions.map(({ id }) => id));
  const downstreamExportIds = new Set(exports.map(({ id }) => id));
  state.artifacts = state.artifacts.map((artifact) =>
    artifact.screen === 6 && artifact.status === "current" &&
        (priorResultIds.has(artifact.snapshotId) ||
          priorReviewIds.has(artifact.snapshotId) ||
          downstreamBoundaryIds.has(artifact.snapshotId) ||
          downstreamDispositionIds.has(artifact.snapshotId) ||
          downstreamExportIds.has(artifact.snapshotId))
      ? {
          ...artifact,
          status: "archived" as const,
          invalidatedAt: input.submittedAt,
          invalidationReason: downstreamBoundaryIds.has(artifact.snapshotId) ||
              downstreamDispositionIds.has(artifact.snapshotId) ||
              downstreamExportIds.has(artifact.snapshotId)
            ? "A new diagnostic result changed the lineage behind this conditional claim view."
            : "A newer immutable result revision replaced this diagnostic-card result view.",
        }
      : artifact
  );
  state.screen6DiagnosticResults = nextResults;
  appendScreen6ResultArtifact(state, profile, result.id);
  appendChange(
    state,
    input.submittedAt,
    `Researcher recorded a ${result.provenance.kind.replaceAll("_", " ")} result for Screen 6 diagnostic ${card.id}; interpretation remains pending and no assumption, score, certificate, or claim boundary was created.`,
  );
  return { state, result: structuredClone(result) };
}

/** Appends one explicit researcher interpretation without changing the result. */
export function reviewScreen6DiagnosticResult(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    reviewId: string;
    resultId: string;
    expectedResultFingerprint: string;
    decision: Screen6DiagnosticResultReviewDecision;
    rationale: string;
    followUpActions: readonly string[];
    actor: "researcher_ui" | "model" | "system";
    reviewedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.reviewedAt, "Screen 6 result reviewedAt");
  if (state.activeScreen !== 6) {
    throw new Error("A Screen 6 diagnostic result can be reviewed only from Screen 6.");
  }
  requireScreen6Prerequisites(state);
  const profile = currentScreen6UncertaintyProfile(state);
  const currentResults = currentScreen6DiagnosticResults(state);
  const result = currentResults.find(({ id }) => id === input.resultId);
  if (
    !profile || !result ||
    result.resultFingerprint !== input.expectedResultFingerprint
  ) throw new Error("The Screen 6 diagnostic result changed before review.");
  const { plans, results, reviews, boundaries, dispositions, exports } =
    screen6Collections(state);
  if (
    reviews.some(({ id }) => id === input.reviewId) ||
    state.artifacts.some(({ snapshotId }) => snapshotId === input.reviewId)
  ) {
    throw new Error("The Screen 6 diagnostic-result review id was already used.");
  }
  const review = createScreen6DiagnosticResultReview({
    id: input.reviewId,
    result,
    priorReviews: reviews,
    decision: input.decision,
    rationale: input.rationale,
    followUpActions: input.followUpActions,
    actor: input.actor,
    reviewedAt: input.reviewedAt,
  });
  const nextReviews = [...reviews, review];
  validateScreen6DiagnosticResultCollections({
    plans,
    results,
    reviews: nextReviews,
  });
  const downstreamBoundaryIds = new Set(boundaries.map(({ snapshotId }) =>
    snapshotId));
  const downstreamDispositionIds = new Set(dispositions.map(({ id }) => id));
  const downstreamExportIds = new Set(exports.map(({ id }) => id));
  state.artifacts = state.artifacts.map((artifact) =>
    artifact.screen === 6 && artifact.status === "current" &&
        (downstreamBoundaryIds.has(artifact.snapshotId) ||
          downstreamDispositionIds.has(artifact.snapshotId) ||
          downstreamExportIds.has(artifact.snapshotId))
      ? {
          ...artifact,
          status: "archived" as const,
          invalidatedAt: input.reviewedAt,
          invalidationReason:
            "A new diagnostic interpretation changed the lineage behind this conditional claim view.",
        }
      : artifact
  );
  state.screen6DiagnosticResultReviews = nextReviews;
  appendScreen6ResultArtifact(state, profile, review.id);
  appendChange(
    state,
    input.reviewedAt,
    `Researcher marked Screen 6 diagnostic result ${result.id} ${review.decision.replaceAll("_", " ")}; the result remains immutable and no assumption, score, certificate, or claim boundary was created.`,
  );
  return {
    state,
    result: structuredClone(result),
    review: structuredClone(review),
  };
}

export function currentScreen6ConditionalClaimBoundary(
  state: SixScreenWorkflowState,
): Screen6ConditionalClaimBoundary | null {
  const profile = currentScreen6UncertaintyProfile(state);
  const plan = currentScreen6DiagnosticPlan(state);
  if (!profile || !plan) return null;
  const currentArtifactIds = new Set(
    state.artifacts.filter(({ screen, status }) =>
      screen === 6 && status === "current").map(({ snapshotId }) => snapshotId),
  );
  const { results, reviews, boundaries } = screen6Collections(state);
  return [...boundaries].reverse().find((boundary) =>
    currentArtifactIds.has(boundary.snapshotId) &&
    boundary.binding.profileSnapshotId === profile.snapshotId &&
    boundary.binding.profileFingerprint === profile.profileFingerprint &&
    boundary.binding.planSnapshotId === plan.snapshotId &&
    boundary.binding.planFingerprint === plan.planFingerprint &&
    boundary.binding.resultHistoryLength === results.length &&
    boundary.binding.reviewHistoryLength === reviews.length
  ) ?? null;
}

export function currentScreen6ResearchPlanningDisposition(
  state: SixScreenWorkflowState,
): Screen6ResearchPlanningDisposition | null {
  const boundary = currentScreen6ConditionalClaimBoundary(state);
  if (!boundary) return null;
  const currentArtifactIds = new Set(
    state.artifacts.filter(({ screen, status }) =>
      screen === 6 && status === "current").map(({ snapshotId }) => snapshotId),
  );
  const { dispositions } = screen6Collections(state);
  return [...dispositions].reverse().find((disposition) =>
    currentArtifactIds.has(disposition.id) &&
    disposition.boundaryReference.snapshotId === boundary.snapshotId &&
    disposition.boundaryReference.boundaryFingerprint ===
      boundary.boundaryFingerprint
  ) ?? null;
}

/** Creates a prospective claim boundary without certifying the design. */
export function saveScreen6ConditionalClaimBoundary(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    snapshotId: string;
    expectedPlanFingerprint: string;
    claimInput: Screen6ClaimBoundaryInput;
    actor: "researcher_ui" | "model" | "system";
    createdAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.createdAt, "Screen 6 claim boundary createdAt");
  if (state.activeScreen !== 6) {
    throw new Error("A Screen 6 conditional claim boundary can be saved only from Screen 6.");
  }
  requireScreen6Prerequisites(state);
  const profile = currentScreen6UncertaintyProfile(state);
  const plan = currentScreen6DiagnosticPlan(state);
  if (!profile || !plan) {
    throw new Error("Save the current Screen 6 diagnostic plan before defining a claim boundary.");
  }
  if (plan.planFingerprint !== input.expectedPlanFingerprint) {
    throw new Error("The Screen 6 diagnostic plan changed before claim-boundary creation.");
  }
  const {
    profiles,
    plans,
    results,
    reviews,
    boundaries,
    dispositions,
    exports,
  } =
    screen6Collections(state);
  if (
    boundaries.length >= SIX_SCREEN_CLAIM_BOUNDARY_MAX_REVISIONS ||
    boundaries.some(({ snapshotId }) => snapshotId === input.snapshotId) ||
    state.artifacts.some(({ snapshotId }) => snapshotId === input.snapshotId)
  ) throw new Error("Screen 6 claim-boundary history reached capacity or reused an id.");
  const boundary = createScreen6ConditionalClaimBoundary({
    snapshotId: input.snapshotId,
    profile,
    plan,
    claimInput: input.claimInput,
    resultHistory: results,
    reviewHistory: reviews,
    priorBoundaries: boundaries,
    actor: input.actor,
    createdAt: input.createdAt,
  });
  const nextBoundaries = [...boundaries, boundary];
  validateScreen6ClaimBoundaryCollections({
    profiles,
    plans,
    results,
    reviews,
    boundaries: nextBoundaries,
    dispositions,
  });
  const priorBoundaryIds = new Set(boundaries.map(({ snapshotId }) =>
    snapshotId));
  const priorDispositionIds = new Set(dispositions.map(({ id }) => id));
  const priorExportIds = new Set(exports.map(({ id }) => id));
  state.artifacts = state.artifacts.map((artifact) =>
    artifact.screen === 6 && artifact.status === "current" &&
        (priorBoundaryIds.has(artifact.snapshotId) ||
          priorDispositionIds.has(artifact.snapshotId) ||
          priorExportIds.has(artifact.snapshotId))
      ? {
          ...artifact,
          status: "archived" as const,
          invalidatedAt: input.createdAt,
          invalidationReason:
            "A newer researcher-owned conditional claim boundary replaced this claim view.",
        }
      : artifact
  );
  state.screen6ConditionalClaimBoundaries = nextBoundaries;
  appendScreen6ResultArtifact(state, profile, boundary.snapshotId);
  appendChange(
    state,
    input.createdAt,
    `Researcher defined a prospective ${boundary.intendedClaim.claimLevel.replaceAll("_", " ")} boundary with ${boundary.unresolvedHighConsequenceIssues.length} retained high-consequence issue${boundary.unresolvedHighConsequenceIssues.length === 1 ? "" : "s"}; no causal certification or final export was created.`,
  );
  return { state, boundary: structuredClone(boundary) };
}

/** Records one of the three manual-defined researcher planning dispositions. */
export function recordScreen6ResearchPlanningDisposition(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    dispositionId: string;
    expectedBoundaryFingerprint: string;
    decision: Screen6ResearchPlanningDispositionDecision;
    rationale: string;
    specifiedRevisions: readonly string[];
    actor: "researcher_ui" | "model" | "system";
    decidedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.decidedAt, "Screen 6 disposition decidedAt");
  if (state.activeScreen !== 6) {
    throw new Error("A Screen 6 research disposition can be recorded only from Screen 6.");
  }
  requireScreen6Prerequisites(state);
  const profile = currentScreen6UncertaintyProfile(state);
  const boundary = currentScreen6ConditionalClaimBoundary(state);
  if (
    !profile || !boundary ||
    boundary.boundaryFingerprint !== input.expectedBoundaryFingerprint
  ) throw new Error("The Screen 6 conditional claim boundary changed before disposition.");
  const { profiles, plans, results, reviews, boundaries, dispositions } =
    screen6Collections(state);
  if (
    dispositions.length >= SIX_SCREEN_RESEARCH_DISPOSITION_MAX_RECORDS ||
    dispositions.some(({ id }) => id === input.dispositionId) ||
    state.artifacts.some(({ snapshotId }) =>
      snapshotId === input.dispositionId)
  ) throw new Error("Screen 6 disposition history reached capacity or reused an id.");
  const disposition = createScreen6ResearchPlanningDisposition({
    id: input.dispositionId,
    boundary,
    priorDispositions: dispositions,
    decision: input.decision,
    rationale: input.rationale,
    specifiedRevisions: input.specifiedRevisions,
    actor: input.actor,
    decidedAt: input.decidedAt,
  });
  const nextDispositions = [...dispositions, disposition];
  validateScreen6ClaimBoundaryCollections({
    profiles,
    plans,
    results,
    reviews,
    boundaries,
    dispositions: nextDispositions,
  });
  state.screen6ResearchPlanningDispositions = nextDispositions;
  appendScreen6ResultArtifact(state, profile, disposition.id);
  appendChange(
    state,
    input.decidedAt,
    `Researcher recorded the Screen 6 planning disposition ${disposition.decision.replaceAll("_", " ")}; retained limitations remain visible and no design mutation, causal certification, or final export occurred.`,
  );
  return {
    state,
    boundary: structuredClone(boundary),
    disposition: structuredClone(disposition),
  };
}

export function currentScreen6ResearchExport(
  state: SixScreenWorkflowState,
): Screen6ResearchExport | null {
  const boundary = currentScreen6ConditionalClaimBoundary(state);
  const disposition = currentScreen6ResearchPlanningDisposition(state);
  if (!boundary || !disposition) return null;
  const currentArtifactIds = new Set(
    state.artifacts.filter(({ screen, status }) =>
      screen === 6 && status === "current").map(({ snapshotId }) => snapshotId),
  );
  const { exports } = screen6Collections(state);
  return [...exports].reverse().find((record) =>
    currentArtifactIds.has(record.id) &&
    record.binding.boundarySnapshotId === boundary.snapshotId &&
    record.binding.boundaryFingerprint === boundary.boundaryFingerprint &&
    record.binding.dispositionId === disposition.id &&
    record.binding.dispositionFingerprint ===
      disposition.dispositionFingerprint
  ) ?? null;
}

/** Creates the explicit source-linked CredibilityPlan and final DesignRecord export. */
export function createScreen6ResearchExportRecord(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    exportId: string;
    expectedDispositionFingerprint: string;
    actor: "researcher_ui" | "model" | "system";
    exportedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.exportedAt, "Screen 6 export exportedAt");
  if (state.activeScreen !== 6) {
    throw new Error("The Screen 6 research export can be created only from Screen 6.");
  }
  requireScreen6Prerequisites(state);
  const profile = currentScreen6UncertaintyProfile(state);
  const plan = currentScreen6DiagnosticPlan(state);
  const boundary = currentScreen6ConditionalClaimBoundary(state);
  const disposition = currentScreen6ResearchPlanningDisposition(state);
  if (!profile || !plan || !boundary || !disposition) {
    throw new Error(
      "Record the current Screen 6 claim boundary and research-planning disposition before export.",
    );
  }
  if (
    disposition.dispositionFingerprint !==
      input.expectedDispositionFingerprint
  ) throw new Error("The Screen 6 research-planning disposition changed before export.");
  const { exports } = screen6Collections(state);
  if (
    exports.length >= SIX_SCREEN_RESEARCH_EXPORT_MAX_RECORDS ||
    exports.some(({ id }) => id === input.exportId) ||
    state.artifacts.some(({ snapshotId }) => snapshotId === input.exportId) ||
    currentScreen6ResearchExport(state)
  ) throw new Error("Screen 6 research-export history reached capacity or reused current lineage.");
  const researchExport = buildScreen6ResearchExport({
    state,
    exportId: input.exportId,
    profile,
    plan,
    boundary,
    disposition,
    priorExports: exports,
    actor: input.actor,
    exportedAt: input.exportedAt,
  });
  state.screen6ResearchExports = [...exports, researchExport];
  validateScreen6ResearchExportCollection(state);
  appendScreen6ResultArtifact(state, profile, researchExport.id);
  appendChange(
    state,
    input.exportedAt,
    `Researcher explicitly created a ${researchExport.completeness.status} source-linked Screen 6 CredibilityPlan and DesignRecord export; unresolved items remain labeled and no estimate, score, attribution upgrade, design mutation, or causal certificate was created.`,
  );
  return {
    state,
    researchExport: structuredClone(researchExport),
  };
}

export function saveMechanismLiteraturePlan(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    snapshotId: string;
    planInput: MechanismLiteraturePlanInput;
    capabilities: {
      openalex: SourceCapability;
      crossref: SourceCapability;
    };
    savedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.savedAt, "Screen 5 literature plan savedAt");
  if (state.activeScreen !== 5) {
    throw new Error("A mechanism literature plan requires Screen 5 to be open.");
  }
  const { report, confirmed, review } =
    requireLegacyScreen5ExecutionPrerequisites(state);
  const { plans } = mechanismLiteratureCollections(state);
  if (plans.length >= SIX_SCREEN_MECHANISM_LITERATURE_MAX_REVISIONS) {
    throw new Error("Screen 5 literature-plan history reached its bounded revision limit.");
  }
  if (plans.some(({ snapshotId }) => snapshotId === input.snapshotId)) {
    throw new Error("Screen 5 literature-plan snapshot id was already used.");
  }
  const designDecision = currentCausalDesignDecision(state);
  const designSet = designDecision ? currentCausalDesignSet(state) : null;
  const coEventMatrix = currentCoEventSearchMatrix(state);
  const coEventExecution = currentCoEventSearchExecution(state);
  const currentCoEventCandidateIds = new Set(
    coEventExecution?.candidateOccurrenceIds ?? [],
  );
  const latestRelationByCandidate = new Map<string, CoEventRelationReview>();
  for (const relationReview of state.coEventRelationReviews ?? []) {
    if (currentCoEventCandidateIds.has(relationReview.binding.candidateId)) {
      latestRelationByCandidate.set(
        relationReview.binding.candidateId,
        relationReview,
      );
    }
  }
  const coEventRelationReviews = [...latestRelationByCandidate.values()];
  const coEventRelationAnalysisComplete = !report.limitations.some(
    ({ code }) => code === "coevent_relations_not_assessed",
  );
  const plan = createMechanismLiteraturePlan({
    snapshotId: input.snapshotId,
    ordinal: plans.length + 1,
    planInput: input.planInput,
    study: state.study,
    confirmedShock: confirmed,
    eventCard: review.lockedEventCard!,
    eventCardReview: review,
    designSet,
    designDecision,
    coEventMatrix,
    coEventExecution,
    coEventRelationReviews,
    coEventRelationAnalysisComplete,
    capabilities: input.capabilities,
    createdAt: input.savedAt,
  });
  state.artifacts = state.artifacts.map((artifact) =>
    artifact.screen === 5 && artifact.status === "current"
      ? {
          ...artifact,
          status: "archived" as const,
          invalidatedAt: input.savedAt,
          invalidationReason:
            "The researcher saved a newer Screen 5 intake and literature plan.",
        }
      : artifact
  );
  invalidateArtifacts(
    state,
    [6],
    "A newer Screen 5 literature plan changed a downstream dependency.",
    input.savedAt,
  );
  state.mechanismLiteraturePlans = [...plans, plan];
  state.artifacts.push({
    snapshotId: plan.snapshotId,
    screen: 5,
    status: "current",
    dependencies: {
      studyRevision: state.study.revision,
      identityFingerprint: confirmed.identityFingerprint,
      eventCardSnapshotId:
        plan.binding.eventCardReference.eventCardSnapshotId,
      selectedDesignSnapshotId:
        designDecision?.selectedDesign?.snapshotId ?? null,
      coeventSnapshotId: plan.binding.coEventSnapshotId,
      mechanismSnapshotId: plan.snapshotId,
    },
    invalidatedAt: null,
    invalidationReason: null,
  });
  appendChange(
    state,
    input.savedAt,
    `Screen 5 saved a three-branch literature plan with ${plan.policyPremises.length} reviewed policy premise${plan.policyPremises.length === 1 ? "" : "s"}; no scholarly query or mechanism analysis was claimed.`,
  );
  return { state, plan: structuredClone(plan) };
}

export function recordMechanismLiteratureExecution(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    executionSnapshotId: string;
    packetSnapshotId: string;
    executionPlan: MechanismLiteratureExecutionPlan;
    attempt: MechanismLiteratureProviderAttempt | null;
    records: ScholarlyMetadataRecord[];
    recordedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.recordedAt, "Screen 5 execution recordedAt");
  if (state.activeScreen !== 5) {
    throw new Error("Literature execution requires Screen 5 to be open.");
  }
  requireLegacyScreen5ExecutionPrerequisites(state);
  const literaturePlan = currentMechanismLiteraturePlan(state);
  if (!literaturePlan) {
    throw new Error("Literature execution requires a current saved Screen 5 plan.");
  }
  validateMechanismLiteratureExecutionPlan(
    input.executionPlan,
    literaturePlan,
  );
  if (input.attempt) validateMechanismLiteratureProviderAttempt(input.attempt);
  input.records.forEach(validateScholarlyMetadataRecord);
  if (
    input.attempt && input.records.some((record) =>
      record.providerId !== input.attempt?.providerId ||
      record.source.attemptId !== input.attempt.id ||
      record.source.stepId !== input.attempt.stepId ||
      record.source.rowId !== input.attempt.rowId ||
      record.source.branch !== input.attempt.branch) ||
    (!input.attempt && input.records.length)
  ) throw new Error("Screen 5 scholarly records do not match the provider attempt.");

  const {
    executionPlans,
    executions,
    records,
    packets,
  } = mechanismLiteratureExecutionCollections(state);
  if (
    executions.length >= SIX_SCREEN_MECHANISM_LITERATURE_MAX_EXECUTIONS ||
    packets.length >= SIX_SCREEN_MECHANISM_LITERATURE_MAX_EVIDENCE_PACKETS ||
    executions.some(({ snapshotId }) =>
      snapshotId === input.executionSnapshotId) ||
    packets.some(({ snapshotId }) => snapshotId === input.packetSnapshotId)
  ) throw new Error("Screen 5 execution history reached capacity or reused an id.");
  const existingPlan = executionPlans.find((plan) =>
    plan.literaturePlanSnapshotId === literaturePlan.snapshotId);
  if (
    existingPlan &&
    (existingPlan.id !== input.executionPlan.id ||
      existingPlan.planFingerprint !== input.executionPlan.planFingerprint)
  ) throw new Error("The Screen 5 literature plan already has a different execution plan.");
  if (
    !existingPlan && executionPlans.length >=
      SIX_SCREEN_MECHANISM_LITERATURE_MAX_EXECUTION_PLANS
  ) throw new Error("Screen 5 execution-plan history reached capacity.");
  const previous = currentMechanismLiteratureExecution(state);
  if (previous?.status === "complete") {
    throw new Error("The current Screen 5 metadata plan is already complete.");
  }
  const recordMap = new Map(records.map((record) => [record.id, record]));
  const newRecords: ScholarlyMetadataRecord[] = [];
  for (const record of input.records) {
    const existing = recordMap.get(record.id);
    if (existing) {
      if (existing.recordFingerprint !== record.recordFingerprint) {
        throw new Error("A scholarly record id was reused for different metadata.");
      }
      continue;
    }
    recordMap.set(record.id, record);
    newRecords.push(record);
  }
  if (
    recordMap.size > SIX_SCREEN_MECHANISM_LITERATURE_MAX_METADATA_RECORDS
  ) throw new Error("Screen 5 scholarly metadata reached its bounded capacity.");
  const execution = createMechanismLiteratureExecution({
    snapshotId: input.executionSnapshotId,
    ordinal: (previous?.ordinal ?? 0) + 1,
    literaturePlan,
    executionPlan: existingPlan ?? input.executionPlan,
    previous,
    attempt: input.attempt,
    newMetadataRecordIds: input.records.map(({ id }) => id),
    recordedAt: input.recordedAt,
  });
  const previousPacket = previous
    ? packets.find((packet) =>
      packet.binding.executionSnapshotId === previous.snapshotId) ?? null
    : null;
  const cumulativeRecords = execution.scholarlyMetadataRecordIds.map((id) => {
    const record = recordMap.get(id);
    if (!record) throw new Error("Screen 5 execution lost scholarly metadata.");
    return record;
  });
  const packet = createScholarlyEvidencePacket({
    snapshotId: input.packetSnapshotId,
    ordinal: (previousPacket?.ordinal ?? 0) + 1,
    literaturePlan,
    execution,
    previous: previousPacket,
    records: cumulativeRecords,
    createdAt: input.recordedAt,
  });
  const nextExecutionPlans = existingPlan
    ? executionPlans
    : [...executionPlans, input.executionPlan];
  const nextExecutions = [...executions, execution];
  const nextRecords = [...records, ...newRecords];
  const nextPackets = [...packets, packet];
  validateMechanismLiteratureExecutionCollections({
    literaturePlans: state.mechanismLiteraturePlans ?? [],
    executionPlans: nextExecutionPlans,
    executions: nextExecutions,
    records: nextRecords,
    packets: nextPackets,
  });
  const priorExecutionIds = new Set(executions.map(({ snapshotId }) => snapshotId));
  state.artifacts = state.artifacts.map((artifact) =>
    artifact.screen === 5 && artifact.status === "current" &&
        priorExecutionIds.has(artifact.snapshotId)
      ? {
          ...artifact,
          status: "archived" as const,
          invalidatedAt: input.recordedAt,
          invalidationReason:
            "A newer bounded Screen 5 metadata step extended this evidence packet.",
        }
      : artifact
  );
  invalidateArtifacts(
    state,
    [6],
    "New Screen 5 literature-execution evidence changed a downstream dependency.",
    input.recordedAt,
  );
  state.mechanismLiteratureExecutionPlans = nextExecutionPlans;
  state.mechanismLiteratureExecutions = nextExecutions;
  state.scholarlyMetadataRecords = nextRecords;
  state.scholarlyEvidencePackets = nextPackets;
  state.artifacts.push({
    snapshotId: execution.snapshotId,
    screen: 5,
    status: "current",
    dependencies: {
      studyRevision: literaturePlan.binding.studyRevision,
      identityFingerprint: literaturePlan.binding.identityFingerprint,
      eventCardSnapshotId:
        literaturePlan.binding.eventCardReference.eventCardSnapshotId,
      selectedDesignSnapshotId:
        currentCausalDesignDecision(state)?.selectedDesign?.snapshotId ?? null,
      coeventSnapshotId: literaturePlan.binding.coEventSnapshotId,
      mechanismSnapshotId: execution.snapshotId,
    },
    invalidatedAt: null,
    invalidationReason: null,
  });
  appendChange(
    state,
    input.recordedAt,
    input.attempt
      ? `Screen 5 recorded ${input.attempt.providerId} as ${input.attempt.outcome.replaceAll("_", " ")} and retained an immutable metadata-only evidence packet.`
      : "Screen 5 recorded that no tested scholarly metadata route was executable; no no-match or literature finding was claimed.",
  );
  return {
    state,
    literaturePlan: structuredClone(literaturePlan),
    executionPlan: structuredClone(existingPlan ?? input.executionPlan),
    execution: structuredClone(execution),
    records: structuredClone(newRecords),
    packet: structuredClone(packet),
  };
}

export function recordScholarlyDocumentAcquisition(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    packetSnapshotId: string;
    acquisition: ScholarlyDocumentAcquisition;
    recordedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(
    input.recordedAt,
    "Scholarly document acquisition recordedAt",
  );
  if (state.activeScreen !== 5) {
    throw new Error("Scholarly document acquisition requires Screen 5 to be open.");
  }
  requireLegacyScreen5ExecutionPrerequisites(state);
  validateScholarlyDocumentAcquisition(input.acquisition);
  const literaturePlan = currentMechanismLiteraturePlan(state);
  const execution = currentMechanismLiteratureExecution(state);
  const metadataPacket = currentScholarlyEvidencePacket(state);
  if (!literaturePlan || !execution || execution.status !== "complete" ||
      !metadataPacket) {
    throw new Error(
      "Scholarly document acquisition requires the completed current metadata packet.",
    );
  }
  const {
    records,
    packets,
    documentAcquisitions,
    passagePackets,
  } = mechanismLiteratureExecutionCollections(state);
  const metadataRecords = execution.scholarlyMetadataRecordIds.map((id) => {
    const record = records.find(({ id: found }) => found === id);
    if (!record) throw new Error("Scholarly document acquisition lost metadata.");
    return record;
  });
  const priorAcquisitions = documentAcquisitions.filter((acquisition) =>
    acquisition.plan.binding.metadataPacketSnapshotId === metadataPacket.snapshotId
  );
  const priorPackets = passagePackets.filter((packet) =>
    packet.binding.metadataPacketSnapshotId === metadataPacket.snapshotId
  );
  if (
    priorAcquisitions.length >= SIX_SCREEN_SCHOLARLY_DOCUMENT_MAX_ACQUISITIONS ||
    documentAcquisitions.some(({ id }) => id === input.acquisition.id) ||
    passagePackets.some(({ snapshotId }) =>
      snapshotId === input.packetSnapshotId)
  ) throw new Error("Scholarly document history reached capacity or reused an id.");
  if (
    input.acquisition.plan.binding.literaturePlanSnapshotId !==
      literaturePlan.snapshotId ||
    input.acquisition.plan.binding.literaturePlanFingerprint !==
      literaturePlan.planFingerprint ||
    input.acquisition.plan.binding.metadataExecutionSnapshotId !==
      execution.snapshotId ||
    input.acquisition.plan.binding.metadataExecutionFingerprint !==
      execution.executionFingerprint ||
    input.acquisition.plan.binding.metadataPacketSnapshotId !==
      metadataPacket.snapshotId ||
    input.acquisition.plan.binding.metadataPacketFingerprint !==
      metadataPacket.packetFingerprint ||
    input.acquisition.plan.ordinal !== priorAcquisitions.length + 1 ||
    input.acquisition.plan.binding.previousAcquisitionId !==
      (priorAcquisitions.at(-1)?.id ?? null) ||
    input.acquisition.completedAt !== input.recordedAt
  ) throw new Error("Scholarly document acquisition has a stale parent binding.");
  const nextAcquisitions = [...documentAcquisitions, input.acquisition];
  const cumulative = [...priorAcquisitions, input.acquisition];
  const packet = createScholarlyPassagePacket({
    snapshotId: input.packetSnapshotId,
    metadataPacket,
    acquisition: input.acquisition,
    previous: priorPackets.at(-1) ?? null,
    acquisitions: cumulative,
    createdAt: input.recordedAt,
  });
  const nextPassagePackets = [...passagePackets, packet];
  validateScholarlyDocumentCollections({
    literaturePlans: state.mechanismLiteraturePlans ?? [],
    metadataExecutions: state.mechanismLiteratureExecutions ?? [],
    metadataRecords: records,
    metadataPackets: packets,
    acquisitions: nextAcquisitions,
    passagePackets: nextPassagePackets,
  });
  const priorPacketIds = new Set(priorPackets.map(({ snapshotId }) => snapshotId));
  state.artifacts = state.artifacts.map((artifact) =>
    artifact.screen === 5 && artifact.status === "current" &&
        priorPacketIds.has(artifact.snapshotId)
      ? {
          ...artifact,
          status: "archived" as const,
          invalidatedAt: input.recordedAt,
          invalidationReason:
            "A newer bounded scholarly-document attempt extended the passage packet.",
        }
      : artifact
  );
  invalidateArtifacts(
    state,
    [6],
    "New inspected-passage evidence changed a downstream dependency.",
    input.recordedAt,
  );
  state.scholarlyDocumentAcquisitions = nextAcquisitions;
  state.scholarlyPassagePackets = nextPassagePackets;
  state.artifacts.push({
    snapshotId: packet.snapshotId,
    screen: 5,
    status: "current",
    dependencies: {
      studyRevision: literaturePlan.binding.studyRevision,
      identityFingerprint: literaturePlan.binding.identityFingerprint,
      eventCardSnapshotId:
        literaturePlan.binding.eventCardReference.eventCardSnapshotId,
      selectedDesignSnapshotId:
        currentCausalDesignDecision(state)?.selectedDesign?.snapshotId ?? null,
      coeventSnapshotId: literaturePlan.binding.coEventSnapshotId,
      mechanismSnapshotId: packet.snapshotId,
    },
    invalidatedAt: null,
    invalidationReason: null,
  });
  appendChange(
    state,
    input.recordedAt,
    input.acquisition.document
      ? `Screen 5 retained one ${input.acquisition.document.inspectionStatus.replaceAll("_", " ")} scholarly passage with exact document/version lineage; no detailed claim or mechanism was created.`
      : `Screen 5 recorded ${input.acquisition.outcome.replaceAll("_", " ")} for one exact scholarly-document request without inferring document contents.`,
  );
  return {
    state,
    literaturePlan: structuredClone(literaturePlan),
    execution: structuredClone(execution),
    metadataPacket: structuredClone(metadataPacket),
    acquisition: structuredClone(input.acquisition),
    packet: structuredClone(packet),
  };
}

function currentScholarlyClaimContext(state: SixScreenWorkflowState) {
  if (state.activeScreen !== 5) {
    throw new Error("Scholarly claim work requires Screen 5 to be open.");
  }
  requireLegacyScreen5ExecutionPrerequisites(state);
  const literaturePlan = currentMechanismLiteraturePlan(state);
  const execution = currentMechanismLiteratureExecution(state);
  const metadataPacket = currentScholarlyEvidencePacket(state);
  const passagePacket = currentScholarlyPassagePacket(state);
  if (
    !literaturePlan || !execution || execution.status !== "complete" ||
    !metadataPacket || !passagePacket
  ) {
    throw new Error(
      "Scholarly claim work requires the current completed metadata and passage packets.",
    );
  }
  const collections = mechanismLiteratureExecutionCollections(state);
  const extractions = collections.claimExtractions.filter((extraction) =>
    extraction.binding.metadataPacketSnapshotId === metadataPacket.snapshotId &&
    extraction.binding.metadataPacketFingerprint === metadataPacket.packetFingerprint
  );
  const extractionIds = new Set(extractions.map(({ id }) => id));
  const reviews = collections.claimReviews.filter((review) =>
    extractionIds.has(review.extractionReference.extractionId)
  );
  const packets = collections.claimPackets.filter((packet) =>
    packet.binding.metadataPacketSnapshotId === metadataPacket.snapshotId &&
    packet.binding.metadataPacketFingerprint === metadataPacket.packetFingerprint
  );
  return {
    literaturePlan,
    metadataPacket,
    passagePacket,
    collections,
    extractions,
    reviews,
    packets,
  };
}

function appendScholarlyClaimPacketArtifact(
  state: SixScreenWorkflowState,
  literaturePlan: MechanismLiteraturePlan,
  packet: ScholarlyClaimPacket,
  priorPackets: readonly ScholarlyClaimPacket[],
  recordedAt: string,
) {
  const priorPacketIds = new Set(priorPackets.map(({ snapshotId }) => snapshotId));
  const synthesisInputIds = new Set(
    (state.mechanismSynthesisInputPackets ?? []).map(({ snapshotId }) =>
      snapshotId
    ),
  );
  state.artifacts = state.artifacts.map((artifact) =>
    artifact.screen === 5 && artifact.status === "current" &&
        (priorPacketIds.has(artifact.snapshotId) ||
          synthesisInputIds.has(artifact.snapshotId))
      ? {
          ...artifact,
          status: "archived" as const,
          invalidatedAt: recordedAt,
          invalidationReason:
            "A newer explicit scholarly claim action extended the claim packet and superseded any prior synthesis-input freeze.",
        }
      : artifact
  );
  invalidateArtifacts(
    state,
    [6],
    "Researcher-authored scholarly claim state changed a downstream dependency.",
    recordedAt,
  );
  state.artifacts.push({
    snapshotId: packet.snapshotId,
    screen: 5,
    status: "current",
    dependencies: {
      studyRevision: literaturePlan.binding.studyRevision,
      identityFingerprint: literaturePlan.binding.identityFingerprint,
      eventCardSnapshotId:
        literaturePlan.binding.eventCardReference.eventCardSnapshotId,
      selectedDesignSnapshotId:
        currentCausalDesignDecision(state)?.selectedDesign?.snapshotId ?? null,
      coeventSnapshotId: literaturePlan.binding.coEventSnapshotId,
      mechanismSnapshotId: packet.snapshotId,
    },
    invalidatedAt: null,
    invalidationReason: null,
  });
}

/**
 * Appends one researcher-authored structured extraction from an exact eligible
 * scholarly passage. No model, network request or mechanism synthesis occurs.
 */
export function recordScholarlyClaimExtraction(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    extractionId: string;
    packetSnapshotId: string;
    passageId: string;
    expectedPassageFingerprint: string;
    fields: ScholarlyClaimFieldsDraft;
    actor: "researcher_ui" | "model" | "system";
    recordedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.recordedAt, "Scholarly extraction recordedAt");
  const context = currentScholarlyClaimContext(state);
  if (
    context.collections.claimExtractions.length >=
      SIX_SCREEN_SCHOLARLY_CLAIM_MAX_EXTRACTIONS ||
    context.collections.claimExtractions.some(({ id }) =>
      id === input.extractionId) ||
    context.collections.claimPackets.some(({ snapshotId }) =>
      snapshotId === input.packetSnapshotId)
  ) throw new Error("Scholarly extraction history reached capacity or reused an id.");
  const reference = context.passagePacket.passageReferences.find((item) =>
    item.passageId === input.passageId
  );
  if (
    !reference || reference.passageFingerprint !==
      input.expectedPassageFingerprint ||
    reference.detailedClaimUse !== "eligible_for_later_researcher_review"
  ) throw new Error("The scholarly passage changed or is not claim-eligible.");
  const acquisition = context.collections.documentAcquisitions.find((item) =>
    item.passage?.id === input.passageId &&
    item.passage.passageFingerprint === input.expectedPassageFingerprint
  );
  if (!acquisition) {
    throw new Error("The scholarly extraction lost its document acquisition.");
  }
  const extraction = createScholarlyClaimExtraction({
    extractionId: input.extractionId,
    passagePacket: context.passagePacket,
    acquisition,
    priorExtractions: context.collections.claimExtractions,
    fields: input.fields,
    actor: input.actor,
    extractedAt: input.recordedAt,
  });
  const currentExtractions = [...context.extractions, extraction];
  const packet = createScholarlyClaimPacket({
    snapshotId: input.packetSnapshotId,
    passagePacket: context.passagePacket,
    previous: context.packets.at(-1) ?? null,
    changeReference: {
      kind: "claim_extracted",
      id: extraction.id,
      fingerprint: extraction.extractionFingerprint,
    },
    extractions: currentExtractions,
    reviews: context.reviews,
    createdAt: input.recordedAt,
  });
  const nextExtractions = [
    ...context.collections.claimExtractions,
    extraction,
  ];
  const nextPackets = [...context.collections.claimPackets, packet];
  validateScholarlyClaimCollections({
    acquisitions: context.collections.documentAcquisitions,
    passagePackets: context.collections.passagePackets,
    extractions: nextExtractions,
    reviews: context.collections.claimReviews,
    claimPackets: nextPackets,
  });
  state.scholarlyClaimExtractions = nextExtractions;
  state.scholarlyClaimPackets = nextPackets;
  appendScholarlyClaimPacketArtifact(
    state,
    context.literaturePlan,
    packet,
    context.packets,
    input.recordedAt,
  );
  appendChange(
    state,
    input.recordedAt,
    `Researcher authored one structured scholarly claim from exact passage ${input.passageId}; it remains pending explicit review and no mechanism was created.`,
  );
  return {
    state,
    extraction: structuredClone(extraction),
    packet: structuredClone(packet),
  };
}

/**
 * Appends one explicit accept/reject/defer/correct decision. Corrected fields
 * remain researcher supplied and the immutable original extraction is retained.
 */
export function reviewScholarlyClaim(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    reviewId: string;
    packetSnapshotId: string;
    extractionId: string;
    expectedExtractionFingerprint: string;
    decision: ScholarlyClaimReviewDecision;
    rationale: string;
    actor: "researcher_ui" | "model" | "system";
    reviewedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.reviewedAt, "Scholarly claim reviewedAt");
  const context = currentScholarlyClaimContext(state);
  if (
    context.collections.claimReviews.length >=
      SIX_SCREEN_SCHOLARLY_CLAIM_MAX_REVIEWS ||
    context.collections.claimReviews.some(({ id }) => id === input.reviewId) ||
    context.collections.claimPackets.some(({ snapshotId }) =>
      snapshotId === input.packetSnapshotId)
  ) throw new Error("Scholarly claim review history reached capacity or reused an id.");
  const extraction = context.extractions.find(({ id }) =>
    id === input.extractionId
  );
  if (
    !extraction || extraction.extractionFingerprint !==
      input.expectedExtractionFingerprint ||
    !context.passagePacket.passageReferences.some((reference) =>
      reference.passageId === extraction.passageReference.passageId &&
      reference.passageFingerprint ===
        extraction.passageReference.passageFingerprint)
  ) throw new Error("The scholarly extraction changed before review.");
  const review = createScholarlyClaimReview({
    reviewId: input.reviewId,
    extraction,
    priorReviews: context.collections.claimReviews,
    decision: input.decision,
    rationale: input.rationale,
    actor: input.actor,
    reviewedAt: input.reviewedAt,
  });
  const currentReviews = [...context.reviews, review];
  const packet = createScholarlyClaimPacket({
    snapshotId: input.packetSnapshotId,
    passagePacket: context.passagePacket,
    previous: context.packets.at(-1) ?? null,
    changeReference: {
      kind: "claim_reviewed",
      id: review.id,
      fingerprint: review.reviewFingerprint,
    },
    extractions: context.extractions,
    reviews: currentReviews,
    createdAt: input.reviewedAt,
  });
  const nextReviews = [...context.collections.claimReviews, review];
  const nextPackets = [...context.collections.claimPackets, packet];
  validateScholarlyClaimCollections({
    acquisitions: context.collections.documentAcquisitions,
    passagePackets: context.collections.passagePackets,
    extractions: context.collections.claimExtractions,
    reviews: nextReviews,
    claimPackets: nextPackets,
  });
  state.scholarlyClaimReviews = nextReviews;
  state.scholarlyClaimPackets = nextPackets;
  appendScholarlyClaimPacketArtifact(
    state,
    context.literaturePlan,
    packet,
    context.packets,
    input.reviewedAt,
  );
  appendChange(
    state,
    input.reviewedAt,
    `Researcher marked scholarly claim ${extraction.id} ${review.decision}; the source evidence was preserved and no mechanism was created.`,
  );
  return {
    state,
    extraction: structuredClone(extraction),
    review: structuredClone(review),
    packet: structuredClone(packet),
  };
}

/**
 * Freezes the current accepted scholarly claims and reviewed upstream premises
 * as deterministic synthesis inputs. It performs no retrieval or synthesis.
 */
export function prepareMechanismSynthesisInput(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    snapshotId: string;
    expectedClaimPacketFingerprint: string;
    actor: "researcher_ui" | "model" | "system";
    preparedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.preparedAt, "Synthesis input preparedAt");
  if (state.activeScreen !== 5) {
    throw new Error("Synthesis inputs can be frozen only from Screen 5.");
  }
  requireLegacyScreen5ExecutionPrerequisites(state);
  const literaturePlan = currentMechanismLiteraturePlan(state);
  const metadataPacket = currentScholarlyEvidencePacket(state);
  const claimPacket = currentScholarlyClaimPacket(state);
  const collections = mechanismLiteratureExecutionCollections(state);
  if (!literaturePlan || !metadataPacket || !claimPacket) {
    throw new Error("Synthesis input requires the current Screen 5 claim packet.");
  }
  if (
    claimPacket.packetFingerprint !== input.expectedClaimPacketFingerprint ||
    !claimPacket.acceptedClaimReferences.length
  ) throw new Error("The accepted scholarly claim packet changed or is empty.");
  if (
    collections.synthesisInputPackets.length >=
      SIX_SCREEN_MECHANISM_SYNTHESIS_INPUT_MAX_PACKETS ||
    collections.synthesisInputPackets.some((packet) =>
      packet.snapshotId === input.snapshotId ||
      packet.binding.claimPacketSnapshotId === claimPacket.snapshotId)
  ) throw new Error("Synthesis-input history reached capacity or reused a parent.");
  const passagePacket = collections.passagePackets.find((packet) =>
    packet.snapshotId === claimPacket.binding.passagePacketSnapshotId &&
    packet.packetFingerprint === claimPacket.binding.passagePacketFingerprint
  );
  if (!passagePacket) {
    throw new Error("Synthesis input lost the claim packet's passage lineage.");
  }
  const extractions = collections.claimExtractions.filter((extraction) =>
    extraction.binding.metadataPacketSnapshotId === metadataPacket.snapshotId &&
    extraction.binding.metadataPacketFingerprint === metadataPacket.packetFingerprint
  );
  const extractionIds = new Set(extractions.map(({ id }) => id));
  const reviews = collections.claimReviews.filter((review) =>
    extractionIds.has(review.extractionReference.extractionId)
  );
  const packet = createMechanismSynthesisInputPacket({
    snapshotId: input.snapshotId,
    ordinal: collections.synthesisInputPackets.length + 1,
    context: {
      literaturePlan,
      metadataPacket,
      passagePacket,
      passagePackets: collections.passagePackets,
      claimPacket,
      acquisitions: collections.documentAcquisitions,
      extractions,
      reviews,
    },
    actor: input.actor,
    preparedAt: input.preparedAt,
  });
  const nextPackets = [...collections.synthesisInputPackets, packet];
  validateMechanismSynthesisInputCollection({
    literaturePlans: state.mechanismLiteraturePlans ?? [],
    metadataPackets: collections.packets,
    passagePackets: collections.passagePackets,
    acquisitions: collections.documentAcquisitions,
    extractions: collections.claimExtractions,
    reviews: collections.claimReviews,
    claimPackets: collections.claimPackets,
    synthesisInputPackets: nextPackets,
  });
  const priorIds = new Set(
    collections.synthesisInputPackets.map(({ snapshotId }) => snapshotId),
  );
  state.artifacts = state.artifacts.map((artifact) =>
    artifact.screen === 5 && artifact.status === "current" &&
        priorIds.has(artifact.snapshotId)
      ? {
          ...artifact,
          status: "archived" as const,
          invalidatedAt: input.preparedAt,
          invalidationReason:
            "A newer accepted-claim packet produced a new synthesis-input freeze.",
        }
      : artifact
  );
  invalidateArtifacts(
    state,
    [6],
    "A new frozen Screen 5 synthesis-input packet changed a downstream dependency.",
    input.preparedAt,
  );
  state.mechanismSynthesisInputPackets = nextPackets;
  state.artifacts.push({
    snapshotId: packet.snapshotId,
    screen: 5,
    status: "current",
    dependencies: {
      studyRevision: literaturePlan.binding.studyRevision,
      identityFingerprint: literaturePlan.binding.identityFingerprint,
      eventCardSnapshotId:
        literaturePlan.binding.eventCardReference.eventCardSnapshotId,
      selectedDesignSnapshotId:
        currentCausalDesignDecision(state)?.selectedDesign?.snapshotId ?? null,
      coeventSnapshotId: literaturePlan.binding.coEventSnapshotId,
      mechanismSnapshotId: packet.snapshotId,
    },
    invalidatedAt: null,
    invalidationReason: null,
  });
  appendChange(
    state,
    input.preparedAt,
    `Researcher froze ${packet.acceptedScholarlyClaims.length} accepted source-linked scholarly claim${packet.acceptedScholarlyClaims.length === 1 ? "" : "s"} with reviewed policy and study inputs; no synthesis or prediction was created.`,
  );
  return { state, packet: structuredClone(packet) };
}

/**
 * Saves one complete researcher-authored MechanismReview and PredictionMatrix
 * against the exact current synthesis-input packet. No model or network call
 * is made and every later revision preserves its predecessor.
 */
export function saveMechanismReview(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    reviewSnapshotId: string;
    matrixSnapshotId: string;
    expectedSynthesisInputFingerprint: string;
    draft: MechanismReviewDraft;
    actor: "researcher_ui" | "model" | "system";
    reviewedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.reviewedAt, "Mechanism review time");
  if (state.activeScreen !== 5) {
    throw new Error("A MechanismReview can be saved only from Screen 5.");
  }
  requireLegacyScreen5ExecutionPrerequisites(state);
  const synthesisInput = currentMechanismSynthesisInputPacket(state);
  if (!synthesisInput ||
      synthesisInput.packetFingerprint !==
        input.expectedSynthesisInputFingerprint) {
    throw new Error("The frozen mechanism synthesis input changed before review.");
  }
  const collections = mechanismLiteratureExecutionCollections(state);
  if (
    collections.mechanismReviews.length >=
      SIX_SCREEN_MECHANISM_REVIEW_MAX_REVISIONS ||
    collections.mechanismReviews.some(({ snapshotId }) =>
      snapshotId === input.reviewSnapshotId) ||
    collections.predictionMatrices.some(({ snapshotId }) =>
      snapshotId === input.matrixSnapshotId)
  ) throw new Error("Mechanism review history reached capacity or reused an id.");
  const previousReview = latestMechanismReviewForInput(
    collections.mechanismReviews,
    synthesisInput.snapshotId,
  );
  const created = createMechanismReview({
    reviewSnapshotId: input.reviewSnapshotId,
    matrixSnapshotId: input.matrixSnapshotId,
    synthesisInput,
    previousReview,
    draft: input.draft,
    actor: input.actor,
    reviewedAt: input.reviewedAt,
  });
  const nextReviews = [...collections.mechanismReviews, created.review];
  const nextMatrices = [...collections.predictionMatrices, created.matrix];
  validateMechanismReviewCollections({
    synthesisInputs: collections.synthesisInputPackets,
    reviews: nextReviews,
    predictionMatrices: nextMatrices,
  });
  const priorIds = new Set([
    ...collections.mechanismReviews.map(({ snapshotId }) => snapshotId),
    ...collections.predictionMatrices.map(({ snapshotId }) => snapshotId),
  ]);
  state.artifacts = state.artifacts.map((artifact) =>
    artifact.screen === 5 && artifact.status === "current" &&
        priorIds.has(artifact.snapshotId)
      ? {
          ...artifact,
          status: "archived" as const,
          invalidatedAt: input.reviewedAt,
          invalidationReason:
            "A newer researcher-authored MechanismReview and PredictionMatrix superseded this revision.",
        }
      : artifact
  );
  invalidateArtifacts(
    state,
    [6],
    "A Screen 5 MechanismReview or PredictionMatrix changed a downstream dependency.",
    input.reviewedAt,
  );
  state.mechanismReviews = nextReviews;
  state.predictionMatrices = nextMatrices;
  const literaturePlan = currentMechanismLiteraturePlan(state)!;
  const dependencies = {
    studyRevision: literaturePlan.binding.studyRevision,
    identityFingerprint: literaturePlan.binding.identityFingerprint,
    eventCardSnapshotId:
      literaturePlan.binding.eventCardReference.eventCardSnapshotId,
    selectedDesignSnapshotId:
      currentCausalDesignDecision(state)?.selectedDesign?.snapshotId ?? null,
    coeventSnapshotId: literaturePlan.binding.coEventSnapshotId,
    mechanismSnapshotId: created.review.snapshotId,
  };
  state.artifacts.push(
    {
      snapshotId: created.review.snapshotId,
      screen: 5,
      status: "current",
      dependencies,
      invalidatedAt: null,
      invalidationReason: null,
    },
    {
      snapshotId: created.matrix.snapshotId,
      screen: 5,
      status: "current",
      dependencies,
      invalidatedAt: null,
      invalidationReason: null,
    },
  );
  appendChange(
    state,
    input.reviewedAt,
    `Researcher saved ${created.review.mechanisms.length} mechanism hypothesis${created.review.mechanisms.length === 1 ? "" : "es"} and ${created.matrix.rows.length} observable prediction${created.matrix.rows.length === 1 ? "" : "s"}; these remain hypotheses rather than effects or identified mediation.`,
  );
  return {
    state,
    review: structuredClone(created.review),
    predictionMatrix: structuredClone(created.matrix),
  };
}

export function recordCoEventSearchExecution(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    snapshotId: string;
    plan: CoEventExecutionPlan;
    attempt: CoEventProviderAttempt | null;
    candidates: CoEventCandidateOccurrence[];
    discoveryLeads: CoEventDiscoveryLead[];
    recordedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.recordedAt, "Screen 4 execution recordedAt");
  if (state.activeScreen !== 4) {
    throw new Error("Co-event search execution requires Screen 4 to be open.");
  }
  requireLegacyScreen4ExecutionPrerequisites(state);
  const matrix = currentCoEventSearchMatrix(state);
  if (!matrix) {
    throw new Error("Co-event search execution requires a current saved matrix.");
  }
  validateCoEventExecutionPlan(input.plan, matrix);
  if (input.attempt) validateCoEventProviderAttempt(input.attempt);
  input.candidates.forEach(validateCoEventCandidateOccurrence);
  input.discoveryLeads.forEach(validateCoEventDiscoveryLead);
  if (
    input.attempt &&
    (input.candidates.some(({ providerId }) =>
      providerId !== input.attempt!.providerId) ||
      input.discoveryLeads.some(({ providerId }) =>
        providerId !== input.attempt!.providerId))
  ) throw new Error("Screen 4 provider evidence does not match its attempt.");
  const {
    plans,
    executions,
    candidates,
    leads,
  } = coEventCollections(state);
  if (
    executions.length >= SIX_SCREEN_COEVENT_MAX_EXECUTION_SNAPSHOTS ||
    executions.some(({ snapshotId }) => snapshotId === input.snapshotId)
  ) throw new Error("Screen 4 execution history reached its bounded capacity or reused a snapshot id.");
  const existingPlan = plans.find(({ matrixSnapshotId }) =>
    matrixSnapshotId === matrix.snapshotId);
  if (
    existingPlan &&
    (existingPlan.id !== input.plan.id ||
      existingPlan.planFingerprint !== input.plan.planFingerprint)
  ) throw new Error("The current Screen 4 matrix already has a different execution plan.");
  if (!existingPlan && plans.length >= SIX_SCREEN_COEVENT_MAX_EXECUTION_PLANS) {
    throw new Error("Screen 4 execution-plan history reached its bounded capacity.");
  }
  const previous = currentCoEventSearchExecution(state);
  if (previous?.status === "complete") {
    throw new Error("The current Screen 4 search plan is already complete.");
  }
  const candidateMap = new Map(candidates.map((candidate) =>
    [candidate.id, candidate]));
  const newCandidates: CoEventCandidateOccurrence[] = [];
  for (const candidate of input.candidates) {
    const existing = candidateMap.get(candidate.id);
    if (existing) {
      if (existing.candidateFingerprint !== candidate.candidateFingerprint) {
        throw new Error("Screen 4 candidate id was reused for different occurrence evidence.");
      }
      continue;
    }
    candidateMap.set(candidate.id, candidate);
    newCandidates.push(candidate);
  }
  const leadMap = new Map(leads.map((lead) => [lead.id, lead]));
  const newLeads: CoEventDiscoveryLead[] = [];
  for (const lead of input.discoveryLeads) {
    const existing = leadMap.get(lead.id);
    if (existing) {
      if (existing.leadFingerprint !== lead.leadFingerprint) {
        throw new Error("Screen 4 lead id was reused for different metadata.");
      }
      continue;
    }
    leadMap.set(lead.id, lead);
    newLeads.push(lead);
  }
  if (
    candidateMap.size > SIX_SCREEN_COEVENT_MAX_CANDIDATES ||
    leadMap.size > SIX_SCREEN_COEVENT_MAX_DISCOVERY_LEADS
  ) throw new Error("Screen 4 candidate evidence reached its bounded capacity.");
  const execution = createCoEventSearchExecution({
    snapshotId: input.snapshotId,
    ordinal: executions.length + 1,
    plan: existingPlan ?? input.plan,
    previous,
    attempt: input.attempt,
    newCandidateOccurrenceIds: input.candidates.map(({ id }) => id),
    newDiscoveryLeadIds: input.discoveryLeads.map(({ id }) => id),
    recordedAt: input.recordedAt,
  });
  const nextPlans = existingPlan ? plans : [...plans, input.plan];
  const nextExecutions = [...executions, execution];
  const nextCandidates = [...candidates, ...newCandidates];
  const nextLeads = [...leads, ...newLeads];
  validateCoEventExecutionCollections({
    matrices: state.coEventSearchMatrices ?? [],
    plans: nextPlans,
    executions: nextExecutions,
    candidates: nextCandidates,
    leads: nextLeads,
  });
  const executionSnapshotIds = new Set(
    executions.map(({ snapshotId }) => snapshotId),
  );
  state.artifacts = state.artifacts.map((artifact) =>
    artifact.status === "current" && executionSnapshotIds.has(artifact.snapshotId)
      ? {
          ...artifact,
          status: "archived" as const,
          invalidatedAt: input.recordedAt,
          invalidationReason:
            "A newer bounded Screen 4 provider step extended this execution.",
        }
      : artifact
  );
  invalidateArtifacts(
    state,
    [5, 6],
    "New Screen 4 occurrence evidence changed a downstream dependency.",
    input.recordedAt,
  );
  state.coEventExecutionPlans = nextPlans;
  state.coEventSearchExecutions = nextExecutions;
  state.coEventCandidates = nextCandidates;
  state.coEventDiscoveryLeads = nextLeads;
  state.artifacts.push({
    snapshotId: execution.snapshotId,
    screen: 4,
    status: "current",
    dependencies: {
      studyRevision: matrix.binding.studyRevision,
      identityFingerprint: matrix.binding.identityFingerprint,
      eventCardSnapshotId:
        matrix.binding.eventCardReference.eventCardSnapshotId,
      selectedDesignSnapshotId: matrix.binding.selectedDesignSnapshotId,
      coeventSnapshotId: execution.snapshotId,
      mechanismSnapshotId: null,
    },
    invalidatedAt: null,
    invalidationReason: null,
  });
  appendChange(
    state,
    input.recordedAt,
    input.attempt
      ? `Screen 4 recorded ${input.attempt.providerId} as ${input.attempt.outcome.replaceAll("_", " ")} without assessing causal relevance.`
      : "Screen 4 recorded that no provider route was executable without claiming a no-match result.",
  );
  return {
    state,
    plan: structuredClone(existingPlan ?? input.plan),
    execution: structuredClone(execution),
    candidates: structuredClone(newCandidates),
    discoveryLeads: structuredClone(newLeads),
  };
}

function currentReviewableCoEventCandidate(
  state: SixScreenWorkflowState,
  candidateId: string,
  expectedCandidateFingerprint: string,
) {
  requireBoundedIdentifier(candidateId, "Screen 4 reviewed candidate id");
  requireFingerprint(
    expectedCandidateFingerprint,
    "Screen 4 reviewed candidate fingerprint",
  );
  if (state.activeScreen !== 4) {
    throw new Error("Co-event occurrence review requires Screen 4 to be open.");
  }
  requireLegacyScreen4ExecutionPrerequisites(state);
  const execution = currentCoEventSearchExecution(state);
  if (!execution || !execution.candidateOccurrenceIds.includes(candidateId)) {
    throw new Error(
      "Co-event occurrence review requires a candidate in the current execution.",
    );
  }
  const { candidates } = coEventCollections(state);
  const candidate = candidates.find(({ id }) => id === candidateId);
  if (!candidate || candidate.candidateFingerprint !== expectedCandidateFingerprint) {
    throw new Error(
      "The Screen 4 occurrence candidate changed before researcher review.",
    );
  }
  return candidate;
}

/**
 * Appends a researcher-owned occurrence review without changing source evidence
 * or assessing the candidate's causal relation to the selected comparison.
 */
export function reviewCoEventOccurrence(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    reviewId: string;
    candidateId: string;
    expectedCandidateFingerprint: string;
    decision: CoEventOccurrenceReviewDecision;
    rationale: string;
    actor: "researcher_ui" | "model" | "system";
    reviewedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  const candidate = currentReviewableCoEventCandidate(
    state,
    input.candidateId,
    input.expectedCandidateFingerprint,
  );
  const {
    candidates,
    occurrenceReviews,
    duplicateReviews,
  } = coEventCollections(state);
  const previousReview = latestCoEventOccurrenceReview(
    occurrenceReviews,
    candidate.id,
  );
  const review = createCoEventOccurrenceReview({
    reviewId: input.reviewId,
    candidate,
    previousReview,
    decision: input.decision,
    rationale: input.rationale,
    actor: input.actor,
    reviewedAt: input.reviewedAt,
  });
  const nextOccurrenceReviews = [...occurrenceReviews, review];
  validateCoEventReviewCollections({
    candidates,
    occurrenceReviews: nextOccurrenceReviews,
    duplicateReviews,
  });
  state.coEventOccurrenceReviews = nextOccurrenceReviews;
  invalidateArtifacts(
    state,
    [5, 6],
    "A researcher revised Screen 4 occurrence review state.",
    input.reviewedAt,
  );
  appendChange(
    state,
    input.reviewedAt,
    input.decision.mode === "corrected"
      ? `Researcher recorded a source-preserving correction for Screen 4 occurrence ${candidate.id}; causal relevance remains unassessed.`
      : `Researcher marked Screen 4 occurrence ${candidate.id} ${input.decision.mode}; causal relevance remains unassessed.`,
  );
  return { state, review: structuredClone(review) };
}

/**
 * Appends a comparison-specific researcher judgment while keeping occurrence
 * evidence immutable and preserving the unavailable semantic-assistance gate.
 */
export function reviewCoEventRelation(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    reviewId: string;
    candidateId: string;
    expectedCandidateFingerprint: string;
    expectedOccurrenceReviewId: string;
    expectedOccurrenceReviewFingerprint: string;
    decision: CoEventRelationReviewDecision;
    rationale: string;
    actor: "researcher_ui" | "model" | "system";
    reviewedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  const candidate = currentReviewableCoEventCandidate(
    state,
    input.candidateId,
    input.expectedCandidateFingerprint,
  );
  const matrix = currentCoEventSearchMatrix(state);
  const designSet = currentCausalDesignSet(state);
  const designDecision = currentCausalDesignDecision(state);
  if (!matrix || !designSet || !designDecision) {
    throw new Error(
      "Screen 4 relation review requires the current matrix and comparison decision.",
    );
  }
  const collections = coEventCollections(state);
  if (
    collections.relationReviews.length >=
      SIX_SCREEN_COEVENT_MAX_RELATION_REVIEWS
  ) throw new Error("Screen 4 relation-review history reached its bounded capacity.");
  const occurrenceReview = latestCoEventOccurrenceReview(
    collections.occurrenceReviews,
    candidate.id,
  );
  if (
    !occurrenceReview || occurrenceReview.id !==
      input.expectedOccurrenceReviewId ||
    occurrenceReview.reviewFingerprint !==
      input.expectedOccurrenceReviewFingerprint
  ) {
    throw new Error(
      "The Screen 4 occurrence review changed before relation classification.",
    );
  }
  const previousReview = latestCoEventRelationReview(
    collections.relationReviews,
    candidate.id,
  );
  const review = createCoEventRelationReview({
    reviewId: input.reviewId,
    matrix,
    designSet,
    designDecision,
    candidate,
    occurrenceReview,
    previousReview,
    decision: input.decision,
    rationale: input.rationale,
    actor: input.actor,
    reviewedAt: input.reviewedAt,
  });
  const nextRelationReviews = [...collections.relationReviews, review];
  validateCoEventRelationReviewCollection({
    matrices: collections.matrices,
    designSets: collections.designSets,
    designDecisions: collections.decisions,
    candidates: collections.candidates,
    occurrenceReviews: collections.occurrenceReviews,
    relationReviews: nextRelationReviews,
  });
  state.coEventRelationReviews = nextRelationReviews;
  invalidateArtifacts(
    state,
    [5, 6],
    "A researcher revised comparison-specific Screen 4 relation judgments.",
    input.reviewedAt,
  );
  appendChange(
    state,
    input.reviewedAt,
    `Researcher marked Screen 4 occurrence ${candidate.id} as ${input.decision.category.replaceAll("_", " ")} (${input.decision.mode}); occurrence evidence remains unchanged.`,
  );
  return { state, review: structuredClone(review) };
}

/**
 * Appends a pairwise duplicate/stage decision while preserving both immutable
 * occurrence records and leaving comparison-specific relevance unassessed.
 */
export function reviewCoEventDuplicatePair(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    reviewId: string;
    leftCandidateId: string;
    leftCandidateFingerprint: string;
    rightCandidateId: string;
    rightCandidateFingerprint: string;
    decision: CoEventDuplicateReviewDecision;
    rationale: string;
    actor: "researcher_ui" | "model" | "system";
    reviewedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  const leftCandidate = currentReviewableCoEventCandidate(
    state,
    input.leftCandidateId,
    input.leftCandidateFingerprint,
  );
  const rightCandidate = currentReviewableCoEventCandidate(
    state,
    input.rightCandidateId,
    input.rightCandidateFingerprint,
  );
  const {
    candidates,
    occurrenceReviews,
    duplicateReviews,
  } = coEventCollections(state);
  const previousReview = latestCoEventDuplicateReview(
    duplicateReviews,
    leftCandidate.id,
    rightCandidate.id,
  );
  const review = createCoEventDuplicateReview({
    reviewId: input.reviewId,
    leftCandidate,
    rightCandidate,
    previousReview,
    decision: input.decision,
    rationale: input.rationale,
    actor: input.actor,
    reviewedAt: input.reviewedAt,
  });
  const nextDuplicateReviews = [...duplicateReviews, review];
  validateCoEventReviewCollections({
    candidates,
    occurrenceReviews,
    duplicateReviews: nextDuplicateReviews,
  });
  state.coEventDuplicateReviews = nextDuplicateReviews;
  invalidateArtifacts(
    state,
    [5, 6],
    "A researcher revised Screen 4 duplicate/stage review state.",
    input.reviewedAt,
  );
  appendChange(
    state,
    input.reviewedAt,
    `Researcher marked two retained Screen 4 occurrence records ${input.decision.mode.replaceAll("_", " ")}; both records remain immutable and causal relevance remains unassessed.`,
  );
  return { state, review: structuredClone(review) };
}

/**
 * Routes one researcher-retained occurrence back to a fresh Screen 2 Event
 * Card revision as a possible stage of the already confirmed focal policy.
 * The source candidate and prior Event Card remain unchanged, and no causal or
 * independent-event classification is inferred.
 */
export function routeCoEventPolicyStageToScreen2(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    handoffId: string;
    targetReviewId: string;
    candidateId: string;
    expectedCandidateFingerprint: string;
    expectedOccurrenceReviewId: string;
    expectedOccurrenceReviewFingerprint: string;
    stageKind: CoEventPolicyLifecycleStageKind;
    rationale: string;
    projection: PolicyChronologySourcePanelProjection;
    actor: "researcher_ui" | "model" | "system";
    routedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.routedAt, "Policy-stage handoff routedAt");
  requireBoundedIdentifier(input.handoffId, "Policy-stage handoff id");
  requireBoundedIdentifier(input.targetReviewId, "Policy-stage target review id");
  const candidate = currentReviewableCoEventCandidate(
    state,
    input.candidateId,
    input.expectedCandidateFingerprint,
  );
  const {
    executions,
    occurrenceReviews,
    duplicateReviews,
    policyLifecycleHandoffs,
  } = coEventCollections(state);
  if (
    policyLifecycleHandoffs.length >=
      SIX_SCREEN_COEVENT_MAX_POLICY_LIFECYCLE_HANDOFFS ||
    policyLifecycleHandoffs.some(({ id }) => id === input.handoffId)
  ) throw new Error("Screen 4 policy-lifecycle handoff history reached its bounded capacity or reused an id.");
  const occurrenceReview = latestCoEventOccurrenceReview(
    occurrenceReviews,
    candidate.id,
  );
  if (
    !occurrenceReview ||
    occurrenceReview.id !== input.expectedOccurrenceReviewId ||
    occurrenceReview.reviewFingerprint !==
      input.expectedOccurrenceReviewFingerprint
  ) throw new Error("The Screen 4 occurrence review changed before policy-stage handoff.");
  const sourceExecution = currentCoEventSearchExecution(state);
  if (
    !sourceExecution ||
    !sourceExecution.candidateOccurrenceIds.includes(candidate.id) ||
    !executions.some(({ snapshotId, executionFingerprint }) =>
      snapshotId === sourceExecution.snapshotId &&
      executionFingerprint === sourceExecution.executionFingerprint)
  ) throw new Error("Policy-stage handoff requires the candidate's current Screen 4 execution.");
  const confirmed = requireRetainedPolicyProjection(state, input.projection);
  const reviews = policyEventCardReviews(state);
  const priorReview = currentReviewedEventCardRecord(state);
  if (
    !priorReview || priorReview.status !== "locked" ||
    reviews.at(-1)?.id !== priorReview.id
  ) throw new Error("Finish the active Screen 2 Event Card review before routing another possible policy stage.");
  if (reviews.length >= SIX_SCREEN_POLICY_EVENT_CARD_MAX_REVISIONS) {
    throw new Error("Policy Event Card review reached its bounded revision limit.");
  }
  if (
    reviews.some(({ id }) => id === input.targetReviewId) ||
    input.targetReviewId === input.handoffId
  ) throw new Error("Policy-stage handoff coordinates were already used.");
  const targetReview = createPolicyEventCardReviewRevision({
    previousReview: priorReview,
    reviewId: input.targetReviewId,
    projection: input.projection,
    reason:
      "A researcher routed retained Screen 4 occurrence evidence as a possible focal-policy lifecycle stage for source-grounded review.",
    createdAt: input.routedAt,
  });
  const handoff = createCoEventPolicyLifecycleHandoff({
    id: input.handoffId,
    ordinal: policyLifecycleHandoffs.length + 1,
    candidate,
    occurrenceReview,
    duplicateReviews,
    sourceExecution,
    confirmedShock: confirmed,
    priorEventCardReview: priorReview,
    targetEventCardReview: targetReview,
    stageKind: input.stageKind,
    rationale: input.rationale,
    actor: input.actor,
    routedAt: input.routedAt,
  });
  const nextReviews = [...reviews, targetReview];
  const nextHandoffs = [...policyLifecycleHandoffs, handoff];
  validatePolicyEventCardReviewCollection(nextReviews);
  validateCoEventPolicyLifecycleHandoffCollection({
    candidates: state.coEventCandidates ?? [],
    occurrenceReviews,
    duplicateReviews,
    executions,
    policyEventCardReviews: nextReviews,
    handoffs: nextHandoffs,
  });
  const priorEventCardSnapshotId = priorReview.lockedEventCard!.snapshotId;
  state.artifacts = state.artifacts.map((artifact) =>
    artifact.snapshotId === priorEventCardSnapshotId &&
        artifact.screen === 2 && artifact.status === "current"
      ? {
          ...artifact,
          status: "out_of_date" as const,
          invalidatedAt: input.routedAt,
          invalidationReason:
            "A researcher routed a possible focal-policy lifecycle stage from Screen 4 for Event Card review.",
        }
      : artifact
  );
  invalidateArtifacts(
    state,
    [3, 4, 5, 6],
    "A possible focal-policy lifecycle stage requires a new reviewed Event Card revision.",
    input.routedAt,
  );
  setPolicyEventCardReviews(state, nextReviews);
  state.coEventPolicyLifecycleHandoffs = nextHandoffs;
  state.activeScreen = 2;
  appendChange(
    state,
    input.routedAt,
    `Researcher routed Screen 4 occurrence ${candidate.id} to Screen 2 as a possible ${input.stageKind.replaceAll("_", " ")} stage; the prior Event Card and source occurrence remain unchanged.`,
  );
  return {
    state,
    handoff: structuredClone(handoff),
    review: structuredClone(targetReview),
  };
}

function requireActivePolicyLifecycleReview(
  state: SixScreenWorkflowState,
  handoff: CoEventPolicyLifecycleHandoff,
) {
  if (state.activeScreen !== 2) {
    throw new Error(
      "Policy-lifecycle stage-document review requires Screen 2.",
    );
  }
  const review = (state.policyEventCardReviews ?? []).at(-1);
  if (
    !review || review.status !== "in_review" ||
    review.id !== handoff.destination.policyEventCardReviewId ||
    review.seriesId !== handoff.destination.policyEventCardReviewSeriesId ||
    review.ordinal !== handoff.destination.policyEventCardReviewOrdinal
  ) throw new Error(
    "Policy-lifecycle stage-document review requires the current routed Event Card revision.",
  );
  return review;
}

/**
 * Appends one bounded deterministic official-document attempt to the routed
 * lifecycle handoff. The acquisition record is immutable and cannot itself
 * alter chronology or the pending Event Card revision.
 */
export function recordPolicyLifecycleStageDocumentAcquisition(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    acquisition: PolicyLifecycleStageDocumentAcquisition;
    recordedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.recordedAt, "Stage-document recordedAt");
  const {
    candidates,
    policyLifecycleHandoffs,
    policyLifecycleStageDocumentAcquisitions,
    policyLifecycleStageDispositions,
    policyLifecycleStageRevisionProposals,
    policyLifecycleStageRevisionReviews,
  } = coEventCollections(state);
  const handoff = policyLifecycleHandoffs.find(({ id }) =>
    id === input.acquisition.handoffReference.handoffId);
  const candidate = candidates.find(({ id }) =>
    id === input.acquisition.handoffReference.candidateId);
  if (
    !handoff || !candidate ||
    handoff.handoffFingerprint !==
      input.acquisition.handoffReference.handoffFingerprint ||
    input.acquisition.ordinal !==
      policyLifecycleStageDocumentAcquisitions.length + 1 ||
    input.acquisition.acquiredAt !== input.recordedAt ||
    policyLifecycleStageDocumentAcquisitions.some(({ id }) =>
      id === input.acquisition.id)
  ) throw new Error("Policy-lifecycle stage-document acquisition is stale.");
  requireActivePolicyLifecycleReview(state, handoff);
  const nextAcquisitions = [
    ...policyLifecycleStageDocumentAcquisitions,
    structuredClone(input.acquisition),
  ];
  validatePolicyLifecycleStageReviewCollections({
    candidates,
    handoffs: policyLifecycleHandoffs,
    acquisitions: nextAcquisitions,
    dispositions: policyLifecycleStageDispositions,
  });
  validatePolicyLifecycleStageRevisionCollections({
    handoffs: policyLifecycleHandoffs,
    acquisitions: nextAcquisitions,
    dispositions: policyLifecycleStageDispositions,
    proposals: policyLifecycleStageRevisionProposals,
    reviews: policyLifecycleStageRevisionReviews,
    eventCardReviews: state.policyEventCardReviews ?? [],
  });
  state.policyLifecycleStageDocumentAcquisitions = nextAcquisitions;
  appendChange(
    state,
    input.recordedAt,
    input.acquisition.outcome === "document_retained"
      ? `Screen 2 retained bounded exact official-document passages for possible focal-policy stage ${handoff.id}; chronology and the Event Card remain unchanged pending researcher disposition.`
      : `Screen 2 recorded ${input.acquisition.outcome.replaceAll("_", " ")} for possible focal-policy stage ${handoff.id}; no empty result or policy fact was inferred.`,
  );
  return {
    state,
    acquisition: structuredClone(input.acquisition),
  };
}

/**
 * Records the researcher's source-bound accept/reject/defer disposition. The
 * decision is a gate for later Event Card work, never an implicit chronology
 * or Event Card mutation.
 */
export function reviewPolicyLifecycleStageDocument(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    dispositionId: string;
    handoffId: string;
    expectedHandoffFingerprint: string;
    acquisitionId: string;
    expectedAcquisitionFingerprint: string;
    decision: PolicyLifecycleStageDispositionDecision;
    rationale: string;
    actor: "researcher_ui" | "model" | "system";
    reviewedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.reviewedAt, "Stage-document disposition time");
  requireBoundedIdentifier(
    input.dispositionId,
    "Stage-document disposition id",
  );
  const {
    candidates,
    policyLifecycleHandoffs,
    policyLifecycleStageDocumentAcquisitions,
    policyLifecycleStageDispositions,
    policyLifecycleStageRevisionProposals,
    policyLifecycleStageRevisionReviews,
  } = coEventCollections(state);
  const handoff = policyLifecycleHandoffs.find(({ id }) =>
    id === input.handoffId);
  const acquisition = policyLifecycleStageDocumentAcquisitions.find(({ id }) =>
    id === input.acquisitionId);
  const latestAcquisition = [...policyLifecycleStageDocumentAcquisitions]
    .reverse().find(({ handoffReference }) =>
      handoffReference.handoffId === input.handoffId);
  if (
    !handoff || handoff.handoffFingerprint !==
      input.expectedHandoffFingerprint ||
    !acquisition || acquisition.acquisitionFingerprint !==
      input.expectedAcquisitionFingerprint ||
    acquisition.handoffReference.handoffId !== handoff.id ||
    latestAcquisition?.id !== acquisition.id ||
    policyLifecycleStageRevisionProposals.some(({ handoffReference }) =>
      handoffReference.handoffId === handoff.id) ||
    policyLifecycleStageDispositions.some(({ id }) =>
      id === input.dispositionId)
  ) throw new Error("Policy-lifecycle stage-document disposition is stale.");
  requireActivePolicyLifecycleReview(state, handoff);
  const disposition = createPolicyLifecycleStageDisposition({
    id: input.dispositionId,
    ordinal: policyLifecycleStageDispositions.length + 1,
    handoff,
    acquisition,
    decision: input.decision,
    rationale: input.rationale,
    actor: input.actor,
    reviewedAt: input.reviewedAt,
  });
  const nextDispositions = [
    ...policyLifecycleStageDispositions,
    disposition,
  ];
  validatePolicyLifecycleStageReviewCollections({
    candidates,
    handoffs: policyLifecycleHandoffs,
    acquisitions: policyLifecycleStageDocumentAcquisitions,
    dispositions: nextDispositions,
  });
  validatePolicyLifecycleStageRevisionCollections({
    handoffs: policyLifecycleHandoffs,
    acquisitions: policyLifecycleStageDocumentAcquisitions,
    dispositions: nextDispositions,
    proposals: policyLifecycleStageRevisionProposals,
    reviews: policyLifecycleStageRevisionReviews,
    eventCardReviews: state.policyEventCardReviews ?? [],
  });
  state.policyLifecycleStageDispositions = nextDispositions;
  appendChange(
    state,
    input.reviewedAt,
    `Researcher ${input.decision.replaceAll("_", " ")} for possible focal-policy stage ${handoff.id}; the source, chronology, and pending Event Card revision remain unchanged.`,
  );
  return {
    state,
    disposition: structuredClone(disposition),
  };
}

/**
 * Appends an immutable source-bound interpretation for a retained and accepted
 * lifecycle-stage document. This proposal cannot itself change chronology or
 * the active Event Card revision.
 */
export function proposePolicyLifecycleStageRevision(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    proposalId: string;
    handoffId: string;
    expectedHandoffFingerprint: string;
    dispositionId: string;
    expectedDispositionFingerprint: string;
    chronologyStage: PolicyChronologyStage;
    sourceDateId: string | null;
    rationale: string;
    actor: "researcher_ui" | "model" | "system";
    proposedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.proposedAt, "Lifecycle-stage proposal time");
  requireBoundedIdentifier(input.proposalId, "Lifecycle-stage proposal id");
  const {
    policyLifecycleHandoffs,
    policyLifecycleStageDocumentAcquisitions,
    policyLifecycleStageDispositions,
    policyLifecycleStageRevisionProposals,
    policyLifecycleStageRevisionReviews,
  } = coEventCollections(state);
  const handoff = policyLifecycleHandoffs.find(({ id }) =>
    id === input.handoffId);
  const disposition = policyLifecycleStageDispositions.find(({ id }) =>
    id === input.dispositionId);
  const latestDisposition = [...policyLifecycleStageDispositions].reverse()
    .find(({ handoffReference }) =>
      handoffReference.handoffId === input.handoffId);
  const acquisition = disposition
    ? policyLifecycleStageDocumentAcquisitions.find(({ id }) =>
        id === disposition.acquisitionReference.acquisitionId)
    : null;
  if (
    !handoff ||
    handoff.handoffFingerprint !== input.expectedHandoffFingerprint ||
    !disposition ||
    disposition.dispositionFingerprint !==
      input.expectedDispositionFingerprint ||
    latestDisposition?.id !== disposition.id ||
    disposition.decision !== "accepted_for_event_card_review" ||
    !acquisition ||
    policyLifecycleStageRevisionProposals.some(({ id, handoffReference }) =>
      id === input.proposalId || handoffReference.handoffId === handoff.id)
  ) {
    throw new Error("Policy-lifecycle stage revision proposal is stale.");
  }
  const targetReview = requireActivePolicyLifecycleReview(state, handoff);
  const proposal = createPolicyLifecycleStageRevisionProposal({
    id: input.proposalId,
    ordinal: policyLifecycleStageRevisionProposals.length + 1,
    handoff,
    acquisition,
    disposition,
    targetReview,
    chronologyStage: input.chronologyStage,
    sourceDateId: input.sourceDateId,
    rationale: input.rationale,
    actor: input.actor,
    proposedAt: input.proposedAt,
  });
  const nextProposals = [
    ...policyLifecycleStageRevisionProposals,
    proposal,
  ];
  validatePolicyLifecycleStageRevisionCollections({
    handoffs: policyLifecycleHandoffs,
    acquisitions: policyLifecycleStageDocumentAcquisitions,
    dispositions: policyLifecycleStageDispositions,
    proposals: nextProposals,
    reviews: policyLifecycleStageRevisionReviews,
    eventCardReviews: state.policyEventCardReviews ?? [],
  });
  state.policyLifecycleStageRevisionProposals = nextProposals;
  appendChange(
    state,
    input.proposedAt,
    `Researcher proposed ${input.chronologyStage.replaceAll("_", " ")} for possible focal-policy stage ${handoff.id}; chronology and the pending Event Card remain unchanged until separate review and lock.`,
  );
  return { state, proposal: structuredClone(proposal) };
}

/** Records an append-only accept/reject/defer decision without applying it. */
export function reviewPolicyLifecycleStageRevision(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    reviewId: string;
    proposalId: string;
    expectedProposalFingerprint: string;
    decision: PolicyLifecycleStageRevisionDecision;
    rationale: string;
    actor: "researcher_ui" | "model" | "system";
    reviewedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.reviewedAt, "Lifecycle-stage proposal review time");
  requireBoundedIdentifier(input.reviewId, "Lifecycle-stage proposal review id");
  const {
    policyLifecycleHandoffs,
    policyLifecycleStageDocumentAcquisitions,
    policyLifecycleStageDispositions,
    policyLifecycleStageRevisionProposals,
    policyLifecycleStageRevisionReviews,
  } = coEventCollections(state);
  const proposal = policyLifecycleStageRevisionProposals.find(({ id }) =>
    id === input.proposalId);
  const handoff = proposal
    ? policyLifecycleHandoffs.find(({ id }) =>
        id === proposal.handoffReference.handoffId)
    : null;
  const priorReviews = policyLifecycleStageRevisionReviews.filter(
    ({ proposalReference }) => proposalReference.proposalId === input.proposalId,
  );
  if (
    !proposal ||
    proposal.proposalFingerprint !== input.expectedProposalFingerprint ||
    !handoff ||
    policyLifecycleStageRevisionReviews.some(({ id }) => id === input.reviewId) ||
    priorReviews.length >= 2 ||
    (priorReviews.length > 0 && priorReviews.at(-1)?.decision !== "deferred")
  ) {
    throw new Error("Policy-lifecycle stage revision review is stale.");
  }
  requireActivePolicyLifecycleReview(state, handoff);
  const review = createPolicyLifecycleStageRevisionReview({
    id: input.reviewId,
    ordinal: policyLifecycleStageRevisionReviews.length + 1,
    proposal,
    decision: input.decision,
    rationale: input.rationale,
    actor: input.actor,
    reviewedAt: input.reviewedAt,
  });
  const nextReviews = [...policyLifecycleStageRevisionReviews, review];
  validatePolicyLifecycleStageRevisionCollections({
    handoffs: policyLifecycleHandoffs,
    acquisitions: policyLifecycleStageDocumentAcquisitions,
    dispositions: policyLifecycleStageDispositions,
    proposals: policyLifecycleStageRevisionProposals,
    reviews: nextReviews,
    eventCardReviews: state.policyEventCardReviews ?? [],
  });
  state.policyLifecycleStageRevisionReviews = nextReviews;
  appendChange(
    state,
    input.reviewedAt,
    `Researcher marked lifecycle-stage proposal ${proposal.id} ${input.decision.replaceAll("_", " ")}; chronology and the pending Event Card remain unchanged until an explicit lock.`,
  );
  return { state, review: structuredClone(review) };
}

export function applyPolicyReview(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    review: PolicyReview;
    appliedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.appliedAt, "Policy review appliedAt");
  const confirmed = requireCurrentConfirmedShock(state);
  if (state.activeScreen !== 2) {
    throw new Error("Policy research requires the researcher to open Screen 2 first.");
  }
  if (
    input.review.identityFingerprint !== confirmed.identityFingerprint ||
    input.review.protocolVersion !== SIX_SCREEN_POLICY_REVIEW_PROTOCOL_VERSION ||
    input.review.artifactStatus !== "current" ||
    input.review.invalidatedAt !== null ||
    input.review.invalidationReason !== null
  ) {
    throw new Error("Policy review does not match the current confirmed shock.");
  }
  requireBoundedIdentifier(input.review.taskId, "Policy review task id");
  requireCanonicalInstant(input.review.researchedAt, "Policy review researchedAt");
  if (
    input.review.documentNumber !== null &&
    !/^\d{4}-\d{4,6}$/u.test(input.review.documentNumber)
  ) {
    throw new Error("Policy review Federal Register document number is invalid.");
  }
  const confirmedDocumentNumbers = new Set(
    confirmed.formalIdentifiers.flatMap((value) =>
      value.match(/\b\d{4}-\d{4,6}\b/gu) ?? []
    ),
  );
  if (
    input.review.documentNumber &&
    !confirmedDocumentNumbers.has(input.review.documentNumber)
  ) {
    throw new Error("Policy review names a different Federal Register document.");
  }
  validatePolicyEvidencePlan(input.review.plan);
  const planCoordinatesMatch = input.review.plan.instrumentFamily === "federal_rule"
    ? Boolean(
        input.review.documentNumber &&
        input.review.plan.documentNumber === input.review.documentNumber,
      )
    : input.review.documentNumber === null &&
      input.review.plan.documentNumber === null;
  if (
    !planCoordinatesMatch ||
    input.review.plan.identityFingerprint !== input.review.identityFingerprint
  ) {
    throw new Error("Policy review evidence plan does not match its confirmed document.");
  }
  if (input.review.evidenceSnapshotId) {
    requireBoundedIdentifier(
      input.review.evidenceSnapshotId,
      "Policy review evidence snapshot id",
    );
  }
  if (input.review.evidenceSnapshotFingerprint) {
    requireFingerprint(
      input.review.evidenceSnapshotFingerprint,
      "Policy review evidence snapshot fingerprint",
    );
  }
  for (const source of input.review.attemptedSources) {
    requireSanitizedSourceUrl(source);
  }
  if (
    input.review.claimCount !== input.review.claims.length ||
    !Number.isSafeInteger(input.review.sourceCount) || input.review.sourceCount < 0 ||
    !Number.isSafeInteger(input.review.passageCount) || input.review.passageCount < 0
  ) {
    throw new Error("Policy review counts do not match its compact claim projection.");
  }
  const searchedSteps = input.review.plan.steps.filter(
    ({ status }) => status === "searched",
  ).length;
  const numericProgress = [
    input.review.progress.searchedSteps,
    input.review.progress.totalSteps,
    input.review.progress.retainedDocuments,
    input.review.progress.chargedDocumentAttempts,
    input.review.progress.interruptedOperations,
    input.review.progress.receivedBytes,
    input.review.progress.activeResearchMs,
  ];
  if (
    numericProgress.some((value) => !Number.isSafeInteger(value) || value < 0) ||
    input.review.progress.searchedSteps !== searchedSteps ||
    input.review.progress.totalSteps !== input.review.plan.steps.length ||
    input.review.progress.retainedDocuments > input.review.sourceCount ||
    input.review.progress.interruptedOperations >
      input.review.progress.chargedDocumentAttempts ||
    !["panel_driven", "automatic_standard"].includes(
      input.review.progress.continuationMode,
    )
  ) {
    throw new Error("Policy review progress does not match its saved evidence plan.");
  }
  const requirementKinds = input.review.requirements.map(({ kind }) => kind);
  if (
    requirementKinds.length !== POLICY_EVIDENCE_REQUIREMENT_KINDS.length ||
    new Set(requirementKinds).size !== requirementKinds.length ||
    POLICY_EVIDENCE_REQUIREMENT_KINDS.some(
      (kind) => !requirementKinds.includes(kind),
    ) ||
    input.review.requirements.some((requirement) =>
      !requirement.description.trim() ||
      !["critical", "material", "contextual"].includes(requirement.criticality)
    )
  ) {
    throw new Error("Policy review requirements do not match the evidence plan.");
  }
  const expectedUnresolved = new Set(
    input.review.requirements
      .filter(({ status }) => status !== "supported" && status !== "not_applicable")
      .map(({ kind }) => kind),
  );
  if (
    input.review.unresolved.length !== expectedUnresolved.size ||
    input.review.unresolved.some((kind) => !expectedUnresolved.has(
      kind as (typeof POLICY_EVIDENCE_REQUIREMENT_KINDS)[number],
    ))
  ) {
    throw new Error("Policy review unresolved requirements are inconsistent.");
  }
  if (new Set(input.review.claims.map(({ claimId }) => claimId)).size !==
      input.review.claims.length) {
    throw new Error("Policy review claim ids must be unique.");
  }
  const projectedSourceIds = new Set(
    input.review.claims.map(({ citation }) => citation.sourceId),
  );
  const projectedPassageIds = new Set(
    input.review.claims.map(({ citation }) => citation.passageId),
  );
  if (
    input.review.claims.length &&
    (input.review.sourceCount < projectedSourceIds.size ||
      input.review.passageCount < projectedPassageIds.size)
  ) {
    throw new Error("Policy review counts do not cover its visible citations.");
  }
  for (const claim of input.review.claims) {
    requireBoundedIdentifier(claim.claimId, "Policy review claim id");
    requireBoundedIdentifier(claim.citation.passageId, "Policy review passage id");
    requireBoundedIdentifier(
      claim.citation.documentVersionId,
      "Policy review document version id",
    );
    requireBoundedIdentifier(claim.citation.sourceId, "Policy review source id");
    requireSanitizedSourceUrl(claim.citation.canonicalUrl);
    if (!claim.statement.trim() || !claim.citation.exactText.trim()) {
      throw new Error("Policy review claims require a statement and exact citation.");
    }
  }
  const retained = input.review.status === "ready" ||
    input.review.status === "partial";
  if (
    retained !== (input.review.failureCode === null) ||
    (input.review.status === "ready" && input.review.unresolved.length) ||
    (input.review.status === "partial" && !input.review.unresolved.length)
  ) {
    throw new Error("Policy review status does not match its failure and gap fields.");
  }
  if (
    retained
  ) {
    if (
      !input.review.evidenceSnapshotId ||
      !input.review.evidenceSnapshotFingerprint ||
      input.review.claims.length < 1
    ) {
      throw new Error("A retained policy review requires a durable evidence snapshot.");
    }
  } else if (
    input.review.evidenceSnapshotId || input.review.evidenceSnapshotFingerprint ||
    input.review.claims.length
  ) {
    throw new Error("An unavailable policy review cannot claim retained evidence.");
  }
  if (state.policyReview?.artifactStatus === "current") {
    invalidateArtifacts(
      state,
      [2],
      "A newer Screen 2 policy reconstruction superseded this result.",
      input.appliedAt,
      "archived",
    );
  }
  state.policyReview = structuredClone(input.review);
  if (input.review.evidenceSnapshotId) {
    state.artifacts.push({
      snapshotId: input.review.evidenceSnapshotId,
      screen: 2,
      status: "current",
      dependencies: {
        studyRevision: state.study.revision,
        identityFingerprint: confirmed.identityFingerprint,
        eventCardSnapshotId: null,
        selectedDesignSnapshotId: null,
        coeventSnapshotId: null,
        mechanismSnapshotId: null,
      },
      invalidatedAt: null,
      invalidationReason: null,
    });
  }
  appendChange(
    state,
    input.appliedAt,
    input.review.status === "ready"
      ? `Screen 2 retained ${input.review.claimCount} source-linked policy claims.`
      : input.review.status === "partial"
        ? `Screen 2 retained a partial policy reconstruction with ${input.review.unresolved.length} unresolved requirement${input.review.unresolved.length === 1 ? "" : "s"}.`
        : "Screen 2 recorded a bounded source limitation without inventing policy facts.",
  );
  return state;
}

export function addWorkflowArtifact(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    artifact: WorkflowArtifactReference;
    addedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.addedAt, "Workflow artifact addedAt");
  if (input.artifact.status !== "current") {
    throw new Error("A newly applied workflow artifact must be current.");
  }
  const confirmed = requireCurrentConfirmedShock(state);
  if (
    input.artifact.dependencies.studyRevision !== state.study.revision ||
    input.artifact.dependencies.identityFingerprint !== confirmed.identityFingerprint
  ) {
    throw new Error("Workflow artifact does not match current study and shock dependencies.");
  }
  state.artifacts.push(structuredClone(input.artifact));
  appendChange(state, input.addedAt, `Screen ${input.artifact.screen} snapshot applied once.`);
  return state;
}

function requireRetainedPolicyProjection(
  state: SixScreenWorkflowState,
  projection: PolicyChronologySourcePanelProjection,
) {
  const confirmed = requireCurrentConfirmedShock(state);
  const review = state.policyReview;
  if (!review || review.artifactStatus !== "current") {
    throw new Error("Policy Event Card review requires the current retained Screen 2 policy reconstruction.");
  }
  if (
    review.evidenceSnapshotId === null ||
    review.evidenceSnapshotFingerprint === null ||
    projection.binding.eventId !== confirmed.id ||
    projection.binding.identityFingerprint !== confirmed.identityFingerprint ||
    projection.binding.evidenceSnapshotId !== review.evidenceSnapshotId ||
    projection.binding.evidenceSnapshotFingerprint !==
      review.evidenceSnapshotFingerprint
  ) {
    throw new Error("Policy Event Card projection does not match the current confirmed shock and evidence snapshot.");
  }
  return confirmed;
}

function requireCurrentPolicyProjection(
  state: SixScreenWorkflowState,
  projection: PolicyChronologySourcePanelProjection,
) {
  if (state.activeScreen !== 2) {
    throw new Error("Policy Event Card review requires Screen 2 to be open.");
  }
  return requireRetainedPolicyProjection(state, projection);
}

function policyEventCardReviews(state: SixScreenWorkflowState) {
  return state.policyEventCardReviews ?? [];
}

function setPolicyEventCardReviews(
  state: SixScreenWorkflowState,
  reviews: PolicyEventCardReviewState[],
) {
  validatePolicyEventCardReviewCollection(reviews);
  state.policyEventCardReviews = reviews;
}

function requireActivePolicyEventCardReview(
  state: SixScreenWorkflowState,
  reviewId: string,
) {
  const reviews = policyEventCardReviews(state);
  const active = reviews.at(-1);
  if (!active || active.id !== reviewId) {
    throw new Error("Policy Event Card action does not target the active review revision.");
  }
  return { reviews, active };
}

/**
 * Adds a compact review revision to canonical workflow state. Source text
 * remains in the immutable evidence store and is referenced only by ids and
 * fingerprints here.
 */
export function beginPolicyEventCardReview(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    reviewId: string;
    projection: PolicyChronologySourcePanelProjection;
    revisionReason?: string | null;
    startedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCanonicalInstant(input.startedAt, "Policy Event Card review startedAt");
  requireBoundedIdentifier(input.reviewId, "Policy Event Card review id");
  requireCurrentPolicyProjection(state, input.projection);
  const reviews = policyEventCardReviews(state);
  if (reviews.some(({ id }) => id === input.reviewId)) {
    throw new Error("Policy Event Card review id was already used.");
  }
  if (reviews.length >= SIX_SCREEN_POLICY_EVENT_CARD_MAX_REVISIONS) {
    throw new Error("Policy Event Card review reached its bounded revision limit.");
  }
  const previous = reviews.at(-1) ?? null;
  const sameEventAndIdentity = Boolean(previous &&
    previous.binding.eventId === input.projection.binding.eventId &&
    previous.binding.identityFingerprint ===
      input.projection.binding.identityFingerprint);
  if (
    previous?.status === "in_review" && sameEventAndIdentity &&
    previous.binding.projectionFingerprint ===
      input.projection.projectionFingerprint
  ) {
    throw new Error("Finish the active Policy Event Card proposal before starting another revision.");
  }
  const sameSeries = Boolean(
    previous?.status === "locked" && sameEventAndIdentity,
  );
  const replacedUnfinished = Boolean(
    previous?.status === "in_review" &&
    previous.binding.projectionFingerprint !==
      input.projection.projectionFingerprint,
  );
  const review = sameSeries
    ? createPolicyEventCardReviewRevision({
        previousReview: previous!,
        reviewId: input.reviewId,
        projection: input.projection,
        reason: input.revisionReason ?? "New evidence or a researcher-requested revision requires review.",
        createdAt: input.startedAt,
      })
    : createPolicyEventCardReview({
        reviewId: input.reviewId,
        projection: input.projection,
        createdAt: input.startedAt,
      });
  setPolicyEventCardReviews(state, [...reviews, review]);
  appendChange(
    state,
    input.startedAt,
    sameSeries
      ? `Policy Event Card revision ${review.ordinal} opened; the prior locked card remains unchanged until this proposal is reviewed.`
      : replacedUnfinished
        ? "A new evidence-bound Policy Event Card review opened; the prior partial proposal remains saved and unchanged."
      : "Policy Event Card review opened with no inferred claim or treatment-clock decisions.",
  );
  return { state, review: structuredClone(review) };
}

export function applyPolicyEventCardClaimDecision(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    reviewId: string;
    projection: PolicyChronologySourcePanelProjection;
    expectedReviewRevision: number;
    expectedReviewFingerprint: string;
    actionId: string;
    claimId: string;
    decision: Exclude<PolicyClaimReviewDecision, "unreviewed">;
    correctedStatement?: string | null;
    rationale: string;
    actor: "researcher_ui" | "model" | "system";
    decidedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCurrentPolicyProjection(state, input.projection);
  const { reviews, active } = requireActivePolicyEventCardReview(
    state,
    input.reviewId,
  );
  const review = reviewPolicyEventCardClaim({
    review: active,
    projection: input.projection,
    expectedRevision: input.expectedReviewRevision,
    expectedReviewFingerprint: input.expectedReviewFingerprint,
    actionId: input.actionId,
    claimId: input.claimId,
    decision: input.decision,
    correctedStatement: input.correctedStatement,
    rationale: input.rationale,
    actor: input.actor,
    decidedAt: input.decidedAt,
  });
  if (review === active) return { state, review: structuredClone(review) };
  setPolicyEventCardReviews(state, [...reviews.slice(0, -1), review]);
  appendChange(
    state,
    input.decidedAt,
    review.changeHistory.at(-1)!.summary,
  );
  return { state, review: structuredClone(review) };
}

export function applyPolicyTreatmentClockDecision(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    reviewId: string;
    projection: PolicyChronologySourcePanelProjection;
    expectedReviewRevision: number;
    expectedReviewFingerprint: string;
    actionId: string;
    decision:
      | { mode: "selected"; candidateId: string }
      | { mode: "no_selection"; candidateId?: never };
    rationale: string;
    actor: "researcher_ui" | "model" | "system";
    decidedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  requireCurrentPolicyProjection(state, input.projection);
  const { reviews, active } = requireActivePolicyEventCardReview(
    state,
    input.reviewId,
  );
  const review = decidePolicyTreatmentClock({
    review: active,
    projection: input.projection,
    expectedRevision: input.expectedReviewRevision,
    expectedReviewFingerprint: input.expectedReviewFingerprint,
    actionId: input.actionId,
    decision: input.decision,
    rationale: input.rationale,
    actor: input.actor,
    decidedAt: input.decidedAt,
  });
  if (review === active) return { state, review: structuredClone(review) };
  setPolicyEventCardReviews(state, [...reviews.slice(0, -1), review]);
  appendChange(
    state,
    input.decidedAt,
    review.changeHistory.at(-1)!.summary,
  );
  return { state, review: structuredClone(review) };
}

export function lockReviewedPolicyEventCard(
  current: SixScreenWorkflowState,
  input: {
    expectedRevision: number;
    reviewId: string;
    projection: PolicyChronologySourcePanelProjection;
    expectedReviewRevision: number;
    expectedReviewFingerprint: string;
    actionId: string;
    eventCardSnapshotId: string;
    rationale: string;
    actor: "researcher_ui" | "model" | "system";
    lockedAt: string;
  },
) {
  const state = structuredClone(current);
  requireRevision(state, input.expectedRevision);
  const confirmed = requireCurrentPolicyProjection(state, input.projection);
  const { reviews, active } = requireActivePolicyEventCardReview(
    state,
    input.reviewId,
  );
  const {
    policyLifecycleHandoffs,
    policyLifecycleStageDocumentAcquisitions,
    policyLifecycleStageDispositions,
    policyLifecycleStageRevisionProposals,
    policyLifecycleStageRevisionReviews,
  } = coEventCollections(state);
  const lifecycleStageRevisions =
    policyLifecycleStageContributionsForEventCardLock({
      targetReview: active,
      handoffs: policyLifecycleHandoffs,
      dispositions: policyLifecycleStageDispositions,
      proposals: policyLifecycleStageRevisionProposals,
      reviews: policyLifecycleStageRevisionReviews,
      lockedAt: input.lockedAt,
    });
  const review = lockPolicyEventCardReview({
    review: active,
    projection: input.projection,
    lifecycleStageRevisions,
    expectedRevision: input.expectedReviewRevision,
    expectedReviewFingerprint: input.expectedReviewFingerprint,
    actionId: input.actionId,
    eventCardSnapshotId: input.eventCardSnapshotId,
    rationale: input.rationale,
    actor: input.actor,
    lockedAt: input.lockedAt,
  });
  if (review === active) {
    return {
      state,
      review: structuredClone(review),
      eventCard: structuredClone(review.lockedEventCard!),
    };
  }
  validatePolicyEventCardReview({ review, projection: input.projection });
  const nextPolicyEventCardReviews = [...reviews.slice(0, -1), review];
  validatePolicyLifecycleStageRevisionCollections({
    handoffs: policyLifecycleHandoffs,
    acquisitions: policyLifecycleStageDocumentAcquisitions,
    dispositions: policyLifecycleStageDispositions,
    proposals: policyLifecycleStageRevisionProposals,
    reviews: policyLifecycleStageRevisionReviews,
    eventCardReviews: nextPolicyEventCardReviews,
  });
  if (state.artifacts.some(
    ({ snapshotId }) => snapshotId === review.lockedEventCard!.snapshotId,
  )) {
    throw new Error("Reviewed Policy Event Card snapshot id was already used.");
  }
  const priorCardIds = new Set(
    reviews.slice(0, -1).flatMap(({ lockedEventCard }) =>
      lockedEventCard ? [lockedEventCard.snapshotId] : []
    ),
  );
  state.artifacts = state.artifacts.map((artifact) =>
    (artifact.status === "current" || artifact.status === "out_of_date") &&
        priorCardIds.has(artifact.snapshotId)
      ? {
          ...artifact,
          status: "archived" as const,
          invalidatedAt: input.lockedAt,
          invalidationReason:
            "A newer researcher-reviewed Event Card revision was locked.",
        }
      : artifact
  );
  if (priorCardIds.size) {
    invalidateArtifacts(
      state,
      [3, 4, 5, 6],
      "A newer researcher-reviewed Event Card revision changed an upstream dependency.",
      input.lockedAt,
    );
  }
  setPolicyEventCardReviews(state, nextPolicyEventCardReviews);
  state.artifacts.push({
    snapshotId: review.lockedEventCard!.snapshotId,
    screen: 2,
    status: "current",
    dependencies: {
      studyRevision: state.study.revision,
      identityFingerprint: confirmed.identityFingerprint,
      eventCardSnapshotId: null,
      selectedDesignSnapshotId: null,
      coeventSnapshotId: null,
      mechanismSnapshotId: null,
    },
    invalidatedAt: null,
    invalidationReason: null,
  });
  appendChange(
    state,
    input.lockedAt,
    review.changeHistory.at(-1)!.summary,
  );
  return {
    state,
    review: structuredClone(review),
    eventCard: structuredClone(review.lockedEventCard!),
  };
}
