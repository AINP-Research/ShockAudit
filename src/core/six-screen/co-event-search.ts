import { fingerprintSixScreenValue } from "./canonical";
import {
  requireBoundedIdentifier,
  requireCanonicalInstant,
  requireFingerprint,
  type ConfirmedShock,
  type StudyContext,
} from "./contracts";
import {
  validateCausalDesignDecision,
  validateCausalDesignSet,
  type CausalDesignDecision,
  type CausalDesignSet,
} from "./causal-comparison";
import type { PolicyEventCardReference } from
  "./policy-event-card-review";

export const SIX_SCREEN_COEVENT_SCOPE_INPUT_VERSION =
  "screen-04-coevent-scope-input-v1" as const;
export const SIX_SCREEN_COEVENT_SEARCH_MATRIX_VERSION =
  "screen-04-coevent-search-matrix-v1" as const;
export const SIX_SCREEN_COEVENT_SEARCH_MAX_REVISIONS = 24;
export const SIX_SCREEN_COEVENT_SEARCH_MAX_BYTES = 96_000;

export const COEVENT_SEARCH_BRANCHES = [
  "overlapping_policy",
  "implementation_or_litigation",
  "independent_industry_or_market",
  "disaster_or_disruption",
  "comparison_spillover",
  "measurement_or_sample_change",
] as const;

export type CoEventSearchBranch = (typeof COEVENT_SEARCH_BRANCHES)[number];
export type CoEventWindowOffset = {
  amount: number;
  unit: "days" | "months" | "years";
};
export type CoEventImportantEntity = {
  kind: "supplier" | "customer" | "regulator" | "market" | "other";
  label: string;
};

export type CoEventSearchScopeInput = {
  schemaVersion: typeof SIX_SCREEN_COEVENT_SCOPE_INPUT_VERSION;
  anticipationLookback: CoEventWindowOffset;
  contextLookforward: CoEventWindowOffset;
  knownCoEvents: string[];
  importantEntities: CoEventImportantEntity[];
  includeMeasurementChanges: boolean;
  inputFingerprint: string;
};

export type CoEventProviderId =
  | "federal_register"
  | "reviewed_official_documents"
  | "govinfo"
  | "ecfr"
  | "regulations_gov"
  | "congress_gov"
  | "legiscan"
  | "openstates"
  | "eu_cellar"
  | "uk_legislation"
  | "tavily"
  | "brave"
  | "crossref"
  | "openfema"
  | "usgs"
  | "gdacs";

export const COEVENT_PROVIDER_IDS: readonly CoEventProviderId[] = [
  "federal_register",
  "reviewed_official_documents",
  "govinfo",
  "ecfr",
  "regulations_gov",
  "congress_gov",
  "legiscan",
  "openstates",
  "eu_cellar",
  "uk_legislation",
  "tavily",
  "brave",
  "crossref",
  "openfema",
  "usgs",
  "gdacs",
];

export type CoEventSearchMatrixRow = {
  id: string;
  branch: CoEventSearchBranch;
  question: string;
  affectedGroups: Array<{
    role: "treatment" | "comparison" | "population" | "context_entity";
    label: string;
  }>;
  relevantPeriod: {
    studyStart: string;
    studyEnd: string;
    anticipationLookback: CoEventWindowOffset;
    contextLookforward: CoEventWindowOffset;
  };
  geographyOrMarket: string[];
  eventFamily: string;
  providers: Array<{
    id: CoEventProviderId;
    availability: "not_checked";
  }>;
  queryTerms: string[];
  plannedLimit: number;
  outcome: {
    status: "not_started";
    candidateCount: 0;
    note: null;
  };
};

