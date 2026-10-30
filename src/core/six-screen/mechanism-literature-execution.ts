import { fingerprintSixScreenValue } from "./canonical";
import {
  requireBoundedIdentifier,
  requireCanonicalInstant,
  requireFingerprint,
  requireSanitizedSourceUrl,
} from "./contracts";
import {
  MECHANISM_LITERATURE_BRANCHES,
  validateMechanismLiteraturePlan,
  type MechanismLiteratureBranch,
  type MechanismLiteraturePlan,
} from "./mechanism-literature-plan";

export const SIX_SCREEN_MECHANISM_LITERATURE_EXECUTION_PLAN_LEGACY_VERSION =
  "screen-05-literature-execution-plan-v1" as const;
export const SIX_SCREEN_MECHANISM_LITERATURE_EXECUTION_PLAN_VERSION =
  "screen-05-literature-execution-plan-v2" as const;
export const SIX_SCREEN_MECHANISM_LITERATURE_ATTEMPT_VERSION =
  "screen-05-literature-provider-attempt-v1" as const;
export const SIX_SCREEN_SCHOLARLY_METADATA_RECORD_VERSION =
  "screen-05-scholarly-metadata-record-v1" as const;
export const SIX_SCREEN_OPENALEX_SCHOLARLY_METADATA_RECORD_VERSION =
  "screen-05-openalex-scholarly-metadata-record-v1" as const;
export const SIX_SCREEN_SCHOLARLY_EVIDENCE_PACKET_VERSION =
  "screen-05-scholarly-evidence-packet-v1" as const;
export const SIX_SCREEN_MECHANISM_LITERATURE_EXECUTION_VERSION =
  "screen-05-literature-execution-v1" as const;

export const SIX_SCREEN_MECHANISM_LITERATURE_MAX_EXECUTION_PLANS = 24;
export const SIX_SCREEN_MECHANISM_LITERATURE_MAX_EXECUTIONS = 96;
export const SIX_SCREEN_MECHANISM_LITERATURE_MAX_METADATA_RECORDS = 80;
export const SIX_SCREEN_MECHANISM_LITERATURE_MAX_EVIDENCE_PACKETS = 96;
export const SIX_SCREEN_MECHANISM_LITERATURE_EXECUTION_MAX_BYTES = 512_000;

const LEGACY_CROSSREF_QUERY_LIMIT = 3 as const;
const RECORDS_PER_PROVIDER_QUERY = 5;
const LEGACY_CROSSREF_METADATA_LIMIT = 15 as const;
const INITIAL_SCHOLARLY_QUERY_LIMIT = 6 as const;
const INITIAL_SCHOLARLY_METADATA_LIMIT = 30 as const;
const UPDATE_CAVEAT =
  "Crossref update metadata reports deposited relations only. No reported relation is not evidence that a work is valid, unretracted, or unchanged.";
const RECORD_LIMITATION =
  "This record contains Crossref bibliographic metadata only. No abstract, full text, appendix, cited passage, theoretical proposition, measure, result, or mechanism was inspected.";
const OPENALEX_UPDATE_CAVEAT =
  "OpenAlex discovery does not supply Crossref deposited update relations. Its retraction flag is retained separately and must not be treated as a complete update check.";
const OPENALEX_LOCATION_CAVEAT =
  "OpenAlex reported locations are unvisited discovery metadata. They do not establish access rights, document identity, text availability, or evidentiary support.";
const OPENALEX_RETRACTION_CAVEAT =
  "The OpenAlex retraction flag is provider metadata only. A false flag is not evidence that the work is valid, unretracted, or unchanged.";
const OPENALEX_RECORD_LIMITATION =
  "This record contains OpenAlex work and reported-location metadata only. No reported location, abstract, full text, appendix, cited passage, theoretical proposition, measure, result, or mechanism was inspected.";
const EXECUTION_CLAIM_BOUNDARY =
  "This execution records bounded scholarly-metadata discovery only. Metadata records are leads, not support for a theory, detailed empirical claim, mechanism, prediction, measure, or causal estimate.";
const PACKET_CLAIM_BOUNDARY =
  "This immutable packet contains reviewed policy premises and scholarly metadata leads only. It contains no inspected scholarly text or passage and cannot support mechanism generation, prediction comparison, or a theory claim.";

export type MechanismLiteratureProviderId = "openalex" | "crossref";

export type MechanismLiteratureExecutionStepInitialStatus =
  | "pending"
  | "not_configured"
  | "not_implemented"
  | "enabled_not_tested"
  | "policy_blocked"
  | "degraded"
  | "quota_exhausted"
  | "unsupported_for_request"
  | "operation_not_supported"
  | "budget_excluded";

export type MechanismLiteratureExecutionPlanStep = {
  id: string;
  rowId: string;
  branch: MechanismLiteratureBranch;
  providerId: MechanismLiteratureProviderId;
  provider: string;
  adapterVersion: string;
  capabilityStatus:
    MechanismLiteraturePlan["providerCapabilities"][number]["status"];
  operation: "search_metadata";
  queryTerms: string[];
  plannedLimit: number;
  initialStatus: MechanismLiteratureExecutionStepInitialStatus;
  statusNote: string | null;
  fullTextAction: "not_requested";
};

export type MechanismLiteratureExecutionPlan = {
  schemaVersion:
    | typeof SIX_SCREEN_MECHANISM_LITERATURE_EXECUTION_PLAN_LEGACY_VERSION
    | typeof SIX_SCREEN_MECHANISM_LITERATURE_EXECUTION_PLAN_VERSION;
  id: string;
  literaturePlanSnapshotId: string;
  literaturePlanFingerprint: string;
  scope:
    | "crossref_metadata_foundation"
    | "openalex_crossref_metadata_foundation";
  steps: MechanismLiteratureExecutionPlanStep[];
  sourceQueryCeiling: 3 | 6;
  metadataRecordCeiling: 15 | 30;
  standardProfileSourceQueryCeiling: 16;
  standardProfileMetadataRecordCeiling: 80;
  citationNeighborhoodHopLimit: 0;
  continuationMode: "panel_driven";
  claimBoundary: string;
  createdAt: string;
  planFingerprint: string;
};

export type MechanismLiteratureExecutionUsage = {
  sourceQueries: number;
  metadataRecords: number;
  documentAttempts: number;
  usefulDocuments: number;
  transportHops: number;
  receivedBytes: number;
  decodedBytes: number;
  activeResearchMs: number;
  cpuMs: number;
  providerCostUnits: Record<string, number>;
};

export type MechanismLiteratureProviderAttemptOutcome =
  | "metadata_leads_found"
  | "no_match"
  | "source_unavailable"
  | "records_unusable"
  | "unsupported_request";

export type MechanismLiteratureProviderAttempt = {
  schemaVersion: typeof SIX_SCREEN_MECHANISM_LITERATURE_ATTEMPT_VERSION;
  id: string;
  stepId: string;
  rowId: string;
  branch: MechanismLiteratureBranch;
  providerId: MechanismLiteratureProviderId;
  startedAt: string;
  completedAt: string;
  requestUrl: string | null;
  queryFingerprint: string;
  requestedLimit: number;
  recordsReceived: number;
  recordsAccepted: number;
  limitReached: boolean;
  outcome: MechanismLiteratureProviderAttemptOutcome;
  failureCode: string | null;
  note: string;
  scholarlyMetadataRecordIds: string[];
  inspectedTextIds: [];
  usage: MechanismLiteratureExecutionUsage;
  attemptFingerprint: string;
};

export type ScholarlyMetadataCompletenessField =
  | "doi"
  | "authors"
  | "publication_year"
  | "publication_venue";

export type ScholarlyMetadataRecord = {
  schemaVersion:
    | typeof SIX_SCREEN_SCHOLARLY_METADATA_RECORD_VERSION
    | typeof SIX_SCREEN_OPENALEX_SCHOLARLY_METADATA_RECORD_VERSION;
  id: string;
  providerId: MechanismLiteratureProviderId;
  providerNativeId: string;
  doi: string | null;
  title: string;
  authors: string[];
  publicationYear: number | null;
  publishedDate: string | null;
  publicationVenue: string | null;
  publisher: string;
  workType: string | null;
  language?: string | null;
  stableLocator: string;
  updateMetadata: {
    status:
      | "relations_reported"
      | "none_reported"
      | "not_available_from_route";
    relations: Array<{
      relationType: string;
      relatedDoi: string | null;
      label: string | null;
    }>;
    caveat: typeof UPDATE_CAVEAT | typeof OPENALEX_UPDATE_CAVEAT;
  };
  openAccessLocationMetadata?: {
    status: "locations_reported" | "none_reported";
    locations: Array<{
      landingPageUrl: string | null;
      pdfUrl: string | null;
      sourceName: string | null;
      sourceType: string | null;
      version: string | null;
      license: string | null;
      isOpenAccess: boolean;
    }>;
    followedLocations: 0;
    caveat: typeof OPENALEX_LOCATION_CAVEAT;
  };
  retractionMetadata?: {
    status: "flagged" | "not_flagged";
    caveat: typeof OPENALEX_RETRACTION_CAVEAT;
  };
  metadataCompleteness: {
    status: "complete_for_initial_display" | "partial";
    missingFields: ScholarlyMetadataCompletenessField[];
  };
  source: {
    attemptId: string;
    stepId: string;
    rowId: string;
    branch: MechanismLiteratureBranch;
    requestUrl: string;
    retrievedAt: string;
  };
  access: {
    route: "crossref_metadata_api" | "openalex_works_api";
    metadata: "retrieved";
    abstract: "not_requested";
    fullText: "not_requested";
    appendix: "not_requested";
    inspectedPassageIds: [];
  };
  evidenceRole: "scholarly_metadata_lead";
  detailedClaimSupport: "not_eligible";
  limitation: typeof RECORD_LIMITATION | typeof OPENALEX_RECORD_LIMITATION;
  recordFingerprint: string;
};

