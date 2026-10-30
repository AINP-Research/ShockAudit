import { restoreScreen02Session } from "./screen02-service";
import {
  fingerprintScreen01StudyContext,
  serializeDeterministicJson,
} from "./screen02-deterministic-json";
import { restoreScreen02StateEnvelope } from "./screen02-state-envelope";
import { assertScreen02StateEnvelopeCapacity } from "./screen02-state-capacity";
import type { Screen02Session } from "./screen02-types";
import {
  SCREEN_02_SHOCK_GLANCE_MAX_ENTRIES,
  assembleScreen02AuditShockGlanceForDossier,
  assembleScreen02FindShockGlance,
  fingerprintScreen02ShockGlanceEvent,
  restoreScreen02ShockGlance,
  screen02FindGlanceEvent,
  screen02ShockGlanceMatchesAuditState,
  screen02ShockGlanceMatchesFindState,
  upsertScreen02ShockGlance,
} from "./screen02-shock-glance";
import {
  requireReadyScreen01Context,
} from "./study-context";
import type { Screen01StudyContext } from "./scope-types";
import { screen02EventWordingMatches } from "./screen02-event-name";
import {
  SCREEN02_CANDIDATE_QUALIFICATION_VERSION,
  isCompatibleScreen02CandidateQualification,
  isScreen02CandidateQualification,
  migrateScreen02CandidateQualification,
} from "./screen02-qualification-codec";
import {
  buildScreen02StudyRelevanceProfile,
  isScreen02StudyRelevanceProfile,
} from "./screen02-relevance-profile";
import {
  isScreen02ContextOfficialBridgeProvenance,
  screen02FederalRegisterBridgeQueryMatchesIdentifier,
  screen02VisibleTitleFederalRegisterIdentifier,
  type Screen02ContextOfficialBridgeProvenance,
} from "./screen02-context-bridge";
import {
  SCREEN_02_AUDIT_STATE_KIND,
  SCREEN_02_FIND_STATE_KIND,
  SCREEN_02_SEARCH_FUNNEL_SCHEMA_VERSION,
  SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_LEGACY_VERSION,
  SCREEN_02_WORKFLOW_SCHEMA_VERSION,
  SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_VERSION,
  screen02AssessmentLifecycleStatuses,
  screen02AssessmentUnavailableScreen03Checks,
  screen02AuditAssessmentPartIds,
  screen02AuditDossierPartIds,
  screen02AuditRelationships,
  screen02AuditVersionTypes,
  screen02CoverageRelationCategories,
  screen02CriterionEvaluators,
  screen02CriterionFindingResults,
  screen02CriterionKinds,
  screen02DateLeadStages,
  screen02FindDiscoveryStatuses,
  screen02FindAssessmentPartIds,
  screen02FindDiscoveryPlanPartIds,
  screen02IdentityDecisionActions,
  screen02MeasurementPotentialCategories,
  screen02OutcomePathwayCategories,
  screen02PreliminaryJudgments,
  screen02StudyFitCategories,
  isScreen02ContextLead,
  isScreen02HostReviewApplication,
  isScreen02RetainedResultBinding,
  isCompatibleScreen02RetrievalExecution,
  isScreen02RetrievalExecution,
  isFreshScreen02SelectionQualification,
  isCompatibleScreen02SearchFunnel,
  isScreen02SearchFunnel,
  screen02DocumentAcquisitionMatchesSource,
  screen02SearchFunnelMatchesRetrievalExecution,
  migrateScreen02RetrievalExecution,
  migrateScreen02SearchFunnel,
  type Screen02AssessmentLifecycleStatus,
  type Screen02AssessmentUnavailableDisposition,
  type Screen02AssessmentRequest,
  type Screen02AssessmentTarget,
  type Screen02AuditAssessment,
  type Screen02AuditDossier,
  type Screen02AuditPossibleMatch,
  type Screen02AuditState,
  type Screen02Criterion,
  type Screen02CriterionFinding,
  type Screen02CriterionFindingResult,
  type Screen02CriterionKind,
  type Screen02ContextLead,
  type Screen02FindCandidateAssessment,
  type Screen02FindCandidateSnapshot,
  type Screen02FindDiscoveryRequest,
  type Screen02FindState,
  type Screen02IdentityDecision,
  type Screen02PreliminaryJudgment,
  type Screen02RetainedResultBinding,
  type Screen02RetainedResultOrigin,
  type Screen02WorkflowSource,
  type Screen02WorkflowSearchManifest,
  type Screen02WorkflowState,
} from "./screen02-workflow-types";

const fingerprintPattern = /^fnv1a64:[0-9a-f]{16}$/;

const fixedCandidateSourceCriterion = {
  kind: "only-include",
  text: "Candidate has an attached source-backed description",
  exactRequest:
    "Only include candidates with at least one attached source and a source-backed description.",
} as const;

const findStateKeys = [
  "schemaVersion",
  "stateKind",
  "sourceScreen",
  "mode",
  "runId",
  "screen01Baseline",
  "screen01Fingerprint",
  "revision",
  "createdAt",
  "updatedAt",
  "sources",
  "criteria",
  "discoveryRequests",
  "candidateSets",
  "activeCandidateSetSnapshotId",
  "candidates",
  "assessments",
  "criterionFindings",
  "assessmentRequests",
  "decision",
  "outcomeValuesInspected",
] as const;

const auditStateKeys = [
  "schemaVersion",
  "stateKind",
  "sourceScreen",
  "mode",
  "runId",
  "screen01Baseline",
  "screen01Fingerprint",
  "revision",
  "createdAt",
  "updatedAt",
  "sources",
  "anchor",
  "matchSets",
  "activeMatchSetSnapshotId",
  "possibleMatches",
  "dossiers",
  "identityDecisions",
  "confirmedIdentity",
  "assessments",
  "assessmentRequests",
  "continuationHistory",
  "outcomeValuesInspected",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(message: string): never {
  throw new Error(message);
}

function screen2Fail(message: string): never {
  fail(`Screen 2 ${message}`);
}

function findFail(message: string): never {
  fail(`Find ${message}`);
}

function auditFail(message: string): never {
  fail(`Audit ${message}`);
}

function assertRecord(
  value: unknown,
  label: string,
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) fail(`${label} must be an object.`);
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
) {
  const expectedSet = new Set(expected);
  const extra = Object.keys(value).find((key) => !expectedSet.has(key));
  const missing = expected.find((key) => !(key in value));
  if (extra) fail(`${label}.${extra} is not recognized.`);
  if (missing) fail(`${label}.${missing} is required.`);
}

function assertExactKeysWithOptional(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
  label: string,
) {
  const allowed = new Set([...required, ...optional]);
  const extra = Object.keys(value).find((key) => !allowed.has(key));
  const missing = required.find((key) => !(key in value));
  if (extra) fail(`${label}.${extra} is not recognized.`);
  if (missing) fail(`${label}.${missing} is required.`);
}

function assertNonEmptyString(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(`${label} must be a non-empty string.`);
  }
}

function assertBoundedNonEmptyString(
  value: unknown,
  label: string,
  maximum = 2_000,
) {
  assertNonEmptyString(value, label);
  if (
    (value as string).trim() !== value ||
    (value as string).length > maximum
  ) {
    fail(`${label} must be a bounded non-empty string.`);
  }
}

function assertNullableString(value: unknown, label: string) {
  if (value !== null) assertNonEmptyString(value, label);
}

function timestampValue(value: unknown, label: string) {
  assertNonEmptyString(value, label);
  const timestamp = Date.parse(value as string);
  if (!Number.isFinite(timestamp)) {
    fail(`${label} must be a valid timestamp.`);
  }
  return timestamp;
}

function assertNotBefore(value: unknown, floor: unknown, label: string) {
  if (timestampValue(value, label) < timestampValue(floor, `${label} floor`)) {
    fail(`${label} cannot move backward in time.`);
  }
}

function assertStringArray(
  value: unknown,
  label: string,
): asserts value is string[] {
  if (!Array.isArray(value)) fail(`${label} must be an array.`);
  value.forEach((entry, index) =>
    assertNonEmptyString(entry, `${label}[${index}]`),
  );
  assertUnique(value as string[], label);
}

function assertUnique(values: readonly string[], label: string) {
  if (new Set(values).size !== values.length) {
    fail(`${label} must not contain duplicates.`);
  }
}

function validateAssessmentUnavailableDisposition(
  value: unknown,
  label: string,
  requests: ReadonlyMap<string, Screen02AssessmentRequest>,
) {
  assertRecord(value, label);
  assertExactKeys(
    value,
    [
      "status",
      "reason",
      "affectedRequestIds",
      "recordedAt",
      "researcherAcknowledgment",
      "mandatoryScreen03Checks",
    ],
    label,
  );
  if (value.status !== "unavailable") {
    fail(`${label}.status must be unavailable.`);
  }
  assertBoundedNonEmptyString(value.reason, `${label}.reason`);
  assertBoundedNonEmptyString(
    value.researcherAcknowledgment,
    `${label}.researcherAcknowledgment`,
  );
  timestampValue(value.recordedAt, `${label}.recordedAt`);
  assertStringArray(value.affectedRequestIds, `${label}.affectedRequestIds`);
  if (
    value.affectedRequestIds.length < 1 ||
    value.affectedRequestIds.length > 80 ||
    value.affectedRequestIds.some((requestId) => requestId.length > 200)
  ) {
    fail(`${label}.affectedRequestIds are not bounded.`);
  }
  for (const requestId of value.affectedRequestIds) {
    const request = requests.get(requestId);
    if (!request || !assessmentRequestSupportsUnavailableContinuation(request)) {
      fail(
        `${label} references a request without terminal assessment-unavailability evidence.`,
      );
    }
  }
  assertStringArray(
    value.mandatoryScreen03Checks,
    `${label}.mandatoryScreen03Checks`,
  );
  if (
    value.mandatoryScreen03Checks.length !==
      screen02AssessmentUnavailableScreen03Checks.length ||
    value.mandatoryScreen03Checks.some(
      (check, index) =>
        check !== screen02AssessmentUnavailableScreen03Checks[index],
    )
  ) {
    fail(`${label}.mandatoryScreen03Checks do not match policy.`);
  }
}

function assertEnum(
  value: unknown,
  allowed: readonly string[],
  label: string,
) {
  if (typeof value !== "string" || !allowed.includes(value)) {
    fail(`${label} has an unsupported value.`);
  }
}

function assertArray(value: unknown, label: string): asserts value is unknown[] {
  if (!Array.isArray(value)) fail(`${label} must be an array.`);
}

function clone<T>(value: T): T {
  serializeDeterministicJson(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value && typeof value === "object" && !seen.has(value as object)) {
    seen.add(value as object);
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child, seen);
    }
  }
  return value;
}

function fingerprintSerialized(serialized: string) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of new TextEncoder().encode(serialized)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

export function fingerprintScreen02WorkflowValue(value: unknown) {
  return fingerprintSerialized(serializeDeterministicJson(value));
}

export function fingerprintScreen02WorkflowSource(
  value: Screen02FindState["sources"][number],
) {
  const { sourceFingerprint: _fingerprint, ...source } = value;
  return fingerprintScreen02WorkflowValue(source);
}

export function serializeScreen02WorkflowState(
  value: Screen02WorkflowState,
) {
  const restored = restoreScreen02WorkflowState(value);
  if (!restored) {
    screen2Fail("workflow state is invalid or legacy read-only state.");
  }
  return serializeDeterministicJson(restored);
}

export function fingerprintScreen02WorkflowState(
  value: Screen02WorkflowState,
) {
  return fingerprintSerialized(serializeScreen02WorkflowState(value));
}

function validateReadyBaseline(
  value: unknown,
  expectedMode: "find" | "audit",
) {
  assertRecord(value, "screen01Baseline");
  const baseline = requireReadyScreen01Context(
    clone(value) as Screen01StudyContext,
  );
  if (baseline.startingPoint !== expectedMode) {
    fail(`Screen 1 must use ${expectedMode} mode for this state.`);
  }
  return baseline;
}

export function createScreen02FindState(
  baseline: Screen01StudyContext,
  runId: string,
  at: string,
): Screen02FindState {
  const safeBaseline = validateReadyBaseline(baseline, "find");
  assertNonEmptyString(runId, "runId");
  assertNonEmptyString(at, "at");
  const state: Screen02FindState = {
    schemaVersion: SCREEN_02_WORKFLOW_SCHEMA_VERSION,
    stateKind: SCREEN_02_FIND_STATE_KIND,
    sourceScreen: "screen-02",
    mode: "find",
    runId,
    screen01Baseline: clone(safeBaseline),
    screen01Fingerprint: fingerprintScreen01StudyContext(safeBaseline),
    relevanceProfile: buildScreen02StudyRelevanceProfile({
      scopeFingerprint: fingerprintScreen01StudyContext(safeBaseline),
      originalIndustryText: safeBaseline.scopeContract.industry,
      sampleGeography: safeBaseline.scopeContract.geography,
      studyPeriod: safeBaseline.scopeContract.studyPeriod,
      eventFamily: safeBaseline.scopeContract.eventFamily,
      at,
    }),
    revision: 0,
    createdAt: at,
    updatedAt: at,
    sources: [],
    criteria: [],
    discoveryRequests: [],
    candidateSets: [],
    activeCandidateSetSnapshotId: null,
    candidates: [],
    assessments: [],
    shockGlances: [],
    criterionFindings: [],
    assessmentRequests: [],
    decision: {
      openedCandidateSnapshotId: null,
      tentativeSelectionSnapshotId: null,
      continuedRevision: null,
      history: [],
    },
    outcomeValuesInspected: false,
  };
  return deepFreeze(state);
}

function initialScreen02AuditAnchorFields(baseline: Screen01StudyContext) {
  return {
    shockName: baseline.knownShock,
    jurisdiction: null,
    issuingAuthority: null,
    approximateYear: null,
    versionType: "unspecified" as const,
    distinguishingFeature: null,
    sourceLocator: null,
    clarification: null,
  };
}

export function createScreen02AuditState(
  baseline: Screen01StudyContext,
  runId: string,
  at: string,
  anchorRevisionId = `${runId}:anchor:1`,
): Screen02AuditState {
  const safeBaseline = validateReadyBaseline(baseline, "audit");
  assertNonEmptyString(runId, "runId");
  assertNonEmptyString(at, "at");
  assertNonEmptyString(anchorRevisionId, "anchorRevisionId");
  assertNonEmptyString(safeBaseline.knownShock, "knownShock");
  const initialAnchor = initialScreen02AuditAnchorFields(safeBaseline);
  const state: Screen02AuditState = {
    schemaVersion: SCREEN_02_WORKFLOW_SCHEMA_VERSION,
    stateKind: SCREEN_02_AUDIT_STATE_KIND,
    sourceScreen: "screen-02",
    mode: "audit",
    runId,
    screen01Baseline: clone(safeBaseline),
    screen01Fingerprint: fingerprintScreen01StudyContext(safeBaseline),
    revision: 0,
    createdAt: at,
    updatedAt: at,
    sources: [],
    anchor: {
      originalWording: safeBaseline.knownShock,
      activeRevisionId: anchorRevisionId,
      revisions: [
        {
          anchorRevisionId,
          previousRevisionId: null,
          fields: initialAnchor,
          createdAt: at,
          reason: "Initial known-shock anchor from confirmed Screen 1; source retrieval must resolve every identity field.",
        },
      ],
    },
    matchSets: [],
    activeMatchSetSnapshotId: null,
    possibleMatches: [],
    dossiers: [],
    identityDecisions: [],
    confirmedIdentity: null,
    assessments: [],
    shockGlances: [],
    assessmentRequests: [],
    continuationHistory: [],
    outcomeValuesInspected: false,
  };
  return deepFreeze(state);
}

export function deriveScreen02PreliminaryJudgment(input: {
  studyFit: string | null;
  outcomePathway: string | null;
  measurementPotential: string | null;
}): Screen02PreliminaryJudgment | null {
  const { studyFit, outcomePathway, measurementPotential } = input;
  if (!studyFit || !outcomePathway || !measurementPotential) return null;
  if (
    studyFit === "unclear" ||
    outcomePathway === "unclear" ||
    measurementPotential === "unclear"
  ) {
    return "not-enough-evidence";
  }
  if (
    studyFit === "weak" ||
    outcomePathway === "unsupported" ||
    measurementPotential === "implausible"
  ) {
    return "low-priority";
  }
  if (
    studyFit === "strong" &&
    outcomePathway === "plausible" &&
    measurementPotential === "possible"
  ) {
    return "promising-to-verify";
  }
  const ordinal =
    ({ strong: 2, mixed: 1 } as Record<string, number>)[studyFit] +
    ({ plausible: 2, limited: 1 } as Record<string, number>)[
      outcomePathway
    ] +
    ({ possible: 2, difficult: 1 } as Record<string, number>)[
      measurementPotential
    ];
  return ordinal >= 4 ? "worth-exploring" : "low-priority";
}

function ensureScreen02FindShockGlance(
  state: Screen02FindState,
  candidateSnapshotId: string,
  at: string,
) {
  const fixed = assembleScreen02FindShockGlance(
    state,
    candidateSnapshotId,
    at,
  );
  const existing = state.shockGlances?.find(
    (glance) => glance.candidateSnapshotId === candidateSnapshotId,
  );
  return upsertScreen02ShockGlance(
    state.shockGlances,
    existing &&
        existing.candidateFingerprint === fixed.candidateFingerprint &&
        existing.eventFingerprint === fixed.eventFingerprint
      ? existing
      : fixed,
  );
}

function ensureScreen02AuditShockGlance(
  state: Screen02AuditState,
  matchSnapshotId: string,
  dossierSnapshotId: string,
  at: string,
) {
  const fixed = assembleScreen02AuditShockGlanceForDossier(
    state,
    matchSnapshotId,
    dossierSnapshotId,
    at,
  );
  const existing = state.shockGlances?.find(
    (glance) => glance.candidateSnapshotId === matchSnapshotId,
  );
  return upsertScreen02ShockGlance(
    state.shockGlances,
    existing &&
        existing.candidateFingerprint === fixed.candidateFingerprint &&
        existing.eventFingerprint === fixed.eventFingerprint
      ? existing
      : fixed,
  );
}

function latestCriterionVersions(criteria: readonly Screen02Criterion[]) {
  const latest = new Map<string, Screen02Criterion>();
  for (const criterion of criteria) {
    const existing = latest.get(criterion.criterionId);
    if (!existing || existing.version < criterion.version) {
      latest.set(criterion.criterionId, criterion);
    }
  }
  return [...latest.values()].filter((criterion) => criterion.status === "active");
}

function findingMatchesCriterionKind(
  kind: Screen02CriterionKind,
  result: Screen02CriterionFindingResult,
) {
  if (kind === "do-not-show") {
    return [
      "violates",
      "does-not-violate",
      "unclear",
      "technical-failure",
    ].includes(result);
  }
  return [
    "meets",
    "does-not-meet",
    "unclear",
    "technical-failure",
  ].includes(result);
}

function findingIsStrictlyResolved(
  criterion: Screen02Criterion,
  finding: Screen02CriterionFinding | undefined,
) {
  if (criterion.kind === "rank-higher") return true;
  const latestOverride = finding?.overrides.at(-1);
  if (latestOverride) return latestOverride.resultingEligibility === "eligible";
  if (!finding) return false;
  if (criterion.kind === "only-include") return finding.result === "meets";
  return finding.result === "does-not-violate";
}

export type Screen02Gate = {
  eligible: boolean;
  reasons: string[];
};

export function screen02FindCandidateGate(
  state: Screen02FindState,
  candidateSnapshotId: string,
): Screen02Gate {
  const safe = restoreScreen02FindState(state);
  if (!safe) return { eligible: false, reasons: ["Find state is invalid."] };
  return computeFindCandidateGate(safe, candidateSnapshotId);
}

export function screen02FindCandidateSelectionGate(
  state: Screen02FindState,
  candidateSnapshotId: string,
): Screen02Gate {
  const safe = restoreScreen02FindState(state);
  if (!safe) return { eligible: false, reasons: ["Find state is invalid."] };
  return computeFindCandidateSelectionGate(safe, candidateSnapshotId);
}

function latestAssessmentRequest(
  requests: readonly Screen02AssessmentRequest[],
  predicate: (request: Screen02AssessmentRequest) => boolean,
) {
  let latest: Screen02AssessmentRequest | null = null;
  for (const request of requests) {
    if (!predicate(request)) continue;
    if (!latest || request.attempt >= latest.attempt) latest = request;
  }
  return latest;
}

function assessmentRequestSupportsUnavailableContinuation(
  request: Screen02AssessmentRequest,
) {
  if (request.status === "service-unavailable") return true;
  if (request.status === "delivery-rejected") {
    return request.lifecycle.some((event) => event.status === "prepared");
  }
  return [
    "no-tool-submission",
    "timed-out",
    "validation-failed",
    "partial",
    "retry-exhausted",
  ].includes(request.status);
}

function computeFindCandidateSelectionGate(
  safe: Screen02FindState,
  candidateSnapshotId: string,
): Screen02Gate {
  const reasons: string[] = [];
  const activeSet = safe.candidateSets.find(
    (set) => set.candidateSetSnapshotId === safe.activeCandidateSetSnapshotId,
  );
  const candidate = safe.candidates.find(
    (item) => item.candidateSnapshotId === candidateSnapshotId,
  );
  const fixedQualificationEligible = isFreshScreen02SelectionQualification(
    candidate?.qualification,
  );
  const qualificationRequiresRefresh =
    candidate?.qualification?.eligible === true &&
    !fixedQualificationEligible;
  const searchProtocolRequiresRefresh = Boolean(
    activeSet && activeSet.manifest.protocolVersion !==
      SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_VERSION,
  );
  if (!candidate || !activeSet?.candidateSnapshotIds.includes(candidateSnapshotId)) {
    reasons.push("Candidate is not in the active search snapshot.");
  }
  if (searchProtocolRequiresRefresh) {
    reasons.push(
      "Active search evidence is historical or has no current retrieval execution and must be refreshed.",
    );
  }
  if (
    !candidate ||
    candidate.sourceIds.length === 0 ||
    candidate.description.sourceIds.length === 0
  ) {
    reasons.push("Candidate has no attached source.");
  }
  if (qualificationRequiresRefresh) {
    if (searchProtocolRequiresRefresh) return { eligible: false, reasons };
    reasons.push(
      "Candidate qualification is historical or lacks current source grounding and must be refreshed.",
    );
    return { eligible: false, reasons };
  }
  // Current discovery snapshots carry the fixed, source-bound qualification
  // that already applies the common hard-scope/relevance/quality/substance/
  // exposure contract. Historical snapshots without it retain their legacy
  // per-candidate and per-criterion assessment gate below.
  if (fixedQualificationEligible) {
    return { eligible: reasons.length === 0, reasons };
  }
  const completedCandidateAssessment = safe.assessments.some((assessment) => {
    const request = safe.assessmentRequests.find(
      (candidateRequest) => candidateRequest.requestId === assessment.requestId,
    );
    return (
      assessment.candidateSnapshotId === candidateSnapshotId &&
      assessment.status === "completed" &&
      request?.target.mode === "find-candidate"
    );
  });
  const candidateRequest = latestAssessmentRequest(
    safe.assessmentRequests,
    (request) =>
      request.target.mode === "find-candidate" &&
      request.target.candidateSnapshotId === candidateSnapshotId,
  );
  if (
    !completedCandidateAssessment &&
    (!candidateRequest ||
      !assessmentRequestSupportsUnavailableContinuation(candidateRequest))
  ) {
    reasons.push("Candidate assessment is still running.");
  }
  const criteriaByKey = new Map(
    safe.criteria.map((criterion) => [
      `${criterion.criterionId}:${criterion.version}`,
      criterion,
    ]),
  );
  for (const ref of activeSet?.criterionVersionRefs ?? []) {
    const criterion = criteriaByKey.get(`${ref.criterionId}:${ref.version}`);
    if (!criterion || criterion.kind === "rank-higher") continue;
    const finding = safe.criterionFindings.find(
      (item) =>
        item.candidateSnapshotId === candidateSnapshotId &&
        item.criterionId === criterion.criterionId &&
        item.criterionVersion === criterion.version,
    );
    if (findingIsStrictlyResolved(criterion, finding)) continue;
    const criterionRequest = latestAssessmentRequest(
      safe.assessmentRequests,
      (request) =>
        request.target.mode === "find-criterion" &&
        request.target.candidateSnapshotId === candidateSnapshotId &&
        request.target.criterionId === criterion.criterionId &&
        request.target.criterionVersion === criterion.version,
    );
    if (
      !criterionRequest ||
      !assessmentRequestSupportsUnavailableContinuation(criterionRequest)
    ) {
      reasons.push(`Strict criterion ${criterion.criterionId} is still running.`);
    }
  }
  return { eligible: reasons.length === 0, reasons };
}

function computeFindCandidateGate(
  safe: Screen02FindState,
  candidateSnapshotId: string,
): Screen02Gate {
  const reasons: string[] = [];
  const activeSet = safe.candidateSets.find(
    (set) => set.candidateSetSnapshotId === safe.activeCandidateSetSnapshotId,
  );
  const candidate = safe.candidates.find(
    (item) => item.candidateSnapshotId === candidateSnapshotId,
  );
  const fixedQualificationEligible = isFreshScreen02SelectionQualification(
    candidate?.qualification,
  );
  const qualificationRequiresRefresh =
    candidate?.qualification?.eligible === true &&
    !fixedQualificationEligible;
  const searchProtocolRequiresRefresh = Boolean(
    activeSet && activeSet.manifest.protocolVersion !==
      SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_VERSION,
  );
  if (!candidate || !activeSet?.candidateSnapshotIds.includes(candidateSnapshotId)) {
    reasons.push("Candidate is not in the active search snapshot.");
  }
  if (searchProtocolRequiresRefresh) {
    reasons.push(
      "Active search evidence is historical or has no current retrieval execution and must be refreshed.",
    );
  }
  if (
    !candidate ||
    candidate.sourceIds.length === 0 ||
    candidate.description.sourceIds.length === 0
  ) {
    reasons.push("Candidate has no attached source.");
  }
  if (qualificationRequiresRefresh) {
    if (searchProtocolRequiresRefresh) return { eligible: false, reasons };
    reasons.push(
      "Candidate qualification is historical or lacks current source grounding and must be refreshed.",
    );
    return { eligible: false, reasons };
  }
  // See the selection gate above: the immutable fixed qualification replaces
  // the retired candidate-by-candidate host assessment for current snapshots.
  if (fixedQualificationEligible) {
    return { eligible: reasons.length === 0, reasons };
  }
  const assessment = safe.assessments.find((item) => {
    const request = safe.assessmentRequests.find(
      (candidateRequest) => candidateRequest.requestId === item.requestId,
    );
    return (
      item.candidateSnapshotId === candidateSnapshotId &&
      item.status === "completed" &&
      request?.target.mode === "find-candidate"
    );
  });
  if (!assessment) reasons.push("Candidate assessment is not completed.");
  const criteriaByKey = new Map(
    safe.criteria.map((criterion) => [
      `${criterion.criterionId}:${criterion.version}`,
      criterion,
    ]),
  );
  for (const ref of activeSet?.criterionVersionRefs ?? []) {
    const criterion = criteriaByKey.get(`${ref.criterionId}:${ref.version}`);
    if (!criterion) {
      reasons.push(`Applied criterion ${ref.criterionId} is unavailable.`);
      continue;
    }
    if (criterion.kind === "rank-higher") continue;
    const finding = safe.criterionFindings.find(
      (item) =>
        item.candidateSnapshotId === candidateSnapshotId &&
        item.criterionId === criterion.criterionId &&
        item.criterionVersion === criterion.version,
    );
    if (!findingIsStrictlyResolved(criterion, finding)) {
      reasons.push(
        `Strict criterion ${criterion.criterionId} is not resolved or overridden.`,
      );
    }
  }
  return { eligible: reasons.length === 0, reasons };
}

export type Screen02AssessmentUnavailableGate = Screen02Gate & {
  affectedRequestIds: string[];
};

function addUnavailableRequirement(
  request: Screen02AssessmentRequest | null,
  label: string,
  reasons: string[],
  affectedRequestIds: string[],
) {
  if (!request) {
    reasons.push(`${label} has no canonical assessment request.`);
    return;
  }
  if (!assessmentRequestSupportsUnavailableContinuation(request)) {
    reasons.push(
      `${label} is not terminal because assessment delivery is unavailable or exhausted.`,
    );
    return;
  }
  affectedRequestIds.push(request.requestId);
}

function computeFindAssessmentUnavailableContinuationGate(
  safe: Screen02FindState,
): Screen02AssessmentUnavailableGate {
  const candidateSnapshotId = safe.decision.tentativeSelectionSnapshotId;
  if (!candidateSnapshotId) {
    return {
      eligible: false,
      reasons: ["Find continuation requires a tentative candidate selection."],
      affectedRequestIds: [],
    };
  }
  const selectionGate = computeFindCandidateSelectionGate(
    safe,
    candidateSnapshotId,
  );
  const reasons = [...selectionGate.reasons];
  const affectedRequestIds: string[] = [];
  const activeSet = safe.candidateSets.find(
    (set) => set.candidateSetSnapshotId === safe.activeCandidateSetSnapshotId,
  );

  const completedCandidateAssessment = safe.assessments.some((assessment) => {
    const request = safe.assessmentRequests.find(
      (candidate) => candidate.requestId === assessment.requestId,
    );
    return (
      assessment.candidateSnapshotId === candidateSnapshotId &&
      assessment.status === "completed" &&
      request?.target.mode === "find-candidate"
    );
  });
  if (!completedCandidateAssessment) {
    addUnavailableRequirement(
      latestAssessmentRequest(
        safe.assessmentRequests,
        (request) =>
          request.target.mode === "find-candidate" &&
          request.target.candidateSnapshotId === candidateSnapshotId,
      ),
      "Candidate assessment",
      reasons,
      affectedRequestIds,
    );
  }

  const criteriaByKey = new Map(
    safe.criteria.map((criterion) => [
      `${criterion.criterionId}:${criterion.version}`,
      criterion,
    ]),
  );
  for (const ref of activeSet?.criterionVersionRefs ?? []) {
    const criterion = criteriaByKey.get(`${ref.criterionId}:${ref.version}`);
    if (!criterion) {
      reasons.push(`Applied criterion ${ref.criterionId} is unavailable.`);
      continue;
    }
    if (criterion.kind === "rank-higher") continue;
    const finding = safe.criterionFindings.find(
      (item) =>
        item.candidateSnapshotId === candidateSnapshotId &&
        item.criterionId === criterion.criterionId &&
        item.criterionVersion === criterion.version,
    );
    if (findingIsStrictlyResolved(criterion, finding)) continue;
    addUnavailableRequirement(
      latestAssessmentRequest(
        safe.assessmentRequests,
        (request) =>
          request.target.mode === "find-criterion" &&
          request.target.candidateSnapshotId === candidateSnapshotId &&
          request.target.criterionId === criterion.criterionId &&
          request.target.criterionVersion === criterion.version,
      ),
      `Strict criterion ${criterion.criterionId}`,
      reasons,
      affectedRequestIds,
    );
  }

  if (affectedRequestIds.length === 0) {
    reasons.push(
      "No current assessment request proves that assessment delivery is unavailable or exhausted.",
    );
  }
  return {
    eligible: reasons.length === 0,
    reasons,
    affectedRequestIds: [...new Set(affectedRequestIds)],
  };
}

