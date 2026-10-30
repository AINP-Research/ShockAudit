import {
  applyReviewedScreen02AuditDiscovery,
  buildReviewedScreen02AuditDiscovery,
  type Screen02AuditDiscoveryResult,
} from "../core/screen02-audit-discovery";
import {
  applyScreen02AuditMatchRound,
  applyScreen02AuditAssessmentDraftReceipt,
  applyScreen02AuditConfirmedEventFixedFallback,
  applyScreen02AuditDossierDraftReceipt,
  applyScreen02AuditDossierFixedFallback,
  confirmScreen02AuditIdentity,
  markScreen02AuditRelatedVersion,
  markScreen02AuditRequestDelivered,
  prepareScreen02AuditDossierJob,
  reconsiderScreen02AuditIdentity,
  recordScreen02AuditNoMatch,
  rejectScreen02AuditMatch,
  retryScreen02AuditRequest,
  reviseScreen02AuditAnchor,
} from "../core/screen02-audit-workflow";
import {
  encodeScreen02AuditWorkflowStateEnvelope,
} from "../core/screen02-audit-workflow-envelope";
import {
  applyScreen02FindDiscovery,
  buildReviewedScreen02FindDiscovery,
  type Screen02FindDiscoveryResult,
} from "../core/screen02-find-discovery";
import {
  beginScreen02FindDiscovery,
  completeScreen02FindDiscovery,
  failScreen02FindDiscovery,
  applyScreen02FindDiscoveryPlanDraftReceipt,
  applyScreen02FindCandidateDraftReceipt,
  applyScreen02FindCandidateSourceFallback,
  applyScreen02FindCriterionDraftReceipt,
  buildScreen02FindAssessmentPrompt,
  buildScreen02FindModelContext,
  clearScreen02FindSelection,
  exhaustScreen02FindAssessmentRequest,
  markScreen02FindRequestsDelivered,
  openScreen02FindCandidate,
  overrideUnclearScreen02FindCriterion,
  pendingScreen02FindAssessmentTargets,
  prepareScreen02FindDiscoveryPlanJob,
  prepareScreen02FindAssessmentJobs,
  removeScreen02FindCandidate,
  replaceScreen02FindCriteria,
  retryScreen02FindAssessmentRequest,
  screen02FindRelevanceProfile,
  updateScreen02FindRelevanceProfile,
  type Screen02FindDiscoveryQueryPlan,
} from "../core/screen02-find-workflow";
import type { Screen02StudyRelevanceProfileResearcherEdits } from "../core/screen02-relevance-profile";
import { requireReadyScreen02StudyRelevanceProfile } from
  "../core/screen02-relevance-profile";
import {
  encodeScreen02FindWorkflowStateEnvelope,
} from "../core/screen02-workflow-envelope";
import {
  buildScreen02WorkflowHandoff,
} from "../core/screen02-workflow-handoff";
import {
  upsertScreen02ShockGlance,
} from "../core/screen02-shock-glance";
import {
  continueScreen02Audit,
  continueScreen02AuditWithoutAssessment,
  continueScreen02FindCandidate,
  continueScreen02FindWithoutAssessment,
  createScreen02AuditState,
  createScreen02FindState,
  fingerprintScreen02WorkflowState,
  requireScreen02AuditState,
  requireScreen02FindState,
  requireScreen02WorkflowState,
  selectScreen02FindCandidate,
  transitionScreen02AssessmentRequest,
} from "../core/screen02-workflow-state";
import {
  SCREEN_02_HOST_ASSESSMENT_DEADLINE_MS,
  SCREEN_02_CHATGPT_HOST_COMPLETION_LIFECYCLE_NOTE,
  type Screen02AuditAnchorFields,
  type Screen02AuditState,
  type Screen02AssessmentRequest,
  type Screen02CriterionKind,
  type Screen02FindState,
  type Screen02WorkflowState,
} from "../core/screen02-workflow-types";
import type { Screen01StudyContext } from "../core/scope-types";
import {
  SCREEN_02_WORKFLOW_ASSESSMENT_BATCH_SCHEMA_VERSION,
  SCREEN_02_WORKFLOW_ASSESSMENT_BATCH_MAX_REQUESTS,
  SCREEN_02_WORKFLOW_CLIENT_SCHEMA_VERSION,
  SCREEN_02_WORKFLOW_SUMMARY_SCHEMA_VERSION,
  type Screen02WorkflowAssessmentBatch,
  type Screen02WorkflowClientSnapshot,
  type Screen02WorkflowSummary,
} from "../core/screen02-workflow-client";
import { SHOCKAUDIT_VERSION } from "../version";
import {
  createScreen02AuditAssessmentCapability,
  inspectScreen02AuditReceiptDisposition,
  screen02AuditCapabilityDraftSchema,
  type Screen02AuditSignedReceipt,
  type Screen02AuditSigningConfig,
} from "./screen02-audit-assessment-security";
import {
  createScreen02FindAssessmentCapability,
  inspectScreen02FindReceiptDisposition,
  screen02FindCapabilityDraftSchema,
  type Screen02FindSignedReceipt,
  type Screen02FindSigningConfig,
} from "./screen02-find-assessment-security";
import {
  applyScreen02HostOrientationToGlance,
  buildScreen02AuditHostOrientationSupport,
  buildScreen02FindHostOrientationSupport,
} from "./screen02-host-orientation-security";

export const SCREEN_02_WORKFLOW_ACTION_SCHEMA_VERSION =
  "screen-02-workflow-action-v1" as const;

export const SCREEN_02_WORKFLOW_ACTION_TOOL_V021 =
  "mutate_screen02_workflow_v021" as const;

export const SCREEN_02_WORKFLOW_ACTION_SCHEMA_VERSION_V024 =
  "screen-02-workflow-action-v2" as const;

export const SCREEN_02_WORKFLOW_ACTION_TOOL_V024 =
  "mutate_screen02_workflow_v024" as const;

export type Screen02WorkflowSigningConfig =
  Screen02FindSigningConfig & Screen02AuditSigningConfig;

export type Screen02WorkflowCriterionDraft = {
  kind: Screen02CriterionKind;
  text: string;
};

export type Screen02WorkflowActionName =
  | "refresh"
  | "find-search"
  | "find-search-continue"
  | "find-update-relevance-profile"
  | "find-open"
  | "find-remove"
  | "find-retry"
  | "find-override"
  | "find-select"
  | "find-clear-selection"
  | "find-continue"
  | "find-continue-without-assessment"
  | "audit-revise-anchor"
  | "audit-open"
  | "audit-confirm"
  | "audit-related"
  | "audit-reject"
  | "audit-no-match"
  | "audit-retry-dossier"
  | "audit-retry-assessment"
  | "audit-reconsider"
  | "audit-continue"
  | "audit-continue-without-assessment"
  | "assessment-delivery"
  | "assessment-timeout";

export type Screen02WorkflowAction = {
  schemaVersion: typeof SCREEN_02_WORKFLOW_ACTION_SCHEMA_VERSION;
  operationId: string;
  runId: string;
  accessToken: string;
  expectedRevision: number;
  expectedStateFingerprint: string;
  action: Screen02WorkflowActionName;
  payload: Record<string, unknown>;
};

export type Screen02WorkflowControllerOptions = {
  now: () => string;
  createId: (kind: string) => string;
  signingConfig: Screen02WorkflowSigningConfig | null;
  /**
   * Compatibility switch for the retired Screen 2 model-planning and
   * per-candidate assessment turns. Omission preserves historical behavior.
   */
  legacyHostAssessments?: boolean;
  /** Local deterministic fixtures may shorten server-side deadline checks. */
  hostAssessmentDeadlineMs?: number;
  discoverFind?: (
    state: Screen02FindState,
    input: {
      searchRoundId: string;
      at: string;
      exactRequest: string;
      maximumCandidates: number;
      queryPlanning: Screen02FindQueryPlanningProvenance;
    },
  ) => Promise<Screen02FindDiscoveryResult>;
  /**
   * App-driven, server-owned continuation for the current canonical Find
   * discovery request. A pending result advances only the private retrieval
   * journal; the public workflow revision changes only at start/finalization.
   */
  continueFind?: (
    state: Screen02FindState,
    input: {
      operationId: string;
      /** Server-internal possession proof; never copied into continuation data. */
      accessToken: string;
      discoveryRequestId: string;
      searchRoundId: string;
      candidateSetSnapshotId: string;
      /** Stable logical-search timestamp used by source/provenance binding. */
      at: string;
      /** Current invocation timestamp used only for lease/storage progress. */
      continuedAt: string;
      exactRequest: string;
      maximumCandidates: number;
      queryPlanning: Screen02FindQueryPlanningProvenance;
      /**
       * Builds and capacity-checks the exact parent successor before the
       * private continuation may persist a terminal result.
       */
      preflightCompletion: (
        discovery: Screen02FindDiscoveryResult,
      ) => { canonicalBytes: number; compressedBytes: number };
    },
  ) => Promise<
    | { status: "pending"; message: string }
    | {
        status: "failed";
        failureCodes: string[];
        message: string;
        /** Retry keeps this discovery searching and reuses private progress. */
        retryable: boolean;
      }
    | { status: "complete"; discovery: Screen02FindDiscoveryResult }
  >;
  discoverAudit?: (
    state: Screen02AuditState,
    input: {
      matchSetSnapshotId: string;
      at: string;
      exactRequest: string;
      maximumMatches: number;
    },
  ) => Promise<Screen02AuditDiscoveryResult>;
};

