import type { Screen01StudyContext } from "./scope-types";
import { serializeDeterministicJson } from "./screen02-deterministic-json";
import {
  SCREEN02_QUALIFICATION_GROUNDING_POLICY_VERSION,
  isScreen02CandidateQualification,
  screen02QualificationLanes,
  type Screen02CandidateQualification,
  type Screen02QualificationLane,
} from "./screen02-qualification-codec";
import { SCREEN02_SOURCE_GROUNDING_VERSION } from "./screen02-source-grounding";
import type {
  Screen02StudyRelevanceProfile,
  Screen02StudyRelevanceProfileHostAdditions,
} from "./screen02-relevance-profile";
import type { Screen02ShockGlance } from "./screen02-shock-glance";
import {
  isSanitizedScreen02AcquisitionUrl,
  isScreen02DocumentAcquisition,
  sanitizeScreen02AcquisitionUrl,
  type Screen02DocumentAcquisition,
} from "./screen02-document-acquisition";
import type { Screen02ContextOfficialBridgeProvenance } from "./screen02-context-bridge";

export const SCREEN_02_WORKFLOW_SCHEMA_VERSION = "2.1" as const;
export const SCREEN_02_FIND_STATE_KIND = "screen-02-find" as const;
export const SCREEN_02_AUDIT_STATE_KIND = "screen-02-audit" as const;
export const SCREEN_02_WORKFLOW_SOURCE_POLICY_VERSION =
  "screen-02-source-policy-v1" as const;
export const SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_VERSION =
  "screen-02-search-protocol-v4" as const;
export const SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_LEGACY_VERSION =
  "screen-02-search-protocol-v3" as const;
export const SCREEN_02_RETRIEVAL_EXECUTION_SCHEMA_VERSION =
  "screen-02-retrieval-execution-v2" as const;
export const SCREEN_02_RETRIEVAL_EXECUTION_LEGACY_SCHEMA_VERSION =
  "screen-02-retrieval-execution-v1" as const;
export const SCREEN_02_RETAINED_RESULT_BINDING_SCHEMA_VERSION =
  "screen-02-retained-result-binding-v2" as const;
export const SCREEN_02_SEARCH_FUNNEL_SCHEMA_VERSION =
  "screen-02-search-funnel-v2" as const;
export const SCREEN_02_SEARCH_FUNNEL_LEGACY_SCHEMA_VERSION =
  "screen-02-search-funnel-v1" as const;
/**
 * Absolute best-effort host window, measured from the canonical request's
 * first prepared lifecycle event. It remains well inside the 120-second
 * capability lifetime so a hung message channel cannot strand Screen 2.
 */
export const SCREEN_02_HOST_ASSESSMENT_DEADLINE_MS = 45_000;

/**
 * A migrated qualification remains readable audit history, never current
 * evidence for a new selection or Screen 3 handoff. Current eligibility must
 * retain at least one affirmative source coordinate that binds both event
 * identity and action/change language to the qualification evidence set.
 */
export function isFreshScreen02SelectionQualification(
  value: unknown,
): value is Screen02CandidateQualification {
  if (
    !isScreen02CandidateQualification(value) || value.eligible !== true ||
    !value.candidateAdmission ||
    value.candidateAdmission.displayEvidence.supported !== true ||
    value.candidateAdmission.relevance.recommended !== true ||
    Object.prototype.hasOwnProperty.call(value, "migrationProvenance") ||
    !value.cacheKey.endsWith(
      `:grounding:${SCREEN02_SOURCE_GROUNDING_VERSION}:${SCREEN02_QUALIFICATION_GROUNDING_POLICY_VERSION}:${value.sourceFingerprint}:${value.candidateId}`,
    )
  ) return false;
  const evidenceSourceIds = new Set(value.evidenceSourceIds);
  const overviewSourceIds = new Set(
    value.substantiveOverview.evidenceSourceIds,
  );
  const coordinates = value.substantiveOverview.sourceGrounding.coordinates;
  return coordinates.length > 0 && coordinates.every((coordinate) =>
    evidenceSourceIds.has(coordinate.sourceId) &&
    overviewSourceIds.has(coordinate.sourceId)
  ) && coordinates.some((coordinate) =>
    coordinate.polarity === "affirmative" &&
    coordinate.matchedActionTerms.length > 0 &&
    (coordinate.matchedIdentityTerms.length > 0 ||
      coordinate.matchedFormalIdentifiers.length > 0)
  );
}

export type WorkflowDeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? readonly WorkflowDeepReadonly<U>[]
    : T extends object
      ? { readonly [K in keyof T]: WorkflowDeepReadonly<T[K]> }
      : T;

export type Screen02WorkflowSourceAuthorityTier = 1 | 2 | 3 | 4 | 5 | 6;

export type Screen02WorkflowSource = {
  id: string;
  sourceFingerprint: string;
  title: string;
  locator: string;
  publisher: string;
  publishedDate: string | null;
  authorityTier: Screen02WorkflowSourceAuthorityTier;
  channel: string;
  retrievedAt: string;
  userProvided: boolean;
  /**
   * Optional bounded text captured by a trusted connector or from a
   * researcher-supplied URL. It is evidence context, not a verified claim,
   * and remains inside the immutable source fingerprint.
   */
  evidenceText?: string;
};

export type Screen02ProvisionalClaim = {
  id: string;
  text: string;
  sourceIds: string[];
  status: "provisional";
  uncertainty: string | null;
};

export const screen02DateLeadStages = [
  "announcement",
  "adoption",
  "enactment",
  "scheduled_effect",
  "effective",
  "implementation",
  "enforcement",
  "publication",
  "ruling",
  "injunction",
  "invalidation",
  "withdrawal",
  "repeal",
  "supersession",
  "rulemaking",
  "amendment",
  "occurrence",
  "other",
] as const;

export type Screen02DateLeadStage =
  (typeof screen02DateLeadStages)[number];

export type Screen02DateLead = {
  id: string;
  date: string;
  label: string;
  stage: Screen02DateLeadStage;
  sourceIds: string[];
  status: "provisional";
  uncertainty: string | null;
};

export type Screen02EventIdentity = {
  canonicalTitle: string;
  commonNames: string[];
  formalIdentifier: string | null;
  issuer: string | null;
  issuingJurisdiction: string | null;
  eventType: string;
  status: string | null;
};

export type Screen02SearchQueryRecord = {
  id: string;
  query: string;
  purpose: string;
  returnedRecordIds: string[];
};

export type Screen02SearchChannelRecord = {
  channel: string;
  status: "searched" | "not-searched" | "failed";
  note: string;
  retrievedAt: string | null;
};

export type Screen02SearchExclusion = {
  recordId: string;
  reason: string;
  /**
   * Present for v0.4.03 candidate qualification decisions. Older manifests
   * remain readable without it.
   */
  qualification?: Screen02CandidateQualification;
};

export const screen02RetrievalStoppingReasons = [
  "raw-max",
  "raw-target",
  "query-budget",
  "routes-exhausted",
  "source-failure",
  "unsupported",
  "invalid",
] as const;

export type Screen02RetrievalStoppingReason =
  (typeof screen02RetrievalStoppingReasons)[number];

export type Screen02RetrievalExecutionMetrics = {
  queriesPlanned: number;
  queriesAttempted: number;
  queriesSucceeded: number;
  queriesFailed: number;
  roundsExecuted: number;
  recordsReceived: number;
  proposalsGenerated: number;
  uniqueProposalsGenerated: number;
};

export type Screen02RetrievalBaselineExecution =
  Screen02RetrievalExecutionMetrics & {
    phase: "baseline";
    status: "completed" | "failed" | "unsupported" | "invalid";
    queryIds: string[];
    stoppingReason: Screen02RetrievalStoppingReason;
  };

export type Screen02RetrievalRecoveryExecution =
  Screen02RetrievalExecutionMetrics & {
    phase: "qualification-recovery";
    status: "completed" | "failed";
    queryIds: [string];
    stoppingReason:
      | "qualification-recovery-completed"
      | "qualification-recovery-failed";
  };

export type Screen02RetrievalExecution = {
  schemaVersion: typeof SCREEN_02_RETRIEVAL_EXECUTION_SCHEMA_VERSION;
  limits: {
    rawCandidateTarget: 40;
    rawCandidateMaximum: 60;
    qualifiedCandidateTarget: 10;
    minimumGeneralQueryVariants: 12;
    maximumGeneralQueryVariants: 16;
    maximumBaselineRounds: 2;
    maximumDocumentAcquisitions: 24;
    maximumDocumentRedirects: 3;
    documentRequestTimeoutMs: 3000;
    documentRunTimeoutMs: 45000;
    documentMaximumBytes: 2097152;
    documentTotalBytes: 6291456;
    documentConcurrency: 2;
  };
  baseline: Screen02RetrievalBaselineExecution;
  qualificationRecovery: Screen02RetrievalRecoveryExecution | null;
  aggregate: Screen02RetrievalExecutionMetrics & { terminal: true };
  documentAcquisitions: Screen02DocumentAcquisition[];
  outcomeValuesInspected: false;
};

const screen02RetrievalMetricKeys = [
  "queriesPlanned",
  "queriesAttempted",
  "queriesSucceeded",
  "queriesFailed",
  "roundsExecuted",
  "recordsReceived",
  "proposalsGenerated",
  "uniqueProposalsGenerated",
] as const;

function hasExactScreen02Keys(
  value: Record<string, unknown>,
  expected: readonly string[],
) {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index]);
}

function isScreen02RetrievalMetrics(
  value: Record<string, unknown>,
) {
  const metricsAreNonNegativeIntegers = screen02RetrievalMetricKeys.every((key) =>
    Number.isSafeInteger(value[key]) && (value[key] as number) >= 0
  );
  if (!metricsAreNonNegativeIntegers) return false;
  const attempted = value.queriesAttempted as number;
  const rounds = value.roundsExecuted as number;
  const records = value.recordsReceived as number;
  const proposals = value.proposalsGenerated as number;
  const uniqueProposals = value.uniqueProposalsGenerated as number;
  return (value.queriesSucceeded as number) +
        (value.queriesFailed as number) ===
      attempted &&
    attempted <= (value.queriesPlanned as number) &&
    (attempted === 0 ? rounds === 0 : rounds > 0 && rounds <= attempted) &&
    uniqueProposals <= proposals &&
    proposals <= records &&
    ((value.queriesSucceeded as number) > 0 ||
      (records === 0 && proposals === 0 && uniqueProposals === 0));
}

const SCREEN_02_DOCUMENT_RUN_TIMEOUT_MS = 45_000;
const SCREEN_02_DOCUMENT_MAX_BYTES = 2 * 1024 * 1024;
const SCREEN_02_DOCUMENT_TOTAL_BYTES = 6 * 1024 * 1024;

function screen02DiagnosticHostnameIsPublic(value: string) {
  if (!isSanitizedScreen02AcquisitionUrl(value)) return false;
  const url = new URL(value);
  const hostname = url.hostname.toLocaleLowerCase("en-US")
    .replace(/^\[|\]$/gu, "");
  if (
    !hostname.includes(".") || hostname.includes(":") ||
    hostname === "localhost" || hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") || hostname.endsWith(".internal") ||
    hostname.endsWith(".home.arpa")
  ) return false;
  const ipv4 = hostname.match(
    /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/u,
  );
  if (!ipv4) return true;
  const octets = ipv4.slice(1).map(Number);
  if (octets.some((octet) => octet < 0 || octet > 255)) return false;
  const [first, second, third] = octets;
  return !(
    first === 0 || first === 10 || first === 127 || first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0 && third === 0) ||
    (first === 192 && second === 0 && third === 2) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113)
  );
}

