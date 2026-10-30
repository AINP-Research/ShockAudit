import { describe, expect, it } from "vitest";

import {
  SCREEN_02_WORKFLOW_STATE_ENVELOPE_SCHEMA_VERSION,
  decodeScreen02FindWorkflowStateEnvelope,
  encodeScreen02FindWorkflowStateEnvelope,
  restoreScreen02FindWorkflowStateEnvelope,
  screen02FindWorkflowEnvelopeIdentity,
} from "../../src/core/screen02-workflow-envelope";
import { serializeScreen02WorkflowState } from "../../src/core/screen02-workflow-state";
import { buildFindFactsState } from "./screen02-workflow-fixtures";

describe("Screen 2 v2.1 Find workflow state envelope", () => {
  it("round-trips exact canonical writable Find state within bounded transport", () => {
    const state = buildFindFactsState();
    const envelope = encodeScreen02FindWorkflowStateEnvelope(state);
    const decoded = decodeScreen02FindWorkflowStateEnvelope(envelope);

    expect(envelope.schemaVersion).toBe(
      SCREEN_02_WORKFLOW_STATE_ENVELOPE_SCHEMA_VERSION,
    );
    expect(envelope.stateKind).toBe("screen-02-find");
    expect(envelope.workflowSchemaVersion).toBe("2.1");
    expect(envelope.payload).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) throw new Error(decoded.message);
    expect(serializeScreen02WorkflowState(decoded.state)).toBe(
      serializeScreen02WorkflowState(state),
    );
    expect(Object.isFrozen(decoded.state)).toBe(true);
    expect(screen02FindWorkflowEnvelopeIdentity(decoded.envelope)).toContain(
      envelope.checksum,
    );
  });

  it("rejects a valid-shape checksum alteration and returns no state", () => {
    const envelope = encodeScreen02FindWorkflowStateEnvelope(
      buildFindFactsState(),
    );
    const altered = {
      ...envelope,
      checksum:
        envelope.checksum === "fnv1a64:0000000000000000"
          ? "fnv1a64:0000000000000001"
          : "fnv1a64:0000000000000000",
    };
    const decoded = decodeScreen02FindWorkflowStateEnvelope(altered);

    expect(decoded).toMatchObject({
      ok: false,
      code: "envelope-checksum",
    });
    expect(restoreScreen02FindWorkflowStateEnvelope(altered)).toBeNull();
  });

  it("rejects corrupted compressed bytes before workflow restoration", () => {
    const envelope = encodeScreen02FindWorkflowStateEnvelope(
      buildFindFactsState(),
    );
    const final = envelope.payload.at(-1)!;
    const corrupted = {
      ...envelope,
      payload: `${envelope.payload.slice(0, -1)}${final === "A" ? "B" : "A"}`,
    };
    const decoded = decodeScreen02FindWorkflowStateEnvelope(corrupted);

    expect(decoded.ok).toBe(false);
    if (decoded.ok) throw new Error("Corrupted payload was accepted.");
    expect([
      "envelope-base64",
      "envelope-gzip",
      "envelope-size",
      "envelope-checksum",
    ]).toContain(decoded.code);
  });

  it("never mistakes the released legacy envelope shape for writable v2.1 state", () => {
    const legacyLike = {
      schemaVersion: "screen-02-state-envelope-v1",
      encoding: "gzip-base64url",
      uncompressedBytes: 1,
      compressedBytes: 1,
      checksum: "fnv1a64:0000000000000000",
      payload: "AA",
    };
    const decoded = decodeScreen02FindWorkflowStateEnvelope(legacyLike);

    expect(decoded).toMatchObject({ ok: false, code: "envelope-shape" });
  });

  it("rejects unknown envelope fields instead of ignoring them", () => {
    const envelope = encodeScreen02FindWorkflowStateEnvelope(
      buildFindFactsState(),
    );
    const decoded = decodeScreen02FindWorkflowStateEnvelope({
      ...envelope,
      authoritative: true,
    });

    expect(decoded).toMatchObject({ ok: false, code: "envelope-shape" });
  });
});
