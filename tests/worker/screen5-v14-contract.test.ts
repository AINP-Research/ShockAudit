import { describe, expect, it } from "vitest";

import {
  createScreen5OpenAIProviderReceipt,
  updateScreen5MechanismProviderReceipt,
} from "../../src/core/six-screen/screen5-mechanism";
import {
  Screen5MechanismWireValidationError,
  screen5MechanismAssessmentSchema,
  validateScreen5MechanismComparisonWire,
} from "../../src/worker/screen5-mechanism-contract";

const usage = {
  promptTokens: 100,
  completionTokens: 50,
  totalTokens: 150,
  reasoningTokens: null,
  cachedPromptTokens: null,
};

function assessmentWire() {
  return {
    // Deliberately not presentation order. Identity, not array position, owns M0.
    mechanisms: [{
      candidate_id: "candidate-1",
      concept: "Compliance effort",
      relation: "competing" as const,
      chain: ["New duty", "Staff effort", "Performance"],
      direction: {
        mechanism_response: "increase" as const,
        outcome_implication: "uncertain" as const,
        basis: "analyst_inference" as const,
        condition: "Implementation effort is material.",
      },
      argument: [{
        text: "This remains a bounded analytical hypothesis.",
        evidence_ids: [],
        basis: "analytical_hypothesis" as const,
      }],
      fit: "The response is at the saved firm level.",
      limit: "No exact policy study was inspected.",
      theory: null,
      theory_basis: "not_assigned" as const,
    }, {
      candidate_id: "m0",
      concept: "Researcher focal process",
      relation: "focal" as const,
      chain: ["Policy change", "Focal response", "Performance"],
      direction: {
        mechanism_response: "uncertain" as const,
        outcome_implication: "uncertain" as const,
        basis: "researcher_proposed" as const,
        condition: "The proposed response occurs.",
      },
      argument: [{
        text: "The inspected text supports only this general component.",
        evidence_ids: ["e1"],
        basis: "inspected_proposition" as const,
      }],
      fit: "The exact focal text remains the reference.",
      limit: "Transfer to the saved study is untested.",
      theory: null,
      theory_basis: "not_assigned" as const,
    }],
    row_definitions: [{
      row_id: "row-1",
      observation: "Intermediate response",
      measure: "A dated direct measure",
      level: "firm-period",
      timing: "after the policy change",
      caution: "A shared response is not identifying.",
    }],
    cells: [{
      row_id: "row-1",
      candidate_id: "candidate-1",
      status: "prediction" as const,
      text: "Observe implementation effort.",
      evidence_ids: [],
    }, {
      row_id: "row-1",
      candidate_id: "m0",
      status: "not_distinguishing" as const,
      text: "The focal process has no unique cost prediction.",
      evidence_ids: [],
    }],
    dispositions: [{
      candidate_id: "candidate-1",
      status: "qualified" as const,
      reason: "The pathway remains distinct but its support is incomplete.",
      merged_into: null,
    }],
    summary: "The saved candidate remains a bounded hypothesis.",
    gaps: ["Study-specific evidence remains unavailable."],
  };
}