export type Screen02WorkflowActionResult = {
  state: Screen02WorkflowState;
  deliveredRequestIds: string[];
  message: string;
};

export type Screen02CanonicalReceiptResult = {
  state: Screen02WorkflowState;
  disposition:
    | "apply"
    | "buffered-awaiting-delivery"
    | "duplicate"
    | "stale"
    | "terminal"
    | "unknown-request";
  reason: string;
  requestId: string;
  receiptId: string;
  findDiscoveryPlan?: Screen02FindDiscoveryQueryPlan;
  findDiscoveryFallbackReason?: string;
};

export type Screen02FindQueryPlanningProvenance =
  | Screen02FindDiscoveryQueryPlan
  | {
      origin: "fixed-fallback";
      reason: string;
    };

const retryableStatuses = new Set<Screen02AssessmentRequest["status"]>([
  "delivery-rejected",
  "no-tool-submission",
  "validation-failed",
  "timed-out",
  "partial",
]);

function legacyHostAssessmentsEnabled(
  options: Screen02WorkflowControllerOptions,
) {
  return options.legacyHostAssessments !== false;
}

function canRetryAssessmentRequest(request: Screen02AssessmentRequest) {
  if (!retryableStatuses.has(request.status)) return false;
  if (request.status === "delivery-rejected") {
    return request.lifecycle.filter((event) => event.status === "prepared").length < 3;
  }
  return request.attempt < 3;
}

function retryAssessmentRequestTransportOrResult(
  state: Screen02WorkflowState,
  request: Screen02AssessmentRequest,
  at: string,
  options: Screen02WorkflowControllerOptions,
  retryRequestKind: string,
) {
  if (request.status === "delivery-rejected") {
    return transitionScreen02AssessmentRequest(state, {
      requestId: request.requestId,
      status: "prepared",
      at,
      actor: "fixed-core",
      note:
        "Researcher retried transport for the same immutable assessment request; the assessment attempt was not consumed.",
    });
  }
  return state.mode === "find"
    ? retryScreen02FindAssessmentRequest(state, {
        priorRequestId: request.requestId,
        requestId: makeId(options, retryRequestKind),
        at,
      })
    : retryScreen02AuditRequest(state, {
        priorRequestId: request.requestId,
        requestId: makeId(options, retryRequestKind),
        at,
      });
}

function serviceUnavailableContinuationRequestIds(
  state: Screen02WorkflowState,
) {
  if (state.mode === "find") {
    const candidateSnapshotId = state.decision.tentativeSelectionSnapshotId;
    const activeSet = state.candidateSets.find(
      (set) =>
        set.candidateSetSnapshotId === state.activeCandidateSetSnapshotId,
    );
    if (!candidateSnapshotId || !activeSet) return [];
    const criteriaByKey = new Map(
      state.criteria.map((criterion) => [
        `${criterion.criterionId}:${criterion.version}`,
        criterion,
      ]),
    );
    const strictCriterionKeys = new Set(
      activeSet.criterionVersionRefs
        .filter((ref) => {
          const criterion = criteriaByKey.get(
            `${ref.criterionId}:${ref.version}`,
          );
          return criterion && criterion.kind !== "rank-higher";
        })
        .map((ref) => `${ref.criterionId}:${ref.version}`),
    );
    return state.assessmentRequests
      .filter(
        (request) =>
          request.status === "prepared" &&
          ((request.target.mode === "find-candidate" &&
            request.target.candidateSnapshotId === candidateSnapshotId) ||
            (request.target.mode === "find-criterion" &&
              request.target.candidateSnapshotId === candidateSnapshotId &&
              strictCriterionKeys.has(
                `${request.target.criterionId}:${request.target.criterionVersion}`,
              ))),
      )
      .map((request) => request.requestId);
  }
  const confirmed = state.confirmedIdentity;
  if (!confirmed) return [];
  return state.assessmentRequests
    .filter(
      (request) =>
        request.status === "prepared" &&
        request.target.mode === "audit-confirmed-event" &&
        request.target.confirmationSnapshotId ===
          confirmed.confirmationSnapshotId &&
        request.target.identitySnapshotId === confirmed.identitySnapshotId &&
        request.target.dossierSnapshotId === confirmed.dossierSnapshotId,
    )
    .map((request) => request.requestId);
}

function recordAssessmentServiceUnavailableForContinuation(
  state: Screen02WorkflowState,
  at: string,
) {
  let next = serviceUnavailableContinuationRequestIds(state).reduce(
    (current, requestId) =>
      transitionScreen02AssessmentRequest(current, {
        requestId,
        status: "service-unavailable",
        at,
        actor: "fixed-core",
        note:
          "The fixed core has no configured assessment-signing service for this canonical run.",
      }),
    state,
  );
  if (next.mode === "find") {
    for (const request of next.assessmentRequests) {
      if (
        request.status === "service-unavailable" &&
        request.target.mode === "find-candidate"
      ) {
        next = applyScreen02FindCandidateSourceFallback(
          next,
          request.requestId,
          at,
        ).state;
      }
    }
    return next;
  }
  if (next.mode !== "audit") return next;
  if (next.confirmedIdentity) {
    for (const request of next.assessmentRequests) {
      if (
        request.status === "service-unavailable" &&
        request.target.mode === "audit-confirmed-event"
      ) {
        next = applyScreen02AuditConfirmedEventFixedFallback(
          next,
          request.requestId,
          at,
        ).state;
      }
    }
    return next;
  }
  for (const request of next.assessmentRequests) {
    if (
      request.status !== "prepared" ||
      request.target.mode !== "audit-dossier"
    ) {
      continue;
    }
    next = transitionScreen02AssessmentRequest(next, {
      requestId: request.requestId,
      status: "service-unavailable",
      at,
      actor: "fixed-core",
      note:
        "The fixed core has no configured assessment-signing service for this canonical Audit dossier.",
    }) as Screen02AuditState;
    next = applyScreen02AuditDossierFixedFallback(
      next,
      request.requestId,
      at,
    ).state;
  }
  return next;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(
  payload: Record<string, unknown>,
  key: string,
  maximum = 2_000,
) {
  const value = payload[key];
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    value.length < 1 ||
    value.length > maximum
  ) {
    throw new Error(`${key} must be a bounded non-empty string.`);
  }
  return value;
}

function stringArrayField(
  payload: Record<string, unknown>,
  key: string,
  maximum = 80,
) {
  const value = payload[key];
  if (
    !Array.isArray(value) ||
    value.length > maximum ||
    value.some(
      (entry) =>
        typeof entry !== "string" ||
        entry.trim() !== entry ||
        entry.length < 1 ||
        entry.length > 200,
    ) ||
    new Set(value).size !== value.length
  ) {
    throw new Error(`${key} must contain unique bounded identifiers.`);
  }
  return value as string[];
}

function auditFields(payload: Record<string, unknown>) {
  const fields = payload.fields;
  if (!isRecord(fields)) {
    throw new Error("Audit anchor fields are required.");
  }
  const nullable = (key: keyof Screen02AuditAnchorFields) => {
    const value = fields[key];
    if (value === null) return null;
    if (
      typeof value !== "string" ||
      value.trim() !== value ||
      value.length < 1 ||
      value.length > 2_000
    ) {
      throw new Error(`Audit anchor field ${key} is invalid.`);
    }
    return value;
  };
  const versionType = fields.versionType;
  if (
    ![
      "unspecified",
      "original",
      "amendment",
      "implementing-rule",
      "enforcement-action",
    ].includes(versionType as string)
  ) {
    throw new Error("Audit version type is invalid.");
  }
  return {
    shockName: nullable("shockName")!,
    jurisdiction: nullable("jurisdiction"),
    issuingAuthority: nullable("issuingAuthority"),
    approximateYear: nullable("approximateYear"),
    versionType: versionType as Screen02AuditAnchorFields["versionType"],
    distinguishingFeature: nullable("distinguishingFeature"),
    sourceLocator: nullable("sourceLocator"),
    clarification: nullable("clarification"),
  } satisfies Screen02AuditAnchorFields;
}

function findCriteria(payload: Record<string, unknown>) {
  const value = payload.criteria;
  if (!Array.isArray(value) || value.length > 12) {
    throw new Error("Find accepts at most twelve search criteria.");
  }
  return value.map((entry, index) => {
    if (
      !isRecord(entry) ||
      !["only-include", "rank-higher", "do-not-show"].includes(
        entry.kind as string,
      ) ||
      typeof entry.text !== "string" ||
      entry.text.trim() !== entry.text ||
      entry.text.length < 1 ||
      entry.text.length > 2_000
    ) {
      throw new Error(`Find criterion ${index + 1} is invalid.`);
    }
    return {
      kind: entry.kind as Screen02CriterionKind,
      text: entry.text,
    };
  });
}

