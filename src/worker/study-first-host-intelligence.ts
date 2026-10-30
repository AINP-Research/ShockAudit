import { z } from "zod";

import {
  fingerprintHostReasoningValue,
  type HostReasoningTask,
  type HostReasoningTaskType,
} from "../core/host-reasoning-task";
import { fingerprintSixScreenValue } from
  "../core/six-screen/canonical";
import type { SixScreenWorkflowState } from
  "../core/six-screen/contracts";
import { currentStudyFirstEventInvestigation } from
  "../core/six-screen/study-first-event-investigation";
import {
  currentProposedTreatmentTiming,
  currentScreen3StudyEntryContext,
  currentStudyDesignAdvice,
  currentStudyDesignSelection,
} from "../core/six-screen/study-design-advice";
import { currentStudyFirstMechanismRunForState } from
  "../core/six-screen/workflow";
import {
  createStudyFirstMechanismPlan,
  createStudyFirstTheoreticalProblem,
} from "../core/six-screen/study-first-mechanism-comparison";

export const SCREEN04_STUDY_EVENT_ASSESSMENT_TASK =
  "screen04-study-event-assessment" as const;
export const SCREEN05_STUDY_MECHANISM_COMPARISON_TASK =
  "screen05-study-mechanism-comparison" as const;
export const SCREEN05_THEORETICAL_PLANNING_TASK =
  "screen05-theoretical-planning" as const;
export const STUDY_FIRST_HOST_TASK_TYPES = [
  SCREEN04_STUDY_EVENT_ASSESSMENT_TASK,
  SCREEN05_THEORETICAL_PLANNING_TASK,
  SCREEN05_STUDY_MECHANISM_COMPARISON_TASK,
] as const;
export type StudyFirstHostTaskType =
  (typeof STUDY_FIRST_HOST_TASK_TYPES)[number];

export const SCREEN04_STUDY_EVENT_ASSESSMENT_SUBMISSION_SCHEMA_VERSION =
  "screen04-study-event-assessment-submission-v2" as const;
export const SCREEN05_STUDY_MECHANISM_COMPARISON_SUBMISSION_SCHEMA_VERSION =
  "screen05-study-mechanism-comparison-submission-v2" as const;
export const SCREEN05_THEORETICAL_PLANNING_SUBMISSION_SCHEMA_VERSION =
  "screen05-theoretical-planning-submission-v1" as const;
export const SCREEN04_STUDY_EVENT_ASSESSMENT_RESULT_SCHEMA_VERSION =
  "shockaudit-screen04-study-event-assessment-result-v2" as const;
export const SCREEN05_STUDY_MECHANISM_COMPARISON_RESULT_SCHEMA_VERSION =
  "shockaudit-screen05-study-mechanism-comparison-result-v2" as const;
export const SCREEN05_THEORETICAL_PLANNING_RESULT_SCHEMA_VERSION =
  "shockaudit-screen05-theoretical-planning-result-v1" as const;
export const SCREEN04_STUDY_EVENT_ASSESSMENT_PROMPT_VERSION =
  "screen04-study-event-assessment-prompt-v2" as const;
export const SCREEN05_STUDY_MECHANISM_COMPARISON_PROMPT_VERSION =
  "screen05-study-mechanism-comparison-prompt-v2" as const;
export const SCREEN05_THEORETICAL_PLANNING_PROMPT_VERSION =
  "screen05-theoretical-planning-v1" as const;

const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u);
const fingerprint = z.string().regex(
  /^(?:fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})$/u,
);
const text = (maximum: number) => z.string().trim().min(1).max(maximum);
const nullableText = (maximum: number) => text(maximum).nullable();
const hostModel = z.literal("host_model_not_exposed");
const conditionalFit = z.enum([
  "documented",
  "plausible_with_condition",
  "unknown",
  "outside_scope",
]);
const relationshipType = z.enum([
  "potential_independent_event",
  "related_policy_stage",
  "possible_downstream_response",
  "comparison_exposure_or_spillover",
  "measurement_or_sample_change",
  "uncertain",
]);

const policyFacts = z.object({
  id: identifier,
  officialTitle: text(500),
  issuer: text(300),
  issuingJurisdiction: text(300),
  episode: text(500),
  versionScope: text(500),
  formalIdentifiers: z.array(text(300)).max(20),
}).strict();

const studyFacts = z.object({
  population: text(1_000),
  analysisUnit: nullableText(500),
  geography: z.array(text(500)).max(30),
  industry: z.array(text(500)).max(30),
  period: z.object({ start: text(40), end: text(40) }).strict(),
  outcome: text(1_000),
  outcomeMeasure: nullableText(1_000),
  intendedConstruct: nullableText(1_000),
  policySideConcept: nullableText(1_000),
  initialExplanation: nullableText(2_000),
  proposedTreatment: nullableText(1_000),
  proposedComparison: nullableText(1_000),
  resultsPreviouslyInspected: z.enum(["yes", "no", "not_disclosed"]),
  methodSelection: z.object({
    mode: z.enum(["selected", "no_selection"]),
    optionId: nullableText(300),
  }).strict().nullable(),
}).strict();

const sourceFact = z.object({
  sourceId: identifier,
  title: text(500),
  publisher: text(300),
  locator: text(2_048),
  publicationDate: nullableText(40),
  retrievedAt: text(40),
  factText: nullableText(2_500),
}).strict();

const dimensionalFit = z.object({
  populationOrActivity: conditionalFit,
  analysisLevel: conditionalFit,
  geography: conditionalFit,
  industry: conditionalFit,
  temporalContrast: conditionalFit,
  outcomeOrMeasure: conditionalFit,
  groupDifferential: conditionalFit,
}).strict();

