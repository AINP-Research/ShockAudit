import { serializeDeterministicJson } from "./screen02-deterministic-json";
import {
  restoreScreen02WorkflowClientSnapshot,
  type Screen02WorkflowClientSnapshot,
} from "./screen02-workflow-client";

export const SCREEN_02_SEALED_RESULT_SCHEMA_VERSION =
  "screen-02-workflow-sealed-result-v1" as const;
export const SCREEN_02_SEALED_RESULT_ALGORITHM = "A256GCM" as const;
export const SCREEN_02_RESPONSE_KEY_BYTES = 32 as const;
export const SCREEN_02_SEALED_RESULT_IV_BYTES = 12 as const;
export const SCREEN_02_SEALED_RESULT_MAX_PLAINTEXT_BYTES =
  4 * 1024 * 1024;

const AES_GCM_TAG_BYTES = 16;
const SHA_256_BYTES = 32;
const IDENTIFIER_MAX_CHARACTERS = 200;
const MAX_CIPHERTEXT_BYTES =
  SCREEN_02_SEALED_RESULT_MAX_PLAINTEXT_BYTES + AES_GCM_TAG_BYTES;
const MAX_CIPHERTEXT_CHARACTERS = Math.ceil(
  (MAX_CIPHERTEXT_BYTES * 4) / 3,
);
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const RESPONSE_KEY_TEXT_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SEALED_RESULT_KEYS = [
  "schemaVersion",
  "algorithm",
  "kind",
  "operationId",
  "keyId",
  "iv",
  "ciphertext",
] as const;
const RESPONSE_KEY_MATERIAL_KEYS = ["keyId", "key"] as const;

export type Screen02SealedResultKind = "open" | "mutation";

/**
 * The widget retains this extractable CryptoKey in memory. Only the exported
 * form is sent to the workflow tool that must encrypt the private response.
 */
export type Screen02ResponseKeyMaterial = {
  readonly keyId: string;
  readonly key: CryptoKey;
};

/**
 * One-call response key input. `key` is exactly 32 random bytes encoded as
 * canonical, unpadded base64url. It must not be persisted or logged.
 */
export type Screen02ExportedResponseKeyMaterial = {
  keyId: string;
  key: string;
};

/**
 * Authenticated component-only result. The AES-GCM additional authenticated
 * data also contains every routing field outside the ciphertext.
 */
export type Screen02SealedResult = {
  schemaVersion: typeof SCREEN_02_SEALED_RESULT_SCHEMA_VERSION;
  algorithm: typeof SCREEN_02_SEALED_RESULT_ALGORITHM;
  kind: Screen02SealedResultKind;
  operationId: string;
  keyId: string;
  iv: string;
  ciphertext: string;
};

export type SealScreen02WorkflowClientSnapshotInput = {
  operationId: string;
  kind: Screen02SealedResultKind;
  responseKey: Screen02ExportedResponseKeyMaterial;
};

export type DecryptScreen02WorkflowClientSnapshotInput = {
  operationId: string;
  kind: Screen02SealedResultKind;
  responseKey: Screen02ResponseKeyMaterial;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(message: string): never {
  throw new Error(message);
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function isOperationId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= IDENTIFIER_MAX_CHARACTERS &&
    value.trim() === value
  );
}

function isKind(value: unknown): value is Screen02SealedResultKind {
  return value === "open" || value === "mutation";
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

function base64UrlToBytes(
  value: unknown,
  options: {
    exactBytes?: number;
    minimumBytes?: number;
    maximumBytes: number;
    maximumCharacters: number;
  },
) {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > options.maximumCharacters ||
    !BASE64URL_PATTERN.test(value) ||
    value.length % 4 === 1
  ) {
    fail("Screen 2 sealed result contains invalid base64url.");
  }
  const padded = `${value.replaceAll("-", "+").replaceAll("_", "/")}${"=".repeat(
    (4 - (value.length % 4)) % 4,
  )}`;
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    fail("Screen 2 sealed result contains invalid base64url.");
  }
  const bytes = Uint8Array.from(binary, (character) =>
    character.charCodeAt(0),
  );
  if (
    bytes.byteLength > options.maximumBytes ||
    (options.exactBytes !== undefined &&
      bytes.byteLength !== options.exactBytes) ||
    (options.minimumBytes !== undefined &&
      bytes.byteLength < options.minimumBytes) ||
    bytesToBase64Url(bytes) !== value
  ) {
    fail("Screen 2 sealed result contains invalid base64url.");
  }
  return bytes;
}