function screen02DecodedAcquisitionPathSegments(url: URL) {
  try {
    return url.pathname.split("/").filter(Boolean).map((segment) =>
      decodeURIComponent(segment)
    );
  } catch {
    return [];
  }
}

function screen02FederalDocumentId(url: URL) {
  const host = url.hostname.toLocaleLowerCase("en-US");
  const segments = screen02DecodedAcquisitionPathSegments(url);
  let candidate: string | undefined;
  if (["federalregister.gov", "www.federalregister.gov"].includes(host)) {
    if (segments[0]?.toLocaleLowerCase("en-US") === "d") {
      candidate = segments[1];
    } else if (
      segments[0]?.toLocaleLowerCase("en-US") === "documents" &&
      segments[1]?.toLocaleLowerCase("en-US") === "full_text"
    ) {
      candidate = segments[6]?.replace(/\.(?:html?|txt|xml)$/iu, "");
    } else if (segments[0]?.toLocaleLowerCase("en-US") === "documents") {
      candidate = segments[4];
    }
  } else if (
    ["govinfo.gov", "www.govinfo.gov"].includes(host) &&
    segments[0]?.toLocaleLowerCase("en-US") === "content" &&
    segments[1]?.toLocaleLowerCase("en-US") === "pkg" &&
    /^FR-\d{4}-\d{2}-\d{2}$/iu.test(segments[2] ?? "") &&
    /^(?:html|pdf|text|xml)$/iu.test(segments[3] ?? "")
  ) {
    candidate = segments[4]?.replace(/\.(?:html?|pdf|txt|xml)$/iu, "");
  }
  return candidate && /^[a-z0-9][a-z0-9-]{2,79}$/iu.test(candidate)
    ? candidate
    : null;
}

function screen02AcquisitionHostnameIsProducerAllowed(host: string) {
  const restrictedOfficialRoots = [
    "ftc.gov",
    "federalregister.gov",
    "govinfo.gov",
  ];
  const restrictedAlias = restrictedOfficialRoots.some((root) =>
    host.endsWith(`.${root}`) && host !== `www.${root}`
  );
  const official = !restrictedAlias && (
    [
      "ftc.gov", "www.ftc.gov",
      "federalregister.gov", "www.federalregister.gov",
      "govinfo.gov", "www.govinfo.gov",
    ].includes(host) ||
    host.endsWith(".gov") || host.endsWith(".gov.uk") ||
    host === "eur-lex.europa.eu" || host.endsWith(".europa.eu") ||
    host === "gdacs.org" || host.endsWith(".gdacs.org")
  );
  const contextualRoots = [
    "reuters.com", "apnews.com", "brookings.edu", "rand.org",
    "americanbar.org", "lawfaremedia.org", "harvard.edu", "stanford.edu",
  ];
  const contextual = contextualRoots.some((root) =>
    host === root || host.endsWith(`.${root}`)
  );
  return host !== "europa.eu" && (official || contextual);
}

function screen02AcquisitionUrlsShareAuthority(left: URL, right: URL) {
  const leftHost = left.hostname.toLocaleLowerCase("en-US");
  const rightHost = right.hostname.toLocaleLowerCase("en-US");
  if (
    !screen02AcquisitionHostnameIsProducerAllowed(leftHost) ||
    !screen02AcquisitionHostnameIsProducerAllowed(rightHost)
  ) return false;
  const federalRegisterHosts = new Set([
    "federalregister.gov",
    "www.federalregister.gov",
  ]);
  const govInfoHosts = new Set(["govinfo.gov", "www.govinfo.gov"]);
  const leftIsFederalRegister = federalRegisterHosts.has(leftHost);
  const rightIsFederalRegister = federalRegisterHosts.has(rightHost);
  const leftIsGovInfo = govInfoHosts.has(leftHost);
  const rightIsGovInfo = govInfoHosts.has(rightHost);
  const leftIsFederal = leftIsFederalRegister || leftIsGovInfo;
  const rightIsFederal = rightIsFederalRegister || rightIsGovInfo;
  if (leftIsFederal || rightIsFederal) {
    if (!leftIsFederal || !rightIsFederal) return false;
    const leftId = screen02FederalDocumentId(left);
    const rightId = screen02FederalDocumentId(right);
    const crossesFamily = leftIsFederalRegister !== rightIsFederalRegister;
    if (crossesFamily) return leftId !== null && rightId === leftId;
    return leftId === null || rightId === leftId;
  }
  if (leftHost === rightHost) return true;
  const withoutWww = (host: string) => host.replace(/^www\./u, "");
  if (withoutWww(leftHost) === withoutWww(rightHost)) return true;
  const isEuropa = (host: string) =>
    host === "eur-lex.europa.eu" || host.endsWith(".europa.eu");
  return isEuropa(leftHost) && isEuropa(rightHost);
}

/** Exact endpoint and producer-equivalent authority-family source binding. */
export function screen02DocumentAcquisitionMatchesSource(
  acquisition: Screen02DocumentAcquisition,
  source: Screen02WorkflowSource,
) {
  const sourceLocator = sanitizeScreen02AcquisitionUrl(source.locator);
  if (
    !sourceLocator ||
    (sourceLocator !== acquisition.requestedUrl &&
      sourceLocator !== acquisition.finalUrl)
  ) return false;
  const sourceUrl = new URL(sourceLocator);
  const traceUrls = [
    acquisition.requestedUrl,
    ...acquisition.redirectChain.flatMap((hop) => [hop.fromUrl, hop.toUrl]),
    ...(acquisition.finalUrl ? [acquisition.finalUrl] : []),
  ];
  return traceUrls.every((url) =>
    screen02AcquisitionUrlsShareAuthority(sourceUrl, new URL(url))
  ) && traceUrls.slice(1).every((url, index) =>
    screen02AcquisitionUrlsShareAuthority(
      new URL(traceUrls[index]!),
      new URL(url),
    )
  );
}

function screen02DocumentAcquisitionsRespectBudgetsAndContinuity(
  acquisitions: readonly Screen02DocumentAcquisition[],
) {
  let totalBytes = 0;
  let successfulBytes = 0;
  for (const acquisition of acquisitions) {
    if (
      !screen02DiagnosticHostnameIsPublic(acquisition.requestedUrl) ||
      (acquisition.finalUrl !== null &&
        !screen02DiagnosticHostnameIsPublic(acquisition.finalUrl)) ||
      acquisition.receivedBytes > SCREEN_02_DOCUMENT_MAX_BYTES + 1 ||
      // Acquisition latency includes queueing and redirect hops; the 3-second
      // request controller is enforced at fetch time, not inferred here.
      acquisition.latencyMs > SCREEN_02_DOCUMENT_RUN_TIMEOUT_MS + 1
    ) return false;
    totalBytes += acquisition.receivedBytes;
    if (acquisition.outcome === "succeeded") {
      if (
        acquisition.receivedBytes > SCREEN_02_DOCUMENT_MAX_BYTES ||
        acquisition.latencyMs > SCREEN_02_DOCUMENT_RUN_TIMEOUT_MS
      ) return false;
      successfulBytes += acquisition.receivedBytes;
    }
    let expectedFrom = acquisition.requestedUrl;
    const visited = new Set([expectedFrom]);
    for (const hop of acquisition.redirectChain) {
      if (
        !screen02DiagnosticHostnameIsPublic(hop.fromUrl) ||
        !screen02DiagnosticHostnameIsPublic(hop.toUrl) ||
        hop.fromUrl !== expectedFrom || visited.has(hop.toUrl)
      ) return false;
      visited.add(hop.toUrl);
      expectedFrom = hop.toUrl;
    }
    if (
      (acquisition.finalUrl === null && acquisition.redirectChain.length > 0) ||
      (acquisition.finalUrl !== null && acquisition.finalUrl !== expectedFrom)
    ) return false;
  }
  // The producer saturates an overflow at one byte beyond the shared bound,
  // retaining the fact of rejection without admitting an unbounded trace.
  return totalBytes <= SCREEN_02_DOCUMENT_TOTAL_BYTES + 1 &&
    successfulBytes <= SCREEN_02_DOCUMENT_TOTAL_BYTES;
}

function isScreen02RetrievalQueryId(value: unknown) {
  return typeof value === "string" && value.trim() === value &&
    value.length > 0 && value.length <= 300 &&
    !/[\u0000-\u001f\u007f]/u.test(value);
}

/**
 * Validates the machine-readable retrieval account. Presentation notes are
 * deliberately ignored: release evidence must not depend on English prose.
 */
