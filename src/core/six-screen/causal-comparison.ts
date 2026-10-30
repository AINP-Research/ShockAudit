import { fingerprintSixScreenValue } from "./canonical";
import {
  requireBoundedIdentifier,
  requireCanonicalInstant,
  requireFingerprint,
  type ConfirmedShock,
  type StudyContext,
} from "./contracts";
import {
  createPolicyEventCardReference,
  type PolicyEventCardClaimReview,
  type PolicyEventCardReference,
  type PolicyReviewedEventCard,
} from "./policy-event-card-review";

export const SIX_SCREEN_CAUSAL_COMPARISON_INPUT_VERSION =
  "screen-03-causal-comparison-input-v1" as const;
export const SIX_SCREEN_CAUSAL_DESIGN_SET_VERSION =
  "screen-03-causal-design-set-v1" as const;
export const SIX_SCREEN_CAUSAL_DESIGN_DECISION_VERSION =
  "screen-03-causal-design-decision-v1" as const;
export const SIX_SCREEN_CAUSAL_METHOD_LIBRARY_VERSION =
  "screen-03-causal-method-library-v1" as const;
export const SIX_SCREEN_CAUSAL_DESIGN_MAX_REVISIONS = 24;
export const SIX_SCREEN_CAUSAL_DESIGN_MAX_BYTES = 128_000;

export const CAUSAL_DESIGN_STATUSES = [
  "conditional",
  "needs_data",
  "needs_institutional_review",
  "not_supported_by_current_variation",
  "selected_for_review",
] as const;

export type CausalDesignStatus = (typeof CAUSAL_DESIGN_STATUSES)[number];
const CAUSAL_DESIGN_OPTION_STATUSES: readonly CausalDesignOption["status"][] = [
  "conditional",
  "needs_data",
  "needs_institutional_review",
  "not_supported_by_current_variation",
];
export type CausalPolicyTarget =
  | "full_policy_package"
  | "policy_component"
  | "legal_eligibility"
  | "actual_compliance"
  | "other_defined_exposure";

export type CausalComparisonInput = {
  schemaVersion: typeof SIX_SCREEN_CAUSAL_COMPARISON_INPUT_VERSION;
  policyTarget: CausalPolicyTarget;
  targetDetail: string | null;
  targetClaimIds: string[];
  variationClaimIds: string[];
  assignmentUnit: string;
  proposedTreatedGroup: string | null;
  proposedComparisonGroup: string | null;
  dataAvailability:
    | "not_assessed"
    | "available"
    | "partially_available"
    | "unavailable";
  dataFrequency: string | null;
  historicalEligibilityFields: string[];
  designConstraints: string[];
  inputFingerprint: string;
};

export type CausalMethodLibraryEntry = {
  id: "did-reviewed-v1" | "threshold-reviewed-v1";
  version: typeof SIX_SCREEN_CAUSAL_METHOD_LIBRARY_VERSION;
  family: "difference_in_differences" | "threshold_eligibility";
  label: string;
  reviewStatus: "reviewed_initial_library";
  documentedFeature: string;
  requiredEvidence: string[];
  claimBoundary: string;
};

export const INITIAL_CAUSAL_METHOD_LIBRARY: readonly CausalMethodLibraryEntry[] =
  Object.freeze([
    {
      id: "did-reviewed-v1",
      version: SIX_SCREEN_CAUSAL_METHOD_LIBRARY_VERSION,
      family: "difference_in_differences",
      label: "Covered and comparison units over time",
      reviewStatus: "reviewed_initial_library",
      documentedFeature:
        "A reviewed coverage, exemption, or equivalent assignment distinction that can be observed before and after a reviewed policy clock.",
      requiredEvidence: [
        "Reviewed operative policy premise",
        "Reviewed source-linked coverage or exemption premise",
        "Distinct proposed treated and comparison groups",
        "Explicit treatment-clock or no-clock decision",
      ],
      claimBoundary:
        "The option does not establish parallel trends, no anticipation, absence of spillovers, or causal validity.",
    },
    {
      id: "threshold-reviewed-v1",
      version: SIX_SCREEN_CAUSAL_METHOD_LIBRARY_VERSION,
      family: "threshold_eligibility",
      label: "Local comparison around a binding eligibility cutoff",
      reviewStatus: "reviewed_initial_library",
      documentedFeature:
        "A complete, source-linked eligibility rule with a numeric cutoff and all other conditions, exemptions, grandfathering, and historical measurement periods retained.",
      requiredEvidence: [
        "Complete structured eligibility rule",
        "Binding numeric cutoff",
        "All AND/OR conditions and exclusions",
        "Explicit treatment-clock or no-clock decision",
      ],
      claimBoundary:
        "A policy number alone does not establish local random assignment, continuity, nonmanipulation, a first stage, or a receipt-of-treatment effect.",
    },
  ] satisfies CausalMethodLibraryEntry[]);

export type CausalDesignEvidenceLink = {
  claimId: string;
  predicate: string;
  statement: string;
  decision: PolicyEventCardClaimReview["decision"];
  statementOrigin: PolicyEventCardClaimReview["statementOrigin"];
  supportStatus: PolicyEventCardClaimReview["supportStatus"];
  passageIds: string[];
  documentVersionIds: string[];
  sourceIds: string[];
  conflictIds: string[];
};

export type StructuredEligibilityCondition = {
  id: string;
  kind: "threshold" | "categorical" | "other";
  description: string;
  variable: string;
  operator: "gt" | "gte" | "lt" | "lte" | "eq" | null;
  value: number | string | boolean;
  unit: string | null;
  referencePeriod: string | null;
};

export type StructuredEligibilityRule = {
  schemaVersion: "policy-eligibility-rule-v1";
  complete: true;
  logic: "all" | "any";
  assignmentUnit: string;
  conditions: StructuredEligibilityCondition[];
  exemptions: string[];
  grandfathering: string[];
  historicalMeasurementYears: string[];
};

export type CausalDesignOption = {
  id: string;
  methodLibraryEntryId: CausalMethodLibraryEntry["id"];
  family: CausalMethodLibraryEntry["family"];
  label: string;
  status: Exclude<CausalDesignStatus, "selected_for_review">;
  treatmentDefinition: string;
  comparisonDefinition: string | null;
  assignmentUnit: string;
  analysisUnit: string;
  timingDefinition: string;
  estimand: string;
  factualVariation: string;
  supportingEvidence: CausalDesignEvidenceLink[];
  identifyingAssumptions: string[];
  importantThreats: string[];
  missingPrerequisites: string[];
  dataRequirements: string[];
  unsupportedClaims: string[];
  eligibilityRule: StructuredEligibilityRule | null;
  optionFingerprint: string;
};

