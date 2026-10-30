import { fingerprintSixScreenValue } from "./canonical";
import { policySearchQueryVariants } from "../policy-search-query";
import type {
  ConfirmedShock,
  StudyContext,
} from "./contracts";
import type { CoEventCandidateOccurrence } from "./co-event-execution";
import type { CoEventProviderId } from "./co-event-search";
import type {
  ProposedTreatmentTiming,
  Screen3StudyEntryContext,
  StudyDesignAdvice,
  StudyDesignSelection,
} from "./study-design-advice";

export const STUDY_FIRST_EVENT_CONTEXT_VERSION =
  "screen-04-study-first-context-v4" as const;
export const STUDY_FIRST_EVENT_PLAN_VERSION =
  "screen-04-study-first-plan-v3" as const;
export const STUDY_FIRST_EVENT_INVESTIGATION_VERSION =
  "screen-04-study-first-investigation-v1" as const;
export const STUDY_FIRST_EVENT_ANALYSIS_VERSION =
  "screen-04-study-first-conditional-analysis-v4" as const;
export const STUDY_FIRST_EVENT_PRESENTATION_VERSION =
  "screen-04-study-first-presentation-v3" as const;
export const STUDY_FIRST_EVENT_HANDOFF_VERSION =
  "screen-04-to-05-study-first-handoff-v1" as const;
/**
 * Screen 4 is relevance bounded, not quota filled. A completed scan may show
 * no alternative shock or as many as ten when the source record supports
 * them. The model never pads this list.
 */
export const STUDY_FIRST_EVENT_MAX_VISIBLE = 10;
export const STUDY_FIRST_EVENT_MAX_HISTORY = 24;
export const STUDY_FIRST_EVENT_DISCOVERY_VERSION =
  "screen-04-multisource-discovery-v6" as const;
export const STUDY_FIRST_EVENT_SOURCE_BINDING_VERSION =
  "screen-04-source-binding-v1" as const;

export const STUDY_FIRST_EVENT_BRANCHES = [
  "overlapping_policy",
  "sector_market_or_financing",
  "disaster_or_disruption",
  "comparison_spillover",
  "measurement_or_sample_shift",
  "focal_policy_lifecycle_or_litigation",
] as const;

export type StudyFirstEventBranch =
  (typeof STUDY_FIRST_EVENT_BRANCHES)[number];

export type StudyFirstEventContext = {
  schemaVersion: typeof STUDY_FIRST_EVENT_CONTEXT_VERSION |
    "screen-04-study-first-context-v3" |
    "screen-04-study-first-context-v2" | "screen-04-study-first-context-v1";
  id: string;
  runId: string;
  authorization: {
    identityRevision: number;
    selectionGeneration: number;
  };
  policy: {
    id: string;
    officialTitle: string;
    aliases: string[];
    issuer: string;
    issuingJurisdiction: string;
    episode: string;
    versionScope: string;
    formalIdentifiers: string[];
    identityFingerprint: string;
  };
  study: {
    revision: number;
    fingerprint: string;
    population: string;
    analysisUnit: string | null;
    geography: string[];
    industry: string[];
    period: { start: string; end: string };
    outcome: string;
    outcomeMeasure: string | null;
    intendedConstruct: string | null;
    policySideConcept: string | null;
    initialExplanation: string | null;
    proposedTreatment: string | null;
    proposedComparison: string | null;
    resultsPreviouslyInspected: StudyContext["resultsPreviouslyInspected"];
  };
  timing: {
    id: string;
    fingerprint: string;
    mode: ProposedTreatmentTiming["mode"];
    year: number | null;
    precision: ProposedTreatmentTiming["precision"];
  };
  evidence: {
    status: Screen3StudyEntryContext["evidence"]["status"];
    snapshotId: string | null;
    snapshotFingerprint: string | null;
    limitation: string | null;
  };
  advice: {
    adviceId: string;
    adviceFingerprint: string;
    methodLibraryVersion: string;
  };
  methodSelection: null | {
    selectionId: string;
    selectionFingerprint: string;
    decision: StudyDesignSelection["decision"];
    adviceId: string;
    adviceFingerprint: string;
    methodLibraryVersion: string;
  };
  groupsPresent: boolean;
  effectiveScope: {
    occurrenceStart: string;
    occurrenceEnd: string;
    proposedGeography: string[];
    legalCoverageStatus: "not_inferred_from_proposed_geography";
    derivedQueryAnnotations: string[];
  };
  /** Current v4 only. Legacy contexts remain readable with their own fingerprint. */
  searchConcepts?: {
    shockConstruct: string | null;
    outcome: string;
    outcomeMeasure: string | null;
    industries: string[];
    groupLabels: string[];
    year: number | null;
    threshold: string | null;
    assignmentRule: string | null;
  };
  createdAt: string;
  contextFingerprint: string;
};

export type StudyFirstEventPlanStep = {
  id: string;
  branch: StudyFirstEventBranch;
  question: string;
  providerId: CoEventProviderId | null;
  queryTerms: string[];
  affectedGroupLabels: string[];
  occurrenceWindow: { start: string; end: string };
  plannedLimit: number;
  initialStatus: "pending" | "unsupported_route";
  statusNote: string | null;
};

