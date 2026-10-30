import { describe, expect, it } from "vitest";

import {
  screen5ArgumentSupportScope,
  screen5CompactMechanismHeading,
  screen5DirectionLabel,
  screen5EvidenceProgress,
  screen5EvidenceStatus,
  screen5PolicyAnchoredPath,
  screen5OutcomeTarget,
  screen5SourceCitationLabel,
  screen5ProposedDirectionLabel,
  screen5PredictionEmptyMessage,
  screen5PrimaryArgument,
  screen5UniqueArguments,
  type Screen5AssessedMechanism,
  type Screen5MechanismArgument,
  type Screen5PresentationCheckState,
} from "../../src/ui/six-screen/screen5-presentation";

type SavedDirection = Screen5AssessedMechanism["direction"];

function direction(
  outcomeImplication: NonNullable<SavedDirection>["outcomeImplication"],
  condition = "The saved condition applies.",
): NonNullable<SavedDirection> {
  return {
    mechanismResponse: "not_specified",
    outcomeImplication,
    basis: "not_specified",
    condition,
  };
}

function argument(input: Partial<Screen5MechanismArgument> & {
  text: string;
}): Screen5MechanismArgument {
  return {
    text: input.text,
    evidenceIds: input.evidenceIds ?? [],
    citations: input.citations ?? [],
    supportStatus: input.supportStatus ?? "analytical_hypothesis",
    basis: input.basis,
  };
}

describe("Screen 5 policy-anchored presentation", () => {
  it("P01 anchors the bound policy without changing the saved construct node", () => {
    const original = ["Customer protection increases", "Lower data access"];
    expect(screen5PolicyAnchoredPath({
      policyName: "California Consumer Privacy Act",
      originalNodes: original,
      outcomeEndpoint: "Direction uncertain",
    })).toEqual([
      "California Consumer Privacy Act",
      "Customer protection increases",
      "Lower data access",
      "Direction uncertain",
    ]);
    expect(original).toEqual([
      "Customer protection increases",
      "Lower data access",
    ]);
  });

  it("P02 uses the supplied snapshot policy identity exactly", () => {
    expect(screen5PolicyAnchoredPath({
      policyName: "Generic Privacy Rule",
      originalNodes: ["Disclosure changes"],
      outcomeEndpoint: "Direction not yet assessed",
    })[0]).toBe("Generic Privacy Rule");
  });

  it("P03 retains a composite first-node premise", () => {
    const composite = "Transparency enhancement, if it adds new duties";
    expect(screen5PolicyAnchoredPath({
      policyName: "California Consumer Privacy Act",
      originalNodes: [composite, "Staff effort", "Operating costs"],
      outcomeEndpoint: "Firm performance may decrease",
    })).toContain(composite);
  });

  it("P04 suppresses only an adjacent exact policy duplicate", () => {
    expect(screen5PolicyAnchoredPath({
      policyName: "Privacy Act",
      originalNodes: ["Privacy Act", "Privacy Act compliance duties"],
      outcomeEndpoint: "Direction uncertain",
    })).toEqual([
      "Privacy Act",
      "Privacy Act compliance duties",
      "Direction uncertain",
    ]);
  });

  it("renders one signed outcome endpoint while retaining the saved chain", () => {
    const original = ["Transparency", "Higher compliance cost", "Firm performance"];
    expect(screen5PolicyAnchoredPath({
      policyName: "Privacy Act", originalNodes: original,
      neutralOutcome: "Firm performance",
      outcomeEndpoint: "Firm performance may decrease",
    })).toEqual(["Privacy Act", "Transparency", "Higher compliance cost",
      "Firm performance may decrease"]);
    expect(original.at(-1)).toBe("Firm performance");
  });

  it("replaces a neutral measure endpoint with one signed named outcome/measure", () => {
    expect(screen5PolicyAnchoredPath({
      policyName: "Privacy Act",
      originalNodes: ["Transparency", "Higher compliance cost", "Return on assets"],
      neutralOutcome: "Firm performance", neutralMeasure: "Return on assets",
      outcomeEndpoint: "Firm performance (Return on assets) may decrease",
    })).toEqual(["Privacy Act", "Transparency", "Higher compliance cost",
      "Firm performance (Return on assets) may decrease"]);
  });
});

