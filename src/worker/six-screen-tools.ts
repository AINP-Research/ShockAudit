import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { sixScreenActionPolicy } from
  "../core/six-screen/action-policy";
import {
  fingerprintSixScreenValue,
  serializeSixScreenValue,
} from "../core/six-screen/canonical";
import type { StudyContextDraft } from "../core/six-screen/workflow";
import {
  SixScreenWorkflowProblemError,
  classifySixScreenWorkflowProblem,
  createSixScreenWorkflowProblem,
  encodeSixScreenWorkflowProblemText,
  type ClassifySixScreenWorkflowProblemContext,
} from "../core/six-screen/workflow-problem";
import { SIX_SCREEN_OPTIONAL_ANALYSIS_RECOVERY_VERSION } from
  "../core/six-screen/contracts";
import {
  SIX_SCREEN_POLICY_EVENT_CARD_WORKSPACE_META_KEY,
  SIX_SCREEN_POLICY_LIFECYCLE_STAGE_WORKSPACE_META_KEY,
  SIX_SCREEN_WORKFLOW_META_KEY,
  SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY,
} from "../core/six-screen/metadata-keys";
import {
  createSixScreenWorkflowResponseContract,
  encodeSixScreenWorkflowPayload,
  sixScreenWorkflowMutationRequestBinding,
  sixScreenWorkflowStateChunks,
  sixScreenWorkflowStateTransferId,
  SIX_SCREEN_MAX_STATE_CHUNKS,
  SIX_SCREEN_MAX_CANONICAL_PAYLOAD_BYTES,
  SIX_SCREEN_MAX_ENCODED_PAYLOAD_BYTES,
  SIX_SCREEN_STATE_CHUNK_BYTES,
  SIX_SCREEN_WORKFLOW_STATE_CHUNK_SCHEMA_VERSION,
  SIX_SCREEN_WORKFLOW_STATE_CHUNK_TOOL,
  SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID,
  type SixScreenWorkflowResponseOperationBinding,
  type SixScreenWorkflowResponseContract,
} from "../core/six-screen/workflow-response-contract";
import {
  SIX_SCREEN_OPERATION_STATUS_SCHEMA_VERSION,
  SIX_SCREEN_OPERATION_STATUS_TOOL,
} from "../core/six-screen/operation-status";
import {
  SIX_SCREEN_RECOVERY_SNAPSHOT_ENCODING,
  SIX_SCREEN_RECOVERY_SNAPSHOT_SCHEMA_VERSION,
  SIX_SCREEN_RECOVERY_SNAPSHOT_TOOL,
  createSixScreenRecoverySnapshot,
} from "../core/six-screen/recovery-snapshot";
import {
  SCREEN6_RESEARCHER_REPORTED_CONCERNS,
} from "../core/six-screen/screen6-diagnostic-plan";
import {
  SCREEN6_CLAIM_LEVELS,
  SCREEN6_RESEARCH_DISPOSITIONS,
} from "../core/six-screen/screen6-claim-boundary";
import {
  SIX_SCREEN_WORKFLOW_PRIVATE_SCHEMA_VERSION,
  SIX_SCREEN_WORKFLOW_PUBLIC_SCHEMA_VERSION,
  SCREEN5_EXECUTION_MISSING_SETTINGS,
  SixScreenWorkflowRuntime,
  type PolicyEventCardWorkspace,
  type PolicyLifecycleStageReviewWorkspace,
  type SixScreenWorkflowPrivateSnapshot,
  type SixScreenWorkflowPublicProjection,
} from "./six-screen-workflow-runtime";
import {
  SHOCKAUDIT_VERSION,
  SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI,
} from "../version";

export {
  SIX_SCREEN_POLICY_EVENT_CARD_WORKSPACE_META_KEY,
  SIX_SCREEN_POLICY_LIFECYCLE_STAGE_WORKSPACE_META_KEY,
  SIX_SCREEN_WORKFLOW_META_KEY,
  SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY,
};

const id = z.string().min(1).max(200)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u);
const runId = z.string().regex(/^sa6r_[A-Za-z0-9_-]{43}$/u);
const accessToken = z.string().regex(/^sa6a_[A-Za-z0-9_-]{43}$/u);
const boundedText = z.string().max(4_000);
const rationale = z.string().min(1).max(2_000);
const fingerprint = z.string().regex(/^fnv1a64:[0-9a-f]{16}$/u);
const nullableText = z.string().max(4_000).nullable();
const optionalNullableText = nullableText.optional();

const causalComparisonInputSchema = z.object({
  policyTarget: z.enum([
    "full_policy_package",
    "policy_component",
    "legal_eligibility",
    "actual_compliance",
    "other_defined_exposure",
  ]),
  targetDetail: nullableText,
  targetClaimIds: z.array(id).min(1).max(24),
  variationClaimIds: z.array(id).min(1).max(24),
  assignmentUnit: z.string().min(1).max(500),
  proposedTreatedGroup: nullableText,
  proposedComparisonGroup: nullableText,
  dataAvailability: z.enum([
    "not_assessed",
    "available",
    "partially_available",
    "unavailable",
  ]),
  dataFrequency: z.string().max(500).nullable(),
  historicalEligibilityFields:
    z.array(z.string().min(1).max(500)).max(20),
  designConstraints: z.array(z.string().min(1).max(500)).max(20),
}).strict();

const coEventScopeInputSchema = z.object({
  anticipationLookback: z.object({
    amount: z.number().int().min(0).max(120),
    unit: z.enum(["days", "months", "years"]),
  }).strict(),
  contextLookforward: z.object({
    amount: z.number().int().min(0).max(120),
    unit: z.enum(["days", "months", "years"]),
  }).strict(),
  knownCoEvents: z.array(z.string().min(1).max(500)).max(20),
  importantEntities: z.array(z.object({
    kind: z.enum(["supplier", "customer", "regulator", "market", "other"]),
    label: z.string().min(1).max(500),
  }).strict()).max(24),
  includeMeasurementChanges: z.boolean(),
}).strict();

const mechanismLiteratureInputSchema = z.object({
  explanation: z.discriminatedUnion("mode", [
    z.object({
      mode: z.literal("stated"),
      text: z.string().min(1).max(4_000),
    }).strict(),
    z.object({
      mode: z.literal("undecided"),
      text: z.null(),
    }).strict(),
  ]),
  suppliedWorks: z.array(z.object({
    id,
    kind: z.enum(["doi", "openalex_id", "url", "citation"]),
    value: z.string().min(1).max(2_000),
  }).strict()).max(24),
  preferredConstructs: z.array(z.string().min(1).max(1_000)).max(20),
  feasibleDataSources: z.array(z.string().min(1).max(1_000)).max(20),
  knownAlternativeAccounts:
    z.array(z.string().min(1).max(1_000)).max(20),
}).strict();

const mechanismClaimReferenceSchema = z.object({
  extractionId: id,
  extractionFingerprint: fingerprint,
  reviewId: id,
  reviewFingerprint: fingerprint,
}).strict();

const mechanismCardDraftSchema = z.object({
  id,
  label: z.string().min(1).max(200),
  role: z.enum([
    "focal",
    "rival",
    "complementary",
    "offsetting",
    "independent_coevent",
    "measurement_alternative",
  ]),
  decision: z.enum(["retained", "rejected", "deferred"]),
  causalSequence: z.array(z.string().min(1).max(1_000)).min(2).max(6),
  theoreticalAnchor: z.string().min(1).max(4_000),
  policyConnection: z.string().min(1).max(4_000),
  contextualFit: z.string().min(1).max(4_000),
  uncertainty: z.string().min(1).max(4_000),
  evidenceLevel: z.enum([
    "source_grounded",
    "partially_source_grounded",
    "researcher_hypothesis",
  ]),
  acceptedClaimReferences: z.array(mechanismClaimReferenceSchema).max(12),
  researcherRationale: z.string().min(1).max(4_000),
}).strict();

const predictionRowDraftSchema = z.object({
  id,
  observation: z.string().min(1).max(4_000),
  feasibleMeasure: z.string().min(1).max(4_000),
  timing: z.string().min(1).max(4_000),
  dataSource: z.string().min(1).max(4_000),
  feasibility: z.enum([
    "feasible_now",
    "feasible_with_additional_data",
    "not_currently_feasible",
  ]),
  priority: z.enum(["high", "medium", "low"]),
  assumptions: z.array(z.string().min(1).max(1_000)).max(10),
  patterns: z.array(z.object({
    mechanismId: id,
    direction: z.enum([
      "increase",
      "decrease",
      "no_change",
      "nonlinear",
      "ambiguous",
      "not_applicable",
    ]),
    detail: z.string().min(1).max(4_000),
  }).strict()).min(1).max(4),
}).strict();

const mechanismReviewDraftSchema = z.object({
  intendedClaim: z.enum([
    "total_effect_only",
    "compare_mechanisms_without_identification",
    "seek_unique_mechanism_evidence",
  ]),
  focalMechanismId: id.nullable(),
  mechanisms: z.array(mechanismCardDraftSchema).min(1).max(4),
  predictions: z.array(predictionRowDraftSchema).min(1).max(12),
  overallRationale: z.string().min(1).max(4_000),
}).strict();

const screen6PeriodAvailabilitySchema = z.object({
  status: z.enum(["available", "unavailable", "not_assessed"]),
  count: z.number().int().min(0).max(10_000).nullable(),
  description: z.string().min(1).max(1_000).nullable(),
}).strict();

const screen6DiagnosticInputSchema = z.object({
  preTreatmentPeriods: screen6PeriodAvailabilitySchema,
  postTreatmentPeriods: screen6PeriodAvailabilitySchema,
  outcomeFrequency: z.object({
    status: z.enum(["known", "not_assessed"]),
    value: z.string().min(1).max(500).nullable(),
  }).strict(),
  assignmentStructure: z.object({
    status: z.enum(["described", "not_assessed"]),
    description: z.string().min(1).max(2_000).nullable(),
    timingPattern: z.enum([
      "single_time",
      "staggered",
      "rolling_or_continuous",
      "not_assessed",
    ]),
    dependence: z.enum([
      "independent_units",
      "grouped_or_clustered",
      "not_assessed",
    ]),
    independentGroupCount:
      z.number().int().min(1).max(1_000_000).nullable(),
    groupingVariables: z.array(z.string().min(1).max(500)).max(20),
  }).strict(),
  feasibleDiagnosticVariables: z.object({
    status: z.enum(["available", "none_identified", "not_assessed"]),
    values: z.array(z.string().min(1).max(500)).max(40),
  }).strict(),
  practicalConstraints: z.object({
    status: z.enum(["reported", "none_reported", "not_assessed"]),
    values: z.array(z.string().min(1).max(1_000)).max(30),
  }).strict(),
  reportedConcerns:
    z.array(z.enum(SCREEN6_RESEARCHER_REPORTED_CONCERNS)).max(
      SCREEN6_RESEARCHER_REPORTED_CONCERNS.length,
    ),
}).strict();

const screen6ResultConsiderationSchema = z.object({
  status: z.enum(["assessed", "not_assessed", "not_applicable"]),
  description: z.string().min(1).max(2_000).nullable(),
}).strict();

const screen6ReportedStatisticSchema = z.object({
  label: z.string().min(1).max(500),
  estimate: z.number().finite(),
  standardError: z.number().finite().nonnegative().nullable(),
  confidenceInterval: z.object({
    levelPercent: z.number().finite().gt(0).lt(100),
    lower: z.number().finite(),
    upper: z.number().finite(),
  }).strict().nullable(),
  pValue: z.number().finite().min(0).max(1).nullable(),
}).strict();

const screen6DiagnosticResultInputSchema = z.object({
  resultKind: z.enum(["quantitative", "qualitative_or_documentary"]),
  provenance: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("user_reported"),
      sourceDescription: z.string().min(1).max(2_000),
    }).strict(),
    z.object({
      kind: z.literal("imported_validated_artifact"),
      artifact: z.object({
        schemaVersion: z.literal("screen-06-diagnostic-import-artifact-v1"),
        artifactId: id,
        artifactName: z.string().min(1).max(500),
        producer: z.string().min(1).max(500),
        methodName: z.string().min(1).max(500),
        methodVersion: z.string().min(1).max(200),
        generatedAt: z.string().datetime({ offset: false }),
        payloadFingerprint: fingerprint,
      }).strict(),
    }).strict(),
    z.object({
      kind: z.literal("reviewed_local_routine"),
      routineId: id,
      routineVersion: z.string().min(1).max(200),
      executionId: id,
    }).strict(),
  ]),
  summary: z.string().min(1).max(4_000),
  reportedStatistics: z.array(screen6ReportedStatisticSchema).max(32),
  covariance: z.object({
    status: z.enum(["supplied", "not_supplied", "not_applicable"]),
    dimension: z.number().int().min(1).max(20).nullable(),
    values: z.array(z.number().finite()).max(400),
  }).strict(),
  uncertaintyContext: screen6ResultConsiderationSchema,
  specificationContext: z.string().min(1).max(4_000),
  power: screen6ResultConsiderationSchema,
  multipleTesting: screen6ResultConsiderationSchema,
  sampleComposition: screen6ResultConsiderationSchema,
  precision: screen6ResultConsiderationSchema,
  postInspectionChange: z.object({
    status: z.enum(["reported", "none_reported", "not_assessed"]),
    description: z.string().min(1).max(2_000).nullable(),
  }).strict(),
}).strict();

const screen6ClaimBoundaryInputSchema = z.object({
  intendedClaimLevel: z.enum(SCREEN6_CLAIM_LEVELS),
  targetDescription: z.string().min(1).max(2_000),
}).strict();

const scholarlyDocumentInspectionInputSchema = z.object({
  targetId: id,
  exactDocumentUrl: z.string().url().max(2_048).nullable(),
  accessBasis: z.enum([
    "not_confirmed",
    "open_access",
    "researcher_authorized_access",
  ]),
  inspectionMode: z.enum(["partial_text", "abstract_only"]),
  exactPassage: z.string().min(1).max(4_000).nullable(),
  passagePurpose: z.enum([
    "theoretical_proposition",
    "empirical_result_or_qualification",
    "empirical_setting_or_measure",
    "boundary_condition",
    "contrary_evidence",
    "other",
  ]),
  qualification: z.string().min(1).max(1_400).nullable(),
}).strict();

const scholarlyClaimFieldsSchema = z.object({
  theoreticalProposition: z.string().min(1).max(4_000).nullable(),
  empiricalSetting: z.string().min(1).max(2_000).nullable(),
  levelOfAnalysis: z.string().min(1).max(1_000).nullable(),
  measuredVariables: z.array(z.string().min(1).max(500)).max(24),
  relevantResultOrQualification: z.string().min(1).max(4_000).nullable(),
  contextualFit: z.object({
    assessment: z.enum([
      "focal_setting",
      "adjacent_setting",
      "different_setting",
      "theory_only",
      "uncertain",
    ]),
    rationale: z.string().min(1).max(2_000),
  }).strict(),
  evidenceLevel: z.enum([
    "established_theoretical_argument",
    "empirical_evidence_different_setting",
    "empirical_evidence_focal_setting",
    "agency_or_stakeholder_expectation",
  ]),
}).strict();

const scholarlyClaimReviewDecisionSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("accepted") }).strict(),
  z.object({ mode: z.literal("rejected") }).strict(),
  z.object({ mode: z.literal("deferred") }).strict(),
  z.object({
    mode: z.literal("corrected"),
    correction: scholarlyClaimFieldsSchema,
  }).strict(),
]);

const coEventOccurrenceCorrectionSchema = z.object({
  title: z.string().min(1).max(1_000).nullable(),
  typedDates: z.array(z.object({
    kind: z.enum(["event", "publication", "effective", "incident_start"]),
    value: z.string().regex(/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/u),
  }).strict()).max(12),
  affectedActivityOrPopulationLabels:
    z.array(z.string().min(1).max(500)).max(24),
  geographyLabels: z.array(z.string().min(1).max(500)).max(24),
}).strict();

const coEventOccurrenceReviewDecisionSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("retained") }).strict(),
  z.object({ mode: z.literal("rejected") }).strict(),
  z.object({ mode: z.literal("deferred") }).strict(),
  z.object({
    mode: z.literal("corrected"),
    correction: coEventOccurrenceCorrectionSchema,
  }).strict(),
]);

const coEventDuplicateReviewDecisionSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("same_event_representation"),
    canonicalCandidateId: id,
  }).strict(),
  z.object({ mode: z.literal("distinct_stage") }).strict(),
  z.object({ mode: z.literal("different_event") }).strict(),
  z.object({ mode: z.literal("deferred") }).strict(),
]);

