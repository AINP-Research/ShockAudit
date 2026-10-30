import type {
  Screen02SearchChannelRecord,
  Screen02SearchQueryRecord,
} from "../core/screen02-workflow-types";
import type { Screen02Proposal } from "../core/screen02-types";
import {
  canonicalScreen02FormalIdentifier,
  compareScreen02FormalIdentifiers,
  isIndependentlyScopedScreen02FormalIdentifier,
  parseScreen02FormalIdentifier,
} from "../core/screen02-formal-identifier";

export const SCREEN_02_SEARCH_EXPANSION_VERSION =
  "screen-02-search-expansion-v1" as const;

export const SCREEN_02_SEARCH_EXPANSION_BUDGETS = {
  maximumSources: 6,
  minimumFindQueryVariants: 12,
  maximumBaselineQueries: 16,
  maximumExpandedQueries: 16,
  maximumTotalQueries: 16,
  maximumRounds: 2,
  rawCandidateTarget: 40,
  qualifiedCandidateTarget: 10,
  defaultExpandedQueries: 4,
  maximumResultsPerQuery: 20,
  defaultResultsPerQuery: 8,
  maximumConcurrentQueries: 3,
  defaultConcurrentQueries: 2,
  maximumMergedRecords: 60,
} as const;

/**
 * Expansion is additive to an already-completed native search. Keep its whole
 * execution comfortably below the user-facing workflow deadline so shadow or
 * on mode can always fall back to the unchanged baseline promptly.
 */
export const SCREEN_02_SEARCH_EXPANSION_DEADLINE_MS = 3_200;

export type Screen02SearchMode = "find" | "audit";

export type Screen02ContextSearchLead = Omit<
  Screen02SearchRecordInput<Screen02Proposal>,
  "directSupport"
>;

export type Screen02ContextSearchProvider = (input: Readonly<{
  mode: Screen02SearchMode;
  stage: Exclude<Screen02SearchExpansionStage, "baseline">;
  query: string;
  resultLimit: number;
  retrievedAt: string;
  eventFamily: string;
  startDate: string;
  endDate: string;
  identity: {
    canonicalName: string;
    issuingJurisdiction: string | null;
  } | null;
  signal: AbortSignal;
}>) => Promise<readonly Screen02ContextSearchLead[]>;

/**
 * The role is assigned by the fixed plan, never by a retrieved record. This
 * prevents a supplemental runner from promoting its own output to an official
 * source merely by returning a different label.
 */
export type Screen02SearchSourceRole =
  | "official"
  | "supplemental"
  | "context";

export type Screen02SearchExpansionStage =
  | "baseline"
  | "identity"
  | "timing"
  | "coverage"
  | "implementation";

export type Screen02SearchEvidenceDisposition =
  | "authoritative"
  | "directly-supported"
  | "lead-only";

export type Screen02SearchBaselineQueryInput = {
  query: string;
  purpose?: string;
};

export type Screen02SearchPlanSourceInput = {
  sourceId: string;
  role: Screen02SearchSourceRole;
  baselineQueries: readonly Screen02SearchBaselineQueryInput[];
  /** Omit or use an empty list to keep this source baseline-only. */
  expandedStages?: readonly Exclude<Screen02SearchExpansionStage, "baseline">[];
};

export type Screen02SearchIdentityInput = {
  canonicalName: string;
  aliases?: readonly string[];
  formalIdentifier?: string | null;
  issuer?: string | null;
  issuingJurisdiction?: string | null;
};

export type Screen02SearchResearchPlanInput = {
  mode: Screen02SearchMode;
  eventFamily: string;
  industry?: string;
  topicTerms?: readonly string[];
  identity?: Screen02SearchIdentityInput;
  /**
   * These are issuing jurisdictions, not the Screen 1 study geography. Find
   * callers should leave this empty unless an event-issuer boundary is known.
   */
  allowedIssuingJurisdictions?: readonly string[];
  jurisdictionAliases?: readonly string[];
  sources: readonly Screen02SearchPlanSourceInput[];
  maximumExpandedQueries?: number;
  resultsPerQuery?: number;
  concurrentQueries?: number;
};

export type Screen02SearchQueryVariant = {
  id: string;
  sourceId: string;
  sourceRole: Screen02SearchSourceRole;
  stage: Screen02SearchExpansionStage;
  query: string;
  purpose: string;
  resultLimit: number;
};

export type Screen02SearchResearchPlan = {
  version: typeof SCREEN_02_SEARCH_EXPANSION_VERSION;
  mode: Screen02SearchMode;
  eventFamily: string;
  baseline: Screen02SearchQueryVariant[];
  expanded: Screen02SearchQueryVariant[];
  filters: {
    identity: {
      required: boolean;
      terms: string[];
    };
    jurisdiction: {
      required: boolean;
      allowed: string[];
    };
  };
  budgets: {
    baselineQueries: number;
    expandedQueries: number;
    totalQueries: number;
    resultsPerQuery: number;
    concurrentQueries: number;
    maximumMergedRecords: number;
    rawCandidateTarget: number;
    qualifiedCandidateTarget: number;
    maximumRounds: number;
  };
  mergePolicy: "baseline-first-additive";
  fallbackPolicy: "preserve-baseline-on-expansion-empty-or-fault";
  sourcePolicy: "official-authoritative-supplemental-lead-unless-direct";
};

export type Screen02SearchRecordInput<Value> = {
  recordId: string;
  canonicalIdentity: string;
  identityAliases?: readonly string[];
  formalIdentifier?: string | null;
  /** Native issuing body, used only to namespace local identifier deduplication. */
  issuer?: string | null;
  issuingJurisdiction?: string | null;
  /** Exact fixed-code signature; unequal signatures are retained for core clustering. */
  treatmentAssignmentSignature?: string | null;
  /** Exact deterministic event signature for safe pre-cap cross-lane deduplication. */
  semanticEventKey?: string | null;
  locator?: string | null;
  directSupport: boolean;
  value: Value;
};

export type Screen02SearchSelectedRecord<Value> =
  Screen02SearchRecordInput<Value> & {
    sourceId: string;
    sourceRole: Screen02SearchSourceRole;
    firstSeenStage: Screen02SearchExpansionStage;
    queryId: string;
    disposition: Screen02SearchEvidenceDisposition;
  };

export type Screen02SearchQueryTelemetry = {
  queryId: string;
  sourceId: string;
  sourceRole: Screen02SearchSourceRole;
  stage: Screen02SearchExpansionStage;
  status: "searched" | "failed";
  recordsReturned: number;
  recordsWithinBudget: number;
  recordsAccepted: number;
  invalidRecordsDropped: number;
  overBudgetRecordsDropped: number;
  identityFilterDrops: number;
  jurisdictionFilterDrops: number;
  duplicateDrops: number;
  mergedCapDrops: number;
  failureKind: "none" | "timeout" | "aborted" | "runner-error";
  error: string | null;
};

