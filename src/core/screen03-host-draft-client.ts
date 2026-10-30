/**
 * Browser-safe Screen 3 host-task transport contract. Keep this module free of
 * Worker, Zod, crypto, research, and MCP server imports: the widget needs only
 * enough structure to deliver a signed, bounded briefing task. New model
 * submissions return only the opaque authority, request identity, and draft;
 * the Worker reconstructs the authoritative packet from canonical state.
 */
export const SCREEN_03_HOST_DRAFT_PREPARE_TOOL_V036 =
  "prepare_screen03_host_draft_v036" as const;
export const SCREEN_03_HOST_DRAFT_SUBMIT_TOOL_V036 =
  "submit_screen03_host_draft_v036" as const;
export const SCREEN_03_HOST_DRAFT_SAMPLING_OUTPUT_TOOL =
  "return_screen03_briefing_draft" as const;
export const SCREEN_03_HOST_DRAFT_PREPARE_SCHEMA_VERSION =
  "screen-03-host-draft-prepare-v1" as const;
export const SCREEN_03_HOST_DRAFT_SOURCE_PACKET_SCHEMA_VERSION =
  "screen-03-host-draft-source-packet-v1" as const;
export const SCREEN_03_HOST_DRAFT_BATCH_SCHEMA_VERSION =
  "screen-03-host-draft-batch-v1" as const;
export const SCREEN_03_HOST_DRAFT_SUBMISSION_SCHEMA_VERSION =
  "screen-03-host-draft-submission-v1" as const;
export const SCREEN_03_HOST_DRAFT_RECEIPT_NOTICE_SCHEMA_VERSION =
  "screen-03-host-draft-receipt-notice-v1" as const;
export const SCREEN_03_HOST_DRAFT_DEFAULT_CAPABILITY_TTL_MS = 120_000;
export const SCREEN_03_HOST_DRAFT_SAMPLING_TIMEOUT_MS = 90_000;

/**
 * Browser-safe output schema for an MCP sampling request. The host is given
 * exactly one required tool, so a successful sampling result contains a
 * structured draft instead of prose that the widget would have to scrape.
 * The signed server boundary still performs the authoritative validation and
 * derives every citation from canonical state.
 */
type Screen03HostDraftSamplingTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, object>;
    required?: string[];
    [key: string]: unknown;
  };
  annotations: {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    openWorldHint: boolean;
  };
};

export const SCREEN_03_HOST_DRAFT_SAMPLING_TOOL: Screen03HostDraftSamplingTool = {
  name: SCREEN_03_HOST_DRAFT_SAMPLING_OUTPUT_TOOL,
  title: "Return a source-bounded Screen 3 briefing draft",
  description:
    "Return only the proposed noncanonical reader briefing. Use proposal IDs from the bounded task and do not supply citations, URLs, Markdown, or workflow decisions.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      snapshot: {
        type: "object",
        additionalProperties: false,
        properties: {
          intro: { $ref: "#/$defs/block" },
          keyPoints: {
            type: "array",
            minItems: 1,
            maxItems: 6,
            items: { $ref: "#/$defs/block" },
          },
        },
        required: ["intro", "keyPoints"],
      },
      studyRelevance: {
        type: "object",
        additionalProperties: false,
        properties: {
          sampleConnection: { $ref: "#/$defs/block" },
          outcomeConnection: { $ref: "#/$defs/block" },
        },
        required: ["sampleConnection", "outcomeConnection"],
      },
      claimExplanations: {
        type: "array",
        maxItems: 40,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            proposalId: { type: "string", minLength: 1, maxLength: 200 },
            text: { type: "string", minLength: 1, maxLength: 280 },
          },
          required: ["proposalId", "text"],
        },
      },
    },
    required: ["snapshot"],
    $defs: {
      block: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: { type: "string", minLength: 1, maxLength: 360 },
          proposalIds: {
            type: "array",
            minItems: 1,
            maxItems: 4,
            uniqueItems: true,
            items: { type: "string", minLength: 1, maxLength: 200 },
          },
        },
        required: ["text", "proposalIds"],
      },
    },
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};

