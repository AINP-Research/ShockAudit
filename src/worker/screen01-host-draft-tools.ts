import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import {
  SCREEN_01_HOST_DRAFT_APPLICATION_SCHEMA_VERSION,
  SCREEN_01_HOST_DRAFT_APPLY_INPUT_SCHEMA_VERSION,
  SCREEN_01_HOST_DRAFT_APPLY_TOOL_V036,
  SCREEN_01_HOST_DRAFT_MAX_IDENTIFIER_CHARACTERS,
  SCREEN_01_HOST_DRAFT_MAX_TOKEN_CHARACTERS,
  SCREEN_01_HOST_DRAFT_MODEL_CONTEXT_SCHEMA_VERSION,
  SCREEN_01_HOST_DRAFT_PREPARE_INPUT_SCHEMA_VERSION,
  SCREEN_01_HOST_DRAFT_PREPARE_TOOL_V036,
  SCREEN_01_HOST_DRAFT_RECEIPT_SCHEMA_VERSION,
  SCREEN_01_HOST_DRAFT_SUBMISSION_SCHEMA_VERSION,
  SCREEN_01_HOST_DRAFT_SUBMIT_TOOL_V036,
  SCREEN_01_HOST_DRAFT_TASK_SCHEMA_VERSION,
} from "../core/screen01-host-draft";
import { fieldKeys } from "../core/scope-types";
import {
  SCREEN_01_HOST_DRAFT_CAPABILITY_SCHEMA_VERSION,
  assertScreen01HostDraftSigningConfig,
  applySignedScreen01HostDraftReceipt,
  createScreen01HostDraftTask,
  createSignedScreen01HostDraftReceipt,
  type Screen01HostDraftSigningSource,
} from "./screen01-host-draft-security";

export {
  SCREEN_01_HOST_DRAFT_APPLY_TOOL_V036,
  SCREEN_01_HOST_DRAFT_PREPARE_TOOL_V036,
  SCREEN_01_HOST_DRAFT_SUBMIT_TOOL_V036,
};

const identifierSchema = z
  .string()
  .min(1)
  .max(SCREEN_01_HOST_DRAFT_MAX_IDENTIFIER_CHARACTERS);
const signedTokenSchema = z
  .string()
  .min(1)
  .max(SCREEN_01_HOST_DRAFT_MAX_TOKEN_CHARACTERS);
const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const canonicalLineSchema = z
  .string()
  .min(1)
  .max(200)
  .refine((value) => value.trim() === value && !/[\r\n\t\0\u2028\u2029]/.test(value), {
    message: "Use one trimmed line.",
  });
const canonicalOptionalLineSchema = z
  .string()
  .max(200)
  .refine((value) => value.trim() === value && !/[\r\n\t\0\u2028\u2029]/.test(value), {
    message: "Use one trimmed line.",
  });

const scopeSchema = z
  .object({
    population: canonicalLineSchema,
    assignmentLevel: canonicalLineSchema,
    analysisLevel: canonicalLineSchema,
    geography: canonicalLineSchema,
    industry: canonicalLineSchema,
    studyPeriod: canonicalLineSchema,
    eventFamily: canonicalLineSchema,
    outcomeFamily: canonicalLineSchema,
    outcomeFrequency: canonicalLineSchema,
  })
  .strict();

const screen01StateSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    mode: z.enum(["find", "audit"]),
    sentence: z.string().min(20).max(350),
    contractSourceSentence: z.string().max(350),
    scope: scopeSchema,
    knownShock: canonicalOptionalLineSchema,
    resolvedKeys: z
      .array(z.enum([...fieldKeys, "knownShock"]))
      .max(fieldKeys.length + 1),
    scopeDirty: z.boolean(),
    confirmed: z.boolean(),
  })
  .strict();

const proposalSchema = z
  .object({
    scope: scopeSchema,
    knownShock: canonicalOptionalLineSchema,
  })
  .strict();

const prepareInputSchema = z
  .object({
    schemaVersion: z.literal(
      SCREEN_01_HOST_DRAFT_PREPARE_INPUT_SCHEMA_VERSION,
    ),
    operationId: identifierSchema,
    sourceState: screen01StateSchema,
  })
  .strict();

