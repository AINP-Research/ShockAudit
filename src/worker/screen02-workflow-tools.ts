import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import {
  SCREEN_02_WORKFLOW_CORRELATION_META_KEY,
  SCREEN_02_WORKFLOW_META_KEY,
  SCREEN_02_WORKFLOW_RECEIPT_NOTICE_SCHEMA_VERSION,
  SCREEN_02_WORKFLOW_SUMMARY_SCHEMA_VERSION,
  createScreen02WorkflowCorrelation,
} from "../core/screen02-workflow-client";
import {
  SCREEN_02_SEALED_RESULT_ALGORITHM,
  SCREEN_02_SEALED_RESULT_MAX_PLAINTEXT_BYTES,
  SCREEN_02_SEALED_RESULT_SCHEMA_VERSION,
  sealScreen02WorkflowClientSnapshot,
  validateScreen02ExportedResponseKeyMaterial,
} from "../core/screen02-sealed-result";
import {
  SCREEN_02_AUDIT_DRAFT_SUBMISSION_SCHEMA_VERSION,
} from "./screen02-audit-assessment-security";
import {
  SCREEN_02_FIND_DRAFT_SUBMISSION_SCHEMA_VERSION,
} from "./screen02-find-assessment-security";
import {
  SCREEN_02_WORKFLOW_ACTION_SCHEMA_VERSION,
  SCREEN_02_WORKFLOW_ACTION_SCHEMA_VERSION_V024,
  SCREEN_02_WORKFLOW_ACTION_TOOL_V021,
  SCREEN_02_WORKFLOW_ACTION_TOOL_V024,
  type Screen02WorkflowAction,
} from "./screen02-workflow-controller";
import { Screen02WorkflowRuntime } from "./screen02-workflow-runtime";

export const SCREEN_02_WORKFLOW_RETIRE_TOOL_V021 =
  "retire_screen02_workflow_v021" as const;
export const SCREEN_02_WORKFLOW_RETIRE_SCHEMA_VERSION =
  "screen-02-workflow-retire-v1" as const;
export const SCREEN_02_WORKFLOW_RETIRE_RESULT_SCHEMA_VERSION =
  "screen-02-workflow-retire-result-v1" as const;

export type Screen02WorkflowToolRegistrationOptions = {
  /** Omission preserves the historical model-only submission tools. */
  legacyHostAssessments?: boolean;
};

const identifier = z.string().min(1).max(200);
const signedToken = z.string().min(1).max(64 * 1024);
const stateFingerprint = z.string().regex(/^fnv1a64:[0-9a-f]{16}$/);
const responseKeyMaterial = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const base64Url = z.string().regex(/^[A-Za-z0-9_-]+$/);
const payload = z
  .record(z.string().min(1).max(80), z.unknown())
  .refine((value) => Object.keys(value).length <= 12, {
    message: "A Screen 2 action payload accepts at most twelve fields.",
  });

const actionFields = {
  operationId: identifier,
  runId: identifier,
  accessToken: z.string().regex(/^s2a_[A-Za-z0-9_-]{43,128}$/),
  expectedRevision: z.number().int().nonnegative(),
  expectedStateFingerprint: stateFingerprint,
  action: z.enum([
    "refresh",
    "find-search",
    "find-search-continue",
    "find-update-relevance-profile",
    "find-open",
    "find-remove",
    "find-retry",
    "find-override",
    "find-select",
    "find-clear-selection",
    "find-continue",
    "find-continue-without-assessment",
    "audit-revise-anchor",
    "audit-open",
    "audit-confirm",
    "audit-related",
    "audit-reject",
    "audit-no-match",
    "audit-retry-dossier",
    "audit-retry-assessment",
    "audit-reconsider",
    "audit-continue",
    "audit-continue-without-assessment",
    "assessment-delivery",
    "assessment-timeout",
  ]),
  payload,
} as const;

const actionSchema = z
  .object({
    schemaVersion: z.literal(SCREEN_02_WORKFLOW_ACTION_SCHEMA_VERSION),
    ...actionFields,
  })
  .strict();

const actionSchemaV024 = z
  .object({
    schemaVersion: z.literal(
      SCREEN_02_WORKFLOW_ACTION_SCHEMA_VERSION_V024,
    ),
    responseKeyId: responseKeyMaterial,
    responseKey: responseKeyMaterial,
    ...actionFields,
  })
  .strict();

const retireSchema = z
  .object({
    schemaVersion: z.literal(SCREEN_02_WORKFLOW_RETIRE_SCHEMA_VERSION),
    runId: identifier,
    accessToken: z.string().regex(/^s2a_[A-Za-z0-9_-]{43,128}$/),
    expectedRevision: z.number().int().nonnegative(),
    expectedStateFingerprint: stateFingerprint,
  })
  .strict();

