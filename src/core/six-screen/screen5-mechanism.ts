import { fingerprintSixScreenValue } from "./canonical";
import { LOCAL_MODEL_ALLOWANCE_DEFAULTS, modelTaskProfile } from
  "./model-task-profiles";
import type {
  StudyFirstMechanismPlan,
  StudyFirstScholarlyWork,
} from "./study-first-mechanism-comparison";
import {
  HISTORICAL_OPENAI_SCREEN5_COMPARISON_VERSION,
  HISTORICAL_OPENAI_SCREEN5_EXECUTION_VERSION,
  HISTORICAL_SCREEN5_ASSESSMENT_BATCH_PLAN_VERSION,
  HISTORICAL_SCREEN5_COMPARISON_INPUT_CEILING,
  HISTORICAL_SCREEN5_COMPARISON_OUTPUT_CEILING,
  HISTORICAL_SCREEN5_COMPARISON_PROMPT_VERSION,
  HISTORICAL_SCREEN5_COMPARISON_RESERVED_TOKENS,
  HISTORICAL_SCREEN5_COMPARISON_VERSION,
  HISTORICAL_SCREEN5_COMPARISON_WIRE_VERSION,
  HISTORICAL_SCREEN5_EVIDENCE_PACKET_VERSION,
  HISTORICAL_SCREEN5_EXECUTION_VERSION,
  HISTORICAL_SCREEN5_JOB_AUTHORIZATION_VERSION,
  HISTORICAL_SCREEN5_MAX_ATTEMPTS,
  HISTORICAL_SCREEN5_MAX_TOKENS,
  HISTORICAL_SCREEN5_MODEL,
  HISTORICAL_SCREEN5_PILOT_ID,
  HISTORICAL_SCREEN5_PLAN_INPUT_CEILING,
  HISTORICAL_SCREEN5_PLAN_OUTPUT_CEILING,
  HISTORICAL_SCREEN5_PLAN_PROMPT_VERSION,
  HISTORICAL_SCREEN5_PLAN_RESERVED_TOKENS,
  HISTORICAL_SCREEN5_PLAN_WIRE_VERSION,
  HISTORICAL_SCREEN5_PROVIDER,
  HISTORICAL_SCREEN5_PROVIDER_RECEIPT_VERSION,
  HISTORICAL_SCREEN5_V1_COMPARISON_PROMPT_VERSION,
  HISTORICAL_SCREEN5_V1_COMPARISON_VERSION,
  HISTORICAL_SCREEN5_V1_COMPARISON_WIRE_VERSION,
  HISTORICAL_SCREEN5_V1_PLAN_PROMPT_VERSION,
  HISTORICAL_SCREEN5_V1_PLAN_WIRE_VERSION,
  HISTORICAL_SCREEN5_V2_COMPARISON_PROMPT_VERSION,
  HISTORICAL_SCREEN5_V2_COMPARISON_VERSION,
  HISTORICAL_SCREEN5_V2_COMPARISON_WIRE_VERSION,
} from "./screen5-historical-record";

/** Fixed current ShockAudit inference policy. */
export const SCREEN5_OPENAI_PROVIDER = "openai" as const;
export const SCREEN5_OPENAI_MODEL = "gpt-6-luna" as const;
export const SCREEN5_OPENAI_REASONING_EFFORT = "medium" as const;
export const SCREEN5_OPENAI_SERVICE_TIER = "default" as const;
export const SCREEN5_OPENAI_POLICY = Object.freeze({
  provider: SCREEN5_OPENAI_PROVIDER,
  model: SCREEN5_OPENAI_MODEL,
  reasoningEffort: SCREEN5_OPENAI_REASONING_EFFORT,
  serviceTier: SCREEN5_OPENAI_SERVICE_TIER,
  storeResponse: false,
});
export const SCREEN5_OPENAI_ADAPTER_VERSION =
  "screen-05-openai-responses-adapter-v1" as const;
export const SCREEN5_OPENAI_PILOT_ID =
  "screen5-openai-luna-standard-v1" as const;
export const SCREEN5_OPENAI_EXECUTION_VERSION =
  "screen-05-openai-execution-v4" as const;
export const PREVIOUS_SCREEN5_OPENAI_EXECUTION_VERSION =
  "screen-05-openai-execution-v3" as const;
export const SCREEN5_OPENAI_COMPARISON_VERSION =
  "screen-05-openai-mechanism-comparison-v5" as const;
export const SCREEN5_OPENAI_PROVIDER_RECEIPT_VERSION =
  "screen-05-openai-provider-receipt-v1" as const;
export const SCREEN5_OPENAI_JOB_AUTHORIZATION_VERSION =
  "screen-05-openai-job-authorization-v1" as const;
export const SCREEN5_MECHANISM_EVIDENCE_PACKET_VERSION =
  "screen-05-mechanism-evidence-packet-v2" as const;
export const SCREEN5_MECHANISM_ASSESSMENT_BATCH_PLAN_VERSION =
  "screen-05-mechanism-assessment-batch-plan-v2" as const;
export const SCREEN5_MECHANISM_PLAN_WIRE_VERSION =
  "screen-05-mechanism-plan-wire-v5" as const;
export const PREVIOUS_SCREEN5_MECHANISM_PLAN_WIRE_VERSION =
  "screen-05-mechanism-plan-wire-v4" as const;
export const EARLIER_SCREEN5_MECHANISM_PLAN_WIRE_VERSION =
  "screen-05-mechanism-plan-wire-v3" as const;
export const SCREEN5_MECHANISM_COMPARISON_WIRE_VERSION =
  "screen-05-mechanism-assessment-batch-wire-v4" as const;
export const SCREEN5_MECHANISM_PLAN_PROMPT_VERSION =
  "shockaudit-screen5-plan-v5" as const;
export const PREVIOUS_SCREEN5_MECHANISM_PLAN_PROMPT_VERSION =
  "shockaudit-screen5-plan-v4" as const;
export const EARLIER_SCREEN5_MECHANISM_PLAN_PROMPT_VERSION =
  "shockaudit-screen5-plan-v3" as const;
export const SCREEN5_MECHANISM_COMPARISON_PROMPT_VERSION =
  "shockaudit-screen5-comparison-v3" as const;
export const SCREEN5_MECHANISM_MAX_ADDITIONAL_MECHANISMS = 10;
export const SCREEN5_MECHANISM_MAX_CARDS = 11;
export const SCREEN5_MECHANISM_MAX_ASSESSMENT_BATCHES = 5;
export const SCREEN5_MECHANISM_PREFERRED_BATCH_SIZE = 2;
// A bounded structured response can contain escaped Unicode and many fields.
// This private receipt cap is separate from the small public projection.
export const SCREEN5_MECHANISM_RECEIPT_CONTENT_MAX_BYTES = 512_000;
export const SCREEN5_MECHANISM_MAX_VALIDATION_ISSUES = 12;

// Responses max_output_tokens includes hidden reasoning and visible output.
// These reservations preserve every scientific batch while bounding a full
// configured run and its persistent OpenAI ledger.
export const SCREEN5_OPENAI_MAX_ATTEMPTS =
  LOCAL_MODEL_ALLOWANCE_DEFAULTS.maximumDispatchedAttempts;
export const SCREEN5_OPENAI_MAX_TOKENS = LOCAL_MODEL_ALLOWANCE_DEFAULTS.maximumTokens;
export const SCREEN5_OPENAI_PLAN_RESERVED_TOKENS =
  modelTaskProfile("screen5_mechanism_proposal").reservationTokens;
export const SCREEN5_OPENAI_COMPARISON_RESERVED_TOKENS =
  modelTaskProfile("screen5_evidence_assessment").reservationTokens;
export const SCREEN5_OPENAI_PLAN_INPUT_CEILING =
  modelTaskProfile("screen5_mechanism_proposal").inputCeiling;
export const SCREEN5_OPENAI_COMPARISON_INPUT_CEILING =
  modelTaskProfile("screen5_evidence_assessment").inputCeiling;
export const SCREEN5_OPENAI_PLAN_OUTPUT_CEILING =
  modelTaskProfile("screen5_mechanism_proposal").outputCeiling;
export const SCREEN5_OPENAI_COMPARISON_OUTPUT_CEILING =
  modelTaskProfile("screen5_evidence_assessment").outputCeiling;
const PREVIOUS_OPENAI_LIMITS = Object.freeze({
  maximumAttempts: 12, maximumTokens: 200_000,
  planReserved: 14_000, assessmentReserved: 24_000,
  planInput: 2_000, assessmentInput: 4_000,
  planOutput: 12_000, assessmentOutput: 20_000,
});

export type Screen5MechanismValidationIssue = {
  code: string;
  path: string;
  stage?: "planning" | "assessment";
  contractVersion?: string;
  validationRevision?: string;
  expectedType?: string;
  actualType?: string;
  max?: number;
  observedCountOrLength?: number;
};

export type Screen5MechanismProviderReceipt = {
  schemaVersion:
    | typeof HISTORICAL_SCREEN5_PROVIDER_RECEIPT_VERSION
    | typeof SCREEN5_OPENAI_PROVIDER_RECEIPT_VERSION;
  status: "received" | "schema_valid" | "quarantined" | "aggregate_saved";
  receivedAt: string;
  httpStatus: number;
  providerRequestId: string | null;
  /** Responses API object id; absent only on legacy Groq receipts. */
  providerResponseId?: string | null;
  /** Actual processing tier reported by OpenAI; absent on legacy receipts. */
  serviceTier?: string | null;
  /** Measured adapter latency; absent on legacy receipts. */
  latencyMs?: number | null;
  modelObserved: string;
  finishReason: string;
  usage: Screen5MechanismUsage;
  rateLimit: Screen5MechanismRateLimit;
  finalContent: string;
  contentFingerprint: string;
  validationIssues: Screen5MechanismValidationIssue[];
  wireFingerprint: string | null;
};

export type Screen5MechanismPlanWire = {
  focal_citations: Screen5SuggestedCitationWire[];
  candidates: Array<{
    candidate_id: string;
    concept: string;
    chain: string[];
    difference: string;
    condition: string;
    direction?: Screen5ProposedDirectionWire;
    evidence_need: string;
    terms: string[];
    citations: Screen5SuggestedCitationWire[];
  }>;
  open_xy_terms: string[];
  challenge_terms: string[];
  qualification: string;
};

export type Screen5SuggestedCitationWire = {
  authors: string[];
  year: number;
  title: string;
  venue: string;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  doi: string | null;
  url: string | null;
  full_citation: string;
  supports: string;
};

/** Optional only when reading a planning response saved before wire v4. */
export type Screen5ProposedDirectionWire = {
  mode: "single_hypothesis" | "conditional_scenarios" | "under_specified";
  target_outcome: string;
  target_measure: string | null;
  scenarios: Array<{
    sign: "positive" | "negative";
    condition: string;
    rationale: string;
    intermediate_movement: string;
    horizon: string | null;
  }>;
  missing_assumption: string | null;
};