const fieldGuideSchema = z
  .object({
    population: z.string(),
    assignmentLevel: z.string(),
    analysisLevel: z.string(),
    geography: z.string(),
    industry: z.string(),
    studyPeriod: z.string(),
    eventFamily: z.string(),
    outcomeFamily: z.string(),
    outcomeFrequency: z.string(),
  })
  .strict();

const preparedTaskOutputSchema = z
  .object({
    schemaVersion: z.literal(SCREEN_01_HOST_DRAFT_TASK_SCHEMA_VERSION),
    phase: z.literal("prepared"),
    operationId: identifierSchema,
    requestId: identifierSchema,
    sourceRevision: z.number().int().nonnegative(),
    sourceStateDigest: digestSchema,
    mode: z.enum(["find", "audit"]),
    sentence: z.string().min(20).max(350),
    issuedAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    requiredTool: z.literal(SCREEN_01_HOST_DRAFT_SUBMIT_TOOL_V036),
    prompt: z.string().min(1).max(4_000),
    modelContext: z
      .object({
        schemaVersion: z.literal(
          SCREEN_01_HOST_DRAFT_MODEL_CONTEXT_SCHEMA_VERSION,
        ),
        task: z.literal("draft-screen-01-scope"),
        operationId: identifierSchema,
        requestId: identifierSchema,
        source: z
          .object({
            mode: z.enum(["find", "audit"]),
            sentence: z.string().min(20).max(350),
          })
          .strict(),
        requestedScopeKeys: z.tuple([
          z.literal("population"),
          z.literal("assignmentLevel"),
          z.literal("analysisLevel"),
          z.literal("geography"),
          z.literal("industry"),
          z.literal("studyPeriod"),
          z.literal("eventFamily"),
          z.literal("outcomeFamily"),
          z.literal("outcomeFrequency"),
        ]),
        knownShockRule: z.string().min(1).max(400),
        fieldGuide: fieldGuideSchema,
        safetyRules: z.array(z.string().min(1).max(400)).min(1).max(10),
        outputRules: z.array(z.string().min(1).max(400)).min(1).max(10),
        submission: z
          .object({
            tool: z.literal(SCREEN_01_HOST_DRAFT_SUBMIT_TOOL_V036),
            schemaVersion: z.literal(
              SCREEN_01_HOST_DRAFT_SUBMISSION_SCHEMA_VERSION,
            ),
            capabilityToken: signedTokenSchema,
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

const submitInputSchema = z
  .object({
    schemaVersion: z.literal(SCREEN_01_HOST_DRAFT_SUBMISSION_SCHEMA_VERSION),
    capabilityToken: signedTokenSchema,
    requestId: identifierSchema,
    draft: proposalSchema,
  })
  .strict();

const receiptNoticeOutputSchema = z
  .object({
    schemaVersion: z.literal(SCREEN_01_HOST_DRAFT_RECEIPT_SCHEMA_VERSION),
    phase: z.literal("signed-receipt"),
    operationId: identifierSchema,
    requestId: identifierSchema,
    receiptId: identifierSchema,
    sourceRevision: z.number().int().nonnegative(),
    sourceStateDigest: digestSchema,
    receivedAt: z.iso.datetime(),
    receiptToken: signedTokenSchema,
  })
  .strict();

const applyInputSchema = z
  .object({
    schemaVersion: z.literal(
      SCREEN_01_HOST_DRAFT_APPLY_INPUT_SCHEMA_VERSION,
    ),
    operationId: identifierSchema,
    sourceState: screen01StateSchema,
    receiptToken: signedTokenSchema,
  })
  .strict();

const ambiguitySchema = z
  .object({
    key: z.enum([...fieldKeys, "knownShock"]),
    title: z.string(),
    question: z.string(),
    choices: z
      .array(
        z
          .object({
            label: z.string(),
            value: z.string(),
            recommended: z.boolean().optional(),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

const applicationOutputSchema = z
  .object({
    schemaVersion: z.literal(
      SCREEN_01_HOST_DRAFT_APPLICATION_SCHEMA_VERSION,
    ),
    phase: z.literal("applied"),
    ok: z.literal(true),
    operationId: identifierSchema,
    requestId: identifierSchema,
    receiptId: identifierSchema,
    sourceRevision: z.number().int().nonnegative(),
    sourceStateDigest: digestSchema,
    proposedState: screen01StateSchema,
    ambiguities: z.array(ambiguitySchema).max(fieldKeys.length + 1),
    message: z.string().min(1).max(1_000),
  })
  .strict();

export type Screen01HostDraftToolOptions = {
  signingConfig: Screen01HostDraftSigningSource;
  now: () => string;
  createId: () => string;
};

/**
 * Registers legacy app-only compatibility endpoints. The current Screen 1
 * workflow has no caller for these tools; keeping them app-only prevents the
 * retired drafting path from appearing in the model-visible tool catalog.
 */
export function registerScreen01HostDraftTools(
  server: McpServer,
  options: Screen01HostDraftToolOptions,
) {
  assertScreen01HostDraftSigningConfig(options.signingConfig);

  server.registerTool(
    SCREEN_01_HOST_DRAFT_PREPARE_TOOL_V036,
    {
      title: "Prepare a ChatGPT Scope Draft",
      description:
        `App-only Screen 1 preparation tool. It validates the exact current Screen 1 snapshot and creates a short-lived HMAC capability for one model submission (${SCREEN_01_HOST_DRAFT_CAPABILITY_SCHEMA_VERSION}). It performs no AI inference and persists no state.`,
      inputSchema: prepareInputSchema,
      outputSchema: preparedTaskOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: {
        ui: { visibility: ["app"] },
        "openai/widgetAccessible": true,
      },
    },
    async ({ operationId, sourceState }) => {
      const issued = await createScreen01HostDraftTask(
        {
          sourceState,
          operationId,
          requestId: options.createId(),
          capabilityId: options.createId(),
          issuedAt: options.now(),
        },
        options.signingConfig,
      );
      return {
        content: [
          {
            type: "text" as const,
            text: "A bounded Screen 1 scope-drafting task is ready for ChatGPT.",
          },
        ],
        structuredContent: issued.task,
      };
    },
  );

  server.registerTool(
    SCREEN_01_HOST_DRAFT_SUBMIT_TOOL_V036,
    {
      title: "Submit the Screen 1 Scope Draft",
      description:
        "Legacy app-only Screen 1 compatibility tool. The current Screen 1 workflow never invokes it. It validates and signs an earlier prepared nine-field proposal without confirming or persisting state.",
      inputSchema: submitInputSchema,
      outputSchema: receiptNoticeOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: {
        ui: { visibility: ["app"] },
      },
    },
    async (submission) => {
      const signed = await createSignedScreen01HostDraftReceipt(
        {
          submission,
          receiptId: options.createId(),
          receivedAt: options.now(),
        },
        options.signingConfig,
      );
      return {
        content: [
          {
            type: "text" as const,
            text: "The signed Screen 1 scope draft is ready for app verification.",
          },
        ],
        structuredContent: signed.notice,
      };
    },
  );

  server.registerTool(
    SCREEN_01_HOST_DRAFT_APPLY_TOOL_V036,
    {
      title: "Apply a Verified ChatGPT Scope Draft",
      description:
        "App-only Screen 1 application tool. It authenticates the signed receipt against the exact still-current source snapshot and returns an unconfirmed proposed state for user review. It is stateless and invokes no AI model.",
      inputSchema: applyInputSchema,
      outputSchema: applicationOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: { visibility: ["app"] },
        "openai/widgetAccessible": true,
      },
    },
    async ({ operationId, sourceState, receiptToken }) => {
      const result = await applySignedScreen01HostDraftReceipt(
        {
          sourceState,
          operationId,
          receiptToken,
          appliedAt: options.now(),
        },
        options.signingConfig,
      );
      return {
        content: [
          {
            type: "text" as const,
            text: result.message,
          },
        ],
        structuredContent: result,
      };
    },
  );
}
