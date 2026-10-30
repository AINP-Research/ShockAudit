import {
  SCREEN_01_HOST_DRAFT_APPLICATION_SCHEMA_VERSION,
  SCREEN_01_HOST_DRAFT_MAX_IDENTIFIER_CHARACTERS,
  SCREEN_01_HOST_DRAFT_MAX_TOKEN_CHARACTERS,
  SCREEN_01_HOST_DRAFT_RECEIPT_SCHEMA_VERSION,
  SCREEN_01_HOST_DRAFT_SUBMISSION_SCHEMA_VERSION,
  SCREEN_01_HOST_DRAFT_TASK_SCHEMA_VERSION,
  SCREEN_01_HOST_DRAFT_TIMEOUT_MS,
  buildScreen01HostDraftModelContext,
  buildScreen01HostDraftPrompt,
  serializeScreen01HostDraftJson,
  type Screen01HostDraftApplication,
  type Screen01HostDraftPreparedTask,
  type Screen01HostDraftProposal,
  type Screen01HostDraftReceiptNotice,
  type Screen01HostDraftSubmission,
} from "../core/screen01-host-draft";
import type {
  DecisionKey,
  FieldKey,
  Mode,
  ScopeContract,
  Screen01State,
} from "../core/scope-types";
import { decisionKeys, fieldKeys } from "../core/scope-types";
import {
  getAmbiguities,
  validateSentence,
  validateStudyPeriod,
} from "../core/scope-validation";

export const SCREEN_01_HOST_DRAFT_CAPABILITY_SCHEMA_VERSION =
  "screen-01-host-draft-capability-v1" as const;
export const SCREEN_01_HOST_DRAFT_SIGNED_RECEIPT_SCHEMA_VERSION =
  "screen-01-host-draft-signed-receipt-v1" as const;
export const SCREEN_01_HOST_DRAFT_MIN_SIGNING_KEY_BYTES = 32;
export const SCREEN_01_HOST_DRAFT_MAX_SIGNING_KEY_BYTES = 4 * 1024;
export const SCREEN_01_HOST_DRAFT_MAX_TTL_MS = 10 * 60_000;

const CAPABILITY_TOKEN_PREFIX = "sa1-capability-v1";
const RECEIPT_TOKEN_PREFIX = "sa1-receipt-v1";
const KEY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const SOURCE_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const unsafeLinePattern = /[\r\n\t\0\u2028\u2029]/;

const sourceStateKeys = [
  "revision",
  "mode",
  "sentence",
  "contractSourceSentence",
  "scope",
  "knownShock",
  "resolvedKeys",
  "scopeDirty",
  "confirmed",
] as const;
const capabilityKeys = [
  "schemaVersion",
  "keyId",
  "capabilityId",
  "operationId",
  "requestId",
  "sourceRevision",
  "sourceStateDigest",
  "mode",
  "sentence",
  "requestedScopeKeys",
  "knownShockRule",
  "issuedAt",
  "expiresAt",
] as const;
const receiptKeys = [
  "schemaVersion",
  "keyId",
  "receiptId",
  "receivedAt",
  "expiresAt",
  "capability",
  "draft",
] as const;

export type Screen01HostDraftSigningConfig = {
  keyId: string;
  key: string | Uint8Array;
};

export type Screen01HostDraftSigningKeyring = {
  current: Screen01HostDraftSigningConfig;
  previous?: Screen01HostDraftSigningConfig | null;
};

export type Screen01HostDraftSigningSource =
  | Screen01HostDraftSigningConfig
  | Screen01HostDraftSigningKeyring;

export type Screen01HostDraftCapability = {
  schemaVersion: typeof SCREEN_01_HOST_DRAFT_CAPABILITY_SCHEMA_VERSION;
  keyId: string;
  capabilityId: string;
  operationId: string;
  requestId: string;
  sourceRevision: number;
  sourceStateDigest: string;
  mode: Mode;
  sentence: string;
  requestedScopeKeys: FieldKey[];
  knownShockRule: "must-be-empty" | "named-or-not-specified";
  issuedAt: string;
  expiresAt: string;
};

export type Screen01HostDraftSignedReceiptPayload = {
  schemaVersion: typeof SCREEN_01_HOST_DRAFT_SIGNED_RECEIPT_SCHEMA_VERSION;
  keyId: string;
  receiptId: string;
  receivedAt: string;
  expiresAt: string;
  capability: Screen01HostDraftCapability;
  draft: Screen01HostDraftProposal;
};

