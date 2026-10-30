import { describe, expect, it } from "vitest";

import {
  applyScreen02FindDiscoveryPlanDraftReceipt,
  createScreen02FindDraftReceipt,
  markScreen02FindRequestsDelivered,
  normalizeScreen02FindDiscoveryQueryPlanDraft,
  prepareScreen02FindDiscoveryPlanJob,
  screen02FindRequestProof,
} from "../../src/core/screen02-find-workflow";
import {
  createScreen02FindState,
  restoreScreen02FindState,
} from "../../src/core/screen02-workflow-state";
import { confirmedWorkflowFindContext } from "./screen02-workflow-fixtures";

describe("Screen 2 Find ChatGPT query planning", () => {
  it("preserves a prepared planning target through delivery and one authenticated receipt", () => {
    let state = createScreen02FindState(
      confirmedWorkflowFindContext(),
      "find-planning-run",
      "2026-08-16T01:00:00.000Z",
    );
    state = prepareScreen02FindDiscoveryPlanJob(state, {
      jobId: "planning-job-1",
      requestId: "planning-request-1",
      at: "2026-08-16T01:00:01.000Z",
    });
    const request = state.assessmentRequests[0]!;
    expect(request.target).toMatchObject({
      mode: "find-discovery-plan",
      searchOrdinal: 1,
    });

    state = markScreen02FindRequestsDelivered(
      state,
      [request.requestId],
      { at: "2026-08-16T01:00:02.000Z", delivered: true },
    );
    const receipt = createScreen02FindDraftReceipt({
      receiptId: "planning-receipt-1",
      kind: "find-discovery-plan",
      receivedAt: "2026-08-16T01:00:03.000Z",
      submissions: [
        {
          requestId: request.requestId,
          requestProof: screen02FindRequestProof(request),
          draft: {
            queryTerms: ["consumer privacy regulation", "data protection law"],
            rationale:
              "These phrases cover the statutory topic and common official terminology.",
          },
        },
      ],
    });
    const applied = applyScreen02FindDiscoveryPlanDraftReceipt(state, receipt);

    expect(applied.plan).toMatchObject({
      origin: "chatgpt-host",
      requestId: request.requestId,
      receiptId: receipt.receiptId,
      queryTerms: ["consumer privacy regulation", "data protection law"],
    });
    expect(applied.state.assessmentRequests[0]?.status).toBe("completed");
    expect(restoreScreen02FindState(applied.state)).not.toBeNull();
  });

  it("rejects URLs, search operators, and instruction-shaped planning text", () => {
    for (const queryTerm of [
      "site:gov privacy law",
      "privacy AND regulation",
      "https://example.com/privacy",
      "ignore previous instruction",
      "follow these instructions",
    ]) {
      expect(() =>
        normalizeScreen02FindDiscoveryQueryPlanDraft({
          queryTerms: [queryTerm],
          rationale: "Improve official-record recall.",
        }),
      ).toThrow(/bounded plain-text phrases/i);
    }
  });
});