export type Screen02SearchComparisonTelemetry = {
  version: typeof SCREEN_02_SEARCH_EXPANSION_VERSION;
  mode: Screen02SearchMode;
  baseline: {
    queriesPlanned: number;
    queriesSucceeded: number;
    queriesFailed: number;
    recordsReturned: number;
    uniqueRecordsSelected: number;
  };
  expanded: {
    queriesPlanned: number;
    queriesSucceeded: number;
    queriesFailed: number;
    recordsReturned: number;
    recordsAccepted: number;
    contextLeadCount: number;
    identityFilterDrops: number;
    jurisdictionFilterDrops: number;
    duplicateDrops: number;
  };
  selectedRecords: number;
  baselineRecordsPreserved: number;
  zeroResultRecovered: boolean;
  expansionFaultFallbackUsed: boolean;
  selection:
    | "baseline-only"
    | "baseline-plus-expanded"
    | "expanded-recovery"
    | "empty";
  outcomeValuesInspected: false;
};

export type Screen02SearchManifestSupplement = {
  queryMatrix: Screen02SearchQueryRecord[];
  channels: Screen02SearchChannelRecord[];
};

export type Screen02SearchExpansionResult<Value> = {
  plan: Screen02SearchResearchPlan;
  records: Screen02SearchSelectedRecord<Value>[];
  values: Value[];
  queryTelemetry: Screen02SearchQueryTelemetry[];
  comparison: Screen02SearchComparisonTelemetry;
  manifestSupplement: Screen02SearchManifestSupplement;
};

const EXPANDED_STAGE_ORDER = [
  "identity",
  "timing",
  "coverage",
  "implementation",
] as const satisfies readonly Exclude<
  Screen02SearchExpansionStage,
  "baseline"
>[];

const LEGAL_STAGE_TERMS = {
  identity: "official title identifier issuing authority",
  timing: "enacted adopted effective commencement date",
  coverage: "covered entities eligibility threshold exemption",
  implementation: "implementation compliance amendment enforcement",
} as const;

const DISASTER_STAGE_TERMS = {
  identity: "official event name identifier",
  timing: "occurrence declaration date",
  coverage: "designated area eligibility declaration",
  implementation: "emergency response recovery termination",
} as const;

function cleanText(value: string, maximum = 240) {
  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum)
    .trim();
}

