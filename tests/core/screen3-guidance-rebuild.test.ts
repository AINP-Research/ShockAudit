import { describe, expect, it } from "vitest";

import {
  openScreen3,
  rebuildScreen3Guidance,
  updateStudyContext,
  type Screen3StartReceipt,
} from "../../src/core/six-screen/workflow";
import { createBrowserEventCardFixture } from
  "../browser/six-screen-event-card-review-fixture";

const submittedStudy = {
  population: "U.S. public firms",
  analysisUnit: "firm-year",
  geography: ["United States", "California"],
  industry: ["Retail"],
  period: { start: "2010", end: "2025" },
  outcome: "Firm performance",
  outcomeMeasure: "ROA",
  intendedConstruct: null,
  policySideConcept: "Transparency",
  initialExplanation: "Customer response",
  proposedTreatment: "California firms",
  proposedComparison: "Non-California firms",
  resultsPreviouslyInspected: "not_disclosed" as const,
};

function openedFixture() {
  const fixture = createBrowserEventCardFixture();
  return openScreen3(fixture.state, {
    expectedRevision: fixture.state.revision,
    study: submittedStudy,
    proposedTiming: {
      mode: "year",
      year: 2020,
      milestoneReference: null,
    },
    openedAt: "2026-09-25T20:00:00.000Z",
  });
}

describe("Screen 3 deterministic guidance rebuild", () => {
  it("recreates only the exact receipt-bound advice and is idempotent", () => {
    const opened = openedFixture();
    expect(opened.receipt.clarifications).toBeDefined();
    const missing = structuredClone(opened.state);
    missing.studyDesignAdvices = missing.studyDesignAdvices?.filter(
      ({ adviceId }) => adviceId !== opened.receipt.adviceId,
    );

    const rebuilt = rebuildScreen3Guidance(missing, {
      expectedRevision: missing.revision,
      sourceReceipt: opened.receipt,
      rebuiltAt: "2026-09-25T20:01:00.000Z",
    });
    expect(rebuilt.receipt).toMatchObject({
      sourceWorkflowRevision: opened.receipt.workflowRevision,
      adviceId: opened.receipt.adviceId,
      adviceFingerprint: opened.receipt.adviceFingerprint,
    });
    expect(rebuilt.state.studyDesignAdvices?.at(-1)).toMatchObject({
      adviceId: opened.receipt.adviceId,
      adviceFingerprint: opened.receipt.adviceFingerprint,
    });
    expect(rebuilt.state.revision).toBe(missing.revision + 1);

    const repeated = rebuildScreen3Guidance(rebuilt.state, {
      expectedRevision: rebuilt.state.revision,
      sourceReceipt: opened.receipt,
      rebuiltAt: "2026-09-25T20:02:00.000Z",
    });
    expect(repeated.state).toEqual(rebuilt.state);
    expect(repeated.receipt.adviceFingerprint)
      .toBe(opened.receipt.adviceFingerprint);
  });

  it("does not guess missing legacy rebuild inputs", () => {
    const opened = openedFixture();
    const missing = structuredClone(opened.state);
    missing.studyDesignAdvices = [];
    const legacy = structuredClone(opened.receipt) as Screen3StartReceipt;
    delete legacy.clarifications;
    delete legacy.clarificationFingerprint;

    expect(() => rebuildScreen3Guidance(missing, {
      expectedRevision: missing.revision,
      sourceReceipt: legacy,
      rebuiltAt: "2026-09-25T20:01:00.000Z",
    })).toThrow(/does not retain a validated local rebuild input/iu);
  });

  it("refuses to attach historical guidance after a scientific edit", () => {
    const opened = openedFixture();
    const missing = structuredClone(opened.state);
    missing.studyDesignAdvices = [];
    const changed = updateStudyContext(missing, {
      expectedRevision: missing.revision,
      study: { ...submittedStudy, outcome: "Employment" },
      updatedAt: "2026-09-25T20:01:00.000Z",
    });

    expect(() => rebuildScreen3Guidance(changed, {
      expectedRevision: changed.revision,
      sourceReceipt: opened.receipt,
      rebuiltAt: "2026-09-25T20:02:00.000Z",
    })).toThrow(/not compatible with the current scientific inputs/iu);
    expect(changed.studyDesignAdvices).toEqual([]);
  });
});
