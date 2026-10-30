import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { SUPPORTED_SHOCKAUDIT_UI_RESOURCE_URIS } from "../version";
import { attachHostTaskTransport } from "../core/host-task-transport";

import {
  CANCEL_SHOCKAUDIT_HOST_TASK_TOOL,
  GET_SHOCKAUDIT_HOST_TASK_STATUS_TOOL,
  HOST_REASONING_CANCEL_RESULT_SCHEMA_VERSION,
  HOST_REASONING_MESSAGE_RECORD_RESULT_SCHEMA_VERSION,
  HOST_REASONING_PANEL_RECORD_RESULT_SCHEMA_VERSION,
  HOST_REASONING_PREPARED_RESULT_SCHEMA_VERSION,
  HOST_REASONING_PRIVATE_CONTEXT_META_KEY,
  HOST_REASONING_PRIVATE_CONTEXT_META_SCHEMA_VERSION,
  HOST_REASONING_STATUS_RESULT_SCHEMA_VERSION,
  HOST_REASONING_SUBMISSION_RECEIPT_SCHEMA_VERSION,
  PREPARE_SHOCKAUDIT_HOST_TASK_TOOL,
  RECORD_SHOCKAUDIT_HOST_MESSAGE_DELIVERY_TOOL,
  RECORD_SHOCKAUDIT_HOST_PANEL_RECONCILIATION_TOOL,
  SUBMIT_SCREEN02_SEARCH_REVIEW_TOOL,
  SUBMIT_SCREEN03_EVIDENCE_MAPPING_TOOL,
  SUBMIT_SCREEN03_OVERVIEW_TOOL,
  SUBMIT_SCREEN04_STUDY_EVENT_ASSESSMENT_TOOL,
  SUBMIT_SCREEN05_STUDY_MECHANISM_COMPARISON_TOOL,
  SUBMIT_SCREEN05_THEORETICAL_PLANNING_TOOL,
  SUBMIT_SIX_SCREEN_MECHANISM_PROOF_TOOL,
  SUBMIT_SIX_SCREEN_POLICY_FACT_PROOF_TOOL,
  hostReasoningCancelInputSchema,
  hostReasoningMessageRecordInputSchema,
  hostReasoningPanelFailureInputSchema,
  hostReasoningPrepareInputSchema,
  hostReasoningStatusInputSchema,
  screen02SearchReviewSubmissionSchema,
  screen03EvidenceMappingSubmissionSchema,
  screen03OverviewSubmissionSchema,
  screen04StudyEventAssessmentSubmissionSchema,
  screen05StudyMechanismComparisonSubmissionSchema,
  screen05TheoreticalPlanningSubmissionSchema,
  sixScreenMechanismProofSubmissionSchema,
  sixScreenPolicyFactProofSubmissionSchema,
  type HostReasoningTaskRuntime,
} from "./host-reasoning-task-runtime";

export const HOST_REASONING_TOOL_EXPOSURES = [
  "disabled",
  "app-only",
  "screen02-only",
  "full",
] as const;
export type HostReasoningToolExposure =
  (typeof HOST_REASONING_TOOL_EXPOSURES)[number];

const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/);
const hostTaskType = z.enum([
  "screen02-search-review",
  "screen03-evidence-mapping",
  "screen03-overview-improvement",
  "six-screen-policy-fact-proof",
  "six-screen-mechanism-proof",
  "screen04-study-event-assessment",
  "screen05-theoretical-planning",
  "screen05-study-mechanism-comparison",
]);
const taskStatus = z.enum([
  "prepared", "message-requested", "message-accepted", "message-rejected",
  "awaiting-submission", "submission-received", "validating", "applied",
  "validation-failed", "expired", "superseded", "retry-exhausted",
  "cancelled",
]);
const timestamp = z.iso.datetime();

const panelReconciliationSchema = z.object({
  status: z.enum(["not-ready", "pending", "reconciled", "failed"]),
  lastCheckedAt: timestamp.nullable(),
  reconciledAt: timestamp.nullable(),
  failureCode: identifier.nullable(),
  failureExplanation: z.string().max(2_000).nullable(),
}).strict();