function normalizedText(value: string | null | undefined) {
  return cleanText(value ?? "", 500)
    .normalize("NFKD")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function boundedInteger(
  value: number | undefined,
  fallback: number,
  maximum: number,
  label: string,
) {
  const candidate = value ?? fallback;
  if (!Number.isSafeInteger(candidate) || candidate < 1 || candidate > maximum) {
    throw new Error(`${label} must be an integer from 1 through ${maximum}.`);
  }
  return candidate;
}

function stableFragment(value: string, fallback: string) {
  return normalizedText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || fallback;
}

function uniqueClean(values: readonly (string | null | undefined)[], maximum: number) {
  const byNormalized = new Map<string, string>();
  for (const raw of values) {
    const value = cleanText(raw ?? "", 240);
    const normalized = normalizedText(value);
    if (!value || !normalized || byNormalized.has(normalized)) continue;
    byNormalized.set(normalized, value);
    if (byNormalized.size >= maximum) break;
  }
  return [...byNormalized.values()];
}

function requireSourceInputs(sources: readonly Screen02SearchPlanSourceInput[]) {
  if (
    sources.length < 1 ||
    sources.length > SCREEN_02_SEARCH_EXPANSION_BUDGETS.maximumSources
  ) {
    throw new Error(
      `Screen 2 search planning requires 1 through ${SCREEN_02_SEARCH_EXPANSION_BUDGETS.maximumSources} declared sources.`,
    );
  }
  const sourceIds = sources.map((source) => cleanText(source.sourceId, 100));
  if (
    sourceIds.some((sourceId) => !sourceId) ||
    new Set(sourceIds).size !== sourceIds.length
  ) {
    throw new Error("Screen 2 search source IDs must be nonempty and unique.");
  }
  const roles = new Set<Screen02SearchSourceRole>([
    "official",
    "supplemental",
    "context",
  ]);
  if (sources.some((source) => !roles.has(source.role))) {
    throw new Error("Screen 2 search sources require a recognized fixed role.");
  }
  if (
    sources.some(
      (source) =>
        source.baselineQueries.length === 0 &&
        (source.expandedStages?.length ?? 0) === 0,
    )
  ) {
    throw new Error(
      "Screen 2 search sources require a baseline query or a declared expansion stage.",
    );
  }
  if (
    sources.some((source) =>
      (source.expandedStages ?? []).some(
        (stage) => !EXPANDED_STAGE_ORDER.includes(stage),
      ),
    )
  ) {
    throw new Error("Screen 2 search sources contain an unsupported expansion stage.");
  }
  return sourceIds;
}

function stageTerms(eventFamily: string) {
  return /\b(disaster|hazard|earthquake|flood|cyclone|hurricane|wildfire|tsunami)\b/u.test(
    normalizedText(eventFamily),
  )
    ? DISASTER_STAGE_TERMS
    : LEGAL_STAGE_TERMS;
}

function querySeed(input: Screen02SearchResearchPlanInput) {
  const identity = input.identity;
  if (input.mode === "audit") {
    return uniqueClean(
      [
        identity?.canonicalName,
        identity?.formalIdentifier,
        identity?.issuer,
      ],
      3,
    ).join(" ");
  }
  return uniqueClean(
    [input.industry, input.eventFamily, ...(input.topicTerms ?? [])],
    4,
  ).join(" ");
}

function expandedQuery(
  seed: string,
  stage: Exclude<Screen02SearchExpansionStage, "baseline">,
  eventFamily: string,
) {
  return cleanText(`${seed} ${stageTerms(eventFamily)[stage]}`);
}

function researchPlan(
  input: Screen02SearchResearchPlanInput,
): Screen02SearchResearchPlan {
  const eventFamily = cleanText(input.eventFamily, 160);
  if (!eventFamily) throw new Error("Screen 2 search planning requires an event family.");
  if (input.mode === "audit" && !cleanText(input.identity?.canonicalName ?? "")) {
    throw new Error("Audit search expansion requires the named event identity.");
  }
  const sourceIds = requireSourceInputs(input.sources);
  const resultsPerQuery = boundedInteger(
    input.resultsPerQuery,
    SCREEN_02_SEARCH_EXPANSION_BUDGETS.defaultResultsPerQuery,
    SCREEN_02_SEARCH_EXPANSION_BUDGETS.maximumResultsPerQuery,
    "resultsPerQuery",
  );
  const maximumExpandedQueries = boundedInteger(
    input.maximumExpandedQueries,
    SCREEN_02_SEARCH_EXPANSION_BUDGETS.defaultExpandedQueries,
    SCREEN_02_SEARCH_EXPANSION_BUDGETS.maximumExpandedQueries,
    "maximumExpandedQueries",
  );
  const concurrentQueries = boundedInteger(
    input.concurrentQueries,
    SCREEN_02_SEARCH_EXPANSION_BUDGETS.defaultConcurrentQueries,
    SCREEN_02_SEARCH_EXPANSION_BUDGETS.maximumConcurrentQueries,
    "concurrentQueries",
  );
  const baseline: Screen02SearchQueryVariant[] = [];
  const expanded: Screen02SearchQueryVariant[] = [];
  const seenBySource = new Set<string>();

  input.sources.forEach((source, sourceIndex) => {
    const sourceId = sourceIds[sourceIndex]!;
    source.baselineQueries.forEach((baselineInput, queryIndex) => {
      const query = cleanText(baselineInput.query);
      if (!query) throw new Error(`Baseline query ${queryIndex + 1} for ${sourceId} is empty.`);
      const dedupeKey = `${sourceId}:${normalizedText(query)}`;
      if (seenBySource.has(dedupeKey)) return;
      seenBySource.add(dedupeKey);
      baseline.push({
        id: `s2-${input.mode}-${stableFragment(sourceId, `source-${sourceIndex + 1}`)}-baseline-${String(queryIndex + 1).padStart(2, "0")}`,
        sourceId,
        sourceRole: source.role,
        stage: "baseline",
        query,
        purpose:
          cleanText(baselineInput.purpose ?? "", 400) ||
          "Run the unchanged baseline retrieval for comparison and fallback.",
        resultLimit: resultsPerQuery,
      });
    });
  });

  if (
    baseline.length > SCREEN_02_SEARCH_EXPANSION_BUDGETS.maximumBaselineQueries
  ) {
    throw new Error(
      `Screen 2 search planning permits up to ${SCREEN_02_SEARCH_EXPANSION_BUDGETS.maximumBaselineQueries} unique baseline queries.`,
    );
  }
  const expandedQueryBudget = Math.min(
    maximumExpandedQueries,
    Math.max(
      0,
      SCREEN_02_SEARCH_EXPANSION_BUDGETS.maximumTotalQueries - baseline.length,
    ),
  );

  const seed = querySeed(input);
  if (seed) {
    const selectedBySource = input.sources.map(() => 0);
    let sourceCursor = 0;
    const addExpanded = (
      sourceIndex: number,
      stage: Exclude<Screen02SearchExpansionStage, "baseline">,
    ) => {
      if (expanded.length >= expandedQueryBudget) return false;
      const source = input.sources[sourceIndex]!;
      if (!(source.expandedStages ?? []).includes(stage)) return false;
      const sourceId = sourceIds[sourceIndex]!;
      const query = expandedQuery(seed, stage, eventFamily);
      const dedupeKey = `${sourceId}:${normalizedText(query)}`;
      if (!query || seenBySource.has(dedupeKey)) return false;
      seenBySource.add(dedupeKey);
      expanded.push({
        id: `s2-${input.mode}-${stableFragment(sourceId, `source-${sourceIndex + 1}`)}-${stage}-${String(expanded.length + 1).padStart(2, "0")}`,
        sourceId,
        sourceRole: source.role,
        stage,
        query,
        purpose: `Expanded ${stage} recall for the declared ${source.role} source; this query does not upgrade source authority or prove event fit.`,
        resultLimit: resultsPerQuery,
      });
      selectedBySource[sourceIndex] += 1;
      sourceCursor = (sourceIndex + 1) % input.sources.length;
      return true;
    };

    const fairEligibleSource = (
      stage: Exclude<Screen02SearchExpansionStage, "baseline">,
    ) => {
      const eligible = input.sources
        .map((source, sourceIndex) => ({ source, sourceIndex }))
        .filter(({ source, sourceIndex }) => {
          if (!(source.expandedStages ?? []).includes(stage)) return false;
          const sourceId = sourceIds[sourceIndex]!;
          const query = expandedQuery(seed, stage, eventFamily);
          return !seenBySource.has(`${sourceId}:${normalizedText(query)}`);
        });
      if (eligible.length === 0) return undefined;
      const fewest = Math.min(
        ...eligible.map(({ sourceIndex }) => selectedBySource[sourceIndex]!),
      );
      for (let offset = 0; offset < input.sources.length; offset += 1) {
        const sourceIndex = (sourceCursor + offset) % input.sources.length;
        if (
          selectedBySource[sourceIndex] === fewest &&
          eligible.some((candidate) => candidate.sourceIndex === sourceIndex)
        ) {
          return sourceIndex;
        }
      }
      return eligible[0]!.sourceIndex;
    };

    // Cover the four lifecycle questions once before spending any query on a
    // duplicate stage. The rotating least-used source choice prevents the
    // first connector family from consuming the small expansion budget.
    for (const stage of EXPANDED_STAGE_ORDER) {
      const sourceIndex = fairEligibleSource(stage);
      if (sourceIndex !== undefined) addExpanded(sourceIndex, stage);
      if (expanded.length >= expandedQueryBudget) break;
    }

    // Use spare capacity on sources with the fewest selections, preserving
    // source-family fairness while cycling stages deterministically.
    while (expanded.length < expandedQueryBudget) {
      let added = false;
      for (let offset = 0; offset < input.sources.length; offset += 1) {
        const sourceIndex = (sourceCursor + offset) % input.sources.length;
        const minimumSelected = Math.min(...selectedBySource);
        if (selectedBySource[sourceIndex] !== minimumSelected) continue;
        for (const stage of EXPANDED_STAGE_ORDER) {
          if (addExpanded(sourceIndex, stage)) {
            added = true;
            break;
          }
        }
        if (added) break;
      }
      if (added) continue;

      // Sources without an eligible expansion stage can have the minimum
      // count. Fall back to any remaining source-stage pair rather than loop.
      for (const stage of EXPANDED_STAGE_ORDER) {
        const sourceIndex = fairEligibleSource(stage);
        if (sourceIndex !== undefined && addExpanded(sourceIndex, stage)) {
          added = true;
          break;
        }
      }
      if (!added) break;
    }
  }

  if (
    baseline.length + expanded.length < 1 ||
    baseline.length + expanded.length >
      SCREEN_02_SEARCH_EXPANSION_BUDGETS.maximumTotalQueries
  ) {
    throw new Error(
      "Screen 2 search planning requires at least one query and cannot exceed the total query budget.",
    );
  }

  const identityTerms = uniqueClean(
    [
      input.identity?.canonicalName,
      ...(input.identity?.aliases ?? []),
      input.identity?.formalIdentifier,
    ],
    10,
  );
  const allowedJurisdictions = uniqueClean(
    [
      ...(input.allowedIssuingJurisdictions ?? []),
      ...(input.jurisdictionAliases ?? []),
      ...(input.mode === "audit" ? [input.identity?.issuingJurisdiction] : []),
    ],
    12,
  );

  return {
    version: SCREEN_02_SEARCH_EXPANSION_VERSION,
    mode: input.mode,
    eventFamily,
    baseline,
    expanded,
    filters: {
      identity: {
        required: input.mode === "audit",
        terms: identityTerms,
      },
      jurisdiction: {
        required: allowedJurisdictions.length > 0,
        allowed: allowedJurisdictions,
      },
    },
    budgets: {
      baselineQueries: baseline.length,
      expandedQueries: expanded.length,
      totalQueries: baseline.length + expanded.length,
      resultsPerQuery,
      concurrentQueries,
      maximumMergedRecords:
        SCREEN_02_SEARCH_EXPANSION_BUDGETS.maximumMergedRecords,
      rawCandidateTarget:
        SCREEN_02_SEARCH_EXPANSION_BUDGETS.rawCandidateTarget,
      qualifiedCandidateTarget:
        SCREEN_02_SEARCH_EXPANSION_BUDGETS.qualifiedCandidateTarget,
      maximumRounds: SCREEN_02_SEARCH_EXPANSION_BUDGETS.maximumRounds,
    },
    mergePolicy: "baseline-first-additive",
    fallbackPolicy: "preserve-baseline-on-expansion-empty-or-fault",
    sourcePolicy: "official-authoritative-supplemental-lead-unless-direct",
  };
}

export function buildScreen02FindSearchResearchPlan(
  input: Omit<Screen02SearchResearchPlanInput, "mode">,
) {
  return researchPlan({ ...input, mode: "find" });
}

export function buildScreen02AuditSearchResearchPlan(
  input: Omit<Screen02SearchResearchPlanInput, "mode"> & {
    identity: Screen02SearchIdentityInput;
  },
) {
  return researchPlan({ ...input, mode: "audit" });
}

type QueryExecution<Value> = {
  variant: Screen02SearchQueryVariant;
  status: "searched" | "failed";
  recordsReturned: number;
  records: Screen02SearchRecordInput<Value>[];
  invalidRecordsDropped: number;
  overBudgetRecordsDropped: number;
  failureKind: "none" | "timeout" | "aborted" | "runner-error";
  error: string | null;
};

function validRecord<Value>(value: unknown): value is Screen02SearchRecordInput<Value> {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<Screen02SearchRecordInput<Value>>;
  return Boolean(
    typeof record.recordId === "string" && cleanText(record.recordId, 200) &&
      typeof record.canonicalIdentity === "string" &&
      cleanText(record.canonicalIdentity, 500) &&
      typeof record.directSupport === "boolean" &&
      (record.identityAliases === undefined ||
        (Array.isArray(record.identityAliases) &&
          record.identityAliases.length <= 20 &&
          record.identityAliases.every((alias) =>
            typeof alias === "string" && Boolean(cleanText(alias, 500))
          ))),
  );
}

function boundedError(error: unknown) {
  const value =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : "Search runner failed with an unknown error.";
  return cleanText(value, 500) || "Search runner failed.";
}

function queryFailureKind(
  error: unknown,
): Exclude<QueryExecution<unknown>["failureKind"], "none"> {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (
    name === "TimeoutError" ||
    /\b(?:timeout|timed out|deadline)\b/i.test(message)
  ) {
    return "timeout";
  }
  if (name === "AbortError" || /\babort(?:ed)?\b/i.test(message)) {
    return "aborted";
  }
  return "runner-error";
}

function compareSearchRecords<Value>(
  left: Screen02SearchRecordInput<Value>,
  right: Screen02SearchRecordInput<Value>,
) {
  const directOrder = Number(right.directSupport) - Number(left.directSupport);
  if (directOrder !== 0) return directOrder;
  const leftFormalIdentifier = canonicalScreen02FormalIdentifier(
    left.formalIdentifier,
  );
  const rightFormalIdentifier = canonicalScreen02FormalIdentifier(
    right.formalIdentifier,
  );
  const formalIdentityOrder = Number(Boolean(rightFormalIdentifier)) -
    Number(Boolean(leftFormalIdentifier));
  if (formalIdentityOrder !== 0) return formalIdentityOrder;
  const stableJson = (value: unknown): string => {
    if (value === null || typeof value !== "object") {
      return JSON.stringify(value) ?? `${typeof value}:${String(value)}`;
    }
    if (Array.isArray(value)) {
      return `[${value.map(stableJson).join(",")}]`;
    }
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) =>
      `${JSON.stringify(key)}:${stableJson(object[key])}`
    ).join(",")}}`;
  };
  const compareOrdinal = (leftValue: string, rightValue: string) =>
    leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
  const orderKey = (record: Screen02SearchRecordInput<Value>) => [
    canonicalScreen02FormalIdentifier(record.formalIdentifier) ?? "",
    normalizedText(record.issuingJurisdiction),
    normalizedText(record.issuer),
    normalizedText(record.treatmentAssignmentSignature),
    normalizedText(record.semanticEventKey),
    locatorKey(record.locator) ?? "",
    normalizedText(record.canonicalIdentity),
    uniqueClean(record.identityAliases ?? [], 20)
      .map(normalizedText)
      .sort(compareOrdinal)
      .join("\u001e"),
    normalizedText(record.recordId),
    // Identity keys can be exactly equal while source adapters return
    // differently ordered or enriched JSON payloads. A canonical JSON tail
    // makes the winner independent of provider row order without interpreting
    // any candidate fact or outcome value.
    stableJson(record.value),
  ].join("\u001f");
  return compareOrdinal(orderKey(left), orderKey(right));
}

async function executeVariant<Value>(
  variant: Screen02SearchQueryVariant,
  execute: (
    query: Screen02SearchQueryVariant,
    options: { signal: AbortSignal },
  ) => Promise<readonly Screen02SearchRecordInput<Value>[]>,
  signal: AbortSignal,
): Promise<QueryExecution<Value>> {
  try {
    if (signal.aborted) throw signal.reason;
    const returned = await Promise.race([
      execute(variant, { signal }),
      new Promise<never>((_resolve, reject) => {
        const abort = () => reject(
          signal.reason ?? new DOMException("Search expansion aborted", "AbortError"),
        );
        if (signal.aborted) abort();
        else signal.addEventListener("abort", abort, { once: true });
      }),
    ]);
    if (!Array.isArray(returned)) {
      throw new Error("Search runner returned a non-array result.");
    }
    const candidateRecords = returned as Screen02SearchRecordInput<Value>[];
    const records = candidateRecords
      .filter((record) => validRecord<Value>(record))
      .sort((left, right) => compareSearchRecords<Value>(left, right));
    return {
      variant,
      status: "searched",
      recordsReturned: returned.length,
      records,
      invalidRecordsDropped: returned.length - records.length,
      // Filtering, deduplication, and then the per-query cap are applied in
      // the common merge loop so invalid or repeated provider rows cannot
      // consume the usable result budget.
      overBudgetRecordsDropped: 0,
      failureKind: "none",
      error: null,
    };
  } catch (error) {
    return {
      variant,
      status: "failed",
      recordsReturned: 0,
      records: [],
      invalidRecordsDropped: 0,
      overBudgetRecordsDropped: 0,
      failureKind: queryFailureKind(error),
      error: boundedError(error),
    };
  }
}

async function executeQueries<Value>(
  variants: readonly Screen02SearchQueryVariant[],
  concurrency: number,
  execute: (
    query: Screen02SearchQueryVariant,
    options: { signal: AbortSignal },
  ) => Promise<readonly Screen02SearchRecordInput<Value>[]>,
  signal: AbortSignal,
) {
  const executions: QueryExecution<Value>[] = [];
  for (let index = 0; index < variants.length; index += concurrency) {
    const chunk = variants.slice(index, index + concurrency);
    const completed = await Promise.all(
      chunk.map((variant) => executeVariant(variant, execute, signal)),
    );
    executions.push(...completed);
    if (signal.aborted) break;
  }
  for (const variant of variants.slice(executions.length)) {
    executions.push({
      variant,
      status: "failed",
      recordsReturned: 0,
      records: [],
      invalidRecordsDropped: 0,
      overBudgetRecordsDropped: 0,
      failureKind: queryFailureKind(
        signal.reason ?? new DOMException("Search expansion aborted", "AbortError"),
      ),
      error: boundedError(
        signal.reason ?? new DOMException("Search expansion aborted", "AbortError"),
      ),
    });
  }
  return executions;
}

function recordIdentityText<Value>(record: Screen02SearchRecordInput<Value>) {
  return uniqueClean(
    [
      record.canonicalIdentity,
      ...(record.identityAliases ?? []),
      record.formalIdentifier,
    ],
    24,
  ).map(normalizedText);
}

function identityMatches<Value>(
  record: Screen02SearchRecordInput<Value>,
  terms: readonly string[],
) {
  if (terms.length === 0) return false;
  const formalIdentifier = canonicalScreen02FormalIdentifier(
    record.formalIdentifier,
  );
  const parsedFormalIdentifier = parseScreen02FormalIdentifier(
    record.formalIdentifier,
  );
  const formalTerms = terms.filter((term) => {
    const parsed = parseScreen02FormalIdentifier(term);
    return Boolean(parsed && parsed.family !== "opaque");
  });
  if (
    formalIdentifier &&
    terms.some((term) =>
      canonicalScreen02FormalIdentifier(term) === formalIdentifier
    )
  ) return true;
  if (
    parsedFormalIdentifier && parsedFormalIdentifier.family !== "opaque" &&
    formalTerms.length > 0
  ) {
    const parsedTerms = formalTerms.map((term) => ({
      term,
      parsed: parseScreen02FormalIdentifier(term)!,
    }));
    const maximumSpecificity = Math.max(
      ...parsedTerms.map(({ parsed }) => parsed.specificity),
    );
    const strongestRelations = parsedTerms
      .filter(({ parsed }) => parsed.specificity === maximumSpecificity)
      .map(({ term }) => compareScreen02FormalIdentifiers(
        record.formalIdentifier,
        term,
      ));
    if (strongestRelations.some((relation) =>
      relation === "conflict" || relation === "different"
    )) return false;
    if (strongestRelations.some((relation) => {
      return relation === "equivalent" ||
        relation === "compatible-partial";
    })) return true;
    // A returned record carrying a recognized but conflicting formal
    // coordinate cannot be rescued by a familiar title or alias.
    return false;
  }
  const identities = recordIdentityText(record);
  return terms.some((term) => {
    const normalizedTerm = normalizedText(term);
    return identities.some(
      (identity) =>
        identity === normalizedTerm ||
        ` ${identity} `.includes(` ${normalizedTerm} `) ||
        ` ${normalizedTerm} `.includes(` ${identity} `),
    );
  });
}

function jurisdictionMatches<Value>(
  record: Screen02SearchRecordInput<Value>,
  allowed: readonly string[],
) {
  const jurisdiction = normalizedText(record.issuingJurisdiction);
  if (!jurisdiction) return false;
  return allowed.some((value) => {
    const normalizedAllowed = normalizedText(value);
    return (
      jurisdiction === normalizedAllowed ||
      ` ${jurisdiction} `.includes(` ${normalizedAllowed} `)
    );
  });
}

function locatorKey(locator: string | null | undefined) {
  if (!locator) return null;
  try {
    const url = new URL(locator);
    if (!/^https?:$/.test(url.protocol)) return null;
    url.username = "";
    url.password = "";
    url.hash = "";
    if (
      (url.protocol === "https:" && url.port === "443") ||
      (url.protocol === "http:" && url.port === "80")
    ) {
      url.port = "";
    }
    return `${url.protocol.toLowerCase()}//${url.hostname.toLowerCase()}${url.port ? `:${url.port}` : ""}${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

