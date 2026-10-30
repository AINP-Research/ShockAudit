import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { SCREEN_02_FIND_SUBMIT_DRAFT_TOOL_V021 } from "../core/screen02-find-workflow";
import {
  SCREEN_02_MAX_CANONICAL_SESSION_BYTES,
  SCREEN_02_MAX_COMPRESSED_STATE_BYTES,
} from "../core/screen02-state-capacity";
import {
  SCREEN_02_WORKFLOW_STATE_ENVELOPE_ENCODING,
  SCREEN_02_WORKFLOW_STATE_ENVELOPE_SCHEMA_VERSION,
} from "../core/screen02-workflow-envelope";
import {
  SCREEN_02_FIND_STATE_KIND,
  SCREEN_02_WORKFLOW_SCHEMA_VERSION,
} from "../core/screen02-workflow-types";
import {
  SCREEN_02_FIND_CAPABILITY_SCHEMA_VERSION,
  SCREEN_02_FIND_DRAFT_SUBMISSION_SCHEMA_VERSION,
  SCREEN_02_FIND_SIGNED_RECEIPT_SCHEMA_VERSION,
  assertScreen02FindSigningConfig,
  createSignedScreen02FindNormalizedReceipt,
  type Screen02FindSigningConfig,
} from "./screen02-find-assessment-security";
import {
  SCREEN_02_FIND_RECEIPT_APPLICATION_SCHEMA_VERSION,
  SCREEN_02_FIND_RECEIPT_APPLY_INPUT_SCHEMA_VERSION,
  applySignedScreen02FindReceiptEnvelope,
} from "./screen02-find-assessment-service";

export { SCREEN_02_FIND_SUBMIT_DRAFT_TOOL_V021 };
export const SCREEN_02_FIND_APPLY_RECEIPT_TOOL_V021 =
  "apply_screen02_find_assessment_receipt_v021" as const;

const signedTokenSchema = z.string().min(1).max(64 * 1024);
const identifierSchema = z.string().min(1).max(200);
const stateFingerprintSchema = z.string().regex(/^fnv1a64:[0-9a-f]{16}$/);
const draftSchema = z
  .record(z.string().min(1).max(80), z.unknown())
  .refine((value) => Object.keys(value).length <= 5, {
    message: "Find assessment draft contains too many fields.",
  });
const stateEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(
      SCREEN_02_WORKFLOW_STATE_ENVELOPE_SCHEMA_VERSION,
    ),
    workflowSchemaVersion: z.literal(SCREEN_02_WORKFLOW_SCHEMA_VERSION),
    stateKind: z.literal(SCREEN_02_FIND_STATE_KIND),
    encoding: z.literal(SCREEN_02_WORKFLOW_STATE_ENVELOPE_ENCODING),
    uncompressedBytes: z
      .number()
      .int()
      .positive()
      .max(SCREEN_02_MAX_CANONICAL_SESSION_BYTES),
    compressedBytes: z
      .number()
      .int()
      .positive()
      .max(SCREEN_02_MAX_COMPRESSED_STATE_BYTES),
    checksum: z.string().regex(/^fnv1a64:[0-9a-f]{16}$/),
    payload: z.string().min(1).max(256 * 1024),
  })
  .strict();
const submitDraftSchema = z
  .object({
    schemaVersion: z.literal(SCREEN_02_FIND_DRAFT_SUBMISSION_SCHEMA_VERSION),
    capabilityToken: signedTokenSchema,
    requestId: identifierSchema,
    draft: draftSchema,
    // Security normalization intentionally owns the optional sibling so a
    // malformed orientation cannot cause transport to reject the assessment.
    orientation: z.unknown().optional(),
  })
  .strict();
const applyReceiptSchema = z
  .object({
    schemaVersion: z.literal(
      SCREEN_02_FIND_RECEIPT_APPLY_INPUT_SCHEMA_VERSION,
    ),
    stateEnvelope: stateEnvelopeSchema,
    receiptToken: signedTokenSchema,
  })
  .strict();
const validationFailureSchema = z
  .object({
    partId: identifierSchema,
    codes: z.array(z.string().min(1).max(80)).min(1).max(10),
  })
  .strict();
const submitDraftOutputSchema = z
  .object({
    schemaVersion: z.literal(SCREEN_02_FIND_SIGNED_RECEIPT_SCHEMA_VERSION),
    phase: z.literal("signed-normalized-receipt"),
    requestId: identifierSchema,
    receiptId: identifierSchema,
    mode: z.enum(["find-candidate", "find-criterion"]),
    acceptedPartIds: z.array(identifierSchema).max(5),
    validationFailures: z.array(validationFailureSchema).max(5),
    receiptToken: signedTokenSchema,
  })
  .strict();
