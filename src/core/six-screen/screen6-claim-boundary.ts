import {
  fingerprintSixScreenValue,
  sameSixScreenValue,
} from "./canonical";
import {
  requireBoundedIdentifier,
  requireCanonicalInstant,
  requireFingerprint,
} from "./contracts";
import type { Screen6DiagnosticPlan } from "./screen6-diagnostic-plan";
import {
  latestScreen6DiagnosticResultsForPlan,
  reviewsForScreen6DiagnosticResults,
  type Screen6DiagnosticResult,
  type Screen6DiagnosticResultReview,
} from "./screen6-diagnostic-result";
import type {
  Screen6UncertaintyProfile,
  Screen6UncertaintyState,
} from "./screen6-uncertainty-profile";

export const SIX_SCREEN_CLAIM_BOUNDARY_INPUT_VERSION =
  "screen-06-claim-boundary-input-v1" as const;
export const SIX_SCREEN_CLAIM_BOUNDARY_VERSION =
  "screen-06-conditional-claim-boundary-v1" as const;
export const SIX_SCREEN_RESEARCH_DISPOSITION_VERSION =
  "screen-06-research-planning-disposition-v1" as const;

export const SIX_SCREEN_CLAIM_BOUNDARY_MAX_REVISIONS = 24;
export const SIX_SCREEN_RESEARCH_DISPOSITION_MAX_RECORDS = 24;
export const SIX_SCREEN_CLAIM_BOUNDARY_COLLECTION_MAX_BYTES = 3_000_000;

export const SCREEN6_CLAIM_LEVELS = [
  "package_effect",
  "component_specific_effect",
  "mechanism_specific_effect",
] as const;

export const SCREEN6_RESEARCH_DISPOSITIONS = [
  "proceed_with_documented_analysis_plan",
  "revise_specified_parts_first",
  "current_information_insufficient_for_intended_claim",
] as const;

export type Screen6ClaimLevel = (typeof SCREEN6_CLAIM_LEVELS)[number];
export type Screen6ResearchPlanningDispositionDecision =
  (typeof SCREEN6_RESEARCH_DISPOSITIONS)[number];

export type Screen6ClaimBoundaryInput = {
  schemaVersion: typeof SIX_SCREEN_CLAIM_BOUNDARY_INPUT_VERSION;
  intendedClaimLevel: Screen6ClaimLevel;
  targetDescription: string;
  inputFingerprint: string;
};

export type Screen6ClaimRelationship =
  | "matches_current_design_target"
  | "requires_stronger_identification"
  | "different_from_current_design_target"
  | "current_design_target_not_established";

export type Screen6DiagnosticStatus =
  | "planned"
  | "result_awaiting_researcher_review"
  | "concern_reduced_under_stated_assumptions"
  | "inconclusive"
  | "revision_needed";

export type Screen6ConditionalClaimBoundary = {
  schemaVersion: typeof SIX_SCREEN_CLAIM_BOUNDARY_VERSION;
  snapshotId: string;
  ordinal: number;
  previousBoundary: {
    snapshotId: string;
    boundaryFingerprint: string;
  } | null;
  binding: {
    profileSnapshotId: string;
    profileFingerprint: string;
    planSnapshotId: string;
    planFingerprint: string;
    resultHistoryLength: number;
    reviewHistoryLength: number;
    resultReferences: Array<{
      resultId: string;
      resultFingerprint: string;
      cardId: string;
    }>;
    reviewReferences: Array<{
      reviewId: string;
      reviewFingerprint: string;
      resultId: string;
    }>;
    lineageFingerprint: string;
  };
  input: Screen6ClaimBoundaryInput;
  currentDesignTarget: {
    status: "established" | "not_established";
    claimLevel: Exclude<Screen6ClaimLevel, "mechanism_specific_effect"> | null;
    policyTarget: Screen6DiagnosticPlan["designContext"]["policyTarget"];
    selectedDesignLabel: string | null;
    selectedDesignFamily:
      Screen6DiagnosticPlan["designContext"]["selectedDesignFamily"];
    basis: string;
  };
  claimLevels: Array<{
    claimLevel: Screen6ClaimLevel;
    relationshipToCurrentDesign: Screen6ClaimRelationship;
    assumptionsOrEvidenceRequired: string[];
  }>;
  intendedClaim: {
    claimLevel: Screen6ClaimLevel;
    targetDescription: string;
    relationshipToCurrentDesign: Screen6ClaimRelationship;
    prospectiveStatement: string;
    attributionCeiling: string;
    resultsAware: boolean;
  };
  diagnosticStatuses: Array<{
    cardId: string;
    libraryEntryId: Screen6DiagnosticPlan["cards"][number]["libraryEntryId"];
    label: string;
    blocking: boolean;
    status: Screen6DiagnosticStatus;
    resultId: string | null;
    reviewId: string | null;
    resultSummary: string | null;
    reviewReadinessGaps: string[];
    reviewRationale: string | null;
    followUpActions: string[];
  }>;
  dimensionStatuses: Array<{
    dimension: Screen6DiagnosticPlan["dimensions"][number]["dimension"];
    label: string;
    state: Screen6UncertaintyState;
    diagnosticCardIds: string[];
    basis: string[];
  }>;
  unassessedModules: Array<{
    module: Screen6UncertaintyProfile["upstreamModules"][number]["module"];
    availability: "partial" | "not_assessed";
    snapshotId: string | null;
    limitation: string;
  }>;
  unresolvedHighConsequenceIssues: Array<{
    code: string;
    source: "upstream" | "design" | "diagnostic_input" | "diagnostic" | "claim_target";
    message: string;
    cardId: string | null;
  }>;
  methodLibrary: Screen6DiagnosticPlan["methodLibrary"];
  researchPlanning: {
    dispositionStatus: "awaiting_researcher_disposition";
    automaticRecommendation: null;
  };
  preparation: {
    actor: "researcher";
    method: "deterministic_fixed_software";
    networkRequests: 0;
    modelCalls: 0;
    localRoutineCalls: 0;
  };
  nonOutputs: {
    causalCertification: "not_available";
    aggregateScore: null;
    universalBadge: null;
    automaticAttributionUpgrade: null;
    credibilityPlanExport: null;
    reportBundle: null;
    designRecord: null;
  };
  claimBoundary: string;
  createdAt: string;
  boundaryFingerprint: string;
};

