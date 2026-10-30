export const SIX_SCREEN_LEGACY_EXPORT_SCHEMA_VERSION =
  "shockaudit-legacy-read-only-export-v1" as const;
export const SIX_SCREEN_LEGACY_EXPORT_MAX_BYTES = 6 * 1024 * 1024;

const legacyRootKeys = [
  "screen01",
  "screen02",
  "screen02Workflow",
  "screen03Workflow",
  "screen04Workflow",
] as const;

const privateKeyPattern = /(?:^|_)(?:access|capability|receipt|bearer|response)?token(?:$|_)|secret|authorization|password|sealedSnapshot|accessTokenSha256/iu;
const privateQueryKeyPattern = /^(?:api[_-]?key|key|token|access[_-]?token|authorization)$/iu;

function sanitizedUrl(value: string) {
  if (!/^https?:\/\//iu.test(value)) return value;
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    for (const key of [...url.searchParams.keys()]) {
      if (privateQueryKeyPattern.test(key)) url.searchParams.set(key, "[redacted]");
    }
    return url.toString();
  } catch {
    return value;
  }
}

function sanitize(value: unknown, seen: WeakSet<object>, depth: number): unknown {
  if (depth > 32) throw new Error("Legacy export nesting exceeds the safe limit.");
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }
  if (typeof value === "string") return sanitizedUrl(value);
  if (typeof value !== "object") return undefined;
  if (seen.has(value)) throw new Error("Legacy export contains a circular value.");
  seen.add(value);
  if (Array.isArray(value)) {
    const result = value.map((item) => sanitize(item, seen, depth + 1))
      .filter((item) => item !== undefined);
    seen.delete(value);
    return result;
  }
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (privateKeyPattern.test(key)) continue;
    const sanitized = sanitize(item, seen, depth + 1);
    if (sanitized !== undefined) result[key] = sanitized;
  }
  seen.delete(value);
  return result;
}

export function createLegacyReadOnlyExport(
  widgetState: unknown,
  exportedAt: string,
) {
  const milliseconds = Date.parse(exportedAt);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== exportedAt) {
    throw new Error("Legacy export time must be a canonical ISO instant.");
  }
  if (!widgetState || typeof widgetState !== "object" || Array.isArray(widgetState)) {
    throw new Error("No saved legacy workflow is available to export.");
  }
  const wrapper = widgetState as Record<string, unknown>;
  const state = wrapper.privateContent && typeof wrapper.privateContent === "object" &&
      !Array.isArray(wrapper.privateContent)
    ? wrapper.privateContent as Record<string, unknown>
    : wrapper;
  const legacy: Record<string, unknown> = {};
  for (const key of legacyRootKeys) {
    if (state[key] !== undefined) {
      legacy[key] = sanitize(state[key], new WeakSet(), 0);
    }
  }
  if (!Object.keys(legacy).length) {
    throw new Error("No saved legacy workflow is available to export.");
  }
  const result = {
    schemaVersion: SIX_SCREEN_LEGACY_EXPORT_SCHEMA_VERSION,
    disposition: "read_only" as const,
    exportedAt,
    migration: {
      automaticConversion: false,
      selectedCandidateBecameConfirmedShock: false,
    },
    legacy,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(result)).byteLength;
  if (bytes > SIX_SCREEN_LEGACY_EXPORT_MAX_BYTES) {
    throw new Error("Saved legacy workflow exceeds the safe export capacity.");
  }
  return result;
}