export type StudyFirstEventSearchPlan = {
  schemaVersion: typeof STUDY_FIRST_EVENT_PLAN_VERSION |
    "screen-04-study-first-plan-v2";
  id: string;
  contextId: string;
  contextFingerprint: string;
  steps: StudyFirstEventPlanStep[];
  budget: {
    sourceQueryCeiling: number;
    metadataCandidateCeiling: number;
    visibleEventCeiling: number;
    documentFetchCeiling?: number;
    inspectedCandidateCeiling?: number;
  };
  discoveryVersion?: typeof STUDY_FIRST_EVENT_DISCOVERY_VERSION |
    "screen-04-multisource-discovery-v5" |
    "screen-04-multisource-discovery-v4" |
    "screen-04-multisource-discovery-v3" |
    "screen-04-multisource-discovery-v2" |
    "screen-04-multisource-discovery-v1";
  sourceCapabilityVersion?: string;
  queryPlanFingerprint?: string;
  semanticRoute: {
    status: "unavailable";
    reason: "no_authorized_screen4_semantic_route";
    fallback: "conditional_library_only";
  };
  createdAt: string;
  planFingerprint: string;
};

export type StudyFirstEventSearchAttempt = {
  id: string;
  stepId: string;
  branch: StudyFirstEventBranch;
  providerId: CoEventProviderId | null;
  queryTerms: string[];
  occurrenceWindow: { start: string; end: string };
  startedAt: string;
  completedAt: string;
  requestUrl: string | null;
  outcome:
    | "candidates_found"
    | "no_match"
    | "records_unusable"
    | "source_unavailable"
    | "unsupported_route"
    | "outcome_unknown";
  recordsReceived: number;
  recordsAccepted: number;
  candidateOccurrenceIds: string[];
  note: string;
  usage: {
    sourceQueries: number;
    metadataRecords: number;
    transportHops: number;
    receivedBytes: number;
    activeResearchMs: number;
    documentAttempts?: number;
  };
  attemptFingerprint: string;
};

export type StudyFirstEventRelevanceAnalysis = {
  schemaVersion:
    | typeof STUDY_FIRST_EVENT_ANALYSIS_VERSION
    | "screen-04-study-first-conditional-analysis-v3"
    | "screen-04-study-first-conditional-analysis-v2";
  id: string;
  eventId: string;
  branchRoles: StudyFirstEventBranch[];
  interpretationMode:
    | "bounded_evidence_rules"
    | "host_model_assessment";
  relationshipType:
    | "potential_independent_event"
    | "related_policy_stage"
    | "possible_downstream_response"
    | "comparison_exposure_or_spillover"
    | "measurement_or_sample_change"
    | "uncertain";
  relationshipStatus: "hypothetical" | "partly_supported";
  eligibility: {
    status: "qualifying" | "background_lead" | "excluded";
    reason: string;
  };
  documentEventDistinction: {
    documentRole:
      | "official_rule_or_notice"
      | "incident_record"
      | "report_or_information_release"
      | "unresolved";
    publicationDate: string | null;
    substantiveOccurrenceDate: string | null;
    dateRoleStatus:
      | "distinct_dates_documented"
      | "separate_roles_same_date"
      | "publication_only"
      | "occurrence_only"
      | "unresolved";
    explanation: string;
  };
  dimensionalFit: {
    populationOrActivity: "documented" | "plausible_with_condition" | "unknown" | "outside_scope";
    analysisLevel: "documented" | "plausible_with_condition" | "unknown" | "outside_scope";
    geography: "documented" | "plausible_with_condition" | "unknown" | "outside_scope";
    industry: "documented" | "plausible_with_condition" | "unknown" | "outside_scope";
    temporalContrast: "documented" | "plausible_with_condition" | "unknown" | "outside_scope";
    outcomeOrMeasure: "documented" | "plausible_with_condition" | "unknown" | "outside_scope";
    groupDifferential: "documented" | "plausible_with_condition" | "unknown" | "outside_scope";
  };
  relevanceOrder: {
    priorityBand: "high" | "medium" | "low" | "background";
    evidenceBasis: string[];
    stableSortKey: string;
  };
  /**
   * Version 3+ separates the documentary relationship from discovery matches.
   * These fields are optional only so an already-saved v2 local study remains
   * readable; every newly generated v4 analysis supplies them.
   */
  relationshipEvidence?: {
    status: "source_linked" | "not_established";
    targetInstrument: string | null;
    sourceIds: string[];
    explanation: string;
  };
  affectedActorOrActivity?: string;
  materialUncertainty?: string;
  whatHappened: string;
  documentedFactRefs: string[];
  whyRelevant: string;
  outcomePathway: string;
  comparisonImplication: string;
  temporalInterpretation: string;
  causalChain: Array<{
    from: string;
    to: string;
    status: "source_documented" | "analyst_hypothesis" | "unresolved";
    factRefs: string[];
    assumption: string | null;
  }>;
  requiredExposureAssumptions: string[];
  directionStatus: "unknown";
  uncertainties: string[];
  nextChecks: string[];
  executionProvenance: {
    libraryVersion: typeof STUDY_FIRST_EVENT_ANALYSIS_VERSION;
    semanticRouteStatus:
      | "bounded_rules_completed"
      | "host_model_completed";
  };
  analysisFingerprint: string;
};