const publicTaskStateSchema = z.object({
  taskId: identifier,
  taskType: hostTaskType,
  screen: z.enum(["screen-02", "screen-03", "screen-04", "screen-05"]),
  runId: identifier,
  candidatePoolId: identifier.nullable(),
  selectedEventId: identifier.nullable(),
  claimGroupId: identifier.nullable(),
  status: taskStatus,
  messageChannel: z.enum([
    "ui/message", "sendFollowUpMessage", "unavailable",
  ]).nullable(),
  messageDeliveryStatus: z.enum(["requested", "accepted", "rejected"]).nullable(),
  createdAt: timestamp,
  expiresAt: timestamp,
  retryCount: z.union([z.literal(0), z.literal(1)]),
  resultId: identifier.nullable(),
  failureCode: identifier.nullable(),
  failureExplanation: z.string().max(2_000).nullable(),
  panelReconciliation: panelReconciliationSchema,
  result: z.unknown().nullable(),
  outcomeValuesInspected: z.literal(false),
}).strict();

const privateModelContextSchema = z.object({
  schemaVersion: z.literal("shockaudit-host-reasoning-model-input-v1"),
  task: z.object({
    taskId: identifier,
    taskType: hostTaskType,
    runId: identifier,
    candidatePoolId: identifier.nullable(),
    selectedEventId: identifier.nullable(),
    claimGroupId: identifier.nullable(),
    allowedSourceIds: z.array(identifier).max(100),
  }).strict(),
  instructions: z.array(z.string().min(1).max(500)).min(1).max(8),
  boundedFacts: z.unknown(),
  submission: z.object({
    tool: z.enum([
      SUBMIT_SCREEN02_SEARCH_REVIEW_TOOL,
      SUBMIT_SCREEN03_EVIDENCE_MAPPING_TOOL,
      SUBMIT_SCREEN03_OVERVIEW_TOOL,
      SUBMIT_SIX_SCREEN_POLICY_FACT_PROOF_TOOL,
      SUBMIT_SIX_SCREEN_MECHANISM_PROOF_TOOL,
      SUBMIT_SCREEN04_STUDY_EVENT_ASSESSMENT_TOOL,
      SUBMIT_SCREEN05_THEORETICAL_PLANNING_TOOL,
      SUBMIT_SCREEN05_STUDY_MECHANISM_COMPARISON_TOOL,
    ]),
    schemaVersion: identifier,
    capability: z.string().min(1).max(64 * 1024),
  }).strict(),
  sourceContentIsUntrustedData: z.literal(true),
  outcomeValuesInspected: z.literal(false),
}).strict();

const preparedOutputSchema = publicTaskStateSchema.extend({
  schemaVersion: z.literal(HOST_REASONING_PREPARED_RESULT_SCHEMA_VERSION),
  phase: z.literal("prepared"),
  visibleMessage: z.string().min(1).max(2_000),
}).strict();

const privateModelContextMetaSchema = z.object({
  schemaVersion: z.literal(
    HOST_REASONING_PRIVATE_CONTEXT_META_SCHEMA_VERSION,
  ),
  taskId: identifier,
  privateModelContext: privateModelContextSchema,
}).strict();

