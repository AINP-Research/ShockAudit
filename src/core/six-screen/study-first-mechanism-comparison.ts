import { fingerprintSixScreenValue } from "./canonical";
import type { Screen5ProposedDirectionWire } from "./screen5-mechanism";
import type { StudyFirstEventContext } from
  "./study-first-event-investigation";
import {
  validateScreen5MechanismExecution,
  type Screen5MechanismExecution,
} from "./screen5-mechanism";
import {
  HISTORICAL_SCREEN5_MODEL,
  isHistoricalScreen5Provider,
  type HistoricalScreen5Model,
  type HistoricalScreen5Provider,
} from "./screen5-historical-record";

export const STUDY_FIRST_MECHANISM_INPUT_VERSION =
  "screen-05-study-first-mechanism-input-v1" as const;
export const STUDY_FIRST_SCHOLARLY_WORK_VERSION =
  "screen-05-study-first-scholarly-work-v1" as const;
export const STUDY_FIRST_MECHANISM_RUN_VERSION =
  "screen-05-study-first-mechanism-run-v5" as const;
export const STUDY_FIRST_THEORETICAL_PROBLEM_VERSION =
  "screen-05-theoretical-problem-v1" as const;
export const STUDY_FIRST_MECHANISM_PLAN_VERSION =
  "screen-05-theoretical-plan-v1" as const;
export const STUDY_FIRST_MECHANISM_MAX_HISTORY = 24;

export type StudyFirstMechanismInput = {
  schemaVersion: typeof STUDY_FIRST_MECHANISM_INPUT_VERSION;
  id: string;
  revision: number;
  contextFingerprint: string;
  theoreticalPerspective: string | null;
  proposedMechanism: string;
  origin: "researcher_ui";
  savedAt: string;
  inputFingerprint: string;
};

export type StudyFirstMechanismInputAssessment = {
  status: "ready" | "needs_clarification";
  clarification: string | null;
  processSignals: string[];
};

/** A bibliographic lead supplied by the Screen 5 language model. It is kept
 * separate from provider-inspected evidence: the citation can help the
 * researcher locate relevant scholarship, but ShockAudit does not represent
 * it as independently verified or as proof of the complete pathway. */
export type StudyFirstSuggestedCitation = {
  id: string;
  authors: string[];
  publicationYear: number;
  title: string;
  publicationVenue: string;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  doi: string | null;
  stableUrl: string | null;
  citationLabel: string;
  fullCitation: string;
  supportScope: string;
  verificationStatus: "model_suggested_unverified";
};

export const STUDY_FIRST_EVIDENCE_INTENTS = [
  "focal_link",
  "analogous_process",
  "alternative_pathway",
  "contrary_or_boundary",
  "distinguishing_observation",
  "direct_x_y_open_ended",
] as const;

export type StudyFirstEvidenceIntent =
  (typeof STUDY_FIRST_EVIDENCE_INTENTS)[number];

export type StudyFirstTheoreticalProblem = {
  schemaVersion: typeof STUDY_FIRST_THEORETICAL_PROBLEM_VERSION;
  id: string;
  contextFingerprint: string;
  inputFingerprint: string;
  policy: {
    id: string;
    officialTitle: string;
    episode: string;
    identityFingerprint: string;
  };
  theoreticalChange: {
    originalText: string | null;
    constructLabel: string | null;
    direction: "increase" | "decrease" | "change" | "unknown";
    directionText: string | null;
    basis: "explicit_user" | "unresolved";
    fieldRefs: string[];
    shockToConstructFit: "proposed_only" | "uncertain";
    fitExplanation: string;
  };
  outcome: {
    concept: string;
    measure: string | null;
  };
  focal: {
    originalText: string;
    perspective: string | null;
  };
  unresolvedInputs: Array<{ fieldRef: string; issue: string }>;
  problemFingerprint: string;
};