export type StudyFirstEventPresentation = {
  schemaVersion:
    | typeof STUDY_FIRST_EVENT_PRESENTATION_VERSION
    | "screen-04-study-first-presentation-v2";
  status:
    | "events_available"
    | "completed_zero_events"
    | "completed_partial"
    | "scan_failed";
  visibleEventIds: string[];
  overflowEventIds: string[];
  coverage: {
    attemptedBranches: StudyFirstEventBranch[];
    completedBranches: StudyFirstEventBranch[];
    unsupportedBranches: StudyFirstEventBranch[];
    failedBranches: StudyFirstEventBranch[];
    /** A source request may have run, but its result was not observed. */
    unknownBranches?: StudyFirstEventBranch[];
    sourceRoutesAttempted: number;
    sourceRoutesSucceeded: number;
    interpretation: "evidence_bounded" | "host_model_assisted";
    semanticAssessment:
      | "bounded_rules_completed"
      | "pending_host_assessment"
      | "host_model_completed"
      | "unavailable";
    phases?: {
      retrieval: "complete" | "partial" | "failed";
      inspection: "complete" | "partial" | "failed";
      screening: "complete" | "partial" | "failed";
      synthesis: "pending" | "available" | "unavailable";
      validation: "pending" | "complete" | "unavailable";
      presentation: "complete" | "partial" | "failed";
    };
    limitation: string;
  };
  completedAt: string;
  presentationFingerprint: string;
};

export type StudyFirstEventInvestigation = {
  schemaVersion: typeof STUDY_FIRST_EVENT_INVESTIGATION_VERSION;
  snapshotId: string;
  ordinal: number;
  previousSnapshotId: string | null;
  context: StudyFirstEventContext;
  plan: StudyFirstEventSearchPlan;
  status: "planned" | "running" | "completed" | "completed_partial" | "failed";
  attempts: StudyFirstEventSearchAttempt[];
  occurrences: CoEventCandidateOccurrence[];
  analyses: StudyFirstEventRelevanceAnalysis[];
  presentation: StudyFirstEventPresentation | null;
  startedAt: string | null;
  completedAt: string | null;
  investigationFingerprint: string;
};

/**
 * Scientific inputs that can change source retrieval. Method selection and
 * advice identity are deliberately absent: they may invalidate a downstream
 * interpretation without making already documented occurrences disappear.
 */
export function studyFirstEventSourceInputFingerprint(
  investigation: StudyFirstEventInvestigation,
) {
  return fingerprintSixScreenValue({
    version: STUDY_FIRST_EVENT_SOURCE_BINDING_VERSION,
    discoveryVersion: investigation.plan.discoveryVersion ?? null,
    sourceCapabilityVersion:
      investigation.plan.sourceCapabilityVersion ?? null,
    policy: {
      officialTitle: investigation.context.policy.officialTitle,
      aliases: investigation.context.policy.aliases,
      issuer: investigation.context.policy.issuer,
      issuingJurisdiction:
        investigation.context.policy.issuingJurisdiction,
      episode: investigation.context.policy.episode,
      versionScope: investigation.context.policy.versionScope,
      formalIdentifiers: investigation.context.policy.formalIdentifiers,
      identityFingerprint:
        investigation.context.policy.identityFingerprint,
    },
    study: {
      population: investigation.context.study.population,
      geography: investigation.context.study.geography,
      industry: investigation.context.study.industry,
      period: investigation.context.study.period,
      outcome: investigation.context.study.outcome,
      outcomeMeasure: investigation.context.study.outcomeMeasure,
      policySideConcept: investigation.context.study.policySideConcept,
      proposedTreatment: investigation.context.study.proposedTreatment,
      proposedComparison: investigation.context.study.proposedComparison,
    },
    timing: {
      mode: investigation.context.timing.mode,
      year: investigation.context.timing.year,
      precision: investigation.context.timing.precision,
    },
    steps: investigation.plan.steps.map(({ id: _id, ...step }) => step),
    budget: investigation.plan.budget,
  });
}

export type StudyFirstEventScreen5Handoff = {
  schemaVersion: typeof STUDY_FIRST_EVENT_HANDOFF_VERSION;
  id: string;
  contextId: string;
  contextFingerprint: string;
  investigationSnapshotId: string;
  investigationFingerprint: string;
  investigationStatus: StudyFirstEventInvestigation["status"];
  presentationFingerprint: string | null;
  visibleEventIds: string[];
  coverageLimitation: string;
  optionalMethodSelectionId: string | null;
  createdAt: string;
  handoffFingerprint: string;
};

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter(
    (value): value is string => Boolean(value),
  ))];
}

function fullDate(value: string, end: boolean) {
  if (/^\d{4}-\d{2}-\d{2}$/u.test(value)) return value;
  if (/^\d{4}-\d{2}$/u.test(value)) {
    if (!end) return `${value}-01`;
    const [year, month] = value.split("-").map(Number);
    const day = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
    return `${value}-${String(day).padStart(2, "0")}`;
  }
  if (/^\d{4}$/u.test(value)) return `${value}-${end ? "12-31" : "01-01"}`;
  throw new Error("Study-first event investigation requires a year, month, or day study boundary.");
}

function officialLegalProvider(values: string[]) {
  const normalized = values.join(" ").toLocaleLowerCase("en-US");
  if (/\b(?:alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming|district of columbia|puerto rico)\b/u.test(normalized)) {
    return "openstates" as const;
  }
  if (/united states|\bu\.?s\.?\b|\bfederal\b/u.test(normalized)) {
    return "federal_register" as const;
  }
  if (/european union|\beu\b|france|germany|spain|italy|netherlands|belgium|ireland|sweden|denmark|poland|portugal|austria|finland|czechia/u.test(normalized)) {
    return "eu_cellar" as const;
  }
  if (/united kingdom|\buk\b|\bu\.?k\.?\b/u.test(normalized)) {
    return "uk_legislation" as const;
  }
  return null;
}

