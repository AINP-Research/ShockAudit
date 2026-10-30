import { fingerprintSixScreenValue } from "./canonical";
import {
  SOURCE_CAPABILITY_STATUSES,
  type SourceCapability,
} from "./capabilities";
import {
  requireBoundedIdentifier,
  requireCanonicalInstant,
  requireFingerprint,
  requireSanitizedSourceUrl,
  type ConfirmedShock,
  type ResultsInspectionStatus,
  type StudyContext,
} from "./contracts";
import type {
  CausalDesignDecision,
  CausalDesignSet,
} from "./causal-comparison";
import type {
  CoEventSearchMatrix,
} from "./co-event-search";
import type { CoEventSearchExecution } from "./co-event-execution";
import type { CoEventRelationReview } from
  "./co-event-relation-review";
import {
  createPolicyEventCardReference,
  validatePolicyEventCardReview,
  type PolicyEventCardClaimReview,
  type PolicyEventCardReference,
  type PolicyEventCardReviewState,
  type PolicyReviewedEventCard,
} from "./policy-event-card-review";

export const SIX_SCREEN_MECHANISM_LITERATURE_INPUT_VERSION =
  "screen-05-mechanism-literature-input-v1" as const;
export const SIX_SCREEN_MECHANISM_LITERATURE_PLAN_VERSION =
  "screen-05-mechanism-literature-plan-v1" as const;
export const SIX_SCREEN_MECHANISM_LITERATURE_MAX_REVISIONS = 24;
export const SIX_SCREEN_MECHANISM_LITERATURE_MAX_BYTES = 128_000;

export const MECHANISM_LITERATURE_BRANCHES = [
  "exact_policy_and_response",
  "analogous_intervention_and_process",
  "theory_contrary_findings_and_boundaries",
] as const;

const MECHANISM_LITERATURE_BRANCH_LIMITS = [
  { sourceQueries: 5, metadataRecords: 25 },
  { sourceQueries: 5, metadataRecords: 25 },
  { sourceQueries: 6, metadataRecords: 30 },
] as const;

const MECHANISM_LITERATURE_CLAIM_BOUNDARY =
  "This record is a saved literature plan, not a literature review, mechanism analysis, prediction matrix, causal estimate, or researcher decision about a mechanism.";

export type MechanismLiteratureBranch =
  (typeof MECHANISM_LITERATURE_BRANCHES)[number];

export type MechanismExplanationInput =
  | { mode: "stated"; text: string }
  | { mode: "undecided"; text: null };

export type MechanismSuppliedWorkInput = {
  id: string;
  kind: "doi" | "openalex_id" | "url" | "citation";
  value: string;
};

export type MechanismLiteraturePlanInput = {
  schemaVersion: typeof SIX_SCREEN_MECHANISM_LITERATURE_INPUT_VERSION;
  explanation: MechanismExplanationInput;
  suppliedWorks: MechanismSuppliedWorkInput[];
  preferredConstructs: string[];
  feasibleDataSources: string[];
  knownAlternativeAccounts: string[];
  inputFingerprint: string;
};

export type MechanismPolicyPremise = {
  claimId: string;
  predicate: string;
  sourceStatement: string;
  effectiveStatement: string;
  statementOrigin: PolicyEventCardClaimReview["statementOrigin"];
  reviewDecision: Extract<
    PolicyEventCardClaimReview["decision"],
    "accepted" | "corrected" | "provisional"
  >;
  supportStatus: PolicyEventCardClaimReview["supportStatus"];
  passageIds: string[];
  documentVersionIds: string[];
  sourceIds: string[];
  conflictIds: string[];
};

export type MechanismLiteratureProviderSnapshot = {
  id: "openalex" | "crossref";
  provider: string;
  adapterVersion: string;
  configured: boolean;
  implemented: boolean;
  tested: boolean;
  enabled: boolean;
  status: SourceCapability["status"];
  role:
    | "primary_scholarly_discovery_and_open_location"
    | "bibliographic_identity_and_update_metadata";
  searchRecords: boolean;
  getRecord: boolean;
  fetchRepresentation: boolean;
  limitation: string;
};

export type MechanismLiteraturePlanRow = {
  id: string;
  branch: MechanismLiteratureBranch;
  question: string;
  queryConcepts: string[];
  policyPremiseClaimIds: string[];
  providers: Array<{
    id: MechanismLiteratureProviderSnapshot["id"];
    role: MechanismLiteratureProviderSnapshot["role"];
    capabilityStatus: SourceCapability["status"];
    plannedOperation: "search_records";
  }>;
  plannedLimit: {
    sourceQueries: number;
    metadataRecords: number;
  };
  outcome: {
    status: "not_started";
    scholarlyRecordIds: [];
    inspectedTextIds: [];
    note: string;
  };
};