export type Screen6ResearchPlanningDisposition = {
  schemaVersion: typeof SIX_SCREEN_RESEARCH_DISPOSITION_VERSION;
  id: string;
  ordinal: number;
  boundaryReference: {
    snapshotId: string;
    boundaryFingerprint: string;
    planSnapshotId: string;
    planFingerprint: string;
    intendedClaimLevel: Screen6ClaimLevel;
  };
  decision: Screen6ResearchPlanningDispositionDecision;
  rationale: string;
  specifiedRevisions: string[];
  retainedUnassessedModules: Array<{
    module: Screen6UncertaintyProfile["upstreamModules"][number]["module"];
    availability: "partial" | "not_assessed";
  }>;
  retainedHighConsequenceIssueCodes: string[];
  actor: "researcher";
  recommendationType: "research_planning_not_causal_certification";
  automaticDesignMutation: "none";
  attributionUpgrade: "none";
  causalCertification: "not_available";
  aggregateScore: null;
  universalBadge: null;
  credibilityPlanExport: null;
  reportBundle: null;
  designRecord: null;
  claimBoundary: string;
  decidedAt: string;
  dispositionFingerprint: string;
};

type ClaimInputDraft = Omit<
  Screen6ClaimBoundaryInput,
  "schemaVersion" | "inputFingerprint"
>;
type BoundaryBody = Omit<
  Screen6ConditionalClaimBoundary,
  "boundaryFingerprint"
>;
type DispositionBody = Omit<
  Screen6ResearchPlanningDisposition,
  "dispositionFingerprint"
>;

const BOUNDARY_DISCLOSURE =
  "This conditional boundary is a prospective research-planning statement derived from the current saved design, diagnostics, supplied results, and researcher reviews. It does not state that the policy caused an outcome, prove an identifying assumption, upgrade attribution after results, or provide an aggregate score, badge, certificate, CredibilityPlan export, report bundle, or Design Record.";
const DISPOSITION_DISCLOSURE =
  "This is the researcher's planning disposition for the recorded conditional claim boundary. It is not causal certification, does not resolve retained issues by itself, does not change the design automatically, and does not create a final CredibilityPlan, report bundle, or Design Record.";

function bytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function requireText(value: string, label: string, maximum = 4_000) {
  if (!value || value !== value.trim() || value.length > maximum) {
    throw new Error(
      `${label} must be non-empty canonical text within ${maximum} characters.`,
    );
  }
  return value;
}

function textList(
  values: readonly string[],
  label: string,
  maximumEntries: number,
  maximumText = 1_000,
) {
  if (
    values.length > maximumEntries ||
    new Set(values).size !== values.length
  ) throw new Error(`${label} must be a bounded unique list.`);
  values.forEach((value) => requireText(value, label, maximumText));
  return [...values];
}

function claimInputBody(input: Screen6ClaimBoundaryInput): ClaimInputDraft {
  const {
    schemaVersion: _schemaVersion,
    inputFingerprint: _inputFingerprint,
    ...body
  } = input;
  return body;
}

export function createScreen6ClaimBoundaryInput(
  input: ClaimInputDraft,
): Screen6ClaimBoundaryInput {
  if (!SCREEN6_CLAIM_LEVELS.includes(input.intendedClaimLevel)) {
    throw new Error("Screen 6 intended claim level is invalid.");
  }
  requireText(
    input.targetDescription,
    "Screen 6 intended target description",
    2_000,
  );
  const body = {
    intendedClaimLevel: input.intendedClaimLevel,
    targetDescription: input.targetDescription,
  } satisfies ClaimInputDraft;
  return {
    schemaVersion: SIX_SCREEN_CLAIM_BOUNDARY_INPUT_VERSION,
    ...body,
    inputFingerprint: fingerprintSixScreenValue(body),
  };
}