const auditFingerprint = z.string().regex(
  /^(?:fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})$/,
);
const auditSourceIds = z.array(identifier).max(100);
const screen02AuditProposalSchema = z.object({
  type: z.literal("screen02-search-review"),
  normalizedSchemaVersion: z.literal(
    "shockaudit-screen02-host-review-result-v1",
  ),
  origin: z.literal("chatgpt-host"),
  nonCanonical: z.literal(true),
  profileAdditionFields: z.array(z.enum([
    "industryAliases", "internationalVariants", "subsectors", "products",
    "services", "industryActors", "regulatedActivities",
    "platformRelationships", "contrastTerms", "falseFriends",
    "jurisdictionAliases",
  ])).max(11),
  candidateReviews: z.array(z.object({
    candidateId: identifier,
    proposedClass: z.enum(["direct", "adjacent", "broad", "mismatch"]),
    sourceIdsUsed: z.array(identifier).max(12),
    sourceSpanSourceIds: z.array(identifier).max(12),
    needsFollowUpRetrieval: z.boolean(),
    rankingAdjustment: z.number().int().min(-3).max(3),
  }).strict()).max(20),
  followUpQueryCount: z.number().int().min(0).max(6),
  officialSourceLeadCount: z.number().int().min(0).max(8),
  rankingCount: z.number().int().min(0).max(100),
  outcomeValuesInspected: z.literal(false),
}).strict();
const screen03EvidenceAuditProposalSchema = z.object({
  type: z.literal("screen03-evidence-mapping"),
  normalizedSchemaVersion: z.literal(
    "shockaudit-screen03-host-evidence-result-v1",
  ),
  origin: z.literal("chatgpt-host"),
  nonCanonical: z.literal(true),
  mappings: z.array(z.object({
    claimId: identifier,
    passageIds: z.array(identifier).min(1).max(8),
    quotedSpanRanges: z.array(z.object({
      passageId: identifier,
      start: z.number().int().min(0).max(1_000_000),
      end: z.number().int().min(1).max(1_000_000),
    }).strict()).min(1).max(8),
    supportStatus: z.literal("direct"),
  }).strict()).max(10),
  unmappedClaimIds: z.array(identifier).max(15),
  conflictClaimIds: z.array(identifier).max(15),
  sourceIdsReferenced: auditSourceIds,
  outcomeValuesInspected: z.literal(false),
}).strict();
const screen03OverviewAuditProposalSchema = z.object({
  type: z.literal("screen03-overview-improvement"),
  normalizedSchemaVersion: z.literal(
    "shockaudit-screen03-host-overview-result-v1",
  ),
  origin: z.literal("chatgpt-host"),
  nonCanonical: z.literal(true),
  summaryWordCount: z.number().int().min(60).max(100),
  keyPointCount: z.number().int().min(3).max(5),
  uncertaintyCount: z.number().int().min(0).max(2),
  sourceIds: z.array(identifier).max(20),
  outcomeValuesInspected: z.literal(false),
}).strict();
const sixScreenPolicyFactProofAuditProposalSchema = z.object({
  type: z.literal("six-screen-policy-fact-proof"),
  normalizedSchemaVersion: z.literal(
    "shockaudit-six-screen-policy-fact-proof-result-v1",
  ),
  intelligenceKind: z.literal("policy_fact_extraction"),
  origin: z.literal("chatgpt-host"),
  nonCanonical: z.literal(true),
  proofOnly: z.literal(true),
  referenceCount: z.number().int().min(1).max(8),
  claimIds: z.array(identifier).min(1).max(8),
  sourceIds: z.array(identifier).min(1).max(8),
  scientificMutation: z.literal("none"),
  outcomeValuesInspected: z.literal(false),
}).strict();
const sixScreenMechanismProofAuditProposalSchema = z.object({
  type: z.literal("six-screen-mechanism-proof"),
  normalizedSchemaVersion: z.literal(
    "shockaudit-six-screen-mechanism-proof-result-v1",
  ),
  intelligenceKind: z.literal("mechanism_proposal"),
  origin: z.literal("chatgpt-host"),
  nonCanonical: z.literal(true),
  proofOnly: z.literal(true),
  referenceCount: z.number().int().min(1).max(8),
  claimIds: z.array(identifier).min(1).max(8),
  sourceIds: z.array(identifier).min(1).max(8),
  stepCount: z.number().int().min(2).max(5),
  assumptionCount: z.number().int().min(1).max(7),
  alternativeExplanationCount: z.number().int().min(0).max(4),
  scholarlySupportStatus: z.literal("not_supplied_in_frozen_packet"),
  causalStatus: z.literal("hypothesis_not_estimate"),
  scientificMutation: z.literal("none"),
  outcomeValuesInspected: z.literal(false),
}).strict();
const screen04StudyEventAuditProposalSchema = z.object({
  type: z.literal("screen04-study-event-assessment"),
  normalizedSchemaVersion: z.literal(
    "shockaudit-screen04-study-event-assessment-result-v2",
  ),
  intelligenceKind: z.literal("study_event_assessment"),
  origin: z.literal("chatgpt-host"),
  nonCanonical: z.literal(true),
  chainLinkCount: z.number().int().min(0).max(6),
  uncertaintyCount: z.number().int().min(1).max(8),
  nextCheckCount: z.number().int().min(0).max(4),
  sourceIds: z.array(identifier).min(1).max(100),
  causalStatus: z.literal("conditional_assessment_not_classification"),
  scientificMutation: z.literal("none"),
  outcomeValuesInspected: z.literal(false),
}).strict();
const screen05StudyMechanismAuditProposalSchema = z.object({
  type: z.literal("screen05-study-mechanism-comparison"),
  normalizedSchemaVersion: z.literal(
    "shockaudit-screen05-study-mechanism-comparison-result-v2",
  ),
  intelligenceKind: z.literal("study_mechanism_comparison"),
  origin: z.literal("chatgpt-host"),
  nonCanonical: z.literal(true),
  mechanismCount: z.number().int().min(1).max(5),
  predictionCount: z.number().int().min(0).max(10),
  evidenceLimitationCount: z.number().int().min(1).max(10),
  sourceIds: z.array(identifier).max(100),
  causalStatus: z.literal("conditional_comparison_not_mediation_estimate"),
  scientificMutation: z.literal("none"),
  outcomeValuesInspected: z.literal(false),
}).strict();
const screen05TheoreticalPlanAuditProposalSchema = z.object({
  type: z.literal("screen05-theoretical-planning"),
  normalizedSchemaVersion: z.literal(
    "shockaudit-screen05-theoretical-planning-result-v1",
  ),
  intelligenceKind: z.literal("theoretical_mechanism_plan"),
  origin: z.literal("chatgpt-host"),
  nonCanonical: z.literal(true),
  candidateCount: z.number().int().min(0).max(6),
  evidenceNeedCount: z.number().int().min(0).max(20),
  queryIntentCount: z.number().int().min(2).max(8),
  sourceIds: z.array(identifier).max(0),
  scientificMutation: z.literal("none"),
  outcomeValuesInspected: z.literal(false),
}).strict();
const auditProposalSchema = z.discriminatedUnion("type", [
  screen02AuditProposalSchema,
  screen03EvidenceAuditProposalSchema,
  screen03OverviewAuditProposalSchema,
  sixScreenPolicyFactProofAuditProposalSchema,
  sixScreenMechanismProofAuditProposalSchema,
  screen04StudyEventAuditProposalSchema,
  screen05TheoreticalPlanAuditProposalSchema,
  screen05StudyMechanismAuditProposalSchema,
]);
const taskAuditSchema = z.object({
  schemaVersion: z.literal("shockaudit-host-reasoning-task-audit-bundle-v1"),
  type: z.literal("host-reasoning-task-audit-bundle"),
  task: z.object({
    taskId: identifier,
    taskType: hostTaskType,
    screen: z.enum(["screen-02", "screen-03", "screen-04", "screen-05"]),
    status: taskStatus,
    coordinates: z.object({
      runId: identifier,
      candidateId: identifier.nullable(),
      candidatePoolId: identifier.nullable(),
      selectedEventId: identifier.nullable(),
      claimGroupId: identifier.nullable(),
      scopeFingerprint: auditFingerprint,
      candidatePoolFingerprint: auditFingerprint.nullable(),
      eventFingerprint: auditFingerprint.nullable(),
      sourcePoolFingerprint: auditFingerprint,
    }).strict(),
    promptVersion: identifier,
    workflowVersion: identifier,
    requiredSubmissionSchemaVersion: identifier,
    createdAt: timestamp,
    expiresAt: timestamp,
  }).strict(),
  release: z.object({
    appVersion: identifier,
    uiResourceUri: z.enum(SUPPORTED_SHOCKAUDIT_UI_RESOURCE_URIS),
  }).strict(),
  message: z.object({
    channel: z.enum([
      "ui/message", "sendFollowUpMessage", "unavailable",
    ]).nullable(),
    disposition: z.enum([
      "not-requested", "requested", "accepted", "rejected",
    ]),
    requestedAt: timestamp.nullable(),
    resolvedAt: timestamp.nullable(),
    acceptedAt: timestamp.nullable(),
  }).strict(),
  retry: z.object({
    retryCount: z.union([z.literal(0), z.literal(1)]),
    retryOfTaskId: identifier.nullable(),
  }).strict(),
  submission: z.object({
    disposition: z.enum(["not-received", "received"]),
    receivedAt: timestamp.nullable(),
  }).strict(),
  validation: z.object({
    disposition: z.enum(["not-reached", "pending", "accepted", "rejected"]),
    validatedAt: timestamp.nullable(),
  }).strict(),
  application: z.object({
    disposition: z.enum(["not-reached", "pending", "applied", "failed"]),
    resultOrigin: z.literal("chatgpt-host").nullable(),
    resultId: identifier.nullable(),
    appliedAt: timestamp.nullable(),
  }).strict(),
  failure: z.object({
    stage: z.enum([
      "message-delivery", "validation", "application", "expiration",
      "retry", "cancellation",
    ]).nullable(),
  }).strict(),
  fingerprints: z.object({
    input: auditFingerprint,
    auditProposal: auditFingerprint.nullable(),
  }).strict(),
  sourceIds: z.object({
    allowed: auditSourceIds,
    referenced: auditSourceIds,
  }).strict(),
  lifecycle: z.array(z.object({
    from: taskStatus.nullable(),
    to: taskStatus,
    at: timestamp,
    failed: z.boolean(),
  }).strict()).min(1).max(32),
  panelReconciliation: z.object({
    status: z.enum(["not-ready", "pending", "reconciled", "failed"]),
    lastCheckedAt: timestamp.nullable(),
    reconciledAt: timestamp.nullable(),
    failed: z.boolean(),
  }).strict(),
  proposal: auditProposalSchema.nullable(),
  outcomeValuesInspected: z.literal(false),
}).strict();
const runAuditSchema = z.object({
  schemaVersion: z.literal("shockaudit-host-reasoning-run-audit-bundle-v1"),
  type: z.literal("host-reasoning-run-audit-bundle"),
  runId: identifier,
  includedTaskCount: z.number().int().min(0).max(32),
  truncated: z.boolean(),
  tasks: z.array(taskAuditSchema).max(32),
  outcomeValuesInspected: z.literal(false),
}).strict();

