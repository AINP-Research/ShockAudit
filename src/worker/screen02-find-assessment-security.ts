import { serializeDeterministicJson } from "../core/screen02-service";
import {
  SCREEN_02_FIND_DRAFT_SCHEMA_VERSION,
  createScreen02FindDraftReceipt,
  normalizeScreen02FindDiscoveryQueryPlanDraft,
  screen02FindRequestProof,
  type Screen02FindDraftReceipt,
} from "../core/screen02-find-workflow";
import {
  fingerprintScreen02WorkflowState,
  fingerprintScreen02WorkflowValue,
  requireScreen02FindState,
} from "../core/screen02-workflow-state";
import {
  screen02FindAssessmentPartIds,
  screen02FindDiscoveryPlanPartIds,
  screen02MeasurementPotentialCategories,
  screen02OutcomePathwayCategories,
  screen02StudyFitCategories,
  type Screen02AssessmentFailure,
  type Screen02AssessmentRequest,
  type Screen02Criterion,
  type Screen02CriterionFindingResult,
  type Screen02CriterionKind,
  type Screen02FindCandidateSnapshot,
  type Screen02FindState,
  type Screen02WorkflowSource,
} from "../core/screen02-workflow-types";
import {
  parseScreen02HostOrientationReceipt,
  prepareScreen02HostOrientationReceipt,
  type Screen02HostOrientationReceipt,
} from "./screen02-host-orientation-security";

export const SCREEN_02_FIND_CAPABILITY_SCHEMA_VERSION =
  "screen-02-find-assessment-capability-v1" as const;
export const SCREEN_02_FIND_DRAFT_SUBMISSION_SCHEMA_VERSION =
  "screen-02-find-assessment-submission-v1" as const;
export const SCREEN_02_FIND_SIGNED_RECEIPT_SCHEMA_VERSION =
  "screen-02-find-signed-normalized-receipt-v1" as const;
export const SCREEN_02_FIND_SOURCE_PACKET_SCHEMA_VERSION =
  "screen-02-find-assessment-source-packet-v1" as const;
export const SCREEN_02_FIND_DEFAULT_CAPABILITY_TTL_MS = 120_000;
export const SCREEN_02_FIND_MAX_CAPABILITY_TTL_MS = 10 * 60_000;
export const SCREEN_02_FIND_MIN_SIGNING_KEY_BYTES = 32;

const CAPABILITY_TOKEN_PREFIX = "sa2f-capability-v1";
const RECEIPT_TOKEN_PREFIX = "sa2f-receipt-v1";
const MAX_SIGNED_TOKEN_CHARACTERS = 64 * 1024;
const MAX_KEY_BYTES = 4 * 1024;
const MAX_IDENTIFIER_CHARACTERS = 200;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const FINGERPRINT_PATTERN = /^fnv1a64:[0-9a-f]{16}$/;
const KEY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const forbiddenAssessmentClaimPattern =
  /\b(?:p[- ]?value|statistical(?:ly)? significant|effect estimate|realized outcome|observed (?:effect|outcome)|proves? causality|causal validity|causally valid|as-if random|exogeneity|exogenous(?:ly)?(?: assignment)?|random assignment|legally verified|verified legal (?:status|coverage|eligibility)|definitively covered|confirmed operative date)\b/i;

export function screen02FindAssessmentNarrativeHasForbiddenClaim(
  value: unknown,
) {
  return (
    typeof value === "string" && forbiddenAssessmentClaimPattern.test(value)
  );
}

const capabilityKeys = [
  "schemaVersion",
  "keyId",
  "capabilityId",
  "runId",
  "stateRevision",
  "stateFingerprint",
  "requestId",
  "jobId",
  "rootRequestId",
  "mode",
  "attempt",
  "packetFingerprint",
  "candidateSnapshotId",
  "candidateFingerprint",
  "criterionId",
  "criterionVersion",
  "criterionKind",
  "requestProof",
  "requestedPartIds",
  "allowedEvidenceSourceIds",
  "issuedAt",
  "expiresAt",
] as const;

const legacySignedReceiptKeys = [
  "schemaVersion",
  "keyId",
  "receiptId",
  "receivedAt",
  "capability",
  "normalizedDraft",
  "validationFailures",
] as const;

const signedReceiptKeys = [
  ...legacySignedReceiptKeys,
  "hostOrientation",
] as const;

export type Screen02FindSigningConfig = {
  keyId: string;
  key: string | Uint8Array;
};

type Screen02FindAssessmentCapabilityBase = {
  schemaVersion: typeof SCREEN_02_FIND_CAPABILITY_SCHEMA_VERSION;
  keyId: string;
  capabilityId: string;
  runId: string;
  stateRevision: number;
  stateFingerprint: string;
  requestId: string;
  jobId: string;
  rootRequestId: string;
  attempt: 1 | 2 | 3;
  packetFingerprint: string;
  requestProof: string;
  requestedPartIds: string[];
  allowedEvidenceSourceIds: string[];
  issuedAt: string;
  expiresAt: string;
};

export type Screen02FindAssessmentCapability =
  | (Screen02FindAssessmentCapabilityBase & {
      mode: "find-discovery-plan";
      candidateSnapshotId: null;
      candidateFingerprint: null;
      criterionId: null;
      criterionVersion: null;
      criterionKind: null;
    })
  | (Screen02FindAssessmentCapabilityBase & {
      mode: "find-candidate";
      candidateSnapshotId: string;
      candidateFingerprint: string;
      criterionId: null;
      criterionVersion: null;
      criterionKind: null;
    })
  | (Screen02FindAssessmentCapabilityBase & {
      mode: "find-criterion";
      candidateSnapshotId: string;
      candidateFingerprint: string;
      criterionId: string;
      criterionVersion: number;
      criterionKind: Screen02CriterionKind;
    });

type Screen02FindAssessmentSourcePacketBase = {
  schemaVersion: typeof SCREEN_02_FIND_SOURCE_PACKET_SCHEMA_VERSION;
  requestId: string;
  packetFingerprint: string;
  study: Screen02FindState["screen01Baseline"];
  outcomeValuesInspected: false;
};

export type Screen02FindAssessmentSourcePacket =
  | (Screen02FindAssessmentSourcePacketBase & {
      mode: "find-discovery-plan";
      candidate: null;
      criterion: null;
      sources: [];
      activeCriteria: Array<
        Pick<Screen02Criterion, "kind" | "text" | "exactRequest">
      >;
    })
  | (Screen02FindAssessmentSourcePacketBase & {
      mode: "find-candidate" | "find-criterion";
      candidate: Screen02FindCandidateSnapshot;
      criterion: Screen02Criterion | null;
      sources: Screen02WorkflowSource[];
    });

export type Screen02FindCapabilityIssueResult = {
  capability: Screen02FindAssessmentCapability;
  capabilityToken: string;
  sourcePacket: Screen02FindAssessmentSourcePacket;
};

