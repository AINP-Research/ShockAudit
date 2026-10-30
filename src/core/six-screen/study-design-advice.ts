import { fingerprintSixScreenValue, sameSixScreenValue } from "./canonical";
import {
  requireBoundedIdentifier,
  requireCanonicalInstant,
  requireFingerprint,
  type PolicyReview,
  type StudyContext,
} from "./contracts";

export const SIX_SCREEN_STUDY_DESIGN_ADVICE_SCHEMA_VERSION =
  "screen-03-study-design-advice-v2" as const;
export const SIX_SCREEN_STUDY_DESIGN_ENTRY_SCHEMA_VERSION =
  "screen-03-study-first-entry-v2" as const;
export const SIX_SCREEN_PROPOSED_TIMING_SCHEMA_VERSION =
  "screen-02-proposed-treatment-timing-v2" as const;
export const SIX_SCREEN_STUDY_DESIGN_SELECTION_SCHEMA_VERSION =
  "screen-03-study-design-selection-v2" as const;
export const SIX_SCREEN_STUDY_DESIGN_LIBRARY_VERSION =
  "local-study-first-methods-v2.1" as const;
export const SIX_SCREEN_STUDY_DESIGN_SYNTHESIS_VERSION =
  "deterministic-structural-matcher-v2.1" as const;

export const SIX_SCREEN_STUDY_DESIGN_MAX_RECORDS = 32;
export const SIX_SCREEN_TREATMENT_YEAR_MIN = 1800;
export const SIX_SCREEN_TREATMENT_YEAR_MAX = 2200;

export type ProposedTreatmentTimingMode =
  | "year"
  | "undecided"
  | "varies_by_group";

export type ProposedTreatmentTimingInput = {
  mode: ProposedTreatmentTimingMode;
  year: number | null;
  milestoneReference: null | {
    claimId: string;
    label: string;
    sourceDateStart: string | null;
    sourceDatePrecision: "day" | "month" | "year" | "interval" | "unknown";
  };
};

export type ProposedTreatmentTiming = ProposedTreatmentTimingInput & {
  schemaVersion: typeof SIX_SCREEN_PROPOSED_TIMING_SCHEMA_VERSION;
  id: string;
  revision: number;
  identityFingerprint: string;
  origin: "researcher_reported" | "legacy_explicit_decision";
  /** A year remains year-precision; this record never invents January 1. */
  precision: "year" | "unknown" | "varies_by_group";
  createdAt: string;
  timingFingerprint: string;
};

export type StudyDesignClarifications = {
  adoptionPattern: "unknown" | "common" | "staggered";
  treatmentProcess:
    | "unknown"
    | "absorbing"
    | "reversible"
    | "continuous_dose";
  dataStructure: "unknown" | "panel" | "repeated_cross_sections";
  effectInterest: "undecided" | "overall" | "dynamic" | "subgroup";
  assignmentUnit: string | null;
  reportedPolicyAssignments: number | null;
  comparisonSupport:
    | "unknown"
    | "available"
    | "unavailable_after_adoption";
  moderator: string | null;
  moderatorTime: "unknown" | "baseline" | "post_treatment";
  rd: null | {
    runningVariable: string;
    cutoff: string;
    operator: "<" | "<=" | ">" | ">=";
    assignmentRule: string;
    treatmentTarget: "eligibility" | "receipt";
    assignmentRelation: "unknown" | "sharp" | "fuzzy";
    verification: "researcher_reported" | "policy_documented";
    otherConditions: string | null;
    bindingStatus: "unknown" | "binding" | "nonbinding";
    probabilityJump: "not_reported" | "researcher_reported";
  };
};

export const EMPTY_STUDY_DESIGN_CLARIFICATIONS: StudyDesignClarifications = {
  adoptionPattern: "unknown",
  treatmentProcess: "unknown",
  dataStructure: "unknown",
  effectInterest: "undecided",
  assignmentUnit: null,
  reportedPolicyAssignments: null,
  comparisonSupport: "unknown",
  moderator: null,
  moderatorTime: "unknown",
  rd: null,
};

export type StudyDesignEvidenceStatus =
  | "available"
  | "partial"
  | "conflicting"
  | "unavailable"
  | "not_researched";

export type Screen3StudyEntryContext = {
  schemaVersion: typeof SIX_SCREEN_STUDY_DESIGN_ENTRY_SCHEMA_VERSION;
  id: string;
  identityFingerprint: string;
  studyRevision: number;
  studyFingerprint: string;
  timingId: string;
  timingFingerprint: string;
  evidence: {
    status: StudyDesignEvidenceStatus;
    snapshotId: string | null;
    snapshotFingerprint: string | null;
    sourceLinkedClaimIds: string[];
    excludedLegacyRejectedClaimIds: string[];
    humanReviewStatus: "not_reviewed";
    limitation: string | null;
  };
  clarificationFingerprint: string;
  createdAt: string;
  entryFingerprint: string;
};

export type StudyDesignFeature = {
  featureId: string;
  value: string | number | string[] | null;
  origin:
    | "researcher_report"
    | "inspected_policy_evidence"
    | "derived_rule"
    | "unknown";
  inputRefs: string[];
  policyRefs: string[];
  uncertainty: string | null;
};

export type StudyDesignApplicability =
  | "conditional_consideration"
  | "needs_clarification"
  | "incompatible_with_reported_setup"
  | "outside_current_library";

export type StudyDesignModelRecipe = {
  recipeId: string;
  recipeVersion: "screen-03-model-recipe-v1";
  label: string;
  applicableDataStructure: "panel" | "repeated_cross_sections" | "local_threshold";
  requiredFeatures: string[];
  equationOrAlgorithm: string;
  accessibleDescription: string;
  symbols: Array<{
    symbol: string;
    meaning: string;
    suppliedInputRefs: string[];
  }>;
  assumptions: string[];
  targetEffect: string;
  unknowns: string[];
  incompatibilities: string[];
  estimatorNotes: string[];
  referenceIds: string[];
};

export type StudyDesignMethodOption = {
  optionId: string;
  entryId: "D01" | "D02" | "R01" | "R02";
  family: "difference_in_differences" | "regression_discontinuity";
  label: string;
  timingVariant: string;
  effectTarget: string;
  applicability: StudyDesignApplicability;
  whyThisAppears: string;
  proposedContrast: string;
  /** Versioned planning recipes. Rendering or reading these never selects a model. */
  modelRecipes: StudyDesignModelRecipe[];
  assumptions: string[];
  unknowns: string[];
  incompatibilities: string[];
  dataNeeds: string[];
  estimatorVariants: Array<{
    label: string;
    description: string;
    referenceIds: string[];
  }>;
  extensions: Array<{
    entryId: "D03" | "D04";
    label: string;
    status: "relevant" | "available_after_clarification";
    description: string;
    unknowns: string[];
    referenceIds: string[];
  }>;
  inferenceNotes: string[];
  prohibitedClaims: string[];
  referenceIds: string[];
};

export type StudyDesignWarning = {
  warningId: string;
  ruleId: string;
  affectedOptionIds: string[];
  triggerInputRefs: string[];
  triggerEvidenceRefs: string[];
  severity: "information" | "caution" | "substantive_incompatibility";
  /** Optional for historical v2 advice; new warnings record the evidentiary basis. */
  basis?: "reported_input_inconsistency" | "documentary_design_concern" |
    "empirical_requirement";
  message: string;
  whyItMatters: string;
  whatToCheck: string;
  methodReferenceIds: string[];
};

export type StudyDesignAdvice = {
  schemaVersion: typeof SIX_SCREEN_STUDY_DESIGN_ADVICE_SCHEMA_VERSION;
  adviceId: string;
  createdAt: string;
  binding: {
    identityFingerprint: string;
    studyRevision: number;
    studyFingerprint: string;
    timingFingerprint: string;
    evidenceSnapshotIdOrNull: string | null;
    evidenceFingerprintOrNull: string | null;
    clarificationFingerprint: string;
    methodLibraryVersion: typeof SIX_SCREEN_STUDY_DESIGN_LIBRARY_VERSION;
    synthesisConfigurationVersion:
      typeof SIX_SCREEN_STUDY_DESIGN_SYNTHESIS_VERSION;
  };
  execution: {
    mode: "library_only";
    taskId: null;
    model: null;
    disclosure: string;
  };
  proposalEcho: {
    population: string | null;
    analysisUnit: string | null;
    geography: string[];
    industry: string[];
    period: { start: string | null; end: string | null };
    outcome: string | null;
    outcomeMeasure: string | null;
    policySideConcept: string | null;
    initialExplanation: string | null;
    /** @deprecated Retained for persisted v2 advice compatibility. */
    question: string | null;
    proposedTreatment: string | null;
    proposedComparison: string | null;
    resultsPreviouslyInspected: StudyContext["resultsPreviouslyInspected"];
    timing: ProposedTreatmentTimingInput & {
      precision: ProposedTreatmentTiming["precision"];
      origin: ProposedTreatmentTiming["origin"];
    };
  };
  clarifications: StudyDesignClarifications;
  features: StudyDesignFeature[];
  options: StudyDesignMethodOption[];
  alternatives: Array<{
    entryId: "X01" | "X02" | "OUT_OF_SCOPE";
    label: string;
    applicability: "outside_current_library";
    explanation: string;
    referenceIds: string[];
  }>;
  warnings: StudyDesignWarning[];
  completeness: {
    availableModules: string[];
    missingModules: string[];
    notAssessed: string[];
  };
  adviceFingerprint: string;
};

export type StudyDesignSelection = {
  schemaVersion: typeof SIX_SCREEN_STUDY_DESIGN_SELECTION_SCHEMA_VERSION;
  id: string;
  adviceId: string;
  adviceFingerprint: string;
  identityFingerprint: string;
  studyRevision: number;
  decision:
    | { mode: "selected"; optionId: string }
    | { mode: "no_selection" };
  rationale: string;
  actor: "researcher";
  selectedAt: string;
  selectionFingerprint: string;
};

export type StudyDesignMethodLibraryEntry = {
  entryId: "D01" | "D02" | "D03" | "D04" | "R01" | "R02" | "X01" | "X02";
  libraryVersion: typeof SIX_SCREEN_STUDY_DESIGN_LIBRARY_VERSION;
  entryRevision: number;
  family: string;
  variant: string;
  label: string;
  supportedScope: string;
  referenceIds: string[];
  statementToReferenceMap: Array<{
    statementId: string;
    statement: string;
    referenceIds: string[];
  }>;
  verificationRecord: Array<{
    referenceId: string;
    sourceVersion: string;
    inspectedLocator: string;
    reviewScope: string;
    inspectedOn: string;
  }>;
  implementationStatus: {
    specified: boolean;
    implemented: boolean;
    structurallyTested: boolean;
    enabled: boolean;
  };
};