export type CausalMethodExclusion = {
  methodLibraryEntryId: CausalMethodLibraryEntry["id"];
  reason: string;
  relatedClaimIds: string[];
};

export type CausalDesignSet = {
  schemaVersion: typeof SIX_SCREEN_CAUSAL_DESIGN_SET_VERSION;
  snapshotId: string;
  ordinal: number;
  binding: {
    studyRevision: number;
    identityFingerprint: string;
    eventCardReference: PolicyEventCardReference;
  };
  studyQuestion: string;
  population: string;
  geography: string[];
  outcome: string;
  studyPeriod: { start: string; end: string };
  analysisUnit: string;
  input: CausalComparisonInput;
  methodLibraryVersion: typeof SIX_SCREEN_CAUSAL_METHOD_LIBRARY_VERSION;
  options: CausalDesignOption[];
  excludedMethods: CausalMethodExclusion[];
  status: "options_available" | "no_supported_option";
  semanticExplanation: {
    status: "blocked";
    reason: "genuine_intelligence_path_unverified";
  };
  createdAt: string;
  designSetFingerprint: string;
};

export type SelectedCausalDesign = Omit<CausalDesignOption, "status"> & {
  status: "selected_for_review";
  sourceOptionStatus: Exclude<CausalDesignStatus, "selected_for_review">;
  snapshotId: string;
  selectedAt: string;
  selectionRationale: string;
  selectedDesignFingerprint: string;
};

export type CausalDesignDecision = {
  schemaVersion: typeof SIX_SCREEN_CAUSAL_DESIGN_DECISION_VERSION;
  snapshotId: string;
  designSetSnapshotId: string;
  designSetFingerprint: string;
  eventCardSnapshotId: string;
  studyRevision: number;
  actor: "researcher";
  decision: "selected" | "no_selection";
  selectedOptionId: string | null;
  selectedDesign: SelectedCausalDesign | null;
  rationale: string;
  decidedAt: string;
  decisionFingerprint: string;
};

type DesignSetBody = Omit<CausalDesignSet, "designSetFingerprint">;
type DesignDecisionBody = Omit<CausalDesignDecision, "decisionFingerprint">;
type DesignOptionBody = Omit<CausalDesignOption, "optionFingerprint">;

function serializedBytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireCanonicalText(value: string, label: string, max = 4_000) {
  if (!value || value !== value.trim() || value.length > max) {
    throw new Error(`${label} must be non-empty canonical text of at most ${max} characters.`);
  }
  return value;
}

function requireNullableCanonicalText(
  value: string | null,
  label: string,
  max = 4_000,
) {
  if (value !== null) requireCanonicalText(value, label, max);
  return value;
}

function requireCanonicalTextList(
  values: readonly string[],
  label: string,
  maxEntries = 24,
) {
  if (
    values.length > maxEntries ||
    new Set(values).size !== values.length
  ) {
    throw new Error(`${label} must be a bounded unique list.`);
  }
  values.forEach((value) => requireCanonicalText(value, label, 500));
  return values;
}

function stableId(prefix: string, value: unknown) {
  return `${prefix}-${fingerprintSixScreenValue(value).slice("fnv1a64:".length)}`;
}

function inputBody(input: CausalComparisonInput) {
  const {
    inputFingerprint: _fingerprint,
    schemaVersion: _schemaVersion,
    ...body
  } = input;
  return body;
}

function optionBody(option: CausalDesignOption) {
  const { optionFingerprint: _fingerprint, ...body } = option;
  return body;
}

function designSetBody(designSet: CausalDesignSet) {
  const { designSetFingerprint: _fingerprint, ...body } = designSet;
  return body;
}

function decisionBody(decision: CausalDesignDecision) {
  const { decisionFingerprint: _fingerprint, ...body } = decision;
  return body;
}

function selectedDesignBody(design: SelectedCausalDesign) {
  const { selectedDesignFingerprint: _fingerprint, ...body } = design;
  return body;
}

export function createCausalComparisonInput(input: Omit<
  CausalComparisonInput,
  "schemaVersion" | "inputFingerprint"
>): CausalComparisonInput {
  if (![
    "full_policy_package",
    "policy_component",
    "legal_eligibility",
    "actual_compliance",
    "other_defined_exposure",
  ].includes(input.policyTarget)) {
    throw new Error("Screen 3 policy target is invalid.");
  }
  const needsDetail = input.policyTarget === "policy_component" ||
    input.policyTarget === "other_defined_exposure";
  if (needsDetail && input.targetDetail === null) {
    throw new Error("This Screen 3 policy target requires an explicit definition.");
  }
  if (!needsDetail && input.targetDetail !== null) {
    throw new Error("This Screen 3 policy target must not retain an unrelated target detail.");
  }
  requireNullableCanonicalText(input.targetDetail, "Screen 3 target detail");
  if (!input.targetClaimIds.length || !input.variationClaimIds.length) {
    throw new Error("Screen 3 requires explicit target and variation evidence selections.");
  }
  requireCanonicalTextList(input.targetClaimIds, "Screen 3 target claim ids");
  requireCanonicalTextList(input.variationClaimIds, "Screen 3 variation claim ids");
  input.targetClaimIds.forEach((value) =>
    requireBoundedIdentifier(value, "Screen 3 target claim id"));
  input.variationClaimIds.forEach((value) =>
    requireBoundedIdentifier(value, "Screen 3 variation claim id"));
  requireCanonicalText(input.assignmentUnit, "Screen 3 assignment unit", 500);
  requireNullableCanonicalText(
    input.proposedTreatedGroup,
    "Screen 3 proposed treated group",
  );
  requireNullableCanonicalText(
    input.proposedComparisonGroup,
    "Screen 3 proposed comparison group",
  );
  if (
    input.proposedTreatedGroup && input.proposedComparisonGroup &&
    input.proposedTreatedGroup === input.proposedComparisonGroup
  ) {
    throw new Error("Screen 3 treated and comparison groups must be distinct.");
  }
  if (![
    "not_assessed",
    "available",
    "partially_available",
    "unavailable",
  ].includes(input.dataAvailability)) {
    throw new Error("Screen 3 data availability is invalid.");
  }
  requireNullableCanonicalText(input.dataFrequency, "Screen 3 data frequency", 500);
  requireCanonicalTextList(
    input.historicalEligibilityFields,
    "Screen 3 historical eligibility fields",
    20,
  );
  requireCanonicalTextList(
    input.designConstraints,
    "Screen 3 design constraints",
    20,
  );
  const body = {
    schemaVersion: SIX_SCREEN_CAUSAL_COMPARISON_INPUT_VERSION,
    ...structuredClone(input),
  };
  return {
    ...body,
    inputFingerprint: fingerprintSixScreenValue(body),
  };
}

