import type { Mode, Screen01StudyContext } from "./scope-types";

export const SCREEN_02_SESSION_SCHEMA_VERSION = "2.0" as const;
export const SCREEN_02_SCORING_FORMULA_VERSION =
  "screen-02-feasibility-v2" as const;
export const SCREEN_02_RUBRIC_VERSION = "screen-02-rubric-v2" as const;
export const SCREEN_02_EXTERNALITY_RUBRIC_VERSION =
  "screen-02-externality-v1" as const;
export const SCREEN_02_POPULATION_APPLICABILITY_RUBRIC_VERSION =
  "screen-02-population-applicability-v1" as const;
export const SCREEN_02_OUTCOME_PATHWAY_RUBRIC_VERSION =
  "screen-02-outcome-pathway-v1" as const;
export const SCREEN_02_SOURCE_POLICY_VERSION =
  "screen-02-source-policy-v1" as const;
export const SCREEN_02_SEARCH_PROTOCOL_VERSION =
  "screen-02-search-protocol-v2" as const;
export const SCREEN_02_PREFERENCE_VERSION =
  "screen-02-preferences-v1" as const;
export const SCREEN_02_PRELIMINARY_ASSESSMENT_SCHEMA_VERSION =
  "screen02-preliminary-assessment-v1" as const;
export const SCREEN_02_SESSION_META_KEY =
  "shockaudit/screen02Session" as const;
export const SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN =
  "Unknown — returned source metadata did not establish organizational population coverage." as const;

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? readonly DeepReadonly<U>[]
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

export const screen02ScoreComponentKeys = [
  "scopeFit",
  "sourceAuthority",
  "exposureObservability",
  "timeSupport",
  "variation",
] as const;

export type Screen02ScoreComponentKey =
  (typeof screen02ScoreComponentKeys)[number];

export const SCREEN_02_SCORE_WEIGHTS: Record<
  Screen02ScoreComponentKey,
  number
> = {
  scopeFit: 0.3,
  sourceAuthority: 0.25,
  exposureObservability: 0.2,
  timeSupport: 0.15,
  variation: 0.1,
};

export type Screen02ComponentScores = Record<
  Screen02ScoreComponentKey,
  number | null
>;

export type Screen02ComponentReasons = Record<
  Screen02ScoreComponentKey,
  string
>;

export type Screen02ScoreCoverage = {
  knownComponents: number;
  totalComponents: typeof screen02ScoreComponentKeys.length;
  knownWeight: number;
  knownWeightPercent: number;
};

export type Screen02AssessmentMethod =
  | "system-computed"
  | "ai-rubric"
  | "researcher-specified";

export type Screen02AssessmentConfidence = "low" | "medium" | "high";

export type Screen02ComponentDetail = {
  method: Screen02AssessmentMethod;
  category: string;
  criteria: string[];
  evidenceSourceIds: string[];
  reason: string;
  confidence: Screen02AssessmentConfidence;
  unresolved: string[];
  rubricVersion: typeof SCREEN_02_RUBRIC_VERSION;
};

export const screen02ExternalShockPlausibilityCategories = [
  "plausible",
  "mixed",
  "major-concern",
  "unknown",
] as const;

export type Screen02ExternalShockPlausibilityCategory =
  (typeof screen02ExternalShockPlausibilityCategories)[number];

export type Screen02ExternalShockPlausibilityDetail = {
  method: "ai-rubric";
  category: Screen02ExternalShockPlausibilityCategory;
  criteria: string[];
  evidenceSourceIds: string[];
  reason: string;
  confidence: Screen02AssessmentConfidence;
  unresolved: string[];
  rubricVersion: typeof SCREEN_02_EXTERNALITY_RUBRIC_VERSION;
};

export const screen02PopulationApplicabilityCategories = [
  "documented-direct",
  "documented-conditional",
  "plausible-indirect",
  "unlikely",
  "unknown",
] as const;

export type Screen02PopulationApplicabilityCategory =
  (typeof screen02PopulationApplicabilityCategories)[number];

export type Screen02SourceEstablishedPopulation = {
  text: string;
  evidenceSourceIds: string[];
};

