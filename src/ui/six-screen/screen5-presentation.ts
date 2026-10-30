import { screen5MechanismCitationLabel, type Screen5MechanismComparison } from
  "../../core/six-screen/screen5-mechanism";
import type { Screen5ProposedDirectionWire } from
  "../../core/six-screen/screen5-mechanism";

/** Read only the saved proposal; never infer a sign from pathway words. */
export function screen5ProposedDirectionLabel(
  direction: Screen5ProposedDirectionWire | undefined,
  includeSingleCondition = true,
  savedTarget?: { outcome: string | null | undefined; measure?: string | null },
) {
  const target = screen5OutcomeTarget(
    savedTarget ? savedTarget.outcome : direction?.target_outcome,
    savedTarget ? savedTarget.measure : direction?.target_measure,
  );
  if (!direction) return `${target} — direction not specified in this saved proposal`;
  if (direction.mode === "under_specified") {
    return `${target} — direction unresolved; a premise is missing`;
  }
  if (direction.mode === "conditional_scenarios") {
    return `Conditional proposals: ${direction.scenarios.map(({ sign, condition }) =>
      `${sign === "positive" ? "Higher" : "Lower"} ${target} if ${condition}`
    ).join("; ")}`;
  }
  const scenario = direction.scenarios[0]!;
  return `Potentially ${scenario.sign === "positive" ? "higher" : "lower"} ${target}${includeSingleCondition ? ` if ${scenario.condition}` : ""}`;
}

export type Screen5AssessedMechanism =
  Screen5MechanismComparison["mechanisms"][number];
export type Screen5MechanismArgument =
  Screen5AssessedMechanism["argument"][number];
export type Screen5SourceCheckStatus =
  NonNullable<Screen5AssessedMechanism["sourceCheckStatus"]>;
export type Screen5PresentationCheckState =
  | Screen5SourceCheckStatus
  | "pending"
  | "legacy_unknown";

const numberWords = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
] as const;

function cleanText(value: string | null | undefined) {
  return value?.trim().replaceAll(/\s+/g, " ") ?? "";
}

export function screen5OutcomeTarget(
  outcome: string | null | undefined, measure?: string | null,
) {
  const label = cleanText(outcome) || "Saved outcome Y";
  const namedMeasure = cleanText(measure);
  return namedMeasure && !sameVisibleText(label, namedMeasure)
    ? `${label} (${namedMeasure})` : label;
}

export function screen5SourceCitationLabel(
  source: Pick<Screen5MechanismComparison["bibliography"][number],
    "authors" | "publicationYear" | "title">,
) {
  return source.authors.length
    ? screen5MechanismCitationLabel(source)
    : `Author unavailable, ${source.publicationYear ?? "year unknown"}`;
}

/** The original heading remains in saved details. Never present a known paper
 * title or a long provider sentence as a mechanism concept. */
export function screen5CompactMechanismHeading(input: {
  concept: string;
  processNodes: readonly string[];
  sourceTitles?: readonly string[];
  policyName?: string | null;
  outcome?: string | null;
  fallback?: string;
}) {
  const titles = new Set((input.sourceTitles ?? []).map((title) =>
    cleanText(title).normalize("NFKC").toLocaleLowerCase()));
  const acceptable = (value: string) => {
    const text = cleanText(value);
    return text.length > 0 && text.length <= 90 &&
      (text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0) <= 10 &&
      !titles.has(text.normalize("NFKC").toLocaleLowerCase());
  };
  const concept = cleanText(input.concept);
  if (acceptable(concept)) return concept;
  const fallbackNode = input.processNodes.slice(1, -1).map(cleanText)
    .find((node) => acceptable(node) &&
      !sameVisibleText(node, input.policyName ?? "") &&
      !sameVisibleText(node, input.outcome ?? ""));
  return fallbackNode ?? input.fallback ?? "Alternative process";
}

function sameVisibleText(left: string, right: string) {
  return cleanText(left).toLocaleLowerCase() ===
    cleanText(right).toLocaleLowerCase();
}

function displayCount(value: number) {
  return numberWords[value] ?? value.toLocaleString();
}

function sentenceStart(value: string) {
  return value ? `${value[0].toLocaleUpperCase()}${value.slice(1)}` : value;
}