export function validateScreen6ClaimBoundaryInput(
  input: Screen6ClaimBoundaryInput,
) {
  const recreated = createScreen6ClaimBoundaryInput(claimInputBody(input));
  if (
    input.schemaVersion !== SIX_SCREEN_CLAIM_BOUNDARY_INPUT_VERSION ||
    !sameSixScreenValue(input, recreated)
  ) throw new Error("Screen 6 conditional-claim input is invalid.");
  requireFingerprint(
    input.inputFingerprint,
    "Screen 6 conditional-claim input fingerprint",
  );
  return input;
}

function currentDesignTarget(
  plan: Screen6DiagnosticPlan,
): Screen6ConditionalClaimBoundary["currentDesignTarget"] {
  const design = plan.designContext;
  if (design.status !== "selected") {
    return {
      status: "not_established",
      claimLevel: null,
      policyTarget: design.policyTarget,
      selectedDesignLabel: design.selectedDesignLabel,
      selectedDesignFamily: design.selectedDesignFamily,
      basis:
        "No current researcher-selected comparison establishes a package-effect or component-specific design target.",
    };
  }
  if (design.policyTarget === "policy_component") {
    return {
      status: "established",
      claimLevel: "component_specific_effect",
      policyTarget: design.policyTarget,
      selectedDesignLabel: design.selectedDesignLabel,
      selectedDesignFamily: design.selectedDesignFamily,
      basis:
        `The current researcher-selected ${design.selectedDesignFamily!.replaceAll("_", " ")} comparison targets a policy component. Independent component variation and every stated identifying assumption remain requirements.`,
    };
  }
  if ([
    "full_policy_package",
    "legal_eligibility",
    "actual_compliance",
  ].includes(design.policyTarget ?? "")) {
    return {
      status: "established",
      claimLevel: "package_effect",
      policyTarget: design.policyTarget,
      selectedDesignLabel: design.selectedDesignLabel,
      selectedDesignFamily: design.selectedDesignFamily,
      basis:
        `The current researcher-selected ${design.selectedDesignFamily!.replaceAll("_", " ")} comparison targets the policy package or its declared exposure. It does not separately identify a component or mechanism.`,
    };
  }
  return {
    status: "not_established",
    claimLevel: null,
    policyTarget: design.policyTarget,
    selectedDesignLabel: design.selectedDesignLabel,
    selectedDesignFamily: design.selectedDesignFamily,
    basis:
      "The selected comparison uses another researcher-defined exposure that this bounded layer cannot relabel as a package or component target.",
  };
}

function relationship(
  claimLevel: Screen6ClaimLevel,
  target: Screen6ConditionalClaimBoundary["currentDesignTarget"],
): Screen6ClaimRelationship {
  if (target.status !== "established" || target.claimLevel === null) {
    return "current_design_target_not_established";
  }
  if (claimLevel === target.claimLevel) return "matches_current_design_target";
  if (
    claimLevel === "mechanism_specific_effect" ||
    (target.claimLevel === "package_effect" &&
      claimLevel === "component_specific_effect")
  ) return "requires_stronger_identification";
  return "different_from_current_design_target";
}

function requirements(
  level: Screen6ClaimLevel,
): string[] {
  if (level === "package_effect") {
    return [
      "A current researcher-selected comparison whose treatment definition matches the policy package or declared package exposure.",
      "The saved counterfactual, timing, exposure, interference, competing-event, measurement, and inference assumptions remain explicit conditions rather than established facts.",
      "Any unresolved blocking diagnostic must remain in the interpretation and final claim limitation.",
    ];
  }
  if (level === "component_specific_effect") {
    return [
      "Independent variation in the named component rather than different dates or versions of an inseparable policy package.",
      "Source-supported component exposure and timing that distinguish the component from the rest of the package.",
      "A selected comparison and estimand whose treatment definition isolates that component.",
      "The package-effect identification requirements and all component-separability limitations remain explicit.",
    ];
  }
  return [
    "A current reviewed mechanism set with the intended pathway stated separately from rival, complementary, offsetting, and co-event explanations.",
    "Discriminating observations whose predicted patterns differ across the serious mechanisms.",
    "Valid temporal ordering and measurement of the intermediate process without treating a post-treatment association as harmless baseline evidence.",
    "Additional assumptions appropriate to mechanism or mediation attribution; evidence consistent with one pathway is not sufficient by itself.",
    "The package or component effect must first remain within the current selected design's supported target and stated identifying assumptions.",
  ];
}

function diagnosticStatuses(
  plan: Screen6DiagnosticPlan,
  results: readonly Screen6DiagnosticResult[],
  reviews: readonly Screen6DiagnosticResultReview[],
): Screen6ConditionalClaimBoundary["diagnosticStatuses"] {
  const resultsByCard = new Map(results.map((result) => [
    result.binding.cardId,
    result,
  ]));
  const reviewsByResult = new Map(reviews.map((review) => [
    review.resultReference.resultId,
    review,
  ]));
  return plan.cards.map((card) => {
    const result = resultsByCard.get(card.id) ?? null;
    const review = result ? reviewsByResult.get(result.id) ?? null : null;
    const status: Screen6DiagnosticStatus = !result
      ? "planned"
      : !review
      ? "result_awaiting_researcher_review"
      : review.decision === "concern_reduced"
      ? "concern_reduced_under_stated_assumptions"
      : review.decision;
    return {
      cardId: card.id,
      libraryEntryId: card.libraryEntryId,
      label: card.label,
      blocking: card.blocking,
      status,
      resultId: result?.id ?? null,
      reviewId: review?.id ?? null,
      resultSummary: result?.input.summary ?? null,
      reviewReadinessGaps: result ? [...result.reviewReadiness.gaps] : [],
      reviewRationale: review?.rationale ?? null,
      followUpActions: review ? [...review.followUpActions] : [],
    };
  });
}