/**
 * AI interpretation of how the event's documented coverage relates to the
 * immutable native affected-population fact. This is deliberately separate
 * from that fact: an interpretation may qualify it, but cannot rewrite it.
 */
export type Screen02PopulationApplicabilityDetail = {
  method: "ai-rubric";
  category: Screen02PopulationApplicabilityCategory;
  criteria: string[];
  evidenceSourceIds: string[];
  /**
   * Population explicitly described by the cited candidate sources. Null means
   * the sources reviewed so far do not establish a covered population.
   */
  sourceEstablishedPopulation?: Screen02SourceEstablishedPopulation | null;
  reason: string;
  confidence: Screen02AssessmentConfidence;
  unresolved: string[];
  rubricVersion: typeof SCREEN_02_POPULATION_APPLICABILITY_RUBRIC_VERSION;
};

export const screen02OutcomePathwayCategories = [
  "source-anchored-specific",
  "conditional-or-indirect",
  "unclear",
  "unlikely",
] as const;

export type Screen02OutcomePathwayCategory =
  (typeof screen02OutcomePathwayCategories)[number];

/**
 * Source-grounded methodological assessment of the preliminary outcome
 * pathway. This supplements, but never replaces, the preserved outcomeLink.
 */
export type Screen02OutcomePathwayDetail = {
  method: "ai-rubric";
  category: Screen02OutcomePathwayCategory;
  criteria: string[];
  evidenceSourceIds: string[];
  reason: string;
  confidence: Screen02AssessmentConfidence;
  unresolved: string[];
  rubricVersion: typeof SCREEN_02_OUTCOME_PATHWAY_RUBRIC_VERSION;
};

export type Screen02Scorecard = {
  formulaVersion: typeof SCREEN_02_SCORING_FORMULA_VERSION;
  components: Screen02ComponentScores;
  componentReasons: Screen02ComponentReasons;
  componentDetails: Record<
    Screen02ScoreComponentKey,
    Screen02ComponentDetail
  >;
  overall: number | null;
  overallRange: {
    minimum: number;
    maximum: number;
  };
  reason: string;
  coverage: Screen02ScoreCoverage;
};

/**
 * Tier 1 is the strongest source class. Tier 6 is a discovery lead only.
 * The labels are deliberately domain-neutral so legal, administrative,
 * scientific, and event sources can be compared without pretending that all
 * evidence channels are interchangeable.
 */
export const SOURCE_AUTHORITY_TIERS = {
  1: {
    label: "Controlling or official primary source",
    score: 100,
  },
  2: {
    label: "Official implementation or administrative source",
    score: 85,
  },
  3: {
    label: "Authoritative data or institutional documentation",
    score: 70,
  },
  4: {
    label: "Peer-reviewed or recognized research source",
    score: 55,
  },
  5: {
    label: "Credible secondary reporting or professional analysis",
    score: 35,
  },
  6: {
    label: "Unverified discovery lead",
    score: 15,
  },
} as const;

export type SourceAuthorityTier = keyof typeof SOURCE_AUTHORITY_TIERS;

export type Screen02Source = {
  id: string;
  title: string;
  locator: string;
  publisher: string;
  publishedDate: string | null;
  authorityTier: SourceAuthorityTier;
  authorityAssessment?: {
    method:
      | "connector-native"
      | "system-domain-rule"
      | "ai-rubric"
      | "researcher-confirmed"
      | "unverified";
    reason: string;
    policyVersion: typeof SCREEN_02_SOURCE_POLICY_VERSION;
  };
  channel: string;
  retrievedAt?: string;
  /**
   * Optional bounded text extracted by fixed retrieval. Host-proposed titles
   * and metadata never populate this field; it is fingerprinted with the
   * source and remains provisional until Screen 3 verifies exact passages.
   */
  evidenceText?: string;
  isFictionalDemo?: true;
};

export type Screen02SourceSummary = {
  uniqueSourceCount: number;
  byAuthorityTier: Record<SourceAuthorityTier, number>;
  strongestAuthorityTier: SourceAuthorityTier | null;
  authorityScore: number | null;
};

