import { describe, expect, it } from "vitest";

import { validateScreen3EntryDraft } from
  "../../src/core/six-screen/screen3-entry-validation";

const completeStudy = {
  population: " Public companies ",
  analysisUnit: " Firm-year ",
  geography: [" United States ", "United States"],
  industry: ["Video games"],
  period: { start: "2018", end: "2025" },
  outcome: "Return on assets",
  outcomeMeasure: null,
  intendedConstruct: null,
  policySideConcept: null,
  initialExplanation: "Did the policy change firm performance?",
  proposedTreatment: null,
  proposedComparison: null,
  resultsPreviouslyInspected: "no" as const,
};

describe("Screen 3 candidate-state validation", () => {
  it("uses the current complete draft and returns one normalized payload", () => {
    const result = validateScreen3EntryDraft({
      study: completeStudy,
      timing: { mode: "year", year: "2020" },
    });

    expect(result.ready).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.study).toMatchObject({
      population: "Public companies",
      analysisUnit: "Firm-year",
      geography: ["United States"],
    });
    expect(result.proposedTiming).toEqual({
      mode: "year",
      year: 2020,
      milestoneReference: null,
    });
  });

  it("identifies only the actual blank field and maps it to the editor", () => {
    const result = validateScreen3EntryDraft({
      study: { ...completeStudy, initialExplanation: "   " },
      timing: { mode: "undecided", year: "" },
    });

    expect(result.ready).toBe(false);
    expect(result.issues).toEqual([{
      code: "study_question",
      fieldIds: ["initialExplanation"],
      message: "State the intended policy-effect question or explanation.",
      classification: "screen_3_prerequisite",
    }]);
  });

  it("requires an explicit timing choice and validates a selected year", () => {
    const missing = validateScreen3EntryDraft({
      study: completeStudy,
      timing: { mode: "", year: "" },
    });
    expect(missing.issues).toEqual([
      expect.objectContaining({
        code: "proposed_timing",
        fieldIds: ["proposedTiming"],
      }),
    ]);

    const invalidYear = validateScreen3EntryDraft({
      study: completeStudy,
      timing: { mode: "year", year: "20" },
    });
    expect(invalidYear.issues).toEqual([
      expect.objectContaining({
        code: "treatment_year",
        fieldIds: ["treatmentYear"],
      }),
    ]);
  });

  it("rejects reversed study boundaries before any mutation is sent", () => {
    const result = validateScreen3EntryDraft({
      study: {
        ...completeStudy,
        period: { start: "2025", end: "2018" },
      },
      timing: { mode: "varies_by_group", year: "" },
    });

    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "study_period_order",
        fieldIds: ["periodStart", "periodEnd"],
      }),
    ]);
  });
});