export function isScreen02RetrievalExecution(
  value: unknown,
): value is Screen02RetrievalExecution {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const execution = value as Record<string, unknown>;
  if (!hasExactScreen02Keys(execution, [
    "schemaVersion", "limits", "baseline", "qualificationRecovery",
    "aggregate", "documentAcquisitions", "outcomeValuesInspected",
  ]) ||
    execution.schemaVersion !== SCREEN_02_RETRIEVAL_EXECUTION_SCHEMA_VERSION ||
    execution.outcomeValuesInspected !== false ||
    !Array.isArray(execution.documentAcquisitions) ||
    execution.documentAcquisitions.length > 24 ||
    execution.documentAcquisitions.some((acquisition) =>
      !isScreen02DocumentAcquisition(acquisition)
    ) ||
    new Set(execution.documentAcquisitions.map((acquisition) =>
      (acquisition as Screen02DocumentAcquisition).acquisitionId
    )).size !== execution.documentAcquisitions.length ||
    !screen02DocumentAcquisitionsRespectBudgetsAndContinuity(
      execution.documentAcquisitions as Screen02DocumentAcquisition[],
    )) return false;

  const limits = execution.limits;
  if (!limits || typeof limits !== "object" || Array.isArray(limits) ||
    !hasExactScreen02Keys(limits as Record<string, unknown>, [
      "rawCandidateTarget", "rawCandidateMaximum",
      "qualifiedCandidateTarget", "minimumGeneralQueryVariants",
      "maximumGeneralQueryVariants", "maximumBaselineRounds",
      "maximumDocumentAcquisitions", "maximumDocumentRedirects",
      "documentRequestTimeoutMs", "documentRunTimeoutMs",
      "documentMaximumBytes", "documentTotalBytes", "documentConcurrency",
    ]) ||
    (limits as Record<string, unknown>).rawCandidateTarget !== 40 ||
    (limits as Record<string, unknown>).rawCandidateMaximum !== 60 ||
    (limits as Record<string, unknown>).qualifiedCandidateTarget !== 10 ||
    (limits as Record<string, unknown>).minimumGeneralQueryVariants !== 12 ||
    (limits as Record<string, unknown>).maximumGeneralQueryVariants !== 16 ||
    (limits as Record<string, unknown>).maximumBaselineRounds !== 2 ||
    (limits as Record<string, unknown>).maximumDocumentAcquisitions !== 24 ||
    (limits as Record<string, unknown>).maximumDocumentRedirects !== 3 ||
    (limits as Record<string, unknown>).documentRequestTimeoutMs !== 3_000 ||
    (limits as Record<string, unknown>).documentRunTimeoutMs !== 45_000 ||
    (limits as Record<string, unknown>).documentMaximumBytes !==
      2 * 1024 * 1024 ||
    (limits as Record<string, unknown>).documentTotalBytes !==
      6 * 1024 * 1024 ||
    (limits as Record<string, unknown>).documentConcurrency !== 2) {
    return false;
  }

  const baseline = execution.baseline;
  if (!baseline || typeof baseline !== "object" || Array.isArray(baseline)) {
    return false;
  }
  const baselineRecord = baseline as Record<string, unknown>;
  if (!hasExactScreen02Keys(baselineRecord, [
    "phase", "status", "queryIds", "stoppingReason",
    ...screen02RetrievalMetricKeys,
  ]) || baselineRecord.phase !== "baseline" ||
    !["completed", "failed", "unsupported", "invalid"].includes(
      String(baselineRecord.status),
    ) || !screen02RetrievalStoppingReasons.includes(
      baselineRecord.stoppingReason as Screen02RetrievalStoppingReason,
    ) || !Array.isArray(baselineRecord.queryIds) ||
    baselineRecord.queryIds.length !== baselineRecord.queriesAttempted ||
    new Set(baselineRecord.queryIds).size !== baselineRecord.queryIds.length ||
    baselineRecord.queryIds.some((id) => !isScreen02RetrievalQueryId(id)) ||
    !isScreen02RetrievalMetrics(baselineRecord) ||
    (baselineRecord.roundsExecuted as number) > 2) return false;

  const planned = baselineRecord.queriesPlanned as number;
  const attempted = baselineRecord.queriesAttempted as number;
  const succeeded = baselineRecord.queriesSucceeded as number;
  const failed = baselineRecord.queriesFailed as number;
  const rounds = baselineRecord.roundsExecuted as number;
  const records = baselineRecord.recordsReceived as number;
  const proposals = baselineRecord.proposalsGenerated as number;
  const unique = baselineRecord.uniqueProposalsGenerated as number;
  const stoppingReason = baselineRecord.stoppingReason;
  if (planned > 16 || attempted > 16) return false;
  const stopIsValid =
    (stoppingReason === "raw-max" &&
      baselineRecord.status === "completed" && unique >= 60 &&
      attempted > 0 && succeeded > 0) ||
    (stoppingReason === "raw-target" &&
      baselineRecord.status === "completed" && unique >= 40 && unique < 60 &&
      attempted > 0 && succeeded > 0) ||
    (stoppingReason === "query-budget" &&
      baselineRecord.status === "completed" && unique < 40 && planned === 16 &&
      attempted === planned && rounds === 2 && succeeded > 0) ||
    (stoppingReason === "routes-exhausted" &&
      baselineRecord.status === "completed" && unique < 40 &&
      attempted > 0 && attempted === planned && planned < 16 &&
      succeeded > 0) ||
    (stoppingReason === "source-failure" &&
      baselineRecord.status === "failed" && attempted > 0 &&
      attempted === planned && succeeded === 0 && failed === attempted &&
      records === 0 && proposals === 0 && unique === 0) ||
    (stoppingReason === "unsupported" &&
      baselineRecord.status === "unsupported" && planned === 0 &&
      attempted === 0 && succeeded === 0 && failed === 0 && rounds === 0 &&
      records === 0 && proposals === 0 && unique === 0 &&
      baselineRecord.queryIds.length === 0) ||
    (stoppingReason === "invalid" &&
      baselineRecord.status === "invalid" && planned === 0 && attempted === 0 &&
      succeeded === 0 && failed === 0 && rounds === 0 && records === 0 &&
      proposals === 0 && unique === 0 && baselineRecord.queryIds.length === 0);
  if (!stopIsValid) return false;

  const recovery = execution.qualificationRecovery;
  if (recovery !== null &&
    (!recovery || typeof recovery !== "object" || Array.isArray(recovery))) {
    return false;
  }
  if (recovery !== null) {
    const recoveryRecord = recovery as Record<string, unknown>;
    if (!hasExactScreen02Keys(recoveryRecord, [
      "phase", "status", "queryIds", "stoppingReason",
      ...screen02RetrievalMetricKeys,
    ]) || recoveryRecord.phase !== "qualification-recovery" ||
      !["completed", "failed"].includes(String(recoveryRecord.status)) ||
      !isScreen02RetrievalMetrics(recoveryRecord) ||
      recoveryRecord.queriesPlanned !== 1 ||
      recoveryRecord.queriesAttempted !== 1 ||
      recoveryRecord.roundsExecuted !== 1 ||
      !Array.isArray(recoveryRecord.queryIds) ||
      recoveryRecord.queryIds.length !== 1 ||
      !isScreen02RetrievalQueryId(recoveryRecord.queryIds[0]) ||
      (recoveryRecord.status === "completed"
        ? recoveryRecord.stoppingReason !==
            "qualification-recovery-completed" ||
          recoveryRecord.queriesSucceeded !== 1 ||
          recoveryRecord.queriesFailed !== 0
        : recoveryRecord.stoppingReason !== "qualification-recovery-failed" ||
          recoveryRecord.queriesSucceeded !== 0 ||
          recoveryRecord.queriesFailed !== 1 ||
          recoveryRecord.recordsReceived !== 0 ||
          recoveryRecord.proposalsGenerated !== 0 ||
          recoveryRecord.uniqueProposalsGenerated !== 0)) return false;
  }

  const aggregate = execution.aggregate;
  if (!aggregate || typeof aggregate !== "object" || Array.isArray(aggregate)) {
    return false;
  }
  const aggregateRecord = aggregate as Record<string, unknown>;
  if (!hasExactScreen02Keys(aggregateRecord, [
    ...screen02RetrievalMetricKeys, "terminal",
  ]) || aggregateRecord.terminal !== true ||
    !isScreen02RetrievalMetrics(aggregateRecord)) return false;
  const recoveryRecord = recovery as Record<string, number> | null;
  for (const key of screen02RetrievalMetricKeys) {
    if (key === "uniqueProposalsGenerated") continue;
    if (aggregateRecord[key] !==
      (baselineRecord[key] as number) + (recoveryRecord?.[key] ?? 0)) {
      return false;
    }
  }
  const aggregateUnique = aggregateRecord.uniqueProposalsGenerated as number;
  const baselineUnique = baselineRecord.uniqueProposalsGenerated as number;
  const recoveryUnique = recoveryRecord?.uniqueProposalsGenerated ?? 0;
  if (aggregateUnique < Math.max(baselineUnique, recoveryUnique) ||
    aggregateUnique > baselineUnique + recoveryUnique) return false;
  const allQueryIds = [
    ...(baselineRecord.queryIds as string[]),
    ...((recovery as Screen02RetrievalRecoveryExecution | null)?.queryIds ?? []),
  ];
  return new Set(allQueryIds).size === allQueryIds.length;
}

/**
 * Upgrade the unreleased v1 retrieval account without inventing execution.
 * Recovery status already recorded the phase outcome one-to-one; v2 makes
 * that terminal reason explicit and leaves every numeric counter unchanged.
 */
export function migrateScreen02RetrievalExecution(
  value: unknown,
): Screen02RetrievalExecution | null {
  if (isScreen02RetrievalExecution(value)) {
    return JSON.parse(JSON.stringify(value)) as Screen02RetrievalExecution;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const legacy = value as Record<string, unknown>;
  if (
    legacy.schemaVersion !==
      SCREEN_02_RETRIEVAL_EXECUTION_LEGACY_SCHEMA_VERSION
  ) return null;
  let migrated: Record<string, unknown>;
  try {
    migrated = JSON.parse(JSON.stringify(legacy)) as Record<string, unknown>;
  } catch {
    return null;
  }
  migrated.schemaVersion = SCREEN_02_RETRIEVAL_EXECUTION_SCHEMA_VERSION;
  const recovery = migrated.qualificationRecovery;
  if (recovery !== null) {
    if (!recovery || typeof recovery !== "object" || Array.isArray(recovery)) {
      return null;
    }
    const recoveryRecord = recovery as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(
      recoveryRecord,
      "stoppingReason",
    )) {
      if (recoveryRecord.status === "completed") {
        recoveryRecord.stoppingReason = "qualification-recovery-completed";
      } else if (recoveryRecord.status === "failed") {
        recoveryRecord.stoppingReason = "qualification-recovery-failed";
      } else {
        return null;
      }
    }
  }
  return isScreen02RetrievalExecution(migrated)
    ? migrated as unknown as Screen02RetrievalExecution
    : null;
}

export function isCompatibleScreen02RetrievalExecution(
  value: unknown,
): boolean {
  return migrateScreen02RetrievalExecution(value) !== null;
}

export function buildScreen02RetrievalExecution(input: {
  baseline: Screen02RetrievalBaselineExecution;
  qualificationRecovery?: Screen02RetrievalRecoveryExecution | null;
  aggregateUniqueProposalsGenerated?: number;
  documentAcquisitions?: Screen02DocumentAcquisition[];
}): Screen02RetrievalExecution {
  const qualificationRecovery = input.qualificationRecovery ?? null;
  const additiveMetric = (
    key: Exclude<
      (typeof screen02RetrievalMetricKeys)[number],
      "uniqueProposalsGenerated"
    >,
  ) => input.baseline[key] + (qualificationRecovery?.[key] ?? 0);
  const execution: Screen02RetrievalExecution = {
    schemaVersion: SCREEN_02_RETRIEVAL_EXECUTION_SCHEMA_VERSION,
    limits: {
      rawCandidateTarget: 40,
      rawCandidateMaximum: 60,
      qualifiedCandidateTarget: 10,
      minimumGeneralQueryVariants: 12,
      maximumGeneralQueryVariants: 16,
      maximumBaselineRounds: 2,
      maximumDocumentAcquisitions: 24,
      maximumDocumentRedirects: 3,
      documentRequestTimeoutMs: 3_000,
      documentRunTimeoutMs: 45_000,
      documentMaximumBytes: 2_097_152,
      documentTotalBytes: 6_291_456,
      documentConcurrency: 2,
    },
    baseline: JSON.parse(JSON.stringify(input.baseline)) as
      Screen02RetrievalBaselineExecution,
    qualificationRecovery: qualificationRecovery
      ? JSON.parse(JSON.stringify(qualificationRecovery)) as
        Screen02RetrievalRecoveryExecution
      : null,
    aggregate: {
      queriesPlanned: additiveMetric("queriesPlanned"),
      queriesAttempted: additiveMetric("queriesAttempted"),
      queriesSucceeded: additiveMetric("queriesSucceeded"),
      queriesFailed: additiveMetric("queriesFailed"),
      roundsExecuted: additiveMetric("roundsExecuted"),
      recordsReceived: additiveMetric("recordsReceived"),
      proposalsGenerated: additiveMetric("proposalsGenerated"),
      uniqueProposalsGenerated:
        input.aggregateUniqueProposalsGenerated ??
        input.baseline.uniqueProposalsGenerated +
          (qualificationRecovery?.uniqueProposalsGenerated ?? 0),
      terminal: true,
    },
    documentAcquisitions: JSON.parse(JSON.stringify(
      input.documentAcquisitions ?? [],
    )) as Screen02DocumentAcquisition[],
    outcomeValuesInspected: false,
  };
  if (!isScreen02RetrievalExecution(execution)) {
    throw new Error("Screen 2 retrieval execution is internally inconsistent.");
  }
  return execution;
}