export function screen02FindAssessmentUnavailableContinuationGate(
  state: Screen02FindState,
): Screen02AssessmentUnavailableGate {
  const safe = restoreScreen02FindState(state);
  if (!safe) {
    return {
      eligible: false,
      reasons: ["Find state is invalid."],
      affectedRequestIds: [],
    };
  }
  return computeFindAssessmentUnavailableContinuationGate(safe);
}

function assertFindNotContinued(state: Screen02WorkflowState) {
  if (state.mode === "find" && state.decision.continuedRevision !== null) {
    fail(
      "This Find run already continued and is sealed against later mutation.",
    );
  }
}

function assertAuditNotContinued(state: Screen02WorkflowState) {
  if (state.mode === "audit" && state.continuationHistory.length > 0) {
    fail(
      "This Audit run already continued and is sealed against later mutation.",
    );
  }
}

export function screen02AuditContinuationGate(
  state: Screen02AuditState,
): Screen02Gate {
  const safe = restoreScreen02AuditState(state);
  if (!safe) return { eligible: false, reasons: ["Audit state is invalid."] };
  return computeAuditContinuationGate(safe);
}

function computeAuditContinuationFoundationGate(
  safe: Screen02AuditState,
): Screen02Gate {
  const reasons: string[] = [];
  const confirmed = safe.confirmedIdentity;
  if (!confirmed) {
    reasons.push("Event identity has not been confirmed.");
    return { eligible: false, reasons };
  }
  const match = safe.possibleMatches.find(
    (item) => item.matchSnapshotId === confirmed.matchSnapshotId,
  );
  const activeSet = safe.matchSets.find(
    (item) => item.matchSetSnapshotId === safe.activeMatchSetSnapshotId,
  );
  if (
    activeSet && activeSet.manifest.protocolVersion !==
      SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_VERSION
  ) {
    reasons.push(
      "Active match evidence is historical or has no current retrieval execution and must be refreshed.",
    );
  }
  if (
    !match ||
    match.identitySnapshotId !== confirmed.identitySnapshotId ||
    match.matchSetSnapshotId !== confirmed.matchSetSnapshotId ||
    match.anchorRevisionId !== confirmed.anchorRevisionId ||
    !activeSet ||
    activeSet.matchSetSnapshotId !== confirmed.matchSetSnapshotId ||
    activeSet.anchorRevisionId !== safe.anchor.activeRevisionId ||
    !activeSet.possibleMatchSnapshotIds.includes(match.matchSnapshotId)
  ) {
    reasons.push("Confirmed identity no longer matches an available event record.");
  }
  const dossier = safe.dossiers.find(
    (item) =>
      item.dossierSnapshotId === confirmed.dossierSnapshotId &&
      item.identitySnapshotId === confirmed.identitySnapshotId &&
      item.status === "completed",
  );
  if (!dossier) reasons.push("Foundational shock dossier is not completed.");
  return { eligible: reasons.length === 0, reasons };
}

function computeAuditContinuationGate(safe: Screen02AuditState): Screen02Gate {
  const foundation = computeAuditContinuationFoundationGate(safe);
  const reasons = [...foundation.reasons];
  const confirmed = safe.confirmedIdentity;
  if (!confirmed) return { eligible: false, reasons };
  const assessment = safe.assessments.find((item) => {
    const request = safe.assessmentRequests.find(
      (candidateRequest) => candidateRequest.requestId === item.requestId,
    );
    return (
      item.identitySnapshotId === confirmed.identitySnapshotId &&
      item.status === "completed" &&
      request?.target.mode === "audit-confirmed-event" &&
      request.target.confirmationSnapshotId ===
        confirmed.confirmationSnapshotId &&
      request.target.dossierSnapshotId === confirmed.dossierSnapshotId
    );
  });
  if (!assessment) reasons.push("Confirmed-shock assessment is not completed.");
  return { eligible: reasons.length === 0, reasons };
}

function computeAuditAssessmentUnavailableContinuationGate(
  safe: Screen02AuditState,
): Screen02AssessmentUnavailableGate {
  const foundation = computeAuditContinuationFoundationGate(safe);
  const reasons = [...foundation.reasons];
  const affectedRequestIds: string[] = [];
  const confirmed = safe.confirmedIdentity;
  if (!confirmed) return { eligible: false, reasons, affectedRequestIds };

  const completedAssessment = safe.assessments.some((assessment) => {
    const request = safe.assessmentRequests.find(
      (candidate) => candidate.requestId === assessment.requestId,
    );
    return (
      assessment.identitySnapshotId === confirmed.identitySnapshotId &&
      assessment.status === "completed" &&
      request?.target.mode === "audit-confirmed-event" &&
      request.target.confirmationSnapshotId === confirmed.confirmationSnapshotId &&
      request.target.dossierSnapshotId === confirmed.dossierSnapshotId
    );
  });
  if (completedAssessment) {
    reasons.push(
      "The confirmed-shock assessment is already completed; use normal continuation.",
    );
  } else {
    addUnavailableRequirement(
      latestAssessmentRequest(
        safe.assessmentRequests,
        (request) =>
          request.target.mode === "audit-confirmed-event" &&
          request.target.confirmationSnapshotId ===
            confirmed.confirmationSnapshotId &&
          request.target.identitySnapshotId === confirmed.identitySnapshotId &&
          request.target.dossierSnapshotId === confirmed.dossierSnapshotId,
      ),
      "Confirmed-shock assessment",
      reasons,
      affectedRequestIds,
    );
  }
  if (affectedRequestIds.length === 0 && !completedAssessment) {
    reasons.push(
      "No current confirmed-shock request proves that assessment delivery is unavailable or exhausted.",
    );
  }
  return {
    eligible: reasons.length === 0,
    reasons,
    affectedRequestIds,
  };
}

export function screen02AuditAssessmentUnavailableContinuationGate(
  state: Screen02AuditState,
): Screen02AssessmentUnavailableGate {
  const safe = restoreScreen02AuditState(state);
  if (!safe) {
    return {
      eligible: false,
      reasons: ["Audit state is invalid."],
      affectedRequestIds: [],
    };
  }
  return computeAuditAssessmentUnavailableContinuationGate(safe);
}

const lifecycleTransitions: Record<
  Screen02AssessmentLifecycleStatus,
  readonly Screen02AssessmentLifecycleStatus[]
> = {
  prepared: [
    "message-delivered",
    "delivery-rejected",
    "service-unavailable",
    "retry-exhausted",
    "superseded",
  ],
  "message-delivered": [
    "draft-received",
    "no-tool-submission",
    "timed-out",
    "retry-exhausted",
    "superseded",
  ],
  "draft-received": ["validating", "retry-exhausted", "superseded"],
  validating: [
    "partial",
    "completed",
    "validation-failed",
    "retry-exhausted",
    "superseded",
  ],
  partial: ["validating", "retry-exhausted", "superseded"],
  completed: [],
  "delivery-rejected": ["prepared", "validating", "retry-exhausted", "superseded"],
  "service-unavailable": ["prepared", "validating", "superseded"],
  "no-tool-submission": ["validating", "retry-exhausted", "superseded"],
  "validation-failed": ["validating", "retry-exhausted", "superseded"],
  "timed-out": ["retry-exhausted", "superseded"],
  superseded: [],
  "retry-exhausted": ["validating"],
};

const assessmentLifecycleActor: Record<
  Screen02AssessmentLifecycleStatus,
  "fixed-core" | "chatgpt-host"
> = {
  prepared: "fixed-core",
  "message-delivered": "chatgpt-host",
  "draft-received": "chatgpt-host",
  validating: "fixed-core",
  partial: "fixed-core",
  completed: "fixed-core",
  "delivery-rejected": "chatgpt-host",
  "service-unavailable": "fixed-core",
  "no-tool-submission": "chatgpt-host",
  "validation-failed": "fixed-core",
  "timed-out": "chatgpt-host",
  superseded: "fixed-core",
  "retry-exhausted": "fixed-core",
};

export function fingerprintScreen02FindCandidateSet(
  value: Screen02FindState["candidateSets"][number],
) {
  const {
    candidateSetFingerprint: _fingerprint,
    status: _status,
    supersededBySnapshotId: _successor,
    ...snapshot
  } = value;
  return fingerprintScreen02WorkflowValue(snapshot);
}

export function fingerprintScreen02AuditMatchSet(
  value: Screen02AuditState["matchSets"][number],
) {
  const {
    matchSetFingerprint: _fingerprint,
    status: _status,
    supersededBySnapshotId: _successor,
    ...snapshot
  } = value;
  return fingerprintScreen02WorkflowValue(snapshot);
}

export function fingerprintScreen02AuditDossier(
  value: Screen02AuditDossier,
) {
  const { dossierFingerprint: _fingerprint, ...snapshot } = value;
  return fingerprintScreen02WorkflowValue(snapshot);
}

export function fingerprintScreen02Confirmation(
  value: NonNullable<Screen02AuditState["confirmedIdentity"]>,
) {
  const { confirmationFingerprint: _fingerprint, ...snapshot } = value;
  return fingerprintScreen02WorkflowValue(snapshot);
}

function fingerprintAnchorRevision(
  value: Screen02AuditState["anchor"]["revisions"][number],
) {
  return fingerprintScreen02WorkflowValue(value);
}

type PrepareAssessmentInput = {
  jobId: string;
  requestId: string;
  retryOfRequestId?: string | null;
  attempt: 1 | 2 | 3;
  requestedPartIds: string[];
  at: string;
} &
  (
    | {
        mode: "find-discovery-plan";
      }
    | {
        mode: "find-candidate";
        candidateSnapshotId: string;
      }
    | {
        mode: "find-criterion";
        candidateSnapshotId: string;
        criterionId: string;
        criterionVersion: number;
      }
    | {
        mode: "audit-dossier";
        identitySnapshotId: string;
      }
    | {
        mode: "audit-confirmed-event";
        identitySnapshotId: string;
      }
  );

function buildActiveAssessmentTarget(
  state: Screen02WorkflowState,
  input: PrepareAssessmentInput,
): Screen02AssessmentTarget {
  if (state.mode === "find") {
    if (
      input.mode !== "find-discovery-plan" &&
      input.mode !== "find-candidate" &&
      input.mode !== "find-criterion"
    ) {
      fail("Assessment request mode does not match Screen 2 mode.");
    }
    if (input.mode === "find-discovery-plan") {
      const activeCriteria = state.criteria.filter(
        (criterion) => criterion.status === "active",
      );
      const searchOrdinal =
        state.assessmentRequests.filter(
          (request) => request.target.mode === "find-discovery-plan",
        ).length + 1;
      const criteriaFingerprint = fingerprintScreen02WorkflowValue(
        activeCriteria,
      );
      return {
        mode: input.mode,
        searchOrdinal,
        criteriaFingerprint,
        packetFingerprint: fingerprintScreen02WorkflowValue({
          mode: input.mode,
          screen01Fingerprint: state.screen01Fingerprint,
          searchOrdinal,
          criteriaFingerprint,
        }),
      };
    }
    const set = state.candidateSets.find(
      (item) =>
        item.candidateSetSnapshotId === state.activeCandidateSetSnapshotId,
    );
    const candidate = state.candidates.find(
      (item) => item.candidateSnapshotId === input.candidateSnapshotId,
    );
    if (!set || !candidate || !set.candidateSnapshotIds.includes(candidate.candidateSnapshotId)) {
      fail("Assessment request must bind to an active Find snapshot.");
    }
    const common = {
      candidateSnapshotId: candidate.candidateSnapshotId,
      candidateFingerprint: candidate.candidateFingerprint,
    };
    if (input.mode === "find-candidate") {
      return {
        mode: input.mode,
        packetFingerprint: fingerprintScreen02WorkflowValue({
          mode: input.mode,
          screen01Fingerprint: state.screen01Fingerprint,
          candidate,
          sources: state.sources.filter((source) =>
            candidate.sourceIds.includes(source.id),
          ),
        }),
        ...common,
      };
    }
    const criterion = state.criteria.find(
      (item) =>
        item.criterionId === input.criterionId &&
        item.version === input.criterionVersion &&
        item.status === "active" &&
        set.criterionVersionRefs.some(
          (ref) =>
            ref.criterionId === item.criterionId &&
            ref.version === item.version,
        ),
    );
    if (!criterion) {
      fail(
        "Criterion assessment requires a criterion version applied to the active candidate set.",
      );
    }
    return {
      mode: input.mode,
      packetFingerprint: fingerprintScreen02WorkflowValue({
        mode: input.mode,
        screen01Fingerprint: state.screen01Fingerprint,
        candidate,
        criterion,
        sources: state.sources.filter((source) =>
          candidate.sourceIds.includes(source.id),
        ),
      }),
      ...common,
      criterionId: criterion.criterionId,
      criterionVersion: criterion.version,
    };
  }

  if (input.mode !== "audit-dossier" && input.mode !== "audit-confirmed-event") {
    fail("Assessment request mode does not match Screen 2 mode.");
  }
  const set = state.matchSets.find(
    (item) => item.matchSetSnapshotId === state.activeMatchSetSnapshotId,
  );
  const match = state.possibleMatches.find(
    (item) => item.identitySnapshotId === input.identitySnapshotId,
  );
  const revision = state.anchor.revisions.find(
    (item) => item.anchorRevisionId === state.anchor.activeRevisionId,
  );
  if (
    !set ||
    !match ||
    !revision ||
    set.anchorRevisionId !== revision.anchorRevisionId ||
    !set.possibleMatchSnapshotIds.includes(match.matchSnapshotId) ||
    match.matchSetSnapshotId !== set.matchSetSnapshotId ||
    match.anchorRevisionId !== revision.anchorRevisionId
  ) {
    fail("Assessment request must bind to the active Audit identity snapshot.");
  }
  const common = {
    anchorRevisionId: revision.anchorRevisionId,
    anchorRevisionFingerprint: fingerprintAnchorRevision(revision),
    matchSetSnapshotId: set.matchSetSnapshotId,
    matchSetFingerprint: set.matchSetFingerprint,
    matchSnapshotId: match.matchSnapshotId,
    identitySnapshotId: match.identitySnapshotId,
    matchFingerprint: match.matchFingerprint,
  };
  if (input.mode === "audit-dossier") {
    return {
      mode: input.mode,
      packetFingerprint: fingerprintScreen02WorkflowValue({
        mode: input.mode,
        screen01Fingerprint: state.screen01Fingerprint,
        anchorRevision: revision,
        matchSet: common,
        match,
        sources: state.sources.filter((source) =>
          match.sourceIds.includes(source.id),
        ),
      }),
      ...common,
    };
  }
  const confirmation = state.confirmedIdentity;
  if (
    !confirmation ||
    confirmation.identitySnapshotId !== match.identitySnapshotId ||
    confirmation.matchSnapshotId !== match.matchSnapshotId ||
    confirmation.matchSetSnapshotId !== set.matchSetSnapshotId ||
    confirmation.anchorRevisionId !== revision.anchorRevisionId
  ) {
    auditFail("research assessment requires the active confirmation snapshot.");
  }
  const dossier = state.dossiers.find(
    (item) => item.dossierSnapshotId === confirmation.dossierSnapshotId,
  );
  if (!dossier || dossier.status !== "completed") {
    auditFail("research assessment requires the confirmed completed dossier.");
  }
  return {
    mode: input.mode,
    packetFingerprint: fingerprintScreen02WorkflowValue({
      mode: input.mode,
      screen01Fingerprint: state.screen01Fingerprint,
      anchorRevision: revision,
      matchSet: common,
      match,
      dossier,
      confirmation,
      sources: state.sources.filter((source) =>
        new Set([...match.sourceIds, ...dossier.sourceIds]).has(source.id),
      ),
    }),
    ...common,
    dossierSnapshotId: dossier.dossierSnapshotId,
    dossierFingerprint: dossier.dossierFingerprint,
    confirmationSnapshotId: confirmation.confirmationSnapshotId,
    confirmationFingerprint: confirmation.confirmationFingerprint,
  };
}

function targetIsActive(
  state: Screen02WorkflowState,
  target: Screen02AssessmentTarget,
) {
  if (target.mode === "find-discovery-plan") {
    if (state.mode !== "find") return false;
    const criteriaFingerprint = fingerprintScreen02WorkflowValue(
      state.criteria.filter((criterion) => criterion.status === "active"),
    );
    return (
      target.criteriaFingerprint === criteriaFingerprint &&
      target.packetFingerprint ===
        fingerprintScreen02WorkflowValue({
          mode: target.mode,
          screen01Fingerprint: state.screen01Fingerprint,
          searchOrdinal: target.searchOrdinal,
          criteriaFingerprint: target.criteriaFingerprint,
        })
    );
  }
  try {
    const input = {
      jobId: "active-target-check",
      requestId: "active-target-check",
      attempt: 1 as const,
      requestedPartIds: ["active-target-check"],
      at: state.updatedAt,
      ...(target.mode === "find-candidate"
        ? {
            mode: target.mode,
            candidateSnapshotId: target.candidateSnapshotId,
          }
        : target.mode === "find-criterion"
          ? {
              mode: target.mode,
              candidateSnapshotId: target.candidateSnapshotId,
              criterionId: target.criterionId,
              criterionVersion: target.criterionVersion,
            }
          : {
              mode: target.mode,
              identitySnapshotId: target.identitySnapshotId,
            }),
    } as PrepareAssessmentInput;
    return (
      serializeDeterministicJson(buildActiveAssessmentTarget(state, input)) ===
      serializeDeterministicJson(target)
    );
  } catch {
    return false;
  }
}

function expectedInitialParts(input: PrepareAssessmentInput) {
  if (input.mode === "find-discovery-plan") {
    return [...screen02FindDiscoveryPlanPartIds];
  }
  if (input.mode === "find-candidate") return [...screen02FindAssessmentPartIds];
  if (input.mode === "audit-dossier") return [...screen02AuditDossierPartIds];
  if (input.mode === "audit-confirmed-event") return [...screen02AuditAssessmentPartIds];
  return [
    `${input.candidateSnapshotId}:${input.criterionId}:${input.criterionVersion}`,
  ];
}

function sameStringSet(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    [...left].sort().every((value, index) => value === [...right].sort()[index])
  );
}

function isRelatedSupersessionReplacement(
  request: Screen02AssessmentRequest,
  replacement: Screen02AssessmentRequest,
) {
  const serializedTarget = serializeDeterministicJson(request.target);
  const sameJobRetry =
    replacement.jobId === request.jobId &&
    replacement.retryOfRequestId === request.requestId &&
    replacement.attempt === request.attempt + 1 &&
    serializeDeterministicJson(replacement.target) === serializedTarget;
  const changedTargetReplacement =
    replacement.jobId !== request.jobId &&
    replacement.target.mode === request.target.mode &&
    serializeDeterministicJson(replacement.target) !== serializedTarget;
  return sameJobRetry || changedTargetReplacement;
}

export function prepareScreen02AssessmentRequest(
  state: Screen02WorkflowState,
  input: PrepareAssessmentInput,
): Screen02WorkflowState {
  const safe = requireScreen02WorkflowState(state);
  assertFindNotContinued(safe);
  assertAuditNotContinued(safe);
  assertNonEmptyString(input.jobId, "jobId");
  assertNonEmptyString(input.requestId, "requestId");
  assertNonEmptyString(input.at, "at");
  assertNotBefore(input.at, safe.updatedAt, "at");
  assertStringArray(input.requestedPartIds, "requestedPartIds");
  assertUnique(input.requestedPartIds, "requestedPartIds");
  if (safe.assessmentRequests.some((request) => request.requestId === input.requestId)) {
    fail("Assessment request ID is already present.");
  }
  const target = buildActiveAssessmentTarget(safe, input);
  if (
    input.attempt === 1 &&
    safe.assessmentRequests.some(
      (request) =>
        serializeDeterministicJson(request.target) ===
        serializeDeterministicJson(target),
    )
  ) {
    fail(
      "This immutable assessment target already has an authoritative model job.",
    );
  }
  const prior = input.retryOfRequestId
    ? safe.assessmentRequests.find(
        (request) => request.requestId === input.retryOfRequestId,
      )
    : null;
  let rootRequestId = input.requestId;
  let expectedParts = expectedInitialParts(input);
  if (input.attempt === 1) {
    if (prior || input.retryOfRequestId) {
      fail("An initial request cannot identify a retry parent.");
    }
  } else {
    if (
      !prior ||
      prior.jobId !== input.jobId ||
      prior.attempt !== input.attempt - 1 ||
      prior.target.mode !== input.mode ||
      ![
        "partial",
        "delivery-rejected",
        "no-tool-submission",
        "validation-failed",
        "timed-out",
      ].includes(prior.status) ||
      serializeDeterministicJson(prior.target) !==
        serializeDeterministicJson(target)
    ) {
      fail("Retry request does not follow the prior attempt for this immutable target.");
    }
    const jobRequests = safe.assessmentRequests.filter(
      (request) => request.jobId === input.jobId,
    );
    const accepted = new Set(
      jobRequests.flatMap((request) => request.acceptedPartIds),
    );
    expectedParts = expectedInitialParts(input).filter(
      (partId) => !accepted.has(partId),
    );
    rootRequestId = prior.rootRequestId;
  }
  if (!sameStringSet(input.requestedPartIds, expectedParts)) {
    fail("Assessment request must contain exactly the unresolved result parts.");
  }
  const request: Screen02AssessmentRequest = {
    jobId: input.jobId,
    requestId: input.requestId,
    rootRequestId,
    retryOfRequestId: prior?.requestId ?? null,
    target,
    attempt: input.attempt,
    requestedPartIds: [...input.requestedPartIds],
    status: "prepared",
    preparedAt: input.at,
    updatedAt: input.at,
    acceptedPartIds: [],
    failures: [],
    receiptIds: [],
    supersededByRequestId: null,
    supersededBySnapshotId: null,
    lifecycle: [
      {
        status: "prepared",
        at: input.at,
        actor: "fixed-core",
        note: null,
      },
    ],
  };
  const next = {
    ...clone(safe),
    revision: safe.revision + 1,
    updatedAt: input.at,
    assessmentRequests: [...safe.assessmentRequests, request],
  } as Screen02WorkflowState;
  return requireScreen02WorkflowState(next);
}

export function transitionScreen02AssessmentRequest(
  state: Screen02WorkflowState,
  input: {
    requestId: string;
    status: Screen02AssessmentLifecycleStatus;
    at: string;
    actor: "fixed-core" | "chatgpt-host" | "researcher";
    note?: string | null;
    acceptedPartIds?: string[];
    failures?: Array<{ partId: string; codes: string[] }>;
    receiptId?: string;
    supersededByRequestId?: string | null;
    supersededBySnapshotId?: string | null;
  },
): Screen02WorkflowState {
  const safe = requireScreen02WorkflowState(state);
  assertFindNotContinued(safe);
  assertAuditNotContinued(safe);
  const index = safe.assessmentRequests.findIndex(
    (request) => request.requestId === input.requestId,
  );
  if (index < 0) fail("Assessment request was not found.");
  const current = safe.assessmentRequests[index];
  if (!lifecycleTransitions[current.status].includes(input.status)) {
    fail(
      `Assessment request cannot move from ${current.status} to ${input.status}.`,
    );
  }
  if (input.actor !== assessmentLifecycleActor[input.status]) {
    fail(
      `${input.status} assessment lifecycle events must be recorded by ${assessmentLifecycleActor[input.status]}.`,
    );
  }
  assertNotBefore(input.at, safe.updatedAt, "assessment lifecycle time");
  assertNotBefore(input.at, current.updatedAt, "assessment request time");
  if (
    input.status !== "superseded" &&
    !targetIsActive(safe, current.target)
  ) {
    fail("Only supersession may close a request for an inactive snapshot.");
  }
  const accepted = input.acceptedPartIds ?? current.acceptedPartIds;
  const failures = input.failures ?? current.failures;
  const revalidatesForFixedFallback =
    input.status === "validating" &&
    ["partial", "retry-exhausted"].includes(current.status);
  assertStringArray(accepted, "acceptedPartIds");
  assertUnique(accepted, "acceptedPartIds");
  if (accepted.some((id) => !current.requestedPartIds.includes(id))) {
    fail("Accepted assessment part was not requested.");
  }
  if (
    !revalidatesForFixedFallback &&
    current.acceptedPartIds.some((id) => !accepted.includes(id))
  ) {
    fail("Accepted assessment parts are immutable.");
  }
  const failedPartIds: string[] = [];
  for (const failure of failures) {
    if (!current.requestedPartIds.includes(failure.partId)) {
      fail("Failed assessment part was not requested.");
    }
    assertStringArray(failure.codes, "failure.codes");
    if (failure.codes.length === 0) {
      fail("Failed assessment part must include at least one code.");
    }
    failedPartIds.push(failure.partId);
  }
  assertUnique(failedPartIds, "failures.partId");
  if (failedPartIds.some((partId) => accepted.includes(partId))) {
    fail("An assessment part cannot be both accepted and failed.");
  }
  const preservesPartialResult =
    current.status === "partial" &&
    ["retry-exhausted", "superseded"].includes(input.status);
  if (
    !["partial", "completed", "retry-exhausted"].includes(input.status) &&
    !preservesPartialResult &&
    !revalidatesForFixedFallback &&
    (accepted.length > 0 || failures.length > 0)
  ) {
    fail(
      "Only a validated partial or completed result may carry accepted or failed parts.",
    );
  }
  if (input.status === "completed" && !sameStringSet(accepted, current.requestedPartIds)) {
    fail("Completed assessment request must accept every requested part.");
  }
  if (
    input.status === "partial" &&
    (accepted.length === 0 ||
      failures.length === 0 ||
      !sameStringSet(
        [...accepted, ...failures.map((failure) => failure.partId)],
        current.requestedPartIds,
      ))
  ) {
    fail("Partial assessment request must account for accepted and failed parts.");
  }
  if (
    input.status === "retry-exhausted" &&
    current.attempt !== 3
  ) {
    fail("Retry exhaustion is valid only after the third attempt.");
  }
  if (
    input.status === "retry-exhausted" &&
    (failures.length === 0 ||
      !sameStringSet(
        [...accepted, ...failedPartIds],
        current.requestedPartIds,
      ))
  ) {
    fail(
      "Retry exhaustion must account for every requested part and retain at least one failure.",
    );
  }
  if (
    input.status === "superseded" &&
    Number(Boolean(input.supersededByRequestId)) +
      Number(Boolean(input.supersededBySnapshotId)) !==
      1
  ) {
    fail(
      "Supersession must identify exactly one replacement request or snapshot.",
    );
  }
  if (input.status === "superseded" && input.supersededByRequestId) {
    const replacement = safe.assessmentRequests.find(
      (request) => request.requestId === input.supersededByRequestId,
    );
    if (!replacement || !isRelatedSupersessionReplacement(current, replacement)) {
      fail(
        "Superseded assessment request points to an unrelated replacement.",
      );
    }
  }
  const receiptIds = [...current.receiptIds];
  if (input.status === "draft-received" && !input.receiptId) {
    fail("Draft receipt requires a unique receipt ID.");
  }
  if (input.receiptId) {
    assertNonEmptyString(input.receiptId, "receiptId");
    if (!receiptIds.includes(input.receiptId)) receiptIds.push(input.receiptId);
  }
  const updated: Screen02AssessmentRequest = {
    ...clone(current),
    status: input.status,
    updatedAt: input.at,
    acceptedPartIds: [...accepted],
    failures: clone(failures),
    receiptIds,
    supersededByRequestId:
      input.status === "superseded"
        ? input.supersededByRequestId ?? null
        : current.supersededByRequestId,
    supersededBySnapshotId:
      input.status === "superseded"
        ? input.supersededBySnapshotId ?? null
        : current.supersededBySnapshotId,
    lifecycle: [
      ...current.lifecycle,
      {
        status: input.status,
        at: input.at,
        actor: input.actor,
        note: input.note ?? null,
      },
    ],
  };
  const requests = [...safe.assessmentRequests];
  requests[index] = updated;
  const next = {
    ...clone(safe),
    revision: safe.revision + 1,
    updatedAt: input.at,
    assessmentRequests: requests,
  } as Screen02WorkflowState;
  if (
    revalidatesForFixedFallback &&
    current.target.mode === "find-candidate" &&
    next.mode === "find"
  ) {
    // The completed fallback below atomically replaces this request's partial
    // materialization. Its authenticated receipt and accepted-part history
    // remain on the immutable request lifecycle, while the final assessment
    // retains the already accepted values.
    next.assessments = next.assessments.filter(
      (assessment) => assessment.requestId !== current.requestId,
    );
  }
  if (
    revalidatesForFixedFallback &&
    current.target.mode === "audit-confirmed-event" &&
    next.mode === "audit"
  ) {
    next.assessments = next.assessments.filter(
      (assessment) => assessment.requestId !== current.requestId,
    );
  }
  if (
    revalidatesForFixedFallback &&
    next.mode === "audit" &&
    current.target.mode === "audit-dossier"
  ) {
    const fallbackJobRequestIds = new Set(
      safe.assessmentRequests
        .filter((request) => request.jobId === current.jobId)
        .map((request) => request.requestId),
    );
    next.dossiers = next.dossiers.filter(
      (dossier) => !fallbackJobRequestIds.has(dossier.requestId),
    );
  }
  return requireScreen02WorkflowState(next);
}

export function finalizeScreen02FindCandidateAssessmentRequest(
  state: Screen02FindState,
  input: {
    requestId: string;
    status: "partial" | "completed" | "retry-exhausted";
    at: string;
    note: string;
    acceptedPartIds: string[];
    failures: Array<{ partId: string; codes: string[] }>;
    assessment: Screen02FindCandidateAssessment;
  },
) {
  const safe = requireScreen02FindState(state);
  assertFindNotContinued(safe);
  const index = safe.assessmentRequests.findIndex(
    (request) => request.requestId === input.requestId,
  );
  const current = safe.assessmentRequests[index];
  if (
    !current ||
    current.target.mode !== "find-candidate" ||
    current.status !== "validating" ||
    !targetIsActive(safe, current.target)
  ) {
    findFail("candidate result must atomically finalize an active validating request.",
    );
  }
  if (!lifecycleTransitions[current.status].includes(input.status)) {
    fail(
      `Assessment request cannot move from ${current.status} to ${input.status}.`,
    );
  }
  assertNotBefore(input.at, safe.updatedAt, "candidate result time");
  const raw = clone(safe) as Screen02FindState;
  const request = raw.assessmentRequests[index]!;
  request.status = input.status;
  request.updatedAt = input.at;
  request.acceptedPartIds = [...input.acceptedPartIds];
  request.failures = clone(input.failures);
  request.lifecycle.push({
    status: input.status,
    at: input.at,
    actor: "fixed-core",
    note: input.note,
  });
  raw.assessments.push(clone(input.assessment));
  if (input.status === "completed") {
    raw.shockGlances = ensureScreen02FindShockGlance(
      raw,
      current.target.candidateSnapshotId,
      input.at,
    );
  }
  raw.revision += 1;
  raw.updatedAt = input.at;
  return requireScreen02FindState(raw);
}