const SHARED_DID_VERIFICATION = [{
  referenceId: "M01",
  sourceVersion: "Roth et al. author preprint, arXiv:2201.01194",
  inspectedLocator: "Author-preprint abstract and bibliographic record",
  reviewScope: "High-level organizing scope only; detailed section-level implementation remains outside this bounded check",
  inspectedOn: "2026-09-19",
}, {
  referenceId: "M02",
  sourceVersion: "Callaway and Sant'Anna manuscript v4, arXiv:1803.09015",
  inspectedLocator: "Introduction; Sections 2.1–2.3; aggregation discussion in Section 3",
  reviewScope: "Absorbing adoption, group-time targets, never/not-yet-treated comparison support, and explicit aggregation; not a final-journal-text audit",
  inspectedOn: "2026-09-19",
}] satisfies StudyDesignMethodLibraryEntry["verificationRecord"];

export const STUDY_DESIGN_METHOD_LIBRARY: readonly StudyDesignMethodLibraryEntry[] = [
  {
    entryId: "D01",
    libraryVersion: SIX_SCREEN_STUDY_DESIGN_LIBRARY_VERSION,
    entryRevision: 1,
    family: "difference_in_differences",
    variant: "common_timing",
    label: "Difference-in-differences with common timing",
    supportedScope: "A researcher-stated treated/comparison contrast with proposed pre/post support; identification remains conditional.",
    referenceIds: ["M01", "M02", "M09", "M10"],
    statementToReferenceMap: [{
      statementId: "D01-S1",
      statement: "A stated group-by-time contrast makes DiD discussion relevant but does not establish parallel trends.",
      referenceIds: ["M01", "M02"],
    }, {
      statementId: "D01-S2",
      statement: "A nonsignificant pretrend result would not certify the identifying assumption.",
      referenceIds: ["M09"],
    }],
    verificationRecord: [...SHARED_DID_VERIFICATION, {
      referenceId: "M09",
      sourceVersion: "Roth 2022 AER: Insights publication record",
      inspectedLocator: "Abstract and stated pretest problem",
      reviewScope: "Prohibition on treating a pretrend pretest as a pass certificate",
      inspectedOn: "2026-09-19",
    }],
    implementationStatus: { specified: true, implemented: true, structurallyTested: true, enabled: true },
  },
  {
    entryId: "D02",
    libraryVersion: SIX_SCREEN_STUDY_DESIGN_LIBRARY_VERSION,
    entryRevision: 1,
    family: "difference_in_differences",
    variant: "staggered_absorbing_adoption",
    label: "Difference-in-differences with staggered adoption",
    supportedScope: "Reported differing first-treatment times with an absorbing treatment process or an explicit qualification that absorption is unknown.",
    referenceIds: ["M01", "M02", "M03", "M04"],
    statementToReferenceMap: [{
      statementId: "D02-S1",
      statement: "Group-time effects and their aggregation must remain explicit under staggered adoption.",
      referenceIds: ["M02"],
    }, {
      statementId: "D02-S2",
      statement: "Ordinary TWFE lead/lag coefficients can be contaminated under heterogeneous effects in the studied setting.",
      referenceIds: ["M03"],
    }],
    verificationRecord: [...SHARED_DID_VERIFICATION, {
      referenceId: "M03",
      sourceVersion: "Sun and Abraham author preprint, arXiv:1804.05785",
      inspectedLocator: "Author-preprint abstract and bibliographic record",
      reviewScope: "TWFE contamination warning and cohort-aware framing, not an implementation recipe",
      inspectedOn: "2026-09-19",
    }, {
      referenceId: "M04",
      sourceVersion: "Borusyak, Jaravel, and Spiess author preprint, arXiv:2108.12419",
      inspectedLocator: "Author-preprint abstract and bibliographic record",
      reviewScope: "Imputation approach is conditional on its model/support; no superiority claim",
      inspectedOn: "2026-09-19",
    }],
    implementationStatus: { specified: true, implemented: true, structurallyTested: true, enabled: true },
  },
  {
    entryId: "D03",
    libraryVersion: SIX_SCREEN_STUDY_DESIGN_LIBRARY_VERSION,
    entryRevision: 1,
    family: "difference_in_differences_extension",
    variant: "dynamic_event_time",
    label: "Dynamic/event-time extension",
    supportedScope: "A nested effect-of-interest extension to a relevant DiD contrast, not an independent identification strategy.",
    referenceIds: ["M01", "M03", "M09"],
    statementToReferenceMap: [{
      statementId: "D03-S1",
      statement: "Dynamic paths require event-time support and cohort composition to remain inspectable.",
      referenceIds: ["M01", "M03"],
    }],
    verificationRecord: SHARED_DID_VERIFICATION,
    implementationStatus: { specified: true, implemented: true, structurallyTested: true, enabled: true },
  },
  {
    entryId: "D04",
    libraryVersion: SIX_SCREEN_STUDY_DESIGN_LIBRARY_VERSION,
    entryRevision: 1,
    family: "difference_in_differences_extension",
    variant: "subgroup_heterogeneity",
    label: "Prespecified subgroup-effect extension",
    supportedScope: "A nested subgroup target distinct from estimator accommodation of cohort/time heterogeneity.",
    referenceIds: ["M01", "M02"],
    statementToReferenceMap: [{
      statementId: "D04-S1",
      statement: "Subgroup differences do not independently identify the policy effect or prove a mechanism.",
      referenceIds: ["M01", "M02"],
    }],
    verificationRecord: SHARED_DID_VERIFICATION,
    implementationStatus: { specified: true, implemented: true, structurallyTested: true, enabled: true },
  },
  {
    entryId: "R01",
    libraryVersion: SIX_SCREEN_STUDY_DESIGN_LIBRARY_VERSION,
    entryRevision: 1,
    family: "regression_discontinuity",
    variant: "sharp",
    label: "Sharp regression discontinuity",
    supportedScope: "A stated running variable, cutoff, complete assignment rule, and sharp assignment relation for the proposed treatment target.",
    referenceIds: ["M05", "M06"],
    statementToReferenceMap: [{
      statementId: "R01-S1",
      statement: "The target is local at the cutoff and requires an assignment role, not merely a numeric policy term.",
      referenceIds: ["M05"],
    }],
    verificationRecord: [{
      referenceId: "M05",
      sourceVersion: "Cattaneo, Idrobo, and Titiunik Foundations, 2019 online edition",
      inspectedLocator: "Cambridge publisher Summary and publication record",
      reviewScope: "Score/cutoff/sharp-assignment and local-target guardrails; not a full book audit",
      inspectedOn: "2026-09-19",
    }],
    implementationStatus: { specified: true, implemented: true, structurallyTested: true, enabled: true },
  },
  {
    entryId: "R02",
    libraryVersion: SIX_SCREEN_STUDY_DESIGN_LIBRARY_VERSION,
    entryRevision: 1,
    family: "regression_discontinuity",
    variant: "fuzzy",
    label: "Fuzzy regression discontinuity",
    supportedScope: "A stated cutoff that changes receipt probability for a receipt target; imperfect compliance alone is insufficient.",
    referenceIds: ["M06"],
    statementToReferenceMap: [{
      statementId: "R02-S1",
      statement: "A receipt target has a local complier interpretation only under additional first-stage and IV-style assumptions.",
      referenceIds: ["M06"],
    }],
    verificationRecord: [{
      referenceId: "M06",
      sourceVersion: "Cattaneo, Idrobo, and Titiunik Extensions, 2024",
      inspectedLocator: "Cambridge publisher Summary and publication record",
      reviewScope: "High-level sharp/fuzzy distinction and imperfect-compliance scope; detailed first-stage and IV assumptions remain explicit prerequisites, not verified results",
      inspectedOn: "2026-09-19",
    }],
    implementationStatus: { specified: true, implemented: true, structurallyTested: true, enabled: true },
  },
  {
    entryId: "X01",
    libraryVersion: SIX_SCREEN_STUDY_DESIGN_LIBRARY_VERSION,
    entryRevision: 1,
    family: "triple_differences",
    variant: "third_difference",
    label: "Triple differences",
    supportedScope: "Specified for a substantively justified third comparison dimension; active matching is deferred.",
    referenceIds: ["M07"],
    statementToReferenceMap: [],
    verificationRecord: [],
    implementationStatus: { specified: true, implemented: false, structurallyTested: false, enabled: false },
  },
  {
    entryId: "X02",
    libraryVersion: SIX_SCREEN_STUDY_DESIGN_LIBRARY_VERSION,
    entryRevision: 1,
    family: "synthetic_control",
    variant: "donor_weighted_counterfactual",
    label: "Synthetic control",
    supportedScope: "Specified for a suitable aggregate treated unit, donor pool, and pre-intervention history; active matching is deferred.",
    referenceIds: ["M08"],
    statementToReferenceMap: [],
    verificationRecord: [],
    implementationStatus: { specified: true, implemented: false, structurallyTested: false, enabled: false },
  },
] as const;

function compactText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

function studyFingerprintFields(study: StudyContext) {
  return {
    id: study.id,
    population: study.population,
    analysisUnit: study.analysisUnit,
    geography: study.geography,
    industry: study.industry,
    period: study.period,
    outcome: study.outcome,
    outcomeMeasure: study.outcomeMeasure ?? null,
    policySideConcept: study.policySideConcept ?? null,
    initialExplanation: study.initialExplanation,
    proposedTreatment: study.proposedTreatment,
    proposedComparison: study.proposedComparison,
    resultsPreviouslyInspected: study.resultsPreviouslyInspected,
  };
}

function studyFingerprint(study: StudyContext) {
  // Navigation/progress revisions and historical wording are not scientific
  // inputs to this advice. Actual active study fields remain bound exactly.
  return fingerprintSixScreenValue(studyFingerprintFields(study));
}