/**
 * A secondary-source discovery lead that may help a researcher locate the
 * relevant announcement, implementation discussion, or enforcement context.
 * It is intentionally outside candidate/match evidence and cannot confirm a
 * shock, date, jurisdiction, or coverage fact.
 */
export type Screen02ContextLead = {
  id: string;
  title: string;
  locator: string;
  publisher: string;
  publishedDate: string | null;
  sourceRole: "contextual-secondary";
  status: "unverified";
  note: string;
};

export function isScreen02ContextLead(
  value: unknown,
): value is Screen02ContextLead {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const lead = value as Record<string, unknown>;
  const keys = [
    "id", "title", "locator", "publisher", "publishedDate",
    "sourceRole", "status", "note",
  ];
  const boundedText = (item: unknown, maximum: number) =>
    typeof item === "string" && item.length <= maximum &&
    item.trim() === item && item.length > 0 &&
    !/[\u0000-\u001f\u007f]/.test(item);
  let validLocator = false;
  if (boundedText(lead.locator, 2_048)) {
    try {
      const locator = new URL(lead.locator as string);
      validLocator = locator.protocol === "https:" &&
        !locator.username && !locator.password;
    } catch {
      validLocator = false;
    }
  }
  const publishedDate = lead.publishedDate;
  const validPublishedDate = publishedDate === null ||
    (typeof publishedDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(publishedDate) &&
      !Number.isNaN(Date.parse(`${publishedDate}T00:00:00.000Z`)) &&
      new Date(`${publishedDate}T00:00:00.000Z`).toISOString().slice(0, 10) ===
        publishedDate);
  return Object.keys(lead).length === keys.length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(lead, key)) &&
    boundedText(lead.id, 200) &&
    boundedText(lead.title, 500) &&
    validLocator &&
    boundedText(lead.publisher, 240) &&
    boundedText(lead.note, 1_000) &&
    validPublishedDate &&
    lead.sourceRole === "contextual-secondary" && lead.status === "unverified";
}

export const screen02RetainedResultQueryLanes = [
  "reviewed-registry",
  "reviewed-catalog",
  "official-baseline",
  "official-expansion",
  "qualification-recovery",
  "context-official-bridge",
  "host-official",
  "researcher-source",
  "researcher-url",
  "context-discovery",
  "substantive-enrichment",
] as const;

export type Screen02RetainedResultQueryLane =
  (typeof screen02RetainedResultQueryLanes)[number];

export type Screen02RetainedResultOrigin =
  | {
      kind: "query-result";
      retrievalLane: Screen02RetainedResultQueryLane;
      evidenceRole: "identity" | "support";
      producerRecordId: string;
      queryId: string;
      returnedRecordIds: string[];
      sourceIds: string[];
    }
  | {
      kind: "prior-result";
      retrievalLane: "host-review-carry-forward";
      evidenceRole: "identity";
      producerRecordId: string;
      priorCandidateSetSnapshotId: string;
      priorCandidateSnapshotId: string;
      sourceIds: string[];
    };

export type Screen02RetainedResultBinding = {
  schemaVersion: typeof SCREEN_02_RETAINED_RESULT_BINDING_SCHEMA_VERSION;
  mode: "find" | "audit";
  upstreamAccount: {
    sourceRecordsRetrieved: number;
    uniqueEventLeads: number;
  };
  results: Array<{
    recordId: string;
    snapshotId: string;
    sourceIds: string[];
    qualificationLane: Screen02QualificationLane | null;
    origins: Screen02RetainedResultOrigin[];
  }>;
};

function isScreen02RetainedResultId(value: unknown) {
  return typeof value === "string" && value.trim() === value &&
    value.length > 0 && value.length <= 200 &&
    !/[\u0000-\u001f\u007f]/u.test(value);
}

/** Strict, bounded binding between one manifest and its persisted result set. */
export function isScreen02RetainedResultBinding(
  value: unknown,
): value is Screen02RetainedResultBinding {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const binding = value as Record<string, unknown>;
  if (
    !hasExactScreen02Keys(binding, [
      "schemaVersion",
      "mode",
      "upstreamAccount",
      "results",
    ]) ||
    binding.schemaVersion !== SCREEN_02_RETAINED_RESULT_BINDING_SCHEMA_VERSION ||
    (binding.mode !== "find" && binding.mode !== "audit") ||
    !binding.upstreamAccount ||
    typeof binding.upstreamAccount !== "object" ||
    Array.isArray(binding.upstreamAccount) ||
    !hasExactScreen02Keys(
      binding.upstreamAccount as Record<string, unknown>,
      ["sourceRecordsRetrieved", "uniqueEventLeads"],
    ) ||
    !Number.isSafeInteger(
      (binding.upstreamAccount as Record<string, unknown>)
        .sourceRecordsRetrieved,
    ) ||
    Number(
        (binding.upstreamAccount as Record<string, unknown>)
          .sourceRecordsRetrieved,
      ) < 0 ||
    Number(
        (binding.upstreamAccount as Record<string, unknown>)
          .sourceRecordsRetrieved,
      ) > 10_000 ||
    !Number.isSafeInteger(
      (binding.upstreamAccount as Record<string, unknown>).uniqueEventLeads,
    ) ||
    Number(
        (binding.upstreamAccount as Record<string, unknown>).uniqueEventLeads,
      ) < 0 ||
    Number(
        (binding.upstreamAccount as Record<string, unknown>).uniqueEventLeads,
      ) > 10_000 ||
    !Array.isArray(binding.results) || binding.results.length > 12 ||
    binding.results.length > Number(
      (binding.upstreamAccount as Record<string, unknown>).uniqueEventLeads,
    )
  ) return false;
  const recordIds = new Set<string>();
  const snapshotIds = new Set<string>();
  for (const result of binding.results) {
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      return false;
    }
    const entry = result as Record<string, unknown>;
    if (
      !hasExactScreen02Keys(entry, [
        "recordId",
        "snapshotId",
        "sourceIds",
        "qualificationLane",
        "origins",
      ]) ||
      !isScreen02RetainedResultId(entry.recordId) ||
      !isScreen02RetainedResultId(entry.snapshotId) ||
      !Array.isArray(entry.sourceIds) || entry.sourceIds.length === 0 ||
      entry.sourceIds.length > 50 ||
      entry.sourceIds.some((sourceId) =>
        !isScreen02RetainedResultId(sourceId)
      ) ||
      new Set(entry.sourceIds as string[]).size !== entry.sourceIds.length ||
      (entry.qualificationLane !== null &&
        !screen02QualificationLanes.includes(
          entry.qualificationLane as Screen02QualificationLane,
        )) ||
      !Array.isArray(entry.origins) || entry.origins.length === 0 ||
      entry.origins.length > 30 ||
      recordIds.has(entry.recordId as string) ||
      snapshotIds.has(entry.snapshotId as string)
    ) return false;
    const originKeys = new Set<string>();
    let hasIdentityOrigin = false;
    for (const origin of entry.origins) {
      if (!origin || typeof origin !== "object" || Array.isArray(origin)) {
        return false;
      }
      const item = origin as Record<string, unknown>;
      if (item.kind === "query-result") {
        if (
          !hasExactScreen02Keys(item, [
            "kind",
            "retrievalLane",
            "evidenceRole",
            "producerRecordId",
            "queryId",
            "returnedRecordIds",
            "sourceIds",
          ]) ||
          !screen02RetainedResultQueryLanes.includes(
            item.retrievalLane as Screen02RetainedResultQueryLane,
          ) ||
          (item.evidenceRole !== "identity" &&
            item.evidenceRole !== "support") ||
          !isScreen02RetainedResultId(item.producerRecordId) ||
          !isScreen02RetainedResultId(item.queryId) ||
          !Array.isArray(item.returnedRecordIds) ||
          item.returnedRecordIds.length === 0 ||
          item.returnedRecordIds.length > 100 ||
          item.returnedRecordIds.some(
            (recordId) => !isScreen02RetainedResultId(recordId),
          ) ||
          new Set(item.returnedRecordIds as string[]).size !==
            item.returnedRecordIds.length ||
          !Array.isArray(item.sourceIds) || item.sourceIds.length === 0 ||
          item.sourceIds.length > 50 ||
          item.sourceIds.some(
            (sourceId) => !isScreen02RetainedResultId(sourceId),
          ) ||
          new Set(item.sourceIds as string[]).size !== item.sourceIds.length ||
          ((["context-discovery", "substantive-enrichment"] as const).includes(
            item.retrievalLane as "context-discovery" | "substantive-enrichment",
          ) &&
            item.evidenceRole !== "support")
        ) return false;
      } else if (item.kind === "prior-result") {
        if (
          !hasExactScreen02Keys(item, [
            "kind",
            "retrievalLane",
            "evidenceRole",
            "producerRecordId",
            "priorCandidateSetSnapshotId",
            "priorCandidateSnapshotId",
            "sourceIds",
          ]) ||
          item.retrievalLane !== "host-review-carry-forward" ||
          item.evidenceRole !== "identity" ||
          !isScreen02RetainedResultId(item.producerRecordId) ||
          !isScreen02RetainedResultId(item.priorCandidateSetSnapshotId) ||
          !isScreen02RetainedResultId(item.priorCandidateSnapshotId) ||
          !Array.isArray(item.sourceIds) || item.sourceIds.length === 0 ||
          item.sourceIds.length > 50 ||
          item.sourceIds.some(
            (sourceId) => !isScreen02RetainedResultId(sourceId),
          ) ||
          new Set(item.sourceIds as string[]).size !== item.sourceIds.length
        ) return false;
      } else {
        return false;
      }
      if (item.evidenceRole === "identity") hasIdentityOrigin = true;
      const originKey = serializeDeterministicJson(item);
      if (originKeys.has(originKey)) return false;
      originKeys.add(originKey);
    }
    if (!hasIdentityOrigin) return false;
    recordIds.add(entry.recordId as string);
    snapshotIds.add(entry.snapshotId as string);
  }
  return true;
}

export function buildScreen02RetainedResultBinding(
  mode: Screen02RetainedResultBinding["mode"],
  upstreamAccount: Screen02RetainedResultBinding["upstreamAccount"],
  results: Screen02RetainedResultBinding["results"],
): Screen02RetainedResultBinding {
  const binding: Screen02RetainedResultBinding = {
    schemaVersion: SCREEN_02_RETAINED_RESULT_BINDING_SCHEMA_VERSION,
    mode,
    upstreamAccount: JSON.parse(JSON.stringify(upstreamAccount)) as
      Screen02RetainedResultBinding["upstreamAccount"],
    results: JSON.parse(JSON.stringify(results)) as
      Screen02RetainedResultBinding["results"],
  };
  if (!isScreen02RetainedResultBinding(binding)) {
    throw new Error("Screen 2 retained-result binding is invalid.");
  }
  return binding;
}