function studyLegalProvider(context: Pick<StudyFirstEventContext, "study">) {
  // A proposed sample location chooses only a source to search for other
  // events. It is never promoted into a statement about focal-policy scope.
  // When the study explicitly spans the United States, retain the federal
  // route even if a treated subgroup names one state. The supplemental
  // Open States step covers state legislation without displacing it.
  const geography = context.study.geography.join(" ")
    .toLocaleLowerCase("en-US");
  if (/united states|\bu\.?s\.?\b|\bfederal\b/u.test(geography)) {
    return "federal_register" as const;
  }
  return officialLegalProvider(context.study.geography);
}

function focalPolicyLegalProvider(
  context: Pick<StudyFirstEventContext, "policy">,
) {
  // The focal lifecycle route follows the documented issuing jurisdiction,
  // not the researcher's proposed sample geography.
  return officialLegalProvider([
    context.policy.issuingJurisdiction,
    context.policy.issuer,
  ]);
}

function disasterProvider(context: Pick<StudyFirstEventContext, "study">) {
  // Disaster routing follows the proposed study geography. The focal policy's
  // issuing jurisdiction is not silently treated as the sample's location.
  const values = context.study.geography.join(" ")
    .toLocaleLowerCase("en-US");
  if (/united states|\bu\.?s\.?\b/u.test(values)) return "openfema" as const;
  return context.study.geography.length ? "gdacs" as const : null;
}

export function createStudyFirstEventContext(input: {
  runId: string;
  selectionGeneration: number;
  confirmedShock: ConfirmedShock;
  study: StudyContext;
  timing: ProposedTreatmentTiming;
  entryContext: Screen3StudyEntryContext;
  advice: StudyDesignAdvice;
  selection: StudyDesignSelection | null;
  createdAt: string;
}): StudyFirstEventContext {
  if (!input.study.population || !input.study.outcome ||
      !input.study.period.start || !input.study.period.end) {
    throw new Error("Study-first event context requires the current study scope.");
  }
  const groupsPresent = Boolean(
    input.study.proposedTreatment?.trim() &&
      input.study.proposedComparison?.trim(),
  );
  const occurrenceStart = fullDate(input.study.period.start, false);
  const occurrenceEnd = fullDate(input.study.period.end, true);
  const content = {
    schemaVersion: STUDY_FIRST_EVENT_CONTEXT_VERSION,
    runId: input.runId,
    authorization: {
      identityRevision: input.confirmedShock.confirmation.identityRevision,
      selectionGeneration: input.selectionGeneration,
    },
    policy: {
      id: input.confirmedShock.id,
      officialTitle: input.confirmedShock.officialTitle,
      aliases: [...input.confirmedShock.aliases],
      issuer: input.confirmedShock.issuer,
      issuingJurisdiction: input.confirmedShock.issuingJurisdiction,
      episode: input.confirmedShock.episode,
      versionScope: input.confirmedShock.versionScope,
      formalIdentifiers: [...input.confirmedShock.formalIdentifiers],
      identityFingerprint: input.confirmedShock.identityFingerprint,
    },
    study: {
      revision: input.study.revision,
      fingerprint: input.entryContext.studyFingerprint,
      population: input.study.population,
      analysisUnit: input.study.analysisUnit,
      geography: [...input.study.geography],
      industry: [...input.study.industry],
      period: { start: input.study.period.start, end: input.study.period.end },
      outcome: input.study.outcome,
      outcomeMeasure: input.study.outcomeMeasure ?? null,
      // Historical field is retained in the record schema for old snapshots.
      // Current analysis uses only the single policy-side shock construct.
      intendedConstruct: null,
      policySideConcept: input.study.policySideConcept ?? null,
      initialExplanation: input.study.initialExplanation,
      proposedTreatment: input.study.proposedTreatment,
      proposedComparison: input.study.proposedComparison,
      resultsPreviouslyInspected: input.study.resultsPreviouslyInspected,
    },
    timing: {
      id: input.timing.id,
      fingerprint: input.timing.timingFingerprint,
      mode: input.timing.mode,
      year: input.timing.year,
      precision: input.timing.precision,
    },
    evidence: {
      status: input.entryContext.evidence.status,
      snapshotId: input.entryContext.evidence.snapshotId,
      snapshotFingerprint: input.entryContext.evidence.snapshotFingerprint,
      limitation: input.entryContext.evidence.limitation,
    },
    advice: {
      adviceId: input.advice.adviceId,
      adviceFingerprint: input.advice.adviceFingerprint,
      methodLibraryVersion: input.advice.binding.methodLibraryVersion,
    },
    methodSelection: input.selection
      ? {
          selectionId: input.selection.id,
          selectionFingerprint: input.selection.selectionFingerprint,
          decision: structuredClone(input.selection.decision),
          adviceId: input.advice.adviceId,
          adviceFingerprint: input.advice.adviceFingerprint,
          methodLibraryVersion: input.advice.binding.methodLibraryVersion,
        }
      : null,
    groupsPresent,
    effectiveScope: {
      occurrenceStart,
      occurrenceEnd,
      proposedGeography: [...input.study.geography],
      legalCoverageStatus: "not_inferred_from_proposed_geography" as const,
      derivedQueryAnnotations: unique([
        ...input.study.industry,
        input.study.policySideConcept,
        input.study.outcome,
        input.study.proposedTreatment,
        input.study.proposedComparison,
      ]),
    },
    searchConcepts: {
      shockConstruct: input.study.policySideConcept ?? null,
      outcome: input.study.outcome,
      outcomeMeasure: input.study.outcomeMeasure ?? null,
      industries: [...input.study.industry],
      groupLabels: unique([
        input.study.proposedTreatment,
        input.study.proposedComparison,
      ]),
      year: input.timing.year,
      threshold: input.advice.clarifications.rd?.cutoff ?? null,
      assignmentRule: input.advice.clarifications.rd?.assignmentRule ?? null,
    },
  };
  const contextFingerprint = fingerprintSixScreenValue(content);
  return {
    ...content,
    id: `screen4-context-${contextFingerprint.slice("fnv1a64:".length)}`,
    createdAt: input.createdAt,
    contextFingerprint,
  };
}