export function finalizeScreen02FindCriterionAssessmentRequest(
  state: Screen02FindState,
  input: {
    requestId: string;
    status: "completed" | "retry-exhausted";
    at: string;
    note: string;
    acceptedPartIds: string[];
    failures: Array<{ partId: string; codes: string[] }>;
    finding: Screen02CriterionFinding;
  },
) {
  const safe = requireScreen02FindState(state);
  assertFindNotContinued(safe);
  const index = safe.assessmentRequests.findIndex(
    (request) => request.requestId === input.requestId,
  );
  const current = safe.assessmentRequests[index];
  if (
    !current ||
    current.target.mode !== "find-criterion" ||
    !targetIsActive(safe, current.target)
  ) {
    findFail("criterion result must atomically finalize an active validating request.",
    );
  }
  if (!lifecycleTransitions[current.status].includes(input.status)) {
    fail(
      `Assessment request cannot move from ${current.status} to ${input.status}.`,
    );
  }
  assertNotBefore(input.at, safe.updatedAt, "criterion result time");
  const raw = clone(safe) as Screen02FindState;
  const request = raw.assessmentRequests[index]!;
  request.status = input.status;
  request.updatedAt = input.at;
  request.acceptedPartIds = [...input.acceptedPartIds];
  request.failures = clone(input.failures);
  request.lifecycle.push({
    status: input.status,
    at: input.at,
    actor: "fixed-core",
    note: input.note,
  });
  raw.criterionFindings.push(clone(input.finding));
  raw.revision += 1;
  raw.updatedAt = input.at;
  return requireScreen02FindState(raw);
}

export function finalizeScreen02AuditDossierRequest(
  state: Screen02AuditState,
  input: {
    requestId: string;
    status: "partial" | "completed" | "retry-exhausted";
    at: string;
    note: string;
    acceptedPartIds: string[];
    failures: Array<{ partId: string; codes: string[] }>;
    dossier: Screen02AuditDossier;
  },
) {
  const safe = requireScreen02AuditState(state);
  assertAuditNotContinued(safe);
  const index = safe.assessmentRequests.findIndex(
    (request) => request.requestId === input.requestId,
  );
  const current = safe.assessmentRequests[index];
  const expectedDossierStatus =
    input.status === "retry-exhausted" ? "partial" : input.status;
  if (
    !current ||
    current.target.mode !== "audit-dossier" ||
    current.status !== "validating" ||
    !targetIsActive(safe, current.target) ||
    input.dossier.requestId !== current.requestId ||
    input.dossier.identitySnapshotId !== current.target.identitySnapshotId ||
    input.dossier.status !== expectedDossierStatus
  ) {
    auditFail("dossier result must atomically finalize its active validating request.",
    );
  }
  if (!lifecycleTransitions[current.status].includes(input.status)) {
    fail(
      `Assessment request cannot move from ${current.status} to ${input.status}.`,
    );
  }
  assertNotBefore(input.at, safe.updatedAt, "Audit dossier result time");
  const raw = clone(safe) as Screen02AuditState;
  const request = raw.assessmentRequests[index]!;
  request.status = input.status;
  request.updatedAt = input.at;
  request.acceptedPartIds = [...input.acceptedPartIds];
  request.failures = clone(input.failures);
  request.lifecycle.push({
    status: input.status,
    at: input.at,
    actor: "fixed-core",
    note: input.note,
  });
  raw.dossiers.push(clone(input.dossier));
  if (input.status === "completed") {
    raw.shockGlances = ensureScreen02AuditShockGlance(
      raw,
      current.target.matchSnapshotId,
      input.dossier.dossierSnapshotId,
      input.at,
    );
  }
  raw.revision += 1;
  raw.updatedAt = input.at;
  return requireScreen02AuditState(raw);
}

export function finalizeScreen02AuditAssessmentRequest(
  state: Screen02AuditState,
  input: {
    requestId: string;
    status: "partial" | "completed" | "retry-exhausted";
    at: string;
    note: string;
    acceptedPartIds: string[];
    failures: Array<{ partId: string; codes: string[] }>;
    assessment: Screen02AuditAssessment;
  },
) {
  const safe = requireScreen02AuditState(state);
  assertAuditNotContinued(safe);
  const index = safe.assessmentRequests.findIndex(
    (request) => request.requestId === input.requestId,
  );
  const current = safe.assessmentRequests[index];
  const expectedAssessmentStatus =
    input.status === "retry-exhausted" ? "partial" : input.status;
  if (
    !current ||
    current.target.mode !== "audit-confirmed-event" ||
    current.status !== "validating" ||
    !targetIsActive(safe, current.target) ||
    input.assessment.requestId !== current.requestId ||
    input.assessment.identitySnapshotId !== current.target.identitySnapshotId ||
    input.assessment.status !== expectedAssessmentStatus
  ) {
    auditFail("assessment result must atomically finalize its active validating request.",
    );
  }
  if (!lifecycleTransitions[current.status].includes(input.status)) {
    fail(
      `Assessment request cannot move from ${current.status} to ${input.status}.`,
    );
  }
  assertNotBefore(input.at, safe.updatedAt, "Audit assessment result time");
  const raw = clone(safe) as Screen02AuditState;
  const request = raw.assessmentRequests[index]!;
  request.status = input.status;
  request.updatedAt = input.at;
  request.acceptedPartIds = [...input.acceptedPartIds];
  request.failures = clone(input.failures);
  request.lifecycle.push({
    status: input.status,
    at: input.at,
    actor: "fixed-core",
    note: input.note,
  });
  raw.assessments.push(clone(input.assessment));
  raw.revision += 1;
  raw.updatedAt = input.at;
  return requireScreen02AuditState(raw);
}

export function selectScreen02FindCandidate(
  state: Screen02FindState,
  candidateSnapshotId: string,
  decisionId: string,
  at: string,
  reason: string,
) {
  const safe = requireScreen02FindState(state);
  assertFindNotContinued(safe);
  assertNotBefore(at, safe.updatedAt, "selection time");
  for (const [value, label] of [
    [decisionId, "decisionId"],
    [reason, "reason"],
  ] as const) {
    assertNonEmptyString(value, label);
  }
  const gate = computeFindCandidateSelectionGate(safe, candidateSnapshotId);
  if (!gate.eligible) {
    fail(`Candidate is not selectable: ${gate.reasons.join(" ")}`);
  }
  const next: Screen02FindState = {
    ...clone(safe),
    revision: safe.revision + 1,
    updatedAt: at,
    shockGlances: ensureScreen02FindShockGlance(
      safe,
      candidateSnapshotId,
      at,
    ),
    decision: {
      ...clone(safe.decision),
      tentativeSelectionSnapshotId: candidateSnapshotId,
      history: [
        ...safe.decision.history,
        {
          decisionId,
          action: "tentatively-selected",
          candidateSnapshotId,
          at,
          reason,
        },
      ],
    },
  };
  return requireScreen02FindState(next);
}

export function continueScreen02FindCandidate(
  state: Screen02FindState,
  continuationId: string,
  at: string,
  reason: string,
) {
  const safe = requireScreen02FindState(state);
  assertFindNotContinued(safe);
  assertNotBefore(at, safe.updatedAt, "continuation time");
  assertNonEmptyString(continuationId, "continuationId");
  assertNonEmptyString(reason, "reason");
  const candidateSnapshotId = safe.decision.tentativeSelectionSnapshotId;
  if (!candidateSnapshotId) {
    findFail("continuation requires a tentative candidate selection.");
  }
  const gate = computeFindCandidateGate(safe, candidateSnapshotId);
  if (!gate.eligible) {
    findFail(`continuation is blocked: ${gate.reasons.join(" ")}`);
  }
  const next: Screen02FindState = {
    ...clone(safe),
    revision: safe.revision + 1,
    updatedAt: at,
    shockGlances: ensureScreen02FindShockGlance(
      safe,
      candidateSnapshotId,
      at,
    ),
    decision: {
      ...clone(safe.decision),
      continuedRevision: safe.revision + 1,
      history: [
        ...safe.decision.history,
        {
          decisionId: continuationId,
          action: "continued",
          candidateSnapshotId,
          at,
          reason,
        },
      ],
    },
  };
  return requireScreen02FindState(next);
}

function createAssessmentUnavailableDisposition(input: {
  reason: string;
  affectedRequestIds: string[];
  recordedAt: string;
  researcherAcknowledgment: string;
}): Screen02AssessmentUnavailableDisposition {
  assertBoundedNonEmptyString(input.reason, "assessment unavailable reason");
  assertBoundedNonEmptyString(
    input.researcherAcknowledgment,
    "assessment unavailable acknowledgment",
  );
  assertStringArray(
    input.affectedRequestIds,
    "assessment unavailable affectedRequestIds",
  );
  assertUnique(
    input.affectedRequestIds,
    "assessment unavailable affectedRequestIds",
  );
  if (input.affectedRequestIds.length === 0) {
    fail(
      "Assessment unavailable continuation requires at least one affected request.",
    );
  }
  timestampValue(input.recordedAt, "assessment unavailable recordedAt");
  return {
    status: "unavailable",
    reason: input.reason,
    affectedRequestIds: [...input.affectedRequestIds],
    recordedAt: input.recordedAt,
    researcherAcknowledgment: input.researcherAcknowledgment,
    mandatoryScreen03Checks: [
      ...screen02AssessmentUnavailableScreen03Checks,
    ],
  };
}

export function continueScreen02FindWithoutAssessment(
  state: Screen02FindState,
  continuationId: string,
  at: string,
  reason: string,
  researcherAcknowledgment: string,
) {
  const safe = requireScreen02FindState(state);
  assertFindNotContinued(safe);
  assertNotBefore(at, safe.updatedAt, "assessment unavailable continuation time");
  assertNonEmptyString(continuationId, "continuationId");
  const candidateSnapshotId = safe.decision.tentativeSelectionSnapshotId;
  if (!candidateSnapshotId) {
    findFail("continuation requires a tentative candidate selection.");
  }
  const gate = computeFindAssessmentUnavailableContinuationGate(safe);
  if (!gate.eligible) {
    findFail(`assessment-unavailable continuation is blocked: ${gate.reasons.join(" ")}`,
    );
  }
  const assessmentDisposition = createAssessmentUnavailableDisposition({
    reason,
    affectedRequestIds: gate.affectedRequestIds,
    recordedAt: at,
    researcherAcknowledgment,
  });
  const next: Screen02FindState = {
    ...clone(safe),
    revision: safe.revision + 1,
    updatedAt: at,
    shockGlances: ensureScreen02FindShockGlance(
      safe,
      candidateSnapshotId,
      at,
    ),
    decision: {
      ...clone(safe.decision),
      continuedRevision: safe.revision + 1,
      history: [
        ...safe.decision.history,
        {
          decisionId: continuationId,
          action: "continued-without-assessment",
          candidateSnapshotId,
          at,
          reason,
          assessmentDisposition,
        },
      ],
    },
  };
  return requireScreen02FindState(next);
}

export function continueScreen02Audit(
  state: Screen02AuditState,
  continuationId: string,
  at: string,
  reason: string,
) {
  const safe = requireScreen02AuditState(state);
  assertAuditNotContinued(safe);
  assertNotBefore(at, safe.updatedAt, "Audit continuation time");
  assertNonEmptyString(continuationId, "continuationId");
  assertNonEmptyString(reason, "reason");
  const gate = computeAuditContinuationGate(safe);
  if (!gate.eligible || !safe.confirmedIdentity) {
    auditFail(`continuation is blocked: ${gate.reasons.join(" ")}`);
  }
  const dossier = safe.dossiers.find(
    (item) =>
      item.dossierSnapshotId === safe.confirmedIdentity!.dossierSnapshotId &&
      item.identitySnapshotId === safe.confirmedIdentity!.identitySnapshotId &&
      item.status === "completed",
  )!;
  const assessment = safe.assessments.find((item) => {
    const request = safe.assessmentRequests.find(
      (candidateRequest) => candidateRequest.requestId === item.requestId,
    );
    return (
      item.identitySnapshotId === safe.confirmedIdentity!.identitySnapshotId &&
      item.status === "completed" &&
      request?.target.mode === "audit-confirmed-event" &&
      request.target.confirmationSnapshotId ===
        safe.confirmedIdentity!.confirmationSnapshotId
    );
  })!;
  const next: Screen02AuditState = {
    ...clone(safe),
    revision: safe.revision + 1,
    updatedAt: at,
    shockGlances: ensureScreen02AuditShockGlance(
      safe,
      safe.confirmedIdentity.matchSnapshotId,
      safe.confirmedIdentity.dossierSnapshotId,
      at,
    ),
    continuationHistory: [
      ...safe.continuationHistory,
      {
        continuationId,
        confirmationSnapshotId:
          safe.confirmedIdentity.confirmationSnapshotId,
        identitySnapshotId: safe.confirmedIdentity.identitySnapshotId,
        dossierSnapshotId: dossier.dossierSnapshotId,
        assessmentId: assessment.assessmentId,
        continuedRevision: safe.revision + 1,
        at,
        reason,
      },
    ],
  };
  return requireScreen02AuditState(next);
}

export function continueScreen02AuditWithoutAssessment(
  state: Screen02AuditState,
  continuationId: string,
  at: string,
  reason: string,
  researcherAcknowledgment: string,
) {
  const safe = requireScreen02AuditState(state);
  assertAuditNotContinued(safe);
  assertNotBefore(at, safe.updatedAt, "Audit assessment unavailable continuation time");
  assertNonEmptyString(continuationId, "continuationId");
  const gate = computeAuditAssessmentUnavailableContinuationGate(safe);
  if (!gate.eligible || !safe.confirmedIdentity) {
    auditFail(`assessment-unavailable continuation is blocked: ${gate.reasons.join(" ")}`,
    );
  }
  const assessmentDisposition = createAssessmentUnavailableDisposition({
    reason,
    affectedRequestIds: gate.affectedRequestIds,
    recordedAt: at,
    researcherAcknowledgment,
  });
  const next: Screen02AuditState = {
    ...clone(safe),
    revision: safe.revision + 1,
    updatedAt: at,
    shockGlances: ensureScreen02AuditShockGlance(
      safe,
      safe.confirmedIdentity.matchSnapshotId,
      safe.confirmedIdentity.dossierSnapshotId,
      at,
    ),
    continuationHistory: [
      ...safe.continuationHistory,
      {
        continuationId,
        confirmationSnapshotId:
          safe.confirmedIdentity.confirmationSnapshotId,
        identitySnapshotId: safe.confirmedIdentity.identitySnapshotId,
        dossierSnapshotId: safe.confirmedIdentity.dossierSnapshotId,
        assessmentDisposition,
        continuedRevision: safe.revision + 1,
        at,
        reason,
      },
    ],
  };
  return requireScreen02AuditState(next);
}

export type Screen02CompatibleStateRead =
  | {
      format: "v0.2.21-workflow";
      writable: true;
      state: Screen02WorkflowState;
    }
  | {
      format: "v0.2.20-session" | "v0.2.20-envelope";
      writable: false;
      legacySession: import("./screen02-workflow-types").WorkflowDeepReadonly<Screen02Session>;
      restartDisposition:
        | "start-updated-find-from-baseline"
        | "restart-audit-identity-resolution";
      reason: string;
    };

export function readCompatibleScreen02State(
  value: unknown,
): Screen02CompatibleStateRead | null {
  const workflow = restoreScreen02WorkflowState(value);
  if (workflow) {
    return deepFreeze({
      format: "v0.2.21-workflow" as const,
      writable: true as const,
      state: workflow,
    });
  }
  const envelope = restoreScreen02StateEnvelope(value);
  const legacy = envelope ?? restoreScreen02Session(value);
  if (
    !legacy ||
    !(
      legacy.screen01Baseline.appVersion === "0.1.1" ||
      /^0\.2\.(?:[0-9]|1[0-9]|20)$/.test(
        legacy.screen01Baseline.appVersion,
      )
    )
  ) {
    return null;
  }
  return deepFreeze({
    format: envelope ? "v0.2.20-envelope" : "v0.2.20-session",
    writable: false,
    legacySession: legacy,
    restartDisposition:
      legacy.mode === "find"
        ? "start-updated-find-from-baseline"
        : "restart-audit-identity-resolution",
    reason:
      legacy.mode === "find"
        ? "The released Screen 2 session is readable but must start a new v0.2.21 Find run before it can be changed."
        : "The released Audit representation is readable but cannot be promoted to an identity-confirmed event; v0.2.21 must resolve the named shock again.",
  });
}

export function startUpdatedScreen02FromLegacy(
  legacy: Extract<Screen02CompatibleStateRead, { writable: false }>,
  runId: string,
  at: string,
): Screen02WorkflowState {
  const verified = readCompatibleScreen02State(legacy.legacySession);
  if (!verified || verified.writable) {
    fail("Legacy Screen 2 restart requires a validated read-only session.");
  }
  const baseline = clone(
    verified.legacySession.screen01Baseline,
  ) as Screen01StudyContext;
  return baseline.startingPoint === "find"
    ? createScreen02FindState(baseline, runId, at)
    : createScreen02AuditState(baseline, runId, at);
}

function validateSource(value: unknown, label: string) {
  assertRecord(value, label);
  const optionalEvidenceKeys = Object.prototype.hasOwnProperty.call(
    value,
    "evidenceText",
  )
    ? ["evidenceText"]
    : [];
  assertExactKeys(
    value,
    [
      "id",
      "sourceFingerprint",
      "title",
      "locator",
      "publisher",
      "publishedDate",
      "authorityTier",
      "channel",
      "retrievedAt",
      "userProvided",
      ...optionalEvidenceKeys,
    ],
    label,
  );
  for (const key of ["id", "sourceFingerprint", "title", "locator", "publisher", "channel", "retrievedAt"] as const) {
    assertNonEmptyString(value[key], `${label}.${key}`);
  }
  if (!fingerprintPattern.test(value.sourceFingerprint as string)) {
    fail(`${label}.sourceFingerprint is malformed.`);
  }
  assertNullableString(value.publishedDate, `${label}.publishedDate`);
  if (![1, 2, 3, 4, 5, 6].includes(value.authorityTier as number)) {
    fail(`${label}.authorityTier is invalid.`);
  }
  if (typeof value.userProvided !== "boolean") {
    fail(`${label}.userProvided must be boolean.`);
  }
  if (
    optionalEvidenceKeys.length > 0 &&
    (typeof value.evidenceText !== "string" ||
      value.evidenceText.trim().length === 0 ||
      value.evidenceText.length > 12_000)
  ) {
    fail(`${label}.evidenceText must be bounded non-empty text.`);
  }
  if (value.userProvided === true && value.authorityTier !== 6) {
    fail(`${label} user-provided material must remain Tier 6.`);
  }
  if (
    value.sourceFingerprint !==
    fingerprintScreen02WorkflowSource(
      value as unknown as Screen02WorkflowSource,
    )
  ) {
    fail(`${label}.sourceFingerprint does not match.`);
  }
}

function validateIdentity(value: unknown, label: string) {
  assertRecord(value, label);
  assertExactKeys(
    value,
    [
      "canonicalTitle",
      "commonNames",
      "formalIdentifier",
      "issuer",
      "issuingJurisdiction",
      "eventType",
      "status",
    ],
    label,
  );
  assertNonEmptyString(value.canonicalTitle, `${label}.canonicalTitle`);
  assertStringArray(value.commonNames, `${label}.commonNames`);
  assertNullableString(value.formalIdentifier, `${label}.formalIdentifier`);
  assertNullableString(value.issuer, `${label}.issuer`);
  assertNullableString(value.issuingJurisdiction, `${label}.issuingJurisdiction`);
  assertNonEmptyString(value.eventType, `${label}.eventType`);
  assertNullableString(value.status, `${label}.status`);
}

function validateClaim(
  value: unknown,
  label: string,
  sourceIds: ReadonlySet<string>,
) {
  assertRecord(value, label);
  assertExactKeys(value, ["id", "text", "sourceIds", "status", "uncertainty"], label);
  assertNonEmptyString(value.id, `${label}.id`);
  assertNonEmptyString(value.text, `${label}.text`);
  assertStringArray(value.sourceIds, `${label}.sourceIds`);
  if ((value.sourceIds as string[]).some((id) => !sourceIds.has(id))) {
    fail(`${label} cites a source outside the state.`);
  }
  if (value.status !== "provisional") {
    fail(`${label}.status must remain provisional on Screen 2.`);
  }
  assertNullableString(value.uncertainty, `${label}.uncertainty`);
}

function validateDateLead(
  value: unknown,
  label: string,
  sourceIds: ReadonlySet<string>,
) {
  assertRecord(value, label);
  assertExactKeys(
    value,
    ["id", "date", "label", "stage", "sourceIds", "status", "uncertainty"],
    label,
  );
  assertNonEmptyString(value.id, `${label}.id`);
  assertNonEmptyString(value.date, `${label}.date`);
  assertNonEmptyString(value.label, `${label}.label`);
  assertEnum(value.stage, screen02DateLeadStages, `${label}.stage`);
  assertStringArray(value.sourceIds, `${label}.sourceIds`);
  if ((value.sourceIds as string[]).some((id) => !sourceIds.has(id))) {
    fail(`${label} cites a source outside the state.`);
  }
  if (value.status !== "provisional") {
    fail(`${label}.status must remain provisional on Screen 2.`);
  }
  assertNullableString(value.uncertainty, `${label}.uncertainty`);
}

const researcherRetainedResultLanes = new Set([
  "researcher-source",
  "researcher-url",
]);

const reviewedRetainedResultLanes = new Set([
  "reviewed-registry",
  "reviewed-catalog",
]);

const officialRetainedResultLanes = new Set([
  "official-baseline",
  "official-expansion",
  "qualification-recovery",
  "context-official-bridge",
  "host-official",
]);

function retainedResultOriginSourceUnion(
  result: Screen02RetainedResultBinding["results"][number],
) {
  return [...new Set(result.origins.flatMap((origin) => origin.sourceIds))];
}

function retainedResultOriginSourcesAreResearcherProvided(
  origin: Screen02RetainedResultOrigin,
  sourceById: ReadonlyMap<string, Screen02WorkflowSource>,
) {
  return origin.sourceIds.every(
    (sourceId) => sourceById.get(sourceId)?.userProvided === true,
  );
}

function retainedResultOriginSourcesAreTrustedNonResearcher(
  origin: Screen02RetainedResultOrigin,
  sourceById: ReadonlyMap<string, Screen02WorkflowSource>,
  maximumAuthorityTier: 2 | 3,
) {
  return origin.sourceIds.every((sourceId) => {
    const source = sourceById.get(sourceId);
    return Boolean(
      source && !source.userProvided &&
        source.authorityTier <= maximumAuthorityTier,
    );
  });
}

function validateCurrentSearchManifestRetainedResultProvenance(
  manifest: Screen02WorkflowSearchManifest,
  label: string,
) {
  if (
    manifest.protocolVersion !== SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_VERSION
  ) return;
  const binding = manifest.retainedResultBinding;
  const funnel = migrateScreen02SearchFunnel(manifest.funnel);
  const execution = migrateScreen02RetrievalExecution(
    manifest.retrievalExecution,
  );
  if (!binding || !funnel || !execution) {
    fail(`${label}.retainedResultBinding lacks its current search account.`);
  }
  if (
    binding.upstreamAccount.sourceRecordsRetrieved !==
        funnel.sourceRecordsRetrieved ||
    binding.upstreamAccount.uniqueEventLeads !== funnel.uniqueEventLeads
  ) {
    fail(
      `${label}.retainedResultBinding upstream account does not match its funnel.`,
    );
  }
  const queryById = new Map(
    manifest.queryMatrix.map((query) => [query.id, query] as const),
  );
  const baselineQueryIds = new Set(execution.baseline.queryIds);
  const recoveryQueryIds = new Set(
    execution.qualificationRecovery?.queryIds ?? [],
  );
  const contextBridges = manifest.contextBridges ?? [];
  for (const [resultIndex, result] of binding.results.entries()) {
    const resultLabel =
      `${label}.retainedResultBinding.results[${resultIndex}]`;
    const boundSourceIds = new Set(result.sourceIds);
    for (const [originIndex, origin] of result.origins.entries()) {
      const originLabel = `${resultLabel}.origins[${originIndex}]`;
      if (origin.sourceIds.some((sourceId) => !boundSourceIds.has(sourceId))) {
        fail(`${originLabel} cites a source outside its bound result.`);
      }
      // A carry-forward is bound to its immutable predecessor by the Find
      // validator. It deliberately has no query record to infer or fabricate.
      if (origin.kind === "prior-result") continue;
      const query = queryById.get(origin.queryId);
      if (
        !query ||
        origin.returnedRecordIds.some(
          (recordId) => !query.returnedRecordIds.includes(recordId),
        )
      ) {
        fail(`${originLabel} does not match its cited query result records.`);
      }
      if (
        origin.retrievalLane === "official-baseline" &&
        !baselineQueryIds.has(origin.queryId)
      ) {
        fail(`${originLabel} is not a baseline execution query.`);
      }
      if (
        origin.retrievalLane === "qualification-recovery" &&
        !recoveryQueryIds.has(origin.queryId)
      ) {
        fail(`${originLabel} is not a qualification-recovery query.`);
      }
      if (origin.retrievalLane === "context-official-bridge") {
        const bridge = contextBridges.find(
          (candidate) => candidate.bridgeQueryId === origin.queryId,
        );
        if (
          !bridge ||
          bridge.status !== "corroborated" ||
          !sameStringSet(
            origin.returnedRecordIds,
            bridge.returnedOfficialRecordIds,
          )
        ) {
          fail(`${originLabel} does not match a corroborated context bridge.`);
        }
      }
    }
  }
}