export type Screen01HostDraftIssuedTask = {
  capability: Screen01HostDraftCapability;
  capabilityToken: string;
  task: Screen01HostDraftPreparedTask;
};

export type Screen01HostDraftSignedReceipt = {
  payload: Screen01HostDraftSignedReceiptPayload;
  receiptToken: string;
  notice: Screen01HostDraftReceiptNotice;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function clone<T>(value: T): T {
  return JSON.parse(serializeScreen01HostDraftJson(value)) as T;
}

function requireIdentifier(value: unknown, label: string) {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    value.length < 1 ||
    value.length > SCREEN_01_HOST_DRAFT_MAX_IDENTIFIER_CHARACTERS ||
    unsafeLinePattern.test(value)
  ) {
    throw new Error(`${label} must be a bounded canonical identifier.`);
  }
  return value;
}

function requireCanonicalTimestamp(value: unknown, label: string) {
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

function signingKeyBytes(config: Screen01HostDraftSigningConfig) {
  if (!config || !KEY_ID_PATTERN.test(config.keyId)) {
    throw new Error("Screen 1 host-draft signing key ID is missing or invalid.");
  }
  const bytes =
    typeof config.key === "string"
      ? new TextEncoder().encode(config.key)
      : config.key instanceof Uint8Array
        ? config.key.slice()
        : new Uint8Array();
  if (
    bytes.byteLength < SCREEN_01_HOST_DRAFT_MIN_SIGNING_KEY_BYTES ||
    bytes.byteLength > SCREEN_01_HOST_DRAFT_MAX_SIGNING_KEY_BYTES
  ) {
    throw new Error(
      `Screen 1 host-draft signing key must contain ${SCREEN_01_HOST_DRAFT_MIN_SIGNING_KEY_BYTES}–${SCREEN_01_HOST_DRAFT_MAX_SIGNING_KEY_BYTES} bytes.`,
    );
  }
  return bytes;
}

function asKeyring(source: Screen01HostDraftSigningSource) {
  if ("current" in source) return source;
  return { current: source, previous: null } satisfies Screen01HostDraftSigningKeyring;
}

export function assertScreen01HostDraftSigningConfig(
  source: Screen01HostDraftSigningSource,
) {
  const keyring = asKeyring(source);
  signingKeyBytes(keyring.current);
  if (keyring.previous) {
    signingKeyBytes(keyring.previous);
    if (keyring.previous.keyId === keyring.current.keyId) {
      throw new Error("Screen 1 host-draft signing key IDs must be distinct.");
    }
  }
}

async function importHmacKey(
  config: Screen01HostDraftSigningConfig,
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
    value.length > SCREEN_01_HOST_DRAFT_MAX_TOKEN_CHARACTERS ||
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
  config: Screen01HostDraftSigningConfig,
) {
  const payloadBytes = new TextEncoder().encode(
    serializeScreen01HostDraftJson(payload),
  );
  const key = await importHmacKey(config, "sign");
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, payloadBytes),
  );
  const token = `${prefix}.${bytesToBase64Url(payloadBytes)}.${bytesToBase64Url(
    signature,
  )}`;
  if (token.length > SCREEN_01_HOST_DRAFT_MAX_TOKEN_CHARACTERS) {
    throw new Error("Screen 1 host-draft signed token is oversized.");
  }
  return token;
}

function decodeTokenPayload(token: unknown, prefix: string) {
  if (
    typeof token !== "string" ||
    token.length < 1 ||
    token.length > SCREEN_01_HOST_DRAFT_MAX_TOKEN_CHARACTERS
  ) {
    throw new Error("Screen 1 host-draft signed token is missing or oversized.");
  }
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== prefix) {
    throw new Error("Screen 1 host-draft signed token has the wrong type.");
  }
  const payloadBytes = base64UrlToBytes(parts[1]!, "Signed token payload");
  const signature = base64UrlToBytes(parts[2]!, "Signed token signature");
  if (signature.byteLength !== 32) {
    throw new Error("Screen 1 host-draft signed token signature is malformed.");
  }
  let canonical: string;
  try {
    canonical = new TextDecoder("utf-8", { fatal: true }).decode(payloadBytes);
  } catch {
    throw new Error("Screen 1 host-draft signed token is not UTF-8.");
  }
  let payload: unknown;
  try {
    payload = JSON.parse(canonical) as unknown;
  } catch {
    throw new Error("Screen 1 host-draft signed token is not JSON.");
  }
  if (serializeScreen01HostDraftJson(payload) !== canonical) {
    throw new Error("Screen 1 host-draft token is not canonical JSON.");
  }
  return { payload, payloadBytes, signature };
}