// Screen 3 uses the same canonical base64url codec. Sharing these internal
// helpers keeps the widget bundle from carrying a second byte-for-byte copy.
export {
  base64UrlToBytes as screen02SealedResultBase64UrlToBytes,
  bytesToBase64Url as screen02SealedResultBytesToBase64Url,
};

function responseKeyBytes(value: unknown) {
  if (
    typeof value !== "string" ||
    !RESPONSE_KEY_TEXT_PATTERN.test(value)
  ) {
    fail("Screen 2 response key failed validation.");
  }
  try {
    return base64UrlToBytes(value, {
      exactBytes: SCREEN_02_RESPONSE_KEY_BYTES,
      maximumBytes: SCREEN_02_RESPONSE_KEY_BYTES,
      maximumCharacters: 43,
    });
  } catch {
    fail("Screen 2 response key failed validation.");
  }
}

function responseKeyIdBytes(value: unknown) {
  if (
    typeof value !== "string" ||
    !RESPONSE_KEY_TEXT_PATTERN.test(value)
  ) {
    fail("Screen 2 response key identifier failed validation.");
  }
  try {
    return base64UrlToBytes(value, {
      exactBytes: SHA_256_BYTES,
      maximumBytes: SHA_256_BYTES,
      maximumCharacters: 43,
    });
  } catch {
    fail("Screen 2 response key identifier failed validation.");
  }
}

async function keyIdFromRawKey(raw: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(raw));
  return bytesToBase64Url(new Uint8Array(digest));
}

function additionalAuthenticatedData(input: {
  kind: Screen02SealedResultKind;
  operationId: string;
  keyId: string;
}) {
  return new TextEncoder().encode(
    serializeDeterministicJson({
      schemaVersion: SCREEN_02_SEALED_RESULT_SCHEMA_VERSION,
      algorithm: SCREEN_02_SEALED_RESULT_ALGORITHM,
      kind: input.kind,
      operationId: input.operationId,
      keyId: input.keyId,
    }),
  );
}

async function validatedExportedResponseKey(
  value: unknown,
): Promise<{ keyId: string; raw: Uint8Array }> {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, RESPONSE_KEY_MATERIAL_KEYS)
  ) {
    fail("Screen 2 response key failed validation.");
  }
  responseKeyIdBytes(value.keyId);
  const raw = responseKeyBytes(value.key);
  if ((await keyIdFromRawKey(raw)) !== value.keyId) {
    fail("Screen 2 response key failed validation.");
  }
  return { keyId: value.keyId as string, raw };
}

async function validatedInMemoryResponseKey(
  value: unknown,
): Promise<Screen02ResponseKeyMaterial> {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, RESPONSE_KEY_MATERIAL_KEYS)
  ) {
    fail("Screen 2 response key failed validation.");
  }
  responseKeyIdBytes(value.keyId);
  const key = value.key as CryptoKey;
  if (
    !key ||
    typeof key !== "object" ||
    key.type !== "secret" ||
    key.algorithm?.name !== "AES-GCM" ||
    (key.algorithm as AesKeyAlgorithm).length !== 256 ||
    !key.extractable ||
    !key.usages.includes("decrypt")
  ) {
    fail("Screen 2 response key failed validation.");
  }
  let exported: ArrayBuffer;
  try {
    exported = await crypto.subtle.exportKey("raw", key);
  } catch {
    fail("Screen 2 response key failed validation.");
  }
  const raw = new Uint8Array(exported);
  const invalid =
    raw.byteLength !== SCREEN_02_RESPONSE_KEY_BYTES ||
    (await keyIdFromRawKey(raw)) !== value.keyId;
  raw.fill(0);
  if (invalid) {
    fail("Screen 2 response key failed validation.");
  }
  return { keyId: value.keyId as string, key };
}