type Screen02WorkflowSearchManifestCommon = {
  exactRequest: string;
  queryMatrix: Screen02SearchQueryRecord[];
  channels: Screen02SearchChannelRecord[];
  exclusions: Screen02SearchExclusion[];
  /**
   * Present only on the single fixed retrieval committed after a validated
   * generic host review. The manifest binding lets a reopened panel prove that
   * it incorporated the exact task result instead of acknowledging a stale
   * or unchanged candidate pool.
   */
  hostReviewApplication?: Screen02HostReviewApplication;
  /** Present only when the guarded contextual lane is enabled and finds leads. */
  contextLeads?: Screen02ContextLead[];
  /**
   * Typed provenance for the single bounded transition from a contextual
   * title identifier to independently returned official records.
   */
  contextBridges?: Screen02ContextOfficialBridgeProvenance[];
  /**
   * The retrieval producer binds retained snapshots to its raw query records
   * before the fixed apply boundary. Apply validates and preserves this value;
   * it must never manufacture upstream provenance from caller-supplied output.
   * Current persisted manifests require it; legacy v3 manifests omit it.
   */
  retainedResultBinding?: Screen02RetainedResultBinding;
  stoppingRule: {
    rule: string;
    status: "not-started" | "met" | "not-met";
    note: string;
  };
  retrievedAt: string;
  outcomeValuesInspected: false;
};

export type Screen02WorkflowSearchManifest =
  Screen02WorkflowSearchManifestCommon & (
    | {
        protocolVersion: typeof SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_VERSION;
        /** Current evidence must carry its exact machine-readable execution. */
        retrievalExecution: Screen02RetrievalExecution;
        /** Current evidence must explain every qualification funnel stage. */
        funnel: Screen02SearchFunnel;
      }
    | {
        protocolVersion:
          typeof SCREEN_02_WORKFLOW_SEARCH_PROTOCOL_LEGACY_VERSION;
        /** Restoration never invents execution history for protocol v3. */
        retrievalExecution?: never;
        /** Older saved runs may predate the complete funnel account. */
        funnel?: Screen02SearchFunnel;
      }
  );

export const SCREEN_02_HOST_REVIEW_APPLICATION_SCHEMA_VERSION =
  "screen-02-host-review-application-v1" as const;

export type Screen02HostReviewQueryExecution = {
  submittedTerms: string[];
  plannedTerms: string[];
  executedTerms: string[];
  skipped: Array<{
    term: string;
    reason: "duplicate" | "query-cap" | "not-executable" | "stopping-rule";
  }>;
};

export type Screen02HostReviewOfficialSourceLeadAudit = {
  leadId: string;
  leadFingerprint: string;
  contentFingerprint: string | null;
  verificationStatus: "verified" | "rejected";
  resultingSourceId: string | null;
  resultingSourceFingerprint: string | null;
  resultingSourceStatus: "persisted" | "not-retained" | "rejected";
};

export type Screen02HostReviewRankingAdjustment = {
  candidateId: string;
  adjustment: number;
};

export type Screen02HostReviewApplication = {
  schemaVersion: typeof SCREEN_02_HOST_REVIEW_APPLICATION_SCHEMA_VERSION;
  taskId: string;
  resultId: string;
  resultOrigin: "chatgpt-host";
  taskInputFingerprint: string;
  submissionFingerprint: string;
  originalCandidatePoolId: string;
  originalCandidatePoolFingerprint: string;
  successorCandidatePoolId: string;
  priorProfileFingerprint: string;
  profileAdditions: Screen02StudyRelevanceProfileHostAdditions;
  profileAdditionsFingerprint: string;
  profileAdditionCount: number;
  appliedProfileFingerprint: string;
  candidateReviewsFingerprint: string;
  candidateReviewCount: number;
  followUpQueriesFingerprint: string;
  appliedAt: string;
  followUpQueryCount: number;
  hostQueryExecution: Screen02HostReviewQueryExecution;
  hostQueryExecutionFingerprint: string;
  proposedOfficialSourceLeadCount: number;
  verifiedOfficialSourceLeadCount: number;
  officialSourceLeadsFingerprint: string;
  officialSourceLeadAudit: Screen02HostReviewOfficialSourceLeadAudit[];
  officialSourceLeadAuditFingerprint: string;
  rankingAdjustmentCount: number;
  rankingAdjustments: Screen02HostReviewRankingAdjustment[];
  rankingAdjustmentsFingerprint: string;
  validatedRetrievalContributionCount: number;
  /** Fingerprint of this receipt with only applicationFingerprint omitted. */
  applicationFingerprint: string;
  outcomeValuesInspected: false;
};

function fingerprintScreen02HostReviewValue(value: unknown) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of new TextEncoder().encode(serializeDeterministicJson(value))) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

export function isScreen02HostReviewApplication(
  value: unknown,
): value is Screen02HostReviewApplication {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const application = value as Record<string, unknown>;
  const keys = [
    "schemaVersion",
    "taskId",
    "resultId",
    "resultOrigin",
    "taskInputFingerprint",
    "submissionFingerprint",
    "originalCandidatePoolId",
    "originalCandidatePoolFingerprint",
    "successorCandidatePoolId",
    "priorProfileFingerprint",
    "profileAdditions",
    "profileAdditionsFingerprint",
    "profileAdditionCount",
    "appliedProfileFingerprint",
    "candidateReviewsFingerprint",
    "candidateReviewCount",
    "followUpQueriesFingerprint",
    "appliedAt",
    "followUpQueryCount",
    "hostQueryExecution",
    "hostQueryExecutionFingerprint",
    "proposedOfficialSourceLeadCount",
    "verifiedOfficialSourceLeadCount",
    "officialSourceLeadsFingerprint",
    "officialSourceLeadAudit",
    "officialSourceLeadAuditFingerprint",
    "rankingAdjustmentCount",
    "rankingAdjustments",
    "rankingAdjustmentsFingerprint",
    "validatedRetrievalContributionCount",
    "applicationFingerprint",
    "outcomeValuesInspected",
  ].sort();
  const actual = Object.keys(application).sort();
  const text = (item: unknown, maximum = 200) =>
    typeof item === "string" && item.length > 0 && item.length <= maximum &&
    item.trim() === item && !/[\u0000-\u001f\u007f]/u.test(item);
  const count = (item: unknown, maximum: number) =>
    Number.isSafeInteger(item) && (item as number) >= 0 &&
    (item as number) <= maximum;
  const fingerprint = (item: unknown) =>
    typeof item === "string" &&
    /^(?:fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})$/u.test(item);
  const exactKeys = (item: Record<string, unknown>, expected: string[]) => {
    const itemKeys = Object.keys(item).sort();
    const expectedKeys = [...expected].sort();
    return itemKeys.length === expectedKeys.length &&
      itemKeys.every((key, index) => key === expectedKeys[index]);
  };
  const textList = (item: unknown, maximum: number) =>
    Array.isArray(item) && item.length <= maximum &&
    new Set(item).size === item.length &&
    item.every((entry) => text(entry, 200));

  const profileAdditionKeys = [
    "industryAliases", "internationalVariants", "subsectors", "products",
    "services", "industryActors", "regulatedActivities",
    "platformRelationships", "contrastTerms", "falseFriends",
    "jurisdictionAliases",
  ];
  const profileAdditions = application.profileAdditions;
  const validProfileAdditions = Boolean(
    profileAdditions && typeof profileAdditions === "object" &&
      !Array.isArray(profileAdditions) &&
      Object.keys(profileAdditions).every((key) =>
        profileAdditionKeys.includes(key) &&
        textList((profileAdditions as Record<string, unknown>)[key], 12)
      ),
  );
  const profileAdditionCount = validProfileAdditions
    ? Object.values(profileAdditions as Record<string, unknown>)
      .reduce<number>(
        (total, additions) => total + (additions as unknown[]).length,
        0,
      )
    : -1;

  const hostQuery = application.hostQueryExecution;
  const validHostQueryShape = Boolean(
    hostQuery && typeof hostQuery === "object" && !Array.isArray(hostQuery) &&
      exactKeys(hostQuery as Record<string, unknown>, [
        "submittedTerms", "plannedTerms", "executedTerms", "skipped",
      ]) &&
      textList((hostQuery as Record<string, unknown>).submittedTerms, 6) &&
      textList((hostQuery as Record<string, unknown>).plannedTerms, 4) &&
      textList((hostQuery as Record<string, unknown>).executedTerms, 4) &&
      Array.isArray((hostQuery as Record<string, unknown>).skipped) &&
      ((hostQuery as Record<string, unknown>).skipped as unknown[]).length <= 6 &&
      ((hostQuery as Record<string, unknown>).skipped as unknown[]).every(
        (entry) =>
          Boolean(entry && typeof entry === "object" && !Array.isArray(entry) &&
            exactKeys(entry as Record<string, unknown>, ["term", "reason"]) &&
            text((entry as Record<string, unknown>).term, 200) &&
            ["duplicate", "query-cap", "not-executable", "stopping-rule"]
              .includes(String((entry as Record<string, unknown>).reason))),
      ),
  );
  const querySubmitted = validHostQueryShape
    ? (hostQuery as Screen02HostReviewQueryExecution).submittedTerms
    : [];
  const queryPlanned = validHostQueryShape
    ? (hostQuery as Screen02HostReviewQueryExecution).plannedTerms
    : [];
  const queryExecuted = validHostQueryShape
    ? (hostQuery as Screen02HostReviewQueryExecution).executedTerms
    : [];
  const querySkipped = validHostQueryShape
    ? (hostQuery as Screen02HostReviewQueryExecution).skipped
    : [];
  const skippedTerms = querySkipped.map((entry) => entry.term);
  const plannedDispositionTerms = [
    ...queryExecuted,
    ...querySkipped.filter((entry) => entry.reason === "stopping-rule")
      .map((entry) => entry.term),
  ];
  const validHostQueryRelations = validHostQueryShape &&
    new Set(skippedTerms).size === skippedTerms.length &&
    [...queryExecuted, ...skippedTerms].length === querySubmitted.length &&
    [...queryExecuted, ...skippedTerms].every((term) =>
      querySubmitted.includes(term)
    ) &&
    querySubmitted.every((term) =>
      queryExecuted.includes(term) !== skippedTerms.includes(term)
    ) &&
    queryPlanned.length === plannedDispositionTerms.length &&
    queryPlanned.every((term) => plannedDispositionTerms.includes(term)) &&
    plannedDispositionTerms.every((term) => queryPlanned.includes(term));

  const officialSourceLeadAudit = application.officialSourceLeadAudit;
  const validOfficialSourceLeadAudit = Array.isArray(officialSourceLeadAudit) &&
    officialSourceLeadAudit.length <= 8 &&
    new Set(officialSourceLeadAudit.map((entry) =>
      entry && typeof entry === "object" && !Array.isArray(entry)
        ? (entry as Record<string, unknown>).leadId
        : null)).size === officialSourceLeadAudit.length &&
    officialSourceLeadAudit.every((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry) ||
          !exactKeys(entry as Record<string, unknown>, [
            "leadId", "leadFingerprint", "contentFingerprint",
            "verificationStatus", "resultingSourceId",
            "resultingSourceFingerprint", "resultingSourceStatus",
          ])) return false;
      const audit = entry as Record<string, unknown>;
      const verified = audit.verificationStatus === "verified";
      const persisted = audit.resultingSourceStatus === "persisted";
      const notRetained = audit.resultingSourceStatus === "not-retained";
      const rejected = audit.resultingSourceStatus === "rejected";
      return text(audit.leadId, 200) && fingerprint(audit.leadFingerprint) &&
        (audit.contentFingerprint === null ||
          fingerprint(audit.contentFingerprint)) &&
        ["verified", "rejected"].includes(String(audit.verificationStatus)) &&
        (audit.resultingSourceId === null || text(audit.resultingSourceId, 500)) &&
        (audit.resultingSourceFingerprint === null ||
          fingerprint(audit.resultingSourceFingerprint)) &&
        ["persisted", "not-retained", "rejected"].includes(
          String(audit.resultingSourceStatus),
        ) &&
        (verified
          ? audit.contentFingerprint !== null &&
            audit.resultingSourceId !== null && !rejected &&
            (persisted
              ? audit.resultingSourceFingerprint !== null
              : notRetained && audit.resultingSourceFingerprint === null)
          : rejected && audit.resultingSourceId === null &&
            audit.resultingSourceFingerprint === null);
    });
  const verifiedOfficialSourceLeadCount = validOfficialSourceLeadAudit
    ? officialSourceLeadAudit.filter((entry) =>
      entry.verificationStatus === "verified").length
    : -1;

  const rankingAdjustments = application.rankingAdjustments;
  const validRankingAdjustments = Array.isArray(rankingAdjustments) &&
    rankingAdjustments.length <= 20 &&
    new Set(rankingAdjustments.map((entry) =>
      entry && typeof entry === "object" && !Array.isArray(entry)
        ? (entry as Record<string, unknown>).candidateId
        : null)).size === rankingAdjustments.length &&
    rankingAdjustments.every((entry) =>
      Boolean(entry && typeof entry === "object" && !Array.isArray(entry) &&
        exactKeys(entry as Record<string, unknown>, [
          "candidateId", "adjustment",
        ]) &&
        text((entry as Record<string, unknown>).candidateId, 200) &&
        Number.isInteger((entry as Record<string, unknown>).adjustment) &&
        Math.abs((entry as Record<string, unknown>).adjustment as number) >= 1 &&
        Math.abs((entry as Record<string, unknown>).adjustment as number) <= 3),
    );
  let validRelationalFingerprints = false;
  try {
    const { applicationFingerprint: _applicationFingerprint, ...receipt } =
      application;
    validRelationalFingerprints =
      application.profileAdditionsFingerprint ===
        fingerprintScreen02HostReviewValue(profileAdditions) &&
      application.followUpQueriesFingerprint ===
        fingerprintScreen02HostReviewValue(querySubmitted) &&
      application.hostQueryExecutionFingerprint ===
        fingerprintScreen02HostReviewValue(hostQuery) &&
      application.officialSourceLeadAuditFingerprint ===
        fingerprintScreen02HostReviewValue(officialSourceLeadAudit) &&
      application.rankingAdjustmentsFingerprint ===
        fingerprintScreen02HostReviewValue(rankingAdjustments) &&
      application.applicationFingerprint ===
        fingerprintScreen02HostReviewValue(receipt);
  } catch {
    validRelationalFingerprints = false;
  }
  return actual.length === keys.length &&
    actual.every((key, index) => key === keys[index]) &&
    application.schemaVersion ===
      SCREEN_02_HOST_REVIEW_APPLICATION_SCHEMA_VERSION &&
    text(application.taskId) && text(application.resultId) &&
    application.resultOrigin === "chatgpt-host" &&
    fingerprint(application.taskInputFingerprint) &&
    fingerprint(application.submissionFingerprint) &&
    text(application.originalCandidatePoolId) &&
    fingerprint(application.originalCandidatePoolFingerprint) &&
    text(application.successorCandidatePoolId) &&
    fingerprint(application.priorProfileFingerprint) &&
    validProfileAdditions &&
    fingerprint(application.profileAdditionsFingerprint) &&
    count(application.profileAdditionCount, 132) &&
    application.profileAdditionCount === profileAdditionCount &&
    fingerprint(application.appliedProfileFingerprint) &&
    fingerprint(application.candidateReviewsFingerprint) &&
    count(application.candidateReviewCount, 20) &&
    fingerprint(application.followUpQueriesFingerprint) &&
    typeof application.appliedAt === "string" &&
    Number.isFinite(Date.parse(application.appliedAt)) &&
    new Date(Date.parse(application.appliedAt)).toISOString() ===
      application.appliedAt &&
    count(application.followUpQueryCount, 6) &&
    validHostQueryRelations &&
    (application.followUpQueryCount as number) >= querySubmitted.length &&
    fingerprint(application.hostQueryExecutionFingerprint) &&
    count(application.proposedOfficialSourceLeadCount, 8) &&
    count(application.verifiedOfficialSourceLeadCount, 8) &&
    (application.verifiedOfficialSourceLeadCount as number) <=
      (application.proposedOfficialSourceLeadCount as number) &&
    validOfficialSourceLeadAudit &&
    application.proposedOfficialSourceLeadCount ===
      officialSourceLeadAudit.length &&
    application.verifiedOfficialSourceLeadCount ===
      verifiedOfficialSourceLeadCount &&
    fingerprint(application.officialSourceLeadsFingerprint) &&
    fingerprint(application.officialSourceLeadAuditFingerprint) &&
    count(application.rankingAdjustmentCount, 20) &&
    validRankingAdjustments &&
    application.rankingAdjustmentCount === rankingAdjustments.length &&
    fingerprint(application.rankingAdjustmentsFingerprint) &&
    count(application.validatedRetrievalContributionCount, 12) &&
    application.validatedRetrievalContributionCount ===
      queryExecuted.length + verifiedOfficialSourceLeadCount &&
    fingerprint(application.applicationFingerprint) &&
    validRelationalFingerprints &&
    application.outcomeValuesInspected === false;
}