export type Screen5MechanismComparisonWire = {
  mechanisms: Array<{
    candidate_id: string;
    concept: string;
    relation:
      | "focal"
      | "competing"
      | "complementary"
      | "offsetting"
      | "uncertain";
    chain: string[];
    direction: {
      mechanism_response:
        | "increase"
        | "decrease"
        | "mixed"
        | "uncertain"
        | "not_specified";
      outcome_implication:
        | "increase"
        | "decrease"
        | "mixed"
        | "uncertain"
        | "not_specified";
      basis:
        | "researcher_proposed"
        | "source_explicit"
        | "analyst_inference"
        | "not_specified";
      condition: string;
    };
    argument: Array<{
      text: string;
      evidence_ids: string[];
      basis:
        | "inspected_proposition"
        | "study_transfer"
        | "analytical_hypothesis";
    }>;
    fit: string;
    limit: string;
    theory: string | null;
    theory_basis:
      | "not_assigned"
      | "researcher_supplied"
      | "source_explicit"
      | "analyst_suggested";
  }>;
  row_definitions: Array<{
    row_id: string;
    observation: string;
    measure: string;
    level: string;
    timing: string;
    caution: string;
  }>;
  cells: Array<{
    row_id: string;
    candidate_id: string;
    status:
      | "prediction"
      | "shared_implication"
      | "not_distinguishing"
      | "insufficient_evidence"
      | "not_assessed";
    text: string;
    evidence_ids: string[];
  }>;
  dispositions: Array<{
    candidate_id: string;
    status:
      | "retained"
      | "qualified"
      | "merged"
      | "excluded"
      | "not_supported_for_study"
      | "hypothesis_only"
      | "unassessed_evidence"
      | "unassessed_budget";
    reason: string;
    merged_into: string | null;
  }>;
  summary: string;
  gaps: string[];
};

export type Screen5MechanismLegacyPlanWire = {
  candidates: Array<{
    concept: string;
    chain: string[];
    difference: string;
    evidence_need: string;
    terms: string[];
  }>;
  open_xy_terms: string[];
  challenge_terms: string[];
  qualification: string;
};

export type Screen5MechanismLegacyComparisonWire = {
  mechanisms: Array<{
    concept: string;
    relation: "focal" | "competing" | "complementary" | "offsetting" |
      "uncertain";
    chain: string[];
    argument: Array<{ text: string; evidence_ids: string[] }>;
    fit: string;
    limit: string;
    theory: string | null;
    theory_basis: "not_assigned" | "researcher_supplied" |
      "source_explicit" | "analyst_suggested";
  }>;
  predictions: Array<{
    observation: string;
    measure: string;
    level: string;
    timing: string;
    patterns: string[];
    caution: string;
  }>;
  summary: string;
  gaps: string[];
};

export type Screen5MechanismUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  reasoningTokens: number | null;
  cachedPromptTokens: number | null;
};

export type Screen5MechanismRateLimit = {
  retryAfterAt: string | null;
  tokenResetAt: string | null;
  remainingTokens: number | null;
};

export type Screen5MechanismBudgetSnapshot = {
  policyMode?: "bounded" | "reviewer" | "unlimited";
  accountingVersion?: "persistent-v3";
  lastRenewalId?: string;
  lastRenewalWindow?: "standard" | "extended" | "reviewer";
  pilotId: typeof HISTORICAL_SCREEN5_PILOT_ID | typeof SCREEN5_OPENAI_PILOT_ID;
  maximumAttempts: number;
  maximumTokens: number;
  attemptsReserved: number;
  attemptsSettled: number;
  attemptsHeld: number;
  tokensConsumed: number;
  tokensHeld: number;
  tokensCommitted: number;
  remainingAttempts: number;
  remainingTokens: number;
};

export type Screen5MechanismEvidencePacket = {
  schemaVersion:
    | typeof SCREEN5_MECHANISM_EVIDENCE_PACKET_VERSION
    | typeof HISTORICAL_SCREEN5_EVIDENCE_PACKET_VERSION;
  id: string;
  planFingerprint: string;
  entries: Array<{
    evidenceId: string;
    workId: string;
    title: string;
    authors: string[];
    publicationYear: number | null;
    publicationVenue: string | null;
    citationLabel: string;
    inspectedText: string;
    accessLevel: "abstract_inspected";
    sourceRole: "scholarly_abstract" | "scholarly_excerpt";
    sourceRepresentation:
      | "openalex_abstract_inverted_index"
      | "crossref_member_deposit"
      | "frozen_primary_excerpt";
    stableLocators: string[];
    claimBoundary: string;
    setting: string | null;
  }>;
  coverage: {
    selectedWorkCount: number;
    availableInspectedWorkCount: number;
    metadataOnlyWorkCount: number;
    limitation: string;
  };
  /**
   * Search coverage, not a support judgment. Optional only on packets saved
   * before the v13 assessment contract.
   */
  coverageMap?: Array<{
    candidateId: string | null;
    evidenceNeedIds: string[];
    queryIds: string[];
    inspectedEvidenceIds: string[];
    disposition: "inspected_candidate_passage" | "no_selected_passage";
  }>;
  createdAt: string;
  packetFingerprint: string;
};

export type Screen5MechanismAssessmentBatchPlan = {
  schemaVersion:
    | typeof SCREEN5_MECHANISM_ASSESSMENT_BATCH_PLAN_VERSION
    | typeof HISTORICAL_SCREEN5_ASSESSMENT_BATCH_PLAN_VERSION;
  scientificBundleFingerprint: string;
  batches: Array<{
    id: string;
    index: number;
    candidateIds: string[];
    includeFocal: boolean;
  }>;
};

export type Screen5MechanismComparison = {
  schemaVersion:
    | typeof SCREEN5_OPENAI_COMPARISON_VERSION
    | typeof HISTORICAL_OPENAI_SCREEN5_COMPARISON_VERSION
    | typeof HISTORICAL_SCREEN5_COMPARISON_VERSION
    | typeof HISTORICAL_SCREEN5_V2_COMPARISON_VERSION
    | typeof HISTORICAL_SCREEN5_V1_COMPARISON_VERSION;
  id: string;
  problemFingerprint: string;
  planFingerprint: string;
  evidencePacketFingerprint: string;
  provider: typeof HISTORICAL_SCREEN5_PROVIDER | typeof SCREEN5_OPENAI_PROVIDER;
  modelRequested: typeof HISTORICAL_SCREEN5_MODEL | typeof SCREEN5_OPENAI_MODEL;
  modelObserved: string;
  promptVersion:
    | typeof SCREEN5_MECHANISM_COMPARISON_PROMPT_VERSION
    | typeof HISTORICAL_SCREEN5_V2_COMPARISON_PROMPT_VERSION
    | typeof HISTORICAL_SCREEN5_V1_COMPARISON_PROMPT_VERSION;
  wireVersion:
    | typeof SCREEN5_MECHANISM_COMPARISON_WIRE_VERSION
    | typeof HISTORICAL_SCREEN5_COMPARISON_WIRE_VERSION
    | typeof HISTORICAL_SCREEN5_V2_COMPARISON_WIRE_VERSION
    | typeof HISTORICAL_SCREEN5_V1_COMPARISON_WIRE_VERSION;
  mechanisms: Array<{
    id: string;
    /** Stable admitted ID. Absent only on legacy one-response results. */
    candidateId?: string;
    concept: string;
    relation:
      | "focal"
      | "competing"
      | "complementary"
      | "offsetting"
      | "uncertain";
    chain: string[];
    direction?: {
      mechanismResponse:
        | "increase"
        | "decrease"
        | "mixed"
        | "uncertain"
        | "not_specified";
      outcomeImplication:
        | "increase"
        | "decrease"
        | "mixed"
        | "uncertain"
        | "not_specified";
      basis:
        | "researcher_proposed"
        | "source_explicit"
        | "analyst_inference"
        | "not_specified";
      condition: string;
    };
    argument: Array<{
      text: string;
      evidenceIds: string[];
      citations: string[];
      supportStatus: "source_linked" | "analytical_hypothesis";
      /** Explicit scientific role. Absent only on v1/v2 saved results. */
      basis?:
        | "inspected_proposition"
        | "study_transfer"
        | "analytical_hypothesis";
    }>;
    /** Server-derived from explicit bases and disposition, never citation count alone. */
    support?:
      | "component_supported"
      | "analogous_setting"
      | "partly_supported"
      | "hypothesis_only"
      | "materially_contested";
    sourceCheckStatus?:
      | "checked_relevant_text"
      | "checked_no_relevant_match"
      | "text_unavailable"
      | "not_checked_due_budget";
    fit: string;
    limit: string;
    theory: string | null;
    theoryBasis:
      | "not_assigned"
      | "researcher_supplied"
      | "source_explicit"
      | "analyst_suggested";
  }>;
  predictions: Array<{
    id: string;
    observation: string;
    measure: string;
    level: string;
    timing: string;
    patterns: Array<{
      mechanismId: string;
      detail: string;
      status?:
        | "prediction"
        | "shared_implication"
        | "not_distinguishing"
        | "insufficient_evidence"
        | "not_assessed";
      evidenceIds?: string[];
      citations?: string[];
    }>;
    caution: string;
  }>;
  summary: string;
  gaps: string[];
  dispositions?: Array<{
    candidateId: string;
    status:
      | "retained"
      | "qualified"
      | "merged"
      | "excluded"
      | "not_supported_for_study"
      | "hypothesis_only"
      | "unassessed_evidence"
      | "unassessed_budget";
    reason: string;
    mergedInto: string | null;
  }>;
  batchSummaries?: Array<{
    batchId: string;
    candidateIds: string[];
    summary: string;
  }>;
  completion?: {
    status: "partial" | "completed";
    admittedAdditionalCount: number;
    disposedAdditionalCount: number;
    completedBatchCount: number;
    totalBatchCount: number;
  };
  bibliography: Screen5MechanismEvidencePacket["entries"];
  createdAt: string;
  comparisonFingerprint: string;
};