describe("Screen 5 v14 mechanism-first and recovery contract", () => {
  it("generates a Stage B schema from exact admitted identities", () => {
    const first = screen5MechanismAssessmentSchema({
      candidateIds: ["candidate-1"],
      includeFocal: true,
      evidenceIds: ["e1"],
      rowIds: [],
      allowedMergeTargets: ["candidate-1", "candidate-2"],
    }) as any;
    expect(first.properties.mechanisms.items.properties.candidate_id.enum)
      .toEqual(["m0", "candidate-1"]);
    expect(first.properties.mechanisms.items.properties.argument.items
      .properties.evidence_ids.items.enum).toEqual(["e1"]);
    expect(first.properties.dispositions.items.properties.candidate_id.enum)
      .toEqual(["candidate-1"]);

    const later = screen5MechanismAssessmentSchema({
      candidateIds: ["candidate-2"],
      includeFocal: false,
      evidenceIds: [],
      rowIds: ["row-1"],
      allowedMergeTargets: ["candidate-1", "candidate-2"],
    }) as any;
    expect(later.properties.cells.items.properties.row_id.enum)
      .toEqual(["row-1"]);
    expect(later.properties.mechanisms.items.properties.candidate_id.enum)
      .toEqual(["candidate-2"]);
  });

  it("accepts a uniquely identified focal independent of array order", () => {
    const wire = assessmentWire();
    expect(validateScreen5MechanismComparisonWire(wire, new Set(["e1"]), {
      candidateIds: ["candidate-1"],
      includeFocal: true,
      rowIds: [],
      allowedMergeTargets: ["candidate-1"],
    })).toEqual(wire);
  });

  it("accepts a hypothesis-only disposition without an assessed card", () => {
    const wire = assessmentWire();
    const hypothesisOnlyWire = {
      ...wire,
      mechanisms: wire.mechanisms.filter(({ candidate_id }) =>
        candidate_id === "m0"),
      cells: wire.cells.filter(({ candidate_id }) => candidate_id === "m0"),
      dispositions: [{
        ...wire.dispositions[0]!,
        status: "hypothesis_only" as const,
        reason: "No admitted inspected evidence supports an assessed card.",
      }],
    };

    expect(validateScreen5MechanismComparisonWire(
      hypothesisOnlyWire,
      new Set(["e1"]), {
        candidateIds: ["candidate-1"],
        includeFocal: true,
        rowIds: [],
        allowedMergeTargets: ["candidate-1"],
      },
    )).toEqual(hypothesisOnlyWire);
  });

  it("returns bounded issue paths for malformed arrays and unknown IDs", () => {
    try {
      validateScreen5MechanismComparisonWire({
        mechanisms: "not-an-array",
        row_definitions: [],
        cells: [],
        dispositions: [],
        summary: "Saved summary.",
        gaps: [],
      }, new Set(), {
        candidateIds: [],
        includeFocal: true,
        rowIds: [],
      });
      throw new Error("Expected validation to fail.");
    } catch (caught) {
      expect(caught).toBeInstanceOf(Screen5MechanismWireValidationError);
      expect((caught as Screen5MechanismWireValidationError).issues)
        .toEqual(expect.arrayContaining([expect.objectContaining({
          code: "expected_array", path: "$.mechanisms",
          stage: "assessment",
        })]));
      expect((caught as Screen5MechanismWireValidationError).issues.length)
        .toBeLessThanOrEqual(12);
    }
  });

  it("moves a protected final-message receipt through validation states", () => {
    const received = createScreen5OpenAIProviderReceipt({
      receivedAt: "2026-09-22T22:30:00.000Z",
      httpStatus: 200,
      providerRequestId: "request-v14",
      providerResponseId: "response-v14",
      serviceTier: "default",
      latencyMs: 100,
      modelObserved: "gpt-6-luna",
      finishReason: "completed",
      usage,
      rateLimit: {
        retryAfterAt: null,
        tokenResetAt: null,
        remainingTokens: 3_000,
      },
      finalContent: '{"mechanisms":[]}',
    });
    expect(received.status).toBe("received");
    const valid = updateScreen5MechanismProviderReceipt(received, {
      status: "schema_valid",
      wireFingerprint: "fnv1a64:0123456789abcdef",
    });
    expect(valid.status).toBe("schema_valid");
    expect(updateScreen5MechanismProviderReceipt(valid, {
      status: "aggregate_saved",
    }).status).toBe("aggregate_saved");
    const quarantined = updateScreen5MechanismProviderReceipt(received, {
      status: "quarantined",
      validationIssues: [{
        code: "unadmitted_candidate_id",
        path: "$.mechanisms[0].candidate_id",
      }],
    });
    expect(quarantined.validationIssues[0]?.path)
      .toBe("$.mechanisms[0].candidate_id");
  });
});