async function verifyToken(
  token: unknown,
  prefix: string,
  source: Screen01HostDraftSigningSource,
) {
  assertScreen01HostDraftSigningConfig(source);
  const decoded = decodeTokenPayload(token, prefix);
  if (!isRecord(decoded.payload) || typeof decoded.payload.keyId !== "string") {
    throw new Error("Screen 1 host-draft token has no valid signing key ID.");
  }
  const tokenKeyId = decoded.payload.keyId;
  const keyring = asKeyring(source);
  const config = [keyring.current, keyring.previous].find(
    (candidate) => candidate?.keyId === tokenKeyId,
  );
  if (!config) {
    throw new Error("Screen 1 host-draft token signing key is not accepted.");
  }
  const key = await importHmacKey(config, "verify");
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    decoded.signature,
    decoded.payloadBytes,
  );
  if (!valid) {
    throw new Error("Screen 1 host-draft token authentication failed.");
  }
  return decoded.payload;
}

function requireCanonicalLine(
  value: unknown,
  label: string,
  options: { allowEmpty?: boolean } = {},
) {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    (!options.allowEmpty && value.length < 1) ||
    value.length > 200 ||
    unsafeLinePattern.test(value) ||
    value.includes(CAPABILITY_TOKEN_PREFIX) ||
    value.includes(RECEIPT_TOKEN_PREFIX)
  ) {
    throw new Error(`${label} must be a canonical single-line value of at most 200 characters.`);
  }
  return value;
}

function parseSourceState(value: unknown): Screen01State {
  if (!isRecord(value) || !exactKeys(value, sourceStateKeys)) {
    throw new Error("Screen 1 source state has missing or unrecognized fields.");
  }
  if (!Number.isSafeInteger(value.revision) || (value.revision as number) < 0) {
    throw new Error("Screen 1 source revision is invalid.");
  }
  if (value.mode !== "find" && value.mode !== "audit") {
    throw new Error("Screen 1 source mode is invalid.");
  }
  if (
    typeof value.sentence !== "string" ||
    value.sentence.length > 350 ||
    unsafeLinePattern.test(value.sentence) ||
    validateSentence(value.sentence)
  ) {
    throw new Error("Screen 1 source sentence is invalid.");
  }
  if (
    typeof value.contractSourceSentence !== "string" ||
    value.contractSourceSentence.length > 350 ||
    unsafeLinePattern.test(value.contractSourceSentence)
  ) {
    throw new Error("Screen 1 contract source sentence is invalid.");
  }
  if (!isRecord(value.scope) || !exactKeys(value.scope, fieldKeys)) {
    throw new Error("Screen 1 source scope has missing or unrecognized fields.");
  }
  const sourceScope = value.scope;
  const scope = Object.fromEntries(
    fieldKeys.map((key) => [
      key,
      requireCanonicalLine(sourceScope[key], `scope.${key}`),
    ]),
  ) as ScopeContract;
  const knownShock = requireCanonicalLine(value.knownShock, "knownShock", {
    allowEmpty: true,
  });
  if (value.mode === "find" && knownShock !== "") {
    throw new Error("Screen 1 Find source state cannot contain a known shock.");
  }
  if (
    !Array.isArray(value.resolvedKeys) ||
    value.resolvedKeys.some(
      (key) =>
        typeof key !== "string" ||
        !(decisionKeys as readonly string[]).includes(key),
    ) ||
    new Set(value.resolvedKeys).size !== value.resolvedKeys.length
  ) {
    throw new Error("Screen 1 resolved keys are invalid.");
  }
  if (typeof value.scopeDirty !== "boolean" || typeof value.confirmed !== "boolean") {
    throw new Error("Screen 1 source status flags are invalid.");
  }
  return {
    revision: value.revision as number,
    mode: value.mode,
    sentence: value.sentence,
    contractSourceSentence: value.contractSourceSentence,
    scope,
    knownShock,
    resolvedKeys: [...(value.resolvedKeys as DecisionKey[])],
    scopeDirty: value.scopeDirty,
    confirmed: value.confirmed,
  };
}