export type StudyFirstMechanismPlan = {
  schemaVersion: typeof STUDY_FIRST_MECHANISM_PLAN_VERSION;
  conceptualQuestion: string;
  relationshipInterpretation: {
    theoreticalChange: string;
    direction: "increase" | "decrease" | "change" | "unknown";
    outcomeEndpoint: string;
    policyToConstructQualification: string;
    sourceFieldRefs: string[];
  };
  candidates: Array<{
    id: string;
    conceptLabel: string;
    actor: string;
    processNodes: string[];
    /** Material condition supplied by the bounded planner (absent on legacy plans). */
    condition?: string;
    /** Model proposal, not an observed effect. Absent on previously saved plans. */
    proposedDirection?: Screen5ProposedDirectionWire;
    contextualConditions: string[];
    distinctionFromFocal: string;
    perspective: string | null;
    perspectiveOrigin:
      | "researcher_supplied"
      | "analyst_suggested"
      | "not_assigned";
    relationToFocal:
      | "competing_same_pattern"
      | "complementary"
      | "offsetting"
      | "unresolved";
    hypothesisStatus: "provisional";
    /** Present on plans generated after the model-citation migration. */
    suggestedCitations?: StudyFirstSuggestedCitation[];
  }>;
  /** Present on plans generated after the model-citation migration. */
  focalSuggestedCitations?: StudyFirstSuggestedCitation[];
  /** Planner's explicit breadth check. Older saved plans omit this field. */
  breadthQualification?: string;
  supplementaryAccounts: Array<{
    id: string;
    category:
      | "boundary_condition"
      | "independent_event"
      | "measurement_or_composition"
      | "other_policy_component";
    label: string;
    explanation: string;
  }>;
  evidenceNeeds: Array<{
    id: string;
    candidateId: string | null;
    propositionToInvestigate: string;
    purpose: "support" | "challenge" | "boundary" | "distinguish";
    priority: "high" | "medium" | "low";
  }>;
  queryIntents: Array<{
    id: string;
    intent: StudyFirstEvidenceIntent;
    conceptGroups: string[][];
    scopeTerms: string[];
    evidenceNeedIds: string[];
    /** Explicit coverage carried into the four-operation query compiler. */
    candidateIds?: string[];
  }>;
  limitations: string[];
  planFingerprint: string;
};

export type StudyFirstScholarlyWork = {
  schemaVersion: typeof STUDY_FIRST_SCHOLARLY_WORK_VERSION;
  id: string;
  providerIds: Array<{
    provider: "openalex" | "crossref";
    nativeId: string;
  }>;
  doi: string | null;
  title: string;
  authors: string[];
  publicationYear: number | null;
  publicationVenue: string | null;
  publisher: string;
  workType: string | null;
  stableLocators: string[];
  versionCaveat: string | null;
  updateOrRetraction: {
    retractedFlag: "flagged" | "not_flagged" | "not_checked";
    updateRelations: Array<{
      relationType: string;
      relatedDoi: string | null;
      label: string | null;
    }>;
  };
  access: {
    level: "abstract_inspected" | "metadata_only";
    abstractText: string | null;
    abstractSource:
      | "openalex_abstract_inverted_index"
      | "crossref_member_deposit"
      | "frozen_primary_excerpt"
      | null;
    reportedOpenLocations: Array<{
      url: string;
      version: string | null;
      license: string | null;
      locationKind: "landing_page" | "pdf" | "openalex_content";
      followed: false;
    }>;
  };
  claimBoundary: string;
  workFingerprint: string;
};

export type StudyFirstMechanismSearchAttempt = {
  provider: "openalex" | "crossref";
  queryId?: string;
  candidateIds?: string[];
  evidenceNeedIds?: string[];
  intent?: StudyFirstEvidenceIntent |
    "focal_process" |
    "same_outcome_rival" |
    "boundary_or_distinguishing_observation";
  query: string;
  status: "completed" | "failed" | "not_configured";
  requestUrl: string | null;
  recordsReceived: number;
  recordsRetained: number;
  /** Canonical, deduplicated work identities retained from this exact query.
   * Absent on historical records created before query-to-work provenance. */
  retainedWorkIds?: string[];
  abstractsInspected: number;
  failureReason: string | null;
};