function recordKeys<Value>(
  record: Screen02SearchRecordInput<Value>,
  sourceId: string,
) {
  const jurisdiction = normalizedText(record.issuingJurisdiction);
  const formalIdentifier = canonicalScreen02FormalIdentifier(
    record.formalIdentifier,
  );
  const issuer = normalizedText(record.issuer);
  const treatmentAssignment = normalizedText(
    record.treatmentAssignmentSignature,
  );
  const semanticEventKey = normalizedText(record.semanticEventKey);
  const assignmentNamespace = `assignment:${treatmentAssignment || "unresolved"}`;
  const stableLocator = locatorKey(record.locator);
  const formalNamespace = isIndependentlyScopedScreen02FormalIdentifier(
    record.formalIdentifier,
  )
    ? issuer
      ? `issuer:${issuer}`
      : "independently-scoped"
    : issuer
      ? `issuer:${issuer}`
      : null;
  // URL origins are normalized by locatorKey, while path/query case and query
  // ordering remain exact because some official repositories treat them as
  // distinct records. Formal identity is an early duplicate key only when it
  // has its own non-generic namespace or an explicit issuer namespace. An
  // exact treatment signature is part of that key; richer/sparser or distinct
  // versions survive for the proposal-level overlap and conflict rules.
  return [
    `record:${normalizedText(sourceId)}:${normalizedText(record.recordId)}:jurisdiction:${jurisdiction || "unresolved"}:issuer:${issuer || "unresolved"}:${assignmentNamespace}`,
    formalIdentifier && formalNamespace
      ? `formal:${formalIdentifier}:${jurisdiction}:${formalNamespace}:${assignmentNamespace}`
      : null,
    stableLocator
      ? `locator:${stableLocator}:jurisdiction:${jurisdiction || "unresolved"}:formal:${formalIdentifier || "unresolved"}:issuer:${issuer || "unresolved"}:${assignmentNamespace}`
      : null,
    !formalIdentifier && (issuer || treatmentAssignment)
      ? `identity:${normalizedText(record.canonicalIdentity)}:${jurisdiction}:issuer:${issuer || "unresolved"}:${assignmentNamespace}`
      : null,
    semanticEventKey
      ? `semantic-event:${semanticEventKey}:jurisdiction:${jurisdiction || "unresolved"}:formal:${formalIdentifier || "unresolved"}:issuer:${issuer || "unresolved"}:${assignmentNamespace}`
      : null,
    !formalIdentifier && !issuer && !treatmentAssignment &&
        !semanticEventKey && !stableLocator
      ? `sparse-identity:${normalizedText(sourceId)}:${normalizedText(record.canonicalIdentity)}:${jurisdiction || "unresolved"}`
      : null,
  ].filter((value): value is string => Boolean(value));
}