export type CoEventSearchMatrix = {
  schemaVersion: typeof SIX_SCREEN_COEVENT_SEARCH_MATRIX_VERSION;
  snapshotId: string;
  ordinal: number;
  binding: {
    studyRevision: number;
    identityFingerprint: string;
    eventCardReference: PolicyEventCardReference;
    designSetSnapshotId: string;
    designSetFingerprint: string;
    designDecisionSnapshotId: string;
    designDecisionFingerprint: string;
    selectedDesignSnapshotId: string | null;
    selectedDesignFingerprint: string | null;
  };
  mode: "targeted" | "contextual";
  modeLabel: string;
  policy: {
    officialTitle: string;
    issuer: string;
    issuingJurisdiction: string;
    formalIdentifiers: string[];
  };
  scope: {
    population: string;
    outcome: string;
    geography: string[];
    industry: string[];
    studyPeriod: { start: string; end: string };
    anticipationLookback: CoEventWindowOffset;
    contextLookforward: CoEventWindowOffset;
    knownCoEvents: string[];
    importantEntities: CoEventImportantEntity[];
  };
  retrievalBudget: {
    initialMetadataCandidates: 100;
    attemptedDocuments: 24;
    pages: 12;
    externalActions: 24;
  };
  rows: CoEventSearchMatrixRow[];
  execution: {
    status: "planned";
    executedRowIds: [];
    unavailableProviderIds: [];
    unavailableLanguages: [];
    actualSearchBoundary: null;
  };
  semanticRelationAnalysis: {
    status: "blocked";
    reason: "genuine_intelligence_path_unverified";
  };
  claimBoundary: string;
  createdAt: string;
  matrixFingerprint: string;
};

type MatrixBody = Omit<CoEventSearchMatrix, "matrixFingerprint">;

function bytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function requireText(value: string, label: string, max = 4_000) {
  if (!value || value !== value.trim() || value.length > max) {
    throw new Error(`${label} must be non-empty canonical text of at most ${max} characters.`);
  }
  return value;
}

function requireTextList(
  values: readonly string[],
  label: string,
  maxEntries = 24,
) {
  if (
    values.length > maxEntries ||
    new Set(values).size !== values.length
  ) throw new Error(`${label} must be a bounded unique list.`);
  values.forEach((value) => requireText(value, label, 500));
  return values;
}

function requireOffset(value: CoEventWindowOffset, label: string) {
  if (
    !Number.isSafeInteger(value.amount) || value.amount < 0 ||
    value.amount > 120 ||
    !["days", "months", "years"].includes(value.unit)
  ) throw new Error(`${label} must be a bounded explicit offset.`);
  return value;
}

function scopeBody(input: CoEventSearchScopeInput) {
  const {
    schemaVersion: _schemaVersion,
    inputFingerprint: _inputFingerprint,
    ...body
  } = input;
  return body;
}

export function createCoEventSearchScopeInput(input: Omit<
  CoEventSearchScopeInput,
  "schemaVersion" | "inputFingerprint"
>): CoEventSearchScopeInput {
  requireOffset(input.anticipationLookback, "Screen 4 anticipation lookback");
  requireOffset(input.contextLookforward, "Screen 4 context lookforward");
  requireTextList(input.knownCoEvents, "Screen 4 known co-events", 20);
  if (
    input.importantEntities.length > 24 ||
    new Set(input.importantEntities.map(({ kind, label }) =>
      `${kind}\u0000${label}`)).size !== input.importantEntities.length
  ) throw new Error("Screen 4 important entities must be a bounded unique list.");
  input.importantEntities.forEach((entity) => {
    if (![
      "supplier",
      "customer",
      "regulator",
      "market",
      "other",
    ].includes(entity.kind)) throw new Error("Screen 4 important entity kind is invalid.");
    requireText(entity.label, "Screen 4 important entity", 500);
  });
  if (typeof input.includeMeasurementChanges !== "boolean") {
    throw new Error("Screen 4 measurement-branch choice is invalid.");
  }
  const body = {
    schemaVersion: SIX_SCREEN_COEVENT_SCOPE_INPUT_VERSION,
    ...structuredClone(input),
  };
  return {
    ...body,
    inputFingerprint: fingerprintSixScreenValue(body),
  };
}

export function validateCoEventSearchScopeInput(input: CoEventSearchScopeInput) {
  const recreated = createCoEventSearchScopeInput(scopeBody(input));
  if (
    input.schemaVersion !== SIX_SCREEN_COEVENT_SCOPE_INPUT_VERSION ||
    input.inputFingerprint !== recreated.inputFingerprint
  ) throw new Error("Screen 4 search-scope fingerprint is invalid.");
  return input;
}

function uniqueTerms(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string =>
    Boolean(value?.trim())).map((value) => value.trim()))];
}