function makeId(options: Screen02WorkflowControllerOptions, kind: string) {
  const value = options.createId(kind);
  if (!value.trim() || value.length > 200) {
    throw new Error(`Generated ${kind} identity is invalid.`);
  }
  return value;
}

function findPreparedIds(
  state: Screen02FindState,
  options: Screen02WorkflowControllerOptions,
) {
  const pending = pendingScreen02FindAssessmentTargets(state);
  return {
    candidate: pending.candidateSnapshotIds.map((candidateSnapshotId) => ({
      candidateSnapshotId,
      jobId: makeId(options, "find-candidate-job"),
      requestId: makeId(options, "find-candidate-request"),
    })),
    criteria: pending.criterionTargets.map((target) => ({
      ...target,
      jobId: makeId(options, "find-criterion-job"),
      requestId: makeId(options, "find-criterion-request"),
    })),
  };
}

function prepareAllFindJobs(
  state: Screen02FindState,
  at: string,
  options: Screen02WorkflowControllerOptions,
) {
  if (!legacyHostAssessmentsEnabled(options)) return state;
  const ids = findPreparedIds(state, options);
  return ids.candidate.length + ids.criteria.length > 0
    ? prepareScreen02FindAssessmentJobs(state, ids, at)
    : state;
}

function screen02FindExactRequest(state: Screen02FindState) {
  const criteria = state.criteria.filter(
    (criterion) => criterion.status === "active",
  );
  return criteria.length === 0
    ? "Find source-backed event candidates inside the confirmed Screen 1 boundary."
    : `Find source-backed event candidates using this exact researcher guidance: ${criteria
        .map((criterion) => `${criterion.kind}: ${criterion.text}`)
        .join(" | ")}`;
}

function recordFindPlanningProvenance(
  discovery: Screen02FindDiscoveryResult,
  searchRoundId: string,
  queryPlanning: Screen02FindQueryPlanningProvenance,
) {
  const planningRecord =
    queryPlanning.origin === "chatgpt-host"
      ? {
          id: `${searchRoundId}:chatgpt-query-plan`,
          query: queryPlanning.queryTerms.join(" | "),
          purpose: `A bounded planning step supplied retrieval vocabulary from the confirmed study and visible search guidance. Rationale: ${queryPlanning.rationale} These phrases improve recall only; they prove no event fact, eligibility decision, or rank.`,
          returnedRecordIds: [] as string[],
        }
      : {
          id: `${searchRoundId}:fixed-query-plan-fallback`,
          query: "No optional query expansion applied.",
          purpose: `The fixed deterministic query plan was used because optional planning was unavailable: ${queryPlanning.reason} This planning path proves no event fact and does not change eligibility or ranking.`,
          returnedRecordIds: [] as string[],
        };
  return {
    ...discovery,
    manifest: {
      ...discovery.manifest,
      queryMatrix: [planningRecord, ...discovery.manifest.queryMatrix],
    },
  };
}

function recordReducedCoverageRegistryFallback(
  discovery: Screen02FindDiscoveryResult,
  searchRoundId: string,
  at: string,
): Screen02FindDiscoveryResult {
  const funnel = discovery.manifest.funnel;
  return {
    ...discovery,
    manifest: {
      ...discovery.manifest,
      queryMatrix: [
        {
          id: `${searchRoundId}:configured-discovery-failed`,
          query:
            "Configured source discovery for the confirmed Screen 1 boundary.",
          purpose:
            "Attempt the configured source-discovery route. It failed before returning a usable result, so no record from that route is reported as retrieved.",
          returnedRecordIds: [],
        },
        ...discovery.manifest.queryMatrix,
      ],
      channels: [
        {
          channel: "configured-source-discovery",
          status: "failed",
          note:
            "Configured source discovery failed before returning a usable result (failure code: discovery-route-execution-failed). This comparison has reduced coverage and contains only results from the bounded reviewed event registry.",
          retrievedAt: at,
        },
        ...discovery.manifest.channels,
      ],
      ...(funnel
        ? {
            funnel: {
              ...funnel,
              retrievalFailures: funnel.retrievalFailures + 1,
            },
          }
        : {}),
      stoppingRule: {
        rule: `${discovery.manifest.stoppingRule.rule} A failed configured source-discovery route cannot satisfy the broader coverage target.`,
        status: "not-met",
        note: `Reduced coverage: configured source discovery failed, so only the bounded reviewed event registry was searched. The broader search target was not met. ${discovery.manifest.stoppingRule.note}`,
      },
    },
  };
}

export async function completeScreen02FindDiscoveryAfterPlanning(
  state: Screen02FindState,
  queryPlanning: Screen02FindQueryPlanningProvenance,
  at: string,
  options: Screen02WorkflowControllerOptions,
) {
  const discoveryRequestId = makeId(options, "find-discovery");
  const candidateSetSnapshotId = makeId(options, "find-candidate-set");
  const searchRoundId = makeId(options, "find-search-round");
  const exactRequest = screen02FindExactRequest(state);
  const discoveryInput = {
    searchRoundId,
    at,
    exactRequest,
    maximumCandidates: 10,
    queryPlanning,
  };
  let discovery: Screen02FindDiscoveryResult;
  try {
    discovery = options.discoverFind
      ? await options.discoverFind(state, discoveryInput)
      : buildReviewedScreen02FindDiscovery(state, discoveryInput);
  } catch {
    discovery = recordReducedCoverageRegistryFallback(
      buildReviewedScreen02FindDiscovery(state, discoveryInput),
      searchRoundId,
      at,
    );
  }
  const withProvenance = recordFindPlanningProvenance(
    discovery,
    searchRoundId,
    queryPlanning,
  );
  const completed = applyScreen02FindDiscovery(
    state,
    {
      discoveryRequestId,
      candidateSetSnapshotId,
      searchRoundId,
      at,
      exactRequest,
    },
    withProvenance,
  );
  return prepareAllFindJobs(completed, at, options);
}

export function createInitialScreen02WorkflowState(
  baseline: Screen01StudyContext,
  runId: string,
  at: string,
  options: Screen02WorkflowControllerOptions,
) {
  if (baseline.startingPoint === "find") {
    return createScreen02FindState(baseline, runId, at);
  }
  const opened = createScreen02AuditState(baseline, runId, at);
  return applyReviewedScreen02AuditDiscovery(opened, {
    matchSetSnapshotId: makeId(options, "audit-match-set"),
    at,
  });
}

