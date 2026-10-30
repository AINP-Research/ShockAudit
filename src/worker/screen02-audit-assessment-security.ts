import { serializeDeterministicJson } from "../core/screen02-service";
import {
  buildScreen02AuditAssessmentPacket,
  buildScreen02AuditDossierPacket,
  createScreen02AuditAssessmentDraftReceipt,
  createScreen02AuditDossierDraftReceipt,
  screen02AuditRequestProof,
  type Screen02AuditDraftReceipt as Screen02AuditWorkflowDraftReceipt,
} from "../core/screen02-audit-workflow";
import {
  fingerprintScreen02AuditDossier,
  fingerprintScreen02AuditMatchSet,
  fingerprintScreen02Confirmation,
  fingerprintScreen02WorkflowState,
  fingerprintScreen02WorkflowValue,
  requireScreen02AuditState,
} from "../core/screen02-workflow-state";
import {
  screen02AuditAssessmentPartIds,
  screen02AuditDossierPartIds,
  screen02AuditRelationships,
  screen02CoverageRelationCategories,
  screen02DateLeadStages,
  screen02MeasurementPotentialCategories,
  screen02OutcomePathwayCategories,
  screen02StudyFitCategories,
  type Screen02AssessmentFailure,
  type Screen02AssessmentRequest,
  type Screen02AuditAnchorRevision,
  type Screen02AuditDossier,
  type Screen02AuditMatchSet,
  type Screen02AuditPossibleMatch,
  type Screen02AuditRelationship,
  type Screen02AuditState,
  type Screen02ConfirmedIdentity,
  type Screen02DateLeadStage,
  type Screen02EventIdentity,
  type Screen02WorkflowSource,
} from "../core/screen02-workflow-types";
import {
  parseScreen02HostOrientationReceipt,
  prepareScreen02HostOrientationReceipt,
  type Screen02HostOrientationReceipt,
} from "./screen02-host-orientation-security";

export const SCREEN_02_AUDIT_DRAFT_SCHEMA_VERSION =
  "screen-02-audit-model-draft-v1" as const;
export const SCREEN_02_AUDIT_CAPABILITY_SCHEMA_VERSION =
  "screen-02-audit-assessment-capability-v1" as const;
export const SCREEN_02_AUDIT_DRAFT_SUBMISSION_SCHEMA_VERSION =
  "screen-02-audit-assessment-submission-v1" as const;
export const SCREEN_02_AUDIT_SIGNED_RECEIPT_SCHEMA_VERSION =
  "screen-02-audit-signed-normalized-receipt-v1" as const;
export const SCREEN_02_AUDIT_DEFAULT_CAPABILITY_TTL_MS = 120_000;
export const SCREEN_02_AUDIT_MAX_CAPABILITY_TTL_MS = 10 * 60_000;
export const SCREEN_02_AUDIT_MIN_SIGNING_KEY_BYTES = 32;

const CAPABILITY_TOKEN_PREFIX = "sa2a-capability-v1";
const RECEIPT_TOKEN_PREFIX = "sa2a-receipt-v1";
const MAX_SIGNED_TOKEN_CHARACTERS = 64 * 1024;
const MAX_KEY_BYTES = 4 * 1024;
const MAX_IDENTIFIER_CHARACTERS = 200;
const MAX_LIST_ITEMS = 12;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const FINGERPRINT_PATTERN = /^fnv1a64:[0-9a-f]{16}$/;
const KEY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const DATE_LEAD_PATTERN = /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/;
const forbiddenAssessmentClaimPattern =
  /\b(?:p[- ]?value|statistical(?:ly)? significant|effect estimate|realized outcome|observed (?:effect|outcome)|proves? causality|causal validity|causally valid|as-if random|exogeneity|exogenous(?:ly)?(?: assignment)?|random assignment|legally verified|verified legal (?:status|coverage|eligibility)|definitively covered|confirmed operative date)\b/i;