describe("Screen 5 direction language", () => {
  it("keeps the saved provisional condition once beside a signed endpoint", () => {
    const proposed = { mode: "single_hypothesis" as const,
      target_outcome: "Firm performance", target_measure: "ROA",
      scenarios: [{ sign: "negative" as const,
        condition: "Costs cannot be offset", rationale: "Saved hypothesis",
        intermediate_movement: "Expenses rise", horizon: null }],
      missing_assumption: null };
    expect(screen5ProposedDirectionLabel(proposed, false))
      .toBe("Potentially lower Firm performance (ROA)");
    expect(screen5ProposedDirectionLabel(proposed))
      .toContain("if Costs cannot be offset");
  });
  it("keeps a named outcome and measure while the sign is unresolved", () => {
    const target = { outcome: "Firm performance", measure: "ROA" };
    expect(screen5ProposedDirectionLabel(undefined, true, target))
      .toBe("Firm performance (ROA) — direction not specified in this saved proposal");
    expect(screen5ProposedDirectionLabel({ mode: "under_specified",
      target_outcome: target.outcome, target_measure: target.measure,
      scenarios: [], missing_assumption: "Cost pass-through is unknown" }, true, target))
      .toBe("Firm performance (ROA) — direction unresolved; a premise is missing");
    expect(screen5OutcomeTarget(target.outcome, target.measure))
      .toBe("Firm performance (ROA)");
  });
  it("P05 maps a saved decrease without making it unconditional", () => {
    expect(screen5DirectionLabel(
      direction("decrease", "Implementation effort is material."),
      "Firm performance",
    )).toBe("Firm performance may decrease");
  });

  it("P06 maps a saved increase without a hardcoded negative endpoint", () => {
    expect(screen5DirectionLabel(direction("increase"), "Firm performance"))
      .toBe("Firm performance may increase");
  });

  it("P07 keeps assessed uncertainty distinct", () => {
    expect(screen5DirectionLabel(direction("uncertain"), "Firm performance"))
      .toBe("Firm performance — direction uncertain");
  });

  it("P09 retains the saved condition for a mixed direction", () => {
    expect(screen5DirectionLabel(
      direction("mixed", "Short- and long-run responses differ."),
      "Firm performance",
    )).toBe("Firm performance — direction varies by condition: Short- and long-run responses differ.");
  });

  it("shows previously proposed opposing signs only when saved and target-bound", () => {
    const proposal = { mode: "conditional_scenarios" as const,
      target_outcome: "Firm performance", target_measure: "ROA",
      scenarios: [
        { sign: "negative" as const, condition: "Costs exceed savings",
          rationale: "Saved hypothesis", intermediate_movement: "Expenses rise", horizon: null },
        { sign: "positive" as const, condition: "Retention gains exceed costs",
          rationale: "Saved hypothesis", intermediate_movement: "Revenue rises", horizon: null },
      ], missing_assumption: null };
    expect(screen5DirectionLabel(direction("mixed"), "Firm performance", "ROA", proposal))
      .toContain("previously proposed, unconfirmed scenarios: lower if Costs exceed savings; higher if Retention gains exceed costs");
    expect(screen5DirectionLabel(direction("mixed"), "Firm performance", "Other measure", proposal))
      .toBe("Firm performance (Other measure) — direction varies by condition: The saved condition applies.");
  });

  it("P10 keeps not specified distinct from uncertainty", () => {
    expect(screen5DirectionLabel(direction("not_specified"), "Firm performance"))
      .toBe("Firm performance — direction not specified in this assessment");
    expect(screen5DirectionLabel(undefined, "Firm performance"))
      .toBe("Firm performance — direction not specified in this assessment");
  });

  it("P11 names the saved measure without interpreting its polarity", () => {
    const label = screen5DirectionLabel(direction("increase"), "Firm performance", "ROA");
    expect(label).toBe("Firm performance (ROA) may increase");
    expect(label).not.toContain("improvement");
  });

  it.each(["Higher costs", "Customer trust", "Product delay"])(
    "M01 does not infer a direction from the title %s",
    (title) => {
      expect(screen5DirectionLabel(undefined, title))
        .toBe(`${title} — direction not specified in this assessment`);
    },
  );
});