async function applyFindAction(
  state: Screen02FindState,
  action: Screen02WorkflowAction,
  options: Screen02WorkflowControllerOptions,
): Promise<Screen02WorkflowActionResult> {
  const at = options.now();
  const payload = action.payload;
  const activeDiscovery = state.discoveryRequests.find(
    (request) => request.status === "searching",
  );
  if (
    activeDiscovery &&
    action.action !== "refresh" &&
    action.action !== "find-search-continue"
  ) {
    throw new Error(
      "The active source search must finish or be retired before another Find action can mutate this run.",
    );
  }
  switch (action.action) {
    case "refresh":
      return { state, deliveredRequestIds: [], message: "Find state refreshed." };
    case "find-search": {
      requireReadyScreen02StudyRelevanceProfile(
        screen02FindRelevanceProfile(state),
      );
      if (
        state.assessmentRequests.some(
          (request) =>
            request.target.mode === "find-discovery-plan" &&
            ["prepared", "message-delivered", "draft-received", "validating"].includes(
              request.status,
            ),
        )
      ) {
        throw new Error(
          "ChatGPT query planning is already active for this Find search.",
        );
      }
      const criteria = findCriteria(payload);
      const exactRequest =
        criteria.length === 0
          ? "Find source-backed event candidates inside the confirmed Screen 1 boundary."
          : `Find source-backed event candidates using this exact researcher guidance: ${criteria
              .map((criterion) => `${criterion.kind}: ${criterion.text}`)
              .join(" | ")}`;
      const drafts = criteria.map((criterion) => ({
        criterionId: makeId(options, "find-criterion"),
        kind: criterion.kind,
        text: criterion.text,
        exactRequest,
        source: "researcher" as const,
      }));
      let next = replaceScreen02FindCriteria(state, drafts, {
        at,
        ...(state.activeCandidateSetSnapshotId
          ? {
              successorCandidateSetSnapshotId: makeId(
                options,
                "find-criteria-candidate-set",
              ),
            }
          : {}),
        reason: "Researcher submitted exact Screen 2 Find guidance.",
      });
      if (legacyHostAssessmentsEnabled(options) && options.signingConfig) {
        next = prepareScreen02FindDiscoveryPlanJob(next, {
          jobId: makeId(options, "find-discovery-plan-job"),
          requestId: makeId(options, "find-discovery-plan-request"),
          at,
        });
        return {
          state: next,
          deliveredRequestIds: [],
          message:
            "Optional query planning was prepared; official-source discovery will start automatically after the bounded plan or fixed planning path.",
        };
      }
      if (!options.continueFind) {
        next = await completeScreen02FindDiscoveryAfterPlanning(
          next,
          {
            origin: "fixed-fallback",
            reason: legacyHostAssessmentsEnabled(options)
              ? "No assessment-signing service was configured for this run."
              : "Optional assisted query planning is disabled on this route.",
          },
          at,
          options,
        );
        return {
          state: next,
          deliveredRequestIds: [],
          message:
            legacyHostAssessmentsEnabled(options)
              ? "Find discovery completed with the fixed query plan and bounded assessments were prepared."
              : "Find discovery completed immediately with the fixed deterministic query plan; no legacy model planning or per-candidate requests were prepared.",
        };
      }
      next = beginScreen02FindDiscovery(next, {
        discoveryRequestId: makeId(options, "find-discovery"),
        candidateSetSnapshotId: makeId(options, "find-candidate-set"),
        searchRoundId: makeId(options, "find-search-round"),
        exactRequest: screen02FindExactRequest(next),
        at,
      });
      return {
        state: next,
        deliveredRequestIds: [],
        message:
          "Find discovery was started with the fixed deterministic query plan; bounded source retrieval will continue automatically through authenticated app calls.",
      };
    }
    case "find-search-continue": {
      if (!activeDiscovery) {
        throw new Error("There is no active Find source search to continue.");
      }
      if (!options.continueFind) {
        throw new Error(
          "The server-side Find continuation runtime is unavailable.",
        );
      }
      const queryPlanning: Screen02FindQueryPlanningProvenance = {
        origin: "fixed-fallback",
        reason: "Optional assisted query planning is disabled on this route.",
      };
      let preflightedCompletion: Screen02FindState | null = null;
      const prepareCompletion = (discovery: Screen02FindDiscoveryResult) => {
        const withProvenance = recordFindPlanningProvenance(
          discovery,
          activeDiscovery.searchRoundId,
          queryPlanning,
        );
        const completed = completeScreen02FindDiscovery(state, {
          discoveryRequestId: activeDiscovery.discoveryRequestId,
          at,
          ...withProvenance,
        });
        return prepareAllFindJobs(completed, at, options);
      };
      const step = await options.continueFind(state, {
        operationId: action.operationId,
        accessToken: action.accessToken,
        discoveryRequestId: activeDiscovery.discoveryRequestId,
        searchRoundId: activeDiscovery.searchRoundId,
        candidateSetSnapshotId: activeDiscovery.candidateSetSnapshotId,
        at: activeDiscovery.startedAt,
        continuedAt: at,
        exactRequest: activeDiscovery.exactRequest,
        maximumCandidates: 10,
        queryPlanning,
        preflightCompletion: (discovery) => {
          preflightedCompletion = prepareCompletion(discovery);
          const envelope = encodeScreen02FindWorkflowStateEnvelope(
            preflightedCompletion,
          );
          return {
            canonicalBytes: envelope.uncompressedBytes,
            compressedBytes: envelope.compressedBytes,
          };
        },
      });
      if (step.status === "pending") {
        return {
          state,
          deliveredRequestIds: [],
          message: step.message,
        };
      }
      if (step.status === "failed") {
        if (step.retryable) {
          return {
            state,
            deliveredRequestIds: [],
            message: step.message,
          };
        }
        return {
          state: failScreen02FindDiscovery(state, {
            discoveryRequestId: activeDiscovery.discoveryRequestId,
            failureCodes: step.failureCodes,
            at,
            note: step.message,
          }),
          deliveredRequestIds: [],
          message: step.message,
        };
      }
      return {
        state: preflightedCompletion ?? prepareCompletion(step.discovery),
        deliveredRequestIds: [],
        message:
          "Find discovery completed through bounded authenticated continuations with the fixed deterministic query plan.",
      };
    }
    case "find-update-relevance-profile": {
      const edit = payload.edit;
      if (!isRecord(edit)) {
        throw new Error("A bounded relevance-profile edit object is required.");
      }
      const currentProfile = screen02FindRelevanceProfile(state);
      return {
        state: updateScreen02FindRelevanceProfile(state, {
          edits: edit as Screen02StudyRelevanceProfileResearcherEdits,
          expectedProfileUpdatedAt: currentProfile.updatedAt,
          at,
          reason:
            "Researcher corrected the interpreted Screen 2 relevance profile for the current confirmed scope.",
        }),
        deliveredRequestIds: [],
        message:
          "The relevance profile was saved. Any active comparison is now historical; run search again to qualify candidates against the corrected profile.",
      };
    }
    case "find-open":
      return {
        state: openScreen02FindCandidate(state, {
          candidateSnapshotId: stringField(payload, "candidateSnapshotId", 200),
          decisionId: makeId(options, "find-open-decision"),
          at,
        }),
        deliveredRequestIds: [],
        message: "Candidate detail opened.",
      };
    case "find-remove":
      return {
        state: removeScreen02FindCandidate(state, {
          candidateSnapshotId: stringField(payload, "candidateSnapshotId", 200),
          successorCandidateSetSnapshotId: makeId(
            options,
            "find-removal-candidate-set",
          ),
          decisionId: makeId(options, "find-remove-decision"),
          at,
          reason: stringField(payload, "reason"),
        }),
        deliveredRequestIds: [],
        message: "Candidate removed from the active comparison; history was preserved.",
      };
    case "find-retry": {
      if (!legacyHostAssessmentsEnabled(options)) {
        throw new Error(
          "Legacy Screen 2 Find assessment retries are disabled on this route.",
        );
      }
      const candidateSnapshotId = stringField(
        payload,
        "candidateSnapshotId",
        200,
      );
      const requests = state.assessmentRequests.filter(
        (request) =>
          "candidateSnapshotId" in request.target &&
          request.target.candidateSnapshotId === candidateSnapshotId &&
          canRetryAssessmentRequest(request),
      );
      if (requests.length === 0) {
        throw new Error("No retryable Find request exists for this candidate.");
      }
      let next = state;
      for (const request of requests) {
        next = retryAssessmentRequestTransportOrResult(
          next,
          request,
          at,
          options,
          "find-retry-request",
        ) as Screen02FindState;
      }
      return {
        state: next,
        deliveredRequestIds: [],
        message: requests.some((request) => request.status === "delivery-rejected")
          ? "The same immutable Find request was prepared for another delivery attempt. Its assessment-attempt budget was preserved."
          : "Only unresolved Find assessment parts were prepared for retry.",
      };
    }
    case "find-override":
      return {
        state: overrideUnclearScreen02FindCriterion(state, {
          findingId: stringField(payload, "findingId", 200),
          overrideId: makeId(options, "find-criterion-override"),
          researcher: "Researcher",
          reason: stringField(payload, "reason"),
          at,
        }),
        deliveredRequestIds: [],
        message: "The unclear strict criterion received a documented override.",
      };
    case "find-select":
      return {
        state: selectScreen02FindCandidate(
          state,
          stringField(payload, "candidateSnapshotId", 200),
          makeId(options, "find-selection"),
          at,
          "Researcher made a tentative Screen 2 choice.",
        ),
        deliveredRequestIds: [],
        message: "Candidate tentatively chosen; verification remains on Screen 3.",
      };
    case "find-clear-selection": {
      const reopened = state.decision.continuedRevision !== null;
      return {
        state: clearScreen02FindSelection(state, {
          decisionId: makeId(options, "find-selection-clear"),
          at,
          reason: reopened
            ? "Researcher returned from Screen 3 and reopened the comparison by clearing the handed-off choice."
            : "Researcher cleared the tentative choice.",
        }),
        deliveredRequestIds: [],
        message: reopened
          ? "Handed-off choice cleared; the existing Find comparison is open again."
          : "Tentative choice cleared.",
      };
    }
    case "find-continue":
      return {
        state: continueScreen02FindCandidate(
          state,
          makeId(options, "find-continuation"),
          at,
          "Researcher continued to verify the selected provisional event.",
        ),
        deliveredRequestIds: [],
        message: "Find handoff is ready for Screen 3 verification.",
      };
    case "find-continue-without-assessment": {
      const unavailableState = options.signingConfig
        ? state
        : recordAssessmentServiceUnavailableForContinuation(state, at);
      if (unavailableState.mode !== "find") {
        throw new Error("Find assessment-unavailable continuation changed mode.");
      }
      return {
        state: continueScreen02FindWithoutAssessment(
          unavailableState,
          makeId(options, "find-continuation-without-assessment"),
          at,
          stringField(payload, "reason"),
          stringField(payload, "acknowledgment"),
        ),
        deliveredRequestIds: [],
        message:
          "Find handoff records that assessment was unavailable and carries mandatory Screen 3 checks.",
      };
    }
    default:
      break;
  }
  return applySharedAssessmentAction(state, action, options);
}

function latestAuditRequest(
  state: Screen02AuditState,
  predicate: (request: Screen02AssessmentRequest) => boolean,
) {
  return [...state.assessmentRequests].reverse().find(predicate) ?? null;
}

