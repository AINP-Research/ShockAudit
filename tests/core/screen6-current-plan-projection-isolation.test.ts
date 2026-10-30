import { describe, expect, it, vi } from "vitest";

const diagnosticLibraryFault = vi.hoisted(() => ({
  armed: false,
  triggered: 0,
}));

vi.mock("../../src/core/six-screen/screen6-diagnostic-plan", async (
  importOriginal,
) => {
  const actual = await importOriginal<typeof import(
    "../../src/core/six-screen/screen6-diagnostic-plan"
  )>();
  return {
    ...actual,
    screen6ReviewedDiagnosticLibrary: () => {
      const library = actual.screen6ReviewedDiagnosticLibrary();
      if (!diagnosticLibraryFault.armed) return library;
      diagnosticLibraryFault.armed = false;
      diagnosticLibraryFault.triggered += 1;
      return library.filter(({ id }) => id !== "timing-anticipation-v1");
    },
  };
});

import { createScreen6CurrentPlan } from
  "../../src/core/six-screen/screen6-current-plan";
import { openScreen3 } from "../../src/core/six-screen/workflow";
import {
  browserEventCardFixtureAt,
  createBrowserEventCardFixture,
} from "../browser/six-screen-event-card-review-fixture";

describe("Screen 6 optional plan projection isolation", () => {
  it("keeps the plan readable and records a gap when one reviewed check is unavailable", () => {
    diagnosticLibraryFault.armed = false;
    diagnosticLibraryFault.triggered = 0;
    const fixture = createBrowserEventCardFixture();
    const state = openScreen3(fixture.state, {
      expectedRevision: fixture.state.revision,
      study: {
        ...fixture.state.study,
        policySideConcept: "Information transparency",
        initialExplanation:
          "The rule could change information available to market participants.",
        proposedTreatment: "California firms",
        proposedComparison: "Non-California firms",
      },
      proposedTiming: {
        mode: "year",
        year: 2020,
        milestoneReference: null,
      },
      openedAt: browserEventCardFixtureAt(40),
    }).state;
    const expectedClaimCount = state.policyReview?.claims.length ?? 0;

    diagnosticLibraryFault.armed = true;
    const plan = createScreen6CurrentPlan(state);

    expect(diagnosticLibraryFault.triggered).toBe(1);
    expect(plan.priorities.map(({ id }) => id)).not.toContain(
      "timing-anticipation-v1",
    );
    expect(plan.priorities.map(({ id }) => id)).toEqual(expect.arrayContaining([
      "exposure-and-comparator",
      "coevent-exposure-alternatives-v1",
      "group-inference-clustering-v1",
      "outcome-sample-continuity-v1",
      "treatment-package-separability-v1",
    ]));
    expect(plan.gaps).toEqual(expect.arrayContaining([
      expect.stringMatching(
        /timing-anticipation-v1.*not added.*remains unresolved/iu,
      ),
    ]));
    const datedStageIds = plan.upstream.policyEvidence.chronology
      .filter(({ timing }) => timing.mode === "absolute")
      .slice(0, 3)
      .map(({ id }) => id);
    const exposurePriority = plan.priorities.find(({ id }) =>
      id === "exposure-and-comparator");
    expect(exposurePriority).toBeDefined();
    expect(exposurePriority?.evidenceRefs ?? []).not.toEqual(
      expect.arrayContaining(datedStageIds),
    );
    expect(plan.upstream.policyEvidence.claims).toHaveLength(expectedClaimCount);
    expect(new Set(plan.priorities.map(({ id }) => id)).size)
      .toBe(plan.priorities.length);
    expect(plan.modelCalls).toBe(0);
    expect(plan.resultsAssessed).toBe(false);
  });
});