describe("Screen 5 evidence labels and progress", () => {
  it("places inspected proposition and transfer scopes near the linked argument", () => {
    const inspected = argument({ text: "A source checked an intermediate link.",
      basis: "inspected_proposition", evidenceIds: ["e1"] });
    const transfer = argument({ text: "A source studied a different setting.",
      basis: "study_transfer", evidenceIds: ["e2"] });
    expect(screen5EvidenceStatus({ assessed: true,
      sourceCheckStatus: "checked_relevant_text", primaryArgument: inspected }).label)
      .toBe("Evidence checked · Linked proposition only");
    expect(screen5EvidenceStatus({ assessed: true,
      sourceCheckStatus: "checked_relevant_text", primaryArgument: transfer }).label)
      .toBe("Evidence checked · Transfer only");
    expect(screen5ArgumentSupportScope(inspected)).toContain("full policy-to-outcome pathway has not been tested");
    expect(screen5ArgumentSupportScope(transfer)).toContain("transfer from another setting");
    expect(screen5ArgumentSupportScope(argument({ text: "Legacy linked claim.",
      evidenceIds: ["e1"] }))).toContain("proposition scope is unclassified");
  });
  it("derives inline author–year labels from source metadata without using paper titles", () => {
    const source = { authors: ["Jane Scholar"],
      publicationYear: 2022, title: "A study of the effects of disclosure" };
    expect(screen5SourceCitationLabel(source)).toBe("Scholar, 2022");
    expect(screen5SourceCitationLabel({ ...source, authors: [] }))
      .toBe("Author unavailable, 2022");
  });
  it("P15 distinguishes a completed check with no support", () => {
    expect(screen5EvidenceStatus({
      assessed: true,
      sourceCheckStatus: "checked_no_relevant_match",
    })).toEqual({
      label: "Evidence checked · Support not found",
      state: "checked_no_relevant_match",
      complete: true,
    });
  });

  it("P16 distinguishes pending, inaccessible, and budget-incomplete checks", () => {
    expect(screen5EvidenceStatus({ assessed: false }).label)
      .toBe("Evidence check pending");
    expect(screen5EvidenceStatus({
      assessed: true,
      sourceCheckStatus: "text_unavailable",
    }).label).toBe("Source access incomplete");
    expect(screen5EvidenceStatus({
      assessed: true,
      sourceCheckStatus: "not_checked_due_budget",
    }).label).toBe("Evidence check incomplete");
  });

  it("P17 does not treat missing legacy metadata as completed", () => {
    expect(screen5EvidenceStatus({ assessed: true })).toEqual({
      label: "Evidence check incomplete",
      state: "legacy_unknown",
      complete: false,
    });
  });

  it("P19 reports four alternatives, two complete, and two pending", () => {
    const progress = screen5EvidenceProgress([
      "checked_relevant_text",
      "checked_no_relevant_match",
      "pending",
      "pending",
    ]);
    expect(progress).toMatchObject({
      total: 4,
      complete: 2,
      pending: 2,
      incomplete: 0,
    });
    expect(progress.label).toBe(
      "Four mechanisms proposed. Evidence checks are complete for two; two remain to be checked.",
    );
  });

  it.each([
    [[], 0],
    [["pending"], 1],
    [Array.from({ length: 10 }, () => "pending"), 10],
  ] as Array<[Screen5PresentationCheckState[], number]>)(
    "P26 handles %i alternatives without a schema cap",
    (states, expected) => {
      expect(screen5EvidenceProgress(states).total).toBe(expected);
    },
  );
});

describe("Screen 5 compact concept headings", () => {
  it("uses a saved intermediate process when the saved heading is a paper title", () => {
    const article = "Information Transparency and the Cost of Privacy Regulation";
    expect(screen5CompactMechanismHeading({ concept: article,
      processNodes: ["Transparency duties", "Compliance costs", "Firm performance"],
      sourceTitles: [article], outcome: "Firm performance" }))
      .toBe("Compliance costs");
  });
  it("preserves compact saved concepts and stores long headings in details", () => {
    expect(screen5CompactMechanismHeading({ concept: "Customer trust",
      processNodes: ["Transparency", "Customer trust", "ROA"] }))
      .toBe("Customer trust");
    expect(screen5CompactMechanismHeading({
      concept: "An extremely long sentence with far too many words to function as a compact noun heading for a mechanism card",
      processNodes: ["Transparency", "Information system costs", "ROA"],
    })).toBe("Information system costs");
  });
});

describe("Screen 5 compact arguments", () => {
  it("P13 preserves negation and conflicting complete sentences", () => {
    const claims = [
      argument({ text: "Trust may rise." }),
      argument({ text: "Trust may not rise when controls are hidden." }),
    ];
    expect(screen5UniqueArguments(claims).map(({ text }) => text)).toEqual([
      "Trust may rise.",
      "Trust may not rise when controls are hidden.",
    ]);
  });

  it("P14 prioritizes an inspected proposition for claim-level citation", () => {
    const hypothesis = argument({
      text: "The full pathway is an analytical hypothesis.",
      basis: "analytical_hypothesis",
    });
    const inspected = argument({
      text: "The inspected abstract supports the intermediate trust step.",
      evidenceIds: ["e-1"],
      citations: ["Researcher, 2022"],
      supportStatus: "source_linked",
      basis: "inspected_proposition",
    });
    expect(screen5PrimaryArgument([hypothesis, inspected])).toBe(inspected);
  });

  it("M02 suppresses only exact duplicate argument records", () => {
    const first = argument({ text: "A complete saved sentence." });
    const distinctBasis = argument({
      text: "A complete saved sentence.",
      basis: "study_transfer",
    });
    expect(screen5UniqueArguments([first, first, distinctBasis])).toEqual([
      first,
      distinctBasis,
    ]);
  });
});

describe("Screen 5 prediction empty states", () => {
  it("P27 uses partial-run wording", () => {
    expect(screen5PredictionEmptyMessage({ completionStatus: "partial" }))
      .toBe(
        "Comparison predictions are not available in this saved partial assessment.",
      );
  });

  it("P28 distinguishes completed and failed no-row states", () => {
    expect(screen5PredictionEmptyMessage({ completionStatus: "completed" }))
      .toBe("No comparison predictions were generated in this assessment.");
    expect(screen5PredictionEmptyMessage({
      completionStatus: "partial",
      executionPhase: "failed",
    })).toBe(
      "Comparison predictions are unavailable because the saved assessment did not complete successfully.",
    );
  });
});
