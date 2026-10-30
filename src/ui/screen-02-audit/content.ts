import type {
  Screen02AssessmentLifecycleStatus,
  Screen02AuditRelationship,
  Screen02AuditVersionType,
  Screen02CoverageRelationCategory,
  Screen02MeasurementPotentialCategory,
  Screen02OutcomePathwayCategory,
  Screen02PreliminaryJudgment,
  Screen02StudyFitCategory,
  Screen02WorkflowSource,
} from "../../core/screen02-workflow-types";
import { screen02ProviderNeutralCopy } from "../screen-02/provider-neutral-copy";

export const screen02AuditCopy = {
  eyebrow: "Screen 2 Audit",
  identifyTitle: "Identify and understand your shock",
  identifyPurpose:
    "Resolve the event the researcher meant before assessing its value for the study.",
  listTitle: "Possible matches",
  listHelp:
    "Choose a record to understand it. This does not confirm it.",
  confirm: "Yes, this is the shock I meant",
  relatedVersion: "Related, but I meant another version",
  reject: "No, this is different",
  noResult: "This shock was not found under this protocol.",
  assessmentTitle: "Brief assessment for your study",
  assessmentPurpose:
    "This short, explicitly preliminary interpretation uses the confirmed event, its linked sources, and your study. It shows how the event may reach your sample and outcome before the deeper mechanism work on later screens.",
  boundary:
    "Screen 2 identifies and preliminarily evaluates the event. Screen 3 verifies what changed, when it changed, and which organizations were formally covered.",
} as const;

export const auditPhaseCopy = [
  {
    id: "identify",
    number: 1,
    title: "Identify",
    description: "Preserve the wording and resolve a structured anchor.",
  },
  {
    id: "understand",
    number: 2,
    title: "Understand",
    description: "Review one match-specific provisional dossier.",
  },
  {
    id: "confirm-or-correct",
    number: 3,
    title: "Confirm or correct",
    description: "Record the intended identity or revise the search.",
  },
  {
    id: "assess",
    number: 4,
    title: "Assess",
    description: "Evaluate the confirmed identity for this study.",
  },
] as const;

export const relationshipCopy: Record<Screen02AuditRelationship, string> = {
  exact: "Exact match",
  "supported-alias": "Supported alias",
  original: "Original instrument or event",
  amendment: "Amendment",
  "implementing-rule": "Implementing rule",
  "enforcement-action": "Enforcement action",
  "related-event": "Related event",
  uncertain: "Relationship uncertain",
};

export const versionTypeCopy: Record<Screen02AuditVersionType, string> = {
  unspecified: "Not specified",
  original: "Original",
  amendment: "Amendment",
  "implementing-rule": "Implementing rule",
  "enforcement-action": "Enforcement action",
};

export const lifecycleCopy: Record<
  Screen02AssessmentLifecycleStatus,
  string
> = {
  prepared: "Getting the source-backed review ready…",
  "message-delivered": "Preparing this source-backed review…",
  "draft-received": "The review arrived. Checking it…",
  validating: "Checking the review against the source packet…",
  partial: "Part of the review is ready. Only the missing items need another try.",
  completed: "Assessment ready.",
  "service-unavailable":
    "The source-backed review is unavailable. Your event record and attached sources remain intact.",
  "delivery-rejected":
    "This source-backed review could not start in the current view. Your event record and attached sources remain intact.",
  "no-tool-submission": "The source-backed review did not arrive yet.",
  "validation-failed": "The source-backed review was incomplete or could not be checked.",
  "timed-out": "The source-backed review took too long.",
  superseded: "A newer search or identity is active.",
  "retry-exhausted":
    "Assessment could not be completed after three attempts.",
};

export const preliminaryJudgmentCopy: Record<
  Screen02PreliminaryJudgment,
  string
> = {
  "promising-to-verify": "Promising to verify",
  "worth-exploring": "Worth exploring",
  "low-priority": "Low priority",
  "not-enough-evidence": "Not enough evidence",
};

export const studyFitCopy: Record<Screen02StudyFitCategory, string> = {
  strong: "strong",
  mixed: "mixed",
  weak: "weak",
  unclear: "unclear",
};

export const outcomePathwayCopy: Record<
  Screen02OutcomePathwayCategory,
  string
> = {
  plausible: "plausible",
  limited: "limited",
  unsupported: "unsupported",
  unclear: "unclear",
};

export const coverageRelationCopy: Record<
  Screen02CoverageRelationCategory,
  string
> = {
  strong: "strong",
  mixed: "mixed",
  weak: "weak",
  unclear: "unclear",
};

export const measurementPotentialCopy: Record<
  Screen02MeasurementPotentialCategory,
  string
> = {
  possible: "possible",
  difficult: "difficult",
  implausible: "implausible",
  unclear: "unclear",
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

export function readableAuditChannel(channel: string) {
  const known: Record<string, string> = {
    "researcher-provided-url": "Researcher-provided official URL",
    "official-primary": "Official primary sources",
    "reviewed-registry": "Reviewed event registry",
    "chatgpt-host-discovery": "Supplemental source discovery",
  };
  return screen02ProviderNeutralCopy(
    known[channel] ?? channel.replaceAll("-", " "),
  );
}

export function formatAuditDate(date: string) {
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
  return month ? `${Number(match[3])} ${month} ${match[1]}` : date;
}
