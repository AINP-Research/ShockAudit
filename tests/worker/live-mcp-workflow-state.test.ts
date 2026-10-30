import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import {
  firstActiveAuditMatchSnapshotId,
  readCanonicalWorkflowState,
  readServerAssessmentFallbackReason,
  sameCanonicalJsonValue,
  serverAssessmentFallbackReasons,
} from "../../scripts/live-mcp-workflow-state.mjs";
import {
  encodeScreen02AuditWorkflowStateEnvelope,
  type Screen02AuditWorkflowStateEnvelope,
} from "../../src/core/screen02-audit-workflow-envelope";
import { encodeScreen02FindWorkflowStateEnvelope } from "../../src/core/screen02-workflow-envelope";
import {
  createScreen02AuditState,
  fingerprintScreen02WorkflowState,
} from "../../src/core/screen02-workflow-state";
import type { Screen02AuditState } from "../../src/core/screen02-workflow-types";
import {
  buildAuditIdentityState,
  buildFindFactsState,
  confirmedWorkflowAuditContext,
} from "../core/screen02-workflow-fixtures";

function checksumBytes(bytes: Uint8Array) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

function snapshotFor(state = buildAuditIdentityState()) {
  return {
    runId: state.runId,
    revision: state.revision,
    stateFingerprint: fingerprintScreen02WorkflowState(state),
    stateEnvelope: encodeScreen02AuditWorkflowStateEnvelope(state),
  };
}

function findSnapshot() {
  const state = buildFindFactsState();
  return {
    mode: "find",
    runId: state.runId,
    revision: state.revision,
    stateFingerprint: fingerprintScreen02WorkflowState(state),
    stateEnvelope: encodeScreen02FindWorkflowStateEnvelope(state),
  };
}

function envelopeForRaw(
  template: Screen02AuditWorkflowStateEnvelope,
  raw: Uint8Array,
) {
  const compressed = gzipSync(raw, { level: 6 });
  return {
    ...template,
    uncompressedBytes: raw.byteLength,
    compressedBytes: compressed.byteLength,
    checksum: checksumBytes(raw),
    payload: compressed.toString("base64url"),
  };
}