const statusOutputSchema = z.object({
  schemaVersion: z.literal(HOST_REASONING_STATUS_RESULT_SCHEMA_VERSION),
  outcome: z.enum(["found", "not-found"]),
  task: publicTaskStateSchema.nullable(),
  auditBundle: runAuditSchema.optional(),
}).strict();

const cancelOutputSchema = z.object({
  schemaVersion: z.literal(HOST_REASONING_CANCEL_RESULT_SCHEMA_VERSION),
  disposition: z.enum([
    "updated", "replayed", "not-found", "stale", "terminal",
  ]),
  taskId: identifier,
  status: taskStatus.nullable(),
}).strict();

const messageRecordOutputSchema = z.object({
  schemaVersion: z.literal(
    HOST_REASONING_MESSAGE_RECORD_RESULT_SCHEMA_VERSION,
  ),
  disposition: z.enum([
    "updated", "replayed", "not-found", "stale", "terminal",
  ]),
  taskId: identifier,
  status: taskStatus.nullable(),
  messageChannel: z.enum([
    "ui/message", "sendFollowUpMessage", "unavailable",
  ]).nullable(),
  messageDeliveryStatus: z.enum([
    "requested", "accepted", "rejected",
  ]).nullable(),
}).strict();

const panelRecordOutputSchema = z.object({
  schemaVersion: z.literal(HOST_REASONING_PANEL_RECORD_RESULT_SCHEMA_VERSION),
  disposition: z.enum([
    "updated", "replayed", "not-found", "stale", "terminal",
  ]),
  taskId: identifier,
  status: taskStatus.nullable(),
  panelStatus: z.enum([
    "not-ready", "pending", "reconciled", "failed",
  ]).nullable(),
}).strict();

