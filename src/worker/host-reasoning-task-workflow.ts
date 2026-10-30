import { decodeScreen02WorkflowClientEnvelope } from "../core/screen02-workflow-client";
import { encodeScreen02FindWorkflowStateEnvelope } from "../core/screen02-workflow-envelope";
import {
  fingerprintHostReasoningValue,
  hostReasoningTaskCoordinates,
  type HostReasoningTask,
} from "../core/host-reasoning-task";
import {
  type Screen02FindDiscoveryResult,
} from "../core/screen02-find-discovery";
import type {
  Screen02CandidateReviewInfluence,
  Screen02CandidateReviewInfluenceMap,
} from "../core/screen02-qualification";
import {
  SCREEN_02_FIND_MAX_VISIBLE_CANDIDATES,
  beginScreen02FindDiscovery,
  completeScreen02FindDiscovery,
} from "../core/screen02-find-workflow";
import {
  isScreen02StudyRelevanceProfile,
  type Screen02PoolHostCandidateReview,
  type Screen02PoolHostOfficialSourceLead,
  type Screen02StudyRelevanceProfile,
} from "../core/screen02-relevance-profile";
import {
  fingerprintScreen02WorkflowValue,
  fingerprintScreen02WorkflowState,
  requireScreen02WorkflowState,
} from "../core/screen02-workflow-state";
import {
  SCREEN_02_HOST_REVIEW_APPLICATION_SCHEMA_VERSION,
  isScreen02HostReviewApplication,
  type Screen02FindCandidateSnapshot,
  type Screen02FindCandidateSet,
  type Screen02FindState,
  type Screen02HostReviewApplication,
  type Screen02HostReviewOfficialSourceLeadAudit,
  type Screen02HostReviewQueryExecution,
  type Screen02WorkflowSource,
  type Screen02WorkflowState,
} from "../core/screen02-workflow-types";
import {
  buildScreen03SupportedFacts,
  fingerprintScreen03HostEvidenceMappings,
  fingerprintScreen03VerificationState,
  integrateScreen03HostEvidenceMappings,
  requireScreen03VerificationState,
  screen03EvidenceItemProvidesAuthoritativeDirectSupport,
  screen03FactualClaims,
  type Screen03EvidenceItem,
  type Screen03VerificationState,
} from "../core/screen03-workflow";
import {
  SHOCKAUDIT_UI_RESOURCE_URI,
  SHOCKAUDIT_VERSION,
} from "../version";
import {
  createScreen02SearchReviewPolicy,
  createScreen03EvidenceMappingPolicy,
  createScreen03OverviewPolicy,
  type AuthoritativeScreen02HostReviewContext,
  type AuthoritativeScreen03EvidenceContext,
  type AuthoritativeScreen03OverviewContext,
  type Screen03HostEvidenceApplicationCoordinates,
  type ValidatedScreen03HostEvidenceResult,
  type ValidatedScreen03HostOverviewResult,
} from "./host-reasoning-task-policies";
import {
  HostReasoningRuntimeError,
  HostReasoningTaskRuntime,
  screen03EvidenceMappingTaskFactsSchema,
  type HostReasoningFrozenTask,
  type HostReasoningPrepareInput,
  type HostReasoningTaskPolicy,
} from "./host-reasoning-task-runtime";
import type { HostReasoningSigningConfig } from "./host-reasoning-task-security";
import type { HostReasoningTaskStore } from "./host-reasoning-task-store";
import type {
  Screen02WorkflowStore,
  Screen02WorkflowStoreRecord,
} from "./screen02-workflow-store";
import type {
  Screen03WorkflowStore,
  Screen03WorkflowStoreRecord,
} from "./screen03-workflow-store";
import {
  SIX_SCREEN_MECHANISM_PROOF_PROMPT_VERSION,
  SIX_SCREEN_MECHANISM_PROOF_TASK,
  SIX_SCREEN_POLICY_FACT_PROOF_PROMPT_VERSION,
  SIX_SCREEN_POLICY_FACT_PROOF_TASK,
  buildSixScreenIntelligenceProofContext,
  isSixScreenIntelligenceProofTask,
  sixScreenMechanismProofResultSchema,
  sixScreenPolicyFactProofResultSchema,
  validateAndNormalizeSixScreenIntelligenceProof,
} from "./six-screen-intelligence-proof";
import {
  SCREEN04_STUDY_EVENT_ASSESSMENT_PROMPT_VERSION,
  SCREEN04_STUDY_EVENT_ASSESSMENT_TASK,
  SCREEN05_STUDY_MECHANISM_COMPARISON_PROMPT_VERSION,
  SCREEN05_STUDY_MECHANISM_COMPARISON_TASK,
  SCREEN05_THEORETICAL_PLANNING_PROMPT_VERSION,
  SCREEN05_THEORETICAL_PLANNING_TASK,
  buildStudyFirstHostTaskContext,
  isStudyFirstHostTask,
  screen04StudyEventAssessmentResultSchema,
  screen05StudyMechanismComparisonResultSchema,
  screen05TheoreticalPlanningResultSchema,
  validateAndNormalizeStudyFirstHostResult,
} from "./study-first-host-intelligence";
import type { SixScreenWorkflowStore } from "./six-screen-workflow-store";

export const SCREEN02_HOST_SEARCH_REVIEW_PROMPT_VERSION =
  "screen02-search-review-prompt-v1" as const;
export const SCREEN03_HOST_EVIDENCE_MAPPING_PROMPT_VERSION =
  "screen03-evidence-mapping-prompt-v1" as const;
export const SCREEN03_HOST_OVERVIEW_PROMPT_VERSION =
  "screen03-overview-prompt-v1" as const;
export const SHOCKAUDIT_HOST_TASK_WORKFLOW_VERSION =
  "shockaudit-host-task-workflow-v1" as const;

function boundedText(value: string, maximum: number) {
  const clean = value.replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/\s+/gu, " ").trim();
  return clean.length <= maximum
    ? clean
    : `${clean.slice(0, Math.max(0, maximum - 14)).trimEnd()} [truncated]`;
}

function timestampStrictlyAfter(
  floor: string,
  ...candidates: string[]
) {
  const floorTime = Date.parse(floor);
  const candidateTimes = candidates.map((candidate) => Date.parse(candidate));
  if (
    !Number.isFinite(floorTime) ||
    candidateTimes.some((candidate) => !Number.isFinite(candidate))
  ) {
    throw new Error("Host workflow timestamps must be valid ISO instants.");
  }
  return new Date(Math.max(floorTime + 1, ...candidateTimes)).toISOString();
}

function exactScreen03PassageFragment(
  text: string,
  claims: ReturnType<typeof screen03ClaimsForHost>,
) {
  const maximum = 1_000;
  if (text.length <= maximum) return text.trim();
  const focusValues = claims.flatMap((claim) => {
    const value = claim.reviewStatus === "edited" ? claim.editedValue! : claim.value;
    const year = value.match(/\b(?:19|20)\d{2}\b/u)?.[0];
    return [value, ...(year ? [year] : [])];
  });
  const focus = focusValues
    .map((value) => ({ value, start: text.indexOf(value) }))
    .find(({ value, start }) => value.length > 0 && start >= 0);
  const start = focus
    ? Math.max(0, Math.min(focus.start - 200, text.length - maximum))
    : 0;
  // This must stay a byte-for-byte substring of the canonical passage. The
  // policy validates unique containment again against the current state; do
  // not use boundedText here because its truncation marker is synthetic.
  return text.slice(start, start + maximum).trim();
}

function screen02StateFromRecord(record: Screen02WorkflowStoreRecord) {
  const decoded = decodeScreen02WorkflowClientEnvelope(record.stateEnvelope);
  if (!decoded.ok) {
    throw new Error(`Canonical Screen 2 state is unreadable: ${decoded.message}`);
  }
  const state = requireScreen02WorkflowState(decoded.state);
  if (
    state.runId !== record.runId || state.mode !== record.mode ||
    state.revision !== record.stateRevision ||
    fingerprintScreen02WorkflowState(state) !== record.stateFingerprint
  ) {
    throw new Error("Canonical Screen 2 host-task coordinates are inconsistent.");
  }
  return state;
}