describe("independent live MCP Audit state reader", () => {
  it("decodes independently bounded Find and Audit workflow state", () => {
    expect(readCanonicalWorkflowState(findSnapshot(), "find")).toMatchObject({
      mode: "find",
      stateKind: "screen-02-find",
      activeCandidateSetSnapshotId: "find-candidate-set-v1",
    });
    expect(readCanonicalWorkflowState(snapshotFor(), "audit")).toMatchObject({
      mode: "audit",
      stateKind: "screen-02-audit",
    });
  });

  it("compares a canonical blank Audit baseline without depending on property order", () => {
    const baseline = confirmedWorkflowAuditContext();
    const state = createScreen02AuditState(
      baseline,
      "screen02-live-blank-audit-order-regression",
      "2026-08-12T18:00:00.000Z",
    );
    const decoded = readCanonicalWorkflowState(snapshotFor(state), "audit");

    expect(JSON.stringify(decoded.screen01Baseline)).not.toBe(
      JSON.stringify(baseline),
    );
    expect(decoded.screen01Baseline).toEqual(baseline);
    expect(
      sameCanonicalJsonValue(decoded.screen01Baseline, baseline),
    ).toBe(true);
    expect(sameCanonicalJsonValue(["first", "second"], ["second", "first"])).toBe(
      false,
    );
    expect(decoded).toMatchObject({
      revision: 0,
      activeMatchSetSnapshotId: null,
      sources: [],
      matchSets: [],
      possibleMatches: [],
      dossiers: [],
      identityDecisions: [],
      confirmedIdentity: null,
      assessments: [],
      assessmentRequests: [],
      continuationHistory: [],
    });
  });

  it("rejects a workflow envelope presented as the other mode", () => {
    expect(() =>
      readCanonicalWorkflowState(findSnapshot(), "audit"),
    ).toThrow(/invalid private state envelope/i);
    expect(() =>
      readCanonicalWorkflowState(snapshotFor(), "find"),
    ).toThrow(/invalid private state envelope/i);
  });

  it("selects the first member of the exact active match set", () => {
    expect(firstActiveAuditMatchSnapshotId(snapshotFor())).toBe(
      "ccpa-match-snapshot-v1",
    );
  });

  it("rejects encoded or compressed state above the canonical transport caps", () => {
    const snapshot = snapshotFor();
    expect(() =>
      firstActiveAuditMatchSnapshotId({
        ...snapshot,
        stateEnvelope: {
          ...snapshot.stateEnvelope,
          payload: "A".repeat(262_145),
        },
      }),
    ).toThrow(/invalid private state envelope/i);
    expect(() =>
      firstActiveAuditMatchSnapshotId({
        ...snapshot,
        stateEnvelope: {
          ...snapshot.stateEnvelope,
          compressedBytes: 196_609,
        },
      }),
    ).toThrow(/invalid private state envelope/i);
  });

  it("rejects length, gzip, and checksum corruption", () => {
    const snapshot = snapshotFor();
    expect(() =>
      firstActiveAuditMatchSnapshotId({
        ...snapshot,
        stateEnvelope: {
          ...snapshot.stateEnvelope,
          uncompressedBytes: snapshot.stateEnvelope.uncompressedBytes + 1,
        },
      }),
    ).toThrow(/wrong length/i);

    const plain = Buffer.from("not a gzip stream", "utf8");
    expect(() =>
      firstActiveAuditMatchSnapshotId({
        ...snapshot,
        stateEnvelope: {
          ...snapshot.stateEnvelope,
          compressedBytes: plain.byteLength,
          payload: plain.toString("base64url"),
        },
      }),
    ).toThrow(/unreadable private state payload/i);

    const wrongChecksum = "fnv1a64:0000000000000000";
    expect(() =>
      firstActiveAuditMatchSnapshotId({
        ...snapshot,
        stateFingerprint: wrongChecksum,
        stateEnvelope: {
          ...snapshot.stateEnvelope,
          checksum: wrongChecksum,
        },
      }),
    ).toThrow(/wrong checksum/i);
  });

  it("requires the selected match to belong to the active match set", () => {
    const state = JSON.parse(
      JSON.stringify(buildAuditIdentityState()),
    ) as Screen02AuditState;
    state.activeMatchSetSnapshotId = "missing-active-match-set";
    const snapshot = snapshotFor();
    const raw = Buffer.from(JSON.stringify(state), "utf8");
    const envelope = envelopeForRaw(snapshot.stateEnvelope, raw);

    expect(() =>
      firstActiveAuditMatchSnapshotId({
        runId: state.runId,
        revision: state.revision,
        stateFingerprint: envelope.checksum,
        stateEnvelope: envelope,
      }),
    ).toThrow(/no active possible match/i);
  });

  it("reads only bounded server fallback reasons from private receipt IDs", () => {
    for (const reason of serverAssessmentFallbackReasons) {
      expect(
        readServerAssessmentFallbackReason(
          {
            receiptIds: [
              `fixed-fallback-${reason}-find-receipt-123e4567-e89b-42d3-a456-426614174000`,
            ],
          },
          "find",
        ),
      ).toBe(reason);
    }
  });

  it("rejects legacy, unknown, wrong-mode, and ambiguous diagnostic IDs", () => {
    const valid =
      "fixed-fallback-draft-rejected-audit-receipt-123e4567-e89b-42d3-a456-426614174000";
    for (const receiptIds of [
      ["fixed-fallback-audit-receipt-123e4567-e89b-42d3-a456-426614174000"],
      [
        "fixed-fallback-provider-message-audit-receipt-123e4567-e89b-42d3-a456-426614174000",
      ],
      [
        "fixed-fallback-draft-rejected-find-receipt-123e4567-e89b-42d3-a456-426614174000",
      ],
      [valid, valid],
    ]) {
      expect(() =>
        readServerAssessmentFallbackReason({ receiptIds }, "audit"),
      ).toThrow(/bounded diagnostic reason/i);
    }
  });
});