export type MechanismLiteraturePlan = {
  schemaVersion: typeof SIX_SCREEN_MECHANISM_LITERATURE_PLAN_VERSION;
  snapshotId: string;
  ordinal: number;
  binding: {
    studyRevision: number;
    identityFingerprint: string;
    eventCardReference: PolicyEventCardReference;
    designSetSnapshotId: string | null;
    designSetFingerprint: string | null;
    designDecisionSnapshotId: string | null;
    designDecisionFingerprint: string | null;
    coEventSnapshotId: string | null;
    coEventFingerprint: string | null;
    coEventRelationReviewReferences?: Array<{
      reviewId: string;
      reviewFingerprint: string;
      candidateId: string;
      decision: CoEventRelationReview["decision"];
      category: CoEventRelationReview["relation"]["category"];
    }>;
    coEventRelationAnalysisComplete?: boolean;
  };
  policy: {
    officialTitle: string;
    issuer: string;
    issuingJurisdiction: string;
    formalIdentifiers: string[];
    episode: string;
  };
  study: {
    population: string | null;
    analysisUnit: string | null;
    geography: string[];
    industry: string[];
    period: StudyContext["period"];
    outcome: string;
    intendedConstruct: string;
    resultsPreviouslyInspected: ResultsInspectionStatus;
  };
  input: MechanismLiteraturePlanInput;
  policyPremises: MechanismPolicyPremise[];
  providerCapabilities: MechanismLiteratureProviderSnapshot[];
  rows: MechanismLiteraturePlanRow[];
  retrievalProfile: {
    profileName: "mechanism-standard";
    totalSourceQueries: 16;
    totalMetadataRecords: 80;
    documentAttempts: 16;
    usefulDocuments: 8;
    citationNeighborhoodHopLimit: 1;
  };
  upstreamStatus: {
    designReview: "available" | "not_assessed";
    coEventReview: "occurrence_work_only" | "not_assessed";
    coEventRelationAnalysis: "researcher_reviewed" | "not_assessed";
  };
  evidenceStatus: {
    policyPremises: "reviewed_source_linked" | "reviewed_with_qualifications";
    suppliedWorks: "not_inspected" | "none_supplied";
    scholarlyMetadata: "not_retrieved";
    scholarlyText: "not_inspected";
  };
  intelligenceAnalysis: {
    status: "blocked";
    reason: "genuine_intelligence_path_unverified";
  };
  limitations: string[];
  claimBoundary: string;
  createdAt: string;
  planFingerprint: string;
};

type PlanBody = Omit<MechanismLiteraturePlan, "planFingerprint">;

function serializedBytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function requireText(value: string, label: string, max = 4_000) {
  if (!value || value !== value.trim() || value.length > max) {
    throw new Error(
      `${label} must be non-empty canonical text of at most ${max} characters.`,
    );
  }
  return value;
}

function requireUniqueTextList(
  values: readonly string[],
  label: string,
  maxEntries: number,
) {
  if (
    values.length > maxEntries ||
    new Set(values).size !== values.length
  ) throw new Error(`${label} must be a bounded unique list.`);
  values.forEach((value) => requireText(value, label, 1_000));
  return values;
}

function inputBody(input: MechanismLiteraturePlanInput) {
  const {
    schemaVersion: _schemaVersion,
    inputFingerprint: _inputFingerprint,
    ...body
  } = input;
  return body;
}

function validateSuppliedWork(work: MechanismSuppliedWorkInput) {
  requireBoundedIdentifier(work.id, "Screen 5 supplied-work id");
  requireText(work.value, "Screen 5 supplied-work value", 2_000);
  if (work.kind === "doi" && !/^10\.\d{4,9}\/[\S]+$/iu.test(work.value)) {
    throw new Error("Screen 5 DOI must be a complete DOI without a resolver prefix.");
  }
  if (
    work.kind === "openalex_id" &&
    !/^(?:https:\/\/openalex\.org\/)?W\d+$/u.test(work.value)
  ) throw new Error("Screen 5 OpenAlex id is invalid.");
  if (work.kind === "url") requireSanitizedSourceUrl(work.value);
  return work;
}

export function createMechanismLiteraturePlanInput(input: Omit<
  MechanismLiteraturePlanInput,
  "schemaVersion" | "inputFingerprint"
>): MechanismLiteraturePlanInput {
  if (input.explanation.mode === "stated") {
    requireText(input.explanation.text, "Screen 5 initial explanation", 4_000);
  } else if (
    input.explanation.mode !== "undecided" ||
    input.explanation.text !== null
  ) throw new Error("Screen 5 explanation must be stated or explicitly undecided.");
  if (
    input.suppliedWorks.length > 24 ||
    new Set(input.suppliedWorks.map(({ id }) => id)).size !==
      input.suppliedWorks.length
  ) throw new Error("Screen 5 supplied works must be a bounded unique list.");
  input.suppliedWorks.forEach(validateSuppliedWork);
  requireUniqueTextList(
    input.preferredConstructs,
    "Screen 5 preferred constructs",
    20,
  );
  requireUniqueTextList(
    input.feasibleDataSources,
    "Screen 5 feasible data sources",
    20,
  );
  requireUniqueTextList(
    input.knownAlternativeAccounts,
    "Screen 5 known alternative accounts",
    20,
  );
  const body = {
    schemaVersion: SIX_SCREEN_MECHANISM_LITERATURE_INPUT_VERSION,
    ...structuredClone(input),
  };
  return {
    ...body,
    inputFingerprint: fingerprintSixScreenValue(inputBody({
      ...body,
      inputFingerprint: "",
    })),
  };
}