function disposition(
  role: Screen02SearchSourceRole,
  directSupport: boolean,
): Screen02SearchEvidenceDisposition {
  if (role === "official") return "authoritative";
  return directSupport ? "directly-supported" : "lead-only";
}

function manifestSupplement(
  retrievedAt: string,
  executions: readonly QueryExecution<unknown>[],
  telemetry: readonly Screen02SearchQueryTelemetry[],
  comparison: Screen02SearchComparisonTelemetry,
): Screen02SearchManifestSupplement {
  const telemetryById = new Map(telemetry.map((item) => [item.queryId, item]));
  const queryMatrix: Screen02SearchQueryRecord[] = executions.map((execution) => ({
    id: execution.variant.id,
    query: execution.variant.query,
    purpose: `${execution.variant.purpose} Stage: ${execution.variant.stage}. Source role: ${execution.variant.sourceRole}.`,
    returnedRecordIds: execution.records.map((record) => record.recordId),
  }));
  const sourceIds = [...new Set(executions.map((execution) => execution.variant.sourceId))];
  const channels: Screen02SearchChannelRecord[] = sourceIds.map((sourceId) => {
    const sourceExecutions = executions.filter(
      (execution) => execution.variant.sourceId === sourceId,
    );
    const sourceTelemetry = sourceExecutions
      .map((execution) => telemetryById.get(execution.variant.id))
      .filter((item): item is Screen02SearchQueryTelemetry => Boolean(item));
    const role = sourceExecutions[0]?.variant.sourceRole ?? "context";
    const successes = sourceExecutions.filter(
      (execution) => execution.status === "searched",
    ).length;
    const timeoutCount = sourceTelemetry.filter(
      (item) => item.failureKind === "timeout",
    ).length;
    const failureKinds = [...new Set(
      sourceTelemetry
        .map((item) => item.failureKind)
        .filter((kind) => kind !== "none"),
    )];
    return {
      channel: `Screen 2 ${sourceId} · ${role}`,
      status: successes > 0 ? "searched" : "failed",
      note: [
        `${sourceExecutions.length} bounded query ${sourceExecutions.length === 1 ? "was" : "were"} attempted; ${successes} completed.`,
        `${sourceTelemetry.reduce((sum, item) => sum + item.recordsAccepted, 0)} records were accepted after expansion guards.`,
        `Funnel exclusions: invalid ${sourceTelemetry.reduce((sum, item) => sum + item.invalidRecordsDropped, 0)}, per-query overflow ${sourceTelemetry.reduce((sum, item) => sum + item.overBudgetRecordsDropped, 0)}, identity ${sourceTelemetry.reduce((sum, item) => sum + item.identityFilterDrops, 0)}, issuer-jurisdiction ${sourceTelemetry.reduce((sum, item) => sum + item.jurisdictionFilterDrops, 0)}, duplicate ${sourceTelemetry.reduce((sum, item) => sum + item.duplicateDrops, 0)}, merged-cap ${sourceTelemetry.reduce((sum, item) => sum + item.mergedCapDrops, 0)}.`,
        timeoutCount > 0
          ? `Timeout diagnostics: ${timeoutCount} query ${timeoutCount === 1 ? "timed out" : "queries timed out"}.`
          : failureKinds.length > 0
            ? `Failure diagnostics: ${failureKinds.join(", ")}.`
            : "Timeout diagnostics: none.",
        role === "official"
          ? "Existing official connector authority was preserved."
          : "This source remains lead-only unless a returned record has direct support.",
      ].join(" "),
      retrievedAt,
    };
  });
  const recordsReturned = telemetry.reduce(
    (sum, item) => sum + item.recordsReturned,
    0,
  );
  const exclusions = telemetry.reduce(
    (sum, item) =>
      sum + item.invalidRecordsDropped + item.overBudgetRecordsDropped +
      item.identityFilterDrops + item.jurisdictionFilterDrops +
      item.duplicateDrops + item.mergedCapDrops,
    0,
  );
  channels.push({
    channel: "Screen 2 exact retrieval funnel and stopping diagnostics",
    status: telemetry.some((item) => item.status === "failed")
      ? "failed"
      : "searched",
    note: `Planned ${telemetry.length} distinct source-query requests across at most ${SCREEN_02_SEARCH_EXPANSION_BUDGETS.maximumRounds} rounds; completed ${telemetry.filter((item) => item.status === "searched").length}, failed ${telemetry.filter((item) => item.status === "failed").length}, returned ${recordsReturned}, retained ${comparison.selectedRecords} candidate records, and recorded ${exclusions} explicit funnel exclusions. Raw target ${SCREEN_02_SEARCH_EXPANSION_BUDGETS.rawCandidateTarget}; raw maximum ${SCREEN_02_SEARCH_EXPANSION_BUDGETS.maximumMergedRecords}; qualified target ${SCREEN_02_SEARCH_EXPANSION_BUDGETS.qualifiedCandidateTarget}. Stop: ${comparison.selectedRecords >= SCREEN_02_SEARCH_EXPANSION_BUDGETS.rawCandidateTarget ? "raw target reached" : telemetry.some((item) => item.failureKind === "timeout") ? "bounded timeout encountered" : "declared query routes exhausted"}. outcomeValuesInspected=false.`,
    retrievedAt,
  });
  channels.push({
    channel: `Screen 2 baseline-versus-expanded comparison · ${SCREEN_02_SEARCH_EXPANSION_VERSION}`,
    status:
      comparison.baseline.queriesFailed + comparison.expanded.queriesFailed > 0
        ? "failed"
        : "searched",
    note: `Baseline selected ${comparison.baseline.uniqueRecordsSelected}; candidate-eligible expansion added ${comparison.expanded.recordsAccepted}; context leads ${comparison.expanded.contextLeadCount}; selected candidate records ${comparison.selectedRecords}. Baseline preserved: ${comparison.baselineRecordsPreserved}. Zero-result recovery: ${comparison.zeroResultRecovered ? "yes" : "no"}. Expansion fault fallback: ${comparison.expansionFaultFallbackUsed ? "yes" : "no"}. outcomeValuesInspected=false.`,
    retrievedAt,
  });
  return { queryMatrix, channels };
}