function validateSearchManifest(
  value: unknown,
  label: string,
  allowLegacyEmbeddedSchemas = false,
) {
  assertRecord(value, label);
  const hasContextLeads = Object.prototype.hasOwnProperty.call(
    value,
    "contextLeads",
  );
  const hasContextBridges = Object.prototype.hasOwnProperty.call(
    value,
    "contextBridges",
  );
  const hasFunnel = Object.prototype.hasOwnProperty.call(value, "funnel");
  const hasHostReviewApplication = Object.prototype.hasOwnProperty.call(
    value,
    "hostReviewApplication",
  );
  const hasRetrievalExecution = Object.prototype.hasOwnProperty.call(
    value,
    "retrievalExecution",
  );
  const hasRetainedResultBinding = Object.prototype.hasOwnProperty.call(
    value,
    "retainedResultBinding",
  );
  assertExactKeys(
    value,
    [
      "protocolVersion",
      "exactRequest",
      "queryMatrix",
      "channels",
      "exclusions",
      ...(hasRetrievalExecution ? ["retrievalExecution"] : []),
      ...(hasRetainedResultBinding ? ["retainedResultBinding"] : []),
      ...(hasFunnel ? ["funnel"] : []),
      ...(hasHostReviewApplication ? ["hostReviewApplication"] : []),
      ...(hasContextLeads ? ["contextLeads"] : []),
      ...(hasContextBridges ? ["contextBridges"] : []),
      "stoppingRule",
      "retrievedAt",
      "outcomeValuesInspected",
    ],
    label,
  );
  if (
    value.protocolVersion !== SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_VERSION &&
    value.protocolVersion !== SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_LEGACY_VERSION
  ) {
    fail(`${label}.protocolVersion is unsupported.`);
  }
  if (
    value.protocolVersion === SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_LEGACY_VERSION
      ? hasRetrievalExecution || hasRetainedResultBinding
      : !hasFunnel || !hasRetrievalExecution || !hasRetainedResultBinding
  ) {
    fail(
      `${label}.retrievalExecution is inconsistent with its protocol version.`,
    );
  }
  assertNonEmptyString(value.exactRequest, `${label}.exactRequest`);
  assertNonEmptyString(value.retrievedAt, `${label}.retrievedAt`);
  if (value.outcomeValuesInspected !== false) {
    fail(`${label} must remain outcome-blind.`);
  }
  assertArray(value.queryMatrix, `${label}.queryMatrix`);
  for (const [index, query] of value.queryMatrix.entries()) {
    const itemLabel = `${label}.queryMatrix[${index}]`;
    assertRecord(query, itemLabel);
    assertExactKeys(query, ["id", "query", "purpose", "returnedRecordIds"], itemLabel);
    assertNonEmptyString(query.id, `${itemLabel}.id`);
    assertNonEmptyString(query.query, `${itemLabel}.query`);
    assertNonEmptyString(query.purpose, `${itemLabel}.purpose`);
    assertStringArray(query.returnedRecordIds, `${itemLabel}.returnedRecordIds`);
  }
  const queryIds = (value.queryMatrix as Array<{ id: string }>).map(
    (query) => query.id,
  );
  assertUnique(queryIds, `${label}.queryMatrix.id`);
  if (hasRetrievalExecution) {
    if (!(allowLegacyEmbeddedSchemas
      ? isCompatibleScreen02RetrievalExecution(value.retrievalExecution)
      : isScreen02RetrievalExecution(value.retrievalExecution))) {
      fail(`${label}.retrievalExecution is invalid.`);
    }
    const compatibleExecution = migrateScreen02RetrievalExecution(
      value.retrievalExecution,
    );
    if (!compatibleExecution) {
      fail(`${label}.retrievalExecution cannot be migrated.`);
    }
    const executionQueryIds = [
      ...compatibleExecution.baseline.queryIds,
      ...(compatibleExecution.qualificationRecovery?.queryIds ?? []),
    ];
    const queryIdSet = new Set(queryIds);
    if (executionQueryIds.some((queryId) => !queryIdSet.has(queryId))) {
      fail(`${label}.retrievalExecution cites an unknown query ID.`);
    }
  }
  if (
    hasRetainedResultBinding &&
    !isScreen02RetainedResultBinding(value.retainedResultBinding)
  ) {
    fail(`${label}.retainedResultBinding is invalid.`);
  }
  assertArray(value.channels, `${label}.channels`);
  for (const [index, channel] of value.channels.entries()) {
    const itemLabel = `${label}.channels[${index}]`;
    assertRecord(channel, itemLabel);
    assertExactKeys(channel, ["channel", "status", "note", "retrievedAt"], itemLabel);
    assertNonEmptyString(channel.channel, `${itemLabel}.channel`);
    assertEnum(channel.status, ["searched", "not-searched", "failed"], `${itemLabel}.status`);
    assertNonEmptyString(channel.note, `${itemLabel}.note`);
    assertNullableString(channel.retrievedAt, `${itemLabel}.retrievedAt`);
  }
  assertArray(value.exclusions, `${label}.exclusions`);
  for (const [index, exclusion] of value.exclusions.entries()) {
    const itemLabel = `${label}.exclusions[${index}]`;
    assertRecord(exclusion, itemLabel);
    assertExactKeysWithOptional(
      exclusion,
      ["recordId", "reason"],
      ["qualification"],
      itemLabel,
    );
    assertNonEmptyString(exclusion.recordId, `${itemLabel}.recordId`);
    assertNonEmptyString(exclusion.reason, `${itemLabel}.reason`);
    if (Object.prototype.hasOwnProperty.call(exclusion, "qualification")) {
      const qualification = exclusion.qualification;
      if (!(allowLegacyEmbeddedSchemas
        ? isCompatibleScreen02CandidateQualification(qualification)
        : isScreen02CandidateQualification(qualification))) {
        fail(`${itemLabel}.qualification is invalid or targets another record.`);
      }
      if (
        (qualification as { candidateId: string }).candidateId !==
          exclusion.recordId
      ) {
        fail(`${itemLabel}.qualification is invalid or targets another record.`);
      }
    }
  }
  if (hasFunnel) {
    const funnelLabel = `${label}.funnel`;
    const compatibleLegacyFunnel =
      allowLegacyEmbeddedSchemas &&
      isCompatibleScreen02SearchFunnel(value.funnel) &&
      !isScreen02SearchFunnel(value.funnel);
    if (!compatibleLegacyFunnel) {
      assertRecord(value.funnel, funnelLabel);
      const countKeys = [
      "sourceRecordsRetrieved",
      "uniqueEventLeads",
      "evaluatedUniqueLeads",
      "duplicatesRemoved",
      "hardScopePassed",
      "hardScopeDemonstratedMismatch",
      "hardScopeInsufficientEvidence",
      "hardScopeMixed",
      "sourceQualityPassed",
      "substantiveInformationPassed",
      "relevancePassed",
      "exposureFeasibilityPassed",
      "qualifiedCandidates",
      "displayedCandidates",
      "directCandidates",
      "adjacentCandidates",
      "broadCandidates",
      "mismatchCandidates",
      "deeperRetrievalAttempts",
      "retrievalFailures",
      "hostContribution",
      ] as const;
      assertExactKeys(
        value.funnel,
        ["schemaVersion", ...countKeys],
        funnelLabel,
      );
      if (
        value.funnel.schemaVersion !== SCREEN_02_SEARCH_FUNNEL_SCHEMA_VERSION
      ) {
        fail(`${funnelLabel}.schemaVersion is unsupported.`);
      }
      for (const key of countKeys) {
        const count = value.funnel[key];
        if (!Number.isSafeInteger(count) || (count as number) < 0) {
          fail(`${funnelLabel}.${key} must be a non-negative safe integer.`);
        }
      }
      const funnel = value.funnel as Record<
        (typeof countKeys)[number],
        number
      >;
      if (funnel.evaluatedUniqueLeads > funnel.uniqueEventLeads) {
        fail(`${funnelLabel}.evaluatedUniqueLeads exceeds uniqueEventLeads.`);
      }
      if (
        funnel.duplicatesRemoved !==
          Math.max(0, funnel.sourceRecordsRetrieved - funnel.uniqueEventLeads)
      ) {
        fail(`${funnelLabel}.duplicatesRemoved is inconsistent.`);
      }
      const cumulativeStages = [
        funnel.evaluatedUniqueLeads,
        funnel.sourceQualityPassed,
        funnel.substantiveInformationPassed,
        funnel.relevancePassed,
        funnel.exposureFeasibilityPassed,
        funnel.qualifiedCandidates,
        funnel.displayedCandidates,
      ];
      if (
        cumulativeStages.some(
          (count, index) => index > 0 && count > cumulativeStages[index - 1],
        )
      ) {
        fail(`${funnelLabel} cumulative stage counts are inconsistent.`);
      }
      if (
        funnel.hardScopePassed + funnel.hardScopeDemonstratedMismatch +
            funnel.hardScopeInsufficientEvidence + funnel.hardScopeMixed !==
          funnel.evaluatedUniqueLeads
      ) {
        fail(`${funnelLabel} hard-scope disposition counts are inconsistent.`);
      }
      if (
        funnel.directCandidates + funnel.adjacentCandidates +
            funnel.broadCandidates + funnel.mismatchCandidates !==
          funnel.evaluatedUniqueLeads
      ) {
        fail(`${funnelLabel} relevance-class counts are inconsistent.`);
      }
    }
  }
  if (
    hasRetrievalExecution && isScreen02SearchFunnel(value.funnel) &&
    !screen02SearchFunnelMatchesRetrievalExecution(
      value.funnel,
      migrateScreen02RetrievalExecution(value.retrievalExecution),
    )
  ) {
    fail(`${label}.funnel is inconsistent with retrievalExecution.`);
  }
  if (
    hasHostReviewApplication &&
    !isScreen02HostReviewApplication(value.hostReviewApplication)
  ) {
    fail(`${label}.hostReviewApplication is invalid.`);
  }
  if (hasContextLeads) {
    assertArray(value.contextLeads, `${label}.contextLeads`);
    if (
      value.contextLeads.length > 5 ||
      value.contextLeads.some((lead) => !isScreen02ContextLead(lead))
    ) {
      fail(`${label}.contextLeads exceeds the bounded lead limit.`);
    }
    const leadIds = (value.contextLeads as Screen02ContextLead[]).map(
      (lead) => lead.id,
    );
    if (new Set(leadIds).size !== leadIds.length) {
      fail(`${label}.contextLeads contains duplicate lead IDs.`);
    }
  }
  if (hasContextBridges) {
    assertArray(value.contextBridges, `${label}.contextBridges`);
    if (
      value.contextBridges.length > 1 ||
      value.contextBridges.some(
        (bridge) => !isScreen02ContextOfficialBridgeProvenance(bridge),
      )
    ) {
      fail(`${label}.contextBridges exceeds the bounded bridge limit.`);
    }
    const bridges = value.contextBridges as Screen02ContextOfficialBridgeProvenance[];
    const contextualLeadById = new Map(
      hasContextLeads
        ? (value.contextLeads as Screen02ContextLead[]).map((lead) => [
            lead.id,
            lead,
          ] as const)
        : [],
    );
    const queryIdSet = new Set(queryIds);
    if (
      bridges.some(
        (bridge) =>
          !contextualLeadById.has(bridge.contextualLeadId) ||
          !queryIdSet.has(bridge.bridgeQueryId),
      )
    ) {
      fail(
        `${label}.contextBridges cites an unknown contextual lead or query ID.`,
      );
    }
    for (const bridge of bridges) {
      const lead = contextualLeadById.get(bridge.contextualLeadId);
      const query = (value.queryMatrix as Array<{
        id: string;
        query: string;
        returnedRecordIds: string[];
      }>).find((candidate) => candidate.id === bridge.bridgeQueryId);
      if (
        !lead ||
        screen02VisibleTitleFederalRegisterIdentifier(lead.title) !==
          bridge.formalIdentifier ||
        !query ||
        !screen02FederalRegisterBridgeQueryMatchesIdentifier(
          query.query,
          bridge.formalIdentifier,
        ) ||
        serializeDeterministicJson(query.returnedRecordIds) !==
          serializeDeterministicJson(bridge.returnedOfficialRecordIds)
      ) {
        fail(
          `${label}.contextBridges does not match its cited lead or query result IDs.`,
        );
      }
    }
  }
  validateCurrentSearchManifestRetainedResultProvenance(
    value as unknown as Screen02WorkflowSearchManifest,
    label,
  );
  assertRecord(value.stoppingRule, `${label}.stoppingRule`);
  assertExactKeys(value.stoppingRule, ["rule", "status", "note"], `${label}.stoppingRule`);
  assertNonEmptyString(value.stoppingRule.rule, `${label}.stoppingRule.rule`);
  assertEnum(
    value.stoppingRule.status,
    ["not-started", "met", "not-met"],
    `${label}.stoppingRule.status`,
  );
  assertNonEmptyString(value.stoppingRule.note, `${label}.stoppingRule.note`);
}

function validateAssessmentComponent(
  value: unknown,
  categories: readonly string[],
  label: string,
  allowedSourceIds: ReadonlySet<string>,
) {
  if (value === null) return;
  assertRecord(value, label);
  assertExactKeys(value, ["category", "explanation", "evidenceSourceIds"], label);
  assertEnum(value.category, categories, `${label}.category`);
  assertNonEmptyString(value.explanation, `${label}.explanation`);
  assertStringArray(value.evidenceSourceIds, `${label}.evidenceSourceIds`);
  assertUnique(value.evidenceSourceIds as string[], `${label}.evidenceSourceIds`);
  if ((value.evidenceSourceIds as string[]).some((id) => !allowedSourceIds.has(id))) {
    fail(`${label} cites evidence outside the target snapshot.`);
  }
  if (
    value.category !== "unclear" &&
    (value.evidenceSourceIds as string[]).length === 0
  ) {
    fail(`${label} resolved category requires attached evidence.`);
  }
}

function validateAssessmentRequest(value: unknown, label: string) {
  assertRecord(value, label);
  assertExactKeys(
    value,
    [
      "jobId",
      "requestId",
      "rootRequestId",
      "retryOfRequestId",
      "target",
      "attempt",
      "requestedPartIds",
      "status",
      "preparedAt",
      "updatedAt",
      "acceptedPartIds",
      "failures",
      "receiptIds",
      "supersededByRequestId",
      "supersededBySnapshotId",
      "lifecycle",
    ],
    label,
  );
  assertNonEmptyString(value.jobId, `${label}.jobId`);
  assertNonEmptyString(value.requestId, `${label}.requestId`);
  assertNonEmptyString(value.rootRequestId, `${label}.rootRequestId`);
  assertNullableString(value.retryOfRequestId, `${label}.retryOfRequestId`);
  assertRecord(value.target, `${label}.target`);
  const targetKeys: Record<string, readonly string[]> = {
    "find-discovery-plan": [
      "mode",
      "packetFingerprint",
      "searchOrdinal",
      "criteriaFingerprint",
    ],
    "find-candidate": [
      "mode",
      "packetFingerprint",
      "candidateSnapshotId",
      "candidateFingerprint",
    ],
    "find-criterion": [
      "mode",
      "packetFingerprint",
      "candidateSnapshotId",
      "candidateFingerprint",
      "criterionId",
      "criterionVersion",
    ],
    "audit-dossier": [
      "mode",
      "packetFingerprint",
      "anchorRevisionId",
      "anchorRevisionFingerprint",
      "matchSetSnapshotId",
      "matchSetFingerprint",
      "matchSnapshotId",
      "identitySnapshotId",
      "matchFingerprint",
    ],
    "audit-confirmed-event": [
      "mode",
      "packetFingerprint",
      "anchorRevisionId",
      "anchorRevisionFingerprint",
      "matchSetSnapshotId",
      "matchSetFingerprint",
      "matchSnapshotId",
      "identitySnapshotId",
      "matchFingerprint",
      "dossierSnapshotId",
      "dossierFingerprint",
      "confirmationSnapshotId",
      "confirmationFingerprint",
    ],
  };
  const expectedTargetKeys = targetKeys[value.target.mode as string];
  if (!expectedTargetKeys) {
    fail(`${label}.target.mode is unsupported.`);
  }
  assertExactKeys(value.target, expectedTargetKeys, `${label}.target`);
  for (const [key, targetValue] of Object.entries(value.target)) {
    if (
      key === "criterionVersion" ||
      key === "searchOrdinal" ||
      key === "mode"
    ) continue;
    assertNonEmptyString(targetValue, `${label}.target.${key}`);
    if (key.endsWith("Fingerprint") && !fingerprintPattern.test(targetValue as string)) {
      fail(`${label}.target.${key} is malformed.`);
    }
  }
  if (
    value.target.mode === "find-criterion" &&
    (!Number.isSafeInteger(value.target.criterionVersion) ||
      (value.target.criterionVersion as number) < 1)
  ) {
    fail(`${label}.target.criterionVersion is invalid.`);
  }
  if (
    value.target.mode === "find-discovery-plan" &&
    (!Number.isSafeInteger(value.target.searchOrdinal) ||
      (value.target.searchOrdinal as number) < 1 ||
      (value.target.searchOrdinal as number) > 1_000 ||
      typeof value.target.criteriaFingerprint !== "string" ||
      !fingerprintPattern.test(value.target.criteriaFingerprint))
  ) {
    fail(`${label}.target discovery-plan binding is invalid.`);
  }
  if (![1, 2, 3].includes(value.attempt as number)) {
    fail(`${label}.attempt must be 1, 2, or 3.`);
  }
  if (value.attempt === 1) {
    if (
      value.rootRequestId !== value.requestId ||
      value.retryOfRequestId !== null
    ) {
      fail(`${label} initial-attempt lineage is invalid.`);
    }
  } else if (value.retryOfRequestId === null) {
    fail(`${label} retry attempt lacks its prior request.`);
  }
  assertStringArray(value.requestedPartIds, `${label}.requestedPartIds`);
  if ((value.requestedPartIds as string[]).length === 0) {
    fail(`${label} must request at least one result part.`);
  }
  assertUnique(value.requestedPartIds as string[], `${label}.requestedPartIds`);
  assertEnum(value.status, screen02AssessmentLifecycleStatuses, `${label}.status`);
  assertNonEmptyString(value.preparedAt, `${label}.preparedAt`);
  assertNonEmptyString(value.updatedAt, `${label}.updatedAt`);
  assertStringArray(value.acceptedPartIds, `${label}.acceptedPartIds`);
  assertUnique(value.acceptedPartIds as string[], `${label}.acceptedPartIds`);
  if (
    (value.acceptedPartIds as string[]).some(
      (id) => !(value.requestedPartIds as string[]).includes(id),
    )
  ) {
    fail(`${label} accepted an unrequested result part.`);
  }
  assertArray(value.failures, `${label}.failures`);
  const failedIds: string[] = [];
  for (const [index, failure] of value.failures.entries()) {
    const failureLabel = `${label}.failures[${index}]`;
    assertRecord(failure, failureLabel);
    assertExactKeys(failure, ["partId", "codes"], failureLabel);
    assertNonEmptyString(failure.partId, `${failureLabel}.partId`);
    if (!(value.requestedPartIds as string[]).includes(failure.partId as string)) {
      fail(`${failureLabel} names an unrequested result part.`);
    }
    failedIds.push(failure.partId as string);
    assertStringArray(failure.codes, `${failureLabel}.codes`);
    if ((failure.codes as string[]).length === 0) {
      fail(`${failureLabel}.codes cannot be empty.`);
    }
    assertUnique(failure.codes as string[], `${failureLabel}.codes`);
  }
  assertUnique(failedIds, `${label}.failures`);
  if (
    failedIds.some((id) =>
      (value.acceptedPartIds as string[]).includes(id),
    )
  ) {
    fail(`${label} cannot both accept and fail a target.`);
  }
  assertStringArray(value.receiptIds, `${label}.receiptIds`);
  assertUnique(value.receiptIds as string[], `${label}.receiptIds`);
  assertNullableString(value.supersededByRequestId, `${label}.supersededByRequestId`);
  assertNullableString(value.supersededBySnapshotId, `${label}.supersededBySnapshotId`);
  assertArray(value.lifecycle, `${label}.lifecycle`);
  if (value.lifecycle.length === 0) fail(`${label}.lifecycle cannot be empty.`);
  for (const [index, event] of value.lifecycle.entries()) {
    const eventLabel = `${label}.lifecycle[${index}]`;
    assertRecord(event, eventLabel);
    assertExactKeys(event, ["status", "at", "actor", "note"], eventLabel);
    assertEnum(event.status, screen02AssessmentLifecycleStatuses, `${eventLabel}.status`);
    assertNonEmptyString(event.at, `${eventLabel}.at`);
    assertEnum(event.actor, ["fixed-core", "chatgpt-host", "researcher"], `${eventLabel}.actor`);
    if (
      event.actor !==
      assessmentLifecycleActor[
        event.status as Screen02AssessmentLifecycleStatus
      ]
    ) {
      fail(`${eventLabel}.actor does not own this lifecycle status.`);
    }
    assertNullableString(event.note, `${eventLabel}.note`);
    if (index === 0 && event.status !== "prepared") {
      fail(`${label}.lifecycle must start at prepared.`);
    }
    if (index > 0) {
      const prior = value.lifecycle[index - 1] as Record<string, unknown>;
      assertNotBefore(event.at, prior.at, `${eventLabel}.at`);
      if (
        !lifecycleTransitions[
          prior.status as Screen02AssessmentLifecycleStatus
        ].includes(event.status as Screen02AssessmentLifecycleStatus)
      ) {
        fail(`${eventLabel} is not a valid lifecycle transition.`);
      }
    }
  }
  const last = value.lifecycle.at(-1) as Record<string, unknown>;
  if (last.status !== value.status) {
    fail(`${label}.status must equal the final lifecycle event.`);
  }
  if (
    (value.lifecycle[0] as Record<string, unknown>).at !== value.preparedAt ||
    last.at !== value.updatedAt
  ) {
    fail(`${label} timestamps must match its lifecycle boundaries.`);
  }
  const receivedDraft = value.lifecycle.some(
    (event) =>
      (event as Record<string, unknown>).status === "draft-received",
  );
  if (receivedDraft !== ((value.receiptIds as string[]).length > 0)) {
    fail(`${label} receipt IDs do not match draft-received history.`);
  }
  if (
    value.status === "completed" &&
    !sameStringSet(
      value.acceptedPartIds as string[],
      value.requestedPartIds as string[],
    )
  ) {
    fail(`${label} completed without accepting every result part.`);
  }
  if (value.status === "completed" && failedIds.length > 0) {
    fail(`${label} completed result cannot retain failed parts.`);
  }
  if (
    value.status === "partial" &&
    ((value.acceptedPartIds as string[]).length === 0 ||
      value.failures.length === 0 ||
      !sameStringSet(
        [
          ...(value.acceptedPartIds as string[]),
          ...failedIds,
        ],
        value.requestedPartIds as string[],
      ))
  ) {
    fail(`${label} partial state must account for every result part.`);
  }
  const carriesPartialPartition =
    (value.acceptedPartIds as string[]).length > 0 &&
    failedIds.length > 0 &&
    sameStringSet(
      [...(value.acceptedPartIds as string[]), ...failedIds],
      value.requestedPartIds as string[],
    );
  const carriesExhaustedPartition =
    failedIds.length > 0 &&
    sameStringSet(
      [...(value.acceptedPartIds as string[]), ...failedIds],
      value.requestedPartIds as string[],
    );
  if (value.status === "retry-exhausted") {
    if (value.attempt !== 3) {
      fail(`${label} exhausted retries before attempt 3.`);
    }
    if (!carriesExhaustedPartition) {
      fail(
        `${label} retry exhaustion must account for every requested result part.`,
      );
    }
  }
  const priorLifecycleStatus =
    value.lifecycle.length > 1
      ? ((value.lifecycle.at(-2) as Record<string, unknown>)
          .status as Screen02AssessmentLifecycleStatus)
      : null;
  const mustBeResultEmpty = [
    "prepared",
    "message-delivered",
    "draft-received",
    "validating",
    "delivery-rejected",
    "service-unavailable",
    "no-tool-submission",
    "validation-failed",
    "timed-out",
  ].includes(value.status as string);
  if (
    (mustBeResultEmpty ||
      (value.status === "superseded" && priorLifecycleStatus !== "partial")) &&
    ((value.acceptedPartIds as string[]).length > 0 || failedIds.length > 0)
  ) {
    fail(`${label} carries result parts before a validated result.`);
  }
  if (
    value.status === "superseded" &&
    priorLifecycleStatus === "partial" &&
    !carriesPartialPartition
  ) {
    fail(`${label} supersession must preserve its partial result.`);
  }
  if (
    value.status === "superseded" &&
    Number(value.supersededByRequestId !== null) +
      Number(value.supersededBySnapshotId !== null) !==
      1
  ) {
    fail(
      `${label} supersession must name exactly one replacement request or snapshot.`,
    );
  }
  if (
    value.status !== "superseded" &&
    (value.supersededByRequestId !== null ||
      value.supersededBySnapshotId !== null)
  ) {
    fail(`${label} has supersession metadata without being superseded.`);
  }
}

function initialPartsForTarget(target: Screen02AssessmentTarget) {
  if (target.mode === "find-discovery-plan") {
    return [...screen02FindDiscoveryPlanPartIds];
  }
  if (target.mode === "find-candidate") {
    return [...screen02FindAssessmentPartIds];
  }
  if (target.mode === "audit-dossier") {
    return [...screen02AuditDossierPartIds];
  }
  if (target.mode === "audit-confirmed-event") {
    return [...screen02AuditAssessmentPartIds];
  }
  return [
    `${target.candidateSnapshotId}:${target.criterionId}:${target.criterionVersion}`,
  ];
}

function validateAssessmentRequestLineage(
  requests: readonly Screen02AssessmentRequest[],
) {
  const requestMap = new Map(
    requests.map((request) => [request.requestId, request]),
  );
  const jobs = new Map<string, Screen02AssessmentRequest[]>();
  const jobsByTarget = new Map<string, string>();
  for (const request of requests) {
    const job = jobs.get(request.jobId) ?? [];
    job.push(request);
    jobs.set(request.jobId, job);
    const serializedTarget = serializeDeterministicJson(request.target);
    const targetJob = jobsByTarget.get(serializedTarget);
    if (targetJob && targetJob !== request.jobId) {
      fail(
        "An immutable assessment target cannot have multiple model jobs.",
      );
    }
    jobsByTarget.set(serializedTarget, request.jobId);
    if (request.supersededByRequestId !== null) {
      const replacement = requestMap.get(request.supersededByRequestId);
      if (!replacement || replacement.requestId === request.requestId) {
        fail("Superseded assessment request has an invalid replacement.");
      }
      if (!isRelatedSupersessionReplacement(request, replacement)) {
        fail(
          "Superseded assessment request points to an unrelated replacement.",
        );
      }
    }
  }
  for (const [jobId, jobRequests] of jobs) {
    const ordered = [...jobRequests].sort(
      (left, right) => left.attempt - right.attempt,
    );
    assertUnique(
      ordered.map((request) => String(request.attempt)),
      `assessment job ${jobId} attempts`,
    );
    if (ordered[0]?.attempt !== 1) {
      fail(`Assessment job ${jobId} does not start at attempt 1.`);
    }
    const rootRequestId = ordered[0].requestId;
    const accepted = new Set<string>();
    const fullParts = initialPartsForTarget(ordered[0].target);
    for (const [index, request] of ordered.entries()) {
      if (
        request.rootRequestId !== rootRequestId ||
        serializeDeterministicJson(request.target) !==
          serializeDeterministicJson(ordered[0].target) ||
        request.attempt !== index + 1
      ) {
        fail(`Assessment job ${jobId} has inconsistent lineage.`);
      }
      if (index === 0) {
        if (
          request.retryOfRequestId !== null ||
          !sameStringSet(request.requestedPartIds, fullParts)
        ) {
          fail(`Assessment job ${jobId} has an invalid initial request.`);
        }
      } else {
        const prior = ordered[index - 1];
        if (
          request.retryOfRequestId !== prior.requestId ||
          ![
            "partial",
            "delivery-rejected",
            "no-tool-submission",
            "validation-failed",
            "timed-out",
            "superseded",
          ].includes(prior.status) ||
          (prior.status === "superseded" &&
            prior.supersededByRequestId !== request.requestId)
        ) {
          fail(`Assessment job ${jobId} has an invalid retry parent.`);
        }
        const unresolved = fullParts.filter((partId) => !accepted.has(partId));
        if (!sameStringSet(request.requestedPartIds, unresolved)) {
          fail(`Assessment job ${jobId} did not retry only unresolved parts.`);
        }
      }
      for (const partId of request.acceptedPartIds) accepted.add(partId);
    }
  }
}

function validateAcceptedAssessmentFieldHistory(
  assessments: ReadonlyArray<
    Screen02FindCandidateAssessment | Screen02AuditAssessment
  >,
  requests: ReadonlyMap<string, Screen02AssessmentRequest>,
  label: string,
) {
  const jobs = new Map<
    string,
    Array<Screen02FindCandidateAssessment | Screen02AuditAssessment>
  >();
  for (const assessment of assessments) {
    const request = requests.get(assessment.requestId);
    if (!request) continue;
    const job = jobs.get(request.jobId) ?? [];
    job.push(assessment);
    jobs.set(request.jobId, job);
  }
  for (const [jobId, jobAssessments] of jobs) {
    const ordered = [...jobAssessments].sort(
      (left, right) =>
        requests.get(left.requestId)!.attempt -
        requests.get(right.requestId)!.attempt,
    );
    const acceptedValues = new Map<string, string>();
    for (const assessment of ordered) {
      const record = assessment as unknown as Record<string, unknown>;
      for (const field of assessment.acceptedFields) {
        const serialized = serializeDeterministicJson(record[field]);
        const prior = acceptedValues.get(field);
        if (prior !== undefined && prior !== serialized) {
          fail(
            `${label} job ${jobId} overwrote the accepted ${field} result.`,
          );
        }
        acceptedValues.set(field, serialized);
      }
    }
  }
}

function validateAcceptedDossierPartHistory(
  dossiers: readonly Screen02AuditDossier[],
  requests: ReadonlyMap<string, Screen02AssessmentRequest>,
) {
  const acceptedByJob = new Map<string, Map<string, string>>();
  const ordered = [...dossiers].sort(
    (left, right) =>
      requests.get(left.requestId)!.attempt -
      requests.get(right.requestId)!.attempt,
  );
  for (const dossier of ordered) {
    const request = requests.get(dossier.requestId);
    if (!request || request.target.mode !== "audit-dossier") continue;
    const accepted = acceptedByJob.get(request.jobId) ?? new Map<string, string>();
    const record = dossier as unknown as Record<string, unknown>;
    for (const partId of request.acceptedPartIds) {
      const serialized = serializeDeterministicJson(record[partId]);
      const prior = accepted.get(partId);
      if (prior !== undefined && prior !== serialized) {
        auditFail(`dossier job ${request.jobId} overwrote accepted ${partId}.`,
        );
      }
      accepted.set(partId, serialized);
    }
    acceptedByJob.set(request.jobId, accepted);
  }
}

function validateCommonRoot(
  value: Record<string, unknown>,
  mode: "find" | "audit",
) {
  if (value.schemaVersion !== SCREEN_02_WORKFLOW_SCHEMA_VERSION) {
    screen2Fail("workflow schema version is unsupported.");
  }
  if (value.sourceScreen !== "screen-02" || value.mode !== mode) {
    screen2Fail("workflow mode or source is invalid.");
  }
  assertNonEmptyString(value.runId, "runId");
  const baseline = validateReadyBaseline(value.screen01Baseline, mode);
  if (value.screen01Fingerprint !== fingerprintScreen01StudyContext(baseline)) {
    fail("Screen 1 baseline fingerprint does not match.");
  }
  if (!Number.isSafeInteger(value.revision) || (value.revision as number) < 0) {
    screen2Fail("revision must be a non-negative safe integer.");
  }
  timestampValue(value.createdAt, "createdAt");
  timestampValue(value.updatedAt, "updatedAt");
  assertNotBefore(value.updatedAt, value.createdAt, "updatedAt");
  if (value.outcomeValuesInspected !== false) {
    screen2Fail("workflow state must remain outcome-blind.");
  }
  assertArray(value.sources, "sources");
  value.sources.forEach((source, index) => validateSource(source, `sources[${index}]`));
  const sourceIds = value.sources.map((source) => (source as Record<string, unknown>).id as string);
  assertUnique(sourceIds, "sources.id");
  assertUnique(
    value.sources.map(
      (source) =>
        (source as Record<string, unknown>).sourceFingerprint as string,
    ),
    "sources.sourceFingerprint",
  );
  return { baseline, sourceIds: new Set(sourceIds) };
}

function validateCriterion(value: unknown, label: string) {
  assertRecord(value, label);
  assertExactKeys(
    value,
    [
      "criterionId",
      "version",
      "kind",
      "status",
      "statusReason",
      "text",
      "exactRequest",
      "evaluator",
      "source",
      "createdAt",
    ],
    label,
  );
  assertNonEmptyString(value.criterionId, `${label}.criterionId`);
  if (!Number.isSafeInteger(value.version) || (value.version as number) < 1) {
    fail(`${label}.version must be a positive safe integer.`);
  }
  assertEnum(value.kind, screen02CriterionKinds, `${label}.kind`);
  assertEnum(value.status, ["active", "removed"], `${label}.status`);
  assertNonEmptyString(value.statusReason, `${label}.statusReason`);
  assertNonEmptyString(value.text, `${label}.text`);
  assertNonEmptyString(value.exactRequest, `${label}.exactRequest`);
  assertEnum(
    value.evaluator,
    screen02CriterionEvaluators,
    `${label}.evaluator`,
  );
  if (
    value.evaluator === "fixed-candidate-source-presence-v1" &&
    (value.kind !== fixedCandidateSourceCriterion.kind ||
      value.text !== fixedCandidateSourceCriterion.text ||
      value.exactRequest !== fixedCandidateSourceCriterion.exactRequest)
  ) {
    fail(
      `${label} fixed evaluator must use its canonical criterion definition.`,
    );
  }
  assertEnum(value.source, ["researcher", "ai-interpretation"], `${label}.source`);
  assertNonEmptyString(value.createdAt, `${label}.createdAt`);
}