export function validateMechanismLiteraturePlanInput(
  input: MechanismLiteraturePlanInput,
) {
  const recreated = createMechanismLiteraturePlanInput(inputBody(input));
  if (
    input.schemaVersion !== SIX_SCREEN_MECHANISM_LITERATURE_INPUT_VERSION ||
    input.inputFingerprint !== recreated.inputFingerprint
  ) throw new Error("Screen 5 literature-plan input fingerprint is invalid.");
  return input;
}

function premiseFromClaim(
  claim: PolicyEventCardClaimReview,
): MechanismPolicyPremise | null {
  if (
    claim.decision !== "accepted" && claim.decision !== "corrected" &&
    claim.decision !== "provisional"
  ) return null;
  const supporting = claim.lineages.filter(({ direction }) =>
    direction === "supporting");
  if (!supporting.length || claim.supportStatus === "unsupported") return null;
  return {
    claimId: claim.claimId,
    predicate: claim.predicate,
    sourceStatement: claim.sourceStatement,
    effectiveStatement: claim.effectiveStatement,
    statementOrigin: claim.statementOrigin,
    reviewDecision: claim.decision,
    supportStatus: claim.supportStatus,
    passageIds: [...new Set(supporting.map(({ passageId }) => passageId))],
    documentVersionIds: [
      ...new Set(supporting.map(({ documentVersionId }) => documentVersionId)),
    ],
    sourceIds: [...new Set(supporting.map(({ sourceId }) => sourceId))],
    conflictIds: [...claim.conflictIds],
  };
}

function capabilitySnapshot(
  id: MechanismLiteratureProviderSnapshot["id"],
  capability: SourceCapability,
): MechanismLiteratureProviderSnapshot {
  const expectedProvider = id === "openalex" ? "OpenAlex" : "Crossref";
  if (capability.provider !== expectedProvider) {
    throw new Error(`Screen 5 ${expectedProvider} capability identity is invalid.`);
  }
  return {
    id,
    provider: capability.provider,
    adapterVersion: capability.adapterVersion,
    configured: capability.configured,
    implemented: capability.implemented,
    tested: capability.tested,
    enabled: capability.enabled,
    status: capability.status,
    role: id === "openalex"
      ? "primary_scholarly_discovery_and_open_location"
      : "bibliographic_identity_and_update_metadata",
    searchRecords: capability.operations.searchRecords,
    getRecord: capability.operations.getRecord,
    fetchRepresentation: capability.operations.fetchRepresentation,
    limitation: capability.limitation ??
      "No additional capability limitation was reported.",
  };
}

function uniqueConcepts(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(
    value && value.trim(),
  )).map((value) => value.trim()))].slice(0, 24);
}

function planRow(input: {
  snapshotId: string;
  branch: MechanismLiteratureBranch;
  question: string;
  queryConcepts: string[];
  policyPremiseClaimIds: string[];
  providers: MechanismLiteratureProviderSnapshot[];
  sourceQueries: number;
  metadataRecords: number;
}): MechanismLiteraturePlanRow {
  return {
    id: `${input.snapshotId}-${input.branch}`,
    branch: input.branch,
    question: input.question,
    queryConcepts: input.queryConcepts,
    policyPremiseClaimIds: input.policyPremiseClaimIds,
    providers: input.providers.map(({ id, role, status }) => ({
      id,
      role,
      capabilityStatus: status,
      plannedOperation: "search_records",
    })),
    plannedLimit: {
      sourceQueries: input.sourceQueries,
      metadataRecords: input.metadataRecords,
    },
    outcome: {
      status: "not_started",
      scholarlyRecordIds: [],
      inspectedTextIds: [],
      note: "This branch is saved but has not executed a provider query.",
    },
  };
}

