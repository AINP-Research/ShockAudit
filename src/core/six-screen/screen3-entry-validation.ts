import type { ResultsInspectionStatus } from "./contracts";
import {
  SIX_SCREEN_TREATMENT_YEAR_MAX,
  SIX_SCREEN_TREATMENT_YEAR_MIN,
  type ProposedTreatmentTimingInput,
} from "./study-design-advice";

export type Screen3StudyDraft = {
  population: string | null;
  analysisUnit: string | null;
  geography: string[];
  industry: string[];
  period: { start: string | null; end: string | null };
  outcome: string | null;
  outcomeMeasure?: string | null;
  intendedConstruct: string | null;
  policySideConcept?: string | null;
  initialExplanation: string | null;
  proposedTreatment: string | null;
  proposedComparison: string | null;
  resultsPreviouslyInspected: ResultsInspectionStatus;
};

export type Screen3TimingDraft = {
  mode: "" | ProposedTreatmentTimingInput["mode"];
  year: string | number | null;
};

export type Screen3EntryFieldId =
  | "population"
  | "analysisUnit"
  | "geography"
  | "outcome"
  | "periodStart"
  | "periodEnd"
  | "initialExplanation"
  | "proposedTiming"
  | "treatmentYear";

export type Screen3EntryIssueCode =
  | "population"
  | "analysis_unit"
  | "geography"
  | "outcome"
  | "study_period"
  | "study_period_order"
  | "study_question"
  | "proposed_timing"
  | "treatment_year";

export type Screen3EntryIssue = {
  code: Screen3EntryIssueCode;
  fieldIds: Screen3EntryFieldId[];
  message: string;
  classification: "screen_3_prerequisite";
};

function nullableText(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

function normalizedList(values: readonly string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

/** Normalize the canonical Screen 2 study draft without inventing values. */
export function normalizeScreen3StudyDraft(
  study: Screen3StudyDraft,
): Screen3StudyDraft {
  return {
    population: nullableText(study.population),
    analysisUnit: nullableText(study.analysisUnit),
    geography: normalizedList(study.geography),
    industry: normalizedList(study.industry),
    period: {
      start: nullableText(study.period.start),
      end: nullableText(study.period.end),
    },
    outcome: nullableText(study.outcome),
    outcomeMeasure: nullableText(study.outcomeMeasure),
    intendedConstruct: nullableText(study.intendedConstruct),
    policySideConcept: nullableText(study.policySideConcept),
    initialExplanation: nullableText(study.initialExplanation),
    proposedTreatment: nullableText(study.proposedTreatment),
    proposedComparison: nullableText(study.proposedComparison),
    resultsPreviouslyInspected: study.resultsPreviouslyInspected,
  };
}

function normalizeTiming(
  timing: Screen3TimingDraft | ProposedTreatmentTimingInput | null | undefined,
): { value: ProposedTreatmentTimingInput | null; issue: Screen3EntryIssue | null } {
  const mode = timing?.mode ?? "";
  if (mode === "varies_by_group") {
    return {
      value: { mode, year: null, milestoneReference: null },
      issue: null,
    };
  }
  if (mode !== "year") {
    return {
      value: null,
      issue: {
        code: "proposed_timing",
        fieldIds: ["proposedTiming"],
        message:
          "Enter a proposed treatment year or choose timing that varies by group.",
        classification: "screen_3_prerequisite",
      },
    };
  }
  const rawYear = String(timing?.year ?? "").trim();
  const year = Number(rawYear);
  if (
    !/^\d{4}$/u.test(rawYear) || !Number.isInteger(year) ||
    year < SIX_SCREEN_TREATMENT_YEAR_MIN ||
    year > SIX_SCREEN_TREATMENT_YEAR_MAX
  ) {
    return {
      value: null,
      issue: {
        code: "treatment_year",
        fieldIds: ["treatmentYear"],
        message:
          `Treatment year must be a four-digit year from ${SIX_SCREEN_TREATMENT_YEAR_MIN} through ${SIX_SCREEN_TREATMENT_YEAR_MAX}.`,
        classification: "screen_3_prerequisite",
      },
    };
  }
  return {
    value: {
      mode: "year",
      year,
      milestoneReference: timing && "milestoneReference" in timing
        ? timing.milestoneReference ?? null
        : null,
    },
    issue: null,
  };
}

/**
 * The single candidate-state gate for the Screen 2 to Screen 3 transition.
 * It validates the values visible in the editor, not an earlier projection.
 */
export function validateScreen3EntryDraft(input: {
  study: Screen3StudyDraft;
  timing: Screen3TimingDraft | ProposedTreatmentTimingInput | null | undefined;
}) {
  const study = normalizeScreen3StudyDraft(input.study);
  const issues: Screen3EntryIssue[] = [];
  const add = (
    code: Screen3EntryIssueCode,
    fieldIds: Screen3EntryFieldId[],
    message: string,
  ) => issues.push({
    code,
    fieldIds,
    message,
    classification: "screen_3_prerequisite",
  });

  if (!study.population) {
    add("population", ["population"], "Specify the organizational population.");
  }
  if (!study.analysisUnit) {
    add("analysis_unit", ["analysisUnit"], "Specify the unit of analysis.");
  }
  if (!study.geography.length) {
    add("geography", ["geography"], "Specify the study geography.");
  }
  if (!study.outcome) {
    add("outcome", ["outcome"], "Specify the outcome.");
  }
  if (!study.period.start || !study.period.end) {
    add(
      "study_period",
      [
        ...(!study.period.start ? ["periodStart" as const] : []),
        ...(!study.period.end ? ["periodEnd" as const] : []),
      ],
      "Specify both study-period boundaries.",
    );
  } else if (study.period.start > study.period.end) {
    add(
      "study_period_order",
      ["periodStart", "periodEnd"],
      "Study period start cannot follow its end.",
    );
  }
  if (!study.initialExplanation) {
    add(
      "study_question",
      ["initialExplanation"],
      "State the intended policy-effect question or explanation.",
    );
  }
  const timing = normalizeTiming(input.timing);
  if (timing.issue) issues.push(timing.issue);

  return {
    ready: issues.length === 0,
    study,
    proposedTiming: timing.value,
    issues,
  };
}