export type StudyFirstMechanismRun = {
  schemaVersion:
    | typeof STUDY_FIRST_MECHANISM_RUN_VERSION
    | "screen-05-study-first-mechanism-run-v4"
    | "screen-05-study-first-mechanism-run-v3"
    | "screen-05-study-first-mechanism-run-v2"
    | "screen-05-study-first-mechanism-run-v1";
  id: string;
  ordinal: number;
  previousRunId: string | null;
  context: StudyFirstEventContext;
  input: StudyFirstMechanismInput;
  inputAssessment: StudyFirstMechanismInputAssessment;
  theoreticalProblem?: StudyFirstTheoreticalProblem;
  planning?: {
    status:
      | "not_started"
      | "available_via_signed_host_task"
      | "available_via_direct_provider"
      | "completed";
    /** Absent on historical records; new records make the execution owner explicit. */
    origin?: "chatgpt_host" | HistoricalScreen5Provider | "openai" |
      "test_probe_boundary";
    taskId: string | null;
    resultId: string | null;
    providerAttemptId?: string | null;
    plan: StudyFirstMechanismPlan | null;
    limitation: string;
  };
  /** Server-owned direct-provider checkpoints. Never contains credentials. */
  providerExecution?: Screen5MechanismExecution;
  /** Provider migration provenance; the source host run remains immutable. */
  executionLineage?: {
    kind: "direct_provider_migration";
    sourceRunId: string;
    sourceRunFingerprint: string;
    migrationKey: string;
    targetProvider: HistoricalScreen5Provider | "openai";
    targetModel: HistoricalScreen5Model | "gpt-6-luna";
    migratedAt: string;
  };
  searchPlan: {
    queries: string[];
    providerQueryCeiling: 2;
    providerOperationCeiling?: 4;
    intentQueries?: Array<{
      queryId?: string;
      candidateIds?: string[];
      evidenceNeedIds?: string[];
      intent:
        | StudyFirstEvidenceIntent
        | "focal_process"
        | "same_outcome_rival"
        | "boundary_or_distinguishing_observation";
      provider: "openalex" | "crossref";
      query: string;
    }>;
    metadataRecordCeiling: 10;
    abstractInspectionCeiling: 10;
    publicationWindowRule:
      "study_period_does_not_limit_scholarship_publication_year";
  };
  attempts: StudyFirstMechanismSearchAttempt[];
  works: StudyFirstScholarlyWork[];
  status:
    | "planning_ready"
    | "needs_clarification"
    | "scholarly_evidence_ready"
    | "metadata_only"
    | "completed_no_records"
    | "retrieval_partial"
    | "retrieval_unavailable";
  hostComparison: {
    status:
      | "not_started"
      | "planning_required"
      | "available_via_signed_host_task";
    taskId: string | null;
    limitation: string;
  };
  phases?: {
    retrieval: "not_started" | "complete" | "partial" | "failed" | "not_needed";
    textInspection: "not_started" | "complete" | "partial" | "failed" | "not_needed";
    screening: "not_started" | "complete" | "partial" | "failed" | "not_needed";
    synthesis: "pending" | "complete" | "failed" | "unavailable" | "not_needed";
    validation: "pending" | "complete" | "failed" | "unavailable" | "not_needed";
    presentation: "pending" | "complete" | "partial" | "failed" | "not_needed";
  };
  createdAt: string;
  runFingerprint: string;
};

function canonicalText(value: string | null | undefined, maximum: number) {
  if (value === null || value === undefined) return null;
  const normalized = value.normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/\s+/gu, " ").trim();
  if (!normalized || normalized.length > maximum) return null;
  return normalized;
}

function exactResearcherText(
  value: string | null | undefined,
  maximum: number,
) {
  if (value === null || value === undefined || value.trim() === "") return null;
  if (
    value.length > maximum ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
  ) return null;
  return value;
}

function directionFromExplicitText(value: string | null) {
  if (!value) {
    return {
      direction: "unknown" as const,
      directionText: null,
    };
  }
  const normalized = value.normalize("NFKC");
  if (/\b(?:increase[ds]?|increasing|higher|strengthen(?:ed|ing)?|expand(?:ed|ing)?)\b/iu.test(normalized)) {
    return { direction: "increase" as const, directionText: value };
  }
  if (/\b(?:decrease[ds]?|decreasing|lower|reduce[ds]?|reducing|weaken(?:ed|ing)?|contract(?:ed|ing)?)\b/iu.test(normalized)) {
    return { direction: "decrease" as const, directionText: value };
  }
  if (/\b(?:change[ds]?|changing|shift(?:ed|ing)?|alter(?:ed|ing)?)\b/iu.test(normalized)) {
    return { direction: "change" as const, directionText: value };
  }
  return { direction: "unknown" as const, directionText: null };
}