const coEventRelationReviewDecisionSchema = z.object({
  mode: z.enum(["retained", "rejected", "deferred"]),
  category: z.enum([
    "independent_concurrent_event",
    "same_policy_package",
    "downstream_response",
    "spillover_or_comparison_contamination",
    "measurement_or_sample_change",
    "temporal_coincidence_no_established_relevance",
    "unresolved_relationship",
  ]),
  priority: z.enum(["high", "medium", "low", "unresolved"]),
  affectedGroupRoles: z.array(z.enum([
    "treatment",
    "comparison",
    "both",
    "unknown",
  ])).min(1).max(4),
  plausibleOutcomePathway: z.string().min(1).max(4_000),
  differentialRelevance: z.string().min(1).max(4_000),
  assumptions: z.array(z.string().min(1).max(1_000)).max(16),
  unresolvedQuestions: z.array(z.string().min(1).max(1_000)).max(16),
  proposedResponses: z.array(z.string().min(1).max(1_000)).max(16),
}).strict();

const studySchema = z.object({
  population: nullableText,
  analysisUnit: nullableText,
  geography: z.array(z.string().min(1).max(300)).max(20),
  industry: z.array(z.string().min(1).max(300)).max(20),
  period: z.object({
    start: z.string().max(40).nullable(),
    end: z.string().max(40).nullable(),
  }).strict(),
  outcome: nullableText,
  outcomeMeasure: nullableText.optional(),
  intendedConstruct: nullableText,
  policySideConcept: nullableText.optional(),
  initialExplanation: nullableText,
  proposedTreatment: nullableText,
  proposedComparison: nullableText,
  resultsPreviouslyInspected: z.enum(["yes", "no", "not_disclosed"]),
}).strict();

const proposedTreatmentTimingSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("year"),
    year: z.number().int().min(1800).max(2200),
    milestoneReference: z.object({
      claimId: id,
      label: z.string().min(1).max(500),
      sourceDateStart: z.string().max(40).nullable(),
      sourceDatePrecision: z.enum([
        "day", "month", "year", "interval", "unknown",
      ]),
    }).strict().nullable(),
  }).strict(),
  z.object({
    mode: z.literal("undecided"),
    year: z.null(),
    milestoneReference: z.null(),
  }).strict(),
  z.object({
    mode: z.literal("varies_by_group"),
    year: z.null(),
    milestoneReference: z.null(),
  }).strict(),
]);

const studyDesignClarificationsSchema = z.object({
  adoptionPattern: z.enum(["unknown", "common", "staggered"]),
  treatmentProcess: z.enum([
    "unknown", "absorbing", "reversible", "continuous_dose",
  ]),
  dataStructure: z.enum(["unknown", "panel", "repeated_cross_sections"]),
  effectInterest: z.enum(["undecided", "overall", "dynamic", "subgroup"]),
  assignmentUnit: nullableText,
  reportedPolicyAssignments: z.number().int().min(1).max(1_000_000).nullable(),
  comparisonSupport: z.enum([
    "unknown", "available", "unavailable_after_adoption",
  ]),
  moderator: nullableText,
  moderatorTime: z.enum(["unknown", "baseline", "post_treatment"]),
  rd: z.object({
    runningVariable: z.string().max(1_000),
    cutoff: z.string().max(500),
    operator: z.enum(["<", "<=", ">", ">="]),
    assignmentRule: z.string().max(4_000),
    treatmentTarget: z.enum(["eligibility", "receipt"]),
    assignmentRelation: z.enum(["unknown", "sharp", "fuzzy"]),
    verification: z.enum(["researcher_reported", "policy_documented"]),
    otherConditions: nullableText,
    bindingStatus: z.enum(["unknown", "binding", "nonbinding"]),
    probabilityJump: z.enum(["not_reported", "researcher_reported"]),
  }).strict().nullable(),
}).strict();

const authenticationSchema = z.object({
  runId,
  accessToken,
}).strict();

const retirementWireSchema = z.object({
  schemaVersion: z.literal("shockaudit-six-screen-retirement-v1"),
  runId,
  retired: z.literal(true),
  outcomeValuesInspected: z.literal(false),
}).strict();

const createSchema = z.object({
  operationId: id,
  shockInput: boundedText.min(1),
  study: studySchema,
  officialSourceLocators: z.array(z.string().url().max(2_000)).max(8).optional(),
  officialIdentifier: optionalNullableText,
  requestedJurisdiction: optionalNullableText,
  approximateYear: optionalNullableText,
  intendedEpisode: optionalNullableText,
}).strict();

// Keep the MCP catalog comfortably below the host's 64 KiB discovery ceiling.
// Calls are still validated against the complete schemas below before they
// reach the runtime; the wire schemas advertise only the stable envelope.
const createWireSchema = z.object({
  operationId: id,
  shockInput: boundedText.min(1),
  study: z.unknown(),
  officialSourceLocators: z.array(z.string()).optional(),
  officialIdentifier: optionalNullableText,
  requestedJurisdiction: optionalNullableText,
  approximateYear: optionalNullableText,
  intendedEpisode: optionalNullableText,
}).strict();

const baseMutation = {
  expectedRevision: z.number().int().nonnegative(),
  operationId: id,
};

const screen02ComplementaryEvidenceLeadSchema = z.object({
  url: z.string().url().max(2_000).refine(
    (value) => value.startsWith("https://"),
    "Supporting evidence pages must use HTTPS.",
  ),
  sourceType: z.enum([
    "official_explanation",
    "implementation_record",
    "specialist_analysis",
  ]),
  reasonForRetrieval: z.string().min(1).max(1_000),
}).strict();

const mutationSchema = z.discriminatedUnion("action", [
  z.object({
    ...baseMutation,
    action: z.literal("update_study"),
    study: studySchema,
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("update_shock"),
    shockInput: boundedText.min(1),
    officialIdentifier: optionalNullableText,
    requestedJurisdiction: optionalNullableText,
    approximateYear: optionalNullableText,
    intendedEpisode: optionalNullableText,
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("resolve_shock"),
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("display_identity"),
    candidateId: id,
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("defer_identity"),
    candidateId: id,
    decision: z.enum(["different_version", "rejected"]),
    note: z.string().max(1_000).nullable().optional(),
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("add_source"),
    sourceUrl: z.string().url().max(2_000),
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("confirm_shock"),
    candidateId: id,
    displayedIdentityFingerprint: z.string().regex(/^fnv1a64:[0-9a-f]{16}$/u),
    sourceSnapshotId: id,
    sourceSnapshotFingerprint: z.string().regex(/^fnv1a64:[0-9a-f]{16}$/u),
    originalRequestFingerprint: z.string().regex(/^fnv1a64:[0-9a-f]{16}$/u),
    currentRequestFingerprint: z.string().regex(/^fnv1a64:[0-9a-f]{16}$/u),
    identityRevision: z.number().int().nonnegative(),
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("open_screen_2"),
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("open_screen_3"),
    study: studySchema,
    proposedTiming: proposedTreatmentTimingSchema,
    clarifications: studyDesignClarificationsSchema.optional(),
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("rebuild_screen3_guidance"),
    sourceOperationId: id,
    sourceInputFingerprint: fingerprint,
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("refine_study_design_advice"),
    clarifications: studyDesignClarificationsSchema,
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("personalize_screen3_advice"),
    expectedAdviceFingerprint: fingerprint,
    retryUnknownAttemptId: id.optional(),
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("renew_model_allowance"),
    acknowledgedByOwner: z.literal(true),
    allowanceWindow: z.enum(["standard", "extended", "reviewer"]).optional(),
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("decide_study_design_advice"),
    adviceId: id,
    expectedAdviceFingerprint: fingerprint,
    decision: z.discriminatedUnion("mode", [
      z.object({ mode: z.literal("selected"), optionId: id }).strict(),
      z.object({ mode: z.literal("no_selection") }).strict(),
    ]),
    rationale,
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("open_screen_4"),
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("refresh_study_first_events"),
    expectedInvestigationFingerprint: fingerprint,
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("analyze_study_first_events"),
    expectedInvestigationFingerprint: fingerprint,
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("open_screen_5"),
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("compare_study_first_mechanisms"),
    theoreticalPerspective: z.string().max(1_000).nullable(),
    proposedMechanism: z.string().min(1).max(4_000),
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("ensure_study_first_mechanism_job"),
    expectedInputFingerprint: fingerprint,
    expectedRunFingerprint: fingerprint,
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("continue_study_first_mechanism_evidence"),
    planningTaskId: id,
    planningResultId: id,
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("authorize_study_first_mechanism_job"),
    expectedExecutionFingerprint: fingerprint,
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("advance_study_first_mechanism_job"),
    retry: z.boolean().default(false),
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("open_screen_6"),
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("personalize_screen6_plan"),
    expectedPlanFingerprint: fingerprint,
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("initialize_screen6_uncertainty_profile"),
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("save_screen6_diagnostic_plan"),
    diagnosticInput: screen6DiagnosticInputSchema,
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("record_screen6_diagnostic_result"),
    cardId: id,
    expectedPlanFingerprint: fingerprint,
    expectedCardFingerprint: fingerprint,
    resultInput: screen6DiagnosticResultInputSchema,
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("review_screen6_diagnostic_result"),
    resultId: id,
    expectedResultFingerprint: fingerprint,
    decision: z.enum([
      "concern_reduced",
      "inconclusive",
      "revision_needed",
    ]),
    rationale: z.string().min(1).max(4_000),
    followUpActions: z.array(z.string().min(1).max(1_000)).max(16),
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("save_screen6_conditional_claim_boundary"),
    expectedPlanFingerprint: fingerprint,
    claimInput: screen6ClaimBoundaryInputSchema,
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("record_screen6_research_planning_disposition"),
    expectedBoundaryFingerprint: fingerprint,
    decision: z.enum(SCREEN6_RESEARCH_DISPOSITIONS),
    rationale: z.string().min(1).max(4_000),
    specifiedRevisions: z.array(z.string().min(1).max(1_000)).max(20),
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("create_screen6_research_export"),
    expectedDispositionFingerprint: fingerprint,
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("research_policy"),
    supportingEvidenceLeads:
      z.array(screen02ComplementaryEvidenceLeadSchema).max(6).optional(),
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("continue_policy_research"),
    supportingEvidenceLeads:
      z.array(screen02ComplementaryEvidenceLeadSchema).max(6).optional(),
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("begin_policy_event_card_review"),
    revisionReason: rationale.nullable().optional(),
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("review_policy_event_card_claim"),
    reviewId: id,
    expectedReviewRevision: z.number().int().nonnegative(),
    expectedReviewFingerprint: fingerprint,
    claimId: id,
    decision: z.enum([
      "accepted",
      "provisional",
      "rejected",
      "needs_more_evidence",
      "corrected",
    ]),
    correctedStatement: z.string().min(1).max(4_000).nullable().optional(),
    rationale,
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("decide_policy_treatment_clock"),
    reviewId: id,
    expectedReviewRevision: z.number().int().nonnegative(),
    expectedReviewFingerprint: fingerprint,
    decision: z.discriminatedUnion("mode", [
      z.object({
        mode: z.literal("selected"),
        candidateId: id,
      }).strict(),
      z.object({ mode: z.literal("no_selection") }).strict(),
    ]),
    rationale,
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("lock_policy_event_card"),
    reviewId: id,
    expectedReviewRevision: z.number().int().nonnegative(),
    expectedReviewFingerprint: fingerprint,
    rationale,
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("build_causal_comparison"),
    comparisonInput: causalComparisonInputSchema,
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("decide_causal_comparison"),
    designSetSnapshotId: id,
    expectedDesignSetFingerprint: fingerprint,
    decision: z.discriminatedUnion("mode", [
      z.object({
        mode: z.literal("selected"),
        optionId: id,
      }).strict(),
      z.object({ mode: z.literal("no_selection") }).strict(),
    ]),
    rationale,
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("save_coevent_search_matrix"),
    scopeInput: coEventScopeInputSchema,
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("save_mechanism_literature_plan"),
    planInput: mechanismLiteratureInputSchema,
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("continue_mechanism_literature_search"),
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("inspect_scholarly_document"),
    inspectionInput: scholarlyDocumentInspectionInputSchema,
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("extract_scholarly_claim"),
    passageId: id,
    expectedPassageFingerprint: fingerprint,
    fields: scholarlyClaimFieldsSchema,
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("review_scholarly_claim"),
    extractionId: id,
    expectedExtractionFingerprint: fingerprint,
    decision: scholarlyClaimReviewDecisionSchema,
    rationale,
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("prepare_mechanism_synthesis_input"),
    expectedClaimPacketFingerprint: fingerprint,
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("save_mechanism_review"),
    expectedSynthesisInputFingerprint: fingerprint,
    draft: mechanismReviewDraftSchema,
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("continue_coevent_search"),
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("review_coevent_occurrence"),
    candidateId: id,
    expectedCandidateFingerprint: fingerprint,
    decision: coEventOccurrenceReviewDecisionSchema,
    rationale,
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("review_coevent_relation"),
    candidateId: id,
    expectedCandidateFingerprint: fingerprint,
    expectedOccurrenceReviewId: id,
    expectedOccurrenceReviewFingerprint: fingerprint,
    decision: coEventRelationReviewDecisionSchema,
    rationale,
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("review_coevent_duplicate_pair"),
    leftCandidateId: id,
    leftCandidateFingerprint: fingerprint,
    rightCandidateId: id,
    rightCandidateFingerprint: fingerprint,
    decision: coEventDuplicateReviewDecisionSchema,
    rationale,
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("route_coevent_policy_stage_to_screen_2"),
    candidateId: id,
    expectedCandidateFingerprint: fingerprint,
    expectedOccurrenceReviewId: id,
    expectedOccurrenceReviewFingerprint: fingerprint,
    stageKind: z.enum([
      "implementation_delay",
      "litigation_or_court_order",
      "amendment",
      "suspension",
      "repeal",
      "enforcement",
      "other",
    ]),
    rationale,
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("acquire_policy_lifecycle_stage_document"),
    handoffId: id,
    expectedHandoffFingerprint: fingerprint,
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("review_policy_lifecycle_stage_document"),
    handoffId: id,
    expectedHandoffFingerprint: fingerprint,
    acquisitionId: id,
    expectedAcquisitionFingerprint: fingerprint,
    decision: z.enum([
      "accepted_for_event_card_review",
      "rejected_as_focal_policy_stage",
      "deferred",
    ]),
    rationale,
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("propose_policy_lifecycle_stage_revision"),
    handoffId: id,
    expectedHandoffFingerprint: fingerprint,
    dispositionId: id,
    expectedDispositionFingerprint: fingerprint,
    chronologyStage: z.enum([
      "legislative_initiation",
      "announcement",
      "adoption",
      "publication",
      "scheduled_effect",
      "legal_effect",
      "compliance",
      "compliance_filing",
      "implementation",
      "enforcement",
      "amendment",
      "injunction",
      "invalidation",
      "withdrawal",
      "suspension",
      "repeal",
      "supersession",
    ]),
    sourceDateId: id.nullable(),
    rationale,
  }).strict(),
  z.object({
    ...baseMutation,
    action: z.literal("review_policy_lifecycle_stage_revision"),
    proposalId: id,
    expectedProposalFingerprint: fingerprint,
    decision: z.enum([
      "accepted_for_event_card_revision",
      "rejected",
      "deferred",
    ]),
    rationale,
  }).strict(),
]);

const mutationWireSchema = authenticationSchema.extend({
  mutation: z.unknown(),
}).strict();

/*
 * The SDK normally turns input-schema failures into an unstructured text
 * error before invoking the registered callback.  Keep the exact strict JSON
 * Schema advertised to clients, but defer its runtime validation to the first
 * line of our callback so every rejection uses the bounded workflow-problem
 * envelope.  Invalid input is still rejected before any runtime method runs.
 */
type StandardJsonSchemaHooks = {
  input: (...args: unknown[]) => Record<string, unknown>;
  output: (...args: unknown[]) => Record<string, unknown>;
};
const mutationWireStandard = (mutationWireSchema as unknown as {
  "~standard": { jsonSchema: StandardJsonSchemaHooks };
})["~standard"];
const mutationMcpInputSchema = {
  "~standard": {
    version: 1 as const,
    vendor: "shockaudit-callback-validated",
    jsonSchema: mutationWireStandard.jsonSchema,
    validate: (value: unknown) => ({ value }),
  },
} as unknown as typeof mutationWireSchema;

const publicProjectionText = z.string().max(64_000);
const publicProjectionShortText = z.string().max(4_000);
const publicProjectionCount = z.number().int().nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
const publicProjectionFailureStageSchema = z.enum([
  "local_configuration", "admission", "network", "response_headers",
  "response_body", "model_output", "persistence", "projection",
]);
const publicProjectionDispatchStateSchema = z.enum([
  "not_dispatched", "dispatched", "unknown",
]);

const modelUsageProjectionSchema = z.object({
  // Legacy contextualization receipts exposed only totalTokens. Current
  // receipts include the complete, still-bounded accounting tuple.
  promptTokens: publicProjectionCount.optional(),
  completionTokens: publicProjectionCount.optional(),
  totalTokens: publicProjectionCount,
  reasoningTokens: publicProjectionCount.nullable().optional(),
  cachedPromptTokens: publicProjectionCount.nullable().optional(),
}).strict();