function officialProviders(confirmed: ConfirmedShock): CoEventProviderId[] {
  const jurisdiction = confirmed.issuingJurisdiction.toLowerCase();
  if (
    jurisdiction.includes("united states") ||
    jurisdiction.includes("u.s.") || jurisdiction === "us"
  ) {
    return [
      "federal_register",
      "govinfo",
      "ecfr",
      "regulations_gov",
      "congress_gov",
      "legiscan",
      "openstates",
    ];
  }
  if (jurisdiction.includes("european union") || jurisdiction === "eu") {
    return ["eu_cellar"];
  }
  if (
    jurisdiction.includes("united kingdom") || jurisdiction === "uk" ||
    jurisdiction === "u.k."
  ) return ["uk_legislation"];
  return [];
}

function providers(ids: readonly CoEventProviderId[]) {
  return [...new Set(ids)].map((id) => ({
    id,
    availability: "not_checked" as const,
  }));
}

function matrixGroups(
  study: StudyContext,
  decision: CausalDesignDecision,
  targeted: boolean,
) {
  if (targeted) {
    return [
      {
        role: "treatment" as const,
        label: decision.selectedDesign!.treatmentDefinition,
      },
      {
        role: "comparison" as const,
        label: decision.selectedDesign!.comparisonDefinition!,
      },
    ];
  }
  return [{ role: "population" as const, label: study.population! }];
}

function makeRow(input: {
  branch: CoEventSearchBranch;
  question: string;
  groups: CoEventSearchMatrixRow["affectedGroups"];
  period: CoEventSearchMatrixRow["relevantPeriod"];
  geographyOrMarket: string[];
  eventFamily: string;
  providers: CoEventProviderId[];
  queryTerms: string[];
}): CoEventSearchMatrixRow {
  return {
    id: `coevent-search-${input.branch.replaceAll("_", "-")}`,
    branch: input.branch,
    question: input.question,
    affectedGroups: structuredClone(input.groups),
    relevantPeriod: structuredClone(input.period),
    geographyOrMarket: [...input.geographyOrMarket],
    eventFamily: input.eventFamily,
    providers: providers(input.providers),
    queryTerms: [...input.queryTerms],
    plannedLimit: 12,
    outcome: { status: "not_started", candidateCount: 0, note: null },
  };
}

function requireStudyScope(study: StudyContext) {
  if (
    !study.population || !study.outcome || !study.geography.length ||
    !study.period.start || !study.period.end
  ) throw new Error("Screen 4 requires a population, outcome, geography, and complete study period.");
  return study as StudyContext & {
    population: string;
    outcome: string;
    period: { start: string; end: string };
  };
}