export type Screen02FindDraftSubmission = {
  schemaVersion: typeof SCREEN_02_FIND_DRAFT_SUBMISSION_SCHEMA_VERSION;
  capabilityToken: string;
  requestId: string;
  draft: unknown;
  orientation?: unknown;
};

export type Screen02FindNormalizedReceiptPayload = {
  schemaVersion: typeof SCREEN_02_FIND_SIGNED_RECEIPT_SCHEMA_VERSION;
  keyId: string;
  receiptId: string;
  receivedAt: string;
  capability: Screen02FindAssessmentCapability;
  normalizedDraft: unknown;
  validationFailures: Screen02AssessmentFailure[];
  hostOrientation: Screen02HostOrientationReceipt;
};

export type Screen02FindSignedReceipt = {
  receiptToken: string;
  payload: Screen02FindNormalizedReceiptPayload;
  receipt: Screen02FindDraftReceipt;
  acceptedPartIds: string[];
  hostOrientation: Screen02HostOrientationReceipt;
};

export type Screen02FindReceiptDisposition =
  | {
      disposition: "apply";
      reason: string;
      request: Screen02AssessmentRequest;
    }
  | {
      disposition:
        | "duplicate"
        | "awaiting-delivery"
        | "stale"
        | "terminal"
        | "unknown-request";
      reason: string;
      request: Screen02AssessmentRequest | null;
    };

type CandidateDraftPartId = (typeof screen02FindAssessmentPartIds)[number];

type NormalizedCandidateDraft = Partial<{
  studyFit: {
    category: (typeof screen02StudyFitCategories)[number];
    explanation: string;
    evidenceSourceIds: string[];
  };
  outcomePathway: {
    category: (typeof screen02OutcomePathwayCategories)[number];
    explanation: string;
    evidenceSourceIds: string[];
  };
  measurementPotential: {
    category: (typeof screen02MeasurementPotentialCategories)[number];
    explanation: string;
    evidenceSourceIds: string[];
  };
  mainConcern: string;
  nextChecks: string[];
}>;

type NormalizedCriterionDraft = {
  result: Screen02CriterionFindingResult;
  reason: string;
  evidenceSourceIds: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return (
    actual.length === wanted.length &&
    actual.every((key, index) => key === wanted[index])
  );
}

function clone<T>(value: T): T {
  return JSON.parse(serializeDeterministicJson(value)) as T;
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value && typeof value === "object" && !seen.has(value as object)) {
    seen.add(value as object);
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child, seen);
    }
  }
  return value;
}

function requireIdentifier(value: unknown, label: string) {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    value.length < 1 ||
    value.length > MAX_IDENTIFIER_CHARACTERS
  ) {
    throw new Error(`${label} must be a bounded canonical identifier.`);
  }
  return value;
}

