import {
  fingerprintSixScreenValue,
  sameSixScreenValue,
  serializeSixScreenValue,
} from "./six-screen/canonical";

export const HOST_TASK_TRANSPORT_KEY = "transport" as const;
export const HOST_TASK_TRANSPORT_SCHEMA_VERSION =
  "shockaudit-host-task-transport-v1" as const;

export const HOST_TASK_TRANSPORT_KINDS = [
  "prepared-public",
  "prepared-private-context",
  "status",
  "message-record",
  "panel-record",
  "cancel",
] as const;

export type HostTaskTransportKind =
  (typeof HOST_TASK_TRANSPORT_KINDS)[number];

export type HostTaskTransportEnvelope = {
  schemaVersion: typeof HOST_TASK_TRANSPORT_SCHEMA_VERSION;
  kind: HostTaskTransportKind;
  canonicalPayload: string;
  canonicalBytes: number;
  canonicalFingerprint: string;
};

export type RestoredHostTaskTransport = {
  value: Record<string, unknown>;
  transported: boolean;
  kind: HostTaskTransportKind | null;
};

const fingerprintPattern = /^fnv1a64:[0-9a-f]{16}$/u;
const textEncoder = new TextEncoder();
const kinds = new Set<string>(HOST_TASK_TRANSPORT_KINDS);
const envelopeKeys = [
  "schemaVersion",
  "kind",
  "canonicalPayload",
  "canonicalBytes",
  "canonicalFingerprint",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
) {
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  return actual.length === canonical.length &&
    actual.every((key, index) => key === canonical[index]);
}

function transportEnvelope(
  value: Record<string, unknown>,
  kind: HostTaskTransportKind,
): HostTaskTransportEnvelope {
  const canonicalPayload = serializeSixScreenValue(value);
  return {
    schemaVersion: HOST_TASK_TRANSPORT_SCHEMA_VERSION,
    kind,
    canonicalPayload,
    canonicalBytes: textEncoder.encode(canonicalPayload).byteLength,
    canonicalFingerprint: fingerprintSixScreenValue(value),
  };
}

/**
 * Carries the immutable canonical body separately from the host-facing object
 * mirror. A compatibility bridge may omit null object fields from the mirror;
 * it cannot change the serialized body without failing byte and fingerprint
 * checks. Authorization remains independent of this representation receipt.
 */
export function attachHostTaskTransport<T extends Record<string, unknown>>(
  value: T,
  kind: HostTaskTransportKind,
): T & { transport: HostTaskTransportEnvelope } {
  if (Object.prototype.hasOwnProperty.call(value, HOST_TASK_TRANSPORT_KEY)) {
    throw new Error("Host-task transport values cannot contain a transport field.");
  }
  return {
    ...structuredClone(value),
    [HOST_TASK_TRANSPORT_KEY]: transportEnvelope(value, kind),
  };
}

function validEnvelope(
  value: unknown,
  expectedKind?: HostTaskTransportKind,
): value is HostTaskTransportEnvelope {
  return isRecord(value) && hasExactKeys(value, envelopeKeys) &&
    value.schemaVersion === HOST_TASK_TRANSPORT_SCHEMA_VERSION &&
    typeof value.kind === "string" && kinds.has(value.kind) &&
    (expectedKind === undefined || value.kind === expectedKind) &&
    typeof value.canonicalPayload === "string" &&
    Number.isSafeInteger(value.canonicalBytes) &&
    (value.canonicalBytes as number) >= 2 &&
    (value.canonicalBytes as number) <= 512 * 1024 &&
    typeof value.canonicalFingerprint === "string" &&
    fingerprintPattern.test(value.canonicalFingerprint);
}

/** True only when `mirror` differs by omitted null-valued object keys. */
function isNullElidedMirror(canonical: unknown, mirror: unknown): boolean {
  if (Array.isArray(canonical)) {
    return Array.isArray(mirror) && canonical.length === mirror.length &&
      canonical.every((item, index) =>
        isNullElidedMirror(item, mirror[index])
      );
  }
  if (isRecord(canonical)) {
    if (!isRecord(mirror)) return false;
    const canonicalKeys = new Set(Object.keys(canonical));
    if (Object.keys(mirror).some((key) => !canonicalKeys.has(key))) return false;
    return Object.entries(canonical).every(([key, value]) =>
      Object.prototype.hasOwnProperty.call(mirror, key)
        ? isNullElidedMirror(value, mirror[key])
        : value === null
    );
  }
  return Object.is(canonical, mirror);
}

/** Restores one authoritative canonical body, or accepts an exact legacy v1 object. */
export function restoreHostTaskTransport(
  input: unknown,
  expectedKind?: HostTaskTransportKind,
): RestoredHostTaskTransport | null {
  if (!isRecord(input)) return null;
  if (!Object.prototype.hasOwnProperty.call(input, HOST_TASK_TRANSPORT_KEY)) {
    return {
      value: structuredClone(input),
      transported: false,
      kind: null,
    };
  }
  const envelope = input[HOST_TASK_TRANSPORT_KEY];
  if (!validEnvelope(envelope, expectedKind) ||
      textEncoder.encode(envelope.canonicalPayload).byteLength !==
        envelope.canonicalBytes) return null;
  let canonical: unknown;
  try {
    canonical = JSON.parse(envelope.canonicalPayload);
  } catch {
    return null;
  }
  if (!isRecord(canonical) ||
      serializeSixScreenValue(canonical) !== envelope.canonicalPayload ||
      fingerprintSixScreenValue(canonical) !== envelope.canonicalFingerprint) {
    return null;
  }
  const mirror = structuredClone(input);
  delete mirror[HOST_TASK_TRANSPORT_KEY];
  return isNullElidedMirror(canonical, mirror)
    ? { value: canonical, transported: true, kind: envelope.kind }
    : null;
}

/** Compare full and host-normalized copies without accepting other changes. */
export function sameHostTaskTransportValue(left: unknown, right: unknown) {
  const restoredLeft = restoreHostTaskTransport(left);
  const restoredRight = restoreHostTaskTransport(right);
  if (!restoredLeft || !restoredRight) return false;
  if (restoredLeft.transported || restoredRight.transported) {
    return restoredLeft.kind === restoredRight.kind &&
      sameSixScreenValue(restoredLeft.value, restoredRight.value);
  }
  return sameSixScreenValue(left, right);
}