function branchDefinition(
  branch: StudyFirstEventBranch,
  context: StudyFirstEventContext,
) {
  // The source endpoints search document text/title, not firm data. Group
  // labels, outcome names and all other study fields concatenated together
  // suppress relevant results without adding a meaningful source filter.
  const subject = context.study.industry[0] ??
    context.study.policySideConcept ?? "business";
  const contextWords = [context.study.policySideConcept,
    context.policy.officialTitle, context.study.initialExplanation,
    ...context.study.industry].join(" ").toLocaleLowerCase("en-US");
  const dataPractice = /privacy|consumer data|personal information|disclos|transparen|information/iu
    .test(contextWords);
  const performance = /profit|roa|return on assets|financial performance|revenue/iu
    .test([context.study.outcome, context.study.outcomeMeasure].join(" "));
  switch (branch) {
    case "overlapping_policy":
      return { question: "Which other official rules could reach the study's affected activity?", terms: [dataPractice ? "consumer privacy" : subject], provider: studyLegalProvider(context) };
    case "sector_market_or_financing":
      return { question: "Which financing changes could reach the study's activities or outcome?", terms: ["credit", "lending"], provider: studyLegalProvider(context) };
    case "disaster_or_disruption":
      return { question: "Which officially recorded disasters or disruptions occurred in the proposed geography and period?", terms: ["disaster", "disruption"], provider: disasterProvider(context) };
    case "comparison_spillover":
      return { question: "Which documented supply or data-sharing changes could reach both groups?", terms: dataPractice ? ["data sharing"] : ["supply chain"], provider: studyLegalProvider(context) };
    case "measurement_or_sample_shift":
      return { question: "Which official reporting or classification changes could alter the measured outcome or sample?", terms: performance ? ["financial reporting"] : ["reporting classification"], provider: studyLegalProvider(context) };
    case "focal_policy_lifecycle_or_litigation":
      return { question: "Which documented implementation, amendment, enforcement, or litigation stages belong to the focal policy lifecycle?", terms: [context.policy.officialTitle], provider: focalPolicyLegalProvider(context) };
  }
}

/**
 * Provider queries remain fixed and inspectable. These are bounded vocabulary
 * expansions, not model-generated searches. They improve recall for common
 * policy families whose official records use different labels.
 */
function sourceQueryVocabulary(context: StudyFirstEventContext) {
  const text = [
    context.policy.officialTitle,
    ...context.policy.aliases,
    context.study.policySideConcept,
    context.study.initialExplanation,
    ...context.study.industry,
  ].filter((value): value is string => Boolean(value?.trim()))
    .join(" ").toLocaleLowerCase("en-US");
  const themes: string[] = [];
  if (/privacy|consumer data|personal information|data protection|ccpa/iu
    .test(text)) {
    themes.push("consumer privacy", "data protection",
      "personal information", "data security");
  }
  if (/cyber|breach|information security/iu.test(text)) {
    themes.push("cybersecurity", "data breach", "information security",
      "incident disclosure");
  }
  if (/labor|employment|employee|worker|wage|salary|pay transparen|paid (?:family |sick )?leave|workplace/iu
    .test(text)) {
    themes.push("employment standards", "paid leave", "wage disclosure",
      "minimum wage", "worker protection");
  }
  if (/tax|revenue code|deduction|tax credit/iu.test(text)) {
    themes.push("business tax", "corporate tax", "tax credit",
      "tax reporting");
  }
  if (/health|medical|medicare|medicaid|insurance|hospital|pharmaceutical/iu
    .test(text)) {
    themes.push("health insurance", "health care payment",
      "medical coverage", "public health");
  }
  if (/energy|electric|power|utility|emission|climate|environment/iu
    .test(text)) {
    themes.push("energy regulation", "electricity market",
      "environmental compliance", "emissions standard");
  }
  if (/bank|credit|finance|lending|capital|securit|mortgage/iu.test(text)) {
    themes.push("financial regulation", "credit market", "lending standard",
      "capital requirement");
  }
  if (/antitrust|competition|merger|market concentration/iu.test(text)) {
    themes.push("competition policy", "merger review", "antitrust enforcement");
  }
  if (/trade|tariff|import|export|supply chain/iu.test(text)) {
    themes.push("trade restriction", "tariff", "supply chain regulation");
  }
  if (/artificial intelligence|\bai\b|algorithm|platform|technology/iu
    .test(text)) {
    themes.push("artificial intelligence", "algorithmic accountability",
      "technology platform regulation");
  }
  const expanded = policySearchQueryVariants({
    name: context.study.policySideConcept ??
      context.study.industry[0] ?? context.study.outcome,
    aliases: context.policy.aliases,
    contextTerms: [
      ...context.study.industry,
      context.study.outcome,
      context.study.outcomeMeasure ?? "",
    ],
    maximum: 10,
  });
  const focalTitle = context.policy.officialTitle
    .toLocaleLowerCase("en-US").trim();
  return unique([...themes, ...expanded, "business regulation"])
    .filter((value) => value.toLocaleLowerCase("en-US").trim() !== focalTitle)
    .slice(0, 6);
}

