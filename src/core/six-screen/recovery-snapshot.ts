import {
  fingerprintSixScreenValue,
  serializeSixScreenValue,
} from "./canonical";
import {
  SIX_SCREEN_MAX_CANONICAL_PAYLOAD_BYTES,
  SIX_SCREEN_MAX_ENCODED_PAYLOAD_BYTES,
  SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID,
} from
  "./workflow-response-contract";

export const SIX_SCREEN_RECOVERY_SNAPSHOT_SCHEMA_VERSION =
  "shockaudit-six-screen-recovery-snapshot-v1" as const;
export const SIX_SCREEN_RECOVERY_SNAPSHOT_TOOL =
  "get_six_screen_recovery_snapshot_v1" as const;
export const SIX_SCREEN_RECOVERY_SNAPSHOT_ENCODING =
  "canonical-json-gzip-base64-v1" as const;

const FINGERPRINT_PATTERN = /^fnv1a64:[0-9a-f]{16}$/u;
const RUN_ID_PATTERN = /^sa6r_[A-Za-z0-9_-]{43}$/u;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const encoder = new TextEncoder();

export type SixScreenRecoverySnapshot = {
  schemaVersion: typeof SIX_SCREEN_RECOVERY_SNAPSHOT_SCHEMA_VERSION;
  buildId: typeof SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID;
  appVersion: string;
  uiResourceUri: string;
  toolName: typeof SIX_SCREEN_RECOVERY_SNAPSHOT_TOOL;
  encoding: typeof SIX_SCREEN_RECOVERY_SNAPSHOT_ENCODING;
  runId: string;
  revision: number;
  stateFingerprint: string;
  publicProjectionFingerprint: string;
  canonicalStateBytes: number;
  canonicalPublicProjectionBytes: number;
  encodedStateBytes: number;
  encodedPublicProjectionBytes: number;
  encodedStatePayload: string;
  encodedPublicProjectionPayload: string;
  responseFingerprint: string;
};

export type RestoredSixScreenRecoverySnapshot = {
  envelope: SixScreenRecoverySnapshot;
  state: Record<string, unknown>;
  publicProjection: Record<string, unknown>;
};

const SNAPSHOT_KEYS = [
  "schemaVersion", "buildId", "appVersion", "uiResourceUri", "toolName",
  "encoding", "runId", "revision", "stateFingerprint",
  "publicProjectionFingerprint", "canonicalStateBytes",
  "canonicalPublicProjectionBytes", "encodedStateBytes",
  "encodedPublicProjectionBytes", "encodedStatePayload",
  "encodedPublicProjectionPayload", "responseFingerprint",
] as const;

function exactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  return JSON.stringify(Object.keys(value).sort()) ===
    JSON.stringify([...expected].sort());
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function validByteCount(value: unknown, maximum: number) {
  return Number.isSafeInteger(value) && Number(value) >= 0 &&
    Number(value) <= maximum;
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
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function encodeCanonicalPayload(value: string) {
  const compressed = new Blob([value]).stream().pipeThrough(
    new CompressionStream("gzip"),
  );
  const bytes = new Uint8Array(await new Response(compressed).arrayBuffer());
  return bytesToBase64(bytes);
}

async function decodeCanonicalPayload(value: string) {
  const bytes = base64ToBytes(value);
  const decompressed = new Blob([bytes]).stream().pipeThrough(
    new DecompressionStream("gzip"),
  );
  return new Response(decompressed).text();
}

function responseBody(snapshot: SixScreenRecoverySnapshot) {
  const { responseFingerprint: _responseFingerprint, ...body } = snapshot;
  return body;
}

export async function createSixScreenRecoverySnapshot(input: {
  appVersion: string;
  uiResourceUri: string;
  state: unknown;
  publicProjection: unknown;
}) {
  const state = record(input.state);
  const publicProjection = record(input.publicProjection);
  if (!state || !publicProjection) {
    throw new Error("Recovery snapshot values must be canonical objects.");
  }
  const runId = state.runId;
  const revision = state.revision;
  if (typeof runId !== "string" || !RUN_ID_PATTERN.test(runId) ||
      !Number.isSafeInteger(revision) || Number(revision) < 0 ||
      publicProjection.runId !== runId ||
      publicProjection.revision !== revision) {
    throw new Error("Recovery snapshot coordinates are inconsistent.");
  }
  const canonicalState = serializeSixScreenValue(state);
  const canonicalPublicProjection = serializeSixScreenValue(publicProjection);
  const canonicalStateBytes = encoder.encode(canonicalState).byteLength;
  const canonicalPublicProjectionBytes = encoder.encode(
    canonicalPublicProjection,
  ).byteLength;
  if (canonicalStateBytes > SIX_SCREEN_MAX_CANONICAL_PAYLOAD_BYTES ||
      canonicalPublicProjectionBytes >
        SIX_SCREEN_MAX_CANONICAL_PAYLOAD_BYTES) {
    throw new Error("Recovery snapshot canonical payload exceeds its bound.");
  }
  const [encodedStatePayload, encodedPublicProjectionPayload] =
    await Promise.all([
      encodeCanonicalPayload(canonicalState),
      encodeCanonicalPayload(canonicalPublicProjection),
    ]);
  const encodedStateBytes = encoder.encode(encodedStatePayload).byteLength;
  const encodedPublicProjectionBytes = encoder.encode(
    encodedPublicProjectionPayload,
  ).byteLength;
  if (encodedStateBytes > SIX_SCREEN_MAX_ENCODED_PAYLOAD_BYTES ||
      encodedPublicProjectionBytes > SIX_SCREEN_MAX_ENCODED_PAYLOAD_BYTES) {
    throw new Error("Recovery snapshot encoded payload exceeds its bound.");
  }
  const body = {
    schemaVersion: SIX_SCREEN_RECOVERY_SNAPSHOT_SCHEMA_VERSION,
    buildId: SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID,
    appVersion: input.appVersion,
    uiResourceUri: input.uiResourceUri,
    toolName: SIX_SCREEN_RECOVERY_SNAPSHOT_TOOL,
    encoding: SIX_SCREEN_RECOVERY_SNAPSHOT_ENCODING,
    runId,
    revision: Number(revision),
    stateFingerprint: fingerprintSixScreenValue(state),
    publicProjectionFingerprint: fingerprintSixScreenValue(publicProjection),
    canonicalStateBytes,
    canonicalPublicProjectionBytes,
    encodedStateBytes,
    encodedPublicProjectionBytes,
    encodedStatePayload,
    encodedPublicProjectionPayload,
  } as const;
  return {
    ...body,
    responseFingerprint: fingerprintSixScreenValue(body),
  } satisfies SixScreenRecoverySnapshot;
}

export async function restoreSixScreenRecoverySnapshot(input: {
  value: unknown;
  expectedRunId: string;
  expectedAppVersion: string;
  expectedUiResourceUri: string;
}): Promise<RestoredSixScreenRecoverySnapshot> {
  const value = record(input.value);
  const invalid = () => {
    throw new Error("The recovery snapshot used an invalid contract.");
  };
  if (!value || !exactKeys(value, SNAPSHOT_KEYS)) return invalid();
  const snapshot = value as unknown as SixScreenRecoverySnapshot;
  if (
    snapshot.schemaVersion !== SIX_SCREEN_RECOVERY_SNAPSHOT_SCHEMA_VERSION ||
    snapshot.buildId !== SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID ||
    snapshot.appVersion !== input.expectedAppVersion ||
    snapshot.uiResourceUri !== input.expectedUiResourceUri ||
    snapshot.toolName !== SIX_SCREEN_RECOVERY_SNAPSHOT_TOOL ||
    snapshot.encoding !== SIX_SCREEN_RECOVERY_SNAPSHOT_ENCODING ||
    snapshot.runId !== input.expectedRunId ||
    !RUN_ID_PATTERN.test(snapshot.runId) ||
    !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0 ||
    !FINGERPRINT_PATTERN.test(snapshot.stateFingerprint) ||
    !FINGERPRINT_PATTERN.test(snapshot.publicProjectionFingerprint) ||
    !validByteCount(snapshot.canonicalStateBytes,
      SIX_SCREEN_MAX_CANONICAL_PAYLOAD_BYTES) ||
    !validByteCount(snapshot.canonicalPublicProjectionBytes,
      SIX_SCREEN_MAX_CANONICAL_PAYLOAD_BYTES) ||
    !validByteCount(snapshot.encodedStateBytes,
      SIX_SCREEN_MAX_ENCODED_PAYLOAD_BYTES) ||
    !validByteCount(snapshot.encodedPublicProjectionBytes,
      SIX_SCREEN_MAX_ENCODED_PAYLOAD_BYTES) ||
    typeof snapshot.encodedStatePayload !== "string" ||
    typeof snapshot.encodedPublicProjectionPayload !== "string" ||
    !BASE64_PATTERN.test(snapshot.encodedStatePayload) ||
    !BASE64_PATTERN.test(snapshot.encodedPublicProjectionPayload) ||
    encoder.encode(snapshot.encodedStatePayload).byteLength !==
      snapshot.encodedStateBytes ||
    encoder.encode(snapshot.encodedPublicProjectionPayload).byteLength !==
      snapshot.encodedPublicProjectionBytes ||
    snapshot.responseFingerprint !==
      fingerprintSixScreenValue(responseBody(snapshot))
  ) return invalid();

  let canonicalState: string;
  let canonicalPublicProjection: string;
  try {
    [canonicalState, canonicalPublicProjection] = await Promise.all([
      decodeCanonicalPayload(snapshot.encodedStatePayload),
      decodeCanonicalPayload(snapshot.encodedPublicProjectionPayload),
    ]);
  } catch {
    return invalid();
  }
  if (encoder.encode(canonicalState).byteLength !==
      snapshot.canonicalStateBytes ||
      encoder.encode(canonicalPublicProjection).byteLength !==
        snapshot.canonicalPublicProjectionBytes) return invalid();

  let state: unknown;
  let publicProjection: unknown;
  try {
    state = JSON.parse(canonicalState);
    publicProjection = JSON.parse(canonicalPublicProjection);
  } catch {
    return invalid();
  }
  const stateRecord = record(state);
  const projectionRecord = record(publicProjection);
  if (!stateRecord || !projectionRecord ||
      serializeSixScreenValue(stateRecord) !== canonicalState ||
      serializeSixScreenValue(projectionRecord) !== canonicalPublicProjection ||
      stateRecord.runId !== snapshot.runId ||
      stateRecord.revision !== snapshot.revision ||
      projectionRecord.runId !== snapshot.runId ||
      projectionRecord.revision !== snapshot.revision ||
      fingerprintSixScreenValue(stateRecord) !== snapshot.stateFingerprint ||
      fingerprintSixScreenValue(projectionRecord) !==
        snapshot.publicProjectionFingerprint) return invalid();
  return {
    envelope: structuredClone(snapshot),
    state: stateRecord,
    publicProjection: projectionRecord,
  };
}