function activeFindPool(state: Screen02FindState) {
  const set = state.candidateSets.find((candidateSet) =>
    candidateSet.candidateSetSnapshotId === state.activeCandidateSetSnapshotId
  );
  if (!set || set.status !== "active") {
    throw new HostReasoningRuntimeError(
      "candidate-pool-unavailable",
      "Run deterministic Screen 2 discovery before requesting an optional review.",
    );
  }
  const candidateById = new Map(
    state.candidates.map((candidate) => [candidate.candidateSnapshotId, candidate]),
  );
  const candidates = set.candidateSnapshotIds
    .slice(0, 20)
    .map((id) => candidateById.get(id));
  if (candidates.some((candidate) => !candidate)) {
    throw new Error("The active Screen 2 candidate pool is incomplete.");
  }
  return {
    set,
    candidates: candidates as Screen02FindCandidateSnapshot[],
  };
}

function currentProfile(state: Screen02FindState): Screen02StudyRelevanceProfile {
  if (!state.relevanceProfile ||
      !isScreen02StudyRelevanceProfile(state.relevanceProfile)) {
    throw new HostReasoningRuntimeError(
      "relevance-profile-unavailable",
      "Save the current Screen 2 relevance profile before requesting an optional review.",
    );
  }
  return structuredClone(state.relevanceProfile);
}

function screen02SourceText(
  source: Screen02WorkflowSource,
) {
  if (!source.evidenceText) return "";
  const exact = source.evidenceText.trim();
  // Model-visible Screen 2 passages must be byte-for-byte recoverable from
  // the active source evidence that fixed qualification will inspect later.
  // Do not synthesize candidate prose or a truncation suffix here.
  return exact.slice(0, 1_000);
}

function screen02HostContext(state: Screen02FindState) {
  const { set, candidates } = activeFindPool(state);
  const sourceById = new Map(state.sources.map((source) => [source.id, source]));
  const candidateContexts = candidates.map((candidate) => ({
    candidateId: candidate.candidateSnapshotId,
    sources: candidate.sourceIds.slice(0, 6).map((sourceId) => {
      const source = sourceById.get(sourceId);
      if (!source) throw new Error("A Screen 2 candidate source is missing.");
      return {
        sourceId: source.id,
        active: true,
        text: screen02SourceText(source),
      };
    }),
  }));
  return {
    set,
    candidates,
    sourceById,
    profile: currentProfile(state),
    candidateContexts,
  };
}

export function screen02CanonicalCandidateReviewInfluenceById(
  candidates: readonly Pick<
    Screen02FindCandidateSnapshot,
    "candidateId" | "candidateSnapshotId"
  >[],
  reviews: readonly Screen02PoolHostCandidateReview[],
): Screen02CandidateReviewInfluenceMap {
  const candidateBySnapshotId = new Map<string, string>();
  for (const candidate of candidates) {
    if (candidateBySnapshotId.has(candidate.candidateSnapshotId)) {
      throw new Error(
        "Screen 2 host review candidates contain a duplicate snapshot ID.",
      );
    }
    candidateBySnapshotId.set(
      candidate.candidateSnapshotId,
      candidate.candidateId,
    );
  }

  const entries: Array<[string, Screen02CandidateReviewInfluence]> = [];
  const canonicalCandidateIds = new Set<string>();
  for (const review of reviews) {
    const canonicalCandidateId = candidateBySnapshotId.get(review.candidateId);
    if (!canonicalCandidateId) {
      throw new Error(
        "The validated host review references a stale candidate snapshot.",
      );
    }
    if (canonicalCandidateIds.has(canonicalCandidateId)) {
      throw new Error(
        "Two host review snapshots resolve to the same canonical candidate.",
      );
    }
    canonicalCandidateIds.add(canonicalCandidateId);
    entries.push([canonicalCandidateId, {
      proposedClass: review.proposedClass,
      industryBridge: review.industryBridge,
      profileTermsUsed: [...review.profileTermsUsed],
      sourceIdsUsed: [...review.sourceIdsUsed],
      sourceSpansUsed: review.sourceSpansUsed.map((span) => ({ ...span })),
      sampleConnection: review.sampleConnection,
      outcomePathway: review.outcomePathway,
      mainMismatchOrUncertainty: review.mainMismatchOrUncertainty,
      needsFollowUpRetrieval: review.needsFollowUpRetrieval,
    }]);
  }
  entries.sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  return new Map(entries);
}

function screen02FrozenFacts(state: Screen02FindState) {
  const current = screen02HostContext(state);
  const facts = {
    studyProfile: current.profile,
    // Only the confirmed research contract is model-relevant. The surrounding
    // Screen 1 handoff carries app/version, sentence, decision, and revision
    // metadata that is neither part of this strict facts schema nor needed by
    // the host review.
    confirmedScope: structuredClone(state.screen01Baseline.scopeContract),
    researcherCriteria: state.criteria
      .filter((criterion) => criterion.status === "active")
      .slice(0, 20)
      .map((criterion) => boundedText(`${criterion.kind}: ${criterion.text}`, 300)),
    candidates: current.candidates.slice(0, 20).map((candidate) => {
      const sources = current.candidateContexts.find((item) =>
        item.candidateId === candidate.candidateSnapshotId
      )!.sources;
      return {
        candidateId: candidate.candidateSnapshotId,
        title: boundedText(candidate.identity.canonicalTitle, 300),
        description: boundedText(candidate.description.text, 1_000),
        affectedPopulationFacts: candidate.broadCoverage.slice(0, 8)
          .map((claim) => boundedText(claim.text, 300)),
        dateLeads: candidate.dateLeads.slice(0, 8)
          .map((lead) => boundedText(`${lead.label}: ${lead.date}`, 120)),
        sources: sources.slice(0, 6).map((source) => {
          const canonical = current.sourceById.get(source.sourceId)!;
          return {
            sourceId: source.sourceId,
            title: boundedText(canonical.title, 300),
            authority: boundedText(canonical.publisher, 200),
            locator: boundedText(canonical.locator, 2_048),
            passages: source.text
              ? [{
                  passageId: `s2-passage:${fingerprintHostReasoningValue({
                    candidateId: candidate.candidateSnapshotId,
                    sourceId: source.sourceId,
                    text: source.text,
                  }).slice(8)}`,
                  text: source.text,
                }]
              : [],
          };
        }),
        preliminaryClass: candidate.qualification?.classification ??
          "unclassified" as const,
        exclusionConcerns: candidate.qualification?.exclusionCodes.slice(0, 8)
          .map((code) => boundedText(code, 300)) ?? [],
        retrievalGaps: candidate.limitations.slice(0, 8)
          .map((limitation) => boundedText(limitation, 300)),
      };
    }),
    retrievalGaps: current.candidates.flatMap((candidate) => candidate.limitations)
      .slice(0, 20).map((limitation) => boundedText(limitation, 300)),
  };
  return { ...current, facts };
}

export function screen03HostSelectedEventId(state: Screen03VerificationState) {
  const selectedEventId = state.orientation?.current.selectedEventId ??
    state.history[0]?.targetId;
  if (!selectedEventId) {
    throw new Error("Screen 3 has no current selected-event identifier.");
  }
  return selectedEventId;
}

function screen03ClaimsForHost(state: Screen03VerificationState) {
  return screen03FactualClaims(state.proposals)
    .filter((claim) => claim.support !== "direct")
    .slice(0, 15);
}

export function screen03HostClaimGroupId(state: Screen03VerificationState) {
  const claimIds = screen03ClaimsForHost(state).map((claim) => claim.id).sort();
  if (claimIds.length === 0) {
    throw new HostReasoningRuntimeError(
      "claim-group-unavailable",
      "The current Screen 3 claims already have direct support or no mappable claim is available.",
    );
  }
  return `screen03-claims:${fingerprintHostReasoningValue(claimIds).slice(8)}`;
}

function screen03EvidenceForHost(state: Screen03VerificationState) {
  return state.evidence.filter((evidence) =>
    screen03EvidenceItemProvidesAuthoritativeDirectSupport(evidence)
  );
}