function v23StudyFingerprint(study: StudyContext) {
  // Existing v23 advice/entry records used these two additional fields.
  // Accept that exact legacy binding only at its original study revision.
  return fingerprintSixScreenValue({
    id: study.id, revision: study.revision,
    population: study.population, analysisUnit: study.analysisUnit,
    geography: study.geography, industry: study.industry,
    period: study.period, outcome: study.outcome,
    outcomeMeasure: study.outcomeMeasure ?? null,
    intendedConstruct: study.intendedConstruct,
    policySideConcept: study.policySideConcept ?? null,
    initialExplanation: study.initialExplanation,
    proposedTreatment: study.proposedTreatment,
    proposedComparison: study.proposedComparison,
    resultsPreviouslyInspected: study.resultsPreviouslyInspected,
  });
}

export function normalizeStudyDesignClarifications(
  value?: Partial<StudyDesignClarifications> | null,
): StudyDesignClarifications {
  const rd = value?.rd
    ? {
        runningVariable: value.rd.runningVariable.trim(),
        cutoff: value.rd.cutoff.trim(),
        operator: value.rd.operator,
        assignmentRule: value.rd.assignmentRule.trim(),
        treatmentTarget: value.rd.treatmentTarget,
        assignmentRelation: value.rd.assignmentRelation,
        verification: value.rd.verification,
        otherConditions: compactText(value.rd.otherConditions),
        bindingStatus: value.rd.bindingStatus,
        probabilityJump: value.rd.probabilityJump,
      }
    : null;
  return {
    ...EMPTY_STUDY_DESIGN_CLARIFICATIONS,
    ...structuredClone(value ?? {}),
    assignmentUnit: compactText(value?.assignmentUnit),
    moderator: compactText(value?.moderator),
    rd,
  };
}

export function validateProposedTreatmentTimingInput(
  input: ProposedTreatmentTimingInput,
) {
  if (input.mode === "year") {
    if (
      !Number.isInteger(input.year) ||
      input.year! < SIX_SCREEN_TREATMENT_YEAR_MIN ||
      input.year! > SIX_SCREEN_TREATMENT_YEAR_MAX
    ) {
      throw new Error(
        `Treatment year must be a four-digit year from ${SIX_SCREEN_TREATMENT_YEAR_MIN} through ${SIX_SCREEN_TREATMENT_YEAR_MAX}.`,
      );
    }
  } else if (input.year !== null) {
    throw new Error("Only year timing may retain a proposed treatment year.");
  }
  if (input.milestoneReference) {
    requireBoundedIdentifier(
      input.milestoneReference.claimId,
      "Treatment timing milestone claim id",
    );
    if (!input.milestoneReference.label.trim()) {
      throw new Error("Treatment timing milestone label is required.");
    }
  }
  return input;
}

function timingSemanticInput(input: ProposedTreatmentTimingInput) {
  return {
    mode: input.mode,
    year: input.year,
    milestoneReference: input.milestoneReference
      ? structuredClone(input.milestoneReference)
      : null,
  };
}

export function createProposedTreatmentTiming(input: {
  value: ProposedTreatmentTimingInput;
  identityFingerprint: string;
  revision: number;
  origin?: ProposedTreatmentTiming["origin"];
  createdAt: string;
}): ProposedTreatmentTiming {
  validateProposedTreatmentTimingInput(input.value);
  requireFingerprint(input.identityFingerprint, "Treatment timing identity fingerprint");
  requireCanonicalInstant(input.createdAt, "Treatment timing createdAt");
  const semantic = {
    identityFingerprint: input.identityFingerprint,
    revision: input.revision,
    origin: input.origin ?? "researcher_reported",
    ...timingSemanticInput(input.value),
  };
  const timingFingerprint = fingerprintSixScreenValue(semantic);
  return {
    schemaVersion: SIX_SCREEN_PROPOSED_TIMING_SCHEMA_VERSION,
    id: `screen2-timing-${timingFingerprint.slice("fnv1a64:".length)}`,
    revision: input.revision,
    identityFingerprint: input.identityFingerprint,
    origin: input.origin ?? "researcher_reported",
    precision: input.value.mode === "year"
      ? "year"
      : input.value.mode === "varies_by_group"
        ? "varies_by_group"
        : "unknown",
    ...timingSemanticInput(input.value),
    createdAt: input.createdAt,
    timingFingerprint,
  };
}

export function sameProposedTreatmentTiming(
  timing: ProposedTreatmentTiming,
  input: ProposedTreatmentTimingInput,
) {
  return sameSixScreenValue(timingSemanticInput(timing), timingSemanticInput(input));
}

function evidenceStatus(review: PolicyReview | null): StudyDesignEvidenceStatus {
  if (!review) return "not_researched";
  if (review.status === "unsupported" || review.status === "waiting_source") {
    return "unavailable";
  }
  if (review.requirements.some(({ status }) => status === "conflicting")) {
    return "conflicting";
  }
  return review.status === "ready" ? "available" : "partial";
}

export function createScreen3StudyEntryContext(input: {
  identityFingerprint: string;
  study: StudyContext;
  timing: ProposedTreatmentTiming;
  policyReview: PolicyReview | null;
  excludedLegacyRejectedClaimIds?: string[];
  clarifications: StudyDesignClarifications;
  createdAt: string;
}): Screen3StudyEntryContext {
  requireFingerprint(input.identityFingerprint, "Screen 3 entry identity fingerprint");
  requireCanonicalInstant(input.createdAt, "Screen 3 entry createdAt");
  if (
    input.policyReview &&
    input.policyReview.identityFingerprint !== input.identityFingerprint
  ) {
    throw new Error(
      "The saved policy evidence belongs to a different confirmed identity; Screen 3 did not treat it as absent evidence.",
    );
  }
  const excluded = new Set(input.excludedLegacyRejectedClaimIds ?? []);
  const sourceLinkedClaimIds = (input.policyReview?.claims ?? [])
    .map(({ claimId }) => claimId)
    .filter((claimId) => !excluded.has(claimId));
  const status = evidenceStatus(input.policyReview);
  const clarificationFingerprint = fingerprintSixScreenValue(
    input.clarifications,
  );
  const core = {
    identityFingerprint: input.identityFingerprint,
    studyRevision: input.study.revision,
    studyFingerprint: studyFingerprint(input.study),
    timingId: input.timing.id,
    timingFingerprint: input.timing.timingFingerprint,
    evidence: {
      status,
      snapshotId: input.policyReview?.evidenceSnapshotId ?? null,
      snapshotFingerprint:
        input.policyReview?.evidenceSnapshotFingerprint ?? null,
      sourceLinkedClaimIds,
      excludedLegacyRejectedClaimIds: [...excluded].sort(),
      humanReviewStatus: "not_reviewed" as const,
      limitation: input.policyReview?.limitation ?? (
        status === "not_researched"
          ? "Policy enrichment is not yet available. Method guidance uses only the confirmed identity and researcher-supplied study fields."
          : status === "unavailable"
            ? "Policy enrichment is unavailable. No coverage, threshold, or legal-timing fact was inferred."
            : status === "partial" || status === "conflicting"
              ? "Policy evidence is incomplete or conflicting; related study guidance remains explicitly qualified."
              : null
      ),
    },
    clarificationFingerprint,
  };
  const entryFingerprint = fingerprintSixScreenValue(core);
  return {
    schemaVersion: SIX_SCREEN_STUDY_DESIGN_ENTRY_SCHEMA_VERSION,
    id: `screen3-entry-${entryFingerprint.slice("fnv1a64:".length)}`,
    ...core,
    createdAt: input.createdAt,
    entryFingerprint,
  };
}

function yearFromBoundary(value: string | null) {
  const match = /^(\d{4})(?:\D|$)/u.exec(value ?? "");
  return match ? Number(match[1]) : null;
}

function optionId(entryId: string, context: Screen3StudyEntryContext) {
  return `method-${entryId.toLowerCase()}-${context.entryFingerprint.slice("fnv1a64:".length)}`;
}

function proposedContrast(study: StudyContext) {
  const treated = compactText(study.proposedTreatment) ?? "an as-yet undefined affected group";
  const comparison = compactText(study.proposedComparison) ?? "an as-yet undefined comparison group";
  const outcome = compactText(study.outcome) ?? "the proposed outcome";
  return `Compare changes in ${outcome} for ${treated} with changes for ${comparison}.`;
}

function didExtensions(clarifications: StudyDesignClarifications) {
  const extensions: StudyDesignMethodOption["extensions"] = [];
  if (clarifications.effectInterest === "dynamic") {
    extensions.push({
      entryId: "D03",
      label: "Dynamic/event-time path",
      status: "relevant",
      description: "Treat this as an effect-of-interest extension within the DiD design. Event-time support and cohort composition remain unresolved until actual data structure is supplied.",
      unknowns: ["Available pre/post horizons", "Calendar or fiscal-year convention", "Comparison support at each event time"],
      referenceIds: ["M01", "M03", "M09"],
    });
  } else {
    extensions.push({
      entryId: "D03",
      label: "Dynamic/event-time path",
      status: "available_after_clarification",
      description: "Available if the research target is the path of effects rather than only an overall average.",
      unknowns: ["Whether a dynamic effect is an intended target"],
      referenceIds: ["M01", "M03", "M09"],
    });
  }
  if (clarifications.effectInterest === "subgroup") {
    extensions.push({
      entryId: "D04",
      label: "Prespecified subgroup effects",
      status: "relevant",
      description: "This studies differences across a prespecified characteristic after establishing the main contrast; it is distinct from accommodating cohort/time heterogeneity and does not prove a mechanism.",
      unknowns: clarifications.moderator
        ? ["Subgroup support and a defensible measurement time"]
        : ["Prespecified subgroup variable", "Its measurement time"],
      referenceIds: ["M01", "M02"],
    });
  }
  return extensions;
}