function dimensionStatuses(
  plan: Screen6DiagnosticPlan,
  statuses: Screen6ConditionalClaimBoundary["diagnosticStatuses"],
): Screen6ConditionalClaimBoundary["dimensionStatuses"] {
  const statusByCard = new Map(statuses.map((status) => [status.cardId, status]));
  return plan.dimensions.map((dimension) => {
    const linked = dimension.diagnosticCardIds.flatMap((id) => {
      const status = statusByCard.get(id);
      return status ? [status] : [];
    });
    let state: Screen6UncertaintyState = dimension.state;
    if (linked.some(({ status }) => status === "revision_needed")) {
      state = "concern_detected";
    } else if (linked.some(({ status }) => status === "inconclusive")) {
      state = "inconclusive";
    } else if (linked.some(({ status }) =>
      status === "result_awaiting_researcher_review")) {
      state = "evidence_needed";
    } else if (
      linked.length > 0 &&
      linked.every(({ status }) =>
        status === "concern_reduced_under_stated_assumptions")
    ) {
      state = "concern_reduced_under_stated_assumptions";
    } else if (linked.length > 0) {
      state = "planned";
    }
    return {
      dimension: dimension.dimension,
      label: dimension.label,
      state,
      diagnosticCardIds: [...dimension.diagnosticCardIds],
      basis: linked.length
        ? linked.map(({ label, status }) =>
            `${label}: ${status.replaceAll("_", " ")}.`)
        : [...dimension.unresolvedLimitations],
    };
  });
}

function unassessedModules(
  profile: Screen6UncertaintyProfile,
): Screen6ConditionalClaimBoundary["unassessedModules"] {
  return profile.upstreamModules.flatMap((module) =>
    module.availability === "available"
      ? []
      : [{
          module: module.module,
          availability: module.availability,
          snapshotId: module.snapshotId,
          limitation: module.limitation ??
            "This upstream module has not been completed for the current Screen 6 lineage.",
        }]
  );
}

function unresolvedIssues(input: {
  profile: Screen6UncertaintyProfile;
  plan: Screen6DiagnosticPlan;
  intendedRelationship: Screen6ClaimRelationship;
  statuses: Screen6ConditionalClaimBoundary["diagnosticStatuses"];
}) {
  const issues: Screen6ConditionalClaimBoundary[
    "unresolvedHighConsequenceIssues"
  ] = [];
  const add = (
    code: string,
    source: Screen6ConditionalClaimBoundary[
      "unresolvedHighConsequenceIssues"
    ][number]["source"],
    message: string,
    cardId: string | null = null,
  ) => {
    if (!issues.some((issue) => issue.code === code)) {
      issues.push({ code, source, message, cardId });
    }
  };
  for (const gap of input.profile.gaps) {
    add(`profile:${gap.code}`, "upstream", gap.message);
  }
  if (input.plan.designContext.status !== "selected") {
    add(
      "design:no-current-selection",
      "design",
      "No current researcher-selected comparison establishes the intended estimand and target.",
    );
  }
  input.plan.methodSupport.issueList.forEach((message, index) =>
    add(`design:method-support:${index + 1}`, "design", message));
  input.plan.diagnosticInputGaps.forEach((message, index) =>
    add(
      `diagnostic-input:${index + 1}`,
      "diagnostic_input",
      message,
    ));
  for (const status of input.statuses) {
    if (
      status.blocking &&
      status.status !== "concern_reduced_under_stated_assumptions"
    ) {
      add(
        `diagnostic:${status.cardId}:${status.status}`,
        "diagnostic",
        `${status.label} is a blocking concern with status ${status.status.replaceAll("_", " ")}.`,
        status.cardId,
      );
    }
    if (!status.blocking && status.status === "revision_needed") {
      add(
        `diagnostic:${status.cardId}:revision-needed`,
        "diagnostic",
        `${status.label} requires a documented revision before the concern can be treated as reduced.`,
        status.cardId,
      );
    }
    if (status.reviewReadinessGaps.length) {
      add(
        `diagnostic:${status.cardId}:incomplete-context`,
        "diagnostic",
        `${status.label} retains incomplete interpretation context: ${status.reviewReadinessGaps.join(" ")}`,
        status.cardId,
      );
    }
  }
  if (input.intendedRelationship !== "matches_current_design_target") {
    add(
      `claim-target:${input.intendedRelationship}`,
      "claim_target",
      "The intended claim does not match a currently established design target and requires a revised target, stronger identification, or an insufficient-information disposition.",
    );
  }
  return issues;
}