function screen03EvidenceFacts(state: Screen03VerificationState) {
  const claims = screen03ClaimsForHost(state);
  const claimIds = new Set(claims.map((claim) => claim.id));
  const evidence = screen03EvidenceForHost(state);
  const passages = evidence.flatMap((item) => item.passages.map((passage) => ({
    passageId: passage.id,
    sourceId: item.id,
    sourceAuthority: boundedText(item.publisher, 200),
    authorityTier: item.authorityTier,
    evidenceBasis: passage.basis,
    active: true as const,
    text: exactScreen03PassageFragment(passage.text, claims),
  }))).slice(0, 40);
  const includedPassageIds = new Set(passages.map((passage) => passage.passageId));
  const includedEvidence = evidence.filter((item) =>
    item.passages.some((passage) => includedPassageIds.has(passage.id))
  );
  return {
    facts: {
      claims: claims.map((claim) => ({
        claimId: claim.id,
        claimType: claim.group,
        label: boundedText(claim.label, 300),
        proposedValue: boundedText(
          claim.reviewStatus === "edited" ? claim.editedValue! : claim.value,
          1_000,
        ),
        currentEvidenceBasis: claim.support,
      })),
      passages,
      activeContradictions: state.contradictions
        .filter((contradiction) => contradiction.status === "unresolved")
        .map((contradiction) => ({
          contradictionId: contradiction.id,
          claimIds: contradiction.proposalIds
            .filter((claimId) => claimIds.has(claimId))
            .sort(),
          summary: boundedText(contradiction.summary, 400),
        }))
        .filter((contradiction) => contradiction.claimIds.length > 0)
        .slice(0, 80),
    },
    allowedSourceIds: includedEvidence.map((item) => item.id).sort(),
  };
}

function screen03OverviewFacts(state: Screen03VerificationState) {
  const supportedFacts = buildScreen03SupportedFacts(state).slice(0, 20);
  if (supportedFacts.length === 0) {
    throw new HostReasoningRuntimeError(
      "supported-facts-unavailable",
      "The optional overview requires at least one currently supported fact.",
    );
  }
  return {
    facts: {
      eventTitle: boundedText(state.eventIdentity.canonicalTitle, 300),
      eventType: boundedText(state.eventIdentity.eventType, 120),
      supportedFacts: supportedFacts.map((fact) => ({
        factId: fact.claimId,
        label: boundedText(fact.label, 200),
        value: boundedText(fact.value, 1_000),
        sourceIds: [...fact.evidenceIds].sort().slice(0, 10),
      })),
      explicitUncertainties: screen03FactualClaims(state.proposals)
        .flatMap((claim) => claim.uncertainty ? [claim.uncertainty] : [])
        .slice(0, 10).map((value) => boundedText(value, 400)),
    },
    allowedSourceIds: [...new Set(
      supportedFacts.flatMap((fact) => fact.evidenceIds),
    )].sort(),
  };
}

type CurrentRecords = {
  parent: Screen02WorkflowStoreRecord;
  screen02: Screen02WorkflowState;
  screen03: Screen03WorkflowStoreRecord;
  state: Screen03VerificationState;
};

const SCREEN03_HOST_EVIDENCE_APPLICATION_BINDING_SCHEMA_VERSION =
  "shockaudit-screen03-host-evidence-application-binding-v1" as const;
const SCREEN03_HOST_EVIDENCE_MAPPING_FINGERPRINT_PREFIX =
  "Host evidence mapping fingerprint: ";
const SCREEN03_HOST_EVIDENCE_APPLICATION_BINDING_PREFIX =
  "Host evidence application binding: ";
const SUPPORTED_FINGERPRINT_SOURCE =
  "(fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})";

function screen03EvidenceApplicationCoordinates(
  current: CurrentRecords,
): Screen03HostEvidenceApplicationCoordinates {
  const handoffProducerAppVersion = current.screen03.handoffProducerAppVersion;
  if (!handoffProducerAppVersion) {
    throw new HostReasoningRuntimeError(
      "stale-submission",
      "Screen 3 must be reopened before applying a host evidence mapping.",
    );
  }
  return {
    parent: {
      runId: current.parent.runId,
      generation: current.parent.generation,
      revision: current.parent.stateRevision,
      stateFingerprint: current.parent.stateFingerprint,
      expiresAt: current.parent.expiresAt,
    },
    predecessor: {
      generation: current.screen03.generation,
      revision: current.screen03.stateRevision,
      stateFingerprint: current.screen03.stateFingerprint,
      expiresAt: current.screen03.expiresAt,
      handoffProducerAppVersion,
    },
  };
}

function canonicalScreen03SourcePool(sourceIds: readonly string[]) {
  return [...new Set(sourceIds)].sort();
}

export function fingerprintScreen03HostEvidenceApplicationBinding(input: {
  task: HostReasoningTask;
  resultId: string;
  submissionFingerprint: string;
  applicationCoordinates: Screen03HostEvidenceApplicationCoordinates;
  allowedSourceIds: readonly string[];
  mappingFingerprint: string;
}) {
  const allowedSourceIds = canonicalScreen03SourcePool(input.allowedSourceIds);
  if (
    fingerprintHostReasoningValue(allowedSourceIds) !==
      input.task.sourcePoolFingerprint
  ) {
    throw new Error(
      "The Screen 3 application source pool does not match its frozen task.",
    );
  }
  return fingerprintHostReasoningValue({
    schemaVersion: SCREEN03_HOST_EVIDENCE_APPLICATION_BINDING_SCHEMA_VERSION,
    taskCoordinates: hostReasoningTaskCoordinates(input.task),
    resultId: input.resultId,
    taskInputFingerprint: input.task.inputFingerprint,
    submissionFingerprint: input.submissionFingerprint,
    applicationCoordinates: input.applicationCoordinates,
    claimGroupId: input.task.claimGroupId,
    sourcePoolFingerprint: input.task.sourcePoolFingerprint,
    allowedSourceIds,
    mappingFingerprint: input.mappingFingerprint,
  });
}

function fingerprintFromScreen03HostMarker(
  reason: string,
  prefix: string,
) {
  const match = new RegExp(
    `${prefix}${SUPPORTED_FINGERPRINT_SOURCE}\\.`,
  ).exec(reason);
  return match?.[1] ?? null;
}

function isScreen03HostEvidenceApplicationCoordinates(
  value: unknown,
): value is Screen03HostEvidenceApplicationCoordinates {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const parent = candidate.parent as Record<string, unknown> | undefined;
  const predecessor = candidate.predecessor as Record<string, unknown> | undefined;
  const fingerprint = (item: unknown) =>
    typeof item === "string" &&
    /^(?:fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})$/u.test(item);
  const timestamp = (item: unknown) =>
    typeof item === "string" &&
    Number.isFinite(Date.parse(item)) &&
    new Date(Date.parse(item)).toISOString() === item;
  return Boolean(
    parent && predecessor &&
      Object.keys(candidate).length === 2 &&
      Object.keys(parent).length === 5 &&
      Object.keys(predecessor).length === 5 &&
      typeof parent.runId === "string" &&
      Number.isSafeInteger(parent.generation) &&
      Number.isSafeInteger(parent.revision) &&
      fingerprint(parent.stateFingerprint) && timestamp(parent.expiresAt) &&
      Number.isSafeInteger(predecessor.generation) &&
      Number.isSafeInteger(predecessor.revision) &&
      fingerprint(predecessor.stateFingerprint) &&
      timestamp(predecessor.expiresAt) &&
      typeof predecessor.handoffProducerAppVersion === "string" &&
      predecessor.handoffProducerAppVersion.length > 0
  );
}

export type HostReasoningWorkflowRuntimeOptions = {
  taskStore: HostReasoningTaskStore;
  screen02Store: Screen02WorkflowStore;
  screen03Store: Screen03WorkflowStore;
  /** Current replacement workflow parent for default-off proof-only tasks. */
  sixScreenStore?: SixScreenWorkflowStore;
  signing: HostReasoningSigningConfig;
  now: () => string;
  createId?: (kind: "task" | "operation") => string;
  createWorkflowId?: (
    kind: "discovery-request" | "candidate-set" | "search-round" | "operation",
  ) => string;
  discoverScreen02Find: (
    state: Screen02FindState,
    input: {
      searchRoundId: string;
      at: string;
      exactRequest: string;
      maximumCandidates: number;
      queryPlanning: {
        origin: "chatgpt-host";
        queryTerms: string[];
        rationale: string;
        requestId: string;
        receiptId: string;
        officialSourceLeads: Screen02PoolHostOfficialSourceLead[];
        rankingAdjustments: Array<{
          candidateId: string;
          adjustment: number;
        }>;
        /** Search may use the enriched profile; qualification may not. */
        qualificationProfile: Screen02StudyRelevanceProfile;
        candidateReviewInfluenceById: Screen02CandidateReviewInfluenceMap;
      };
    },
  ) => Promise<Screen02FindDiscoveryResult & {
    verifiedOfficialSourceLeadCount?: number;
    hostQueryExecution?: Screen02HostReviewQueryExecution;
    officialSourceLeadAudit?: Screen02HostReviewOfficialSourceLeadAudit[];
  }>;
};