export type Screen02SearchFunnel = {
  schemaVersion: typeof SCREEN_02_SEARCH_FUNNEL_SCHEMA_VERSION;
  sourceRecordsRetrieved: number;
  uniqueEventLeads: number;
  evaluatedUniqueLeads: number;
  duplicatesRemoved: number;
  hardScopePassed: number;
  hardScopeDemonstratedMismatch: number;
  hardScopeInsufficientEvidence: number;
  hardScopeMixed: number;
  sourceQualityPassed: number;
  substantiveInformationPassed: number;
  relevancePassed: number;
  exposureFeasibilityPassed: number;
  qualifiedCandidates: number;
  displayedCandidates: number;
  directCandidates: number;
  adjacentCandidates: number;
  broadCandidates: number;
  mismatchCandidates: number;
  deeperRetrievalAttempts: number;
  retrievalFailures: number;
  hostContribution: number;
};

/** Strict structural reader shared by state restoration and Screen 2→3 handoff. */
export function isScreen02SearchFunnel(
  value: unknown,
): value is Screen02SearchFunnel {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const funnel = value as Record<string, unknown>;
  const countKeys = [
    "sourceRecordsRetrieved",
    "uniqueEventLeads",
    "evaluatedUniqueLeads",
    "duplicatesRemoved",
    "hardScopePassed",
    "hardScopeDemonstratedMismatch",
    "hardScopeInsufficientEvidence",
    "hardScopeMixed",
    "sourceQualityPassed",
    "substantiveInformationPassed",
    "relevancePassed",
    "exposureFeasibilityPassed",
    "qualifiedCandidates",
    "displayedCandidates",
    "directCandidates",
    "adjacentCandidates",
    "broadCandidates",
    "mismatchCandidates",
    "deeperRetrievalAttempts",
    "retrievalFailures",
    "hostContribution",
  ] as const;
  const expectedKeys = ["schemaVersion", ...countKeys].sort();
  const actualKeys = Object.keys(funnel).sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index]) ||
    funnel.schemaVersion !== SCREEN_02_SEARCH_FUNNEL_SCHEMA_VERSION ||
    countKeys.some(
      (key) =>
        !Number.isSafeInteger(funnel[key]) || (funnel[key] as number) < 0,
    )
  ) {
    return false;
  }
  const count = (key: (typeof countKeys)[number]) => funnel[key] as number;
  const stages = [
    count("evaluatedUniqueLeads"),
    count("sourceQualityPassed"),
    count("substantiveInformationPassed"),
    count("relevancePassed"),
    count("exposureFeasibilityPassed"),
    count("qualifiedCandidates"),
    count("displayedCandidates"),
  ];
  return (
    count("evaluatedUniqueLeads") <= count("uniqueEventLeads") &&
    count("duplicatesRemoved") ===
      Math.max(
        0,
        count("sourceRecordsRetrieved") - count("uniqueEventLeads"),
      ) &&
    stages.every((stage, index) => index === 0 || stage <= stages[index - 1]!) &&
    count("hardScopePassed") + count("hardScopeDemonstratedMismatch") +
        count("hardScopeInsufficientEvidence") + count("hardScopeMixed") ===
      count("evaluatedUniqueLeads") &&
    count("directCandidates") + count("adjacentCandidates") +
        count("broadCandidates") + count("mismatchCandidates") ===
      count("evaluatedUniqueLeads")
  );
}

/**
 * Relates the presentation funnel to the immutable v4 execution account.
 * Supplemental lanes may add records and leads, but they cannot erase the
 * official execution totals, and every persisted document attempt is counted
 * exactly once by the deeper-retrieval stage.
 */
export function screen02SearchFunnelMatchesRetrievalExecution(
  funnel: unknown,
  execution: unknown,
) {
  if (
    !isScreen02SearchFunnel(funnel) ||
    !isScreen02RetrievalExecution(execution)
  ) return false;
  return funnel.sourceRecordsRetrieved >= execution.aggregate.recordsReceived &&
    funnel.uniqueEventLeads >=
      execution.aggregate.uniqueProposalsGenerated &&
    funnel.deeperRetrievalAttempts === execution.documentAcquisitions.length;
}

type Screen02LegacyFunnelDispositionCounts = {
  demonstratedMismatch: number;
  insufficientEvidence: number;
  mixed: number;
};

/**
 * Upgrades a persisted v1 funnel without pretending that the old aggregate
 * distinguished source gaps from demonstrated conflicts. Callers may provide
 * counts recovered from the accompanying immutable qualification traces; any
 * remaining non-passing leads are conservatively recorded as insufficient
 * evidence. A missing failure counter means no failure was recorded, not that
 * a new retrieval was attempted during restoration.
 */
export function migrateScreen02SearchFunnel(
  value: unknown,
  recovered: Partial<Screen02LegacyFunnelDispositionCounts> = {},
): Screen02SearchFunnel | null {
  if (isScreen02SearchFunnel(value)) {
    return JSON.parse(JSON.stringify(value)) as Screen02SearchFunnel;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const funnel = value as Record<string, unknown>;
  const legacyCountKeys = [
    "sourceRecordsRetrieved",
    "uniqueEventLeads",
    "evaluatedUniqueLeads",
    "duplicatesRemoved",
    "hardScopePassed",
    "sourceQualityPassed",
    "substantiveInformationPassed",
    "relevancePassed",
    "exposureFeasibilityPassed",
    "qualifiedCandidates",
    "displayedCandidates",
    "directCandidates",
    "adjacentCandidates",
    "broadCandidates",
    "mismatchCandidates",
    "deeperRetrievalAttempts",
    "hostContribution",
  ] as const;
  const expectedKeys = ["schemaVersion", ...legacyCountKeys].sort();
  const actualKeys = Object.keys(funnel).sort();
  if (
    funnel.schemaVersion !== SCREEN_02_SEARCH_FUNNEL_LEGACY_SCHEMA_VERSION ||
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index]) ||
    legacyCountKeys.some((key) =>
      !Number.isSafeInteger(funnel[key]) || (funnel[key] as number) < 0
    )
  ) {
    return null;
  }
  const nonPassing = (funnel.evaluatedUniqueLeads as number) -
    (funnel.hardScopePassed as number);
  const demonstratedMismatch = recovered.demonstratedMismatch ?? 0;
  const mixed = recovered.mixed ?? 0;
  const explicitlyInsufficient = recovered.insufficientEvidence ?? 0;
  if (
    nonPassing < 0 ||
    [demonstratedMismatch, mixed, explicitlyInsufficient].some(
      (count) => !Number.isSafeInteger(count) || count < 0,
    ) ||
    demonstratedMismatch + mixed + explicitlyInsufficient > nonPassing
  ) {
    return null;
  }
  const migrated = {
    ...JSON.parse(JSON.stringify(funnel)) as Record<string, unknown>,
    schemaVersion: SCREEN_02_SEARCH_FUNNEL_SCHEMA_VERSION,
    hardScopeDemonstratedMismatch: demonstratedMismatch,
    hardScopeInsufficientEvidence:
      explicitlyInsufficient +
      nonPassing - demonstratedMismatch - mixed - explicitlyInsufficient,
    hardScopeMixed: mixed,
    retrievalFailures: 0,
  };
  return isScreen02SearchFunnel(migrated) ? migrated : null;
}