export function screen02AuditAssessmentNarrativeHasForbiddenClaim(
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
  "anchorRevisionId",
  "anchorRevisionFingerprint",
  "matchSetSnapshotId",
  "matchSetFingerprint",
  "matchSnapshotId",
  "identitySnapshotId",
  "matchFingerprint",
  "dossierSnapshotId",
  "dossierFingerprint",
  "confirmationSnapshotId",
  "confirmationFingerprint",
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

export type Screen02AuditSigningConfig = {
  keyId: string;
  key: string | Uint8Array;
};

export type Screen02AuditAssessmentCapability = {
  schemaVersion: typeof SCREEN_02_AUDIT_CAPABILITY_SCHEMA_VERSION;
  keyId: string;
  capabilityId: string;
  runId: string;
  stateRevision: number;
  stateFingerprint: string;
  requestId: string;
  jobId: string;
  rootRequestId: string;
  mode: "audit-dossier" | "audit-confirmed-event";
  attempt: 1 | 2 | 3;
  packetFingerprint: string;
  anchorRevisionId: string;
  anchorRevisionFingerprint: string;
  matchSetSnapshotId: string;
  matchSetFingerprint: string;
  matchSnapshotId: string;
  identitySnapshotId: string;
  matchFingerprint: string;
  dossierSnapshotId: string | null;
  dossierFingerprint: string | null;
  confirmationSnapshotId: string | null;
  confirmationFingerprint: string | null;
  requestProof: string;
  requestedPartIds: string[];
  allowedEvidenceSourceIds: string[];
  issuedAt: string;
  expiresAt: string;
};

/**
 * Pure model-facing boundary shared by signed development receipts and the
 * production ChatGPT-host receipt path. Model drafts consistently cite
 * `evidenceSourceIds`; dossier citations are converted here to the canonical
 * core `sourceIds` representation only after exact shape, source membership,
 * narrative, and safety validation succeeds.
 */
export type Screen02AuditModelDraftContract = {
  mode: "audit-dossier" | "audit-confirmed-event";
  requestedPartIds: readonly string[];
  allowedEvidenceSourceIds: readonly string[];
};

export type Screen02AuditModelDraftNormalization = {
  normalizedDraft: Record<string, unknown>;
  acceptedPartIds: string[];
  failures: Screen02AssessmentFailure[];
};

export type Screen02AuditDossierSourcePacket =
  ReturnType<typeof buildScreen02AuditDossierPacket> & {
    mode: "audit-dossier";
  };

export type Screen02AuditConfirmedEventSourcePacket =
  ReturnType<typeof buildScreen02AuditAssessmentPacket> & {
    mode: "audit-confirmed-event";
  };

export type Screen02AuditAssessmentSourcePacket =
  | Screen02AuditDossierSourcePacket
  | Screen02AuditConfirmedEventSourcePacket;

export type Screen02AuditCapabilityIssueResult = {
  capability: Screen02AuditAssessmentCapability;
  capabilityToken: string;
  sourcePacket: Screen02AuditAssessmentSourcePacket;
};

export type Screen02AuditDraftSubmission = {
  schemaVersion: typeof SCREEN_02_AUDIT_DRAFT_SUBMISSION_SCHEMA_VERSION;
  capabilityToken: string;
  requestId: string;
  draft: unknown;
  orientation?: unknown;
};

export type Screen02AuditNormalizedReceiptPayload = {
  schemaVersion: typeof SCREEN_02_AUDIT_SIGNED_RECEIPT_SCHEMA_VERSION;
  keyId: string;
  receiptId: string;
  receivedAt: string;
  capability: Screen02AuditAssessmentCapability;
  normalizedDraft: Record<string, unknown>;
  validationFailures: Screen02AssessmentFailure[];
  hostOrientation: Screen02HostOrientationReceipt;
};

/**
 * Canonical receipt shape consumed by the Stage 4 core workflow adapter. The
 * signed payload, rather than model input, is the authoritative draft source.
 */
export type Screen02AuditCoreDraftReceipt =
  Screen02AuditWorkflowDraftReceipt;

export type Screen02AuditSignedReceipt = {
  receiptToken: string;
  payload: Screen02AuditNormalizedReceiptPayload;
  receipt: Screen02AuditCoreDraftReceipt;
  acceptedPartIds: string[];
  hostOrientation: Screen02HostOrientationReceipt;
};

export type Screen02AuditReceiptDisposition =
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

type ActiveAuditPacket = {
  request: Screen02AssessmentRequest;
  anchorRevision: Screen02AuditAnchorRevision;
  matchSet: Screen02AuditMatchSet;
  match: Screen02AuditPossibleMatch;
  sources: Screen02WorkflowSource[];
  dossier: Screen02AuditDossier | null;
  confirmation: Screen02ConfirmedIdentity | null;
  packetFingerprint: string;
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

function requireNullableIdentifier(value: unknown, label: string) {
  return value === null ? null : requireIdentifier(value, label);
}

function requireCanonicalIsoTimestamp(value: unknown, label: string) {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a canonical ISO timestamp.`);
  }
  const milliseconds = Date.parse(value);
  if (
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString() !== value
  ) {
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

function requireNullableFingerprint(value: unknown, label: string) {
  return value === null ? null : requireFingerprint(value, label);
}

function uniqueBoundedStrings(
  value: unknown,
  label: string,
  maximum: number,
  allowEmpty = false,
) {
  if (
    !Array.isArray(value) ||
    (!allowEmpty && value.length < 1) ||
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

function signingKeyBytes(config: Screen02AuditSigningConfig) {
  if (!config || !KEY_ID_PATTERN.test(config.keyId)) {
    throw new Error("Screen 2 Audit signing key ID is missing or invalid.");
  }
  const bytes =
    typeof config.key === "string"
      ? new TextEncoder().encode(config.key)
      : config.key instanceof Uint8Array
        ? config.key.slice()
        : new Uint8Array();
  if (
    bytes.byteLength < SCREEN_02_AUDIT_MIN_SIGNING_KEY_BYTES ||
    bytes.byteLength > MAX_KEY_BYTES
  ) {
    throw new Error(
      `Screen 2 Audit signing key must contain ${SCREEN_02_AUDIT_MIN_SIGNING_KEY_BYTES}–${MAX_KEY_BYTES} bytes.`,
    );
  }
  return bytes;
}

export function assertScreen02AuditSigningConfig(
  config: Screen02AuditSigningConfig,
) {
  signingKeyBytes(config);
}

async function importHmacKey(
  config: Screen02AuditSigningConfig,
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
  const bytes = Uint8Array.from(binary, (character) =>
    character.charCodeAt(0),
  );
  if (bytesToBase64Url(bytes) !== value) {
    throw new Error(`${label} is not canonical base64url.`);
  }
  return bytes;
}

async function signToken(
  prefix: string,
  payload: unknown,
  config: Screen02AuditSigningConfig,
) {
  const canonical = serializeDeterministicJson(payload);
  const payloadBytes = new TextEncoder().encode(canonical);
  const key = await importHmacKey(config, "sign");
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, payloadBytes),
  );
  const token = `${prefix}.${bytesToBase64Url(payloadBytes)}.${bytesToBase64Url(signature)}`;
  if (token.length > MAX_SIGNED_TOKEN_CHARACTERS) {
    throw new Error("Screen 2 Audit signed token exceeds its transport limit.");
  }
  return token;
}

async function verifyToken(
  token: unknown,
  prefix: string,
  config: Screen02AuditSigningConfig,
) {
  signingKeyBytes(config);
  if (
    typeof token !== "string" ||
    token.length < 1 ||
    token.length > MAX_SIGNED_TOKEN_CHARACTERS
  ) {
    throw new Error("Screen 2 Audit signed token is missing or oversized.");
  }
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== prefix) {
    throw new Error("Screen 2 Audit signed token has the wrong type.");
  }
  const payloadBytes = base64UrlToBytes(parts[1]!, "Signed token payload");
  const signatureBytes = base64UrlToBytes(
    parts[2]!,
    "Signed token signature",
  );
  if (signatureBytes.byteLength !== 32) {
    throw new Error("Screen 2 Audit signed token signature is malformed.");
  }
  const key = await importHmacKey(config, "verify");
  if (
    !(await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      payloadBytes,
    ))
  ) {
    throw new Error("Screen 2 Audit signed token authentication failed.");
  }
  let canonical: string;
  try {
    canonical = new TextDecoder("utf-8", { fatal: true }).decode(payloadBytes);
  } catch {
    throw new Error("Screen 2 Audit signed token is not UTF-8.");
  }
  let payload: unknown;
  try {
    payload = JSON.parse(canonical) as unknown;
  } catch {
    throw new Error("Screen 2 Audit signed token is not JSON.");
  }
  if (serializeDeterministicJson(payload) !== canonical) {
    throw new Error("Screen 2 Audit signed token payload is not canonical JSON.");
  }
  return payload;
}

function fingerprintAuditMatch(value: Screen02AuditPossibleMatch) {
  const { matchFingerprint: _fingerprint, ...snapshot } = value;
  return fingerprintScreen02WorkflowValue(snapshot);
}

function activeAnchorRevision(state: Screen02AuditState) {
  return state.anchor.revisions.find(
    (item) => item.anchorRevisionId === state.anchor.activeRevisionId,
  );
}

function activeAuditRequestPacket(
  state: Screen02AuditState,
  request: Screen02AssessmentRequest,
): ActiveAuditPacket {
  if (
    request.target.mode !== "audit-dossier" &&
    request.target.mode !== "audit-confirmed-event"
  ) {
    throw new Error("Screen 2 Audit capability cannot target a Find request.");
  }
  const target = request.target;
  const anchorRevision = activeAnchorRevision(state);
  const matchSet = state.matchSets.find(
    (item) =>
      item.matchSetSnapshotId === state.activeMatchSetSnapshotId &&
      item.status === "active",
  );
  const match = state.possibleMatches.find(
    (item) =>
      item.matchSnapshotId === target.matchSnapshotId &&
      item.identitySnapshotId === target.identitySnapshotId,
  );
  if (
    !anchorRevision ||
    !matchSet ||
    !match ||
    matchSet.anchorRevisionId !== anchorRevision.anchorRevisionId ||
    !matchSet.possibleMatchSnapshotIds.includes(match.matchSnapshotId) ||
    match.matchSetSnapshotId !== matchSet.matchSetSnapshotId ||
    match.anchorRevisionId !== anchorRevision.anchorRevisionId ||
    target.anchorRevisionId !== anchorRevision.anchorRevisionId ||
    target.anchorRevisionFingerprint !==
      fingerprintScreen02WorkflowValue(anchorRevision) ||
    target.matchSetSnapshotId !== matchSet.matchSetSnapshotId ||
    target.matchSetFingerprint !== fingerprintScreen02AuditMatchSet(matchSet) ||
    target.matchFingerprint !== fingerprintAuditMatch(match)
  ) {
    throw new Error(
      "Screen 2 Audit request no longer targets the active anchor, match set, and identity.",
    );
  }

  let dossier: Screen02AuditDossier | null = null;
  let confirmation: Screen02ConfirmedIdentity | null = null;
  let allowedSourceIds = [...match.sourceIds];
  if (target.mode === "audit-dossier") {
    if (state.confirmedIdentity !== null) {
      throw new Error(
        "Screen 2 Audit dossier capability cannot be issued after any identity confirmation.",
      );
    }
  } else {
    confirmation = state.confirmedIdentity;
    dossier = state.dossiers.find(
      (item) => item.dossierSnapshotId === target.dossierSnapshotId,
    ) ?? null;
    if (
      !confirmation ||
      !dossier ||
      dossier.status !== "completed" ||
      confirmation.identitySnapshotId !== match.identitySnapshotId ||
      confirmation.matchSnapshotId !== match.matchSnapshotId ||
      confirmation.matchSetSnapshotId !== matchSet.matchSetSnapshotId ||
      confirmation.anchorRevisionId !== anchorRevision.anchorRevisionId ||
      confirmation.dossierSnapshotId !== dossier.dossierSnapshotId ||
      target.dossierSnapshotId !== dossier.dossierSnapshotId ||
      target.dossierFingerprint !== fingerprintScreen02AuditDossier(dossier) ||
      target.confirmationSnapshotId !== confirmation.confirmationSnapshotId ||
      target.confirmationFingerprint !==
        fingerprintScreen02Confirmation(confirmation)
    ) {
      throw new Error(
        "Screen 2 Audit confirmed-event request lacks its exact active dossier and confirmation snapshots.",
      );
    }
    allowedSourceIds = [...new Set([...match.sourceIds, ...dossier.sourceIds])];
  }

  const sourceById = new Map(state.sources.map((source) => [source.id, source]));
  if (allowedSourceIds.some((sourceId) => !sourceById.has(sourceId))) {
    throw new Error("Screen 2 Audit source packet is incomplete.");
  }
  const sources = state.sources.filter((source) =>
    allowedSourceIds.includes(source.id),
  );
  const common = {
    anchorRevisionId: anchorRevision.anchorRevisionId,
    anchorRevisionFingerprint: fingerprintScreen02WorkflowValue(anchorRevision),
    matchSetSnapshotId: matchSet.matchSetSnapshotId,
    matchSetFingerprint: matchSet.matchSetFingerprint,
    matchSnapshotId: match.matchSnapshotId,
    identitySnapshotId: match.identitySnapshotId,
    matchFingerprint: match.matchFingerprint,
  };
  const packetFingerprint = fingerprintScreen02WorkflowValue({
    mode: target.mode,
    screen01Fingerprint: state.screen01Fingerprint,
    anchorRevision,
    matchSet: common,
    match,
    ...(dossier && confirmation ? { dossier, confirmation } : {}),
    sources,
  });
  if (packetFingerprint !== target.packetFingerprint) {
    throw new Error(
      "Screen 2 Audit source packet fingerprint does not match its request.",
    );
  }
  return {
    request,
    anchorRevision,
    matchSet,
    match,
    sources,
    dossier,
    confirmation,
    packetFingerprint,
  };
}

export function buildScreen02AuditAssessmentSourcePacket(
  state: Screen02AuditState,
  requestId: string,
): Screen02AuditAssessmentSourcePacket {
  const safe = requireScreen02AuditState(state);
  const request = safe.assessmentRequests.find(
    (item) => item.requestId === requestId,
  );
  if (!request) {
    throw new Error("Screen 2 Audit assessment request was not found.");
  }
  const packet = activeAuditRequestPacket(safe, request);
  if (request.target.mode === "audit-dossier") {
    const corePacket = buildScreen02AuditDossierPacket(safe, request.requestId);
    if (
      corePacket.packetFingerprint !== packet.packetFingerprint ||
      corePacket.requestProof !== screen02AuditRequestProof(request)
    ) {
      throw new Error("Screen 2 Audit dossier packet drifted from fixed core.");
    }
    return deepFreeze({
      ...clone(corePacket),
      mode: "audit-dossier" as const,
    });
  }
  const corePacket = buildScreen02AuditAssessmentPacket(safe, request.requestId);
  if (
    corePacket.packetFingerprint !== packet.packetFingerprint ||
    corePacket.requestProof !== screen02AuditRequestProof(request)
  ) {
    throw new Error(
      "Screen 2 Audit confirmed-event packet drifted from fixed core.",
    );
  }
  return deepFreeze({
    ...clone(corePacket),
    mode: "audit-confirmed-event" as const,
  });
}

function parseCapability(value: unknown): Screen02AuditAssessmentCapability {
  if (!isRecord(value) || !exactKeys(value, capabilityKeys)) {
    throw new Error(
      "Screen 2 Audit capability has missing or unrecognized fields.",
    );
  }
  if (value.schemaVersion !== SCREEN_02_AUDIT_CAPABILITY_SCHEMA_VERSION) {
    throw new Error("Screen 2 Audit capability schema is unsupported.");
  }
  if (typeof value.keyId !== "string" || !KEY_ID_PATTERN.test(value.keyId)) {
    throw new Error("Screen 2 Audit capability key ID is invalid.");
  }
  const mode = value.mode;
  if (mode !== "audit-dossier" && mode !== "audit-confirmed-event") {
    throw new Error("Screen 2 Audit capability mode is invalid.");
  }
  if (
    !Number.isSafeInteger(value.stateRevision) ||
    (value.stateRevision as number) < 0
  ) {
    throw new Error("Screen 2 Audit capability state revision is invalid.");
  }
  if (![1, 2, 3].includes(value.attempt as number)) {
    throw new Error("Screen 2 Audit capability attempt is invalid.");
  }
  const requestedPartIds = uniqueBoundedStrings(
    value.requestedPartIds,
    "requestedPartIds",
    mode === "audit-dossier"
      ? screen02AuditDossierPartIds.length
      : screen02AuditAssessmentPartIds.length,
  );
  const allowedParts = new Set<string>(
    mode === "audit-dossier"
      ? screen02AuditDossierPartIds
      : screen02AuditAssessmentPartIds,
  );
  if (requestedPartIds.some((partId) => !allowedParts.has(partId))) {
    throw new Error("Screen 2 Audit capability requests an invalid part.");
  }
  const dossierSnapshotId = requireNullableIdentifier(
    value.dossierSnapshotId,
    "dossierSnapshotId",
  );
  const dossierFingerprint = requireNullableFingerprint(
    value.dossierFingerprint,
    "dossierFingerprint",
  );
  const confirmationSnapshotId = requireNullableIdentifier(
    value.confirmationSnapshotId,
    "confirmationSnapshotId",
  );
  const confirmationFingerprint = requireNullableFingerprint(
    value.confirmationFingerprint,
    "confirmationFingerprint",
  );
  if (
    (mode === "audit-dossier" &&
      (dossierSnapshotId !== null ||
        dossierFingerprint !== null ||
        confirmationSnapshotId !== null ||
        confirmationFingerprint !== null)) ||
    (mode === "audit-confirmed-event" &&
      (!dossierSnapshotId ||
        !dossierFingerprint ||
        !confirmationSnapshotId ||
        !confirmationFingerprint))
  ) {
    throw new Error(
      "Screen 2 Audit capability confirmation lineage does not match its mode.",
    );
  }
  const issuedAtMs = requireCanonicalIsoTimestamp(value.issuedAt, "issuedAt");
  const expiresAtMs = requireCanonicalIsoTimestamp(value.expiresAt, "expiresAt");
  if (
    expiresAtMs <= issuedAtMs ||
    expiresAtMs - issuedAtMs > SCREEN_02_AUDIT_MAX_CAPABILITY_TTL_MS
  ) {
    throw new Error("Screen 2 Audit capability lifetime is invalid.");
  }
  return {
    schemaVersion: SCREEN_02_AUDIT_CAPABILITY_SCHEMA_VERSION,
    keyId: value.keyId,
    capabilityId: requireIdentifier(value.capabilityId, "capabilityId"),
    runId: requireIdentifier(value.runId, "runId"),
    stateRevision: value.stateRevision as number,
    stateFingerprint: requireFingerprint(
      value.stateFingerprint,
      "stateFingerprint",
    ),
    requestId: requireIdentifier(value.requestId, "requestId"),
    jobId: requireIdentifier(value.jobId, "jobId"),
    rootRequestId: requireIdentifier(value.rootRequestId, "rootRequestId"),
    mode,
    attempt: value.attempt as 1 | 2 | 3,
    packetFingerprint: requireFingerprint(
      value.packetFingerprint,
      "packetFingerprint",
    ),
    anchorRevisionId: requireIdentifier(
      value.anchorRevisionId,
      "anchorRevisionId",
    ),
    anchorRevisionFingerprint: requireFingerprint(
      value.anchorRevisionFingerprint,
      "anchorRevisionFingerprint",
    ),
    matchSetSnapshotId: requireIdentifier(
      value.matchSetSnapshotId,
      "matchSetSnapshotId",
    ),
    matchSetFingerprint: requireFingerprint(
      value.matchSetFingerprint,
      "matchSetFingerprint",
    ),
    matchSnapshotId: requireIdentifier(value.matchSnapshotId, "matchSnapshotId"),
    identitySnapshotId: requireIdentifier(
      value.identitySnapshotId,
      "identitySnapshotId",
    ),
    matchFingerprint: requireFingerprint(
      value.matchFingerprint,
      "matchFingerprint",
    ),
    dossierSnapshotId,
    dossierFingerprint,
    confirmationSnapshotId,
    confirmationFingerprint,
    requestProof: requireFingerprint(value.requestProof, "requestProof"),
    requestedPartIds,
    allowedEvidenceSourceIds: uniqueBoundedStrings(
      value.allowedEvidenceSourceIds,
      "allowedEvidenceSourceIds",
      50,
    ),
    issuedAt: value.issuedAt as string,
    expiresAt: value.expiresAt as string,
  };
}

export async function createScreen02AuditAssessmentCapability(
  input: {
    state: Screen02AuditState;
    requestId: string;
    capabilityId: string;
    issuedAt: string;
    expiresAt?: string;
  },
  config: Screen02AuditSigningConfig,
): Promise<Screen02AuditCapabilityIssueResult> {
  signingKeyBytes(config);
  const safe = requireScreen02AuditState(input.state);
  const request = safe.assessmentRequests.find(
    (item) => item.requestId === input.requestId,
  );
  if (
    !request ||
    (request.target.mode !== "audit-dossier" &&
      request.target.mode !== "audit-confirmed-event")
  ) {
    throw new Error("Screen 2 Audit capability request was not found.");
  }
  if (request.status !== "prepared" && request.status !== "message-delivered") {
    throw new Error(
      "Screen 2 Audit capability can only bind an awaiting model request.",
    );
  }
  const sourcePacket = buildScreen02AuditAssessmentSourcePacket(
    safe,
    request.requestId,
  );
  const issuedAtMs = requireCanonicalIsoTimestamp(input.issuedAt, "issuedAt");
  const expiresAt =
    input.expiresAt ??
    new Date(
      issuedAtMs + SCREEN_02_AUDIT_DEFAULT_CAPABILITY_TTL_MS,
    ).toISOString();
  const expiresAtMs = requireCanonicalIsoTimestamp(expiresAt, "expiresAt");
  if (
    expiresAtMs <= issuedAtMs ||
    expiresAtMs - issuedAtMs > SCREEN_02_AUDIT_MAX_CAPABILITY_TTL_MS
  ) {
    throw new Error("Screen 2 Audit capability lifetime is invalid.");
  }
  const target = request.target;
  const capability = parseCapability({
    schemaVersion: SCREEN_02_AUDIT_CAPABILITY_SCHEMA_VERSION,
    keyId: config.keyId,
    capabilityId: requireIdentifier(input.capabilityId, "capabilityId"),
    runId: safe.runId,
    stateRevision: safe.revision,
    stateFingerprint: fingerprintScreen02WorkflowState(safe),
    requestId: request.requestId,
    jobId: request.jobId,
    rootRequestId: request.rootRequestId,
    mode: target.mode,
    attempt: request.attempt,
    packetFingerprint: target.packetFingerprint,
    anchorRevisionId: target.anchorRevisionId,
    anchorRevisionFingerprint: target.anchorRevisionFingerprint,
    matchSetSnapshotId: target.matchSetSnapshotId,
    matchSetFingerprint: target.matchSetFingerprint,
    matchSnapshotId: target.matchSnapshotId,
    identitySnapshotId: target.identitySnapshotId,
    matchFingerprint: target.matchFingerprint,
    dossierSnapshotId:
      target.mode === "audit-confirmed-event"
        ? target.dossierSnapshotId
        : null,
    dossierFingerprint:
      target.mode === "audit-confirmed-event"
        ? target.dossierFingerprint
        : null,
    confirmationSnapshotId:
      target.mode === "audit-confirmed-event"
        ? target.confirmationSnapshotId
        : null,
    confirmationFingerprint:
      target.mode === "audit-confirmed-event"
        ? target.confirmationFingerprint
        : null,
    requestProof: screen02AuditRequestProof(request),
    requestedPartIds: [...request.requestedPartIds],
    allowedEvidenceSourceIds: sourcePacket.sources.map((source) => source.id),
    issuedAt: input.issuedAt,
    expiresAt,
  });
  return {
    capability: deepFreeze(capability),
    capabilityToken: await signToken(
      CAPABILITY_TOKEN_PREFIX,
      capability,
      config,
    ),
    sourcePacket,
  };
}

export async function verifyScreen02AuditAssessmentCapability(
  capabilityToken: unknown,
  config: Screen02AuditSigningConfig,
  observedAt: string,
) {
  const capability = parseCapability(
    await verifyToken(capabilityToken, CAPABILITY_TOKEN_PREFIX, config),
  );
  if (capability.keyId !== config.keyId) {
    throw new Error(
      "Screen 2 Audit capability uses an unavailable signing key.",
    );
  }
  const observedAtMs = requireCanonicalIsoTimestamp(observedAt, "observedAt");
  if (
    observedAtMs < Date.parse(capability.issuedAt) ||
    observedAtMs >= Date.parse(capability.expiresAt)
  ) {
    throw new Error(
      "Screen 2 Audit capability is not active at the observed time.",
    );
  }
  return deepFreeze(capability);
}

function validateNarrative(value: unknown, minimum = 30, maximum = 800) {
  if (typeof value !== "string") return "narrative-not-text";
  const trimmed = value.trim();
  if (trimmed.length < minimum || trimmed.length > maximum) {
    return "narrative-length";
  }
  if (screen02AuditAssessmentNarrativeHasForbiddenClaim(trimmed)) {
    return "forbidden-outcome-causal-or-verified-claim";
  }
  return null;
}

function validateEvidenceSourceIds(
  value: unknown,
  allowed: ReadonlySet<string>,
  allowEmpty: boolean,
) {
  try {
    const ids = uniqueBoundedStrings(
      value,
      "evidenceSourceIds",
      50,
      allowEmpty,
    );
    if (ids.some((sourceId) => !allowed.has(sourceId))) {
      return { value: null, code: "evidence-outside-source-packet" } as const;
    }
    return { value: ids, code: null } as const;
  } catch {
    return { value: null, code: "invalid-evidence-source-ids" } as const;
  }
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

function normalizeStringList(
  value: unknown,
  minimumItems: number,
  maximumItems: number,
  minimumLength = 20,
  maximumLength = 500,
) {
  if (
    !Array.isArray(value) ||
    value.length < minimumItems ||
    value.length > maximumItems ||
    value.some((item) => typeof item !== "string")
  ) {
    return { value: null, codes: ["invalid-list-shape"] };
  }
  const normalized = (value as string[]).map((item) => item.trim());
  const codes: string[] = [];
  for (const item of normalized) {
    const code = validateNarrative(item, minimumLength, maximumLength);
    if (code && !codes.includes(code)) codes.push(code);
  }
  if (new Set(normalized).size !== normalized.length) {
    codes.push("duplicate-list-item");
  }
  return codes.length > 0
    ? { value: null, codes }
    : { value: normalized, codes };
}

function normalizeClaim(
  value: unknown,
  capability: Screen02AuditModelDraftContract,
) {
  const codes: string[] = [];
  if (
    !isRecord(value) ||
    !exactKeys(value, ["text", "evidenceSourceIds", "uncertainty"])
  ) {
    return { value: null, codes: ["invalid-claim-shape"] };
  }
  const textCode = validateNarrative(value.text);
  if (textCode) codes.push(textCode);
  if (
    value.uncertainty !== null &&
    (typeof value.uncertainty !== "string" ||
      validateNarrative(value.uncertainty, 10, 500))
  ) {
    codes.push("invalid-claim-uncertainty");
  }
  const evidence = validateEvidenceSourceIds(
    value.evidenceSourceIds,
    new Set(capability.allowedEvidenceSourceIds),
    false,
  );
  if (evidence.code) codes.push(evidence.code);
  if (codes.length > 0) return { value: null, codes };
  return {
    value: {
      text: (value.text as string).trim(),
      sourceIds: evidence.value!,
      uncertainty:
        value.uncertainty === null
          ? null
          : (value.uncertainty as string).trim(),
    },
    codes,
  };
}

function normalizeClaimList(
  value: unknown,
  capability: Screen02AuditModelDraftContract,
  minimumItems: number,
  maximumItems = MAX_LIST_ITEMS,
) {
  if (
    !Array.isArray(value) ||
    value.length < minimumItems ||
    value.length > maximumItems
  ) {
    return { value: null, codes: ["invalid-claim-list-shape"] };
  }
  const normalized: unknown[] = [];
  const codes: string[] = [];
  value.forEach((item) => {
    const claim = normalizeClaim(item, capability);
    if (claim.value) normalized.push(claim.value);
    for (const code of claim.codes) {
      if (!codes.includes(code)) codes.push(code);
    }
  });
  return codes.length > 0
    ? { value: null, codes }
    : { value: normalized, codes };
}

function normalizeTimeline(
  value: unknown,
  capability: Screen02AuditModelDraftContract,
) {
  if (
    !Array.isArray(value) ||
    value.length > MAX_LIST_ITEMS
  ) {
    return { value: null, codes: ["invalid-timeline-shape"] };
  }
  const normalized: unknown[] = [];
  const codes: string[] = [];
  value.forEach((item, index) => {
    if (
      !isRecord(item) ||
      !exactKeys(item, [
        "date",
        "label",
        "stage",
        "evidenceSourceIds",
        "uncertainty",
      ])
    ) {
      if (!codes.includes("invalid-date-lead-shape")) {
        codes.push("invalid-date-lead-shape");
      }
      return;
    }
    const itemCodes: string[] = [];
    if (typeof item.date !== "string" || !DATE_LEAD_PATTERN.test(item.date)) {
      itemCodes.push("invalid-date-lead-date");
    }
    const labelCode = validateNarrative(item.label, 5, 200);
    if (labelCode) itemCodes.push(labelCode);
    if (!(screen02DateLeadStages as readonly unknown[]).includes(item.stage)) {
      itemCodes.push("invalid-date-lead-stage");
    }
    if (
      item.uncertainty !== null &&
      (typeof item.uncertainty !== "string" ||
        validateNarrative(item.uncertainty, 10, 500))
    ) {
      itemCodes.push("invalid-date-lead-uncertainty");
    }
    const evidence = validateEvidenceSourceIds(
      item.evidenceSourceIds,
      new Set(capability.allowedEvidenceSourceIds),
      false,
    );
    if (evidence.code) itemCodes.push(evidence.code);
    if (itemCodes.length === 0) {
      normalized.push({
        date: item.date,
        label: (item.label as string).trim(),
        stage: item.stage as Screen02DateLeadStage,
        sourceIds: evidence.value!,
        uncertainty:
          item.uncertainty === null
            ? null
            : (item.uncertainty as string).trim(),
      });
    }
    for (const code of itemCodes) {
      if (!codes.includes(code)) codes.push(code);
    }
  });
  return codes.length > 0
    ? { value: null, codes }
    : { value: normalized, codes };
}

function normalizeIdentity(value: unknown) {
  const keys = [
    "canonicalTitle",
    "commonNames",
    "formalIdentifier",
    "issuer",
    "issuingJurisdiction",
    "eventType",
    "status",
  ];
  if (!isRecord(value) || !exactKeys(value, keys)) return null;
  try {
    const canonicalTitle = requireIdentifier(
      value.canonicalTitle,
      "canonicalTitle",
    );
    const eventType = requireIdentifier(value.eventType, "eventType");
    const commonNames = uniqueBoundedStrings(
      value.commonNames,
      "commonNames",
      20,
      true,
    );
    for (const field of [
      "formalIdentifier",
      "issuer",
      "issuingJurisdiction",
      "status",
    ] as const) {
      if (
        value[field] !== null &&
        (typeof value[field] !== "string" ||
          (value[field] as string).trim() !== value[field] ||
          (value[field] as string).length < 1 ||
          (value[field] as string).length > MAX_IDENTIFIER_CHARACTERS)
      ) {
        return null;
      }
    }
    const identityText = [
      canonicalTitle,
      eventType,
      ...commonNames,
      value.formalIdentifier,
      value.issuer,
      value.issuingJurisdiction,
      value.status,
    ].filter((item): item is string => typeof item === "string");
    if (identityText.some((item) => forbiddenAssessmentClaimPattern.test(item))) {
      return null;
    }
    return {
      canonicalTitle,
      commonNames,
      formalIdentifier: value.formalIdentifier as string | null,
      issuer: value.issuer as string | null,
      issuingJurisdiction: value.issuingJurisdiction as string | null,
      eventType,
      status: value.status as string | null,
    } satisfies Screen02EventIdentity;
  } catch {
    return null;
  }
}

function normalizeRelatedVersions(
  value: unknown,
  capability: Screen02AuditModelDraftContract,
) {
  if (
    !Array.isArray(value) ||
    value.length > MAX_LIST_ITEMS
  ) {
    return { value: null, codes: ["invalid-related-versions-shape"] };
  }
  const normalized: unknown[] = [];
  const codes: string[] = [];
  for (const item of value) {
    if (
      !isRecord(item) ||
      !exactKeys(item, [
        "relationship",
        "identity",
        "evidenceSourceIds",
        "note",
      ])
    ) {
      codes.push("invalid-related-version-shape");
      continue;
    }
    const itemCodes: string[] = [];
    if (!(screen02AuditRelationships as readonly unknown[]).includes(item.relationship)) {
      itemCodes.push("invalid-related-version-relationship");
    }
    const identity = normalizeIdentity(item.identity);
    if (!identity) itemCodes.push("invalid-related-version-identity");
    const noteCode = validateNarrative(item.note, 20, 500);
    if (noteCode) itemCodes.push(noteCode);
    const evidence = validateEvidenceSourceIds(
      item.evidenceSourceIds,
      new Set(capability.allowedEvidenceSourceIds),
      false,
    );
    if (evidence.code) itemCodes.push(evidence.code);
    if (itemCodes.length === 0) {
      normalized.push({
        relationship: item.relationship as Screen02AuditRelationship,
        identity: identity!,
        sourceIds: evidence.value!,
        note: (item.note as string).trim(),
      });
    }
    for (const code of itemCodes) {
      if (!codes.includes(code)) codes.push(code);
    }
  }
  return codes.length > 0
    ? { value: null, codes }
    : { value: normalized, codes };
}

function normalizeDossierPart(
  partId: string,
  value: unknown,
  capability: Screen02AuditModelDraftContract,
) {
  if (
    partId === "atAGlance" ||
    partId === "whatChanged" ||
    partId === "broadCoverage" ||
    partId === "keyComponents"
  ) {
    return normalizeClaimList(
      value,
      capability,
      partId === "atAGlance" ? 1 : 0,
      partId === "atAGlance" ? 8 : MAX_LIST_ITEMS,
    );
  }
  if (partId === "whatHappened") {
    return normalizeClaim(value, capability);
  }
  if (partId === "timeline") return normalizeTimeline(value, capability);
  if (partId === "relatedVersions") {
    return normalizeRelatedVersions(value, capability);
  }
  if (partId === "unresolvedFacts") {
    return normalizeStringList(value, 1, MAX_LIST_ITEMS);
  }
  return { value: null, codes: ["invalid-dossier-part"] };
}

function normalizeConfirmedPart(
  partId: string,
  value: unknown,
  capability: Screen02AuditModelDraftContract,
) {
  const allowedSources = new Set(capability.allowedEvidenceSourceIds);
  if (partId === "studyFit") {
    return normalizeComponent(value, screen02StudyFitCategories, allowedSources);
  }
  if (partId === "outcomePathway") {
    return normalizeComponent(
      value,
      screen02OutcomePathwayCategories,
      allowedSources,
    );
  }
  if (partId === "coverageRelation") {
    return normalizeComponent(
      value,
      screen02CoverageRelationCategories,
      allowedSources,
    );
  }
  if (partId === "measurementPotential") {
    return normalizeComponent(
      value,
      screen02MeasurementPotentialCategories,
      allowedSources,
    );
  }
  if (partId === "mainConcern") {
    const code = validateNarrative(value);
    return code
      ? { value: null, codes: [code] }
      : { value: (value as string).trim(), codes: [] };
  }
  if (partId === "nextChecks") {
    return normalizeStringList(value, 1, 2);
  }
  return { value: null, codes: ["invalid-confirmed-assessment-part"] };
}

const dossierEvidenceGapPartIds = [
  "whatChanged",
  "timeline",
  "broadCoverage",
  "keyComponents",
  "relatedVersions",
] as const;

function normalizedEvidenceGap(value: string) {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hasExplicitDossierEvidenceGap(
  unresolvedFacts: readonly string[],
  partId: (typeof dossierEvidenceGapPartIds)[number],
) {
  const prefix = normalizedEvidenceGap(`Evidence gap — ${partId}:`);
  return unresolvedFacts.some((fact) => {
    const normalized = normalizedEvidenceGap(fact);
    return (
      normalized.startsWith(`${prefix} `) &&
      normalized.length > prefix.length + 1
    );
  });
}

function appendNormalizationFailure(
  failures: Screen02AssessmentFailure[],
  partId: string,
  code: string,
) {
  const existing = failures.find((failure) => failure.partId === partId);
  if (existing) {
    if (!existing.codes.includes(code)) existing.codes.push(code);
    return;
  }
  failures.push({ partId, codes: [code] });
}

export function normalizeScreen02AuditModelDraft(
  draft: unknown,
  capability: Screen02AuditModelDraftContract,
): Screen02AuditModelDraftNormalization {
  const acceptedPartIds: string[] = [];
  const failures: Screen02AssessmentFailure[] = [];
  const normalizedDraft: Record<string, unknown> = {};
  if (!isRecord(draft)) {
    return {
      normalizedDraft,
      acceptedPartIds,
      failures: capability.requestedPartIds.map((partId) => ({
        partId,
        codes: ["invalid-draft-shape"],
      })),
    };
  }
  const extraKeys = Object.keys(draft).filter(
    (key) => !capability.requestedPartIds.includes(key),
  );
  if (extraKeys.length > 0) {
    return {
      normalizedDraft,
      acceptedPartIds,
      failures: capability.requestedPartIds.map((partId) => ({
        partId,
        codes: ["unrequested-draft-field"],
      })),
    };
  }
  for (const partId of capability.requestedPartIds) {
    if (!Object.hasOwn(draft, partId)) {
      failures.push({ partId, codes: ["missing-requested-part"] });
      continue;
    }
    const parsed =
      capability.mode === "audit-dossier"
        ? normalizeDossierPart(partId, draft[partId], capability)
        : normalizeConfirmedPart(partId, draft[partId], capability);
    if (parsed.value === null) {
      failures.push({ partId, codes: [...parsed.codes] });
    } else {
      normalizedDraft[partId] = parsed.value;
      acceptedPartIds.push(partId);
    }
  }

  if (capability.mode === "audit-dossier") {
    const unresolvedFacts = Array.isArray(normalizedDraft.unresolvedFacts)
      ? normalizedDraft.unresolvedFacts.filter(
          (fact): fact is string => typeof fact === "string",
        )
      : [];
    const coRequestedEmptyParts = dossierEvidenceGapPartIds.filter(
      (partId) =>
        capability.requestedPartIds.includes(partId) &&
        capability.requestedPartIds.includes("unresolvedFacts") &&
        Array.isArray(normalizedDraft[partId]) &&
        (normalizedDraft[partId] as unknown[]).length === 0,
    );
    const missingGapParts = coRequestedEmptyParts.filter(
      (partId) => !hasExplicitDossierEvidenceGap(unresolvedFacts, partId),
    );
    if (missingGapParts.length > 0) {
      // Once unresolvedFacts is invalid, fixed core cannot rely on any of its
      // gap declarations. Cascade the failure to every co-requested empty
      // section so the normalized receipt and canonical application agree.
      for (const partId of coRequestedEmptyParts) {
        delete normalizedDraft[partId];
        const acceptedIndex = acceptedPartIds.indexOf(partId);
        if (acceptedIndex >= 0) acceptedPartIds.splice(acceptedIndex, 1);
        appendNormalizationFailure(
          failures,
          partId,
          "empty-section-needs-explicit-evidence-gap",
        );
      }
      delete normalizedDraft.unresolvedFacts;
      const unresolvedIndex = acceptedPartIds.indexOf("unresolvedFacts");
      if (unresolvedIndex >= 0) acceptedPartIds.splice(unresolvedIndex, 1);
      for (const partId of missingGapParts) {
        appendNormalizationFailure(
          failures,
          "unresolvedFacts",
          `missing-empty-section-evidence-gap:${partId}`,
        );
      }
    }
  }
  return { normalizedDraft, acceptedPartIds, failures };
}

function normalizedClaimToModel(value: unknown) {
  if (
    !isRecord(value) ||
    !exactKeys(value, ["text", "sourceIds", "uncertainty"])
  ) {
    return null;
  }
  return {
    text: value.text,
    evidenceSourceIds: value.sourceIds,
    uncertainty: value.uncertainty,
  };
}

function normalizedDossierDraftToModel(
  draft: Record<string, unknown>,
) {
  const modelDraft: Record<string, unknown> = {};
  for (const [partId, part] of Object.entries(draft)) {
    if (
      partId === "atAGlance" ||
      partId === "whatChanged" ||
      partId === "broadCoverage" ||
      partId === "keyComponents"
    ) {
      if (!Array.isArray(part)) return null;
      const claims = part.map(normalizedClaimToModel);
      if (claims.some((claim) => claim === null)) return null;
      modelDraft[partId] = claims;
    } else if (partId === "whatHappened") {
      const claim = normalizedClaimToModel(part);
      if (!claim) return null;
      modelDraft[partId] = claim;
    } else if (partId === "timeline") {
      if (!Array.isArray(part)) return null;
      const leads = part.map((lead) => {
        if (
          !isRecord(lead) ||
          !exactKeys(lead, [
            "date",
            "label",
            "stage",
            "sourceIds",
            "uncertainty",
          ])
        ) {
          return null;
        }
        return {
          date: lead.date,
          label: lead.label,
          stage: lead.stage,
          evidenceSourceIds: lead.sourceIds,
          uncertainty: lead.uncertainty,
        };
      });
      if (leads.some((lead) => lead === null)) return null;
      modelDraft[partId] = leads;
    } else if (partId === "relatedVersions") {
      if (!Array.isArray(part)) return null;
      const versions = part.map((related) => {
        if (
          !isRecord(related) ||
          !exactKeys(related, [
            "relationship",
            "identity",
            "sourceIds",
            "note",
          ])
        ) {
          return null;
        }
        return {
          relationship: related.relationship,
          identity: related.identity,
          evidenceSourceIds: related.sourceIds,
          note: related.note,
        };
      });
      if (versions.some((related) => related === null)) return null;
      modelDraft[partId] = versions;
    } else if (partId === "unresolvedFacts") {
      modelDraft[partId] = part;
    } else {
      return null;
    }
  }
  return modelDraft;
}

function parseSubmission(value: unknown): Screen02AuditDraftSubmission {
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
    value.schemaVersion !== SCREEN_02_AUDIT_DRAFT_SUBMISSION_SCHEMA_VERSION ||
    typeof value.capabilityToken !== "string" ||
    value.capabilityToken.length < 1 ||
    value.capabilityToken.length > MAX_SIGNED_TOKEN_CHARACTERS
  ) {
    throw new Error(
      "Screen 2 Audit model submission failed its strict root contract.",
    );
  }
  return {
    schemaVersion: SCREEN_02_AUDIT_DRAFT_SUBMISSION_SCHEMA_VERSION,
    capabilityToken: value.capabilityToken,
    requestId: requireIdentifier(value.requestId, "requestId"),
    draft: value.draft,
    ...(exactOrientationRoot ? { orientation: value.orientation } : {}),
  };
}

function validateFailures(
  value: unknown,
  capability: Screen02AuditAssessmentCapability,
) {
  if (
    !Array.isArray(value) ||
    value.length > capability.requestedPartIds.length
  ) {
    throw new Error("Screen 2 Audit receipt validation failures are malformed.");
  }
  const allowedParts = new Set(capability.requestedPartIds);
  const failures: Screen02AssessmentFailure[] = [];
  for (const failure of value) {
    if (
      !isRecord(failure) ||
      !exactKeys(failure, ["partId", "codes"]) ||
      typeof failure.partId !== "string" ||
      !allowedParts.has(failure.partId) ||
      !Array.isArray(failure.codes) ||
      failure.codes.length < 1 ||
      failure.codes.length > 10 ||
      failure.codes.some(
        (code) =>
          typeof code !== "string" ||
          (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(code) &&
            !/^missing-empty-section-evidence-gap:(?:whatChanged|timeline|broadCoverage|keyComponents|relatedVersions)$/.test(
              code,
            )),
      ) ||
      new Set(failure.codes).size !== failure.codes.length
    ) {
      throw new Error("Screen 2 Audit receipt validation failure is malformed.");
    }
    failures.push({
      partId: failure.partId,
      codes: [...failure.codes] as string[],
    });
  }
  if (
    new Set(failures.map((failure) => failure.partId)).size !== failures.length
  ) {
    throw new Error("Screen 2 Audit receipt repeats a failed part.");
  }
  return failures;
}

function parseSignedReceiptPayload(
  value: unknown,
): Screen02AuditNormalizedReceiptPayload {
  if (
    !isRecord(value) ||
    (!exactKeys(value, legacySignedReceiptKeys) &&
      !exactKeys(value, signedReceiptKeys))
  ) {
    throw new Error(
      "Screen 2 Audit signed receipt has missing or unrecognized fields.",
    );
  }
  if (value.schemaVersion !== SCREEN_02_AUDIT_SIGNED_RECEIPT_SCHEMA_VERSION) {
    throw new Error("Screen 2 Audit signed receipt schema is unsupported.");
  }
  if (typeof value.keyId !== "string" || !KEY_ID_PATTERN.test(value.keyId)) {
    throw new Error("Screen 2 Audit signed receipt key ID is invalid.");
  }
  const capability = parseCapability(value.capability);
  if (value.keyId !== capability.keyId) {
    throw new Error("Screen 2 Audit receipt and capability key IDs differ.");
  }
  const receivedAtMs = requireCanonicalIsoTimestamp(
    value.receivedAt,
    "receivedAt",
  );
  if (
    receivedAtMs < Date.parse(capability.issuedAt) ||
    receivedAtMs >= Date.parse(capability.expiresAt)
  ) {
    throw new Error(
      "Screen 2 Audit receipt was not issued during capability validity.",
    );
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
    throw new Error("Screen 2 Audit normalized receipt draft must be an object.");
  }
  const normalizedDraft = value.normalizedDraft;
  const failedPartIds = new Set(failures.map((failure) => failure.partId));
  const acceptedPartIds = capability.requestedPartIds.filter(
    (partId) => !failedPartIds.has(partId),
  );
  if (
    Object.keys(normalizedDraft).some(
      (key) => !acceptedPartIds.includes(key),
    ) ||
    acceptedPartIds.some((partId) => !Object.hasOwn(normalizedDraft, partId))
  ) {
    throw new Error(
      "Screen 2 Audit normalized receipt does not account for every requested part.",
    );
  }
  const modelDraft =
    capability.mode === "audit-dossier"
      ? normalizedDossierDraftToModel(normalizedDraft)
      : normalizedDraft;
  if (!modelDraft) {
    throw new Error("Screen 2 Audit signed dossier receipt is malformed.");
  }
  const renormalized = normalizeScreen02AuditModelDraft(modelDraft, {
    ...capability,
    requestedPartIds: acceptedPartIds,
  });
  if (
    renormalized.failures.length > 0 ||
    serializeDeterministicJson(renormalized.normalizedDraft) !==
      serializeDeterministicJson(normalizedDraft)
  ) {
    throw new Error("Screen 2 Audit signed receipt draft is not normalized.");
  }
  return {
    schemaVersion: SCREEN_02_AUDIT_SIGNED_RECEIPT_SCHEMA_VERSION,
    keyId: value.keyId,
    receiptId,
    receivedAt: value.receivedAt as string,
    capability,
    normalizedDraft: clone(normalizedDraft),
    validationFailures: failures,
    hostOrientation,
  };
}

function coreReceiptFromPayload(
  payload: Screen02AuditNormalizedReceiptPayload,
): Screen02AuditCoreDraftReceipt {
  const input = {
    receiptId: payload.receiptId,
    receivedAt: payload.receivedAt,
    submissions: [
      {
        requestId: payload.capability.requestId,
        requestProof: payload.capability.requestProof,
        draft: clone(payload.normalizedDraft),
      },
    ],
  };
  return payload.capability.mode === "audit-dossier"
    ? createScreen02AuditDossierDraftReceipt(input)
    : createScreen02AuditAssessmentDraftReceipt(input);
}

function acceptedPartIdsFromPayload(
  payload: Screen02AuditNormalizedReceiptPayload,
) {
  const failed = new Set(
    payload.validationFailures.map((failure) => failure.partId),
  );
  return payload.capability.requestedPartIds.filter(
    (partId) => !failed.has(partId),
  );
}

export async function createSignedScreen02AuditNormalizedReceipt(
  input: {
    submission: unknown;
    receiptId: string;
    receivedAt: string;
  },
  config: Screen02AuditSigningConfig,
): Promise<Screen02AuditSignedReceipt> {
  const submission = parseSubmission(input.submission);
  const capability = await verifyScreen02AuditAssessmentCapability(
    submission.capabilityToken,
    config,
    input.receivedAt,
  );
  if (submission.requestId !== capability.requestId) {
    throw new Error("Screen 2 Audit submission targets a different request.");
  }
  const normalized = normalizeScreen02AuditModelDraft(
    submission.draft,
    capability,
  );
  const hostOrientation = prepareScreen02HostOrientationReceipt(
    submission.orientation,
    {
      mode: capability.mode,
      allowedSourceIds: capability.allowedEvidenceSourceIds,
    },
  );
  const payload = parseSignedReceiptPayload({
    schemaVersion: SCREEN_02_AUDIT_SIGNED_RECEIPT_SCHEMA_VERSION,
    keyId: config.keyId,
    receiptId: requireIdentifier(input.receiptId, "receiptId"),
    receivedAt: input.receivedAt,
    capability,
    normalizedDraft: normalized.normalizedDraft,
    validationFailures: normalized.failures,
    hostOrientation,
  });
  return deepFreeze({
    receiptToken: await signToken(RECEIPT_TOKEN_PREFIX, payload, config),
    payload,
    receipt: coreReceiptFromPayload(payload),
    acceptedPartIds: [...normalized.acceptedPartIds],
    hostOrientation: payload.hostOrientation,
  });
}

export async function verifySignedScreen02AuditNormalizedReceipt(
  receiptToken: unknown,
  config: Screen02AuditSigningConfig,
): Promise<Screen02AuditSignedReceipt> {
  const payload = parseSignedReceiptPayload(
    await verifyToken(receiptToken, RECEIPT_TOKEN_PREFIX, config),
  );
  if (payload.keyId !== config.keyId) {
    throw new Error("Screen 2 Audit receipt uses an unavailable signing key.");
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

export function inspectScreen02AuditReceiptDisposition(
  state: Screen02AuditState,
  verifiedReceipt: Screen02AuditSignedReceipt,
): Screen02AuditReceiptDisposition {
  const safe = requireScreen02AuditState(state);
  const capability = verifiedReceipt.payload.capability;
  const request =
    safe.assessmentRequests.find(
      (item) => item.requestId === capability.requestId,
    ) ?? null;
  if (!request) {
    return {
      disposition: "unknown-request",
      reason: "The signed receipt request is not present in this Audit run.",
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
  const target = request.target;
  if (
    (target.mode !== "audit-dossier" &&
      target.mode !== "audit-confirmed-event") ||
    safe.runId !== capability.runId ||
    request.jobId !== capability.jobId ||
    request.rootRequestId !== capability.rootRequestId ||
    request.attempt !== capability.attempt ||
    target.mode !== capability.mode ||
    target.packetFingerprint !== capability.packetFingerprint ||
    target.anchorRevisionId !== capability.anchorRevisionId ||
    target.anchorRevisionFingerprint !== capability.anchorRevisionFingerprint ||
    target.matchSetSnapshotId !== capability.matchSetSnapshotId ||
    target.matchSetFingerprint !== capability.matchSetFingerprint ||
    target.matchSnapshotId !== capability.matchSnapshotId ||
    target.identitySnapshotId !== capability.identitySnapshotId ||
    target.matchFingerprint !== capability.matchFingerprint ||
    (target.mode === "audit-confirmed-event" &&
      (target.dossierSnapshotId !== capability.dossierSnapshotId ||
        target.dossierFingerprint !== capability.dossierFingerprint ||
        target.confirmationSnapshotId !== capability.confirmationSnapshotId ||
        target.confirmationFingerprint !== capability.confirmationFingerprint)) ||
    screen02AuditRequestProof(request) !== capability.requestProof ||
    !sameStrings(request.requestedPartIds, capability.requestedPartIds)
  ) {
    return {
      disposition: "stale",
      reason: "The signed receipt does not match this immutable Audit request target.",
      request,
    };
  }
  try {
    activeAuditRequestPacket(safe, request);
  } catch {
    return {
      disposition: "stale",
      reason:
        "The signed receipt target is no longer active in this Audit state.",
      request,
    };
  }
  if (request.status === "message-delivered") {
    return {
      disposition: "apply",
      reason:
        "The authenticated normalized Audit receipt is ready for fixed-core application after canonical host delivery.",
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
      reason: "A newer immutable Audit target superseded this request.",
      request,
    };
  }
  return {
    disposition: "terminal",
    reason: `Request ${request.requestId} is already in terminal or retry-required state ${request.status}.`,
    request,
  };
}

export function screen02AuditCapabilityDraftSchema(
  capability: Screen02AuditAssessmentCapability,
) {
  return capability.mode === "audit-dossier"
    ? {
        schemaVersion: SCREEN_02_AUDIT_DRAFT_SCHEMA_VERSION,
        mode: capability.mode,
        requestedPartIds: [...capability.requestedPartIds],
        allowedRelationships: [...screen02AuditRelationships],
        allowedDateLeadStages: [...screen02DateLeadStages],
        allowedEvidenceSourceIds: [...capability.allowedEvidenceSourceIds],
      }
    : {
        schemaVersion: SCREEN_02_AUDIT_DRAFT_SCHEMA_VERSION,
        mode: capability.mode,
        requestedPartIds: [...capability.requestedPartIds],
        allowedCategories: {
          studyFit: [...screen02StudyFitCategories],
          outcomePathway: [...screen02OutcomePathwayCategories],
          coverageRelation: [...screen02CoverageRelationCategories],
          measurementPotential: [...screen02MeasurementPotentialCategories],
        },
        allowedEvidenceSourceIds: [...capability.allowedEvidenceSourceIds],
      };
}