function createDidOption(input: {
  entryId: "D01" | "D02";
  study: StudyContext;
  timing: ProposedTreatmentTiming;
  context: Screen3StudyEntryContext;
  clarifications: StudyDesignClarifications;
}) {
  const { study, timing, context, clarifications } = input;
  const groupsComplete = Boolean(
    compactText(study.proposedTreatment) && compactText(study.proposedComparison),
  );
  const startYear = yearFromBoundary(study.period.start);
  const endYear = yearFromBoundary(study.period.end);
  const lacksPre = timing.mode === "year" && startYear !== null &&
    timing.year! <= startYear;
  const lacksPost = timing.mode === "year" && endYear !== null &&
    timing.year! >= endYear;
  const incompatibleProcess = clarifications.treatmentProcess === "reversible" ||
    clarifications.treatmentProcess === "continuous_dose";
  const isStaggered = input.entryId === "D02";
  const unknowns = [
    ...(!groupsComplete ? ["Define both the proposed affected and comparison groups."] : []),
    ...(timing.mode === "undecided" ? ["Proposed treatment timing is undecided."] : []),
    ...(clarifications.adoptionPattern === "unknown"
      ? ["Whether units begin treatment together or at different times"]
      : []),
    ...(clarifications.treatmentProcess === "unknown"
      ? ["Whether treatment remains on after first adoption"]
      : []),
    ...(clarifications.dataStructure === "unknown"
      ? ["Panel versus repeated-cross-section structure"]
      : []),
  ];
  const incompatibilities = [
    ...(lacksPre ? ["The stated study window contains no proposed pretreatment period."] : []),
    ...(lacksPost ? ["The stated study window contains no proposed post-treatment period."] : []),
    ...(incompatibleProcess
      ? [`The reported ${clarifications.treatmentProcess.replaceAll("_", " ")} treatment process is outside this implemented binary absorbing-treatment entry.`]
      : []),
    ...(isStaggered && clarifications.comparisonSupport === "unavailable_after_adoption"
      ? ["No clean comparison support is reported for later treated cohorts or periods."]
      : []),
  ];
  const applicability: StudyDesignApplicability = incompatibilities.length
    ? "incompatible_with_reported_setup"
    : unknowns.length
      ? "needs_clarification"
      : "conditional_consideration";
  const yearText = timing.mode === "year"
    ? `around the researcher-selected year ${timing.year}`
    : timing.mode === "varies_by_group"
      ? "around each group's as-yet unspecified first-treatment time"
      : "once a proposed timing contrast is defined";
  const outcomeMeaning = compactText(study.outcomeMeasure)
    ? `the researcher-supplied measure “${study.outcomeMeasure!.trim()}” for ${study.outcome ?? "the outcome"}`
    : study.outcome
      ? `the outcome “${study.outcome}”; its measurement is not yet supplied`
      : "the selected outcome; its concept and measurement are not yet supplied";
  const panelRecipe: StudyDesignModelRecipe = {
    recipeId: isStaggered ? "did-staggered-group-time-v1" : "did-common-panel-v1",
    recipeVersion: "screen-03-model-recipe-v1",
    label: isStaggered
      ? "Group-time effect definition"
      : "Panel illustration with unit and time effects",
    applicableDataStructure: "panel",
    requiredFeatures: isStaggered
      ? ["Unit identifier", "Calendar time", "First-treatment cohort", "Repeated outcome"]
      : ["Unit identifier", "Calendar time", "Proposed affected-group indicator", "Repeated outcome"],
    equationOrAlgorithm: isStaggered
      ? "ATT(g,t) = E[Y_it(g) − Y_it(∞) | G_i = g]"
      : "Y_it = α_i + λ_t + β(A_i × Post_t) + ε_it",
    accessibleDescription: isStaggered
      ? "Define the average effect at calendar time t for units first treated in cohort g, relative to their untreated potential outcome. This is an estimand definition, not an estimated result."
      : "Illustrate the proposed difference in changes with unit effects, time effects, and an affected-group by post-period interaction. The coefficient is not an empirical result and its causal interpretation depends on the listed assumptions.",
    symbols: isStaggered
      ? [{ symbol: "Y_it(g)", meaning: `${outcomeMeaning}, under adoption at g`, suppliedInputRefs: ["study.outcome", "study.outcomeMeasure"] },
        { symbol: "Y_it(∞)", meaning: `${outcomeMeaning}, under no adoption during the relevant horizon`, suppliedInputRefs: ["study.outcome", "study.outcomeMeasure"] },
        { symbol: "G_i", meaning: "the unit's actual first-treatment cohort; no cohort date is inferred from policy-stage dates", suppliedInputRefs: ["clarifications.adoptionPattern", "proposedTiming.mode"] },
        { symbol: "g, t", meaning: "first-treatment cohort and calendar time", suppliedInputRefs: ["study.period"] }]
      : [{ symbol: "Y_it", meaning: outcomeMeaning, suppliedInputRefs: ["study.outcome", "study.outcomeMeasure"] },
        { symbol: "A_i", meaning: `membership in the proposed affected group${study.proposedTreatment ? ` “${study.proposedTreatment}”` : " (not yet supplied)"}`, suppliedInputRefs: ["study.proposedTreatment"] },
        { symbol: "Post_t", meaning: timing.mode === "year"
          ? `an indicator for observations assigned to the proposed ${timing.year} post period; annual/fiscal coding, partial-year exposure, and anticipation remain decisions`
          : "an indicator for the proposed post period; its boundary is not yet supplied",
          suppliedInputRefs: ["proposedTiming.mode", "proposedTiming.year"] },
        { symbol: "α_i, λ_t", meaning: "unit and calendar-time effects in this panel illustration", suppliedInputRefs: ["clarifications.dataStructure"] },
        { symbol: "β", meaning: "the model's affected-group by post-period coefficient; its ATT interpretation is conditional on the stated design assumptions", suppliedInputRefs: [] }],
    assumptions: [
      "The proposed comparison group represents the affected group's counterfactual outcome trend for the target outcome under the intended conditioning set.",
      "Anticipation does not invalidate the chosen preperiod, and interference or spillovers do not destroy the proposed contrast.",
      "Outcome measurement and relevant sample composition remain comparable over the study window.",
    ],
    targetEffect: isStaggered
      ? "Cohort- and time-specific effects with a researcher-defined aggregation across supported cells."
      : "The affected group's average treatment effect relative to the proposed comparison in the defined periods, under the design assumptions; multi-period weighting must be stated.",
    unknowns: [...unknowns],
    incompatibilities: [...incompatibilities],
    estimatorNotes: isStaggered
      ? ["Use suitable never-treated or not-yet-treated comparison observations only where support exists.", "Choose and report the cohort, calendar-time, or event-time aggregation rather than treating it as automatic."]
      : ["A firm-year or other unit-time label does not establish that the same units are observed throughout.", "Do not add downstream variables as default controls.", "Assignment and sampling structure—not row count—must determine the inference plan."],
    referenceIds: isStaggered ? ["M02", "M03", "M04"] : ["M01", "M02", "M09", "M10"],
  };
  const repeatedCrossSectionRecipe: StudyDesignModelRecipe = {
    recipeId: "did-common-repeated-cross-sections-v1",
    recipeVersion: "screen-03-model-recipe-v1",
    label: "Repeated-cross-section illustration",
    applicableDataStructure: "repeated_cross_sections",
    requiredFeatures: ["Calendar period", "Proposed affected-group indicator", "Comparable outcome measure", "Repeated samples from the target populations"],
    equationOrAlgorithm: "E[Y | A, Post] = α + γA + λPost + β(A × Post)",
    accessibleDescription: "Compare group-by-period outcome means or the equivalent group/post interaction without pretending that independent samples have persistent unit effects.",
    symbols: [
      { symbol: "Y", meaning: outcomeMeaning, suppliedInputRefs: ["study.outcome", "study.outcomeMeasure"] },
      { symbol: "A", meaning: `membership in the proposed affected group${study.proposedTreatment ? ` “${study.proposedTreatment}”` : " (not yet supplied)"}`, suppliedInputRefs: ["study.proposedTreatment"] },
      { symbol: "Post", meaning: timing.mode === "year" ? `membership in the proposed ${timing.year} post period, with exact period coding still unresolved` : "membership in the proposed post period, whose boundary remains unresolved", suppliedInputRefs: ["proposedTiming.mode", "proposedTiming.year"] },
      { symbol: "β", meaning: "the difference in group changes in this mean model; a causal ATT interpretation remains conditional", suppliedInputRefs: [] },
    ],
    assumptions: ["A defensible counterfactual trend for the proposed affected population", "Comparable outcome measurement and sample composition across group-period cells", "No anticipation or interference that defeats the proposed contrast"],
    targetEffect: "A population-level difference in changes for the affected group relative to the proposed comparison, under the repeated-sample assumptions.",
    unknowns: [...unknowns],
    incompatibilities: [...incompatibilities],
    estimatorNotes: ["Do not require unobservable person or firm fixed effects across independent samples.", "Document weighting, repeated-sample composition, and the intended target population.", "Inference must follow the assignment and sampling design."],
    referenceIds: ["M01", "M02", "M10"],
  };
  const modelRecipes = isStaggered
    ? [panelRecipe]
    : clarifications.dataStructure === "panel"
      ? [panelRecipe]
      : clarifications.dataStructure === "repeated_cross_sections"
        ? [repeatedCrossSectionRecipe]
        : [panelRecipe, repeatedCrossSectionRecipe];
  return {
    optionId: optionId(input.entryId, context),
    entryId: input.entryId,
    family: "difference_in_differences" as const,
    label: isStaggered
      ? "DiD with staggered adoption"
      : "DiD with common treatment timing",
    timingVariant: isStaggered ? "staggered_absorbing_adoption" : "common_timing",
    effectTarget: isStaggered
      ? "Group-time effects for the defined affected units, followed by an explicit aggregation."
      : "An average change for the defined affected group relative to the proposed comparison group.",
    applicability,
    whyThisAppears: isStaggered
      ? "The researcher reports different treatment starts across groups. This makes cohort/time support—not the policy's list of institutional dates—the relevant timing structure."
      : clarifications.adoptionPattern === "unknown"
        ? "The proposal states affected and comparison groups with a pre/post window. Common timing is shown provisionally; one selected year does not establish that all units adopt together."
        : "The researcher reports a common treatment start for the proposed affected group and a comparison group.",
    proposedContrast: `${proposedContrast(study)} Evaluate the contrast ${yearText}`,
    modelRecipes,
    assumptions: [
      "A defensible counterfactual trend for the proposed affected group",
      "No anticipation that invalidates the chosen preperiod",
      "No interference or comparison-group contamination that defeats the contrast",
      "Stable outcome measurement and relevant sample composition",
    ],
    unknowns,
    incompatibilities,
    dataNeeds: [
      ...(isStaggered
        ? ["First-treatment cohort dates", "Untreated comparison support at each relevant date"]
        : ["Observed pre- and post-period outcome support for both proposed groups"]),
      clarifications.dataStructure === "repeated_cross_sections"
        ? "Comparable repeated-cross-section composition over time"
        : "Unit/time structure appropriate to the proposed estimator",
      "Assignment and sampling structure for inference",
    ],
    estimatorVariants: isStaggered
      ? [{
          label: "Group-time effects and explicit aggregation",
          description: "Callaway and Sant'Anna organize effects by first-treatment group and time under their stated assumptions and comparison definitions.",
          referenceIds: ["M02"],
        }, {
          label: "Cohort-aware dynamic effects",
          description: "Sun and Abraham address contamination of ordinary lead/lag coefficients in their staggered, heterogeneous-effects setting.",
          referenceIds: ["M03"],
        }, {
          label: "Imputation approach",
          description: "Borusyak, Jaravel and Spiess provide an imputation approach within its model and support conditions; it does not repair an unsupported counterfactual.",
          referenceIds: ["M04"],
        }]
      : [],
    extensions: didExtensions(clarifications),
    inferenceNotes: [
      "Inference must reflect assignment and sampling structure; the observation-unit label or a large row count does not choose a clustering rule.",
    ],
    prohibitedClaims: [
      "Parallel trends passed",
      "The proposed groups are equivalent or verified exposures",
      "The selected year is a verified legal-effect date",
      "A before/after regression or fixed effects alone establishes identification",
      "Any effect size, significance, observation count, or diagnostic result",
    ],
    referenceIds: isStaggered
      ? ["M01", "M02", "M03", "M04", "M09", "M10"]
      : ["M01", "M02", "M09", "M10"],
  } satisfies StudyDesignMethodOption;
}