export type MechanismLiteratureExecution = {
  schemaVersion: typeof SIX_SCREEN_MECHANISM_LITERATURE_EXECUTION_VERSION;
  snapshotId: string;
  ordinal: number;
  literaturePlanSnapshotId: string;
  literaturePlanFingerprint: string;
  executionPlanId: string;
  executionPlanFingerprint: string;
  previousExecutionSnapshotId: string | null;
  attempt: MechanismLiteratureProviderAttempt | null;
  status: "active" | "complete";
  completedStepIds: string[];
  remainingStepIds: string[];
  scholarlyMetadataRecordIds: string[];
  unavailableProviderIds: MechanismLiteratureProviderId[];
  actualSearchBoundary: {
    startedAt: string;
    completedAt: string | null;
    processedProviderIds: MechanismLiteratureProviderId[];
    searchedProviderIds: MechanismLiteratureProviderId[];
    processedStepIds: string[];
    sourceQueries: number;
    metadataRecords: number;
    retainedMetadataRecordCount: number;
    anyProviderLimitReached: boolean;
    citationNeighborhoodHops: 0;
    documentAttempts: 0;
    stopReason:
      | "planned_steps_exhausted"
      | "no_executable_provider_route"
      | null;
  };
  evidenceStatus: {
    scholarlyMetadata: "retrieved" | "not_retrieved";
    scholarlyText: "not_inspected";
    suppliedWorks:
      MechanismLiteraturePlan["evidenceStatus"]["suppliedWorks"];
  };
  intelligenceAnalysis: {
    status: "blocked";
    reason:
      | "genuine_intelligence_path_unverified"
      | "scholarly_passages_unavailable";
  };
  claimBoundary: typeof EXECUTION_CLAIM_BOUNDARY;
  recordedAt: string;
  executionFingerprint: string;
};

export type ScholarlyEvidencePacket = {
  schemaVersion: typeof SIX_SCREEN_SCHOLARLY_EVIDENCE_PACKET_VERSION;
  snapshotId: string;
  ordinal: number;
  binding: {
    literaturePlanSnapshotId: string;
    literaturePlanFingerprint: string;
    executionSnapshotId: string;
    executionFingerprint: string;
    previousPacketSnapshotId: string | null;
  };
  policyPremiseReferences: Array<{
    claimId: string;
    premiseFingerprint: string;
    passageIds: string[];
    documentVersionIds: string[];
    sourceIds: string[];
  }>;
  suppliedWorkReferences: Array<{
    id: string;
    kind: MechanismLiteraturePlan["input"]["suppliedWorks"][number]["kind"];
    value: string;
    inspectionStatus: "not_inspected";
  }>;
  scholarlyMetadataReferences: Array<{
    recordId: string;
    recordFingerprint: string;
    providerId: MechanismLiteratureProviderId;
    doi: string | null;
    inspectionStatus: "metadata_only";
  }>;
  inspectedTexts: [];
  scholarlyPassages: [];
  status: "metadata_only" | "no_scholarly_metadata";
  detailedClaimEligibility: {
    eligible: false;
    reason: "no_inspected_scholarly_passages";
  };
  mechanismCandidates: [];
  predictionMatrix: null;
  searchBoundary: MechanismLiteratureExecution["actualSearchBoundary"];
  intelligenceAnalysis: {
    status: "blocked";
    reason:
      | "genuine_intelligence_path_unverified"
      | "scholarly_passages_unavailable";
  };
  claimBoundary: typeof PACKET_CLAIM_BOUNDARY;
  createdAt: string;
  packetFingerprint: string;
};

type ExecutionPlanBody = Omit<
  MechanismLiteratureExecutionPlan,
  "planFingerprint"
>;
type AttemptBody = Omit<MechanismLiteratureProviderAttempt, "attemptFingerprint">;
type RecordBody = Omit<ScholarlyMetadataRecord, "recordFingerprint">;
type RecordInput = Omit<RecordBody, "metadataCompleteness">;
type ExecutionBody = Omit<MechanismLiteratureExecution, "executionFingerprint">;
type PacketBody = Omit<ScholarlyEvidencePacket, "packetFingerprint">;

function bytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function requireText(value: string, label: string, max = 4_000) {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new Error(`${label} is invalid or exceeds its bounded length.`);
  }
}

function requireUniqueTextList(
  values: readonly string[],
  label: string,
  maximum: number,
) {
  if (!Array.isArray(values) || values.length > maximum ||
      new Set(values).size !== values.length) {
    throw new Error(`${label} is invalid or exceeds its bounded count.`);
  }
  values.forEach((value) => requireText(value, label, 2_000));
}