export type Screen5MechanismAttempt = {
  id: string;
  stage: "planning" | "assessment";
  ordinal: number;
  status:
    | "reserved"
    | "running"
    | "succeeded"
    | "failed"
    | "outcome_unknown";
  reservedTokens: number;
  estimatedInputTokens: number;
  maxCompletionTokens: number;
  startedAt: string;
  completedAt: string | null;
  providerRequestId: string | null;
  providerResponseId?: string | null;
  serviceTier?: string | null;
  latencyMs?: number | null;
  modelRequested: typeof HISTORICAL_SCREEN5_MODEL | typeof SCREEN5_OPENAI_MODEL;
  modelObserved: string | null;
  finishReason: string | null;
  usage: Screen5MechanismUsage | null;
  rateLimit: Screen5MechanismRateLimit | null;
  errorCode: string | null;
  retryable: boolean;
  /** Safe transport diagnostics; absent only on records saved before v12. */
  failureStage?:
    | "local_configuration"
    | "admission"
    | "network"
    | "response_headers"
    | "response_body"
    | "model_output"
    | "persistence"
    | "projection";
  networkInvocation?: "not_started" | "invoked" | "unknown";
  providerResponse?: "not_observed" | "observed";
  httpStatus?: number | null;
  safeCause?: string | null;
  /** Safe ticket identifier only; never a credential or signed capability. */
  authorizationId?: string | null;
  /** Present on v13 assessment attempts; absent on legacy single-B records. */
  assessmentBatchId?: string | null;
  assessmentBatchIndex?: number | null;
  /** Exact immutable evidence manifest admitted to this outgoing request. */
  evidenceIds?: string[];
  /** Inspected packet entries omitted only by the bounded request budget. */
  omittedEvidenceIds?: string[];
  /** Protected final-message receipt saved before local validation or merge. */
  responseReceipt?: Screen5MechanismProviderReceipt | null;
  /** Earlier safe validation diagnoses survive a compatible local replay. */
  validationHistory?: Screen5MechanismValidationIssue[][];
  wireCheckpoint:
    | {
        kind: "planning";
        version:
          | typeof SCREEN5_MECHANISM_PLAN_WIRE_VERSION
          | typeof PREVIOUS_SCREEN5_MECHANISM_PLAN_WIRE_VERSION
          | typeof EARLIER_SCREEN5_MECHANISM_PLAN_WIRE_VERSION
          | typeof HISTORICAL_SCREEN5_PLAN_WIRE_VERSION
          | typeof HISTORICAL_SCREEN5_V1_PLAN_WIRE_VERSION;
        value: Screen5MechanismPlanWire | Screen5MechanismLegacyPlanWire;
        fingerprint: string;
      }
    | {
        kind: "assessment";
        version:
          | typeof SCREEN5_MECHANISM_COMPARISON_WIRE_VERSION
          | typeof HISTORICAL_SCREEN5_COMPARISON_WIRE_VERSION
          | typeof HISTORICAL_SCREEN5_V2_COMPARISON_WIRE_VERSION
          | typeof HISTORICAL_SCREEN5_V1_COMPARISON_WIRE_VERSION;
        value: Screen5MechanismComparisonWire | Screen5MechanismLegacyComparisonWire;
        fingerprint: string;
      }
    | null;
};

export type Screen5MechanismJobAuthorization = {
  schemaVersion:
    | typeof HISTORICAL_SCREEN5_JOB_AUTHORIZATION_VERSION
    | typeof SCREEN5_OPENAI_JOB_AUTHORIZATION_VERSION;
  /** Safe audit identifier only; never a credential or signed capability. */
  authorizationId: string;
  jobId: string;
  stages: Array<"planning" | "assessment">;
  /** Exact next B batch for assessment-only grants. Null/absent is legacy. */
  assessmentBatchId?: string | null;
  source: "authenticated_screen5_action";
  grantedAt: string;
};

export type Screen5MechanismExecutionPhase =
  | "planning_queued"
  | "planning_running"
  | "plan_ready"
  | "retrieving"
  | "evidence_ready"
  | "waiting_for_rate_limit"
  | "assessment_running"
  | "assessment_partial"
  | "validating"
  | "completed"
  | "configuration_required"
  | "failed"
  | "outcome_unknown"
  | "blocked"
  | "superseded";

export type Screen5MechanismExecution = {
  schemaVersion:
    | typeof HISTORICAL_SCREEN5_EXECUTION_VERSION
    | typeof HISTORICAL_OPENAI_SCREEN5_EXECUTION_VERSION
    | typeof PREVIOUS_SCREEN5_OPENAI_EXECUTION_VERSION
    | typeof SCREEN5_OPENAI_EXECUTION_VERSION;
  id: string;
  provider: typeof HISTORICAL_SCREEN5_PROVIDER | typeof SCREEN5_OPENAI_PROVIDER;
  modelRequested: typeof HISTORICAL_SCREEN5_MODEL | typeof SCREEN5_OPENAI_MODEL;
  pilotId: typeof HISTORICAL_SCREEN5_PILOT_ID | typeof SCREEN5_OPENAI_PILOT_ID;
  phase: Screen5MechanismExecutionPhase;
  problemFingerprint: string;
  inputFingerprint: string;
  planPromptVersion:
    | typeof SCREEN5_MECHANISM_PLAN_PROMPT_VERSION
    | typeof PREVIOUS_SCREEN5_MECHANISM_PLAN_PROMPT_VERSION
    | typeof EARLIER_SCREEN5_MECHANISM_PLAN_PROMPT_VERSION
    | typeof HISTORICAL_SCREEN5_PLAN_PROMPT_VERSION
    | typeof HISTORICAL_SCREEN5_V1_PLAN_PROMPT_VERSION;
  comparisonPromptVersion:
    | typeof SCREEN5_MECHANISM_COMPARISON_PROMPT_VERSION
    | typeof HISTORICAL_SCREEN5_V2_COMPARISON_PROMPT_VERSION
    | typeof HISTORICAL_SCREEN5_V1_COMPARISON_PROMPT_VERSION;
  planWireVersion:
    | typeof SCREEN5_MECHANISM_PLAN_WIRE_VERSION
    | typeof PREVIOUS_SCREEN5_MECHANISM_PLAN_WIRE_VERSION
    | typeof EARLIER_SCREEN5_MECHANISM_PLAN_WIRE_VERSION
    | typeof HISTORICAL_SCREEN5_PLAN_WIRE_VERSION
    | typeof HISTORICAL_SCREEN5_V1_PLAN_WIRE_VERSION;
  comparisonWireVersion:
    | typeof SCREEN5_MECHANISM_COMPARISON_WIRE_VERSION
    | typeof HISTORICAL_SCREEN5_COMPARISON_WIRE_VERSION
    | typeof HISTORICAL_SCREEN5_V2_COMPARISON_WIRE_VERSION
    | typeof HISTORICAL_SCREEN5_V1_COMPARISON_WIRE_VERSION;
  settings: {
    reasoningEffort: "medium";
    includeReasoning: false;
    stream: false;
    /** Required on current OpenAI executions; absent on legacy Groq records. */
    serviceTier?: "default";
    store?: false;
    adapterVersion?: typeof SCREEN5_OPENAI_ADAPTER_VERSION;
    planInputCeiling: number;
    planCompletionCeiling: number;
    comparisonInputCeiling: number;
    comparisonCompletionCeiling: number;
  };
  /**
   * Optional for compatibility with jobs saved before in-tool authorization.
   * Revised scientific input receives a new job and no inherited receipt.
   */
  authorization?: Screen5MechanismJobAuthorization | null;
  attempts: Screen5MechanismAttempt[];
  budgetSnapshot: Screen5MechanismBudgetSnapshot | null;
  evidencePacket: Screen5MechanismEvidencePacket | null;
  /** Deterministic bounded B scope. Absent on valid legacy executions. */
  assessmentBatchPlan?: Screen5MechanismAssessmentBatchPlan | null;
  comparison: Screen5MechanismComparison | null;
  nextEligibleAt: string | null;
  retryCount: number;
  lastError: null | {
    stage: "configuration" | "planning" | "retrieval" | "assessment" |
      "validation";
    code: string;
    message: string;
    retryable: boolean;
    occurredAt: string;
    failureStage?: Screen5MechanismAttempt["failureStage"];
    networkInvocation?: Screen5MechanismAttempt["networkInvocation"];
    providerResponse?: Screen5MechanismAttempt["providerResponse"];
    httpStatus?: number | null;
    safeCause?: string | null;
  };
  createdAt: string;
  updatedAt: string;
  executionFingerprint: string;
};

function bodyWithoutFingerprint<T extends Record<string, unknown>>(
  value: T,
  key: keyof T,
) {
  const clone = structuredClone(value);
  delete clone[key];
  return clone;
}

function canonicalIso(value: string) {
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) &&
    new Date(milliseconds).toISOString() === value;
}

function boundedText(value: unknown, minimum: number, maximum: number) {
  return typeof value === "string" && value.trim().length >= minimum &&
    value.length <= maximum &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value);
}

function safeInteger(value: unknown, minimum = 0) {
  return Number.isSafeInteger(value) && (value as number) >= minimum;
}

function recordBytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

export function createScreen5OpenAIProviderReceipt(input: Omit<
  Screen5MechanismProviderReceipt,
  "schemaVersion" | "contentFingerprint" | "validationIssues" |
    "wireFingerprint" | "status"
>) {
  return validateScreen5MechanismProviderReceipt({
    schemaVersion: SCREEN5_OPENAI_PROVIDER_RECEIPT_VERSION,
    status: "received",
    ...structuredClone(input),
    contentFingerprint: fingerprintSixScreenValue(input.finalContent),
    validationIssues: [],
    wireFingerprint: null,
  });
}

export function updateScreen5MechanismProviderReceipt(
  receipt: Screen5MechanismProviderReceipt,
  patch: Pick<Screen5MechanismProviderReceipt, "status"> &
    Partial<Pick<Screen5MechanismProviderReceipt,
      "validationIssues" | "wireFingerprint">>,
) {
  return validateScreen5MechanismProviderReceipt({
    ...structuredClone(receipt),
    ...structuredClone(patch),
  });
}