export function createMechanismLiteraturePlan(input: {
  snapshotId: string;
  ordinal: number;
  planInput: MechanismLiteraturePlanInput;
  study: StudyContext;
  confirmedShock: ConfirmedShock;
  eventCard: PolicyReviewedEventCard;
  eventCardReview: PolicyEventCardReviewState;
  designSet: CausalDesignSet | null;
  designDecision: CausalDesignDecision | null;
  coEventMatrix: CoEventSearchMatrix | null;
  coEventExecution: CoEventSearchExecution | null;
  coEventRelationReviews?: CoEventRelationReview[];
  coEventRelationAnalysisComplete?: boolean;
  capabilities: {
    openalex: SourceCapability;
    crossref: SourceCapability;
  };
  createdAt: string;
}): MechanismLiteraturePlan {
  requireBoundedIdentifier(input.snapshotId, "Screen 5 literature-plan snapshot id");
  requireCanonicalInstant(input.createdAt, "Screen 5 literature-plan createdAt");
  validateMechanismLiteraturePlanInput(input.planInput);
  validatePolicyEventCardReview({ review: input.eventCardReview });
  if (
    !Number.isSafeInteger(input.ordinal) || input.ordinal < 1 ||
    input.eventCardReview.lockedEventCard?.snapshotId !== input.eventCard.snapshotId ||
    input.eventCardReview.lockedEventCard?.eventCardFingerprint !==
      input.eventCard.eventCardFingerprint ||
    input.eventCard.binding.identityFingerprint !==
      input.confirmedShock.identityFingerprint
  ) throw new Error("Screen 5 literature plan requires the current reviewed policy and study revision.");
  if (!input.study.outcome || !input.study.intendedConstruct) {
    throw new Error("Screen 5 literature plan requires an outcome and intended construct.");
  }
  if (Boolean(input.designSet) !== Boolean(input.designDecision)) {
    throw new Error("Screen 5 design context must be a complete researcher decision or not assessed.");
  }
  if (
    input.designSet && input.designDecision &&
    (input.designDecision.designSetSnapshotId !== input.designSet.snapshotId ||
      input.designDecision.designSetFingerprint !==
        input.designSet.designSetFingerprint)
  ) throw new Error("Screen 5 design context is stale or mismatched.");
  if (
    input.coEventExecution &&
    (!input.coEventMatrix ||
      input.coEventExecution.matrixSnapshotId !== input.coEventMatrix.snapshotId ||
      input.coEventExecution.matrixFingerprint !==
        input.coEventMatrix.matrixFingerprint)
  ) throw new Error("Screen 5 co-event context is stale or mismatched.");

  const policyPremises = input.eventCard.claims
    .map(premiseFromClaim)
    .filter((premise): premise is MechanismPolicyPremise => premise !== null);
  if (!policyPremises.length) {
    throw new Error(
      "Screen 5 requires at least one reviewed, source-linked policy premise.",
    );
  }
  const providers = [
    capabilitySnapshot("openalex", input.capabilities.openalex),
    capabilitySnapshot("crossref", input.capabilities.crossref),
  ];
  const eventCardReference = createPolicyEventCardReference({
    review: input.eventCardReview,
  });
  const explanation = input.planInput.explanation.mode === "stated"
    ? input.planInput.explanation.text
    : null;
  const premiseConcepts = policyPremises.flatMap((premise) => [
    premise.predicate.replaceAll("_", " "),
    premise.effectiveStatement,
  ]);
  const baseConcepts = [
    input.confirmedShock.officialTitle,
    ...input.confirmedShock.formalIdentifiers,
    input.study.outcome,
    input.study.intendedConstruct,
  ];
  const premiseIds = policyPremises.map(({ claimId }) => claimId);
  const rows = [
    planRow({
      snapshotId: input.snapshotId,
      branch: "exact_policy_and_response",
      question:
        `What scholarly evidence addresses organizational responses to ${input.confirmedShock.officialTitle} and outcomes related to ${input.study.outcome}?`,
      queryConcepts: uniqueConcepts(baseConcepts),
      policyPremiseClaimIds: premiseIds,
      providers,
      ...MECHANISM_LITERATURE_BRANCH_LIMITS[0],
    }),
    planRow({
      snapshotId: input.snapshotId,
      branch: "analogous_intervention_and_process",
      question:
        `What analogous interventions or organizational processes bear on the reviewed policy premises and ${input.study.intendedConstruct}?`,
      queryConcepts: uniqueConcepts([
        ...premiseConcepts,
        explanation,
        ...input.planInput.preferredConstructs,
        input.study.outcome,
        input.study.intendedConstruct,
      ]),
      policyPremiseClaimIds: premiseIds,
      providers,
      ...MECHANISM_LITERATURE_BRANCH_LIMITS[1],
    }),
    planRow({
      snapshotId: input.snapshotId,
      branch: "theory_contrary_findings_and_boundaries",
      question: input.planInput.explanation.mode === "stated"
        ? "Which theoretical arguments, contrary findings, and boundary conditions challenge or qualify the researcher's initial explanation?"
        : "Which theoretical arguments, contrary findings, and boundary conditions could organize the outcome and intended construct without presuming a focal mechanism?",
      queryConcepts: uniqueConcepts([
        explanation,
        input.study.outcome,
        input.study.intendedConstruct,
        ...input.planInput.preferredConstructs,
        ...input.planInput.knownAlternativeAccounts,
        "contrary findings",
        "boundary conditions",
      ]),
      policyPremiseClaimIds: premiseIds,
      providers,
      ...MECHANISM_LITERATURE_BRANCH_LIMITS[2],
    }),
  ];
  const qualifiedPremises = policyPremises.some((premise) =>
    premise.reviewDecision === "provisional" ||
    premise.statementOrigin === "researcher_supplied" ||
    premise.supportStatus === "conflicting" || premise.conflictIds.length > 0);
  const boundCoEvent = input.coEventExecution ?? input.coEventMatrix;
  const body: PlanBody = {
    schemaVersion: SIX_SCREEN_MECHANISM_LITERATURE_PLAN_VERSION,
    snapshotId: input.snapshotId,
    ordinal: input.ordinal,
    binding: {
      studyRevision: input.study.revision,
      identityFingerprint: input.confirmedShock.identityFingerprint,
      eventCardReference,
      designSetSnapshotId: input.designSet?.snapshotId ?? null,
      designSetFingerprint: input.designSet?.designSetFingerprint ?? null,
      designDecisionSnapshotId: input.designDecision?.snapshotId ?? null,
      designDecisionFingerprint:
        input.designDecision?.decisionFingerprint ?? null,
      coEventSnapshotId: boundCoEvent?.snapshotId ?? null,
      coEventFingerprint: input.coEventExecution?.executionFingerprint ??
        input.coEventMatrix?.matrixFingerprint ?? null,
      coEventRelationReviewReferences:
        (input.coEventRelationReviews ?? []).map((review) => ({
          reviewId: review.id,
          reviewFingerprint: review.reviewFingerprint,
          candidateId: review.binding.candidateId,
          decision: review.decision,
          category: review.relation.category,
        })),
      coEventRelationAnalysisComplete:
        input.coEventRelationAnalysisComplete === true,
    },
    policy: {
      officialTitle: input.confirmedShock.officialTitle,
      issuer: input.confirmedShock.issuer,
      issuingJurisdiction: input.confirmedShock.issuingJurisdiction,
      formalIdentifiers: [...input.confirmedShock.formalIdentifiers],
      episode: input.confirmedShock.episode,
    },
    study: {
      population: input.study.population,
      analysisUnit: input.study.analysisUnit,
      geography: [...input.study.geography],
      industry: [...input.study.industry],
      period: structuredClone(input.study.period),
      outcome: input.study.outcome,
      intendedConstruct: input.study.intendedConstruct,
      resultsPreviouslyInspected: input.study.resultsPreviouslyInspected,
    },
    input: structuredClone(input.planInput),
    policyPremises,
    providerCapabilities: providers,
    rows,
    retrievalProfile: {
      profileName: "mechanism-standard",
      totalSourceQueries: 16,
      totalMetadataRecords: 80,
      documentAttempts: 16,
      usefulDocuments: 8,
      citationNeighborhoodHopLimit: 1,
    },
    upstreamStatus: {
      designReview: input.designDecision ? "available" : "not_assessed",
      coEventReview: boundCoEvent ? "occurrence_work_only" : "not_assessed",
      coEventRelationAnalysis: input.coEventRelationAnalysisComplete
        ? "researcher_reviewed"
        : "not_assessed",
    },
    evidenceStatus: {
      policyPremises: qualifiedPremises
        ? "reviewed_with_qualifications"
        : "reviewed_source_linked",
      suppliedWorks: input.planInput.suppliedWorks.length
        ? "not_inspected"
        : "none_supplied",
      scholarlyMetadata: "not_retrieved",
      scholarlyText: "not_inspected",
    },
    intelligenceAnalysis: {
      status: "blocked",
      reason: "genuine_intelligence_path_unverified",
    },
    limitations: [
      ...(input.designDecision
        ? []
        : ["No current researcher-owned Screen 3 design decision was available; design-dependent predictions are not assessed."]),
      ...(boundCoEvent && !input.coEventRelationAnalysisComplete
        ? ["Screen 4 occurrence work may be available, but comparison-specific researcher relation review is incomplete."]
        : boundCoEvent
        ? []
        : ["Screen 4 was not available; possible co-event implications are not assessed."]),
      "No OpenAlex or Crossref query has run for this saved plan.",
      "No scholarly full text or supplied work has been inspected.",
      "Mechanism generation and prediction comparison remain blocked until a genuine intelligence route and source-linked scholarly packet are available.",
    ],
    claimBoundary: MECHANISM_LITERATURE_CLAIM_BOUNDARY,
    createdAt: input.createdAt,
  };
  const plan = {
    ...body,
    planFingerprint: fingerprintSixScreenValue(body),
  };
  return validateMechanismLiteraturePlan(plan);
}