function requireNonnegative(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a nonnegative safe integer.`);
  }
}

function executionPlanBody(plan: MechanismLiteratureExecutionPlan) {
  const { planFingerprint: _fingerprint, ...body } = plan;
  return body;
}

function initialStatus(
  provider: MechanismLiteraturePlan["providerCapabilities"][number],
  allowOpenAlex = true,
): MechanismLiteratureExecutionStepInitialStatus {
  if (!provider.configured) return "not_configured";
  if (!provider.implemented) return "not_implemented";
  if (provider.status === "policy_blocked") return "policy_blocked";
  if (provider.status === "quota_exhausted") return "quota_exhausted";
  if (provider.status === "degraded") return "degraded";
  if (provider.status === "unsupported_for_request") {
    return "unsupported_for_request";
  }
  if (!provider.tested || provider.status === "enabled_not_tested") {
    // A configured OpenAlex route must be able to perform its first bounded
    // metadata query: that harmless intended operation is also the live
    // capability probe. Success is recorded only by the provider attempt;
    // key presence alone never creates a scholarly record or a healthy claim.
    if (provider.id === "openalex" && allowOpenAlex && provider.searchRecords) {
      return "pending";
    }
    return "enabled_not_tested";
  }
  if (!provider.enabled) return "policy_blocked";
  if (
    !provider.searchRecords ||
    (provider.id !== "crossref" && (!allowOpenAlex || provider.id !== "openalex"))
  ) {
    return "operation_not_supported";
  }
  return "pending";
}

function statusNote(
  status: MechanismLiteratureExecutionStepInitialStatus,
  provider: MechanismLiteraturePlan["providerCapabilities"][number],
) {
  switch (status) {
    case "pending":
      return null;
    case "not_configured":
      return `${provider.provider} is not configured; no request was made.`;
    case "not_implemented":
      return `${provider.provider} has no implemented Screen 5 adapter; no request was made.`;
    case "enabled_not_tested":
      return `${provider.provider} is enabled but has not passed an explicit capability probe; no request was made.`;
    case "policy_blocked":
      return `${provider.provider} is blocked by the current capability policy; no request was made.`;
    case "degraded":
      return `${provider.provider} is degraded; no request was scheduled.`;
    case "quota_exhausted":
      return `${provider.provider} has no available quota; no request was scheduled.`;
    case "unsupported_for_request":
      return `${provider.provider} does not support this request; no request was scheduled.`;
    case "operation_not_supported":
      return `${provider.provider} has no reviewed metadata executor in this bounded Screen 5 slice.`;
    case "budget_excluded":
      return `${provider.provider} was excluded by the initial metadata-only budget.`;
  }
}

export function createMechanismLiteratureExecutionPlan(input: {
  id: string;
  literaturePlan: MechanismLiteraturePlan;
  createdAt: string;
}) {
  requireBoundedIdentifier(input.id, "Screen 5 execution-plan id");
  requireCanonicalInstant(input.createdAt, "Screen 5 execution-plan createdAt");
  validateMechanismLiteraturePlan(input.literaturePlan);
  const providerMap = new Map(input.literaturePlan.providerCapabilities.map(
    (provider) => [provider.id, provider],
  ));
  const steps = input.literaturePlan.rows.flatMap((row) =>
    row.providers.map((route): MechanismLiteratureExecutionPlanStep => {
      const provider = providerMap.get(route.id);
      if (!provider) {
        throw new Error(`Screen 5 omitted capability ${route.id}.`);
      }
      const status = initialStatus(provider);
      return {
        id: `mechanism-literature-step-${row.branch.replaceAll("_", "-")}-${provider.id}`,
        rowId: row.id,
        branch: row.branch,
        providerId: provider.id,
        provider: provider.provider,
        adapterVersion: provider.adapterVersion,
        capabilityStatus: provider.status,
        operation: "search_metadata",
        queryTerms: [...row.queryConcepts],
        plannedLimit: Math.min(
          RECORDS_PER_PROVIDER_QUERY,
          row.plannedLimit.metadataRecords,
        ),
        initialStatus: status,
        statusNote: statusNote(status, provider),
        fullTextAction: "not_requested",
      };
    })
  );
  const pending = steps.filter(({ initialStatus }) => initialStatus === "pending");
  if (pending.length > INITIAL_SCHOLARLY_QUERY_LIMIT) {
    throw new Error("Screen 5 initial scholarly plan exceeded its query ceiling.");
  }
  const body: ExecutionPlanBody = {
    schemaVersion: SIX_SCREEN_MECHANISM_LITERATURE_EXECUTION_PLAN_VERSION,
    id: input.id,
    literaturePlanSnapshotId: input.literaturePlan.snapshotId,
    literaturePlanFingerprint: input.literaturePlan.planFingerprint,
    scope: "openalex_crossref_metadata_foundation",
    steps,
    sourceQueryCeiling: INITIAL_SCHOLARLY_QUERY_LIMIT,
    metadataRecordCeiling: INITIAL_SCHOLARLY_METADATA_LIMIT,
    standardProfileSourceQueryCeiling:
      input.literaturePlan.retrievalProfile.totalSourceQueries,
    standardProfileMetadataRecordCeiling:
      input.literaturePlan.retrievalProfile.totalMetadataRecords,
    citationNeighborhoodHopLimit: 0,
    continuationMode: "panel_driven",
    claimBoundary:
      "This initial execution plan schedules at most one configured OpenAlex work-metadata query and one tested Crossref bibliographic-metadata query per literature branch. A first OpenAlex query is itself a bounded live capability probe and retains records only on success. It does not follow reported locations or schedule citation expansion, document acquisition, or full-text inspection.",
    createdAt: input.createdAt,
  };
  const plan = {
    ...body,
    planFingerprint: fingerprintSixScreenValue(body),
  };
  return validateMechanismLiteratureExecutionPlan(
    plan,
    input.literaturePlan,
  );
}

export function validateMechanismLiteratureExecutionPlan(
  plan: MechanismLiteratureExecutionPlan,
  literaturePlan: MechanismLiteraturePlan,
) {
  validateMechanismLiteraturePlan(literaturePlan);
  const legacy = plan.schemaVersion ===
    SIX_SCREEN_MECHANISM_LITERATURE_EXECUTION_PLAN_LEGACY_VERSION;
  if (
    (!legacy && plan.schemaVersion !==
      SIX_SCREEN_MECHANISM_LITERATURE_EXECUTION_PLAN_VERSION) ||
    plan.planFingerprint !== fingerprintSixScreenValue(executionPlanBody(plan)) ||
    plan.literaturePlanSnapshotId !== literaturePlan.snapshotId ||
    plan.literaturePlanFingerprint !== literaturePlan.planFingerprint ||
    plan.scope !== (legacy
      ? "crossref_metadata_foundation"
      : "openalex_crossref_metadata_foundation") ||
    plan.sourceQueryCeiling !== (legacy
      ? LEGACY_CROSSREF_QUERY_LIMIT
      : INITIAL_SCHOLARLY_QUERY_LIMIT) ||
    plan.metadataRecordCeiling !== (legacy
      ? LEGACY_CROSSREF_METADATA_LIMIT
      : INITIAL_SCHOLARLY_METADATA_LIMIT) ||
    plan.standardProfileSourceQueryCeiling !== 16 ||
    plan.standardProfileMetadataRecordCeiling !== 80 ||
    plan.citationNeighborhoodHopLimit !== 0 ||
    plan.continuationMode !== "panel_driven" ||
    plan.steps.length !==
      literaturePlan.rows.length * literaturePlan.providerCapabilities.length ||
    bytes(plan) > SIX_SCREEN_MECHANISM_LITERATURE_EXECUTION_MAX_BYTES
  ) throw new Error("Screen 5 literature execution plan is invalid.");
  requireBoundedIdentifier(plan.id, "Screen 5 execution-plan id");
  requireCanonicalInstant(plan.createdAt, "Screen 5 execution-plan createdAt");
  requireFingerprint(
    plan.literaturePlanFingerprint,
    "Screen 5 literature-plan fingerprint",
  );
  requireText(plan.claimBoundary, "Screen 5 execution-plan claim boundary");
  const expectedSteps = literaturePlan.rows.flatMap((row) =>
    row.providers.map((route) => ({ row, route }))
  );
  let pendingCount = 0;
  for (const [index, step] of plan.steps.entries()) {
    const expected = expectedSteps[index];
    const provider = literaturePlan.providerCapabilities.find(({ id }) =>
      id === expected?.route.id);
    if (!expected || !provider) {
      throw new Error("Screen 5 execution-plan step order is invalid.");
    }
    requireBoundedIdentifier(step.id, "Screen 5 execution-plan step id");
    requireUniqueTextList(step.queryTerms, "Screen 5 execution query terms", 24);
    const expectedStatus = initialStatus(provider, !legacy);
    if (
      step.id !==
        `mechanism-literature-step-${expected.row.branch.replaceAll("_", "-")}-${provider.id}` ||
      step.rowId !== expected.row.id || step.branch !== expected.row.branch ||
      step.providerId !== provider.id || step.provider !== provider.provider ||
      step.adapterVersion !== provider.adapterVersion ||
      step.capabilityStatus !== provider.status ||
      step.operation !== "search_metadata" ||
      step.fullTextAction !== "not_requested" ||
      step.plannedLimit !== Math.min(
        RECORDS_PER_PROVIDER_QUERY,
        expected.row.plannedLimit.metadataRecords,
      ) ||
      step.initialStatus !== expectedStatus ||
      step.statusNote !== statusNote(expectedStatus, provider) ||
      step.queryTerms.join("\u0000") !==
        expected.row.queryConcepts.join("\u0000")
    ) throw new Error("Screen 5 execution-plan provider step is invalid.");
    if (step.initialStatus === "pending") {
      pendingCount += 1;
      if (legacy && step.providerId !== "crossref") {
        throw new Error("Legacy Screen 5 plans may execute only Crossref metadata.");
      }
    }
  }
  if (pendingCount > plan.sourceQueryCeiling) {
    throw new Error("Screen 5 execution-plan query ceiling was exceeded.");
  }
  return plan;
}

function usageKeys() {
  return [
    "sourceQueries",
    "metadataRecords",
    "documentAttempts",
    "usefulDocuments",
    "transportHops",
    "receivedBytes",
    "decodedBytes",
    "activeResearchMs",
    "cpuMs",
  ] as const;
}

export function validateMechanismLiteratureExecutionUsage(
  usage: MechanismLiteratureExecutionUsage,
) {
  usageKeys().forEach((key) => requireNonnegative(usage[key], key));
  for (const [provider, units] of Object.entries(usage.providerCostUnits)) {
    requireText(provider, "Screen 5 provider-cost id", 200);
    requireNonnegative(units, `Screen 5 ${provider} cost units`);
  }
  if (usage.documentAttempts !== 0 || usage.usefulDocuments !== 0) {
    throw new Error("Screen 5 metadata execution cannot claim document use.");
  }
  return usage;
}

function attemptBody(attempt: MechanismLiteratureProviderAttempt) {
  const { attemptFingerprint: _fingerprint, ...body } = attempt;
  return body;
}

export function createMechanismLiteratureProviderAttempt(
  input: AttemptBody,
) {
  const attempt = {
    ...structuredClone(input),
    attemptFingerprint: fingerprintSixScreenValue(input),
  };
  return validateMechanismLiteratureProviderAttempt(attempt);
}

export function validateMechanismLiteratureProviderAttempt(
  attempt: MechanismLiteratureProviderAttempt,
) {
  const outcomes: readonly MechanismLiteratureProviderAttemptOutcome[] = [
    "metadata_leads_found",
    "no_match",
    "source_unavailable",
    "records_unusable",
    "unsupported_request",
  ];
  if (
    attempt.schemaVersion !== SIX_SCREEN_MECHANISM_LITERATURE_ATTEMPT_VERSION ||
    attempt.attemptFingerprint !== fingerprintSixScreenValue(attemptBody(attempt)) ||
    !MECHANISM_LITERATURE_BRANCHES.includes(attempt.branch) ||
    !["openalex", "crossref"].includes(attempt.providerId) ||
    !outcomes.includes(attempt.outcome) ||
    !Number.isSafeInteger(attempt.requestedLimit) ||
    attempt.requestedLimit < 1 ||
    attempt.requestedLimit > RECORDS_PER_PROVIDER_QUERY ||
    typeof attempt.limitReached !== "boolean" ||
    attempt.recordsAccepted > attempt.recordsReceived ||
    attempt.recordsAccepted > attempt.requestedLimit ||
    attempt.recordsAccepted !== attempt.scholarlyMetadataRecordIds.length ||
    attempt.inspectedTextIds.length !== 0
  ) throw new Error("Screen 5 provider attempt is invalid.");
  requireBoundedIdentifier(attempt.id, "Screen 5 provider-attempt id");
  requireBoundedIdentifier(attempt.stepId, "Screen 5 provider-attempt step id");
  requireBoundedIdentifier(attempt.rowId, "Screen 5 provider-attempt row id");
  requireCanonicalInstant(attempt.startedAt, "Screen 5 attempt startedAt");
  requireCanonicalInstant(attempt.completedAt, "Screen 5 attempt completedAt");
  if (Date.parse(attempt.completedAt) < Date.parse(attempt.startedAt)) {
    throw new Error("Screen 5 provider attempt ended before it started.");
  }
  requireFingerprint(attempt.queryFingerprint, "Screen 5 query fingerprint");
  requireText(attempt.note, "Screen 5 provider-attempt note");
  requireNonnegative(attempt.recordsReceived, "Screen 5 records received");
  requireNonnegative(attempt.recordsAccepted, "Screen 5 records accepted");
  requireUniqueTextList(
    attempt.scholarlyMetadataRecordIds,
    "Screen 5 scholarly record ids",
    RECORDS_PER_PROVIDER_QUERY,
  );
  attempt.scholarlyMetadataRecordIds.forEach((id) =>
    requireBoundedIdentifier(id, "Screen 5 scholarly record id")
  );
  validateMechanismLiteratureExecutionUsage(attempt.usage);
  if (attempt.failureCode) {
    requireText(attempt.failureCode, "Screen 5 provider failure code", 200);
  }
  if (attempt.requestUrl) {
    requireSanitizedSourceUrl(attempt.requestUrl);
  }
  const found = attempt.outcome === "metadata_leads_found";
  const noMatch = attempt.outcome === "no_match";
  const unusable = attempt.outcome === "records_unusable";
  const unsupported = attempt.outcome === "unsupported_request";
  if (
    found !== (attempt.recordsAccepted > 0) ||
    (noMatch && (attempt.recordsReceived !== 0 || attempt.recordsAccepted !== 0)) ||
    (unusable && (attempt.recordsReceived === 0 || attempt.recordsAccepted !== 0)) ||
    (["source_unavailable", "unsupported_request"].includes(attempt.outcome) &&
      (attempt.recordsReceived !== 0 || attempt.recordsAccepted !== 0)) ||
    (unsupported &&
      (attempt.requestUrl !== null || attempt.usage.sourceQueries !== 0)) ||
    (!unsupported &&
      (!attempt.requestUrl || attempt.usage.sourceQueries !== 1)) ||
    attempt.usage.transportHops !== (unsupported ? 0 : 1) ||
    attempt.usage.metadataRecords !== attempt.recordsReceived ||
    Boolean(attempt.failureCode) !== (attempt.outcome === "source_unavailable")
  ) throw new Error("Screen 5 provider-attempt outcome is inconsistent.");
  return attempt;
}

function recordBody(record: ScholarlyMetadataRecord) {
  const { recordFingerprint: _fingerprint, ...body } = record;
  return body;
}

function canonicalDoi(value: string | null) {
  return value === null || (
    value === value.toLocaleLowerCase("en-US") &&
    /^10\.\d{4,9}\/[\p{L}\p{N}._;()/:+\-]+$/iu.test(value)
  );
}

function canonicalCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value;
}

function canonicalOpenAlexId(value: string) {
  return /^https:\/\/openalex\.org\/W\d+$/u.test(value);
}

function expectedMissingFields(record: Pick<
  ScholarlyMetadataRecord,
  "doi" | "authors" | "publicationYear" | "publicationVenue"
>) {
  const missing: ScholarlyMetadataCompletenessField[] = [];
  if (!record.doi) missing.push("doi");
  if (!record.authors.length) missing.push("authors");
  if (record.publicationYear === null) missing.push("publication_year");
  if (!record.publicationVenue) missing.push("publication_venue");
  return missing;
}

export function createScholarlyMetadataRecord(input: RecordInput) {
  const missingFields = expectedMissingFields(input);
  const body: RecordBody = {
    ...structuredClone(input),
    metadataCompleteness: {
      status: missingFields.length ? "partial" : "complete_for_initial_display",
      missingFields,
    },
  };
  const record = {
    ...body,
    recordFingerprint: fingerprintSixScreenValue(body),
  };
  return validateScholarlyMetadataRecord(record);
}

export function validateScholarlyMetadataRecord(record: ScholarlyMetadataRecord) {
  const expectedMissing = expectedMissingFields(record);
  const crossref = record.providerId === "crossref";
  const openAlex = record.providerId === "openalex";
  if (
    (crossref
      ? record.schemaVersion !== SIX_SCREEN_SCHOLARLY_METADATA_RECORD_VERSION
      : record.schemaVersion !==
        SIX_SCREEN_OPENALEX_SCHOLARLY_METADATA_RECORD_VERSION) ||
    (!crossref && !openAlex) ||
    record.recordFingerprint !== fingerprintSixScreenValue(recordBody(record)) ||
    !canonicalDoi(record.doi) ||
    record.access.route !== (crossref
      ? "crossref_metadata_api"
      : "openalex_works_api") ||
    record.access.metadata !== "retrieved" ||
    record.access.abstract !== "not_requested" ||
    record.access.fullText !== "not_requested" ||
    record.access.appendix !== "not_requested" ||
    record.access.inspectedPassageIds.length !== 0 ||
    record.evidenceRole !== "scholarly_metadata_lead" ||
    record.detailedClaimSupport !== "not_eligible" ||
    record.limitation !== (crossref
      ? RECORD_LIMITATION
      : OPENALEX_RECORD_LIMITATION) ||
    record.updateMetadata.caveat !== (crossref
      ? UPDATE_CAVEAT
      : OPENALEX_UPDATE_CAVEAT) ||
    record.metadataCompleteness.missingFields.join("\u0000") !==
      expectedMissing.join("\u0000") ||
    record.metadataCompleteness.status !==
      (expectedMissing.length ? "partial" : "complete_for_initial_display") ||
    (crossref && record.providerNativeId !== (record.doi ?? record.stableLocator)) ||
    (crossref && record.doi !== null &&
      record.stableLocator !== `https://doi.org/${record.doi}`) ||
    (openAlex &&
      (record.providerNativeId !== record.stableLocator ||
        !canonicalOpenAlexId(record.providerNativeId))) ||
    (crossref &&
      (record.language !== undefined ||
        record.openAccessLocationMetadata !== undefined ||
        record.retractionMetadata !== undefined)) ||
    (openAlex &&
      (record.language === undefined ||
        record.openAccessLocationMetadata === undefined ||
        record.retractionMetadata === undefined))
  ) throw new Error("Screen 5 scholarly metadata record is invalid.");
  requireBoundedIdentifier(record.id, "Screen 5 scholarly record id");
  requireText(record.providerNativeId, "Screen 5 provider-native id", 2_000);
  requireText(record.title, "Screen 5 scholarly title", 1_000);
  requireUniqueTextList(record.authors, "Screen 5 scholarly authors", 100);
  requireText(record.publisher, "Screen 5 scholarly publisher", 500);
  if (record.publicationVenue) {
    requireText(record.publicationVenue, "Screen 5 publication venue", 1_000);
  }
  if (record.workType) requireText(record.workType, "Screen 5 work type", 200);
  if (record.language) requireText(record.language, "Screen 5 work language", 50);
  if (record.publicationYear !== null &&
      (!Number.isSafeInteger(record.publicationYear) ||
        record.publicationYear < 1000 || record.publicationYear > 9999)) {
    throw new Error("Screen 5 publication year is invalid.");
  }
  if (record.publishedDate !== null &&
      (!canonicalCalendarDate(record.publishedDate) ||
        (record.publicationYear !== null &&
          record.publicationYear !== Number(record.publishedDate.slice(0, 4))))) {
    throw new Error("Screen 5 publication date is invalid.");
  }
  requireSanitizedSourceUrl(record.stableLocator);
  requireBoundedIdentifier(record.source.attemptId, "Screen 5 source attempt id");
  requireBoundedIdentifier(record.source.stepId, "Screen 5 source step id");
  requireBoundedIdentifier(record.source.rowId, "Screen 5 source row id");
  requireSanitizedSourceUrl(record.source.requestUrl);
  requireCanonicalInstant(record.source.retrievedAt, "Screen 5 record retrievedAt");
  if (!MECHANISM_LITERATURE_BRANCHES.includes(record.source.branch)) {
    throw new Error("Screen 5 scholarly record branch is invalid.");
  }
  if (record.updateMetadata.relations.length > 20 ||
      new Set(record.updateMetadata.relations.map((relation) =>
        fingerprintSixScreenValue(relation))).size !==
        record.updateMetadata.relations.length ||
      record.updateMetadata.status !==
        (crossref
          ? record.updateMetadata.relations.length
            ? "relations_reported"
            : "none_reported"
          : "not_available_from_route") ||
      (openAlex && record.updateMetadata.relations.length !== 0)) {
    throw new Error("Screen 5 update metadata is invalid.");
  }
  for (const relation of record.updateMetadata.relations) {
    requireText(relation.relationType, "Screen 5 update relation", 200);
    if (relation.relatedDoi !== null && !canonicalDoi(relation.relatedDoi)) {
      throw new Error("Screen 5 related DOI is invalid.");
    }
    if (relation.label !== null) {
      requireText(relation.label, "Screen 5 update label", 500);
    }
  }
  if (openAlex) {
    const locations = record.openAccessLocationMetadata!;
    const retraction = record.retractionMetadata!;
    if (
      locations.locations.length > 2 ||
      new Set(locations.locations.map((location) =>
        fingerprintSixScreenValue(location))).size !== locations.locations.length ||
      locations.status !== (locations.locations.length
        ? "locations_reported"
        : "none_reported") ||
      locations.followedLocations !== 0 ||
      locations.caveat !== OPENALEX_LOCATION_CAVEAT ||
      !["flagged", "not_flagged"].includes(retraction.status) ||
      retraction.caveat !== OPENALEX_RETRACTION_CAVEAT
    ) throw new Error("Screen 5 OpenAlex route metadata is invalid.");
    for (const location of locations.locations) {
      if (!location.landingPageUrl && !location.pdfUrl) {
        throw new Error("Screen 5 OpenAlex location omitted its locator.");
      }
      if (location.landingPageUrl) {
        requireSanitizedSourceUrl(location.landingPageUrl);
      }
      if (location.pdfUrl) requireSanitizedSourceUrl(location.pdfUrl);
      if (location.sourceName) {
        requireText(location.sourceName, "Screen 5 OpenAlex source name", 500);
      }
      if (location.sourceType) {
        requireText(location.sourceType, "Screen 5 OpenAlex source type", 200);
      }
      if (location.version) {
        requireText(location.version, "Screen 5 OpenAlex version", 100);
      }
      if (location.license) {
        requireText(location.license, "Screen 5 OpenAlex license", 200);
      }
      if (typeof location.isOpenAccess !== "boolean") {
        throw new Error("Screen 5 OpenAlex access flag is invalid.");
      }
    }
  }
  return record;
}

