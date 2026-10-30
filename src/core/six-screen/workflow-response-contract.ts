import {
  fingerprintSixScreenValue,
  serializeSixScreenValue,
} from "./canonical";
import { gunzipSync, gzipSync } from "fflate";

export const SIX_SCREEN_WORKFLOW_RESPONSE_CONTRACT_VERSION =
  "shockaudit-six-screen-workflow-response-v6" as const;
/**
 * Response-v6 peer identity for verified navigation and complete-report export.
 * An already-open panel validates this value before accepting canonical state.
 */
export const SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID =
  "production-six-screen-handoff-2026-10-25-v109-r1" as const;
export const SIX_SCREEN_WORKFLOW_STATE_ENCODING =
  "canonical-json-gzip-base64-v1" as const;
export const SIX_SCREEN_WORKFLOW_STATE_CHUNK_TOOL =
  "get_six_screen_workflow_state_chunk_v2" as const;
export const SIX_SCREEN_WORKFLOW_STATE_CHUNK_SCHEMA_VERSION =
  "shockaudit-six-screen-state-chunk-v2" as const;
export const SIX_SCREEN_HYDRATED_STATE_PAYLOAD_META_KEY =
  "shockaudit/sixScreenHydratedStatePayload" as const;

// Later screens retain source passages, scholarly records, provider receipts,
// and immutable checkpoints. Keep explicit finite transport limits, with enough
// headroom for real Screen 5 -> 6 workspaces whose compressed state exceeded
// the prior one-shot delivery ceiling.
export const SIX_SCREEN_MAX_CANONICAL_PAYLOAD_BYTES = 128 * 1024 * 1024;
export const SIX_SCREEN_MAX_ENCODED_PAYLOAD_BYTES = 32 * 1024 * 1024;
/** Keep ordinary tool results comfortably below host response-field limits.
 * Larger authenticated state is fetched through small, exact chunks after the
 * mutation response is committed; it is never resent as another mutation. */
export const SIX_SCREEN_INLINE_STATE_PAYLOAD_BYTES = 256 * 1024;
export const SIX_SCREEN_STATE_CHUNK_BYTES = 192 * 1024;
export const SIX_SCREEN_MAX_STATE_CHUNKS = Math.ceil(
  SIX_SCREEN_MAX_ENCODED_PAYLOAD_BYTES / SIX_SCREEN_STATE_CHUNK_BYTES,
);
const BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

export type SixScreenWorkflowResponseOperationBinding = {
  operationId: string;
  operationKind: string;
  requestFingerprint: string;
} | null;

export function sixScreenWorkflowMutationRequestBinding(
  mutation: Record<string, unknown>,
): Exclude<SixScreenWorkflowResponseOperationBinding, null> {
  const operationId = mutation.operationId;
  const operationKind = mutation.action;
  const expectedRevision = mutation.expectedRevision;
  if (typeof operationId !== "string" || typeof operationKind !== "string" ||
      !Number.isSafeInteger(expectedRevision) || Number(expectedRevision) < 0) {
    throw new Error("Six-screen mutation response binding input is invalid.");
  }
  const {
    operationId: _operationId,
    expectedRevision: _expectedRevision,
    ...semanticRequest
  } = mutation;
  // Match the registered mutation schema's only transport default so a
  // schema-valid caller that omits `retry` is bound identically to the
  // server-normalized `retry:false` request.
  if (operationKind === "advance_study_first_mechanism_job" &&
      !Object.hasOwn(semanticRequest, "retry")) {
    semanticRequest.retry = false;
  }
  return {
    operationId,
    operationKind,
    requestFingerprint: fingerprintSixScreenValue(semanticRequest),
  };
}

export type SixScreenWorkflowResponseContract = {
  schemaVersion: typeof SIX_SCREEN_WORKFLOW_RESPONSE_CONTRACT_VERSION;
  buildId: typeof SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID;
  appVersion: string;
  uiResourceUri: string;
  toolName:
    | "create_six_screen_workflow_v1"
    | "get_six_screen_workflow_v1"
    | "mutate_six_screen_workflow_v1";
  operationStage: string;
  /** Present for an operation-bound direct response; omitted for create/read. */
  operationBinding?: Exclude<SixScreenWorkflowResponseOperationBinding, null>;
  publicSchemaVersion: string;
  privateSchemaVersion: string;
  stateSchemaVersion: string;
  stateEncoding: typeof SIX_SCREEN_WORKFLOW_STATE_ENCODING;
  publicProjectionEncoding: typeof SIX_SCREEN_WORKFLOW_STATE_ENCODING;
  runId: string;
  revision: number;
  stateFingerprint: string;
  publicProjectionFingerprint: string;
  encodedPublicProjectionPayload: string;
  encodedPublicProjectionBytes: number;
  canonicalPublicProjectionBytes: number;
  statePayloadMode: "inline" | "chunked";
  encodedStatePayload: string;
  encodedStateBytes: number;
  canonicalStateBytes: number;
  stateChunkBytes: number;
  stateChunkCount: number;
  stateTransferId: string;
  responseFingerprint: string;
};