export function validateCausalComparisonInput(input: CausalComparisonInput) {
  const recreated = createCausalComparisonInput(inputBody(input));
  if (
    input.schemaVersion !== SIX_SCREEN_CAUSAL_COMPARISON_INPUT_VERSION ||
    input.inputFingerprint !== recreated.inputFingerprint
  ) {
    throw new Error("Screen 3 comparison input fingerprint is invalid.");
  }
  return input;
}

function usableClaim(claim: PolicyEventCardClaimReview) {
  return claim.decision === "accepted" || claim.decision === "provisional" ||
    claim.decision === "corrected";
}

function selectedClaims(
  eventCard: PolicyReviewedEventCard,
  ids: readonly string[],
  label: string,
) {
  const byId = new Map(eventCard.claims.map((claim) => [claim.claimId, claim]));
  return ids.map((id) => {
    const claim = byId.get(id);
    if (!claim || !usableClaim(claim)) {
      throw new Error(`${label} references a claim that is not available for downstream use.`);
    }
    return claim;
  });
}

function evidenceLink(claim: PolicyEventCardClaimReview): CausalDesignEvidenceLink {
  return {
    claimId: claim.claimId,
    predicate: claim.predicate,
    statement: claim.effectiveStatement,
    decision: claim.decision,
    statementOrigin: claim.statementOrigin,
    supportStatus: claim.supportStatus,
    passageIds: [...new Set(claim.lineages.map(({ passageId }) => passageId))]
      .sort(),
    documentVersionIds: [
      ...new Set(claim.lineages.map(({ documentVersionId }) => documentVersionId)),
    ].sort(),
    sourceIds: [...new Set(claim.lineages.map(({ sourceId }) => sourceId))]
      .sort(),
    conflictIds: [...new Set(claim.conflictIds)].sort(),
  };
}

function textArray(value: unknown, maxEntries = 24) {
  if (
    !Array.isArray(value) || value.length > maxEntries ||
    value.some((entry) => typeof entry !== "string" || !entry.trim() ||
      entry !== entry.trim() || entry.length > 500) ||
    new Set(value).size !== value.length
  ) return null;
  return value as string[];
}

function eligibilityCondition(value: unknown): StructuredEligibilityCondition | null {
  if (!isRecord(value)) return null;
  const kind = value.kind;
  const operator = value.operator;
  const conditionValue = value.value;
  if (
    typeof value.id !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u.test(value.id) ||
    (kind !== "threshold" && kind !== "categorical" && kind !== "other") ||
    typeof value.description !== "string" || !value.description.trim() ||
    value.description !== value.description.trim() ||
    typeof value.variable !== "string" || !value.variable.trim() ||
    value.variable !== value.variable.trim() ||
    !(["gt", "gte", "lt", "lte", "eq", null] as unknown[]).includes(operator) ||
    !(typeof conditionValue === "string" || typeof conditionValue === "boolean" ||
      (typeof conditionValue === "number" && Number.isFinite(conditionValue))) ||
    !(value.unit === null || typeof value.unit === "string") ||
    !(value.referencePeriod === null || typeof value.referencePeriod === "string")
  ) return null;
  if (
    kind === "threshold" &&
    (!(typeof conditionValue === "number") || operator === null || operator === "eq")
  ) return null;
  if (kind !== "threshold" && typeof conditionValue === "number") return null;
  const condition = structuredClone(value) as StructuredEligibilityCondition;
  try {
    requireNullableCanonicalText(condition.unit, "Eligibility condition unit", 200);
    requireNullableCanonicalText(
      condition.referencePeriod,
      "Eligibility condition reference period",
      200,
    );
  } catch {
    return null;
  }
  return condition;
}

export function parseStructuredEligibilityRule(
  value: unknown,
): StructuredEligibilityRule | null {
  if (
    !isRecord(value) ||
    value.schemaVersion !== "policy-eligibility-rule-v1" ||
    value.complete !== true ||
    (value.logic !== "all" && value.logic !== "any") ||
    typeof value.assignmentUnit !== "string" ||
    !value.assignmentUnit.trim() ||
    value.assignmentUnit !== value.assignmentUnit.trim() ||
    !Array.isArray(value.conditions) || !value.conditions.length ||
    value.conditions.length > 16
  ) return null;
  const conditions = value.conditions.map(eligibilityCondition);
  if (conditions.some((condition) => condition === null)) return null;
  const ids = conditions.map((condition) => condition!.id);
  if (new Set(ids).size !== ids.length) return null;
  const exemptions = textArray(value.exemptions);
  const grandfathering = textArray(value.grandfathering);
  const historicalMeasurementYears = textArray(value.historicalMeasurementYears);
  if (!exemptions || !grandfathering || !historicalMeasurementYears) return null;
  return {
    schemaVersion: "policy-eligibility-rule-v1",
    complete: true,
    logic: value.logic,
    assignmentUnit: value.assignmentUnit,
    conditions: conditions as StructuredEligibilityCondition[],
    exemptions,
    grandfathering,
    historicalMeasurementYears,
  };
}

function targetLabel(input: CausalComparisonInput) {
  if (input.policyTarget === "full_policy_package") return "the full policy package";
  if (input.policyTarget === "policy_component") return input.targetDetail!;
  if (input.policyTarget === "legal_eligibility") return "legal eligibility for the policy";
  if (input.policyTarget === "actual_compliance") return "actual policy compliance";
  return input.targetDetail!;
}

function reviewedVariationSummary(claims: readonly PolicyEventCardClaimReview[]) {
  return claims.map(({ effectiveStatement }) => effectiveStatement).join(" ");
}

