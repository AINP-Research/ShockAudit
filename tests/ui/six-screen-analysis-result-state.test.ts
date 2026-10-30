import { describe, expect, it } from "vitest";
import { projectAnalysisResultState } from
  "../../src/ui/six-screen/analysis-result-state";

describe("analysis result display projection", () => {
  it("keeps receipt, validated artifact, and completed output distinct", () => {
    expect(projectAnalysisResultState({ currentArtifact: false,
      rawReceipt: true })).toBe("receipt_saved");
    expect(projectAnalysisResultState({ currentArtifact: false,
      savedArtifact: true })).toBe("artifact_saved");
    expect(projectAnalysisResultState({ currentArtifact: true,
      completedItems: 1 })).toBe("complete");
    expect(projectAnalysisResultState({ currentArtifact: true,
      completedItems: 0, completedWithNoAdditionalItems: true }))
      .toBe("complete_zero");
  });

  it("retains partial output through a failed remaining batch", () => {
    expect(projectAnalysisResultState({ currentArtifact: true,
      completedItems: 1, pendingItems: 1,
      failure: "provider_rejected" })).toBe("partial");
    expect(projectAnalysisResultState({ currentArtifact: false,
      completedItems: 1, pendingItems: 1,
      failure: "outcome_unknown" })).toBe("partial");
  });

  it("does not turn unknown dispatch or unavailable configuration into a result", () => {
    expect(projectAnalysisResultState({ currentArtifact: false,
      failure: "outcome_unknown" })).toBe("outcome_unknown");
    expect(projectAnalysisResultState({ currentArtifact: false,
      failure: "before_dispatch" })).toBe("failed_before_dispatch");
    expect(projectAnalysisResultState({ currentArtifact: false,
      configurationAvailable: false })).toBe("configuration_unavailable");
    expect(projectAnalysisResultState({ currentArtifact: false,
      stale: true })).toBe("stale");
  });
});