const submissionReceiptSchema = z.object({
  schemaVersion: z.literal(HOST_REASONING_SUBMISSION_RECEIPT_SCHEMA_VERSION),
  taskId: identifier,
  taskType: hostTaskType,
  disposition: z.enum([
    "applied", "rejected", "replayed", "not-found", "stale", "terminal",
  ]),
  status: taskStatus.nullable(),
  resultId: identifier.nullable(),
  reason: z.string().min(1).max(500),
  outcomeValuesInspected: z.literal(false),
}).strict();

const appOnlyMeta = {
  ui: { visibility: ["app"] },
  "openai/widgetAccessible": true,
} satisfies Record<string, unknown>;

const modelOnlyMeta = {
  ui: { visibility: ["model"] },
} satisfies Record<string, unknown>;

// Keep the first branch as the complete advertised model contract. The
// fallback admits an object only so the runtime can authenticate its task
// envelope and durably classify malformed/oversized submissions. Invalid or
// foreign capabilities still cannot mutate a task.
const malformedModelSubmissionBoundary = z.object({
  capability: z.string().min(1).max(64 * 1024),
  taskId: z.unknown().optional(),
}).passthrough();
const screen02SearchReviewToolInputSchema = z.union([
  screen02SearchReviewSubmissionSchema,
  malformedModelSubmissionBoundary,
]);
const screen03EvidenceMappingToolInputSchema = z.union([
  screen03EvidenceMappingSubmissionSchema,
  malformedModelSubmissionBoundary,
]);
const screen03OverviewToolInputSchema = z.union([
  screen03OverviewSubmissionSchema,
  malformedModelSubmissionBoundary,
]);
const sixScreenPolicyFactProofToolInputSchema = z.union([
  sixScreenPolicyFactProofSubmissionSchema,
  malformedModelSubmissionBoundary,
]);
const sixScreenMechanismProofToolInputSchema = z.union([
  sixScreenMechanismProofSubmissionSchema,
  malformedModelSubmissionBoundary,
]);
const screen04StudyEventAssessmentToolInputSchema = z.union([
  screen04StudyEventAssessmentSubmissionSchema,
  malformedModelSubmissionBoundary,
]);
const screen05StudyMechanismComparisonToolInputSchema = z.union([
  screen05StudyMechanismComparisonSubmissionSchema,
  malformedModelSubmissionBoundary,
]);
const screen05TheoreticalPlanningToolInputSchema = z.union([
  screen05TheoreticalPlanningSubmissionSchema,
  malformedModelSubmissionBoundary,
]);

