import type {
  Screen02PreferenceKind,
  Screen02Session,
} from "../../core/screen02-types";

type Branch = Screen02Session["mode"];

export const screen02UnavailableAssessmentAcknowledgment =
  "The researcher chose the visible extra-checks continuation; every mandatory Screen 3 check remains required before a design decision.";
export const screen02UnavailableAssessmentReason =
  "ChatGPT assessment delivery was unavailable in this host; the researcher chose to continue with the attached source facts and mandatory Screen 3 checks.";
export const screen02TemporaryWorkflowRetention =
  "Replaced runs are deleted after reset. Inactive runs expire within 24 hours, no run lasts more than 7 days, and a continued run expires within 1 hour.";

export const workflowSteps: Record<Branch, string[]> = {
  find: [
    "Describe study",
    "Choose a shock",
    "Verify event and timing",
    "Map research data",
    "Construct exposure",
    "Diagnose contamination",
    "Align theory and estimand",
    "Export design package",
  ],
  audit: [
    "Describe study",
    "Confirm known shock",
    "Verify event and timing",
    "Map research data",
    "Construct exposure",
    "Diagnose contamination",
    "Align theory and estimand",
    "Export design package",
  ],
};

export const branchCopy: Record<
  Branch,
  {
    eyebrow: string;
    title: string;
    subtitle: string;
    collectionTitle: string;
    collectionDescription: string;
    itemKind: string;
    emptyMessage: string;
    reviewPrompt: string;
  }
> = {
  find: {
    eyebrow: "Shock discovery",
    title: "Find and compare candidate shocks",
    subtitle:
      "Search within the confirmed study boundary, compare candidate-specific preliminary assessments, and choose the shock that deserves formal verification.",
    collectionTitle: "Suggested shocks",
    collectionDescription:
      "Review each result’s factual details, preliminary judgment, study fit, outcome pathway, main concern, and supporting evidence before choosing a shock.",
    itemKind: "Candidate shock",
    emptyMessage: "No search has been run yet.",
    reviewPrompt:
      "Select a shock to review its facts, preliminary assessment, and supporting evidence.",
  },
  audit: {
    eyebrow: "Known-shock audit",
    title: "Confirm and assess your known shock",
    subtitle:
      "Check that ShockAudit found the event you meant, review its factual background and early study assessment, and carry the confirmed shock into formal verification.",
    collectionTitle: "Known-shock assessment",
    collectionDescription:
      "This dossier combines the possible identity match, factual sources, and a concise preliminary assessment.",
    itemKind: "Known shock",
    emptyMessage:
      "No event match is available for the named shock yet.",
    reviewPrompt:
      "Search the named shock to review its factual background, preliminary assessment, and evidence.",
  },
};

export const preferenceKindCopy: Record<
  Screen02PreferenceKind,
  { label: string; help: string; placeholder: string }
> = {
  require: {
    label: "Only include shocks that…",
    help:
      "Use this only for an extra required condition. The preliminary assessment applies it before a candidate can be chosen.",
    placeholder: "e.g., were initiated by a national government",
  },
  prefer: {
    label: "Rank higher shocks that…",
    help:
      "Use this as a ranking preference; other eligible shocks may remain.",
    placeholder: "e.g., primarily affect the energy sector",
  },
  avoid: {
    label: "Do not show shocks that…",
    help:
      "Use this only for an extra required exclusion. The preliminary assessment applies it before a candidate can be chosen.",
    placeholder: "e.g., require proprietary establishment-level data",
  },
};