function executionBody(execution: MechanismLiteratureExecution) {
  const { executionFingerprint: _fingerprint, ...body } = execution;
  return body;
}

function unique<T>(values: readonly T[]) {
  return [...new Set(values)];
}

export function createMechanismLiteratureExecution(input: {
  snapshotId: string;
  ordinal: number;
  literaturePlan: MechanismLiteraturePlan;
  executionPlan: MechanismLiteratureExecutionPlan;
  previous: MechanismLiteratureExecution | null;
  attempt: MechanismLiteratureProviderAttempt | null;
  newMetadataRecordIds: string[];
  recordedAt: string;
}) {
  requireBoundedIdentifier(input.snapshotId, "Screen 5 execution snapshot id");
  requireCanonicalInstant(input.recordedAt, "Screen 5 execution recordedAt");
  validateMechanismLiteratureExecutionPlan(
    input.executionPlan,
    input.literaturePlan,
  );
  if (!Number.isSafeInteger(input.ordinal) || input.ordinal < 1) {
    throw new Error("Screen 5 execution ordinal is invalid.");
  }
  const pending = input.executionPlan.steps.filter(({ initialStatus }) =>
    initialStatus === "pending").map(({ id }) => id);
  const priorCompleted = input.previous?.completedStepIds ?? [];
  if (input.previous) {
    validateMechanismLiteratureExecution(input.previous, input.executionPlan);
    if (
      input.previous.executionPlanFingerprint !==
        input.executionPlan.planFingerprint ||
      input.previous.status === "complete"
    ) throw new Error("Screen 5 execution cannot continue from this snapshot.");
  }
  if (!input.attempt && pending.length) {
    throw new Error("A runnable Screen 5 plan requires a provider attempt.");
  }
  if (input.attempt) {
    validateMechanismLiteratureProviderAttempt(input.attempt);
    const step = input.executionPlan.steps.find(({ id }) =>
      id === input.attempt!.stepId);
    if (
      !step || step.initialStatus !== "pending" ||
      step.rowId !== input.attempt.rowId || step.branch !== input.attempt.branch ||
      step.providerId !== input.attempt.providerId ||
      step.plannedLimit !== input.attempt.requestedLimit ||
      input.attempt.queryFingerprint !== fingerprintSixScreenValue({
        executionPlanFingerprint: input.executionPlan.planFingerprint,
        stepId: step.id,
        requestUrl: input.attempt.requestUrl,
      }) ||
      priorCompleted.includes(step.id) ||
      input.newMetadataRecordIds.some((id) =>
        input.previous?.scholarlyMetadataRecordIds.includes(id)) ||
      input.attempt.scholarlyMetadataRecordIds.join("\u0000") !==
        input.newMetadataRecordIds.join("\u0000")
    ) throw new Error("Screen 5 provider attempt does not match its step.");
  } else if (input.newMetadataRecordIds.length) {
    throw new Error("Screen 5 scholarly metadata requires a provider attempt.");
  }
  const completedStepIds = input.attempt
    ? [...priorCompleted, input.attempt.stepId]
    : [];
  const remainingStepIds = pending.filter((id) => !completedStepIds.includes(id));
  const scholarlyMetadataRecordIds = unique([
    ...(input.previous?.scholarlyMetadataRecordIds ?? []),
    ...input.newMetadataRecordIds,
  ]);
  const initiallyUnavailable = input.executionPlan.steps.filter(({ initialStatus }) =>
    initialStatus !== "pending" && initialStatus !== "budget_excluded"
  ).map(({ providerId }) => providerId);
  const unavailableProviderIds = unique([
    ...(input.previous?.unavailableProviderIds ?? initiallyUnavailable),
    ...(input.attempt?.outcome === "source_unavailable"
      ? [input.attempt.providerId]
      : []),
  ]);
  const processedProviderIds = unique([
    ...(input.previous?.actualSearchBoundary.processedProviderIds ?? []),
    ...(input.attempt ? [input.attempt.providerId] : []),
  ]);
  const searchedProviderIds = unique([
    ...(input.previous?.actualSearchBoundary.searchedProviderIds ?? []),
    ...(input.attempt?.usage.sourceQueries ? [input.attempt.providerId] : []),
  ]);
  const status = remainingStepIds.length ? "active" as const : "complete" as const;
  const startedAt = input.previous?.actualSearchBoundary.startedAt ??
    input.attempt?.startedAt ?? input.recordedAt;
  const body: ExecutionBody = {
    schemaVersion: SIX_SCREEN_MECHANISM_LITERATURE_EXECUTION_VERSION,
    snapshotId: input.snapshotId,
    ordinal: input.ordinal,
    literaturePlanSnapshotId: input.literaturePlan.snapshotId,
    literaturePlanFingerprint: input.literaturePlan.planFingerprint,
    executionPlanId: input.executionPlan.id,
    executionPlanFingerprint: input.executionPlan.planFingerprint,
    previousExecutionSnapshotId: input.previous?.snapshotId ?? null,
    attempt: input.attempt ? structuredClone(input.attempt) : null,
    status,
    completedStepIds,
    remainingStepIds,
    scholarlyMetadataRecordIds,
    unavailableProviderIds,
    actualSearchBoundary: {
      startedAt,
      completedAt: status === "complete" ? input.recordedAt : null,
      processedProviderIds,
      searchedProviderIds,
      processedStepIds: [...completedStepIds],
      sourceQueries:
        (input.previous?.actualSearchBoundary.sourceQueries ?? 0) +
        (input.attempt?.usage.sourceQueries ?? 0),
      metadataRecords:
        (input.previous?.actualSearchBoundary.metadataRecords ?? 0) +
        (input.attempt?.usage.metadataRecords ?? 0),
      retainedMetadataRecordCount: scholarlyMetadataRecordIds.length,
      anyProviderLimitReached:
        Boolean(input.previous?.actualSearchBoundary.anyProviderLimitReached) ||
        Boolean(input.attempt?.limitReached),
      citationNeighborhoodHops: 0,
      documentAttempts: 0,
      stopReason: status === "complete"
        ? pending.length
          ? "planned_steps_exhausted"
          : "no_executable_provider_route"
        : null,
    },
    evidenceStatus: {
      scholarlyMetadata: scholarlyMetadataRecordIds.length
        ? "retrieved"
        : "not_retrieved",
      scholarlyText: "not_inspected",
      suppliedWorks: input.literaturePlan.evidenceStatus.suppliedWorks,
    },
    intelligenceAnalysis: {
      status: "blocked",
      reason: scholarlyMetadataRecordIds.length
        ? "scholarly_passages_unavailable"
        : "genuine_intelligence_path_unverified",
    },
    claimBoundary: EXECUTION_CLAIM_BOUNDARY,
    recordedAt: input.recordedAt,
  };
  const execution = {
    ...body,
    executionFingerprint: fingerprintSixScreenValue(body),
  };
  return validateMechanismLiteratureExecution(execution, input.executionPlan);
}