export function validateScreen5MechanismProviderReceipt(
  receipt: Screen5MechanismProviderReceipt,
) {
  const encodedContent = new TextEncoder().encode(receipt.finalContent);
  const openAI = receipt.schemaVersion ===
    SCREEN5_OPENAI_PROVIDER_RECEIPT_VERSION;
  if (
    ![
      HISTORICAL_SCREEN5_PROVIDER_RECEIPT_VERSION,
      SCREEN5_OPENAI_PROVIDER_RECEIPT_VERSION,
    ].includes(receipt.schemaVersion) ||
    !["received", "schema_valid", "quarantined", "aggregate_saved"].includes(
      receipt.status,
    ) ||
    !canonicalIso(receipt.receivedAt) ||
    !safeInteger(receipt.httpStatus, 100) || receipt.httpStatus > 599 ||
    !(receipt.providerRequestId === null ||
      boundedText(receipt.providerRequestId, 1, 512)) ||
    (receipt.providerResponseId !== undefined &&
      receipt.providerResponseId !== null &&
      !boundedText(receipt.providerResponseId, 1, 512)) ||
    (receipt.serviceTier !== undefined && receipt.serviceTier !== null &&
      !boundedText(receipt.serviceTier, 1, 80)) ||
    (receipt.latencyMs !== undefined && receipt.latencyMs !== null &&
      !safeInteger(receipt.latencyMs)) ||
    (openAI && (
      !boundedText(receipt.providerResponseId, 1, 512) ||
      receipt.serviceTier !== SCREEN5_OPENAI_SERVICE_TIER ||
      !safeInteger(receipt.latencyMs)
    )) ||
    !boundedText(receipt.modelObserved, 1, 512) ||
    !boundedText(receipt.finishReason, 1, 80) ||
    !boundedText(receipt.finalContent, 1, SCREEN5_MECHANISM_RECEIPT_CONTENT_MAX_BYTES) ||
    encodedContent.byteLength > SCREEN5_MECHANISM_RECEIPT_CONTENT_MAX_BYTES ||
    receipt.contentFingerprint !==
      fingerprintSixScreenValue(receipt.finalContent) ||
    receipt.validationIssues.length > SCREEN5_MECHANISM_MAX_VALIDATION_ISSUES ||
    receipt.validationIssues.some((issue) =>
      !/^[a-z][a-z0-9_]{0,79}$/u.test(issue.code) ||
      !/^\$(?:\.[A-Za-z_][A-Za-z0-9_]*|\[\d+\]){0,12}$/u.test(issue.path)
    ) ||
    (receipt.status === "received" && (
      receipt.validationIssues.length !== 0 || receipt.wireFingerprint !== null
    )) ||
    (receipt.status === "schema_valid" || receipt.status === "aggregate_saved"
      ? receipt.validationIssues.length !== 0 ||
        receipt.wireFingerprint === null ||
        !/^fnv1a64:[0-9a-f]{16}$/u.test(receipt.wireFingerprint)
      : false) ||
    (receipt.status === "quarantined" &&
      receipt.validationIssues.length === 0) ||
    !safeInteger(receipt.usage.promptTokens) ||
    !safeInteger(receipt.usage.completionTokens) ||
    !safeInteger(receipt.usage.totalTokens) ||
    receipt.usage.totalTokens !==
      receipt.usage.promptTokens + receipt.usage.completionTokens ||
    recordBytes(receipt) > SCREEN5_MECHANISM_RECEIPT_CONTENT_MAX_BYTES + 8_192
  ) throw new Error("Screen 5 provider receipt is invalid or changed.");
  return receipt;
}

function authorFamilyName(value: string) {
  const normalized = value.normalize("NFKC").replace(/\s+/gu, " ").trim();
  const comma = normalized.indexOf(",");
  if (comma > 0) return normalized.slice(0, comma);
  return normalized.split(" ").at(-1) ?? normalized;
}

export function screen5MechanismCitationLabel(
  work: Pick<StudyFirstScholarlyWork, "authors" | "publicationYear" | "title">,
) {
  const year = work.publicationYear ?? "year unknown";
  if (!work.authors.length) return `${work.title}, ${year}`;
  const first = authorFamilyName(work.authors[0]!);
  if (work.authors.length === 1) return `${first}, ${year}`;
  if (work.authors.length === 2) {
    return `${first} & ${authorFamilyName(work.authors[1]!)}, ${year}`;
  }
  return `${first} et al., ${year}`;
}

export function createScreen5MechanismEvidencePacket(input: {
  id: string;
  plan: StudyFirstMechanismPlan;
  works: readonly StudyFirstScholarlyWork[];
  attempts?: readonly {
    status: "completed" | "failed" | "not_configured";
    queryId?: string;
    candidateIds?: string[];
    evidenceNeedIds?: string[];
  }[];
  createdAt: string;
}) {
  const searchTerms = [
    ...input.plan.candidates.flatMap((candidate) => [
      candidate.conceptLabel,
      ...candidate.processNodes,
    ]),
    ...input.plan.queryIntents.flatMap((intent) =>
      intent.conceptGroups.flat()
    ),
  ].map((term) => term.normalize("NFKC").toLocaleLowerCase("en-US").trim())
    .filter((term) => term.length >= 3);
  const inspected = input.works.filter((work) =>
    work.access.level === "abstract_inspected" &&
    typeof work.access.abstractText === "string" &&
    work.access.abstractText.trim().length > 0 &&
    work.access.abstractSource !== null &&
    work.updateOrRetraction.retractedFlag !== "flagged"
  ).map((work, originalIndex) => {
    const haystack = `${work.title} ${work.access.abstractText}`
      .normalize("NFKC").toLocaleLowerCase("en-US");
    const relevance = searchTerms.reduce(
      (score, term) => score + (haystack.includes(term) ? 1 : 0),
      0,
    );
    return { work, originalIndex, relevance };
  }).sort((left, right) =>
    right.relevance - left.relevance || left.originalIndex - right.originalIndex
  );
  // Keep complete abstract representations. The compact Stage B request has a
  // 3,400-input-token ceiling, so selection stops at whole-work boundaries
  // instead of clipping caveats or negation out of a passage.
  const selected: StudyFirstScholarlyWork[] = [];
  let selectedTextCharacters = 0;
  for (const candidate of inspected) {
    const textCharacters = candidate.work.access.abstractText!.length;
    if (selectedTextCharacters + textCharacters > 5_400) continue;
    selected.push(candidate.work);
    selectedTextCharacters += textCharacters;
    if (selected.length === 8) break;
  }
  const entries = selected.map((work, index) => ({
    evidenceId: `e${index + 1}`,
    workId: work.id,
    title: work.title,
    authors: [...work.authors],
    publicationYear: work.publicationYear,
    publicationVenue: work.publicationVenue,
    citationLabel: screen5MechanismCitationLabel(work),
    inspectedText: work.access.abstractText!,
    accessLevel: "abstract_inspected" as const,
    sourceRole: "scholarly_abstract" as const,
    sourceRepresentation: work.access.abstractSource!,
    stableLocators: [...work.stableLocators],
    claimBoundary: work.claimBoundary,
    // A publication venue is a source container, not the empirical setting.
    // Setting stays unknown unless inspected text is separately coded for it.
    setting: null,
  }));
  const entryText = new Map(entries.map((entry) => [
    entry.evidenceId,
    `${entry.title} ${entry.inspectedText}`.normalize("NFKC")
      .toLocaleLowerCase("en-US"),
  ]));
  const coverageMap = input.plan.candidates.map((candidate) => {
    const evidenceNeedIds = input.plan.evidenceNeeds
      .filter(({ candidateId }) => candidateId === candidate.id)
      .map(({ id }) => id);
    const queryIds = (input.attempts ?? []).filter((attempt) =>
      attempt.status === "completed" && (
        attempt.candidateIds?.includes(candidate.id) ||
        attempt.evidenceNeedIds?.some((id) => evidenceNeedIds.includes(id))
      )
    ).flatMap(({ queryId }) => queryId ? [queryId] : []);
    const candidateTerms = [candidate.conceptLabel, ...candidate.processNodes]
      .map((value) => value.normalize("NFKC").toLocaleLowerCase("en-US").trim())
      .filter((value) => value.length >= 3);
    const inspectedEvidenceIds = [...entryText].filter(([, text]) =>
      candidateTerms.some((term) => text.includes(term))
    ).map(([evidenceId]) => evidenceId);
    return {
      candidateId: candidate.id,
      evidenceNeedIds,
      queryIds: [...new Set(queryIds)],
      inspectedEvidenceIds,
      disposition: inspectedEvidenceIds.length
        ? "inspected_candidate_passage" as const
        : "no_selected_passage" as const,
    };
  });
  const metadataOnlyWorkCount = input.works.filter(({ access }) =>
    access.level === "metadata_only").length;
  const body = {
    schemaVersion: SCREEN5_MECHANISM_EVIDENCE_PACKET_VERSION,
    id: input.id,
    planFingerprint: input.plan.planFingerprint,
    entries,
    coverage: {
      selectedWorkCount: entries.length,
      availableInspectedWorkCount: inspected.length,
      metadataOnlyWorkCount,
      limitation: entries.length
        ? "The packet contains selected inspected abstracts only. Each passage retains its abstract-level claim boundary; transfer to the proposed study remains conditional."
        : "No scholarly text was inspected in the bounded retrieval. Stage B may organize explicit analytical hypotheses, but it cannot attribute detailed support to metadata-only records.",
    },
    coverageMap,
    createdAt: input.createdAt,
  };
  return validateScreen5MechanismEvidencePacket({
    ...body,
    packetFingerprint: fingerprintSixScreenValue(body),
  });
}

export function validateScreen5MechanismEvidencePacket(
  packet: Screen5MechanismEvidencePacket,
) {
  const body = bodyWithoutFingerprint(
    packet as unknown as Record<string, unknown>,
    "packetFingerprint",
  );
  const ids = new Set(packet.entries.map(({ evidenceId }) => evidenceId));
  const workIds = new Set(packet.entries.map(({ workId }) => workId));
  if (
    ![
      SCREEN5_MECHANISM_EVIDENCE_PACKET_VERSION,
      HISTORICAL_SCREEN5_EVIDENCE_PACKET_VERSION,
    ].includes(packet.schemaVersion) ||
    packet.packetFingerprint !== fingerprintSixScreenValue(body) ||
    !canonicalIso(packet.createdAt) ||
    packet.entries.length > 8 || ids.size !== packet.entries.length ||
    workIds.size !== packet.entries.length ||
    packet.coverage.selectedWorkCount !== packet.entries.length ||
    !safeInteger(packet.coverage.availableInspectedWorkCount) ||
    !safeInteger(packet.coverage.metadataOnlyWorkCount) ||
    (packet.coverageMap !== undefined && (
      packet.coverageMap.length > SCREEN5_MECHANISM_MAX_ADDITIONAL_MECHANISMS ||
      new Set(packet.coverageMap.map(({ candidateId }) => candidateId)).size !==
        packet.coverageMap.length ||
      packet.coverageMap.some((coverage) =>
        coverage.candidateId === null ||
        coverage.evidenceNeedIds.length > 20 || coverage.queryIds.length > 4 ||
        coverage.inspectedEvidenceIds.some((id) => !ids.has(id)) ||
        !["inspected_candidate_passage", "no_selected_passage"].includes(
          coverage.disposition,
        )
      )
    )) ||
    packet.entries.some((entry) =>
      !/^e[1-8]$/u.test(entry.evidenceId) ||
      !boundedText(entry.title, 1, 2_000) ||
      !boundedText(entry.inspectedText, 1, 20_000) ||
      !boundedText(entry.citationLabel, 1, 1_000) ||
      entry.accessLevel !== "abstract_inspected" ||
      !["scholarly_abstract", "scholarly_excerpt"].includes(
        entry.sourceRole,
      ) ||
      ![
        "openalex_abstract_inverted_index",
        "crossref_member_deposit",
        "frozen_primary_excerpt",
      ].includes(entry.sourceRepresentation) ||
      entry.stableLocators.length > 8 ||
      entry.stableLocators.some((locator) => {
        try {
          const url = new URL(locator);
          return url.protocol !== "https:";
        } catch {
          return true;
        }
      })
    ) || recordBytes(packet) > 240_000
  ) throw new Error("Screen 5 evidence packet is invalid or changed.");
  return packet;
}

function comparisonBody(comparison: Screen5MechanismComparison) {
  return bodyWithoutFingerprint(
    comparison as unknown as Record<string, unknown>,
    "comparisonFingerprint",
  );
}