function validateFindAssessment(
  value: unknown,
  label: string,
  candidate: Screen02FindCandidateSnapshot,
  requests: ReadonlyMap<string, Screen02AssessmentRequest>,
) {
  assertRecord(value, label);
  assertExactKeys(
    value,
    [
      "assessmentId",
      "candidateSnapshotId",
      "requestId",
      "status",
      "studyFit",
      "outcomePathway",
      "measurementPotential",
      "mainConcern",
      "nextChecks",
      "evidenceSourceIds",
      "acceptedFields",
      "overallJudgment",
      "overallJudgmentMethod",
      "recordedAt",
    ],
    label,
  );
  assertNonEmptyString(value.assessmentId, `${label}.assessmentId`);
  if (value.candidateSnapshotId !== candidate.candidateSnapshotId) {
    fail(`${label} targets the wrong candidate snapshot.`);
  }
  assertNonEmptyString(value.requestId, `${label}.requestId`);
  const request = requests.get(value.requestId as string);
  if (
    !request ||
    request.target.mode !== "find-candidate" ||
    request.target.candidateSnapshotId !== candidate.candidateSnapshotId
  ) {
    fail(`${label} lacks a matching Find assessment request.`);
  }
  assertEnum(
    value.status,
    ["partial", "completed", "retry-exhausted"],
    `${label}.status`,
  );
  const requestResultStatus =
    request.status === "superseded" &&
    request.lifecycle.at(-2)?.status === "partial"
      ? "partial"
      : request.status === "retry-exhausted" &&
          request.lifecycle.at(-2)?.status === "partial"
        ? "partial"
      : request.status;
  if (requestResultStatus !== value.status) {
    fail(`${label} status does not match its assessment request.`);
  }
  const acceptedAcrossJob = [
    ...new Set(
      [...requests.values()]
        .filter(
          (item) =>
            item.jobId === request.jobId && item.attempt <= request.attempt,
        )
        .flatMap((item) => item.acceptedPartIds),
    ),
  ];
  assertStringArray(value.acceptedFields, `${label}.acceptedFields`);
  assertUnique(value.acceptedFields as string[], `${label}.acceptedFields`);
  if (
    !sameStringSet(
      value.acceptedFields as string[],
      acceptedAcrossJob,
    ) ||
    (value.acceptedFields as string[]).some(
      (field) => !screen02FindAssessmentPartIds.includes(field as never),
    )
  ) {
    fail(`${label}.acceptedFields do not match accepted job parts.`);
  }
  const allowedSources = new Set(candidate.sourceIds);
  validateAssessmentComponent(value.studyFit, screen02StudyFitCategories, `${label}.studyFit`, allowedSources);
  validateAssessmentComponent(value.outcomePathway, screen02OutcomePathwayCategories, `${label}.outcomePathway`, allowedSources);
  validateAssessmentComponent(
    value.measurementPotential,
    screen02MeasurementPotentialCategories,
    `${label}.measurementPotential`,
    allowedSources,
  );
  if (value.mainConcern !== null) assertNonEmptyString(value.mainConcern, `${label}.mainConcern`);
  assertStringArray(value.nextChecks, `${label}.nextChecks`);
  assertStringArray(value.evidenceSourceIds, `${label}.evidenceSourceIds`);
  assertUnique(value.evidenceSourceIds as string[], `${label}.evidenceSourceIds`);
  if ((value.evidenceSourceIds as string[]).some((id) => !allowedSources.has(id))) {
    fail(`${label} cites evidence outside the candidate snapshot.`);
  }
  const componentEvidence = [
    value.studyFit,
    value.outcomePathway,
    value.measurementPotential,
  ].flatMap((component) =>
    isRecord(component)
      ? (component.evidenceSourceIds as string[])
      : [],
  );
  const evidenceUnion = [...new Set(componentEvidence)];
  if (!sameStringSet(value.evidenceSourceIds as string[], evidenceUnion)) {
    fail(
      `${label}.evidenceSourceIds must equal the component evidence union.`,
    );
  }
  const acceptedFields = new Set(value.acceptedFields as string[]);
  for (const [field, fieldValue] of [
    ["studyFit", value.studyFit],
    ["outcomePathway", value.outcomePathway],
    ["measurementPotential", value.measurementPotential],
  ] as const) {
    if (acceptedFields.has(field) !== (fieldValue !== null)) {
      fail(`${label}.${field} does not match accepted fields.`);
    }
  }
  if (acceptedFields.has("mainConcern") !== (value.mainConcern !== null)) {
    fail(`${label}.mainConcern does not match accepted fields.`);
  }
  if (
    acceptedFields.has("nextChecks") !==
    ((value.nextChecks as string[]).length > 0)
  ) {
    fail(`${label}.nextChecks does not match accepted fields.`);
  }
  assertNullableString(value.overallJudgment, `${label}.overallJudgment`);
  if (value.overallJudgment !== null) {
    assertEnum(value.overallJudgment, screen02PreliminaryJudgments, `${label}.overallJudgment`);
  }
  assertNullableString(value.overallJudgmentMethod, `${label}.overallJudgmentMethod`);
  assertNonEmptyString(value.recordedAt, `${label}.recordedAt`);
  const derived = deriveScreen02PreliminaryJudgment({
    studyFit: isRecord(value.studyFit) ? (value.studyFit.category as string) : null,
    outcomePathway: isRecord(value.outcomePathway)
      ? (value.outcomePathway.category as string)
      : null,
    measurementPotential: isRecord(value.measurementPotential)
      ? (value.measurementPotential.category as string)
      : null,
  });
  if (value.status === "completed") {
    if (
      !sameStringSet(
        value.acceptedFields as string[],
        screen02FindAssessmentPartIds,
      ) ||
      !derived ||
      value.overallJudgment !== derived ||
      value.overallJudgmentMethod !== "fixed-computation"
    ) {
      fail(`${label} completed judgment was not derived by fixed computation.`);
    }
    if (value.mainConcern === null || (value.nextChecks as string[]).length === 0) {
      fail(`${label} completed assessment lacks concern or next check.`);
    }
  } else if (value.overallJudgment !== null || value.overallJudgmentMethod !== null) {
    fail(`${label} incomplete assessment cannot carry an overall judgment.`);
  }
}

function validateCriterionFinding(
  value: unknown,
  label: string,
  candidate: Screen02FindCandidateSnapshot,
  criteria: ReadonlyMap<string, Screen02Criterion>,
  requests: ReadonlyMap<string, Screen02AssessmentRequest>,
) {
  assertRecord(value, label);
  assertExactKeys(
    value,
    [
      "findingId",
      "candidateSnapshotId",
      "criterionId",
      "criterionVersion",
      "result",
      "reason",
      "evidenceSourceIds",
      "method",
      "requestId",
      "recordedAt",
      "overrides",
    ],
    label,
  );
  assertNonEmptyString(value.findingId, `${label}.findingId`);
  if (value.candidateSnapshotId !== candidate.candidateSnapshotId) {
    fail(`${label} targets the wrong candidate snapshot.`);
  }
  assertNonEmptyString(value.criterionId, `${label}.criterionId`);
  if (!Number.isSafeInteger(value.criterionVersion) || (value.criterionVersion as number) < 1) {
    fail(`${label}.criterionVersion is invalid.`);
  }
  const criterion = criteria.get(`${value.criterionId}:${value.criterionVersion}`);
  if (!criterion) fail(`${label} references an unknown criterion version.`);
  assertEnum(value.result, screen02CriterionFindingResults, `${label}.result`);
  if (!findingMatchesCriterionKind(criterion.kind, value.result as Screen02CriterionFindingResult)) {
    fail(`${label}.result is invalid for ${criterion.kind}.`);
  }
  assertNonEmptyString(value.reason, `${label}.reason`);
  assertStringArray(value.evidenceSourceIds, `${label}.evidenceSourceIds`);
  if ((value.evidenceSourceIds as string[]).some((id) => !candidate.sourceIds.includes(id))) {
    fail(`${label} cites evidence outside the candidate snapshot.`);
  }
  assertEnum(
    value.method,
    ["source-backed-ai", "fixed-fallback", "fixed-rule"],
    `${label}.method`,
  );
  assertNullableString(value.requestId, `${label}.requestId`);
  if (
    value.method === "source-backed-ai" ||
    value.method === "fixed-fallback"
  ) {
    if (criterion.evaluator !== "source-backed-ai") {
      fail(`${label} method does not match its criterion evaluator.`);
    }
    const request = requests.get(value.requestId as string);
    const expectedPartId = `${candidate.candidateSnapshotId}:${criterion.criterionId}:${criterion.version}`;
    const technicalFailure = value.result === "technical-failure";
    if (
      !request ||
      request.target.mode !== "find-criterion" ||
      request.target.candidateSnapshotId !== candidate.candidateSnapshotId ||
      request.target.criterionId !== criterion.criterionId ||
      request.target.criterionVersion !== criterion.version ||
      (technicalFailure
        ? request.status !== "retry-exhausted" ||
          request.acceptedPartIds.length !== 0 ||
          !request.failures.some(
            (failure) => failure.partId === expectedPartId,
          ) ||
          (value.evidenceSourceIds as string[]).length !== 0
        : request.status !== "completed" ||
          !request.acceptedPartIds.includes(expectedPartId))
    ) {
      fail(`${label} lacks a matching terminal criterion request.`);
    }
    if (
      ["meets", "does-not-meet", "violates", "does-not-violate"].includes(
        value.result as string,
      ) &&
      (value.evidenceSourceIds as string[]).length === 0
    ) {
      fail(`${label} resolved semantic finding requires evidence.`);
    }
    if (
      value.method === "fixed-fallback" &&
      (value.result !== "unclear" ||
        (value.evidenceSourceIds as string[]).length !== 0)
    ) {
      fail(
        `${label} fixed fallback must remain an evidence-free unclear finding.`,
      );
    }
  } else {
    if (
      value.requestId !== null ||
      criterion.evaluator !== "fixed-candidate-source-presence-v1"
    ) {
      fail(`${label} lacks a trusted fixed evaluator.`);
    }
    const meets =
      candidate.sourceIds.length > 0 &&
      candidate.description.sourceIds.length > 0;
    const expectedResult = meets ? "meets" : "does-not-meet";
    const expectedEvidence = meets
      ? [...candidate.description.sourceIds]
      : [];
    if (
      value.result !== expectedResult ||
      !sameStringSet(
        value.evidenceSourceIds as string[],
        expectedEvidence,
      )
    ) {
      fail(`${label} does not match its trusted fixed evaluator.`);
    }
  }
  assertNonEmptyString(value.recordedAt, `${label}.recordedAt`);
  assertArray(value.overrides, `${label}.overrides`);
  if (
    value.overrides.length > 0 &&
    (criterion.kind === "rank-higher" || value.result !== "unclear")
  ) {
    fail(
      `${label} may override only an unclear strict criterion finding.`,
    );
  }
  const overrideIds: string[] = [];
  for (const [index, override] of value.overrides.entries()) {
    const overrideLabel = `${label}.overrides[${index}]`;
    assertRecord(override, overrideLabel);
    assertExactKeys(
      override,
      ["overrideId", "researcher", "at", "reason", "priorResult", "resultingEligibility"],
      overrideLabel,
    );
    for (const key of ["overrideId", "researcher", "at", "reason"] as const) {
      assertNonEmptyString(override[key], `${overrideLabel}.${key}`);
    }
    overrideIds.push(override.overrideId as string);
    if (override.priorResult !== value.result) {
      fail(`${overrideLabel}.priorResult must preserve the original finding.`);
    }
    assertEnum(override.resultingEligibility, ["eligible", "ineligible"], `${overrideLabel}.resultingEligibility`);
  }
  assertUnique(overrideIds, `${label}.overrides`);
}