export function validateMechanismLiteratureExecution(
  execution: MechanismLiteratureExecution,
  plan: MechanismLiteratureExecutionPlan,
) {
  if (
    execution.schemaVersion !== SIX_SCREEN_MECHANISM_LITERATURE_EXECUTION_VERSION ||
    execution.executionFingerprint !== fingerprintSixScreenValue(executionBody(execution)) ||
    execution.literaturePlanSnapshotId !== plan.literaturePlanSnapshotId ||
    execution.literaturePlanFingerprint !== plan.literaturePlanFingerprint ||
    execution.executionPlanId !== plan.id ||
    execution.executionPlanFingerprint !== plan.planFingerprint ||
    execution.completedStepIds.join("\u0000") !==
      execution.actualSearchBoundary.processedStepIds.join("\u0000") ||
    execution.actualSearchBoundary.retainedMetadataRecordCount !==
      execution.scholarlyMetadataRecordIds.length ||
    execution.actualSearchBoundary.citationNeighborhoodHops !== 0 ||
    execution.actualSearchBoundary.documentAttempts !== 0 ||
    execution.evidenceStatus.scholarlyText !== "not_inspected" ||
    execution.intelligenceAnalysis.status !== "blocked" ||
    execution.intelligenceAnalysis.reason !==
      (execution.scholarlyMetadataRecordIds.length
        ? "scholarly_passages_unavailable"
        : "genuine_intelligence_path_unverified") ||
    execution.claimBoundary !== EXECUTION_CLAIM_BOUNDARY ||
    execution.actualSearchBoundary.sourceQueries > plan.sourceQueryCeiling ||
    execution.actualSearchBoundary.metadataRecords > plan.metadataRecordCeiling
  ) throw new Error("Screen 5 literature execution is invalid.");
  requireBoundedIdentifier(execution.snapshotId, "Screen 5 execution snapshot id");
  if (!Number.isSafeInteger(execution.ordinal) || execution.ordinal < 1) {
    throw new Error("Screen 5 execution ordinal is invalid.");
  }
  if (execution.previousExecutionSnapshotId) {
    requireBoundedIdentifier(
      execution.previousExecutionSnapshotId,
      "Screen 5 previous execution snapshot id",
    );
  }
  requireCanonicalInstant(execution.recordedAt, "Screen 5 execution recordedAt");
  requireCanonicalInstant(
    execution.actualSearchBoundary.startedAt,
    "Screen 5 search boundary startedAt",
  );
  if (execution.actualSearchBoundary.completedAt) {
    requireCanonicalInstant(
      execution.actualSearchBoundary.completedAt,
      "Screen 5 search boundary completedAt",
    );
  }
  if (
    Date.parse(execution.actualSearchBoundary.startedAt) >
      Date.parse(execution.recordedAt) ||
    (execution.actualSearchBoundary.completedAt !== null &&
      execution.actualSearchBoundary.completedAt !== execution.recordedAt)
  ) throw new Error("Screen 5 execution chronology is invalid.");
  requireFingerprint(execution.executionPlanFingerprint, "Screen 5 execution-plan fingerprint");
  requireUniqueTextList(execution.completedStepIds, "Screen 5 completed steps", 6);
  requireUniqueTextList(execution.remainingStepIds, "Screen 5 remaining steps", 6);
  requireUniqueTextList(
    execution.scholarlyMetadataRecordIds,
    "Screen 5 scholarly record ids",
    SIX_SCREEN_MECHANISM_LITERATURE_MAX_METADATA_RECORDS,
  );
  for (const [values, label] of [
    [execution.unavailableProviderIds, "unavailable providers"],
    [execution.actualSearchBoundary.processedProviderIds, "processed providers"],
    [execution.actualSearchBoundary.searchedProviderIds, "searched providers"],
  ] as const) {
    if (
      values.length > 2 || new Set(values).size !== values.length ||
      values.some((id) => !["openalex", "crossref"].includes(id))
    ) throw new Error(`Screen 5 ${label} are invalid.`);
  }
  for (const key of [
    "sourceQueries",
    "metadataRecords",
    "retainedMetadataRecordCount",
  ] as const) {
    requireNonnegative(
      execution.actualSearchBoundary[key],
      `Screen 5 ${key}`,
    );
  }
  const pending = plan.steps.filter(({ initialStatus }) =>
    initialStatus === "pending").map(({ id }) => id);
  const expectedCompleted = pending.slice(0, execution.completedStepIds.length);
  const expectedRemaining = pending.slice(execution.completedStepIds.length);
  const initialUnavailable = unique(plan.steps.filter(({ initialStatus }) =>
    initialStatus !== "pending" && initialStatus !== "budget_excluded"
  ).map(({ providerId }) => providerId));
  if (
    execution.completedStepIds.join("\u0000") !==
      expectedCompleted.join("\u0000") ||
    execution.remainingStepIds.join("\u0000") !==
      expectedRemaining.join("\u0000") ||
    execution.actualSearchBoundary.processedProviderIds.some((provider) =>
      !execution.actualSearchBoundary.searchedProviderIds.includes(provider) &&
      execution.attempt?.outcome !== "unsupported_request") ||
    execution.actualSearchBoundary.searchedProviderIds.some((provider) =>
      !execution.actualSearchBoundary.processedProviderIds.includes(provider)) ||
    initialUnavailable.some((provider) =>
      !execution.unavailableProviderIds.includes(provider)) ||
    execution.actualSearchBoundary.retainedMetadataRecordCount >
      execution.actualSearchBoundary.metadataRecords ||
    typeof execution.actualSearchBoundary.anyProviderLimitReached !== "boolean" ||
    execution.status !== (execution.remainingStepIds.length ? "active" : "complete") ||
    Boolean(execution.actualSearchBoundary.completedAt) !==
      (execution.status === "complete") ||
    execution.actualSearchBoundary.stopReason !==
      (execution.status === "complete"
        ? pending.length
          ? "planned_steps_exhausted"
          : "no_executable_provider_route"
        : null) ||
    execution.evidenceStatus.scholarlyMetadata !==
      (execution.scholarlyMetadataRecordIds.length
        ? "retrieved"
        : "not_retrieved")
  ) throw new Error("Screen 5 execution progress is inconsistent.");
  if (!pending.length) {
    if (
      execution.ordinal !== 1 || execution.previousExecutionSnapshotId !== null ||
      execution.attempt !== null || execution.completedStepIds.length !== 0 ||
      execution.actualSearchBoundary.sourceQueries !== 0 ||
      execution.actualSearchBoundary.metadataRecords !== 0 ||
      execution.actualSearchBoundary.processedProviderIds.length !== 0 ||
      execution.actualSearchBoundary.searchedProviderIds.length !== 0
    ) throw new Error("Screen 5 no-route execution is inconsistent.");
  } else if (
    execution.completedStepIds.length !== execution.ordinal ||
    execution.actualSearchBoundary.sourceQueries > execution.ordinal ||
    execution.attempt === null
  ) throw new Error("Screen 5 bounded step chronology is inconsistent.");
  if (execution.attempt) {
    validateMechanismLiteratureProviderAttempt(execution.attempt);
    const step = plan.steps.find(({ id }) => id === execution.attempt?.stepId);
    if (
      !step || step.initialStatus !== "pending" ||
      execution.completedStepIds.at(-1) !== execution.attempt.stepId ||
      step.rowId !== execution.attempt.rowId ||
      step.branch !== execution.attempt.branch ||
      step.providerId !== execution.attempt.providerId ||
      step.plannedLimit !== execution.attempt.requestedLimit ||
      execution.attempt.queryFingerprint !== fingerprintSixScreenValue({
        executionPlanFingerprint: plan.planFingerprint,
        stepId: step.id,
        requestUrl: execution.attempt.requestUrl,
      }) ||
      (execution.attempt.outcome === "source_unavailable" &&
        !execution.unavailableProviderIds.includes(execution.attempt.providerId))
    ) {
      throw new Error("Screen 5 execution omitted its provider attempt step.");
    }
  }
  return execution;
}