export async function fingerprintScreen01HostDraftSourceState(
  sourceState: Screen01State,
) {
  const canonical = serializeScreen01HostDraftJson(parseSourceState(sourceState));
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical)),
  );
  return `sha256:${[...digest]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

function parseCapability(value: unknown): Screen01HostDraftCapability {
  if (!isRecord(value) || !exactKeys(value, capabilityKeys)) {
    throw new Error("Screen 1 host-draft capability has missing or unrecognized fields.");
  }
  if (value.schemaVersion !== SCREEN_01_HOST_DRAFT_CAPABILITY_SCHEMA_VERSION) {
    throw new Error("Screen 1 host-draft capability schema is unsupported.");
  }
  if (typeof value.keyId !== "string" || !KEY_ID_PATTERN.test(value.keyId)) {
    throw new Error("Screen 1 host-draft capability key ID is invalid.");
  }
  const capabilityId = requireIdentifier(value.capabilityId, "capabilityId");
  const operationId = requireIdentifier(value.operationId, "operationId");
  const requestId = requireIdentifier(value.requestId, "requestId");
  if (!Number.isSafeInteger(value.sourceRevision) || (value.sourceRevision as number) < 0) {
    throw new Error("Screen 1 host-draft source revision is invalid.");
  }
  if (
    typeof value.sourceStateDigest !== "string" ||
    !SOURCE_DIGEST_PATTERN.test(value.sourceStateDigest)
  ) {
    throw new Error("Screen 1 host-draft source digest is invalid.");
  }
  if (value.mode !== "find" && value.mode !== "audit") {
    throw new Error("Screen 1 host-draft mode is invalid.");
  }
  if (
    typeof value.sentence !== "string" ||
    value.sentence.length > 350 ||
    unsafeLinePattern.test(value.sentence) ||
    validateSentence(value.sentence)
  ) {
    throw new Error("Screen 1 host-draft sentence is invalid.");
  }
  if (
    !Array.isArray(value.requestedScopeKeys) ||
    value.requestedScopeKeys.length !== fieldKeys.length ||
    value.requestedScopeKeys.some((key, index) => key !== fieldKeys[index])
  ) {
    throw new Error("Screen 1 host-draft requested field list is invalid.");
  }
  const expectedRule =
    value.mode === "find" ? "must-be-empty" : "named-or-not-specified";
  if (value.knownShockRule !== expectedRule) {
    throw new Error("Screen 1 host-draft known-shock rule is invalid.");
  }
  const issuedAtMs = requireCanonicalTimestamp(value.issuedAt, "issuedAt");
  const expiresAtMs = requireCanonicalTimestamp(value.expiresAt, "expiresAt");
  if (
    expiresAtMs <= issuedAtMs ||
    expiresAtMs - issuedAtMs > SCREEN_01_HOST_DRAFT_MAX_TTL_MS
  ) {
    throw new Error("Screen 1 host-draft capability lifetime is invalid.");
  }
  return {
    schemaVersion: SCREEN_01_HOST_DRAFT_CAPABILITY_SCHEMA_VERSION,
    keyId: value.keyId,
    capabilityId,
    operationId,
    requestId,
    sourceRevision: value.sourceRevision as number,
    sourceStateDigest: value.sourceStateDigest,
    mode: value.mode,
    sentence: value.sentence,
    requestedScopeKeys: [...fieldKeys],
    knownShockRule: expectedRule,
    issuedAt: value.issuedAt as string,
    expiresAt: value.expiresAt as string,
  };
}

function parseProposal(value: unknown, capability: Screen01HostDraftCapability) {
  if (!isRecord(value) || !exactKeys(value, ["scope", "knownShock"])) {
    throw new Error("Screen 1 host draft must contain exactly scope and knownShock.");
  }
  if (!isRecord(value.scope) || !exactKeys(value.scope, fieldKeys)) {
    throw new Error("Screen 1 host draft scope must contain exactly the nine requested fields.");
  }
  const proposalScope = value.scope;
  const scope = Object.fromEntries(
    fieldKeys.map((key) => [
      key,
      requireCanonicalLine(proposalScope[key], `draft.scope.${key}`),
    ]),
  ) as ScopeContract;
  const studyPeriodError = validateStudyPeriod(scope.studyPeriod);
  if (studyPeriodError) {
    throw new Error(`draft.scope.studyPeriod: ${studyPeriodError}`);
  }
  const knownShock = requireCanonicalLine(value.knownShock, "draft.knownShock", {
    allowEmpty: capability.mode === "find",
  });
  if (capability.mode === "find" && knownShock !== "") {
    throw new Error("Screen 1 Find host draft must return an empty knownShock.");
  }
  if (
    fieldKeys.some((key) => scope[key].includes(capability.capabilityId)) ||
    knownShock.includes(capability.capabilityId)
  ) {
    throw new Error("Screen 1 host draft contains transport credentials.");
  }
  return { scope, knownShock } satisfies Screen01HostDraftProposal;
}

function parseSubmission(value: unknown) {
  if (
    !isRecord(value) ||
    !exactKeys(value, ["schemaVersion", "capabilityToken", "requestId", "draft"]) ||
    value.schemaVersion !== SCREEN_01_HOST_DRAFT_SUBMISSION_SCHEMA_VERSION ||
    typeof value.capabilityToken !== "string" ||
    value.capabilityToken.length < 1 ||
    value.capabilityToken.length > SCREEN_01_HOST_DRAFT_MAX_TOKEN_CHARACTERS
  ) {
    throw new Error("Screen 1 host-draft submission is malformed.");
  }
  return {
    schemaVersion: SCREEN_01_HOST_DRAFT_SUBMISSION_SCHEMA_VERSION,
    capabilityToken: value.capabilityToken,
    requestId: requireIdentifier(value.requestId, "requestId"),
    draft: value.draft,
  };
}

function requireActiveWindow(
  issuedAt: string,
  expiresAt: string,
  observedAt: string,
  label: string,
) {
  const issuedAtMs = requireCanonicalTimestamp(issuedAt, `${label}.issuedAt`);
  const expiresAtMs = requireCanonicalTimestamp(expiresAt, `${label}.expiresAt`);
  const observedAtMs = requireCanonicalTimestamp(observedAt, "observedAt");
  if (observedAtMs < issuedAtMs || observedAtMs >= expiresAtMs) {
    throw new Error(`${label} is not active at the observed time.`);
  }
}

export async function createScreen01HostDraftTask(
  input: {
    sourceState: Screen01State;
    operationId: string;
    requestId: string;
    capabilityId: string;
    issuedAt: string;
    expiresAt?: string;
  },
  signingSource: Screen01HostDraftSigningSource,
): Promise<Screen01HostDraftIssuedTask> {
  assertScreen01HostDraftSigningConfig(signingSource);
  const keyring = asKeyring(signingSource);
  const sourceState = parseSourceState(input.sourceState);
  const issuedAtMs = requireCanonicalTimestamp(input.issuedAt, "issuedAt");
  const expiresAt =
    input.expiresAt ??
    new Date(issuedAtMs + SCREEN_01_HOST_DRAFT_TIMEOUT_MS).toISOString();
  const expiresAtMs = requireCanonicalTimestamp(expiresAt, "expiresAt");
  if (
    expiresAtMs <= issuedAtMs ||
    expiresAtMs - issuedAtMs > SCREEN_01_HOST_DRAFT_MAX_TTL_MS
  ) {
    throw new Error("Screen 1 host-draft requested lifetime is invalid.");
  }
  const operationId = requireIdentifier(input.operationId, "operationId");
  const requestId = requireIdentifier(input.requestId, "requestId");
  const capabilityId = requireIdentifier(input.capabilityId, "capabilityId");
  const sourceStateDigest = await fingerprintScreen01HostDraftSourceState(sourceState);
  const capability: Screen01HostDraftCapability = {
    schemaVersion: SCREEN_01_HOST_DRAFT_CAPABILITY_SCHEMA_VERSION,
    keyId: keyring.current.keyId,
    capabilityId,
    operationId,
    requestId,
    sourceRevision: sourceState.revision,
    sourceStateDigest,
    mode: sourceState.mode,
    sentence: sourceState.sentence,
    requestedScopeKeys: [...fieldKeys],
    knownShockRule:
      sourceState.mode === "find" ? "must-be-empty" : "named-or-not-specified",
    issuedAt: input.issuedAt,
    expiresAt,
  };
  const capabilityToken = await signToken(
    CAPABILITY_TOKEN_PREFIX,
    capability,
    keyring.current,
  );
  return {
    capability: clone(capability),
    capabilityToken,
    task: {
      schemaVersion: SCREEN_01_HOST_DRAFT_TASK_SCHEMA_VERSION,
      phase: "prepared",
      operationId,
      requestId,
      sourceRevision: sourceState.revision,
      sourceStateDigest,
      mode: sourceState.mode,
      sentence: sourceState.sentence,
      issuedAt: input.issuedAt,
      expiresAt,
      requiredTool: "submit_screen01_scope_draft_v036",
      prompt: buildScreen01HostDraftPrompt(sourceState.mode),
      modelContext: buildScreen01HostDraftModelContext({
        operationId,
        requestId,
        mode: sourceState.mode,
        sentence: sourceState.sentence,
        capabilityToken,
      }),
    },
  };
}

export async function verifyScreen01HostDraftCapability(
  capabilityToken: unknown,
  observedAt: string,
  signingSource: Screen01HostDraftSigningSource,
) {
  const capability = parseCapability(
    await verifyToken(capabilityToken, CAPABILITY_TOKEN_PREFIX, signingSource),
  );
  requireActiveWindow(
    capability.issuedAt,
    capability.expiresAt,
    observedAt,
    "Screen 1 host-draft capability",
  );
  return capability;
}

export async function createSignedScreen01HostDraftReceipt(
  input: {
    submission: Screen01HostDraftSubmission | unknown;
    receiptId: string;
    receivedAt: string;
    expiresAt?: string;
  },
  signingSource: Screen01HostDraftSigningSource,
): Promise<Screen01HostDraftSignedReceipt> {
  const keyring = asKeyring(signingSource);
  assertScreen01HostDraftSigningConfig(keyring);
  const submission = parseSubmission(input.submission);
  const capability = await verifyScreen01HostDraftCapability(
    submission.capabilityToken,
    input.receivedAt,
    keyring,
  );
  if (submission.requestId !== capability.requestId) {
    throw new Error("Screen 1 host-draft submission request ID does not match its capability.");
  }
  const draft = parseProposal(submission.draft, capability);
  const receivedAtMs = requireCanonicalTimestamp(input.receivedAt, "receivedAt");
  const capabilityExpiresAtMs = Date.parse(capability.expiresAt);
  const defaultReceiptExpiry = Math.min(
    capabilityExpiresAtMs + SCREEN_01_HOST_DRAFT_TIMEOUT_MS,
    receivedAtMs + SCREEN_01_HOST_DRAFT_TIMEOUT_MS,
  );
  const expiresAt =
    input.expiresAt ?? new Date(defaultReceiptExpiry).toISOString();
  const expiresAtMs = requireCanonicalTimestamp(expiresAt, "expiresAt");
  if (
    expiresAtMs <= receivedAtMs ||
    expiresAtMs - receivedAtMs > SCREEN_01_HOST_DRAFT_MAX_TTL_MS
  ) {
    throw new Error("Screen 1 host-draft receipt lifetime is invalid.");
  }
  const receiptId = requireIdentifier(input.receiptId, "receiptId");
  const payload: Screen01HostDraftSignedReceiptPayload = {
    schemaVersion: SCREEN_01_HOST_DRAFT_SIGNED_RECEIPT_SCHEMA_VERSION,
    keyId: keyring.current.keyId,
    receiptId,
    receivedAt: input.receivedAt,
    expiresAt,
    capability,
    draft,
  };
  const receiptToken = await signToken(RECEIPT_TOKEN_PREFIX, payload, keyring.current);
  return {
    payload: clone(payload),
    receiptToken,
    notice: {
      schemaVersion: SCREEN_01_HOST_DRAFT_RECEIPT_SCHEMA_VERSION,
      phase: "signed-receipt",
      operationId: capability.operationId,
      requestId: capability.requestId,
      receiptId,
      sourceRevision: capability.sourceRevision,
      sourceStateDigest: capability.sourceStateDigest,
      receivedAt: input.receivedAt,
      receiptToken,
    },
  };
}

function parseReceipt(value: unknown): Screen01HostDraftSignedReceiptPayload {
  if (!isRecord(value) || !exactKeys(value, receiptKeys)) {
    throw new Error("Screen 1 host-draft receipt has missing or unrecognized fields.");
  }
  if (value.schemaVersion !== SCREEN_01_HOST_DRAFT_SIGNED_RECEIPT_SCHEMA_VERSION) {
    throw new Error("Screen 1 host-draft receipt schema is unsupported.");
  }
  if (typeof value.keyId !== "string" || !KEY_ID_PATTERN.test(value.keyId)) {
    throw new Error("Screen 1 host-draft receipt key ID is invalid.");
  }
  const receiptId = requireIdentifier(value.receiptId, "receiptId");
  const capability = parseCapability(value.capability);
  const receivedAtMs = requireCanonicalTimestamp(value.receivedAt, "receivedAt");
  const expiresAtMs = requireCanonicalTimestamp(value.expiresAt, "expiresAt");
  if (
    receivedAtMs < Date.parse(capability.issuedAt) ||
    receivedAtMs >= Date.parse(capability.expiresAt) ||
    expiresAtMs <= receivedAtMs ||
    expiresAtMs - receivedAtMs > SCREEN_01_HOST_DRAFT_MAX_TTL_MS
  ) {
    throw new Error("Screen 1 host-draft receipt lifetime is invalid.");
  }
  return {
    schemaVersion: SCREEN_01_HOST_DRAFT_SIGNED_RECEIPT_SCHEMA_VERSION,
    keyId: value.keyId,
    receiptId,
    receivedAt: value.receivedAt as string,
    expiresAt: value.expiresAt as string,
    capability,
    draft: parseProposal(value.draft, capability),
  };
}

export async function applySignedScreen01HostDraftReceipt(
  input: {
    sourceState: Screen01State;
    operationId: string;
    receiptToken: string;
    appliedAt: string;
  },
  signingSource: Screen01HostDraftSigningSource,
): Promise<Screen01HostDraftApplication> {
  const sourceState = parseSourceState(input.sourceState);
  const operationId = requireIdentifier(input.operationId, "operationId");
  const receipt = parseReceipt(
    await verifyToken(input.receiptToken, RECEIPT_TOKEN_PREFIX, signingSource),
  );
  requireActiveWindow(
    receipt.receivedAt,
    receipt.expiresAt,
    input.appliedAt,
    "Screen 1 host-draft receipt",
  );
  const capability = receipt.capability;
  if (operationId !== capability.operationId) {
    throw new Error("Screen 1 host-draft operation ID does not match the receipt.");
  }
  if (
    sourceState.revision !== capability.sourceRevision ||
    sourceState.mode !== capability.mode ||
    sourceState.sentence !== capability.sentence
  ) {
    throw new Error("Screen 1 changed while ChatGPT was drafting. Start a fresh draft.");
  }
  const sourceStateDigest = await fingerprintScreen01HostDraftSourceState(sourceState);
  if (sourceStateDigest !== capability.sourceStateDigest) {
    throw new Error("Screen 1 changed while ChatGPT was drafting. Start a fresh draft.");
  }
  const proposedState: Screen01State = {
    ...sourceState,
    revision: sourceState.revision + 1,
    contractSourceSentence: sourceState.sentence,
    scope: clone(receipt.draft.scope),
    knownShock: sourceState.mode === "audit" ? receipt.draft.knownShock : "",
    resolvedKeys: [],
    scopeDirty: false,
    confirmed: false,
  };
  const ambiguities = getAmbiguities({
    scope: proposedState.scope,
    mode: proposedState.mode,
    sentence: proposedState.sentence,
    knownShock: proposedState.knownShock,
    resolvedKeys: proposedState.resolvedKeys,
  });
  return {
    schemaVersion: SCREEN_01_HOST_DRAFT_APPLICATION_SCHEMA_VERSION,
    phase: "applied",
    ok: true,
    operationId,
    requestId: capability.requestId,
    receiptId: receipt.receiptId,
    sourceRevision: capability.sourceRevision,
    sourceStateDigest,
    proposedState,
    ambiguities,
    message:
      ambiguities.length === 0
        ? "ChatGPT drafted all nine scope fields. Review them, then confirm your scope."
        : `ChatGPT drafted all nine scope fields. Review ${ambiguities.length} remaining ${
            ambiguities.length === 1 ? "choice" : "choices"
          } before confirming.`,
  };
}
