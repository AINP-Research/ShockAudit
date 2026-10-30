const textEncoder = new TextEncoder();

export const SIX_SCREEN_FINGERPRINT_PATTERN =
  /^fnv1a64:[0-9a-f]{16}$/u;

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value === "string" ||
    typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Six-screen canonical values cannot contain non-finite numbers.");
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .filter((key) => record[key] !== undefined)
        .map((key) => [key, canonicalize(record[key])]),
    );
  }
  throw new Error("Six-screen canonical values must be JSON-compatible.");
}

export function serializeSixScreenValue(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

/**
 * Stable state-addressing fingerprint. Authorization remains a separate,
 * cryptographically protected concern; this fingerprint detects stale or
 * mismatched workflow values and is never an access token.
 */
export function fingerprintSixScreenValue(value: unknown) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of textEncoder.encode(serializeSixScreenValue(value))) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

export function sameSixScreenValue(left: unknown, right: unknown) {
  return serializeSixScreenValue(left) === serializeSixScreenValue(right);
}