function packetBody(packet: ScholarlyEvidencePacket) {
  const { packetFingerprint: _fingerprint, ...body } = packet;
  return body;
}

export function createScholarlyEvidencePacket(input: {
  snapshotId: string;
  ordinal: number;
  literaturePlan: MechanismLiteraturePlan;
  execution: MechanismLiteratureExecution;
  previous: ScholarlyEvidencePacket | null;
  records: ScholarlyMetadataRecord[];
  createdAt: string;
}) {
  requireBoundedIdentifier(input.snapshotId, "Screen 5 evidence-packet id");
  requireCanonicalInstant(input.createdAt, "Screen 5 evidence-packet createdAt");
  if (!Number.isSafeInteger(input.ordinal) || input.ordinal < 1) {
    throw new Error("Screen 5 evidence-packet ordinal is invalid.");
  }
  validateMechanismLiteraturePlan(input.literaturePlan);
  const recordMap = new Map(input.records.map((record) => {
    validateScholarlyMetadataRecord(record);
    return [record.id, record];
  }));
  if (
    recordMap.size !== input.records.length ||
    input.execution.scholarlyMetadataRecordIds.some((id) => !recordMap.has(id)) ||
    input.execution.scholarlyMetadataRecordIds.length !== input.records.length
  ) throw new Error("Screen 5 evidence packet requires the exact cumulative metadata set.");
  const body: PacketBody = {
    schemaVersion: SIX_SCREEN_SCHOLARLY_EVIDENCE_PACKET_VERSION,
    snapshotId: input.snapshotId,
    ordinal: input.ordinal,
    binding: {
      literaturePlanSnapshotId: input.literaturePlan.snapshotId,
      literaturePlanFingerprint: input.literaturePlan.planFingerprint,
      executionSnapshotId: input.execution.snapshotId,
      executionFingerprint: input.execution.executionFingerprint,
      previousPacketSnapshotId: input.previous?.snapshotId ?? null,
    },
    policyPremiseReferences: input.literaturePlan.policyPremises.map((premise) => ({
      claimId: premise.claimId,
      premiseFingerprint: fingerprintSixScreenValue(premise),
      passageIds: [...premise.passageIds],
      documentVersionIds: [...premise.documentVersionIds],
      sourceIds: [...premise.sourceIds],
    })),
    suppliedWorkReferences: input.literaturePlan.input.suppliedWorks.map((work) => ({
      id: work.id,
      kind: work.kind,
      value: work.value,
      inspectionStatus: "not_inspected" as const,
    })),
    scholarlyMetadataReferences: input.execution.scholarlyMetadataRecordIds.map(
      (id) => {
        const record = recordMap.get(id)!;
        return {
          recordId: record.id,
          recordFingerprint: record.recordFingerprint,
          providerId: record.providerId,
          doi: record.doi,
          inspectionStatus: "metadata_only" as const,
        };
      },
    ),
    inspectedTexts: [],
    scholarlyPassages: [],
    status: input.records.length ? "metadata_only" : "no_scholarly_metadata",
    detailedClaimEligibility: {
      eligible: false,
      reason: "no_inspected_scholarly_passages",
    },
    mechanismCandidates: [],
    predictionMatrix: null,
    searchBoundary: structuredClone(input.execution.actualSearchBoundary),
    intelligenceAnalysis: structuredClone(input.execution.intelligenceAnalysis),
    claimBoundary: PACKET_CLAIM_BOUNDARY,
    createdAt: input.createdAt,
  };
  const packet = {
    ...body,
    packetFingerprint: fingerprintSixScreenValue(body),
  };
  return validateScholarlyEvidencePacket({
    packet,
    literaturePlan: input.literaturePlan,
    execution: input.execution,
    records: input.records,
  });
}

