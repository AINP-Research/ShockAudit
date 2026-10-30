export const hostReasoningPrivateContextMetaKey =
  "shockaudit/privateHostReasoningContext";
export const hostReasoningPrivateContextMetaSchemaVersion =
  "shockaudit-private-host-reasoning-context-meta-v1";

const privateContextKeys = [
  "schemaVersion",
  "taskId",
  "privateModelContext",
];
const modelContextKeys = [
  "schemaVersion",
  "task",
  "instructions",
  "boundedFacts",
  "submission",
  "sourceContentIsUntrustedData",
  "outcomeValuesInspected",
];
const modelTaskKeys = [
  "taskId",
  "taskType",
  "runId",
  "candidatePoolId",
  "selectedEventId",
  "claimGroupId",
  "allowedSourceIds",
];
const submissionKeys = ["tool", "schemaVersion", "capability"];
const transportKeys = [
  "schemaVersion",
  "kind",
  "canonicalPayload",
  "canonicalBytes",
  "canonicalFingerprint",
];

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value, expected) {
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  return actual.length === canonical.length &&
    actual.every((key, index) => key === canonical[index]);
}

function isNullableString(value) {
  return value === null || (typeof value === "string" && value.length > 0);
}

function canonicalize(value) {
  if (value === null || typeof value === "string" ||
      typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isRecord(value)) {
    return Object.fromEntries(Object.keys(value).sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => [key, canonicalize(value[key])]));
  }
  throw new Error("Host-task transport values must be JSON-compatible.");
}

function serialize(value) {
  return JSON.stringify(canonicalize(value));
}

function fingerprint(value) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of new TextEncoder().encode(serialize(value))) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

function isNullElidedMirror(canonical, mirror) {
  if (Array.isArray(canonical)) {
    return Array.isArray(mirror) && canonical.length === mirror.length &&
      canonical.every((item, index) =>
        isNullElidedMirror(item, mirror[index])
      );
  }
  if (isRecord(canonical)) {
    if (!isRecord(mirror)) return false;
    const keys = new Set(Object.keys(canonical));
    if (Object.keys(mirror).some((key) => !keys.has(key))) return false;
    return Object.entries(canonical).every(([key, value]) =>
      Object.prototype.hasOwnProperty.call(mirror, key)
        ? isNullElidedMirror(value, mirror[key])
        : value === null
    );
  }
  return Object.is(canonical, mirror);
}

function restoreTransport(input, expectedKind) {
  if (!isRecord(input)) return null;
  if (!Object.prototype.hasOwnProperty.call(input, "transport")) {
    return structuredClone(input);
  }
  if (!isRecord(input.transport) ||
      !hasExactKeys(input.transport, transportKeys)) return null;
  const transport = input.transport;
  if (transport.schemaVersion !== "shockaudit-host-task-transport-v1" ||
      transport.kind !== expectedKind ||
      !Number.isSafeInteger(transport.canonicalBytes) ||
      transport.canonicalBytes < 2 || transport.canonicalBytes > 512 * 1024 ||
      typeof transport.canonicalPayload !== "string" ||
      typeof transport.canonicalFingerprint !== "string" ||
      !/^fnv1a64:[0-9a-f]{16}$/u.test(transport.canonicalFingerprint) ||
      new TextEncoder().encode(transport.canonicalPayload).byteLength !==
        transport.canonicalBytes) return null;
  let canonical;
  try {
    canonical = JSON.parse(transport.canonicalPayload);
  } catch {
    return null;
  }
  if (!isRecord(canonical) || serialize(canonical) !==
      transport.canonicalPayload || fingerprint(canonical) !==
        transport.canonicalFingerprint) return null;
  const mirror = structuredClone(input);
  delete mirror.transport;
  return isNullElidedMirror(canonical, mirror) ? canonical : null;
}

/**
 * Restore the component-only part of a prepare result without accepting a
 * capability from model-visible structured content or an unversioned alias.
 */