export const screen02HardFilterKeys = [
  "geography",
  "studyPeriod",
  "population",
  "eventFamily",
] as const;

export type Screen02HardFilterKey =
  (typeof screen02HardFilterKeys)[number];
export type Screen02HardFilterStatus = "pass" | "review" | "fail";

export type Screen02HardFilterResult = {
  key: Screen02HardFilterKey;
  status: Screen02HardFilterStatus;
  reason: string;
};

export type Screen02EvidenceStatus =
  | "assessed"
  | "partial"
  | "reconnaissance-required"
  | "fictional-demonstration";

export type Screen02Origin =
  | "registry-reviewed"
  | "newly-discovered"
  | "user-provided"
  | "fictional-demonstration"
  | "unsupported-lead";

export type Screen02LikelyServiceLevel =
  | "full-audit"
  | "assisted-audit"
  | "event-reconnaissance"
  | "stop";

export type Screen02SharedCardFields = {
  origin: Screen02Origin;
  provisionalDates: string[];
  affectedPopulation: string;
  requiredVariables: string[];
  outcomeLink: {
    text: string;
    status: "ai-hypothesis" | "system-template";
  };
  likelyServiceLevel: Screen02LikelyServiceLevel;
  limitations: string[];
  reasons: string[];
};

export const screen02PreliminaryAssessmentJudgments = [
  "promising-to-verify",
  "worth-exploring",
  "low-priority",
  "not-enough-evidence",
] as const;

export type Screen02PreliminaryAssessmentJudgment =
  (typeof screen02PreliminaryAssessmentJudgments)[number];

/**
 * Compact, source-grounded AI guidance layered onto an immutable native
 * candidate. It is intentionally preliminary: detailed validity assessment
 * remains downstream, and none of these fields replaces native event facts.
 */
export type Screen02PreliminaryAssessment = {
  schemaVersion: typeof SCREEN_02_PRELIMINARY_ASSESSMENT_SCHEMA_VERSION;
  method: "ai-preliminary";
  judgment: Screen02PreliminaryAssessmentJudgment;
  studyFit: string;
  affectedPopulation: string | null;
  outcomeMechanism: string | null;
  mainConcern: string;
  evidenceSourceIds: string[];
  nextChecks: string[];
  rootNativeRoundId: string;
  assessedAtRevision: number;
};

export type Screen02ItemBase = Screen02SharedCardFields & {
  id: string;
  mode: Mode;
  title: string;
  description: string;
  provisional: boolean;
  evidenceStatus: Screen02EvidenceStatus;
  sources: Screen02Source[];
  sourceSummary: Screen02SourceSummary;
  hardFilters: Screen02HardFilterResult[];
  scorecard: Screen02Scorecard;
  /**
   * Separate from the five-part feasibility score. Missing means a legacy or
   * native-only item whose externality has not received the current AI review.
   */
  externalShockPlausibility?: Screen02ExternalShockPlausibilityDetail;
  /**
   * Optional AI interpretation of event coverage. Missing means the item has
   * not received the current population-applicability review.
   */
  populationApplicability?: Screen02PopulationApplicabilityDetail;
  /** Missing is accepted for legacy and native-only items. */
  outcomePathway?: Screen02OutcomePathwayDetail;
  /** Missing means this item has not received the compact preliminary review. */
  preliminaryAssessment?: Screen02PreliminaryAssessment;
  rank: number;
};

export type Screen02FindItem = Screen02ItemBase & {
  mode: "find";
  kind: "event";
  /**
   * Source-native identity retained with the immutable candidate. Omitting
   * this remains valid for legacy and reviewed records, but a discovered
   * identity must survive replay so derived scope checks cannot change after
   * persistence.
   */
  nativeIdentity?: Screen02NativeIdentity;
  event: {
    displayName: string;
    eventDate: string;
    eventFamily: string;
    geographies: string[];
    populations: string[];
  };
};

export const screen02AuditRepresentationTypes = [
  "whole-package",
  "formal-eligibility",
  "phase-clock",
  "realized-exposure",
] as const;

export type Screen02AuditRepresentationType =
  (typeof screen02AuditRepresentationTypes)[number];