const screen3StructuredCritiqueProjectionSchema = z.object({
  schema_version: z.literal("screen-03-structured-design-assessment-v4"),
  concerns: z.array(z.object({
    issue_id: z.enum([
      "treatment_year_fit", "pre_post_support", "anticipation",
      "as_if_assignment", "interference_sutva", "composition_selection",
    ]),
    specific_heading: z.enum([
      "Treatment-year fit", "Pre/post time support",
      "Anticipation and advance notice", "As-if random assignment",
      "Interference and SUTVA", "Composition, attrition and selection",
    ]),
    status_label: z.string().min(1).max(90),
    relevant_fact_or_proposal: z.string().min(1).max(650),
    why_it_matters: z.string().min(1).max(750),
    unresolved_question: z.string().min(1).max(450),
    next_check: z.string().min(1).max(600),
    check_limit: z.string().min(1).max(500),
    priority: z.enum(["high", "medium", "lower"]),
    priority_reason: z.string().min(1).max(350),
    documentary_claim_ids: z.array(z.string().min(1).max(160)).max(8),
    researcher_input_fields: z.array(z.string().min(1).max(80)).max(8),
  }).strict()).length(6),
  synthesis_limit: z.string().min(1).max(900),
}).strict();

const screen3PriorSpecificCritiqueProjectionSchema = z.object({
  schema_version: z.literal("screen-03-contextual-critique-v3"),
  concerns: z.array(z.object({
    issue_id: z.string().regex(/^issue-[1-5]$/u),
    category_id: z.enum([
      "episode_timing", "historical_coverage", "treatment_definition",
      "construct_and_channels", "comparison_and_spillovers",
      "competing_changes", "outcome_and_measurement",
      "assignment_and_inference", "method_specific_assumption",
      "evidence_version_or_conflict",
    ]),
    specific_heading: z.string().min(1).max(140),
    relevant_fact_or_proposal: z.string().min(1).max(650),
    why_it_matters: z.string().min(1).max(750),
    unresolved_question: z.string().min(1).max(450),
    next_check: z.string().min(1).max(600),
    check_limit: z.string().min(1).max(500),
    priority: z.enum(["high", "medium", "lower"]),
    priority_reason: z.string().min(1).max(350),
    documentary_claim_ids: z.array(z.string().min(1).max(160)).max(8),
    researcher_input_fields: z.array(z.string().min(1).max(80)).max(8),
  }).strict()).max(5),
  synthesis_limit: z.string().min(1).max(900),
}).strict();

const screen3LegacyCritiqueProjectionSchema = z.object({
  concerns: z.array(z.object({
    rule_id: id,
    study_specific_reason: z.string().min(1).max(650),
    known_from_sources: z.string().min(1).max(650),
    unresolved_question: z.string().min(1).max(650),
    next_check: z.string().min(1).max(650),
    documentary_claim_ids:
      z.array(z.string().min(1).max(160)).max(8).optional(),
    researcher_input_fields:
      z.array(z.string().min(1).max(80)).max(8).optional(),
  }).strict()).min(1).max(5),
  synthesis_limit: z.string().min(1).max(900),
}).strict();

const screen3CritiqueProjectionSchema = z.union([
  screen3StructuredCritiqueProjectionSchema,
  screen3PriorSpecificCritiqueProjectionSchema,
  screen3LegacyCritiqueProjectionSchema,
]);

const screen6DimensionIdProjectionSchema = z.enum([
  "institutional_evidence", "assignment_exposure", "timing",
  "counterfactual_comparison", "competing_events", "interference",
  "treatment_versions", "outcome_measurement_sample_composition",
  "statistical_inference", "mechanism_attribution",
]);

const screen6ContextualizationProjectionSchema = z.object({
  schema_version: z.literal("screen6_challenge_plan_v2"),
  dimension_summaries: z.array(z.object({
    dimension_id: screen6DimensionIdProjectionSchema,
    title: z.string().min(1).max(120),
    known_basis: z.string().min(1).max(500),
    specific_concern: z.string().min(1).max(400),
    next_check: z.string().min(1).max(400),
    material_limit: z.string().min(1).max(400),
    source_refs: z.array(z.string().min(1).max(512)).max(6),
    input_refs: z.array(z.string().min(1).max(80)).max(6),
  }).strict()).length(10),
  priorities: z.array(z.object({
    diagnostic_id: id,
    priority_reason: z.string().min(1).max(800),
    study_specific_question: z.string().min(1).max(800),
    contextual_procedure: z.string().min(1).max(800),
    data_needs: z.string().min(1).max(800),
    concerning_pattern: z.string().min(1).max(800),
    alternative_explanation: z.string().min(1).max(800),
    reassurance_limit: z.string().min(1).max(800),
    next_action: z.string().min(1).max(800),
  }).strict()).min(3).max(7),
  claim_boundary: z.object({
    planned_target: z.string().min(1).max(1_200),
    required_assumptions: z.string().min(1).max(1_200),
    stronger_claims_not_established: z.string().min(1).max(1_200),
    next_action: z.string().min(1).max(1_200),
  }).strict(),
  remaining_gaps: z.array(z.string().min(1).max(500)).max(20),
}).strict();

const screen6LegacyContextualizationProjectionSchema = z.object({
  remaining_gaps: z.array(z.string().min(1).max(500)).max(20),
}).strict();

const screen3ContextualizationProjectionSchema = z.object({
  id,
  inputFingerprint: fingerprint.optional(),
  status: z.enum(["pending", "receipt_saved", "validation_failed",
    "completed", "failed", "outcome_unknown"]),
  retryEligibility: z.enum(["new_request", "local_revalidation", "observe",
    "none"]).optional(),
  dispatchState: publicProjectionDispatchStateSchema.optional(),
  failureCode:
    z.string().regex(/^[a-z][a-z0-9_]{0,79}$/u).nullable().optional(),
  failureStage: publicProjectionFailureStageSchema.nullable().optional(),
  supplement: screen3CritiqueProjectionSchema.nullable(),
  error: z.string().max(400).nullable().optional(),
  providerResponseId: z.string().max(512).nullable().optional(),
  usage: modelUsageProjectionSchema.nullable(),
}).strict();

const screen6PersonalizationProjectionSchema = z.object({
  id,
  inputFingerprint: fingerprint.optional(),
  status: z.enum(["pending", "receipt_saved", "validation_failed",
    "completed", "failed", "outcome_unknown"]),
  retryEligibility: z.enum(["new_request", "local_revalidation", "observe",
    "none"]).optional(),
  dispatchState: publicProjectionDispatchStateSchema.optional(),
  failureCode:
    z.string().regex(/^[a-z][a-z0-9_]{0,79}$/u).nullable().optional(),
  failureStage: publicProjectionFailureStageSchema.nullable().optional(),
  supplement: z.union([
    screen6ContextualizationProjectionSchema,
    screen6LegacyContextualizationProjectionSchema,
  ]).nullable(),
  error: z.string().max(400).nullable().optional(),
  providerResponseId: z.string().max(512).nullable().optional(),
  usage: modelUsageProjectionSchema.nullable(),
}).strict();

const screen5ExecutionReadinessProjectionSchema = z.object({
  schemaVersion: z.literal("screen-05-execution-readiness-v2"),
  selectedBackend: z.enum(["openai", "off", "unresolved"]),
  provider: z.literal("openai"),
  model: z.literal("gpt-6-luna"),
  route: z.enum(["direct", "direct_setup_required"]),
  configuration: z.enum(["ready", "blocked", "off", "unresolved"]),
  missingSettings:
    z.array(z.enum(SCREEN5_EXECUTION_MISSING_SETTINGS)).max(4),
  keyPresent: z.boolean(),
  credentialStatus: z.enum([
    "not_tested", "last_success", "last_401", "other_failure",
  ]),
  ledgerState: z.enum([
    "valid", "uninitialized", "missing_binding", "missing_import",
    "invalid", "exhausted", "unresolved",
  ]),
  allowance: z.object({
    policyMode: z.enum(["bounded", "reviewer", "unlimited"]).optional(),
    accountingVersion: z.literal("persistent-v3").optional(),
    lastRenewalId: fingerprint.optional(),
    lastRenewalWindow: z.enum(["standard", "extended", "reviewer"]).optional(),
    maximumAttempts: publicProjectionCount,
    maximumTokens: publicProjectionCount,
    conservativePriorAttempts: publicProjectionCount,
    conservativePriorTokens: publicProjectionCount,
    localAttemptsReserved: publicProjectionCount,
    localObservedTokens: publicProjectionCount,
    localHeldTokens: publicProjectionCount,
    remainingAttempts: publicProjectionCount,
    remainingTokens: publicProjectionCount,
  }).strict().nullable(),
  authorization: z.enum([
    "authorized", "required", "job_mismatch", "not_applicable",
    "unresolved",
  ]),
  authorizedStages: z.array(z.enum(["planning", "assessment"])).max(2),
  activeOrigin: z.enum([
    "openai", "groq", "chatgpt_host", "test_probe_boundary", "none",
  ]),
  activeExecutionId: id.nullable(),
  migration: z.enum([
    "eligible", "prepared", "not_needed", "blocked", "unresolved",
  ]),
  canEnsure: z.boolean(),
  canAdvanceWithoutInference: z.boolean(),
  canDispatch: z.boolean(),
  serverObservedAt: z.string().max(64).nullable(),
  nextAction: z.enum([
    "configure_direct_mode", "provide_server_key", "configure_pilot_ledger",
    "initialize_pilot_ledger", "request_execution_authorization",
    "recheck_saved_response", "restore_saved_mechanisms",
    "restore_saved_comparison", "read_saved_diagnostic",
    "ensure_direct_job", "resume_direct_job", "read_completed_result",
    "none",
  ]),
}).strict();

const studyFirstEventBranchProjectionSchema = z.enum([
  "overlapping_policy", "sector_market_or_financing",
  "disaster_or_disruption", "comparison_spillover",
  "measurement_or_sample_shift", "focal_policy_lifecycle_or_litigation",
]);

const coEventProviderProjectionSchema = z.enum([
  "federal_register", "reviewed_official_documents", "govinfo", "ecfr",
  "regulations_gov", "congress_gov", "legiscan", "openstates", "eu_cellar",
  "uk_legislation", "tavily", "brave", "crossref", "openfema", "usgs",
  "gdacs",
]);

const occurrenceWindowProjectionSchema = z.object({
  start: z.string().max(40),
  end: z.string().max(40),
}).strict();

const coEventOccurrenceProjectionSchema = z.object({
  schemaVersion: z.literal("screen-04-coevent-candidate-occurrence-v1"),
  id,
  providerId: coEventProviderProjectionSchema,
  sourceNativeId: publicProjectionShortText,
  title: publicProjectionShortText,
  description: publicProjectionText,
  eventFamily: z.string().max(500),
  formalIdentifiers: z.array(z.string().max(500)).max(24),
  typedDates: z.array(z.object({
    kind: z.enum(["event", "publication", "effective", "incident_start"]),
    value: z.string().max(40),
    precision: z.enum(["day", "month", "year"]),
    sourceId: z.string().min(1).max(500),
  }).strict()).max(24),
  affectedActivityOrPopulation: z.object({
    status: z.literal("not_established"),
    labels: z.array(z.never()).length(0),
  }).strict(),
  geography: z.object({
    status: z.enum(["provider_reported", "not_established"]),
    labels: z.array(z.string().max(500)).max(24),
  }).strict(),
  evidence: z.array(z.object({
    sourceId: z.string().min(1).max(500),
    title: publicProjectionShortText,
    locator: z.string().max(2_048),
    publisher: z.string().max(500),
    publishedDate: z.string().max(40).nullable(),
    authorityTier: z.union([
      z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5),
      z.literal(6),
    ]),
    retrievedAt: z.string().max(64),
    evidenceRole: z.literal("occurrence_metadata"),
    factText: publicProjectionShortText.nullable().optional(),
  }).strict()).max(24),
  occurrenceStatus: z.literal("source_metadata_documented"),
  relationToComparison: z.object({
    status: z.literal("not_assessed"),
    reason: z.literal("genuine_intelligence_path_unverified"),
  }).strict(),
  reusableAcrossDesignRevisions: z.literal(true),
  version: z.literal(1),
  recordedAt: z.string().max(64),
  claimBoundary: publicProjectionText,
  candidateFingerprint: fingerprint,
}).strict();

const studyFirstEventContextProjectionSchema = z.object({
  schemaVersion: z.enum([
    "screen-04-study-first-context-v1", "screen-04-study-first-context-v2",
    "screen-04-study-first-context-v3", "screen-04-study-first-context-v4",
  ]),
  id,
  runId,
  authorization: z.object({
    identityRevision: publicProjectionCount,
    selectionGeneration: publicProjectionCount,
  }).strict(),
  policy: z.object({
    id,
    officialTitle: publicProjectionShortText,
    aliases: z.array(z.string().max(500)).max(64),
    issuer: z.string().max(1_000),
    issuingJurisdiction: z.string().max(1_000),
    episode: publicProjectionShortText,
    versionScope: publicProjectionShortText,
    formalIdentifiers: z.array(z.string().max(500)).max(64),
    identityFingerprint: fingerprint,
  }).strict(),
  study: z.object({
    revision: publicProjectionCount,
    fingerprint,
    population: publicProjectionShortText,
    analysisUnit: publicProjectionShortText.nullable(),
    geography: z.array(z.string().max(300)).max(20),
    industry: z.array(z.string().max(300)).max(20),
    period: occurrenceWindowProjectionSchema,
    outcome: publicProjectionShortText,
    outcomeMeasure: publicProjectionShortText.nullable(),
    intendedConstruct: publicProjectionShortText.nullable(),
    policySideConcept: publicProjectionShortText.nullable(),
    initialExplanation: publicProjectionShortText.nullable(),
    proposedTreatment: publicProjectionShortText.nullable(),
    proposedComparison: publicProjectionShortText.nullable(),
    resultsPreviouslyInspected: z.enum(["yes", "no", "not_disclosed"]),
  }).strict(),
  timing: z.object({
    id,
    fingerprint,
    mode: z.enum(["year", "undecided", "varies_by_group"]),
    year: z.number().int().min(1800).max(2200).nullable(),
    precision: z.enum(["year", "unknown", "varies_by_group"]),
  }).strict(),
  evidence: z.object({
    status: z.enum([
      "available", "partial", "conflicting", "unavailable", "not_researched",
    ]),
    snapshotId: id.nullable(),
    snapshotFingerprint: fingerprint.nullable(),
    limitation: publicProjectionShortText.nullable(),
  }).strict(),
  advice: z.object({
    adviceId: id,
    adviceFingerprint: fingerprint,
    methodLibraryVersion: z.string().max(200),
  }).strict(),
  methodSelection: z.object({
    selectionId: id,
    selectionFingerprint: fingerprint,
    decision: z.union([
      z.object({ mode: z.literal("selected"), optionId: id }).strict(),
      z.object({ mode: z.literal("no_selection") }).strict(),
    ]),
    adviceId: id,
    adviceFingerprint: fingerprint,
    methodLibraryVersion: z.string().max(200),
  }).strict().nullable(),
  groupsPresent: z.boolean(),
  effectiveScope: z.object({
    occurrenceStart: z.string().max(40),
    occurrenceEnd: z.string().max(40),
    proposedGeography: z.array(z.string().max(300)).max(20),
    legalCoverageStatus:
      z.literal("not_inferred_from_proposed_geography"),
    derivedQueryAnnotations: z.array(z.string().max(1_000)).max(32),
  }).strict(),
  searchConcepts: z.object({
    shockConstruct: publicProjectionShortText.nullable(),
    outcome: publicProjectionShortText,
    outcomeMeasure: publicProjectionShortText.nullable(),
    industries: z.array(z.string().max(300)).max(20),
    groupLabels: z.array(z.string().max(500)).max(20),
    year: z.number().int().min(1800).max(2200).nullable(),
    threshold: publicProjectionShortText.nullable(),
    assignmentRule: publicProjectionShortText.nullable(),
  }).strict().optional(),
  createdAt: z.string().max(64),
  contextFingerprint: fingerprint,
}).strict();