function requireExecutablePlan(plan: Screen02SearchResearchPlan) {
  const budgets = SCREEN_02_SEARCH_EXPANSION_BUDGETS;
  const allQueries = [...plan.baseline, ...plan.expanded];
  const sourceIds = new Set(allQueries.map((query) => query.sourceId));
  const queryIds = allQueries.map((query) => query.id);
  const roles = new Set<Screen02SearchSourceRole>([
    "official",
    "supplemental",
    "context",
  ]);
  if (
    plan.baseline.length > budgets.maximumBaselineQueries ||
    allQueries.length < 1 ||
    plan.expanded.length > budgets.maximumExpandedQueries ||
    allQueries.length > budgets.maximumTotalQueries ||
    sourceIds.size < 1 ||
    sourceIds.size > budgets.maximumSources ||
    new Set(queryIds).size !== queryIds.length ||
    plan.baseline.some((query) => query.stage !== "baseline") ||
    plan.expanded.some((query) => query.stage === "baseline") ||
    allQueries.some(
      (query) =>
        !cleanText(query.id, 200) ||
        !cleanText(query.sourceId, 100) ||
        !cleanText(query.query) ||
        !roles.has(query.sourceRole) ||
        !Number.isSafeInteger(query.resultLimit) ||
        query.resultLimit < 1 ||
        query.resultLimit > budgets.maximumResultsPerQuery,
    )
  ) {
    throw new Error("Screen 2 search-expansion plan violates a fixed query budget or shape invariant.");
  }
  if (
    plan.budgets.baselineQueries !== plan.baseline.length ||
    plan.budgets.expandedQueries !== plan.expanded.length ||
    plan.budgets.totalQueries !== allQueries.length ||
    !Number.isSafeInteger(plan.budgets.concurrentQueries) ||
    plan.budgets.concurrentQueries < 1 ||
    plan.budgets.concurrentQueries > budgets.maximumConcurrentQueries ||
    !Number.isSafeInteger(plan.budgets.maximumMergedRecords) ||
    plan.budgets.maximumMergedRecords < 1 ||
    plan.budgets.maximumMergedRecords > budgets.maximumMergedRecords ||
    plan.budgets.rawCandidateTarget !== budgets.rawCandidateTarget ||
    plan.budgets.qualifiedCandidateTarget !== budgets.qualifiedCandidateTarget ||
    plan.budgets.maximumRounds !== budgets.maximumRounds ||
    plan.mergePolicy !== "baseline-first-additive" ||
    plan.fallbackPolicy !==
      "preserve-baseline-on-expansion-empty-or-fault" ||
    plan.sourcePolicy !==
      "official-authoritative-supplemental-lead-unless-direct"
  ) {
    throw new Error("Screen 2 search-expansion plan violates a fixed execution invariant.");
  }
  if (
    plan.mode === "audit" &&
    (!plan.filters.identity.required || plan.filters.identity.terms.length < 1)
  ) {
    throw new Error("Audit search expansion requires a fixed identity filter.");
  }
}

