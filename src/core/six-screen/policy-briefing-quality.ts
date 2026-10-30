import type {
  EvidenceRequirementStatus,
  PolicyBriefingBoxAssessment,
  PolicyBriefingQualityAssessment,
  PolicyEvidenceRequirementKind,
  PolicyReviewClaimProjection,
} from "./contracts";
import { isPolicyPageBoilerplateText } from "./policy-text-normalization";

type Requirement = {
  kind: PolicyEvidenceRequirementKind;
  status: EvidenceRequirementStatus;
};

const CLAIMS_BY_BOX = Object.freeze({
  overview: new Set<PolicyReviewClaimProjection["predicate"]>([
    "policy_explanation", "operative_change", "substantive_obligation",
    "coverage_condition", "legal_effect_date", "implementation_schedule",
  ]),
  what_changed: new Set<PolicyReviewClaimProjection["predicate"]>([
    "operative_change", "substantive_obligation", "previous_baseline",
    "historical_version_change", "contemporaneous_amendment_record",
  ]),
  coverage: new Set<PolicyReviewClaimProjection["predicate"]>([
    "coverage_condition", "territorial_nexus", "threshold_condition",
    "exemption_rule",
  ]),
  timeline: new Set<PolicyReviewClaimProjection["predicate"]>([
    "legal_effect_date", "policy_date", "implementation_schedule",
  ]),
  implementation_enforcement: new Set<PolicyReviewClaimProjection["predicate"]>([
    "implementation_schedule", "enforcement_authority", "remedy", "penalty",
  ]),
});

const REQUIREMENTS_BY_BOX = Object.freeze({
  overview: ["operative_change"] as const,
  what_changed: ["operative_change", "previous_baseline"] as const,
  coverage: ["coverage", "exemption"] as const,
  timeline: ["temporal_stage"] as const,
  implementation_enforcement: [
    "implementation", "enforcement", "penalty",
  ] as const,
});

function usefulClaim(claim: PolicyReviewClaimProjection) {
  const words = claim.statement.trim().split(/\s+/u).length;
  return claim.supportStatus === "direct" && words >= 4 &&
    !isPolicyPageBoilerplateText(claim.statement) &&
    !isPolicyPageBoilerplateText(claim.citation.exactText);
}

function requirementStatus(
  requirements: readonly Requirement[],
  kind: PolicyEvidenceRequirementKind,
) {
  return requirements.find((requirement) => requirement.kind === kind)?.status ??
    "not_yet_searched";
}

function requirementIsResolved(status: EvidenceRequirementStatus) {
  return status === "supported" || status === "not_applicable";
}

function requirementIsConflicting(status: EvidenceRequirementStatus) {
  return status === "conflicting";
}

function assessmentForBox(input: {
  box: keyof typeof CLAIMS_BY_BOX;
  claims: readonly PolicyReviewClaimProjection[];
  requirements: readonly Requirement[];
}): PolicyBriefingBoxAssessment {
  const kinds = [...REQUIREMENTS_BY_BOX[input.box]];
  const claims = input.claims.filter((claim) =>
    CLAIMS_BY_BOX[input.box].has(claim.predicate) && usefulClaim(claim));
  const missingRequirementKinds = kinds.filter((kind) =>
    !requirementIsResolved(requirementStatus(input.requirements, kind)));
  const conflicting = kinds.some((kind) =>
    requirementIsConflicting(requirementStatus(input.requirements, kind))) ||
    claims.some(({ supportStatus }) => supportStatus === "conflicting");

  const hasExplanation = claims.some(({ predicate }) =>
    predicate === "policy_explanation");
  const hasChange = claims.some(({ predicate }) =>
    predicate === "operative_change" || predicate === "substantive_obligation");
  const hasCoverage = claims.some(({ predicate }) =>
    predicate === "coverage_condition" || predicate === "territorial_nexus" ||
    predicate === "threshold_condition");
  const hasDate = claims.some((claim) => {
    if (!claim.typedValue || typeof claim.typedValue !== "object" ||
        Array.isArray(claim.typedValue)) return false;
    const value = claim.typedValue as Record<string, unknown>;
    if (typeof value.date === "string") return Boolean(value.date);
    return Boolean(value.date && typeof value.date === "object" &&
      !Array.isArray(value.date) &&
      typeof (value.date as Record<string, unknown>).start === "string");
  });
  const hasImplementationOrEnforcement = claims.some(({ predicate }) =>
    ["implementation_schedule", "enforcement_authority", "remedy", "penalty"]
      .includes(predicate));
  const supportedWords = new Set(claims.flatMap(({ statement }) =>
    statement.toLocaleLowerCase("en-US").match(/[\p{L}\p{N}]+/gu) ?? []))
    .size;

  const contentEnough = input.box === "overview"
    ? hasChange && supportedWords >= 55 &&
      (hasExplanation || hasCoverage || claims.length >= 3)
    : input.box === "what_changed"
      ? hasChange
      : input.box === "coverage"
        ? hasCoverage
        : input.box === "timeline"
          ? hasDate
          : hasImplementationOrEnforcement;
  const status: PolicyBriefingBoxAssessment["status"] = conflicting
    ? "conflicting"
    : !contentEnough
      ? claims.length ? "partial" : "missing"
      : missingRequirementKinds.length
        ? "partial"
        : "sufficient";
  const notes: Record<PolicyBriefingBoxAssessment["status"], string> = {
    sufficient: "The saved claims support this box and its required evidence checks.",
    partial: "Useful source-linked facts are available, but at least one material fact remains unresolved.",
    missing: "The reviewed sources do not yet support the core fact needed for this box.",
    conflicting: "The saved evidence contains a conflict that must remain visible to the researcher.",
  };
  return {
    box: input.box,
    status,
    supportingClaimIds: claims.map(({ claimId }) => claimId),
    missingRequirementKinds,
    note: notes[status],
  };
}

/** Assess information sufficiency independently for every Screen 2 box. */
export function assessPolicyBriefingQuality(input: {
  claims: readonly PolicyReviewClaimProjection[];
  requirements: readonly Requirement[];
  assessedAt: string;
}): PolicyBriefingQualityAssessment {
  const boxes = (Object.keys(CLAIMS_BY_BOX) as Array<keyof typeof CLAIMS_BY_BOX>)
    .map((box) => assessmentForBox({ ...input, box }));
  const critical = boxes.filter(({ box }) =>
    box === "overview" || box === "what_changed");
  const informative = boxes.filter(({ status }) =>
    status === "sufficient" || status === "partial");
  return {
    boxes,
    readyForSynthesis:
      critical.every(({ status }) => status === "sufficient" || status === "partial") &&
      informative.length >= 3 &&
      !boxes.some(({ status }) => status === "conflicting"),
    requiresAdditionalSources: boxes.some(({ status }) =>
      status !== "sufficient"),
    assessedAt: input.assessedAt,
  };
}