const studyFirstEventPlanProjectionSchema = z.object({
  schemaVersion: z.enum([
    "screen-04-study-first-plan-v2", "screen-04-study-first-plan-v3",
  ]),
  id,
  contextId: id,
  contextFingerprint: fingerprint,
  steps: z.array(z.object({
    id,
    branch: studyFirstEventBranchProjectionSchema,
    question: publicProjectionText,
    providerId: coEventProviderProjectionSchema.nullable(),
    queryTerms: z.array(z.string().max(500)).max(32),
    affectedGroupLabels: z.array(z.string().max(500)).max(32),
    occurrenceWindow: occurrenceWindowProjectionSchema,
    plannedLimit: publicProjectionCount,
    initialStatus: z.enum(["pending", "unsupported_route"]),
    statusNote: publicProjectionShortText.nullable(),
  }).strict()).max(32),
  budget: z.object({
    sourceQueryCeiling: publicProjectionCount,
    metadataCandidateCeiling: publicProjectionCount,
    visibleEventCeiling: publicProjectionCount,
    documentFetchCeiling: publicProjectionCount.optional(),
    inspectedCandidateCeiling: publicProjectionCount.optional(),
  }).strict(),
  discoveryVersion: z.enum([
    "screen-04-multisource-discovery-v1",
    "screen-04-multisource-discovery-v2",
    "screen-04-multisource-discovery-v3",
    "screen-04-multisource-discovery-v4",
    "screen-04-multisource-discovery-v6",
  ]).optional(),
  sourceCapabilityVersion: z.string().max(200).optional(),
  queryPlanFingerprint: fingerprint.optional(),
  semanticRoute: z.object({
    status: z.literal("unavailable"),
    reason: z.literal("no_authorized_screen4_semantic_route"),
    fallback: z.literal("conditional_library_only"),
  }).strict(),
  createdAt: z.string().max(64),
  planFingerprint: fingerprint,
}).strict();

const studyFirstEventAttemptProjectionSchema = z.object({
  id,
  stepId: id,
  branch: studyFirstEventBranchProjectionSchema,
  providerId: coEventProviderProjectionSchema.nullable(),
  queryTerms: z.array(z.string().max(500)).max(32),
  occurrenceWindow: occurrenceWindowProjectionSchema,
  startedAt: z.string().max(64),
  completedAt: z.string().max(64),
  requestUrl: z.string().max(2_048).nullable(),
  outcome: z.enum([
    "candidates_found", "no_match", "records_unusable",
    "source_unavailable", "unsupported_route", "outcome_unknown",
  ]),
  recordsReceived: publicProjectionCount,
  recordsAccepted: publicProjectionCount,
  candidateOccurrenceIds: z.array(id).max(100),
  note: publicProjectionText,
  usage: z.object({
    sourceQueries: publicProjectionCount,
    metadataRecords: publicProjectionCount,
    transportHops: publicProjectionCount,
    receivedBytes: publicProjectionCount,
    activeResearchMs: publicProjectionCount,
    documentAttempts: publicProjectionCount.optional(),
  }).strict(),
  attemptFingerprint: fingerprint,
}).strict();

const studyFirstEventAnalysisProjectionSchema = z.object({
  schemaVersion: z.enum([
    "screen-04-study-first-conditional-analysis-v2",
    "screen-04-study-first-conditional-analysis-v3",
    "screen-04-study-first-conditional-analysis-v4",
  ]),
  id,
  eventId: id,
  branchRoles: z.array(studyFirstEventBranchProjectionSchema).max(6),
  interpretationMode: z.enum([
    "bounded_evidence_rules", "host_model_assessment",
  ]),
  relationshipType: z.enum([
    "potential_independent_event", "related_policy_stage",
    "possible_downstream_response", "comparison_exposure_or_spillover",
    "measurement_or_sample_change", "uncertain",
  ]),
  relationshipStatus: z.enum(["hypothetical", "partly_supported"]),
  eligibility: z.object({
    status: z.enum(["qualifying", "background_lead", "excluded"]),
    reason: publicProjectionText,
  }).strict(),
  documentEventDistinction: z.object({
    documentRole: z.enum([
      "official_rule_or_notice", "incident_record",
      "report_or_information_release", "unresolved",
    ]),
    publicationDate: z.string().max(40).nullable(),
    substantiveOccurrenceDate: z.string().max(40).nullable(),
    dateRoleStatus: z.enum([
      "distinct_dates_documented", "separate_roles_same_date",
      "publication_only", "occurrence_only", "unresolved",
    ]),
    explanation: publicProjectionText,
  }).strict(),
  dimensionalFit: z.object({
    populationOrActivity: z.enum([
      "documented", "plausible_with_condition", "unknown", "outside_scope",
    ]),
    analysisLevel: z.enum([
      "documented", "plausible_with_condition", "unknown", "outside_scope",
    ]),
    geography: z.enum([
      "documented", "plausible_with_condition", "unknown", "outside_scope",
    ]),
    industry: z.enum([
      "documented", "plausible_with_condition", "unknown", "outside_scope",
    ]),
    temporalContrast: z.enum([
      "documented", "plausible_with_condition", "unknown", "outside_scope",
    ]),
    outcomeOrMeasure: z.enum([
      "documented", "plausible_with_condition", "unknown", "outside_scope",
    ]),
    groupDifferential: z.enum([
      "documented", "plausible_with_condition", "unknown", "outside_scope",
    ]),
  }).strict(),
  relevanceOrder: z.object({
    priorityBand: z.enum(["high", "medium", "low", "background"]),
    evidenceBasis: z.array(z.string().max(1_000)).max(32),
    stableSortKey: z.string().max(1_000),
  }).strict(),
  relationshipEvidence: z.object({
    status: z.enum(["source_linked", "not_established"]),
    targetInstrument: publicProjectionShortText.nullable(),
    sourceIds: z.array(z.string().max(500)).max(24),
    explanation: publicProjectionText,
  }).strict().optional(),
  affectedActorOrActivity: publicProjectionShortText.optional(),
  materialUncertainty: publicProjectionShortText.optional(),
  whatHappened: publicProjectionText,
  documentedFactRefs: z.array(z.string().max(500)).max(32),
  whyRelevant: publicProjectionText,
  outcomePathway: publicProjectionText,
  comparisonImplication: publicProjectionText,
  temporalInterpretation: publicProjectionText,
  causalChain: z.array(z.object({
    from: publicProjectionShortText,
    to: publicProjectionShortText,
    status: z.enum([
      "source_documented", "analyst_hypothesis", "unresolved",
    ]),
    factRefs: z.array(z.string().max(500)).max(24),
    assumption: publicProjectionShortText.nullable(),
  }).strict()).max(24),
  requiredExposureAssumptions:
    z.array(publicProjectionShortText).max(24),
  directionStatus: z.literal("unknown"),
  uncertainties: z.array(publicProjectionShortText).max(24),
  nextChecks: z.array(publicProjectionShortText).max(24),
  executionProvenance: z.object({
    libraryVersion: z.enum([
      "screen-04-study-first-conditional-analysis-v3",
      "screen-04-study-first-conditional-analysis-v4",
    ]),
    semanticRouteStatus: z.enum([
      "bounded_rules_completed", "host_model_completed",
    ]),
  }).strict(),
  analysisFingerprint: fingerprint,
}).strict();

const studyFirstEventPresentationProjectionSchema = z.object({
  schemaVersion: z.enum([
    "screen-04-study-first-presentation-v2",
    "screen-04-study-first-presentation-v3",
  ]),
  status: z.enum([
    "events_available", "completed_zero_events", "completed_partial",
    "scan_failed",
  ]),
  visibleEventIds: z.array(id).max(10),
  overflowEventIds: z.array(id).max(100),
  coverage: z.object({
    attemptedBranches: z.array(studyFirstEventBranchProjectionSchema).max(32),
    completedBranches: z.array(studyFirstEventBranchProjectionSchema).max(32),
    unsupportedBranches: z.array(studyFirstEventBranchProjectionSchema).max(32),
    failedBranches: z.array(studyFirstEventBranchProjectionSchema).max(32),
    unknownBranches:
      z.array(studyFirstEventBranchProjectionSchema).max(32).optional(),
    sourceRoutesAttempted: publicProjectionCount,
    sourceRoutesSucceeded: publicProjectionCount,
    interpretation: z.enum(["evidence_bounded", "host_model_assisted"]),
    semanticAssessment: z.enum([
      "bounded_rules_completed", "pending_host_assessment",
      "host_model_completed", "unavailable",
    ]),
    phases: z.object({
      retrieval: z.enum(["complete", "partial", "failed"]),
      inspection: z.enum(["complete", "partial", "failed"]),
      screening: z.enum(["complete", "partial", "failed"]),
      synthesis: z.enum(["pending", "available", "unavailable"]),
      validation: z.enum(["pending", "complete", "unavailable"]),
      presentation: z.enum(["complete", "partial", "failed"]),
    }).strict().optional(),
    limitation: publicProjectionText,
  }).strict(),
  completedAt: z.string().max(64),
  presentationFingerprint: fingerprint,
}).strict();

const studyFirstEventInvestigationProjectionSchema = z.object({
  schemaVersion: z.literal("screen-04-study-first-investigation-v1"),
  snapshotId: id,
  ordinal: publicProjectionCount,
  previousSnapshotId: id.nullable(),
  context: studyFirstEventContextProjectionSchema,
  plan: studyFirstEventPlanProjectionSchema,
  status: z.enum([
    "planned", "running", "completed", "completed_partial", "failed",
  ]),
  attempts: z.array(studyFirstEventAttemptProjectionSchema).max(64),
  occurrences: z.array(coEventOccurrenceProjectionSchema).max(100),
  analyses: z.array(studyFirstEventAnalysisProjectionSchema).max(100),
  presentation: studyFirstEventPresentationProjectionSchema.nullable(),
  startedAt: z.string().max(64).nullable(),
  completedAt: z.string().max(64).nullable(),
  investigationFingerprint: fingerprint,
}).strict();

const screen4DiscoveryTaskProjectionSchema = z.object({
  taskId: id,
  state: z.enum([
    "not_started", "preparing", "active", "partial", "complete",
    "complete_zero", "failed", "outcome_unknown", "outdated",
  ]),
  stage: z.enum([
    "preparation", "source_retrieval", "local_processing",
    "artifact_storage", "complete",
  ]),
  nextAction: z.enum(["start", "resume", "observe", "none"]),
  completedStepCount: publicProjectionCount,
  totalStepCount: publicProjectionCount,
  pendingStepCount: publicProjectionCount,
  queryCount: publicProjectionCount,
  documentCount: publicProjectionCount,
  recordsReceived: publicProjectionCount,
  recordsAccepted: publicProjectionCount,
  stopReason: publicProjectionShortText.nullable(),
  continuationMode: z.literal("panel_driven"),
  continuationDisclosure: publicProjectionText,
}).strict();

const screen4InterpretationQueueProjectionSchema = z.object({
  taskFingerprint: fingerprint,
  status: z.enum([
    "ready", "in_progress", "completed", "partial", "validation_failed",
    "failed", "outcome_unknown",
  ]),
  retryEligibility: z.enum([
    "new_request", "local_revalidation", "observe", "none",
  ]),
  results: z.array(z.object({
    eventId: id,
    relationshipType: z.enum([
      "potential_independent_event", "related_policy_stage",
      "possible_downstream_response", "comparison_exposure_or_spillover",
      "measurement_or_sample_change", "uncertain",
    ]),
    documentedChange: publicProjectionText,
    outcomePathway: publicProjectionText,
    nextCheck: publicProjectionText,
    sourceIds: z.array(z.string().max(500)).max(24),
  }).strict()).max(10),
  error: z.string().max(500).nullable(),
  diagnostic: z.object({
    taskType: z.literal("screen4_event_interpretation"),
    stage: z.enum([
      "local_configuration", "admission", "network", "response_headers",
      "response_body", "model_output", "persistence", "projection",
      "request", "validation", "unknown",
    ]),
    code: z.string().regex(/^[a-z][a-z0-9_]{0,79}$/u),
    dispatchState: publicProjectionDispatchStateSchema,
    receiptSaved: z.boolean(),
    issuePaths: z.array(z.string().max(500)).max(3),
  }).strict().nullable(),
  diagnosis: z.object({
    reference: z.string().regex(/^[A-F0-9]{8}$/u),
    currentStep: z.enum([
      "source_manifest", "packet_preparation", "allowance_reservation",
      "provider_dispatch", "response_validation",
      "assessment_persistence", "display_join",
    ]),
    batchNumber: publicProjectionCount.nullable(),
    batchCount: publicProjectionCount,
    updatedAt: z.string().max(64).nullable(),
    steps: z.array(z.object({
      id: z.enum([
        "source_manifest", "packet_preparation", "allowance_reservation",
        "provider_dispatch", "response_validation",
        "assessment_persistence", "display_join",
      ]),
      label: z.string().min(1).max(120),
      status: z.enum(["complete", "current", "waiting", "failed"]),
      detail: z.string().min(1).max(300),
    }).strict()).length(7),
  }).strict().nullable().optional(),
  completedCount: publicProjectionCount,
  totalCount: publicProjectionCount,
  readiness: z.object({
    canDispatch: z.boolean(),
    blocker: publicProjectionShortText.nullable(),
    batchCount: publicProjectionCount,
    maximumReservationTokens: publicProjectionCount,
    nextReservationTokens: publicProjectionCount,
    availableTokens: publicProjectionCount.nullable(),
    availableAttempts: publicProjectionCount.nullable(),
  }).strict(),
}).strict();

const studyFirstEventHandoffProjectionSchema = z.object({
  schemaVersion: z.literal("screen-04-to-05-study-first-handoff-v1"),
  id,
  contextId: id,
  contextFingerprint: fingerprint,
  investigationSnapshotId: id,
  investigationFingerprint: fingerprint,
  investigationStatus: z.enum([
    "planned", "running", "completed", "completed_partial", "failed",
  ]),
  presentationFingerprint: fingerprint.nullable(),
  visibleEventIds: z.array(id).max(10),
  coverageLimitation: publicProjectionText,
  optionalMethodSelectionId: id.nullable(),
  createdAt: z.string().max(64),
  handoffFingerprint: fingerprint,
}).strict();

const studyFirstEventInvestigationWorkspaceProjectionSchema = z.object({
  retainedSource: z.object({
    investigation: studyFirstEventInvestigationProjectionSchema,
    interpretationQueue: screen4InterpretationQueueProjectionSchema.nullable(),
  }).strict().optional(),
  investigation: studyFirstEventInvestigationProjectionSchema.nullable(),
  // Optional additions distinguish current projections from legitimate v23
  // responses. Whenever present, every nested field is exact and bounded.
  discoveryTask: screen4DiscoveryTaskProjectionSchema.nullable().optional(),
  documentedOccurrences:
    z.array(coEventOccurrenceProjectionSchema).max(100).optional(),
  refreshAvailable: z.boolean().optional(),
  sourceVersionCurrent: z.boolean().optional(),
  interpretationQueue:
    screen4InterpretationQueueProjectionSchema.nullable().optional(),
  interpretationRevisions: z.array(z.object({
    taskFingerprint: fingerprint,
    investigationSnapshotId: id,
    completedCount: publicProjectionCount,
    totalCount: publicProjectionCount,
    status: z.enum([
      "ready", "in_progress", "completed", "partial", "validation_failed",
      "failed", "outcome_unknown",
    ]),
  }).strict()).max(24).optional(),
  latestScreen5Handoff: studyFirstEventHandoffProjectionSchema.nullable(),
  revisions: z.array(z.object({
    snapshotId: id,
    contextId: id,
    ordinal: publicProjectionCount,
    status: z.enum([
      "planned", "running", "completed", "completed_partial", "failed",
    ]),
    visibleEventCount: publicProjectionCount,
    completedAt: z.string().max(64).nullable(),
  }).strict()).max(24),
  claimBoundary: publicProjectionText,
}).strict();

const boundedProjectionJsonSchema: z.ZodType<unknown> = z.lazy(() => z.union([
  publicProjectionText,
  z.number().finite(),
  z.boolean(),
  z.null(),
  z.array(boundedProjectionJsonSchema).max(512),
  z.record(z.string().min(1).max(200), boundedProjectionJsonSchema)
    .superRefine((value, context) => {
      if (Object.keys(value).length > 512) {
        context.addIssue({
          code: "custom",
          message: "Projection object exceeds 512 declared values.",
        });
      }
    }),
]));

const causalComparisonWorkspaceProjectionSchema = z.object({
  schemaVersion: z.string().min(1).max(200),
  methodLibraryVersion: z.string().min(1).max(200),
  methodLibrary: z.array(boundedProjectionJsonSchema).max(64),
  designSet: boundedProjectionJsonSchema.nullable(),
  decision: boundedProjectionJsonSchema.nullable(),
  revisions: z.array(z.object({
    designSetSnapshotId: id,
    ordinal: publicProjectionCount,
    createdAt: z.string().max(64),
    eventCardSnapshotId: id,
    optionCount: publicProjectionCount,
    artifactStatus: z.enum([
      "not_assessed", "current", "out_of_date", "archived",
    ]),
    decision: z.enum(["selected", "no_selection", "not_decided"]),
    selectedOptionLabel: publicProjectionShortText.nullable(),
  }).strict()).max(64),
  studyFirst: z.object({
    methodLibraryVersion: z.string().min(1).max(200).optional(),
    methodLibrary: z.array(boundedProjectionJsonSchema).max(64).optional(),
    timing: boundedProjectionJsonSchema.nullable().optional(),
    entryContext: boundedProjectionJsonSchema.nullable().optional(),
    advice: boundedProjectionJsonSchema.nullable().optional(),
    contextualization: screen3ContextualizationProjectionSchema.nullable(),
    selection: boundedProjectionJsonSchema.nullable().optional(),
    defaultClarifications: studyDesignClarificationsSchema.optional(),
    revisions: z.array(z.object({
      adviceId: id,
      createdAt: z.string().max(64),
      studyRevision: publicProjectionCount,
      optionCount: publicProjectionCount,
      warningCount: publicProjectionCount,
      executionMode: z.literal("library_only"),
      selected: z.boolean(),
    }).strict()).max(64).optional(),
  }).strict(),
}).strict();

