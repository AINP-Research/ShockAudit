import { describe, expect, it } from "vitest";

import {
  SCREEN_02_SEALED_RESULT_ALGORITHM,
  SCREEN_02_SEALED_RESULT_SCHEMA_VERSION,
  decryptScreen02WorkflowClientSnapshot,
  exportScreen02ResponseKeyMaterial,
  generateScreen02ResponseKeyMaterial,
  restoreScreen02SealedResult,
  sealScreen02WorkflowClientSnapshot,
  validateScreen02ExportedResponseKeyMaterial,
  type Screen02SealedResult,
} from "../../src/core/screen02-sealed-result";
import { serializeDeterministicJson } from "../../src/core/screen02-service";
import { encodeScreen02FindWorkflowStateEnvelope } from "../../src/core/screen02-workflow-envelope";
import {
  SCREEN_02_WORKFLOW_CLIENT_SCHEMA_VERSION,
  restoreScreen02WorkflowClientSnapshot,
  type Screen02WorkflowClientSnapshot,
} from "../../src/core/screen02-workflow-client";
import {
  createScreen02FindState,
  fingerprintScreen02WorkflowState,
} from "../../src/core/screen02-workflow-state";
import { confirmedWorkflowFindContext } from "./screen02-workflow-fixtures";

function fixtureSnapshot(): Screen02WorkflowClientSnapshot {
  const state = createScreen02FindState(
    confirmedWorkflowFindContext(),
    "sealed-result-find-run",
    "2026-08-11T16:00:00.000Z",
  );
  const snapshot = restoreScreen02WorkflowClientSnapshot({
    schemaVersion: SCREEN_02_WORKFLOW_CLIENT_SCHEMA_VERSION,
    runId: state.runId,
    accessToken: "sealed-result-private-access-token",
    mode: state.mode,
    revision: state.revision,
    stateFingerprint: fingerprintScreen02WorkflowState(state),
    stateEnvelope: encodeScreen02FindWorkflowStateEnvelope(state),
    assessmentAvailable: false,
    assessmentBatch: null,
    handoff: null,
  });
  if (!snapshot) throw new Error("Expected a valid sealed-result fixture.");
  return snapshot;
}

function changeCanonicalCharacter(value: string) {
  return `${value[0] === "A" ? "B" : "A"}${value.slice(1)}`;
}

function rawBase64UrlToBytes(value: string) {
  const padded = `${value.replaceAll("-", "+").replaceAll("_", "/")}${"=".repeat(
    (4 - (value.length % 4)) % 4,
  )}`;
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

async function sealArbitraryPlaintext(
  canonicalPlaintext: string,
  operationId: string,
  kind: "open" | "mutation",
) {
  const material = await generateScreen02ResponseKeyMaterial();
  const exported = await exportScreen02ResponseKeyMaterial(material);
  const raw = rawBase64UrlToBytes(exported.key);
  const key = await crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const additionalData = new TextEncoder().encode(
    serializeDeterministicJson({
      schemaVersion: SCREEN_02_SEALED_RESULT_SCHEMA_VERSION,
      algorithm: SCREEN_02_SEALED_RESULT_ALGORITHM,
      kind,
      operationId,
      keyId: exported.keyId,
    }),
  );
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData,
        tagLength: 128,
      },
      key,
      new TextEncoder().encode(canonicalPlaintext),
    ),
  );
  return {
    material,
    sealed: {
      schemaVersion: SCREEN_02_SEALED_RESULT_SCHEMA_VERSION,
      algorithm: SCREEN_02_SEALED_RESULT_ALGORITHM,
      kind,
      operationId,
      keyId: exported.keyId,
      iv: bytesToBase64Url(iv),
      ciphertext: bytesToBase64Url(ciphertext),
    } satisfies Screen02SealedResult,
  };
}