function commonDataRequirements(input: {
  study: StudyContext;
  comparison: CausalComparisonInput;
}) {
  return [
    `A stable identifier for each ${input.study.analysisUnit}.`,
    `Repeated ${input.comparison.dataFrequency ?? "time-indexed"} observations before and after the chosen policy clock.`,
    `A consistently measured ${input.study.outcome} outcome.`,
    `Historical variables needed to reproduce reviewed coverage, exclusions, and treatment versions without converting missing values to nonexposure.`,
  ];
}

function statusFor(input: {
  institutional: readonly string[];
  data: readonly string[];
  unsupported?: boolean;
}): Exclude<CausalDesignStatus, "selected_for_review"> {
  if (input.unsupported) return "not_supported_by_current_variation";
  if (input.institutional.length) return "needs_institutional_review";
  if (input.data.length) return "needs_data";
  return "conditional";
}

function unresolvedCoverage(eventCard: PolicyReviewedEventCard) {
  return eventCard.unresolvedRequirements.filter(({ kind }) =>
    kind === "coverage" || kind === "exemption" ||
    kind === "operative_change" || kind === "version"
  );
}

function unresolvedSelectedConflicts(
  eventCard: PolicyReviewedEventCard,
  claims: readonly PolicyEventCardClaimReview[],
) {
  const selectedClaimIds = new Set(claims.map(({ claimId }) => claimId));
  return eventCard.conflicts.filter((conflict) =>
    conflict.resolution === null &&
    conflict.claimIds.some((claimId) => selectedClaimIds.has(claimId))
  );
}

function selectedClockDescription(eventCard: PolicyReviewedEventCard) {
  if (eventCard.treatmentClock.mode === "no_selection") {
    return "No treatment clock was selected in Screen 2; every calendar implementation remains conditional.";
  }
  const timing = eventCard.treatmentClock.candidate.timing;
  const date = timing.mode === "absolute"
    ? timing.start
    : timing.mode === "relative"
      ? `${timing.offsetDays} days after ${timing.anchorStage ?? "an unresolved anchor"}`
      : "an unresolved date";
  return `${eventCard.treatmentClock.candidate.label} (${date}) was selected for review; it remains a policy-stage clock rather than proof of unit-level treatment.`;
}

function makeOption(body: DesignOptionBody): CausalDesignOption {
  return {
    ...body,
    optionFingerprint: fingerprintSixScreenValue(body),
  };
}

function didOption(input: {
  comparison: CausalComparisonInput;
  study: StudyContext;
  eventCard: PolicyReviewedEventCard;
  targetClaims: PolicyEventCardClaimReview[];
  variationClaims: PolicyEventCardClaimReview[];
}) {
  const coverageClaims = input.variationClaims.filter(({ predicate }) =>
    predicate === "coverage_condition" || predicate === "exemption_rule"
  );
  if (!coverageClaims.length) return null;
  const evidenceClaims = [...new Map(
    [...input.targetClaims, ...coverageClaims].map((claim) => [claim.claimId, claim]),
  ).values()];
  const institutional: string[] = [];
  const data: string[] = [];
  if (!input.comparison.proposedTreatedGroup) {
    institutional.push("Define the proposed treated group without inferring sample membership from policy text.");
  }
  if (!input.comparison.proposedComparisonGroup) {
    institutional.push("Define a proposed comparison group and explain why it could supply the counterfactual trend.");
  }
  if (input.eventCard.treatmentClock.mode === "no_selection") {
    institutional.push("Select or justify a study treatment clock; Screen 2 explicitly retained no clock selection.");
  }
  const unresolved = unresolvedCoverage(input.eventCard);
  if (unresolved.length) {
    institutional.push(
      `Resolve or carry forward ${unresolved.map(({ kind }) => kind).join(", ")} evidence conditions that affect assignment.`,
    );
  }
  if (evidenceClaims.some(({ decision }) => decision === "provisional")) {
    institutional.push("One or more factual premises remain provisional in the reviewed Event Card.");
  }
  if (evidenceClaims.some(({ statementOrigin }) =>
    statementOrigin === "researcher_supplied")) {
    institutional.push("A researcher-supplied correction is not source verification and requires institutional review.");
  }
  const conflicts = unresolvedSelectedConflicts(input.eventCard, evidenceClaims);
  if (conflicts.length) {
    institutional.push(
      `Resolve or explicitly carry forward selected evidence conflict${conflicts.length === 1 ? "" : "s"}: ${conflicts.map(({ id }) => id).join(", ")}.`,
    );
  }
  if (
    input.comparison.dataAvailability !== "available" &&
    input.comparison.dataAvailability !== "partially_available"
  ) data.push("Establish whether repeated outcome and assignment data are available.");
  if (!input.comparison.dataFrequency) {
    data.push("Specify the outcome and assignment-data frequency.");
  }
  if (!input.comparison.historicalEligibilityFields.length) {
    data.push("Identify historical fields needed to reconstruct policy coverage before treatment.");
  }
  if (input.comparison.policyTarget === "actual_compliance") {
    data.push("Observe actual compliance separately from statutory coverage.");
  }
  if (input.comparison.policyTarget === "policy_component") {
    institutional.push("Show variation that changes the named component independently; different implementation dates alone do not identify component effects.");
  }
  const treatment = input.comparison.proposedTreatedGroup ??
    "Treated group not yet defined";
  const comparison = input.comparison.proposedComparisonGroup;
  const body: DesignOptionBody = {
    id: stableId("design-option-did", {
      target: input.comparison.inputFingerprint,
      claims: evidenceClaims.map(({ claimId }) => claimId),
    }),
    methodLibraryEntryId: "did-reviewed-v1",
    family: "difference_in_differences",
    label: "Coverage-based change-over-time comparison",
    status: statusFor({ institutional, data }),
    treatmentDefinition:
      `${treatment}, for ${targetLabel(input.comparison)} as defined by the selected reviewed claims.`,
    comparisonDefinition: comparison
      ? `${comparison}, subject to review for policy exposure, anticipation, and spillovers.`
      : null,
    assignmentUnit: input.comparison.assignmentUnit,
    analysisUnit: input.study.analysisUnit!,
    timingDefinition: selectedClockDescription(input.eventCard),
    estimand:
      `The change in ${input.study.outcome} for the proposed treated group relative to the proposed comparison group around the reviewed clock, conditional on the stated counterfactual assumptions.`,
    factualVariation: reviewedVariationSummary(coverageClaims),
    supportingEvidence: evidenceClaims.map(evidenceLink),
    identifyingAssumptions: [
      "Absent the policy exposure, treated and comparison units would have followed sufficiently comparable outcome trends over the study window.",
      "Anticipation is absent or explicitly modeled relative to the selected information, legal, compliance, or implementation clock.",
      "The proposed comparison is not materially exposed through the same policy, spillovers, substitute rules, or selective sorting.",
      "Coverage and treatment versions are measured from the appropriate historical period rather than current values.",
    ],
    importantThreats: [
      "Differential pre-policy trends or changing composition",
      "Policy anticipation and phased implementation",
      "Comparator exposure, spillovers, or concurrent institutions",
      "Unknown eligibility, exemptions, grandfathering, or treatment-version differences",
    ],
    missingPrerequisites: [...new Set([...institutional, ...data])],
    dataRequirements: commonDataRequirements({
      study: input.study,
      comparison: input.comparison,
    }),
    unsupportedClaims: [
      "The reviewed policy sources do not establish parallel trends or exogeneity.",
      "Selecting this option does not show that the proposed groups are comparable or that the policy caused an outcome change.",
      input.comparison.policyTarget === "policy_component"
        ? "Calendar separation between provisions does not by itself identify a component-specific effect."
        : "This contrast does not identify effects outside its reviewed population, exposure definition, period, and assumptions.",
    ],
    eligibilityRule: null,
  };
  return makeOption(body);
}