export type Screen02AuditItem = Screen02ItemBase & {
  mode: "audit";
  kind: "representation";
  representationType: Screen02AuditRepresentationType;
  anchorShock: string;
  candidateConstruct: string;
  operationalization: string;
};

export type Screen02Item = Screen02FindItem | Screen02AuditItem;

/**
 * Content-addressed, rank-neutral candidate snapshot. Search rounds retain
 * ordered references to these versions, so every prior card can be
 * reconstructed without copying unchanged cards into every round.
 */
export type Screen02ItemVersion = {
  versionId: string;
  itemId: string;
  itemFingerprint: string;
  recordedAtRevision: number;
  item: Screen02Item;
};

export type Screen02AssessmentInput = {
  value?: number | null;
  category?: string;
  reason: string;
  evidenceSourceIds?: string[];
  method?: "ai-rubric" | "researcher-specified";
  confidence?: Screen02AssessmentConfidence;
  unresolved?: string[];
};

export type Screen02PopulationApplicabilityAssessmentInput =
  Screen02AssessmentInput & {
    sourceEstablishedPopulation?: Screen02SourceEstablishedPopulation | null;
  };

export type Screen02ProposalAssessments = Partial<{
  externalShockPlausibility: Screen02AssessmentInput;
  populationApplicability: Screen02PopulationApplicabilityAssessmentInput;
  outcomePathway: Screen02AssessmentInput;
  exposureObservability: Screen02AssessmentInput;
  timeSupport: Screen02AssessmentInput;
  variation: Screen02AssessmentInput;
}>;

/**
 * Identity returned by an authoritative source in its own native fields.
 * `issuingJurisdiction` is never populated from the Screen 1 study geography,
 * and publisher/host ownership is not silently promoted to `issuer`.
 */
export type Screen02NativeIdentity = {
  formalIdentifier: string | null;
  issuer: string | null;
  issuingJurisdiction: string | null;
  status: string | null;
};

export type Screen02FindProposal = Screen02SharedCardFields & {
  id: string;
  mode: "find";
  kind: "event";
  title: string;
  description: string;
  /**
   * Connector-native identity facts. The object is optional for legacy and
   * reviewed proposals, and nullable fields must remain unknown rather than
   * being inferred from the study scope or source publisher.
   */
  nativeIdentity?: Screen02NativeIdentity;
  /**
   * Optional authoritative sources that document a concrete relationship to
   * the study industry without purporting to be sources for this event's
   * identity. Fixed qualification may use these sources only for an adjacent
   * relevance bridge; they cannot establish event identity, timing, scope,
   * source quality, or candidate admission on their own.
   */
  relationshipEvidenceSourceIds?: string[];
  event: {
    displayName: string;
    eventDate: string;
    eventFamily: string;
    geographies: string[];
    populations: string[];
  };
  sources: Screen02Source[];
  assessments?: Screen02ProposalAssessments;
  fictionalDemo?: true;
};

export type Screen02AuditProposal = Screen02SharedCardFields & {
  id: string;
  mode: "audit";
  kind: "representation";
  representationType: Screen02AuditRepresentationType;
  title: string;
  description: string;
  candidateConstruct: string;
  operationalization: string;
  sources: Screen02Source[];
  assessments?: Screen02ProposalAssessments;
  hardFilterEvidence?: Partial<
    Record<Screen02HardFilterKey, Screen02HardFilterResult>
  >;
};

export type Screen02Proposal =
  | Screen02FindProposal
  | Screen02AuditProposal;

export type Screen02QueryLog = {
  id: string;
  query: string;
  purpose: string;
  returnedRecordIds?: string[];
};

export type Screen02ChannelLog = {
  channel: string;
  status: "searched" | "not-searched" | "failed";
  note: string;
  retrievedAt?: string;
};

export type Screen02ManifestHardFilter = {
  key: Screen02HardFilterKey;
  requiredValue: string;
};

export type Screen02ExclusionLog = {
  proposalId: string;
  filter: Screen02HardFilterKey | "validation";
  reason: string;
};

export type Screen02StoppingRule = {
  rule: string;
  status: "not-started" | "met" | "not-met";
  note: string;
};

