import { Gunzip } from "fflate";

import { serializeDeterministicJson } from "./screen02-deterministic-json";
import {
  SCREEN_02_MAX_CANONICAL_SESSION_BYTES,
  SCREEN_02_MAX_COMPRESSED_STATE_BYTES,
  SCREEN_02_MAX_STATE_PAYLOAD_CHARACTERS,
  compressScreen02CanonicalState,
} from "./screen02-state-capacity";
import {
  restoreScreen02FindState,
  serializeScreen02WorkflowState,
} from "./screen02-workflow-state";
import {
  SCREEN_02_FIND_STATE_KIND,
  SCREEN_02_WORKFLOW_SCHEMA_VERSION,
  type Screen02FindState,
} from "./screen02-workflow-types";

export const SCREEN_02_WORKFLOW_STATE_ENVELOPE_SCHEMA_VERSION =
  "screen-02-workflow-state-envelope-v1" as const;
export const SCREEN_02_WORKFLOW_STATE_ENVELOPE_ENCODING =
  "gzip-base64url" as const;

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const CHECKSUM_PATTERN = /^fnv1a64:[0-9a-f]{16}$/;
const GUNZIP_INPUT_CHUNK_BYTES = 1_024;
const envelopeKeys = [
  "schemaVersion",
  "workflowSchemaVersion",
  "stateKind",
  "encoding",
  "uncompressedBytes",
  "compressedBytes",
  "checksum",
  "payload",
] as const;

/**
 * Bounded component-transport capsule for writable v2.1 Find state. The FNV
 * checksum detects accidental corruption only; callers must not treat this
 * envelope as an authenticated capability or receipt.
 */
export type Screen02FindWorkflowStateEnvelope = {
  schemaVersion: typeof SCREEN_02_WORKFLOW_STATE_ENVELOPE_SCHEMA_VERSION;
  workflowSchemaVersion: typeof SCREEN_02_WORKFLOW_SCHEMA_VERSION;
  stateKind: typeof SCREEN_02_FIND_STATE_KIND;
  encoding: typeof SCREEN_02_WORKFLOW_STATE_ENVELOPE_ENCODING;
  uncompressedBytes: number;
  compressedBytes: number;
  checksum: string;
  payload: string;
};

export type Screen02FindWorkflowEnvelopeDecodeCode =
  | "envelope-absent"
  | "envelope-shape"
  | "envelope-schema"
  | "envelope-state-kind"
  | "envelope-encoding"
  | "envelope-size"
  | "envelope-base64"
  | "envelope-gzip"
  | "envelope-utf8"
  | "envelope-json"
  | "envelope-noncanonical"
  | "envelope-checksum"
  | "envelope-state";

export type Screen02FindWorkflowEnvelopeDecodeResult =
  | {
      ok: true;
      state: Screen02FindState;
      envelope: Screen02FindWorkflowStateEnvelope;
    }
  | {
      ok: false;
      code: Screen02FindWorkflowEnvelopeDecodeCode;
      message: string;
    };

class FindWorkflowEnvelopeDecodeError extends Error {
  constructor(
    readonly code: Screen02FindWorkflowEnvelopeDecodeCode,
    message: string,
  ) {
    super(message);
    this.name = "FindWorkflowEnvelopeDecodeError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checksumCanonicalJson(canonicalJson: string) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of new TextEncoder().encode(canonicalJson)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function base64UrlToBytes(payload: string) {
  if (
    payload.length === 0 ||
    payload.length > SCREEN_02_MAX_STATE_PAYLOAD_CHARACTERS ||
    !BASE64URL_PATTERN.test(payload) ||
    payload.length % 4 === 1
  ) {
    throw new FindWorkflowEnvelopeDecodeError(
      "envelope-base64",
      "Screen 2 Find state payload is not canonical bounded base64url.",
    );
  }
  const padded = `${payload.replaceAll("-", "+").replaceAll("_", "/")}${"=".repeat(
    (4 - (payload.length % 4)) % 4,
  )}`;
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new FindWorkflowEnvelopeDecodeError(
      "envelope-base64",
      "Screen 2 Find state payload could not be decoded as base64url.",
    );
  }
  const bytes = Uint8Array.from(binary, (character) =>
    character.charCodeAt(0),
  );
  if (bytesToBase64Url(bytes) !== payload) {
    throw new FindWorkflowEnvelopeDecodeError(
      "envelope-base64",
      "Screen 2 Find state payload has a noncanonical base64url representation.",
    );
  }
  return bytes;
}