const requiredFinalAction = {
  screen02:
    "This is the required final action for the current Screen 2 search-review task. Call it exactly once. Use only the supplied bounded facts and source IDs; do not answer with prose alone, do not call a packet or render tool, do not invent sources or facts, and do not make researcher decisions. Submit only proposed, noncanonical relevance review data; fixed software decides eligibility and application.",
  evidence:
    "This is the required final action for the current Screen 3 evidence-mapping task. Call it exactly once. Use only the supplied bounded facts and source IDs; do not answer with prose alone, do not call a packet or render tool, do not invent sources or facts, and do not make researcher decisions. Map only exact supplied passages and place every supplied active contradiction in the conflict partition; fixed software validates support and ChatGPT cannot confirm a claim.",
  overview:
    "This is the required final action for the current Screen 3 overview task. Call it exactly once. Use only the supplied bounded facts and source IDs; do not answer with prose alone, do not call a packet or render tool, do not invent sources or facts, and do not make researcher decisions. Submit a 60–100 word summary, three to five key points of at most 25 words each, and no more than two supplied uncertainties as concise noncanonical wording; verified Event Card facts cannot be replaced.",
  factualProof:
    "This is the required final action for the current six-screen factual round-trip proof. Call it exactly once. Use only the frozen reviewed claims and exact source references, preserve qualifications, and submit one noncanonical factual answer; do not answer with prose alone, do not call a packet or render tool, invent sources, change the Event Card, make a researcher decision, or claim that this transport proof verifies the underlying source.",
  mechanismProof:
    "This is the required final action for the current six-screen mechanism round-trip proof. Call it exactly once. Use only the frozen reviewed policy premise and stated study context; submit a clearly labeled noncanonical hypothesis with assumptions and alternatives, do not answer with prose alone, do not call a packet or render tool, and do not claim an estimated effect, scholarly support, causal identification, Event Card change, or researcher decision.",
  studyEvent:
    "This is the required final action for the current Screen 4 study-event assessment. Call it exactly once. Use only the frozen event, exact study context, and supplied source IDs. Independently screen the candidate before ranking it; background or exclusion is valid and needs no invented chain. A focal-policy stage requires source-linked action on the exact instrument. Separate documented facts, hypotheses, and unresolved links; do not classify a verified confounder, infer sample exposure, choose a control, inspect outcomes, or make a researcher decision.",
  studyMechanism:
    "This is the required final action for the current Screen 5 study-mechanism comparison. Call it exactly once. Evaluate the provisional plan against the unchanged theoretical problem, frozen study, and actually inspected abstracts. Make concepts, connected arguments, transfer limits, and distinguishing observations primary. A focal hypothesis or analytical rival may have no citation; zero supported alternatives or prediction rows is valid. Metadata-only leads support no detailed claim; do not claim mediation, causal identification, theory popularity, inspect outcomes, or make a researcher decision.",
  theoreticalPlan:
    "This is the required final action for the current Screen 5 pre-retrieval theoretical plan. Call it exactly once. Preserve the exact X, M0, Y, and complete study context. Return only provisional intervening-process hypotheses, supplementary nonmediator accounts, bounded evidence needs, and typed query intents including direct X-Y and contrary/boundary discovery. Do not invent authors, publications, citations, findings, sample values, or source-explicit theory, and do not make a researcher decision.",
} as const;

export type RegisterHostReasoningTaskToolsOptions = {
  exposure?: HostReasoningToolExposure;
};

/**
 * Registers no UI resource and no output template. Response schemas are
 * enforced inside each handler but are not duplicated into the advertised
 * tool catalog, whose complete full-mode encoding must stay below 64 KiB.
 * `disabled` is the safe
 * production default before a genuine signed-in host trace; `app-only` allows
 * lifecycle integration without exposing submission tools to the model;
 * `screen02-only` exposes only the reviewed Screen 2 submission boundary; and
 * `full` exposes the complete one-submission protocol.
 */
