import { fingerprintSixScreenValue } from
  "../core/six-screen/canonical";
import { sixScreenActionPolicy } from
  "../core/six-screen/action-policy";
import {
  SixScreenWorkflowProblemError,
  createSixScreenWorkflowProblem,
} from "../core/six-screen/workflow-problem";
import { SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID } from
  "../core/six-screen/workflow-response-contract";
import {
  SIX_SCREEN_OPERATION_STATUS_SCHEMA_VERSION,
  SIX_SCREEN_OPERATION_STATUS_TOOL,
  classifyScreen3StartReceipt,
  createSixScreenOperationStatus,
  sixScreenOperationReference,
  sixScreenOperationRequestFingerprint,
  type SixScreenOperationStatusRequest,
} from "../core/six-screen/operation-status";
import { createScreen6CurrentPlan, screen6CompatibleInputFingerprints,
  screen6NamedEventOccurrences, screen6RetainedEventInvestigation,
  screen6StateWithEventSource } from
  "../core/six-screen/screen6-current-plan";
import {
  estimateScreen3Contextualization,
  requestScreen3Contextualization,
  screen3ContextualPacket,
  validateScreen3ContextualCritique,
  SCREEN3_CONTEXTUALIZER_INPUT_CEILING,
  SCREEN3_CONTEXTUALIZER_OUTPUT_CEILING,
  SCREEN3_CONTEXTUALIZER_RESERVATION,
} from "./screen3-contextualizer";
import { screen3LegacyContextualPacket } from "./screen3-legacy-packet";
import {
  estimateScreen6Contextualization,
  requestScreen6Contextualization,
  validateScreen6Contextualization,
  SCREEN6_CONTEXTUALIZER_INPUT_CEILING,
  SCREEN6_CONTEXTUALIZER_OUTPUT_CEILING,
  SCREEN6_CONTEXTUALIZER_RESERVATION,
} from "./screen6-contextualizer";
import type {
  IdentityCandidate,
  IdentityResolutionRequest,
  PolicyEvidencePlan,
  PolicyEvidenceRequirementKind,
  PolicyReview,
  SixScreenOptionalAnalysisRecovery,
  SixScreenWorkflowState,
} from "../core/six-screen/contracts";
import { SIX_SCREEN_OPTIONAL_ANALYSIS_RECOVERY_VERSION } from
  "../core/six-screen/contracts";
import { LOCAL_MODEL_ALLOWANCE_DEFAULTS, localModelAllowanceBlocker,
  modelTaskProfile, type LocalModelAllowanceWindow } from
  "../core/six-screen/model-task-profiles";
import {
  screen4InterpretationAttemptIds,
  screen4InterpretationBatches,
  screen4InterpretationTaskFingerprint,
  knownObservedProviderHttpFailure,
  validateScreen4InterpretationAttempts,
  SCREEN4_INTERPRETATION_MAX_HISTORY,
  type Screen4AssessmentQueue,
  type Screen4InterpretationAttempt,
} from "../core/six-screen/screen4-interpretation-queue";
import {
  prepareScreen4Interpretation,
  requestScreen4Interpretation,
  parseSavedScreen4InterpretationReceipt,
  validateScreen4Interpretation,
  SCREEN4_OPENAI_INTERPRETATION_RESERVATION,
  type LegacyScreen4OpenAIInterpretation,
  type Screen4OpenAIInterpretation,
} from "./screen4-openai-interpretation";
import { SIX_SCREEN_POLICY_REVIEW_PROTOCOL_VERSION } from
  "../core/six-screen/contracts";
import {
  createEvidenceSnapshot,
  type EvidenceCollection,
} from "../core/six-screen/evidence";
import {
  createPolicyChronologySourcePanelForSavedReview,
  type PolicyChronologySourcePanelProjection,
  type PolicyChronologyStage,
} from "../core/six-screen/policy-chronology";
import {
  validatePolicyEventCardReviewCollection,
  type PolicyClaimReviewDecision,
  type PolicyEventCardReviewState,
} from "../core/six-screen/policy-event-card-review";
import {
  createPolicyBriefing,
  mergePolicyEvidenceCollections,
  projectPolicyEvidenceClaims,
  unsearchedFederalRegisterPolicyRequirements,
  unsearchedOfficialDocumentPolicyRequirements,
} from "../core/six-screen/policy-review";
import {
  assessPolicyBriefingQuality,
} from "../core/six-screen/policy-briefing-quality";
import {
  activateHistoricalPolicyEvidencePlan,
  adaptPolicyEvidencePlanToBriefingQuality,
  createFederalRegisterPolicyEvidencePlan,
  createOfficialDocumentPolicyEvidencePlan,
  policyEvidenceExecutionForStep,
  recordPolicyEvidencePlanAttempt,
  validatePolicyEvidencePlan,
} from "../core/six-screen/policy-evidence-plan";
import {
  addOfficialIdentitySource,
  buildCausalComparison,
  currentCoEventExecutionPlan,
  currentCoEventSearchMatrix,
  currentCoEventSearchExecution,
  currentCausalDesignDecision,
  currentCausalDesignSet,
  decideStudyDesignAdvice,
  currentMechanismLiteraturePlan,
  currentMechanismLiteratureExecution,
  currentMechanismLiteratureExecutionPlan,
  currentMechanismReview,
  currentPredictionMatrix,
  currentMechanismSynthesisInputPacket,
  currentScreen6DiagnosticPlan,
  currentScreen6DiagnosticResultReviews,
  currentScreen6DiagnosticResults,
  currentScreen6ConditionalClaimBoundary,
  currentScreen6ResearchPlanningDisposition,
  currentScreen6ResearchExport,
  currentScreen6UncertaintyProfile,
  currentScholarlyEvidencePacket,
  currentScholarlyPassagePacket,
  currentScholarlyClaimPacket,
  decideCausalComparison,
  applyPolicyEventCardClaimDecision,
  applyPolicyReview,
  applyPolicyTreatmentClockDecision,
  applyIdentityResolution,
  beginPolicyEventCardReview,
  beginIdentityResolution,
  confirmDisplayedShock,
  commitStudyFirstEventInvestigation,
  commitStudyFirstMechanismRun,
  createSixScreenWorkflow,
  currentStudyFirstMechanismContext,
  currentStudyFirstMechanismInputForState,
  currentStudyFirstMechanismRunForState,
  deferDisplayedCandidate,
  displayIdentityCandidate,
  lockReviewedPolicyEventCard,
  openScreen2,
  openScreen3,
  rebuildScreen3Guidance as rebuildScreen3GuidanceState,
  openScreen4,
  openScreen5,
  openScreen6,
  refineStudyDesignAdvice,
  prepareMechanismSynthesisInput,
  saveMechanismReview,
  initializeScreen6UncertaintyProfile,
  recordCoEventSearchExecution,
  recordMechanismLiteratureExecution,
  recordScholarlyDocumentAcquisition,
  recordScholarlyClaimExtraction,
  recordScreen6DiagnosticResult,
  recordScreen6ResearchPlanningDisposition,
  createScreen6ResearchExportRecord,
  recordPolicyLifecycleStageDocumentAcquisition,
  proposePolicyLifecycleStageRevision,
  reviewCoEventDuplicatePair,
  reviewCoEventOccurrence,
  reviewCoEventRelation,
  reviewScholarlyClaim,
  reviewScreen6DiagnosticResult,
  reviewPolicyLifecycleStageDocument,
  reviewPolicyLifecycleStageRevision,
  routeCoEventPolicyStageToScreen2,
  saveCoEventSearchMatrix,
  saveMechanismLiteraturePlan,
  saveStudyFirstMechanismInput,
  saveScreen6DiagnosticPlan,
  saveScreen6ConditionalClaimBoundary,
  screen3PrerequisiteReport,
  screen4PrerequisiteReport,
  screen5PrerequisiteReport,
  screen6PrerequisiteReport,
  updateShockRequest,
  updateStudyContext,
  type Screen3StartReceipt,
  type StudyContextDraft,
} from "../core/six-screen/workflow";
import {
  createCompletedStudyFirstEventInvestigation,
  createRefreshedStudyFirstEventInvestigation,
  currentStudyFirstEventInvestigation,
  studyFirstEventSourceInputFingerprint,
  STUDY_FIRST_EVENT_DISCOVERY_VERSION,
  STUDY_FIRST_EVENT_MAX_HISTORY,
  STUDY_FIRST_EVENT_MAX_VISIBLE,
  type StudyFirstEventInvestigation,
  type StudyFirstEventRelevanceAnalysis,
  type StudyFirstEventScreen5Handoff,
} from "../core/six-screen/study-first-event-investigation";
import {
  assessStudyFirstMechanismInput,
  createStudyFirstMechanismInput,
  createStudyFirstMechanismPlan,
  createStudyFirstMechanismRun,
  createStudyFirstTheoreticalProblem,
  type StudyFirstMechanismInput,
  type StudyFirstMechanismRun,
} from "../core/six-screen/study-first-mechanism-comparison";
import {
  SCREEN5_OPENAI_MAX_ATTEMPTS,
  SCREEN5_OPENAI_MAX_TOKENS,
  SCREEN5_OPENAI_COMPARISON_OUTPUT_CEILING,
  SCREEN5_OPENAI_COMPARISON_INPUT_CEILING,
  SCREEN5_OPENAI_COMPARISON_RESERVED_TOKENS,
  SCREEN5_OPENAI_EXECUTION_VERSION,
  SCREEN5_OPENAI_JOB_AUTHORIZATION_VERSION,
  SCREEN5_OPENAI_MODEL,
  SCREEN5_OPENAI_PLAN_OUTPUT_CEILING,
  SCREEN5_OPENAI_PLAN_INPUT_CEILING,
  SCREEN5_OPENAI_PLAN_RESERVED_TOKENS,
  SCREEN5_MECHANISM_PLAN_WIRE_VERSION,
  PREVIOUS_SCREEN5_MECHANISM_PLAN_WIRE_VERSION,
  SCREEN5_MECHANISM_COMPARISON_WIRE_VERSION,
  createScreen5MechanismAssessmentBatchPlan,
  createScreen5MechanismComparison,
  createScreen5MechanismEvidencePacket,
  createScreen5OpenAIExecution,
  nextScreen5MechanismAssessmentBatch,
  updateScreen5MechanismProviderReceipt,
  type Screen5MechanismAttempt,
  type Screen5MechanismBudgetSnapshot,
  type Screen5MechanismComparisonWire,
  type Screen5MechanismExecution,
  type Screen5MechanismJobAuthorization,
  type Screen5MechanismPlanWire,
  type Screen5MechanismProviderReceipt,
  type Screen5MechanismUsage,
  type Screen5MechanismValidationIssue,
} from "../core/six-screen/screen5-mechanism";
import {
  HISTORICAL_OPENAI_SCREEN5_EXECUTION_VERSION,
  HISTORICAL_SCREEN5_COMPARISON_WIRE_VERSION,
  HISTORICAL_SCREEN5_V2_COMPARISON_WIRE_VERSION,
  type HistoricalScreen5Provider,
} from "../core/six-screen/screen5-historical-record";
import {
  EMPTY_STUDY_DESIGN_CLARIFICATIONS,
  SIX_SCREEN_STUDY_DESIGN_LIBRARY_VERSION,
  STUDY_DESIGN_METHOD_LIBRARY,
  currentProposedTreatmentTiming,
  currentScreen3StudyEntryContext,
  currentStudyDesignAdvice,
  currentStudyDesignSelection,
  type ProposedTreatmentTimingInput,
  type StudyDesignAdvice,
  type StudyDesignClarifications,
  type StudyDesignSelection,
} from "../core/six-screen/study-design-advice";
import type { Screen6UncertaintyProfile } from
  "../core/six-screen/screen6-uncertainty-profile";
import {
  SIX_SCREEN_DIAGNOSTIC_PLAN_MAX_REVISIONS,
  createScreen6DiagnosticPlanInput,
  type Screen6DiagnosticPlan,
  type Screen6DiagnosticPlanInput,
} from "../core/six-screen/screen6-diagnostic-plan";
import {
  SIX_SCREEN_DIAGNOSTIC_RESULT_MAX_RECORDS,
  SIX_SCREEN_DIAGNOSTIC_RESULT_REVIEW_MAX_RECORDS,
  createScreen6DiagnosticResultInput,
  type Screen6DiagnosticResult,
  type Screen6DiagnosticResultInput,
  type Screen6DiagnosticResultReview,
  type Screen6DiagnosticResultReviewDecision,
} from "../core/six-screen/screen6-diagnostic-result";
import {
  SIX_SCREEN_CLAIM_BOUNDARY_MAX_REVISIONS,
  SIX_SCREEN_RESEARCH_DISPOSITION_MAX_RECORDS,
  createScreen6ClaimBoundaryInput,
  type Screen6ClaimBoundaryInput,
  type Screen6ConditionalClaimBoundary,
  type Screen6ResearchPlanningDisposition,
  type Screen6ResearchPlanningDispositionDecision,
} from "../core/six-screen/screen6-claim-boundary";
import {
  SIX_SCREEN_RESEARCH_EXPORT_MAX_RECORDS,
  type Screen6ResearchExport,
} from "../core/six-screen/screen6-research-export";
import {
  createMechanismLiteraturePlanInput,
  type MechanismLiteraturePlan,
  type MechanismLiteraturePlanInput,
} from "../core/six-screen/mechanism-literature-plan";
import {
  createMechanismLiteratureExecution,
  createMechanismLiteratureExecutionPlan,
  createScholarlyEvidencePacket,
  validateMechanismLiteratureExecution,
  validateMechanismLiteratureExecutionPlan,
  validateMechanismLiteratureProviderAttempt,
  validateScholarlyEvidencePacket,
  validateScholarlyMetadataRecord,
  type MechanismLiteratureExecution,
  type MechanismLiteratureExecutionPlan,
  type MechanismLiteratureProviderAttempt,
  type ScholarlyEvidencePacket,
  type ScholarlyMetadataRecord,
} from "../core/six-screen/mechanism-literature-execution";
import {
  SIX_SCREEN_SCHOLARLY_DOCUMENT_MAX_ACQUISITIONS,
  buildScholarlyDocumentTargets,
  createScholarlyDocumentInspectionInput,
  createScholarlyDocumentInspectionPlan,
  createScholarlyPassagePacket,
  validateScholarlyDocumentAcquisition,
  validateScholarlyDocumentInspectionInput,
  validateScholarlyDocumentInspectionPlan,
  validateScholarlyPassagePacket,
  type ScholarlyDocumentAcquisition,
  type ScholarlyDocumentInspectionInput,
  type ScholarlyDocumentTarget,
  type ScholarlyPassagePacket,
} from "../core/six-screen/mechanism-scholarly-document";
import {
  SIX_SCREEN_SCHOLARLY_CLAIM_MAX_EXTRACTIONS,
  SIX_SCREEN_SCHOLARLY_CLAIM_MAX_REVIEWS,
  type ScholarlyClaimExtraction,
  type ScholarlyClaimFieldsDraft,
  type ScholarlyClaimPacket,
  type ScholarlyClaimReview,
  type ScholarlyClaimReviewDecision,
} from "../core/six-screen/mechanism-scholarly-claim-review";
import type { MechanismSynthesisInputPacket } from
  "../core/six-screen/mechanism-synthesis-input";
import type {
  MechanismReview,
  MechanismReviewDraft,
  PredictionMatrix,
} from "../core/six-screen/mechanism-review";
import {
  INITIAL_CAUSAL_METHOD_LIBRARY,
  SIX_SCREEN_CAUSAL_METHOD_LIBRARY_VERSION,
  createCausalComparisonInput,
  type CausalComparisonInput,
  type CausalDesignDecision,
  type CausalDesignSet,
} from "../core/six-screen/causal-comparison";
import {
  createCoEventSearchScopeInput,
  type CoEventSearchMatrix,
  type CoEventSearchScopeInput,
} from "../core/six-screen/co-event-search";
import {
  createCoEventExecutionPlan,
  createCoEventSearchExecution,
  validateCoEventCandidateOccurrence,
  validateCoEventDiscoveryLead,
  validateCoEventExecutionPlan,
  validateCoEventProviderAttempt,
  validateCoEventSearchExecution,
  type CoEventCandidateOccurrence,
  type CoEventDiscoveryLead,
  type CoEventExecutionPlan,
  type CoEventProviderAttempt,
  type CoEventSearchExecution,
} from "../core/six-screen/co-event-execution";
import type {
  CoEventDuplicateReview,
  CoEventDuplicateReviewDecision,
  CoEventOccurrenceReview,
  CoEventOccurrenceReviewDecision,
} from "../core/six-screen/co-event-occurrence-review";
import type {
  CoEventRelationReview,
  CoEventRelationReviewDecision,
} from "../core/six-screen/co-event-relation-review";
import type {
  CoEventPolicyLifecycleHandoff,
  CoEventPolicyLifecycleStageKind,
} from "../core/six-screen/co-event-policy-lifecycle-handoff";
import {
  SIX_SCREEN_POLICY_LIFECYCLE_MAX_ACQUISITIONS_PER_HANDOFF,
  createPolicyLifecycleStageDocumentAcquisition,
  type PolicyLifecycleStageDisposition,
  type PolicyLifecycleStageDispositionDecision,
  type PolicyLifecycleStageDocumentAcquisition,
} from "../core/six-screen/policy-lifecycle-stage-review";
import {
  policyLifecycleStageChronologyOptions,
  policyLifecycleStageSourceDateOptions,
  type PolicyLifecycleStageRevisionDecision,
  type PolicyLifecycleStageRevisionProposal,
  type PolicyLifecycleStageRevisionReview,
  type PolicyLifecycleStageSourceDateOption,
} from "../core/six-screen/policy-lifecycle-stage-revision";
import {
  commitResearchTaskOperation,
  createResearchTask,
  expireResearchTaskOperation,
  reserveResearchTaskOperation,
  type ResearchTask,
} from "../core/six-screen/research-task";
import {
  SCREEN_01_IDENTITY_ROUTE_VERSION,
  resolveScreen01Identity,
  type Screen01IdentityResolutionResult,
} from "./screen01-identity-resolution";
import type { Screen02ConnectorFetch } from "./screen02-connectors";
import {
  SIX_SCREEN_COEVENT_EXECUTOR_VERSION,
  coEventProviderExecutionCapabilities,
  executeCoEventProviderStep,
  type CoEventProviderExecutionResult,
} from "./screen04-coevent-execution";
import {
  STUDY_FIRST_EVENT_EXECUTOR_VERSION,
  executeStudyFirstEventInvestigation,
  executeStudyFirstEventInvestigationStep,
  finalizeStudyFirstEventInvestigation,
  rebindStudyFirstEventSourceResult,
  rebindStudyFirstEventStepResult,
  studyFirstEventStepResourceCaps,
  unknownStudyFirstEventStepResult,
  type StudyFirstEventStepExecutionResult,
} from "./screen04-study-first-investigation";
import {
  STUDY_FIRST_MECHANISM_EXECUTOR_VERSION,
  executeStudyFirstMechanismDiscovery,
} from "./screen05-study-first-mechanism";
import {
  Screen5OpenAIProviderError,
  admitScreen5OpenAIAssessmentRequest,
  requestScreen5OpenAIAssessment,
  requestScreen5OpenAIPlan,
  validateSavedOpenAIReceipt,
  type Screen5OpenAIFetch,
} from "./screen5-openai-provider";
import { SCREEN5_OPENAI_REQUEST_DEADLINE_MS,
  type Screen5OpenAIFailureStage } from
  "./screen5-openai-transport";
import {
  prepareScreen2PolicyInterpretation,
  requestScreen2PolicyInterpretation,
  requestScreen2PolicyInterpretationRepair,
  SCREEN2_OPENAI_POLICY_INTERPRETATION_RESERVATION,
} from "./screen2-openai-policy-interpretation";
import {
  requestScreen2PolicySourceDiscovery,
  SCREEN2_OPENAI_POLICY_SOURCE_DISCOVERY_RESERVATION,
  Screen2PolicySourceDiscoveryError,
  type Screen2PolicySourceDiscoveryRequest,
} from "./screen2-openai-policy-source-discovery";
import {
  Screen5MechanismWireValidationError,
  SCREEN5_PLAN_VALIDATION_REVISION,
  SCREEN5_ASSESSMENT_VALIDATION_REVISION,
  normalizeScreen5MechanismPlanWire,
  screen5MechanismPlanFromWire,
  screen5MechanismPlanningInputEstimate,
  validateScreen5MechanismComparisonWire,
  validateScreen5MechanismPlanWire,
} from "./screen5-mechanism-contract";
import { Screen5OpenAILedgerStore } from
  "./screen5-openai-ledger";
import {
  buildSixScreenSourceRegister,
  type SixScreenCapabilityProbe,
  type SixScreenSourceId,
  type SixScreenSecretName,
} from "./six-screen-source-register";
import { probeConfiguredSixScreenSources } from
  "./six-screen-source-capability-probes";
import {
  SIX_SCREEN_MECHANISM_LITERATURE_EXECUTOR_LEGACY_VERSION,
  SIX_SCREEN_MECHANISM_LITERATURE_EXECUTOR_VERSION,
  executeMechanismLiteratureProviderStep,
  isSupportedMechanismLiteratureExecutorVersion,
  type MechanismLiteratureProviderExecutionResult,
  type SixScreenMechanismLiteratureExecutorVersion,
} from "./screen05-literature-execution";
import {
  SIX_SCREEN_SCHOLARLY_DOCUMENT_ADAPTER_VERSION,
  acquireScholarlyDocumentPassage,
} from "./screen05-scholarly-document";
import {
  SIX_SCREEN_WORKFLOW_RESUME_RETENTION_MS,
  SixScreenWorkflowStore,
  type SixScreenWorkflowAuthentication,
  type SixScreenWorkflowStoreRecord,
} from "./six-screen-workflow-store";
import type {
  SixScreenResearchTaskRecord,
  SixScreenResearchTaskStore,
} from "./six-screen-research-task-store";
import {
  createScreen4AssessmentManifest,
  SCREEN4_ASSESSMENT_MAX_ATTEMPTS,
  type Screen4AssessmentStore,
  type Screen4AssessmentStoreRecord,
} from "./screen4-assessment-store";
import {
  SixScreenEvidenceCapacityError,
  type SixScreenEvidenceStore,
} from "./six-screen-evidence-store";
import type { HostReasoningTaskStore } from
  "./host-reasoning-task-store";
import {
  SHOCKAUDIT_VERSION,
  SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI,
} from "../version";
import {
  SCREEN05_THEORETICAL_PLANNING_TASK,
  screen05TheoreticalPlanningResultSchema,
} from "./study-first-host-intelligence";
import {
  acquireScreen02FederalRegisterPolicy,
  type Screen02FederalRegisterAcquisitionResult,
} from "./screen02-federal-register-acquisition";
import {
  acquireScreen02OfficialDocumentPolicy,
  preferredScreen02OfficialDocumentSource,
  SIX_SCREEN_OFFICIAL_DOCUMENT_POLICY_ADAPTER_VERSION,
  type Screen02OfficialDocumentAcquisitionResult,
} from "./screen02-official-document-acquisition";
import {
  acquireScreen02EcfrHistoricalPolicy,
  SIX_SCREEN_ECFR_HISTORY_ADAPTER_VERSION,
  SIX_SCREEN_ECFR_VERSION_METADATA_MAX_BYTES,
  SIX_SCREEN_ECFR_VERSION_METADATA_MAX_RECORDS,
  type Screen02EcfrHistoricalAcquisitionResult,
} from "./screen02-ecfr-history-acquisition";
import {
  SIX_SCREEN_GOVINFO_ANNUAL_CFR_SEARCH_MAX_BYTES,
  SIX_SCREEN_GOVINFO_ANNUAL_CFR_XML_MAX_BYTES,
} from "./screen02-govinfo-cfr-annual-acquisition";
import {
  acquireScreen02PolicyLifecycleStageDocument,
} from "./screen02-policy-lifecycle-stage-acquisition";
import {
  acquireScreen02RegulationsGovPolicy,
  SIX_SCREEN_REGULATIONS_GOV_ADAPTER_VERSION,
  type Screen02RegulationsGovAcquisitionResult,
} from "./screen02-regulations-gov-acquisition";
import {
  acquireScreen02ComplementaryPolicyEvidence,
  SIX_SCREEN_COMPLEMENTARY_POLICY_EVIDENCE_ADAPTER_VERSION,
  type Screen02ComplementaryEvidenceAcquisitionResult,
  type Screen02ComplementaryEvidenceLead,
  type Screen02ComplementarySourceDiscoveryResult,
} from "./screen02-complementary-evidence-acquisition";

export const SIX_SCREEN_WORKFLOW_PUBLIC_SCHEMA_VERSION =
  "shockaudit-six-screen-public-v1" as const;
export const SIX_SCREEN_WORKFLOW_PRIVATE_SCHEMA_VERSION =
  "shockaudit-six-screen-private-v1" as const;
export const SIX_SCREEN_POLICY_EVENT_CARD_WORKSPACE_SCHEMA_VERSION =
  "screen-02-policy-event-card-workspace-v1" as const;
export const SIX_SCREEN_CAUSAL_COMPARISON_WORKSPACE_SCHEMA_VERSION =
  "screen-03-causal-comparison-workspace-v1" as const;
export const SIX_SCREEN_COEVENT_SEARCH_WORKSPACE_SCHEMA_VERSION =
  "screen-04-coevent-search-workspace-v1" as const;
export const SIX_SCREEN_MECHANISM_LITERATURE_WORKSPACE_SCHEMA_VERSION =
  "screen-05-mechanism-literature-workspace-v1" as const;
export const SIX_SCREEN_STUDY_FIRST_MECHANISM_WORKSPACE_SCHEMA_VERSION =
  "screen-05-study-first-mechanism-workspace-v1" as const;
export const SIX_SCREEN_UNCERTAINTY_WORKSPACE_SCHEMA_VERSION =
  "screen-06-uncertainty-workspace-v1" as const;
export const SIX_SCREEN_POLICY_LIFECYCLE_STAGE_WORKSPACE_SCHEMA_VERSION =
  "screen-02-policy-lifecycle-stage-workspace-v1" as const;

export function isRetainedFederalRegisterApiPlanSource(
  source: IdentityCandidate["identitySources"][number],
  documentNumber: string,
) {
  const retainedText = source.retainedText?.replace(/\s+/gu, " ").trim() ?? "";
  return (
    source.routeId === "federal_register_api_excerpt" &&
    source.nativeId === documentNumber &&
    source.locator ===
      `https://www.federalregister.gov/api/v1/documents/${documentNumber}.json` &&
    source.accessStatus === "retained_passage" &&
    source.inspectedText === "abstract" &&
    typeof source.contentHash === "string" &&
    source.contentHash.trim().length > 0 &&
    retainedText.length >= 80 &&
    retainedText.includes(`Federal Register document ${documentNumber}`)
  );
}

export type SixScreenWorkflowPrivateSnapshot = {
  schemaVersion: typeof SIX_SCREEN_WORKFLOW_PRIVATE_SCHEMA_VERSION;
  runId: string;
  accessToken: string;
  revision: number;
  stateFingerprint: string;
  state: SixScreenWorkflowState;
};

export type PolicyEventCardRevisionDisplayStatus =
  | "in_review"
  | "pending_revision"
  | "current"
  | "review_required"
  | "superseded"
  | "replaced_unfinished";

export type PolicyEventCardRevisionSummary = {
  reviewId: string;
  seriesId: string;
  ordinal: number;
  status: PolicyEventCardRevisionDisplayStatus;
  evidenceSnapshotId: string;
  createdAt: string;
  updatedAt: string;
  supersedesReviewId: string | null;
  eventCardSnapshotId: string | null;
  changes: Array<{
    revision: number;
    kind: PolicyEventCardReviewState["changeHistory"][number]["kind"];
    at: string;
    summary: string;
  }>;
};

type PolicyEventCardWorkspaceBase = {
  schemaVersion: typeof SIX_SCREEN_POLICY_EVENT_CARD_WORKSPACE_SCHEMA_VERSION;
  activeReview: PolicyEventCardReviewState | null;
  revisions: PolicyEventCardRevisionSummary[];
};

export type PolicyEventCardWorkspace = PolicyEventCardWorkspaceBase & (
  | {
      availability: "ready";
      unavailableReason: null;
      reviewStatus:
        | "not_started"
        | "in_review"
        | "pending_revision"
        | "current"
        | "review_required";
      projection: PolicyChronologySourcePanelProjection;
    }
  | {
      availability: "unavailable";
      unavailableReason:
        | "evidence_store_unconfigured"
        | "evidence_snapshot_unavailable";
      reviewStatus: "unavailable";
      projection: null;
    }
);

export type CausalComparisonWorkspace = {
  schemaVersion: typeof SIX_SCREEN_CAUSAL_COMPARISON_WORKSPACE_SCHEMA_VERSION;
  methodLibraryVersion: typeof SIX_SCREEN_CAUSAL_METHOD_LIBRARY_VERSION;
  methodLibrary: typeof INITIAL_CAUSAL_METHOD_LIBRARY;
  designSet: CausalDesignSet | null;
  decision: CausalDesignDecision | null;
  revisions: Array<{
    designSetSnapshotId: string;
    ordinal: number;
    createdAt: string;
    eventCardSnapshotId: string;
    optionCount: number;
    artifactStatus: SixScreenWorkflowState["artifacts"][number]["status"];
    decision: "selected" | "no_selection" | "not_decided";
    selectedOptionLabel: string | null;
  }>;
  studyFirst: {
    methodLibraryVersion: typeof SIX_SCREEN_STUDY_DESIGN_LIBRARY_VERSION;
    methodLibrary: typeof STUDY_DESIGN_METHOD_LIBRARY;
    timing: ReturnType<typeof currentProposedTreatmentTiming>;
    entryContext: ReturnType<typeof currentScreen3StudyEntryContext>;
    advice: StudyDesignAdvice | null;
    contextualization: Screen3PublicContextualization | null;
    selection: StudyDesignSelection | null;
    defaultClarifications: StudyDesignClarifications;
    revisions: Array<{
      adviceId: string;
      createdAt: string;
      studyRevision: number;
      optionCount: number;
      warningCount: number;
      executionMode: "library_only";
      selected: boolean;
    }>;
  };
};

export type CoEventSearchWorkspace = {
  schemaVersion: typeof SIX_SCREEN_COEVENT_SEARCH_WORKSPACE_SCHEMA_VERSION;
  matrix: CoEventSearchMatrix | null;
  executionPlan: CoEventExecutionPlan | null;
  execution: CoEventSearchExecution | null;
  attempts: CoEventProviderAttempt[];
  candidates: CoEventCandidateOccurrence[];
  discoveryLeads: CoEventDiscoveryLead[];
  occurrenceReviews: CoEventOccurrenceReview[];
  duplicateReviews: CoEventDuplicateReview[];
  relationReviews: CoEventRelationReview[];
  policyLifecycleHandoffs: Array<{
    handoff: CoEventPolicyLifecycleHandoff;
    candidate: CoEventCandidateOccurrence;
    occurrenceReview: CoEventOccurrenceReview;
    targetReviewStatus:
      | "pending_event_card_review"
      | "reviewed_event_card_locked"
      | "review_revision_superseded";
  }>;
  revisions: Array<{
    matrixSnapshotId: string;
    ordinal: number;
    createdAt: string;
    mode: CoEventSearchMatrix["mode"];
    rowCount: number;
    executionStatus: CoEventSearchMatrix["execution"]["status"];
    artifactStatus: SixScreenWorkflowState["artifacts"][number]["status"];
  }>;
  executionRevisions: Array<{
    executionSnapshotId: string;
    ordinal: number;
    recordedAt: string;
    status: CoEventSearchExecution["status"];
    attemptId: string | null;
    candidateCount: number;
    remainingStepCount: number;
    artifactStatus: SixScreenWorkflowState["artifacts"][number]["status"];
  }>;
};

export type StudyFirstEventInvestigationWorkspace = {
  investigation: StudyFirstEventInvestigation | null;
  /** The authenticated saved source supplying Screen 6 and the report. */
  retainedSource?: {
    investigation: StudyFirstEventInvestigation;
    interpretationQueue: Screen4PublicInterpretationQueue | null;
  };
  /** Durable source work is panel-driven. A read of these facts never starts
   * or retries a source request. */
  discoveryTask: Screen4DiscoveryTaskFacts | null;
  /** Source-linked records remain visible before optional interpretation or
   * final presentation construction completes. */
  documentedOccurrences: CoEventCandidateOccurrence[];
  refreshAvailable: boolean;
  sourceVersionCurrent: boolean;
  interpretationQueue: Screen4PublicInterpretationQueue | null;
  interpretationRevisions: Array<{
    taskFingerprint: string;
    investigationSnapshotId: string;
    completedCount: number;
    totalCount: number;
    status: Screen4PublicInterpretationQueue["status"];
  }>;
  latestScreen5Handoff: StudyFirstEventScreen5Handoff | null;
  revisions: Array<{
    snapshotId: string;
    contextId: string;
    ordinal: number;
    status: StudyFirstEventInvestigation["status"];
    visibleEventCount: number;
    completedAt: string | null;
  }>;
  claimBoundary: string;
};

export type Screen4DiscoveryTaskFacts = {
  taskId: string;
  state: "not_started" | "preparing" | "active" | "partial" |
    "complete" | "complete_zero" | "failed" | "outcome_unknown" |
    "outdated";
  stage: "preparation" | "source_retrieval" | "local_processing" |
    "artifact_storage" | "complete";
  nextAction: "start" | "resume" | "observe" | "none";
  completedStepCount: number;
  totalStepCount: number;
  pendingStepCount: number;
  queryCount: number;
  documentCount: number;
  recordsReceived: number;
  recordsAccepted: number;
  stopReason: string | null;
  continuationMode: "panel_driven";
  continuationDisclosure: string;
};

export type Screen4PublicInterpretationQueue = Screen4AssessmentQueue;

export type MechanismLiteratureWorkspace = {
  schemaVersion:
    typeof SIX_SCREEN_MECHANISM_LITERATURE_WORKSPACE_SCHEMA_VERSION;
  plan: MechanismLiteraturePlan | null;
  executionPlan: MechanismLiteratureExecutionPlan | null;
  execution: MechanismLiteratureExecution | null;
  attempts: MechanismLiteratureProviderAttempt[];
  metadataRecords: ScholarlyMetadataRecord[];
  evidencePacket: ScholarlyEvidencePacket | null;
  documentTargets: ScholarlyDocumentTarget[];
  documentAcquisitions: ScholarlyDocumentAcquisition[];
  passagePacket: ScholarlyPassagePacket | null;
  claimExtractions: ScholarlyClaimExtraction[];
  claimReviews: ScholarlyClaimReview[];
  claimPacket: ScholarlyClaimPacket | null;
  synthesisInputPacket: MechanismSynthesisInputPacket | null;
  mechanismReview: MechanismReview | null;
  predictionMatrix: PredictionMatrix | null;
  revisions: Array<{
    planSnapshotId: string;
    ordinal: number;
    createdAt: string;
    explanationMode: MechanismLiteraturePlan["input"]["explanation"]["mode"];
    policyPremiseCount: number;
    artifactStatus: SixScreenWorkflowState["artifacts"][number]["status"];
  }>;
  executionRevisions: Array<{
    executionSnapshotId: string;
    ordinal: number;
    recordedAt: string;
    status: MechanismLiteratureExecution["status"];
    branch: MechanismLiteratureProviderAttempt["branch"] | null;
    attemptOutcome: MechanismLiteratureProviderAttempt["outcome"] | null;
    metadataRecordCount: number;
    remainingStepCount: number;
    artifactStatus: SixScreenWorkflowState["artifacts"][number]["status"];
  }>;
  claimBoundary: string;
};

export type StudyFirstMechanismWorkspace = {
  schemaVersion:
    typeof SIX_SCREEN_STUDY_FIRST_MECHANISM_WORKSPACE_SCHEMA_VERSION;
  currentInput: StudyFirstMechanismInput | null;
  currentRun: StudyFirstMechanismRun | null;
  previousCompatibleRun: StudyFirstMechanismRun | null;
  /** Present on current Worker responses; optional only for legacy fixtures. */
  executionReadiness?: Screen5ExecutionReadiness;
  revisions: Array<{
    runId: string;
    ordinal: number;
    inputRevision: number;
    status: StudyFirstMechanismRun["status"];
    workCount: number;
    abstractCount: number;
    createdAt: string;
  }>;
  claimBoundary: string;
};

export const SCREEN5_EXECUTION_READINESS_VERSION =
  "screen-05-execution-readiness-v2" as const;

export const SCREEN5_EXECUTION_MISSING_SETTINGS = [
  "SHOCKAUDIT_SCREEN5_OPENAI_MODE",
  "OPENAI_API_KEY",
  "SCREEN5_OPENAI_TRANSPORT",
  "SCREEN5_OPENAI_LEDGER_STORE",
] as const;

export type Screen5ExecutionMissingSetting =
  typeof SCREEN5_EXECUTION_MISSING_SETTINGS[number];

export type Screen5ExecutionReadiness = {
  schemaVersion: typeof SCREEN5_EXECUTION_READINESS_VERSION;
  selectedBackend: "openai" | "off" | "unresolved";
  provider: "openai";
  model: typeof SCREEN5_OPENAI_MODEL;
  route: "direct" | "direct_setup_required";
  configuration: "ready" | "blocked" | "off" | "unresolved";
  missingSettings: Screen5ExecutionMissingSetting[];
  keyPresent: boolean;
  credentialStatus:
    | "not_tested"
    | "last_success"
    | "last_401"
    | "other_failure";
  ledgerState:
    | "valid"
    | "uninitialized"
    | "missing_binding"
    | "missing_import"
    | "invalid"
    | "exhausted"
    | "unresolved";
  allowance: null | {
    policyMode?: "bounded" | "reviewer" | "unlimited";
    accountingVersion?: "persistent-v3";
    lastRenewalId?: string;
    lastRenewalWindow?: LocalModelAllowanceWindow;
    maximumAttempts: number;
    maximumTokens: number;
    conservativePriorAttempts: number;
    conservativePriorTokens: number;
    localAttemptsReserved: number;
    localObservedTokens: number;
    localHeldTokens: number;
    remainingAttempts: number;
    remainingTokens: number;
  };
  authorization:
    | "authorized"
    | "required"
    | "job_mismatch"
    | "not_applicable"
    | "unresolved";
  authorizedStages: Array<"planning" | "assessment">;
  activeOrigin:
    | "openai"
    | HistoricalScreen5Provider
    | "chatgpt_host"
    | "test_probe_boundary"
    | "none";
  activeExecutionId: string | null;
  migration:
    | "eligible"
    | "prepared"
    | "not_needed"
    | "blocked"
    | "unresolved";
  canEnsure: boolean;
  canAdvanceWithoutInference: boolean;
  canDispatch: boolean;
  /** Server clock sample for interpreting absolute provider deadlines. */
  serverObservedAt: string | null;
  nextAction:
    | "configure_direct_mode"
    | "provide_server_key"
    | "configure_pilot_ledger"
    | "initialize_pilot_ledger"
    | "request_execution_authorization"
    | "recheck_saved_response"
    | "restore_saved_mechanisms"
    | "restore_saved_comparison"
    | "read_saved_diagnostic"
    | "ensure_direct_job"
    | "resume_direct_job"
    | "read_completed_result"
    | "none";
};

export type Screen5OpenAIExecutionAuthorization = {
  authorizationId: string;
  jobId: string;
  stages: Array<"planning" | "assessment">;
  assessmentBatchId?: string | null;
};

export type Screen6UncertaintyWorkspace = {
  schemaVersion: typeof SIX_SCREEN_UNCERTAINTY_WORKSPACE_SCHEMA_VERSION;
  profile: Screen6UncertaintyProfile | null;
  diagnosticPlan: Screen6DiagnosticPlan | null;
  diagnosticResults: Screen6DiagnosticResult[];
  diagnosticResultReviews: Screen6DiagnosticResultReview[];
  conditionalClaimBoundary: Screen6ConditionalClaimBoundary | null;
  researchPlanningDisposition: Screen6ResearchPlanningDisposition | null;
  researchExport: Screen6ResearchExport | null;
  revisions: Array<{
    profileSnapshotId: string;
    ordinal: number;
    createdAt: string;
    gapCount: number;
    notAssessedCount: number;
    evidenceNeededCount: number;
    artifactStatus: SixScreenWorkflowState["artifacts"][number]["status"];
  }>;
  diagnosticPlanRevisions: Array<{
    planSnapshotId: string;
    ordinal: number;
    createdAt: string;
    cardCount: number;
    primaryCardCount: number;
    inputGapCount: number;
    artifactStatus: SixScreenWorkflowState["artifacts"][number]["status"];
  }>;
  diagnosticResultRevisions: Array<{
    resultId: string;
    ordinal: number;
    cardId: string;
    libraryEntryId: Screen6DiagnosticResult["binding"]["libraryEntryId"];
    submittedAt: string;
    provenanceKind: Screen6DiagnosticResult["provenance"]["kind"];
    reviewReadiness: Screen6DiagnosticResult["reviewReadiness"]["status"];
    artifactStatus: SixScreenWorkflowState["artifacts"][number]["status"];
  }>;
  diagnosticResultReviewRevisions: Array<{
    reviewId: string;
    ordinal: number;
    resultId: string;
    decision: Screen6DiagnosticResultReview["decision"];
    reviewedAt: string;
    artifactStatus: SixScreenWorkflowState["artifacts"][number]["status"];
  }>;
  conditionalClaimBoundaryRevisions: Array<{
    boundarySnapshotId: string;
    ordinal: number;
    claimLevel: Screen6ConditionalClaimBoundary["intendedClaim"]["claimLevel"];
    relationshipToCurrentDesign:
      Screen6ConditionalClaimBoundary["intendedClaim"]["relationshipToCurrentDesign"];
    createdAt: string;
    issueCount: number;
    artifactStatus: SixScreenWorkflowState["artifacts"][number]["status"];
  }>;
  researchPlanningDispositionRevisions: Array<{
    dispositionId: string;
    ordinal: number;
    boundarySnapshotId: string;
    decision: Screen6ResearchPlanningDisposition["decision"];
    decidedAt: string;
    artifactStatus: SixScreenWorkflowState["artifacts"][number]["status"];
  }>;
  researchExportRevisions: Array<{
    exportId: string;
    ordinal: number;
    boundarySnapshotId: string;
    dispositionId: string;
    completenessStatus: Screen6ResearchExport["completeness"]["status"];
    exportedAt: string;
    artifactStatus: SixScreenWorkflowState["artifacts"][number]["status"];
  }>;
  claimBoundary: string;
};

export type PolicyLifecycleStageReviewWorkspace = {
  schemaVersion:
    typeof SIX_SCREEN_POLICY_LIFECYCLE_STAGE_WORKSPACE_SCHEMA_VERSION;
  entries: Array<{
    handoffId: string;
    handoffFingerprint: string;
    targetPolicyEventCardReviewId: string;
    candidateProviderId: CoEventCandidateOccurrence["providerId"];
    adapterAvailability: "ready" | "unsupported_source";
    acquisitions: PolicyLifecycleStageDocumentAcquisition[];
    latestAcquisition: PolicyLifecycleStageDocumentAcquisition | null;
    dispositions: PolicyLifecycleStageDisposition[];
    latestDisposition: PolicyLifecycleStageDisposition | null;
    proposals: PolicyLifecycleStageRevisionProposal[];
    latestProposal: PolicyLifecycleStageRevisionProposal | null;
    proposalReviews: PolicyLifecycleStageRevisionReview[];
    latestProposalReview: PolicyLifecycleStageRevisionReview | null;
    chronologyStageOptions: PolicyChronologyStage[];
    sourceDateOptions: PolicyLifecycleStageSourceDateOption[];
    canAcquire: boolean;
    canRetry: boolean;
    canDispose: boolean;
    canProposeRevision: boolean;
    canReviewRevision: boolean;
  }>;
  claimBoundary: string;
};

export type SixScreenWorkflowPublicProjection = {
  schemaVersion: typeof SIX_SCREEN_WORKFLOW_PUBLIC_SCHEMA_VERSION;
  runId: string;
  revision: number;
  activeScreen: SixScreenWorkflowState["activeScreen"];
  optionalAnalysisRecovery: SixScreenOptionalAnalysisRecovery;
  status: "identity_input" | "identity_resolving" | "identity_review" | "shock_confirmed";
  statusMessage: string;
  study: SixScreenWorkflowState["study"];
  originalShockInput: string;
  currentShockInput: string;
  officialSourceLocators: string[];
  officialIdentifier: string | null;
  requestedJurisdiction: string | null;
  approximateYear: string | null;
  intendedEpisode: string | null;
  identityRevision: number;
  identityResolution: SixScreenWorkflowState["lastIdentityResolution"];
  candidates: Array<{
    id: string;
    officialTitle: string;
    aliases: string[];
    issuer: string;
    issuingJurisdiction: string;
    instrumentType: string;
    formalIdentifiers: string[];
    episode: string;
    versionScope: string;
    typedDates: SixScreenWorkflowState["candidates"][number]["typedDates"];
    displayedDescription: string;
    matchExplanation: string;
    materialMismatches: string[];
    identitySourceIds: string[];
    identityFingerprint: string;
    sourceSnapshotId: string;
    sourceSnapshotFingerprint: string;
    identitySources: SixScreenWorkflowState["candidates"][number]["identitySources"];
    selected: boolean;
  }>;
  confirmedShock: null | {
    id: string;
    officialTitle: string;
    issuer: string;
    issuingJurisdiction: string;
    formalIdentifiers: string[];
    episode: string;
    versionScope: string;
    identityFingerprint: string;
    confirmedAt: string;
  };
  policyReview: PolicyReview | null;
  policyEventCardWorkspace: PolicyEventCardWorkspace | null;
  policyLifecycleStageReviewWorkspace?:
    PolicyLifecycleStageReviewWorkspace | null;
  causalComparisonWorkspace: CausalComparisonWorkspace;
  coEventSearchWorkspace: CoEventSearchWorkspace;
  studyFirstEventInvestigationWorkspace: StudyFirstEventInvestigationWorkspace;
  studyFirstMechanismWorkspace: StudyFirstMechanismWorkspace;
  /** Global provider/allowance readiness. It is intentionally independent of
   * whether a Screen 5 mechanism run exists. */
  modelCapability: Screen5ExecutionReadiness;
  mechanismLiteratureWorkspace: MechanismLiteratureWorkspace;
  screen6UncertaintyWorkspace: Screen6UncertaintyWorkspace;
  screen6CurrentPlan: ReturnType<typeof createScreen6CurrentPlan>;
  screen6Personalization: Screen6PublicPersonalization | null;
  screen6HistoricalPersonalization: Screen6PublicPersonalization | null;
  screen3Prerequisites: ReturnType<typeof screen3PrerequisiteReport>;
  screen4Prerequisites: ReturnType<typeof screen4PrerequisiteReport>;
  screen5Prerequisites: ReturnType<typeof screen5PrerequisiteReport>;
  screen6Prerequisites: ReturnType<typeof screen6PrerequisiteReport>;
  canOpenScreen2: boolean;
  canOpenScreen3: boolean;
  canOpenScreen4: boolean;
  canOpenScreen5: boolean;
  canOpenScreen6: boolean;
  canResearchPolicy: boolean;
  canContinuePolicy: boolean;
  canBuildCausalComparison: boolean;
  canDecideCausalComparison: boolean;
  canSaveCoEventSearchMatrix: boolean;
  canContinueCoEventSearch: boolean;
  canReviewCoEventOccurrence: boolean;
  canReviewCoEventDuplicates: boolean;
  canReviewCoEventRelations: boolean;
  canSaveMechanismLiteraturePlan: boolean;
  canCompareStudyFirstMechanisms: boolean;
  canContinueMechanismLiteratureSearch: boolean;
  canInspectScholarlyDocument: boolean;
  canExtractScholarlyClaim: boolean;
  canReviewScholarlyClaim: boolean;
  canPrepareMechanismSynthesisInput: boolean;
  canSaveMechanismReview: boolean;
  canInitializeScreen6UncertaintyProfile: boolean;
  canSaveScreen6DiagnosticPlan: boolean;
  canRecordScreen6DiagnosticResult: boolean;
  canReviewScreen6DiagnosticResult: boolean;
  canSaveScreen6ConditionalClaimBoundary: boolean;
  canRecordScreen6ResearchPlanningDisposition: boolean;
  canCreateScreen6ResearchExport: boolean;
  continuationDisclosure: string;
};

type PolicyResearchResult = {
  projection: SixScreenWorkflowPublicProjection;
  privateSnapshot: SixScreenWorkflowPrivateSnapshot;
  review: PolicyReview;
  mutationOutcome: "changed" | "unchanged" | "replayed";
};

type CoEventStepCheckpoint = {
  protocolVersion: typeof SIX_SCREEN_COEVENT_EXECUTOR_VERSION;
  plan: CoEventExecutionPlan;
  attempt: CoEventProviderAttempt | null;
  candidates: CoEventCandidateOccurrence[];
  discoveryLeads: CoEventDiscoveryLead[];
  execution: CoEventSearchExecution;
  checkpointFingerprint: string;
};

type StudyFirstEventCheckpoint = {
  protocolVersion: typeof STUDY_FIRST_EVENT_EXECUTOR_VERSION;
  plannedSnapshotId: string;
  planFingerprint: string;
  result: Awaited<ReturnType<typeof executeStudyFirstEventInvestigation>>;
  checkpointFingerprint: string;
};

type StudyFirstEventStepCheckpoint = {
  protocolVersion: typeof STUDY_FIRST_EVENT_EXECUTOR_VERSION;
  plannedSnapshotId: string;
  planFingerprint: string;
  stepId: string;
  invocationOperationId: string;
  result: StudyFirstEventStepExecutionResult;
  checkpointFingerprint: string;
};

type MechanismLiteratureStepCheckpoint = {
  protocolVersion: SixScreenMechanismLiteratureExecutorVersion;
  executionPlan: MechanismLiteratureExecutionPlan;
  attempt: MechanismLiteratureProviderAttempt | null;
  newRecords: ScholarlyMetadataRecord[];
  records: ScholarlyMetadataRecord[];
  execution: MechanismLiteratureExecution;
  packet: ScholarlyEvidencePacket;
  checkpointFingerprint: string;
};

type ScholarlyDocumentCheckpoint = {
  protocolVersion: typeof SIX_SCREEN_SCHOLARLY_DOCUMENT_ADAPTER_VERSION;
  acquisition: ScholarlyDocumentAcquisition;
  passagePacket: ScholarlyPassagePacket;
  checkpointFingerprint: string;
};

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

async function hmac(signingKey: string | Uint8Array, value: string) {
  const keyBytes = typeof signingKey === "string"
    ? new TextEncoder().encode(signingKey)
    : new Uint8Array(signingKey);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)),
  );
}

async function derivedCoordinate(
  prefix: "sa6r_" | "sa6a_",
  signingKey: string | Uint8Array,
  operationId: string,
) {
  return `${prefix}${base64Url(await hmac(signingKey, `${prefix}:${operationId}`))}`;
}

function expiresAt(now: string) {
  return new Date(
    Date.parse(now) + SIX_SCREEN_WORKFLOW_RESUME_RETENTION_MS,
  ).toISOString();
}

function instantAfter(now: string, milliseconds: number) {
  return new Date(Date.parse(now) + milliseconds).toISOString();
}

function policyLifecycleStageReviewWorkspace(
  state: SixScreenWorkflowState,
): PolicyLifecycleStageReviewWorkspace | null {
  if (state.activeScreen !== 2 || !state.confirmedShock) return null;
  const candidateMap = new Map(
    (state.coEventCandidates ?? []).map((candidate) => [candidate.id, candidate]),
  );
  const activeReview = (state.policyEventCardReviews ?? []).at(-1);
  const entries = (state.coEventPolicyLifecycleHandoffs ?? []).flatMap(
    (handoff) => {
      if (
        handoff.focalPolicyReference.identityFingerprint !==
          state.confirmedShock?.identityFingerprint
      ) return [];
      const candidate = candidateMap.get(
        handoff.candidateReference.candidateId,
      );
      if (!candidate) return [];
      const acquisitions = (state.policyLifecycleStageDocumentAcquisitions ?? [])
        .filter(({ handoffReference }) =>
          handoffReference.handoffId === handoff.id);
      const latestAcquisition = acquisitions.at(-1) ?? null;
      const dispositions = (state.policyLifecycleStageDispositions ?? [])
        .filter(({ handoffReference }) =>
          handoffReference.handoffId === handoff.id);
      const latestDisposition = latestAcquisition
        ? [...dispositions].reverse().find(({ acquisitionReference }) =>
            acquisitionReference.acquisitionId === latestAcquisition.id) ?? null
        : null;
      const proposals = (state.policyLifecycleStageRevisionProposals ?? [])
        .filter(({ handoffReference }) =>
          handoffReference.handoffId === handoff.id);
      const latestProposal = proposals.at(-1) ?? null;
      const proposalReviews = latestProposal
        ? (state.policyLifecycleStageRevisionReviews ?? []).filter(
            ({ proposalReference }) =>
              proposalReference.proposalId === latestProposal.id,
          )
        : [];
      const latestProposalReview = proposalReviews.at(-1) ?? null;
      const activeTarget = Boolean(
        activeReview?.status === "in_review" &&
        activeReview.id === handoff.destination.policyEventCardReviewId,
      );
      const adapterAvailability = candidate.providerId === "federal_register"
        ? "ready" as const
        : "unsupported_source" as const;
      const canRetry = activeTarget && adapterAvailability === "ready" &&
        latestAcquisition?.outcome === "source_unavailable" &&
        acquisitions.length <
          SIX_SCREEN_POLICY_LIFECYCLE_MAX_ACQUISITIONS_PER_HANDOFF;
      const canAcquire = activeTarget && adapterAvailability === "ready" &&
        (!latestAcquisition || canRetry);
      const canDispose = activeTarget &&
        latestAcquisition?.outcome === "document_retained" && !latestProposal;
      const canProposeRevision = activeTarget && !latestProposal &&
        latestDisposition?.decision === "accepted_for_event_card_review";
      const canReviewRevision = activeTarget && Boolean(latestProposal) &&
        proposalReviews.length < 2 &&
        (!latestProposalReview || latestProposalReview.decision === "deferred");
      return [{
        handoffId: handoff.id,
        handoffFingerprint: handoff.handoffFingerprint,
        targetPolicyEventCardReviewId:
          handoff.destination.policyEventCardReviewId,
        candidateProviderId: candidate.providerId,
        adapterAvailability,
        acquisitions: structuredClone(acquisitions),
        latestAcquisition: latestAcquisition
          ? structuredClone(latestAcquisition)
          : null,
        dispositions: structuredClone(dispositions),
        latestDisposition: latestDisposition
          ? structuredClone(latestDisposition)
          : null,
        proposals: structuredClone(proposals),
        latestProposal: latestProposal
          ? structuredClone(latestProposal)
          : null,
        proposalReviews: structuredClone(proposalReviews),
        latestProposalReview: latestProposalReview
          ? structuredClone(latestProposalReview)
          : null,
        chronologyStageOptions: policyLifecycleStageChronologyOptions(
          handoff.proposedStage.kind,
        ),
        sourceDateOptions: latestAcquisition?.source
          ? policyLifecycleStageSourceDateOptions(latestAcquisition.source)
          : [],
        canAcquire,
        canRetry,
        canDispose,
        canProposeRevision,
        canReviewRevision,
      }];
    },
  );
  if (!entries.length) return null;
  return {
    schemaVersion: SIX_SCREEN_POLICY_LIFECYCLE_STAGE_WORKSPACE_SCHEMA_VERSION,
    entries,
    claimBoundary:
      "Official-document acquisition, source-bound stage proposal, and researcher disposition/review are preserved separately. None changes chronology or the Event Card until an explicit Event Card lock includes an accepted proposal.",
  };
}

function upgradedPolicyReviewProjection(review: PolicyReview): PolicyReview {
  const value = structuredClone(review);
  value.plan = activateHistoricalPolicyEvidencePlan(value.plan);
  const templates = value.plan.instrumentFamily === "federal_rule"
    ? unsearchedFederalRegisterPolicyRequirements(value.plan.documentNumber!)
    : unsearchedOfficialDocumentPolicyRequirements(value.plan.steps[0]!.id);
  const existing = new Set(value.requirements.map(({ kind }) => kind));
  for (const requirement of templates) {
    if (existing.has(requirement.kind as PolicyEvidenceRequirementKind)) continue;
    value.requirements.push({
      kind: requirement.kind as PolicyEvidenceRequirementKind,
      description: requirement.description,
      status: "not_yet_searched",
      criticality: requirement.criticality,
    });
  }
  value.progress.searchedSteps = value.plan.steps.filter(
    ({ status }) => status === "searched",
  ).length;
  value.progress.totalSteps = value.plan.steps.length;
  value.unresolved = value.requirements.filter(({ status }) =>
    status !== "supported" && status !== "not_applicable")
    .map(({ kind }) => kind);
  value.briefingQuality = assessPolicyBriefingQuality({
    claims: value.claims,
    requirements: value.requirements,
    assessedAt: value.researchedAt,
  });
  return value;
}

function unresolvedScreen5ExecutionReadiness(
  run: StudyFirstMechanismRun | null,
): Screen5ExecutionReadiness {
  return {
    schemaVersion: SCREEN5_EXECUTION_READINESS_VERSION,
    selectedBackend: "unresolved",
    provider: "openai",
    model: SCREEN5_OPENAI_MODEL,
    route: "direct_setup_required",
    configuration: "unresolved",
    missingSettings: [],
    keyPresent: false,
    credentialStatus: "not_tested",
    ledgerState: "unresolved",
    allowance: null,
    authorization: "unresolved",
    authorizedStages: [],
    activeOrigin: run?.providerExecution
      ? run.providerExecution.provider
      : run?.planning?.origin ?? "none",
    activeExecutionId: run?.providerExecution?.id ?? null,
    migration: "unresolved",
    canEnsure: false,
    canAdvanceWithoutInference: false,
    canDispatch: false,
    serverObservedAt: null,
    nextAction: "none",
  };
}

function publicStudyFirstMechanismRun(run: StudyFirstMechanismRun) {
  const visible = structuredClone(run);
  for (const attempt of visible.providerExecution?.attempts ?? []) {
    if (!attempt.responseReceipt) continue;
    const receipt = attempt.responseReceipt as unknown as Record<string, unknown>;
    delete receipt.finalContent;
  }
  return visible;
}

export type Screen6PublicPersonalization = {
  id: string;
  inputFingerprint: string;
  status: "pending" | "receipt_saved" | "validation_failed" |
    "completed" | "failed" | "outcome_unknown";
  retryEligibility: "new_request" | "local_revalidation" | "observe" | "none";
  dispatchState: "not_dispatched" | "dispatched" | "unknown";
  failureCode: string | null;
  failureStage: Screen5OpenAIFailureStage | null;
  supplement: unknown | null;
  error: string | null;
  providerResponseId: string | null;
  usage: Screen5MechanismProviderReceipt["usage"] | null;
};

/** Safe dispatch certainty for the Screen 3 result area. Raw receipts and
 * provider text remain only in authenticated private state. */
export type Screen3PublicContextualization = Screen6PublicPersonalization;

function contextualizationRetryEligibility(record: {
  status: Screen6PublicPersonalization["status"];
  dispatchState?: "not_dispatched" | "dispatched" | "unknown";
  failureCode?: string | null;
  receipt?: unknown;
}): Screen6PublicPersonalization["retryEligibility"] {
  if (record.status === "completed") return "none";
  if (record.status === "receipt_saved" ||
      record.status === "validation_failed") return "local_revalidation";
  if (record.status === "failed" && !record.receipt &&
      (record.dispatchState === "not_dispatched" ||
        knownContextualizationRejection(record))) return "new_request";
  return "observe";
}

/** A saved, observed non-success HTTP response can only be retried by a new
 * explicit action. Its original dispatched allowance remains held. */
function knownContextualizationRejection(record: {
  status: Screen6PublicPersonalization["status"];
  dispatchState?: "not_dispatched" | "dispatched" | "unknown";
  failureCode?: string | null;
  failureStage?: Screen5OpenAIFailureStage | null;
  receipt?: unknown;
}) {
  return record.status === "failed" &&
    record.dispatchState === "dispatched" &&
    knownObservedHttpFailure(record) && !record.receipt;
}

function knownObservedHttpFailure(record: {
  failureCode?: string | null;
  failureStage?: Screen5OpenAIFailureStage | null;
}) {
  return knownObservedProviderHttpFailure(record);
}

const MODEL_CLAIM_RECOVERY_GRACE_MS =
  SCREEN5_OPENAI_REQUEST_DEADLINE_MS + 60_000;
const SCREEN4_CLAIM_RECOVERY_GRACE_MS = MODEL_CLAIM_RECOVERY_GRACE_MS;

function recoverableContextualizationClaim(record: {
  status: Screen6PublicPersonalization["status"];
  dispatchState?: "not_dispatched" | "dispatched" | "unknown";
  receipt?: unknown;
  updatedAt: string;
}, now: string) {
  return record.status === "pending" &&
    (record.dispatchState ?? "not_dispatched") === "not_dispatched" &&
    !record.receipt && Date.parse(now) - Date.parse(record.updatedAt) >=
      MODEL_CLAIM_RECOVERY_GRACE_MS;
}

function recoverableScreen4Claim(
  attempt: Screen4InterpretationAttempt | null | undefined,
  now: string,
) {
  return Boolean(attempt?.status === "pending" &&
    attempt.claimOperationId !== null &&
    attempt.dispatchState === "not_dispatched" && !attempt.receipt &&
    Date.parse(now) - Date.parse(attempt.updatedAt) >=
      SCREEN4_CLAIM_RECOVERY_GRACE_MS);
}

function screen4QueueProjection(
  state: SixScreenWorkflowState,
  investigation: StudyFirstEventInvestigation | null,
  storedAttempts?: readonly Screen4InterpretationAttempt[],
): Screen4PublicInterpretationQueue | null {
  if (!investigation?.presentation ||
    !["completed", "completed_partial"].includes(investigation.status) ||
    !investigation.presentation.visibleEventIds.length) return null;
  const batches = screen4InterpretationBatches(investigation);
  const taskFingerprint = screen4InterpretationTaskFingerprint({
    runId: state.runId, investigation,
  });
  const current = (storedAttempts ??
      state.screen4InterpretationAttempts ?? []).filter(
    (attempt) => attempt.taskFingerprint === taskFingerprint,
  );
  const latest = batches.map((_, index) => current.filter((attempt) =>
    attempt.batchIndex === index).at(-1) ?? null);
  const resultByEvent = new Map<string, Screen4PublicInterpretationQueue[
    "results"][number]>();
  const analysisByEvent = new Map(investigation.analyses.map((analysis) =>
    [analysis.eventId, analysis] as const));
  for (const attempt of latest) {
    if (attempt?.status !== "completed") continue;
    const result = attempt.result as Screen4OpenAIInterpretation |
      LegacyScreen4OpenAIInterpretation;
    for (const item of result.event_assessments) {
      const analysis = analysisByEvent.get(item.event_id);
      if (!analysis) continue;
      if ("what_it_is" in item) {
        resultByEvent.set(item.event_id, {
          eventId: item.event_id,
          relationshipType: analysis.relationshipType,
          documentedChange: item.what_it_is.text,
          outcomePathway: item.why_it_may_matter.text,
          nextCheck: item.what_to_check_next,
          sourceIds: [...new Set([
            ...item.what_it_is.source_ids,
            ...item.why_it_may_matter.source_ids,
          ])],
        });
      } else {
        resultByEvent.set(item.event_id, {
          eventId: item.event_id,
          relationshipType: analysis.relationshipType,
          documentedChange: item.what_happened.text,
          outcomePathway: item.why_it_may_matter.text,
          nextCheck: item.what_to_check_next,
          sourceIds: [...new Set([
            ...item.what_happened.source_ids,
            ...item.affected_activity.source_ids,
            ...item.why_it_may_matter.source_ids,
            ...item.timing_role.source_ids,
          ])],
        });
      }
    }
  }
  const results = investigation.presentation.visibleEventIds.flatMap(
    (id) => resultByEvent.has(id) ? [resultByEvent.get(id)!] : [],
  );
  const remaining = latest.filter((attempt) =>
    attempt?.status !== "completed");
  const uncertain = remaining.some((attempt) =>
    attempt?.status === "outcome_unknown" ||
    attempt?.dispatchState === "unknown");
  const active = remaining.some((attempt) =>
    attempt?.status === "pending" &&
    attempt.claimOperationId !== null);
  const revalidate = remaining.some((attempt) =>
    attempt?.receipt && (attempt.status === "receipt_saved" ||
      attempt.status === "validation_failed"));
  const retry = remaining.some((attempt) => !attempt ||
    attempt.status === "pending" &&
      attempt.claimOperationId === null &&
      attempt.dispatchState === "not_dispatched" ||
    attempt.status === "failed" && !attempt.receipt &&
      (attempt.dispatchState === "not_dispatched" ||
        attempt.dispatchState === "dispatched" &&
          knownObservedHttpFailure(attempt)));
  const retryEligibility: Screen4PublicInterpretationQueue[
    "retryEligibility"] = uncertain || active ? "observe"
      : retry ? "new_request"
      : revalidate ? "local_revalidation"
      : remaining.length ? "observe" : "none";
  const status: Screen4PublicInterpretationQueue["status"] =
    !remaining.length ? "completed"
      : uncertain ? "outcome_unknown"
      : active ? "in_progress"
      : results.length ? "partial"
      : remaining.some((attempt) =>
        attempt?.status === "validation_failed") ? "validation_failed"
      : remaining.some((attempt) => attempt?.status === "failed") ? "failed"
      : "ready";
  const problematic = remaining.find((attempt) => attempt?.failureCode) ??
    null;
  const issuePaths = problematic?.error?.match(
    /\$(?:\.[A-Za-z_][A-Za-z0-9_]*|\[\d+\]){0,12}/gu,
  )?.slice(0, 3) ?? [];
  const currentBatchIndex = latest.findIndex((attempt) =>
    attempt?.status !== "completed");
  const currentAttempt = currentBatchIndex >= 0
    ? latest[currentBatchIndex] : null;
  const failureStep = currentAttempt?.failureStage === "local_configuration" ||
      currentAttempt?.failureStage === "admission"
    ? "allowance_reservation" as const
    : currentAttempt?.failureStage === "network" ||
        currentAttempt?.failureStage === "response_headers" ||
        currentAttempt?.failureStage === "response_body"
      ? "provider_dispatch" as const
      : currentAttempt?.failureStage === "model_output"
        ? "response_validation" as const
        : currentAttempt?.failureStage === "persistence"
          ? "assessment_persistence" as const
          : currentAttempt?.failureStage === "projection"
            ? "display_join" as const
            : null;
  const progressStep = currentAttempt?.progressStage === "packet_prepared"
    ? "allowance_reservation" as const
    : currentAttempt?.progressStage === "allowance_reserved"
      ? "provider_dispatch" as const
      : currentAttempt?.progressStage === "provider_dispatched" ||
          currentAttempt?.progressStage === "response_received"
        ? "response_validation" as const
        : currentAttempt?.progressStage === "response_validated"
          ? "assessment_persistence" as const
          : currentAttempt?.progressStage === "assessment_saved"
            ? "display_join" as const
            : "packet_preparation" as const;
  const currentStep = failureStep ?? progressStep;
  const presentation = investigation.presentation;
  if (!presentation) {
    throw new Error(
      "Screen 4 assessment diagnosis requires a frozen presentation.",
    );
  }
  const stepOrder = [
    "source_manifest", "packet_preparation", "allowance_reservation",
    "provider_dispatch", "response_validation", "assessment_persistence",
    "display_join",
  ] as const;
  const currentStepIndex = stepOrder.indexOf(currentStep);
  const stepLabels: Record<(typeof stepOrder)[number], string> = {
    source_manifest: "Displayed source events locked",
    packet_preparation: "Compact event packet prepared",
    allowance_reservation: "Model allowance reserved",
    provider_dispatch: "OpenAI request dispatched",
    response_validation: "Structured response validated",
    assessment_persistence: "Assessment saved by event ID",
    display_join: "Saved assessment joined to the cards",
  };
  const diagnosis = status === "completed" ? null : {
    reference: taskFingerprint.slice(-8).toUpperCase(),
    currentStep,
    batchNumber: currentBatchIndex < 0 ? null : currentBatchIndex + 1,
    batchCount: batches.length,
    updatedAt: currentAttempt?.updatedAt ?? null,
    steps: stepOrder.map((id, index) => ({
      id,
      label: stepLabels[id],
      status: failureStep === id
        ? "failed" as const
        : index < currentStepIndex || id === "source_manifest"
          ? "complete" as const
          : index === currentStepIndex
            ? "current" as const
            : "waiting" as const,
      detail: failureStep === id
        ? `Stopped here${currentAttempt?.failureCode
          ? ` (${currentAttempt.failureCode})` : ""}.`
        : id === "source_manifest"
          ? `${presentation.visibleEventIds.length} displayed event ID${presentation.visibleEventIds.length === 1 ? " is" : "s are"} frozen for this assessment.`
          : index < currentStepIndex
            ? "Completed and saved."
            : index === currentStepIndex
              ? currentAttempt
                ? `Working on batch ${currentBatchIndex + 1} of ${batches.length}.`
                : "Starts when you select Assess relevance to my study."
              : "Not reached yet.",
    })),
  } satisfies NonNullable<Screen4PublicInterpretationQueue["diagnosis"]>;
  return {
    taskFingerprint, status, retryEligibility, results,
    error: remaining.find((attempt) => attempt?.error)?.error ?? null,
    diagnostic: problematic ? {
      taskType: "screen4_event_interpretation",
      stage: problematic.failureStage ??
        (problematic.status === "validation_failed"
        ? "validation" : problematic.status === "outcome_unknown"
          ? "unknown" : problematic.failureCode ===
            "receipt_persistence_failed" ? "persistence" : "request"),
      code: problematic.failureCode!,
      dispatchState: problematic.dispatchState,
      receiptSaved: Boolean(problematic.receipt),
      issuePaths,
    } : null,
    diagnosis,
    completedCount: results.length,
    totalCount: presentation.visibleEventIds.length,
    readiness: {
      canDispatch: false,
      blocker: "Checking the shared model usage account.",
      batchCount: latest.filter((attempt) => !attempt ||
        attempt.status === "pending" &&
          attempt.claimOperationId === null ||
        attempt.status === "failed" && !attempt.receipt &&
          (attempt.dispatchState === "not_dispatched" ||
          attempt.dispatchState === "dispatched" &&
              knownObservedHttpFailure(attempt))).length,
      maximumReservationTokens: latest.filter((attempt) => !attempt ||
        attempt.status === "pending" &&
          attempt.claimOperationId === null ||
        attempt.status === "failed" && !attempt.receipt &&
          (attempt.dispatchState === "not_dispatched" ||
            attempt.dispatchState === "dispatched" &&
              knownObservedHttpFailure(attempt))).length *
        SCREEN4_OPENAI_INTERPRETATION_RESERVATION,
      nextReservationTokens: retryEligibility === "new_request"
        ? SCREEN4_OPENAI_INTERPRETATION_RESERVATION : 0,
      availableTokens: null, availableAttempts: null,
    },
  };
}

/** The canonical investigation retains every deduplicated source record.
 * The public workspace carries only the ranked display set needed by Screen 4
 * so a high-yield scan cannot make its own completion response undeliverable. */
function screen4InvestigationProjection(
  investigation: StudyFirstEventInvestigation,
) {
  const projected = structuredClone(investigation);
  const visibleIds = new Set(
    investigation.presentation?.visibleEventIds.slice(
      0, STUDY_FIRST_EVENT_MAX_VISIBLE,
    ) ?? [],
  );
  projected.occurrences = projected.occurrences.filter(({ id }) =>
    visibleIds.has(id));
  projected.analyses = projected.analyses.filter(({ eventId }) =>
    visibleIds.has(eventId));
  return projected;
}

function publicProjection(state: SixScreenWorkflowState): SixScreenWorkflowPublicProjection {
  const screen6CurrentPlan = createScreen6CurrentPlan(state);
  const compatibleScreen6Fingerprints = new Set(
    screen6CompatibleInputFingerprints(screen6CurrentPlan),
  );
  const screen6History = [...(state.screen6Personalizations ?? [])].reverse();
  const screen6Saved = screen6History.find((record) =>
    record.status === "completed" &&
      compatibleScreen6Fingerprints.has(record.inputFingerprint)) ??
    screen6History.find((record) => record.inputFingerprint ===
      screen6CurrentPlan.inputFingerprint) ?? null;
  const screen6Personalization: Screen6PublicPersonalization | null =
    screen6Saved ? {
      id: screen6Saved.id,
      inputFingerprint: screen6Saved.inputFingerprint,
      status: screen6Saved.status,
      retryEligibility: contextualizationRetryEligibility(screen6Saved),
      dispatchState: screen6Saved.dispatchState ??
        (screen6Saved.receipt ? "dispatched" : "unknown"),
      failureCode: screen6Saved.failureCode ?? null,
      failureStage: screen6Saved.failureStage ?? null,
      supplement: screen6Saved.status === "completed"
        ? structuredClone(screen6Saved.supplement) : null,
      error: screen6Saved.error,
      providerResponseId: screen6Saved.receipt?.providerResponseId ?? null,
      usage: screen6Saved.receipt?.usage ?? null,
    } : null;
  // Match the v22 scientific coordinates exactly where possible. A changed
  // policy review, group or source snapshot does not acquire a false match.
  const priorReview = state.policyReview?.identityFingerprint ===
    state.confirmedShock?.identityFingerprint ? state.policyReview : null;
  const historicalFingerprint = fingerprintSixScreenValue({
    ...screen6CurrentPlan.snapshotRefs,
    contextualizerTaskVersion: "screen-06-contextualization-v2",
    policyEvidenceFingerprint: priorReview ? fingerprintSixScreenValue({
      claims: priorReview.claims, status: priorReview.status,
      evidenceSnapshotFingerprint: priorReview.evidenceSnapshotFingerprint,
    }) : null,
  });
  const historicalSaved = screen6Personalization ? null :
    [...(state.screen6Personalizations ?? [])].reverse().find((record) =>
      record.inputFingerprint === historicalFingerprint &&
      record.status === "completed") ?? null;
  const screen6HistoricalPersonalization: Screen6PublicPersonalization | null =
    historicalSaved ? {
      id: historicalSaved.id,
      inputFingerprint: historicalSaved.inputFingerprint,
      status: "completed",
      retryEligibility: "none",
      dispatchState: historicalSaved.dispatchState ?? "dispatched",
      failureCode: null,
      failureStage: null,
      supplement: structuredClone(historicalSaved.supplement),
      error: null,
      providerResponseId: historicalSaved.receipt?.providerResponseId ?? null,
      usage: historicalSaved.receipt?.usage ?? null,
    } : null;
  const visiblePolicyReview = state.policyReview
    ? upgradedPolicyReviewProjection(state.policyReview)
    : null;
  const status = state.confirmedShock
    ? "shock_confirmed"
    : state.pendingIdentityRequest
      ? "identity_resolving"
      : state.candidates.length
        ? "identity_review"
        : "identity_input";
  const lifecycleStageWorkspace = policyLifecycleStageReviewWorkspace(state);
  const currentLifecycleStage = lifecycleStageWorkspace?.entries.find(
    ({ targetPolicyEventCardReviewId }) =>
      targetPolicyEventCardReviewId ===
        (state.policyEventCardReviews ?? []).at(-1)?.id,
  );
  const currentLiteraturePlan = currentMechanismLiteraturePlan(state);
  const currentLiteratureExecutionPlan =
    currentMechanismLiteratureExecutionPlan(state);
  const currentLiteratureExecution = currentMechanismLiteratureExecution(state);
  const currentLiteraturePacket = currentScholarlyEvidencePacket(state);
  const currentPassagePacket = currentScholarlyPassagePacket(state);
  const currentClaimPacket = currentScholarlyClaimPacket(state);
  const currentSynthesisInputPacket =
    currentMechanismSynthesisInputPacket(state);
  const currentMechanismReviewRecord = currentMechanismReview(state);
  const currentPredictionMatrixRecord = currentPredictionMatrix(state);
  const currentStudyFirstMechanismInput =
    currentStudyFirstMechanismInputForState(state);
  const currentStudyFirstMechanismRecord =
    currentStudyFirstMechanismRunForState(state);
  const previousStudyFirstMechanismRecord =
    currentStudyFirstMechanismInput && !currentStudyFirstMechanismRecord
      ? [...(state.studyFirstMechanismRuns ?? [])].reverse().find((run) =>
          run.context.contextFingerprint ===
            currentStudyFirstMechanismInput.contextFingerprint)
        ?? null
      : null;
  const currentUncertaintyProfile =
    currentScreen6UncertaintyProfile(state);
  const currentDiagnosticPlan = currentScreen6DiagnosticPlan(state);
  const currentDiagnosticResults = currentScreen6DiagnosticResults(state);
  const currentDiagnosticResultReviews =
    currentScreen6DiagnosticResultReviews(state);
  const currentConditionalClaimBoundary =
    currentScreen6ConditionalClaimBoundary(state);
  const currentResearchPlanningDisposition =
    currentScreen6ResearchPlanningDisposition(state);
  const currentResearchExport = currentResearchPlanningDisposition
    ? currentScreen6ResearchExport(state)
    : null;
  const reviewedDiagnosticResultIds = new Set(
    currentDiagnosticResultReviews.map(({ resultReference }) =>
      resultReference.resultId
    ),
  );
  const screen6Prerequisites = screen6PrerequisiteReport(state);
  const currentDocumentAcquisitions = currentLiteraturePacket
    ? (state.scholarlyDocumentAcquisitions ?? []).filter((acquisition) =>
        acquisition.plan.binding.metadataPacketSnapshotId ===
          currentLiteraturePacket.snapshotId &&
        acquisition.plan.binding.metadataPacketFingerprint ===
          currentLiteraturePacket.packetFingerprint)
    : [];
  const latestDocumentAcquisition = currentDocumentAcquisitions.at(-1) ?? null;
  const currentClaimExtractions = currentLiteraturePacket
    ? (state.scholarlyClaimExtractions ?? []).filter((extraction) =>
        extraction.binding.metadataPacketSnapshotId ===
          currentLiteraturePacket.snapshotId &&
        extraction.binding.metadataPacketFingerprint ===
          currentLiteraturePacket.packetFingerprint)
    : [];
  const currentClaimExtractionIds = new Set(
    currentClaimExtractions.map(({ id }) => id),
  );
  const currentClaimReviews = (state.scholarlyClaimReviews ?? []).filter(
    (review) => currentClaimExtractionIds.has(
      review.extractionReference.extractionId,
    ),
  );
  const latestClaimReviews = new Map<string, ScholarlyClaimReview>();
  for (const review of currentClaimReviews) {
    latestClaimReviews.set(review.extractionReference.extractionId, review);
  }
  const reviewableClaimExtractions = currentClaimExtractions.filter(
    (extraction) => {
      const review = latestClaimReviews.get(extraction.id);
      return !review || review.decision === "deferred";
    },
  );
  const activeStudyFirstInvestigation = currentStudyFirstEventInvestigation({
    studyFirstEventInvestigations: state.studyFirstEventInvestigations,
    confirmedShock: state.confirmedShock,
    study: state.study,
    entryContext: currentScreen3StudyEntryContext(state),
    timing: currentProposedTreatmentTiming(state),
    advice: currentStudyDesignAdvice(state),
    selection: currentStudyDesignSelection(state),
  });
  const statusMessage = status === "shock_confirmed"
    ? state.activeScreen === 6
      ? currentUncertaintyProfile
        ? currentResearchExport
          ? `Screen 6 retained a ${currentResearchExport.completeness.status} source-linked CredibilityPlan and DesignRecord export; unresolved items remain explicit and the export is not a causal certificate.`
          : currentResearchPlanningDisposition
          ? `Screen 6 retained the researcher's ${currentResearchPlanningDisposition.decision.replaceAll("_", " ")} planning disposition; unresolved issues remain explicit and no causal certificate or final export was created.`
          : currentConditionalClaimBoundary
          ? `Screen 6 retained a prospective ${currentConditionalClaimBoundary.intendedClaim.claimLevel.replaceAll("_", " ")} boundary with ${currentConditionalClaimBoundary.unresolvedHighConsequenceIssues.length} unresolved high-consequence issue${currentConditionalClaimBoundary.unresolvedHighConsequenceIssues.length === 1 ? "" : "s"}; researcher disposition remains pending.`
          : currentDiagnosticResults.length
          ? `Screen 6 retained ${currentDiagnosticResults.length} current provenance-explicit diagnostic result${currentDiagnosticResults.length === 1 ? "" : "s"}, including ${currentDiagnosticResultReviews.length} explicit researcher review${currentDiagnosticResultReviews.length === 1 ? "" : "s"}; no assumption, score, or certificate was created.`
          : currentDiagnosticPlan
            ? `Screen 6 saved ${currentDiagnosticPlan.cards.length} reviewed-library diagnostic card${currentDiagnosticPlan.cards.length === 1 ? "" : "s"}; no result, score, or certificate was created.`
            : `Screen 6 retained ten separate uncertainty dimensions with ${currentUncertaintyProfile.gaps.length} explicit gap${currentUncertaintyProfile.gaps.length === 1 ? "" : "s"}; diagnostics and results remain uncreated.`
        : "Screen 6 is ready to initialize a current-snapshot-bound uncertainty profile; no diagnostic or result has been created."
    : state.activeScreen === 5
      ? currentStudyFirstMechanismRecord
        ? currentStudyFirstMechanismRecord.status === "needs_clarification"
          ? "Screen 5 preserved the exact proposed mechanism and requested a process-level clarification; no scholarship search or comparison ran."
          : `Screen 5 retained ${currentStudyFirstMechanismRecord.works.length} deduplicated scholarly lead${currentStudyFirstMechanismRecord.works.length === 1 ? "" : "s"}; inspected abstracts, metadata-only leads, and pending signed-host comparison remain explicitly separate.`
      : currentStudyFirstMechanismInput
        ? "Screen 5 saved the current mechanism input; bounded evidence retrieval or comparison is incomplete. Any visible prior result remains tied to its earlier input revision."
      : currentMechanismReviewRecord && currentPredictionMatrixRecord
        ? `Screen 5 retained ${currentMechanismReviewRecord.mechanisms.length} researcher-authored mechanism hypothesis${currentMechanismReviewRecord.mechanisms.length === 1 ? "" : "es"} and ${currentPredictionMatrixRecord.rows.length} observable prediction${currentPredictionMatrixRecord.rows.length === 1 ? "" : "s"}; these remain hypotheses rather than identified mediation.`
        : currentSynthesisInputPacket
        ? `Screen 5 froze ${currentSynthesisInputPacket.acceptedScholarlyClaims.length} accepted source-linked scholarly claim${currentSynthesisInputPacket.acceptedScholarlyClaims.length === 1 ? "" : "s"} with reviewed policy and study inputs; synthesis remains blocked.`
        : latestDocumentAcquisition
        ? currentClaimReviews.length
          ? currentClaimPacket?.acceptedClaimReferences.length
            ? `Screen 5 retained ${currentClaimPacket.acceptedClaimReferences.length} researcher-accepted source-linked scholarly claim${currentClaimPacket.acceptedClaimReferences.length === 1 ? "" : "s"}; mechanism synthesis remains blocked.`
            : "Screen 5 retained explicit scholarly claim reviews without an accepted premise; mechanism synthesis remains blocked."
          : currentClaimExtractions.length
            ? `Screen 5 retained ${currentClaimExtractions.length} researcher-authored structured scholarly claim${currentClaimExtractions.length === 1 ? "" : "s"} pending explicit review; no mechanism was created.`
        : latestDocumentAcquisition.document
          ? `Screen 5 retained ${currentPassagePacket?.passageReferences.length ?? 0} exact scholarly passage${currentPassagePacket?.passageReferences.length === 1 ? "" : "s"} for later researcher review; no detailed claim or mechanism was created.`
          : `Screen 5 recorded ${latestDocumentAcquisition.outcome.replaceAll("_", " ")} for the exact scholarly-document request without inferring its contents.`
        : currentLiteratureExecution
        ? currentLiteratureExecution.status === "complete"
          ? currentLiteratureExecution.actualSearchBoundary.stopReason ===
              "no_executable_provider_route"
            ? "Screen 5 recorded that no tested scholarly metadata route was executable; no search or no-match result was claimed."
            : `Screen 5 completed its initial metadata-only plan with ${currentLiteratureExecution.scholarlyMetadataRecordIds.length} retained lead${currentLiteratureExecution.scholarlyMetadataRecordIds.length === 1 ? "" : "s"}; no scholarly text or mechanism was assessed.`
          : `Screen 5 retained ${currentLiteratureExecution.completedStepIds.length} bounded metadata outcome${currentLiteratureExecution.completedStepIds.length === 1 ? "" : "s"}; continue explicitly to run the next tested route.`
        : currentLiteraturePlan
        ? "Screen 5 retained a source-bound three-branch literature plan; no scholarly query, mechanism analysis, or prediction comparison has run."
        : screen5PrerequisiteReport(state).handoffKind === "study_first_v2"
          ? "Screen 5 retained the study-first handoff with explicit upstream limitations; its legacy literature executor was not relabeled as reviewed evidence."
          : "Screen 5 is ready to record the researcher's explanation or explicit undecided state and save a bounded literature plan."
    : state.activeScreen === 4
      ? activeStudyFirstInvestigation
        ? activeStudyFirstInvestigation.status === "failed"
          ? "Screen 4 recorded a failed bounded source scan; this is not evidence that no relevant event exists."
          : activeStudyFirstInvestigation.presentation
            ? `Screen 4 retained ${activeStudyFirstInvestigation.presentation.visibleEventIds.length} visible documented event candidate${activeStudyFirstInvestigation.presentation.visibleEventIds.length === 1 ? "" : "s"} with ${activeStudyFirstInvestigation.presentation.coverage.interpretation.replaceAll("_", " ")} relevance guidance.`
            : "Screen 4 retained a planned automatic source scan; pending work is not favorable evidence."
        : currentCoEventSearchExecution(state)
        ? currentCoEventSearchExecution(state)!.status === "complete"
          ? `Screen 4 completed its bounded provider plan with ${currentCoEventSearchExecution(state)!.candidateOccurrenceIds.length} occurrence candidate${currentCoEventSearchExecution(state)!.candidateOccurrenceIds.length === 1 ? "" : "s"}; causal relevance remains unassessed.`
          : `Screen 4 saved ${currentCoEventSearchExecution(state)!.completedStepIds.length} bounded provider outcome${currentCoEventSearchExecution(state)!.completedStepIds.length === 1 ? "" : "s"}; continue explicitly to run the next step.`
        : currentCoEventSearchMatrix(state)
          ? "Screen 4 retained an immutable search scope and deterministic matrix; retrieval and relation analysis have not run."
        : screen4PrerequisiteReport(state).handoffKind === "study_first_v2"
          ? "Screen 4 is ready to start its bounded study-first event investigation."
        : screen4PrerequisiteReport(state).mode === "targeted"
          ? "Screen 4 is ready to save a targeted event-search matrix for both selected groups."
          : "Screen 4 is ready to save a contextual event-search matrix without differential-group claims."
      : state.activeScreen === 3
      ? currentStudyDesignSelection(state)?.decision.mode === "selected"
        ? "Screen 3 retained a researcher-selected method option for further review; no assumption or effect was certified."
        : currentStudyDesignSelection(state)?.decision.mode === "no_selection"
          ? "Screen 3 retained the researcher's explicit no-selection decision for the current study-first advice."
        : currentStudyDesignAdvice(state)
          ? `Screen 3 prepared ${currentStudyDesignAdvice(state)!.options.length} conditional method option${currentStudyDesignAdvice(state)!.options.length === 1 ? "" : "s"} from the versioned library; no model task or empirical test ran.`
        : currentCausalDesignDecision(state)?.decision === "selected"
        ? "Screen 3 retained a researcher-selected comparison for review; its assumptions and missing prerequisites remain explicit."
        : currentCausalDesignDecision(state)?.decision === "no_selection"
          ? "Screen 3 retained the researcher's explicit no-selection decision."
          : currentCausalDesignSet(state)?.status === "no_supported_option"
            ? "Screen 3 found no supported option from the selected reviewed variation."
            : currentCausalDesignSet(state)
              ? "Screen 3 retained source-linked conditional comparison options for researcher review."
              : "Screen 3 is ready for researcher-owned comparison inputs."
      : state.activeScreen === 2 &&
          (state.coEventPolicyLifecycleHandoffs ?? []).some((handoff) => {
            const review = (state.policyEventCardReviews ?? []).find(
              ({ id }) =>
                id === handoff.destination.policyEventCardReviewId,
            );
            return review?.status === "in_review";
          })
        ? currentLifecycleStage?.latestDisposition
          ? `Screen 2 retained the researcher's ${currentLifecycleStage.latestDisposition.decision.replaceAll("_", " ")} decision for the possible focal-policy stage; chronology and the Event Card remain unchanged.`
          : currentLifecycleStage?.latestAcquisition?.outcome ===
              "document_retained"
            ? "Screen 2 retained bounded exact official-document passages for the possible focal-policy stage; explicit researcher disposition is required before later Event Card work."
            : currentLifecycleStage?.latestAcquisition
              ? `Screen 2 recorded ${currentLifecycleStage.latestAcquisition.outcome.replaceAll("_", " ")} for the possible focal-policy stage without inferring an empty result or policy fact.`
              : "Screen 2 opened a source-preserving Event Card revision for a researcher-routed possible focal-policy stage."
      : visiblePolicyReview?.status === "ready"
      ? `Screen 2 retained ${visiblePolicyReview.claimCount} source-linked policy claims.`
      : visiblePolicyReview?.status === "partial"
        ? `Screen 2 saved ${visiblePolicyReview.progress.searchedSteps} of ${visiblePolicyReview.progress.totalSteps} evidence-plan steps with explicit gaps.`
        : visiblePolicyReview
          ? "Screen 2 recorded an official-source limitation without inventing policy facts."
          : `Shock confirmed — ${state.confirmedShock!.episode}.`
    : status === "identity_resolving"
      ? "Resolving the policy identity from bounded official-source metadata."
      : status === "identity_review"
        ? "Review the proposed identity beside your original request."
        : "Enter enough identity information to resolve the policy without substitution.";
  const screen3Prerequisites = screen3PrerequisiteReport(state);
  const screen4Prerequisites = screen4PrerequisiteReport(state);
  const screen5Prerequisites = screen5PrerequisiteReport(state);
  const currentDesignSet = currentCausalDesignSet(state);
  const currentDesignDecision = currentCausalDesignDecision(state);
  const currentTiming = currentProposedTreatmentTiming(state);
  const currentStudyEntry = currentScreen3StudyEntryContext(state);
  const currentStudyAdvice = currentStudyDesignAdvice(state);
  const currentStudySelection = currentStudyDesignSelection(state);
  const currentStudyFirstInvestigation = activeStudyFirstInvestigation;
  const projectedStudyFirstInvestigation = currentStudyFirstInvestigation
    ? screen4InvestigationProjection(currentStudyFirstInvestigation)
    : null;
  const currentStudyFirstHandoff = currentStudyFirstInvestigation
    ? [...(state.studyFirstEventScreen5Handoffs ?? [])].reverse().find(
        ({ investigationSnapshotId }) =>
          investigationSnapshotId === currentStudyFirstInvestigation.snapshotId,
      ) ?? null
    : null;
  const currentSearchMatrix = currentCoEventSearchMatrix(state);
  const currentExecutionPlan = currentCoEventExecutionPlan(state);
  const currentSearchExecution = currentCoEventSearchExecution(state);
  const currentLiteratureExecutions = currentLiteraturePlan
    ? (state.mechanismLiteratureExecutions ?? []).filter((execution) =>
        execution.literaturePlanSnapshotId === currentLiteraturePlan.snapshotId)
    : [];
  const scholarlyRecordMap = new Map(
    (state.scholarlyMetadataRecords ?? []).map((record) => [record.id, record]),
  );
  const currentLiteratureMetadataRecords =
    (currentLiteratureExecution?.scholarlyMetadataRecordIds ?? []).flatMap(
      (id) => {
        const record = scholarlyRecordMap.get(id);
        return record ? [record] : [];
      },
    );
  const currentDocumentTargets = currentLiteraturePlan
    ? buildScholarlyDocumentTargets({
        literaturePlan: currentLiteraturePlan,
        metadataRecords: currentLiteratureMetadataRecords,
      })
    : [];
  const currentMatrixExecutions = currentSearchMatrix
    ? (state.coEventSearchExecutions ?? []).filter((execution) =>
        execution.matrixSnapshotId === currentSearchMatrix.snapshotId)
    : [];
  const coEventCandidateMap = new Map(
    (state.coEventCandidates ?? []).map((candidate) => [candidate.id, candidate]),
  );
  const currentCoEventCandidateIds = new Set(
    currentSearchExecution?.candidateOccurrenceIds ?? [],
  );
  const coEventLeadMap = new Map(
    (state.coEventDiscoveryLeads ?? []).map((lead) => [lead.id, lead]),
  );
  const occurrenceReviewMap = new Map(
    (state.coEventOccurrenceReviews ?? []).map((review) => [review.id, review]),
  );
  const policyEventCardReviewMap = new Map(
    (state.policyEventCardReviews ?? []).map((review) => [review.id, review]),
  );
  const currentScreen2ArtifactIds = new Set(
    state.artifacts.filter(({ screen, status }) =>
      screen === 2 && status === "current").map(({ snapshotId }) => snapshotId),
  );
  const causalDecisionsByDesignSet = new Map(
    (state.causalDesignDecisions ?? []).map((decision) => [
      decision.designSetSnapshotId,
      decision,
    ]),
  );
  const causalArtifactsBySnapshot = new Map(
    state.artifacts.filter(({ screen }) => screen === 3).map((artifact) => [
      artifact.snapshotId,
      artifact,
    ]),
  );
  const coEventArtifactsBySnapshot = new Map(
    state.artifacts.filter(({ screen }) => screen === 4).map((artifact) => [
      artifact.snapshotId,
      artifact,
    ]),
  );
  const mechanismArtifactsBySnapshot = new Map(
    state.artifacts.filter(({ screen }) => screen === 5).map((artifact) => [
      artifact.snapshotId,
      artifact,
    ]),
  );
  const uncertaintyArtifactsBySnapshot = new Map(
    state.artifacts.filter(({ screen }) => screen === 6).map((artifact) => [
      artifact.snapshotId,
      artifact,
    ]),
  );
  return {
    schemaVersion: SIX_SCREEN_WORKFLOW_PUBLIC_SCHEMA_VERSION,
    runId: state.runId,
    revision: state.revision,
    activeScreen: state.activeScreen,
    optionalAnalysisRecovery: structuredClone(state.optionalAnalysisRecovery ?? {
      schemaVersion: SIX_SCREEN_OPTIONAL_ANALYSIS_RECOVERY_VERSION,
      blockedScreens: [],
      isolatedCounts: { screen3: 0, screen4: 0, screen5: 0, screen6: 0 },
    }),
    status,
    statusMessage,
    study: structuredClone(state.study),
    originalShockInput: state.originalShockInput,
    currentShockInput: state.currentShockInput,
    officialSourceLocators: [...state.officialSourceLocators],
    officialIdentifier: state.officialIdentifier ?? null,
    requestedJurisdiction: state.requestedJurisdiction,
    approximateYear: state.approximateYear,
    intendedEpisode: state.intendedEpisode,
    identityRevision: state.identityRevision,
    identityResolution: structuredClone(state.lastIdentityResolution),
    candidates: state.candidates.map((candidate) => ({
      id: candidate.id,
      officialTitle: candidate.officialTitle,
      aliases: [...candidate.aliases],
      issuer: candidate.issuer,
      issuingJurisdiction: candidate.issuingJurisdiction,
      instrumentType: candidate.instrumentType,
      formalIdentifiers: [...candidate.formalIdentifiers],
      episode: candidate.episode,
      versionScope: candidate.versionScope,
      typedDates: structuredClone(candidate.typedDates),
      displayedDescription: candidate.displayedDescription,
      matchExplanation: candidate.matchExplanation,
      materialMismatches: [...candidate.materialMismatches],
      identitySourceIds: [...candidate.identitySourceIds],
      identityFingerprint: candidate.identityFingerprint,
      sourceSnapshotId: candidate.sourceSnapshotId,
      sourceSnapshotFingerprint: candidate.sourceSnapshotFingerprint,
      identitySources: structuredClone(candidate.identitySources),
      selected: state.displayedCandidateId === candidate.id,
    })),
    confirmedShock: state.confirmedShock
      ? {
          id: state.confirmedShock.id,
          officialTitle: state.confirmedShock.officialTitle,
          issuer: state.confirmedShock.issuer,
          issuingJurisdiction: state.confirmedShock.issuingJurisdiction,
          formalIdentifiers: [...state.confirmedShock.formalIdentifiers],
          episode: state.confirmedShock.episode,
          versionScope: state.confirmedShock.versionScope,
          identityFingerprint: state.confirmedShock.identityFingerprint,
          confirmedAt: state.confirmedShock.confirmation.confirmedAt,
        }
      : null,
    policyReview: visiblePolicyReview,
    policyEventCardWorkspace: null,
    policyLifecycleStageReviewWorkspace: lifecycleStageWorkspace,
    causalComparisonWorkspace: {
      schemaVersion: SIX_SCREEN_CAUSAL_COMPARISON_WORKSPACE_SCHEMA_VERSION,
      methodLibraryVersion: SIX_SCREEN_CAUSAL_METHOD_LIBRARY_VERSION,
      methodLibrary: structuredClone(INITIAL_CAUSAL_METHOD_LIBRARY),
      designSet: currentDesignSet ? structuredClone(currentDesignSet) : null,
      decision: currentDesignDecision
        ? structuredClone(currentDesignDecision)
        : null,
      revisions: (state.causalDesignSets ?? []).map((designSet) => {
        const decision = causalDecisionsByDesignSet.get(designSet.snapshotId);
        return {
          designSetSnapshotId: designSet.snapshotId,
          ordinal: designSet.ordinal,
          createdAt: designSet.createdAt,
          eventCardSnapshotId:
            designSet.binding.eventCardReference.eventCardSnapshotId,
          optionCount: designSet.options.length,
          artifactStatus:
            causalArtifactsBySnapshot.get(designSet.snapshotId)?.status ??
              "archived",
          decision: decision?.decision ?? "not_decided",
          selectedOptionLabel: decision?.selectedDesign?.label ?? null,
        };
      }),
      studyFirst: {
        methodLibraryVersion: SIX_SCREEN_STUDY_DESIGN_LIBRARY_VERSION,
        methodLibrary: structuredClone(STUDY_DESIGN_METHOD_LIBRARY),
        timing: currentTiming ? structuredClone(currentTiming) : null,
        entryContext: currentStudyEntry
          ? structuredClone(currentStudyEntry)
          : null,
        advice: currentStudyAdvice
          ? structuredClone(currentStudyAdvice)
          : null,
        contextualization: currentStudyAdvice ? (() => {
          const currentPacketFingerprint = fingerprintSixScreenValue(
            screen3ContextualPacket(state, currentStudyAdvice));
          const v23PacketFingerprint = fingerprintSixScreenValue(
            screen3LegacyContextualPacket(state, currentStudyAdvice));
          const saved = [...(state.screen3Contextualizations ?? [])]
            .reverse().find((item) => item.adviceFingerprint ===
              currentStudyAdvice.adviceFingerprint &&
              (item.packetFingerprint === currentPacketFingerprint ||
                (item.status === "completed" &&
                  item.packetFingerprint === v23PacketFingerprint)));
          return saved ? {
            id: saved.id, inputFingerprint: saved.adviceFingerprint,
            status: saved.status, supplement: saved.status === "completed"
              ? structuredClone(saved.supplement) : null,
            retryEligibility: contextualizationRetryEligibility(saved),
            dispatchState: saved.dispatchState ?? "unknown",
            failureCode: saved.failureCode ?? null,
            failureStage: saved.failureStage ?? null,
            error: saved.error,
            providerResponseId: saved.receipt?.providerResponseId ?? null,
            usage: saved.receipt?.usage ?? null,
          } : null;
        })() : null,
        selection: currentStudySelection
          ? structuredClone(currentStudySelection)
          : null,
        defaultClarifications: structuredClone(
          EMPTY_STUDY_DESIGN_CLARIFICATIONS,
        ),
        revisions: (state.studyDesignAdvices ?? []).map((advice) => ({
          adviceId: advice.adviceId,
          createdAt: advice.createdAt,
          studyRevision: advice.binding.studyRevision,
          optionCount: advice.options.length,
          warningCount: advice.warnings.length,
          executionMode: advice.execution.mode,
          selected: (state.studyDesignSelections ?? []).some((selection) =>
            selection.adviceId === advice.adviceId &&
            selection.adviceFingerprint === advice.adviceFingerprint
          ),
        })),
      },
    },
    coEventSearchWorkspace: {
      schemaVersion: SIX_SCREEN_COEVENT_SEARCH_WORKSPACE_SCHEMA_VERSION,
      matrix: currentSearchMatrix
        ? structuredClone(currentSearchMatrix)
        : null,
      executionPlan: currentExecutionPlan
        ? structuredClone(currentExecutionPlan)
        : null,
      execution: currentSearchExecution
        ? structuredClone(currentSearchExecution)
        : null,
      attempts: currentMatrixExecutions.flatMap(({ attempt }) =>
        attempt ? [structuredClone(attempt)] : []),
      candidates: currentSearchExecution
        ? currentSearchExecution.candidateOccurrenceIds.flatMap((id) => {
            const candidate = coEventCandidateMap.get(id);
            return candidate ? [structuredClone(candidate)] : [];
          })
        : [],
      discoveryLeads: currentSearchExecution
        ? currentSearchExecution.discoveryLeadIds.flatMap((id) => {
            const lead = coEventLeadMap.get(id);
            return lead ? [structuredClone(lead)] : [];
          })
        : [],
      occurrenceReviews: (state.coEventOccurrenceReviews ?? [])
        .filter((review) => currentCoEventCandidateIds.has(
          review.candidateReference.candidateId,
        ))
        .map((review) => structuredClone(review)),
      duplicateReviews: (state.coEventDuplicateReviews ?? [])
        .filter((review) => review.members.every(({ candidateId }) =>
          currentCoEventCandidateIds.has(candidateId)))
        .map((review) => structuredClone(review)),
      relationReviews: (state.coEventRelationReviews ?? [])
        .filter((review) => currentCoEventCandidateIds.has(
          review.binding.candidateId,
        ))
        .map((review) => structuredClone(review)),
      policyLifecycleHandoffs:
        (state.coEventPolicyLifecycleHandoffs ?? []).flatMap((handoff) => {
          if (
            handoff.focalPolicyReference.identityFingerprint !==
              state.confirmedShock?.identityFingerprint
          ) return [];
          const candidate = coEventCandidateMap.get(
            handoff.candidateReference.candidateId,
          );
          const occurrenceReview = occurrenceReviewMap.get(
            handoff.occurrenceReviewReference.reviewId,
          );
          const targetReview = policyEventCardReviewMap.get(
            handoff.destination.policyEventCardReviewId,
          );
          if (!candidate || !occurrenceReview || !targetReview) return [];
          const targetReviewStatus = targetReview.status === "in_review"
            ? "pending_event_card_review" as const
            : targetReview.lockedEventCard && currentScreen2ArtifactIds.has(
                targetReview.lockedEventCard.snapshotId,
              )
              ? "reviewed_event_card_locked" as const
              : "review_revision_superseded" as const;
          return [{
            handoff: structuredClone(handoff),
            candidate: structuredClone(candidate),
            occurrenceReview: structuredClone(occurrenceReview),
            targetReviewStatus,
          }];
        }),
      revisions: (state.coEventSearchMatrices ?? []).map((matrix) => ({
        matrixSnapshotId: matrix.snapshotId,
        ordinal: matrix.ordinal,
        createdAt: matrix.createdAt,
        mode: matrix.mode,
        rowCount: matrix.rows.length,
        executionStatus: matrix.execution.status,
        artifactStatus:
          coEventArtifactsBySnapshot.get(matrix.snapshotId)?.status ??
            "archived",
      })),
      executionRevisions: (state.coEventSearchExecutions ?? []).map(
        (execution) => ({
          executionSnapshotId: execution.snapshotId,
          ordinal: execution.ordinal,
          recordedAt: execution.recordedAt,
          status: execution.status,
          attemptId: execution.attempt?.id ?? null,
          candidateCount: execution.candidateOccurrenceIds.length,
          remainingStepCount: execution.remainingStepIds.length,
          artifactStatus:
            coEventArtifactsBySnapshot.get(execution.snapshotId)?.status ??
              "archived",
        }),
      ),
    },
    studyFirstEventInvestigationWorkspace: {
      investigation: projectedStudyFirstInvestigation,
      discoveryTask: currentStudyFirstInvestigation ? {
        taskId: studyFirstEventTaskId(currentStudyFirstInvestigation),
        state: currentStudyFirstInvestigation.status === "planned"
          ? "not_started"
          : currentStudyFirstInvestigation.status === "failed"
            ? "failed"
            : currentStudyFirstInvestigation.occurrences.length
              ? "complete" : "complete_zero",
        stage: currentStudyFirstInvestigation.status === "planned"
          ? "preparation" : "complete",
        nextAction: currentStudyFirstInvestigation.status === "planned"
          ? "start" : "none",
        completedStepCount: currentStudyFirstInvestigation.status === "planned"
          ? 0 : currentStudyFirstInvestigation.plan.steps.length,
        totalStepCount: currentStudyFirstInvestigation.plan.steps.length,
        pendingStepCount: currentStudyFirstInvestigation.status === "planned"
          ? currentStudyFirstInvestigation.plan.steps.length : 0,
        queryCount: currentStudyFirstInvestigation.attempts.reduce(
          (count, attempt) => count + attempt.usage.sourceQueries, 0),
        documentCount: currentStudyFirstInvestigation.attempts.reduce(
          (count, attempt) => count + (attempt.usage.documentAttempts ?? 0),
          0),
        recordsReceived: currentStudyFirstInvestigation.attempts.reduce(
          (count, attempt) => count + attempt.recordsReceived, 0),
        recordsAccepted: currentStudyFirstInvestigation.attempts.reduce(
          (count, attempt) => count + attempt.recordsAccepted, 0),
        stopReason: currentStudyFirstInvestigation.presentation?.coverage
          .limitation ?? null,
        continuationMode: "panel_driven",
        continuationDisclosure:
          "One bounded source step runs per explicit Start or Resume action. Work does not continue after panel closure or process restart; reopening reads saved checkpoints and can resume an eligible next step.",
      } : null,
      // Finalized occurrences already live in `investigation`. Do not repeat
      // them in the public response. The authenticated task projection fills
      // this separate list only while source-step work is still partial.
      documentedOccurrences: [],
      refreshAvailable: Boolean(currentStudyFirstInvestigation &&
        currentStudyFirstInvestigation.status !== "planned" &&
        (state.studyFirstEventInvestigations?.length ?? 0) + 2 <=
          STUDY_FIRST_EVENT_MAX_HISTORY),
      sourceVersionCurrent: currentStudyFirstInvestigation?.plan
        .discoveryVersion === STUDY_FIRST_EVENT_DISCOVERY_VERSION,
      interpretationQueue: screen4QueueProjection(state,
        currentStudyFirstInvestigation),
      interpretationRevisions: (state.studyFirstEventInvestigations ?? [])
        .filter((investigation) => investigation.presentation &&
          investigation.presentation.visibleEventIds.length > 0 &&
          ["completed", "completed_partial"].includes(investigation.status))
        .map((investigation) => {
          const queue = screen4QueueProjection(state, investigation)!;
          return {
            taskFingerprint: queue.taskFingerprint,
            investigationSnapshotId: investigation.snapshotId,
            completedCount: queue.completedCount,
            totalCount: queue.totalCount,
            status: queue.status,
          };
        }),
      latestScreen5Handoff: currentStudyFirstHandoff
        ? structuredClone(currentStudyFirstHandoff)
        : null,
      revisions: (state.studyFirstEventInvestigations ?? []).map(
        (investigation) => ({
          snapshotId: investigation.snapshotId,
          contextId: investigation.context.id,
          ordinal: investigation.ordinal,
          status: investigation.status,
          visibleEventCount:
            investigation.presentation?.visibleEventIds.length ?? 0,
          completedAt: investigation.completedAt,
        }),
      ),
      claimBoundary:
        "Structured sources document occurrence fields. Bounded evidence rules order qualifying records before the display cap. Explicit model interpretation of frozen event packets remains conditional; it does not verify sample exposure, confounding, effect direction, or bias magnitude.",
    },
    studyFirstMechanismWorkspace: {
      schemaVersion:
        SIX_SCREEN_STUDY_FIRST_MECHANISM_WORKSPACE_SCHEMA_VERSION,
      currentInput: currentStudyFirstMechanismInput
        ? structuredClone(currentStudyFirstMechanismInput)
        : null,
      currentRun: currentStudyFirstMechanismRecord
        ? publicStudyFirstMechanismRun(currentStudyFirstMechanismRecord)
        : null,
      previousCompatibleRun: previousStudyFirstMechanismRecord
        ? publicStudyFirstMechanismRun(previousStudyFirstMechanismRecord)
        : null,
      executionReadiness: unresolvedScreen5ExecutionReadiness(
        currentStudyFirstMechanismRecord,
      ),
      revisions: (state.studyFirstMechanismRuns ?? []).map((run) => ({
        runId: run.id,
        ordinal: run.ordinal,
        inputRevision: run.input.revision,
        status: run.status,
        workCount: run.works.length,
        abstractCount: run.works.filter(({ access }) =>
          access.level === "abstract_inspected").length,
        createdAt: run.createdAt,
      })),
      claimBoundary:
        "Researcher input is preserved verbatim after safe normalization. Provider metadata and inspected abstracts remain distinct; any saved direct-provider or signed-host comparison is conditional synthesis, not a literature-review verdict, mediator estimate, or researcher decision.",
    },
    modelCapability: unresolvedScreen5ExecutionReadiness(
      currentStudyFirstMechanismRecord,
    ),
    mechanismLiteratureWorkspace: {
      schemaVersion:
        SIX_SCREEN_MECHANISM_LITERATURE_WORKSPACE_SCHEMA_VERSION,
      plan: currentLiteraturePlan
        ? structuredClone(currentLiteraturePlan)
        : null,
      executionPlan: currentLiteratureExecutionPlan
        ? structuredClone(currentLiteratureExecutionPlan)
        : null,
      execution: currentLiteratureExecution
        ? structuredClone(currentLiteratureExecution)
        : null,
      attempts: currentLiteratureExecutions.flatMap((execution) =>
        execution.attempt ? [structuredClone(execution.attempt)] : []),
      metadataRecords: (currentLiteratureExecution?.scholarlyMetadataRecordIds ?? [])
        .flatMap((id) => {
          const record = scholarlyRecordMap.get(id);
          return record ? [structuredClone(record)] : [];
        }),
      evidencePacket: currentLiteraturePacket
        ? structuredClone(currentLiteraturePacket)
        : null,
      documentTargets: structuredClone(currentDocumentTargets),
      documentAcquisitions: structuredClone(currentDocumentAcquisitions),
      passagePacket: currentPassagePacket
        ? structuredClone(currentPassagePacket)
        : null,
      claimExtractions: structuredClone(currentClaimExtractions),
      claimReviews: structuredClone(currentClaimReviews),
      claimPacket: currentClaimPacket
        ? structuredClone(currentClaimPacket)
        : null,
      synthesisInputPacket: currentSynthesisInputPacket
        ? structuredClone(currentSynthesisInputPacket)
        : null,
      mechanismReview: currentMechanismReviewRecord
        ? structuredClone(currentMechanismReviewRecord)
        : null,
      predictionMatrix: currentPredictionMatrixRecord
        ? structuredClone(currentPredictionMatrixRecord)
        : null,
      revisions: (state.mechanismLiteraturePlans ?? []).map((plan) => ({
        planSnapshotId: plan.snapshotId,
        ordinal: plan.ordinal,
        createdAt: plan.createdAt,
        explanationMode: plan.input.explanation.mode,
        policyPremiseCount: plan.policyPremises.length,
        artifactStatus:
          mechanismArtifactsBySnapshot.get(plan.snapshotId)?.status ??
            "archived",
      })),
      executionRevisions: currentLiteratureExecutions.map((execution) => ({
        executionSnapshotId: execution.snapshotId,
        ordinal: execution.ordinal,
        recordedAt: execution.recordedAt,
        status: execution.status,
        branch: execution.attempt?.branch ?? null,
        attemptOutcome: execution.attempt?.outcome ?? null,
        metadataRecordCount: execution.scholarlyMetadataRecordIds.length,
        remainingStepCount: execution.remainingStepIds.length,
        artifactStatus:
          mechanismArtifactsBySnapshot.get(execution.snapshotId)?.status ??
            "archived",
      })),
      claimBoundary:
        "Documentary inputs, researcher-authored mechanism hypotheses, and observable predictions remain separate. A MechanismReview or PredictionMatrix is not an estimated effect, identified mediator, or causal finding.",
    },
    screen6CurrentPlan,
    screen6Personalization,
    screen6HistoricalPersonalization,
    screen6UncertaintyWorkspace: {
      schemaVersion: SIX_SCREEN_UNCERTAINTY_WORKSPACE_SCHEMA_VERSION,
      profile: currentUncertaintyProfile
        ? structuredClone(currentUncertaintyProfile)
        : null,
      diagnosticPlan: currentDiagnosticPlan
        ? structuredClone(currentDiagnosticPlan)
        : null,
      diagnosticResults: structuredClone(currentDiagnosticResults),
      diagnosticResultReviews:
        structuredClone(currentDiagnosticResultReviews),
      conditionalClaimBoundary: currentConditionalClaimBoundary
        ? structuredClone(currentConditionalClaimBoundary)
        : null,
      researchPlanningDisposition: currentResearchPlanningDisposition
        ? structuredClone(currentResearchPlanningDisposition)
        : null,
      researchExport: currentResearchExport
        ? structuredClone(currentResearchExport)
        : null,
      revisions: (state.screen6UncertaintyProfiles ?? []).map((profile) => ({
        profileSnapshotId: profile.snapshotId,
        ordinal: profile.ordinal,
        createdAt: profile.createdAt,
        gapCount: profile.gaps.length,
        notAssessedCount: profile.dimensions.filter(({ state: value }) =>
          value === "not_assessed").length,
        evidenceNeededCount: profile.dimensions.filter(({ state: value }) =>
          value === "evidence_needed").length,
        artifactStatus:
          uncertaintyArtifactsBySnapshot.get(profile.snapshotId)?.status ??
            "archived",
      })),
      diagnosticPlanRevisions: (state.screen6DiagnosticPlans ?? []).map(
        (plan) => ({
          planSnapshotId: plan.snapshotId,
          ordinal: plan.ordinal,
          createdAt: plan.createdAt,
          cardCount: plan.cards.length,
          primaryCardCount: plan.priorityPlan.primaryCardCount,
          inputGapCount: plan.diagnosticInputGaps.length,
          artifactStatus:
            uncertaintyArtifactsBySnapshot.get(plan.snapshotId)?.status ??
              "archived",
        }),
      ),
      diagnosticResultRevisions: (state.screen6DiagnosticResults ?? []).map(
        (result) => ({
          resultId: result.id,
          ordinal: result.ordinal,
          cardId: result.binding.cardId,
          libraryEntryId: result.binding.libraryEntryId,
          submittedAt: result.submittedAt,
          provenanceKind: result.provenance.kind,
          reviewReadiness: result.reviewReadiness.status,
          artifactStatus:
            uncertaintyArtifactsBySnapshot.get(result.id)?.status ??
              "archived",
        }),
      ),
      diagnosticResultReviewRevisions:
        (state.screen6DiagnosticResultReviews ?? []).map((review) => ({
          reviewId: review.id,
          ordinal: review.ordinal,
          resultId: review.resultReference.resultId,
          decision: review.decision,
          reviewedAt: review.reviewedAt,
          artifactStatus:
            uncertaintyArtifactsBySnapshot.get(review.id)?.status ??
              "archived",
        })),
      conditionalClaimBoundaryRevisions:
        (state.screen6ConditionalClaimBoundaries ?? []).map((boundary) => ({
          boundarySnapshotId: boundary.snapshotId,
          ordinal: boundary.ordinal,
          claimLevel: boundary.intendedClaim.claimLevel,
          relationshipToCurrentDesign:
            boundary.intendedClaim.relationshipToCurrentDesign,
          createdAt: boundary.createdAt,
          issueCount: boundary.unresolvedHighConsequenceIssues.length,
          artifactStatus:
            uncertaintyArtifactsBySnapshot.get(boundary.snapshotId)?.status ??
              "archived",
        })),
      researchPlanningDispositionRevisions:
        (state.screen6ResearchPlanningDispositions ?? []).map(
          (disposition) => ({
            dispositionId: disposition.id,
            ordinal: disposition.ordinal,
            boundarySnapshotId: disposition.boundaryReference.snapshotId,
            decision: disposition.decision,
            decidedAt: disposition.decidedAt,
            artifactStatus:
              uncertaintyArtifactsBySnapshot.get(disposition.id)?.status ??
                "archived",
          }),
        ),
      researchExportRevisions:
        (state.screen6ResearchExports ?? []).map((researchExport) => ({
          exportId: researchExport.id,
          ordinal: researchExport.ordinal,
          boundarySnapshotId:
            researchExport.binding.boundarySnapshotId,
          dispositionId: researchExport.binding.dispositionId,
          completenessStatus: researchExport.completeness.status,
          exportedAt: researchExport.exportedAt,
          artifactStatus:
            uncertaintyArtifactsBySnapshot.get(researchExport.id)?.status ??
              "archived",
        })),
      claimBoundary:
        "Planning, provenance-explicit result intake, researcher interpretation, the conditional claim boundary, researcher disposition, and source-linked export remain separate. The export is a research-planning record: it does not prove an assumption, upgrade attribution after results, create a credibility score, or issue a causal certificate.",
    },
    screen3Prerequisites,
    screen4Prerequisites,
    screen5Prerequisites,
    screen6Prerequisites,
    canOpenScreen2: state.confirmedShock !== null,
    canOpenScreen3: screen3Prerequisites.ready,
    canOpenScreen4: screen4Prerequisites.ready,
    canOpenScreen5: screen5Prerequisites.ready,
    canOpenScreen6: screen6Prerequisites.ready,
    canResearchPolicy:
      state.confirmedShock !== null && state.activeScreen === 2 &&
      state.policyReview === null,
    canContinuePolicy:
      state.confirmedShock !== null && state.activeScreen === 2 &&
      Boolean(visiblePolicyReview?.plan.nextStepId),
    canBuildCausalComparison:
      state.activeScreen === 3 && screen3Prerequisites.ready,
    canDecideCausalComparison:
      state.activeScreen === 3 && Boolean(currentDesignSet) &&
      !currentDesignDecision,
    canSaveCoEventSearchMatrix:
      state.activeScreen === 4 && screen4Prerequisites.ready &&
      screen4Prerequisites.legacyExecutionAvailable,
    canContinueCoEventSearch:
      state.activeScreen === 4 && Boolean(currentSearchMatrix) &&
      currentSearchExecution?.status !== "complete",
    canReviewCoEventOccurrence:
      state.activeScreen === 4 && currentCoEventCandidateIds.size > 0,
    canReviewCoEventDuplicates:
      state.activeScreen === 4 && currentCoEventCandidateIds.size > 1,
    canReviewCoEventRelations:
      state.activeScreen === 4 &&
      (state.coEventOccurrenceReviews ?? []).some((review) =>
        currentCoEventCandidateIds.has(review.candidateReference.candidateId) &&
        (review.decision === "retained" || review.decision === "corrected")
      ),
    canSaveMechanismLiteraturePlan:
      state.activeScreen === 5 && screen5Prerequisites.ready &&
      screen5Prerequisites.legacyExecutionAvailable,
    canCompareStudyFirstMechanisms:
      state.activeScreen === 5 && screen5Prerequisites.ready &&
      screen5Prerequisites.handoffKind === "study_first_v2",
    canContinueMechanismLiteratureSearch:
      screen5Prerequisites.legacyExecutionAvailable &&
      state.activeScreen === 5 && Boolean(currentLiteraturePlan) &&
      currentLiteratureExecution?.status !== "complete",
    canInspectScholarlyDocument:
      screen5Prerequisites.legacyExecutionAvailable &&
      state.activeScreen === 5 && Boolean(currentLiteraturePacket) &&
      currentLiteratureExecution?.status === "complete" &&
      currentDocumentTargets.length > 0 &&
      currentDocumentAcquisitions.length <
        SIX_SCREEN_SCHOLARLY_DOCUMENT_MAX_ACQUISITIONS,
    canExtractScholarlyClaim:
      screen5Prerequisites.legacyExecutionAvailable &&
      state.activeScreen === 5 && Boolean(currentPassagePacket) &&
      Boolean(currentPassagePacket?.eligiblePassageIds.length) &&
      currentClaimExtractions.length <
        SIX_SCREEN_SCHOLARLY_CLAIM_MAX_EXTRACTIONS,
    canReviewScholarlyClaim:
      screen5Prerequisites.legacyExecutionAvailable &&
      state.activeScreen === 5 && reviewableClaimExtractions.length > 0 &&
      currentClaimReviews.length < SIX_SCREEN_SCHOLARLY_CLAIM_MAX_REVIEWS,
    canPrepareMechanismSynthesisInput:
      screen5Prerequisites.legacyExecutionAvailable &&
      state.activeScreen === 5 && Boolean(
        currentClaimPacket?.acceptedClaimReferences.length,
      ) && !currentSynthesisInputPacket,
    canSaveMechanismReview:
      screen5Prerequisites.legacyExecutionAvailable &&
      state.activeScreen === 5 && Boolean(currentSynthesisInputPacket),
    canInitializeScreen6UncertaintyProfile:
      state.activeScreen === 6 && screen6Prerequisites.ready &&
      !currentUncertaintyProfile,
    canSaveScreen6DiagnosticPlan:
      state.activeScreen === 6 && Boolean(currentUncertaintyProfile) &&
      (state.screen6DiagnosticPlans ?? []).length <
        SIX_SCREEN_DIAGNOSTIC_PLAN_MAX_REVISIONS,
    canRecordScreen6DiagnosticResult:
      state.activeScreen === 6 && Boolean(currentDiagnosticPlan?.cards.length) &&
      (state.screen6DiagnosticResults ?? []).length <
        SIX_SCREEN_DIAGNOSTIC_RESULT_MAX_RECORDS,
    canReviewScreen6DiagnosticResult:
      state.activeScreen === 6 && currentDiagnosticResults.some(({ id }) =>
        !reviewedDiagnosticResultIds.has(id)
      ) && (state.screen6DiagnosticResultReviews ?? []).length <
        SIX_SCREEN_DIAGNOSTIC_RESULT_REVIEW_MAX_RECORDS,
    canSaveScreen6ConditionalClaimBoundary:
      state.activeScreen === 6 && Boolean(currentDiagnosticPlan) &&
      (state.screen6ConditionalClaimBoundaries ?? []).length <
        SIX_SCREEN_CLAIM_BOUNDARY_MAX_REVISIONS,
    canRecordScreen6ResearchPlanningDisposition:
      state.activeScreen === 6 && Boolean(currentConditionalClaimBoundary) &&
      !currentResearchPlanningDisposition &&
      (state.screen6ResearchPlanningDispositions ?? []).length <
        SIX_SCREEN_RESEARCH_DISPOSITION_MAX_RECORDS,
    canCreateScreen6ResearchExport:
      state.activeScreen === 6 && Boolean(currentResearchPlanningDisposition) &&
      !currentResearchExport &&
      (state.screen6ResearchExports ?? []).length <
        SIX_SCREEN_RESEARCH_EXPORT_MAX_RECORDS,
    continuationDisclosure:
      "Policy, co-event, and literature work pause when each panel-driven action stops. Status reads never advance retrieval; continue explicitly to run the next saved step.",
  };
}

function reviewMatchesProjection(
  review: PolicyEventCardReviewState,
  projection: PolicyChronologySourcePanelProjection,
) {
  return review.binding.eventId === projection.binding.eventId &&
    review.binding.identityFingerprint === projection.binding.identityFingerprint &&
    review.binding.evidenceSnapshotId === projection.binding.evidenceSnapshotId &&
    review.binding.evidenceSnapshotRevision ===
      projection.binding.evidenceSnapshotRevision &&
    review.binding.evidenceSnapshotFingerprint ===
      projection.binding.evidenceSnapshotFingerprint &&
    review.binding.evidenceCollectionFingerprint ===
      projection.binding.evidenceCollectionFingerprint &&
    review.binding.projectionFingerprint === projection.projectionFingerprint;
}

function policyEventCardRevisionSummaries(
  reviews: readonly PolicyEventCardReviewState[],
  projection: PolicyChronologySourcePanelProjection | null,
): PolicyEventCardRevisionSummary[] {
  let latestLockedIndex = -1;
  reviews.forEach((review, index) => {
    if (review.status === "locked") latestLockedIndex = index;
  });
  return reviews.map((review, index) => {
    const isActive = index === reviews.length - 1;
    const matches = !projection || reviewMatchesProjection(review, projection);
    let status: PolicyEventCardRevisionDisplayStatus;
    if (review.status === "locked") {
      status = index < latestLockedIndex
        ? "superseded"
        : isActive && matches
          ? "current"
          : "review_required";
    } else if (!isActive) {
      status = "replaced_unfinished";
    } else if (!matches) {
      status = "review_required";
    } else {
      status = review.supersedes ? "pending_revision" : "in_review";
    }
    return {
      reviewId: review.id,
      seriesId: review.seriesId,
      ordinal: review.ordinal,
      status,
      evidenceSnapshotId: review.binding.evidenceSnapshotId,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      supersedesReviewId: review.supersedes?.reviewId ?? null,
      eventCardSnapshotId: review.lockedEventCard?.snapshotId ?? null,
      changes: review.changeHistory.map((change) => ({
        revision: change.revision,
        kind: change.kind,
        at: change.at,
        summary: change.summary,
      })),
    };
  });
}

function policyEventCardWorkspaceFromProjection(
  state: SixScreenWorkflowState,
  projection: PolicyChronologySourcePanelProjection,
): PolicyEventCardWorkspace {
  const reviews = state.policyEventCardReviews ?? [];
  validatePolicyEventCardReviewCollection(reviews);
  const activeReview = reviews.at(-1) ?? null;
  const matches = Boolean(
    activeReview && reviewMatchesProjection(activeReview, projection),
  );
  const reviewStatus = !activeReview
    ? "not_started"
    : !matches
      ? "review_required"
      : activeReview.status === "locked"
        ? "current"
        : activeReview.supersedes
          ? "pending_revision"
          : "in_review";
  return {
    schemaVersion: SIX_SCREEN_POLICY_EVENT_CARD_WORKSPACE_SCHEMA_VERSION,
    availability: "ready",
    unavailableReason: null,
    reviewStatus,
    projection: structuredClone(projection),
    activeReview: activeReview ? structuredClone(activeReview) : null,
    revisions: policyEventCardRevisionSummaries(reviews, projection),
  };
}

function unavailablePolicyEventCardWorkspace(
  state: SixScreenWorkflowState,
  unavailableReason:
    | "evidence_store_unconfigured"
    | "evidence_snapshot_unavailable",
): PolicyEventCardWorkspace {
  const reviews = state.policyEventCardReviews ?? [];
  validatePolicyEventCardReviewCollection(reviews);
  const activeReview = reviews.at(-1) ?? null;
  return {
    schemaVersion: SIX_SCREEN_POLICY_EVENT_CARD_WORKSPACE_SCHEMA_VERSION,
    availability: "unavailable",
    unavailableReason,
    reviewStatus: "unavailable",
    projection: null,
    activeReview: activeReview ? structuredClone(activeReview) : null,
    revisions: policyEventCardRevisionSummaries(reviews, null),
  };
}

function policyReviewDocumentNumber(input: {
  plan: PolicyEvidencePlan;
  acquisitionDocumentNumber: string | null;
}) {
  if (input.plan.instrumentFamily === "federal_rule") {
    const planDocumentNumber = input.plan.documentNumber;
    if (
      !planDocumentNumber ||
      (input.acquisitionDocumentNumber !== null &&
        input.acquisitionDocumentNumber !== planDocumentNumber)
    ) {
      throw new Error(
        "Policy evidence acquisition does not match its federal plan coordinate.",
      );
    }
    return planDocumentNumber;
  }
  if (
    input.plan.documentNumber !== null ||
    input.acquisitionDocumentNumber !== null
  ) {
    throw new Error(
      "Non-federal policy evidence cannot carry a Federal Register coordinate.",
    );
  }
  return null;
}

function policyReviewFromStep(input: {
  acquisition:
    | Screen02FederalRegisterAcquisitionResult
    | Screen02EcfrHistoricalAcquisitionResult
    | Screen02OfficialDocumentAcquisitionResult
    | Screen02RegulationsGovAcquisitionResult
    | Screen02ComplementaryEvidenceAcquisitionResult;
  taskId: string;
  identityFingerprint: string;
  policyTitle: string;
  studyPeriod: SixScreenWorkflowState["study"]["period"];
  previousReview: PolicyReview | null;
  plan: PolicyEvidencePlan;
  taskBeforeStep: ResearchTask;
  researchedAt: string;
  collection: EvidenceCollection | null;
  evidenceSnapshot: { id: string; snapshotFingerprint: string } | null;
}): PolicyReview {
  const collection = input.collection;
  const requirements = collection?.requirements ??
    (input.plan.instrumentFamily === "federal_rule"
      ? unsearchedFederalRegisterPolicyRequirements(input.plan.documentNumber!)
      : unsearchedOfficialDocumentPolicyRequirements(input.plan.steps[0]!.id));
  const unresolved = requirements
    .filter(({ status }) => status !== "supported" && status !== "not_applicable")
    .map(({ kind }) => kind);
  const claims = collection ? projectPolicyEvidenceClaims(collection) : [];
  const briefingQuality = assessPolicyBriefingQuality({
    claims,
    requirements: requirements.map(({ kind, status }) => ({
      kind: kind as PolicyEvidenceRequirementKind,
      status,
    })),
    assessedAt: input.researchedAt,
  });
  const retained = Boolean(collection && claims.length && input.evidenceSnapshot);
  const blocked = input.plan.steps.filter(({ status }) => status === "blocked");
  const limitation = retained
    ? input.acquisition.limitation ??
      (input.plan.nextStepId
        ? "Partial findings were saved. The next bounded standard-plan step will resume automatically in the workspace."
        : unresolved.length
          ? `The available exact-record steps were saved. ${blocked.map(({ note }) => note).filter(Boolean).join(" ")}`.trim()
          : null)
    : input.acquisition.limitation;
  return {
    protocolVersion: SIX_SCREEN_POLICY_REVIEW_PROTOCOL_VERSION,
    taskId: input.taskId,
    status: retained
      ? unresolved.length
        ? "partial"
        : "ready"
      : input.acquisition.status,
    failureCode: retained ? null : input.acquisition.failureCode,
    documentNumber: policyReviewDocumentNumber({
      plan: input.plan,
      acquisitionDocumentNumber: input.acquisition.documentNumber,
    }),
    identityFingerprint: input.identityFingerprint,
    evidenceSnapshotId: input.evidenceSnapshot?.id ??
      input.previousReview?.evidenceSnapshotId ?? null,
    evidenceSnapshotFingerprint:
      input.evidenceSnapshot?.snapshotFingerprint ??
      input.previousReview?.evidenceSnapshotFingerprint ?? null,
    artifactStatus: "current",
    sourceCount: collection?.sources.length ?? 0,
    passageCount: collection?.passages.length ?? 0,
    claimCount: collection?.claims.length ?? 0,
    claims,
    briefingQuality,
    synthesis: {
      status: "not_attempted",
      provider: null,
      model: null,
      attemptedAt: null,
      completedAt: null,
      safeFailureCode: null,
      claimCount: 0,
      usage: null,
    },
    briefing: createPolicyBriefing({
      title: input.policyTitle,
      claims,
      requirements,
      generatedAt: input.researchedAt,
      studyPeriod: input.studyPeriod,
    }),
    plan: structuredClone(input.plan),
    progress: {
      searchedSteps: input.plan.steps.filter(({ status }) => status === "searched").length,
      totalSteps: input.plan.steps.length,
      retainedDocuments: collection?.documentVersions.filter(
        ({ contentHash }) => contentHash !== null,
      ).length ?? 0,
      chargedDocumentAttempts:
        input.taskBeforeStep.usage.documentAttempts +
        input.acquisition.usage.documentAttempts,
      interruptedOperations: input.taskBeforeStep.operations.filter(
        ({ status }) => status === "ambiguous",
      ).length,
      receivedBytes:
        input.taskBeforeStep.usage.receivedBytes + input.acquisition.usage.receivedBytes,
      activeResearchMs:
        input.taskBeforeStep.usage.activeResearchMs +
        input.acquisition.usage.activeResearchMs,
      continuationMode: "automatic_standard",
    },
    requirements: requirements.map(({
      kind,
      description,
      status,
      criticality,
    }) => ({
      kind: kind as PolicyEvidenceRequirementKind,
      description,
      status,
      criticality,
    })),
    attemptedSources: [...new Set([
      ...(input.previousReview?.attemptedSources ?? []),
      ...input.acquisition.attemptedSources,
    ])],
    unresolved,
    limitation,
    researchedAt: input.researchedAt,
    invalidatedAt: null,
    invalidationReason: null,
  };
}

function snapshot(
  record: SixScreenWorkflowStoreRecord,
  accessToken: string,
): SixScreenWorkflowPrivateSnapshot {
  return {
    schemaVersion: SIX_SCREEN_WORKFLOW_PRIVATE_SCHEMA_VERSION,
    runId: record.runId,
    accessToken,
    revision: record.state.revision,
    stateFingerprint: record.stateFingerprint,
    state: structuredClone(record.state),
  };
}

/**
 * Fail an action with the bounded public workflow-problem contract. Runtime
 * guards call this directly instead of depending on prose-message parsing at
 * the tool boundary.
 */
function workflowProblemFailure(
  input: Parameters<typeof createSixScreenWorkflowProblem>[0],
  directMessage?: string,
): never {
  const error = new SixScreenWorkflowProblemError(
    createSixScreenWorkflowProblem(input),
  );
  // Registered MCP tools serialize only the bounded structured problem. Keep
  // the established, safe runtime detail for direct callers and tests without
  // copying arbitrary caught exception text into the transport contract.
  if (directMessage) error.message = directMessage;
  throw error;
}

function mutationFailure(
  result: { outcome: string; record?: SixScreenWorkflowStoreRecord },
  input: {
    expectedRevision: number;
    operationId: string;
    operationKind: string;
  },
): never {
  const policy = sixScreenActionPolicy(input.operationKind);
  const context = {
    operationId: input.operationId,
    action: input.operationKind,
    screen: policy?.destinationScreen ?? null,
    expectedRevision: input.expectedRevision,
    actualRevision: result.record?.state.revision ?? null,
  } as const;
  if (result.outcome === "stale") {
    throw new SixScreenWorkflowProblemError(createSixScreenWorkflowProblem({
      code: "revision_conflict",
      ...context,
      safeCauseCodes: ["stale_revision"],
    }));
  }
  if (result.outcome === "unauthorized") {
    throw new SixScreenWorkflowProblemError(createSixScreenWorkflowProblem({
      code: "authorization",
      ...context,
      safeCauseCodes: ["authorization_failed"],
    }));
  }
  if (result.outcome === "not_found") {
    throw new SixScreenWorkflowProblemError(createSixScreenWorkflowProblem({
      code: "authorization",
      ...context,
      safeCauseCodes: ["run_unavailable"],
    }));
  }
  if (result.outcome === "operation_conflict") {
    throw new SixScreenWorkflowProblemError(createSixScreenWorkflowProblem({
      code: "operation_identity_conflict",
      ...context,
      safeCauseCodes: ["operation_conflict"],
    }));
  }
  throw new SixScreenWorkflowProblemError(createSixScreenWorkflowProblem({
    code: "persistence_failure",
    ...context,
    safeCauseCodes: ["persistence_failed"],
  }));
}

function isSixScreenRevisionConflict(error: unknown) {
  return error instanceof SixScreenWorkflowProblemError &&
    error.problem.code === "revision_conflict";
}

function coEventCheckpointBody(checkpoint: CoEventStepCheckpoint) {
  const { checkpointFingerprint: _fingerprint, ...body } = checkpoint;
  return body;
}

function createCoEventStepCheckpoint(input: Omit<
  CoEventStepCheckpoint,
  "protocolVersion" | "checkpointFingerprint"
>) {
  const body = {
    protocolVersion: SIX_SCREEN_COEVENT_EXECUTOR_VERSION,
    ...structuredClone(input),
  };
  return {
    ...body,
    checkpointFingerprint: fingerprintSixScreenValue(body),
  } satisfies CoEventStepCheckpoint;
}

function validateCoEventStepCheckpoint(
  checkpoint: CoEventStepCheckpoint,
  matrix: CoEventSearchMatrix,
) {
  if (
    checkpoint.protocolVersion !== SIX_SCREEN_COEVENT_EXECUTOR_VERSION ||
    checkpoint.checkpointFingerprint !==
      fingerprintSixScreenValue(coEventCheckpointBody(checkpoint))
  ) throw new Error("Stored Screen 4 provider checkpoint is invalid or changed.");
  validateCoEventExecutionPlan(checkpoint.plan, matrix);
  if (checkpoint.attempt) validateCoEventProviderAttempt(checkpoint.attempt);
  checkpoint.candidates.forEach(validateCoEventCandidateOccurrence);
  checkpoint.discoveryLeads.forEach(validateCoEventDiscoveryLead);
  validateCoEventSearchExecution(checkpoint.execution, checkpoint.plan);
  if (
    checkpoint.execution.attempt?.attemptFingerprint !==
      checkpoint.attempt?.attemptFingerprint ||
    checkpoint.candidates.map(({ id }) => id).join("\u0000") !==
      (checkpoint.attempt?.candidateOccurrenceIds ?? []).join("\u0000") ||
    checkpoint.discoveryLeads.map(({ id }) => id).join("\u0000") !==
      (checkpoint.attempt?.discoveryLeadIds ?? []).join("\u0000")
  ) throw new Error("Stored Screen 4 provider checkpoint evidence is inconsistent.");
  return checkpoint;
}

function studyFirstEventCheckpointBody(
  checkpoint: StudyFirstEventCheckpoint,
) {
  const { checkpointFingerprint: _fingerprint, ...body } = checkpoint;
  return body;
}

function studyFirstEventTaskCoordinate(
  investigation: StudyFirstEventInvestigation,
) {
  return fingerprintSixScreenValue({
    executor: STUDY_FIRST_EVENT_EXECUTOR_VERSION,
    contextFingerprint: investigation.context.contextFingerprint,
    planFingerprint: investigation.plan.planFingerprint,
    ...(investigation.plan.discoveryVersion ===
      STUDY_FIRST_EVENT_DISCOVERY_VERSION
      ? { sourceRefreshSnapshotId: investigation.snapshotId } : {}),
  }).slice("fnv1a64:".length);
}

function studyFirstEventTaskId(investigation: StudyFirstEventInvestigation) {
  return `study-first-screen4-task-${
    studyFirstEventTaskCoordinate(investigation)}`;
}

function studyFirstEventStepCheckpointBody(
  checkpoint: StudyFirstEventStepCheckpoint,
) {
  const { checkpointFingerprint: _fingerprint, ...body } = checkpoint;
  return body;
}

function createStudyFirstEventStepCheckpoint(input: Omit<
  StudyFirstEventStepCheckpoint,
  "protocolVersion" | "checkpointFingerprint"
>) {
  const body = {
    protocolVersion: STUDY_FIRST_EVENT_EXECUTOR_VERSION,
    ...structuredClone(input),
  };
  return {
    ...body,
    checkpointFingerprint: fingerprintSixScreenValue(body),
  } satisfies StudyFirstEventStepCheckpoint;
}

function validateStudyFirstEventStepCheckpoint(
  checkpoint: StudyFirstEventStepCheckpoint,
  investigation: StudyFirstEventInvestigation,
) {
  const attemptBody = structuredClone(checkpoint.result.attempt) as
    Record<string, unknown>;
  delete attemptBody.attemptFingerprint;
  const candidateIds = new Set(
    checkpoint.result.candidates.map(({ id }) => id),
  );
  if (
    checkpoint.protocolVersion !== STUDY_FIRST_EVENT_EXECUTOR_VERSION ||
    checkpoint.plannedSnapshotId !== investigation.snapshotId ||
    checkpoint.planFingerprint !== investigation.plan.planFingerprint ||
    !investigation.plan.steps.some(({ id }) => id === checkpoint.stepId) ||
    checkpoint.result.stepId !== checkpoint.stepId ||
    checkpoint.result.attempt.stepId !== checkpoint.stepId ||
    checkpoint.result.attempt.attemptFingerprint !==
      fingerprintSixScreenValue(attemptBody) ||
    checkpoint.result.attempt.candidateOccurrenceIds.some((id) =>
      !candidateIds.has(id)) ||
    checkpoint.checkpointFingerprint !== fingerprintSixScreenValue(
      studyFirstEventStepCheckpointBody(checkpoint),
    )
  ) {
    throw new Error("Stored study-first Screen 4 step checkpoint is invalid or changed.");
  }
  checkpoint.result.candidates.forEach(validateCoEventCandidateOccurrence);
  return checkpoint;
}

function createStudyFirstEventCheckpoint(input: Omit<
  StudyFirstEventCheckpoint,
  "protocolVersion" | "checkpointFingerprint"
>) {
  const body = {
    protocolVersion: STUDY_FIRST_EVENT_EXECUTOR_VERSION,
    ...structuredClone(input),
  };
  return {
    ...body,
    checkpointFingerprint: fingerprintSixScreenValue(body),
  } satisfies StudyFirstEventCheckpoint;
}

function validateStudyFirstEventCheckpoint(
  checkpoint: StudyFirstEventCheckpoint,
  plannedSnapshotId: string,
  planFingerprint: string,
) {
  if (
    checkpoint.protocolVersion !== STUDY_FIRST_EVENT_EXECUTOR_VERSION ||
    checkpoint.plannedSnapshotId !== plannedSnapshotId ||
    checkpoint.planFingerprint !== planFingerprint ||
    checkpoint.checkpointFingerprint !== fingerprintSixScreenValue(
      studyFirstEventCheckpointBody(checkpoint),
    )
  ) {
    throw new Error(
      "Stored study-first Screen 4 checkpoint is invalid or changed.",
    );
  }
  const retainedIds = new Set(
    checkpoint.result.occurrences.map(({ id }) => id),
  );
  if (
    checkpoint.result.presentation.visibleEventIds.length > 10 ||
    checkpoint.result.attempts.some(({ candidateOccurrenceIds }) =>
      candidateOccurrenceIds.some((id) => !retainedIds.has(id))) ||
    checkpoint.result.analyses.some(({ eventId }) => !retainedIds.has(eventId))
  ) {
    throw new Error(
      "Stored study-first Screen 4 checkpoint evidence is inconsistent.",
    );
  }
  return checkpoint;
}

function mechanismLiteratureCheckpointBody(
  checkpoint: MechanismLiteratureStepCheckpoint,
) {
  const { checkpointFingerprint: _fingerprint, ...body } = checkpoint;
  return body;
}

function createMechanismLiteratureStepCheckpoint(input: Omit<
  MechanismLiteratureStepCheckpoint,
  "protocolVersion" | "checkpointFingerprint"
>) {
  const body = {
    protocolVersion: SIX_SCREEN_MECHANISM_LITERATURE_EXECUTOR_VERSION,
    ...structuredClone(input),
  };
  return {
    ...body,
    checkpointFingerprint: fingerprintSixScreenValue(body),
  } satisfies MechanismLiteratureStepCheckpoint;
}

function validateMechanismLiteratureStepCheckpoint(
  checkpoint: MechanismLiteratureStepCheckpoint,
  literaturePlan: MechanismLiteraturePlan,
) {
  if (
    !isSupportedMechanismLiteratureExecutorVersion(checkpoint.protocolVersion) ||
    checkpoint.checkpointFingerprint !== fingerprintSixScreenValue(
      mechanismLiteratureCheckpointBody(checkpoint),
    )
  ) throw new Error("Stored Screen 5 provider checkpoint is invalid or changed.");
  validateMechanismLiteratureExecutionPlan(
    checkpoint.executionPlan,
    literaturePlan,
  );
  if (checkpoint.attempt) {
    validateMechanismLiteratureProviderAttempt(checkpoint.attempt);
  }
  checkpoint.newRecords.forEach(validateScholarlyMetadataRecord);
  checkpoint.records.forEach(validateScholarlyMetadataRecord);
  validateMechanismLiteratureExecution(
    checkpoint.execution,
    checkpoint.executionPlan,
  );
  validateScholarlyEvidencePacket({
    packet: checkpoint.packet,
    literaturePlan,
    execution: checkpoint.execution,
    records: checkpoint.records,
  });
  if (
    checkpoint.execution.attempt?.attemptFingerprint !==
      checkpoint.attempt?.attemptFingerprint ||
    checkpoint.newRecords.map(({ id }) => id).join("\u0000") !==
      (checkpoint.attempt?.scholarlyMetadataRecordIds ?? []).join("\u0000") ||
    checkpoint.records.map(({ id }) => id).join("\u0000") !==
      checkpoint.execution.scholarlyMetadataRecordIds.join("\u0000") ||
    checkpoint.packet.binding.executionSnapshotId !==
      checkpoint.execution.snapshotId
  ) throw new Error("Stored Screen 5 checkpoint evidence is inconsistent.");
  return checkpoint;
}

function scholarlyDocumentCheckpointBody(
  checkpoint: ScholarlyDocumentCheckpoint,
) {
  const { checkpointFingerprint: _fingerprint, ...body } = checkpoint;
  return body;
}

function createScholarlyDocumentCheckpoint(input: Omit<
  ScholarlyDocumentCheckpoint,
  "protocolVersion" | "checkpointFingerprint"
>) {
  const body = {
    protocolVersion: SIX_SCREEN_SCHOLARLY_DOCUMENT_ADAPTER_VERSION,
    ...structuredClone(input),
  };
  return {
    ...body,
    checkpointFingerprint: fingerprintSixScreenValue(body),
  } satisfies ScholarlyDocumentCheckpoint;
}

function validateScholarlyDocumentCheckpoint(
  checkpoint: ScholarlyDocumentCheckpoint,
  context: {
    literaturePlan: MechanismLiteraturePlan;
    metadataExecution: MechanismLiteratureExecution;
    metadataPacket: ScholarlyEvidencePacket;
    metadataRecords: readonly ScholarlyMetadataRecord[];
    priorAcquisitions: readonly ScholarlyDocumentAcquisition[];
    previousPassagePacket: ScholarlyPassagePacket | null;
  },
) {
  if (
    checkpoint.protocolVersion !== SIX_SCREEN_SCHOLARLY_DOCUMENT_ADAPTER_VERSION ||
    checkpoint.checkpointFingerprint !== fingerprintSixScreenValue(
      scholarlyDocumentCheckpointBody(checkpoint),
    )
  ) throw new Error("Stored scholarly document checkpoint is invalid or changed.");
  validateScholarlyDocumentAcquisition(checkpoint.acquisition);
  validateScholarlyDocumentInspectionPlan(checkpoint.acquisition.plan, {
    literaturePlan: context.literaturePlan,
    metadataExecution: context.metadataExecution,
    metadataPacket: context.metadataPacket,
    metadataRecords: context.metadataRecords,
    priorAcquisitions: context.priorAcquisitions,
  });
  validateScholarlyPassagePacket(checkpoint.passagePacket, {
    metadataPacket: context.metadataPacket,
    acquisition: checkpoint.acquisition,
    previous: context.previousPassagePacket,
    acquisitions: [...context.priorAcquisitions, checkpoint.acquisition],
  });
  return checkpoint;
}

function stableCoEventCandidateFingerprint(
  candidate: CoEventCandidateOccurrence,
) {
  const {
    candidateFingerprint: _candidateFingerprint,
    recordedAt: _recordedAt,
    evidence,
    ...body
  } = candidate;
  return fingerprintSixScreenValue({
    ...body,
    evidence: evidence.map(({ retrievedAt: _retrievedAt, ...source }) => source),
  });
}

function stableCoEventLeadFingerprint(lead: CoEventDiscoveryLead) {
  const {
    leadFingerprint: _leadFingerprint,
    recordedAt: _recordedAt,
    ...body
  } = lead;
  return fingerprintSixScreenValue(body);
}

function canonicalCoEventStepEvidence(input: {
  workflow: SixScreenWorkflowState;
  result: CoEventProviderExecutionResult;
}) {
  const candidateMap = new Map(
    (input.workflow.coEventCandidates ?? []).map((candidate) =>
      [candidate.id, candidate]),
  );
  const leadMap = new Map(
    (input.workflow.coEventDiscoveryLeads ?? []).map((lead) => [lead.id, lead]),
  );
  const candidates = input.result.candidates.map((candidate) => {
    const existing = candidateMap.get(candidate.id);
    if (!existing) return candidate;
    if (
      stableCoEventCandidateFingerprint(existing) !==
        stableCoEventCandidateFingerprint(candidate)
    ) throw new Error("Screen 4 occurrence id collided with different evidence.");
    return structuredClone(existing);
  });
  const discoveryLeads = input.result.leads.map((lead) => {
    const existing = leadMap.get(lead.id);
    if (!existing) return lead;
    if (
      stableCoEventLeadFingerprint(existing) !==
        stableCoEventLeadFingerprint(lead)
    ) throw new Error("Screen 4 discovery-lead id collided with different metadata.");
    return structuredClone(existing);
  });
  return { candidates, discoveryLeads };
}

function updateScreen5MechanismExecution(
  execution: Screen5MechanismExecution,
  patch: Partial<Pick<
    Screen5MechanismExecution,
    | "phase"
    | "attempts"
    | "budgetSnapshot"
    | "evidencePacket"
    | "assessmentBatchPlan"
    | "comparison"
    | "authorization"
    | "nextEligibleAt"
    | "retryCount"
    | "lastError"
  >>,
  updatedAt: string,
) {
  const {
    schemaVersion: _schemaVersion,
    provider: _provider,
    modelRequested: _modelRequested,
    pilotId: _pilotId,
    planPromptVersion: _planPromptVersion,
    comparisonPromptVersion: _comparisonPromptVersion,
    planWireVersion: _planWireVersion,
    comparisonWireVersion: _comparisonWireVersion,
    settings: _settings,
    executionFingerprint: _executionFingerprint,
    ...body
  } = execution;
  return createScreen5OpenAIExecution({
    ...body,
    ...structuredClone(patch),
    updatedAt,
  });
}

function updateStudyFirstMechanismRun(
  run: StudyFirstMechanismRun,
  patch: Partial<Omit<
    StudyFirstMechanismRun,
    "schemaVersion" | "runFingerprint"
  >>,
) {
  const {
    schemaVersion: _schemaVersion,
    runFingerprint: _runFingerprint,
    ...body
  } = run;
  return createStudyFirstMechanismRun({
    ...body,
    ...structuredClone(patch),
  });
}

function checkpointStudyFirstMechanismRun(input: {
  state: SixScreenWorkflowState;
  previous: StudyFirstMechanismRun;
  label: string;
  savedAt: string;
  patch: Partial<Omit<
    StudyFirstMechanismRun,
    "schemaVersion" | "runFingerprint"
  >>;
}) {
  const runs = input.state.studyFirstMechanismRuns ?? [];
  const previousRunId = runs.at(-1)?.id ?? null;
  const ordinal = runs.length + 1;
  const coordinate = fingerprintSixScreenValue({
    label: input.label,
    previousRunId,
    ordinal,
    savedAt: input.savedAt,
    execution: input.previous.providerExecution?.executionFingerprint ?? null,
  }).slice("fnv1a64:".length);
  return updateStudyFirstMechanismRun(input.previous, {
    ...input.patch,
    id: `screen5-${input.label}-${coordinate}`,
    ordinal,
    previousRunId,
    createdAt: input.savedAt,
  });
}

function screen5MechanismAttempt(input: {
  execution: Screen5MechanismExecution;
  stage: Screen5MechanismAttempt["stage"];
  reservedTokens: number;
  estimatedInputTokens: number;
  maxCompletionTokens: number;
  authorizationId: string;
  assessmentBatchId?: string | null;
  assessmentBatchIndex?: number | null;
  evidenceIds?: string[];
  omittedEvidenceIds?: string[];
  now: string;
}) : Screen5MechanismAttempt {
  const ordinal = input.execution.attempts.length + 1;
  return {
    id: `${input.execution.id}:${input.stage}:${ordinal}`,
    stage: input.stage,
    ordinal,
    status: "running",
    reservedTokens: input.reservedTokens,
    estimatedInputTokens: input.estimatedInputTokens,
    maxCompletionTokens: input.maxCompletionTokens,
    startedAt: input.now,
    completedAt: null,
    providerRequestId: null,
    providerResponseId: null,
    serviceTier: null,
    latencyMs: null,
    modelRequested: input.execution.modelRequested,
    modelObserved: null,
    finishReason: null,
    usage: null,
    rateLimit: null,
    errorCode: null,
    retryable: false,
    authorizationId: input.authorizationId,
    assessmentBatchId: input.assessmentBatchId ?? null,
    assessmentBatchIndex: input.assessmentBatchIndex ?? null,
    evidenceIds: input.evidenceIds ? [...input.evidenceIds] : [],
    omittedEvidenceIds: input.omittedEvidenceIds
      ? [...input.omittedEvidenceIds]
      : [],
    responseReceipt: null,
    wireCheckpoint: null,
  };
}

function screen5ProviderFailureDiagnostic(error: Screen5OpenAIProviderError) {
  const networkInvocation = error.detail.networkInvocation ??
    (error.detail.dispatched ? "invoked" as const : "not_started" as const);
  const providerResponse = error.detail.providerResponse ??
    (error.detail.dispatched && error.detail.outcomeKnown
      ? "observed" as const
      : "not_observed" as const);
  const safeCause = error.detail.safeCause &&
      /^[a-z][a-z0-9_]{0,79}$/u.test(error.detail.safeCause)
    ? error.detail.safeCause
    : /^[a-z][a-z0-9_]{0,79}$/u.test(error.detail.code)
      ? error.detail.code
      : "provider_failure";
  return {
    failureStage: error.detail.failureStage ??
      (networkInvocation === "not_started"
        ? "admission" as const
        : providerResponse === "observed"
          ? "model_output" as const
          : "network" as const),
    networkInvocation,
    providerResponse,
    httpStatus: error.detail.httpStatus ?? null,
    safeCause,
  };
}

type Screen5SavedAssessmentBatch = {
  batchId: string;
  wire: Screen5MechanismComparisonWire;
  selectedEvidenceIds: string[];
  omittedEvidenceIds: string[];
};

function savedScreen5AssessmentBatches(
  execution: Screen5MechanismExecution,
): Screen5SavedAssessmentBatch[] {
  return execution.attempts.flatMap((attempt) => {
    const checkpoint = attempt.wireCheckpoint;
    if (
      attempt.stage !== "assessment" || attempt.status !== "succeeded" ||
      !attempt.assessmentBatchId || checkpoint?.kind !== "assessment" ||
      (checkpoint.version !== SCREEN5_MECHANISM_COMPARISON_WIRE_VERSION &&
        checkpoint.version !== HISTORICAL_SCREEN5_COMPARISON_WIRE_VERSION &&
        checkpoint.version !== HISTORICAL_SCREEN5_V2_COMPARISON_WIRE_VERSION)
    ) return [];
    return [{
      batchId: attempt.assessmentBatchId,
      wire: checkpoint.value as Screen5MechanismComparisonWire,
      selectedEvidenceIds: [...(attempt.evidenceIds ?? [])],
      omittedEvidenceIds: [...(attempt.omittedEvidenceIds ?? [])],
    }];
  });
}

type Screen5ReceiptReplayValidation =
  | { outcome: "valid"; stage: "planning"; wire: Screen5MechanismPlanWire }
  | {
      outcome: "valid";
      stage: "assessment";
      wire: Screen5MechanismComparisonWire;
      batchId: string;
    }
  | { outcome: "invalid"; issues: Screen5MechanismValidationIssue[] }
  | { outcome: "unavailable" };

function validateSavedScreen5Receipt(input: {
  run: StudyFirstMechanismRun;
  execution: Screen5MechanismExecution;
  attempt: Screen5MechanismAttempt;
}): Screen5ReceiptReplayValidation {
  const receipt = input.attempt.responseReceipt;
  if (!receipt || input.attempt.wireCheckpoint) return { outcome: "unavailable" };
  const inputCeiling = input.attempt.stage === "planning"
    ? SCREEN5_OPENAI_PLAN_INPUT_CEILING
    : SCREEN5_OPENAI_COMPARISON_INPUT_CEILING;
  if (
    receipt.usage.promptTokens > inputCeiling ||
    receipt.usage.completionTokens > input.attempt.maxCompletionTokens
  ) {
    return {
      outcome: "invalid",
      issues: [{ code: "observed_budget_exceeded", path: "$" }],
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(receipt.finalContent);
  } catch {
    return {
      outcome: "invalid",
      issues: [{ code: "invalid_json", path: "$" }],
    };
  }
  if (input.attempt.stage === "planning") {
    try {
      return {
        outcome: "valid",
        stage: "planning",
        wire: validateScreen5MechanismPlanWire(
          normalizeScreen5MechanismPlanWire(parsed,
            input.run.theoreticalProblem!),
          input.execution.planWireVersion),
      };
    } catch (caught) {
      return {
        outcome: "invalid",
        issues: caught instanceof Screen5MechanismWireValidationError
          ? caught.issues
          : [{ code: "bounded_contract_failed", path: "$",
              stage: "planning", contractVersion: input.execution.planWireVersion }],
      };
    }
  }
  const plan = input.run.planning?.plan;
  const batchPlan = input.execution.assessmentBatchPlan;
  const batchId = input.attempt.assessmentBatchId;
  const batch = batchPlan?.batches.find(({ id }) => id === batchId);
  if (!plan || !batchPlan || !batchId || !batch) {
    return { outcome: "unavailable" };
  }
  const existingRows = savedScreen5AssessmentBatches(input.execution).find(
    ({ wire }) => wire.row_definitions.length > 0,
  )?.wire.row_definitions ?? [];
  try {
    return {
      outcome: "valid",
      stage: "assessment",
      batchId,
      wire: validateScreen5MechanismComparisonWire(
        parsed,
        new Set(input.attempt.evidenceIds ?? []),
        {
          candidateIds: batch.candidateIds,
          includeFocal: batch.includeFocal,
          rowIds: existingRows.map(({ row_id }) => row_id),
          allowedMergeTargets: plan.candidates.map(({ id }) => id),
        },
      ),
    };
  } catch (caught) {
    return {
      outcome: "invalid",
      issues: caught instanceof Screen5MechanismWireValidationError
        ? caught.issues
        : [{ code: "bounded_contract_failed", path: "$" }],
    };
  }
}

function screen5MechanismEarliestAssessmentAt(input: {
  completedAt: string;
  retryAfterAt: string | null;
  tokenResetAt: string | null;
}) {
  // Honor a returned provider deadline. Without one, the durable Stage A
  // checkpoint itself is sufficient: the same explicit one-click job may move
  // directly into retrieval and its first evidence assessment.
  const candidates = [
    Date.parse(input.completedAt),
    input.retryAfterAt ? Date.parse(input.retryAfterAt) : Number.NaN,
    input.tokenResetAt ? Date.parse(input.tokenResetAt) : Number.NaN,
  ].filter(Number.isFinite);
  return new Date(Math.max(...candidates)).toISOString();
}

function screen5ProviderExecutionIsCompatible(
  run: StudyFirstMechanismRun | null,
) {
  const execution = run?.providerExecution;
  return Boolean(
    run && execution && run.theoreticalProblem &&
    run.planning?.origin === "openai" &&
    execution.provider === "openai" &&
    execution.modelRequested === SCREEN5_OPENAI_MODEL &&
    (execution.schemaVersion === SCREEN5_OPENAI_EXECUTION_VERSION ||
      execution.schemaVersion === HISTORICAL_OPENAI_SCREEN5_EXECUTION_VERSION) &&
    execution.inputFingerprint === run.input.inputFingerprint &&
    execution.problemFingerprint === run.theoreticalProblem.problemFingerprint,
  );
}

function screen5ProviderMigrationKey(run: StudyFirstMechanismRun) {
  return fingerprintSixScreenValue({
    contextFingerprint: run.context.contextFingerprint,
    inputId: run.input.id,
    inputFingerprint: run.input.inputFingerprint,
    problemFingerprint: run.theoreticalProblem?.problemFingerprint ?? null,
    targetProvider: "openai",
    targetModel: SCREEN5_OPENAI_MODEL,
    executionVersion: SCREEN5_OPENAI_EXECUTION_VERSION,
  });
}

function screen5NextInferenceStage(execution: Screen5MechanismExecution) {
  if (execution.phase === "planning_queued") return "planning" as const;
  if (
    execution.phase === "evidence_ready" ||
    execution.phase === "waiting_for_rate_limit" ||
    execution.phase === "assessment_partial"
  ) return "assessment" as const;
  if (
    (execution.phase === "failed" || execution.phase === "outcome_unknown") &&
    execution.lastError?.retryable
  ) {
    return execution.lastError.stage === "assessment"
      ? "assessment" as const
      : execution.lastError.stage === "planning"
        ? "planning" as const
        : null;
  }
  return null;
}

function screen5CredentialStatus(state: SixScreenWorkflowState) {
  const attempt = (state.studyFirstMechanismRuns ?? [])
    .flatMap((run) => run.providerExecution?.attempts ?? [])
    .filter(({ status }) =>
      status === "succeeded" || status === "failed" ||
      status === "outcome_unknown"
    ).at(-1);
  if (!attempt) return "not_tested" as const;
  if (attempt.status === "succeeded") return "last_success" as const;
  if (
    attempt.errorCode === "provider_http_401" ||
    attempt.errorCode === "invalid_api_key" ||
    attempt.errorCode === "openai_authentication_failed"
  ) return "last_401" as const;
  return "other_failure" as const;
}

export class SixScreenWorkflowRuntime {
  constructor(private readonly options: {
    store: SixScreenWorkflowStore;
    signingKey: string | Uint8Array;
    now: () => string;
    fetch: Screen02ConnectorFetch;
    /** Researcher-supplied public URL retrieval. Production supplies the
     * Worker's strictly-public global fetch; official API traffic continues
     * through the narrower fixed-source transport above. */
    publicWebFetch?: Screen02ConnectorFetch;
    govInfoApiKey?: string;
    congressApiKey?: string;
    regulationsApiKey?: string;
    openStatesApiKey?: string;
    openAlexApiKey?: string;
    configuredSourceSecrets?: Partial<Record<SixScreenSecretName, boolean>>;
    sourceCapabilityProbes?: Partial<
      Record<SixScreenSourceId, SixScreenCapabilityProbe>
    >;
    autoProbeSourceCapabilities?: boolean;
    scholarlyDocumentHosts?: readonly string[];
    scholarlyDocumentCapabilityTested?: boolean;
    monotonicNow?: () => number;
    taskStore?: SixScreenResearchTaskStore;
    /** Compact Screen 4 model manifests, receipts, and results. The full
     * source aggregate remains in taskStore and is never promoted for model
     * admission when this store is configured. */
    screen4AssessmentStore?: Screen4AssessmentStore;
    evidenceStore?: SixScreenEvidenceStore;
    hostReasoningTaskStore?: HostReasoningTaskStore;
    screen5OpenAIMode?: string;
    screen5OpenAIApiKey?: string;
    screen5OpenAIFetch?: Screen5OpenAIFetch;
    screen5OpenAILedgerStore?: Screen5OpenAILedgerStore;
    screen5OpenAIAuthorization?: Screen5OpenAIExecutionAuthorization;
  }) {}

  /** Credential presence is not treated as proof that a provider works.
   * Screen 4 performs the existing bounded harmless probes immediately before
   * it builds an executable live-source register. Probe results are cached by
   * the probe layer, so a multi-step investigation does not re-probe every
   * provider on every step. */
  private async liveScreen4SourceRegister() {
    const probes = this.options.autoProbeSourceCapabilities
      ? await probeConfiguredSixScreenSources({
          fetch: this.options.fetch,
          now: this.options.now,
          secrets: {
            govInfoApiKey: this.options.govInfoApiKey,
            congressApiKey: this.options.congressApiKey,
            regulationsApiKey: this.options.regulationsApiKey,
            openStatesApiKey: this.options.openStatesApiKey,
          },
          existingProbes: this.options.sourceCapabilityProbes,
        })
      : this.options.sourceCapabilityProbes;
    return buildSixScreenSourceRegister({
      configuredSecrets: this.options.configuredSourceSecrets,
      probes,
    });
  }

  private screen5OpenAIRuntimeMode(): "local-preview" | "production" | null {
    return this.options.screen5OpenAIMode === "local-preview" ||
        this.options.screen5OpenAIMode === "production"
      ? this.options.screen5OpenAIMode
      : null;
  }

  private screen5OpenAIConfigurationIsValid() {
    return this.screen5OpenAIRuntimeMode() !== null;
  }

  private screen2PolicySourceDiscoveryIsConfigured() {
    return Boolean(
      this.options.publicWebFetch &&
      this.options.screen5OpenAILedgerStore &&
      this.options.screen5OpenAIApiKey &&
      this.options.screen5OpenAIFetch &&
      this.screen5OpenAIConfigurationIsValid()
    );
  }

  private initializeOpenAIUsage(
    ledger: Screen5OpenAILedgerStore,
    now = this.options.now(),
  ) {
    const mode = this.screen5OpenAIRuntimeMode();
    if (!mode) {
      throw new Error("The OpenAI runtime mode is not enabled.");
    }
    return ledger.initializeRuntimeUsage({
      attempts: 0,
      tokens: 0,
      source: mode === "production"
        ? "openai-production-v1"
        : "openai-local-preview-v1",
      now,
    });
  }

  /** Readiness checks must not interfere with a durable claim that has already
   * been saved. Reuse an unlimited account read-only; initialize or migrate
   * only when the account is absent or still carries an older policy mode. */
  private async readOpenAIUsage(
    ledger: Screen5OpenAILedgerStore,
    now = this.options.now(),
  ) {
    try {
      const current = await ledger.summary();
      if (current.policyMode === "unlimited") return current;
    } catch (caught) {
      if (!(caught instanceof Error && /not initialized/iu.test(
        caught.message))) throw caught;
    }
    return this.initializeOpenAIUsage(ledger, now);
  }

  private screen5DirectIntent() {
    // Screen 5 is OpenAI-only. Invalid or missing configuration must stay on
    // the direct setup path and must never reactivate the legacy host route.
    return true;
  }

  private screen5AuthorizationForStage(
    execution: Screen5MechanismExecution,
    stage: "planning" | "assessment",
  ) {
    const savedAuthorization = execution.authorization ?? null;
    const configuredAuthorization = this.options.screen5OpenAIAuthorization;
    const authorizations: Screen5OpenAIExecutionAuthorization[] = [
      ...(savedAuthorization ? [{
        authorizationId: savedAuthorization.authorizationId,
        jobId: savedAuthorization.jobId,
        stages: savedAuthorization.stages,
        assessmentBatchId: savedAuthorization.assessmentBatchId ?? null,
      }] : []),
      ...(configuredAuthorization ? [configuredAuthorization] : []),
    ];
    const nextBatch = stage === "assessment"
      ? nextScreen5MechanismAssessmentBatch(execution)
      : null;
    return authorizations.find((authorization) =>
      /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/u.test(
        authorization.authorizationId,
      ) &&
      authorization.jobId === execution.id &&
      authorization.stages.includes(stage) &&
      (stage !== "assessment" || !execution.assessmentBatchPlan ||
        (authorization.assessmentBatchId
          ? authorization.assessmentBatchId === nextBatch?.id
          : authorization.stages.includes("planning"))) &&
      !execution.attempts.some((attempt) =>
        attempt.stage === stage &&
        attempt.authorizationId === authorization.authorizationId &&
        (stage === "planning" ||
          attempt.assessmentBatchId === nextBatch?.id)
      )
    );
  }

  private screen5AuthorizationMatches(
    execution: Screen5MechanismExecution,
    stage: "planning" | "assessment",
  ) {
    return Boolean(this.screen5AuthorizationForStage(execution, stage));
  }

  private async screen5ExecutionReadiness(
    state: SixScreenWorkflowState,
  ): Promise<Screen5ExecutionReadiness> {
    const currentRun = currentStudyFirstMechanismRunForState(state);
    const execution = currentRun?.providerExecution ?? null;
    const directIntent = this.screen5DirectIntent();
    const selectedBackend = this.screen5OpenAIConfigurationIsValid()
      ? "openai" as const
      : "off" as const;
    const missingSettings: Screen5ExecutionReadiness["missingSettings"] = [];
    if (!this.screen5OpenAIConfigurationIsValid()) {
      missingSettings.push("SHOCKAUDIT_SCREEN5_OPENAI_MODE");
    }
    if (!this.options.screen5OpenAIApiKey) missingSettings.push("OPENAI_API_KEY");
    if (!this.options.screen5OpenAIFetch) {
      missingSettings.push("SCREEN5_OPENAI_TRANSPORT");
    }
    if (!this.options.screen5OpenAILedgerStore) {
      missingSettings.push("SCREEN5_OPENAI_LEDGER_STORE");
    }

    let ledgerState: Screen5ExecutionReadiness["ledgerState"] =
      !this.options.screen5OpenAILedgerStore
        ? "missing_binding"
        : "uninitialized";
    let budget: Screen5MechanismBudgetSnapshot | null = null;
    if (this.options.screen5OpenAILedgerStore) {
      try {
        // Every configured study uses uncapped cumulative accounting automatically.
        // Preserve historical use and unresolved holds during migration.
        budget = this.screen5OpenAIConfigurationIsValid()
          ? await this.readOpenAIUsage(
              this.options.screen5OpenAILedgerStore,
            )
          : await this.options.screen5OpenAILedgerStore.summary();
        ledgerState = budget.remainingAttempts < 1 ||
            budget.remainingTokens < SCREEN5_OPENAI_PLAN_RESERVED_TOKENS
          ? "exhausted"
          : "valid";
      } catch (caught) {
        ledgerState = caught instanceof Error &&
            /not initialized/iu.test(caught.message)
          ? "uninitialized"
          : "invalid";
      }
    }
    const allowance = budget
      ? {
          ...(budget.policyMode ? { policyMode: budget.policyMode } : {}),
          ...(budget.accountingVersion ? { accountingVersion: budget.accountingVersion } : {}),
          ...(budget.lastRenewalId ? { lastRenewalId: budget.lastRenewalId } : {}),
          ...(budget.lastRenewalWindow ? { lastRenewalWindow: budget.lastRenewalWindow } : {}),
          maximumAttempts: budget.maximumAttempts,
          maximumTokens: budget.maximumTokens,
          conservativePriorAttempts: 0,
          conservativePriorTokens: 0,
          localAttemptsReserved: budget.attemptsReserved,
          localObservedTokens: budget.tokensConsumed,
          localHeldTokens: budget.tokensHeld,
          remainingAttempts: budget.remainingAttempts,
          remainingTokens: budget.remainingTokens,
        }
      : null;
    const configurationReady = this.screen5OpenAIConfigurationIsValid() &&
      Boolean(this.options.screen5OpenAIApiKey) &&
      Boolean(this.options.screen5OpenAIFetch) &&
      Boolean(this.options.screen5OpenAILedgerStore) &&
      (ledgerState === "valid" || ledgerState === "exhausted" ||
        ledgerState === "uninitialized");
    const nextStage = execution ? screen5NextInferenceStage(execution) : null;
    const authorization = !execution || execution.phase === "completed" ||
        (execution && !nextStage)
      ? "not_applicable" as const
      : execution && nextStage &&
          this.screen5AuthorizationMatches(execution, nextStage)
        ? "authorized" as const
        : "required" as const;
    const authorizedStages = execution
      ? [...new Set([
          ...(execution.authorization?.jobId === execution.id
            ? execution.authorization.stages
            : []),
          ...(this.options.screen5OpenAIAuthorization?.jobId === execution.id
            ? this.options.screen5OpenAIAuthorization.stages
            : []),
        ])]
      : [];
    const compatible = screen5ProviderExecutionIsCompatible(currentRun);
    const activeOrigin = execution
      ? execution.provider
      : currentRun?.planning?.origin ?? "none" as const;
    const migration = !currentRun
      ? "not_needed" as const
      : compatible
        ? "prepared" as const
        : directIntent
          ? "eligible" as const
          : "not_needed" as const;
    const savedAggregateReplay = Boolean(
      execution?.phase === "blocked" &&
      execution.lastError?.code === "receipt_saved_merge_pending",
    );
    const latestAttempt = execution?.attempts.at(-1);
    const savedPlanCheckpoint = Boolean(execution && !currentRun?.planning?.plan &&
      execution.attempts.some((attempt) => attempt.stage === "planning" &&
        attempt.status === "succeeded" && attempt.wireCheckpoint?.kind === "planning"));
    const savedReceiptReplay = Boolean(
      latestAttempt?.responseReceipt && !latestAttempt.wireCheckpoint,
    );
    const unchangedQuarantine = Boolean(latestAttempt?.responseReceipt?.status ===
      "quarantined" && latestAttempt.responseReceipt.validationIssues.some(
        ({ validationRevision }) => validationRevision ===
          (latestAttempt.stage === "planning" ? SCREEN5_PLAN_VALIDATION_REVISION
            : SCREEN5_ASSESSMENT_VALIDATION_REVISION)));
    const replayableReceipt = savedReceiptReplay && !unchangedQuarantine;
    const savedLocalReplay = savedAggregateReplay || replayableReceipt || savedPlanCheckpoint;
    const canAdvanceWithoutInference = Boolean(
      execution && (savedLocalReplay || configurationReady &&
        (execution.phase === "plan_ready" || execution.phase === "retrieving")),
    );
    const requiredTokens = nextStage === "assessment"
      ? SCREEN5_OPENAI_COMPARISON_RESERVED_TOKENS
      : SCREEN5_OPENAI_PLAN_RESERVED_TOKENS;
    const canDispatch = Boolean(
      configurationReady && execution && nextStage &&
      authorization === "authorized" && budget &&
      budget.remainingAttempts >= 1 && budget.remainingTokens >= requiredTokens,
    );
    const canEnsure = Boolean(
      directIntent && currentRun &&
      currentRun.inputAssessment.status === "ready" &&
      (!compatible || execution?.phase === "configuration_required"),
    );

    let nextAction: Screen5ExecutionReadiness["nextAction"] = "none";
    if (savedAggregateReplay) {
      nextAction = "restore_saved_comparison";
    } else if (savedPlanCheckpoint) {
      nextAction = "restore_saved_mechanisms";
    } else if (replayableReceipt) {
      nextAction = "recheck_saved_response";
    } else if (unchangedQuarantine) {
      nextAction = "read_saved_diagnostic";
    } else if (directIntent && selectedBackend !== "openai") {
      nextAction = "configure_direct_mode";
    } else if (selectedBackend === "openai" && !this.options.screen5OpenAIApiKey) {
      nextAction = "provide_server_key";
    } else if (
      selectedBackend === "openai" &&
      (!this.options.screen5OpenAILedgerStore || ledgerState === "invalid")
    ) {
      nextAction = "configure_pilot_ledger";
    } else if (selectedBackend === "openai" && ledgerState === "uninitialized") {
      nextAction = currentRun ? "ensure_direct_job" : "initialize_pilot_ledger";
    } else if (canEnsure) {
      nextAction = "ensure_direct_job";
    } else if (execution?.phase === "completed") {
      nextAction = "read_completed_result";
    } else if (execution && !canAdvanceWithoutInference && !canDispatch) {
      nextAction = "request_execution_authorization";
    } else if (execution) {
      nextAction = "resume_direct_job";
    }

    return {
      schemaVersion: SCREEN5_EXECUTION_READINESS_VERSION,
      selectedBackend,
      provider: "openai",
      model: SCREEN5_OPENAI_MODEL,
      route: configurationReady
        ? "direct"
        : "direct_setup_required",
      configuration: selectedBackend === "off"
        ? "off"
        : configurationReady
          ? "ready"
          : "blocked",
      missingSettings,
      keyPresent: Boolean(this.options.screen5OpenAIApiKey),
      credentialStatus: screen5CredentialStatus(state),
      ledgerState,
      allowance,
      authorization,
      authorizedStages,
      activeOrigin,
      activeExecutionId: execution?.id ?? null,
      migration,
      canEnsure,
      canAdvanceWithoutInference,
      canDispatch,
      serverObservedAt: execution?.phase === "waiting_for_rate_limit"
        ? this.options.now()
        : null,
      nextAction,
    };
  }

  /** Explicit local policy change; never dispatches a provider request. */
  async renewModelAllowance(
    authentication: SixScreenWorkflowAuthentication,
    input: { expectedRevision: number; operationId: string;
      acknowledgedByOwner: true; allowanceWindow?: LocalModelAllowanceWindow },
  ) {
    if (!this.options.screen5OpenAILedgerStore ||
        input.acknowledgedByOwner !== true) {
      throw new Error("Local allowance renewal requires an explicit owner action and saved ledger.");
    }
    const before = await this.options.store.read(authentication);
    if (before.outcome !== "found") {
      throw new Error("The current six-screen workflow is unavailable.");
    }
    const operation = {
      expectedRevision: input.expectedRevision,
      operationId: input.operationId,
      operationKind: "renew_model_allowance",
      payload: { acknowledgedByOwner: true,
        policy: "v23_local_evaluation",
        ...(input.allowanceWindow && input.allowanceWindow !== "standard"
          ? { allowanceWindow: input.allowanceWindow } : {}) },
    };
    if (before.record.operationReplays.some((item) =>
      item.operationId === input.operationId)) {
      return this.mutation(authentication, operation,
        (state) => ({ state, result: { policyUpdated: true } }));
    }
    if (before.record.state.revision !== input.expectedRevision) {
      throw new Error(`Stale six-screen workflow mutation; current revision is ${before.record.state.revision}.`);
    }
    const ledger = this.options.screen5OpenAILedgerStore;
    await ledger.renewAllowance({ acknowledgedByOwner: true,
      renewalId: fingerprintSixScreenValue({ runId: authentication.runId,
        operationId: input.operationId }),
      window: input.allowanceWindow ?? "standard",
      now: this.options.now(),
    });
    const latest = await this.options.store.read(authentication);
    if (latest.outcome !== "found") {
      throw new Error("The saved allowance changed, but workflow status could not be reopened.");
    }
    return this.mutation(authentication, {
      expectedRevision: latest.record.state.revision,
      operationId: operation.operationId,
      operationKind: operation.operationKind,
      payload: operation.payload,
    }, (state) => ({ state, result: { policyUpdated: true } }));
  }

  private async projectionWithScreen5Readiness(
    state: SixScreenWorkflowState,
    projection = publicProjection(state),
    authentication?: SixScreenWorkflowAuthentication,
  ) {
    const modelCapability = await this.screen5ExecutionReadiness(state);
    const contextualProjection = await this
      .contextualizationRecoveryProjection(state, projection);
    const discoveredEventWorkspace = authentication
      ? await this.screen4DiscoveryTaskProjection(
          authentication,
          state,
          contextualProjection.studyFirstEventInvestigationWorkspace,
        )
      : contextualProjection.studyFirstEventInvestigationWorkspace;
    const eventWorkspace = authentication
      ? await this.screen4AssessmentStoreProjection(
          authentication,
          state,
          discoveredEventWorkspace,
        )
      : discoveredEventWorkspace;
    // The compact source store can hold the completed Screen 4 investigation
    // while the canonical workflow deliberately retains only its small
    // planned placeholder. Build the Screen 4 -> 5 readiness copy from the
    // authenticated, task-bound projection so the UI does not call completed
    // work "pending".
    const projectedScreen5Prerequisites = screen5PrerequisiteReport(
      state,
      eventWorkspace.investigation,
    );
    const interpretationQueue = this.options.screen4AssessmentStore
      ? eventWorkspace.interpretationQueue
      : await this.screen4InterpretationReadiness(
          eventWorkspace.interpretationQueue, state);
    let designState = screen6StateWithEventSource(state, eventWorkspace);
    let retainedInvestigation = screen6RetainedEventInvestigation(designState);
    let retainedQueue = retainedInvestigation?.snapshotId ===
      eventWorkspace.investigation?.snapshotId ? interpretationQueue : null;
    // Older compact scans also live in task storage. An empty or interrupted
    // newer scan must not erase those previously retained documentary leads.
    if (authentication && (!screen6NamedEventOccurrences(retainedInvestigation).length ||
        retainedInvestigation?.snapshotId !== eventWorkspace.investigation?.snapshotId)) {
      const history = [...(state.studyFirstEventInvestigations ?? [])].reverse()
        .filter((item) => item.snapshotId !== eventWorkspace.investigation?.snapshotId &&
          item.snapshotId !== eventWorkspace.investigation?.previousSnapshotId &&
          item.context.policy.identityFingerprint === state.confirmedShock?.identityFingerprint)
        .sort((left, right) => Number(right.context.study.revision === state.study.revision) -
          Number(left.context.study.revision === state.study.revision));
      for (const item of history) {
        const discovered = await this.screen4DiscoveryTaskProjection(authentication, state,
          { ...eventWorkspace, investigation: item, documentedOccurrences: [], retainedSource: undefined });
        const assessed = await this.screen4AssessmentStoreProjection(authentication, state, discovered);
        designState = screen6StateWithEventSource(designState, assessed);
        retainedInvestigation = screen6RetainedEventInvestigation(designState);
        if (screen6NamedEventOccurrences(retainedInvestigation).length &&
            retainedInvestigation?.snapshotId === assessed.investigation?.snapshotId) {
          retainedQueue = assessed.interpretationQueue;
          break;
        }
      }
    }
    const designProjection = publicProjection(designState);
    return {
      ...contextualProjection,
      screen6CurrentPlan: designProjection.screen6CurrentPlan,
      screen6Personalization: designProjection.screen6Personalization,
      screen6HistoricalPersonalization: designProjection.screen6HistoricalPersonalization,
      studyFirstEventInvestigationWorkspace: {
        ...eventWorkspace,
        interpretationQueue,
        ...(retainedInvestigation && screen6NamedEventOccurrences(retainedInvestigation).length
          ? { retainedSource: { investigation: retainedInvestigation,
              interpretationQueue: retainedQueue } } : {}),
      },
      studyFirstMechanismWorkspace: {
        ...contextualProjection.studyFirstMechanismWorkspace,
        executionReadiness: modelCapability,
      },
      modelCapability,
      screen5Prerequisites: projectedScreen5Prerequisites,
      canOpenScreen5: projectedScreen5Prerequisites.ready,
    };
  }

  private async contextualizationRecoveryProjection(
    state: SixScreenWorkflowState,
    projection: SixScreenWorkflowPublicProjection,
  ) {
    const ledger = this.options.screen5OpenAILedgerStore;
    if (!ledger) return projection;
    const updated = structuredClone(projection);
    const candidates = [
      {
        publicRecord: updated.causalComparisonWorkspace.studyFirst
          .contextualization,
        records: state.screen3Contextualizations ?? [],
      },
      {
        publicRecord: updated.screen6Personalization,
        records: state.screen6Personalizations ?? [],
      },
    ];
    await Promise.all(candidates.map(async ({ publicRecord, records }) => {
      if (!publicRecord) return;
      const saved = records.find(({ id }) => id === publicRecord.id);
      if (!saved || !recoverableContextualizationClaim(
        saved, this.options.now())) return;
      try {
        const phase = await ledger.reservationStatus(saved.reservationId);
        if (phase === "absent" || phase === "reserved_not_dispatched") {
          publicRecord.retryEligibility = "new_request";
        }
      } catch {
        // Read-only readiness fails closed and never changes the saved task.
      }
    }));
    return updated;
  }

  private studyFirstEventStepCheckpoints(
    record: SixScreenResearchTaskRecord,
    investigation: StudyFirstEventInvestigation,
  ) {
    const valid: StudyFirstEventStepCheckpoint[] = [];
    let malformed = false;
    for (const replay of record.operationReplays) {
      if (replay.operationKind !== "commit_study_first_event_step") continue;
      try {
        const checkpoint = validateStudyFirstEventStepCheckpoint(
          replay.result as StudyFirstEventStepCheckpoint,
          investigation,
        );
        const existing = valid.findIndex(({ stepId }) =>
          stepId === checkpoint.stepId);
        if (existing >= 0) {
          if (valid[existing]!.checkpointFingerprint !==
              checkpoint.checkpointFingerprint) malformed = true;
          continue;
        }
        valid.push(checkpoint);
      } catch {
        // Optional task data is quarantined from the public projection. The
        // original research-task record remains retained for diagnosis.
        malformed = true;
      }
    }
    return { valid, malformed };
  }

  private async screen4DiscoveryTaskProjection(
    authentication: SixScreenWorkflowAuthentication,
    state: SixScreenWorkflowState,
    workspace: StudyFirstEventInvestigationWorkspace,
  ): Promise<StudyFirstEventInvestigationWorkspace> {
    const investigation = workspace.investigation;
    if (!investigation) return workspace;
    if (investigation.status !== "planned") return workspace;
    const taskId = studyFirstEventTaskId(investigation);
    if (!this.options.taskStore) {
      return {
        ...workspace,
        discoveryTask: {
          ...workspace.discoveryTask!, taskId, state: "failed",
          nextAction: "none",
          stopReason:
            "The configured durable research-task store is unavailable.",
        },
      };
    }
    const read = await this.options.taskStore.read({
      ...authentication, taskId,
    });
    if (read.outcome === "unauthorized") {
      throw new Error("Study-first Screen 4 research-task access is unauthorized.");
    }
    if (read.outcome === "not_found") return workspace;
    const request = read.record.task.immutableRequest as {
      protocolVersion?: string;
      plannedSnapshotId?: string;
      planFingerprint?: string;
    };
    if (request.protocolVersion !== STUDY_FIRST_EVENT_EXECUTOR_VERSION ||
        request.plannedSnapshotId !== investigation.snapshotId ||
        request.planFingerprint !== investigation.plan.planFingerprint) {
      return {
        ...workspace,
        discoveryTask: {
          ...workspace.discoveryTask!, taskId, state: "outdated",
          nextAction: "none",
          stopReason: "The saved source task does not match this investigation.",
        },
      };
    }
    const checkpoints = this.studyFirstEventStepCheckpoints(
      read.record, investigation,
    );
    const { valid } = checkpoints;
    let malformed = checkpoints.malformed;
    const task = read.record.task;
    const active = [...task.operations].reverse().find(({ status }) =>
      status === "reserved") ?? null;
    const resolvedAmbiguousOperationIds = new Set(valid.flatMap(
      ({ invocationOperationId }) => invocationOperationId.startsWith(
        "unknown:") ? [invocationOperationId.slice("unknown:".length)] : [],
    ));
    const unmatchedAmbiguous = task.operations.some(({ operationId, status }) =>
      status === "ambiguous" &&
      !resolvedAmbiguousOperationIds.has(operationId));
    const savedAggregate = this.latestStudyFirstEventCheckpoint(read.record);
    let aggregate: StudyFirstEventCheckpoint | null = null;
    let aggregateInvalid = false;
    if (savedAggregate) {
      try {
        aggregate = validateStudyFirstEventCheckpoint(
          savedAggregate,
          investigation.snapshotId,
          investigation.plan.planFingerprint,
        );
      } catch {
        // Valid step checkpoints can rebuild this deterministic local result.
        // Keep the invalid aggregate for diagnosis without misreporting the
        // documentary source work itself as failed.
        aggregateInvalid = true;
      }
    }
    const completedIds = new Set(valid.map(({ stepId }) => stepId));
    const pendingCount = investigation.plan.steps.filter(({ id }) =>
      !completedIds.has(id)).length;
    const attempts = valid.map(({ result }) => result.attempt);
    const occurrences = new Map<string, CoEventCandidateOccurrence>();
    for (const checkpoint of valid) {
      for (const occurrence of checkpoint.result.candidates) {
        if (!occurrences.has(occurrence.id)) {
          occurrences.set(occurrence.id, structuredClone(occurrence));
        }
      }
    }
    let discoveryState: Screen4DiscoveryTaskFacts["state"] = "preparing";
    let stage: Screen4DiscoveryTaskFacts["stage"] = "preparation";
    let nextAction: Screen4DiscoveryTaskFacts["nextAction"] = "resume";
    if (malformed) {
      discoveryState = "failed";
      nextAction = "none";
    } else if (aggregate) {
      discoveryState = aggregate.result.occurrences.length
        ? "complete" : "complete_zero";
      stage = "complete";
      nextAction = "none";
    } else if (unmatchedAmbiguous || active &&
        Date.parse(active.leaseExpiresAt) <= Date.parse(this.options.now())) {
      discoveryState = "outcome_unknown";
      stage = "source_retrieval";
      // Resume resolves only the expired lease into an explicit unknown
      // checkpoint. It performs zero source calls and never resends the
      // ambiguous operation.
      nextAction = "resume";
    } else if (active) {
      discoveryState = "active";
      stage = "source_retrieval";
      nextAction = "observe";
    } else if (pendingCount === 0) {
      discoveryState = "partial";
      stage = "local_processing";
    } else if (valid.length > 0) {
      discoveryState = "partial";
      stage = "source_retrieval";
    } else if (task.state === "failed") {
      discoveryState = "failed";
      nextAction = "none";
    }
    const projectedInvestigation = aggregate
      ? createCompletedStudyFirstEventInvestigation({
          previous: investigation,
          ...aggregate.result,
        })
      : workspace.investigation;
    const publicInvestigation = aggregate && projectedInvestigation
      ? screen4InvestigationProjection(projectedInvestigation)
      : projectedInvestigation;
    // A finalized aggregate already carries the visible occurrences exactly
    // once inside the projected investigation. Partial step results use the
    // separate documentary list until deterministic finalization is ready.
    const documentedOccurrences = aggregate
      ? []
      : [...occurrences.values()].slice(0, STUDY_FIRST_EVENT_MAX_VISIBLE);
    return {
      ...workspace,
      investigation: publicInvestigation,
      documentedOccurrences,
      refreshAvailable: aggregate
        ? (state.studyFirstEventInvestigations?.length ?? 0) + 2 <=
            STUDY_FIRST_EVENT_MAX_HISTORY
        : workspace.refreshAvailable,
      sourceVersionCurrent: aggregate
        ? publicInvestigation!.plan.discoveryVersion ===
            STUDY_FIRST_EVENT_DISCOVERY_VERSION
        : workspace.sourceVersionCurrent,
      interpretationQueue: aggregate
        ? screen4QueueProjection(state, publicInvestigation)
        : workspace.interpretationQueue,
      discoveryTask: {
        taskId,
        state: discoveryState,
        stage,
        nextAction,
        completedStepCount: valid.length,
        totalStepCount: investigation.plan.steps.length,
        pendingStepCount: pendingCount,
        queryCount: attempts.reduce((count, attempt) =>
          count + attempt.usage.sourceQueries, 0),
        documentCount: attempts.reduce((count, attempt) =>
          count + (attempt.usage.documentAttempts ?? 0), 0),
        recordsReceived: attempts.reduce((count, attempt) =>
          count + attempt.recordsReceived, 0),
        recordsAccepted: attempts.reduce((count, attempt) =>
          count + attempt.recordsAccepted, 0),
        stopReason: malformed
          ? "A malformed optional source-step checkpoint was quarantined; its original record was retained."
          : aggregateInvalid
            ? "The saved aggregate needs deterministic local reconstruction from its validated source-step checkpoints; no source request will be repeated."
          : aggregate
            ? aggregate.result.presentation.coverage.limitation
            : task.stopReason,
        continuationMode: "panel_driven",
        continuationDisclosure: aggregate
          ? "The bounded source result is complete. Study-specific assessment is a separate action and never reruns source discovery."
          : "One bounded source step runs per explicit Start or Resume action. Work does not continue after panel closure or process restart; reopening reads saved checkpoints and can resume an eligible next step.",
      },
    };
  }

  /** Join compact model artifacts to the already-projected display set. The
   * assessment store never owns source discovery and the workflow store never
   * receives the large source aggregate merely to authorize OpenAI. */
  private async screen4AssessmentStoreProjection(
    authentication: SixScreenWorkflowAuthentication,
    state: SixScreenWorkflowState,
    workspace: StudyFirstEventInvestigationWorkspace,
  ): Promise<StudyFirstEventInvestigationWorkspace> {
    const store = this.options.screen4AssessmentStore;
    const investigation = workspace.investigation;
    if (!store || !investigation?.presentation ||
        !["completed", "completed_partial"].includes(
          investigation.status) ||
        !investigation.presentation.visibleEventIds.length) {
      return workspace;
    }
    const taskFingerprint = screen4InterpretationTaskFingerprint({
      runId: state.runId,
      investigation,
    });
    const fallback = screen4QueueProjection(state, investigation, []);
    if (!fallback) return workspace;
    try {
      const read = await store.read({
        ...authentication,
        taskFingerprint,
      });
      if (read.outcome === "not_found") {
        return {
          ...workspace,
          interpretationQueue: await this.screen4InterpretationReadiness(
            fallback,
            state,
            [],
          ),
        };
      }
      if (read.outcome === "unauthorized") {
        throw new Error("Screen 4 assessment access is unauthorized.");
      }
      const { manifest, attempts } = read.record;
      if (manifest.runId !== state.runId ||
          manifest.taskFingerprint !== taskFingerprint ||
          manifest.investigationSnapshotId !== investigation.snapshotId ||
          manifest.investigationFingerprint !==
            investigation.investigationFingerprint ||
          manifest.contextFingerprint !==
            investigation.context.contextFingerprint ||
          manifest.planFingerprint !== investigation.plan.planFingerprint ||
          manifest.presentationFingerprint !==
            investigation.presentation.presentationFingerprint ||
          JSON.stringify(manifest.visibleEventIds) !== JSON.stringify(
            investigation.presentation.visibleEventIds)) {
        throw new Error("The saved Screen 4 assessment manifest is stale.");
      }
      validateScreen4InterpretationAttempts({
        runId: state.runId,
        investigations: [investigation],
        attempts,
      });
      const queue = screen4QueueProjection(state, investigation, attempts);
      return {
        ...workspace,
        interpretationQueue: await this.screen4InterpretationReadiness(
          queue,
          state,
          attempts,
        ),
      };
    } catch {
      const failed = structuredClone(fallback);
      failed.status = "failed";
      failed.retryEligibility = "none";
      failed.error =
        "The compact Screen 4 assessment record could not be read or matched to the displayed event IDs.";
      failed.diagnostic = {
        taskType: "screen4_event_interpretation",
        stage: "persistence",
        code: "assessment_store_read_failed",
        dispatchState: "not_dispatched",
        receiptSaved: false,
        issuePaths: [],
      };
      failed.readiness = {
        ...failed.readiness,
        canDispatch: false,
        blocker:
          "The compact assessment record must be restored before another model request.",
      };
      if (failed.diagnosis) {
        failed.diagnosis.currentStep = "assessment_persistence";
        failed.diagnosis.steps = failed.diagnosis.steps.map((step) => ({
          ...step,
          status: step.id === "assessment_persistence" ? "failed" :
            ["source_manifest", "packet_preparation"].includes(step.id)
              ? "complete" : "waiting",
          detail: step.id === "assessment_persistence"
            ? "Stopped here (assessment_store_read_failed)."
            : step.detail,
        }));
      }
      return { ...workspace, interpretationQueue: failed };
    }
  }

  private async screen4InterpretationReadiness(
    queue: Screen4PublicInterpretationQueue | null,
    state: SixScreenWorkflowState,
    storedAttempts?: readonly Screen4InterpretationAttempt[],
  ): Promise<Screen4PublicInterpretationQueue | null> {
    if (!queue) return null;
    const updated = structuredClone(queue);
    const taskAttempts = (storedAttempts ??
        state.screen4InterpretationAttempts ?? []).filter(
      (attempt) => attempt.taskFingerprint === queue.taskFingerprint);
    const latest = [...new Set(taskAttempts.map((attempt) =>
      attempt.batchIndex))].map((batchIndex) => taskAttempts.filter(
        (attempt) => attempt.batchIndex === batchIndex).at(-1)!);
    const staleClaim = queue.status === "outcome_unknown" ? null :
      latest.find((attempt) => recoverableScreen4Claim(attempt,
        this.options.now())) ?? null;
    let reclaimPhase: Awaited<ReturnType<
      Screen5OpenAILedgerStore["reservationStatus"]>> | null = null;
    try {
      if (staleClaim && this.options.screen5OpenAILedgerStore) {
        reclaimPhase = await this.options.screen5OpenAILedgerStore
          .reservationStatus(staleClaim.reservationId);
      }
    } catch { reclaimPhase = null; }
    const reclaim = reclaimPhase === "absent" ||
      reclaimPhase === "reserved_not_dispatched";
    if (reclaim) {
      updated.retryEligibility = "new_request";
      updated.status = updated.completedCount ? "partial" : "ready";
    }
    const remainingBatches = updated.retryEligibility === "new_request"
      ? queue.readiness.batchCount + (reclaim ? 1 : 0) : 0;
    const required = remainingBatches > 0 &&
      reclaimPhase !== "reserved_not_dispatched" ? 1 : 0;
    updated.readiness.batchCount = Math.max(0, remainingBatches);
    updated.readiness.maximumReservationTokens = Math.max(0,
      remainingBatches) * SCREEN4_OPENAI_INTERPRETATION_RESERVATION;
    updated.readiness.nextReservationTokens = Math.max(0, required) *
      SCREEN4_OPENAI_INTERPRETATION_RESERVATION;
    let allowance: { remainingAttempts: number; remainingTokens: number } = {
      remainingAttempts: LOCAL_MODEL_ALLOWANCE_DEFAULTS.maximumDispatchedAttempts,
      remainingTokens: LOCAL_MODEL_ALLOWANCE_DEFAULTS.maximumTokens,
    };
    let ledgerError: string | null = null;
    try {
      if (this.options.screen5OpenAILedgerStore) {
        allowance = this.screen5OpenAIConfigurationIsValid()
          ? await this.readOpenAIUsage(
              this.options.screen5OpenAILedgerStore,
            )
          : await this.options.screen5OpenAILedgerStore.summary();
      } else ledgerError = "The shared model usage account is unavailable.";
    } catch (caught) {
      if (!(caught instanceof Error && /not initialized/iu.test(
        caught.message))) ledgerError = "The shared model ledger could not be read.";
    }
    updated.readiness.availableTokens = ledgerError ? null
      : allowance.remainingTokens;
    updated.readiness.availableAttempts = ledgerError ? null
      : allowance.remainingAttempts;
    const configured = this.screen5OpenAIConfigurationIsValid() &&
      Boolean(this.options.screen5OpenAIApiKey &&
        this.options.screen5OpenAIFetch &&
        this.options.screen5OpenAILedgerStore);
    updated.readiness.blocker = staleClaim && !reclaim
      ? "The saved claim cannot be recovered until its ledger dispatch state is reconciled."
      : updated.retryEligibility === "none"
      ? "Every shortlisted event has a saved interpretation."
      : updated.retryEligibility === "observe"
        ? "An authorized request is pending or its outcome is unknown; inspect its saved status before retrying."
      : required > 0 && !configured
        ? "The OpenAI model service is not configured."
      : ledgerError
        ? ledgerError
      : required > allowance.remainingAttempts ||
          updated.readiness.nextReservationTokens > allowance.remainingTokens
        ? localModelAllowanceBlocker(allowance,
            updated.readiness.nextReservationTokens)
      : null;
    updated.readiness.canDispatch = updated.readiness.blocker === null;
    return updated;
  }

  private async policyEventCardWorkspace(
    authentication: SixScreenWorkflowAuthentication,
    state: SixScreenWorkflowState,
    required: boolean,
  ): Promise<PolicyEventCardWorkspace | null> {
    const review = state.policyReview;
    if (
      state.activeScreen !== 2 || !state.confirmedShock || !review ||
      review.artifactStatus !== "current" || !review.evidenceSnapshotId ||
      !review.evidenceSnapshotFingerprint
    ) {
      if (required) {
        throw new Error(
          "Policy Event Card review requires a retained current Screen 2 evidence snapshot.",
        );
      }
      return null;
    }
    const evidenceStore = this.options.evidenceStore;
    if (!evidenceStore) {
      if (required) {
        throw new Error(
          "Policy Event Card review is unavailable until the immutable evidence store is configured.",
        );
      }
      return unavailablePolicyEventCardWorkspace(
        state,
        "evidence_store_unconfigured",
      );
    }
    const retained = await evidenceStore.read({
      ...authentication,
      snapshotId: review.evidenceSnapshotId,
    });
    if (retained.outcome === "unauthorized") {
      throw new Error("Saved Policy Event Card evidence access is unauthorized.");
    }
    if (retained.outcome === "not_found") {
      if (required) {
        throw new Error(
          "The immutable evidence snapshot for this Policy Event Card review is unavailable.",
        );
      }
      return unavailablePolicyEventCardWorkspace(
        state,
        "evidence_snapshot_unavailable",
      );
    }
    const projection = createPolicyChronologySourcePanelForSavedReview({
      review,
      snapshot: retained.manifest.snapshot,
      collection: retained.collection,
    });
    if (
      projection.binding.eventId !== state.confirmedShock.id ||
      projection.binding.identityFingerprint !==
        state.confirmedShock.identityFingerprint
    ) {
      throw new Error(
        "The immutable policy evidence does not match the current confirmed shock.",
      );
    }
    return policyEventCardWorkspaceFromProjection(state, projection);
  }

  private async projectionWithPolicyEventCardWorkspace(
    authentication: SixScreenWorkflowAuthentication,
    state: SixScreenWorkflowState,
    projection = publicProjection(state),
  ) {
    const withReadiness = await this.projectionWithScreen5Readiness(
      state,
      projection,
      authentication,
    );
    return {
      ...withReadiness,
      policyEventCardWorkspace: await this.policyEventCardWorkspace(
        authentication,
        state,
        false,
      ),
    };
  }

  private async currentPolicyEventCardMutationProjection(
    authentication: SixScreenWorkflowAuthentication,
    input: { expectedRevision: number; operationId: string },
  ) {
    const read = await this.options.store.read(authentication);
    if (read.outcome !== "found") {
      if (read.outcome === "unauthorized") {
        throw new Error("Six-screen workflow access is unauthorized.");
      }
      throw new Error("Six-screen workflow is unavailable or expired.");
    }
    if (read.record.operationReplays.some(
      ({ operationId }) => operationId === input.operationId,
    )) {
      return null;
    }
    const { workflow } = await this.currentPolicyWorkflow(
      authentication,
      input.expectedRevision,
    );
    const workspace = await this.policyEventCardWorkspace(
      authentication,
      workflow,
      true,
    );
    if (!workspace || workspace.availability !== "ready") {
      throw new Error("Policy Event Card evidence reconstruction is unavailable.");
    }
    return workspace.projection;
  }

  private async currentPolicyLifecycleMutationProjection(
    authentication: SixScreenWorkflowAuthentication,
    input: { expectedRevision: number; operationId: string },
  ) {
    const read = await this.options.store.read(authentication);
    if (read.outcome !== "found") {
      if (read.outcome === "unauthorized") {
        throw new Error("Six-screen workflow access is unauthorized.");
      }
      throw new Error("Six-screen workflow is unavailable or expired.");
    }
    if (read.record.operationReplays.some(
      ({ operationId }) => operationId === input.operationId,
    )) {
      return null;
    }
    const state = read.record.state;
    if (state.revision !== input.expectedRevision) {
      throw new Error(
        `Stale six-screen workflow mutation; current revision is ${state.revision}.`,
      );
    }
    const review = state.policyReview;
    if (
      state.activeScreen !== 4 || !state.confirmedShock || !review ||
      review.artifactStatus !== "current" || !review.evidenceSnapshotId ||
      !review.evidenceSnapshotFingerprint
    ) {
      throw new Error(
        "Policy-stage handoff requires Screen 4 and its retained current policy evidence.",
      );
    }
    const evidenceStore = this.options.evidenceStore;
    if (!evidenceStore) {
      throw new Error(
        "Policy-stage handoff is unavailable until the immutable evidence store is configured.",
      );
    }
    const retained = await evidenceStore.read({
      ...authentication,
      snapshotId: review.evidenceSnapshotId,
    });
    if (retained.outcome === "unauthorized") {
      throw new Error("Saved policy evidence access is unauthorized.");
    }
    if (retained.outcome === "not_found") {
      throw new Error(
        "The immutable policy evidence for this policy-stage handoff is unavailable.",
      );
    }
    const projection = createPolicyChronologySourcePanelForSavedReview({
      review,
      snapshot: retained.manifest.snapshot,
      collection: retained.collection,
    });
    if (
      projection.binding.eventId !== state.confirmedShock.id ||
      projection.binding.identityFingerprint !==
        state.confirmedShock.identityFingerprint
    ) {
      throw new Error(
        "The immutable policy evidence does not match the current confirmed shock.",
      );
    }
    return projection;
  }

  /** An invalid saved attempt may have reached the provider. Never infer a free retry. */
  private requireOptionalAnalysisRecovery(
    record: SixScreenWorkflowStoreRecord,
    collection: "screen3Contextualizations" | "screen4InterpretationAttempts" |
      "studyFirstMechanismRuns" | "screen6Personalizations",
    screen: 3 | 4 | 5 | 6,
    context?: {
      action: string;
      operationId: string;
      expectedRevision: number;
    },
  ) {
    if (record.optionalAnalysisIsolations?.some((isolation) =>
      isolation.items.some((item) => item.collection === collection))) {
      const directMessage =
        `Screen ${screen} has a saved analysis record that needs local recovery. ` +
        "The original response and usage were preserved; a new model " +
        "request is blocked until that record is checked.";
      if (context) {
        return workflowProblemFailure({
          code: "execution_failure",
          stage: "execution",
          action: context.action,
          operationId: context.operationId,
          screen,
          expectedRevision: context.expectedRevision,
          actualRevision: record.state.revision,
          commitCertainty: "not_committed",
          dispatchCertainty: "not_dispatched",
          recovery: "restore_local_artifact",
          safeCauseCodes: ["source_receipt_unavailable"],
        }, directMessage);
      }
      throw new Error(directMessage);
    }
  }

  /** Guard the legacy route before capability probing or document retrieval. */
  private requireLegacyScreen5SourceWorkAllowed(
    record: SixScreenWorkflowStoreRecord,
  ) {
    if (!screen5PrerequisiteReport(record.state).legacyExecutionAvailable) {
      throw new Error(
        "The historical Screen 5 literature route is read-only. View its " +
        "saved records, or use the current study-first mechanism path with " +
        "the theoretical construct of the shock.",
      );
    }
  }

  private async mutation(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      operationKind: string;
      payload: unknown;
    },
    updater: (state: SixScreenWorkflowState) => {
      state: SixScreenWorkflowState;
      result?: unknown;
    },
  ) {
    const updatedAt = this.options.now();
    const policy = sixScreenActionPolicy(input.operationKind);
    const problemContext = {
      operationId: input.operationId,
      action: input.operationKind,
      screen: policy?.destinationScreen ?? null,
      expectedRevision: input.expectedRevision,
    } as const;
    let updaterEntered = false;
    let updaterCompleted = false;
    let mutation: Awaited<ReturnType<SixScreenWorkflowStore["mutate"]>>;
    try {
      mutation = await this.options.store.mutate({
        ...authentication,
        expectedRevision: input.expectedRevision,
        operationId: input.operationId,
        operationKind: input.operationKind,
        inputFingerprint: fingerprintSixScreenValue(input.payload),
        updatedAt,
      }, (state) => {
        updaterEntered = true;
        const plan = updater(state);
        const result = plan.result ?? publicProjection(plan.state);
        updaterCompleted = true;
        return { state: plan.state, result };
      });
    } catch (error) {
      if (error instanceof SixScreenWorkflowProblemError) throw error;
      const code = updaterEntered && !updaterCompleted
        ? "execution_failure" as const
        : "persistence_failure" as const;
      throw new SixScreenWorkflowProblemError(createSixScreenWorkflowProblem({
        code,
        ...problemContext,
        commitCertainty: updaterCompleted ? "unknown" : "not_committed",
        dispatchCertainty: policy?.externalWork === "none"
          ? "not_dispatched" : "unknown",
        safeCauseCodes: [code === "execution_failure"
          ? "execution_failed" : "persistence_failed"],
      }));
    }
    if (
      mutation.outcome !== "updated" &&
      mutation.outcome !== "unchanged" &&
      mutation.outcome !== "replayed"
    ) {
      return mutationFailure(mutation, input);
    }
    let projection: SixScreenWorkflowPublicProjection;
    try {
      projection = await this.projectionWithScreen5Readiness(
        mutation.record.state,
        publicProjection(mutation.record.state),
        authentication,
      );
    } catch (error) {
      if (error instanceof SixScreenWorkflowProblemError) throw error;
      throw new SixScreenWorkflowProblemError(createSixScreenWorkflowProblem({
        code: "projection_failure",
        ...problemContext,
        actualRevision: mutation.record.state.revision,
        commitCertainty: "committed",
        dispatchCertainty: policy?.externalWork === "none"
          ? "not_dispatched"
          : policy?.externalWork === "model" ? "dispatched" : "unknown",
        safeCauseCodes: ["projection_failed"],
      }));
    }
    return {
      projection,
      privateSnapshot: snapshot(mutation.record, authentication.accessToken),
      result: mutation.result,
      replayed: mutation.outcome === "replayed",
      changed: mutation.outcome === "updated",
      mutationOutcome: mutation.outcome === "updated"
        ? "changed" as const
        : mutation.outcome,
    };
  }

  private studyFirstEventApplyOperationId(
    investigation: StudyFirstEventInvestigation,
    checkpoint: StudyFirstEventCheckpoint,
  ) {
    // A refreshed or rebuilt investigation can intentionally reuse the same
    // scientific plan. Bind replay identity to the exact planned snapshot and
    // aggregate checkpoint so an earlier apply cannot replay over new saved
    // source work and leave the current investigation stuck at `planned`.
    const coordinate = fingerprintSixScreenValue({
      plannedSnapshotId: investigation.snapshotId,
      planFingerprint: investigation.plan.planFingerprint,
      checkpointFingerprint: checkpoint.checkpointFingerprint,
    }).slice("fnv1a64:".length);
    return `study-first-scan-apply-${coordinate}`;
  }

  private latestStudyFirstEventCheckpoint(
    record: SixScreenResearchTaskRecord,
  ) {
    return [...record.operationReplays].reverse().find(
      ({ operationKind }) => operationKind === "commit_study_first_event_scan",
    )?.result as StudyFirstEventCheckpoint | undefined;
  }

  private async applyStudyFirstEventCheckpoint(
    authentication: SixScreenWorkflowAuthentication,
    expectedRevision: number,
    investigation: StudyFirstEventInvestigation,
    checkpoint: StudyFirstEventCheckpoint,
  ) {
    validateStudyFirstEventCheckpoint(
      checkpoint,
      investigation.snapshotId,
      investigation.plan.planFingerprint,
    );
    // The source aggregate can be much larger than the browser needs and is
    // already durable in the research-task store. In the compact Screen 4
    // architecture it remains there: status() projects only the displayed
    // 0-10 events, while assessment results use their own small keyed store.
    // Keeping the canonical workflow at the planned revision also prevents a
    // hidden source-finalization write from making the assessment button's
    // expected revision stale before OpenAI admission.
    if (this.options.screen4AssessmentStore) {
      const current = await this.options.store.read(authentication);
      if (current.outcome !== "found") {
        throw new Error("The authorized Screen 4 workflow is unavailable.");
      }
      if (current.record.state.revision !== expectedRevision) {
        throw new Error(
          `Stale six-screen workflow mutation; current revision is ${current.record.state.revision}.`,
        );
      }
      const response = await this.status(authentication);
      return {
        ...response,
        changed: false,
        replayed: false,
        mutationOutcome: "unchanged" as const,
      };
    }
    return this.mutation(authentication, {
      expectedRevision,
      operationId: this.studyFirstEventApplyOperationId(
        investigation,
        checkpoint,
      ),
      operationKind: "commit_study_first_event_investigation",
      payload: {
        checkpointFingerprint: checkpoint.checkpointFingerprint,
        plannedSnapshotId: investigation.snapshotId,
        planFingerprint: investigation.plan.planFingerprint,
      },
    }, (state) => {
      const committed = commitStudyFirstEventInvestigation(state, {
        expectedRevision,
        plannedSnapshotId: investigation.snapshotId,
        expectedPlanFingerprint: investigation.plan.planFingerprint,
        ...checkpoint.result,
      });
      return { state: committed.state, result: committed.investigation };
    });
  }

  private async executeStudyFirstEventScan(
    authentication: SixScreenWorkflowAuthentication,
    expectedRevision: number,
    investigation: StudyFirstEventInvestigation,
    invocationOperationId: string,
    invocationAction: "open_screen_4" | "refresh_study_first_events",
    requestExpectedRevision: number,
    reusableSource: StudyFirstEventInvestigation | null = null,
  ) {
    const taskStore = this.options.taskStore;
    if (!taskStore) {
      return workflowProblemFailure({
        code: "configuration_unavailable",
        action: invocationAction,
        operationId: invocationOperationId,
        screen: 4,
        expectedRevision: requestExpectedRevision,
        actualRevision: expectedRevision,
        commitCertainty: "committed",
        dispatchCertainty: "not_dispatched",
        recovery: "none",
        safeCauseCodes: ["configuration_unavailable"],
      });
    }
    const taskCoordinate = studyFirstEventTaskCoordinate(investigation);
    const taskId = studyFirstEventTaskId(investigation);
    const taskAuthentication = { ...authentication, taskId };
    let taskRead = await taskStore.read(taskAuthentication);
    if (taskRead.outcome === "unauthorized") {
      return workflowProblemFailure({
        code: "authorization",
        action: invocationAction,
        operationId: invocationOperationId,
        screen: 4,
        expectedRevision: requestExpectedRevision,
        actualRevision: expectedRevision,
        commitCertainty: "committed",
        dispatchCertainty: "not_dispatched",
        recovery: "reconnect",
        safeCauseCodes: ["authorization_failed"],
      });
    }
    let taskRecord: SixScreenResearchTaskRecord;
    if (taskRead.outcome === "found") {
      taskRecord = taskRead.record;
      const request = taskRecord.task.immutableRequest as {
        protocolVersion?: string;
        plannedSnapshotId?: string;
        planFingerprint?: string;
      };
      if (request.protocolVersion !== STUDY_FIRST_EVENT_EXECUTOR_VERSION ||
          request.plannedSnapshotId !== investigation.snapshotId ||
          request.planFingerprint !== investigation.plan.planFingerprint) {
        return workflowProblemFailure({
          code: "operation_identity_conflict",
          action: invocationAction,
          operationId: invocationOperationId,
          screen: 4,
          expectedRevision: requestExpectedRevision,
          actualRevision: expectedRevision,
          commitCertainty: "committed",
          dispatchCertainty: "not_dispatched",
          recovery: "none",
          safeCauseCodes: ["operation_conflict"],
        });
      }
    } else {
      const createdAt = this.options.now();
      const immutableRequest = {
        protocolVersion: STUDY_FIRST_EVENT_EXECUTOR_VERSION,
        executionMode: "panel_step_v1",
        plannedSnapshotId: investigation.snapshotId,
        planFingerprint: investigation.plan.planFingerprint,
        contextFingerprint: investigation.context.contextFingerprint,
        stepIds: investigation.plan.steps.map(({ id }) => id),
      };
      const taskExpiresAt = instantAfter(
        createdAt,
        SIX_SCREEN_WORKFLOW_RESUME_RETENTION_MS,
      );
      const task = createResearchTask({
        id: taskId,
        runId: investigation.context.runId,
        kind: "coevent",
        parent: {
          studyRevision: investigation.context.study.revision,
          identityFingerprint:
            investigation.context.policy.identityFingerprint,
          eventCardSnapshotId: null,
          selectedDesignSnapshotId: null,
          coeventSnapshotId: investigation.snapshotId,
          mechanismSnapshotId: null,
        },
        immutableRequest,
        profileName: investigation.plan.budget.metadataCandidateCeiling > 100
          ? "coevent-multisource-v3" : "coevent-standard",
        pendingWorkIds: investigation.plan.steps.map(({ id }) => id),
        unresolvedRequirementIds: investigation.plan.steps.filter(
          ({ initialStatus }) => initialStatus === "unsupported_route",
        ).map(({ id }) => id),
        continuationMode: "panel_driven",
        createdAt,
        absoluteDeadline: taskExpiresAt,
        expiresAt: taskExpiresAt,
      });
      const created = await taskStore.create({
        task,
        accessToken: authentication.accessToken,
        createInputFingerprint: fingerprintSixScreenValue(immutableRequest),
      });
      if (created.outcome === "conflict") {
        throw new Error(
          "Study-first Screen 4 task coordinate was reused for different input.",
        );
      }
      taskRecord = created.record;
    }

    const savedAggregate = this.latestStudyFirstEventCheckpoint(taskRecord);
    let savedAggregateInvalid = false;
    let recovered: StudyFirstEventCheckpoint | null = null;
    if (savedAggregate) {
      try {
        recovered = validateStudyFirstEventCheckpoint(
          savedAggregate,
          investigation.snapshotId,
          investigation.plan.planFingerprint,
        );
      } catch {
        savedAggregateInvalid = true;
      }
    }
    if (recovered) {
      return this.applyStudyFirstEventCheckpoint(
        authentication, expectedRevision, investigation, recovered,
      );
    }
    const onlyReuseOperations = taskRecord.task.operations.every(
      ({ operationId }) => operationId.startsWith("study-first-reuse-"),
    );
    if (reusableSource?.status === "planned" && onlyReuseOperations &&
        studyFirstEventSourceInputFingerprint(reusableSource) ===
          studyFirstEventSourceInputFingerprint(investigation)) {
      const sourceTaskRead = await taskStore.read({
        ...authentication,
        taskId: studyFirstEventTaskId(reusableSource),
      });
      if (sourceTaskRead.outcome === "unauthorized") {
        throw new Error("Reusable Screen 4 source-task access is unauthorized.");
      }
      if (sourceTaskRead.outcome === "found") {
        const prior = this.studyFirstEventStepCheckpoints(
          sourceTaskRead.record,
          reusableSource,
        );
        if (!prior.malformed && prior.valid.length) {
          for (const saved of prior.valid) {
            const rebound = rebindStudyFirstEventStepResult({
              source: reusableSource,
              target: investigation,
              result: saved.result,
            });
            const checkpoint = createStudyFirstEventStepCheckpoint({
              plannedSnapshotId: investigation.snapshotId,
              planFingerprint: investigation.plan.planFingerprint,
              stepId: rebound.stepId,
              invocationOperationId,
              result: rebound,
            });
            const operationId = `study-first-rebind-${rebound.stepId.slice(-32)}`;
            const inputFingerprint = fingerprintSixScreenValue({
              requestHash: taskRecord.task.requestHash,
              sourceTaskFingerprint: sourceTaskRead.record.taskFingerprint,
              sourceCheckpointFingerprint: saved.checkpointFingerprint,
              targetCheckpointFingerprint: checkpoint.checkpointFingerprint,
            });
            const at = this.options.now();
            const persisted = await taskStore.mutate({
              ...taskAuthentication,
              expectedRevision: taskRecord.task.revision,
              operationId: `study-first-rebind-commit-${rebound.stepId.slice(-32)}`,
              operationKind: "commit_study_first_event_step",
              inputFingerprint,
              updatedAt: at,
            }, (stored) => {
              const reserved = reserveResearchTaskOperation(stored, {
                expectedRevision: stored.revision,
                operationId,
                inputFingerprint,
                reservation: {
                  sourceQueries: 0, metadataRecords: 0, documentAttempts: 0,
                  usefulDocuments: 0, transportHops: 0,
                  maximumReceivedBytes: 0, maximumDecodedBytes: 0,
                  maximumActiveResearchMs: 0, maximumCpuMs: 0,
                  providerCostUnits: {},
                },
                reservedAt: at,
                leaseExpiresAt: instantAfter(at, 60_000),
              });
              if (reserved.outcome !== "reserved") {
                throw new Error(
                  `Screen 4 source-step rebind reservation failed (${reserved.outcome}).`,
                );
              }
              const unresolved = ["source_unavailable", "unsupported_route",
                "records_unusable", "outcome_unknown"].includes(
                  rebound.attempt.outcome);
              const remainingWorkIds = reserved.task.pendingWorkIds.filter(
                (id) => id !== rebound.stepId,
              );
              const committed = commitResearchTaskOperation(reserved.task, {
                expectedRevision: reserved.task.revision,
                operationId,
                inputFingerprint,
                generation: reserved.operation.generation,
                actualUsage: {
                  sourceQueries: 0, metadataRecords: 0, documentAttempts: 0,
                  usefulDocuments: 0, transportHops: 0, receivedBytes: 0,
                  decodedBytes: 0, activeResearchMs: 0, cpuMs: 0,
                  providerCostUnits: {},
                },
                completedWorkIds: [rebound.stepId],
                remainingWorkIds,
                unresolvedRequirementIds: [...new Set([
                  ...reserved.task.unresolvedRequirementIds,
                  ...(unresolved ? [rebound.stepId] : []),
                ])],
                nextState: remainingWorkIds.length ? "queued" : "partial",
                stopReason: remainingWorkIds.length
                  ? "Compatible documentary source checkpoints were restored after a method-only change; remaining source steps require explicit Resume."
                  : "Compatible documentary source checkpoints were restored after a method-only change; local finalization is available.",
                resultFingerprint: checkpoint.checkpointFingerprint,
                committedAt: at,
              });
              return { task: committed.task, result: checkpoint };
            });
            if (persisted.outcome !== "updated" &&
                persisted.outcome !== "replayed") {
              throw new Error(
                `Screen 4 source-step rebind persistence failed (${persisted.outcome}).`,
              );
            }
            taskRecord = persisted.record;
          }
          return this.status(authentication);
        }
      }
    }
    if (reusableSource && reusableSource.status !== "planned" &&
        onlyReuseOperations &&
        studyFirstEventSourceInputFingerprint(reusableSource) ===
          studyFirstEventSourceInputFingerprint(investigation)) {
      const result = rebindStudyFirstEventSourceResult({
        source: reusableSource,
        target: investigation,
        completedAt: this.options.now(),
      });
      const checkpoint = createStudyFirstEventCheckpoint({
        plannedSnapshotId: investigation.snapshotId,
        planFingerprint: investigation.plan.planFingerprint,
        result,
      });
      const reuseInputFingerprint = fingerprintSixScreenValue({
        requestHash: taskRecord.task.requestHash,
        sourceInvestigationFingerprint:
          reusableSource.investigationFingerprint,
        targetPlanFingerprint: investigation.plan.planFingerprint,
      });
      const reuseOperationId = `study-first-reuse-${taskCoordinate}`;
      let reuseOperation = taskRecord.task.operations.find((operation) =>
        operation.operationId === reuseOperationId &&
        operation.status === "reserved") ?? null;
      if (!reuseOperation) {
        const reservedAt = this.options.now();
        const reserved = await taskStore.mutate({
          ...taskAuthentication,
          expectedRevision: taskRecord.task.revision,
          operationId: `study-first-reuse-reserve-${taskCoordinate}`,
          operationKind: "reserve_study_first_event_source_reuse",
          inputFingerprint: reuseInputFingerprint,
          updatedAt: reservedAt,
        }, (stored) => {
          const outcome = reserveResearchTaskOperation(stored, {
            expectedRevision: stored.revision,
            operationId: reuseOperationId,
            inputFingerprint: reuseInputFingerprint,
            reservation: {
              sourceQueries: 0, metadataRecords: 0, documentAttempts: 0,
              usefulDocuments: 0, transportHops: 0,
              maximumReceivedBytes: 0, maximumDecodedBytes: 0,
              maximumActiveResearchMs: 0, maximumCpuMs: 0,
              providerCostUnits: {},
            },
            reservedAt,
            leaseExpiresAt: instantAfter(reservedAt, 60_000),
          });
          if (outcome.outcome !== "reserved") {
            throw new Error(`Screen 4 source-reuse reservation failed (${outcome.outcome}).`);
          }
          return { task: outcome.task, result: outcome.operation };
        });
        if (reserved.outcome === "stale") return this.status(authentication);
        if (reserved.outcome !== "updated" && reserved.outcome !== "replayed") {
          throw new Error(`Screen 4 source-reuse persistence failed (${reserved.outcome}).`);
        }
        taskRecord = reserved.record;
        reuseOperation = taskRecord.task.operations.find((operation) =>
          operation.operationId === reuseOperationId &&
          operation.status === "reserved") ?? null;
      }
      if (!reuseOperation) {
        const saved = this.latestStudyFirstEventCheckpoint(taskRecord);
        if (saved) return this.applyStudyFirstEventCheckpoint(
          authentication, expectedRevision, investigation, saved);
        throw new Error("The local Screen 4 source-reuse lease is unavailable.");
      }
      const unresolvedRequirementIds = result.attempts.filter(({ outcome }) =>
        outcome === "source_unavailable" || outcome === "unsupported_route" ||
        outcome === "records_unusable" || outcome === "outcome_unknown")
        .map(({ stepId }) => stepId);
      const committedAt = this.options.now();
      const committed = await taskStore.mutate({
        ...taskAuthentication,
        expectedRevision: taskRecord.task.revision,
        operationId: `study-first-reuse-commit-${taskCoordinate}`,
        operationKind: "commit_study_first_event_scan",
        inputFingerprint: reuseInputFingerprint,
        updatedAt: committedAt,
      }, (stored) => {
        const outcome = commitResearchTaskOperation(stored, {
          expectedRevision: stored.revision,
          operationId: reuseOperationId,
          inputFingerprint: reuseInputFingerprint,
          generation: reuseOperation!.generation,
          actualUsage: {
            sourceQueries: 0, metadataRecords: 0, documentAttempts: 0,
            usefulDocuments: 0, transportHops: 0, receivedBytes: 0,
            decodedBytes: 0, activeResearchMs: 0, cpuMs: 0,
            providerCostUnits: {},
          },
          completedWorkIds: investigation.plan.steps.map(({ id }) => id),
          remainingWorkIds: [], unresolvedRequirementIds,
          nextState: "completed",
          stopReason: result.presentation.coverage.limitation,
          resultFingerprint: checkpoint.checkpointFingerprint,
          committedAt,
        });
        return { task: outcome.task, result: checkpoint };
      });
      if (committed.outcome !== "updated" && committed.outcome !== "replayed") {
        throw new Error(`Screen 4 source reuse could not be saved (${committed.outcome}).`);
      }
      return this.applyStudyFirstEventCheckpoint(
        authentication,
        expectedRevision,
        investigation,
        validateStudyFirstEventCheckpoint(
          committed.result as StudyFirstEventCheckpoint,
          investigation.snapshotId,
          investigation.plan.planFingerprint,
        ),
      );
    }
    let checkpoints = this.studyFirstEventStepCheckpoints(
      taskRecord, investigation,
    );
    if (checkpoints.malformed) {
      throw new Error(
        "A malformed optional Screen 4 source checkpoint was retained and quarantined.",
      );
    }
    const invocationAlreadySaved = checkpoints.valid.some(
      ({ invocationOperationId: saved }) =>
        saved === invocationOperationId,
    );
    const completedIds = new Set(checkpoints.valid.map(({ stepId }) => stepId));
    let pending = investigation.plan.steps.filter(({ id }) =>
      !completedIds.has(id));
    if (invocationAlreadySaved && pending.length > 0) {
      return this.status(authentication);
    }

    const now = this.options.now();
    const active = [...taskRecord.task.operations].reverse().find(
      ({ status }) => status === "reserved",
    ) ?? null;
    const activeIsLocalFinalization = active?.operationId.startsWith(
      "study-first-finalize-",
    ) ?? false;
    if (active && !activeIsLocalFinalization) {
      if (Date.parse(active.leaseExpiresAt) > Date.parse(now)) {
        return this.status(authentication);
      }
      const expired = await taskStore.mutate({
        ...taskAuthentication,
        expectedRevision: taskRecord.task.revision,
        operationId: `study-first-expire-${active.generation}`,
        operationKind: "expire_study_first_event_step_lease",
        inputFingerprint: active.inputFingerprint,
        updatedAt: now,
      }, (stored) => {
        const outcome = expireResearchTaskOperation(stored, {
          expectedRevision: stored.revision,
          operationId: active.operationId,
          inputFingerprint: active.inputFingerprint,
          generation: active.generation,
          expiredAt: now,
        });
        return { task: outcome.task, result: { retired: true } };
      });
      if (expired.outcome !== "updated" && expired.outcome !== "replayed" &&
          expired.outcome !== "stale") {
        throw new Error(
          `Study-first Screen 4 task lease recovery failed (${expired.outcome}).`,
        );
      }
      if (expired.outcome === "stale") return this.status(authentication);
      taskRecord = expired.record;
      const unresolvedStep = pending[0] ?? null;
      if (!unresolvedStep) return this.status(authentication);
      // The request may have reached its source. Preserve the bounded hold and
      // add a zero-cost checkpoint that labels the route unknown. This makes a
      // later explicit Resume advance to another step without resending the
      // ambiguous request.
      const unknownResult = unknownStudyFirstEventStepResult({
        step: unresolvedStep,
        startedAt: active.reservedAt,
        completedAt: now,
      });
      const unknownCheckpoint = createStudyFirstEventStepCheckpoint({
        plannedSnapshotId: investigation.snapshotId,
        planFingerprint: investigation.plan.planFingerprint,
        stepId: unresolvedStep.id,
        invocationOperationId: `unknown:${active.operationId}`,
        result: unknownResult,
      });
      const unknownOperationId =
        `study-first-unknown-${active.generation}`;
      const unknownInputFingerprint = fingerprintSixScreenValue({
        requestHash: taskRecord.task.requestHash,
        ambiguousOperationId: active.operationId,
        ambiguousGeneration: active.generation,
        checkpointFingerprint: unknownCheckpoint.checkpointFingerprint,
      });
      const remainingWorkIds = pending.slice(1).map(({ id }) => id);
      const marked = await taskStore.mutate({
        ...taskAuthentication,
        expectedRevision: taskRecord.task.revision,
        operationId: `study-first-unknown-commit-${active.generation}`,
        operationKind: "commit_study_first_event_step",
        inputFingerprint: unknownInputFingerprint,
        updatedAt: now,
      }, (stored) => {
        const reserved = reserveResearchTaskOperation(stored, {
          expectedRevision: stored.revision,
          operationId: unknownOperationId,
          inputFingerprint: unknownInputFingerprint,
          reservation: {
            sourceQueries: 0, metadataRecords: 0, documentAttempts: 0,
            usefulDocuments: 0, transportHops: 0,
            maximumReceivedBytes: 0, maximumDecodedBytes: 0,
            maximumActiveResearchMs: 0, maximumCpuMs: 0,
            providerCostUnits: {},
          },
          reservedAt: now,
          leaseExpiresAt: instantAfter(now, 60_000),
        });
        if (reserved.outcome !== "reserved") {
          throw new Error(
            `Screen 4 unknown-outcome checkpoint reservation failed (${reserved.outcome}).`,
          );
        }
        const committed = commitResearchTaskOperation(reserved.task, {
          expectedRevision: reserved.task.revision,
          operationId: unknownOperationId,
          inputFingerprint: unknownInputFingerprint,
          generation: reserved.operation.generation,
          actualUsage: {
            sourceQueries: 0, metadataRecords: 0, documentAttempts: 0,
            usefulDocuments: 0, transportHops: 0, receivedBytes: 0,
            decodedBytes: 0, activeResearchMs: 0, cpuMs: 0,
            providerCostUnits: {},
          },
          completedWorkIds: [unresolvedStep.id],
          remainingWorkIds,
          unresolvedRequirementIds: [...new Set([
            ...reserved.task.unresolvedRequirementIds,
            unresolvedStep.id,
          ])],
          nextState: remainingWorkIds.length ? "queued" : "partial",
          stopReason: remainingWorkIds.length
            ? "One source outcome remains unknown and was not resent; Resume advances to the next saved plan step."
            : "One source outcome remains unknown and was not resent; local finalization is available.",
          resultFingerprint: unknownCheckpoint.checkpointFingerprint,
          committedAt: now,
        });
        return { task: committed.task, result: unknownCheckpoint };
      });
      if (marked.outcome !== "updated" && marked.outcome !== "replayed") {
        throw new Error(
          `Screen 4 unknown-outcome checkpoint persistence failed (${marked.outcome}).`,
        );
      }
      return this.status(authentication);
    }
    const resolvedAmbiguousOperationIds = new Set(checkpoints.valid.flatMap(
      ({ invocationOperationId: saved }) => saved.startsWith("unknown:")
        ? [saved.slice("unknown:".length)] : [],
    ));
    if (taskRecord.task.operations.some(({ operationId, status }) =>
      status === "ambiguous" &&
      !resolvedAmbiguousOperationIds.has(operationId))) {
      return this.status(authentication);
    }

    const step = pending[0] ?? null;
    if (step) {
      const invocationCoordinate = fingerprintSixScreenValue(
        invocationOperationId,
      ).slice("fnv1a64:".length);
      const sourceOperationId =
        `study-first-step-source-${step.id.slice(-32)}-${invocationCoordinate}`;
      const sourceInputFingerprint = fingerprintSixScreenValue({
        requestHash: taskRecord.task.requestHash,
        planFingerprint: investigation.plan.planFingerprint,
        step,
        invocationOperationId,
      });
      const remaining = (key: keyof Pick<ResearchTask["limits"],
        "sourceQueries" | "metadataRecords" | "documentAttempts" |
        "transportHops" | "receivedBytes" | "decodedBytes" |
        "activeResearchMs" | "cpuMs">) => Math.max(0,
          taskRecord.task.limits[key] - taskRecord.task.usage[key] -
          taskRecord.task.reserved[key]);
      const caps = studyFirstEventStepResourceCaps(step);
      const insufficient = [
        ["source queries", caps.sourceQueries, remaining("sourceQueries")],
        ["metadata records", caps.metadataRecords,
          remaining("metadataRecords")],
        ["document attempts", caps.documentAttempts,
          remaining("documentAttempts")],
        ["transport hops", caps.transportHops,
          remaining("transportHops")],
        ["received bytes", caps.receivedBytes, remaining("receivedBytes")],
        ["decoded bytes", caps.decodedBytes, remaining("decodedBytes")],
        ["active research time", caps.activeResearchMs,
          remaining("activeResearchMs")],
      ] as const;
      const unavailable = insufficient.find(([, required, available]) =>
        available < required);
      if (unavailable) {
        throw new Error(
          `Screen 4 did not start ${step.providerId ?? "the source route"}: ` +
          `the durable task has ${unavailable[2]} ${unavailable[0]} ` +
          `remaining but this adapter requires ${unavailable[1]}. No source request was sent.`,
        );
      }
      const reservation = {
        sourceQueries: caps.sourceQueries,
        metadataRecords: caps.metadataRecords,
        documentAttempts: caps.documentAttempts,
        usefulDocuments: 0,
        transportHops: caps.transportHops,
        maximumReceivedBytes: caps.receivedBytes,
        maximumDecodedBytes: caps.decodedBytes,
        maximumActiveResearchMs: caps.activeResearchMs,
        maximumCpuMs: 0,
        providerCostUnits: {},
      };
      const reservedAt = this.options.now();
      const reserved = await taskStore.mutate({
        ...taskAuthentication,
        expectedRevision: taskRecord.task.revision,
        operationId:
          `study-first-step-reserve-${step.id.slice(-32)}-${invocationCoordinate}`,
        operationKind: "reserve_study_first_event_step",
        inputFingerprint: sourceInputFingerprint,
        updatedAt: reservedAt,
      }, (stored) => {
        const outcome = reserveResearchTaskOperation(stored, {
          expectedRevision: stored.revision,
          operationId: sourceOperationId,
          inputFingerprint: sourceInputFingerprint,
          reservation,
          reservedAt,
          leaseExpiresAt: instantAfter(reservedAt, caps.leaseMs),
        });
        if (outcome.outcome !== "reserved") {
          throw new Error(
            `Study-first Screen 4 reservation failed (${outcome.outcome}).`,
          );
        }
        return { task: outcome.task, result: outcome.operation };
      });
      if (reserved.outcome === "stale" || reserved.outcome === "replayed") {
        return this.status(authentication);
      }
      if (reserved.outcome !== "updated") {
        throw new Error(
          `Study-first Screen 4 task persistence failed (${reserved.outcome}).`,
        );
      }
      const sourceOperation = reserved.record.task.operations.find(
        ({ operationId }) => operationId === sourceOperationId,
      );
      if (!sourceOperation) {
        throw new Error(
          "The study-first Screen 4 task lost its source-operation lease.",
        );
      }
      const result = await executeStudyFirstEventInvestigationStep({
        investigation,
        step,
        fetch: this.options.fetch,
        now: this.options.now,
        monotonicNow: this.options.monotonicNow,
        sourceRegister: await this.liveScreen4SourceRegister(),
        govInfoApiKey: this.options.govInfoApiKey,
        congressApiKey: this.options.congressApiKey,
        regulationsApiKey: this.options.regulationsApiKey,
        openStatesApiKey: this.options.openStatesApiKey,
      });
      const checkpoint = createStudyFirstEventStepCheckpoint({
        plannedSnapshotId: investigation.snapshotId,
        planFingerprint: investigation.plan.planFingerprint,
        stepId: step.id,
        invocationOperationId,
        result,
      });
      const actualUsage = {
        sourceQueries: result.attempt.usage.sourceQueries,
        metadataRecords: result.attempt.usage.metadataRecords,
        documentAttempts: result.attempt.usage.documentAttempts ?? 0,
        usefulDocuments: 0,
        transportHops: result.attempt.usage.transportHops,
        receivedBytes: result.attempt.usage.receivedBytes,
        decodedBytes: result.attempt.usage.receivedBytes,
        activeResearchMs: result.attempt.usage.activeResearchMs,
        cpuMs: 0,
        providerCostUnits: {},
      };
      const remainingWorkIds = pending.slice(1).map(({ id }) => id);
      const allResults = [...checkpoints.valid.map(({ result }) => result),
        result];
      const unresolvedRequirementIds = allResults.filter(({ attempt }) =>
        attempt.outcome === "source_unavailable" ||
        attempt.outcome === "unsupported_route" ||
        attempt.outcome === "records_unusable" ||
        attempt.outcome === "outcome_unknown").map(({ stepId }) => stepId);
      const committedAt = this.options.now();
      const committed = await taskStore.mutate({
        ...taskAuthentication,
        expectedRevision: reserved.record.task.revision,
        operationId:
          `study-first-step-commit-${step.id.slice(-32)}-${invocationCoordinate}`,
        operationKind: "commit_study_first_event_step",
        inputFingerprint: sourceInputFingerprint,
        updatedAt: committedAt,
      }, (stored) => {
        const outcome = commitResearchTaskOperation(stored, {
          expectedRevision: stored.revision,
          operationId: sourceOperationId,
          inputFingerprint: sourceInputFingerprint,
          generation: sourceOperation.generation,
          actualUsage,
          completedWorkIds: [step.id],
          remainingWorkIds,
          unresolvedRequirementIds,
          nextState: remainingWorkIds.length ? "queued" : "partial",
          stopReason: remainingWorkIds.length
            ? `${remainingWorkIds.length} planned source step(s) remain.`
            : "All source steps are saved; local presentation is pending.",
          resultFingerprint: checkpoint.checkpointFingerprint,
          committedAt,
        });
        return { task: outcome.task, result: checkpoint };
      });
      if (committed.outcome !== "updated" &&
          committed.outcome !== "replayed") {
        throw new Error(
          `Study-first Screen 4 step persistence failed (${committed.outcome}).`,
        );
      }
      taskRecord = committed.record;
      checkpoints = this.studyFirstEventStepCheckpoints(
        taskRecord, investigation,
      );
      if (remainingWorkIds.length) {
        return this.status(authentication);
      }
      // The last source result is already durable. Finish the deterministic
      // presentation in this same action so the panel cannot stop at 10/10
      // saved steps with no candidate cards or relevance action.
    }

    if (checkpoints.malformed || checkpoints.valid.length !==
        investigation.plan.steps.length) {
      throw new Error("Screen 4 source checkpoints are not ready to finalize.");
    }
    const startedAt = checkpoints.valid.map(({ result }) =>
      result.attempt.startedAt).sort()[0] ?? this.options.now();
    const result = finalizeStudyFirstEventInvestigation({
      investigation,
      stepResults: checkpoints.valid.map(({ result }) => result),
      startedAt,
      completedAt: this.options.now(),
    });
    const checkpoint = createStudyFirstEventCheckpoint({
      plannedSnapshotId: investigation.snapshotId,
      planFingerprint: investigation.plan.planFingerprint,
      result,
    });
    if (savedAggregateInvalid) {
      // Step checkpoints are independently validated and sufficient to
      // reconstruct the deterministic result. Attach that reconstruction
      // directly instead of replaying a malformed legacy aggregate or
      // repeating any source request.
      return this.applyStudyFirstEventCheckpoint(
        authentication,
        expectedRevision,
        investigation,
        checkpoint,
      );
    }
    const finalInputFingerprint = fingerprintSixScreenValue({
      requestHash: taskRecord.task.requestHash,
      stepCheckpointFingerprints: checkpoints.valid.map(
        ({ checkpointFingerprint }) => checkpointFingerprint),
    });
    const finalOperationId = `study-first-finalize-${taskCoordinate}`;
    let finalOperation = taskRecord.task.operations.find((operation) =>
      operation.operationId === finalOperationId &&
      operation.status === "reserved") ??
      null;
    if (!finalOperation) {
      const reservedAt = this.options.now();
      const finalReserved = await taskStore.mutate({
        ...taskAuthentication,
        expectedRevision: taskRecord.task.revision,
        operationId: `study-first-finalize-reserve-${taskCoordinate}`,
        operationKind: "reserve_study_first_event_finalization",
        inputFingerprint: finalInputFingerprint,
        updatedAt: reservedAt,
      }, (stored) => {
        const outcome = reserveResearchTaskOperation(stored, {
          expectedRevision: stored.revision,
          operationId: finalOperationId,
          inputFingerprint: finalInputFingerprint,
          reservation: {
            sourceQueries: 0, metadataRecords: 0, documentAttempts: 0,
            usefulDocuments: 0, transportHops: 0,
            maximumReceivedBytes: 0, maximumDecodedBytes: 0,
            maximumActiveResearchMs: 0, maximumCpuMs: 0,
            providerCostUnits: {},
          },
          reservedAt,
          leaseExpiresAt: instantAfter(reservedAt, 60_000),
        });
        if (outcome.outcome !== "reserved") {
          throw new Error(
            `Study-first Screen 4 finalization reservation failed (${outcome.outcome}).`,
          );
        }
        return { task: outcome.task, result: outcome.operation };
      });
      if (finalReserved.outcome === "stale") return this.status(authentication);
      if (finalReserved.outcome !== "updated" &&
          finalReserved.outcome !== "replayed") {
        throw new Error(
          `Study-first Screen 4 finalization persistence failed (${finalReserved.outcome}).`,
        );
      }
      taskRecord = finalReserved.record;
      finalOperation = taskRecord.task.operations.find((operation) =>
        operation.operationId === finalOperationId &&
        operation.status === "reserved") ??
        null;
    }
    if (!finalOperation) {
      const saved = this.latestStudyFirstEventCheckpoint(taskRecord);
      if (saved) {
        return this.applyStudyFirstEventCheckpoint(
          authentication, expectedRevision, investigation, saved,
        );
      }
      throw new Error("The local Screen 4 finalization lease is unavailable.");
    }
    const finalizedAt = this.options.now();
    const finalized = await taskStore.mutate({
      ...taskAuthentication,
      expectedRevision: taskRecord.task.revision,
      operationId: `study-first-finalize-commit-${taskCoordinate}`,
      operationKind: "commit_study_first_event_scan",
      inputFingerprint: finalInputFingerprint,
      updatedAt: finalizedAt,
    }, (stored) => {
      const outcome = commitResearchTaskOperation(stored, {
        expectedRevision: stored.revision,
        operationId: finalOperationId,
        inputFingerprint: finalInputFingerprint,
        generation: finalOperation!.generation,
        actualUsage: {
          sourceQueries: 0, metadataRecords: 0, documentAttempts: 0,
          usefulDocuments: 0, transportHops: 0, receivedBytes: 0,
          decodedBytes: 0, activeResearchMs: 0, cpuMs: 0,
          providerCostUnits: {},
        },
        completedWorkIds: [], remainingWorkIds: [],
        unresolvedRequirementIds: taskRecord.task.unresolvedRequirementIds,
        nextState: "completed",
        stopReason: result.presentation.coverage.limitation,
        resultFingerprint: checkpoint.checkpointFingerprint,
        committedAt: finalizedAt,
      });
      return { task: outcome.task, result: checkpoint };
    });
    if (finalized.outcome !== "updated" && finalized.outcome !== "replayed") {
      throw new Error(
        `Study-first Screen 4 final result persistence failed (${finalized.outcome}).`,
      );
    }
    const saved = validateStudyFirstEventCheckpoint(
      finalized.result as StudyFirstEventCheckpoint,
      investigation.snapshotId,
      investigation.plan.planFingerprint,
    );
    return this.applyStudyFirstEventCheckpoint(
      authentication, expectedRevision, investigation, saved,
    );
  }

  /** One researcher action completes the bounded saved source plan (including
   * deterministic finalization). Each source step still keeps its own durable
   * reservation/checkpoint, so an interruption resumes without resending work. */
  private async executeCompleteStudyFirstEventScan(
    authentication: SixScreenWorkflowAuthentication,
    expectedRevision: number,
    investigation: StudyFirstEventInvestigation,
    invocationOperationId: string,
    invocationAction: "open_screen_4" | "refresh_study_first_events",
    requestExpectedRevision: number,
    reusableSource: StudyFirstEventInvestigation | null = null,
  ) {
    const invocationCoordinate = fingerprintSixScreenValue({
      invocationOperationId,
      planFingerprint: investigation.plan.planFingerprint,
    }).slice("fnv1a64:".length);
    let latest: Awaited<ReturnType<
      SixScreenWorkflowRuntime["executeStudyFirstEventScan"]
    >> | null = null;
    // One pass per planned source plus local finalization and one bounded
    // recovery pass for a restored checkpoint/reuse path.
    const maximumPasses = investigation.plan.steps.length + 2;
    for (let pass = 0; pass < maximumPasses; pass += 1) {
      latest = await this.executeStudyFirstEventScan(
        authentication,
        expectedRevision,
        investigation,
        `study-first-panel-${invocationCoordinate}-${pass + 1}`,
        invocationAction,
        requestExpectedRevision,
        reusableSource,
      );
      if (!("privateSnapshot" in latest)) return latest;
      const workflow = latest.privateSnapshot.state;
      const current = currentStudyFirstEventInvestigation({
        studyFirstEventInvestigations: workflow.studyFirstEventInvestigations,
        confirmedShock: workflow.confirmedShock,
        study: workflow.study,
        entryContext: currentScreen3StudyEntryContext(workflow),
        timing: currentProposedTreatmentTiming(workflow),
        advice: currentStudyDesignAdvice(workflow),
        selection: currentStudyDesignSelection(workflow),
      });
      if (!current || current.snapshotId !== investigation.snapshotId ||
          current.status !== "planned") return latest;
    }
    return latest ?? this.status(authentication);
  }

  /** Retained only to read/apply v24 aggregate checkpoints created by the
   * prior monolithic executor. New work always uses the panel-step path. */
  private async executeStudyFirstEventScanLegacy(
    authentication: SixScreenWorkflowAuthentication,
    expectedRevision: number,
    investigation: StudyFirstEventInvestigation,
  ) {
    const taskStore = this.options.taskStore;
    if (!taskStore) {
      throw new Error(
        "The automatic Screen 4 investigation requires the configured durable research-task store.",
      );
    }
    const taskCoordinate = fingerprintSixScreenValue({
      executor: STUDY_FIRST_EVENT_EXECUTOR_VERSION,
      contextFingerprint: investigation.context.contextFingerprint,
      planFingerprint: investigation.plan.planFingerprint,
      ...(investigation.plan.discoveryVersion ===
        STUDY_FIRST_EVENT_DISCOVERY_VERSION
        ? { sourceRefreshSnapshotId: investigation.snapshotId } : {}),
    }).slice("fnv1a64:".length);
    const taskId = `study-first-screen4-task-${taskCoordinate}`;
    const taskAuthentication = { ...authentication, taskId };
    let taskRead = await taskStore.read(taskAuthentication);
    if (taskRead.outcome === "unauthorized") {
      throw new Error("Study-first Screen 4 research-task access is unauthorized.");
    }
    let taskRecord: SixScreenResearchTaskRecord;
    if (taskRead.outcome === "found") {
      taskRecord = taskRead.record;
      const request = taskRecord.task.immutableRequest as {
        protocolVersion?: string;
        plannedSnapshotId?: string;
        planFingerprint?: string;
      };
      if (
        request.protocolVersion !== STUDY_FIRST_EVENT_EXECUTOR_VERSION ||
        request.plannedSnapshotId !== investigation.snapshotId ||
        request.planFingerprint !== investigation.plan.planFingerprint
      ) {
        throw new Error(
          "The saved study-first Screen 4 task omitted or changed its immutable plan.",
        );
      }
      const recovered = this.latestStudyFirstEventCheckpoint(taskRecord);
      if (recovered) {
        return this.applyStudyFirstEventCheckpoint(
          authentication,
          expectedRevision,
          investigation,
          recovered,
        );
      }
    } else {
      const createdAt = this.options.now();
      const immutableRequest = {
        protocolVersion: STUDY_FIRST_EVENT_EXECUTOR_VERSION,
        plannedSnapshotId: investigation.snapshotId,
        planFingerprint: investigation.plan.planFingerprint,
        contextFingerprint: investigation.context.contextFingerprint,
        stepIds: investigation.plan.steps.map(({ id }) => id),
      };
      const taskExpiresAt = instantAfter(
        createdAt,
        SIX_SCREEN_WORKFLOW_RESUME_RETENTION_MS,
      );
      const task = createResearchTask({
        id: taskId,
        runId: investigation.context.runId,
        kind: "coevent",
        parent: {
          studyRevision: investigation.context.study.revision,
          identityFingerprint:
            investigation.context.policy.identityFingerprint,
          eventCardSnapshotId: null,
          selectedDesignSnapshotId: null,
          coeventSnapshotId: investigation.snapshotId,
          mechanismSnapshotId: null,
        },
        immutableRequest,
        profileName: investigation.plan.budget.metadataCandidateCeiling > 100
          ? "coevent-multisource-v3" : "coevent-standard",
        pendingWorkIds: investigation.plan.steps.map(({ id }) => id),
        unresolvedRequirementIds: investigation.plan.steps.filter(
          ({ initialStatus }) => initialStatus === "unsupported_route",
        ).map(({ id }) => id),
        continuationMode: "panel_driven",
        createdAt,
        absoluteDeadline: taskExpiresAt,
        expiresAt: taskExpiresAt,
      });
      const created = await taskStore.create({
        task,
        accessToken: authentication.accessToken,
        createInputFingerprint: fingerprintSixScreenValue(immutableRequest),
      });
      if (created.outcome === "conflict") {
        throw new Error(
          "Study-first Screen 4 task coordinate was reused for different input.",
        );
      }
      taskRecord = created.record;
    }

    const now = this.options.now();
    let reservableRecord = taskRecord;
    const priorReservation = [...taskRecord.task.operations].reverse().find(
      ({ status }) => status === "reserved",
    );
    if (priorReservation) {
      if (Date.parse(priorReservation.leaseExpiresAt) > Date.parse(now)) {
        throw new Error(
          "The automatic Screen 4 investigation is already running. Reopen after its bounded lease expires.",
        );
      }
      const expired = await taskStore.mutate({
        ...taskAuthentication,
        expectedRevision: taskRecord.task.revision,
        operationId: `study-first-expire-${priorReservation.generation}`,
        operationKind: "expire_study_first_event_scan_lease",
        inputFingerprint: priorReservation.inputFingerprint,
        updatedAt: now,
      }, (stored) => {
        const outcome = expireResearchTaskOperation(stored, {
          expectedRevision: stored.revision,
          operationId: priorReservation.operationId,
          inputFingerprint: priorReservation.inputFingerprint,
          generation: priorReservation.generation,
          expiredAt: now,
        });
        return { task: outcome.task, result: { retired: true } };
      });
      if (expired.outcome !== "updated" && expired.outcome !== "replayed") {
        throw new Error(
          `Study-first Screen 4 task lease recovery failed (${expired.outcome}).`,
        );
      }
      reservableRecord = expired.record;
    }

    const attemptNumber = reservableRecord.task.operations.length + 1;
    const sourceOperationId =
      `study-first-scan-source-${attemptNumber}-${taskCoordinate}`;
    const sourceInputFingerprint = fingerprintSixScreenValue({
      requestHash: reservableRecord.task.requestHash,
      planFingerprint: investigation.plan.planFingerprint,
      attemptNumber,
    });
    const reserved = await taskStore.mutate({
      ...taskAuthentication,
      expectedRevision: reservableRecord.task.revision,
      operationId: `study-first-scan-reserve-${attemptNumber}-${taskCoordinate}`,
      operationKind: "reserve_study_first_event_scan",
      inputFingerprint: sourceInputFingerprint,
      updatedAt: now,
    }, (stored) => {
      const outcome = reserveResearchTaskOperation(stored, {
        expectedRevision: stored.revision,
        operationId: sourceOperationId,
        inputFingerprint: sourceInputFingerprint,
        reservation: {
          sourceQueries: investigation.plan.budget.sourceQueryCeiling,
          metadataRecords:
            investigation.plan.budget.metadataCandidateCeiling,
          documentAttempts:
            investigation.plan.budget.documentFetchCeiling ?? 0,
          usefulDocuments:
            investigation.plan.budget.documentFetchCeiling ?? 0,
          transportHops: investigation.plan.budget.sourceQueryCeiling +
            (investigation.plan.budget.documentFetchCeiling ?? 0),
          maximumReceivedBytes: 48 * 1024 * 1024,
          maximumDecodedBytes: 48 * 1024 * 1024,
          maximumActiveResearchMs: 480_000,
          maximumCpuMs: 24_000,
          providerCostUnits: {},
        },
        reservedAt: now,
        leaseExpiresAt: instantAfter(now, 270_000),
      });
      if (outcome.outcome !== "reserved") {
        throw new Error(
          `Study-first Screen 4 reservation failed (${outcome.outcome}).`,
        );
      }
      return { task: outcome.task, result: outcome.operation };
    });
    if (reserved.outcome !== "updated" && reserved.outcome !== "replayed") {
      throw new Error(
        `Study-first Screen 4 task persistence failed (${reserved.outcome}).`,
      );
    }
    if (reserved.outcome === "replayed") {
      const recovered = this.latestStudyFirstEventCheckpoint(reserved.record);
      if (recovered) {
        return this.applyStudyFirstEventCheckpoint(
          authentication,
          expectedRevision,
          investigation,
          recovered,
        );
      }
      throw new Error("The automatic Screen 4 investigation is already running.");
    }
    const sourceOperation = reserved.record.task.operations.find(
      ({ operationId }) => operationId === sourceOperationId,
    );
    if (!sourceOperation) {
      throw new Error(
        "The study-first Screen 4 task lost its source-operation lease.",
      );
    }
    const sourceRegister = await this.liveScreen4SourceRegister();
    const result = await executeStudyFirstEventInvestigation({
      investigation,
      fetch: this.options.fetch,
      now: this.options.now,
      monotonicNow: this.options.monotonicNow,
      sourceRegister,
      govInfoApiKey: this.options.govInfoApiKey,
      congressApiKey: this.options.congressApiKey,
      regulationsApiKey: this.options.regulationsApiKey,
      openStatesApiKey: this.options.openStatesApiKey,
    });
    const checkpoint = createStudyFirstEventCheckpoint({
      plannedSnapshotId: investigation.snapshotId,
      planFingerprint: investigation.plan.planFingerprint,
      result,
    });
    const actualUsage = result.attempts.reduce((usage, value) => ({
      sourceQueries: usage.sourceQueries + value.usage.sourceQueries,
      metadataRecords: usage.metadataRecords + value.usage.metadataRecords,
      documentAttempts: usage.documentAttempts +
        (value.usage.documentAttempts ?? 0),
      usefulDocuments: 0,
      transportHops: usage.transportHops + value.usage.transportHops,
      receivedBytes: usage.receivedBytes + value.usage.receivedBytes,
      decodedBytes: usage.decodedBytes + value.usage.receivedBytes,
      activeResearchMs: usage.activeResearchMs + value.usage.activeResearchMs,
      cpuMs: 0,
      providerCostUnits: {},
    }), {
      sourceQueries: 0,
      metadataRecords: 0,
      documentAttempts: 0,
      usefulDocuments: 0,
      transportHops: 0,
      receivedBytes: 0,
      decodedBytes: 0,
      activeResearchMs: 0,
      cpuMs: 0,
      providerCostUnits: {} as Record<string, number>,
    });
    const unresolvedRequirementIds = result.attempts.filter(({ outcome }) =>
      outcome === "source_unavailable" || outcome === "unsupported_route" ||
      outcome === "records_unusable").map(({ stepId }) => stepId);
    const committedAt = this.options.now();
    const committed = await taskStore.mutate({
      ...taskAuthentication,
      expectedRevision: reserved.record.task.revision,
      operationId: `study-first-scan-commit-${attemptNumber}-${taskCoordinate}`,
      operationKind: "commit_study_first_event_scan",
      inputFingerprint: sourceInputFingerprint,
      updatedAt: committedAt,
    }, (stored) => {
      const outcome = commitResearchTaskOperation(stored, {
        expectedRevision: stored.revision,
        operationId: sourceOperationId,
        inputFingerprint: sourceInputFingerprint,
        generation: sourceOperation.generation,
        actualUsage,
        completedWorkIds: investigation.plan.steps.map(({ id }) => id),
        remainingWorkIds: [],
        unresolvedRequirementIds,
        nextState: unresolvedRequirementIds.length ? "partial" : "completed",
        stopReason: result.presentation.coverage.limitation,
        resultFingerprint: checkpoint.checkpointFingerprint,
        committedAt,
      });
      return { task: outcome.task, result: checkpoint };
    });
    if (committed.outcome !== "updated" && committed.outcome !== "replayed") {
      throw new Error(
        `Study-first Screen 4 task result persistence failed (${committed.outcome}).`,
      );
    }
    const saved = validateStudyFirstEventCheckpoint(
      committed.result as StudyFirstEventCheckpoint,
      investigation.snapshotId,
      investigation.plan.planFingerprint,
    );
    return this.applyStudyFirstEventCheckpoint(
      authentication,
      expectedRevision,
      investigation,
      saved,
    );
  }

  async create(input: {
    operationId: string;
    shockInput: string;
    study: StudyContextDraft;
    officialSourceLocators?: string[];
    officialIdentifier?: string | null;
    requestedJurisdiction?: string | null;
    approximateYear?: string | null;
    intendedEpisode?: string | null;
  }) {
    const createInputFingerprint = fingerprintSixScreenValue(input);
    const [runId, accessToken] = await Promise.all([
      derivedCoordinate("sa6r_", this.options.signingKey, input.operationId),
      derivedCoordinate("sa6a_", this.options.signingKey, input.operationId),
    ]);
    const createdAt = this.options.now();
    const state = createSixScreenWorkflow({
      runId,
      studyId: `study-${runId.slice(5)}`,
      study: input.study,
      shockInput: input.shockInput,
      officialSourceLocators: input.officialSourceLocators,
      officialIdentifier: input.officialIdentifier,
      requestedJurisdiction: input.requestedJurisdiction,
      approximateYear: input.approximateYear,
      intendedEpisode: input.intendedEpisode,
      createdAt,
    });
    const created = await this.options.store.create({
      state,
      accessToken,
      createInputFingerprint,
      createdAt,
      expiresAt: expiresAt(createdAt),
    });
    if (created.outcome === "conflict") {
      throw new Error("Six-screen create operation id was reused for different input.");
    }
    return {
      projection: await this.projectionWithScreen5Readiness(
        created.record.state,
        publicProjection(created.record.state),
        { runId, accessToken },
      ),
      privateSnapshot: snapshot(created.record, accessToken),
      replayed: created.outcome === "replayed",
    };
  }

  async status(authentication: SixScreenWorkflowAuthentication) {
    const read = await this.options.store.read(authentication);
    if (read.outcome !== "found") {
      if (read.outcome === "unauthorized") {
        throw new Error("Six-screen workflow access is unauthorized.");
      }
      throw new Error("Six-screen workflow is unavailable or expired.");
    }
    return {
      projection: await this.projectionWithPolicyEventCardWorkspace(
        authentication,
        read.record.state,
      ),
      privateSnapshot: snapshot(read.record, authentication.accessToken),
    };
  }

  /** Retire one run and its run-scoped supporting records. The canonical
   * workflow is authenticated first and deleted last; callers therefore keep
   * their current workspace unless the complete retirement succeeds. */
  async retire(authentication: SixScreenWorkflowAuthentication) {
    const read = await this.options.store.read(authentication);
    if (read.outcome !== "found") {
      throw new Error(read.outcome === "unauthorized"
        ? "Six-screen workflow access is unauthorized."
        : "Six-screen workflow is unavailable or expired.");
    }
    const childStores = [
      this.options.taskStore,
      this.options.evidenceStore,
      this.options.screen4AssessmentStore,
    ].filter((store): store is NonNullable<typeof store> => Boolean(store));
    for (const store of childStores) {
      const retired = await store.retireRun(authentication);
      if (retired.outcome !== "retired") {
        throw new Error(
          "The saved workspace could not be cleared completely. It remains open.",
        );
      }
    }
    if (this.options.hostReasoningTaskStore) {
      let batchLimitReached = true;
      for (let pass = 0; pass < 4 && batchLimitReached; pass += 1) {
        const retired = await this.options.hostReasoningTaskStore.retireRun(
          authentication.runId,
        );
        batchLimitReached = retired.batchLimitReached;
      }
      if (batchLimitReached) {
        throw new Error(
          "The saved workspace has too many active tasks to clear in one request. It remains open; try again.",
        );
      }
    }
    const retired = await this.options.store.retire(authentication);
    if (retired.outcome !== "retired") {
      throw new Error(
        "The saved workspace could not be retired. It remains open.",
      );
    }
    return {
      schemaVersion: "shockaudit-six-screen-retirement-v1" as const,
      runId: authentication.runId,
      retired: true as const,
      outcomeValuesInspected: false as const,
    };
  }

  /**
   * Return one canonical copy of the saved state and public projection for
   * app-side recovery. The registered tool compresses these values instead of
   * repeating them across structuredContent, private metadata, and response
   * integrity metadata as the ordinary full-display response must do.
   */
  async recoverySnapshot(authentication: SixScreenWorkflowAuthentication) {
    const read = await this.options.store.read(authentication);
    if (read.outcome !== "found") {
      throw new SixScreenWorkflowProblemError(
        createSixScreenWorkflowProblem({
          code: "authorization",
          action: "get_recovery_snapshot",
          commitCertainty: "unknown",
          dispatchCertainty: "not_dispatched",
          recovery: "reconnect",
          safeCauseCodes: [read.outcome === "unauthorized"
            ? "authorization_failed" : "run_unavailable"],
        }),
      );
    }
    let projection: SixScreenWorkflowPublicProjection;
    try {
      projection = await this.projectionWithScreen5Readiness(
        read.record.state,
        publicProjection(read.record.state),
        authentication,
      );
    } catch (error) {
      if (error instanceof SixScreenWorkflowProblemError) throw error;
      throw new SixScreenWorkflowProblemError(
        createSixScreenWorkflowProblem({
          code: "projection_failure",
          action: "get_recovery_snapshot",
          actualRevision: read.record.state.revision,
          commitCertainty: "committed",
          dispatchCertainty: "not_dispatched",
          recovery: "check_status",
          safeCauseCodes: ["projection_failed"],
        }),
      );
    }
    return {
      projection,
      privateSnapshot: snapshot(read.record, authentication.accessToken),
    };
  }

  /** Read only the exact private state for a bounded response-transfer chunk.
   * Unlike status/recovery this does not rebuild display projections or touch
   * model/source readiness. The registered chunk tool binds every slice to the
   * saved revision and full-state fingerprint before returning it. */
  async stateTransferSnapshot(
    authentication: SixScreenWorkflowAuthentication,
  ) {
    const read = await this.options.store.read(authentication);
    if (read.outcome !== "found") {
      throw new SixScreenWorkflowProblemError(
        createSixScreenWorkflowProblem({
          code: "authorization",
          action: "get_state_chunk",
          commitCertainty: "unknown",
          dispatchCertainty: "not_dispatched",
          recovery: "reconnect",
          safeCauseCodes: [read.outcome === "unauthorized"
            ? "authorization_failed" : "run_unavailable"],
        }),
      );
    }
    return snapshot(read.record, authentication.accessToken);
  }

  /**
   * Read a single durable Screen 3 handoff receipt without constructing the
   * multi-screen projection. This path is intentionally independent of task
   * stores, source/model adapters, allowance ledgers, and optional-module
   * recovery writes.
   */
  async operationStatus(
    authentication: SixScreenWorkflowAuthentication,
    input: Omit<SixScreenOperationStatusRequest, "runId">,
  ) {
    if (input.operationKind !== "open_screen_3") {
      throw new SixScreenWorkflowProblemError(
        createSixScreenWorkflowProblem({
          code: "request_contract",
          action: "get_operation_status",
          screen: 3,
          operationId: input.operationId,
          commitCertainty: "not_committed",
          dispatchCertainty: "not_dispatched",
          safeCauseCodes: ["request_schema_invalid"],
        }),
      );
    }
    let lookup: Awaited<ReturnType<
      SixScreenWorkflowStore["readOperationReceipt"]
    >>;
    try {
      lookup = await this.options.store.readOperationReceipt({
        ...authentication,
        ...input,
      });
    } catch (error) {
      if (error instanceof SixScreenWorkflowProblemError) throw error;
      throw new SixScreenWorkflowProblemError(
        createSixScreenWorkflowProblem({
          code: "core_state_invalid",
          action: "get_operation_status",
          screen: 3,
          operationId: input.operationId,
          commitCertainty: "unknown",
          dispatchCertainty: "not_dispatched",
          safeCauseCodes: ["core_state_invalid"],
        }),
      );
    }
    if (lookup.outcome === "unauthorized" || lookup.outcome === "not_found") {
      throw new SixScreenWorkflowProblemError(
        createSixScreenWorkflowProblem({
          code: "authorization",
          action: "get_operation_status",
          screen: 3,
          operationId: input.operationId,
          commitCertainty: "unknown",
          dispatchCertainty: "not_dispatched",
          recovery: "reconnect",
          // Do not reveal whether a run exists to an unauthenticated caller.
          safeCauseCodes: ["authorization_failed"],
        }),
      );
    }

    const request: SixScreenOperationStatusRequest = {
      runId: authentication.runId,
      ...input,
    };
    const common = {
      schemaVersion: SIX_SCREEN_OPERATION_STATUS_SCHEMA_VERSION,
      buildId: SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID,
      appVersion: SHOCKAUDIT_VERSION,
      uiResourceUri: SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI,
      toolName: SIX_SCREEN_OPERATION_STATUS_TOOL,
      requestFingerprint: sixScreenOperationRequestFingerprint(request),
      runId: authentication.runId,
      revision: lookup.record.state.revision,
      stateFingerprint: lookup.record.stateFingerprint,
      operationReference: sixScreenOperationReference(input.operationId),
      operationKind: input.operationKind,
      inputFingerprint: input.inputFingerprint,
    } as const;

    if (lookup.outcome === "unknown_or_expired") {
      return createSixScreenOperationStatus({
        ...common,
        lookup: "unknown_or_expired",
        commitCertainty: "unknown",
        committedRevision: null,
        mutationOutcome: null,
        completedAt: null,
        resultFingerprint: null,
        receiptValidated: false,
        screen3Receipt: null,
        destination: {
          screen: 3,
          state: "unknown",
          displayReady: false,
          localRebuildAvailable: false,
          safeCode: "operation_outcome_unknown",
        },
      });
    }
    if (lookup.outcome === "conflict") {
      return createSixScreenOperationStatus({
        ...common,
        lookup: "conflict",
        commitCertainty: "unknown",
        committedRevision: null,
        mutationOutcome: null,
        completedAt: null,
        resultFingerprint: null,
        receiptValidated: false,
        screen3Receipt: null,
        destination: {
          screen: 3,
          state: "unavailable",
          displayReady: false,
          localRebuildAvailable: false,
          safeCode: "operation_identity_conflict",
        },
      });
    }

    const classified = classifyScreen3StartReceipt({
      state: lookup.record.state,
      result: lookup.result,
      committedRevision: lookup.receipt.committedRevision,
    });
    return createSixScreenOperationStatus({
      ...common,
      lookup: "committed",
      commitCertainty: "committed",
      committedRevision: lookup.receipt.committedRevision,
      mutationOutcome: lookup.receipt.mutationOutcome ?? "legacy_unknown",
      completedAt: lookup.receipt.completedAt,
      resultFingerprint: fingerprintSixScreenValue(lookup.result),
      receiptValidated: classified.validated,
      screen3Receipt: classified.summary,
      destination: classified.destination,
    });
  }

  openScreen3(authentication: SixScreenWorkflowAuthentication, input: {
    expectedRevision: number;
    operationId: string;
    study?: StudyContextDraft;
    proposedTiming?: ProposedTreatmentTimingInput;
    clarifications?: Partial<StudyDesignClarifications> | null;
  }) {
    return this.mutation(authentication, {
      ...input,
      operationKind: "open_screen_3",
      payload: {
        study: input.study,
        proposedTiming: input.proposedTiming,
        clarifications: input.clarifications ?? null,
      },
    }, (state) => {
      const opened = openScreen3(state, {
        expectedRevision: input.expectedRevision,
        study: input.study,
        proposedTiming: input.proposedTiming,
        clarifications: input.clarifications,
        openedAt: this.options.now(),
      });
      return { state: opened.state, result: opened.receipt };
    });
  }

  async rebuildScreen3Guidance(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      sourceOperationId: string;
      sourceInputFingerprint: string;
    },
  ) {
    const problem = (code:
      | "authorization"
      | "operation_identity_conflict"
      | "external_outcome_unknown"
      | "core_state_invalid", safeCauseCode: string): never => {
      throw new SixScreenWorkflowProblemError(
        createSixScreenWorkflowProblem({
          code,
          action: "rebuild_screen3_guidance",
          operationId: input.operationId,
          screen: 3,
          expectedRevision: input.expectedRevision,
          commitCertainty: "not_committed",
          dispatchCertainty: "not_dispatched",
          recovery: code === "authorization" ? "reconnect" : "none",
          safeCauseCodes: [safeCauseCode],
        }),
      );
    };
    let source: Awaited<ReturnType<
      SixScreenWorkflowStore["readOperationReceipt"]
    >>;
    try {
      source = await this.options.store.readOperationReceipt({
        ...authentication,
        operationId: input.sourceOperationId,
        operationKind: "open_screen_3",
        inputFingerprint: input.sourceInputFingerprint,
      });
    } catch {
      return problem("core_state_invalid", "core_state_invalid");
    }
    if (source.outcome === "unauthorized" || source.outcome === "not_found") {
      return problem("authorization", "authorization_failed");
    }
    if (source.outcome === "unknown_or_expired") {
      return problem("external_outcome_unknown", "source_receipt_unavailable");
    }
    if (source.outcome === "conflict") {
      return problem(
        "operation_identity_conflict",
        "source_operation_conflict",
      );
    }
    const classified = classifyScreen3StartReceipt({
      state: source.record.state,
      result: source.result,
      committedRevision: source.receipt.committedRevision,
    });
    if (!classified.validated || !classified.summary ||
        !(classified.destination.state === "current" ||
          classified.destination.state === "locally_recoverable")) {
      return problem("core_state_invalid", "screen3_rebuild_binding_invalid");
    }
    const sourceResultFingerprint = fingerprintSixScreenValue(source.result);
    return this.mutation(authentication, {
      expectedRevision: input.expectedRevision,
      operationId: input.operationId,
      operationKind: "rebuild_screen3_guidance",
      payload: {
        sourceOperationId: input.sourceOperationId,
        sourceInputFingerprint: input.sourceInputFingerprint,
        sourceResultFingerprint,
      },
    }, (state) => {
      let rebuilt: ReturnType<typeof rebuildScreen3GuidanceState>;
      try {
        rebuilt = rebuildScreen3GuidanceState(state, {
          expectedRevision: input.expectedRevision,
          sourceReceipt: source.result as Screen3StartReceipt,
          rebuiltAt: this.options.now(),
        });
      } catch (error) {
        if (error instanceof SixScreenWorkflowProblemError) throw error;
        return problem(
          "core_state_invalid",
          "screen3_rebuild_binding_invalid",
        );
      }
      return { state: rebuilt.state, result: rebuilt.receipt };
    });
  }

  refineStudyDesignAdvice(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      clarifications: Partial<StudyDesignClarifications>;
    },
  ) {
    return this.mutation(authentication, {
      ...input,
      operationKind: "refine_study_design_advice",
      payload: input.clarifications,
    }, (state) => {
      const refined = refineStudyDesignAdvice(state, {
        expectedRevision: input.expectedRevision,
        clarifications: input.clarifications,
        refinedAt: this.options.now(),
      });
      return { state: refined.state, result: refined.advice };
    });
  }

  decideStudyDesignAdvice(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      adviceId: string;
      expectedAdviceFingerprint: string;
      decision: StudyDesignSelection["decision"];
      rationale: string;
    },
  ) {
    return this.mutation(authentication, {
      ...input,
      operationKind: "decide_study_design_advice",
      payload: {
        adviceId: input.adviceId,
        expectedAdviceFingerprint: input.expectedAdviceFingerprint,
        decision: input.decision,
        rationale: input.rationale,
      },
    }, (state) => {
      const decided = decideStudyDesignAdvice(state, {
        expectedRevision: input.expectedRevision,
        adviceId: input.adviceId,
        expectedAdviceFingerprint: input.expectedAdviceFingerprint,
        decision: input.decision,
        rationale: input.rationale,
        selectedAt: this.options.now(),
      });
      return { state: decided.state, result: decided.selection };
    });
  }

  buildCausalComparison(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      comparisonInput: Omit<
        CausalComparisonInput,
        "schemaVersion" | "inputFingerprint"
      >;
    },
  ) {
    const comparisonInput = createCausalComparisonInput(input.comparisonInput);
    const coordinate = fingerprintSixScreenValue(input.operationId).slice(
      "fnv1a64:".length,
    );
    return this.mutation(authentication, {
      ...input,
      operationKind: "build_causal_comparison",
      payload: comparisonInput,
    }, (state) => {
      const built = buildCausalComparison(state, {
        expectedRevision: input.expectedRevision,
        snapshotId: `causal-design-set-${coordinate}`,
        comparisonInput,
        builtAt: this.options.now(),
      });
      return { state: built.state, result: built.designSet };
    });
  }

  decideCausalComparison(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      designSetSnapshotId: string;
      expectedDesignSetFingerprint: string;
      decision:
        | { mode: "selected"; optionId: string }
        | { mode: "no_selection" };
      rationale: string;
    },
  ) {
    const coordinate = fingerprintSixScreenValue(input.operationId).slice(
      "fnv1a64:".length,
    );
    const payload = {
      designSetSnapshotId: input.designSetSnapshotId,
      expectedDesignSetFingerprint: input.expectedDesignSetFingerprint,
      decision: input.decision,
      rationale: input.rationale,
    };
    return this.mutation(authentication, {
      ...input,
      operationKind: "decide_causal_comparison",
      payload,
    }, (state) => {
      const decided = decideCausalComparison(state, {
        expectedRevision: input.expectedRevision,
        snapshotId: `causal-design-decision-${coordinate}`,
        designSetSnapshotId: input.designSetSnapshotId,
        expectedDesignSetFingerprint: input.expectedDesignSetFingerprint,
        decision: input.decision,
        rationale: input.rationale,
        actor: "researcher_ui",
        decidedAt: this.options.now(),
      });
      return { state: decided.state, result: decided.decision };
    });
  }

  async openScreen4(authentication: SixScreenWorkflowAuthentication, input: {
    expectedRevision: number;
    operationId: string;
  }) {
    let before: Awaited<ReturnType<SixScreenWorkflowStore["read"]>>;
    try {
      before = await this.options.store.read(authentication);
    } catch {
      return workflowProblemFailure({
        code: "core_state_invalid",
        action: "open_screen_4",
        operationId: input.operationId,
        screen: 4,
        expectedRevision: input.expectedRevision,
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        recovery: "none",
        safeCauseCodes: ["core_state_invalid"],
      });
    }
    if (before.outcome !== "found") {
      return workflowProblemFailure({
        code: "authorization",
        action: "open_screen_4",
        operationId: input.operationId,
        screen: 4,
        expectedRevision: input.expectedRevision,
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        recovery: "reconnect",
        safeCauseCodes: [before.outcome === "unauthorized"
          ? "authorization_failed" : "run_unavailable"],
      });
    }
    const currentBefore = currentStudyFirstEventInvestigation({
      studyFirstEventInvestigations:
        before.record.state.studyFirstEventInvestigations,
      confirmedShock: before.record.state.confirmedShock,
      study: before.record.state.study,
      entryContext: currentScreen3StudyEntryContext(before.record.state),
      timing: currentProposedTreatmentTiming(before.record.state),
      advice: currentStudyDesignAdvice(before.record.state),
      selection: currentStudyDesignSelection(before.record.state),
    });
    // Once Screen 4 owns a current planned scan, an explicit reopen is a
    // resume command for that same task. It must not create a navigation-only
    // workflow revision or another investigation.
    const resumeCurrent = before.record.state.revision ===
        input.expectedRevision && before.record.state.activeScreen === 4 &&
      currentBefore?.status === "planned";
    const opened = resumeCurrent ? {
      projection: await this.projectionWithScreen5Readiness(
        before.record.state,
        publicProjection(before.record.state),
        authentication,
      ),
      privateSnapshot: snapshot(before.record, authentication.accessToken),
      result: currentBefore,
      replayed: false,
      changed: false,
      mutationOutcome: "unchanged" as const,
    } : await this.mutation(authentication, {
      ...input,
      operationKind: "open_screen_4",
      payload: { expectedRevision: input.expectedRevision },
    }, (state) => {
      const opened = openScreen4(state, {
        expectedRevision: input.expectedRevision,
        openedAt: this.options.now(),
      });
      return { state: opened.state, result: opened.receipt };
    });
    const workflow = opened.privateSnapshot.state;
    const investigation = currentStudyFirstEventInvestigation({
      studyFirstEventInvestigations: workflow.studyFirstEventInvestigations,
      confirmedShock: workflow.confirmedShock,
      study: workflow.study,
      entryContext: currentScreen3StudyEntryContext(workflow),
      timing: currentProposedTreatmentTiming(workflow),
      advice: currentStudyDesignAdvice(workflow),
      selection: currentStudyDesignSelection(workflow),
    });
    if (!investigation || investigation.status !== "planned") return opened;
    const sourceFingerprint = studyFirstEventSourceInputFingerprint(
      investigation,
    );
    const reusableSource = [...(workflow.studyFirstEventInvestigations ?? [])]
      .reverse().find((candidate) =>
        candidate.snapshotId !== investigation.snapshotId &&
        ["planned", "completed", "completed_partial", "failed"].includes(
          candidate.status) &&
        studyFirstEventSourceInputFingerprint(candidate) ===
          sourceFingerprint) ?? null;
    try {
      return await this.executeCompleteStudyFirstEventScan(
        authentication,
        workflow.revision,
        investigation,
        input.operationId,
        "open_screen_4",
        input.expectedRevision,
        reusableSource,
      );
    } catch (error) {
      if (error instanceof SixScreenWorkflowProblemError) throw error;
      return workflowProblemFailure({
        code: "execution_failure",
        stage: "execution",
        action: "open_screen_4",
        operationId: input.operationId,
        screen: 4,
        expectedRevision: input.expectedRevision,
        actualRevision: workflow.revision,
        commitCertainty: "unknown",
        dispatchCertainty: "unknown",
        recovery: "check_status",
        safeCauseCodes: ["execution_failed"],
      });
    }
  }

  /** A fresh source scan is an explicit operation; the prior result remains in history. */
  async refreshStudyFirstEvents(
    authentication: SixScreenWorkflowAuthentication,
    input: { expectedRevision: number; operationId: string;
      expectedInvestigationFingerprint: string },
  ) {
    const prepared = await this.mutation(authentication, {
      expectedRevision: input.expectedRevision,
      operationId: input.operationId,
      operationKind: "refresh_study_first_events",
      payload: { expectedInvestigationFingerprint:
        input.expectedInvestigationFingerprint },
    }, (state) => {
      const previous = currentStudyFirstEventInvestigation({
        studyFirstEventInvestigations: state.studyFirstEventInvestigations,
        confirmedShock: state.confirmedShock,
        study: state.study,
        entryContext: currentScreen3StudyEntryContext(state),
        timing: currentProposedTreatmentTiming(state),
        advice: currentStudyDesignAdvice(state),
        selection: currentStudyDesignSelection(state),
      });
      if (!previous || previous.investigationFingerprint !==
          input.expectedInvestigationFingerprint) {
        throw new Error("The Screen 4 source result changed; review it before refreshing.");
      }
      // The same public action can be reached from a saved planned workspace.
      // In that state it means resume/finalize the current task, not create a
      // second investigation. This is especially important when every source
      // checkpoint and the aggregate result are already durable.
      if (previous.status === "planned") {
        return { state, result: previous };
      }
      const investigations = state.studyFirstEventInvestigations ?? [];
      if (investigations.length + 2 > STUDY_FIRST_EVENT_MAX_HISTORY) {
        throw new Error("Screen 4 source history has reached its bounded limit.");
      }
      const planned = createRefreshedStudyFirstEventInvestigation({
        previous, ordinal: investigations.length + 1,
        createdAt: this.options.now(),
      });
      state.studyFirstEventInvestigations = [...investigations, planned];
      const at = this.options.now();
      state.revision += 1;
      state.updatedAt = at;
      state.changeLog.push({ revision: state.revision, at,
        summary: "Screen 4 explicitly requested a newer bounded official-source scan; earlier evidence remains available." });
      return { state, result: planned };
    });
    if (!("privateSnapshot" in prepared)) return prepared;
    const investigation = currentStudyFirstEventInvestigation({
      studyFirstEventInvestigations:
        prepared.privateSnapshot.state.studyFirstEventInvestigations,
      confirmedShock: prepared.privateSnapshot.state.confirmedShock,
      study: prepared.privateSnapshot.state.study,
      entryContext: currentScreen3StudyEntryContext(prepared.privateSnapshot.state),
      timing: currentProposedTreatmentTiming(prepared.privateSnapshot.state),
      advice: currentStudyDesignAdvice(prepared.privateSnapshot.state),
      selection: currentStudyDesignSelection(prepared.privateSnapshot.state),
    });
    if (!investigation || investigation.status !== "planned") return prepared;
    try {
      return await this.executeCompleteStudyFirstEventScan(
        authentication, prepared.privateSnapshot.state.revision,
        investigation, input.operationId, "refresh_study_first_events",
        input.expectedRevision,
      );
    } catch (error) {
      if (error instanceof SixScreenWorkflowProblemError) throw error;
      return workflowProblemFailure({
        code: "execution_failure",
        stage: "execution",
        action: "refresh_study_first_events",
        operationId: input.operationId,
        screen: 4,
        expectedRevision: input.expectedRevision,
        actualRevision: prepared.privateSnapshot.state.revision,
        commitCertainty: "unknown",
        dispatchCertainty: "unknown",
        recovery: "check_status",
        safeCauseCodes: ["execution_failed"],
      });
    }
  }

  private async persistScreen4InterpretationStage(
    authentication: SixScreenWorkflowAuthentication,
    input: { id: string; reservationId: string; label: string;
      expectedClaimOperationId: string;
      patch: Partial<Screen4InterpretationAttempt> },
  ) {
    for (let retries = 0; retries < 6; retries += 1) {
      const latest = await this.options.store.read(authentication);
      if (latest.outcome !== "found") {
        throw new Error("The authorized Screen 4 workflow is unavailable.");
      }
      try {
        return await this.mutation(authentication, {
          expectedRevision: latest.record.state.revision,
          // A reclaimed pre-dispatch batch retains its reservation ID. Stage
          // replay identity must include the durable claim so a prior worker
          // cannot replay the new owner's dispatch marker and then send.
          operationId: `${input.reservationId}:${fingerprintSixScreenValue(input.expectedClaimOperationId).slice("fnv1a64:".length)}:${input.label}`,
          operationKind: `screen4_interpretation_${input.label}`,
          payload: { id: input.id, label: input.label,
            receiptFingerprint: input.patch.receipt?.contentFingerprint ?? null,
            status: input.patch.status ?? null },
        }, (state) => {
          const attempt = state.screen4InterpretationAttempts?.find(
            (item) => item.id === input.id);
          if (!attempt) throw new Error("The authorized Screen 4 attempt is unavailable.");
          if (attempt.claimOperationId !== input.expectedClaimOperationId) {
            throw new Error("A later explicit Screen 4 action owns this batch; the earlier request cannot dispatch.");
          }
          const investigation = state.studyFirstEventInvestigations?.find(
            (item) => item.snapshotId === attempt.investigationSnapshotId &&
              item.investigationFingerprint ===
                attempt.investigationFingerprint);
          if (!investigation ||
            attempt.packetFingerprint !== prepareScreen4Interpretation({
              investigation, eventIds: attempt.eventIds,
            }).packetFingerprint) {
            throw new Error("The frozen Screen 4 source packet changed after authorization.");
          }
          if (attempt.receipt && input.patch.receipt &&
            attempt.receipt.contentFingerprint !==
              input.patch.receipt.contentFingerprint) {
            throw new Error("The saved Screen 4 provider receipt cannot be replaced.");
          }
          if (attempt.status === "completed") return { state };
          Object.assign(attempt, input.patch, { updatedAt: this.options.now() });
          const at = this.options.now();
          state.revision += 1;
          state.updatedAt = at;
          state.changeLog.push({ revision: state.revision, at,
            summary: `Screen 4 interpretation ${input.label.replaceAll("_", " ")} was saved.` });
          return { state };
        });
      } catch (caught) {
        if (isSixScreenRevisionConflict(caught) && retries < 5) continue;
        throw caught;
      }
    }
    throw new Error("The Screen 4 model result could not be saved after concurrent changes.");
  }

  /** Read the source result without copying it into the monolithic workflow
   * record. For a planned canonical entry, the completed aggregate remains in
   * the research-task store and is reconstructed only in request memory. */
  private async compactScreen4SourceArtifact(
    authentication: SixScreenWorkflowAuthentication,
    input: { expectedRevision: number;
      expectedInvestigationFingerprint: string },
  ) {
    const workflow = await this.options.store.read(authentication);
    if (workflow.outcome !== "found") {
      throw new Error("The authorized Screen 4 workflow is unavailable.");
    }
    if (workflow.record.state.revision !== input.expectedRevision) {
      throw new Error(
        `Stale six-screen workflow mutation; current revision is ${workflow.record.state.revision}.`,
      );
    }
    const current = currentStudyFirstEventInvestigation({
      studyFirstEventInvestigations:
        workflow.record.state.studyFirstEventInvestigations,
      confirmedShock: workflow.record.state.confirmedShock,
      study: workflow.record.state.study,
      entryContext: currentScreen3StudyEntryContext(workflow.record.state),
      timing: currentProposedTreatmentTiming(workflow.record.state),
      advice: currentStudyDesignAdvice(workflow.record.state),
      selection: currentStudyDesignSelection(workflow.record.state),
    });
    if (!current) {
      throw new Error("The saved Screen 4 source plan is unavailable.");
    }
    let investigation = current;
    let sourceTaskId: string;
    if (current.status === "planned") {
      const taskStore = this.options.taskStore;
      if (!taskStore) {
        throw new Error("The completed Screen 4 source result is unavailable.");
      }
      sourceTaskId = studyFirstEventTaskId(current);
      const taskRead = await taskStore.read({
        ...authentication,
        taskId: sourceTaskId,
      });
      if (taskRead.outcome !== "found") {
        throw new Error("Complete the Screen 4 source scan before assessment.");
      }
      const checkpoint = this.latestStudyFirstEventCheckpoint(taskRead.record);
      if (!checkpoint) {
        throw new Error("Complete the Screen 4 source scan before assessment.");
      }
      const saved = validateStudyFirstEventCheckpoint(
        checkpoint,
        current.snapshotId,
        current.plan.planFingerprint,
      );
      investigation = createCompletedStudyFirstEventInvestigation({
        previous: current,
        ...saved.result,
      });
    } else {
      const sourceSnapshotId = current.previousSnapshotId ?? current.snapshotId;
      sourceTaskId = studyFirstEventTaskId({
        ...current,
        snapshotId: sourceSnapshotId,
      });
    }
    if (!["completed", "completed_partial"].includes(investigation.status) ||
        !investigation.presentation?.visibleEventIds.length ||
        investigation.investigationFingerprint !==
          input.expectedInvestigationFingerprint) {
      throw new Error(
        "The Screen 4 source result changed; review the displayed alternatives before assessment.",
      );
    }
    return { workflow: workflow.record, investigation, sourceTaskId };
  }

  private async ensureCompactScreen4Assessment(
    authentication: SixScreenWorkflowAuthentication,
    source: Awaited<ReturnType<
      SixScreenWorkflowRuntime["compactScreen4SourceArtifact"]
    >>,
  ) {
    const store = this.options.screen4AssessmentStore;
    if (!store) throw new Error(
      "The compact Screen 4 assessment store is unavailable.");
    const taskFingerprint = screen4InterpretationTaskFingerprint({
      runId: source.workflow.state.runId,
      investigation: source.investigation,
    });
    // Preparing every bounded packet here is local admission only. It catches
    // a malformed displayed event before allowance reservation or dispatch.
    for (const eventIds of screen4InterpretationBatches(
      source.investigation)) {
      prepareScreen4Interpretation({
        investigation: source.investigation,
        eventIds,
      });
    }
    const manifest = createScreen4AssessmentManifest({
      runId: source.workflow.state.runId,
      sourceTaskId: source.sourceTaskId,
      plannedInvestigationSnapshotId:
        source.investigation.previousSnapshotId ??
          source.investigation.snapshotId,
      investigationSnapshotId: source.investigation.snapshotId,
      investigationFingerprint:
        source.investigation.investigationFingerprint,
      contextFingerprint: source.investigation.context.contextFingerprint,
      planFingerprint: source.investigation.plan.planFingerprint,
      presentationFingerprint:
        source.investigation.presentation!.presentationFingerprint,
      visibleEventIds: [
        ...source.investigation.presentation!.visibleEventIds,
      ],
      taskFingerprint,
    });
    const created = await store.create({
      manifest,
      accessToken: authentication.accessToken,
      createdAt: this.options.now(),
      expiresAt: source.workflow.expiresAt,
    });
    if (created.outcome === "conflict") {
      throw new Error(
        "The compact Screen 4 task identity is already bound to another event manifest.",
      );
    }
    return created.record;
  }

  private async mutateCompactScreen4Assessment(
    authentication: SixScreenWorkflowAuthentication,
    taskFingerprint: string,
    updater: (record: Screen4AssessmentStoreRecord) =>
      Screen4AssessmentStoreRecord,
  ) {
    const store = this.options.screen4AssessmentStore!;
    for (let retries = 0; retries < 6; retries += 1) {
      const read = await store.read({ ...authentication, taskFingerprint });
      if (read.outcome !== "found") {
        throw new Error("The compact Screen 4 assessment is unavailable.");
      }
      const updated = await store.mutate({
        ...authentication,
        taskFingerprint,
        expectedGeneration: read.record.generation,
        updatedAt: this.options.now(),
      }, updater);
      if (updated.outcome === "updated") return updated.record;
      if (updated.outcome !== "stale") {
        throw new Error("The compact Screen 4 assessment could not be saved.");
      }
    }
    throw new Error(
      "The compact Screen 4 assessment could not be saved after concurrent changes.",
    );
  }

  private async claimCompactScreen4Batch(
    authentication: SixScreenWorkflowAuthentication,
    input: { investigation: StudyFirstEventInvestigation;
      taskFingerprint: string; claimOperationId: string },
  ) {
    let claimedId: string | null = null;
    const record = await this.mutateCompactScreen4Assessment(
      authentication,
      input.taskFingerprint,
      (stored) => {
        validateScreen4InterpretationAttempts({
          runId: stored.runId,
          investigations: [input.investigation],
          attempts: stored.attempts,
        });
        const batches = screen4InterpretationBatches(input.investigation);
        for (const [batchIndex, eventIds] of batches.entries()) {
          const prior = stored.attempts.filter((attempt) =>
            attempt.batchIndex === batchIndex);
          const last = prior.at(-1);
          if (last?.status === "completed") continue;
          if (last?.receipt && ["receipt_saved", "validation_failed"]
            .includes(last.status)) {
            last.claimOperationId = input.claimOperationId;
            last.updatedAt = this.options.now();
            claimedId = last.id;
            break;
          }
          if (last?.status === "pending") {
            if (last.claimOperationId === input.claimOperationId) {
              claimedId = last.id;
            }
            break;
          }
          const retryable = last?.status === "failed" && !last.receipt &&
            (last.dispatchState === "not_dispatched" ||
              last.dispatchState === "dispatched" &&
                knownObservedHttpFailure(last));
          if (last && !retryable) break;
          if (stored.attempts.length >= SCREEN4_ASSESSMENT_MAX_ATTEMPTS) {
            throw new Error("Screen 4 assessment attempt history is full.");
          }
          const ids = screen4InterpretationAttemptIds({
            taskFingerprint: input.taskFingerprint,
            batchIndex,
            attemptOrdinal: prior.length + 1,
          });
          const prepared = prepareScreen4Interpretation({
            investigation: input.investigation,
            eventIds,
          });
          const attempt: Screen4InterpretationAttempt = {
            ...ids,
            taskFingerprint: input.taskFingerprint,
            packetFingerprint: prepared.packetFingerprint,
            investigationSnapshotId: input.investigation.snapshotId,
            investigationFingerprint:
              input.investigation.investigationFingerprint,
            batchIndex,
            eventIds: [...eventIds],
            attemptOrdinal: prior.length + 1,
            claimOperationId: input.claimOperationId,
            status: "pending",
            dispatchState: "not_dispatched",
            failureCode: null,
            failureStage: null,
            receipt: null,
            result: null,
            error: null,
            progressStage: "packet_prepared",
            updatedAt: this.options.now(),
          };
          stored.attempts.push(attempt);
          claimedId = attempt.id;
          break;
        }
        return stored;
      },
    );
    return { record, claimedId };
  }

  private async persistCompactScreen4Attempt(
    authentication: SixScreenWorkflowAuthentication,
    input: { investigation: StudyFirstEventInvestigation;
      taskFingerprint: string; attemptId: string;
      expectedClaimOperationId: string;
      patch: Partial<Screen4InterpretationAttempt> },
  ) {
    return this.mutateCompactScreen4Assessment(
      authentication,
      input.taskFingerprint,
      (stored) => {
        const attempt = stored.attempts.find(({ id }) =>
          id === input.attemptId);
        if (!attempt ||
            attempt.claimOperationId !== input.expectedClaimOperationId) {
          throw new Error("The compact Screen 4 batch claim changed.");
        }
        const prepared = prepareScreen4Interpretation({
          investigation: input.investigation,
          eventIds: attempt.eventIds,
        });
        if (attempt.packetFingerprint !== prepared.packetFingerprint) {
          throw new Error("The compact Screen 4 packet binding changed.");
        }
        if (attempt.receipt && input.patch.receipt &&
            attempt.receipt.contentFingerprint !==
              input.patch.receipt.contentFingerprint) {
          throw new Error("A saved Screen 4 receipt cannot be replaced.");
        }
        if (attempt.status !== "completed") {
          Object.assign(attempt, input.patch, {
            updatedAt: this.options.now(),
          });
        }
        validateScreen4InterpretationAttempts({
          runId: stored.runId,
          investigations: [input.investigation],
          attempts: stored.attempts,
        });
        return stored;
      },
    );
  }

  private async executeCompactScreen4Batch(
    authentication: SixScreenWorkflowAuthentication,
    investigation: StudyFirstEventInvestigation,
    record: Screen4InterpretationAttempt,
  ) {
    const ledger = this.options.screen5OpenAILedgerStore;
    const persist = (patch: Partial<Screen4InterpretationAttempt>) =>
      this.persistCompactScreen4Attempt(authentication, {
        investigation,
        taskFingerprint: record.taskFingerprint,
        attemptId: record.id,
        expectedClaimOperationId: record.claimOperationId!,
        patch,
      });
    const prepared = prepareScreen4Interpretation({
      investigation,
      eventIds: record.eventIds,
    });
    const settle = async (usage: Screen5MechanismProviderReceipt["usage"]) => {
      try {
        await ledger?.settle({ reservationId: record.reservationId,
          usage, now: this.options.now() });
      } catch { /* Preserve the conservative ledger hold. */ }
    };
    if (record.receipt) {
      try {
        const wire = parseSavedScreen4InterpretationReceipt({
          receipt: record.receipt,
          prepared,
        });
        await persist({ status: "completed", result: wire,
          failureCode: null, failureStage: null, error: null,
          progressStage: "assessment_saved" });
        await settle(record.receipt.usage);
      } catch (caught) {
        await settle(record.receipt.usage);
        const issue = caught instanceof Screen5MechanismWireValidationError
          ? caught.issues.slice(0, 3).map((item) =>
            `${item.code} at ${item.path}`).join("; ")
          : "saved response could not be validated locally";
        await persist({ status: "validation_failed",
          failureCode: "local_receipt_validation_failed",
          failureStage: "model_output", progressStage: "failed",
          error: `Screen 4 saved response failed local validation: ${issue}`
            .slice(0, 500) });
      }
      return;
    }
    if (!ledger || !this.options.screen5OpenAIApiKey ||
        !this.options.screen5OpenAIFetch ||
        !this.screen5OpenAIConfigurationIsValid()) {
      await persist({ status: "failed", failureCode:
        "model_configuration_unavailable", failureStage:
          "local_configuration", progressStage: "failed",
        error:
          "The OpenAI model service is not configured for Screen 4 assessment." });
      return;
    }
    let reserved = false;
    let received: Screen5MechanismProviderReceipt | null = null;
    try {
      await this.initializeOpenAIUsage(ledger);
      const allowance = await ledger.summary();
      if (allowance.remainingAttempts < 1 ||
          allowance.remainingTokens <
            SCREEN4_OPENAI_INTERPRETATION_RESERVATION) {
        await persist({ status: "failed", failureCode:
          "model_allowance_unavailable", failureStage: "admission",
        progressStage: "failed",
        error: localModelAllowanceBlocker(allowance,
          SCREEN4_OPENAI_INTERPRETATION_RESERVATION) });
        return;
      }
      await ledger.reserve({ reservationId: record.reservationId,
        jobId: record.id, stage: "screen4_event_interpretation",
        reservedTokens: SCREEN4_OPENAI_INTERPRETATION_RESERVATION,
        now: this.options.now() });
      reserved = true;
      await persist({ progressStage: "allowance_reserved" });
      const response = await requestScreen4Interpretation({
        apiKey: this.options.screen5OpenAIApiKey,
        fetch: this.options.screen5OpenAIFetch,
        prepared,
        now: this.options.now,
        onDispatch: async () => {
          await persist({ dispatchState: "dispatched",
            progressStage: "provider_dispatched" });
          await ledger.recordDispatch({ reservationId: record.reservationId,
            now: this.options.now() });
        },
        onReceipt: async (receipt) => {
          received = receipt;
          await persist({ status: "receipt_saved", receipt,
            progressStage: "response_received" });
          await ledger.recordReceipt({ reservationId: record.reservationId,
            contentFingerprint: receipt.contentFingerprint,
            now: this.options.now() });
        },
      });
      await persist({ progressStage: "response_validated" });
      await persist({ status: "completed", receipt: response.receipt,
        result: response.wire, failureCode: null, failureStage: null,
        error: null, progressStage: "assessment_saved" });
      await settle(response.usage);
    } catch (caught) {
      const provider = caught instanceof Screen5OpenAIProviderError
        ? caught : null;
      const receipt = received ?? provider?.detail.receipt ?? null;
      if (receipt) {
        await settle(receipt.usage);
        const issues = provider?.detail.validationIssues?.slice(0, 3)
          .map((issue) => `${issue.code} at ${issue.path}`).join("; ");
        try {
          await persist({ status: "validation_failed", receipt,
            failureCode: provider?.detail.code ??
              "local_receipt_validation_failed",
            failureStage: provider?.detail.failureStage ?? "model_output",
            progressStage: "failed",
            error: `Screen 4 saved the provider response but validation stopped${issues ? `: ${issues}` : "."}`
              .slice(0, 500) });
        } catch { /* The prior receipt checkpoint remains diagnostic. */ }
        return;
      }
      const code = provider?.detail.code ??
        (reserved ? "model_request_failed" : "ledger_reservation_failed");
      const beforeDispatch = !provider ||
        provider.detail.networkInvocation === "not_started";
      let released = !reserved;
      if (beforeDispatch && reserved) {
        try {
          await ledger.release({ reservationId: record.reservationId,
            reasonCode: /^[a-z][a-z0-9_]{0,79}$/u.test(code)
              ? code : "model_request_failed",
            now: this.options.now() });
          released = true;
        } catch { /* Keep an uncertain hold. */ }
      }
      if (provider?.detail.usage) await settle(provider.detail.usage);
      const known = beforeDispatch && released ||
        Boolean(provider?.detail.outcomeKnown);
      try {
        await persist({ status: known ? "failed" : "outcome_unknown",
          dispatchState: beforeDispatch && released ? "not_dispatched"
            : provider?.detail.dispatched ? "dispatched" : "unknown",
          failureCode: /^[a-z][a-z0-9_]{0,79}$/u.test(code)
            ? code : "model_request_failed",
          failureStage: provider?.detail.failureStage ??
            (reserved ? "network" : "admission"),
          progressStage: "failed",
          error: known
            ? `Screen 4 stopped at ${provider?.detail.failureStage ?? "admission"} (${code}).`
            : `Screen 4 provider outcome is unknown (${code}).`,
        });
      } catch { /* Earlier compact stages remain readable. */ }
    }
  }

  private async analyzeStudyFirstEventsCompact(
    authentication: SixScreenWorkflowAuthentication,
    input: { expectedRevision: number; operationId: string;
      expectedInvestigationFingerprint: string },
  ) {
    const source = await this.compactScreen4SourceArtifact(
      authentication,
      input,
    );
    let record = await this.ensureCompactScreen4Assessment(
      authentication,
      source,
    );
    const operationCoordinate = fingerprintSixScreenValue({
      operationId: input.operationId,
      taskFingerprint: record.taskFingerprint,
    }).slice("fnv1a64:".length);
    // One mutation owns at most one provider batch. The panel keeps one user
    // action, but advances the remaining bounded queue through separate tool
    // responses. This ensures every saved batch is acknowledged by the host
    // instead of keeping one response open across as many as three API calls.
    const claim = await this.claimCompactScreen4Batch(authentication, {
      investigation: source.investigation,
      taskFingerprint: record.taskFingerprint,
      claimOperationId: `screen4-compact-${operationCoordinate}`,
    });
    record = claim.record;
    if (claim.claimedId) {
      const attempt = record.attempts.find(({ id }) =>
        id === claim.claimedId);
      if (attempt) {
        await this.executeCompactScreen4Batch(
          authentication,
          source.investigation,
          attempt,
        );
      }
    }
    const response = await this.status(authentication);
    return { ...response, changed: false, replayed: false,
      mutationOutcome: "unchanged" as const };
  }

  /** Resolve the exact current source artifact before any model authorization.
   * A durable source aggregate may already be visible from the research-task
   * store even when the large workflow finalization response was interrupted.
   * Promoting that already-saved aggregate is local and never repeats source or
   * model work. */
  private async prepareScreen4Assessment(
    authentication: SixScreenWorkflowAuthentication,
    input: { expectedRevision: number; operationId: string;
      expectedInvestigationFingerprint: string },
  ) {
    // Source discovery and model assessment are separate user-visible stages.
    // If every source step and the deterministic aggregate are already saved
    // in the research-task store, promote that aggregate locally before model
    // authorization. This removes the old requirement that the browser first
    // receive and hydrate a large source-finalization response.
    let initial = await this.options.store.read(authentication);
    if (initial.outcome !== "found") {
      throw new Error("The authorized Screen 4 workflow is unavailable.");
    }
    // Preserve the cross-screen isolation guard before inspecting or promoting
    // any source artifact. A quarantined model receipt may represent a billed
    // provider call, so source recovery must never bypass the retry block.
    this.requireOptionalAnalysisRecovery(initial.record,
      "screen4InterpretationAttempts", 4, {
        action: "analyze_study_first_events",
        operationId: input.operationId,
        expectedRevision: input.expectedRevision,
      });
    let initialInvestigation = currentStudyFirstEventInvestigation({
      studyFirstEventInvestigations:
        initial.record.state.studyFirstEventInvestigations,
      confirmedShock: initial.record.state.confirmedShock,
      study: initial.record.state.study,
      entryContext: currentScreen3StudyEntryContext(initial.record.state),
      timing: currentProposedTreatmentTiming(initial.record.state),
      advice: currentStudyDesignAdvice(initial.record.state),
      selection: currentStudyDesignSelection(initial.record.state),
    });
    if (initialInvestigation?.status === "planned") {
      if (!this.options.taskStore) {
        throw new Error("The completed Screen 4 source result is unavailable.");
      }
      const taskRead = await this.options.taskStore.read({
        ...authentication,
        taskId: studyFirstEventTaskId(initialInvestigation),
      });
      if (taskRead.outcome !== "found") {
        throw new Error("Complete the Screen 4 source scan before assessment.");
      }
      const aggregate = this.latestStudyFirstEventCheckpoint(taskRead.record);
      if (!aggregate) {
        throw new Error("Complete the Screen 4 source scan before assessment.");
      }
      const saved = validateStudyFirstEventCheckpoint(
        aggregate,
        initialInvestigation.snapshotId,
        initialInvestigation.plan.planFingerprint,
      );
      const completedSourceResult =
        createCompletedStudyFirstEventInvestigation({
          previous: initialInvestigation,
          ...saved.result,
        });
      if (completedSourceResult.investigationFingerprint !==
          input.expectedInvestigationFingerprint) {
        throw new Error(
          "The Screen 4 source result changed; review the current alternatives before assessment.",
        );
      }
      const promoted = await this.applyStudyFirstEventCheckpoint(
        authentication,
        initial.record.state.revision,
        initialInvestigation,
        saved,
      );
      if (!("privateSnapshot" in promoted)) return promoted;
      initial = await this.options.store.read(authentication);
      if (initial.outcome !== "found") {
        throw new Error("The promoted Screen 4 source result is unavailable.");
      }
      initialInvestigation = currentStudyFirstEventInvestigation({
        studyFirstEventInvestigations:
          initial.record.state.studyFirstEventInvestigations,
        confirmedShock: initial.record.state.confirmedShock,
        study: initial.record.state.study,
        entryContext: currentScreen3StudyEntryContext(initial.record.state),
        timing: currentProposedTreatmentTiming(initial.record.state),
        advice: currentStudyDesignAdvice(initial.record.state),
        selection: currentStudyDesignSelection(initial.record.state),
      });
    }
    if (!initialInvestigation ||
        initialInvestigation.investigationFingerprint !==
          input.expectedInvestigationFingerprint ||
        !["completed", "completed_partial"].includes(
          initialInvestigation.status)) {
      throw new Error(
        "The Screen 4 source result changed; review the current alternatives before assessment.",
      );
    }
    // A button advertised as local revalidation must not continue into a new
    // provider batch after it repairs the saved receipt. The next unstarted
    // batch, if any, receives its own explicit user action and authorization.
    let localRevalidationOnly = false;
    const initialTaskFingerprint = screen4InterpretationTaskFingerprint({
      runId: initial.record.state.runId,
      investigation: initialInvestigation,
    });
    localRevalidationOnly = (initial.record.state
      .screen4InterpretationAttempts ?? []).some((attempt) =>
      attempt.taskFingerprint === initialTaskFingerprint &&
      Boolean(attempt.receipt) && (attempt.status === "receipt_saved" ||
        attempt.status === "validation_failed"));
    return {
      initial,
      investigation: initialInvestigation,
      localRevalidationOnly,
    };
  }

  /** One explicit assessment action drains the bounded interpretation queue.
   * Each batch retains an independent durable authorization and receipt; the
   * caller receives the same canonical workflow response used by Screens 3
   * and 5. */
  async analyzeStudyFirstEvents(
    authentication: SixScreenWorkflowAuthentication,
    input: { expectedRevision: number; operationId: string;
      expectedInvestigationFingerprint: string },
  ) {
    if (this.options.screen4AssessmentStore) {
      return this.analyzeStudyFirstEventsCompact(authentication, input);
    }
    const prepared = await this.prepareScreen4Assessment(authentication, input);
    const operationCoordinate = fingerprintSixScreenValue({
      operationId: input.operationId,
      investigationFingerprint: input.expectedInvestigationFingerprint,
    }).slice("fnv1a64:".length);
    // The exact source fingerprint authorizes a guarded rebase after a source
    // result was committed server-side but its large browser response was
    // interrupted. No source or model work is repeated by this rebase.
    let expectedRevision = prepared.initial.record.state.revision;
    let latest: Awaited<ReturnType<
      SixScreenWorkflowRuntime["analyzeStudyFirstEventsBatch"]
    >> | null = null;
    for (let batchPass = 0; batchPass < 3; batchPass += 1) {
      latest = await this.analyzeStudyFirstEventsBatch(authentication, {
        expectedRevision,
        operationId:
          `screen4-assessment-${operationCoordinate}-${batchPass + 1}`,
        expectedInvestigationFingerprint:
          input.expectedInvestigationFingerprint,
      });
      if (!("privateSnapshot" in latest)) return latest;
      if (prepared.localRevalidationOnly) return latest;
      const workflow = latest.privateSnapshot.state;
      expectedRevision = workflow.revision;
      const investigation = currentStudyFirstEventInvestigation({
        studyFirstEventInvestigations: workflow.studyFirstEventInvestigations,
        confirmedShock: workflow.confirmedShock,
        study: workflow.study,
        entryContext: currentScreen3StudyEntryContext(workflow),
        timing: currentProposedTreatmentTiming(workflow),
        advice: currentStudyDesignAdvice(workflow),
        selection: currentStudyDesignSelection(workflow),
      });
      if (!investigation || investigation.investigationFingerprint !==
          input.expectedInvestigationFingerprint) return latest;
      const taskFingerprint = screen4InterpretationTaskFingerprint({
        runId: workflow.runId,
        investigation,
      });
      const attempts = (workflow.screen4InterpretationAttempts ?? []).filter(
        (record) => record.taskFingerprint === taskFingerprint,
      );
      const batchStates = screen4InterpretationBatches(investigation).map(
        (_, index) => attempts.filter((record) =>
          record.batchIndex === index).at(-1)?.status ?? "missing",
      );
      if (batchStates.every((status) => status === "completed") ||
          batchStates.some((status) => status === "outcome_unknown" ||
            status === "validation_failed" || status === "failed") ||
          !latest.changed) return latest;
    }
    return latest ?? this.status(authentication);
  }

  /** One durable four-event Responses batch. The public method above invokes
   * this at most three times under the researcher's single explicit action. */
  private async analyzeStudyFirstEventsBatch(
    authentication: SixScreenWorkflowAuthentication,
    input: { expectedRevision: number; operationId: string;
      expectedInvestigationFingerprint: string },
  ) {
    const read = await this.options.store.read(authentication);
    if (read.outcome !== "found") throw new Error(
      "The authorized Screen 4 workflow is unavailable.");
    this.requireOptionalAnalysisRecovery(read.record,
      "screen4InterpretationAttempts", 4, {
        action: "analyze_study_first_events",
        operationId: input.operationId,
        expectedRevision: input.expectedRevision,
      });
    if (read.record.operationReplays.some((entry) =>
      entry.operationId === input.operationId)) {
      return this.mutation(authentication, {
        expectedRevision: input.expectedRevision,
        operationId: input.operationId,
        operationKind: "analyze_study_first_events",
        payload: { expectedInvestigationFingerprint:
          input.expectedInvestigationFingerprint },
      }, (state) => ({ state }));
    }
    const before = read.record.state;
    const investigation = currentStudyFirstEventInvestigation({
      studyFirstEventInvestigations: before.studyFirstEventInvestigations,
      confirmedShock: before.confirmedShock,
      study: before.study,
      entryContext: currentScreen3StudyEntryContext(before),
      timing: currentProposedTreatmentTiming(before),
      advice: currentStudyDesignAdvice(before),
      selection: currentStudyDesignSelection(before),
    });
    if (!investigation ||
      investigation.investigationFingerprint !==
        input.expectedInvestigationFingerprint) {
      throw new Error("Screen 4 source results changed; review the current shortlist.");
    }
    const batches = screen4InterpretationBatches(investigation);
    const taskFingerprint = screen4InterpretationTaskFingerprint({
      runId: before.runId, investigation,
    });
    const current = (before.screen4InterpretationAttempts ?? []).filter(
      (record) => record.taskFingerprint === taskFingerprint);
    const latest = batches.map((_, index) => current.filter((record) =>
      record.batchIndex === index).at(-1));
    if (latest.some((attempt) => attempt?.status === "outcome_unknown")) {
      throw new SixScreenWorkflowProblemError(createSixScreenWorkflowProblem({
        code: "external_outcome_unknown",
        action: "analyze_study_first_events",
        operationId: input.operationId,
        screen: 4,
        expectedRevision: input.expectedRevision,
        actualRevision: before.revision,
        safeCauseCodes: ["external_outcome_unknown"],
      }));
    }
    const staleClaim = latest.find((attempt) =>
      recoverableScreen4Claim(attempt, this.options.now()));
    const reclaimPhase = staleClaim && this.options.screen5OpenAILedgerStore
      ? await this.options.screen5OpenAILedgerStore.reservationStatus(
        staleClaim.reservationId) : null;
    if (staleClaim && reclaimPhase !== "absent" &&
      reclaimPhase !== "reserved_not_dispatched") {
      throw new Error("The stale Screen 4 claim has an uncertain ledger phase and cannot be dispatched again.");
    }
    const required = latest.filter((attempt) => !attempt ||
      attempt.status === "pending" &&
        (attempt.claimOperationId === null ||
          recoverableScreen4Claim(attempt, this.options.now())) &&
        attempt.dispatchState === "not_dispatched" ||
      attempt.status === "failed" && !attempt.receipt &&
        (attempt.dispatchState === "not_dispatched" ||
          attempt.dispatchState === "dispatched" &&
            knownObservedHttpFailure(attempt))).length;
    // Each continuation dispatches one batch. Later authorized batches are
    // admitted against the ledger when their own explicit click occurs.
    const newReservations = required > 0 &&
      reclaimPhase !== "reserved_not_dispatched" ? 1 : 0;
    if (required && (!this.screen5OpenAIConfigurationIsValid() ||
      !this.options.screen5OpenAIApiKey ||
      !this.options.screen5OpenAIFetch ||
      !this.options.screen5OpenAILedgerStore)) {
      throw new Error("The OpenAI model service is not configured for Screen 4 interpretation.");
    }
    if (newReservations && this.options.screen5OpenAILedgerStore) {
      let allowance: {remainingAttempts: number; remainingTokens: number} = {
        remainingAttempts: LOCAL_MODEL_ALLOWANCE_DEFAULTS.maximumDispatchedAttempts,
        remainingTokens: LOCAL_MODEL_ALLOWANCE_DEFAULTS.maximumTokens,
      };
      try {
        allowance = await this.readOpenAIUsage(
          this.options.screen5OpenAILedgerStore,
        );
      }
      catch (caught) {
        if (!(caught instanceof Error && /not initialized/iu.test(
          caught.message))) throw caught;
      }
      if (allowance.remainingAttempts < newReservations ||
        allowance.remainingTokens < newReservations *
          SCREEN4_OPENAI_INTERPRETATION_RESERVATION) {
        throw new Error(localModelAllowanceBlocker(allowance,
          SCREEN4_OPENAI_INTERPRETATION_RESERVATION));
      }
    }
    const started = await this.mutation(authentication, {
      expectedRevision: input.expectedRevision,
      operationId: input.operationId,
      operationKind: "analyze_study_first_events",
      payload: { expectedInvestigationFingerprint:
        input.expectedInvestigationFingerprint },
    }, (state) => {
      const active = currentStudyFirstEventInvestigation({
        studyFirstEventInvestigations: state.studyFirstEventInvestigations,
        confirmedShock: state.confirmedShock,
        study: state.study,
        entryContext: currentScreen3StudyEntryContext(state),
        timing: currentProposedTreatmentTiming(state),
        advice: currentStudyDesignAdvice(state),
        selection: currentStudyDesignSelection(state),
      });
      if (active?.snapshotId !== investigation.snapshotId ||
        active.investigationFingerprint !==
          input.expectedInvestigationFingerprint ||
        screen4InterpretationTaskFingerprint({ runId: state.runId,
          investigation: active }) !== taskFingerprint) {
        throw new Error("Screen 4 source results changed before model authorization.");
      }
      const entries = state.screen4InterpretationAttempts ?? [];
      if (entries.some((entry) => entry.taskFingerprint === taskFingerprint &&
        (entry.status === "outcome_unknown" ||
          entry.status === "pending" &&
            entry.claimOperationId !== null &&
            !recoverableScreen4Claim(entry, this.options.now())))) {
        return { state, result: { claimedId: null } };
      }
      let appendedCount = 0;
      let claim: Screen4InterpretationAttempt | null = null;
      // Admit exactly one provider batch per explicit action. In particular,
      // do not create pending records for later batches: those records are the
      // durable authorization boundary, not a passive queue forecast.
      for (const [batchIndex, eventIds] of batches.entries()) {
        const prior = entries.filter((entry) =>
          entry.taskFingerprint === taskFingerprint &&
          entry.batchIndex === batchIndex);
        const last = prior.at(-1);
        if (last?.status === "completed") continue;
        if (last?.status === "receipt_saved" ||
            last?.status === "validation_failed") {
          // Local receipt processing comes before authorizing a later batch.
          break;
        }
        if (last?.status === "pending") {
          if ((last.claimOperationId === null ||
              recoverableScreen4Claim(last, this.options.now())) &&
              last.dispatchState === "not_dispatched") claim = last;
          break;
        }
        const retryable = last?.status === "failed" && !last.receipt &&
          (last.dispatchState === "not_dispatched" ||
            last.dispatchState === "dispatched" &&
              knownObservedHttpFailure(last));
        if (last && !retryable) break;
        if (entries.length >= SCREEN4_INTERPRETATION_MAX_HISTORY) {
          throw new Error("Screen 4 interpretation history is full.");
        }
        const identifiers = screen4InterpretationAttemptIds({
          taskFingerprint, batchIndex, attemptOrdinal: prior.length + 1,
        });
        // Prepare only the batch being authorized now.  Earlier revisions
        // prepared all three possible batches before the first durable
        // checkpoint, so one oversized or malformed later packet prevented
        // batch 1 from being saved or dispatched at all.
        const prepared = prepareScreen4Interpretation({
          investigation: active,
          eventIds,
        });
        claim = { ...identifiers, taskFingerprint,
          packetFingerprint: prepared.packetFingerprint,
          investigationSnapshotId: active.snapshotId,
          investigationFingerprint: active.investigationFingerprint,
          batchIndex, eventIds: [...eventIds],
          attemptOrdinal: prior.length + 1,
          claimOperationId: null,
          status: "pending", dispatchState: "not_dispatched",
          failureCode: null, failureStage: null, receipt: null, result: null,
          error: null, updatedAt: this.options.now() };
        entries.push(claim);
        appendedCount = 1;
        break;
      }
      if (!claim && !appendedCount) {
        return { state, result: { claimedId: null } };
      }
      if (claim) {
        claim.claimOperationId = input.operationId;
        claim.updatedAt = this.options.now();
      }
      state.screen4InterpretationAttempts = entries;
      const at = this.options.now();
      state.revision += 1;
      state.updatedAt = at;
      state.changeLog.push({ revision: state.revision, at,
        summary: appendedCount
          ? "Screen 4 authorized and claimed one bounded model batch for dispatch."
          : claim
            ? "Screen 4 claimed one retained bounded model batch for this explicit action."
            : "Screen 4 processed a saved batch locally without authorizing another provider request." });
      return { state, result: { claimedId: claim?.id ?? null } };
    });
    if (!("privateSnapshot" in started)) return started;
    const claimedId = started.changed
      ? (started.result as {claimedId: string | null}).claimedId : null;
    const saved = (started.privateSnapshot.state.screen4InterpretationAttempts
      ?? []).filter((record) => record.taskFingerprint === taskFingerprint &&
        (record.id === claimedId || record.receipt &&
          (record.status === "receipt_saved" ||
            record.status === "validation_failed")));
    for (const record of saved) {
      await this.executeScreen4InterpretationBatch(authentication, record);
      const latest = await this.options.store.read(authentication);
      if (latest.outcome !== "found") throw new Error(
        "The Screen 4 batch result could not be reopened safely.");
      if (latest.record.state.screen4InterpretationAttempts?.some((attempt) =>
        attempt.taskFingerprint === taskFingerprint &&
        attempt.status === "outcome_unknown")) {
        // Other authorized batches remain saved but cannot dispatch until
        // the uncertain provider outcome has been reconciled explicitly.
        break;
      }
    }
    return { ...(await this.status(authentication)),
      changed: started.changed, replayed: started.replayed,
      mutationOutcome: started.mutationOutcome };
  }

  private async executeScreen4InterpretationBatch(
    authentication: SixScreenWorkflowAuthentication,
    record: Screen4InterpretationAttempt,
  ) {
    const read = await this.options.store.read(authentication);
    if (read.outcome !== "found") throw new Error(
      "The saved Screen 4 interpretation attempt is unavailable.");
    const investigation = read.record.state.studyFirstEventInvestigations?.find(
      (item) => item.snapshotId === record.investigationSnapshotId &&
        item.investigationFingerprint === record.investigationFingerprint);
    if (!investigation) throw new Error(
      "The Screen 4 interpretation lost its frozen source scan.");
    if (read.record.state.screen4InterpretationAttempts?.find((item) =>
      item.id === record.id)?.claimOperationId !== record.claimOperationId) {
      return null;
    }
    const prepared = prepareScreen4Interpretation({
      investigation, eventIds: record.eventIds,
    });
    if (prepared.packetFingerprint !== record.packetFingerprint) {
      throw new Error("The frozen Screen 4 source packet changed.");
    }
    const ledger = this.options.screen5OpenAILedgerStore;
    const persist = (label: string,
      patch: Partial<Screen4InterpretationAttempt>) =>
      this.persistScreen4InterpretationStage(authentication, {
        id: record.id, reservationId: record.reservationId, label, patch,
        expectedClaimOperationId: record.claimOperationId!,
      });
    const settle = async (usage: Screen5MechanismProviderReceipt["usage"]) => {
      try { await ledger?.settle({ reservationId: record.reservationId,
        usage, now: this.options.now() }); }
      catch { /* An unsettled reservation retains its conservative hold. */ }
    };
    if (record.receipt) {
      try {
        if (record.receipt.usage.promptTokens >
          modelTaskProfile("screen4_event_interpretation").inputCeiling ||
          record.receipt.usage.completionTokens >
            modelTaskProfile("screen4_event_interpretation").outputCeiling) {
          throw new Error("Observed Screen 4 usage exceeded the authorized profile.");
        }
        const wire = parseSavedScreen4InterpretationReceipt({
          receipt: record.receipt, prepared,
        });
        const completed = await persist("completed", {
          status: "completed", result: wire, failureCode: null,
          failureStage: null, error: null,
        });
        await settle(record.receipt.usage);
        return completed;
      } catch (caught) {
        await settle(record.receipt.usage);
        const issue = caught instanceof Screen5MechanismWireValidationError
          ? caught.issues.slice(0, 3).map((item) =>
            `${item.code} at ${item.path}`).join("; ")
          : "saved response could not be validated locally";
        return persist("validation_failed", {
          status: "validation_failed",
          failureCode: "local_receipt_validation_failed",
          error: `Screen 4 saved response failed local validation: ${issue}`
            .slice(0, 500),
        });
      }
    }
    if (record.status !== "pending" ||
      record.claimOperationId === null ||
      record.dispatchState !== "not_dispatched") return null;
    if (!ledger || !this.options.screen5OpenAIApiKey ||
      !this.options.screen5OpenAIFetch) throw new Error(
        "The OpenAI model service is not configured.");
    let reserved = false;
    let received: Screen5MechanismProviderReceipt | null = null;
    let completedWithReceipt = false;
    try {
      await this.initializeOpenAIUsage(ledger);
      await ledger.reserve({ reservationId: record.reservationId,
        jobId: record.id, stage: "screen4_event_interpretation",
        reservedTokens: SCREEN4_OPENAI_INTERPRETATION_RESERVATION,
        now: this.options.now() });
      reserved = true;
      const response = await requestScreen4Interpretation({
        apiKey: this.options.screen5OpenAIApiKey,
        fetch: this.options.screen5OpenAIFetch,
        prepared, now: this.options.now,
        onDispatch: async () => {
          await persist("dispatch", { dispatchState: "dispatched" });
          await ledger.recordDispatch({ reservationId: record.reservationId,
            now: this.options.now() });
        },
        onReceipt: async (receipt) => {
          received = receipt;
          let wire: ReturnType<typeof parseSavedScreen4InterpretationReceipt>;
          try {
            if (receipt.usage.promptTokens >
                modelTaskProfile("screen4_event_interpretation").inputCeiling ||
              receipt.usage.completionTokens >
                modelTaskProfile("screen4_event_interpretation").outputCeiling) {
              throw new Error("Observed Screen 4 usage exceeded the authorized profile.");
            }
            wire = parseSavedScreen4InterpretationReceipt({
              receipt, prepared,
            });
            // Keep parsing failures distinct from storage failures: only an
            // invalid response should enter the validation-failed state.
          } catch (caught) {
            const issue = caught instanceof Screen5MechanismWireValidationError
              ? caught.issues.slice(0, 3).map((item) =>
                `${item.code} at ${item.path}`).join("; ")
              : "saved response could not be validated locally";
            await persist("receipt_validation_failed", {
              status: "validation_failed", receipt,
              failureCode: "local_receipt_validation_failed",
              failureStage: "model_output",
              error: `Screen 4 saved response failed local validation: ${issue}`
                .slice(0, 500),
            });
            await ledger.recordReceipt({ reservationId: record.reservationId,
              contentFingerprint: receipt.contentFingerprint,
              now: this.options.now() });
            return;
          }
          await persist("receipt_completed", { status: "completed", receipt,
            result: wire, error: null, failureCode: null,
            failureStage: null });
          completedWithReceipt = true;
          await ledger.recordReceipt({ reservationId: record.reservationId,
            contentFingerprint: receipt.contentFingerprint,
            now: this.options.now() });
        },
      });
      if (completedWithReceipt) {
        await settle(response.usage);
        return this.status(authentication);
      }
      const completed = await persist("completed", { status: "completed",
        result: response.wire, error: null, failureCode: null,
        failureStage: null });
      await settle(response.usage);
      return completed;
    } catch (caught) {
      const provider = caught instanceof Screen5OpenAIProviderError
        ? caught : null;
      const latest = await this.options.store.read(authentication);
      if (latest.outcome !== "found") throw caught;
      let saved = latest.record.state.screen4InterpretationAttempts?.find(
        (item) => item.id === record.id);
      if (!saved) throw caught;
      if (saved.claimOperationId !== record.claimOperationId) {
        // An older worker may have reserved this ID, but only the current
        // claim may save the dispatch marker or send the provider request.
        return null;
      }
      if (saved.status === "completed") {
        if (saved.receipt) await settle(saved.receipt.usage);
        return this.status(authentication);
      }
      if (saved.status === "validation_failed" && saved.receipt) {
        await settle(saved.receipt.usage);
        return this.status(authentication);
      }
      if (!saved.receipt && received) {
        try {
          await persist("receipt", { status: "receipt_saved",
            receipt: received });
          saved = { ...saved, status: "receipt_saved", receipt: received };
        } catch { /* Keep the held allowance: response may be unrecoverable. */ }
      }
      if (saved.receipt) {
        await settle(saved.receipt.usage);
        if (provider && ["provider_schema_invalid", "provider_json_invalid",
          "observed_budget_exceeded"].includes(provider.detail.code)) {
          const issues = provider.detail.validationIssues?.slice(0, 3)
            .map((issue) => `${issue.code} at ${issue.path}`).join("; ");
          return persist("validation_failed", { status: "validation_failed",
            failureCode: provider.detail.code,
            failureStage: provider.detail.failureStage ?? "model_output",
            error: `Screen 4 saved response failed bounded validation${issues ? `: ${issues}` : "."}`
              .slice(0, 500) });
        }
        return null;
      }
      if (received) {
        return persist("outcome_unknown", { status: "outcome_unknown",
          dispatchState: "unknown", failureCode: "receipt_persistence_failed",
          failureStage: "persistence",
          error: "Screen 4 received a provider response but could not save its protected receipt." });
      }
      const code = provider?.detail.code ?? provider?.detail.safeCause ??
        (reserved ? "local_persistence_failed" : "ledger_reservation_failed");
      const failureCode = /^[a-z][a-z0-9_]{0,79}$/u.test(code)
        ? code : "model_request_failed";
      const beforeDispatch = saved.dispatchState !== "dispatched" &&
        (!provider || provider.detail.networkInvocation === "not_started");
      let released = !reserved;
      if (beforeDispatch && reserved) {
        try {
          await ledger.release({ reservationId: record.reservationId,
            reasonCode: failureCode, now: this.options.now() });
          released = true;
        } catch { /* No new request while reservation remains uncertain. */ }
      }
      if (provider?.detail.usage) await settle(provider.detail.usage);
      const known = beforeDispatch && released ||
        Boolean(provider?.detail.outcomeKnown &&
          provider.detail.networkInvocation === "invoked");
      return persist(known ? "failed" : "outcome_unknown", {
        status: known ? "failed" : "outcome_unknown",
        dispatchState: beforeDispatch && released
          ? "not_dispatched" : provider?.detail.dispatched
            ? "dispatched" : "unknown",
        failureCode,
        failureStage: provider?.detail.failureStage ??
          (reserved ? "persistence" : "admission"),
        error: beforeDispatch && released
          ? `Screen 4 request stopped before dispatch (${failureCode}).`
          : known
            ? `Screen 4 provider rejected the request (${failureCode}); use an explicit new attempt after correction.`
            : `Screen 4 provider outcome is unknown (${failureCode}); inspect the saved attempt before another request.`,
      });
    }
  }

  openScreen5(authentication: SixScreenWorkflowAuthentication, input: {
    expectedRevision: number;
    operationId: string;
  }) {
    return this.mutation(authentication, {
      ...input,
      operationKind: "open_screen_5",
      payload: { expectedRevision: input.expectedRevision },
    }, (state) => {
      const opened = openScreen5(state, {
        expectedRevision: input.expectedRevision,
        openedAt: this.options.now(),
      });
      return { state: opened.state, result: opened.receipt };
    });
  }

  private commitScreen5ProviderCheckpoint(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      operationKind: string;
      label: string;
      previous: StudyFirstMechanismRun;
      savedAt: string;
      patch: Partial<Omit<
        StudyFirstMechanismRun,
        "schemaVersion" | "runFingerprint"
      >>;
    },
  ) {
    return this.mutation(authentication, {
      expectedRevision: input.expectedRevision,
      operationId: input.operationId,
      operationKind: input.operationKind,
      payload: {
        label: input.label,
        previousRunFingerprint: input.previous.runFingerprint,
        patch: input.patch,
      },
    }, (state) => {
      const run = checkpointStudyFirstMechanismRun({
        state,
        previous: input.previous,
        label: input.label,
        savedAt: input.savedAt,
        patch: input.patch,
      });
      const committed = commitStudyFirstMechanismRun(state, {
        expectedRevision: input.expectedRevision,
        run,
        savedAt: input.savedAt,
      });
      return { state: committed.state, result: committed.run };
    });
  }

  private completeScreen5Advance(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      retry: boolean;
      result: StudyFirstMechanismRun;
    },
  ) {
    return this.mutation(authentication, {
      expectedRevision: input.expectedRevision,
      operationId: input.operationId,
      operationKind: "advance_study_first_mechanism_job",
      payload: {
        retry: input.retry,
        resultFingerprint: input.result.runFingerprint,
      },
    }, (state) => ({ state, result: input.result }));
  }

  async compareStudyFirstMechanisms(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      theoreticalPerspective: string | null;
      proposedMechanism: string;
      operationKind?:
        | "compare_study_first_mechanisms"
        | "ensure_study_first_mechanism_job";
    },
  ) {
    const operationKind = input.operationKind ??
      "compare_study_first_mechanisms";
    const perspective = input.theoreticalPerspective?.trim()
      ? input.theoreticalPerspective
      : null;
    const payload = {
      theoreticalPerspective: perspective,
      proposedMechanism: input.proposedMechanism,
      executorVersion: STUDY_FIRST_MECHANISM_EXECUTOR_VERSION,
    };
    const read = await this.options.store.read(authentication);
    if (read.outcome === "unauthorized") {
      throw new Error("Six-screen workflow access is unauthorized.");
    }
    if (read.outcome === "not_found") {
      throw new Error("Six-screen workflow is unavailable or expired.");
    }
    if (read.record.operationReplays.some(({ operationId }) =>
      operationId === input.operationId)) {
      return this.mutation(authentication, {
        expectedRevision: input.expectedRevision,
        operationId: input.operationId,
        operationKind,
        payload,
      }, (state) => ({
        state,
        result: currentStudyFirstMechanismRunForState(state),
      }));
    }
    const operationCoordinate = fingerprintSixScreenValue(
      input.operationId,
    ).slice("fnv1a64:".length);
    const savedAt = this.options.now();
    let workflow = read.record.state;
    const context = currentStudyFirstMechanismContext(workflow, savedAt);
    if (
      !context ||
      screen5PrerequisiteReport(workflow).handoffKind !== "study_first_v2"
    ) {
      throw new Error(
        "Study-first mechanism comparison requires the current Screen 5 study-first workspace.",
      );
    }
    const currentInput = currentStudyFirstMechanismInputForState(workflow);
    const currentRun = currentStudyFirstMechanismRunForState(workflow);
    const sameScientificInput = Boolean(
      currentInput && currentRun &&
      currentInput.theoreticalPerspective === perspective &&
      currentInput.proposedMechanism === input.proposedMechanism
    );
    const directRouteRequested = this.screen5DirectIntent();
    if (
      sameScientificInput &&
      (!directRouteRequested || screen5ProviderExecutionIsCompatible(currentRun))
    ) {
      return this.mutation(authentication, {
        expectedRevision: input.expectedRevision,
        operationId: input.operationId,
        operationKind,
        payload,
      }, (state) => ({ state, result: currentRun }));
    }

    const migrationKey = sameScientificInput && currentRun
      ? screen5ProviderMigrationKey(currentRun)
      : null;
    const coordinate = migrationKey
      ? migrationKey.slice("fnv1a64:".length)
      : operationCoordinate;

    const deterministicInputId = `screen5-mechanism-input-${coordinate}`;
    let mechanismInput = sameScientificInput
      ? currentInput
      : currentInput?.id === deterministicInputId
      ? currentInput
      : null;
    if (mechanismInput) {
      if (
        mechanismInput.contextFingerprint !== context.contextFingerprint ||
        mechanismInput.theoreticalPerspective !== perspective ||
        mechanismInput.proposedMechanism !== input.proposedMechanism
      ) {
        throw new Error(
          "The Screen 5 operation id was reused for different mechanism input.",
        );
      }
    } else {
      if (workflow.revision !== input.expectedRevision) {
        throw new Error(
          `Stale six-screen workflow mutation; current revision is ${workflow.revision}.`,
        );
      }
      mechanismInput = createStudyFirstMechanismInput({
        id: deterministicInputId,
        revision: (workflow.studyFirstMechanismInputs ?? []).length + 1,
        contextFingerprint: context.contextFingerprint,
        theoreticalPerspective: perspective,
        proposedMechanism: input.proposedMechanism,
        savedAt,
      });
      const saved = await this.mutation(authentication, {
        expectedRevision: workflow.revision,
        operationId: `screen5-input-save-${coordinate}`,
        operationKind: "save_study_first_mechanism_input",
        payload: mechanismInput,
      }, (state) => {
        const result = saveStudyFirstMechanismInput(state, {
          expectedRevision: workflow.revision,
          mechanismInput: mechanismInput!,
          savedAt,
        });
        return { state: result.state, result: result.input };
      });
      workflow = saved.privateSnapshot.state;
    }

    const assessment = assessStudyFirstMechanismInput({
      theoreticalPerspective: mechanismInput.theoreticalPerspective,
      proposedMechanism: mechanismInput.proposedMechanism,
      policyTitle: context.policy.officialTitle,
      outcome: context.study.outcome,
    });
    const runs = workflow.studyFirstMechanismRuns ?? [];
    const theoreticalProblem = sameScientificInput && currentRun
      ?.theoreticalProblem
      ? currentRun.theoreticalProblem
      : createStudyFirstTheoreticalProblem({
          id: `screen5-theoretical-problem-${coordinate}`,
          context,
          mechanismInput,
        });
    const directModeRequested = directRouteRequested;
    let budgetSnapshot: Screen5MechanismExecution["budgetSnapshot"] = null;
    let directConfigurationReady = false;
    let directConfigurationError = {
      code: "direct_provider_configuration_required",
      message:
        "OpenAI Screen 5 is selected, but this Worker still needs an enabled runtime mode, the server key, the fixed OpenAI transport, and persistent ledger storage.",
    };
    if (
      assessment.status === "ready" &&
      directModeRequested &&
      this.screen5OpenAIConfigurationIsValid() &&
      this.options.screen5OpenAIApiKey &&
      this.options.screen5OpenAIFetch &&
      this.options.screen5OpenAILedgerStore
    ) {
      try {
        budgetSnapshot = await this.readOpenAIUsage(
          this.options.screen5OpenAILedgerStore,
          savedAt,
        );
        directConfigurationReady = true;
      } catch {
        directConfigurationReady = false;
        directConfigurationError = {
          code: "persistent_ledger_initialization_failed",
          message:
            "OpenAI Screen 5 is configured, but persistent ledger storage could not be initialized. No inference request was sent.",
        };
      }
    }
    const providerExecution = assessment.status === "ready" &&
        directModeRequested
      ? createScreen5OpenAIExecution({
          id: `screen5-openai-job-${coordinate}`,
          phase: directConfigurationReady
            ? "planning_queued"
            : "configuration_required",
          problemFingerprint: theoreticalProblem.problemFingerprint,
          inputFingerprint: mechanismInput.inputFingerprint,
          attempts: [],
          budgetSnapshot,
          evidencePacket: null,
          comparison: null,
          nextEligibleAt: null,
          retryCount: 0,
          lastError: directConfigurationReady
            ? null
            : {
                stage: "configuration",
                code: directConfigurationError.code,
                message: directConfigurationError.message,
                retryable: false,
                occurredAt: savedAt,
              },
          createdAt: savedAt,
          updatedAt: savedAt,
        })
      : undefined;
    const run = createStudyFirstMechanismRun({
      id: `screen5-mechanism-run-${coordinate}`,
      ordinal: runs.length + 1,
      previousRunId: runs.at(-1)?.id ?? null,
      context,
      input: mechanismInput,
      inputAssessment: assessment,
      theoreticalProblem,
      planning: {
        status: assessment.status === "ready"
          ? directModeRequested
            ? "available_via_direct_provider"
            : "available_via_signed_host_task"
          : "not_started",
        origin: directModeRequested ? "openai" : "chatgpt_host",
        taskId: null,
        resultId: null,
        providerAttemptId: null,
        plan: null,
        limitation: assessment.status === "ready"
          ? directModeRequested
            ? "Direct Stage A must finish before bounded scholarly retrieval; candidate labels remain provisional search scaffolds."
            : "Stage A must run before scholarly retrieval so candidate labels do not become a fixed production menu."
          : assessment.clarification ??
            "The proposed mechanism needs a process statement.",
      },
      ...(providerExecution ? { providerExecution } : {}),
      ...(providerExecution && migrationKey && currentRun
        ? {
            executionLineage: {
              kind: "direct_provider_migration" as const,
              sourceRunId: currentRun.id,
              sourceRunFingerprint: currentRun.runFingerprint,
              migrationKey,
              targetProvider: "openai" as const,
              targetModel: SCREEN5_OPENAI_MODEL,
              migratedAt: savedAt,
            },
          }
        : {}),
      searchPlan: {
        queries: [],
        providerQueryCeiling: 2,
        providerOperationCeiling: 4,
        intentQueries: [],
        metadataRecordCeiling: 10,
        abstractInspectionCeiling: 10,
        publicationWindowRule:
          "study_period_does_not_limit_scholarship_publication_year",
      },
      attempts: [],
      works: [],
      status: assessment.status === "ready"
        ? "planning_ready"
        : "needs_clarification",
      hostComparison: {
        status: assessment.status === "ready" && !directModeRequested
          ? "planning_required"
          : "not_started",
        taskId: null,
        limitation: assessment.status === "ready"
          ? directModeRequested
            ? "The direct provider job, deterministic evidence retrieval, and final comparison are server-owned. No signed host task is required."
            : "No evidence search or final comparison starts until the signed pre-retrieval theoretical plan is validated."
          : assessment.clarification ??
            "The proposed mechanism needs a process statement.",
      },
      phases: {
        retrieval: assessment.status === "ready" ? "not_started" : "not_needed",
        textInspection: assessment.status === "ready"
          ? "not_started"
          : "not_needed",
        screening: assessment.status === "ready" ? "not_started" : "not_needed",
        synthesis: assessment.status === "ready" ? "pending" : "not_needed",
        validation: assessment.status === "ready" ? "pending" : "not_needed",
        presentation: assessment.status === "ready" ? "partial" : "complete",
      },
      createdAt: savedAt,
    });
    return this.mutation(authentication, {
      expectedRevision: workflow.revision,
      operationId: input.operationId,
      operationKind,
      payload,
    }, (state) => {
      const committed = commitStudyFirstMechanismRun(state, {
        expectedRevision: workflow.revision,
        run,
        savedAt,
      });
      return { state: committed.state, result: committed.run };
    });
  }

  async ensureStudyFirstMechanismJob(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      expectedInputFingerprint: string;
      expectedRunFingerprint: string;
    },
  ) {
    const payload = {
      expectedInputFingerprint: input.expectedInputFingerprint,
      expectedRunFingerprint: input.expectedRunFingerprint,
      targetProvider: "openai" as const,
      targetModel: SCREEN5_OPENAI_MODEL,
      executionVersion: SCREEN5_OPENAI_EXECUTION_VERSION,
    };
    const read = await this.options.store.read(authentication);
    if (read.outcome === "unauthorized") {
      throw new Error("Six-screen workflow access is unauthorized.");
    }
    if (read.outcome === "not_found") {
      throw new Error("Six-screen workflow is unavailable or expired.");
    }
    this.requireOptionalAnalysisRecovery(read.record,
      "studyFirstMechanismRuns", 5, {
        action: "ensure_study_first_mechanism_job",
        operationId: input.operationId,
        expectedRevision: input.expectedRevision,
      });
    if (read.record.operationReplays.some(({ operationId }) =>
      operationId === input.operationId)) {
      return this.mutation(authentication, {
        expectedRevision: input.expectedRevision,
        operationId: input.operationId,
        operationKind: "ensure_study_first_mechanism_job",
        payload,
      }, (state) => ({
        state,
        result: currentStudyFirstMechanismRunForState(state),
      }));
    }
    if (!this.screen5DirectIntent()) {
      throw new Error(
        "Direct Screen 5 has not been selected or configured in this Worker.",
      );
    }
    let workflow = read.record.state;
    let currentRun = currentStudyFirstMechanismRunForState(workflow);
    const currentInput = currentStudyFirstMechanismInputForState(workflow);
    if (!currentRun || !currentInput || !currentRun.theoreticalProblem) {
      throw new Error(
        "A current saved Screen 5 mechanism run is required before ensuring its provider job.",
      );
    }
    const expectedRunMatches = currentRun.runFingerprint ===
        input.expectedRunFingerprint ||
      currentRun.executionLineage?.sourceRunFingerprint ===
        input.expectedRunFingerprint;
    if (
      currentInput.inputFingerprint !== input.expectedInputFingerprint ||
      currentRun.input.inputFingerprint !== input.expectedInputFingerprint ||
      !expectedRunMatches
    ) {
      throw new Error(
        "The requested Screen 5 provider migration does not match the active saved input and run.",
      );
    }
    if (
      workflow.revision !== input.expectedRevision &&
      !screen5ProviderExecutionIsCompatible(currentRun)
    ) {
      throw new Error(
        `Stale six-screen workflow mutation; current revision is ${workflow.revision}.`,
      );
    }

    let budgetSnapshot: Screen5MechanismBudgetSnapshot | null = null;
    let configurationReady = false;
    let configurationError = {
      code: "direct_provider_configuration_required",
      message:
        "The OpenAI-only route is preserved, but this Worker still needs an enabled runtime mode, the server key, the fixed OpenAI transport, and persistent ledger storage.",
    };
    if (
      this.screen5OpenAIConfigurationIsValid() &&
      this.options.screen5OpenAIApiKey &&
      this.options.screen5OpenAIFetch &&
      this.options.screen5OpenAILedgerStore
    ) {
      try {
        budgetSnapshot = await this.readOpenAIUsage(
          this.options.screen5OpenAILedgerStore,
        );
        configurationReady = true;
      } catch {
        configurationReady = false;
        configurationError = {
          code: "persistent_ledger_initialization_failed",
          message:
            "The OpenAI-only route is preserved, but persistent ledger storage could not be initialized. No inference request was sent.",
        };
      }
    }

    if (screen5ProviderExecutionIsCompatible(currentRun)) {
      if (currentRun.providerExecution!.phase !== "configuration_required") {
        return this.mutation(authentication, {
          expectedRevision: workflow.revision,
          operationId: input.operationId,
          operationKind: "ensure_study_first_mechanism_job",
          payload,
        }, (state) => ({ state, result: currentRun }));
      }
      const savedAt = this.options.now();
      if (!configurationReady) {
        if (
          currentRun.providerExecution!.lastError?.code ===
            configurationError.code
        ) {
          return this.mutation(authentication, {
            expectedRevision: workflow.revision,
            operationId: input.operationId,
            operationKind: "ensure_study_first_mechanism_job",
            payload,
          }, (state) => ({ state, result: currentRun }));
        }
        const blockedExecution = updateScreen5MechanismExecution(
          currentRun.providerExecution!,
          {
            phase: "configuration_required",
            budgetSnapshot: null,
            lastError: {
              stage: "configuration",
              code: configurationError.code,
              message: configurationError.message,
              retryable: false,
              occurredAt: savedAt,
            },
          },
          savedAt,
        );
        return this.mutation(authentication, {
          expectedRevision: workflow.revision,
          operationId: input.operationId,
          operationKind: "ensure_study_first_mechanism_job",
          payload,
        }, (state) => {
          const run = checkpointStudyFirstMechanismRun({
            state,
            previous: currentRun!,
            label: "openai-configuration-blocked",
            savedAt,
            patch: { providerExecution: blockedExecution },
          });
          const committed = commitStudyFirstMechanismRun(state, {
            expectedRevision: workflow.revision,
            run,
            savedAt,
          });
          return { state: committed.state, result: committed.run };
        });
      }
      const execution = updateScreen5MechanismExecution(
        currentRun.providerExecution!,
        {
          phase: "planning_queued",
          budgetSnapshot,
          lastError: null,
        },
        savedAt,
      );
      return this.mutation(authentication, {
        expectedRevision: workflow.revision,
        operationId: input.operationId,
        operationKind: "ensure_study_first_mechanism_job",
        payload,
      }, (state) => {
        const run = checkpointStudyFirstMechanismRun({
          state,
          previous: currentRun!,
          label: "openai-configuration-ready",
          savedAt,
          patch: { providerExecution: execution },
        });
        const committed = commitStudyFirstMechanismRun(state, {
          expectedRevision: workflow.revision,
          run,
          savedAt,
        });
        return { state: committed.state, result: committed.run };
      });
    }

    const savedAt = this.options.now();
    const migrationKey = screen5ProviderMigrationKey(currentRun);
    const coordinate = migrationKey.slice("fnv1a64:".length);
    const runs = workflow.studyFirstMechanismRuns ?? [];
    const previousCompatible = [...runs].reverse().find((run) =>
      screen5ProviderExecutionIsCompatible(run) &&
      run.input.inputFingerprint === currentInput.inputFingerprint &&
      run.theoreticalProblem?.problemFingerprint ===
        currentRun?.theoreticalProblem?.problemFingerprint
    );
    if (previousCompatible) {
      currentRun = previousCompatible;
      const restored = checkpointStudyFirstMechanismRun({
        state: workflow,
        previous: previousCompatible,
        label: "openai-provider-restored",
        savedAt,
        patch: {},
      });
      return this.mutation(authentication, {
        expectedRevision: workflow.revision,
        operationId: input.operationId,
        operationKind: "ensure_study_first_mechanism_job",
        payload,
      }, (state) => {
        const committed = commitStudyFirstMechanismRun(state, {
          expectedRevision: workflow.revision,
          run: restored,
          savedAt,
        });
        return { state: committed.state, result: committed.run };
      });
    }
    const execution = createScreen5OpenAIExecution({
      id: `screen5-openai-job-${coordinate}`,
      phase: configurationReady
        ? "planning_queued"
        : "configuration_required",
      problemFingerprint: currentRun.theoreticalProblem.problemFingerprint,
      inputFingerprint: currentInput.inputFingerprint,
      attempts: [],
      budgetSnapshot,
      evidencePacket: null,
      comparison: null,
      nextEligibleAt: null,
      retryCount: 0,
      lastError: configurationReady
        ? null
        : {
            stage: "configuration",
            code: configurationError.code,
            message: configurationError.message,
            retryable: false,
            occurredAt: savedAt,
          },
      createdAt: savedAt,
      updatedAt: savedAt,
    });
    const migratedRun = createStudyFirstMechanismRun({
      id: `screen5-provider-migration-${coordinate}`,
      ordinal: runs.length + 1,
      previousRunId: runs.at(-1)?.id ?? null,
      context: currentRun.context,
      input: currentInput,
      inputAssessment: currentRun.inputAssessment,
      theoreticalProblem: currentRun.theoreticalProblem,
      planning: {
        status: "available_via_direct_provider",
        origin: "openai",
        taskId: null,
        resultId: null,
        providerAttemptId: null,
        plan: null,
        limitation:
          "The linked direct job preserves the exact focal process and must finish Stage A before bounded scholarly retrieval.",
      },
      providerExecution: execution,
      executionLineage: {
        kind: "direct_provider_migration",
        sourceRunId: currentRun.id,
        sourceRunFingerprint: currentRun.runFingerprint,
        migrationKey,
        targetProvider: "openai",
        targetModel: SCREEN5_OPENAI_MODEL,
        migratedAt: savedAt,
      },
      searchPlan: {
        queries: [],
        providerQueryCeiling: 2,
        providerOperationCeiling: 4,
        intentQueries: [],
        metadataRecordCeiling: 10,
        abstractInspectionCeiling: 10,
        publicationWindowRule:
          "study_period_does_not_limit_scholarship_publication_year",
      },
      attempts: [],
      works: [],
      status: "planning_ready",
      hostComparison: {
        status: "not_started",
        taskId: null,
        limitation:
          "This active provider job does not prepare, deliver, restore, or poll a signed host task. The source host run remains historical.",
      },
      phases: {
        retrieval: "not_started",
        textInspection: "not_started",
        screening: "not_started",
        synthesis: "pending",
        validation: "pending",
        presentation: "partial",
      },
      createdAt: savedAt,
    });
    try {
      return await this.mutation(authentication, {
        expectedRevision: workflow.revision,
        operationId: input.operationId,
        operationKind: "ensure_study_first_mechanism_job",
        payload,
      }, (state) => {
        const committed = commitStudyFirstMechanismRun(state, {
          expectedRevision: workflow.revision,
          run: migratedRun,
          savedAt,
        });
        return { state: committed.state, result: committed.run };
      });
    } catch (caught) {
      if (!isSixScreenRevisionConflict(caught)) throw caught;
      const latest = await this.options.store.read(authentication);
      if (latest.outcome !== "found") throw caught;
      const converged = currentStudyFirstMechanismRunForState(
        latest.record.state,
      );
      if (
        !screen5ProviderExecutionIsCompatible(converged) ||
        converged?.input.inputFingerprint !== input.expectedInputFingerprint ||
        converged.executionLineage?.migrationKey !== migrationKey
      ) throw caught;
      return this.mutation(authentication, {
        expectedRevision: latest.record.state.revision,
        operationId: input.operationId,
        operationKind: "ensure_study_first_mechanism_job",
        payload,
      }, (state) => ({ state, result: converged }));
    }
  }

  async authorizeStudyFirstMechanismJob(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      expectedExecutionFingerprint: string;
    },
  ) {
    const payload = {
      expectedExecutionFingerprint: input.expectedExecutionFingerprint,
      source: "authenticated_screen5_action" as const,
    };
    let read: Awaited<ReturnType<SixScreenWorkflowStore["read"]>>;
    try {
      read = await this.options.store.read(authentication);
    } catch {
      return workflowProblemFailure({
        code: "core_state_invalid",
        action: "authorize_study_first_mechanism_job",
        operationId: input.operationId,
        screen: 5,
        expectedRevision: input.expectedRevision,
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        recovery: "none",
        safeCauseCodes: ["core_state_invalid"],
      });
    }
    if (read.outcome === "unauthorized") {
      return workflowProblemFailure({
        code: "authorization",
        action: "authorize_study_first_mechanism_job",
        operationId: input.operationId,
        screen: 5,
        expectedRevision: input.expectedRevision,
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        recovery: "reconnect",
        safeCauseCodes: ["authorization_failed"],
      });
    }
    if (read.outcome === "not_found") {
      return workflowProblemFailure({
        code: "authorization",
        action: "authorize_study_first_mechanism_job",
        operationId: input.operationId,
        screen: 5,
        expectedRevision: input.expectedRevision,
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        recovery: "reconnect",
        safeCauseCodes: ["run_unavailable"],
      });
    }
    this.requireOptionalAnalysisRecovery(read.record,
      "studyFirstMechanismRuns", 5, {
        action: "authorize_study_first_mechanism_job",
        operationId: input.operationId,
        expectedRevision: input.expectedRevision,
      });
    if (read.record.operationReplays.some(({ operationId }) =>
      operationId === input.operationId
    )) {
      return this.mutation(authentication, {
        expectedRevision: input.expectedRevision,
        operationId: input.operationId,
        operationKind: "authorize_study_first_mechanism_job",
        payload,
      }, (state) => ({
        state,
        result: currentStudyFirstMechanismRunForState(state),
      }));
    }
    if (read.record.state.revision !== input.expectedRevision) {
      return workflowProblemFailure({
        code: "revision_conflict",
        action: "authorize_study_first_mechanism_job",
        operationId: input.operationId,
        screen: 5,
        expectedRevision: input.expectedRevision,
        actualRevision: read.record.state.revision,
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        recovery: "guarded_rebase",
        safeCauseCodes: ["stale_revision"],
      });
    }
    if (
      !this.screen5OpenAIConfigurationIsValid() ||
      !this.options.screen5OpenAIApiKey ||
      !this.options.screen5OpenAIFetch ||
      !this.options.screen5OpenAILedgerStore
    ) {
      return workflowProblemFailure({
        code: "configuration_unavailable",
        action: "authorize_study_first_mechanism_job",
        operationId: input.operationId,
        screen: 5,
        expectedRevision: input.expectedRevision,
        actualRevision: read.record.state.revision,
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        recovery: "none",
        safeCauseCodes: ["configuration_unavailable"],
      });
    }
    const run = currentStudyFirstMechanismRunForState(read.record.state);
    const execution = run?.providerExecution;
    if (!run || !execution || !run.theoreticalProblem) {
      return workflowProblemFailure({
        code: "core_state_invalid",
        action: "authorize_study_first_mechanism_job",
        operationId: input.operationId,
        screen: 5,
        expectedRevision: input.expectedRevision,
        actualRevision: read.record.state.revision,
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        recovery: "none",
        safeCauseCodes: ["core_state_invalid"],
      });
    }
    if (!screen5ProviderExecutionIsCompatible(run)) {
      return workflowProblemFailure({
        code: "operation_identity_conflict",
        action: "authorize_study_first_mechanism_job",
        operationId: input.operationId,
        screen: 5,
        expectedRevision: input.expectedRevision,
        actualRevision: read.record.state.revision,
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        recovery: "none",
        safeCauseCodes: ["operation_conflict"],
      });
    }
    if (execution.executionFingerprint !== input.expectedExecutionFingerprint) {
      return workflowProblemFailure({
        code: "operation_identity_conflict",
        action: "authorize_study_first_mechanism_job",
        operationId: input.operationId,
        screen: 5,
        expectedRevision: input.expectedRevision,
        actualRevision: read.record.state.revision,
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        recovery: "none",
        safeCauseCodes: ["operation_conflict"],
      },
      "The Screen 5 job changed before authorization. Review the current saved input and try again.");
    }
    const nextStage = screen5NextInferenceStage(execution);
    if (!nextStage) {
      return workflowProblemFailure({
        code: "operation_identity_conflict",
        action: "authorize_study_first_mechanism_job",
        operationId: input.operationId,
        screen: 5,
        expectedRevision: input.expectedRevision,
        actualRevision: read.record.state.revision,
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        recovery: "none",
        safeCauseCodes: ["operation_conflict"],
      });
    }
    if (this.screen5AuthorizationMatches(execution, nextStage)) {
      return this.mutation(authentication, {
        expectedRevision: input.expectedRevision,
        operationId: input.operationId,
        operationKind: "authorize_study_first_mechanism_job",
        payload,
      }, (state) => ({ state, result: run }));
    }
    let budgetSnapshot: Screen5MechanismBudgetSnapshot;
    try {
      budgetSnapshot = await this.options.screen5OpenAILedgerStore.summary();
    } catch {
      return workflowProblemFailure({
        code: "persistence_failure",
        stage: "authorization",
        action: "authorize_study_first_mechanism_job",
        operationId: input.operationId,
        screen: 5,
        expectedRevision: input.expectedRevision,
        actualRevision: read.record.state.revision,
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        recovery: "retry_local",
        safeCauseCodes: ["persistence_failed"],
      });
    }
    const requiredTokens = nextStage === "assessment"
      ? SCREEN5_OPENAI_COMPARISON_RESERVED_TOKENS
      : SCREEN5_OPENAI_PLAN_RESERVED_TOKENS;
    if (
      budgetSnapshot.remainingAttempts < 1 ||
      budgetSnapshot.remainingTokens < requiredTokens
    ) {
      return workflowProblemFailure({
        code: "execution_failure",
        stage: "authorization",
        action: "authorize_study_first_mechanism_job",
        operationId: input.operationId,
        screen: 5,
        expectedRevision: input.expectedRevision,
        actualRevision: read.record.state.revision,
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        recovery: "none",
        safeCauseCodes: ["execution_failed"],
      });
    }
    const grantedAt = this.options.now();
    const nextAssessmentBatch = nextStage === "assessment"
      ? nextScreen5MechanismAssessmentBatch(execution)
      : null;
    const authorization: Screen5MechanismJobAuthorization = {
      schemaVersion: SCREEN5_OPENAI_JOB_AUTHORIZATION_VERSION,
      authorizationId: `screen5-ui-${fingerprintSixScreenValue({
        jobId: execution.id,
        operationId: input.operationId,
        executionFingerprint: execution.executionFingerprint,
        nextStage,
      }).slice("fnv1a64:".length)}`,
      jobId: execution.id,
      stages: nextStage === "planning"
        ? ["planning", "assessment"]
        : ["assessment"],
      assessmentBatchId: nextStage === "assessment"
        ? nextAssessmentBatch?.id ?? null
        : null,
      source: "authenticated_screen5_action",
      grantedAt,
    };
    const authorizedExecution = updateScreen5MechanismExecution(execution, {
      authorization,
      budgetSnapshot,
    }, grantedAt);
    return this.commitScreen5ProviderCheckpoint(authentication, {
      expectedRevision: input.expectedRevision,
      operationId: input.operationId,
      operationKind: "authorize_study_first_mechanism_job",
      label: "openai-job-authorized",
      previous: run,
      savedAt: grantedAt,
      patch: { providerExecution: authorizedExecution },
    });
  }

  async advanceStudyFirstMechanismJob(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      retry: boolean;
    },
  ) {
    const payload = { retry: input.retry };
    const failAdvance = (problem: Omit<
      Parameters<typeof createSixScreenWorkflowProblem>[0],
      "action" | "operationId" | "screen" | "expectedRevision"
    >, directMessage?: string): never => workflowProblemFailure(
      {
        action: "advance_study_first_mechanism_job",
        operationId: input.operationId,
        screen: 5,
        expectedRevision: input.expectedRevision,
        ...problem,
      },
      directMessage,
    );
    let initialRead: Awaited<ReturnType<SixScreenWorkflowStore["read"]>>;
    try {
      initialRead = await this.options.store.read(authentication);
    } catch {
      return workflowProblemFailure({
        code: "core_state_invalid",
        action: "advance_study_first_mechanism_job",
        operationId: input.operationId,
        screen: 5,
        expectedRevision: input.expectedRevision,
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        recovery: "none",
        safeCauseCodes: ["core_state_invalid"],
      });
    }
    if (initialRead.outcome === "unauthorized") {
      return workflowProblemFailure({
        code: "authorization",
        action: "advance_study_first_mechanism_job",
        operationId: input.operationId,
        screen: 5,
        expectedRevision: input.expectedRevision,
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        recovery: "reconnect",
        safeCauseCodes: ["authorization_failed"],
      });
    }
    if (initialRead.outcome === "not_found") {
      return workflowProblemFailure({
        code: "authorization",
        action: "advance_study_first_mechanism_job",
        operationId: input.operationId,
        screen: 5,
        expectedRevision: input.expectedRevision,
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        recovery: "reconnect",
        safeCauseCodes: ["run_unavailable"],
      });
    }
    this.requireOptionalAnalysisRecovery(initialRead.record,
      "studyFirstMechanismRuns", 5, {
        action: "advance_study_first_mechanism_job",
        operationId: input.operationId,
        expectedRevision: input.expectedRevision,
      });
    const priorOperation = initialRead.record.operationReplays.find(
      ({ operationId }) => operationId === input.operationId);
    if (priorOperation) {
      const priorResult = priorOperation.result as StudyFirstMechanismRun | null;
      return this.mutation(authentication, {
        expectedRevision: input.expectedRevision,
        operationId: input.operationId,
        operationKind: "advance_study_first_mechanism_job",
        payload: priorResult?.runFingerprint
          ? { retry: input.retry, resultFingerprint: priorResult.runFingerprint }
          : payload,
      }, (state) => ({
        state,
        result: currentStudyFirstMechanismRunForState(state),
      }));
    }
    if (initialRead.record.state.revision !== input.expectedRevision) {
      const activeRun = currentStudyFirstMechanismRunForState(
        initialRead.record.state,
      );
      if (
        input.expectedRevision < initialRead.record.state.revision &&
        (activeRun?.providerExecution?.phase === "planning_running" ||
          activeRun?.providerExecution?.phase === "assessment_running")
      ) {
        return this.completeScreen5Advance(authentication, {
          expectedRevision: initialRead.record.state.revision,
          operationId: input.operationId,
          retry: input.retry,
          result: activeRun,
        });
      }
      return workflowProblemFailure({
        code: "revision_conflict",
        action: "advance_study_first_mechanism_job",
        operationId: input.operationId,
        screen: 5,
        expectedRevision: input.expectedRevision,
        actualRevision: initialRead.record.state.revision,
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        recovery: "guarded_rebase",
        safeCauseCodes: ["stale_revision"],
      });
    }
    const providerFetch = this.options.screen5OpenAIFetch;
    let workflow = initialRead.record.state;
    let run = currentStudyFirstMechanismRunForState(workflow);
    if (!run?.providerExecution || !run.theoreticalProblem) {
      return workflowProblemFailure({
        code: "core_state_invalid",
        action: "advance_study_first_mechanism_job",
        operationId: input.operationId,
        screen: 5,
        expectedRevision: input.expectedRevision,
        actualRevision: workflow.revision,
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        recovery: "none",
        safeCauseCodes: ["core_state_invalid"],
      });
    }
    if (!screen5ProviderExecutionIsCompatible(run)) {
      return workflowProblemFailure({
        code: "operation_identity_conflict",
        action: "advance_study_first_mechanism_job",
        operationId: input.operationId,
        screen: 5,
        expectedRevision: input.expectedRevision,
        actualRevision: workflow.revision,
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        recovery: "none",
        safeCauseCodes: ["operation_conflict"],
      });
    }
    let execution = run.providerExecution;
    const ledger = this.options.screen5OpenAILedgerStore;

    // Reconcile every metered checkpoint before spending another reservation.
    if (ledger) {
      for (const attempt of execution.attempts) {
        if (attempt.usage) {
          try {
            await ledger.settle({
              reservationId: attempt.id,
              usage: attempt.usage,
              now: this.options.now(),
            });
          } catch {
            // A held reservation is conservative. Do not block restoration or
            // silently reclaim it when durable settlement cannot be confirmed.
          }
        }
      }
    }
    let budgetSnapshot = execution.budgetSnapshot;
    if (ledger) {
      try {
        budgetSnapshot = await ledger.summary();
      } catch {
        // Local receipt replay remains available when accounting storage is
        // temporarily unavailable. A new reservation still fails closed.
      }
    }

    if (
      execution.phase === "planning_running" ||
      execution.phase === "assessment_running"
    ) {
      return this.completeScreen5Advance(authentication, {
        expectedRevision: workflow.revision,
        operationId: input.operationId,
        retry: input.retry,
        result: run,
      });
    }

    const latestAttempt = execution.attempts.at(-1);
    const receiptReplayAttempt = latestAttempt?.responseReceipt &&
        !latestAttempt.wireCheckpoint
      ? latestAttempt
      : undefined;
    if (receiptReplayAttempt?.responseReceipt) {
      const receipt = receiptReplayAttempt.responseReceipt;
      const replayValidation = validateSavedScreen5Receipt({
        run,
        execution,
        attempt: receiptReplayAttempt,
      });
      const quarantineReceipt = async (
        issues: Screen5MechanismValidationIssue[],
      ) => {
        if (receipt.status === "quarantined" && receiptReplayAttempt.status === "failed" &&
          receipt.validationIssues.some(({ validationRevision }) => validationRevision ===
            (receiptReplayAttempt.stage === "planning" ? SCREEN5_PLAN_VALIDATION_REVISION
              : SCREEN5_ASSESSMENT_VALIDATION_REVISION))) {
          return this.completeScreen5Advance(authentication, {
            expectedRevision: workflow.revision,
            operationId: input.operationId,
            retry: input.retry,
            result: run!,
          });
        }
        const quarantinedAt = this.options.now();
        const attempts = structuredClone(execution.attempts);
        const quarantinedAttempt = attempts.find(({ id }) =>
          id === receiptReplayAttempt.id);
        if (!quarantinedAttempt) {
          return failAdvance({
            code: "core_state_invalid",
            stage: "execution",
            actualRevision: workflow.revision,
            commitCertainty: "committed",
            dispatchCertainty: "dispatched",
            recovery: "restore_local_artifact",
            safeCauseCodes: ["core_state_invalid"],
          });
        }
        Object.assign(quarantinedAttempt, {
          validationHistory: [...(quarantinedAttempt.validationHistory ?? []),
            ...(receipt.validationIssues.length ? [receipt.validationIssues] : [])],
          status: "failed" as const,
          completedAt: quarantinedAt,
          providerRequestId: receipt.providerRequestId,
          providerResponseId: receipt.providerResponseId ?? null,
          serviceTier: receipt.serviceTier ?? null,
          latencyMs: receipt.latencyMs ?? null,
          modelObserved: receipt.modelObserved,
          finishReason: receipt.finishReason,
          usage: receipt.usage,
          rateLimit: receipt.rateLimit,
          errorCode: "provider_schema_invalid",
          retryable: false,
          failureStage: "model_output" as const,
          networkInvocation: "invoked" as const,
          providerResponse: "observed" as const,
          httpStatus: receipt.httpStatus,
          safeCause: "provider_schema_invalid",
          responseReceipt: updateScreen5MechanismProviderReceipt(receipt, {
            status: "quarantined",
            validationIssues: issues,
            wireFingerprint: null,
          }),
        });
        execution = updateScreen5MechanismExecution(execution, {
          phase: "failed",
          attempts,
          budgetSnapshot,
          nextEligibleAt: receipt.rateLimit.retryAfterAt,
          lastError: {
            stage: receiptReplayAttempt.stage,
            code: "provider_schema_invalid",
            message:
              "The saved final response still violates the bounded Screen 5 contract. Its private receipt and observed usage remain available for a later deterministic repair.",
            retryable: false,
            occurredAt: quarantinedAt,
            failureStage: "model_output",
            networkInvocation: "invoked",
            providerResponse: "observed",
            httpStatus: receipt.httpStatus,
            safeCause: "provider_schema_invalid",
          },
        }, quarantinedAt);
        const checkpoint = await this.commitScreen5ProviderCheckpoint(
          authentication,
          {
            expectedRevision: workflow.revision,
            operationId:
              `${input.operationId}:receipt-quarantine:${receiptReplayAttempt.ordinal}`,
            operationKind: receiptReplayAttempt.stage === "planning"
              ? "checkpoint_screen5_openai_planning_failure"
              : "checkpoint_screen5_openai_assessment_failure",
            label: receiptReplayAttempt.stage === "planning"
              ? "openai-planning-failed"
              : "openai-assessment-failed",
            previous: run!,
            savedAt: quarantinedAt,
            patch: { providerExecution: execution },
          },
        );
        if (ledger) {
          try {
            await ledger.settle({
              reservationId: receiptReplayAttempt.id,
              usage: receipt.usage,
              now: this.options.now(),
            });
          } catch {
            // Preserve the conservative reservation when settlement is unclear.
          }
        }
        run = checkpoint.result as StudyFirstMechanismRun;
        return this.completeScreen5Advance(authentication, {
          expectedRevision: checkpoint.privateSnapshot.state.revision,
          operationId: input.operationId,
          retry: input.retry,
          result: run,
        });
      };

      if (replayValidation.outcome === "invalid") {
        return quarantineReceipt(replayValidation.issues);
      }
      if (replayValidation.outcome === "valid" &&
          replayValidation.stage === "planning") {
        const replayedAt = this.options.now();
        let plan;
        try {
          plan = screen5MechanismPlanFromWire({
            wire: replayValidation.wire,
            context: run.context,
            problem: run.theoreticalProblem,
          });
        } catch {
          return quarantineReceipt([{
            code: "bounded_contract_failed",
            path: "$",
          }]);
        }
        const wireFingerprint = fingerprintSixScreenValue(
          replayValidation.wire,
        );
        const attempts = structuredClone(execution.attempts);
        const replayedAttempt = attempts.find(({ id }) =>
          id === receiptReplayAttempt.id);
        if (!replayedAttempt) {
          return failAdvance({
            code: "core_state_invalid",
            stage: "execution",
            actualRevision: workflow.revision,
            commitCertainty: "committed",
            dispatchCertainty: "dispatched",
            recovery: "restore_local_artifact",
            safeCauseCodes: ["core_state_invalid"],
          });
        }
        Object.assign(replayedAttempt, {
          validationHistory: [...(replayedAttempt.validationHistory ?? []),
            ...(receipt.validationIssues.length ? [receipt.validationIssues] : [])],
          status: "succeeded" as const,
          completedAt: replayedAt,
          providerRequestId: receipt.providerRequestId,
          providerResponseId: receipt.providerResponseId ?? null,
          serviceTier: receipt.serviceTier ?? null,
          latencyMs: receipt.latencyMs ?? null,
          modelObserved: receipt.modelObserved,
          finishReason: receipt.finishReason,
          usage: receipt.usage,
          rateLimit: receipt.rateLimit,
          errorCode: null,
          retryable: false,
          failureStage: undefined,
          networkInvocation: "invoked" as const,
          providerResponse: "observed" as const,
          httpStatus: receipt.httpStatus,
          safeCause: null,
          responseReceipt: updateScreen5MechanismProviderReceipt(receipt, {
            status: "aggregate_saved",
            validationIssues: [],
            wireFingerprint,
          }),
          wireCheckpoint: {
            kind: "planning" as const,
            version: execution.planWireVersion,
            value: replayValidation.wire,
            fingerprint: wireFingerprint,
          },
        });
        execution = updateScreen5MechanismExecution(execution, {
          phase: "plan_ready",
          attempts,
          budgetSnapshot,
          nextEligibleAt: screen5MechanismEarliestAssessmentAt({
            completedAt: receipt.receivedAt,
            retryAfterAt: receipt.rateLimit.retryAfterAt,
            tokenResetAt: receipt.rateLimit.tokenResetAt,
          }),
          lastError: null,
        }, replayedAt);
        const checkpoint = await this.commitScreen5ProviderCheckpoint(
          authentication,
          {
            expectedRevision: workflow.revision,
            operationId:
              `${input.operationId}:planning-receipt-replay:${receiptReplayAttempt.ordinal}`,
            operationKind: "checkpoint_screen5_openai_planning_result",
            label: "openai-plan-replayed",
            previous: run,
            savedAt: replayedAt,
            patch: {
              planning: {
                status: "completed",
                origin: "openai",
                taskId: null,
                resultId: null,
                providerAttemptId: receiptReplayAttempt.id,
                plan,
                limitation:
                  "This validated direct-provider plan is pre-retrieval model analysis, not a scholarly finding or researcher decision.",
              },
              providerExecution: execution,
            },
          },
        );
        if (ledger) {
          try {
            await ledger.settle({
              reservationId: receiptReplayAttempt.id,
              usage: receipt.usage,
              now: this.options.now(),
            });
          } catch {
            // The private receipt remains authoritative for later reconciliation.
          }
        }
        run = checkpoint.result as StudyFirstMechanismRun;
        return this.completeScreen5Advance(authentication, {
          expectedRevision: checkpoint.privateSnapshot.state.revision,
          operationId: input.operationId,
          retry: input.retry,
          result: run,
        });
      }
      if (replayValidation.outcome === "valid" &&
          replayValidation.stage === "assessment") {
        const replayedAt = this.options.now();
        const plan = run.planning?.plan;
        const problem = run.theoreticalProblem;
        const evidencePacket = execution.evidencePacket;
        const batchPlan = execution.assessmentBatchPlan;
        if (!plan || !problem || !evidencePacket || !batchPlan) {
          return failAdvance({
            code: "core_state_invalid",
            stage: "execution",
            actualRevision: workflow.revision,
            commitCertainty: "committed",
            dispatchCertainty: "dispatched",
            recovery: "restore_local_artifact",
            safeCauseCodes: ["core_state_invalid"],
          });
        }
        const wireFingerprint = fingerprintSixScreenValue(
          replayValidation.wire,
        );
        const attempts = structuredClone(execution.attempts);
        const replayedAttempt = attempts.find(({ id }) =>
          id === receiptReplayAttempt.id);
        if (!replayedAttempt) {
          return failAdvance({
            code: "core_state_invalid",
            stage: "execution",
            actualRevision: workflow.revision,
            commitCertainty: "committed",
            dispatchCertainty: "dispatched",
            recovery: "restore_local_artifact",
            safeCauseCodes: ["core_state_invalid"],
          });
        }
        Object.assign(replayedAttempt, {
          validationHistory: [...(replayedAttempt.validationHistory ?? []),
            ...(receipt.validationIssues.length ? [receipt.validationIssues] : [])],
          status: "succeeded" as const,
          completedAt: replayedAt,
          providerRequestId: receipt.providerRequestId,
          providerResponseId: receipt.providerResponseId ?? null,
          serviceTier: receipt.serviceTier ?? null,
          latencyMs: receipt.latencyMs ?? null,
          modelObserved: receipt.modelObserved,
          finishReason: receipt.finishReason,
          usage: receipt.usage,
          rateLimit: receipt.rateLimit,
          errorCode: null,
          retryable: false,
          failureStage: undefined,
          networkInvocation: "invoked" as const,
          providerResponse: "observed" as const,
          httpStatus: receipt.httpStatus,
          safeCause: null,
          responseReceipt: updateScreen5MechanismProviderReceipt(receipt, {
            status: "schema_valid",
            validationIssues: [],
            wireFingerprint,
          }),
          wireCheckpoint: {
            kind: "assessment" as const,
            version: SCREEN5_MECHANISM_COMPARISON_WIRE_VERSION,
            value: replayValidation.wire,
            fingerprint: wireFingerprint,
          },
        });
        const batchWires = [
          ...savedScreen5AssessmentBatches(execution),
          {
            batchId: replayValidation.batchId,
            wire: replayValidation.wire,
            selectedEvidenceIds: [...(receiptReplayAttempt.evidenceIds ?? [])],
            omittedEvidenceIds: [
              ...(receiptReplayAttempt.omittedEvidenceIds ?? []),
            ],
          },
        ];
        let comparison;
        try {
          comparison = createScreen5MechanismComparison({
            id: `screen5-comparison-${fingerprintSixScreenValue({
              job: execution.id,
              receipt: receipt.contentFingerprint,
            }).slice("fnv1a64:".length)}`,
            problemFingerprint: problem.problemFingerprint,
            focalText: run.input.proposedMechanism,
            plan,
            evidencePacket,
            batchPlan,
            batchWires,
            modelObserved: receipt.modelObserved,
            createdAt: replayedAt,
          });
        } catch {
          execution = updateScreen5MechanismExecution(execution, {
            phase: "blocked",
            attempts,
            budgetSnapshot,
            lastError: {
              stage: "validation",
              code: "receipt_saved_merge_pending",
              message:
                "The saved Stage B response now validates, but aggregate projection is pending local replay. No provider request is needed.",
              retryable: false,
              occurredAt: replayedAt,
              failureStage: "projection",
              networkInvocation: "not_started",
              providerResponse: "observed",
              safeCause: "aggregate_merge_failed",
            },
          }, replayedAt);
          const blocked = await this.commitScreen5ProviderCheckpoint(
            authentication,
            {
              expectedRevision: workflow.revision,
              operationId:
                `${input.operationId}:assessment-receipt-replay-pending:${receiptReplayAttempt.ordinal}`,
              operationKind:
                "checkpoint_screen5_openai_assessment_merge_pending",
              label: "openai-assessment-merge-pending",
              previous: run,
              savedAt: replayedAt,
              patch: { providerExecution: execution },
            },
          );
          if (ledger) {
            try {
              await ledger.settle({
                reservationId: receiptReplayAttempt.id,
                usage: receipt.usage,
                now: this.options.now(),
              });
            } catch {
              // Preserve the conservative reservation when settlement is unclear.
            }
          }
          run = blocked.result as StudyFirstMechanismRun;
          return this.completeScreen5Advance(authentication, {
            expectedRevision: blocked.privateSnapshot.state.revision,
            operationId: input.operationId,
            retry: input.retry,
            result: run,
          });
        }
        const aggregateAttempt = attempts.find(({ id }) =>
          id === receiptReplayAttempt.id);
        if (aggregateAttempt?.responseReceipt) {
          aggregateAttempt.responseReceipt = updateScreen5MechanismProviderReceipt(
            aggregateAttempt.responseReceipt,
            { status: "aggregate_saved" },
          );
        }
        const comparisonComplete = comparison.completion?.status === "completed";
        execution = updateScreen5MechanismExecution(execution, {
          phase: comparisonComplete ? "completed" : "waiting_for_rate_limit",
          attempts,
          budgetSnapshot,
          comparison,
          nextEligibleAt: comparisonComplete
            ? null
            : screen5MechanismEarliestAssessmentAt({
                completedAt: receipt.receivedAt,
                retryAfterAt: receipt.rateLimit.retryAfterAt,
                tokenResetAt: receipt.rateLimit.tokenResetAt,
              }),
          lastError: null,
        }, replayedAt);
        const checkpoint = await this.commitScreen5ProviderCheckpoint(
          authentication,
          {
            expectedRevision: workflow.revision,
            operationId:
              `${input.operationId}:assessment-receipt-replay:${receiptReplayAttempt.ordinal}`,
            operationKind: "checkpoint_screen5_openai_assessment_result",
            label: comparisonComplete
              ? "openai-comparison-replayed"
              : "openai-comparison-partial-replayed",
            previous: run,
            savedAt: replayedAt,
            patch: {
              providerExecution: execution,
              phases: {
                retrieval: run.phases?.retrieval ?? "complete",
                textInspection: run.phases?.textInspection ?? "partial",
                screening: run.phases?.screening ?? "complete",
                synthesis: comparisonComplete ? "complete" : "pending",
                validation: comparisonComplete ? "complete" : "pending",
                presentation: comparisonComplete ? "complete" : "partial",
              },
            },
          },
        );
        if (ledger) {
          try {
            await ledger.settle({
              reservationId: receiptReplayAttempt.id,
              usage: receipt.usage,
              now: this.options.now(),
            });
          } catch {
            // The private receipt remains authoritative for later reconciliation.
          }
        }
        run = checkpoint.result as StudyFirstMechanismRun;
        return this.completeScreen5Advance(authentication, {
          expectedRevision: checkpoint.privateSnapshot.state.revision,
          operationId: input.operationId,
          retry: input.retry,
          result: run,
        });
      }
    }

    const savedPlanning = execution.attempts.find((attempt) =>
      attempt.stage === "planning" && attempt.status === "succeeded" &&
      attempt.wireCheckpoint?.kind === "planning");
    if (!run.planning?.plan && savedPlanning?.wireCheckpoint?.kind === "planning") {
      // A crash after validation but before proposal materialization is a
      // local checkpoint recovery, including when the surrounding phase failed.
      const restoredAt = this.options.now();
      const validated = validateScreen5MechanismPlanWire(
        savedPlanning.wireCheckpoint.value, savedPlanning.wireCheckpoint.version);
      const plan = screen5MechanismPlanFromWire({
        wire: validated, context: run.context, problem: run.theoreticalProblem,
      });
      execution = updateScreen5MechanismExecution(execution, {
        phase: "plan_ready", budgetSnapshot, lastError: null,
      }, restoredAt);
      const restored = await this.commitScreen5ProviderCheckpoint(authentication, {
        expectedRevision: workflow.revision,
        operationId: `${input.operationId}:planning-checkpoint-restore`,
        operationKind: "checkpoint_screen5_openai_planning_result",
        label: "openai-plan-restored",
        previous: run, savedAt: restoredAt,
        patch: { planning: { status: "completed", origin: "openai",
          taskId: null, resultId: null, providerAttemptId: savedPlanning.id,
          plan, limitation: "Restored from the original validated provider checkpoint; no new model request or scholarly finding." },
          providerExecution: execution },
      });
      run = restored.result as StudyFirstMechanismRun;
      return this.completeScreen5Advance(authentication, {
        expectedRevision: restored.privateSnapshot.state.revision,
        operationId: input.operationId, retry: input.retry, result: run,
      });
    }

    if (execution.phase === "failed" || execution.phase === "outcome_unknown") {
      if (!input.retry) {
        return this.completeScreen5Advance(authentication, {
          expectedRevision: workflow.revision,
          operationId: input.operationId,
          retry: false,
          result: run,
        });
      }
      if (!execution.lastError?.retryable || execution.retryCount >= 1) {
        return failAdvance({
          code: "execution_failure",
          stage: "authorization",
          actualRevision: workflow.revision,
          commitCertainty: "not_committed",
          dispatchCertainty: "not_dispatched",
          recovery: "none",
          safeCauseCodes: ["execution_failed"],
        });
      }
      const retryAt = this.options.now();
      if (
        execution.lastError.stage !== "retrieval" &&
        execution.nextEligibleAt !== null &&
        Date.parse(retryAt) < Date.parse(execution.nextEligibleAt)
      ) {
        return failAdvance({
          code: "execution_failure",
          stage: "authorization",
          actualRevision: workflow.revision,
          commitCertainty: "not_committed",
          dispatchCertainty: "not_dispatched",
          recovery: "none",
          safeCauseCodes: ["execution_failed"],
        }, `This Screen 5 retry is not eligible before ${execution.nextEligibleAt}.`);
      }
      const retryPhase = execution.lastError.stage === "assessment"
        ? "evidence_ready" as const
        : execution.lastError.stage === "retrieval"
          ? "plan_ready" as const
          : "planning_queued" as const;
      execution = updateScreen5MechanismExecution(execution, {
        phase: retryPhase,
        retryCount: execution.lastError.stage === "retrieval"
          ? execution.retryCount
          : execution.retryCount + 1,
        lastError: null,
        budgetSnapshot,
      }, retryAt);
      run = updateStudyFirstMechanismRun(run, {
        providerExecution: execution,
      });
    }

    if (
      execution.phase === "blocked" &&
      execution.lastError?.code === "receipt_saved_merge_pending"
    ) {
      const replayedAt = this.options.now();
      const plan = run.planning?.plan;
      const problem = run.theoreticalProblem;
      const evidencePacket = execution.evidencePacket;
      const batchPlan = execution.assessmentBatchPlan;
      if (!plan || !problem || !evidencePacket || !batchPlan) {
        return failAdvance({
          code: "core_state_invalid",
          stage: "execution",
          actualRevision: workflow.revision,
          commitCertainty: "committed",
          dispatchCertainty: "dispatched",
          recovery: "restore_local_artifact",
          safeCauseCodes: ["core_state_invalid"],
        });
      }
      const batchWires = execution.attempts.flatMap((savedAttempt) => {
        const checkpoint = savedAttempt.wireCheckpoint;
        if (
          savedAttempt.stage !== "assessment" ||
          savedAttempt.status !== "succeeded" ||
          !savedAttempt.assessmentBatchId ||
          checkpoint?.kind !== "assessment" ||
          (checkpoint.version !== SCREEN5_MECHANISM_COMPARISON_WIRE_VERSION &&
            checkpoint.version !== HISTORICAL_SCREEN5_COMPARISON_WIRE_VERSION &&
            checkpoint.version !== HISTORICAL_SCREEN5_V2_COMPARISON_WIRE_VERSION)
        ) return [];
        return [{
          batchId: savedAttempt.assessmentBatchId,
          wire: checkpoint.value as Screen5MechanismComparisonWire,
          selectedEvidenceIds: [...(savedAttempt.evidenceIds ?? [])],
          omittedEvidenceIds: [...(savedAttempt.omittedEvidenceIds ?? [])],
        }];
      });
      const modelObserved = [...execution.attempts].reverse().find((attempt) =>
        attempt.stage === "assessment" && attempt.modelObserved
      )?.modelObserved;
      if (!batchWires.length || !modelObserved) {
        return failAdvance({
          code: "core_state_invalid",
          stage: "execution",
          actualRevision: workflow.revision,
          commitCertainty: "committed",
          dispatchCertainty: "dispatched",
          recovery: "restore_local_artifact",
          safeCauseCodes: ["source_receipt_unavailable"],
        });
      }
      let comparison;
      try {
        comparison = createScreen5MechanismComparison({
          id: `screen5-comparison-${fingerprintSixScreenValue({
            job: execution.id,
            replay: batchWires.map(({ batchId }) => batchId),
          }).slice("fnv1a64:".length)}`,
          problemFingerprint: problem.problemFingerprint,
          focalText: run.input.proposedMechanism,
          plan,
          evidencePacket,
          batchPlan,
          batchWires,
          modelObserved,
          createdAt: replayedAt,
        });
      } catch {
        return this.completeScreen5Advance(authentication, {
          expectedRevision: workflow.revision,
          operationId: input.operationId,
          retry: input.retry,
          result: run,
        });
      }
      const attempts = structuredClone(execution.attempts);
      for (const savedAttempt of attempts) {
        if (savedAttempt.responseReceipt?.status === "schema_valid") {
          savedAttempt.responseReceipt = updateScreen5MechanismProviderReceipt(
            savedAttempt.responseReceipt,
            { status: "aggregate_saved" },
          );
        }
      }
      const comparisonComplete = comparison.completion?.status === "completed";
      const latestAssessment = [...attempts].reverse().find(({ stage }) =>
        stage === "assessment");
      execution = updateScreen5MechanismExecution(execution, {
        phase: comparisonComplete ? "completed" : "waiting_for_rate_limit",
        attempts,
        comparison,
        nextEligibleAt: comparisonComplete || !latestAssessment?.completedAt
          ? null
          : screen5MechanismEarliestAssessmentAt({
              completedAt: latestAssessment.completedAt,
              retryAfterAt: latestAssessment.rateLimit?.retryAfterAt ?? null,
              tokenResetAt: latestAssessment.rateLimit?.tokenResetAt ?? null,
            }),
        lastError: null,
      }, replayedAt);
      const checkpoint = await this.commitScreen5ProviderCheckpoint(
        authentication,
        {
          expectedRevision: workflow.revision,
          operationId: `${input.operationId}:assessment-aggregate-replay`,
          operationKind: "checkpoint_screen5_openai_assessment_result",
          label: comparisonComplete
            ? "openai-comparison-replayed"
            : "openai-comparison-partial-replayed",
          previous: run,
          savedAt: replayedAt,
          patch: {
            providerExecution: execution,
            phases: {
              retrieval: run.phases?.retrieval ?? "complete",
              textInspection: run.phases?.textInspection ?? "partial",
              screening: run.phases?.screening ?? "complete",
              synthesis: comparisonComplete ? "complete" : "pending",
              validation: comparisonComplete ? "complete" : "pending",
              presentation: comparisonComplete ? "complete" : "partial",
            },
          },
        },
      );
      run = checkpoint.result as StudyFirstMechanismRun;
      return this.completeScreen5Advance(authentication, {
        expectedRevision: checkpoint.privateSnapshot.state.revision,
        operationId: input.operationId,
        retry: input.retry,
        result: run,
      });
    }

    if (
      execution.phase === "completed" || execution.phase === "superseded"
    ) {
      return this.completeScreen5Advance(authentication, {
        expectedRevision: workflow.revision,
        operationId: input.operationId,
        retry: input.retry,
        result: run,
      });
    }

    if (
      !this.screen5OpenAIConfigurationIsValid() ||
      !this.options.screen5OpenAIApiKey ||
      !providerFetch ||
      !ledger
    ) {
      return workflowProblemFailure({
        code: "configuration_unavailable",
        action: "advance_study_first_mechanism_job",
        operationId: input.operationId,
        screen: 5,
        expectedRevision: input.expectedRevision,
        actualRevision: workflow.revision,
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        recovery: "none",
        safeCauseCodes: ["configuration_unavailable"],
      },
      "Direct Screen 5 inference is not enabled with a valid server-only pilot configuration.");
    }

    if (execution.phase === "planning_queued") {
      const savedAt = this.options.now();
      const planningProblem = run.theoreticalProblem;
      if (!planningProblem) {
        return workflowProblemFailure({
          code: "core_state_invalid",
          action: "advance_study_first_mechanism_job",
          operationId: input.operationId,
          screen: 5,
          expectedRevision: input.expectedRevision,
          actualRevision: workflow.revision,
          commitCertainty: "not_committed",
          dispatchCertainty: "not_dispatched",
          recovery: "none",
          safeCauseCodes: ["core_state_invalid"],
        });
      }
      const estimatedInputTokens = screen5MechanismPlanningInputEstimate({
        context: run.context,
        mechanismInput: run.input,
        problem: planningProblem,
      });
      if (estimatedInputTokens > SCREEN5_OPENAI_PLAN_INPUT_CEILING) {
        execution = updateScreen5MechanismExecution(execution, {
          phase: "failed",
          budgetSnapshot,
          lastError: {
            stage: "planning",
            code: "input_budget_exceeded",
            message:
              "The Stage A request does not fit the approved input profile; no inference request was sent.",
            retryable: false,
            occurredAt: savedAt,
          },
        }, savedAt);
        const checkpoint = await this.commitScreen5ProviderCheckpoint(
          authentication,
          {
            expectedRevision: workflow.revision,
            operationId: `${input.operationId}:budget-failure`,
            operationKind: "checkpoint_screen5_openai_planning_failure",
            label: "openai-planning-failed",
            previous: run,
            savedAt,
            patch: { providerExecution: execution },
          },
        );
        run = checkpoint.result as StudyFirstMechanismRun;
        return this.completeScreen5Advance(authentication, {
          expectedRevision: checkpoint.privateSnapshot.state.revision,
          operationId: input.operationId,
          retry: input.retry,
          result: run,
        });
      }
      if (!this.screen5AuthorizationMatches(execution, "planning")) {
        return workflowProblemFailure({
          code: "authorization",
          stage: "authorization",
          action: "advance_study_first_mechanism_job",
          operationId: input.operationId,
          screen: 5,
          expectedRevision: input.expectedRevision,
          actualRevision: workflow.revision,
          commitCertainty: "not_committed",
          dispatchCertainty: "not_dispatched",
          recovery: "none",
          safeCauseCodes: ["authorization_failed"],
        },
        "Stage A requires a current exact execution authorization for this saved OpenAI job; no provider request was sent.");
      }
      const planningAuthorization = this.screen5AuthorizationForStage(
        execution,
        "planning",
      )!;
      const attempt = screen5MechanismAttempt({
        execution,
        stage: "planning",
        reservedTokens: SCREEN5_OPENAI_PLAN_RESERVED_TOKENS,
        estimatedInputTokens,
        maxCompletionTokens: SCREEN5_OPENAI_PLAN_OUTPUT_CEILING,
        authorizationId: planningAuthorization.authorizationId,
        now: savedAt,
      });
      try {
        budgetSnapshot = await ledger.reserve({
          reservationId: attempt.id,
          jobId: execution.id,
          stage: attempt.stage,
          reservedTokens: attempt.reservedTokens,
          now: savedAt,
        });
      } catch {
        execution = updateScreen5MechanismExecution(execution, {
          phase: "failed",
          budgetSnapshot,
          lastError: {
            stage: "planning",
            code: "pilot_allowance_unavailable",
            message:
              "The persistent OpenAI local-preview allowance cannot admit this Stage A reservation.",
            retryable: false,
            occurredAt: savedAt,
          },
        }, savedAt);
        const checkpoint = await this.commitScreen5ProviderCheckpoint(
          authentication,
          {
            expectedRevision: workflow.revision,
            operationId: `${input.operationId}:allowance-failure`,
            operationKind: "checkpoint_screen5_openai_planning_failure",
            label: "openai-planning-failed",
            previous: run,
            savedAt,
            patch: { providerExecution: execution },
          },
        );
        run = checkpoint.result as StudyFirstMechanismRun;
        return this.completeScreen5Advance(authentication, {
          expectedRevision: checkpoint.privateSnapshot.state.revision,
          operationId: input.operationId,
          retry: input.retry,
          result: run,
        });
      }
      execution = updateScreen5MechanismExecution(execution, {
        phase: "planning_running",
        attempts: [...execution.attempts, attempt],
        budgetSnapshot,
        lastError: null,
      }, savedAt);
      const running = await this.commitScreen5ProviderCheckpoint(
        authentication,
        {
          expectedRevision: workflow.revision,
          operationId: `${input.operationId}:planning-running:${attempt.ordinal}`,
          operationKind: "checkpoint_screen5_openai_planning_running",
          label: "openai-planning-running",
          previous: run,
          savedAt,
          patch: { providerExecution: execution },
        },
      );
      workflow = running.privateSnapshot.state;
      run = running.result as StudyFirstMechanismRun;
      execution = run.providerExecution!;
      try {
        const response = await requestScreen5OpenAIPlan({
          apiKey: this.options.screen5OpenAIApiKey,
          fetch: providerFetch,
          context: run.context,
          mechanismInput: run.input,
          problem: run.theoreticalProblem!,
          now: this.options.now,
          onReceipt: async (receipt: Screen5MechanismProviderReceipt) => {
            const attempts = structuredClone(execution.attempts);
            const receivedAttempt = attempts.find(({ id }) => id === attempt.id);
            if (!receivedAttempt) {
              throw new Error("The active Stage A attempt is unavailable.");
            }
            Object.assign(receivedAttempt, {
              providerRequestId: receipt.providerRequestId,
              providerResponseId: receipt.providerResponseId ?? null,
              serviceTier: receipt.serviceTier ?? null,
              latencyMs: receipt.latencyMs ?? null,
              modelObserved: receipt.modelObserved,
              finishReason: receipt.finishReason,
              usage: receipt.usage,
              rateLimit: receipt.rateLimit,
              responseReceipt: receipt,
            });
            execution = updateScreen5MechanismExecution(execution, {
              phase: "validating",
              attempts,
              lastError: null,
            }, receipt.receivedAt);
            const receiptCheckpoint = await this.commitScreen5ProviderCheckpoint(
              authentication,
              {
                expectedRevision: workflow.revision,
                operationId:
                  `${input.operationId}:planning-receipt:${attempt.ordinal}`,
                operationKind: "checkpoint_screen5_openai_planning_receipt",
                label: "openai-planning-receipted",
                previous: run!,
                savedAt: receipt.receivedAt,
                patch: { providerExecution: execution },
              },
            );
            workflow = receiptCheckpoint.privateSnapshot.state;
            run = receiptCheckpoint.result as StudyFirstMechanismRun;
            execution = run.providerExecution!;
          },
        });
        const completedAt = this.options.now();
        const plan = screen5MechanismPlanFromWire({
          wire: response.wire,
          context: run.context,
          problem: run.theoreticalProblem!,
        });
        const attempts = structuredClone(execution.attempts);
        const completedAttempt = attempts.find(({ id }) => id === attempt.id) ??
          attempts.at(-1)!;
        const wireFingerprint = fingerprintSixScreenValue(response.wire);
        Object.assign(completedAttempt, {
          status: "succeeded" as const,
          completedAt,
          providerRequestId: response.providerRequestId,
          providerResponseId: response.providerResponseId,
          serviceTier: response.serviceTier,
          latencyMs: response.latencyMs,
          modelObserved: response.modelObserved,
          finishReason: response.finishReason,
          usage: response.usage,
          rateLimit: response.rateLimit,
          errorCode: null,
          retryable: false,
          responseReceipt: updateScreen5MechanismProviderReceipt(
            completedAttempt.responseReceipt ?? response.receipt,
            {
              status: "aggregate_saved",
              validationIssues: [],
              wireFingerprint,
            },
          ),
          wireCheckpoint: {
            kind: "planning" as const,
            version: execution.planWireVersion,
            value: response.wire,
            fingerprint: wireFingerprint,
          },
        });
        execution = updateScreen5MechanismExecution(execution, {
          phase: "plan_ready",
          attempts,
          nextEligibleAt: screen5MechanismEarliestAssessmentAt({
            completedAt,
            retryAfterAt: response.rateLimit.retryAfterAt,
            tokenResetAt: response.rateLimit.tokenResetAt,
          }),
          lastError: null,
        }, completedAt);
        const checkpoint = await this.commitScreen5ProviderCheckpoint(
          authentication,
          {
            expectedRevision: workflow.revision,
            operationId: `${input.operationId}:planning-checkpoint:${attempt.ordinal}`,
            operationKind: "checkpoint_screen5_openai_planning_result",
            label: "openai-plan-ready",
            previous: run,
            savedAt: completedAt,
            patch: {
              planning: {
                status: "completed",
                origin: "openai",
                taskId: null,
                resultId: null,
                providerAttemptId: attempt.id,
                plan,
                limitation:
                  "This validated direct-provider plan is pre-retrieval model analysis, not a scholarly finding or researcher decision.",
              },
              providerExecution: execution,
            },
          },
        );
        try {
          await ledger.settle({
            reservationId: attempt.id,
            usage: response.usage,
            now: this.options.now(),
          });
        } catch {
          // The reservation stays held when settlement cannot be proven.
        }
        run = checkpoint.result as StudyFirstMechanismRun;
        return this.completeScreen5Advance(authentication, {
          expectedRevision: checkpoint.privateSnapshot.state.revision,
          operationId: input.operationId,
          retry: input.retry,
          result: run,
        });
      } catch (caught) {
        const completedAt = this.options.now();
        const error = caught instanceof Screen5OpenAIProviderError
          ? caught
          : new Screen5OpenAIProviderError(
              "Stage A failed before a validated provider result was saved.",
              {
                code: "planning_validation_failed",
                retryable: false,
                outcomeKnown: true,
                dispatched: true,
                usage: null,
                rateLimit: null,
                providerRequestId: null,
                providerResponseId: null,
                serviceTier: null,
                latencyMs: null,
                modelObserved: null,
                finishReason: null,
                failureStage: "model_output",
                networkInvocation: "invoked",
                providerResponse: "observed",
              },
            );
        const diagnostic = screen5ProviderFailureDiagnostic(error);
        if (diagnostic.networkInvocation === "not_started") {
          try {
            budgetSnapshot = await ledger.release({
              reservationId: attempt.id,
              reasonCode: diagnostic.safeCause,
              now: completedAt,
            });
          } catch {
            // A failed reconciliation stays conservatively held.
          }
        }
        const attempts = structuredClone(execution.attempts);
        const failedAttempt = attempts.find(({ id }) => id === attempt.id) ??
          attempts.at(-1)!;
        const receivedReceipt = failedAttempt.responseReceipt ??
          error.detail.receipt ?? null;
        const effectiveProviderRequestId = error.detail.providerRequestId ??
          receivedReceipt?.providerRequestId ??
          failedAttempt.providerRequestId ?? null;
        const effectiveProviderResponseId = error.detail.providerResponseId ??
          receivedReceipt?.providerResponseId ??
          failedAttempt.providerResponseId ?? null;
        const effectiveServiceTier = error.detail.serviceTier ??
          receivedReceipt?.serviceTier ?? failedAttempt.serviceTier ?? null;
        const effectiveLatencyMs = error.detail.latencyMs ??
          receivedReceipt?.latencyMs ?? failedAttempt.latencyMs ?? null;
        const effectiveModelObserved = error.detail.modelObserved ??
          receivedReceipt?.modelObserved ?? failedAttempt.modelObserved ?? null;
        const effectiveFinishReason = error.detail.finishReason ??
          receivedReceipt?.finishReason ?? failedAttempt.finishReason ?? null;
        const effectiveUsage = error.detail.usage ?? receivedReceipt?.usage ??
          failedAttempt.usage ?? null;
        const effectiveRateLimit = error.detail.rateLimit ??
          receivedReceipt?.rateLimit ?? failedAttempt.rateLimit ?? null;
        const quarantinedReceipt = receivedReceipt
          ? updateScreen5MechanismProviderReceipt(receivedReceipt, {
              status: "quarantined",
              validationIssues: error.detail.validationIssues?.length
                ? error.detail.validationIssues
                : [{
                    code: /^[a-z][a-z0-9_]{0,79}$/u.test(error.detail.code)
                      ? error.detail.code
                      : "provider_validation_failed",
                    path: "$",
                  }],
              wireFingerprint: null,
            })
          : null;
        Object.assign(failedAttempt, {
          status: error.detail.outcomeKnown
            ? "failed" as const
            : "outcome_unknown" as const,
          completedAt,
          providerRequestId: effectiveProviderRequestId,
          providerResponseId: effectiveProviderResponseId,
          serviceTier: effectiveServiceTier,
          latencyMs: effectiveLatencyMs,
          modelObserved: effectiveModelObserved,
          finishReason: effectiveFinishReason,
          usage: effectiveUsage,
          rateLimit: effectiveRateLimit,
          errorCode: error.detail.code,
          retryable: error.detail.retryable,
          responseReceipt: quarantinedReceipt,
          ...diagnostic,
        });
        execution = updateScreen5MechanismExecution(execution, {
          phase: error.detail.outcomeKnown ? "failed" : "outcome_unknown",
          attempts,
          budgetSnapshot,
          nextEligibleAt: effectiveRateLimit?.retryAfterAt ?? null,
          lastError: {
            stage: "planning",
            code: error.detail.code,
            message: error.message,
            retryable: error.detail.retryable,
            occurredAt: completedAt,
            ...diagnostic,
          },
        }, completedAt);
        const checkpoint = await this.commitScreen5ProviderCheckpoint(
          authentication,
          {
            expectedRevision: workflow.revision,
            operationId: `${input.operationId}:planning-failure:${attempt.ordinal}`,
            operationKind: "checkpoint_screen5_openai_planning_failure",
            label: error.detail.outcomeKnown
              ? "openai-planning-failed"
              : "openai-outcome-unknown",
            previous: run,
            savedAt: completedAt,
            patch: { providerExecution: execution },
          },
        );
        if (effectiveUsage) {
          try {
            await ledger.settle({
              reservationId: attempt.id,
              usage: effectiveUsage,
              now: this.options.now(),
            });
          } catch {
            // Preserve the held reservation on any settlement ambiguity.
          }
        }
        run = checkpoint.result as StudyFirstMechanismRun;
        return this.completeScreen5Advance(authentication, {
          expectedRevision: checkpoint.privateSnapshot.state.revision,
          operationId: input.operationId,
          retry: input.retry,
          result: run,
        });
      }
    }

    if (execution.phase === "plan_ready" || execution.phase === "retrieving") {
      const savedAt = this.options.now();
      const retrievalPlan = run.planning?.plan;
      const retrievalProblem = run.theoreticalProblem;
      if (!retrievalPlan || !retrievalProblem) {
        return failAdvance({
          code: "core_state_invalid",
          stage: "execution",
          actualRevision: workflow.revision,
          commitCertainty: "not_committed",
          dispatchCertainty: "not_dispatched",
          recovery: "restore_local_artifact",
          safeCauseCodes: ["core_state_invalid"],
        });
      }
      if (execution.phase === "plan_ready") {
        execution = updateScreen5MechanismExecution(execution, {
          phase: "retrieving",
          budgetSnapshot,
          lastError: null,
        }, savedAt);
        const retrieving = await this.commitScreen5ProviderCheckpoint(
          authentication,
          {
            expectedRevision: workflow.revision,
            operationId: `${input.operationId}:retrieving`,
            operationKind: "checkpoint_screen5_openai_retrieving",
            label: "openai-retrieving",
            previous: run,
            savedAt,
            patch: { providerExecution: execution },
          },
        );
        workflow = retrieving.privateSnapshot.state;
        run = retrieving.result as StudyFirstMechanismRun;
        execution = run.providerExecution!;
      }
      try {
        const runs = workflow.studyFirstMechanismRuns ?? [];
        const retrieved = await executeStudyFirstMechanismDiscovery({
          id: `screen5-openai-evidence-${fingerprintSixScreenValue({
            job: execution.id,
            ordinal: runs.length + 1,
          }).slice("fnv1a64:".length)}`,
          ordinal: runs.length + 1,
          previousRunId: runs.at(-1)?.id ?? null,
          context: run.context,
          mechanismInput: run.input,
          inputAssessment: run.inputAssessment,
          theoreticalProblem: retrievalProblem,
          planning: run.planning,
          providerExecution: execution,
          mechanismPlan: retrievalPlan,
          fetch: this.options.fetch,
          ...(this.options.openAlexApiKey
            ? { openAlexApiKey: this.options.openAlexApiKey }
            : {}),
          now: () => savedAt,
        });
        if (retrieved.status === "retrieval_unavailable") {
          const failedAt = this.options.now();
          execution = updateScreen5MechanismExecution(execution, {
            phase: "failed",
            budgetSnapshot,
            evidencePacket: null,
            lastError: {
              stage: "retrieval",
              code: "bounded_retrieval_unavailable",
              message:
                "All bounded public-source requests failed. The saved Stage A plan can be retried without another planning request.",
              retryable: true,
              occurredAt: failedAt,
            },
          }, failedAt);
          const failedRun = updateStudyFirstMechanismRun(retrieved, {
            providerExecution: execution,
            hostComparison: {
              status: "not_started",
              taskId: null,
              limitation:
                "Direct Stage B did not start because every bounded source request failed. The validated Stage A plan remains reusable.",
            },
          });
          return this.mutation(authentication, {
            expectedRevision: workflow.revision,
            operationId: input.operationId,
            operationKind: "advance_study_first_mechanism_job",
            payload,
          }, (state) => {
            const result = commitStudyFirstMechanismRun(state, {
              expectedRevision: workflow.revision,
              run: failedRun,
              savedAt: failedAt,
            });
            return { state: result.state, result: result.run };
          });
        }
        const evidencePacket = createScreen5MechanismEvidencePacket({
          id: `screen5-evidence-packet-${fingerprintSixScreenValue({
            job: execution.id,
            plan: retrievalPlan.planFingerprint,
          }).slice("fnv1a64:".length)}`,
          plan: retrievalPlan,
          works: retrieved.works,
          attempts: retrieved.attempts,
          createdAt: savedAt,
        });
        const assessmentBatchPlan = createScreen5MechanismAssessmentBatchPlan({
          executionId: execution.id,
          problemFingerprint: retrievalProblem.problemFingerprint,
          inputFingerprint: run.input.inputFingerprint,
          plan: retrievalPlan,
          evidencePacket,
        });
        const waiting = execution.nextEligibleAt !== null &&
          Date.parse(savedAt) < Date.parse(execution.nextEligibleAt);
        execution = updateScreen5MechanismExecution(execution, {
          phase: waiting ? "waiting_for_rate_limit" : "evidence_ready",
          evidencePacket,
          assessmentBatchPlan,
          budgetSnapshot,
          lastError: null,
        }, savedAt);
        const finalRun = updateStudyFirstMechanismRun(retrieved, {
          providerExecution: execution,
          hostComparison: {
            status: "not_started",
            taskId: null,
            limitation:
              "Direct Stage B evaluates the frozen plan and bounded inspected evidence; no signed host task or researcher decision is implied.",
          },
        });
        const committed = await this.mutation(authentication, {
          expectedRevision: workflow.revision,
          operationId: input.operationId,
          operationKind: "advance_study_first_mechanism_job",
          payload,
        }, (state) => {
          const result = commitStudyFirstMechanismRun(state, {
            expectedRevision: workflow.revision,
            run: finalRun,
            savedAt,
          });
          return { state: result.state, result: result.run };
        });
        return committed;
      } catch {
        const failedAt = this.options.now();
        execution = updateScreen5MechanismExecution(execution, {
          phase: "failed",
          budgetSnapshot,
          lastError: {
            stage: "retrieval",
            code: "bounded_retrieval_failed",
            message:
              "The bounded public-source retrieval did not finish; no absence-of-evidence claim was inferred.",
            retryable: true,
            occurredAt: failedAt,
          },
        }, failedAt);
        const checkpoint = await this.commitScreen5ProviderCheckpoint(
          authentication,
          {
            expectedRevision: workflow.revision,
            operationId: `${input.operationId}:retrieval-failure`,
            operationKind: "checkpoint_screen5_openai_retrieval_failure",
            label: "openai-retrieval-failed",
            previous: run,
            savedAt: failedAt,
            patch: { providerExecution: execution },
          },
        );
        run = checkpoint.result as StudyFirstMechanismRun;
        return this.completeScreen5Advance(authentication, {
          expectedRevision: checkpoint.privateSnapshot.state.revision,
          operationId: input.operationId,
          retry: input.retry,
          result: run,
        });
      }
    }

    if (execution.phase === "waiting_for_rate_limit") {
      const now = this.options.now();
      if (execution.nextEligibleAt && Date.parse(now) < Date.parse(
        execution.nextEligibleAt,
      )) {
        return this.completeScreen5Advance(authentication, {
          expectedRevision: workflow.revision,
          operationId: input.operationId,
          retry: input.retry,
          result: run,
        });
      }
      execution = updateScreen5MechanismExecution(execution, {
        phase: "evidence_ready",
        budgetSnapshot,
        nextEligibleAt: null,
      }, now);
      run = updateStudyFirstMechanismRun(run, { providerExecution: execution });
    }

    if (execution.phase === "assessment_partial") {
      const now = this.options.now();
      execution = updateScreen5MechanismExecution(execution, {
        phase: "evidence_ready",
        budgetSnapshot,
      }, now);
      run = updateStudyFirstMechanismRun(run, { providerExecution: execution });
    }

    if (execution.phase === "evidence_ready") {
      const savedAt = this.options.now();
      const assessmentPlan = run.planning?.plan;
      const assessmentProblem = run.theoreticalProblem;
      if (!assessmentPlan || !assessmentProblem || !execution.evidencePacket) {
        return failAdvance({
          code: "core_state_invalid",
          stage: "execution",
          actualRevision: workflow.revision,
          commitCertainty: "not_committed",
          dispatchCertainty: "not_dispatched",
          recovery: "restore_local_artifact",
          safeCauseCodes: ["core_state_invalid"],
        });
      }
      const assessmentEvidencePacket = execution.evidencePacket;
      const assessmentBatchPlan = execution.assessmentBatchPlan ??
        createScreen5MechanismAssessmentBatchPlan({
          executionId: execution.id,
          problemFingerprint: assessmentProblem.problemFingerprint,
          inputFingerprint: run.input.inputFingerprint,
          plan: assessmentPlan,
          evidencePacket: assessmentEvidencePacket,
        });
      execution = updateScreen5MechanismExecution(execution, {
        assessmentBatchPlan,
      }, savedAt);
      const nextBatch = nextScreen5MechanismAssessmentBatch(execution);
      if (!nextBatch) {
        return failAdvance({
          code: "core_state_invalid",
          stage: "execution",
          actualRevision: workflow.revision,
          commitCertainty: "not_committed",
          dispatchCertainty: "not_dispatched",
          recovery: "restore_local_artifact",
          safeCauseCodes: ["core_state_invalid"],
        });
      }
      const savedBatchWires: Array<{
        batchId: string;
        wire: Screen5MechanismComparisonWire;
        selectedEvidenceIds: string[];
        omittedEvidenceIds: string[];
      }> = [];
      for (const savedAttempt of execution.attempts) {
        if (
          savedAttempt.stage === "assessment" &&
          savedAttempt.status === "succeeded" &&
          savedAttempt.assessmentBatchId &&
          savedAttempt.wireCheckpoint?.kind === "assessment" &&
          (savedAttempt.wireCheckpoint.version ===
              SCREEN5_MECHANISM_COMPARISON_WIRE_VERSION ||
            savedAttempt.wireCheckpoint.version ===
              HISTORICAL_SCREEN5_COMPARISON_WIRE_VERSION ||
            savedAttempt.wireCheckpoint.version ===
              HISTORICAL_SCREEN5_V2_COMPARISON_WIRE_VERSION)
        ) {
          savedBatchWires.push({
            batchId: savedAttempt.assessmentBatchId,
            wire: savedAttempt.wireCheckpoint.value as Screen5MechanismComparisonWire,
            selectedEvidenceIds: [...(savedAttempt.evidenceIds ?? [])],
            omittedEvidenceIds: [...(savedAttempt.omittedEvidenceIds ?? [])],
          });
        }
      }
      const existingRows = savedBatchWires.find(({ wire }) =>
        wire.row_definitions.length > 0)?.wire.row_definitions ?? [];
      const priorMechanismSignatures = savedBatchWires.flatMap(({ wire }) =>
        wire.mechanisms.map((mechanism) => ({
          candidate_id: mechanism.candidate_id,
          concept: mechanism.concept,
          chain: [...mechanism.chain],
        })));
      const admission = admitScreen5OpenAIAssessmentRequest({
        context: run.context,
        mechanismInput: run.input,
        problem: assessmentProblem,
        plan: assessmentPlan,
        evidencePacket: assessmentEvidencePacket,
        batch: nextBatch,
        existingRows,
        priorMechanismSignatures,
      });
      const estimatedInputTokens = admission.estimatedInputTokens;
      if (!admission.fits) {
        execution = updateScreen5MechanismExecution(execution, {
          phase: "failed",
          budgetSnapshot,
          lastError: {
            stage: "assessment",
            code: "input_budget_exceeded",
            message:
              "The Stage B scientific core does not fit the approved input profile even before evidence passages; no inference request was sent.",
            retryable: false,
            occurredAt: savedAt,
          },
        }, savedAt);
        const checkpoint = await this.commitScreen5ProviderCheckpoint(
          authentication,
          {
            expectedRevision: workflow.revision,
            operationId: `${input.operationId}:assessment-budget-failure`,
            operationKind: "checkpoint_screen5_openai_assessment_failure",
            label: "openai-assessment-failed",
            previous: run,
            savedAt,
            patch: { providerExecution: execution },
          },
        );
        run = checkpoint.result as StudyFirstMechanismRun;
        return this.completeScreen5Advance(authentication, {
          expectedRevision: checkpoint.privateSnapshot.state.revision,
          operationId: input.operationId,
          retry: input.retry,
          result: run,
        });
      }
      if (!this.screen5AuthorizationMatches(execution, "assessment")) {
        return workflowProblemFailure({
          code: "authorization",
          stage: "authorization",
          action: "advance_study_first_mechanism_job",
          operationId: input.operationId,
          screen: 5,
          expectedRevision: input.expectedRevision,
          actualRevision: workflow.revision,
          commitCertainty: "not_committed",
          dispatchCertainty: "not_dispatched",
          recovery: "none",
          safeCauseCodes: ["authorization_failed"],
        },
        "Stage B requires a current exact execution authorization for this saved OpenAI job; no provider request was sent.");
      }
      const assessmentAuthorization = this.screen5AuthorizationForStage(
        execution,
        "assessment",
      )!;
      const attempt = screen5MechanismAttempt({
        execution,
        stage: "assessment",
        reservedTokens: SCREEN5_OPENAI_COMPARISON_RESERVED_TOKENS,
        estimatedInputTokens,
        maxCompletionTokens: SCREEN5_OPENAI_COMPARISON_OUTPUT_CEILING,
        authorizationId: assessmentAuthorization.authorizationId,
        assessmentBatchId: nextBatch.id,
        assessmentBatchIndex: nextBatch.index,
        evidenceIds: admission.selectedEvidenceIds,
        omittedEvidenceIds: admission.omittedEvidenceIds,
        now: savedAt,
      });
      try {
        budgetSnapshot = await ledger.reserve({
          reservationId: attempt.id,
          jobId: execution.id,
          stage: attempt.stage,
          reservedTokens: attempt.reservedTokens,
          now: savedAt,
        });
      } catch {
        execution = updateScreen5MechanismExecution(execution, {
          phase: "failed",
          budgetSnapshot,
          lastError: {
            stage: "assessment",
            code: "pilot_allowance_unavailable",
            message:
              "The persistent OpenAI local-preview allowance cannot admit this Stage B reservation.",
            retryable: false,
            occurredAt: savedAt,
          },
        }, savedAt);
        const checkpoint = await this.commitScreen5ProviderCheckpoint(
          authentication,
          {
            expectedRevision: workflow.revision,
            operationId: `${input.operationId}:assessment-allowance-failure`,
            operationKind: "checkpoint_screen5_openai_assessment_failure",
            label: "openai-assessment-failed",
            previous: run,
            savedAt,
            patch: { providerExecution: execution },
          },
        );
        run = checkpoint.result as StudyFirstMechanismRun;
        return this.completeScreen5Advance(authentication, {
          expectedRevision: checkpoint.privateSnapshot.state.revision,
          operationId: input.operationId,
          retry: input.retry,
          result: run,
        });
      }
      execution = updateScreen5MechanismExecution(execution, {
        phase: "assessment_running",
        attempts: [...execution.attempts, attempt],
        budgetSnapshot,
        lastError: null,
      }, savedAt);
      const running = await this.commitScreen5ProviderCheckpoint(
        authentication,
        {
          expectedRevision: workflow.revision,
          operationId: `${input.operationId}:assessment-running:${attempt.ordinal}`,
          operationKind: "checkpoint_screen5_openai_assessment_running",
          label: "openai-assessment-running",
          previous: run,
          savedAt,
          patch: { providerExecution: execution },
        },
      );
      workflow = running.privateSnapshot.state;
      run = running.result as StudyFirstMechanismRun;
      execution = run.providerExecution!;
      try {
        const response = await requestScreen5OpenAIAssessment({
          apiKey: this.options.screen5OpenAIApiKey,
          fetch: providerFetch,
          context: run.context,
          mechanismInput: run.input,
          problem: run.theoreticalProblem!,
          plan: run.planning!.plan!,
          evidencePacket: execution.evidencePacket!,
          batch: nextBatch,
          existingRows,
          priorMechanismSignatures,
          selectedEvidenceIds: admission.selectedEvidenceIds,
          omittedEvidenceIds: admission.omittedEvidenceIds,
          now: this.options.now,
          onReceipt: async (receipt: Screen5MechanismProviderReceipt) => {
            const attempts = structuredClone(execution.attempts);
            const receivedAttempt = attempts.find(({ id }) => id === attempt.id);
            if (!receivedAttempt) {
              throw new Error("The active Stage B attempt is unavailable.");
            }
            Object.assign(receivedAttempt, {
              providerRequestId: receipt.providerRequestId,
              providerResponseId: receipt.providerResponseId ?? null,
              serviceTier: receipt.serviceTier ?? null,
              latencyMs: receipt.latencyMs ?? null,
              modelObserved: receipt.modelObserved,
              finishReason: receipt.finishReason,
              usage: receipt.usage,
              rateLimit: receipt.rateLimit,
              responseReceipt: receipt,
            });
            execution = updateScreen5MechanismExecution(execution, {
              phase: "validating",
              attempts,
              lastError: null,
            }, receipt.receivedAt);
            const receiptCheckpoint = await this.commitScreen5ProviderCheckpoint(
              authentication,
              {
                expectedRevision: workflow.revision,
                operationId:
                  `${input.operationId}:assessment-receipt:${attempt.ordinal}`,
                operationKind: "checkpoint_screen5_openai_assessment_receipt",
                label: "openai-assessment-receipted",
                previous: run!,
                savedAt: receipt.receivedAt,
                patch: { providerExecution: execution },
              },
            );
            workflow = receiptCheckpoint.privateSnapshot.state;
            run = receiptCheckpoint.result as StudyFirstMechanismRun;
            execution = run.providerExecution!;
          },
        });
        const completedAt = this.options.now();
        const wireFingerprint = fingerprintSixScreenValue(response.wire);
        const attempts = structuredClone(execution.attempts);
        const completedAttempt = attempts.find(({ id }) => id === attempt.id);
        if (!completedAttempt) {
          throw new Error("The receipted Stage B attempt is unavailable.");
        }
        Object.assign(completedAttempt, {
          status: "succeeded" as const,
          completedAt,
          providerRequestId: response.providerRequestId,
          providerResponseId: response.providerResponseId,
          serviceTier: response.serviceTier,
          latencyMs: response.latencyMs,
          modelObserved: response.modelObserved,
          finishReason: response.finishReason,
          usage: response.usage,
          rateLimit: response.rateLimit,
          errorCode: null,
          retryable: false,
          responseReceipt: updateScreen5MechanismProviderReceipt(
            completedAttempt.responseReceipt ?? response.receipt,
            {
              status: "schema_valid",
              validationIssues: [],
              wireFingerprint,
            },
          ),
          wireCheckpoint: {
            kind: "assessment" as const,
            version: SCREEN5_MECHANISM_COMPARISON_WIRE_VERSION,
            value: response.wire,
            fingerprint: wireFingerprint,
          },
        });
        execution = updateScreen5MechanismExecution(execution, {
          phase: "validating",
          attempts,
          lastError: null,
        }, completedAt);
        let batchCheckpoint;
        try {
          batchCheckpoint = await this.commitScreen5ProviderCheckpoint(
            authentication,
            {
              expectedRevision: workflow.revision,
              operationId:
                `${input.operationId}:assessment-batch:${attempt.ordinal}`,
              operationKind: "checkpoint_screen5_openai_assessment_batch",
              label: "openai-assessment-batch-saved",
              previous: run,
              savedAt: completedAt,
              patch: { providerExecution: execution },
            },
          );
        } catch (batchCommitFailure) {
          const latest = await this.options.store.read(authentication);
          if (latest.outcome !== "found") throw batchCommitFailure;
          const latestRun = currentStudyFirstMechanismRunForState(
            latest.record.state,
          );
          const latestExecution = latestRun?.providerExecution;
          if (!latestRun || !latestExecution) throw batchCommitFailure;
          const alreadySaved = latestExecution.attempts.find(({ id }) =>
            id === attempt.id)?.wireCheckpoint?.fingerprint === wireFingerprint;
          if (alreadySaved) {
            batchCheckpoint = {
              privateSnapshot: { state: latest.record.state },
              result: latestRun,
            };
          } else {
            const recoveryAttempts = structuredClone(latestExecution.attempts);
            const recoveryAttempt = recoveryAttempts.find(({ id }) =>
              id === attempt.id);
            if (!recoveryAttempt) throw batchCommitFailure;
            Object.assign(recoveryAttempt, completedAttempt);
            const recoveryExecution = updateScreen5MechanismExecution(
              latestExecution,
              {
                phase: "validating",
                attempts: recoveryAttempts,
                lastError: null,
              },
              completedAt,
            );
            batchCheckpoint = await this.commitScreen5ProviderCheckpoint(
              authentication,
              {
                expectedRevision: latest.record.state.revision,
                operationId:
                  `${input.operationId}:assessment-batch-recovery:${attempt.ordinal}`,
                operationKind: "checkpoint_screen5_openai_assessment_batch",
                label: "openai-assessment-batch-saved",
                previous: latestRun,
                savedAt: completedAt,
                patch: { providerExecution: recoveryExecution },
              },
            );
          }
        }
        workflow = batchCheckpoint.privateSnapshot.state;
        run = batchCheckpoint.result as StudyFirstMechanismRun;
        execution = run.providerExecution!;
        try {
          await ledger.settle({
            reservationId: attempt.id,
            usage: response.usage,
            now: this.options.now(),
          });
        } catch {
          // The saved observed usage remains authoritative when ledger
          // settlement cannot yet be proven.
        }
        const allBatchWires = [
          ...savedBatchWires,
          {
            batchId: nextBatch.id,
            wire: response.wire,
            selectedEvidenceIds: [...admission.selectedEvidenceIds],
            omittedEvidenceIds: [...admission.omittedEvidenceIds],
          },
        ];
        let comparison;
        try {
          comparison = createScreen5MechanismComparison({
            id: `screen5-comparison-${fingerprintSixScreenValue({
              job: execution.id,
              attempt: attempt.id,
            }).slice("fnv1a64:".length)}`,
            problemFingerprint: run.theoreticalProblem!.problemFingerprint,
            focalText: run.input.proposedMechanism,
            plan: run.planning!.plan!,
            evidencePacket: execution.evidencePacket!,
            batchPlan: assessmentBatchPlan,
            batchWires: allBatchWires,
            modelObserved: response.modelObserved,
            createdAt: completedAt,
          });
        } catch {
          const blockedAt = this.options.now();
          execution = updateScreen5MechanismExecution(execution, {
            phase: "blocked",
            lastError: {
              stage: "validation",
              code: "receipt_saved_merge_pending",
              message:
                "The validated Stage B batch and observed usage were saved, but aggregate projection is pending local replay. No provider request is needed.",
              retryable: false,
              occurredAt: blockedAt,
              failureStage: "projection",
              networkInvocation: "not_started",
              providerResponse: "observed",
              safeCause: "aggregate_merge_failed",
            },
          }, blockedAt);
          const blocked = await this.commitScreen5ProviderCheckpoint(
            authentication,
            {
              expectedRevision: workflow.revision,
              operationId:
                `${input.operationId}:assessment-merge-pending:${attempt.ordinal}`,
              operationKind: "checkpoint_screen5_openai_assessment_merge_pending",
              label: "openai-assessment-merge-pending",
              previous: run,
              savedAt: blockedAt,
              patch: { providerExecution: execution },
            },
          );
          run = blocked.result as StudyFirstMechanismRun;
          return this.completeScreen5Advance(authentication, {
            expectedRevision: blocked.privateSnapshot.state.revision,
            operationId: input.operationId,
            retry: input.retry,
            result: run,
          });
        }
        const aggregateAttempts = structuredClone(execution.attempts);
        const aggregateAttempt = aggregateAttempts.find(({ id }) =>
          id === attempt.id);
        if (aggregateAttempt?.responseReceipt) {
          aggregateAttempt.responseReceipt = updateScreen5MechanismProviderReceipt(
            aggregateAttempt.responseReceipt,
            { status: "aggregate_saved" },
          );
        }
        const comparisonComplete = comparison.completion?.status ===
          "completed";
        execution = updateScreen5MechanismExecution(execution, {
          phase: comparisonComplete ? "completed" : "waiting_for_rate_limit",
          attempts: aggregateAttempts,
          comparison,
          nextEligibleAt: comparisonComplete
            ? null
            : screen5MechanismEarliestAssessmentAt({
                completedAt,
                retryAfterAt: response.rateLimit.retryAfterAt,
                tokenResetAt: response.rateLimit.tokenResetAt,
              }),
          lastError: null,
        }, completedAt);
        let checkpoint;
        try {
          checkpoint = await this.commitScreen5ProviderCheckpoint(
            authentication,
            {
              expectedRevision: workflow.revision,
              operationId:
                `${input.operationId}:assessment-aggregate:${attempt.ordinal}`,
              operationKind: "checkpoint_screen5_openai_assessment_result",
              label: comparisonComplete
                ? "openai-comparison-complete"
                : "openai-comparison-partial",
              previous: run,
              savedAt: completedAt,
              patch: {
                providerExecution: execution,
                phases: {
                  retrieval: run.phases?.retrieval ?? "complete",
                  textInspection: run.phases?.textInspection ?? "partial",
                  screening: run.phases?.screening ?? "complete",
                  synthesis: comparisonComplete ? "complete" : "pending",
                  validation: comparisonComplete ? "complete" : "pending",
                  presentation: comparisonComplete ? "complete" : "partial",
                },
              },
            },
          );
        } catch (aggregateCommitFailure) {
          const latest = await this.options.store.read(authentication);
          if (latest.outcome !== "found") throw aggregateCommitFailure;
          const latestRun = currentStudyFirstMechanismRunForState(
            latest.record.state,
          );
          if (!latestRun?.providerExecution) throw aggregateCommitFailure;
          if (
            latestRun.providerExecution.comparison?.comparisonFingerprint ===
              comparison.comparisonFingerprint
          ) {
            return this.completeScreen5Advance(authentication, {
              expectedRevision: latest.record.state.revision,
              operationId: input.operationId,
              retry: input.retry,
              result: latestRun,
            });
          }
          const blockedAt = this.options.now();
          const blockedExecution = updateScreen5MechanismExecution(
            latestRun.providerExecution,
            {
              phase: "blocked",
              lastError: {
                stage: "validation",
                code: "receipt_saved_merge_pending",
                message:
                  "The validated Stage B batch and observed usage were saved, but aggregate persistence is pending local replay. No provider request is needed.",
                retryable: false,
                occurredAt: blockedAt,
                failureStage: "persistence",
                networkInvocation: "not_started",
                providerResponse: "observed",
                safeCause: "aggregate_persistence_failed",
              },
            },
            blockedAt,
          );
          const blocked = await this.commitScreen5ProviderCheckpoint(
            authentication,
            {
              expectedRevision: latest.record.state.revision,
              operationId:
                `${input.operationId}:assessment-aggregate-pending:${attempt.ordinal}`,
              operationKind: "checkpoint_screen5_openai_assessment_merge_pending",
              label: "openai-assessment-merge-pending",
              previous: latestRun,
              savedAt: blockedAt,
              patch: { providerExecution: blockedExecution },
            },
          );
          return this.completeScreen5Advance(authentication, {
            expectedRevision: blocked.privateSnapshot.state.revision,
            operationId: input.operationId,
            retry: input.retry,
            result: blocked.result as StudyFirstMechanismRun,
          });
        }
        run = checkpoint.result as StudyFirstMechanismRun;
        return this.completeScreen5Advance(authentication, {
          expectedRevision: checkpoint.privateSnapshot.state.revision,
          operationId: input.operationId,
          retry: input.retry,
          result: run,
        });
      } catch (caught) {
        const completedAt = this.options.now();
        const error = caught instanceof Screen5OpenAIProviderError
          ? caught
          : new Screen5OpenAIProviderError(
              "Stage B failed before a validated comparison was saved.",
              {
                code: "assessment_validation_failed",
                retryable: false,
                outcomeKnown: true,
                dispatched: true,
                usage: null,
                rateLimit: null,
                providerRequestId: null,
                providerResponseId: null,
                serviceTier: null,
                latencyMs: null,
                modelObserved: null,
                finishReason: null,
                failureStage: "model_output",
                networkInvocation: "invoked",
                providerResponse: "observed",
              },
            );
        const diagnostic = screen5ProviderFailureDiagnostic(error);
        if (diagnostic.networkInvocation === "not_started") {
          try {
            budgetSnapshot = await ledger.release({
              reservationId: attempt.id,
              reasonCode: diagnostic.safeCause,
              now: completedAt,
            });
          } catch {
            // A failed reconciliation stays conservatively held.
          }
        }
        const attempts = structuredClone(execution.attempts);
        const failedAttempt = attempts.find(({ id }) => id === attempt.id) ??
          attempts.at(-1)!;
        const receivedReceipt = failedAttempt.responseReceipt ??
          error.detail.receipt ?? null;
        const effectiveProviderRequestId = error.detail.providerRequestId ??
          receivedReceipt?.providerRequestId ??
          failedAttempt.providerRequestId ?? null;
        const effectiveProviderResponseId = error.detail.providerResponseId ??
          receivedReceipt?.providerResponseId ??
          failedAttempt.providerResponseId ?? null;
        const effectiveServiceTier = error.detail.serviceTier ??
          receivedReceipt?.serviceTier ?? failedAttempt.serviceTier ?? null;
        const effectiveLatencyMs = error.detail.latencyMs ??
          receivedReceipt?.latencyMs ?? failedAttempt.latencyMs ?? null;
        const effectiveModelObserved = error.detail.modelObserved ??
          receivedReceipt?.modelObserved ?? failedAttempt.modelObserved ?? null;
        const effectiveFinishReason = error.detail.finishReason ??
          receivedReceipt?.finishReason ?? failedAttempt.finishReason ?? null;
        const effectiveUsage = error.detail.usage ?? receivedReceipt?.usage ??
          failedAttempt.usage ?? null;
        const effectiveRateLimit = error.detail.rateLimit ??
          receivedReceipt?.rateLimit ?? failedAttempt.rateLimit ?? null;
        const quarantinedReceipt = receivedReceipt
          ? updateScreen5MechanismProviderReceipt(receivedReceipt, {
              status: "quarantined",
              validationIssues: error.detail.validationIssues?.length
                ? error.detail.validationIssues
                : [{
                    code: /^[a-z][a-z0-9_]{0,79}$/u.test(error.detail.code)
                      ? error.detail.code
                      : "provider_validation_failed",
                    path: "$",
                  }],
              wireFingerprint: null,
            })
          : null;
        Object.assign(failedAttempt, {
          status: error.detail.outcomeKnown
            ? "failed" as const
            : "outcome_unknown" as const,
          completedAt,
          providerRequestId: effectiveProviderRequestId,
          providerResponseId: effectiveProviderResponseId,
          serviceTier: effectiveServiceTier,
          latencyMs: effectiveLatencyMs,
          modelObserved: effectiveModelObserved,
          finishReason: effectiveFinishReason,
          usage: effectiveUsage,
          rateLimit: effectiveRateLimit,
          errorCode: error.detail.code,
          retryable: error.detail.retryable,
          responseReceipt: quarantinedReceipt,
          ...diagnostic,
        });
        execution = updateScreen5MechanismExecution(execution, {
          phase: error.detail.outcomeKnown ? "failed" : "outcome_unknown",
          attempts,
          budgetSnapshot,
          nextEligibleAt: effectiveRateLimit?.retryAfterAt ?? null,
          lastError: {
            stage: "assessment",
            code: error.detail.code,
            message: error.message,
            retryable: error.detail.retryable,
            occurredAt: completedAt,
            ...diagnostic,
          },
        }, completedAt);
        const checkpoint = await this.commitScreen5ProviderCheckpoint(
          authentication,
          {
            expectedRevision: workflow.revision,
            operationId: `${input.operationId}:assessment-failure:${attempt.ordinal}`,
            operationKind: "checkpoint_screen5_openai_assessment_failure",
            label: error.detail.outcomeKnown
              ? "openai-assessment-failed"
              : "openai-outcome-unknown",
            previous: run,
            savedAt: completedAt,
            patch: { providerExecution: execution },
          },
        );
        if (effectiveUsage) {
          try {
            await ledger.settle({
              reservationId: attempt.id,
              usage: effectiveUsage,
              now: this.options.now(),
            });
          } catch {
            // Preserve the held reservation on any settlement ambiguity.
          }
        }
        run = checkpoint.result as StudyFirstMechanismRun;
        return this.completeScreen5Advance(authentication, {
          expectedRevision: checkpoint.privateSnapshot.state.revision,
          operationId: input.operationId,
          retry: input.retry,
          result: run,
        });
      }
    }

    return failAdvance({
      code: "core_state_invalid",
      stage: "execution",
      actualRevision: workflow.revision,
      commitCertainty: "not_committed",
      dispatchCertainty: "not_dispatched",
      recovery: "none",
      safeCauseCodes: ["core_state_invalid"],
    });
  }

  async continueStudyFirstMechanismEvidence(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      planningTaskId: string;
      planningResultId: string;
    },
  ) {
    // This compatibility action remains parseable for older clients, but the
    // fixed OpenAI-only intent makes its former host-task body unreachable in
    // every supported configuration.
    if (this.screen5DirectIntent()) {
      throw new Error(
        "The legacy ChatGPT-host Screen 5 inference route is retired. Configure the OpenAI-only local preview instead.",
      );
    }
    const payload = {
      planningTaskId: input.planningTaskId,
      planningResultId: input.planningResultId,
      executorVersion: STUDY_FIRST_MECHANISM_EXECUTOR_VERSION,
    };
    const read = await this.options.store.read(authentication);
    if (read.outcome === "unauthorized") {
      throw new Error("Six-screen workflow access is unauthorized.");
    }
    if (read.outcome === "not_found") {
      throw new Error("Six-screen workflow is unavailable or expired.");
    }
    if (read.record.operationReplays.some(({ operationId }) =>
      operationId === input.operationId)) {
      return this.mutation(authentication, {
        expectedRevision: input.expectedRevision,
        operationId: input.operationId,
        operationKind: "continue_study_first_mechanism_evidence",
        payload,
      }, (state) => ({
        state,
        result: currentStudyFirstMechanismRunForState(state),
      }));
    }
    const taskStore = this.options.hostReasoningTaskStore;
    if (!taskStore) {
      throw new Error(
        "Signed-in theoretical planning is unavailable because the host-task store is not configured.",
      );
    }
    const workflow = read.record.state;
    if (workflow.revision !== input.expectedRevision) {
      throw new Error(
        `Stale six-screen workflow mutation; current revision is ${workflow.revision}.`,
      );
    }
    const planningRun = currentStudyFirstMechanismRunForState(workflow);
    if (
      !planningRun || planningRun.status !== "planning_ready" ||
      !planningRun.theoreticalProblem ||
      planningRun.planning?.status !== "available_via_signed_host_task"
    ) {
      throw new Error(
        "The current Screen 5 run is not awaiting a theoretical plan.",
      );
    }
    const taskRead = await taskStore.read(input.planningTaskId);
    if (taskRead.outcome !== "found") {
      throw new Error("The signed Screen 5 planning task is unavailable.");
    }
    const taskRecord = taskRead.record;
    if (
      taskRecord.task.taskType !== SCREEN05_THEORETICAL_PLANNING_TASK ||
      taskRecord.task.runId !== read.record.runId ||
      taskRecord.task.selectedEventId !== planningRun.id ||
      taskRecord.task.eventFingerprint !== planningRun.runFingerprint ||
      taskRecord.task.scopeFingerprint !== read.record.stateFingerprint ||
      taskRecord.task.status !== "applied" ||
      taskRecord.task.resultId !== input.planningResultId ||
      !taskRecord.proposal
    ) {
      throw new Error(
        "The signed Screen 5 theoretical plan does not match the current frozen workflow.",
      );
    }
    const result = screen05TheoreticalPlanningResultSchema.parse(
      taskRecord.proposal,
    );
    if (
      result.problemFingerprintInspected !==
        planningRun.theoreticalProblem.problemFingerprint ||
      result.mechanismInputFingerprintInspected !==
        planningRun.input.inputFingerprint
    ) {
      throw new Error(
        "The signed Screen 5 theoretical plan belongs to different scientific inputs.",
      );
    }
    const plan = createStudyFirstMechanismPlan({
      conceptualQuestion: result.conceptualQuestion,
      relationshipInterpretation: result.relationshipInterpretation,
      candidates: result.candidates,
      supplementaryAccounts: result.supplementaryAccounts,
      evidenceNeeds: result.evidenceNeeds,
      queryIntents: result.queryIntents,
      limitations: result.limitations,
    });
    if (plan.planFingerprint !== result.planFingerprint) {
      throw new Error("The signed Screen 5 theoretical-plan fingerprint changed.");
    }
    const savedAt = this.options.now();
    const runs = workflow.studyFirstMechanismRuns ?? [];
    const coordinate = fingerprintSixScreenValue(input.operationId).slice(
      "fnv1a64:".length,
    );
    const run = await executeStudyFirstMechanismDiscovery({
      id: `screen5-evidence-run-${coordinate}`,
      ordinal: runs.length + 1,
      previousRunId: runs.at(-1)?.id ?? null,
      context: planningRun.context,
      mechanismInput: planningRun.input,
      inputAssessment: planningRun.inputAssessment,
      theoreticalProblem: planningRun.theoreticalProblem,
      planning: {
        status: "completed",
        taskId: input.planningTaskId,
        resultId: input.planningResultId,
        plan,
        limitation:
          "This validated plan is pre-retrieval model analysis, not a scholarly finding or researcher decision.",
      },
      mechanismPlan: plan,
      fetch: this.options.fetch,
      ...(this.options.openAlexApiKey
        ? { openAlexApiKey: this.options.openAlexApiKey }
        : {}),
      now: () => savedAt,
    });
    return this.mutation(authentication, {
      expectedRevision: workflow.revision,
      operationId: input.operationId,
      operationKind: "continue_study_first_mechanism_evidence",
      payload,
    }, (state) => {
      const committed = commitStudyFirstMechanismRun(state, {
        expectedRevision: workflow.revision,
        run,
        savedAt,
      });
      return { state: committed.state, result: committed.run };
    });
  }

  openScreen6(authentication: SixScreenWorkflowAuthentication, input: {
    expectedRevision: number;
    operationId: string;
  }) {
    return this.mutation(authentication, {
      ...input,
      operationKind: "open_screen_6",
      payload: { expectedRevision: input.expectedRevision },
    }, (state) => {
      const opened = openScreen6(state, {
        expectedRevision: input.expectedRevision,
        openedAt: this.options.now(),
      });
      return { state: opened.state, result: opened.receipt };
    });
  }

  /** Re-read before each durable transition: navigation may advance the workflow revision. */
  private async persistContextualizationStage(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      screen: 3 | 6;
      recordId: string;
      reservationId: string;
      fingerprint: string;
      label: string;
      expectedClaimOperationId?: string | null;
      patch: Partial<NonNullable<
        SixScreenWorkflowState["screen3Contextualizations"]
      >[number]>;
    },
  ) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const latest = await this.options.store.read(authentication);
      if (latest.outcome !== "found") {
        throw new Error("The authorized workflow is unavailable for saving the model result.");
      }
      try {
        return await this.mutation(authentication, {
          expectedRevision: latest.record.state.revision,
          operationId: `${input.reservationId}:${
            fingerprintSixScreenValue(input.expectedClaimOperationId ??
              "legacy-claim").slice("fnv1a64:".length)}:${input.label}`,
          operationKind: `screen${input.screen}_contextualization_${input.label}`,
          payload: {
            recordId: input.recordId,
            fingerprint: input.fingerprint,
            status: input.patch.status ?? null,
            claimOperationId: input.expectedClaimOperationId ?? null,
            receiptFingerprint: input.patch.receipt?.contentFingerprint ?? null,
          },
        }, (state) => {
          const entries = input.screen === 3
            ? state.screen3Contextualizations
            : state.screen6Personalizations;
          const record = entries?.find((item) => item.id === input.recordId);
          if (!record) {
            throw new Error("The authorized model attempt is unavailable.");
          }
          if (input.expectedClaimOperationId &&
              record.claimOperationId !== input.expectedClaimOperationId) {
            throw new Error(
              "The durable model-attempt claim changed before this stage could be saved.",
            );
          }
          if (record.receipt && input.patch.receipt &&
            record.receipt.contentFingerprint !==
              input.patch.receipt.contentFingerprint) {
            throw new Error("The saved provider receipt cannot be replaced.");
          }
          if (input.screen === 3 &&
            ["dispatch", "completed", "receipt_completed"].includes(
              input.label,
            ) &&
            "packetFingerprint" in record && record.packetFingerprint) {
            const advice = currentStudyDesignAdvice(state);
            if (!advice || advice.adviceFingerprint !== input.fingerprint ||
              fingerprintSixScreenValue(screen3ContextualPacket(state,
                advice)) !== record.packetFingerprint) {
              throw new Error("Screen 3 policy evidence changed after authorization; review the current design concerns.");
            }
          }
          if (record.status === "completed") return { state, result: null };
          Object.assign(record, input.patch, { updatedAt: this.options.now() });
          const at = this.options.now();
          state.revision += 1;
          state.updatedAt = at;
          state.changeLog.push({ revision: state.revision, at,
            summary: `Screen ${input.screen} contextualization ${input.label.replaceAll("_", " ")} was saved.` });
          // The public projection is rebuilt from canonical state for the
          // direct response. Internal model-attempt checkpoints need no replay
          // payload; retaining a full projection at every stage duplicated the
          // workflow several times in the parent Durable Object record.
          return { state, result: null };
        });
      } catch (caught) {
        if (isSixScreenRevisionConflict(caught) && attempt < 5) continue;
        throw caught;
      }
    }
    throw new Error("The model result could not be saved after concurrent workflow changes.");
  }

  /** One logical scientific task, with an append-only record for each authorized attempt. */
  private async contextualizeWithDurableAttempt(
    authentication: SixScreenWorkflowAuthentication,
    input: { expectedRevision: number; operationId: string;
      fingerprint: string; screen: 3 | 6;
      retryUnknownAttemptId?: string;
      inputCeiling: number; outputCeiling: number; reservation: number;
      work: (state: SixScreenWorkflowState) => {
        fingerprint: string;
        packetFingerprint?: string;
        estimate: number;
        validate: (value: unknown, historical: boolean) => unknown;
        request: (callbacks: {
          onDispatch: () => Promise<void>;
          onReceipt: (receipt: Screen5MechanismProviderReceipt) => Promise<void>;
        }) => Promise<{ wire: unknown;
          usage: Screen5MechanismProviderReceipt["usage"] }>;
      };
    },
  ) {
    const action = input.screen === 3
      ? "personalize_screen3_advice"
      : "personalize_screen6_plan";
    let read: Awaited<ReturnType<SixScreenWorkflowStore["read"]>>;
    try {
      read = await this.options.store.read(authentication);
    } catch {
      return workflowProblemFailure({
        code: "core_state_invalid",
        action,
        operationId: input.operationId,
        screen: input.screen,
        expectedRevision: input.expectedRevision,
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        recovery: "none",
        safeCauseCodes: ["core_state_invalid"],
      });
    }
    if (read.outcome !== "found") {
      return workflowProblemFailure({
        code: "authorization",
        action,
        operationId: input.operationId,
        screen: input.screen,
        expectedRevision: input.expectedRevision,
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        recovery: "reconnect",
        safeCauseCodes: [read.outcome === "unauthorized"
          ? "authorization_failed" : "run_unavailable"],
      });
    }
    this.requireOptionalAnalysisRecovery(read.record,
      input.screen === 3 ? "screen3Contextualizations" :
        "screen6Personalizations", input.screen, {
          action,
          operationId: input.operationId,
          expectedRevision: input.expectedRevision,
        });
    const replayExists = read.record.operationReplays.some(({ operationId }) =>
      operationId === input.operationId);
    if (!replayExists &&
        read.record.state.revision !== input.expectedRevision) {
      return workflowProblemFailure({
        code: "revision_conflict",
        action,
        operationId: input.operationId,
        screen: input.screen,
        expectedRevision: input.expectedRevision,
        actualRevision: read.record.state.revision,
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        recovery: "guarded_rebase",
        safeCauseCodes: ["stale_revision"],
      });
    }
    let initialWork: ReturnType<typeof input.work>;
    try {
      initialWork = input.work(read.record.state);
    } catch {
      return workflowProblemFailure({
        code: "core_state_invalid",
        action,
        operationId: input.operationId,
        screen: input.screen,
        expectedRevision: input.expectedRevision,
        actualRevision: read.record.state.revision,
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        recovery: "none",
        safeCauseCodes: ["core_state_invalid"],
      });
    }
    if (initialWork.fingerprint !== input.fingerprint) {
      return workflowProblemFailure({
        code: "operation_identity_conflict",
        action,
        operationId: input.operationId,
        screen: input.screen,
        expectedRevision: input.expectedRevision,
        actualRevision: read.record.state.revision,
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        recovery: "none",
        safeCauseCodes: ["operation_conflict"],
      });
    }
    const initialEntries = input.screen === 3
      ? read.record.state.screen3Contextualizations ?? []
      : read.record.state.screen6Personalizations ?? [];
    const initialPrior = initialEntries.filter((entry) => input.screen === 3
      ? "adviceFingerprint" in entry &&
        entry.adviceFingerprint === input.fingerprint &&
        entry.packetFingerprint === initialWork.packetFingerprint
      : "inputFingerprint" in entry &&
        entry.inputFingerprint === input.fingerprint);
    const stalled = initialPrior.at(-1);
    let reclaimableRecordId: string | null = null;
    if (stalled && recoverableContextualizationClaim(
      stalled, this.options.now()) && this.options.screen5OpenAILedgerStore) {
      try {
        const phase = await this.options.screen5OpenAILedgerStore
          .reservationStatus(stalled.reservationId);
        if (phase === "absent" || phase === "reserved_not_dispatched") {
          reclaimableRecordId = stalled.id;
        }
      } catch {
        // A ledger read failure cannot authorize a second dispatch.
      }
    }
    const recordPrefix = input.screen === 3 ? "screen3-critique" : "screen6-plan";
    const reservationPrefix = input.screen === 3
      ? "screen3-contextualization" : "screen6-contextualization";
    const configured = this.screen5OpenAIConfigurationIsValid() &&
      Boolean(this.options.screen5OpenAIApiKey &&
        this.options.screen5OpenAIFetch &&
        this.options.screen5OpenAILedgerStore);
    const started = await this.mutation(authentication, {
      expectedRevision: input.expectedRevision,
      operationId: input.operationId,
      operationKind: action,
      payload: input.screen === 3
        ? { expectedAdviceFingerprint: input.fingerprint,
          ...(input.retryUnknownAttemptId ? { retryUnknownAttemptId: input.retryUnknownAttemptId } : {}) }
        : { expectedPlanFingerprint: input.fingerprint },
    }, (state) => {
      if (!state.confirmedShock ||
          (input.screen === 3 && !screen3PrerequisiteReport(state).ready) ||
          (input.screen === 6 && !screen6PrerequisiteReport(state).ready)) {
        return workflowProblemFailure({
          code: "core_state_invalid",
          action,
          operationId: input.operationId,
          screen: input.screen,
          expectedRevision: input.expectedRevision,
          actualRevision: state.revision,
          commitCertainty: "not_committed",
          dispatchCertainty: "not_dispatched",
          recovery: "none",
          safeCauseCodes: ["core_state_invalid"],
        });
      }
      let work: ReturnType<typeof input.work>;
      try {
        work = input.work(state);
      } catch {
        return workflowProblemFailure({
          code: "core_state_invalid",
          action,
          operationId: input.operationId,
          screen: input.screen,
          expectedRevision: input.expectedRevision,
          actualRevision: state.revision,
          commitCertainty: "not_committed",
          dispatchCertainty: "not_dispatched",
          recovery: "none",
          safeCauseCodes: ["core_state_invalid"],
        });
      }
      if (work.fingerprint !== input.fingerprint) {
        return workflowProblemFailure({
          code: "operation_identity_conflict",
          action,
          operationId: input.operationId,
          screen: input.screen,
          expectedRevision: input.expectedRevision,
          actualRevision: state.revision,
          commitCertainty: "not_committed",
          dispatchCertainty: "not_dispatched",
          recovery: "none",
          safeCauseCodes: ["operation_conflict"],
        });
      }
      const entries = input.screen === 3
        ? state.screen3Contextualizations ?? []
        : state.screen6Personalizations ?? [];
      const prior = entries.filter((entry) => input.screen === 3
        ? "adviceFingerprint" in entry &&
          entry.adviceFingerprint === input.fingerprint &&
          entry.packetFingerprint === work.packetFingerprint
        : "inputFingerprint" in entry &&
          entry.inputFingerprint === input.fingerprint);
      const last = prior.at(-1);
      // A fresh, revision-bound assessment action is the user's retry. Keep
      // the original wire shape: cached host schemas can omit newer fields.
      // Reads and same-operation replays never authorize another dispatch.
      const explicitUnknownRetry = input.screen === 3 &&
        last?.status === "outcome_unknown" && !last.receipt &&
        last.claimOperationId !== input.operationId &&
        (input.retryUnknownAttemptId === undefined ||
          input.retryUnknownAttemptId === last.id);
      if (input.retryUnknownAttemptId && !explicitUnknownRetry) {
        throw new Error("The earlier uncertain assessment changed; check its saved status before starting a new request.");
      }
      if (last && last.id === reclaimableRecordId &&
          recoverableContextualizationClaim(last, this.options.now())) {
        last.claimOperationId = input.operationId;
        last.failureCode = null;
        last.failureStage = null;
        last.updatedAt = this.options.now();
        const at = this.options.now();
        state.revision += 1;
        state.updatedAt = at;
        state.changeLog.push({ revision: state.revision, at,
          summary: `Screen ${input.screen} reclaimed a saved pre-dispatch model attempt after ledger verification.` });
        return { state };
      }
      if (last && !explicitUnknownRetry && !(last.status === "failed" && !last.receipt &&
        (last.dispatchState === "not_dispatched" ||
          knownContextualizationRejection(last)))) {
        return { state };
      }
      if (!configured) {
        throw new SixScreenWorkflowProblemError(
          createSixScreenWorkflowProblem({
            code: "configuration_unavailable",
            action,
            operationId: input.operationId,
            screen: input.screen,
            expectedRevision: input.expectedRevision,
            commitCertainty: "not_committed",
            dispatchCertainty: "not_dispatched",
            recovery: "none",
            safeCauseCodes: ["configuration_unavailable"],
          }),
        );
      }
      if (work.estimate > input.inputCeiling) {
        throw new Error(`The Screen ${input.screen} context exceeds its bounded model task profile.`);
      }
      if (entries.length >= 40 || prior.length >= 40) {
        throw new Error(`The saved Screen ${input.screen} contextualization history is full.`);
      }
      const ordinal = prior.length + 1;
      const attemptSuffix = ordinal === 1 ? "" : `-a${ordinal}`;
      const logicalFingerprint = input.screen === 3
        ? fingerprintSixScreenValue({ adviceFingerprint: input.fingerprint,
          packetFingerprint: work.packetFingerprint }) : input.fingerprint;
      // The shared inference ledger spans workflows. Namespace attempt IDs
      // privately by run so identical scientific studies cannot reuse one
      // another's reservation; keep scientific fingerprints unchanged.
      const suffix = fingerprintSixScreenValue({
        runId: authentication.runId, logicalFingerprint,
      }).slice("fnv1a64:".length);
      const recordId = `${recordPrefix}-${suffix}${attemptSuffix}`;
      const reservationId = `${reservationPrefix}-${suffix}${attemptSuffix}`;
      const common = { id: recordId, reservationId,
        attemptOrdinal: ordinal, claimOperationId: input.operationId,
        dispatchState: "not_dispatched" as const,
        failureCode: null, failureStage: null, status: "pending" as const,
        receipt: null, supplement: null, error: null,
        updatedAt: this.options.now() };
      if (input.screen === 3) {
        state.screen3Contextualizations = [
          ...(state.screen3Contextualizations ?? []),
          { ...common, adviceFingerprint: input.fingerprint,
            ...(explicitUnknownRetry ? { retryUnknownAttemptId: last!.id } : {}),
            packetFingerprint: work.packetFingerprint },
        ];
      } else {
        state.screen6Personalizations = [
          ...(state.screen6Personalizations ?? []),
          { ...common, inputFingerprint: input.fingerprint },
        ];
      }
      const at = this.options.now();
      state.revision += 1;
      state.updatedAt = at;
      state.changeLog.push({ revision: state.revision, at,
        summary: `Screen ${input.screen} recorded explicit authorization for model attempt ${ordinal}.` });
      return { state };
    });
    let context: ReturnType<typeof input.work>;
    try {
      context = input.work(started.privateSnapshot.state);
    } catch {
      return workflowProblemFailure({
        code: "core_state_invalid",
        stage: "execution",
        action,
        operationId: input.operationId,
        screen: input.screen,
        expectedRevision: input.expectedRevision,
        actualRevision: started.privateSnapshot.state.revision,
        commitCertainty: "committed",
        dispatchCertainty: "not_dispatched",
        recovery: "restore_local_artifact",
        safeCauseCodes: ["core_state_invalid"],
      });
    }
    const saved = [...(input.screen === 3
      ? started.privateSnapshot.state.screen3Contextualizations ?? []
      : started.privateSnapshot.state.screen6Personalizations ?? [])]
      .reverse().find((entry) => input.screen === 3
        ? "adviceFingerprint" in entry &&
          entry.adviceFingerprint === input.fingerprint &&
          entry.packetFingerprint === context.packetFingerprint
        : "inputFingerprint" in entry &&
          entry.inputFingerprint === input.fingerprint);
    if (!saved || !started.changed &&
      !saved.receipt) return started;
    const persist = (label: string,
      patch: Partial<NonNullable<
        SixScreenWorkflowState["screen3Contextualizations"]
      >[number]>) => this.persistContextualizationStage(authentication, {
        screen: input.screen, recordId: saved.id,
        reservationId: saved.reservationId,
        fingerprint: input.fingerprint, label,
        expectedClaimOperationId: saved.claimOperationId ?? null,
        patch,
      });
    const ledger = this.options.screen5OpenAILedgerStore;
    const settle = async (usage: Screen5MechanismProviderReceipt["usage"]) => {
      try {
        await ledger?.settle({ reservationId: saved.reservationId, usage,
          now: this.options.now() });
      } catch { /* A disputed settlement retains its conservative reservation. */ }
    };
    const completeSavedReceipt = async (
      receipt: Screen5MechanismProviderReceipt,
    ) => {
      if (input.screen === 3 &&
        !("packetFingerprint" in saved && saved.packetFingerprint)) {
        throw new Error("This historical Screen 3 receipt lacks an exact evidence packet binding and cannot be revalidated automatically.");
      }
      let wire: unknown;
      try {
        if (receipt.usage.promptTokens > input.inputCeiling ||
          receipt.usage.completionTokens > input.outputCeiling) {
          throw new Error("Observed model usage exceeded the authorized profile.");
        }
        wire = validateSavedOpenAIReceipt({ receipt,
          validate: (value) => context.validate(value,
            saved.attemptOrdinal === undefined) });
      } catch {
        await settle(receipt.usage);
        return persist("validation_failed", { status: "validation_failed",
          failureCode: "local_receipt_validation_failed",
          failureStage: "model_output",
          error: `Screen ${input.screen} saved response did not pass local validation.` });
      }
      const result = await persist("completed", { status: "completed",
        supplement: wire, error: null, failureCode: null,
        failureStage: null });
      await settle(receipt.usage);
      return result;
    };
    if (!started.changed) {
      if (!saved.receipt || !["receipt_saved", "validation_failed", "failed"]
        .includes(saved.status)) return started;
      return completeSavedReceipt(saved.receipt);
    }
    if (!ledger) {
      throw new Error("The authorized model ledger is unavailable.");
    }
    let reserved = false;
    let received: Screen5MechanismProviderReceipt | null = null;
    try {
      await this.initializeOpenAIUsage(ledger);
      await ledger.reserve({ reservationId: saved.reservationId,
        jobId: saved.id,
        stage: input.screen === 3
          ? "screen3_contextualization" : "screen6_contextualization",
        reservedTokens: input.reservation, now: this.options.now() });
      reserved = true;
      const claimRead = await this.options.store.read(authentication);
      const claimRecord = claimRead.outcome === "found"
        ? (input.screen === 3
          ? claimRead.record.state.screen3Contextualizations
          : claimRead.record.state.screen6Personalizations)?.find(({ id }) =>
            id === saved.id)
        : null;
      if (!claimRecord || claimRecord.claimOperationId !==
          saved.claimOperationId) {
        // The newer claim owner is solely responsible for this reservation.
        return this.status(authentication);
      }
      let completedWithReceipt = false;
      const response = await context.request({
        onDispatch: async () => {
          await persist("dispatch", { dispatchState: "dispatched" });
          await ledger.recordDispatch({ reservationId: saved.reservationId,
            now: this.options.now() });
        },
        onReceipt: async (receipt) => {
          received = receipt;
          let wire: unknown;
          try {
            if (receipt.usage.promptTokens > input.inputCeiling ||
                receipt.usage.completionTokens > input.outputCeiling) {
              throw new Error("Observed model usage exceeded the authorized profile.");
            }
            wire = validateSavedOpenAIReceipt({ receipt,
              validate: (value) => context.validate(value, false) });
          } catch {
            await persist("receipt_validation_failed", {
              status: "validation_failed", receipt,
              failureCode: "local_receipt_validation_failed",
              failureStage: "model_output",
              error: `Screen ${input.screen} saved response did not pass local validation.`,
            });
            await ledger.recordReceipt({ reservationId: saved.reservationId,
              contentFingerprint: receipt.contentFingerprint,
              now: this.options.now() });
            return;
          }
          // The protected receipt and the displayable artifact are one
          // durable state transition. A host delivery interruption after this
          // callback can no longer strand the UI at `receipt_saved`.
          await persist("receipt_completed", { status: "completed", receipt,
            supplement: wire, error: null, failureCode: null,
            failureStage: null });
          completedWithReceipt = true;
          await ledger.recordReceipt({ reservationId: saved.reservationId,
            contentFingerprint: receipt.contentFingerprint,
            now: this.options.now() });
        },
      });
      if (completedWithReceipt) {
        await settle(response.usage);
        return this.status(authentication);
      }
      const completed = await persist("completed", {
        status: "completed", supplement: response.wire,
        error: null, failureCode: null, failureStage: null,
      });
      await settle(response.usage);
      return completed;
    } catch (caught) {
      const provider = caught instanceof Screen5OpenAIProviderError
        ? caught : null;
      const read = await this.options.store.read(authentication);
      if (read.outcome !== "found") throw caught;
      let record = (input.screen === 3
        ? read.record.state.screen3Contextualizations
        : read.record.state.screen6Personalizations)?.find((item) =>
        item.id === saved.id);
      if (!record) throw caught;
      if ((record.claimOperationId ?? null) !==
          (saved.claimOperationId ?? null)) {
        return this.status(authentication);
      }
      if (record.status === "completed") {
        if (record.receipt) await settle(record.receipt.usage);
        return this.status(authentication);
      }
      if (record.status === "validation_failed" && record.receipt) {
        await settle(record.receipt.usage);
        return this.status(authentication);
      }
      if (!record.receipt && received) {
        try {
          await persist("receipt", { status: "receipt_saved",
            receipt: received });
          record = { ...record, status: "receipt_saved", receipt: received };
        } catch { /* The in-memory response cannot authorize a second request. */ }
      }
      if (record.receipt) {
        await settle(record.receipt.usage);
        if (provider && ["provider_schema_invalid", "provider_json_invalid",
          "observed_budget_exceeded"].includes(provider.detail.code)) {
          return persist("validation_failed", {
            status: "validation_failed",
            failureCode: provider.detail.code,
            failureStage: provider.detail.failureStage ?? "model_output",
            error: `Screen ${input.screen} saved response failed bounded validation.`,
          });
        }
        if (input.screen === 3 && record.status === "receipt_saved") {
          // The receipt-only fallback used to end here, stranding all six
          // cards after even one interrupted artifact write. Finish the same
          // evidence-bound attempt once from its durable receipt. This path
          // neither reserves usage nor invokes the provider a second time.
          try {
            return await completeSavedReceipt(record.receipt);
          } catch {
            // Persistent storage/projection trouble remains recoverable by
            // the existing local recheck action; report it without erasing
            // the receipt or claiming that an assessment was completed.
            return persist("completion_pending", {
              failureCode: "local_artifact_completion_pending",
              failureStage: "persistence",
            });
          }
        }
        return this.status(authentication);
      }
      if (received) {
        // A response observed only in memory cannot be recovered after a
        // restart. Retain the allowance and prohibit another dispatch.
        return persist("outcome_unknown", {
          status: "outcome_unknown", dispatchState: "unknown",
          failureCode: "receipt_persistence_failed",
          failureStage: "persistence",
          error: `Screen ${input.screen} received a response but could not save its protected receipt.`,
        });
      }
      const safeCode = provider?.detail.code ?? provider?.detail.safeCause ??
        (reserved ? "local_persistence_failed" : "ledger_reservation_failed");
      const failureCode = /^[a-z][a-z0-9_]{0,79}$/u.test(safeCode)
        ? safeCode : "model_request_failed";
      const beforeDispatch = record.dispatchState !== "dispatched" &&
        (!provider || provider.detail.networkInvocation === "not_started");
      let released = !reserved;
      if (beforeDispatch && reserved) {
        try {
          await ledger.release({ reservationId: saved.reservationId,
            reasonCode: failureCode, now: this.options.now() });
          released = true;
        } catch { /* Do not retry while a reservation cannot be released. */ }
      }
      if (provider?.detail.usage) await settle(provider.detail.usage);
      const knownFailure = beforeDispatch && released ||
        Boolean(provider?.detail.outcomeKnown &&
          provider.detail.networkInvocation === "invoked");
      return persist(knownFailure ? "failed" : "outcome_unknown", {
        status: knownFailure ? "failed" : "outcome_unknown",
        dispatchState: beforeDispatch && released
          ? "not_dispatched" : provider?.detail.dispatched
            ? "dispatched" : "unknown",
        failureCode,
        failureStage: provider?.detail.failureStage ??
          (reserved ? "persistence" : "admission"),
        error: beforeDispatch && released
          ? `Screen ${input.screen} model request stopped before dispatch (${failureCode}).`
          : knownFailure
            ? `Screen ${input.screen} provider response failed (${failureCode}).`
            : `Screen ${input.screen} provider outcome is unknown (${failureCode}).`,
      });
    }
  }

  /** Explicit bounded Screen 3 review; saved library warnings remain usable. */
  async personalizeScreen3(
    authentication: SixScreenWorkflowAuthentication,
    input: { expectedRevision: number; operationId: string;
      expectedAdviceFingerprint: string; retryUnknownAttemptId?: string },
  ) {
    return this.contextualizeWithDurableAttempt(authentication, {
      ...input, screen: 3,
      fingerprint: input.expectedAdviceFingerprint,
      inputCeiling: SCREEN3_CONTEXTUALIZER_INPUT_CEILING,
      outputCeiling: SCREEN3_CONTEXTUALIZER_OUTPUT_CEILING,
      reservation: SCREEN3_CONTEXTUALIZER_RESERVATION,
      work: (state) => {
        const advice = currentStudyDesignAdvice(state);
        if (!advice) {
          throw new Error("Current Screen 3 study and design advice are unavailable.");
        }
        const packet = screen3ContextualPacket(state, advice);
        return {
          fingerprint: advice.adviceFingerprint,
          packetFingerprint: fingerprintSixScreenValue(packet),
          estimate: estimateScreen3Contextualization(state, advice),
          validate: (value: unknown, historical: boolean) =>
            validateScreen3ContextualCritique(value, advice,
              historical ? undefined : packet),
          request: (callbacks: {
            onDispatch: () => Promise<void>;
            onReceipt: (receipt: Screen5MechanismProviderReceipt) => Promise<void>;
          }) => requestScreen3Contextualization({
            apiKey: this.options.screen5OpenAIApiKey!,
            fetch: this.options.screen5OpenAIFetch!,
            state, advice, now: this.options.now, ...callbacks,
          }),
        };
      },
    });
  }

  /** Explicit bounded Screen 6 review; reads and exports never dispatch. */
  async personalizeScreen6(
    authentication: SixScreenWorkflowAuthentication,
    input: { expectedRevision: number; operationId: string;
      expectedPlanFingerprint: string },
  ) {
    let read: Awaited<ReturnType<SixScreenWorkflowStore["read"]>>;
    try {
      read = await this.options.store.read(authentication);
    } catch {
      return workflowProblemFailure({
        code: "core_state_invalid",
        action: "personalize_screen6_plan",
        operationId: input.operationId,
        screen: 6,
        expectedRevision: input.expectedRevision,
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        recovery: "none",
        safeCauseCodes: ["core_state_invalid"],
      });
    }
    if (read.outcome !== "found") {
      return workflowProblemFailure({
        code: "authorization",
        action: "personalize_screen6_plan",
        operationId: input.operationId,
        screen: 6,
        expectedRevision: input.expectedRevision,
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        recovery: "reconnect",
        safeCauseCodes: [read.outcome === "unauthorized"
          ? "authorization_failed" : "run_unavailable"],
      });
    }
    if (!screen6PrerequisiteReport(read.record.state).ready) {
      return workflowProblemFailure({
        code: "core_state_invalid",
        action: "personalize_screen6_plan",
        operationId: input.operationId,
        screen: 6,
        expectedRevision: input.expectedRevision,
        actualRevision: read.record.state.revision,
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        recovery: "none",
        safeCauseCodes: ["core_state_invalid"],
      });
    }
    let currentPlan: ReturnType<typeof createScreen6CurrentPlan>;
    try {
      currentPlan = createScreen6CurrentPlan(read.record.state);
    } catch {
      return workflowProblemFailure({
        code: "core_state_invalid",
        action: "personalize_screen6_plan",
        operationId: input.operationId,
        screen: 6,
        expectedRevision: input.expectedRevision,
        actualRevision: read.record.state.revision,
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        recovery: "none",
        safeCauseCodes: ["core_state_invalid"],
      });
    }
    if (currentPlan.inputFingerprint !== input.expectedPlanFingerprint) {
      return workflowProblemFailure({
        code: "operation_identity_conflict",
        action: "personalize_screen6_plan",
        operationId: input.operationId,
        screen: 6,
        expectedRevision: input.expectedRevision,
        actualRevision: read.record.state.revision,
        commitCertainty: "not_committed",
        dispatchCertainty: "not_dispatched",
        recovery: "none",
        safeCauseCodes: ["operation_conflict"],
      });
    }
    const compatible = new Set(
      screen6CompatibleInputFingerprints(currentPlan),
    );
    if ((read.record.state.screen6Personalizations ?? []).some((record) =>
      record.status === "completed" &&
      compatible.has(record.inputFingerprint))) {
      // A completed, locally validated compatible artifact is already saved;
      // status recovery must never spend another model request.
      return this.status(authentication);
    }
    return this.contextualizeWithDurableAttempt(authentication, {
      ...input, screen: 6,
      fingerprint: input.expectedPlanFingerprint,
      inputCeiling: SCREEN6_CONTEXTUALIZER_INPUT_CEILING,
      outputCeiling: SCREEN6_CONTEXTUALIZER_OUTPUT_CEILING,
      reservation: SCREEN6_CONTEXTUALIZER_RESERVATION,
      work: (state) => {
        const plan = createScreen6CurrentPlan(state);
        return {
          fingerprint: plan.inputFingerprint,
          estimate: estimateScreen6Contextualization(state, plan),
          validate: (value: unknown) => validateScreen6Contextualization(value,
            plan),
          request: (callbacks: {
            onDispatch: () => Promise<void>;
            onReceipt: (receipt: Screen5MechanismProviderReceipt) => Promise<void>;
          }) => requestScreen6Contextualization({
            apiKey: this.options.screen5OpenAIApiKey!,
            fetch: this.options.screen5OpenAIFetch!,
            state, plan, now: this.options.now, ...callbacks,
          }),
        };
      },
    });
  }

  initializeScreen6UncertaintyProfile(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
    },
  ) {
    const coordinate = fingerprintSixScreenValue(input.operationId).slice(
      "fnv1a64:".length,
    );
    return this.mutation(authentication, {
      ...input,
      operationKind: "initialize_screen6_uncertainty_profile",
      payload: { expectedRevision: input.expectedRevision },
    }, (state) => {
      const initialized = initializeScreen6UncertaintyProfile(state, {
        expectedRevision: input.expectedRevision,
        snapshotId: `screen6-uncertainty-profile-${coordinate}`,
        actor: "researcher_ui",
        createdAt: this.options.now(),
      });
      return { state: initialized.state, result: initialized.profile };
    });
  }

  saveScreen6DiagnosticPlan(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      diagnosticInput: Omit<
        Screen6DiagnosticPlanInput,
        "schemaVersion" | "inputFingerprint"
      >;
    },
  ) {
    const diagnosticInput = createScreen6DiagnosticPlanInput(
      input.diagnosticInput,
    );
    const coordinate = fingerprintSixScreenValue(input.operationId).slice(
      "fnv1a64:".length,
    );
    return this.mutation(authentication, {
      expectedRevision: input.expectedRevision,
      operationId: input.operationId,
      operationKind: "save_screen6_diagnostic_plan",
      payload: {
        expectedRevision: input.expectedRevision,
        diagnosticInput,
      },
    }, (state) => {
      const saved = saveScreen6DiagnosticPlan(state, {
        expectedRevision: input.expectedRevision,
        snapshotId: `screen6-diagnostic-plan-${coordinate}`,
        diagnosticInput,
        actor: "researcher_ui",
        createdAt: this.options.now(),
      });
      return { state: saved.state, result: saved.plan };
    });
  }

  recordScreen6DiagnosticResult(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      cardId: string;
      expectedPlanFingerprint: string;
      expectedCardFingerprint: string;
      resultInput: Omit<
        Screen6DiagnosticResultInput,
        "schemaVersion" | "inputFingerprint"
      >;
    },
  ) {
    const resultInput = createScreen6DiagnosticResultInput(input.resultInput);
    const coordinate = fingerprintSixScreenValue(input.operationId).slice(
      "fnv1a64:".length,
    );
    return this.mutation(authentication, {
      expectedRevision: input.expectedRevision,
      operationId: input.operationId,
      operationKind: "record_screen6_diagnostic_result",
      payload: {
        expectedRevision: input.expectedRevision,
        cardId: input.cardId,
        expectedPlanFingerprint: input.expectedPlanFingerprint,
        expectedCardFingerprint: input.expectedCardFingerprint,
        resultInput,
      },
    }, (state) => {
      const recorded = recordScreen6DiagnosticResult(state, {
        expectedRevision: input.expectedRevision,
        resultId: `screen6-diagnostic-result-${coordinate}`,
        cardId: input.cardId,
        expectedPlanFingerprint: input.expectedPlanFingerprint,
        expectedCardFingerprint: input.expectedCardFingerprint,
        resultInput,
        actor: "researcher_ui",
        submittedAt: this.options.now(),
      });
      return { state: recorded.state, result: recorded.result };
    });
  }

  reviewScreen6DiagnosticResult(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      resultId: string;
      expectedResultFingerprint: string;
      decision: Screen6DiagnosticResultReviewDecision;
      rationale: string;
      followUpActions: string[];
    },
  ) {
    const coordinate = fingerprintSixScreenValue(input.operationId).slice(
      "fnv1a64:".length,
    );
    return this.mutation(authentication, {
      ...input,
      operationKind: "review_screen6_diagnostic_result",
      payload: {
        expectedRevision: input.expectedRevision,
        resultId: input.resultId,
        expectedResultFingerprint: input.expectedResultFingerprint,
        decision: input.decision,
        rationale: input.rationale,
        followUpActions: input.followUpActions,
      },
    }, (state) => {
      const reviewed = reviewScreen6DiagnosticResult(state, {
        expectedRevision: input.expectedRevision,
        reviewId: `screen6-diagnostic-result-review-${coordinate}`,
        resultId: input.resultId,
        expectedResultFingerprint: input.expectedResultFingerprint,
        decision: input.decision,
        rationale: input.rationale,
        followUpActions: input.followUpActions,
        actor: "researcher_ui",
        reviewedAt: this.options.now(),
      });
      return { state: reviewed.state, result: reviewed.review };
    });
  }

  saveScreen6ConditionalClaimBoundary(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      expectedPlanFingerprint: string;
      claimInput: Omit<
        Screen6ClaimBoundaryInput,
        "schemaVersion" | "inputFingerprint"
      >;
    },
  ) {
    const claimInput = createScreen6ClaimBoundaryInput(input.claimInput);
    const coordinate = fingerprintSixScreenValue(input.operationId).slice(
      "fnv1a64:".length,
    );
    return this.mutation(authentication, {
      expectedRevision: input.expectedRevision,
      operationId: input.operationId,
      operationKind: "save_screen6_conditional_claim_boundary",
      payload: {
        expectedRevision: input.expectedRevision,
        expectedPlanFingerprint: input.expectedPlanFingerprint,
        claimInput,
      },
    }, (state) => {
      const saved = saveScreen6ConditionalClaimBoundary(state, {
        expectedRevision: input.expectedRevision,
        snapshotId: `screen6-conditional-claim-${coordinate}`,
        expectedPlanFingerprint: input.expectedPlanFingerprint,
        claimInput,
        actor: "researcher_ui",
        createdAt: this.options.now(),
      });
      return { state: saved.state, result: saved.boundary };
    });
  }

  recordScreen6ResearchPlanningDisposition(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      expectedBoundaryFingerprint: string;
      decision: Screen6ResearchPlanningDispositionDecision;
      rationale: string;
      specifiedRevisions: string[];
    },
  ) {
    const coordinate = fingerprintSixScreenValue(input.operationId).slice(
      "fnv1a64:".length,
    );
    return this.mutation(authentication, {
      ...input,
      operationKind: "record_screen6_research_planning_disposition",
      payload: {
        expectedRevision: input.expectedRevision,
        expectedBoundaryFingerprint: input.expectedBoundaryFingerprint,
        decision: input.decision,
        rationale: input.rationale,
        specifiedRevisions: input.specifiedRevisions,
      },
    }, (state) => {
      const recorded = recordScreen6ResearchPlanningDisposition(state, {
        expectedRevision: input.expectedRevision,
        dispositionId: `screen6-research-disposition-${coordinate}`,
        expectedBoundaryFingerprint: input.expectedBoundaryFingerprint,
        decision: input.decision,
        rationale: input.rationale,
        specifiedRevisions: input.specifiedRevisions,
        actor: "researcher_ui",
        decidedAt: this.options.now(),
      });
      return { state: recorded.state, result: recorded.disposition };
    });
  }

  createScreen6ResearchExport(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      expectedDispositionFingerprint: string;
    },
  ) {
    const coordinate = fingerprintSixScreenValue(input.operationId).slice(
      "fnv1a64:".length,
    );
    return this.mutation(authentication, {
      ...input,
      operationKind: "create_screen6_research_export",
      payload: {
        expectedRevision: input.expectedRevision,
        expectedDispositionFingerprint:
          input.expectedDispositionFingerprint,
      },
    }, (state) => {
      const created = createScreen6ResearchExportRecord(state, {
        expectedRevision: input.expectedRevision,
        exportId: `screen6-research-export-${coordinate}`,
        expectedDispositionFingerprint:
          input.expectedDispositionFingerprint,
        actor: "researcher_ui",
        exportedAt: this.options.now(),
      });
      return { state: created.state, result: created.researchExport };
    });
  }

  async saveMechanismLiteraturePlan(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      planInput: Omit<
        MechanismLiteraturePlanInput,
        "schemaVersion" | "inputFingerprint"
      >;
    },
  ) {
    const planInput = createMechanismLiteraturePlanInput(input.planInput);
    const coordinate = fingerprintSixScreenValue(input.operationId).slice(
      "fnv1a64:".length,
    );
    const mutationInput = {
      ...input,
      operationKind: "save_mechanism_literature_plan",
      payload: planInput,
    };
    const existing = await this.options.store.read(authentication);
    if (
      existing.outcome === "found" &&
      existing.record.operationReplays.some(({ operationId }) =>
        operationId === input.operationId
      )
    ) {
      return this.mutation(authentication, mutationInput, () => {
        throw new Error("A persisted Screen 5 replay unexpectedly invoked its updater.");
      });
    }
    if (existing.outcome !== "found") {
      throw new Error("The authorized Screen 5 workflow is unavailable.");
    }
    this.requireLegacyScreen5SourceWorkAllowed(existing.record);
    const probes = this.options.autoProbeSourceCapabilities
      ? await probeConfiguredSixScreenSources({
        fetch: this.options.fetch,
        now: this.options.now,
        secrets: { openAlexApiKey: this.options.openAlexApiKey },
        includeCrossref: true,
        existingProbes: this.options.sourceCapabilityProbes,
      })
      : this.options.sourceCapabilityProbes;
    const sourceRegister = buildSixScreenSourceRegister({
      configuredSecrets: this.options.configuredSourceSecrets,
      probes,
    });
    return this.mutation(authentication, mutationInput, (state) => {
      const saved = saveMechanismLiteraturePlan(state, {
        expectedRevision: input.expectedRevision,
        snapshotId: `mechanism-literature-plan-${coordinate}`,
        planInput,
        capabilities: {
          openalex: sourceRegister.openalex,
          crossref: sourceRegister.crossref,
        },
        savedAt: this.options.now(),
      });
      return { state: saved.state, result: saved.plan };
    });
  }

  saveCoEventSearchMatrix(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      scopeInput: Omit<
        CoEventSearchScopeInput,
        "schemaVersion" | "inputFingerprint"
      >;
    },
  ) {
    const scopeInput = createCoEventSearchScopeInput(input.scopeInput);
    const coordinate = fingerprintSixScreenValue(input.operationId).slice(
      "fnv1a64:".length,
    );
    return this.mutation(authentication, {
      ...input,
      operationKind: "save_coevent_search_matrix",
      payload: scopeInput,
    }, (state) => {
      const saved = saveCoEventSearchMatrix(state, {
        expectedRevision: input.expectedRevision,
        snapshotId: `coevent-search-matrix-${coordinate}`,
        scopeInput,
        savedAt: this.options.now(),
      });
      return { state: saved.state, result: saved.matrix };
    });
  }

  reviewCoEventOccurrence(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      candidateId: string;
      expectedCandidateFingerprint: string;
      decision: CoEventOccurrenceReviewDecision;
      rationale: string;
    },
  ) {
    const coordinate = fingerprintSixScreenValue(input.operationId).slice(
      "fnv1a64:".length,
    );
    return this.mutation(authentication, {
      ...input,
      operationKind: "review_coevent_occurrence",
      payload: {
        candidateId: input.candidateId,
        expectedCandidateFingerprint: input.expectedCandidateFingerprint,
        decision: input.decision,
        rationale: input.rationale,
      },
    }, (state) => {
      const reviewed = reviewCoEventOccurrence(state, {
        expectedRevision: input.expectedRevision,
        reviewId: `coevent-occurrence-review-${coordinate}`,
        candidateId: input.candidateId,
        expectedCandidateFingerprint: input.expectedCandidateFingerprint,
        decision: input.decision,
        rationale: input.rationale,
        actor: "researcher_ui",
        reviewedAt: this.options.now(),
      });
      return { state: reviewed.state, result: reviewed.review };
    });
  }

  reviewCoEventRelation(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      candidateId: string;
      expectedCandidateFingerprint: string;
      expectedOccurrenceReviewId: string;
      expectedOccurrenceReviewFingerprint: string;
      decision: CoEventRelationReviewDecision;
      rationale: string;
    },
  ) {
    const coordinate = fingerprintSixScreenValue(input.operationId).slice(
      "fnv1a64:".length,
    );
    return this.mutation(authentication, {
      ...input,
      operationKind: "review_coevent_relation",
      payload: {
        candidateId: input.candidateId,
        expectedCandidateFingerprint: input.expectedCandidateFingerprint,
        expectedOccurrenceReviewId: input.expectedOccurrenceReviewId,
        expectedOccurrenceReviewFingerprint:
          input.expectedOccurrenceReviewFingerprint,
        decision: input.decision,
        rationale: input.rationale,
      },
    }, (state) => {
      const reviewed = reviewCoEventRelation(state, {
        expectedRevision: input.expectedRevision,
        reviewId: `coevent-relation-review-${coordinate}`,
        candidateId: input.candidateId,
        expectedCandidateFingerprint: input.expectedCandidateFingerprint,
        expectedOccurrenceReviewId: input.expectedOccurrenceReviewId,
        expectedOccurrenceReviewFingerprint:
          input.expectedOccurrenceReviewFingerprint,
        decision: input.decision,
        rationale: input.rationale,
        actor: "researcher_ui",
        reviewedAt: this.options.now(),
      });
      return { state: reviewed.state, result: reviewed.review };
    });
  }

  reviewCoEventDuplicatePair(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      leftCandidateId: string;
      leftCandidateFingerprint: string;
      rightCandidateId: string;
      rightCandidateFingerprint: string;
      decision: CoEventDuplicateReviewDecision;
      rationale: string;
    },
  ) {
    const coordinate = fingerprintSixScreenValue(input.operationId).slice(
      "fnv1a64:".length,
    );
    return this.mutation(authentication, {
      ...input,
      operationKind: "review_coevent_duplicate_pair",
      payload: {
        leftCandidateId: input.leftCandidateId,
        leftCandidateFingerprint: input.leftCandidateFingerprint,
        rightCandidateId: input.rightCandidateId,
        rightCandidateFingerprint: input.rightCandidateFingerprint,
        decision: input.decision,
        rationale: input.rationale,
      },
    }, (state) => {
      const reviewed = reviewCoEventDuplicatePair(state, {
        expectedRevision: input.expectedRevision,
        reviewId: `coevent-duplicate-review-${coordinate}`,
        leftCandidateId: input.leftCandidateId,
        leftCandidateFingerprint: input.leftCandidateFingerprint,
        rightCandidateId: input.rightCandidateId,
        rightCandidateFingerprint: input.rightCandidateFingerprint,
        decision: input.decision,
        rationale: input.rationale,
        actor: "researcher_ui",
        reviewedAt: this.options.now(),
      });
      return { state: reviewed.state, result: reviewed.review };
    });
  }

  async routeCoEventPolicyStageToScreen2(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      candidateId: string;
      expectedCandidateFingerprint: string;
      expectedOccurrenceReviewId: string;
      expectedOccurrenceReviewFingerprint: string;
      stageKind: CoEventPolicyLifecycleStageKind;
      rationale: string;
    },
  ) {
    const projection = await this.currentPolicyLifecycleMutationProjection(
      authentication,
      input,
    );
    const coordinate = fingerprintSixScreenValue(input.operationId).slice(
      "fnv1a64:".length,
    );
    const payload = {
      candidateId: input.candidateId,
      expectedCandidateFingerprint: input.expectedCandidateFingerprint,
      expectedOccurrenceReviewId: input.expectedOccurrenceReviewId,
      expectedOccurrenceReviewFingerprint:
        input.expectedOccurrenceReviewFingerprint,
      stageKind: input.stageKind,
      rationale: input.rationale,
    };
    const applied = await this.mutation(authentication, {
      expectedRevision: input.expectedRevision,
      operationId: input.operationId,
      operationKind: "route_coevent_policy_stage_to_screen_2",
      payload,
    }, (state) => {
      if (!projection) {
        throw new Error(
          "A policy-stage handoff replay lost its stored operation result.",
        );
      }
      const routed = routeCoEventPolicyStageToScreen2(state, {
        expectedRevision: input.expectedRevision,
        handoffId: `coevent-policy-lifecycle-handoff-${coordinate}`,
        targetReviewId: `policy-event-card-lifecycle-review-${coordinate}`,
        candidateId: input.candidateId,
        expectedCandidateFingerprint: input.expectedCandidateFingerprint,
        expectedOccurrenceReviewId: input.expectedOccurrenceReviewId,
        expectedOccurrenceReviewFingerprint:
          input.expectedOccurrenceReviewFingerprint,
        stageKind: input.stageKind,
        rationale: input.rationale,
        projection,
        actor: "researcher_ui",
        routedAt: this.options.now(),
      });
      return {
        state: routed.state,
        result: { handoff: routed.handoff, review: routed.review },
      };
    });
    const workspace = projection && !applied.replayed
      ? policyEventCardWorkspaceFromProjection(
          applied.privateSnapshot.state,
          projection,
        )
      : await this.policyEventCardWorkspace(
          authentication,
          applied.privateSnapshot.state,
          false,
        );
    const result = applied.result as {
      handoff: CoEventPolicyLifecycleHandoff;
      review: PolicyEventCardReviewState;
    };
    return {
      ...applied,
      projection: {
        ...applied.projection,
        policyEventCardWorkspace: workspace,
      },
      handoff: structuredClone(result.handoff),
      review: structuredClone(result.review),
    };
  }

  private policyLifecycleStageApplyOperationId(operationId: string) {
    const coordinate = fingerprintSixScreenValue(operationId).slice(
      "fnv1a64:".length,
    );
    return `policy-lifecycle-stage-apply-${coordinate}`;
  }

  private async replayedPolicyLifecycleStageAcquisition(
    record: SixScreenWorkflowStoreRecord,
    authentication: SixScreenWorkflowAuthentication,
    input: {
      operationId: string;
      handoffId: string;
      expectedHandoffFingerprint: string;
    },
  ) {
    const replay = record.operationReplays.find(({ operationId: savedId }) =>
      savedId === this.policyLifecycleStageApplyOperationId(input.operationId));
    if (!replay) return null;
    if (replay.operationKind !== "acquire_policy_lifecycle_stage_apply") {
      throw new Error("Six-screen operation id was reused for different input.");
    }
    const acquisition = replay.result as
      PolicyLifecycleStageDocumentAcquisition;
    if (
      !acquisition || replay.inputFingerprint !== fingerprintSixScreenValue({
        handoffId: input.handoffId,
        expectedHandoffFingerprint: input.expectedHandoffFingerprint,
        acquisitionId: acquisition.id,
        acquisitionFingerprint: acquisition.acquisitionFingerprint,
      })
    ) throw new Error("Stored policy-lifecycle acquisition replay is invalid.");
    return {
      projection: await this.projectionWithPolicyEventCardWorkspace(
        authentication,
        record.state,
      ),
      privateSnapshot: snapshot(record, authentication.accessToken),
      acquisition: structuredClone(acquisition),
      replayed: true,
    };
  }

  private async currentPolicyLifecycleStageContext(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      handoffId: string;
      expectedHandoffFingerprint: string;
    },
  ) {
    const read = await this.options.store.read(authentication);
    if (read.outcome !== "found") {
      throw new Error(read.outcome === "unauthorized"
        ? "Six-screen workflow access is unauthorized."
        : "Six-screen workflow is unavailable or expired.");
    }
    const workflow = read.record.state;
    if (workflow.revision !== input.expectedRevision) {
      throw new Error(
        `Stale six-screen workflow mutation; current revision is ${workflow.revision}.`,
      );
    }
    if (workflow.activeScreen !== 2 || !workflow.confirmedShock) {
      throw new Error(
        "Policy-lifecycle stage-document acquisition requires Screen 2 and a confirmed policy.",
      );
    }
    const handoff = (workflow.coEventPolicyLifecycleHandoffs ?? []).find(
      ({ id }) => id === input.handoffId,
    );
    if (
      !handoff || handoff.handoffFingerprint !==
        input.expectedHandoffFingerprint ||
      handoff.focalPolicyReference.identityFingerprint !==
        workflow.confirmedShock.identityFingerprint
    ) throw new Error("The policy-lifecycle handoff changed before acquisition.");
    const candidate = (workflow.coEventCandidates ?? []).find(({ id }) =>
      id === handoff.candidateReference.candidateId);
    if (
      !candidate || candidate.candidateFingerprint !==
        handoff.candidateReference.candidateFingerprint
    ) throw new Error("The routed Screen 4 occurrence evidence is unavailable.");
    const targetReview = (workflow.policyEventCardReviews ?? []).at(-1);
    if (
      !targetReview || targetReview.status !== "in_review" ||
      targetReview.id !== handoff.destination.policyEventCardReviewId
    ) throw new Error(
      "Policy-lifecycle acquisition requires the current routed Event Card revision.",
    );
    const acquisitions = (workflow.policyLifecycleStageDocumentAcquisitions ?? [])
      .filter(({ handoffReference }) =>
        handoffReference.handoffId === handoff.id);
    const latest = acquisitions.at(-1) ?? null;
    if (
      candidate.providerId !== "federal_register" ||
      acquisitions.length >=
        SIX_SCREEN_POLICY_LIFECYCLE_MAX_ACQUISITIONS_PER_HANDOFF ||
      latest?.outcome === "document_retained" ||
      (latest && latest.outcome !== "source_unavailable")
    ) throw new Error(
      candidate.providerId !== "federal_register"
        ? "This first bounded lifecycle-document adapter supports exact Federal Register records only."
        : "The policy-lifecycle document is already retained or cannot be retried.",
    );
    return {
      record: read.record,
      workflow,
      confirmedShock: workflow.confirmedShock,
      handoff,
      candidate,
      acquisitions,
    };
  }

  private async applyPolicyLifecycleStageAcquisition(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      handoffId: string;
      expectedHandoffFingerprint: string;
    },
    acquisition: PolicyLifecycleStageDocumentAcquisition,
  ) {
    const applied = await this.mutation(authentication, {
      expectedRevision: input.expectedRevision,
      operationId: this.policyLifecycleStageApplyOperationId(
        input.operationId,
      ),
      operationKind: "acquire_policy_lifecycle_stage_apply",
      payload: {
        handoffId: input.handoffId,
        expectedHandoffFingerprint: input.expectedHandoffFingerprint,
        acquisitionId: acquisition.id,
        acquisitionFingerprint: acquisition.acquisitionFingerprint,
      },
    }, (state) => {
      const recorded = recordPolicyLifecycleStageDocumentAcquisition(state, {
        expectedRevision: input.expectedRevision,
        acquisition,
        recordedAt: acquisition.acquiredAt,
      });
      return { state: recorded.state, result: recorded.acquisition };
    });
    return {
      projection: await this.projectionWithPolicyEventCardWorkspace(
        authentication,
        applied.privateSnapshot.state,
        applied.projection,
      ),
      privateSnapshot: applied.privateSnapshot,
      acquisition: structuredClone(
        applied.result as PolicyLifecycleStageDocumentAcquisition,
      ),
      replayed: applied.replayed,
    };
  }

  async acquirePolicyLifecycleStageDocument(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      handoffId: string;
      expectedHandoffFingerprint: string;
    },
  ) {
    const taskStore = this.options.taskStore;
    if (!taskStore) {
      throw new Error(
        "Policy-lifecycle stage-document acquisition requires the durable task store.",
      );
    }
    const replayRead = await this.options.store.read(authentication);
    if (replayRead.outcome === "found") {
      const replay = await this.replayedPolicyLifecycleStageAcquisition(
        replayRead.record,
        authentication,
        input,
      );
      if (replay) return replay;
    }
    const context = await this.currentPolicyLifecycleStageContext(
      authentication,
      input,
    );
    const actionCoordinate = fingerprintSixScreenValue(input.operationId).slice(
      "fnv1a64:".length,
    );
    const acquisitionId = `policy-lifecycle-acquisition-${actionCoordinate}`;
    const taskCoordinate = fingerprintSixScreenValue({
      protocol: SIX_SCREEN_POLICY_LIFECYCLE_STAGE_WORKSPACE_SCHEMA_VERSION,
      handoffFingerprint: context.handoff.handoffFingerprint,
    }).slice("fnv1a64:".length);
    const taskId = `policy-lifecycle-gap-task-${taskCoordinate}`;
    const workId = `official-stage-document-${taskCoordinate}`;
    const immutableRequest = {
      protocol: SIX_SCREEN_POLICY_LIFECYCLE_STAGE_WORKSPACE_SCHEMA_VERSION,
      studyRevision: context.workflow.study.revision,
      identityFingerprint: context.confirmedShock.identityFingerprint,
      handoffId: context.handoff.id,
      handoffFingerprint: context.handoff.handoffFingerprint,
      candidateId: context.candidate.id,
      candidateFingerprint: context.candidate.candidateFingerprint,
      providerId: context.candidate.providerId,
      formalIdentifiers: [...context.candidate.formalIdentifiers],
      officialSourceLocators: context.candidate.evidence.map(
        ({ sourceId, locator }) => ({ sourceId, locator }),
      ),
      workId,
    };
    const taskAuthentication = { ...authentication, taskId };
    const taskRead = await taskStore.read(taskAuthentication);
    if (taskRead.outcome === "unauthorized") {
      throw new Error("Policy-lifecycle gap task access is unauthorized.");
    }
    let taskRecord: SixScreenResearchTaskRecord;
    if (taskRead.outcome === "found") {
      taskRecord = taskRead.record;
      if (
        taskRecord.task.requestHash !==
          fingerprintSixScreenValue(immutableRequest) ||
        taskRecord.task.kind !== "gap"
      ) throw new Error("Stored policy-lifecycle gap task lineage is invalid.");
    } else {
      const createdAt = this.options.now();
      const task = createResearchTask({
        id: taskId,
        runId: context.workflow.runId,
        kind: "gap",
        parent: {
          studyRevision: context.workflow.study.revision,
          identityFingerprint: context.confirmedShock.identityFingerprint,
          eventCardSnapshotId:
            context.handoff.focalPolicyReference.eventCardReference
              .eventCardSnapshotId,
          selectedDesignSnapshotId: null,
          coeventSnapshotId:
            context.handoff.sourceExecutionReference.executionSnapshotId,
          mechanismSnapshotId: null,
        },
        immutableRequest,
        profileName: "gap-standard",
        pendingWorkIds: [workId],
        unresolvedRequirementIds: [workId],
        continuationMode: "panel_driven",
        createdAt,
        absoluteDeadline: instantAfter(
          createdAt,
          SIX_SCREEN_WORKFLOW_RESUME_RETENTION_MS,
        ),
        expiresAt: instantAfter(
          createdAt,
          SIX_SCREEN_WORKFLOW_RESUME_RETENTION_MS,
        ),
      });
      const created = await taskStore.create({
        task,
        accessToken: authentication.accessToken,
        createInputFingerprint: fingerprintSixScreenValue(immutableRequest),
      });
      if (created.outcome === "conflict") {
        throw new Error(
          "Policy-lifecycle gap task coordinate was reused for different input.",
        );
      }
      taskRecord = created.record;
    }

    const commitMutationId =
      `policy-lifecycle-stage-commit-${actionCoordinate}`;
    const recovered = taskRecord.operationReplays.find(({ operationId }) =>
      operationId === commitMutationId)?.result as
        PolicyLifecycleStageDocumentAcquisition | undefined;
    if (recovered) {
      return this.applyPolicyLifecycleStageAcquisition(
        authentication,
        input,
        recovered,
      );
    }

    const now = this.options.now();
    const priorReservation = [...taskRecord.task.operations].reverse().find(
      ({ status }) => status === "reserved",
    );
    if (priorReservation) {
      if (Date.parse(priorReservation.leaseExpiresAt) > Date.parse(now)) {
        throw new Error(
          "Policy-lifecycle official-document acquisition is already running.",
        );
      }
      const expired = await taskStore.mutate({
        ...taskAuthentication,
        expectedRevision: taskRecord.task.revision,
        operationId: `policy-lifecycle-stage-expire-${actionCoordinate}`,
        operationKind: "expire_policy_lifecycle_stage_lease",
        inputFingerprint: priorReservation.inputFingerprint,
        updatedAt: now,
      }, (stored) => {
        const outcome = expireResearchTaskOperation(stored, {
          expectedRevision: stored.revision,
          operationId: priorReservation.operationId,
          inputFingerprint: priorReservation.inputFingerprint,
          generation: priorReservation.generation,
          expiredAt: now,
        });
        return { task: outcome.task, result: { retired: true } };
      });
      if (expired.outcome !== "updated" && expired.outcome !== "replayed") {
        throw new Error(
          `Policy-lifecycle lease recovery failed (${expired.outcome}).`,
        );
      }
      taskRecord = expired.record;
    }

    const sourceOperationId =
      `policy-lifecycle-stage-source-${actionCoordinate}`;
    const sourceInputFingerprint = fingerprintSixScreenValue({
      requestHash: taskRecord.task.requestHash,
      acquisitionOrdinal:
        (context.workflow.policyLifecycleStageDocumentAcquisitions ?? [])
          .length + 1,
      operationId: input.operationId,
    });
    const reserved = await taskStore.mutate({
      ...taskAuthentication,
      expectedRevision: taskRecord.task.revision,
      operationId: `policy-lifecycle-stage-reserve-${actionCoordinate}`,
      operationKind: "reserve_policy_lifecycle_stage_document",
      inputFingerprint: sourceInputFingerprint,
      updatedAt: now,
    }, (stored) => {
      const outcome = reserveResearchTaskOperation(stored, {
        expectedRevision: stored.revision,
        operationId: sourceOperationId,
        inputFingerprint: sourceInputFingerprint,
        reservation: {
          sourceQueries: 0,
          metadataRecords: 0,
          documentAttempts: 2,
          usefulDocuments: 1,
          transportHops: 6,
          maximumReceivedBytes: 4 * 1024 * 1024,
          maximumDecodedBytes: 4 * 1024 * 1024,
          maximumActiveResearchMs: 25_000,
          maximumCpuMs: 2_000,
          providerCostUnits: {},
        },
        reservedAt: now,
        leaseExpiresAt: instantAfter(now, 30_000),
      });
      if (outcome.outcome !== "reserved") {
        throw new Error(
          `Policy-lifecycle document reservation failed (${outcome.outcome}${
            "limit" in outcome ? `: ${outcome.limit}` : ""
          }).`,
        );
      }
      return { task: outcome.task, result: outcome.operation };
    });
    if (reserved.outcome !== "updated" && reserved.outcome !== "replayed") {
      throw new Error(
        `Policy-lifecycle task persistence failed (${reserved.outcome}).`,
      );
    }
    if (reserved.outcome === "replayed") {
      const restored = reserved.record.operationReplays.find(
        ({ operationId }) => operationId === commitMutationId,
      )?.result as PolicyLifecycleStageDocumentAcquisition | undefined;
      if (restored) {
        return this.applyPolicyLifecycleStageAcquisition(
          authentication,
          input,
          restored,
        );
      }
      throw new Error(
        "Policy-lifecycle official-document acquisition is already running.",
      );
    }
    const sourceOperation = reserved.record.task.operations.find(
      ({ operationId }) => operationId === sourceOperationId,
    );
    if (!sourceOperation) {
      throw new Error("Policy-lifecycle task lost its document-operation lease.");
    }
    const acquisitionResult =
      await acquireScreen02PolicyLifecycleStageDocument({
        candidate: context.candidate,
        confirmedShock: context.confirmedShock,
        coordinate: actionCoordinate,
        fetch: this.options.fetch,
        retrievedAt: this.options.now(),
        monotonicNow: this.options.monotonicNow,
      });
    const acquiredAt = this.options.now();
    const acquisition = createPolicyLifecycleStageDocumentAcquisition({
      id: acquisitionId,
      ordinal:
        (context.workflow.policyLifecycleStageDocumentAcquisitions ?? [])
          .length + 1,
      handoff: context.handoff,
      candidate: context.candidate,
      adapterVersion: acquisitionResult.adapterVersion,
      attemptedSources: acquisitionResult.attemptedSources,
      outcome: acquisitionResult.outcome,
      failureCode: acquisitionResult.failureCode,
      limitation: acquisitionResult.limitation,
      source: acquisitionResult.source,
      usage: acquisitionResult.usage,
      acquiredAt,
    });
    const retryable = acquisition.outcome === "source_unavailable" &&
      context.acquisitions.length + 1 <
        SIX_SCREEN_POLICY_LIFECYCLE_MAX_ACQUISITIONS_PER_HANDOFF;
    const committed = await taskStore.mutate({
      ...taskAuthentication,
      expectedRevision: reserved.record.task.revision,
      operationId: commitMutationId,
      operationKind: "commit_policy_lifecycle_stage_document",
      inputFingerprint: sourceInputFingerprint,
      updatedAt: acquiredAt,
    }, (stored) => {
      const outcome = commitResearchTaskOperation(stored, {
        expectedRevision: stored.revision,
        operationId: sourceOperationId,
        inputFingerprint: sourceInputFingerprint,
        generation: sourceOperation.generation,
        actualUsage: acquisition.usage,
        completedWorkIds: retryable ? [] : [workId],
        remainingWorkIds: retryable ? [workId] : [],
        unresolvedRequirementIds:
          acquisition.outcome === "document_retained" ? [] : [workId],
        nextState: acquisition.outcome === "document_retained"
          ? "completed"
          : retryable
            ? "waiting_source"
            : "partial",
        stopReason: acquisition.limitation,
        resultFingerprint: acquisition.acquisitionFingerprint,
        committedAt: acquiredAt,
      });
      return { task: outcome.task, result: acquisition };
    });
    if (committed.outcome !== "updated" && committed.outcome !== "replayed") {
      throw new Error(
        `Policy-lifecycle task result persistence failed (${committed.outcome}).`,
      );
    }
    return this.applyPolicyLifecycleStageAcquisition(
      authentication,
      input,
      committed.result as PolicyLifecycleStageDocumentAcquisition,
    );
  }

  async reviewPolicyLifecycleStageDocument(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      handoffId: string;
      expectedHandoffFingerprint: string;
      acquisitionId: string;
      expectedAcquisitionFingerprint: string;
      decision: PolicyLifecycleStageDispositionDecision;
      rationale: string;
    },
  ) {
    const coordinate = fingerprintSixScreenValue(input.operationId).slice(
      "fnv1a64:".length,
    );
    const applied = await this.mutation(authentication, {
      expectedRevision: input.expectedRevision,
      operationId: input.operationId,
      operationKind: "review_policy_lifecycle_stage_document",
      payload: {
        handoffId: input.handoffId,
        expectedHandoffFingerprint: input.expectedHandoffFingerprint,
        acquisitionId: input.acquisitionId,
        expectedAcquisitionFingerprint: input.expectedAcquisitionFingerprint,
        decision: input.decision,
        rationale: input.rationale,
      },
    }, (state) => {
      const reviewed = reviewPolicyLifecycleStageDocument(state, {
        expectedRevision: input.expectedRevision,
        dispositionId: `policy-lifecycle-disposition-${coordinate}`,
        handoffId: input.handoffId,
        expectedHandoffFingerprint: input.expectedHandoffFingerprint,
        acquisitionId: input.acquisitionId,
        expectedAcquisitionFingerprint: input.expectedAcquisitionFingerprint,
        decision: input.decision,
        rationale: input.rationale,
        actor: "researcher_ui",
        reviewedAt: this.options.now(),
      });
      return { state: reviewed.state, result: reviewed.disposition };
    });
    return {
      projection: await this.projectionWithPolicyEventCardWorkspace(
        authentication,
        applied.privateSnapshot.state,
        applied.projection,
      ),
      privateSnapshot: applied.privateSnapshot,
      disposition: structuredClone(
        applied.result as PolicyLifecycleStageDisposition,
      ),
      replayed: applied.replayed,
    };
  }

  async proposePolicyLifecycleStageRevision(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      handoffId: string;
      expectedHandoffFingerprint: string;
      dispositionId: string;
      expectedDispositionFingerprint: string;
      chronologyStage: PolicyChronologyStage;
      sourceDateId: string | null;
      rationale: string;
    },
  ) {
    const coordinate = fingerprintSixScreenValue(input.operationId).slice(
      "fnv1a64:".length,
    );
    const applied = await this.mutation(authentication, {
      expectedRevision: input.expectedRevision,
      operationId: input.operationId,
      operationKind: "propose_policy_lifecycle_stage_revision",
      payload: {
        handoffId: input.handoffId,
        expectedHandoffFingerprint: input.expectedHandoffFingerprint,
        dispositionId: input.dispositionId,
        expectedDispositionFingerprint: input.expectedDispositionFingerprint,
        chronologyStage: input.chronologyStage,
        sourceDateId: input.sourceDateId,
        rationale: input.rationale,
      },
    }, (state) => {
      const proposed = proposePolicyLifecycleStageRevision(state, {
        expectedRevision: input.expectedRevision,
        proposalId: `policy-lifecycle-proposal-${coordinate}`,
        handoffId: input.handoffId,
        expectedHandoffFingerprint: input.expectedHandoffFingerprint,
        dispositionId: input.dispositionId,
        expectedDispositionFingerprint: input.expectedDispositionFingerprint,
        chronologyStage: input.chronologyStage,
        sourceDateId: input.sourceDateId,
        rationale: input.rationale,
        actor: "researcher_ui",
        proposedAt: this.options.now(),
      });
      return { state: proposed.state, result: proposed.proposal };
    });
    return {
      projection: await this.projectionWithPolicyEventCardWorkspace(
        authentication,
        applied.privateSnapshot.state,
        applied.projection,
      ),
      privateSnapshot: applied.privateSnapshot,
      proposal: structuredClone(
        applied.result as PolicyLifecycleStageRevisionProposal,
      ),
      replayed: applied.replayed,
    };
  }

  async reviewPolicyLifecycleStageRevision(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      proposalId: string;
      expectedProposalFingerprint: string;
      decision: PolicyLifecycleStageRevisionDecision;
      rationale: string;
    },
  ) {
    const coordinate = fingerprintSixScreenValue(input.operationId).slice(
      "fnv1a64:".length,
    );
    const applied = await this.mutation(authentication, {
      expectedRevision: input.expectedRevision,
      operationId: input.operationId,
      operationKind: "review_policy_lifecycle_stage_revision",
      payload: {
        proposalId: input.proposalId,
        expectedProposalFingerprint: input.expectedProposalFingerprint,
        decision: input.decision,
        rationale: input.rationale,
      },
    }, (state) => {
      const reviewed = reviewPolicyLifecycleStageRevision(state, {
        expectedRevision: input.expectedRevision,
        reviewId: `policy-lifecycle-proposal-review-${coordinate}`,
        proposalId: input.proposalId,
        expectedProposalFingerprint: input.expectedProposalFingerprint,
        decision: input.decision,
        rationale: input.rationale,
        actor: "researcher_ui",
        reviewedAt: this.options.now(),
      });
      return { state: reviewed.state, result: reviewed.review };
    });
    return {
      projection: await this.projectionWithPolicyEventCardWorkspace(
        authentication,
        applied.privateSnapshot.state,
        applied.projection,
      ),
      privateSnapshot: applied.privateSnapshot,
      review: structuredClone(
        applied.result as PolicyLifecycleStageRevisionReview,
      ),
      replayed: applied.replayed,
    };
  }

  private mechanismLiteratureApplyOperationId(operationId: string) {
    const coordinate = fingerprintSixScreenValue(operationId).slice(
      "fnv1a64:".length,
    );
    return `mechanism-literature-apply-${coordinate}`;
  }

  private replayedMechanismLiteratureApply(
    record: SixScreenWorkflowStoreRecord,
    authentication: SixScreenWorkflowAuthentication,
    operationId: string,
  ) {
    const applyOperationId = this.mechanismLiteratureApplyOperationId(
      operationId,
    );
    const replay = record.operationReplays.find(({ operationId: saved }) =>
      saved === applyOperationId);
    if (!replay) return null;
    if (replay.operationKind !== "continue_mechanism_literature_search_apply") {
      throw new Error("Six-screen operation id was reused for different input.");
    }
    return {
      projection: publicProjection(record.state),
      privateSnapshot: snapshot(record, authentication.accessToken),
      result: structuredClone(replay.result),
      replayed: true,
    };
  }

  private latestCommittedMechanismLiteratureCheckpoint(
    record: SixScreenResearchTaskRecord,
  ) {
    return [...record.operationReplays].reverse().find(
      ({ operationKind }) =>
        operationKind === "commit_mechanism_literature_step" ||
        operationKind === "commit_mechanism_literature_no_route",
    )?.result as MechanismLiteratureStepCheckpoint | undefined;
  }

  private async currentMechanismLiteratureWorkflow(
    authentication: SixScreenWorkflowAuthentication,
    expectedRevision: number,
  ) {
    const read = await this.options.store.read(authentication);
    if (read.outcome !== "found") {
      if (read.outcome === "unauthorized") {
        throw new Error("Six-screen workflow access is unauthorized.");
      }
      throw new Error("Six-screen workflow is unavailable or expired.");
    }
    const workflow = read.record.state;
    if (workflow.revision !== expectedRevision) {
      throw new Error(
        `Stale six-screen workflow mutation; current revision is ${workflow.revision}.`,
      );
    }
    if (workflow.activeScreen !== 5) {
      throw new Error("Literature execution requires Screen 5 to be open.");
    }
    const literaturePlan = currentMechanismLiteraturePlan(workflow);
    if (!literaturePlan || !screen5PrerequisiteReport(workflow).ready) {
      throw new Error(
        "Literature execution requires the current Screen 5 literature plan.",
      );
    }
    const execution = currentMechanismLiteratureExecution(workflow);
    const packet = currentScholarlyEvidencePacket(workflow);
    const recordMap = new Map(
      (workflow.scholarlyMetadataRecords ?? []).map((record) =>
        [record.id, record]),
    );
    const records = (execution?.scholarlyMetadataRecordIds ?? []).map((id) => {
      const record = recordMap.get(id);
      if (!record) throw new Error("Screen 5 execution lost scholarly metadata.");
      return record;
    });
    return {
      record: read.record,
      workflow,
      literaturePlan,
      execution,
      packet,
      records,
    };
  }

  private async applyMechanismLiteratureCheckpoint(
    authentication: SixScreenWorkflowAuthentication,
    input: { expectedRevision: number; operationId: string },
    checkpoint: MechanismLiteratureStepCheckpoint,
  ) {
    const applied = await this.mutation(authentication, {
      expectedRevision: input.expectedRevision,
      operationId: this.mechanismLiteratureApplyOperationId(input.operationId),
      operationKind: "continue_mechanism_literature_search_apply",
      payload: {
        checkpointFingerprint: checkpoint.checkpointFingerprint,
        executionSnapshotId: checkpoint.execution.snapshotId,
        executionFingerprint: checkpoint.execution.executionFingerprint,
        packetSnapshotId: checkpoint.packet.snapshotId,
        packetFingerprint: checkpoint.packet.packetFingerprint,
      },
    }, (state) => {
      const recorded = recordMechanismLiteratureExecution(state, {
        expectedRevision: input.expectedRevision,
        executionSnapshotId: checkpoint.execution.snapshotId,
        packetSnapshotId: checkpoint.packet.snapshotId,
        executionPlan: checkpoint.executionPlan,
        attempt: checkpoint.attempt,
        records: checkpoint.newRecords,
        recordedAt: checkpoint.execution.recordedAt,
      });
      if (
        recorded.execution.executionFingerprint !==
          checkpoint.execution.executionFingerprint ||
        recorded.packet.packetFingerprint !== checkpoint.packet.packetFingerprint
      ) throw new Error(
        "Screen 5 provider checkpoint changed during durable application.",
      );
      return {
        state: recorded.state,
        result: {
          executionSnapshotId: recorded.execution.snapshotId,
          executionFingerprint: recorded.execution.executionFingerprint,
          packetSnapshotId: recorded.packet.snapshotId,
          packetFingerprint: recorded.packet.packetFingerprint,
          attemptOutcome: recorded.execution.attempt?.outcome ?? null,
        },
      };
    });
    return applied;
  }

  async continueMechanismLiteratureSearch(
    authentication: SixScreenWorkflowAuthentication,
    input: { expectedRevision: number; operationId: string },
  ) {
    const taskStore = this.options.taskStore;
    if (!taskStore) {
      throw new Error(
        "Screen 5 literature execution is unavailable until the durable task store is configured.",
      );
    }
    const replayRead = await this.options.store.read(authentication);
    if (replayRead.outcome === "found") {
      const replay = this.replayedMechanismLiteratureApply(
        replayRead.record,
        authentication,
        input.operationId,
      );
      if (replay) return replay;
    }
    if (replayRead.outcome !== "found") {
      throw new Error("The authorized Screen 5 workflow is unavailable.");
    }
    this.requireLegacyScreen5SourceWorkAllowed(replayRead.record);
    const current = await this.currentMechanismLiteratureWorkflow(
      authentication,
      input.expectedRevision,
    );
    if (current.execution?.status === "complete") {
      throw new Error("The current Screen 5 metadata plan is already complete.");
    }
    const taskCandidates = [
      SIX_SCREEN_MECHANISM_LITERATURE_EXECUTOR_VERSION,
      SIX_SCREEN_MECHANISM_LITERATURE_EXECUTOR_LEGACY_VERSION,
    ].map((executor) => {
      const coordinate = fingerprintSixScreenValue({
        executor,
        literaturePlanFingerprint: current.literaturePlan.planFingerprint,
      }).slice("fnv1a64:".length);
      return {
        executor,
        coordinate,
        taskId: `mechanism-literature-task-${coordinate}`,
      };
    });
    let selectedTask = taskCandidates[0]!;
    let taskRead = await taskStore.read({
      ...authentication,
      taskId: selectedTask.taskId,
    });
    if (taskRead.outcome === "unauthorized") {
      throw new Error("Screen 5 literature task access is unauthorized.");
    }
    if (taskRead.outcome === "not_found") {
      const legacyTask = taskCandidates[1]!;
      const legacyRead = await taskStore.read({
        ...authentication,
        taskId: legacyTask.taskId,
      });
      if (legacyRead.outcome === "unauthorized") {
        throw new Error("Screen 5 literature task access is unauthorized.");
      }
      if (legacyRead.outcome === "found") {
        selectedTask = legacyTask;
        taskRead = legacyRead;
      }
    }
    const taskCoordinate = selectedTask.coordinate;
    const taskId = selectedTask.taskId;
    const taskAuthentication = { ...authentication, taskId };
    let taskRecord: SixScreenResearchTaskRecord;
    let executionPlan: MechanismLiteratureExecutionPlan;
    if (taskRead.outcome === "found") {
      taskRecord = taskRead.record;
      const request = taskRecord.task.immutableRequest as {
        protocolVersion?: string;
        executionPlan?: MechanismLiteratureExecutionPlan;
      };
      if (
        !isSupportedMechanismLiteratureExecutorVersion(
          request.protocolVersion,
        ) ||
        request.protocolVersion !== selectedTask.executor ||
        !request.executionPlan
      ) throw new Error("The saved Screen 5 task omitted its immutable plan.");
      executionPlan = validateMechanismLiteratureExecutionPlan(
        request.executionPlan,
        current.literaturePlan,
      );
      const recovered = this.latestCommittedMechanismLiteratureCheckpoint(
        taskRecord,
      );
      if (
        recovered &&
        !(current.workflow.mechanismLiteratureExecutions ?? []).some(
          ({ snapshotId }) => snapshotId === recovered.execution.snapshotId,
        )
      ) {
        validateMechanismLiteratureStepCheckpoint(
          recovered,
          current.literaturePlan,
        );
        return this.applyMechanismLiteratureCheckpoint(
          authentication,
          input,
          recovered,
        );
      }
    } else {
      const createdAt = this.options.now();
      executionPlan = createMechanismLiteratureExecutionPlan({
        id: `mechanism-literature-execution-plan-${taskCoordinate}`,
        literaturePlan: current.literaturePlan,
        createdAt,
      });
      const immutableRequest = {
        protocolVersion: SIX_SCREEN_MECHANISM_LITERATURE_EXECUTOR_VERSION,
        executionPlan,
      };
      const taskExpiresAt = instantAfter(
        createdAt,
        SIX_SCREEN_WORKFLOW_RESUME_RETENTION_MS,
      );
      const decision = currentCausalDesignDecision(current.workflow);
      const task = createResearchTask({
        id: taskId,
        runId: current.workflow.runId,
        kind: "mechanism",
        parent: {
          studyRevision: current.literaturePlan.binding.studyRevision,
          identityFingerprint:
            current.literaturePlan.binding.identityFingerprint,
          eventCardSnapshotId: current.literaturePlan.binding
            .eventCardReference.eventCardSnapshotId,
          selectedDesignSnapshotId:
            decision?.selectedDesign?.snapshotId ?? null,
          coeventSnapshotId:
            current.literaturePlan.binding.coEventSnapshotId,
          mechanismSnapshotId: current.literaturePlan.snapshotId,
        },
        immutableRequest,
        profileName: "mechanism-standard",
        pendingWorkIds: executionPlan.steps.filter(({ initialStatus }) =>
          initialStatus === "pending").map(({ id }) => id),
        unresolvedRequirementIds: executionPlan.steps.filter(
          ({ initialStatus }) => initialStatus !== "pending",
        ).map(({ id }) => id),
        continuationMode: "panel_driven",
        createdAt,
        absoluteDeadline: taskExpiresAt,
        expiresAt: taskExpiresAt,
      });
      const created = await taskStore.create({
        task,
        accessToken: authentication.accessToken,
        createInputFingerprint: fingerprintSixScreenValue(immutableRequest),
      });
      if (created.outcome === "conflict") {
        throw new Error("Screen 5 task coordinate was reused for different input.");
      }
      taskRecord = created.record;
    }

    const nextStepId = taskRecord.task.pendingWorkIds[0] ?? null;
    if (!nextStepId) {
      if (current.execution) {
        throw new Error("The saved Screen 5 task and execution progress disagree.");
      }
      const recordedAt = this.options.now();
      const execution = createMechanismLiteratureExecution({
        snapshotId: `mechanism-literature-execution-${taskCoordinate}-empty`,
        ordinal: 1,
        literaturePlan: current.literaturePlan,
        executionPlan,
        previous: null,
        attempt: null,
        newMetadataRecordIds: [],
        recordedAt,
      });
      const packet = createScholarlyEvidencePacket({
        snapshotId: `scholarly-evidence-packet-${taskCoordinate}-empty`,
        ordinal: 1,
        literaturePlan: current.literaturePlan,
        execution,
        previous: null,
        records: [],
        createdAt: recordedAt,
      });
      const checkpoint = createMechanismLiteratureStepCheckpoint({
        executionPlan,
        attempt: null,
        newRecords: [],
        records: [],
        execution,
        packet,
      });
      const noRouteInputFingerprint = fingerprintSixScreenValue({
        requestHash: taskRecord.task.requestHash,
        executionPlanFingerprint: executionPlan.planFingerprint,
        outcome: "no_executable_provider_route",
      });
      const noRouteOperationId =
        `mechanism-literature-no-route-${taskCoordinate}`;
      const zeroReservation = {
        sourceQueries: 0,
        metadataRecords: 0,
        documentAttempts: 0,
        usefulDocuments: 0,
        transportHops: 0,
        maximumReceivedBytes: 0,
        maximumDecodedBytes: 0,
        maximumActiveResearchMs: 0,
        maximumCpuMs: 0,
        providerCostUnits: {},
      };
      const reserved = await taskStore.mutate({
        ...taskAuthentication,
        expectedRevision: taskRecord.task.revision,
        operationId: `mechanism-literature-reserve-no-route-${taskCoordinate}`,
        operationKind: "reserve_mechanism_literature_no_route",
        inputFingerprint: noRouteInputFingerprint,
        updatedAt: recordedAt,
      }, (stored) => {
        const outcome = reserveResearchTaskOperation(stored, {
          expectedRevision: stored.revision,
          operationId: noRouteOperationId,
          inputFingerprint: noRouteInputFingerprint,
          reservation: zeroReservation,
          reservedAt: recordedAt,
          leaseExpiresAt: instantAfter(recordedAt, 30_000),
        });
        if (outcome.outcome !== "reserved") {
          throw new Error(
            `Screen 5 no-route reservation failed (${outcome.outcome}).`,
          );
        }
        return { task: outcome.task, result: outcome.operation };
      });
      if (reserved.outcome !== "updated" && reserved.outcome !== "replayed") {
        throw new Error(
          `Screen 5 no-route task persistence failed (${reserved.outcome}).`,
        );
      }
      const operation = reserved.record.task.operations.find(({ operationId }) =>
        operationId === noRouteOperationId);
      if (!operation) {
        throw new Error("Screen 5 no-route task lost its durable operation.");
      }
      const committedAt = this.options.now();
      const committed = await taskStore.mutate({
        ...taskAuthentication,
        expectedRevision: reserved.record.task.revision,
        operationId: `mechanism-literature-commit-no-route-${taskCoordinate}`,
        operationKind: "commit_mechanism_literature_no_route",
        inputFingerprint: noRouteInputFingerprint,
        updatedAt: committedAt,
      }, (stored) => {
        const outcome = commitResearchTaskOperation(stored, {
          expectedRevision: stored.revision,
          operationId: noRouteOperationId,
          inputFingerprint: noRouteInputFingerprint,
          generation: operation.generation,
          actualUsage: {
            sourceQueries: 0,
            metadataRecords: 0,
            documentAttempts: 0,
            usefulDocuments: 0,
            transportHops: 0,
            receivedBytes: 0,
            decodedBytes: 0,
            activeResearchMs: 0,
            cpuMs: 0,
            providerCostUnits: {},
          },
          completedWorkIds: [],
          remainingWorkIds: [],
          unresolvedRequirementIds: stored.unresolvedRequirementIds,
          nextState: "partial",
          stopReason:
            "No tested scholarly metadata provider route was executable.",
          resultFingerprint: checkpoint.checkpointFingerprint,
          committedAt,
        });
        return { task: outcome.task, result: checkpoint };
      });
      if (committed.outcome !== "updated" && committed.outcome !== "replayed") {
        throw new Error(
          `Screen 5 no-route result persistence failed (${committed.outcome}).`,
        );
      }
      const saved = validateMechanismLiteratureStepCheckpoint(
        committed.result as MechanismLiteratureStepCheckpoint,
        current.literaturePlan,
      );
      return this.applyMechanismLiteratureCheckpoint(
        authentication,
        input,
        saved,
      );
    }
    const expectedNextStep = current.execution?.remainingStepIds[0] ??
      executionPlan.steps.find(({ initialStatus }) =>
        initialStatus === "pending")?.id;
    if (nextStepId !== expectedNextStep) {
      throw new Error("The saved Screen 5 task does not match visible progress.");
    }
    let reservedTaskRecord = taskRecord;
    const now = this.options.now();
    const priorReservation = [...taskRecord.task.operations].reverse().find(
      ({ status }) => status === "reserved",
    );
    if (priorReservation) {
      if (Date.parse(priorReservation.leaseExpiresAt) > Date.parse(now)) {
        throw new Error(
          "Screen 5 literature research is already running. Reopen after its bounded lease expires.",
        );
      }
      const expired = await taskStore.mutate({
        ...taskAuthentication,
        expectedRevision: taskRecord.task.revision,
        operationId: `mechanism-literature-expire-${priorReservation.generation}`,
        operationKind: "expire_mechanism_literature_source_lease",
        inputFingerprint: priorReservation.inputFingerprint,
        updatedAt: now,
      }, (stored) => {
        const outcome = expireResearchTaskOperation(stored, {
          expectedRevision: stored.revision,
          operationId: priorReservation.operationId,
          inputFingerprint: priorReservation.inputFingerprint,
          generation: priorReservation.generation,
          expiredAt: now,
        });
        return { task: outcome.task, result: { retired: true } };
      });
      if (expired.outcome !== "updated" && expired.outcome !== "replayed") {
        throw new Error(
          `Screen 5 task lease recovery failed (${expired.outcome}).`,
        );
      }
      reservedTaskRecord = expired.record;
    }
    const step = executionPlan.steps.find(({ id }) => id === nextStepId)!;
    if (step.providerId === "openalex" && !this.options.openAlexApiKey) {
      throw new Error(
        "The saved Screen 5 OpenAlex capability lost its server-side credential.",
      );
    }
    const actionCoordinate = fingerprintSixScreenValue(input.operationId).slice(
      "fnv1a64:".length,
    );
    const attemptNumber = reservedTaskRecord.task.operations.length + 1;
    const sourceOperationId =
      `mechanism-literature-source-${attemptNumber}-${actionCoordinate}`;
    const sourceInputFingerprint = fingerprintSixScreenValue({
      requestHash: reservedTaskRecord.task.requestHash,
      previousExecutionFingerprint:
        current.execution?.executionFingerprint ?? null,
      stepId: step.id,
      attemptNumber,
    });
    const reservation = {
      sourceQueries: 1,
      metadataRecords: step.plannedLimit,
      documentAttempts: 0,
      usefulDocuments: 0,
      transportHops: 1,
      maximumReceivedBytes: 192_000,
      maximumDecodedBytes: 192_000,
      maximumActiveResearchMs: 20_000,
      maximumCpuMs: 3_000,
      providerCostUnits: {},
    };
    const reserved = await taskStore.mutate({
      ...taskAuthentication,
      expectedRevision: reservedTaskRecord.task.revision,
      operationId:
        `mechanism-literature-reserve-${attemptNumber}-${actionCoordinate}`,
      operationKind: "reserve_mechanism_literature_source",
      inputFingerprint: sourceInputFingerprint,
      updatedAt: now,
    }, (stored) => {
      const outcome = reserveResearchTaskOperation(stored, {
        expectedRevision: stored.revision,
        operationId: sourceOperationId,
        inputFingerprint: sourceInputFingerprint,
        reservation,
        reservedAt: now,
        leaseExpiresAt: instantAfter(now, 30_000),
      });
      if (outcome.outcome !== "reserved") {
        throw new Error(
          `Screen 5 provider reservation failed (${outcome.outcome}${
            "limit" in outcome ? `: ${outcome.limit}` : ""
          }).`,
        );
      }
      return { task: outcome.task, result: outcome.operation };
    });
    if (reserved.outcome !== "updated" && reserved.outcome !== "replayed") {
      throw new Error(`Screen 5 task persistence failed (${reserved.outcome}).`);
    }
    if (reserved.outcome === "replayed") {
      const recovered = this.latestCommittedMechanismLiteratureCheckpoint(
        reserved.record,
      );
      if (recovered) {
        validateMechanismLiteratureStepCheckpoint(
          recovered,
          current.literaturePlan,
        );
        return this.applyMechanismLiteratureCheckpoint(
          authentication,
          input,
          recovered,
        );
      }
      throw new Error("Screen 5 literature research is already running.");
    }
    const sourceOperation = reserved.record.task.operations.find(
      ({ operationId }) => operationId === sourceOperationId,
    );
    if (!sourceOperation) {
      throw new Error("Screen 5 task lost its provider-operation lease.");
    }
    const providerResult: MechanismLiteratureProviderExecutionResult =
      await executeMechanismLiteratureProviderStep({
        attemptId:
          `mechanism-literature-attempt-${attemptNumber}-${actionCoordinate}`,
        executionPlan,
        literaturePlan: current.literaturePlan,
        step,
        fetch: this.options.fetch,
        ...(this.options.openAlexApiKey
          ? { openAlexApiKey: this.options.openAlexApiKey }
          : {}),
        now: this.options.now,
        monotonicNow: this.options.monotonicNow,
      });
    const recordedAt = this.options.now();
    const execution = createMechanismLiteratureExecution({
      snapshotId:
        `mechanism-literature-execution-${attemptNumber}-${actionCoordinate}`,
      ordinal: (current.execution?.ordinal ?? 0) + 1,
      literaturePlan: current.literaturePlan,
      executionPlan,
      previous: current.execution,
      attempt: providerResult.attempt,
      newMetadataRecordIds: providerResult.records.map(({ id }) => id),
      recordedAt,
    });
    const cumulativeRecords = [...current.records, ...providerResult.records];
    const packet = createScholarlyEvidencePacket({
      snapshotId:
        `scholarly-evidence-packet-${attemptNumber}-${actionCoordinate}`,
      ordinal: (current.packet?.ordinal ?? 0) + 1,
      literaturePlan: current.literaturePlan,
      execution,
      previous: current.packet,
      records: cumulativeRecords,
      createdAt: recordedAt,
    });
    const checkpoint = createMechanismLiteratureStepCheckpoint({
      executionPlan,
      attempt: providerResult.attempt,
      newRecords: providerResult.records,
      records: cumulativeRecords,
      execution,
      packet,
    });
    const remainingWorkIds = reserved.record.task.pendingWorkIds.filter(
      (id) => id !== step.id,
    );
    const unresolvedRequirementIds = [
      ...executionPlan.steps.filter(({ initialStatus }) =>
        initialStatus !== "pending").map(({ id }) => id),
      ...(["source_unavailable", "records_unusable", "unsupported_request"]
          .includes(providerResult.attempt.outcome)
        ? [step.id]
        : []),
    ];
    const committedAt = this.options.now();
    const committed = await taskStore.mutate({
      ...taskAuthentication,
      expectedRevision: reserved.record.task.revision,
      operationId:
        `mechanism-literature-commit-${attemptNumber}-${actionCoordinate}`,
      operationKind: "commit_mechanism_literature_step",
      inputFingerprint: sourceInputFingerprint,
      updatedAt: committedAt,
    }, (stored) => {
      const outcome = commitResearchTaskOperation(stored, {
        expectedRevision: stored.revision,
        operationId: sourceOperationId,
        inputFingerprint: sourceInputFingerprint,
        generation: sourceOperation.generation,
        actualUsage: providerResult.attempt.usage,
        completedWorkIds: [step.id],
        remainingWorkIds,
        unresolvedRequirementIds,
        nextState: remainingWorkIds.length
          ? "queued"
          : unresolvedRequirementIds.length
            ? "partial"
            : "completed",
        stopReason: remainingWorkIds.length
          ? null
          : execution.actualSearchBoundary.stopReason,
        resultFingerprint: checkpoint.checkpointFingerprint,
        committedAt,
      });
      return { task: outcome.task, result: checkpoint };
    });
    if (committed.outcome !== "updated" && committed.outcome !== "replayed") {
      throw new Error(
        `Screen 5 task result persistence failed (${committed.outcome}).`,
      );
    }
    const saved = validateMechanismLiteratureStepCheckpoint(
      committed.result as MechanismLiteratureStepCheckpoint,
      current.literaturePlan,
    );
    return this.applyMechanismLiteratureCheckpoint(
      authentication,
      input,
      saved,
    );
  }

  private scholarlyDocumentApplyOperationId(operationId: string) {
    const coordinate = fingerprintSixScreenValue(operationId).slice(
      "fnv1a64:".length,
    );
    return `scholarly-document-apply-${coordinate}`;
  }

  private replayedScholarlyDocumentApply(
    record: SixScreenWorkflowStoreRecord,
    authentication: SixScreenWorkflowAuthentication,
    operationId: string,
    requestFingerprint: string,
  ) {
    const applyOperationId = this.scholarlyDocumentApplyOperationId(operationId);
    const replay = record.operationReplays.find(({ operationId: saved }) =>
      saved === applyOperationId);
    if (!replay) return null;
    if (replay.operationKind !== "inspect_scholarly_document_apply") {
      throw new Error("Six-screen operation id was reused for different input.");
    }
    const result = replay.result as { requestFingerprint?: string };
    if (result.requestFingerprint !== requestFingerprint) {
      throw new Error(
        "Six-screen operation id was reused for different scholarly document input.",
      );
    }
    return {
      projection: publicProjection(record.state),
      privateSnapshot: snapshot(record, authentication.accessToken),
      result: structuredClone(replay.result),
      replayed: true,
    };
  }

  private async currentScholarlyDocumentWorkflow(
    authentication: SixScreenWorkflowAuthentication,
    expectedRevision: number,
  ) {
    const read = await this.options.store.read(authentication);
    if (read.outcome !== "found") {
      if (read.outcome === "unauthorized") {
        throw new Error("Six-screen workflow access is unauthorized.");
      }
      throw new Error("Six-screen workflow is unavailable or expired.");
    }
    const workflow = read.record.state;
    if (workflow.revision !== expectedRevision) {
      throw new Error(
        `Stale six-screen workflow mutation; current revision is ${workflow.revision}.`,
      );
    }
    if (workflow.activeScreen !== 5) {
      throw new Error("Scholarly document inspection requires Screen 5 to be open.");
    }
    const literaturePlan = currentMechanismLiteraturePlan(workflow);
    const metadataExecution = currentMechanismLiteratureExecution(workflow);
    const metadataPacket = currentScholarlyEvidencePacket(workflow);
    if (
      !literaturePlan || !metadataExecution ||
      metadataExecution.status !== "complete" || !metadataPacket ||
      !screen5PrerequisiteReport(workflow).ready
    ) throw new Error(
      "Scholarly document inspection requires the completed current metadata packet.",
    );
    const recordMap = new Map(
      (workflow.scholarlyMetadataRecords ?? []).map((record) =>
        [record.id, record]),
    );
    const metadataRecords = metadataExecution.scholarlyMetadataRecordIds.map(
      (id) => {
        const record = recordMap.get(id);
        if (!record) throw new Error("Screen 5 lost scholarly metadata.");
        return record;
      },
    );
    const acquisitions = (workflow.scholarlyDocumentAcquisitions ?? [])
      .filter((acquisition) =>
        acquisition.plan.binding.metadataPacketSnapshotId ===
          metadataPacket.snapshotId &&
        acquisition.plan.binding.metadataPacketFingerprint ===
          metadataPacket.packetFingerprint);
    if (
      acquisitions.length >= SIX_SCREEN_SCHOLARLY_DOCUMENT_MAX_ACQUISITIONS
    ) throw new Error("The current scholarly-document attempt budget is exhausted.");
    return {
      record: read.record,
      workflow,
      literaturePlan,
      metadataExecution,
      metadataPacket,
      metadataRecords,
      acquisitions,
      passagePacket: currentScholarlyPassagePacket(workflow),
    };
  }

  private async applyScholarlyDocumentCheckpoint(
    authentication: SixScreenWorkflowAuthentication,
    input: { expectedRevision: number; operationId: string },
    checkpoint: ScholarlyDocumentCheckpoint,
  ) {
    return this.mutation(authentication, {
      expectedRevision: input.expectedRevision,
      operationId: this.scholarlyDocumentApplyOperationId(input.operationId),
      operationKind: "inspect_scholarly_document_apply",
      payload: {
        checkpointFingerprint: checkpoint.checkpointFingerprint,
        acquisitionId: checkpoint.acquisition.id,
        acquisitionFingerprint: checkpoint.acquisition.acquisitionFingerprint,
        passagePacketSnapshotId: checkpoint.passagePacket.snapshotId,
        passagePacketFingerprint: checkpoint.passagePacket.packetFingerprint,
      },
    }, (state) => {
      const recorded = recordScholarlyDocumentAcquisition(state, {
        expectedRevision: input.expectedRevision,
        packetSnapshotId: checkpoint.passagePacket.snapshotId,
        acquisition: checkpoint.acquisition,
        recordedAt: checkpoint.acquisition.completedAt,
      });
      if (
        recorded.packet.packetFingerprint !==
          checkpoint.passagePacket.packetFingerprint
      ) throw new Error(
        "Scholarly document checkpoint changed during durable application.",
      );
      return {
        state: recorded.state,
        result: {
          requestFingerprint:
            checkpoint.acquisition.plan.input.inputFingerprint,
          acquisitionId: recorded.acquisition.id,
          acquisitionFingerprint:
            recorded.acquisition.acquisitionFingerprint,
          outcome: recorded.acquisition.outcome,
          passagePacketSnapshotId: recorded.packet.snapshotId,
          passagePacketFingerprint: recorded.packet.packetFingerprint,
        },
      };
    });
  }

  async inspectScholarlyDocument(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      inspectionInput: Omit<
        ScholarlyDocumentInspectionInput,
        "schemaVersion" | "inputFingerprint"
      >;
    },
  ) {
    const taskStore = this.options.taskStore;
    if (!taskStore) {
      throw new Error(
        "Scholarly document inspection is unavailable until the durable task store is configured.",
      );
    }
    const request = createScholarlyDocumentInspectionInput(
      input.inspectionInput,
    );
    validateScholarlyDocumentInspectionInput(request);
    const replayRead = await this.options.store.read(authentication);
    if (replayRead.outcome === "found") {
      const replay = this.replayedScholarlyDocumentApply(
        replayRead.record,
        authentication,
        input.operationId,
        request.inputFingerprint,
      );
      if (replay) return replay;
    }
    if (replayRead.outcome !== "found") {
      throw new Error("The authorized Screen 5 workflow is unavailable.");
    }
    this.requireLegacyScreen5SourceWorkAllowed(replayRead.record);
    const current = await this.currentScholarlyDocumentWorkflow(
      authentication,
      input.expectedRevision,
    );
    if (!buildScholarlyDocumentTargets({
      literaturePlan: current.literaturePlan,
      metadataRecords: current.metadataRecords,
    }).some(({ id }) => id === request.targetId)) {
      throw new Error("The scholarly document target is not in the current packet.");
    }
    const permittedHosts = [...new Set(
      (this.options.scholarlyDocumentHosts ?? []).map((host) =>
        host.trim().toLocaleLowerCase("en-US")
      ),
    )].sort();
    const capabilityTested =
      this.options.scholarlyDocumentCapabilityTested === true;
    const taskCoordinate = fingerprintSixScreenValue({
      adapter: SIX_SCREEN_SCHOLARLY_DOCUMENT_ADAPTER_VERSION,
      literaturePlanFingerprint: current.literaturePlan.planFingerprint,
      metadataPacketFingerprint: current.metadataPacket.packetFingerprint,
    }).slice("fnv1a64:".length);
    const taskId = `scholarly-document-task-${taskCoordinate}`;
    const taskAuthentication = { ...authentication, taskId };
    const immutableRequest = {
      protocolVersion: SIX_SCREEN_SCHOLARLY_DOCUMENT_ADAPTER_VERSION,
      literaturePlanSnapshotId: current.literaturePlan.snapshotId,
      literaturePlanFingerprint: current.literaturePlan.planFingerprint,
      metadataExecutionSnapshotId: current.metadataExecution.snapshotId,
      metadataExecutionFingerprint:
        current.metadataExecution.executionFingerprint,
      metadataPacketSnapshotId: current.metadataPacket.snapshotId,
      metadataPacketFingerprint: current.metadataPacket.packetFingerprint,
      capability: {
        permittedHosts,
        tested: capabilityTested,
        credentialForwarding: false as const,
      },
    };
    let taskRead = await taskStore.read(taskAuthentication);
    if (taskRead.outcome === "unauthorized") {
      throw new Error("Scholarly document task access is unauthorized.");
    }
    let taskRecord: SixScreenResearchTaskRecord;
    if (taskRead.outcome === "found") {
      taskRecord = taskRead.record;
      if (
        fingerprintSixScreenValue(taskRecord.task.immutableRequest) !==
          fingerprintSixScreenValue(immutableRequest)
      ) throw new Error("The saved scholarly document task has a stale parent.");
    } else {
      const createdAt = this.options.now();
      const taskExpiresAt = instantAfter(
        createdAt,
        SIX_SCREEN_WORKFLOW_RESUME_RETENTION_MS,
      );
      const decision = currentCausalDesignDecision(current.workflow);
      const task = createResearchTask({
        id: taskId,
        runId: current.workflow.runId,
        kind: "mechanism",
        parent: {
          studyRevision: current.literaturePlan.binding.studyRevision,
          identityFingerprint:
            current.literaturePlan.binding.identityFingerprint,
          eventCardSnapshotId: current.literaturePlan.binding
            .eventCardReference.eventCardSnapshotId,
          selectedDesignSnapshotId:
            decision?.selectedDesign?.snapshotId ?? null,
          coeventSnapshotId: current.literaturePlan.binding.coEventSnapshotId,
          mechanismSnapshotId: current.metadataPacket.snapshotId,
        },
        immutableRequest,
        profileName: "mechanism-standard",
        pendingWorkIds: Array.from(
          { length: SIX_SCREEN_SCHOLARLY_DOCUMENT_MAX_ACQUISITIONS },
          (_, index) => `scholarly-document-slot-${index + 1}`,
        ),
        unresolvedRequirementIds: [],
        continuationMode: "panel_driven",
        createdAt,
        absoluteDeadline: taskExpiresAt,
        expiresAt: taskExpiresAt,
      });
      const created = await taskStore.create({
        task,
        accessToken: authentication.accessToken,
        createInputFingerprint: fingerprintSixScreenValue(immutableRequest),
      });
      if (created.outcome === "conflict") {
        throw new Error(
          "Scholarly document task coordinate was reused for different input.",
        );
      }
      taskRecord = created.record;
    }
    const actionCoordinate = fingerprintSixScreenValue(input.operationId).slice(
      "fnv1a64:".length,
    );
    const reserveReplayId = `scholarly-document-reserve-${actionCoordinate}`;
    const commitReplayId = `scholarly-document-commit-${actionCoordinate}`;
    const sourceOperationId = `scholarly-document-source-${actionCoordinate}`;
    const committedReplay = taskRecord.operationReplays.find(
      ({ operationId }) => operationId === commitReplayId,
    );
    if (committedReplay) {
      const checkpoint = validateScholarlyDocumentCheckpoint(
        committedReplay.result as ScholarlyDocumentCheckpoint,
        {
          literaturePlan: current.literaturePlan,
          metadataExecution: current.metadataExecution,
          metadataPacket: current.metadataPacket,
          metadataRecords: current.metadataRecords,
          priorAcquisitions: current.acquisitions,
          previousPassagePacket: current.passagePacket,
        },
      );
      if (
        checkpoint.acquisition.plan.input.inputFingerprint !==
          request.inputFingerprint
      ) throw new Error(
        "Six-screen operation id was reused for different scholarly document input.",
      );
      return this.applyScholarlyDocumentCheckpoint(
        authentication,
        input,
        checkpoint,
      );
    }
    let reservedTaskRecord = taskRecord;
    const now = this.options.now();
    const priorReservation = [...taskRecord.task.operations].reverse().find(
      ({ status }) => status === "reserved",
    );
    if (priorReservation) {
      if (Date.parse(priorReservation.leaseExpiresAt) > Date.parse(now)) {
        throw new Error(
          "Scholarly document inspection is already running. Reopen after its bounded lease expires.",
        );
      }
      const expired = await taskStore.mutate({
        ...taskAuthentication,
        expectedRevision: taskRecord.task.revision,
        operationId: `scholarly-document-expire-${priorReservation.generation}`,
        operationKind: "expire_scholarly_document_lease",
        inputFingerprint: priorReservation.inputFingerprint,
        updatedAt: now,
      }, (stored) => {
        const outcome = expireResearchTaskOperation(stored, {
          expectedRevision: stored.revision,
          operationId: priorReservation.operationId,
          inputFingerprint: priorReservation.inputFingerprint,
          generation: priorReservation.generation,
          expiredAt: now,
        });
        return { task: outcome.task, result: { retired: true } };
      });
      if (expired.outcome !== "updated" && expired.outcome !== "replayed") {
        throw new Error(
          `Scholarly document lease recovery failed (${expired.outcome}).`,
        );
      }
      if (priorReservation.operationId === sourceOperationId) {
        throw new Error(
          "The prior scholarly document outcome is ambiguous and was conservatively charged; use a new explicit action to retry.",
        );
      }
      reservedTaskRecord = expired.record;
    }
    const savedReserve = reservedTaskRecord.operationReplays.find(
      ({ operationId }) => operationId === reserveReplayId,
    );
    let plan;
    if (savedReserve) {
      const result = savedReserve.result as {
        plan?: ReturnType<typeof createScholarlyDocumentInspectionPlan>;
      };
      if (!result.plan) throw new Error("Scholarly document reservation lost its plan.");
      if (result.plan.input.inputFingerprint !== request.inputFingerprint) {
        throw new Error(
          "Six-screen operation id was reused for different scholarly document input.",
        );
      }
      plan = validateScholarlyDocumentInspectionPlan(result.plan, {
        literaturePlan: current.literaturePlan,
        metadataExecution: current.metadataExecution,
        metadataPacket: current.metadataPacket,
        metadataRecords: current.metadataRecords,
        priorAcquisitions: current.acquisitions,
      });
    } else {
      plan = createScholarlyDocumentInspectionPlan({
        id: `scholarly-document-plan-${actionCoordinate}`,
        literaturePlan: current.literaturePlan,
        metadataExecution: current.metadataExecution,
        metadataPacket: current.metadataPacket,
        metadataRecords: current.metadataRecords,
        request,
        priorAcquisitions: current.acquisitions,
        permittedHosts,
        capabilityTested,
        createdAt: now,
      });
    }
    const sourceInputFingerprint = fingerprintSixScreenValue({
      requestHash: reservedTaskRecord.task.requestHash,
      planFingerprint: plan.planFingerprint,
      requestFingerprint: request.inputFingerprint,
    });
    const reservation = plan.initialStatus === "pending"
      ? {
          sourceQueries: 0,
          metadataRecords: 0,
          documentAttempts: 1,
          usefulDocuments: 1,
          transportHops: 1,
          maximumReceivedBytes: 512_000,
          maximumDecodedBytes: 512_000,
          maximumActiveResearchMs: 20_000,
          maximumCpuMs: 3_000,
          providerCostUnits: {},
        }
      : {
          sourceQueries: 0,
          metadataRecords: 0,
          documentAttempts: 0,
          usefulDocuments: 0,
          transportHops: 0,
          maximumReceivedBytes: 0,
          maximumDecodedBytes: 0,
          maximumActiveResearchMs: 0,
          maximumCpuMs: 0,
          providerCostUnits: {},
        };
    let reserved = savedReserve
      ? null
      : await taskStore.mutate({
          ...taskAuthentication,
          expectedRevision: reservedTaskRecord.task.revision,
          operationId: reserveReplayId,
          operationKind: "reserve_scholarly_document",
          inputFingerprint: sourceInputFingerprint,
          updatedAt: now,
        }, (stored) => {
          const outcome = reserveResearchTaskOperation(stored, {
            expectedRevision: stored.revision,
            operationId: sourceOperationId,
            inputFingerprint: sourceInputFingerprint,
            reservation,
            reservedAt: now,
            leaseExpiresAt: instantAfter(now, 30_000),
          });
          if (outcome.outcome !== "reserved") {
            throw new Error(
              `Scholarly document reservation failed (${outcome.outcome}${
                "limit" in outcome ? `: ${outcome.limit}` : ""
              }).`,
            );
          }
          return { task: outcome.task, result: { plan, operation: outcome.operation } };
        });
    if (reserved) {
      if (reserved.outcome !== "updated" && reserved.outcome !== "replayed") {
        throw new Error(
          `Scholarly document task persistence failed (${reserved.outcome}).`,
        );
      }
      reservedTaskRecord = reserved.record;
    }
    const sourceOperation = reservedTaskRecord.task.operations.find(
      ({ operationId }) => operationId === sourceOperationId,
    );
    if (!sourceOperation || sourceOperation.status !== "reserved") {
      throw new Error("Scholarly document task lost its source-operation lease.");
    }
    const acquisition = await acquireScholarlyDocumentPassage({
      acquisitionId: `scholarly-document-acquisition-${actionCoordinate}`,
      coordinate: actionCoordinate,
      plan,
      fetch: this.options.fetch,
      now: this.options.now,
      monotonicNow: this.options.monotonicNow,
    });
    const passagePacket = createScholarlyPassagePacket({
      snapshotId: `scholarly-passage-packet-${actionCoordinate}`,
      metadataPacket: current.metadataPacket,
      acquisition,
      previous: current.passagePacket,
      acquisitions: [...current.acquisitions, acquisition],
      createdAt: acquisition.completedAt,
    });
    const checkpoint = createScholarlyDocumentCheckpoint({
      acquisition,
      passagePacket,
    });
    const slotId = reservedTaskRecord.task.pendingWorkIds[0];
    if (!slotId) throw new Error("Scholarly document task has no remaining slot.");
    const remainingWorkIds = reservedTaskRecord.task.pendingWorkIds.slice(1);
    const unresolvedRequirementIds = acquisition.document
      ? reservedTaskRecord.task.unresolvedRequirementIds
      : [...new Set([
          ...reservedTaskRecord.task.unresolvedRequirementIds,
          acquisition.id,
        ])];
    const committedAt = this.options.now();
    const committed = await taskStore.mutate({
      ...taskAuthentication,
      expectedRevision: reservedTaskRecord.task.revision,
      operationId: commitReplayId,
      operationKind: "commit_scholarly_document",
      inputFingerprint: sourceInputFingerprint,
      updatedAt: committedAt,
    }, (stored) => {
      const outcome = commitResearchTaskOperation(stored, {
        expectedRevision: stored.revision,
        operationId: sourceOperationId,
        inputFingerprint: sourceInputFingerprint,
        generation: sourceOperation.generation,
        actualUsage: acquisition.usage,
        completedWorkIds: [slotId],
        remainingWorkIds,
        unresolvedRequirementIds,
        nextState: remainingWorkIds.length ? "queued" : "partial",
        stopReason: remainingWorkIds.length
          ? null
          : "The bounded scholarly-document attempt ceiling was reached; mechanism generation remains blocked.",
        resultFingerprint: checkpoint.checkpointFingerprint,
        committedAt,
      });
      return { task: outcome.task, result: checkpoint };
    });
    if (committed.outcome !== "updated" && committed.outcome !== "replayed") {
      throw new Error(
        `Scholarly document result persistence failed (${committed.outcome}).`,
      );
    }
    const saved = validateScholarlyDocumentCheckpoint(
      committed.result as ScholarlyDocumentCheckpoint,
      {
        literaturePlan: current.literaturePlan,
        metadataExecution: current.metadataExecution,
        metadataPacket: current.metadataPacket,
        metadataRecords: current.metadataRecords,
        priorAcquisitions: current.acquisitions,
        previousPassagePacket: current.passagePacket,
      },
    );
    return this.applyScholarlyDocumentCheckpoint(
      authentication,
      input,
      saved,
    );
  }

  extractScholarlyClaim(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      passageId: string;
      expectedPassageFingerprint: string;
      fields: ScholarlyClaimFieldsDraft;
    },
  ) {
    const coordinate = fingerprintSixScreenValue(input.operationId).slice(
      "fnv1a64:".length,
    );
    return this.mutation(authentication, {
      ...input,
      operationKind: "extract_scholarly_claim",
      payload: {
        passageId: input.passageId,
        expectedPassageFingerprint: input.expectedPassageFingerprint,
        fields: input.fields,
      },
    }, (state) => {
      const extracted = recordScholarlyClaimExtraction(state, {
        expectedRevision: input.expectedRevision,
        extractionId: `scholarly-claim-extraction-${coordinate}`,
        packetSnapshotId: `scholarly-claim-packet-${coordinate}`,
        passageId: input.passageId,
        expectedPassageFingerprint: input.expectedPassageFingerprint,
        fields: input.fields,
        actor: "researcher_ui",
        recordedAt: this.options.now(),
      });
      return { state: extracted.state, result: extracted.extraction };
    });
  }

  reviewScholarlyClaim(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      extractionId: string;
      expectedExtractionFingerprint: string;
      decision: ScholarlyClaimReviewDecision;
      rationale: string;
    },
  ) {
    const coordinate = fingerprintSixScreenValue(input.operationId).slice(
      "fnv1a64:".length,
    );
    return this.mutation(authentication, {
      ...input,
      operationKind: "review_scholarly_claim",
      payload: {
        extractionId: input.extractionId,
        expectedExtractionFingerprint: input.expectedExtractionFingerprint,
        decision: input.decision,
        rationale: input.rationale,
      },
    }, (state) => {
      const reviewed = reviewScholarlyClaim(state, {
        expectedRevision: input.expectedRevision,
        reviewId: `scholarly-claim-review-${coordinate}`,
        packetSnapshotId: `scholarly-claim-packet-${coordinate}`,
        extractionId: input.extractionId,
        expectedExtractionFingerprint: input.expectedExtractionFingerprint,
        decision: input.decision,
        rationale: input.rationale,
        actor: "researcher_ui",
        reviewedAt: this.options.now(),
      });
      return { state: reviewed.state, result: reviewed.review };
    });
  }

  prepareMechanismSynthesisInput(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      expectedClaimPacketFingerprint: string;
    },
  ) {
    const coordinate = fingerprintSixScreenValue(input.operationId).slice(
      "fnv1a64:".length,
    );
    return this.mutation(authentication, {
      ...input,
      operationKind: "prepare_mechanism_synthesis_input",
      payload: {
        expectedClaimPacketFingerprint:
          input.expectedClaimPacketFingerprint,
      },
    }, (state) => {
      const prepared = prepareMechanismSynthesisInput(state, {
        expectedRevision: input.expectedRevision,
        snapshotId: `mechanism-synthesis-input-${coordinate}`,
        expectedClaimPacketFingerprint:
          input.expectedClaimPacketFingerprint,
        actor: "researcher_ui",
        preparedAt: this.options.now(),
      });
      return { state: prepared.state, result: prepared.packet };
    });
  }

  saveMechanismReview(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      expectedSynthesisInputFingerprint: string;
      draft: MechanismReviewDraft;
    },
  ) {
    const coordinate = fingerprintSixScreenValue(input.operationId).slice(
      "fnv1a64:".length,
    );
    return this.mutation(authentication, {
      ...input,
      operationKind: "save_mechanism_review",
      payload: {
        expectedSynthesisInputFingerprint:
          input.expectedSynthesisInputFingerprint,
        draft: input.draft,
      },
    }, (state) => {
      const saved = saveMechanismReview(state, {
        expectedRevision: input.expectedRevision,
        reviewSnapshotId: `mechanism-review-${coordinate}`,
        matrixSnapshotId: `prediction-matrix-${coordinate}`,
        expectedSynthesisInputFingerprint:
          input.expectedSynthesisInputFingerprint,
        draft: input.draft,
        actor: "researcher_ui",
        reviewedAt: this.options.now(),
      });
      return {
        state: saved.state,
        result: {
          review: saved.review,
          predictionMatrix: saved.predictionMatrix,
        },
      };
    });
  }

  private coEventApplyOperationId(operationId: string) {
    const coordinate = fingerprintSixScreenValue(operationId).slice(
      "fnv1a64:".length,
    );
    return `coevent-apply-${coordinate}`;
  }

  private replayedCoEventApply(
    record: SixScreenWorkflowStoreRecord,
    authentication: SixScreenWorkflowAuthentication,
    operationId: string,
  ) {
    const applyOperationId = this.coEventApplyOperationId(operationId);
    const replay = record.operationReplays.find((value) =>
      value.operationId === applyOperationId);
    if (!replay) return null;
    if (replay.operationKind !== "continue_coevent_search_apply") {
      throw new Error("Six-screen operation id was reused for different input.");
    }
    return {
      projection: publicProjection(record.state),
      privateSnapshot: snapshot(record, authentication.accessToken),
      result: structuredClone(replay.result),
      replayed: true,
    };
  }

  private latestCommittedCoEventCheckpoint(
    record: SixScreenResearchTaskRecord,
  ) {
    return [...record.operationReplays].reverse().find(
      ({ operationKind }) => operationKind === "commit_coevent_step",
    )?.result as CoEventStepCheckpoint | undefined;
  }

  private async currentCoEventWorkflow(
    authentication: SixScreenWorkflowAuthentication,
    expectedRevision: number,
  ) {
    const read = await this.options.store.read(authentication);
    if (read.outcome !== "found") {
      if (read.outcome === "unauthorized") {
        throw new Error("Six-screen workflow access is unauthorized.");
      }
      throw new Error("Six-screen workflow is unavailable or expired.");
    }
    const workflow = read.record.state;
    if (workflow.revision !== expectedRevision) {
      throw new Error(
        `Stale six-screen workflow mutation; current revision is ${workflow.revision}.`,
      );
    }
    if (workflow.activeScreen !== 4) {
      throw new Error("Co-event execution requires Screen 4 to be open.");
    }
    const matrix = currentCoEventSearchMatrix(workflow);
    const designSet = currentCausalDesignSet(workflow);
    const decision = currentCausalDesignDecision(workflow);
    if (!matrix || !designSet || !decision ||
        !screen4PrerequisiteReport(workflow).ready) {
      throw new Error(
        "Co-event execution requires the current matrix and its upstream decision.",
      );
    }
    return {
      record: read.record,
      workflow,
      matrix,
      designSet,
      decision,
      execution: currentCoEventSearchExecution(workflow),
    };
  }

  private async applyCoEventCheckpoint(
    authentication: SixScreenWorkflowAuthentication,
    input: { expectedRevision: number; operationId: string },
    checkpoint: CoEventStepCheckpoint,
  ) {
    const applied = await this.mutation(authentication, {
      expectedRevision: input.expectedRevision,
      operationId: this.coEventApplyOperationId(input.operationId),
      operationKind: "continue_coevent_search_apply",
      payload: {
        checkpointFingerprint: checkpoint.checkpointFingerprint,
        executionSnapshotId: checkpoint.execution.snapshotId,
        executionFingerprint: checkpoint.execution.executionFingerprint,
      },
    }, (state) => {
      const recorded = recordCoEventSearchExecution(state, {
        expectedRevision: input.expectedRevision,
        snapshotId: checkpoint.execution.snapshotId,
        plan: checkpoint.plan,
        attempt: checkpoint.attempt,
        candidates: checkpoint.candidates,
        discoveryLeads: checkpoint.discoveryLeads,
        recordedAt: checkpoint.execution.recordedAt,
      });
      if (
        recorded.execution.executionFingerprint !==
          checkpoint.execution.executionFingerprint
      ) {
        throw new Error(
          "Screen 4 provider checkpoint changed during durable application.",
        );
      }
      return {
        state: recorded.state,
        result: {
          executionSnapshotId: recorded.execution.snapshotId,
          executionFingerprint: recorded.execution.executionFingerprint,
          attemptOutcome: recorded.execution.attempt?.outcome ?? null,
        },
      };
    });
    return applied;
  }

  async continueCoEventSearch(
    authentication: SixScreenWorkflowAuthentication,
    input: { expectedRevision: number; operationId: string },
  ) {
    const taskStore = this.options.taskStore;
    if (!taskStore) {
      throw new Error(
        "Screen 4 provider execution is unavailable until the durable task store is configured.",
      );
    }
    const replayRead = await this.options.store.read(authentication);
    if (replayRead.outcome === "found") {
      const replay = this.replayedCoEventApply(
        replayRead.record,
        authentication,
        input.operationId,
      );
      if (replay) return replay;
    }
    const current = await this.currentCoEventWorkflow(
      authentication,
      input.expectedRevision,
    );
    if (current.execution?.status === "complete") {
      throw new Error("The current Screen 4 provider plan is already complete.");
    }
    const taskCoordinate = fingerprintSixScreenValue({
      executor: SIX_SCREEN_COEVENT_EXECUTOR_VERSION,
      matrixFingerprint: current.matrix.matrixFingerprint,
    }).slice("fnv1a64:".length);
    const taskId = `coevent-task-${taskCoordinate}`;
    const taskAuthentication = { ...authentication, taskId };
    let taskRead = await taskStore.read(taskAuthentication);
    if (taskRead.outcome === "unauthorized") {
      throw new Error("Screen 4 research task access is unauthorized.");
    }
    let taskRecord: SixScreenResearchTaskRecord;
    let plan: CoEventExecutionPlan;
    if (taskRead.outcome === "found") {
      taskRecord = taskRead.record;
      const request = taskRecord.task.immutableRequest as {
        protocolVersion?: string;
        plan?: CoEventExecutionPlan;
      };
      if (
        request.protocolVersion !== SIX_SCREEN_COEVENT_EXECUTOR_VERSION ||
        !request.plan
      ) throw new Error("The saved Screen 4 task omitted its immutable plan.");
      plan = validateCoEventExecutionPlan(request.plan, current.matrix);
      const recovered = this.latestCommittedCoEventCheckpoint(taskRecord);
      if (
        recovered &&
        !(current.workflow.coEventSearchExecutions ?? []).some(
          ({ snapshotId }) => snapshotId === recovered.execution.snapshotId,
        )
      ) {
        validateCoEventStepCheckpoint(recovered, current.matrix);
        return this.applyCoEventCheckpoint(authentication, input, recovered);
      }
    } else {
      const createdAt = this.options.now();
      const sourceRegister = buildSixScreenSourceRegister({
        configuredSecrets: this.options.configuredSourceSecrets,
      });
      plan = createCoEventExecutionPlan({
        id: `coevent-plan-${taskCoordinate}`,
        matrix: current.matrix,
        designSet: current.designSet,
        designDecision: current.decision,
        capabilities: coEventProviderExecutionCapabilities({
          matrix: current.matrix,
          sourceRegister,
        }),
        createdAt,
      });
      const immutableRequest = {
        protocolVersion: SIX_SCREEN_COEVENT_EXECUTOR_VERSION,
        plan,
      };
      const taskExpiresAt = instantAfter(
        createdAt,
        SIX_SCREEN_WORKFLOW_RESUME_RETENTION_MS,
      );
      const task = createResearchTask({
        id: taskId,
        runId: current.workflow.runId,
        kind: "coevent",
        parent: {
          studyRevision: current.matrix.binding.studyRevision,
          identityFingerprint: current.matrix.binding.identityFingerprint,
          eventCardSnapshotId:
            current.matrix.binding.eventCardReference.eventCardSnapshotId,
          selectedDesignSnapshotId:
            current.matrix.binding.selectedDesignSnapshotId,
          coeventSnapshotId: current.matrix.snapshotId,
          mechanismSnapshotId: null,
        },
        immutableRequest,
        profileName: "coevent-standard",
        pendingWorkIds: plan.steps.filter(({ initialStatus }) =>
          initialStatus === "pending").map(({ id }) => id),
        unresolvedRequirementIds: plan.steps.filter(({ initialStatus }) =>
          initialStatus !== "pending").map(({ id }) => id),
        continuationMode: "panel_driven",
        createdAt,
        absoluteDeadline: taskExpiresAt,
        expiresAt: taskExpiresAt,
      });
      const created = await taskStore.create({
        task,
        accessToken: authentication.accessToken,
        createInputFingerprint: fingerprintSixScreenValue(immutableRequest),
      });
      if (created.outcome === "conflict") {
        throw new Error("Screen 4 task coordinate was reused for different input.");
      }
      taskRecord = created.record;
    }

    const nextStepId = taskRecord.task.pendingWorkIds[0] ?? null;
    if (!nextStepId) {
      if (current.execution) {
        throw new Error("The saved Screen 4 task and execution progress disagree.");
      }
      const recordedAt = this.options.now();
      const execution = createCoEventSearchExecution({
        snapshotId: `coevent-execution-${taskCoordinate}-empty`,
        ordinal: (current.workflow.coEventSearchExecutions ?? []).length + 1,
        plan,
        previous: null,
        attempt: null,
        newCandidateOccurrenceIds: [],
        newDiscoveryLeadIds: [],
        recordedAt,
      });
      const checkpoint = createCoEventStepCheckpoint({
        plan,
        attempt: null,
        candidates: [],
        discoveryLeads: [],
        execution,
      });
      return this.applyCoEventCheckpoint(authentication, input, checkpoint);
    }
    const expectedNextStep = current.execution?.remainingStepIds[0] ??
      plan.steps.find(({ initialStatus }) => initialStatus === "pending")?.id;
    if (nextStepId !== expectedNextStep) {
      throw new Error("The saved Screen 4 task does not match visible progress.");
    }
    let reservedTaskRecord = taskRecord;
    const now = this.options.now();
    const priorReservation = [...taskRecord.task.operations].reverse().find(
      ({ status }) => status === "reserved",
    );
    if (priorReservation) {
      if (Date.parse(priorReservation.leaseExpiresAt) > Date.parse(now)) {
        throw new Error(
          "Screen 4 provider research is already running. Reopen after its bounded lease expires.",
        );
      }
      const expired = await taskStore.mutate({
        ...taskAuthentication,
        expectedRevision: taskRecord.task.revision,
        operationId: `coevent-expire-${priorReservation.generation}`,
        operationKind: "expire_coevent_source_lease",
        inputFingerprint: priorReservation.inputFingerprint,
        updatedAt: now,
      }, (stored) => {
        const outcome = expireResearchTaskOperation(stored, {
          expectedRevision: stored.revision,
          operationId: priorReservation.operationId,
          inputFingerprint: priorReservation.inputFingerprint,
          generation: priorReservation.generation,
          expiredAt: now,
        });
        return { task: outcome.task, result: { retired: true } };
      });
      if (expired.outcome !== "updated" && expired.outcome !== "replayed") {
        throw new Error(`Screen 4 task lease recovery failed (${expired.outcome}).`);
      }
      reservedTaskRecord = expired.record;
    }
    const step = plan.steps.find(({ id }) => id === nextStepId)!;
    const actionCoordinate = fingerprintSixScreenValue(input.operationId).slice(
      "fnv1a64:".length,
    );
    const attemptNumber = reservedTaskRecord.task.operations.length + 1;
    const sourceOperationId =
      `coevent-source-${attemptNumber}-${actionCoordinate}`;
    const sourceInputFingerprint = fingerprintSixScreenValue({
      requestHash: reservedTaskRecord.task.requestHash,
      previousExecutionFingerprint:
        current.execution?.executionFingerprint ?? null,
      stepId: step.id,
      attemptNumber,
    });
    const reservation = {
      sourceQueries: 1,
      metadataRecords: step.plannedLimit,
      documentAttempts: 0,
      usefulDocuments: 0,
      transportHops: 1,
      maximumReceivedBytes: 2 * 1024 * 1024,
      maximumDecodedBytes: 2 * 1024 * 1024,
      maximumActiveResearchMs: 20_000,
      maximumCpuMs: 3_000,
      providerCostUnits: {},
    };
    const reserved = await taskStore.mutate({
      ...taskAuthentication,
      expectedRevision: reservedTaskRecord.task.revision,
      operationId: `coevent-reserve-${attemptNumber}-${actionCoordinate}`,
      operationKind: "reserve_coevent_source",
      inputFingerprint: sourceInputFingerprint,
      updatedAt: now,
    }, (stored) => {
      const outcome = reserveResearchTaskOperation(stored, {
        expectedRevision: stored.revision,
        operationId: sourceOperationId,
        inputFingerprint: sourceInputFingerprint,
        reservation,
        reservedAt: now,
        leaseExpiresAt: instantAfter(now, 30_000),
      });
      if (outcome.outcome !== "reserved") {
        throw new Error(
          `Screen 4 provider reservation failed (${outcome.outcome}${
            "limit" in outcome ? `: ${outcome.limit}` : ""
          }).`,
        );
      }
      return { task: outcome.task, result: outcome.operation };
    });
    if (reserved.outcome !== "updated" && reserved.outcome !== "replayed") {
      throw new Error(`Screen 4 task persistence failed (${reserved.outcome}).`);
    }
    if (reserved.outcome === "replayed") {
      const recovered = this.latestCommittedCoEventCheckpoint(reserved.record);
      if (recovered) {
        validateCoEventStepCheckpoint(recovered, current.matrix);
        return this.applyCoEventCheckpoint(authentication, input, recovered);
      }
      throw new Error("Screen 4 provider research is already running.");
    }
    const sourceOperation = reserved.record.task.operations.find(
      ({ operationId }) => operationId === sourceOperationId,
    );
    if (!sourceOperation) {
      throw new Error("Screen 4 task lost its provider-operation lease.");
    }
    const providerResult: CoEventProviderExecutionResult =
      await executeCoEventProviderStep({
        attemptId: `coevent-attempt-${attemptNumber}-${actionCoordinate}`,
        plan,
        matrix: current.matrix,
        step,
        fetch: this.options.fetch,
        now: this.options.now,
        monotonicNow: this.options.monotonicNow,
      });
    const evidence = canonicalCoEventStepEvidence({
      workflow: current.workflow,
      result: providerResult,
    });
    const recordedAt = this.options.now();
    const execution = createCoEventSearchExecution({
      snapshotId: `coevent-execution-${attemptNumber}-${actionCoordinate}`,
      ordinal: (current.workflow.coEventSearchExecutions ?? []).length + 1,
      plan,
      previous: current.execution,
      attempt: providerResult.attempt,
      newCandidateOccurrenceIds:
        evidence.candidates.map(({ id }) => id),
      newDiscoveryLeadIds: evidence.discoveryLeads.map(({ id }) => id),
      recordedAt,
    });
    const checkpoint = createCoEventStepCheckpoint({
      plan,
      attempt: providerResult.attempt,
      candidates: evidence.candidates,
      discoveryLeads: evidence.discoveryLeads,
      execution,
    });
    const remainingWorkIds = reserved.record.task.pendingWorkIds.filter(
      (id) => id !== step.id,
    );
    const unresolvedRequirementIds = [
      ...plan.steps.filter(({ initialStatus }) =>
        initialStatus !== "pending").map(({ id }) => id),
      ...(["source_unavailable", "records_unusable", "unsupported_request"]
          .includes(providerResult.attempt.outcome)
        ? [step.id]
        : []),
    ];
    const committedAt = this.options.now();
    const committed = await taskStore.mutate({
      ...taskAuthentication,
      expectedRevision: reserved.record.task.revision,
      operationId: `coevent-commit-${attemptNumber}-${actionCoordinate}`,
      operationKind: "commit_coevent_step",
      inputFingerprint: sourceInputFingerprint,
      updatedAt: committedAt,
    }, (stored) => {
      const outcome = commitResearchTaskOperation(stored, {
        expectedRevision: stored.revision,
        operationId: sourceOperationId,
        inputFingerprint: sourceInputFingerprint,
        generation: sourceOperation.generation,
        actualUsage: providerResult.attempt.usage,
        completedWorkIds: [step.id],
        remainingWorkIds,
        unresolvedRequirementIds,
        nextState: remainingWorkIds.length
          ? "queued"
          : unresolvedRequirementIds.length
            ? "partial"
            : "completed",
        stopReason: remainingWorkIds.length
          ? null
          : execution.actualSearchBoundary.stopReason,
        resultFingerprint: checkpoint.checkpointFingerprint,
        committedAt,
      });
      return { task: outcome.task, result: checkpoint };
    });
    if (committed.outcome !== "updated" && committed.outcome !== "replayed") {
      throw new Error(`Screen 4 task result persistence failed (${committed.outcome}).`);
    }
    const saved = validateCoEventStepCheckpoint(
      committed.result as CoEventStepCheckpoint,
      current.matrix,
    );
    return this.applyCoEventCheckpoint(authentication, input, saved);
  }

  updateStudy(authentication: SixScreenWorkflowAuthentication, input: {
    expectedRevision: number;
    operationId: string;
    study: StudyContextDraft;
  }) {
    return this.mutation(authentication, {
      ...input,
      operationKind: "update_study",
      payload: input.study,
    }, (state) => ({
      state: updateStudyContext(state, {
        expectedRevision: input.expectedRevision,
        study: input.study,
        updatedAt: this.options.now(),
      }),
    }));
  }

  updateShock(authentication: SixScreenWorkflowAuthentication, input: {
    expectedRevision: number;
    operationId: string;
    shockInput: string;
    officialIdentifier?: string | null;
    requestedJurisdiction?: string | null;
    approximateYear?: string | null;
    intendedEpisode?: string | null;
  }) {
    return this.mutation(authentication, {
      ...input,
      operationKind: "update_shock",
      payload: input,
    }, (state) => ({
      state: updateShockRequest(state, {
        expectedRevision: input.expectedRevision,
        shockInput: input.shockInput,
        officialIdentifier: input.officialIdentifier,
        requestedJurisdiction: input.requestedJurisdiction,
        approximateYear: input.approximateYear,
        intendedEpisode: input.intendedEpisode,
        updatedAt: this.options.now(),
      }),
    }));
  }

  async resolveShock(authentication: SixScreenWorkflowAuthentication, input: {
    expectedRevision: number;
    operationId: string;
  }): Promise<{
    projection: SixScreenWorkflowPublicProjection;
    privateSnapshot: SixScreenWorkflowPrivateSnapshot;
    resolution: Screen01IdentityResolutionResult;
    replayed: boolean;
    changed: boolean;
    mutationOutcome: "changed" | "unchanged" | "replayed";
  }> {
    const coordinate = fingerprintSixScreenValue(input.operationId).slice(
      "fnv1a64:".length,
    );
    const started = await this.mutation(authentication, {
      expectedRevision: input.expectedRevision,
      operationId: `${input.operationId}:begin`,
      operationKind: "resolve_shock_begin",
      payload: { expectedRevision: input.expectedRevision },
    }, (state) => {
      const begun = beginIdentityResolution(state, {
        expectedRevision: input.expectedRevision,
        requestId: `identity-request-${coordinate}`,
        requestedAt: this.options.now(),
      });
      return { state: begun.state, result: begun.request };
    });
    const request = started.result as IdentityResolutionRequest;
    if (
      started.replayed &&
      started.privateSnapshot.state.pendingIdentityRequest === null
    ) {
      const replayed = await this.mutation(authentication, {
        expectedRevision: started.privateSnapshot.revision,
        operationId: `${input.operationId}:apply`,
        operationKind: "resolve_shock_apply",
        payload: request,
      }, () => {
        throw new Error("A completed identity operation lost its durable replay.");
      });
      return {
        projection: replayed.projection,
        privateSnapshot: replayed.privateSnapshot,
        resolution: replayed.result as Screen01IdentityResolutionResult,
        replayed: replayed.replayed,
        changed: replayed.changed,
        mutationOutcome: replayed.mutationOutcome,
      };
    }
    const resolution = this.options.taskStore
      ? await this.resolveShockWithTask(
          authentication,
          input,
          coordinate,
          started.privateSnapshot.state,
          request,
          started.replayed,
        )
      : await resolveScreen01Identity({
          workflow: started.privateSnapshot.state,
          fetch: this.options.fetch,
          publicWebFetch: this.options.publicWebFetch ?? this.options.fetch,
          retrievedAt: this.options.now(),
          ...(this.options.govInfoApiKey !== undefined
            ? { govInfoApiKey: this.options.govInfoApiKey }
            : {}),
          ...(this.options.congressApiKey !== undefined
            ? { congressApiKey: this.options.congressApiKey }
            : {}),
          ...(this.options.openStatesApiKey !== undefined
            ? { openStatesApiKey: this.options.openStatesApiKey }
            : {}),
          monotonicNow: this.options.monotonicNow,
        });
    const applied = await this.mutation(authentication, {
      expectedRevision: started.privateSnapshot.revision,
      operationId: `${input.operationId}:apply`,
      operationKind: "resolve_shock_apply",
      payload: request,
    }, (state) => ({
      state: applyIdentityResolution(state, {
        expectedRevision: started.privateSnapshot.revision,
        request,
        candidates: resolution.candidates,
        resolution: {
          taskId: this.options.taskStore
            ? `identity-task-${coordinate}`
            : null,
          status: resolution.status,
          attemptedSources: resolution.attemptedSources,
          unresolved: resolution.unresolved,
          limitation: resolution.limitation,
        },
        appliedAt: this.options.now(),
      }),
      result: resolution,
    }));
    return {
      projection: applied.projection,
      privateSnapshot: applied.privateSnapshot,
      resolution: applied.result as Screen01IdentityResolutionResult,
      replayed: applied.replayed,
      changed: applied.changed,
      mutationOutcome: applied.mutationOutcome,
    };
  }

  private async resolveShockWithTask(
    authentication: SixScreenWorkflowAuthentication,
    input: { expectedRevision: number; operationId: string },
    coordinate: string,
    workflow: SixScreenWorkflowState,
    request: IdentityResolutionRequest,
    resumedWorkflowOperation: boolean,
  ) {
    const taskStore = this.options.taskStore!;
    const taskId = `identity-task-${coordinate}`;
    const taskAuthentication = {
      ...authentication,
      taskId,
    };
    const taskCreatedAt = request.requestedAt;
    const immutableRequest = {
      protocol: "screen-01-identity-resolution-v2",
      request,
      originalShockInput: workflow.originalShockInput,
      currentShockInput: workflow.currentShockInput,
      officialSourceLocators: workflow.officialSourceLocators,
      officialIdentifier: workflow.officialIdentifier ?? null,
      requestedJurisdiction: workflow.requestedJurisdiction,
      approximateYear: workflow.approximateYear,
      intendedEpisode: workflow.intendedEpisode,
    };
    const task = createResearchTask({
      id: taskId,
      runId: workflow.runId,
      kind: "identity",
      parent: {
        studyRevision: workflow.study.revision,
        identityFingerprint: workflow.currentRequestFingerprint,
        eventCardSnapshotId: null,
        selectedDesignSnapshotId: null,
        coeventSnapshotId: null,
        mechanismSnapshotId: null,
      },
      immutableRequest,
      profileName: "identity-standard",
      pendingWorkIds: ["identity"],
      unresolvedRequirementIds: ["identity"],
      continuationMode: "panel_driven",
      createdAt: taskCreatedAt,
      absoluteDeadline: instantAfter(taskCreatedAt, 90_000),
      expiresAt: instantAfter(taskCreatedAt, SIX_SCREEN_WORKFLOW_RESUME_RETENTION_MS),
    });
    const created = await taskStore.create({
      task,
      accessToken: authentication.accessToken,
      createInputFingerprint: fingerprintSixScreenValue(immutableRequest),
    });
    if (created.outcome === "conflict") {
      throw new Error("Identity task coordinate was reused for different input.");
    }
    const taskRecord = created.record;
    const reserveOperationId = `reserve-${coordinate}`;
    const commitOperationId = `commit-${coordinate}`;
    const sourceOperationId = `source-${coordinate}`;
    const sourceInputFingerprint = fingerprintSixScreenValue({
      immutableRequest,
      source: SCREEN_01_IDENTITY_ROUTE_VERSION,
    });
    const commitReplay = taskRecord.operationReplays.find(
      ({ operationId }) => operationId === commitOperationId,
    );
    if (commitReplay) {
      return commitReplay.result as Screen01IdentityResolutionResult;
    }
    const now = this.options.now();
    const persistedOperation = taskRecord.task.operations.find(
      ({ operationId }) => operationId === sourceOperationId,
    );
    if (
      resumedWorkflowOperation && persistedOperation?.status === "reserved" &&
      Date.parse(persistedOperation.leaseExpiresAt) > Date.parse(now)
    ) {
      throw new Error(
        "Identity research is already running. Reopen or retry after its bounded lease expires.",
      );
    }
    let reservedTask = taskRecord.task;
    let sourceGeneration = persistedOperation?.generation;
    if (!persistedOperation) {
      let reserved: Awaited<ReturnType<SixScreenResearchTaskStore["mutate"]>>;
      try {
        reserved = await taskStore.mutate({
          ...taskAuthentication,
          expectedRevision: taskRecord.task.revision,
          operationId: reserveOperationId,
          operationKind: "reserve_identity_source",
          inputFingerprint: sourceInputFingerprint,
          updatedAt: now,
        }, (stored) => {
          const outcome = reserveResearchTaskOperation(stored, {
            expectedRevision: stored.revision,
            operationId: sourceOperationId,
            inputFingerprint: sourceInputFingerprint,
            reservation: {
              sourceQueries: 12,
              // Matches identity-standard: the Congress.gov bill-text
              // inventory alone may contain 20 versions x 12 formats.
              metadataRecords: 300,
              documentAttempts: 12,
              usefulDocuments: 6,
              transportHops: 48,
              maximumReceivedBytes: 32 * 1024 * 1024,
              maximumDecodedBytes: 32 * 1024 * 1024,
              maximumActiveResearchMs: 90_000,
              maximumCpuMs: 30_000,
              providerCostUnits: this.options.openStatesApiKey?.trim()
                ? { openstates: 5 }
                : {},
            },
            reservedAt: now,
            leaseExpiresAt: instantAfter(now, 90_000),
          });
          if (outcome.outcome !== "reserved") {
            throw new Error(
              `Identity research reservation failed (${outcome.outcome}).`,
            );
          }
          return { task: outcome.task, result: outcome.operation };
        });
      } catch (error) {
        if (error instanceof SixScreenWorkflowProblemError) throw error;
        workflowProblemFailure({
          code: "persistence_failure",
          action: "resolve_shock_reserve",
          operationId: input.operationId,
          screen: 1,
          expectedRevision: input.expectedRevision,
          actualRevision: workflow.revision,
          commitCertainty: "not_committed",
          dispatchCertainty: "not_dispatched",
          recovery: "retry_local",
          safeCauseCodes: ["persistence_failed"],
        });
      }
      if (reserved.outcome !== "updated" && reserved.outcome !== "replayed") {
        throw new Error(`Identity task persistence failed (${reserved.outcome}).`);
      }
      reservedTask = reserved.record.task;
      sourceGeneration = reservedTask.operations.find(
        ({ operationId }) => operationId === sourceOperationId,
      )?.generation;
    }
    if (!sourceGeneration) {
      throw new Error("Identity task lost its source-operation lease.");
    }
    let candidateResolution: Screen01IdentityResolutionResult;
    try {
      candidateResolution = await resolveScreen01Identity({
        workflow,
        fetch: this.options.fetch,
        publicWebFetch: this.options.publicWebFetch ?? this.options.fetch,
        retrievedAt: this.options.now(),
        ...(this.options.govInfoApiKey !== undefined
          ? { govInfoApiKey: this.options.govInfoApiKey }
          : {}),
        ...(this.options.congressApiKey !== undefined
          ? { congressApiKey: this.options.congressApiKey }
          : {}),
        ...(this.options.openStatesApiKey !== undefined
          ? { openStatesApiKey: this.options.openStatesApiKey }
          : {}),
        monotonicNow: this.options.monotonicNow,
      });
    } catch (error) {
      if (error instanceof SixScreenWorkflowProblemError) throw error;
      workflowProblemFailure({
        code: "execution_failure",
        action: "resolve_shock_source",
        operationId: input.operationId,
        screen: 1,
        expectedRevision: input.expectedRevision,
        actualRevision: workflow.revision,
        commitCertainty: "not_committed",
        dispatchCertainty: "unknown",
        recovery: "retry_local",
        safeCauseCodes: ["execution_failed"],
      });
    }
    const resultFingerprint = fingerprintSixScreenValue(candidateResolution);
    const committedAt = this.options.now();
    let committed: Awaited<ReturnType<SixScreenResearchTaskStore["mutate"]>>;
    try {
      committed = await taskStore.mutate({
        ...taskAuthentication,
        expectedRevision: reservedTask.revision,
        operationId: commitOperationId,
        operationKind: "commit_identity_source",
        inputFingerprint: sourceInputFingerprint,
        updatedAt: committedAt,
      }, (stored) => {
        const outcome = commitResearchTaskOperation(stored, {
          expectedRevision: stored.revision,
          operationId: sourceOperationId,
          inputFingerprint: sourceInputFingerprint,
          generation: sourceGeneration!,
          actualUsage: candidateResolution.usage,
          completedWorkIds: candidateResolution.status === "resolved"
            ? ["identity"]
            : [],
          remainingWorkIds:
            candidateResolution.status === "source_unavailable"
              ? ["identity"]
              : [],
          unresolvedRequirementIds: candidateResolution.unresolved,
          nextState: candidateResolution.status === "source_unavailable"
            ? "waiting_source"
            : "completed",
          stopReason: candidateResolution.limitation,
          resultFingerprint,
          committedAt,
        });
        return { task: outcome.task, result: candidateResolution };
      });
    } catch (error) {
      if (error instanceof SixScreenWorkflowProblemError) throw error;
      workflowProblemFailure({
        code: "persistence_failure",
        action: "resolve_shock_commit",
        operationId: input.operationId,
        screen: 1,
        expectedRevision: input.expectedRevision,
        actualRevision: workflow.revision,
        commitCertainty: "unknown",
        dispatchCertainty: "dispatched",
        recovery: "check_status",
        safeCauseCodes: ["persistence_failed"],
      });
    }
    if (committed.outcome !== "updated" && committed.outcome !== "replayed") {
      throw new Error(`Identity task result persistence failed (${committed.outcome}).`);
    }
    return committed.result as Screen01IdentityResolutionResult;
  }

  private async currentPolicyWorkflow(
    authentication: SixScreenWorkflowAuthentication,
    expectedRevision: number,
  ) {
    const workflowRead = await this.options.store.read(authentication);
    if (workflowRead.outcome !== "found") {
      if (workflowRead.outcome === "unauthorized") {
        throw new Error("Six-screen workflow access is unauthorized.");
      }
      throw new Error("Six-screen workflow is unavailable or expired.");
    }
    const workflow = workflowRead.record.state;
    if (workflow.revision !== expectedRevision) {
      throw new Error(
        `Stale six-screen workflow mutation; current revision is ${workflow.revision}.`,
      );
    }
    if (workflow.activeScreen !== 2) {
      throw new Error("Policy research requires the researcher to open Screen 2 first.");
    }
    const confirmed = workflow.confirmedShock;
    if (!confirmed) {
      throw new Error("Screen 2 requires a researcher-confirmed shock.");
    }
    const candidate = workflow.candidates.find(
      ({ id }) => id === confirmed.confirmation.candidateId,
    );
    if (
      !candidate || candidate.identityFingerprint !== confirmed.identityFingerprint ||
      workflow.displayedCandidateId !== candidate.id
    ) {
      throw new Error("Confirmed shock no longer matches the displayed identity.");
    }
    return { workflow, confirmed, candidate };
  }

  private async applyPolicyReviewResult(
    authentication: SixScreenWorkflowAuthentication,
    input: { expectedRevision: number; operationId: string },
    review: PolicyReview,
  ): Promise<PolicyResearchResult> {
    const coordinate = fingerprintSixScreenValue(input.operationId).slice(
      "fnv1a64:".length,
    );
    const applied = await this.mutation(authentication, {
      expectedRevision: input.expectedRevision,
      operationId: `policy-apply-${coordinate}`,
      operationKind: "research_policy_apply",
      payload: {
        taskId: review.taskId,
        identityFingerprint: review.identityFingerprint,
        reviewFingerprint: fingerprintSixScreenValue(review),
      },
    }, (state) => ({
      state: applyPolicyReview(state, {
        expectedRevision: input.expectedRevision,
        review,
        appliedAt: this.options.now(),
      }),
      result: review,
    }));
    return {
      projection: await this.projectionWithPolicyEventCardWorkspace(
        authentication,
        applied.privateSnapshot.state,
        applied.projection,
      ),
      privateSnapshot: applied.privateSnapshot,
      review: applied.result as PolicyReview,
      mutationOutcome: applied.mutationOutcome,
    };
  }

  private async replayedPolicyApply(
    record: SixScreenWorkflowStoreRecord,
    authentication: SixScreenWorkflowAuthentication,
    operationId: string,
  ): Promise<PolicyResearchResult | null> {
    const coordinate = fingerprintSixScreenValue(operationId).slice(
      "fnv1a64:".length,
    );
    const replay = record.operationReplays.find(
      (value) => value.operationId === `policy-apply-${coordinate}`,
    );
    if (!replay) return null;
    if (replay.operationKind !== "research_policy_apply") {
      throw new Error("Six-screen operation id was reused for different input.");
    }
    const review = replay.result as PolicyReview;
    if (
      !review || review.protocolVersion !== SIX_SCREEN_POLICY_REVIEW_PROTOCOL_VERSION ||
      replay.inputFingerprint !== fingerprintSixScreenValue({
        taskId: review.taskId,
        identityFingerprint: review.identityFingerprint,
        reviewFingerprint: fingerprintSixScreenValue(review),
      })
    ) {
      throw new Error("Stored policy action replay is invalid.");
    }
    return {
      projection: await this.projectionWithPolicyEventCardWorkspace(
        authentication,
        record.state,
      ),
      privateSnapshot: snapshot(record, authentication.accessToken),
      review: structuredClone(review),
      mutationOutcome: "replayed",
    };
  }

  private latestCommittedPolicyReview(
    record: SixScreenResearchTaskRecord,
  ) {
    const replay = [...record.operationReplays].reverse().find(
      ({ operationKind }) => operationKind === "commit_policy_step",
    );
    return replay?.result as PolicyReview | undefined;
  }

  private policyCheckpointFingerprint(review: PolicyReview) {
    const {
      briefing: _briefing,
      artifactStatus: _artifactStatus,
      invalidatedAt: _invalidatedAt,
      invalidationReason: _invalidationReason,
      ...checkpoint
    } = review;
    return fingerprintSixScreenValue(checkpoint);
  }

  private async discoverScreen2PolicySources(
    request: Screen2PolicySourceDiscoveryRequest,
    operationId: string,
  ): Promise<Screen02ComplementarySourceDiscoveryResult> {
    const ledger = this.options.screen5OpenAILedgerStore;
    const apiKey = this.options.screen5OpenAIApiKey;
    const fetch = this.options.screen5OpenAIFetch;
    if (
      !ledger || !apiKey || !fetch ||
      !this.screen2PolicySourceDiscoveryIsConfigured()
    ) {
      return { attempted: false, urls: [], responseBytes: 0 };
    }
    const coordinate = fingerprintSixScreenValue({
      request,
      operationId,
    }).slice("fnv1a64:".length);
    const reservationId =
      `screen2-source-discovery-reservation-${coordinate}`;
    const jobId = `screen2-source-discovery-job-${coordinate}`;
    let reserved = false;
    let dispatched = false;
    let completed: Awaited<
      ReturnType<typeof requestScreen2PolicySourceDiscovery>
    > | null = null;
    try {
      await this.initializeOpenAIUsage(ledger);
      await ledger.reserve({
        reservationId,
        jobId,
        stage: "screen2_policy_interpretation",
        reservedTokens: SCREEN2_OPENAI_POLICY_SOURCE_DISCOVERY_RESERVATION,
        now: this.options.now(),
      });
      reserved = true;
      completed = await requestScreen2PolicySourceDiscovery({
        apiKey,
        fetch,
        request,
        onDispatch: async () => {
          await ledger.recordDispatch({
            reservationId,
            now: this.options.now(),
          });
          dispatched = true;
        },
        onReceipt: async (contentFingerprint) => {
          await ledger.recordReceipt({
            reservationId,
            contentFingerprint,
            now: this.options.now(),
          });
        },
      });
      await ledger.settle({
        reservationId,
        usage: completed.usage,
        now: this.options.now(),
      });
      return {
        attempted: true,
        urls: completed.urls,
        responseBytes: completed.responseBytes,
      };
    } catch (caught) {
      const provider = caught instanceof Screen2PolicySourceDiscoveryError
        ? caught
        : null;
      const usage = completed?.usage ?? provider?.detail.usage ?? null;
      if (reserved && usage) {
        try {
          await ledger.settle({
            reservationId,
            usage,
            now: this.options.now(),
          });
        } catch {
          // Keep the conservative accounting hold when settlement is unclear.
        }
      } else if (
        reserved && !dispatched && provider?.detail.dispatched !== true
      ) {
        try {
          await ledger.release({
            reservationId,
            reasonCode: "screen2_source_discovery_unavailable",
            now: this.options.now(),
          });
        } catch {
          // Keep the conservative accounting hold when release is unclear.
        }
      }
      return {
        attempted: dispatched || provider?.detail.dispatched === true,
        urls: [],
        responseBytes: completed?.responseBytes ??
          provider?.detail.responseBytes ?? 0,
      };
    }
  }

  /**
   * Optional second stage of the Screen 2 hybrid pipeline. Source retrieval,
   * normalization, extraction, dates, and citations are complete before this
   * method runs. Any provider, accounting, schema, or validation failure keeps
   * the deterministic briefing intact.
   */
  private async synthesizePolicyReview(
    review: PolicyReview,
    title: string,
    studyPeriod: SixScreenWorkflowState["study"]["period"],
    operationId: string,
  ): Promise<PolicyReview> {
    const ledger = this.options.screen5OpenAILedgerStore;
    const apiKey = this.options.screen5OpenAIApiKey;
    const fetch = this.options.screen5OpenAIFetch;
    const attemptedAt = this.options.now();
    if (!review.claims.length) {
      return {
        ...review,
        synthesis: {
          status: "skipped_insufficient_evidence",
          provider: "openai",
          model: SCREEN5_OPENAI_MODEL,
          attemptedAt,
          completedAt: null,
          safeFailureCode: "insufficient_source_linked_claims",
          claimCount: review.claims.length,
          usage: null,
        },
      };
    }
    if (!ledger || !apiKey || !fetch ||
        !this.screen5OpenAIConfigurationIsValid()) {
      return {
        ...review,
        synthesis: {
          status: "unavailable",
          provider: "openai",
          model: SCREEN5_OPENAI_MODEL,
          attemptedAt,
          completedAt: null,
          safeFailureCode: "openai_configuration_unavailable",
          claimCount: review.claims.length,
          usage: null,
        },
      };
    }
    const coordinate = fingerprintSixScreenValue({
      taskId: review.taskId,
      evidence: review.evidenceSnapshotFingerprint,
      operationId,
    }).slice("fnv1a64:".length);
    const prepared = prepareScreen2PolicyInterpretation({
      title,
      claims: review.claims,
    });
    if (!prepared) return {
      ...review,
      synthesis: {
        status: "skipped_insufficient_evidence",
        provider: "openai",
        model: SCREEN5_OPENAI_MODEL,
        attemptedAt,
        completedAt: null,
        safeFailureCode: "no_valid_claim_slots",
        claimCount: 0,
        usage: null,
      },
    };

    const aggregateUsage = (values: Array<Screen5MechanismUsage | null>) => {
      const retained = values.filter(
        (value): value is Screen5MechanismUsage => value !== null,
      );
      if (!retained.length) return null;
      return {
        promptTokens: retained.reduce((total, value) =>
          total + value.promptTokens, 0),
        completionTokens: retained.reduce((total, value) =>
          total + value.completionTokens, 0),
        totalTokens: retained.reduce((total, value) =>
          total + value.totalTokens, 0),
      };
    };
    const completedReview = (
      response: Awaited<ReturnType<typeof requestScreen2PolicyInterpretation>>,
      usage: NonNullable<ReturnType<typeof aggregateUsage>>,
    ): PolicyReview => {
      const interpretation = response.wire;
      return {
        ...review,
        interpretation,
        synthesis: {
          status: "completed",
          provider: "openai",
          model: SCREEN5_OPENAI_MODEL,
          attemptedAt,
          completedAt: interpretation.generatedAt,
          safeFailureCode: null,
          claimCount: prepared.bindings.length,
          usage: {
            inputTokens: usage.promptTokens,
            outputTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
          },
        },
        briefing: createPolicyBriefing({
          title,
          claims: review.claims,
          requirements: review.requirements,
          generatedAt: interpretation.generatedAt,
          studyPeriod,
          interpretation,
        }),
      };
    };
    const runAttempt = async (
      repairIssues: readonly Screen5MechanismValidationIssue[] | null,
    ) => {
      const suffix = repairIssues ? "-repair" : "";
      const reservationId =
        `screen2-policy-reservation-${coordinate}${suffix}`;
      const jobId = `screen2-policy-job-${coordinate}${suffix}`;
      let reserved = false;
      let dispatched = false;
      try {
        await this.initializeOpenAIUsage(ledger);
        await ledger.reserve({
          reservationId,
          jobId,
          stage: "screen2_policy_interpretation",
          reservedTokens: SCREEN2_OPENAI_POLICY_INTERPRETATION_RESERVATION,
          now: this.options.now(),
        });
        reserved = true;
        const callbacks = {
          onDispatch: async () => {
            await ledger.recordDispatch({
              reservationId,
              now: this.options.now(),
            });
            dispatched = true;
          },
          onReceipt: async (receipt: Screen5MechanismProviderReceipt) => {
            await ledger.recordReceipt({
              reservationId,
              contentFingerprint: receipt.contentFingerprint,
              now: this.options.now(),
            });
          },
        };
        const response = repairIssues
          ? await requestScreen2PolicyInterpretationRepair({
              apiKey,
              fetch,
              prepared,
              validationIssues: repairIssues,
              now: this.options.now,
              ...callbacks,
            })
          : await requestScreen2PolicyInterpretation({
              apiKey,
              fetch,
              prepared,
              now: this.options.now,
              ...callbacks,
            });
        await ledger.settle({
          reservationId,
          usage: response.usage,
          now: this.options.now(),
        });
        return { ok: true as const, response, usage: response.usage };
      } catch (caught) {
        const provider = caught instanceof Screen5OpenAIProviderError
          ? caught
          : null;
        const usage = provider?.detail.receipt?.usage ??
          provider?.detail.usage ?? null;
        if (usage && reserved) {
          try {
            await ledger.settle({ reservationId, usage,
              now: this.options.now() });
          } catch { /* Keep the conservative accounting hold. */ }
        } else if (reserved && !dispatched &&
            provider?.detail.networkInvocation !== "invoked") {
          try {
            await ledger.release({
              reservationId,
              reasonCode: "screen2_interpretation_unavailable",
              now: this.options.now(),
            });
          } catch { /* Keep the conservative accounting hold. */ }
        }
        return { ok: false as const, provider, usage };
      }
    };

    const first = await runAttempt(null);
    if (first.ok) {
      return completedReview(first.response, aggregateUsage([first.usage])!);
    }
    const usages: Array<Screen5MechanismUsage | null> = [first.usage];
    let finalProvider = first.provider;
    const repairIssues = first.provider?.detail.code ===
        "provider_schema_invalid"
      ? first.provider.detail.validationIssues?.slice(0, 8) ?? []
      : [];
    if (repairIssues.length) {
      const repair = await runAttempt(repairIssues);
      usages.push(repair.usage);
      if (repair.ok) {
        return completedReview(repair.response, aggregateUsage(usages)!);
      }
      finalProvider = repair.provider;
    }

    const usage = aggregateUsage(usages);
    const failureStage = finalProvider?.detail.failureStage;
    const providerFailureCode = finalProvider?.detail.code;
    const disclosedProviderFailureCodes = new Set([
      "openai_authentication_failed",
      "openai_model_access_denied",
      "openai_quota_or_spend_limit_reached",
      "openai_rate_limited",
      "openai_schema_rejected",
    ]);
    const disclosedValidationIssueCodes = new Set([
      "invalid_bounded_text",
      "incomplete_policy_prose",
      "invalid_claim_slots",
      "unsupported_numeric_fact",
      "predicate_section_mismatch",
      "explanation_without_controlling_change",
      "invalid_timeline_predicate",
      "invalid_unresolved_questions",
      "unresolved_question_not_plain_question",
      "invalid_interpretation_envelope",
      "invalid_finding",
      "invalid_findings",
    ]);
    const validationIssueCode =
      finalProvider?.detail.validationIssues?.[0]?.code;
    const safeFailureCode = providerFailureCode &&
        disclosedProviderFailureCodes.has(providerFailureCode)
      ? providerFailureCode
      : validationIssueCode &&
          disclosedValidationIssueCodes.has(validationIssueCode)
        ? `openai_output_${validationIssueCode}`
        : failureStage === "network" ||
            failureStage === "response_headers" ||
            failureStage === "response_body"
          ? "openai_transport_unavailable"
          : failureStage === "model_output" || failureStage === "projection"
            ? "openai_output_validation_failed"
            : failureStage === "admission"
              ? "openai_usage_admission_failed"
              : "openai_request_failed";
    return {
      ...review,
      synthesis: {
        status: "failed",
        provider: "openai",
        model: SCREEN5_OPENAI_MODEL,
        attemptedAt,
        completedAt: null,
        safeFailureCode,
        claimCount: review.claims.length,
        usage: usage
          ? {
              inputTokens: usage.promptTokens,
              outputTokens: usage.completionTokens,
              totalTokens: usage.totalTokens,
            }
          : null,
      },
    };
  }

  private async advancePolicyStep(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      supportingEvidenceLeads?: readonly Screen02ComplementaryEvidenceLead[];
    },
    workflow: SixScreenWorkflowState,
    taskRecordInput: SixScreenResearchTaskRecord,
    previousReview: PolicyReview | null,
    planInput: PolicyEvidencePlan,
  ): Promise<PolicyResearchResult> {
    const taskStore = this.options.taskStore!;
    const evidenceStore = this.options.evidenceStore!;
    let taskRecord = taskRecordInput;
    const recoveredReview = this.latestCommittedPolicyReview(taskRecord);
    if (
      recoveredReview &&
      (!previousReview ||
        this.policyCheckpointFingerprint(recoveredReview) !==
          this.policyCheckpointFingerprint(previousReview))
    ) {
      const recoveredAt = this.options.now();
      if (
        taskRecord.expiresAt <= recoveredAt ||
        recoveredReview.protocolVersion !==
          SIX_SCREEN_POLICY_REVIEW_PROTOCOL_VERSION ||
        recoveredReview.taskId !== taskRecord.taskId ||
        recoveredReview.identityFingerprint !==
          workflow.confirmedShock?.identityFingerprint ||
        recoveredReview.plan.identityFingerprint !==
          workflow.confirmedShock?.identityFingerprint ||
        taskRecord.task.parent.identityFingerprint !==
          workflow.confirmedShock?.identityFingerprint
      ) {
        throw new Error(
          "The committed policy checkpoint is expired or incompatible with the current confirmed episode.",
        );
      }
      if (recoveredReview.evidenceSnapshotId) {
        const retained = await evidenceStore.read({
          ...authentication,
          snapshotId: recoveredReview.evidenceSnapshotId,
        });
        if (
          retained.outcome !== "found" ||
          retained.manifest.expiresAt <= recoveredAt ||
          retained.manifest.snapshot.snapshotFingerprint !==
            recoveredReview.evidenceSnapshotFingerprint
        ) {
          throw new Error(
            "The committed policy evidence checkpoint is unavailable, expired, or failed its integrity binding.",
          );
        }
      }
      const reusableReview: PolicyReview = {
        ...recoveredReview,
        artifactStatus: "current",
        invalidatedAt: null,
        invalidationReason: null,
        briefing: createPolicyBriefing({
          title: workflow.confirmedShock!.officialTitle,
          claims: recoveredReview.claims,
          requirements: recoveredReview.requirements,
          generatedAt: recoveredAt,
          studyPeriod: workflow.study.period,
          interpretation: recoveredReview.interpretation,
        }),
      };
      return this.applyPolicyReviewResult(authentication, input, reusableReview);
    }
    const plan = validatePolicyEvidencePlan(planInput);
    const stepId = plan.nextStepId;
    if (!stepId) {
      throw new Error(
        "The saved policy evidence plan has no additional bounded step available.",
      );
    }
    if (taskRecord.task.parent.identityFingerprint !== plan.identityFingerprint) {
      throw new Error("The saved policy task no longer matches the current workflow.");
    }
    const taskAuthentication = {
      ...authentication,
      taskId: taskRecord.taskId,
    };
    let previousCollection: EvidenceCollection | null = null;
    let previousSnapshotRevision = 0;
    if (previousReview?.evidenceSnapshotId) {
      const retained = await evidenceStore.read({
        ...authentication,
        snapshotId: previousReview.evidenceSnapshotId,
      });
      if (retained.outcome !== "found") {
        throw new Error(
          retained.outcome === "unauthorized"
            ? "Saved policy evidence access is unauthorized."
            : "The saved policy evidence checkpoint is unavailable.",
        );
      }
      previousCollection = retained.collection;
      previousSnapshotRevision = retained.manifest.snapshot.revision;
    }

    const now = this.options.now();
    const reservedOperation = [...taskRecord.task.operations]
      .reverse()
      .find(({ status }) => status === "reserved");
    if (reservedOperation) {
      if (Date.parse(reservedOperation.leaseExpiresAt) > Date.parse(now)) {
        throw new Error(
          "Policy research is already running. Reopen or retry after its bounded lease expires.",
        );
      }
      const expired = await taskStore.mutate({
        ...taskAuthentication,
        expectedRevision: taskRecord.task.revision,
        operationId:
          `policy-expire-${reservedOperation.generation}-${stepId}`,
        operationKind: "expire_policy_source_lease",
        inputFingerprint: reservedOperation.inputFingerprint,
        updatedAt: now,
      }, (stored) => {
        const outcome = expireResearchTaskOperation(stored, {
          expectedRevision: stored.revision,
          operationId: reservedOperation.operationId,
          inputFingerprint: reservedOperation.inputFingerprint,
          generation: reservedOperation.generation,
          expiredAt: now,
        });
        return { task: outcome.task, result: { retired: true, stepId } };
      });
      if (expired.outcome !== "updated" && expired.outcome !== "replayed") {
        throw new Error(`Policy task lease recovery failed (${expired.outcome}).`);
      }
      taskRecord = expired.record;
    }

    const execution = policyEvidenceExecutionForStep(plan, stepId);
    const attempt = taskRecord.task.operations.length + 1;
    const stepCoordinate = fingerprintSixScreenValue(stepId).slice(
      "fnv1a64:".length,
    );
    const actionCoordinate = fingerprintSixScreenValue(input.operationId).slice(
      "fnv1a64:".length,
    );
    const sourceOperationId =
      `policy-source-${stepCoordinate}-${attempt}-${actionCoordinate}`;
    const confirmedCandidate = workflow.candidates.find(
      ({ id }) => id === workflow.confirmedShock?.confirmation.candidateId,
    );
    const openStatesExplanationConfigured = Boolean(
      this.options.openStatesApiKey?.trim() &&
      confirmedCandidate &&
      /\b(?:state legislation|bill|resolution)\b/iu.test(
        confirmedCandidate.instrumentType,
      ),
    );
    const openAiPolicySourceDiscoveryConfigured =
      execution.sourceRoute === "complementary_policy_explanations" &&
      this.screen2PolicySourceDiscoveryIsConfigured();
    const sourceInputFingerprint = fingerprintSixScreenValue({
      requestHash: taskRecord.task.requestHash,
      priorEvidence: previousReview?.evidenceSnapshotFingerprint ?? null,
      adapter: execution.sourceRoute === "federal_register_ecfr_history"
        ? SIX_SCREEN_ECFR_HISTORY_ADAPTER_VERSION
        : execution.sourceRoute === "regulations_gov_docket"
          ? SIX_SCREEN_REGULATIONS_GOV_ADAPTER_VERSION
        : execution.sourceRoute === "complementary_policy_explanations"
          ? SIX_SCREEN_COMPLEMENTARY_POLICY_EVIDENCE_ADAPTER_VERSION
        : execution.sourceRoute === "confirmed_official_document" ||
            execution.sourceRoute === "official_document_relationships"
          ? SIX_SCREEN_OFFICIAL_DOCUMENT_POLICY_ADAPTER_VERSION
          : SIX_SCREEN_POLICY_REVIEW_PROTOCOL_VERSION,
      stepId,
      execution,
      govInfoConfigured: Boolean(this.options.govInfoApiKey),
      congressConfigured: Boolean(this.options.congressApiKey),
      openStatesConfigured: openStatesExplanationConfigured,
      openAiPolicySourceDiscoveryConfigured,
      regulationsGovConfigured: Boolean(this.options.regulationsApiKey),
      supportingEvidenceLeads: input.supportingEvidenceLeads ?? [],
      attempt,
    });
    const govInfoConfigured = Boolean(this.options.govInfoApiKey);
    const reservation = execution.sourceRoute ===
        "complementary_policy_explanations"
      ? {
          // Up to three Open States pages, one recent contextual query, and
          // one model-assisted historical web-source search. Returned web
          // pages remain separately fetched, identity-bound, and counted.
          sourceQueries: 5,
          metadataRecords: 50,
          documentAttempts: 6,
          usefulDocuments: 4,
          transportHops: 11,
          maximumReceivedBytes: 16 * 1024 * 1024,
          maximumDecodedBytes: 16 * 1024 * 1024,
          maximumActiveResearchMs: 110_000,
          maximumCpuMs: 8_000,
          providerCostUnits: {
            ...(openStatesExplanationConfigured ? { openstates: 3 } : {}),
            ...(openAiPolicySourceDiscoveryConfigured
              ? { openai_web_search: 1 }
              : {}),
          } as Record<string, number>,
        }
      : execution.sourceRoute === "regulations_gov_docket"
      ? {
          sourceQueries: 1,
          metadataRecords: 5,
          documentAttempts: 3,
          usefulDocuments: 1,
          transportHops: 4,
          maximumReceivedBytes: 2 * 1024 * 1024,
          maximumDecodedBytes: 2 * 1024 * 1024,
          maximumActiveResearchMs: 45_000,
          maximumCpuMs: 5_000,
          providerCostUnits: {},
        }
      : execution.sourceRoute === "confirmed_official_document" ||
        execution.sourceRoute === "official_document_relationships"
      ? {
          sourceQueries: execution.sourceRoute ===
              "official_document_relationships" ? 1 : 0,
          metadataRecords: execution.sourceRoute ===
              "official_document_relationships" ? 24 : 0,
          documentAttempts: 6,
          usefulDocuments: 4,
          transportHops: 8,
          maximumReceivedBytes: 12 * 1024 * 1024,
          maximumDecodedBytes: 12 * 1024 * 1024,
          maximumActiveResearchMs: 55_000,
          maximumCpuMs: 8_000,
          providerCostUnits: {},
        }
      : execution.sourceRoute === "federal_register_ecfr_history"
      ? {
          sourceQueries: govInfoConfigured ? 1 : 0,
          metadataRecords:
            SIX_SCREEN_ECFR_VERSION_METADATA_MAX_RECORDS +
            (govInfoConfigured ? 3 : 0),
          documentAttempts: govInfoConfigured ? 9 : 5,
          usefulDocuments: govInfoConfigured ? 6 : 4,
          transportHops: govInfoConfigured ? 14 : 10,
          maximumReceivedBytes:
            (govInfoConfigured ? 12 : 8) * 1024 * 1024 +
            SIX_SCREEN_ECFR_VERSION_METADATA_MAX_BYTES +
            (govInfoConfigured
              ? SIX_SCREEN_GOVINFO_ANNUAL_CFR_SEARCH_MAX_BYTES +
                SIX_SCREEN_GOVINFO_ANNUAL_CFR_XML_MAX_BYTES
              : 0),
          maximumDecodedBytes:
            (govInfoConfigured ? 12 : 8) * 1024 * 1024 +
            SIX_SCREEN_ECFR_VERSION_METADATA_MAX_BYTES +
            (govInfoConfigured
              ? SIX_SCREEN_GOVINFO_ANNUAL_CFR_SEARCH_MAX_BYTES +
                SIX_SCREEN_GOVINFO_ANNUAL_CFR_XML_MAX_BYTES
              : 0),
          maximumActiveResearchMs: govInfoConfigured ? 95_000 : 55_000,
          maximumCpuMs: 8_000,
          providerCostUnits: {},
        }
      : {
          sourceQueries: 0,
          metadataRecords: govInfoConfigured ? 1 : 0,
          documentAttempts: govInfoConfigured ? 4 : 2,
          usefulDocuments: 1,
          transportHops: govInfoConfigured ? 8 : 6,
          maximumReceivedBytes: (govInfoConfigured ? 8 : 4) * 1024 * 1024,
          maximumDecodedBytes: (govInfoConfigured ? 8 : 4) * 1024 * 1024,
          maximumActiveResearchMs: 25_000,
          maximumCpuMs: 5_000,
          providerCostUnits: {},
        };
    const reserved = await taskStore.mutate({
      ...taskAuthentication,
      expectedRevision: taskRecord.task.revision,
      operationId:
        `policy-reserve-${stepCoordinate}-${attempt}-${actionCoordinate}`,
      operationKind: "reserve_policy_source",
      inputFingerprint: sourceInputFingerprint,
      updatedAt: now,
    }, (stored) => {
      const outcome = reserveResearchTaskOperation(stored, {
        expectedRevision: stored.revision,
        operationId: sourceOperationId,
        inputFingerprint: sourceInputFingerprint,
        reservation,
        reservedAt: now,
        leaseExpiresAt: instantAfter(now, 30_000),
      });
      if (outcome.outcome !== "reserved") {
        throw new Error(
          `Policy research reservation failed (${outcome.outcome}${
            "limit" in outcome ? `: ${outcome.limit}` : ""
          }).`,
        );
      }
      return { task: outcome.task, result: outcome.operation };
    });
    if (reserved.outcome !== "updated" && reserved.outcome !== "replayed") {
      throw new Error(`Policy task persistence failed (${reserved.outcome}).`);
    }
    if (reserved.outcome === "replayed") {
      const recovered = this.latestCommittedPolicyReview(reserved.record);
      if (
        recovered &&
        (!previousReview || fingerprintSixScreenValue(recovered) !==
          fingerprintSixScreenValue(previousReview))
      ) {
        return this.applyPolicyReviewResult(authentication, input, recovered);
      }
      throw new Error(
        "Policy research is already running or its saved attempt is no longer active.",
      );
    }
    const sourceOperation = reserved.record.task.operations.find(
      ({ operationId }) => operationId === sourceOperationId,
    );
    if (!sourceOperation) {
      throw new Error("Policy task lost its source-operation lease.");
    }

    let acquisition = await (async () => {
      try {
        return execution.sourceRoute ===
        "complementary_policy_explanations"
      ? await acquireScreen02ComplementaryPolicyEvidence({
          workflow,
          fetch: this.options.fetch,
          retrievedAt: taskRecord.task.createdAt,
          documentNumber: plan.documentNumber,
          ...(this.options.congressApiKey !== undefined
            ? { congressApiKey: this.options.congressApiKey }
            : {}),
          ...(this.options.openStatesApiKey !== undefined
            ? { openStatesApiKey: this.options.openStatesApiKey }
            : {}),
          ...(openAiPolicySourceDiscoveryConfigured
            ? {
                publicWebFetch: this.options.publicWebFetch!,
                discoverAdditionalSources: (
                  request: Screen2PolicySourceDiscoveryRequest,
                ) => this.discoverScreen2PolicySources(
                  request,
                  sourceOperationId,
                ),
              }
            : {}),
          ...(input.supportingEvidenceLeads !== undefined
            ? { supportingEvidenceLeads: input.supportingEvidenceLeads }
            : {}),
          monotonicNow: this.options.monotonicNow,
        })
      : execution.sourceRoute === "confirmed_official_document" ||
        execution.sourceRoute === "official_document_relationships"
      ? await acquireScreen02OfficialDocumentPolicy({
          workflow,
          fetch: this.options.fetch,
          retrievedAt: taskRecord.task.createdAt,
          focus: execution.focus,
          searchedRequirementKinds: plan.steps.find(({ id }) => id === stepId)!
            .requirementKinds,
          monotonicNow: this.options.monotonicNow,
        })
      : execution.sourceRoute === "regulations_gov_docket"
        ? await acquireScreen02RegulationsGovPolicy({
            workflow,
            fetch: this.options.fetch,
            retrievedAt: taskRecord.task.createdAt,
            searchedRequirementKinds: plan.steps.find(({ id }) => id === stepId)!
              .requirementKinds,
            ...(this.options.regulationsApiKey !== undefined
              ? { apiKey: this.options.regulationsApiKey }
              : {}),
            monotonicNow: this.options.monotonicNow,
          })
      : execution.sourceRoute === "federal_register_ecfr_history"
        ? await acquireScreen02EcfrHistoricalPolicy({
          workflow,
          fetch: this.options.fetch,
          retrievedAt: taskRecord.task.createdAt,
          ...(this.options.govInfoApiKey !== undefined
            ? { govInfoApiKey: this.options.govInfoApiKey }
            : {}),
          monotonicNow: this.options.monotonicNow,
        })
        : await acquireScreen02FederalRegisterPolicy({
            workflow,
            fetch: this.options.fetch,
            retrievedAt: taskRecord.task.createdAt,
            focus: execution.focus,
            ...(this.options.govInfoApiKey !== undefined
              ? { govInfoApiKey: this.options.govInfoApiKey }
              : {}),
            monotonicNow: this.options.monotonicNow,
          });
    } catch (error) {
      if (error instanceof SixScreenWorkflowProblemError) throw error;
      workflowProblemFailure({
        code: "execution_failure",
        action: "policy_source_acquisition",
        operationId: input.operationId,
        screen: 2,
        expectedRevision: input.expectedRevision,
        actualRevision: workflow.revision,
        commitCertainty: "not_committed",
        dispatchCertainty: "unknown",
        recovery: "retry_local",
        safeCauseCodes: ["execution_failed"],
        });
      }
    })();
    let collection = previousCollection;
    let evidenceSnapshot = previousReview?.evidenceSnapshotId &&
        previousReview.evidenceSnapshotFingerprint
      ? {
          id: previousReview.evidenceSnapshotId,
          snapshotFingerprint: previousReview.evidenceSnapshotFingerprint,
        }
      : null;
    if (acquisition.parsed) {
      const step = plan.steps.find(({ id }) => id === stepId)!;
      let merged;
      try {
        merged = mergePolicyEvidenceCollections({
          previous: previousCollection,
          next: acquisition.parsed.collection,
          searchedKinds: step.requirementKinds,
        });
      } catch (error) {
        if (error instanceof SixScreenWorkflowProblemError) throw error;
        workflowProblemFailure({
          code: "execution_failure",
          action: "policy_evidence_merge",
          operationId: input.operationId,
          screen: 2,
          expectedRevision: input.expectedRevision,
          actualRevision: workflow.revision,
          commitCertainty: "not_committed",
          dispatchCertainty: "dispatched",
          recovery: "retry_local",
          safeCauseCodes: ["execution_failed"],
        });
      }
      if (!merged.claims.length) {
        acquisition = {
          ...acquisition,
          status: "unsupported",
          failureCode: "unparsed",
          unresolved: [...step.requirementKinds],
          limitation:
            "The exact document was inspected, but this bounded step retained no source-supported policy claim.",
          parsed: null,
        };
      } else {
        const snapshotRevision = previousSnapshotRevision + 1;
        const collectionCoordinate = fingerprintSixScreenValue(merged).slice(
          "fnv1a64:".length,
        );
        const nextSnapshot = createEvidenceSnapshot({
          id:
            `policy-evidence-${stepCoordinate}-r${snapshotRevision}-a${attempt}-${collectionCoordinate}`,
          revision: snapshotRevision,
          eventId: workflow.confirmedShock!.id,
          createdAt: now,
          collection: merged,
        });
        try {
          const persisted = await evidenceStore.create({
            runId: workflow.runId,
            accessToken: authentication.accessToken,
            snapshot: nextSnapshot,
            collection: merged,
            expiresAt: taskRecord.task.expiresAt,
          });
          if (persisted.outcome === "conflict") {
            throw new Error(
              "Policy evidence snapshot coordinate conflicted with different evidence.",
            );
          }
          collection = merged;
          evidenceSnapshot = nextSnapshot;
        } catch (error) {
          if (!(error instanceof SixScreenEvidenceCapacityError)) {
            if (error instanceof SixScreenWorkflowProblemError) throw error;
            workflowProblemFailure({
              code: "persistence_failure",
              action: "policy_evidence_checkpoint",
              operationId: input.operationId,
              screen: 2,
              expectedRevision: input.expectedRevision,
              actualRevision: workflow.revision,
              commitCertainty: "unknown",
              dispatchCertainty: "dispatched",
              recovery: "check_status",
              safeCauseCodes: ["persistence_failed"],
            });
          }
          acquisition = {
            ...acquisition,
            status: "unsupported",
            failureCode: "checkpoint_capacity",
            unresolved: ["durable evidence checkpoint"],
            limitation:
              "The policy evidence exceeded the durable checkpoint capacity; the previously saved evidence remains unchanged.",
            parsed: null,
          };
        }
      }
    }

    const committedAt = this.options.now();
    const planOutcome = acquisition.parsed
      ? "searched" as const
      : acquisition.failureCode === "source_unavailable"
        ? "waiting_source" as const
        : "blocked" as const;
    let updatedPlan;
    let review;
    try {
      updatedPlan = recordPolicyEvidencePlanAttempt(plan, {
      stepId,
      attemptedAt: committedAt,
      outcome: planOutcome,
      failureCode: acquisition.parsed ? null : acquisition.failureCode,
      note: acquisition.parsed
        ? acquisition.limitation ??
          (execution.sourceRoute === "confirmed_official_document"
            ? "The retained official-document representation was inspected and its source-supported findings were saved."
            : execution.sourceRoute === "complementary_policy_explanations"
            ? "Inspected, identity-bound explanatory passages were saved as introductory context without completing precise legal requirements."
            : execution.sourceRoute === "regulations_gov_docket"
            ? "The exact Regulations.gov administrative record was inspected and its bounded docket/stage metadata was saved without treating it as controlling legal text."
            : execution.sourceRoute === "federal_register_ecfr_history"
            ? "The date-specific pre-effective and effective-date eCFR representations were inspected and this step's findings were saved."
            : "The exact Federal Register representation was inspected and this step's findings were saved.")
        : acquisition.limitation,
    });
      review = policyReviewFromStep({
      acquisition,
      taskId: taskRecord.taskId,
      identityFingerprint: workflow.confirmedShock!.identityFingerprint,
      policyTitle: workflow.confirmedShock!.officialTitle,
      studyPeriod: workflow.study.period,
      previousReview,
      plan: updatedPlan,
      taskBeforeStep: taskRecord.task,
      researchedAt: committedAt,
      collection,
      evidenceSnapshot,
    });
    if (review.briefingQuality) {
      const adaptedPlan = adaptPolicyEvidencePlanToBriefingQuality(
        updatedPlan,
        { quality: review.briefingQuality, updatedAt: committedAt },
      );
      if (fingerprintSixScreenValue(adaptedPlan) !==
          fingerprintSixScreenValue(updatedPlan)) {
        updatedPlan = adaptedPlan;
        review = policyReviewFromStep({
          acquisition,
          taskId: taskRecord.taskId,
          identityFingerprint: workflow.confirmedShock!.identityFingerprint,
          policyTitle: workflow.confirmedShock!.officialTitle,
          studyPeriod: workflow.study.period,
          previousReview,
          plan: updatedPlan,
          taskBeforeStep: taskRecord.task,
          researchedAt: committedAt,
          collection,
          evidenceSnapshot,
        });
      }
    }
      if (updatedPlan.nextStepId === null) {
        review = await this.synthesizePolicyReview(
          review,
          workflow.confirmedShock!.officialTitle,
          workflow.study.period,
          input.operationId,
        );
      }
    } catch (error) {
      if (error instanceof SixScreenWorkflowProblemError) throw error;
      workflowProblemFailure({
        code: "execution_failure",
        action: "policy_review_projection",
        operationId: input.operationId,
        screen: 2,
        expectedRevision: input.expectedRevision,
        actualRevision: workflow.revision,
        commitCertainty: "not_committed",
        dispatchCertainty: "dispatched",
        recovery: "retry_local",
        safeCauseCodes: ["execution_failed"],
      });
    }
    const updatedStep = updatedPlan.steps.find(({ id }) => id === stepId)!;
    const remainingWorkIds = updatedPlan.nextStepId
      ? [updatedPlan.nextStepId]
      : [];
    const nextState = updatedStep.status === "waiting_source" &&
        updatedPlan.nextStepId === stepId
      ? "waiting_source" as const
      : remainingWorkIds.length
        ? "queued" as const
        : review.status === "ready"
          ? "completed" as const
          : "partial" as const;
    let committed;
    try {
      committed = await taskStore.mutate({
      ...taskAuthentication,
      expectedRevision: reserved.record.task.revision,
      operationId:
        `policy-commit-${stepCoordinate}-${attempt}-${actionCoordinate}`,
      operationKind: "commit_policy_step",
      inputFingerprint: sourceInputFingerprint,
      updatedAt: committedAt,
    }, (stored) => {
      const outcome = commitResearchTaskOperation(stored, {
        expectedRevision: stored.revision,
        operationId: sourceOperationId,
        inputFingerprint: sourceInputFingerprint,
        generation: sourceOperation.generation,
        actualUsage: acquisition.usage,
        completedWorkIds:
          updatedStep.status === "searched" || updatedStep.status === "blocked"
            ? [stepId]
            : [],
        remainingWorkIds,
        unresolvedRequirementIds: review.unresolved,
        nextState,
        stopReason: review.limitation,
        resultFingerprint: fingerprintSixScreenValue(review),
        committedAt,
      });
        return { task: outcome.task, result: review };
      });
    } catch (error) {
      if (error instanceof SixScreenWorkflowProblemError) throw error;
      workflowProblemFailure({
        code: "persistence_failure",
        action: "policy_task_commit",
        operationId: input.operationId,
        screen: 2,
        expectedRevision: input.expectedRevision,
        actualRevision: workflow.revision,
        commitCertainty: "unknown",
        dispatchCertainty: "dispatched",
        recovery: "check_status",
        safeCauseCodes: ["persistence_failed"],
      });
    }
    if (committed.outcome !== "updated" && committed.outcome !== "replayed") {
      throw new Error(`Policy task result persistence failed (${committed.outcome}).`);
    }
    const untouchedNextStep = updatedPlan.nextStepId
      ? updatedPlan.steps.find(({ id }) => id === updatedPlan.nextStepId)
      : null;
    if (
      !acquisition.parsed &&
      untouchedNextStep?.status === "not_started"
    ) {
      // A failed source route is local to that route. Continue through the
      // next untouched, independently bounded route in the same researcher
      // action so an unavailable explanation API/parser cannot suppress an
      // official document, implementation record, or other suitable source.
      // Waiting routes are not retried here: their single retry remains an
      // explicit later continuation after every untouched route has run.
      return this.advancePolicyStep(
        authentication,
        input,
        workflow,
        committed.record,
        committed.result as PolicyReview,
        updatedPlan,
      );
    }
    return this.applyPolicyReviewResult(
      authentication,
      input,
      committed.result as PolicyReview,
    );
  }

  async researchPolicy(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      supportingEvidenceLeads?: readonly Screen02ComplementaryEvidenceLead[];
    },
  ): Promise<PolicyResearchResult> {
    const taskStore = this.options.taskStore;
    if (!taskStore || !this.options.evidenceStore) {
      throw new Error(
        "Screen 2 policy research is unavailable until both durable task and evidence stores are configured.",
      );
    }
    const replayRead = await this.options.store.read(authentication);
    if (replayRead.outcome === "found") {
      const replay = await this.replayedPolicyApply(
        replayRead.record,
        authentication,
        input.operationId,
      );
      if (replay) return replay;
    }
    const { workflow, confirmed, candidate } = await this.currentPolicyWorkflow(
      authentication,
      input.expectedRevision,
    );
    if (workflow.policyReview) {
      throw new Error(
        "A saved policy review already exists. Continue its next evidence-plan step instead of starting a new budget.",
      );
    }
    const documentNumbers = new Set(
      confirmed.formalIdentifiers.flatMap((value) =>
        value.match(/\b\d{4}-\d{4,6}\b/gu) ?? []
      ),
    );
    const documentNumber = documentNumbers.size === 1
      ? [...documentNumbers][0]!
      : null;
    const federalRoute = Boolean(
      documentNumber &&
      candidate.identitySources.some((source) => {
        const { routeId, locator } = source;
        if (routeId === "exact_federal_register_document") return true;
        if (routeId === "federal_register_api_excerpt") {
          return isRetainedFederalRegisterApiPlanSource(source, documentNumber);
        }
        if (routeId !== "reviewed_official_document") return false;
        try {
          const url = new URL(locator);
          const host = url.hostname.toLocaleLowerCase("en-US");
          const locatorDocumentNumber =
            /^\/documents\/\d{4}\/\d{2}\/\d{2}\/(\d{4}-\d{4,6})(?:\/|$)/u
              .exec(url.pathname)?.[1];
          return (
            url.protocol === "https:" &&
            (host === "federalregister.gov" ||
              host === "www.federalregister.gov") &&
            locatorDocumentNumber === documentNumber
          );
        } catch {
          return false;
        }
      }),
    );
    const officialDocumentSource = preferredScreen02OfficialDocumentSource(
      candidate,
    );
    const complementaryRouteAvailable = Boolean(
      input.supportingEvidenceLeads?.length ||
      candidate.identitySources.some(({ locator }) => {
        try {
          return new URL(locator).protocol === "https:";
        } catch {
          return false;
        }
      }),
    );
    if (!federalRoute && !officialDocumentSource && !complementaryRouteAvailable) {
      throw new Error(
        "This confirmed identity has no bounded documentary or explanatory continuation route. The confirmation remains saved and no different policy was substituted.",
      );
    }
    const coordinate = fingerprintSixScreenValue({
      protocol: SIX_SCREEN_POLICY_REVIEW_PROTOCOL_VERSION,
      identityFingerprint: confirmed.identityFingerprint,
    }).slice("fnv1a64:".length);
    const taskId = `policy-task-${coordinate}`;
    const taskAuthentication = { ...authentication, taskId };
    let existing = await taskStore.read(taskAuthentication);
    if (existing.outcome === "unauthorized") {
      throw new Error("Six-screen policy task access is unauthorized.");
    }
    if (existing.outcome === "not_found") {
      existing = await taskStore.readLatestPolicyForIdentity({
        ...authentication,
        identityFingerprint: confirmed.identityFingerprint,
      });
      if (existing.outcome === "unauthorized") {
        throw new Error("Six-screen policy task access is unauthorized.");
      }
    }
    let taskRecord: SixScreenResearchTaskRecord;
    let plan: PolicyEvidencePlan;
    if (existing.outcome === "found") {
      taskRecord = existing.record;
      const request = taskRecord.task.immutableRequest as {
        plan?: PolicyEvidencePlan;
      };
      if (!request.plan) {
        throw new Error("The saved policy task omitted its immutable evidence plan.");
      }
      plan = activateHistoricalPolicyEvidencePlan(request.plan, {
        regulationsGovEnabled: Boolean(this.options.regulationsApiKey),
      });
    } else {
      const taskCreatedAt = this.options.now();
      plan = federalRoute
        ? createFederalRegisterPolicyEvidencePlan({
            id: `policy-plan-${coordinate}`,
            identityFingerprint: confirmed.identityFingerprint,
            documentNumber: documentNumber!,
            createdAt: taskCreatedAt,
            regulationsGovEnabled: Boolean(this.options.regulationsApiKey),
          })
        : createOfficialDocumentPolicyEvidencePlan({
            id: `policy-plan-${coordinate}`,
            identityFingerprint: confirmed.identityFingerprint,
            jurisdiction: confirmed.issuingJurisdiction,
            sourceId: officialDocumentSource?.id ??
              candidate.identitySources[0]?.id ?? candidate.id,
            instrumentFamily:
              /\b(?:public law|statute)\b/iu.test(
                  confirmed.instrumentType,
                ) || candidate.identitySources.some(({ routeId }) =>
                  routeId === "govinfo_public_law")
                ? "federal_statute"
                : "official_document",
            createdAt: taskCreatedAt,
          });
      const immutableRequest = {
        protocol: SIX_SCREEN_POLICY_REVIEW_PROTOCOL_VERSION,
        studyRevision: workflow.study.revision,
        identityFingerprint: confirmed.identityFingerprint,
        formalIdentifiers: [...confirmed.formalIdentifiers],
        identitySources: candidate.identitySources.map(({
          id,
          locator,
          provider,
          nativeId,
          routeId,
          routeVersion,
          accessStatus,
          inspectedText,
          contentHash,
        }) => ({
          id,
          locator,
          provider: provider ?? null,
          nativeId: nativeId ?? null,
          routeId: routeId ?? null,
          routeVersion: routeVersion ?? null,
          accessStatus: accessStatus ?? null,
          inspectedText: inspectedText ?? null,
          contentHash: contentHash ?? null,
        })),
        initialSupportingEvidenceLeads:
          structuredClone(input.supportingEvidenceLeads ?? []),
        plan,
        retrievedAt: taskCreatedAt,
      };
      // The profile separately caps enabled research at 120 seconds. This
      // wall-clock boundary covers automatic continuation and explicit recovery
      // after interruption, so paused host time does not consume the active-
      // research allowance.
      const taskExpiresAt = instantAfter(
        taskCreatedAt,
        SIX_SCREEN_WORKFLOW_RESUME_RETENTION_MS,
      );
      const task = createResearchTask({
        id: taskId,
        runId: workflow.runId,
        kind: "policy",
        parent: {
          studyRevision: workflow.study.revision,
          identityFingerprint: confirmed.identityFingerprint,
          eventCardSnapshotId: null,
          selectedDesignSnapshotId: null,
          coeventSnapshotId: null,
          mechanismSnapshotId: null,
        },
        immutableRequest,
        profileName: "policy-standard",
        pendingWorkIds: plan.nextStepId ? [plan.nextStepId] : [],
        unresolvedRequirementIds: plan.steps.flatMap(
          ({ requirementKinds }) => requirementKinds,
        ),
        continuationMode: "automatic_standard",
        createdAt: taskCreatedAt,
        absoluteDeadline: taskExpiresAt,
        expiresAt: taskExpiresAt,
      });
      const created = await taskStore.create({
        task,
        accessToken: authentication.accessToken,
        createInputFingerprint: fingerprintSixScreenValue(immutableRequest),
      });
      if (created.outcome === "conflict") {
        throw new Error("Policy task coordinate was reused for different input.");
      }
      taskRecord = created.record;
    }
    return this.advancePolicyStep(
      authentication,
      input,
      workflow,
      taskRecord,
      null,
      plan,
    );
  }

  async continuePolicyResearch(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      supportingEvidenceLeads?: readonly Screen02ComplementaryEvidenceLead[];
    },
  ): Promise<PolicyResearchResult> {
    const taskStore = this.options.taskStore;
    if (!taskStore || !this.options.evidenceStore) {
      throw new Error(
        "Screen 2 policy continuation is unavailable until both durable task and evidence stores are configured.",
      );
    }
    const replayRead = await this.options.store.read(authentication);
    if (replayRead.outcome === "found") {
      const replay = await this.replayedPolicyApply(
        replayRead.record,
        authentication,
        input.operationId,
      );
      if (replay) return replay;
    }
    const { workflow, confirmed } = await this.currentPolicyWorkflow(
      authentication,
      input.expectedRevision,
    );
    const review = workflow.policyReview;
    if (
      !review || !["current", "out_of_date"].includes(review.artifactStatus) ||
      review.identityFingerprint !== confirmed.identityFingerprint
    ) {
      throw new Error(
        "Policy continuation requires a compatible saved Screen 2 review for the current confirmed episode.",
      );
    }
    const plan = activateHistoricalPolicyEvidencePlan(review.plan, {
      regulationsGovEnabled: Boolean(this.options.regulationsApiKey),
    });
    const taskRead = await taskStore.read({
      ...authentication,
      taskId: review.taskId,
    });
    if (taskRead.outcome !== "found") {
      throw new Error(
        taskRead.outcome === "unauthorized"
          ? "Six-screen policy task access is unauthorized."
          : "The saved policy task is unavailable or expired.",
      );
    }
    if (review.artifactStatus === "out_of_date") {
      const restoredAt = this.options.now();
      const checkpoint = this.latestCommittedPolicyReview(taskRead.record);
      if (
        taskRead.record.expiresAt <= restoredAt || !checkpoint ||
        checkpoint.protocolVersion !== SIX_SCREEN_POLICY_REVIEW_PROTOCOL_VERSION ||
        checkpoint.taskId !== review.taskId ||
        checkpoint.identityFingerprint !== confirmed.identityFingerprint ||
        checkpoint.plan.identityFingerprint !== confirmed.identityFingerprint ||
        taskRead.record.task.parent.identityFingerprint !==
          confirmed.identityFingerprint
      ) {
        throw new Error(
          "The prior Screen 2 checkpoint is expired or incompatible with the current confirmed episode.",
        );
      }
      if (checkpoint.evidenceSnapshotId) {
        const retained = await this.options.evidenceStore.read({
          ...authentication,
          snapshotId: checkpoint.evidenceSnapshotId,
        });
        if (
          retained.outcome !== "found" ||
          retained.manifest.expiresAt <= restoredAt ||
          retained.manifest.snapshot.snapshotFingerprint !==
            checkpoint.evidenceSnapshotFingerprint
        ) {
          throw new Error(
            "The prior Screen 2 evidence checkpoint is unavailable, expired, or failed its integrity binding.",
          );
        }
      }
      const restoredReview: PolicyReview = {
        ...checkpoint,
        artifactStatus: "current",
        invalidatedAt: null,
        invalidationReason: null,
        briefing: createPolicyBriefing({
          title: confirmed.officialTitle,
          claims: checkpoint.claims,
          requirements: checkpoint.requirements,
          generatedAt: restoredAt,
          studyPeriod: workflow.study.period,
          interpretation: checkpoint.interpretation,
        }),
      };
      return this.applyPolicyReviewResult(
        authentication,
        input,
        restoredReview,
      );
    }
    return this.advancePolicyStep(
      authentication,
      input,
      workflow,
      taskRead.record,
      review,
      plan,
    );
  }

  async beginPolicyEventCardReview(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      revisionReason?: string | null;
    },
  ) {
    const projection = await this.currentPolicyEventCardMutationProjection(
      authentication,
      input,
    );
    const coordinate = fingerprintSixScreenValue(input.operationId).slice(
      "fnv1a64:".length,
    );
    const applied = await this.mutation(authentication, {
      expectedRevision: input.expectedRevision,
      operationId: input.operationId,
      operationKind: "begin_policy_event_card_review",
      payload: { revisionReason: input.revisionReason ?? null },
    }, (state) => {
      if (!projection) {
        throw new Error("A Policy Event Card replay lost its stored operation result.");
      }
      const outcome = beginPolicyEventCardReview(state, {
        expectedRevision: input.expectedRevision,
        reviewId: `policy-event-card-review-${coordinate}`,
        projection,
        revisionReason: input.revisionReason,
        startedAt: this.options.now(),
      });
      return { state: outcome.state, result: outcome.review };
    });
    const workspace = projection && !applied.replayed
      ? policyEventCardWorkspaceFromProjection(
          applied.privateSnapshot.state,
          projection,
        )
      : await this.policyEventCardWorkspace(
          authentication,
          applied.privateSnapshot.state,
          false,
        );
    return {
      ...applied,
      projection: {
        ...applied.projection,
        policyEventCardWorkspace: workspace,
      },
      review: structuredClone(applied.result as PolicyEventCardReviewState),
    };
  }

  async reviewPolicyEventCardClaim(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      reviewId: string;
      expectedReviewRevision: number;
      expectedReviewFingerprint: string;
      claimId: string;
      decision: Exclude<PolicyClaimReviewDecision, "unreviewed">;
      correctedStatement?: string | null;
      rationale: string;
    },
  ) {
    const projection = await this.currentPolicyEventCardMutationProjection(
      authentication,
      input,
    );
    const coordinate = fingerprintSixScreenValue(input.operationId).slice(
      "fnv1a64:".length,
    );
    const payload = {
      reviewId: input.reviewId,
      expectedReviewRevision: input.expectedReviewRevision,
      expectedReviewFingerprint: input.expectedReviewFingerprint,
      claimId: input.claimId,
      decision: input.decision,
      correctedStatement: input.correctedStatement ?? null,
      rationale: input.rationale,
    };
    const applied = await this.mutation(authentication, {
      expectedRevision: input.expectedRevision,
      operationId: input.operationId,
      operationKind: "review_policy_event_card_claim",
      payload,
    }, (state) => {
      if (!projection) {
        throw new Error("A Policy Event Card replay lost its stored operation result.");
      }
      const outcome = applyPolicyEventCardClaimDecision(state, {
        expectedRevision: input.expectedRevision,
        reviewId: input.reviewId,
        projection,
        expectedReviewRevision: input.expectedReviewRevision,
        expectedReviewFingerprint: input.expectedReviewFingerprint,
        actionId: `policy-claim-review-${coordinate}`,
        claimId: input.claimId,
        decision: input.decision,
        correctedStatement: input.correctedStatement,
        rationale: input.rationale,
        actor: "researcher_ui",
        decidedAt: this.options.now(),
      });
      return { state: outcome.state, result: outcome.review };
    });
    const workspace = projection && !applied.replayed
      ? policyEventCardWorkspaceFromProjection(
          applied.privateSnapshot.state,
          projection,
        )
      : await this.policyEventCardWorkspace(
          authentication,
          applied.privateSnapshot.state,
          false,
        );
    return {
      ...applied,
      projection: {
        ...applied.projection,
        policyEventCardWorkspace: workspace,
      },
      review: structuredClone(applied.result as PolicyEventCardReviewState),
    };
  }

  async decidePolicyTreatmentClock(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      reviewId: string;
      expectedReviewRevision: number;
      expectedReviewFingerprint: string;
      decision:
        | { mode: "selected"; candidateId: string }
        | { mode: "no_selection" };
      rationale: string;
    },
  ) {
    const projection = await this.currentPolicyEventCardMutationProjection(
      authentication,
      input,
    );
    const coordinate = fingerprintSixScreenValue(input.operationId).slice(
      "fnv1a64:".length,
    );
    const payload = {
      reviewId: input.reviewId,
      expectedReviewRevision: input.expectedReviewRevision,
      expectedReviewFingerprint: input.expectedReviewFingerprint,
      decision: input.decision,
      rationale: input.rationale,
    };
    const applied = await this.mutation(authentication, {
      expectedRevision: input.expectedRevision,
      operationId: input.operationId,
      operationKind: "decide_policy_treatment_clock",
      payload,
    }, (state) => {
      if (!projection) {
        throw new Error("A Policy Event Card replay lost its stored operation result.");
      }
      const outcome = applyPolicyTreatmentClockDecision(state, {
        expectedRevision: input.expectedRevision,
        reviewId: input.reviewId,
        projection,
        expectedReviewRevision: input.expectedReviewRevision,
        expectedReviewFingerprint: input.expectedReviewFingerprint,
        actionId: `policy-treatment-clock-${coordinate}`,
        decision: input.decision,
        rationale: input.rationale,
        actor: "researcher_ui",
        decidedAt: this.options.now(),
      });
      return { state: outcome.state, result: outcome.review };
    });
    const workspace = projection && !applied.replayed
      ? policyEventCardWorkspaceFromProjection(
          applied.privateSnapshot.state,
          projection,
        )
      : await this.policyEventCardWorkspace(
          authentication,
          applied.privateSnapshot.state,
          false,
        );
    return {
      ...applied,
      projection: {
        ...applied.projection,
        policyEventCardWorkspace: workspace,
      },
      review: structuredClone(applied.result as PolicyEventCardReviewState),
    };
  }

  async lockPolicyEventCard(
    authentication: SixScreenWorkflowAuthentication,
    input: {
      expectedRevision: number;
      operationId: string;
      reviewId: string;
      expectedReviewRevision: number;
      expectedReviewFingerprint: string;
      rationale: string;
    },
  ) {
    const projection = await this.currentPolicyEventCardMutationProjection(
      authentication,
      input,
    );
    const coordinate = fingerprintSixScreenValue(input.operationId).slice(
      "fnv1a64:".length,
    );
    const payload = {
      reviewId: input.reviewId,
      expectedReviewRevision: input.expectedReviewRevision,
      expectedReviewFingerprint: input.expectedReviewFingerprint,
      rationale: input.rationale,
    };
    const applied = await this.mutation(authentication, {
      expectedRevision: input.expectedRevision,
      operationId: input.operationId,
      operationKind: "lock_policy_event_card",
      payload,
    }, (state) => {
      if (!projection) {
        throw new Error("A Policy Event Card replay lost its stored operation result.");
      }
      const outcome = lockReviewedPolicyEventCard(state, {
        expectedRevision: input.expectedRevision,
        reviewId: input.reviewId,
        projection,
        expectedReviewRevision: input.expectedReviewRevision,
        expectedReviewFingerprint: input.expectedReviewFingerprint,
        actionId: `policy-event-card-lock-${coordinate}`,
        eventCardSnapshotId: `policy-event-card-${coordinate}`,
        rationale: input.rationale,
        actor: "researcher_ui",
        lockedAt: this.options.now(),
      });
      return {
        state: outcome.state,
        result: {
          review: outcome.review,
          eventCard: outcome.eventCard,
        },
      };
    });
    const workspace = projection && !applied.replayed
      ? policyEventCardWorkspaceFromProjection(
          applied.privateSnapshot.state,
          projection,
        )
      : await this.policyEventCardWorkspace(
          authentication,
          applied.privateSnapshot.state,
          false,
        );
    const result = applied.result as {
      review: PolicyEventCardReviewState;
      eventCard: NonNullable<PolicyEventCardReviewState["lockedEventCard"]>;
    };
    return {
      ...applied,
      projection: {
        ...applied.projection,
        policyEventCardWorkspace: workspace,
      },
      review: structuredClone(result.review),
      eventCard: structuredClone(result.eventCard),
    };
  }

  displayCandidate(authentication: SixScreenWorkflowAuthentication, input: {
    expectedRevision: number;
    operationId: string;
    candidateId: string;
  }) {
    return this.mutation(authentication, {
      ...input,
      operationKind: "display_identity_candidate",
      payload: { candidateId: input.candidateId },
    }, (state) => ({
      state: displayIdentityCandidate(state, {
        expectedRevision: input.expectedRevision,
        candidateId: input.candidateId,
        displayedAt: this.options.now(),
      }),
    }));
  }

  deferCandidate(authentication: SixScreenWorkflowAuthentication, input: {
    expectedRevision: number;
    operationId: string;
    candidateId: string;
    action: "different_version" | "rejected";
    note?: string | null;
  }) {
    return this.mutation(authentication, {
      ...input,
      operationKind: "defer_identity_candidate",
      payload: input,
    }, (state) => ({
      state: deferDisplayedCandidate(state, {
        expectedRevision: input.expectedRevision,
        candidateId: input.candidateId,
        action: input.action,
        interactionId: `decision-${input.operationId}`.slice(0, 200),
        note: input.note,
        decidedAt: this.options.now(),
      }),
    }));
  }

  addSource(authentication: SixScreenWorkflowAuthentication, input: {
    expectedRevision: number;
    operationId: string;
    sourceUrl: string;
  }) {
    return this.mutation(authentication, {
      ...input,
      operationKind: "add_identity_source",
      payload: { sourceUrl: input.sourceUrl },
    }, (state) => ({
      state: addOfficialIdentitySource(state, {
        expectedRevision: input.expectedRevision,
        sourceUrl: input.sourceUrl,
        interactionId: `source-${input.operationId}`.slice(0, 200),
        addedAt: this.options.now(),
      }),
    }));
  }

  confirmShock(authentication: SixScreenWorkflowAuthentication, input: {
    expectedRevision: number;
    operationId: string;
    candidateId: string;
    displayedIdentityFingerprint: string;
    sourceSnapshotId: string;
    sourceSnapshotFingerprint: string;
    originalRequestFingerprint: string;
    currentRequestFingerprint: string;
    identityRevision: number;
  }) {
    return this.mutation(authentication, {
      ...input,
      operationKind: "confirm_shock",
      payload: input,
    }, (state) => ({
      state: confirmDisplayedShock(state, {
        expectedRevision: input.expectedRevision,
        candidateId: input.candidateId,
        displayedIdentityFingerprint: input.displayedIdentityFingerprint,
        sourceSnapshotId: input.sourceSnapshotId,
        sourceSnapshotFingerprint: input.sourceSnapshotFingerprint,
        originalRequestFingerprint: input.originalRequestFingerprint,
        currentRequestFingerprint: input.currentRequestFingerprint,
        identityRevision: input.identityRevision,
        interactionId: `interaction-${input.operationId}`.slice(0, 200),
        decisionId: `confirmation-${input.operationId}`.slice(0, 200),
        actor: "researcher_ui",
        confirmedAt: this.options.now(),
      }),
    }));
  }

  openScreen2(authentication: SixScreenWorkflowAuthentication, input: {
    expectedRevision: number;
    operationId: string;
  }) {
    return this.mutation(authentication, {
      ...input,
      operationKind: "open_screen_2",
      payload: { expectedRevision: input.expectedRevision },
    }, (state) => {
      const opened = openScreen2(state, {
        expectedRevision: input.expectedRevision,
        openedAt: this.options.now(),
      });
      return { state: opened.state, result: opened.receipt };
    });
  }
}
