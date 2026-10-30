import type { FieldKey, Mode } from "../../core/scope-types";

/**
 * BEGINNER EDITING FILE
 *
 * Change the quoted text in this file to revise Screen 1's labels, examples,
 * and explanations. Keep the punctuation around each quoted value.
 */

const laterSteps = [
  "Verify event and timing",
  "Audit exposure in your sample",
  "Diagnose contamination",
  "Align design and theory",
  "Export decision",
];

export const stepsByMode: Record<Mode, string[]> = {
  find: ["Describe study", "Choose feasible shock", ...laterSteps],
  audit: ["Describe study", "Represent known shock", ...laterSteps],
};

export const modeCopy: Record<
  Mode,
  {
    title: string;
    description: string;
    sectionTitle: string;
    sample: string;
  }
> = {
  find: {
    title: "Find a shock",
    description:
      "I have a research question and need a plausible external event.",
    sectionTitle: "Tell us what you are looking for",
    sample:
      "Find a regulatory shock affecting U.S. public manufacturing firms between 2014 and 2022 that may influence firm profitability.",
  },
  audit: {
    title: "Audit a known shock",
    description: "I already have an event and want to test whether it fits.",
    sectionTitle: "Describe the known shock and study",
    sample:
      "Audit whether the California Consumer Privacy Act affected annual profitability among U.S. public technology firms from 2017 to 2023.",
  },
};

export const fieldMeta: Array<{
  key: FieldKey;
  label: string;
  concept: string;
  decisionPrompt: string;
  example: string;
}> = [
  {
    key: "population",
    label: "Population",
    concept:
      "The units whose outcomes may enter the analysis, such as people, firms, plants, or transactions. A country is the geography, not the population.",
    decisionPrompt:
      "Name the eligible units and any ownership, listing, industry, or sample boundary.",
    example:
      "Examples: Chinese private firms, UK public firms, or Thai manufacturing plants.",
  },
  {
    key: "assignmentLevel",
    label: "Assignment level",
    concept:
      "The level at which the external event first assigns or varies exposure.",
    decisionPrompt:
      "Identify where treatment status changes when the candidate shock makes that clear. You may leave this for Screen 3 while finding a shock.",
    example: "Examples: individual, firm, state, or country.",
  },
  {
    key: "analysisLevel",
    label: "Analysis level",
    concept:
      "The type of unit whose outcome is analyzed and for which the treatment effect is estimated.",
    decisionPrompt:
      "Choose the entity analyzed in the main model. Record how often it is observed separately under Outcome frequency.",
    example: "Examples: employee, firm, county, or country.",
  },
  {
    key: "geography",
    label: "Geography",
    concept:
      "The location or jurisdiction that bounds eligible units and relevant events. It answers where the study applies, not what kind of unit is studied.",
    decisionPrompt:
      "Enter the relevant country, state, region, or group of places.",
    example:
      "Examples: China, United Kingdom, Thailand, or selected regions.",
  },
  {
    key: "industry",
    label: "Industry",
    concept:
      "The sector boundary used to include or exclude organizations from the study.",
    decisionPrompt:
      "State whether the study covers one sector, selected sectors, or all industries.",
    example: "Examples: manufacturing, banking, or all industries.",
  },
  {
    key: "studyPeriod",
    label: "Study period",
    concept:
      "The time window covering the focal shock, exposure, and outcomes.",
    decisionPrompt:
      "Choose a start and end year that leave enough time before and after the focal event.",
    example: "Example: 2014–2022.",
  },
  {
    key: "eventFamily",
    label: "Event family",
    concept:
      "The broad type of external event that could create treatment variation.",
    decisionPrompt:
      "Classify the theoretically relevant event category. Find mode uses it to search; Audit mode uses it to classify the named shock.",
    example:
      "Examples: regulation, court ruling, disaster, or infrastructure disruption.",
  },
  {
    key: "outcomeFamily",
    label: "Outcome family",
    concept:
      "The broad class of dependent variable the study seeks to explain.",
    decisionPrompt:
      "Specify the theoretical outcome while leaving the exact measure for later design screens.",
    example:
      "Examples: profitability, innovation, employment, or market performance.",
  },
  {
    key: "outcomeFrequency",
    label: "Outcome frequency",
    concept:
      "How often the outcome is observed or aggregated in the intended dataset.",
    decisionPrompt:
      "Choose the time interval when it is known. You may leave this for Screen 3 while finding and verifying a shock.",
    example: "Examples: annual, quarterly, monthly, daily, or event-based.",
  },
];

export const screenCopy = {
  eyebrow: "Natural experiment design workspace",
  title: "Describe your study",
  subtitle:
    "Describe your study in your own words. ShockAudit compares that description with nine editable scope fields and flags only meaningful differences.",
  chooseStartingPoint: "Choose your starting point",
  reviewContract: "Review the Scope Contract",
  contractHelp:
    "Population identifies who or what is studied. Geography identifies where those units and eligible shocks are located or governed. Accepted fields can keep your wording; assignment level and outcome frequency may be completed after a shock is selected.",
  sentenceHelp:
    "This is your primary research input. Edit any Scope Contract field that should represent it differently.",
  fixDescription: "Fix study description",
  confirmScope: "Confirm scope",
  confirmed: "Scope confirmed",
  decisionNotice:
    "Use guidance, or select the highlighted field to enter your own definition.",
};

export const nextStepCopy: Record<
  Mode,
  { confirmedDetail: string; screenTwoNotice: string }
> = {
  find: {
    confirmedDetail: "Shock feasibility is now unlocked for this study.",
    screenTwoNotice:
      "Screen 2 Find is open with this locked Scope Contract. No search has run yet.",
  },
  audit: {
    confirmedDetail:
      "Known-shock representation assessment is now unlocked for this study.",
    screenTwoNotice:
      "Screen 2 Audit is open with this exact known-shock anchor ready for identity review.",
  },
};