export const screen04StudyEventAssessmentFactsSchema = z.object({
  schemaVersion: z.literal("shockaudit-screen04-study-event-assessment-facts-v2"),
  taskQuestion: z.literal(
    "Assess how this source-documented event could relate to the exact proposed study while separating facts, hypotheses, and unresolved links.",
  ),
  contextFingerprint: fingerprint,
  policy: policyFacts,
  study: studyFacts,
  timing: z.object({
    mode: z.enum(["year", "undecided", "varies_by_group"]),
    year: z.number().int().nullable(),
    precision: z.enum(["year", "unknown", "varies_by_group"]),
  }).strict(),
  event: z.object({
    id: identifier,
    title: text(1_000),
    summary: text(3_000),
    typedDates: z.array(z.object({
      kind: text(100),
      value: text(40),
      precision: text(80),
    }).strict()).max(16),
    sources: z.array(sourceFact).min(1).max(16),
  }).strict(),
  documentaryRecord: z.object({
    documentEventDistinction: z.object({
      documentRole: text(100),
      publicationDate: nullableText(40),
      substantiveOccurrenceDate: nullableText(40),
      dateRoleStatus: text(100),
      explanation: text(1_500),
    }).strict(),
    discoveryBranches: z.array(text(100)).max(8),
    priorRuleStatus: z.literal("unverified_discovery_signal_not_an_answer"),
  }).strict(),
  interpretationBoundary: z.literal(
    "The host may propose a conditional study-linked assessment but cannot verify sample exposure, classify a confounder, choose a control, determine effect direction, or make a researcher decision.",
  ),
}).strict();

const hostChainLink = z.object({
  from: text(500),
  to: text(500),
  status: z.enum(["source_documented", "analyst_hypothesis", "unresolved"]),
  sourceIds: z.array(identifier).max(8),
  assumption: nullableText(1_000),
}).strict();

export const screen04StudyEventAssessmentProposalSchema = z.object({
  screeningDisposition: z.enum([
    "main",
    "background",
    "excluded",
    "unresolved",
  ]),
  relationshipType,
  focalRelation: z.object({
    status: z.enum(["source_linked", "not_established", "unresolved"]),
    targetInstrument: nullableText(500),
    sourceIds: z.array(identifier).max(8),
    explanation: text(1_500),
  }).strict(),
  documentedChange: text(2_000),
  relevanceArgument: text(2_500),
  comparisonImplication: text(2_000),
  argumentLinks: z.array(hostChainLink).max(6),
  dimensionalFit,
  timingRole: text(1_500),
  materialLimitations: z.array(text(800)).min(1).max(8),
  nextChecks: z.array(text(800)).max(4),
  sourceIds: z.array(identifier).min(1).max(12),
  causalStatus: z.literal("conditional_assessment_not_classification"),
  hostModel,
}).strict();

export const screen04StudyEventAssessmentResultSchema = z.object({
  schemaVersion: z.literal(
    SCREEN04_STUDY_EVENT_ASSESSMENT_RESULT_SCHEMA_VERSION,
  ),
  intelligenceKind: z.literal("study_event_assessment"),
  origin: z.literal("chatgpt-host"),
  nonCanonical: z.literal(true),
  taskInputFingerprint: fingerprint,
  contextFingerprintInspected: fingerprint,
  eventFingerprintInspected: fingerprint,
  sourcePoolFingerprintInspected: fingerprint,
  ...screen04StudyEventAssessmentProposalSchema.omit({ hostModel: true }).shape,
  scientificMutation: z.literal("none"),
  researcherDecision: z.literal("none"),
  outcomeValuesInspected: z.literal(false),
  hostModel,
}).strict();

const theoreticalProblemFact = z.object({
  schemaVersion: z.literal("screen-05-theoretical-problem-v1"),
  id: identifier,
  contextFingerprint: fingerprint,
  inputFingerprint: fingerprint,
  policy: z.object({
    id: identifier,
    officialTitle: text(500),
    episode: text(500),
    identityFingerprint: fingerprint,
  }).strict(),
  theoreticalChange: z.object({
    originalText: nullableText(1_000),
    constructLabel: nullableText(1_000),
    direction: z.enum(["increase", "decrease", "change", "unknown"]),
    directionText: nullableText(1_000),
    basis: z.enum(["explicit_user", "unresolved"]),
    fieldRefs: z.array(text(120)).max(8),
    shockToConstructFit: z.enum(["proposed_only", "uncertain"]),
    fitExplanation: text(1_500),
  }).strict(),
  outcome: z.object({
    concept: text(1_000),
    measure: nullableText(1_000),
  }).strict(),
  focal: z.object({
    originalText: text(4_000),
    perspective: nullableText(1_000),
  }).strict(),
  unresolvedInputs: z.array(z.object({
    fieldRef: text(120),
    issue: text(1_000),
  }).strict()).max(12),
  problemFingerprint: fingerprint,
}).strict();

const planningCandidate = z.object({
  id: identifier,
  conceptLabel: text(300),
  actor: text(500),
  processNodes: z.array(text(700)).min(3).max(6),
  contextualConditions: z.array(text(800)).max(8),
  distinctionFromFocal: text(1_000),
  perspective: nullableText(500),
  perspectiveOrigin: z.enum([
    "researcher_supplied",
    "analyst_suggested",
    "not_assigned",
  ]),
  relationToFocal: z.enum([
    "competing_same_pattern",
    "complementary",
    "offsetting",
    "unresolved",
  ]),
  hypothesisStatus: z.literal("provisional"),
}).strict();

const planningEvidenceNeed = z.object({
  id: identifier,
  candidateId: identifier.nullable(),
  propositionToInvestigate: text(1_200),
  purpose: z.enum(["support", "challenge", "boundary", "distinguish"]),
  priority: z.enum(["high", "medium", "low"]),
}).strict();

const planningQueryIntent = z.object({
  id: identifier,
  intent: z.enum([
    "focal_link",
    "analogous_process",
    "alternative_pathway",
    "contrary_or_boundary",
    "distinguishing_observation",
    "direct_x_y_open_ended",
  ]),
  conceptGroups: z.array(z.array(text(200)).min(1).max(6)).min(1).max(4),
  scopeTerms: z.array(text(200)).max(8),
  evidenceNeedIds: z.array(identifier).max(12),
}).strict();