export function createCoEventSearchMatrix(input: {
  snapshotId: string;
  ordinal: number;
  scopeInput: CoEventSearchScopeInput;
  study: StudyContext;
  confirmedShock: ConfirmedShock;
  designSet: CausalDesignSet;
  designDecision: CausalDesignDecision;
  createdAt: string;
}): CoEventSearchMatrix {
  requireBoundedIdentifier(input.snapshotId, "Screen 4 matrix snapshot id");
  requireCanonicalInstant(input.createdAt, "Screen 4 matrix createdAt");
  if (!Number.isSafeInteger(input.ordinal) || input.ordinal < 1) {
    throw new Error("Screen 4 matrix ordinal is invalid.");
  }
  const scopeInput = validateCoEventSearchScopeInput(input.scopeInput);
  const study = requireStudyScope(input.study);
  const designSet = validateCausalDesignSet(input.designSet);
  const decision = validateCausalDesignDecision(
    input.designDecision,
    designSet,
  );
  if (
    designSet.binding.studyRevision !== study.revision ||
    designSet.binding.identityFingerprint !==
      input.confirmedShock.identityFingerprint
  ) throw new Error("Screen 4 inputs do not share current upstream coordinates.");
  const targeted = decision.decision === "selected" &&
    decision.selectedDesign?.comparisonDefinition !== null;
  const groups = matrixGroups(study, decision, targeted);
  const entityGroups = scopeInput.importantEntities.map(({ kind, label }) => ({
    role: "context_entity" as const,
    label: `${kind}: ${label}`,
  }));
  const period = {
    studyStart: study.period.start,
    studyEnd: study.period.end,
    anticipationLookback: structuredClone(scopeInput.anticipationLookback),
    contextLookforward: structuredClone(scopeInput.contextLookforward),
  };
  const entityTerms = scopeInput.importantEntities.map(({ label }) => label);
  const marketTerms = scopeInput.importantEntities.filter(({ kind }) =>
    kind === "market").map(({ label }) => label);
  const regulatorTerms = scopeInput.importantEntities.filter(({ kind }) =>
    kind === "regulator").map(({ label }) => label);
  const networkTerms = scopeInput.importantEntities.filter(({ kind }) =>
    kind === "supplier" || kind === "customer").map(({ label }) => label);
  const groupTerms = groups.map(({ label }) => label);
  const official = officialProviders(input.confirmedShock);
  const commonTerms = [
    input.confirmedShock.officialTitle,
    input.confirmedShock.issuer,
    ...input.confirmedShock.formalIdentifiers,
    ...study.geography,
    ...study.industry,
    ...scopeInput.knownCoEvents,
  ];
  const geographyOrMarket = uniqueTerms([
    ...study.geography,
    ...study.industry,
    ...marketTerms,
  ]);
  const rows: CoEventSearchMatrixRow[] = [
    makeRow({
      branch: "overlapping_policy",
      question:
        "Which additional policy changes overlap the declared study and context windows for the named population or market?",
      groups: [...groups, ...entityGroups],
      period,
      geographyOrMarket,
      eventFamily: "overlapping policies and regulatory changes",
      providers: [...official, "tavily", "brave"],
      queryTerms: uniqueTerms([
        ...commonTerms,
        ...regulatorTerms,
        "policy change",
        "regulation",
      ]),
    }),
    makeRow({
      branch: "implementation_or_litigation",
      question:
        "Did implementation delays, litigation, enforcement changes, or staged compliance alter when the confirmed policy could affect units?",
      groups,
      period,
      geographyOrMarket,
      eventFamily: "implementation, litigation, and enforcement",
      providers: [...official, "tavily", "brave"],
      queryTerms: uniqueTerms([
        input.confirmedShock.officialTitle,
        input.confirmedShock.issuer,
        ...input.confirmedShock.formalIdentifiers,
        ...regulatorTerms,
        "implementation delay",
        "litigation injunction enforcement compliance",
      ]),
    }),
    makeRow({
      branch: "independent_industry_or_market",
      question:
        "Which independent industry or market changes could affect the outcome during the declared windows?",
      groups: [...groups, ...entityGroups],
      period,
      geographyOrMarket,
      eventFamily: "independent industry and market changes",
      providers: ["crossref", "tavily", "brave"],
      queryTerms: uniqueTerms([
        study.population,
        study.outcome,
        ...study.industry,
        ...marketTerms,
        ...entityTerms,
        ...scopeInput.knownCoEvents,
        "industry change market disruption",
      ]),
    }),
    makeRow({
      branch: "disaster_or_disruption",
      question:
        "Which disasters or operational disruptions occurred in the relevant places during the declared windows?",
      groups,
      period,
      geographyOrMarket,
      eventFamily: "disasters and operational disruptions",
      providers: ["openfema", "usgs", "gdacs", "tavily", "brave"],
      queryTerms: uniqueTerms([
        ...study.geography,
        ...study.industry,
        ...scopeInput.knownCoEvents,
        "disaster disruption outage emergency",
      ]),
    }),
    makeRow({
      branch: "comparison_spillover",
      question: targeted
        ? "Could policy or market spillovers reach either the selected treatment group or the selected comparison group?"
        : "Which spillover routes should be checked if a comparison group is specified later?",
      groups: [...groups, ...entityGroups],
      period,
      geographyOrMarket,
      eventFamily: "spillovers and comparison contamination",
      providers: [...official, "crossref", "tavily", "brave"],
      queryTerms: uniqueTerms([
        input.confirmedShock.officialTitle,
        ...groupTerms,
        ...networkTerms,
        ...marketTerms,
        "spillover substitution contamination",
      ]),
    }),
  ];
  if (scopeInput.includeMeasurementChanges) rows.push(makeRow({
    branch: "measurement_or_sample_change",
    question:
      "Did measurement, reporting, sampling, or data-collection rules change for the stated outcome during the declared windows?",
    groups,
    period,
    geographyOrMarket,
    eventFamily: "measurement and sample changes",
    providers: [...official, "crossref", "tavily", "brave"],
    queryTerms: uniqueTerms([
      study.population,
      study.outcome,
      ...study.geography,
      "measurement reporting methodology sample redesign",
    ]),
  }));
  const body: MatrixBody = {
    schemaVersion: SIX_SCREEN_COEVENT_SEARCH_MATRIX_VERSION,
    snapshotId: input.snapshotId,
    ordinal: input.ordinal,
    binding: {
      studyRevision: study.revision,
      identityFingerprint: input.confirmedShock.identityFingerprint,
      eventCardReference: structuredClone(
        designSet.binding.eventCardReference,
      ),
      designSetSnapshotId: designSet.snapshotId,
      designSetFingerprint: designSet.designSetFingerprint,
      designDecisionSnapshotId: decision.snapshotId,
      designDecisionFingerprint: decision.decisionFingerprint,
      selectedDesignSnapshotId:
        targeted ? decision.selectedDesign!.snapshotId : null,
      selectedDesignFingerprint:
        targeted ? decision.selectedDesign!.selectedDesignFingerprint : null,
    },
    mode: targeted ? "targeted" : "contextual",
    modeLabel: targeted
      ? "Targeted event scan — selected comparison retained"
      : "Contextual event scan — comparison not specified.",
    policy: {
      officialTitle: input.confirmedShock.officialTitle,
      issuer: input.confirmedShock.issuer,
      issuingJurisdiction: input.confirmedShock.issuingJurisdiction,
      formalIdentifiers: [...input.confirmedShock.formalIdentifiers],
    },
    scope: {
      population: study.population,
      outcome: study.outcome,
      geography: [...study.geography],
      industry: [...study.industry],
      studyPeriod: structuredClone(study.period),
      anticipationLookback: structuredClone(scopeInput.anticipationLookback),
      contextLookforward: structuredClone(scopeInput.contextLookforward),
      knownCoEvents: [...scopeInput.knownCoEvents],
      importantEntities: structuredClone(scopeInput.importantEntities),
    },
    retrievalBudget: {
      initialMetadataCandidates: 100,
      attemptedDocuments: 24,
      pages: 12,
      externalActions: 24,
    },
    rows,
    execution: {
      status: "planned",
      executedRowIds: [],
      unavailableProviderIds: [],
      unavailableLanguages: [],
      actualSearchBoundary: null,
    },
    semanticRelationAnalysis: {
      status: "blocked",
      reason: "genuine_intelligence_path_unverified",
    },
    claimBoundary:
      "This saved matrix is a deterministic search plan, not an executed search, exhaustive event list, relevance finding, causal diagnosis, or instruction to add controls.",
    createdAt: input.createdAt,
  };
  const matrix = {
    ...body,
    matrixFingerprint: fingerprintSixScreenValue(body),
  };
  validateCoEventSearchMatrix(matrix, designSet, decision);
  return matrix;
}