export function createScreen5MechanismAssessmentBatchPlan(input: {
  executionId: string;
  problemFingerprint: string;
  inputFingerprint: string;
  plan: StudyFirstMechanismPlan;
  evidencePacket: Screen5MechanismEvidencePacket;
}) : Screen5MechanismAssessmentBatchPlan {
  validateScreen5MechanismEvidencePacket(input.evidencePacket);
  const candidateIds = input.plan.candidates.map(({ id }) => id);
  if (candidateIds.length > SCREEN5_MECHANISM_MAX_ADDITIONAL_MECHANISMS) {
    throw new Error("Screen 5 admitted more than ten additional mechanisms.");
  }
  const batchSize = candidateIds.length <= 3
    ? 3
    : SCREEN5_MECHANISM_PREFERRED_BATCH_SIZE;
  const groups: string[][] = [];
  for (let index = 0; index < candidateIds.length; index += batchSize) {
    groups.push(candidateIds.slice(index, index + batchSize));
  }
  if (!groups.length) groups.push([]);
  if (groups.length > SCREEN5_MECHANISM_MAX_ASSESSMENT_BATCHES) {
    throw new Error("Screen 5 assessment needs more than five bounded batches.");
  }
  const scientificBundleFingerprint = fingerprintSixScreenValue({
    executionId: input.executionId,
    problemFingerprint: input.problemFingerprint,
    inputFingerprint: input.inputFingerprint,
    planFingerprint: input.plan.planFingerprint,
    evidencePacketFingerprint: input.evidencePacket.packetFingerprint,
  });
  return {
    schemaVersion: SCREEN5_MECHANISM_ASSESSMENT_BATCH_PLAN_VERSION,
    scientificBundleFingerprint,
    batches: groups.map((group, index) => ({
      id: `screen5-b-${index + 1}-${fingerprintSixScreenValue({
        scientificBundleFingerprint,
        index,
        candidateIds: group,
      }).slice("fnv1a64:".length)}`,
      index: index + 1,
      candidateIds: group,
      includeFocal: index === 0,
    })),
  };
}

export function nextScreen5MechanismAssessmentBatch(
  execution: Screen5MechanismExecution,
) {
  const plan = execution.assessmentBatchPlan;
  if (!plan) return null;
  const completed = new Set(execution.attempts.filter((attempt) =>
    attempt.stage === "assessment" && attempt.status === "succeeded" &&
    attempt.assessmentBatchId
  ).map((attempt) => attempt.assessmentBatchId!));
  return plan.batches.find(({ id }) => !completed.has(id)) ?? null;
}