function gzipDeclaredSize(bytes: Uint8Array) {
  if (
    bytes.length < 18 ||
    bytes[0] !== 0x1f ||
    bytes[1] !== 0x8b ||
    bytes[2] !== 0x08
  ) {
    throw new FindWorkflowEnvelopeDecodeError(
      "envelope-gzip",
      "Screen 2 Find state payload is not a complete gzip stream.",
    );
  }
  const offset = bytes.length - 4;
  return (
    (bytes[offset] ?? 0) |
    ((bytes[offset + 1] ?? 0) << 8) |
    ((bytes[offset + 2] ?? 0) << 16) |
    ((bytes[offset + 3] ?? 0) << 24)
  ) >>> 0;
}

function concatenateChunks(chunks: Uint8Array[], total: number) {
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function boundedGunzip(bytes: Uint8Array, declaredSize: number) {
  const chunks: Uint8Array[] = [];
  let total = 0;
  let completed = false;
  const gunzip = new Gunzip((chunk, final) => {
    total += chunk.byteLength;
    if (
      total > declaredSize ||
      total > SCREEN_02_MAX_CANONICAL_SESSION_BYTES
    ) {
      throw new FindWorkflowEnvelopeDecodeError(
        "envelope-size",
        "Screen 2 Find state expanded beyond its declared or permitted size.",
      );
    }
    if (chunk.byteLength > 0) chunks.push(chunk.slice());
    if (final) completed = true;
  });
  try {
    for (
      let offset = 0;
      offset < bytes.length;
      offset += GUNZIP_INPUT_CHUNK_BYTES
    ) {
      const end = Math.min(offset + GUNZIP_INPUT_CHUNK_BYTES, bytes.length);
      gunzip.push(bytes.subarray(offset, end), end === bytes.length);
    }
  } catch (error) {
    if (error instanceof FindWorkflowEnvelopeDecodeError) throw error;
    throw new FindWorkflowEnvelopeDecodeError(
      "envelope-gzip",
      "Screen 2 Find state gzip stream is corrupt or incomplete.",
    );
  }
  if (!completed || total !== declaredSize) {
    throw new FindWorkflowEnvelopeDecodeError(
      "envelope-size",
      "Screen 2 Find state did not expand to its declared byte length.",
    );
  }
  return concatenateChunks(chunks, total);
}

function parseEnvelope(value: unknown): Screen02FindWorkflowStateEnvelope {
  if (!isRecord(value)) {
    throw new FindWorkflowEnvelopeDecodeError(
      "envelope-absent",
      "Screen 2 Find state envelope is absent.",
    );
  }
  const keys = Object.keys(value);
  if (
    keys.length !== envelopeKeys.length ||
    keys.some((key) => !(envelopeKeys as readonly string[]).includes(key))
  ) {
    throw new FindWorkflowEnvelopeDecodeError(
      "envelope-shape",
      "Screen 2 Find state envelope contains missing or unrecognized fields.",
    );
  }
  if (
    value.schemaVersion !== SCREEN_02_WORKFLOW_STATE_ENVELOPE_SCHEMA_VERSION ||
    value.workflowSchemaVersion !== SCREEN_02_WORKFLOW_SCHEMA_VERSION
  ) {
    throw new FindWorkflowEnvelopeDecodeError(
      "envelope-schema",
      "Screen 2 Find state envelope uses an unsupported schema version.",
    );
  }
  if (value.stateKind !== SCREEN_02_FIND_STATE_KIND) {
    throw new FindWorkflowEnvelopeDecodeError(
      "envelope-state-kind",
      "Screen 2 workflow envelope is not writable Find state.",
    );
  }
  if (value.encoding !== SCREEN_02_WORKFLOW_STATE_ENVELOPE_ENCODING) {
    throw new FindWorkflowEnvelopeDecodeError(
      "envelope-encoding",
      "Screen 2 Find state envelope uses an unsupported encoding.",
    );
  }
  if (
    !Number.isSafeInteger(value.uncompressedBytes) ||
    (value.uncompressedBytes as number) < 1 ||
    (value.uncompressedBytes as number) >
      SCREEN_02_MAX_CANONICAL_SESSION_BYTES ||
    !Number.isSafeInteger(value.compressedBytes) ||
    (value.compressedBytes as number) < 1 ||
    (value.compressedBytes as number) > SCREEN_02_MAX_COMPRESSED_STATE_BYTES
  ) {
    throw new FindWorkflowEnvelopeDecodeError(
      "envelope-size",
      "Screen 2 Find state envelope declares an invalid byte length.",
    );
  }
  if (
    typeof value.checksum !== "string" ||
    !CHECKSUM_PATTERN.test(value.checksum)
  ) {
    throw new FindWorkflowEnvelopeDecodeError(
      "envelope-checksum",
      "Screen 2 Find state envelope has an invalid checksum.",
    );
  }
  if (typeof value.payload !== "string") {
    throw new FindWorkflowEnvelopeDecodeError(
      "envelope-base64",
      "Screen 2 Find state envelope payload must be text.",
    );
  }
  if (value.payload.length > SCREEN_02_MAX_STATE_PAYLOAD_CHARACTERS) {
    throw new FindWorkflowEnvelopeDecodeError(
      "envelope-size",
      "Screen 2 Find state envelope exceeds the encoded transport limit.",
    );
  }
  return value as Screen02FindWorkflowStateEnvelope;
}

export function encodeScreen02FindWorkflowStateEnvelope(
  state: Screen02FindState,
): Screen02FindWorkflowStateEnvelope {
  const canonicalJson = serializeScreen02WorkflowState(state);
  const { raw, compressed } = compressScreen02CanonicalState(canonicalJson);
  const payload = bytesToBase64Url(compressed);
  if (payload.length > SCREEN_02_MAX_STATE_PAYLOAD_CHARACTERS) {
    throw new Error(
      `Screen 2 Find encoded state exceeds the ${SCREEN_02_MAX_STATE_PAYLOAD_CHARACTERS}-character transport limit.`,
    );
  }
  return {
    schemaVersion: SCREEN_02_WORKFLOW_STATE_ENVELOPE_SCHEMA_VERSION,
    workflowSchemaVersion: SCREEN_02_WORKFLOW_SCHEMA_VERSION,
    stateKind: SCREEN_02_FIND_STATE_KIND,
    encoding: SCREEN_02_WORKFLOW_STATE_ENVELOPE_ENCODING,
    uncompressedBytes: raw.byteLength,
    compressedBytes: compressed.byteLength,
    checksum: checksumCanonicalJson(canonicalJson),
    payload,
  };
}

export function decodeScreen02FindWorkflowStateEnvelope(
  value: unknown,
): Screen02FindWorkflowEnvelopeDecodeResult {
  try {
    const envelope = parseEnvelope(value);
    const compressed = base64UrlToBytes(envelope.payload);
    if (compressed.byteLength !== envelope.compressedBytes) {
      throw new FindWorkflowEnvelopeDecodeError(
        "envelope-size",
        "Screen 2 Find compressed length does not match its envelope.",
      );
    }
    if (gzipDeclaredSize(compressed) !== envelope.uncompressedBytes) {
      throw new FindWorkflowEnvelopeDecodeError(
        "envelope-size",
        "Screen 2 Find gzip length does not match its envelope.",
      );
    }
    const raw = boundedGunzip(compressed, envelope.uncompressedBytes);
    let canonicalJson: string;
    try {
      canonicalJson = new TextDecoder("utf-8", { fatal: true }).decode(raw);
    } catch {
      throw new FindWorkflowEnvelopeDecodeError(
        "envelope-utf8",
        "Screen 2 Find state is not valid UTF-8.",
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(canonicalJson) as unknown;
    } catch {
      throw new FindWorkflowEnvelopeDecodeError(
        "envelope-json",
        "Screen 2 Find state is not valid JSON.",
      );
    }
    let recanonicalized: string;
    try {
      recanonicalized = serializeDeterministicJson(parsed);
    } catch {
      throw new FindWorkflowEnvelopeDecodeError(
        "envelope-noncanonical",
        "Screen 2 Find state contains unsupported JSON values.",
      );
    }
    if (recanonicalized !== canonicalJson) {
      throw new FindWorkflowEnvelopeDecodeError(
        "envelope-noncanonical",
        "Screen 2 Find state JSON is not canonical.",
      );
    }
    if (checksumCanonicalJson(canonicalJson) !== envelope.checksum) {
      throw new FindWorkflowEnvelopeDecodeError(
        "envelope-checksum",
        "Screen 2 Find state checksum does not match its canonical JSON.",
      );
    }
    const state = restoreScreen02FindState(parsed);
    if (!state) {
      throw new FindWorkflowEnvelopeDecodeError(
        "envelope-state",
        "Screen 2 Find state failed its writable v2.1 integrity contract.",
      );
    }
    return { ok: true, state, envelope };
  } catch (error) {
    if (error instanceof FindWorkflowEnvelopeDecodeError) {
      return { ok: false, code: error.code, message: error.message };
    }
    return {
      ok: false,
      code: "envelope-shape",
      message: "Screen 2 Find state envelope could not be read.",
    };
  }
}

export function restoreScreen02FindWorkflowStateEnvelope(
  value: unknown,
): Screen02FindState | null {
  const decoded = decodeScreen02FindWorkflowStateEnvelope(value);
  return decoded.ok ? decoded.state : null;
}

export function screen02FindWorkflowEnvelopeIdentity(
  envelope: Screen02FindWorkflowStateEnvelope,
) {
  return [
    envelope.schemaVersion,
    envelope.workflowSchemaVersion,
    envelope.stateKind,
    envelope.uncompressedBytes,
    envelope.checksum,
  ].join(":");
}