export function createStudyFirstEventSearchPlan(
  context: StudyFirstEventContext,
): StudyFirstEventSearchPlan {
  const earlyYear = Math.max(1000,
    Number(context.effectiveScope.occurrenceStart.slice(0, 4)) - 2);
  const legalWindow = {
    start: `${earlyYear}-01-01`,
    end: context.effectiveScope.occurrenceEnd,
  };
  const baseSteps = STUDY_FIRST_EVENT_BRANCHES.map((branch) => {
    const definition = branchDefinition(branch, context);
    const base = {
      branch,
      providerId: definition.provider,
      queryTerms: definition.terms.slice(0, 12),
      affectedGroupLabels: unique([
        context.study.proposedTreatment,
        context.study.proposedComparison,
        context.study.population,
      ]),
      occurrenceWindow: branch === "disaster_or_disruption"
        ? { start: context.effectiveScope.occurrenceStart,
          end: context.effectiveScope.occurrenceEnd }
        : branch === "focal_policy_lifecycle_or_litigation"
          ? { start: legalWindow.start,
            end: context.createdAt.slice(0, 10) }
        : { ...legalWindow },
      plannedLimit: 6,
      question: definition.question,
    };
    const stepFingerprint = fingerprintSixScreenValue({
      contextFingerprint: context.contextFingerprint,
      ...base,
    });
    return {
      id: `screen4-step-${stepFingerprint.slice("fnv1a64:".length)}`,
      ...base,
      initialStatus: definition.provider ? "pending" as const : "unsupported_route" as const,
      statusNote: definition.provider
        ? definition.provider === "federal_register" && branch !==
            "focal_policy_lifecycle_or_litigation"
          ? "Federal Register covers federal notices. The separate reviewed official index covers only its retained state events; unindexed state/local actions and nongovernment sector events remain search gaps."
          : null
        : "No enabled structured official-source adapter supports this branch for the proposed jurisdiction or geography.",
    };
  });
  const domestic = ["federal_register", "openstates"].includes(
    studyLegalProvider(context) ?? "",
  );
  const topicalQueries = sourceQueryVocabulary(context);
  // Economic routes use a saved industry when supplied. With no industry,
  // keep each provider query general rather than imputing an energy-intensive
  // sector or a particular consumer market from the outcome measure.
  const economicSubject = context.study.industry.find((value) =>
    value.trim().length > 0 && value.length <= 64)?.trim() ?? null;
  const supplementalSteps = domestic ? ([
    {
      branch: "overlapping_policy" as const,
      providerId: "reviewed_official_documents" as const,
      queryTerms: unique([
        context.study.policySideConcept,
        ...context.study.industry,
        context.study.outcome,
      ]).slice(0, 8),
      plannedLimit: 20,
      question: "Which other source-backed state or official events could reach the study's activity, groups or outcome?",
      statusNote:
        "The retained reviewed index has finite historical and jurisdiction coverage; an indexed occurrence still needs study-specific screening.",
    },
    ...topicalQueries.slice(0, 3).map((query) => ({
      branch: "overlapping_policy" as const,
      providerId: "openstates" as const,
      queryTerms: [query],
      plannedLimit: 6,
      question:
        `Which state legislative changes described as “${query}” could overlap the study?`,
      statusNote:
        "Open States supplies nationwide legislative discovery and official legislature locators. A returned bill still requires occurrence, legal-effect, and study-link review.",
    })),
    ...topicalQueries.slice(0, 2).map((query) => ({
      branch: "sector_market_or_financing" as const,
      providerId: "govinfo" as const,
      queryTerms: [query],
      plannedLimit: 6,
      question: `Which separately published federal statutes described as “${query}” could affect the study?`,
      statusNote:
        "GovInfo supplies public-law discovery and inspected original text. When configured, Congress.gov independently enriches exact GovInfo law coordinates; neither route infers firm exposure.",
    })),
    ...topicalQueries.slice(0, 3).map((query) => ({
      branch: "overlapping_policy" as const,
      providerId: "federal_register" as const,
      queryTerms: [query],
      plannedLimit: 6,
      question:
        `Which federal administrative changes described as “${query}” could overlap the study?`,
      statusNote:
        "This is a bounded vocabulary expansion over official Federal Register metadata; a returned record still needs occurrence and study-link screening.",
    })),
    ...topicalQueries.slice(0, 2).map((query) => ({
      branch: "overlapping_policy" as const,
      providerId: "regulations_gov" as const,
      queryTerms: [query],
      plannedLimit: 5,
      question:
        `Which administrative docket records described as “${query}” could mark a separate policy episode?`,
      statusNote:
        "Regulations.gov requires its configured server credential. Docket metadata establishes an administrative record and its reported dates, not controlling legal duties or sample exposure.",
    })),
    {
      branch: "sector_market_or_financing" as const,
      providerId: "federal_register" as const,
      queryTerms: economicSubject
        ? [economicSubject, "operating costs"] : ["operating costs"],
      plannedLimit: 6,
      question: "Which input-cost rules could change operating costs?",
      statusNote: "Input prices must be linked to actual sample operations before an event has a study role.",
    },
    {
      branch: "sector_market_or_financing" as const,
      providerId: "federal_register" as const,
      queryTerms: economicSubject
        ? [economicSubject, "market demand"] : ["market demand"],
      plannedLimit: 6,
      question: "Which market or demand actions could change the outcome path?",
      statusNote: "A shared demand date does not establish a difference between proposed groups.",
    },
  ]).map((definition) => {
    const base = {
      branch: definition.branch,
      providerId: definition.providerId,
      queryTerms: definition.queryTerms,
      affectedGroupLabels: unique([
        context.study.proposedTreatment,
        context.study.proposedComparison,
        context.study.population,
      ]),
      occurrenceWindow: { ...legalWindow },
      plannedLimit: definition.plannedLimit,
      question: definition.question,
    };
    const stepFingerprint = fingerprintSixScreenValue({
      contextFingerprint: context.contextFingerprint,
      ...base,
    });
    return {
      id: `screen4-step-${stepFingerprint.slice("fnv1a64:".length)}`,
      ...base,
      initialStatus: "pending" as const,
      statusNote: definition.statusNote,
    };
  }) : [];
  const steps = [...baseSteps, ...supplementalSteps];
  const queryPlanFingerprint = fingerprintSixScreenValue(steps.map((step) => ({
    branch: step.branch,
    providerId: step.providerId,
    queryTerms: step.queryTerms,
    occurrenceWindow: step.occurrenceWindow,
  })));
  const body = {
    schemaVersion: STUDY_FIRST_EVENT_PLAN_VERSION,
    contextId: context.id,
    contextFingerprint: context.contextFingerprint,
    steps,
    discoveryVersion: STUDY_FIRST_EVENT_DISCOVERY_VERSION,
    sourceCapabilityVersion: "shockaudit-source-register-v4",
    queryPlanFingerprint,
    budget: {
      sourceQueryCeiling: 48,
      documentFetchCeiling: 40,
      metadataCandidateCeiling: 500,
      inspectedCandidateCeiling: 60,
      visibleEventCeiling: STUDY_FIRST_EVENT_MAX_VISIBLE,
    },
    semanticRoute: {
      status: "unavailable" as const,
      reason: "no_authorized_screen4_semantic_route" as const,
      fallback: "conditional_library_only" as const,
    },
  };
  const planFingerprint = fingerprintSixScreenValue(body);
  return {
    ...body,
    id: `screen4-plan-${planFingerprint.slice("fnv1a64:".length)}`,
    createdAt: context.createdAt,
    planFingerprint,
  };
}

