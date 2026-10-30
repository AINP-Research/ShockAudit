import { afterEach, describe, expect, it, vi } from "vitest";

import {
  STAGE1_DRAFT_SCHEMA_VERSION,
  buildStage1ProofModelContext,
  createStage1ProofOpenResult,
  evaluateStage1AssessmentDraft,
} from "../../src/core/stage1-assessment-proof";
import {
  ShockAuditBridge,
  acceptStage1AssessmentResult,
  type Stage1ProofWidgetSnapshot,
} from "../../src/ui/mcp-bridge";

const preparedAt = "2026-08-09T17:00:00.000Z";
const observedAt = "2026-08-09T17:00:05.000Z";
const open = createStage1ProofOpenResult(
  preparedAt,
  "stage1-proof-bridge-test-0001",
);

function completedResult(
  mainConcern =
    "The U.S. study population is broader than the organizations demonstrably covered by the territorial-scope evidence lead.",
) {
  return evaluateStage1AssessmentDraft(
    {
      schemaVersion: STAGE1_DRAFT_SCHEMA_VERSION,
      requestId: open.request.requestId,
      candidateId: open.request.candidateId,
      candidateSnapshotId: open.request.candidateSnapshotId,
      candidateFingerprint: open.request.candidateFingerprint,
      requestProof: open.request.requestProof,
      draft: {
        studyFit: {
          category: "strong",
          explanation:
            "The application date is inside the confirmed period and the territorial-scope lead can distinguish relevant U.S. technology firms.",
          evidenceSourceIds: [
            "source-eu-gdpr-regulation-2016-679",
          ],
        },
        outcomePathway: {
          category: "plausible",
          explanation:
            "Data-processing obligations can plausibly redirect product and engineering resources related to innovation without asserting outcomes.",
          evidenceSourceIds: [
            "source-eu-gdpr-regulation-2016-679",
          ],
        },
        measurementPotential: {
          category: "possible",
          explanation:
            "EU establishment and EU-facing activity may provide observable exposure indicators, while exact firm coverage remains unverified.",
          evidenceSourceIds: ["source-eu-gdpr-celex-metadata"],
        },
        mainConcern,
        nextChecks: [
          "Verify firm-level EU-facing activity before constructing exposure.",
          "Check whether verified exposure varies across sampled firms.",
        ],
      },
    },
    observedAt,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Stage 1 proof bridge", () => {
  it("shares only the bounded proof context before posting the visible request", async () => {
    const updateModelContext = vi.fn(
      async (_update: unknown) => undefined,
    );
    const sendMessage = vi.fn(async (_message: unknown) => ({
      isError: false,
    }));
    const bridge = new ShockAuditBridge();
    (
      bridge as unknown as {
        app: {
          getHostCapabilities: () => {
            message: { text: object };
            updateModelContext: { structuredContent: object };
          };
          updateModelContext: typeof updateModelContext;
          sendMessage: typeof sendMessage;
        };
      }
    ).app = {
      getHostCapabilities: () => ({
        message: { text: {} },
        updateModelContext: { structuredContent: {} },
      }),
      updateModelContext,
      sendMessage,
    };

    await expect(
      bridge.requestStage1ProofAssessment(open),
    ).resolves.toBe(true);
    expect(updateModelContext).toHaveBeenCalledOnce();
    expect(sendMessage).toHaveBeenCalledOnce();
    expect(
      updateModelContext.mock.invocationCallOrder[0],
    ).toBeLessThan(sendMessage.mock.invocationCallOrder[0]!);
    const update = updateModelContext.mock.calls[0]?.[0] as {
      structuredContent?: unknown;
    };
    expect(update.structuredContent).toEqual(
      buildStage1ProofModelContext(open),
    );
    const serialized = JSON.stringify(update.structuredContent);
    expect(serialized.length).toBeLessThan(12_000);
    for (const forbidden of [
      "sessionState",
      "studyContext",
      "expectedRevision",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(sendMessage.mock.calls[0]?.[0]).toMatchObject({
      role: "user",
      content: [
        {
          type: "text",
          text: expect.stringContaining(
            "Call submit_stage1_assessment_draft exactly once",
          ),
        },
      ],
    });
  });

  it("reports delivery rejection without manufacturing an assessment", async () => {
    const bridge = new ShockAuditBridge();
    const sendMessage = vi.fn(async (_message: unknown) => ({
      isError: true,
    }));
    const updateModelContext = vi.fn(
      async (_update: unknown) => undefined,
    );
    (
      bridge as unknown as {
        app: {
          getHostCapabilities: () => {
            message: { text: object };
            updateModelContext: { text: object };
          };
          updateModelContext: typeof updateModelContext;
          sendMessage: typeof sendMessage;
        };
      }
    ).app = {
      getHostCapabilities: () => ({
        message: { text: {} },
        updateModelContext: { text: {} },
      }),
      updateModelContext,
      sendMessage,
    };

    await expect(
      bridge.requestStage1ProofAssessment(open),
    ).resolves.toBe(false);
    expect(sendMessage).toHaveBeenCalledOnce();
  });

  it("does not send after a newer model-context write supersedes its proof context", async () => {
    let settleProofContext: (() => void) | undefined;
    const updateModelContext = vi.fn((_update: unknown) => {
      if (updateModelContext.mock.calls.length === 1) {
        return new Promise<void>((resolve) => {
          settleProofContext = resolve;
        });
      }
      return Promise.resolve();
    });
    const sendMessage = vi.fn(async () => ({ isError: false }));
    const bridge = new ShockAuditBridge();
    const app = {
      getHostCapabilities: () => ({
        message: { text: {} },
        updateModelContext: { structuredContent: {} },
      }),
      updateModelContext,
      sendMessage,
    };
    (bridge as unknown as { app: typeof app }).app = app;

    const proofRequest = bridge.requestStage1ProofAssessment(open);
    await vi.waitFor(() => expect(updateModelContext).toHaveBeenCalledOnce());
    const replacement = bridge.updateModelContext(
      "replacement Screen 1 context",
      { replacementMarker: "newer-context" } as never,
    );
    settleProofContext?.();

    await expect(proofRequest).resolves.toBe(false);
    await replacement;
    expect(updateModelContext).toHaveBeenCalledTimes(2);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("restores an opener without inferring a model invocation", () => {
    vi.stubGlobal("window", {
      openai: { widgetState: {}, toolOutput: open },
    });
    const snapshot = new ShockAuditBridge().getInitialStage1ProofSnapshot();

    expect(snapshot).toEqual({ open, status: "prepared" });
    expect(snapshot?.result).toBeUndefined();
  });

  it("restores a matching receipt from response metadata", () => {
    const result = completedResult();
    vi.stubGlobal("window", {
      openai: {
        widgetState: {
          stage1Proof: {
            open,
            status: "message-delivered",
            messageDeliveredAt: observedAt,
          },
        },
        toolResponseMetadata: {
          mcp_tool_result: { structuredContent: open },
          call_tool_result: { structuredContent: result },
        },
      },
    });
    const snapshot = new ShockAuditBridge().getInitialStage1ProofSnapshot();

    expect(snapshot?.status).toBe("completed");
    expect(snapshot?.result?.receiptId).toBe(result.receiptId);
    expect(snapshot?.messageDeliveredAt).toBe(observedAt);
  });

  it("does not infer completed delivery from receipt metadata alone", () => {
    const result = completedResult();
    vi.stubGlobal("window", {
      openai: {
        widgetState: {},
        toolResponseMetadata: {
          mcp_tool_result: { structuredContent: open },
          call_tool_result: { structuredContent: result },
        },
      },
    });

    expect(
      new ShockAuditBridge().getInitialStage1ProofSnapshot(),
    ).toEqual({ open, status: "prepared" });
  });

  it("does not revive a timed-out proof from late receipt metadata on remount", () => {
    const result = completedResult();
    vi.stubGlobal("window", {
      openai: {
        widgetState: {
          stage1Proof: {
            open,
            status: "timed-out",
            messageDeliveredAt: observedAt,
            timedOutAt: "2026-08-09T17:02:06.000Z",
          },
        },
        toolResponseMetadata: {
          mcp_tool_result: { structuredContent: open },
          call_tool_result: { structuredContent: result },
        },
      },
    });

    const snapshot = new ShockAuditBridge().getInitialStage1ProofSnapshot();
    expect(snapshot?.status).toBe("timed-out");
    expect(snapshot?.result).toBeUndefined();
  });

  it("rejects stale, reordered, duplicate, and tampered result notifications", () => {
    const result = completedResult();
    const delivered: Stage1ProofWidgetSnapshot = {
      open,
      status: "message-delivered",
      messageDeliveredAt: observedAt,
    };
    const accepted = acceptStage1AssessmentResult(delivered, result);
    expect(accepted).not.toBe(delivered);
    expect(accepted.status).toBe("completed");

    expect(acceptStage1AssessmentResult(accepted, result)).toBe(accepted);
    const conflictingValidResult = completedResult(
      "The key concern is that available territorial-scope leads do not yet establish which sampled firms had covered EU-facing operations.",
    );
    expect(conflictingValidResult.receiptId).not.toBe(result.receiptId);
    // First valid receipt wins for one immutable request. Later valid but
    // conflicting drafts cannot rewrite a terminal proof record.
    expect(
      acceptStage1AssessmentResult(accepted, conflictingValidResult),
    ).toBe(accepted);
    expect(
      acceptStage1AssessmentResult(
        { open, status: "prepared" },
        result,
      ),
    ).toEqual({ open, status: "prepared" });

    const staleOpen = createStage1ProofOpenResult(
      preparedAt,
      "stage1-proof-bridge-test-stale-0002",
    );
    const stale: Stage1ProofWidgetSnapshot = {
      open: staleOpen,
      status: "message-delivered",
    };
    expect(acceptStage1AssessmentResult(stale, result)).toBe(stale);

    const tampered = {
      ...result,
      assessment: {
        ...result.assessment,
        overallJudgment: "low-priority",
      },
    };
    expect(acceptStage1AssessmentResult(delivered, tampered)).toBe(
      delivered,
    );
  });
});
