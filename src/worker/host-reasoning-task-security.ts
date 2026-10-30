import {
  HOST_REASONING_TASK_SCHEMA_VERSION,
  fingerprintHostReasoningValue,
  hostReasoningTaskCoordinates,
  requireHostReasoningTask,
  sameHostReasoningTaskCoordinates,
  serializeHostReasoningValue,
  type HostReasoningTask,
  type HostReasoningTaskCoordinates,
} from "../core/host-reasoning-task";

export const HOST_REASONING_CAPABILITY_SCHEMA_VERSION =
  "shockaudit-host-reasoning-capability-v1" as const;
export const HOST_REASONING_MODEL_INPUT_SCHEMA_VERSION =
  "shockaudit-host-reasoning-model-input-v1" as const;
export const HOST_REASONING_DEFAULT_CAPABILITY_TTL_MS = 120_000;
export const HOST_REASONING_MAX_CAPABILITY_TTL_MS = 10 * 60_000;
export const HOST_REASONING_MAX_INPUT_BYTES = 96 * 1024;
export const HOST_REASONING_MAX_PROPOSAL_BYTES = 64 * 1024;

const tokenPrefix = "sahr-capability-v1";
const maxTokenCharacters = 64 * 1024;
const maxKeyBytes = 4 * 1024;
const minKeyBytes = 32;
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
const keyIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const base64UrlPattern = /^[A-Za-z0-9_-]+$/;
const unsafeMarkupPattern =
  /(?:<\/?[a-z][^>]*>|javascript\s*:|data\s*:\s*text\/html|on(?:error|load|click)\s*=)/iu;
const instructionInjectionPattern =
  /\b(?:ignore|disregard|override|forget|bypass)\b.{0,50}\b(?:previous|prior|system|developer|instructions?|rules?|prompt)\b|\b(?:system|developer|assistant)\s*(?:prompt|message)\s*:|\b(?:call|invoke|execute)\b.{0,35}\b(?:tool|function|command)\b/iu;
const controlCharacterPattern = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;

export type HostReasoningSigningConfig = {
  keyId: string;
  key: string | Uint8Array;
};

export type HostReasoningCapability = HostReasoningTaskCoordinates & {
  schemaVersion: typeof HOST_REASONING_CAPABILITY_SCHEMA_VERSION;
  keyId: string;
  capabilityId: string;
  taskSchemaVersion: typeof HOST_REASONING_TASK_SCHEMA_VERSION;
  taskCreatedAt: string;
  taskExpiresAt: string;
  issuedAt: string;
  expiresAt: string;
  allowedSourceIds: string[];
  appVersion: string;
  uiResourceUri: string;
  outcomeValuesInspected: false;
};

export type HostReasoningSubmission = {
  schemaVersion: string;
  taskId: string;
  capabilityToken: string;
  sourceIdsReferenced: string[];
  proposal: unknown;
};

export type AuthenticatedHostReasoningSubmission = {
  capability: HostReasoningCapability;
  sourceIdsReferenced: string[];
  proposal: unknown;
  submissionFingerprint: string;
};

const capabilityKeys = [
  "schemaVersion", "keyId", "capabilityId", "taskSchemaVersion", "taskId",
  "taskType", "screen", "runId", "candidateId", "candidatePoolId",
  "selectedEventId", "claimGroupId", "scopeFingerprint",
  "candidatePoolFingerprint", "eventFingerprint", "sourcePoolFingerprint",
  "inputFingerprint", "promptVersion", "workflowVersion",
  "requiredSubmissionSchemaVersion", "retryCount", "taskCreatedAt",
  "taskExpiresAt", "issuedAt", "expiresAt", "allowedSourceIds", "appVersion",
  "uiResourceUri", "outcomeValuesInspected",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length &&
    actual.every((key, index) => key === wanted[index]);
}

