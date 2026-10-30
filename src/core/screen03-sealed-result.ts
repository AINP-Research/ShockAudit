import {
  exportScreen02ResponseKeyMaterial,
  screen02SealedResultBase64UrlToBytes as base64UrlToBytes,
  screen02SealedResultBytesToBase64Url as bytesToBase64Url,
  validateScreen02ExportedResponseKeyMaterial,
  type Screen02ExportedResponseKeyMaterial,
  type Screen02ResponseKeyMaterial,
} from "./screen02-sealed-result";
import { serializeDeterministicJson } from "./screen02-deterministic-json";
import {
  restoreScreen03VerificationState,
  serializeScreen03VerificationState,
  type Screen03VerificationState,
} from "./screen03-workflow";

export const SCREEN_03_SEALED_RESULT_SCHEMA_VERSION =
  "screen-03-workflow-sealed-result-v1" as const;
export const SCREEN_03_SEALED_RESULT_ALGORITHM = "A256GCM" as const;
export const SCREEN_03_SEALED_RESULT_MAX_PLAINTEXT_BYTES = 4 * 1024 * 1024;

const AES_GCM_TAG_BYTES = 16;
const IV_BYTES = 12;
const IDENTIFIER_MAX_CHARACTERS = 200;
const MAX_CIPHERTEXT_BYTES =
  SCREEN_03_SEALED_RESULT_MAX_PLAINTEXT_BYTES + AES_GCM_TAG_BYTES;
const MAX_CIPHERTEXT_CHARACTERS = Math.ceil(
  (MAX_CIPHERTEXT_BYTES * 4) / 3,
);
const KEY_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SEALED_RESULT_KEYS = [
  "schemaVersion",
  "algorithm",
  "kind",
  "operationId",
  "keyId",
  "iv",
  "ciphertext",
] as const;

export type Screen03SealedResultKind = "open" | "mutation";

export type Screen03SealedResult = {
  schemaVersion: typeof SCREEN_03_SEALED_RESULT_SCHEMA_VERSION;
  algorithm: typeof SCREEN_03_SEALED_RESULT_ALGORITHM;
  kind: Screen03SealedResultKind;
  operationId: string;
  keyId: string;
  iv: string;
  ciphertext: string;
};

type SealInput = {
  operationId: string;
  kind: Screen03SealedResultKind;
  responseKey: Screen02ExportedResponseKeyMaterial;
};