function createRdOption(input: {
  study: StudyContext;
  context: Screen3StudyEntryContext;
  clarifications: StudyDesignClarifications;
}) {
  const rd = input.clarifications.rd!;
  const fuzzy = rd.assignmentRelation === "fuzzy" &&
    rd.treatmentTarget === "receipt";
  const entryId = fuzzy ? "R02" : "R01";
  const incomplete = !rd.runningVariable || !rd.cutoff || !rd.assignmentRule ||
    rd.assignmentRelation === "unknown";
  const incompatibilities = rd.bindingStatus === "nonbinding"
    ? ["The researcher reports that another eligibility route makes this cutoff nonbinding for the proposed treatment contrast."]
    : [];
  const unknowns = [
    ...(incomplete ? ["Complete the running variable, cutoff, assignment rule, and sharp/fuzzy relation."] : []),
    ...(rd.bindingStatus === "unknown"
      ? ["Whether the full rule produces a treatment contrast at this cutoff for the proposed units"]
      : []),
    ...(fuzzy && rd.probabilityJump === "not_reported"
      ? ["Whether receipt probability changes at the cutoff (the first stage)"]
      : []),
    "Observed support sufficiently near both sides of the cutoff",
    "Sorting/manipulation and other simultaneous threshold changes",
  ];
  const applicability: StudyDesignApplicability = incompatibilities.length
    ? "incompatible_with_reported_setup"
    : incomplete || rd.bindingStatus === "unknown" ||
        (fuzzy && rd.probabilityJump === "not_reported")
      ? "needs_clarification"
      : "conditional_consideration";
  const outcomeMeaning = compactText(input.study.outcomeMeasure)
    ? `the researcher-supplied measure “${input.study.outcomeMeasure!.trim()}” for ${input.study.outcome ?? "the outcome"}`
    : input.study.outcome
      ? `the outcome “${input.study.outcome}”; its measurement is not yet supplied`
      : "the selected outcome; its concept and measurement are not yet supplied";
  const ruleSymbol = `Z_i = 1(R_i ${rd.operator} c)`;
  const modelRecipes: StudyDesignModelRecipe[] = fuzzy
    ? [{
        recipeId: "rd-fuzzy-local-wald-v1",
        recipeVersion: "screen-03-model-recipe-v1",
        label: "Fuzzy local-Wald target",
        applicableDataStructure: "local_threshold",
        requiredFeatures: ["Running variable", "Binding cutoff rule", "Treatment receipt", "Outcome support near both sides"],
        equationOrAlgorithm: "τ_FRD = [lim(r↓c)E[Y|R=r] − lim(r↑c)E[Y|R=r]] / [lim(r↓c)E[D|R=r] − lim(r↑c)E[D|R=r]]",
        accessibleDescription: "Divide the local outcome discontinuity by the local treatment-receipt discontinuity, when the first stage and the additional local-IV assumptions are supported. No discontinuity or coefficient has been measured here.",
        symbols: [
          { symbol: "Y", meaning: outcomeMeaning, suppliedInputRefs: ["study.outcome", "study.outcomeMeasure"] },
          { symbol: "R, c", meaning: `${rd.runningVariable || "the running variable (not supplied)"} and ${rd.cutoff || "the cutoff (not supplied)"}`, suppliedInputRefs: ["clarifications.rd.runningVariable", "clarifications.rd.cutoff"] },
          { symbol: "Z", meaning: `reported assignment or eligibility: ${ruleSymbol}; the complete rule remains controlling`, suppliedInputRefs: ["clarifications.rd.operator", "clarifications.rd.assignmentRule"] },
          { symbol: "D", meaning: "actual treatment receipt, distinct from eligibility", suppliedInputRefs: ["clarifications.rd.treatmentTarget", "clarifications.rd.probabilityJump"] },
        ],
        assumptions: ["A nonzero discontinuity in treatment receipt at the cutoff", "Appropriate continuity plus exclusion and monotonicity conditions for the local-complier interpretation", "No other threshold-linked rule or sorting process invalidates the local comparison"],
        targetEffect: "A local complier effect for receipt at the reported cutoff under the additional first-stage and IV-style assumptions.",
        unknowns: [...unknowns],
        incompatibilities: [...incompatibilities],
        estimatorNotes: ["Use source-checked bandwidth and inference procedures; no numeric bandwidth is recommended here.", "Imperfect compliance alone does not establish a first stage."],
        referenceIds: ["M06"],
      }]
    : [{
        recipeId: "rd-sharp-local-linear-v1",
        recipeVersion: "screen-03-model-recipe-v1",
        label: "Sharp local-linear illustration",
        applicableDataStructure: "local_threshold",
        requiredFeatures: ["Running variable", "Binding cutoff rule", "Sharp assignment", "Outcome support near both sides"],
        equationOrAlgorithm: `Y_i = α + τZ_i + b₁(R_i−c) + b₂Z_i(R_i−c) + ε_i, within |R_i−c| ≤ h; ${ruleSymbol}`,
        accessibleDescription: "Fit separate local slopes on either side of the reported cutoff within a source-checked bandwidth. The bandwidth, kernel, and inference procedure remain choices; no numeric value is generated.",
        symbols: [
          { symbol: "Y_i", meaning: outcomeMeaning, suppliedInputRefs: ["study.outcome", "study.outcomeMeasure"] },
          { symbol: "R_i, c", meaning: `${rd.runningVariable || "the running variable (not supplied)"} and ${rd.cutoff || "the cutoff (not supplied)"}`, suppliedInputRefs: ["clarifications.rd.runningVariable", "clarifications.rd.cutoff"] },
          { symbol: "Z_i", meaning: `assignment under the stated inequality (${rd.operator}); the complete rule is “${rd.assignmentRule || "not supplied"}”`, suppliedInputRefs: ["clarifications.rd.operator", "clarifications.rd.assignmentRule"] },
          { symbol: "τ", meaning: "the local discontinuity at the cutoff, not a population-wide average", suppliedInputRefs: [] },
          { symbol: "h", meaning: "a bandwidth to be selected with source-checked procedures; no numeric bandwidth is supplied", suppliedInputRefs: [] },
        ],
        assumptions: ["The complete rule assigns the proposed treatment sharply at the cutoff", "Appropriate potential-outcome functions are continuous at the cutoff under the selected framework", "Sorting, manipulation, and other simultaneous threshold changes do not invalidate the local contrast"],
        targetEffect: `A local effect of ${rd.treatmentTarget} at the reported cutoff—not an effect for all units.`,
        unknowns: [...unknowns],
        incompatibilities: [...incompatibilities],
        estimatorNotes: ["Use local fitting and source-checked bandwidth, kernel, bias correction, and inference procedures.", "Continuity-based and local-randomization analyses are distinct frameworks."],
        referenceIds: ["M05"],
      }];
  return {
    optionId: optionId(entryId, input.context),
    entryId,
    family: "regression_discontinuity",
    label: fuzzy ? "Fuzzy regression discontinuity" : "Sharp regression discontinuity",
    timingVariant: fuzzy ? "cutoff_changes_receipt_probability" : "sharp_cutoff_assignment",
    effectTarget: fuzzy
      ? "A local complier effect for receipt at the stated cutoff under additional first-stage and IV-style assumptions."
      : `A local effect of ${rd.treatmentTarget} at the stated cutoff—not an effect for all units.`,
    applicability,
    whyThisAppears: `The researcher ${rd.verification === "policy_documented" ? "links inspected policy evidence to" : "reports"} a rule using ${rd.runningVariable || "an unspecified running variable"} ${rd.operator} ${rd.cutoff || "an unspecified cutoff"}. This does not independently verify the legal rule or observed data.`,
    proposedContrast: `Compare units locally on either side of the complete reported assignment rule: ${rd.assignmentRule || "rule not yet supplied"}`,
    modelRecipes,
    assumptions: fuzzy
      ? [
          "A discontinuity in receipt probability at the cutoff",
          "Exclusion and monotonicity conditions for the local complier interpretation",
          "An applicable continuity or justified local-randomization framework",
        ]
      : [
          "The complete rule assigns the proposed treatment sharply at the cutoff",
          "An applicable continuity or justified local-randomization framework",
        ],
    unknowns,
    incompatibilities,
    dataNeeds: [
      "Running-variable values and outcome support on both sides near the cutoff",
      "The complete logical assignment rule, including other eligibility conditions",
      ...(fuzzy ? ["Treatment-receipt information for the first stage"] : []),
    ],
    estimatorVariants: [],
    extensions: [],
    inferenceNotes: [
      "Continuity-based and local-randomization analyses are distinct frameworks and are not treated as automatic equivalents.",
    ],
    prohibitedClaims: [
      "The cutoff or legal rule is independently verified when it is only researcher-reported",
      "Observed support, sorting diagnostics, or a first stage has been measured",
      "The local effect is a population average treatment effect",
      "A global high-order polynomial is the default",
    ],
    referenceIds: fuzzy ? ["M06"] : ["M05", "M06"],
  } satisfies StudyDesignMethodOption;
}

function warning(input: Omit<StudyDesignWarning, "warningId">) {
  const basis = input.basis ?? (input.triggerEvidenceRefs.length
    ? "documentary_design_concern"
    : input.severity === "substantive_incompatibility" ||
        input.ruleId === "groups-undefined" || input.ruleId === "timing-undecided"
      ? "reported_input_inconsistency" : "empirical_requirement");
  const content = { ...input, basis };
  const warningId = `warning-${fingerprintSixScreenValue(content).slice("fnv1a64:".length)}`;
  return { warningId, ...content };
}