function lineageAtCutoffs(input: {
  plan: Screen6DiagnosticPlan;
  resultHistory: readonly Screen6DiagnosticResult[];
  reviewHistory: readonly Screen6DiagnosticResultReview[];
  resultHistoryLength: number;
  reviewHistoryLength: number;
}) {
  if (
    !Number.isSafeInteger(input.resultHistoryLength) ||
    !Number.isSafeInteger(input.reviewHistoryLength) ||
    input.resultHistoryLength < 0 ||
    input.reviewHistoryLength < 0 ||
    input.resultHistoryLength > input.resultHistory.length ||
    input.reviewHistoryLength > input.reviewHistory.length
  ) throw new Error("Screen 6 claim-boundary history cutoffs are invalid.");
  const results = latestScreen6DiagnosticResultsForPlan(
    input.resultHistory.slice(0, input.resultHistoryLength),
    input.plan,
  );
  const reviews = reviewsForScreen6DiagnosticResults(
    input.reviewHistory.slice(0, input.reviewHistoryLength),
    results,
  );
  return { results, reviews };
}

function expectedBoundaryBody(input: {
  snapshotId: string;
  profile: Screen6UncertaintyProfile;
  plan: Screen6DiagnosticPlan;
  claimInput: Screen6ClaimBoundaryInput;
  resultHistory: readonly Screen6DiagnosticResult[];
  reviewHistory: readonly Screen6DiagnosticResultReview[];
  resultHistoryLength: number;
  reviewHistoryLength: number;
  priorBoundaries: readonly Screen6ConditionalClaimBoundary[];
  createdAt: string;
}): BoundaryBody {
  requireBoundedIdentifier(input.snapshotId, "Screen 6 claim-boundary id");
  requireCanonicalInstant(input.createdAt, "Screen 6 claim-boundary createdAt");
  validateScreen6ClaimBoundaryInput(input.claimInput);
  if (
    input.plan.binding.profileSnapshotId !== input.profile.snapshotId ||
    input.plan.binding.profileFingerprint !== input.profile.profileFingerprint
  ) throw new Error("Screen 6 claim boundary lost its uncertainty profile.");
  if (Date.parse(input.createdAt) < Date.parse(input.plan.createdAt)) {
    throw new Error("A Screen 6 claim boundary predates its diagnostic plan.");
  }
  const prior = input.priorBoundaries.at(-1) ?? null;
  if (prior && Date.parse(input.createdAt) < Date.parse(prior.createdAt)) {
    throw new Error("Screen 6 claim-boundary history is not chronological.");
  }
  const { results, reviews } = lineageAtCutoffs(input);
  for (const result of results) {
    if (Date.parse(input.createdAt) < Date.parse(result.submittedAt)) {
      throw new Error("A Screen 6 claim boundary predates a bound result.");
    }
  }
  for (const review of reviews) {
    if (Date.parse(input.createdAt) < Date.parse(review.reviewedAt)) {
      throw new Error("A Screen 6 claim boundary predates a bound review.");
    }
  }
  const resultReferences = results.map((result) => ({
    resultId: result.id,
    resultFingerprint: result.resultFingerprint,
    cardId: result.binding.cardId,
  }));
  const reviewReferences = reviews.map((review) => ({
    reviewId: review.id,
    reviewFingerprint: review.reviewFingerprint,
    resultId: review.resultReference.resultId,
  }));
  const lineageFingerprint = fingerprintSixScreenValue({
    profileSnapshotId: input.profile.snapshotId,
    profileFingerprint: input.profile.profileFingerprint,
    planSnapshotId: input.plan.snapshotId,
    planFingerprint: input.plan.planFingerprint,
    resultHistoryLength: input.resultHistoryLength,
    reviewHistoryLength: input.reviewHistoryLength,
    resultReferences,
    reviewReferences,
  });
  const target = currentDesignTarget(input.plan);
  const intendedRelationship = relationship(
    input.claimInput.intendedClaimLevel,
    target,
  );
  const statuses = diagnosticStatuses(input.plan, results, reviews);
  const levels = SCREEN6_CLAIM_LEVELS.map((claimLevel) => ({
    claimLevel,
    relationshipToCurrentDesign: relationship(claimLevel, target),
    assumptionsOrEvidenceRequired: requirements(claimLevel),
  }));
  const issues = unresolvedIssues({
    profile: input.profile,
    plan: input.plan,
    intendedRelationship,
    statuses,
  });
  const subject = target.status === "established"
    ? "This design"
    : "This proposed study";
  const resultAware = resultReferences.length > 0;
  return {
    schemaVersion: SIX_SCREEN_CLAIM_BOUNDARY_VERSION,
    snapshotId: input.snapshotId,
    ordinal: input.priorBoundaries.length + 1,
    previousBoundary: prior
      ? {
          snapshotId: prior.snapshotId,
          boundaryFingerprint: prior.boundaryFingerprint,
        }
      : null,
    binding: {
      profileSnapshotId: input.profile.snapshotId,
      profileFingerprint: input.profile.profileFingerprint,
      planSnapshotId: input.plan.snapshotId,
      planFingerprint: input.plan.planFingerprint,
      resultHistoryLength: input.resultHistoryLength,
      reviewHistoryLength: input.reviewHistoryLength,
      resultReferences,
      reviewReferences,
      lineageFingerprint,
    },
    input: structuredClone(input.claimInput),
    currentDesignTarget: target,
    claimLevels: levels,
    intendedClaim: {
      claimLevel: input.claimInput.intendedClaimLevel,
      targetDescription: input.claimInput.targetDescription,
      relationshipToCurrentDesign: intendedRelationship,
      prospectiveStatement:
        `${subject} is intended to estimate ${input.claimInput.targetDescription}, subject to the documented counterfactual assumptions, diagnostic plan, and unresolved limitations.`,
      attributionCeiling: intendedRelationship ===
          "matches_current_design_target"
        ? "Attribution cannot exceed the current design target or the evidence and assumptions recorded in this boundary, including after results are supplied."
        : "The intended claim exceeds, differs from, or lacks a current established design target. Attribution cannot be upgraded without a new supported design and evidence lineage.",
      resultsAware: resultAware,
    },
    diagnosticStatuses: statuses,
    dimensionStatuses: dimensionStatuses(input.plan, statuses),
    unassessedModules: unassessedModules(input.profile),
    unresolvedHighConsequenceIssues: issues,
    methodLibrary: structuredClone(input.plan.methodLibrary),
    researchPlanning: {
      dispositionStatus: "awaiting_researcher_disposition",
      automaticRecommendation: null,
    },
    preparation: {
      actor: "researcher",
      method: "deterministic_fixed_software",
      networkRequests: 0,
      modelCalls: 0,
      localRoutineCalls: 0,
    },
    nonOutputs: {
      causalCertification: "not_available",
      aggregateScore: null,
      universalBadge: null,
      automaticAttributionUpgrade: null,
      credibilityPlanExport: null,
      reportBundle: null,
      designRecord: null,
    },
    claimBoundary: BOUNDARY_DISCLOSURE,
    createdAt: input.createdAt,
  };
}