describe("Screen 2 sealed workflow-result transport", () => {
  it("generates and exports a fresh canonical 32-byte response key with a SHA-256 key ID", async () => {
    const first = await generateScreen02ResponseKeyMaterial();
    const second = await generateScreen02ResponseKeyMaterial();
    const firstExport = await exportScreen02ResponseKeyMaterial(first);
    const repeatedExport = await exportScreen02ResponseKeyMaterial(first);
    const secondExport = await exportScreen02ResponseKeyMaterial(second);

    expect(firstExport).toEqual(repeatedExport);
    expect(firstExport.key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(firstExport.keyId).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(firstExport).not.toEqual(secondExport);
    const digest = new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        rawBase64UrlToBytes(firstExport.key),
      ),
    );
    expect(bytesToBase64Url(digest)).toBe(firstExport.keyId);
  });

  it("round-trips a validated private snapshot without exposing its key or plaintext", async () => {
    const snapshot = fixtureSnapshot();
    const responseKey = await generateScreen02ResponseKeyMaterial();
    const exported = await exportScreen02ResponseKeyMaterial(responseKey);
    const sealed = await sealScreen02WorkflowClientSnapshot(snapshot, {
      operationId: "open-operation-1",
      kind: "open",
      responseKey: exported,
    });

    expect(Object.keys(sealed).sort()).toEqual(
      [
        "schemaVersion",
        "algorithm",
        "kind",
        "operationId",
        "keyId",
        "iv",
        "ciphertext",
      ].sort(),
    );
    expect(sealed.iv).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(JSON.stringify(sealed)).not.toContain(exported.key);
    expect(JSON.stringify(sealed)).not.toContain(snapshot.accessToken);
    expect(restoreScreen02SealedResult(sealed)).toEqual(sealed);
    await expect(
      decryptScreen02WorkflowClientSnapshot(sealed, {
        operationId: "open-operation-1",
        kind: "open",
        responseKey,
      }),
    ).resolves.toEqual(snapshot);
  });

  it("fails closed for ciphertext and IV tampering and for the wrong response key", async () => {
    const snapshot = fixtureSnapshot();
    const responseKey = await generateScreen02ResponseKeyMaterial();
    const exported = await exportScreen02ResponseKeyMaterial(responseKey);
    const sealed = await sealScreen02WorkflowClientSnapshot(snapshot, {
      operationId: "mutation-operation-1",
      kind: "mutation",
      responseKey: exported,
    });
    const wrongKey = await generateScreen02ResponseKeyMaterial();

    await expect(
      decryptScreen02WorkflowClientSnapshot(
        {
          ...sealed,
          ciphertext: changeCanonicalCharacter(sealed.ciphertext),
        },
        {
          operationId: sealed.operationId,
          kind: sealed.kind,
          responseKey,
        },
      ),
    ).rejects.toThrow(/authentication failed/i);
    await expect(
      decryptScreen02WorkflowClientSnapshot(
        { ...sealed, iv: changeCanonicalCharacter(sealed.iv) },
        {
          operationId: sealed.operationId,
          kind: sealed.kind,
          responseKey,
        },
      ),
    ).rejects.toThrow(/authentication failed/i);
    await expect(
      decryptScreen02WorkflowClientSnapshot(sealed, {
        operationId: sealed.operationId,
        kind: sealed.kind,
        responseKey: wrongKey,
      }),
    ).rejects.toThrow(/does not match/i);
  });

  it("binds the operation and kind into AES-GCM additional authenticated data", async () => {
    const snapshot = fixtureSnapshot();
    const responseKey = await generateScreen02ResponseKeyMaterial();
    const exported = await exportScreen02ResponseKeyMaterial(responseKey);
    const sealed = await sealScreen02WorkflowClientSnapshot(snapshot, {
      operationId: "aad-bound-operation",
      kind: "open",
      responseKey: exported,
    });

    await expect(
      decryptScreen02WorkflowClientSnapshot(sealed, {
        operationId: "wrong-operation",
        kind: "open",
        responseKey,
      }),
    ).rejects.toThrow(/context failed/i);
    await expect(
      decryptScreen02WorkflowClientSnapshot(sealed, {
        operationId: sealed.operationId,
        kind: "mutation",
        responseKey,
      }),
    ).rejects.toThrow(/context failed/i);
    await expect(
      decryptScreen02WorkflowClientSnapshot(
        { ...sealed, operationId: "aad-rewritten-operation" },
        {
          operationId: "aad-rewritten-operation",
          kind: "open",
          responseKey,
        },
      ),
    ).rejects.toThrow(/authentication failed/i);
    await expect(
      decryptScreen02WorkflowClientSnapshot(
        { ...sealed, kind: "mutation" },
        {
          operationId: sealed.operationId,
          kind: "mutation",
          responseKey,
        },
      ),
    ).rejects.toThrow(/authentication failed/i);
  });

  it("rejects non-exact transports, noncanonical base64url, and mismatched exported key IDs", async () => {
    const snapshot = fixtureSnapshot();
    const responseKey = await generateScreen02ResponseKeyMaterial();
    const otherKey = await generateScreen02ResponseKeyMaterial();
    const exported = await exportScreen02ResponseKeyMaterial(responseKey);
    const otherExport = await exportScreen02ResponseKeyMaterial(otherKey);
    const sealed = await sealScreen02WorkflowClientSnapshot(snapshot, {
      operationId: "strict-shape-operation",
      kind: "open",
      responseKey: exported,
    });

    expect(restoreScreen02SealedResult({ ...sealed, extra: true })).toBeNull();
    expect(
      restoreScreen02SealedResult({ ...sealed, ciphertext: `${sealed.ciphertext}=` }),
    ).toBeNull();
    expect(restoreScreen02SealedResult({ ...sealed, iv: "AA" })).toBeNull();
    await expect(
      sealScreen02WorkflowClientSnapshot(snapshot, {
        operationId: "strict-shape-operation",
        kind: "open",
        responseKey: { keyId: otherExport.keyId, key: exported.key },
      }),
    ).rejects.toThrow(/response key failed validation/i);
    await expect(
      validateScreen02ExportedResponseKeyMaterial({
        keyId: otherExport.keyId,
        key: exported.key,
      }),
    ).rejects.toThrow(/response key failed validation/i);
  });

  it("rejects authenticated plaintext unless it is canonical JSON and restores as a client snapshot", async () => {
    const operationId = "invalid-plaintext-operation";
    const invalidSnapshot = await sealArbitraryPlaintext(
      serializeDeterministicJson({ not: "a workflow snapshot" }),
      operationId,
      "open",
    );
    const noncanonical = await sealArbitraryPlaintext(
      '{"z":1,"a":2}',
      operationId,
      "open",
    );

    await expect(
      decryptScreen02WorkflowClientSnapshot(invalidSnapshot.sealed, {
        operationId,
        kind: "open",
        responseKey: invalidSnapshot.material,
      }),
    ).rejects.toThrow(/snapshot failed validation/i);
    await expect(
      decryptScreen02WorkflowClientSnapshot(noncanonical.sealed, {
        operationId,
        kind: "open",
        responseKey: noncanonical.material,
      }),
    ).rejects.toThrow(/plaintext failed validation/i);
  });

  it("refuses to seal a structurally invalid private snapshot", async () => {
    const snapshot = fixtureSnapshot();
    const responseKey = await generateScreen02ResponseKeyMaterial();
    const exported = await exportScreen02ResponseKeyMaterial(responseKey);

    await expect(
      sealScreen02WorkflowClientSnapshot(
        { ...snapshot, accessToken: "" },
        {
          operationId: "invalid-snapshot-operation",
          kind: "open",
          responseKey: exported,
        },
      ),
    ).rejects.toThrow(/snapshot failed validation/i);
  });
});