export type SixScreenWorkflowResponseContractBody = Omit<
  SixScreenWorkflowResponseContract,
  "responseFingerprint"
>;

export function sixScreenWorkflowStateTransferId(input: {
  runId: string;
  revision: number;
  stateFingerprint: string;
  encodedStateBytes: number;
  canonicalStateBytes: number;
}) {
  return fingerprintSixScreenValue({
    schemaVersion: SIX_SCREEN_WORKFLOW_STATE_CHUNK_SCHEMA_VERSION,
    buildId: SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID,
    ...input,
  });
}

export function sixScreenWorkflowStateChunks(encodedPayload: string) {
  const chunks: string[] = [];
  for (let offset = 0; offset < encodedPayload.length;
    offset += SIX_SCREEN_STATE_CHUNK_BYTES) {
    chunks.push(encodedPayload.slice(offset,
      offset + SIX_SCREEN_STATE_CHUNK_BYTES));
  }
  if (!chunks.length || chunks.length > SIX_SCREEN_MAX_STATE_CHUNKS) {
    throw new Error("Six-screen state transfer exceeds its chunk bound.");
  }
  return chunks;
}

function utf8Bytes(value: string) {
  return encoder.encode(value).byteLength;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 32 * 1024;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value: string) {
  if (!BASE64_PATTERN.test(value)) {
    throw new Error("Six-screen workflow payload is not valid base64.");
  }
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function encodeSixScreenWorkflowPayload(canonicalPayload: string) {
  const canonicalBytes = utf8Bytes(canonicalPayload);
  if (canonicalBytes < 2 ||
      canonicalBytes > SIX_SCREEN_MAX_CANONICAL_PAYLOAD_BYTES) {
    throw new Error("Six-screen canonical workflow payload exceeds its bound.");
  }
  const encodedPayload = bytesToBase64(gzipSync(
    encoder.encode(canonicalPayload),
    { level: 6, mtime: 0 },
  ));
  const encodedBytes = utf8Bytes(encodedPayload);
  if (encodedBytes < 4 ||
      encodedBytes > SIX_SCREEN_MAX_ENCODED_PAYLOAD_BYTES) {
    throw new Error("Six-screen encoded workflow payload exceeds its bound.");
  }
  return { encodedPayload, encodedBytes, canonicalBytes };
}

export function decodeSixScreenWorkflowPayload(input: {
  encodedPayload: string;
  encodedBytes: number;
  canonicalBytes: number;
}) {
  if (
    !Number.isSafeInteger(input.encodedBytes) || input.encodedBytes < 4 ||
    input.encodedBytes > SIX_SCREEN_MAX_ENCODED_PAYLOAD_BYTES ||
    !Number.isSafeInteger(input.canonicalBytes) || input.canonicalBytes < 2 ||
    input.canonicalBytes > SIX_SCREEN_MAX_CANONICAL_PAYLOAD_BYTES ||
    utf8Bytes(input.encodedPayload) !== input.encodedBytes
  ) {
    throw new Error("Six-screen encoded workflow payload has invalid bounds.");
  }
  const canonicalPayload = decoder.decode(gunzipSync(
    base64ToBytes(input.encodedPayload),
  ));
  if (utf8Bytes(canonicalPayload) !== input.canonicalBytes) {
    throw new Error("Six-screen workflow payload length did not reconcile.");
  }
  return canonicalPayload;
}

export function sixScreenWorkflowResponseContractBody(
  contract: SixScreenWorkflowResponseContract,
): SixScreenWorkflowResponseContractBody {
  const { responseFingerprint: _responseFingerprint, ...body } = contract;
  return body;
}

export function createSixScreenWorkflowResponseContract(input: {
  appVersion: string;
  uiResourceUri: string;
  toolName: SixScreenWorkflowResponseContract["toolName"];
  operationStage: string;
  operationBinding?: SixScreenWorkflowResponseOperationBinding;
  publicProjection: unknown;
  privateSnapshot: {
    schemaVersion: string;
    runId: string;
    revision: number;
    stateFingerprint: string;
    state: unknown;
  };
}) {
  const operationStage = input.operationStage.trim();
  if (!operationStage || operationStage.length > 120) {
    throw new Error("Six-screen response operation stage is invalid.");
  }
  const operationBinding = input.operationBinding ?? null;
  if (operationBinding !== null && (
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u.test(
      operationBinding.operationId,
    ) ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u.test(
      operationBinding.operationKind,
    ) ||
    !/^fnv1a64:[0-9a-f]{16}$/u.test(operationBinding.requestFingerprint)
  )) {
    throw new Error("Six-screen response operation binding is invalid.");
  }
  const state = input.privateSnapshot.state;
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("Six-screen response state is not a canonical object.");
  }
  const stateRecord = state as Record<string, unknown>;
  const projection = input.publicProjection;
  if (!projection || typeof projection !== "object" || Array.isArray(projection)) {
    throw new Error("Six-screen response projection is not a canonical object.");
  }
  const projectionRecord = projection as Record<string, unknown>;
  // MCP App hosts may omit null-valued members from object projections. Keep
  // an immutable public representation beside structuredContent so frontend
  // integrity never depends on that compatibility transform.
  const canonicalPublicProjectionPayload = serializeSixScreenValue(projection);
  const materializedPublicProjection = JSON.parse(
    canonicalPublicProjectionPayload,
  ) as unknown;
  const canonicalStatePayload = serializeSixScreenValue(state);
  const materializedState = JSON.parse(canonicalStatePayload) as unknown;
  const materializedStateFingerprint = fingerprintSixScreenValue(
    materializedState,
  );
  if (
    stateRecord.runId !== input.privateSnapshot.runId ||
    stateRecord.revision !== input.privateSnapshot.revision ||
    projectionRecord.runId !== input.privateSnapshot.runId ||
    projectionRecord.revision !== input.privateSnapshot.revision ||
    materializedStateFingerprint !== input.privateSnapshot.stateFingerprint
  ) {
    throw new Error(
      "Six-screen response construction rejected inconsistent state or public coordinates.",
    );
  }
  const encodedPublicProjection = encodeSixScreenWorkflowPayload(
    canonicalPublicProjectionPayload,
  );
  const encodedState = encodeSixScreenWorkflowPayload(canonicalStatePayload);
  const statePayloadMode = encodedState.encodedBytes <=
      SIX_SCREEN_INLINE_STATE_PAYLOAD_BYTES
    ? "inline" as const : "chunked" as const;
  const stateChunkCount = statePayloadMode === "inline"
    ? 0 : Math.ceil(encodedState.encodedBytes / SIX_SCREEN_STATE_CHUNK_BYTES);
  const stateTransferId = sixScreenWorkflowStateTransferId({
    runId: input.privateSnapshot.runId,
    revision: input.privateSnapshot.revision,
    stateFingerprint: materializedStateFingerprint,
    encodedStateBytes: encodedState.encodedBytes,
    canonicalStateBytes: encodedState.canonicalBytes,
  });
  const body: SixScreenWorkflowResponseContractBody = {
    schemaVersion: SIX_SCREEN_WORKFLOW_RESPONSE_CONTRACT_VERSION,
    buildId: SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID,
    appVersion: input.appVersion,
    uiResourceUri: input.uiResourceUri,
    toolName: input.toolName,
    operationStage,
    ...(operationBinding
      ? { operationBinding: structuredClone(operationBinding) }
      : {}),
    publicSchemaVersion: String(projectionRecord.schemaVersion ?? ""),
    privateSchemaVersion: input.privateSnapshot.schemaVersion,
    stateSchemaVersion: String(stateRecord.schemaVersion ?? ""),
    stateEncoding: SIX_SCREEN_WORKFLOW_STATE_ENCODING,
    publicProjectionEncoding: SIX_SCREEN_WORKFLOW_STATE_ENCODING,
    runId: input.privateSnapshot.runId,
    revision: input.privateSnapshot.revision,
    stateFingerprint: materializedStateFingerprint,
    publicProjectionFingerprint: fingerprintSixScreenValue(
      materializedPublicProjection,
    ),
    encodedPublicProjectionPayload:
      encodedPublicProjection.encodedPayload,
    encodedPublicProjectionBytes: encodedPublicProjection.encodedBytes,
    canonicalPublicProjectionBytes:
      encodedPublicProjection.canonicalBytes,
    statePayloadMode,
    // Large state never rides inside the mutation response. The authenticated
    // app reads exact chunks bound to the committed revision and fingerprint.
    encodedStatePayload: statePayloadMode === "inline"
      ? encodedState.encodedPayload : "",
    encodedStateBytes: encodedState.encodedBytes,
    canonicalStateBytes: encodedState.canonicalBytes,
    stateChunkBytes: SIX_SCREEN_STATE_CHUNK_BYTES,
    stateChunkCount,
    stateTransferId,
  };
  return {
    ...body,
    responseFingerprint: fingerprintSixScreenValue(body),
  } satisfies SixScreenWorkflowResponseContract;
}