function theoreticalProblemBody(problem: StudyFirstTheoreticalProblem) {
  const { problemFingerprint: _fingerprint, ...body } = problem;
  return body;
}

export function createStudyFirstTheoreticalProblem(input: {
  id: string;
  context: StudyFirstEventContext;
  mechanismInput: StudyFirstMechanismInput;
}) {
  validateStudyFirstMechanismInput(input.mechanismInput);
  if (
    input.mechanismInput.contextFingerprint !==
      input.context.contextFingerprint
  ) {
    throw new Error("Screen 5 theoretical problem has stale study context.");
  }
  const originalText = input.context.study.policySideConcept;
  const explicitDirection = directionFromExplicitText(originalText);
  const unresolvedInputs: StudyFirstTheoreticalProblem["unresolvedInputs"] = [];
  if (!originalText) {
    unresolvedInputs.push({
      fieldRef: "study.policySideConcept",
      issue:
        "The policy-side theoretical change X was not supplied; the policy title cannot substitute for it.",
    });
  }
  if (explicitDirection.direction === "unknown") {
    unresolvedInputs.push({
      fieldRef: "study.policySideConcept.direction",
      issue:
        "The direction of the policy-side theoretical change is unresolved and must remain conditional.",
    });
  }
  if (!input.context.study.outcomeMeasure) {
    unresolvedInputs.push({
      fieldRef: "study.outcomeMeasure",
      issue:
        "No separate outcome measure was supplied; the saved outcome concept is the endpoint.",
    });
  }
  const body = {
    schemaVersion: STUDY_FIRST_THEORETICAL_PROBLEM_VERSION,
    id: input.id,
    contextFingerprint: input.context.contextFingerprint,
    inputFingerprint: input.mechanismInput.inputFingerprint,
    policy: {
      id: input.context.policy.id,
      officialTitle: input.context.policy.officialTitle,
      episode: input.context.policy.episode,
      identityFingerprint: input.context.policy.identityFingerprint,
    },
    theoreticalChange: {
      originalText,
      // Preserve the exact researcher field. A model may offer a clearer
      // paraphrase in derived output, but it cannot overwrite X here.
      constructLabel: originalText,
      direction: explicitDirection.direction,
      directionText: explicitDirection.directionText,
      basis: originalText ? "explicit_user" as const : "unresolved" as const,
      fieldRefs: originalText ? ["study.policySideConcept"] : [],
      shockToConstructFit: originalText
        ? "proposed_only" as const
        : "uncertain" as const,
      fitExplanation: originalText
        ? "The researcher supplied this policy-side theoretical change; the saved policy record does not by itself establish a pure intervention on that construct."
        : "The selected policy is preserved as the institutional episode, but no policy-side construct X was supplied.",
    },
    outcome: {
      concept: input.context.study.outcome,
      measure: input.context.study.outcomeMeasure,
    },
    focal: {
      originalText: input.mechanismInput.proposedMechanism,
      perspective: input.mechanismInput.theoreticalPerspective,
    },
    unresolvedInputs,
  };
  return {
    ...body,
    problemFingerprint: fingerprintSixScreenValue(body),
  } satisfies StudyFirstTheoreticalProblem;
}

export function validateStudyFirstTheoreticalProblem(
  problem: StudyFirstTheoreticalProblem,
) {
  if (
    problem.schemaVersion !== STUDY_FIRST_THEORETICAL_PROBLEM_VERSION ||
    problem.problemFingerprint !== fingerprintSixScreenValue(
      theoreticalProblemBody(problem),
    )
  ) throw new Error("Screen 5 theoretical-problem fingerprint is invalid.");
  return problem;
}

function mechanismPlanBody(plan: StudyFirstMechanismPlan) {
  const { planFingerprint: _fingerprint, ...body } = plan;
  return body;
}