function validateFindState(
  value: Record<string, unknown>,
  allowLegacyEmbeddedSchemas = false,
): Screen02FindState {
  assertExactKeysWithOptional(
    value,
    findStateKeys,
    ["shockGlances", "relevanceProfile"],
    "Screen02FindState",
  );
  if (value.stateKind !== SCREEN_02_FIND_STATE_KIND) {
    findFail("state discriminator is invalid.");
  }
  const { baseline, sourceIds } = validateCommonRoot(value, "find");
  const sourceById = new Map(
    (value.sources as unknown as Screen02WorkflowSource[]).map((source) =>
      [source.id, source] as const
    ),
  );
  if (value.relevanceProfile !== undefined) {
    if (!isScreen02StudyRelevanceProfile(value.relevanceProfile)) {
      findFail("relevance profile is invalid.");
    }
    const profile = value.relevanceProfile;
    const fixedProfile = buildScreen02StudyRelevanceProfile({
      scopeFingerprint: value.screen01Fingerprint as string,
      originalIndustryText: baseline.scopeContract.industry,
      sampleGeography: baseline.scopeContract.geography,
      studyPeriod: baseline.scopeContract.studyPeriod,
      eventFamily: baseline.scopeContract.eventFamily,
      at: value.createdAt as string,
    });
    if (
      profile.scopeFingerprint !== value.screen01Fingerprint ||
      profile.originalIndustryText !== fixedProfile.originalIndustryText ||
      profile.sampleGeography !== fixedProfile.sampleGeography ||
      profile.studyStartYear !== fixedProfile.studyStartYear ||
      profile.studyEndYear !== fixedProfile.studyEndYear ||
      profile.createdAt !== value.createdAt ||
      !sameStringSet(profile.eventFamilyTerms, fixedProfile.eventFamilyTerms)
    ) {
      findFail(
        "relevance profile changed a field fixed by the confirmed Screen 1 scope.",
      );
    }
    assertNotBefore(
      value.updatedAt,
      profile.updatedAt,
      "relevanceProfile.updatedAt",
    );
  }
  assertArray(value.criteria, "criteria");
  value.criteria.forEach((criterion, index) => validateCriterion(criterion, `criteria[${index}]`));
  const criteria = value.criteria as unknown as Screen02Criterion[];
  const criterionKeys = criteria.map((criterion) => `${criterion.criterionId}:${criterion.version}`);
  assertUnique(criterionKeys, "criteria versions");
  const criteriaByKey = new Map(criteria.map((criterion) => [`${criterion.criterionId}:${criterion.version}`, criterion]));
  const expectedActiveCriterionKeys = latestCriterionVersions(criteria).map(
    (criterion) => `${criterion.criterionId}:${criterion.version}`,
  );

  assertArray(value.discoveryRequests, "discoveryRequests");
  if (value.discoveryRequests.length > 12) {
    findFail("state exceeds the documented discovery-request limit.");
  }
  const discoveryIds: string[] = [];
  const discoveryRoundIds: string[] = [];
  const discoverySetIds: string[] = [];
  let searchingDiscoveryCount = 0;
  for (const [index, discovery] of value.discoveryRequests.entries()) {
    const label = `discoveryRequests[${index}]`;
    assertRecord(discovery, label);
    assertExactKeys(
      discovery,
      [
        "discoveryRequestId",
        "searchRoundId",
        "candidateSetSnapshotId",
        "exactRequest",
        "status",
        "startedAt",
        "updatedAt",
        "failureCodes",
        "supersededByDiscoveryRequestId",
        "lifecycle",
      ],
      label,
    );
    for (const key of [
      "discoveryRequestId",
      "searchRoundId",
      "candidateSetSnapshotId",
      "exactRequest",
    ] as const) {
      assertNonEmptyString(discovery[key], `${label}.${key}`);
    }
    timestampValue(discovery.startedAt, `${label}.startedAt`);
    timestampValue(discovery.updatedAt, `${label}.updatedAt`);
    assertNotBefore(
      discovery.updatedAt,
      discovery.startedAt,
      `${label}.updatedAt`,
    );
    if (index > 0) {
      const prior = value.discoveryRequests[index - 1] as Record<
        string,
        unknown
      >;
      assertNotBefore(discovery.startedAt, prior.startedAt, `${label}.startedAt`);
    }
    assertEnum(discovery.status, screen02FindDiscoveryStatuses, `${label}.status`);
    assertStringArray(discovery.failureCodes, `${label}.failureCodes`);
    assertNullableString(
      discovery.supersededByDiscoveryRequestId,
      `${label}.supersededByDiscoveryRequestId`,
    );
    assertArray(discovery.lifecycle, `${label}.lifecycle`);
    if (discovery.lifecycle.length < 1 || discovery.lifecycle.length > 2) {
      fail(`${label}.lifecycle must contain its start and at most one terminal event.`);
    }
    for (const [eventIndex, event] of discovery.lifecycle.entries()) {
      const eventLabel = `${label}.lifecycle[${eventIndex}]`;
      assertRecord(event, eventLabel);
      assertExactKeys(event, ["status", "at", "note"], eventLabel);
      assertEnum(event.status, screen02FindDiscoveryStatuses, `${eventLabel}.status`);
      timestampValue(event.at, `${eventLabel}.at`);
      if (eventIndex > 0) {
        const priorEvent = discovery.lifecycle[eventIndex - 1] as Record<
          string,
          unknown
        >;
        assertNotBefore(event.at, priorEvent.at, `${eventLabel}.at`);
      }
      assertNullableString(event.note, `${eventLabel}.note`);
      if (eventIndex === 0 && event.status !== "searching") {
        fail(`${label}.lifecycle must begin with searching.`);
      }
      if (eventIndex > 0 && event.status === "searching") {
        fail(`${label}.lifecycle cannot return to searching.`);
      }
    }
    const finalEvent = discovery.lifecycle.at(-1) as Record<string, unknown>;
    if (
      finalEvent.status !== discovery.status ||
      (discovery.lifecycle[0] as Record<string, unknown>).at !==
        discovery.startedAt ||
      finalEvent.at !== discovery.updatedAt
    ) {
      fail(`${label} status and timestamps must match its lifecycle.`);
    }
    if (discovery.status === "searching") {
      searchingDiscoveryCount += 1;
    }
    const failureCodes = discovery.failureCodes as string[];
    if (
      discovery.status === "failed" ?
        failureCodes.length === 0 :
        failureCodes.length !== 0
    ) {
      fail(`${label}.failureCodes do not match its terminal status.`);
    }
    if (
      (discovery.status === "superseded") !==
      (discovery.supersededByDiscoveryRequestId !== null)
    ) {
      fail(`${label} supersession pointer is inconsistent.`);
    }
    discoveryIds.push(discovery.discoveryRequestId as string);
    discoveryRoundIds.push(discovery.searchRoundId as string);
    discoverySetIds.push(discovery.candidateSetSnapshotId as string);
  }
  assertUnique(discoveryIds, "discoveryRequests.discoveryRequestId");
  assertUnique(discoveryRoundIds, "discoveryRequests.searchRoundId");
  assertUnique(discoverySetIds, "discoveryRequests.candidateSetSnapshotId");
  if (searchingDiscoveryCount > 1) {
    findFail("state cannot contain multiple active discovery requests.");
  }
  const discoveryRequests =
    value.discoveryRequests as unknown as Screen02FindDiscoveryRequest[];
  const discoveryMap = new Map(
    discoveryRequests.map((request) => [
      request.discoveryRequestId,
      request,
    ]),
  );

  assertArray(value.assessmentRequests, "assessmentRequests");
  value.assessmentRequests.forEach((request, index) =>
    validateAssessmentRequest(request, `assessmentRequests[${index}]`),
  );
  const requests = value.assessmentRequests as unknown as Screen02AssessmentRequest[];
  assertUnique(requests.map((request) => request.requestId), "assessmentRequests.requestId");
  validateAssessmentRequestLineage(requests);
  if (
    requests.some(
      (request) =>
        !["find-discovery-plan", "find-candidate", "find-criterion"].includes(
          request.target.mode,
        ),
    )
  ) {
    findFail("state contains an Audit assessment request.");
  }
  const planningOrdinals = requests
    .filter((request) => request.target.mode === "find-discovery-plan")
    .map(
      (request) =>
        (request.target as Extract<
          Screen02AssessmentTarget,
          { mode: "find-discovery-plan" }
        >).searchOrdinal.toString(),
    );
  assertUnique(planningOrdinals, "assessmentRequests planning searchOrdinal");
  const requestMap = new Map(requests.map((request) => [request.requestId, request]));

  assertArray(value.candidates, "candidates");
  const candidateSnapshotIds: string[] = [];
  const candidateFingerprints: string[] = [];
  const candidateFactualRecordIds: string[] = [];
  for (const [index, candidate] of value.candidates.entries()) {
    const label = `candidates[${index}]`;
    assertRecord(candidate, label);
    assertExactKeysWithOptional(
      candidate,
      [
        "candidateId",
        "candidateSnapshotId",
        "candidateFingerprint",
        "searchRoundId",
        "origin",
        "identity",
        "description",
        "dateLeads",
        "broadCoverage",
        "apparentExposureVariables",
        "sourceIds",
        "limitations",
        "recordedAt",
      ],
      ["qualification"],
      label,
    );
    for (const key of ["candidateId", "candidateSnapshotId", "searchRoundId", "recordedAt"] as const) {
      assertNonEmptyString(candidate[key], `${label}.${key}`);
    }
    assertNonEmptyString(candidate.candidateFingerprint, `${label}.candidateFingerprint`);
    if (!fingerprintPattern.test(candidate.candidateFingerprint as string)) {
      fail(`${label}.candidateFingerprint is malformed.`);
    }
    assertEnum(
      candidate.origin,
      ["registry-reviewed", "newly-discovered", "user-provided", "unsupported-lead"],
      `${label}.origin`,
    );
    validateIdentity(candidate.identity, `${label}.identity`);
    assertStringArray(candidate.sourceIds, `${label}.sourceIds`);
    assertUnique(candidate.sourceIds as string[], `${label}.sourceIds`);
    if ((candidate.sourceIds as string[]).some((id) => !sourceIds.has(id))) {
      fail(`${label} references a source outside the state.`);
    }
    if (Object.prototype.hasOwnProperty.call(candidate, "qualification")) {
      const qualification = candidate.qualification;
      if (!(allowLegacyEmbeddedSchemas
        ? isCompatibleScreen02CandidateQualification(qualification)
        : isScreen02CandidateQualification(qualification))) {
        fail(`${label}.qualification is invalid for this candidate snapshot.`);
      }
      const compatibleQualification = qualification as {
        candidateId: string;
        eligible: boolean;
        evidenceSourceIds: string[];
      };
      if (
        compatibleQualification.candidateId !== candidate.candidateId ||
        !compatibleQualification.eligible ||
        compatibleQualification.evidenceSourceIds.some(
          (id) => !(candidate.sourceIds as string[]).includes(id),
        )
      ) fail(`${label}.qualification is invalid for this candidate snapshot.`);
    }
    const candidateSourceIds = new Set(candidate.sourceIds as string[]);
    validateClaim(
      candidate.description,
      `${label}.description`,
      candidateSourceIds,
    );
    assertArray(candidate.dateLeads, `${label}.dateLeads`);
    candidate.dateLeads.forEach((lead, leadIndex) =>
      validateDateLead(
        lead,
        `${label}.dateLeads[${leadIndex}]`,
        candidateSourceIds,
      ),
    );
    assertArray(candidate.broadCoverage, `${label}.broadCoverage`);
    candidate.broadCoverage.forEach((claim, claimIndex) =>
      validateClaim(
        claim,
        `${label}.broadCoverage[${claimIndex}]`,
        candidateSourceIds,
      ),
    );
    assertStringArray(candidate.apparentExposureVariables, `${label}.apparentExposureVariables`);
    assertStringArray(candidate.limitations, `${label}.limitations`);
    candidateFactualRecordIds.push(
      (candidate.description as Record<string, unknown>).id as string,
      ...(candidate.dateLeads as Array<Record<string, unknown>>).map(
        (lead) => lead.id as string,
      ),
      ...(candidate.broadCoverage as Array<Record<string, unknown>>).map(
        (claim) => claim.id as string,
      ),
    );
    const { candidateFingerprint, ...fingerprintInput } = candidate;
    if (candidateFingerprint !== fingerprintScreen02WorkflowValue(fingerprintInput)) {
      fail(`${label}.candidateFingerprint does not match its factual snapshot.`);
    }
    candidateSnapshotIds.push(candidate.candidateSnapshotId as string);
    candidateFingerprints.push(candidate.candidateFingerprint as string);
  }
  assertUnique(candidateSnapshotIds, "candidates.candidateSnapshotId");
  assertUnique(candidateFingerprints, "candidates.candidateFingerprint");
  assertUnique(candidateFactualRecordIds, "candidates factual record IDs");
  const candidates = value.candidates as unknown as Screen02FindCandidateSnapshot[];
  const candidateMap = new Map(candidates.map((candidate) => [candidate.candidateSnapshotId, candidate]));

  assertArray(value.candidateSets, "candidateSets");
  const setIds: string[] = [];
  let activeSetCount = 0;
  for (const [index, set] of value.candidateSets.entries()) {
    const label = `candidateSets[${index}]`;
    assertRecord(set, label);
    assertExactKeys(
      set,
      [
        "candidateSetSnapshotId",
        "candidateSetFingerprint",
        "searchRoundId",
        "candidateSnapshotIds",
        "criterionVersionRefs",
        "ordering",
        "manifest",
        "status",
        "supersededBySnapshotId",
      ],
      label,
    );
    assertNonEmptyString(set.candidateSetSnapshotId, `${label}.candidateSetSnapshotId`);
    assertNonEmptyString(set.candidateSetFingerprint, `${label}.candidateSetFingerprint`);
    if (!fingerprintPattern.test(set.candidateSetFingerprint as string)) {
      fail(`${label}.candidateSetFingerprint is malformed.`);
    }
    assertNonEmptyString(set.searchRoundId, `${label}.searchRoundId`);
    assertStringArray(set.candidateSnapshotIds, `${label}.candidateSnapshotIds`);
    assertUnique(set.candidateSnapshotIds as string[], `${label}.candidateSnapshotIds`);
    if ((set.candidateSnapshotIds as string[]).some((id) => !candidateMap.has(id))) {
      fail(`${label} references an unknown candidate snapshot.`);
    }
    for (const id of set.candidateSnapshotIds as string[]) {
      if (candidateMap.get(id)?.searchRoundId !== set.searchRoundId) {
        fail(`${label} mixes candidates from another search round.`);
      }
    }
    assertArray(set.criterionVersionRefs, `${label}.criterionVersionRefs`);
    const criterionRefKeys: string[] = [];
    const criterionRefIds: string[] = [];
    for (const [refIndex, ref] of set.criterionVersionRefs.entries()) {
      const refLabel = `${label}.criterionVersionRefs[${refIndex}]`;
      assertRecord(ref, refLabel);
      assertExactKeys(ref, ["criterionId", "version"], refLabel);
      assertNonEmptyString(ref.criterionId, `${refLabel}.criterionId`);
      if (!Number.isSafeInteger(ref.version) || (ref.version as number) < 1) {
        fail(`${refLabel}.version is invalid.`);
      }
      const key = `${String(ref.criterionId)}:${String(ref.version)}`;
      const criterion = criteriaByKey.get(key);
      if (!criterion || criterion.status !== "active") {
        fail(`${refLabel} does not resolve to an active criterion version.`);
      }
      criterionRefKeys.push(key);
      criterionRefIds.push(ref.criterionId as string);
    }
    assertUnique(criterionRefKeys, `${label}.criterionVersionRefs`);
    assertUnique(criterionRefIds, `${label}.criterionVersionRefs criterion IDs`);
    assertArray(set.ordering, `${label}.ordering`);
    const orderedIds: string[] = [];
    const ranks: number[] = [];
    for (const [orderIndex, order] of set.ordering.entries()) {
      const orderLabel = `${label}.ordering[${orderIndex}]`;
      assertRecord(order, orderLabel);
      assertExactKeys(order, ["candidateSnapshotId", "rank", "reason"], orderLabel);
      assertNonEmptyString(order.candidateSnapshotId, `${orderLabel}.candidateSnapshotId`);
      if (!(set.candidateSnapshotIds as string[]).includes(order.candidateSnapshotId as string)) {
        fail(`${orderLabel} references a candidate outside the set.`);
      }
      if (!Number.isSafeInteger(order.rank) || (order.rank as number) < 1) {
        fail(`${orderLabel}.rank is invalid.`);
      }
      assertNonEmptyString(order.reason, `${orderLabel}.reason`);
      orderedIds.push(order.candidateSnapshotId as string);
      ranks.push(order.rank as number);
    }
    if (orderedIds.length !== (set.candidateSnapshotIds as string[]).length) {
      fail(`${label}.ordering must account for every candidate.`);
    }
    assertUnique(orderedIds, `${label}.ordering`);
    assertUnique(ranks.map(String), `${label}.ordering ranks`);
    if (
      [...ranks].sort((left, right) => left - right).some(
        (rank, rankIndex) => rank !== rankIndex + 1,
      )
    ) {
      fail(`${label}.ordering ranks must be contiguous from 1.`);
    }
    validateSearchManifest(
      set.manifest,
      `${label}.manifest`,
      allowLegacyEmbeddedSchemas,
    );
    const manifest = set.manifest as unknown as Screen02WorkflowSearchManifest;
    const immutableSearchRoundCandidates = candidates.filter(
      (candidate) => candidate.searchRoundId === set.searchRoundId,
    );
    const resultBinding = manifest.retainedResultBinding;
    const boundResultBySnapshotId = new Map(
      resultBinding?.results.map((result) => [result.snapshotId, result]) ?? [],
    );
    if (
      manifest.protocolVersion ===
        SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_VERSION &&
      (
        !resultBinding ||
        resultBinding.mode !== "find" ||
        manifest.funnel.displayedCandidates !==
          immutableSearchRoundCandidates.length ||
        resultBinding.results.length !==
          immutableSearchRoundCandidates.length ||
        immutableSearchRoundCandidates.some((candidate) => {
          const bound = boundResultBySnapshotId.get(
            candidate.candidateSnapshotId,
          );
          return !bound || bound.recordId !== candidate.candidateId ||
            !sameStringSet(bound.sourceIds, candidate.sourceIds) ||
            bound.qualificationLane !==
              (candidate.qualification?.lane ?? null) ||
            !sameStringSet(
              retainedResultOriginSourceUnion(bound),
              candidate.sourceIds,
            ) ||
            !bound.origins.some((origin) =>
              origin.evidenceRole === "identity"
            );
        })
      )
    ) {
      fail(
        `${label}.manifest is not bound to its immutable Find search round.`,
      );
    }
    if (
      manifest.protocolVersion ===
        SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_VERSION &&
      resultBinding
    ) {
      const candidateSets =
        value.candidateSets as unknown as Screen02FindState["candidateSets"];
      for (const candidate of immutableSearchRoundCandidates) {
        const bound = boundResultBySnapshotId.get(
          candidate.candidateSnapshotId,
        )!;
        for (const origin of bound.origins) {
          if (origin.kind === "prior-result") {
            const application = manifest.hostReviewApplication;
            const original = application
              ? candidateSets.find(
                  (candidateSet) =>
                    candidateSet.candidateSetSnapshotId ===
                      application.originalCandidatePoolId,
                )
              : undefined;
            const priorCandidate = candidateMap.get(
              origin.priorCandidateSnapshotId,
            );
            if (
              !application ||
              origin.priorCandidateSetSnapshotId !==
                application.originalCandidatePoolId ||
              !original ||
              original.candidateSetFingerprint !==
                application.originalCandidatePoolFingerprint ||
              !original.candidateSnapshotIds.includes(
                origin.priorCandidateSnapshotId,
              ) ||
              !priorCandidate ||
              priorCandidate.candidateId !== origin.producerRecordId ||
              bound.recordId !== priorCandidate.candidateId ||
              !sameStringSet(origin.sourceIds, priorCandidate.sourceIds)
            ) {
              fail(
                `${label}.manifest carry-forward origin is not bound to its immutable host-review predecessor.`,
              );
            }
            continue;
          }
          if (origin.retrievalLane === "reviewed-catalog") {
            fail(
              `${label}.manifest cannot use the Audit reviewed-catalog lane for a Find result.`,
            );
          }
          if (
            origin.retrievalLane === "reviewed-registry" &&
            bound.qualificationLane !== "reviewed-registry"
          ) {
            fail(
              `${label}.manifest reviewed-registry origin conflicts with candidate qualification.`,
            );
          }
          if (
            researcherRetainedResultLanes.has(origin.retrievalLane) &&
            !retainedResultOriginSourcesAreResearcherProvided(
              origin,
              sourceById,
            )
          ) {
            fail(
              `${label}.manifest researcher origin is not bound to researcher-provided sources.`,
            );
          }
          if (
            reviewedRetainedResultLanes.has(origin.retrievalLane) &&
            !retainedResultOriginSourcesAreTrustedNonResearcher(
              origin,
              sourceById,
              2,
            )
          ) {
            fail(
              `${label}.manifest reviewed origin is not bound to reviewed official evidence.`,
            );
          }
          if (
            officialRetainedResultLanes.has(origin.retrievalLane) &&
            !retainedResultOriginSourcesAreTrustedNonResearcher(
              origin,
              sourceById,
              3,
            )
          ) {
            fail(
              `${label}.manifest official origin is not bound to non-researcher authoritative evidence.`,
            );
          }
        }
      }
    }
    if (manifest.retrievalExecution) {
      const retainedByCandidateId = new Map(
        (set.candidateSnapshotIds as string[]).map((snapshotId) => {
          const candidate = candidateMap.get(snapshotId)!;
          return [candidate.candidateId, candidate] as const;
        }),
      );
      const allowedCandidateIds = new Set([
        ...retainedByCandidateId.keys(),
        ...manifest.exclusions.map((exclusion) => exclusion.recordId),
        ...manifest.exclusions.map((exclusion) =>
          `host-lead-${exclusion.recordId}`.slice(0, 200)
        ),
        ...manifest.queryMatrix.flatMap((query) => query.returnedRecordIds),
      ]);
      for (const [acquisitionIndex, acquisition] of
        manifest.retrievalExecution.documentAcquisitions.entries()) {
        const acquisitionLabel =
          `${label}.manifest.retrievalExecution.documentAcquisitions[${acquisitionIndex}]`;
        if (!allowedCandidateIds.has(acquisition.candidateId)) {
          fail(`${acquisitionLabel} cites a candidate outside its search result.`);
        }
        if (acquisition.sourceId !== null) {
          const retained = retainedByCandidateId.get(acquisition.candidateId);
          const source = sourceById.get(acquisition.sourceId);
          if (
            !retained || !sourceIds.has(acquisition.sourceId) || !source ||
            !retained.sourceIds.includes(acquisition.sourceId) ||
            !screen02DocumentAcquisitionMatchesSource(acquisition, source)
          ) {
            fail(`${acquisitionLabel} is not bound to its retained candidate and source locator.`);
          }
        }
      }
    }
    if (manifest.hostReviewApplication) {
      const application = manifest.hostReviewApplication;
      const original = (value.candidateSets as unknown as Screen02FindState["candidateSets"])
        .find((candidateSet) =>
          candidateSet.candidateSetSnapshotId ===
            application.originalCandidatePoolId
        );
      const applicationRootCandidateSetSnapshotId =
        manifest.protocolVersion ===
            SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_VERSION
          ? discoveryRequests.find(
              (request) =>
                request.searchRoundId === set.searchRoundId &&
                (request.status === "completed" ||
                  request.status === "completed-empty"),
            )?.candidateSetSnapshotId
          : set.candidateSetSnapshotId;
      if (
        application.successorCandidatePoolId !==
          applicationRootCandidateSetSnapshotId ||
        application.appliedAt !== manifest.retrievedAt ||
        application.originalCandidatePoolId ===
          application.successorCandidatePoolId ||
        !original ||
        original.candidateSetFingerprint !==
          application.originalCandidatePoolFingerprint ||
        !manifest.funnel ||
        manifest.funnel.hostContribution !==
          application.validatedRetrievalContributionCount ||
        (set.status === "active" &&
          application.appliedProfileFingerprint !==
            fingerprintScreen02WorkflowValue(value.relevanceProfile))
      ) {
        fail(`${label}.manifest.hostReviewApplication is not bound to its exact predecessor, successor, relevance profile, and retrieval contribution.`);
      }
    }
    assertEnum(
      set.status,
      ["active", "superseded", "stale-profile"],
      `${label}.status`,
    );
    assertNullableString(set.supersededBySnapshotId, `${label}.supersededBySnapshotId`);
    if (set.status === "active") {
      activeSetCount += 1;
      if (set.supersededBySnapshotId !== null) {
        fail(`${label} active set cannot have a successor.`);
      }
      if (!sameStringSet(criterionRefKeys, expectedActiveCriterionKeys)) {
        fail(
          `${label} does not snapshot the exact active criterion versions.`,
        );
      }
    } else if (
      set.status === "superseded" &&
      set.supersededBySnapshotId === null
    ) {
      fail(`${label} superseded set must name its successor.`);
    } else if (
      set.status === "stale-profile" &&
      set.supersededBySnapshotId !== null
    ) {
      fail(`${label} profile-stale set cannot name a fabricated successor.`);
    } else if (set.status === "stale-profile") {
      const profile = value.relevanceProfile;
      if (!isScreen02StudyRelevanceProfile(profile)) {
        fail(`${label} profile-stale set requires a persisted relevance profile.`);
      }
      assertNotBefore(
        profile.updatedAt,
        (set.manifest as Record<string, unknown>).retrievedAt,
        `${label}.profileStaleAt`,
      );
    }
    if (
      set.candidateSetFingerprint !==
      fingerprintScreen02FindCandidateSet(
        set as unknown as Screen02FindState["candidateSets"][number],
      )
    ) {
      fail(`${label}.candidateSetFingerprint does not match.`);
    }
    setIds.push(set.candidateSetSnapshotId as string);
  }
  assertUnique(setIds, "candidateSets.candidateSetSnapshotId");
  if (value.activeCandidateSetSnapshotId === null) {
    if (activeSetCount !== 0) findFail("state has an active set without an active ID.");
  } else {
    assertNonEmptyString(value.activeCandidateSetSnapshotId, "activeCandidateSetSnapshotId");
    const active = (value.candidateSets as unknown as Array<Record<string, unknown>>).find(
      (set) => set.candidateSetSnapshotId === value.activeCandidateSetSnapshotId,
    );
    if (!active || active.status !== "active" || activeSetCount !== 1) {
      findFail("state active candidate set is inconsistent.");
    }
  }

  const candidateSetMap = new Map(
    (value.candidateSets as unknown as Array<Record<string, unknown>>).map(
      (set) => [set.candidateSetSnapshotId as string, set],
    ),
  );
  for (const set of candidateSetMap.values()) {
    if (
      set.status === "superseded" &&
      (!candidateSetMap.has(set.supersededBySnapshotId as string) ||
        set.supersededBySnapshotId === set.candidateSetSnapshotId)
    ) {
      findFail("superseded candidate set has an invalid successor.");
    }
  }
  for (const start of candidateSetMap.values()) {
    const visited = new Set<string>();
    let current: Record<string, unknown> | undefined = start;
    while (current?.status === "superseded") {
      const currentId = current.candidateSetSnapshotId as string;
      if (visited.has(currentId)) {
        findFail("candidate-set supersession contains a cycle.");
      }
      visited.add(currentId);
      current = candidateSetMap.get(current.supersededBySnapshotId as string);
    }
  }
  for (const discovery of discoveryRequests) {
    const set = candidateSetMap.get(discovery.candidateSetSnapshotId);
    if (
      discovery.status === "completed" ||
      discovery.status === "completed-empty"
    ) {
      if (
        !set ||
        set.searchRoundId !== discovery.searchRoundId ||
        (discovery.status === "completed") !==
          ((set.candidateSnapshotIds as string[]).length > 0)
      ) {
        fail(
          "Completed Find discovery does not resolve to its planned result snapshot.",
        );
      }
    } else if (set) {
      fail(
        "Non-completed Find discovery cannot own a candidate-set result.",
      );
    }
    if (discovery.supersededByDiscoveryRequestId !== null) {
      const replacement = discoveryMap.get(
        discovery.supersededByDiscoveryRequestId,
      );
      if (!replacement || replacement === discovery) {
        findFail("discovery supersession pointer is invalid.");
      }
      assertNotBefore(
        replacement.startedAt,
        discovery.updatedAt,
        "Find discovery replacement time",
      );
    }
  }
  const validatedCandidateSets =
    value.candidateSets as unknown as Screen02FindState["candidateSets"];
  const validatedCandidateSetById = new Map(
    validatedCandidateSets.map((set) => [set.candidateSetSnapshotId, set]),
  );
  if (
    candidates.some((candidate) =>
      !validatedCandidateSets.some((set) =>
        set.candidateSnapshotIds.includes(candidate.candidateSnapshotId)
      )
    )
  ) {
    findFail("candidate snapshot is not attached to a candidate-set result.");
  }
  const currentSearchRoundIds = new Set(
    validatedCandidateSets
      .filter(
        (set) =>
          set.manifest.protocolVersion ===
            SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_VERSION,
      )
      .map((set) => set.searchRoundId),
  );
  for (const searchRoundId of currentSearchRoundIds) {
    const completedRoots = discoveryRequests.filter(
      (request) =>
        request.searchRoundId === searchRoundId &&
        (request.status === "completed" ||
          request.status === "completed-empty"),
    );
    const root = completedRoots.length === 1
      ? validatedCandidateSetById.get(
          completedRoots[0]!.candidateSetSnapshotId,
        )
      : undefined;
    const roundSets = validatedCandidateSets.filter(
      (set) => set.searchRoundId === searchRoundId,
    );
    const roundCandidateSnapshotIds = candidates
      .filter((candidate) => candidate.searchRoundId === searchRoundId)
      .map((candidate) => candidate.candidateSnapshotId);
    if (
      !root ||
      root.searchRoundId !== searchRoundId ||
      root.manifest.protocolVersion !==
        SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_VERSION ||
      !sameStringSet(
        root.candidateSnapshotIds,
        roundCandidateSnapshotIds,
      )
    ) {
      findFail(
        "current search round is not owned by exactly one request-named root candidate set.",
      );
    }
    const visitedRoundSetIds = new Set<string>();
    let current = root;
    while (current.searchRoundId === searchRoundId) {
      if (visitedRoundSetIds.has(current.candidateSetSnapshotId)) {
        findFail("candidate-set supersession contains a cycle.");
      }
      visitedRoundSetIds.add(current.candidateSetSnapshotId);
      if (current.status !== "superseded") break;
      const successor = validatedCandidateSetById.get(
        current.supersededBySnapshotId!,
      );
      if (!successor || successor.searchRoundId !== searchRoundId) break;
      if (
        successor.candidateSnapshotIds.some(
          (candidateSnapshotId) =>
            !current.candidateSnapshotIds.includes(candidateSnapshotId),
        ) ||
        serializeDeterministicJson(successor.manifest) !==
          serializeDeterministicJson(root.manifest)
      ) {
        findFail(
          "same-round candidate-set successor created candidates or changed the root search manifest.",
        );
      }
      current = successor;
    }
    if (
      roundSets.some(
        (set) => !visitedRoundSetIds.has(set.candidateSetSnapshotId),
      )
    ) {
      findFail(
        "current search round contains a candidate set outside its root supersession lineage.",
      );
    }
  }
  for (const start of discoveryRequests) {
    const visited = new Set<string>();
    let current: Screen02FindDiscoveryRequest | undefined = start;
    while (current && current.supersededByDiscoveryRequestId !== null) {
      if (visited.has(current.discoveryRequestId)) {
        findFail("discovery supersession contains a cycle.");
      }
      visited.add(current.discoveryRequestId);
      current = discoveryMap.get(current.supersededByDiscoveryRequestId);
    }
  }
  const candidateSets =
    value.candidateSets as unknown as Screen02FindState["candidateSets"];
  for (const request of requests) {
    const target = request.target;
    if (
      target.mode !== "find-discovery-plan" &&
      target.mode !== "find-candidate" &&
      target.mode !== "find-criterion"
    ) {
      findFail("state contains an Audit assessment target.");
    }
    if (target.mode === "find-discovery-plan") {
      const expectedPacketFingerprint = fingerprintScreen02WorkflowValue({
        mode: target.mode,
        screen01Fingerprint: value.screen01Fingerprint,
        searchOrdinal: target.searchOrdinal,
        criteriaFingerprint: target.criteriaFingerprint,
      });
      if (target.packetFingerprint !== expectedPacketFingerprint) {
        findFail("discovery-plan target packet fingerprint does not match.");
      }
      continue;
    }
    const candidate = candidateMap.get(target.candidateSnapshotId);
    const containingSets = candidateSets.filter((set) =>
      set.candidateSnapshotIds.includes(target.candidateSnapshotId),
    );
    if (
      !candidate ||
      containingSets.length === 0 ||
      target.candidateFingerprint !== candidate.candidateFingerprint
    ) {
      findFail("assessment target does not resolve to its immutable snapshots.");
    }
    let packetInput: Record<string, unknown> = {
      mode: target.mode,
      screen01Fingerprint: value.screen01Fingerprint,
      candidate,
      sources: (value.sources as unknown as Screen02FindState["sources"]).filter(
        (source) => candidate.sourceIds.includes(source.id),
      ),
    };
    if (target.mode === "find-criterion") {
      const criterion = criteriaByKey.get(
        `${target.criterionId}:${target.criterionVersion}`,
      );
      const criterionApplied = containingSets.some((set) =>
        set.criterionVersionRefs.some(
          (ref) =>
            ref.criterionId === target.criterionId &&
            ref.version === target.criterionVersion,
        ),
      );
      if (!criterion || !criterionApplied) {
        findFail("criterion target references a version outside its applied set.",
        );
      }
      packetInput = { ...packetInput, criterion };
    }
    if (
      target.packetFingerprint !==
      fingerprintScreen02WorkflowValue(packetInput)
    ) {
      findFail("assessment target packet fingerprint does not match.");
    }
    if (
      request.supersededBySnapshotId !== null &&
      !containingSets.some(
        (set) =>
          set.supersededBySnapshotId === request.supersededBySnapshotId,
      )
    ) {
      findFail("request does not name its target set's direct successor snapshot.",
      );
    }
    if (request.supersededByRequestId !== null) {
      const replacement = requestMap.get(request.supersededByRequestId)!;
      const replacementTarget = replacement.target;
      if (
        (replacementTarget.mode !== "find-candidate" &&
          replacementTarget.mode !== "find-criterion") ||
        replacementTarget.mode !== target.mode
      ) {
        findFail("request points to an unrelated replacement mode.");
      }
      const replacementCandidate = candidateMap.get(
        replacementTarget.candidateSnapshotId,
      );
      const replacementSets = candidateSets.filter((set) =>
        set.candidateSnapshotIds.includes(
          replacementTarget.candidateSnapshotId,
        ),
      );
      const snapshotIsRelated =
        replacementTarget.candidateSnapshotId === target.candidateSnapshotId ||
        containingSets.some((set) =>
          replacementSets.some(
            (replacementSet) =>
              set.supersededBySnapshotId ===
              replacementSet.candidateSetSnapshotId,
          ),
        );
      const criterionIsRelated =
        target.mode !== "find-criterion" ||
        (replacementTarget.mode === "find-criterion" &&
          replacementTarget.criterionId === target.criterionId);
      if (
        !replacementCandidate ||
        replacementCandidate.candidateId !== candidate.candidateId ||
        replacementSets.length === 0 ||
        !snapshotIsRelated ||
        !criterionIsRelated
      ) {
        findFail("request points to an unrelated replacement target.");
      }
    }
  }

  assertArray(value.assessments, "assessments");
  const assessmentIds: string[] = [];
  for (const [index, assessment] of value.assessments.entries()) {
    assertRecord(assessment, `assessments[${index}]`);
    const candidate = candidateMap.get(assessment.candidateSnapshotId as string);
    if (!candidate) fail(`assessments[${index}] references an unknown candidate.`);
    validateFindAssessment(assessment, `assessments[${index}]`, candidate, requestMap);
    assessmentIds.push(assessment.assessmentId as string);
  }
  assertUnique(assessmentIds, "assessments.assessmentId");
  assertUnique(
    (value.assessments as unknown as Screen02FindCandidateAssessment[]).map(
      (assessment) => assessment.requestId,
    ),
    "assessments.requestId",
  );
  assertUnique(
    (value.assessments as unknown as Screen02FindCandidateAssessment[])
      .filter((assessment) => assessment.status === "completed")
      .map((assessment) => {
        const request = requestMap.get(assessment.requestId)!;
        return request.target.mode === "find-candidate"
          ? request.target.candidateSnapshotId
          : assessment.assessmentId;
      }),
    "completed Find assessments per immutable candidate snapshot",
  );
  validateAcceptedAssessmentFieldHistory(
    value.assessments as unknown as Screen02FindCandidateAssessment[],
    requestMap,
    "Find assessment",
  );

  assertArray(value.criterionFindings, "criterionFindings");
  const findingIds: string[] = [];
  const findingTargets: string[] = [];
  for (const [index, finding] of value.criterionFindings.entries()) {
    assertRecord(finding, `criterionFindings[${index}]`);
    const candidate = candidateMap.get(finding.candidateSnapshotId as string);
    if (!candidate) fail(`criterionFindings[${index}] references an unknown candidate.`);
    validateCriterionFinding(
      finding,
      `criterionFindings[${index}]`,
      candidate,
      criteriaByKey,
      requestMap,
    );
    findingIds.push(finding.findingId as string);
    findingTargets.push(
      `${finding.candidateSnapshotId}:${finding.criterionId}:${finding.criterionVersion}`,
    );
  }
  assertUnique(findingIds, "criterionFindings.findingId");
  assertUnique(findingTargets, "criterionFindings target");
  const assessmentsByRequest = new Map(
    (value.assessments as unknown as Screen02FindCandidateAssessment[]).map(
      (assessment) => [assessment.requestId, assessment],
    ),
  );
  const requestBoundFindings = (
    value.criterionFindings as unknown as Screen02CriterionFinding[]
  ).filter((finding) => finding.requestId !== null);
  assertUnique(
    requestBoundFindings.map((finding) => finding.requestId as string),
    "criterionFindings.requestId",
  );
  const findingsByRequest = new Map(
    requestBoundFindings.map((finding) => [
      finding.requestId as string,
      finding,
    ]),
  );
  for (const request of requests) {
    if (request.target.mode === "find-candidate") {
      const preservesSupersededPartial =
        request.status === "superseded" &&
        request.lifecycle.at(-2)?.status === "partial";
      const requiresAssessment =
        request.acceptedPartIds.length > 0 &&
        (["partial", "completed", "retry-exhausted"].includes(
          request.status,
        ) ||
          preservesSupersededPartial);
      if (requiresAssessment !== assessmentsByRequest.has(request.requestId)) {
        findFail("candidate request result status and assessment record are not atomic.",
        );
      }
    } else if (request.target.mode === "find-criterion") {
      const requiresFinding =
        request.status === "completed" ||
        request.status === "retry-exhausted";
      if (requiresFinding !== findingsByRequest.has(request.requestId)) {
        findFail("criterion request completion and finding record are not atomic.",
        );
      }
    }
  }

  assertRecord(value.decision, "decision");
  assertExactKeys(
    value.decision,
    [
      "openedCandidateSnapshotId",
      "tentativeSelectionSnapshotId",
      "continuedRevision",
      "history",
    ],
    "decision",
  );
  if (
    value.decision.continuedRevision !== null &&
    (!Number.isSafeInteger(value.decision.continuedRevision) ||
      (value.decision.continuedRevision as number) < 0)
  ) {
    fail("decision.continuedRevision is invalid.");
  }
  for (const key of ["openedCandidateSnapshotId", "tentativeSelectionSnapshotId"] as const) {
    assertNullableString(value.decision[key], `decision.${key}`);
    if (value.decision[key] !== null && !candidateMap.has(value.decision[key] as string)) {
      fail(`decision.${key} references an unknown candidate.`);
    }
  }
  assertArray(value.decision.history, "decision.history");
  const decisionIds: string[] = [];
  let projectedOpen: string | null = null;
  let projectedSelection: string | null = null;
  let activeContinuation: {
    action: "continued" | "continued-without-assessment";
    at: string;
  } | null = null;
  for (const [index, event] of value.decision.history.entries()) {
    const label = `decision.history[${index}]`;
    assertRecord(event, label);
    const unavailableContinuation =
      event.action === "continued-without-assessment";
    assertExactKeys(
      event,
      unavailableContinuation
        ? [
            "decisionId",
            "action",
            "candidateSnapshotId",
            "at",
            "reason",
            "assessmentDisposition",
          ]
        : ["decisionId", "action", "candidateSnapshotId", "at", "reason"],
      label,
    );
    assertNonEmptyString(event.decisionId, `${label}.decisionId`);
    assertEnum(
      event.action,
      [
        "opened",
        "open-cleared",
        "tentatively-selected",
        "selection-cleared",
        "removed",
        "continued",
        "continued-without-assessment",
      ],
      `${label}.action`,
    );
    assertNullableString(event.candidateSnapshotId, `${label}.candidateSnapshotId`);
    if (event.candidateSnapshotId !== null && !candidateMap.has(event.candidateSnapshotId as string)) {
      fail(`${label} references an unknown candidate.`);
    }
    const eventCandidateId = event.candidateSnapshotId as string | null;
    if (activeContinuation && event.action !== "selection-cleared") {
      findFail(
        `${label} mutates a continued Find choice before explicitly clearing that selection.`,
      );
    }
    if (
      [
        "opened",
        "open-cleared",
        "tentatively-selected",
        "removed",
        "continued",
        "continued-without-assessment",
      ].includes(event.action as string) &&
      !eventCandidateId
    ) {
      fail(`${label} action requires a candidate snapshot.`);
    }
    if (event.action === "opened") {
      projectedOpen = eventCandidateId;
    } else if (event.action === "open-cleared") {
      if (eventCandidateId !== projectedOpen) {
        fail(`${label} clears a candidate that is not opened.`);
      }
      projectedOpen = null;
    } else if (event.action === "tentatively-selected") {
      projectedSelection = eventCandidateId;
    } else if (event.action === "selection-cleared") {
      if (
        (activeContinuation && eventCandidateId !== projectedSelection) ||
        (!activeContinuation &&
          eventCandidateId !== null &&
          eventCandidateId !== projectedSelection)
      ) {
        fail(`${label} clears a candidate that is not selected.`);
      }
      projectedSelection = null;
      activeContinuation = null;
    } else if (event.action === "removed") {
      if (projectedOpen === eventCandidateId) projectedOpen = null;
      if (projectedSelection === eventCandidateId) projectedSelection = null;
      const activeSet = (value.candidateSets as unknown as Screen02FindState["candidateSets"]).find(
        (set) => set.candidateSetSnapshotId === value.activeCandidateSetSnapshotId,
      );
      if (activeSet?.candidateSnapshotIds.includes(eventCandidateId!)) {
        fail(`${label} removes a candidate still present in the active set.`);
      }
    } else if (
      ["continued", "continued-without-assessment"].includes(
        event.action as string,
      ) && projectedSelection !== eventCandidateId
    ) {
      fail(`${label} continues a candidate that is not currently selected.`);
    }
    timestampValue(event.at, `${label}.at`);
    if (index > 0) {
      const priorEvent = value.decision.history[index - 1] as Record<
        string,
        unknown
      >;
      assertNotBefore(event.at, priorEvent.at, `${label}.at`);
    }
    if (unavailableContinuation) {
      assertBoundedNonEmptyString(event.reason, `${label}.reason`);
      validateAssessmentUnavailableDisposition(
        event.assessmentDisposition,
        `${label}.assessmentDisposition`,
        requestMap,
      );
      const disposition = event.assessmentDisposition as unknown as Screen02AssessmentUnavailableDisposition;
      if (
        disposition.recordedAt !== event.at ||
        disposition.reason !== event.reason
      ) {
        fail(
          `${label}.assessmentDisposition must be bound to the continuation acknowledgment.`,
        );
      }
    } else {
      assertNonEmptyString(event.reason, `${label}.reason`);
    }
    if (
      ["continued", "continued-without-assessment"].includes(
        event.action as string,
      )
    ) {
      if (activeContinuation) {
        findFail(
          "A continued Find choice must be cleared before another continuation.",
        );
      }
      activeContinuation = {
        action: event.action as
          | "continued"
          | "continued-without-assessment",
        at: event.at as string,
      };
    }
    decisionIds.push(event.decisionId as string);
  }
  assertUnique(decisionIds, "decision.history.decisionId");

  if (
    value.decision.openedCandidateSnapshotId !== projectedOpen ||
    value.decision.tentativeSelectionSnapshotId !== projectedSelection
  ) {
    findFail("decision pointers do not match append-only history.");
  }
  if (activeContinuation && value.updatedAt !== activeContinuation.at) {
    fail("A continued Find run is sealed at its continuation time.");
  }
  if (
    (activeContinuation === null &&
      value.decision.continuedRevision !== null) ||
    (activeContinuation !== null &&
      value.decision.continuedRevision !== value.revision)
  ) {
    findFail("continuation revision seal is inconsistent.");
  }

  if (value.shockGlances !== undefined) {
    assertArray(value.shockGlances, "shockGlances");
    if (value.shockGlances.length > SCREEN_02_SHOCK_GLANCE_MAX_ENTRIES) {
      findFail("state exceeds the retained shock-glance limit.");
    }
    const glanceState = clone(value) as unknown as Screen02FindState;
    const candidateSnapshotIds: string[] = [];
    for (const [index, rawGlance] of value.shockGlances.entries()) {
      const glance = restoreScreen02ShockGlance(rawGlance);
      if (!glance) fail(`shockGlances[${index}] is invalid.`);
      candidateSnapshotIds.push(glance.candidateSnapshotId);
      if (!screen02ShockGlanceMatchesFindState(glance, glanceState)) {
        fail(
          `shockGlances[${index}] is stale or belongs to another Find candidate.`,
        );
      }
    }
    assertUnique(candidateSnapshotIds, "shockGlances.candidateSnapshotId");
  }

  const candidate = clone(value) as unknown as Screen02FindState;
  if (activeContinuation && candidate.decision.tentativeSelectionSnapshotId) {
    const continuedCandidate = candidate.candidates.find((item) =>
      item.candidateSnapshotId ===
        candidate.decision.tentativeSelectionSnapshotId
    );
    const continuedSet = candidate.candidateSets.find((set) =>
      set.candidateSetSnapshotId === candidate.activeCandidateSetSnapshotId
    );
    const retainedHistoricalContinuation = Boolean(
      continuedCandidate?.qualification?.migrationProvenance ||
        continuedSet?.manifest.protocolVersion ===
          SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_LEGACY_VERSION ||
        (allowLegacyEmbeddedSchemas &&
          continuedCandidate?.qualification?.version !==
            SCREEN02_CANDIDATE_QUALIFICATION_VERSION),
    );
    if (activeContinuation.action === "continued") {
      const gate = computeFindCandidateGate(
        candidate,
        candidate.decision.tentativeSelectionSnapshotId,
      );
      if (!gate.eligible && !retainedHistoricalContinuation) {
        fail(
          `Completed Find continuation does not satisfy its gate: ${gate.reasons.join(" ")}`,
        );
      }
    } else {
      const event = candidate.decision.history.at(-1);
      if (
        !event ||
        event.action !== "continued-without-assessment"
      ) {
        findFail("assessment-unavailable continuation is missing.");
      }
      const gate = computeFindAssessmentUnavailableContinuationGate(candidate);
      if (
        (!gate.eligible && !retainedHistoricalContinuation) ||
        !sameStringSet(
          event.assessmentDisposition.affectedRequestIds,
          gate.affectedRequestIds,
        )
      ) {
        findFail("assessment-unavailable continuation is not bound to the current terminal requests.",
        );
      }
    }
  }
  return deepFreeze(candidate);
}

export function deriveScreen02AuditJudgment(input: {
  studyFit: string | null;
  outcomePathway: string | null;
  measurementPotential: string | null;
  coverageRelation: string | null;
}): Screen02PreliminaryJudgment | null {
  if (!input.coverageRelation) return null;
  if (input.coverageRelation === "unclear") return "not-enough-evidence";
  if (input.coverageRelation === "weak") return "low-priority";
  const base = deriveScreen02PreliminaryJudgment(input);
  if (base === null || base === "not-enough-evidence" || base === "low-priority") {
    return base;
  }
  const study = input.studyFit === "strong" ? 2 : 1;
  const pathway = input.outcomePathway === "plausible" ? 2 : 1;
  const measurement = input.measurementPotential === "possible" ? 2 : 1;
  const coverage = input.coverageRelation === "strong" ? 2 : 1;
  const total = study + pathway + measurement + coverage;
  if (total === 8) return "promising-to-verify";
  return total >= 6 ? "worth-exploring" : "low-priority";
}

