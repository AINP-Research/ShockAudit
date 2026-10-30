import { Gunzip } from "fflate";

import {
  restoreScreen02Session,
  serializeScreen02Session,
} from "./screen02-service";
import { serializeDeterministicJson } from "./screen02-deterministic-json";
import {
  SCREEN_02_MAX_CANONICAL_SESSION_BYTES,
  SCREEN_02_MAX_COMPRESSED_STATE_BYTES,
  SCREEN_02_MAX_STATE_PAYLOAD_CHARACTERS,
  compressScreen02CanonicalState,
} from "./screen02-state-capacity";
import type {
  Screen02Item,
  Screen02PreferenceCriterion,
  Screen02RoundStage,
  Screen02SearchCoverage,
  Screen02SearchManifest,
  Screen02Session,
} from "./screen02-types";
import type { Mode, Screen01StudyContext } from "./scope-types";

export const SCREEN_02_STATE_ENVELOPE_SCHEMA_VERSION =
  "screen-02-state-envelope-v1" as const;
export const SCREEN_02_STATE_ENVELOPE_ENCODING =
  "gzip-base64url" as const;
export const SCREEN_02_REVIEW_CONTEXT_SCHEMA_VERSION =
  "screen-02-review-context-v2" as const;
export {
  SCREEN_02_MAX_COMPRESSED_STATE_BYTES,
  SCREEN_02_MAX_STATE_PAYLOAD_CHARACTERS,
} from "./screen02-state-capacity";

const GUNZIP_INPUT_CHUNK_BYTES = 1_024;
const CHECKSUM_PATTERN = /^fnv1a64:[0-9a-f]{16}$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const envelopeKeys = [
  "schemaVersion",
  "encoding",
  "uncompressedBytes",
  "compressedBytes",
  "checksum",
  "payload",
] as const;

export type Screen02StateEnvelope = {
  schemaVersion: typeof SCREEN_02_STATE_ENVELOPE_SCHEMA_VERSION;
  encoding: typeof SCREEN_02_STATE_ENVELOPE_ENCODING;
  uncompressedBytes: number;
  compressedBytes: number;
  checksum: string;
  payload: string;
};

export type Screen02StateIdentity = {
  runId: string;
  revision: number;
  checksum: string;
};

export type Screen02StateSummary = {
  runId: string;
  mode: Mode;
  revision: number;
  screen01Fingerprint: string;
  latestRoundId: string;
  stage: Screen02RoundStage;
  currentItems: Array<{ id: string; title: string }>;
  coverageStatus: Screen02SearchCoverage["status"];
  pendingRequestReconciled: boolean;
  outcomeValuesInspected: false;
  sessionLocation: "state-envelope";
};

export type Screen02ReviewContext = {
  schemaVersion: typeof SCREEN_02_REVIEW_CONTEXT_SCHEMA_VERSION;
  runId: string;
  revision: number;
  mode: Mode;
  screen01Fingerprint: string;
  screen01Baseline: Screen01StudyContext;
  rootNativeRoundId: string;
  assessmentParentRoundId: string;
  stage: "native-retrieval" | "preliminary-assessment";
  exactRequest: string;
  criteria: Screen02PreferenceCriterion[];
  targetCandidateIds: string[];
  currentCandidates: Screen02Item[];
  searchManifest: Screen02SearchManifest;
  outcomeValuesInspected: false;
};

export type Screen02StateEnvelopeDecodeCode =
  | "envelope-absent"
  | "envelope-shape"
  | "envelope-schema"
  | "envelope-encoding"
  | "envelope-size"
  | "envelope-base64"
  | "envelope-gzip"
  | "envelope-utf8"
  | "envelope-json"
  | "envelope-noncanonical"
  | "envelope-checksum"
  | "envelope-session";

export type Screen02StateEnvelopeDecodeResult =
  | {
      ok: true;
      session: Screen02Session;
      envelope: Screen02StateEnvelope;
    }
  | {
      ok: false;
      code: Screen02StateEnvelopeDecodeCode;
      message: string;
    };

class EnvelopeDecodeError extends Error {
  constructor(
    readonly code: Screen02StateEnvelopeDecodeCode,
    message: string,
  ) {
    super(message);
    this.name = "EnvelopeDecodeError";
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
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
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
    throw new EnvelopeDecodeError(
      "envelope-base64",
      "Screen 2 state payload is not canonical bounded base64url.",
    );
  }
  const padded = `${payload.replaceAll("-", "+").replaceAll("_", "/")}${"=".repeat(
    (4 - (payload.length % 4)) % 4,
  )}`;
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new EnvelopeDecodeError(
      "envelope-base64",
      "Screen 2 state payload could not be decoded as base64url.",
    );
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  if (bytesToBase64Url(bytes) !== payload) {
    throw new EnvelopeDecodeError(
      "envelope-base64",
      "Screen 2 state payload has a noncanonical base64url representation.",
    );
  }
  return bytes;
}