export function validateScholarlyEvidencePacket(input: {
  packet: ScholarlyEvidencePacket;
  literaturePlan: MechanismLiteraturePlan;
  execution: MechanismLiteratureExecution;
  records: readonly ScholarlyMetadataRecord[];
}) {
  const { packet, literaturePlan, execution, records } = input;
  const recordMap = new Map(records.map((record) => {
    validateScholarlyMetadataRecord(record);
    return [record.id, record];
  }));
  if (
    packet.schemaVersion !== SIX_SCREEN_SCHOLARLY_EVIDENCE_PACKET_VERSION ||
    packet.packetFingerprint !== fingerprintSixScreenValue(packetBody(packet)) ||
    packet.binding.literaturePlanSnapshotId !== literaturePlan.snapshotId ||
    packet.binding.literaturePlanFingerprint !== literaturePlan.planFingerprint ||
    packet.binding.executionSnapshotId !== execution.snapshotId ||
    packet.binding.executionFingerprint !== execution.executionFingerprint ||
    recordMap.size !== records.length ||
    packet.policyPremiseReferences.length !== literaturePlan.policyPremises.length ||
    packet.suppliedWorkReferences.length !== literaturePlan.input.suppliedWorks.length ||
    packet.scholarlyMetadataReferences.length !==
      execution.scholarlyMetadataRecordIds.length ||
    packet.inspectedTexts.length !== 0 || packet.scholarlyPassages.length !== 0 ||
    packet.mechanismCandidates.length !== 0 || packet.predictionMatrix !== null ||
    packet.detailedClaimEligibility.eligible !== false ||
    packet.detailedClaimEligibility.reason !== "no_inspected_scholarly_passages" ||
    packet.claimBoundary !== PACKET_CLAIM_BOUNDARY ||
    packet.status !==
      (packet.scholarlyMetadataReferences.length
        ? "metadata_only"
        : "no_scholarly_metadata") ||
    fingerprintSixScreenValue(packet.searchBoundary) !==
      fingerprintSixScreenValue(execution.actualSearchBoundary) ||
    fingerprintSixScreenValue(packet.intelligenceAnalysis) !==
      fingerprintSixScreenValue(execution.intelligenceAnalysis)
  ) throw new Error("Screen 5 scholarly evidence packet is invalid.");
  requireBoundedIdentifier(packet.snapshotId, "Screen 5 evidence-packet id");
  if (!Number.isSafeInteger(packet.ordinal) || packet.ordinal < 1) {
    throw new Error("Screen 5 evidence-packet ordinal is invalid.");
  }
  if (packet.binding.previousPacketSnapshotId) {
    requireBoundedIdentifier(
      packet.binding.previousPacketSnapshotId,
      "Screen 5 previous evidence-packet id",
    );
  }
  requireCanonicalInstant(packet.createdAt, "Screen 5 evidence-packet createdAt");
  requireFingerprint(packet.binding.executionFingerprint, "Screen 5 execution fingerprint");
  for (const [index, reference] of packet.policyPremiseReferences.entries()) {
    const premise = literaturePlan.policyPremises[index];
    if (
      !premise || reference.claimId !== premise.claimId ||
      reference.premiseFingerprint !== fingerprintSixScreenValue(premise) ||
      reference.passageIds.join("\u0000") !== premise.passageIds.join("\u0000") ||
      reference.documentVersionIds.join("\u0000") !==
        premise.documentVersionIds.join("\u0000") ||
      reference.sourceIds.join("\u0000") !== premise.sourceIds.join("\u0000")
    ) throw new Error("Screen 5 evidence packet changed policy-premise lineage.");
  }
  for (const [index, reference] of packet.suppliedWorkReferences.entries()) {
    const work = literaturePlan.input.suppliedWorks[index];
    if (!work || reference.id !== work.id || reference.kind !== work.kind ||
        reference.value !== work.value ||
        reference.inspectionStatus !== "not_inspected") {
      throw new Error("Screen 5 evidence packet changed a supplied-work boundary.");
    }
  }
  for (const [index, reference] of packet.scholarlyMetadataReferences.entries()) {
    const expectedId = execution.scholarlyMetadataRecordIds[index];
    const record = recordMap.get(reference.recordId);
    if (
      reference.recordId !== expectedId || !record ||
      reference.recordFingerprint !== record.recordFingerprint ||
      reference.providerId !== record.providerId || reference.doi !== record.doi ||
      reference.inspectionStatus !== "metadata_only"
    ) throw new Error("Screen 5 evidence packet changed scholarly metadata lineage.");
  }
  return packet;
}