/** Generate a fresh per-operation AES-256-GCM key inside the widget. */
export async function generateScreen02ResponseKeyMaterial(): Promise<Screen02ResponseKeyMaterial> {
  const raw = crypto.getRandomValues(
    new Uint8Array(SCREEN_02_RESPONSE_KEY_BYTES),
  );
  const keyId = await keyIdFromRawKey(raw);
  const key = await crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM" },
    true,
    ["decrypt"],
  );
  raw.fill(0);
  return Object.freeze({ keyId, key });
}

/** Export a generated key as the exact bounded object accepted by a tool. */
export async function exportScreen02ResponseKeyMaterial(
  material: Screen02ResponseKeyMaterial,
): Promise<Screen02ExportedResponseKeyMaterial> {
  const validated = await validatedInMemoryResponseKey(material);
  const exported = new Uint8Array(
    await crypto.subtle.exportKey("raw", validated.key),
  );
  const key = bytesToBase64Url(exported);
  exported.fill(0);
  return {
    keyId: validated.keyId,
    key,
  };
}

/**
 * Validate app-supplied exported key material before any canonical workflow
 * operation runs. This keeps malformed or mismatched key IDs from committing
 * state that the server cannot subsequently seal for the widget.
 */
export async function validateScreen02ExportedResponseKeyMaterial(
  value: unknown,
): Promise<Screen02ExportedResponseKeyMaterial> {
  const validated = await validatedExportedResponseKey(value);
  const key = bytesToBase64Url(validated.raw);
  validated.raw.fill(0);
  return { keyId: validated.keyId, key };
}

/** Strictly restore the public sealed-result transport shape. */
export function restoreScreen02SealedResult(
  value: unknown,
): Screen02SealedResult | null {
  try {
    if (
      !isRecord(value) ||
      !hasExactKeys(value, SEALED_RESULT_KEYS) ||
      value.schemaVersion !== SCREEN_02_SEALED_RESULT_SCHEMA_VERSION ||
      value.algorithm !== SCREEN_02_SEALED_RESULT_ALGORITHM ||
      !isKind(value.kind) ||
      !isOperationId(value.operationId)
    ) {
      return null;
    }
    responseKeyIdBytes(value.keyId);
    base64UrlToBytes(value.iv, {
      exactBytes: SCREEN_02_SEALED_RESULT_IV_BYTES,
      maximumBytes: SCREEN_02_SEALED_RESULT_IV_BYTES,
      maximumCharacters: 16,
    });
    base64UrlToBytes(value.ciphertext, {
      minimumBytes: AES_GCM_TAG_BYTES + 1,
      maximumBytes: MAX_CIPHERTEXT_BYTES,
      maximumCharacters: MAX_CIPHERTEXT_CHARACTERS,
    });
    return {
      schemaVersion: SCREEN_02_SEALED_RESULT_SCHEMA_VERSION,
      algorithm: SCREEN_02_SEALED_RESULT_ALGORITHM,
      kind: value.kind,
      operationId: value.operationId,
      keyId: value.keyId as string,
      iv: value.iv as string,
      ciphertext: value.ciphertext as string,
    };
  } catch {
    return null;
  }
}

/**
 * Encrypt a validated private workflow snapshot for one exact operation.
 * Only the sealed transport is returned; plaintext and response key are never
 * written to logging or error messages.
 */