export function readPreparedHostPrivateModelContext(result) {
  if (!isRecord(result) || !isRecord(result.structuredContent)) return null;
  const publicTask = restoreTransport(
    result.structuredContent,
    "prepared-public",
  );
  if (
    !publicTask ||
    Object.prototype.hasOwnProperty.call(publicTask, "privateModelContext") ||
    publicTask.schemaVersion !== "shockaudit-host-task-prepared-result-v1" ||
    publicTask.phase !== "prepared" ||
    publicTask.status !== "prepared" ||
    typeof publicTask.taskId !== "string" ||
    publicTask.taskId.length === 0 ||
    typeof publicTask.taskType !== "string" ||
    typeof publicTask.runId !== "string" ||
    !isRecord(result._meta) ||
    !hasExactKeys(result._meta, [hostReasoningPrivateContextMetaKey]) ||
    (Object.prototype.hasOwnProperty.call(result, "content") &&
      !Array.isArray(result.content))
  ) return null;

  const aliasedPrivateMetaKey = Object.keys(result._meta).some((key) => {
    if (key === hostReasoningPrivateContextMetaKey) return false;
    const normalized = key.toLocaleLowerCase("en-US")
      .replace(/[^a-z0-9]/gu, "");
    return normalized.includes("privatehostreasoningcontext") ||
      normalized.includes("privatemodelcontext") ||
      normalized.includes("hostcapability");
  });
  if (aliasedPrivateMetaKey) return null;

  const privateEnvelope = restoreTransport(
    result._meta[hostReasoningPrivateContextMetaKey],
    "prepared-private-context",
  );
  if (
    !isRecord(privateEnvelope) ||
    !hasExactKeys(privateEnvelope, privateContextKeys) ||
    privateEnvelope.schemaVersion !==
      hostReasoningPrivateContextMetaSchemaVersion ||
    privateEnvelope.taskId !== publicTask.taskId ||
    !isRecord(privateEnvelope.privateModelContext)
  ) return null;

  const context = privateEnvelope.privateModelContext;
  if (
    !hasExactKeys(context, modelContextKeys) ||
    context.schemaVersion !== "shockaudit-host-reasoning-model-input-v1" ||
    !isRecord(context.task) ||
    !hasExactKeys(context.task, modelTaskKeys) ||
    context.task.taskId !== publicTask.taskId ||
    context.task.taskType !== publicTask.taskType ||
    context.task.runId !== publicTask.runId ||
    context.task.candidatePoolId !== publicTask.candidatePoolId ||
    context.task.selectedEventId !== publicTask.selectedEventId ||
    context.task.claimGroupId !== publicTask.claimGroupId ||
    !isNullableString(context.task.candidatePoolId) ||
    !isNullableString(context.task.selectedEventId) ||
    !isNullableString(context.task.claimGroupId) ||
    !Array.isArray(context.task.allowedSourceIds) ||
    !context.task.allowedSourceIds.every(
      (sourceId) => typeof sourceId === "string" && sourceId.length > 0,
    ) ||
    !Array.isArray(context.instructions) ||
    context.instructions.length === 0 ||
    !context.instructions.every(
      (instruction) =>
        typeof instruction === "string" && instruction.length > 0,
    ) ||
    !isRecord(context.submission) ||
    !hasExactKeys(context.submission, submissionKeys) ||
    typeof context.submission.tool !== "string" ||
    context.submission.tool.length === 0 ||
    typeof context.submission.schemaVersion !== "string" ||
    context.submission.schemaVersion.length === 0 ||
    typeof context.submission.capability !== "string" ||
    context.submission.capability.length === 0 ||
    context.sourceContentIsUntrustedData !== true ||
    context.outcomeValuesInspected !== false
  ) return null;

  let modelVisible;
  let modelVisibleText;
  let publicTaskSerialized;
  try {
    publicTaskSerialized = JSON.stringify(publicTask);
    modelVisible = JSON.stringify({
      structuredContent: result.structuredContent,
      content: result.content ?? null,
    });
    modelVisibleText = Array.isArray(result.content)
      ? result.content.map((block) =>
          isRecord(block) && typeof block.text === "string" ? block.text : ""
        ).join("\n")
      : "";
  } catch {
    return null;
  }
  const privateMarkers = [
    context.submission.capability,
    hostReasoningPrivateContextMetaKey,
    hostReasoningPrivateContextMetaSchemaVersion,
    "shockaudit-host-reasoning-model-input-v1",
    '"privateModelContext"',
    '"instructions"',
    '"boundedFacts"',
    '"allowedSourceIds"',
    '"submission"',
    ...context.instructions.filter((instruction) => instruction.length >= 16),
    ...context.task.allowedSourceIds.filter((sourceId) => sourceId.length >= 8),
  ];
  const collectPrivateStringLeaves = (value, markers) => {
    if (typeof value === "string") {
      if (value.length >= 8 && !publicTaskSerialized.includes(value)) {
        markers.push(value);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) collectPrivateStringLeaves(item, markers);
      return;
    }
    if (isRecord(value)) {
      for (const item of Object.values(value)) {
        collectPrivateStringLeaves(item, markers);
      }
    }
  };
  collectPrivateStringLeaves(context.boundedFacts, privateMarkers);
  const serializedFacts = JSON.stringify(context.boundedFacts);
  if (serializedFacts.length >= 16) privateMarkers.push(serializedFacts);
  if (privateMarkers.some((marker) =>
    modelVisible.includes(marker) || modelVisibleText.includes(marker)
  )) return null;

  return context;
}