export const screen05TheoreticalPlanningFactsSchema = z.object({
  schemaVersion: z.literal("shockaudit-screen05-theoretical-planning-facts-v1"),
  taskQuestion: z.literal(
    "Plan distinct intervening-process hypotheses for the exact saved theoretical change X, focal process M0, outcome Y, and proposed study context before scholarly retrieval.",
  ),
  contextFingerprint: fingerprint,
  theoreticalProblem: theoreticalProblemFact,
  policy: policyFacts,
  study: studyFacts,
  timing: z.object({
    mode: z.enum(["year", "undecided", "varies_by_group"]),
    year: z.number().int().nullable(),
    precision: z.enum(["year", "unknown", "varies_by_group"]),
  }).strict(),
  policyEvidenceContext: z.object({
    status: text(120),
    snapshotId: identifier.nullable(),
    limitation: nullableText(1_500),
  }).strict(),
  upstreamEventLimitations: z.array(text(1_000)).max(12),
  planCapacity: z.object({
    candidateCeiling: z.literal(6),
    evidenceNeedCeiling: z.literal(20),
    queryIntentCeiling: z.literal(8),
    providerOperationCeiling: z.literal(4),
  }).strict(),
  interpretationBoundary: z.literal(
    "This is pre-retrieval conceptual planning. Every candidate is a hypothesis. No scholarly work, author, DOI, finding, effect, sample value, or source-explicit theory may be invented.",
  ),
}).strict();

export const screen05TheoreticalPlanningProposalSchema = z.object({
  conceptualQuestion: text(1_500),
  relationshipInterpretation: z.object({
    theoreticalChange: text(1_000),
    direction: z.enum(["increase", "decrease", "change", "unknown"]),
    outcomeEndpoint: text(1_000),
    policyToConstructQualification: text(1_500),
    sourceFieldRefs: z.array(text(120)).max(12),
  }).strict(),
  candidates: z.array(planningCandidate).max(6),
  supplementaryAccounts: z.array(z.object({
    id: identifier,
    category: z.enum([
      "boundary_condition",
      "independent_event",
      "measurement_or_composition",
      "other_policy_component",
    ]),
    label: text(300),
    explanation: text(1_200),
  }).strict()).max(6),
  evidenceNeeds: z.array(planningEvidenceNeed).max(20),
  queryIntents: z.array(planningQueryIntent).min(2).max(8),
  limitations: z.array(text(1_000)).min(1).max(10),
  hostModel,
}).strict();

export const screen05TheoreticalPlanningResultSchema = z.object({
  schemaVersion: z.literal(
    SCREEN05_THEORETICAL_PLANNING_RESULT_SCHEMA_VERSION,
  ),
  intelligenceKind: z.literal("theoretical_mechanism_plan"),
  origin: z.literal("chatgpt-host"),
  nonCanonical: z.literal(true),
  taskInputFingerprint: fingerprint,
  problemFingerprintInspected: fingerprint,
  mechanismInputFingerprintInspected: fingerprint,
  sourcePoolFingerprintInspected: fingerprint,
  ...screen05TheoreticalPlanningProposalSchema.omit({ hostModel: true }).shape,
  planFingerprint: fingerprint,
  scientificMutation: z.literal("none"),
  researcherDecision: z.literal("none"),
  outcomeValuesInspected: z.literal(false),
  hostModel,
}).strict();

const scholarlyWorkFact = z.object({
  workId: identifier,
  title: text(1_000),
  authors: z.array(text(300)).max(30),
  publicationYear: z.number().int().nullable(),
  venue: nullableText(500),
  doi: nullableText(300),
  accessLevel: z.enum(["abstract_inspected", "metadata_only"]),
  abstractText: nullableText(8_000),
  abstractSource: z.enum([
    "openalex_abstract_inverted_index",
    "crossref_member_deposit",
  ]).nullable(),
  retractedFlag: z.enum(["flagged", "not_flagged", "not_checked"]),
  versionCaveat: nullableText(1_000),
  claimBoundary: text(1_500),
}).strict();

export const screen05StudyMechanismComparisonFactsSchema = z.object({
  schemaVersion: z.literal(
    "shockaudit-screen05-study-mechanism-comparison-facts-v2",
  ),
  taskQuestion: z.literal(
    "Compare the saved focal process with nonredundant alternatives supported by the inspected scholarly text and identify observations that could distinguish them in this proposed study.",
  ),
  contextFingerprint: fingerprint,
  mechanismRunFingerprint: fingerprint,
  theoreticalProblem: theoreticalProblemFact,
  mechanismPlan: z.object({
    schemaVersion: z.literal("screen-05-theoretical-plan-v1"),
    ...screen05TheoreticalPlanningProposalSchema.omit({ hostModel: true }).shape,
    planFingerprint: fingerprint,
  }).strict(),
  policy: policyFacts,
  study: studyFacts,
  timing: z.object({
    mode: z.enum(["year", "undecided", "varies_by_group"]),
    year: z.number().int().nullable(),
    precision: z.enum(["year", "unknown", "varies_by_group"]),
  }).strict(),
  researcherInput: z.object({
    inputFingerprint: fingerprint,
    inputRevision: z.number().int().min(1),
    theoreticalPerspective: nullableText(1_000),
    proposedMechanism: text(4_000),
  }).strict(),
  works: z.array(scholarlyWorkFact).max(10),
  upstreamEventLimitations: z.array(text(1_000)).max(12),
  interpretationBoundary: z.literal(
    "The host must evaluate the unchanged theoretical problem and provisional plan against the full frozen study context and actually inspected abstracts. Metadata-only leads support no detailed scholarly claim. Zero evidence permits explicit analytical hypotheses but not invented citations. The result is a conditional comparison, not a mediation estimate, causal finding, popularity ranking, or researcher decision.",
  ),
}).strict();