const applicationResultSchema = z
  .object({
    requestId: identifierSchema,
    status: z.enum([
      "completed",
      "partial",
      "retry-exhausted",
      "validation-failed",
      "ignored",
    ]),
    acceptedPartIds: z.array(identifierSchema).max(5),
    failures: z.array(validationFailureSchema).max(5),
    reason: z.string().min(1).max(1_000),
  })
  .strict();
const applyReceiptOutputSchema = z
  .object({
    schemaVersion: z.literal(
      SCREEN_02_FIND_RECEIPT_APPLICATION_SCHEMA_VERSION,
    ),
    disposition: z.enum([
      "apply",
      "duplicate",
      "awaiting-delivery",
      "stale",
      "terminal",
      "unknown-request",
    ]),
    reason: z.string().min(1).max(1_000),
    requestId: identifierSchema,
    receiptId: identifierSchema,
    predecessorStateRevision: z.number().int().nonnegative(),
    predecessorStateFingerprint: stateFingerprintSchema,
    successorStateRevision: z.number().int().nonnegative(),
    successorStateFingerprint: stateFingerprintSchema,
    stateEnvelope: stateEnvelopeSchema,
    applicationResults: z.array(applicationResultSchema).max(1),
  })
  .strict();

export type Screen02FindAssessmentDevelopmentToolOptions = {
  signingConfig: Screen02FindSigningConfig;
  now: () => string;
  createReceiptId: () => string;
};

/**
 * Optional Stage 3 registration. These uniquely named data-only tools do not
 * alter released v0.2.20 openers or resource routing. A missing/short signing
 * key throws before either tool is registered.
 */
export function registerScreen02FindAssessmentDevelopmentTools(
  server: McpServer,
  options: Screen02FindAssessmentDevelopmentToolOptions,
) {
  assertScreen02FindSigningConfig(options.signingConfig);

  server.registerTool(
    SCREEN_02_FIND_SUBMIT_DRAFT_TOOL_V021,
    {
      title: "Submit Screen 2 Find Assessment Draft (v0.2.21 development)",
      description:
        `Model-only Stage 3 development tool. Submit the exact ${SCREEN_02_FIND_DRAFT_SUBMISSION_SCHEMA_VERSION} request with its HMAC capability and only the requested assessment fields. A candidate request may include one optional compact orientation sibling, which is validated independently from the assessment. The fixed worker strips invalid fields and returns a signed normalized receipt; it does not persist state or invoke a model API. Capability schema: ${SCREEN_02_FIND_CAPABILITY_SCHEMA_VERSION}.`,
      inputSchema: submitDraftSchema,
      outputSchema: submitDraftOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: {
        ui: { visibility: ["model"] },
      },
    },
    async (submission) => {
      const signed = await createSignedScreen02FindNormalizedReceipt(
        {
          submission,
          receiptId: options.createReceiptId(),
          receivedAt: options.now(),
        },
        options.signingConfig,
      );
      const structuredContent = {
        schemaVersion: signed.payload.schemaVersion,
        phase: "signed-normalized-receipt" as const,
        requestId: signed.payload.capability.requestId,
        receiptId: signed.payload.receiptId,
        mode: signed.payload.capability.mode,
        acceptedPartIds: signed.acceptedPartIds,
        validationFailures: signed.payload.validationFailures,
        receiptToken: signed.receiptToken,
      };
      return {
        content: [
          {
            type: "text" as const,
            text:
              signed.acceptedPartIds.length > 0
                ? `Signed normalized Find receipt ${signed.payload.receiptId} is ready for stateless application.`
                : `Signed Find receipt ${signed.payload.receiptId} contains no accepted parts; fixed application will record a retryable validation failure.`,
          },
        ],
        structuredContent,
      };
    },
  );

  server.registerTool(
    SCREEN_02_FIND_APPLY_RECEIPT_TOOL_V021,
    {
      title: "Apply Screen 2 Find Assessment Receipt (v0.2.21 development)",
      description:
        "App-only Stage 3 development tool. Verify one HMAC-signed normalized receipt against the complete bounded v2.1 Find state envelope, apply it through fixed core, and return the successor envelope. This stateless tool performs no persistence and invokes no model API.",
      inputSchema: applyReceiptSchema,
      outputSchema: applyReceiptOutputSchema,
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
    async ({ stateEnvelope, receiptToken }) => {
      const result = await applySignedScreen02FindReceiptEnvelope(
        { stateEnvelope, receiptToken },
        options.signingConfig,
      );
      return {
        content: [
          {
            type: "text" as const,
            text: `Screen 2 Find receipt ${result.receiptId}: ${result.disposition}. ${result.reason}`,
          },
        ],
        structuredContent: result,
      };
    },
  );
}