export function createScreen6ConditionalClaimBoundary(input: {
  snapshotId: string;
  profile: Screen6UncertaintyProfile;
  plan: Screen6DiagnosticPlan;
  claimInput: Screen6ClaimBoundaryInput;
  resultHistory: readonly Screen6DiagnosticResult[];
  reviewHistory: readonly Screen6DiagnosticResultReview[];
  priorBoundaries: readonly Screen6ConditionalClaimBoundary[];
  actor: "researcher_ui" | "model" | "system";
  createdAt: string;
}) {
  if (input.actor !== "researcher_ui") {
    throw new Error(
      "Only an explicit researcher UI action can create a Screen 6 conditional claim boundary.",
    );
  }
  if (
    input.priorBoundaries.length >=
      SIX_SCREEN_CLAIM_BOUNDARY_MAX_REVISIONS
  ) throw new Error("Screen 6 claim-boundary history reached capacity.");
  const body = expectedBoundaryBody({
    ...input,
    resultHistoryLength: input.resultHistory.length,
    reviewHistoryLength: input.reviewHistory.length,
  });
  return validateScreen6ConditionalClaimBoundary({
    ...body,
    boundaryFingerprint: fingerprintSixScreenValue(body),
  }, {
    profile: input.profile,
    plan: input.plan,
    resultHistory: input.resultHistory,
    reviewHistory: input.reviewHistory,
    priorBoundaries: input.priorBoundaries,
  });
}

function boundaryBody(boundary: Screen6ConditionalClaimBoundary): BoundaryBody {
  const { boundaryFingerprint: _boundaryFingerprint, ...body } = boundary;
  return body;
}

export function validateScreen6ConditionalClaimBoundary(
  boundary: Screen6ConditionalClaimBoundary,
  parents: {
    profile: Screen6UncertaintyProfile;
    plan: Screen6DiagnosticPlan;
    resultHistory: readonly Screen6DiagnosticResult[];
    reviewHistory: readonly Screen6DiagnosticResultReview[];
    priorBoundaries: readonly Screen6ConditionalClaimBoundary[];
  },
) {
  const expected = expectedBoundaryBody({
    snapshotId: boundary.snapshotId,
    profile: parents.profile,
    plan: parents.plan,
    claimInput: boundary.input,
    resultHistory: parents.resultHistory,
    reviewHistory: parents.reviewHistory,
    resultHistoryLength: boundary.binding.resultHistoryLength,
    reviewHistoryLength: boundary.binding.reviewHistoryLength,
    priorBoundaries: parents.priorBoundaries,
    createdAt: boundary.createdAt,
  });
  if (
    boundary.schemaVersion !== SIX_SCREEN_CLAIM_BOUNDARY_VERSION ||
    boundary.boundaryFingerprint !==
      fingerprintSixScreenValue(boundaryBody(boundary)) ||
    !sameSixScreenValue(boundaryBody(boundary), expected) ||
    boundary.preparation.networkRequests !== 0 ||
    boundary.preparation.modelCalls !== 0 ||
    boundary.preparation.localRoutineCalls !== 0 ||
    boundary.nonOutputs.causalCertification !== "not_available" ||
    boundary.nonOutputs.aggregateScore !== null ||
    boundary.nonOutputs.universalBadge !== null ||
    boundary.nonOutputs.credibilityPlanExport !== null ||
    boundary.nonOutputs.reportBundle !== null ||
    boundary.nonOutputs.designRecord !== null
  ) throw new Error("Screen 6 conditional claim boundary is invalid.");
  requireFingerprint(
    boundary.binding.lineageFingerprint,
    "Screen 6 claim-boundary lineage fingerprint",
  );
  requireFingerprint(
    boundary.boundaryFingerprint,
    "Screen 6 claim-boundary fingerprint",
  );
  return boundary;
}