const mechanismCard = z.object({
  id: identifier,
  conceptLabel: text(300),
  perspective: nullableText(500),
  perspectiveOrigin: z.enum([
    "researcher_supplied",
    "source_explicit",
    "analyst_suggested",
    "not_assigned",
  ]),
  processChain: z.array(text(700)).min(2).max(6),
  connectedArgument: text(2_000),
  fitToStudy: text(1_500),
  evidenceStatus: z.enum([
    "source_linked",
    "analytical_hypothesis",
    "mixed",
  ]),
  propositions: z.array(z.object({
    workId: identifier,
    supportedStatement: text(1_200),
    sourceRole: z.enum(["theoretical", "empirical", "boundary", "contradictory"]),
    transferLimit: text(1_000),
  }).strict()).max(8),
  materialTransferLimit: text(1_200),
  relationToFocal: z.enum([
    "focal",
    "competing_same_pattern",
    "complementary",
    "offsetting",
    "boundary_condition",
    "measurement_alternative",
    "unresolved",
  ]),
}).strict();

const predictionRow = z.object({
  id: identifier,
  observationConcept: text(800),
  candidateMeasure: text(800),
  dataSource: nullableText(800),
  timing: text(600),
  level: text(500),
  aggregationRequirement: text(800),
  conditions: text(1_000),
  feasibility: z.enum(["unknown", "researcher_reported", "evidenced"]),
  distinction: z.enum([
    "distinguishing",
    "shared_implication",
    "not_distinguishing",
    "insufficient_evidence",
  ]),
  propositionWorkIds: z.array(identifier).max(8),
  patterns: z.array(z.object({
    mechanismId: identifier,
    expectedPattern: text(800),
  }).strict()).min(1).max(5),
}).strict();

export const screen05StudyMechanismComparisonProposalSchema = z.object({
  focal: mechanismCard.extend({ relationToFocal: z.literal("focal") }).strict(),
  alternatives: z.array(mechanismCard.extend({
    relationToFocal: z.enum([
      "competing_same_pattern",
      "complementary",
      "offsetting",
      "boundary_condition",
      "measurement_alternative",
      "unresolved",
    ]),
  }).strict()).max(4),
  predictionMatrix: z.array(predictionRow).max(10),
  overallQualification: text(1_500),
  evidenceLimitations: z.array(text(1_000)).min(1).max(10),
  causalStatus: z.literal("conditional_comparison_not_mediation_estimate"),
  hostModel,
}).strict();

export const screen05StudyMechanismComparisonResultSchema = z.object({
  schemaVersion: z.literal(
    SCREEN05_STUDY_MECHANISM_COMPARISON_RESULT_SCHEMA_VERSION,
  ),
  intelligenceKind: z.literal("study_mechanism_comparison"),
  origin: z.literal("chatgpt-host"),
  nonCanonical: z.literal(true),
  taskInputFingerprint: fingerprint,
  contextFingerprintInspected: fingerprint,
  mechanismRunFingerprintInspected: fingerprint,
  sourcePoolFingerprintInspected: fingerprint,
  ...screen05StudyMechanismComparisonProposalSchema.omit({ hostModel: true }).shape,
  scientificMutation: z.literal("none"),
  researcherDecision: z.literal("none"),
  outcomeValuesInspected: z.literal(false),
  hostModel,
}).strict();

function bounded(value: string, maximum: number) {
  const clean = value.replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/\s+/gu, " ").trim();
  if (!clean) throw new Error("A study-first host fact is empty.");
  return clean.slice(0, maximum).trimEnd();
}

function contextFacts(context: NonNullable<ReturnType<
  typeof currentStudyFirstEventInvestigation
>>["context"]) {
  return {
    contextFingerprint: context.contextFingerprint,
    policy: {
      id: context.policy.id,
      officialTitle: bounded(context.policy.officialTitle, 500),
      issuer: bounded(context.policy.issuer, 300),
      issuingJurisdiction: bounded(context.policy.issuingJurisdiction, 300),
      episode: bounded(context.policy.episode, 500),
      versionScope: bounded(context.policy.versionScope, 500),
      formalIdentifiers: context.policy.formalIdentifiers.slice(0, 20)
        .map((value) => bounded(value, 300)),
    },
    study: {
      population: bounded(context.study.population, 1_000),
      analysisUnit: context.study.analysisUnit
        ? bounded(context.study.analysisUnit, 500)
        : null,
      geography: context.study.geography.slice(0, 30)
        .map((value) => bounded(value, 500)),
      industry: context.study.industry.slice(0, 30)
        .map((value) => bounded(value, 500)),
      period: structuredClone(context.study.period),
      outcome: bounded(context.study.outcome, 1_000),
      outcomeMeasure: context.study.outcomeMeasure
        ? bounded(context.study.outcomeMeasure, 1_000)
        : null,
      // Retain the historical wire key for saved-task compatibility, but the
      // current interpretation packet has only policySideConcept as active X.
      intendedConstruct: null,
      policySideConcept: context.study.policySideConcept
        ? bounded(context.study.policySideConcept, 1_000)
        : null,
      initialExplanation: context.study.initialExplanation
        ? bounded(context.study.initialExplanation, 2_000)
        : null,
      proposedTreatment: context.study.proposedTreatment
        ? bounded(context.study.proposedTreatment, 1_000)
        : null,
      proposedComparison: context.study.proposedComparison
        ? bounded(context.study.proposedComparison, 1_000)
        : null,
      resultsPreviouslyInspected: context.study.resultsPreviouslyInspected,
      methodSelection: context.methodSelection
        ? context.methodSelection.decision.mode === "selected"
          ? {
              mode: "selected" as const,
              optionId: bounded(
                context.methodSelection.decision.optionId,
                300,
              ),
            }
          : { mode: "no_selection" as const, optionId: null }
        : null,
    },
    timing: {
      mode: context.timing.mode,
      year: context.timing.year,
      precision: context.timing.precision,
    },
  };
}