export function isCompatibleScreen02SearchFunnel(value: unknown) {
  return migrateScreen02SearchFunnel(value) !== null;
}

export const screen02AssessmentLifecycleStatuses = [
  "prepared",
  "message-delivered",
  "draft-received",
  "validating",
  "partial",
  "completed",
  "delivery-rejected",
  "service-unavailable",
  "no-tool-submission",
  "validation-failed",
  "timed-out",
  "superseded",
  "retry-exhausted",
] as const;

export type Screen02AssessmentLifecycleStatus =
  (typeof screen02AssessmentLifecycleStatuses)[number];

export const screen02AssessmentRequestModes = [
  "find-discovery-plan",
  "find-candidate",
  "find-criterion",
  "audit-dossier",
  "audit-confirmed-event",
] as const;

export type Screen02AssessmentRequestMode =
  (typeof screen02AssessmentRequestModes)[number];

export type Screen02AssessmentLifecycleEvent = {
  status: Screen02AssessmentLifecycleStatus;
  at: string;
  actor: "fixed-core" | "chatgpt-host" | "researcher";
  note: string | null;
};

/**
 * Exact canonical lifecycle notes used to preserve assessment authorship
 * across the Screen 2 to Screen 3 handoff. These are data-contract values, not
 * presentation copy. Existing values must remain readable by later releases.
 */
export const SCREEN_02_CHATGPT_HOST_COMPLETION_LIFECYCLE_NOTE =
  "The ChatGPT host accepted this bounded assessment request; only its authenticated model-tool receipt can complete the request." as const;
export const SCREEN_02_WORKERS_AI_COMPLETION_LIFECYCLE_NOTE =
  "The server-side Workers AI preliminary draft was produced; fixed code will validate every requested part before it becomes canonical." as const;
export const SCREEN_02_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE =
  "Workers AI did not produce a usable preliminary draft; the server selected a conservative fixed fallback, which fixed code will validate before it becomes canonical." as const;
export const SCREEN_02_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE =
  "ChatGPT dossier delivery was unavailable; fixed code completed an identity-only source-derived fixed fallback dossier with explicit evidence gaps before researcher review." as const;
export const SCREEN_02_AUDIT_ASSESSMENT_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE =
  "ChatGPT confirmed-event assessment delivery was unavailable; fixed code completed a conservative source-derived fixed fallback assessment with unclear categories and explicit evidence limits before researcher continuation." as const;
export const SCREEN_02_FIND_SOURCE_DERIVED_FIXED_FALLBACK_COMPLETION_LIFECYCLE_NOTE =
  "ChatGPT candidate review was unavailable; fixed code completed a conservative source-derived candidate assessment with explicit evidence limits before researcher choice." as const;

export type Screen02AssessmentFailure = {
  partId: string;
  codes: string[];
};

export type Screen02FindCandidateAssessmentTarget = {
  mode: "find-candidate";
  packetFingerprint: string;
  candidateSnapshotId: string;
  candidateFingerprint: string;
};

export type Screen02FindDiscoveryPlanAssessmentTarget = {
  mode: "find-discovery-plan";
  packetFingerprint: string;
  searchOrdinal: number;
  criteriaFingerprint: string;
};

export type Screen02FindCriterionAssessmentTarget = {
  mode: "find-criterion";
  packetFingerprint: string;
  candidateSnapshotId: string;
  candidateFingerprint: string;
  criterionId: string;
  criterionVersion: number;
};

export type Screen02AuditDossierAssessmentTarget = {
  mode: "audit-dossier";
  packetFingerprint: string;
  anchorRevisionId: string;
  anchorRevisionFingerprint: string;
  matchSetSnapshotId: string;
  matchSetFingerprint: string;
  matchSnapshotId: string;
  identitySnapshotId: string;
  matchFingerprint: string;
};

export type Screen02AuditConfirmedAssessmentTarget = {
  mode: "audit-confirmed-event";
  packetFingerprint: string;
  anchorRevisionId: string;
  anchorRevisionFingerprint: string;
  matchSetSnapshotId: string;
  matchSetFingerprint: string;
  matchSnapshotId: string;
  identitySnapshotId: string;
  matchFingerprint: string;
  dossierSnapshotId: string;
  dossierFingerprint: string;
  confirmationSnapshotId: string;
  confirmationFingerprint: string;
};

export type Screen02AssessmentTarget =
  | Screen02FindDiscoveryPlanAssessmentTarget
  | Screen02FindCandidateAssessmentTarget
  | Screen02FindCriterionAssessmentTarget
  | Screen02AuditDossierAssessmentTarget
  | Screen02AuditConfirmedAssessmentTarget;

export type Screen02AssessmentRequest = {
  jobId: string;
  requestId: string;
  rootRequestId: string;
  retryOfRequestId: string | null;
  target: Screen02AssessmentTarget;
  attempt: 1 | 2 | 3;
  requestedPartIds: string[];
  status: Screen02AssessmentLifecycleStatus;
  preparedAt: string;
  updatedAt: string;
  acceptedPartIds: string[];
  failures: Screen02AssessmentFailure[];
  receiptIds: string[];
  supersededByRequestId: string | null;
  supersededBySnapshotId: string | null;
  lifecycle: Screen02AssessmentLifecycleEvent[];
};

export const screen02AssessmentUnavailableScreen03Checks = [
  "Verify study fit against the confirmed Screen 1 scope.",
  "Verify the outcome pathway without inspecting realized outcome values.",
  "Verify the event version, timing, and source-backed factual record.",
  "Verify the covered population, geography, and organization-level exposure boundary.",
  "Verify measurement feasibility and the availability of pre-event exposure indicators.",
  "Document the main validity concern and every unresolved source gap.",
] as const;

export type Screen02AssessmentUnavailableDisposition = {
  status: "unavailable";
  reason: string;
  affectedRequestIds: string[];
  recordedAt: string;
  researcherAcknowledgment: string;
  mandatoryScreen03Checks: string[];
};

export const screen02FindAssessmentPartIds = [
  "studyFit",
  "outcomePathway",
  "measurementPotential",
  "mainConcern",
  "nextChecks",
] as const;

export const screen02FindDiscoveryPlanPartIds = [
  "queryTerms",
  "rationale",
] as const;

export const screen02AuditAssessmentPartIds = [
  "studyFit",
  "outcomePathway",
  "coverageRelation",
  "measurementPotential",
  "mainConcern",
  "nextChecks",
] as const;

export const screen02AuditDossierPartIds = [
  "atAGlance",
  "whatHappened",
  "whatChanged",
  "timeline",
  "broadCoverage",
  "keyComponents",
  "relatedVersions",
  "unresolvedFacts",
] as const;

export const screen02StudyFitCategories = [
  "strong",
  "mixed",
  "weak",
  "unclear",
] as const;
export type Screen02StudyFitCategory =
  (typeof screen02StudyFitCategories)[number];

export const screen02OutcomePathwayCategories = [
  "plausible",
  "limited",
  "unsupported",
  "unclear",
] as const;
export type Screen02OutcomePathwayCategory =
  (typeof screen02OutcomePathwayCategories)[number];

export const screen02MeasurementPotentialCategories = [
  "possible",
  "difficult",
  "implausible",
  "unclear",
] as const;
export type Screen02MeasurementPotentialCategory =
  (typeof screen02MeasurementPotentialCategories)[number];

export const screen02CoverageRelationCategories = [
  "strong",
  "mixed",
  "weak",
  "unclear",
] as const;
export type Screen02CoverageRelationCategory =
  (typeof screen02CoverageRelationCategories)[number];

export type Screen02AssessmentComponent<Category extends string> = {
  category: Category;
  explanation: string;
  evidenceSourceIds: string[];
};

export const screen02PreliminaryJudgments = [
  "promising-to-verify",
  "worth-exploring",
  "low-priority",
  "not-enough-evidence",
] as const;
export type Screen02PreliminaryJudgment =
  (typeof screen02PreliminaryJudgments)[number];

export type Screen02FindCandidateAssessment = {
  assessmentId: string;
  candidateSnapshotId: string;
  requestId: string;
  status: "partial" | "completed" | "retry-exhausted";
  studyFit: Screen02AssessmentComponent<Screen02StudyFitCategory> | null;
  outcomePathway:
    | Screen02AssessmentComponent<Screen02OutcomePathwayCategory>
    | null;
  measurementPotential:
    | Screen02AssessmentComponent<Screen02MeasurementPotentialCategory>
    | null;
  mainConcern: string | null;
  nextChecks: string[];
  evidenceSourceIds: string[];
  acceptedFields: string[];
  overallJudgment: Screen02PreliminaryJudgment | null;
  overallJudgmentMethod: "fixed-computation" | null;
  recordedAt: string;
};

export const screen02CriterionKinds = [
  "only-include",
  "rank-higher",
  "do-not-show",
] as const;
export type Screen02CriterionKind =
  (typeof screen02CriterionKinds)[number];

export const screen02CriterionEvaluators = [
  "source-backed-ai",
  "fixed-candidate-source-presence-v1",
] as const;
export type Screen02CriterionEvaluator =
  (typeof screen02CriterionEvaluators)[number];

export type Screen02Criterion = {
  criterionId: string;
  version: number;
  kind: Screen02CriterionKind;
  status: "active" | "removed";
  statusReason: string;
  text: string;
  exactRequest: string;
  evaluator: Screen02CriterionEvaluator;
  source: "researcher" | "ai-interpretation";
  createdAt: string;
};

export const screen02CriterionFindingResults = [
  "meets",
  "does-not-meet",
  "violates",
  "does-not-violate",
  "unclear",
  "technical-failure",
] as const;
export type Screen02CriterionFindingResult =
  (typeof screen02CriterionFindingResults)[number];

export type Screen02CriterionOverride = {
  overrideId: string;
  researcher: string;
  at: string;
  reason: string;
  priorResult: Screen02CriterionFindingResult;
  resultingEligibility: "eligible" | "ineligible";
};

export type Screen02CriterionFinding = {
  findingId: string;
  candidateSnapshotId: string;
  criterionId: string;
  criterionVersion: number;
  result: Screen02CriterionFindingResult;
  reason: string;
  evidenceSourceIds: string[];
  method: "source-backed-ai" | "fixed-fallback" | "fixed-rule";
  requestId: string | null;
  recordedAt: string;
  overrides: Screen02CriterionOverride[];
};

