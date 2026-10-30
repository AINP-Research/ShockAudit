import { Gunzip, gzipSync } from "fflate";

import { serializeDeterministicJson } from
  "../core/screen02-deterministic-json";
import { fingerprintScreen02WorkflowValue } from
  "../core/screen02-workflow-state";
import type {
  Screen02CanonicalFindContinuation,
  Screen02CanonicalFindDiscovery,
  Screen02CanonicalFindStepResult,
} from "./server";
import { SCREEN_02_FIND_CONTINUATION_MAX_CHECKPOINT_BYTES } from
  "./screen02-find-continuation-store";

const LEGACY_CHECKPOINT_SCHEMA_VERSION =
  "screen-02-find-store-checkpoint-v1" as const;
export const SCREEN_02_FIND_STORE_CHECKPOINT_SCHEMA_VERSION =
  "screen-02-find-store-checkpoint-v2" as const;
const SCREEN_02_FIND_STORE_CHECKPOINT_PAYLOAD_SCHEMA_VERSION =
  "screen-02-find-store-checkpoint-payload-v1" as const;
const SCREEN_02_FIND_STORE_CHECKPOINT_ENCODING = "gzip-base64url" as const;
export const SCREEN_02_FIND_STORE_CHECKPOINT_MAX_UNCOMPRESSED_BYTES =
  8 * 1024 * 1024;

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const FINGERPRINT_PATTERN = /^fnv1a64:[0-9a-f]{16}$/;
const GUNZIP_INPUT_CHUNK_BYTES = 1_024;
const ENVELOPE_KEYS = [
  "schemaVersion",
  "encoding",
  "uncompressedBytes",
  "compressedBytes",
  "checksum",
  "payload",
] as const;

export type Screen02FindStoredStep =
  | {
      status: "pending";
      continuation: Screen02CanonicalFindContinuation;
    }
  | {
      status: "complete";
      discovery: Screen02CanonicalFindDiscovery;
    };

type Screen02FindStoreCheckpointPayload =
  | {
      schemaVersion:
        typeof SCREEN_02_FIND_STORE_CHECKPOINT_PAYLOAD_SCHEMA_VERSION;
      status: "pending";
      continuation: Screen02CanonicalFindContinuation;
    }
  | {
      schemaVersion:
        typeof SCREEN_02_FIND_STORE_CHECKPOINT_PAYLOAD_SCHEMA_VERSION;
      status: "complete";
      discovery: Screen02CanonicalFindDiscovery;
    };

export type Screen02FindStoreCheckpoint = {
  schemaVersion: typeof SCREEN_02_FIND_STORE_CHECKPOINT_SCHEMA_VERSION;
  encoding: typeof SCREEN_02_FIND_STORE_CHECKPOINT_ENCODING;
  uncompressedBytes: number;
  compressedBytes: number;
  checksum: string;
  payload: string;
};

export class Screen02FindStoreCheckpointError extends Error {
  constructor(
    readonly code: "checkpoint-capacity" | "checkpoint-invalid",
    message: string,
    readonly checkpointBytes: number | null = null,
    readonly uncompressedBytes: number | null = null,
  ) {
    super(message);
    this.name = "Screen02FindStoreCheckpointError";
  }
}