async function applyAuditAction(
  state: Screen02AuditState,
  action: Screen02WorkflowAction,
  options: Screen02WorkflowControllerOptions,
): Promise<Screen02WorkflowActionResult> {
  const at = options.now();
  const payload = action.payload;
  switch (action.action) {
    case "refresh":
      return { state, deliveredRequestIds: [], message: "Audit state refreshed." };
    case "audit-revise-anchor": {
      const fields = auditFields(payload);
      let next = reviseScreen02AuditAnchor(state, {
        anchorRevisionId: makeId(options, "audit-anchor-revision"),
        successorMatchSetSnapshotId: makeId(options, "audit-pending-match-set"),
        decisionId: makeId(options, "audit-anchor-decision"),
        fields,
        at,
        reason: stringField(payload, "reason"),
      });
      const discoveryInput = {
        matchSetSnapshotId: makeId(options, "audit-match-set"),
        at,
        exactRequest: [
          `Resolve the named shock ${fields.shockName}.`,
          fields.jurisdiction ? `Jurisdiction: ${fields.jurisdiction}.` : "",
          fields.issuingAuthority
            ? `Issuing authority: ${fields.issuingAuthority}.`
            : "",
          fields.approximateYear ? `Approximate year: ${fields.approximateYear}.` : "",
          fields.versionType !== "unspecified"
            ? `Requested version: ${fields.versionType}.`
            : "",
          fields.distinguishingFeature
            ? `Distinguishing feature: ${fields.distinguishingFeature}.`
            : "",
          fields.sourceLocator ? `Researcher URL: ${fields.sourceLocator}.` : "",
          fields.clarification ? `Clarification: ${fields.clarification}.` : "",
        ]
          .filter(Boolean)
          .join(" "),
        maximumMatches: 12,
      };
      const discovery = options.discoverAudit
        ? await options.discoverAudit(next, discoveryInput)
        : buildReviewedScreen02AuditDiscovery(next, discoveryInput);
      next = applyScreen02AuditMatchRound(next, discovery);
      return {
        state: next,
        deliveredRequestIds: [],
        message: "Anchor revision preserved and identity discovery rerun.",
      };
    }
    case "audit-open": {
      const matchSnapshotId = stringField(payload, "matchSnapshotId", 200);
      const match = state.possibleMatches.find(
        (candidate) => candidate.matchSnapshotId === matchSnapshotId,
      );
      if (!match) throw new Error("Audit match was not found.");
      const completed = state.dossiers.some(
        (dossier) =>
          dossier.identitySnapshotId === match.identitySnapshotId &&
          dossier.status === "completed",
      );
      const existing = state.assessmentRequests.some(
        (request) =>
          request.target.mode === "audit-dossier" &&
          request.target.matchSnapshotId === matchSnapshotId,
      );
      let next =
        completed || existing
          ? state
          : prepareScreen02AuditDossierJob(state, {
              matchSnapshotId,
              jobId: makeId(options, "audit-dossier-job"),
              requestId: makeId(options, "audit-dossier-request"),
              at,
            });
      if (!legacyHostAssessmentsEnabled(options) && !completed && !existing) {
        const request = next.assessmentRequests.find(
          (candidate) =>
            candidate.target.mode === "audit-dossier" &&
            candidate.target.matchSnapshotId === matchSnapshotId &&
            candidate.status === "prepared",
        );
        if (!request) {
          throw new Error(
            "The deterministic Audit dossier request was not created.",
          );
        }
        next = transitionScreen02AssessmentRequest(next, {
          requestId: request.requestId,
          status: "service-unavailable",
          at,
          actor: "fixed-core",
          note:
            "Legacy Screen 2 host dossier turns are disabled on this route.",
        }) as Screen02AuditState;
        next = applyScreen02AuditDossierFixedFallback(
          next,
          request.requestId,
          at,
        ).state;
      }
      return {
        state: next,
        deliveredRequestIds: [],
        message: completed
          ? "Completed provisional dossier opened."
            : existing
              ? "Existing dossier request opened."
              : !legacyHostAssessmentsEnabled(options)
                ? "A deterministic source-derived identity dossier was completed without a legacy host turn."
                : "A bounded provisional dossier request was prepared.",
      };
    }
    case "audit-confirm": {
      const matchSnapshotId = stringField(payload, "matchSnapshotId", 200);
      const match = state.possibleMatches.find(
        (candidate) => candidate.matchSnapshotId === matchSnapshotId,
      );
      const dossier = match
        ? [...state.dossiers]
            .reverse()
            .find(
              (candidate) =>
                candidate.identitySnapshotId === match.identitySnapshotId &&
                candidate.status === "completed",
            )
        : null;
      if (!match || !dossier) {
        throw new Error("Audit confirmation requires a completed match dossier.");
      }
      const assessmentRequestId = makeId(options, "audit-assessment-request");
      let next = confirmScreen02AuditIdentity(state, {
        matchSnapshotId,
        dossierSnapshotId: dossier.dossierSnapshotId,
        decisionId: makeId(options, "audit-confirm-decision"),
        confirmationSnapshotId: makeId(options, "audit-confirmation"),
        assessmentJobId: makeId(options, "audit-assessment-job"),
        assessmentRequestId,
        at,
        reason: stringField(payload, "reason"),
      });
      if (!legacyHostAssessmentsEnabled(options)) {
        next = transitionScreen02AssessmentRequest(next, {
          requestId: assessmentRequestId,
          status: "service-unavailable",
          at,
          actor: "fixed-core",
          note:
            "Legacy Screen 2 confirmed-event assessment turns are disabled on this route.",
        }) as Screen02AuditState;
        next = applyScreen02AuditConfirmedEventFixedFallback(
          next,
          assessmentRequestId,
          at,
        ).state;
      }
      return {
        state: next,
        deliveredRequestIds: [],
        message: legacyHostAssessmentsEnabled(options)
          ? "Exact identity confirmed; the early study assessment was prepared."
          : "Exact identity confirmed and a conservative fixed assessment was completed without a legacy host turn.",
      };
    }
    case "audit-related":
      return {
        state: markScreen02AuditRelatedVersion(state, {
          matchSnapshotId: stringField(payload, "matchSnapshotId", 200),
          decisionId: makeId(options, "audit-related-decision"),
          at,
          reason: stringField(payload, "reason"),
        }),
        deliveredRequestIds: [],
        message: "Related version recorded without substituting event identity.",
      };
    case "audit-reject":
      return {
        state: rejectScreen02AuditMatch(state, {
          matchSnapshotId: stringField(payload, "matchSnapshotId", 200),
          decisionId: makeId(options, "audit-reject-decision"),
          at,
          reason: stringField(payload, "reason"),
        }),
        deliveredRequestIds: [],
        message: "Different identity rejected; the match history was preserved.",
      };
    case "audit-no-match":
      return {
        state: recordScreen02AuditNoMatch(state, {
          decisionId: makeId(options, "audit-no-match-decision"),
          at,
          reason: stringField(payload, "reason"),
        }),
        deliveredRequestIds: [],
        message: "No match was recorded for this immutable search snapshot.",
      };
    case "audit-retry-dossier": {
      if (!legacyHostAssessmentsEnabled(options)) {
        throw new Error(
          "Legacy Screen 2 Audit dossier retries are disabled on this route.",
        );
      }
      const matchSnapshotId = stringField(payload, "matchSnapshotId", 200);
      const prior = latestAuditRequest(
        state,
        (request) =>
          request.target.mode === "audit-dossier" &&
          request.target.matchSnapshotId === matchSnapshotId &&
          canRetryAssessmentRequest(request),
      );
      if (!prior) throw new Error("No retryable dossier request was found.");
      return {
        state: retryAssessmentRequestTransportOrResult(
          state,
          prior,
          at,
          options,
          "audit-dossier-retry",
        ),
        deliveredRequestIds: [],
        message:
          prior.status === "delivery-rejected"
            ? "The same immutable dossier request was prepared for another delivery attempt. Its assessment-attempt budget was preserved."
            : "Only unresolved dossier parts were prepared for retry.",
      };
    }
    case "audit-retry-assessment": {
      if (!legacyHostAssessmentsEnabled(options)) {
        throw new Error(
          "Legacy Screen 2 Audit assessment retries are disabled on this route.",
        );
      }
      const confirmationSnapshotId = stringField(
        payload,
        "confirmationSnapshotId",
        200,
      );
      const prior = latestAuditRequest(
        state,
        (request) =>
          request.target.mode === "audit-confirmed-event" &&
          request.target.confirmationSnapshotId === confirmationSnapshotId &&
          canRetryAssessmentRequest(request),
      );
      if (!prior) throw new Error("No retryable Audit assessment was found.");
      return {
        state: retryAssessmentRequestTransportOrResult(
          state,
          prior,
          at,
          options,
          "audit-assessment-retry",
        ),
        deliveredRequestIds: [],
        message:
          prior.status === "delivery-rejected"
            ? "The same immutable Audit request was prepared for another delivery attempt. Its assessment-attempt budget was preserved."
            : "Only unresolved Audit assessment parts were prepared for retry.",
      };
    }
    case "audit-reconsider":
      return {
        state: reconsiderScreen02AuditIdentity(state, {
          decisionId: makeId(options, "audit-reconsider-decision"),
          at,
          reason: stringField(payload, "reason"),
        }),
        deliveredRequestIds: [],
        message: "Identity confirmation reversed and unfinished assessment work superseded.",
      };
    case "audit-continue":
      return {
        state: continueScreen02Audit(
          state,
          makeId(options, "audit-continuation"),
          at,
          "Researcher continued to Screen 3 verification.",
        ),
        deliveredRequestIds: [],
        message: "Audit handoff is ready for Screen 3 verification.",
      };
    case "audit-continue-without-assessment": {
      const unavailableState = options.signingConfig
        ? state
        : recordAssessmentServiceUnavailableForContinuation(state, at);
      if (unavailableState.mode !== "audit") {
        throw new Error("Audit assessment-unavailable continuation changed mode.");
      }
      return {
        state: continueScreen02AuditWithoutAssessment(
          unavailableState,
          makeId(options, "audit-continuation-without-assessment"),
          at,
          stringField(payload, "reason"),
          stringField(payload, "acknowledgment"),
        ),
        deliveredRequestIds: [],
        message:
          "Audit handoff records that assessment was unavailable and carries mandatory Screen 3 checks.",
      };
    }
    default:
      break;
  }
  return applySharedAssessmentAction(state, action, options);
}