export async function executeScreen02SearchExpansion<Value>(input: {
  plan: Screen02SearchResearchPlan;
  retrievedAt: string;
  execute: (
    query: Screen02SearchQueryVariant,
    options: { signal: AbortSignal },
  ) => Promise<readonly Screen02SearchRecordInput<Value>[]>;
  deadlineMs?: number;
  signal?: AbortSignal;
}): Promise<Screen02SearchExpansionResult<Value>> {
  if (input.plan.version !== SCREEN_02_SEARCH_EXPANSION_VERSION) {
    throw new Error("Unsupported Screen 2 search-expansion plan version.");
  }
  requireExecutablePlan(input.plan);
  const retrievedAt = cleanText(input.retrievedAt, 100);
  if (!retrievedAt) throw new Error("Search expansion requires a retrieval time.");
  if (typeof input.execute !== "function") {
    throw new Error("Search expansion requires an injected query runner.");
  }

  const deadlineMs =
    input.deadlineMs ?? SCREEN_02_SEARCH_EXPANSION_DEADLINE_MS;
  if (
    !Number.isSafeInteger(deadlineMs) || deadlineMs < 1 ||
    deadlineMs > SCREEN_02_SEARCH_EXPANSION_DEADLINE_MS
  ) {
    throw new Error(
      `deadlineMs must be an integer from 1 through ${SCREEN_02_SEARCH_EXPANSION_DEADLINE_MS}.`,
    );
  }
  const controller = new AbortController();
  const upstreamAbort = () => controller.abort(
    input.signal?.reason ?? new DOMException("Search expansion aborted", "AbortError"),
  );
  if (input.signal?.aborted) upstreamAbort();
  else input.signal?.addEventListener("abort", upstreamAbort, { once: true });
  const deadlineTimer = setTimeout(
    () => controller.abort(
      new DOMException("Search expansion total deadline reached", "TimeoutError"),
    ),
    deadlineMs,
  );
  let baselineExecutions: QueryExecution<Value>[];
  let expandedExecutions: QueryExecution<Value>[];
  try {
    baselineExecutions = await executeQueries(
      input.plan.baseline,
      input.plan.budgets.concurrentQueries,
      input.execute,
      controller.signal,
    );
    expandedExecutions = await executeQueries(
      input.plan.expanded,
      input.plan.budgets.concurrentQueries,
      input.execute,
      controller.signal,
    );
  } finally {
    clearTimeout(deadlineTimer);
    input.signal?.removeEventListener("abort", upstreamAbort);
  }
  const selected: Screen02SearchSelectedRecord<Value>[] = [];
  const seenKeys = new Set<string>();
  const telemetryById = new Map<string, Screen02SearchQueryTelemetry>();
  const initializeTelemetry = (execution: QueryExecution<Value>) => {
    telemetryById.set(execution.variant.id, {
      queryId: execution.variant.id,
      sourceId: execution.variant.sourceId,
      sourceRole: execution.variant.sourceRole,
      stage: execution.variant.stage,
      status: execution.status,
      recordsReturned: execution.recordsReturned,
      recordsWithinBudget: 0,
      recordsAccepted: 0,
      invalidRecordsDropped: execution.invalidRecordsDropped,
      overBudgetRecordsDropped: execution.overBudgetRecordsDropped,
      identityFilterDrops: 0,
      jurisdictionFilterDrops: 0,
      duplicateDrops: 0,
      mergedCapDrops: 0,
      failureKind: execution.failureKind,
      error: execution.error,
    });
  };
  baselineExecutions.forEach(initializeTelemetry);
  expandedExecutions.forEach(initializeTelemetry);

  const addRecord = (
    execution: QueryExecution<Value>,
    record: Screen02SearchRecordInput<Value>,
  ) => {
    const telemetry = telemetryById.get(execution.variant.id)!;
    if (
      input.plan.filters.identity.required &&
      !identityMatches(record, input.plan.filters.identity.terms)
    ) {
      telemetry.identityFilterDrops += 1;
      return;
    }
    if (
      execution.variant.sourceRole !== "context" &&
      input.plan.filters.jurisdiction.required &&
      !jurisdictionMatches(record, input.plan.filters.jurisdiction.allowed)
    ) {
      telemetry.jurisdictionFilterDrops += 1;
      return;
    }
    const keys = recordKeys(record, execution.variant.sourceId);
    if (keys.some((key) => seenKeys.has(key))) {
      telemetry.duplicateDrops += 1;
      return;
    }
    if (telemetry.recordsWithinBudget >= execution.variant.resultLimit) {
      telemetry.overBudgetRecordsDropped += 1;
      return;
    }
    telemetry.recordsWithinBudget += 1;
    if (selected.length >= input.plan.budgets.maximumMergedRecords) {
      telemetry.mergedCapDrops += 1;
      return;
    }
    keys.forEach((key) => seenKeys.add(key));
    selected.push({
      ...record,
      identityAliases: record.identityAliases
        ? [...record.identityAliases]
        : undefined,
      sourceId: execution.variant.sourceId,
      sourceRole: execution.variant.sourceRole,
      firstSeenStage: execution.variant.stage,
      queryId: execution.variant.id,
      disposition: disposition(
        execution.variant.sourceRole,
        record.directSupport,
      ),
    });
    telemetry.recordsAccepted += 1;
  };

  const addExecutionsFairly = (
    executions: readonly QueryExecution<Value>[],
  ) => {
    const sourceOrder = [...new Set(
      executions.map((execution) => execution.variant.sourceId),
    )];
    const sourceQueues = sourceOrder.map((sourceId) => {
      const sourceExecutions = executions.filter(
        (execution) => execution.variant.sourceId === sourceId,
      );
      const queue: Array<{
        execution: QueryExecution<Value>;
        record: Screen02SearchRecordInput<Value>;
      }> = [];
      const maximumRecords = Math.max(
        0,
        ...sourceExecutions.map((execution) => execution.records.length),
      );
      for (let recordIndex = 0; recordIndex < maximumRecords; recordIndex += 1) {
        for (const execution of sourceExecutions) {
          const record = execution.records[recordIndex];
          if (record) queue.push({ execution, record });
        }
      }
      return queue;
    });
    const maximumQueueLength = Math.max(
      0,
      ...sourceQueues.map((queue) => queue.length),
    );
    for (let queueIndex = 0; queueIndex < maximumQueueLength; queueIndex += 1) {
      for (const queue of sourceQueues) {
        const item = queue[queueIndex];
        if (item) addRecord(item.execution, item.record);
      }
    }
  };

  addExecutionsFairly(baselineExecutions);
  const baselineSelectedCount = selected.length;
  addExecutionsFairly(expandedExecutions);

  if (baselineSelectedCount > 0 && selected.length < baselineSelectedCount) {
    throw new Error("Search expansion violated baseline-first preservation.");
  }
  const queryTelemetry = [
    ...input.plan.baseline,
    ...input.plan.expanded,
  ].map((query) => telemetryById.get(query.id)!);
  const baselineTelemetry = queryTelemetry.filter(
    (item) => item.stage === "baseline",
  );
  const expandedTelemetry = queryTelemetry.filter(
    (item) => item.stage !== "baseline",
  );
  const expandedAccepted = expandedTelemetry
    .filter((item) => item.sourceRole !== "context")
    .reduce(
    (sum, item) => sum + item.recordsAccepted,
    0,
  );
  const contextLeadCount = expandedTelemetry
    .filter((item) => item.sourceRole === "context")
    .reduce((sum, item) => sum + item.recordsAccepted, 0);
  const selectedCandidateCount = selected.filter(
    (record) => record.sourceRole !== "context",
  ).length;
  const comparison: Screen02SearchComparisonTelemetry = {
    version: SCREEN_02_SEARCH_EXPANSION_VERSION,
    mode: input.plan.mode,
    baseline: {
      queriesPlanned: baselineTelemetry.length,
      queriesSucceeded: baselineTelemetry.filter((item) => item.status === "searched").length,
      queriesFailed: baselineTelemetry.filter((item) => item.status === "failed").length,
      recordsReturned: baselineTelemetry.reduce(
        (sum, item) => sum + item.recordsReturned,
        0,
      ),
      uniqueRecordsSelected: baselineSelectedCount,
    },
    expanded: {
      queriesPlanned: expandedTelemetry.length,
      queriesSucceeded: expandedTelemetry.filter((item) => item.status === "searched").length,
      queriesFailed: expandedTelemetry.filter((item) => item.status === "failed").length,
      recordsReturned: expandedTelemetry.reduce(
        (sum, item) => sum + item.recordsReturned,
        0,
      ),
      recordsAccepted: expandedAccepted,
      contextLeadCount,
      identityFilterDrops: expandedTelemetry.reduce(
        (sum, item) => sum + item.identityFilterDrops,
        0,
      ),
      jurisdictionFilterDrops: expandedTelemetry.reduce(
        (sum, item) => sum + item.jurisdictionFilterDrops,
        0,
      ),
      duplicateDrops: expandedTelemetry.reduce(
        (sum, item) => sum + item.duplicateDrops,
        0,
      ),
    },
    selectedRecords: selectedCandidateCount,
    baselineRecordsPreserved: baselineSelectedCount,
    zeroResultRecovered:
      baselineSelectedCount === 0 && expandedAccepted > 0,
    expansionFaultFallbackUsed:
      baselineSelectedCount > 0 &&
      expandedTelemetry.some((item) => item.status === "failed"),
    selection:
      baselineSelectedCount > 0 && expandedAccepted > 0
        ? "baseline-plus-expanded"
        : baselineSelectedCount > 0
          ? "baseline-only"
          : expandedAccepted > 0
            ? "expanded-recovery"
            : "empty",
    outcomeValuesInspected: false,
  };

  return {
    plan: input.plan,
    records: selected,
    values: selected.map((record) => record.value),
    queryTelemetry,
    comparison,
    manifestSupplement: manifestSupplement(
      retrievedAt,
      [...baselineExecutions, ...expandedExecutions],
      queryTelemetry,
      comparison,
    ),
  };
}