/**
 * Adds the bound policy as a display-only context anchor. The original
 * scientific nodes remain intact; no construct label or premise is replaced.
 */
export function screen5PolicyAnchoredPath(input: {
  policyName: string;
  originalNodes: string[];
  outcomeEndpoint: string;
  neutralOutcome?: string;
  neutralMeasure?: string | null;
}) {
  const policyName = cleanText(input.policyName) || "Saved policy";
  const nodes = input.originalNodes.map(cleanText).filter(Boolean);
  const pathway = nodes.length && sameVisibleText(nodes[0], policyName)
    ? [...nodes]
    : [policyName, ...nodes];
  const outcomeEndpoint = cleanText(input.outcomeEndpoint);
  const neutralEndpoints = [input.neutralOutcome,
    input.neutralMeasure,
    input.neutralOutcome && input.neutralMeasure
      ? screen5OutcomeTarget(input.neutralOutcome, input.neutralMeasure) : null]
    .filter((value): value is string => Boolean(value));
  if (outcomeEndpoint && neutralEndpoints.some((value) =>
    sameVisibleText(pathway[pathway.length - 1] ?? "", value) &&
    !sameVisibleText(outcomeEndpoint, value))) {
    pathway.pop();
  }
  if (outcomeEndpoint &&
      !sameVisibleText(pathway[pathway.length - 1] ?? "", outcomeEndpoint)) {
    pathway.push(outcomeEndpoint);
  }
  return pathway.filter((node, index, values) =>
    index === 0 || !sameVisibleText(node, values[index - 1] ?? "")
  );
}

/** Maps only the stored outcome implication; titles and pathway nouns do not
 * contribute a sign, and the measure is deliberately not substituted. */
export function screen5DirectionLabel(
  direction: Screen5AssessedMechanism["direction"],
  outcome: string | null | undefined,
  measure?: string | null,
  savedProposal?: Screen5ProposedDirectionWire,
) {
  const target = screen5OutcomeTarget(outcome, measure);
  if (!direction || direction.outcomeImplication === "not_specified") {
    return `${target} — direction not specified in this assessment`;
  }
  if (direction.outcomeImplication === "increase") {
    return `${target} may increase`;
  }
  if (direction.outcomeImplication === "decrease") {
    return `${target} may decrease`;
  }
  if (direction.outcomeImplication === "mixed") {
    if (savedProposal?.mode === "conditional_scenarios" &&
        savedProposal.target_outcome === outcome &&
        savedProposal.target_measure === (measure ?? null) &&
        savedProposal.scenarios.length === 2 &&
        savedProposal.scenarios[0]?.sign !== savedProposal.scenarios[1]?.sign) {
      return `${target} — assessed implication mixed; previously proposed, unconfirmed scenarios: ${savedProposal.scenarios.map(
        ({ sign, condition }) => `${sign === "positive" ? "higher" : "lower"} if ${condition}`,
      ).join("; ")}`;
    }
    const condition = cleanText(direction.condition);
    return `${target} — direction varies by condition${condition ? `: ${condition}` : ""}`;
  }
  return `${target} — direction uncertain`;
}

export function screen5ArgumentSupportScope(argument: Screen5MechanismArgument) {
  if (argument.basis === "inspected_proposition" && argument.evidenceIds.length) {
    return "The linked source checks this proposition only; the full policy-to-outcome pathway has not been tested.";
  }
  if (argument.basis === "study_transfer" && argument.evidenceIds.length) {
    return "The linked source informs a transfer from another setting; this study and its outcome implication remain untested.";
  }
  if (argument.evidenceIds.length) {
    return "A saved source is linked, but its proposition scope is unclassified; the full pathway remains untested.";
  }
  return "Analytical hypothesis: no inspected source is linked to this argument.";
}