async function applySharedAssessmentAction(
  state: Screen02WorkflowState,
  action: Screen02WorkflowAction,
  options: Screen02WorkflowControllerOptions,
): Promise<Screen02WorkflowActionResult> {
  const at = options.now();
  if (action.action === "assessment-delivery") {
    const requestIds = stringArrayField(action.payload, "requestIds");
    const delivered = action.payload.delivered;
    if (typeof delivered !== "boolean") {
      throw new Error("Delivery result must be a boolean.");
    }
    let next =
      state.mode === "find"
        ? markScreen02FindRequestsDelivered(state, requestIds, {
            at,
            delivered,
            ...(delivered
              ? {
                  note: SCREEN_02_CHATGPT_HOST_COMPLETION_LIFECYCLE_NOTE,
                }
              : {}),
          })
        : requestIds.reduce(
            (current, requestId) =>
              markScreen02AuditRequestDelivered(current, {
                requestId,
                at,
                delivered,
                ...(delivered
                  ? {
                      note: SCREEN_02_CHATGPT_HOST_COMPLETION_LIFECYCLE_NOTE,
                    }
                  : {}),
              }),
            state,
          );
    const plannerRejected =
      state.mode === "find" &&
      !delivered &&
      requestIds.some(
        (requestId) =>
          state.assessmentRequests.find(
            (request) => request.requestId === requestId,
          )?.target.mode === "find-discovery-plan",
      );
    if (plannerRejected && next.mode === "find") {
      next = await completeScreen02FindDiscoveryAfterPlanning(
        next,
        {
          origin: "fixed-fallback",
          reason: "The bounded planning message was not accepted.",
        },
        at,
        options,
      );
    }
    let usedFindCandidateFallback = false;
    if (!delivered && next.mode === "find") {
      for (const requestId of requestIds) {
        const rejected = next.assessmentRequests.find(
          (request) => request.requestId === requestId,
        );
        if (
          rejected?.target.mode === "find-candidate" &&
          rejected.status === "delivery-rejected"
        ) {
          next = applyScreen02FindCandidateSourceFallback(
            next,
            requestId,
            at,
          ).state;
          usedFindCandidateFallback = true;
        }
      }
    }
    let usedAuditConfirmedFallback = false;
    if (!delivered && next.mode === "audit") {
      for (const requestId of requestIds) {
        const rejected = next.assessmentRequests.find(
          (request) => request.requestId === requestId,
        );
        if (
          rejected?.target.mode === "audit-dossier" &&
          rejected.status === "delivery-rejected"
        ) {
          next = applyScreen02AuditDossierFixedFallback(
            next,
            requestId,
            at,
          ).state;
        } else if (
          rejected?.target.mode === "audit-confirmed-event" &&
          ["delivery-rejected", "retry-exhausted"].includes(rejected.status)
        ) {
          next = applyScreen02AuditConfirmedEventFixedFallback(
            next,
            requestId,
            at,
          ).state;
          usedAuditConfirmedFallback = true;
        }
      }
    }
    return {
      state: next,
      deliveredRequestIds: delivered ? requestIds : [],
      message: delivered
        ? "Host delivery was recorded; only a signed tool receipt can complete assessment."
        : plannerRejected
          ? "ChatGPT planning was unavailable, so ShockAudit completed the official-source search with its fixed query plan."
          : usedFindCandidateFallback
            ? "ChatGPT candidate review delivery was unavailable, so ShockAudit completed a conservative source-derived assessment from the retained candidate facts."
          : usedAuditConfirmedFallback
            ? "ChatGPT confirmed-event review delivery was unavailable, so ShockAudit completed a conservative source-derived assessment from the confirmed dossier and study facts."
          : next.mode === "audit" &&
              requestIds.some(
                (requestId) =>
                  next.assessmentRequests.find(
                    (request) => request.requestId === requestId,
                  )?.target.mode === "audit-dossier",
              )
            ? "ChatGPT dossier delivery was unavailable, so ShockAudit prepared an identity-only source-derived dossier with explicit evidence gaps."
          : "Host delivery was rejected; retry remains explicit.",
    };
  }
  if (action.action === "assessment-timeout") {
    const requestId = stringField(action.payload, "requestId", 200);
    const request = state.assessmentRequests.find(
      (candidate) => candidate.requestId === requestId,
    );
    if (
      !request ||
      !["prepared", "message-delivered"].includes(request.status)
    ) {
      throw new Error(
        "Only a prepared or delivered request awaiting a tool receipt can time out.",
      );
    }
    const preparedAt = request.lifecycle.find(
      (event) => event.status === "prepared",
    )?.at;
    const hostAssessmentDeadlineMs =
      options.hostAssessmentDeadlineMs ??
      SCREEN_02_HOST_ASSESSMENT_DEADLINE_MS;
    if (
      !Number.isInteger(hostAssessmentDeadlineMs) ||
      hostAssessmentDeadlineMs < 0 ||
      hostAssessmentDeadlineMs > SCREEN_02_HOST_ASSESSMENT_DEADLINE_MS
    ) {
      throw new Error("Screen 2 host assessment deadline configuration is invalid.");
    }
    if (
      !preparedAt ||
      Date.parse(at) <
        Date.parse(preparedAt) + hostAssessmentDeadlineMs
    ) {
      throw new Error(
        "The bounded Screen 2 host deadline has not elapsed for this request.",
      );
    }
    const requestWasDelivered = request.status === "message-delivered";
    const unavailableBeforeDelivery = requestWasDelivered
      ? state
      : transitionScreen02AssessmentRequest(state, {
          requestId,
          status: "service-unavailable",
          at,
          actor: "fixed-core",
          note:
            "The bounded host message did not settle before the canonical Screen 2 deadline.",
        });
    if (
      state.mode === "find" &&
      request.target.mode === "find-discovery-plan"
    ) {
      const unavailable = requestWasDelivered
        ? transitionScreen02AssessmentRequest(state, {
            requestId,
            status: "no-tool-submission",
            at,
            actor: "chatgpt-host",
            note:
              "The planning message was delivered, but no signed model-tool receipt arrived in time.",
          }) as Screen02FindState
        : unavailableBeforeDelivery as Screen02FindState;
      const next = await completeScreen02FindDiscoveryAfterPlanning(
        unavailable,
        {
          origin: "fixed-fallback",
          reason:
            "No authenticated planning receipt arrived before the bounded timeout.",
        },
        at,
        options,
      );
      return {
        state: next,
        deliveredRequestIds: [],
        message:
          "Optional planning timed out, so the official-source search completed with its fixed query plan.",
      };
    }
    if (state.mode === "find" && request.target.mode === "find-candidate") {
      const next = applyScreen02FindCandidateSourceFallback(
        unavailableBeforeDelivery as Screen02FindState,
        requestId,
        at,
      ).state;
      return {
        state: next,
        deliveredRequestIds: [],
        message:
          "ChatGPT did not return the signed candidate review before the bounded deadline, so ShockAudit completed a conservative source-derived assessment instead.",
      };
    }
    if (state.mode === "audit" && request.target.mode === "audit-dossier") {
      const unavailable = requestWasDelivered
        ? transitionScreen02AssessmentRequest(state, {
            requestId,
            status: "no-tool-submission",
            at,
            actor: "chatgpt-host",
            note:
              "The dossier message was delivered, but no signed model-tool receipt arrived in time.",
          }) as Screen02AuditState
        : unavailableBeforeDelivery as Screen02AuditState;
      const next = applyScreen02AuditDossierFixedFallback(
        unavailable,
        requestId,
        at,
      ).state;
      return {
        state: next,
        deliveredRequestIds: [],
        message:
          "ChatGPT dossier delivery timed out, so ShockAudit prepared an identity-only source-derived dossier with explicit evidence gaps.",
      };
    }
    if (
      state.mode === "audit" &&
      request.target.mode === "audit-confirmed-event"
    ) {
      const unavailable = requestWasDelivered
        ? transitionScreen02AssessmentRequest(state, {
            requestId,
            status: "no-tool-submission",
            at,
            actor: "chatgpt-host",
            note:
              "The confirmed-event assessment message was delivered, but no signed model-tool receipt arrived in time.",
          }) as Screen02AuditState
        : unavailableBeforeDelivery as Screen02AuditState;
      const next = applyScreen02AuditConfirmedEventFixedFallback(
        unavailable,
        requestId,
        at,
      ).state;
      return {
        state: next,
        deliveredRequestIds: [],
        message:
          "ChatGPT did not return the signed confirmed-event review before the bounded deadline, so ShockAudit completed a conservative source-derived assessment instead.",
      };
    }
    if (!requestWasDelivered) {
      return {
        state: unavailableBeforeDelivery,
        deliveredRequestIds: [],
        message:
          "The bounded host message did not settle before the canonical deadline; no model assessment was claimed.",
      };
    }
    const next =
      request.attempt === 3
        ? state.mode === "find"
          ? exhaustScreen02FindAssessmentRequest(state, {
              requestId,
              at,
              failureCode: "no-tool-submission",
              note: "No signed model-tool receipt arrived before the final attempt expired.",
            })
          : (transitionScreen02AssessmentRequest(state, {
              requestId,
              status: "retry-exhausted",
              at,
              actor: "fixed-core",
              note: "No signed model-tool receipt arrived before the final attempt expired.",
              failures: request.requestedPartIds.map((partId) => ({
                partId,
                codes: ["no-tool-submission"],
              })),
            }) as Screen02AuditState)
        : transitionScreen02AssessmentRequest(state, {
            requestId,
            status: "no-tool-submission",
            at,
            actor: "chatgpt-host",
            note: "The visible request was delivered, but no signed model-tool receipt arrived in time.",
          });
    return {
      state: next,
      deliveredRequestIds: [],
      message: "No tool submission was recorded without pretending the assessment completed.",
    };
  }
  throw new Error(`Action ${action.action} does not apply to ${state.mode} mode.`);
}