export function validateMechanismLiteratureExecutionCollections(input: {
  literaturePlans: readonly MechanismLiteraturePlan[];
  executionPlans: readonly MechanismLiteratureExecutionPlan[];
  executions: readonly MechanismLiteratureExecution[];
  records: readonly ScholarlyMetadataRecord[];
  packets: readonly ScholarlyEvidencePacket[];
}) {
  if (
    input.executionPlans.length >
      SIX_SCREEN_MECHANISM_LITERATURE_MAX_EXECUTION_PLANS ||
    input.executions.length > SIX_SCREEN_MECHANISM_LITERATURE_MAX_EXECUTIONS ||
    input.records.length > SIX_SCREEN_MECHANISM_LITERATURE_MAX_METADATA_RECORDS ||
    input.packets.length > SIX_SCREEN_MECHANISM_LITERATURE_MAX_EVIDENCE_PACKETS ||
    bytes({
      executionPlans: input.executionPlans,
      executions: input.executions,
      records: input.records,
      packets: input.packets,
    }) > SIX_SCREEN_MECHANISM_LITERATURE_EXECUTION_MAX_BYTES
  ) throw new Error("Stored Screen 5 scholarly execution exceeds its bounded capacity.");
  for (const collection of [
    input.executionPlans.map(({ id }) => id),
    input.executions.map(({ snapshotId }) => snapshotId),
    input.records.map(({ id }) => id),
    input.packets.map(({ snapshotId }) => snapshotId),
  ]) {
    if (new Set(collection).size !== collection.length) {
      throw new Error("Stored Screen 5 scholarly execution ids must be unique.");
    }
  }
  const literaturePlanMap = new Map(input.literaturePlans.map((plan) =>
    [plan.snapshotId, plan]));
  const executionPlanMap = new Map<string, MechanismLiteratureExecutionPlan>();
  for (const plan of input.executionPlans) {
    const literaturePlan = literaturePlanMap.get(plan.literaturePlanSnapshotId);
    if (!literaturePlan) {
      throw new Error("Screen 5 execution plan lost its literature-plan lineage.");
    }
    validateMechanismLiteratureExecutionPlan(plan, literaturePlan);
    if ([...executionPlanMap.values()].some((value) =>
      value.literaturePlanSnapshotId === plan.literaturePlanSnapshotId)) {
      throw new Error("A Screen 5 literature plan has multiple execution plans.");
    }
    executionPlanMap.set(plan.id, plan);
  }
  const recordMap = new Map(input.records.map((record) => {
    validateScholarlyMetadataRecord(record);
    return [record.id, record];
  }));
  const executionMap = new Map<string, MechanismLiteratureExecution>();
  const latestExecutionByPlan = new Map<string, MechanismLiteratureExecution>();
  const attemptIds = new Set<string>();
  for (const execution of input.executions) {
    const plan = executionPlanMap.get(execution.executionPlanId);
    if (!plan) throw new Error("Screen 5 execution lost its immutable plan.");
    validateMechanismLiteratureExecution(execution, plan);
    const attempt = execution.attempt;
    const expectedPrevious = latestExecutionByPlan.get(execution.executionPlanId) ?? null;
    const previous = execution.previousExecutionSnapshotId
      ? executionMap.get(execution.previousExecutionSnapshotId)
      : null;
    const expectedRecordIds = [
      ...(previous?.scholarlyMetadataRecordIds ?? []),
      ...(attempt?.scholarlyMetadataRecordIds ?? []),
    ];
    const expectedSourceQueries =
      (previous?.actualSearchBoundary.sourceQueries ?? 0) +
      (attempt?.usage.sourceQueries ?? 0);
    const expectedMetadataRecords =
      (previous?.actualSearchBoundary.metadataRecords ?? 0) +
      (attempt?.usage.metadataRecords ?? 0);
    const initiallyUnavailable = unique(plan.steps.filter(({ initialStatus }) =>
      initialStatus !== "pending" && initialStatus !== "budget_excluded"
    ).map(({ providerId }) => providerId));
    const expectedUnavailable = unique([
      ...(previous?.unavailableProviderIds ?? initiallyUnavailable),
      ...(attempt?.outcome === "source_unavailable"
        ? [attempt.providerId]
        : []),
    ]);
    const expectedProcessed = unique([
      ...(previous?.actualSearchBoundary.processedProviderIds ?? []),
      ...(attempt ? [attempt.providerId] : []),
    ]);
    const expectedSearched = unique([
      ...(previous?.actualSearchBoundary.searchedProviderIds ?? []),
      ...(attempt?.usage.sourceQueries
        ? [attempt.providerId]
        : []),
    ]);
    if (
      execution.ordinal !== (previous?.ordinal ?? 0) + 1 ||
      Boolean(execution.previousExecutionSnapshotId) !== Boolean(previous) ||
      previous !== expectedPrevious ||
      (previous &&
        (previous.executionPlanFingerprint !== execution.executionPlanFingerprint ||
          previous.literaturePlanSnapshotId !==
            execution.literaturePlanSnapshotId)) ||
      execution.evidenceStatus.suppliedWorks !==
        literaturePlanMap.get(execution.literaturePlanSnapshotId)
          ?.evidenceStatus.suppliedWorks ||
      execution.scholarlyMetadataRecordIds.join("\u0000") !==
        expectedRecordIds.join("\u0000") ||
      execution.actualSearchBoundary.sourceQueries !== expectedSourceQueries ||
      execution.actualSearchBoundary.metadataRecords !== expectedMetadataRecords ||
      execution.unavailableProviderIds.join("\u0000") !==
        expectedUnavailable.join("\u0000") ||
      execution.actualSearchBoundary.processedProviderIds.join("\u0000") !==
        expectedProcessed.join("\u0000") ||
      execution.actualSearchBoundary.searchedProviderIds.join("\u0000") !==
        expectedSearched.join("\u0000") ||
      execution.actualSearchBoundary.anyProviderLimitReached !==
        (Boolean(previous?.actualSearchBoundary.anyProviderLimitReached) ||
          Boolean(execution.attempt?.limitReached)) ||
      execution.completedStepIds.join("\u0000") !== [
        ...(previous?.completedStepIds ?? []),
        ...(attempt ? [attempt.stepId] : []),
      ].join("\u0000") ||
      (previous && execution.actualSearchBoundary.startedAt !==
        previous.actualSearchBoundary.startedAt) ||
      (!previous && attempt &&
        execution.actualSearchBoundary.startedAt !== attempt.startedAt) ||
      execution.scholarlyMetadataRecordIds.some((id) => !recordMap.has(id)) ||
      (attempt && attempt.scholarlyMetadataRecordIds.some(
        (id) => {
          const record = recordMap.get(id);
          return !record || record.source.attemptId !== attempt.id ||
            record.source.stepId !== attempt.stepId ||
            record.source.rowId !== attempt.rowId ||
            record.source.branch !== attempt.branch ||
            record.source.retrievedAt !== attempt.completedAt ||
            record.source.requestUrl !== attempt.requestUrl;
        },
      ))
    ) throw new Error("Screen 5 execution history or record lineage is invalid.");
    if (attempt && !attemptIds.add(attempt.id)) {
      throw new Error("Screen 5 provider-attempt ids must be unique.");
    }
    executionMap.set(execution.snapshotId, execution);
    latestExecutionByPlan.set(execution.executionPlanId, execution);
  }
  const packetMap = new Map<string, ScholarlyEvidencePacket>();
  const latestPacketByPlan = new Map<string, ScholarlyEvidencePacket>();
  const packetCountByExecution = new Map<string, number>();
  for (const packet of input.packets) {
    const execution = executionMap.get(packet.binding.executionSnapshotId);
    const literaturePlan = literaturePlanMap.get(
      packet.binding.literaturePlanSnapshotId,
    );
    if (!execution || !literaturePlan) {
      throw new Error("Screen 5 evidence packet lost its execution lineage.");
    }
    const records = execution.scholarlyMetadataRecordIds.map((id) =>
      recordMap.get(id)!);
    validateScholarlyEvidencePacket({
      packet,
      literaturePlan,
      execution,
      records,
    });
    const previous = packet.binding.previousPacketSnapshotId
      ? packetMap.get(packet.binding.previousPacketSnapshotId)
      : null;
    const expectedPrevious = latestPacketByPlan.get(
      packet.binding.literaturePlanSnapshotId,
    ) ?? null;
    if (
      packet.ordinal !== (previous?.ordinal ?? 0) + 1 ||
      Boolean(packet.binding.previousPacketSnapshotId) !== Boolean(previous) ||
      previous !== expectedPrevious ||
      packet.ordinal !== execution.ordinal ||
      (previous &&
        (previous.binding.executionSnapshotId !==
            execution.previousExecutionSnapshotId ||
          previous.binding.literaturePlanFingerprint !==
            packet.binding.literaturePlanFingerprint))
    ) throw new Error("Screen 5 evidence-packet history is invalid.");
    packetMap.set(packet.snapshotId, packet);
    latestPacketByPlan.set(packet.binding.literaturePlanSnapshotId, packet);
    packetCountByExecution.set(
      execution.snapshotId,
      (packetCountByExecution.get(execution.snapshotId) ?? 0) + 1,
    );
  }
  if (
    input.executions.some((execution) =>
      packetCountByExecution.get(execution.snapshotId) !== 1) ||
    input.packets.some((packet) => !input.executions.some((execution) =>
      execution.snapshotId === packet.binding.executionSnapshotId)) ||
    input.records.some((record) => !input.executions.some((execution) =>
      execution.scholarlyMetadataRecordIds.includes(record.id)))
  ) throw new Error("Every Screen 5 execution requires one immutable evidence packet.");
  return input;
}