function validateAuditDossier(
  value: unknown,
  label: string,
  stateSourceIds: ReadonlySet<string>,
  matchesByIdentity: ReadonlyMap<string, Screen02AuditPossibleMatch>,
  requests: ReadonlyMap<string, Screen02AssessmentRequest>,
) {
  assertRecord(value, label);
  assertExactKeys(
    value,
    [
      "dossierSnapshotId",
      "dossierFingerprint",
      "identitySnapshotId",
      "requestId",
      "status",
      "atAGlance",
      "whatHappened",
      "whatChanged",
      "timeline",
      "broadCoverage",
      "keyComponents",
      "relatedVersions",
      "unresolvedFacts",
      "sourceIds",
      "recordedAt",
    ],
    label,
  );
  assertNonEmptyString(value.dossierSnapshotId, `${label}.dossierSnapshotId`);
  assertNonEmptyString(value.dossierFingerprint, `${label}.dossierFingerprint`);
  if (!fingerprintPattern.test(value.dossierFingerprint as string)) {
    fail(`${label}.dossierFingerprint is malformed.`);
  }
  assertNonEmptyString(value.identitySnapshotId, `${label}.identitySnapshotId`);
  const match = matchesByIdentity.get(value.identitySnapshotId as string);
  if (!match) {
    fail(`${label} references an unknown identity snapshot.`);
  }
  assertNonEmptyString(value.requestId, `${label}.requestId`);
  assertEnum(value.status, ["partial", "completed"], `${label}.status`);
  assertStringArray(value.sourceIds, `${label}.sourceIds`);
  assertUnique(value.sourceIds as string[], `${label}.sourceIds`);
  if (
    (value.sourceIds as string[]).some(
      (id) => !stateSourceIds.has(id) || !match.sourceIds.includes(id),
    )
  ) {
    fail(
      `${label} cites a source outside its immutable dossier request packet.`,
    );
  }
  const dossierSourceIds = new Set(match.sourceIds);
  for (const key of ["atAGlance", "whatChanged", "broadCoverage", "keyComponents"] as const) {
    assertArray(value[key], `${label}.${key}`);
    value[key].forEach((claim, index) =>
      validateClaim(claim, `${label}.${key}[${index}]`, dossierSourceIds),
    );
  }
  if (value.whatHappened !== null) {
    validateClaim(value.whatHappened, `${label}.whatHappened`, dossierSourceIds);
  }
  assertArray(value.timeline, `${label}.timeline`);
  value.timeline.forEach((lead, index) =>
    validateDateLead(lead, `${label}.timeline[${index}]`, dossierSourceIds),
  );
  assertArray(value.relatedVersions, `${label}.relatedVersions`);
  for (const [index, related] of value.relatedVersions.entries()) {
    const relatedLabel = `${label}.relatedVersions[${index}]`;
    assertRecord(related, relatedLabel);
    assertExactKeys(related, ["relationship", "identity", "sourceIds", "note"], relatedLabel);
    assertEnum(related.relationship, screen02AuditRelationships, `${relatedLabel}.relationship`);
    validateIdentity(related.identity, `${relatedLabel}.identity`);
    assertStringArray(related.sourceIds, `${relatedLabel}.sourceIds`);
    if ((related.sourceIds as string[]).some((id) => !dossierSourceIds.has(id))) {
      fail(`${relatedLabel} cites a source outside the dossier.`);
    }
    assertNonEmptyString(related.note, `${relatedLabel}.note`);
  }
  assertStringArray(value.unresolvedFacts, `${label}.unresolvedFacts`);
  assertNonEmptyString(value.recordedAt, `${label}.recordedAt`);
  const request = requests.get(value.requestId as string);
  if (
    !request ||
    request.target.mode !== "audit-dossier" ||
    request.target.identitySnapshotId !== match.identitySnapshotId ||
    request.target.matchSnapshotId !== match.matchSnapshotId ||
    (request.status === "retry-exhausted" &&
    request.acceptedPartIds.length > 0
      ? "partial"
      : request.status) !== value.status
  ) {
    fail(`${label} lacks a matching Audit dossier request.`);
  }
  const acceptedAcrossJob = new Set(
    [...requests.values()]
      .filter(
        (item) =>
          item.jobId === request.jobId && item.attempt <= request.attempt,
      )
      .flatMap((item) => item.acceptedPartIds),
  );
  if (
    value.status === "completed" &&
    (!sameStringSet([...acceptedAcrossJob], screen02AuditDossierPartIds) ||
      (value.atAGlance as unknown[]).length === 0 ||
      (value.sourceIds as string[]).length === 0 ||
      !isRecord(value.whatHappened) ||
      (value.whatHappened.sourceIds as string[]).length === 0)
  ) {
    fail(`${label} completed dossier lacks identity facts or sources.`);
  }
  if (
    value.dossierFingerprint !==
    fingerprintScreen02AuditDossier(
      value as unknown as Screen02AuditDossier,
    )
  ) {
    fail(`${label}.dossierFingerprint does not match.`);
  }
}

function validateAuditAssessment(
  value: unknown,
  label: string,
  match: Screen02AuditPossibleMatch,
  requests: ReadonlyMap<string, Screen02AssessmentRequest>,
  dossiers: ReadonlyMap<string, Screen02AuditDossier>,
) {
  assertRecord(value, label);
  assertExactKeys(
    value,
    [
      "assessmentId",
      "identitySnapshotId",
      "requestId",
      "status",
      "studyFit",
      "outcomePathway",
      "coverageRelation",
      "measurementPotential",
      "mainConcern",
      "nextChecks",
      "evidenceSourceIds",
      "acceptedFields",
      "overallJudgment",
      "overallJudgmentMethod",
      "recordedAt",
    ],
    label,
  );
  assertNonEmptyString(value.assessmentId, `${label}.assessmentId`);
  if (value.identitySnapshotId !== match.identitySnapshotId) {
    fail(`${label} targets the wrong identity snapshot.`);
  }
  assertNonEmptyString(value.requestId, `${label}.requestId`);
  const request = requests.get(value.requestId as string);
  if (
    !request ||
    request.target.mode !== "audit-confirmed-event" ||
    request.target.identitySnapshotId !== match.identitySnapshotId
  ) {
    fail(`${label} lacks a matching post-confirmation request.`);
  }
  assertEnum(value.status, ["partial", "completed"], `${label}.status`);
  const requestResultStatus =
    request.status === "retry-exhausted" &&
    request.acceptedPartIds.length > 0
      ? "partial"
      : request.status;
  if (requestResultStatus !== value.status) {
    fail(`${label} status does not match its assessment request.`);
  }
  const dossier = dossiers.get(request.target.dossierSnapshotId);
  if (
    !dossier ||
    dossier.identitySnapshotId !== match.identitySnapshotId ||
    dossier.dossierFingerprint !== request.target.dossierFingerprint
  ) {
    fail(`${label} is not bound to its confirmed dossier snapshot.`);
  }
  const allowedSources = new Set([...match.sourceIds, ...dossier.sourceIds]);
  const acceptedAcrossJob = [
    ...new Set(
      [...requests.values()]
        .filter(
          (item) =>
            item.jobId === request.jobId && item.attempt <= request.attempt,
        )
        .flatMap((item) => item.acceptedPartIds),
    ),
  ];
  assertStringArray(value.acceptedFields, `${label}.acceptedFields`);
  assertUnique(value.acceptedFields as string[], `${label}.acceptedFields`);
  if (
    !sameStringSet(value.acceptedFields as string[], acceptedAcrossJob) ||
    (value.acceptedFields as string[]).some(
      (field) => !screen02AuditAssessmentPartIds.includes(field as never),
    )
  ) {
    fail(`${label}.acceptedFields do not match accepted job parts.`);
  }
  validateAssessmentComponent(value.studyFit, screen02StudyFitCategories, `${label}.studyFit`, allowedSources);
  validateAssessmentComponent(value.outcomePathway, screen02OutcomePathwayCategories, `${label}.outcomePathway`, allowedSources);
  validateAssessmentComponent(value.coverageRelation, screen02CoverageRelationCategories, `${label}.coverageRelation`, allowedSources);
  validateAssessmentComponent(
    value.measurementPotential,
    screen02MeasurementPotentialCategories,
    `${label}.measurementPotential`,
    allowedSources,
  );
  if (value.mainConcern !== null) assertNonEmptyString(value.mainConcern, `${label}.mainConcern`);
  assertStringArray(value.nextChecks, `${label}.nextChecks`);
  assertStringArray(value.evidenceSourceIds, `${label}.evidenceSourceIds`);
  assertUnique(value.evidenceSourceIds as string[], `${label}.evidenceSourceIds`);
  if ((value.evidenceSourceIds as string[]).some((id) => !allowedSources.has(id))) {
    fail(`${label} cites evidence outside the identity snapshot.`);
  }
  const componentEvidence = [
    value.studyFit,
    value.outcomePathway,
    value.coverageRelation,
    value.measurementPotential,
  ].flatMap((component) =>
    isRecord(component)
      ? (component.evidenceSourceIds as string[])
      : [],
  );
  const evidenceUnion = [...new Set(componentEvidence)];
  if (!sameStringSet(value.evidenceSourceIds as string[], evidenceUnion)) {
    fail(
      `${label}.evidenceSourceIds must equal the component evidence union.`,
    );
  }
  const acceptedFields = new Set(value.acceptedFields as string[]);
  for (const [field, fieldValue] of [
    ["studyFit", value.studyFit],
    ["outcomePathway", value.outcomePathway],
    ["coverageRelation", value.coverageRelation],
    ["measurementPotential", value.measurementPotential],
  ] as const) {
    if (acceptedFields.has(field) !== (fieldValue !== null)) {
      fail(`${label}.${field} does not match accepted fields.`);
    }
  }
  if (acceptedFields.has("mainConcern") !== (value.mainConcern !== null)) {
    fail(`${label}.mainConcern does not match accepted fields.`);
  }
  if (
    acceptedFields.has("nextChecks") !==
    ((value.nextChecks as string[]).length > 0)
  ) {
    fail(`${label}.nextChecks does not match accepted fields.`);
  }
  assertNullableString(value.overallJudgment, `${label}.overallJudgment`);
  if (value.overallJudgment !== null) {
    assertEnum(value.overallJudgment, screen02PreliminaryJudgments, `${label}.overallJudgment`);
  }
  assertNullableString(value.overallJudgmentMethod, `${label}.overallJudgmentMethod`);
  assertNonEmptyString(value.recordedAt, `${label}.recordedAt`);
  const category = (component: unknown) =>
    isRecord(component) ? (component.category as string) : null;
  const derived = deriveScreen02AuditJudgment({
    studyFit: category(value.studyFit),
    outcomePathway: category(value.outcomePathway),
    coverageRelation: category(value.coverageRelation),
    measurementPotential: category(value.measurementPotential),
  });
  if (value.status === "completed") {
    if (
      !sameStringSet(
        value.acceptedFields as string[],
        screen02AuditAssessmentPartIds,
      ) ||
      !derived ||
      value.overallJudgment !== derived ||
      value.overallJudgmentMethod !== "fixed-computation"
    ) {
      fail(`${label} completed judgment was not derived by fixed computation.`);
    }
    if (value.mainConcern === null || (value.nextChecks as string[]).length === 0) {
      fail(`${label} completed assessment lacks concern or next check.`);
    }
  } else if (value.overallJudgment !== null || value.overallJudgmentMethod !== null) {
    fail(`${label} partial assessment cannot carry an overall judgment.`);
  }
}

function validateAuditState(
  value: Record<string, unknown>,
  allowLegacyEmbeddedSchemas = false,
): Screen02AuditState {
  assertExactKeysWithOptional(
    value,
    auditStateKeys,
    ["shockGlances"],
    "Screen02AuditState",
  );
  if (value.stateKind !== SCREEN_02_AUDIT_STATE_KIND) {
    auditFail("state discriminator is invalid.");
  }
  const { baseline, sourceIds } = validateCommonRoot(value, "audit");
  const sourceById = new Map(
    (value.sources as unknown as Screen02WorkflowSource[]).map((source) =>
      [source.id, source] as const
    ),
  );
  assertRecord(value.anchor, "anchor");
  assertExactKeys(value.anchor, ["originalWording", "activeRevisionId", "revisions"], "anchor");
  assertNonEmptyString(value.anchor.originalWording, "anchor.originalWording");
  if (!screen02EventWordingMatches(
    value.anchor.originalWording as string,
    baseline.knownShock,
  )) {
    auditFail("anchor must preserve exact Screen 1 known-shock wording.");
  }
  assertNonEmptyString(value.anchor.activeRevisionId, "anchor.activeRevisionId");
  assertArray(value.anchor.revisions, "anchor.revisions");
  if (value.anchor.revisions.length === 0) auditFail("anchor needs a revision.");
  const anchorRevisionIds: string[] = [];
  for (const [index, revision] of value.anchor.revisions.entries()) {
    const label = `anchor.revisions[${index}]`;
    assertRecord(revision, label);
    assertExactKeys(
      revision,
      ["anchorRevisionId", "previousRevisionId", "fields", "createdAt", "reason"],
      label,
    );
    assertNonEmptyString(revision.anchorRevisionId, `${label}.anchorRevisionId`);
    assertNullableString(revision.previousRevisionId, `${label}.previousRevisionId`);
    const expectedPrevious = index === 0 ? null : anchorRevisionIds[index - 1];
    if (revision.previousRevisionId !== expectedPrevious) {
      fail(`${label} does not form an append-only anchor chain.`);
    }
    assertRecord(revision.fields, `${label}.fields`);
    assertExactKeys(
      revision.fields,
      [
        "shockName",
        "jurisdiction",
        "issuingAuthority",
        "approximateYear",
        "versionType",
        "distinguishingFeature",
        "sourceLocator",
        "clarification",
      ],
      `${label}.fields`,
    );
    assertNonEmptyString(revision.fields.shockName, `${label}.fields.shockName`);
    for (const key of [
      "jurisdiction",
      "issuingAuthority",
      "approximateYear",
      "distinguishingFeature",
      "sourceLocator",
      "clarification",
    ] as const) {
      assertNullableString(revision.fields[key], `${label}.fields.${key}`);
    }
    assertEnum(revision.fields.versionType, screen02AuditVersionTypes, `${label}.fields.versionType`);
    assertNonEmptyString(revision.createdAt, `${label}.createdAt`);
    assertNonEmptyString(revision.reason, `${label}.reason`);
    anchorRevisionIds.push(revision.anchorRevisionId as string);
  }
  assertUnique(anchorRevisionIds, "anchor.revisions.anchorRevisionId");
  if (value.anchor.activeRevisionId !== anchorRevisionIds.at(-1)) {
    auditFail("active anchor must be the latest append-only revision.");
  }
  const anchorRevisionMap = new Map(
    (value.anchor.revisions as unknown as Screen02AuditState["anchor"]["revisions"]).map(
      (revision) => [revision.anchorRevisionId, revision],
    ),
  );

  assertArray(value.assessmentRequests, "assessmentRequests");
  value.assessmentRequests.forEach((request, index) =>
    validateAssessmentRequest(request, `assessmentRequests[${index}]`),
  );
  const requests = value.assessmentRequests as unknown as Screen02AssessmentRequest[];
  assertUnique(requests.map((request) => request.requestId), "assessmentRequests.requestId");
  validateAssessmentRequestLineage(requests);
  if (
    requests.some(
      (request) =>
        !["audit-dossier", "audit-confirmed-event"].includes(
          request.target.mode,
        ),
    )
  ) {
    auditFail("state contains a Find assessment request.");
  }
  const requestMap = new Map(requests.map((request) => [request.requestId, request]));

  assertArray(value.possibleMatches, "possibleMatches");
  const matchSnapshotIds: string[] = [];
  const identitySnapshotIds: string[] = [];
  const matchFingerprints: string[] = [];
  for (const [index, match] of value.possibleMatches.entries()) {
    const label = `possibleMatches[${index}]`;
    assertRecord(match, label);
    assertExactKeys(
      match,
      [
        "matchId",
        "matchSnapshotId",
        "identitySnapshotId",
        "matchFingerprint",
        "matchSetSnapshotId",
        "anchorRevisionId",
        "identity",
        "relationship",
        "relationshipReason",
        "sourceIds",
        "limitations",
        "recordedAt",
      ],
      label,
    );
    for (const key of [
      "matchId",
      "matchSnapshotId",
      "identitySnapshotId",
      "matchSetSnapshotId",
      "anchorRevisionId",
      "relationshipReason",
      "recordedAt",
    ] as const) {
      assertNonEmptyString(match[key], `${label}.${key}`);
    }
    if (!anchorRevisionIds.includes(match.anchorRevisionId as string)) {
      fail(`${label} references an unknown anchor revision.`);
    }
    assertNonEmptyString(match.matchFingerprint, `${label}.matchFingerprint`);
    if (!fingerprintPattern.test(match.matchFingerprint as string)) {
      fail(`${label}.matchFingerprint is malformed.`);
    }
    validateIdentity(match.identity, `${label}.identity`);
    assertEnum(match.relationship, screen02AuditRelationships, `${label}.relationship`);
    assertStringArray(match.sourceIds, `${label}.sourceIds`);
    assertUnique(match.sourceIds as string[], `${label}.sourceIds`);
    if ((match.sourceIds as string[]).some((id) => !sourceIds.has(id))) {
      fail(`${label} references a source outside the state.`);
    }
    assertStringArray(match.limitations, `${label}.limitations`);
    const { matchFingerprint, ...fingerprintInput } = match;
    if (matchFingerprint !== fingerprintScreen02WorkflowValue(fingerprintInput)) {
      fail(`${label}.matchFingerprint does not match its identity snapshot.`);
    }
    matchSnapshotIds.push(match.matchSnapshotId as string);
    identitySnapshotIds.push(match.identitySnapshotId as string);
    matchFingerprints.push(match.matchFingerprint as string);
  }
  assertUnique(matchSnapshotIds, "possibleMatches.matchSnapshotId");
  assertUnique(identitySnapshotIds, "possibleMatches.identitySnapshotId");
  assertUnique(matchFingerprints, "possibleMatches.matchFingerprint");
  const matches = value.possibleMatches as unknown as Screen02AuditPossibleMatch[];
  const matchMap = new Map(matches.map((match) => [match.matchSnapshotId, match]));
  const identityMap = new Map(matches.map((match) => [match.identitySnapshotId, match]));

  assertArray(value.matchSets, "matchSets");
  const matchSetIds: string[] = [];
  let activeSetCount = 0;
  for (const [index, set] of value.matchSets.entries()) {
    const label = `matchSets[${index}]`;
    assertRecord(set, label);
    assertExactKeys(
      set,
      [
        "matchSetSnapshotId",
        "matchSetFingerprint",
        "anchorRevisionId",
        "possibleMatchSnapshotIds",
        "manifest",
        "status",
        "supersededBySnapshotId",
      ],
      label,
    );
    assertNonEmptyString(set.matchSetSnapshotId, `${label}.matchSetSnapshotId`);
    assertNonEmptyString(set.matchSetFingerprint, `${label}.matchSetFingerprint`);
    if (!fingerprintPattern.test(set.matchSetFingerprint as string)) {
      fail(`${label}.matchSetFingerprint is malformed.`);
    }
    if (!anchorRevisionIds.includes(set.anchorRevisionId as string)) {
      fail(`${label} references an unknown anchor revision.`);
    }
    assertStringArray(set.possibleMatchSnapshotIds, `${label}.possibleMatchSnapshotIds`);
    assertUnique(set.possibleMatchSnapshotIds as string[], `${label}.possibleMatchSnapshotIds`);
    for (const id of set.possibleMatchSnapshotIds as string[]) {
      const match = matchMap.get(id);
      if (!match || match.matchSetSnapshotId !== set.matchSetSnapshotId) {
        fail(`${label} contains a match from another snapshot.`);
      }
    }
    validateSearchManifest(
      set.manifest,
      `${label}.manifest`,
      allowLegacyEmbeddedSchemas,
    );
    const manifest = set.manifest as unknown as Screen02WorkflowSearchManifest;
    const resultBinding = manifest.retainedResultBinding;
    const boundResultBySnapshotId = new Map(
      resultBinding?.results.map((result) => [result.snapshotId, result]) ?? [],
    );
    if (
      manifest.protocolVersion ===
        SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_VERSION &&
      (
        !resultBinding ||
        resultBinding.mode !== "audit" ||
        manifest.funnel.uniqueEventLeads !==
          (set.possibleMatchSnapshotIds as string[]).length ||
        resultBinding.results.length !==
          (set.possibleMatchSnapshotIds as string[]).length ||
        (set.possibleMatchSnapshotIds as string[]).some((snapshotId) => {
          const match = matchMap.get(snapshotId)!;
          const bound = boundResultBySnapshotId.get(snapshotId);
          return !bound || bound.recordId !== match.matchId ||
            !sameStringSet(bound.sourceIds, match.sourceIds) ||
            bound.qualificationLane !== null ||
            !sameStringSet(
              retainedResultOriginSourceUnion(bound),
              match.sourceIds,
            ) ||
            bound.origins.some((origin) => origin.kind === "prior-result") ||
            !bound.origins.some((origin) =>
              origin.evidenceRole === "identity"
            );
        })
      )
    ) {
      fail(
        `${label}.manifest is not bound to its retained Audit match set.`,
      );
    }
    if (
      manifest.protocolVersion ===
        SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_VERSION &&
      resultBinding
    ) {
      for (const snapshotId of set.possibleMatchSnapshotIds as string[]) {
        const bound = boundResultBySnapshotId.get(snapshotId)!;
        for (const origin of bound.origins) {
          if (origin.kind === "prior-result") {
            fail(`${label}.manifest cannot carry a prior Find result.`);
          }
          if (
            origin.retrievalLane === "reviewed-registry" ||
            origin.retrievalLane === "host-official" ||
            origin.retrievalLane === "qualification-recovery"
          ) {
            fail(
              `${label}.manifest uses a retained-result lane unavailable to Audit.`,
            );
          }
          if (
            researcherRetainedResultLanes.has(origin.retrievalLane)
          ) {
            if (
              !retainedResultOriginSourcesAreResearcherProvided(
                origin,
                sourceById,
              )
            ) {
              fail(
                `${label}.manifest researcher origin is not bound to researcher-provided sources.`,
              );
            }
          } else if (origin.evidenceRole === "identity") {
            const maximumAuthorityTier = reviewedRetainedResultLanes.has(
                origin.retrievalLane,
              )
              ? 2
              : officialRetainedResultLanes.has(origin.retrievalLane)
              ? 3
              : null;
            if (
              maximumAuthorityTier === null ||
              !retainedResultOriginSourcesAreTrustedNonResearcher(
                origin,
                sourceById,
                maximumAuthorityTier,
              )
            ) {
              fail(
                `${label}.manifest identity origin is not bound to official or reviewed evidence.`,
              );
            }
          }
        }
      }
    }
    if (manifest.retrievalExecution) {
      const retainedByCandidateId = new Map(
        (set.possibleMatchSnapshotIds as string[]).map((snapshotId) => {
          const match = matchMap.get(snapshotId)!;
          return [match.matchId, match] as const;
        }),
      );
      const allowedCandidateIds = new Set([
        ...retainedByCandidateId.keys(),
        ...manifest.exclusions.map((exclusion) => exclusion.recordId),
        ...manifest.exclusions.map((exclusion) =>
          `host-lead-${exclusion.recordId}`.slice(0, 200)
        ),
        ...manifest.queryMatrix.flatMap((query) => query.returnedRecordIds),
      ]);
      for (const [acquisitionIndex, acquisition] of
        manifest.retrievalExecution.documentAcquisitions.entries()) {
        const acquisitionLabel =
          `${label}.manifest.retrievalExecution.documentAcquisitions[${acquisitionIndex}]`;
        if (!allowedCandidateIds.has(acquisition.candidateId)) {
          fail(`${acquisitionLabel} cites a candidate outside its search result.`);
        }
        if (acquisition.sourceId !== null) {
          const retained = retainedByCandidateId.get(acquisition.candidateId);
          const source = sourceById.get(acquisition.sourceId);
          if (
            !retained || !sourceIds.has(acquisition.sourceId) || !source ||
            !retained.sourceIds.includes(acquisition.sourceId) ||
            !screen02DocumentAcquisitionMatchesSource(acquisition, source)
          ) {
            fail(`${acquisitionLabel} is not bound to its retained match and source locator.`);
          }
        }
      }
    }
    if (manifest.hostReviewApplication) {
      fail(`${label} cannot carry a Find host-review application marker.`);
    }
    assertEnum(set.status, ["active", "superseded"], `${label}.status`);
    assertNullableString(set.supersededBySnapshotId, `${label}.supersededBySnapshotId`);
    if (set.status === "active") {
      activeSetCount += 1;
      if (set.supersededBySnapshotId !== null) {
        fail(`${label} active set cannot have a successor.`);
      }
    } else if (set.supersededBySnapshotId === null) {
      fail(`${label} superseded set must name its successor.`);
    }
    if (
      set.matchSetFingerprint !==
      fingerprintScreen02AuditMatchSet(
        set as unknown as Screen02AuditState["matchSets"][number],
      )
    ) {
      fail(`${label}.matchSetFingerprint does not match.`);
    }
    matchSetIds.push(set.matchSetSnapshotId as string);
  }
  assertUnique(matchSetIds, "matchSets.matchSetSnapshotId");
  if (value.activeMatchSetSnapshotId === null) {
    if (activeSetCount !== 0) auditFail("state has an active match set without an active ID.");
  } else {
    assertNonEmptyString(value.activeMatchSetSnapshotId, "activeMatchSetSnapshotId");
    const active = (value.matchSets as unknown as Array<Record<string, unknown>>).find(
      (set) => set.matchSetSnapshotId === value.activeMatchSetSnapshotId,
    );
    if (
      !active ||
      active.status !== "active" ||
      activeSetCount !== 1 ||
      active.anchorRevisionId !== value.anchor.activeRevisionId
    ) {
      auditFail("active match set is inconsistent.");
    }
  }

  const matchSetMap = new Map(
    (value.matchSets as unknown as Screen02AuditState["matchSets"]).map(
      (set) => [set.matchSetSnapshotId, set],
    ),
  );
  for (const set of matchSetMap.values()) {
    if (
      set.status === "superseded" &&
      (!matchSetMap.has(set.supersededBySnapshotId!) ||
        set.supersededBySnapshotId === set.matchSetSnapshotId)
    ) {
      auditFail("superseded match set has an invalid successor.");
    }
  }
  for (const match of matches) {
    const owner = matchSetMap.get(match.matchSetSnapshotId);
    if (
      !owner ||
      owner.anchorRevisionId !== match.anchorRevisionId ||
      !owner.possibleMatchSnapshotIds.includes(match.matchSnapshotId)
    ) {
      auditFail("possible match is not owned by its declared match set.");
    }
  }

  assertArray(value.dossiers, "dossiers");
  const dossierIds: string[] = [];
  for (const [index, dossier] of value.dossiers.entries()) {
    validateAuditDossier(
      dossier,
      `dossiers[${index}]`,
      sourceIds,
      identityMap,
      requestMap,
    );
    dossierIds.push(
      (dossier as Record<string, unknown>).dossierSnapshotId as string,
    );
  }
  assertUnique(dossierIds, "dossiers.dossierSnapshotId");
  const dossiers = value.dossiers as unknown as Screen02AuditDossier[];
  const dossierMap = new Map(
    dossiers.map((dossier) => [dossier.dossierSnapshotId, dossier]),
  );
  assertUnique(
    dossiers.map((dossier) => dossier.requestId),
    "dossiers.requestId",
  );
  validateAcceptedDossierPartHistory(dossiers, requestMap);

  assertArray(value.identityDecisions, "identityDecisions");
  const decisionIds: string[] = [];
  const decisionMap = new Map<string, Screen02IdentityDecision>();
  const reversedConfirmationDecisionIds = new Set<string>();
  let projectedConfirmation:
    | NonNullable<Screen02AuditState["confirmedIdentity"]>
    | null = null;
  for (const [index, decision] of value.identityDecisions.entries()) {
    const label = `identityDecisions[${index}]`;
    assertRecord(decision, label);
    assertExactKeys(
      decision,
      [
        "decisionId",
        "action",
        "actor",
        "anchorRevisionId",
        "matchSnapshotId",
        "identitySnapshotId",
        "dossierSnapshotId",
        "confirmationSnapshotId",
        "confirmationFingerprint",
        "reversesDecisionId",
        "at",
        "reason",
      ],
      label,
    );
    assertNonEmptyString(decision.decisionId, `${label}.decisionId`);
    assertEnum(decision.action, screen02IdentityDecisionActions, `${label}.action`);
    if (decision.actor !== "researcher") {
      fail(`${label} must record an explicit researcher decision.`);
    }
    if (!anchorRevisionIds.includes(decision.anchorRevisionId as string)) {
      fail(`${label} references an unknown anchor revision.`);
    }
    assertNullableString(decision.matchSnapshotId, `${label}.matchSnapshotId`);
    assertNullableString(decision.identitySnapshotId, `${label}.identitySnapshotId`);
    assertNullableString(decision.dossierSnapshotId, `${label}.dossierSnapshotId`);
    assertNullableString(decision.confirmationSnapshotId, `${label}.confirmationSnapshotId`);
    assertNullableString(decision.confirmationFingerprint, `${label}.confirmationFingerprint`);
    assertNullableString(decision.reversesDecisionId, `${label}.reversesDecisionId`);
    if (decision.matchSnapshotId !== null) {
      const match = matchMap.get(decision.matchSnapshotId as string);
      if (
        !match ||
        match.identitySnapshotId !== decision.identitySnapshotId ||
        match.anchorRevisionId !== decision.anchorRevisionId
      ) {
        fail(`${label} match and identity snapshots disagree.`);
      }
    }
    assertNonEmptyString(decision.at, `${label}.at`);
    assertNonEmptyString(decision.reason, `${label}.reason`);
    if (decision.action === "confirmed") {
      if (projectedConfirmation !== null) {
        fail(
          `${label} cannot replace an active confirmation without a researcher reversal.`,
        );
      }
      const match = matchMap.get(decision.matchSnapshotId as string);
      const dossier = dossierMap.get(decision.dossierSnapshotId as string);
      if (
        !match ||
        !dossier ||
        dossier.status !== "completed" ||
        dossier.identitySnapshotId !== match.identitySnapshotId ||
        decision.reversesDecisionId !== null ||
        !decision.confirmationSnapshotId ||
        !decision.confirmationFingerprint ||
        !fingerprintPattern.test(decision.confirmationFingerprint as string)
      ) {
        fail(`${label} confirmation lacks its exact completed dossier.`);
      }
      const confirmation = {
        confirmationSnapshotId: decision.confirmationSnapshotId as string,
        confirmationFingerprint: decision.confirmationFingerprint as string,
        identitySnapshotId: match.identitySnapshotId,
        matchSnapshotId: match.matchSnapshotId,
        matchSetSnapshotId: match.matchSetSnapshotId,
        anchorRevisionId: match.anchorRevisionId,
        dossierSnapshotId: dossier.dossierSnapshotId,
        dossierFingerprint: dossier.dossierFingerprint,
        decisionId: decision.decisionId as string,
        confirmedAt: decision.at as string,
      };
      if (
        confirmation.confirmationFingerprint !==
        fingerprintScreen02Confirmation(confirmation)
      ) {
        fail(`${label}.confirmationFingerprint does not match.`);
      }
      projectedConfirmation = confirmation;
    } else {
      if (
        decision.confirmationSnapshotId !== null ||
        decision.confirmationFingerprint !== null
      ) {
        fail(`${label} non-confirmation action carries confirmation metadata.`);
      }
      if (["related-version", "rejected"].includes(decision.action as string)) {
        if (
          projectedConfirmation !== null ||
          decision.matchSnapshotId === null ||
          decision.dossierSnapshotId !== null ||
          decision.reversesDecisionId !== null
        ) {
          fail(`${label} action has inconsistent identity fields.`);
        }
      } else if (decision.action === "reversed") {
        const reversed = decisionMap.get(decision.reversesDecisionId as string);
        if (
          !reversed ||
          reversed.action !== "confirmed" ||
          projectedConfirmation?.decisionId !== reversed.decisionId ||
          reversedConfirmationDecisionIds.has(reversed.decisionId) ||
          decision.anchorRevisionId !== reversed.anchorRevisionId ||
          decision.matchSnapshotId !== reversed.matchSnapshotId ||
          decision.identitySnapshotId !== reversed.identitySnapshotId ||
          decision.dossierSnapshotId !== reversed.dossierSnapshotId
        ) {
          fail(`${label} does not reverse a prior matching confirmation.`);
        }
        reversedConfirmationDecisionIds.add(reversed.decisionId);
        projectedConfirmation = null;
      } else {
        if (
          projectedConfirmation !== null ||
          decision.matchSnapshotId !== null ||
          decision.identitySnapshotId !== null ||
          decision.dossierSnapshotId !== null ||
          decision.reversesDecisionId !== null
        ) {
          fail(`${label} anchor/no-match action must not name an identity.`);
        }
        projectedConfirmation = null;
      }
    }
    decisionIds.push(decision.decisionId as string);
    decisionMap.set(
      decision.decisionId as string,
      decision as unknown as Screen02IdentityDecision,
    );
  }
  assertUnique(decisionIds, "identityDecisions.decisionId");
  assertUnique(
    [...decisionMap.values()]
      .map((decision) => decision.confirmationSnapshotId)
      .filter((id): id is string => id !== null),
    "identityDecisions.confirmationSnapshotId",
  );
  assertUnique(
    [...decisionMap.values()]
      .map((decision) => decision.confirmationFingerprint)
      .filter((fingerprint): fingerprint is string => fingerprint !== null),
    "identityDecisions.confirmationFingerprint",
  );

  if (value.confirmedIdentity === null) {
    if (projectedConfirmation !== null) {
      auditFail("active confirmation is missing from decision history.");
    }
  } else {
    assertRecord(value.confirmedIdentity, "confirmedIdentity");
    const confirmedIdentity = value.confirmedIdentity;
    assertExactKeys(
      confirmedIdentity,
      [
        "confirmationSnapshotId",
        "confirmationFingerprint",
        "identitySnapshotId",
        "matchSnapshotId",
        "matchSetSnapshotId",
        "anchorRevisionId",
        "dossierSnapshotId",
        "dossierFingerprint",
        "decisionId",
        "confirmedAt",
      ],
      "confirmedIdentity",
    );
    for (const key of [
      "confirmationSnapshotId",
      "confirmationFingerprint",
      "identitySnapshotId",
      "matchSnapshotId",
      "matchSetSnapshotId",
      "anchorRevisionId",
      "dossierSnapshotId",
      "dossierFingerprint",
      "decisionId",
      "confirmedAt",
    ] as const) {
      assertNonEmptyString(confirmedIdentity[key], `confirmedIdentity.${key}`);
    }
    if (
      !projectedConfirmation ||
      serializeDeterministicJson(projectedConfirmation) !==
        serializeDeterministicJson(confirmedIdentity)
    ) {
      auditFail("confirmed identity does not match effective decision history.");
    }
    const activeSet = matchSetMap.get(confirmedIdentity.matchSetSnapshotId as string);
    if (
      !activeSet ||
      activeSet.status !== "active" ||
      activeSet.matchSetSnapshotId !== value.activeMatchSetSnapshotId ||
      activeSet.anchorRevisionId !== value.anchor.activeRevisionId ||
      confirmedIdentity.anchorRevisionId !== value.anchor.activeRevisionId ||
      !activeSet.possibleMatchSnapshotIds.includes(
        confirmedIdentity.matchSnapshotId as string,
      )
    ) {
      auditFail("confirmation is not bound to the active anchor and match set.");
    }
  }

  for (const request of requests) {
    const target = request.target;
    if (target.mode !== "audit-dossier" && target.mode !== "audit-confirmed-event") {
      auditFail("state contains a Find assessment target.");
    }
    const match = identityMap.get(target.identitySnapshotId);
    const set = matchSetMap.get(target.matchSetSnapshotId);
    const revision = anchorRevisionMap.get(target.anchorRevisionId);
    if (
      !match ||
      !set ||
      !revision ||
      match.matchSnapshotId !== target.matchSnapshotId ||
      match.matchSetSnapshotId !== set.matchSetSnapshotId ||
      match.anchorRevisionId !== revision.anchorRevisionId ||
      !set.possibleMatchSnapshotIds.includes(match.matchSnapshotId) ||
      target.matchFingerprint !== match.matchFingerprint ||
      target.matchSetFingerprint !== set.matchSetFingerprint ||
      target.anchorRevisionFingerprint !== fingerprintAnchorRevision(revision)
    ) {
      auditFail("assessment target does not resolve to immutable identity snapshots.");
    }
    const common = {
      anchorRevisionId: target.anchorRevisionId,
      anchorRevisionFingerprint: target.anchorRevisionFingerprint,
      matchSetSnapshotId: target.matchSetSnapshotId,
      matchSetFingerprint: target.matchSetFingerprint,
      matchSnapshotId: target.matchSnapshotId,
      identitySnapshotId: target.identitySnapshotId,
      matchFingerprint: target.matchFingerprint,
    };
    let packetInput: Record<string, unknown> = {
      mode: target.mode,
      screen01Fingerprint: value.screen01Fingerprint,
      anchorRevision: revision,
      matchSet: common,
      match,
      sources: (value.sources as unknown as Screen02AuditState["sources"]).filter(
        (source) => match.sourceIds.includes(source.id),
      ),
    };
    if (target.mode === "audit-confirmed-event") {
      const dossier = dossierMap.get(target.dossierSnapshotId);
      const decision = decisionMap.get(
        [...decisionMap.values()].find(
          (item) =>
            item.confirmationSnapshotId === target.confirmationSnapshotId,
        )?.decisionId ?? "",
      );
      if (
        !dossier ||
        !decision ||
        decision.action !== "confirmed" ||
        dossier.identitySnapshotId !== match.identitySnapshotId ||
        target.dossierFingerprint !== dossier.dossierFingerprint ||
        target.confirmationFingerprint !== decision.confirmationFingerprint
      ) {
        auditFail("research target lacks its historical confirmation and dossier.");
      }
      const confirmation = {
        confirmationSnapshotId: decision.confirmationSnapshotId!,
        confirmationFingerprint: decision.confirmationFingerprint!,
        identitySnapshotId: match.identitySnapshotId,
        matchSnapshotId: match.matchSnapshotId,
        matchSetSnapshotId: match.matchSetSnapshotId,
        anchorRevisionId: match.anchorRevisionId,
        dossierSnapshotId: dossier.dossierSnapshotId,
        dossierFingerprint: dossier.dossierFingerprint,
        decisionId: decision.decisionId,
        confirmedAt: decision.at,
      };
      if (
        target.confirmationFingerprint !==
        fingerprintScreen02Confirmation(confirmation)
      ) {
        auditFail("research target confirmation fingerprint does not match.");
      }
      packetInput = {
        ...packetInput,
        dossier,
        confirmation,
        sources: (value.sources as unknown as Screen02AuditState["sources"]).filter(
          (source) =>
            new Set([...match.sourceIds, ...dossier.sourceIds]).has(source.id),
        ),
      };
    }
    if (
      target.packetFingerprint !==
      fingerprintScreen02WorkflowValue(packetInput)
    ) {
      auditFail("assessment target packet fingerprint does not match.");
    }
    if (request.supersededBySnapshotId !== null) {
      const successorIsMatchSet =
        set.supersededBySnapshotId === request.supersededBySnapshotId;
      let successorIsLaterConfirmation = false;
      let successorIsReversal = false;
      let successorIsDossierFreeze = false;
      if (target.mode === "audit-dossier") {
        const successorDecision = (
          value.identityDecisions as unknown as Screen02IdentityDecision[]
        ).find(
          (decision) =>
            decision.decisionId === request.supersededBySnapshotId ||
            decision.confirmationSnapshotId === request.supersededBySnapshotId,
        );
        const successorMatch = successorDecision?.matchSnapshotId
          ? matchMap.get(successorDecision.matchSnapshotId)
          : null;
        successorIsDossierFreeze =
          Boolean(successorDecision) &&
          ((successorDecision!.action === "no-match" &&
            successorDecision!.anchorRevisionId === target.anchorRevisionId &&
            Date.parse(successorDecision!.at) >=
              Date.parse(set.manifest.retrievedAt)) ||
            (successorMatch?.matchSetSnapshotId === target.matchSetSnapshotId &&
              (successorDecision!.action === "confirmed" ||
                ((successorDecision!.action === "rejected" ||
                  successorDecision!.action === "related-version") &&
                  successorDecision!.matchSnapshotId ===
                    target.matchSnapshotId))));
      }
      if (target.mode === "audit-confirmed-event") {
        const decisions = value.identityDecisions as unknown as Screen02IdentityDecision[];
        const currentIndex = decisions.findIndex(
          (decision) =>
            decision.confirmationSnapshotId === target.confirmationSnapshotId,
        );
        const successorIndex = decisions.findIndex(
          (decision) =>
            decision.confirmationSnapshotId ===
            request.supersededBySnapshotId,
        );
        const successorDecision = decisions[successorIndex];
        const successorMatch = successorDecision?.matchSnapshotId
          ? matchMap.get(successorDecision.matchSnapshotId)
          : null;
        successorIsLaterConfirmation =
          currentIndex >= 0 &&
          successorIndex > currentIndex &&
          successorDecision?.action === "confirmed" &&
          successorMatch?.matchId === match.matchId;
        const reversal = decisions.find(
          (decision) => decision.decisionId === request.supersededBySnapshotId,
        );
        const confirmedDecision = decisions.find(
          (decision) =>
            decision.action === "confirmed" &&
            decision.confirmationSnapshotId === target.confirmationSnapshotId,
        );
        successorIsReversal =
          reversal?.action === "reversed" &&
          reversal.reversesDecisionId === confirmedDecision?.decisionId &&
          reversal.matchSnapshotId === target.matchSnapshotId &&
          reversal.identitySnapshotId === target.identitySnapshotId;
      }
      if (
        !successorIsMatchSet &&
        !successorIsLaterConfirmation &&
        !successorIsReversal &&
        !successorIsDossierFreeze
      ) {
        auditFail("request does not name a related successor snapshot.",
        );
      }
    }
    if (request.supersededByRequestId !== null) {
      const replacement = requestMap.get(request.supersededByRequestId)!;
      const replacementTarget = replacement.target;
      if (
        (replacementTarget.mode !== "audit-dossier" &&
          replacementTarget.mode !== "audit-confirmed-event") ||
        replacementTarget.mode !== target.mode
      ) {
        auditFail("request points to an unrelated replacement mode.");
      }
      const replacementSet = matchSetMap.get(
        replacementTarget.matchSetSnapshotId,
      );
      const replacementMatch = identityMap.get(
        replacementTarget.identitySnapshotId,
      );
      const setIsRelated =
        replacementTarget.matchSetSnapshotId === target.matchSetSnapshotId ||
        set.supersededBySnapshotId === replacementTarget.matchSetSnapshotId;
      if (
        !replacementSet ||
        !replacementMatch ||
        replacementMatch.matchId !== match.matchId ||
        !setIsRelated
      ) {
        auditFail("request points to an unrelated replacement target.");
      }
    }
  }

  assertArray(value.assessments, "assessments");
  const assessmentIds: string[] = [];
  for (const [index, assessment] of value.assessments.entries()) {
    assertRecord(assessment, `assessments[${index}]`);
    const match = identityMap.get(assessment.identitySnapshotId as string);
    if (!match) fail(`assessments[${index}] references an unknown identity.`);
    validateAuditAssessment(
      assessment,
      `assessments[${index}]`,
      match,
      requestMap,
      dossierMap,
    );
    assessmentIds.push(assessment.assessmentId as string);
  }
  assertUnique(assessmentIds, "assessments.assessmentId");
  assertUnique(
    (value.assessments as unknown as Screen02AuditAssessment[]).map(
      (assessment) => assessment.requestId,
    ),
    "assessments.requestId",
  );
  assertUnique(
    (value.assessments as unknown as Screen02AuditAssessment[])
      .filter((assessment) => assessment.status === "completed")
      .map((assessment) => {
        const request = requestMap.get(assessment.requestId)!;
        return request.target.mode === "audit-confirmed-event"
          ? request.target.confirmationSnapshotId
          : assessment.assessmentId;
      }),
    "completed Audit assessments per confirmation snapshot",
  );
  validateAcceptedAssessmentFieldHistory(
    value.assessments as unknown as Screen02AuditAssessment[],
    requestMap,
    "Audit assessment",
  );

  assertArray(value.continuationHistory, "continuationHistory");
  if (value.continuationHistory.length > 1) {
    auditFail("continuation must be unique and final.");
  }
  const continuationIds: string[] = [];
  for (const [index, continuation] of value.continuationHistory.entries()) {
    const label = `continuationHistory[${index}]`;
    assertRecord(continuation, label);
    const assessmentUnavailable = "assessmentDisposition" in continuation;
    assertExactKeys(
      continuation,
      assessmentUnavailable
        ? [
            "continuationId",
            "confirmationSnapshotId",
            "identitySnapshotId",
            "dossierSnapshotId",
            "assessmentDisposition",
            "continuedRevision",
            "at",
            "reason",
          ]
        : [
            "continuationId",
            "confirmationSnapshotId",
            "identitySnapshotId",
            "dossierSnapshotId",
            "assessmentId",
            "continuedRevision",
            "at",
            "reason",
          ],
      label,
    );
    for (const key of [
      "continuationId",
      "confirmationSnapshotId",
      "identitySnapshotId",
      "dossierSnapshotId",
      "at",
    ] as const) {
      assertNonEmptyString(continuation[key], `${label}.${key}`);
    }
    if (assessmentUnavailable) {
      assertBoundedNonEmptyString(continuation.reason, `${label}.reason`);
      validateAssessmentUnavailableDisposition(
        continuation.assessmentDisposition,
        `${label}.assessmentDisposition`,
        requestMap,
      );
      const disposition = continuation.assessmentDisposition as unknown as Screen02AssessmentUnavailableDisposition;
      if (
        disposition.recordedAt !== continuation.at ||
        disposition.reason !== continuation.reason
      ) {
        fail(
          `${label}.assessmentDisposition must be bound to the continuation acknowledgment.`,
        );
      }
    } else {
      assertNonEmptyString(continuation.assessmentId, `${label}.assessmentId`);
      assertNonEmptyString(continuation.reason, `${label}.reason`);
    }
    if (
      !Number.isSafeInteger(continuation.continuedRevision) ||
      (continuation.continuedRevision as number) < 0 ||
      continuation.continuedRevision !== value.revision
    ) {
      fail(`${label}.continuedRevision does not seal the Audit run.`);
    }
    timestampValue(continuation.at, `${label}.at`);
    const confirmationDecision = [...decisionMap.values()].find(
      (decision) =>
        decision.action === "confirmed" &&
        decision.confirmationSnapshotId ===
          continuation.confirmationSnapshotId,
    );
    const dossier = dossierMap.get(
      continuation.dossierSnapshotId as string,
    );
    const assessment = assessmentUnavailable
      ? null
      : (value.assessments as unknown as Screen02AuditAssessment[]).find(
          (item) => item.assessmentId === continuation.assessmentId,
        );
    const assessmentRequest = assessment
      ? requestMap.get(assessment.requestId)
      : null;
    if (
      !confirmationDecision ||
      confirmationDecision.identitySnapshotId !==
        continuation.identitySnapshotId ||
      confirmationDecision.dossierSnapshotId !==
        continuation.dossierSnapshotId ||
      !dossier ||
      dossier.identitySnapshotId !== continuation.identitySnapshotId ||
      dossier.status !== "completed" ||
      !projectedConfirmation ||
      projectedConfirmation.confirmationSnapshotId !==
        continuation.confirmationSnapshotId ||
      projectedConfirmation.identitySnapshotId !==
        continuation.identitySnapshotId ||
      projectedConfirmation.dossierSnapshotId !==
        continuation.dossierSnapshotId ||
      value.updatedAt !== continuation.at
    ) {
      fail(
        `${label} is not the unique final continuation of the active confirmation and dossier.`,
      );
    }
    if (
      !assessmentUnavailable &&
      (!assessment ||
        assessment.identitySnapshotId !== continuation.identitySnapshotId ||
        assessment.status !== "completed" ||
        assessmentRequest?.target.mode !== "audit-confirmed-event" ||
        assessmentRequest.target.confirmationSnapshotId !==
          continuation.confirmationSnapshotId)
    ) {
      fail(
        `${label} does not identify the completed assessment for the active confirmation.`,
      );
    }
    continuationIds.push(continuation.continuationId as string);
  }
  assertUnique(continuationIds, "continuationHistory.continuationId");

  if (value.shockGlances !== undefined) {
    assertArray(value.shockGlances, "shockGlances");
    if (value.shockGlances.length > SCREEN_02_SHOCK_GLANCE_MAX_ENTRIES) {
      auditFail("state exceeds the retained shock-glance limit.");
    }
    const glanceState = clone(value) as unknown as Screen02AuditState;
    const matchSnapshotIds: string[] = [];
    for (const [index, rawGlance] of value.shockGlances.entries()) {
      const glance = restoreScreen02ShockGlance(rawGlance);
      if (!glance) fail(`shockGlances[${index}] is invalid.`);
      matchSnapshotIds.push(glance.candidateSnapshotId);
      if (!screen02ShockGlanceMatchesAuditState(glance, glanceState)) {
        fail(
          `shockGlances[${index}] is stale or belongs to another Audit match/dossier.`,
        );
      }
    }
    assertUnique(matchSnapshotIds, "shockGlances.candidateSnapshotId");
  }

  const candidate = clone(value) as unknown as Screen02AuditState;
  const continuation = candidate.continuationHistory.at(-1);
  if (continuation) {
    const activeSet = candidate.matchSets.find((set) =>
      set.matchSetSnapshotId === candidate.activeMatchSetSnapshotId
    );
    const retainedHistoricalContinuation =
      activeSet?.manifest.protocolVersion ===
        SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_LEGACY_VERSION;
    if ("assessmentDisposition" in continuation) {
      const gate = computeAuditAssessmentUnavailableContinuationGate(candidate);
      if (
        (!gate.eligible && !retainedHistoricalContinuation) ||
        !sameStringSet(
          continuation.assessmentDisposition.affectedRequestIds,
          gate.affectedRequestIds,
        )
      ) {
        auditFail("assessment-unavailable continuation is not bound to the current terminal request.",
        );
      }
    } else {
      const gate = computeAuditContinuationGate(candidate);
      if (!gate.eligible && !retainedHistoricalContinuation) {
        fail(
          `Completed Audit continuation does not satisfy its gate: ${gate.reasons.join(" ")}`,
        );
      }
    }
  }
  return deepFreeze(candidate);
}

