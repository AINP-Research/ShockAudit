import type {
  Screen02AssessmentLifecycleStatus,
  Screen02CriterionFindingResult,
  Screen02CriterionKind,
  Screen02WorkflowSource,
} from "../../core/screen02-workflow-types";

export const screen02FindCopy = {
  eyebrow: "Screen 2 Find",
  title: "Find a shock for your study",
  purpose:
    "ShockAudit retrieves and ranks documented records against your confirmed study. After reviewing those results, you can optionally search more widely for additional source-backed candidates.",
  studyTitle: "Your confirmed study",
  listTitle: "Candidate shocks",
  listHelp:
    "Every candidate has source-backed identity, substantive-change, and date support with no demonstrated scope conflict. Unresolved coverage, treatment timing, and exposure facts move forward as Screen 3 verification needs.",
  noSelection: "No shock chosen yet.",
  decisionWarning:
    "Choosing records a tentative decision; it does not verify timing, coverage, exposure, or causal validity.",
  noResult: "No suitable shock was found under this protocol.",
  coverage:
    "Candidates found under this protocol, not all possible shocks.",
  choose: "Investigate this shock",
  continue: "Continue to Screen 3: Verify event",
} as const;

export const criterionKindCopy: Record<
  Screen02CriterionKind,
  { short: string; label: string; help: string; placeholder: string }
> = {
  "only-include": {
    short: "Only include",
    label: "Only include shocks that…",
    help: "Use this only for an extra required condition.",
    placeholder: "e.g., were imposed by a government",
  },
  "rank-higher": {
    short: "Rank higher",
    label: "Rank higher shocks that…",
    help: "Use this as a preference; other eligible shocks may remain.",
    placeholder: "e.g., have public exposure indicators",
  },
  "do-not-show": {
    short: "Do not show",
    label: "Do not show shocks that…",
    help: "Use this only for an extra required exclusion.",
    placeholder: "e.g., require proprietary employee data",
  },
};

export const lifecycleCopy: Record<
  Screen02AssessmentLifecycleStatus,
  string
> = {
  prepared: "Getting the source-backed review ready…",
  "message-delivered": "Reviewing this candidate for your study…",
  "draft-received": "The preliminary review arrived. Checking it…",
  validating: "Checking the review against the source packet…",
  partial: "Part of the review is ready. Only the missing items need another try.",
  completed: "Assessment ready.",
  "service-unavailable":
    "The brief assessment is unavailable. You may still choose a source-backed candidate and continue with extra verification.",
  "delivery-rejected":
    "The brief assessment could not start in the current view. You may still choose a source-backed candidate and continue with extra verification.",
  "no-tool-submission": "The preliminary review did not arrive yet.",
  "validation-failed": "The preliminary review was incomplete or could not be checked.",
  "timed-out": "The preliminary review took too long.",
  superseded: "A newer search or identity is active.",
  "retry-exhausted":
    "Assessment could not be completed after three attempts.",
};

export const criterionFindingCopy: Record<
  Screen02CriterionFindingResult,
  string
> = {
  meets: "Meets",
  "does-not-meet": "Does not meet",
  violates: "Violates",
  "does-not-violate": "Does not violate",
  unclear: "Unclear",
  "technical-failure": "Evaluation failed",
};

export function sourceAuthorityLabel(
  sources: readonly Screen02WorkflowSource[],
) {
  if (sources.length === 0) return "No source attached";
  const strongestTier = Math.min(
    ...sources.map((source) => source.authorityTier),
  );
  if (
    strongestTier <= 2 &&
    sources.some((source) =>
      source.channel.toLocaleLowerCase("en-US").startsWith("official"),
    )
  ) {
    return "Official primary source";
  }
  if (strongestTier <= 2) return "High-authority source";
  if (strongestTier <= 4) return "Supporting source";
  return "Source authority is limited";
}

export function formatDateLead(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!match) return date;
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = monthNames[Number(match[2]) - 1];
  return month
    ? `${Number(match[3])} ${month} ${match[1]}`
    : date;
}

export function readableChannel(channel: string) {
  const names: Record<string, string> = {
    "official-primary": "Official primary sources",
    "administrative-data": "Administrative data",
    "legal-policy": "Legislation and policy records",
    "scholarly-research": "Scholarly research",
    "credible-reporting": "Credible reporting",
  };
  return (
    names[channel] ??
    channel.replace(/[-_]+/g, " ").replace(/^\w/, (letter) =>
      letter.toUpperCase(),
    )
  );
}