export function createStudyFirstMechanismPlan(input: Omit<
  StudyFirstMechanismPlan,
  "schemaVersion" | "planFingerprint"
>) {
  const body = {
    schemaVersion: STUDY_FIRST_MECHANISM_PLAN_VERSION,
    ...structuredClone(input),
  };
  const plan = {
    ...body,
    planFingerprint: fingerprintSixScreenValue(body),
  } satisfies StudyFirstMechanismPlan;
  return validateStudyFirstMechanismPlan(plan);
}

export function validateStudyFirstMechanismPlan(
  plan: StudyFirstMechanismPlan,
) {
  const candidateIds = new Set(plan.candidates.map(({ id }) => id));
  const evidenceNeedIds = new Set(plan.evidenceNeeds.map(({ id }) => id));
  const validSuggestedCitation = (citation: StudyFirstSuggestedCitation) =>
    citation.verificationStatus === "model_suggested_unverified" &&
    citation.authors.length > 0 &&
    citation.authors.every((author) => Boolean(canonicalText(author, 240))) &&
    Number.isSafeInteger(citation.publicationYear) &&
    citation.publicationYear >= 1000 &&
    Boolean(canonicalText(citation.title, 700)) &&
    Boolean(canonicalText(citation.publicationVenue, 500)) &&
    Boolean(canonicalText(citation.citationLabel, 500)) &&
    Boolean(canonicalText(citation.fullCitation, 1_500)) &&
    Boolean(canonicalText(citation.supportScope, 900));
  const citationGroups = [
    ...(plan.focalSuggestedCitations
      ? [plan.focalSuggestedCitations] : []),
    ...plan.candidates.flatMap((candidate) => candidate.suggestedCitations
      ? [candidate.suggestedCitations] : []),
  ];
  if (
    plan.schemaVersion !== STUDY_FIRST_MECHANISM_PLAN_VERSION ||
    plan.planFingerprint !== fingerprintSixScreenValue(mechanismPlanBody(plan)) ||
    (plan.breadthQualification !== undefined &&
      !canonicalText(plan.breadthQualification, 1_500)) ||
    plan.candidates.length > 10 || plan.supplementaryAccounts.length > 6 ||
    plan.evidenceNeeds.length > 20 || plan.queryIntents.length > 12 ||
    candidateIds.size !== plan.candidates.length ||
    new Set(plan.supplementaryAccounts.map(({ id }) => id)).size !==
      plan.supplementaryAccounts.length ||
    new Set(plan.evidenceNeeds.map(({ id }) => id)).size !==
      plan.evidenceNeeds.length ||
    new Set(plan.queryIntents.map(({ id }) => id)).size !==
      plan.queryIntents.length ||
    !plan.queryIntents.some(({ intent }) =>
      intent === "direct_x_y_open_ended") ||
    !plan.queryIntents.some(({ intent }) =>
      intent === "contrary_or_boundary") ||
    plan.evidenceNeeds.some(({ candidateId }) =>
      candidateId !== null && !candidateIds.has(candidateId)) ||
    plan.queryIntents.some(({ candidateIds: covered = [] }) =>
      covered.some((id) => !candidateIds.has(id))) ||
    plan.queryIntents.flatMap(({ evidenceNeedIds: ids }) => ids)
      .some((id) => !evidenceNeedIds.has(id)) ||
    citationGroups.some((citations) => citations.length > 1 ||
      citations.some((citation) => !validSuggestedCitation(citation)))
  ) throw new Error("Screen 5 theoretical plan is invalid or incomplete.");
  return plan;
}

function inputBody(input: StudyFirstMechanismInput) {
  const { inputFingerprint: _fingerprint, ...body } = input;
  return body;
}

