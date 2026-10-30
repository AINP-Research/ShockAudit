import { fingerprintSixScreenValue } from "./canonical";
import type { SourceCapabilityStatus } from "./capabilities";
import {
  requireBoundedIdentifier,
  requireCanonicalInstant,
  requireFingerprint,
  requireSanitizedSourceUrl,
} from "./contracts";
import {
  COEVENT_PROVIDER_IDS,
  validateCoEventSearchMatrix,
  type CoEventProviderId,
  type CoEventSearchBranch,
  type CoEventSearchMatrix,
} from "./co-event-search";
import type {
  CausalDesignDecision,
  CausalDesignSet,
} from "./causal-comparison";

export const SIX_SCREEN_COEVENT_EXECUTION_PLAN_VERSION =
  "screen-04-coevent-execution-plan-v1" as const;
export const SIX_SCREEN_COEVENT_PROVIDER_ATTEMPT_VERSION =
  "screen-04-coevent-provider-attempt-v1" as const;
export const SIX_SCREEN_COEVENT_CANDIDATE_VERSION =
  "screen-04-coevent-candidate-occurrence-v1" as const;
export const SIX_SCREEN_COEVENT_DISCOVERY_LEAD_VERSION =
  "screen-04-coevent-discovery-lead-v1" as const;
export const SIX_SCREEN_COEVENT_EXECUTION_VERSION =
  "screen-04-coevent-execution-v1" as const;

export const SIX_SCREEN_COEVENT_MAX_EXECUTION_PLANS = 24;
export const SIX_SCREEN_COEVENT_MAX_EXECUTION_SNAPSHOTS = 96;
export const SIX_SCREEN_COEVENT_MAX_CANDIDATES = 100;
export const SIX_SCREEN_COEVENT_MAX_DISCOVERY_LEADS = 100;
export const SIX_SCREEN_COEVENT_EXECUTION_MAX_BYTES = 512_000;

const MAX_SOURCE_QUERIES = 24;
const PARTIAL_DATE = /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/u;
const FULL_DATE = /^\d{4}-\d{2}-\d{2}$/u;

export type CoEventExecutionStepInitialStatus =
  | "pending"
  | "not_configured"
  | "not_implemented"
  | "policy_blocked"
  | "degraded"
  | "quota_exhausted"
  | "operation_not_supported"
  | "request_scope_unsupported"
  | "language_unavailable"
  | "budget_excluded";

export type CoEventProviderExecutionCapability = {
  providerId: CoEventProviderId;
  provider: string;
  adapterVersion: string;
  capabilityStatus: SourceCapabilityStatus;
  implemented: boolean;
  enabled: boolean;
  searchRecords: boolean;
  languageSupported: boolean;
  requestSupported: boolean;
  limitation: string | null;
};

export type CoEventExecutionPlanStep = {
  id: string;
  rowId: string;
  branch: CoEventSearchBranch;
  providerId: CoEventProviderId;
  provider: string;
  adapterVersion: string;
  capabilityStatus: SourceCapabilityStatus;
  queryTerms: string[];
  plannedLimit: number;
  language: "en";
  initialStatus: CoEventExecutionStepInitialStatus;
  statusNote: string | null;
};

export type CoEventExecutionPlan = {
  schemaVersion: typeof SIX_SCREEN_COEVENT_EXECUTION_PLAN_VERSION;
  id: string;
  matrixSnapshotId: string;
  matrixFingerprint: string;
  searchPeriod: { start: string; end: string };
  steps: CoEventExecutionPlanStep[];
  sourceQueryCeiling: 24;
  metadataCandidateCeiling: 100;
  continuationMode: "panel_driven";
  claimBoundary: string;
  createdAt: string;
  planFingerprint: string;
};