function policySuggestsStaggeredTiming(policyReview?: PolicyReview | null) {
  const timeline = Array.isArray(policyReview?.briefing?.timeline)
    ? policyReview.briefing.timeline : [];
  const claims = Array.isArray(policyReview?.claims)
    ? policyReview.claims : [];
  const timingText = [
    ...timeline.flatMap((item) => [
      item.label,
      item.statement,
      item.qualification ?? "",
    ]),
    ...claims
      .filter(({ predicate }) => predicate === "implementation_schedule" ||
        predicate === "coverage_condition")
      .map(({ statement }) => statement),
  ].join(" ").toLocaleLowerCase("en-US");
  const distinctDates = new Set(
    timeline.flatMap(({ date }) =>
      date?.start && ["implementation", "enforcement"].includes(date.kind)
        ? [date.start] : []
    ),
  );
  return /\b(?:staggered|phase(?:d| in)|different (?:dates|years|times)|var(?:y|ies|ied) by|state adoption|states? (?:adopt|implement)|smaller reporting companies|issuer categor(?:y|ies)|separate compliance dates?)\b/u
    .test(timingText) ||
    distinctDates.size > 1 &&
      /\b(?:compliance|implementation|enforcement)\b/u.test(timingText) &&
      /\b(?:categor(?:y|ies)|groups?|issuers?|firms?|companies|states?|sizes?|thresholds?)\b/u
        .test(timingText);
}