function matrixBody(matrix: CoEventSearchMatrix) {
  const { matrixFingerprint: _fingerprint, ...body } = matrix;
  return body;
}

function validateReference(reference: PolicyEventCardReference) {
  requireBoundedIdentifier(
    reference.eventCardSnapshotId,
    "Screen 4 Event Card snapshot id",
  );
  requireFingerprint(
    reference.eventCardFingerprint,
    "Screen 4 Event Card fingerprint",
  );
  requireFingerprint(
    reference.referenceFingerprint,
    "Screen 4 Event Card reference fingerprint",
  );
  const { referenceFingerprint: _fingerprint, ...body } = reference;
  if (reference.referenceFingerprint !== fingerprintSixScreenValue(body)) {
    throw new Error("Screen 4 Event Card reference fingerprint is invalid.");
  }
}

export function validateCoEventSearchMatrix(
  matrix: CoEventSearchMatrix,
  designSet: CausalDesignSet,
  decision: CausalDesignDecision,
) {
  validateCausalDesignDecision(decision, designSet);
  if (
    matrix.schemaVersion !== SIX_SCREEN_COEVENT_SEARCH_MATRIX_VERSION ||
    matrix.matrixFingerprint !== fingerprintSixScreenValue(matrixBody(matrix)) ||
    !Number.isSafeInteger(matrix.ordinal) || matrix.ordinal < 1 ||
    matrix.binding.studyRevision !== designSet.binding.studyRevision ||
    matrix.binding.identityFingerprint !== designSet.binding.identityFingerprint ||
    matrix.binding.designSetSnapshotId !== designSet.snapshotId ||
    matrix.binding.designSetFingerprint !== designSet.designSetFingerprint ||
    matrix.binding.designDecisionSnapshotId !== decision.snapshotId ||
    matrix.binding.designDecisionFingerprint !== decision.decisionFingerprint ||
    matrix.binding.eventCardReference.referenceFingerprint !==
      designSet.binding.eventCardReference.referenceFingerprint
  ) throw new Error("Screen 4 search matrix is invalid or changed.");
  requireBoundedIdentifier(matrix.snapshotId, "Screen 4 matrix snapshot id");
  requireFingerprint(matrix.binding.identityFingerprint, "Screen 4 identity fingerprint");
  validateReference(matrix.binding.eventCardReference);
  requireCanonicalInstant(matrix.createdAt, "Screen 4 matrix createdAt");
  const targeted = decision.decision === "selected" &&
    decision.selectedDesign?.comparisonDefinition !== null;
  if (
    targeted !== (matrix.mode === "targeted") ||
    matrix.modeLabel !== (targeted
      ? "Targeted event scan — selected comparison retained"
      : "Contextual event scan — comparison not specified.") ||
    matrix.binding.selectedDesignSnapshotId !==
      (targeted ? decision.selectedDesign!.snapshotId : null) ||
    matrix.binding.selectedDesignFingerprint !==
      (targeted ? decision.selectedDesign!.selectedDesignFingerprint : null)
  ) throw new Error("Screen 4 matrix mode does not match the researcher decision.");
  requireText(matrix.policy.officialTitle, "Screen 4 policy title");
  requireText(matrix.policy.issuer, "Screen 4 policy issuer");
  requireText(matrix.policy.issuingJurisdiction, "Screen 4 policy jurisdiction");
  requireTextList(matrix.policy.formalIdentifiers, "Screen 4 policy identifiers");
  requireText(matrix.scope.population, "Screen 4 population");
  requireText(matrix.scope.outcome, "Screen 4 outcome");
  requireText(matrix.scope.studyPeriod.start, "Screen 4 study start", 40);
  requireText(matrix.scope.studyPeriod.end, "Screen 4 study end", 40);
  requireTextList(matrix.scope.geography, "Screen 4 geography", 20);
  requireTextList(matrix.scope.industry, "Screen 4 industry", 20);
  requireTextList(matrix.scope.knownCoEvents, "Screen 4 known co-events", 20);
  if (
    matrix.scope.importantEntities.length > 24 ||
    new Set(matrix.scope.importantEntities.map(({ kind, label }) =>
      `${kind}\u0000${label}`)).size !== matrix.scope.importantEntities.length
  ) throw new Error("Screen 4 important entities are invalid.");
  matrix.scope.importantEntities.forEach(({ kind, label }) => {
    if (![
      "supplier",
      "customer",
      "regulator",
      "market",
      "other",
    ].includes(kind)) throw new Error("Screen 4 important entity kind is invalid.");
    requireText(label, "Screen 4 important entity", 500);
  });
  requireOffset(matrix.scope.anticipationLookback, "Screen 4 anticipation lookback");
  requireOffset(matrix.scope.contextLookforward, "Screen 4 context lookforward");
  if (
    matrix.scope.population !== designSet.population ||
    matrix.scope.outcome !== designSet.outcome ||
    JSON.stringify(matrix.scope.geography) !== JSON.stringify(designSet.geography) ||
    matrix.scope.studyPeriod.start !== designSet.studyPeriod.start ||
    matrix.scope.studyPeriod.end !== designSet.studyPeriod.end
  ) throw new Error("Screen 4 scope does not match its immutable Design Set.");
  if (
    matrix.rows.length < 5 || matrix.rows.length > 6 ||
    new Set(matrix.rows.map(({ id }) => id)).size !== matrix.rows.length ||
    new Set(matrix.rows.map(({ branch }) => branch)).size !== matrix.rows.length ||
    !matrix.rows.every(({ branch }) => COEVENT_SEARCH_BRANCHES.includes(branch))
  ) throw new Error("Screen 4 search matrix branches are invalid.");
  matrix.rows.forEach((row) => {
    requireBoundedIdentifier(row.id, "Screen 4 search row id");
    requireText(row.question, "Screen 4 search question");
    requireText(row.eventFamily, "Screen 4 event family", 500);
    requireTextList(row.geographyOrMarket, "Screen 4 geography or market", 40);
    requireTextList(row.queryTerms, "Screen 4 query terms", 40);
    if (
      !row.affectedGroups.length || row.affectedGroups.length > 32 ||
      !row.providers.length || row.providers.length > 16 ||
      !row.queryTerms.length ||
      !Number.isSafeInteger(row.plannedLimit) || row.plannedLimit < 1 ||
      row.plannedLimit > 20 || row.outcome.status !== "not_started" ||
      row.outcome.candidateCount !== 0 || row.outcome.note !== null
    ) throw new Error("Screen 4 search row is invalid.");
    row.affectedGroups.forEach(({ label }) =>
      requireText(label, "Screen 4 affected group", 500));
    requireText(row.relevantPeriod.studyStart, "Screen 4 row study start", 40);
    requireText(row.relevantPeriod.studyEnd, "Screen 4 row study end", 40);
    requireOffset(row.relevantPeriod.anticipationLookback, "Screen 4 row lookback");
    requireOffset(row.relevantPeriod.contextLookforward, "Screen 4 row lookforward");
    if (new Set(row.providers.map(({ id }) => id)).size !== row.providers.length) {
      throw new Error("Screen 4 planned providers must be unique.");
    }
    row.providers.forEach((provider) => {
      if (
        !COEVENT_PROVIDER_IDS.includes(provider.id) ||
        provider.availability !== "not_checked"
      ) {
        throw new Error("Screen 4 planned provider availability was overstated.");
      }
    });
    if (
      targeted &&
      (!row.affectedGroups.some(({ role }) => role === "treatment") ||
        !row.affectedGroups.some(({ role }) => role === "comparison"))
    ) throw new Error("A targeted Screen 4 row must search both selected groups.");
    if (
      !targeted && row.affectedGroups.some(({ role }) =>
        role === "treatment" || role === "comparison")
    ) throw new Error("A contextual Screen 4 row cannot imply differential group exposure.");
    if (
      row.relevantPeriod.studyStart !== matrix.scope.studyPeriod.start ||
      row.relevantPeriod.studyEnd !== matrix.scope.studyPeriod.end ||
      JSON.stringify(row.relevantPeriod.anticipationLookback) !==
        JSON.stringify(matrix.scope.anticipationLookback) ||
      JSON.stringify(row.relevantPeriod.contextLookforward) !==
        JSON.stringify(matrix.scope.contextLookforward)
    ) throw new Error("Screen 4 row period does not match the saved scope.");
  });
  if (
    matrix.retrievalBudget.initialMetadataCandidates !== 100 ||
    matrix.retrievalBudget.attemptedDocuments !== 24 ||
    matrix.retrievalBudget.pages !== 12 ||
    matrix.retrievalBudget.externalActions !== 24 ||
    matrix.execution.status !== "planned" ||
    matrix.execution.executedRowIds.length ||
    matrix.execution.unavailableProviderIds.length ||
    matrix.execution.unavailableLanguages.length ||
    matrix.execution.actualSearchBoundary !== null ||
    matrix.semanticRelationAnalysis.status !== "blocked" ||
    matrix.semanticRelationAnalysis.reason !==
      "genuine_intelligence_path_unverified"
  ) throw new Error("Screen 4 matrix overstated search execution or semantic analysis.");
  requireText(matrix.claimBoundary, "Screen 4 matrix claim boundary");
  return matrix;
}