export type CoEventExecutionUsage = {
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

export type CoEventProviderAttemptOutcome =
  | "candidates_found"
  | "no_match"
  | "source_unavailable"
  | "records_unusable"
  | "discovery_leads_only"
  | "unsupported_request";

export type CoEventProviderAttempt = {
  schemaVersion: typeof SIX_SCREEN_COEVENT_PROVIDER_ATTEMPT_VERSION;
  id: string;
  stepId: string;
  rowId: string;
  providerId: CoEventProviderId;
  startedAt: string;
  completedAt: string;
  requestUrl: string | null;
  queryFingerprint: string;
  requestedLimit: number;
  recordsReceived: number;
  recordsAccepted: number;
  limitReached: boolean;
  outcome: CoEventProviderAttemptOutcome;
  failureCode: string | null;
  note: string;
  candidateOccurrenceIds: string[];
  discoveryLeadIds: string[];
  usage: CoEventExecutionUsage;
  attemptFingerprint: string;
};

export type CoEventOccurrenceEvidence = {
  sourceId: string;
  title: string;
  locator: string;
  publisher: string;
  publishedDate: string | null;
  authorityTier: 1 | 2 | 3 | 4 | 5 | 6;
  retrievedAt: string;
  evidenceRole: "occurrence_metadata";
  /** Bounded provider-normalized text actually returned with this record. */
  factText?: string | null;
};

export type CoEventCandidateOccurrence = {
  schemaVersion: typeof SIX_SCREEN_COEVENT_CANDIDATE_VERSION;
  id: string;
  providerId: CoEventProviderId;
  sourceNativeId: string;
  title: string;
  description: string;
  eventFamily: string;
  formalIdentifiers: string[];
  typedDates: Array<{
    kind: "event" | "publication" | "effective" | "incident_start";
    value: string;
    precision: "day" | "month" | "year";
    sourceId: string;
  }>;
  affectedActivityOrPopulation: {
    status: "not_established";
    labels: [];
  };
  geography: {
    status: "provider_reported" | "not_established";
    labels: string[];
  };
  evidence: CoEventOccurrenceEvidence[];
  occurrenceStatus: "source_metadata_documented";
  relationToComparison: {
    status: "not_assessed";
    reason: "genuine_intelligence_path_unverified";
  };
  reusableAcrossDesignRevisions: true;
  version: 1;
  recordedAt: string;
  claimBoundary: string;
  candidateFingerprint: string;
};

export type CoEventDiscoveryLead = {
  schemaVersion: typeof SIX_SCREEN_COEVENT_DISCOVERY_LEAD_VERSION;
  id: string;
  providerId: CoEventProviderId;
  sourceNativeId: string;
  title: string;
  locator: string;
  publisher: string;
  publishedDate: string | null;
  sourceRole: "contextual_secondary_metadata";
  occurrenceStatus: "not_established";
  relationStatus: "not_assessed";
  recordedAt: string;
  limitation: string;
  leadFingerprint: string;
};

export type CoEventSearchExecution = {
  schemaVersion: typeof SIX_SCREEN_COEVENT_EXECUTION_VERSION;
  snapshotId: string;
  ordinal: number;
  matrixSnapshotId: string;
  matrixFingerprint: string;
  planId: string;
  planFingerprint: string;
  previousExecutionSnapshotId: string | null;
  attempt: CoEventProviderAttempt | null;
  status: "active" | "complete";
  completedStepIds: string[];
  remainingStepIds: string[];
  candidateOccurrenceIds: string[];
  discoveryLeadIds: string[];
  unavailableProviderIds: CoEventProviderId[];
  unavailableLanguages: string[];
  actualSearchBoundary: {
    periodStart: string;
    periodEnd: string;
    startedAt: string;
    completedAt: string | null;
    processedProviderIds: CoEventProviderId[];
    searchedProviderIds: CoEventProviderId[];
    processedStepIds: string[];
    sourceQueries: number;
    metadataRecords: number;
    retainedCandidateCount: number;
    discoveryLeadCount: number;
    anyProviderLimitReached: boolean;
    stopReason: "planned_steps_exhausted" | "no_executable_provider_route" | null;
  };
  semanticRelationAnalysis: {
    status: "blocked";
    reason: "genuine_intelligence_path_unverified";
  };
  claimBoundary: string;
  recordedAt: string;
  executionFingerprint: string;
};

type PlanBody = Omit<CoEventExecutionPlan, "planFingerprint">;
type AttemptBody = Omit<CoEventProviderAttempt, "attemptFingerprint">;
type CandidateBody = Omit<CoEventCandidateOccurrence, "candidateFingerprint">;
type LeadBody = Omit<CoEventDiscoveryLead, "leadFingerprint">;
type ExecutionBody = Omit<CoEventSearchExecution, "executionFingerprint">;

function bytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function requireText(value: string, label: string, max = 4_000) {
  if (!value || value !== value.trim() || value.length > max) {
    throw new Error(`${label} must be canonical text of at most ${max} characters.`);
  }
  return value;
}

function requireUniqueTextList(
  values: readonly string[],
  label: string,
  maxEntries: number,
) {
  if (
    values.length > maxEntries || new Set(values).size !== values.length
  ) throw new Error(`${label} must be a bounded unique list.`);
  values.forEach((value) => requireText(value, label, 500));
}

function requireNonnegative(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a nonnegative safe integer.`);
  }
}

function requirePartialDate(value: string, label: string) {
  if (!PARTIAL_DATE.test(value)) throw new Error(`${label} must be an ISO date.`);
  const [year, month = "01", day = "01"] = value.split("-");
  const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() + 1 !== Number(month) ||
    date.getUTCDate() !== Number(day)
  ) throw new Error(`${label} must be a valid ISO date.`);
}

function precision(value: string): "day" | "month" | "year" {
  return value.length === 10 ? "day" : value.length === 7 ? "month" : "year";
}

function completeDate(value: string, side: "start" | "end") {
  requirePartialDate(value, "Screen 4 study boundary");
  if (value.length === 10) return value;
  if (value.length === 7) {
    if (side === "start") return `${value}-01`;
    const [year, month] = value.split("-").map(Number);
    const day = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
    return `${value}-${String(day).padStart(2, "0")}`;
  }
  return side === "start" ? `${value}-01-01` : `${value}-12-31`;
}

function shiftedDate(
  value: string,
  amount: number,
  unit: "days" | "months" | "years",
) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  if (unit === "days") date.setUTCDate(date.getUTCDate() + amount);
  else {
    const desiredDay = date.getUTCDate();
    date.setUTCDate(1);
    if (unit === "months") date.setUTCMonth(date.getUTCMonth() + amount);
    else date.setUTCFullYear(date.getUTCFullYear() + amount);
    const lastDay = new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      0,
    )).getUTCDate();
    date.setUTCDate(Math.min(desiredDay, lastDay));
  }
  return date.toISOString().slice(0, 10);
}

function searchPeriod(matrix: CoEventSearchMatrix) {
  const start = completeDate(matrix.scope.studyPeriod.start, "start");
  const end = completeDate(matrix.scope.studyPeriod.end, "end");
  return {
    start: shiftedDate(
      start,
      -matrix.scope.anticipationLookback.amount,
      matrix.scope.anticipationLookback.unit,
    ),
    end: shiftedDate(
      end,
      matrix.scope.contextLookforward.amount,
      matrix.scope.contextLookforward.unit,
    ),
  };
}

function unavailableStatus(
  capability: CoEventProviderExecutionCapability,
): Exclude<CoEventExecutionStepInitialStatus, "pending" | "budget_excluded"> | null {
  if (!capability.implemented) return "not_implemented";
  if (capability.capabilityStatus === "not_configured") return "not_configured";
  if (capability.capabilityStatus === "policy_blocked") return "policy_blocked";
  if (capability.capabilityStatus === "quota_exhausted") return "quota_exhausted";
  if (capability.capabilityStatus === "degraded") return "degraded";
  if (!capability.searchRecords) return "operation_not_supported";
  if (!capability.languageSupported) return "language_unavailable";
  if (!capability.requestSupported) return "request_scope_unsupported";
  if (!capability.enabled) return "degraded";
  return null;
}

function statusNote(
  status: CoEventExecutionStepInitialStatus,
  capability: CoEventProviderExecutionCapability,
) {
  if (status === "pending") return null;
  if (status === "budget_excluded") {
    return "This route was not scheduled because the standard co-event task permits at most 24 source queries.";
  }
  return capability.limitation ?? ({
    not_configured: "This provider is not configured.",
    not_implemented: "A reviewed co-event adapter is not implemented.",
    policy_blocked: "Provider use is blocked by the current source policy.",
    degraded: "The provider capability is degraded.",
    quota_exhausted: "The provider quota is unavailable.",
    operation_not_supported: "The registered adapter cannot perform this search operation.",
    request_scope_unsupported: "The current geography or request scope is unsupported by this adapter.",
    language_unavailable: "The requested English-language route is unavailable.",
  } as const)[status];
}

function planBody(plan: CoEventExecutionPlan) {
  const { planFingerprint: _fingerprint, ...body } = plan;
  return body;
}

export function createCoEventExecutionPlan(input: {
  id: string;
  matrix: CoEventSearchMatrix;
  designSet: CausalDesignSet;
  designDecision: CausalDesignDecision;
  capabilities: CoEventProviderExecutionCapability[];
  createdAt: string;
}) {
  requireBoundedIdentifier(input.id, "Screen 4 execution plan id");
  requireCanonicalInstant(input.createdAt, "Screen 4 execution plan createdAt");
  validateCoEventSearchMatrix(
    input.matrix,
    input.designSet,
    input.designDecision,
  );
  const capabilityMap = new Map(
    input.capabilities.map((capability) => [capability.providerId, capability]),
  );
  if (capabilityMap.size !== input.capabilities.length) {
    throw new Error("Screen 4 provider capabilities must be unique.");
  }
  const preliminary = input.matrix.rows.flatMap((row) =>
    row.providers.map(({ id: providerId }) => {
      const capability = capabilityMap.get(providerId);
      if (!capability) {
        throw new Error(`Screen 4 omitted capability ${providerId}.`);
      }
      const blocked = unavailableStatus(capability);
      return {
        id: `coevent-step-${row.branch.replaceAll("_", "-")}-${providerId.replaceAll("_", "-")}`,
        rowId: row.id,
        branch: row.branch,
        providerId,
        provider: capability.provider,
        adapterVersion: capability.adapterVersion,
        capabilityStatus: capability.capabilityStatus,
        queryTerms: [...row.queryTerms],
        plannedLimit: row.plannedLimit,
        language: "en" as const,
        initialStatus: blocked ?? "pending" as CoEventExecutionStepInitialStatus,
        statusNote: null as string | null,
        capability,
      };
    })
  );
  const pendingKeys = new Set<string>();
  const pendingOrder: string[] = [];
  const maxProviders = Math.max(...input.matrix.rows.map(({ providers }) =>
    providers.length));
  for (let position = 0; position < maxProviders; position += 1) {
    for (const row of input.matrix.rows) {
      const provider = row.providers[position];
      if (!provider) continue;
      const key = `${row.id}\u0000${provider.id}`;
      const entry = preliminary.find((value) =>
        value.rowId === row.id && value.providerId === provider.id);
      if (
        entry?.initialStatus === "pending" &&
        pendingKeys.size < MAX_SOURCE_QUERIES
      ) {
        pendingKeys.add(key);
        pendingOrder.push(key);
      }
    }
  }
  const perPending = pendingOrder.length
    ? Math.floor(100 / pendingOrder.length)
    : 0;
  const pendingRemainder = pendingOrder.length
    ? 100 % pendingOrder.length
    : 0;
  const steps: CoEventExecutionPlanStep[] = preliminary.map((entry) => {
    const key = `${entry.rowId}\u0000${entry.providerId}`;
    const initialStatus = entry.initialStatus === "pending" &&
        !pendingKeys.has(key)
      ? "budget_excluded" as const
      : entry.initialStatus;
    return {
      id: entry.id,
      rowId: entry.rowId,
      branch: entry.branch,
      providerId: entry.providerId,
      provider: entry.provider,
      adapterVersion: entry.adapterVersion,
      capabilityStatus: entry.capabilityStatus,
      queryTerms: entry.queryTerms,
      plannedLimit: initialStatus === "pending"
        ? Math.min(
            entry.plannedLimit,
            perPending +
              (pendingOrder.indexOf(key) < pendingRemainder ? 1 : 0),
          )
        : entry.plannedLimit,
      language: entry.language,
      initialStatus,
      statusNote: statusNote(initialStatus, entry.capability),
    };
  });
  const body: PlanBody = {
    schemaVersion: SIX_SCREEN_COEVENT_EXECUTION_PLAN_VERSION,
    id: input.id,
    matrixSnapshotId: input.matrix.snapshotId,
    matrixFingerprint: input.matrix.matrixFingerprint,
    searchPeriod: searchPeriod(input.matrix),
    steps,
    sourceQueryCeiling: 24,
    metadataCandidateCeiling: 100,
    continuationMode: "panel_driven",
    claimBoundary:
      "This plan schedules bounded provider queries. Capability status is not a search result, and unscheduled or unavailable routes cannot support a no-match conclusion.",
    createdAt: input.createdAt,
  };
  const plan = { ...body, planFingerprint: fingerprintSixScreenValue(body) };
  validateCoEventExecutionPlan(plan, input.matrix);
  return plan;
}

export function validateCoEventExecutionPlan(
  plan: CoEventExecutionPlan,
  matrix: CoEventSearchMatrix,
) {
  if (
    plan.schemaVersion !== SIX_SCREEN_COEVENT_EXECUTION_PLAN_VERSION ||
    plan.planFingerprint !== fingerprintSixScreenValue(planBody(plan)) ||
    plan.matrixSnapshotId !== matrix.snapshotId ||
    plan.matrixFingerprint !== matrix.matrixFingerprint ||
    plan.sourceQueryCeiling !== 24 ||
    plan.metadataCandidateCeiling !== 100 ||
    plan.continuationMode !== "panel_driven"
  ) throw new Error("Screen 4 execution plan is invalid or changed.");
  requireBoundedIdentifier(plan.id, "Screen 4 execution plan id");
  requireCanonicalInstant(plan.createdAt, "Screen 4 execution plan createdAt");
  const expectedSearchPeriod = searchPeriod(matrix);
  if (
    Object.keys(plan.searchPeriod).sort().join("\u0000") !== "end\u0000start" ||
    !FULL_DATE.test(plan.searchPeriod.start) ||
    !FULL_DATE.test(plan.searchPeriod.end) ||
    plan.searchPeriod.start > plan.searchPeriod.end ||
    plan.searchPeriod.start !== expectedSearchPeriod.start ||
    plan.searchPeriod.end !== expectedSearchPeriod.end
  ) throw new Error("Screen 4 execution search period is invalid.");
  const expected = matrix.rows.reduce((count, row) =>
    count + row.providers.length, 0);
  if (
    plan.steps.length !== expected ||
    new Set(plan.steps.map(({ id }) => id)).size !== plan.steps.length ||
    plan.steps.filter(({ initialStatus }) => initialStatus === "pending").length >
      MAX_SOURCE_QUERIES
  ) throw new Error("Screen 4 execution plan steps are invalid.");
  if (
    plan.steps.filter(({ initialStatus }) => initialStatus === "pending")
      .reduce((total, { plannedLimit }) => total + plannedLimit, 0) >
      plan.metadataCandidateCeiling
  ) throw new Error("Screen 4 execution plan exceeds its metadata ceiling.");
  const rowMap = new Map(matrix.rows.map((row) => [row.id, row]));
  for (const step of plan.steps) {
    requireBoundedIdentifier(step.id, "Screen 4 execution step id");
    const row = rowMap.get(step.rowId);
    if (
      !row || row.branch !== step.branch ||
      !row.providers.some(({ id }) => id === step.providerId) ||
      !COEVENT_PROVIDER_IDS.includes(step.providerId) ||
      JSON.stringify(step.queryTerms) !== JSON.stringify(row.queryTerms) ||
      step.plannedLimit > row.plannedLimit || step.language !== "en" ||
      (step.initialStatus === "pending") !== (step.statusNote === null)
    ) throw new Error("Screen 4 execution plan step is invalid.");
    requireText(step.provider, "Screen 4 execution provider", 200);
    requireText(step.adapterVersion, "Screen 4 adapter version", 200);
    requireUniqueTextList(step.queryTerms, "Screen 4 execution query terms", 40);
    if (!Number.isSafeInteger(step.plannedLimit) || step.plannedLimit < 1 ||
        step.plannedLimit > 20) throw new Error("Screen 4 execution limit is invalid.");
    if (step.statusNote) requireText(step.statusNote, "Screen 4 route note", 2_000);
  }
  requireText(plan.claimBoundary, "Screen 4 execution-plan boundary");
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

export function validateCoEventExecutionUsage(usage: CoEventExecutionUsage) {
  usageKeys().forEach((key) => requireNonnegative(
    usage[key],
    `Screen 4 execution usage ${key}`,
  ));
  Object.entries(usage.providerCostUnits).forEach(([provider, value]) => {
    requireBoundedIdentifier(provider, "Screen 4 provider cost id");
    requireNonnegative(value, "Screen 4 provider cost units");
  });
  return usage;
}

function attemptBody(attempt: CoEventProviderAttempt) {
  const { attemptFingerprint: _fingerprint, ...body } = attempt;
  return body;
}

export function createCoEventProviderAttempt(
  input: Omit<CoEventProviderAttempt, "schemaVersion" | "attemptFingerprint">,
) {
  const body: AttemptBody = {
    schemaVersion: SIX_SCREEN_COEVENT_PROVIDER_ATTEMPT_VERSION,
    ...structuredClone(input),
  };
  const attempt = {
    ...body,
    attemptFingerprint: fingerprintSixScreenValue(body),
  };
  validateCoEventProviderAttempt(attempt);
  return attempt;
}

export function validateCoEventProviderAttempt(
  attempt: CoEventProviderAttempt,
) {
  if (
    attempt.schemaVersion !== SIX_SCREEN_COEVENT_PROVIDER_ATTEMPT_VERSION ||
    attempt.attemptFingerprint !==
      fingerprintSixScreenValue(attemptBody(attempt)) ||
    !COEVENT_PROVIDER_IDS.includes(attempt.providerId)
  ) throw new Error("Screen 4 provider attempt is invalid or changed.");
  requireBoundedIdentifier(attempt.id, "Screen 4 provider attempt id");
  requireBoundedIdentifier(attempt.stepId, "Screen 4 provider attempt step id");
  requireBoundedIdentifier(attempt.rowId, "Screen 4 provider attempt row id");
  requireCanonicalInstant(attempt.startedAt, "Screen 4 provider attempt start");
  requireCanonicalInstant(attempt.completedAt, "Screen 4 provider attempt end");
  if (attempt.completedAt < attempt.startedAt) {
    throw new Error("Screen 4 provider attempt ended before it started.");
  }
  if (attempt.requestUrl) requireSanitizedSourceUrl(attempt.requestUrl);
  requireFingerprint(attempt.queryFingerprint, "Screen 4 query fingerprint");
  for (const [label, value] of [
    ["requested limit", attempt.requestedLimit],
    ["records received", attempt.recordsReceived],
    ["records accepted", attempt.recordsAccepted],
  ] as const) requireNonnegative(value, `Screen 4 ${label}`);
  if (attempt.requestedLimit < 1 || attempt.requestedLimit > 20) {
    throw new Error("Screen 4 requested limit is invalid.");
  }
  requireUniqueTextList(
    attempt.candidateOccurrenceIds,
    "Screen 4 attempt candidate ids",
    100,
  );
  requireUniqueTextList(
    attempt.discoveryLeadIds,
    "Screen 4 attempt discovery lead ids",
    100,
  );
  requireText(attempt.note, "Screen 4 attempt note", 2_000);
  validateCoEventExecutionUsage(attempt.usage);
  if (
    (attempt.outcome === "candidates_found" &&
      !attempt.candidateOccurrenceIds.length) ||
    (attempt.outcome === "discovery_leads_only" &&
      !attempt.discoveryLeadIds.length) ||
    ([
      "no_match",
      "source_unavailable",
      "records_unusable",
      "unsupported_request",
    ] as const)
      .includes(attempt.outcome as never) &&
      (attempt.candidateOccurrenceIds.length || attempt.discoveryLeadIds.length) ||
    (["source_unavailable", "records_unusable"] as const)
      .includes(attempt.outcome as never) !==
      (attempt.failureCode !== null) ||
    (attempt.outcome === "unsupported_request" &&
      (attempt.requestUrl !== null || attempt.usage.sourceQueries !== 0)) ||
    (attempt.outcome !== "unsupported_request" &&
      (attempt.requestUrl === null || attempt.usage.sourceQueries !== 1))
  ) throw new Error("Screen 4 provider outcome does not match its evidence.");
  if (
    attempt.recordsAccepted > attempt.recordsReceived ||
    attempt.recordsReceived > attempt.requestedLimit ||
    attempt.usage.metadataRecords !== attempt.recordsReceived ||
    attempt.usage.documentAttempts !== 0 ||
    attempt.usage.usefulDocuments !== 0 ||
    attempt.usage.transportHops > 1 ||
    (attempt.outcome === "candidates_found" &&
      attempt.recordsAccepted < attempt.candidateOccurrenceIds.length) ||
    (attempt.outcome === "discovery_leads_only" &&
      attempt.recordsAccepted < attempt.discoveryLeadIds.length)
  ) throw new Error("Screen 4 provider attempt usage is inconsistent.");
  if (attempt.failureCode) {
    requireText(attempt.failureCode, "Screen 4 provider failure code", 100);
  }
  return attempt;
}

function candidateBody(candidate: CoEventCandidateOccurrence) {
  const { candidateFingerprint: _fingerprint, ...body } = candidate;
  return body;
}

export function createCoEventCandidateOccurrence(input: Omit<
  CoEventCandidateOccurrence,
  | "schemaVersion"
  | "affectedActivityOrPopulation"
  | "occurrenceStatus"
  | "relationToComparison"
  | "reusableAcrossDesignRevisions"
  | "version"
  | "claimBoundary"
  | "candidateFingerprint"
>) {
  const body: CandidateBody = {
    schemaVersion: SIX_SCREEN_COEVENT_CANDIDATE_VERSION,
    ...structuredClone(input),
    affectedActivityOrPopulation: { status: "not_established", labels: [] },
    occurrenceStatus: "source_metadata_documented",
    relationToComparison: {
      status: "not_assessed",
      reason: "genuine_intelligence_path_unverified",
    },
    reusableAcrossDesignRevisions: true,
    version: 1,
    claimBoundary:
      "This record supports occurrence from source metadata only. It does not establish exposure, relevance to the comparison, confounding, mediation, spillover, or a recommended control.",
  };
  const candidate = {
    ...body,
    candidateFingerprint: fingerprintSixScreenValue(body),
  };
  validateCoEventCandidateOccurrence(candidate);
  return candidate;
}

export function validateCoEventCandidateOccurrence(
  candidate: CoEventCandidateOccurrence,
) {
  if (
    candidate.schemaVersion !== SIX_SCREEN_COEVENT_CANDIDATE_VERSION ||
    candidate.candidateFingerprint !==
      fingerprintSixScreenValue(candidateBody(candidate)) ||
    !COEVENT_PROVIDER_IDS.includes(candidate.providerId) ||
    candidate.occurrenceStatus !== "source_metadata_documented" ||
    candidate.relationToComparison.status !== "not_assessed" ||
    candidate.relationToComparison.reason !==
      "genuine_intelligence_path_unverified" ||
    candidate.reusableAcrossDesignRevisions !== true || candidate.version !== 1 ||
    candidate.affectedActivityOrPopulation.status !== "not_established" ||
    candidate.affectedActivityOrPopulation.labels.length
  ) throw new Error("Screen 4 candidate occurrence is invalid or changed.");
  requireBoundedIdentifier(candidate.id, "Screen 4 candidate occurrence id");
  requireText(candidate.sourceNativeId, "Screen 4 source-native candidate id", 500);
  requireText(candidate.title, "Screen 4 candidate title", 1_000);
  requireText(candidate.description, "Screen 4 candidate description");
  requireText(candidate.eventFamily, "Screen 4 candidate event family", 500);
  requireUniqueTextList(candidate.formalIdentifiers, "Screen 4 candidate identifiers", 20);
  requireCanonicalInstant(candidate.recordedAt, "Screen 4 candidate recordedAt");
  if (!candidate.typedDates.length || candidate.typedDates.length > 12) {
    throw new Error("Screen 4 candidate requires bounded typed dates.");
  }
  for (const date of candidate.typedDates) {
    requirePartialDate(date.value, "Screen 4 candidate date");
    requireBoundedIdentifier(date.sourceId, "Screen 4 candidate date source");
    if (date.precision !== precision(date.value)) {
      throw new Error("Screen 4 candidate date precision is invalid.");
    }
  }
  if (candidate.geography.labels.length > 24 ||
      new Set(candidate.geography.labels).size !== candidate.geography.labels.length ||
      (candidate.geography.status === "not_established" &&
        candidate.geography.labels.length)) {
    throw new Error("Screen 4 candidate geography is invalid.");
  }
  candidate.geography.labels.forEach((value) =>
    requireText(value, "Screen 4 candidate geography", 500));
  if (!candidate.evidence.length || candidate.evidence.length > 12 ||
      new Set(candidate.evidence.map(({ sourceId }) => sourceId)).size !==
        candidate.evidence.length) {
    throw new Error("Screen 4 candidate occurrence evidence is invalid.");
  }
  const evidenceIds = new Set(candidate.evidence.map(({ sourceId }) => sourceId));
  for (const source of candidate.evidence) {
    requireBoundedIdentifier(source.sourceId, "Screen 4 occurrence source id");
    requireText(source.title, "Screen 4 occurrence source title", 1_000);
    requireSanitizedSourceUrl(source.locator);
    requireText(source.publisher, "Screen 4 occurrence publisher", 500);
    if (source.publishedDate) {
      requirePartialDate(source.publishedDate, "Screen 4 source publication date");
    }
    requireCanonicalInstant(source.retrievedAt, "Screen 4 source retrievedAt");
    if (![1, 2, 3, 4, 5, 6].includes(source.authorityTier)) {
      throw new Error("Screen 4 occurrence authority tier is invalid.");
    }
  }
  if (candidate.typedDates.some(({ sourceId }) => !evidenceIds.has(sourceId))) {
    throw new Error("Screen 4 candidate date cites missing occurrence evidence.");
  }
  requireText(candidate.claimBoundary, "Screen 4 candidate claim boundary");
  return candidate;
}

function leadBody(lead: CoEventDiscoveryLead) {
  const { leadFingerprint: _fingerprint, ...body } = lead;
  return body;
}

export function createCoEventDiscoveryLead(input: Omit<
  CoEventDiscoveryLead,
  | "schemaVersion"
  | "sourceRole"
  | "occurrenceStatus"
  | "relationStatus"
  | "leadFingerprint"
>) {
  const body: LeadBody = {
    schemaVersion: SIX_SCREEN_COEVENT_DISCOVERY_LEAD_VERSION,
    ...structuredClone(input),
    sourceRole: "contextual_secondary_metadata",
    occurrenceStatus: "not_established",
    relationStatus: "not_assessed",
  };
  const lead = { ...body, leadFingerprint: fingerprintSixScreenValue(body) };
  validateCoEventDiscoveryLead(lead);
  return lead;
}

export function validateCoEventDiscoveryLead(lead: CoEventDiscoveryLead) {
  if (
    lead.schemaVersion !== SIX_SCREEN_COEVENT_DISCOVERY_LEAD_VERSION ||
    lead.leadFingerprint !== fingerprintSixScreenValue(leadBody(lead)) ||
    !COEVENT_PROVIDER_IDS.includes(lead.providerId) ||
    lead.sourceRole !== "contextual_secondary_metadata" ||
    lead.occurrenceStatus !== "not_established" ||
    lead.relationStatus !== "not_assessed"
  ) throw new Error("Screen 4 discovery lead is invalid or changed.");
  requireBoundedIdentifier(lead.id, "Screen 4 discovery lead id");
  requireText(lead.sourceNativeId, "Screen 4 discovery native id", 500);
  requireText(lead.title, "Screen 4 discovery title", 1_000);
  requireSanitizedSourceUrl(lead.locator);
  requireText(lead.publisher, "Screen 4 discovery publisher", 500);
  if (lead.publishedDate) {
    requirePartialDate(lead.publishedDate, "Screen 4 discovery publication date");
  }
  requireCanonicalInstant(lead.recordedAt, "Screen 4 discovery recordedAt");
  requireText(lead.limitation, "Screen 4 discovery limitation", 2_000);
  return lead;
}

function executionBody(execution: CoEventSearchExecution) {
  const { executionFingerprint: _fingerprint, ...body } = execution;
  return body;
}

function unique<T>(values: readonly T[]) {
  return [...new Set(values)];
}

export function createCoEventSearchExecution(input: {
  snapshotId: string;
  ordinal: number;
  plan: CoEventExecutionPlan;
  previous: CoEventSearchExecution | null;
  attempt: CoEventProviderAttempt | null;
  newCandidateOccurrenceIds: string[];
  newDiscoveryLeadIds: string[];
  recordedAt: string;
}) {
  requireBoundedIdentifier(input.snapshotId, "Screen 4 execution snapshot id");
  requireCanonicalInstant(input.recordedAt, "Screen 4 execution recordedAt");
  if (!Number.isSafeInteger(input.ordinal) || input.ordinal < 1) {
    throw new Error("Screen 4 execution ordinal is invalid.");
  }
  const pending = input.plan.steps.filter(({ initialStatus }) =>
    initialStatus === "pending").map(({ id }) => id);
  const priorCompleted = input.previous?.completedStepIds ?? [];
  if (input.previous &&
      (input.previous.planFingerprint !== input.plan.planFingerprint ||
        input.previous.status === "complete")) {
    throw new Error("Screen 4 execution cannot continue from this snapshot.");
  }
  if (!input.attempt && pending.length) {
    throw new Error("A runnable Screen 4 plan requires a provider attempt.");
  }
  if (input.attempt) {
    validateCoEventProviderAttempt(input.attempt);
    const step = input.plan.steps.find(({ id }) => id === input.attempt!.stepId);
    if (
      !step || step.initialStatus !== "pending" ||
      step.rowId !== input.attempt.rowId ||
      step.providerId !== input.attempt.providerId ||
      step.plannedLimit !== input.attempt.requestedLimit ||
      input.attempt.queryFingerprint !== fingerprintSixScreenValue(
        input.attempt.outcome === "unsupported_request"
          ? {
              planFingerprint: input.plan.planFingerprint,
              stepId: input.attempt.stepId,
              unsupported: true,
            }
          : {
              planFingerprint: input.plan.planFingerprint,
              stepId: input.attempt.stepId,
              requestUrl: input.attempt.requestUrl,
            },
      ) ||
      priorCompleted.includes(step.id) ||
      input.attempt.candidateOccurrenceIds.join("\u0000") !==
        input.newCandidateOccurrenceIds.join("\u0000") ||
      input.attempt.discoveryLeadIds.join("\u0000") !==
        input.newDiscoveryLeadIds.join("\u0000")
    ) throw new Error("Screen 4 provider attempt does not match its plan step.");
  } else if (
    input.newCandidateOccurrenceIds.length || input.newDiscoveryLeadIds.length
  ) throw new Error("Screen 4 evidence requires a provider attempt.");
  const completedStepIds = input.attempt
    ? [...priorCompleted, input.attempt.stepId]
    : [];
  const remainingStepIds = pending.filter((id) =>
    !completedStepIds.includes(id));
  const candidateOccurrenceIds = unique([
    ...(input.previous?.candidateOccurrenceIds ?? []),
    ...input.newCandidateOccurrenceIds,
  ]);
  const discoveryLeadIds = unique([
    ...(input.previous?.discoveryLeadIds ?? []),
    ...input.newDiscoveryLeadIds,
  ]);
  const planUnavailable = input.plan.steps.filter(({ initialStatus }) =>
    initialStatus !== "pending" && initialStatus !== "budget_excluded"
  ).map(({ providerId }) => providerId);
  const unavailableProviderIds = unique([
    ...(input.previous?.unavailableProviderIds ?? planUnavailable),
    ...(input.attempt?.outcome === "source_unavailable"
      ? [input.attempt.providerId]
      : []),
  ]);
  const unavailableLanguages = input.plan.steps.some(({ initialStatus }) =>
      initialStatus === "language_unavailable")
    ? ["en"]
    : [];
  const processedProviderIds = unique([
    ...(input.previous?.actualSearchBoundary.processedProviderIds ?? []),
    ...(input.attempt ? [input.attempt.providerId] : []),
  ]);
  const searchedProviderIds = unique([
    ...(input.previous?.actualSearchBoundary.searchedProviderIds ?? []),
    ...(input.attempt?.usage.sourceQueries
      ? [input.attempt.providerId]
      : []),
  ]);
  const status = remainingStepIds.length ? "active" as const : "complete" as const;
  const firstStartedAt = input.previous?.actualSearchBoundary.startedAt ??
    input.attempt?.startedAt ?? input.recordedAt;
  const body: ExecutionBody = {
    schemaVersion: SIX_SCREEN_COEVENT_EXECUTION_VERSION,
    snapshotId: input.snapshotId,
    ordinal: input.ordinal,
    matrixSnapshotId: input.plan.matrixSnapshotId,
    matrixFingerprint: input.plan.matrixFingerprint,
    planId: input.plan.id,
    planFingerprint: input.plan.planFingerprint,
    previousExecutionSnapshotId: input.previous?.snapshotId ?? null,
    attempt: input.attempt ? structuredClone(input.attempt) : null,
    status,
    completedStepIds,
    remainingStepIds,
    candidateOccurrenceIds,
    discoveryLeadIds,
    unavailableProviderIds,
    unavailableLanguages,
    actualSearchBoundary: {
      periodStart: input.plan.searchPeriod.start,
      periodEnd: input.plan.searchPeriod.end,
      startedAt: firstStartedAt,
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
      retainedCandidateCount: candidateOccurrenceIds.length,
      discoveryLeadCount: discoveryLeadIds.length,
      anyProviderLimitReached:
        Boolean(input.previous?.actualSearchBoundary.anyProviderLimitReached) ||
        Boolean(input.attempt?.limitReached),
      stopReason: status === "complete"
        ? pending.length
          ? "planned_steps_exhausted"
          : "no_executable_provider_route"
        : null,
    },
    semanticRelationAnalysis: {
      status: "blocked",
      reason: "genuine_intelligence_path_unverified",
    },
    claimBoundary:
      "This execution records bounded provider outcomes and occurrence-only evidence. It is not exhaustive and does not establish causal relevance, confounding, mediation, spillover, or a recommended control.",
    recordedAt: input.recordedAt,
  };
  const execution = {
    ...body,
    executionFingerprint: fingerprintSixScreenValue(body),
  };
  validateCoEventSearchExecution(execution, input.plan);
  return execution;
}

export function validateCoEventSearchExecution(
  execution: CoEventSearchExecution,
  plan: CoEventExecutionPlan,
) {
  if (
    execution.schemaVersion !== SIX_SCREEN_COEVENT_EXECUTION_VERSION ||
    execution.executionFingerprint !==
      fingerprintSixScreenValue(executionBody(execution)) ||
    execution.matrixSnapshotId !== plan.matrixSnapshotId ||
    execution.matrixFingerprint !== plan.matrixFingerprint ||
    execution.planId !== plan.id ||
    execution.planFingerprint !== plan.planFingerprint ||
    !Number.isSafeInteger(execution.ordinal) || execution.ordinal < 1 ||
    execution.semanticRelationAnalysis.status !== "blocked" ||
    execution.semanticRelationAnalysis.reason !==
      "genuine_intelligence_path_unverified"
  ) throw new Error("Screen 4 search execution is invalid or changed.");
  requireBoundedIdentifier(execution.snapshotId, "Screen 4 execution snapshot id");
  if (execution.previousExecutionSnapshotId) {
    requireBoundedIdentifier(
      execution.previousExecutionSnapshotId,
      "Screen 4 previous execution snapshot id",
    );
  }
  if (execution.attempt) validateCoEventProviderAttempt(execution.attempt);
  requireCanonicalInstant(execution.recordedAt, "Screen 4 execution recordedAt");
  const pending = plan.steps.filter(({ initialStatus }) =>
    initialStatus === "pending").map(({ id }) => id);
  if (
    new Set(execution.completedStepIds).size !== execution.completedStepIds.length ||
    new Set(execution.remainingStepIds).size !== execution.remainingStepIds.length ||
    execution.completedStepIds.some((id) => !pending.includes(id)) ||
    execution.remainingStepIds.some((id) => !pending.includes(id)) ||
    execution.completedStepIds.some((id) => execution.remainingStepIds.includes(id)) ||
    execution.completedStepIds.length + execution.remainingStepIds.length !==
      pending.length ||
    (execution.status === "complete") !== !execution.remainingStepIds.length ||
    (execution.attempt === null) !== (execution.completedStepIds.length === 0) ||
    (execution.attempt !== null &&
      execution.completedStepIds.at(-1) !== execution.attempt.stepId)
  ) throw new Error("Screen 4 execution progress is invalid.");
  requireUniqueTextList(
    execution.candidateOccurrenceIds,
    "Screen 4 execution candidate ids",
    100,
  );
  requireUniqueTextList(
    execution.discoveryLeadIds,
    "Screen 4 execution lead ids",
    100,
  );
  if (
    new Set(execution.unavailableProviderIds).size !==
      execution.unavailableProviderIds.length ||
    execution.unavailableProviderIds.some((id) =>
      !COEVENT_PROVIDER_IDS.includes(id)) ||
    new Set(execution.actualSearchBoundary.processedProviderIds).size !==
      execution.actualSearchBoundary.processedProviderIds.length ||
    new Set(execution.actualSearchBoundary.searchedProviderIds).size !==
      execution.actualSearchBoundary.searchedProviderIds.length ||
    execution.actualSearchBoundary.searchedProviderIds.some((id) =>
      !execution.actualSearchBoundary.processedProviderIds.includes(id))
  ) throw new Error("Screen 4 execution provider boundary is invalid.");
  requireUniqueTextList(
    execution.unavailableLanguages,
    "Screen 4 unavailable languages",
    20,
  );
  const boundary = execution.actualSearchBoundary;
  if (
    boundary.periodStart !== plan.searchPeriod.start ||
    boundary.periodEnd !== plan.searchPeriod.end ||
    boundary.processedStepIds.join("\u0000") !==
      execution.completedStepIds.join("\u0000") ||
    boundary.retainedCandidateCount !== execution.candidateOccurrenceIds.length ||
    boundary.discoveryLeadCount !== execution.discoveryLeadIds.length ||
    (execution.status === "complete") !== (boundary.completedAt !== null) ||
    (execution.status === "active") !== (boundary.stopReason === null)
  ) throw new Error("Screen 4 actual search boundary is invalid.");
  requireCanonicalInstant(boundary.startedAt, "Screen 4 execution boundary start");
  if (boundary.completedAt) {
    requireCanonicalInstant(boundary.completedAt, "Screen 4 execution boundary end");
  }
  for (const [label, value] of [
    ["source queries", boundary.sourceQueries],
    ["metadata records", boundary.metadataRecords],
    ["retained candidates", boundary.retainedCandidateCount],
    ["discovery leads", boundary.discoveryLeadCount],
  ] as const) requireNonnegative(value, `Screen 4 boundary ${label}`);
  if (
    boundary.sourceQueries > plan.sourceQueryCeiling ||
    boundary.metadataRecords > plan.metadataCandidateCeiling
  ) throw new Error("Screen 4 execution exceeded its saved budget.");
  requireText(execution.claimBoundary, "Screen 4 execution claim boundary");
  return execution;
}

export function validateCoEventExecutionCollections(input: {
  matrices: readonly CoEventSearchMatrix[];
  plans: readonly CoEventExecutionPlan[];
  executions: readonly CoEventSearchExecution[];
  candidates: readonly CoEventCandidateOccurrence[];
  leads: readonly CoEventDiscoveryLead[];
}) {
  if (
    input.plans.length > SIX_SCREEN_COEVENT_MAX_EXECUTION_PLANS ||
    input.executions.length > SIX_SCREEN_COEVENT_MAX_EXECUTION_SNAPSHOTS ||
    input.candidates.length > SIX_SCREEN_COEVENT_MAX_CANDIDATES ||
    input.leads.length > SIX_SCREEN_COEVENT_MAX_DISCOVERY_LEADS ||
    bytes({
      plans: input.plans,
      executions: input.executions,
      candidates: input.candidates,
      leads: input.leads,
    }) > SIX_SCREEN_COEVENT_EXECUTION_MAX_BYTES
  ) throw new Error("Stored Screen 4 execution evidence exceeds its bounded capacity.");
  for (const [values, label] of [
    [input.plans, "plan"],
    [input.executions, "execution"],
    [input.candidates, "candidate"],
    [input.leads, "lead"],
  ] as const) {
    if (new Set(values.map(({ id, snapshotId }: {
      id?: string;
      snapshotId?: string;
    }) => id ?? snapshotId)).size !== values.length) {
      throw new Error(`Stored Screen 4 ${label} identifiers must be unique.`);
    }
  }
  const matrixMap = new Map(input.matrices.map((matrix) =>
    [matrix.snapshotId, matrix]));
  const planMap = new Map(input.plans.map((plan) => [plan.id, plan]));
  for (const plan of input.plans) {
    const matrix = matrixMap.get(plan.matrixSnapshotId);
    if (!matrix) throw new Error("Stored Screen 4 plan matrix is unavailable.");
    validateCoEventExecutionPlan(plan, matrix);
  }
  input.candidates.forEach(validateCoEventCandidateOccurrence);
  input.leads.forEach(validateCoEventDiscoveryLead);
  const candidateMap = new Map(input.candidates.map((candidate) =>
    [candidate.id, candidate]));
  const leadMap = new Map(input.leads.map((lead) => [lead.id, lead]));
  const executionMap = new Map(input.executions.map((execution) =>
    [execution.snapshotId, execution]));
  const latestExecutionByPlan = new Map<string, CoEventSearchExecution>();
  let ordinal = 0;
  for (const execution of input.executions) {
    if (execution.ordinal <= ordinal) {
      throw new Error("Stored Screen 4 execution ordinals must increase.");
    }
    ordinal = execution.ordinal;
    const plan = planMap.get(execution.planId);
    if (!plan) throw new Error("Stored Screen 4 execution plan is unavailable.");
    validateCoEventSearchExecution(execution, plan);
    if (
      execution.candidateOccurrenceIds.some((id) => !candidateMap.has(id)) ||
      execution.discoveryLeadIds.some((id) => !leadMap.has(id))
    ) throw new Error("Stored Screen 4 execution cites missing evidence.");
    if (
      execution.attempt &&
      (execution.attempt.candidateOccurrenceIds.some((id) =>
        candidateMap.get(id)?.providerId !== execution.attempt!.providerId) ||
        execution.attempt.discoveryLeadIds.some((id) =>
          leadMap.get(id)?.providerId !== execution.attempt!.providerId))
    ) throw new Error("Stored Screen 4 provider evidence is misattributed.");
    const previous = execution.previousExecutionSnapshotId
      ? executionMap.get(execution.previousExecutionSnapshotId)
      : null;
    const expectedPrevious = latestExecutionByPlan.get(plan.id) ?? null;
    if (
      execution.previousExecutionSnapshotId !==
        (expectedPrevious?.snapshotId ?? null) ||
      (execution.previousExecutionSnapshotId &&
        (!previous || previous !== expectedPrevious ||
          previous.ordinal >= execution.ordinal ||
          previous.planFingerprint !== execution.planFingerprint))
    ) throw new Error("Stored Screen 4 execution chain is invalid.");
    const recreated = createCoEventSearchExecution({
      snapshotId: execution.snapshotId,
      ordinal: execution.ordinal,
      plan,
      previous: expectedPrevious,
      attempt: execution.attempt,
      newCandidateOccurrenceIds:
        execution.attempt?.candidateOccurrenceIds ?? [],
      newDiscoveryLeadIds: execution.attempt?.discoveryLeadIds ?? [],
      recordedAt: execution.recordedAt,
    });
    if (recreated.executionFingerprint !== execution.executionFingerprint) {
      throw new Error("Stored Screen 4 execution chain was not reproduced exactly.");
    }
    latestExecutionByPlan.set(plan.id, execution);
  }
  return input;
}