function currentInvestigation(state: SixScreenWorkflowState) {
  return currentStudyFirstEventInvestigation({
    studyFirstEventInvestigations: state.studyFirstEventInvestigations,
    confirmedShock: state.confirmedShock,
    study: state.study,
    entryContext: currentScreen3StudyEntryContext(state),
    timing: currentProposedTreatmentTiming(state),
    advice: currentStudyDesignAdvice(state),
    selection: currentStudyDesignSelection(state),
  });
}

function canonicalEventSourceId(eventId: string, sourceId: string, index: number) {
  return `event-source-${fingerprintSixScreenValue({ eventId, sourceId, index }).slice("fnv1a64:".length)}`;
}

export function buildStudyFirstHostTaskContext(
  state: SixScreenWorkflowState,
  taskType: StudyFirstHostTaskType,
  selectedEventId: string | null,
) {
  if (taskType === SCREEN04_STUDY_EVENT_ASSESSMENT_TASK) {
    const investigation = currentInvestigation(state);
    if (!investigation?.presentation || !selectedEventId ||
        !investigation.presentation.visibleEventIds.includes(selectedEventId)) {
      throw new Error("A current visible Screen 4 event is required.");
    }
    const occurrence = investigation.occurrences.find(({ id }) =>
      id === selectedEventId);
    const analysis = investigation.analyses.find(({ eventId }) =>
      eventId === selectedEventId);
    if (!occurrence || !analysis) {
      throw new Error("The selected Screen 4 event packet is incomplete.");
    }
    const sources = occurrence.evidence.map((source, index) => ({
      sourceId: canonicalEventSourceId(occurrence.id, source.sourceId, index),
      title: bounded(source.title, 500),
      publisher: bounded(source.publisher, 300),
      locator: bounded(source.locator, 2_048),
      publicationDate: source.publishedDate,
      retrievedAt: source.retrievedAt,
      factText: source.factText ? bounded(source.factText, 2_500) : null,
    }));
    const facts = screen04StudyEventAssessmentFactsSchema.parse({
      schemaVersion: "shockaudit-screen04-study-event-assessment-facts-v2",
      taskQuestion:
        "Assess how this source-documented event could relate to the exact proposed study while separating facts, hypotheses, and unresolved links.",
      ...contextFacts(investigation.context),
      event: {
        id: occurrence.id,
        title: bounded(occurrence.title, 1_000),
        summary: bounded(occurrence.description, 3_000),
        typedDates: occurrence.typedDates.map((date) => ({
          kind: date.kind,
          value: date.value,
          precision: date.precision,
        })),
        sources,
      },
      documentaryRecord: {
        documentEventDistinction: analysis.documentEventDistinction,
        discoveryBranches: analysis.branchRoles,
        priorRuleStatus: "unverified_discovery_signal_not_an_answer",
      },
      interpretationBoundary:
        "The host may propose a conditional study-linked assessment but cannot verify sample exposure, classify a confounder, choose a control, determine effect direction, or make a researcher decision.",
    });
    return {
      facts,
      allowedSourceIds: sources.map(({ sourceId }) => sourceId).sort(),
      selectedEventId: occurrence.id,
      eventFingerprint: fingerprintSixScreenValue({
        occurrenceFingerprint: occurrence.candidateFingerprint,
        analysisFingerprint: analysis.analysisFingerprint,
      }),
    };
  }

  if (taskType === SCREEN05_THEORETICAL_PLANNING_TASK) {
    const run = currentStudyFirstMechanismRunForState(state);
    if (
      !run || selectedEventId !== run.id || !run.theoreticalProblem ||
      run.status !== "planning_ready"
    ) {
      throw new Error(
        "A current pre-retrieval Screen 5 theoretical problem is required.",
      );
    }
    const upstream = currentInvestigation(state);
    const facts = screen05TheoreticalPlanningFactsSchema.parse({
      schemaVersion: "shockaudit-screen05-theoretical-planning-facts-v1",
      taskQuestion:
        "Plan distinct intervening-process hypotheses for the exact saved theoretical change X, focal process M0, outcome Y, and proposed study context before scholarly retrieval.",
      theoreticalProblem: run.theoreticalProblem,
      ...contextFacts(run.context),
      policyEvidenceContext: {
        status: run.context.evidence.status,
        snapshotId: run.context.evidence.snapshotId,
        limitation: run.context.evidence.limitation,
      },
      upstreamEventLimitations: [
        upstream?.presentation?.coverage.limitation ??
          "No current completed Screen 4 result was available.",
        "Event candidates are supplementary context, not intervening mechanisms or accepted controls.",
      ],
      planCapacity: {
        candidateCeiling: 6,
        evidenceNeedCeiling: 20,
        queryIntentCeiling: 8,
        providerOperationCeiling: 4,
      },
      interpretationBoundary:
        "This is pre-retrieval conceptual planning. Every candidate is a hypothesis. No scholarly work, author, DOI, finding, effect, sample value, or source-explicit theory may be invented.",
    });
    return {
      facts,
      allowedSourceIds: [],
      selectedEventId: run.id,
      eventFingerprint: run.runFingerprint,
    };
  }

  const run = currentStudyFirstMechanismRunForState(state);
  if (!run || selectedEventId !== run.id) {
    throw new Error("A current Screen 5 mechanism evidence run is required.");
  }
  const works = run.works.map((work) => ({
    workId: work.id,
    title: bounded(work.title, 1_000),
    authors: work.authors.slice(0, 30).map((value) => bounded(value, 300)),
    publicationYear: work.publicationYear,
    venue: work.publicationVenue ? bounded(work.publicationVenue, 500) : null,
    doi: work.doi,
    accessLevel: work.access.level,
    abstractText: work.access.abstractText
      ? bounded(work.access.abstractText, 8_000)
      : null,
    abstractSource: work.access.abstractSource,
    retractedFlag: work.updateOrRetraction.retractedFlag,
    versionCaveat: work.versionCaveat
      ? bounded(work.versionCaveat, 1_000)
      : null,
    claimBoundary: bounded(work.claimBoundary, 1_500),
  }));
  const inspectedWorkIds = works.filter(({ accessLevel, abstractText }) =>
    accessLevel === "abstract_inspected" && abstractText).map(({ workId }) =>
      workId).sort();
  const theoreticalProblem = run.theoreticalProblem ??
    createStudyFirstTheoreticalProblem({
      id: `screen5-compatibility-problem-${run.id}`,
      context: run.context,
      mechanismInput: run.input,
    });
  // Retained v1/v2 local runs predate Stage A. They remain readable and may
  // complete their already-acquired comparison through a focal-only
  // compatibility plan. New v3 runs always arrive through signed Stage A.
  const mechanismPlan = run.planning?.plan ?? createStudyFirstMechanismPlan({
    conceptualQuestion: `How could ${theoreticalProblem.theoreticalChange.originalText ?? "the unresolved policy-side change X"} affect ${theoreticalProblem.outcome.measure ?? theoreticalProblem.outcome.concept} through a process other than the saved focal mechanism?`,
    relationshipInterpretation: {
      theoreticalChange:
        theoreticalProblem.theoreticalChange.originalText ??
        "Unresolved policy-side theoretical change X",
      direction: theoreticalProblem.theoreticalChange.direction,
      outcomeEndpoint:
        theoreticalProblem.outcome.measure ?? theoreticalProblem.outcome.concept,
      policyToConstructQualification:
        theoreticalProblem.theoreticalChange.fitExplanation,
      sourceFieldRefs: theoreticalProblem.theoreticalChange.fieldRefs,
    },
    candidates: [],
    supplementaryAccounts: [],
    evidenceNeeds: [],
    queryIntents: [{
      id: "compatibility-direct-x-y",
      intent: "direct_x_y_open_ended",
      conceptGroups: [[
        theoreticalProblem.theoreticalChange.originalText ??
          "unresolved policy-side change",
      ], [theoreticalProblem.outcome.concept]],
      scopeTerms: [],
      evidenceNeedIds: [],
    }, {
      id: "compatibility-contrary-boundary",
      intent: "contrary_or_boundary",
      conceptGroups: [[run.input.proposedMechanism], ["boundary condition"]],
      scopeTerms: [],
      evidenceNeedIds: [],
    }],
    limitations: [
      "This compatibility plan preserves a retained pre-Stage-A run; it is not evidence that conceptual exploration was completed.",
    ],
  });
  const upstream = currentInvestigation(state);
  const facts = screen05StudyMechanismComparisonFactsSchema.parse({
    schemaVersion: "shockaudit-screen05-study-mechanism-comparison-facts-v2",
    taskQuestion:
      "Compare the saved focal process with nonredundant alternatives supported by the inspected scholarly text and identify observations that could distinguish them in this proposed study.",
    ...contextFacts(run.context),
    mechanismRunFingerprint: run.runFingerprint,
    theoreticalProblem,
    mechanismPlan,
    researcherInput: {
      inputFingerprint: run.input.inputFingerprint,
      inputRevision: run.input.revision,
      theoreticalPerspective: run.input.theoreticalPerspective,
      proposedMechanism: run.input.proposedMechanism,
    },
    works,
    upstreamEventLimitations: [
      upstream?.presentation?.coverage.limitation ??
        "No current completed Screen 4 result was available.",
      "Event candidates remain conditional context; none is an accepted mechanism premise or control.",
    ],
    interpretationBoundary:
      "The host must evaluate the unchanged theoretical problem and provisional plan against the full frozen study context and actually inspected abstracts. Metadata-only leads support no detailed scholarly claim. Zero evidence permits explicit analytical hypotheses but not invented citations. The result is a conditional comparison, not a mediation estimate, causal finding, popularity ranking, or researcher decision.",
  });
  return {
    facts,
    allowedSourceIds: inspectedWorkIds,
    selectedEventId: run.id,
    eventFingerprint: run.runFingerprint,
  };
}