export function assessStudyFirstMechanismInput(input: {
  theoreticalPerspective: string | null;
  proposedMechanism: string;
  policyTitle: string;
  outcome: string;
}) : StudyFirstMechanismInputAssessment {
  const mechanism = canonicalText(input.proposedMechanism, 4_000) ?? "";
  const perspective = canonicalText(input.theoreticalPerspective, 1_000);
  const normalized = mechanism.toLocaleLowerCase("en-US");
  const words = normalized.match(/[\p{L}\p{N}]+/gu) ?? [];
  const processPatterns: Array<[string, RegExp]> = [
    ["causal connector", /\b(?:because|through|via|thereby|leading to|results? in|which changes?|which affects?)\b/iu],
    ["response verb", /\b(?:changes?|increases?|reduces?|alters?|raises?|lowers?|adapts?|responds?|invests?|hires?|spends?|trusts?|retains?|avoids?|uses?)\b/iu],
    ["explicit chain", /(?:->|→|⇒)/u],
  ];
  const processSignals = processPatterns.filter(([, pattern]) =>
    pattern.test(mechanism)).map(([label]) => label);
  const sameAsLabel = [input.policyTitle, input.outcome, perspective]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.trim().toLocaleLowerCase("en-US") === normalized);
  // A process can be concise or written outside the small English verb list.
  // The guard rejects bare labels, while arrows/connectors, response verbs, or
  // a minimally developed phrase are enough to start evidence discovery.
  const compactChain = processSignals.includes("explicit chain") ||
    processSignals.includes("causal connector");
  const labelLike = (words.length <= 2 && !compactChain) ||
    (words.length <= 3 && processSignals.length === 0);
  if (!labelLike && words.length >= 3 && processSignals.length === 0) {
    processSignals.push("concise process phrase");
  }
  const ready = words.length >= 2 && !labelLike && !sameAsLabel;
  return ready
    ? { status: "ready", clarification: null, processSignals }
    : {
        status: "needs_clarification",
        clarification:
          "Describe who responds to the policy, what they do or perceive, and how that intermediate process could reach the saved outcome. A theory name, policy title, or final outcome alone does not specify a mechanism.",
        processSignals,
      };
}

export function createStudyFirstMechanismInput(input: {
  id: string;
  revision: number;
  contextFingerprint: string;
  theoreticalPerspective: string | null;
  proposedMechanism: string;
  savedAt: string;
}) {
  const perspective = exactResearcherText(
    input.theoreticalPerspective,
    1_000,
  );
  const mechanism = exactResearcherText(input.proposedMechanism, 4_000);
  if (
    (input.theoreticalPerspective?.trim() && !perspective) ||
    !mechanism
  ) {
    throw new Error(
      "Screen 5 perspective or proposed mechanism is empty, malformed, or too long.",
    );
  }
  if (!Number.isSafeInteger(input.revision) || input.revision < 1) {
    throw new Error("Screen 5 mechanism input revision is invalid.");
  }
  const body = {
    schemaVersion: STUDY_FIRST_MECHANISM_INPUT_VERSION,
    id: input.id,
    revision: input.revision,
    contextFingerprint: input.contextFingerprint,
    theoreticalPerspective: perspective,
    proposedMechanism: mechanism,
    origin: "researcher_ui" as const,
    savedAt: input.savedAt,
  };
  return {
    ...body,
    inputFingerprint: fingerprintSixScreenValue(body),
  } satisfies StudyFirstMechanismInput;
}

export function validateStudyFirstMechanismInput(
  input: StudyFirstMechanismInput,
) {
  if (
    input.schemaVersion !== STUDY_FIRST_MECHANISM_INPUT_VERSION ||
    input.inputFingerprint !== fingerprintSixScreenValue(inputBody(input))
  ) throw new Error("Screen 5 mechanism input fingerprint is invalid.");
  return input;
}

export function validateStudyFirstMechanismInputs(
  inputs: readonly StudyFirstMechanismInput[],
) {
  if (inputs.length > STUDY_FIRST_MECHANISM_MAX_HISTORY) {
    throw new Error("Screen 5 mechanism-input history exceeds its bound.");
  }
  for (const [index, input] of inputs.entries()) {
    validateStudyFirstMechanismInput(input);
    if (input.revision !== index + 1) {
      throw new Error("Screen 5 mechanism-input revision history is invalid.");
    }
  }
  return inputs;
}

function workBody(work: StudyFirstScholarlyWork) {
  const { workFingerprint: _fingerprint, ...body } = work;
  return body;
}

export function createStudyFirstScholarlyWork(input: Omit<
  StudyFirstScholarlyWork,
  "schemaVersion" | "workFingerprint"
>) {
  const body = {
    schemaVersion: STUDY_FIRST_SCHOLARLY_WORK_VERSION,
    ...structuredClone(input),
  };
  return {
    ...body,
    workFingerprint: fingerprintSixScreenValue(body),
  } satisfies StudyFirstScholarlyWork;
}