export type Screen02SearchCoverage = {
  status: "no-results" | "reconnaissance" | "partial" | "complete";
  proposalsReceived: number;
  itemsRetained: number;
  uniqueSourcesLocated: number;
  reason: string;
};

export type Screen02SearchManifest = {
  queryMatrix: Screen02QueryLog[];
  channels: Screen02ChannelLog[];
  hardFilters: Screen02ManifestHardFilter[];
  exclusions: Screen02ExclusionLog[];
  stoppingRule: Screen02StoppingRule;
  coverage: Screen02SearchCoverage;
  outcomeValuesInspected: false;
};

export type Screen02SearchManifestSupplement = {
  queryMatrix?: Screen02QueryLog[];
  channels?: Screen02ChannelLog[];
  stoppingRule?: Screen02StoppingRule;
};

export const screen02PreferenceKinds = [
  "require",
  "prefer",
  "avoid",
] as const;

export type Screen02PreferenceKind =
  (typeof screen02PreferenceKinds)[number];

export type Screen02PreferenceCriterion = {
  id: string;
  kind: Screen02PreferenceKind;
  text: string;
  source: "researcher" | "ai-interpretation";
  exactRequest: string;
};

export type Screen02PreferenceRequest = {
  id: string;
  exactText: string;
  criteriaIds: string[];
  interpretationSource: "researcher-structured" | "ai-interpretation";
};

export type Screen02PreferenceSet = {
  version: typeof SCREEN_02_PREFERENCE_VERSION;
  criteria: Screen02PreferenceCriterion[];
  requests: Screen02PreferenceRequest[];
};

export type Screen02PreferenceAssessment = {
  itemId: string;
  score: number | null;
  matchedCriteriaIds: string[];
  unmetRequiredCriteriaIds: string[];
  reasons: string[];
  computedAtRevision: number;
};

export const screen02SearchRequestTypes = [
  "initial",
  "find-more",
  "refine",
  "none-fit",
  "user-source",
] as const;

export type Screen02SearchRequestType =
  (typeof screen02SearchRequestTypes)[number];

export type Screen02RoundStage =
  | "initial"
  | "native-retrieval"
  | "ai-review"
  | "preliminary-assessment"
  | "researcher-assessment";

export type Screen02PreliminaryAssessmentResult = {
  itemId: string;
  status: "assessed" | "needs-retry";
  reason: string;
};

export const screen02SemanticScopeFields = [
  "industry",
  "outcomeFamily",
] as const;

export type Screen02SemanticScopeField =
  (typeof screen02SemanticScopeFields)[number];

export type Screen02SemanticDecision = {
  itemId: string;
  decision: "retained" | "excluded";
  criterionIds: string[];
  /**
   * Locked Screen 1 fields that make a native result substantively irrelevant
   * even when the researcher supplied no optional strict criterion.
   */
  scopeMismatchFields?: Screen02SemanticScopeField[];
  reason: string;
};

export type Screen02PendingInteractionRequest = {
  id: string;
  baseRevision: number;
  expectedRevision: number;
  requestType: Extract<
    Screen02SearchRequestType,
    "find-more" | "refine" | "none-fit"
  >;
  status: "sending" | "awaiting-response";
  exactText: string;
  criteria: Array<{
    kind: Screen02PreferenceKind;
    text: string;
  }>;
};

export type Screen02InteractionRequestEvent = {
  id: string;
  requestId: string;
  revision: number;
  action: "recorded" | "sent" | "send-failed" | "reconciled";
  requestType: Screen02PendingInteractionRequest["requestType"];
  exactText: string;
  criteria: Screen02PendingInteractionRequest["criteria"];
  error: string | null;
};