const causalCertainty =
  /\b(?:proves?|proved|guarantees?|certainly|definitively|caused?|establishes? the causal effect|estimated mediation)\b/iu;
const certaintyNegation =
  /\b(?:does not|did not|do not|cannot|can not|not|no evidence (?:that|of)|fails? to)\s+(?:\w+\s+){0,3}(?:prove|proved|guarantee|cause|caused|establish|estimated mediation)\b/iu;
const attributedFinding =
  /\b(?:the (?:abstract|article|authors?|study|source)|[A-Z][\p{L}-]+ et al\.)\s+(?:reports?|reported|finds?|found|states?|concludes?)\b/iu;
const conditionalLanguage =
  /\b(?:may|might|could|if|possible|plausible|hypothesis|conditional|uncertain)\b/iu;

const semanticStopWords = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
  "in", "is", "it", "may", "might", "of", "on", "or", "the", "to",
  "under", "with", "study", "source", "paper", "article", "result",
]);

function semanticTokens(value: string) {
  return new Set((value.toLocaleLowerCase("en-US").match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((token) => token.length > 2 && !semanticStopWords.has(token)));
}

function tokenIntersection(left: string, right: string) {
  const rightTokens = semanticTokens(right);
  return [...semanticTokens(left)].filter((token) => rightTokens.has(token));
}

function hasUnqualifiedCausalCertainty(value: unknown) {
  return allText(value).split(/(?<=[.!?;])\s+/u).some((sentence) =>
    causalCertainty.test(sentence) && !certaintyNegation.test(sentence) &&
    !attributedFinding.test(sentence)
  );
}

function allText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(allText).join(" ");
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).map(allText).join(" ");
  }
  return "";
}