const policyChronologyTimingProjectionSchema = z.union([
  z.object({
    mode: z.literal("absolute"),
    start: z.string().max(40),
    end: z.string().max(40).nullable(),
    precision: z.enum(["day", "month", "year", "interval", "unknown"]),
  }).strict(),
  z.object({
    mode: z.literal("relative"),
    anchorStage: z.string().max(200).nullable(),
    anchorClockId: id.nullable(),
    offsetDays: z.number().int().min(-1_000_000).max(1_000_000),
    relation: z.literal("no_later_than_days_after"),
    calendarDate: z.null(),
  }).strict(),
  z.object({
    mode: z.literal("undated"),
    reason: z.literal("source_did_not_establish_a_normalized_date"),
  }).strict(),
]);

const screen6PolicyEvidenceProjectionSchema = z.object({
  status: z.string().min(1).max(100),
  claims: z.array(z.object({
    id,
    kind: z.string().min(1).max(200),
    statement: publicProjectionText,
    support: z.string().min(1).max(100),
    qualification: publicProjectionShortText.nullable(),
    sourceId: z.string().min(1).max(500),
    sourceTitle: publicProjectionShortText,
    sourceUrl: z.string().max(2_048),
    sourceRole: z.string().min(1).max(200),
    passageId: z.string().min(1).max(500),
    documentVersionId: z.string().max(500).nullable(),
    decision: z.string().min(1).max(100),
    effectiveStatement: publicProjectionText.nullable(),
    statementOrigin: z.string().min(1).max(100),
  }).strict()).max(512),
  chronology: z.array(z.object({
    id,
    stage: z.string().min(1).max(100),
    label: publicProjectionShortText,
    timing: policyChronologyTimingProjectionSchema,
    claimIds: z.array(id).max(128),
    sourceIds: z.array(z.string().min(1).max(500)).max(128),
    documentVersionIds:
      z.array(z.string().min(1).max(500)).max(128).optional(),
    conflictIds: z.array(id).max(128),
    hasUnresolvedConflict: z.boolean(),
    qualifications: z.array(publicProjectionShortText).max(128),
  }).strict()).max(256),
  chronologyOrigin: z.string().min(1).max(100),
  treatmentClock: z.union([
    z.object({
      mode: z.literal("selected"),
      candidate: z.object({
        id,
        clockId: id,
        stage: z.string().min(1).max(100),
        label: publicProjectionShortText,
        timing: policyChronologyTimingProjectionSchema,
        evidenceBasis: z.enum(["claim_linked", "source_metadata"]),
        status: z.literal("selected"),
        selected: z.literal(true),
        selectionOwner: z.literal("researcher"),
        qualification: publicProjectionShortText,
      }).strict(),
      rationale: publicProjectionShortText,
      decidedAt: z.string().max(64),
      decisionEventId: id,
    }).strict(),
    z.object({
      mode: z.literal("no_selection"),
      candidate: z.null(),
      rationale: publicProjectionShortText,
      decidedAt: z.string().max(64),
      decisionEventId: id,
    }).strict(),
  ]).nullable(),
  conflictIds: z.array(id).max(256),
  unresolvedRequirementIds: z.array(id).max(256),
  unresolvedEvidence: z.array(z.string().max(500)).max(256),
  reviewFingerprint: fingerprint.nullable(),
  cardFingerprint: fingerprint.nullable(),
}).strict();

const screen6PlanOtherEventProjectionSchema = z.object({
  id,
  title: publicProjectionShortText,
  dates: z.array(z.object({
    kind: z.enum(["event", "publication", "effective", "incident_start"]),
    value: z.string().max(40),
    precision: z.enum(["day", "month", "year"]),
    sourceId: z.string().min(1).max(500),
  }).strict()).max(24),
  occurrenceStatus: z.string().min(1).max(100),
  relationStatus: z.string().min(1).max(100),
  relevanceBand: z.enum(["high", "medium", "low", "background", "unassessed"]),
  relevanceOrigin: z.enum([
    "bounded_evidence_rules", "host_model_assessment", "not_assessed",
  ]),
  affectedActivity: publicProjectionShortText.nullable(),
  outcomePathway: publicProjectionText.nullable(),
  comparisonImplication: publicProjectionText.nullable(),
  uncertainty: publicProjectionShortText.nullable(),
  sourceIds: z.array(z.string().min(1).max(500)).max(24),
}).strict();

const screen5ProposedDirectionProjectionSchema = z.object({
  mode: z.enum([
    "single_hypothesis", "conditional_scenarios", "under_specified",
  ]),
  target_outcome: publicProjectionShortText,
  target_measure: publicProjectionShortText.nullable(),
  scenarios: z.array(z.object({
    sign: z.enum(["positive", "negative"]),
    condition: publicProjectionShortText,
    rationale: publicProjectionShortText,
    intermediate_movement: publicProjectionShortText,
    horizon: publicProjectionShortText.nullable(),
  }).strict()).max(8),
  missing_assumption: publicProjectionShortText.nullable(),
}).strict();

const screen5AssessedDirectionProjectionSchema = z.object({
  mechanismResponse: z.enum([
    "increase", "decrease", "mixed", "uncertain", "not_specified",
  ]),
  outcomeImplication: z.enum([
    "increase", "decrease", "mixed", "uncertain", "not_specified",
  ]),
  basis: z.enum([
    "researcher_proposed", "source_explicit", "analyst_inference",
    "not_specified",
  ]),
  condition: publicProjectionShortText,
}).strict();

const screen6SavedDiagnosticInputProjectionSchema =
  screen6DiagnosticInputSchema.extend({
    schemaVersion: z.literal("screen-06-diagnostic-input-v1"),
    inputFingerprint: fingerprint,
  }).strict();

const screen6PlanUpstreamProjectionSchema = z.object({
  study: z.object({
    revision: publicProjectionCount,
    source: z.literal("researcher_saved_study"),
  }).strict(),
  policy: z.object({
    identityFingerprint: fingerprint,
    episode: publicProjectionShortText,
    source: z.literal("researcher_confirmed_identity"),
  }).strict().nullable(),
  policyEvidence: screen6PolicyEvidenceProjectionSchema,
  treatmentTiming: z.object({
    mode: z.enum(["year", "undecided", "varies_by_group"]),
    year: z.number().int().min(1800).max(2200).nullable(),
    precision: z.enum(["year", "unknown", "varies_by_group"]),
    milestoneReference: z.object({
      claimId: id,
      label: publicProjectionShortText,
      sourceDateStart: z.string().max(40).nullable(),
      sourceDatePrecision: z.enum([
        "day", "month", "year", "interval", "unknown",
      ]),
    }).strict().nullable(),
    origin: z.enum(["researcher_reported", "legacy_explicit_decision"]),
    fingerprint,
  }).strict().nullable(),
  comparison: z.object({
    decision: z.union([
      z.object({ mode: z.literal("selected"), optionId: id }).strict(),
      z.object({ mode: z.literal("no_selection") }).strict(),
      z.object({ mode: z.literal("not_selected") }).strict(),
    ]),
    selectionFingerprint: fingerprint.nullable(),
    advisoryOptionIds: z.array(id).max(64),
  }).strict(),
  designConcerns: z.array(z.object({
    ruleId: id,
    severity: z.enum(["information", "caution", "substantive_incompatibility"]),
    basis: z.string().min(1).max(100),
    message: publicProjectionText,
    whyItMatters: publicProjectionText,
    nextCheck: publicProjectionText,
    sourceRefs: z.array(z.string().max(500)).max(64),
    methodRefs: z.array(z.string().max(500)).max(64),
  }).strict()).max(128),
  designCritique: screen3CritiqueProjectionSchema.nullable(),
  otherEvents: z.object({
    snapshotId: id,
    status: z.enum([
      "planned", "running", "completed", "completed_partial", "failed",
    ]),
    contextFit: z.enum([
      "current", "same_study_earlier_scan", "same_study_earlier_design", "earlier_study",
    ]).optional(),
    retainedNames: z.array(z.object({
      id, title: publicProjectionShortText,
    }).strict()).max(10).optional(),
    coverage: z.object({
      attemptedBranches: z.array(studyFirstEventBranchProjectionSchema).max(32),
      completedBranches: z.array(studyFirstEventBranchProjectionSchema).max(32),
      unsupportedBranches:
        z.array(studyFirstEventBranchProjectionSchema).max(32),
      failedBranches: z.array(studyFirstEventBranchProjectionSchema).max(32),
      sourceRoutesAttempted: publicProjectionCount,
      sourceRoutesSucceeded: publicProjectionCount,
      semanticAssessment: z.enum([
        "bounded_rules_completed", "pending_host_assessment",
        "host_model_completed", "unavailable",
      ]),
      limitation: publicProjectionText,
    }).strict().nullable().optional(),
    occurrences: z.array(screen6PlanOtherEventProjectionSchema).max(6),
    omittedCount: publicProjectionCount,
    totalCount: publicProjectionCount,
    selectionRule: publicProjectionText,
  }).strict().nullable(),
  mechanisms: z.object({
    status: z.enum([
      "no_focal_input", "focal_saved_without_direct_job", "completed",
      "interrupted", "in_progress",
    ]),
    phase: z.string().min(1).max(100).nullable(),
    safeFailureCode: z.string().max(100).nullable(),
    finalizedFocal: z.object({
      id,
      originalText: publicProjectionText,
      theoreticalPerspective: publicProjectionShortText.nullable().optional(),
      origin: z.string().min(1).max(100),
    }).strict().nullable(),
    proposals: z.array(z.object({
      id,
      concept: publicProjectionShortText,
      chain: z.array(publicProjectionShortText).max(16),
      condition: publicProjectionText,
      distinction: publicProjectionText,
      proposedDirection: screen5ProposedDirectionProjectionSchema.nullable(),
      hypothesisStatus: z.string().min(1).max(100),
    }).strict()).max(64),
    assessments: z.array(z.object({
      id,
      concept: publicProjectionShortText,
      direction: screen5AssessedDirectionProjectionSchema.nullable(),
      sourceCheckStatus: z.enum([
        "checked_relevant_text", "checked_no_relevant_match",
        "text_unavailable", "not_checked_due_budget", "legacy_unknown",
      ]),
      support: z.enum([
        "component_supported", "analogous_setting", "partly_supported",
        "hypothesis_only", "materially_contested",
      ]).nullable(),
      chain: z.array(publicProjectionShortText).max(16),
      limit: publicProjectionText,
      evidenceIds: z.array(z.string().max(500)).max(64),
    }).strict()).max(64),
    predictions: z.array(z.object({
      id,
      observation: publicProjectionText,
      measure: publicProjectionShortText,
      timing: publicProjectionShortText,
      patterns: z.array(z.object({
        mechanismId: id,
        detail: publicProjectionText,
        status: z.enum([
          "prediction", "shared_implication", "not_distinguishing",
          "insufficient_evidence", "not_assessed", "legacy_unknown",
        ]),
        evidenceIds: z.array(z.string().max(500)).max(64),
      }).strict()).max(32),
    }).strict()).max(64),
    predictionCount: publicProjectionCount,
    comparisonSummary: publicProjectionText.nullable().optional(),
    comparisonGaps: z.array(publicProjectionShortText).max(64).optional(),
    comparisonDispositions: z.array(z.object({
      candidateId: id,
      status: z.enum([
        "retained", "qualified", "merged", "excluded",
        "not_supported_for_study", "hypothesis_only",
        "unassessed_evidence", "unassessed_budget",
      ]),
      reason: publicProjectionText,
      mergedInto: id.nullable(),
    }).strict()).max(64).optional(),
    comparisonCompletion: z.object({
      status: z.enum(["partial", "completed"]),
      admittedAdditionalCount: publicProjectionCount,
      disposedAdditionalCount: publicProjectionCount,
      completedBatchCount: publicProjectionCount,
      totalBatchCount: publicProjectionCount,
    }).strict().nullable().optional(),
  }).strict(),
  dataFeasibility: z.union([
    z.object({
      origin: z.literal("previous_researcher_report"),
      snapshotId: id,
      input: screen6SavedDiagnosticInputProjectionSchema,
      qualification: publicProjectionText,
    }).strict(),
    z.object({
      origin: z.literal("not_supplied"),
      input: z.null(),
      qualification: publicProjectionText,
    }).strict(),
  ]),
  diagnosticResults: z.object({
    status: z.literal("not_interpreted_by_this_plan"),
    count: publicProjectionCount,
  }).strict(),
}).strict();

const screen6SnapshotRefsProjectionSchema = z.object({
  planVersion: z.enum([
    "screen-06-current-study-plan-v2", "screen-06-current-study-plan-v3",
  ]),
  contextualizerTaskVersion: z.enum([
    "screen-06-contextualization-v3", "screen-06-contextualization-v4",
  ]),
  studyRevision: publicProjectionCount,
  policyFingerprint: fingerprint.nullable(),
  policyEvidenceFingerprint: fingerprint.nullable(),
  reviewedEventCardFingerprint: fingerprint.nullable(),
  timingFingerprint: fingerprint.nullable(),
  adviceFingerprint: fingerprint.nullable(),
  designCritiqueFingerprint: fingerprint.nullable(),
  selectionFingerprint: fingerprint.nullable(),
  eventFingerprint: fingerprint.nullable(),
  finalizedMechanismFingerprint: fingerprint.nullable(),
  planFingerprint: fingerprint.nullable(),
  assessmentFingerprint: fingerprint.nullable(),
  mechanismReceiptFingerprints: z.array(fingerprint).max(64),
  mechanismPhase: z.string().min(1).max(100).nullable(),
  feasibilityFingerprint: fingerprint.nullable(),
  libraryVersion: z.literal("screen-06-reviewed-diagnostic-library-v1"),
}).strict();

const screen6DependencyManifestProjectionSchema = z.object({
  version: z.literal("screen-06-dependency-manifest-v1"),
  semantic: z.object({
    study: fingerprint,
    policy: fingerprint,
    policyEvidence: fingerprint,
    treatmentTiming: fingerprint,
    comparison: fingerprint,
    design: fingerprint,
    otherEvents: fingerprint,
    mechanisms: fingerprint,
    dataFeasibility: fingerprint,
  }).strict(),
  operational: z.object({
    studyRevision: publicProjectionCount,
    eventSnapshotId: id.nullable(),
    eventInvestigationFingerprint: fingerprint.nullable(),
    mechanismPhase: z.string().min(1).max(100).nullable(),
    mechanismReceiptFingerprints: z.array(fingerprint).max(64),
    feasibilitySnapshotId: id.nullable(),
  }).strict(),
}).strict();