function requireCanonicalIsoTimestamp(value: unknown, label: string) {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a canonical ISO timestamp.`);
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    throw new Error(`${label} must be a canonical ISO timestamp.`);
  }
  return milliseconds;
}

function requireFingerprint(value: unknown, label: string) {
  if (typeof value !== "string" || !FINGERPRINT_PATTERN.test(value)) {
    throw new Error(`${label} must be a canonical workflow fingerprint.`);
  }
  return value;
}

function uniqueBoundedStrings(
  value: unknown,
  label: string,
  maximum: number,
) {
  if (
    !Array.isArray(value) ||
    value.length > maximum ||
    value.some(
      (item) =>
        typeof item !== "string" ||
        item.trim() !== item ||
        item.length < 1 ||
        item.length > MAX_IDENTIFIER_CHARACTERS,
    ) ||
    new Set(value).size !== value.length
  ) {
    throw new Error(`${label} must contain unique bounded identifiers.`);
  }
  return [...value] as string[];
}

function signingKeyBytes(config: Screen02FindSigningConfig) {
  if (!config || !KEY_ID_PATTERN.test(config.keyId)) {
    throw new Error("Screen 2 Find signing key ID is missing or invalid.");
  }
  const bytes =
    typeof config.key === "string"
      ? new TextEncoder().encode(config.key)
      : config.key instanceof Uint8Array
        ? config.key.slice()
        : new Uint8Array();
  if (
    bytes.byteLength < SCREEN_02_FIND_MIN_SIGNING_KEY_BYTES ||
    bytes.byteLength > MAX_KEY_BYTES
  ) {
    throw new Error(
      `Screen 2 Find signing key must contain ${SCREEN_02_FIND_MIN_SIGNING_KEY_BYTES}–${MAX_KEY_BYTES} bytes.`,
    );
  }
  return bytes;
}

export function assertScreen02FindSigningConfig(
  config: Screen02FindSigningConfig,
) {
  signingKeyBytes(config);
}

async function importHmacKey(
  config: Screen02FindSigningConfig,
  usage: "sign" | "verify",
) {
  return crypto.subtle.importKey(
    "raw",
    signingKeyBytes(config),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
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

function base64UrlToBytes(value: string, label: string) {
  if (
    value.length < 1 ||
    value.length > MAX_SIGNED_TOKEN_CHARACTERS ||
    !BASE64URL_PATTERN.test(value) ||
    value.length % 4 === 1
  ) {
    throw new Error(`${label} is not canonical bounded base64url.`);
  }
  const padded = `${value.replaceAll("-", "+").replaceAll("_", "/")}${"=".repeat(
    (4 - (value.length % 4)) % 4,
  )}`;
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new Error(`${label} is not valid base64url.`);
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (bytesToBase64Url(bytes) !== value) {
    throw new Error(`${label} is not canonical base64url.`);
  }
  return bytes;
}

async function signToken(
  prefix: string,
  payload: unknown,
  config: Screen02FindSigningConfig,
) {
  const canonical = serializeDeterministicJson(payload);
  const payloadBytes = new TextEncoder().encode(canonical);
  const payloadPart = bytesToBase64Url(payloadBytes);
  const key = await importHmacKey(config, "sign");
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, payloadBytes),
  );
  const token = `${prefix}.${payloadPart}.${bytesToBase64Url(signature)}`;
  if (token.length > MAX_SIGNED_TOKEN_CHARACTERS) {
    throw new Error("Screen 2 Find signed token exceeds its transport limit.");
  }
  return token;
}

async function verifyToken(
  token: unknown,
  prefix: string,
  config: Screen02FindSigningConfig,
) {
  signingKeyBytes(config);
  if (
    typeof token !== "string" ||
    token.length < 1 ||
    token.length > MAX_SIGNED_TOKEN_CHARACTERS
  ) {
    throw new Error("Screen 2 Find signed token is missing or oversized.");
  }
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== prefix) {
    throw new Error("Screen 2 Find signed token has the wrong type.");
  }
  const payloadBytes = base64UrlToBytes(parts[1]!, "Signed token payload");
  const signatureBytes = base64UrlToBytes(
    parts[2]!,
    "Signed token signature",
  );
  if (signatureBytes.byteLength !== 32) {
    throw new Error("Screen 2 Find signed token signature is malformed.");
  }
  const key = await importHmacKey(config, "verify");
  const verified = await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    payloadBytes,
  );
  if (!verified) {
    throw new Error("Screen 2 Find signed token authentication failed.");
  }
  let canonical: string;
  try {
    canonical = new TextDecoder("utf-8", { fatal: true }).decode(payloadBytes);
  } catch {
    throw new Error("Screen 2 Find signed token is not UTF-8.");
  }
  let payload: unknown;
  try {
    payload = JSON.parse(canonical) as unknown;
  } catch {
    throw new Error("Screen 2 Find signed token is not JSON.");
  }
  if (serializeDeterministicJson(payload) !== canonical) {
    throw new Error("Screen 2 Find signed token payload is not canonical JSON.");
  }
  return payload;
}

function criterionResultAllowed(
  kind: Screen02CriterionKind,
  result: Screen02CriterionFindingResult,
) {
  return kind === "do-not-show"
    ? (["violates", "does-not-violate", "unclear"] as const).includes(
        result as "violates" | "does-not-violate" | "unclear",
      )
    : (["meets", "does-not-meet", "unclear"] as const).includes(
        result as "meets" | "does-not-meet" | "unclear",
      );
}

function parseCapability(value: unknown): Screen02FindAssessmentCapability {
  if (!isRecord(value) || !exactKeys(value, capabilityKeys)) {
    throw new Error("Screen 2 Find capability has missing or unrecognized fields.");
  }
  if (value.schemaVersion !== SCREEN_02_FIND_CAPABILITY_SCHEMA_VERSION) {
    throw new Error("Screen 2 Find capability schema is unsupported.");
  }
  if (typeof value.keyId !== "string" || !KEY_ID_PATTERN.test(value.keyId)) {
    throw new Error("Screen 2 Find capability key ID is invalid.");
  }
  const capabilityId = requireIdentifier(value.capabilityId, "capabilityId");
  const runId = requireIdentifier(value.runId, "runId");
  if (!Number.isSafeInteger(value.stateRevision) || (value.stateRevision as number) < 0) {
    throw new Error("Screen 2 Find capability state revision is invalid.");
  }
  const stateFingerprint = requireFingerprint(
    value.stateFingerprint,
    "stateFingerprint",
  );
  const requestId = requireIdentifier(value.requestId, "requestId");
  const jobId = requireIdentifier(value.jobId, "jobId");
  const rootRequestId = requireIdentifier(value.rootRequestId, "rootRequestId");
  if (
    value.mode !== "find-discovery-plan" &&
    value.mode !== "find-candidate" &&
    value.mode !== "find-criterion"
  ) {
    throw new Error("Screen 2 Find capability mode is invalid.");
  }
  const mode = value.mode;
  if (![1, 2, 3].includes(value.attempt as number)) {
    throw new Error("Screen 2 Find capability attempt is invalid.");
  }
  const packetFingerprint = requireFingerprint(
    value.packetFingerprint,
    "packetFingerprint",
  );
  const requestProof = requireFingerprint(value.requestProof, "requestProof");
  const requestedPartIds = uniqueBoundedStrings(
    value.requestedPartIds,
    "requestedPartIds",
    Math.max(
      screen02FindAssessmentPartIds.length,
      screen02FindDiscoveryPlanPartIds.length,
    ),
  );
  const allowedEvidenceSourceIds = uniqueBoundedStrings(
    value.allowedEvidenceSourceIds,
    "allowedEvidenceSourceIds",
    50,
  );
  const issuedAtMs = requireCanonicalIsoTimestamp(value.issuedAt, "issuedAt");
  const expiresAtMs = requireCanonicalIsoTimestamp(value.expiresAt, "expiresAt");
  if (
    expiresAtMs <= issuedAtMs ||
    expiresAtMs - issuedAtMs > SCREEN_02_FIND_MAX_CAPABILITY_TTL_MS
  ) {
    throw new Error("Screen 2 Find capability lifetime is invalid.");
  }

  const common = {
    schemaVersion: SCREEN_02_FIND_CAPABILITY_SCHEMA_VERSION,
    keyId: value.keyId,
    capabilityId,
    runId,
    stateRevision: value.stateRevision as number,
    stateFingerprint,
    requestId,
    jobId,
    rootRequestId,
    attempt: value.attempt as 1 | 2 | 3,
    packetFingerprint,
    requestProof,
    requestedPartIds,
    allowedEvidenceSourceIds,
    issuedAt: value.issuedAt as string,
    expiresAt: value.expiresAt as string,
  };

  if (mode === "find-discovery-plan") {
    if (
      value.candidateSnapshotId !== null ||
      value.candidateFingerprint !== null ||
      value.criterionId !== null ||
      value.criterionVersion !== null ||
      value.criterionKind !== null ||
      allowedEvidenceSourceIds.length !== 0 ||
      serializeDeterministicJson(requestedPartIds) !==
        serializeDeterministicJson(screen02FindDiscoveryPlanPartIds)
    ) {
      throw new Error("Screen 2 Find planning capability scope is invalid.");
    }
    return {
      ...common,
      mode,
      candidateSnapshotId: null,
      candidateFingerprint: null,
      criterionId: null,
      criterionVersion: null,
      criterionKind: null,
    };
  }

  const candidateSnapshotId = requireIdentifier(
    value.candidateSnapshotId,
    "candidateSnapshotId",
  );
  const candidateFingerprint = requireFingerprint(
    value.candidateFingerprint,
    "candidateFingerprint",
  );
  if (mode === "find-candidate") {
    if (
      value.criterionId !== null ||
      value.criterionVersion !== null ||
      value.criterionKind !== null ||
      requestedPartIds.length < 1 ||
      requestedPartIds.some(
        (partId) =>
          !(screen02FindAssessmentPartIds as readonly string[]).includes(partId),
      )
    ) {
      throw new Error("Screen 2 candidate capability parts are invalid.");
    }
    return {
      ...common,
      mode,
      candidateSnapshotId,
      candidateFingerprint,
      criterionId: null,
      criterionVersion: null,
      criterionKind: null,
    };
  }

  const criterionId = requireIdentifier(value.criterionId, "criterionId");
  if (
    !Number.isSafeInteger(value.criterionVersion) ||
    (value.criterionVersion as number) < 1
  ) {
    throw new Error("Screen 2 criterion capability version is invalid.");
  }
  const criterionVersion = value.criterionVersion as number;
  if (
    value.criterionKind !== "only-include" &&
    value.criterionKind !== "rank-higher" &&
    value.criterionKind !== "do-not-show"
  ) {
    throw new Error("Screen 2 criterion capability kind is invalid.");
  }
  const criterionKind = value.criterionKind;
  const expectedPartId = `${candidateSnapshotId}:${criterionId}:${criterionVersion}`;
  if (requestedPartIds.length !== 1 || requestedPartIds[0] !== expectedPartId) {
    throw new Error("Screen 2 criterion capability part identity is invalid.");
  }

  return {
    ...common,
    mode,
    candidateSnapshotId,
    candidateFingerprint,
    criterionId,
    criterionVersion,
    criterionKind,
  };
}

function activeFindRequestPacket(
  state: Screen02FindState,
  request: Screen02AssessmentRequest,
) {
  const target = request.target;
  if (target.mode === "find-discovery-plan") {
    const activeCriteria = state.criteria.filter(
      (criterion) => criterion.status === "active",
    );
    const criteriaFingerprint = fingerprintScreen02WorkflowValue(activeCriteria);
    const packetFingerprint = fingerprintScreen02WorkflowValue({
      mode: target.mode,
      screen01Fingerprint: state.screen01Fingerprint,
      searchOrdinal: target.searchOrdinal,
      criteriaFingerprint,
    });
    if (
      criteriaFingerprint !== target.criteriaFingerprint ||
      packetFingerprint !== target.packetFingerprint
    ) {
      throw new Error("Screen 2 Find planning packet is unavailable or stale.");
    }
    return {
      mode: target.mode,
      candidate: null,
      criterion: null,
      sources: [] as [],
      activeCriteria,
      packetFingerprint,
    };
  }
  if (target.mode !== "find-candidate" && target.mode !== "find-criterion") {
    throw new Error("Screen 2 Find capability cannot target an Audit request.");
  }
  const activeSet = state.candidateSets.find(
    (candidateSet) =>
      candidateSet.candidateSetSnapshotId === state.activeCandidateSetSnapshotId &&
      candidateSet.status === "active",
  );
  const candidate = state.candidates.find(
    (item) => item.candidateSnapshotId === target.candidateSnapshotId,
  );
  if (
    !activeSet ||
    !candidate ||
    !activeSet.candidateSnapshotIds.includes(candidate.candidateSnapshotId) ||
    target.candidateFingerprint !== candidate.candidateFingerprint
  ) {
    throw new Error("Screen 2 Find request no longer targets an active candidate packet.");
  }
  const sourceById = new Map(state.sources.map((source) => [source.id, source]));
  if (candidate.sourceIds.some((sourceId) => !sourceById.has(sourceId))) {
    throw new Error("Screen 2 Find candidate source packet is incomplete.");
  }
  const sources = state.sources.filter((source) =>
    candidate.sourceIds.includes(source.id),
  );
  let criterion: Screen02Criterion | null = null;
  if (target.mode === "find-criterion") {
    criterion = state.criteria.find(
      (item) =>
        item.criterionId === target.criterionId &&
        item.version === target.criterionVersion &&
        item.status === "active" &&
        activeSet.criterionVersionRefs.some(
          (reference) =>
            reference.criterionId === item.criterionId &&
            reference.version === item.version,
        ),
    ) ?? null;
    if (!criterion) {
      throw new Error("Screen 2 Find criterion packet is unavailable or stale.");
    }
  }
  const packetFingerprint = fingerprintScreen02WorkflowValue({
    mode: target.mode,
    screen01Fingerprint: state.screen01Fingerprint,
    candidate,
    ...(criterion ? { criterion } : {}),
    sources,
  });
  if (packetFingerprint !== target.packetFingerprint) {
    throw new Error("Screen 2 Find source packet fingerprint does not match its request.");
  }
  return { mode: target.mode, candidate, criterion, sources, packetFingerprint };
}

export function buildScreen02FindAssessmentSourcePacket(
  state: Screen02FindState,
  requestId: string,
): Screen02FindAssessmentSourcePacket {
  const safe = requireScreen02FindState(state);
  const request = safe.assessmentRequests.find((item) => item.requestId === requestId);
  if (!request) throw new Error("Screen 2 Find assessment request was not found.");
  const packet = activeFindRequestPacket(safe, request);
  if (packet.mode === "find-discovery-plan") {
    return deepFreeze({
      schemaVersion: SCREEN_02_FIND_SOURCE_PACKET_SCHEMA_VERSION,
      mode: packet.mode,
      requestId: request.requestId,
      packetFingerprint: packet.packetFingerprint,
      study: clone(safe.screen01Baseline),
      candidate: null,
      criterion: null,
      sources: [] as [],
      activeCriteria: packet.activeCriteria.map((criterion) => ({
        kind: criterion.kind,
        text: criterion.text,
        exactRequest: criterion.exactRequest,
      })),
      outcomeValuesInspected: false as const,
    });
  }
  return deepFreeze({
    schemaVersion: SCREEN_02_FIND_SOURCE_PACKET_SCHEMA_VERSION,
    mode: packet.mode,
    requestId: request.requestId,
    packetFingerprint: packet.packetFingerprint,
    study: clone(safe.screen01Baseline),
    candidate: clone(packet.candidate),
    criterion: packet.criterion ? clone(packet.criterion) : null,
    sources: clone(packet.sources),
    outcomeValuesInspected: false as const,
  });
}

export async function createScreen02FindAssessmentCapability(
  input: {
    state: Screen02FindState;
    requestId: string;
    capabilityId: string;
    issuedAt: string;
    expiresAt?: string;
  },
  config: Screen02FindSigningConfig,
): Promise<Screen02FindCapabilityIssueResult> {
  signingKeyBytes(config);
  const safe = requireScreen02FindState(input.state);
  const request = safe.assessmentRequests.find(
    (item) => item.requestId === input.requestId,
  );
  if (
    !request ||
    (request.target.mode !== "find-discovery-plan" &&
      request.target.mode !== "find-candidate" &&
      request.target.mode !== "find-criterion")
  ) {
    throw new Error("Screen 2 Find capability request was not found.");
  }
  if (request.status !== "prepared" && request.status !== "message-delivered") {
    throw new Error("Screen 2 Find capability can only bind an awaiting model request.");
  }
  const sourcePacket = buildScreen02FindAssessmentSourcePacket(safe, request.requestId);
  const issuedAtMs = requireCanonicalIsoTimestamp(input.issuedAt, "issuedAt");
  const expiresAt =
    input.expiresAt ??
    new Date(issuedAtMs + SCREEN_02_FIND_DEFAULT_CAPABILITY_TTL_MS).toISOString();
  const expiresAtMs = requireCanonicalIsoTimestamp(expiresAt, "expiresAt");
  if (
    expiresAtMs <= issuedAtMs ||
    expiresAtMs - issuedAtMs > SCREEN_02_FIND_MAX_CAPABILITY_TTL_MS
  ) {
    throw new Error("Screen 2 Find capability lifetime is invalid.");
  }
  const criterion =
    sourcePacket.mode === "find-criterion" ? sourcePacket.criterion : null;
  const capability: Screen02FindAssessmentCapability = parseCapability({
    schemaVersion: SCREEN_02_FIND_CAPABILITY_SCHEMA_VERSION,
    keyId: config.keyId,
    capabilityId: requireIdentifier(input.capabilityId, "capabilityId"),
    runId: safe.runId,
    stateRevision: safe.revision,
    stateFingerprint: fingerprintScreen02WorkflowState(safe),
    requestId: request.requestId,
    jobId: request.jobId,
    rootRequestId: request.rootRequestId,
    mode: request.target.mode,
    attempt: request.attempt,
    packetFingerprint: request.target.packetFingerprint,
    candidateSnapshotId:
      request.target.mode === "find-discovery-plan"
        ? null
        : request.target.candidateSnapshotId,
    candidateFingerprint:
      request.target.mode === "find-discovery-plan"
        ? null
        : request.target.candidateFingerprint,
    criterionId:
      request.target.mode === "find-criterion" ? request.target.criterionId : null,
    criterionVersion:
      request.target.mode === "find-criterion"
        ? request.target.criterionVersion
        : null,
    criterionKind: criterion?.kind ?? null,
    requestProof: screen02FindRequestProof(request),
    requestedPartIds: [...request.requestedPartIds],
    allowedEvidenceSourceIds:
      sourcePacket.mode === "find-discovery-plan"
        ? []
        : [...sourcePacket.candidate.sourceIds],
    issuedAt: input.issuedAt,
    expiresAt,
  });
  return {
    capability: deepFreeze(capability),
    capabilityToken: await signToken(CAPABILITY_TOKEN_PREFIX, capability, config),
    sourcePacket,
  };
}

export async function verifyScreen02FindAssessmentCapability(
  capabilityToken: unknown,
  config: Screen02FindSigningConfig,
  observedAt: string,
) {
  const payload = await verifyToken(
    capabilityToken,
    CAPABILITY_TOKEN_PREFIX,
    config,
  );
  const capability = parseCapability(payload);
  if (capability.keyId !== config.keyId) {
    throw new Error("Screen 2 Find capability uses an unavailable signing key.");
  }
  const observedAtMs = requireCanonicalIsoTimestamp(observedAt, "observedAt");
  const issuedAtMs = Date.parse(capability.issuedAt);
  const expiresAtMs = Date.parse(capability.expiresAt);
  if (observedAtMs < issuedAtMs || observedAtMs >= expiresAtMs) {
    throw new Error("Screen 2 Find capability is not active at the observed time.");
  }
  return deepFreeze(capability);
}

function validateNarrative(
  value: unknown,
  minimum = 30,
  maximum = 800,
) {
  if (typeof value !== "string") return "narrative-not-text";
  const trimmed = value.trim();
  if (trimmed.length < minimum || trimmed.length > maximum) {
    return "narrative-length";
  }
  if (screen02FindAssessmentNarrativeHasForbiddenClaim(trimmed)) {
    return "forbidden-outcome-or-causal-claim";
  }
  return null;
}

function validateEvidenceSourceIds(
  value: unknown,
  allowed: ReadonlySet<string>,
  allowEmpty: boolean,
) {
  if (
    !Array.isArray(value) ||
    value.length > 50 ||
    value.some(
      (item) =>
        typeof item !== "string" ||
        item.trim() !== item ||
        item.length < 1 ||
        item.length > MAX_IDENTIFIER_CHARACTERS,
    ) ||
    new Set(value).size !== value.length
  ) {
    return { value: null, code: "invalid-evidence-source-ids" } as const;
  }
  const sourceIds = [...value] as string[];
  if (sourceIds.some((sourceId) => !allowed.has(sourceId))) {
    return { value: null, code: "evidence-outside-source-packet" } as const;
  }
  if (!allowEmpty && sourceIds.length === 0) {
    return { value: null, code: "resolved-result-needs-evidence" } as const;
  }
  return { value: sourceIds, code: null } as const;
}

function normalizeComponent<Category extends string>(
  value: unknown,
  categories: readonly Category[],
  allowedSources: ReadonlySet<string>,
) {
  const codes: string[] = [];
  if (
    !isRecord(value) ||
    !exactKeys(value, ["category", "explanation", "evidenceSourceIds"])
  ) {
    return { value: null, codes: ["invalid-component-shape"] };
  }
  if (!categories.includes(value.category as Category)) {
    codes.push("invalid-category");
  }
  const narrativeCode = validateNarrative(value.explanation);
  if (narrativeCode) codes.push(narrativeCode);
  const evidence = validateEvidenceSourceIds(
    value.evidenceSourceIds,
    allowedSources,
    value.category === "unclear",
  );
  if (evidence.code) codes.push(evidence.code);
  if (codes.length > 0) return { value: null, codes };
  return {
    value: {
      category: value.category as Category,
      explanation: (value.explanation as string).trim(),
      evidenceSourceIds: evidence.value!,
    },
    codes,
  };
}

function normalizeCandidateDraft(
  draft: unknown,
  capability: Screen02FindAssessmentCapability,
) {
  const requestedPartIds = capability.requestedPartIds as CandidateDraftPartId[];
  const failures: Screen02AssessmentFailure[] = [];
  const acceptedPartIds: string[] = [];
  const normalized: NormalizedCandidateDraft = {};
  if (!isRecord(draft) || !exactKeys(draft, requestedPartIds)) {
    return {
      normalizedDraft: normalized,
      acceptedPartIds,
      failures: requestedPartIds.map((partId) => ({
        partId,
        codes: ["invalid-draft-shape"],
      })),
    };
  }
  const allowedSources = new Set(capability.allowedEvidenceSourceIds);
  for (const partId of requestedPartIds) {
    if (partId === "studyFit") {
      const parsed = normalizeComponent(
        draft.studyFit,
        screen02StudyFitCategories,
        allowedSources,
      );
      if (parsed.value) normalized.studyFit = parsed.value;
      else failures.push({ partId, codes: parsed.codes });
    } else if (partId === "outcomePathway") {
      const parsed = normalizeComponent(
        draft.outcomePathway,
        screen02OutcomePathwayCategories,
        allowedSources,
      );
      if (parsed.value) normalized.outcomePathway = parsed.value;
      else failures.push({ partId, codes: parsed.codes });
    } else if (partId === "measurementPotential") {
      const parsed = normalizeComponent(
        draft.measurementPotential,
        screen02MeasurementPotentialCategories,
        allowedSources,
      );
      if (parsed.value) normalized.measurementPotential = parsed.value;
      else failures.push({ partId, codes: parsed.codes });
    } else if (partId === "mainConcern") {
      const code = validateNarrative(draft.mainConcern);
      if (code) failures.push({ partId, codes: [code] });
      else normalized.mainConcern = (draft.mainConcern as string).trim();
    } else if (partId === "nextChecks") {
      if (
        !Array.isArray(draft.nextChecks) ||
        draft.nextChecks.length < 1 ||
        draft.nextChecks.length > 2 ||
        draft.nextChecks.some((item) => typeof item !== "string")
      ) {
        failures.push({ partId, codes: ["invalid-next-checks-shape"] });
      } else {
        const trimmed = (draft.nextChecks as string[]).map((item) => item.trim());
        const codes: string[] = [];
        for (const item of trimmed) {
          const code = validateNarrative(item, 20, 500);
          if (code && !codes.includes(code)) codes.push(code);
        }
        if (new Set(trimmed).size !== trimmed.length) {
          codes.push("duplicate-next-check");
        }
        if (codes.length > 0) failures.push({ partId, codes });
        else normalized.nextChecks = trimmed;
      }
    }
  }
  const failed = new Set(failures.map((failure) => failure.partId));
  acceptedPartIds.push(
    ...requestedPartIds.filter((partId) => !failed.has(partId)),
  );
  return { normalizedDraft: normalized, acceptedPartIds, failures };
}

function normalizeCriterionDraft(
  draft: unknown,
  capability: Screen02FindAssessmentCapability,
) {
  const partId = capability.requestedPartIds[0]!;
  const codes: string[] = [];
  if (
    !isRecord(draft) ||
    !exactKeys(draft, ["result", "reason", "evidenceSourceIds"])
  ) {
    return {
      normalizedDraft: {},
      acceptedPartIds: [] as string[],
      failures: [{ partId, codes: ["invalid-criterion-draft-shape"] }],
    };
  }
  if (
    typeof draft.result !== "string" ||
    !criterionResultAllowed(
      capability.criterionKind!,
      draft.result as Screen02CriterionFindingResult,
    )
  ) {
    codes.push("invalid-criterion-result");
  }
  const narrativeCode = validateNarrative(draft.reason);
  if (narrativeCode) codes.push(narrativeCode);
  const evidence = validateEvidenceSourceIds(
    draft.evidenceSourceIds,
    new Set(capability.allowedEvidenceSourceIds),
    draft.result === "unclear",
  );
  if (evidence.code) codes.push(evidence.code);
  if (codes.length > 0) {
    return {
      normalizedDraft: {},
      acceptedPartIds: [] as string[],
      failures: [{ partId, codes }],
    };
  }
  const normalizedDraft: NormalizedCriterionDraft = {
    result: draft.result as Screen02CriterionFindingResult,
    reason: (draft.reason as string).trim(),
    evidenceSourceIds: evidence.value!,
  };
  return { normalizedDraft, acceptedPartIds: [partId], failures: [] };
}

function normalizeDiscoveryPlanDraft(
  draft: unknown,
  capability: Extract<
    Screen02FindAssessmentCapability,
    { mode: "find-discovery-plan" }
  >,
) {
  try {
    const normalizedDraft = normalizeScreen02FindDiscoveryQueryPlanDraft(draft);
    return {
      normalizedDraft,
      acceptedPartIds: [...capability.requestedPartIds],
      failures: [] as Screen02AssessmentFailure[],
    };
  } catch {
    return {
      normalizedDraft: {},
      acceptedPartIds: [] as string[],
      failures: capability.requestedPartIds.map((partId) => ({
        partId,
        codes: ["invalid-discovery-plan"],
      })),
    };
  }
}

function normalizeDraft(
  draft: unknown,
  capability: Screen02FindAssessmentCapability,
) {
  if (capability.mode === "find-discovery-plan") {
    return normalizeDiscoveryPlanDraft(draft, capability);
  }
  return capability.mode === "find-candidate"
    ? normalizeCandidateDraft(draft, capability)
    : normalizeCriterionDraft(draft, capability);
}

function parseSubmission(value: unknown): Screen02FindDraftSubmission {
  const exactLegacyRoot = isRecord(value) &&
    exactKeys(value, ["schemaVersion", "capabilityToken", "requestId", "draft"]);
  const exactOrientationRoot = isRecord(value) &&
    exactKeys(value, [
      "schemaVersion",
      "capabilityToken",
      "requestId",
      "draft",
      "orientation",
    ]);
  if (
    !isRecord(value) ||
    (!exactLegacyRoot && !exactOrientationRoot) ||
    value.schemaVersion !== SCREEN_02_FIND_DRAFT_SUBMISSION_SCHEMA_VERSION ||
    typeof value.capabilityToken !== "string" ||
    value.capabilityToken.length < 1 ||
    value.capabilityToken.length > MAX_SIGNED_TOKEN_CHARACTERS
  ) {
    throw new Error("Screen 2 Find model submission failed its strict root contract.");
  }
  return {
    schemaVersion: SCREEN_02_FIND_DRAFT_SUBMISSION_SCHEMA_VERSION,
    capabilityToken: value.capabilityToken,
    requestId: requireIdentifier(value.requestId, "requestId"),
    draft: value.draft,
    ...(exactOrientationRoot ? { orientation: value.orientation } : {}),
  };
}

function validateFailures(
  value: unknown,
  capability: Screen02FindAssessmentCapability,
) {
  if (!Array.isArray(value) || value.length > capability.requestedPartIds.length) {
    throw new Error("Screen 2 Find receipt validation failures are malformed.");
  }
  const allowedPartIds = new Set(capability.requestedPartIds);
  const failures: Screen02AssessmentFailure[] = [];
  for (const failure of value) {
    if (
      !isRecord(failure) ||
      !exactKeys(failure, ["partId", "codes"]) ||
      typeof failure.partId !== "string" ||
      !allowedPartIds.has(failure.partId) ||
      !Array.isArray(failure.codes) ||
      failure.codes.length < 1 ||
      failure.codes.length > 10 ||
      failure.codes.some(
        (code) =>
          typeof code !== "string" ||
          !/^[a-z0-9][a-z0-9-]{0,79}$/.test(code),
      ) ||
      new Set(failure.codes).size !== failure.codes.length
    ) {
      throw new Error("Screen 2 Find receipt validation failure is malformed.");
    }
    failures.push({
      partId: failure.partId,
      codes: [...failure.codes] as string[],
    });
  }
  if (new Set(failures.map((failure) => failure.partId)).size !== failures.length) {
    throw new Error("Screen 2 Find receipt repeats a failed part.");
  }
  return failures;
}

function parseSignedReceiptPayload(
  value: unknown,
): Screen02FindNormalizedReceiptPayload {
  if (
    !isRecord(value) ||
    (!exactKeys(value, legacySignedReceiptKeys) &&
      !exactKeys(value, signedReceiptKeys))
  ) {
    throw new Error("Screen 2 Find signed receipt has missing or unrecognized fields.");
  }
  if (value.schemaVersion !== SCREEN_02_FIND_SIGNED_RECEIPT_SCHEMA_VERSION) {
    throw new Error("Screen 2 Find signed receipt schema is unsupported.");
  }
  if (typeof value.keyId !== "string" || !KEY_ID_PATTERN.test(value.keyId)) {
    throw new Error("Screen 2 Find signed receipt key ID is invalid.");
  }
  const capability = parseCapability(value.capability);
  if (value.keyId !== capability.keyId) {
    throw new Error("Screen 2 Find receipt and capability key IDs differ.");
  }
  const receivedAtMs = requireCanonicalIsoTimestamp(value.receivedAt, "receivedAt");
  if (
    receivedAtMs < Date.parse(capability.issuedAt) ||
    receivedAtMs >= Date.parse(capability.expiresAt)
  ) {
    throw new Error("Screen 2 Find receipt was not issued during capability validity.");
  }
  const receiptId = requireIdentifier(value.receiptId, "receiptId");
  const failures = validateFailures(value.validationFailures, capability);
  const hostOrientation = Object.hasOwn(value, "hostOrientation")
    ? parseScreen02HostOrientationReceipt(
        value.hostOrientation,
        capability.allowedEvidenceSourceIds,
      )
    : prepareScreen02HostOrientationReceipt(undefined, {
        mode: capability.mode,
        allowedSourceIds: capability.allowedEvidenceSourceIds,
      });
  if (!isRecord(value.normalizedDraft)) {
    throw new Error("Screen 2 Find normalized receipt draft must be an object.");
  }
  const normalizedKeys = Object.keys(value.normalizedDraft);
  const allowedPartIds = new Set(capability.requestedPartIds);
  if (
    capability.mode === "find-candidate" &&
    normalizedKeys.some((key) => !allowedPartIds.has(key))
  ) {
    throw new Error("Screen 2 Find normalized receipt contains an unrequested part.");
  }
  if (
    capability.mode === "find-discovery-plan" &&
    normalizedKeys.length > 0 &&
    !exactKeys(value.normalizedDraft, ["queryTerms", "rationale"])
  ) {
    throw new Error("Screen 2 Find normalized planning receipt has the wrong shape.");
  }
  if (
    capability.mode === "find-criterion" &&
    normalizedKeys.length > 0 &&
    !exactKeys(value.normalizedDraft, ["result", "reason", "evidenceSourceIds"])
  ) {
    throw new Error("Screen 2 Find normalized criterion receipt has the wrong shape.");
  }
  const acceptedPartIds: string[] = [];
  let renormalizedDraft: unknown = {};
  let normalizedValidationFailed = false;
  const failedPartIds = new Set(failures.map((failure) => failure.partId));
  if (capability.mode === "find-candidate") {
    const reconstructed: Record<string, unknown> = {};
    for (const partId of capability.requestedPartIds) {
      if (failedPartIds.has(partId)) {
        if (Object.hasOwn(value.normalizedDraft, partId)) {
          normalizedValidationFailed = true;
          break;
        }
        continue;
      }
      if (!Object.hasOwn(value.normalizedDraft, partId)) {
        normalizedValidationFailed = true;
        break;
      }
      const parsed = normalizeCandidateDraft(
        { [partId]: value.normalizedDraft[partId] },
        { ...capability, requestedPartIds: [partId] },
      );
      if (parsed.failures.length > 0 || parsed.acceptedPartIds.length !== 1) {
        normalizedValidationFailed = true;
        break;
      }
      Object.assign(reconstructed, parsed.normalizedDraft);
      acceptedPartIds.push(partId);
    }
    renormalizedDraft = reconstructed;
  } else if (capability.mode === "find-discovery-plan") {
    if (failures.length > 0) {
      normalizedValidationFailed = normalizedKeys.length !== 0;
      renormalizedDraft = {};
    } else {
      const parsed = normalizeDiscoveryPlanDraft(
        value.normalizedDraft,
        capability,
      );
      normalizedValidationFailed = parsed.failures.length > 0;
      renormalizedDraft = parsed.normalizedDraft;
      acceptedPartIds.push(...parsed.acceptedPartIds);
    }
  } else if (failures.length > 0) {
    normalizedValidationFailed = normalizedKeys.length !== 0;
    renormalizedDraft = {};
  } else {
    const parsed = normalizeCriterionDraft(value.normalizedDraft, capability);
    normalizedValidationFailed = parsed.failures.length > 0;
    renormalizedDraft = parsed.normalizedDraft;
    acceptedPartIds.push(...parsed.acceptedPartIds);
  }
  if (
    normalizedValidationFailed ||
    serializeDeterministicJson(renormalizedDraft) !==
      serializeDeterministicJson(value.normalizedDraft)
  ) {
    throw new Error("Screen 2 Find signed receipt draft is not normalized.");
  }
  if (
    capability.requestedPartIds.some(
      (partId) =>
        !acceptedPartIds.includes(partId) && !failedPartIds.has(partId),
    ) ||
    acceptedPartIds.some((partId) => failedPartIds.has(partId))
  ) {
    throw new Error("Screen 2 Find receipt does not account for every requested part.");
  }
  return {
    schemaVersion: SCREEN_02_FIND_SIGNED_RECEIPT_SCHEMA_VERSION,
    keyId: value.keyId,
    receiptId,
    receivedAt: value.receivedAt as string,
    capability,
    normalizedDraft: clone(value.normalizedDraft),
    validationFailures: failures,
    hostOrientation,
  };
}

function coreReceiptFromPayload(payload: Screen02FindNormalizedReceiptPayload) {
  return createScreen02FindDraftReceipt({
    receiptId: payload.receiptId,
    kind: payload.capability.mode,
    receivedAt: payload.receivedAt,
    submissions: [
      {
        requestId: payload.capability.requestId,
        requestProof: payload.capability.requestProof,
        draft: payload.normalizedDraft,
      },
    ],
  });
}

function acceptedPartIdsFromPayload(payload: Screen02FindNormalizedReceiptPayload) {
  const failed = new Set(
    payload.validationFailures.map((failure) => failure.partId),
  );
  return payload.capability.requestedPartIds.filter(
    (partId) => !failed.has(partId),
  );
}

export async function createSignedScreen02FindNormalizedReceipt(
  input: {
    submission: unknown;
    receiptId: string;
    receivedAt: string;
  },
  config: Screen02FindSigningConfig,
): Promise<Screen02FindSignedReceipt> {
  const submission = parseSubmission(input.submission);
  const capability = await verifyScreen02FindAssessmentCapability(
    submission.capabilityToken,
    config,
    input.receivedAt,
  );
  if (submission.requestId !== capability.requestId) {
    throw new Error("Screen 2 Find submission targets a different request.");
  }
  const normalized = normalizeDraft(submission.draft, capability);
  const hostOrientation = prepareScreen02HostOrientationReceipt(
    submission.orientation,
    {
      mode: capability.mode,
      allowedSourceIds: capability.allowedEvidenceSourceIds,
    },
  );
  const payload = parseSignedReceiptPayload({
    schemaVersion: SCREEN_02_FIND_SIGNED_RECEIPT_SCHEMA_VERSION,
    keyId: config.keyId,
    receiptId: requireIdentifier(input.receiptId, "receiptId"),
    receivedAt: input.receivedAt,
    capability,
    normalizedDraft: normalized.normalizedDraft,
    validationFailures: normalized.failures,
    hostOrientation,
  });
  const receiptToken = await signToken(RECEIPT_TOKEN_PREFIX, payload, config);
  return deepFreeze({
    receiptToken,
    payload,
    receipt: coreReceiptFromPayload(payload),
    acceptedPartIds: [...normalized.acceptedPartIds],
    hostOrientation: payload.hostOrientation,
  });
}

export async function verifySignedScreen02FindNormalizedReceipt(
  receiptToken: unknown,
  config: Screen02FindSigningConfig,
): Promise<Screen02FindSignedReceipt> {
  const raw = await verifyToken(receiptToken, RECEIPT_TOKEN_PREFIX, config);
  const payload = parseSignedReceiptPayload(raw);
  if (payload.keyId !== config.keyId) {
    throw new Error("Screen 2 Find receipt uses an unavailable signing key.");
  }
  return deepFreeze({
    receiptToken: receiptToken as string,
    payload,
    receipt: coreReceiptFromPayload(payload),
    acceptedPartIds: acceptedPartIdsFromPayload(payload),
    hostOrientation: payload.hostOrientation,
  });
}

function sameStrings(left: readonly string[], right: readonly string[]) {
  return serializeDeterministicJson(left) === serializeDeterministicJson(right);
}

function requestTargetMatchesCapability(
  request: Screen02AssessmentRequest,
  capability: Screen02FindAssessmentCapability,
) {
  const target = request.target;
  if (
    target.mode !== capability.mode ||
    target.packetFingerprint !== capability.packetFingerprint
  ) {
    return false;
  }
  if (target.mode === "find-discovery-plan") {
    return (
      capability.mode === "find-discovery-plan" &&
      capability.candidateSnapshotId === null &&
      capability.candidateFingerprint === null &&
      capability.criterionId === null &&
      capability.criterionVersion === null &&
      capability.criterionKind === null
    );
  }
  if (target.mode === "find-candidate") {
    return (
      capability.mode === "find-candidate" &&
      target.candidateSnapshotId === capability.candidateSnapshotId &&
      target.candidateFingerprint === capability.candidateFingerprint
    );
  }
  if (target.mode === "find-criterion") {
    return (
      capability.mode === "find-criterion" &&
      target.candidateSnapshotId === capability.candidateSnapshotId &&
      target.candidateFingerprint === capability.candidateFingerprint &&
      target.criterionId === capability.criterionId &&
      target.criterionVersion === capability.criterionVersion
    );
  }
  return false;
}

export function inspectScreen02FindReceiptDisposition(
  state: Screen02FindState,
  verifiedReceipt: Screen02FindSignedReceipt,
): Screen02FindReceiptDisposition {
  const safe = requireScreen02FindState(state);
  const capability = verifiedReceipt.payload.capability;
  const request = safe.assessmentRequests.find(
    (item) => item.requestId === capability.requestId,
  ) ?? null;
  if (!request) {
    return {
      disposition: "unknown-request",
      reason: "The signed receipt request is not present in this Find run.",
      request,
    };
  }
  if (request.receiptIds.includes(verifiedReceipt.payload.receiptId)) {
    return {
      disposition: "duplicate",
      reason: "This signed receipt was already applied.",
      request,
    };
  }
  if (
    safe.runId !== capability.runId ||
    request.jobId !== capability.jobId ||
    request.rootRequestId !== capability.rootRequestId ||
    request.attempt !== capability.attempt ||
    !requestTargetMatchesCapability(request, capability) ||
    screen02FindRequestProof(request) !== capability.requestProof ||
    !sameStrings(request.requestedPartIds, capability.requestedPartIds)
  ) {
    return {
      disposition: "stale",
      reason: "The signed receipt does not match this immutable request target.",
      request,
    };
  }
  try {
    activeFindRequestPacket(safe, request);
  } catch {
    return {
      disposition: "stale",
      reason: "The signed receipt target is no longer active in this Find state.",
      request,
    };
  }
  if (request.status === "message-delivered") {
    return {
      disposition: "apply",
      reason:
        "The authenticated normalized receipt is ready for fixed-core application after canonical host delivery.",
      request,
    };
  }
  if (request.status === "prepared") {
    return {
      disposition: "awaiting-delivery",
      reason: "Host delivery must be recorded before this receipt can be applied.",
      request,
    };
  }
  if (request.status === "superseded") {
    return {
      disposition: "stale",
      reason: "A newer immutable target superseded this request.",
      request,
    };
  }
  return {
    disposition: "terminal",
    reason: `Request ${request.requestId} is already in terminal or retry-required state ${request.status}.`,
    request,
  };
}

export function screen02FindCapabilityDraftSchema(
  capability: Screen02FindAssessmentCapability,
) {
  if (capability.mode === "find-discovery-plan") {
    return {
      schemaVersion: SCREEN_02_FIND_DRAFT_SCHEMA_VERSION,
      requestedPartIds: [...capability.requestedPartIds],
      queryTerms: { minItems: 1, maxItems: 4, minLength: 2, maxLength: 80 },
      rationale: { minLength: 1, maxLength: 400 },
      allowedEvidenceSourceIds: [] as string[],
    };
  }
  return capability.mode === "find-candidate"
    ? {
        schemaVersion: SCREEN_02_FIND_DRAFT_SCHEMA_VERSION,
        requestedPartIds: [...capability.requestedPartIds],
        allowedCategories: {
          studyFit: [...screen02StudyFitCategories],
          outcomePathway: [...screen02OutcomePathwayCategories],
          measurementPotential: [...screen02MeasurementPotentialCategories],
        },
        allowedEvidenceSourceIds: [...capability.allowedEvidenceSourceIds],
      }
    : {
        schemaVersion: SCREEN_02_FIND_DRAFT_SCHEMA_VERSION,
        requestedPartIds: [...capability.requestedPartIds],
        allowedResults:
          capability.criterionKind === "do-not-show"
            ? ["violates", "does-not-violate", "unclear"]
            : ["meets", "does-not-meet", "unclear"],
        allowedEvidenceSourceIds: [...capability.allowedEvidenceSourceIds],
      };
}