export type Screen03HostDraftClientBatch = {
  schemaVersion: typeof SCREEN_03_HOST_DRAFT_BATCH_SCHEMA_VERSION;
  requestId: string;
  capabilityToken: string;
  expiresAt: string;
  sourcePacket: Record<string, unknown>;
  instructions: string;
};

export type Screen03HostDraftClientSubmission = {
  schemaVersion: typeof SCREEN_03_HOST_DRAFT_SUBMISSION_SCHEMA_VERSION;
  capabilityToken: string;
  requestId: string;
  /** Accepted only for clients using the legacy exact-packet echo contract. */
  sourcePacket?: Record<string, unknown>;
  draft: Record<string, unknown>;
};

export type Screen03HostDraftReceiptNotice = {
  schemaVersion: typeof SCREEN_03_HOST_DRAFT_RECEIPT_NOTICE_SCHEMA_VERSION;
  phase: "canonical-receipt-result";
  runId: string;
  requestId: string;
  disposition: "applied" | "duplicate" | "stale" | "conflict" | "rejected";
  reason: string;
};

export type Screen03HostDraftDelivery = {
  delivered: boolean;
  channel:
    | "mcp-sampling"
    | "mcp-apps"
    | "chatgpt-compatibility"
    | "unavailable"
    | "message-rejected";
  message: string;
  receipt?: Screen03HostDraftReceiptNotice;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

/**
 * Transport validation only. The model-only submit tool revalidates the full
 * signed packet, request digest, citations, and canonical state coordinates.
 */
export function isScreen03HostDraftClientBatch(
  value: unknown,
): value is Screen03HostDraftClientBatch {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "schemaVersion",
      "requestId",
      "capabilityToken",
      "expiresAt",
      "sourcePacket",
      "instructions",
    ]) ||
    value.schemaVersion !== SCREEN_03_HOST_DRAFT_BATCH_SCHEMA_VERSION ||
    typeof value.requestId !== "string" ||
    value.requestId.length < 1 ||
    value.requestId.length > 200 ||
    typeof value.capabilityToken !== "string" ||
    !value.capabilityToken.startsWith("sa3h-capability-v1.") ||
    value.capabilityToken.length > 32 * 1024 ||
    typeof value.expiresAt !== "string" ||
    !Number.isFinite(Date.parse(value.expiresAt)) ||
    new Date(value.expiresAt).toISOString() !== value.expiresAt ||
    typeof value.instructions !== "string" ||
    value.instructions.length < 1 ||
    value.instructions.length > 8_000 ||
    !isRecord(value.sourcePacket)
  ) {
    return false;
  }
  const packet = value.sourcePacket;
  return exactKeys(packet, [
    "schemaVersion",
    "requestId",
    "requestFingerprint",
    "requestDigest",
    "request",
    "modelContext",
  ]) &&
    packet.schemaVersion === SCREEN_03_HOST_DRAFT_SOURCE_PACKET_SCHEMA_VERSION &&
    packet.requestId === value.requestId &&
    typeof packet.requestFingerprint === "string" &&
    /^fnv1a64:[0-9a-f]{16}$/.test(packet.requestFingerprint) &&
    typeof packet.requestDigest === "string" &&
    /^sha256:[0-9a-f]{64}$/.test(packet.requestDigest) &&
    isRecord(packet.request) &&
    isRecord(packet.modelContext);
}

export function isScreen03HostDraftReceiptNotice(
  value: unknown,
): value is Screen03HostDraftReceiptNotice {
  if (!isRecord(value)) return false;
  return exactKeys(value, [
    "schemaVersion",
    "phase",
    "runId",
    "requestId",
    "disposition",
    "reason",
  ]) &&
    value.schemaVersion === SCREEN_03_HOST_DRAFT_RECEIPT_NOTICE_SCHEMA_VERSION &&
    value.phase === "canonical-receipt-result" &&
    typeof value.runId === "string" &&
    /^s2r_[A-Za-z0-9_-]{43,128}$/.test(value.runId) &&
    typeof value.requestId === "string" &&
    value.requestId.length >= 1 &&
    value.requestId.length <= 200 &&
    ["applied", "duplicate", "stale", "conflict", "rejected"].includes(
      value.disposition as string,
    ) &&
    typeof value.reason === "string" &&
    value.reason.length >= 1 &&
    value.reason.length <= 2_000;
}