function runBody(run: StudyFirstMechanismRun) {
  const { runFingerprint: _fingerprint, ...body } = run;
  return body;
}

export function createStudyFirstMechanismRun(input: Omit<
  StudyFirstMechanismRun,
  "schemaVersion" | "runFingerprint"
>) {
  validateStudyFirstMechanismInput(input.input);
  if (input.input.contextFingerprint !== input.context.contextFingerprint) {
    throw new Error("Screen 5 mechanism input and frozen study context differ.");
  }
  if (input.theoreticalProblem) {
    validateStudyFirstTheoreticalProblem(input.theoreticalProblem);
    if (
      input.theoreticalProblem.contextFingerprint !==
        input.context.contextFingerprint ||
      input.theoreticalProblem.inputFingerprint !== input.input.inputFingerprint
    ) throw new Error("Screen 5 theoretical problem has stale lineage.");
  }
  if (input.planning?.plan) {
    validateStudyFirstMechanismPlan(input.planning.plan);
  }
  if (
    input.planning?.status === "completed" &&
    (!input.planning.plan || (
        isHistoricalScreen5Provider(input.planning.origin) ||
          input.planning.origin === "openai"
        ? !input.planning.providerAttemptId || input.planning.taskId !== null ||
          input.planning.resultId !== null
        : input.planning.origin === "test_probe_boundary"
          ? input.planning.taskId !== null || input.planning.resultId !== null ||
            input.planning.providerAttemptId != null
          : !input.planning.taskId || !input.planning.resultId
    ))
  ) throw new Error("Screen 5 completed planning has incomplete lineage.");
  if (input.providerExecution) {
    validateScreen5MechanismExecution(input.providerExecution);
    if (
      input.providerExecution.inputFingerprint !== input.input.inputFingerprint ||
      input.providerExecution.problemFingerprint !==
        input.theoreticalProblem?.problemFingerprint
    ) throw new Error("Screen 5 provider execution has stale lineage.");
  }
  if (
    input.executionLineage && (
      input.executionLineage.kind !== "direct_provider_migration" ||
      !(
        (isHistoricalScreen5Provider(input.executionLineage.targetProvider) &&
          input.executionLineage.targetModel === HISTORICAL_SCREEN5_MODEL) ||
        (input.executionLineage.targetProvider === "openai" &&
          input.executionLineage.targetModel === "gpt-6-luna")
      ) ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u.test(
        input.executionLineage.sourceRunId,
      ) ||
      !/^fnv1a64:[0-9a-f]{16}$/u.test(
        input.executionLineage.sourceRunFingerprint,
      ) ||
      !/^fnv1a64:[0-9a-f]{16}$/u.test(input.executionLineage.migrationKey) ||
      !Number.isFinite(Date.parse(input.executionLineage.migratedAt)) ||
      !input.providerExecution ||
      input.planning?.origin !== input.executionLineage.targetProvider
    )
  ) throw new Error("Screen 5 provider-migration lineage is invalid.");
  if (
    input.planning?.status === "completed" &&
    (isHistoricalScreen5Provider(input.planning.origin) ||
      input.planning.origin === "openai") &&
    !input.providerExecution?.attempts.some((attempt) =>
      attempt.id === input.planning?.providerAttemptId &&
      attempt.stage === "planning" && attempt.status === "succeeded"
    )
  ) throw new Error("Screen 5 direct planning has no validated attempt lineage.");
  const body = {
    schemaVersion: STUDY_FIRST_MECHANISM_RUN_VERSION,
    ...structuredClone(input),
  };
  return {
    ...body,
    runFingerprint: fingerprintSixScreenValue(body),
  } satisfies StudyFirstMechanismRun;
}