const retireResultSchema = z
  .object({
    schemaVersion: z.literal(
      SCREEN_02_WORKFLOW_RETIRE_RESULT_SCHEMA_VERSION,
    ),
    screen: z.literal("screen-02"),
    ok: z.boolean(),
    outcome: z.enum(["retired", "already-absent", "conflict"]),
    runId: identifier,
    message: z.string().min(1).max(2_000),
  })
  .strict();

export const screen02WorkflowSummarySchema = z
  .object({
    schemaVersion: z.literal(SCREEN_02_WORKFLOW_SUMMARY_SCHEMA_VERSION),
    screen: z.literal("screen-02"),
    ok: z.boolean(),
    outcome: z.enum([
      "created",
      "applied",
      "replayed",
      "refreshed",
      "conflict",
    ]),
    mode: z.enum(["find", "audit"]),
    assessmentAvailable: z.boolean(),
    preparedRequestCount: z.number().int().nonnegative(),
    deliveredRequestCount: z.number().int().nonnegative(),
    completedRequestCount: z.number().int().nonnegative(),
    continuationReady: z.boolean(),
    message: z.string().min(1).max(2_000),
  })
  .strict();

const maximumSealedCiphertextCharacters = Math.ceil(
  ((SCREEN_02_SEALED_RESULT_MAX_PLAINTEXT_BYTES + 16) * 4) / 3,
);

const screen02WorkflowSealedSnapshotSchema = z
  .object({
    schemaVersion: z.literal(SCREEN_02_SEALED_RESULT_SCHEMA_VERSION),
    algorithm: z.literal(SCREEN_02_SEALED_RESULT_ALGORITHM),
    kind: z.enum(["open", "mutation"]),
    operationId: identifier,
    keyId: responseKeyMaterial,
    iv: base64Url.length(16),
    ciphertext: base64Url.min(23).max(maximumSealedCiphertextCharacters),
  })
  .strict();

export const screen02WorkflowSealedSummarySchema =
  screen02WorkflowSummarySchema
    .extend({ sealedSnapshot: screen02WorkflowSealedSnapshotSchema })
    .strict();

const draft = z
  .record(z.string().min(1).max(80), z.unknown())
  .refine((value) => Object.keys(value).length <= 12, {
    message: "Assessment draft contains too many fields.",
  });

const findSubmissionSchema = z
  .object({
    schemaVersion: z.literal(
      SCREEN_02_FIND_DRAFT_SUBMISSION_SCHEMA_VERSION,
    ),
    capabilityToken: signedToken,
    requestId: identifier,
    draft,
    // Deliberately broad at transport: the authenticated boundary below
    // rejects malformed orientation independently without discarding a valid
    // assessment draft in the same submission.
    orientation: z.unknown().optional(),
  })
  .strict();

const auditSubmissionSchema = z
  .object({
    schemaVersion: z.literal(
      SCREEN_02_AUDIT_DRAFT_SUBMISSION_SCHEMA_VERSION,
    ),
    capabilityToken: signedToken,
    requestId: identifier,
    draft,
    orientation: z.unknown().optional(),
  })
  .strict();

const receiptNoticeSchema = z
  .object({
    schemaVersion: z.literal(
      SCREEN_02_WORKFLOW_RECEIPT_NOTICE_SCHEMA_VERSION,
    ),
    phase: z.literal("canonical-receipt-result"),
    runId: identifier,
    mode: z.enum(["find", "audit"]),
    requestId: identifier,
    receiptId: identifier,
    disposition: z.enum([
      "apply",
      "buffered-awaiting-delivery",
      "duplicate",
      "stale",
      "terminal",
      "unknown-request",
    ]),
    reason: z.string().min(1).max(2_000),
  })
  .strict();