export async function sealScreen02WorkflowClientSnapshot(
  snapshotValue: Screen02WorkflowClientSnapshot,
  input: SealScreen02WorkflowClientSnapshotInput,
): Promise<Screen02SealedResult> {
  const snapshot = restoreScreen02WorkflowClientSnapshot(snapshotValue);
  if (!snapshot) {
    fail("Screen 2 workflow snapshot failed validation.");
  }
  if (!isOperationId(input.operationId) || !isKind(input.kind)) {
    fail("Screen 2 sealed-result context failed validation.");
  }
  const responseKey = await validatedExportedResponseKey(input.responseKey);
  const plaintext = new TextEncoder().encode(
    serializeDeterministicJson(snapshot),
  );
  if (
    plaintext.byteLength < 1 ||
    plaintext.byteLength > SCREEN_02_SEALED_RESULT_MAX_PLAINTEXT_BYTES
  ) {
    fail("Screen 2 workflow snapshot exceeds its sealed limit.");
  }
  let key: CryptoKey;
  const rawKey = Uint8Array.from(responseKey.raw);
  try {
    key = await crypto.subtle.importKey(
      "raw",
      rawKey,
      { name: "AES-GCM" },
      false,
      ["encrypt"],
    );
  } finally {
    rawKey.fill(0);
    responseKey.raw.fill(0);
  }
  const iv = crypto.getRandomValues(
    new Uint8Array(SCREEN_02_SEALED_RESULT_IV_BYTES),
  );
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: additionalAuthenticatedData({
          kind: input.kind,
          operationId: input.operationId,
          keyId: responseKey.keyId,
        }),
        tagLength: AES_GCM_TAG_BYTES * 8,
      },
      key,
      plaintext,
    ),
  );
  const sealed: Screen02SealedResult = {
    schemaVersion: SCREEN_02_SEALED_RESULT_SCHEMA_VERSION,
    algorithm: SCREEN_02_SEALED_RESULT_ALGORITHM,
    kind: input.kind,
    operationId: input.operationId,
    keyId: responseKey.keyId,
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(ciphertext),
  };
  if (!restoreScreen02SealedResult(sealed)) {
    fail("Screen 2 sealed result failed validation.");
  }
  return sealed;
}

/**
 * Authenticate, decrypt, and restore one private workflow snapshot. Any shape,
 * context, key, authentication, canonicalization, or snapshot error rejects.
 */
export async function decryptScreen02WorkflowClientSnapshot(
  sealedValue: unknown,
  input: DecryptScreen02WorkflowClientSnapshotInput,
): Promise<Screen02WorkflowClientSnapshot> {
  const sealed = restoreScreen02SealedResult(sealedValue);
  if (!sealed) {
    fail("Screen 2 sealed result failed validation.");
  }
  if (
    !isOperationId(input.operationId) ||
    !isKind(input.kind) ||
    sealed.operationId !== input.operationId ||
    sealed.kind !== input.kind
  ) {
    fail("Screen 2 sealed-result context failed validation.");
  }
  const responseKey = await validatedInMemoryResponseKey(input.responseKey);
  if (sealed.keyId !== responseKey.keyId) {
    fail("Screen 2 sealed-result response key does not match.");
  }
  const iv = base64UrlToBytes(sealed.iv, {
    exactBytes: SCREEN_02_SEALED_RESULT_IV_BYTES,
    maximumBytes: SCREEN_02_SEALED_RESULT_IV_BYTES,
    maximumCharacters: 16,
  });
  const ciphertext = base64UrlToBytes(sealed.ciphertext, {
    minimumBytes: AES_GCM_TAG_BYTES + 1,
    maximumBytes: MAX_CIPHERTEXT_BYTES,
    maximumCharacters: MAX_CIPHERTEXT_CHARACTERS,
  });
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: additionalAuthenticatedData({
          kind: sealed.kind,
          operationId: sealed.operationId,
          keyId: sealed.keyId,
        }),
        tagLength: AES_GCM_TAG_BYTES * 8,
      },
      responseKey.key,
      ciphertext,
    );
  } catch {
    fail("Screen 2 sealed result authentication failed.");
  }
  if (
    plaintext.byteLength < 1 ||
    plaintext.byteLength > SCREEN_02_SEALED_RESULT_MAX_PLAINTEXT_BYTES
  ) {
    fail("Screen 2 sealed result plaintext failed validation.");
  }
  let canonical: string;
  try {
    canonical = new TextDecoder("utf-8", { fatal: true }).decode(plaintext);
  } catch {
    fail("Screen 2 sealed result plaintext failed validation.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(canonical) as unknown;
  } catch {
    fail("Screen 2 sealed result plaintext failed validation.");
  }
  try {
    if (serializeDeterministicJson(parsed) !== canonical) {
      fail("noncanonical");
    }
  } catch {
    fail("Screen 2 sealed result plaintext failed validation.");
  }
  const snapshot = restoreScreen02WorkflowClientSnapshot(parsed);
  if (!snapshot) {
    fail("Screen 2 sealed result snapshot failed validation.");
  }
  return snapshot;
}