export function createPlannedStudyFirstEventInvestigation(input: {
  context: StudyFirstEventContext;
  ordinal: number;
}): StudyFirstEventInvestigation {
  const plan = createStudyFirstEventSearchPlan(input.context);
  const body = {
    schemaVersion: STUDY_FIRST_EVENT_INVESTIGATION_VERSION,
    snapshotId: `screen4-investigation-${input.context.id.slice("screen4-context-".length)}-planned`,
    ordinal: input.ordinal,
    previousSnapshotId: null,
    context: input.context,
    plan,
    status: "planned" as const,
    attempts: [],
    occurrences: [],
    analyses: [],
    presentation: null,
    startedAt: null,
    completedAt: null,
  };
  return { ...body, investigationFingerprint: fingerprintSixScreenValue(body) };
}

/** Explicit refresh; old completed evidence remains in the append-only history. */
export function createRefreshedStudyFirstEventInvestigation(input: {
  previous: StudyFirstEventInvestigation;
  ordinal: number;
  createdAt: string;
}): StudyFirstEventInvestigation {
  if (!Number.isSafeInteger(input.ordinal) ||
      input.ordinal <= input.previous.ordinal) {
    throw new Error("Screen 4 refresh requires a new history position.");
  }
  const previous = input.previous.context;
  const { id: _id, createdAt: _createdAt,
    contextFingerprint: _fingerprint, ...priorBody } = previous;
  const content = {
    ...priorBody,
    schemaVersion: STUDY_FIRST_EVENT_CONTEXT_VERSION,
    searchConcepts: previous.searchConcepts ?? {
      shockConstruct: previous.study.policySideConcept,
      outcome: previous.study.outcome,
      outcomeMeasure: previous.study.outcomeMeasure,
      industries: [...previous.study.industry],
      groupLabels: unique([
        previous.study.proposedTreatment,
        previous.study.proposedComparison,
      ]),
      year: previous.timing.year,
      threshold: null,
      assignmentRule: null,
    },
  };
  const contextFingerprint = fingerprintSixScreenValue(content);
  const context: StudyFirstEventContext = {
    ...content,
    id: `screen4-context-${contextFingerprint.slice("fnv1a64:".length)}`,
    createdAt: input.createdAt,
    contextFingerprint,
  };
  const plan = createStudyFirstEventSearchPlan(context);
  const body = {
    schemaVersion: STUDY_FIRST_EVENT_INVESTIGATION_VERSION,
    snapshotId: `screen4-investigation-${context.id.slice("screen4-context-".length)}-refresh-${input.ordinal}`,
    ordinal: input.ordinal,
    previousSnapshotId: input.previous.snapshotId,
    context,
    plan,
    status: "planned" as const,
    attempts: [],
    occurrences: [],
    analyses: [],
    presentation: null,
    startedAt: null,
    completedAt: null,
  };
  return { ...body, investigationFingerprint: fingerprintSixScreenValue(body) };
}

export function createCompletedStudyFirstEventInvestigation(input: {
  previous: StudyFirstEventInvestigation;
  attempts: StudyFirstEventSearchAttempt[];
  occurrences: CoEventCandidateOccurrence[];
  analyses: StudyFirstEventRelevanceAnalysis[];
  presentation: StudyFirstEventPresentation;
  startedAt: string;
  completedAt: string;
}): StudyFirstEventInvestigation {
  const status = input.presentation.status === "scan_failed"
    ? "failed" as const
    : input.presentation.status === "completed_partial"
      ? "completed_partial" as const
      : "completed" as const;
  const body = {
    schemaVersion: STUDY_FIRST_EVENT_INVESTIGATION_VERSION,
    snapshotId: `screen4-investigation-${input.previous.context.id.slice("screen4-context-".length)}-${input.previous.ordinal + 1}`,
    ordinal: input.previous.ordinal + 1,
    previousSnapshotId: input.previous.snapshotId,
    context: structuredClone(input.previous.context),
    plan: structuredClone(input.previous.plan),
    status,
    attempts: structuredClone(input.attempts),
    occurrences: structuredClone(input.occurrences),
    analyses: structuredClone(input.analyses),
    presentation: structuredClone(input.presentation),
    startedAt: input.startedAt,
    completedAt: input.completedAt,
  };
  return { ...body, investigationFingerprint: fingerprintSixScreenValue(body) };
}