function planBody(plan: MechanismLiteraturePlan) {
  const { planFingerprint: _planFingerprint, ...body } = plan;
  return body;
}

function sameOrderedValues(
  left: readonly string[],
  right: readonly string[],
) {
  return left.length === right.length && left.every((value, index) =>
    value === right[index]);
}

function requireBindingPairs(plan: MechanismLiteraturePlan) {
  const designBinding = [
    plan.binding.designSetSnapshotId,
    plan.binding.designSetFingerprint,
    plan.binding.designDecisionSnapshotId,
    plan.binding.designDecisionFingerprint,
  ];
  const designBound = designBinding.every((value) => value !== null);
  if (!designBound && designBinding.some((value) => value !== null)) {
    throw new Error("Screen 5 design binding must be complete or explicitly unassessed.");
  }
  const coEventBound = plan.binding.coEventSnapshotId !== null &&
    plan.binding.coEventFingerprint !== null;
  if (
    coEventBound !== (plan.binding.coEventSnapshotId !== null) ||
    coEventBound !== (plan.binding.coEventFingerprint !== null)
  ) throw new Error("Screen 5 co-event binding must be complete or explicitly unassessed.");
  if (
    plan.upstreamStatus.designReview !==
      (designBound ? "available" : "not_assessed") ||
    plan.upstreamStatus.coEventReview !==
      (coEventBound ? "occurrence_work_only" : "not_assessed") ||
    plan.upstreamStatus.coEventRelationAnalysis !==
      (plan.binding.coEventRelationAnalysisComplete === true
        ? "researcher_reviewed"
        : "not_assessed")
  ) throw new Error("Screen 5 upstream status does not match its immutable bindings.");
  if (
    plan.binding.coEventRelationAnalysisComplete === true && !coEventBound
  ) throw new Error("Screen 5 relation review cannot be complete without Screen 4.");
  const relationReferences =
    plan.binding.coEventRelationReviewReferences ?? [];
  const relationIds = relationReferences.map(
    ({ reviewId }) => reviewId,
  );
  if (new Set(relationIds).size !== relationIds.length) {
    throw new Error("Screen 5 relation-review references must be unique.");
  }
  for (const reference of relationReferences) {
    requireBoundedIdentifier(
      reference.reviewId,
      "Screen 5 relation-review id",
    );
    requireBoundedIdentifier(
      reference.candidateId,
      "Screen 5 relation-review candidate id",
    );
    requireFingerprint(
      reference.reviewFingerprint,
      "Screen 5 relation-review fingerprint",
    );
  }
  if (designBound) {
    requireBoundedIdentifier(
      plan.binding.designSetSnapshotId!,
      "Screen 5 design-set snapshot id",
    );
    requireFingerprint(
      plan.binding.designSetFingerprint!,
      "Screen 5 design-set fingerprint",
    );
    requireBoundedIdentifier(
      plan.binding.designDecisionSnapshotId!,
      "Screen 5 design-decision snapshot id",
    );
    requireFingerprint(
      plan.binding.designDecisionFingerprint!,
      "Screen 5 design-decision fingerprint",
    );
  }
  if (coEventBound) {
    requireBoundedIdentifier(
      plan.binding.coEventSnapshotId!,
      "Screen 5 co-event snapshot id",
    );
    requireFingerprint(
      plan.binding.coEventFingerprint!,
      "Screen 5 co-event fingerprint",
    );
  }
}