export function createStudyDesignAdvice(input: {
  study: StudyContext;
  timing: ProposedTreatmentTiming;
  entryContext: Screen3StudyEntryContext;
  policyReview?: PolicyReview | null;
  clarifications?: Partial<StudyDesignClarifications> | null;
  createdAt: string;
}): StudyDesignAdvice {
  requireCanonicalInstant(input.createdAt, "Study design advice createdAt");
  const clarifications = normalizeStudyDesignClarifications(input.clarifications);
  if (
    fingerprintSixScreenValue(clarifications) !==
      input.entryContext.clarificationFingerprint
  ) throw new Error("Study design clarifications changed after the Screen 3 entry context was frozen.");
  const groupsComplete = Boolean(
    compactText(input.study.proposedTreatment) &&
      compactText(input.study.proposedComparison),
  );
  const options: StudyDesignMethodOption[] = [];
  const staggered = clarifications.adoptionPattern === "staggered" ||
    input.timing.mode === "varies_by_group";
  if (clarifications.rd) {
    options.push(createRdOption({
      study: input.study,
      context: input.entryContext,
      clarifications,
    }));
  }
  if (groupsComplete || input.study.proposedTreatment || input.study.proposedComparison) {
    const primaryDidEntry = staggered
      ? "D02"
      : clarifications.adoptionPattern === "unknown" &&
          policySuggestsStaggeredTiming(input.policyReview)
        ? "D02" : "D01";
    options.push(createDidOption({
      entryId: primaryDidEntry,
      study: input.study,
      timing: input.timing,
      context: input.entryContext,
      clarifications,
    }));
    // When the documentary timeline itself indicates phased or group-specific
    // starts but the researcher entered only one proposed year, keep common
    // timing visible as an alternative instead of silently treating that year
    // as proof that every unit starts together.
    if (primaryDidEntry === "D02" && !staggered) {
      options.push(createDidOption({
        entryId: "D01",
        study: input.study,
        timing: input.timing,
        context: input.entryContext,
        clarifications,
      }));
    }
  }
  const startYear = yearFromBoundary(input.study.period.start);
  const endYear = yearFromBoundary(input.study.period.end);
  const affectedDid = options.filter(({ family }) =>
    family === "difference_in_differences").map(({ optionId: id }) => id);
  const warnings: StudyDesignWarning[] = [];
  if (!groupsComplete) warnings.push(warning({
    ruleId: "groups-undefined",
    affectedOptionIds: affectedDid,
    triggerInputRefs: ["study.proposedTreatment", "study.proposedComparison"],
    triggerEvidenceRefs: [],
    severity: "caution",
    message: "The affected and comparison groups are not both defined.",
    whyItMatters: "A comparison method cannot supply the missing counterfactual group or treatment target.",
    whatToCheck: "Describe both groups, or keep Screen 3 explicitly undecided without selecting a method.",
    methodReferenceIds: ["M01", "M02"],
  }));
  if (input.timing.mode === "undecided") warnings.push(warning({
    ruleId: "timing-undecided",
    affectedOptionIds: affectedDid,
    triggerInputRefs: ["proposedTiming.mode"],
    triggerEvidenceRefs: [],
    severity: "caution",
    message: "Proposed treatment timing is not decided yet.",
    whyItMatters: "Pre/post and comparison support cannot be described precisely without a proposed timing structure.",
    whatToCheck: "Retain this as unresolved or return to enter a researcher-chosen year or varying-by-group timing.",
    methodReferenceIds: ["M01", "M02"],
  }));
  if (input.timing.mode === "year" && startYear !== null && input.timing.year! <= startYear) {
    warnings.push(warning({
      ruleId: "no-proposed-preperiod",
      affectedOptionIds: affectedDid,
      triggerInputRefs: ["study.period.start", "proposedTiming.year"],
      triggerEvidenceRefs: [],
      severity: "substantive_incompatibility",
      message: input.timing.year === startYear
        ? "The proposed treatment year is at the study-window boundary, leaving no earlier proposed period."
        : "The proposed treatment year is before the study window, so the stated window is all post-treatment.",
      whyItMatters: "The implemented DiD entries require proposed pre- and post-treatment support; this statement does not assert what observations exist outside the entered window.",
      whatToCheck: "Review the intended window or retain the incompatibility. Nothing has been changed automatically.",
      methodReferenceIds: ["M01", "M02"],
    }));
  }
  if (input.timing.mode === "year" && endYear !== null && input.timing.year! >= endYear) {
    warnings.push(warning({
      ruleId: "no-proposed-postperiod",
      affectedOptionIds: affectedDid,
      triggerInputRefs: ["study.period.end", "proposedTiming.year"],
      triggerEvidenceRefs: [],
      severity: "substantive_incompatibility",
      message: input.timing.year === endYear
        ? "The proposed treatment year is at the study-window boundary, leaving no later proposed period."
        : "The proposed treatment year is after the study window, so the stated window is all pre-treatment.",
      whyItMatters: "The implemented DiD entries require proposed pre- and post-treatment support.",
      whatToCheck: "Review the intended window or retain the incompatibility. No date has been reset.",
      methodReferenceIds: ["M01", "M02"],
    }));
  }
  if (clarifications.adoptionPattern === "unknown" && options.some(({ entryId }) => entryId === "D01")) {
    warnings.push(warning({
      ruleId: "adoption-pattern-unknown",
      affectedOptionIds: affectedDid,
      triggerInputRefs: ["clarifications.adoptionPattern", "proposedTiming.year"],
      triggerEvidenceRefs: [],
      severity: "information",
      message: "One selected year does not establish common adoption across units.",
      whyItMatters: "Common and staggered starts require different support and effect aggregation discussions.",
      whatToCheck: "If known, report whether first treatment occurs together or at different times. Policy stage dates are not unit cohorts.",
      methodReferenceIds: ["M01", "M02", "M03"],
    }));
  }
  if (["reversible", "continuous_dose"].includes(clarifications.treatmentProcess)) {
    warnings.push(warning({
      ruleId: "treatment-process-outside-core",
      affectedOptionIds: affectedDid,
      triggerInputRefs: ["clarifications.treatmentProcess"],
      triggerEvidenceRefs: [],
      severity: "substantive_incompatibility",
      message: `The reported ${clarifications.treatmentProcess.replaceAll("_", " ")} exposure is outside the current binary absorbing-treatment library.`,
      whyItMatters: "An absorbing-treatment recipe cannot be silently applied to switching or dose variation.",
      whatToCheck: "Use specialized source-checked guidance before coding exposure; other methods may address this structure.",
      methodReferenceIds: ["M01", "M02"],
    }));
  }
  if (clarifications.comparisonSupport === "unavailable_after_adoption") {
    warnings.push(warning({
      ruleId: "late-comparison-support",
      affectedOptionIds: affectedDid,
      triggerInputRefs: ["clarifications.comparisonSupport"],
      triggerEvidenceRefs: [],
      severity: "substantive_incompatibility",
      message: "No clean comparison support is reported for later cohorts or periods.",
      whyItMatters: "Already-treated units are not automatically clean controls, and a never-treated group cannot be invented.",
      whatToCheck: "Map untreated comparison support at each target date and narrow unsupported contrasts explicitly.",
      methodReferenceIds: ["M02", "M03"],
    }));
  }
  if (
    clarifications.reportedPolicyAssignments !== null &&
    clarifications.reportedPolicyAssignments <= 4
  ) warnings.push(warning({
    ruleId: "few-policy-assignments",
    affectedOptionIds: options.map(({ optionId: id }) => id),
    triggerInputRefs: ["study.analysisUnit", "clarifications.reportedPolicyAssignments"],
    triggerEvidenceRefs: [],
    severity: "caution",
    message: "The researcher reports few policy assignments even if the dataset may contain many rows.",
    whyItMatters: "Inference depends on assignment and sampling structure, not row count alone.",
    whatToCheck: "Document the assignment level and dependence structure before choosing an inference procedure; no clustering rule is selected here.",
    methodReferenceIds: ["M10"],
  }));
  if (clarifications.effectInterest === "subgroup" && clarifications.moderatorTime === "post_treatment") {
    warnings.push(warning({
      ruleId: "post-treatment-subgroup",
      affectedOptionIds: affectedDid,
      triggerInputRefs: ["clarifications.moderator", "clarifications.moderatorTime"],
      triggerEvidenceRefs: [],
      severity: "caution",
      message: "The proposed subgroup characteristic is measured after treatment.",
      whyItMatters: "Post-treatment classification can be affected by the policy and cannot be silently relabeled as baseline.",
      whatToCheck: "Clarify timing and the intended estimand; the field remains unchanged.",
      methodReferenceIds: ["M01", "M02"],
    }));
  }
  if (
    input.entryContext.evidence.status !== "available" &&
    (input.study.proposedTreatment || input.study.proposedComparison)
  ) warnings.push(warning({
    ruleId: "exposure-not-verified",
    affectedOptionIds: options.map(({ optionId: id }) => id),
    triggerInputRefs: ["study.geography", "study.proposedTreatment", "study.proposedComparison"],
    triggerEvidenceRefs: input.entryContext.evidence.sourceLinkedClaimIds,
    severity: "caution",
    message: "The proposed group labels are not verified legal exposure assignments.",
    whyItMatters: `Policy evidence is ${input.entryContext.evidence.status}; geography or a headquarters label may not implement the full coverage rule.`,
    whatToCheck: "Map the complete exposure rule to historical units without replacing the researcher's proposal.",
    methodReferenceIds: [],
  }));
  const treatment = compactText(input.study.proposedTreatment);
  const control = compactText(input.study.proposedComparison);
  const outcome = compactText(input.study.outcome) ?? "the outcome";
  if (treatment && control &&
      treatment.toLocaleLowerCase("en-US") === control.toLocaleLowerCase("en-US")) {
    warnings.push(warning({
      ruleId: "identical-proposed-groups",
      affectedOptionIds: affectedDid,
      triggerInputRefs: ["study.proposedTreatment", "study.proposedComparison"],
      triggerEvidenceRefs: [], severity: "substantive_incompatibility",
      message: "The proposed treatment and control groups have the same label.",
      whyItMatters: `Both are “${treatment}”; this description cannot establish different exposure or a comparison for ${outcome}.`,
      whatToCheck: "Specify how treatment and control units differ without changing either group automatically.",
      methodReferenceIds: ["M01", "M02"],
    }));
  }
  const dates = [
    ...(input.policyReview?.briefing?.timeline ?? []),
    ...(input.policyReview?.briefing?.laterTimeline ?? []),
  ];
  const announcement = dates.find((item) => item.date.kind === "announcement" &&
    item.date.start && input.timing.mode === "year" &&
    Number(item.date.start.slice(0, 4)) < input.timing.year!);
  if (announcement && input.timing.mode === "year") warnings.push(warning({
    ruleId: "announcement-before-proposed-year",
    affectedOptionIds: affectedDid,
    triggerInputRefs: ["proposedTiming.year"],
    triggerEvidenceRefs: announcement.claimIds?.length
      ? announcement.claimIds : [announcement.claimId],
    severity: "caution",
    message: "Preparation may precede the proposed treatment year.",
    whyItMatters: `Screen 2 dates an announcement to ${announcement.date.start}; the researcher proposed ${input.timing.year}. Firms could respond during that interval, but an early effect has not been observed.`,
    whatToCheck: `Compare the ${announcement.date.start} announcement with ${input.timing.year} and the observed outcome frequency; assess whether preparation affects observations called pre-treatment.`,
    methodReferenceIds: ["M01", "M02"],
  }));
  const amendments = dates.filter((item) => item.date.kind === "amendment");
  if (amendments.length) warnings.push(warning({
    ruleId: "policy-version-distinction",
    affectedOptionIds: options.map((option) => option.optionId),
    triggerInputRefs: ["proposedTiming.year"],
    triggerEvidenceRefs: amendments.flatMap((item) =>
      item.claimIds?.length ? item.claimIds : [item.claimId]),
    severity: "caution",
    message: "The saved policy has an amendment or later version.",
    whyItMatters: "Different duties or effective dates may change the package studied. Multiple amendments do not by themselves mean firms adopted in different cohorts.",
    whatToCheck: "Compare the saved versions and unit-level application dates before coding treatment or interpreting staggered adoption.",
    methodReferenceIds: ["M01", "M02"],
  }));
  if (affectedDid.length && groupsComplete) {
    warnings.push(warning({
      ruleId: "parallel-trend-rationale",
      affectedOptionIds: affectedDid,
      triggerInputRefs: ["study.proposedTreatment", "study.proposedComparison", "study.outcome"],
      triggerEvidenceRefs: [], severity: "caution",
      message: "The proposed comparison needs an untreated-trend rationale.",
      whyItMatters: `For ${treatment} versus ${control}, explain why ${outcome} would have evolved comparably without the policy. A pretrend test that does not reject cannot prove this assumption.`,
      whatToCheck: "Map pre-policy drivers and measured outcomes for both groups; use trend and sensitivity analyses as evidence, not a pass certificate.",
      methodReferenceIds: ["M01", "M02", "M03"],
    }));
    warnings.push(warning({
      ruleId: "spillover-exposure",
      affectedOptionIds: affectedDid,
      triggerInputRefs: ["study.proposedTreatment", "study.proposedComparison"],
      triggerEvidenceRefs: [], severity: "caution",
      message: "Check whether the proposed control group could also respond.",
      whyItMatters: `Customers, suppliers or markets may link ${treatment} and ${control}. Location alone does not verify unaffected controls for ${outcome}.`,
      whatToCheck: "Map eligibility and plausible indirect exposure for firms in both groups before treating the comparison as untreated.",
      methodReferenceIds: ["M09"],
    }));
    if (staggered) warnings.push(warning({
      ruleId: "staggered-heterogeneous-effects",
      affectedOptionIds: affectedDid,
      triggerInputRefs: ["clarifications.adoptionPattern", "proposedTiming.mode"],
      triggerEvidenceRefs: [], severity: "caution",
      message: "Staggered starts require cohort-specific comparison checks.",
      whyItMatters: "If effects change over time or cohorts, conventional two-way fixed-effects event-study coefficients can mix effects across cohorts.",
      whatToCheck: "Map first treatment by unit, eligible not-yet-treated comparisons and target aggregation before selecting an estimator.",
      methodReferenceIds: ["M02", "M03"],
    }));
  }
  if (clarifications.rd) {
    const rd = clarifications.rd;
    if (!rd.runningVariable || !rd.cutoff || !rd.assignmentRule) warnings.push(warning({
      ruleId: "incomplete-cutoff-rule",
      affectedOptionIds: options.filter((option) =>
        option.family === "regression_discontinuity").map((option) => option.optionId),
      triggerInputRefs: ["clarifications.rd"],
      triggerEvidenceRefs: [], severity: "substantive_incompatibility",
      message: "The reported cutoff does not yet define an assignment rule.",
      whyItMatters: "A number alone cannot identify who crosses the cutoff, in which units, or whether the rule applies to the sample.",
      whatToCheck: "Supply the running variable, its units, treated side, cutoff and any other eligibility conditions.",
      methodReferenceIds: ["M05", "M06"],
    }));
    if (rd.bindingStatus !== "binding" ||
        rd.assignmentRelation === "unknown") warnings.push(warning({
      ruleId: "cutoff-assignment-unknown",
      affectedOptionIds: options.filter((option) =>
        option.family === "regression_discontinuity").map((option) => option.optionId),
      triggerInputRefs: ["clarifications.rd"],
      triggerEvidenceRefs: [], severity: rd.bindingStatus === "nonbinding"
        ? "substantive_incompatibility" : "caution",
      message: rd.bindingStatus === "nonbinding"
        ? "The researcher reports that the cutoff does not bind for these units."
        : "An assignment jump at the cutoff remains unverified.",
      whyItMatters: `The proposed rule ${rd.runningVariable || "for an unspecified variable"} ${rd.operator} ${rd.cutoff || "an unspecified cutoff"} does not establish a local assignment or receipt discontinuity.`,
      whatToCheck: "Check historical eligibility, other conditions, running-variable timing and treatment probability on each side before claiming an RD effect.",
      methodReferenceIds: ["M05", "M06"],
    }));
    if (rd.treatmentTarget === "receipt" || rd.assignmentRelation === "fuzzy") {
      warnings.push(warning({
        ruleId: "fuzzy-rd-excluded-paths",
        affectedOptionIds: options.filter((option) =>
          option.family === "regression_discontinuity").map((option) => option.optionId),
        triggerInputRefs: ["clarifications.rd.treatmentTarget", "clarifications.rd.assignmentRelation"],
        triggerEvidenceRefs: [], severity: "caution",
        message: "A receipt effect needs assumptions beyond a cutoff contrast.",
        whyItMatters: "Eligibility can change outcomes through paths other than treatment receipt; a fuzzy RD or IV-style receipt claim requires a first stage and a justified exclusion restriction.",
        whatToCheck: "Separate the reduced-form eligibility contrast from receipt; examine compliance, other direct paths and the local target.",
        methodReferenceIds: ["M06"],
      }));
    }
  }
  if (input.study.policySideConcept) warnings.push(warning({
    ruleId: "policy-to-construct-fit",
    affectedOptionIds: options.map((option) => option.optionId),
    triggerInputRefs: ["study.policySideConcept"],
    triggerEvidenceRefs: input.entryContext.evidence.sourceLinkedClaimIds.slice(0, 3),
    severity: "information",
    message: "Connect the policy episode to the proposed shock construct.",
    whyItMatters: `The researcher named “${input.study.policySideConcept}” as X. The policy package may change several things; documentary evidence does not by itself isolate this construct.`,
    whatToCheck: "Identify the operative provision and sample exposure that would instantiate X, and retain a package-level claim if components cannot be separated.",
    methodReferenceIds: [],
  }));
  const features: StudyDesignFeature[] = [{
    featureId: "proposed-groups",
    value: [input.study.proposedTreatment, input.study.proposedComparison]
      .filter((value): value is string => Boolean(value)),
    origin: groupsComplete ? "researcher_report" : "unknown",
    inputRefs: ["study.proposedTreatment", "study.proposedComparison"],
    policyRefs: [],
    uncertainty: groupsComplete ? "Legal exposure has not been verified by these labels." : "One or both groups are undefined.",
  }, {
    featureId: "proposed-timing",
    value: input.timing.mode === "year" ? input.timing.year : input.timing.mode,
    origin: "researcher_report",
    inputRefs: ["proposedTiming.mode", "proposedTiming.year"],
    policyRefs: input.timing.milestoneReference
      ? [input.timing.milestoneReference.claimId]
      : [],
    uncertainty: input.timing.mode === "year"
      ? "Year precision only; not automatically a legal-effect date or unit adoption date."
      : null,
  }, {
    featureId: "adoption-pattern",
    value: clarifications.adoptionPattern,
    origin: clarifications.adoptionPattern === "unknown" ? "unknown" : "researcher_report",
    inputRefs: ["clarifications.adoptionPattern"],
    policyRefs: [],
    uncertainty: clarifications.adoptionPattern === "unknown"
      ? "A selected year and multiple policy stages do not resolve unit adoption timing."
      : null,
  }, {
    featureId: "evidence-status",
    value: input.entryContext.evidence.status,
    origin: input.entryContext.evidence.status === "not_researched"
      ? "unknown"
      : "inspected_policy_evidence",
    inputRefs: [],
    policyRefs: input.entryContext.evidence.sourceLinkedClaimIds,
    uncertainty: input.entryContext.evidence.limitation,
  }];
  const alternatives: StudyDesignAdvice["alternatives"] = [];
  if (["reversible", "continuous_dose"].includes(clarifications.treatmentProcess)) {
    alternatives.push({
      entryId: "OUT_OF_SCOPE",
      label: "Specialized switching or dose-response design",
      applicability: "outside_current_library",
      explanation: "The current library does not implement this reported treatment process. It has not converted the exposure to binary; other source-checked methods may address the structure.",
      referenceIds: [],
    });
  }
  const binding = {
    identityFingerprint: input.entryContext.identityFingerprint,
    studyRevision: input.study.revision,
    studyFingerprint: input.entryContext.studyFingerprint,
    timingFingerprint: input.timing.timingFingerprint,
    evidenceSnapshotIdOrNull: input.entryContext.evidence.snapshotId,
    evidenceFingerprintOrNull: input.entryContext.evidence.snapshotFingerprint,
    clarificationFingerprint: input.entryContext.clarificationFingerprint,
    methodLibraryVersion: SIX_SCREEN_STUDY_DESIGN_LIBRARY_VERSION,
    synthesisConfigurationVersion: SIX_SCREEN_STUDY_DESIGN_SYNTHESIS_VERSION,
  };
  const content = {
    binding,
    execution: {
      mode: "library_only" as const,
      taskId: null,
      model: null,
      disclosure: "Deterministic, versioned method-library guidance. No model task, data inspection, effect estimation, or diagnostic test ran.",
    },
    proposalEcho: {
      population: input.study.population,
      analysisUnit: input.study.analysisUnit,
      geography: [...input.study.geography],
      industry: [...input.study.industry],
      period: structuredClone(input.study.period),
      outcome: input.study.outcome,
      outcomeMeasure: input.study.outcomeMeasure ?? null,
      policySideConcept: input.study.policySideConcept ?? null,
      initialExplanation: input.study.initialExplanation,
      // `question` is a persisted compatibility field. New records keep the
      // researcher's explanation in its own field instead of silently
      // relabelling that explanation as a research question.
      question: null,
      proposedTreatment: input.study.proposedTreatment,
      proposedComparison: input.study.proposedComparison,
      resultsPreviouslyInspected: input.study.resultsPreviouslyInspected,
      timing: {
        ...timingSemanticInput(input.timing),
        precision: input.timing.precision,
        origin: input.timing.origin,
      },
    },
    clarifications: structuredClone(clarifications),
    features,
    options: options.slice(0, 3),
    alternatives,
    warnings,
    completeness: {
      availableModules: ["common-timing DiD", "staggered absorbing-adoption DiD", "dynamic and subgroup extensions", "sharp and fuzzy RD"],
      missingModules: ["triple differences (specified, deferred)", "synthetic control (specified, deferred)", "switching and continuous-dose estimators"],
      notAssessed: ["Outcome data", "Treatment coding", "Sample sizes", "Effect estimates", "Parallel trends", "First stage", "Sorting", "Inference diagnostics"],
    },
  };
  const adviceFingerprint = fingerprintSixScreenValue(content);
  return {
    schemaVersion: SIX_SCREEN_STUDY_DESIGN_ADVICE_SCHEMA_VERSION,
    adviceId: `screen3-advice-${adviceFingerprint.slice("fnv1a64:".length)}`,
    createdAt: input.createdAt,
    ...content,
    adviceFingerprint,
  };
}