function thresholdOption(input: {
  comparison: CausalComparisonInput;
  study: StudyContext;
  eventCard: PolicyReviewedEventCard;
  targetClaims: PolicyEventCardClaimReview[];
  variationClaims: PolicyEventCardClaimReview[];
}) {
  const candidates = input.variationClaims.flatMap((claim) => {
    const rule = claim.statementOrigin === "evidence_claim" &&
        claim.supportStatus === "direct"
      ? parseStructuredEligibilityRule(claim.effectiveTypedValue)
      : null;
    return rule ? [{ claim, rule }] : [];
  });
  if (candidates.length !== 1) return null;
  const { claim: ruleClaim, rule } = candidates[0]!;
  const thresholds = rule.conditions.filter(({ kind }) => kind === "threshold");
  if (thresholds.length !== 1) return null;
  const threshold = thresholds[0]!;
  const evidenceClaims = [...new Map(
    [...input.targetClaims, ruleClaim].map((claim) => [claim.claimId, claim]),
  ).values()];
  const institutional: string[] = [];
  const data: string[] = [];
  if (input.eventCard.treatmentClock.mode === "no_selection") {
    institutional.push("Select or justify a study treatment clock; eligibility and time remain separate dimensions.");
  }
  if (rule.assignmentUnit !== input.comparison.assignmentUnit) {
    institutional.push(
      `Reconcile the reviewed rule's assignment unit (${rule.assignmentUnit}) with the proposed assignment unit (${input.comparison.assignmentUnit}).`,
    );
  }
  if (rule.logic === "any" && rule.conditions.length > 1) {
    data.push("Identify and exclude or model units covered by alternative OR conditions on both sides of the cutoff.");
  }
  if (rule.conditions.length > 1) {
    data.push("Measure every nonthreshold eligibility condition and restrict or classify units using the complete rule.");
  }
  if (rule.exemptions.length) {
    data.push("Measure every retained exemption before assigning cutoff-based eligibility.");
  }
  if (rule.grandfathering.length) {
    data.push("Measure grandfathered status using the policy's historical rule.");
  }
  if (rule.historicalMeasurementYears.length) {
    data.push(
      `Use the reviewed historical measurement period (${rule.historicalMeasurementYears.join(", ")}) rather than current values.`,
    );
  }
  if (!input.comparison.historicalEligibilityFields.includes(threshold.variable)) {
    data.push(`Provide the historical ${threshold.variable} assignment variable.`);
  }
  if (
    input.comparison.dataAvailability !== "available" &&
    input.comparison.dataAvailability !== "partially_available"
  ) data.push("Establish whether unit-level running-variable and outcome data are available.");
  if (!input.comparison.dataFrequency) data.push("Specify the outcome-data frequency.");
  if (evidenceClaims.some(({ decision }) => decision === "provisional")) {
    institutional.push("One or more factual premises remain provisional in the reviewed Event Card.");
  }
  const conflicts = unresolvedSelectedConflicts(input.eventCard, evidenceClaims);
  if (conflicts.length) {
    institutional.push(
      `Resolve or explicitly carry forward selected evidence conflict${conflicts.length === 1 ? "" : "s"}: ${conflicts.map(({ id }) => id).join(", ")}.`,
    );
  }
  if (unresolvedCoverage(input.eventCard).length) {
    institutional.push("Resolve or explicitly carry the remaining coverage, exemption, operative-change, or version gaps.");
  }
  if (input.comparison.policyTarget === "policy_component") {
    institutional.push("Establish that crossing the cutoff changes the named component rather than only package eligibility.");
  }
  if (input.comparison.policyTarget === "actual_compliance") {
    data.push("Establish a discontinuous first stage in actual compliance and the additional assumptions needed for a receipt-of-treatment estimand.");
  }
  const operator = { gt: ">", gte: "≥", lt: "<", lte: "≤", eq: "=" }[
    threshold.operator!
  ];
  const cutoff = `${threshold.variable} ${operator} ${String(threshold.value)}${
    threshold.unit ? ` ${threshold.unit}` : ""
  }`;
  const body: DesignOptionBody = {
    id: stableId("design-option-threshold", {
      target: input.comparison.inputFingerprint,
      claimId: ruleClaim.claimId,
      threshold,
    }),
    methodLibraryEntryId: "threshold-reviewed-v1",
    family: "threshold_eligibility",
    label: "Local eligibility-cutoff comparison",
    status: statusFor({ institutional, data }),
    treatmentDefinition:
      `Units locally on the policy-eligible side of ${cutoff}, after applying every reviewed condition, exemption, grandfathering rule, and historical reference period.`,
    comparisonDefinition:
      `Otherwise comparable units locally on the ineligible side of ${cutoff}, after the same complete-rule classification.`,
    assignmentUnit: input.comparison.assignmentUnit,
    analysisUnit: input.study.analysisUnit!,
    timingDefinition: selectedClockDescription(input.eventCard),
    estimand: input.comparison.policyTarget === "actual_compliance"
      ? `A local effect of eligibility on ${input.study.outcome}; a local effect of actual compliance would require a verified first stage and additional fuzzy-design assumptions.`
      : `The local effect of policy eligibility at the reviewed cutoff on ${input.study.outcome}, for units near the cutoff that satisfy the rest of the assignment rule.`,
    factualVariation: ruleClaim.effectiveStatement,
    supportingEvidence: evidenceClaims.map(evidenceLink),
    identifyingAssumptions: [
      "The complete reviewed rule actually changes eligibility at the cutoff for the analyzed local population.",
      "Potential outcomes and relevant covariates are sufficiently continuous through the cutoff absent the eligibility change.",
      "Units cannot precisely manipulate the assignment variable or other rule inputs around the cutoff.",
      "No other institutional change creates a coincident discontinuity at the same threshold.",
    ],
    importantThreats: [
      "Alternative AND/OR coverage routes or exemptions that leave treatment unchanged at the cutoff",
      "Manipulation, sorting, heaping, or administrative discretion around the threshold",
      "Too few observations or weak common support near the cutoff",
      "A discontinuity in eligibility without a discontinuity in actual compliance",
    ],
    missingPrerequisites: [...new Set([...institutional, ...data])],
    dataRequirements: [
      ...commonDataRequirements({ study: input.study, comparison: input.comparison }),
      `The pre-treatment ${threshold.variable} running variable with enough observations on both sides of ${String(threshold.value)}.`,
      "Every other eligibility condition, exemption, grandfathering status, and version needed to evaluate the complete rule as true, false, or unknown.",
    ],
    unsupportedClaims: [
      "The existence of the cutoff does not establish local random assignment, continuity, nonmanipulation, or sufficient sample density.",
      "Unknown rule inputs cannot be coded as ineligible or unexposed.",
      input.comparison.policyTarget === "actual_compliance"
        ? "Eligibility is not actual compliance; a receipt-of-treatment effect is unsupported without a first stage and additional assumptions."
        : "A local eligibility estimand does not establish the average effect of the full policy on all covered units.",
    ],
    eligibilityRule: structuredClone(rule),
  };
  return makeOption(body);
}