function expectedDispositionBody(input: {
  id: string;
  boundary: Screen6ConditionalClaimBoundary;
  priorDispositions: readonly Screen6ResearchPlanningDisposition[];
  decision: Screen6ResearchPlanningDispositionDecision;
  rationale: string;
  specifiedRevisions: readonly string[];
  decidedAt: string;
}): DispositionBody {
  requireBoundedIdentifier(input.id, "Screen 6 research disposition id");
  requireCanonicalInstant(input.decidedAt, "Screen 6 disposition decidedAt");
  requireText(input.rationale, "Screen 6 disposition rationale", 4_000);
  if (!SCREEN6_RESEARCH_DISPOSITIONS.includes(input.decision)) {
    throw new Error("Screen 6 research-planning disposition is invalid.");
  }
  if (Date.parse(input.decidedAt) < Date.parse(input.boundary.createdAt)) {
    throw new Error("A Screen 6 disposition predates its claim boundary.");
  }
  const previous = input.priorDispositions.at(-1);
  if (previous && Date.parse(input.decidedAt) < Date.parse(previous.decidedAt)) {
    throw new Error("Screen 6 disposition history is not chronological.");
  }
  if (input.priorDispositions.some((disposition) =>
    disposition.boundaryReference.snapshotId === input.boundary.snapshotId)) {
    throw new Error("A Screen 6 conditional claim boundary can have only one disposition.");
  }
  const revisions = textList(
    input.specifiedRevisions,
    "Screen 6 specified revision",
    20,
    1_000,
  );
  if (
    input.decision === "revise_specified_parts_first" &&
    revisions.length === 0
  ) throw new Error("A revise-first disposition requires specified revisions.");
  if (
    input.decision !== "revise_specified_parts_first" &&
    revisions.length > 0
  ) throw new Error("Only a revise-first disposition records specified revisions.");
  if (
    input.decision === "proceed_with_documented_analysis_plan" &&
    input.boundary.intendedClaim.relationshipToCurrentDesign !==
      "matches_current_design_target"
  ) {
    throw new Error(
      "Proceed requires an intended claim that matches the current established design target.",
    );
  }
  return {
    schemaVersion: SIX_SCREEN_RESEARCH_DISPOSITION_VERSION,
    id: input.id,
    ordinal: input.priorDispositions.length + 1,
    boundaryReference: {
      snapshotId: input.boundary.snapshotId,
      boundaryFingerprint: input.boundary.boundaryFingerprint,
      planSnapshotId: input.boundary.binding.planSnapshotId,
      planFingerprint: input.boundary.binding.planFingerprint,
      intendedClaimLevel: input.boundary.intendedClaim.claimLevel,
    },
    decision: input.decision,
    rationale: input.rationale,
    specifiedRevisions: revisions,
    retainedUnassessedModules: input.boundary.unassessedModules.map((module) => ({
      module: module.module,
      availability: module.availability,
    })),
    retainedHighConsequenceIssueCodes:
      input.boundary.unresolvedHighConsequenceIssues.map(({ code }) => code),
    actor: "researcher",
    recommendationType: "research_planning_not_causal_certification",
    automaticDesignMutation: "none",
    attributionUpgrade: "none",
    causalCertification: "not_available",
    aggregateScore: null,
    universalBadge: null,
    credibilityPlanExport: null,
    reportBundle: null,
    designRecord: null,
    claimBoundary: DISPOSITION_DISCLOSURE,
    decidedAt: input.decidedAt,
  };
}

export function createScreen6ResearchPlanningDisposition(input: {
  id: string;
  boundary: Screen6ConditionalClaimBoundary;
  priorDispositions: readonly Screen6ResearchPlanningDisposition[];
  decision: Screen6ResearchPlanningDispositionDecision;
  rationale: string;
  specifiedRevisions: readonly string[];
  actor: "researcher_ui" | "model" | "system";
  decidedAt: string;
}) {
  if (input.actor !== "researcher_ui") {
    throw new Error(
      "Only an explicit researcher UI action can record a Screen 6 research-planning disposition.",
    );
  }
  if (
    input.priorDispositions.length >=
      SIX_SCREEN_RESEARCH_DISPOSITION_MAX_RECORDS
  ) throw new Error("Screen 6 disposition history reached capacity.");
  const body = expectedDispositionBody(input);
  return validateScreen6ResearchPlanningDisposition({
    ...body,
    dispositionFingerprint: fingerprintSixScreenValue(body),
  }, input.boundary, input.priorDispositions);
}