export function validateStudyFirstMechanismRuns(
  runs: readonly StudyFirstMechanismRun[],
) {
  if (runs.length > STUDY_FIRST_MECHANISM_MAX_HISTORY) {
    throw new Error("Screen 5 mechanism-run history exceeds its bound.");
  }
  for (const run of runs) {
    if (
      ![
        STUDY_FIRST_MECHANISM_RUN_VERSION,
        "screen-05-study-first-mechanism-run-v4",
        "screen-05-study-first-mechanism-run-v3",
        "screen-05-study-first-mechanism-run-v2",
        "screen-05-study-first-mechanism-run-v1",
      ].includes(run.schemaVersion) ||
      run.runFingerprint !== fingerprintSixScreenValue(runBody(run))
    ) throw new Error("Screen 5 mechanism-run fingerprint is invalid.");
    validateStudyFirstMechanismInput(run.input);
    if (run.theoreticalProblem) {
      validateStudyFirstTheoreticalProblem(run.theoreticalProblem);
      if (
        run.theoreticalProblem.contextFingerprint !==
          run.context.contextFingerprint ||
        run.theoreticalProblem.inputFingerprint !== run.input.inputFingerprint
      ) throw new Error("Screen 5 theoretical problem has stale lineage.");
    }
    if (
      run.planning?.status === "completed" &&
      (!run.planning.plan || (
        isHistoricalScreen5Provider(run.planning.origin) ||
          run.planning.origin === "openai"
          ? !run.planning.providerAttemptId || run.planning.taskId !== null ||
            run.planning.resultId !== null
          : run.planning.origin === "test_probe_boundary"
            ? run.planning.taskId !== null || run.planning.resultId !== null ||
              run.planning.providerAttemptId != null
            : !run.planning.taskId || !run.planning.resultId
      ))
    ) {
      throw new Error("Screen 5 completed planning has incomplete lineage.");
    }
    if (run.planning?.plan) validateStudyFirstMechanismPlan(run.planning.plan);
    if (run.providerExecution) {
      validateScreen5MechanismExecution(run.providerExecution);
      if (
        run.providerExecution.inputFingerprint !== run.input.inputFingerprint ||
        run.providerExecution.problemFingerprint !==
          run.theoreticalProblem?.problemFingerprint
      ) throw new Error("Screen 5 provider execution has stale lineage.");
    }
    if (run.executionLineage) {
      const source = runs.find(({ id }) =>
        id === run.executionLineage?.sourceRunId
      );
      if (
        run.executionLineage.kind !== "direct_provider_migration" ||
        !(
          (isHistoricalScreen5Provider(run.executionLineage.targetProvider) &&
            run.executionLineage.targetModel === HISTORICAL_SCREEN5_MODEL) ||
          (run.executionLineage.targetProvider === "openai" &&
            run.executionLineage.targetModel === "gpt-6-luna")
        ) ||
        !/^fnv1a64:[0-9a-f]{16}$/u.test(
          run.executionLineage.migrationKey,
        ) ||
        !Number.isFinite(Date.parse(run.executionLineage.migratedAt)) ||
        !run.providerExecution ||
        run.planning?.origin !== run.executionLineage.targetProvider ||
        (runs.length > 1 && !source) ||
        (source && (
          source.runFingerprint !==
            run.executionLineage.sourceRunFingerprint ||
          source.input.inputFingerprint !== run.input.inputFingerprint ||
          source.context.contextFingerprint !== run.context.contextFingerprint
        ))
      ) throw new Error("Screen 5 provider-migration lineage is invalid.");
    }
    if (
      run.planning?.status === "completed" &&
      (isHistoricalScreen5Provider(run.planning.origin) ||
        run.planning.origin === "openai") &&
      !run.providerExecution?.attempts.some((attempt) =>
        attempt.id === run.planning?.providerAttemptId &&
        attempt.stage === "planning" && attempt.status === "succeeded"
      )
    ) throw new Error("Screen 5 direct planning has no validated attempt lineage.");
    for (const work of run.works) {
      if (
        work.schemaVersion !== STUDY_FIRST_SCHOLARLY_WORK_VERSION ||
        work.workFingerprint !== fingerprintSixScreenValue(workBody(work))
      ) throw new Error("Screen 5 scholarly-work fingerprint is invalid.");
    }
  }
  return runs;
}

export function currentStudyFirstMechanismRun(input: {
  runs: readonly StudyFirstMechanismRun[] | undefined;
  contextFingerprint: string | null;
}) {
  if (!input.contextFingerprint) return null;
  return [...(input.runs ?? [])].reverse().find((run) =>
    run.context.contextFingerprint === input.contextFingerprint
  ) ?? null;
}