function requireStudyForScreen3(study: StudyContext) {
  const missing: string[] = [];
  if (!study.population) missing.push("population");
  if (!study.analysisUnit) missing.push("analysis unit");
  if (!study.geography.length) missing.push("geography");
  if (!study.outcome) missing.push("outcome");
  if (!study.period.start || !study.period.end) missing.push("study period");
  if (!study.initialExplanation) missing.push("intended policy-effect question");
  if (missing.length) {
    throw new Error(`Screen 3 study prerequisites are incomplete: ${missing.join(", ")}.`);
  }
  return study as StudyContext & {
    population: string;
    analysisUnit: string;
    outcome: string;
    initialExplanation: string;
    period: { start: string; end: string };
  };
}

export function createCausalDesignSet(input: {
  snapshotId: string;
  ordinal: number;
  comparisonInput: CausalComparisonInput;
  study: StudyContext;
  confirmedShock: ConfirmedShock;
  eventCard: PolicyReviewedEventCard;
  eventCardReview: Parameters<typeof createPolicyEventCardReference>[0]["review"];
  createdAt: string;
}): CausalDesignSet {
  requireBoundedIdentifier(input.snapshotId, "Causal design set snapshot id");
  requireCanonicalInstant(input.createdAt, "Causal design set createdAt");
  if (!Number.isSafeInteger(input.ordinal) || input.ordinal < 1) {
    throw new Error("Causal design set ordinal is invalid.");
  }
  const study = requireStudyForScreen3(input.study);
  const comparison = validateCausalComparisonInput(input.comparisonInput);
  if (
    input.eventCardReview.lockedEventCard?.snapshotId !== input.eventCard.snapshotId ||
    input.eventCardReview.lockedEventCard.eventCardFingerprint !==
      input.eventCard.eventCardFingerprint ||
    input.eventCard.binding.identityFingerprint !==
      input.confirmedShock.identityFingerprint ||
    input.eventCard.binding.eventId !== input.confirmedShock.id
  ) {
    throw new Error("Screen 3 Event Card does not match the current confirmed policy.");
  }
  const targetClaims = selectedClaims(
    input.eventCard,
    comparison.targetClaimIds,
    "Screen 3 target evidence",
  );
  const variationClaims = selectedClaims(
    input.eventCard,
    comparison.variationClaimIds,
    "Screen 3 variation evidence",
  );
  const options = [
    didOption({
      comparison,
      study,
      eventCard: input.eventCard,
      targetClaims,
      variationClaims,
    }),
    thresholdOption({
      comparison,
      study,
      eventCard: input.eventCard,
      targetClaims,
      variationClaims,
    }),
  ].filter((option): option is CausalDesignOption => option !== null);
  const excludedMethods: CausalMethodExclusion[] = [];
  if (!options.some(({ family }) => family === "difference_in_differences")) {
    excludedMethods.push({
      methodLibraryEntryId: "did-reviewed-v1",
      reason:
        "The selected reviewed variation evidence contains no coverage or exemption distinction from which to construct a source-linked change-over-time comparison.",
      relatedClaimIds: comparison.variationClaimIds,
    });
  }
  if (!options.some(({ family }) => family === "threshold_eligibility")) {
    excludedMethods.push({
      methodLibraryEntryId: "threshold-reviewed-v1",
      reason:
        "No single selected direct evidence claim contains one complete structured eligibility rule with exactly one numeric cutoff and all other conditions and exclusions retained.",
      relatedClaimIds: comparison.variationClaimIds,
    });
  }
  const body: DesignSetBody = {
    schemaVersion: SIX_SCREEN_CAUSAL_DESIGN_SET_VERSION,
    snapshotId: input.snapshotId,
    ordinal: input.ordinal,
    binding: {
      studyRevision: study.revision,
      identityFingerprint: input.confirmedShock.identityFingerprint,
      eventCardReference: createPolicyEventCardReference({
        review: input.eventCardReview,
      }),
    },
    studyQuestion: study.initialExplanation,
    population: study.population,
    geography: [...study.geography],
    outcome: study.outcome,
    studyPeriod: structuredClone(study.period),
    analysisUnit: study.analysisUnit,
    input: structuredClone(comparison),
    methodLibraryVersion: SIX_SCREEN_CAUSAL_METHOD_LIBRARY_VERSION,
    options,
    excludedMethods,
    status: options.length ? "options_available" : "no_supported_option",
    semanticExplanation: {
      status: "blocked",
      reason: "genuine_intelligence_path_unverified",
    },
    createdAt: input.createdAt,
  };
  const designSet = {
    ...body,
    designSetFingerprint: fingerprintSixScreenValue(body),
  };
  validateCausalDesignSet(designSet);
  return designSet;
}