function dispositionBody(
  disposition: Screen6ResearchPlanningDisposition,
): DispositionBody {
  const { dispositionFingerprint: _dispositionFingerprint, ...body } =
    disposition;
  return body;
}

export function validateScreen6ResearchPlanningDisposition(
  disposition: Screen6ResearchPlanningDisposition,
  boundary: Screen6ConditionalClaimBoundary,
  priorDispositions: readonly Screen6ResearchPlanningDisposition[],
) {
  const expected = expectedDispositionBody({
    id: disposition.id,
    boundary,
    priorDispositions,
    decision: disposition.decision,
    rationale: disposition.rationale,
    specifiedRevisions: disposition.specifiedRevisions,
    decidedAt: disposition.decidedAt,
  });
  if (
    disposition.schemaVersion !== SIX_SCREEN_RESEARCH_DISPOSITION_VERSION ||
    disposition.dispositionFingerprint !==
      fingerprintSixScreenValue(dispositionBody(disposition)) ||
    !sameSixScreenValue(dispositionBody(disposition), expected) ||
    disposition.automaticDesignMutation !== "none" ||
    disposition.attributionUpgrade !== "none" ||
    disposition.causalCertification !== "not_available" ||
    disposition.aggregateScore !== null ||
    disposition.universalBadge !== null ||
    disposition.credibilityPlanExport !== null ||
    disposition.reportBundle !== null ||
    disposition.designRecord !== null
  ) throw new Error("Screen 6 research-planning disposition is invalid.");
  requireFingerprint(
    disposition.dispositionFingerprint,
    "Screen 6 research-planning disposition fingerprint",
  );
  return disposition;
}

export function validateScreen6ClaimBoundaryCollections(input: {
  profiles: readonly Screen6UncertaintyProfile[];
  plans: readonly Screen6DiagnosticPlan[];
  results: readonly Screen6DiagnosticResult[];
  reviews: readonly Screen6DiagnosticResultReview[];
  boundaries: readonly Screen6ConditionalClaimBoundary[];
  dispositions: readonly Screen6ResearchPlanningDisposition[];
}) {
  if (
    input.boundaries.length > SIX_SCREEN_CLAIM_BOUNDARY_MAX_REVISIONS ||
    input.dispositions.length > SIX_SCREEN_RESEARCH_DISPOSITION_MAX_RECORDS ||
    bytes({
      boundaries: input.boundaries,
      dispositions: input.dispositions,
    }) > SIX_SCREEN_CLAIM_BOUNDARY_COLLECTION_MAX_BYTES
  ) throw new Error("Stored Screen 6 claim-boundary history exceeds its bounded contract.");
  const occupied = new Set<string>();
  input.profiles.forEach(({ snapshotId }) => occupied.add(snapshotId));
  for (const plan of input.plans) {
    occupied.add(plan.snapshotId);
  }
  input.results.forEach(({ id }) => occupied.add(id));
  input.reviews.forEach(({ id }) => occupied.add(id));
  const coordinates = new Set<string>();
  const priorBoundaries: Screen6ConditionalClaimBoundary[] = [];
  for (const boundary of input.boundaries) {
    if (occupied.has(boundary.snapshotId)) {
      throw new Error("Stored Screen 6 claim-boundary ids must be unique.");
    }
    const plan = input.plans.find(({ snapshotId }) =>
      snapshotId === boundary.binding.planSnapshotId);
    const profile = input.profiles.find(({ snapshotId }) =>
      snapshotId === boundary.binding.profileSnapshotId);
    if (!plan || !profile) {
      throw new Error("Stored Screen 6 claim boundary lost its plan or profile.");
    }
    const coordinate = fingerprintSixScreenValue({
      lineageFingerprint: boundary.binding.lineageFingerprint,
      inputFingerprint: boundary.input.inputFingerprint,
    });
    if (coordinates.has(coordinate)) {
      throw new Error("Stored Screen 6 claim-boundary inputs must be unique per lineage.");
    }
    validateScreen6ConditionalClaimBoundary(boundary, {
      profile,
      plan,
      resultHistory: input.results,
      reviewHistory: input.reviews,
      priorBoundaries,
    });
    occupied.add(boundary.snapshotId);
    coordinates.add(coordinate);
    priorBoundaries.push(boundary);
  }
  const priorDispositions: Screen6ResearchPlanningDisposition[] = [];
  for (const disposition of input.dispositions) {
    if (occupied.has(disposition.id)) {
      throw new Error("Stored Screen 6 disposition ids must be unique.");
    }
    const boundary = input.boundaries.find(({ snapshotId }) =>
      snapshotId === disposition.boundaryReference.snapshotId);
    if (!boundary) {
      throw new Error("Stored Screen 6 disposition lost its claim boundary.");
    }
    validateScreen6ResearchPlanningDisposition(
      disposition,
      boundary,
      priorDispositions,
    );
    occupied.add(disposition.id);
    priorDispositions.push(disposition);
  }
  return input;
}
