import { gzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import {
  SCREEN_02_AUDIT_WORKFLOW_STATE_ENVELOPE_ENCODING,
  SCREEN_02_AUDIT_WORKFLOW_STATE_ENVELOPE_SCHEMA_VERSION,
  decodeScreen02AuditWorkflowStateEnvelope,
  encodeScreen02AuditWorkflowStateEnvelope,
  restoreScreen02AuditWorkflowStateEnvelope,
  screen02AuditWorkflowEnvelopeIdentity,
  type Screen02AuditWorkflowStateEnvelope,
} from "../../src/core/screen02-audit-workflow-envelope";
import {
  SCREEN_02_MAX_CANONICAL_SESSION_BYTES,
  SCREEN_02_MAX_COMPRESSED_STATE_BYTES,
  SCREEN_02_MAX_STATE_PAYLOAD_CHARACTERS,
} from "../../src/core/screen02-state-capacity";
import { serializeScreen02WorkflowState } from "../../src/core/screen02-workflow-state";
import {
  buildFindFactsState,
  buildReadyAuditState,
} from "./screen02-workflow-fixtures";

function checksumJson(json: string) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of new TextEncoder().encode(json)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

function envelopeForJson(
  template: Screen02AuditWorkflowStateEnvelope,
  json: string,
): Screen02AuditWorkflowStateEnvelope {
  const raw = new TextEncoder().encode(json);
  const compressed = gzipSync(raw, { level: 6, mtime: 0 });
  return {
    ...template,
    uncompressedBytes: raw.byteLength,
    compressedBytes: compressed.byteLength,
    checksum: checksumJson(json),
    payload: Buffer.from(compressed).toString("base64url"),
  };
}

describe("Screen 2 v2.1 Audit workflow state envelope", () => {
  it("round-trips exact canonical writable Audit state within the shared bounds", () => {
    const state = buildReadyAuditState();
    const envelope = encodeScreen02AuditWorkflowStateEnvelope(state);
    const decoded = decodeScreen02AuditWorkflowStateEnvelope(envelope);

    expect(Object.keys(envelope)).toEqual([
      "schemaVersion",
      "workflowSchemaVersion",
      "stateKind",
      "encoding",
      "uncompressedBytes",
      "compressedBytes",
      "checksum",
      "payload",
    ]);
    expect(envelope.schemaVersion).toBe(
      SCREEN_02_AUDIT_WORKFLOW_STATE_ENVELOPE_SCHEMA_VERSION,
    );
    expect(envelope.workflowSchemaVersion).toBe("2.1");
    expect(envelope.stateKind).toBe("screen-02-audit");
    expect(envelope.encoding).toBe(
      SCREEN_02_AUDIT_WORKFLOW_STATE_ENVELOPE_ENCODING,
    );
    expect(envelope.uncompressedBytes).toBeLessThanOrEqual(
      SCREEN_02_MAX_CANONICAL_SESSION_BYTES,
    );
    expect(envelope.compressedBytes).toBeLessThanOrEqual(
      SCREEN_02_MAX_COMPRESSED_STATE_BYTES,
    );
    expect(envelope.payload.length).toBeLessThanOrEqual(
      SCREEN_02_MAX_STATE_PAYLOAD_CHARACTERS,
    );
    expect(envelope.payload).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) throw new Error(decoded.message);
    expect(serializeScreen02WorkflowState(decoded.state)).toBe(
      serializeScreen02WorkflowState(state),
    );
    expect(Object.isFrozen(decoded.state)).toBe(true);
    expect(screen02AuditWorkflowEnvelopeIdentity(decoded.envelope)).toContain(
      envelope.checksum,
    );
  });

  it("requires the exact envelope key set and Audit state kind", () => {
    const envelope = encodeScreen02AuditWorkflowStateEnvelope(
      buildReadyAuditState(),
    );
    const { payload: _payload, ...missingPayload } = envelope;

    expect(
      decodeScreen02AuditWorkflowStateEnvelope({
        ...envelope,
        authoritative: true,
      }),
    ).toMatchObject({ ok: false, code: "envelope-shape" });
    expect(decodeScreen02AuditWorkflowStateEnvelope(missingPayload)).toMatchObject(
      { ok: false, code: "envelope-shape" },
    );
    expect(
      decodeScreen02AuditWorkflowStateEnvelope({
        ...envelope,
        stateKind: "screen-02-find",
      }),
    ).toMatchObject({ ok: false, code: "envelope-state-kind" });
  });

  it("rejects checksum alteration, invalid base64url, and corrupted gzip", () => {
    const envelope = encodeScreen02AuditWorkflowStateEnvelope(
      buildReadyAuditState(),
    );
    const checksumAltered = {
      ...envelope,
      checksum:
        envelope.checksum === "fnv1a64:0000000000000000"
          ? "fnv1a64:0000000000000001"
          : "fnv1a64:0000000000000000",
    };
    const plain = new TextEncoder().encode("not a gzip stream");
    const corruptGzip = {
      ...envelope,
      compressedBytes: plain.byteLength,
      payload: Buffer.from(plain).toString("base64url"),
    };

    expect(
      decodeScreen02AuditWorkflowStateEnvelope(checksumAltered),
    ).toMatchObject({ ok: false, code: "envelope-checksum" });
    expect(
      restoreScreen02AuditWorkflowStateEnvelope(checksumAltered),
    ).toBeNull();
    expect(
      decodeScreen02AuditWorkflowStateEnvelope({
        ...envelope,
        payload: `${envelope.payload}=`,
      }),
    ).toMatchObject({ ok: false, code: "envelope-base64" });
    expect(
      decodeScreen02AuditWorkflowStateEnvelope(corruptGzip),
    ).toMatchObject({ ok: false, code: "envelope-gzip" });
  });

  it("rejects noncanonical JSON and a canonical Find payload relabeled as Audit", () => {
    const template = encodeScreen02AuditWorkflowStateEnvelope(
      buildReadyAuditState(),
    );
    const auditJson = serializeScreen02WorkflowState(buildReadyAuditState());
    const noncanonical = envelopeForJson(template, `\n${auditJson}`);
    const findJson = serializeScreen02WorkflowState(buildFindFactsState());
    const relabeledFind = envelopeForJson(template, findJson);

    expect(
      decodeScreen02AuditWorkflowStateEnvelope(noncanonical),
    ).toMatchObject({ ok: false, code: "envelope-noncanonical" });
    expect(
      decodeScreen02AuditWorkflowStateEnvelope(relabeledFind),
    ).toMatchObject({ ok: false, code: "envelope-state" });
  });

  it("rejects encoded over-capacity declarations before decoding", () => {
    const envelope = encodeScreen02AuditWorkflowStateEnvelope(
      buildReadyAuditState(),
    );

    expect(
      decodeScreen02AuditWorkflowStateEnvelope({
        ...envelope,
        payload: "A".repeat(SCREEN_02_MAX_STATE_PAYLOAD_CHARACTERS + 1),
      }),
    ).toMatchObject({ ok: false, code: "envelope-size" });
    expect(
      decodeScreen02AuditWorkflowStateEnvelope({
        ...envelope,
        compressedBytes: SCREEN_02_MAX_COMPRESSED_STATE_BYTES + 1,
      }),
    ).toMatchObject({ ok: false, code: "envelope-size" });
    expect(
      decodeScreen02AuditWorkflowStateEnvelope({
        ...envelope,
        uncompressedBytes: SCREEN_02_MAX_CANONICAL_SESSION_BYTES + 1,
      }),
    ).toMatchObject({ ok: false, code: "envelope-size" });
  });

  it("stops a forged gzip expansion before the raw Audit state cap", () => {
    const template = encodeScreen02AuditWorkflowStateEnvelope(
      buildReadyAuditState(),
    );
    const oversizedRaw = new Uint8Array(
      SCREEN_02_MAX_CANONICAL_SESSION_BYTES + 1,
    ).fill(0x41);
    const compressed = gzipSync(oversizedRaw, { level: 6, mtime: 0 });
    expect(compressed.byteLength).toBeLessThan(
      SCREEN_02_MAX_COMPRESSED_STATE_BYTES,
    );
    const forged = compressed.slice();
    const declaredBytes = 32;
    new DataView(
      forged.buffer,
      forged.byteOffset,
      forged.byteLength,
    ).setUint32(forged.byteLength - 4, declaredBytes, true);
    const bomb = {
      ...template,
      uncompressedBytes: declaredBytes,
      compressedBytes: forged.byteLength,
      checksum: "fnv1a64:0000000000000000",
      payload: Buffer.from(forged).toString("base64url"),
    };

    expect(decodeScreen02AuditWorkflowStateEnvelope(bomb)).toMatchObject({
      ok: false,
      code: "envelope-size",
    });
  });
});