function validateEvidenceLink(link: CausalDesignEvidenceLink) {
  requireBoundedIdentifier(link.claimId, "Causal design evidence claim id");
  requireCanonicalText(link.predicate, "Causal design evidence predicate", 300);
  requireCanonicalText(link.statement, "Causal design evidence statement");
  requireCanonicalTextList(link.passageIds, "Causal design evidence passage ids");
  requireCanonicalTextList(
    link.documentVersionIds,
    "Causal design evidence document version ids",
  );
  requireCanonicalTextList(link.sourceIds, "Causal design evidence source ids");
  requireCanonicalTextList(link.conflictIds, "Causal design evidence conflict ids");
  [...link.passageIds, ...link.documentVersionIds, ...link.sourceIds].forEach(
    (id) => requireBoundedIdentifier(id, "Causal design evidence lineage id"),
  );
  link.conflictIds.forEach((id) =>
    requireBoundedIdentifier(id, "Causal design evidence conflict id"));
  if (
    link.decision !== "accepted" && link.decision !== "provisional" &&
    link.decision !== "corrected"
  ) {
    throw new Error("Causal design evidence retains an unusable review decision.");
  }
}

function validateOption(option: CausalDesignOption) {
  requireBoundedIdentifier(option.id, "Causal design option id");
  if (
    !INITIAL_CAUSAL_METHOD_LIBRARY.some(({ id }) =>
      id === option.methodLibraryEntryId) ||
    !CAUSAL_DESIGN_OPTION_STATUSES.includes(option.status) ||
    option.optionFingerprint !== fingerprintSixScreenValue(optionBody(option))
  ) throw new Error("Causal design option is invalid or changed.");
  [
    option.label,
    option.treatmentDefinition,
    option.assignmentUnit,
    option.analysisUnit,
    option.timingDefinition,
    option.estimand,
    option.factualVariation,
  ].forEach((value) => requireCanonicalText(value, "Causal design option text"));
  requireNullableCanonicalText(
    option.comparisonDefinition,
    "Causal design comparison definition",
  );
  if (!option.supportingEvidence.length) {
    throw new Error("Causal design option requires source-linked factual premises.");
  }
  option.supportingEvidence.forEach(validateEvidenceLink);
  for (const [label, values] of [
    ["assumptions", option.identifyingAssumptions],
    ["threats", option.importantThreats],
    ["missing prerequisites", option.missingPrerequisites],
    ["data requirements", option.dataRequirements],
    ["unsupported claims", option.unsupportedClaims],
  ] as const) requireCanonicalTextList(values, `Causal design ${label}`, 32);
  if (
    option.family === "threshold_eligibility" && !option.eligibilityRule ||
    option.family !== "threshold_eligibility" && option.eligibilityRule
  ) throw new Error("Causal design threshold rule does not match its method family.");
  if (
    option.eligibilityRule &&
    !parseStructuredEligibilityRule(option.eligibilityRule)
  ) throw new Error("Causal design eligibility rule is invalid.");
}

export function validateCausalDesignSet(designSet: CausalDesignSet) {
  if (
    designSet.schemaVersion !== SIX_SCREEN_CAUSAL_DESIGN_SET_VERSION ||
    designSet.methodLibraryVersion !== SIX_SCREEN_CAUSAL_METHOD_LIBRARY_VERSION ||
    designSet.designSetFingerprint !==
      fingerprintSixScreenValue(designSetBody(designSet)) ||
    !Number.isSafeInteger(designSet.ordinal) || designSet.ordinal < 1 ||
    designSet.options.length > 3 ||
    new Set(designSet.options.map(({ id }) => id)).size !== designSet.options.length ||
    designSet.status !== (designSet.options.length
      ? "options_available"
      : "no_supported_option")
  ) throw new Error("Causal design set is invalid or changed.");
  requireBoundedIdentifier(designSet.snapshotId, "Causal design set snapshot id");
  requireFingerprint(
    designSet.binding.identityFingerprint,
    "Causal design set identity fingerprint",
  );
  requireCanonicalInstant(designSet.createdAt, "Causal design set createdAt");
  validateCausalComparisonInput(designSet.input);
  [
    designSet.studyQuestion,
    designSet.population,
    designSet.outcome,
    designSet.analysisUnit,
    designSet.studyPeriod.start,
    designSet.studyPeriod.end,
  ].forEach((value) => requireCanonicalText(value, "Causal design set study field"));
  requireCanonicalTextList(designSet.geography, "Causal design set geography", 20);
  if (
    designSet.semanticExplanation.status !== "blocked" ||
    designSet.semanticExplanation.reason !==
      "genuine_intelligence_path_unverified"
  ) throw new Error("Causal design set overstated semantic intelligence availability.");
  designSet.options.forEach(validateOption);
  if (
    designSet.excludedMethods.length > INITIAL_CAUSAL_METHOD_LIBRARY.length ||
    new Set(designSet.excludedMethods.map(({ methodLibraryEntryId }) =>
      methodLibraryEntryId)).size !== designSet.excludedMethods.length
  ) throw new Error("Causal method exclusions are invalid.");
  designSet.excludedMethods.forEach((excluded) => {
    if (!INITIAL_CAUSAL_METHOD_LIBRARY.some(({ id }) =>
      id === excluded.methodLibraryEntryId)) {
      throw new Error("Causal method exclusion names an unknown method.");
    }
    requireCanonicalText(excluded.reason, "Causal method exclusion reason");
    requireCanonicalTextList(
      excluded.relatedClaimIds,
      "Causal method exclusion claim ids",
    );
  });
  return designSet;
}