export function screen5EvidenceStatus(input: {
  assessed: boolean;
  sourceCheckStatus?: Screen5AssessedMechanism["sourceCheckStatus"];
  primaryArgument?: Screen5MechanismArgument | null;
}) {
  if (!input.assessed) {
    return {
      label: "Evidence check pending",
      state: "pending" as const,
      complete: false,
    };
  }
  if (input.sourceCheckStatus === "checked_relevant_text") {
    return {
      label: input.primaryArgument?.basis === "inspected_proposition"
        ? "Evidence checked · Linked proposition only"
        : input.primaryArgument?.basis === "study_transfer"
          ? "Evidence checked · Transfer only"
          : "Evidence checked · See argument scope",
      state: input.sourceCheckStatus,
      complete: true,
    };
  }
  if (input.sourceCheckStatus === "checked_no_relevant_match") {
    return {
      label: "Evidence checked · Support not found",
      state: input.sourceCheckStatus,
      complete: true,
    };
  }
  if (input.sourceCheckStatus === "text_unavailable") {
    return {
      label: "Source access incomplete",
      state: input.sourceCheckStatus,
      complete: false,
    };
  }
  if (input.sourceCheckStatus === "not_checked_due_budget") {
    return {
      label: "Evidence check incomplete",
      state: input.sourceCheckStatus,
      complete: false,
    };
  }
  return {
    label: "Evidence check incomplete",
    state: "legacy_unknown" as const,
    complete: false,
  };
}

export function screen5EvidenceProgress(
  states: Screen5PresentationCheckState[],
) {
  const total = states.length;
  const complete = states.filter((state) =>
    state === "checked_relevant_text" ||
    state === "checked_no_relevant_match"
  ).length;
  const pending = states.filter((state) => state === "pending").length;
  const incomplete = total - complete - pending;
  const totalText = displayCount(total);
  const completeText = displayCount(complete);
  const remaining = pending + incomplete;

  let label: string;
  if (!total) {
    label = "No additional mechanisms are currently admitted.";
  } else if (!remaining) {
    label = `${sentenceStart(totalText)} mechanism${total === 1 ? "" : "s"} proposed. Evidence checks are complete for all ${totalText}.`;
  } else if (!incomplete) {
    label = `${sentenceStart(totalText)} mechanism${total === 1 ? "" : "s"} proposed. Evidence checks are complete for ${completeText}; ${displayCount(pending)} ${pending === 1 ? "remains" : "remain"} to be checked.`;
  } else if (!pending) {
    label = `${sentenceStart(totalText)} mechanism${total === 1 ? "" : "s"} proposed. Evidence checks are complete for ${completeText}; ${displayCount(incomplete)} ${incomplete === 1 ? "remains" : "remain"} incomplete.`;
  } else {
    label = `${sentenceStart(totalText)} mechanism${total === 1 ? "" : "s"} proposed. Evidence checks are complete for ${completeText}; ${displayCount(pending)} remain pending and ${displayCount(incomplete)} are incomplete.`;
  }

  return { total, complete, pending, incomplete, label };
}

function argumentBasisRank(argument: Screen5MechanismArgument) {
  if (argument.basis === "inspected_proposition") return 0;
  if (argument.basis === "study_transfer") return 1;
  if (argument.supportStatus === "source_linked") return 2;
  return 3;
}

export function screen5UniqueArguments(
  argumentsToDisplay: Screen5MechanismArgument[],
) {
  const seen = new Set<string>();
  return argumentsToDisplay.filter((argument) => {
    const key = JSON.stringify({
      text: cleanText(argument.text),
      basis: argument.basis ?? argument.supportStatus,
      evidenceIds: argument.evidenceIds,
      citations: argument.citations,
    });
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Chooses one ordinary-view explanation by explicit scientific role. The
 * complete saved argument list remains available in expanded details. */
export function screen5PrimaryArgument(
  argumentsToDisplay: Screen5MechanismArgument[],
) {
  return screen5UniqueArguments(argumentsToDisplay)
    .map((argument, index) => ({ argument, index }))
    .sort((left, right) =>
      argumentBasisRank(left.argument) - argumentBasisRank(right.argument) ||
      left.index - right.index
    )[0]?.argument ?? null;
}

export function screen5PredictionEmptyMessage(input: {
  completionStatus?: "partial" | "completed";
  executionPhase?: string | null;
}) {
  if (["failed", "blocked", "outcome_unknown"].includes(
    input.executionPhase ?? "",
  )) {
    return "Comparison predictions are unavailable because the saved assessment did not complete successfully.";
  }
  if (input.completionStatus === "partial" ||
      input.executionPhase && input.executionPhase !== "completed") {
    return "Comparison predictions are not available in this saved partial assessment.";
  }
  return "No comparison predictions were generated in this assessment.";
}