export function validateAndNormalizeStudyFirstHostResult(input: {
  task: HostReasoningTask;
  currentState: SixScreenWorkflowState;
  boundedFacts: unknown;
  proposal: unknown;
}) {
  if (!isStudyFirstHostTask(input.task.taskType)) {
    throw new Error("The task is not a study-first host assessment.");
  }
  const taskType = input.task.taskType;
  const current = buildStudyFirstHostTaskContext(
    input.currentState,
    taskType,
    input.task.selectedEventId,
  );
  const allowedSourceIds: readonly string[] = current.allowedSourceIds;
  const facts = taskType === SCREEN04_STUDY_EVENT_ASSESSMENT_TASK
    ? screen04StudyEventAssessmentFactsSchema.parse(input.boundedFacts)
    : taskType === SCREEN05_THEORETICAL_PLANNING_TASK
      ? screen05TheoreticalPlanningFactsSchema.parse(input.boundedFacts)
      : screen05StudyMechanismComparisonFactsSchema.parse(input.boundedFacts);
  if (
    fingerprintHostReasoningValue(facts) !== input.task.inputFingerprint ||
    fingerprintHostReasoningValue(current.facts) !==
      fingerprintHostReasoningValue(facts) ||
    current.selectedEventId !== input.task.selectedEventId ||
    current.eventFingerprint !== input.task.eventFingerprint ||
    fingerprintHostReasoningValue(allowedSourceIds) !==
      input.task.sourcePoolFingerprint
  ) throw new Error("The frozen study-first packet is no longer current.");

  if (taskType === SCREEN04_STUDY_EVENT_ASSESSMENT_TASK) {
    const eventFacts = screen04StudyEventAssessmentFactsSchema.parse(facts);
    const proposal = screen04StudyEventAssessmentProposalSchema.parse(
      input.proposal,
    );
    if (
      proposal.sourceIds.some((id) => !allowedSourceIds.includes(id)) ||
      proposal.argumentLinks.flatMap(({ sourceIds }) => sourceIds)
        .some((id) => !allowedSourceIds.includes(id)) ||
      proposal.focalRelation.sourceIds.some((id) =>
        !allowedSourceIds.includes(id)) ||
      proposal.argumentLinks.some((link) =>
        link.status === "source_documented" && !link.sourceIds.length) ||
      (proposal.relationshipType === "related_policy_stage" &&
        (proposal.focalRelation.status !== "source_linked" ||
          !proposal.focalRelation.targetInstrument)) ||
      ((proposal.screeningDisposition === "main" ||
        proposal.screeningDisposition === "unresolved") &&
        !conditionalLanguage.test(allText(proposal))) ||
      hasUnqualifiedCausalCertainty(proposal)
    ) throw new Error("The Screen 4 host assessment exceeded its frozen evidence boundary.");
    return screen04StudyEventAssessmentResultSchema.parse({
      schemaVersion: SCREEN04_STUDY_EVENT_ASSESSMENT_RESULT_SCHEMA_VERSION,
      intelligenceKind: "study_event_assessment",
      origin: "chatgpt-host",
      nonCanonical: true,
      taskInputFingerprint: input.task.inputFingerprint,
      contextFingerprintInspected: eventFacts.contextFingerprint,
      eventFingerprintInspected: input.task.eventFingerprint,
      sourcePoolFingerprintInspected: input.task.sourcePoolFingerprint,
      ...proposal,
      scientificMutation: "none",
      researcherDecision: "none",
      outcomeValuesInspected: false,
    });
  }

  if (taskType === SCREEN05_THEORETICAL_PLANNING_TASK) {
    const planningFacts = screen05TheoreticalPlanningFactsSchema.parse(facts);
    const proposal = screen05TheoreticalPlanningProposalSchema.parse(
      input.proposal,
    );
    const candidateIds = proposal.candidates.map(({ id }) => id);
    const evidenceNeedIds = proposal.evidenceNeeds.map(({ id }) => id);
    const focalTokens = semanticTokens(
      planningFacts.theoreticalProblem.focal.originalText,
    );
    const redundantCandidate = proposal.candidates.some((candidate) => {
      const candidateTokens = semanticTokens([
        candidate.conceptLabel,
        ...candidate.processNodes,
      ].join(" "));
      const overlap = [...candidateTokens].filter((token) =>
        focalTokens.has(token)).length;
      const denominator = Math.min(candidateTokens.size, focalTokens.size);
      return denominator > 0 && overlap / denominator >= 0.8;
    });
    const originalX =
      planningFacts.theoreticalProblem.theoreticalChange.originalText;
    const outcome = planningFacts.theoreticalProblem.outcome.concept;
    const questionCoversProblem = (!originalX || tokenIntersection(
      proposal.conceptualQuestion,
      originalX,
    ).length > 0) && tokenIntersection(
      proposal.conceptualQuestion,
      outcome,
    ).length > 0;
    const inventedCitation = /\b(?:doi\s*:|10\.\d{4,9}\/\S+|et al\.)\b/iu.test(
      allText(proposal),
    );
    if (
      proposal.relationshipInterpretation.direction !==
        planningFacts.theoreticalProblem.theoreticalChange.direction ||
      new Set(candidateIds).size !== candidateIds.length ||
      new Set(evidenceNeedIds).size !== evidenceNeedIds.length ||
      proposal.evidenceNeeds.some(({ candidateId }) =>
        candidateId !== null && !candidateIds.includes(candidateId)) ||
      proposal.queryIntents.flatMap(({ evidenceNeedIds: ids }) => ids)
        .some((id) => !evidenceNeedIds.includes(id)) ||
      !proposal.queryIntents.some(({ intent }) =>
        intent === "direct_x_y_open_ended") ||
      !proposal.queryIntents.some(({ intent }) =>
        intent === "contrary_or_boundary") ||
      redundantCandidate || !questionCoversProblem || inventedCitation ||
      hasUnqualifiedCausalCertainty(proposal)
    ) {
      throw new Error(
        "The Screen 5 theoretical plan changed the problem, duplicated the focal process, or exceeded its pre-retrieval boundary.",
      );
    }
    const { hostModel: _hostModel, ...planFields } = proposal;
    const plan = createStudyFirstMechanismPlan(planFields);
    const {
      schemaVersion: _planSchemaVersion,
      planFingerprint,
      ...normalizedPlan
    } = plan;
    return screen05TheoreticalPlanningResultSchema.parse({
      schemaVersion: SCREEN05_THEORETICAL_PLANNING_RESULT_SCHEMA_VERSION,
      intelligenceKind: "theoretical_mechanism_plan",
      origin: "chatgpt-host",
      nonCanonical: true,
      taskInputFingerprint: input.task.inputFingerprint,
      problemFingerprintInspected:
        planningFacts.theoreticalProblem.problemFingerprint,
      mechanismInputFingerprintInspected:
        planningFacts.theoreticalProblem.inputFingerprint,
      sourcePoolFingerprintInspected: input.task.sourcePoolFingerprint,
      ...normalizedPlan,
      planFingerprint,
      scientificMutation: "none",
      researcherDecision: "none",
      outcomeValuesInspected: false,
      hostModel: "host_model_not_exposed",
    });
  }

  const mechanismFacts = screen05StudyMechanismComparisonFactsSchema.parse(
    facts,
  );
  const proposal = screen05StudyMechanismComparisonProposalSchema.parse(
    input.proposal,
  );
  const mechanisms = [proposal.focal, ...proposal.alternatives];
  const mechanismIds = mechanisms.map(({ id }) => id);
  const inspectedWorks = new Map(mechanismFacts.works.flatMap((work) =>
    work.accessLevel === "abstract_inspected" && work.abstractText
      ? [[work.workId, work] as const]
      : []
  ));
  const propositionRefs = mechanisms.flatMap(({ propositions }) =>
    propositions);
  const predictionRefs = proposal.predictionMatrix.flatMap(
    ({ propositionWorkIds }) => propositionWorkIds,
  );
  const unsupportedProposition = propositionRefs.some((proposition) => {
    const work = inspectedWorks.get(proposition.workId);
    if (!work?.abstractText) return true;
    if (work.retractedFlag === "flagged" &&
        proposition.sourceRole !== "contradictory") return true;
    return tokenIntersection(
      proposition.supportedStatement,
      work.abstractText,
    ).length < 2;
  });
  const evidenceStatusMismatch = mechanisms.some((mechanism) =>
    (mechanism.evidenceStatus === "source_linked" &&
      mechanism.propositions.length === 0) ||
    (mechanism.evidenceStatus === "analytical_hypothesis" &&
      mechanism.propositions.length > 0)
  );
  const focalOverlap = tokenIntersection(
    [
      proposal.focal.conceptLabel,
      ...proposal.focal.processChain,
      proposal.focal.connectedArgument,
    ].join(" "),
    mechanismFacts.researcherInput.proposedMechanism,
  ).length;
  const redundantAlternative = proposal.alternatives.some((alternative) => {
    const focalSignature = [
      proposal.focal.conceptLabel,
      ...proposal.focal.processChain,
    ].join(" ");
    const alternativeSignature = [
      alternative.conceptLabel,
      ...alternative.processChain,
    ].join(" ");
    const focalTokens = semanticTokens(focalSignature);
    const alternativeTokens = semanticTokens(alternativeSignature);
    const overlap = [...alternativeTokens].filter((token) =>
      focalTokens.has(token)).length;
    const denominator = Math.min(focalTokens.size, alternativeTokens.size);
    return denominator > 0 && overlap / denominator >= 0.8;
  });
  if (
    new Set(mechanismIds).size !== mechanismIds.length ||
    [...propositionRefs.map(({ workId }) => workId), ...predictionRefs]
      .some((id) => !allowedSourceIds.includes(id)) ||
    unsupportedProposition || evidenceStatusMismatch || focalOverlap < 1 ||
    redundantAlternative ||
    proposal.predictionMatrix.some(({ patterns }) =>
      patterns.some(({ mechanismId }) => !mechanismIds.includes(mechanismId))) ||
    hasUnqualifiedCausalCertainty(proposal)
  ) throw new Error("The Screen 5 host comparison exceeded its frozen scholarly boundary.");
  return screen05StudyMechanismComparisonResultSchema.parse({
    schemaVersion: SCREEN05_STUDY_MECHANISM_COMPARISON_RESULT_SCHEMA_VERSION,
    intelligenceKind: "study_mechanism_comparison",
    origin: "chatgpt-host",
    nonCanonical: true,
    taskInputFingerprint: input.task.inputFingerprint,
    contextFingerprintInspected: mechanismFacts.contextFingerprint,
    mechanismRunFingerprintInspected: mechanismFacts.mechanismRunFingerprint,
    sourcePoolFingerprintInspected: input.task.sourcePoolFingerprint,
    ...proposal,
    scientificMutation: "none",
    researcherDecision: "none",
    outcomeValuesInspected: false,
  });
}