function requireProviderSnapshots(plan: MechanismLiteraturePlan) {
  const expected = [
    {
      id: "openalex",
      provider: "OpenAlex",
      role: "primary_scholarly_discovery_and_open_location",
    },
    {
      id: "crossref",
      provider: "Crossref",
      role: "bibliographic_identity_and_update_metadata",
    },
  ] as const;
  plan.providerCapabilities.forEach((provider, index) => {
    const identity = expected[index];
    if (
      !identity || provider.id !== identity.id ||
      provider.provider !== identity.provider || provider.role !== identity.role ||
      !SOURCE_CAPABILITY_STATUSES.includes(provider.status) ||
      (provider.status === "not_configured" && provider.configured) ||
      (provider.status === "healthy" &&
        (!provider.tested || !provider.enabled)) ||
      (provider.enabled && !provider.implemented)
    ) throw new Error("Screen 5 scholarly provider snapshot is invalid.");
    requireText(
      provider.adapterVersion,
      `Screen 5 ${provider.provider} adapter version`,
      500,
    );
    requireText(
      provider.limitation,
      `Screen 5 ${provider.provider} limitation`,
      2_000,
    );
  });
}

export function validateMechanismLiteraturePlan(
  plan: MechanismLiteraturePlan,
) {
  if (
    plan.schemaVersion !== SIX_SCREEN_MECHANISM_LITERATURE_PLAN_VERSION ||
    plan.planFingerprint !== fingerprintSixScreenValue(planBody(plan))
  ) throw new Error("Screen 5 literature-plan fingerprint is invalid.");
  requireBoundedIdentifier(plan.snapshotId, "Screen 5 literature-plan snapshot id");
  requireCanonicalInstant(plan.createdAt, "Screen 5 literature-plan createdAt");
  requireFingerprint(
    plan.binding.identityFingerprint,
    "Screen 5 literature-plan identity fingerprint",
  );
  requireFingerprint(
    plan.binding.eventCardReference.eventCardFingerprint,
    "Screen 5 Event Card fingerprint",
  );
  requireFingerprint(
    plan.binding.eventCardReference.referenceFingerprint,
    "Screen 5 Event Card reference fingerprint",
  );
  requireBoundedIdentifier(
    plan.binding.eventCardReference.eventCardSnapshotId,
    "Screen 5 Event Card snapshot id",
  );
  requireBoundedIdentifier(
    plan.binding.eventCardReference.reviewId,
    "Screen 5 Event Card review id",
  );
  if (
    plan.binding.identityFingerprint !==
      plan.binding.eventCardReference.binding.identityFingerprint ||
    !Number.isSafeInteger(plan.binding.studyRevision) ||
    plan.binding.studyRevision < 0
  ) throw new Error("Screen 5 literature-plan parent binding is invalid.");
  requireBindingPairs(plan);
  validateMechanismLiteraturePlanInput(plan.input);
  if (
    !Number.isSafeInteger(plan.ordinal) || plan.ordinal < 1 ||
    plan.rows.length !== MECHANISM_LITERATURE_BRANCHES.length ||
    plan.rows.some((row, index) =>
      row.branch !== MECHANISM_LITERATURE_BRANCHES[index] ||
      row.outcome.status !== "not_started" ||
      row.outcome.scholarlyRecordIds.length !== 0 ||
      row.outcome.inspectedTextIds.length !== 0) ||
    plan.providerCapabilities.length !== 2 ||
    !plan.policyPremises.length ||
    plan.intelligenceAnalysis.status !== "blocked" ||
    plan.intelligenceAnalysis.reason !==
      "genuine_intelligence_path_unverified" ||
    plan.retrievalProfile.profileName !== "mechanism-standard" ||
    plan.retrievalProfile.totalSourceQueries !== 16 ||
    plan.retrievalProfile.totalMetadataRecords !== 80 ||
    plan.retrievalProfile.documentAttempts !== 16 ||
    plan.retrievalProfile.usefulDocuments !== 8 ||
    plan.retrievalProfile.citationNeighborhoodHopLimit !== 1 ||
    plan.evidenceStatus.suppliedWorks !==
      (plan.input.suppliedWorks.length ? "not_inspected" : "none_supplied") ||
    plan.evidenceStatus.scholarlyMetadata !== "not_retrieved" ||
    plan.evidenceStatus.scholarlyText !== "not_inspected" ||
    plan.claimBoundary !== MECHANISM_LITERATURE_CLAIM_BOUNDARY ||
    !["yes", "no", "not_disclosed"].includes(
      plan.study.resultsPreviouslyInspected,
    ) ||
    serializedBytes(plan) > SIX_SCREEN_MECHANISM_LITERATURE_MAX_BYTES
  ) throw new Error("Screen 5 literature plan is invalid or exceeds its bounded contract.");
  requireProviderSnapshots(plan);
  requireText(plan.policy.officialTitle, "Screen 5 policy title", 2_000);
  requireText(plan.policy.issuer, "Screen 5 policy issuer", 1_000);
  requireText(
    plan.policy.issuingJurisdiction,
    "Screen 5 policy jurisdiction",
    1_000,
  );
  requireText(plan.policy.episode, "Screen 5 policy episode", 1_000);
  requireUniqueTextList(
    plan.policy.formalIdentifiers,
    "Screen 5 policy formal identifiers",
    24,
  );
  requireText(plan.study.outcome, "Screen 5 outcome", 2_000);
  requireText(plan.study.intendedConstruct, "Screen 5 intended construct", 2_000);
  requireUniqueTextList(plan.limitations, "Screen 5 limitations", 12);
  const premiseIds = plan.policyPremises.map(({ claimId }) => claimId);
  if (new Set(premiseIds).size !== premiseIds.length) {
    throw new Error("Screen 5 policy-premise ids must be unique.");
  }
  for (const premise of plan.policyPremises) {
    requireBoundedIdentifier(premise.claimId, "Screen 5 policy-premise claim id");
    requireText(premise.predicate, "Screen 5 policy-premise predicate", 500);
    requireText(
      premise.sourceStatement,
      "Screen 5 policy-premise source statement",
      4_000,
    );
    requireText(
      premise.effectiveStatement,
      "Screen 5 policy-premise effective statement",
      4_000,
    );
    if (
      !premise.passageIds.length || !premise.documentVersionIds.length ||
      !premise.sourceIds.length || premise.supportStatus === "unsupported" ||
      !["accepted", "corrected", "provisional"].includes(
        premise.reviewDecision,
      )
    ) {
      throw new Error(
        "Screen 5 policy premise must retain reviewed source, document, and passage lineage.",
      );
    }
    for (const [values, label] of [
      [premise.passageIds, "passage"],
      [premise.documentVersionIds, "document-version"],
      [premise.sourceIds, "source"],
      [premise.conflictIds, "conflict"],
    ] as const) {
      if (new Set(values).size !== values.length) {
        throw new Error(`Screen 5 policy-premise ${label} ids must be unique.`);
      }
      values.forEach((value) => requireBoundedIdentifier(
        value,
        `Screen 5 policy-premise ${label} id`,
      ));
    }
  }
  const hasQualifiedPremise = plan.policyPremises.some((premise) =>
    premise.reviewDecision === "provisional" ||
    premise.statementOrigin === "researcher_supplied" ||
    premise.supportStatus === "conflicting" || premise.conflictIds.length > 0);
  if (
    plan.evidenceStatus.policyPremises !==
      (hasQualifiedPremise
        ? "reviewed_with_qualifications"
        : "reviewed_source_linked") ||
    plan.policyPremises.some((premise) =>
      (premise.reviewDecision === "corrected") !==
        (premise.statementOrigin === "researcher_supplied"))
  ) throw new Error("Screen 5 policy-premise review status is inconsistent.");
  for (const [index, row] of plan.rows.entries()) {
    requireBoundedIdentifier(row.id, "Screen 5 literature-plan row id");
    requireText(row.question, "Screen 5 literature-plan question", 2_000);
    requireUniqueTextList(row.queryConcepts, "Screen 5 query concepts", 24);
    const expectedLimit = MECHANISM_LITERATURE_BRANCH_LIMITS[index]!;
    if (
      row.id !== `${plan.snapshotId}-${row.branch}` ||
      !row.queryConcepts.length ||
      !sameOrderedValues(row.policyPremiseClaimIds, premiseIds) ||
      row.providers.length !== plan.providerCapabilities.length ||
      row.providers.some((route, providerIndex) => {
        const provider = plan.providerCapabilities[providerIndex];
        return !provider || route.id !== provider.id ||
          route.role !== provider.role ||
          route.capabilityStatus !== provider.status ||
          route.plannedOperation !== "search_records";
      }) ||
      row.plannedLimit.sourceQueries !== expectedLimit.sourceQueries ||
      row.plannedLimit.metadataRecords !== expectedLimit.metadataRecords ||
      row.outcome.note !==
        "This branch is saved but has not executed a provider query."
    ) throw new Error("Screen 5 literature-plan provider route is invalid.");
  }
  return plan;
}