const screen6CurrentPlanFullProjectionSchema = z.object({
  schemaVersion: z.enum([
    "screen-06-current-study-plan-v2", "screen-06-current-study-plan-v3",
  ]),
  inputFingerprint: fingerprint,
  snapshotRefs: screen6SnapshotRefsProjectionSchema,
  dependencyManifest: screen6DependencyManifestProjectionSchema.optional(),
  legacyInputFingerprints: z.array(fingerprint).max(8).optional(),
  upstream: screen6PlanUpstreamProjectionSchema,
  study: z.object({
    policy: publicProjectionShortText,
    episode: publicProjectionShortText.nullable(),
    question: publicProjectionText.nullable(),
    initialExplanation: publicProjectionText.nullable(),
    construct: publicProjectionShortText.nullable(),
    policySideConcept: publicProjectionShortText.nullable(),
    population: publicProjectionShortText.nullable(),
    unit: publicProjectionShortText.nullable(),
    geography: z.array(z.string().max(300)).max(20),
    industry: z.array(z.string().max(300)).max(20),
    requestedPeriod: z.object({
      start: z.string().max(40).nullable(),
      end: z.string().max(40).nullable(),
    }).strict(),
    outcome: publicProjectionShortText.nullable(),
    measure: publicProjectionShortText.nullable(),
    proposedTreatment: publicProjectionText.nullable().optional(),
    proposedComparison: publicProjectionText.nullable().optional(),
    proposedGroups: publicProjectionText,
    selectedComparison: publicProjectionShortText.nullable(),
    advisoryOptions: z.array(publicProjectionShortText).max(64),
    focalMechanism: publicProjectionText.nullable(),
    focalTheoreticalPerspective: publicProjectionText.nullable().optional(),
    alternativeCount: publicProjectionCount,
  }).strict(),
  gaps: z.array(publicProjectionText).max(32),
  dimensions: z.array(z.object({
    id: screen6DimensionIdProjectionSchema,
    label: publicProjectionShortText,
    state: publicProjectionShortText,
    basis: publicProjectionText,
    concern: publicProjectionText,
    check: publicProjectionText,
    refs: z.array(z.string().max(500)).max(128),
  }).strict()).length(10),
  priorities: z.array(z.object({
    id,
    label: publicProjectionShortText,
    category: z.enum([
      "design_check", "statistical_test", "sensitivity_analysis",
      "additional_evidence_collection",
    ]),
    reason: publicProjectionText,
    status: z.enum(["planned", "prerequisites_needed"]),
    prerequisites: z.array(publicProjectionShortText).max(64),
    procedure: z.array(publicProjectionText).max(64),
    concern: z.array(publicProjectionText).max(64),
    alternatives: z.array(publicProjectionText).max(64),
    limits: z.array(publicProjectionText).max(64),
    response: z.array(publicProjectionText).max(64),
    references: z.array(z.string().max(1_000)).max(64),
    dimensionIds: z.array(screen6DimensionIdProjectionSchema).max(10),
    evidenceRefs: z.array(z.string().max(500)).max(128).optional(),
  }).strict()).max(64),
  boundary: z.object({
    plannedTarget: publicProjectionText,
    requiredAssumptions: z.array(publicProjectionText).max(32),
    unsupportedClaims: z.array(publicProjectionText).max(32),
    nextAction: publicProjectionText,
    recommendation: publicProjectionText,
  }).strict(),
  libraryVersion: z.literal("screen-06-reviewed-diagnostic-library-v1"),
  status: z.literal("plan_only"),
  modelCalls: z.literal(0),
  resultsAssessed: z.literal(false),
}).strict();

const screen6LegacyPlanProjectionSchema = z.object({
  schemaVersion: z.literal("screen-06-current-study-plan-v2"),
  status: z.literal("plan_only"),
  modelCalls: z.literal(0),
  resultsAssessed: z.literal(false),
}).strict();

const screen6CurrentPlanProjectionSchema = z.union([
  screen6CurrentPlanFullProjectionSchema,
  screen6LegacyPlanProjectionSchema,
]);

const projectionSchema = z.object({
  schemaVersion: z.literal(SIX_SCREEN_WORKFLOW_PUBLIC_SCHEMA_VERSION),
  runId,
  revision: z.number().int().nonnegative(),
  activeScreen: z.union([
    z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5),
    z.literal(6),
  ]),
  optionalAnalysisRecovery: z.object({
    schemaVersion: z.literal(SIX_SCREEN_OPTIONAL_ANALYSIS_RECOVERY_VERSION),
    blockedScreens: z.array(z.union([
      z.literal(3), z.literal(4), z.literal(5), z.literal(6),
    ])),
    isolatedCounts: z.object({
      screen3: z.number().int().nonnegative(),
      screen4: z.number().int().nonnegative(),
      screen5: z.number().int().nonnegative(),
      screen6: z.number().int().nonnegative(),
    }).strict(),
  }).strict(),
  status: z.enum([
    "identity_input",
    "identity_resolving",
    "identity_review",
    "shock_confirmed",
  ]),
  statusMessage: z.string(),
  study: z.unknown(),
  originalShockInput: z.string(),
  currentShockInput: z.string(),
  officialSourceLocators: z.array(z.string()),
  officialIdentifier: z.string().nullable(),
  requestedJurisdiction: z.string().nullable(),
  approximateYear: z.string().nullable(),
  intendedEpisode: z.string().nullable(),
  identityRevision: z.number().int().nonnegative(),
  identityResolution: z.unknown().nullable(),
  candidates: z.array(z.unknown()),
  confirmedShock: z.unknown().nullable(),
  policyReview: z.unknown().nullable(),
  policyEventCardWorkspace: z.unknown().nullable(),
  policyLifecycleStageReviewWorkspace: z.unknown().nullable(),
  causalComparisonWorkspace: causalComparisonWorkspaceProjectionSchema,
  coEventSearchWorkspace: z.unknown(),
  studyFirstEventInvestigationWorkspace:
    studyFirstEventInvestigationWorkspaceProjectionSchema,
  studyFirstMechanismWorkspace: z.unknown(),
  modelCapability: screen5ExecutionReadinessProjectionSchema.optional(),
  mechanismLiteratureWorkspace: z.unknown(),
  screen6CurrentPlan: screen6CurrentPlanProjectionSchema,
  screen6Personalization: screen6PersonalizationProjectionSchema.nullable(),
  screen6HistoricalPersonalization:
    screen6PersonalizationProjectionSchema.nullable().optional(),
  screen6UncertaintyWorkspace: z.unknown(),
  screen3Prerequisites: z.unknown(),
  screen4Prerequisites: z.unknown(),
  screen5Prerequisites: z.unknown(),
  screen6Prerequisites: z.unknown(),
  canOpenScreen2: z.boolean(),
  canOpenScreen3: z.boolean(),
  canOpenScreen4: z.boolean(),
  canOpenScreen5: z.boolean(),
  canOpenScreen6: z.boolean(),
  canResearchPolicy: z.boolean(),
  canContinuePolicy: z.boolean(),
  canBuildCausalComparison: z.boolean(),
  canDecideCausalComparison: z.boolean(),
  canSaveCoEventSearchMatrix: z.boolean(),
  canContinueCoEventSearch: z.boolean(),
  canCompareStudyFirstMechanisms: z.boolean(),
  canReviewCoEventOccurrence: z.boolean(),
  canReviewCoEventRelations: z.boolean(),
  canReviewCoEventDuplicates: z.boolean(),
  canSaveMechanismLiteraturePlan: z.boolean(),
  canContinueMechanismLiteratureSearch: z.boolean(),
  canInspectScholarlyDocument: z.boolean(),
  canExtractScholarlyClaim: z.boolean(),
  canReviewScholarlyClaim: z.boolean(),
  canPrepareMechanismSynthesisInput: z.boolean(),
  canSaveMechanismReview: z.boolean(),
  canInitializeScreen6UncertaintyProfile: z.boolean(),
  canSaveScreen6DiagnosticPlan: z.boolean(),
  canRecordScreen6DiagnosticResult: z.boolean(),
  canReviewScreen6DiagnosticResult: z.boolean(),
  canSaveScreen6ConditionalClaimBoundary: z.boolean(),
  canRecordScreen6ResearchPlanningDisposition: z.boolean(),
  canCreateScreen6ResearchExport: z.boolean(),
  continuationDisclosure: z.string(),
}).strict();

const projectionWireSchema = z.object({
  schemaVersion: z.literal(SIX_SCREEN_WORKFLOW_PUBLIC_SCHEMA_VERSION),
}).passthrough();

/** Validate the actual public projection, including derived cross-screen data. */
export function validateSixScreenWorkflowProjection(value: unknown) {
  return projectionSchema.parse(value);
}

const operationStatusInputSchema = z.object({
  runId,
  accessToken,
  operationId: id,
  operationKind: z.literal("open_screen_3"),
  inputFingerprint: fingerprint,
}).strict();

const operationStatusReceiptSchema = z.object({
  workflowRevision: z.number().int().nonnegative(),
  studyRevision: z.number().int().nonnegative(),
  identityFingerprint: fingerprint,
  timingId: id,
  timingFingerprint: fingerprint,
  entryContextId: id,
  entryContextFingerprint: fingerprint,
  adviceId: id,
  adviceFingerprint: fingerprint,
  evidenceStatus: z.enum([
    "available", "partial", "conflicting", "unavailable",
    "not_researched",
  ]),
  openedAt: z.iso.datetime({ offset: false }),
}).strict();

const operationStatusWireSchema = z.object({
  schemaVersion: z.literal(SIX_SCREEN_OPERATION_STATUS_SCHEMA_VERSION),
  buildId: z.literal(SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID),
  appVersion: z.literal(SHOCKAUDIT_VERSION),
  uiResourceUri: z.literal(SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI),
  toolName: z.literal(SIX_SCREEN_OPERATION_STATUS_TOOL),
  requestFingerprint: fingerprint,
  runId,
  revision: z.number().int().nonnegative(),
  stateFingerprint: fingerprint,
  operationReference: z.string().regex(/^[0-9A-F]{12}$/u),
  operationKind: z.literal("open_screen_3"),
  inputFingerprint: fingerprint,
  lookup: z.enum(["committed", "unknown_or_expired", "conflict"]),
  commitCertainty: z.enum(["committed", "unknown"]),
  committedRevision: z.number().int().nonnegative().nullable(),
  mutationOutcome: z.enum([
    "changed", "unchanged", "legacy_unknown",
  ]).nullable(),
  completedAt: z.iso.datetime({ offset: false }).nullable(),
  resultFingerprint: fingerprint.nullable(),
  receiptValidated: z.boolean(),
  screen3Receipt: operationStatusReceiptSchema.nullable(),
  destination: z.object({
    screen: z.literal(3),
    state: z.enum([
      "current", "historical", "locally_recoverable", "unavailable",
      "unknown",
    ]),
    displayReady: z.boolean(),
    localRebuildAvailable: z.boolean(),
    safeCode: z.string().regex(/^[a-z][a-z0-9_]{0,79}$/u),
  }).strict(),
  responseFingerprint: fingerprint,
}).strict();

const recoverySnapshotInputSchema = z.object({
  runId,
  accessToken,
}).strict();

const stateChunkInputSchema = z.object({
  runId,
  accessToken,
  transferId: fingerprint,
  revision: z.number().int().nonnegative(),
  stateFingerprint: fingerprint,
  encodedStateBytes: z.number().int().positive().max(
    SIX_SCREEN_MAX_ENCODED_PAYLOAD_BYTES,
  ),
  canonicalStateBytes: z.number().int().positive().max(
    SIX_SCREEN_MAX_CANONICAL_PAYLOAD_BYTES,
  ),
  chunkIndex: z.number().int().nonnegative().max(
    SIX_SCREEN_MAX_STATE_CHUNKS - 1,
  ),
}).strict();

const stateChunkWireSchema = z.object({
  schemaVersion: z.literal(SIX_SCREEN_WORKFLOW_STATE_CHUNK_SCHEMA_VERSION),
  buildId: z.literal(SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID),
  appVersion: z.literal(SHOCKAUDIT_VERSION),
  uiResourceUri: z.literal(SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI),
  toolName: z.literal(SIX_SCREEN_WORKFLOW_STATE_CHUNK_TOOL),
  transferId: fingerprint,
  runId,
  revision: z.number().int().nonnegative(),
  stateFingerprint: fingerprint,
  encodedStateBytes: z.number().int().positive().max(
    SIX_SCREEN_MAX_ENCODED_PAYLOAD_BYTES,
  ),
  canonicalStateBytes: z.number().int().positive().max(
    SIX_SCREEN_MAX_CANONICAL_PAYLOAD_BYTES,
  ),
  chunkIndex: z.number().int().nonnegative().max(
    SIX_SCREEN_MAX_STATE_CHUNKS - 1,
  ),
  chunkCount: z.number().int().positive().max(SIX_SCREEN_MAX_STATE_CHUNKS),
  chunkBytes: z.number().int().positive().max(SIX_SCREEN_STATE_CHUNK_BYTES),
  chunkFingerprint: fingerprint,
  encodedStateChunk: z.string().min(1).max(SIX_SCREEN_STATE_CHUNK_BYTES),
  responseFingerprint: fingerprint,
}).strict();

const recoverySnapshotPayload = z.string().max(
  SIX_SCREEN_MAX_ENCODED_PAYLOAD_BYTES,
);
const recoverySnapshotWireSchema = z.object({
  schemaVersion: z.literal(SIX_SCREEN_RECOVERY_SNAPSHOT_SCHEMA_VERSION),
  buildId: z.literal(SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID),
  appVersion: z.literal(SHOCKAUDIT_VERSION),
  uiResourceUri: z.literal(SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI),
  toolName: z.literal(SIX_SCREEN_RECOVERY_SNAPSHOT_TOOL),
  encoding: z.literal(SIX_SCREEN_RECOVERY_SNAPSHOT_ENCODING),
  runId,
  revision: z.number().int().nonnegative(),
  stateFingerprint: fingerprint,
  publicProjectionFingerprint: fingerprint,
  canonicalStateBytes: z.number().int().nonnegative().max(
    SIX_SCREEN_MAX_CANONICAL_PAYLOAD_BYTES,
  ),
  canonicalPublicProjectionBytes:
    z.number().int().nonnegative().max(
      SIX_SCREEN_MAX_CANONICAL_PAYLOAD_BYTES,
    ),
  encodedStateBytes: z.number().int().nonnegative().max(
    SIX_SCREEN_MAX_ENCODED_PAYLOAD_BYTES,
  ),
  encodedPublicProjectionBytes:
    z.number().int().nonnegative().max(
      SIX_SCREEN_MAX_ENCODED_PAYLOAD_BYTES,
    ),
  encodedStatePayload: recoverySnapshotPayload,
  encodedPublicProjectionPayload: recoverySnapshotPayload,
  responseFingerprint: fingerprint,
}).strict();

const appOnlyToolMeta = {
  ui: { visibility: ["app"] },
  "openai/widgetAccessible": true,
} as const;

export const SIX_SCREEN_MUTATION_OUTCOME_META_KEY =
  "shockaudit/sixScreenMutationOutcome" as const;

/**
 * MCP-safe error transport shared by the six-screen registered tools.  It
 * serializes only the bounded structured problem contract and never copies a
 * caught error message, request value, provider body, or study text.
 */
export function sixScreenWorkflowProblemToolResult(
  error: unknown,
  context: ClassifySixScreenWorkflowProblemContext = {},
) {
  const problem = classifySixScreenWorkflowProblem(error, context) ??
    createSixScreenWorkflowProblem({
      code: "unclassified",
      ...context,
      safeCauseCodes: ["unclassified_error"],
    });
  return {
    isError: true as const,
    content: [{
      type: "text" as const,
      text: encodeSixScreenWorkflowProblemText(problem),
    }],
  };
}

function mutationProblemContext(input: unknown) {
  const candidate = input && typeof input === "object" &&
      !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  const action = typeof candidate.action === "string"
    ? candidate.action : null;
  const policy = sixScreenActionPolicy(action);
  return {
    action,
    operationId: typeof candidate.operationId === "string"
      ? candidate.operationId : null,
    screen: policy?.destinationScreen ?? null,
    expectedRevision: Number.isSafeInteger(candidate.expectedRevision) &&
        Number(candidate.expectedRevision) >= 0
      ? Number(candidate.expectedRevision) : null,
  } satisfies ClassifySixScreenWorkflowProblemContext;
}

function completedMutationDispatchCertainty(action: unknown) {
  const externalWork = sixScreenActionPolicy(action)?.externalWork;
  if (externalWork === "none") return "not_dispatched" as const;
  if (externalWork === "model") return "dispatched" as const;
  return "unknown" as const;
}

function result(
  projection: SixScreenWorkflowPublicProjection,
  privateSnapshot: SixScreenWorkflowPrivateSnapshot,
  text: string,
  responseCoordinates: {
    toolName: SixScreenWorkflowResponseContract["toolName"];
    operationStage: string;
    operationBinding?: SixScreenWorkflowResponseOperationBinding;
  },
  mutationOutcome?: "changed" | "unchanged" | "replayed",
  additionalMetadata: Record<string, unknown> = {},
) {
  const workspace = projection.policyEventCardWorkspace;
  const lifecycleStageWorkspace =
    projection.policyLifecycleStageReviewWorkspace;
  const structuredProjection: SixScreenWorkflowPublicProjection = {
    ...projection,
    // Exact passages and the complete review workspace are widget-only. Keep
    // the model-visible projection compact and carry this bounded panel data
    // through authenticated result metadata instead.
    policyEventCardWorkspace: null,
    policyLifecycleStageReviewWorkspace: null,
  };
  validateSixScreenWorkflowProjection(structuredProjection);
  const responseContract = createSixScreenWorkflowResponseContract({
    appVersion: SHOCKAUDIT_VERSION,
    uiResourceUri: SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI,
    ...responseCoordinates,
    publicProjection: structuredProjection,
    privateSnapshot,
  });
  return {
    content: [{ type: "text" as const, text }],
    structuredContent: structuredProjection,
    _meta: {
      ...additionalMetadata,
      // The canonical state is carried once in the authenticated compressed
      // response contract below. Keeping only the access coordinates here
      // avoids duplicating an increasingly large workspace after Screens 4–5.
      [SIX_SCREEN_WORKFLOW_META_KEY]: {
        schemaVersion: privateSnapshot.schemaVersion,
        runId: privateSnapshot.runId,
        accessToken: privateSnapshot.accessToken,
        revision: privateSnapshot.revision,
        stateFingerprint: privateSnapshot.stateFingerprint,
      },
      [SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY]: responseContract,
      ...(mutationOutcome
        ? { [SIX_SCREEN_MUTATION_OUTCOME_META_KEY]: mutationOutcome }
        : {}),
      ...(workspace
        ? {
            [SIX_SCREEN_POLICY_EVENT_CARD_WORKSPACE_META_KEY]:
              workspace satisfies PolicyEventCardWorkspace,
          }
        : {}),
      ...(lifecycleStageWorkspace
        ? {
            [SIX_SCREEN_POLICY_LIFECYCLE_STAGE_WORKSPACE_META_KEY]:
              lifecycleStageWorkspace satisfies
                PolicyLifecycleStageReviewWorkspace,
          }
        : {}),
    },
  };
}