export function studyFirstHostProposalSourceIds(
  taskType: StudyFirstHostTaskType,
  proposal: unknown,
) {
  if (taskType === SCREEN04_STUDY_EVENT_ASSESSMENT_TASK) {
    const parsed = screen04StudyEventAssessmentProposalSchema.parse(proposal);
    return [...new Set([
      ...parsed.sourceIds,
      ...parsed.focalRelation.sourceIds,
      ...parsed.argumentLinks.flatMap(({ sourceIds }) => sourceIds),
    ])].sort();
  }
  if (taskType === SCREEN05_THEORETICAL_PLANNING_TASK) {
    screen05TheoreticalPlanningProposalSchema.parse(proposal);
    return [];
  }
  const parsed = screen05StudyMechanismComparisonProposalSchema.parse(proposal);
  return [...new Set([
    ...parsed.focal.propositions.map(({ workId }) => workId),
    ...parsed.alternatives.flatMap(({ propositions }) =>
      propositions.map(({ workId }) => workId)),
    ...parsed.predictionMatrix.flatMap(({ propositionWorkIds }) =>
      propositionWorkIds),
  ])].sort();
}

export function isStudyFirstHostTask(
  taskType: HostReasoningTaskType,
): taskType is StudyFirstHostTaskType {
  return STUDY_FIRST_HOST_TASK_TYPES.includes(taskType as StudyFirstHostTaskType);
}