function checkpointError(
  code: Screen02FindStoreCheckpointError["code"],
  message: string,
  checkpointBytes: number | null = null,
  uncompressedBytes: number | null = null,
): never {
  throw new Screen02FindStoreCheckpointError(
    code,
    message,
    checkpointBytes,
    uncompressedBytes,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
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

function base64UrlToBytes(value: string) {
  if (
    value.length === 0 ||
    value.length > SCREEN_02_FIND_CONTINUATION_MAX_CHECKPOINT_BYTES ||
    !BASE64URL_PATTERN.test(value) ||
    value.length % 4 === 1
  ) {
    checkpointError(
      "checkpoint-invalid",
      "The server-owned Find checkpoint payload is not canonical bounded base64url.",
    );
  }
  const padded = `${value.replaceAll("-", "+").replaceAll("_", "/")}${
    "=".repeat((4 - value.length % 4) % 4)
  }`;
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    checkpointError(
      "checkpoint-invalid",
      "The server-owned Find checkpoint payload is not valid base64url.",
    );
  }
  const bytes = Uint8Array.from(binary, (character) =>
    character.charCodeAt(0)
  );
  if (bytesToBase64Url(bytes) !== value) {
    checkpointError(
      "checkpoint-invalid",
      "The server-owned Find checkpoint payload is not canonical base64url.",
    );
  }
  return bytes;
}

function gzipDeclaredSize(bytes: Uint8Array) {
  if (
    bytes.length < 18 || bytes[0] !== 0x1f || bytes[1] !== 0x8b ||
    bytes[2] !== 0x08
  ) {
    checkpointError(
      "checkpoint-invalid",
      "The server-owned Find checkpoint is not a complete gzip stream.",
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

function boundedGunzip(bytes: Uint8Array, declaredSize: number) {
  const chunks: Uint8Array[] = [];
  let total = 0;
  let completed = false;
  const gunzip = new Gunzip((chunk, final) => {
    total += chunk.byteLength;
    if (
      total > declaredSize ||
      total > SCREEN_02_FIND_STORE_CHECKPOINT_MAX_UNCOMPRESSED_BYTES
    ) {
      checkpointError(
        "checkpoint-invalid",
        "The server-owned Find checkpoint expanded beyond its bounded size.",
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
    if (error instanceof Screen02FindStoreCheckpointError) throw error;
    checkpointError(
      "checkpoint-invalid",
      "The server-owned Find checkpoint gzip stream is corrupt or incomplete.",
    );
  }
  if (!completed || total !== declaredSize) {
    checkpointError(
      "checkpoint-invalid",
      "The server-owned Find checkpoint did not expand to its declared size.",
    );
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function minimalPayload(
  step: Screen02CanonicalFindStepResult,
): Screen02FindStoreCheckpointPayload {
  return step.status === "pending"
    ? {
        schemaVersion:
          SCREEN_02_FIND_STORE_CHECKPOINT_PAYLOAD_SCHEMA_VERSION,
        status: "pending",
        continuation: structuredClone(step.continuation),
      }
    : {
        schemaVersion:
          SCREEN_02_FIND_STORE_CHECKPOINT_PAYLOAD_SCHEMA_VERSION,
        status: "complete",
        discovery: structuredClone(step.discovery),
      };
}

export function screen02FindStoreCheckpointBytes(value: unknown) {
  return new TextEncoder().encode(serializeDeterministicJson(value)).byteLength;
}

export function encodeScreen02FindStoreCheckpoint(
  step: Screen02CanonicalFindStepResult,
): Screen02FindStoreCheckpoint {
  const payload = minimalPayload(step);
  const canonicalJson = serializeDeterministicJson(payload);
  const raw = new TextEncoder().encode(canonicalJson);
  if (
    raw.byteLength > SCREEN_02_FIND_STORE_CHECKPOINT_MAX_UNCOMPRESSED_BYTES
  ) {
    checkpointError(
      "checkpoint-capacity",
      "The server-owned Find checkpoint exceeds its uncompressed byte limit.",
      null,
      raw.byteLength,
    );
  }
  const compressed = gzipSync(raw, { level: 6, mtime: 0 });
  const checkpoint: Screen02FindStoreCheckpoint = {
    schemaVersion: SCREEN_02_FIND_STORE_CHECKPOINT_SCHEMA_VERSION,
    encoding: SCREEN_02_FIND_STORE_CHECKPOINT_ENCODING,
    uncompressedBytes: raw.byteLength,
    compressedBytes: compressed.byteLength,
    checksum: fingerprintScreen02WorkflowValue(payload),
    payload: bytesToBase64Url(compressed),
  };
  const checkpointBytes = screen02FindStoreCheckpointBytes(checkpoint);
  if (checkpointBytes > SCREEN_02_FIND_CONTINUATION_MAX_CHECKPOINT_BYTES) {
    checkpointError(
      "checkpoint-capacity",
      "The server-owned Find checkpoint exceeds its durable byte limit.",
      checkpointBytes,
      raw.byteLength,
    );
  }
  return checkpoint;
}

function parseMinimalPayload(value: unknown): Screen02FindStoredStep {
  if (!isRecord(value)) {
    checkpointError(
      "checkpoint-invalid",
      "The server-owned Find checkpoint payload is invalid.",
    );
  }
  if (
    value.schemaVersion !==
      SCREEN_02_FIND_STORE_CHECKPOINT_PAYLOAD_SCHEMA_VERSION
  ) {
    checkpointError(
      "checkpoint-invalid",
      "The server-owned Find checkpoint payload version is unsupported.",
    );
  }
  if (
    value.status === "pending" &&
    hasExactKeys(value, ["schemaVersion", "status", "continuation"]) &&
    isRecord(value.continuation)
  ) {
    return {
      status: "pending",
      continuation: structuredClone(value.continuation) as
        Screen02CanonicalFindContinuation,
    };
  }
  if (
    value.status === "complete" &&
    hasExactKeys(value, ["schemaVersion", "status", "discovery"]) &&
    isRecord(value.discovery)
  ) {
    return {
      status: "complete",
      discovery: structuredClone(value.discovery) as
        Screen02CanonicalFindDiscovery,
    };
  }
  checkpointError(
    "checkpoint-invalid",
    "The server-owned Find checkpoint result is invalid.",
  );
}

function decodeLegacyCheckpoint(
  checkpoint: Record<string, unknown>,
): Screen02FindStoredStep {
  const step = checkpoint.step;
  if (!isRecord(step)) {
    checkpointError(
      "checkpoint-invalid",
      "The legacy server-owned Find continuation result is invalid.",
    );
  }
  if (step.status === "pending" && isRecord(step.continuation)) {
    return {
      status: "pending",
      continuation: structuredClone(step.continuation) as
        Screen02CanonicalFindContinuation,
    };
  }
  if (step.status === "complete" && isRecord(step.discovery)) {
    return {
      status: "complete",
      discovery: structuredClone(step.discovery) as
        Screen02CanonicalFindDiscovery,
    };
  }
  checkpointError(
    "checkpoint-invalid",
    "The legacy server-owned Find continuation result is invalid.",
  );
}

export function decodeScreen02FindStoreCheckpoint(
  value: unknown,
): Screen02FindStoredStep {
  if (!isRecord(value)) {
    checkpointError(
      "checkpoint-invalid",
      "The server-owned Find continuation checkpoint is invalid.",
    );
  }
  if (value.schemaVersion === LEGACY_CHECKPOINT_SCHEMA_VERSION) {
    return decodeLegacyCheckpoint(value);
  }
  if (
    value.schemaVersion !== SCREEN_02_FIND_STORE_CHECKPOINT_SCHEMA_VERSION ||
    !hasExactKeys(value, ENVELOPE_KEYS) ||
    value.encoding !== SCREEN_02_FIND_STORE_CHECKPOINT_ENCODING ||
    !Number.isSafeInteger(value.uncompressedBytes) ||
    (value.uncompressedBytes as number) < 1 ||
    (value.uncompressedBytes as number) >
      SCREEN_02_FIND_STORE_CHECKPOINT_MAX_UNCOMPRESSED_BYTES ||
    !Number.isSafeInteger(value.compressedBytes) ||
    (value.compressedBytes as number) < 1 ||
    (value.compressedBytes as number) >
      SCREEN_02_FIND_CONTINUATION_MAX_CHECKPOINT_BYTES ||
    typeof value.checksum !== "string" ||
    !FINGERPRINT_PATTERN.test(value.checksum) ||
    typeof value.payload !== "string"
  ) {
    checkpointError(
      "checkpoint-invalid",
      "The server-owned Find continuation checkpoint envelope is invalid.",
    );
  }
  if (
    screen02FindStoreCheckpointBytes(value) >
      SCREEN_02_FIND_CONTINUATION_MAX_CHECKPOINT_BYTES
  ) {
    checkpointError(
      "checkpoint-invalid",
      "The server-owned Find continuation checkpoint exceeds its byte limit.",
    );
  }
  const compressed = base64UrlToBytes(value.payload);
  if (compressed.byteLength !== value.compressedBytes) {
    checkpointError(
      "checkpoint-invalid",
      "The server-owned Find checkpoint compressed length is invalid.",
    );
  }
  if (gzipDeclaredSize(compressed) !== value.uncompressedBytes) {
    checkpointError(
      "checkpoint-invalid",
      "The server-owned Find checkpoint gzip length is invalid.",
    );
  }
  const raw = boundedGunzip(compressed, value.uncompressedBytes);
  let canonicalJson: string;
  try {
    canonicalJson = new TextDecoder("utf-8", { fatal: true }).decode(raw);
  } catch {
    checkpointError(
      "checkpoint-invalid",
      "The server-owned Find checkpoint is not valid UTF-8.",
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(canonicalJson) as unknown;
  } catch {
    checkpointError(
      "checkpoint-invalid",
      "The server-owned Find checkpoint is not valid JSON.",
    );
  }
  if (
    serializeDeterministicJson(parsed) !== canonicalJson ||
    fingerprintScreen02WorkflowValue(parsed) !== value.checksum
  ) {
    checkpointError(
      "checkpoint-invalid",
      "The server-owned Find checkpoint failed its canonical integrity check.",
    );
  }
  return parseMinimalPayload(parsed);
}