function timestamp(value: unknown, label: string) {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a canonical ISO timestamp.`);
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    throw new Error(`${label} must be a canonical ISO timestamp.`);
  }
  return value;
}

function identifier(value: unknown, label: string) {
  if (typeof value !== "string" || !identifierPattern.test(value)) {
    throw new Error(`${label} must be a bounded canonical identifier.`);
  }
  return value;
}

function signingKeyBytes(config: HostReasoningSigningConfig) {
  if (!config || !keyIdPattern.test(config.keyId)) {
    throw new Error("Host-reasoning signing key ID is invalid.");
  }
  const key = typeof config.key === "string"
    ? new TextEncoder().encode(config.key)
    : config.key instanceof Uint8Array ? config.key.slice() : new Uint8Array();
  if (key.byteLength < minKeyBytes || key.byteLength > maxKeyBytes) {
    throw new Error("Host-reasoning signing key size is invalid.");
  }
  return key;
}

async function hmacKey(
  config: HostReasoningSigningConfig,
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

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function decodeBase64Url(value: string, label: string) {
  if (
    value.length < 1 || value.length > maxTokenCharacters ||
    !base64UrlPattern.test(value) || value.length % 4 === 1
  ) {
    throw new Error(`${label} is not canonical bounded base64url.`);
  }
  const padded = `${value.replaceAll("-", "+").replaceAll("_", "/")}${"=".repeat((4 - value.length % 4) % 4)}`;
  let decoded: string;
  try {
    decoded = atob(padded);
  } catch {
    throw new Error(`${label} is not valid base64url.`);
  }
  const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  if (base64Url(bytes) !== value) {
    throw new Error(`${label} is not canonical base64url.`);
  }
  return bytes;
}

function boundedUniqueIdentifiers(
  value: unknown,
  label: string,
  maximum = 100,
) {
  if (
    !Array.isArray(value) || value.length > maximum ||
    value.some((item) => typeof item !== "string" || !identifierPattern.test(item)) ||
    new Set(value).size !== value.length
  ) {
    throw new Error(`${label} must contain unique bounded identifiers.`);
  }
  return [...value] as string[];
}

function assertSafeTree(
  value: unknown,
  label: string,
  maximumBytes: number,
) {
  const seen = new WeakSet<object>();
  const visit = (node: unknown, depth: number) => {
    if (depth > 10) throw new Error(`${label} is nested too deeply.`);
    if (typeof node === "string") {
      if (node.length > 12_000) throw new Error(`${label} contains oversized text.`);
      if (controlCharacterPattern.test(node)) {
        throw new Error(`${label} contains control characters.`);
      }
      if (unsafeMarkupPattern.test(node)) {
        throw new Error(`${label} contains executable markup.`);
      }
      if (instructionInjectionPattern.test(node)) {
        throw new Error(`${label} contains instruction-like content.`);
      }
      return;
    }
    if (node === null || typeof node === "boolean") {
      return;
    }
    if (typeof node === "number") {
      if (!Number.isFinite(node)) throw new Error(`${label} must be finite JSON data.`);
      return;
    }
    if (Array.isArray(node)) {
      if (node.length > 100) throw new Error(`${label} contains an oversized list.`);
      for (const child of node) visit(child, depth + 1);
      return;
    }
    if (!isRecord(node) || seen.has(node)) {
      throw new Error(`${label} must be finite JSON data.`);
    }
    seen.add(node);
    const entries = Object.entries(node);
    if (entries.length > 100) throw new Error(`${label} contains too many fields.`);
    for (const [key, child] of entries) {
      if (!/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(key)) {
        throw new Error(`${label} contains an invalid field name.`);
      }
      visit(child, depth + 1);
    }
  };
  visit(value, 0);
  const serialized = serializeHostReasoningValue(value);
  if (new TextEncoder().encode(serialized).byteLength > maximumBytes) {
    throw new Error(`${label} exceeds its byte limit.`);
  }
  return structuredClone(value);
}

export function validateHostReasoningInput(value: unknown) {
  return assertSafeTree(value, "Host-reasoning input", HOST_REASONING_MAX_INPUT_BYTES);
}

export function validateHostReasoningProposal(value: unknown) {
  return assertSafeTree(
    value,
    "Host-reasoning proposal",
    HOST_REASONING_MAX_PROPOSAL_BYTES,
  );
}

function parseCapability(value: unknown): HostReasoningCapability {
  if (!isRecord(value) || !exactKeys(value, capabilityKeys)) {
    throw new Error("Host-reasoning capability has unrecognized fields.");
  }
  const taskCoordinates = hostReasoningTaskCoordinates(requireHostReasoningTask({
    schemaVersion: HOST_REASONING_TASK_SCHEMA_VERSION,
    taskId: value.taskId,
    taskType: value.taskType,
    screen: value.screen,
    runId: value.runId,
    candidateId: value.candidateId,
    candidatePoolId: value.candidatePoolId,
    selectedEventId: value.selectedEventId,
    claimGroupId: value.claimGroupId,
    scopeFingerprint: value.scopeFingerprint,
    candidatePoolFingerprint: value.candidatePoolFingerprint,
    eventFingerprint: value.eventFingerprint,
    sourcePoolFingerprint: value.sourcePoolFingerprint,
    inputFingerprint: value.inputFingerprint,
    promptVersion: value.promptVersion,
    workflowVersion: value.workflowVersion,
    requiredSubmissionSchemaVersion: value.requiredSubmissionSchemaVersion,
    createdAt: value.taskCreatedAt,
    expiresAt: value.taskExpiresAt,
    status: "prepared",
    messageChannel: null,
    messageDeliveryStatus: null,
    messageRequestedAt: null,
    messageAcceptedAt: null,
    submissionReceivedAt: null,
    validatedAt: null,
    appliedAt: null,
    resultId: null,
    retryCount: value.retryCount,
    failureCode: null,
    failureExplanation: null,
    appVersion: value.appVersion,
    uiResourceUri: value.uiResourceUri,
    hostModel: "host_model_not_exposed",
    outcomeValuesInspected: false,
  }));
  const issuedAt = timestamp(value.issuedAt, "issuedAt");
  const expiresAt = timestamp(value.expiresAt, "expiresAt");
  const taskExpiresAt = timestamp(value.taskExpiresAt, "taskExpiresAt");
  if (
    Date.parse(expiresAt) <= Date.parse(issuedAt) ||
    Date.parse(expiresAt) - Date.parse(issuedAt) > HOST_REASONING_MAX_CAPABILITY_TTL_MS ||
    expiresAt > taskExpiresAt
  ) {
    throw new Error("Host-reasoning capability lifetime is invalid.");
  }
  if (
    value.schemaVersion !== HOST_REASONING_CAPABILITY_SCHEMA_VERSION ||
    value.taskSchemaVersion !== HOST_REASONING_TASK_SCHEMA_VERSION ||
    typeof value.keyId !== "string" || !keyIdPattern.test(value.keyId) ||
    value.outcomeValuesInspected !== false
  ) {
    throw new Error("Host-reasoning capability invariant is invalid.");
  }
  return {
    schemaVersion: HOST_REASONING_CAPABILITY_SCHEMA_VERSION,
    keyId: value.keyId,
    capabilityId: identifier(value.capabilityId, "capabilityId"),
    taskSchemaVersion: HOST_REASONING_TASK_SCHEMA_VERSION,
    ...taskCoordinates,
    taskCreatedAt: timestamp(value.taskCreatedAt, "taskCreatedAt"),
    taskExpiresAt,
    issuedAt,
    expiresAt,
    allowedSourceIds: boundedUniqueIdentifiers(value.allowedSourceIds, "allowedSourceIds"),
    appVersion: identifier(value.appVersion, "appVersion"),
    uiResourceUri: typeof value.uiResourceUri === "string" &&
        value.uiResourceUri.length <= 500
      ? value.uiResourceUri
      : (() => { throw new Error("uiResourceUri is invalid."); })(),
    outcomeValuesInspected: false,
  };
}

async function signCapability(
  capability: HostReasoningCapability,
  config: HostReasoningSigningConfig,
) {
  const payload = new TextEncoder().encode(serializeHostReasoningValue(capability));
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", await hmacKey(config, "sign"), payload),
  );
  const token = `${tokenPrefix}.${base64Url(payload)}.${base64Url(signature)}`;
  if (token.length > maxTokenCharacters) {
    throw new Error("Host-reasoning capability exceeds its token limit.");
  }
  return token;
}

export async function verifyHostReasoningCapability(
  token: unknown,
  config: HostReasoningSigningConfig,
  observedAt: string,
  options: { allowInactive?: boolean } = {},
) {
  if (typeof token !== "string" || token.length > maxTokenCharacters) {
    throw new Error("Host-reasoning capability is missing or oversized.");
  }
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== tokenPrefix) {
    throw new Error("Host-reasoning capability has the wrong type.");
  }
  const payload = decodeBase64Url(parts[1]!, "Capability payload");
  const signature = decodeBase64Url(parts[2]!, "Capability signature");
  if (
    signature.byteLength !== 32 ||
    !await crypto.subtle.verify(
      "HMAC",
      await hmacKey(config, "verify"),
      signature,
      payload,
    )
  ) {
    throw new Error("Host-reasoning capability authentication failed.");
  }
  let json: string;
  try {
    json = new TextDecoder("utf-8", { fatal: true }).decode(payload);
  } catch {
    throw new Error("Host-reasoning capability is not UTF-8.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Host-reasoning capability is not JSON.");
  }
  if (serializeHostReasoningValue(parsed) !== json) {
    throw new Error("Host-reasoning capability is not canonical JSON.");
  }
  const capability = parseCapability(parsed);
  if (capability.keyId !== config.keyId) {
    throw new Error("Host-reasoning capability signing key is unavailable.");
  }
  const at = timestamp(observedAt, "observedAt");
  if (
    options.allowInactive !== true &&
    (at < capability.issuedAt || at >= capability.expiresAt)
  ) {
    throw new Error("Host-reasoning capability is not active.");
  }
  return structuredClone(capability);
}

export async function createHostReasoningCapability(
  input: {
    task: HostReasoningTask;
    boundedInput: unknown;
    allowedSourceIds: readonly string[];
    capabilityId: string;
    issuedAt: string;
    expiresAt?: string;
  },
  config: HostReasoningSigningConfig,
) {
  const task = requireHostReasoningTask(input.task);
  if (task.status !== "prepared") {
    throw new Error("A capability can bind only a prepared host task.");
  }
  const boundedInput = validateHostReasoningInput(input.boundedInput);
  if (fingerprintHostReasoningValue(boundedInput) !== task.inputFingerprint) {
    throw new Error("Host-task input fingerprint does not match its frozen input.");
  }
  const allowedSourceIds = boundedUniqueIdentifiers(
    input.allowedSourceIds,
    "allowedSourceIds",
  );
  if (fingerprintHostReasoningValue([...allowedSourceIds].sort()) !== task.sourcePoolFingerprint) {
    throw new Error("Host-task source pool fingerprint does not match its sources.");
  }
  const issuedAt = timestamp(input.issuedAt, "issuedAt");
  const defaultExpiry = new Date(
    Date.parse(issuedAt) + HOST_REASONING_DEFAULT_CAPABILITY_TTL_MS,
  ).toISOString();
  const expiresAt = input.expiresAt ??
    (defaultExpiry < task.expiresAt ? defaultExpiry : task.expiresAt);
  const capability: HostReasoningCapability = parseCapability({
    schemaVersion: HOST_REASONING_CAPABILITY_SCHEMA_VERSION,
    keyId: config.keyId,
    capabilityId: identifier(input.capabilityId, "capabilityId"),
    taskSchemaVersion: HOST_REASONING_TASK_SCHEMA_VERSION,
    ...hostReasoningTaskCoordinates(task),
    taskCreatedAt: task.createdAt,
    taskExpiresAt: task.expiresAt,
    issuedAt,
    expiresAt,
    allowedSourceIds,
    appVersion: task.appVersion,
    uiResourceUri: task.uiResourceUri,
    outcomeValuesInspected: false,
  });
  return {
    capability,
    capabilityToken: await signCapability(capability, config),
    boundedInput,
  };
}

export async function authenticateHostReasoningSubmission(
  value: unknown,
  input: {
    signing: HostReasoningSigningConfig;
    observedAt: string;
    expectedTask: HostReasoningTask;
  },
): Promise<AuthenticatedHostReasoningSubmission> {
  if (!isRecord(value) || !exactKeys(value, [
    "schemaVersion", "taskId", "capabilityToken", "sourceIdsReferenced",
    "proposal",
  ])) {
    throw new Error("Host-reasoning submission has unrecognized fields.");
  }
  const capability = await verifyHostReasoningCapability(
    value.capabilityToken,
    input.signing,
    input.observedAt,
  );
  const task = requireHostReasoningTask(input.expectedTask);
  if (
    value.schemaVersion !== task.requiredSubmissionSchemaVersion ||
    value.taskId !== task.taskId ||
    !sameHostReasoningTaskCoordinates(capability, hostReasoningTaskCoordinates(task)) ||
    capability.taskCreatedAt !== task.createdAt ||
    capability.taskExpiresAt !== task.expiresAt ||
    capability.appVersion !== task.appVersion ||
    capability.uiResourceUri !== task.uiResourceUri
  ) {
    throw new Error("Host-reasoning submission targets the wrong or stale task.");
  }
  const sourceIdsReferenced = boundedUniqueIdentifiers(
    value.sourceIdsReferenced,
    "sourceIdsReferenced",
  );
  const allowed = new Set(capability.allowedSourceIds);
  if (sourceIdsReferenced.some((sourceId) => !allowed.has(sourceId))) {
    throw new Error("Host-reasoning submission cites an unknown source.");
  }
  const proposal = validateHostReasoningProposal(value.proposal);
  return {
    capability,
    sourceIdsReferenced,
    proposal,
    submissionFingerprint: fingerprintHostReasoningValue({
      schemaVersion: value.schemaVersion,
      taskId: value.taskId,
      sourceIdsReferenced,
      proposal,
    }),
  };
}
