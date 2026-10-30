export type ProductionMatrixArguments = {
  help: boolean;
  list: boolean;
  suite: "screen2" | "screen3" | "all";
  caseId: string | null;
  waitSeconds: number;
  evidenceDir: string;
};

export type ProductionMatrixCaseSelection = {
  suite: "screen2" | "screen3";
  input: Record<string, unknown> & { caseId: string };
};

export const executionFlags: Readonly<{
  simulated: true;
  signedIn: false;
  humanInteraction: false;
  genuineHostEvidence: false;
  hostSubmissions: 0;
  formalQualification: false;
}>;

export function sanitizeText(value: unknown): string;
export function sanitizeEvidence(value: unknown, key?: string): unknown;
export function validateCaseManifest<T>(value: T): T;
export function parseArguments(argv: string[]): ProductionMatrixArguments;
export function selectCases(
  manifest: Record<string, unknown>,
  suite: "screen2" | "screen3" | "all",
  caseId: string | null,
): ProductionMatrixCaseSelection[];
export function requireScreen02RetrievalBudget(
  manifest: Record<string, unknown>,
  options?: {
    caseId?: string;
    generalLegal?: boolean;
    allowUnsupportedRoute?: boolean;
    allowedCandidateIds?: ReadonlySet<string> | null;
    allowedSourceIds?: ReadonlySet<string> | null;
    candidateSourceIds?: ReadonlyMap<string, ReadonlySet<string>> | null;
    sourcesById?: ReadonlyMap<string, unknown> | null;
  },
): {
  rawCandidateTarget: number;
  rawCandidateMaximum: number;
  qualifiedCandidateTarget: number;
  queryVariantsPlanned: number;
  minimumQueryVariants: number;
  maximumQueryVariants: number;
  queryRequestsExecuted: number;
  roundsExecuted: number;
  maximumRounds: number;
  recordsReceived: number;
  proposalsGenerated: number;
  uniqueProposalsGenerated: number;
  stoppingReason:
    | "raw-max"
    | "raw-target"
    | "query-budget"
    | "routes-exhausted"
    | "source-failure"
    | "unsupported"
    | "invalid";
  documentLimits: {
    maximumAcquisitions: 24;
    maximumRedirects: 3;
    requestTimeoutMs: 3000;
    runTimeoutMs: 45000;
    maximumBytes: 2097152;
    totalBytes: 6291456;
    concurrency: 2;
  };
  baseline: Record<string, unknown>;
  qualificationRecovery: Record<string, unknown> | null;
  aggregate: Record<string, unknown> & { terminal: true };
  documentAcquisitions: Array<Record<string, unknown>>;
};
export function requireCurrentScreen02HandoffRetrieval<T>(
  handoff: T,
  options?: { caseId?: string },
): T;
export function projectScreen02Result(
  input: Record<string, unknown>,
  snapshot: Record<string, unknown>,
): Record<string, unknown>;
export function hasReviewedScreen02CandidateEvidence(
  input: Record<string, unknown>,
  candidate: Record<string, unknown>,
  sourcesById: ReadonlyMap<string, Record<string, unknown>>,
): boolean;
export function projectScreen03State(
  state: Record<string, unknown>,
): Record<string, unknown>;
export function evaluateScreen03Scenario(
  input: Record<string, unknown>,
  observation: Record<string, unknown>,
): { status: "passed" | "failed"; reasons: string[] };

export type ProductionMatrixCaseProgress = {
  operation: string | null;
  lastSuccessfulStep: string | null;
  completedSteps: string[];
  observations: Record<string, unknown>;
};
export type ProductionMatrixCaseFailure = ProductionMatrixCaseProgress & {
  failure: string;
  failureCode: string;
  publicFailureMessage: string | null;
};
export function createCaseProgress(): ProductionMatrixCaseProgress;
export function recordCaseProgress(
  operation: string,
  update?: { completed?: boolean; observations?: Record<string, unknown> },
): Promise<void>;
export function projectCaseFailure(
  error: unknown,
  progress?: ProductionMatrixCaseProgress,
): ProductionMatrixCaseFailure;
export function assertToolSuccess(result: unknown, label: string): void;
export function assertConfirmedContext(input: Record<string, unknown>, mode: "find" | "audit", result: unknown): unknown;
export function projectScopeConfirmation(input: Record<string, unknown>, result: unknown): {
  requestedScope: unknown;
  returnedScope: unknown;
  confirmed: boolean | null;
  readyForLaterScreens: boolean | null;
  unresolvedDecisions: Array<{ key: string; title: string; question: string }>;
  publicMessage: string;
};
export function projectScreen02Diagnostics(state: unknown, mode: "find" | "audit", authenticatedSnapshot?: unknown): {
  funnel: Record<string, number> | null;
  sourceRoutes: Array<{ channel: string; status: string; note: string }>;
  [key: string]: unknown;
};
export function projectAuditStartingSource(state: unknown): {
  anchorLocator: string | null;
  contextLeads: Array<{
    title: string;
    locator: string;
    publisher: string;
    sourceRole: string;
    status: string;
  }>;
};
export function qualificationLaneIndex(state: unknown): Map<string, string>;
export function isPersistedQualificationReuseReason(reason: unknown): boolean;
export function assertPreservedCacheLanes(
  firstLanes: Map<string, string>,
  reusedEntries: Array<{ candidateId: string; lane: string }>,
  caseId: string,
): void;
export function runSelectedCase(
  selected: ProductionMatrixCaseSelection,
  evidenceDir: string,
  executeCase?: (selected: ProductionMatrixCaseSelection) => Promise<{
    observations: Record<string, unknown>;
    scenarioPredicate: { status: "passed" | "failed"; [key: string]: unknown };
  }>,
): Promise<ProductionMatrixCaseProgress & {
  status: "passed" | "failed";
  failure?: string;
  failureCode?: string;
  publicFailureMessage?: string | null;
}>;

export type ProductionMatrixExpectedMode = "positive-journey" | "honest-shortfall" | "negative-evidence";
export function assertScreen02Acceptance(input: Record<string, unknown>, observation: Record<string, unknown>): Record<string, unknown>;
export function assertFindPositiveHandoff(input: Record<string, unknown>, snapshot: Record<string, unknown>, selectedId: string): void;
export function targetMatches(identity: Record<string, unknown>, targetTerms: string[]): boolean;
export function pdfContentLimitation(input: Record<string, unknown>, observation: Record<string, unknown>): {
  locator: string; sourceObserved: boolean; hasDocumentContent: boolean; locatorBoundGaps: string[]; contentUnavailable: boolean;
};
export function summarizeModeResults(cases: Array<{ expectedMode: string; status: string }>): Record<ProductionMatrixExpectedMode, { total: number; passed: number; failed: number }>;

export function assertScreen03EvidenceGuardRejection(result: unknown, label: string): void;