function gzipDeclaredSize(bytes: Uint8Array) {
  if (bytes.length < 18) {
    throw new EnvelopeDecodeError(
      "envelope-gzip",
      "Screen 2 state payload is too short to be a gzip stream.",
    );
  }
  if (
    bytes[0] !== 0x1f ||
    bytes[1] !== 0x8b ||
    bytes[2] !== 0x08
  ) {
    throw new EnvelopeDecodeError(
      "envelope-gzip",
      "Screen 2 state payload is not a gzip stream.",
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
      throw new EnvelopeDecodeError(
        "envelope-size",
        "Screen 2 state expanded beyond its declared or permitted size.",
      );
    }
    if (chunk.byteLength > 0) chunks.push(chunk.slice());
    if (final) completed = true;
  });
  try {
    for (let offset = 0; offset < bytes.length; offset += GUNZIP_INPUT_CHUNK_BYTES) {
      const end = Math.min(offset + GUNZIP_INPUT_CHUNK_BYTES, bytes.length);
      gunzip.push(bytes.subarray(offset, end), end === bytes.length);
    }
  } catch (error) {
    if (error instanceof EnvelopeDecodeError) throw error;
    throw new EnvelopeDecodeError(
      "envelope-gzip",
      "Screen 2 state gzip stream is corrupt or incomplete.",
    );
  }
  if (!completed || total !== declaredSize) {
    throw new EnvelopeDecodeError(
      "envelope-size",
      "Screen 2 state did not expand to its declared byte length.",
    );
  }
  return concatenateChunks(chunks, total);
}