export const screen02FindRelatedDiscoveryProviders = [
  "general-web",
  "scholarly",
  "public-reference",
] as const;

export type Screen02FindRelatedDiscoveryProvider =
  (typeof screen02FindRelatedDiscoveryProviders)[number];

/**
 * A navigation-only search destination derived from immutable candidate
 * identity. It is deliberately not a workflow source and cannot be cited as
 * evidence by an assessment or carried into the Screen 3 factual handoff.
 */
export type Screen02FindRelatedDiscoveryLink = {
  relatedLinkId: string;
  kind: "related-search";
  provider: Screen02FindRelatedDiscoveryProvider;
  title: string;
  locator: string;
  linkFingerprint: string;
};

export type Screen02FindCandidateSnapshot = {
  candidateId: string;
  candidateSnapshotId: string;
  candidateFingerprint: string;
  searchRoundId: string;
  origin:
    | "registry-reviewed"
    | "newly-discovered"
    | "user-provided"
    | "unsupported-lead";
  identity: Screen02EventIdentity;
  description: Screen02ProvisionalClaim;
  dateLeads: Screen02DateLead[];
  broadCoverage: Screen02ProvisionalClaim[];
  apparentExposureVariables: string[];
  sourceIds: string[];
  limitations: string[];
  recordedAt: string;
  /**
   * Fixed, source-backed qualification used to admit and rank this candidate.
   * Missing only on compatible snapshots produced before v0.4.03.
   */
  qualification?: Screen02CandidateQualification;
};

export type Screen02FindCandidateSet = {
  candidateSetSnapshotId: string;
  candidateSetFingerprint: string;
  searchRoundId: string;
  candidateSnapshotIds: string[];
  criterionVersionRefs: Array<{
    criterionId: string;
    version: number;
  }>;
  ordering: Array<{
    candidateSnapshotId: string;
    rank: number;
    reason: string;
  }>;
  manifest: Screen02WorkflowSearchManifest;
  /**
   * `stale-profile` preserves the immutable prior result for auditability but
   * removes it from the active comparison after a relevance-profile edit.
   */
  status: "active" | "superseded" | "stale-profile";
  supersededBySnapshotId: string | null;
};

export const screen02FindDiscoveryStatuses = [
  "searching",
  "completed",
  "completed-empty",
  "failed",
  "superseded",
] as const;

export type Screen02FindDiscoveryStatus =
  (typeof screen02FindDiscoveryStatuses)[number];

export type Screen02FindDiscoveryLifecycleEvent = {
  status: Screen02FindDiscoveryStatus;
  at: string;
  note: string | null;
};

export type Screen02FindDiscoveryRequest = {
  discoveryRequestId: string;
  searchRoundId: string;
  candidateSetSnapshotId: string;
  exactRequest: string;
  status: Screen02FindDiscoveryStatus;
  startedAt: string;
  updatedAt: string;
  failureCodes: string[];
  supersededByDiscoveryRequestId: string | null;
  lifecycle: Screen02FindDiscoveryLifecycleEvent[];
};

type Screen02FindDecisionEventBase = {
  decisionId: string;
  candidateSnapshotId: string | null;
  at: string;
  reason: string;
};

export type Screen02FindDecisionEvent =
  | (Screen02FindDecisionEventBase & {
      action:
        | "opened"
        | "open-cleared"
        | "tentatively-selected"
        | "selection-cleared"
        | "removed"
        | "continued";
    })
  | (Screen02FindDecisionEventBase & {
      action: "continued-without-assessment";
      assessmentDisposition: Screen02AssessmentUnavailableDisposition;
    });

export type Screen02FindState = {
  schemaVersion: typeof SCREEN_02_WORKFLOW_SCHEMA_VERSION;
  stateKind: typeof SCREEN_02_FIND_STATE_KIND;
  sourceScreen: "screen-02";
  mode: "find";
  runId: string;
  screen01Baseline: WorkflowDeepReadonly<Screen01StudyContext>;
  screen01Fingerprint: string;
  /** Absent only on compatible Find states saved before profile-v1. */
  relevanceProfile?: Screen02StudyRelevanceProfile;
  revision: number;
  createdAt: string;
  updatedAt: string;
  sources: Screen02WorkflowSource[];
  criteria: Screen02Criterion[];
  discoveryRequests: Screen02FindDiscoveryRequest[];
  candidateSets: Screen02FindCandidateSet[];
  activeCandidateSetSnapshotId: string | null;
  candidates: Screen02FindCandidateSnapshot[];
  assessments: Screen02FindCandidateAssessment[];
  /** Absent only on compatible states saved before shock-glance-v1. */
  shockGlances?: Screen02ShockGlance[];
  criterionFindings: Screen02CriterionFinding[];
  assessmentRequests: Screen02AssessmentRequest[];
  decision: {
    openedCandidateSnapshotId: string | null;
    tentativeSelectionSnapshotId: string | null;
    continuedRevision: number | null;
    history: Screen02FindDecisionEvent[];
  };
  outcomeValuesInspected: false;
};

export const screen02AuditVersionTypes = [
  "unspecified",
  "original",
  "amendment",
  "implementing-rule",
  "enforcement-action",
] as const;
export type Screen02AuditVersionType =
  (typeof screen02AuditVersionTypes)[number];

export type Screen02AuditAnchorFields = {
  shockName: string;
  jurisdiction: string | null;
  issuingAuthority: string | null;
  approximateYear: string | null;
  versionType: Screen02AuditVersionType;
  distinguishingFeature: string | null;
  sourceLocator: string | null;
  clarification: string | null;
};

export type Screen02AuditAnchorRevision = {
  anchorRevisionId: string;
  previousRevisionId: string | null;
  fields: Screen02AuditAnchorFields;
  createdAt: string;
  reason: string;
};

export type Screen02AuditAnchor = {
  originalWording: string;
  activeRevisionId: string;
  revisions: Screen02AuditAnchorRevision[];
};

export const screen02AuditRelationships = [
  "exact",
  "supported-alias",
  "original",
  "amendment",
  "implementing-rule",
  "enforcement-action",
  "related-event",
  "uncertain",
] as const;
export type Screen02AuditRelationship =
  (typeof screen02AuditRelationships)[number];

export type Screen02AuditPossibleMatch = {
  matchId: string;
  matchSnapshotId: string;
  identitySnapshotId: string;
  matchFingerprint: string;
  matchSetSnapshotId: string;
  anchorRevisionId: string;
  identity: Screen02EventIdentity;
  relationship: Screen02AuditRelationship;
  relationshipReason: string;
  sourceIds: string[];
  limitations: string[];
  recordedAt: string;
};

export type Screen02AuditMatchSet = {
  matchSetSnapshotId: string;
  matchSetFingerprint: string;
  anchorRevisionId: string;
  possibleMatchSnapshotIds: string[];
  manifest: Screen02WorkflowSearchManifest;
  status: "active" | "superseded";
  supersededBySnapshotId: string | null;
};

export type Screen02AuditRelatedVersion = {
  relationship: Screen02AuditRelationship;
  identity: Screen02EventIdentity;
  sourceIds: string[];
  note: string;
};

export type Screen02AuditDossier = {
  dossierSnapshotId: string;
  dossierFingerprint: string;
  identitySnapshotId: string;
  requestId: string;
  status: "partial" | "completed";
  atAGlance: Screen02ProvisionalClaim[];
  whatHappened: Screen02ProvisionalClaim | null;
  whatChanged: Screen02ProvisionalClaim[];
  timeline: Screen02DateLead[];
  broadCoverage: Screen02ProvisionalClaim[];
  keyComponents: Screen02ProvisionalClaim[];
  relatedVersions: Screen02AuditRelatedVersion[];
  unresolvedFacts: string[];
  sourceIds: string[];
  recordedAt: string;
};

export const screen02IdentityDecisionActions = [
  "confirmed",
  "related-version",
  "rejected",
  "anchor-revised",
  "reversed",
  "no-match",
] as const;
export type Screen02IdentityDecisionAction =
  (typeof screen02IdentityDecisionActions)[number];

export type Screen02IdentityDecision = {
  decisionId: string;
  action: Screen02IdentityDecisionAction;
  actor: "researcher";
  anchorRevisionId: string;
  matchSnapshotId: string | null;
  identitySnapshotId: string | null;
  dossierSnapshotId: string | null;
  confirmationSnapshotId: string | null;
  confirmationFingerprint: string | null;
  reversesDecisionId: string | null;
  at: string;
  reason: string;
};

export type Screen02ConfirmedIdentity = {
  confirmationSnapshotId: string;
  confirmationFingerprint: string;
  identitySnapshotId: string;
  matchSnapshotId: string;
  matchSetSnapshotId: string;
  anchorRevisionId: string;
  dossierSnapshotId: string;
  dossierFingerprint: string;
  decisionId: string;
  confirmedAt: string;
};

type Screen02AuditContinuationEventBase = {
  continuationId: string;
  confirmationSnapshotId: string;
  identitySnapshotId: string;
  dossierSnapshotId: string;
  continuedRevision: number;
  at: string;
  reason: string;
};

export type Screen02AuditContinuationEvent =
  Screen02AuditContinuationEventBase &
    (
      | { assessmentId: string }
      | {
          assessmentDisposition: Screen02AssessmentUnavailableDisposition;
        }
    );

export type Screen02AuditAssessment = {
  assessmentId: string;
  identitySnapshotId: string;
  requestId: string;
  status: "partial" | "completed";
  studyFit: Screen02AssessmentComponent<Screen02StudyFitCategory> | null;
  outcomePathway:
    | Screen02AssessmentComponent<Screen02OutcomePathwayCategory>
    | null;
  coverageRelation:
    | Screen02AssessmentComponent<Screen02CoverageRelationCategory>
    | null;
  measurementPotential:
    | Screen02AssessmentComponent<Screen02MeasurementPotentialCategory>
    | null;
  mainConcern: string | null;
  nextChecks: string[];
  evidenceSourceIds: string[];
  acceptedFields: string[];
  overallJudgment: Screen02PreliminaryJudgment | null;
  overallJudgmentMethod: "fixed-computation" | null;
  recordedAt: string;
};

export type Screen02AuditState = {
  schemaVersion: typeof SCREEN_02_WORKFLOW_SCHEMA_VERSION;
  stateKind: typeof SCREEN_02_AUDIT_STATE_KIND;
  sourceScreen: "screen-02";
  mode: "audit";
  runId: string;
  screen01Baseline: WorkflowDeepReadonly<Screen01StudyContext>;
  screen01Fingerprint: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  sources: Screen02WorkflowSource[];
  anchor: Screen02AuditAnchor;
  matchSets: Screen02AuditMatchSet[];
  activeMatchSetSnapshotId: string | null;
  possibleMatches: Screen02AuditPossibleMatch[];
  dossiers: Screen02AuditDossier[];
  identityDecisions: Screen02IdentityDecision[];
  confirmedIdentity: Screen02ConfirmedIdentity | null;
  assessments: Screen02AuditAssessment[];
  /** Absent only on compatible states saved before shock-glance-v1. */
  shockGlances?: Screen02ShockGlance[];
  assessmentRequests: Screen02AssessmentRequest[];
  continuationHistory: Screen02AuditContinuationEvent[];
  outcomeValuesInspected: false;
};

export type Screen02WorkflowState =
  | Screen02FindState
  | Screen02AuditState;