export async function applyScreen02WorkflowAction(
  state: Screen02WorkflowState,
  action: Screen02WorkflowAction,
  options: Screen02WorkflowControllerOptions,
) {
  const safe = requireScreen02WorkflowState(state);
  if (action.runId !== safe.runId) {
    throw new Error("Workflow action run identity does not match canonical state.");
  }
  const result = safe.mode === "find"
    ? await applyFindAction(safe, action, options)
    : await applyAuditAction(safe, action, options);
  if (legacyHostAssessmentsEnabled(options) && options.signingConfig) {
    return result;
  }
  return {
    ...result,
    state: recordAssessmentServiceUnavailableForContinuation(
      result.state,
      result.state.updatedAt,
    ),
  };
}

function applicationTime(receivedAt: string, state: Screen02WorkflowState) {
  return Date.parse(receivedAt) < Date.parse(state.updatedAt)
    ? state.updatedAt
    : receivedAt;
}

function applyAuthenticatedFindHostOrientation(
  state: Screen02FindState,
  signed: Screen02FindSignedReceipt,
  at: string,
) {
  const capability = signed.payload.capability;
  if (capability.mode !== "find-candidate") return state;
  const fixed = state.shockGlances?.find(
    (glance) => glance.candidateSnapshotId === capability.candidateSnapshotId,
  );
  if (!fixed) return state;
  const support = buildScreen02FindHostOrientationSupport(state, {
    runId: capability.runId,
    requestId: capability.requestId,
    candidateSnapshotId: capability.candidateSnapshotId,
    candidateFingerprint: capability.candidateFingerprint,
  });
  const resolved = applyScreen02HostOrientationToGlance(
    fixed,
    signed.hostOrientation,
    support,
    at,
  );
  if (resolved.status !== "accepted") return state;
  return requireScreen02FindState({
    ...state,
    shockGlances: upsertScreen02ShockGlance(
      state.shockGlances,
      resolved.glance,
    ),
  });
}

function applyAuthenticatedAuditHostOrientation(
  state: Screen02AuditState,
  signed: Screen02AuditSignedReceipt,
  at: string,
) {
  const capability = signed.payload.capability;
  const fixed = state.shockGlances?.find(
    (glance) => glance.candidateSnapshotId === capability.matchSnapshotId,
  );
  if (!fixed) return state;
  const support = buildScreen02AuditHostOrientationSupport(state, {
    runId: capability.runId,
    requestId: capability.requestId,
    candidateSnapshotId: capability.matchSnapshotId,
    candidateFingerprint: capability.matchFingerprint,
    dossierSnapshotId: capability.dossierSnapshotId,
  });
  const resolved = applyScreen02HostOrientationToGlance(
    fixed,
    signed.hostOrientation,
    support,
    at,
  );
  if (resolved.status !== "accepted") return state;
  return requireScreen02AuditState({
    ...state,
    shockGlances: upsertScreen02ShockGlance(
      state.shockGlances,
      resolved.glance,
    ),
  });
}

/**
 * Apply a previously authenticated normalized receipt only to the trusted
 * canonical state loaded by the persistence owner. No caller envelope enters
 * this boundary.
 */
export function applyCanonicalScreen02FindReceipt(
  state: Screen02FindState,
  signed: Screen02FindSignedReceipt,
): Screen02CanonicalReceiptResult {
  const disposition = inspectScreen02FindReceiptDisposition(state, signed);
  const requestId = signed.payload.capability.requestId;
  const receiptId = signed.payload.receiptId;
  if (disposition.disposition === "awaiting-delivery") {
    return {
      state,
      disposition: "buffered-awaiting-delivery",
      reason: disposition.reason,
      requestId,
      receiptId,
    };
  }
  if (disposition.disposition !== "apply") {
    return {
      state,
      disposition: disposition.disposition,
      reason: disposition.reason,
      requestId,
      receiptId,
    };
  }
  const applied =
    signed.payload.capability.mode === "find-discovery-plan"
      ? applyScreen02FindDiscoveryPlanDraftReceipt(
          state,
          signed.receipt,
          applicationTime(signed.payload.receivedAt, state),
        )
      : signed.payload.capability.mode === "find-candidate"
        ? applyScreen02FindCandidateDraftReceipt(
          state,
          signed.receipt,
          applicationTime(signed.payload.receivedAt, state),
        )
        : applyScreen02FindCriterionDraftReceipt(
            state,
            signed.receipt,
            applicationTime(signed.payload.receivedAt, state),
          );
  const appliedAt = applicationTime(signed.payload.receivedAt, state);
  const next = applyAuthenticatedFindHostOrientation(
    applied.state,
    signed,
    appliedAt,
  );
  return {
    state: next,
    disposition: "apply",
    reason: disposition.reason,
    requestId,
    receiptId,
    ...(signed.payload.capability.mode === "find-discovery-plan" &&
    "plan" in applied && applied.plan
      ? { findDiscoveryPlan: applied.plan }
      : {}),
    ...(signed.payload.capability.mode === "find-discovery-plan" &&
    "plan" in applied &&
    !applied.plan &&
    next !== state
      ? { findDiscoveryFallbackReason: applied.reason }
      : {}),
  };
}

export function applyCanonicalScreen02AuditReceipt(
  state: Screen02AuditState,
  signed: Screen02AuditSignedReceipt,
): Screen02CanonicalReceiptResult {
  const disposition = inspectScreen02AuditReceiptDisposition(state, signed);
  const requestId = signed.payload.capability.requestId;
  const receiptId = signed.payload.receiptId;
  if (disposition.disposition === "awaiting-delivery") {
    return {
      state,
      disposition: "buffered-awaiting-delivery",
      reason: disposition.reason,
      requestId,
      receiptId,
    };
  }
  if (disposition.disposition !== "apply") {
    return {
      state,
      disposition: disposition.disposition,
      reason: disposition.reason,
      requestId,
      receiptId,
    };
  }
  const appliedAt = applicationTime(signed.payload.receivedAt, state);
  const applied =
    signed.payload.capability.mode === "audit-dossier"
      ? applyScreen02AuditDossierDraftReceipt(
          state,
          signed.receipt,
          appliedAt,
        )
      : applyScreen02AuditAssessmentDraftReceipt(
          state,
          signed.receipt,
          appliedAt,
        );
  let next = applied.state;
  if (
    signed.payload.capability.mode === "audit-dossier" &&
    next.mode === "audit"
  ) {
    const dossierRequest = next.assessmentRequests.find(
      (request) => request.requestId === requestId,
    );
    if (
      dossierRequest &&
      ["validation-failed", "partial", "retry-exhausted"].includes(
        dossierRequest.status,
      )
    ) {
      // An unusable authenticated dossier must not strand Audit before the
      // researcher can confirm identity. Discard the failed prose and replace
      // it with the narrow source-derived identity aid plus explicit gaps.
      next = applyScreen02AuditDossierFixedFallback(
        next,
        requestId,
        appliedAt,
      ).state;
    }
  }
  next = applyAuthenticatedAuditHostOrientation(next, signed, appliedAt);
  return {
    state: next,
    disposition: "apply",
    reason: disposition.reason,
    requestId,
    receiptId,
  };
}

