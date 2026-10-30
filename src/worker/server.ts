import {
  officialDocumentElementHtml,
  readScreen02OfficialDocumentIdentity as screen02NativeOverviewIdentity,
  eurLexLocatorRecordId as screen02CelexLocatorId,
  ukLegislationLocatorRecordId as screen02UkLegislationLocatorId,
  eurLexDocumentMetadata as screen02OverviewMetadata,
  visibleOfficialDocumentLinks as screen02VisibleOverviewLinks,
  visibleOfficialDocumentHeadings as screen02VisibleOverviewHeadings,
  visibleOfficialDocumentText as screen02VisibleOverviewText,
  visibleOfficialDocumentTitles as screen02VisibleOverviewTitles,
  primaryOfficialDocumentHtml as screen02PrimaryOverviewHtml,
} from "./official-document-html";
import {
  McpServer,
  preloadSchemas,
  type StandardSchemaWithJSON,
} from "@modelcontextprotocol/server";
import { z } from "zod";

import {
  confirmScopeContract,
  createInitialState,
  draftScopeContract,
} from "../core/screen01-service";
import { HOST_REASONING_TASK_TYPES } from "../core/host-reasoning-task";
import {
  STAGE1_DRAFT_SCHEMA_VERSION,
  STAGE1_DRAFT_TOOL,
  STAGE1_PROOF_KIND,
  STAGE1_RESULT_SCHEMA_VERSION,
  createStage1ProofOpenResult,
  evaluateStage1AssessmentDraft,
  stage1MeasurementPotentialCategories,
  stage1OutcomePathwayCategories,
  stage1StudyFitCategories,
} from "../core/stage1-assessment-proof";
import {
  SCREEN_02_MAX_CANDIDATE_ITEMS,
  SCREEN_02_MAX_ITEM_VERSIONS,
  SCREEN_02_MAX_PREFERENCE_CRITERIA,
  SCREEN_02_MAX_PROPOSALS,
  SCREEN_02_MAX_SEARCH_ROUNDS,
  applyScreen02PreliminaryAssessmentRound,
  applyScreen02SearchRound,
  createScreen02Session,
  restoreScreen02Session,
  sameDeterministicJson,
  serializeDeterministicJson,
} from "../core/screen02-service";
import {
  SCREEN_02_MAX_COMPRESSED_STATE_BYTES,
  SCREEN_02_MAX_STATE_PAYLOAD_CHARACTERS,
  SCREEN_02_STATE_ENVELOPE_ENCODING,
  SCREEN_02_STATE_ENVELOPE_SCHEMA_VERSION,
  buildScreen02StateSummary,
  decodeScreen02StateEnvelope,
  encodeScreen02StateEnvelope,
} from "../core/screen02-state-envelope";
import { Screen02StateCapacityError } from
  "../core/screen02-state-capacity";
import {
  buildScreen02NativeQueryPlan,
  deduplicateScreen02Proposals,
  rankScreen02ProposalsBm25,
  screen02TreatmentAssignmentSignature,
  screen02StudyProfileIndustryTerms,
  stableScreen02ProposalId,
} from "../core/screen02-discovery";
import {
  canonicalScreen02FormalIdentifier,
  compareScreen02FormalIdentifiers,
  parseScreen02FormalIdentifier,
} from "../core/screen02-formal-identifier";
import {
  SCREEN02_DISCOVERY_MAX_QUERY_VARIANTS,
  SCREEN02_DISCOVERY_MAX_ROUNDS,
  SCREEN02_DISCOVERY_MIN_QUERY_VARIANTS,
  SCREEN02_DISCOVERY_QUALIFIED_CANDIDATE_TARGET,
  SCREEN02_DISCOVERY_RAW_CANDIDATE_MAX,
  SCREEN02_DISCOVERY_RAW_CANDIDATE_TARGET,
  SCREEN02_RELEVANCE_PROFILE_VERSION,
  distinctiveScreen02ResearchTerms,
  isScreen02StudyRelevanceProfile,
  requireReadyScreen02StudyRelevanceProfile,
  screen02IndustryRecoveryQuery,
  type Screen02PoolHostOfficialSourceLead,
  type Screen02StudyRelevanceProfile,
} from "../core/screen02-relevance-profile";
import {
  SCREEN02_CANDIDATE_QUALIFICATION_VERSION,
  fingerprintScreen02QualificationSources,
  qualifyAndRankScreen02FindProposals,
  qualifyScreen02FindProposal,
  screen02CurrentRunQualificationMatches,
  screen02QualificationCacheKey,
  type Screen02CandidateReviewInfluenceMap,
  type Screen02CandidateQualification,
  type Screen02QualificationLane,
} from "../core/screen02-qualification";
import {
  SCREEN_02_DOCUMENT_ACQUISITION_MAX_RECORDED_BYTES,
  SCREEN_02_DOCUMENT_ACQUISITION_MAX_RECORDED_LATENCY_MS,
  SCREEN_02_DOCUMENT_ACQUISITION_MAX_RECORDED_TOTAL_BYTES,
  SCREEN_02_DOCUMENT_ACQUISITION_SCHEMA_VERSION,
  sanitizeScreen02AcquisitionFailureReason,
  sanitizeScreen02AcquisitionUrl,
  type Screen02DocumentAcquisition,
  type Screen02DocumentAcquisitionLevel,
  type Screen02DocumentParserOutcome,
  type Screen02DocumentParserPath,
  type Screen02DocumentRedirectHop,
} from "../core/screen02-document-acquisition";
import {
  REVIEWED_SCREEN02_EVENT_REGISTRY,
  SCREEN02_DISCOVERY_EVENT_REGISTRY,
  SCREEN_02_EVENT_REGISTRY_VERSION,
  reviewedScreen02RegistryProposalMatchesResearchText,
} from "../core/screen02-registry";
import {
  PUBLIC_SCREEN02_EVENT_INDEX_PROPOSALS,
  SCREEN02_PUBLIC_EVENT_INDEX_CAPTURED_AT,
  SCREEN02_PUBLIC_EVENT_INDEX_VERSION,
  screen02PublicEventIndexMatchesScope,
} from "../core/screen02-public-event-index";
import {
  buildScreen02SearchFunnel,
  buildScreen02FindDiscoveryFromProposals,
  screen02FindPriorCandidateExclusionReason,
  screen02FindPriorCandidateMatch,
  type Screen02FindDiscoveryResult,
} from "../core/screen02-find-discovery";
import {
  buildReviewedScreen02AuditDiscovery,
  type Screen02AuditDiscoveryResult,
} from "../core/screen02-audit-discovery";
import {
  SCREEN_02_FIND_MAX_VISIBLE_CANDIDATES,
  activeScreen02FindCriteria,
  screen02FindRelevanceProfile,
} from "../core/screen02-find-workflow";
import {
  fingerprintScreen02WorkflowState,
  fingerprintScreen02WorkflowValue,
} from "../core/screen02-workflow-state";
import {
  SCREEN_02_CONTEXT_OFFICIAL_BRIDGE_SCHEMA_VERSION,
  screen02VisibleTitleFederalRegisterIdentifier,
  type Screen02ContextOfficialBridgeProvenance,
} from "../core/screen02-context-bridge";
import {
  SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_VERSION,
  buildScreen02RetainedResultBinding,
  buildScreen02RetrievalExecution,
  isScreen02ContextLead,
  type Screen02AuditState,
  type Screen02ContextLead,
  type Screen02FindState,
  type Screen02RetrievalBaselineExecution,
  type Screen02RetrievalRecoveryExecution,
  type Screen02RetainedResultOrigin,
  type Screen02RetainedResultQueryLane,
  type Screen02WorkflowSearchManifest,
  type Screen02WorkflowSource,
} from "../core/screen02-workflow-types";
import {
  SCREEN_02_PREFERENCE_VERSION,
  SCREEN_02_PRELIMINARY_ASSESSMENT_SCHEMA_VERSION,
  SCREEN_02_EXTERNALITY_RUBRIC_VERSION,
  SCREEN_02_POPULATION_APPLICABILITY_RUBRIC_VERSION,
  SCREEN_02_OUTCOME_PATHWAY_RUBRIC_VERSION,
  SCREEN_02_RUBRIC_VERSION,
  SCREEN_02_SCORING_FORMULA_VERSION,
  SCREEN_02_SEARCH_PROTOCOL_VERSION,
  SCREEN_02_SESSION_SCHEMA_VERSION,
  SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
  SCREEN_02_SOURCE_POLICY_VERSION,
  screen02ExternalShockPlausibilityCategories,
  screen02PopulationApplicabilityCategories,
  screen02OutcomePathwayCategories,
  screen02SemanticScopeFields,
  screen02AuditRepresentationTypes,
  screen02PreferenceKinds,
  screen02PreliminaryAssessmentJudgments,
  screen02ScoreComponentKeys,
  screen02SearchRequestTypes,
  type Screen02AuditProposal,
  type Screen02FindProposal,
  type Screen02PreferenceCriterion,
  type Screen02Proposal,
  type Screen02SearchManifestSupplement,
  type Screen02SearchRound,
  type Screen02Session,
  type Screen02Source,
} from "../core/screen02-types";
import { buildScreen01StudyContext } from "../core/study-context";
import type { Screen01StudyContext } from "../core/scope-types";
import { getAmbiguities } from "../core/scope-validation";
import { SIX_SCREEN_REPLACEMENT_BUILD } from
  "../core/six-screen/replacement-build";
import { modeCopy } from "../ui/screen-01/content";
import {
  SCREEN_01_UI_RESOURCE_URI,
  SHOCKAUDIT_PUBLIC_ORIGIN,
  SHOCKAUDIT_RELEASE_LABEL,
  SHOCKAUDIT_UI_BUILD_LABEL,
  SHOCKAUDIT_UI_RESOURCE_URI,
  SHOCKAUDIT_VERSION,
  STAGE1_PROOF_UI_RESOURCE_URI,
  SUPPORTED_SHOCKAUDIT_UI_RESOURCE_URIS,
} from "../version";
import {
  fetchFederalRegisterProposals,
  fetchOpenFemaDisasterProposals,
  type Screen02ConnectorFetch,
  type Screen02OfficialConnectorResult,
  type Screen02OfficialProposalBinding,
} from "./screen02-connectors";
import { fetchFtcPressReleaseProposals } from "./screen02-agency-connectors";
import { readScreen02BoundedResponseText } from "./screen02-bounded-response";
import { screen02ProductionPeerBoundFetch } from "./screen02-secure-transport";
import {
  fetchEuCellarLegalProposals,
  fetchGdacsDisasterProposals,
  fetchUkLegislationProposals,
  fetchUsgsEarthquakeProposals,
  type GdacsEventType,
} from "./screen02-global-connectors";
import {
  getScreen02SourceCatalogEntry,
  planScreen02SourceRoutes,
  type Screen02ConnectorId,
  type Screen02SourceRoute,
  type Screen02SourceRoutePlan,
} from "./screen02-source-router";
import {
  SCREEN_02_SEARCH_EXPANSION_DEADLINE_MS,
  SCREEN_02_SEARCH_EXPANSION_VERSION,
  buildScreen02AuditSearchResearchPlan,
  buildScreen02FindSearchResearchPlan,
  executeScreen02SearchExpansion,
  type Screen02SearchComparisonTelemetry,
  type Screen02ContextSearchLead,
  type Screen02ContextSearchProvider,
  type Screen02SearchPlanSourceInput,
  type Screen02SearchQueryVariant,
  type Screen02SearchRecordInput,
} from "./screen02-search-expansion";
import {
  createResearchAndReportingContextSearchProvider,
  screen02ContextLeadLane,
  selectScreen02ContextLeadSlots,
} from "./crossref-contextual-discovery";
import {
  SCREEN_02_WORKFLOW_CORRELATION_META_KEY,
  SCREEN_02_WORKFLOW_CREATE_SCHEMA_VERSION,
  SCREEN_02_WORKFLOW_CREATE_SCHEMA_VERSION_V024,
  SCREEN_02_WORKFLOW_CREATE_TOOL_V023,
  SCREEN_02_WORKFLOW_CREATE_TOOL_V024,
  SCREEN_02_WORKFLOW_META_KEY,
  SCREEN_02_WORKFLOW_OPEN_REQUEST_PREFIX,
  createScreen02WorkflowCorrelation,
} from "../core/screen02-workflow-client";
import {
  sealScreen02WorkflowClientSnapshot,
  validateScreen02ExportedResponseKeyMaterial,
} from "../core/screen02-sealed-result";
import {
  Screen02WorkflowRuntime,
  type Screen02WorkflowRuntimeOptions,
  type Screen02WorkflowSigningKeyring,
} from "./screen02-workflow-runtime";
import {
  createScreen02FindContinuationBinding,
  fingerprintScreen02FindContinuationOutcome,
  screen02FindContinuationHasPendingRetry,
  type Screen02FindContinuationFailureClass,
  type Screen02FindContinuationFailureStage,
  type Screen02FindContinuationRecord,
  type Screen02FindContinuationReservation,
  type Screen02FindContinuationStore,
  type Screen02FindContinuationWork,
} from "./screen02-find-continuation-store";
import {
  Screen02FindStoreCheckpointError,
  decodeScreen02FindStoreCheckpoint,
  encodeScreen02FindStoreCheckpoint,
  screen02FindStoreCheckpointBytes,
  type Screen02FindStoredStep,
} from "./screen02-find-continuation-checkpoint";
import type { Screen02WorkflowStore } from "./screen02-workflow-store";
import type { Screen03WorkflowStore } from "./screen03-workflow-store";
import type { HostReasoningTaskStore } from "./host-reasoning-task-store";
import { createHostReasoningWorkflowRuntime } from "./host-reasoning-task-workflow";
import {
  registerHostReasoningTaskTools,
  type HostReasoningToolExposure,
} from "./host-reasoning-task-tools";
import {
  registerScreen02WorkflowTools,
  screen02WorkflowSealedSummarySchema,
  screen02WorkflowSummarySchema,
} from "./screen02-workflow-tools";
import { assertScreen02FindSigningConfig } from "./screen02-find-assessment-security";
import { assertScreen02AuditSigningConfig } from "./screen02-audit-assessment-security";
import { registerScreen01HostDraftTools } from "./screen01-host-draft-tools";
import { Screen03WorkflowRuntime } from "./screen03-workflow-runtime";
import { registerScreen03WorkflowTools } from "./screen03-workflow-tools";
import type { SixScreenWorkflowStore } from
  "./six-screen-workflow-store";
import type { SixScreenResearchTaskStore } from
  "./six-screen-research-task-store";
import type { SixScreenEvidenceStore } from
  "./six-screen-evidence-store";
import type { Screen5OpenAILedgerStore } from
  "./screen5-openai-ledger";
import type { Screen4AssessmentStore } from
  "./screen4-assessment-store";
import type { Screen5OpenAIFetch } from "./screen5-openai-transport";
import { createScreen5OpenAITransport } from "./screen5-openai-transport";
import { SixScreenWorkflowRuntime } from
  "./six-screen-workflow-runtime";
import { registerSixScreenWorkflowTools } from "./six-screen-tools";
// Cloudflare bills request CPU separately from isolate module evaluation.
// Warm the MCP wire schemas once per isolate so initialize/resources requests
// do not pay the SDK's lazy schema-construction cost.
preloadSchemas();

export const UI_RESOURCE_URI = SCREEN_01_UI_RESOURCE_URI;
export const UI_RESOURCE_MIME = "text/html;profile=mcp-app";

// Twelve first-round legal queries can each contribute disjoint identities.
// Five rows per query preserves backfill while making the provider-side first
// round itself respect the global 60-unique-lead ceiling (12 * 5), rather than
// relying on a later common-pool slice after already generating up to 96.
const SCREEN02_LEGAL_QUERY_RESULT_LIMIT = 5;
const SCREEN02_FTC_CRAWL_DELAY_MS = 5_000;
let screen02FtcLiveRequestQueue = Promise.resolve<void>(undefined);
let screen02FtcNextLiveRequestAt = 0;

/**
 * Best-effort same-isolate serialization for the FTC's published crawl delay.
 * Tests and configured connector transports own their own scheduling; the
 * public global fetch path spaces FTC request starts by the crawl delay.
 * Responses may overlap when an earlier request lasts longer than that delay.
 */
function screen02FtcRequest(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" &&
      ["ftc.gov", "www.ftc.gov"].includes(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function screen02FtcSchedulerAbortError() {
  const error = new Error("FTC request was aborted before scheduler admission.");
  error.name = "AbortError";
  return error;
}

function waitForScreen02FtcAdmission(
  waitMs: number,
  signal?: AbortSignal,
) {
  if (signal?.aborted) {
    return Promise.reject(screen02FtcSchedulerAbortError());
  }
  if (waitMs <= 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, waitMs);
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(screen02FtcSchedulerAbortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function scheduleScreen02FtcLiveRequestStart(
  url: string,
  signal?: AbortSignal,
) {
  if (!screen02FtcRequest(url)) return Promise.resolve();
  if (signal?.aborted) {
    return Promise.reject(screen02FtcSchedulerAbortError());
  }
  const scheduled = screen02FtcLiveRequestQueue
    .catch(() => undefined)
    .then(async () => {
      if (signal?.aborted) throw screen02FtcSchedulerAbortError();
      const waitMs = Math.max(0, screen02FtcNextLiveRequestAt - Date.now());
      await waitForScreen02FtcAdmission(waitMs, signal);
      if (signal?.aborted) throw screen02FtcSchedulerAbortError();
      screen02FtcNextLiveRequestAt = Date.now() +
        SCREEN02_FTC_CRAWL_DELAY_MS;
    });
  screen02FtcLiveRequestQueue = scheduled.then(
    () => undefined,
    () => undefined,
  );
  return scheduled;
}

export type ShockAuditEnv = {
  ASSETS: Fetcher;
  CONNECTOR_FETCH?: Screen02ConnectorFetch;
  NOW?: () => string;
  /** Optional server-only credential for bounded exact-record GovInfo reads. */
  GOVINFO_API_KEY?: string;
  /** Optional source credentials are reported to health as booleans only. */
  CONGRESS_API_KEY?: string;
  REGULATIONS_API_KEY?: string;
  LEGISCAN_API_KEY?: string;
  OPENSTATES_API_KEY?: string;
  TAVILY_API_KEY?: string;
  BRAVE_API_KEY?: string;
  OPENALEX_API_KEY?: string;
  /** Server-only direct inference credential; never projected to the app. */
  OPENAI_API_KEY?: string;
  /** Explicit runtime mode; provider/model/effort are fixed in code. */
  SHOCKAUDIT_SCREEN5_OPENAI_MODE?: string;
  /** Safe local launcher identities; never credentials or production gates. */
  SHOCKAUDIT_LOCAL_LAUNCH_ID?: string;
  SHOCKAUDIT_LOCAL_CONFIG_ID?: string;
  /** Existing-DO OpenAI allowance owner and deterministic test seam. */
  SCREEN5_OPENAI_LEDGER_STORE?: Screen5OpenAILedgerStore;
  /** Compact Screen 4 event manifest and model-result owner in that same DO. */
  SCREEN4_ASSESSMENT_STORE?: Screen4AssessmentStore;
  SCREEN5_OPENAI_FETCH?: Screen5OpenAIFetch;
  /**
   * Guarded Screen 2 recall expansion. An unset or invalid value fails safe to
   * off. Isolated candidates may use shadow comparison without changing the
   * canonical discovery response; qualified v0.3.17 production remains on.
   */
  SCREEN02_SEARCH_EXPANSION_MODE?: "off" | "shadow" | "on";
  /**
   * Repository-managed public-event discovery. Production pins this on; the
   * off value exists only so focused connector/security tests can isolate the
   * live lane they exercise without changing the default product behavior.
   */
  SCREEN02_PUBLIC_EVENT_INDEX_MODE?: "off" | "on";
  /**
   * Historical host-briefing release metadata. v0.3.17 production sets this
   * to `off`; an absent or invalid value also fails closed to `off`.
   */
  SCREEN03_HOST_NATIVE_DEFAULT?: "off" | "on";
  /**
   * Optional trusted host seam for contextual discovery. The Worker has no
   * built-in arbitrary-web fallback; returned records are always downgraded
   * to unsupported leads before guarded merge.
   */
  SCREEN02_CONTEXT_SEARCH?: Screen02ContextSearchProvider;
  /** Injectable monotonic clock for deterministic telemetry tests. */
  SCREEN02_SEARCH_MONOTONIC_NOW?: () => number;
  /** Canonical v2.1 owner. Production supplies the Durable Object adapter. */
  SCREEN02_WORKFLOW_STORE?: Screen02WorkflowStore;
  /** Server-only resumable Find journal in the existing MCP_RUNTIME object. */
  SCREEN02_FIND_CONTINUATION_STORE?: Screen02FindContinuationStore;
  /** Screen 3 is a sibling child workflow authenticated by the Screen 2 run. */
  SCREEN03_WORKFLOW_STORE?: Screen03WorkflowStore;
  /** Shared-DO store for bounded optional ChatGPT-host task lifecycles. */
  HOST_REASONING_TASK_STORE?: HostReasoningTaskStore;
  /** Canonical state for the adopted six-screen replacement workflow. */
  SIX_SCREEN_WORKFLOW_STORE?: SixScreenWorkflowStore;
  /** Saved cumulative-budget tasks for the adopted replacement workflow. */
  SIX_SCREEN_RESEARCH_TASK_STORE?: SixScreenResearchTaskStore;
  /** Immutable versioned evidence for the adopted replacement workflow. */
  SIX_SCREEN_EVIDENCE_STORE?: SixScreenEvidenceStore;
  /**
   * Optional host actions fail closed until a genuine signed-in trace has
   * exercised prepare -> visible message -> model submission -> same-panel
   * reconciliation. The v0.6.2 release remains `experimental-off`.
   */
  SHOCKAUDIT_HOST_REASONING_MODE?:
    | "experimental-off"
    | "app-only"
    | "screen02-only"
    | "full";
  /** Server-internal per-Durable-Object mutation coordinator; never a binding. */
  SCREEN02_WORKFLOW_MUTATION_COORDINATOR?: import("./screen02-workflow-runtime").Screen02WorkflowMutationCoordinator;
  /** Local deterministic-test seam; ignored unless in-process MCP is enabled. */
  SCREEN02_HOST_ASSESSMENT_DEADLINE_MS?: number;
  SCREEN02_WORKFLOW_SIGNING_KEY?: string;
  SCREEN02_WORKFLOW_SIGNING_KEY_ID?: string;
  SCREEN02_WORKFLOW_PREVIOUS_SIGNING_KEY?: string;
  SCREEN02_WORKFLOW_PREVIOUS_SIGNING_KEY_ID?: string;
  /**
   * Explicit escape hatch for local unit tests and local development only.
   * The public Worker rejects this fallback on the stable production origin.
   */
  SHOCKAUDIT_LOCAL_DEV_IN_PROCESS_MCP?: "true";
  /**
   * Temporary Stage 1 acceptance previews use a deliberately minimal MCP
   * catalog. Production must leave this unset so the released tools and
   * compatibility resources remain available.
   */
  STAGE1_PREVIEW_ONLY?: "true";
  /**
   * Second, preview-specific deployment assertion. STAGE1_PREVIEW_ONLY is
   * rejected unless this is also set, and both are rejected on production.
   */
  SHOCKAUDIT_STAGE1_PREVIEW_DEPLOYMENT?: "true";
};

function screen02DocumentFetch(env: ShockAuditEnv): Screen02ConnectorFetch {
  return env.CONNECTOR_FETCH ?? screen02ProductionPeerBoundFetch;
}

export function screen5OpenAIInferenceFetch(
  env: Pick<ShockAuditEnv, "SCREEN5_OPENAI_FETCH">,
): Screen5OpenAIFetch {
  return createScreen5OpenAITransport(
    env.SCREEN5_OPENAI_FETCH ?? ((input, init) => globalThis.fetch(input, init)),
  );
}

function screen02ContextSearchProvider(env: ShockAuditEnv) {
  if (env.SCREEN02_CONTEXT_SEARCH) return env.SCREEN02_CONTEXT_SEARCH;
  if (screen02SearchExpansionMode(env) === "off") return undefined;
  const fetchImpl: Screen02ConnectorFetch =
    env.CONNECTOR_FETCH ?? ((input, init) => globalThis.fetch(input, init));
  return createResearchAndReportingContextSearchProvider(fetchImpl);
}

export const SHOCKAUDIT_HOST_REASONING_META_KEY =
  "shockaudit/hostReasoning" as const;

export const SHOCKAUDIT_HOST_REASONING_TASK_TYPES =
  HOST_REASONING_TASK_TYPES;

export const SHOCKAUDIT_ACTIVE_HOST_REASONING_TASK_TYPES =
  HOST_REASONING_TASK_TYPES.filter((taskType) =>
    taskType !== "screen05-theoretical-planning" &&
    taskType !== "screen05-study-mechanism-comparison"
  );

export type ShockAuditHostReasoningMode =
  NonNullable<ShockAuditEnv["SHOCKAUDIT_HOST_REASONING_MODE"]>;

export type ShockAuditHostReasoningMetadata = {
  mode: ShockAuditHostReasoningMode;
  enabled: boolean;
  genuineTraceCount: number;
  availableTaskTypes: Array<
    (typeof SHOCKAUDIT_HOST_REASONING_TASK_TYPES)[number]
  >;
};

export function hostReasoningToolExposure(
  env: Pick<ShockAuditEnv, "SHOCKAUDIT_HOST_REASONING_MODE">,
): HostReasoningToolExposure {
  if (env.SHOCKAUDIT_HOST_REASONING_MODE === "full") return "full";
  if (env.SHOCKAUDIT_HOST_REASONING_MODE === "screen02-only") {
    return "screen02-only";
  }
  if (env.SHOCKAUDIT_HOST_REASONING_MODE === "app-only") return "app-only";
  return "disabled";
}

export function hostReasoningMetadata(
  env: Pick<ShockAuditEnv, "SHOCKAUDIT_HOST_REASONING_MODE">,
): ShockAuditHostReasoningMetadata {
  const mode = env.SHOCKAUDIT_HOST_REASONING_MODE === "app-only" ||
      env.SHOCKAUDIT_HOST_REASONING_MODE === "screen02-only" ||
      env.SHOCKAUDIT_HOST_REASONING_MODE === "full"
    ? env.SHOCKAUDIT_HOST_REASONING_MODE
    : "experimental-off";
  const enabled = mode === "screen02-only" || mode === "full";
  return {
    mode,
    enabled,
    genuineTraceCount: 0,
    availableTaskTypes: mode === "full"
      ? [...SHOCKAUDIT_ACTIVE_HOST_REASONING_TASK_TYPES]
      : mode === "screen02-only"
        ? ["screen02-search-review"]
        : [],
  };
}

async function retireAllHostReasoningTasks(
  store: HostReasoningTaskStore,
  runId: string,
) {
  // Superseded and terminal tasks retain their run index until their parent is
  // retired. Drain every bounded batch now because the deleted parent cannot
  // trigger a later cascade for any rows left behind.
  while ((await store.retireRun(runId)).batchLimitReached) {
    // Continue until the run index is empty.
  }
}

/**
 * The stateless MCP factory runs once per request on Cloudflare. Zod's
 * Standard Schema adapter otherwise regenerates JSON Schema while each tool is
 * registered, which is needlessly expensive and can exhaust the free Worker
 * CPU allowance as the app grows. Convert once at module startup, then retain
 * Zod validation for every actual tool call.
 */
function cachedZodSchema<Schema extends z.ZodType>(
  schema: Schema,
): StandardSchemaWithJSON<z.input<Schema>, z.output<Schema>> {
  const inputJsonSchema = z.toJSONSchema(schema, {
    target: "draft-2020-12",
    io: "input",
    unrepresentable: "any",
  });
  const outputJsonSchema = z.toJSONSchema(schema, {
    target: "draft-2020-12",
    io: "output",
    unrepresentable: "any",
  });

  return {
    "~standard": {
      version: 1,
      vendor: "shockaudit-zod-cache",
      validate: (value) => {
        const result = schema.safeParse(value);
        if (result.success) return { value: result.data };
        return {
          issues: result.error.issues.map((issue) => ({
            message: issue.message,
            path: issue.path,
          })),
        };
      },
      jsonSchema: {
        input: () => inputJsonSchema,
        output: () => outputJsonSchema,
      },
    },
  };
}

const modeSchema = z.enum(["find", "audit"]);
const scopeValueSchema = z.string().max(200);
const scopeFieldKeySchema = z.enum([
  "population",
  "assignmentLevel",
  "analysisLevel",
  "geography",
  "industry",
  "studyPeriod",
  "eventFamily",
  "outcomeFamily",
  "outcomeFrequency",
]);
const resolvedKeySchema = z.enum([
  ...scopeFieldKeySchema.options,
  "knownShock",
]);
const scopeAlignmentAcknowledgmentSchema = z
  .object({
    key: scopeFieldKeySchema,
    sentence: z.string().max(350),
    scopeValue: scopeValueSchema,
  })
  .strict();

const scopeSchema = z
  .object({
    population: scopeValueSchema,
    assignmentLevel: scopeValueSchema,
    analysisLevel: scopeValueSchema,
    geography: scopeValueSchema,
    industry: scopeValueSchema,
    studyPeriod: scopeValueSchema,
    eventFamily: scopeValueSchema,
    outcomeFamily: scopeValueSchema,
    outcomeFrequency: scopeValueSchema,
  })
  .strict();

const stateSchema = z.object({
  revision: z.number().int().nonnegative(),
  mode: modeSchema,
  sentence: z.string().max(350),
  contractSourceSentence: z.string().max(350),
  scope: scopeSchema,
  knownShock: z.string().max(200),
  resolvedKeys: z.array(resolvedKeySchema).max(10),
  acknowledgedDifferences: z
    .array(scopeAlignmentAcknowledgmentSchema)
    .max(9)
    .optional(),
  scopeDirty: z.boolean(),
  confirmed: z.boolean(),
});

const ambiguitySchema = z
  .object({
    key: resolvedKeySchema,
    title: z.string().max(300),
    question: z.string().max(1_000),
    choices: z
      .array(
        z
          .object({
            label: z.string().max(200),
            value: z.string().max(200),
            recommended: z.boolean().optional(),
          })
          .strict(),
      )
      .max(20)
      .optional(),
  })
  .strict();

const studyContextSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    // The immutable Screen 1 baseline may have been produced by v0.1.1.
    // Compatibility is enforced by requireReadyScreen01Context in the core.
    appVersion: z.string().min(1).max(32),
    sourceScreen: z.literal("screen-01"),
    startingPoint: modeSchema,
    studySentence: z.string().max(350),
    contractSourceSentence: z.string().max(350),
    knownShock: z.string().max(200),
    scopeContract: scopeSchema,
    resolvedKeys: z.array(resolvedKeySchema).max(10),
    acknowledgedDifferences: z
      .array(scopeAlignmentAcknowledgmentSchema)
      .max(9)
      .optional(),
    unresolvedDecisions: z.array(ambiguitySchema).max(10),
    scopeDirty: z.boolean(),
    confirmed: z.boolean(),
    readyForLaterScreens: z.boolean(),
    revision: z.number().int().nonnegative(),
  })
  .strict();

const workflowOutputSchema = z
  .object({
    screen: z.literal("screen-01"),
    ok: z.boolean(),
    error: z.string(),
    state: z
      .unknown()
      .describe(
        "Complete Screen 1 workspace state returned to the app.",
      ),
    ambiguities: z
      .array(z.unknown())
      .describe(
        "Unresolved Screen 1 decisions returned to the app.",
      ),
    studyContext: z
      .unknown()
      .describe(
        "Canonical Screen01StudyContext. Preserve every value exactly for Screen 2 and later screens.",
      ),
  })
  .strict();

const boundedIdSchema = z.string().min(1).max(100);
const boundedTitleSchema = z.string().min(1).max(240);
const boundedDescriptionSchema = z.string().min(1).max(1_000);
const boundedReasonSchema = z.string().min(1).max(600);
const boundedLabelSchema = z.string().min(1).max(200);
const boundedLocatorSchema = z.string().min(1).max(2_048);
const boundedDateSchema = z.string().min(1).max(64);
const scoreValueSchema = z.number().min(0).max(100).nullable();
const authorityTierSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);
const hardFilterKeySchema = z.enum([
  "geography",
  "studyPeriod",
  "population",
  "eventFamily",
]);
const hardFilterStatusSchema = z.enum(["pass", "review", "fail"]);

const screen02SourceSchema = z
  .object({
    id: boundedIdSchema,
    title: boundedTitleSchema,
    locator: boundedLocatorSchema,
    publisher: boundedLabelSchema,
    publishedDate: boundedDateSchema.nullable(),
    authorityTier: authorityTierSchema,
    authorityAssessment: z
      .object({
        method: z.enum([
          "connector-native",
          "system-domain-rule",
          "ai-rubric",
          "researcher-confirmed",
          "unverified",
        ]),
        reason: boundedReasonSchema,
        policyVersion: z.literal(SCREEN_02_SOURCE_POLICY_VERSION),
      })
      .strict()
      .optional(),
    channel: z.string().min(1).max(100),
    retrievedAt: boundedDateSchema.optional(),
    evidenceText: z.string().trim().min(1).max(12_000).optional(),
    isFictionalDemo: z.literal(true).optional(),
  })
  .strict();

const screen02ProposalSourceSchema = screen02SourceSchema.extend({
  authorityAssessment: z
    .object({
      method: z.enum([
        "connector-native",
        "system-domain-rule",
        "ai-rubric",
        "unverified",
      ]),
      reason: boundedReasonSchema,
      policyVersion: z.literal(SCREEN_02_SOURCE_POLICY_VERSION),
    })
    .strict()
    .optional(),
});

const sourceEstablishedPopulationSchema = z
  .object({
    text: boundedReasonSchema,
    evidenceSourceIds: z.array(boundedIdSchema).min(1).max(50),
  })
  .strict();

function assessmentInputSchema(
  categories: readonly [string, ...string[]],
  unresolvedCategories: readonly string[] = ["unknown"],
  includeSourceEstablishedPopulation = false,
) {
  return z
    .object({
      value: scoreValueSchema.optional(),
      category: z.enum(categories).optional(),
      ...(includeSourceEstablishedPopulation
        ? {
            sourceEstablishedPopulation:
              sourceEstablishedPopulationSchema.nullable().optional(),
          }
        : {}),
      reason: boundedReasonSchema,
      evidenceSourceIds: z.array(boundedIdSchema).max(50).optional(),
      method: z
        .enum(["ai-rubric", "researcher-specified"])
        .optional(),
      confidence: z.enum(["low", "medium", "high"]).optional(),
      unresolved: z.array(boundedReasonSchema).max(30).optional(),
    })
    .strict()
    .superRefine((assessment, context) => {
      const method = assessment.method ?? "ai-rubric";
      if (method === "ai-rubric") {
        if (assessment.category === undefined) {
          context.addIssue({
            code: "custom",
            message:
              "AI-rubric assessments require a recognized rubric category.",
          });
        }
        if (assessment.value !== undefined) {
          context.addIssue({
            code: "custom",
            message:
              "AI-rubric assessments cannot supply an arbitrary numeric value.",
          });
        }
        if (assessment.evidenceSourceIds === undefined) {
          context.addIssue({
            code: "custom",
            path: ["evidenceSourceIds"],
            message:
              "AI-rubric assessments must explicitly cite attached source IDs; use an empty array only when the published category is unknown.",
          });
        } else if (
          assessment.category !== undefined &&
          !unresolvedCategories.includes(assessment.category) &&
          assessment.evidenceSourceIds.length === 0
        ) {
          context.addIssue({
            code: "custom",
            path: ["evidenceSourceIds"],
            message:
              "A known AI-rubric judgment requires at least one attached source ID; only an unknown or unclear category may use an empty array.",
          });
        }
        if (includeSourceEstablishedPopulation) {
          const sourcePopulation =
            "sourceEstablishedPopulation" in assessment
              ? (assessment.sourceEstablishedPopulation as
                  | {
                      text: string;
                      evidenceSourceIds: string[];
                    }
                  | null
                  | undefined)
              : undefined;
          if (sourcePopulation === undefined) {
            context.addIssue({
              code: "custom",
              path: ["sourceEstablishedPopulation"],
              message:
                "Population applicability must provide sourceEstablishedPopulation as a cited record or null.",
            });
          } else if (
            sourcePopulation === null &&
            assessment.category !== "unknown"
          ) {
            context.addIssue({
              code: "custom",
              path: ["sourceEstablishedPopulation"],
              message:
                "Only an unknown population-applicability judgment may use null when current cited sources establish no population.",
            });
          } else if (sourcePopulation !== null) {
            const uniqueSourceIds = new Set(
              sourcePopulation.evidenceSourceIds,
            );
            if (
              uniqueSourceIds.size !==
                sourcePopulation.evidenceSourceIds.length ||
              sourcePopulation.evidenceSourceIds.some(
                (sourceId) =>
                  !(assessment.evidenceSourceIds ?? []).includes(sourceId),
              )
            ) {
              context.addIssue({
                code: "custom",
                path: [
                  "sourceEstablishedPopulation",
                  "evidenceSourceIds",
                ],
                message:
                  "Source-population evidence IDs must be unique and also listed on populationApplicability.",
              });
            }
          }
        }
      } else if (assessment.value === undefined) {
        context.addIssue({
          code: "custom",
          message:
            "Researcher-specified assessments require an explicit numeric or null value.",
        });
      }
    });
}

const screen02ProposalAssessmentsSchema = z
  .object({
    externalShockPlausibility: assessmentInputSchema(
      screen02ExternalShockPlausibilityCategories,
    ).optional(),
    populationApplicability: assessmentInputSchema(
      screen02PopulationApplicabilityCategories,
      ["unknown"],
      true,
    ).optional(),
    outcomePathway: assessmentInputSchema(
      screen02OutcomePathwayCategories,
      ["unclear"],
    ).optional(),
    exposureObservability: assessmentInputSchema([
      "directly-observable",
      "observable-with-linkage",
      "proxy-dependent",
      "weakly-observable",
      "unavailable",
      "unknown",
    ]).optional(),
    timeSupport: assessmentInputSchema([
      "ample",
      "adequate",
      "limited",
      "weak",
      "none",
      "unknown",
    ]).optional(),
    variation: assessmentInputSchema([
      "strong",
      "usable",
      "uncertain",
      "weak",
      "none",
      "unknown",
    ]).optional(),
  })
  .strict();

const hardFilterResultSchema = z
  .object({
    key: hardFilterKeySchema,
    status: hardFilterStatusSchema,
    reason: boundedReasonSchema,
  })
  .strict();

const screen02SharedCardShape = {
  origin: z.enum([
    "registry-reviewed",
    "newly-discovered",
    "user-provided",
    "fictional-demonstration",
    "unsupported-lead",
  ]),
  provisionalDates: z.array(boundedLabelSchema).max(30),
  affectedPopulation: z.string().min(1).max(2_000),
  requiredVariables: z.array(z.string().min(1).max(500)).max(30),
  outcomeLink: z
    .object({
      text: z.string().min(1).max(2_000),
      status: z.enum(["ai-hypothesis", "system-template"]),
    })
    .strict(),
  likelyServiceLevel: z.enum([
    "full-audit",
    "assisted-audit",
    "event-reconnaissance",
    "stop",
  ]),
  limitations: z.array(z.string().min(1).max(2_000)).max(30),
  reasons: z.array(z.string().min(1).max(2_000)).max(30),
};

const screen02FindProposalSchema = z
  .object({
    ...screen02SharedCardShape,
    id: boundedIdSchema,
    mode: z.literal("find"),
    kind: z.literal("event"),
    title: boundedTitleSchema,
    description: boundedDescriptionSchema,
    nativeIdentity: z
      .object({
        formalIdentifier: z.string().min(1).max(500).nullable(),
        issuer: z.string().min(1).max(500).nullable(),
        issuingJurisdiction: z.string().min(1).max(500).nullable(),
        status: z.string().min(1).max(500).nullable(),
      })
      .strict()
      .optional(),
    relationshipEvidenceSourceIds: z
      .array(boundedIdSchema)
      .max(12)
      .optional(),
    event: z
      .object({
        displayName: boundedTitleSchema,
        eventDate: boundedDateSchema,
        eventFamily: boundedLabelSchema,
        geographies: z.array(boundedLabelSchema).min(1).max(12),
        populations: z.array(boundedLabelSchema).min(1).max(12),
      })
      .strict(),
    sources: z.array(screen02ProposalSourceSchema).max(50),
    assessments: screen02ProposalAssessmentsSchema.optional(),
    fictionalDemo: z.literal(true).optional(),
  })
  .strict();

const screen02AuditProposalSchema = z
  .object({
    ...screen02SharedCardShape,
    id: boundedIdSchema,
    mode: z.literal("audit"),
    kind: z.literal("representation"),
    representationType: z.enum(screen02AuditRepresentationTypes),
    title: boundedTitleSchema,
    description: boundedDescriptionSchema,
    candidateConstruct: boundedTitleSchema,
    operationalization: boundedDescriptionSchema,
    sources: z.array(screen02ProposalSourceSchema).max(50),
    assessments: screen02ProposalAssessmentsSchema.optional(),
    hardFilterEvidence: z
      .object({
        geography: hardFilterResultSchema.optional(),
        studyPeriod: hardFilterResultSchema.optional(),
        population: hardFilterResultSchema.optional(),
        eventFamily: hardFilterResultSchema.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const screen02ProposalSchema = z.discriminatedUnion("mode", [
  screen02FindProposalSchema,
  screen02AuditProposalSchema,
]);

const queryLogSchema = z
  .object({
    id: boundedIdSchema,
    query: z.string().min(1).max(2_000),
    purpose: z.string().min(1).max(2_000),
    returnedRecordIds: z.array(boundedIdSchema).max(100).optional(),
  })
  .strict();

const channelLogSchema = z
  .object({
    channel: z.string().min(1).max(100),
    status: z.enum(["searched", "not-searched", "failed"]),
    note: z.string().max(2_000),
    retrievedAt: boundedDateSchema.optional(),
  })
  .strict();

const stoppingRuleSchema = z
  .object({
    rule: z.string().min(1).max(2_000),
    status: z.enum(["not-started", "met", "not-met"]),
    note: z.string().max(2_000),
  })
  .strict();

const searchManifestSupplementSchema = z
  .object({
    queryMatrix: z.array(queryLogSchema).max(30).optional(),
    channels: z.array(channelLogSchema).max(20).optional(),
    stoppingRule: stoppingRuleSchema.optional(),
  })
  .strict();

const semanticDecisionInputSchema = z
  .object({
    itemId: boundedIdSchema,
    decision: z.enum(["retained", "excluded"]),
    criterionIds: z.array(boundedIdSchema).max(3),
    scopeMismatchFields: z
      .array(z.enum(screen02SemanticScopeFields))
      .max(screen02SemanticScopeFields.length)
      .optional(),
    reason: boundedReasonSchema,
  })
  .strict();

const scoreComponentsSchema = z
  .object({
    scopeFit: scoreValueSchema,
    sourceAuthority: scoreValueSchema,
    exposureObservability: scoreValueSchema,
    timeSupport: scoreValueSchema,
    variation: scoreValueSchema,
  })
  .strict();

const scoreReasonsSchema = z
  .object({
    scopeFit: z.string().max(1_000),
    sourceAuthority: z.string().max(1_000),
    exposureObservability: z.string().max(1_000),
    timeSupport: z.string().max(1_000),
    variation: z.string().max(1_000),
  })
  .strict();

const componentDetailSchema = z
  .object({
    method: z.enum([
      "system-computed",
      "ai-rubric",
      "researcher-specified",
    ]),
    category: z.string().min(1).max(500),
    criteria: z.array(z.string().min(1).max(2_000)).max(30),
    evidenceSourceIds: z.array(boundedIdSchema).max(50),
    reason: z.string().min(1).max(2_000),
    confidence: z.enum(["low", "medium", "high"]),
    unresolved: z.array(z.string().min(1).max(2_000)).max(30),
    rubricVersion: z.literal(SCREEN_02_RUBRIC_VERSION),
  })
  .strict();

const componentDetailsSchema = z
  .object({
    scopeFit: componentDetailSchema,
    sourceAuthority: componentDetailSchema,
    exposureObservability: componentDetailSchema,
    timeSupport: componentDetailSchema,
    variation: componentDetailSchema,
  })
  .strict();

const scorecardSchema = z
  .object({
    formulaVersion: z.literal(SCREEN_02_SCORING_FORMULA_VERSION),
    components: scoreComponentsSchema,
    componentReasons: scoreReasonsSchema,
    componentDetails: componentDetailsSchema,
    overall: scoreValueSchema,
    overallRange: z
      .object({
        minimum: z.number().min(0).max(100),
        maximum: z.number().min(0).max(100),
      })
      .strict(),
    reason: z.string().max(1_000),
    coverage: z
      .object({
        knownComponents: z.number().int().min(0).max(5),
        totalComponents: z.literal(5),
        knownWeight: z.number().min(0).max(1),
        knownWeightPercent: z.number().min(0).max(100),
      })
      .strict(),
  })
  .strict();

const byAuthorityTierSchema = z
  .object({
    1: z.number().int().nonnegative(),
    2: z.number().int().nonnegative(),
    3: z.number().int().nonnegative(),
    4: z.number().int().nonnegative(),
    5: z.number().int().nonnegative(),
    6: z.number().int().nonnegative(),
  })
  .strict();

const sourceSummarySchema = z
  .object({
    uniqueSourceCount: z.number().int().nonnegative(),
    byAuthorityTier: byAuthorityTierSchema,
    strongestAuthorityTier: authorityTierSchema.nullable(),
    authorityScore: scoreValueSchema,
  })
  .strict();

const screen02ItemBaseShape = {
  ...screen02SharedCardShape,
  id: boundedIdSchema,
  title: boundedTitleSchema,
  description: boundedDescriptionSchema,
  provisional: z.boolean(),
  evidenceStatus: z.enum([
    "assessed",
    "partial",
    "reconnaissance-required",
    "fictional-demonstration",
  ]),
  sources: z.array(screen02SourceSchema).max(50),
  sourceSummary: sourceSummarySchema,
  hardFilters: z.array(hardFilterResultSchema).length(4),
  scorecard: scorecardSchema,
  externalShockPlausibility: z
    .object({
      method: z.literal("ai-rubric"),
      category: z.enum(screen02ExternalShockPlausibilityCategories),
      criteria: z.array(z.string().min(1).max(2_000)).max(30),
      evidenceSourceIds: z.array(boundedIdSchema).max(50),
      reason: z.string().min(1).max(2_000),
      confidence: z.enum(["low", "medium", "high"]),
      unresolved: z.array(z.string().min(1).max(2_000)).max(30),
      rubricVersion: z.literal(SCREEN_02_EXTERNALITY_RUBRIC_VERSION),
    })
    .strict()
    .optional(),
  populationApplicability: z
    .object({
      method: z.literal("ai-rubric"),
      category: z.enum(screen02PopulationApplicabilityCategories),
      criteria: z.array(z.string().min(1).max(2_000)).max(30),
      evidenceSourceIds: z.array(boundedIdSchema).max(50),
      sourceEstablishedPopulation:
        sourceEstablishedPopulationSchema.nullable().optional(),
      reason: z.string().min(1).max(2_000),
      confidence: z.enum(["low", "medium", "high"]),
      unresolved: z.array(z.string().min(1).max(2_000)).max(30),
      rubricVersion: z.literal(
        SCREEN_02_POPULATION_APPLICABILITY_RUBRIC_VERSION,
      ),
    })
    .strict()
    .optional(),
  outcomePathway: z
    .object({
      method: z.literal("ai-rubric"),
      category: z.enum(screen02OutcomePathwayCategories),
      criteria: z.array(z.string().min(1).max(2_000)).max(30),
      evidenceSourceIds: z.array(boundedIdSchema).max(50),
      reason: z.string().min(1).max(2_000),
      confidence: z.enum(["low", "medium", "high"]),
      unresolved: z.array(z.string().min(1).max(2_000)).max(30),
      rubricVersion: z.literal(SCREEN_02_OUTCOME_PATHWAY_RUBRIC_VERSION),
    })
    .strict()
    .optional(),
  preliminaryAssessment: z
    .object({
      schemaVersion: z.literal(
        SCREEN_02_PRELIMINARY_ASSESSMENT_SCHEMA_VERSION,
      ),
      method: z.literal("ai-preliminary"),
      judgment: z.enum(screen02PreliminaryAssessmentJudgments),
      studyFit: z.string().min(1).max(2_000),
      affectedPopulation: z.string().min(1).max(2_000).nullable(),
      outcomeMechanism: z.string().min(1).max(2_000).nullable(),
      mainConcern: z.string().min(1).max(2_000),
      evidenceSourceIds: z.array(boundedIdSchema).max(50),
      nextChecks: z.array(z.string().min(1).max(2_000)).min(1).max(2),
      rootNativeRoundId: boundedIdSchema,
      assessedAtRevision: z.number().int().nonnegative(),
    })
    .strict()
    .optional(),
  rank: z.number().int().positive(),
};

const screen02FindItemSchema = z
  .object({
    ...screen02ItemBaseShape,
    mode: z.literal("find"),
    kind: z.literal("event"),
    event: z
      .object({
        displayName: boundedTitleSchema,
        eventDate: boundedDateSchema,
        eventFamily: boundedLabelSchema,
        geographies: z.array(boundedLabelSchema).min(1).max(12),
        populations: z.array(boundedLabelSchema).min(1).max(12),
      })
      .strict(),
  })
  .strict();

const screen02AuditItemSchema = z
  .object({
    ...screen02ItemBaseShape,
    mode: z.literal("audit"),
    kind: z.literal("representation"),
    representationType: z.enum(screen02AuditRepresentationTypes),
    anchorShock: boundedLabelSchema,
    candidateConstruct: boundedTitleSchema,
    operationalization: boundedDescriptionSchema,
  })
  .strict();

const screen02ItemSchema = z.discriminatedUnion("mode", [
  screen02FindItemSchema,
  screen02AuditItemSchema,
]);

const screen02ItemVersionSchema = z
  .object({
    versionId: z.string().min(1).max(120),
    itemId: z.string().min(1).max(120),
    itemFingerprint: z.string().min(1).max(120),
    recordedAtRevision: z.number().int().nonnegative(),
    item: screen02ItemSchema,
  })
  .strict();

const searchManifestSchema = z
  .object({
    queryMatrix: z.array(queryLogSchema).max(30),
    channels: z.array(channelLogSchema).max(20),
    hardFilters: z
      .array(
        z
          .object({
            key: hardFilterKeySchema,
            requiredValue: boundedLabelSchema,
          })
          .strict(),
      )
      .length(4),
    exclusions: z
      .array(
        z
          .object({
            proposalId: boundedIdSchema,
            filter: z.union([
              hardFilterKeySchema,
              z.literal("validation"),
            ]),
            reason: boundedReasonSchema,
          })
          .strict(),
      )
      .max(1_280),
    stoppingRule: stoppingRuleSchema,
    coverage: z
      .object({
        status: z.enum([
          "no-results",
          "reconnaissance",
          "partial",
          "complete",
        ]),
        proposalsReceived: z.number().int().nonnegative().max(320),
        itemsRetained: z.number().int().nonnegative().max(40),
        uniqueSourcesLocated: z.number().int().nonnegative().max(500),
        reason: z.string().max(2_000),
      })
      .strict(),
    outcomeValuesInspected: z.literal(false),
  })
  .strict();

const preferenceCriterionSchema = z
  .object({
    id: z.string().min(1).max(120),
    kind: z.enum(screen02PreferenceKinds),
    text: z.string().min(1).max(2_000),
    source: z.enum(["researcher", "ai-interpretation"]),
    exactRequest: z.string().min(1).max(2_000),
  })
  .strict();

const preferenceRequestSchema = z
  .object({
    id: z.string().min(1).max(120),
    exactText: z.string().min(1).max(2_000),
    criteriaIds: z.array(z.string().min(1).max(120)).max(40),
    interpretationSource: z.enum([
      "researcher-structured",
      "ai-interpretation",
    ]),
  })
  .strict();

const preferenceAssessmentSchema = z
  .object({
    itemId: z.string().min(1).max(120),
    score: scoreValueSchema,
    matchedCriteriaIds: z.array(z.string().min(1).max(120)).max(40),
    unmetRequiredCriteriaIds: z
      .array(z.string().min(1).max(120))
      .max(40),
    reasons: z.array(z.string().min(1).max(2_000)).max(30),
    computedAtRevision: z.number().int().nonnegative(),
  })
  .strict();

const discoveryRankingSchema = z
  .object({
    proposalId: z.string().min(1).max(180),
    stableProposalId: z.string().min(1).max(180),
    rank: z.number().int().positive().max(40),
    rankScore: z.number().finite(),
    matchedTerms: z.array(z.string().min(1).max(120)).max(100),
  })
  .strict();

const discoveryClusterSchema = z
  .object({
    clusterId: z.string().min(1).max(180),
    canonicalProposalId: z.string().min(1).max(180),
    memberProposalIds: z.array(z.string().min(1).max(180)).max(40),
    duplicateProposalIds: z.array(z.string().min(1).max(180)).max(40),
  })
  .strict();

const searchRoundSchema = z
  .object({
    id: z.string().min(1).max(120),
    revision: z.number().int().nonnegative(),
    requestType: z.enum(screen02SearchRequestTypes),
    stage: z
      .enum([
        "initial",
        "native-retrieval",
        "ai-review",
        "preliminary-assessment",
        "researcher-assessment",
      ])
      .optional(),
    exactRequest: z.string().min(1).max(2_000),
    retrievedAt: z.string().min(1).max(500),
    searchProtocolVersion: z.literal(
      SCREEN_02_SEARCH_PROTOCOL_VERSION,
    ),
    preferenceCriteriaIds: z
      .array(z.string().min(1).max(180))
      .max(40),
    proposalIdsReceived: z
      .array(z.string().min(1).max(180))
      .max(40),
    itemIdsRetained: z.array(z.string().min(1).max(180)).max(40),
    itemIdsAdded: z.array(z.string().min(1).max(180)).max(40),
    duplicateProposalIds: z
      .array(z.string().min(1).max(180))
      .max(40),
    rejectedItemIds: z.array(z.string().min(1).max(180)).max(40),
    assessedItemVersionIds: z
      .array(z.string().min(1).max(180))
      .max(40),
    activeItemVersionIds: z
      .array(z.string().min(1).max(180))
      .max(40),
    assessmentParentRoundId: boundedIdSchema.optional(),
    rootNativeRoundId: boundedIdSchema.optional(),
    assessmentResults: z
      .array(
        z
          .object({
            itemId: boundedIdSchema,
            status: z.enum(["assessed", "needs-retry"]),
            reason: z.string().min(1).max(2_000),
          })
          .strict(),
      )
      .max(SCREEN_02_MAX_PROPOSALS)
      .optional(),
    shockEvidence: z
      .object({
        status: z.literal("shock-level-reconnaissance"),
        anchorShock: boundedTitleSchema,
        matchMethod: z.literal("exact-name-or-controlled-alias"),
        proposalIds: z.array(z.string().min(1).max(180)).max(40),
        candidateNames: z.array(boundedTitleSchema).max(40),
        sources: z.array(screen02SourceSchema).max(50),
        provisionalDates: z.array(boundedLabelSchema).max(30),
        affectedPopulations: z
          .array(z.string().min(1).max(2_000))
          .max(30),
        note: z.string().min(1).max(2_000),
      })
      .strict()
      .optional(),
    discovery: z
      .object({
        formulaVersion: z.string().min(1).max(120),
        query: z.string().max(2_000),
        rankings: z.array(discoveryRankingSchema).max(40),
        clusters: z.array(discoveryClusterSchema).max(40),
      })
      .strict(),
    manifest: searchManifestSchema,
  })
  .strict();

const interactionSchema = z
  .object({
    preferences: z
      .object({
        version: z.literal(SCREEN_02_PREFERENCE_VERSION),
        criteria: z
          .array(preferenceCriterionSchema)
          .max(SCREEN_02_MAX_PREFERENCE_CRITERIA),
        requests: z
          .array(preferenceRequestSchema)
          .max(SCREEN_02_MAX_SEARCH_ROUNDS),
      })
      .strict(),
    preferenceAssessments: z
      .array(preferenceAssessmentSchema)
      .max(40),
    pendingRequest: z
      .object({
        id: z.string().min(1).max(120),
        baseRevision: z.number().int().nonnegative(),
        expectedRevision: z.number().int().positive(),
        requestType: z.enum(["find-more", "refine", "none-fit"]),
        status: z.enum(["sending", "awaiting-response"]),
        exactText: z.string().min(1).max(2_000),
        criteria: z
          .array(
            z
              .object({
                kind: z.enum(screen02PreferenceKinds),
                text: z.string().min(1).max(2_000),
              })
              .strict(),
          )
          .max(40),
      })
      .strict()
      .nullable(),
    interactionRequestHistory: z
      .array(
        z
          .object({
            id: z.string().min(1).max(120),
            requestId: z.string().min(1).max(120),
            revision: z.number().int().nonnegative(),
            action: z.enum([
              "recorded",
              "sent",
              "send-failed",
              "reconciled",
            ]),
            requestType: z.enum([
              "find-more",
              "refine",
              "none-fit",
            ]),
            exactText: z.string().min(1).max(2_000),
            criteria: z
              .array(
                z
                  .object({
                    kind: z.enum(screen02PreferenceKinds),
                    text: z.string().min(1).max(2_000),
                  })
                  .strict(),
              )
              .max(40),
            error: z.string().min(1).max(2_000).nullable(),
          })
          .strict(),
      )
      .max(100),
    itemVersions: z
      .array(screen02ItemVersionSchema)
      .min(1)
      .max(SCREEN_02_MAX_ITEM_VERSIONS),
    searchRounds: z
      .array(searchRoundSchema)
      .min(1)
      .max(SCREEN_02_MAX_SEARCH_ROUNDS),
    rejections: z
      .array(
        z
          .object({
            id: z.string().min(1).max(120),
            itemId: z.string().min(1).max(120),
            revision: z.number().int().nonnegative(),
            reason: z.string().min(1).max(2_000),
            source: z.literal("researcher"),
          })
          .strict(),
      )
      .max(320),
    selectionHistory: z
      .array(
        z
          .object({
            id: z.string().min(1).max(120),
            revision: z.number().int().nonnegative(),
            action: z.enum([
              "selected",
              "cleared",
              "locked",
              "unlocked",
            ]),
            itemId: z.string().min(1).max(120).nullable(),
            reason: z.string().min(1).max(2_000),
          })
          .strict(),
      )
      .max(320),
    deferredQuestions: z
      .array(
        z
          .object({
            id: z.string().min(1).max(120),
            revision: z.number().int().nonnegative(),
            exactRequest: z.string().min(1).max(2_000),
            reason: z.string().min(1).max(2_000),
            destination: z.literal("screen-03"),
          })
          .strict(),
      )
      .max(320),
    pendingScopeRevision: z
      .object({
        revision: z.number().int().nonnegative(),
        exactRequest: z.string().min(1).max(2_000),
        conflictingFields: z
          .array(z.string().min(1).max(120))
          .max(20),
        reason: z.string().min(1).max(2_000),
      })
      .strict()
      .nullable(),
    downstreamInvalidationCount: z.number().int().nonnegative(),
  })
  .strict();

const lockedChoiceSchema = z
  .object({
    status: z.literal("locked"),
    itemId: z.string().min(1).max(120),
    itemFingerprint: z.string().min(1).max(160),
    lockedAtRevision: z.number().int().nonnegative(),
    mode: modeSchema,
    shockName: boundedTitleSchema,
    knownShockAnchor: boundedTitleSchema.nullable(),
    primaryRepresentationType: z
      .enum(screen02AuditRepresentationTypes)
      .nullable(),
    primaryConstruct: boundedTitleSchema.nullable(),
    baselineFingerprint: z.string().min(1).max(160),
    downstreamStatus: z.literal("screen-03-ready"),
  })
  .strict();

const screen02SessionSchema = z
  .object({
    schemaVersion: z.literal(SCREEN_02_SESSION_SCHEMA_VERSION),
    sourceScreen: z.literal("screen-02"),
    runId: z.string().min(1).max(120),
    mode: modeSchema,
    screen01Baseline: studyContextSchema,
    screen01Fingerprint: z.string().min(1).max(128),
    revision: z.number().int().nonnegative(),
    items: z.array(screen02ItemSchema).max(40),
    selectedItemId: boundedIdSchema.nullable(),
    lockedChoice: lockedChoiceSchema.nullable(),
    searchManifest: searchManifestSchema,
    interaction: interactionSchema,
  })
  .strict();

const screen02StateEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(
      SCREEN_02_STATE_ENVELOPE_SCHEMA_VERSION,
    ),
    encoding: z.literal(SCREEN_02_STATE_ENVELOPE_ENCODING),
    uncompressedBytes: z.number().int().positive().max(2 * 1024 * 1024),
    compressedBytes: z
      .number()
      .int()
      .positive()
      .max(SCREEN_02_MAX_COMPRESSED_STATE_BYTES),
    checksum: z.string().regex(/^fnv1a64:[0-9a-f]{16}$/),
    payload: z
      .string()
      .min(1)
      .max(SCREEN_02_MAX_STATE_PAYLOAD_CHARACTERS)
      .regex(/^[A-Za-z0-9_-]+$/),
  })
  .strict();

const screen02StateSummarySchema = z
  .object({
    runId: z.string().min(1).max(120),
    mode: modeSchema,
    revision: z.number().int().nonnegative(),
    screen01Fingerprint: z.string().min(1).max(128),
    latestRoundId: boundedIdSchema,
    stage: z.enum([
      "initial",
      "native-retrieval",
      "ai-review",
      "preliminary-assessment",
      "researcher-assessment",
    ]),
    currentItems: z
      .array(
        z
          .object({
            id: boundedIdSchema,
            title: boundedTitleSchema,
          })
          .strict(),
      )
      .max(SCREEN_02_MAX_PROPOSALS),
    coverageStatus: z.enum([
      "no-results",
      "reconnaissance",
      "partial",
      "complete",
    ]),
    pendingRequestReconciled: z.boolean(),
    outcomeValuesInspected: z.literal(false),
    sessionLocation: z.literal("state-envelope"),
  })
  .strict();

const screen02OutputSchema = z
  .object({
    screen: z.literal("screen-02"),
    ok: z.boolean(),
    error: z.string().max(1_000),
    sessionState: screen02StateEnvelopeSchema.describe(
      "Opaque bounded Screen 2 state. Pass this value unchanged as sessionState on the next Screen 2 tool call.",
    ),
    sessionSummary: screen02StateSummarySchema.describe(
      "Concise typed view of the authoritative Screen 2 state.",
    ),
    assessmentResults: z
      .array(
        z
          .object({
            itemId: boundedIdSchema,
            status: z.enum(["assessed", "needs-retry"]),
            reason: z.string().min(1).max(2_000),
          })
          .strict(),
      )
      .max(SCREEN_02_MAX_PROPOSALS)
      .optional()
      .describe(
        "Per-candidate preliminary assessment results. Retry only needs-retry item IDs.",
      ),
  })
  .strict();

const screen02DataOutputSchema = screen02OutputSchema;

const legacyScreen02SessionInputSchema = z
  .unknown()
  .describe(
    "Temporary compatibility input for a complete Screen02Session returned by ShockAudit v0.2.14 or earlier. New clients must use sessionState. This legacy value is never returned.",
  );

const refinementCriterionInputSchema = z
  .object({
    id: z.string().min(1).max(120),
    kind: z.enum(screen02PreferenceKinds),
    text: z.string().min(1).max(2_000),
    source: z
      .enum(["researcher", "ai-interpretation"])
      .optional(),
    exactRequest: z.string().min(1).max(2_000).optional(),
  })
  .strict();

const scopeRevisionInputSchema = z
  .object({
    exactRequest: z.string().min(1).max(2_000),
    conflictingFields: z
      .array(z.string().min(1).max(120))
      .min(1)
      .max(20),
    reason: z.string().min(1).max(2_000),
  })
  .strict();

const deferredQuestionInputSchema = z
  .object({
    exactRequest: z.string().min(1).max(2_000),
    reason: z.string().min(1).max(2_000),
  })
  .strict();

const followUpRequestTypeSchema = z.enum([
  "find-more",
  "refine",
  "none-fit",
  "user-source",
]);

const openScreen01InputSchema = z.object({
  mode: modeSchema
    .optional()
    .describe(
      "Use find when the researcher needs a shock; use audit when the researcher already has a shock.",
    ),
  sentence: z
    .string()
    .max(350)
    .optional()
    .describe("An optional one-sentence study description."),
});

const draftScopeContractInputSchema = z.object({
  mode: modeSchema,
  sentence: z.string().min(1).max(350),
});

const confirmScopeContractInputSchema = z.object({
  revision: z.number().int().nonnegative().optional().default(0),
  mode: modeSchema,
  sentence: z.string().min(1).max(350),
  contractSourceSentence: z.string().min(1).max(350),
  scope: scopeSchema,
  knownShock: z.string().max(200),
  resolvedKeys: z.array(resolvedKeySchema).max(10),
  acknowledgedDifferences: z
    .array(scopeAlignmentAcknowledgmentSchema)
    .max(9)
    .optional()
    .default([]),
  scopeDirty: z.boolean(),
});

const openScreen02InputSchema = z
  .object({
    studyContext: studyContextSchema.describe(
      "The complete, confirmed Screen01StudyContext returned by Screen 1. Carry every value forward exactly.",
    ),
    runId: z
      .string()
      .min(1)
      .max(120)
      .optional()
      .describe(
        "An app-generated identifier for a new Screen 2 run. Current widgets use the reserved screen02-v021-open- prefix so hosts retaining the v0.2.20 strict input schema can still request a canonical v2.1 run.",
      ),
    workflowVersion: z
      .literal("2.1")
      .optional()
      .describe(
        "The integrated widget sends 2.1 to create a server-owned canonical Find or Audit run. Omit only when reopening a legacy read-only conversation.",
      ),
  })
  .strict();

const createScreen02WorkflowInputSchema = z
  .object({
    schemaVersion: z.literal(SCREEN_02_WORKFLOW_CREATE_SCHEMA_VERSION),
    operationId: z.string().min(1).max(200),
    studyContext: studyContextSchema.describe(
      "The complete confirmed Screen01StudyContext. The app-only creator preserves every field exactly as the immutable Screen 2 baseline.",
    ),
  })
  .strict();

const createScreen02WorkflowInputSchemaV024 = z
  .object({
    schemaVersion: z.literal(
      SCREEN_02_WORKFLOW_CREATE_SCHEMA_VERSION_V024,
    ),
    operationId: z.string().min(1).max(200),
    responseKeyId: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    responseKey: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    initialState: z
      .enum(["standard", "blank"])
      .optional()
      .describe(
        "App-only initialization profile. Omit for a standard open; Reset Screen 2 uses blank to preserve the confirmed baseline and Audit anchor without running initial identity discovery.",
      ),
    studyContext: studyContextSchema.describe(
      "The complete confirmed Screen01StudyContext. The app-only creator preserves every field exactly as the immutable Screen 2 baseline.",
    ),
  })
  .strict();

const discoverShockOptionsInputSchema = z
  .object({
    sessionState: screen02StateEnvelopeSchema
      .optional()
      .describe(
        "The current opaque Screen 2 state envelope. Pass through the exact sessionState value returned by the previous Screen 2 call.",
      ),
    session: legacyScreen02SessionInputSchema.optional(),
    expectedRevision: z.number().int().nonnegative(),
    requestType: followUpRequestTypeSchema,
    exactRequest: z.string().min(1).max(2_000),
    criteria: z
      .array(refinementCriterionInputSchema)
      .max(40)
      .optional(),
    interpretationSource: z
      .enum([
        "researcher-structured",
        "ai-interpretation",
      ])
      .optional(),
    scopeRevision: scopeRevisionInputSchema.nullable().optional(),
    deferredQuestions: z
      .array(deferredQuestionInputSchema)
      .max(30)
      .optional(),
    resultLimit: z.number().int().min(1).max(20).optional(),
  })
  .strict()
  .superRefine((input, context) => {
    const hasEnvelope = input.sessionState !== undefined;
    const hasLegacy = input.session !== undefined;
    if (hasEnvelope === hasLegacy) {
      context.addIssue({
        code: "custom",
        path: [hasEnvelope ? "session" : "sessionState"],
        message:
          "Supply exactly one Screen 2 state transport: sessionState for current clients, or legacy session for v0.2.14 compatibility.",
      });
    }
  });

const legacyAssessShockOptionsInputSchema = z
  .object({
    studyContext: studyContextSchema.describe(
      "The same complete, confirmed Screen01StudyContext used to open Screen 2.",
    ),
    sessionState: screen02StateEnvelopeSchema
      .optional()
      .describe(
        "The current opaque Screen 2 state envelope. Pass through the exact sessionState value returned by the previous Screen 2 call.",
      ),
    session: legacyScreen02SessionInputSchema.optional(),
    expectedRevision: z.number().int().nonnegative().optional(),
    requestType: followUpRequestTypeSchema.optional(),
    exactRequest: z.string().min(1).max(2_000).optional(),
    proposals: z
      .array(screen02ProposalSchema)
      .max(40)
      .describe(
        "Externally researched proposals. Use Find event proposals only with a Find baseline. With an Audit baseline, submit source-backed matches for the exact known shock using the whole-package compatibility tag; empirical representations belong to Screen 3.",
      ),
    searchManifest: searchManifestSupplementSchema
      .optional()
      .describe(
        "Truthful record of queries, channels, and stopping rule used outside this deterministic server. It is required for ai-interpretation, including explicit not-searched or failed records when a host route did not run.",
      ),
    parentRoundId: boundedIdSchema.optional(),
    semanticDecisions: z
      .array(semanticDecisionInputSchema)
      .max(SCREEN_02_MAX_PROPOSALS)
      .optional(),
    criteria: z
      .array(refinementCriterionInputSchema)
      .max(40)
      .optional(),
    interpretationSource: z
      .enum([
        "researcher-structured",
        "ai-interpretation",
      ])
      .optional(),
    scopeRevision: scopeRevisionInputSchema.nullable().optional(),
    deferredQuestions: z
      .array(deferredQuestionInputSchema)
      .max(30)
      .optional(),
  })
  .strict()
  .superRefine((input, context) => {
    const hasEnvelope = input.sessionState !== undefined;
    const hasLegacy = input.session !== undefined;
    if (hasEnvelope && hasLegacy) {
      context.addIssue({
        code: "custom",
        path: ["session"],
        message:
          "Supply at most one Screen 2 state transport: sessionState for current clients, or legacy session for v0.2.14 compatibility.",
      });
    }
    if (
      (hasEnvelope || hasLegacy) &&
      input.expectedRevision === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["expectedRevision"],
        message:
          "expectedRevision is required when appending to existing Screen 2 state.",
      });
    }
    if (
      input.interpretationSource === "ai-interpretation" &&
      !hasEnvelope &&
      !hasLegacy
    ) {
      context.addIssue({
        code: "custom",
        path: ["sessionState"],
        message:
          "AI review requires the exact state envelope for the immediately preceding native round.",
      });
    }
    if (input.interpretationSource !== "ai-interpretation") return;
    if ((input.criteria?.length ?? 0) > 0) {
      context.addIssue({
        code: "custom",
        path: ["criteria"],
        message:
          "AI review must apply the immediately preceding native round's recorded criteria rather than submit duplicate criteria.",
      });
    }
    if (!input.searchManifest) {
      context.addIssue({
        code: "custom",
        path: ["searchManifest"],
        message:
          "AI review requires an explicit host search manifest.",
      });
    } else {
      if (!Array.isArray(input.searchManifest.queryMatrix)) {
        context.addIssue({
          code: "custom",
          path: ["searchManifest", "queryMatrix"],
          message:
            "AI review must explicitly record its host query matrix, which may be empty only when the channels explain why no host query ran.",
        });
      }
      if (
        !Array.isArray(input.searchManifest.channels) ||
        input.searchManifest.channels.length === 0
      ) {
        context.addIssue({
          code: "custom",
          path: ["searchManifest", "channels"],
          message:
            "AI review must record at least one searched, failed, or not-searched host channel.",
        });
      }
      if (!input.searchManifest.stoppingRule) {
        context.addIssue({
          code: "custom",
          path: ["searchManifest", "stoppingRule"],
          message:
            "AI review must record its host stopping rule.",
        });
      }
    }
    if (!input.parentRoundId) {
      context.addIssue({
        code: "custom",
        path: ["parentRoundId"],
        message:
          "AI review must identify the immediately preceding native round.",
      });
    }
    if (!Array.isArray(input.semanticDecisions)) {
      context.addIssue({
        code: "custom",
        path: ["semanticDecisions"],
        message:
          "AI review must account for every candidate in the parent native round.",
      });
    }
    const requiredDimensions = [
      "externalShockPlausibility",
      "populationApplicability",
      "outcomePathway",
      "exposureObservability",
      "timeSupport",
      "variation",
    ] as const;
    input.proposals.forEach((proposal, proposalIndex) => {
      for (const dimension of requiredDimensions) {
        const assessment = proposal.assessments?.[dimension];
        if (!assessment) {
          context.addIssue({
            code: "custom",
            path: [
              "proposals",
              proposalIndex,
              "assessments",
              dimension,
            ],
            message:
              "AI-interpreted proposals require all six AI-rubric assessment dimensions.",
          });
          continue;
        }
        if ((assessment.method ?? "ai-rubric") !== "ai-rubric") {
          context.addIssue({
            code: "custom",
            path: [
              "proposals",
              proposalIndex,
              "assessments",
              dimension,
              "method",
            ],
            message:
              "AI-interpreted proposal assessments must use method ai-rubric.",
          });
        }
        if (
          ["unknown", "unclear"].includes(
            assessment.category ?? "",
          ) &&
          (!assessment.unresolved || assessment.unresolved.length === 0)
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "proposals",
              proposalIndex,
              "assessments",
              dimension,
              "unresolved",
            ],
            message:
              `An unknown or unclear ${dimension} judgment must record at least one unresolved task.`,
          });
        }
      }
      if (proposal.outcomeLink.status !== "ai-hypothesis") {
        context.addIssue({
          code: "custom",
          path: [
            "proposals",
            proposalIndex,
            "outcomeLink",
            "status",
          ],
          message:
            "AI-interpreted proposals require a candidate-specific, outcome-blind AI hypothesis.",
        });
      }
      if (proposal.reasons.length === 0) {
        context.addIssue({
          code: "custom",
          path: ["proposals", proposalIndex, "reasons"],
          message:
            "AI-interpreted proposals require an item-specific explanation of why the candidate appears under the current scope and criteria.",
        });
      }
    });
  });

/**
 * Keep generated assessment fields broad at the transport boundary. The core
 * validates each candidate independently so one malformed entry cannot erase
 * valid assessments from the same model turn.
 */
const preliminaryAssessmentEntryTransportSchema = z.unknown().describe(
  "One generated candidate entry. The core maps and validates entries independently, including missing or malformed candidate IDs, so a bad peer cannot reject valid assessments in the same turn.",
);

const preliminaryAssessShockOptionsInputSchema = z
  .object({
    assessmentVersion: z.literal(
      SCREEN_02_PRELIMINARY_ASSESSMENT_SCHEMA_VERSION,
    ),
    studyContext: studyContextSchema.describe(
      "The exact confirmed Screen01StudyContext already stored in Screen 2.",
    ),
    sessionState: screen02StateEnvelopeSchema.describe(
      "The exact opaque Screen 2 state envelope returned by the preceding call.",
    ),
    expectedRevision: z.number().int().nonnegative(),
    exactRequest: z.string().min(1).max(2_000),
    rootNativeRoundId: boundedIdSchema,
    assessmentParentRoundId: boundedIdSchema,
    assessments: z
      .array(preliminaryAssessmentEntryTransportSchema)
      .min(1)
      .max(SCREEN_02_MAX_PROPOSALS),
  })
  .strict();

const assessShockOptionsInputSchema = z.union([
  preliminaryAssessShockOptionsInputSchema,
  legacyAssessShockOptionsInputSchema,
]);

const openStage1AssessmentProofInputSchema = z.object({}).strict();
const stage1FingerprintSchema = z
  .string()
  .regex(/^fnv1a64:[0-9a-f]{16}$/);
const stage1EvidenceSourceIdSchema = z.enum([
  "source-eu-gdpr-regulation-2016-679",
  "source-eu-gdpr-celex-metadata",
]);
function stage1AssessmentComponentInputSchema<
  const Category extends readonly [string, ...string[]],
>(categories: Category) {
  return z
    .object({
      category: z.enum(categories),
      explanation: z.string().min(30).max(800),
      evidenceSourceIds: z
        .array(stage1EvidenceSourceIdSchema)
        .max(2),
    })
    // The fixed validator still receives unexpected model fields so it can
    // return a structured rejection instead of silently stripping them.
    .passthrough();
}
const stage1AssessmentDraftSchema = z
  .object({
    studyFit: stage1AssessmentComponentInputSchema(
      stage1StudyFitCategories,
    ),
    outcomePathway: stage1AssessmentComponentInputSchema(
      stage1OutcomePathwayCategories,
    ),
    measurementPotential: stage1AssessmentComponentInputSchema(
      stage1MeasurementPotentialCategories,
    ),
    mainConcern: z.string().min(30).max(800),
    nextChecks: z.array(z.string().min(20).max(500)).min(1).max(2),
  })
  .passthrough();
const stage1AssessmentDraftInputSchema = z
  .object({
    schemaVersion: z.literal(STAGE1_DRAFT_SCHEMA_VERSION),
    requestId: z.string().min(1).max(120),
    candidateId: z.string().min(1).max(120),
    candidateSnapshotId: z.string().min(1).max(120),
    candidateFingerprint: stage1FingerprintSchema,
    requestProof: stage1FingerprintSchema,
    // Candidate facts never cross this tool boundary. The schema gives the
    // model one explicit branch while the fixed core independently validates
    // exact keys, identities, narratives, and evidence attachment.
    draft: stage1AssessmentDraftSchema,
  })
  .strict();
const stage1LifecycleEventOutputSchema = z
  .object({
    state: z.enum([
      "prepared",
      "message-delivered",
      "draft-received",
      "validating",
      "completed",
      "validation-failed",
      "timed-out",
    ]),
    actor: z.enum(["mcp-server", "fixed-core", "chatgpt-host"]),
    at: z.string().min(1).max(80),
  })
  .strict();
const stage1ProofRequestOutputSchema = z
  .object({
    schemaVersion: z.literal("screen02-stage1-request-v1"),
    kind: z.literal(STAGE1_PROOF_KIND),
    requestId: z.string().min(1).max(120),
    candidateId: z.string().min(1).max(120),
    candidateSnapshotId: z.string().min(1).max(120),
    candidateFingerprint: stage1FingerprintSchema,
    requestProof: stage1FingerprintSchema,
    allowedEvidenceSourceIds: z.array(stage1EvidenceSourceIdSchema).min(1),
    requiredTool: z.literal(STAGE1_DRAFT_TOOL),
    preparedAt: z.string().min(1).max(80),
  })
  .strict();
const stage1EvidencePacketOutputSchema = z
  .object({
    schemaVersion: z.literal("screen02-stage1-evidence-v1"),
    study: z
      .object({
        population: z.string(),
        studyGeography: z.string(),
        industry: z.string(),
        period: z.string(),
        outcomeFamily: z.string(),
        eventFamily: z.string(),
      })
      .strict(),
    candidate: z
      .object({
        id: z.string(),
        candidateSnapshotId: z.string(),
        title: z.string(),
        formalIdentifier: z.string(),
        commonNames: z.array(z.string()),
        eventType: z.string(),
        issuingAuthority: z.string(),
        issuingJurisdiction: z.string(),
        mainDateLead: z.string(),
        broadApparentCoverage: z.string(),
        apparentExposureVariables: z.array(z.string()),
        limitations: z.array(z.string()),
      })
      .strict(),
    sources: z.array(
      z
        .object({
          id: stage1EvidenceSourceIdSchema,
          title: z.string(),
          publisher: z.string(),
          url: z.string(),
          authority: z.enum(["official-primary", "official-metadata"]),
        })
        .strict(),
    ),
    claims: z.array(
      z
        .object({
          id: z.string(),
          sourceId: stage1EvidenceSourceIdSchema,
          fact: z.string(),
        })
        .strict(),
    ),
    candidateFingerprint: stage1FingerprintSchema,
  })
  .strict();
const stage1ProofOpenOutputSchema = z
  .object({
    schemaVersion: z.literal(STAGE1_RESULT_SCHEMA_VERSION),
    kind: z.literal(STAGE1_PROOF_KIND),
    phase: z.literal("prepared"),
    request: stage1ProofRequestOutputSchema,
    packet: stage1EvidencePacketOutputSchema,
    lifecycle: z.array(stage1LifecycleEventOutputSchema).length(1),
  })
  .strict();
const stage1CompletedAssessmentOutputSchema = z
  .object({
    method: z.literal("ai-preliminary"),
    studyFit: stage1AssessmentComponentInputSchema(
      stage1StudyFitCategories,
    ).strict(),
    outcomePathway: stage1AssessmentComponentInputSchema(
      stage1OutcomePathwayCategories,
    ).strict(),
    measurementPotential: stage1AssessmentComponentInputSchema(
      stage1MeasurementPotentialCategories,
    ).strict(),
    mainConcern: z.string().min(30).max(800),
    nextChecks: z.array(z.string().min(20).max(500)).min(1).max(2),
    overallJudgment: z.enum([
      "promising-to-verify",
      "worth-exploring",
      "low-priority",
      "not-enough-evidence",
    ]),
    overallJudgmentMethod: z.literal("fixed-computation"),
  })
  .strict();
const stage1AssessmentResultOutputSchema = z
  .object({
    schemaVersion: z.literal(STAGE1_RESULT_SCHEMA_VERSION),
    kind: z.literal(STAGE1_PROOF_KIND),
    requestId: z.string().min(1).max(120),
    candidateId: z.string().min(1).max(120),
    candidateSnapshotId: z.string().min(1).max(120),
    candidateFingerprint: stage1FingerprintSchema,
    requestProof: stage1FingerprintSchema,
    status: z.enum(["completed", "rejected"]),
    lifecycle: z.array(stage1LifecycleEventOutputSchema).length(3),
    assessment: stage1CompletedAssessmentOutputSchema.optional(),
    rejectionReasons: z.array(z.string().max(1_000)).max(24),
    selectionGate: z
      .object({
        eligible: z.boolean(),
        reasons: z.array(z.string().min(1).max(1_000)).min(1).max(8),
      })
      .strict(),
    candidateBeforeFingerprint: stage1FingerprintSchema,
    candidateAfterFingerprint: stage1FingerprintSchema,
    draftFingerprint: stage1FingerprintSchema,
    appliedResultFingerprint: stage1FingerprintSchema,
    receiptId: z.string().min(1).max(120),
  })
  .strict();

const openScreen01InputWireSchema =
  cachedZodSchema(openScreen01InputSchema);
const draftScopeContractInputWireSchema = cachedZodSchema(
  draftScopeContractInputSchema,
);
const confirmScopeContractInputWireSchema = cachedZodSchema(
  confirmScopeContractInputSchema,
);
const openScreen02InputWireSchema =
  cachedZodSchema(openScreen02InputSchema);
const createScreen02WorkflowInputWireSchema = cachedZodSchema(
  createScreen02WorkflowInputSchema,
);
const createScreen02WorkflowInputWireSchemaV024 = cachedZodSchema(
  createScreen02WorkflowInputSchemaV024,
);
const discoverShockOptionsInputWireSchema = cachedZodSchema(
  discoverShockOptionsInputSchema,
);
const assessShockOptionsInputWireSchema = cachedZodSchema(
  assessShockOptionsInputSchema,
);
const openStage1AssessmentProofInputWireSchema = cachedZodSchema(
  openStage1AssessmentProofInputSchema,
);
const stage1AssessmentDraftInputWireSchema = cachedZodSchema(
  stage1AssessmentDraftInputSchema,
);
const stage1ProofOpenOutputWireSchema = cachedZodSchema(
  stage1ProofOpenOutputSchema,
);
const stage1AssessmentResultOutputWireSchema = cachedZodSchema(
  stage1AssessmentResultOutputSchema,
);
const workflowOutputWireSchema =
  cachedZodSchema(workflowOutputSchema);
const screen02OutputWireSchema =
  cachedZodSchema(screen02OutputSchema);
const screen02DataOutputWireSchema = cachedZodSchema(
  screen02DataOutputSchema,
);

const uiToolMeta = {
  ui: {
    resourceUri: UI_RESOURCE_URI,
    visibility: ["model", "app"],
  },
  "ui/resourceUri": UI_RESOURCE_URI,
  "openai/outputTemplate": UI_RESOURCE_URI,
  "openai/toolInvocation/invoking": "Opening the study workspace…",
  "openai/toolInvocation/invoked": "Study workspace ready",
} satisfies Record<string, unknown>;

const screen02UiToolMeta = {
  ...uiToolMeta,
  "openai/widgetAccessible": true,
  "openai/toolInvocation/invoking": "Opening feasible shock options…",
  "openai/toolInvocation/invoked": "Shock options ready",
} satisfies Record<string, unknown>;

const screen02WorkflowCreateToolMeta = {
  ui: {
    visibility: ["app"],
  },
  "openai/widgetAccessible": true,
  "openai/toolInvocation/invoking": "Creating the Screen 2 workflow…",
  "openai/toolInvocation/invoked": "Screen 2 workflow ready",
} satisfies Record<string, unknown>;

const screen02DiscoveryToolMeta = {
  ui: {
    visibility: ["model", "app"],
  },
  "openai/widgetAccessible": true,
  "openai/toolInvocation/invoking":
    "Searching documented shock evidence…",
  "openai/toolInvocation/invoked":
    "Shock discovery round complete",
} satisfies Record<string, unknown>;

const screen02AssessmentToolMeta = {
  ui: {
    visibility: ["model", "app"],
  },
  "openai/widgetAccessible": true,
  "openai/toolInvocation/invoking":
    "Adding comparative AI assessment…",
  "openai/toolInvocation/invoked":
    "Comparative AI assessment complete",
} satisfies Record<string, unknown>;

const stage1ProofUiToolMeta = {
  ui: {
    resourceUri: STAGE1_PROOF_UI_RESOURCE_URI,
    visibility: ["model", "app"],
  },
  "ui/resourceUri": STAGE1_PROOF_UI_RESOURCE_URI,
  "openai/outputTemplate": STAGE1_PROOF_UI_RESOURCE_URI,
  "openai/toolInvocation/invoking":
    "Preparing the isolated assessment proof…",
  "openai/toolInvocation/invoked":
    "Assessment proof ready",
} satisfies Record<string, unknown>;

const stage1DraftModelOnlyToolMeta = {
  ui: {
    visibility: ["model"],
  },
  "openai/toolInvocation/invoking":
    "Submitting the bounded assessment draft…",
  "openai/toolInvocation/invoked":
    "Assessment draft checked",
} satisfies Record<string, unknown>;

export function createUiResourceMeta(publicOrigin: string) {
  const origin = new URL(publicOrigin);
  const loopbackOrigin =
    origin.protocol === "http:" &&
    ["127.0.0.1", "localhost", "::1", "[::1]"].includes(origin.hostname);
  const resourceDomains = loopbackOrigin ? [] : [publicOrigin];
  const relatedSearchOrigins = [
    // Signed report links returned by ChatGPT's file bridge are opened by
    // the host; they never become source evidence or a model request.
    "https://files.oaiusercontent.com",
    "https://usercontent.openai.com",
    "https://chatgpt.com",
    "https://www.google.com",
    "https://scholar.google.com",
    "https://en.wikipedia.org",
    "https://federalregister.gov",
    "https://www.federalregister.gov",
    "https://openstates.org",
    "https://v3.openstates.org",
    "https://govinfo.gov",
    "https://www.govinfo.gov",
    "https://ftc.gov",
    "https://www.ftc.gov",
    "https://fema.gov",
    "https://www.fema.gov",
    "https://eur-lex.europa.eu",
    "https://publications.europa.eu",
    "https://climate.ec.europa.eu",
    "https://commission.europa.eu",
    "https://digital-markets-act.ec.europa.eu",
    "https://legislation.gov.uk",
    "https://www.legislation.gov.uk",
    "https://gdacs.org",
    "https://www.gdacs.org",
    "https://earthquake.usgs.gov",
    "https://leginfo.legislature.ca.gov",
    "https://oag.ca.gov",
    "https://www.sos.ca.gov",
    "https://vig.cdn.sos.ca.gov",
    "https://www.irs.gov",
    "https://www.nhc.noaa.gov",
    "https://www.sec.gov",
  ] as const;
  return {
    ui: {
      prefersBorder: false,
      csp: {
        connectDomains: [],
        resourceDomains,
        frameDomains: [],
      },
    },
    "openai/ui": {
      availableDisplayModes: ["inline", "fullscreen"],
    },
    "openai/widgetPrefersBorder": false,
    "openai/widgetCSP": {
      connect_domains: [],
      resource_domains: resourceDomains,
      redirect_domains: [...relatedSearchOrigins],
    },
  } satisfies Record<string, unknown>;
}

function toWorkflowOutput(input: {
  ok: boolean;
  error: string;
  state: ReturnType<typeof createInitialState>;
  ambiguities: ReturnType<typeof getAmbiguities>;
}) {
  return {
    screen: "screen-01" as const,
    ok: input.ok,
    error: input.error,
    state: input.state,
    ambiguities: input.ambiguities,
    studyContext: buildScreen01StudyContext(
      input.state,
      input.ambiguities,
    ),
  };
}

function resultText(
  mode: "find" | "audit",
  ambiguityCount: number,
  confirmed: boolean,
) {
  if (confirmed) {
    return "Screen 1 is complete. The Scope Contract is confirmed and Screen 2 is unlocked.";
  }
  return `ShockAudit Screen 1 is ready in “${
    mode === "find" ? "Find a shock" : "Audit a known shock"
  }” mode. ${ambiguityCount} scope ${
    ambiguityCount === 1 ? "decision remains" : "decisions remain"
  }.`;
}

const uiHtmlCache = new WeakMap<
  object,
  Map<string, Promise<string>>
>();

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^$()|[\]\\]/gu, "\\$&");
}

function encodeUiPayload(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(
      offset,
      Math.min(offset + chunkSize, bytes.length),
    );
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function readRequiredUiAsset(
  env: ShockAuditEnv,
  assetReference: string,
) {
  const pathname = new URL(
    assetReference,
    "https://shockaudit-assets.local",
  ).pathname;
  const response = await env.ASSETS.fetch(
    new Request(`https://shockaudit-assets.local${pathname}`),
  );
  if (!response.ok) {
    throw new Error(
      `ShockAudit bundled UI asset ${pathname} returned HTTP ${response.status}.`,
    );
  }
  return response.text();
}

function inlineUiAssetTag(
  html: string,
  tagName: "script" | "link",
  assetReference: string,
  replacement: string,
) {
  const suffix = tagName === "script" ? "\\s*</script>" : "";
  const pattern = new RegExp(
    `<${tagName}\\b[^>]*${escapeRegExp(assetReference)}[^>]*>${suffix}`,
    "u",
  );
  const matches = html.match(new RegExp(pattern.source, "gu")) ?? [];
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one ${tagName} tag for ${assetReference}; received ${matches.length}.`,
    );
  }
  return html.replace(pattern, replacement);
}

export async function readUiHtml(
  env: ShockAuditEnv,
  publicOrigin: string,
) {
  const cacheKey = env.ASSETS as unknown as object;
  const originCache = uiHtmlCache.get(cacheKey) ?? new Map();
  if (!uiHtmlCache.has(cacheKey)) {
    uiHtmlCache.set(cacheKey, originCache);
  }
  const existing = originCache.get(publicOrigin);
  if (existing) return existing;

  const pending = (async () => {
    const response = await env.ASSETS.fetch(
      new Request("https://shockaudit-assets.local/"),
    );
    if (!response.ok) {
      throw new Error(
        `ShockAudit workspace UI asset returned HTTP ${response.status}.`,
      );
    }
    const html = await response.text();
    const selfContained =
      html.includes(
        '<meta name="shockaudit-ui-delivery" content="self-contained" />',
      );

    if (selfContained) {
      if (/rel=["']modulepreload["']/u.test(html)) {
        throw new Error(
          "The self-contained local preview unexpectedly references a module preload.",
        );
      }
      const scriptReference = html.match(
        /\/assets\/shockaudit-app\.js\?v=[A-Za-z0-9._-]+/u,
      )?.[0];
      const styleReference = html.match(
        /\/assets\/shockaudit-app\.css\?v=[A-Za-z0-9._-]+/u,
      )?.[0];
      if (!scriptReference || !styleReference) {
        throw new Error(
          "The self-contained local preview is missing its versioned app or stylesheet reference.",
        );
      }
      const [scriptSource, styleSource] = await Promise.all([
        readRequiredUiAsset(env, scriptReference),
        readRequiredUiAsset(env, styleReference),
      ]);
      // Never place the full compiled bundle directly inside an executable
      // <script> raw-text element. ChatGPT currently mounts MCP component HTML
      // through document.write(); arbitrary minified source can contain HTML-like
      // strings that prematurely terminate parsing. Base64 contains no "<"
      // characters, so carry both compiled assets as inert payloads and let a
      // tiny fixed bootstrap reconstruct them inside the sandbox.
      const scriptPayload = encodeUiPayload(scriptSource);
      const stylePayload = encodeUiPayload(styleSource);
      const bootstrap = `<script type="module" data-shockaudit-bootstrap="bundle">
const decodeShockAuditPayload=(id)=>{const node=document.getElementById(id);if(!node)throw new Error("Missing ShockAudit payload: "+id);const binary=atob((node.textContent??"").trim());const bytes=new Uint8Array(binary.length);for(let index=0;index<binary.length;index+=1)bytes[index]=binary.charCodeAt(index);return new TextDecoder().decode(bytes);};
const shockAuditStyle=document.createElement("style");shockAuditStyle.setAttribute("data-shockaudit-runtime","css");shockAuditStyle.textContent=decodeShockAuditPayload("shockaudit-css-payload");document.head.appendChild(shockAuditStyle);
const shockAuditSource=decodeShockAuditPayload("shockaudit-js-payload");const shockAuditModuleUrl=URL.createObjectURL(new Blob([shockAuditSource],{type:"text/javascript"}));try{await import(shockAuditModuleUrl);}finally{URL.revokeObjectURL(shockAuditModuleUrl);}
</script>`;
      let inlined = inlineUiAssetTag(
        html,
        "link",
        styleReference,
        `<script type="application/octet-stream" id="shockaudit-css-payload" data-shockaudit-inline="css">${stylePayload}</script>`,
      );
      inlined = inlineUiAssetTag(
        inlined,
        "script",
        scriptReference,
        `<script type="application/octet-stream" id="shockaudit-js-payload" data-shockaudit-inline="js">${scriptPayload}</script>${bootstrap}`,
      );
      return inlined;
    }

    const absoluteHtml = html
      .replaceAll(
        '"/assets/',
        `"${publicOrigin}/assets/`,
      )
      .replaceAll(
        "'/assets/",
        `'${publicOrigin}/assets/`,
      );
    return absoluteHtml
      .replaceAll(
        `"${publicOrigin}/assets/shockaudit-app.js"`,
        `"${publicOrigin}/assets/shockaudit-app.js?v=${SHOCKAUDIT_UI_BUILD_LABEL}"`,
      )
      .replaceAll(
        `'${publicOrigin}/assets/shockaudit-app.js'`,
        `'${publicOrigin}/assets/shockaudit-app.js?v=${SHOCKAUDIT_UI_BUILD_LABEL}'`,
      )
      .replaceAll(
        `"${publicOrigin}/assets/shockaudit-app.css"`,
        `"${publicOrigin}/assets/shockaudit-app.css?v=${SHOCKAUDIT_UI_BUILD_LABEL}"`,
      )
      .replaceAll(
        `'${publicOrigin}/assets/shockaudit-app.css'`,
        `'${publicOrigin}/assets/shockaudit-app.css?v=${SHOCKAUDIT_UI_BUILD_LABEL}'`,
      );
  })();
  originCache.set(publicOrigin, pending);
  try {
    return await pending;
  } catch (error) {
    originCache.delete(publicOrigin);
    throw error;
  }
}

function legacyWorkspaceMigrationHtml(resourceUri: string) {
  const safeResourceUri = resourceUri.replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ShockAudit workspace migration</title>
    <style>
      :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }
      body { margin: 0; background: Canvas; color: CanvasText; }
      main { max-width: 42rem; margin: 0 auto; padding: 2rem 1.25rem 3rem; }
      .eyebrow { color: #a14b16; font-size: .78rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
      h1 { font-size: 1.45rem; line-height: 1.2; margin: .55rem 0 .8rem; }
      p, li { font-size: .98rem; line-height: 1.55; }
      ol { padding-left: 1.3rem; }
      code { font-size: .78rem; overflow-wrap: anywhere; }
      .note { border-left: .25rem solid #a14b16; padding: .15rem 0 .15rem .9rem; }
    </style>
  </head>
  <body>
    <main data-shockaudit-migration="legacy-resource">
      <div class="eyebrow">Safe migration required</div>
      <h1>This saved ShockAudit workspace cannot continue to Screen 2 safely.</h1>
      <p class="note">It uses an earlier ChatGPT tool contract. ShockAudit has left this workspace read-only instead of pairing old tools with new Screen 2 code.</p>
      <p>Your existing conversation and confirmed Scope Contract were not changed by this migration screen. They are not copied automatically into a new workspace.</p>
      <ol>
        <li>Keep this conversation open if you need to copy the confirmed Scope Contract.</li>
        <li>Refresh the ShockAudit connection.</li>
        <li>Start a new ChatGPT conversation, open ShockAudit again, and confirm that Scope Contract once.</li>
      </ol>
      <p>If a fresh conversation still shows this page, the connection has not loaded the current ShockAudit resource yet.</p>
      <p><code>${safeResourceUri}</code> · migration target v${SHOCKAUDIT_RELEASE_LABEL}</p>
    </main>
  </body>
</html>`;
}

function restoreScreen02TransportInput(
  input: { sessionState?: unknown; session?: unknown },
  required: boolean,
) {
  if (
    input.sessionState !== undefined &&
    input.session !== undefined
  ) {
    throw new Error(
      "Supply exactly one Screen 2 state transport. [SA-S2-STATE-CONFLICT]",
    );
  }
  if (input.sessionState !== undefined) {
    const decoded = decodeScreen02StateEnvelope(input.sessionState);
    if (!decoded.ok) {
      throw new Error(
        `The supplied Screen 2 state envelope failed validation. [SA-S2-${decoded.code.toUpperCase()}]`,
      );
    }
    return decoded.session;
  }
  if (input.session !== undefined) {
    const legacy = restoreScreen02Session(input.session);
    if (!legacy) {
      throw new Error(
        "The supplied legacy Screen 2 session failed integrity validation. [SA-S2-LEGACY-SESSION]",
      );
    }
    return legacy;
  }
  if (required) {
    throw new Error(
      "The Screen 2 state envelope is absent. [SA-S2-ENVELOPE-ABSENT]",
    );
  }
  return null;
}

function toScreen02Output(
  session: Screen02Session,
  assessmentResults?: Screen02SearchRound["assessmentResults"],
) {
  const validated = restoreScreen02Session(session);
  if (!validated) {
    throw new Error(
      "The Screen 2 output failed session integrity validation.",
    );
  }
  return {
    screen: "screen-02" as const,
    ok: true,
    error: "",
    sessionState: encodeScreen02StateEnvelope(validated),
    sessionSummary: buildScreen02StateSummary(validated),
    ...(assessmentResults ? { assessmentResults } : {}),
  };
}

function toScreen02DataToolResult(
  session: Screen02Session,
  text: string,
  assessmentResults?: Screen02SearchRound["assessmentResults"],
) {
  return {
    content: [{ type: "text" as const, text }],
    structuredContent: toScreen02Output(session, assessmentResults),
  };
}

type Screen02DiscoveryInput = {
  expectedRevision: number;
  requestType:
    | "find-more"
    | "refine"
    | "none-fit"
    | "user-source";
  exactRequest: string;
  criteria?: Array<{
    id: string;
    kind: "require" | "prefer" | "avoid";
    text: string;
    source?: "researcher" | "ai-interpretation";
    exactRequest?: string;
  }>;
  interpretationSource?:
    | "researcher-structured"
    | "ai-interpretation";
  scopeRevision?: {
    exactRequest: string;
    conflictingFields: string[];
    reason: string;
  } | null;
  deferredQuestions?: Array<{
    exactRequest: string;
    reason: string;
  }>;
  resultLimit?: number;
};

function observedAt(env: ShockAuditEnv) {
  const value = env.NOW?.() ?? new Date().toISOString();
  if (
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?Z$/.test(
      value,
    ) ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new Error(
      "The server clock must return an ISO 8601 UTC timestamp.",
    );
  }
  return value;
}

function screen02WorkflowSigningKeyring(
  env: ShockAuditEnv,
): Screen02WorkflowSigningKeyring {
  const config = (keyId: string | undefined, key: string | undefined) => {
    if (!keyId || !key) return null;
    const candidate = { keyId, key };
    try {
      assertScreen02FindSigningConfig(candidate);
      assertScreen02AuditSigningConfig(candidate);
      return candidate;
    } catch {
      return null;
    }
  };
  return {
    current: config(
      env.SCREEN02_WORKFLOW_SIGNING_KEY_ID,
      env.SCREEN02_WORKFLOW_SIGNING_KEY,
    ),
    previous: config(
      env.SCREEN02_WORKFLOW_PREVIOUS_SIGNING_KEY_ID,
      env.SCREEN02_WORKFLOW_PREVIOUS_SIGNING_KEY,
    ),
  };
}

function createScreen02WorkflowId(kind: string) {
  const prefix = kind.replace(/[^a-z0-9-]+/gi, "-").slice(0, 80);
  return `${prefix}-${crypto.randomUUID()}`;
}

function preflightDiscovery(
  session: Screen02Session,
  criteria: Screen02PreferenceCriterion[],
) {
  if (
    session.interaction.searchRounds.length >=
    SCREEN_02_MAX_SEARCH_ROUNDS
  ) {
    throw new Error(
      `Screen 2 permits at most ${SCREEN_02_MAX_SEARCH_ROUNDS} documented search rounds in one active run.`,
    );
  }
  if (session.interaction.pendingScopeRevision) {
    throw new Error(
      "Screen 2 has a pending scope revision. Revise and reconfirm Screen 1 before searching again.",
    );
  }
  if (
    session.interaction.preferences.criteria.length +
      criteria.length >
    SCREEN_02_MAX_PREFERENCE_CRITERIA
  ) {
    throw new Error(
      `Screen 2 accepts at most ${SCREEN_02_MAX_PREFERENCE_CRITERIA} active preference criteria.`,
    );
  }
  if (
    session.mode === "find" &&
    session.items.length >= SCREEN_02_MAX_CANDIDATE_ITEMS
  ) {
    throw new Error(
      `The cumulative Screen 2 candidate ledger already contains its maximum of ${SCREEN_02_MAX_CANDIDATE_ITEMS} items.`,
    );
  }
  const ids = new Set(
    session.interaction.preferences.criteria.map(
      (criterion) => criterion.id,
    ),
  );
  for (const criterion of criteria) {
    if (ids.has(criterion.id)) {
      throw new Error(
        `Duplicate preference criterion id: ${criterion.id}.`,
      );
    }
    ids.add(criterion.id);
  }
}

function discoveryCriteria(
  input: Pick<
    Screen02DiscoveryInput,
    "criteria" | "exactRequest" | "interpretationSource"
  >,
): Screen02PreferenceCriterion[] {
  return (input.criteria ?? []).map((criterion) => ({
    id: criterion.id,
    kind: criterion.kind,
    text: criterion.text,
    source:
      criterion.source ??
      (input.interpretationSource === "ai-interpretation"
        ? "ai-interpretation"
        : "researcher"),
    exactRequest: criterion.exactRequest ?? input.exactRequest,
  }));
}

function normalizedBoundary(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isUnitedStatesScope(geography: string) {
  const normalized = normalizedBoundary(geography);
  return new Set([
    "us",
    "u s",
    "usa",
    "u s a",
    "united states",
    "united states of america",
  ]).has(normalized);
}

function canonicalGeography(value: string) {
  if (isUnitedStatesScope(value)) return "united states";
  const normalized = normalizedBoundary(value);
  if (
    new Set(["eu", "e u", "european union"]).has(normalized)
  ) {
    return "european union";
  }
  if (
    new Set([
      "uk",
      "u k",
      "united kingdom",
      "great britain",
    ]).has(normalized)
  ) {
    return "united kingdom";
  }
  if (
    new Set([
      "global",
      "world",
      "worldwide",
      "international",
      "all countries",
    ]).has(normalized)
  ) {
    return "worldwide";
  }
  return normalized;
}

function canonicalGeographyHierarchy(value: string) {
  return value
    .split(",")
    .map((part) => canonicalGeography(part))
    .filter(Boolean);
}

/**
 * Registry geography is reviewed metadata, but it may name a state or local
 * jurisdiction together with its country. Match only an explicit trailing
 * ancestor hierarchy: a United States scope may admit
 * "California, United States", while "California" without its country, a
 * sibling state under a state-scoped study, and every foreign hierarchy remain
 * out of scope. The ordinary hard geography filter still evaluates every
 * admitted proposal afterward.
 */
function registryGeographyMatchesScope(
  scopeGeography: string,
  candidateGeography: string,
) {
  const scope = canonicalGeography(scopeGeography);
  if (scope === "worldwide") return true;
  if (canonicalGeography(candidateGeography) === scope) return true;

  const scopeHierarchy = canonicalGeographyHierarchy(scopeGeography);
  const candidateHierarchy = canonicalGeographyHierarchy(
    candidateGeography,
  );
  if (
    scopeHierarchy.length === 0 ||
    candidateHierarchy.length < scopeHierarchy.length
  ) {
    return false;
  }
  const hierarchyOffset =
    candidateHierarchy.length - scopeHierarchy.length;
  return scopeHierarchy.every(
    (component, offset) =>
      candidateHierarchy[hierarchyOffset + offset] === component,
  );
}

function canonicalEventFamily(value: string) {
  const normalized = normalizedBoundary(value);
  if (
    [
      "regulation",
      "regulatory",
      "policy",
      "law",
      "legal",
      "statute",
      "directive",
    ].some((token) => normalized.includes(token))
  ) {
    return "regulation";
  }
  if (
    [
      "disaster",
      "hurricane",
      "flood",
      "wildfire",
      "earthquake",
      "storm",
      "natural hazard",
      "emergency",
    ].some((token) => normalized.includes(token))
  ) {
    return "disaster";
  }
  return normalized;
}

function studyDateRange(studyPeriod: string) {
  const years = [...studyPeriod.matchAll(/\b(19|20)\d{2}\b/g)].map(
    (match) => Number(match[0]),
  );
  if (years.length === 0) return null;
  const startYear = Math.min(...years);
  const endYear = Math.max(...years);
  return {
    startDate: `${startYear}-01-01`,
    endDate: `${endYear}-12-31`,
  };
}

function preferenceGroups(criteria: Screen02PreferenceCriterion[]) {
  return {
    require: criteria
      .filter((criterion) => criterion.kind === "require")
      .map((criterion) => criterion.text),
    prefer: criteria
      .filter((criterion) => criterion.kind === "prefer")
      .map((criterion) => criterion.text),
    avoid: criteria
      .filter((criterion) => criterion.kind === "avoid")
      .map((criterion) => criterion.text),
  };
}

function rankFindCandidatePool(
  session: Screen02Session,
  proposals: readonly Screen02FindProposal[],
  criteria: Screen02PreferenceCriterion[],
  limit: number,
) {
  const context = session.screen01Baseline;
  const rankingContext =
    context.startingPoint === "audit"
      ? ({
          ...context,
          startingPoint: "find",
          knownShock: "",
          studySentence: `${context.studySentence} ${context.knownShock}`,
        } as unknown as Screen01StudyContext)
      : (context as unknown as Screen01StudyContext);
  const exactIds = new Map<string, Screen02FindProposal>();
  for (const proposal of proposals) {
    if (!exactIds.has(proposal.id)) exactIds.set(proposal.id, proposal);
  }
  const consolidated = deduplicateScreen02Proposals([
    ...exactIds.values(),
  ]).proposals.filter(
    (proposal): proposal is Screen02FindProposal =>
      proposal.mode === "find",
  );
  const qualified = qualifyAndRankScreen02FindProposals(
    consolidated,
    rankingContext,
    {
      scopeFingerprint: session.screen01Fingerprint,
      maximumCandidates: limit,
    },
  );
  // The compatibility route deliberately keeps returning the legacy proposal
  // shape. Only candidates that pass the same hard-scope, industry,
  // source-quality, exposure-feasibility, and substantive-overview gates used
  // by the canonical Screen 2 workflow are allowed into that response.
  return {
    proposals: qualified.selected.map((entry) => entry.proposal),
    evaluatedProposalIds: qualified.evaluated.map(
      (entry) => entry.proposal.id,
    ),
  };
}

function registryCandidates(
  session: Screen02Session,
  criteria: Screen02PreferenceCriterion[],
  limit: number,
) {
  const context = session.screen01Baseline;
  const researchText = [
    context.studySentence,
    context.scopeContract.population,
    context.scopeContract.industry,
    context.scopeContract.eventFamily,
    ...criteria.map((criterion) => criterion.text),
  ].join(" ");
  const family = canonicalEventFamily(
    context.scopeContract.eventFamily,
  );
  const geography = canonicalGeography(
    context.scopeContract.geography,
  );
  const compatible = REVIEWED_SCREEN02_EVENT_REGISTRY.filter(
    (proposal) => {
      const proposalFamily = canonicalEventFamily(
        proposal.event.eventFamily,
      );
      const familyMatch = proposalFamily === family;
      const geographyMatch =
        geography === "worldwide" ||
        proposal.event.geographies.some((candidate) =>
          registryGeographyMatchesScope(
            context.scopeContract.geography,
            candidate,
          ),
        );
      return familyMatch && geographyMatch &&
        reviewedScreen02RegistryProposalMatchesResearchText(
          proposal,
          researchText,
        );
    },
  );
  // Do not impose the display limit before live and registry records are
  // combined. The final pool applies deterministic hard filters, industry
  // relevance, deduplication, and only then the display cap, which permits
  // eligible records to backfill rejected ones.
  return compatible.slice(
    0,
    Math.min(SCREEN_02_MAX_PROPOSALS, Math.max(limit * 3, limit)),
  );
}

function registryManifest(
  proposals: readonly Screen02FindProposal[],
  retrievedAt: string,
): Screen02SearchManifestSupplement {
  return {
    queryMatrix: [
      {
        id: "reviewed-event-registry",
        query: `${SCREEN_02_EVENT_REGISTRY_VERSION}: locked scope and recorded preferences`,
        purpose:
          "Fallback search of the bounded, reviewed Screen 2 event registry.",
        returnedRecordIds: proposals.map((proposal) => proposal.id),
      },
    ],
    channels: [
      {
        channel: `Reviewed event registry ${SCREEN_02_EVENT_REGISTRY_VERSION}`,
        status: "searched",
        retrievedAt,
        note: `Returned ${proposals.length} scope-compatible reviewed ${
          proposals.length === 1 ? "record" : "records"
        }. The registry is deliberately bounded, is not an exhaustive event catalog, and no outcome values were inspected.`,
      },
    ],
  };
}

type Screen02SkippedSourceRoute = {
  connectorId: Screen02ConnectorId;
  note: string;
};

type Screen02RuntimeSourceLimitation = {
  connectorId: Screen02ConnectorId;
  kind:
    | "declared-source-boundary"
    | "execution-language-boundary"
    | "execution-filter-boundary";
  note: string;
  requiresHostDiscovery: boolean;
};

type Screen02OfficialDiscoveryExpansionContext = {
  auditIdentity?: {
    canonicalName: string;
    aliases?: readonly string[];
    formalIdentifier?: string | null;
    issuer?: string | null;
    issuingJurisdiction?: string | null;
  };
  /**
   * Untrusted issuer/applicability leads may diversify which configured
   * official repositories are searched. They never establish candidate
   * identity, geography, population, or eligibility.
   */
  routingHints?: {
    possibleIssuers?: readonly string[];
    possibleIssuingJurisdictions?: readonly string[];
  };
};

export type Screen02HostQueryExecution = {
  submittedTerms: string[];
  plannedTerms: string[];
  executedTerms: string[];
  skipped: Array<{
    term: string;
    reason: "duplicate" | "query-cap" | "not-executable" | "stopping-rule";
  }>;
};

type Screen02InitialRetrievalStoppingReason =
  | "raw-target-reached"
  | "query-budget-exhausted"
  | "routes-exhausted"
  | "unsupported-route"
  | "invalid-study-period";

type Screen02OfficialDiscoveryFunnel = {
  profileVersion: typeof SCREEN02_RELEVANCE_PROFILE_VERSION;
  rawCandidateTarget: number;
  rawCandidateMaximum: number;
  qualifiedCandidateTarget: number;
  maximumRounds: number;
  minimumQueryVariants: number;
  maximumQueryVariants: number;
  queryVariantsPlanned: number;
  queryRequestsExecuted: number;
  roundsExecuted: number;
  recordsReceived: number;
  proposalsGenerated: number;
  uniqueProposalsGenerated: number;
  hostQueryExecution: Screen02HostQueryExecution;
  /** A conditional post-qualification source phase, kept distinct from the
   * initial general-query stop while also contributing to aggregate counts. */
  qualificationRecovery?: {
    connectorId: "ftc-press-releases-html-v1";
    status: "completed" | "failed";
    initialStoppingReason: Screen02InitialRetrievalStoppingReason;
    queryRequestsExecuted: 1;
    roundsExecuted: 1;
    recordsReceived: number;
    proposalsGenerated: number;
    stoppingReason:
      | "qualification-recovery-completed"
      | "qualification-recovery-failed";
  };
  stoppingReason:
    | Screen02InitialRetrievalStoppingReason
    | "qualification-recovery-completed"
    | "qualification-recovery-failed";
};

function screen02SubmittedHostQueryTerms(values: readonly string[]) {
  const byNormalized = new Map<string, string>();
  for (const value of values) {
    const clean = value
      .replace(/[\u0000-\u001f\u007f]/gu, " ")
      .replace(/\s+/gu, " ")
      .trim()
      .slice(0, 200)
      .trim();
    const normalized = normalizedBoundary(clean);
    if (clean && normalized && !byNormalized.has(normalized)) {
      byNormalized.set(normalized, clean);
    }
  }
  return [...byNormalized.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "en-US"))
    .map(([, term]) => term);
}

function screen02HostQueryExecution(input: {
  assistantTerms: readonly string[];
  primaryQuery: string;
  variants: Readonly<ReturnType<typeof buildScreen02NativeQueryPlan>["variants"]>;
  plannedVariantIds: ReadonlySet<string>;
  executedVariantIds: ReadonlySet<string>;
  executable: boolean;
}): Screen02HostQueryExecution {
  const submittedTerms = screen02SubmittedHostQueryTerms(input.assistantTerms);
  const hostVariants = input.variants.filter(
    (variant) => variant.strategy === "chatgpt-query-expansion",
  );
  const plannedTerms: string[] = [];
  const executedTerms: string[] = [];
  const skipped: Screen02HostQueryExecution["skipped"] = [];
  for (const [index, term] of submittedTerms.entries()) {
    if (!input.executable) {
      skipped.push({ term, reason: "not-executable" });
      continue;
    }
    if (index >= 4) {
      skipped.push({ term, reason: "query-cap" });
      continue;
    }
    const expectedQuery = `${input.primaryQuery} ${term}`
      .replace(/[\u0000-\u001f\u007f]/gu, " ")
      .replace(/\s+/gu, " ")
      .trim()
      .slice(0, 160)
      .trim();
    const expected = normalizedBoundary(expectedQuery);
    const variant = hostVariants.find(
      (candidate) => normalizedBoundary(candidate.query) === expected,
    );
    if (!variant) {
      skipped.push({
        term,
        reason: input.variants.some((candidate) =>
            normalizedBoundary(candidate.query) === expected)
          ? "duplicate"
          : "query-cap",
      });
      continue;
    }
    if (!input.plannedVariantIds.has(variant.id)) {
      skipped.push({ term, reason: "query-cap" });
      continue;
    }
    plannedTerms.push(term);
    if (input.executedVariantIds.has(variant.id)) executedTerms.push(term);
    else skipped.push({ term, reason: "stopping-rule" });
  }
  return { submittedTerms, plannedTerms, executedTerms, skipped };
}

/**
 * Keeps bounded host-reviewed vocabulary inside the native connector budget.
 * The native builder can consume all sixteen slots before it reaches every
 * assistant term, so this final scheduling step replaces trailing fixed
 * variants with up to four distinct host variants. The connector still owns
 * every query and treats the terms as recall vocabulary, never as facts.
 */
export function scheduleScreen02HostQueryVariants(input: {
  nativeQueryPlan: ReturnType<typeof buildScreen02NativeQueryPlan>;
  primaryQuery: string;
  assistantTerms: readonly string[];
}) {
  const hostQueryVariants = input.nativeQueryPlan.variants.filter(
    (variant) => variant.strategy === "chatgpt-query-expansion",
  );
  const fixedQueryVariants = input.nativeQueryPlan.variants.filter(
    (variant) => variant.strategy !== "chatgpt-query-expansion",
  );
  const knownQueryValues = new Set(
    input.nativeQueryPlan.variants.map((variant) =>
      normalizedBoundary(variant.query)),
  );
  for (const [index, term] of screen02SubmittedHostQueryTerms(
    input.assistantTerms,
  ).slice(0, 4).entries()) {
    const query = `${input.primaryQuery} ${term}`
      .replace(/[\u0000-\u001f\u007f]/gu, " ")
      .replace(/\s+/gu, " ")
      .trim()
      .slice(0, 160)
      .trim();
    const normalized = normalizedBoundary(query);
    if (!query || !normalized || knownQueryValues.has(normalized)) continue;
    knownQueryValues.add(normalized);
    hostQueryVariants.push({
      id: `native-host-${String(index + 1).padStart(2, "0")}`,
      query,
      purpose:
        "Use bounded assisted-planning vocabulary to improve official-record recall only; this phrase proves no event fact, fit, eligibility, or rank.",
      strategy: "chatgpt-query-expansion",
    });
  }
  const retainedFixedQueryVariants = fixedQueryVariants.slice(
    0,
    SCREEN02_DISCOVERY_MAX_QUERY_VARIANTS - hostQueryVariants.length,
  );
  // Keep the deterministic primary query first. Host vocabulary follows so it
  // is inside the first-round slice even when a connector reaches its target.
  return hostQueryVariants.length > 0
    ? [
        ...retainedFixedQueryVariants.slice(0, 1),
        ...hostQueryVariants,
        ...retainedFixedQueryVariants.slice(1),
      ]
    : retainedFixedQueryVariants;
}

export type Screen02OfficialDiscoveryBatch = {
  plan: Screen02SourceRoutePlan;
  /** Protected baseline connector results; never reordered by expansion. */
  results: Screen02OfficialConnectorResult[];
  /** On-mode official additions, kept separate until spare UI slots exist. */
  expandedResults?: Screen02OfficialConnectorResult[];
  /** Guarded non-connector leads are present only when expansion mode is on. */
  expandedLeadProposals?: Screen02Proposal[];
  /** Exact provider-record bindings for non-connector contextual proposals. */
  expandedLeadBindings?: Screen02OfficialProposalBinding[];
  /** User-visible metadata leads kept outside evidence candidates/matches. */
  contextLeads?: Screen02ContextLead[];
  /** Typed contextual-lead to independently returned official-record edge. */
  contextBridges?: Screen02ContextOfficialBridgeProvenance[];
  /** Expansion provenance is omitted in off and shadow modes. */
  expansionManifest?: Screen02SearchManifestSupplement;
  funnel: Screen02OfficialDiscoveryFunnel;
  skippedRoutes: Screen02SkippedSourceRoute[];
  runtimeLimitations: Screen02RuntimeSourceLimitation[];
  retrievedAt: string;
};

type Screen02RetainedOriginMap = Map<
  string,
  Screen02RetainedResultOrigin[]
>;

type Screen02RetainedQueryOrigin = Extract<
  Screen02RetainedResultOrigin,
  { kind: "query-result" }
>;

function screen02SameStringSet(
  left: readonly string[],
  right: readonly string[],
) {
  return new Set(left).size === left.length &&
    new Set(right).size === right.length &&
    left.length === right.length &&
    left.every((value) => right.includes(value));
}

function appendScreen02RetainedOrigin(
  originsByRecordId: Screen02RetainedOriginMap,
  recordId: string,
  origin: Screen02RetainedResultOrigin,
) {
  const origins = originsByRecordId.get(recordId) ?? [];
  const key = serializeDeterministicJson(origin);
  if (!origins.some((candidate) =>
    serializeDeterministicJson(candidate) === key
  )) {
    origins.push(structuredClone(origin));
    originsByRecordId.set(recordId, origins);
  }
}

function mergeScreen02RetainedOriginMaps(
  ...maps: readonly Screen02RetainedOriginMap[]
) {
  const merged: Screen02RetainedOriginMap = new Map();
  for (const map of maps) {
    for (const [recordId, origins] of map) {
      for (const origin of origins) {
        appendScreen02RetainedOrigin(merged, recordId, origin);
      }
    }
  }
  return merged;
}

function screen02ConnectorRetainedOrigins(
  results: readonly Screen02OfficialConnectorResult[],
  laneForBinding: (
    result: Screen02OfficialConnectorResult,
    binding: Screen02OfficialProposalBinding,
  ) => Screen02RetainedResultQueryLane | null,
  evidenceRole: Screen02RetainedQueryOrigin["evidenceRole"] = "identity",
) {
  const origins: Screen02RetainedOriginMap = new Map();
  for (const result of results) {
    const proposalById = new Map(
      result.proposals.map((proposal) => [proposal.id, proposal]),
    );
    const bindingIds = result.proposalBindings.map((binding) =>
      binding.proposalId
    );
    if (
      new Set(bindingIds).size !== bindingIds.length ||
      !screen02SameStringSet([...proposalById.keys()], bindingIds)
    ) {
      throw new Error(
        `Screen 2 connector ${result.diagnostics.connector} did not bind every proposal exactly once.`,
      );
    }
    const queryById = new Map(
      result.diagnostics.queryMatrix.map((query) => [query.id, query]),
    );
    for (const binding of result.proposalBindings) {
      const proposal = proposalById.get(binding.proposalId);
      const query = queryById.get(binding.queryId);
      if (
        !proposal || !query || binding.returnedRecordIds.length === 0 ||
        !binding.returnedRecordIds.every((recordId) =>
          query.returnedRecordIds?.includes(recordId)
        ) ||
        !screen02SameStringSet(
          binding.sourceIds,
          proposal.sources.map((source) => source.id),
        )
      ) {
        throw new Error(
          `Screen 2 connector ${result.diagnostics.connector} returned an invalid proposal-to-query binding.`,
        );
      }
      const retrievalLane = laneForBinding(result, binding);
      if (!retrievalLane) continue;
      appendScreen02RetainedOrigin(origins, binding.proposalId, {
        kind: "query-result",
        retrievalLane,
        evidenceRole,
        producerRecordId: binding.proposalId,
        queryId: binding.queryId,
        returnedRecordIds: [...binding.returnedRecordIds],
        sourceIds: [...binding.sourceIds],
      });
    }
  }
  return origins;
}

function remapScreen02RetainedOriginsThroughDeduplication(
  originsByProposalId: Screen02RetainedOriginMap,
  deduplicated: ReturnType<typeof deduplicateScreen02Proposals>,
) {
  const remapped: Screen02RetainedOriginMap = new Map();
  for (const cluster of deduplicated.clusters) {
    for (const memberId of cluster.memberProposalIds) {
      for (const origin of originsByProposalId.get(memberId) ?? []) {
        appendScreen02RetainedOrigin(
          remapped,
          cluster.canonicalProposalId,
          origin,
        );
      }
    }
  }
  return remapped;
}

function remapScreen02RetainedOriginsByCanonicalId(
  originsByRecordId: Screen02RetainedOriginMap,
  canonicalIdByRecordId: ReadonlyMap<string, string>,
) {
  const remapped: Screen02RetainedOriginMap = new Map();
  for (const [recordId, origins] of originsByRecordId) {
    const canonicalId = canonicalIdByRecordId.get(recordId);
    if (!canonicalId) continue;
    for (const origin of origins) {
      appendScreen02RetainedOrigin(remapped, canonicalId, origin);
    }
  }
  return remapped;
}

function requireExactScreen02RetainedOrigins(
  recordId: string,
  sourceIds: readonly string[],
  origins: readonly Screen02RetainedResultOrigin[],
) {
  const citedSourceIds = [...new Set(
    origins.flatMap((origin) => origin.sourceIds),
  )];
  if (
    origins.length === 0 ||
    !origins.some((origin) => origin.evidenceRole === "identity") ||
    origins.some((origin) =>
      origin.sourceIds.some((sourceId) => !sourceIds.includes(sourceId))
    ) ||
    !screen02SameStringSet(citedSourceIds, sourceIds)
  ) {
    throw new Error(
      `Screen 2 retained record ${recordId} is not exactly covered by producer origins.`,
    );
  }
  return origins.map((origin) => structuredClone(origin));
}

function mergeScreen02ExactIdProposalSources(
  retained: Screen02FindProposal,
  incoming: Screen02FindProposal,
) {
  const sourceById = new Map(
    retained.sources.map((source) => [source.id, source]),
  );
  for (const source of incoming.sources) {
    const prior = sourceById.get(source.id);
    if (prior && !sameDeterministicJson(prior, source)) {
      throw new Error(
        `Screen 2 proposal ${retained.id} has conflicting same-round source ${source.id}.`,
      );
    }
    if (!prior) sourceById.set(source.id, source);
  }
  return {
    ...retained,
    sources: [...sourceById.values()],
  };
}

function screen02UniqueOfficialProposalCount(
  proposals: readonly Screen02Proposal[],
) {
  const exactById = new Map<string, Screen02Proposal>();
  for (const proposal of proposals) {
    // This pre-admission metric must count one source-native identity once,
    // even when query variants returned different metadata for that identity.
    // Producer validation and retained-origin assembly handle exact-record
    // conflicts later; counting must not reject an otherwise usable round.
    if (!exactById.has(proposal.id)) exactById.set(proposal.id, proposal);
  }
  return deduplicateScreen02Proposals([...exactById.values()]).proposals.length;
}

function screen02RetrievalQueryIds(
  results: readonly Screen02OfficialConnectorResult[],
) {
  return results.flatMap((result) =>
    result.diagnostics.queryMatrix.map((query) => query.id)
  );
}

function screen02RetrievalPhaseMetrics(
  results: readonly Screen02OfficialConnectorResult[],
) {
  const proposals = results.flatMap((result) => result.proposals);
  return {
    queriesAttempted: results.length,
    queriesSucceeded: results.filter((result) =>
      result.diagnostics.failureKind === "none"
    ).length,
    queriesFailed: results.filter((result) =>
      result.diagnostics.failureKind !== "none"
    ).length,
    recordsReceived: results.reduce(
      (sum, result) => sum + result.diagnostics.recordsReceived,
      0,
    ),
    proposalsGenerated: proposals.length,
    uniqueProposalsGenerated: screen02UniqueOfficialProposalCount(proposals),
  };
}

function screen02TypedRetrievalExecution(
  discovery: Screen02OfficialDiscoveryBatch,
  documentAcquisitions: readonly Screen02DocumentAcquisition[],
) {
  const recoveryResults = discovery.funnel.qualificationRecovery
    ? discovery.results.filter((result) =>
        result.diagnostics.connector === "ftc-press-releases-html-v1"
      )
    : [];
  if (
    discovery.funnel.qualificationRecovery && recoveryResults.length !== 1
  ) {
    throw new Error(
      "Screen 2 qualification recovery must bind exactly one source request.",
    );
  }
  const recoverySet = new Set(recoveryResults);
  const baselineResults = discovery.results.filter((result) =>
    !recoverySet.has(result)
  );
  const baselineMetrics = screen02RetrievalPhaseMetrics(baselineResults);
  const queriesPlanned = discovery.funnel.queryVariantsPlanned;
  const roundsExecuted = discovery.funnel.roundsExecuted -
    (discovery.funnel.qualificationRecovery?.roundsExecuted ?? 0);
  const baselineStatusAndStop: Pick<
    Screen02RetrievalBaselineExecution,
    "status" | "stoppingReason"
  > = discovery.funnel.qualificationRecovery?.initialStoppingReason ===
      "invalid-study-period" ||
      (!discovery.funnel.qualificationRecovery &&
        discovery.funnel.stoppingReason === "invalid-study-period")
    ? { status: "invalid", stoppingReason: "invalid" }
    : baselineMetrics.queriesAttempted === 0
      ? { status: "unsupported", stoppingReason: "unsupported" }
      : baselineMetrics.queriesSucceeded === 0
        ? { status: "failed", stoppingReason: "source-failure" }
        : baselineMetrics.uniqueProposalsGenerated >=
            SCREEN02_DISCOVERY_RAW_CANDIDATE_MAX
          ? { status: "completed", stoppingReason: "raw-max" }
          : baselineMetrics.uniqueProposalsGenerated >=
              SCREEN02_DISCOVERY_RAW_CANDIDATE_TARGET
            ? { status: "completed", stoppingReason: "raw-target" }
            : queriesPlanned === SCREEN02_DISCOVERY_MAX_QUERY_VARIANTS &&
                baselineMetrics.queriesAttempted === queriesPlanned &&
                roundsExecuted === SCREEN02_DISCOVERY_MAX_ROUNDS
              ? { status: "completed", stoppingReason: "query-budget" }
              : { status: "completed", stoppingReason: "routes-exhausted" };
  const baseline: Screen02RetrievalBaselineExecution = {
    phase: "baseline",
    ...baselineStatusAndStop,
    queryIds: screen02RetrievalQueryIds(baselineResults),
    queriesPlanned,
    ...baselineMetrics,
    roundsExecuted,
  };
  const recoveryResult = recoveryResults[0];
  const recoveryMetrics = recoveryResult
    ? screen02RetrievalPhaseMetrics([recoveryResult])
    : null;
  const qualificationRecovery: Screen02RetrievalRecoveryExecution | null =
    recoveryResult && recoveryMetrics
      ? {
          phase: "qualification-recovery",
          status: recoveryResult.diagnostics.failureKind === "none"
            ? "completed"
            : "failed",
          stoppingReason: recoveryResult.diagnostics.failureKind === "none"
            ? "qualification-recovery-completed"
            : "qualification-recovery-failed",
          queryIds: screen02RetrievalQueryIds([recoveryResult]) as [string],
          queriesPlanned: 1,
          ...recoveryMetrics,
          roundsExecuted: 1,
        }
      : null;
  const allProposals = discovery.results.flatMap((result) => result.proposals);
  return buildScreen02RetrievalExecution({
    baseline,
    qualificationRecovery,
    aggregateUniqueProposalsGenerated:
      screen02UniqueOfficialProposalCount(allProposals),
    documentAcquisitions: [...documentAcquisitions],
  });
}

function contextLeadFromProposal(
  proposal: Screen02Proposal,
): Screen02ContextLead | null {
  if (proposal.mode !== "find" || proposal.origin !== "unsupported-lead") {
    return null;
  }
  const source = proposal.sources[0];
  if (!source || !/^https:\/\//i.test(source.locator)) return null;
  const lead = {
    id: proposal.id,
    title: proposal.title,
    locator: source.locator,
    publisher: source.publisher,
    publishedDate: source.publishedDate ?? null,
    sourceRole: "contextual-secondary",
    status: "unverified",
    note:
      "Context to verify only. This secondary index lead cannot confirm the event, identity, date, scope, coverage, or causal claim; locate and review a direct source before relying on it.",
  };
  return isScreen02ContextLead(lead) ? lead : null;
}

function connectorManifest(
  discovery: Screen02OfficialDiscoveryBatch,
  registry: Screen02SearchManifestSupplement | null,
  mode: "find" | "audit",
): Screen02SearchManifestSupplement {
  const resultsByConnector = new Map<
    Screen02ConnectorId,
    Screen02OfficialConnectorResult[]
  >();
  for (const result of [
    ...discovery.results,
    ...(discovery.expandedResults ?? []),
  ]) {
    const existing =
      resultsByConnector.get(result.diagnostics.connector) ?? [];
    existing.push(result);
    resultsByConnector.set(result.diagnostics.connector, existing);
  }
  const diagnosticChannels = [...resultsByConnector.entries()].map(
    ([connector, results]) => {
      const failures = results.filter((result) =>
        result.diagnostics.channels.some(
          (channel) => channel.status === "failed",
        )
      );
      const failureKinds = [...new Set(
        failures.map((result) => result.diagnostics.failureKind),
      )];
      const failureNotes = failures
        .flatMap((result) => result.diagnostics.channels)
        .filter((channel) => channel.status === "failed")
        .map((channel) => channel.note)
        .slice(0, 3);
      return {
      channel: `${connector} diagnostics`,
      status: failures.length > 0
        ? ("failed" as const)
        : ("searched" as const),
      retrievedAt: results[0]?.diagnostics.retrievedAt,
      note: [
        `Endpoint: ${results[0]?.diagnostics.endpoint ?? "not recorded"}.`,
        `Bounded requests: ${results.length}; total received: ${results.reduce(
          (sum, result) => sum + result.diagnostics.recordsReceived,
          0,
        )}; accepted: ${results.reduce(
          (sum, result) => sum + result.diagnostics.recordsAccepted,
          0,
        )}; provisional proposals before cross-query consolidation: ${results.reduce(
          (sum, result) => sum + result.diagnostics.proposalsReturned,
          0,
        )}; invalid dropped: ${results.reduce(
          (sum, result) => sum + result.diagnostics.invalidRecordsDropped,
          0,
        )}; within-query duplicates consolidated: ${results.reduce(
          (sum, result) =>
            sum + result.diagnostics.duplicateRecordsConsolidated,
          0,
        )}; any request limit reached: ${results.some(
          (result) => result.diagnostics.limitReached,
        )}.`,
        failures.length > 0
          ? `Failed requests: ${failures.length}; failure kinds: ${failureKinds.join(", ") || "unknown"}. ${failureNotes.join(" ")}`
          : "Failed requests: 0; timeout diagnostics: none.",
        "Exact request URLs and returned record IDs are retained in the query matrix. outcomeValuesInspected=false.",
      ].join(" "),
    };
    },
  );
  const routeChannels = discovery.skippedRoutes.map((skipped) => {
    const source = getScreen02SourceCatalogEntry(skipped.connectorId);
    return {
      channel: source.name,
      status: "not-searched" as const,
      retrievedAt: discovery.retrievedAt,
      note: skipped.note,
    };
  });
  const coverageGapChannels = discovery.plan.coverageGaps.map(
    (gap) => ({
      channel: `Coverage limitation · ${gap.code}`,
      status: "not-searched" as const,
      retrievedAt: discovery.retrievedAt,
      note: `${gap.message} Host-assisted discovery required: ${
        gap.requiresHostDiscovery ? "yes" : "no"
      }.`,
    }),
  );
  const runtimeLimitationChannels = discovery.runtimeLimitations.map(
    (limitation) => {
      const source = getScreen02SourceCatalogEntry(
        limitation.connectorId,
      );
      return {
        channel: `Coverage limitation · ${source.name} · ${limitation.kind}`,
        status: "not-searched" as const,
        retrievedAt: discovery.retrievedAt,
        note: `${limitation.note} Host-assisted discovery required: ${
          limitation.requiresHostDiscovery ? "yes" : "no"
        }.`,
      };
    },
  );
  const searchedRouteCount = new Set(
    discovery.results.map((result) => result.diagnostics.connector),
  ).size;
  const requestCount = discovery.results.length;
  const selectedRouteCount = discovery.plan.routes.length;
  const limitationCount =
    discovery.plan.coverageGaps.length +
    discovery.skippedRoutes.length +
    discovery.runtimeLimitations.length;
  const expansionQueries = (discovery.expansionManifest?.queryMatrix ?? [])
    .filter((query) => !/\bStage:\s*baseline\b/i.test(query.purpose));
  const routingSignalChannel =
    discovery.plan.routingSignals.possibleIssuers.length > 0 ||
      discovery.plan.routingSignals.possibleIssuingJurisdictions.length > 0
      ? [{
          channel: "Screen 2 routing signals · applicability versus issuer",
          status: "searched" as const,
          retrievedAt: discovery.retrievedAt,
          note: `Study geography “${discovery.plan.routingSignals.studyGeography}” was preserved only as applicability evidence. Possible issuers recorded: ${discovery.plan.routingSignals.possibleIssuers.join("; ") || "none"}. Possible issuing jurisdictions recorded: ${discovery.plan.routingSignals.possibleIssuingJurisdictions.join("; ") || "none"}. Matched configured issuer routes: ${discovery.plan.routingSignals.matchedIssuerJurisdictions.join(", ") || "none"}. No hint was treated as verified identity.`,
        }]
      : [];
  const qualificationRecovery = discovery.funnel.qualificationRecovery;
  const qualificationRecoveryNote = qualificationRecovery
    ? ` Initial general-route stop: ${qualificationRecovery.initialStoppingReason}. Qualification-recovery phase: ${qualificationRecovery.status}; connector ${qualificationRecovery.connectorId}; ${qualificationRecovery.queryRequestsExecuted} request in ${qualificationRecovery.roundsExecuted} phase; ${qualificationRecovery.recordsReceived} records; ${qualificationRecovery.proposalsGenerated} proposals; phase stop ${qualificationRecovery.stoppingReason}.`
    : "";
  const funnelChannel = {
    channel: `Screen 2 exact retrieval funnel · ${discovery.funnel.profileVersion}`,
    status: discovery.results.some((result) =>
      result.diagnostics.failureKind !== "none"
    )
      ? ("failed" as const)
      : discovery.results.length > 0
        ? ("searched" as const)
        : ("not-searched" as const),
    retrievedAt: discovery.retrievedAt,
    note: `Targets: ${discovery.funnel.rawCandidateTarget} raw, ${discovery.funnel.rawCandidateMaximum} raw maximum, ${discovery.funnel.qualifiedCandidateTarget} qualified. Planned ${discovery.funnel.queryVariantsPlanned} distinct general query variants (required range ${discovery.funnel.minimumQueryVariants}–${discovery.funnel.maximumQueryVariants} for general legal Find), executed ${discovery.funnel.queryRequestsExecuted} baseline/recovery source-query requests across ${discovery.funnel.roundsExecuted}/${discovery.funnel.maximumRounds} bounded baseline/recovery phases, received ${discovery.funnel.recordsReceived} records, generated ${discovery.funnel.proposalsGenerated} provisional proposals, and retained ${discovery.funnel.uniqueProposalsGenerated} unique raw event leads after common semantic deduplication. Guarded expansion execution, when enabled, is reported in its own query matrix and channels. Overall retrieval stop: ${discovery.funnel.stoppingReason}.${qualificationRecoveryNote} A raw-count stop is only a resource-control measure; it is not candidate-qualification success.`,
  };
  const hostQuery = discovery.funnel.hostQueryExecution;
  const hostQueryChannels = hostQuery.submittedTerms.length > 0
    ? [{
        channel: "Assisted query-vocabulary execution",
        status: hostQuery.executedTerms.length > 0
          ? "searched" as const
          : "not-searched" as const,
        retrievedAt: discovery.retrievedAt,
        note: `Submitted ${hostQuery.submittedTerms.length}, planned ${hostQuery.plannedTerms.length}, executed ${hostQuery.executedTerms.length}, and skipped ${hostQuery.skipped.length} bounded host query term${hostQuery.submittedTerms.length === 1 ? "" : "s"}. Skip reasons: ${[
          ...new Set(hostQuery.skipped.map((entry) => entry.reason)),
        ].join(", ") || "none"}. These untrusted terms only select fixed official searches and establish no event fact, fit, eligibility, or rank.`,
      }]
    : [];
  return {
    queryMatrix: [
      ...discovery.results.flatMap(
        (result) => result.diagnostics.queryMatrix,
      ),
      ...expansionQueries,
      ...(registry?.queryMatrix ?? []),
    ],
    channels: [
      ...diagnosticChannels,
      funnelChannel,
      ...hostQueryChannels,
      ...routingSignalChannel,
      ...routeChannels,
      ...coverageGapChannels,
      ...runtimeLimitationChannels,
      ...(discovery.expansionManifest?.channels ?? []),
      ...(registry?.channels ?? []),
    ],
    stoppingRule: {
      rule:
        mode === "find"
          ? `Run at most ${discovery.funnel.maximumRounds} bounded retrieval phases toward ${discovery.funnel.rawCandidateTarget} raw leads, including at most one separately accounted qualification-recovery phase when configured; stop at ${discovery.funnel.rawCandidateMaximum}, then apply the common registry/connector qualifier toward ${discovery.funnel.qualifiedCandidateTarget} qualified candidates; a raw-count stop is not final success.`
          : "Stop this native round after every selected bounded connector route has completed or recorded an access/configuration limit, then cross-check the exact named shock in the matching reviewed catalog.",
      status: "met",
      note: `The native router selected ${selectedRouteCount} ${
        selectedRouteCount === 1 ? "route" : "routes"
      }, executed ${searchedRouteCount} through ${requestCount} bounded ${
        requestCount === 1 ? "request" : "requests"
      }, and recorded ${
        limitationCount
      } coverage, source, or execution ${
        limitationCount === 1
          ? "limit"
          : "limits"
      }. Overall retrieval stop: ${discovery.funnel.stoppingReason}; unique raw event leads after common semantic deduplication: ${discovery.funnel.uniqueProposalsGenerated}/${discovery.funnel.rawCandidateTarget} resource target.${qualificationRecoveryNote} Qualification, not this raw count, determines final success. This is a bounded search, not a claim that all possible ${
        mode === "find" ? "shocks" : "event matches"
      } were found. Outcome values were not inspected.`,
    },
  };
}

function combinedAiReviewManifest(
  session: Screen02Session,
  hostManifest: Screen02SearchManifestSupplement | undefined,
  interpretationSource:
    | "researcher-structured"
    | "ai-interpretation"
    | undefined,
): Screen02SearchManifestSupplement | undefined {
  if (interpretationSource !== "ai-interpretation") {
    return hostManifest;
  }
  if (!hostManifest) {
    throw new Error(
      "A completed AI review requires an explicit host search manifest.",
    );
  }
  const nativeRound = session.interaction.searchRounds.at(-1);
  if (!nativeRound || nativeRound.requestType === "initial") {
    return hostManifest;
  }

  const queryMatrix = nativeRound.manifest.queryMatrix.map(
    (query) => ({ ...query }),
  );
  const queryById = new Map(
    queryMatrix.map((query) => [query.id, query]),
  );
  for (const query of hostManifest.queryMatrix ?? []) {
    const existing = queryById.get(query.id);
    if (existing) {
      if (!sameDeterministicJson(existing, query)) {
        throw new Error(
          `The AI review search manifest reuses native query id ${query.id} with different content.`,
        );
      }
      continue;
    }
    const cloned = { ...query };
    queryById.set(cloned.id, cloned);
    queryMatrix.push(cloned);
  }

  const channels = nativeRound.manifest.channels.map(
    (channel) => ({ ...channel }),
  );
  const channelKeys = new Set(
    channels.map((channel) => serializeDeterministicJson(channel)),
  );
  for (const channel of hostManifest.channels ?? []) {
    const key = serializeDeterministicJson(channel);
    if (channelKeys.has(key)) continue;
    channelKeys.add(key);
    channels.push({ ...channel });
  }

  if (queryMatrix.length > 30 || channels.length > 20) {
    throw new Error(
      "The combined native and AI-review search manifest exceeds the documented query or channel limit.",
    );
  }

  const nativeStoppingRule = nativeRound.manifest.stoppingRule;
  const hostStoppingRule = hostManifest.stoppingRule;
  const stoppingRule = hostStoppingRule
    ? {
        rule:
          "Complete the prior bounded native retrieval and the declared host-assisted review channels, or document the access limit that prevented either stage.",
        status:
          nativeStoppingRule.status === "not-met" ||
          hostStoppingRule.status === "not-met"
            ? ("not-met" as const)
            : nativeStoppingRule.status === "met" &&
                hostStoppingRule.status === "met"
              ? ("met" as const)
              : ("not-started" as const),
        note: `Native stage: ${nativeStoppingRule.note} Host-assisted stage: ${hostStoppingRule.note}`.slice(
          0,
          2_000,
        ),
      }
    : { ...nativeStoppingRule };

  return {
    queryMatrix,
    channels,
    stoppingRule,
  };
}

function sourceLocatorKey(locator: string) {
  return locator
    .trim()
    .replace(/#.*$/, "")
    .replace(/\/+$/, "")
    .toLocaleLowerCase("en-US");
}

function publicScreen02ProposalSource(source: Screen02Source) {
  // `evidenceText` is fixed-retrieval material carried inside canonical
  // state. A legacy proposal payload may echo this bounded field, but its
  // caller copy is never authoritative: compare only the public projection
  // and either rehydrate retained evidence or discard the untrusted prose.
  const { evidenceText: _fixedRetrievalEvidence, ...publicSource } = source;
  return publicSource;
}

function constrainAssessedProposalProvenance(
  session: Screen02Session,
  proposals: readonly Screen02Proposal[],
): Screen02Proposal[] {
  const existingItems = session.items;
  const existingSources = existingItems.flatMap((item) =>
    item.sources.map((source) => ({
      itemId: item.id,
      source,
      locatorKey: sourceLocatorKey(source.locator),
    })),
  );
  const rawSourceById = new Map<string, string>();
  const rawSourceByLocator = new Map<string, string>();

  for (const proposal of proposals) {
    for (const source of proposal.sources) {
      const serialized = serializeDeterministicJson(
        publicScreen02ProposalSource(source),
      );
      const priorIdRecord = rawSourceById.get(source.id);
      const locatorKey = sourceLocatorKey(source.locator);
      const priorLocatorRecord = rawSourceByLocator.get(locatorKey);
      if (
        (priorIdRecord && priorIdRecord !== serialized) ||
        (priorLocatorRecord &&
          priorLocatorRecord !== serialized)
      ) {
        throw new Error(
          `Assessment source ${source.id} conflicts with another source record that uses the same id or locator.`,
        );
      }
      rawSourceById.set(source.id, serialized);
      rawSourceByLocator.set(locatorKey, serialized);
    }
  }

  return proposals.map((proposal) => {
    const existingItem = existingItems.find(
      (item) => item.id === proposal.id,
    );
    return {
      ...proposal,
      sources: proposal.sources.map((source) => {
        const publicSource = publicScreen02ProposalSource(source);
        const serialized = serializeDeterministicJson(publicSource);
        const exactExistingSource = existingItem?.sources.find(
          (candidate) =>
            candidate.id === source.id &&
            serializeDeterministicJson(
              publicScreen02ProposalSource(candidate),
            ) === serialized,
        );
        if (exactExistingSource) {
          // Rehydrate the server-retained record rather than accepting a
          // caller copy. This preserves connector evidence across legacy AI
          // review while keeping that evidence off the writable boundary.
          return { ...exactExistingSource };
        }

        const locatorKey = sourceLocatorKey(source.locator);
        const existingCollision = existingSources.find(
          (entry) =>
            entry.source.id === source.id ||
            entry.locatorKey === locatorKey,
        );
        if (existingCollision) {
          throw new Error(
            `Assessment source ${source.id} conflicts with existing source ${existingCollision.source.id}; existing provenance must be preserved exactly.`,
          );
        }

        const method = source.authorityAssessment?.method;
        if (
          method === "connector-native" ||
          method === "system-domain-rule"
        ) {
          throw new Error(
            `Assessment source ${source.id} cannot claim native or fixed-domain provenance unless it exactly preserves an existing source record.`,
          );
        }

        return {
          ...publicSource,
          authorityTier: 6 as const,
          authorityAssessment: {
            method: "unverified" as const,
            reason:
              "The host located this source during preliminary discovery; its authority and operative role remain unverified until Screen 3.",
            policyVersion: SCREEN_02_SOURCE_POLICY_VERSION,
          },
        };
      }),
    } as Screen02Proposal;
  });
}

function discoveryQuery(
  session: Screen02Session,
  criteria: Screen02PreferenceCriterion[],
  assistantTerms: readonly string[] = [],
) {
  const context = session.screen01Baseline;
  const positiveCriteria = criteria
    // "Rank higher" changes only post-retrieval ordering. Sending it to a
    // connector would silently turn a preference into an eligibility filter.
    .filter((criterion) => criterion.kind === "require")
    .map((criterion) => criterion.text)
    .join(" ");
  return [
    context.startingPoint === "audit" ? context.knownShock : "",
    context.scopeContract.industry,
    context.scopeContract.eventFamily,
    positiveCriteria,
    ...assistantTerms,
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 240);
}

function matchingEvidence(
  proposals: readonly Screen02FindProposal[],
  knownShock: string,
) {
  const anchor = normalizedBoundary(knownShock);
  if (!anchor) return [];
  const significantWords = knownShock
    .normalize("NFKC")
    .match(/[\p{L}\p{N}]+/gu) ?? [];
  const acronymStopWords = new Set([
    "a",
    "an",
    "and",
    "for",
    "in",
    "of",
    "on",
    "the",
    "to",
  ]);
  const acronym = significantWords
    .filter((word) => !acronymStopWords.has(word.toLocaleLowerCase("en-US")))
    .map((word) => [...word][0] ?? "")
    .join("");
  const parentheticalTerms = [...knownShock.matchAll(/\(([^()]{2,80})\)/gu)]
    .map((match) => normalizedBoundary(match[1] ?? ""));
  const acceptedNames = new Set([
    anchor,
    ...parentheticalTerms,
    ...(acronym.length >= 3 && acronym.length <= 12
      ? [normalizedBoundary(acronym)]
      : []),
  ].filter(Boolean));
  const containsAcceptedName = (candidate: string) => {
    const normalized = ` ${normalizedBoundary(candidate)} `;
    return [...acceptedNames].some(
      (accepted) =>
        normalized.trim() === accepted ||
        normalized.includes(` ${accepted} `),
    );
  };
  return proposals.filter((proposal) => {
    return containsAcceptedName(
      `${proposal.title} ${proposal.event.displayName}`,
    );
  });
}

function uniqueText(
  values: readonly string[],
  maxItems = 30,
) {
  return [
    ...new Map(
      values
        .filter((value) => value.trim())
        .map((value) => [normalizedBoundary(value), value]),
    ).values(),
  ].slice(0, maxItems);
}

function uniqueSources(
  proposals: readonly Screen02FindProposal[],
): Screen02Source[] {
  const sources = new Map<string, Screen02Source>();
  for (const source of proposals.flatMap((proposal) => proposal.sources)) {
    const key = normalizedBoundary(source.locator || source.id);
    if (!sources.has(key)) sources.set(key, source);
  }
  return [...sources.values()].slice(0, 50);
}

function auditEvidenceProposals(
  knownShock: string,
  evidence: readonly Screen02FindProposal[],
): Screen02AuditProposal[] {
  return evidence.map((proposal) => ({
    id: proposal.id,
    mode: "audit",
    kind: "representation",
    // This is a compatibility field in the v2 Screen 2 capsule. The UI and
    // downstream handoff treat the record as an event-identity match; Screen 3
    // is responsible for proposing and verifying empirical representations.
    representationType: "whole-package",
    title: proposal.event.displayName,
    description: `${proposal.description} This is a provisional source-backed match for the exact Screen 1 shock “${knownShock}”; confirm that it is the intended event before continuing.`,
    candidateConstruct: `${knownShock}: resolved event ${proposal.event.displayName}`,
    operationalization: `Confirm the identity, issuing authority, operative dates, affected population, and source passages for “${knownShock}” in Screen 3 before constructing exposure.`,
    origin: proposal.origin,
    provisionalDates: [...proposal.provisionalDates],
    affectedPopulation: proposal.affectedPopulation,
    requiredVariables: [...proposal.requiredVariables],
    outcomeLink: { ...proposal.outcomeLink },
    likelyServiceLevel: proposal.likelyServiceLevel,
    limitations: uniqueText([
      ...proposal.limitations,
      "This record supports event identity only. Dates, eligibility rules, phases, exposure, and empirical representation remain provisional until Screen 3 verification.",
    ]),
    reasons: uniqueText([
      ...proposal.reasons,
      `The official or reviewed record matched the exact named shock “${knownShock}” or a controlled alias.`,
      "No outcome values were inspected.",
    ]),
    sources: proposal.sources.map((source) => ({ ...source })),
    ...(proposal.assessments
      ? { assessments: proposal.assessments }
      : {}),
  }));
}

function shockEvidenceRecord(
  knownShock: string,
  evidence: readonly Screen02FindProposal[],
): Screen02SearchRound["shockEvidence"] {
  if (evidence.length === 0) return undefined;
  return {
    status: "shock-level-reconnaissance",
    anchorShock: knownShock,
    matchMethod: "exact-name-or-controlled-alias",
    proposalIds: evidence.map((proposal) => proposal.id).slice(0, 40),
    candidateNames: uniqueText(
      evidence.map((proposal) => proposal.event.displayName),
      40,
    ),
    sources: uniqueSources(evidence),
    provisionalDates: uniqueText(
      evidence.flatMap((proposal) => proposal.provisionalDates),
    ),
    affectedPopulations: uniqueText(
      evidence.map((proposal) => proposal.affectedPopulation),
    ),
    note:
      "These records support identity resolution for the exact named shock. Their sources are attached to the corresponding event-match cards; Screen 3 must still verify controlling passages, dates, rules, exposure, and any empirical representation.",
  };
}

function gdacsEventTypesFor(eventFamily: string) {
  const normalized = normalizedBoundary(eventFamily);
  const types: GdacsEventType[] = [];
  const mappings: Array<[RegExp, GdacsEventType]> = [
    [/\b(earthquake|seismic)\b/, "EQ"],
    [/\b(cyclone|hurricane|typhoon|tropical storm)\b/, "TC"],
    [/\b(flood|flooding)\b/, "FL"],
    [/\b(volcano|volcanic)\b/, "VO"],
    [/\b(wildfire|forest fire)\b/, "WF"],
    [/\b(drought)\b/, "DR"],
    [/\b(tsunami)\b/, "TS"],
  ];
  for (const [pattern, type] of mappings) {
    if (pattern.test(normalized)) types.push(type);
  }
  return types.length > 0 ? types : undefined;
}

const GDACS_CANONICAL_COUNTRY_NAMES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia", "Democratic Republic of the Congo", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Ivory Coast", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Republic of the Congo", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe",
] as const;

function normalizedCountryLabel(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const GDACS_COUNTRY_NAME_BY_LABEL = new Map<string, string>([
  ...GDACS_CANONICAL_COUNTRY_NAMES.map(
    (country) => [normalizedCountryLabel(country), country] as const,
  ),
  ["us", "United States"],
  ["u s", "United States"],
  ["usa", "United States"],
  ["united states of america", "United States"],
  ["uk", "United Kingdom"],
  ["u k", "United Kingdom"],
  ["great britain", "United Kingdom"],
  ["chinese", "China"],
  ["中国", "China"],
  ["中华人民共和国", "China"],
  ["thai", "Thailand"],
  ["ไทย", "Thailand"],
  ["czech republic", "Czechia"],
  ["ivory coast", "Ivory Coast"],
  ["cote d ivoire", "Ivory Coast"],
  ["viet nam", "Vietnam"],
]);

function gdacsCountryNameFor(plan: Screen02SourceRoutePlan) {
  if (
    plan.jurisdiction.kind === "global" ||
    plan.jurisdiction.kind === "european-union"
  ) {
    return undefined;
  }
  if (plan.jurisdiction.kind === "united-states") {
    return "United States";
  }
  return GDACS_COUNTRY_NAME_BY_LABEL.get(
    normalizedCountryLabel(plan.jurisdiction.label),
  );
}

function declaredRuntimeLimitations(
  route: Screen02SourceRoute,
): Screen02RuntimeSourceLimitation[] {
  return route.limitations.map((note) => ({
    connectorId: route.connectorId,
    kind: "declared-source-boundary",
    note,
    requiresHostDiscovery:
      route.connectorId === "federal-register-api-v1" &&
      /\bstate,\s+local,\s+tribal\b/i.test(note),
  }));
}

async function officialDiscoveryBaseline(
  env: ShockAuditEnv,
  session: Screen02Session,
  criteria: Screen02PreferenceCriterion[],
  retrievedAt: string,
  limit: number,
  assistantTerms: readonly string[] = [],
  expansionContext: Screen02OfficialDiscoveryExpansionContext = {},
  studyProfile?: Screen02StudyRelevanceProfile,
): Promise<Screen02OfficialDiscoveryBatch> {
  const context = session.screen01Baseline;
  const scope = context.scopeContract;
  const possibleIssuers = uniqueText([
    ...(expansionContext.auditIdentity?.issuer
      ? [expansionContext.auditIdentity.issuer]
      : []),
    ...(expansionContext.routingHints?.possibleIssuers ?? []),
  ], 6);
  const possibleIssuingJurisdictions = uniqueText([
    ...(expansionContext.auditIdentity?.issuingJurisdiction
      ? [expansionContext.auditIdentity.issuingJurisdiction]
      : []),
    ...(expansionContext.routingHints?.possibleIssuingJurisdictions ?? []),
    ...(studyProfile?.possibleIssuingJurisdictions ?? []),
  ], 6);
  const plan = planScreen02SourceRoutes({
    geography: scope.geography,
    eventFamily: scope.eventFamily,
    possibleIssuers,
    possibleIssuingJurisdictions,
  });
  const dateRange = studyDateRange(scope.studyPeriod);
  const skippedRoutes: Screen02SkippedSourceRoute[] = [];
  const runtimeLimitations: Screen02RuntimeSourceLimitation[] = [];
  const funnelBase = {
    profileVersion: SCREEN02_RELEVANCE_PROFILE_VERSION,
    rawCandidateTarget: SCREEN02_DISCOVERY_RAW_CANDIDATE_TARGET,
    rawCandidateMaximum: SCREEN02_DISCOVERY_RAW_CANDIDATE_MAX,
    qualifiedCandidateTarget: SCREEN02_DISCOVERY_QUALIFIED_CANDIDATE_TARGET,
    maximumRounds: SCREEN02_DISCOVERY_MAX_ROUNDS,
    minimumQueryVariants: SCREEN02_DISCOVERY_MIN_QUERY_VARIANTS,
    maximumQueryVariants: SCREEN02_DISCOVERY_MAX_QUERY_VARIANTS,
  } as const;
  if (!dateRange) {
    return {
      plan,
      results: [],
      skippedRoutes: plan.routes.map((route) => ({
        connectorId: route.connectorId,
        note: `The route was not searched because the confirmed study period “${scope.studyPeriod}” could not be converted to an inclusive calendar-date range. Any assisted discovery must preserve this limitation and seek clarification before adding live discoveries.`,
      })),
      runtimeLimitations,
      funnel: {
        ...funnelBase,
        queryVariantsPlanned: 0,
        queryRequestsExecuted: 0,
        roundsExecuted: 0,
        recordsReceived: 0,
        proposalsGenerated: 0,
        uniqueProposalsGenerated: 0,
        hostQueryExecution: screen02HostQueryExecution({
          assistantTerms,
          primaryQuery: scope.industry,
          variants: [],
          plannedVariantIds: new Set(),
          executedVariantIds: new Set(),
          executable: false,
        }),
        stoppingReason: "invalid-study-period",
      },
      retrievedAt,
    };
  }
  const fetchImpl: Screen02ConnectorFetch =
    env.CONNECTOR_FETCH ??
    ((input, init) => globalThis.fetch(input, init));
  const shared = {
    fetch: fetchImpl,
    retrievedAt,
    ...dateRange,
    population: scope.population,
    outcomeFamily: scope.outcomeFamily,
  };
  const nativeQueryPlan = buildScreen02NativeQueryPlan({
    industry: scope.industry,
    knownShock:
      context.startingPoint === "audit" ? context.knownShock : "",
    require: preferenceGroups(criteria).require,
    assistantTerms,
    studyProfile,
  });
  const profile = screen02StudyProfileIndustryTerms(
    scope.industry,
    studyProfile,
  );
  const researchTerms = distinctiveScreen02ResearchTerms([
    scope.industry,
    scope.eventFamily,
    ...assistantTerms,
  ].join(" "));
  const primaryHostQuery = profile.scopeMode === "cross-industry"
    ? nativeQueryPlan.variants[0]?.query ?? scope.industry
    : scope.industry;
  // A validated host review is useful only if its bounded vocabulary reaches
  // an actual fixed connector. Keep the deterministic primary query first,
  // then schedule up to four distinct host variants inside the executed
  // native slice; all remaining fixed variants retain their stable order.
  const queryVariants = scheduleScreen02HostQueryVariants({
    nativeQueryPlan,
    primaryQuery: primaryHostQuery,
    assistantTerms,
  });
  const plannedHostVariantIds = new Set<string>();
  const executedHostVariantIds = new Set<string>();
  if (
    context.startingPoint === "find" &&
    nativeQueryPlan.status === "ready"
  ) {
    const fallbackTerms = [
      ...profile.queryFacets.map((facet) => facet.term),
      ...researchTerms,
      "effective date",
      "covered entities",
      "eligibility threshold",
      "implementation",
      "enforcement",
      "amendment",
      "exemption",
      "reporting requirement",
      "licensing requirement",
      "safety standard",
      "market access",
      "tax or fee",
    ];
    const seenQueries = new Set(
      queryVariants.map((variant) => normalizedBoundary(variant.query)),
    );
    for (const term of fallbackTerms) {
      if (queryVariants.length >= SCREEN02_DISCOVERY_MAX_QUERY_VARIANTS) break;
      const query = `${scope.industry} ${term}`
        .replace(/\s+/gu, " ")
        .trim()
        .slice(0, 160);
      const normalized = normalizedBoundary(query);
      if (!query || !normalized || seenQueries.has(normalized)) continue;
      seenQueries.add(normalized);
      queryVariants.push({
        id: `worker-native-${String(queryVariants.length + 1).padStart(2, "0")}`,
        query,
        purpose: `Defensive profile-driven recall variant (${SCREEN02_RELEVANCE_PROFILE_VERSION}); lexical retrieval does not establish candidate fit.`,
        strategy: "industry-alias",
      });
    }
  }
  const legalRoutes = plan.routes.filter((route) =>
    route.connectorId === "federal-register-api-v1" ||
    route.connectorId === "eu-cellar-sparql-v1" ||
    route.connectorId === "uk-legislation-atom-v1"
  );
  for (const route of plan.routes) {
    runtimeLimitations.push(...declaredRuntimeLimitations(route));
    if (route.connectorId === "eu-cellar-sparql-v1") {
      runtimeLimitations.push({
        connectorId: route.connectorId,
        kind: "execution-language-boundary",
        note: "This native CELLAR execution queried English-language metadata only. Other official EU languages were not searched in the native round.",
        requiresHostDiscovery: true,
      });
    }
  }

  const runLegalQuery = (
    route: Screen02SourceRoute,
    variant: (typeof queryVariants)[number],
    resultLimit: number,
  ) => {
    const queryPurpose = `${variant.purpose} Query-plan version: ${nativeQueryPlan.version}; source route: ${route.connectorId}.`;
    switch (route.connectorId) {
      case "federal-register-api-v1":
        return fetchFederalRegisterProposals({
          ...shared,
          limit: resultLimit,
          ...(context.startingPoint === "find"
            ? { documentTypes: ["RULE", "PRORULE", "NOTICE"] as const }
            : {}),
          query: variant.query,
          queryId: `${variant.id}:federal-register`,
          queryPurpose,
          eventFamily: scope.eventFamily,
          workflowMode: context.startingPoint,
        });
      case "eu-cellar-sparql-v1":
        return fetchEuCellarLegalProposals({
          ...shared,
          limit: resultLimit,
          query: variant.query,
          queryId: `${variant.id}:eu-cellar`,
          queryPurpose,
          language: "en",
        });
      case "uk-legislation-atom-v1":
        return fetchUkLegislationProposals({
          ...shared,
          limit: resultLimit,
          query: variant.query,
          queryId: `${variant.id}:uk-legislation`,
          queryPurpose,
        });
      default:
        throw new Error("The common legal connector pipeline received a non-legal route.");
    }
  };

  const results: Screen02OfficialConnectorResult[] = [];
  let queryVariantsPlanned = 0;
  let roundsExecuted = 0;
  if (legalRoutes.length > 0) {
    if (nativeQueryPlan.status !== "ready") {
      legalRoutes.forEach((route) => skippedRoutes.push({
        connectorId: route.connectorId,
        note: nativeQueryPlan.note,
      }));
    } else {
      // When guarded expansion is enabled, reserve the second and final
      // network phase for its four lifecycle variants. Cached baseline
      // replay inside the expansion engine is not another network request.
      const nativeQueryLimit =
        context.startingPoint === "find" &&
          screen02SearchExpansionMode(env) !== "off"
          ? SCREEN02_DISCOVERY_MIN_QUERY_VARIANTS
          : SCREEN02_DISCOVERY_MAX_QUERY_VARIANTS;
      const boundedVariants = queryVariants.slice(
        0,
        context.startingPoint === "find"
          ? nativeQueryLimit
          : 1,
      );
      const assignments = context.startingPoint === "find"
        ? (() => {
            const ukRoute = legalRoutes.find((route) =>
              route.connectorId === "uk-legislation-atom-v1"
            );
            if (!ukRoute) {
              return boundedVariants.map((variant, index) => ({
                variant,
                route: legalRoutes[index % legalRoutes.length]!,
              }));
            }
            const otherRoutes = legalRoutes.filter((route) =>
              route.connectorId !== "uk-legislation-atom-v1"
            );
            // legislation.gov.uk publishes a host-wide crawl delay. Its Atom
            // title search returns up to twenty records, so one concise query
            // supplies the bounded UK lane without rapidly replaying twelve
            // near-duplicate query variants against the same host.
            return [
              { variant: boundedVariants[0]!, route: ukRoute },
              ...boundedVariants.slice(1).flatMap((variant, index) =>
                otherRoutes.length === 0
                  ? []
                  : [{
                      variant,
                      route: otherRoutes[index % otherRoutes.length]!,
                    }]
              ),
            ];
          })()
        : legalRoutes.map((route) => ({
            variant: boundedVariants[0]!,
            route,
          }));
      assignments.forEach(({ variant }) => {
        if (variant.strategy === "chatgpt-query-expansion") {
          plannedHostVariantIds.add(variant.id);
        }
      });
      queryVariantsPlanned = assignments.length;
      const firstRoundCount = context.startingPoint === "find"
        ? Math.min(SCREEN02_DISCOVERY_MIN_QUERY_VARIANTS, assignments.length)
        : assignments.length;
      const firstRound = assignments.slice(0, firstRoundCount);
      if (firstRound.length > 0) {
        firstRound.forEach(({ variant }) =>
          executedHostVariantIds.add(variant.id));
        const firstRoundLimit = context.startingPoint === "find"
          ? SCREEN02_LEGAL_QUERY_RESULT_LIMIT
          : Math.min(20, Math.max(1, limit));
        results.push(...await Promise.all(
          firstRound.map(({ route, variant }) =>
            runLegalQuery(
              route,
              variant,
              route.connectorId === "uk-legislation-atom-v1"
                ? 20
                : firstRoundLimit,
            )
          ),
        ));
        roundsExecuted = 1;
      }
      const firstRoundUnique = new Set(
        results.flatMap((result) => result.proposals).map((proposal) =>
          proposal.mode === "find"
            ? `${normalizedBoundary(proposal.nativeIdentity?.formalIdentifier ?? proposal.id)}:${normalizedBoundary(proposal.nativeIdentity?.issuingJurisdiction ?? "")}`
            : normalizedBoundary(proposal.id)
        ),
      ).size;
      const secondRound = assignments.slice(firstRoundCount);
      if (
        context.startingPoint === "find" &&
        screen02SearchExpansionMode(env) === "off" &&
        firstRoundUnique < SCREEN02_DISCOVERY_RAW_CANDIDATE_TARGET &&
        secondRound.length > 0 &&
        roundsExecuted < SCREEN02_DISCOVERY_MAX_ROUNDS
      ) {
        secondRound.forEach(({ variant }) =>
          executedHostVariantIds.add(variant.id));
        results.push(...await Promise.all(
          secondRound.map(({ route, variant }) => runLegalQuery(route, variant, 3)),
        ));
        roundsExecuted = 2;
      }
    }
  } else {
    const structuredTasks: Array<Promise<Screen02OfficialConnectorResult>> = [];
    const executableStructuredRoutes = plan.routes.filter((route) =>
      route.connectorId === "openfema-disaster-declarations-v2" ||
      route.connectorId === "gdacs-event-search-v1" ||
      route.connectorId === "usgs-earthquake-catalog-v1"
    );
    const structuredLimit = Math.min(
      20,
      Math.max(
        1,
        Math.ceil(
          SCREEN02_DISCOVERY_RAW_CANDIDATE_TARGET /
            Math.max(1, executableStructuredRoutes.length),
        ),
      ),
    );
    for (const route of executableStructuredRoutes) {
      switch (route.connectorId) {
        case "openfema-disaster-declarations-v2":
          structuredTasks.push(fetchOpenFemaDisasterProposals({
            ...shared,
            limit: context.startingPoint === "find" ? structuredLimit : limit,
            state: plan.jurisdiction.usState?.code,
          }));
          break;
        case "gdacs-event-search-v1": {
          const countryName = gdacsCountryNameFor(plan);
          if (
            plan.jurisdiction.kind === "european-union" &&
            countryName === undefined
          ) {
            skippedRoutes.push({
              connectorId: route.connectorId,
              note: "The route was not searched because GDACS accepts one country-name filter, while the confirmed European Union boundary spans multiple member states and ShockAudit has not validated an EU-wide country expansion. A bounded global page could omit relevant events and member-state labels cannot safely be relabeled as European Union. Any assisted discovery must search disclosed EU and member-state routes instead.",
            });
            break;
          }
          structuredTasks.push(fetchGdacsDisasterProposals({
            ...shared,
            limit: context.startingPoint === "find" ? structuredLimit : limit,
            eventTypes: gdacsEventTypesFor(scope.eventFamily),
            countryName,
          }));
          if (plan.jurisdiction.kind !== "global" && countryName === undefined) {
            runtimeLimitations.push({
              connectorId: route.connectorId,
              kind: "execution-filter-boundary",
              note: `This bounded GDACS execution could not validate ${plan.jurisdiction.label} as one supported country name. It searched the bounded global feed without relabeling records as local.`,
              requiresHostDiscovery: true,
            });
          }
          break;
        }
        case "usgs-earthquake-catalog-v1":
          if (plan.jurisdiction.kind !== "global") {
            skippedRoutes.push({
              connectorId: route.connectorId,
              note: `No validated geographic bounding box is configured for ${plan.jurisdiction.label}; the connector was not widened to the global catalog or relabeled as local.`,
            });
            break;
          }
          structuredTasks.push(fetchUsgsEarthquakeProposals({
            ...shared,
            limit: context.startingPoint === "find" ? structuredLimit : limit,
            geographyLabel: "Worldwide",
          }));
          break;
      }
    }
    queryVariantsPlanned = structuredTasks.length;
    if (structuredTasks.length > 0) {
      results.push(...await Promise.all(structuredTasks));
      roundsExecuted = 1;
    }
  }
  const generated = results.flatMap((result) => result.proposals);
  const uniqueProposalsGenerated =
    screen02UniqueOfficialProposalCount(generated);
  const stoppingReason: Screen02OfficialDiscoveryFunnel["stoppingReason"] =
    uniqueProposalsGenerated >= SCREEN02_DISCOVERY_RAW_CANDIDATE_TARGET
      ? "raw-target-reached"
      : results.length > 0
        ? queryVariantsPlanned >= SCREEN02_DISCOVERY_MAX_QUERY_VARIANTS
          ? "query-budget-exhausted"
          : "routes-exhausted"
        : "unsupported-route";
  return {
    plan,
    results,
    skippedRoutes,
    runtimeLimitations,
    funnel: {
      ...funnelBase,
      queryVariantsPlanned,
      queryRequestsExecuted: results.length,
      roundsExecuted,
      recordsReceived: results.reduce(
        (sum, result) => sum + result.diagnostics.recordsReceived,
        0,
      ),
      proposalsGenerated: generated.length,
      uniqueProposalsGenerated,
      hostQueryExecution: screen02HostQueryExecution({
        assistantTerms,
        primaryQuery: primaryHostQuery,
        variants: queryVariants,
        plannedVariantIds: plannedHostVariantIds,
        executedVariantIds: executedHostVariantIds,
        executable:
          context.startingPoint === "find" &&
          nativeQueryPlan.status === "ready" && legalRoutes.length > 0,
      }),
      stoppingReason,
    },
    retrievedAt,
  };
}

type Screen02SearchExpansionMode = "off" | "shadow" | "on";

const SCREEN_02_EXPANDABLE_CONNECTORS = new Set<Screen02ConnectorId>([
  "federal-register-api-v1",
  "eu-cellar-sparql-v1",
  "uk-legislation-atom-v1",
]);

function screen02SearchExpansionMode(
  env: ShockAuditEnv,
): Screen02SearchExpansionMode {
  switch (env.SCREEN02_SEARCH_EXPANSION_MODE) {
    case "off":
    case "on":
    case "shadow":
      return env.SCREEN02_SEARCH_EXPANSION_MODE;
    default:
      return "off";
  }
}

function screen02ProposalSearchRecord(
  proposal: Screen02Proposal,
): Screen02SearchRecordInput<Screen02Proposal> {
  const find = proposal.mode === "find" ? proposal : null;
  return {
    recordId: proposal.id,
    canonicalIdentity: proposal.title,
    identityAliases:
      find && find.event.displayName !== proposal.title
        ? [find.event.displayName]
        : undefined,
    formalIdentifier: find?.nativeIdentity?.formalIdentifier ?? null,
    issuer: find?.nativeIdentity?.issuer ?? null,
    issuingJurisdiction:
      find?.nativeIdentity?.issuingJurisdiction ??
      find?.event.geographies[0] ??
      null,
    treatmentAssignmentSignature:
      screen02TreatmentAssignmentSignature(proposal),
    semanticEventKey: stableScreen02ProposalId(proposal),
    locator: proposal.sources[0]?.locator ?? null,
    directSupport: true,
    value: proposal,
  };
}

function screen02ContextLeadRecord(
  lead: Screen02ContextSearchLead,
  retrievedAt: string,
): Screen02SearchRecordInput<Screen02Proposal> {
  const leadLane = screen02ContextLeadLane(lead);
  return {
    ...lead,
    directSupport: false,
    value: {
      ...lead.value,
      origin: "unsupported-lead",
      sources: lead.value.sources.map((source) => ({
        ...source,
        authorityTier: 6,
        authorityAssessment: {
          method: "unverified",
          reason:
            "A feature-gated contextual search returned this discovery lead; direct supporting evidence is required before reliance.",
          policyVersion: SCREEN_02_SOURCE_POLICY_VERSION,
        },
        channel: leadLane === "other"
          ? "feature-gated-context-lead"
          : source.channel,
        retrievedAt: source.retrievedAt ?? retrievedAt,
      })),
    },
  };
}

type Screen02ContextOfficialBridge = {
  leadId: string;
  formalIdentifier: string;
  result: Screen02OfficialConnectorResult;
};

async function executeScreen02ContextOfficialBridge(input: {
  env: ShockAuditEnv;
  session: Screen02Session;
  retrievedAt: string;
  lead: Pick<Screen02SearchRecordInput<Screen02Proposal>, "recordId" | "value">;
}): Promise<Screen02ContextOfficialBridge | null> {
  if (input.lead.value.mode !== "find") return null;
  const formalIdentifier = screen02VisibleTitleFederalRegisterIdentifier(
    input.lead.value.title,
  );
  if (!formalIdentifier) return null;
  const dateRange = studyDateRange(
    input.session.screen01Baseline.scopeContract.studyPeriod,
  );
  if (!dateRange) return null;
  const scope = input.session.screen01Baseline.scopeContract;
  const fetchImpl: Screen02ConnectorFetch =
    input.env.CONNECTOR_FETCH ??
    ((request, init) => globalThis.fetch(request, init));
  const result = await fetchFederalRegisterProposals({
    fetch: fetchImpl,
    retrievedAt: input.retrievedAt,
    query: formalIdentifier,
    exactDocumentNumber: formalIdentifier,
    queryId:
      `context-official-bridge:${input.lead.recordId}`.slice(0, 100),
    queryPurpose:
      `Independently verify Federal Register document ${formalIdentifier}, which appeared in the visible title of contextual lead ${input.lead.recordId}. The lead metadata itself supplies no event evidence, date, fit, rank, or authority.`,
    ...dateRange,
    population: scope.population,
    outcomeFamily: scope.outcomeFamily,
    eventFamily: scope.eventFamily,
    workflowMode: input.session.screen01Baseline.startingPoint,
    documentTypes: ["RULE", "PRORULE", "NOTICE"],
    limit: 5,
    timeoutMs: SCREEN_02_SEARCH_EXPANSION_DEADLINE_MS,
  });
  return {
    leadId: input.lead.recordId,
    formalIdentifier,
    result,
  };
}

function screen02ExpansionSourceInputs(
  discovery: Screen02OfficialDiscoveryBatch,
  includeContext: boolean,
) {
  const resultsByConnector = new Map<
    Screen02ConnectorId,
    Screen02OfficialConnectorResult[]
  >();
  for (const result of discovery.results) {
    const connector = result.diagnostics.connector;
    const existing = resultsByConnector.get(connector) ?? [];
    existing.push(result);
    resultsByConnector.set(connector, existing);
  }
  const sources: Screen02SearchPlanSourceInput[] = [];
  let remainingBaselineQueries = SCREEN02_DISCOVERY_MIN_QUERY_VARIANTS;
  for (const [sourceId, results] of resultsByConnector) {
    const selectedResults = results.slice(0, remainingBaselineQueries);
    remainingBaselineQueries = Math.max(
      0,
      remainingBaselineQueries - selectedResults.length,
    );
    sources.push({
      sourceId,
      role: "official",
      baselineQueries: selectedResults.map((result, index) => ({
        query:
          result.diagnostics.queryMatrix[0]?.query ??
          result.diagnostics.requestUrl ??
          `${sourceId} baseline request ${index + 1}`,
        purpose:
          result.diagnostics.queryMatrix[0]?.purpose ??
          "Run the existing official connector request unchanged.",
      })),
      expandedStages:
        sourceId !== "uk-legislation-atom-v1" &&
          SCREEN_02_EXPANDABLE_CONNECTORS.has(sourceId)
        ? ["identity", "timing", "coverage", "implementation"]
        : [],
    });
  }
  if (includeContext) {
    sources.push({
      sourceId: "host-context-search-v1",
      role: "context",
      baselineQueries: [],
      // One identity-bound metadata lookup is enough; repeated lifecycle
      // variants resolve to the same bounded GDELT query.
      expandedStages: ["implementation"],
    });
  }
  return { sources, resultsByConnector };
}

function screen02ConnectorResultFailed(
  result: Screen02OfficialConnectorResult,
) {
  return result.diagnostics.channels.some(
    (channel) => channel.status === "failed",
  );
}

async function executeScreen02ExpandedOfficialQuery(input: {
  env: ShockAuditEnv;
  session: Screen02Session;
  retrievedAt: string;
  variant: Screen02SearchQueryVariant;
  signal: AbortSignal;
}) {
  const scope = input.session.screen01Baseline.scopeContract;
  const dateRange = studyDateRange(scope.studyPeriod);
  if (!dateRange) {
    throw new Error("The confirmed study period has no executable date range.");
  }
  const fetchImpl: Screen02ConnectorFetch =
    input.env.CONNECTOR_FETCH ??
    ((request, init) => globalThis.fetch(request, init));
  const abortableFetch: Screen02ConnectorFetch = (request, init) =>
    fetchImpl(request, {
      ...init,
      // The expansion's single total deadline is stricter than the connector
      // local timer. A connector that ignores this signal is still contained
      // by the outer execution race.
      signal: input.signal,
    });
  const shared = {
    fetch: abortableFetch,
    retrievedAt: input.retrievedAt,
    ...dateRange,
    population: scope.population,
    outcomeFamily: scope.outcomeFamily,
    limit: input.variant.resultLimit,
    timeoutMs: SCREEN_02_SEARCH_EXPANSION_DEADLINE_MS,
  };
  let result: Screen02OfficialConnectorResult;
  switch (input.variant.sourceId as Screen02ConnectorId) {
    case "federal-register-api-v1":
      result = await fetchFederalRegisterProposals({
        ...shared,
        ...(input.session.screen01Baseline.startingPoint === "find"
          ? { documentTypes: ["RULE", "PRORULE", "NOTICE"] as const }
          : {}),
        query: input.variant.query,
        queryId: input.variant.id,
        queryPurpose: input.variant.purpose,
        eventFamily: scope.eventFamily,
        workflowMode: input.session.screen01Baseline.startingPoint,
      });
      break;
    case "eu-cellar-sparql-v1":
      result = await fetchEuCellarLegalProposals({
        ...shared,
        query: input.variant.query,
        queryId: input.variant.id,
        queryPurpose: input.variant.purpose,
        language: "en",
      });
      break;
    case "uk-legislation-atom-v1":
      result = await fetchUkLegislationProposals({
        ...shared,
        query: input.variant.query,
        queryId: input.variant.id,
        queryPurpose: input.variant.purpose,
      });
      break;
    default:
      throw new Error("The declared connector has no guarded expansion runner.");
  }
  return result;
}

function screen02ExpansionTelemetryRecord(input: {
  mode: Screen02SearchExpansionMode;
  workflowMode: "find" | "audit";
  status:
    | "off"
    | "not-eligible"
    | "shadow-compared"
    | "on-expanded"
    | "baseline-fallback";
  baseline: Screen02OfficialDiscoveryBatch;
  comparison: Screen02SearchComparisonTelemetry | null;
  contextProviderStatus: "not-enabled" | "unavailable" | "available";
  baselineDurationMs: number;
  expansionDurationMs: number;
  totalDurationMs: number;
}) {
  const baselineRecordCount = input.baseline.results.reduce(
    (sum, result) => sum + result.proposals.length,
    0,
  );
  const comparison = input.comparison;
  return {
    event: "screen02_search_expansion",
    version: SCREEN_02_SEARCH_EXPANSION_VERSION,
    mode: input.mode,
    workflowMode: input.workflowMode,
    status: input.status,
    contextProviderStatus: input.contextProviderStatus,
    baselineDurationMs: input.baselineDurationMs,
    expansionDurationMs: input.expansionDurationMs,
    totalDurationMs: input.totalDurationMs,
    baselineQueryCount:
      comparison?.baseline.queriesPlanned ?? input.baseline.results.length,
    expandedQueryCount: comparison?.expanded.queriesPlanned ?? 0,
    baselineRecordCount,
    baselineUniqueRecordCount:
      comparison?.baseline.uniqueRecordsSelected ?? baselineRecordCount,
    expandedRecordCount: comparison?.expanded.recordsReturned ?? 0,
    expandedAcceptedCount: comparison?.expanded.recordsAccepted ?? 0,
    contextLeadCount: comparison?.expanded.contextLeadCount ?? 0,
    selectedRecordCount: comparison?.selectedRecords ?? baselineRecordCount,
    baselinePreservedCount:
      comparison?.baselineRecordsPreserved ?? baselineRecordCount,
    identityFilterDropCount:
      comparison?.expanded.identityFilterDrops ?? 0,
    jurisdictionFilterDropCount:
      comparison?.expanded.jurisdictionFilterDrops ?? 0,
    duplicateDropCount: comparison?.expanded.duplicateDrops ?? 0,
    expansionFaultCount: comparison?.expanded.queriesFailed ?? 0,
    zeroResultRecovered: comparison?.zeroResultRecovered ?? false,
    selection: comparison?.selection ?? (baselineRecordCount > 0 ? "baseline-only" : "empty"),
    outcomeValuesInspected: false,
  };
}

type Screen02OfficialDiscoveryInvocationUsage = {
  sourceQueries: number;
};

async function officialDiscovery(
  env: ShockAuditEnv,
  session: Screen02Session,
  criteria: Screen02PreferenceCriterion[],
  retrievedAt: string,
  limit: number,
  expansionContext: Screen02OfficialDiscoveryExpansionContext = {},
  assistantTerms: readonly string[] = [],
  studyProfile?: Screen02StudyRelevanceProfile,
  invocationUsage?: Screen02OfficialDiscoveryInvocationUsage,
): Promise<Screen02OfficialDiscoveryBatch> {
  const monotonicNow = env.SCREEN02_SEARCH_MONOTONIC_NOW ?? (() => Date.now());
  const discoveryStartedAt = monotonicNow();
  const baseline = await officialDiscoveryBaseline(
    env,
    session,
    criteria,
    retrievedAt,
    limit,
    assistantTerms,
    expansionContext,
    studyProfile,
  );
  if (invocationUsage) {
    invocationUsage.sourceQueries += baseline.funnel.queryRequestsExecuted;
  }
  const baselineCompletedAt = monotonicNow();
  const mode = screen02SearchExpansionMode(env);
  const workflowMode =
    session.screen01Baseline.startingPoint === "audit" ? "audit" : "find";
  let status: Parameters<typeof screen02ExpansionTelemetryRecord>[0]["status"] =
    mode === "off" ? "off" : "not-eligible";
  let comparison: Screen02SearchComparisonTelemetry | null = null;
  let expansionCompletedAt = baselineCompletedAt;
  const contextProvider = screen02ContextSearchProvider(env);
  const contextProviderStatus = mode === "off"
    ? "not-enabled" as const
    : contextProvider
      ? "available" as const
      : "unavailable" as const;

  try {
    if (mode === "off") return baseline;
    const { sources, resultsByConnector } =
      screen02ExpansionSourceInputs(
        baseline,
        contextProviderStatus === "available",
      );
    if (
      sources.length === 0 ||
      !sources.some((source) => (source.expandedStages?.length ?? 0) > 0)
    ) {
      return baseline;
    }

    const scope = session.screen01Baseline.scopeContract;
    const resultsPerQuery = Math.min(
      20,
      Math.max(
        1,
        ...baseline.results.map((result) => result.diagnostics.resultLimit),
      ),
    );
    const auditIdentity = expansionContext.auditIdentity ?? {
      canonicalName: session.screen01Baseline.knownShock,
      issuingJurisdiction: baseline.plan.jurisdiction.label,
    };
    const plan = workflowMode === "audit"
      ? buildScreen02AuditSearchResearchPlan({
          eventFamily: scope.eventFamily,
          industry: scope.industry,
          identity: auditIdentity,
          sources,
          resultsPerQuery,
        })
      : buildScreen02FindSearchResearchPlan({
          eventFamily: scope.eventFamily,
          industry: scope.industry,
          topicTerms: [
            ...preferenceGroups(criteria).require,
            ...assistantTerms,
          ],
          sources,
          resultsPerQuery,
        });

    const baselineResultByQueryId = new Map<
      string,
      Screen02OfficialConnectorResult
    >();
    const baselineIndexes = new Map<string, number>();
    for (const variant of plan.baseline) {
      const index = baselineIndexes.get(variant.sourceId) ?? 0;
      const result = resultsByConnector.get(
        variant.sourceId as Screen02ConnectorId,
      )?.[index];
      baselineIndexes.set(variant.sourceId, index + 1);
      if (result) baselineResultByQueryId.set(variant.id, result);
    }
    const expandedResultsByQueryId = new Map<
      string,
      Screen02OfficialConnectorResult
    >();
    const expansion = await executeScreen02SearchExpansion<Screen02Proposal>({
      plan,
      retrievedAt,
      deadlineMs: SCREEN_02_SEARCH_EXPANSION_DEADLINE_MS,
      execute: async (variant, options) => {
        const baselineResult = baselineResultByQueryId.get(variant.id);
        if (variant.stage === "baseline") {
          if (!baselineResult) {
            throw new Error("The cached baseline result was unavailable.");
          }
          if (screen02ConnectorResultFailed(baselineResult)) {
            throw new Error("The cached baseline connector request failed.");
          }
          return baselineResult.proposals.map(screen02ProposalSearchRecord);
        }
        if (invocationUsage) invocationUsage.sourceQueries += 1;
        if (variant.sourceId === "host-context-search-v1") {
          const provider = contextProvider;
          if (!provider) {
            throw new Error("The optional host context provider is unavailable.");
          }
          const leads = await provider({
            mode: workflowMode,
            stage: variant.stage,
            query: variant.query,
            resultLimit: variant.resultLimit,
            retrievedAt,
            eventFamily: scope.eventFamily,
            startDate: studyDateRange(scope.studyPeriod)?.startDate ?? "",
            endDate: studyDateRange(scope.studyPeriod)?.endDate ?? "",
            identity: workflowMode === "audit"
              ? {
                  canonicalName: auditIdentity.canonicalName,
                  issuingJurisdiction:
                    auditIdentity.issuingJurisdiction ?? null,
                }
              : null,
            signal: options.signal,
          });
          if (!Array.isArray(leads)) {
            throw new Error("The host context provider returned an invalid result.");
          }
          return leads.slice(0, variant.resultLimit).map((lead) =>
            screen02ContextLeadRecord(lead, retrievedAt),
          );
        }
        const result = await executeScreen02ExpandedOfficialQuery({
          env,
          session,
          retrievedAt,
          variant,
          signal: options.signal,
        });
        expandedResultsByQueryId.set(variant.id, result);
        if (screen02ConnectorResultFailed(result)) {
          throw new Error("The guarded expansion connector request failed.");
        }
        return result.proposals.map(screen02ProposalSearchRecord);
      },
    });
    comparison = expansion.comparison;
    expansionCompletedAt = monotonicNow();
    status = mode === "shadow" ? "shadow-compared" : "on-expanded";
    const expandedQueryIds = new Set(
      plan.expanded.map((variant) => variant.id),
    );
    const expansionManifest: Screen02SearchManifestSupplement = {
      queryMatrix: expansion.manifestSupplement.queryMatrix.filter(
        (query) => expandedQueryIds.has(query.id),
      ),
      channels: expansion.manifestSupplement.channels.map((channel) => ({
        channel: channel.channel,
        status: channel.status,
        note: channel.note,
        ...(channel.retrievedAt
          ? { retrievedAt: channel.retrievedAt }
          : {}),
      })),
    };
    if (mode === "shadow") return { ...baseline, expansionManifest };

    const selectedByQueryId = new Map<string, Screen02Proposal[]>();
    const contextRecords = selectScreen02ContextLeadSlots(
      expansion.records.filter(
        (record) =>
          record.firstSeenStage !== "baseline" &&
          record.sourceRole === "context",
      ),
      5,
    );
    for (const record of expansion.records) {
      if (record.firstSeenStage === "baseline") continue;
      if (record.sourceRole === "context") {
        continue;
      }
      const records = selectedByQueryId.get(record.queryId) ?? [];
      records.push(record.value);
      selectedByQueryId.set(record.queryId, records);
    }
    const bridgeLead = contextRecords.find(
      (record) =>
        screen02ContextLeadLane(record) !== "other" &&
        record.value.mode === "find" &&
        screen02VisibleTitleFederalRegisterIdentifier(record.value.title) !==
          null,
    );
    let officialBridge: Screen02ContextOfficialBridge | null = null;
    if (bridgeLead) {
      if (invocationUsage) invocationUsage.sourceQueries += 1;
      officialBridge = await executeScreen02ContextOfficialBridge({
        env,
        session,
        retrievedAt,
        lead: bridgeLead,
      });
    }
    if (officialBridge) {
      expansionManifest.queryMatrix = [
        ...(expansionManifest.queryMatrix ?? []),
        ...officialBridge.result.diagnostics.queryMatrix.map((query) => ({
          id: query.id,
          query: query.query,
          purpose: query.purpose,
          returnedRecordIds: [...(query.returnedRecordIds ?? [])],
        })),
      ];
      expansionManifest.channels = [
        ...(expansionManifest.channels ?? []),
        ...officialBridge.result.diagnostics.channels.map((channel) => ({
          channel:
            `Context lead → official Federal Register bridge · ${channel.channel}`,
          status: channel.status,
          note:
            `Lead ${officialBridge.leadId} exposed document ${officialBridge.formalIdentifier} in its visible title. ${channel.note}`,
          ...(channel.retrievedAt
            ? { retrievedAt: channel.retrievedAt }
            : {}),
        })),
      ];
    }

    const bridgeQuery = officialBridge?.result.diagnostics.queryMatrix[0];
    const exactReturnedRecordIds = (bridgeQuery?.returnedRecordIds ?? [])
      .filter((recordId) => recordId === officialBridge?.formalIdentifier);
    const bridgeCorroborated = Boolean(
      officialBridge && bridgeQuery &&
      officialBridge.result.diagnostics.failureKind === "none" &&
      exactReturnedRecordIds.length === 1,
    );
    const expandedResults: Screen02OfficialConnectorResult[] = [];
    const expandedManifestQueryByPlannerId = new Map<
      string,
      NonNullable<Screen02SearchManifestSupplement["queryMatrix"]>[number]
    >();
    for (const variant of plan.expanded) {
      const proposals = selectedByQueryId.get(variant.id) ?? [];
      const result = expandedResultsByQueryId.get(variant.id);
      if (!result || proposals.length === 0) continue;
      const proposalIds = new Set(proposals.map((proposal) => proposal.id));
      const proposalBindings = result.proposalBindings.filter((binding) =>
        proposalIds.has(binding.proposalId)
      );
      if (
        !screen02SameStringSet(
          proposalBindings.map((binding) => binding.proposalId),
          [...proposalIds],
        )
      ) {
        throw new Error(
          "Guarded official expansion selected a proposal without its connector-produced record binding.",
        );
      }
      const returnedRecordIds = [...new Set(
        proposalBindings.flatMap((binding) => binding.returnedRecordIds),
      )];
      const returnedRecordIdsByConnectorQuery = new Map<string, string[]>();
      for (const binding of proposalBindings) {
        const retained = returnedRecordIdsByConnectorQuery.get(
          binding.queryId,
        ) ?? [];
        returnedRecordIdsByConnectorQuery.set(binding.queryId, [...new Set([
          ...retained,
          ...binding.returnedRecordIds,
        ])]);
      }
      if (returnedRecordIdsByConnectorQuery.size !== 1) {
        throw new Error(
          "Guarded official expansion did not produce one exact connector query for its selected records.",
        );
      }
      const connectorQueryId = [...returnedRecordIdsByConnectorQuery.keys()][0];
      const connectorQuery = result.diagnostics.queryMatrix.find(
        (query) => query.id === connectorQueryId,
      );
      if (
        !connectorQuery ||
        !returnedRecordIds.every((recordId) =>
          connectorQuery.returnedRecordIds?.includes(recordId)
        )
      ) {
        throw new Error(
          "Guarded official expansion selected records outside its connector-produced query account.",
        );
      }
      expandedManifestQueryByPlannerId.set(variant.id, {
        id: connectorQuery.id,
        query: connectorQuery.query,
        purpose: connectorQuery.purpose,
        returnedRecordIds: [...returnedRecordIds],
      });
      expandedResults.push({
        proposals,
        proposalBindings,
        diagnostics: {
          ...result.diagnostics,
          proposalsReturned: proposals.length,
          queryMatrix: result.diagnostics.queryMatrix.map((query) => ({
            ...query,
            returnedRecordIds: [
              ...(returnedRecordIdsByConnectorQuery.get(query.id) ?? []),
            ],
          })),
        },
      });
    }
    if (
      bridgeCorroborated && officialBridge &&
      officialBridge.result.proposals.length > 0
    ) {
      expandedResults.push(officialBridge.result);
    }
    const expandedOfficialQueryIds = new Set(
      plan.expanded
        .filter((variant) => variant.sourceRole === "official")
        .map((variant) => variant.id),
    );
    expansionManifest.queryMatrix = (expansionManifest.queryMatrix ?? [])
      .map((query) => {
        if (!expandedOfficialQueryIds.has(query.id)) return query;
        return expandedManifestQueryByPlannerId.get(query.id) ?? {
          ...query,
          returnedRecordIds: [],
        };
      });
    const contextLeadProposals = contextRecords.map((record) => record.value);
    const retainedContextRecords = contextRecords.filter(
      (record) => screen02ContextLeadLane(record) === "other",
    );
    const expandedLeadProposals = retainedContextRecords.map(
      (record) => record.value,
    );
    const expandedLeadBindings: Screen02OfficialProposalBinding[] =
      retainedContextRecords.map((record) => ({
        proposalId: record.value.id,
        queryId: record.queryId,
        returnedRecordIds: [record.recordId],
        sourceIds: record.value.sources.map((source) => source.id),
      }));
    const contextLeads = contextLeadProposals
      .map(contextLeadFromProposal)
      .filter((lead): lead is Screen02ContextLead => lead !== null)
      .filter(
        (lead, index, values) =>
          values.findIndex((candidate) => candidate.locator === lead.locator) ===
          index,
      )
      .slice(0, 5);
    const contextBridges: Screen02ContextOfficialBridgeProvenance[] =
      officialBridge && bridgeQuery
        ? [{
            schemaVersion:
              SCREEN_02_CONTEXT_OFFICIAL_BRIDGE_SCHEMA_VERSION,
            contextualLeadId: officialBridge.leadId,
            bridgeQueryId: bridgeQuery.id,
            formalIdentifier: officialBridge.formalIdentifier,
            returnedOfficialRecordIds: exactReturnedRecordIds,
            status:
              officialBridge.result.diagnostics.failureKind !== "none"
                ? "failed"
                : exactReturnedRecordIds.length === 1
                  ? "corroborated"
                  : "no-corroboration",
          }]
        : [];
    return {
      ...baseline,
      // Downstream selection treats the released result as an immutable
      // prefix and may append qualified expansion only into spare slots.
      results: baseline.results,
      ...(expandedResults.length > 0 ? { expandedResults } : {}),
      ...(expandedLeadProposals.length > 0
        ? { expandedLeadProposals }
        : {}),
      ...(expandedLeadBindings.length > 0
        ? { expandedLeadBindings }
        : {}),
      ...(contextLeads.length > 0 ? { contextLeads } : {}),
      ...(contextBridges.length > 0 ? { contextBridges } : {}),
      expansionManifest,
    };
  } catch (error) {
    expansionCompletedAt = monotonicNow();
    status = "baseline-fallback";
    return {
      ...baseline,
      expansionManifest: {
        queryMatrix: [],
        channels: [{
          channel: `Screen 2 guarded expansion · ${SCREEN_02_SEARCH_EXPANSION_VERSION}`,
          status: "failed",
          note: `A guarded expansion attempt failed and the immutable baseline was preserved: ${
            error instanceof Error
              ? error.message.replace(/\s+/gu, " ").trim().slice(0, 400)
              : "unknown bounded failure"
          }. No attempted expansion query is reported as successful.`,
          retrievedAt,
        }],
      },
    };
  } finally {
    console.log(
      JSON.stringify(
        screen02ExpansionTelemetryRecord({
          mode,
          workflowMode,
          status,
          baseline,
          comparison,
          contextProviderStatus,
          baselineDurationMs: Math.max(
            0,
            Math.round(baselineCompletedAt - discoveryStartedAt),
          ),
          expansionDurationMs: Math.max(
            0,
            Math.round(expansionCompletedAt - baselineCompletedAt),
          ),
          totalDurationMs: Math.max(
            0,
            Math.round(monotonicNow() - discoveryStartedAt),
          ),
        }),
      ),
    );
  }
}

const SCREEN_02_RESEARCHER_URL_MAX_BYTES = 300_000;
const SCREEN_02_RESEARCHER_URL_TIMEOUT_MS = 8_000;

function normalizedAuditIdentityText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKD")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function screen02TitleWithoutSelfInitialism(value: string | null | undefined) {
  let title = (value ?? "").replace(/\s+/gu, " ").trim();
  title = title.replace(/\s*\(([A-Z][A-Z0-9.-]{1,15})\)/gu,
    (whole, initialism: string, offset: number) => {
      const prefix = title.slice(0, offset);
      const initials = normalizedAuditIdentityText(prefix)
        .split(" ")
        .filter((term) => term.length > 0 &&
          !["a", "an", "and", "for", "of", "the", "to"].includes(term))
        .map((term) => term[0])
        .join("");
      return initials && initials === normalizedAuditIdentityText(initialism)
        .replace(/\s+/gu, "")
        ? ""
        : whole;
    });
  return title.replace(/\s+/gu, " ").trim();
}

function normalizedAuditTitleIdentity(value: string | null | undefined) {
  return normalizedAuditIdentityText(screen02TitleWithoutSelfInitialism(value));
}

function screen02EquivalentTitle(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  const normalizedLeft = normalizedAuditTitleIdentity(left);
  const normalizedRight = normalizedAuditTitleIdentity(right);
  return Boolean(normalizedLeft && normalizedRight &&
    normalizedLeft === normalizedRight);
}

function normalizedAuditFormalIdentifier(value: string | null | undefined) {
  return canonicalScreen02FormalIdentifier(value) ?? "";
}

function screen02FormalIdentifiersCompatible(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  const normalizedLeft = normalizedAuditFormalIdentifier(left);
  const normalizedRight = normalizedAuditFormalIdentifier(right);
  if (!normalizedLeft || !normalizedRight) return false;
  const relation = compareScreen02FormalIdentifiers(left, right);
  return relation === "equivalent" || relation === "compatible-partial";
}

function screen02FormalIdentifiersEquivalent(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  return compareScreen02FormalIdentifiers(left, right) === "equivalent";
}

function structuredAuditRelationship(
  title: string,
  formalIdentifier: string | null | undefined,
  fields: Screen02AuditState["anchor"]["revisions"][number]["fields"],
  issuer?: string | null,
  jurisdiction?: string | null,
) {
  const actualTitle = normalizedAuditIdentityText(title);
  const shock = normalizedAuditIdentityText(fields.shockName);
  const feature = normalizedAuditIdentityText(fields.distinguishingFeature);
  const actualId = normalizedAuditFormalIdentifier(formalIdentifier);
  if (feature && formalIdentifier) {
    const requestedId = screen02OfficialFormalIdentifier(fields.distinguishingFeature ?? "");
    if (requestedId && !screen02FormalIdentifiersCompatible(
      requestedId,
      formalIdentifier,
    )) return "uncertain" as const;
  }
  const conflicting = [[issuer, fields.issuingAuthority], [jurisdiction, fields.jurisdiction]].some(([actual, requested]) => {
    const left = normalizedAuditIdentityText(actual);
    const right = normalizedAuditIdentityText(requested);
    return left && right && !(` ${left} `.includes(` ${right} `) || ` ${right} `.includes(` ${left} `));
  });
  if (conflicting) return "uncertain" as const;
  if (screen02EquivalentTitle(title, fields.shockName) ||
    (feature.length >= 8 && screen02EquivalentTitle(
      fields.distinguishingFeature,
      title,
    )) ||
    (actualId && feature && screen02FormalIdentifiersCompatible(
      fields.distinguishingFeature,
      formalIdentifier,
    ))) return "exact" as const;
  return actualTitle.includes(shock) || shock.includes(actualTitle)
    ? "supported-alias" as const : "uncertain" as const;
}

function screen02PrimaryIdentityHeadingHtml(primary: string) {
  let filtered = primary;
  const chrome = /<(?:aside|nav|footer)\b[^>]*>/iu;
  for (let removed = 0; removed < 64; removed += 1) {
    const opening = chrome.exec(filtered);
    if (!opening) return filtered;
    const element = officialDocumentElementHtml(filtered, chrome);
    if (!element) return filtered.slice(0, opening.index);
    filtered = filtered.slice(0, opening.index) + " " +
      filtered.slice(opening.index + element.length);
  }
  const remaining = chrome.exec(filtered);
  return remaining ? filtered.slice(0, remaining.index) : filtered;
}

function researcherOfficialContentTitle(body: string) {
  const primary = screen02PrimaryOverviewHtml(body);
  const identityPrimary = screen02PrimaryIdentityHeadingHtml(primary);
  const documentHead = officialDocumentElementHtml(
    body,
    /<head\b[^>]*>/iu,
  );
  // Source-own identity candidates are bounded to the primary content and the
  // document title. Sidebar and other page-chrome headings cannot manufacture
  // a competing official identity.
  const candidates = [...new Map([
    ...screen02VisibleOverviewHeadings(identityPrimary),
    ...(documentHead ? screen02VisibleOverviewHeadings(documentHead) : []),
  ]
    .map((title) => title.replace(/\s+/gu, " ").trim().slice(0, 500))
    .filter((title) => title.length >= 4)
    .map((title) => [normalizedAuditIdentityText(title), title])).values()];
  const selected = screen02OfficialContentTitle(identityPrimary, true) ??
    candidates[0] ?? "";
  const selectedSegments = new Set(screen02OfficialTitleSegments(selected)
    .map(normalizedAuditTitleIdentity));
  const selectedFormalIdentifiers = new Set(
    screen02OfficialFormalIdentifiers(selected).map(
      normalizedAuditFormalIdentifier,
    ),
  );
  const generic = new Set([
    "action", "agency", "dates", "document", "official document",
    "official publications", "regulation", "rule", "summary",
  ]);
  const identityCandidates = candidates.filter((candidate) =>
    SCREEN02_OFFICIAL_LEGAL_INSTRUMENT.test(candidate) ||
    screen02OfficialFormalIdentifiers(candidate).length > 0 ||
    /\b(?:cyclone|earthquake|eruption|flood|hurricane|storm|typhoon|wildfire)\b/iu
      .test(candidate)
  );
  const competingTitle = identityCandidates.some((candidate) => {
    const normalized = normalizedAuditTitleIdentity(candidate);
    if (!normalized || generic.has(normalized) ||
      screen02EquivalentTitle(candidate, selected)) return false;
    const candidateIdentifiers = screen02OfficialFormalIdentifiers(candidate);
    if (candidateIdentifiers.some((candidateIdentifier) =>
      [...selectedFormalIdentifiers].some((selectedIdentifier) =>
        screen02FormalIdentifiersCompatible(
          selectedIdentifier,
          candidateIdentifier,
        )
      )
    )) return false;
    const candidateSegments = screen02OfficialTitleSegments(candidate)
      .map(normalizedAuditTitleIdentity);
    return !candidateSegments.some((segment) => selectedSegments.has(segment));
  });
  const formalIdentifiers = identityCandidates.flatMap((candidate) =>
    screen02OfficialFormalIdentifiers(candidate)
  );
  const formalConflict = formalIdentifiers.some((identifier, index) =>
    formalIdentifiers.slice(index + 1).some((other) =>
      !screen02FormalIdentifiersCompatible(identifier, other)
    )
  );
  return {
    title: selected,
    ambiguous: competingTitle || formalConflict,
  };
}

function normalizedAuditLocator(value: string) {
  try {
    const locator = new URL(value);
    locator.hash = "";
    return locator.toString().replace(/\/+$/, "").toLocaleLowerCase("en-US");
  } catch {
    return value.trim().replace(/\/+$/, "").toLocaleLowerCase("en-US");
  }
}

function researcherUrlAuthority(_locator: string) {
  // A URL's domain does not change its researcher-supplied provenance.
  // Independently retrieved official connector sources retain their own tier.
  return { authorityTier: 6 as const, channel: "researcher-provided-url" };
}

function reviewedAuditMergeTarget(
  reviewed: Screen02AuditDiscoveryResult,
  fetched: Extract<ResearcherUrlFetchResult, { ok: true }>,
) {
  const sameLocatorSource = reviewed.sources.find(
    (source) =>
      normalizedAuditLocator(source.locator) ===
      normalizedAuditLocator(fetched.locator),
  );
  if (sameLocatorSource) {
    const sameLocatorMatch = reviewed.matches.find((match) =>
      match.sourceIds.includes(sameLocatorSource.id),
    );
    if (sameLocatorMatch) return sameLocatorMatch;
  }
  const title = ` ${normalizedAuditTitleIdentity(fetched.title)} `;
  return (
    reviewed.matches.find((match) => {
      if (!["exact", "supported-alias"].includes(match.relationship)) {
        return false;
      }
      return [
        match.identity.canonicalTitle,
        match.identity.formalIdentifier,
        ...match.identity.commonNames,
      ].some((name) => {
        if (screen02EquivalentTitle(fetched.title, name)) return true;
        const normalized = normalizedAuditTitleIdentity(name);
        return normalized.length >= 4 && title.includes(` ${normalized} `);
      });
    }) ?? null
  );
}

function publicResearcherUrl(value: string | null) {
  if (!value || value.length > 2_048) return null;
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLocaleLowerCase("en-US");
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.port ||
      !screen02LexicallyPublicHostname(hostname)
    ) {
      return null;
    }
    parsed.hash = "";
    const normalized = parsed.toString();
    return normalized.length <= 2_048 ? normalized : null;
  } catch {
    return null;
  }
}

function decodeBoundedHtmlText(value: string, maximum: number) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum)
    .trim();
}

function researcherResponseTitle(response: Response) {
  const disposition = response.headers.get("content-disposition")?.slice(0, 1_024);
  if (!disposition) return "";
  const encoded = disposition.match(
    /(?:^|;)\s*filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i,
  );
  const plain = disposition.match(
    /(?:^|;)\s*filename\s*=\s*(?:"([^"]+)"|([^;]+))/i,
  );
  let filename = (encoded?.[1] ?? plain?.[1] ?? plain?.[2] ?? "")
    .trim()
    .replace(/^"|"$/g, "");
  try {
    filename = decodeURIComponent(filename);
  } catch {
    // Keep the bounded literal filename when extended decoding is malformed.
  }
  filename = (filename.split(/[\\/]/).at(-1) ?? "")
    .replace(/\.(?:pdf|txt|html?|xhtml)$/i, "")
    .replace(/[-_]+/g, " ");
  return decodeBoundedHtmlText(filename, 240);
}

function researcherPageTitle(
  body: string,
  locator: URL,
  responseTitle = "",
) {
  const fromPage = screen02OfficialContentTitle(body)?.slice(0, 240) ??
    screen02VisibleOverviewTitles(body)[0]?.slice(0, 240) ?? "";
  if (fromPage) return fromPage;
  if (responseTitle) return responseTitle;
  const pathPart = locator.pathname.split("/").filter(Boolean).at(-1) ?? "";
  const fromPath = decodeBoundedHtmlText(
    decodeURIComponent(pathPart).replace(/[-_]+/g, " "),
    240,
  );
  return fromPath || locator.hostname;
}

function publishedDateFromResponse(response: Response) {
  const value = response.headers.get("last-modified");
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? null
    : parsed.toISOString().slice(0, 10);
}

type ResearcherUrlFetchResult =
  | {
      ok: true;
      locator: string;
      title: string;
      publisher: string;
      publishedDate: string | null;
      evidenceText: string | null;
      formalIdentifier?: string | null;
      nativeIdentityConflict?: boolean;
    }
  | { ok: false; locator: string; reason: string };

export async function fetchResearcherAuditUrl(
  env: ShockAuditEnv,
  sourceLocator: string,
): Promise<ResearcherUrlFetchResult> {
  const safeLocator = publicResearcherUrl(sourceLocator);
  const diagnosticLocator = sanitizeScreen02AcquisitionUrl(
    safeLocator ?? sourceLocator,
  ) ?? "Rejected unsafe researcher URL";
  if (!safeLocator) {
    return {
      ok: false,
      locator: diagnosticLocator,
      reason:
        "The researcher URL was not fetched because it must be a public HTTPS URL without credentials, a custom port, or a private/local host.",
    };
  }
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    SCREEN_02_RESEARCHER_URL_TIMEOUT_MS,
  );
  try {
    const fetchImpl = screen02DocumentFetch(env);
    const response = await fetchImpl(safeLocator, {
      method: "GET",
      headers: {
        accept: "text/html, text/plain;q=0.9, application/pdf;q=0.5",
      },
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
    });
    if (response.redirected) {
      await response.body?.cancel("Automatic redirects are forbidden")
        .catch(() => undefined);
      return {
        ok: false,
        locator: diagnosticLocator,
        reason:
          "The researcher URL transport auto-followed a redirect; the response was rejected before parsing.",
      };
    }
    if (!response.ok) {
      await response.body?.cancel("Non-success researcher response")
        .catch(() => undefined);
      return {
        ok: false,
        locator: diagnosticLocator,
        reason: `The researcher URL returned HTTP ${response.status}; redirects are not followed automatically.`,
      };
    }
    const contentType = (response.headers.get("content-type") ?? "")
      .toLocaleLowerCase("en-US");
    const mediaType = contentType.split(";", 1)[0]?.trim() ?? "";
    if (
      !["text/html", "text/plain", "application/xhtml+xml", "application/pdf"]
        .includes(mediaType)
    ) {
      await response.body?.cancel("Unsupported researcher media type")
        .catch(() => undefined);
      return {
        ok: false,
        locator: diagnosticLocator,
        reason: "The researcher URL returned an unsupported content type.",
      };
    }
    const isOfficialText = Boolean(screen02OfficialOverviewUrl(safeLocator)) &&
      mediaType !== "application/pdf";
    let body: string;
    try {
      body = await readScreen02OverviewResponseText(response,
        isOfficialText ? SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_BYTES : SCREEN_02_RESEARCHER_URL_MAX_BYTES,
        { receivedBytes: 0 });
    } catch (error) {
      if (error instanceof Error && /byte limit/u.test(error.message)) {
        return { ok: false, locator: diagnosticLocator,
          reason: "The researcher URL exceeded the bounded response-size limit." };
      }
      throw error;
    }
    const parsed = new URL(safeLocator);
    const isPdf = mediaType === "application/pdf";
    const responseTitle = researcherResponseTitle(response);
    const nativeIdentity = isOfficialText
      ? screen02NativeOverviewIdentity(body, safeLocator) : undefined;
    const contentIdentity = isOfficialText ? researcherOfficialContentTitle(body) : undefined;
    const metadata = screen02OverviewMetadata(body);
    const nativeIdentityConflict = Boolean(!nativeIdentity && (
      contentIdentity?.ambiguous ||
      (new URL(safeLocator).hostname === "eur-lex.europa.eu" &&
        metadata.some((item) =>
          item.name?.toLowerCase() === "wt.z_docid" ||
          item.property?.toLowerCase() === "eli:title"
        )) ||
      (screen02UkLegislationLocatorId(safeLocator) &&
        metadata.some((item) => ["dc.title", "legislation.year"].includes(
          item.name?.toLocaleLowerCase("en-US") ?? "",
        )))
    ));
    const title = nativeIdentity?.title ?? (contentIdentity?.title || researcherPageTitle(isPdf ? "" : body, parsed, responseTitle));
    const evidenceText = isPdf ? null : isOfficialText
      ? screen02OfficialEvidenceText(body) || null
      : decodeBoundedHtmlText(body, 12_000) || null;
    return {
      ok: true,
      locator: diagnosticLocator,
      title,
      formalIdentifier: nativeIdentityConflict ? null : nativeIdentity?.formalIdentifier ?? (isOfficialText ? screen02OfficialFormalIdentifier(title) : null),
      ...(nativeIdentityConflict ? { nativeIdentityConflict: true } : {}),
      publisher: parsed.hostname,
      publishedDate: publishedDateFromResponse(response),
      evidenceText,
    };
  } catch (error) {
    return {
      ok: false,
      locator: diagnosticLocator,
      reason:
        error instanceof Error && error.name === "AbortError"
          ? `The researcher URL timed out after ${SCREEN_02_RESEARCHER_URL_TIMEOUT_MS} ms.`
          : `The researcher URL could not be retrieved: ${
              sanitizeScreen02AcquisitionFailureReason(
                error instanceof Error ? error.message : "unknown failure",
              )
            }`,
    };
  } finally {
    clearTimeout(timer);
  }
}

function auditEventType(
  state: Screen02AuditState,
  versionType: Screen02AuditState["anchor"]["revisions"][number]["fields"]["versionType"],
) {
  const labels = {
    original: state.screen01Baseline.scopeContract.eventFamily,
    amendment: "amendment",
    "implementing-rule": "implementing rule",
    "enforcement-action": "enforcement action",
    unspecified: state.screen01Baseline.scopeContract.eventFamily,
  } as const;
  return labels[versionType] || "event";
}

function auditOfficialContext(state: Screen02AuditState) {
  const anchor = state.anchor.revisions.find(
    (revision) => revision.anchorRevisionId === state.anchor.activeRevisionId,
  )!;
  const yearMatch = anchor.fields.approximateYear?.match(/\b(?:19|20)\d{2}\b/);
  const year = yearMatch ? Number(yearMatch[0]) : null;
  const currentYear = new Date().getUTCFullYear();
  const studyPeriod = year
    ? `${Math.max(1900, year - 3)}–${Math.min(currentYear, year + 3)}`
    : `1900–${currentYear}`;
  const knownShock = [
    anchor.fields.shockName,
    anchor.fields.distinguishingFeature,
    anchor.fields.clarification,
  ]
    .filter(Boolean)
    .join(" ");
  return {
    screen01Baseline: {
      ...state.screen01Baseline,
      knownShock,
      scopeContract: {
        ...state.screen01Baseline.scopeContract,
        // Audit retrieval routes on the separately supplied possible issuer
        // fields below. Neither the study geography nor an unresolved state
        // issuer may be collapsed into a federal issuing jurisdiction.
        geography: "Worldwide",
        industry: "",
        studyPeriod,
      },
    },
  } as unknown as Screen02Session;
}

function workflowSourceFromAuditProposal(
  proposal: Screen02FindProposal,
  source: Screen02FindProposal["sources"][number],
  retrievedAt: string,
): Screen02WorkflowSource {
  const evidenceText = `${proposal.title}. ${proposal.description}`
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12_000);
  const base = {
    id: source.id,
    title: source.title,
    locator: source.locator,
    publisher: source.publisher,
    publishedDate: source.publishedDate ?? null,
    authorityTier: source.authorityTier,
    channel: source.channel,
    retrievedAt: source.retrievedAt ?? retrievedAt,
    userProvided: false,
    ...(evidenceText ? { evidenceText } : {}),
  } satisfies Omit<Screen02WorkflowSource, "sourceFingerprint">;
  return {
    ...base,
    sourceFingerprint: fingerprintScreen02WorkflowValue(base),
  };
}

async function discoverCanonicalScreen02Audit(
  env: ShockAuditEnv,
  state: Screen02AuditState,
  input: {
    matchSetSnapshotId: string;
    at: string;
    exactRequest: string;
    maximumMatches: number;
  },
): Promise<Screen02AuditDiscoveryResult> {
  const anchor = state.anchor.revisions.find(
    (revision) => revision.anchorRevisionId === state.anchor.activeRevisionId,
  )!;
  const reviewed = buildReviewedScreen02AuditDiscovery(state, input);
  const reviewedBinding = reviewed.manifest.retainedResultBinding;
  if (!reviewedBinding || reviewedBinding.mode !== "audit") {
    throw new Error(
      "Canonical Audit discovery requires reviewed producer origins.",
    );
  }
  const reviewedOriginsBySnapshotId: Screen02RetainedOriginMap = new Map(
    reviewedBinding.results.map((result) => [
      result.snapshotId,
      [...result.origins],
    ]),
  );
  let reviewedMatches = reviewed.matches.map((match) => ({
    ...match,
    sourceIds: [...match.sourceIds],
    limitations: [...match.limitations],
  }));
  const officialSession = auditOfficialContext(state);
  const official = await officialDiscovery(
    env,
    officialSession,
    [],
    input.at,
    Math.min(20, Math.max(input.maximumMatches, 8)),
    {
      auditIdentity: {
        canonicalName: anchor.fields.shockName,
        issuer: anchor.fields.issuingAuthority,
        issuingJurisdiction: anchor.fields.jurisdiction,
      },
    },
  );
  // Contextual expansion records are manifest-only in Audit. They cannot
  // become identity matches or enter the researcher confirmation path.
  const officialProposals = official.results
    .flatMap((result) => result.proposals)
    .filter(
      (proposal): proposal is Screen02FindProposal => proposal.mode === "find",
    );
  const expandedOfficialProposals = (official.expandedResults ?? [])
    .flatMap((result) => result.proposals)
    .filter(
      (proposal): proposal is Screen02FindProposal => proposal.mode === "find",
    );
  const officialOrigins = screen02ConnectorRetainedOrigins(
    official.results,
    () => "official-baseline",
  );
  const allBridgeQueryIds = new Set(
    (official.contextBridges ?? []).map((bridge) => bridge.bridgeQueryId),
  );
  const corroboratedBridgeQueryIds = new Set(
    (official.contextBridges ?? [])
      .filter((bridge) => bridge.status === "corroborated")
      .map((bridge) => bridge.bridgeQueryId),
  );
  const expandedOfficialOrigins = screen02ConnectorRetainedOrigins(
    official.expandedResults ?? [],
    (_result, binding) =>
      allBridgeQueryIds.has(binding.queryId)
        ? corroboratedBridgeQueryIds.has(binding.queryId)
          ? "context-official-bridge"
          : null
        : "official-expansion",
  );
  const exactProposalIds = new Map<string, Screen02FindProposal>();
  for (const proposal of officialProposals) {
    const prior = exactProposalIds.get(proposal.id);
    exactProposalIds.set(
      proposal.id,
      prior ? mergeScreen02ExactIdProposalSources(prior, proposal) : proposal,
    );
  }
  const officialRankingContext = {
    ...officialSession.screen01Baseline,
    startingPoint: "find",
    knownShock: "",
    studySentence:
      `${officialSession.screen01Baseline.studySentence} ${anchor.fields.shockName}`.trim(),
  } as unknown as Screen01StudyContext;
  const rankedOfficial = rankScreen02ProposalsBm25(
    [...exactProposalIds.values()],
    officialRankingContext,
    { require: [], prefer: [anchor.fields.shockName], avoid: [] },
  ).map((entry) => entry.proposal as Screen02FindProposal);
  const reviewedTitles = new Set(
    reviewedMatches.flatMap((match) => [
      normalizedAuditIdentityText(match.identity.canonicalTitle),
      ...match.identity.commonNames.map(normalizedAuditIdentityText),
    ]),
  );
  const expandedProposalIds = new Map<string, Screen02FindProposal>();
  for (const proposal of expandedOfficialProposals) {
    const prior = expandedProposalIds.get(proposal.id);
    expandedProposalIds.set(
      proposal.id,
      prior ? mergeScreen02ExactIdProposalSources(prior, proposal) : proposal,
    );
  }
  const protectedOfficialTitles = new Set([
    ...reviewedTitles,
    ...rankedOfficial.map((proposal) =>
      normalizedAuditIdentityText(proposal.title)
    ),
  ]);
  const rankedExpandedOfficial = rankScreen02ProposalsBm25(
    [...expandedProposalIds.values()].filter(
      (proposal) =>
        !protectedOfficialTitles.has(
          normalizedAuditIdentityText(proposal.title),
        ),
    ),
    officialRankingContext,
    { require: [], prefer: [anchor.fields.shockName], avoid: [] },
  ).map((entry) => entry.proposal as Screen02FindProposal);
  const toOfficialMatch = (
    proposal: Screen02FindProposal,
    index: number,
    lane: "official" | "expanded-official",
  ) => {
    const sourceIds = proposal.sources.map((source) => source.id);
    const title = normalizedAuditIdentityText(proposal.title);
    const shock = normalizedAuditIdentityText(anchor.fields.shockName);
    const formalIdentifier = proposal.nativeIdentity?.formalIdentifier ??
      (proposal.event.displayName !== proposal.title ? proposal.event.displayName : screen02OfficialFormalIdentifier(proposal.title));
    const relationship = structuredAuditRelationship(proposal.title, formalIdentifier, anchor.fields, proposal.nativeIdentity?.issuer ?? proposal.sources[0]?.publisher, proposal.nativeIdentity?.issuingJurisdiction ?? proposal.event.geographies[0]);
    const match = {
      matchId: `${input.matchSetSnapshotId}:${lane}:${index + 1}`,
      matchSnapshotId: `${input.matchSetSnapshotId}:${lane}:${index + 1}:match`,
      identitySnapshotId: `${input.matchSetSnapshotId}:${lane}:${index + 1}:identity`,
      identity: {
        canonicalTitle: proposal.title,
        commonNames:
          relationship === "supported-alias" && title !== shock
            ? [anchor.fields.shockName]
            : [],
        formalIdentifier,
        issuer: proposal.sources[0]?.publisher ?? anchor.fields.issuingAuthority,
        issuingJurisdiction:
          proposal.event.geographies[0] ?? anchor.fields.jurisdiction,
        eventType: proposal.event.eventFamily,
        status: null,
      },
      relationship,
      relationshipReason:
        relationship === "uncertain"
          ? "The official connector returned this record for the exact anchor query, but the title does not yet establish that it is the intended identity."
          : "The official connector title or identifier matches the structured named-shock anchor.",
      sourceIds,
      limitations: [
        "Connector metadata is an identity lead; the researcher must inspect the match-specific dossier before confirmation.",
      ],
    };
    const originsByProposalId = lane === "official"
      ? officialOrigins
      : expandedOfficialOrigins;
    return {
      match,
      origins: requireExactScreen02RetainedOrigins(
        proposal.id,
        sourceIds,
        originsByProposalId.get(proposal.id) ?? [],
      ),
    };
  };
  const officialEntries = rankedOfficial
    .filter(
      (proposal) =>
        !reviewedTitles.has(normalizedAuditIdentityText(proposal.title)),
    )
    .map((proposal, index) => toOfficialMatch(proposal, index, "official"));
  const expandedOfficialEntries = rankedExpandedOfficial.map(
    (proposal, index) =>
      toOfficialMatch(proposal, index, "expanded-official"),
  );
  const officialSourcesById = new Map<string, Screen02WorkflowSource>();
  for (const proposal of [...rankedOfficial, ...rankedExpandedOfficial]) {
    for (const source of proposal.sources) {
      if (!officialSourcesById.has(source.id)) {
        officialSourcesById.set(
          source.id,
          workflowSourceFromAuditProposal(proposal, source, input.at),
        );
      }
    }
  }

  let researcherMatch: Screen02AuditDiscoveryResult["matches"][number] | null = null;
  let researcherOrigins: Screen02RetainedResultOrigin[] = [];
  let researcherSource: Screen02WorkflowSource | null = null;
  let researcherChannel: Screen02WorkflowSearchManifest["channels"][number] | null = null;
  let researcherQuery: Screen02WorkflowSearchManifest["queryMatrix"][number] | null = null;
  let researcherExclusion: Screen02WorkflowSearchManifest["exclusions"][number] | null = null;
  if (anchor.fields.sourceLocator) {
    const fetched = await fetchResearcherAuditUrl(env, anchor.fields.sourceLocator);
    if (fetched.ok) {
      const authority = researcherUrlAuthority(fetched.locator);
      const sourceBase = {
        id: `${input.matchSetSnapshotId}:researcher-url-source`,
        title: fetched.title,
        locator: fetched.locator,
        publisher: fetched.publisher,
        publishedDate: fetched.publishedDate,
        authorityTier: authority.authorityTier,
        channel: authority.channel,
        retrievedAt: input.at,
        userProvided: true,
        ...(fetched.evidenceText ? { evidenceText: fetched.evidenceText } : {}),
      } satisfies Omit<Screen02WorkflowSource, "sourceFingerprint">;
      researcherSource = {
        ...sourceBase,
        sourceFingerprint: fingerprintScreen02WorkflowValue(sourceBase),
      };
      const mergeTarget = fetched.nativeIdentityConflict ? null : reviewedAuditMergeTarget(reviewed, fetched);
      const relationship = fetched.nativeIdentityConflict ? "uncertain" as const
        : structuredAuditRelationship(fetched.title, fetched.formalIdentifier, anchor.fields);
      if (mergeTarget) {
        reviewedMatches = reviewedMatches.map((match) =>
          match.matchSnapshotId === mergeTarget.matchSnapshotId
            ? {
                ...match,
                sourceIds: [...new Set([...match.sourceIds, researcherSource!.id])],
                relationshipReason: `${match.relationshipReason} The researcher-provided official page was inspected and attached to this same identity rather than creating a duplicate match.`,
              }
            : match,
        );
        appendScreen02RetainedOrigin(
          reviewedOriginsBySnapshotId,
          mergeTarget.matchSnapshotId,
          {
            kind: "query-result",
            retrievalLane: "researcher-url",
            evidenceRole: "support",
            producerRecordId: researcherSource.id,
            queryId: `${input.matchSetSnapshotId}:researcher-url-query`,
            returnedRecordIds: [researcherSource.id],
            sourceIds: [researcherSource.id],
          },
        );
      } else {
        researcherMatch = {
          matchId: `${input.matchSetSnapshotId}:researcher-url`,
          matchSnapshotId: `${input.matchSetSnapshotId}:researcher-url:match`,
          identitySnapshotId: `${input.matchSetSnapshotId}:researcher-url:identity`,
          identity: {
            canonicalTitle: fetched.title,
            commonNames:
              relationship === "supported-alias"
                ? [anchor.fields.shockName]
                : [],
            formalIdentifier: fetched.formalIdentifier ?? null,
            issuer: anchor.fields.issuingAuthority ?? fetched.publisher,
            issuingJurisdiction: anchor.fields.jurisdiction,
            eventType: auditEventType(state, anchor.fields.versionType),
            status: null,
          },
          relationship,
          relationshipReason:
            relationship === "uncertain"
              ? "The supplied page title does not clearly match the named anchor; keep this visible so the researcher can reject it or revise the URL."
              : "The supplied page title directly matches or contains the named-shock anchor.",
          sourceIds: [researcherSource.id],
          limitations: [
            authority.authorityTier === 6
              ? "The researcher-supplied page remains provisional until its authority and contents are independently verified."
              : "The supplied government page supports identity, but exact operative dates and organization-level coverage still need verification.",
            fetched.evidenceText
              ? "Open the page and confirm the provisions relevant to this study before treatment coding."
              : "No document text was extracted. Confirm the document contents before using this event.",
          ],
        };
        researcherOrigins = [{
          kind: "query-result",
          retrievalLane: "researcher-url",
          evidenceRole: "identity",
          producerRecordId: researcherSource.id,
          queryId: `${input.matchSetSnapshotId}:researcher-url-query`,
          returnedRecordIds: [researcherSource.id],
          sourceIds: [researcherSource.id],
        }];
      }
      researcherChannel = {
        channel: "researcher-provided-url",
        status: "searched",
        note: mergeTarget
          ? "Fetched the official page and attached it to the matching reviewed identity; no duplicate match was created."
          : fetched.evidenceText
            ? "Fetched one bounded public HTTPS page and retained its title and bounded visible text for identity review."
            : "Fetched one bounded public HTTPS document and retained response-derived identity metadata; no document text was extracted.",
        retrievedAt: input.at,
      };
      researcherQuery = {
        id: `${input.matchSetSnapshotId}:researcher-url-query`,
        query: fetched.locator,
        purpose:
          "Inspect the exact researcher-provided URL as an identity lead without applying study-fit exclusions.",
        returnedRecordIds: [researcherSource.id],
      };
    } else {
      researcherChannel = {
        channel: "researcher-provided-url",
        status: "failed",
        note: fetched.reason,
        retrievedAt: input.at,
      };
      researcherQuery = {
        id: `${input.matchSetSnapshotId}:researcher-url-query`,
        query: fetched.locator.slice(0, 2_048),
        purpose:
          "Attempt to inspect the exact researcher-provided URL as an identity lead.",
        returnedRecordIds: [],
      };
      researcherExclusion = {
        recordId: `${input.matchSetSnapshotId}:researcher-url`,
        reason: fetched.reason,
      };
    }
  }

  const supplemental = connectorManifest(
    official,
    {
      queryMatrix: reviewed.manifest.queryMatrix.map((query) => ({
        id: query.id,
        query: query.query,
        purpose: query.purpose,
        returnedRecordIds: [...query.returnedRecordIds],
      })),
      channels: reviewed.manifest.channels.map((channel) => ({
        channel: channel.channel,
        status: channel.status,
        note: channel.note,
        ...(channel.retrievedAt ? { retrievedAt: channel.retrievedAt } : {}),
      })),
    },
    "audit",
  );
  const retainedEntries = [
    ...(researcherMatch
      ? [{
          match: researcherMatch,
          origins: requireExactScreen02RetainedOrigins(
            researcherMatch.matchId,
            researcherMatch.sourceIds,
            researcherOrigins,
          ),
        }]
      : []),
    ...reviewedMatches.map((match) => ({
      match,
      origins: requireExactScreen02RetainedOrigins(
        match.matchId,
        match.sourceIds,
        reviewedOriginsBySnapshotId.get(match.matchSnapshotId) ?? [],
      ),
    })),
    ...officialEntries,
    ...expandedOfficialEntries,
  ].slice(0, input.maximumMatches);
  const matches = retainedEntries.map((entry) => entry.match);
  const usedSourceIds = new Set(matches.flatMap((match) => match.sourceIds));
  const sources = [
    ...(researcherSource ? [researcherSource] : []),
    ...reviewed.sources,
    ...officialSourcesById.values(),
  ].filter(
    (source, index, all) =>
      usedSourceIds.has(source.id) &&
      all.findIndex((candidate) => candidate.id === source.id) === index,
  );
  const funnel = buildScreen02SearchFunnel({
    sourceRecordsRetrieved:
      official.funnel.recordsReceived +
      (official.expandedResults ?? []).reduce(
        (sum, result) => sum + result.diagnostics.recordsReceived,
        0,
      ) +
      reviewed.manifest.funnel.sourceRecordsRetrieved +
      (researcherQuery?.returnedRecordIds.length ?? 0),
    uniqueEventLeads: matches.length,
    // Audit resolves identity/version relationships; it deliberately does
    // not run or imply the Find study-fit qualification gates.
    qualifications: [],
    displayedCandidates: 0,
  });
  return {
    matchSetSnapshotId: input.matchSetSnapshotId,
    sources,
    matches,
    manifest: {
      protocolVersion: SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_VERSION,
      exactRequest: input.exactRequest,
      queryMatrix: [
        ...(researcherQuery ? [researcherQuery] : []),
        ...(supplemental.queryMatrix ?? []).map((query) => ({
          id: query.id,
          query: query.query,
          purpose: query.purpose,
          returnedRecordIds: [...(query.returnedRecordIds ?? [])],
        })),
      ],
      channels: [
        ...(researcherChannel ? [researcherChannel] : []),
        ...(supplemental.channels ?? []).map((channel) => ({
          channel: channel.channel,
          status: channel.status,
          note: channel.note,
          retrievedAt: channel.retrievedAt ?? null,
        })),
      ],
      exclusions: [
        ...(researcherExclusion ? [researcherExclusion] : []),
      ],
      funnel,
      retrievalExecution: screen02TypedRetrievalExecution(official, []),
      ...(official.contextLeads?.length
        ? { contextLeads: official.contextLeads }
        : {}),
      ...(official.contextBridges?.length
        ? { contextBridges: official.contextBridges }
        : {}),
      stoppingRule: supplemental.stoppingRule ?? reviewed.manifest.stoppingRule,
      retainedResultBinding: buildScreen02RetainedResultBinding(
        "audit",
        {
          sourceRecordsRetrieved: funnel.sourceRecordsRetrieved,
          uniqueEventLeads: funnel.uniqueEventLeads,
        },
        retainedEntries.map(({ match, origins }) => ({
          recordId: match.matchId,
          snapshotId: match.matchSnapshotId,
          sourceIds: [...match.sourceIds],
          qualificationLane: null,
          origins,
        })),
      ),
      retrievedAt: input.at,
      outcomeValuesInspected: false,
    },
    at: input.at,
  };
}

function canonicalFindPeriodStatus(
  proposal: Screen02FindProposal,
  studyPeriod: string,
) {
  const range = studyDateRange(studyPeriod);
  if (!range) return "review" as const;
  const dates = [proposal.event.eventDate, ...proposal.provisionalDates]
    .filter((value, index, all): value is string =>
      Boolean(value) && all.indexOf(value) === index,
    );
  if (dates.length === 0) return "review" as const;
  if (
    dates.some(
      (date) => date.slice(0, 10) >= range.startDate && date.slice(0, 10) <= range.endDate,
    )
  ) {
    return "pass" as const;
  }
  return "fail" as const;
}

function canonicalFindPreferences(
  state: Screen02FindState,
  exactRequest: string,
): Screen02PreferenceCriterion[] {
  const kind = {
    "only-include": "require",
    "rank-higher": "prefer",
    "do-not-show": "avoid",
  } as const;
  return activeScreen02FindCriteria(state).map((criterion) => ({
    id: criterion.criterionId,
    kind: kind[criterion.kind],
    text: criterion.text,
    source: criterion.source,
    exactRequest,
  }));
}

function canonicalRegistryCandidates(
  state: Screen02FindState,
  studyProfile: Screen02StudyRelevanceProfile,
  proposals: readonly Screen02FindProposal[] =
    REVIEWED_SCREEN02_EVENT_REGISTRY,
  publicIndex = false,
) {
  const family = canonicalEventFamily(
    state.screen01Baseline.scopeContract.eventFamily,
  );
  const researchText = [
    state.screen01Baseline.studySentence,
    state.screen01Baseline.scopeContract.population,
    state.screen01Baseline.scopeContract.industry,
    state.screen01Baseline.scopeContract.eventFamily,
    studyProfile.canonicalIndustryLabel,
    ...studyProfile.industryAliases,
    ...studyProfile.internationalVariants,
    ...studyProfile.subsectors,
    ...studyProfile.products,
    ...studyProfile.services,
    ...studyProfile.industryActors,
    ...studyProfile.regulatedActivities,
    ...studyProfile.businessModels,
    ...studyProfile.distributionChannels,
    ...studyProfile.platformRelationships,
    ...studyProfile.workforceRelationships,
    ...studyProfile.supplyChainRelationships,
    ...studyProfile.customerOrUserRelationships,
    ...studyProfile.regulatorySurfaces,
    ...studyProfile.disruptionSurfaces,
    ...studyProfile.eventFamilyTerms,
  ].join(" ");
  return proposals.filter(
    (proposal) => {
      if (canonicalEventFamily(proposal.event.eventFamily) !== family) {
        return false;
      }
      if (publicIndex) {
        return screen02PublicEventIndexMatchesScope(
          proposal.id,
          state.screen01Baseline.scopeContract.industry,
          state.screen01Baseline.scopeContract.geography,
          [
            studyProfile.canonicalIndustryLabel,
            ...studyProfile.industryAliases,
            ...studyProfile.internationalVariants,
            ...studyProfile.subsectors,
            ...studyProfile.products,
            ...studyProfile.services,
            ...studyProfile.industryActors,
            ...studyProfile.businessModels,
            ...studyProfile.distributionChannels,
            ...studyProfile.platformRelationships,
            ...studyProfile.regulatedActivities,
            ...studyProfile.workforceRelationships,
            ...studyProfile.supplyChainRelationships,
            ...studyProfile.customerOrUserRelationships,
            ...studyProfile.regulatorySurfaces,
            ...studyProfile.disruptionSurfaces,
          ],
          [
            studyProfile.sampleGeography,
            ...studyProfile.geographyAliases,
            ...studyProfile.possibleIssuingJurisdictions,
            ...studyProfile.jurisdictionAliases,
          ],
        ) === true;
      }
      return reviewedScreen02RegistryProposalMatchesResearchText(
        proposal,
        researchText,
      );
    },
  );
}

const SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_CANDIDATES =
  SCREEN02_DISCOVERY_RAW_CANDIDATE_TARGET;
const SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_DOCUMENT_FETCHES = 24;
const SCREEN02_SUBSTANTIVE_ENRICHMENT_CONCURRENCY = 2;
const SCREEN02_SUBSTANTIVE_ENRICHMENT_TIMEOUT_MS = 3_000;
const SCREEN02_SUBSTANTIVE_ENRICHMENT_TOTAL_TIMEOUT_MS = 45_000;
// Legal texts can exceed the API/listing budget. Bound document transport
// separately while keeping the previous 24 × 256 KiB aggregate search budget.
const SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_BYTES = 2 * 1024 * 1024;
const SCREEN02_SUBSTANTIVE_ENRICHMENT_TOTAL_BYTES = 6 * 1024 * 1024;
export type Screen02OverviewByteBudget = { receivedBytes: number };
const SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_REDIRECTS = 3;
const SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_LEVEL2_DOCUMENTS = 2;
const SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_LEVEL3_DOCUMENTS = 2;
const SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_LEVEL4_DOCUMENTS = 1;

export type Screen02SubstantiveEnrichmentRecord = {
  recordId: string;
  locator: string;
  status: "enriched" | "context-only" | "still-insufficient" | "failed";
  levelsAttempted: Array<2 | 3 | 4>;
  enrichedAtLevel: 2 | 3 | null;
  level2SourceIds: string[];
  level3SourceIds: string[];
  note: string;
  /** Server-only cursor marker; omitted from the public manifest. */
  continuationPending?: boolean;
};

function screen02ChangedEnrichmentSourceIds(
  before: readonly Screen02Source[],
  after: readonly Screen02Source[],
) {
  const priorById = new Map(before.map((source) => [source.id, source]));
  return after
    .filter((source) => {
      const prior = priorById.get(source.id);
      return !prior || !sameDeterministicJson(prior, source);
    })
    .map((source) => source.id);
}

function appendScreen02EnrichmentOrigins(
  originsByProposalId: Screen02RetainedOriginMap,
  records: readonly Screen02SubstantiveEnrichmentRecord[],
  searchRoundId: string,
) {
  for (const record of records) {
    if (record.level2SourceIds.length > 0) {
      appendScreen02RetainedOrigin(originsByProposalId, record.recordId, {
        kind: "query-result",
        retrievalLane: "substantive-enrichment",
        evidenceRole: "support",
        producerRecordId: record.recordId,
        queryId:
          `${searchRoundId}:substantive-overview:full-official-document`,
        returnedRecordIds: [record.recordId],
        sourceIds: [...record.level2SourceIds],
      });
    }
    if (record.level3SourceIds.length > 0) {
      appendScreen02RetainedOrigin(originsByProposalId, record.recordId, {
        kind: "query-result",
        retrievalLane: "substantive-enrichment",
        evidenceRole: "support",
        producerRecordId: record.recordId,
        queryId:
          `${searchRoundId}:substantive-overview:official-explanatory-material`,
        returnedRecordIds: [record.recordId],
        sourceIds: [...record.level3SourceIds],
      });
    }
  }
}

function screen02EnrichmentFailureSummary(records: Screen02SubstantiveEnrichmentRecord[]) {
  const failures = new Map<string, number>();
  for (const record of records) {
    if (record.status !== "failed") continue;
    const note = record.note;
    const http = /HTTP (\d{3})/u.exec(note)?.[1];
    const reason = http ? `HTTP ${http}`
      : /time.?out|timed out|abort/iu.test(note) ? "timeout"
      : /byte|size|budget/iu.test(note) ? "bounded retrieval limit"
      : /identity|same record/iu.test(note) ? "source identity unresolved"
      : /content type/iu.test(note) ? "unsupported document type"
      : "document retrieval failed";
    failures.set(reason, (failures.get(reason) ?? 0) + 1);
  }
  return failures.size ? ` Document failures: ${[...failures].map(([reason, count]) => `${reason} (${count})`).join(", ")}.` : "";
}

type Screen02OverviewDocument = {
  locator: string;
  title: string;
  /** Title extracted from the response body, never from the proposed lead. */
  contentTitle: string | null;
  publisher: string;
  publishedDate: string | null;
  overview: string;
  /** Bounded visible response text retained in immutable source provenance. */
  evidenceText: string;
  contentFingerprint: string;
  explanatoryLocators: string[];
  /** Visible FTC-owned links to controlling PDFs; locator metadata only. */
  primaryReferences: Screen02OfficialPrimaryReference[];
  /** Exact source-native record identifier parsed from the response body. */
  sourceRecordIdentifier?: string;
  nativeIdentity?: { recordId: string; title: string; formalIdentifier: string };
  nativeIdentityConflict?: boolean;
  /** Internal binding to the typed transport record; never source evidence. */
  acquisitionId?: string;
};

type Screen02OfficialPrimaryReference = {
  locator: string;
  title: string;
};

type Screen02DocumentSlotWaiter = {
  cancelled: boolean;
  resolve: (release: () => void) => void;
};

export type Screen02SubstantiveEnrichmentRuntime = {
  receivedBytes: number;
  documentsAttempted: number;
  documentCache: Map<string, Promise<Screen02OverviewDocument>>;
  documentAcquisitions: Screen02DocumentAcquisition[];
  activeDocumentRequests: number;
  peakConcurrentDocumentRequests: number;
  documentSlotWaiters: Screen02DocumentSlotWaiter[];
  deadlineStartedAt: number | null;
  deadlineAt: number | null;
  now: () => number;
  /**
   * Stable request keys already reserved by this search. A failed or
   * ambiguous acquisition is deliberately not retried by a later runtime
   * invocation: retry policy belongs to the search-wide journal, not to a
   * fresh isolate-local cache.
   */
  attemptedDocumentKeys: Set<string>;
  /** Keys restored from a prior invocation and therefore never replayable. */
  persistedAttemptedDocumentKeys: Set<string>;
  documentAttemptJournal: Screen02DocumentAttemptJournalEntry[];
  /** Fresh acquisitions admitted by this Worker invocation. */
  invocationDocumentsAttempted: number;
  /** Conservative per-invocation ceiling; the legacy in-process path uses 24. */
  invocationDocumentFetchLimit: number;
  /** Level-2 links that remain eligible in a later invocation. */
  linkedLevel3LocatorsByProposalId: Map<string, string[]>;
};

export type Screen02DocumentAttemptJournalEntry = {
  requestKey: string;
  attempt: number;
  status: "ambiguous" | "succeeded" | "failed";
  acquisitionId: string;
};

export function createScreen02SubstantiveEnrichmentRuntime(
  now: () => number = Date.now,
  input: {
    receivedBytes?: number;
    documentsAttempted?: number;
    documentAcquisitions?: readonly Screen02DocumentAcquisition[];
    attemptedDocumentKeys?: readonly string[];
    documentAttemptJournal?: readonly Screen02DocumentAttemptJournalEntry[];
    deadlineStartedAt?: number | null;
    deadlineAt?: number | null;
    invocationDocumentFetchLimit?: number;
    linkedLevel3Locators?: readonly {
      candidateId: string;
      locators: readonly string[];
    }[];
  } = {},
): Screen02SubstantiveEnrichmentRuntime {
  return {
    receivedBytes: input.receivedBytes ?? 0,
    documentsAttempted: input.documentsAttempted ?? 0,
    documentCache: new Map(),
    documentAcquisitions: [
      ...structuredClone(input.documentAcquisitions ?? []),
    ],
    activeDocumentRequests: 0,
    peakConcurrentDocumentRequests: 0,
    documentSlotWaiters: [],
    deadlineStartedAt: input.deadlineStartedAt ?? null,
    deadlineAt: input.deadlineAt ?? null,
    now,
    attemptedDocumentKeys: new Set(input.attemptedDocumentKeys ?? []),
    persistedAttemptedDocumentKeys: new Set(
      input.attemptedDocumentKeys ?? [],
    ),
    documentAttemptJournal: [
      ...structuredClone(input.documentAttemptJournal ?? []),
    ],
    invocationDocumentsAttempted: 0,
    invocationDocumentFetchLimit: Math.min(
      SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_DOCUMENT_FETCHES,
      Math.max(0, input.invocationDocumentFetchLimit ??
        SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_DOCUMENT_FETCHES),
    ),
    linkedLevel3LocatorsByProposalId: new Map(
      (input.linkedLevel3Locators ?? []).map((entry) => [
        entry.candidateId,
        [...entry.locators],
      ]),
    ),
  };
}

function screen02StartDocumentDeadline(
  runtime: Screen02SubstantiveEnrichmentRuntime,
) {
  if (runtime.deadlineAt === null) {
    runtime.deadlineStartedAt = runtime.now();
    runtime.deadlineAt = runtime.deadlineStartedAt +
      SCREEN02_SUBSTANTIVE_ENRICHMENT_TOTAL_TIMEOUT_MS;
  }
  return runtime.deadlineAt;
}

function screen02DocumentDeadlineRemaining(
  runtime: Screen02SubstantiveEnrichmentRuntime,
) {
  return screen02StartDocumentDeadline(runtime) - runtime.now();
}

function screen02DocumentDeadlineExhausted(
  runtime: Screen02SubstantiveEnrichmentRuntime,
) {
  return runtime.deadlineAt !== null && runtime.now() >= runtime.deadlineAt;
}

function screen02InvocationDocumentBudgetExhausted(
  runtime: Screen02SubstantiveEnrichmentRuntime,
) {
  return runtime.invocationDocumentsAttempted >=
    runtime.invocationDocumentFetchLimit;
}

function screen02ReleaseNextDocumentSlot(
  runtime: Screen02SubstantiveEnrichmentRuntime,
) {
  runtime.activeDocumentRequests = Math.max(
    0,
    runtime.activeDocumentRequests - 1,
  );
  while (runtime.documentSlotWaiters.length > 0) {
    const waiter = runtime.documentSlotWaiters.shift()!;
    if (waiter.cancelled) continue;
    runtime.activeDocumentRequests += 1;
    runtime.peakConcurrentDocumentRequests = Math.max(
      runtime.peakConcurrentDocumentRequests,
      runtime.activeDocumentRequests,
    );
    waiter.resolve(() => screen02ReleaseNextDocumentSlot(runtime));
    break;
  }
}

async function screen02AcquireDocumentSlot(
  runtime: Screen02SubstantiveEnrichmentRuntime,
) {
  const remaining = screen02DocumentDeadlineRemaining(runtime);
  if (remaining <= 0) {
    throw new Error("The shared substantive-document deadline was exhausted.");
  }
  if (
    runtime.activeDocumentRequests <
      SCREEN02_SUBSTANTIVE_ENRICHMENT_CONCURRENCY
  ) {
    runtime.activeDocumentRequests += 1;
    runtime.peakConcurrentDocumentRequests = Math.max(
      runtime.peakConcurrentDocumentRequests,
      runtime.activeDocumentRequests,
    );
    return () => screen02ReleaseNextDocumentSlot(runtime);
  }
  return await new Promise<() => void>((resolve, reject) => {
    const waiter: Screen02DocumentSlotWaiter = { cancelled: false, resolve };
    runtime.documentSlotWaiters.push(waiter);
    const timer = setTimeout(() => {
      waiter.cancelled = true;
      reject(new Error("The shared substantive-document deadline was exhausted while waiting for transport capacity."));
    }, Math.max(1, remaining));
    const originalResolve = waiter.resolve;
    waiter.resolve = (release) => {
      clearTimeout(timer);
      originalResolve(release);
    };
  });
}

async function screen02WithinDocumentDeadline<T>(
  runtime: Screen02SubstantiveEnrichmentRuntime,
  operation: Promise<T>,
  onTimeout?: () => void | Promise<void>,
) {
  const remaining = screen02DocumentDeadlineRemaining(runtime);
  if (remaining <= 0) {
    void onTimeout?.();
    throw new Error("The shared substantive-document deadline was exhausted.");
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      void onTimeout?.();
      reject(new Error("The shared substantive-document deadline was exhausted."));
    }, Math.max(1, remaining));
  });
  try {
    return await Promise.race([operation, deadline]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

type Screen02OverviewFetchTrace = {
  redirectChain: Screen02DocumentRedirectHop[];
  finalUrl: string | null;
  httpStatus: number | null;
  mediaType: "text/html" | "text/plain" | null;
  receivedBytes: number;
  parserPath: Screen02DocumentParserPath;
  parserOutcome: Screen02DocumentParserOutcome;
};

const SCREEN02_OFFICIAL_EXPLANATORY_LINK =
  /\b(?:faq|fact[ -]?sheet|summary|press[ -]?release|news|implementation|guidance|guide|enforcement|compliance|stakeholder|explanation|explainer)\b/i;

const SCREEN02_CONTEXTUAL_OVERVIEW_HOSTS = [
  "reuters.com",
  "apnews.com",
  "brookings.edu",
  "rand.org",
  "americanbar.org",
  "lawfaremedia.org",
  "harvard.edu",
  "stanford.edu",
] as const;

function screen02Ipv4Bytes(value: string) {
  const parts = value.split(".");
  if (
    parts.length !== 4 ||
    parts.some((part) => !/^(?:0|[1-9]\d{0,2})$/u.test(part))
  ) return null;
  const bytes = parts.map(Number);
  return bytes.every((part) => part >= 0 && part <= 255) ? bytes : null;
}

/**
 * Reject malformed names and local/special numeric literals before fetch.
 * This lexical gate neither resolves DNS nor pins the transport's peer IP.
 */
function screen02LexicallyPublicHostname(hostname: string) {
  const host = hostname.toLocaleLowerCase("en-US");
  if (
    !host || host.length > 253 || host.endsWith(".") || host.includes(":") ||
    /(?:^|\.)(?:localhost|local|internal|home|lan|test|invalid)$/u.test(host)
  ) return false;
  const ipv4 = screen02Ipv4Bytes(host);
  if (!ipv4) {
    // A numeric-looking value that is not canonical dotted-decimal IPv4 must
    // not fall through and be treated as a DNS name. WHATWG URL parsing
    // normally canonicalizes legacy numeric forms before this boundary.
    if (/^[0-9.]+$/u.test(host)) return false;
    return host.includes(".") && host.split(".").every((label) =>
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(label)
    );
  }
  const [first, second, third] = ipv4;
  return !(
    first === 0 || first === 10 || first === 127 ||
    (first === 100 && second! >= 64 && second! <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second! >= 16 && second! <= 31) ||
    (first === 192 && second === 0 && third === 0) ||
    (first === 192 && second === 0 && third === 2) ||
    (first === 192 && second === 31 && third === 196) ||
    (first === 192 && second === 52 && third === 193) ||
    (first === 192 && second === 88 && third === 99) ||
    (first === 192 && second === 168) ||
    (first === 192 && second === 175 && third === 48) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 198 && second === 97 && third === 38) ||
    (first === 203 && second === 0 && third === 113) ||
    first! >= 224
  );
}

function screen02OfficialOverviewUrl(value: string) {
  if (!value || value.length > 2_048) return null;
  try {
    const locator = new URL(value);
    const host = locator.hostname.toLowerCase();
    const restrictedAliasHost =
      host.endsWith(".ftc.gov") ||
      host.endsWith(".federalregister.gov") ||
      host.endsWith(".govinfo.gov");
    const officialHost =
      host === "federalregister.gov" ||
      host === "www.federalregister.gov" ||
      host === "ftc.gov" ||
      host === "www.ftc.gov" ||
      host === "govinfo.gov" ||
      host === "www.govinfo.gov" ||
      (!restrictedAliasHost && host.endsWith(".gov")) ||
      host.endsWith(".gov.uk") ||
      host === "eur-lex.europa.eu" ||
      host.endsWith(".europa.eu") ||
      host === "gdacs.org" ||
      host.endsWith(".gdacs.org");
    if (
      locator.protocol === "https:" &&
      !locator.username &&
      !locator.password &&
      !locator.port &&
      screen02LexicallyPublicHostname(host) &&
      officialHost
    ) {
      locator.hash = "";
      const normalized = locator.toString();
      return normalized.length <= 2_048 ? normalized : null;
    }
  } catch {
    // Invalid locators remain outside the fixed retrieval allowlist.
  }
  return null;
}

type Screen02OfficialOverviewOriginFamily =
  | "ftc"
  | "federal-register"
  | "govinfo"
  | "europa"
  | `official-host:${string}`;

function screen02OfficialOverviewOriginFamily(
  locator: string,
): Screen02OfficialOverviewOriginFamily | null {
  const safe = screen02OfficialOverviewUrl(locator);
  if (!safe) return null;
  const host = new URL(safe).hostname.toLocaleLowerCase("en-US");
  if (host === "ftc.gov" || host === "www.ftc.gov") return "ftc";
  if (
    host === "federalregister.gov" ||
    host === "www.federalregister.gov"
  ) return "federal-register";
  if (host === "govinfo.gov" || host === "www.govinfo.gov") {
    return "govinfo";
  }
  if (host === "eur-lex.europa.eu" || host.endsWith(".europa.eu")) {
    return "europa";
  }
  return `official-host:${host.replace(/^www\./u, "")}`;
}

function screen02DecodedOverviewPathSegments(locator: string) {
  try {
    return new URL(locator).pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));
  } catch {
    return [];
  }
}

function screen02FederalRegisterDocumentNumberFromLocator(
  value: string,
) {
  const safe = screen02OfficialOverviewUrl(value);
  if (!safe) return null;
  const family = screen02OfficialOverviewOriginFamily(safe);
  const segments = screen02DecodedOverviewPathSegments(safe);
  let candidate: string | undefined;
  if (family === "federal-register") {
    if (segments[0]?.toLocaleLowerCase("en-US") === "d") {
      candidate = segments[1];
    } else if (
      segments[0]?.toLocaleLowerCase("en-US") === "documents" &&
      segments[1]?.toLocaleLowerCase("en-US") === "full_text"
    ) {
      candidate = segments[6]?.replace(/\.(?:html?|txt|xml)$/iu, "");
    } else if (
      segments[0]?.toLocaleLowerCase("en-US") === "documents"
    ) {
      candidate = segments[4];
    }
  } else if (
    family === "govinfo" &&
    segments[0]?.toLocaleLowerCase("en-US") === "content" &&
    segments[1]?.toLocaleLowerCase("en-US") === "pkg" &&
    /^FR-\d{4}-\d{2}-\d{2}$/iu.test(segments[2] ?? "") &&
    /^(?:html|pdf|text|xml)$/iu.test(segments[3] ?? "")
  ) {
    candidate = segments[4]?.replace(/\.(?:html?|pdf|txt|xml)$/iu, "");
  }
  return candidate && /^[a-z0-9][a-z0-9-]{2,79}$/iu.test(candidate)
    ? candidate
    : null;
}

function screen02OfficialOverviewRedirectUrl(
  initialLocator: string,
  currentLocator: string,
  target: string,
) {
  const safeTarget = screen02OfficialOverviewUrl(target);
  if (!safeTarget) return null;
  const initialFamily = screen02OfficialOverviewOriginFamily(initialLocator);
  const currentFamily = screen02OfficialOverviewOriginFamily(currentLocator);
  const targetFamily = screen02OfficialOverviewOriginFamily(safeTarget);
  if (!initialFamily || !currentFamily || !targetFamily) return null;

  // FTC overview retrieval can move only between the reviewed bare/www
  // aliases. Another government origin is unrelated even though it shares a
  // public-sector suffix.
  if (initialFamily === "ftc") {
    return currentFamily === "ftc" && targetFamily === "ftc"
      ? safeTarget
      : null;
  }

  // Federal Register redirects stay inside its exact alias family. A
  // FederalRegister.gov <-> GovInfo transition is supported only when both
  // paths independently name the same source-native document number.
  if (
    initialFamily === "federal-register" ||
    initialFamily === "govinfo"
  ) {
    if (
      !["federal-register", "govinfo"].includes(currentFamily) ||
      !["federal-register", "govinfo"].includes(targetFamily)
    ) return null;
    const initialId = screen02FederalRegisterDocumentNumberFromLocator(
      initialLocator,
    );
    const currentId = screen02FederalRegisterDocumentNumberFromLocator(
      currentLocator,
    );
    const targetId = screen02FederalRegisterDocumentNumberFromLocator(
      safeTarget,
    );
    if (initialId && targetId !== initialId) return null;
    if (
      currentFamily !== targetFamily &&
      (!initialId || !targetId || initialId !== targetId)
    ) return null;
    if (currentId && targetId && currentId !== targetId) return null;
    return safeTarget;
  }

  // Other official sources may use their bare/www alias, and the existing
  // reviewed Europa family may move among europa.eu publication services.
  // They cannot redirect into an unrelated official host family.
  return initialFamily === currentFamily && currentFamily === targetFamily
    ? safeTarget
    : null;
}

function screen02ContextualOverviewUrl(value: string) {
  if (!value || value.length > 2_048) return null;
  try {
    const locator = new URL(value);
    const host = locator.hostname.toLowerCase();
    const allowed = SCREEN02_CONTEXTUAL_OVERVIEW_HOSTS.some(
      (candidate) => host === candidate || host.endsWith(`.${candidate}`),
    );
    if (
      locator.protocol === "https:" &&
      !locator.username &&
      !locator.password &&
      !locator.port &&
      screen02LexicallyPublicHostname(host) &&
      allowed
    ) {
      locator.hash = "";
      const normalized = locator.toString();
      return normalized.length <= 2_048 ? normalized : null;
    }
  } catch {
    // Contextual retrieval is optional and fails closed.
  }
  return null;
}

function screen02ContextualOverviewRedirectUrl(
  initialLocator: string,
  currentLocator: string,
  target: string,
) {
  const initial = screen02ContextualOverviewUrl(initialLocator);
  const current = screen02ContextualOverviewUrl(currentLocator);
  const next = screen02ContextualOverviewUrl(target);
  if (!initial || !current || !next) return null;
  const canonicalHost = (value: string) => new URL(value).hostname
    .toLocaleLowerCase("en-US")
    .replace(/^www\./u, "");
  const family = canonicalHost(initial);
  return canonicalHost(current) === family && canonicalHost(next) === family
    ? next
    : null;
}

function screen02OverviewLocatorIsStaticPdf(locator: string) {
  const parsed = new URL(locator);
  const pathname = parsed.pathname.toLocaleLowerCase("en-US");
  const declaredFormat = [
    parsed.searchParams.get("format"),
    parsed.searchParams.get("output"),
    parsed.searchParams.get("type"),
  ].filter(Boolean).join(" ").toLocaleLowerCase("en-US");
  return pathname.endsWith(".pdf") ||
    pathname.includes("/pdf/") ||
    /(?:^|\s)pdf(?:\s|$)/u.test(declaredFormat);
}

const SCREEN02_FTC_COMMISSION_APPROVAL_PDF_PATH =
  /^\/system\/files\/attachments\/press-releases\/[^/]+\/[^/]*commission[_-]letter[_-]approv[^/]*\.pdf$/iu;
const SCREEN02_FTC_COMMISSION_APPROVAL_LINK_LABEL =
  /\bcommission\s+letter\s+approving\b[\s\S]{0,300}\b(?:program|requirements)\b/iu;

function screen02OfficialPrimaryReferences(
  html: string,
  baseLocator: string,
): Screen02OfficialPrimaryReference[] {
  if (screen02OfficialOverviewOriginFamily(baseLocator) !== "ftc") return [];
  const references = new Map<string, Screen02OfficialPrimaryReference>();
  for (const { href, label } of screen02VisibleOverviewLinks(
    screen02PrimaryOverviewHtml(html),
  )) {
    if (!SCREEN02_FTC_COMMISSION_APPROVAL_LINK_LABEL.test(label)) continue;
    try {
      const resolved = new URL(href, baseLocator);
      const locator = screen02OfficialOverviewUrl(resolved.toString());
      if (
        !locator || resolved.search ||
        screen02OfficialOverviewOriginFamily(locator) !== "ftc" ||
        !screen02OverviewLocatorIsStaticPdf(locator) ||
        !SCREEN02_FTC_COMMISSION_APPROVAL_PDF_PATH.test(resolved.pathname)
      ) continue;
      const title = label.replace(/\s+/gu, " ").trim().slice(0, 500);
      if (title.length < 16) continue;
      references.set(locator, { locator, title });
      if (references.size >= 2) break;
    } catch {
      // A malformed or off-family reference cannot enter source provenance.
    }
  }
  return [...references.values()];
}

function screen02OfficialOverviewLocators(proposal: Screen02FindProposal) {
  const candidates = proposal.sources.flatMap((source, sourceIndex) => {
    if (source.authorityTier > 2) return [];
    const locator = screen02OfficialOverviewUrl(source.locator);
    if (!locator || screen02OverviewLocatorIsStaticPdf(locator)) return [];
    const parsed = new URL(locator);
    const descriptor = `${source.title} ${source.channel}`;
    const fullTextRepresentation =
      /\/documents\/full_text\/(?:html|text)\//iu.test(parsed.pathname) ||
      /\bfull[- ]text\b/iu.test(descriptor);
    const preference = fullTextRepresentation
      ? 0
      : /\b(?:html|text)\b/i.test(descriptor)
        ? 1
        : parsed.hostname.toLocaleLowerCase("en-US").endsWith(
            "federalregister.gov",
          )
          ? 2
          : 3;
    return [{ locator, preference, sourceIndex }];
  });
  return [...new Map(
    candidates
      .sort(
        (left, right) =>
          left.preference - right.preference ||
          left.sourceIndex - right.sourceIndex,
      )
      .map((candidate) => [candidate.locator, candidate.locator]),
  ).values()].slice(0, SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_LEVEL2_DOCUMENTS);
}

function screen02ObligationParagraph(text: string) {
  return text.length <= 1_000 && /[.!?]$/u.test(text) &&
    /\b(?:business\w*|compan\w*|controller\w*|processor\w*|provider\w*|organization\w*|consumer\w*)\b[^.!?;]{0,160}\b(?:shall|must)\b/iu.test(text) &&
    !/\b(?:without prejudice|reference is made|shall not be (?:required|obliged)|no (?:duty|obligation)|would (?:require|mandate)|if (?:adopted|enacted))\b/iu.test(text);
}

function screen02OfficialEvidenceText(html: string) {
  const compact = screen02VisibleOverviewText(html);
  if (compact.length <= 12_000 &&
    !/<(?:nav|header|footer)\b|class=["'][^"']*\beli-container\b/iu.test(html)) {
    return compact;
  }
  const primary = screen02PrimaryOverviewHtml(html);
  // Preserve compact historical responses. For document-sized responses,
  // retain whole source paragraphs, including remote operative-date clauses.
  const visible = screen02VisibleOverviewText(primary);
  if (visible.length <= 12_000) return visible;
  const enacting = officialDocumentElementHtml(primary, /<div\b[^>]*id=["']enc_\d+["'][^>]*>/iu);
  const enactingStart = enacting ? primary.indexOf(enacting) : 0;
  const blocks = [...primary.matchAll(/<(p|h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/giu)]
    .filter((match) => !/^<[^>]*class=["'][^"']*\b(?:oj-note|footnote)\b/iu.test(match[0]))
    .map((match) => ({ text: screen02VisibleOverviewText(match[2]!), index: match.index! }))
    .filter((block) => block.text.length >= 20 && block.text.length <= 2_400);
  // ELI marks its enacting terms separately from recitals and bibliographic
  // notes. Use that source-native boundary for operative orientation.
  const substantiveBlocks = enacting ? blocks.filter((block) =>
    block.index >= enactingStart && block.index < enactingStart + enacting.length) : blocks;
  const timing = substantiveBlocks.filter(({ text }) =>
    /\b(?:18|19|20|21)\d{2}\b/u.test(text) &&
    /\b(?:applicab\w*|apply|applies|commenc\w*|effective|enact\w*|enforc\w*|enter\w* into force|entry into force|operative|take\w* effect)\b/iu.test(text));
  const scope = substantiveBlocks.filter(({ text }) =>
    /\b(?:this|the) (?:regulation|directive|act|rule|law) (?:shall )?(?:appl\w*|requir\w*|establish\w*|impos\w*|prohibit\w*|govern\w*)\b/iu.test(text));
  const dutyCandidates = substantiveBlocks.filter(({ text }) =>
    /\b(?:shall|must|requir\w*|establish\w*|prohibit\w*)\b/iu.test(text) &&
    /\b(?:business\w*|compan\w*|controller\w*|processor\w*|provider\w*|organization\w*|consumer\w*)\b/iu.test(text));
  const duties = dutyCandidates.filter(({ text }) => screen02ObligationParagraph(text))
    .concat(dutyCandidates.filter(({ text }) => !screen02ObligationParagraph(text)));
  const selected = new Map<number, string>();
  let length = 0;
  for (const block of [...blocks.slice(0, 5), ...timing.slice(-6), ...duties.slice(0, 10), ...scope.slice(0, 8)]) {
    if (selected.has(block.index) || length + block.text.length + 2 > 12_000) continue;
    selected.set(block.index, block.text);
    length += block.text.length + 2;
  }
  for (const [index, text] of [...selected]) {
    if (!text.endsWith(":")) continue;
    const position = blocks.findIndex((block) => block.index === index);
    for (const block of blocks.slice(position + 1, position + 3)) {
      if (selected.has(block.index) || length + block.text.length + 2 > 12_000) continue;
      selected.set(block.index, block.text);
      length += block.text.length + 2;
    }
  }
  // Newlines preserve boundaries between noncontiguous, unmodified excerpts.
  return selected.size > 0
    ? [...selected].sort(([left], [right]) => left - right).map(([, text]) => text).join("\n\n")
    : visible.slice(0, 12_000).trim();
}

function screen02OfficialOverviewText(evidenceText: string) {
  if (evidenceText.split(/\s+/u).filter(Boolean).length < 12) return "";
  const sentences = evidenceText
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  // A long extract can begin with a title or recitals. Prioritize retained
  // operative clauses for orientation; every sentence remains source text.
  const operative = evidenceText.includes("\n\n")
    ? evidenceText.split(/\n\n/u).filter((paragraph) =>
        /[.!?]$/u.test(paragraph) && paragraph.length <= 1_000 &&
        /\b(?:shall|must|requires?|establish\w*|prohibit\w*|applies to)\b/iu.test(paragraph))
    : [];
  if (operative.length > 0) {
    const ordered = operative.filter(screen02ObligationParagraph)
      .concat(operative.filter((paragraph) => !screen02ObligationParagraph(paragraph)));
    const selected: string[] = [];
    let length = 0;
    for (const paragraph of ordered) {
      if (selected.length === 8) break;
      if (length + paragraph.length + 1 > 2_400) continue;
      selected.push(paragraph);
      length += paragraph.length + 1;
    }
    return selected.join(" ");
  }
  return sentences.slice(0, 8).join(" ").slice(0, 2_400).trim();
}

function screen02OfficialContentTitle(
  html: string,
  includeSourceHeadings = false,
) {
  const candidates = (includeSourceHeadings
    ? screen02VisibleOverviewHeadings(html)
    : screen02VisibleOverviewTitles(html))
    .map((candidate) => candidate.slice(0, 500).trim())
    .filter((candidate) => candidate.length >= 4);
  const generic = new Set([
    "action", "agency", "dates", "document", "official document",
    "official regulation", "regulation", "rule", "summary",
  ]);
  const specific = candidates.filter((candidate) => {
    const normalized = normalizedAuditIdentityText(candidate);
    return candidate.length >= 8 && candidate.split(/\s+/u).length >= 2 &&
      !generic.has(normalized);
  });
  const legal = specific.find((candidate) =>
    SCREEN02_OFFICIAL_LEGAL_INSTRUMENT.test(candidate)
  );
  if (legal) return legal;
  const namedEvent = specific.find((candidate) =>
    /\b(?:cyclone|earthquake|eruption|flood|hurricane|storm|typhoon|wildfire)\b/iu
      .test(candidate)
  );
  if (namedEvent) return namedEvent;
  return specific.sort((left, right) => {
    const termDifference = right.split(/\s+/u).length - left.split(/\s+/u).length;
    return termDifference || right.length - left.length;
  })[0] ?? null;
}

function screen02VisibleSourceRecordIdentifiers(html: string, locator: string) {
  const family = screen02OfficialOverviewOriginFamily(locator);
  if (family !== "federal-register" && family !== "govinfo") return [];
  const identifiers = new Set<string>();
  const visibleText = screen02VisibleOverviewText(html);
  for (const match of visibleText.matchAll(
    /\[\s*FR\s+Doc\.?\s+(\d{4}-\d{4,6})\s+Filed\b[^\]]{0,160}\]/giu,
  )) {
    if (screen02IdentityLabelIsQualified(visibleText, match.index ?? 0)) {
      continue;
    }
    identifiers.add(match[1]!);
  }
  for (const match of visibleText.matchAll(
    /\bDocument\s+(?:Number|No\.?)\s*:\s*(\d{4}-\d{4,6})\b/giu,
  )) {
    if (screen02IdentityLabelIsQualified(visibleText, match.index ?? 0)) {
      continue;
    }
    identifiers.add(match[1]!);
  }
  // Related-document and navigation links are not the response document's
  // own identity. Only a response-native Federal Register footer or explicit
  // document-number field can supply this coordinate; prose citations cannot.
  return [...identifiers];
}

export async function readScreen02OverviewResponseText(
  response: Response,
  maximumBytes: number,
  budget: Screen02OverviewByteBudget,
  options: {
    trace?: Screen02OverviewFetchTrace;
    runtime?: Screen02SubstantiveEnrichmentRuntime;
    requestSignal?: AbortSignal;
  } = {},
) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const fragments: string[] = [];
  let received = 0;
  const abortBody = () => {
    void reader.cancel("Document request deadline reached").catch(() => undefined);
  };
  options.requestSignal?.addEventListener("abort", abortBody, { once: true });
  try {
    while (true) {
      if (options.requestSignal?.aborted) {
        throw new Error("Official document request timed out before the body completed.");
      }
      const read = reader.read();
      const chunk = options.runtime
        ? await screen02WithinDocumentDeadline(
            options.runtime,
            read,
            () => reader.cancel("Shared document deadline reached"),
          )
        : await read;
      if (options.requestSignal?.aborted) {
        throw new Error("Official document request timed out before the body completed.");
      }
      if (chunk.done) break;
      // Count every received byte before rejecting, including concurrent and
      // oversized responses. Content-Length is never trusted as a byte gate.
      received = Math.min(maximumBytes + 1, received + chunk.value.byteLength);
      const previousBudgetBytes = budget.receivedBytes;
      budget.receivedBytes = Math.min(
        SCREEN_02_DOCUMENT_ACQUISITION_MAX_RECORDED_TOTAL_BYTES,
        budget.receivedBytes + chunk.value.byteLength,
      );
      if (options.trace) {
        // Retain exact normal counts and one bounded byte above the shared cap
        // as the overflow sentinel. This prevents an adversarial stream chunk
        // from creating an unbounded workflow-state integer.
        options.trace.receivedBytes = Math.min(
          maximumBytes + 1,
          SCREEN_02_DOCUMENT_ACQUISITION_MAX_RECORDED_BYTES,
          options.trace.receivedBytes +
            budget.receivedBytes - previousBudgetBytes,
        );
      }
      if (received > maximumBytes || budget.receivedBytes > SCREEN02_SUBSTANTIVE_ENRICHMENT_TOTAL_BYTES) {
        await reader.cancel("Official document byte budget reached").catch(() => undefined);
        throw new Error(budget.receivedBytes > SCREEN02_SUBSTANTIVE_ENRICHMENT_TOTAL_BYTES
          ? "Official document retrieval exceeded the cumulative byte limit."
          : "Official document response exceeded the byte limit.");
      }
      fragments.push(decoder.decode(chunk.value, { stream: true }));
    }
    fragments.push(decoder.decode());
    return fragments.join("");
  } catch (error) {
    await reader.cancel("Document acquisition failed").catch(() => undefined);
    throw error;
  } finally {
    options.requestSignal?.removeEventListener("abort", abortBody);
    reader.releaseLock();
  }
}

function screen02OfficialExplanatoryLinks(html: string, baseLocator: string) {
  const links: string[] = [];
  for (const { href, label } of screen02VisibleOverviewLinks(html)) {
    if (!SCREEN02_OFFICIAL_EXPLANATORY_LINK.test(`${href} ${label}`)) {
      continue;
    }
    try {
      const resolved = new URL(href, baseLocator).toString();
      const allowed = screen02OfficialOverviewUrl(resolved);
      if (allowed && allowed !== baseLocator && !links.includes(allowed)) {
        links.push(allowed);
      }
    } catch {
      // A malformed linked URL cannot expand the fixed allowlist.
    }
    if (links.length >= SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_LEVEL3_DOCUMENTS) {
      break;
    }
  }
  return links;
}

function screen02CombinedAbortSignal(signals: readonly AbortSignal[]) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener("abort", abort, { once: true });
  }
  return controller.signal;
}

export async function fetchScreen02OverviewDocument(
  fetchImpl: Screen02ConnectorFetch,
  locator: string,
  budget: Screen02OverviewByteBudget = { receivedBytes: 0 },
  beforeRequest?: (locator: string) => Promise<void>,
  options: {
    runtime?: Screen02SubstantiveEnrichmentRuntime;
    trace?: Screen02OverviewFetchTrace;
  } = {},
): Promise<Screen02OverviewDocument> {
  const initialOfficial = screen02OfficialOverviewUrl(locator);
  const initialContextual = initialOfficial
    ? null
    : screen02ContextualOverviewUrl(locator);
  if (!initialOfficial && !initialContextual) {
    throw new Error("The overview locator is outside the bounded host allowlist.");
  }
  if (budget.receivedBytes >= SCREEN02_SUBSTANTIVE_ENRICHMENT_TOTAL_BYTES) {
    throw new Error("Official document retrieval exhausted the cumulative byte limit.");
  }
  let requestLocator = (initialOfficial ?? initialContextual)!;
  const initialDiagnosticLocator = sanitizeScreen02AcquisitionUrl(
    requestLocator,
  );
  if (!initialDiagnosticLocator) {
    throw new Error("The overview locator could not enter bounded diagnostics.");
  }
  const visitedDiagnosticLocators = new Set([initialDiagnosticLocator]);
  let response: Response | null = null;
  let finalRequestSignal: AbortSignal | undefined;
  for (
    let redirectCount = 0;
    redirectCount <= SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_REDIRECTS;
    redirectCount += 1
  ) {
    // The source's crawl scheduler is inside the shared 45-second envelope,
    // while each actual HTTP request retains its own three-second bound.
    if (beforeRequest) {
      const scheduled = beforeRequest(requestLocator);
      if (options.runtime) {
        await screen02WithinDocumentDeadline(options.runtime, scheduled);
      } else {
        await scheduled;
      }
    }
    if (options.runtime && screen02DocumentDeadlineRemaining(options.runtime) <= 0) {
      throw new Error("The shared substantive-document deadline was exhausted before fetch.");
    }
    const requestSignals = [
      AbortSignal.timeout(SCREEN02_SUBSTANTIVE_ENRICHMENT_TIMEOUT_MS),
    ];
    if (options.runtime) {
      requestSignals.push(AbortSignal.timeout(Math.max(
        1,
        screen02DocumentDeadlineRemaining(options.runtime),
      )));
    }
    const requestSignal = screen02CombinedAbortSignal(requestSignals);
    finalRequestSignal = requestSignal;
    const request = fetchImpl(requestLocator, {
      headers: {
        accept: "text/html, text/plain;q=0.9",
        "cache-control": "no-store",
        "user-agent": "ShockAudit/0.6.2 substantive-overview retrieval",
      },
      redirect: "manual",
      cache: "no-store",
      signal: requestSignal,
    });
    response = options.runtime
      ? await screen02WithinDocumentDeadline(options.runtime, request)
      : await request;
    if (options.trace) {
      options.trace.httpStatus = response.status;
      options.trace.finalUrl = sanitizeScreen02AcquisitionUrl(requestLocator);
    }
    if (response.redirected) {
      await response.body?.cancel("Automatic redirects are forbidden")
        .catch(() => undefined);
      throw new Error(
        "The overview transport auto-followed a redirect and was rejected before parsing.",
      );
    }
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    if (redirectCount >= SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_REDIRECTS) {
      await response.body?.cancel("Document redirect limit reached")
        .catch(() => undefined);
      throw new Error("The overview response exceeded the redirect limit.");
    }
    const location = response.headers.get("location");
    if (!location) {
      await response.body?.cancel("Redirect omitted destination")
        .catch(() => undefined);
      throw new Error("The overview redirect omitted its destination.");
    }
    let resolvedLocation: string;
    try {
      resolvedLocation = new URL(location, requestLocator).toString();
    } catch {
      await response.body?.cancel("Redirect destination was malformed")
        .catch(() => undefined);
      throw new Error("The overview redirect destination was malformed.");
    }
    const nextLocator = initialOfficial
      ? screen02OfficialOverviewRedirectUrl(
          initialOfficial,
          requestLocator,
          resolvedLocation,
        )
      : screen02ContextualOverviewRedirectUrl(
          initialContextual!,
          requestLocator,
          resolvedLocation,
        );
    if (!nextLocator) {
      await response.body?.cancel("Redirect policy rejected destination")
        .catch(() => undefined);
      throw new Error(
        "The overview redirect escaped its bounded origin-family host allowlist.",
      );
    }
    const fromUrl = sanitizeScreen02AcquisitionUrl(requestLocator);
    const toUrl = sanitizeScreen02AcquisitionUrl(nextLocator);
    if (!fromUrl || !toUrl) {
      await response.body?.cancel("Redirect diagnostics were unsafe")
        .catch(() => undefined);
      throw new Error(
        "The overview redirect could not enter bounded diagnostics.",
      );
    }
    // Diagnostics deliberately omit query strings and fragments. Refuse a
    // hop that would collapse to a self-edge or revisit after that redaction;
    // otherwise the persisted trace could not truthfully represent transport.
    if (toUrl === fromUrl || visitedDiagnosticLocators.has(toUrl)) {
      await response.body?.cancel("Redirect revisited a sanitized location")
        .catch(() => undefined);
      throw new Error(
        "The overview redirect revisited an already attempted sanitized location.",
      );
    }
    visitedDiagnosticLocators.add(toUrl);
    if (options.trace) {
      options.trace.redirectChain.push({
        status: response.status as Screen02DocumentRedirectHop["status"],
        fromUrl,
        toUrl,
      });
      // The next hop has been policy-validated and is now the attempted
      // terminal location even if its network request subsequently fails.
      options.trace.finalUrl = toUrl;
    }
    await response.body?.cancel("Following validated manual redirect")
      .catch(() => undefined);
    requestLocator = nextLocator;
  }
  if (!response) {
    throw new Error("The overview request did not return a response.");
  }
  if (!response.ok) {
    await response.body?.cancel("Non-success document response")
      .catch(() => undefined);
    throw new Error(`Official document returned HTTP ${response.status}.`);
  }
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const mediaType = contentType.split(";", 1)[0]?.trim() ?? "";
  if (
    mediaType !== "text/html" && mediaType !== "text/plain"
  ) {
    await response.body?.cancel("Unsupported document media type")
      .catch(() => undefined);
    throw new Error(
      "Official document did not declare a supported HTML or text content type.",
    );
  }
  if (options.trace) {
    options.trace.mediaType = mediaType;
    options.trace.parserPath = mediaType === "text/html"
      ? "official-html-visible-text"
      : "official-plain-text";
  }
  const body = await readScreen02OverviewResponseText(
    response,
    initialOfficial ? SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_BYTES : 256 * 1024,
    budget,
    { ...options, requestSignal: finalRequestSignal },
  );
  const evidenceText = screen02OfficialEvidenceText(body);
  if (options.trace) {
    options.trace.parserOutcome = evidenceText ? "parsed" : "empty";
  }
  const sourceRecordIdentifiers = screen02VisibleSourceRecordIdentifiers(
    body,
    requestLocator,
  );
  const sourceRecordIdentifier = sourceRecordIdentifiers.length === 1
    ? sourceRecordIdentifiers[0]!
    : null;
  const nativeIdentity = screen02NativeOverviewIdentity(body, requestLocator);
  const nativeIdentityConflict = sourceRecordIdentifiers.length > 1 || Boolean(
    new URL(requestLocator).hostname === "eur-lex.europa.eu" &&
      screen02OverviewMetadata(body).some((attributes) =>
        attributes.name?.toLowerCase() === "wt.z_docid" ||
        attributes.property?.toLowerCase() === "eli:title") && !nativeIdentity,
  ) || Boolean(
    !nativeIdentity && screen02UkLegislationLocatorId(requestLocator) &&
      screen02OverviewMetadata(body).some((attributes) =>
        ["dc.title", "legislation.year"].includes(
          attributes.name?.toLocaleLowerCase("en-US") ?? "",
        )
      ),
  );
  return {
    locator: requestLocator,
    title: researcherPageTitle(
      body,
      new URL(requestLocator),
      researcherResponseTitle(response),
    ),
    contentTitle: nativeIdentity?.title ?? screen02OfficialContentTitle(body),
    ...(nativeIdentity ? { nativeIdentity } : {}),
    ...(nativeIdentityConflict ? { nativeIdentityConflict: true } : {}),
    publisher: new URL(requestLocator).hostname.toLowerCase(),
    publishedDate: publishedDateFromResponse(response),
    overview: screen02OfficialOverviewText(evidenceText),
    evidenceText,
    contentFingerprint: fingerprintScreen02WorkflowValue(evidenceText),
    ...(sourceRecordIdentifier ? { sourceRecordIdentifier } : {}),
    explanatoryLocators: screen02OfficialExplanatoryLinks(
      body,
      requestLocator,
    ),
    primaryReferences: screen02OfficialPrimaryReferences(
      body,
      requestLocator,
    ),
  };
}

type Screen02DocumentAcquisitionBinding = {
  candidateId: string;
  sourceId: string | null;
  sourceCacheKey: string;
  level: Screen02DocumentAcquisitionLevel;
  locator: string;
};

function screen02DocumentAcquisitionId(
  binding: Screen02DocumentAcquisitionBinding,
  attempt: number,
) {
  const digest = fingerprintScreen02WorkflowValue({
    attempt,
    candidateId: binding.candidateId,
    sourceCacheKey: binding.sourceCacheKey,
    level: binding.level,
    locator: sanitizeScreen02AcquisitionUrl(binding.locator),
  }).replace(/[^a-z0-9]/giu, "").slice(-20);
  return `screen02-document-${attempt}-${digest}`;
}

function screen02RecordDocumentAcquisition(
  runtime: Screen02SubstantiveEnrichmentRuntime,
  input: {
    acquisitionId: string;
    binding: Screen02DocumentAcquisitionBinding;
    trace: Screen02OverviewFetchTrace;
    startedAt: number;
    error?: unknown;
  },
) {
  const requestedUrl = sanitizeScreen02AcquisitionUrl(input.binding.locator);
  if (!requestedUrl) {
    throw new Error("A document acquisition cannot persist an unsafe URL diagnostic.");
  }
  const failed = input.error !== undefined ||
    input.trace.parserOutcome !== "parsed";
  const reason = failed
    ? sanitizeScreen02AcquisitionFailureReason(
        input.error instanceof Error
          ? input.error.message
          : input.trace.parserOutcome === "empty"
            ? "The document contained no visible text after bounded parsing."
            : "The document acquisition failed before bounded parsing completed.",
      )
    : null;
  const elapsed = Math.round(runtime.now() - input.startedAt);
  const acquisition: Screen02DocumentAcquisition = {
    schemaVersion: SCREEN_02_DOCUMENT_ACQUISITION_SCHEMA_VERSION,
    acquisitionId: input.acquisitionId,
    candidateId: input.binding.candidateId.slice(0, 200),
    sourceId: input.binding.sourceId?.slice(0, 200) ?? null,
    level: input.binding.level,
    requestedUrl,
    redirectChain: input.trace.redirectChain,
    finalUrl: input.trace.finalUrl,
    httpStatus: input.trace.httpStatus,
    mediaType: input.trace.mediaType,
    receivedBytes: input.trace.receivedBytes,
    latencyMs: Math.min(
      SCREEN_02_DOCUMENT_ACQUISITION_MAX_RECORDED_LATENCY_MS,
      Math.max(0, Number.isFinite(elapsed) ? elapsed :
        SCREEN_02_DOCUMENT_ACQUISITION_MAX_RECORDED_LATENCY_MS),
    ),
    parserPath: input.trace.parserPath,
    parserOutcome: failed && input.trace.parserOutcome === "parsed"
      ? "rejected"
      : input.trace.parserOutcome,
    outcome: failed ? "failed" : "succeeded",
    failureReason: reason,
  };
  runtime.documentAcquisitions.push(acquisition);
  const journal = runtime.documentAttemptJournal.find(
    (entry) => entry.acquisitionId === input.acquisitionId,
  );
  if (journal) journal.status = failed ? "failed" : "succeeded";
  return acquisition;
}

function screen02RebindDocumentAcquisition(
  runtime: Screen02SubstantiveEnrichmentRuntime,
  acquisitionId: string | undefined,
  candidateId: string,
  sourceId: string | null,
) {
  if (!acquisitionId) return;
  const acquisition = runtime.documentAcquisitions.find(
    (entry) => entry.acquisitionId === acquisitionId,
  );
  if (!acquisition) return;
  acquisition.candidateId = candidateId.slice(0, 200);
  acquisition.sourceId = sourceId?.slice(0, 200) ?? null;
}

async function acquireScreen02OverviewDocument(
  runtime: Screen02SubstantiveEnrichmentRuntime,
  binding: Screen02DocumentAcquisitionBinding,
  fetchImpl: Screen02ConnectorFetch,
  input: {
    maximumAttempts: number;
    beforeRequest?: (locator: string) => Promise<void>;
  },
) {
  const diagnosticUrl = sanitizeScreen02AcquisitionUrl(binding.locator);
  if (!diagnosticUrl) {
    throw new Error("The document locator cannot enter sanitized acquisition diagnostics.");
  }
  // Search-wide route identity must not depend on a proposal source
  // fingerprint: successful enrichment intentionally changes that source's
  // evidence text. Candidate + level + sanitized URL is the immutable route
  // coordinate, so a JSON-restored continuation cannot reacquire it merely
  // because the prior response was applied to the proposal.
  const cacheKey = fingerprintScreen02WorkflowValue({
    candidateId: binding.candidateId,
    level: binding.level,
    locator: diagnosticUrl,
  });
  const cached = runtime.documentCache.get(cacheKey);
  if (cached) return cached;
  if (runtime.persistedAttemptedDocumentKeys.has(cacheKey)) {
    throw new Error(
      "The substantive document route was already attempted by this search and will not be replayed.",
    );
  }
  if (runtime.receivedBytes >= SCREEN02_SUBSTANTIVE_ENRICHMENT_TOTAL_BYTES) {
    throw new Error("The cumulative substantive-document byte budget was exhausted.");
  }
  if (
    runtime.documentsAttempted >=
      Math.min(SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_DOCUMENT_FETCHES,
        Math.max(0, input.maximumAttempts))
  ) {
    throw new Error("The bounded substantive-document budget was exhausted.");
  }
  if (
    runtime.invocationDocumentsAttempted >=
      runtime.invocationDocumentFetchLimit
  ) {
    throw new Error(
      "The current Worker invocation reserved its substantive-document allowance.",
    );
  }
  runtime.documentsAttempted += 1;
  runtime.invocationDocumentsAttempted += 1;
  const attempt = runtime.documentsAttempted;
  const acquisitionId = screen02DocumentAcquisitionId(binding, attempt);
  // Reserve before any scheduler, DNS, redirect, socket, or body work. The
  // entry remains ambiguous until the acquisition records a terminal result.
  // A persisted continuation therefore never resets or silently retries a
  // request whose outcome became uncertain at an invocation boundary.
  runtime.attemptedDocumentKeys.add(cacheKey);
  runtime.documentAttemptJournal.push({
    requestKey: cacheKey,
    attempt,
    status: "ambiguous",
    acquisitionId,
  });
  const request = (async () => {
    const startedAt = runtime.now();
    const trace: Screen02OverviewFetchTrace = {
      redirectChain: [],
      finalUrl: null,
      httpStatus: null,
      mediaType: null,
      receivedBytes: 0,
      parserPath: "not-run",
      parserOutcome: "not-run",
    };
    let release: (() => void) | undefined;
    try {
      release = await screen02AcquireDocumentSlot(runtime);
      const document = await fetchScreen02OverviewDocument(
        fetchImpl,
        binding.locator,
        runtime,
        input.beforeRequest,
        { runtime, trace },
      );
      screen02RecordDocumentAcquisition(runtime, {
        acquisitionId,
        binding,
        trace,
        startedAt,
      });
      return { ...document, acquisitionId };
    } catch (error) {
      if (trace.parserPath !== "not-run" && trace.parserOutcome === "not-run") {
        trace.parserOutcome = "rejected";
      }
      screen02RecordDocumentAcquisition(runtime, {
        acquisitionId,
        binding,
        trace,
        startedAt,
        error,
      });
      throw error;
    } finally {
      release?.();
    }
  })();
  runtime.documentCache.set(cacheKey, request);
  void request.then(
    () => {
      const acquisition = runtime.documentAcquisitions.find(
        (entry) => entry.acquisitionId === acquisitionId,
      );
      if (acquisition?.outcome === "failed" &&
        runtime.documentCache.get(cacheKey) === request) {
        runtime.documentCache.delete(cacheKey);
      }
    },
    () => {
      if (runtime.documentCache.get(cacheKey) === request) {
        runtime.documentCache.delete(cacheKey);
      }
    },
  );
  return request;
}

export type Screen02HostOfficialSourceLeadResolution = {
  leadId: string;
  leadFingerprint: string;
  contentFingerprint: string | null;
  url: string;
  candidateId: string | null;
  status: "verified" | "rejected";
  retrieved: boolean;
  reason: string;
  source: Screen02Source | null;
  overview: string | null;
  /** Present only when fixed parsing established a new unbound event lead. */
  proposal: Screen02FindProposal | null;
};

function screen02HostOfficialLeadId(
  lead: Screen02PoolHostOfficialSourceLead,
  index: number,
) {
  const digest = fingerprintScreen02WorkflowValue({ index, ...lead })
    .replace(/[^a-z0-9]/giu, "")
    .slice(-20);
  return `host-official-lead-${index + 1}-${digest}`;
}

function screen02HostLeadMatchesCandidate(
  state: Screen02FindState,
  candidate: Screen02FindState["candidates"][number],
  document: Screen02OverviewDocument,
) {
  // Candidate binding must come from the document's own derived identity, not
  // from a possibly incidental alias or cross-reference elsewhere in its body.
  const documentTitle = screen02OfficialEventTitle(document);
  if (!documentTitle) return false;
  const titleMatches = screen02ExactBoundTitle(document, [
    candidate.identity.canonicalTitle,
    candidate.identity.formalIdentifier,
    ...candidate.identity.commonNames,
  ], candidate.identity.issuer);
  if (!titleMatches) return false;

  const normalizeIdentifier = (value: string | null | undefined) =>
    (value ?? "").toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/gu, "");
  const candidateFormal = candidate.identity.formalIdentifier;
  const responseFormalEvidence = screen02ResponseOwnFormalIdentifierEvidence(
    document,
  );
  const responseFormalIdentifiers = responseFormalEvidence.identifiers;
  if (responseFormalEvidence.conflict || responseFormalIdentifiers.length > 1) {
    return false;
  }
  if (candidateFormal && responseFormalIdentifiers.some((identifier) =>
    !screen02FormalIdentifiersCompatible(identifier, candidateFormal)
  )) {
    return false;
  }

  const responseIssuers = screen02OfficialLabeledFacts(
    document.evidenceText,
    "(?:agency|issuing (?:authority|body)|issuer)",
  );
  const responseJurisdictions = screen02OfficialLabeledFacts(
    document.evidenceText,
    "jurisdiction",
  );
  if (candidate.identity.issuer && responseIssuers.some((issuer) =>
    !screen02CompatibleInstitution(candidate.identity.issuer, issuer)
  )) return false;
  if (candidate.identity.issuingJurisdiction &&
    responseJurisdictions.some((jurisdiction) =>
      !screen02CompatibleInstitution(
        candidate.identity.issuingJurisdiction,
        jurisdiction,
      )
    )) return false;

  const candidateSources = state.sources.filter((source) =>
    candidate.sourceIds.includes(source.id)
  );
  const exactCandidateLocator = candidateSources.some((source) =>
    screen02OfficialOverviewUrl(source.locator) ===
      screen02OfficialOverviewUrl(document.locator)
  );
  const candidateFederalIds = new Set(candidateSources.flatMap((source) => {
    const id = screen02FederalRegisterDocumentNumberFromLocator(source.locator);
    return id ? [normalizeIdentifier(id)] : [];
  }));
  const responseFederalIds = new Set([
    screen02FederalRegisterDocumentNumberFromLocator(document.locator),
    document.sourceRecordIdentifier,
  ].flatMap((id) => id ? [normalizeIdentifier(id)] : []));
  if (candidateFederalIds.size > 0 && responseFederalIds.size > 0 &&
    ![...responseFederalIds].some((id) => candidateFederalIds.has(id))) {
    return false;
  }
  const candidateCelexIds = new Set(candidateSources.flatMap((source) => {
    const id = screen02CelexLocatorId(source.locator);
    return id ? [normalizeIdentifier(id)] : [];
  }));
  const responseCelexId = screen02CelexLocatorId(document.locator);
  if (candidateCelexIds.size > 0 && responseCelexId &&
    !candidateCelexIds.has(normalizeIdentifier(responseCelexId))) return false;

  const nativeRecordMatch = Boolean(
    document.nativeIdentity?.recordId && candidateCelexIds.has(
      normalizeIdentifier(document.nativeIdentity.recordId),
    ),
  ) || Boolean(
    document.sourceRecordIdentifier && candidateFederalIds.has(
      normalizeIdentifier(document.sourceRecordIdentifier),
    ),
  );
  const formalMatch = Boolean(
    candidateFormal && responseFormalIdentifiers.length > 0 &&
    responseFormalIdentifiers.every((identifier) =>
      screen02FormalIdentifiersCompatible(identifier, candidateFormal)
    ),
  );
  const issuerMatch = Boolean(
    candidate.identity.issuer && (
      responseIssuers.length > 0 && responseIssuers.every((issuer) =>
        screen02CompatibleInstitution(candidate.identity.issuer, issuer)
      ) || screen02VisibleTextHasAffirmativeIssuingActor(
        document.evidenceText,
        candidate.identity.issuer,
        document.contentTitle,
        [
          candidate.identity.canonicalTitle,
          candidate.identity.formalIdentifier,
          ...candidate.identity.commonNames,
        ],
      )
    ),
  );
  const jurisdictionMatch = Boolean(
    candidate.identity.issuingJurisdiction &&
    responseJurisdictions.length > 0 &&
    responseJurisdictions.every((jurisdiction) =>
      screen02CompatibleInstitution(
        candidate.identity.issuingJurisdiction,
        jurisdiction,
      )
    ),
  );
  const issuerAndJurisdictionMatch = issuerMatch && jurisdictionMatch;
  const locatorAndObservedIssuerMatch = exactCandidateLocator && issuerMatch;

  // A matching title on an arbitrary allowlisted government host is not an
  // identity binding. Require at least one independently observed coordinate:
  // a response-native record identifier, an exact formal identifier, the
  // issuer/jurisdiction pair, or an exact locator plus an observed matching
  // issuer. A broad jurisdiction such as “United States” cannot substitute
  // for a missing response-native identifier or issuing institution.
  return nativeRecordMatch || formalMatch || issuerAndJurisdictionMatch ||
    locatorAndObservedIssuerMatch;
}

const SCREEN02_OFFICIAL_LEGAL_INSTRUMENT =
  /\b(?:act|bill|code|decision|decree|directive|law|ordinance|order|regulation|rule|statute)\b/iu;
const SCREEN02_OFFICIAL_EVENT_ACTION =
  /\b(?:adopt(?:ed|s)?|approv(?:e|ed|es|ing)|issu(?:e|ed|es|ing)|promulgat(?:e|ed|es|ing))\b/iu;
const SCREEN02_OFFICIAL_CONTROLLING_LANGUAGE =
  /\b(?:adopt(?:ed|s)?|amend(?:ed|s)?|appl(?:ied|ies|y)|effective|enact(?:ed|s)?|govern(?:ed|s)?|impose(?:d|s)?|must|prohibit(?:ed|s)?|promulgat(?:ed|es)?|requir(?:e|ed|es|ing)|shall)\b/iu;
const SCREEN02_OFFICIAL_PRIMARY_PATH =
  /\/(?:acts?|bills?|codes?|d|documents?|eli\/(?:dec|dir|reg)|laws?|legal-content(?:\/|$)|legislation|ordinances?|regulations?|rules?|statutes?)(?:\/|$)/iu;

function screen02OfficialFormalIdentifiers(text: string) {
  const numberedInstrument =
    /\b(?:Act|Decree|Law|Order|Ordinance|Regulation|Rule)\s+No\.?\s*[A-Z]{0,4}\s*\d{1,6}(?:(?:[./\u2010-\u2015\u2212-][A-Z0-9]{1,16})|[A-Z](?![\p{L}\p{N}])|\s+(?:[A-Z](?![\p{L}\p{N}])|\d{1,16}\b))*\b(?![A-Z0-9/\u2010-\u2015\u2212-]|\.[A-Z0-9])/giu;
  const patterns = [
    /\b(?:(?:Commission\s+)?(?:Delegated\s+|Implementing\s+)?(?:Decision|Directive|Regulation)\s*(?:\((?:EC|EEC|EU|UK)\))?|(?:EC|EEC|EU|UK)\s+(?:Decision|Directive|Regulation))\s*(?:No\.?\s*)?\d{1,6}\/\d{1,6}(?:\/(?:EC|EEC|EU|UK))?\b/giu,
    /\b(?:Public\s+Law|Pub\.?\s*L\.?)\s*(?:No\.?\s*)?\d{1,3}[-\u2013]\d{1,5}\b/giu,
    /\b(?:California\s+)?(?:Assembly|House|Senate)\s+Bill\s*(?:No\.?\s*)?\d{1,6}(?:(?:\s*[,;()]?\s*)(?:(?:Chapter|Ch\.?)\s*\d{1,6}|(?:Statutes|Stats\.?)(?:\s+of)?\s*(?:18|19|20|21)\d{2}|(?:18|19|20|21)\d{2}\s*[-\u2010-\u2015\u2212]\s*(?:18|19|20|21)\d{2}\s*(?:(?:Reg(?:ular)?\.?\s+Sess(?:ion)?\.?)|(?:Special|Extraordinary)\s+Sess(?:ion)?\.?))){0,4}\s*\)?/giu,
    /\b(?:California\s+)?(?:A|H|S)\.?\s*B\.?\s*-?\s*\d{1,6}(?:(?:\s*[,;()]?\s*)(?:(?:Chapter|Ch\.?)\s*\d{1,6}|(?:Statutes|Stats\.?)(?:\s+of)?\s*(?:18|19|20|21)\d{2}|(?:18|19|20|21)\d{2}\s*[-\u2010-\u2015\u2212]\s*(?:18|19|20|21)\d{2}\s*(?:(?:Reg(?:ular)?\.?\s+Sess(?:ion)?\.?)|(?:Special|Extraordinary)\s+Sess(?:ion)?\.?))){0,4}\s*\)?/giu,
    /\b\d{1,3}\s+CFR\s+(?:Part(?:s)?|\u00a7{1,2})\s*[\d.\u2013,-]+\b/giu,
    numberedInstrument,
  ];
  const matches: Array<{ index: number; value: string }> = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const value = match[0].replace(/\s+/gu, " ").trim().slice(0, 500);
      if (value) matches.push({ index: match.index ?? 0, value });
      if (matches.length >= 32) break;
    }
  }
  matches.sort((left, right) => left.index - right.index);
  const seen = new Set<string>();
  return matches.flatMap(({ value }) => {
    const identity = normalizedAuditFormalIdentifier(value);
    if (!identity || seen.has(identity)) return [];
    seen.add(identity);
    return [value];
  }).slice(0, 8);
}

function screen02OfficialFormalIdentifier(text: string) {
  return screen02OfficialFormalIdentifiers(text)[0] ?? null;
}

const SCREEN02_QUALIFIED_IDENTITY_LABEL_PREFIXES = new Set([
  "background", "cited", "covered", "draft", "employer", "former",
  "historical", "other", "previous", "prior", "proposed", "referenced",
  "related", "replacement", "secondary", "see", "source", "superseded",
  "target",
]);
const SCREEN02_QUALIFIED_IDENTITY_LABEL_BRIDGES = new Set([
  "a", "an", "federal", "formal", "legal", "official", "record",
  "reference", "register", "source", "the",
]);

function screen02IdentityLabelIsQualified(text: string, labelIndex: number) {
  // Some callers include a punctuation boundary in the label match. In that
  // case the preceding clause cannot qualify the label that follows it.
  if (/^[.;!?]/u.test(text.slice(labelIndex))) return false;
  const rawPrefix = text.slice(Math.max(0, labelIndex - 120), labelIndex);
  const currentClause = rawPrefix.split(/[.;!?\n\r]/u).at(-1) ?? "";
  const preceding = normalizedAuditIdentityText(currentClause)
    .split(" ").filter(Boolean).slice(-8);
  const qualifierIndex = preceding.findLastIndex((token) =>
    SCREEN02_QUALIFIED_IDENTITY_LABEL_PREFIXES.has(token)
  );
  return qualifierIndex >= 0 && preceding.slice(qualifierIndex + 1).every(
    (token) => SCREEN02_QUALIFIED_IDENTITY_LABEL_BRIDGES.has(token),
  );
}

function screen02ResponseOwnFormalLabelValue(text: string, start: number) {
  const tail = text.slice(start, start + 240);
  let end = tail.length;
  const nextLabel = tail.search(
    /\s+(?=(?:(?:agency|issuing (?:authority|body)|issuer|jurisdiction)|(?:formal|legal|official)\s+(?:identifier|id|citation)|(?:instrument|document)\s+(?:identifier|id|number|no\.?))\s*:)/iu,
  );
  if (nextLabel >= 0) end = nextLabel;
  for (const boundary of tail.matchAll(/\.(?=\s|$)/gu)) {
    const index = boundary.index ?? 0;
    if (index >= end) break;
    const throughBoundary = tail.slice(0, index + 1);
    if (/(?:\b(?:ch|no|pub|reg|sess|stats)\.|\bpub\.\s*l\.|\b(?:a|h|s)\.\s*(?:b|r)\.)$/iu
      .test(throughBoundary)) continue;
    end = index;
    break;
  }
  return tail.slice(0, end).trim();
}

export function screen02ResponseOwnFormalIdentifierEvidence(
  document: Screen02OverviewDocument,
) {
  const contentTitle = document.contentTitle ?? "";
  const titleIdentifier = screen02OfficialFormalIdentifier(contentTitle);
  const titleStartsWithIdentifier = Boolean(titleIdentifier &&
    normalizedAuditIdentityText(contentTitle).startsWith(
      normalizedAuditIdentityText(titleIdentifier),
    ));
  const observed = [
    document.nativeIdentity?.formalIdentifier,
    titleStartsWithIdentifier ? titleIdentifier : undefined,
  ];
  let conflict = false;
  const labels =
    /\b(?:formal|legal|official)\s+(?:identifier|id|citation)\s*:\s*|\b(?:instrument|document)\s+(?:identifier|id|number|no\.?)\s*:\s*/giu;
  for (const match of document.evidenceText.matchAll(labels)) {
    if (screen02IdentityLabelIsQualified(
      document.evidenceText,
      match.index ?? 0,
    )) continue;
    const start = (match.index ?? 0) + match[0].length;
    const ownLabelValue = screen02ResponseOwnFormalLabelValue(
      document.evidenceText,
      start,
    ).replace(/\s+/gu, " ").trim();
    const identifiers = parseScreen02FormalIdentifier(ownLabelValue)
      ? [ownLabelValue]
      : screen02OfficialFormalIdentifiers(ownLabelValue);
    if (identifiers.length !== 1) {
      conflict = true;
      continue;
    }
    observed.push(identifiers[0]);
  }
  const validObserved = observed.flatMap((value) => {
    const compact = value?.replace(/\s+/gu, " ").trim() ?? "";
    return compact && parseScreen02FormalIdentifier(compact) ? [compact] : [];
  });
  const pairwiseConflict = validObserved.some((value, index) =>
    validObserved.slice(index + 1).some((other) => {
      const relation = compareScreen02FormalIdentifiers(value, other);
      return relation === "conflict" || relation === "different";
    })
  );
  const identifiers: string[] = [];
  for (const value of validObserved) {
    const normalized = normalizedAuditFormalIdentifier(value);
    if (!normalized) continue;
    const compatibleIndex = identifiers.findIndex((identifier) =>
      screen02FormalIdentifiersCompatible(identifier, value)
    );
    const compact = value.replace(/\s+/gu, " ").trim();
    if (compatibleIndex < 0) {
      identifiers.push(compact);
    } else {
      const prior = identifiers[compatibleIndex]!;
      const priorSpecificity = parseScreen02FormalIdentifier(prior)
        ?.specificity ?? 0;
      const nextSpecificity = parseScreen02FormalIdentifier(compact)
        ?.specificity ?? 0;
      if (
        nextSpecificity > priorSpecificity ||
        (nextSpecificity === priorSpecificity && compact.length > prior.length)
      ) identifiers[compatibleIndex] = compact;
    }
  }
  return {
    identifiers,
    conflict: conflict || pairwiseConflict || identifiers.length > 1,
  };
}

function screen02OfficialTitleSegments(title: string | null | undefined) {
  return (title?.replace(/\s+/gu, " ").trim() ?? "")
    .split(/\s+(?:[|\u2013\u2014]|-{2,})\s+/u)
    .map((value) => value.trim())
    .filter((value) => value.length >= 4);
}

function screen02OfficialTitleHasRelationshipSibling(
  title: string | null | undefined,
) {
  const segments = screen02OfficialTitleSegments(title);
  const relationshipIndex = segments.findIndex((segment) =>
    /\b(?:amend(?:ed|ing|ment)?|draft|proposal|repeal(?:ed|ing)?|replacement|replac(?:ed|ing)|rescission|rescind(?:ed|ing)?|revocation|revok(?:ed|ing))\b/iu
      .test(segment)
  );
  return relationshipIndex >= 0 && segments.some((segment, index) =>
    index !== relationshipIndex &&
    SCREEN02_OFFICIAL_LEGAL_INSTRUMENT.test(segment)
  );
}

function screen02ExactBoundTitle(
  document: Screen02OverviewDocument,
  expectedNames: readonly (string | null | undefined)[],
  expectedIssuer: string | null | undefined,
) {
  const segments = screen02OfficialTitleSegments(document.contentTitle);
  const names = new Set(expectedNames.map(normalizedAuditTitleIdentity).filter(
    (value) => value.length >= 8,
  ));
  if (names.has(normalizedAuditTitleIdentity(document.contentTitle))) return true;
  const matchedIndex = segments.findIndex((segment) =>
    names.has(normalizedAuditTitleIdentity(segment))
  );
  if (matchedIndex < 0) return false;
  const publisher = normalizedAuditIdentityText(document.publisher)
    .replace(/\b(?:gov|www)\b/gu, " ").replace(/\s+/gu, " ").trim();
  return segments.every((segment, index) => {
    if (index === matchedIndex) return true;
    const normalized = normalizedAuditIdentityText(segment);
    return /^(?:official (?:legal )?text|official (?:document|record)|legal text)$/u
      .test(normalized) ||
      Boolean(expectedIssuer && screen02CompatibleInstitution(
        expectedIssuer,
        segment,
      )) ||
      Boolean(publisher && normalized === publisher);
  });
}

function screen02OfficialEventTitle(document: Screen02OverviewDocument) {
  if (document.nativeIdentityConflict) return null;
  const raw = document.contentTitle?.replace(/\s+/gu, " ").trim() ?? "";
  if (!raw) return null;
  const segments = raw
    .split(/\s+(?:[|\u2013\u2014]|-{2,})\s+/u)
    .map((value) => value.trim())
    .filter(Boolean);
  const titleIndex = segments.findIndex((segment) =>
    SCREEN02_OFFICIAL_LEGAL_INSTRUMENT.test(segment) ||
    SCREEN02_OFFICIAL_EVENT_ACTION.test(segment)
  );
  const title = (titleIndex >= 0 ? segments[titleIndex]! : raw)
    .slice(0, 500).trim();
  const normalized = normalizedAuditIdentityText(title);
  const generic = new Set([
    "act", "bill", "code", "decision", "decree", "directive", "document",
    "law", "legislation", "official document", "official regulation",
    "ordinance", "order", "regulation", "rule", "statute",
  ]);
  const recognizedIdentityTitle =
    SCREEN02_OFFICIAL_LEGAL_INSTRUMENT.test(title) ||
    SCREEN02_OFFICIAL_EVENT_ACTION.test(title);
  if (
    title.length < 8 || title.split(/\s+/u).length < 2 ||
    generic.has(normalized) ||
    !recognizedIdentityTitle ||
    !normalizedAuditIdentityText(document.evidenceText).includes(normalized)
  ) {
    return null;
  }
  return title;
}

function screen02OfficialDocumentDate(document: Screen02OverviewDocument) {
  const iso = document.evidenceText.match(
    /\b(?:18|19|20|21)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\b/u,
  )?.[0];
  if (iso && !Number.isNaN(Date.parse(`${iso}T00:00:00.000Z`))) return iso;
  const months: Record<string, number> = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11,
    december: 12,
  };
  const named = document.evidenceText.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+([12]?\d|3[01]),\s*((?:18|19|20|21)\d{2})\b/iu,
  );
  if (named) {
    const month = months[named[1]!.toLocaleLowerCase("en-US")];
    const day = Number(named[2]);
    const year = Number(named[3]);
    if (month) {
      const date = new Date(Date.UTC(year, month - 1, day));
      if (
        date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      ) return date.toISOString().slice(0, 10);
    }
  }
  return document.publishedDate;
}

function screen02OfficialLabeledOperativeDate(
  document: Screen02OverviewDocument,
) {
  const isoDate =
    String.raw`(?:18|19|20|21)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])`;
  const namedDate =
    String.raw`(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+(?:[12]?\d|3[01]),\s*(?:18|19|20|21)\d{2}`;
  const match = new RegExp(
    String.raw`\b(?:became\s+effective|is\s+effective|was\s+effective|effective\s+date|operative\s+date|is\s+operative|was\s+operative|entered\s+into\s+force|came\s+into\s+force|in\s+force)\b\s*(?:(?:date\s+)?(?:is|was)\s*)?(?::|[-\u2013\u2014])?\s*(?:on|from|as\s+of)?\s*(${isoDate}|${namedDate})`,
    "iu",
  ).exec(document.evidenceText)?.[1];
  if (!match) return null;
  return screen02OfficialDocumentDate({
    ...document,
    evidenceText: match,
    publishedDate: null,
  });
}

function screen02OfficialOperativeStatus(evidenceText: string) {
  const operative =
    /\b(?:became|is|was)\s+(?:effective|operative)\b|\b(?:is|was|remains?)\s+in\s+force\b|\b(?:entered|came)\s+into\s+force\b/giu;
  for (const match of evidenceText.matchAll(operative)) {
    const index = match.index ?? 0;
    const clause = evidenceText.slice(
      Math.max(0, index - 100),
      Math.min(evidenceText.length, index + match[0].length + 120),
    ).split(/[.!?]/u).find((value) => value.includes(match[0])) ?? "";
    if (
      /\b(?:if|unless)\s+(?:(?:the|this)\s+(?:bill|measure|proposal|regulation)\s+)?(?:is\s+)?(?:adopted|enacted|passed|signed)\b|\bsubject\s+to\s+(?:adoption|enactment|passage|signature)\b/iu.test(
        clause,
      )
    ) continue;
    return "In force";
  }
  if (
    /\b(?:was|has\s+been|had\s+been)\s+(?:duly\s+)?enacted\b|\b(?:was|has\s+been|had\s+been)\s+signed\s+into\s+law\b|\b(?:the\s+)?governor\s+signed\s+(?:the\s+bill\s+)?into\s+law\b|\b(?:was|has\s+been|had\s+been)\s+chaptered\b/iu.test(
      evidenceText,
    )
  ) return "Enacted";
  if (
    /\b(?:was|has\s+been|had\s+been)\s+(?:formally\s+)?adopted\b/iu.test(
      evidenceText,
    )
  ) return "Adopted";
  return null;
}

function screen02OfficialLabeledFact(
  text: string,
  labels: string,
  maximum = 240,
) {
  return screen02OfficialLabeledFacts(text, labels, maximum)[0] ?? null;
}

function screen02OfficialLabeledFacts(
  text: string,
  labels: string,
  maximum = 240,
) {
  const pattern = new RegExp(
    `(?:^|[.;]\\s+|\\s)(?:${labels})\\s*:\\s*([^.;]{3,${maximum}})(?:[.;]|$)`,
    "giu",
  );
  const seen = new Set<string>();
  return [...text.matchAll(pattern)].flatMap((match) => {
    if (screen02IdentityLabelIsQualified(text, match.index ?? 0)) return [];
    const value = match[1]?.replace(/\s+/gu, " ").trim().slice(0, maximum);
    const identity = normalizedAuditIdentityText(value);
    if (!value || !identity || seen.has(identity)) return [];
    seen.add(identity);
    return [value];
  }).slice(0, 8);
}

const SCREEN02_INSTITUTION_ALIASES = new Map<string, string>([
  ["ftc", "federal trade commission"],
  ["ferc", "federal energy regulatory commission"],
  ["fcc", "federal communications commission"],
  ["epa", "environmental protection agency"],
  ["sec", "securities and exchange commission"],
  ["u s sec", "securities and exchange commission"],
  ["united states sec", "securities and exchange commission"],
]);

function screen02InstitutionBase(value: string) {
  return normalizedAuditIdentityText(value)
    .replace(/\b(?:u s(?: a)?|us|usa|united states of america)\b/gu, "united states")
    .replace(/\b(?:u k|uk|great britain)\b/gu, "united kingdom")
    .replace(/\b(?:e u|eu)\b/gu, "european union")
    .replace(/\bthe\b/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function screen02CanonicalInstitution(value: string) {
  const base = screen02InstitutionBase(value);
  const direct = SCREEN02_INSTITUTION_ALIASES.get(base);
  if (direct) return direct;
  const withoutCountry = base.startsWith("united states ")
    ? base.slice("united states ".length)
    : "";
  if (withoutCountry) {
    const countryAlias = SCREEN02_INSTITUTION_ALIASES.get(withoutCountry);
    if (countryAlias) return countryAlias;
    if ([...SCREEN02_INSTITUTION_ALIASES.values()].includes(withoutCountry)) {
      return withoutCountry;
    }
  }
  const suffixTerms = (withoutCountry || base).split(" ");
  const suffix = suffixTerms.at(-1) ?? "";
  const suffixCanonical = SCREEN02_INSTITUTION_ALIASES.get(suffix);
  const withoutSuffix = suffixTerms.slice(0, -1).join(" ");
  if (suffixCanonical && (
    withoutSuffix === suffixCanonical ||
    SCREEN02_INSTITUTION_ALIASES.get(withoutSuffix) === suffixCanonical
  )) return suffixCanonical;
  return base;
}

function screen02CompatibleInstitution(
  expected: string | null | undefined,
  observed: string | null | undefined,
) {
  if (!expected || !observed) return true;
  const left = screen02CanonicalInstitution(expected);
  const right = screen02CanonicalInstitution(observed);
  return Boolean(left && right && left === right);
}

function screen02RemoveLiteralIgnoringCase(value: string, literal: string) {
  if (!literal) return value;
  const needle = literal.toLocaleLowerCase("en-US");
  let result = value.trimStart();
  for (let repeats = 0;
    repeats < 4 && result.toLocaleLowerCase("en-US").startsWith(needle);
    repeats += 1) {
    result = result.slice(literal.length).trimStart();
  }
  return result;
}

function screen02OfficialSentences(text: string) {
  const sentences: string[] = [];
  let start = 0;
  for (const boundary of text.matchAll(/[.!?]\s+/gu)) {
    const end = (boundary.index ?? 0) + 1;
    const sentence = text.slice(start, end).trim();
    if (boundary[0].startsWith(".") &&
      /(?:\b(?:dept|e\.u|inc|ltd|no|u\.k|u\.s)\.|(?:\b[A-Z]\.){2,})$/iu
        .test(sentence)) continue;
    if (sentence) sentences.push(sentence);
    start = (boundary.index ?? 0) + boundary[0].length;
  }
  const tail = text.slice(start).trim();
  if (tail) sentences.push(tail);
  return sentences;
}

function screen02VisibleTextHasAffirmativeIssuingActor(
  text: string,
  institution: string | null | undefined,
  contentTitle: string | null,
  targetNames: readonly (string | null | undefined)[],
) {
  if (!institution) return false;
  const canonical = screen02CanonicalInstitution(institution);
  const names = new Set([
    screen02InstitutionBase(institution),
    canonical,
    ...[...SCREEN02_INSTITUTION_ALIASES.entries()].flatMap(([alias, target]) =>
      target === canonical ? [alias] : []
    ),
  ]);
  const withoutTitle = contentTitle
    ? screen02RemoveLiteralIgnoringCase(text, contentTitle)
    : text;
  const normalizedTargets = targetNames.map(normalizedAuditIdentityText)
    .filter((target) => target.length >= 8);
  const targetFormalIdentifiers = new Set(targetNames.flatMap((target) =>
    screen02OfficialFormalIdentifiers(target ?? "")
      .map(normalizedAuditFormalIdentifier)
  ));
  return screen02OfficialSentences(withoutTitle).some((sentence) => {
    // Institution normalization removes articles and country abbreviations;
    // applying it to the whole sentence would also mutate the legal title.
    const normalized = normalizedAuditIdentityText(sentence)
      .replace(/^the\s+/u, "");
    return [...names].some((name) => {
      if (name.length < 3) return false;
      const actor = new RegExp(
        `^${name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\s+` +
          "(?:approved|issued|adopted|promulgated)\\s+(.+)$",
        "u",
      ).exec(normalized);
      const object = actor?.[1]?.trim() ?? "";
      if (!object ||
        /^(?:comments?|remarks?|testimony|(?:a\s+)?(?:staff\s+)?reports?|background|guidance|recommendations?)\b/u
          .test(object) ||
        /\b(?:instead|rather\s+than)\b/u.test(object) ||
        /^(?:an?\s+)?(?:amendment|repeal|replacement|revocation|rescission)\s+of\b/u
          .test(object)) return false;
      const competingFormalIdentifier = screen02OfficialFormalIdentifiers(
        object,
      ).map(normalizedAuditFormalIdentifier).some((identifier) =>
        !targetFormalIdentifiers.has(identifier)
      );
      if (competingFormalIdentifier) return false;
      const targetObject = object.replace(/^(?:a|an|this)\s+/u, "");
      return normalizedTargets.some((target) => {
        if (targetObject === target) return true;
        if (!targetObject.startsWith(`${target} `)) return false;
        const suffix = targetObject.slice(target.length + 1);
        return /^(?:after|as|for|on|upon|with)\b/u.test(suffix) &&
          !/\b(?:amendment|comments?|consultation|draft|faq|guidance|notice|press|proposal|proposed|publication|release|repeal|replacement|reports?|rescission|revocation|testimony)\b/u
            .test(suffix);
      }) || Boolean(
        contentTitle && targetNames.some((target) =>
          screen02EquivalentTitle(contentTitle, target)
        ) && (() => {
          const ignored = new Set([
            "adopt", "adopted", "approv", "approved", "approves",
            "change", "changes", "commission", "federal", "final",
            "finalized", "ftc", "issued", "modification", "modifications",
            "the", "to", "trade",
          ]);
          const terms = (value: string) => new Set(
            normalizedAuditIdentityText(value).split(" ").filter((term) =>
              term.length >= 4 && !ignored.has(term)
            ),
          );
          const objectTerms = terms(object);
          return targetNames.some((target) => {
            const targetTerms = terms(target ?? "");
            let overlap = 0;
            for (const term of targetTerms) {
              if (objectTerms.has(term)) overlap += 1;
            }
            return overlap >= 4 &&
              overlap / Math.min(targetTerms.size, objectTerms.size) >= 0.5;
          });
        })()
      );
    });
  });
}

function screen02HostOfficialAuthority(document: Screen02OverviewDocument) {
  const parsed = new URL(document.locator);
  const descriptor = `${parsed.pathname} ${document.contentTitle ?? ""}`;
  const explanatory = SCREEN02_OFFICIAL_EXPLANATORY_LINK.test(descriptor);
  const primaryPath = SCREEN02_OFFICIAL_PRIMARY_PATH.test(parsed.pathname) ||
    parsed.searchParams.has("lawCode") ||
    parsed.searchParams.has("bill_id") ||
    /(?:^|:)CELEX:/iu.test(parsed.searchParams.get("uri") ?? "");
  const controllingContent = SCREEN02_OFFICIAL_LEGAL_INSTRUMENT.test(
    document.evidenceText,
  ) && SCREEN02_OFFICIAL_CONTROLLING_LANGUAGE.test(document.evidenceText);
  if (!explanatory && primaryPath && controllingContent) {
    return {
      authorityTier: 1 as const,
      reason:
        "Fixed document-path and content rules identify an allowlisted official controlling legal record; exact operative effect still requires Screen 3 passage verification.",
    };
  }
  return {
    authorityTier: 2 as const,
    reason:
      "Fixed document-path and content rules identify official explanatory or non-controlling material; the page was not promoted to a controlling primary record.",
  };
}

function screen02HostOfficialSource(
  document: Screen02OverviewDocument,
  candidateId: string,
  retrievedAt: string,
): Screen02Source {
  const authority = screen02HostOfficialAuthority(document);
  const locator = sanitizeScreen02AcquisitionUrl(document.locator);
  if (!locator) {
    throw new Error("A verified official source requires a sanitized HTTPS locator.");
  }
  const sourceVersion = fingerprintScreen02WorkflowValue({
    locator,
    contentFingerprint: document.contentFingerprint,
  }).replace(/[^a-z0-9]/giu, "").slice(-20);
  return {
    id: `host-official-source-${candidateId.slice(0, 120)}-${sourceVersion}`
      .slice(0, 200),
    title: (document.contentTitle ?? document.title).slice(0, 500),
    locator,
    publisher: document.publisher.slice(0, 240),
    publishedDate: document.publishedDate,
    authorityTier: authority.authorityTier,
    authorityAssessment: {
      method: "system-domain-rule",
      reason: authority.reason,
      policyVersion: SCREEN_02_SOURCE_POLICY_VERSION,
    },
    channel: "host-proposed-official-source-verified",
    retrievedAt,
    evidenceText: document.evidenceText,
  };
}

function screen02ProposalFromUnboundOfficialDocument(
  document: Screen02OverviewDocument,
  retrievedAt: string,
): Screen02FindProposal | null {
  if (screen02OfficialTitleHasRelationshipSibling(document.contentTitle)) {
    return null;
  }
  const title = screen02OfficialEventTitle(document);
  if (!title || !document.overview) return null;
  const formalEvidence = screen02ResponseOwnFormalIdentifierEvidence(document);
  if (formalEvidence.conflict) return null;
  const formalIdentifiers = formalEvidence.identifiers;
  // An unbound page that presents multiple distinct legal-record identities
  // cannot safely create one candidate merely because the first happens to
  // look formal.
  if (formalIdentifiers.length > 1) return null;
  const formalIdentifier = formalIdentifiers[0] ?? null;
  const nativeRecordIdentifier = document.nativeIdentity?.recordId ??
    document.sourceRecordIdentifier ?? null;
  const status = screen02OfficialOperativeStatus(document.evidenceText);
  const labeledOperativeDate = screen02OfficialLabeledOperativeDate(document);
  // A proposal, draft, or introduced bill is not an operative event. Every
  // unbound page may create a candidate only when fetched visible text
  // establishes both enacted/adopted/in-force status and a specifically
  // labelled effective or operative date. Publication and introduction dates
  // do not satisfy this gate.
  if (!status || !labeledOperativeDate ||
    (!formalIdentifier && !nativeRecordIdentifier)) return null;
  const eventDate = labeledOperativeDate;
  const affectedPopulation = screen02OverviewAffectedPopulation(
    document.overview,
  );
  if (
    !SCREEN02_OFFICIAL_CONTROLLING_LANGUAGE.test(document.overview) ||
    (!formalIdentifier && !eventDate && !affectedPopulation)
  ) return null;
  const issuer = screen02OfficialLabeledFact(
    document.evidenceText,
    "(?:agency|issuing (?:authority|body)|issuer)",
  );
  const issuingJurisdiction = screen02OfficialLabeledFact(
    document.evidenceText,
    "jurisdiction",
  );
  const identityFingerprint = fingerprintScreen02WorkflowValue({
    title: normalizedAuditIdentityText(title),
    formalIdentifier: normalizedAuditIdentityText(formalIdentifier),
    issuer: normalizedAuditIdentityText(issuer),
    issuingJurisdiction: normalizedAuditIdentityText(issuingJurisdiction),
    nativeRecordIdentifier,
    sourceLocator: sanitizeScreen02AcquisitionUrl(document.locator),
    operativeDate: eventDate,
    lifecycleStatus: status,
  }).replace(/[^a-z0-9]/giu, "").slice(-20);
  const candidateId = `host-official-event-${identityFingerprint}`;
  const source = screen02HostOfficialSource(document, candidateId, retrievedAt);
  const acronym = title.match(/\(([A-Z][A-Z0-9-]{1,11})\)/u)?.[1] ?? null;
  return {
    id: candidateId,
    mode: "find",
    kind: "event",
    title,
    description: document.overview,
    nativeIdentity: {
      formalIdentifier,
      issuer,
      issuingJurisdiction,
      status,
    },
    event: {
      displayName: title,
      eventDate: eventDate ?? "",
      eventFamily: "Regulation",
      geographies: issuingJurisdiction ? [issuingJurisdiction] : [],
      populations: affectedPopulation
        ? [affectedPopulation]
        : [SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN],
    },
    sources: [source],
    origin: "newly-discovered",
    provisionalDates: eventDate ? [eventDate] : [],
    affectedPopulation:
      affectedPopulation || SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
    requiredVariables: [
      "Organization-to-covered-entity linkage",
      "Applicable eligibility or threshold indicator",
      "Verified operative-date indicator",
    ],
    outcomeLink: {
      text:
        "The retrieved official text establishes a provisional event lead only; a candidate-specific outcome pathway still requires source-backed investigation.",
      status: "system-template",
    },
    likelyServiceLevel: "event-reconnaissance",
    limitations: [
      "Fixed parsing supplies a provisional identity and orientation; Screen 3 must verify controlling passages, exact dates, amendments, and organization-level coverage.",
    ],
    reasons: [
      "Fixed software derived this identity and preliminary facts from bounded visible content retrieved from the proposed official URL; host-supplied metadata was not used as evidence.",
      ...(acronym ? [`The retrieved document title includes the acronym ${acronym}.`] : []),
    ],
  };
}

/**
 * Retrieves host-proposed URLs only through the fixed official-source
 * allowlist. Host titles, issuers, and jurisdictions remain untrusted search
 * hints. A bound lead must match an exact current candidate. An unbound lead
 * can enter the raw pool only when fixed parsing derives its event identity
 * and preliminary facts from the fetched visible content itself.
 */
export async function retrieveScreen02HostOfficialSourceLeads(
  env: ShockAuditEnv,
  state: Screen02FindState,
  leads: readonly Screen02PoolHostOfficialSourceLead[],
  retrievedAt: string,
  runtime: Screen02SubstantiveEnrichmentRuntime =
    createScreen02SubstantiveEnrichmentRuntime(),
  indexOffset = 0,
): Promise<Screen02HostOfficialSourceLeadResolution[]> {
  const boundedLeads = leads.slice(0, 8);
  return Promise.all(boundedLeads.map(async (lead, index) => {
    const leadId = screen02HostOfficialLeadId(lead, index + indexOffset);
    const leadFingerprint = fingerprintScreen02WorkflowValue({
      schemaVersion: "screen-02-host-official-source-lead-v1",
      lead,
    });
    const safeLocator = screen02OfficialOverviewUrl(lead.url);
    if (!safeLocator) {
      return {
        leadId,
        leadFingerprint,
        contentFingerprint: null,
        url: sanitizeScreen02AcquisitionUrl(lead.url) ??
          "Rejected unsafe official URL",
        candidateId: lead.candidateIdIfKnown,
        status: "rejected" as const,
        retrieved: false,
        reason:
          "The proposed URL is outside the bounded credential-free official HTTPS allowlist.",
        source: null,
        overview: null,
        proposal: null,
      };
    }
    const referencedCandidate = lead.candidateIdIfKnown
      ? state.candidates.find((item) =>
          item.candidateSnapshotId === lead.candidateIdIfKnown)
      : undefined;
    const acquisitionCandidateId = referencedCandidate?.candidateId ?? leadId;
    try {
      const document = await acquireScreen02OverviewDocument(
        runtime,
        {
          candidateId: acquisitionCandidateId,
          sourceId: null,
          sourceCacheKey: leadFingerprint,
          level: "host-official",
          locator: safeLocator,
        },
        screen02DocumentFetch(env),
        {
          maximumAttempts: SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_DOCUMENT_FETCHES,
          ...(!env.CONNECTOR_FETCH &&
              screen02OfficialOverviewOriginFamily(safeLocator) === "ftc"
            ? { beforeRequest: scheduleScreen02FtcLiveRequestStart }
            : {}),
        },
      );
      const diagnosticUrl = sanitizeScreen02AcquisitionUrl(document.locator) ??
        sanitizeScreen02AcquisitionUrl(safeLocator)!;
      if (!document.overview) {
        return {
          leadId,
          leadFingerprint,
          contentFingerprint: document.contentFingerprint,
          url: diagnosticUrl,
          candidateId: lead.candidateIdIfKnown,
          status: "rejected" as const,
          retrieved: true,
          reason:
            "The official response did not contain bounded substantive text that fixed software could use.",
          source: null,
          overview: null,
          proposal: null,
        };
      }
      if (!lead.candidateIdIfKnown) {
        const proposal = screen02ProposalFromUnboundOfficialDocument(
          document,
          retrievedAt,
        );
        if (proposal) {
          screen02RebindDocumentAcquisition(
            runtime,
            document.acquisitionId,
            proposal.id,
            proposal.sources[0]?.id ?? null,
          );
          return {
            leadId,
            leadFingerprint,
            contentFingerprint: document.contentFingerprint,
            url: diagnosticUrl,
            candidateId: proposal.id,
            status: "verified" as const,
            retrieved: true,
            reason:
              "Fixed software derived a provisional event identity and facts from bounded visible official content; the ordinary deduplication and qualification pipeline decides whether it is retained.",
            source: proposal.sources[0]!,
            overview: document.overview,
            proposal,
          };
        }
        return {
          leadId,
          leadFingerprint,
          contentFingerprint: document.contentFingerprint,
          url: diagnosticUrl,
          candidateId: null,
          status: "rejected" as const,
          retrieved: true,
          reason:
            "The official page was retrieved, but fixed parsing could not derive a bounded legal-event identity and facts from visible content; host metadata alone cannot create a candidate.",
          source: null,
          overview: null,
          proposal: null,
        };
      }
      // The host task exposes the immutable snapshot id as its candidate
      // handle. It was resolved before transport so even the acquisition
      // trace is bound to the canonical candidate rather than untrusted host
      // metadata.
      const candidate = referencedCandidate;
      if (!candidate ||
        !screen02HostLeadMatchesCandidate(state, candidate, document)) {
        return {
          leadId,
          leadFingerprint,
          contentFingerprint: document.contentFingerprint,
          url: diagnosticUrl,
          candidateId: lead.candidateIdIfKnown,
          status: "rejected" as const,
          retrieved: true,
          reason:
            "The retrieved official content did not establish the exact identity of the referenced current candidate.",
          source: null,
          overview: null,
          proposal: null,
        };
      }
      const source = screen02HostOfficialSource(
        document,
        candidate.candidateId,
        retrievedAt,
      );
      screen02RebindDocumentAcquisition(
        runtime,
        document.acquisitionId,
        candidate.candidateId,
        source.id,
      );
      return {
        leadId,
        leadFingerprint,
        contentFingerprint: document.contentFingerprint,
        url: diagnosticUrl,
        candidateId: candidate.candidateId,
        status: "verified" as const,
        retrieved: true,
        reason:
          "Fixed software retrieved the official page and matched its content to the exact current candidate identity.",
        source,
        overview: document.overview,
        proposal: null,
      };
    } catch (error) {
      return {
        leadId,
        leadFingerprint,
        contentFingerprint: null,
        url: sanitizeScreen02AcquisitionUrl(safeLocator) ??
          "Rejected unsafe official URL",
        candidateId: lead.candidateIdIfKnown,
        status: "rejected" as const,
        retrieved: false,
        reason: `The proposed official source could not be verified: ${
          sanitizeScreen02AcquisitionFailureReason(
            error instanceof Error ? error.message : "unknown failure",
          )
        }`,
        source: null,
        overview: null,
        proposal: null,
      };
    }
  }));
}

function screen02OverviewAffectedPopulation(overview: string) {
  return overview
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.replace(/\s+/gu, " ").trim())
    .find((sentence) =>
      /\b(?:firms?|companies|business(?:es)?|organizations?|enterprises?|providers?|publishers?|developers?|controllers?|processors?|establishments?|facilities|users?|consumers?|employees?|assistants?)\b/i.test(
        sentence,
      ),
    )?.slice(0, 900) ?? "";
}

function screen02NeedsPopulationEnrichment(proposal: Screen02FindProposal) {
  const population = [
    ...proposal.event.populations,
    proposal.affectedPopulation,
  ].join(" ");
  return !population.trim() ||
    /\b(?:unknown|unverified|not established|applicability (?:is )?provisional|coverage (?:is )?provisional)\b/i.test(
      population,
    );
}

function screen02OfficialExplanationSource(
  proposal: Screen02FindProposal,
  locator: string,
  retrievedAt: string,
  contentFingerprint?: string,
): Screen02Source {
  const persistedLocator = sanitizeScreen02AcquisitionUrl(locator);
  if (!persistedLocator) {
    throw new Error("An official explanation source requires a sanitized HTTPS locator.");
  }
  const existing = proposal.sources.find(
    (source) => screen02OfficialOverviewUrl(source.locator) === locator,
  );
  if (existing) return { ...existing, locator: persistedLocator };
  const host = new URL(locator).hostname.toLowerCase();
  const suffix = fingerprintScreen02WorkflowValue({
    locator: persistedLocator,
    contentFingerprint: contentFingerprint ?? null,
  })
    .replace(/[^a-z0-9]/gi, "")
    .slice(-16);
  return {
    id: `${proposal.id.slice(0, 160)}-official-explainer-${suffix}`,
    title: `Official explanatory material for ${proposal.title}`.slice(0, 500),
    locator: persistedLocator,
    publisher: host,
    publishedDate: null,
    authorityTier: 2,
    authorityAssessment: {
      method: "system-domain-rule",
      reason:
        "A bounded Level 3 follow-up was linked from or attached to an allowlisted official source.",
      policyVersion: SCREEN_02_SOURCE_POLICY_VERSION,
    },
    channel: "official-explanatory-material",
    retrievedAt,
  };
}

export function screen02RedirectedOverviewMatchesProposal(
  proposal: Screen02FindProposal,
  requestedLocator: string,
  document: Screen02OverviewDocument,
) {
  if (document.nativeIdentityConflict) return false;
  const requested = screen02OfficialOverviewUrl(requestedLocator);
  const final = screen02OfficialOverviewUrl(document.locator);

  const native = document.nativeIdentity;
  if (native) {
    const requestedId = screen02CelexLocatorId(requestedLocator) ??
      screen02UkLegislationLocatorId(requestedLocator);
    const finalId = screen02CelexLocatorId(document.locator) ??
      screen02UkLegislationLocatorId(document.locator);
    const identityTitle = normalizedAuditTitleIdentity(native.title);
    const proposalNames = [proposal.title, proposal.event.displayName].map(
      normalizedAuditTitleIdentity,
    );
    // A returned record with conflicting native identity fails even if its
    // body happens to mention the requested event or contains a familiar name.
    if (requestedId !== native.recordId || finalId !== native.recordId) return false;
    const formal = proposal.nativeIdentity?.formalIdentifier;
    if (formal && formal !== native.recordId &&
      !screen02FormalIdentifiersCompatible(formal, native.formalIdentifier)) {
      return false;
    }
    return proposalNames.some((name) => name.length >= 8 &&
      (identityTitle === name || identityTitle.startsWith(name + " ") ||
       identityTitle.endsWith(" " + name) || identityTitle.includes(" " + name + " ")));
  }

  // Federal Register document numbers and legal-instrument identifiers such
  // as “Order No. 841” occupy different namespaces. Bind the response-native
  // FR Doc coordinate before considering generic legal identifiers.
  const proposalFederalRegisterId =
    /^(\d{4}-\d{4,6})$/u.exec(
      proposal.nativeIdentity?.formalIdentifier?.trim() ?? "",
    )?.[1] ?? null;
  const requestedFederalRegisterId = /^(\d{4}-\d{4,6})$/u.exec(
    screen02FederalRegisterDocumentNumberFromLocator(requestedLocator) ?? "",
  )?.[1] ?? null;
  const finalFederalRegisterId = /^(\d{4}-\d{4,6})$/u.exec(
    screen02FederalRegisterDocumentNumberFromLocator(document.locator) ?? "",
  )?.[1] ?? null;
  if (
    proposalFederalRegisterId ||
    requestedFederalRegisterId ||
    finalFederalRegisterId
  ) {
    return Boolean(
      proposalFederalRegisterId &&
      requestedFederalRegisterId === proposalFederalRegisterId &&
      finalFederalRegisterId === proposalFederalRegisterId &&
      document.sourceRecordIdentifier === proposalFederalRegisterId &&
      screen02ExactBoundTitle(
        document,
        [proposal.title, proposal.event.displayName],
        proposal.nativeIdentity?.issuer,
      ),
    );
  }

  const proposalFormalIdentifier = normalizedAuditFormalIdentifier(
    proposal.nativeIdentity?.formalIdentifier,
  );
  const responseFormalEvidence = screen02ResponseOwnFormalIdentifierEvidence(
    document,
  );
  const responseFormalIdentifiers = responseFormalEvidence.identifiers;
  if (responseFormalEvidence.conflict ||
    new Set(responseFormalIdentifiers).size > 1) return false;
  if (proposalFormalIdentifier && responseFormalIdentifiers.some(
    (identifier) => !screen02FormalIdentifiersCompatible(
      identifier,
      proposal.nativeIdentity?.formalIdentifier,
    ),
  )) return false;

  const responseIssuers = screen02OfficialLabeledFacts(
    document.evidenceText,
    "(?:agency|issuing (?:authority|body)|issuer)",
  );
  const responseJurisdictions = screen02OfficialLabeledFacts(
    document.evidenceText,
    "jurisdiction",
  );
  if (proposal.nativeIdentity?.issuer && responseIssuers.some((issuer) =>
    !screen02CompatibleInstitution(proposal.nativeIdentity?.issuer, issuer)
  )) return false;
  if (proposal.nativeIdentity?.issuingJurisdiction &&
    responseJurisdictions.some((jurisdiction) =>
      !screen02CompatibleInstitution(
        proposal.nativeIdentity?.issuingJurisdiction,
        jurisdiction,
      )
    )) return false;
  const responseFormalMatch = Boolean(
    proposalFormalIdentifier && responseFormalIdentifiers.length > 0 &&
    responseFormalIdentifiers.every((identifier) =>
      screen02FormalIdentifiersCompatible(
        identifier,
        proposal.nativeIdentity?.formalIdentifier,
      )
    ),
  );
  const responseIssuerMatch = Boolean(
    proposal.nativeIdentity?.issuer && (
      responseIssuers.length > 0 && responseIssuers.every((issuer) =>
        screen02CompatibleInstitution(proposal.nativeIdentity?.issuer, issuer)
      ) || screen02VisibleTextHasAffirmativeIssuingActor(
        document.evidenceText,
        proposal.nativeIdentity.issuer,
        document.contentTitle,
        [
          proposal.title,
          proposal.event.displayName,
          proposal.nativeIdentity.formalIdentifier,
        ],
      )
    ),
  );

  // An official-domain allowlist and a same-URL response are transport
  // boundaries, not identity boundaries. Bind every fetched response using
  // its own exact derived title or a sufficiently specific formal identifier.
  // Body references alone are insufficient because record B may mention A.
  const responseTitleSegments = screen02OfficialTitleSegments(
    document.contentTitle,
  ).filter((value) => value.length >= 8);
  const documentTitle = screen02OfficialEventTitle(document);
  const normalizedRequestedLocator = normalizedAuditIdentityText(
    requestedLocator,
  );
  const normalizedFinalLocator = normalizedAuditIdentityText(document.locator);
  const exactTitleMatch = screen02ExactBoundTitle(
    document,
    [proposal.title, proposal.event.displayName],
    proposal.nativeIdentity?.issuer,
  );
  // A title can be repeated by an index, explainer, or unrelated instrument.
  // Bind it only alongside an independently observed exact identifier or
  // issuing institution; an allowlisted host/locator is a transport boundary.
  if (exactTitleMatch && (responseFormalMatch || responseIssuerMatch)) {
    return true;
  }

  // A response-native title is stronger identity evidence than a body
  // cross-reference. If the page exposes a distinct legal-document title,
  // do not let an incidental mention of this proposal's identifier override
  // that contradictory identity.
  if (documentTitle || responseTitleSegments.length > 0) return false;

  // Some official responses expose a formal identifier but no usable title.
  // Accept that route only when the fixed response parser extracts the exact
  // proposal identifier. For redirects it must additionally survive both URL
  // boundaries. A loose body substring or containing title is never enough.
  const formalIdentifier = proposalFormalIdentifier;
  const responseFormalIdentifier = responseFormalIdentifiers.length === 1
    ? normalizedAuditFormalIdentifier(responseFormalIdentifiers[0])
    : "";
  if (
    formalIdentifier.length < 8 ||
    !screen02FormalIdentifiersEquivalent(
      responseFormalIdentifiers[0],
      proposal.nativeIdentity?.formalIdentifier,
    )
  ) return false;
  if (requested && final && requested === final) return true;
  return normalizedRequestedLocator.includes(formalIdentifier) &&
    normalizedFinalLocator.includes(formalIdentifier);
}

function screen02RedirectedOfficialDocumentSource(
  proposal: Screen02FindProposal,
  document: Screen02OverviewDocument,
  retrievedAt: string,
): Screen02Source {
  const authority = screen02HostOfficialAuthority(document);
  const locator = sanitizeScreen02AcquisitionUrl(document.locator);
  if (!locator) {
    throw new Error("A redirected official source requires a sanitized HTTPS locator.");
  }
  const sourceVersion = fingerprintScreen02WorkflowValue({
    locator,
    contentFingerprint: document.contentFingerprint,
  }).replace(/[^a-z0-9]/giu, "").slice(-20);
  return {
    id: `${proposal.id.slice(0, 150)}-official-document-${sourceVersion}`
      .slice(0, 200),
    title: document.title.slice(0, 500),
    locator,
    publisher: document.publisher.slice(0, 240),
    publishedDate: document.publishedDate,
    authorityTier: authority.authorityTier,
    authorityAssessment: {
      method: "system-domain-rule",
      reason:
        "A bounded official-document redirect was bound to this candidate from the final response's own identity; this content-addressed source records the final locator and response bytes.",
      policyVersion: SCREEN_02_SOURCE_POLICY_VERSION,
    },
    channel: "official-document-redirect-verified",
    retrievedAt,
    evidenceText: document.evidenceText,
  };
}

function screen02OfficialPrimaryReferenceSource(
  proposal: Screen02FindProposal,
  reference: Screen02OfficialPrimaryReference,
  retrievedAt: string,
): Screen02Source {
  const locator = sanitizeScreen02AcquisitionUrl(reference.locator);
  if (
    !locator ||
    screen02OfficialOverviewOriginFamily(locator) !== "ftc" ||
    !screen02OverviewLocatorIsStaticPdf(locator)
  ) {
    throw new Error("An FTC primary reference requires a sanitized official PDF locator.");
  }
  const suffix = fingerprintScreen02WorkflowValue({ locator })
    .replace(/[^a-z0-9]/giu, "")
    .slice(-20);
  return {
    id: `${proposal.id.slice(0, 150)}-official-primary-reference-${suffix}`
      .slice(0, 200),
    title: reference.title.slice(0, 500),
    locator,
    publisher: "Federal Trade Commission",
    publishedDate: null,
    authorityTier: 1,
    authorityAssessment: {
      method: "system-domain-rule",
      reason:
        "The fetched FTC page visibly linked and labeled an FTC Commission approval letter. Screen 2 retained only the controlling-record locator and did not retrieve or treat the PDF body as evidence.",
      policyVersion: SCREEN_02_SOURCE_POLICY_VERSION,
    },
    channel: "official-controlling-primary-reference-unparsed",
    retrievedAt,
  };
}

function screen02ApplyFetchedOfficialOverview(
  proposal: Screen02FindProposal,
  requestedLocator: string,
  document: Screen02OverviewDocument,
  input: {
    level: 2 | 3;
    retrievedAt: string;
  },
) {
  if (
    !screen02RedirectedOverviewMatchesProposal(
      proposal,
      requestedLocator,
      document,
    )
  ) {
    throw new Error(
      "The overview redirect destination did not establish the same record identity.",
    );
  }
  const requested = screen02OfficialOverviewUrl(requestedLocator);
  const final = screen02OfficialOverviewUrl(document.locator);
  const redirected = Boolean(requested && final && requested !== final);
  const proposalWithFinalSource = input.level === 2 && redirected &&
      !proposal.sources.some((source) =>
        screen02OfficialOverviewUrl(source.locator) === final
      )
    ? {
        ...proposal,
        sources: [
          ...proposal.sources,
          screen02RedirectedOfficialDocumentSource(
            proposal,
            document,
            input.retrievedAt,
          ),
        ],
      }
    : proposal;
  const primaryReferences = input.level === 2
    ? document.primaryReferences.filter((reference) =>
        !proposalWithFinalSource.sources.some((source) =>
          screen02OfficialOverviewUrl(source.locator) === reference.locator
        )
      )
    : [];
  const proposalWithPrimaryReferences = primaryReferences.length > 0
    ? {
        ...proposalWithFinalSource,
        sources: [
          ...proposalWithFinalSource.sources,
          ...primaryReferences.map((reference) =>
            screen02OfficialPrimaryReferenceSource(
              proposalWithFinalSource,
              reference,
              input.retrievedAt,
            )
          ),
        ],
        limitations: [
          ...new Set([
            ...proposalWithFinalSource.limitations,
            "The controlling primary record is a PDF. Screen 2 retained its official locator but did not retrieve or parse its body, and no PDF passage was used for qualification. Screen 3 must verify exact passages.",
          ]),
        ],
        reasons: [
          ...proposalWithFinalSource.reasons,
          "The fetched FTC announcement visibly linked the Commission approval letter retained as the controlling-primary reference.",
        ],
      } satisfies Screen02FindProposal
    : proposalWithFinalSource;
  return screen02ApplyOfficialOverview(
    proposalWithPrimaryReferences,
    document.overview,
    {
      level: input.level,
      locator: document.locator,
      retrievedAt: input.retrievedAt,
      evidenceText: document.evidenceText,
      contentFingerprint: document.contentFingerprint,
    },
  );
}

function screen02ApplyOfficialOverview(
  proposal: Screen02FindProposal,
  overview: string,
  input: {
    level: 2 | 3;
    locator: string;
    retrievedAt: string;
    evidenceText: string;
    contentFingerprint?: string;
  },
) {
  const normalizedLocator = screen02OfficialOverviewUrl(input.locator);
  const reviewedRegistryProposal = SCREEN02_DISCOVERY_EVENT_REGISTRY.find(
    (candidate) => candidate.id === proposal.id,
  );
  const sourcesWithEvidence = proposal.sources.map((source) => {
    const reviewedRegistrySource = reviewedRegistryProposal?.sources.find(
      (candidate) =>
        candidate.id === source.id &&
        screen02OfficialOverviewUrl(candidate.locator) ===
          screen02OfficialOverviewUrl(source.locator),
    );
    return normalizedLocator &&
        screen02OfficialOverviewUrl(source.locator) === normalizedLocator
      ? {
          ...source,
          // A reviewed registry locator is fixed application provenance and
          // may need a public identity query such as California's bill_id.
          // Fresh or host-derived locators remain query-free, and every
          // acquisition record separately keeps its diagnostic URL redacted.
          locator: reviewedRegistrySource
            ? screen02OfficialOverviewUrl(reviewedRegistrySource.locator) ??
              sanitizeScreen02AcquisitionUrl(input.locator)!
            : sanitizeScreen02AcquisitionUrl(source.locator) ??
              sanitizeScreen02AcquisitionUrl(input.locator)!,
          // Both strings come from bounded official responses for the same
          // locator: the connector listing and the subsequently fetched page.
          // Preserve the listing's identity-bearing evidence when adding the
          // body instead of replacing it with a body that may omit its title.
          evidenceText: [...new Set([
            source.evidenceText?.trim() ?? "",
            input.evidenceText.trim(),
          ].filter(Boolean))].join(" ").slice(0, 12_000).trim(),
        }
      : source;
  });
  const baseProposal = {
    ...proposal,
    sources: sourcesWithEvidence,
  } satisfies Screen02FindProposal;
  if (!overview) return baseProposal;
  const affectedPopulation = screen02OverviewAffectedPopulation(overview);
  const needsPopulation = screen02NeedsPopulationEnrichment(proposal);
  const explanationSource = input.level === 3
    ? (() => {
        const source = screen02OfficialExplanationSource(
          baseProposal,
          input.locator,
          input.retrievedAt,
          input.contentFingerprint,
        );
        return {
          ...source,
          evidenceText: [...new Set([
            source.evidenceText?.trim() ?? "",
            input.evidenceText.trim(),
          ].filter(Boolean))].join(" ").slice(0, 12_000).trim(),
        };
      })()
    : null;
  const sources = explanationSource
    ? sourcesWithEvidence.some((source) => source.id === explanationSource.id)
      ? sourcesWithEvidence.map((source) =>
          source.id === explanationSource.id ? explanationSource : source
        )
      : [...sourcesWithEvidence, explanationSource]
    : sourcesWithEvidence;
  return {
    ...baseProposal,
    description: `${proposal.description} ${overview}`
      .replace(/\s+/gu, " ")
      .trim()
      .slice(0, 3_000),
    event: needsPopulation && affectedPopulation
      ? {
          ...proposal.event,
          populations: [affectedPopulation],
        }
      : proposal.event,
    affectedPopulation:
      needsPopulation && affectedPopulation
        ? affectedPopulation
        : proposal.affectedPopulation,
    sources,
    limitations: [
      ...new Set([
        ...proposal.limitations,
        "The Screen 2 overview is preliminary; Screen 3 must verify exact coverage, operative timing, and amendments from the official record.",
      ]),
    ],
    reasons: [
      ...proposal.reasons,
      input.level === 2
        ? "A bounded full-authoritative-document retrieval supplied the substantive Screen 2 orientation."
        : "A bounded official explanatory-material retrieval supplied the substantive Screen 2 orientation.",
    ],
  } satisfies Screen02FindProposal;
}

function screen02HostLeadBaseProposal(
  state: Screen02FindState,
  candidate: Screen02FindState["candidates"][number],
): Screen02FindProposal {
  const sourceById = new Map(state.sources.map((source) => [source.id, source]));
  const sources = candidate.sourceIds.flatMap((sourceId) => {
    const source = sourceById.get(sourceId);
    if (!source) return [];
    return [{
      id: source.id,
      title: source.title,
      locator: source.locator,
      publisher: source.publisher,
      publishedDate: source.publishedDate,
      authorityTier: source.authorityTier,
      channel: source.channel,
      retrievedAt: source.retrievedAt,
      ...(source.evidenceText ? { evidenceText: source.evidenceText } : {}),
    } satisfies Screen02Source];
  });
  const populations = candidate.broadCoverage.map((claim) => claim.text);
  return {
    id: candidate.candidateId,
    mode: "find",
    kind: "event",
    title: candidate.identity.canonicalTitle,
    description: candidate.description.text,
    nativeIdentity: {
      formalIdentifier: candidate.identity.formalIdentifier,
      issuer: candidate.identity.issuer,
      issuingJurisdiction: candidate.identity.issuingJurisdiction,
      status: candidate.identity.status,
    },
    event: {
      displayName: candidate.identity.canonicalTitle,
      eventDate: candidate.dateLeads[0]?.date ?? "",
      eventFamily: candidate.identity.eventType,
      geographies: candidate.identity.issuingJurisdiction
        ? [candidate.identity.issuingJurisdiction]
        : [],
      populations,
    },
    sources,
    origin: candidate.origin,
    provisionalDates: candidate.dateLeads.map((lead) => lead.date),
    affectedPopulation:
      populations.join("; ") || SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
    requiredVariables: [...candidate.apparentExposureVariables],
    outcomeLink: {
      text:
        "The confirmed outcome remains a study target; the proposed source does not by itself establish an outcome pathway.",
      status: "system-template",
    },
    likelyServiceLevel: "event-reconnaissance",
    limitations: [...candidate.limitations],
    reasons: [
      "A previously source-qualified candidate was reconsidered by the ordinary fixed pipeline during one bounded host-assisted follow-up round.",
    ],
  };
}

export function screen02FreshRouteSourceVersions(
  current: readonly Screen02Source[],
  refreshed: readonly Screen02Source[],
) {
  const additions: Screen02Source[] = [];
  const knownIds = new Set(current.map((source) => source.id));
  for (const source of refreshed) {
    const prior = current.find((candidate) => candidate.id === source.id);
    if (!prior) {
      if (!knownIds.has(source.id)) {
        additions.push(source);
        knownIds.add(source.id);
      }
      continue;
    }
    if (sameDeterministicJson(prior, source)) continue;
    // Retrieval timestamps alone do not create a new immutable fact version.
    // When fixed retrieval supplies changed bounded content, however, retain a
    // separately identified version so downstream source fingerprints change.
    if (
      !source.evidenceText ||
      source.evidenceText === prior.evidenceText
    ) continue;
    const version = fingerprintScreen02WorkflowValue({
      locator: source.locator,
      evidenceText: source.evidenceText,
    }).replace(/[^a-z0-9]/giu, "").slice(-20);
    const id = `${source.id.slice(0, 170)}-${version}`.slice(0, 200);
    if (!knownIds.has(id)) {
      additions.push({ ...source, id });
      knownIds.add(id);
    }
  }
  return additions;
}

function screen02LogicalSourceLocator(source: Screen02Source) {
  // Fresh acquisition sources persist the credential/query/fragment-free
  // locator, while a pre-correction reviewed source may still carry its old
  // query form. Compare the same redacted logical coordinate so a changed
  // response cannot retain host review merely because persistence was fixed.
  return sanitizeScreen02AcquisitionUrl(source.locator) ?? source.locator;
}

/**
 * Returns current candidates whose reviewed source content was superseded by a
 * fresh body at the same stable source id or canonical locator. The old source
 * remains immutable in the proposal; callers use this signal only to prevent
 * host judgments made against that old body from influencing the fresh round.
 */
export function screen02ChangedHostReviewCandidateIds(
  current: readonly Screen02FindProposal[],
  refreshedByCandidateId: ReadonlyMap<
    string,
    readonly Screen02Source[]
  >,
) {
  const changed = new Set<string>();
  for (const proposal of current) {
    const refreshed = refreshedByCandidateId.get(proposal.id) ?? [];
    for (const source of refreshed) {
      const logicalLocator = screen02LogicalSourceLocator(source);
      const priorLogicalSources = proposal.sources.filter(
        (prior) =>
          prior.id === source.id ||
          screen02LogicalSourceLocator(prior) === logicalLocator,
      );
      if (
        priorLogicalSources.length > 0 &&
        !priorLogicalSources.some(
          (prior) => (prior.evidenceText ?? "") === (source.evidenceText ?? ""),
        )
      ) {
        changed.add(proposal.id);
        break;
      }
    }
  }
  return [...changed].sort((left, right) => left.localeCompare(right, "en-US"));
}

function screen02ApplyHostOfficialLeadResolutions(
  proposals: readonly Screen02FindProposal[],
  state: Screen02FindState,
  resolutions: readonly Screen02HostOfficialSourceLeadResolution[],
  retrievedAt: string,
) {
  const seedById = new Map(proposals.map((proposal) => [proposal.id, proposal]));
  for (const resolution of resolutions) {
    if (resolution.status !== "verified" || !resolution.candidateId) continue;
    if (resolution.proposal && !seedById.has(resolution.proposal.id)) {
      seedById.set(resolution.proposal.id, resolution.proposal);
      continue;
    }
    if (!seedById.has(resolution.candidateId)) {
      const candidate = state.candidates.find(
        (item) => item.candidateId === resolution.candidateId,
      );
      if (candidate) {
        seedById.set(
          resolution.candidateId,
          screen02HostLeadBaseProposal(state, candidate),
        );
      }
    }
  }
  // Host-derived unbound identities participate in the ordinary common
  // semantic deduplicator before any attachment. Content-versioned sources
  // are then attached to the canonical cluster member so a refreshed body at
  // the same URL cannot be discarded by locator-only source consolidation.
  // A lead explicitly bound to a current immutable candidate is different:
  // preserve that exact candidate through refresh/requalification instead of
  // letting a semantically similar registry record absorb its fresh source.
  const exactCurrentCandidateIds = new Set(resolutions.flatMap((resolution) =>
    resolution.status === "verified" && resolution.candidateId &&
        state.candidates.some((candidate) =>
          candidate.candidateId === resolution.candidateId
        )
      ? [resolution.candidateId]
      : []
  ));
  const exactCurrentProposals = [...exactCurrentCandidateIds].flatMap(
    (candidateId) => {
      const proposal = seedById.get(candidateId);
      return proposal ? [proposal] : [];
    },
  );
  const deduplicated = deduplicateScreen02Proposals(
    [...seedById.values()].filter((proposal) =>
      !exactCurrentCandidateIds.has(proposal.id)
    ),
  );
  const canonicalIdByMember = new Map(
    deduplicated.clusters.flatMap((cluster) =>
      cluster.memberProposalIds.map((memberId) => [
        memberId,
        cluster.canonicalProposalId,
      ] as const)
    ),
  );
  for (const candidateId of exactCurrentCandidateIds) {
    canonicalIdByMember.set(candidateId, candidateId);
  }
  const proposalById = new Map(
    [...exactCurrentProposals, ...deduplicated.proposals]
      .filter((proposal): proposal is Screen02FindProposal =>
        proposal.mode === "find")
      .map((proposal) => [proposal.id, proposal]),
  );
  for (const resolution of resolutions) {
    if (
      resolution.status !== "verified" || !resolution.candidateId ||
      !resolution.source || !resolution.overview
    ) continue;
    const canonicalId = exactCurrentCandidateIds.has(resolution.candidateId)
      ? resolution.candidateId
      : canonicalIdByMember.get(resolution.candidateId) ??
        resolution.candidateId;
    const current = proposalById.get(canonicalId);
    if (!current) continue;
    const withSource = current.sources.some(
      (source) => source.id === resolution.source!.id,
    )
      ? current
      : { ...current, sources: [...current.sources, resolution.source] };
    proposalById.set(
      current.id,
      screen02ApplyOfficialOverview(withSource, resolution.overview, {
        level: 2,
        locator: resolution.source.locator,
        retrievedAt,
        evidenceText: resolution.source.evidenceText ?? "",
      }),
    );
  }
  return {
    proposals: [...proposalById.values()],
    canonicalIdByMember,
  };
}

function screen02OfficialLevel3Locators(
  proposal: Screen02FindProposal,
  primaryLocators: readonly string[],
  linkedLocators: readonly string[],
) {
  const attached = proposal.sources.flatMap((source) => {
    if (
      source.authorityTier > 3 ||
      !SCREEN02_OFFICIAL_EXPLANATORY_LINK.test(
        `${source.title} ${source.channel} ${source.locator}`,
      )
    ) {
      return [];
    }
    const locator = screen02OfficialOverviewUrl(source.locator);
    return locator ? [locator] : [];
  });
  return [...new Set([...linkedLocators, ...attached])]
    .filter(
      (locator) =>
        !primaryLocators.includes(locator) &&
        !screen02OverviewLocatorIsStaticPdf(locator),
    )
    .slice(0, SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_LEVEL3_DOCUMENTS);
}

function screen02ContextualOrientationLocator(
  proposal: Screen02FindProposal,
  contextualProposals: readonly Screen02FindProposal[],
) {
  const normalizedTitle = proposal.title
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  const matching = contextualProposals.find(
    (candidate) =>
      candidate.title
        .toLocaleLowerCase("en-US")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim() === normalizedTitle,
  );
  if (!matching) return null;
  for (const source of matching.sources) {
    if (source.authorityTier !== 6) continue;
    const locator = screen02ContextualOverviewUrl(source.locator);
    if (locator) return locator;
  }
  return null;
}

function boundedScreen02RawQualificationPool(
  proposals: readonly Screen02FindProposal[],
  state: Pick<
    Screen02FindState,
    "screen01Baseline" | "screen01Fingerprint"
  >,
  studyProfile?: Screen02StudyRelevanceProfile,
  maximumCandidates = SCREEN02_DISCOVERY_RAW_CANDIDATE_MAX,
  currentRunQualificationByProposalId?: ReadonlyMap<
    string,
    Screen02CandidateQualification
  >,
) {
  const context = state.screen01Baseline as unknown as Screen01StudyContext;
  const classificationOrder = ["direct", "adjacent", "broad", "mismatch"];
  const boundedMaximum = Math.min(
    SCREEN02_DISCOVERY_RAW_CANDIDATE_MAX,
    Math.max(1, maximumCandidates),
  );
  // Rank the bounded inputs before enforcing the retained-pool cap. The
  // connector query limits already bound this collection; slicing it before
  // evaluation would let an earlier weak lane crowd out a later qualified
  // recovery result solely because of concatenation order.
  const evaluated = proposals.map((proposal, originalIndex) => {
    const currentRun = currentRunQualificationByProposalId?.get(proposal.id);
    return {
      proposal,
      originalIndex,
      qualification: screen02CurrentRunQualificationMatches(
          currentRun,
          proposal,
          { scopeFingerprint: state.screen01Fingerprint, studyProfile },
        )
        ? currentRun!
        : qualifyScreen02FindProposal(proposal, context, {
            scopeFingerprint: state.screen01Fingerprint,
            studyProfile,
          }),
    };
  });
  evaluated.sort(
    (left, right) =>
      Number(right.qualification.eligible) -
        Number(left.qualification.eligible) ||
      classificationOrder.indexOf(left.qualification.classification) -
        classificationOrder.indexOf(right.qualification.classification) ||
      Number(right.qualification.substantiveOverview.passed) -
        Number(left.qualification.substantiveOverview.passed) ||
      (left.qualification.sourceQuality.strongestAuthorityTier ?? 7) -
        (right.qualification.sourceQuality.strongestAuthorityTier ?? 7) ||
      left.originalIndex - right.originalIndex,
  );
  const selected = evaluated.slice(0, boundedMaximum);
  return {
    proposals: selected.map((entry) => entry.proposal),
    qualificationByProposalId: new Map(
      selected.map((entry) => [entry.proposal.id, entry.qualification]),
    ),
    droppedProposalIds: [
      ...evaluated.slice(boundedMaximum).map((entry) => entry.proposal.id),
    ],
  };
}

function screen02HardScopeAllowsSubstantiveDeepening(
  qualification: ReturnType<typeof qualifyScreen02FindProposal>,
) {
  // A sparse official listing can expose only the issuer's geography or a
  // catalog-level population. Its full document may still establish a
  // territorial/applicability pathway. Deepening is retrieval, not a pass:
  // the ordinary source-bound qualifier runs again afterward. Event-family
  // and timing conflicts cannot be repaired by this orientation ladder.
  return qualification.hardScope.checks.every((check) =>
    check.status !== "fail" ||
    check.key === "geography" ||
    check.key === "population"
  );
}

async function enrichSparseScreen02FindProposals(
  env: ShockAuditEnv,
  proposals: readonly Screen02FindProposal[],
  state: Pick<
    Screen02FindState,
    "screen01Baseline" | "screen01Fingerprint"
  >,
  input: {
    maximumCandidates: number;
    retrievedAt: string;
    contextualProposals: readonly Screen02FindProposal[];
    studyProfile?: Screen02StudyRelevanceProfile;
    currentRunQualificationByProposalId?: ReadonlyMap<
      string,
      Screen02CandidateQualification
    >;
    /** Shared across qualification-recovery phases to preserve one hard cap. */
    runtime?: Screen02SubstantiveEnrichmentRuntime;
    /** Absolute attempt ceiling for this phase; defaults to the run maximum. */
    documentFetchLimit?: number;
    /** Optional policy-aware transport shared with a recovery source. */
    fetch?: Screen02ConnectorFetch;
    /** Optional per-hop scheduler run before the network timeout starts. */
    beforeDocumentRequest?: (locator: string) => Promise<void>;
    /** Immutable first-pass proposals used to keep route order across yields. */
    routeProposals?: readonly Screen02FindProposal[];
    /** Canonical continuation retains the reviewed two-request worker pool. */
    concurrency?: 1 | 2;
    /** Prior per-candidate route cursors restored from server storage. */
    priorRecords?: readonly Screen02SubstantiveEnrichmentRecord[];
  },
) {
  const runtime = input.runtime ?? createScreen02SubstantiveEnrichmentRuntime();
  const documentFetchLimit = Math.min(
    SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_DOCUMENT_FETCHES,
    Math.max(0, input.documentFetchLimit ??
      SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_DOCUMENT_FETCHES),
  );
  const attemptsAtStart = runtime.documentsAttempted;
  const bytesAtStart = runtime.receivedBytes;
  const context = state.screen01Baseline as unknown as Screen01StudyContext;
  const currentRunQualifications = new Map(
    input.currentRunQualificationByProposalId ?? [],
  );
  const qualifyCurrentProposal = (proposal: Screen02FindProposal) => {
    const currentRun = currentRunQualifications.get(proposal.id);
    if (screen02CurrentRunQualificationMatches(currentRun, proposal, {
        scopeFingerprint: state.screen01Fingerprint,
        studyProfile: input.studyProfile,
      })) return currentRun!;
    const qualification = qualifyScreen02FindProposal(proposal, context, {
      scopeFingerprint: state.screen01Fingerprint,
      studyProfile: input.studyProfile,
    });
    currentRunQualifications.set(proposal.id, qualification);
    return qualification;
  };
  const uniqueProposalPool = [...new Map(
    proposals.map((proposal) => [proposal.id, proposal]),
  ).values()];
  const routeProposalById = new Map(
    (input.routeProposals ?? proposals).map((proposal) => [
      proposal.id,
      proposal,
    ]),
  );
  const priorRecordById = new Map(
    (input.priorRecords ?? []).map((record) => [record.recordId, record]),
  );
  // This count is only a stop threshold. Once the display target is present,
  // the function returns immediately and never reports the larger pool count,
  // so avoid grounding every remaining raw lead.
  let qualifiedCount = 0;
  for (const proposal of uniqueProposalPool) {
    if (
      qualifyCurrentProposal(proposal).eligible
    ) qualifiedCount += 1;
    if (qualifiedCount >= input.maximumCandidates) break;
  }
  if (qualifiedCount >= input.maximumCandidates) {
    return {
      proposals: [...proposals],
      qualificationByProposalId: new Map(currentRunQualifications),
      records: [] as Screen02SubstantiveEnrichmentRecord[],
      candidatesConsidered: 0,
      documentsAttempted: 0,
      bytesReceived: 0,
      stopReason: "qualified-target-reached" as const,
    };
  }
  const sparse = uniqueProposalPool
    .map((proposal) => ({
      proposal,
      qualification: qualifyCurrentProposal(proposal),
      locators: screen02OfficialOverviewLocators(
        routeProposalById.get(proposal.id) ?? proposal,
      ),
    }))
    .filter(
      (entry) =>
        (priorRecordById.get(entry.proposal.id)?.continuationPending ?? true) &&
        entry.proposal.origin !== "unsupported-lead" &&
        entry.proposal.sources.some((source) => source.authorityTier < 6) &&
        screen02HardScopeAllowsSubstantiveDeepening(entry.qualification) &&
        (
          !entry.qualification.substantiveOverview.passed ||
          entry.qualification.hardScope.checks.some(
            (check) =>
              check.status === "fail" &&
              (check.key === "geography" || check.key === "population"),
          ) ||
          entry.qualification.hardScope.insufficientEvidenceKeys.some(
            (key) => key === "geography" || key === "population",
          )
        ) &&
        (entry.locators.length > 0 ||
          screen02OfficialLevel3Locators(entry.proposal, [], []).length > 0 ||
          screen02ContextualOrientationLocator(
            entry.proposal,
            input.contextualProposals,
          ) !== null),
    )
    // Spend the bounded retrieval budget on study-relevant sparse records
    // first, then use any remaining slots to document why a superficially
    // similar official record is an industry mismatch.
    .sort(
      (left, right) =>
        ["direct", "adjacent", "broad", "mismatch"].indexOf(
          left.qualification.classification,
        ) - ["direct", "adjacent", "broad", "mismatch"].indexOf(
          right.qualification.classification,
        ) ||
        Number(right.qualification.substantiveOverview.identity) -
          Number(left.qualification.substantiveOverview.identity) ||
        Number(left.proposal.origin === "registry-reviewed") -
          Number(right.proposal.origin === "registry-reviewed") ||
        (left.qualification.sourceQuality.strongestAuthorityTier ?? 7) -
          (right.qualification.sourceQuality.strongestAuthorityTier ?? 7) ||
        left.qualification.hardScope.blockingKeys.length -
          right.qualification.hardScope.blockingKeys.length ||
        left.proposal.id.localeCompare(right.proposal.id, "en-US"),
    )
    .slice(0, SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_CANDIDATES);
  if (sparse.length === 0) {
    return {
      proposals: [...proposals],
      qualificationByProposalId: new Map(currentRunQualifications),
      records: [] as Screen02SubstantiveEnrichmentRecord[],
      candidatesConsidered: 0,
      documentsAttempted: 0,
      bytesReceived: 0,
      stopReason: "bounded-routes-exhausted" as const,
    };
  }
  const fetchImpl: Screen02ConnectorFetch = input.fetch ??
    screen02DocumentFetch(env);
  const enrichedById = new Map<string, Screen02FindProposal>();
  const records: Screen02SubstantiveEnrichmentRecord[] = [];
  const cachedDocument = (
    proposal: Screen02FindProposal,
    level: 2 | 3 | 4,
    locator: string,
  ) => {
    const sourceFingerprint = fingerprintScreen02QualificationSources(proposal);
    const source = proposal.sources.find((candidate) =>
      screen02OfficialOverviewUrl(candidate.locator) === locator ||
      screen02ContextualOverviewUrl(candidate.locator) === locator
    );
    return acquireScreen02OverviewDocument(
      runtime,
      {
        candidateId: proposal.id,
        sourceId: source?.id ?? null,
        sourceCacheKey: `${source?.id ?? "linked-source"}:${sourceFingerprint}`,
        level,
        locator,
      },
      fetchImpl,
      {
        maximumAttempts: documentFetchLimit,
        ...(input.beforeDocumentRequest
          ? { beforeRequest: input.beforeDocumentRequest }
          : {}),
      },
    );
  };
  let cursor = 0;
  const workers = Array.from(
    {
      length: Math.min(
        input.concurrency ?? SCREEN02_SUBSTANTIVE_ENRICHMENT_CONCURRENCY,
        sparse.length,
      ),
    },
    async () => {
      while (cursor < sparse.length) {
        if (qualifiedCount >= input.maximumCandidates ||
          runtime.receivedBytes >= SCREEN02_SUBSTANTIVE_ENRICHMENT_TOTAL_BYTES ||
          screen02DocumentDeadlineExhausted(runtime) ||
          screen02InvocationDocumentBudgetExhausted(runtime)) return;
        if (
          runtime.documentsAttempted >= documentFetchLimit
        ) return;
        const entry = sparse[cursor++];
        if (!entry) continue;
        const priorRecord = priorRecordById.get(entry.proposal.id);
        const levelsAttempted: Array<2 | 3 | 4> = [
          ...(priorRecord?.levelsAttempted ?? []),
        ];
        let current = entry.proposal;
        let linkedLevel3 = [
          ...(runtime.linkedLevel3LocatorsByProposalId.get(
            entry.proposal.id,
          ) ?? []),
        ];
        let lastLocator = entry.locators[0] ?? "bounded-source-route";
        let lastFailure = priorRecord?.note ?? "";
        let enrichedAtLevel: 2 | 3 | null = null;
        const level2SourceIds = new Set<string>(
          priorRecord?.level2SourceIds ?? [],
        );
        const level3SourceIds = new Set<string>(
          priorRecord?.level3SourceIds ?? [],
        );
        if (entry.locators.length > 0) {
          levelsAttempted.push(2);
          for (const locator of entry.locators) {
            if (screen02InvocationDocumentBudgetExhausted(runtime)) break;
            lastLocator = locator;
            try {
              const document = await cachedDocument(
                entry.proposal,
                2,
                locator,
              );
              if (
                !screen02RedirectedOverviewMatchesProposal(
                  current,
                  locator,
                  document,
                )
              ) {
                throw new Error(
                  "The overview redirect destination did not establish the same record identity.",
                );
              }
              linkedLevel3 = [...new Set([
                ...linkedLevel3,
                ...document.explanatoryLocators,
              ])];
              runtime.linkedLevel3LocatorsByProposalId.set(
                entry.proposal.id,
                [...linkedLevel3],
              );
              const before = current;
              current = screen02ApplyFetchedOfficialOverview(
                current,
                locator,
                document,
                {
                  level: 2,
                  retrievedAt: input.retrievedAt,
                },
              );
              screen02ChangedEnrichmentSourceIds(
                before.sources,
                current.sources,
              ).forEach((sourceId) => level2SourceIds.add(sourceId));
              if (
                qualifyCurrentProposal(current).substantiveOverview.passed
              ) {
                enrichedAtLevel = 2;
                break;
              }
            } catch (error) {
              if (!(error instanceof Error) ||
                !/already attempted by this search/u.test(error.message)) {
                lastFailure = error instanceof Error
                  ? error.message.slice(0, 300)
                  : "The bounded full-authoritative-document retrieval failed.";
              }
            }
          }
        }
        if (enrichedAtLevel === null) {
          const level3Locators = screen02OfficialLevel3Locators(
            current,
            entry.locators,
            linkedLevel3,
          );
          for (const locator of level3Locators) {
            if (screen02InvocationDocumentBudgetExhausted(runtime)) break;
            levelsAttempted.push(3);
            lastLocator = locator;
            try {
              const document = await cachedDocument(entry.proposal, 3, locator);
              const before = current;
              current = screen02ApplyFetchedOfficialOverview(
                current,
                locator,
                document,
                {
                  level: 3,
                  retrievedAt: input.retrievedAt,
                },
              );
              screen02ChangedEnrichmentSourceIds(
                before.sources,
                current.sources,
              ).forEach((sourceId) => level3SourceIds.add(sourceId));
              if (
                qualifyCurrentProposal(current).substantiveOverview.passed
              ) {
                enrichedAtLevel = 3;
                break;
              }
            } catch (error) {
              if (!(error instanceof Error) ||
                !/already attempted by this search/u.test(error.message)) {
                lastFailure = error instanceof Error
                  ? error.message.slice(0, 300)
                  : "The bounded official explanatory-material retrieval failed.";
              }
            }
          }
        }
        let contextualOrientation = "";
        if (enrichedAtLevel === null) {
          const locator = screen02ContextualOrientationLocator(
            entry.proposal,
            input.contextualProposals,
          );
          if (locator &&
            !screen02InvocationDocumentBudgetExhausted(runtime)) {
            levelsAttempted.push(4);
            lastLocator = locator;
            try {
              const document = await cachedDocument(entry.proposal, 4, locator);
              contextualOrientation = document.overview;
            } catch (error) {
              if (!(error instanceof Error) ||
                !/already attempted by this search/u.test(error.message)) {
                lastFailure = error instanceof Error
                  ? error.message.slice(0, 300)
                  : "The bounded contextual-orientation retrieval failed.";
              }
            }
          }
        }
        const qualification = qualifyCurrentProposal(current);
        // Retain every successfully fetched Level 2/3 body on its active
        // official source, including when that body proves why one remaining
        // substantive or timing gate fails. Level 4 context never mutates
        // `current` and remains manifest-only.
        if (current !== entry.proposal) {
          enrichedById.set(entry.proposal.id, current);
        }
        if (qualification.eligible) qualifiedCount += 1;
        records.push({
          recordId: entry.proposal.id,
          locator: lastLocator,
          status: enrichedAtLevel !== null
            ? "enriched"
            : contextualOrientation
              ? "context-only"
              : levelsAttempted.length > 0 && lastFailure
                ? "failed"
                : "still-insufficient",
          levelsAttempted: [...new Set(levelsAttempted)],
          enrichedAtLevel,
          level2SourceIds: [...level2SourceIds],
          level3SourceIds: [...level3SourceIds],
          note: enrichedAtLevel === 2
            ? "Level 2 full authoritative text established the minimum substantive overview."
            : enrichedAtLevel === 3
              ? "Level 3 official explanatory material established the minimum substantive overview."
              : contextualOrientation
                ? `Level 4 high-quality context supplied only this preliminary orientation: ${contextualOrientation.slice(0, 700)} It did not qualify the candidate and will not enter Screen 3 evidence.`
                : lastFailure ||
                  "The bounded authoritative and explanatory routes still did not establish what changed, who may be affected, and a material date.",
          continuationPending: enrichedAtLevel === null &&
            screen02InvocationDocumentBudgetExhausted(runtime) &&
            runtime.documentsAttempted < documentFetchLimit &&
            runtime.receivedBytes <
              SCREEN02_SUBSTANTIVE_ENRICHMENT_TOTAL_BYTES &&
            !screen02DocumentDeadlineExhausted(runtime),
        });
      }
    },
  );
  await Promise.all(workers);
  return {
    proposals: proposals.map((proposal) => enrichedById.get(proposal.id) ?? proposal),
    qualificationByProposalId: new Map(currentRunQualifications),
    records: records.sort((left, right) =>
      left.recordId.localeCompare(right.recordId, "en-US")),
    candidatesConsidered: sparse.length,
    documentsAttempted: runtime.documentsAttempted - attemptsAtStart,
    bytesReceived: runtime.receivedBytes - bytesAtStart,
    stopReason: qualifiedCount >= input.maximumCandidates
      ? "qualified-target-reached" as const
      : screen02DocumentDeadlineExhausted(runtime)
        ? "total-deadline-exhausted" as const
      : runtime.receivedBytes >= SCREEN02_SUBSTANTIVE_ENRICHMENT_TOTAL_BYTES
        ? "byte-budget-exhausted" as const
      : runtime.documentsAttempted >= documentFetchLimit
        ? "document-budget-exhausted" as const
      : screen02InvocationDocumentBudgetExhausted(runtime)
        ? "invocation-budget-exhausted" as const
        : sparse.length >= SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_CANDIDATES
          ? "candidate-budget-exhausted" as const
      : "bounded-routes-exhausted" as const,
  };
}

function appendLegacyScreen02SubstantiveEnrichmentManifest(
  manifest: Screen02SearchManifestSupplement,
  enrichment: Awaited<
    ReturnType<typeof enrichSparseScreen02FindProposals>
  >,
  input: {
    retrievedAt: string;
    maximumCandidates: number;
    retainedCount: number;
  },
): Screen02SearchManifestSupplement {
  const queryPrefix = "legacy-screen02:substantive-overview";
  const queryMatrix = [
    ...(manifest.queryMatrix ?? []),
    ...(enrichment.records.some((record) =>
        record.levelsAttempted.includes(2))
      ? [{
          id: `${queryPrefix}:full-official-document`,
          query: "Full retained authoritative document for sparse candidate overviews",
          purpose:
            "Populate what changed, who may be affected, and material timing before a sparse record can qualify.",
          returnedRecordIds: enrichment.records
            .filter((record) => record.level2SourceIds.length > 0)
            .map((record) => record.recordId),
        }]
      : []),
    ...(enrichment.records.some((record) =>
        record.levelsAttempted.includes(3))
      ? [{
          id: `${queryPrefix}:official-explanatory-material`,
          query: "Allowlisted official explanatory materials linked to sparse authoritative records",
          purpose:
            "Use an official explainer only after the retained authoritative text remains insufficient.",
          returnedRecordIds: enrichment.records
            .filter((record) => record.level3SourceIds.length > 0)
            .map((record) => record.recordId),
        }]
      : []),
    ...(enrichment.records.some((record) =>
        record.levelsAttempted.includes(4))
      ? [{
          id: `${queryPrefix}:contextual-orientation`,
          query: "Fixed-allowlist high-quality contextual orientation for still-sparse records",
          purpose:
            "Record separately labelled orientation only; contextual text cannot qualify a candidate.",
          returnedRecordIds: enrichment.records
            .filter((record) => record.status === "context-only")
            .map((record) => record.recordId),
        }]
      : []),
  ];
  const enrichedCount = enrichment.records.filter(
    (record) => record.status === "enriched",
  ).length;
  const contextOnlyCount = enrichment.records.filter(
    (record) => record.status === "context-only",
  ).length;
  const ladderStatus = enrichment.records.length === 0
    ? "not-searched" as const
    : enrichment.records.every((record) => record.status === "failed")
      ? "failed" as const
      : "searched" as const;
  const baseStoppingNote = manifest.stoppingRule?.note ??
    "The selected bounded native routes completed.";
  return {
    queryMatrix,
    channels: [
      ...(manifest.channels ?? []),
      {
        channel: "Bounded substantive-information retrieval ladder",
        status: ladderStatus,
        retrievedAt: input.retrievedAt,
        note: `The legacy Find route used the common ladder before ranking. It considered ${enrichment.candidatesConsidered} high-potential sparse records, attempted ${enrichment.documentsAttempted}/${SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_DOCUMENT_FETCHES} bounded documents across ${enrichment.records.length} candidate records, enriched ${enrichedCount}, and retained ${contextOnlyCount} Level 4 orientation-only result${contextOnlyCount === 1 ? "" : "s"}. The text extractor skipped statically identifiable PDFs, tried at most ${SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_LEVEL2_DOCUMENTS} Level 2 text documents per candidate, and kept the original PDF source provenance. Stop: ${enrichment.stopReason}.${screen02EnrichmentFailureSummary(enrichment.records)}`,
      },
    ],
    stoppingRule: {
      rule: `Complete every bounded selected route and the common substantive-information ladder, stopping when ${input.maximumCandidates} qualified candidates are available or every permitted route is exhausted.`,
      status: manifest.stoppingRule?.status === "not-met"
        ? "not-met"
        : "met",
      note: `${baseStoppingNote} The common substantive ladder ${enrichment.stopReason === "qualified-target-reached" ? "stopped after the qualified-candidate target was reached" : "exhausted every permitted text and explanatory route"}; ${input.retainedCount} candidate${input.retainedCount === 1 ? " was" : "s were"} retained after qualification and display limits.`,
    },
  };
}

const SCREEN02_HOST_ADDITIVE_PROFILE_KEYS = [
  "industryAliases",
  "internationalVariants",
  "subsectors",
  "products",
  "services",
  "industryActors",
  "regulatedActivities",
  "platformRelationships",
  "contrastTerms",
  "falseFriends",
  "jurisdictionAliases",
] as const satisfies readonly (keyof Screen02StudyRelevanceProfile)[];

const SCREEN02_HOST_STABLE_PROFILE_KEYS = [
  "schemaVersion",
  "scopeFingerprint",
  "originalIndustryText",
  "canonicalIndustryLabel",
  "canonicalIndustryCode",
  "status",
  "ambiguity",
  "interpretationAlternatives",
  "businessModels",
  "distributionChannels",
  "workforceRelationships",
  "supplyChainRelationships",
  "customerOrUserRelationships",
  "regulatorySurfaces",
  "disruptionSurfaces",
  "sampleGeography",
  "geographyAliases",
  "possibleIssuingJurisdictions",
  "studyStartYear",
  "studyEndYear",
  "eventFamilyTerms",
  "requiredCriteria",
  "preferredCriteria",
  "avoidedCriteria",
  "profileVersion",
  "createdAt",
] as const satisfies readonly (keyof Screen02StudyRelevanceProfile)[];

function screen02QualificationProfileForHostDiscovery(
  state: Screen02FindState,
  retrievalProfile: Screen02StudyRelevanceProfile,
  supplied: Screen02StudyRelevanceProfile,
) {
  if (
    !isScreen02StudyRelevanceProfile(supplied) ||
    supplied.scopeFingerprint !== state.screen01Fingerprint ||
    supplied.originalIndustryText !==
      state.screen01Baseline.scopeContract.industry ||
    supplied.sampleGeography !== state.screen01Baseline.scopeContract.geography
  ) {
    throw new Error(
      "Host discovery requires a valid pre-host qualification profile bound to the current confirmed scope.",
    );
  }
  if (retrievalProfile.origin !== "chatgpt-host-enriched") {
    if (!sameDeterministicJson(supplied, retrievalProfile)) {
      throw new Error(
        "Host discovery qualification profile is not the current pre-host profile.",
      );
    }
    return structuredClone(supplied);
  }
  if (
    Date.parse(supplied.updatedAt) >= Date.parse(retrievalProfile.updatedAt) ||
    SCREEN02_HOST_STABLE_PROFILE_KEYS.some((key) =>
      !sameDeterministicJson(supplied[key], retrievalProfile[key])
    ) ||
    SCREEN02_HOST_ADDITIVE_PROFILE_KEYS.some((key) =>
      supplied[key].length > retrievalProfile[key].length ||
      !supplied[key].every(
        (value, index) => retrievalProfile[key][index] === value,
      )
    )
  ) {
    throw new Error(
      "Host discovery qualification profile is not the current additive predecessor of the enriched retrieval profile.",
    );
  }
  return structuredClone(supplied);
}

export type Screen02CanonicalFindInput = {
  searchRoundId: string;
  at: string;
  exactRequest: string;
  maximumCandidates: number;
  /** Server-only absolute network deadline used by the persisted runtime. */
  continuationDeadlineAt?: number;
  queryPlanning:
    | {
        origin: "chatgpt-host";
        queryTerms: string[];
        rationale: string;
        requestId: string;
        receiptId: string;
        officialSourceLeads?: Screen02PoolHostOfficialSourceLead[];
        rankingAdjustments?: Array<{
          candidateId: string;
          adjustment: number;
        }>;
        qualificationProfile: Screen02StudyRelevanceProfile;
        candidateReviewInfluenceById?: Screen02CandidateReviewInfluenceMap;
      }
    | {
        origin: "fixed-fallback";
        reason: string;
      };
};

export type Screen02CanonicalFindDiscovery = Screen02FindDiscoveryResult & {
  verifiedOfficialSourceLeadCount?: number;
  hostQueryExecution?: Screen02HostQueryExecution;
  officialSourceLeadAudit?: Array<{
    leadId: string;
    leadFingerprint: string;
    contentFingerprint: string | null;
    verificationStatus: "verified" | "rejected";
    resultingSourceId: string | null;
    resultingSourceFingerprint: string | null;
    resultingSourceStatus: "persisted" | "not-retained" | "rejected";
  }>;
};

export const SCREEN_02_CANONICAL_FIND_CONTINUATION_SCHEMA_VERSION =
  "screen-02-canonical-find-continuation-v1" as const;
export const SCREEN_02_CANONICAL_FIND_INVOCATION_DOCUMENT_LIMIT = 2;

export type Screen02CanonicalFindContinuation = {
  schemaVersion: typeof SCREEN_02_CANONICAL_FIND_CONTINUATION_SCHEMA_VERSION;
  /** Binds this server-only record to immutable state and request inputs. */
  bindingFingerprint: string;
  phase: "host-official" | "initial-enrichment" | "recovery-enrichment";
  cursor: {
    hostOfficialLeadIndex: number;
    documentAttempt: number;
  };
  ordinaryDiscovery: Screen02OfficialDiscoveryBatch;
  hostOfficialLeadResolutions: Screen02HostOfficialSourceLeadResolution[];
  budget: {
    invocationsCompleted: number;
    documentsAttempted: number;
    receivedBytes: number;
    deadlineStartedAt: number | null;
    deadlineAt: number | null;
    acquisitions: Screen02DocumentAcquisition[];
    attemptedDocumentKeys: string[];
    attemptJournal: Screen02DocumentAttemptJournalEntry[];
    linkedLevel3Locators: Array<{
      candidateId: string;
      locators: string[];
    }>;
  };
  initialEnrichment: {
    proposals: Screen02FindProposal[];
    records: Screen02SubstantiveEnrichmentRecord[];
    candidatesConsidered: number;
  } | null;
  recovery: {
    connectorResult: Screen02OfficialConnectorResult;
    proposals: Screen02FindProposal[];
    records: Screen02SubstantiveEnrichmentRecord[];
    candidatesConsidered: number;
  } | null;
};

export type Screen02CanonicalFindStepResult =
  | {
      status: "pending";
      continuation: Screen02CanonicalFindContinuation;
      progress: Screen02CanonicalFindProgress;
    }
  | {
      status: "complete";
      discovery: Screen02CanonicalFindDiscovery;
      progress: Screen02CanonicalFindProgress;
    };

export type Screen02CanonicalFindProgress = {
  invocationsCompleted: number;
  invocationDocumentsAttempted: number;
  documentsAttempted: number;
  receivedBytes: number;
  acquisitions: Screen02DocumentAcquisition[];
  attemptedDocumentKeys: string[];
  attemptJournal: Screen02DocumentAttemptJournalEntry[];
  ordinaryConnectorExecuted: boolean;
  recoveryConnectorExecuted: boolean;
  /** Actual logical source-query starts made by this runtime invocation. */
  ordinarySourceQueries: number;
  recoverySourceQueries: number;
  /** Actual connector fetch dispatches made by this runtime invocation. */
  ordinaryConnectorFetches: number;
  recoveryConnectorFetches: number;
};

export function screen02CanonicalFindContinuationDeadlineExhausted(
  continuation: Pick<Screen02CanonicalFindContinuation, "budget">,
  now: () => number = Date.now,
) {
  return continuation.budget.deadlineAt !== null &&
    now() >= continuation.budget.deadlineAt;
}

function screen02CanonicalFindBindingFingerprint(
  state: Screen02FindState,
  input: Screen02CanonicalFindInput,
) {
  const queryPlanning = input.queryPlanning.origin === "chatgpt-host"
    ? {
        origin: input.queryPlanning.origin,
        queryTerms: input.queryPlanning.queryTerms,
        rationale: input.queryPlanning.rationale,
        requestId: input.queryPlanning.requestId,
        receiptId: input.queryPlanning.receiptId,
        officialSourceLeads: input.queryPlanning.officialSourceLeads ?? [],
        rankingAdjustments: input.queryPlanning.rankingAdjustments ?? [],
        qualificationProfile: input.queryPlanning.qualificationProfile,
        candidateReviewInfluenceById: [
          ...(input.queryPlanning.candidateReviewInfluenceById ?? new Map()),
        ].sort(([left], [right]) => left.localeCompare(right, "en-US")),
      }
    : input.queryPlanning;
  return fingerprintScreen02WorkflowValue({
    schemaVersion: SCREEN_02_CANONICAL_FIND_CONTINUATION_SCHEMA_VERSION,
    scopeFingerprint: state.screen01Fingerprint,
    searchRoundId: input.searchRoundId,
    at: input.at,
    exactRequest: input.exactRequest,
    maximumCandidates: input.maximumCandidates,
    ...(input.continuationDeadlineAt !== undefined
      ? { continuationDeadlineAt: input.continuationDeadlineAt }
      : {}),
    queryPlanning,
  });
}

function screen02StrictJsonClone<T>(value: T): T {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new Error("The Screen 2 continuation is not JSON serializable.");
  }
  return JSON.parse(serialized) as T;
}

function assertScreen02CanonicalFindContinuation(
  continuation: Screen02CanonicalFindContinuation,
  state: Screen02FindState,
  input: Screen02CanonicalFindInput,
) {
  if (
    continuation.schemaVersion !==
      SCREEN_02_CANONICAL_FIND_CONTINUATION_SCHEMA_VERSION ||
    continuation.bindingFingerprint !==
      screen02CanonicalFindBindingFingerprint(state, input) ||
    !Number.isInteger(continuation.cursor.hostOfficialLeadIndex) ||
    continuation.cursor.hostOfficialLeadIndex < 0 ||
    continuation.cursor.hostOfficialLeadIndex > 8 ||
    continuation.cursor.documentAttempt !==
      continuation.budget.documentsAttempted ||
    !Number.isInteger(continuation.budget.invocationsCompleted) ||
    continuation.budget.invocationsCompleted < 1 ||
    !Number.isInteger(continuation.budget.documentsAttempted) ||
    continuation.budget.documentsAttempted < 0 ||
    continuation.budget.documentsAttempted >
      SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_DOCUMENT_FETCHES ||
    !Number.isInteger(continuation.budget.receivedBytes) ||
    continuation.budget.receivedBytes < 0 ||
    continuation.budget.receivedBytes >
      SCREEN_02_DOCUMENT_ACQUISITION_MAX_RECORDED_TOTAL_BYTES ||
    continuation.budget.attemptedDocumentKeys.length !==
      new Set(continuation.budget.attemptedDocumentKeys).size ||
    continuation.budget.attemptJournal.length !==
      continuation.budget.documentsAttempted ||
    continuation.budget.acquisitions.length >
      continuation.budget.documentsAttempted ||
    continuation.budget.deadlineStartedAt === null ||
    continuation.budget.deadlineAt === null ||
    !Number.isFinite(continuation.budget.deadlineStartedAt) ||
    !Number.isFinite(continuation.budget.deadlineAt) ||
    continuation.budget.deadlineAt -
        continuation.budget.deadlineStartedAt !==
      SCREEN02_SUBSTANTIVE_ENRICHMENT_TOTAL_TIMEOUT_MS ||
    (continuation.phase === "host-official" &&
      (continuation.initialEnrichment !== null ||
        continuation.recovery !== null)) ||
    (continuation.phase === "initial-enrichment" &&
      (continuation.initialEnrichment === null ||
        continuation.recovery !== null)) ||
    (continuation.phase === "recovery-enrichment" &&
      (continuation.initialEnrichment === null ||
        continuation.recovery === null))
  ) {
    throw new Error(
      "The server-owned Screen 2 discovery continuation is invalid or belongs to another search.",
    );
  }
  for (const entry of continuation.budget.attemptJournal) {
    if (
      !continuation.budget.attemptedDocumentKeys.includes(entry.requestKey) ||
      !Number.isInteger(entry.attempt) || entry.attempt < 1 ||
      entry.attempt > continuation.budget.documentsAttempted
    ) {
      throw new Error(
        "The server-owned Screen 2 document-attempt journal is inconsistent.",
      );
    }
  }
  for (const entry of continuation.budget.linkedLevel3Locators) {
    if (
      typeof entry.candidateId !== "string" ||
      entry.candidateId.length < 1 || entry.candidateId.length > 200 ||
      entry.locators.length >
        SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_LEVEL3_DOCUMENTS ||
      entry.locators.length !== new Set(entry.locators).size ||
      entry.locators.some((locator) =>
        screen02OfficialOverviewUrl(locator) === null)
    ) {
      throw new Error(
        "The server-owned Screen 2 continuation route cursor is invalid.",
      );
    }
  }
}

function screen02CanonicalRuntimeOrdering(
  runtime: Screen02SubstantiveEnrichmentRuntime,
) {
  const attemptJournal = [...runtime.documentAttemptJournal].sort(
    (left, right) => left.attempt - right.attempt ||
      left.requestKey.localeCompare(right.requestKey, "en-US"),
  );
  const attemptByAcquisitionId = new Map(
    attemptJournal.map((entry) => [entry.acquisitionId, entry.attempt]),
  );
  const acquisitions = [...runtime.documentAcquisitions].sort(
    (left, right) =>
      (attemptByAcquisitionId.get(left.acquisitionId) ??
        Number.MAX_SAFE_INTEGER) -
        (attemptByAcquisitionId.get(right.acquisitionId) ??
          Number.MAX_SAFE_INTEGER) ||
      left.acquisitionId.localeCompare(right.acquisitionId, "en-US"),
  );
  const journalKeys = new Set(attemptJournal.map((entry) => entry.requestKey));
  const attemptedDocumentKeys = [
    ...attemptJournal.map((entry) => entry.requestKey),
    ...[...runtime.attemptedDocumentKeys]
      .filter((key) => !journalKeys.has(key))
      .sort((left, right) => left.localeCompare(right, "en-US")),
  ];
  const linkedLevel3Locators = [
    ...runtime.linkedLevel3LocatorsByProposalId,
  ]
    .sort(([left], [right]) => left.localeCompare(right, "en-US"))
    .map(([candidateId, locators]) => ({
      candidateId,
      locators: [...locators],
    }));
  return {
    acquisitions,
    attemptedDocumentKeys,
    attemptJournal,
    linkedLevel3Locators,
  };
}

function mergeScreen02SubstantiveEnrichmentRecords(
  previous: readonly Screen02SubstantiveEnrichmentRecord[],
  current: readonly Screen02SubstantiveEnrichmentRecord[],
) {
  const merged = new Map(
    previous.map((record) => [record.recordId, structuredClone(record)]),
  );
  for (const record of current) {
    const prior = merged.get(record.recordId);
    if (!prior) {
      merged.set(record.recordId, structuredClone(record));
      continue;
    }
    merged.set(record.recordId, {
      ...structuredClone(record),
      status: record.status === "enriched" || prior.status !== "enriched"
        ? record.status
        : prior.status,
      levelsAttempted: [...new Set([
        ...prior.levelsAttempted,
        ...record.levelsAttempted,
      ])],
      enrichedAtLevel: record.enrichedAtLevel ?? prior.enrichedAtLevel,
      level2SourceIds: [...new Set([
        ...prior.level2SourceIds,
        ...record.level2SourceIds,
      ])],
      level3SourceIds: [...new Set([
        ...prior.level3SourceIds,
        ...record.level3SourceIds,
      ])],
      note: record.status === "enriched" || prior.status !== "enriched"
        ? record.note
        : prior.note,
    });
  }
  return [...merged.values()].sort((left, right) =>
    left.recordId.localeCompare(right.recordId, "en-US"));
}

/**
 * Canonical v2.1 Find discovery deliberately combines the reviewed registry
 * with the same bounded official connectors used by the released workflow.
 * Study geography remains distinct from issuing jurisdiction: foreign and
 * supranational registry leads stay available for cross-border assessment.
 */
async function executeCanonicalScreen02FindStep(
  env: ShockAuditEnv,
  state: Screen02FindState,
  input: Screen02CanonicalFindInput,
  prior: Screen02CanonicalFindContinuation | undefined,
  boundedInvocation: boolean,
): Promise<Screen02CanonicalFindStepResult> {
  if (prior) assertScreen02CanonicalFindContinuation(prior, state, input);
  const retrievalProfile = requireReadyScreen02StudyRelevanceProfile(
    screen02FindRelevanceProfile(state),
  );
  const qualificationProfile = input.queryPlanning.origin === "chatgpt-host"
    ? screen02QualificationProfileForHostDiscovery(
        state,
        retrievalProfile,
        input.queryPlanning.qualificationProfile,
      )
    : retrievalProfile;
  const legacyContext = {
    screen01Baseline: state.screen01Baseline,
  } as unknown as Screen02Session;
  const preferences = canonicalFindPreferences(state, input.exactRequest);
  // Host-proposed official pages and every later Level 2/3/4 document share
  // one lazy-start deadline, attempt counter, byte budget, cache, and
  // two-request semaphore. Connector metadata requests remain separately
  // bounded by their connector contracts.
  const continuationNow = env.SCREEN02_SEARCH_MONOTONIC_NOW ?? Date.now;
  const firstStepStartedAt = !boundedInvocation || prior
    ? null
    : input.continuationDeadlineAt === undefined
      ? continuationNow()
      : input.continuationDeadlineAt -
        SCREEN02_SUBSTANTIVE_ENRICHMENT_TOTAL_TIMEOUT_MS;
  if (
    boundedInvocation && !prior &&
    input.continuationDeadlineAt !== undefined &&
    (!Number.isFinite(input.continuationDeadlineAt) ||
      continuationNow() >= input.continuationDeadlineAt)
  ) {
    throw new Error(
      "The server-owned Screen 2 discovery deadline expired before initial retrieval.",
    );
  }
  const enrichmentRuntime = createScreen02SubstantiveEnrichmentRuntime(
    continuationNow,
    {
      ...(prior
        ? {
            receivedBytes: prior.budget.receivedBytes,
            documentsAttempted: prior.budget.documentsAttempted,
            documentAcquisitions: prior.budget.acquisitions,
            attemptedDocumentKeys: prior.budget.attemptedDocumentKeys,
            documentAttemptJournal: prior.budget.attemptJournal,
            linkedLevel3Locators: prior.budget.linkedLevel3Locators,
            deadlineStartedAt: prior.budget.deadlineStartedAt,
            deadlineAt: prior.budget.deadlineAt,
          }
        : boundedInvocation
          ? {
              deadlineStartedAt: firstStepStartedAt,
              deadlineAt: input.continuationDeadlineAt ??
                firstStepStartedAt! +
                  SCREEN02_SUBSTANTIVE_ENRICHMENT_TOTAL_TIMEOUT_MS,
            }
          : {}),
      invocationDocumentFetchLimit: boundedInvocation
        ? SCREEN_02_CANONICAL_FIND_INVOCATION_DOCUMENT_LIMIT
        : SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_DOCUMENT_FETCHES,
    },
  );
  // Start one real-time cancellation signal at the child-invocation boundary.
  // The persisted absolute timestamp remains authoritative; this signal makes
  // an in-flight crawl admission or response observe time spent in earlier
  // phases even when a deterministic test clock is held constant.
  const invocationDeadlineSignal =
    boundedInvocation && enrichmentRuntime.deadlineAt !== null
      ? AbortSignal.timeout(Math.max(
          1,
          enrichmentRuntime.deadlineAt - continuationNow(),
        ))
      : undefined;
  let ordinaryConnectorFetchesThisStep = 0;
  const ordinaryInvocationUsage: Screen02OfficialDiscoveryInvocationUsage = {
    sourceQueries: 0,
  };
  const ordinaryFetch = env.CONNECTOR_FETCH ??
    ((request: RequestInfo | URL, init?: RequestInit) =>
      globalThis.fetch(request, init));
  const ordinaryDiscoveryEnv = prior
    ? env
    : {
        ...env,
        CONNECTOR_FETCH: ((request, init) => {
          ordinaryConnectorFetchesThisStep += 1;
          return ordinaryFetch(request, init);
        }) satisfies Screen02ConnectorFetch,
      };
  const ordinaryDiscovery = prior
    ? screen02StrictJsonClone(prior.ordinaryDiscovery)
    : await officialDiscovery(
      ordinaryDiscoveryEnv,
      legacyContext,
      preferences,
      input.at,
      SCREEN02_DISCOVERY_RAW_CANDIDATE_TARGET,
      input.queryPlanning.origin === "chatgpt-host"
        ? {
            routingHints: {
              possibleIssuers: (
                input.queryPlanning.officialSourceLeads ?? []
              ).flatMap((lead) => lead.issuingBody ? [lead.issuingBody] : []),
              possibleIssuingJurisdictions: (
                input.queryPlanning.officialSourceLeads ?? []
              ).flatMap((lead) => lead.jurisdiction ? [lead.jurisdiction] : []),
            },
          }
        : {},
      input.queryPlanning.origin === "chatgpt-host"
        ? input.queryPlanning.queryTerms
        : [],
      retrievalProfile,
      ordinaryInvocationUsage,
    );
  const official = screen02StrictJsonClone(ordinaryDiscovery);
  const ordinaryConnectorExecutedThisStep = !prior && (
    ordinaryDiscovery.funnel.queryRequestsExecuted > 0 ||
    (ordinaryDiscovery.expandedResults?.length ?? 0) > 0 ||
    (ordinaryDiscovery.contextBridges?.length ?? 0) > 0
  );
  let recoveryConnectorExecutedThisStep = false;
  let recoveryConnectorFetchesThisStep = 0;
  let hostOfficialLeadResolutions = prior
    ? screen02StrictJsonClone(prior.hostOfficialLeadResolutions)
    : [];
  let hostOfficialLeadIndex = prior?.cursor.hostOfficialLeadIndex ?? 0;
  const hostOfficialLeads = input.queryPlanning.origin === "chatgpt-host"
    ? (input.queryPlanning.officialSourceLeads ?? []).slice(0, 8)
    : [];
  const continuationDeadlineExhausted =
    screen02DocumentDeadlineExhausted(enrichmentRuntime);
  if (
    !continuationDeadlineExhausted &&
    hostOfficialLeadIndex < hostOfficialLeads.length
  ) {
    const remainingInvocationSlots = boundedInvocation
      ? Math.max(
          0,
          SCREEN_02_CANONICAL_FIND_INVOCATION_DOCUMENT_LIMIT -
            enrichmentRuntime.invocationDocumentsAttempted,
        )
      : hostOfficialLeads.length;
    const leadBatchSize = boundedInvocation
      ? Math.min(remainingInvocationSlots, 2)
      : hostOfficialLeads.length;
    const leadBatch = hostOfficialLeads.slice(
      hostOfficialLeadIndex,
      hostOfficialLeadIndex + leadBatchSize,
    );
    const resolutions = await retrieveScreen02HostOfficialSourceLeads(
      env,
      state,
      leadBatch,
      input.at,
      enrichmentRuntime,
      hostOfficialLeadIndex,
    );
    hostOfficialLeadResolutions = [
      ...hostOfficialLeadResolutions,
      ...resolutions,
    ];
    hostOfficialLeadIndex += leadBatch.length;
  }
  if (continuationDeadlineExhausted) {
    // The remaining source leads are not attempted or journaled. Advancing
    // the server-only cursor makes the next code path finalize the retained
    // partial result without creating a retry loop past the absolute search
    // deadline.
    hostOfficialLeadIndex = hostOfficialLeads.length;
  }
  const canonicalProgress = (): Screen02CanonicalFindProgress => {
    const ordered = screen02CanonicalRuntimeOrdering(enrichmentRuntime);
    return screen02StrictJsonClone({
      invocationsCompleted: (prior?.budget.invocationsCompleted ?? 0) + 1,
      invocationDocumentsAttempted:
        enrichmentRuntime.invocationDocumentsAttempted,
      documentsAttempted: enrichmentRuntime.documentsAttempted,
      receivedBytes: enrichmentRuntime.receivedBytes,
      acquisitions: ordered.acquisitions,
      attemptedDocumentKeys: ordered.attemptedDocumentKeys,
      attemptJournal: ordered.attemptJournal,
      ordinaryConnectorExecuted: ordinaryConnectorExecutedThisStep,
      recoveryConnectorExecuted: recoveryConnectorExecutedThisStep,
      ordinarySourceQueries: ordinaryInvocationUsage.sourceQueries,
      recoverySourceQueries: recoveryConnectorExecutedThisStep ? 1 : 0,
      ordinaryConnectorFetches: ordinaryConnectorFetchesThisStep,
      recoveryConnectorFetches: recoveryConnectorFetchesThisStep,
    });
  };
  const pendingContinuation = (
    phase: Screen02CanonicalFindContinuation["phase"],
    initialEnrichment: Screen02CanonicalFindContinuation["initialEnrichment"],
    recovery: Screen02CanonicalFindContinuation["recovery"],
  ): Screen02CanonicalFindStepResult => {
    const ordered = screen02CanonicalRuntimeOrdering(enrichmentRuntime);
    const continuation = screen02StrictJsonClone({
      schemaVersion: SCREEN_02_CANONICAL_FIND_CONTINUATION_SCHEMA_VERSION,
      bindingFingerprint: screen02CanonicalFindBindingFingerprint(state, input),
      phase,
      cursor: {
        hostOfficialLeadIndex,
        documentAttempt: enrichmentRuntime.documentsAttempted,
      },
      ordinaryDiscovery,
      hostOfficialLeadResolutions,
      budget: {
        invocationsCompleted:
          (prior?.budget.invocationsCompleted ?? 0) + 1,
        documentsAttempted: enrichmentRuntime.documentsAttempted,
        receivedBytes: enrichmentRuntime.receivedBytes,
        deadlineStartedAt: enrichmentRuntime.deadlineStartedAt,
        deadlineAt: enrichmentRuntime.deadlineAt,
        acquisitions: ordered.acquisitions,
        attemptedDocumentKeys: ordered.attemptedDocumentKeys,
        attemptJournal: ordered.attemptJournal,
        linkedLevel3Locators: ordered.linkedLevel3Locators,
      },
      initialEnrichment,
      recovery,
    });
    return {
      status: "pending",
      continuation,
      progress: canonicalProgress(),
    };
  };
  if (boundedInvocation && hostOfficialLeadIndex < hostOfficialLeads.length) {
    return pendingContinuation(
      "host-official",
      prior?.initialEnrichment ?? null,
      prior?.recovery ?? null,
    );
  }
  const officialFind = official.results
    .flatMap((result) => result.proposals)
    .filter(
      (proposal): proposal is Screen02FindProposal => proposal.mode === "find",
    );
  const expandedOfficialFind = (official.expandedResults ?? [])
    .flatMap((result) => result.proposals)
    .filter(
      (proposal): proposal is Screen02FindProposal => proposal.mode === "find",
    );
  const contextualFind = (official.expandedLeadProposals ?? []).filter(
    (proposal): proposal is Screen02FindProposal => proposal.mode === "find",
  );
  const registry = canonicalRegistryCandidates(state, retrievalProfile);
  const indexedRegistry = env.SCREEN02_PUBLIC_EVENT_INDEX_MODE === "off"
    ? []
    : canonicalRegistryCandidates(
        state,
        retrievalProfile,
        PUBLIC_SCREEN02_EVENT_INDEX_PROPOSALS,
        true,
      );
  const baselineOrigins = screen02ConnectorRetainedOrigins(
    official.results,
    () => "official-baseline",
  );
  const allBridgeQueryIds = new Set(
    (official.contextBridges ?? []).map((bridge) => bridge.bridgeQueryId),
  );
  const corroboratedBridgeQueryIds = new Set(
    (official.contextBridges ?? [])
      .filter((bridge) => bridge.status === "corroborated")
      .map((bridge) => bridge.bridgeQueryId),
  );
  const expandedOrigins = screen02ConnectorRetainedOrigins(
    official.expandedResults ?? [],
    (_result, binding) =>
      allBridgeQueryIds.has(binding.queryId)
        ? corroboratedBridgeQueryIds.has(binding.queryId)
          ? "context-official-bridge"
          : null
        : "official-expansion",
  );
  const registryOrigins: Screen02RetainedOriginMap = new Map();
  const registryQueryId = `${input.searchRoundId}:reviewed-registry`;
  for (const proposal of registry) {
    appendScreen02RetainedOrigin(registryOrigins, proposal.id, {
      kind: "query-result",
      retrievalLane: "reviewed-registry",
      evidenceRole: "identity",
      producerRecordId: proposal.id,
      queryId: registryQueryId,
      returnedRecordIds: [proposal.id],
      sourceIds: proposal.sources.map((source) => source.id),
    });
  }
  const contextOrigins: Screen02RetainedOriginMap = new Map();
  const contextualById = new Map(
    contextualFind.map((proposal) => [proposal.id, proposal]),
  );
  const contextQueryById = new Map(
    (official.expansionManifest?.queryMatrix ?? []).map((query) => [
      query.id,
      query,
    ]),
  );
  const contextBindings = official.expandedLeadBindings ?? [];
  if (
    !screen02SameStringSet(
      [...contextualById.keys()],
      contextBindings.map((binding) => binding.proposalId),
    )
  ) {
    throw new Error(
      "Guarded contextual discovery did not bind every retained lead to its provider query.",
    );
  }
  for (const binding of contextBindings) {
    const proposal = contextualById.get(binding.proposalId);
    const query = contextQueryById.get(binding.queryId);
    if (
      !proposal || !query || binding.returnedRecordIds.length === 0 ||
      !binding.returnedRecordIds.every((recordId) =>
        query.returnedRecordIds?.includes(recordId)
      ) ||
      !screen02SameStringSet(
        binding.sourceIds,
        proposal.sources.map((source) => source.id),
      )
    ) {
      throw new Error(
        "Guarded contextual discovery returned an invalid lead binding.",
      );
    }
    appendScreen02RetainedOrigin(contextOrigins, proposal.id, {
      kind: "query-result",
      retrievalLane: "context-discovery",
      evidenceRole: "support",
      producerRecordId: proposal.id,
      queryId: binding.queryId,
      returnedRecordIds: [...binding.returnedRecordIds],
      sourceIds: [...binding.sourceIds],
    });
  }
  // One official record can be returned by more than one query variant. Remove
  // exact ID repeats before semantic deduplication so the immutable proposal
  // record is preserved instead of being treated as a provenance conflict.
  const exactIds = new Map<string, Screen02FindProposal>();
  for (const proposal of [...registry, ...officialFind]) {
    const prior = exactIds.get(proposal.id);
    exactIds.set(
      proposal.id,
      prior ? mergeScreen02ExactIdProposalSources(prior, proposal) : proposal,
    );
  }
  const baselineDeduplication = deduplicateScreen02Proposals([
    ...exactIds.values(),
  ]);
  const deduplicated = baselineDeduplication.proposals.filter(
    (proposal): proposal is Screen02FindProposal => proposal.mode === "find",
  );
  const deduplicatedOrigins =
    remapScreen02RetainedOriginsThroughDeduplication(
      mergeScreen02RetainedOriginMaps(registryOrigins, baselineOrigins),
      baselineDeduplication,
    );
  const exclusions: Screen02WorkflowSearchManifest["exclusions"] = [];
  let previouslyShownCount = 0;
  const expandedExactIds = new Map<string, Screen02FindProposal>();
  for (const proposal of expandedOfficialFind) {
    const prior = expandedExactIds.get(proposal.id);
    expandedExactIds.set(
      proposal.id,
      prior ? mergeScreen02ExactIdProposalSources(prior, proposal) : proposal,
    );
  }
  const expandedDeduplication = deduplicateScreen02Proposals([
    ...expandedExactIds.values(),
  ]);
  const expandedDeduplicated = expandedDeduplication.proposals.filter(
    (proposal): proposal is Screen02FindProposal => proposal.mode === "find",
  );
  const expandedDeduplicatedOrigins =
    remapScreen02RetainedOriginsThroughDeduplication(
      expandedOrigins,
      expandedDeduplication,
    );
  const baselineIds = new Set(deduplicated.map((proposal) => proposal.id));
  const crossLane = deduplicateScreen02Proposals([
    ...deduplicated,
    ...expandedDeduplicated,
  ]);
  const duplicateExpansionIds = new Set(
    crossLane.clusters
      .filter((cluster) =>
        cluster.memberProposalIds.some((id) => baselineIds.has(id)))
      .flatMap((cluster) =>
        cluster.memberProposalIds.filter((id) => !baselineIds.has(id))),
  );
  for (const proposalId of duplicateExpansionIds) {
    exclusions.push({
      recordId: proposalId,
      reason:
        "The expanded official result duplicates a baseline event; the common qualifier keeps one immutable event identity rather than inflating the candidate count.",
    });
  }
  const combinedExactIds = new Map<string, Screen02FindProposal>();
  for (const proposal of [
    ...deduplicated,
    ...expandedDeduplicated.filter(
      (proposal) => !duplicateExpansionIds.has(proposal.id),
    ),
    ...contextualFind,
  ]) {
    const prior = combinedExactIds.get(proposal.id);
    combinedExactIds.set(
      proposal.id,
      prior ? mergeScreen02ExactIdProposalSources(prior, proposal) : proposal,
    );
  }
  const combinedDeduplication = deduplicateScreen02Proposals([
    ...combinedExactIds.values(),
  ]);
  const combinedFromRoutes = combinedDeduplication.proposals.filter(
    (proposal): proposal is Screen02FindProposal => proposal.mode === "find",
  );
  const retainedExpandedOrigins: Screen02RetainedOriginMap = new Map();
  for (const proposal of expandedDeduplicated) {
    if (duplicateExpansionIds.has(proposal.id)) continue;
    for (const origin of expandedDeduplicatedOrigins.get(proposal.id) ?? []) {
      appendScreen02RetainedOrigin(
        retainedExpandedOrigins,
        proposal.id,
        origin,
      );
    }
  }
  const combinedFromRoutesOrigins =
    remapScreen02RetainedOriginsThroughDeduplication(
      mergeScreen02RetainedOriginMaps(
        deduplicatedOrigins,
        retainedExpandedOrigins,
        contextOrigins,
      ),
      combinedDeduplication,
    );
  // A host review is explicitly bound to the current pool. Keep those
  // candidates at the front of the bounded raw pool and re-run them through
  // the same fixed qualifier under the pre-host qualification profile. This prevents a
  // nondeterministic connector miss (or a >60 lead response) from silently
  // deleting the very candidates the host reviewed. When a route returned a
  // fresher proposal for the same canonical id, prefer that source-derived
  // proposal; otherwise reconstruct only the already persisted facts.
  const activeSet = state.candidateSets.find(
    (set) =>
      set.candidateSetSnapshotId === state.activeCandidateSetSnapshotId &&
      set.status === "active",
  );
  const candidateBySnapshotId = new Map(
    state.candidates.map((candidate) => [
      candidate.candidateSnapshotId,
      candidate,
    ]),
  );
  const currentHostReviewProposals =
    input.queryPlanning.origin === "chatgpt-host" && activeSet
      ? activeSet.candidateSnapshotIds.flatMap((candidateSnapshotId) => {
          const candidate = candidateBySnapshotId.get(candidateSnapshotId);
          return candidate
            ? [screen02HostLeadBaseProposal(state, candidate)]
            : [];
        })
      : [];
  const currentHostReviewIds = new Set(
    currentHostReviewProposals.map((proposal) => proposal.id),
  );
  const currentHostReviewOrigins: Screen02RetainedOriginMap = new Map();
  if (input.queryPlanning.origin === "chatgpt-host" && activeSet) {
    for (const candidateSnapshotId of activeSet.candidateSnapshotIds) {
      const candidate = candidateBySnapshotId.get(candidateSnapshotId);
      if (!candidate) continue;
      appendScreen02RetainedOrigin(
        currentHostReviewOrigins,
        candidate.candidateId,
        {
          kind: "prior-result",
          retrievalLane: "host-review-carry-forward",
          evidenceRole: "identity",
          producerRecordId: candidate.candidateId,
          priorCandidateSetSnapshotId: activeSet.candidateSetSnapshotId,
          priorCandidateSnapshotId: candidate.candidateSnapshotId,
          sourceIds: [...candidate.sourceIds],
        },
      );
    }
  }
  const refreshedHostReviewSources = new Map<string, Screen02Source[]>();
  for (const proposal of combinedFromRoutes) {
    if (!currentHostReviewIds.has(proposal.id)) continue;
    refreshedHostReviewSources.set(proposal.id, [...proposal.sources]);
  }
  for (const resolution of hostOfficialLeadResolutions) {
    if (
      resolution.status !== "verified" || !resolution.candidateId ||
      !resolution.source || !currentHostReviewIds.has(resolution.candidateId)
    ) continue;
    refreshedHostReviewSources.set(resolution.candidateId, [
      ...(refreshedHostReviewSources.get(resolution.candidateId) ?? []),
      resolution.source,
    ]);
  }
  const changedHostReviewCandidateIds = new Set(
    screen02ChangedHostReviewCandidateIds(
      currentHostReviewProposals,
      refreshedHostReviewSources,
    ),
  );
  const prioritizedCombined = input.queryPlanning.origin === "chatgpt-host"
    ? [
        // Preserve the exact immutable source versions already reviewed by
        // the host. A repeated connector record may reuse a stable source id
        // with a new retrieval timestamp, which must not overwrite or
        // conflict with the persisted source. Newly verified host leads are
        // attached below as distinct fingerprinted sources.
        ...currentHostReviewProposals,
        ...combinedFromRoutes.filter(
          (proposal) => !currentHostReviewIds.has(proposal.id),
        ),
      ]
    : combinedFromRoutes;
  const prioritizedOrigins: Screen02RetainedOriginMap = new Map();
  for (const proposal of prioritizedCombined) {
    const source = currentHostReviewIds.has(proposal.id)
      ? currentHostReviewOrigins
      : combinedFromRoutesOrigins;
    for (const origin of source.get(proposal.id) ?? []) {
      appendScreen02RetainedOrigin(
        prioritizedOrigins,
        proposal.id,
        origin,
      );
    }
  }
  const hostApplied = screen02ApplyHostOfficialLeadResolutions(
    prioritizedCombined,
    state,
    hostOfficialLeadResolutions,
    input.at,
  );
  const combinedUnboundedOrigins = remapScreen02RetainedOriginsByCanonicalId(
    prioritizedOrigins,
    hostApplied.canonicalIdByMember,
  );
  for (const resolution of hostOfficialLeadResolutions) {
    if (
      resolution.status !== "verified" || !resolution.candidateId ||
      !resolution.source
    ) continue;
    const canonicalId = hostApplied.canonicalIdByMember.get(
      resolution.candidateId,
    );
    if (!canonicalId) continue;
    appendScreen02RetainedOrigin(combinedUnboundedOrigins, canonicalId, {
      kind: "query-result",
      retrievalLane: "host-official",
      evidenceRole: resolution.proposal ? "identity" : "support",
      producerRecordId: resolution.candidateId,
      queryId: `${input.searchRoundId}:${resolution.leadId}`.slice(0, 200),
      returnedRecordIds: [resolution.candidateId],
      sourceIds: [resolution.source.id],
    });
  }
  const combinedUnbounded = hostApplied.proposals.map((proposal) => {
    const refreshed = refreshedHostReviewSources.get(proposal.id);
    if (!refreshed) return proposal;
    const additions = screen02FreshRouteSourceVersions(
      proposal.sources,
      refreshed,
    );
    for (const addition of additions) {
      const refreshedSource = refreshed.find((source) =>
        screen02LogicalSourceLocator(source) ===
          screen02LogicalSourceLocator(addition) &&
        (source.evidenceText ?? "") === (addition.evidenceText ?? "")
      );
      if (!refreshedSource) continue;
      for (const origin of
        combinedFromRoutesOrigins.get(proposal.id) ?? []) {
        if (!origin.sourceIds.includes(refreshedSource.id)) continue;
        appendScreen02RetainedOrigin(
          combinedUnboundedOrigins,
          proposal.id,
          origin.kind === "query-result"
            ? {
                ...origin,
                evidenceRole: "support",
                sourceIds: [addition.id],
              }
            : origin,
        );
      }
    }
    return additions.length > 0
      ? { ...proposal, sources: [...proposal.sources, ...additions] }
      : proposal;
  });
  const hasQualificationRecoveryRoute = official.plan.routes.some(
    (route) => route.connectorId === "ftc-press-releases-html-v1",
  );
  const initialRawPool = boundedScreen02RawQualificationPool(
    combinedUnbounded,
    state,
    qualificationProfile,
    hasQualificationRecoveryRoute
      ? SCREEN02_DISCOVERY_RAW_CANDIDATE_MAX - 1
      : SCREEN02_DISCOVERY_RAW_CANDIDATE_MAX,
  );
  const priorInitialProposalById = new Map(
    (prior?.initialEnrichment?.proposals ?? []).map((proposal) => [
      proposal.id,
      proposal,
    ]),
  );
  const initialRawProposals = initialRawPool.proposals.map((proposal) =>
    priorInitialProposalById.get(proposal.id) ?? proposal);
  const currentRunQualificationByProposalId = new Map(
    initialRawPool.qualificationByProposalId,
  );
  for (const proposalId of initialRawPool.droppedProposalIds) {
    exclusions.push({
      recordId: proposalId,
      reason:
        `The proposal was excluded at the fixed ${SCREEN02_DISCOVERY_RAW_CANDIDATE_MAX}-lead raw-pool allowance before deeper retrieval; one slot was reserved for qualification-aware source recovery where available.`,
    });
  }
  const currentInitialEnrichment = await enrichSparseScreen02FindProposals(
    env,
    initialRawProposals,
    state,
    {
      maximumCandidates: input.maximumCandidates,
      retrievedAt: input.at,
      contextualProposals: contextualFind,
      studyProfile: qualificationProfile,
      currentRunQualificationByProposalId:
        initialRawPool.qualificationByProposalId,
      runtime: enrichmentRuntime,
      routeProposals: initialRawPool.proposals,
      concurrency: SCREEN02_SUBSTANTIVE_ENRICHMENT_CONCURRENCY,
      priorRecords: prior?.initialEnrichment?.records ?? [],
      // Preserve two document attempts for a source-recovery lane. Both
      // phases share the same absolute 24-document and 6 MiB run budgets.
      documentFetchLimit: hasQualificationRecoveryRoute
        ? SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_DOCUMENT_FETCHES - 2
        : SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_DOCUMENT_FETCHES,
    },
  );
  const initialEnrichment = {
    ...currentInitialEnrichment,
    candidatesConsidered: Math.max(
      prior?.initialEnrichment?.candidatesConsidered ?? 0,
      currentInitialEnrichment.candidatesConsidered,
    ),
    records: mergeScreen02SubstantiveEnrichmentRecords(
      prior?.initialEnrichment?.records ?? [],
      currentInitialEnrichment.records,
    ),
  };
  for (const [proposalId, qualification] of
    initialEnrichment.qualificationByProposalId) {
    currentRunQualificationByProposalId.set(proposalId, qualification);
  }
  const initialEnrichedById = new Map(
    initialEnrichment.proposals.map((proposal) => [proposal.id, proposal]),
  );
  appendScreen02EnrichmentOrigins(
    combinedUnboundedOrigins,
    initialEnrichment.records,
    input.searchRoundId,
  );
  let postRecoveryUnbounded = initialRawPool.proposals.map(
    (proposal) => initialEnrichedById.get(proposal.id) ?? proposal,
  );
  let postRecoveryOrigins = combinedUnboundedOrigins;
  if (
    boundedInvocation &&
    currentInitialEnrichment.stopReason === "invocation-budget-exhausted"
  ) {
    return pendingContinuation(
      "initial-enrichment",
      {
        proposals: initialEnrichment.proposals,
        records: initialEnrichment.records,
        candidatesConsidered: initialEnrichment.candidatesConsidered,
      },
      prior?.recovery ?? null,
    );
  }
  const availableQualifiedCount = (
    proposals: readonly Screen02FindProposal[],
    currentRunQualificationByProposalId?: ReadonlyMap<
      string,
      Screen02CandidateQualification
    >,
  ) => {
    // Callers compare only with maximumCandidates; no exact above-threshold
    // count is exposed in the manifest or returned workflow state.
    let qualifiedCount = 0;
    for (const proposal of proposals) {
      if (
        (
          !screen02FindPriorCandidateMatch(state, proposal) ||
          currentHostReviewIds.has(proposal.id)
        ) && (() => {
          const currentRun = currentRunQualificationByProposalId?.get(
            proposal.id,
          );
          return screen02CurrentRunQualificationMatches(
              currentRun,
              proposal,
              {
                scopeFingerprint: state.screen01Fingerprint,
                studyProfile: qualificationProfile,
              },
            )
            ? currentRun!.eligible
            : qualifyScreen02FindProposal(
                proposal,
                state.screen01Baseline as unknown as Screen01StudyContext,
                {
                  scopeFingerprint: state.screen01Fingerprint,
                  studyProfile: qualificationProfile,
                },
              ).eligible;
        })()
      ) qualifiedCount += 1;
      if (qualifiedCount >= input.maximumCandidates) break;
    }
    return qualifiedCount;
  };
  let recoveryEnrichment: Awaited<
    ReturnType<typeof enrichSparseScreen02FindProposals>
  > | null = null;
  const dateRange = studyDateRange(
    state.screen01Baseline.scopeContract.studyPeriod,
  );
  if (
    hasQualificationRecoveryRoute &&
    dateRange &&
    !screen02DocumentDeadlineExhausted(enrichmentRuntime) &&
    enrichmentRuntime.receivedBytes <
      SCREEN02_SUBSTANTIVE_ENRICHMENT_TOTAL_BYTES &&
    enrichmentRuntime.documentsAttempted <
      SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_DOCUMENT_FETCHES &&
    availableQualifiedCount(
      initialEnrichment.proposals,
      initialEnrichment.qualificationByProposalId,
    ) <
      input.maximumCandidates
  ) {
    // This is deliberately one serialized request after common qualification,
    // not another fan-out query variant. FTC asks automated clients to retain
    // a five-second crawl delay, so a single request is the complete inline
    // recovery budget for this origin.
    const initialStoppingReason = official.funnel.stoppingReason;
    if (
      initialStoppingReason === "qualification-recovery-completed" ||
      initialStoppingReason === "qualification-recovery-failed" ||
      official.funnel.qualificationRecovery
    ) {
      throw new Error(
        "The FTC qualification-recovery phase cannot execute more than once.",
      );
    }
    const existingRecoveryResult = prior?.recovery?.connectorResult;
    const recoveryFetch = env.CONNECTOR_FETCH ??
      ((request: RequestInfo | URL, init?: RequestInit) =>
        globalThis.fetch(request, init));
    const recoveryResult = existingRecoveryResult ??
      await fetchFtcPressReleaseProposals({
        // The FTC listing is one fixed connector request. Peer-bound
        // A/AAAA/socket transport remains reserved for arbitrary document
        // locators, so the per-invocation reservation charges this once.
        fetch: (request, init) => {
          recoveryConnectorFetchesThisStep += 1;
          return recoveryFetch(request, init);
        },
        ...(!env.CONNECTOR_FETCH
          ? { beforeRequest: scheduleScreen02FtcLiveRequestStart }
          : {}),
        ...(enrichmentRuntime.deadlineAt !== null
          ? { absoluteDeadlineAt: enrichmentRuntime.deadlineAt }
          : {}),
        now: enrichmentRuntime.now,
        ...(invocationDeadlineSignal
          ? { signal: invocationDeadlineSignal }
          : {}),
        retrievedAt: input.at,
        ...dateRange,
        population: state.screen01Baseline.scopeContract.population,
        outcomeFamily: state.screen01Baseline.scopeContract.outcomeFamily,
        query: screen02IndustryRecoveryQuery(
          retrievalProfile.canonicalIndustryLabel,
        ),
        queryId: `${input.searchRoundId}:qualification-recovery:ftc-actions`,
        queryPurpose:
          `Run one serialized FTC-owned discovery request because common qualification retained fewer than ${input.maximumCandidates} candidates; query vocabulary does not establish identity, coverage, or fit.`,
        limit: 20,
        workflowMode: "find",
      });
    recoveryConnectorExecutedThisStep = !existingRecoveryResult;
    const recoveryFailed = recoveryResult.diagnostics.failureKind !== "none";
    const recoveryStoppingReason = recoveryFailed
      ? "qualification-recovery-failed" as const
      : "qualification-recovery-completed" as const;
    official.results.push(recoveryResult);
    official.funnel.queryRequestsExecuted += 1;
    official.funnel.roundsExecuted += 1;
    // The ordinary router has at most two general retrieval rounds. This one
    // conditional phase is an additional explicit cap, not a relabeling of
    // the initial router stop.
    official.funnel.maximumRounds += 1;
    official.funnel.recordsReceived += recoveryResult.diagnostics.recordsReceived;
    official.funnel.proposalsGenerated += recoveryResult.proposals.length;
    official.funnel.uniqueProposalsGenerated =
      screen02UniqueOfficialProposalCount(
        official.results.flatMap((result) => result.proposals),
      );
    official.funnel.qualificationRecovery = {
      connectorId: "ftc-press-releases-html-v1",
      status: recoveryFailed ? "failed" : "completed",
      initialStoppingReason,
      queryRequestsExecuted: 1,
      roundsExecuted: 1,
      recordsReceived: recoveryResult.diagnostics.recordsReceived,
      proposalsGenerated: recoveryResult.proposals.length,
      stoppingReason: recoveryStoppingReason,
    };
    official.funnel.stoppingReason = recoveryStoppingReason;
    const recoveryDeduplication = deduplicateScreen02Proposals(
      recoveryResult.proposals,
    );
    const recoveryProposals = recoveryDeduplication.proposals.filter(
      (proposal): proposal is Screen02FindProposal => proposal.mode === "find",
    );
    const recoveryOrigins = remapScreen02RetainedOriginsThroughDeduplication(
      screen02ConnectorRetainedOrigins(
        [recoveryResult],
        () => "qualification-recovery",
      ),
      recoveryDeduplication,
    );
    const recoveryRawPool = boundedScreen02RawQualificationPool(
      recoveryProposals,
      state,
      qualificationProfile,
      1,
    );
    const priorRecoveryProposalById = new Map(
      (prior?.recovery?.proposals ?? []).map((proposal) => [
        proposal.id,
        proposal,
      ]),
    );
    const recoveryRawProposals = recoveryRawPool.proposals.map((proposal) =>
      priorRecoveryProposalById.get(proposal.id) ?? proposal);
    for (const [proposalId, qualification] of
      recoveryRawPool.qualificationByProposalId) {
      currentRunQualificationByProposalId.set(proposalId, qualification);
    }
    for (const proposalId of recoveryRawPool.droppedProposalIds) {
      exclusions.push({
        recordId: proposalId,
        reason:
          "The FTC qualification-recovery result exceeded the fixed one-lead deep-retrieval allowance for this serialized source route.",
      });
    }
    if (recoveryRawPool.proposals.length > 0) {
      const currentRecoveryEnrichment = await enrichSparseScreen02FindProposals(
        env,
        recoveryRawProposals,
        state,
        {
          maximumCandidates: input.maximumCandidates,
          retrievedAt: input.at,
          contextualProposals: contextualFind,
          studyProfile: qualificationProfile,
          currentRunQualificationByProposalId:
            recoveryRawPool.qualificationByProposalId,
          runtime: enrichmentRuntime,
          routeProposals: recoveryRawPool.proposals,
          concurrency: SCREEN02_SUBSTANTIVE_ENRICHMENT_CONCURRENCY,
          priorRecords: prior?.recovery?.records ?? [],
          documentFetchLimit:
            SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_DOCUMENT_FETCHES,
          fetch: screen02DocumentFetch(env),
          ...(!env.CONNECTOR_FETCH
            ? { beforeDocumentRequest: scheduleScreen02FtcLiveRequestStart }
          : {}),
        },
      );
      recoveryEnrichment = {
        ...currentRecoveryEnrichment,
        candidatesConsidered: Math.max(
          prior?.recovery?.candidatesConsidered ?? 0,
          currentRecoveryEnrichment.candidatesConsidered,
        ),
        records: mergeScreen02SubstantiveEnrichmentRecords(
          prior?.recovery?.records ?? [],
          currentRecoveryEnrichment.records,
        ),
      };
      for (const [proposalId, qualification] of
        recoveryEnrichment.qualificationByProposalId) {
        currentRunQualificationByProposalId.set(proposalId, qualification);
      }
      appendScreen02EnrichmentOrigins(
        recoveryOrigins,
        recoveryEnrichment.records,
        input.searchRoundId,
      );
      const postRecoveryDeduplication = deduplicateScreen02Proposals([
        ...postRecoveryUnbounded,
        ...recoveryEnrichment.proposals,
      ]);
      postRecoveryUnbounded = postRecoveryDeduplication.proposals.filter(
        (proposal): proposal is Screen02FindProposal => proposal.mode === "find",
      );
      postRecoveryOrigins =
        remapScreen02RetainedOriginsThroughDeduplication(
          mergeScreen02RetainedOriginMaps(
            postRecoveryOrigins,
            recoveryOrigins,
          ),
          postRecoveryDeduplication,
        );
      if (
        boundedInvocation &&
        currentRecoveryEnrichment.stopReason ===
          "invocation-budget-exhausted"
      ) {
        return pendingContinuation(
          "recovery-enrichment",
          {
            proposals: initialEnrichment.proposals,
            records: initialEnrichment.records,
            candidatesConsidered: initialEnrichment.candidatesConsidered,
          },
          {
            connectorResult: recoveryResult,
            proposals: recoveryEnrichment.proposals,
            records: recoveryEnrichment.records,
            candidatesConsidered: recoveryEnrichment.candidatesConsidered,
          },
        );
      }
    }
  }
  // The repository-managed public index participates in every ordinary Find
  // request. Its cohort is already available without document fanout; merge
  // it after bounded live/recovery work so those routes retain independent
  // accounting and cannot be skipped merely because the index is full.
  let indexedRegistryUsed: Screen02FindProposal[] = [];
  if (indexedRegistry.length > 0) {
    const indexedOrigins: Screen02RetainedOriginMap = new Map();
    const indexedQueryId = `${input.searchRoundId}:public-event-index`;
    for (const proposal of indexedRegistry) {
      appendScreen02RetainedOrigin(indexedOrigins, proposal.id, {
        kind: "query-result",
        retrievalLane: "reviewed-registry",
        evidenceRole: "identity",
        producerRecordId: proposal.id,
        queryId: indexedQueryId,
        returnedRecordIds: [proposal.id],
        sourceIds: proposal.sources.map((source) => source.id),
      });
    }
    const indexedExactIds = new Map<string, Screen02FindProposal>();
    for (const proposal of [...postRecoveryUnbounded, ...indexedRegistry]) {
      const existing = indexedExactIds.get(proposal.id);
      indexedExactIds.set(
        proposal.id,
        existing
          ? mergeScreen02ExactIdProposalSources(existing, proposal)
          : proposal,
      );
    }
    const indexedDeduplication = deduplicateScreen02Proposals([
      ...indexedExactIds.values(),
    ]);
    postRecoveryUnbounded = indexedDeduplication.proposals.filter(
      (proposal): proposal is Screen02FindProposal => proposal.mode === "find",
    );
    postRecoveryOrigins = remapScreen02RetainedOriginsThroughDeduplication(
      mergeScreen02RetainedOriginMaps(postRecoveryOrigins, indexedOrigins),
      indexedDeduplication,
    );
    const indexedIds = new Set(indexedRegistry.map((proposal) => proposal.id));
    indexedRegistryUsed = postRecoveryUnbounded.filter((proposal) =>
      indexedIds.has(proposal.id)
    );
  }
  const finalRawPool = boundedScreen02RawQualificationPool(
    postRecoveryUnbounded,
    state,
    qualificationProfile,
    SCREEN02_DISCOVERY_RAW_CANDIDATE_MAX,
    currentRunQualificationByProposalId,
  );
  for (const proposalId of finalRawPool.droppedProposalIds) {
    exclusions.push({
      recordId: proposalId,
      reason:
        `The proposal was excluded at the fixed ${SCREEN02_DISCOVERY_RAW_CANDIDATE_MAX}-lead raw-pool cap before common qualification or deeper retrieval.`,
    });
  }
  const combined = finalRawPool.proposals;
  const substantiveRecords = [
    ...initialEnrichment.records,
    ...(recoveryEnrichment?.records ?? []),
  ];
  const substantiveEnrichment = {
    proposals: combined,
    records: substantiveRecords,
    candidatesConsidered:
      initialEnrichment.candidatesConsidered +
      (recoveryEnrichment?.candidatesConsidered ?? 0),
    documentsAttempted: enrichmentRuntime.documentsAttempted,
    bytesReceived: enrichmentRuntime.receivedBytes,
    stopReason: availableQualifiedCount(
      combined,
      finalRawPool.qualificationByProposalId,
    ) >= input.maximumCandidates
      ? "qualified-target-reached" as const
      : screen02DocumentDeadlineExhausted(enrichmentRuntime)
        ? "total-deadline-exhausted" as const
      : enrichmentRuntime.receivedBytes >=
          SCREEN02_SUBSTANTIVE_ENRICHMENT_TOTAL_BYTES
        ? "byte-budget-exhausted" as const
        : enrichmentRuntime.documentsAttempted >=
            SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_DOCUMENT_FETCHES
          ? "document-budget-exhausted" as const
          : combined.length >= SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_CANDIDATES
            ? "candidate-budget-exhausted" as const
            : "bounded-routes-exhausted" as const,
  };
  const laneByProposalId = new Map<string, Screen02QualificationLane>();
  const registryIds = new Set(
    [...registry, ...indexedRegistryUsed].map((proposal) => proposal.id),
  );
  const contextIds = new Set(contextualFind.map((proposal) => proposal.id));
  for (const proposal of combined) {
    laneByProposalId.set(
      proposal.id,
      contextIds.has(proposal.id) || proposal.origin === "unsupported-lead"
        ? "context-live-web"
        : registryIds.has(proposal.id) || proposal.origin === "registry-reviewed"
          ? "reviewed-registry"
          : proposal.origin === "user-provided"
            ? "researcher-source"
            : "official-source",
    );
  }
  const cachedByProposalId = new Map<string, Screen02CandidateQualification>();
  for (const candidate of state.candidates) {
    if (
      Date.parse(candidate.recordedAt) >=
        Date.parse(qualificationProfile.updatedAt) &&
      candidate.qualification?.scopeFingerprint === state.screen01Fingerprint
    ) {
      cachedByProposalId.set(candidate.candidateId, candidate.qualification);
    }
  }
  const newPool: Screen02FindProposal[] = [];
  for (const proposal of combined) {
    const priorMatch = screen02FindPriorCandidateMatch(state, proposal);
    if (
      !priorMatch ||
      (input.queryPlanning.origin === "chatgpt-host" &&
        currentHostReviewIds.has(proposal.id))
    ) {
      newPool.push(proposal);
      continue;
    }
    previouslyShownCount += 1;
    const cached = cachedByProposalId.get(proposal.id);
    const sourceLane = laneByProposalId.get(proposal.id) ??
      (proposal.origin === "user-provided"
        ? "researcher-source"
        : proposal.origin === "registry-reviewed"
          ? "reviewed-registry"
          : proposal.origin === "unsupported-lead"
            ? "context-live-web"
            : "official-source");
    const sourceFingerprint = fingerprintScreen02QualificationSources(
      proposal,
    );
    const expectedCacheKey = screen02QualificationCacheKey({
      scopeFingerprint: state.screen01Fingerprint,
      proposal,
      sourceFingerprint,
      studyProfile: qualificationProfile,
    });
    const reusableCached = qualificationProfile.origin === "fixed-profile" &&
        cached &&
        cached.hostReviewInfluence === undefined &&
        cached.migrationProvenance === undefined &&
        cached.version === SCREEN02_CANDIDATE_QUALIFICATION_VERSION &&
        cached.scopeFingerprint === state.screen01Fingerprint &&
        cached.candidateId === proposal.id &&
        cached.sourceFingerprint === sourceFingerprint &&
        cached.cacheKey === expectedCacheKey
      ? cached
      : null;
    const qualification = reusableCached
      ? {
          ...structuredClone(reusableCached),
          // Cache reuse is execution history, not source provenance. Preserve
          // the stored lane, repairing only the historical cached marker.
          lane: reusableCached.lane === "cached-candidate"
            ? sourceLane
            : reusableCached.lane,
        }
      : qualifyScreen02FindProposal(
          proposal,
          state.screen01Baseline as unknown as Screen01StudyContext,
          {
            scopeFingerprint: state.screen01Fingerprint,
            lane: sourceLane,
            studyProfile: qualificationProfile,
          },
        );
    exclusions.push({
      recordId: proposal.id,
      reason: reusableCached
        ? `${screen02FindPriorCandidateExclusionReason(priorMatch)} The persisted qualification was reused without another assisted-reasoning request.`
        : `${screen02FindPriorCandidateExclusionReason(priorMatch)} The fixed qualification was recomputed from current source evidence without an assisted-reasoning request.`,
      qualification,
    });
  }
  const hostRankingAdjustments = new Map(
    input.queryPlanning.origin === "chatgpt-host"
      ? (input.queryPlanning.rankingAdjustments ?? [])
          .filter((entry) =>
            !changedHostReviewCandidateIds.has(entry.candidateId)
          )
          .map((entry) => [
            entry.candidateId,
            Number.isInteger(entry.adjustment) && Math.abs(entry.adjustment) <= 3
              ? entry.adjustment
              : 0,
          ] as const)
      : [],
  );
  const applicableCandidateReviewInfluenceById =
    input.queryPlanning.origin === "chatgpt-host" &&
      input.queryPlanning.candidateReviewInfluenceById
      ? new Map(
          [...input.queryPlanning.candidateReviewInfluenceById].filter(
            ([candidateId]) =>
              !changedHostReviewCandidateIds.has(candidateId),
          ),
        )
      : undefined;
  const qualified = qualifyAndRankScreen02FindProposals(
    newPool,
    state.screen01Baseline as unknown as Screen01StudyContext,
    {
      scopeFingerprint: state.screen01Fingerprint,
      maximumCandidates: input.maximumCandidates,
      laneByProposalId,
      cachedByProposalId,
      currentRunQualificationByProposalId:
        finalRawPool.qualificationByProposalId,
      studyProfile: qualificationProfile,
      boundedOrderingAdjustments: hostRankingAdjustments,
      ...(applicableCandidateReviewInfluenceById
        ? {
            candidateReviewInfluenceById:
              applicableCandidateReviewInfluenceById,
          }
        : {}),
    },
  );
  const qualificationExclusionsById = new Map<
    string,
    { qualification: Screen02CandidateQualification; reasons: string[] }
  >();
  for (const excluded of qualified.excluded) {
    const entry = qualificationExclusionsById.get(excluded.proposal.id) ?? {
      qualification: excluded.qualification,
      reasons: [],
    };
    entry.reasons.push(excluded.reason);
    qualificationExclusionsById.set(excluded.proposal.id, entry);
  }
  for (const record of substantiveEnrichment.records) {
    if (record.status !== "context-only" && record.status !== "failed") continue;
    const entry = qualificationExclusionsById.get(record.recordId);
    if (entry) entry.reasons.push(record.status === "failed" ? screen02EnrichmentFailureSummary([record]).trim() : record.note);
  }
  for (const [recordId, excluded] of qualificationExclusionsById) {
    exclusions.push({
      recordId,
      reason: [...new Set(excluded.reasons)].join(" "),
      qualification: excluded.qualification,
    });
  }
  const selectedEntries = qualified.selected;
  const selected = selectedEntries.map((entry) => entry.proposal);
  const selectedQualifications = selectedEntries.map(
    (entry) => entry.qualification,
  );
  const selectedSourceIdsByCandidate = new Map(selected.map((proposal) => [
    proposal.id,
    new Set(proposal.sources.map((source) => source.id)),
  ]));
  const persistedDocumentAcquisitions =
    screen02CanonicalRuntimeOrdering(enrichmentRuntime).acquisitions
      .map((acquisition) => {
        const persistedSourceIds = selectedSourceIdsByCandidate.get(
          acquisition.candidateId,
        );
        return acquisition.sourceId &&
            (!persistedSourceIds ||
              !persistedSourceIds.has(acquisition.sourceId))
          ? { ...acquisition, sourceId: null }
          : acquisition;
      });
  const searchFunnel = buildScreen02SearchFunnel({
    sourceRecordsRetrieved:
      official.funnel.recordsReceived +
      (official.expandedResults ?? []).reduce(
        (sum, result) => sum + result.diagnostics.recordsReceived,
        0,
      ) +
      registry.length +
      indexedRegistryUsed.length +
      contextualFind.length +
      hostOfficialLeadResolutions.filter((resolution) => resolution.retrieved)
        .length,
    uniqueEventLeads: postRecoveryUnbounded.length,
    qualifications: qualified.evaluated.map((entry) => entry.qualification),
    displayedCandidates: selected.length,
    deeperRetrievalAttempts: substantiveEnrichment.documentsAttempted,
    retrievalFailures: substantiveEnrichment.records.filter(
      (record) => record.status === "failed",
    ).length,
    hostContribution:
      input.queryPlanning.origin === "chatgpt-host"
        ? official.funnel.hostQueryExecution.executedTerms.length +
          hostOfficialLeadResolutions.filter(
            (resolution) => resolution.status === "verified",
          ).length
        : 0,
  });
  const registryRecord: Screen02SearchManifestSupplement = {
    queryMatrix: [
      {
        id: `${input.searchRoundId}:reviewed-registry`,
        query: `${SCREEN_02_EVENT_REGISTRY_VERSION}: confirmed event family with cross-border leads retained`,
        purpose:
          "Cross-check the reviewed registry without equating the study sample geography with an event's issuing jurisdiction.",
        returnedRecordIds: registry.map((proposal) => proposal.id),
      },
      ...(indexedRegistryUsed.length > 0
        ? [{
            id: `${input.searchRoundId}:public-event-index`,
            query: `${SCREEN02_PUBLIC_EVENT_INDEX_VERSION}: exact bounded cohort match`,
            purpose:
              "Search the repository-managed, source-backed event index for the exact bounded cohort independently of live-source availability.",
            returnedRecordIds: indexedRegistryUsed.map((proposal) => proposal.id),
          }]
        : []),
    ],
    channels: [
      {
        channel: `Reviewed event registry ${SCREEN_02_EVENT_REGISTRY_VERSION}`,
        status: "searched",
        retrievedAt: input.at,
        note: `Returned ${registry.length} event-family-compatible reviewed ${registry.length === 1 ? "record" : "records"}; this registry is bounded and not the complete candidate universe.`,
      },
      ...(indexedRegistryUsed.length > 0
        ? [{
            channel: `Public event index ${SCREEN02_PUBLIC_EVENT_INDEX_VERSION}`,
            status: "searched" as const,
            retrievedAt: input.at,
            note: `Returned ${indexedRegistryUsed.length} repository-managed records from the cohort captured ${SCREEN02_PUBLIC_EVENT_INDEX_CAPTURED_AT}; each record retains stable source locators and explicit date roles, independent of live-source outcomes.`,
          }]
        : []),
    ],
  };
  const supplemental = connectorManifest(official, registryRecord, "find");
  const hostLeadQueryMatrix = hostOfficialLeadResolutions.map(
    (resolution, index) => ({
      id: `${input.searchRoundId}:${resolution.leadId}`.slice(0, 200),
      query: resolution.url,
      purpose: input.queryPlanning.origin === "chatgpt-host"
        ? `Validate one host-proposed official source without trusting its metadata: ${
            input.queryPlanning.officialSourceLeads?.[index]?.reasonForRetrieval ??
              "bounded follow-up retrieval"
          }`.slice(0, 1_000)
        : "Validate one bounded host-proposed official source.",
      returnedRecordIds: resolution.status === "verified" &&
          resolution.candidateId
        ? [resolution.candidateId]
        : [],
    }),
  );
  const hostLeadChannels = hostOfficialLeadResolutions.length > 0
    ? [{
        channel: "Host-proposed official source validation",
        status: hostOfficialLeadResolutions.some((resolution) =>
          resolution.status === "verified")
          ? "searched" as const
          : "failed" as const,
        note: `Fixed software retrieved ${
          hostOfficialLeadResolutions.filter((resolution) => resolution.retrieved)
            .length
        }/${hostOfficialLeadResolutions.length} bounded official response${
          hostOfficialLeadResolutions.length === 1 ? "" : "s"
        } and attached ${
          hostOfficialLeadResolutions.filter((resolution) =>
            resolution.status === "verified").length
        } only after an exact current-candidate identity match or fixed parsing of a new identity and facts from fetched visible content. Host titles, issuers, and jurisdictions were not accepted as facts.`,
        retrievedAt: input.at,
      }]
    : [];
  const hostReviewSourceChangeChannels = changedHostReviewCandidateIds.size > 0
    ? [{
        channel: "Host review source-refresh invalidation",
        status: "searched" as const,
        note: `Fresh fixed retrieval changed the evidence text for ${
          changedHostReviewCandidateIds.size
        } reviewed candidate${
          changedHostReviewCandidateIds.size === 1 ? "" : "s"
        } (${[...changedHostReviewCandidateIds].sort((left, right) =>
          left.localeCompare(right, "en-US")
        ).join(", ")}). The prior immutable source version remains in the audit chain, the fresh body participated in requalification as a separate version, and stale host candidate-review and ranking influence was not applied.`,
        retrievedAt: input.at,
      }]
    : [];
  const continuationAccountingChannels = boundedInvocation
    ? [{
        channel: "Worker continuation request accounting",
        status: "searched" as const,
        note: `Completed ${(prior?.budget.invocationsCompleted ?? 0) + 1} separately dispatched Worker discovery invocation${(prior?.budget.invocationsCompleted ?? 0) + 1 === 1 ? "" : "s"}; this invocation reserved ${enrichmentRuntime.invocationDocumentsAttempted}/${SCREEN_02_CANONICAL_FIND_INVOCATION_DOCUMENT_LIMIT} document acquisitions and the search journal contains ${enrichmentRuntime.documentsAttempted}/${SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_DOCUMENT_FETCHES} total attempts (${enrichmentRuntime.documentAttemptJournal.filter((entry) => entry.status === "ambiguous").length} ambiguous). Admission retained worst-case A, AAAA, and socket headroom per transport hop, while persisted actual platform accounting counts the one Worker fetch dispatched by each reviewed fixed-host connector or document hop. The absolute ${SCREEN02_SUBSTANTIVE_ENRICHMENT_TOTAL_TIMEOUT_MS} ms search deadline ${screen02DocumentDeadlineExhausted(enrichmentRuntime) ? "was exhausted, so finalization performed no further external work" : "remained active through finalization"}. Ordinary connector results were acquired once and reused from authenticated server-owned continuation state.`,
        retrievedAt: input.at,
      }]
    : [];
  const hostLeadExclusions = hostOfficialLeadResolutions
    .filter((resolution) => resolution.status === "rejected")
    .map((resolution) => ({
      recordId: resolution.leadId,
      reason: resolution.reason,
    }));
  const manifest: Screen02WorkflowSearchManifest = {
    protocolVersion: SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_VERSION,
    exactRequest: input.exactRequest,
    queryMatrix: (supplemental.queryMatrix ?? []).map((query) => ({
      id: query.id,
      query: query.query,
      purpose: query.purpose,
      returnedRecordIds: [...(query.returnedRecordIds ?? [])],
    })).concat(
      hostLeadQueryMatrix,
      substantiveEnrichment.records.some((record) =>
        record.levelsAttempted.includes(2))
        ? [{
            id: `${input.searchRoundId}:substantive-overview:full-official-document`,
            query: "Full retained authoritative document for sparse candidate overviews",
            purpose:
              "Populate what changed, who may be affected, and material timing before a sparse record can qualify.",
            returnedRecordIds: substantiveEnrichment.records
              .filter((record) => record.level2SourceIds.length > 0)
              .map((record) => record.recordId),
          }]
        : [],
      substantiveEnrichment.records.some((record) =>
        record.levelsAttempted.includes(3))
        ? [{
            id: `${input.searchRoundId}:substantive-overview:official-explanatory-material`,
            query: "Allowlisted official explanatory materials linked to sparse authoritative records",
            purpose:
              "Use an official FAQ, fact sheet, implementation guide, press release, or equivalent only after the full authoritative document remains insufficient.",
            returnedRecordIds: substantiveEnrichment.records
              .filter((record) => record.level3SourceIds.length > 0)
              .map((record) => record.recordId),
          }]
        : [],
      substantiveEnrichment.records.some((record) =>
        record.levelsAttempted.includes(4))
        ? [{
            id: `${input.searchRoundId}:substantive-overview:contextual-orientation`,
            query: "Fixed-allowlist high-quality contextual orientation for still-sparse records",
            purpose:
              "Provide separately labelled preliminary orientation only; contextual text cannot qualify a candidate or become Screen 3 evidence.",
            returnedRecordIds: substantiveEnrichment.records
              .filter((record) => record.status === "context-only")
              .map((record) => record.recordId),
          }]
        : [],
    ),
    channels: (supplemental.channels ?? []).map((channel) => ({
      channel: channel.channel,
      status: channel.status,
      note: channel.note,
      retrievedAt: channel.retrievedAt ?? null,
    })).concat(
      hostLeadChannels,
      hostReviewSourceChangeChannels,
      continuationAccountingChannels,
      substantiveEnrichment.records.length > 0
        ? [{
            channel: "Bounded substantive-information retrieval ladder",
            status: substantiveEnrichment.records.every(
              (record) => record.status === "failed",
            )
              ? "failed" as const
              : "searched" as const,
            note: `Considered ${substantiveEnrichment.candidatesConsidered} high-potential sparse records and attempted ${substantiveEnrichment.documentsAttempted}/${SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_DOCUMENT_FETCHES} bounded documents across ${substantiveEnrichment.records.length} candidate records; enriched ${substantiveEnrichment.records.filter((record) => record.status === "enriched").length} from authoritative Levels 2–3 and retained ${substantiveEnrichment.records.filter((record) => record.status === "context-only").length} Level 4 orientation-only result${substantiveEnrichment.records.filter((record) => record.status === "context-only").length === 1 ? "" : "s"}. Each response was limited to ${SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_BYTES} bytes (official documents), with ${SCREEN02_SUBSTANTIVE_ENRICHMENT_TOTAL_BYTES} cumulative received-byte rejection bound per search (${substantiveEnrichment.bytesReceived} bytes observed, including rejected chunks), and ${SCREEN02_SUBSTANTIVE_ENRICHMENT_TIMEOUT_MS} ms, Level 2 was capped at ${SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_LEVEL2_DOCUMENTS} text documents per candidate and skipped statically identifiable PDFs, Level 3 was capped at ${SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_LEVEL3_DOCUMENTS} documents per candidate, Level 4 at ${SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_LEVEL4_DOCUMENTS}, concurrency was ${SCREEN02_SUBSTANTIVE_ENRICHMENT_CONCURRENCY}, and the per-run cache was keyed by candidate/source fingerprint. Stop: ${substantiveEnrichment.stopReason}.${screen02EnrichmentFailureSummary(substantiveEnrichment.records)}`,
            retrievedAt: input.at,
          }]
        : [],
    ),
    exclusions: [...exclusions, ...hostLeadExclusions],
    funnel: searchFunnel,
    retrievalExecution: screen02TypedRetrievalExecution(
      official,
      persistedDocumentAcquisitions,
    ),
    ...(official.contextLeads?.length
      ? { contextLeads: official.contextLeads }
      : {}),
    ...(official.contextBridges?.length
      ? { contextBridges: official.contextBridges }
      : {}),
    stoppingRule: {
      rule: `Complete every bounded selected route and stop when ${input.maximumCandidates} qualified candidates are retained or the bounded routes are exhausted; returned titles do not satisfy the target.`,
      // `status` says whether the declared stop was honored, not whether the
      // search found enough candidates. The note and funnel carry that result.
      status: "met",
      note:
        selected.length === 0 && previouslyShownCount > 0
          ? `Evaluated ${qualified.returnedTitleCount} new returned title${qualified.returnedTitleCount === 1 ? "" : "s"}; no new qualified candidate remained after excluding ${previouslyShownCount} previously shown event${previouslyShownCount === 1 ? "" : "s"}. No additional assisted-reasoning follow-up was started.`
          : `Evaluated ${qualified.returnedTitleCount} returned title${qualified.returnedTitleCount === 1 ? "" : "s"}, found ${qualified.qualifiedCandidateCount} source-qualified candidate${qualified.qualifiedCandidateCount === 1 ? "" : "s"} before the ordinary broad-result and comparison limits, and retained ${selected.length}. The substantive ladder stopped at ${substantiveEnrichment.stopReason}; only qualified-target-reached denotes candidate-target success, while every other reason records bounded exhaustion or a resource limit. ${supplemental.stoppingRule?.note ?? "The bounded source routes completed."}`.trim(),
    },
    retrievedAt: input.at,
    outcomeValuesInspected: false,
  };
  const discovery = buildScreen02FindDiscoveryFromProposals(state, {
    searchRoundId: input.searchRoundId,
    at: input.at,
    proposals: selected,
    manifest,
    resultOrigins: selected.map((proposal) => ({
      proposalId: proposal.id,
      origins: requireExactScreen02RetainedOrigins(
        proposal.id,
        proposal.sources.map((source) => source.id),
        postRecoveryOrigins.get(proposal.id) ?? [],
      ),
    })),
    qualifications: selectedQualifications,
    ...(input.queryPlanning.origin === "chatgpt-host"
      ? {
          reconsiderPriorCandidateIds: selected
            .map((proposal) => proposal.id)
            .filter((candidateId) => currentHostReviewIds.has(candidateId)),
        }
      : {}),
  });
  const persistedSourceById = new Map(
    discovery.sources.map((source) => [source.id, source]),
  );
  const officialSourceLeadAudit = hostOfficialLeadResolutions.map(
    (resolution) => {
      const persisted = resolution.source
        ? persistedSourceById.get(resolution.source.id)
        : undefined;
      return {
        leadId: resolution.leadId,
        leadFingerprint: resolution.leadFingerprint,
        contentFingerprint: resolution.contentFingerprint,
        verificationStatus: resolution.status,
        resultingSourceId: resolution.source?.id ?? null,
        resultingSourceFingerprint: persisted?.sourceFingerprint ?? null,
        resultingSourceStatus: resolution.status === "rejected"
          ? "rejected" as const
          : persisted
            ? "persisted" as const
            : "not-retained" as const,
      };
    },
  );
  return {
    status: "complete",
    progress: canonicalProgress(),
    discovery: {
      ...discovery,
      verifiedOfficialSourceLeadCount: hostOfficialLeadResolutions.filter(
        (resolution) => resolution.status === "verified",
      ).length,
      ...(input.queryPlanning.origin === "chatgpt-host"
        ? {
            hostQueryExecution: official.funnel.hostQueryExecution,
            officialSourceLeadAudit,
          }
        : {}),
    },
  };
}

/**
 * Executes one separately budgeted canonical Find step. Callers must retain
 * the returned continuation in authenticated server-owned storage and pass it
 * back unchanged from that storage; it is not an app/client state capsule.
 */
export function continueCanonicalScreen02Find(
  env: ShockAuditEnv,
  state: Screen02FindState,
  input: Screen02CanonicalFindInput,
  prior?: Screen02CanonicalFindContinuation,
): Promise<Screen02CanonicalFindStepResult> {
  return executeCanonicalScreen02FindStep(env, state, input, prior, true);
}

/**
 * Compatibility path for existing in-process and host-task callers. The
 * canonical app transport uses `continueCanonicalScreen02Find` so a fresh
 * Worker/MCP request owns each two-document allowance.
 */
export async function discoverCanonicalScreen02Find(
  env: ShockAuditEnv,
  state: Screen02FindState,
  input: Screen02CanonicalFindInput,
): Promise<Screen02CanonicalFindDiscovery> {
  const result = await executeCanonicalScreen02FindStep(
    env,
    state,
    input,
    undefined,
    false,
  );
  if (result.status !== "complete") {
    throw new Error(
      "The compatibility Screen 2 discovery path unexpectedly yielded a continuation.",
    );
  }
  return result.discovery;
}

const SCREEN_02_FIND_MAX_ORDINARY_CONNECTOR_FETCHES = 18;
const SCREEN_02_FIND_MAX_TOTAL_CONNECTOR_FETCHES = 19;
const SCREEN_02_FIND_MAX_CONTINUATION_REQUESTS = 16;
const SCREEN_02_FIND_PLATFORM_SUBREQUEST_HEADROOM = 7;

type Screen02FindContinuationRuntimeInput = Parameters<
  NonNullable<Screen02WorkflowRuntimeOptions["continueFind"]>
>[1];

function screen02FindStoreCheckpoint(
  record: Screen02FindContinuationRecord,
): Screen02FindStoredStep | null {
  if (record.checkpoint === null) return null;
  return decodeScreen02FindStoreCheckpoint(record.checkpoint);
}

function screen02FindRuntimeResult(
  step: Screen02FindStoredStep | Screen02CanonicalFindStepResult,
) {
  return step.status === "complete"
    ? { status: "complete" as const, discovery: step.discovery }
    : {
        status: "pending" as const,
        message:
          "Find discovery saved bounded source progress and will continue automatically.",
      };
}

function screen02FindRuntimeFailure(
  code: string | readonly string[],
  message: string,
  retryable = false,
) {
  return {
    status: "failed" as const,
    failureCodes: Array.isArray(code) ? [...code] : [code],
    message,
    retryable,
  };
}

type Screen02FindClassifiedFailure = {
  failureClass: Screen02FindContinuationFailureClass;
  stage: Screen02FindContinuationFailureStage;
  retryable: boolean;
  diagnosticReference: string;
};

function screen02FindFailureText(error: unknown) {
  const name = error instanceof Error
    ? error.name.slice(0, 100)
    : typeof error;
  const message = error instanceof Error
    ? error.message.slice(0, 2_000)
    : "non-error throw";
  return { name, message, searchable: `${name}: ${message}`.toLowerCase() };
}

export function classifyScreen02FindContinuationFailure(
  error: unknown,
  stage: Screen02FindContinuationFailureStage,
): Screen02FindClassifiedFailure {
  const detail = screen02FindFailureText(error);
  const failureClass: Screen02FindContinuationFailureClass =
    stage === "checkpoint-persistence" &&
        error instanceof Screen02FindStoreCheckpointError &&
        error.code === "checkpoint-capacity"
      ? "checkpoint-capacity"
      : stage === "final-state-persistence" &&
          error instanceof Screen02StateCapacityError
        ? "final-state-capacity"
        : /\b(?:dns|resolve|resolver|socket|tls|transport|econn|enotfound|network connection)\b/u
            .test(detail.searchable)
          ? "dns-transport"
          : /\b(?:invalid|unsupported|malformed) (?:url|uri|request|method|query)|request construction|failed to parse url\b/u
              .test(detail.searchable)
            ? "request-construction"
            : /\b(?:parser|parsing|identity|wrong document|content type|content-type|unrecognized document|not canonical)\b/u
                .test(detail.searchable)
              ? "parser-identity-rejection"
              : /\b(?:timeout|timed out|abort|unavailable|http [45]\d\d|fetch failed|source response|source request)\b/u
                  .test(detail.searchable)
                ? "source-unavailability"
                : /\b(?:stale|conflict|supersed|lease|rebound|ownership)\b/u
                    .test(detail.searchable)
                  ? "stale-conflicting-operation"
                  : "unexpected-internal";
  return {
    failureClass,
    stage,
    retryable: [
      "source-unavailability",
      "dns-transport",
      "stale-conflicting-operation",
    ].includes(failureClass),
    diagnosticReference: fingerprintScreen02WorkflowValue({
      schemaVersion: "screen-02-find-failure-diagnostic-v1",
      stage,
      failureClass,
      name: detail.name,
      message: detail.message,
    }),
  };
}

function screen02FindStoredFailureResult(
  record: Screen02FindContinuationRecord,
) {
  const failure = record.failure;
  if (!failure) {
    return screen02FindRuntimeFailure(
      "continuation-terminal",
      "The bounded Find continuation ended without a retained failure class.",
    );
  }
  const message =
    `The bounded Find operation failed at ${failure.stage} with ${failure.failureClass} (${failure.diagnosticReference}).`;
  if (screen02FindContinuationHasPendingRetry(record)) {
    return screen02FindRuntimeFailure(
      [
        `continuation-failure-${failure.failureClass}`,
        `continuation-stage-${failure.stage}`,
      ],
      `${message} One continuation-preserving retry remains.`,
      true,
    );
  }
  return screen02FindRuntimeFailure(
    [
      `continuation-failure-${failure.failureClass}`,
      `continuation-stage-${failure.stage}`,
    ],
    message,
  );
}

async function settleScreen02FindContinuationFailure(input: {
  env: ShockAuditEnv;
  continuationStore: Screen02FindContinuationStore;
  binding: Awaited<ReturnType<typeof createScreen02FindContinuationBinding>>;
  continuationId: string;
  record: Screen02FindContinuationRecord;
  operationId: string;
  inputFingerprint: string;
  leaseGeneration: number;
  continuedAt: string;
  error: unknown;
  stage: Screen02FindContinuationFailureStage;
  actualUsage: Screen02FindContinuationWork | null;
  checkpoint?: unknown;
  checkpointBytes?: number | null;
  finalStateBytes?: number | null;
}) {
  const classified = classifyScreen02FindContinuationFailure(
    input.error,
    input.stage,
  );
  let observedFailureAt = input.continuedAt;
  try {
    const observed = observedAt(input.env);
    if (Date.parse(observed) >= Date.parse(observedFailureAt)) {
      observedFailureAt = observed;
    }
  } catch {
    // The already validated invocation timestamp remains the bounded fallback.
  }
  try {
    const settlement = await input.continuationStore.fail({
      binding: input.binding,
      continuationId: input.continuationId,
      expected: {
        revision: input.record.revision,
        cursor: input.record.cursor,
      },
      operationId: input.operationId,
      inputFingerprint: input.inputFingerprint,
      leaseGeneration: input.leaseGeneration,
      failedAt: observedFailureAt,
      actualUsage: input.actualUsage,
      ...(input.checkpoint === undefined
        ? {}
        : { checkpoint: input.checkpoint }),
      stage: classified.stage,
      failureClass: classified.failureClass,
      checkpointBytes: input.checkpointBytes ??
        (input.error instanceof Screen02FindStoreCheckpointError
          ? input.error.checkpointBytes
          : null),
      finalStateBytes: input.finalStateBytes ?? null,
      retryable: classified.retryable,
      diagnosticReference: classified.diagnosticReference,
    });
    if (
      (settlement.outcome === "failed" ||
        settlement.outcome === "replayed") &&
      settlement.record.failure
    ) {
      return screen02FindStoredFailureResult(settlement.record);
    }
  } catch {
    // Do not clear a lease without proving the exact operation and generation.
  }
  return screen02FindRuntimeFailure(
    [
      `continuation-failure-${classified.failureClass}`,
      "continuation-failure-settlement-conflict",
    ],
    `The bounded Find operation failed at ${classified.stage} with ${classified.failureClass}; exact lease settlement could not be verified (${classified.diagnosticReference}).`,
  );
}

function screen02FindContinuationReservation(
  record: Screen02FindContinuationRecord,
  prior: Screen02CanonicalFindContinuation | undefined,
): Screen02FindContinuationReservation {
  const documentAttempts = Math.min(
    SCREEN_02_CANONICAL_FIND_INVOCATION_DOCUMENT_LIMIT,
    Math.max(
      0,
      SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_DOCUMENT_FETCHES -
        record.usage.documentAttempts,
    ),
  );
  const firstInvocation = prior === undefined;
  const connectorFetches = firstInvocation
    ? SCREEN_02_FIND_MAX_TOTAL_CONNECTOR_FETCHES
    : prior.recovery === null &&
        record.usage.connectorFetches <
          SCREEN_02_FIND_MAX_TOTAL_CONNECTOR_FETCHES
      ? 1
      : 0;
  const maximumReceivedBytes = Math.min(
    Math.max(
      0,
      SCREEN_02_DOCUMENT_ACQUISITION_MAX_RECORDED_TOTAL_BYTES -
        record.usage.receivedBytes,
    ),
    documentAttempts * SCREEN_02_DOCUMENT_ACQUISITION_MAX_RECORDED_BYTES,
  );
  return {
    sourceQueries: connectorFetches,
    connectorFetches,
    documentAttempts,
    // One initial request plus at most three manual redirects. Each secure
    // hop reserves A + AAAA lookup and one outbound socket subrequest.
    transportHops: documentAttempts *
      (SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_REDIRECTS + 1),
    redirectHops: documentAttempts *
      SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_REDIRECTS,
    retries: screen02FindContinuationHasPendingRetry(record) ? 1 : 0,
    maximumReceivedBytes,
  };
}

function screen02FindContinuationActualUsage(
  prior: Screen02CanonicalFindContinuation | undefined,
  step: Screen02CanonicalFindStepResult,
  retries = 0,
): Screen02FindContinuationWork {
  const priorDocuments = prior?.budget.documentsAttempted ?? 0;
  const priorBytes = prior?.budget.receivedBytes ?? 0;
  const priorAcquisitions = prior?.budget.acquisitions.length ?? 0;
  const currentAcquisitions = step.progress.acquisitions.slice(
    priorAcquisitions,
  );
  const redirectHops = currentAcquisitions.reduce(
    (sum, acquisition) => sum + acquisition.redirectChain.length,
    0,
  );
  const documentAttempts = Math.max(
    0,
    step.progress.documentsAttempted - priorDocuments,
  );
  const transportHops = Math.max(
    documentAttempts,
    currentAcquisitions.length + redirectHops,
  );
  const ordinaryConnectorFetches = step.progress.ordinaryConnectorFetches;
  const recoveryConnectorFetches = step.progress.recoveryConnectorFetches;
  const connectorFetches =
    ordinaryConnectorFetches + recoveryConnectorFetches;
  return {
    sourceQueries:
      step.progress.ordinarySourceQueries +
      step.progress.recoverySourceQueries,
    connectorFetches,
    documentAttempts,
    transportHops,
    redirectHops,
    retries,
    receivedBytes: Math.max(0, step.progress.receivedBytes - priorBytes),
  };
}

async function runCanonicalScreen02FindContinuation(
  env: ShockAuditEnv,
  state: Screen02FindState,
  input: Screen02FindContinuationRuntimeInput,
) {
  const workflowStore = env.SCREEN02_WORKFLOW_STORE;
  const continuationStore = env.SCREEN02_FIND_CONTINUATION_STORE;
  if (!workflowStore || !continuationStore) {
    return screen02FindRuntimeFailure(
      "continuation-runtime-unavailable",
      "The server-side Find continuation runtime is unavailable.",
    );
  }
  if (input.queryPlanning.origin !== "fixed-fallback") {
    return screen02FindRuntimeFailure(
      "continuation-planning-unsupported",
      "This continuation route accepts only the fixed source-query plan.",
    );
  }
  // Persistent continuation deadlines use the same ISO wall-clock domain as
  // the Durable Object journal. Do not inherit a connector-telemetry test
  // clock here: mixing a relative monotonic value with an epoch deadline can
  // accidentally widen AbortSignal timeouts by decades.
  const continuationNow = () => Date.parse(observedAt(env));
  const continuationEnv: ShockAuditEnv = {
    ...env,
    SCREEN02_SEARCH_MONOTONIC_NOW: continuationNow,
  };
  const parentRead = await workflowStore.read({
    runId: state.runId,
    accessToken: input.accessToken,
  });
  if (
    parentRead.outcome !== "authenticated" ||
    parentRead.record.mode !== "find" ||
    parentRead.record.stateRevision !== state.revision ||
    parentRead.record.stateFingerprint !==
      fingerprintScreen02WorkflowState(state)
  ) {
    return screen02FindRuntimeFailure(
      "continuation-parent-conflict",
      "The authenticated Find parent changed before source retrieval continued.",
    );
  }
  const activeDiscovery = state.discoveryRequests.find((request) =>
    request.status === "searching" &&
    request.discoveryRequestId === input.discoveryRequestId
  );
  if (
    !activeDiscovery ||
    activeDiscovery.searchRoundId !== input.searchRoundId ||
    activeDiscovery.candidateSetSnapshotId !==
      input.candidateSetSnapshotId ||
    activeDiscovery.exactRequest !== input.exactRequest ||
    activeDiscovery.startedAt !== input.at
  ) {
    return screen02FindRuntimeFailure(
      "continuation-request-conflict",
      "The Find continuation no longer matches the active source search.",
    );
  }
  const binding = await createScreen02FindContinuationBinding(
    parentRead.record,
    input.accessToken,
  );
  const continuationId = input.discoveryRequestId;
  const exactRequest = {
    schemaVersion: SCREEN_02_CANONICAL_FIND_CONTINUATION_SCHEMA_VERSION,
    discoveryRequestId: input.discoveryRequestId,
    searchRoundId: input.searchRoundId,
    candidateSetSnapshotId: input.candidateSetSnapshotId,
    at: input.at,
    exactRequest: input.exactRequest,
    maximumCandidates: input.maximumCandidates,
    queryPlanning: input.queryPlanning,
  };
  const definitionFingerprint = fingerprintScreen02WorkflowValue({
    schemaVersion: "screen-02-find-continuation-definition-v1",
    exactRequest,
    criteria: activeScreen02FindCriteria(state),
    relevanceProfile: screen02FindRelevanceProfile(state),
  });
  const criteriaFingerprint = fingerprintScreen02WorkflowValue(
    activeScreen02FindCriteria(state),
  );
  const relevanceProfileFingerprint = fingerprintScreen02WorkflowValue(
    screen02FindRelevanceProfile(state),
  );
  let read = await continuationStore.read(binding, continuationId);
  if (read.outcome === "not-found") {
    const createdAtMs = Date.parse(input.at);
    const parentExpiresAtMs = Date.parse(parentRead.record.expiresAt);
    const absoluteDeadlineMs = Math.min(
      createdAtMs + SCREEN02_SUBSTANTIVE_ENRICHMENT_TOTAL_TIMEOUT_MS,
      parentExpiresAtMs,
    );
    if (!Number.isFinite(createdAtMs) || absoluteDeadlineMs <= createdAtMs) {
      return screen02FindRuntimeFailure(
        "continuation-deadline-exhausted",
        "The bounded Find source-search deadline expired before retrieval could continue.",
      );
    }
    const created = await continuationStore.create({
      binding,
      continuationId,
      operationId: continuationId,
      inputFingerprint: definitionFingerprint,
      discoveryRequestId: input.discoveryRequestId,
      searchRoundId: input.searchRoundId,
      candidateSetSnapshotId: input.candidateSetSnapshotId,
      exactRequest,
      criteriaFingerprint,
      relevanceProfileFingerprint,
      discoveryVersion: SCREEN_02_CANONICAL_FIND_CONTINUATION_SCHEMA_VERSION,
      sourcePolicyVersion: SCREEN_02_SOURCE_POLICY_VERSION,
      parserVersion: SCREEN_02_DOCUMENT_ACQUISITION_SCHEMA_VERSION,
      qualificationVersion: SCREEN02_CANDIDATE_QUALIFICATION_VERSION,
      limits: {
        maxSourceQueries: SCREEN_02_FIND_MAX_TOTAL_CONNECTOR_FETCHES,
        maxConnectorFetches: SCREEN_02_FIND_MAX_TOTAL_CONNECTOR_FETCHES,
        maxDocumentAttempts:
          SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_DOCUMENT_FETCHES,
        maxTransportHops:
          SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_DOCUMENT_FETCHES *
            (SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_REDIRECTS + 1),
        maxRedirectHops:
          SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_DOCUMENT_FETCHES *
            SCREEN02_SUBSTANTIVE_ENRICHMENT_MAX_REDIRECTS,
        maxRetries: 1,
        // 6 MiB remains the accepted-body ceiling. One additional byte is
        // only the bounded persisted sentinel proving overflow rejection.
        maxReceivedBytes:
          SCREEN_02_DOCUMENT_ACQUISITION_MAX_RECORDED_TOTAL_BYTES,
        maxContinuationRequests:
          SCREEN_02_FIND_MAX_CONTINUATION_REQUESTS,
        requiredPlatformSubrequestHeadroom:
          SCREEN_02_FIND_PLATFORM_SUBREQUEST_HEADROOM,
      },
      checkpoint: null,
      createdAt: input.at,
      absoluteDeadline: new Date(absoluteDeadlineMs).toISOString(),
      expiresAt: parentRead.record.expiresAt,
    });
    if (created.outcome === "parent-unavailable") {
      return screen02FindRuntimeFailure(
        "continuation-parent-conflict",
        "The authenticated Find parent became unavailable before continuation state was saved.",
      );
    }
    if (created.outcome === "conflict") {
      return screen02FindRuntimeFailure(
        "continuation-request-conflict",
        "A different source search already owns this continuation identity.",
      );
    }
    read = { outcome: "found", record: created.record };
  }
  if (read.outcome !== "found") {
    return screen02FindRuntimeFailure(
      read.outcome === "parent-unavailable"
        ? "continuation-parent-conflict"
        : "continuation-access-rejected",
      "The server-owned Find continuation could not be authenticated.",
    );
  }
  let record = read.record;
  if (
    !sameDeterministicJson(record.exactRequest, exactRequest) ||
    record.requestFingerprint !==
      fingerprintScreen02WorkflowValue(exactRequest) ||
    record.criteriaFingerprint !== criteriaFingerprint ||
    record.relevanceProfileFingerprint !== relevanceProfileFingerprint ||
    record.discoveryVersion !==
      SCREEN_02_CANONICAL_FIND_CONTINUATION_SCHEMA_VERSION ||
    record.sourcePolicyVersion !== SCREEN_02_SOURCE_POLICY_VERSION ||
    record.parserVersion !==
      SCREEN_02_DOCUMENT_ACQUISITION_SCHEMA_VERSION ||
    record.qualificationVersion !==
      SCREEN02_CANDIDATE_QUALIFICATION_VERSION
  ) {
    return screen02FindRuntimeFailure(
      "continuation-version-conflict",
      "The saved Find continuation no longer matches the current source, parser, or qualification policy.",
    );
  }
  let storedStep: Screen02FindStoredStep | null;
  try {
    storedStep = screen02FindStoreCheckpoint(record);
  } catch (error) {
    const classified = classifyScreen02FindContinuationFailure(
      error,
      "checkpoint-persistence",
    );
    return screen02FindRuntimeFailure(
      [
        `continuation-failure-${classified.failureClass}`,
        "continuation-checkpoint-invalid",
      ],
      `The server-owned Find checkpoint failed its integrity contract (${classified.diagnosticReference}).`,
    );
  }
  if (record.status !== "active") {
    if (
      (record.status === "partial" || record.status === "completed") &&
      storedStep?.status === "complete"
    ) {
      try {
        input.preflightCompletion(storedStep.discovery);
      } catch (error) {
        const classified = classifyScreen02FindContinuationFailure(
          error,
          "final-state-persistence",
        );
        return screen02FindRuntimeFailure(
          [
            `continuation-failure-${classified.failureClass}`,
            `continuation-stage-${classified.stage}`,
          ],
          `The saved Find result no longer fits its canonical parent state (${classified.diagnosticReference}).`,
        );
      }
      return screen02FindRuntimeResult(storedStep);
    }
    return record.failure
      ? screen02FindStoredFailureResult(record)
      : screen02FindRuntimeFailure(
          "continuation-terminal",
          "The bounded Find continuation ended before a complete source result was available.",
        );
  }
  if (storedStep?.status === "complete") {
    // The exact final discovery was made durable before the parent workflow
    // update. A retry after a parent-store interruption reuses it without I/O.
    try {
      input.preflightCompletion(storedStep.discovery);
      return screen02FindRuntimeResult(storedStep);
    } catch (error) {
      const classified = classifyScreen02FindContinuationFailure(
        error,
        "final-state-persistence",
      );
      return screen02FindRuntimeFailure(
        [
          `continuation-failure-${classified.failureClass}`,
          `continuation-stage-${classified.stage}`,
        ],
        `The saved Find result no longer fits its canonical parent state (${classified.diagnosticReference}).`,
      );
    }
  }
  const inputFingerprint = fingerprintScreen02WorkflowValue({
    schemaVersion: "screen-02-find-continuation-operation-v1",
    operationId: input.operationId,
    definitionFingerprint,
  });
  const replay = record.journal.find((entry) =>
    entry.operationId === input.operationId
  );
  if (replay?.status === "committed") {
    const latestJournalEntry = record.journal.at(-1);
    const currentOutcomeFingerprint = replay.actualUsage && storedStep
      ? fingerprintScreen02FindContinuationOutcome({
          actualUsage: replay.actualUsage,
          checkpoint: record.checkpoint,
          status: "active",
        })
      : null;
    if (
      replay.inputFingerprint !== inputFingerprint || !storedStep ||
      latestJournalEntry !== replay || record.lease !== null ||
      replay.outcomeFingerprint !== currentOutcomeFingerprint
    ) {
      return screen02FindRuntimeFailure(
        "continuation-replay-conflict",
        "The Find continuation operation was superseded or did not match its saved result.",
      );
    }
    return screen02FindRuntimeResult(storedStep);
  }
  if (replay?.status === "ambiguous") {
    return screen02FindRuntimeFailure(
      "continuation-execution-ambiguous",
      "A prior Find source operation ended without a provable result and was not repeated.",
    );
  }
  const prior = storedStep?.status === "pending"
    ? storedStep.continuation
    : undefined;
  const continuationDeadlineAt = Date.parse(record.absoluteDeadline);
  if (
    prior &&
    (prior.budget.deadlineAt !== continuationDeadlineAt ||
      prior.budget.deadlineStartedAt !==
        continuationDeadlineAt -
          SCREEN02_SUBSTANTIVE_ENRICHMENT_TOTAL_TIMEOUT_MS)
  ) {
    return screen02FindRuntimeFailure(
      "continuation-deadline-conflict",
      "The saved Find continuation deadline does not match its authenticated search record.",
    );
  }
  if (
    prior && record.lease === null &&
    screen02CanonicalFindContinuationDeadlineExhausted(
      prior,
      continuationNow,
    )
  ) {
    // The canonical core proves this branch is deterministic finalization of
    // already retained evidence: it advances no route and performs no fetch.
    // It is therefore safe after the network-acquisition deadline and can be
    // replayed until the parent workflow commits the terminal result.
    const finalized = await continueCanonicalScreen02Find(
      continuationEnv,
      state,
      {
        searchRoundId: input.searchRoundId,
        at: input.at,
        exactRequest: input.exactRequest,
        maximumCandidates: input.maximumCandidates,
        continuationDeadlineAt,
        queryPlanning: input.queryPlanning,
      },
      prior,
    );
    const actualUsage = screen02FindContinuationActualUsage(prior, finalized);
    if (
      finalized.status !== "complete" ||
      Object.values(actualUsage).some((value) => value !== 0)
    ) {
      throw new Error(
        "Deadline finalization attempted new Find source work.",
      );
    }
    try {
      input.preflightCompletion(finalized.discovery);
    } catch (error) {
      const classified = classifyScreen02FindContinuationFailure(
        error,
        "final-state-persistence",
      );
      return screen02FindRuntimeFailure(
        [
          `continuation-failure-${classified.failureClass}`,
          `continuation-stage-${classified.stage}`,
        ],
        `The deadline-finalized Find result did not fit its canonical parent state (${classified.diagnosticReference}).`,
      );
    }
    return screen02FindRuntimeResult(finalized);
  }
  const reservation = replay?.status === "reserved"
    ? replay.reservation
    : screen02FindContinuationReservation(record, prior);
  const reservedAtMs = Date.parse(input.continuedAt);
  const leaseExpiresAtMs = Math.min(
    reservedAtMs + SCREEN02_SUBSTANTIVE_ENRICHMENT_TOTAL_TIMEOUT_MS,
    continuationDeadlineAt,
  );
  if (!Number.isFinite(reservedAtMs) || leaseExpiresAtMs <= reservedAtMs) {
    return screen02FindRuntimeFailure(
      "continuation-deadline-exhausted",
      "The bounded Find source-search deadline expired before another operation could start.",
    );
  }
  const reserved = await continuationStore.reserve({
    binding,
    continuationId,
    expected: { revision: record.revision, cursor: record.cursor },
    operationId: input.operationId,
    inputFingerprint,
    reservation,
    reservedAt: input.continuedAt,
    leaseExpiresAt: new Date(leaseExpiresAtMs).toISOString(),
  });
  if (
    reserved.outcome === "recovered-ambiguous" ||
    reserved.outcome === "busy"
  ) {
    if (reserved.outcome === "busy") {
      throw new Error(
        "Another authenticated Find continuation operation is still active.",
      );
    }
    return screen02FindRuntimeFailure(
      "continuation-execution-ambiguous",
      "A prior Find source operation ended without a provable result and was not repeated.",
    );
  }
  if (reserved.outcome === "replayed-resolved") {
    if (reserved.record.failure) {
      return screen02FindStoredFailureResult(reserved.record);
    }
    const replayedStep = screen02FindStoreCheckpoint(reserved.record);
    return replayedStep
      ? screen02FindRuntimeResult(replayedStep)
      : screen02FindRuntimeFailure(
          "continuation-replay-conflict",
          "The saved Find continuation result could not be recovered.",
        );
  }
  if (reserved.outcome === "limit-exceeded") {
    return screen02FindRuntimeFailure(
      "continuation-budget-exhausted",
      `The bounded Find continuation stopped at its ${reserved.reason} limit.`,
    );
  }
  if (
    reserved.outcome === "not-found" ||
    reserved.outcome === "unauthorized" ||
    reserved.outcome === "parent-unavailable" ||
    reserved.outcome === "conflict" ||
    reserved.outcome === "terminal"
  ) {
    return screen02FindRuntimeFailure(
      "continuation-state-conflict",
      "The server-owned Find continuation changed before its source budget was reserved.",
    );
  }
  if (reserved.outcome !== "reserved" && reserved.outcome !== "replayed") {
    return screen02FindRuntimeFailure(
      "continuation-state-conflict",
      "The server-owned Find continuation returned an unsupported reservation state.",
    );
  }
  if (reserved.outcome === "replayed") {
    // The original lease still owns any possibly in-flight source work. A
    // duplicate transport submission must never execute the canonical core.
    throw new Error(
      "This authenticated Find continuation operation is still active.",
    );
  }
  record = reserved.record;
  let step: Screen02CanonicalFindStepResult;
  try {
    step = await continueCanonicalScreen02Find(
      continuationEnv,
      state,
      {
        searchRoundId: input.searchRoundId,
        at: input.at,
        exactRequest: input.exactRequest,
        maximumCandidates: input.maximumCandidates,
        continuationDeadlineAt,
        queryPlanning: input.queryPlanning,
      },
      prior,
    );
  } catch (error) {
    return settleScreen02FindContinuationFailure({
      env,
      continuationStore,
      binding,
      continuationId,
      record,
      operationId: input.operationId,
      inputFingerprint,
      leaseGeneration: reserved.lease.leaseGeneration,
      continuedAt: input.continuedAt,
      error,
      stage: "source-retrieval",
      actualUsage: null,
    });
  }
  const actualUsage = screen02FindContinuationActualUsage(
    prior,
    step,
    reserved.lease.reservation.retries,
  );
  if (step.status === "complete") {
    try {
      input.preflightCompletion(step.discovery);
    } catch (error) {
      return settleScreen02FindContinuationFailure({
        env,
        continuationStore,
        binding,
        continuationId,
        record,
        operationId: input.operationId,
        inputFingerprint,
        leaseGeneration: reserved.lease.leaseGeneration,
        continuedAt: input.continuedAt,
        error,
        stage: "final-state-persistence",
        actualUsage,
      });
    }
  }
  let checkpoint: ReturnType<typeof encodeScreen02FindStoreCheckpoint>;
  try {
    checkpoint = encodeScreen02FindStoreCheckpoint(step);
  } catch (error) {
    return settleScreen02FindContinuationFailure({
      env,
      continuationStore,
      binding,
      continuationId,
      record,
      operationId: input.operationId,
      inputFingerprint,
      leaseGeneration: reserved.lease.leaseGeneration,
      continuedAt: input.continuedAt,
      error,
      stage: "checkpoint-persistence",
      actualUsage,
    });
  }
  // A terminal checkpoint is commit-ready, not yet parent-committed. Keeping
  // the private record explicitly partial avoids claiming completion before
  // the separately stored canonical candidate state is durable; an exact
  // retry replays this checkpoint without source I/O.
  const nextStatus = step.status === "complete" ? "partial" : "active";
  const outcomeFingerprint = fingerprintScreen02FindContinuationOutcome({
    actualUsage,
    checkpoint,
    status: nextStatus,
  });
  let advanced: Awaited<ReturnType<Screen02FindContinuationStore["advance"]>>;
  try {
    advanced = await continuationStore.advance({
      binding,
      continuationId,
      expected: { revision: record.revision, cursor: record.cursor },
      operationId: input.operationId,
      inputFingerprint,
      leaseGeneration: reserved.lease.leaseGeneration,
      completedAt: observedAt(env),
      actualUsage,
      checkpoint,
      status: nextStatus,
      outcomeFingerprint,
    });
  } catch (error) {
    return settleScreen02FindContinuationFailure({
      env,
      continuationStore,
      binding,
      continuationId,
      record,
      operationId: input.operationId,
      inputFingerprint,
      leaseGeneration: reserved.lease.leaseGeneration,
      continuedAt: input.continuedAt,
      error,
      stage: "continuation-settlement",
      actualUsage,
      checkpoint,
      checkpointBytes: screen02FindStoreCheckpointBytes(checkpoint),
    });
  }
  if (advanced.outcome === "advanced" || advanced.outcome === "replayed") {
    return screen02FindRuntimeResult(step);
  }
  if (advanced.outcome === "terminal") {
    const terminalStep = screen02FindStoreCheckpoint(advanced.record);
    if (terminalStep?.status === "complete") {
      return screen02FindRuntimeResult(terminalStep);
    }
  }
  return screen02FindRuntimeFailure(
    "continuation-settlement-conflict",
    "The Find source operation finished but its exact durable settlement could not be verified.",
  );
}

export function createShockAuditServer(
  env: ShockAuditEnv,
  publicOrigin = SHOCKAUDIT_PUBLIC_ORIGIN,
) {
  const stage1PreviewOnly = env.STAGE1_PREVIEW_ONLY === "true";
  const hostReasoningExposure = hostReasoningToolExposure(env);
  const hostReasoningMeta = hostReasoningMetadata(env);
  const hostReasoningResultMeta = () => ({
    [SHOCKAUDIT_HOST_REASONING_META_KEY]: {
      ...hostReasoningMeta,
      availableTaskTypes: [...hostReasoningMeta.availableTaskTypes],
    },
  });
  const screen03HostNativeDefault =
    env.SCREEN03_HOST_NATIVE_DEFAULT === "on";
  const contextSearch = screen02ContextSearchProvider(env);
  const workflowSigning = screen02WorkflowSigningKeyring(env);
  const sixScreenRuntime =
    env.SIX_SCREEN_WORKFLOW_STORE && workflowSigning.current
      ? new SixScreenWorkflowRuntime({
          store: env.SIX_SCREEN_WORKFLOW_STORE,
          signingKey: workflowSigning.current.key,
          now: () => observedAt(env),
          fetch: screen02DocumentFetch(env),
          // `global_fetch_strictly_public` is enabled in wrangler.jsonc. Use
          // that public-only transport for a researcher-supplied helper URL;
          // official APIs and evidence documents remain on the fixed-source
          // transport. Tests can retain their injected CONNECTOR_FETCH seam.
          publicWebFetch: env.CONNECTOR_FETCH ??
            ((request, init) => globalThis.fetch(request, init)),
          ...(env.GOVINFO_API_KEY
            ? { govInfoApiKey: env.GOVINFO_API_KEY }
            : {}),
          ...(env.CONGRESS_API_KEY
            ? { congressApiKey: env.CONGRESS_API_KEY }
            : {}),
          ...(env.REGULATIONS_API_KEY
            ? { regulationsApiKey: env.REGULATIONS_API_KEY }
            : {}),
          ...(env.OPENSTATES_API_KEY
            ? { openStatesApiKey: env.OPENSTATES_API_KEY }
            : {}),
          ...(env.OPENALEX_API_KEY
            ? { openAlexApiKey: env.OPENALEX_API_KEY }
            : {}),
          configuredSourceSecrets: {
            GOVINFO_API_KEY: Boolean(env.GOVINFO_API_KEY),
            CONGRESS_API_KEY: Boolean(env.CONGRESS_API_KEY),
            REGULATIONS_API_KEY: Boolean(env.REGULATIONS_API_KEY),
            LEGISCAN_API_KEY: Boolean(env.LEGISCAN_API_KEY),
            OPENSTATES_API_KEY: Boolean(env.OPENSTATES_API_KEY),
            TAVILY_API_KEY: Boolean(env.TAVILY_API_KEY),
            BRAVE_API_KEY: Boolean(env.BRAVE_API_KEY),
            OPENALEX_API_KEY: Boolean(env.OPENALEX_API_KEY),
          },
          autoProbeSourceCapabilities: true,
          ...(env.SCREEN02_SEARCH_MONOTONIC_NOW
            ? { monotonicNow: env.SCREEN02_SEARCH_MONOTONIC_NOW }
            : {}),
          ...(env.SIX_SCREEN_RESEARCH_TASK_STORE
            ? { taskStore: env.SIX_SCREEN_RESEARCH_TASK_STORE }
            : {}),
          ...(env.SIX_SCREEN_EVIDENCE_STORE
            ? { evidenceStore: env.SIX_SCREEN_EVIDENCE_STORE }
            : {}),
          ...(env.SCREEN4_ASSESSMENT_STORE
            ? { screen4AssessmentStore: env.SCREEN4_ASSESSMENT_STORE }
            : {}),
          ...(env.HOST_REASONING_TASK_STORE
            ? { hostReasoningTaskStore: env.HOST_REASONING_TASK_STORE }
            : {}),
          screen5OpenAIMode: env.SHOCKAUDIT_SCREEN5_OPENAI_MODE,
          ...(env.OPENAI_API_KEY
            ? { screen5OpenAIApiKey: env.OPENAI_API_KEY }
            : {}),
          screen5OpenAIFetch: screen5OpenAIInferenceFetch(env),
          ...(env.SCREEN5_OPENAI_LEDGER_STORE
            ? { screen5OpenAILedgerStore: env.SCREEN5_OPENAI_LEDGER_STORE }
            : {}),
        })
      : null;
  const workflowRuntime = env.SCREEN02_WORKFLOW_STORE
      ? new Screen02WorkflowRuntime({
        store: env.SCREEN02_WORKFLOW_STORE,
        now: () => observedAt(env),
        createId: createScreen02WorkflowId,
        signing: workflowSigning,
        legacyHostAssessments: false,
        ...(env.SHOCKAUDIT_LOCAL_DEV_IN_PROCESS_MCP === "true" &&
        env.SCREEN02_HOST_ASSESSMENT_DEADLINE_MS !== undefined
          ? {
              hostAssessmentDeadlineMs:
                env.SCREEN02_HOST_ASSESSMENT_DEADLINE_MS,
            }
          : {}),
        ...(env.SCREEN02_WORKFLOW_MUTATION_COORDINATOR
          ? {
              mutationCoordinator:
                env.SCREEN02_WORKFLOW_MUTATION_COORDINATOR,
            }
          : {}),
        discoverFind: (state, input) => {
          const queryPlanning = input.queryPlanning;
          if (queryPlanning.origin === "chatgpt-host") {
            return Promise.reject(
              new Error(
                "Legacy host discovery cannot run without a task-bound pre-host qualification profile.",
              ),
            );
          }
          return discoverCanonicalScreen02Find(env, state, {
            ...input,
            queryPlanning,
          });
        },
        ...(env.SCREEN02_FIND_CONTINUATION_STORE
          ? {
              continueFind: (state, input) =>
                runCanonicalScreen02FindContinuation(env, state, input),
            }
          : {}),
        discoverAudit: (state, input) =>
          discoverCanonicalScreen02Audit(env, state, input),
        ...(env.SCREEN03_WORKFLOW_STORE || env.HOST_REASONING_TASK_STORE
          ? {
              retireScreen03: async (runId: string) => {
                await env.SCREEN03_WORKFLOW_STORE?.retire(runId);
                if (env.HOST_REASONING_TASK_STORE) {
                  await retireAllHostReasoningTasks(
                    env.HOST_REASONING_TASK_STORE,
                    runId,
                  );
                }
                await env.SCREEN02_WORKFLOW_STORE
                  ?.acknowledgePendingChildCascade?.(runId);
              },
            }
          : {}),
      })
    : null;
  const screen03Runtime =
    workflowRuntime && env.SCREEN03_WORKFLOW_STORE
      ? new Screen03WorkflowRuntime({
          store: env.SCREEN03_WORKFLOW_STORE,
          screen02: workflowRuntime,
          now: () => observedAt(env),
          fetch: screen02DocumentFetch(env),
          ...(screen02SearchExpansionMode(env) === "on" && contextSearch
            ? { contextSearch }
            : {}),
          ...(workflowSigning.current
            ? {
                hostDraftSigning: {
                  current: workflowSigning.current,
                  ...(workflowSigning.previous
                    ? { previous: workflowSigning.previous }
                    : {}),
                },
              }
            : {}),
      })
    : null;
  const hostReasoningRuntime =
    workflowRuntime && env.SCREEN02_WORKFLOW_STORE &&
      env.SCREEN03_WORKFLOW_STORE && env.HOST_REASONING_TASK_STORE &&
      workflowSigning.current
      ? createHostReasoningWorkflowRuntime({
          taskStore: env.HOST_REASONING_TASK_STORE,
          screen02Store: env.SCREEN02_WORKFLOW_STORE,
          screen03Store: env.SCREEN03_WORKFLOW_STORE,
          ...(env.SIX_SCREEN_WORKFLOW_STORE
            ? { sixScreenStore: env.SIX_SCREEN_WORKFLOW_STORE }
            : {}),
          signing: workflowSigning.current,
          now: () => observedAt(env),
          createId: (kind) => createScreen02WorkflowId(`host-${kind}`),
          createWorkflowId: (kind) =>
            createScreen02WorkflowId(`host-${kind}`),
          discoverScreen02Find: (state, input) =>
            discoverCanonicalScreen02Find(env, state, input),
        })
      : null;
  if (hostReasoningExposure !== "disabled" && !hostReasoningRuntime) {
    throw new Error(
      `SHOCKAUDIT_HOST_REASONING_MODE=${hostReasoningMeta.mode} requires the Screen 2, Screen 3, host-task, and signing runtimes.`,
    );
  }
  if (hostReasoningExposure === "full" && !env.SIX_SCREEN_WORKFLOW_STORE) {
    throw new Error(
      "SHOCKAUDIT_HOST_REASONING_MODE=full requires the replacement six-screen workflow store for proof-task parent binding.",
    );
  }
  const uiResourceMeta = {
    ...createUiResourceMeta(publicOrigin),
    ...(stage1PreviewOnly ? {} : hostReasoningResultMeta()),
  };
  const server = new McpServer(
    {
      name: "ShockAudit",
      version: SHOCKAUDIT_VERSION,
    },
    {
      instructions:
        stage1PreviewOnly
          ? [
              "This is the isolated ShockAudit Stage 1 acceptance preview. Start only with open_stage1_assessment_proof.",
              "After its widget posts the visible assessment request, call submit_stage1_assessment_draft exactly once with the identifiers and bounded draft fields supplied in model context.",
              "A matching tool receipt—not message delivery or assistant prose—completes the proof. Do not claim exogeneity, causal validity, source verification, or realized outcomes.",
            ].join(" ")
          : [
              "ShockAudit is replacing its legacy flow with six screens for researchers who already have a candidate law or regulatory change. Begin with open_shockaudit_screen_1; the mounted app creates and mutates its canonical workflow through app-only six-screen tools. Preserve the researcher's exact policy text and study fields. General shock discovery and result-oriented candidate recommendations are not part of the replacement.",
              "Screen 1 resolves source-backed identity interpretations and requires an explicit researcher UI confirmation bound to the displayed identity, episode, source snapshot, original request, and current revision. ChatGPT cannot confirm, reject, select, or silently substitute a shock. Identity confirmation does not verify policy details or causal validity.",
              "Screen 2 may open only after that exact confirmation. In the current milestone it is an honest gated placeholder: do not invent a policy briefing, operative date, coverage rule, or legal conclusion. The replacement contains no Find mode. Retained Screen 1–4 tools and saved states are compatibility-only and must not be used to start a new six-screen workflow.",
              "The app-only create_six_screen_workflow_v1, get_six_screen_workflow_v1, get_six_screen_operation_status_v1, get_six_screen_recovery_snapshot_v1, mutate_six_screen_workflow_v1, and retire_six_screen_workflow_v1 tools carry private workflow coordinates and are never model-callable. Never request, expose, echo, or invent those coordinates. Saved legacy runs remain read-only and exportable; a legacy selection is never upgraded into a six-screen confirmation.",
              "No replacement intelligence route is enabled until a genuine signed-in factual-task and mechanism-task round trip has been observed from frozen evidence through validated persistence back into the original panel. Never treat simulated submission as proof, quietly use a paid backend model, inspect realized outcomes, or claim exogeneity, causal validity, completed research, or source verification.",
            ].join(" "),
    },
  );

  if (!stage1PreviewOnly) {
    for (const [index, resourceUri] of
      SUPPORTED_SHOCKAUDIT_UI_RESOURCE_URIS.entries()) {
      server.registerResource(
        index === 0
          ? "ShockAudit workspace"
          : `ShockAudit workspace compatibility ${index}`,
        resourceUri,
        {
          title:
            index === 0
              ? "ShockAudit — Natural experiment workspace"
              : "ShockAudit — Saved workspace migration",
          description:
            index === 0
              ? "Interactive workspace for confirming a study boundary, choosing an event, and verifying what changed and when against bounded source evidence."
              : "Read-only migration boundary for a saved conversation whose historical tool catalog must not execute the current ShockAudit bundle.",
          mimeType: UI_RESOURCE_MIME,
          _meta: uiResourceMeta,
        },
        async (uri) => ({
          contents: [
            {
              uri: uri.href,
              mimeType: UI_RESOURCE_MIME,
              text:
                resourceUri === SHOCKAUDIT_UI_RESOURCE_URI
                  ? await readUiHtml(env, publicOrigin)
                  : legacyWorkspaceMigrationHtml(resourceUri),
              _meta: uiResourceMeta,
            },
          ],
        }),
      );
    }
  }

  if (stage1PreviewOnly) {
    server.registerResource(
    "ShockAudit Stage 1 assessment proof",
    STAGE1_PROOF_UI_RESOURCE_URI,
    {
      title: "ShockAudit — isolated assessment handshake proof",
      description:
        "A local-only vertical slice that distinguishes message delivery from a real ChatGPT model tool call.",
      mimeType: UI_RESOURCE_MIME,
      _meta: uiResourceMeta,
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: UI_RESOURCE_MIME,
          text: await readUiHtml(env, publicOrigin),
          _meta: uiResourceMeta,
        },
      ],
    }),
  );

    server.registerTool(
    "open_stage1_assessment_proof",
    {
      title: "Open the Stage 1 Assessment Proof",
      description:
        "Open the isolated v0.2.21 Stage 1 vertical slice. It presents one frozen GDPR candidate and a button that asks ChatGPT to call the separate model-only draft tool. This is a development proof, not the rebuilt Screen 2 Find or Audit workflow.",
      inputSchema: openStage1AssessmentProofInputWireSchema,
      outputSchema: stage1ProofOpenOutputWireSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: stage1ProofUiToolMeta,
    },
    async () => {
      const preparedAt = observedAt(env);
      const open = createStage1ProofOpenResult(
        preparedAt,
        `stage1-proof-${crypto.randomUUID()}`,
      );
      return {
        content: [
          {
            type: "text" as const,
            text:
              "The isolated Stage 1 assessment proof is prepared with one immutable GDPR candidate. Use the widget action to request the real model-generated draft; opening the proof does not count as assessment completion.",
          },
        ],
        structuredContent: open,
      };
    },
  );

    server.registerTool(
    STAGE1_DRAFT_TOOL,
    {
      title: "Submit the Stage 1 Assessment Draft",
      description:
        "Model-only Stage 1 proof tool. Use only after the proof widget posts its visible follow-up. Echo the exact request and immutable candidate identifiers from model context, then submit only studyFit, outcomePathway, measurementPotential, mainConcern, and one or two nextChecks. Each component must contain one permitted categorical value, a concise source-grounded explanation, and only attached source IDs. Never submit an overall score or judgment, candidate facts, source records, realized outcomes, exogeneity, or causal-validity claims. A tool receipt—not prose—completes the proof.",
      inputSchema: stage1AssessmentDraftInputWireSchema,
      outputSchema: stage1AssessmentResultOutputWireSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: stage1DraftModelOnlyToolMeta,
    },
    async (input) => {
      const result = evaluateStage1AssessmentDraft(
        input,
        observedAt(env),
      );
      return {
        content: [
          {
            type: "text" as const,
            text:
              result.status === "completed"
                ? `Stage 1 proof receipt ${result.receiptId} completed fixed validation. The overall judgment was derived by software; no numerical score or candidate fact was accepted from the model.`
                : `Stage 1 proof receipt ${result.receiptId} rejected the draft during fixed validation: ${result.rejectionReasons.join(" ")}`,
          },
        ],
        structuredContent: result,
      };
    },
  );

    return server;
  }

  if (workflowRuntime) {
    registerScreen02WorkflowTools(server, workflowRuntime, {
      legacyHostAssessments: false,
    });
  }
  if (sixScreenRuntime) {
    registerSixScreenWorkflowTools(server, sixScreenRuntime, {
      resultMetadata: hostReasoningResultMeta,
    });
  }
  if (
    !SIX_SCREEN_REPLACEMENT_BUILD &&
    workflowSigning.current &&
    hostReasoningExposure !== "full"
  ) {
    registerScreen01HostDraftTools(server, {
      signingConfig: {
        current: workflowSigning.current,
        ...(workflowSigning.previous
          ? { previous: workflowSigning.previous }
          : {}),
      },
      now: () => observedAt(env),
      createId: () => createScreen02WorkflowId("screen01-host-draft"),
    });
  }
  if (screen03Runtime) {
    registerScreen03WorkflowTools(server, screen03Runtime, {
      hostNativeDefault: screen03HostNativeDefault,
      historicalHostToolVisibility: "app-only",
      registerHistoricalPacketRenderTools:
        hostReasoningExposure === "disabled",
      registerHistoricalHostDraftTools:
        !SIX_SCREEN_REPLACEMENT_BUILD &&
        (hostReasoningExposure === "disabled" ||
          hostReasoningExposure === "app-only"),
      hostReasoningMetadata: hostReasoningMeta,
    });
  }
  if (hostReasoningRuntime) {
    registerHostReasoningTaskTools(server, hostReasoningRuntime, {
      exposure: hostReasoningExposure,
    });
  }

  server.registerTool(
    "open_shockaudit_screen_1",
    {
      title: "Open ShockAudit Screen 1",
      description: "Open the interactive Screen 1 workspace.",
      inputSchema: openScreen01InputWireSchema,
      outputSchema: workflowOutputWireSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: uiToolMeta,
    },
    async ({ mode = "find", sentence }) => {
      if (sentence !== undefined) {
        const draft = draftScopeContract({ mode, sentence });
        const output = toWorkflowOutput(draft);
        return {
          content: [
            {
              type: "text" as const,
              text: draft.ok
                ? resultText(mode, draft.ambiguities.length, false)
                : `The study sentence needs revision: ${draft.error}`,
            },
          ],
          structuredContent: output,
          _meta: {
            ...hostReasoningResultMeta(),
            "shockaudit/screen03HostNativeDefault":
              screen03HostNativeDefault,
          },
        };
      }
      const state = createInitialState(
        mode,
        modeCopy[mode].sample,
      );
      const ambiguities = getAmbiguities({
        scope: state.scope,
        mode: state.mode,
        sentence: state.sentence,
        knownShock: state.knownShock,
        resolvedKeys: state.resolvedKeys,
      });
      const output = toWorkflowOutput({
        ok: true,
        error: "",
        state,
        ambiguities,
      });
      return {
        content: [
          {
            type: "text",
            text: resultText(mode, ambiguities.length, false),
          },
        ],
        structuredContent: output,
        _meta: {
          ...hostReasoningResultMeta(),
          "shockaudit/screen03HostNativeDefault":
            screen03HostNativeDefault,
        },
      };
    },
  );

  server.registerTool(
    "draft_scope_contract",
    {
      title: "Draft a Scope Contract",
      description: "Parse one sentence into nine scope fields.",
      inputSchema: draftScopeContractInputWireSchema,
      outputSchema: workflowOutputWireSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: { visibility: ["model", "app"] },
        "openai/toolInvocation/invoking": "Drafting the Scope Contract…",
        "openai/toolInvocation/invoked": "Scope Contract drafted",
      },
    },
    async (input) => {
      const draft = draftScopeContract(input);
      const output = toWorkflowOutput(draft);
      return {
        content: [
          {
            type: "text",
            text: draft.ok
              ? resultText(input.mode, draft.ambiguities.length, false)
              : `The study sentence needs revision: ${draft.error}`,
          },
        ],
        structuredContent: output,
        _meta: {
          ...hostReasoningResultMeta(),
          "shockaudit/screen03HostNativeDefault":
            screen03HostNativeDefault,
        },
      };
    },
  );

  server.registerTool(
    "confirm_scope_contract",
    {
      title: "Confirm a Scope Contract",
      description: "Validate and confirm Screen 1.",
      inputSchema: confirmScopeContractInputWireSchema,
      outputSchema: workflowOutputWireSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: { visibility: ["model", "app"] },
        "openai/widgetAccessible": true,
        "openai/toolInvocation/invoking": "Checking the Scope Contract…",
        "openai/toolInvocation/invoked": "Scope Contract checked",
      },
    },
    async (input) => {
      const confirmation = confirmScopeContract(input);
      const output = toWorkflowOutput(confirmation);
      return {
        content: [
          {
            type: "text",
            text: confirmation.ok
              ? resultText(input.mode, 0, true)
              : confirmation.error,
          },
        ],
        structuredContent: output,
        _meta: hostReasoningResultMeta(),
      };
    },
  );

  if (workflowRuntime) {
    server.registerTool(
      SCREEN_02_WORKFLOW_CREATE_TOOL_V024,
      {
        title: "Create a ShockAudit Screen 2 workflow with a sealed snapshot",
        description:
          "App-only, versioned Screen 1 to Screen 2 data boundary for the current widget. It validates the exact confirmed studyContext, binds the standard or blank-reset initialization profile to one retained server-owned workflow for the supplied operationId, and returns a compact public summary plus an authenticated encrypted snapshot bound to that operation and the widget's fresh response key. The legacy component-private metadata is retained only for compatible hosts. It has no UI template and cannot replace the mounted workspace.",
        inputSchema: createScreen02WorkflowInputWireSchemaV024,
        outputSchema: screen02WorkflowSealedSummarySchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          // Audit creation resolves the named-shock anchor through bounded
          // external identity routes before returning its first snapshot.
          openWorldHint: true,
        },
        _meta: screen02WorkflowCreateToolMeta,
      },
      async ({
        studyContext,
        operationId,
        responseKeyId,
        responseKey,
        initialState,
      }) => {
        const validatedResponseKey =
          await validateScreen02ExportedResponseKeyMaterial({
            keyId: responseKeyId,
            key: responseKey,
          });
        const result = await workflowRuntime.open(
          studyContext,
          operationId,
          initialState ?? "standard",
        );
        const sealedSnapshot = await sealScreen02WorkflowClientSnapshot(
          result.snapshot,
          {
            operationId,
            kind: "open",
            responseKey: validatedResponseKey,
          },
        );
        return {
          content: [
            {
              type: "text" as const,
              text: result.summary.message,
            },
          ],
          structuredContent: {
            ...result.summary,
            sealedSnapshot,
          },
          _meta: {
            ...hostReasoningResultMeta(),
            "shockaudit/screen03HostNativeDefault":
              screen03HostNativeDefault,
            [SCREEN_02_WORKFLOW_META_KEY]: result.snapshot,
            [SCREEN_02_WORKFLOW_CORRELATION_META_KEY]:
              createScreen02WorkflowCorrelation(
                result.snapshot,
                operationId,
                "open",
              ),
          },
        };
      },
    );

    server.registerTool(
      SCREEN_02_WORKFLOW_CREATE_TOOL_V023,
      {
        title: "Create a ShockAudit Screen 2 workflow",
        description:
          "App-only, versioned Screen 1 to Screen 2 data boundary. It validates the exact confirmed studyContext, creates or replays one retained server-owned workflow for the supplied operationId, and returns a compact public summary plus component-private canonical state. Retirement or expiry removes the binding so later reuse gets fresh credentials. It has no UI template and therefore cannot replace the mounted workspace.",
        inputSchema: createScreen02WorkflowInputWireSchema,
        outputSchema: screen02WorkflowSummarySchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          // Audit creation resolves the named-shock anchor through bounded
          // external identity routes before returning its first snapshot.
          openWorldHint: true,
        },
        _meta: screen02WorkflowCreateToolMeta,
      },
      async ({ studyContext, operationId }) => {
        const result = await workflowRuntime.open(studyContext, operationId);
        return {
          content: [
            {
              type: "text" as const,
              text: result.summary.message,
            },
          ],
          structuredContent: result.summary,
          _meta: {
            ...hostReasoningResultMeta(),
            [SCREEN_02_WORKFLOW_META_KEY]: result.snapshot,
            [SCREEN_02_WORKFLOW_CORRELATION_META_KEY]:
              createScreen02WorkflowCorrelation(
                result.snapshot,
                operationId,
                "open",
              ),
          },
        };
      },
    );
  }

  server.registerTool(
    "open_shockaudit_screen_2",
    {
      title: "Open ShockAudit Screen 2",
      description:
        "Render or reopen ShockAudit Screen 2 using the stable legacy-compatible output contract. Saved widgets may use a reserved screen02-v021-open- runId to create a private canonical workflow while receiving the original Screen 2 structured output. Current widgets use the separate app-only create_screen02_workflow_v024 data tool so this render tool cannot remount an in-place Screen 1 transition.",
      inputSchema: openScreen02InputWireSchema,
      outputSchema: screen02OutputWireSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: Boolean(workflowRuntime),
      },
      _meta: screen02UiToolMeta,
    },
    async ({ studyContext, runId, workflowVersion }) => {
      const canonicalOpen =
        workflowVersion === "2.1" ||
        runId?.startsWith(SCREEN_02_WORKFLOW_OPEN_REQUEST_PREFIX);
      if (canonicalOpen) {
        if (!workflowRuntime) {
          throw new Error(
            "Canonical Screen 2 persistence is unavailable on this runtime.",
          );
        }
        const operationId =
          runId ??
          `${SCREEN_02_WORKFLOW_OPEN_REQUEST_PREFIX}${crypto.randomUUID()}`;
        const result = await workflowRuntime.open(
          studyContext,
          // Only an app-supplied reserved runId is an idempotency key on this
          // historical mixed-mode tool. Model callers that send only
          // workflowVersion retain the pre-v0.2.23 random-open behavior.
          runId ? operationId : undefined,
        );
        const compatibilitySession = createScreen02Session(
          studyContext,
          operationId,
        );
        return {
          content: [
            {
              type: "text" as const,
              text: result.summary.message,
            },
          ],
          // The stable tool name keeps the strict v0.2.20 object shape. A
          // mounted conversation can retain that descriptor even after the
          // server is refreshed, so changing only its input was insufficient.
          structuredContent: toScreen02Output(compatibilitySession),
          _meta: {
            ...hostReasoningResultMeta(),
            "shockaudit/screen03HostNativeDefault":
              screen03HostNativeDefault,
            [SCREEN_02_WORKFLOW_META_KEY]: result.snapshot,
            [SCREEN_02_WORKFLOW_CORRELATION_META_KEY]:
              createScreen02WorkflowCorrelation(
                result.snapshot,
                operationId,
                "open",
              ),
          },
        };
      }
      const session = createScreen02Session(studyContext, runId);
      return {
        content: [
          {
            type: "text" as const,
            text:
              studyContext.startingPoint === "find"
                ? "Screen 2 is open with the confirmed Screen 1 baseline preserved exactly. No search has run and no candidate is selected. Call discover_shock_options to begin a documented native-source search."
                : "Screen 2 is open with the confirmed Screen 1 baseline and exact known-shock text preserved. No match has been assumed. Call discover_shock_options to locate source-backed exact-name or controlled-alias event matches for researcher confirmation.",
          },
        ],
        structuredContent: toScreen02Output(session),
        _meta: {
          ...hostReasoningResultMeta(),
          "shockaudit/screen03HostNativeDefault":
            screen03HostNativeDefault,
        },
      };
    },
  );

  if (!workflowRuntime) {
    server.registerTool(
      "discover_shock_options",
    {
      title: "Discover Shock Options",
      description:
        "Run one bounded source-backed Screen 2 search using the exact confirmed geography, event family, dates, population, industry aliases, and researcher criteria. The server retrieves a broader pool, applies fixed validation and deduplication, backfills eligible records, and targets ten leading factual candidates without inspecting outcome values; it returns fewer only when the bounded source-backed pool is exhausted. Find mode returns possible events; Audit mode preserves the exact known-shock anchor and returns source-backed identity matches. Every displayed candidate remains useful while its concise preliminary AI assessment runs, and assess_shock_options attaches that assessment without resubmitting candidate facts.",
      inputSchema: discoverShockOptionsInputWireSchema,
      outputSchema: screen02DataOutputWireSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
      _meta: screen02DiscoveryToolMeta,
    },
    async (input) => {
      const current = restoreScreen02TransportInput(input, true)!;
      if (input.expectedRevision !== current.revision) {
        throw new Error(
          `Stale Screen 2 response: expected revision ${current.revision}, received ${input.expectedRevision}.`,
        );
      }
      if (current.lockedChoice) {
        throw new Error(
          "The shock is locked. Unlock it before requesting another Screen 2 search round.",
        );
      }
      const criteria = discoveryCriteria(input);
      preflightDiscovery(current, criteria);
      const roundObservedAt = observedAt(env);
      if (input.scopeRevision) {
        const session = applyScreen02SearchRound(current, {
          expectedRevision: input.expectedRevision,
          requestType: input.requestType,
          exactRequest: input.exactRequest,
          retrievedAt: roundObservedAt,
          proposals: [],
          criteria,
          interpretationSource: input.interpretationSource,
          stage: "native-retrieval",
          scopeRevision: input.scopeRevision,
          deferredQuestions: input.deferredQuestions,
        });
        return toScreen02DataToolResult(
          session,
          "The request changes the locked Screen 1 scope. Screen 2 recorded the conflict without searching or rewriting the baseline; revise and reconfirm Screen 1 before continuing.",
        );
      }

      const requestedLimit =
        input.resultLimit ?? SCREEN_02_FIND_MAX_VISIBLE_CANDIDATES;
      const remainingCapacity = Math.max(
        1,
        SCREEN_02_MAX_CANDIDATE_ITEMS - current.items.length,
      );
      const limit =
        current.mode === "find"
          ? Math.min(requestedLimit, remainingCapacity)
          : requestedLimit;
      // A UI display cap is not a retrieval cap. Search and deduplicate the
      // bounded raw pool first so relevant records can backfill irrelevant
      // early provider rows; only the qualified output is sliced to `limit`.
      const discoveryLimit = current.mode === "find"
        ? SCREEN02_DISCOVERY_RAW_CANDIDATE_TARGET
        : limit;
      const official = await officialDiscovery(
        env,
        current,
        criteria,
        roundObservedAt,
        discoveryLimit,
      );
      const officialFind = [
        ...official.results.flatMap((result) => result.proposals),
        ...(official.expandedResults ?? []).flatMap(
          (result) => result.proposals,
        ),
        ...(current.mode === "find"
          ? (official.expandedLeadProposals ?? [])
          : []),
      ]
        .filter(
          (proposal): proposal is Screen02FindProposal =>
            proposal.mode === "find",
        );
      const registry = registryCandidates(
        current,
        criteria,
        discoveryLimit,
      );
      const registryRecord = registryManifest(
        registry,
        roundObservedAt,
      );

      let proposals: Screen02Proposal[];
      let evaluatedProposalIds: string[] | undefined;
      let substantiveEnrichment:
        | Awaited<ReturnType<typeof enrichSparseScreen02FindProposals>>
        | undefined;
      let rawCapDroppedProposalIds: string[] = [];
      let shockEvidence:
        | Screen02SearchRound["shockEvidence"]
        | undefined;
      if (current.mode === "find") {
        const contextualFind = (official.expandedLeadProposals ?? []).filter(
          (proposal): proposal is Screen02FindProposal =>
            proposal.mode === "find",
        );
        const exactRawProposals = [...new Map(
          [...registry, ...officialFind].map((proposal) => [proposal.id, proposal]),
        ).values()];
        const rawPool = boundedScreen02RawQualificationPool(
          exactRawProposals,
          {
            screen01Baseline: current.screen01Baseline,
            screen01Fingerprint: current.screen01Fingerprint,
          },
          undefined,
          SCREEN_02_MAX_PROPOSALS,
        );
        rawCapDroppedProposalIds = rawPool.droppedProposalIds;
        substantiveEnrichment = await enrichSparseScreen02FindProposals(
          env,
          rawPool.proposals,
          {
            screen01Baseline: current.screen01Baseline,
            screen01Fingerprint: current.screen01Fingerprint,
          },
          {
            maximumCandidates: limit,
            retrievedAt: roundObservedAt,
            contextualProposals: contextualFind,
          },
        );
        const qualifiedPool = rankFindCandidatePool(
          current,
          substantiveEnrichment.proposals,
          criteria,
          limit,
        );
        proposals = qualifiedPool.proposals;
        evaluatedProposalIds = qualifiedPool.evaluatedProposalIds;
      } else {
        const matched = matchingEvidence(
          [...officialFind, ...registry],
          current.screen01Baseline.knownShock,
        );
        proposals = auditEvidenceProposals(
          current.screen01Baseline.knownShock,
          matched,
        );
        shockEvidence = shockEvidenceRecord(
          current.screen01Baseline.knownShock,
          matched,
        );
      }

      let manifest = connectorManifest(
        official,
        registryRecord,
        current.mode,
      );
      if (current.mode === "find") {
        const legacyRawCandidateMaximum = Math.min(
          SCREEN02_DISCOVERY_RAW_CANDIDATE_MAX,
          SCREEN_02_MAX_PROPOSALS,
        );
        const rawProposalCount = new Set(
          [...officialFind, ...registry].map((proposal) => proposal.id),
        ).size;
        const rawCapDropCount = Math.max(
          0,
          rawProposalCount - legacyRawCandidateMaximum,
        );
        if (rawCapDropCount > 0) {
          manifest = {
            ...manifest,
            queryMatrix: [
              ...(manifest.queryMatrix ?? []),
              {
                id: "common-raw-lead-cap-exclusions",
                query:
                  `Fixed ${legacyRawCandidateMaximum}-lead common qualification cap`,
                purpose:
                  "Record exact lead IDs excluded at the raw-pool cap before common qualification or deeper retrieval.",
                returnedRecordIds: rawCapDroppedProposalIds,
              },
            ],
            channels: [
              ...(manifest.channels ?? []),
              {
                channel: "Common raw-lead qualification cap",
                status: "searched",
                retrievedAt: roundObservedAt,
                note: `The retrieval merge received ${rawProposalCount} unique registry/native/host leads, admitted exactly ${legacyRawCandidateMaximum} to the common qualifier, and excluded ${rawCapDropCount} at the fixed raw-pool cap before deeper retrieval.`,
              },
            ],
          };
        }
      }
      if (substantiveEnrichment) {
        manifest = appendLegacyScreen02SubstantiveEnrichmentManifest(
          manifest,
          substantiveEnrichment,
          {
            retrievedAt: roundObservedAt,
            maximumCandidates: limit,
            retainedCount: proposals.length,
          },
        );
      }
      const session = applyScreen02SearchRound(current, {
        expectedRevision: input.expectedRevision,
        requestType: input.requestType,
        exactRequest: input.exactRequest,
        retrievedAt: roundObservedAt,
        proposals,
        ...(evaluatedProposalIds ? { evaluatedProposalIds } : {}),
        searchManifest: manifest,
        criteria,
        interpretationSource: input.interpretationSource,
        stage: "native-retrieval",
        deferredQuestions: input.deferredQuestions,
        shockEvidence,
      });
      const completedRound =
        session.interaction.searchRounds.at(-1)!;
      const receivedCount = completedRound.proposalIdsReceived.length;
      const retainedCount = completedRound.itemIdsRetained.length;
      return toScreen02DataToolResult(
        session,
        current.mode === "find"
          ? `Screen 2 completed native search round ${session.revision}. It received ${receivedCount} provisional event ${
              receivedCount === 1 ? "proposal" : "proposals"
            } from the scope-routed live sources and matching reviewed catalog and retained ${retainedCount} after fixed validation. It recorded ${official.plan.coverageGaps.length + official.skippedRoutes.length + official.runtimeLimitations.length} native coverage, source, or execution limitations that optional host-assisted discovery can investigate. No outcome values were inspected.`
          : `Screen 2 appended search round ${session.revision} while keeping the exact known-shock anchor “${current.screen01Baseline.knownShock}”. It retained ${retainedCount} source-backed exact-name or input-derived alias event ${retainedCount === 1 ? "match" : "matches"} for researcher confirmation. No empirical representation was selected and no outcome values were inspected.`,
      );
    },
  );

    server.registerTool(
      "assess_shock_options",
    {
      title: "Add Preliminary Shock Assessments",
      description:
        "Attach concise, source-grounded preliminary assessments to existing Screen 2 candidates without resubmitting or changing their factual records. For assessmentVersion screen02-preliminary-assessment-v1, pass the exact studyContext, sessionState, revision, native-root and immediate assessment-parent round IDs, then submit only candidate IDs and the compact judgment, study fit, source-established affected population, outcome mechanism, main concern, one or two next checks, and attached evidence source IDs. Candidates are validated independently: accepted entries persist even when another entry needs retry, and the result reports the retryable IDs. On a retry, only IDs marked needs-retry by the immediate parent are eligible; accepted assessments are immutable and resubmitted replacements are ignored. Each native result set allows one initial assessment plus at most two retries. A non-insufficient judgment requires candidate-attached evidence. Evidence may support the underlying event feature while the outcome mechanism clearly labels practical cost, revenue, legal-risk, operational, financing, or trust channels as hypotheses; it need not claim that a source estimated the realized outcome. No assessment verifies causality, exogeneity, source contents, realized outcomes, direction, or magnitude. The legacy proposal-based v0.2.18 input remains accepted for session compatibility.",
      inputSchema: assessShockOptionsInputWireSchema,
      outputSchema: screen02DataOutputWireSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: screen02AssessmentToolMeta,
    },
    async (input) => {
      const transported = restoreScreen02TransportInput(input, false);
      const current =
        transported ?? createScreen02Session(input.studyContext);
      if (
        !sameDeterministicJson(
          current.screen01Baseline,
          input.studyContext,
        )
      ) {
        throw new Error(
          "The supplied studyContext does not exactly equal the session's immutable Screen 1 baseline.",
        );
      }
      if ("assessmentVersion" in input) {
        if (!transported) {
          throw new Error(
            "A compact preliminary assessment requires an existing Screen 2 state envelope.",
          );
        }
        const session = applyScreen02PreliminaryAssessmentRound(current, {
          expectedRevision: input.expectedRevision,
          exactRequest: input.exactRequest,
          retrievedAt: observedAt(env),
          rootNativeRoundId: input.rootNativeRoundId,
          assessmentParentRoundId: input.assessmentParentRoundId,
          assessments: input.assessments,
        });
        const assessmentResults =
          session.interaction.searchRounds.at(-1)?.assessmentResults ?? [];
        const accepted = assessmentResults.filter(
          (result) => result.status === "assessed",
        ).length;
        const retry = assessmentResults.filter(
          (result) => result.status === "needs-retry",
        );
        return toScreen02DataToolResult(
          session,
          `Screen 2 recorded ${accepted} accepted preliminary ${
            accepted === 1 ? "assessment" : "assessments"
          } and isolated ${retry.length} ${
            retry.length === 1 ? "candidate" : "candidates"
          } for retry. Candidate facts, sources, order, and accepted prior assessments were preserved. No outcome values were inspected.`,
          assessmentResults,
        );
      }
      if (
        transported &&
        input.expectedRevision === undefined
      ) {
        throw new Error(
          "expectedRevision is required when appending to an existing Screen 2 session.",
        );
      }
      const criteria = discoveryCriteria({
        criteria: input.criteria,
        exactRequest:
          input.exactRequest ??
          "Assess the supplied Screen 2 proposals.",
        interpretationSource: input.interpretationSource,
      });
      let proposals = input.proposals as Screen02Proposal[];
      if (
        current.mode === "audit" &&
        proposals.some(
          (proposal) =>
            proposal.mode !== "audit" ||
            proposal.representationType !== "whole-package",
        )
      ) {
        throw new Error(
          "Audit Screen 2 accepts only source-backed event-identity matches. Empirical representations must be constructed and verified on Screen 3.",
        );
      }
      const existingById = new Map(
        current.items.map((item) => [item.id, item]),
      );
      for (const proposal of proposals) {
        const existing = existingById.get(proposal.id);
        if (existing) {
          if (proposal.origin !== existing.origin) {
            throw new Error(
              `Assessment proposal ${proposal.id} does not preserve the existing candidate's identity and provenance.`,
            );
          }
        } else if (
          proposal.origin !== "newly-discovered" &&
          proposal.origin !== "unsupported-lead"
        ) {
          throw new Error(
            `New caller-supplied proposal ${proposal.id} cannot claim privileged origin ${proposal.origin}.`,
          );
        }
      }
      if (input.interpretationSource === "ai-interpretation") {
        const parentRound =
          current.interaction.searchRounds.at(-1);
        if (
          !parentRound ||
          parentRound.requestType === "initial" ||
          parentRound.stage !== "native-retrieval" ||
          parentRound.parentRoundId !== undefined ||
          input.parentRoundId !== parentRound.id
        ) {
          throw new Error(
            "The AI review does not identify the immediately preceding native Screen 2 round.",
          );
        }
        const parentItemIds = new Set(
          parentRound.itemIdsRetained,
        );
        for (const proposal of proposals) {
          const existing = existingById.get(proposal.id);
          if (
            existing &&
            !parentItemIds.has(proposal.id)
          ) {
            throw new Error(
              `AI review proposal ${proposal.id} does not belong to the immediately preceding native result set.`,
              );
          }
        }
      }
      proposals = constrainAssessedProposalProvenance(
        current,
        proposals,
      );
      const roundObservedAt = observedAt(env);
      const searchManifest = combinedAiReviewManifest(
        current,
        input.searchManifest,
        input.interpretationSource,
      );
      const session = applyScreen02SearchRound(current, {
        expectedRevision:
          input.expectedRevision ?? current.revision,
        requestType: input.requestType ?? "user-source",
        exactRequest:
          input.exactRequest ??
          "Assess the supplied Screen 2 proposals.",
        retrievedAt: roundObservedAt,
        proposals,
        searchManifest,
        criteria,
        interpretationSource: input.interpretationSource,
        stage:
          input.interpretationSource === "ai-interpretation"
            ? "ai-review"
            : "researcher-assessment",
        scopeRevision: input.scopeRevision,
        deferredQuestions: input.deferredQuestions,
        parentRoundId: input.parentRoundId,
        semanticDecisions: input.semanticDecisions,
      });
      return toScreen02DataToolResult(
        session,
        `Screen 2 appended a documented assessment round for ${proposals.length} caller-supplied ${
          proposals.length === 1 ? "proposal" : "proposals"
        }. The complete candidate ledger now contains ${session.items.length} items at revision ${session.revision}. The server did not browse, fetch, inspect outcome values, or independently verify the supplied source contents.`,
      );
    },
  );

  }

  return server;
}