export function createHostReasoningWorkflowRuntime(
  options: HostReasoningWorkflowRuntimeOptions,
) {
  const createWorkflowId = options.createWorkflowId ?? ((kind) =>
    `host-${kind}:${crypto.randomUUID()}`);
  const readAuthenticatedScreen02 = async (runId: string, accessToken: string) => {
    const read = await options.screen02Store.read({ runId, accessToken });
    if (read.outcome !== "authenticated") {
      throw new HostReasoningRuntimeError(
        "task-access-denied",
        "The current Screen 2 run is unavailable or no longer authorized.",
      );
    }
    return { record: read.record, state: screen02StateFromRecord(read.record) };
  };

  const readTrustedScreen02 = async (runId: string) => {
    const read = await options.screen02Store.readTrusted({ runId });
    if (read.outcome !== "found") {
      throw new HostReasoningRuntimeError(
        "expired-submission",
        "The canonical Screen 2 workflow run expired before host-task validation.",
      );
    }
    return { record: read.record, state: screen02StateFromRecord(read.record) };
  };

  const readAuthenticatedSixScreen = async (
    runId: string,
    accessToken: string,
  ) => {
    if (!options.sixScreenStore) {
      throw new HostReasoningRuntimeError(
        "six-screen-proof-unavailable",
        "The six-screen intelligence-proof store is unavailable.",
      );
    }
    const read = await options.sixScreenStore.read({ runId, accessToken });
    if (read.outcome !== "found") {
      throw new HostReasoningRuntimeError(
        "task-access-denied",
        "The current six-screen run is unavailable or no longer authorized.",
      );
    }
    return read.record;
  };

  const readTrustedSixScreen = async (runId: string) => {
    if (!options.sixScreenStore) {
      throw new HostReasoningRuntimeError(
        "six-screen-proof-unavailable",
        "The six-screen intelligence-proof store is unavailable.",
      );
    }
    const read = await options.sixScreenStore.readTrusted(runId);
    if (read.outcome !== "found") {
      throw new HostReasoningRuntimeError(
        "expired-submission",
        "The canonical six-screen workflow expired before proof validation.",
      );
    }
    return read.record;
  };

  const sixScreenProofPolicy: HostReasoningTaskPolicy = {
    validate: async (input) => {
      try {
        const record = await readTrustedSixScreen(input.task.runId);
        if (record.stateFingerprint !== input.task.scopeFingerprint) {
          throw new Error("The six-screen workflow changed after proof preparation.");
        }
        const normalized = validateAndNormalizeSixScreenIntelligenceProof({
          task: input.task,
          currentState: record.state,
          boundedFacts: input.boundedFacts,
          proposal: input.proposal,
        });
        return {
          outcome: "accepted" as const,
          normalizedProposal: normalized,
          sourceIdsReferenced: normalized.sourceIdsReferenced,
        };
      } catch {
        return {
          outcome: "rejected" as const,
          failureCode: "six-screen-proof-validation-failed",
          failureExplanation:
            "The proof-only submission did not match the current frozen Event Card, source references, or bounded task rules.",
        };
      }
    },
    // The durable host-task proposal is the complete noncanonical proof result.
    // No six-screen scientific state, Event Card, or researcher decision is
    // mutated by this application step.
    apply: (input) => ({ appliedAt: input.observedAt }),
    recoverApplication: async (input) => {
      const record = await readTrustedSixScreen(input.task.runId);
      if (
        record.stateFingerprint !== input.task.scopeFingerprint ||
        input.task.submissionReceivedAt === null
      ) return null;
      const parsed = input.task.taskType === SIX_SCREEN_POLICY_FACT_PROOF_TASK
        ? sixScreenPolicyFactProofResultSchema.safeParse(
            input.normalizedProposal,
          )
        : sixScreenMechanismProofResultSchema.safeParse(
            input.normalizedProposal,
          );
      if (!parsed.success ||
          parsed.data.taskInputFingerprint !== input.task.inputFingerprint ||
          parsed.data.eventCardFingerprintInspected !==
            input.task.eventFingerprint ||
          parsed.data.sourcePoolFingerprintInspected !==
            input.task.sourcePoolFingerprint ||
          fingerprintHostReasoningValue(parsed.data.sourceIdsReferenced) !==
            fingerprintHostReasoningValue(input.sourceIdsReferenced)) {
        return null;
      }
      const current = buildSixScreenIntelligenceProofContext(
        record.state,
        input.task.taskType === SIX_SCREEN_POLICY_FACT_PROOF_TASK
          ? SIX_SCREEN_POLICY_FACT_PROOF_TASK
          : SIX_SCREEN_MECHANISM_PROOF_TASK,
      );
      return current.eventFingerprint === input.task.eventFingerprint
        ? { appliedAt: input.task.submissionReceivedAt }
        : null;
    },
  };

  const studyFirstHostPolicy: HostReasoningTaskPolicy = {
    validate: async (input) => {
      try {
        const record = await readTrustedSixScreen(input.task.runId);
        if (record.stateFingerprint !== input.task.scopeFingerprint) {
          throw new Error(
            "The six-screen workflow changed after task preparation.",
          );
        }
        const normalized = validateAndNormalizeStudyFirstHostResult({
          task: input.task,
          currentState: record.state,
          boundedFacts: input.boundedFacts,
          proposal: input.proposal,
        });
        return {
          outcome: "accepted" as const,
          normalizedProposal: normalized,
          sourceIdsReferenced: input.proposedSourceIdsReferenced,
        };
      } catch {
        return {
          outcome: "rejected" as const,
          failureCode: "study-first-host-validation-failed",
          failureExplanation:
            "The structured host result did not match the current frozen study, selected evidence packet, source boundary, or conditional reasoning rules.",
        };
      }
    },
    // Host synthesis stays in the signed task store. It never mutates a
    // scientific input, classification, or researcher decision.
    apply: (input) => ({ appliedAt: input.observedAt }),
    recoverApplication: async (input) => {
      const record = await readTrustedSixScreen(input.task.runId);
      if (
        record.stateFingerprint !== input.task.scopeFingerprint ||
        input.task.submissionReceivedAt === null ||
        !isStudyFirstHostTask(input.task.taskType)
      ) return null;
      const parsed = input.task.taskType ===
          SCREEN04_STUDY_EVENT_ASSESSMENT_TASK
        ? screen04StudyEventAssessmentResultSchema.safeParse(
            input.normalizedProposal,
          )
        : input.task.taskType === SCREEN05_THEORETICAL_PLANNING_TASK
          ? screen05TheoreticalPlanningResultSchema.safeParse(
              input.normalizedProposal,
            )
        : screen05StudyMechanismComparisonResultSchema.safeParse(
            input.normalizedProposal,
          );
      if (!parsed.success ||
          parsed.data.taskInputFingerprint !== input.task.inputFingerprint ||
          parsed.data.sourcePoolFingerprintInspected !==
            input.task.sourcePoolFingerprint) {
        return null;
      }
      if (input.task.taskType === SCREEN04_STUDY_EVENT_ASSESSMENT_TASK &&
          (!("eventFingerprintInspected" in parsed.data) ||
            parsed.data.eventFingerprintInspected !== input.task.eventFingerprint)) {
        return null;
      }
      if (input.task.taskType === SCREEN05_STUDY_MECHANISM_COMPARISON_TASK &&
          (!("mechanismRunFingerprintInspected" in parsed.data) ||
            parsed.data.mechanismRunFingerprintInspected !==
              input.task.eventFingerprint)) {
        return null;
      }
      if (input.task.taskType === SCREEN05_THEORETICAL_PLANNING_TASK &&
          (!("problemFingerprintInspected" in parsed.data) ||
            parsed.data.problemFingerprintInspected !==
              (input.boundedFacts as {
                theoreticalProblem?: { problemFingerprint?: string };
              }).theoreticalProblem?.problemFingerprint)) {
        return null;
      }
      const current = buildStudyFirstHostTaskContext(
        record.state,
        input.task.taskType,
        input.task.selectedEventId,
      );
      return current.eventFingerprint === input.task.eventFingerprint
        ? { appliedAt: input.task.submissionReceivedAt }
        : null;
    },
  };

  const readCurrentScreen03 = async (runId: string): Promise<CurrentRecords> => {
    const parent = await readTrustedScreen02(runId);
    const child = await options.screen03Store.read(runId);
    if (child.outcome !== "found") {
      throw new HostReasoningRuntimeError(
        "expired-submission",
        "The canonical Screen 3 workflow run expired before host-task validation.",
      );
    }
    const state = requireScreen03VerificationState(child.record.state);
    if (
      child.record.parentStateFingerprint !== parent.record.stateFingerprint ||
      child.record.expiresAt !== parent.record.expiresAt ||
      state.runId !== runId ||
      state.revision !== child.record.stateRevision ||
      fingerprintScreen03VerificationState(state) !==
        child.record.stateFingerprint
    ) {
      throw new HostReasoningRuntimeError(
        "stale-submission",
        "Screen 3 no longer matches its canonical Screen 2 parent.",
      );
    }
    return {
      parent: parent.record,
      screen02: parent.state,
      screen03: child.record,
      state,
    };
  };

  const screen02Policy = createScreen02SearchReviewPolicy({
    loadCurrent: async (task): Promise<AuthoritativeScreen02HostReviewContext> => {
      const current = await readTrustedScreen02(task.runId);
      if (current.state.mode !== "find") {
        throw new HostReasoningRuntimeError(
          "wrong-input",
          "The current Screen 2 workflow no longer contains the frozen Find input.",
        );
      }
      const context = screen02HostContext(current.state);
      return {
        runId: task.runId,
        candidatePoolId: context.set.candidateSetSnapshotId,
        candidatePoolFingerprint: context.set.candidateSetFingerprint,
        scopeFingerprint: current.state.screen01Fingerprint,
        profile: context.profile,
        candidates: context.candidateContexts,
        rankings: context.candidates.map((candidate) => ({
          candidateId: candidate.candidateSnapshotId,
          classification: candidate.qualification?.classification ?? "mismatch",
          eligible: candidate.qualification?.eligible ?? false,
          baseScore: candidate.qualification?.ranking.baseScore ?? 0,
        })),
      };
    },
    applyValidated: async (input) => {
      const current = await readTrustedScreen02(input.task.runId);
      if (current.state.mode !== "find") throw new Error("Find state required.");
      const currentFindState = current.state;
      if (Date.parse(input.observedAt) < Date.parse(current.state.updatedAt)) {
        throw new Error("The Screen 2 state advanced after this host submission.");
      }

      const profileUpdatedAt = timestampStrictlyAfter(
        current.state.updatedAt,
        input.observedAt,
        options.now(),
      );

      // Host additions are search vocabulary, never candidate facts. Apply
      // them to an in-memory successor first, run exactly one bounded source
      // retrieval through the ordinary fixed pipeline, and commit both pieces
      // together under the exact parent CAS coordinates.
      const searchState = requireScreen02WorkflowState({
        ...structuredClone(current.state),
        relevanceProfile: {
          ...structuredClone(input.result.enrichedProfile),
          updatedAt: profileUpdatedAt,
        },
        updatedAt: profileUpdatedAt,
      });
      if (searchState.mode !== "find") throw new Error("Find state required.");
      const discoveryRequestId = createWorkflowId("discovery-request");
      const candidateSetSnapshotId = createWorkflowId("candidate-set");
      const searchRoundId = createWorkflowId("search-round");
      const queryTerms = [...input.result.review.followUpQueries];
      const exactRequest = boundedText(
        queryTerms.length > 0
          ? `Optional ChatGPT review follow-up: ${queryTerms.join("; ")}`
          : "Optional ChatGPT review follow-up using the enriched study relevance profile.",
        1_900,
      );
      const candidateReviewInfluenceById =
        screen02CanonicalCandidateReviewInfluenceById(
          currentFindState.candidates,
          input.result.review.candidateReviews,
        );
      // Host-visible candidate handles are immutable snapshot ids. The
      // discovery/ranking layer keys proposals by canonical candidate id, so
      // translate only after the receipt has been rebound to the current
      // active pool by the policy.
      const canonicalRankingAdjustmentById = new Map<string, number>();
      for (const ranking of input.result.rankings) {
          const candidate = currentFindState.candidates.find(
            (item) => item.candidateSnapshotId === ranking.candidateId,
          );
          if (!candidate) {
            throw new Error(
              "The validated host ranking references a stale candidate snapshot.",
            );
          }
          if (canonicalRankingAdjustmentById.has(candidate.candidateId)) {
            throw new Error(
              "Two host ranking snapshots resolve to the same canonical candidate.",
            );
          }
          canonicalRankingAdjustmentById.set(
            candidate.candidateId,
            ranking.rankingAdjustment,
          );
      }
      const canonicalRankingAdjustments = [
        ...canonicalRankingAdjustmentById,
      ].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(([candidateId, adjustment]) => ({ candidateId, adjustment }));
      const discovery = await options.discoverScreen02Find(searchState, {
        searchRoundId,
        at: profileUpdatedAt,
        exactRequest,
        maximumCandidates: SCREEN_02_FIND_MAX_VISIBLE_CANDIDATES,
        queryPlanning: {
          origin: "chatgpt-host",
          queryTerms,
          rationale: input.result.review.conciseRationale,
          requestId: input.task.taskId,
          receiptId: input.resultId,
          officialSourceLeads: structuredClone(
            input.result.review.officialSourceLeads,
          ),
          rankingAdjustments: canonicalRankingAdjustments,
          qualificationProfile: structuredClone(input.current.profile),
          candidateReviewInfluenceById,
        },
      });
      const appliedAt = timestampStrictlyAfter(
        profileUpdatedAt,
        discovery.manifest.retrievedAt,
        options.now(),
      );
      if (Date.parse(appliedAt) >= Date.parse(input.task.expiresAt)) {
        throw new Error(
          "The Screen 2 host task expired before its bounded retrieval could be applied.",
        );
      }
      if (!discovery.hostQueryExecution || !discovery.officialSourceLeadAudit) {
        throw new Error(
          "The Screen 2 host retrieval omitted its query or official-lead audit.",
        );
      }
      const hostQueryExecution = structuredClone(
        discovery.hostQueryExecution,
      );
      const officialSourceLeadAudit = structuredClone(
        discovery.officialSourceLeadAudit,
      );
      const officialSourceLeads = structuredClone(
        input.result.review.officialSourceLeads,
      );
      const verifiedOfficialSourceLeadCount = officialSourceLeadAudit.filter(
        (lead) => lead.verificationStatus === "verified",
      ).length;
      const discoverySourceById = new Map(
        discovery.sources.map((source) => [source.id, source]),
      );
      const sourceAuditIsExact = officialSourceLeadAudit.every((lead) => {
        if (lead.resultingSourceStatus === "persisted") {
          const source = lead.resultingSourceId === null
            ? undefined
            : discoverySourceById.get(lead.resultingSourceId);
          return source !== undefined &&
            source.sourceFingerprint === lead.resultingSourceFingerprint;
        }
        return lead.resultingSourceStatus !== "not-retained" ||
          lead.resultingSourceId === null ||
          !discoverySourceById.has(lead.resultingSourceId);
      });
      if (
        officialSourceLeadAudit.length !==
          officialSourceLeads.length ||
        verifiedOfficialSourceLeadCount !==
          (discovery.verifiedOfficialSourceLeadCount ?? 0) ||
        !sourceAuditIsExact
      ) {
        throw new Error(
          "The Screen 2 official-source lead audit does not match retrieval.",
        );
      }
      const profileAdditions = structuredClone(
        input.result.review.profileAdditions,
      );
      const profileAdditionCount = Object.values(profileAdditions).reduce(
        (total, additions) => total + additions.length,
        0,
      );
      const candidateReviews = structuredClone(
        input.result.review.candidateReviews,
      );
      const rankingAdjustments = canonicalRankingAdjustments.filter(
        (ranking) => ranking.adjustment !== 0,
      );
      const applicationWithoutFingerprint: Omit<
        Screen02HostReviewApplication,
        "applicationFingerprint"
      > = {
        schemaVersion: SCREEN_02_HOST_REVIEW_APPLICATION_SCHEMA_VERSION,
        taskId: input.task.taskId,
        resultId: input.resultId,
        resultOrigin: "chatgpt-host",
        taskInputFingerprint: input.task.inputFingerprint,
        submissionFingerprint: input.submissionFingerprint,
        originalCandidatePoolId: input.current.candidatePoolId,
        originalCandidatePoolFingerprint:
          input.current.candidatePoolFingerprint,
        successorCandidatePoolId: candidateSetSnapshotId,
        priorProfileFingerprint: fingerprintScreen02WorkflowValue(
          input.current.profile,
        ),
        profileAdditions,
        profileAdditionsFingerprint: fingerprintScreen02WorkflowValue(
          profileAdditions,
        ),
        profileAdditionCount,
        appliedProfileFingerprint: fingerprintScreen02WorkflowValue(
          searchState.relevanceProfile,
        ),
        candidateReviewsFingerprint: fingerprintScreen02WorkflowValue(
          candidateReviews,
        ),
        candidateReviewCount: candidateReviews.length,
        followUpQueriesFingerprint: fingerprintScreen02WorkflowValue(
          hostQueryExecution.submittedTerms,
        ),
        appliedAt,
        followUpQueryCount: queryTerms.length,
        hostQueryExecution,
        hostQueryExecutionFingerprint: fingerprintScreen02WorkflowValue(
          hostQueryExecution,
        ),
        proposedOfficialSourceLeadCount: officialSourceLeads.length,
        verifiedOfficialSourceLeadCount,
        officialSourceLeadsFingerprint: fingerprintScreen02WorkflowValue(
          officialSourceLeads,
        ),
        officialSourceLeadAudit,
        officialSourceLeadAuditFingerprint: fingerprintScreen02WorkflowValue(
          officialSourceLeadAudit,
        ),
        rankingAdjustmentCount: rankingAdjustments.length,
        rankingAdjustments,
        rankingAdjustmentsFingerprint: fingerprintScreen02WorkflowValue(
          rankingAdjustments,
        ),
        validatedRetrievalContributionCount:
          hostQueryExecution.executedTerms.length +
          verifiedOfficialSourceLeadCount,
        outcomeValuesInspected: false,
      };
      const hostReviewApplication: Screen02HostReviewApplication = {
        ...applicationWithoutFingerprint,
        applicationFingerprint: fingerprintScreen02WorkflowValue(
          applicationWithoutFingerprint,
        ),
      };
      const appliedDiscovery: Screen02FindDiscoveryResult = {
        ...discovery,
        manifest: {
          ...discovery.manifest,
          retrievedAt: appliedAt,
          hostReviewApplication,
        },
      };
      // The validated additions and their scope/prompt/input-bound cache entry
      // become canonical with the successor pool. Qualification for this one
      // application remains bound to the pre-host profile supplied above;
      // later retrieval can inspect and reuse the canonical enriched profile.
      const searching = beginScreen02FindDiscovery(searchState, {
        discoveryRequestId,
        candidateSetSnapshotId,
        searchRoundId,
        at: profileUpdatedAt,
        exactRequest,
      });
      const next = completeScreen02FindDiscovery(searching, {
        discoveryRequestId,
        at: appliedAt,
        ...appliedDiscovery,
      });
      const pendingChildCascade = {
        kind: "screen03-stale-after-host-review" as const,
        runId: current.record.runId,
        originatingTaskId: input.task.taskId,
      };
      const update = await options.screen02Store.updateTrusted({
        runId: current.record.runId,
        expected: {
          generation: current.record.generation,
          revision: current.record.stateRevision,
          stateFingerprint: current.record.stateFingerprint,
        },
        operationId: createWorkflowId("operation"),
        operationKind: "host-screen02-search-review",
        mutate: async () => ({
          stateEnvelope: encodeScreen02FindWorkflowStateEnvelope(next),
          bufferedReceipts: current.record.bufferedReceipts,
          updatedAt: next.updatedAt,
          replayResult: {
            resultId: input.resultId,
            candidateSetSnapshotId,
            stateFingerprint: fingerprintScreen02WorkflowState(next),
          },
          markPendingChildCascade: {
            kind: pendingChildCascade.kind,
            originatingTaskId: pendingChildCascade.originatingTaskId,
          },
        }),
      });
      if (update.outcome !== "updated" && update.outcome !== "replayed") {
        throw new Error("Screen 2 changed while applying its optional host review.");
      }
      // A canonical parent change makes any already-opened Screen 3 child
      // stale. Normal product flow requests this review before continuation,
      // but retire defensively so no sibling state can survive a parent
      // fingerprint change. The parent transaction already persisted a retry
      // marker; acknowledge it only after retirement succeeds. A transient
      // child-store or acknowledgement failure deliberately leaves the marker
      // for the Durable Object cleanup/alarm drain.
      try {
        await options.screen03Store.retire(current.record.runId);
        const hostRetirement = await options.taskStore.retireRunTaskTypes(
          current.record.runId,
          ["screen03-evidence-mapping", "screen03-overview-improvement"],
        );
        if (!hostRetirement.batchLimitReached) {
          await options.screen02Store.acknowledgePendingChildCascade?.(
            current.record.runId,
            pendingChildCascade,
          );
        }
      } catch {
        // Durable retry state is the pending child-cascade marker written by
        // updateTrusted above. Do not turn an already-committed parent CAS
        // into a false application failure.
      }
      return { appliedAt };
    },
    recoverApplication: async (input) => {
      const current = await readTrustedScreen02(input.task.runId);
      if (
        current.state.mode !== "find" ||
        input.task.taskType !== "screen02-search-review" ||
        input.task.candidatePoolId === null ||
        input.task.candidatePoolFingerprint === null
      ) return null;
      const currentFindState = current.state;
      const matches = currentFindState.candidateSets.filter((candidateSet) => {
        const application = candidateSet.manifest.hostReviewApplication;
        if (!isScreen02HostReviewApplication(application)) return false;
        const predecessor = currentFindState.candidateSets.find((candidate) =>
          candidate.candidateSetSnapshotId ===
            application.originalCandidatePoolId
        );
        return application.taskId === input.task.taskId &&
          application.resultId === input.resultId &&
          application.taskInputFingerprint === input.task.inputFingerprint &&
          application.submissionFingerprint === input.submissionFingerprint &&
          application.originalCandidatePoolId === input.task.candidatePoolId &&
          application.originalCandidatePoolFingerprint ===
            input.task.candidatePoolFingerprint &&
          predecessor?.candidateSetFingerprint ===
            application.originalCandidatePoolFingerprint &&
          application.successorCandidatePoolId ===
            candidateSet.candidateSetSnapshotId &&
          application.appliedAt === candidateSet.manifest.retrievedAt;
      });
      return matches.length === 1
        ? { appliedAt: matches[0]!.manifest.hostReviewApplication!.appliedAt }
        : null;
    },
  });

  const screen03EvidencePolicy = createScreen03EvidenceMappingPolicy({
    loadCurrent: async (task): Promise<AuthoritativeScreen03EvidenceContext> => {
      const current = await readCurrentScreen03(task.runId);
      const evidence = screen03EvidenceFacts(current.state);
      return {
        scopeFingerprint: current.parent.screen01Fingerprint,
        selectedEventId: screen03HostSelectedEventId(current.state),
        claimGroupId: screen03HostClaimGroupId(current.state),
        allowedSourceIds: evidence.allowedSourceIds,
        state: current.state,
        applicationCoordinates: screen03EvidenceApplicationCoordinates(current),
      };
    },
    applyValidated: async (input) => {
      const coordinates = input.current.applicationCoordinates;
      const applicationBindingFingerprint =
        fingerprintScreen03HostEvidenceApplicationBinding({
          task: input.task,
          resultId: input.resultId,
          submissionFingerprint: input.submissionFingerprint,
          applicationCoordinates: coordinates,
          allowedSourceIds: input.current.allowedSourceIds,
          mappingFingerprint: input.result.mappingFingerprint,
        });
      const integrated = integrateScreen03HostEvidenceMappings(
        input.current.state,
        input.result.mappings,
        {
          claimGroupId: input.current.claimGroupId,
          resultId: input.resultId,
          at: input.observedAt,
          applicationBindingFingerprint,
        },
      );
      if (integrated.duplicate) return;
      const update = await options.screen03Store.update({
        parentRunId: coordinates.parent.runId,
        parentStateFingerprint: coordinates.parent.stateFingerprint,
        handoffProducerAppVersion:
          coordinates.predecessor.handoffProducerAppVersion,
        parentGuard: {
          runId: coordinates.parent.runId,
          generation: coordinates.parent.generation,
          revision: coordinates.parent.revision,
          stateFingerprint: coordinates.parent.stateFingerprint,
          expiresAt: coordinates.parent.expiresAt,
        },
        expected: {
          generation: coordinates.predecessor.generation,
          revision: coordinates.predecessor.revision,
          stateFingerprint: coordinates.predecessor.stateFingerprint,
        },
        state: integrated.state,
        expiresAt: coordinates.predecessor.expiresAt,
      });
      if (update.outcome !== "updated") {
        throw new Error("Screen 3 changed while applying the host evidence mapping.");
      }
    },
    recoverApplication: async (input) => {
      const current = await readCurrentScreen03(input.task.runId);
      const result = input.normalizedProposal as
        Partial<ValidatedScreen03HostEvidenceResult>;
      if (
        input.task.taskType !== "screen03-evidence-mapping" ||
        input.task.selectedEventId === null ||
        input.task.claimGroupId === null ||
        input.task.scopeFingerprint !== current.parent.screen01Fingerprint ||
        input.task.selectedEventId !==
          screen03HostSelectedEventId(current.state) ||
        input.task.eventFingerprint !== current.state.upstream.eventFingerprint ||
        result.schemaVersion !== "shockaudit-screen03-host-evidence-result-v1" ||
        result.origin !== "chatgpt-host" || result.nonCanonical !== true ||
        result.outcomeValuesInspected !== false ||
        !Array.isArray(result.mappings) ||
        !Array.isArray(result.sourceIdsReferenced) ||
        typeof result.stateFingerprintInspected !== "string" ||
        typeof result.sourcePoolFingerprintInspected !== "string" ||
        typeof result.mappingFingerprint !== "string" ||
        !isScreen03HostEvidenceApplicationCoordinates(
          result.applicationCoordinatesInspected,
        )
      ) return null;
      const coordinates = result.applicationCoordinatesInspected;
      const facts = screen03EvidenceMappingTaskFactsSchema.safeParse(
        input.boundedFacts,
      );
      if (!facts.success) return null;
      const allowedSourceIds = canonicalScreen03SourcePool(
        facts.data.passages.map((passage) => passage.sourceId),
      );
      let mappingFingerprint: string;
      let applicationBindingFingerprint: string;
      try {
        mappingFingerprint = fingerprintScreen03HostEvidenceMappings(
          result.mappings,
        );
        applicationBindingFingerprint =
          fingerprintScreen03HostEvidenceApplicationBinding({
            task: input.task,
            resultId: input.resultId,
            submissionFingerprint: input.submissionFingerprint,
            applicationCoordinates: coordinates,
            allowedSourceIds,
            mappingFingerprint,
          });
      } catch {
        return null;
      }
      if (
        result.stateFingerprintInspected !==
          coordinates.predecessor.stateFingerprint ||
        result.sourcePoolFingerprintInspected !==
          input.task.sourcePoolFingerprint ||
        result.mappingFingerprint !== mappingFingerprint ||
        fingerprintHostReasoningValue(result.sourceIdsReferenced) !==
          fingerprintHostReasoningValue(input.sourceIdsReferenced) ||
        coordinates.parent.runId !== current.parent.runId ||
        coordinates.parent.generation !== current.parent.generation ||
        coordinates.parent.revision !== current.parent.stateRevision ||
        coordinates.parent.stateFingerprint !==
          current.parent.stateFingerprint ||
        coordinates.parent.expiresAt !== current.parent.expiresAt ||
        coordinates.predecessor.expiresAt !== current.screen03.expiresAt ||
        coordinates.predecessor.handoffProducerAppVersion !==
          current.screen03.handoffProducerAppVersion ||
        current.screen03.generation < coordinates.predecessor.generation + 1 ||
        current.screen03.stateRevision < coordinates.predecessor.revision + 1
      ) return null;
      const matches = current.state.history
        .map((event, index) => ({ event, index }))
        .filter(({ event, index }) =>
          index === coordinates.predecessor.revision + 1 &&
          event.action === "host-evidence-mapping-applied" &&
          event.actor === "chatgpt-host" &&
          event.targetId === input.task.claimGroupId &&
          event.value === input.resultId &&
          fingerprintFromScreen03HostMarker(
            event.reason,
            SCREEN03_HOST_EVIDENCE_MAPPING_FINGERPRINT_PREFIX,
          ) === mappingFingerprint &&
          fingerprintFromScreen03HostMarker(
            event.reason,
            SCREEN03_HOST_EVIDENCE_APPLICATION_BINDING_PREFIX,
          ) === applicationBindingFingerprint
        );
      return matches.length === 1
        ? { appliedAt: matches[0]!.event.at }
        : null;
    },
  });

  const screen03OverviewPolicy = createScreen03OverviewPolicy({
    loadCurrent: async (task): Promise<AuthoritativeScreen03OverviewContext> => {
      const current = await readCurrentScreen03(task.runId);
      const overview = screen03OverviewFacts(current.state);
      return {
        scopeFingerprint: current.parent.screen01Fingerprint,
        selectedEventId: screen03HostSelectedEventId(current.state),
        allowedSourceIds: overview.allowedSourceIds,
        state: current.state,
      };
    },
    validateWording: ({ boundedFacts, proposal }) => {
      const significant = new Set([
        boundedFacts.eventTitle,
        boundedFacts.eventType,
        ...boundedFacts.supportedFacts.flatMap((fact) => [fact.label, fact.value]),
      ].join(" ").normalize("NFKC").toLocaleLowerCase("en-US")
        .match(/[\p{L}\p{N}]{4,}/gu) ?? []);
      const hasGrounding = (text: string) =>
        (text.normalize("NFKC").toLocaleLowerCase("en-US")
          .match(/[\p{L}\p{N}]{4,}/gu) ?? [])
          .some((token) => significant.has(token));
      return hasGrounding(proposal.summary) &&
        proposal.keyPoints.every(hasGrounding) &&
        !/\b(?:proved?|guarantees?|certainly|caused?|causal effect)\b/iu.test(
          [proposal.summary, ...proposal.keyPoints].join(" "),
        );
    },
    // Optional prose remains a noncanonical task result and cannot replace
    // Screen 3's guaranteed fixed orientation or verified Event Card fields.
    applyValidated: () => undefined,
    recoverApplication: async (input) => {
      const current = await readCurrentScreen03(input.task.runId);
      const result = input.normalizedProposal as
        Partial<ValidatedScreen03HostOverviewResult>;
      if (
        input.task.taskType !== "screen03-overview-improvement" ||
        input.task.selectedEventId === null ||
        input.task.claimGroupId !== null ||
        input.task.scopeFingerprint !== current.parent.screen01Fingerprint ||
        input.task.selectedEventId !==
          screen03HostSelectedEventId(current.state) ||
        input.task.eventFingerprint !== current.state.upstream.eventFingerprint ||
        result.schemaVersion !==
          "shockaudit-screen03-host-overview-result-v1" ||
        result.origin !== "chatgpt-host" || result.nonCanonical !== true ||
        result.outcomeValuesInspected !== false ||
        result.stateFingerprintInspected !==
          fingerprintScreen03VerificationState(current.state) ||
        fingerprintHostReasoningValue(result.sourceIds ?? []) !==
          fingerprintHostReasoningValue(input.sourceIdsReferenced)
      ) return null;
      return input.task.submissionReceivedAt === null
        ? null
        : { appliedAt: input.task.submissionReceivedAt };
    },
  });

  const freezeTask = async (
    input: HostReasoningPrepareInput,
  ): Promise<HostReasoningFrozenTask> => {
    if (
      input.taskType === SCREEN05_THEORETICAL_PLANNING_TASK ||
      input.taskType === SCREEN05_STUDY_MECHANISM_COMPARISON_TASK
    ) {
      throw new HostReasoningRuntimeError(
        "screen5-host-route-retired",
        "Screen 5 host reasoning is retired; the local workflow uses its OpenAI-only direct job.",
      );
    }
    if (isStudyFirstHostTask(input.taskType)) {
      const record = await readTrustedSixScreen(input.runId);
      const frozen = buildStudyFirstHostTaskContext(
        record.state,
        input.taskType,
        input.selectedEventId,
      );
      return {
        taskType: input.taskType,
        runId: input.runId,
        candidatePoolId: null,
        selectedEventId: frozen.selectedEventId,
        claimGroupId: null,
        scopeFingerprint: record.stateFingerprint,
        candidatePoolFingerprint: null,
        eventFingerprint: frozen.eventFingerprint,
        boundedFacts: frozen.facts,
        allowedSourceIds: frozen.allowedSourceIds,
        promptVersion: input.taskType ===
            SCREEN04_STUDY_EVENT_ASSESSMENT_TASK
          ? SCREEN04_STUDY_EVENT_ASSESSMENT_PROMPT_VERSION
          : input.taskType === SCREEN05_THEORETICAL_PLANNING_TASK
            ? SCREEN05_THEORETICAL_PLANNING_PROMPT_VERSION
            : SCREEN05_STUDY_MECHANISM_COMPARISON_PROMPT_VERSION,
        workflowVersion: SHOCKAUDIT_HOST_TASK_WORKFLOW_VERSION,
        appVersion: SHOCKAUDIT_VERSION,
        uiResourceUri: SHOCKAUDIT_UI_RESOURCE_URI,
        parentGuard: {
          parentKind: "six-screen",
          runId: record.runId,
          generation: record.generation,
          revision: record.state.revision,
          stateFingerprint: record.stateFingerprint,
          expiresAt: record.expiresAt,
        },
      };
    }
    if (isSixScreenIntelligenceProofTask(input.taskType)) {
      const record = await readTrustedSixScreen(input.runId);
      const proof = buildSixScreenIntelligenceProofContext(
        record.state,
        input.taskType,
      );
      return {
        taskType: input.taskType,
        runId: input.runId,
        candidatePoolId: null,
        selectedEventId: proof.selectedEventId,
        claimGroupId: null,
        scopeFingerprint: record.stateFingerprint,
        candidatePoolFingerprint: null,
        eventFingerprint: proof.eventFingerprint,
        boundedFacts: proof.facts,
        allowedSourceIds: proof.allowedSourceIds,
        promptVersion: input.taskType === SIX_SCREEN_POLICY_FACT_PROOF_TASK
          ? SIX_SCREEN_POLICY_FACT_PROOF_PROMPT_VERSION
          : SIX_SCREEN_MECHANISM_PROOF_PROMPT_VERSION,
        workflowVersion: SHOCKAUDIT_HOST_TASK_WORKFLOW_VERSION,
        appVersion: SHOCKAUDIT_VERSION,
        uiResourceUri: SHOCKAUDIT_UI_RESOURCE_URI,
        parentGuard: {
          parentKind: "six-screen",
          runId: record.runId,
          generation: record.generation,
          revision: record.state.revision,
          stateFingerprint: record.stateFingerprint,
          expiresAt: record.expiresAt,
        },
      };
    }
    const parent = await readTrustedScreen02(input.runId);
    if (input.taskType === "screen02-search-review") {
      if (parent.state.mode !== "find") throw new Error("Find state required.");
      if (
        parent.state.candidateSets.some(
          (candidateSet) =>
            candidateSet.manifest.hostReviewApplication !== undefined,
        )
      ) {
        throw new HostReasoningRuntimeError(
          "screen02-host-review-already-applied",
          "This Screen 2 search lineage already used its one optional host review and additional retrieval round.",
        );
      }
      const frozen = screen02FrozenFacts(parent.state);
      return {
        taskType: input.taskType,
        runId: input.runId,
        candidatePoolId: frozen.set.candidateSetSnapshotId,
        selectedEventId: null,
        claimGroupId: null,
        scopeFingerprint: parent.state.screen01Fingerprint,
        candidatePoolFingerprint: frozen.set.candidateSetFingerprint,
        eventFingerprint: null,
        boundedFacts: frozen.facts,
        allowedSourceIds: [...new Set(
          frozen.candidateContexts.flatMap((candidate) =>
            candidate.sources.map((source) => source.sourceId)
          ),
        )].sort(),
        promptVersion: SCREEN02_HOST_SEARCH_REVIEW_PROMPT_VERSION,
        workflowVersion: SHOCKAUDIT_HOST_TASK_WORKFLOW_VERSION,
        appVersion: SHOCKAUDIT_VERSION,
        uiResourceUri: SHOCKAUDIT_UI_RESOURCE_URI,
        parentGuard: {
          runId: parent.record.runId,
          generation: parent.record.generation,
          revision: parent.record.stateRevision,
          stateFingerprint: parent.record.stateFingerprint,
          expiresAt: parent.record.expiresAt,
        },
      };
    }
    const current = await readCurrentScreen03(input.runId);
    const selectedEventId = screen03HostSelectedEventId(current.state);
    if (input.taskType === "screen03-evidence-mapping") {
      const evidence = screen03EvidenceFacts(current.state);
      return {
        taskType: input.taskType,
        runId: input.runId,
        candidatePoolId: null,
        selectedEventId,
        claimGroupId: screen03HostClaimGroupId(current.state),
        scopeFingerprint: current.parent.screen01Fingerprint,
        candidatePoolFingerprint: null,
        eventFingerprint: current.state.upstream.eventFingerprint,
        boundedFacts: evidence.facts,
        allowedSourceIds: evidence.allowedSourceIds,
        promptVersion: SCREEN03_HOST_EVIDENCE_MAPPING_PROMPT_VERSION,
        workflowVersion: SHOCKAUDIT_HOST_TASK_WORKFLOW_VERSION,
        appVersion: SHOCKAUDIT_VERSION,
        uiResourceUri: SHOCKAUDIT_UI_RESOURCE_URI,
        parentGuard: {
          runId: current.parent.runId,
          generation: current.parent.generation,
          revision: current.parent.stateRevision,
          stateFingerprint: current.parent.stateFingerprint,
          expiresAt: current.parent.expiresAt,
        },
      };
    }
    const overview = screen03OverviewFacts(current.state);
    return {
      taskType: input.taskType,
      runId: input.runId,
      candidatePoolId: null,
      selectedEventId,
      claimGroupId: null,
      scopeFingerprint: current.parent.screen01Fingerprint,
      candidatePoolFingerprint: null,
      eventFingerprint: current.state.upstream.eventFingerprint,
      boundedFacts: overview.facts,
      allowedSourceIds: overview.allowedSourceIds,
      promptVersion: SCREEN03_HOST_OVERVIEW_PROMPT_VERSION,
      workflowVersion: SHOCKAUDIT_HOST_TASK_WORKFLOW_VERSION,
      appVersion: SHOCKAUDIT_VERSION,
      uiResourceUri: SHOCKAUDIT_UI_RESOURCE_URI,
      parentGuard: {
        runId: current.parent.runId,
        generation: current.parent.generation,
        revision: current.parent.stateRevision,
        stateFingerprint: current.parent.stateFingerprint,
        expiresAt: current.parent.expiresAt,
      },
    };
  };

  return new HostReasoningTaskRuntime({
    store: options.taskStore,
    signing: options.signing,
    now: options.now,
    createId: options.createId ?? ((kind) =>
      `host-${kind}:${crypto.randomUUID()}`),
    authorizeTaskAccess: async (input) => {
      if (input.runId.startsWith("sa6r_")) {
        await readAuthenticatedSixScreen(input.runId, input.accessToken);
      } else {
        await readAuthenticatedScreen02(input.runId, input.accessToken);
      }
      if (input.taskId !== null) {
        const task = await options.taskStore.read(input.taskId);
        if (task.outcome === "not-found" || task.record.task.runId !== input.runId) {
          throw new HostReasoningRuntimeError(
            "task-access-denied",
            "The host task is unavailable for this run.",
          );
        }
      }
    },
    freezeTask,
    policies: {
      "screen02-search-review": screen02Policy,
      "screen03-evidence-mapping": screen03EvidencePolicy,
      "screen03-overview-improvement": screen03OverviewPolicy,
      "six-screen-policy-fact-proof": sixScreenProofPolicy,
      "six-screen-mechanism-proof": sixScreenProofPolicy,
      "screen04-study-event-assessment": studyFirstHostPolicy,
      "screen05-theoretical-planning": studyFirstHostPolicy,
      "screen05-study-mechanism-comparison": studyFirstHostPolicy,
    },
  });
}