function semanticMechanismSignature(value: { concept: string; chain: string[] }) {
  return [value.concept, ...value.chain].join(" ").normalize("NFKC")
    .toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function createScreen5MechanismComparison(input: {
  id: string;
  problemFingerprint: string;
  /** Exact researcher-finalized M0 text. Optional only for v2 callers. */
  focalText?: string;
  plan: StudyFirstMechanismPlan;
  evidencePacket: Screen5MechanismEvidencePacket;
  batchPlan: Screen5MechanismAssessmentBatchPlan;
  batchWires: Array<{
    batchId: string;
    wire: Screen5MechanismComparisonWire;
    selectedEvidenceIds?: string[];
    omittedEvidenceIds?: string[];
  }>;
  modelObserved: string;
  createdAt: string;
}) {
  validateScreen5MechanismEvidencePacket(input.evidencePacket);
  const evidenceById = new Map(
    input.evidencePacket.entries.map((entry) => [entry.evidenceId, entry]),
  );
  const plannedBatchIds = new Set(input.batchPlan.batches.map(({ id }) => id));
  if (
    input.batchWires.length > input.batchPlan.batches.length ||
    new Set(input.batchWires.map(({ batchId }) => batchId)).size !==
      input.batchWires.length ||
    input.batchWires.some(({ batchId }) => !plannedBatchIds.has(batchId))
  ) throw new Error("Screen 5 assessment batch receipts do not match the plan.");
  const wireMechanisms = input.batchWires.flatMap(({ wire }) => wire.mechanisms);
  const signatureOwners = new Map<string, string>();
  const dispositionById = new Map(input.batchWires.flatMap(({ wire }) =>
    wire.dispositions).map((disposition) => [disposition.candidate_id, disposition]));
  const evidenceScopeByCandidate = new Map<string, {
    selectedEvidenceIds: string[];
    omittedEvidenceIds: string[];
  }>();
  for (const batch of input.batchWires) {
    for (const candidateId of new Set([
      ...batch.wire.mechanisms.map(({ candidate_id }) => candidate_id),
      ...batch.wire.dispositions.map(({ candidate_id }) => candidate_id),
    ])) {
      evidenceScopeByCandidate.set(candidateId, {
        selectedEvidenceIds: [...(batch.selectedEvidenceIds ?? [])],
        omittedEvidenceIds: [...(batch.omittedEvidenceIds ?? [])],
      });
    }
  }
  for (const mechanism of wireMechanisms) {
    const signature = semanticMechanismSignature(mechanism);
    const owner = signatureOwners.get(signature);
    if (owner && owner !== mechanism.candidate_id) {
      const disposition = dispositionById.get(mechanism.candidate_id);
      if (disposition?.status !== "merged" || disposition.merged_into !== owner) {
        throw new Error(
          "Screen 5 assessment repeated a semantic mechanism without an explicit merge.",
        );
      }
      continue;
    }
    signatureOwners.set(signature, mechanism.candidate_id);
  }
  const uniqueMechanisms = wireMechanisms.filter((mechanism, index, values) =>
    values.findIndex(({ candidate_id }) =>
      candidate_id === mechanism.candidate_id) === index &&
    dispositionById.get(mechanism.candidate_id)?.status !== "merged"
  );
  const roster = ["m0", ...input.plan.candidates.map(({ id }) => id)];
  const mechanisms = uniqueMechanisms.sort((left, right) =>
    roster.indexOf(left.candidate_id) - roster.indexOf(right.candidate_id)
  ).map((mechanism) => {
    const disposition = dispositionById.get(mechanism.candidate_id);
    const inspected = mechanism.argument.filter((argument) =>
      argument.basis === "inspected_proposition" &&
      argument.evidence_ids.length > 0
    );
    const transferred = mechanism.argument.filter((argument) =>
      (argument.basis === "study_transfer" ||
        argument.basis === undefined) && argument.evidence_ids.length > 0
    );
    const contested = disposition?.status === "excluded" ||
      disposition?.status === "not_supported_for_study";
    const evidenceScope = evidenceScopeByCandidate.get(mechanism.candidate_id);
    const support = contested
      ? "materially_contested" as const
      : inspected.length && transferred.length
      ? "partly_supported" as const
      : inspected.length
      ? "component_supported" as const
      : transferred.length
      ? "analogous_setting" as const
      : "hypothesis_only" as const;
    const sourceCheckStatus = disposition?.status === "unassessed_budget" ||
        (evidenceScope?.selectedEvidenceIds.length === 0 &&
          Boolean(evidenceScope.omittedEvidenceIds.length))
      ? "not_checked_due_budget" as const
      : inspected.length || transferred.length
      ? "checked_relevant_text" as const
      : input.evidencePacket.entries.length === 0
      ? "text_unavailable" as const
      : "checked_no_relevant_match" as const;
    return {
      id: mechanism.candidate_id,
      candidateId: mechanism.candidate_id,
      concept: mechanism.candidate_id === "m0" && input.focalText
        ? input.focalText
        : mechanism.concept,
      relation: mechanism.relation,
      chain: [...mechanism.chain],
      direction: {
        mechanismResponse: mechanism.direction.mechanism_response,
        outcomeImplication: mechanism.direction.outcome_implication,
        basis: mechanism.direction.basis,
        condition: mechanism.direction.condition,
      },
      argument: mechanism.argument.map((argument) => {
        const basis = argument.basis ?? (argument.evidence_ids.length
          ? "study_transfer" as const
          : "analytical_hypothesis" as const);
        return {
          text: argument.text,
          evidenceIds: [...argument.evidence_ids],
          citations: argument.evidence_ids.map((id) =>
            evidenceById.get(id)?.citationLabel ?? id
          ),
          supportStatus: basis === "inspected_proposition" &&
              argument.evidence_ids.length
            ? "source_linked" as const
            : "analytical_hypothesis" as const,
          basis,
        };
      }),
      support,
      sourceCheckStatus,
      fit: mechanism.fit,
      limit: mechanism.limit,
      theory: mechanism.theory,
      theoryBasis: mechanism.theory_basis,
    };
  });
  const rowById = new Map<string, Screen5MechanismComparisonWire["row_definitions"][number]>();
  const cellByCoordinate = new Map<string, Screen5MechanismComparisonWire["cells"][number]>();
  for (const { wire } of input.batchWires) {
    for (const row of wire.row_definitions) {
      const existing = rowById.get(row.row_id);
      if (existing && fingerprintSixScreenValue(existing) !==
          fingerprintSixScreenValue(row)) {
        throw new Error("Screen 5 prediction row identity changed across batches.");
      }
      rowById.set(row.row_id, row);
    }
    for (const cell of wire.cells) {
      const coordinate = `${cell.row_id}:${cell.candidate_id}`;
      if (cellByCoordinate.has(coordinate)) {
        throw new Error("Screen 5 prediction cell was returned more than once.");
      }
      cellByCoordinate.set(coordinate, cell);
    }
  }
  const predictions = [...rowById.values()].map((row) => ({
    id: row.row_id,
    observation: row.observation,
    measure: row.measure,
    level: row.level,
    timing: row.timing,
    patterns: mechanisms.map((mechanism) => {
      const cell = cellByCoordinate.get(`${row.row_id}:${mechanism.id}`);
      const evidenceIds = cell ? [...cell.evidence_ids] : [];
      return {
        mechanismId: mechanism.id,
        detail: cell?.text ?? "Not assessed in the saved bounded batch.",
        status: cell?.status ?? "not_assessed" as const,
        evidenceIds,
        citations: evidenceIds.map((id) =>
          evidenceById.get(id)?.citationLabel ?? id
        ),
      };
    }),
    caution: row.caution,
  }));
  const dispositions = [...dispositionById.values()].map((disposition) => ({
    candidateId: disposition.candidate_id,
    status: disposition.status,
    reason: disposition.reason,
    mergedInto: disposition.merged_into,
  }));
  const completedBatchCount = input.batchWires.length;
  const disposedAdditionalCount = new Set(dispositions.map(({ candidateId }) =>
    candidateId)).size;
  const completed = completedBatchCount === input.batchPlan.batches.length &&
    disposedAdditionalCount === input.plan.candidates.length &&
    !dispositions.some(({ status }) => status === "unassessed_budget");
  const body = {
    schemaVersion: SCREEN5_OPENAI_COMPARISON_VERSION,
    id: input.id,
    problemFingerprint: input.problemFingerprint,
    planFingerprint: input.plan.planFingerprint,
    evidencePacketFingerprint: input.evidencePacket.packetFingerprint,
    provider: SCREEN5_OPENAI_PROVIDER,
    modelRequested: SCREEN5_OPENAI_MODEL,
    modelObserved: input.modelObserved,
    promptVersion: SCREEN5_MECHANISM_COMPARISON_PROMPT_VERSION,
    wireVersion: SCREEN5_MECHANISM_COMPARISON_WIRE_VERSION,
    mechanisms,
    predictions,
    summary: completed
      ? `The bounded assessment completed ${completedBatchCount} batch${completedBatchCount === 1 ? "" : "es"}. Read each saved card and prediction cell with its own evidence boundary.`
      : `A partial bounded assessment saved ${completedBatchCount} of ${input.batchPlan.batches.length} planned batches. Unassessed candidates remain outside the displayed scientific conclusions.`,
    gaps: [...new Set(input.batchWires.flatMap(({ wire }) => wire.gaps))],
    dispositions,
    batchSummaries: input.batchWires.map(({ batchId, wire }) => ({
      batchId,
      candidateIds: wire.dispositions.map(({ candidate_id }) => candidate_id),
      summary: wire.summary,
    })),
    completion: {
      status: completed ? "completed" as const : "partial" as const,
      admittedAdditionalCount: input.plan.candidates.length,
      disposedAdditionalCount,
      completedBatchCount,
      totalBatchCount: input.batchPlan.batches.length,
    },
    bibliography: structuredClone(input.evidencePacket.entries),
    createdAt: input.createdAt,
  };
  return validateScreen5MechanismComparison({
    ...body,
    comparisonFingerprint: fingerprintSixScreenValue(body),
  });
}

export function validateScreen5MechanismComparison(
  comparison: Screen5MechanismComparison,
) {
  const evidenceIds = new Set(
    comparison.bibliography.map(({ evidenceId }) => evidenceId),
  );
  const mechanismIds = new Set(comparison.mechanisms.map(({ id }) => id));
  const legacy = comparison.schemaVersion ===
    HISTORICAL_SCREEN5_V1_COMPARISON_VERSION;
  const version2 = comparison.schemaVersion ===
    HISTORICAL_SCREEN5_V2_COMPARISON_VERSION;
  const openAI = comparison.schemaVersion === SCREEN5_OPENAI_COMPARISON_VERSION ||
    comparison.schemaVersion === HISTORICAL_OPENAI_SCREEN5_COMPARISON_VERSION;
  const current = openAI ||
    comparison.schemaVersion === HISTORICAL_SCREEN5_COMPARISON_VERSION;
  if (
    ![
      SCREEN5_OPENAI_COMPARISON_VERSION,
      HISTORICAL_OPENAI_SCREEN5_COMPARISON_VERSION,
      HISTORICAL_SCREEN5_COMPARISON_VERSION,
      HISTORICAL_SCREEN5_V2_COMPARISON_VERSION,
      HISTORICAL_SCREEN5_V1_COMPARISON_VERSION,
    ].includes(comparison.schemaVersion) ||
    (openAI
      ? comparison.provider !== SCREEN5_OPENAI_PROVIDER ||
        comparison.modelRequested !== SCREEN5_OPENAI_MODEL
      : comparison.provider !== HISTORICAL_SCREEN5_PROVIDER ||
        comparison.modelRequested !== HISTORICAL_SCREEN5_MODEL) ||
    (legacy
      ? comparison.promptVersion !==
          HISTORICAL_SCREEN5_V1_COMPARISON_PROMPT_VERSION ||
        comparison.wireVersion !==
          HISTORICAL_SCREEN5_V1_COMPARISON_WIRE_VERSION
      : version2
      ? comparison.promptVersion !== HISTORICAL_SCREEN5_V2_COMPARISON_PROMPT_VERSION ||
        comparison.wireVersion !== HISTORICAL_SCREEN5_V2_COMPARISON_WIRE_VERSION
      : comparison.promptVersion !== SCREEN5_MECHANISM_COMPARISON_PROMPT_VERSION ||
        comparison.wireVersion !== (comparison.schemaVersion ===
            SCREEN5_OPENAI_COMPARISON_VERSION
          ? SCREEN5_MECHANISM_COMPARISON_WIRE_VERSION
          : HISTORICAL_SCREEN5_COMPARISON_WIRE_VERSION)) ||
    comparison.comparisonFingerprint !==
      fingerprintSixScreenValue(comparisonBody(comparison)) ||
    !canonicalIso(comparison.createdAt) ||
    comparison.mechanisms.length < 1 || comparison.mechanisms.length >
      (legacy ? 5 : SCREEN5_MECHANISM_MAX_CARDS) ||
    comparison.mechanisms[0]?.relation !== "focal" ||
    comparison.mechanisms.filter(({ relation }) => relation === "focal")
        .length !== 1 ||
    mechanismIds.size !== comparison.mechanisms.length ||
    comparison.predictions.length > 8 || comparison.gaps.length > 12 ||
    (!legacy && (
      !comparison.completion || !comparison.dispositions ||
      !comparison.batchSummaries ||
      comparison.completion.admittedAdditionalCount >
        SCREEN5_MECHANISM_MAX_ADDITIONAL_MECHANISMS ||
      comparison.completion.completedBatchCount >
        SCREEN5_MECHANISM_MAX_ASSESSMENT_BATCHES ||
      comparison.completion.totalBatchCount >
        SCREEN5_MECHANISM_MAX_ASSESSMENT_BATCHES ||
      new Set(comparison.mechanisms.map(({ candidateId }) => candidateId)).size !==
        comparison.mechanisms.length ||
      comparison.mechanisms.some(({ candidateId }) => !candidateId)
    )) ||
    comparison.mechanisms.some((mechanism) =>
      !boundedText(mechanism.concept, 1, 300) ||
      mechanism.chain.length < 2 || mechanism.chain.length > 7 ||
      mechanism.argument.length < 1 || mechanism.argument.length > 8 ||
      mechanism.argument.some((argument) =>
        !boundedText(argument.text, 1, 3_000) ||
        argument.evidenceIds.length > 8 ||
        argument.evidenceIds.some((id) => !evidenceIds.has(id)) ||
        (current && ![
          "inspected_proposition",
          "study_transfer",
          "analytical_hypothesis",
        ].includes(argument.basis ?? "")) ||
        (current && argument.basis === "inspected_proposition" &&
          argument.evidenceIds.length === 0) ||
        (current && argument.basis === "analytical_hypothesis" &&
          argument.evidenceIds.length > 0)
      ) ||
      (current && ![
        "component_supported",
        "analogous_setting",
        "partly_supported",
        "hypothesis_only",
        "materially_contested",
      ].includes(mechanism.support ?? "")) ||
      (current && ![
        "checked_relevant_text",
        "checked_no_relevant_match",
        "text_unavailable",
        "not_checked_due_budget",
      ].includes(mechanism.sourceCheckStatus ?? "")) ||
      !boundedText(mechanism.fit, 1, 3_000) ||
      !boundedText(mechanism.limit, 1, 3_000)
    ) ||
    comparison.predictions.some((prediction) =>
      prediction.patterns.length !== comparison.mechanisms.length ||
      prediction.patterns.some((pattern) =>
        !mechanismIds.has(pattern.mechanismId) ||
        !boundedText(pattern.detail, 1, 2_000) ||
        (pattern.evidenceIds?.some((id) => !evidenceIds.has(id)) ?? false)
      )
    ) || recordBytes(comparison) > 768_000
  ) throw new Error("Screen 5 provider comparison is invalid or changed.");
  return comparison;
}

function executionBody(execution: Screen5MechanismExecution) {
  return bodyWithoutFingerprint(
    execution as unknown as Record<string, unknown>,
    "executionFingerprint",
  );
}

export function createScreen5OpenAIExecution(input: Omit<
  Screen5MechanismExecution,
  "schemaVersion" | "provider" | "modelRequested" | "pilotId" |
    "planPromptVersion" | "comparisonPromptVersion" | "planWireVersion" |
    "comparisonWireVersion" | "settings" | "executionFingerprint"
>) {
  const body: Omit<Screen5MechanismExecution, "executionFingerprint"> = {
    schemaVersion: SCREEN5_OPENAI_EXECUTION_VERSION,
    provider: SCREEN5_OPENAI_PROVIDER,
    modelRequested: SCREEN5_OPENAI_MODEL,
    pilotId: SCREEN5_OPENAI_PILOT_ID,
    planPromptVersion: SCREEN5_MECHANISM_PLAN_PROMPT_VERSION,
    comparisonPromptVersion: SCREEN5_MECHANISM_COMPARISON_PROMPT_VERSION,
    planWireVersion: SCREEN5_MECHANISM_PLAN_WIRE_VERSION,
    comparisonWireVersion: SCREEN5_MECHANISM_COMPARISON_WIRE_VERSION,
    settings: {
      reasoningEffort: SCREEN5_OPENAI_REASONING_EFFORT,
      includeReasoning: false,
      stream: false,
      serviceTier: SCREEN5_OPENAI_SERVICE_TIER,
      store: false,
      adapterVersion: SCREEN5_OPENAI_ADAPTER_VERSION,
      planInputCeiling: SCREEN5_OPENAI_PLAN_INPUT_CEILING,
      planCompletionCeiling: SCREEN5_OPENAI_PLAN_OUTPUT_CEILING,
      comparisonInputCeiling: SCREEN5_OPENAI_COMPARISON_INPUT_CEILING,
      comparisonCompletionCeiling:
        SCREEN5_OPENAI_COMPARISON_OUTPUT_CEILING,
    },
    ...structuredClone(input),
  };
  return validateScreen5MechanismExecution({
    ...body,
    executionFingerprint: fingerprintSixScreenValue(body),
  });
}

export function validateScreen5MechanismExecution(
  execution: Screen5MechanismExecution,
) {
  const authorization = execution.authorization ?? null;
  const batchPlan = execution.assessmentBatchPlan ?? null;
  const batchIds = new Set(batchPlan?.batches.map(({ id }) => id) ?? []);
  const openAI = execution.schemaVersion === SCREEN5_OPENAI_EXECUTION_VERSION ||
    execution.schemaVersion === PREVIOUS_SCREEN5_OPENAI_EXECUTION_VERSION ||
    execution.schemaVersion === HISTORICAL_OPENAI_SCREEN5_EXECUTION_VERSION;
  const previousOpenAI = openAI && execution.schemaVersion !==
    SCREEN5_OPENAI_EXECUTION_VERSION;
  const expectedProvider = openAI
    ? SCREEN5_OPENAI_PROVIDER
    : HISTORICAL_SCREEN5_PROVIDER;
  const expectedModel = openAI ? SCREEN5_OPENAI_MODEL : HISTORICAL_SCREEN5_MODEL;
  const expectedPilotId = openAI
    ? SCREEN5_OPENAI_PILOT_ID
    : HISTORICAL_SCREEN5_PILOT_ID;
  const expectedAuthorizationVersion = openAI
    ? SCREEN5_OPENAI_JOB_AUTHORIZATION_VERSION
    : HISTORICAL_SCREEN5_JOB_AUTHORIZATION_VERSION;
  const expectedMaximumAttempts = openAI
    ? previousOpenAI ? PREVIOUS_OPENAI_LIMITS.maximumAttempts : SCREEN5_OPENAI_MAX_ATTEMPTS
    : HISTORICAL_SCREEN5_MAX_ATTEMPTS;
  const expectedMaximumTokens = openAI
    ? previousOpenAI ? PREVIOUS_OPENAI_LIMITS.maximumTokens : SCREEN5_OPENAI_MAX_TOKENS
    : HISTORICAL_SCREEN5_MAX_TOKENS;
  const expectedPlanReservedTokens = openAI
    ? previousOpenAI ? PREVIOUS_OPENAI_LIMITS.planReserved : SCREEN5_OPENAI_PLAN_RESERVED_TOKENS
    : HISTORICAL_SCREEN5_PLAN_RESERVED_TOKENS;
  const expectedAssessmentReservedTokens = openAI
    ? previousOpenAI ? PREVIOUS_OPENAI_LIMITS.assessmentReserved : SCREEN5_OPENAI_COMPARISON_RESERVED_TOKENS
    : HISTORICAL_SCREEN5_COMPARISON_RESERVED_TOKENS;
  const expectedPlanInputCeiling = openAI
    ? previousOpenAI ? PREVIOUS_OPENAI_LIMITS.planInput : SCREEN5_OPENAI_PLAN_INPUT_CEILING
    : HISTORICAL_SCREEN5_PLAN_INPUT_CEILING;
  const expectedAssessmentInputCeiling = openAI
    ? previousOpenAI ? PREVIOUS_OPENAI_LIMITS.assessmentInput : SCREEN5_OPENAI_COMPARISON_INPUT_CEILING
    : HISTORICAL_SCREEN5_COMPARISON_INPUT_CEILING;
  const expectedPlanOutputCeiling = openAI
    ? previousOpenAI ? PREVIOUS_OPENAI_LIMITS.planOutput : SCREEN5_OPENAI_PLAN_OUTPUT_CEILING
    : HISTORICAL_SCREEN5_PLAN_OUTPUT_CEILING;
  const expectedAssessmentOutputCeiling = openAI
    ? previousOpenAI ? PREVIOUS_OPENAI_LIMITS.assessmentOutput : SCREEN5_OPENAI_COMPARISON_OUTPUT_CEILING
    : HISTORICAL_SCREEN5_COMPARISON_OUTPUT_CEILING;
  if (
    ![
      HISTORICAL_SCREEN5_EXECUTION_VERSION,
      HISTORICAL_OPENAI_SCREEN5_EXECUTION_VERSION,
      PREVIOUS_SCREEN5_OPENAI_EXECUTION_VERSION,
      SCREEN5_OPENAI_EXECUTION_VERSION,
    ].includes(execution.schemaVersion) ||
    execution.provider !== expectedProvider ||
    execution.modelRequested !== expectedModel ||
    execution.pilotId !== expectedPilotId ||
    ![
      SCREEN5_MECHANISM_PLAN_PROMPT_VERSION,
      PREVIOUS_SCREEN5_MECHANISM_PLAN_PROMPT_VERSION,
      EARLIER_SCREEN5_MECHANISM_PLAN_PROMPT_VERSION,
      HISTORICAL_SCREEN5_PLAN_PROMPT_VERSION,
      HISTORICAL_SCREEN5_V1_PLAN_PROMPT_VERSION,
    ].includes(execution.planPromptVersion) ||
    ![
      SCREEN5_MECHANISM_COMPARISON_PROMPT_VERSION,
      HISTORICAL_SCREEN5_V2_COMPARISON_PROMPT_VERSION,
      HISTORICAL_SCREEN5_V1_COMPARISON_PROMPT_VERSION,
    ].includes(execution.comparisonPromptVersion) ||
    ![
      SCREEN5_MECHANISM_PLAN_WIRE_VERSION,
      PREVIOUS_SCREEN5_MECHANISM_PLAN_WIRE_VERSION,
      EARLIER_SCREEN5_MECHANISM_PLAN_WIRE_VERSION,
      HISTORICAL_SCREEN5_PLAN_WIRE_VERSION,
      HISTORICAL_SCREEN5_V1_PLAN_WIRE_VERSION,
    ].includes(execution.planWireVersion) ||
    ![
      SCREEN5_MECHANISM_COMPARISON_WIRE_VERSION,
      HISTORICAL_SCREEN5_COMPARISON_WIRE_VERSION,
      HISTORICAL_SCREEN5_V2_COMPARISON_WIRE_VERSION,
      HISTORICAL_SCREEN5_V1_COMPARISON_WIRE_VERSION,
    ].includes(execution.comparisonWireVersion) ||
    execution.executionFingerprint !==
      fingerprintSixScreenValue(executionBody(execution)) ||
    execution.settings.reasoningEffort !== "medium" ||
    execution.settings.includeReasoning !== false ||
    execution.settings.stream !== false ||
    execution.settings.planInputCeiling !== expectedPlanInputCeiling ||
    execution.settings.planCompletionCeiling !== expectedPlanOutputCeiling ||
    execution.settings.comparisonInputCeiling !==
      expectedAssessmentInputCeiling ||
    execution.settings.comparisonCompletionCeiling !==
      expectedAssessmentOutputCeiling ||
    (openAI && (
      execution.settings.serviceTier !== SCREEN5_OPENAI_SERVICE_TIER ||
      execution.settings.store !== false ||
      execution.settings.adapterVersion !== SCREEN5_OPENAI_ADAPTER_VERSION
    )) ||
    !canonicalIso(execution.createdAt) || !canonicalIso(execution.updatedAt) ||
    (authorization !== null && (
      authorization.schemaVersion !== expectedAuthorizationVersion ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/u.test(
        authorization.authorizationId,
      ) ||
      authorization.jobId !== execution.id ||
      authorization.source !== "authenticated_screen5_action" ||
      !canonicalIso(authorization.grantedAt) ||
      authorization.stages.length < 1 || authorization.stages.length > 2 ||
      new Set(authorization.stages).size !== authorization.stages.length ||
      authorization.stages.some((stage) =>
        stage !== "planning" && stage !== "assessment"
      ) ||
      (authorization.assessmentBatchId !== undefined &&
        authorization.assessmentBatchId !== null &&
        (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u.test(
          authorization.assessmentBatchId,
        ) || (batchPlan !== null &&
          !batchIds.has(authorization.assessmentBatchId))))
    )) ||
    (batchPlan !== null && (
      ![
        SCREEN5_MECHANISM_ASSESSMENT_BATCH_PLAN_VERSION,
        HISTORICAL_SCREEN5_ASSESSMENT_BATCH_PLAN_VERSION,
      ].includes(batchPlan.schemaVersion) ||
      !/^fnv1a64:[0-9a-f]{16}$/u.test(
        batchPlan.scientificBundleFingerprint,
      ) ||
      batchPlan.batches.length < 1 ||
      batchPlan.batches.length > SCREEN5_MECHANISM_MAX_ASSESSMENT_BATCHES ||
      batchIds.size !== batchPlan.batches.length ||
      batchPlan.batches.some((batch, index) =>
        batch.index !== index + 1 || batch.includeFocal !== (index === 0) ||
        batch.candidateIds.length > 3 ||
        new Set(batch.candidateIds).size !== batch.candidateIds.length
      ) ||
      new Set(batchPlan.batches.flatMap(({ candidateIds }) => candidateIds))
          .size !== batchPlan.batches.flatMap(({ candidateIds }) => candidateIds)
            .length ||
      batchPlan.batches.flatMap(({ candidateIds }) => candidateIds).length >
        SCREEN5_MECHANISM_MAX_ADDITIONAL_MECHANISMS
    )) ||
    execution.attempts.length > expectedMaximumAttempts ||
    new Set(execution.attempts.map(({ id }) => id)).size !==
      execution.attempts.length ||
    execution.attempts.some((attempt, index) =>
      attempt.ordinal !== index + 1 ||
      !safeInteger(attempt.reservedTokens, 1) ||
      !safeInteger(attempt.estimatedInputTokens) ||
      !safeInteger(attempt.maxCompletionTokens, 1) ||
      (attempt.authorizationId !== undefined &&
        attempt.authorizationId !== null &&
        !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/u.test(
          attempt.authorizationId,
        )) ||
      (attempt.assessmentBatchId !== undefined &&
        attempt.assessmentBatchId !== null &&
        (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u.test(
          attempt.assessmentBatchId,
        ) || (batchPlan !== null &&
          !batchIds.has(attempt.assessmentBatchId)))) ||
      (attempt.assessmentBatchIndex !== undefined &&
        attempt.assessmentBatchIndex !== null &&
        (!safeInteger(attempt.assessmentBatchIndex, 1) ||
          attempt.assessmentBatchIndex > SCREEN5_MECHANISM_MAX_ASSESSMENT_BATCHES)) ||
      (attempt.evidenceIds !== undefined && (
        attempt.evidenceIds.length > 8 ||
        new Set(attempt.evidenceIds).size !== attempt.evidenceIds.length ||
        attempt.evidenceIds.some((id) => !/^e[1-8]$/u.test(id))
      )) ||
      (attempt.omittedEvidenceIds !== undefined && (
        attempt.omittedEvidenceIds.length > 8 ||
        new Set(attempt.omittedEvidenceIds).size !==
          attempt.omittedEvidenceIds.length ||
        attempt.omittedEvidenceIds.some((id) => !/^e[1-8]$/u.test(id)) ||
        attempt.omittedEvidenceIds.some((id) =>
          attempt.evidenceIds?.includes(id) ?? false)
      )) ||
      (attempt.responseReceipt !== undefined &&
        attempt.responseReceipt !== null &&
        !validateScreen5MechanismProviderReceipt(attempt.responseReceipt)) ||
      (attempt.responseReceipt !== undefined &&
        attempt.responseReceipt !== null &&
        attempt.responseReceipt.schemaVersion !== (openAI
          ? SCREEN5_OPENAI_PROVIDER_RECEIPT_VERSION
          : HISTORICAL_SCREEN5_PROVIDER_RECEIPT_VERSION)) ||
      (attempt.responseReceipt?.wireFingerprint !== null &&
        attempt.responseReceipt?.wireFingerprint !== undefined &&
        attempt.wireCheckpoint !== null &&
        attempt.responseReceipt.wireFingerprint !==
          attempt.wireCheckpoint.fingerprint) ||
      (attempt.failureStage !== undefined && ![
        "local_configuration",
        "admission",
        "network",
        "response_headers",
        "response_body",
        "model_output",
        "persistence",
        "projection",
      ].includes(attempt.failureStage)) ||
      (attempt.networkInvocation !== undefined && ![
        "not_started",
        "invoked",
        "unknown",
      ].includes(attempt.networkInvocation)) ||
      (attempt.providerResponse !== undefined && ![
        "not_observed",
        "observed",
      ].includes(attempt.providerResponse)) ||
      (attempt.httpStatus !== undefined && attempt.httpStatus !== null &&
        (!safeInteger(attempt.httpStatus, 100) || attempt.httpStatus > 599)) ||
      (attempt.providerResponseId !== undefined &&
        attempt.providerResponseId !== null &&
        !boundedText(attempt.providerResponseId, 1, 512)) ||
      (attempt.serviceTier !== undefined && attempt.serviceTier !== null &&
        !boundedText(attempt.serviceTier, 1, 80)) ||
      (attempt.latencyMs !== undefined && attempt.latencyMs !== null &&
        !safeInteger(attempt.latencyMs)) ||
      (openAI && attempt.status === "succeeded" && (
        !boundedText(attempt.providerResponseId, 1, 512) ||
        attempt.serviceTier !== SCREEN5_OPENAI_SERVICE_TIER ||
        !safeInteger(attempt.latencyMs)
      )) ||
      (attempt.safeCause !== undefined && attempt.safeCause !== null &&
        !/^[a-z][a-z0-9_]{0,79}$/u.test(attempt.safeCause)) ||
      attempt.modelRequested !== expectedModel ||
      (attempt.stage === "planning" && (
        attempt.reservedTokens !== expectedPlanReservedTokens ||
        attempt.estimatedInputTokens > expectedPlanInputCeiling ||
        attempt.maxCompletionTokens !== expectedPlanOutputCeiling
      )) ||
      (attempt.stage === "assessment" && (
        attempt.reservedTokens !== expectedAssessmentReservedTokens ||
        attempt.estimatedInputTokens > expectedAssessmentInputCeiling ||
        attempt.maxCompletionTokens !== expectedAssessmentOutputCeiling
      )) ||
      !canonicalIso(attempt.startedAt) ||
      (attempt.completedAt !== null && !canonicalIso(attempt.completedAt)) ||
      (attempt.usage !== null && (
        !safeInteger(attempt.usage.promptTokens) ||
        !safeInteger(attempt.usage.completionTokens) ||
        !safeInteger(attempt.usage.totalTokens) ||
        attempt.usage.totalTokens !==
          attempt.usage.promptTokens + attempt.usage.completionTokens ||
        attempt.usage.totalTokens > attempt.reservedTokens
      )) ||
      (attempt.wireCheckpoint !== null &&
        (attempt.wireCheckpoint.fingerprint !== fingerprintSixScreenValue(
          attempt.wireCheckpoint.value,
        ) || attempt.wireCheckpoint.kind !== attempt.stage ||
          (attempt.wireCheckpoint.kind === "planning" &&
            ![
              SCREEN5_MECHANISM_PLAN_WIRE_VERSION,
              PREVIOUS_SCREEN5_MECHANISM_PLAN_WIRE_VERSION,
              EARLIER_SCREEN5_MECHANISM_PLAN_WIRE_VERSION,
              HISTORICAL_SCREEN5_PLAN_WIRE_VERSION,
              HISTORICAL_SCREEN5_V1_PLAN_WIRE_VERSION,
            ].includes(attempt.wireCheckpoint.version)) ||
          (attempt.wireCheckpoint.kind === "assessment" &&
            ![
              SCREEN5_MECHANISM_COMPARISON_WIRE_VERSION,
              HISTORICAL_SCREEN5_COMPARISON_WIRE_VERSION,
              HISTORICAL_SCREEN5_V2_COMPARISON_WIRE_VERSION,
              HISTORICAL_SCREEN5_V1_COMPARISON_WIRE_VERSION,
            ].includes(attempt.wireCheckpoint.version)))) ||
      (attempt.status === "running" && attempt.completedAt !== null) ||
      (attempt.status !== "running" && attempt.status !== "reserved" &&
        attempt.completedAt === null) ||
      (attempt.status === "succeeded" && (
        !attempt.usage || !attempt.wireCheckpoint ||
        !attempt.modelObserved || attempt.finishReason !==
          (openAI ? "completed" : "stop") ||
        attempt.errorCode !== null
      ))
    ) ||
    execution.attempts.filter(({ stage }) => stage === "planning").length > 2 ||
    execution.attempts.filter(({ stage }) => stage === "assessment").length > 10 ||
    execution.retryCount < 0 || execution.retryCount > 1 ||
    (execution.budgetSnapshot !== null && (
      execution.budgetSnapshot.pilotId !== expectedPilotId ||
      !safeInteger(execution.budgetSnapshot.maximumAttempts, 1) ||
      !safeInteger(execution.budgetSnapshot.maximumTokens, 1) ||
      (execution.budgetSnapshot.policyMode !== undefined &&
        !["bounded", "reviewer", "unlimited"].includes(execution.budgetSnapshot.policyMode)) ||
      (execution.budgetSnapshot.accountingVersion !== undefined &&
        execution.budgetSnapshot.accountingVersion !== "persistent-v3") ||
      (execution.budgetSnapshot.lastRenewalId !== undefined &&
        !/^fnv1a64:[0-9a-f]{16}$/u.test(execution.budgetSnapshot.lastRenewalId)) ||
      (execution.budgetSnapshot.lastRenewalWindow !== undefined &&
        !["standard", "extended", "reviewer"].includes(execution.budgetSnapshot.lastRenewalWindow)) ||
      ((execution.budgetSnapshot.policyMode === "reviewer" || execution.budgetSnapshot.policyMode === "unlimited") &&
        (!openAI || previousOpenAI ||
          execution.budgetSnapshot.accountingVersion !== "persistent-v3")) ||
      (previousOpenAI || !openAI
        ? execution.budgetSnapshot.maximumAttempts !== expectedMaximumAttempts ||
          execution.budgetSnapshot.maximumTokens !== expectedMaximumTokens
        : execution.budgetSnapshot.accountingVersion !== "persistent-v3" &&
          (execution.budgetSnapshot.maximumAttempts > expectedMaximumAttempts ||
          execution.budgetSnapshot.maximumTokens > expectedMaximumTokens)) ||
      !safeInteger(execution.budgetSnapshot.attemptsReserved) ||
      !safeInteger(execution.budgetSnapshot.attemptsSettled) ||
      !safeInteger(execution.budgetSnapshot.attemptsHeld) ||
      !safeInteger(execution.budgetSnapshot.tokensConsumed) ||
      !safeInteger(execution.budgetSnapshot.tokensHeld) ||
      !safeInteger(execution.budgetSnapshot.tokensCommitted) ||
      !safeInteger(execution.budgetSnapshot.remainingAttempts) ||
      !safeInteger(execution.budgetSnapshot.remainingTokens) ||
      execution.budgetSnapshot.attemptsReserved > execution.budgetSnapshot.maximumAttempts ||
      execution.budgetSnapshot.tokensCommitted > execution.budgetSnapshot.maximumTokens
    )) ||
    (execution.nextEligibleAt !== null &&
      !canonicalIso(execution.nextEligibleAt)) ||
    (execution.lastError !== null && (
      !boundedText(execution.lastError.code, 1, 120) ||
      !boundedText(execution.lastError.message, 1, 2_000) ||
      !canonicalIso(execution.lastError.occurredAt) ||
      (execution.lastError.failureStage !== undefined && ![
        "local_configuration",
        "admission",
        "network",
        "response_headers",
        "response_body",
        "model_output",
        "persistence",
        "projection",
      ].includes(execution.lastError.failureStage)) ||
      (execution.lastError.networkInvocation !== undefined && ![
        "not_started",
        "invoked",
        "unknown",
      ].includes(execution.lastError.networkInvocation)) ||
      (execution.lastError.providerResponse !== undefined && ![
        "not_observed",
        "observed",
      ].includes(execution.lastError.providerResponse)) ||
      (execution.lastError.httpStatus !== undefined &&
        execution.lastError.httpStatus !== null &&
        (!safeInteger(execution.lastError.httpStatus, 100) ||
          execution.lastError.httpStatus > 599)) ||
      (execution.lastError.safeCause !== undefined &&
        execution.lastError.safeCause !== null &&
        !/^[a-z][a-z0-9_]{0,79}$/u.test(execution.lastError.safeCause))
    )) ||
    (execution.evidencePacket !== null &&
      !validateScreen5MechanismEvidencePacket(execution.evidencePacket)) ||
    (execution.comparison !== null &&
      !validateScreen5MechanismComparison(execution.comparison)) ||
    (execution.comparison !== null && (
      execution.comparison.provider !== expectedProvider ||
      execution.comparison.modelRequested !== expectedModel
    )) ||
    (execution.evidencePacket !== null &&
      execution.comparison !== null &&
      execution.comparison.evidencePacketFingerprint !==
        execution.evidencePacket.packetFingerprint) ||
    (execution.comparison !== null &&
      execution.comparison.problemFingerprint !==
        execution.problemFingerprint) ||
    (execution.phase === "completed" && !execution.comparison) ||
    (execution.phase === "completed" &&
      execution.comparison?.completion &&
      execution.comparison.completion?.status !== "completed") ||
    (execution.phase === "assessment_partial" &&
      execution.comparison?.completion?.status !== "partial") ||
    (execution.phase === "completed" &&
      execution.attempts.at(-1)?.stage !== "assessment") ||
    recordBytes(execution) > 1_600_000
  ) throw new Error("Screen 5 provider execution is invalid or changed.");
  return execution;
}

export function screen5MechanismUsageTotals(execution: Screen5MechanismExecution) {
  return execution.attempts.reduce((totals, attempt) => {
    totals.attempts += 1;
    if (attempt.usage) {
      totals.promptTokens += attempt.usage.promptTokens;
      totals.completionTokens += attempt.usage.completionTokens;
      totals.totalTokens += attempt.usage.totalTokens;
    } else if (
      attempt.status === "reserved" || attempt.status === "running" ||
      attempt.status === "outcome_unknown"
    ) {
      totals.heldTokens += attempt.reservedTokens;
    }
    return totals;
  }, {
    attempts: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    heldTokens: 0,
  });
}

/** Pure read adapter for immutable v1 results and batched v2 results. */
export function screen5MechanismComparisonDisplayState(
  comparison: Screen5MechanismComparison,
) {
  validateScreen5MechanismComparison(comparison);
  return {
    completionStatus: comparison.completion?.status ?? "completed" as const,
    mechanisms: comparison.mechanisms.map((mechanism) => ({
      ...mechanism,
      direction: mechanism.direction ?? null,
    })),
    predictions: comparison.predictions.map((prediction) => ({
      ...prediction,
      patterns: prediction.patterns.map((pattern) => ({
        ...pattern,
        status: pattern.status ?? "prediction" as const,
        evidenceIds: pattern.evidenceIds ?? [],
        citations: pattern.citations ?? [],
      })),
    })),
  };
}