function parseEnvelope(value: unknown): Screen02StateEnvelope {
  if (!isRecord(value)) {
    throw new EnvelopeDecodeError(
      "envelope-absent",
      "Screen 2 state envelope is absent.",
    );
  }
  const keys = Object.keys(value);
  if (
    keys.length !== envelopeKeys.length ||
    keys.some((key) => !(envelopeKeys as readonly string[]).includes(key))
  ) {
    throw new EnvelopeDecodeError(
      "envelope-shape",
      "Screen 2 state envelope contains missing or unrecognized fields.",
    );
  }
  if (value.schemaVersion !== SCREEN_02_STATE_ENVELOPE_SCHEMA_VERSION) {
    throw new EnvelopeDecodeError(
      "envelope-schema",
      "Screen 2 state envelope uses an unsupported schema version.",
    );
  }
  if (value.encoding !== SCREEN_02_STATE_ENVELOPE_ENCODING) {
    throw new EnvelopeDecodeError(
      "envelope-encoding",
      "Screen 2 state envelope uses an unsupported encoding.",
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
    throw new EnvelopeDecodeError(
      "envelope-size",
      "Screen 2 state envelope declares an invalid byte length.",
    );
  }
  if (
    typeof value.checksum !== "string" ||
    !CHECKSUM_PATTERN.test(value.checksum)
  ) {
    throw new EnvelopeDecodeError(
      "envelope-checksum",
      "Screen 2 state envelope has an invalid checksum.",
    );
  }
  if (typeof value.payload !== "string") {
    throw new EnvelopeDecodeError(
      "envelope-base64",
      "Screen 2 state envelope payload must be a string.",
    );
  }
  if (value.payload.length > SCREEN_02_MAX_STATE_PAYLOAD_CHARACTERS) {
    throw new EnvelopeDecodeError(
      "envelope-size",
      "Screen 2 state envelope exceeds the encoded transport limit.",
    );
  }
  return {
    schemaVersion: SCREEN_02_STATE_ENVELOPE_SCHEMA_VERSION,
    encoding: SCREEN_02_STATE_ENVELOPE_ENCODING,
    uncompressedBytes: value.uncompressedBytes as number,
    compressedBytes: value.compressedBytes as number,
    checksum: value.checksum,
    payload: value.payload,
  };
}

export function encodeScreen02StateEnvelope(
  session: Screen02Session,
): Screen02StateEnvelope {
  const safe = restoreScreen02Session(session);
  if (!safe) {
    throw new Error(
      "Screen 2 session failed integrity validation before state encoding.",
    );
  }
  const canonicalJson = serializeScreen02Session(safe);
  const { raw, compressed } =
    compressScreen02CanonicalState(canonicalJson);
  const payload = bytesToBase64Url(compressed);
  if (payload.length > SCREEN_02_MAX_STATE_PAYLOAD_CHARACTERS) {
    throw new Error(
      `Screen 2 encoded state exceeds the ${SCREEN_02_MAX_STATE_PAYLOAD_CHARACTERS}-character transport limit.`,
    );
  }
  return {
    schemaVersion: SCREEN_02_STATE_ENVELOPE_SCHEMA_VERSION,
    encoding: SCREEN_02_STATE_ENVELOPE_ENCODING,
    uncompressedBytes: raw.byteLength,
    compressedBytes: compressed.byteLength,
    checksum: checksumCanonicalJson(canonicalJson),
    payload,
  };
}

export function decodeScreen02StateEnvelope(
  value: unknown,
): Screen02StateEnvelopeDecodeResult {
  try {
    const envelope = parseEnvelope(value);
    const compressed = base64UrlToBytes(envelope.payload);
    if (compressed.byteLength !== envelope.compressedBytes) {
      throw new EnvelopeDecodeError(
        "envelope-size",
        "Screen 2 state compressed length does not match its envelope.",
      );
    }
    if (gzipDeclaredSize(compressed) !== envelope.uncompressedBytes) {
      throw new EnvelopeDecodeError(
        "envelope-size",
        "Screen 2 state gzip length does not match its envelope.",
      );
    }
    const raw = boundedGunzip(compressed, envelope.uncompressedBytes);
    let canonicalJson: string;
    try {
      canonicalJson = new TextDecoder("utf-8", { fatal: true }).decode(raw);
    } catch {
      throw new EnvelopeDecodeError(
        "envelope-utf8",
        "Screen 2 state is not valid UTF-8.",
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(canonicalJson) as unknown;
    } catch {
      throw new EnvelopeDecodeError(
        "envelope-json",
        "Screen 2 state is not valid JSON.",
      );
    }
    let recanonicalized: string;
    try {
      recanonicalized = serializeDeterministicJson(parsed);
    } catch {
      throw new EnvelopeDecodeError(
        "envelope-noncanonical",
        "Screen 2 state contains unsupported JSON values.",
      );
    }
    if (recanonicalized !== canonicalJson) {
      throw new EnvelopeDecodeError(
        "envelope-noncanonical",
        "Screen 2 state JSON is not in its canonical representation.",
      );
    }
    if (checksumCanonicalJson(canonicalJson) !== envelope.checksum) {
      throw new EnvelopeDecodeError(
        "envelope-checksum",
        "Screen 2 state checksum does not match its canonical JSON.",
      );
    }
    const session = restoreScreen02Session(parsed);
    if (!session || serializeScreen02Session(session) !== canonicalJson) {
      throw new EnvelopeDecodeError(
        "envelope-session",
        "Screen 2 state failed its session integrity contract.",
      );
    }
    return { ok: true, session, envelope };
  } catch (error) {
    if (error instanceof EnvelopeDecodeError) {
      return { ok: false, code: error.code, message: error.message };
    }
    return {
      ok: false,
      code: "envelope-shape",
      message: "Screen 2 state envelope could not be read.",
    };
  }
}

/**
 * Nullable convenience gate for callers that only need restored state. Use
 * decodeScreen02StateEnvelope when a diagnostic reason must be surfaced.
 */
export function restoreScreen02StateEnvelope(
  value: unknown,
): Screen02Session | null {
  const decoded = decodeScreen02StateEnvelope(value);
  return decoded.ok ? decoded.session : null;
}

/**
 * Stable transport identity without repeating the (potentially large)
 * compressed payload. The raw length makes accidental checksum collisions
 * less likely while keeping equality independent of object-property order.
 */
export function screen02EnvelopeIdentity(
  envelope: Screen02StateEnvelope,
): string {
  return [
    envelope.schemaVersion,
    envelope.uncompressedBytes,
    envelope.checksum,
  ].join(":");
}

export function screen02StateIdentity(
  session: Screen02Session,
  envelope: Screen02StateEnvelope,
): Screen02StateIdentity {
  return {
    runId: session.runId,
    revision: session.revision,
    checksum: envelope.checksum,
  };
}

export function sameScreen02StateIdentity(
  left: Screen02StateIdentity,
  right: Screen02StateIdentity,
) {
  return (
    left.runId === right.runId &&
    left.revision === right.revision &&
    left.checksum === right.checksum
  );
}

function latestRoundAndItems(session: Screen02Session) {
  const latestRound = session.interaction.searchRounds.at(-1);
  if (!latestRound) {
    throw new Error("Screen 2 state has no current search round.");
  }
  const itemById = new Map(session.items.map((item) => [item.id, item]));
  const items = latestRound.itemIdsRetained.map((itemId) => {
    const item = itemById.get(itemId);
    if (!item) {
      throw new Error(
        `Screen 2 state references missing current item ${itemId}.`,
      );
    }
    return item;
  });
  return { latestRound, items };
}

export function buildScreen02StateSummary(
  session: Screen02Session,
): Screen02StateSummary {
  const safe = restoreScreen02Session(session);
  if (!safe) throw new Error("Screen 2 session failed integrity validation.");
  const { latestRound, items } = latestRoundAndItems(safe);
  const stage = latestRound.stage ?? "initial";
  return {
    runId: safe.runId,
    mode: safe.mode,
    revision: safe.revision,
    screen01Fingerprint: safe.screen01Fingerprint,
    latestRoundId: latestRound.id,
    stage,
    currentItems: items.map((item) => ({ id: item.id, title: item.title })),
    coverageStatus: latestRound.manifest.coverage.status,
    pendingRequestReconciled: safe.interaction.pendingRequest === null,
    outcomeValuesInspected: false,
    sessionLocation: "state-envelope",
  };
}

export const buildScreen02SessionSummary = buildScreen02StateSummary;

export function buildScreen02ReviewContext(
  session: Screen02Session,
  requestedCandidateIds?: readonly string[],
): Screen02ReviewContext {
  const safe = restoreScreen02Session(session);
  if (!safe) throw new Error("Screen 2 session failed integrity validation.");
  const { latestRound, items } = latestRoundAndItems(safe);
  if (
    latestRound.stage !== "native-retrieval" &&
    latestRound.stage !== "preliminary-assessment"
  ) {
    throw new Error(
      "Screen 2 preliminary assessment context requires a current native result or retryable assessment round.",
    );
  }
  const rootNativeRound =
    latestRound.stage === "native-retrieval"
      ? latestRound
      : safe.interaction.searchRounds.find(
          (round) => round.id === latestRound.rootNativeRoundId,
        );
  if (!rootNativeRound || rootNativeRound.stage !== "native-retrieval") {
    throw new Error(
      "Screen 2 preliminary assessment context has no valid native source round.",
    );
  }
  const eligibleCandidateIds =
    latestRound.stage === "native-retrieval"
      ? [...latestRound.itemIdsRetained]
      : (latestRound.assessmentResults ?? [])
          .filter((result) => result.status === "needs-retry")
          .map((result) => result.itemId);
  const rejectedItemIds = new Set(
    safe.interaction.rejections.map((rejection) => rejection.itemId),
  );
  const activeEligibleCandidateIds = eligibleCandidateIds.filter(
    (itemId) => !rejectedItemIds.has(itemId),
  );
  const eligibleSet = new Set(activeEligibleCandidateIds);
  const targetCandidateIds = requestedCandidateIds
    ? [...new Set(requestedCandidateIds)].filter((itemId) =>
        eligibleSet.has(itemId),
      )
    : activeEligibleCandidateIds;
  if (targetCandidateIds.length === 0) {
    throw new Error(
      "Screen 2 has no candidate that currently needs a preliminary assessment.",
    );
  }
  if (
    requestedCandidateIds &&
    targetCandidateIds.length !== new Set(requestedCandidateIds).size
  ) {
    throw new Error(
      "The requested preliminary-assessment retry includes a candidate that is not currently retryable.",
    );
  }
  const itemById = new Map(items.map((item) => [item.id, item]));
  const currentCandidates = targetCandidateIds.map((itemId) => {
    const item = itemById.get(itemId);
    if (!item) {
      throw new Error(
        `Screen 2 preliminary assessment target ${itemId} is not currently visible.`,
      );
    }
    return item;
  });
  const activeCriterionIds = new Set(
    rootNativeRound.preferenceCriteriaIds,
  );
  const context: Screen02ReviewContext = {
    schemaVersion: SCREEN_02_REVIEW_CONTEXT_SCHEMA_VERSION,
    runId: safe.runId,
    revision: safe.revision,
    mode: safe.mode,
    screen01Fingerprint: safe.screen01Fingerprint,
    screen01Baseline: safe.screen01Baseline as Screen01StudyContext,
    rootNativeRoundId: rootNativeRound.id,
    assessmentParentRoundId: latestRound.id,
    stage: latestRound.stage,
    exactRequest: rootNativeRound.exactRequest,
    criteria: safe.interaction.preferences.criteria.filter((criterion) =>
      activeCriterionIds.has(criterion.id),
    ),
    targetCandidateIds,
    currentCandidates,
    searchManifest: rootNativeRound.manifest,
    outcomeValuesInspected: false,
  };
  return JSON.parse(
    serializeDeterministicJson(context),
  ) as Screen02ReviewContext;
}