function makeSelectedDesign(input: {
  option: CausalDesignOption;
  snapshotId: string;
  selectedAt: string;
  rationale: string;
}): SelectedCausalDesign {
  const body = {
    ...structuredClone(input.option),
    status: "selected_for_review" as const,
    sourceOptionStatus: input.option.status,
    snapshotId: input.snapshotId,
    selectedAt: input.selectedAt,
    selectionRationale: input.rationale,
  };
  return {
    ...body,
    selectedDesignFingerprint: fingerprintSixScreenValue(body),
  };
}

export function createCausalDesignDecision(input: {
  snapshotId: string;
  designSet: CausalDesignSet;
  decision:
    | { mode: "selected"; optionId: string }
    | { mode: "no_selection"; optionId?: never };
  rationale: string;
  actor: "researcher_ui" | "model" | "system";
  decidedAt: string;
}): CausalDesignDecision {
  requireBoundedIdentifier(input.snapshotId, "Causal design decision snapshot id");
  requireCanonicalInstant(input.decidedAt, "Causal design decision decidedAt");
  requireCanonicalText(input.rationale, "Causal design decision rationale", 2_000);
  if (input.actor !== "researcher_ui") {
    throw new Error("Only an explicit researcher UI action can select a causal comparison.");
  }
  const designSet = validateCausalDesignSet(input.designSet);
  const option = input.decision.mode === "selected"
    ? designSet.options.find(({ id }) => id === input.decision.optionId)
    : null;
  if (input.decision.mode === "selected" && !option) {
    throw new Error("The selected causal comparison is not in the current design set.");
  }
  if (option?.status === "not_supported_by_current_variation") {
    throw new Error("A comparison unsupported by current variation cannot be selected.");
  }
  const selectedDesign = option
    ? makeSelectedDesign({
        option,
        snapshotId: `${input.snapshotId}-selected`,
        selectedAt: input.decidedAt,
        rationale: input.rationale,
      })
    : null;
  const body: DesignDecisionBody = {
    schemaVersion: SIX_SCREEN_CAUSAL_DESIGN_DECISION_VERSION,
    snapshotId: input.snapshotId,
    designSetSnapshotId: designSet.snapshotId,
    designSetFingerprint: designSet.designSetFingerprint,
    eventCardSnapshotId:
      designSet.binding.eventCardReference.eventCardSnapshotId,
    studyRevision: designSet.binding.studyRevision,
    actor: "researcher",
    decision: option ? "selected" : "no_selection",
    selectedOptionId: option?.id ?? null,
    selectedDesign,
    rationale: input.rationale,
    decidedAt: input.decidedAt,
  };
  const decision = {
    ...body,
    decisionFingerprint: fingerprintSixScreenValue(body),
  };
  validateCausalDesignDecision(decision, designSet);
  return decision;
}

export function validateCausalDesignDecision(
  decision: CausalDesignDecision,
  designSet: CausalDesignSet,
) {
  validateCausalDesignSet(designSet);
  if (
    decision.schemaVersion !== SIX_SCREEN_CAUSAL_DESIGN_DECISION_VERSION ||
    decision.actor !== "researcher" ||
    decision.designSetSnapshotId !== designSet.snapshotId ||
    decision.designSetFingerprint !== designSet.designSetFingerprint ||
    decision.eventCardSnapshotId !==
      designSet.binding.eventCardReference.eventCardSnapshotId ||
    decision.studyRevision !== designSet.binding.studyRevision ||
    decision.decisionFingerprint !==
      fingerprintSixScreenValue(decisionBody(decision))
  ) throw new Error("Causal design decision does not match its immutable design set.");
  requireBoundedIdentifier(decision.snapshotId, "Causal design decision snapshot id");
  requireCanonicalInstant(decision.decidedAt, "Causal design decision decidedAt");
  requireCanonicalText(decision.rationale, "Causal design decision rationale", 2_000);
  if (decision.decision === "no_selection") {
    if (decision.selectedOptionId !== null || decision.selectedDesign !== null) {
      throw new Error("A no-selection decision cannot retain a selected design.");
    }
    return decision;
  }
  const option = designSet.options.find(({ id }) =>
    id === decision.selectedOptionId);
  const selected = decision.selectedDesign;
  if (
    !option || !selected ||
    option.status === "not_supported_by_current_variation" ||
    selected.status !== "selected_for_review" ||
    selected.sourceOptionStatus !== option.status ||
    selected.id !== option.id ||
    selected.optionFingerprint !== option.optionFingerprint ||
    selected.selectedDesignFingerprint !==
      fingerprintSixScreenValue(selectedDesignBody(selected))
  ) throw new Error("Selected causal design does not match the reviewed option.");
  requireBoundedIdentifier(selected.snapshotId, "Selected causal design snapshot id");
  requireCanonicalInstant(selected.selectedAt, "Selected causal design selectedAt");
  requireCanonicalText(
    selected.selectionRationale,
    "Selected causal design rationale",
    2_000,
  );
  return decision;
}

export function validateCausalDesignCollections(input: {
  designSets: readonly CausalDesignSet[];
  decisions: readonly CausalDesignDecision[];
}) {
  if (
    input.designSets.length > SIX_SCREEN_CAUSAL_DESIGN_MAX_REVISIONS ||
    input.decisions.length > SIX_SCREEN_CAUSAL_DESIGN_MAX_REVISIONS ||
    new Set(input.designSets.map(({ snapshotId }) => snapshotId)).size !==
      input.designSets.length ||
    new Set(input.decisions.map(({ snapshotId }) => snapshotId)).size !==
      input.decisions.length ||
    serializedBytes(input) > SIX_SCREEN_CAUSAL_DESIGN_MAX_BYTES
  ) throw new Error("Stored causal-comparison history is invalid or exceeds its bounded capacity.");
  const byId = new Map<string, CausalDesignSet>();
  let lastOrdinal = 0;
  for (const designSet of input.designSets) {
    validateCausalDesignSet(designSet);
    if (designSet.ordinal <= lastOrdinal) {
      throw new Error("Stored causal design set ordinals must increase.");
    }
    lastOrdinal = designSet.ordinal;
    byId.set(designSet.snapshotId, designSet);
  }
  const decidedSets = new Set<string>();
  for (const decision of input.decisions) {
    const designSet = byId.get(decision.designSetSnapshotId);
    if (!designSet || decidedSets.has(designSet.snapshotId)) {
      throw new Error("Stored causal design decision lineage is invalid.");
    }
    validateCausalDesignDecision(decision, designSet);
    decidedSets.add(designSet.snapshotId);
  }
  return input;
}