export function registerScreen02WorkflowTools(
  server: McpServer,
  runtime: Screen02WorkflowRuntime,
  options: Screen02WorkflowToolRegistrationOptions = {},
) {
  server.registerTool(
    SCREEN_02_WORKFLOW_RETIRE_TOOL_V021,
    {
      title: "Delete a retired ShockAudit Screen 2 run",
      description:
        "App-only deletion boundary used after an explicit Reset Screen 2 confirmation or when editing Screen 1 retires its immutable workflow. It authenticates the private possession token and exact workflow coordinates, then removes the temporary canonical run. A failed replacement opener never calls this tool.",
      inputSchema: retireSchema,
      outputSchema: retireResultSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: { visibility: ["app"] },
        "openai/widgetAccessible": true,
        "openai/toolInvocation/invoking": "Deleting the retired Screen 2 run…",
        "openai/toolInvocation/invoked": "Retired Screen 2 run deleted",
      },
    },
    async (input) => {
      const result = await runtime.retire(input);
      const output = {
        schemaVersion: SCREEN_02_WORKFLOW_RETIRE_RESULT_SCHEMA_VERSION,
        screen: "screen-02" as const,
        ok: result.outcome !== "conflict",
        ...result,
      };
      return {
        content: [{ type: "text" as const, text: result.message }],
        structuredContent: output,
      };
    },
  );

  server.registerTool(
    SCREEN_02_WORKFLOW_ACTION_TOOL_V021,
    {
      title: "Update ShockAudit Screen 2",
      description:
        "App-only canonical Screen 2 mutation boundary. It authenticates the private run possession token, compares the exact revision and fingerprint, serializes every writer, applies one fixed Find or Audit action, and returns only a compact public summary. Find search and Audit anchor/URL correction may retrieve bounded external source records. Complete canonical state remains private widget metadata.",
      inputSchema: actionSchema,
      outputSchema: screen02WorkflowSummarySchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      _meta: {
        ui: { visibility: ["app"] },
        "openai/widgetAccessible": true,
        "openai/toolInvocation/invoking": "Updating Screen 2…",
        "openai/toolInvocation/invoked": "Screen 2 updated",
      },
    },
    async (input) => {
      const result = await runtime.mutate(input as Screen02WorkflowAction);
      return {
        content: [
          {
            type: "text" as const,
            text: result.summary.message,
          },
        ],
        structuredContent: result.summary,
        _meta: {
          [SCREEN_02_WORKFLOW_META_KEY]: result.snapshot,
          [SCREEN_02_WORKFLOW_CORRELATION_META_KEY]:
            createScreen02WorkflowCorrelation(
              result.snapshot,
              input.operationId,
              "mutation",
            ),
        },
      };
    },
  );

  server.registerTool(
    SCREEN_02_WORKFLOW_ACTION_TOOL_V024,
    {
      title: "Update ShockAudit Screen 2 with a sealed snapshot",
      description:
        "App-only canonical Screen 2 mutation boundary for the current widget. It authenticates the private run possession token, compares the exact revision and fingerprint, applies one fixed Find or Audit action, and returns the compact public summary plus an authenticated encrypted snapshot bound to this operation and the widget's fresh response key. The legacy component-private metadata is retained only for compatible hosts.",
      inputSchema: actionSchemaV024,
      outputSchema: screen02WorkflowSealedSummarySchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      _meta: {
        ui: { visibility: ["app"] },
        "openai/widgetAccessible": true,
        "openai/toolInvocation/invoking": "Updating Screen 2…",
        "openai/toolInvocation/invoked": "Screen 2 updated",
      },
    },
    async (input) => {
      const responseKey =
        await validateScreen02ExportedResponseKeyMaterial({
          keyId: input.responseKeyId,
          key: input.responseKey,
        });
      const result = await runtime.mutate({
        schemaVersion: SCREEN_02_WORKFLOW_ACTION_SCHEMA_VERSION,
        operationId: input.operationId,
        runId: input.runId,
        accessToken: input.accessToken,
        expectedRevision: input.expectedRevision,
        expectedStateFingerprint: input.expectedStateFingerprint,
        action: input.action,
        payload: input.payload,
      } satisfies Screen02WorkflowAction);
      const sealedSnapshot = await sealScreen02WorkflowClientSnapshot(
        result.snapshot,
        {
          operationId: input.operationId,
          kind: "mutation",
          responseKey,
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
          [SCREEN_02_WORKFLOW_META_KEY]: result.snapshot,
          [SCREEN_02_WORKFLOW_CORRELATION_META_KEY]:
            createScreen02WorkflowCorrelation(
              result.snapshot,
              input.operationId,
              "mutation",
            ),
        },
      };
    },
  );

  if (options.legacyHostAssessments === false) return;

  server.registerTool(
    "submit_screen02_find_assessment_draft_v021",
    {
      title: "Submit Screen 2 Find assessment",
      description:
        "Model-only. Submit one prepared Find request with its signed capability, exact request ID, and requested draft fields. A candidate may include the optional compact orientation sibling; fixed code validates it separately, so it cannot invalidate the assessment. Never submit state, scores, or an overall judgment.",
      inputSchema: findSubmissionSchema,
      outputSchema: receiptNoticeSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: { ui: { visibility: ["model"] } },
    },
    async (submission) => {
      const notice = await runtime.submitFindDraft(submission);
      return {
        content: [
          {
            type: "text" as const,
            text: `Find assessment receipt ${notice.receiptId}: ${notice.disposition}. ${notice.reason}`,
          },
        ],
        structuredContent: notice,
      };
    },
  );

  server.registerTool(
    "submit_screen02_audit_draft_v021",
    {
      title: "Submit Screen 2 Audit draft",
      description:
        "Model-only. Submit one prepared Audit request with its signed capability, exact request ID, and requested draft fields. It may include the optional compact orientation sibling; fixed code validates it separately, so it cannot invalidate the dossier or assessment. Never confirm identity or submit an overall judgment.",
      inputSchema: auditSubmissionSchema,
      outputSchema: receiptNoticeSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: { ui: { visibility: ["model"] } },
    },
    async (submission) => {
      const notice = await runtime.submitAuditDraft(submission);
      return {
        content: [
          {
            type: "text" as const,
            text: `Audit assessment receipt ${notice.receiptId}: ${notice.disposition}. ${notice.reason}`,
          },
        ],
        structuredContent: notice,
      };
    },
  );
}
