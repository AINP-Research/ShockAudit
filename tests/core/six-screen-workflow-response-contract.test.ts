import { describe, expect, it } from "vitest";

import {
  fingerprintSixScreenValue,
  serializeSixScreenValue,
} from "../../src/core/six-screen/canonical";
import {
  SIX_SCREEN_MAX_CANONICAL_PAYLOAD_BYTES,
  SIX_SCREEN_MAX_ENCODED_PAYLOAD_BYTES,
  createSixScreenWorkflowResponseContract,
  decodeSixScreenWorkflowPayload,
  encodeSixScreenWorkflowPayload,
  sixScreenWorkflowMutationRequestBinding,
} from
  "../../src/core/six-screen/workflow-response-contract";

describe("six-screen workflow response operation binding", () => {
  it("round-trips a low-compressibility later-screen payload beyond the former encoded ceiling", () => {
    const alphabet =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let seed = 0x9e3779b9;
    const chunks: string[] = [];
    for (let chunk = 0; chunk < 2_400; chunk += 1) {
      let value = "";
      for (let index = 0; index < 1_000; index += 1) {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        value += alphabet[seed >>> 26];
      }
      chunks.push(value);
    }
    const canonical = JSON.stringify({ retainedReceipts: chunks.join("") });
    const encoded = encodeSixScreenWorkflowPayload(canonical);

    expect(encoded.encodedBytes).toBeGreaterThan(2 * 1024 * 1024);
    expect(encoded.encodedBytes).toBeLessThanOrEqual(
      SIX_SCREEN_MAX_ENCODED_PAYLOAD_BYTES,
    );
    expect(encoded.canonicalBytes).toBeLessThanOrEqual(
      SIX_SCREEN_MAX_CANONICAL_PAYLOAD_BYTES,
    );
    expect(decodeSixScreenWorkflowPayload({
      encodedPayload: encoded.encodedPayload,
      encodedBytes: encoded.encodedBytes,
      canonicalBytes: encoded.canonicalBytes,
    })).toBe(canonical);
  });

  it("compresses a provenance-rich decoded workspace beyond the former 8 MiB cliff", () => {
    const canonical = JSON.stringify({
      schemaVersion: "shockaudit-six-screen-workflow-v1",
      retainedEvidence: "source-backed-provenance-record|".repeat(300_000),
    });
    expect(new TextEncoder().encode(canonical).byteLength)
      .toBeGreaterThan(8 * 1024 * 1024);
    const encoded = encodeSixScreenWorkflowPayload(canonical);
    expect(encoded.encodedBytes).toBeLessThan(2 * 1024 * 1024);
    expect(decodeSixScreenWorkflowPayload({
      encodedPayload: encoded.encodedPayload,
      encodedBytes: encoded.encodedBytes,
      canonicalBytes: encoded.canonicalBytes,
    })).toBe(canonical);
  });

  it("binds an omitted Screen 5 retry flag to the server default", () => {
    const base = {
      action: "advance_study_first_mechanism_job",
      expectedRevision: 12,
      operationId: "screen5-advance-default-retry",
    };
    expect(sixScreenWorkflowMutationRequestBinding(base)).toEqual(
      sixScreenWorkflowMutationRequestBinding({ ...base, retry: false }),
    );
    expect(sixScreenWorkflowMutationRequestBinding({
      ...base,
      retry: true,
    }).requestFingerprint).not.toBe(
      sixScreenWorkflowMutationRequestBinding(base).requestFingerprint,
    );
  });

  it("round-trips a large later-screen workspace without repeating raw state", () => {
    const runId = `sa6r_${"r".repeat(43)}`;
    const repeatedEvidence = Array.from({ length: 240 }, (_, index) => ({
      id: `evidence-${index}`,
      title: "Disclosure of Consumer Complaint Data",
      passage: "A bounded source passage retained for audit and citation. ".repeat(18),
      checks: ["exposure", "timing", "composition", "interference"],
    }));
    const state = {
      schemaVersion: "shockaudit-six-screen-workflow-v1",
      runId,
      revision: 27,
      activeScreen: 6,
      evidence: repeatedEvidence,
    };
    const publicProjection = {
      schemaVersion: "shockaudit-six-screen-public-v1",
      runId,
      revision: 27,
      activeScreen: 6,
      evidence: repeatedEvidence.map(({ id, title }) => ({ id, title })),
    };
    const canonicalState = serializeSixScreenValue(state);
    const contract = createSixScreenWorkflowResponseContract({
      appVersion: "test-version",
      uiResourceUri: "ui://shockaudit/test",
      toolName: "mutate_six_screen_workflow_v1",
      operationStage: "screen6_regression",
      publicProjection,
      privateSnapshot: {
        schemaVersion: "shockaudit-six-screen-private-v1",
        runId,
        revision: 27,
        stateFingerprint: fingerprintSixScreenValue(state),
        state,
      },
    });

    expect(JSON.parse(decodeSixScreenWorkflowPayload({
      encodedPayload: contract.encodedStatePayload,
      encodedBytes: contract.encodedStateBytes,
      canonicalBytes: contract.canonicalStateBytes,
    }))).toEqual(state);
    expect(contract.canonicalStateBytes).toBe(
      new TextEncoder().encode(canonicalState).byteLength,
    );
    expect(contract.encodedStateBytes).toBeLessThan(
      contract.canonicalStateBytes / 8,
    );
    expect(JSON.stringify(contract)).not.toContain(
      "A bounded source passage retained for audit and citation.",
    );
    expect(contract).not.toHaveProperty("state");
    expect(contract).not.toHaveProperty("publicProjection");
  });
});
