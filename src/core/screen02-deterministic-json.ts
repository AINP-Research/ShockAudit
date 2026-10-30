import { canonicalizeScreen01StudyContext } from "./screen01-context-codec";
import type { Screen01StudyContext } from "./scope-types";
import type { DeepReadonly } from "./screen02-types";

function fail(message: string): never {
  throw new Error(message);
}

function screen2Fail(message: string): never {
  fail(`Screen 2 ${message}`);
}

/**
 * JSON Canonicalization Scheme is unnecessary for these local records, but
 * sorting keys gives the handoff a deterministic, property-order-independent
 * serialization. Unsupported JSON values are rejected instead of silently
 * discarded.
 */
export function serializeDeterministicJson(value: unknown): string {
  const ancestors = new Set<object>();

  const serialize = (current: unknown): string => {
    if (current === null) return "null";
    if (typeof current === "string") return JSON.stringify(current);
    if (typeof current === "boolean") return current ? "true" : "false";
    if (typeof current === "number") {
      if (!Number.isFinite(current)) {
        screen2Fail("data must contain only finite numbers.");
      }
      return JSON.stringify(current);
    }
    if (
      typeof current === "undefined" ||
      typeof current === "function" ||
      typeof current === "symbol" ||
      typeof current === "bigint"
    ) {
      screen2Fail("data must be losslessly JSON serializable.");
    }
    if (typeof current !== "object") {
      screen2Fail("data contains an unsupported value.");
    }
    if (ancestors.has(current)) {
      screen2Fail("data must not contain circular references.");
    }

    ancestors.add(current);
    let serialized: string;
    if (Array.isArray(current)) {
      serialized = `[${current.map((entry) => serialize(entry)).join(",")}]`;
    } else {
      const prototype = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null) {
        ancestors.delete(current);
        screen2Fail("data must use plain JSON objects.");
      }
      serialized = `{${Object.keys(current)
        .sort()
        .map(
          (key) =>
            `${JSON.stringify(key)}:${serialize(
              (current as Record<string, unknown>)[key],
            )}`,
        )
        .join(",")}}`;
    }
    ancestors.delete(current);
    return serialized;
  };

  return serialize(value);
}

export function sameDeterministicJson(left: unknown, right: unknown) {
  return (
    serializeDeterministicJson(left) === serializeDeterministicJson(right)
  );
}

function fingerprintSerialized(serialized: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const bytes = new TextEncoder().encode(serialized);
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

export function serializeScreen01StudyContext(
  context: Screen01StudyContext | DeepReadonly<Screen01StudyContext>,
): string {
  const canonical = canonicalizeScreen01StudyContext(
    context as Screen01StudyContext,
  );
  const serialized = JSON.stringify(canonical);
  if (serialized === undefined) {
    fail("Screen 1 context must be JSON serializable.");
  }
  return serialized;
}

export function fingerprintScreen01StudyContext(
  context: Screen01StudyContext | DeepReadonly<Screen01StudyContext>,
): string {
  return fingerprintSerialized(serializeScreen01StudyContext(context));
}