export function validateCoEventSearchCollections(input: {
  matrices: readonly CoEventSearchMatrix[];
  designSets: readonly CausalDesignSet[];
  decisions: readonly CausalDesignDecision[];
}) {
  if (
    input.matrices.length > SIX_SCREEN_COEVENT_SEARCH_MAX_REVISIONS ||
    new Set(input.matrices.map(({ snapshotId }) => snapshotId)).size !==
      input.matrices.length || bytes(input.matrices) >
      SIX_SCREEN_COEVENT_SEARCH_MAX_BYTES
  ) throw new Error("Stored Screen 4 search-matrix history is invalid or exceeds its bounded capacity.");
  const designSets = new Map(input.designSets.map((value) =>
    [value.snapshotId, value]));
  const decisions = new Map(input.decisions.map((value) =>
    [value.snapshotId, value]));
  let ordinal = 0;
  input.matrices.forEach((matrix) => {
    if (matrix.ordinal <= ordinal) {
      throw new Error("Stored Screen 4 matrix ordinals must increase.");
    }
    ordinal = matrix.ordinal;
    const designSet = designSets.get(matrix.binding.designSetSnapshotId);
    const decision = decisions.get(matrix.binding.designDecisionSnapshotId);
    if (!designSet || !decision) {
      throw new Error("Stored Screen 4 matrix upstream lineage is unavailable.");
    }
    validateCoEventSearchMatrix(matrix, designSet, decision);
  });
  return input;
}