export function registerSixScreenWorkflowTools(
  server: McpServer,
  runtime: SixScreenWorkflowRuntime,
  options: {
    resultMetadata?: () => Record<string, unknown>;
  } = {},
) {
  server.registerTool(
    "create_six_screen_workflow_v1",
    {
      title: "Create the six-screen ShockAudit workflow",
      description:
        "App-only canonical creation for the adopted six-screen workflow. It preserves the exact policy input and does not infer confirmation.",
      inputSchema: createWireSchema,
      outputSchema: projectionWireSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: appOnlyToolMeta,
    },
    async (wireInput) => {
      const input = createSchema.parse(wireInput);
      const created = await runtime.create({
        ...input,
        study: input.study as StudyContextDraft,
      });
      return result(
        created.projection,
        created.privateSnapshot,
        "Screen 1 saved the study and exact original policy input. No shock is confirmed yet.",
        {
          toolName: "create_six_screen_workflow_v1",
          operationStage: "create",
        },
        undefined,
        options.resultMetadata?.(),
      );
    },
  );

  server.registerTool(
    "get_six_screen_workflow_v1",
    {
      title: "Read the six-screen ShockAudit workflow",
      description:
        "App-only read of committed canonical state. This status operation never advances retrieval.",
      inputSchema: authenticationSchema,
      outputSchema: projectionWireSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: appOnlyToolMeta,
    },
    async (input) => {
      const status = await runtime.status(input);
      return result(
        status.projection,
        status.privateSnapshot,
        status.projection.statusMessage,
        {
          toolName: "get_six_screen_workflow_v1",
          operationStage: "read",
        },
        undefined,
        options.resultMetadata?.(),
      );
    },
  );

  server.registerTool(
    "retire_six_screen_workflow_v1",
    {
      title: "Start a new ShockAudit search",
      description:
        "App-only authenticated retirement of the current workspace and its run-scoped task records.",
      inputSchema: authenticationSchema,
      outputSchema: retirementWireSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: appOnlyToolMeta,
    },
    async (input) => {
      const retired = retirementWireSchema.parse(
        await runtime.retire(authenticationSchema.parse(input)),
      );
      return {
        content: [{
          type: "text" as const,
          text:
            "The current ShockAudit workspace was cleared. A new policy search can begin.",
        }],
        structuredContent: retired,
        _meta: options.resultMetadata?.() ?? {},
      };
    },
  );

  server.registerTool(
    SIX_SCREEN_WORKFLOW_STATE_CHUNK_TOOL,
    {
      title: "Read one authenticated ShockAudit state chunk",
      description:
        "App-only read of one small exact chunk from a committed large workspace response. It never advances workflow, source, or model work.",
      inputSchema: stateChunkInputSchema,
      outputSchema: stateChunkWireSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: appOnlyToolMeta,
    },
    async (wireInput) => {
      let input: z.infer<typeof stateChunkInputSchema> | null = null;
      try {
        input = stateChunkInputSchema.parse(wireInput);
        const snapshot = await runtime.stateTransferSnapshot({
          runId: input.runId,
          accessToken: input.accessToken,
        });
        const canonical = serializeSixScreenValue(snapshot.state);
        const encoded = encodeSixScreenWorkflowPayload(canonical);
        const transferId = sixScreenWorkflowStateTransferId({
          runId: snapshot.runId,
          revision: snapshot.revision,
          stateFingerprint: snapshot.stateFingerprint,
          encodedStateBytes: encoded.encodedBytes,
          canonicalStateBytes: encoded.canonicalBytes,
        });
        if (
          snapshot.revision !== input.revision ||
          snapshot.stateFingerprint !== input.stateFingerprint ||
          encoded.encodedBytes !== input.encodedStateBytes ||
          encoded.canonicalBytes !== input.canonicalStateBytes ||
          transferId !== input.transferId
        ) {
          throw new SixScreenWorkflowProblemError(
            createSixScreenWorkflowProblem({
              code: "revision_conflict",
              action: "get_state_chunk",
              expectedRevision: input.revision,
              actualRevision: snapshot.revision,
              commitCertainty: "not_committed",
              dispatchCertainty: "not_dispatched",
              recovery: "guarded_rebase",
              safeCauseCodes: ["stale_revision"],
            }),
          );
        }
        const chunks = sixScreenWorkflowStateChunks(encoded.encodedPayload);
        const chunk = chunks[input.chunkIndex];
        if (chunk === undefined) {
          throw new SixScreenWorkflowProblemError(
            createSixScreenWorkflowProblem({
              code: "request_contract",
              action: "get_state_chunk",
              expectedRevision: input.revision,
              actualRevision: snapshot.revision,
              commitCertainty: "not_committed",
              dispatchCertainty: "not_dispatched",
              recovery: "none",
              safeCauseCodes: ["request_schema_invalid"],
            }),
          );
        }
        const body = {
          schemaVersion: SIX_SCREEN_WORKFLOW_STATE_CHUNK_SCHEMA_VERSION,
          buildId: SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID,
          appVersion: SHOCKAUDIT_VERSION,
          uiResourceUri: SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI,
          toolName: SIX_SCREEN_WORKFLOW_STATE_CHUNK_TOOL,
          transferId,
          runId: snapshot.runId,
          revision: snapshot.revision,
          stateFingerprint: snapshot.stateFingerprint,
          encodedStateBytes: encoded.encodedBytes,
          canonicalStateBytes: encoded.canonicalBytes,
          chunkIndex: input.chunkIndex,
          chunkCount: chunks.length,
          chunkBytes: new TextEncoder().encode(chunk).byteLength,
          chunkFingerprint: fingerprintSixScreenValue(chunk),
          // Response v6 uses the one result field guaranteed to survive the
          // app-initiated ChatGPT tool path. The app-only tool exposes the
          // bounded authenticated bytes exactly once, inside its declared
          // structured schema, rather than relying on `_meta` or prose blocks.
          encodedStateChunk: chunk,
        };
        const structuredContent = stateChunkWireSchema.parse({
          ...body,
          responseFingerprint: fingerprintSixScreenValue(body),
        });
        return {
          content: [{
            type: "text" as const,
            text:
              "ShockAudit returned one authenticated bounded workspace chunk to the app.",
          }],
          structuredContent,
          _meta: options.resultMetadata?.() ?? {},
        };
      } catch (error) {
        return sixScreenWorkflowProblemToolResult(error, {
          action: "get_state_chunk",
          expectedRevision: input?.revision ?? null,
          actualRevision: null,
          commitCertainty: "not_committed",
          dispatchCertainty: "not_dispatched",
          recovery: "guarded_rebase",
        });
      }
    },
  );

  server.registerTool(
    SIX_SCREEN_RECOVERY_SNAPSHOT_TOOL,
    {
      title: "Restore the canonical six-screen workspace",
      description:
        "App-only authenticated recovery read. It returns one compressed canonical state and display projection so the embedded workspace can recover after a large ordinary tool result is interrupted, without repeating a mutation or external request.",
      inputSchema: recoverySnapshotInputSchema,
      outputSchema: recoverySnapshotWireSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: appOnlyToolMeta,
    },
    async (input) => {
      try {
        const authentication = recoverySnapshotInputSchema.parse(input);
        const recovered = await runtime.recoverySnapshot(authentication);
        const encoded = await createSixScreenRecoverySnapshot({
          appVersion: SHOCKAUDIT_VERSION,
          uiResourceUri: SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI,
          state: recovered.privateSnapshot.state,
          publicProjection: recovered.projection,
        });
        const parsed = recoverySnapshotWireSchema.parse(encoded);
        return {
          content: [{
            type: "text" as const,
            text:
              "ShockAudit restored the current canonical workspace through the bounded recovery channel. No workflow action or external request was repeated.",
          }],
          structuredContent: parsed,
          _meta: options.resultMetadata?.() ?? {},
        };
      } catch (error) {
        return sixScreenWorkflowProblemToolResult(error, {
          action: "get_recovery_snapshot",
          commitCertainty: "unknown",
          dispatchCertainty: "not_dispatched",
          recovery: "check_status",
        });
      }
    },
  );

  server.registerTool(
    SIX_SCREEN_OPERATION_STATUS_TOOL,
    {
      title: "Check a saved Screen 3 handoff",
      description:
        "App-only authenticated read of one exact Screen 3 handoff receipt. It returns compact commit and display-readiness facts without building the full workspace or advancing any source or model task.",
      inputSchema: operationStatusInputSchema,
      outputSchema: operationStatusWireSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: appOnlyToolMeta,
    },
    async ({
      runId: workflowRunId,
      accessToken: workflowAccessToken,
      operationId,
      operationKind,
      inputFingerprint,
    }) => {
      let status: Awaited<ReturnType<
        SixScreenWorkflowRuntime["operationStatus"]
      >>;
      try {
        status = await runtime.operationStatus({
          runId: workflowRunId,
          accessToken: workflowAccessToken,
        }, { operationId, operationKind, inputFingerprint });
      } catch (error) {
        return sixScreenWorkflowProblemToolResult(error, {
          action: "get_operation_status",
          operationId,
          screen: 3,
          dispatchCertainty: "not_dispatched",
        });
      }
      const parsed = operationStatusWireSchema.safeParse(status);
      if (!parsed.success) {
        return sixScreenWorkflowProblemToolResult(
          new SixScreenWorkflowProblemError(
            createSixScreenWorkflowProblem({
              code: "response_contract",
              stage: "serialization",
              action: "get_operation_status",
              operationId,
              screen: 3,
              commitCertainty: status.lookup === "committed"
                ? "committed" : "unknown",
              dispatchCertainty: "not_dispatched",
              recovery: "check_status",
              safeCauseCodes: ["response_contract_invalid"],
            }),
          ),
        );
      }
      return {
        content: [{
          type: "text" as const,
          text: status.lookup === "committed"
            ? status.destination.displayReady
              ? "The exact Screen 3 handoff is committed and its saved comparison guidance is ready."
              : "The exact Screen 3 handoff is committed, but its saved comparison guidance is not currently ready to display."
            : status.lookup === "conflict"
              ? "That operation identity is bound to different saved input."
              : "The exact operation outcome is unknown or its bounded receipt is no longer retained.",
        }],
        structuredContent: parsed.data,
        _meta: options.resultMetadata?.() ?? {},
      };
    },
  );

  server.registerTool(
    "mutate_six_screen_workflow_v1",
    {
      title: "Update the six-screen ShockAudit workflow",
      description:
        "App-only bounded evidence, review, routing, acquisition, and disposition mutations.",
      inputSchema: mutationMcpInputSchema,
      outputSchema: projectionWireSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      _meta: appOnlyToolMeta,
    },
    async (wireInput) => {
      const rawMutation = wireInput && typeof wireInput === "object" &&
          !Array.isArray(wireInput) && "mutation" in wireInput
        ? (wireInput as { mutation?: unknown }).mutation
        : null;
      let parsedMutation: z.infer<typeof mutationSchema> | null = null;
      let runtimeCompleted = false;
      let committedRevision: number | null = null;
      try {
      const {
        runId: workflowRunId,
        accessToken: workflowAccessToken,
        mutation: wireMutation,
      } = mutationWireSchema.parse(wireInput);
      const mutation = mutationSchema.parse(wireMutation);
      parsedMutation = mutation;
      const authentication = {
        runId: workflowRunId,
        accessToken: workflowAccessToken,
      };
      const common = {
        expectedRevision: mutation.expectedRevision,
        operationId: mutation.operationId,
      };
      const response = mutation.action === "update_study"
        ? await runtime.updateStudy(authentication, {
            ...common,
            study: mutation.study as StudyContextDraft,
          })
        : mutation.action === "update_shock"
          ? await runtime.updateShock(authentication, { ...common, ...mutation })
          : mutation.action === "resolve_shock"
            ? await runtime.resolveShock(authentication, common)
            : mutation.action === "display_identity"
              ? await runtime.displayCandidate(authentication, {
                  ...common,
                  candidateId: mutation.candidateId,
                })
              : mutation.action === "defer_identity"
                ? await runtime.deferCandidate(authentication, {
                    ...common,
                    candidateId: mutation.candidateId,
                    action: mutation.decision,
                    note: mutation.note,
                  })
                : mutation.action === "add_source"
                  ? await runtime.addSource(authentication, {
                      ...common,
                      sourceUrl: mutation.sourceUrl,
                    })
                  : mutation.action === "confirm_shock"
                    ? await runtime.confirmShock(authentication, {
                        ...common,
                        candidateId: mutation.candidateId,
                        displayedIdentityFingerprint:
                          mutation.displayedIdentityFingerprint,
                        sourceSnapshotId: mutation.sourceSnapshotId,
                        sourceSnapshotFingerprint:
                          mutation.sourceSnapshotFingerprint,
                        originalRequestFingerprint:
                          mutation.originalRequestFingerprint,
                        currentRequestFingerprint:
                          mutation.currentRequestFingerprint,
                        identityRevision: mutation.identityRevision,
                      })
                    : mutation.action === "research_policy"
                      ? await runtime.researchPolicy(authentication, {
                          ...common,
                          supportingEvidenceLeads:
                            mutation.supportingEvidenceLeads,
                        })
                      : mutation.action === "continue_policy_research"
                        ? await runtime.continuePolicyResearch(
                            authentication,
                            {
                              ...common,
                              supportingEvidenceLeads:
                                mutation.supportingEvidenceLeads,
                            },
                          )
                        : mutation.action === "begin_policy_event_card_review"
                          ? await runtime.beginPolicyEventCardReview(
                              authentication,
                              {
                                ...common,
                                revisionReason: mutation.revisionReason,
                              },
                            )
                          : mutation.action === "review_policy_event_card_claim"
                            ? await runtime.reviewPolicyEventCardClaim(
                                authentication,
                                {
                                  ...common,
                                  reviewId: mutation.reviewId,
                                  expectedReviewRevision:
                                    mutation.expectedReviewRevision,
                                  expectedReviewFingerprint:
                                    mutation.expectedReviewFingerprint,
                                  claimId: mutation.claimId,
                                  decision: mutation.decision,
                                  correctedStatement:
                                    mutation.correctedStatement,
                                  rationale: mutation.rationale,
                                },
                              )
                            : mutation.action === "decide_policy_treatment_clock"
                              ? await runtime.decidePolicyTreatmentClock(
                                  authentication,
                                  {
                                    ...common,
                                    reviewId: mutation.reviewId,
                                    expectedReviewRevision:
                                      mutation.expectedReviewRevision,
                                    expectedReviewFingerprint:
                                      mutation.expectedReviewFingerprint,
                                    decision: mutation.decision,
                                    rationale: mutation.rationale,
                                  },
                                )
                              : mutation.action === "lock_policy_event_card"
                                ? await runtime.lockPolicyEventCard(
                                    authentication,
                                    {
                                      ...common,
                                      reviewId: mutation.reviewId,
                                      expectedReviewRevision:
                                        mutation.expectedReviewRevision,
                                      expectedReviewFingerprint:
                                        mutation.expectedReviewFingerprint,
                                      rationale: mutation.rationale,
                                    },
                                  )
                                : mutation.action === "open_screen_3"
                                  ? await runtime.openScreen3(
                                      authentication,
                                      {
                                        ...common,
                                        study: mutation.study,
                                        proposedTiming:
                                          mutation.proposedTiming,
                                        clarifications:
                                          mutation.clarifications,
                                      },
                                    )
                                  : mutation.action ===
                                      "rebuild_screen3_guidance"
                                    ? await runtime.rebuildScreen3Guidance(
                                        authentication,
                                        {
                                          ...common,
                                          sourceOperationId:
                                            mutation.sourceOperationId,
                                          sourceInputFingerprint:
                                            mutation.sourceInputFingerprint,
                                        },
                                      )
                                  : mutation.action ===
                                      "refine_study_design_advice"
                                    ? await runtime.refineStudyDesignAdvice(
                                        authentication,
                                        {
                                          ...common,
                                          clarifications:
                                            mutation.clarifications,
                                        },
                                      )
                                  : mutation.action ===
                                      "personalize_screen3_advice"
                                    ? await runtime.personalizeScreen3(
                                        authentication,
                                        { ...common,
                                          expectedAdviceFingerprint:
                                            mutation.expectedAdviceFingerprint,
                                          retryUnknownAttemptId: mutation.retryUnknownAttemptId },
                                      )
                                  : mutation.action ===
                                      "renew_model_allowance"
                                    ? await runtime.renewModelAllowance(
                                        authentication,
                                        { ...common,
                                          acknowledgedByOwner:
                                            mutation.acknowledgedByOwner,
                                          allowanceWindow:
                                            mutation.allowanceWindow },
                                      )
                                  : mutation.action ===
                                      "decide_study_design_advice"
                                    ? await runtime.decideStudyDesignAdvice(
                                        authentication,
                                        {
                                          ...common,
                                          adviceId: mutation.adviceId,
                                          expectedAdviceFingerprint:
                                            mutation.expectedAdviceFingerprint,
                                          decision: mutation.decision,
                                          rationale: mutation.rationale,
                                        },
                                      )
                                  : mutation.action === "open_screen_4"
                                    ? await runtime.openScreen4(
                                        authentication,
                                        common,
                                      )
                                  : mutation.action ===
                                      "refresh_study_first_events"
                                    ? await runtime.refreshStudyFirstEvents(
                                        authentication,
                                        {
                                          ...common,
                                          expectedInvestigationFingerprint:
                                            mutation.expectedInvestigationFingerprint,
                                        },
                                      )
                                  : mutation.action ===
                                      "analyze_study_first_events"
                                    ? await runtime.analyzeStudyFirstEvents(
                                        authentication,
                                        {
                                          ...common,
                                          expectedInvestigationFingerprint:
                                            mutation.expectedInvestigationFingerprint,
                                        },
                                      )
                                  : mutation.action === "open_screen_5"
                                    ? await runtime.openScreen5(
                                        authentication,
                                        common,
                                      )
                                  : mutation.action ===
                                      "compare_study_first_mechanisms"
                                    ? await runtime
                                      .compareStudyFirstMechanisms(
                                        authentication,
                                        {
                                          ...common,
                                          theoreticalPerspective:
                                            mutation.theoreticalPerspective,
                                          proposedMechanism:
                                            mutation.proposedMechanism,
                                        },
                                      )
                                  : mutation.action ===
                                      "ensure_study_first_mechanism_job"
                                    ? await runtime
                                      .ensureStudyFirstMechanismJob(
                                        authentication,
                                        {
                                          ...common,
                                          expectedInputFingerprint:
                                            mutation.expectedInputFingerprint,
                                          expectedRunFingerprint:
                                            mutation.expectedRunFingerprint,
                                        },
                                      )
                                  : mutation.action ===
                                      "continue_study_first_mechanism_evidence"
                                    ? await runtime
                                      .continueStudyFirstMechanismEvidence(
                                        authentication,
                                        {
                                          ...common,
                                          planningTaskId:
                                            mutation.planningTaskId,
                                          planningResultId:
                                            mutation.planningResultId,
                                        },
                                      )
                                  : mutation.action ===
                                      "authorize_study_first_mechanism_job"
                                    ? await runtime
                                      .authorizeStudyFirstMechanismJob(
                                        authentication,
                                        {
                                          ...common,
                                          expectedExecutionFingerprint:
                                            mutation
                                              .expectedExecutionFingerprint,
                                        },
                                      )
                                  : mutation.action ===
                                      "advance_study_first_mechanism_job"
                                    ? await runtime
                                      .advanceStudyFirstMechanismJob(
                                        authentication,
                                        {
                                          ...common,
                                          retry: mutation.retry,
                                        },
                                      )
                                  : mutation.action === "open_screen_6"
                                    ? await runtime.openScreen6(
                                        authentication,
                                        common,
                                      )
                                  : mutation.action === "personalize_screen6_plan"
                                    ? await runtime.personalizeScreen6(
                                        authentication,
                                        { ...common,
                                          expectedPlanFingerprint:
                                            mutation.expectedPlanFingerprint },
                                      )
                                  : mutation.action ===
                                      "initialize_screen6_uncertainty_profile"
                                    ? await runtime
                                      .initializeScreen6UncertaintyProfile(
                                        authentication,
                                        common,
                                      )
                                  : mutation.action ===
                                      "save_screen6_diagnostic_plan"
                                    ? await runtime.saveScreen6DiagnosticPlan(
                                        authentication,
                                        {
                                          ...common,
                                          diagnosticInput:
                                            mutation.diagnosticInput,
                                        },
                                      )
                                  : mutation.action ===
                                      "record_screen6_diagnostic_result"
                                    ? await runtime
                                      .recordScreen6DiagnosticResult(
                                        authentication,
                                        {
                                          ...common,
                                          cardId: mutation.cardId,
                                          expectedPlanFingerprint:
                                            mutation.expectedPlanFingerprint,
                                          expectedCardFingerprint:
                                            mutation.expectedCardFingerprint,
                                          resultInput: mutation.resultInput,
                                        },
                                      )
                                  : mutation.action ===
                                      "review_screen6_diagnostic_result"
                                    ? await runtime
                                      .reviewScreen6DiagnosticResult(
                                        authentication,
                                        {
                                          ...common,
                                          resultId: mutation.resultId,
                                          expectedResultFingerprint:
                                            mutation
                                              .expectedResultFingerprint,
                                          decision: mutation.decision,
                                          rationale: mutation.rationale,
                                          followUpActions:
                                            mutation.followUpActions,
                                        },
                                      )
                                  : mutation.action ===
                                      "save_screen6_conditional_claim_boundary"
                                    ? await runtime
                                      .saveScreen6ConditionalClaimBoundary(
                                        authentication,
                                        {
                                          ...common,
                                          expectedPlanFingerprint:
                                            mutation.expectedPlanFingerprint,
                                          claimInput: mutation.claimInput,
                                        },
                                      )
                                  : mutation.action ===
                                      "record_screen6_research_planning_disposition"
                                    ? await runtime
                                      .recordScreen6ResearchPlanningDisposition(
                                        authentication,
                                        {
                                          ...common,
                                          expectedBoundaryFingerprint:
                                            mutation
                                              .expectedBoundaryFingerprint,
                                          decision: mutation.decision,
                                          rationale: mutation.rationale,
                                          specifiedRevisions:
                                            mutation.specifiedRevisions,
                                        },
                                      )
                                  : mutation.action ===
                                      "create_screen6_research_export"
                                    ? await runtime
                                      .createScreen6ResearchExport(
                                        authentication,
                                        {
                                          ...common,
                                          expectedDispositionFingerprint:
                                            mutation
                                              .expectedDispositionFingerprint,
                                        },
                                      )
                                  : mutation.action ===
                                      "build_causal_comparison"
                                    ? await runtime.buildCausalComparison(
                                        authentication,
                                        {
                                          ...common,
                                          comparisonInput:
                                            mutation.comparisonInput,
                                        },
                                      )
                                    : mutation.action ===
                                        "decide_causal_comparison"
                                      ? await runtime.decideCausalComparison(
                                          authentication,
                                          {
                                            ...common,
                                            designSetSnapshotId:
                                              mutation.designSetSnapshotId,
                                            expectedDesignSetFingerprint:
                                              mutation.expectedDesignSetFingerprint,
                                            decision: mutation.decision,
                                            rationale: mutation.rationale,
                                          },
                                        )
                                      : mutation.action ===
                                          "save_coevent_search_matrix"
                                        ? await runtime.saveCoEventSearchMatrix(
                                            authentication,
                                            {
                                              ...common,
                                              scopeInput: mutation.scopeInput,
                                            },
                                          )
                                        : mutation.action ===
                                            "save_mechanism_literature_plan"
                                          ? await runtime
                                            .saveMechanismLiteraturePlan(
                                              authentication,
                                              {
                                                ...common,
                                                planInput:
                                                  mutation.planInput,
                                              },
                                            )
                                        : mutation.action ===
                                            "continue_mechanism_literature_search"
                                          ? await runtime
                                            .continueMechanismLiteratureSearch(
                                              authentication,
                                              common,
                                            )
                                        : mutation.action ===
                                            "inspect_scholarly_document"
                                          ? await runtime
                                            .inspectScholarlyDocument(
                                              authentication,
                                              {
                                                ...common,
                                                inspectionInput:
                                                  mutation.inspectionInput,
                                              },
                                            )
                                        : mutation.action ===
                                            "extract_scholarly_claim"
                                          ? await runtime
                                            .extractScholarlyClaim(
                                              authentication,
                                              {
                                                ...common,
                                                passageId:
                                                  mutation.passageId,
                                                expectedPassageFingerprint:
                                                  mutation
                                                    .expectedPassageFingerprint,
                                                fields: mutation.fields,
                                              },
                                            )
                                        : mutation.action ===
                                            "review_scholarly_claim"
                                          ? await runtime
                                            .reviewScholarlyClaim(
                                              authentication,
                                              {
                                                ...common,
                                                extractionId:
                                                  mutation.extractionId,
                                                expectedExtractionFingerprint:
                                                  mutation
                                                    .expectedExtractionFingerprint,
                                                decision: mutation.decision,
                                                rationale:
                                                  mutation.rationale,
                                              },
                                            )
                                        : mutation.action ===
                                            "prepare_mechanism_synthesis_input"
                                          ? await runtime
                                            .prepareMechanismSynthesisInput(
                                              authentication,
                                              {
                                                ...common,
                                                expectedClaimPacketFingerprint:
                                                  mutation
                                                    .expectedClaimPacketFingerprint,
                                              },
                                            )
                                        : mutation.action ===
                                            "save_mechanism_review"
                                          ? await runtime.saveMechanismReview(
                                              authentication,
                                              {
                                                ...common,
                                                expectedSynthesisInputFingerprint:
                                                  mutation
                                                    .expectedSynthesisInputFingerprint,
                                                draft: mutation.draft,
                                              },
                                            )
                                        : mutation.action ===
                                            "review_coevent_occurrence"
                                          ? await runtime
                                            .reviewCoEventOccurrence(
                                              authentication,
                                              {
                                                ...common,
                                                candidateId:
                                                  mutation.candidateId,
                                                expectedCandidateFingerprint:
                                                  mutation
                                                    .expectedCandidateFingerprint,
                                                decision: mutation.decision,
                                                rationale: mutation.rationale,
                                              },
                                            )
                                        : mutation.action ===
                                            "review_coevent_relation"
                                          ? await runtime
                                            .reviewCoEventRelation(
                                              authentication,
                                              {
                                                ...common,
                                                candidateId:
                                                  mutation.candidateId,
                                                expectedCandidateFingerprint:
                                                  mutation
                                                    .expectedCandidateFingerprint,
                                                expectedOccurrenceReviewId:
                                                  mutation
                                                    .expectedOccurrenceReviewId,
                                                expectedOccurrenceReviewFingerprint:
                                                  mutation
                                                    .expectedOccurrenceReviewFingerprint,
                                                decision: mutation.decision,
                                                rationale: mutation.rationale,
                                              },
                                            )
                                        : mutation.action ===
                                            "review_coevent_duplicate_pair"
                                          ? await runtime
                                            .reviewCoEventDuplicatePair(
                                              authentication,
                                              {
                                                ...common,
                                                leftCandidateId:
                                                  mutation.leftCandidateId,
                                                leftCandidateFingerprint:
                                                  mutation
                                                    .leftCandidateFingerprint,
                                                rightCandidateId:
                                                  mutation.rightCandidateId,
                                                rightCandidateFingerprint:
                                                  mutation
                                                    .rightCandidateFingerprint,
                                                decision: mutation.decision,
                                                rationale: mutation.rationale,
                                              },
                                            )
                                        : mutation.action ===
                                            "route_coevent_policy_stage_to_screen_2"
                                          ? await runtime
                                            .routeCoEventPolicyStageToScreen2(
                                              authentication,
                                              {
                                                ...common,
                                                candidateId:
                                                  mutation.candidateId,
                                                expectedCandidateFingerprint:
                                                  mutation
                                                    .expectedCandidateFingerprint,
                                                expectedOccurrenceReviewId:
                                                  mutation
                                                    .expectedOccurrenceReviewId,
                                                expectedOccurrenceReviewFingerprint:
                                                  mutation
                                                    .expectedOccurrenceReviewFingerprint,
                                                stageKind: mutation.stageKind,
                                                rationale: mutation.rationale,
                                              },
                                            )
                                        : mutation.action ===
                                            "acquire_policy_lifecycle_stage_document"
                                          ? await runtime
                                            .acquirePolicyLifecycleStageDocument(
                                              authentication,
                                              {
                                                ...common,
                                                handoffId: mutation.handoffId,
                                                expectedHandoffFingerprint:
                                                  mutation
                                                    .expectedHandoffFingerprint,
                                              },
                                            )
                                        : mutation.action ===
                                            "review_policy_lifecycle_stage_document"
                                          ? await runtime
                                            .reviewPolicyLifecycleStageDocument(
                                              authentication,
                                              {
                                                ...common,
                                                handoffId: mutation.handoffId,
                                                expectedHandoffFingerprint:
                                                  mutation
                                                    .expectedHandoffFingerprint,
                                                acquisitionId:
                                                  mutation.acquisitionId,
                                                expectedAcquisitionFingerprint:
                                                  mutation
                                                    .expectedAcquisitionFingerprint,
                                                decision: mutation.decision,
                                                rationale: mutation.rationale,
                                              },
                                            )
                                        : mutation.action ===
                                            "propose_policy_lifecycle_stage_revision"
                                          ? await runtime
                                            .proposePolicyLifecycleStageRevision(
                                              authentication,
                                              {
                                                ...common,
                                                handoffId: mutation.handoffId,
                                                expectedHandoffFingerprint:
                                                  mutation
                                                    .expectedHandoffFingerprint,
                                                dispositionId:
                                                  mutation.dispositionId,
                                                expectedDispositionFingerprint:
                                                  mutation
                                                    .expectedDispositionFingerprint,
                                                chronologyStage:
                                                  mutation.chronologyStage,
                                                sourceDateId:
                                                  mutation.sourceDateId,
                                                rationale: mutation.rationale,
                                              },
                                            )
                                        : mutation.action ===
                                            "review_policy_lifecycle_stage_revision"
                                          ? await runtime
                                            .reviewPolicyLifecycleStageRevision(
                                              authentication,
                                              {
                                                ...common,
                                                proposalId:
                                                  mutation.proposalId,
                                                expectedProposalFingerprint:
                                                  mutation
                                                    .expectedProposalFingerprint,
                                                decision: mutation.decision,
                                                rationale: mutation.rationale,
                                              },
                                            )
                                        : mutation.action ===
                                            "continue_coevent_search"
                                          ? await runtime
                                            .continueCoEventSearch(
                                              authentication,
                                              common,
                                            )
                                        : await runtime.openScreen2(
                                            authentication,
                                            common,
                                          );
      runtimeCompleted = true;
      committedRevision = response.privateSnapshot.revision;
      return result(
        response.projection,
        response.privateSnapshot,
        response.projection.statusMessage,
        {
          toolName: "mutate_six_screen_workflow_v1",
          operationStage: `mutation:${mutation.action}`,
          operationBinding: sixScreenWorkflowMutationRequestBinding(
            mutation,
          ),
        },
        "mutationOutcome" in response &&
            (response.mutationOutcome === "changed" ||
              response.mutationOutcome === "unchanged" ||
              response.mutationOutcome === "replayed")
          ? response.mutationOutcome
          : undefined,
        options.resultMetadata?.(),
      );
      } catch (error) {
        const context = mutationProblemContext(
          parsedMutation ?? rawMutation,
        );
        const safeError = runtimeCompleted &&
            !(error instanceof SixScreenWorkflowProblemError)
          ? new SixScreenWorkflowProblemError(
              createSixScreenWorkflowProblem({
                code: "response_contract",
                ...context,
                actualRevision: committedRevision,
                commitCertainty: "committed",
                dispatchCertainty: completedMutationDispatchCertainty(
                  context.action,
                ),
                safeCauseCodes: ["response_contract_invalid"],
                fieldIssues: classifySixScreenWorkflowProblem(error)?.fieldIssues,
              }),
            )
          : error;
        return sixScreenWorkflowProblemToolResult(safeError, context);
      }
    },
  );
}

export function isSixScreenWorkflowPrivateSnapshot(
  value: unknown,
): value is SixScreenWorkflowPrivateSnapshot {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const snapshot = value as Partial<SixScreenWorkflowPrivateSnapshot>;
  return snapshot.schemaVersion === SIX_SCREEN_WORKFLOW_PRIVATE_SCHEMA_VERSION &&
    typeof snapshot.runId === "string" && runId.safeParse(snapshot.runId).success &&
    typeof snapshot.accessToken === "string" &&
    accessToken.safeParse(snapshot.accessToken).success &&
    Number.isSafeInteger(snapshot.revision) &&
    typeof snapshot.stateFingerprint === "string" &&
    typeof snapshot.state === "object" && snapshot.state !== null;
}