export function createStudyFirstEventScreen5Handoff(input: {
  investigation: StudyFirstEventInvestigation;
  createdAt: string;
}): StudyFirstEventScreen5Handoff {
  const presentation = input.investigation.presentation;
  const body = {
    schemaVersion: STUDY_FIRST_EVENT_HANDOFF_VERSION,
    contextId: input.investigation.context.id,
    contextFingerprint: input.investigation.context.contextFingerprint,
    investigationSnapshotId: input.investigation.snapshotId,
    investigationFingerprint: input.investigation.investigationFingerprint,
    investigationStatus: input.investigation.status,
    presentationFingerprint: presentation?.presentationFingerprint ?? null,
    visibleEventIds: [...(presentation?.visibleEventIds ?? [])],
    coverageLimitation: presentation?.coverage.limitation ??
      "The automatic event investigation had not completed when Screen 5 opened.",
    optionalMethodSelectionId:
      input.investigation.context.methodSelection?.selectionId ?? null,
    createdAt: input.createdAt,
  };
  const handoffFingerprint = fingerprintSixScreenValue(body);
  return {
    ...body,
    id: `screen4-to-5-${handoffFingerprint.slice("fnv1a64:".length)}`,
    handoffFingerprint,
  };
}

export function currentStudyFirstEventInvestigation(input: {
  studyFirstEventInvestigations?: StudyFirstEventInvestigation[];
  confirmedShock: ConfirmedShock | null;
  study: StudyContext;
  entryContext: Screen3StudyEntryContext | null;
  timing: ProposedTreatmentTiming | null;
  advice: StudyDesignAdvice | null;
  selection: StudyDesignSelection | null;
}) {
  if (!input.confirmedShock || !input.entryContext || !input.timing ||
      !input.advice) return null;
  return [...(input.studyFirstEventInvestigations ?? [])].reverse().find(
    ({ context }) =>
      context.schemaVersion === STUDY_FIRST_EVENT_CONTEXT_VERSION &&
      context.policy.identityFingerprint === input.confirmedShock!.identityFingerprint &&
      context.authorization.identityRevision ===
        input.confirmedShock!.confirmation.identityRevision &&
      context.study.revision === input.study.revision &&
      context.study.fingerprint === input.entryContext!.studyFingerprint &&
      context.timing.fingerprint === input.timing!.timingFingerprint &&
      context.evidence.status === input.entryContext!.evidence.status &&
      context.evidence.snapshotId === input.entryContext!.evidence.snapshotId &&
      context.evidence.snapshotFingerprint ===
        input.entryContext!.evidence.snapshotFingerprint &&
      context.advice.adviceId === input.advice!.adviceId &&
      context.advice.adviceFingerprint === input.advice!.adviceFingerprint &&
      (context.methodSelection?.selectionId ?? null) ===
        (input.selection?.id ?? null) &&
      (context.methodSelection?.selectionFingerprint ?? null) ===
        (input.selection?.selectionFingerprint ?? null),
  ) ?? null;
}

export function validateStudyFirstEventInvestigationCollections(input: {
  investigations?: StudyFirstEventInvestigation[];
  handoffs?: StudyFirstEventScreen5Handoff[];
}) {
  const investigations = input.investigations ?? [];
  const handoffs = input.handoffs ?? [];
  if (!Array.isArray(investigations) || !Array.isArray(handoffs) ||
      investigations.length > STUDY_FIRST_EVENT_MAX_HISTORY ||
      handoffs.length > STUDY_FIRST_EVENT_MAX_HISTORY) {
    throw new Error("Stored study-first event investigation history is invalid.");
  }
  const snapshotMap = new Map<string, StudyFirstEventInvestigation>();
  for (const investigation of investigations) {
    const { investigationFingerprint: _fingerprint, ...body } = investigation;
    if (investigation.schemaVersion !== STUDY_FIRST_EVENT_INVESTIGATION_VERSION ||
        _fingerprint !== fingerprintSixScreenValue(body)) {
      throw new Error("Stored study-first event investigation fingerprint is invalid.");
    }
    if (snapshotMap.has(investigation.snapshotId)) {
      throw new Error("Stored study-first event investigation snapshot is duplicated.");
    }
    if (investigation.presentation?.visibleEventIds.length! >
      STUDY_FIRST_EVENT_MAX_VISIBLE) {
      throw new Error("Stored study-first event presentation exceeds ten visible events.");
    }
    snapshotMap.set(investigation.snapshotId, investigation);
  }
  for (const handoff of handoffs) {
    const { handoffFingerprint: _fingerprint, id: _id, ...body } = handoff;
    if (handoff.schemaVersion !== STUDY_FIRST_EVENT_HANDOFF_VERSION ||
        _fingerprint !== fingerprintSixScreenValue(body) ||
        !snapshotMap.has(handoff.investigationSnapshotId)) {
      throw new Error("Stored study-first Screen 5 handoff is invalid.");
    }
  }
}