export function validateMechanismLiteraturePlanCollection(input: {
  plans: readonly MechanismLiteraturePlan[];
  eventCardReviews: readonly PolicyEventCardReviewState[];
  designSets: readonly CausalDesignSet[];
  designDecisions: readonly CausalDesignDecision[];
  coEventMatrices: readonly CoEventSearchMatrix[];
  coEventExecutions: readonly CoEventSearchExecution[];
  coEventRelationReviews?: readonly CoEventRelationReview[];
}) {
  if (input.plans.length > SIX_SCREEN_MECHANISM_LITERATURE_MAX_REVISIONS) {
    throw new Error("Stored Screen 5 literature-plan history exceeds its bounded limit.");
  }
  const snapshotIds = new Set<string>();
  input.plans.forEach((plan, index) => {
    validateMechanismLiteraturePlan(plan);
    if (snapshotIds.has(plan.snapshotId) || plan.ordinal !== index + 1) {
      throw new Error("Stored Screen 5 literature-plan history is inconsistent.");
    }
    snapshotIds.add(plan.snapshotId);
    const eventCard = input.eventCardReviews.find((review) =>
      review.lockedEventCard?.snapshotId ===
        plan.binding.eventCardReference.eventCardSnapshotId);
    const expectedEventCardReference = eventCard?.lockedEventCard
      ? createPolicyEventCardReference({ review: eventCard })
      : null;
    if (
      !eventCard?.lockedEventCard || !expectedEventCardReference ||
      eventCard.lockedEventCard.eventCardFingerprint !==
        plan.binding.eventCardReference.eventCardFingerprint ||
      expectedEventCardReference.referenceFingerprint !==
        plan.binding.eventCardReference.referenceFingerprint
    ) throw new Error("Stored Screen 5 literature plan lost its Event Card lineage.");
    if (plan.binding.designSetSnapshotId) {
      const designSet = input.designSets.find(({ snapshotId }) =>
        snapshotId === plan.binding.designSetSnapshotId);
      const decision = input.designDecisions.find(({ snapshotId }) =>
        snapshotId === plan.binding.designDecisionSnapshotId);
      if (
        !designSet || !decision ||
        designSet.designSetFingerprint !== plan.binding.designSetFingerprint ||
        decision.designSetSnapshotId !== designSet.snapshotId ||
        decision.designSetFingerprint !== designSet.designSetFingerprint ||
        decision.decisionFingerprint !==
          plan.binding.designDecisionFingerprint
      ) throw new Error("Stored Screen 5 literature plan lost its design lineage.");
    }
    if (plan.binding.coEventSnapshotId) {
      const execution = input.coEventExecutions.find(({ snapshotId }) =>
        snapshotId === plan.binding.coEventSnapshotId);
      const matrix = input.coEventMatrices.find(({ snapshotId }) =>
        snapshotId === plan.binding.coEventSnapshotId);
      const fingerprint = execution?.executionFingerprint ??
        matrix?.matrixFingerprint;
      if (fingerprint !== plan.binding.coEventFingerprint) {
        throw new Error("Stored Screen 5 literature plan lost its co-event lineage.");
      }
    }
    for (const reference of
      plan.binding.coEventRelationReviewReferences ?? []) {
      const relationReview = (input.coEventRelationReviews ?? []).find(
        ({ id }) => id === reference.reviewId,
      );
      if (
        !relationReview ||
        relationReview.reviewFingerprint !== reference.reviewFingerprint ||
        relationReview.binding.candidateId !== reference.candidateId ||
        relationReview.decision !== reference.decision ||
        relationReview.relation.category !== reference.category
      ) {
        throw new Error(
          "Stored Screen 5 literature plan lost its co-event relation lineage.",
        );
      }
    }
  });
  return input;
}