type DecryptInput = {
  operationId: string;
  kind: Screen03SealedResultKind;
  responseKey: Screen02ResponseKeyMaterial;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(message: string): never {
  throw new Error(message);
}

function exact(value: Record<string, unknown>, keys: readonly string[]) {
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

function isKind(value: unknown): value is Screen03SealedResultKind {
  return value === "open" || value === "mutation";
}

function additionalAuthenticatedData(input: {
  kind: Screen03SealedResultKind;
  operationId: string;
  keyId: string;
}) {
  return new TextEncoder().encode(
    serializeDeterministicJson({
      schemaVersion: SCREEN_03_SEALED_RESULT_SCHEMA_VERSION,
      algorithm: SCREEN_03_SEALED_RESULT_ALGORITHM,
      kind: input.kind,
      operationId: input.operationId,
      keyId: input.keyId,
    }),
  );
}

/** Restore only the bounded, opaque transport envelope. */
export function restoreScreen03SealedResult(
  value: unknown,
): Screen03SealedResult | null {
  try {
    if (
      !record(value) ||
      !exact(value, SEALED_RESULT_KEYS) ||
      value.schemaVersion !== SCREEN_03_SEALED_RESULT_SCHEMA_VERSION ||
      value.algorithm !== SCREEN_03_SEALED_RESULT_ALGORITHM ||
      !isKind(value.kind) ||
      !isOperationId(value.operationId) ||
      typeof value.keyId !== "string" ||
      !KEY_ID_PATTERN.test(value.keyId)
    ) {
      return null;
    }
    base64UrlToBytes(value.keyId, {
      exactBytes: 32,
      maximumBytes: 32,
      maximumCharacters: 43,
    });
    base64UrlToBytes(value.iv, {
      exactBytes: IV_BYTES,
      maximumBytes: IV_BYTES,
      maximumCharacters: 16,
    });
    base64UrlToBytes(value.ciphertext, {
      minimumBytes: AES_GCM_TAG_BYTES + 1,
      maximumBytes: MAX_CIPHERTEXT_BYTES,
      maximumCharacters: MAX_CIPHERTEXT_CHARACTERS,
    });
    return {
      schemaVersion: SCREEN_03_SEALED_RESULT_SCHEMA_VERSION,
      algorithm: SCREEN_03_SEALED_RESULT_ALGORITHM,
      kind: value.kind,
      operationId: value.operationId,
      keyId: value.keyId,
      iv: value.iv as string,
      ciphertext: value.ciphertext as string,
    };
  } catch {
    return null;
  }
}

/** Encrypt one exact canonical Screen 3 state for one widget operation. */
export async function sealScreen03VerificationState(
  stateValue: Screen03VerificationState,
  input: SealInput,
): Promise<Screen03SealedResult> {
  const state = restoreScreen03VerificationState(stateValue);
  if (!state) fail("Screen 3 workflow state failed validation.");
  if (!isOperationId(input.operationId) || !isKind(input.kind)) {
    fail("Screen 3 sealed-result context failed validation.");
  }
  const responseKey = await validateScreen02ExportedResponseKeyMaterial(
    input.responseKey,
  );
  const plaintext = new TextEncoder().encode(
    serializeScreen03VerificationState(state),
  );
  if (
    plaintext.byteLength < 1 ||
    plaintext.byteLength > SCREEN_03_SEALED_RESULT_MAX_PLAINTEXT_BYTES
  ) {
    fail("Screen 3 workflow state exceeds its sealed limit.");
  }
  const rawKey = base64UrlToBytes(responseKey.key, {
    exactBytes: 32,
    maximumBytes: 32,
    maximumCharacters: 43,
  });
  let key: CryptoKey;
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
  }
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
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
  const sealed: Screen03SealedResult = {
    schemaVersion: SCREEN_03_SEALED_RESULT_SCHEMA_VERSION,
    algorithm: SCREEN_03_SEALED_RESULT_ALGORITHM,
    kind: input.kind,
    operationId: input.operationId,
    keyId: responseKey.keyId,
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(ciphertext),
  };
  if (!restoreScreen03SealedResult(sealed)) {
    fail("Screen 3 sealed result failed validation.");
  }
  return sealed;
}

/** Authenticate, decrypt, canonicalize, and strictly restore Screen 3 state. */
export async function decryptScreen03VerificationState(
  sealedValue: unknown,
  input: DecryptInput,
): Promise<Screen03VerificationState> {
  const sealed = restoreScreen03SealedResult(sealedValue);
  if (!sealed) fail("Screen 3 sealed result failed validation.");
  if (
    !isOperationId(input.operationId) ||
    !isKind(input.kind) ||
    sealed.operationId !== input.operationId ||
    sealed.kind !== input.kind
  ) {
    fail("Screen 3 sealed-result context failed validation.");
  }
  const exported = await exportScreen02ResponseKeyMaterial(input.responseKey);
  if (sealed.keyId !== exported.keyId) {
    fail("Screen 3 sealed-result response key does not match.");
  }
  const iv = base64UrlToBytes(sealed.iv, {
    exactBytes: IV_BYTES,
    maximumBytes: IV_BYTES,
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
      input.responseKey.key,
      ciphertext,
    );
  } catch {
    fail("Screen 3 sealed result authentication failed.");
  }
  if (
    plaintext.byteLength < 1 ||
    plaintext.byteLength > SCREEN_03_SEALED_RESULT_MAX_PLAINTEXT_BYTES
  ) {
    fail("Screen 3 sealed result plaintext failed validation.");
  }
  let canonical: string;
  try {
    canonical = new TextDecoder("utf-8", { fatal: true }).decode(plaintext);
  } catch {
    fail("Screen 3 sealed result plaintext failed validation.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(canonical) as unknown;
  } catch {
    fail("Screen 3 sealed result plaintext failed validation.");
  }
  const state = restoreScreen03VerificationState(parsed);
  if (!state) fail("Screen 3 sealed result state failed validation.");
  if (serializeScreen03VerificationState(state) !== canonical) {
    fail("Screen 3 sealed result plaintext failed validation.");
  }
  return state;
}