export function createStudyDesignSelection(input: {
  advice: StudyDesignAdvice;
  decision: StudyDesignSelection["decision"];
  rationale: string;
  selectedAt: string;
}) {
  requireCanonicalInstant(input.selectedAt, "Study design selection selectedAt");
  if (!input.rationale.trim() || input.rationale.length > 2_000) {
    throw new Error("Study design selection requires a bounded researcher rationale.");
  }
  if (input.decision.mode === "selected") {
    const selectedOptionId = input.decision.optionId;
    if (!input.advice.options.some(({ optionId: id }) => id === selectedOptionId)) {
      throw new Error("The selected method option is not part of the current advice.");
    }
  }
  const core = {
    adviceId: input.advice.adviceId,
    adviceFingerprint: input.advice.adviceFingerprint,
    identityFingerprint: input.advice.binding.identityFingerprint,
    studyRevision: input.advice.binding.studyRevision,
    decision: structuredClone(input.decision),
    rationale: input.rationale.trim(),
    actor: "researcher" as const,
    selectedAt: input.selectedAt,
  };
  const selectionFingerprint = fingerprintSixScreenValue(core);
  return {
    schemaVersion: SIX_SCREEN_STUDY_DESIGN_SELECTION_SCHEMA_VERSION,
    id: `screen3-selection-${selectionFingerprint.slice("fnv1a64:".length)}`,
    ...core,
    selectionFingerprint,
  } satisfies StudyDesignSelection;
}

export function currentStudyDesignAdvice(state: {
  confirmedShock: { identityFingerprint: string } | null;
  study: StudyContext;
  studyDesignAdvices?: StudyDesignAdvice[];
}) {
  const current = studyFingerprint(state.study);
  const legacy = v23StudyFingerprint(state.study);
  return [...(state.studyDesignAdvices ?? [])].reverse().find((advice) =>
    advice.binding.identityFingerprint === state.confirmedShock?.identityFingerprint &&
    advice.binding.studyRevision === state.study.revision &&
    (advice.binding.studyFingerprint === current ||
      advice.binding.studyFingerprint === legacy)
  ) ?? null;
}

export function currentProposedTreatmentTiming(state: {
  confirmedShock: { identityFingerprint: string } | null;
  proposedTreatmentTimings?: ProposedTreatmentTiming[];
}) {
  return [...(state.proposedTreatmentTimings ?? [])].reverse().find((timing) =>
    timing.identityFingerprint === state.confirmedShock?.identityFingerprint
  ) ?? null;
}

export function currentScreen3StudyEntryContext(state: {
  confirmedShock: { identityFingerprint: string } | null;
  study: StudyContext;
  screen3StudyEntryContexts?: Screen3StudyEntryContext[];
}) {
  const expectedStudyFingerprint = studyFingerprint(state.study);
  const legacyStudyFingerprint = v23StudyFingerprint(state.study);
  return [...(state.screen3StudyEntryContexts ?? [])].reverse().find((entry) =>
    entry.identityFingerprint === state.confirmedShock?.identityFingerprint &&
    entry.studyRevision === state.study.revision &&
    (entry.studyFingerprint === expectedStudyFingerprint ||
      entry.studyFingerprint === legacyStudyFingerprint)
  ) ?? null;
}

export function currentStudyDesignSelection(state: {
  studyDesignSelections?: StudyDesignSelection[];
  studyDesignAdvices?: StudyDesignAdvice[];
  confirmedShock: { identityFingerprint: string } | null;
  study: StudyContext;
}) {
  const advice = currentStudyDesignAdvice(state);
  if (!advice) return null;
  return [...(state.studyDesignSelections ?? [])].reverse().find((selection) =>
    selection.adviceId === advice.adviceId &&
    selection.adviceFingerprint === advice.adviceFingerprint
  ) ?? null;
}

export function validateStudyDesignCollections(state: {
  proposedTreatmentTimings?: ProposedTreatmentTiming[];
  screen3StudyEntryContexts?: Screen3StudyEntryContext[];
  studyDesignAdvices?: StudyDesignAdvice[];
  studyDesignSelections?: StudyDesignSelection[];
}) {
  for (const [collection, label] of [
    [state.proposedTreatmentTimings, "proposed treatment timing"],
    [state.screen3StudyEntryContexts, "Screen 3 entry context"],
    [state.studyDesignAdvices, "study design advice"],
    [state.studyDesignSelections, "study design selection"],
  ] as const) {
    if (collection !== undefined && !Array.isArray(collection)) {
      throw new Error(`Stored ${label} collection is invalid.`);
    }
    if ((collection?.length ?? 0) > SIX_SCREEN_STUDY_DESIGN_MAX_RECORDS) {
      throw new Error(`Stored ${label} collection exceeds its bounded history.`);
    }
  }
  for (const timing of state.proposedTreatmentTimings ?? []) {
    if (timing.schemaVersion !== SIX_SCREEN_PROPOSED_TIMING_SCHEMA_VERSION) {
      throw new Error("Stored proposed treatment timing schema is invalid.");
    }
    validateProposedTreatmentTimingInput(timing);
    requireCanonicalInstant(timing.createdAt, "Stored treatment timing createdAt");
    requireFingerprint(timing.timingFingerprint, "Stored treatment timing fingerprint");
    const rebuilt = createProposedTreatmentTiming({
      value: timing,
      identityFingerprint: timing.identityFingerprint,
      revision: timing.revision,
      origin: timing.origin,
      createdAt: timing.createdAt,
    });
    if (rebuilt.timingFingerprint !== timing.timingFingerprint || rebuilt.id !== timing.id) {
      throw new Error("Stored proposed treatment timing fingerprint is invalid.");
    }
  }
  const timingById = new Map(
    (state.proposedTreatmentTimings ?? []).map((timing) => [timing.id, timing]),
  );
  for (const entry of state.screen3StudyEntryContexts ?? []) {
    requireFingerprint(entry.entryFingerprint, "Stored Screen 3 entry fingerprint");
    if (!timingById.has(entry.timingId)) {
      throw new Error("Stored Screen 3 entry references an unavailable timing record.");
    }
  }
  const adviceById = new Map(
    (state.studyDesignAdvices ?? []).map((advice) => [advice.adviceId, advice]),
  );
  for (const advice of state.studyDesignAdvices ?? []) {
    requireFingerprint(advice.adviceFingerprint, "Stored study design advice fingerprint");
    if (advice.binding.methodLibraryVersion !== SIX_SCREEN_STUDY_DESIGN_LIBRARY_VERSION) {
      throw new Error("Stored study design advice method-library version is invalid.");
    }
  }
  for (const selection of state.studyDesignSelections ?? []) {
    requireFingerprint(selection.selectionFingerprint, "Stored study design selection fingerprint");
    const advice = adviceById.get(selection.adviceId);
    if (!advice || advice.adviceFingerprint !== selection.adviceFingerprint) {
      throw new Error("Stored study design selection references unavailable advice.");
    }
  }
}