export function registerHostReasoningTaskTools(
  server: McpServer,
  runtime: HostReasoningTaskRuntime,
  options: RegisterHostReasoningTaskToolsOptions = {},
) {
  const exposure = options.exposure ?? "disabled";
  if (!HOST_REASONING_TOOL_EXPOSURES.includes(exposure)) {
    throw new Error("Host-reasoning tool exposure is invalid.");
  }
  if (exposure === "disabled") return [] as string[];
  const registered: string[] = [];

  server.registerTool(
    PREPARE_SHOCKAUDIT_HOST_TASK_TOOL,
    {
      title: "Prepare a bounded ShockAudit host task",
      description:
        "App-only. Authenticate the current run, freeze one exact bounded task, persist its immutable coordinates, and deliver private model context through component-only tool-result metadata for supported component-to-host messaging. This tool performs no model inference and its model-visible content contains no capability or credential.",
      inputSchema: hostReasoningPrepareInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: appOnlyMeta,
    },
    async (input) => {
      const result = await runtime.prepare(input);
      const {
        privateModelContext,
        ...publicResult
      } = result;
      const privateContextMeta = privateModelContextMetaSchema.parse({
        schemaVersion: HOST_REASONING_PRIVATE_CONTEXT_META_SCHEMA_VERSION,
        taskId: result.taskId,
        privateModelContext,
      });
      return {
        content: [{
          type: "text" as const,
          text: `Bounded host task ${result.taskId} is prepared for the existing ShockAudit panel.`,
        }],
        structuredContent: attachHostTaskTransport(
          preparedOutputSchema.parse(publicResult),
          "prepared-public",
        ),
        _meta: {
          [HOST_REASONING_PRIVATE_CONTEXT_META_KEY]: attachHostTaskTransport(
            privateContextMeta,
            "prepared-private-context",
          ),
        },
      };
    },
  );
  registered.push(PREPARE_SHOCKAUDIT_HOST_TASK_TOOL);

  server.registerTool(
    GET_SHOCKAUDIT_HOST_TASK_STATUS_TOOL,
    {
      title: "Check a ShockAudit host task",
      description:
        "App-only. Authenticate the current run and return compact persisted lifecycle state for same-panel reconciliation. It never reads assistant prose, creates a card, invokes a model, or returns a signed capability.",
      inputSchema: hostReasoningStatusInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: appOnlyMeta,
    },
    async (input) => {
      const result = await runtime.status(input);
      const status = result.task?.status ?? "not-found";
      return {
        content: [{
          type: "text" as const,
          text: `ShockAudit host task status: ${status}.`,
        }],
        structuredContent: attachHostTaskTransport(
          statusOutputSchema.parse(result),
          "status",
        ),
      };
    },
  );
  registered.push(GET_SHOCKAUDIT_HOST_TASK_STATUS_TOOL);

  server.registerTool(
    RECORD_SHOCKAUDIT_HOST_MESSAGE_DELIVERY_TOOL,
    {
      title: "Record ShockAudit host-message delivery",
      description:
        "App-only. Before opening a supported ui/message or capability-detected sendFollowUpMessage turn, durably journal that exact request; after the host call settles, finalize the same route as accepted or rejected. It performs no inference and stores no visible message, capability, credential, or conversation content.",
      inputSchema: hostReasoningMessageRecordInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: appOnlyMeta,
    },
    async (input) => {
      const result = await runtime.recordMessageDelivery(input);
      return {
        content: [{
          type: "text" as const,
          text:
            `ShockAudit host-message delivery for ${result.taskId}: ${result.disposition}.`,
        }],
        structuredContent: attachHostTaskTransport(
          messageRecordOutputSchema.parse(result),
          "message-record",
        ),
      };
    },
  );
  registered.push(RECORD_SHOCKAUDIT_HOST_MESSAGE_DELIVERY_TOOL);

  server.registerTool(
    RECORD_SHOCKAUDIT_HOST_PANEL_RECONCILIATION_TOOL,
    {
      title: "Record failed ShockAudit panel reconciliation",
      description:
        "App-only. Authenticate an exact applied result and record that bounded same-panel checks ended without reconciliation. The stored proposal remains applied and retrievable; successful reconciliation is acknowledged through get_shockaudit_host_task_status.",
      inputSchema: hostReasoningPanelFailureInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: appOnlyMeta,
    },
    async (input) => {
      const result = await runtime.recordPanelFailure(input);
      return {
        content: [{
          type: "text" as const,
          text:
            `ShockAudit panel reconciliation for ${result.taskId}: ${result.disposition}.`,
        }],
        structuredContent: attachHostTaskTransport(
          panelRecordOutputSchema.parse(result),
          "panel-record",
        ),
      };
    },
  );
  registered.push(RECORD_SHOCKAUDIT_HOST_PANEL_RECONCILIATION_TOOL);

  server.registerTool(
    CANCEL_SHOCKAUDIT_HOST_TASK_TOOL,
    {
      title: "Cancel a ShockAudit host task",
      description:
        "App-only. Authenticate the current run and cancel one exact uncompleted host task. Cancellation invalidates future use while deterministic Screen 2 or Screen 3 results remain available.",
      inputSchema: hostReasoningCancelInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: appOnlyMeta,
    },
    async (input) => {
      const result = await runtime.cancel(input);
      return {
        content: [{
          type: "text" as const,
          text: `ShockAudit host task ${result.taskId}: ${result.disposition}.`,
        }],
        structuredContent: attachHostTaskTransport(
          cancelOutputSchema.parse(result),
          "cancel",
        ),
      };
    },
  );
  registered.push(CANCEL_SHOCKAUDIT_HOST_TASK_TOOL);

  if (exposure === "app-only") return registered;

  server.registerTool(
    SUBMIT_SCREEN02_SEARCH_REVIEW_TOOL,
    {
      title: "Submit one Screen 2 search review",
      description: requiredFinalAction.screen02,
      inputSchema: screen02SearchReviewToolInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: modelOnlyMeta,
    },
    async (input) => {
      const receipt = await runtime.submitScreen02SearchReview(input);
      return {
        content: [{ type: "text" as const, text: receipt.reason }],
        structuredContent: submissionReceiptSchema.parse(receipt),
      };
    },
  );
  registered.push(SUBMIT_SCREEN02_SEARCH_REVIEW_TOOL);

  if (exposure === "screen02-only") return registered;

  server.registerTool(
    SUBMIT_SCREEN03_EVIDENCE_MAPPING_TOOL,
    {
      title: "Submit one Screen 3 evidence mapping",
      description: requiredFinalAction.evidence,
      inputSchema: screen03EvidenceMappingToolInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: modelOnlyMeta,
    },
    async (input) => {
      const receipt = await runtime.submitScreen03EvidenceMapping(input);
      return {
        content: [{ type: "text" as const, text: receipt.reason }],
        structuredContent: submissionReceiptSchema.parse(receipt),
      };
    },
  );
  registered.push(SUBMIT_SCREEN03_EVIDENCE_MAPPING_TOOL);

  server.registerTool(
    SUBMIT_SCREEN03_OVERVIEW_TOOL,
    {
      title: "Submit one Screen 3 overview",
      description: requiredFinalAction.overview,
      inputSchema: screen03OverviewToolInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: modelOnlyMeta,
    },
    async (input) => {
      const receipt = await runtime.submitScreen03Overview(input);
      return {
        content: [{ type: "text" as const, text: receipt.reason }],
        structuredContent: submissionReceiptSchema.parse(receipt),
      };
    },
  );
  registered.push(SUBMIT_SCREEN03_OVERVIEW_TOOL);

  server.registerTool(
    SUBMIT_SIX_SCREEN_POLICY_FACT_PROOF_TOOL,
    {
      title: "Submit one six-screen factual proof result",
      description: requiredFinalAction.factualProof,
      inputSchema: sixScreenPolicyFactProofToolInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: modelOnlyMeta,
    },
    async (input) => {
      const receipt = await runtime.submitSixScreenPolicyFactProof(input);
      return {
        content: [{ type: "text" as const, text: receipt.reason }],
        structuredContent: submissionReceiptSchema.parse(receipt),
      };
    },
  );
  registered.push(SUBMIT_SIX_SCREEN_POLICY_FACT_PROOF_TOOL);

  server.registerTool(
    SUBMIT_SIX_SCREEN_MECHANISM_PROOF_TOOL,
    {
      title: "Submit one six-screen mechanism proof result",
      description: requiredFinalAction.mechanismProof,
      inputSchema: sixScreenMechanismProofToolInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: modelOnlyMeta,
    },
    async (input) => {
      const receipt = await runtime.submitSixScreenMechanismProof(input);
      return {
        content: [{ type: "text" as const, text: receipt.reason }],
        structuredContent: submissionReceiptSchema.parse(receipt),
      };
    },
  );
  registered.push(SUBMIT_SIX_SCREEN_MECHANISM_PROOF_TOOL);

  server.registerTool(
    SUBMIT_SCREEN04_STUDY_EVENT_ASSESSMENT_TOOL,
    {
      title: "Submit one Screen 4 study-event assessment",
      description: requiredFinalAction.studyEvent,
      inputSchema: screen04StudyEventAssessmentToolInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: modelOnlyMeta,
    },
    async (input) => {
      const receipt = await runtime.submitScreen04StudyEventAssessment(input);
      return {
        content: [{ type: "text" as const, text: receipt.reason }],
        structuredContent: submissionReceiptSchema.parse(receipt),
      };
    },
  );
  registered.push(SUBMIT_SCREEN04_STUDY_EVENT_ASSESSMENT_TOOL);

  return registered;
}