export type Screen02SearchRound = {
  id: string;
  revision: number;
  requestType: Screen02SearchRequestType;
  /**
   * New redesign rounds persist their producing stage. Optional only so a
   * released pre-redesign session can still be read during migration.
   */
  stage?: Screen02RoundStage;
  exactRequest: string;
  retrievedAt: string;
  searchProtocolVersion: typeof SCREEN_02_SEARCH_PROTOCOL_VERSION;
  preferenceCriteriaIds: string[];
  proposalIdsReceived: string[];
  itemIdsRetained: string[];
  itemIdsAdded: string[];
  duplicateProposalIds: string[];
  rejectedItemIds: string[];
  assessedItemVersionIds: string[];
  activeItemVersionIds: string[];
  /**
   * Present on a completed host-assisted semantic review. The parent is the
   * immediately preceding native-retrieval round; the decisions account for
   * every candidate that native round exposed to the host.
   */
  parentRoundId?: string;
  semanticDecisions?: Screen02SemanticDecision[];
  /**
   * Preliminary-assessment lineage is separate from the legacy semantic
   * review parent so retries can form an append-only chain without changing
   * the legacy all-or-nothing contract.
   */
  assessmentParentRoundId?: string;
  rootNativeRoundId?: string;
  assessmentResults?: Screen02PreliminaryAssessmentResult[];
  shockEvidence?: {
    status: "shock-level-reconnaissance";
    anchorShock: string;
    matchMethod: "exact-name-or-controlled-alias";
    proposalIds: string[];
    candidateNames: string[];
    sources: Screen02Source[];
    provisionalDates: string[];
    affectedPopulations: string[];
    note: string;
  };
  discovery: {
    formulaVersion: string;
    query: string;
    rankings: {
      proposalId: string;
      stableProposalId: string;
      rank: number;
      rankScore: number;
      matchedTerms: string[];
    }[];
    clusters: {
      clusterId: string;
      canonicalProposalId: string;
      memberProposalIds: string[];
      duplicateProposalIds: string[];
    }[];
  };
  manifest: Screen02SearchManifest;
};

export type Screen02Rejection = {
  id: string;
  itemId: string;
  revision: number;
  reason: string;
  source: "researcher";
};

export type Screen02SelectionEvent = {
  id: string;
  revision: number;
  action: "selected" | "cleared" | "locked" | "unlocked";
  itemId: string | null;
  reason: string;
};

export type Screen02DeferredQuestion = {
  id: string;
  revision: number;
  exactRequest: string;
  reason: string;
  destination: "screen-03";
};

export type Screen02ScopeRevisionRequest = {
  revision: number;
  exactRequest: string;
  conflictingFields: string[];
  reason: string;
};

export type Screen02LockedChoice = {
  status: "locked";
  itemId: string;
  itemFingerprint: string;
  lockedAtRevision: number;
  mode: Mode;
  shockName: string;
  knownShockAnchor: string | null;
  primaryRepresentationType: Screen02AuditRepresentationType | null;
  primaryConstruct: string | null;
  baselineFingerprint: string;
  downstreamStatus: "screen-03-ready";
};

export type Screen02InteractionState = {
  preferences: Screen02PreferenceSet;
  preferenceAssessments: Screen02PreferenceAssessment[];
  pendingRequest: Screen02PendingInteractionRequest | null;
  interactionRequestHistory: Screen02InteractionRequestEvent[];
  itemVersions: Screen02ItemVersion[];
  searchRounds: Screen02SearchRound[];
  rejections: Screen02Rejection[];
  selectionHistory: Screen02SelectionEvent[];
  deferredQuestions: Screen02DeferredQuestion[];
  pendingScopeRevision: Screen02ScopeRevisionRequest | null;
  downstreamInvalidationCount: number;
};

export type Screen02AssessmentResult = {
  items: Screen02Item[];
  searchManifest: Screen02SearchManifest;
};

/**
 * Screen 1 is one immutable sibling. Every Screen 2 result is stored beside it
 * rather than written into or reconstructed from it.
 */
export type Screen02Session = {
  schemaVersion: typeof SCREEN_02_SESSION_SCHEMA_VERSION;
  sourceScreen: "screen-02";
  runId: string;
  mode: Mode;
  screen01Baseline: DeepReadonly<Screen01StudyContext>;
  screen01Fingerprint: string;
  revision: number;
  items: Screen02Item[];
  selectedItemId: string | null;
  lockedChoice: Screen02LockedChoice | null;
  searchManifest: Screen02SearchManifest;
  interaction: Screen02InteractionState;
};