function migrateSearchManifestEmbeddedSchemas(
  manifest: Screen02WorkflowSearchManifest,
  candidateQualifications: readonly unknown[] = [],
) {
  if (manifest.retrievalExecution) {
    const retrievalExecution = migrateScreen02RetrievalExecution(
      manifest.retrievalExecution,
    );
    if (!retrievalExecution) {
      fail("Persisted Screen 2 retrieval execution cannot be migrated.");
    }
    manifest.retrievalExecution = retrievalExecution;
  }
  const qualificationByCandidateId = new Map<
    string,
    NonNullable<ReturnType<typeof migrateScreen02CandidateQualification>>
  >();
  for (const exclusion of manifest.exclusions) {
    if (!exclusion.qualification) continue;
    const qualification = migrateScreen02CandidateQualification(
      exclusion.qualification,
    );
    if (!qualification) {
      fail("Persisted Screen 2 exclusion qualification cannot be migrated.");
    }
    exclusion.qualification = qualification;
    qualificationByCandidateId.set(qualification.candidateId, qualification);
  }
  for (const rawQualification of candidateQualifications) {
    const qualification = migrateScreen02CandidateQualification(
      rawQualification,
    );
    if (qualification) {
      qualificationByCandidateId.set(qualification.candidateId, qualification);
    }
  }
  if (!manifest.funnel) return;
  const recovered = {
    demonstratedMismatch: 0,
    insufficientEvidence: 0,
    mixed: 0,
  };
  for (const qualification of qualificationByCandidateId.values()) {
    if (qualification.hardScope.disposition === "demonstrated-mismatch") {
      recovered.demonstratedMismatch += 1;
    } else if (
      qualification.hardScope.disposition === "insufficient-evidence"
    ) {
      recovered.insufficientEvidence += 1;
    } else if (qualification.hardScope.disposition === "mixed") {
      recovered.mixed += 1;
    }
  }
  const funnel = migrateScreen02SearchFunnel(manifest.funnel, recovered);
  if (!funnel) fail("Persisted Screen 2 search funnel cannot be migrated.");
  manifest.funnel = funnel;
}

function refreshHostReviewApplicationFingerprint(
  manifest: Screen02WorkflowSearchManifest,
  originalCandidateSetFingerprint: string,
) {
  const application = manifest.hostReviewApplication;
  if (!application) return;
  application.originalCandidatePoolFingerprint =
    originalCandidateSetFingerprint;
  const {
    applicationFingerprint: _applicationFingerprint,
    ...fingerprintInput
  } = application;
  application.applicationFingerprint =
    fingerprintScreen02WorkflowValue(fingerprintInput);
}

function migrateFindStateEmbeddedSchemas(
  legacy: Screen02FindState,
): Screen02FindState {
  const migrated = clone(legacy);
  const candidateBySnapshotId = new Map<string, Screen02FindCandidateSnapshot>();
  for (const candidate of migrated.candidates) {
    if (candidate.qualification) {
      const qualification = migrateScreen02CandidateQualification(
        candidate.qualification,
      );
      if (!qualification) {
        fail("Persisted Screen 2 candidate qualification cannot be migrated.");
      }
      candidate.qualification = qualification;
    }
    const { candidateFingerprint: _candidateFingerprint, ...fingerprintInput } =
      candidate;
    candidate.candidateFingerprint =
      fingerprintScreen02WorkflowValue(fingerprintInput);
    candidateBySnapshotId.set(candidate.candidateSnapshotId, candidate);
  }

  for (const set of migrated.candidateSets) {
    migrateSearchManifestEmbeddedSchemas(
      set.manifest,
      set.candidateSnapshotIds.map(
        (candidateSnapshotId) =>
          candidateBySnapshotId.get(candidateSnapshotId)?.qualification,
      ),
    );
  }
  const setById = new Map(
    migrated.candidateSets.map((set) => [set.candidateSetSnapshotId, set]),
  );
  const refreshedSetIds = new Set<string>();
  const refreshingSetIds = new Set<string>();
  const refreshSet = (candidateSetSnapshotId: string): void => {
    if (refreshedSetIds.has(candidateSetSnapshotId)) return;
    if (refreshingSetIds.has(candidateSetSnapshotId)) {
      fail("Persisted Screen 2 host-review candidate pools contain a cycle.");
    }
    const set = setById.get(candidateSetSnapshotId);
    if (!set) fail("Persisted Screen 2 candidate set cannot be migrated.");
    refreshingSetIds.add(candidateSetSnapshotId);
    const application = set.manifest.hostReviewApplication;
    if (application) {
      refreshSet(application.originalCandidatePoolId);
      const original = setById.get(application.originalCandidatePoolId)!;
      refreshHostReviewApplicationFingerprint(
        set.manifest,
        original.candidateSetFingerprint,
      );
    }
    set.candidateSetFingerprint = fingerprintScreen02FindCandidateSet(set);
    refreshingSetIds.delete(candidateSetSnapshotId);
    refreshedSetIds.add(candidateSetSnapshotId);
  };
  for (const set of migrated.candidateSets) {
    refreshSet(set.candidateSetSnapshotId);
  }

  const criterionByKey = new Map(
    migrated.criteria.map((criterion) => [
      `${criterion.criterionId}:${criterion.version}`,
      criterion,
    ]),
  );
  for (const request of migrated.assessmentRequests) {
    const target = request.target;
    if (
      target.mode !== "find-candidate" &&
      target.mode !== "find-criterion"
    ) {
      continue;
    }
    const candidate = candidateBySnapshotId.get(target.candidateSnapshotId);
    if (!candidate) fail("Persisted Screen 2 assessment target is orphaned.");
    target.candidateFingerprint = candidate.candidateFingerprint;
    const sources = migrated.sources.filter((source) =>
      candidate.sourceIds.includes(source.id)
    );
    const packetInput: Record<string, unknown> = {
      mode: target.mode,
      screen01Fingerprint: migrated.screen01Fingerprint,
      candidate,
      sources,
    };
    if (target.mode === "find-criterion") {
      const criterion = criterionByKey.get(
        `${target.criterionId}:${target.criterionVersion}`,
      );
      if (!criterion) {
        fail("Persisted Screen 2 criterion target is orphaned.");
      }
      packetInput.criterion = criterion;
    }
    target.packetFingerprint = fingerprintScreen02WorkflowValue(packetInput);
  }

  for (const glance of migrated.shockGlances ?? []) {
    const candidate = candidateBySnapshotId.get(glance.candidateSnapshotId);
    if (!candidate) fail("Persisted Screen 2 shock glance is orphaned.");
    glance.candidateFingerprint = candidate.candidateFingerprint;
    glance.eventFingerprint = fingerprintScreen02ShockGlanceEvent(
      screen02FindGlanceEvent(candidate),
    );
  }
  return migrated;
}

function migrateAuditStateEmbeddedSchemas(
  legacy: Screen02AuditState,
): Screen02AuditState {
  const migrated = clone(legacy);
  for (const set of migrated.matchSets) {
    migrateSearchManifestEmbeddedSchemas(set.manifest);
    set.matchSetFingerprint = fingerprintScreen02AuditMatchSet(set);
  }
  const setById = new Map(
    migrated.matchSets.map((set) => [set.matchSetSnapshotId, set]),
  );
  const matchBySnapshotId = new Map(
    migrated.possibleMatches.map((match) => [match.matchSnapshotId, match]),
  );
  const anchorById = new Map(
    migrated.anchor.revisions.map((revision) => [
      revision.anchorRevisionId,
      revision,
    ]),
  );
  const dossierById = new Map(
    migrated.dossiers.map((dossier) => [dossier.dossierSnapshotId, dossier]),
  );
  const confirmationDecisionBySnapshotId = new Map(
    migrated.identityDecisions.flatMap((decision) =>
      decision.confirmationSnapshotId
        ? [[decision.confirmationSnapshotId, decision] as const]
        : []
    ),
  );
  for (const request of migrated.assessmentRequests) {
    const target = request.target;
    if (
      target.mode !== "audit-dossier" &&
      target.mode !== "audit-confirmed-event"
    ) {
      continue;
    }
    const set = setById.get(target.matchSetSnapshotId);
    const match = matchBySnapshotId.get(target.matchSnapshotId);
    const anchorRevision = anchorById.get(target.anchorRevisionId);
    if (!set || !match || !anchorRevision) {
      fail("Persisted Screen 2 Audit assessment target is orphaned.");
    }
    target.matchSetFingerprint = set.matchSetFingerprint;
    const common = {
      anchorRevisionId: target.anchorRevisionId,
      anchorRevisionFingerprint: target.anchorRevisionFingerprint,
      matchSetSnapshotId: target.matchSetSnapshotId,
      matchSetFingerprint: target.matchSetFingerprint,
      matchSnapshotId: target.matchSnapshotId,
      identitySnapshotId: target.identitySnapshotId,
      matchFingerprint: target.matchFingerprint,
    };
    const packetInput: Record<string, unknown> = {
      mode: target.mode,
      screen01Fingerprint: migrated.screen01Fingerprint,
      anchorRevision,
      matchSet: common,
      match,
      sources: migrated.sources.filter((source) =>
        match.sourceIds.includes(source.id)
      ),
    };
    if (target.mode === "audit-confirmed-event") {
      const dossier = dossierById.get(target.dossierSnapshotId);
      const decision = confirmationDecisionBySnapshotId.get(
        target.confirmationSnapshotId,
      );
      if (!dossier || !decision) {
        fail("Persisted Screen 2 Audit confirmation target is orphaned.");
      }
      const confirmation = {
        confirmationSnapshotId: decision.confirmationSnapshotId!,
        confirmationFingerprint: decision.confirmationFingerprint!,
        identitySnapshotId: match.identitySnapshotId,
        matchSnapshotId: match.matchSnapshotId,
        matchSetSnapshotId: match.matchSetSnapshotId,
        anchorRevisionId: match.anchorRevisionId,
        dossierSnapshotId: dossier.dossierSnapshotId,
        dossierFingerprint: dossier.dossierFingerprint,
        decisionId: decision.decisionId,
        confirmedAt: decision.at,
      };
      packetInput.dossier = dossier;
      packetInput.confirmation = confirmation;
      packetInput.sources = migrated.sources.filter((source) =>
        new Set([...match.sourceIds, ...dossier.sourceIds]).has(source.id)
      );
    }
    target.packetFingerprint = fingerprintScreen02WorkflowValue(packetInput);
  }
  return migrated;
}

export function restoreScreen02FindState(value: unknown): Screen02FindState | null {
  try {
    const candidate = clone(value);
    assertRecord(candidate, "Screen02FindState");
    let restored: Screen02FindState;
    try {
      restored = validateFindState(candidate);
    } catch {
      const compatible = validateFindState(clone(candidate), true);
      restored = validateFindState(
        migrateFindStateEmbeddedSchemas(compatible),
      );
    }
    assertScreen02StateEnvelopeCapacity(
      serializeDeterministicJson(restored),
    );
    return restored;
  } catch {
    return null;
  }
}

export function restoreScreen02AuditState(value: unknown): Screen02AuditState | null {
  try {
    assertRecord(value, "Screen02AuditState");
    let restored: Screen02AuditState;
    try {
      restored = validateAuditState(clone(value));
    } catch {
      const compatible = validateAuditState(clone(value), true);
      restored = validateAuditState(
        migrateAuditStateEmbeddedSchemas(compatible),
      );
    }
    assertScreen02StateEnvelopeCapacity(
      serializeDeterministicJson(restored),
    );
    return restored;
  } catch {
    return null;
  }
}

export function restoreScreen02WorkflowState(
  value: unknown,
): Screen02WorkflowState | null {
  if (!isRecord(value)) return null;
  if (value.stateKind === SCREEN_02_FIND_STATE_KIND) {
    return restoreScreen02FindState(value);
  }
  if (value.stateKind === SCREEN_02_AUDIT_STATE_KIND) {
    return restoreScreen02AuditState(value);
  }
  return null;
}

export function requireScreen02FindState(value: unknown): Screen02FindState {
  const restored = restoreScreen02FindState(value);
  if (!restored) screen2Fail("Find state failed its canonical contract.");
  return restored;
}

export function requireScreen02AuditState(value: unknown): Screen02AuditState {
  const restored = restoreScreen02AuditState(value);
  if (!restored) screen2Fail("Audit state failed its canonical contract.");
  return restored;
}

export function requireScreen02WorkflowState(
  value: unknown,
): Screen02WorkflowState {
  const restored = restoreScreen02WorkflowState(value);
  if (!restored) screen2Fail("workflow state failed its canonical contract.");
  return restored;
}