function preparedRequests(state: Screen02WorkflowState) {
  // Keep only one model turn in flight. A receipt notification is the fast
  // path and authenticated refresh polling is the reconciliation path; both
  // must observe the current turn as terminal before another capability batch
  // is issued.
  if (
    state.assessmentRequests.some(
      (request) => request.status === "message-delivered",
    )
  ) {
    return [];
  }
  const prepared = state.assessmentRequests.filter(
    (request) => request.status === "prepared",
  );
  if (state.mode !== "find" || !state.decision.tentativeSelectionSnapshotId) {
    return prepared.slice(0, SCREEN_02_WORKFLOW_ASSESSMENT_BATCH_MAX_REQUESTS);
  }
  const candidateSnapshotId = state.decision.tentativeSelectionSnapshotId;
  const activeSet = state.candidateSets.find(
    (set) => set.candidateSetSnapshotId === state.activeCandidateSetSnapshotId,
  );
  const criteriaByKey = new Map(
    state.criteria.map((criterion) => [
      `${criterion.criterionId}:${criterion.version}`,
      criterion,
    ]),
  );
  const strictCriterionKeys = new Set(
    (activeSet?.criterionVersionRefs ?? [])
      .filter((ref) => {
        const criterion = criteriaByKey.get(
          `${ref.criterionId}:${ref.version}`,
        );
        return criterion && criterion.kind !== "rank-higher";
      })
      .map((ref) => `${ref.criterionId}:${ref.version}`),
  );
  const prioritized = prepared.filter(
    (request) =>
      (request.target.mode === "find-candidate" &&
        request.target.candidateSnapshotId === candidateSnapshotId) ||
      (request.target.mode === "find-criterion" &&
        request.target.candidateSnapshotId === candidateSnapshotId &&
        strictCriterionKeys.has(
          `${request.target.criterionId}:${request.target.criterionVersion}`,
        )),
  );
  const prioritizedIds = new Set(
    prioritized.map((request) => request.requestId),
  );
  return [
    ...prioritized,
    ...prepared.filter((request) => !prioritizedIds.has(request.requestId)),
  ].slice(0, SCREEN_02_WORKFLOW_ASSESSMENT_BATCH_MAX_REQUESTS);
}

export async function buildScreen02WorkflowAssessmentBatch(
  state: Screen02WorkflowState,
  options: Screen02WorkflowControllerOptions,
): Promise<Screen02WorkflowAssessmentBatch | null> {
  if (!legacyHostAssessmentsEnabled(options) || !options.signingConfig) {
    return null;
  }
  const requests = preparedRequests(state);
  if (requests.length === 0) return null;
  const issuedAt = options.now();
  const expiresAt = new Date(Date.parse(issuedAt) + 120_000).toISOString();
  if (state.mode === "find") {
    const capabilities = await Promise.all(
      requests.map((request) =>
        createScreen02FindAssessmentCapability(
          {
            state,
            requestId: request.requestId,
            capabilityId: makeId(options, "find-capability"),
            issuedAt,
            expiresAt,
          },
          options.signingConfig!,
        ),
      ),
    );
    const bounded = buildScreen02FindModelContext(
      state,
      requests.map((request) => request.requestId),
    );
    return {
      schemaVersion: SCREEN_02_WORKFLOW_ASSESSMENT_BATCH_SCHEMA_VERSION,
      batchId: makeId(options, "find-assessment-batch"),
      runId: state.runId,
      mode: "find",
      requestIds: requests.map((request) => request.requestId),
      requiredTool: "submit_screen02_find_assessment_draft_v021",
      modelContext: {
        ...bounded,
        requests: capabilities.map((issued, index) => ({
          ...bounded.requests[index],
          capabilityToken: issued.capabilityToken,
          draftContract: screen02FindCapabilityDraftSchema(issued.capability),
        })),
      },
      prompt: buildScreen02FindAssessmentPrompt(bounded),
      issuedAt,
      expiresAt,
    };
  }
  const capabilities = await Promise.all(
    requests.map((request) =>
      createScreen02AuditAssessmentCapability(
        {
          state,
          requestId: request.requestId,
          capabilityId: makeId(options, "audit-capability"),
          issuedAt,
          expiresAt,
        },
        options.signingConfig!,
      ),
    ),
  );
  return {
    schemaVersion: SCREEN_02_WORKFLOW_ASSESSMENT_BATCH_SCHEMA_VERSION,
    batchId: makeId(options, "audit-assessment-batch"),
    runId: state.runId,
    mode: "audit",
    requestIds: requests.map((request) => request.requestId),
    requiredTool: "submit_screen02_audit_draft_v021",
    modelContext: {
      schemaVersion: "screen-02-audit-model-context-v1",
      purpose:
        "Prepare bounded provisional dossiers or early study assessments without deciding identity or rewriting source facts.",
      requests: capabilities.map((issued) => ({
        capabilityToken: issued.capabilityToken,
        draftContract: screen02AuditCapabilityDraftSchema(issued.capability),
        sourcePacket: issued.sourcePacket,
      })),
      outcomeValuesInspected: false,
    },
    prompt: [
      `Use the exact bounded ShockAudit Audit context for ${requests.length} request${requests.length === 1 ? "" : "s"}.`,
      "For each request, call submit_screen02_audit_draft_v021 exactly once with its capabilityToken, exact requestId, schemaVersion screen-02-audit-draft-submission-v1, and only the requested draft fields. You may add one orientation sibling with summary, three to five keyPoints, whoIsAffected, keyTiming, and importantCaveat; omit it rather than guessing. The optional orientation is validated separately and never controls dossier or assessment validity.",
      "For a dossier, describe only that possible match and its match-specific sources. For a confirmed-event assessment, name the exact confirmed title or listed alias at least once and make the fit, mechanism, measurement, concern, and checks specific to that event.",
      "A prose answer or delivered message does not complete a request. Do not confirm identity, submit an overall judgment, rewrite source facts, inspect realized outcomes, or claim causal validity.",
    ].join("\n"),
    issuedAt,
    expiresAt,
  };
}

export async function buildScreen02WorkflowClientSnapshot(
  state: Screen02WorkflowState,
  accessToken: string,
  options: Screen02WorkflowControllerOptions,
): Promise<Screen02WorkflowClientSnapshot> {
  const safe = requireScreen02WorkflowState(state);
  let assessmentBatch: Screen02WorkflowAssessmentBatch | null = null;
  if (legacyHostAssessmentsEnabled(options) && options.signingConfig) {
    try {
      assessmentBatch = await buildScreen02WorkflowAssessmentBatch(
        safe,
        options,
      );
    } catch {
      assessmentBatch = null;
    }
  }
  const continued =
    safe.mode === "find"
      ? safe.decision.continuedRevision !== null
      : safe.continuationHistory.length > 0;
  return {
    schemaVersion: SCREEN_02_WORKFLOW_CLIENT_SCHEMA_VERSION,
    runId: safe.runId,
    accessToken,
    mode: safe.mode,
    revision: safe.revision,
    stateFingerprint: fingerprintScreen02WorkflowState(safe),
    stateEnvelope:
      safe.mode === "find"
        ? encodeScreen02FindWorkflowStateEnvelope(safe)
        : encodeScreen02AuditWorkflowStateEnvelope(safe),
    assessmentAvailable:
      legacyHostAssessmentsEnabled(options) &&
      options.signingConfig !== null,
    assessmentBatch,
    handoff: continued
      ? buildScreen02WorkflowHandoff(safe, SHOCKAUDIT_VERSION, safe.updatedAt)
      : null,
  };
}

export function buildScreen02WorkflowSummary(
  state: Screen02WorkflowState,
  assessmentAvailable: boolean,
  message: string,
  outcome: Screen02WorkflowSummary["outcome"] = "applied",
): Screen02WorkflowSummary {
  const safe = requireScreen02WorkflowState(state);
  const count = (statuses: Screen02AssessmentRequest["status"][]) =>
    safe.assessmentRequests.filter((request) => statuses.includes(request.status))
      .length;
  return {
    schemaVersion: SCREEN_02_WORKFLOW_SUMMARY_SCHEMA_VERSION,
    screen: "screen-02",
    ok: outcome !== "conflict",
    outcome,
    mode: safe.mode,
    assessmentAvailable,
    preparedRequestCount: count(["prepared"]),
    deliveredRequestCount: count(["message-delivered"]),
    completedRequestCount: count(["completed"]),
    continuationReady:
      safe.mode === "find"
        ? safe.decision.continuedRevision !== null
        : safe.continuationHistory.length > 0,
    message,
  };
}
