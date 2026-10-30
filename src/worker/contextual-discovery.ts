import {
  SCREEN_02_SOURCE_POLICY_VERSION,
  SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
  type Screen02FindProposal,
} from "../core/screen02-types";
import type { Screen03EvidenceItem } from "../core/screen03-workflow";
import { readScreen02BoundedResponseText } from "./screen02-bounded-response";
import type {
  Screen02ContextSearchLead,
  Screen02ContextSearchProvider,
  Screen02SearchExpansionStage,
} from "./screen02-search-expansion";

/**
 * GDELT DOC 2.0 is an article-index discovery channel, not an evidence host.
 * ShockAudit reads only the bounded ArticleList JSON response and never
 * follows or fetches an article URL returned by the index.
 */
export const GDELT_DOC_API_ENDPOINT =
  "https://api.gdeltproject.org/api/v2/doc/doc" as const;
export const CONTEXTUAL_DISCOVERY_PROTOCOL_VERSION =
  "contextual-discovery-v1" as const;
export const CONTEXTUAL_DISCOVERY_SOURCE_ROLE =
  "contextual-secondary" as const;
export const CONTEXTUAL_DISCOVERY_CHANNEL =
  "Context to verify · contextual-secondary · GDELT DOC 2.0 metadata" as const;

export const CONTEXTUAL_DISCOVERY_BUDGETS = {
  maximumResults: 5,
  maximumQueryCharacters: 240,
  maximumQueryTerms: 16,
  maximumQueryTermCharacters: 40,
  maximumEncodedQueryBytes: 720,
  maximumRequestUrlCharacters: 1_500,
  maximumResponseBytes: 128_000,
  maximumSearchDays: 366,
  defaultTimeoutMs: 2_200,
  maximumTimeoutMs: 3_000,
} as const;

export type ContextualDiscoveryFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type GdeltContextualLead = {
  id: string;
  title: string;
  locator: string;
  publisher: string;
  publishedDate: string;
  language: string | null;
  sourceCountry: string | null;
  sourceRole: typeof CONTEXTUAL_DISCOVERY_SOURCE_ROLE;
  authorityTier: 6;
  evidenceBasis: "source-metadata";
};

export type ContextualDiscoveryFailureReason =
  | "none"
  | "date-window-outside-supported-range"
  | "aborted"
  | "timed-out"
  | "network-failure"
  | "http-failure"
  | "unsupported-content-type"
  | "response-too-large"
  | "malformed-json"
  | "invalid-response-schema";

export type GdeltContextualDiscoveryDiagnostics = {
  protocolVersion: typeof CONTEXTUAL_DISCOVERY_PROTOCOL_VERSION;
  endpoint: typeof GDELT_DOC_API_ENDPOINT;
  requestUrl: string | null;
  status: "searched" | "skipped" | "failed";
  failureReason: ContextualDiscoveryFailureReason;
  requestedResultLimit: number;
  recordsReceived: number;
  recordsAccepted: number;
  invalidRecordsDropped: number;
  duplicateRecordsDropped: number;
  overBudgetRecordsDropped: number;
  boundedStartDate: string | null;
  boundedEndDate: string | null;
  articlePagesFetched: 0;
  outcomeValuesInspected: false;
};

export type GdeltContextualDiscoveryResult = {
  leads: GdeltContextualLead[];
  diagnostics: GdeltContextualDiscoveryDiagnostics;
};

export type GdeltContextualDiscoveryInput = {
  fetch: ContextualDiscoveryFetch;
  query: string;
  startDate: string;
  endDate: string;
  retrievedAt: string;
  resultLimit?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
};

type ValidatedDiscoveryInput = {
  fetch: ContextualDiscoveryFetch;
  query: string;
  startDate: string;
  endDate: string;
  retrievedAt: string;
  resultLimit: number;
  timeoutMs: number;
  signal?: AbortSignal;
};

type BoundedDateWindow = {
  startDate: string;
  endDate: string;
};

class ContextualDiscoveryTimeoutError extends Error {
  constructor() {
    super("The contextual discovery request timed out.");
    this.name = "ContextualDiscoveryTimeoutError";
  }
}

class ContextualDiscoveryAbortError extends Error {
  constructor() {
    super("The contextual discovery request was aborted.");
    this.name = "ContextualDiscoveryAbortError";
  }
}

class ContextualDiscoveryHttpError extends Error {
  constructor() {
    super("The contextual discovery index returned a non-success response.");
    this.name = "ContextualDiscoveryHttpError";
  }
}

class ContextualDiscoveryContentTypeError extends Error {
  constructor() {
    super("The contextual discovery index returned an unsupported content type.");
    this.name = "ContextualDiscoveryContentTypeError";
  }
}

class ContextualDiscoveryResponseSizeError extends Error {
  constructor() {
    super("The contextual discovery response exceeded its byte budget.");
    this.name = "ContextualDiscoveryResponseSizeError";
  }
}

class ContextualDiscoveryJsonError extends Error {
  constructor() {
    super("The contextual discovery response was not valid JSON.");
    this.name = "ContextualDiscoveryJsonError";
  }
}

class ContextualDiscoverySchemaError extends Error {
  constructor() {
    super("The contextual discovery response did not match ArticleList JSON.");
    this.name = "ContextualDiscoverySchemaError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value;
}

function validRetrievedAt(value: string) {
  return /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?Z$/.test(
    value,
  ) && Number.isFinite(Date.parse(value));
}

function normalizedMetadataText(value: unknown, maximum: number) {
  if (typeof value !== "string" || value.length > maximum) return null;
  const normalized = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || null;
}

/**
 * Reduce a search request to literal Unicode word tokens. In particular,
 * result-index operators, URLs, quotation marks, and parentheses supplied by
 * upstream text cannot become GDELT query syntax.
 */
export function boundedContextualDiscoveryQuery(value: string) {
  if (typeof value !== "string") {
    throw new Error("Contextual discovery requires a query string.");
  }
  const raw = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim();
  if (!raw) throw new Error("Contextual discovery requires a nonempty query.");

  const terms = raw.match(/[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu) ?? [];
  const controlWords = new Set([
    "and",
    "or",
    "not",
    "near",
    "repeat",
    "theme",
    "tone",
    "domain",
    "domainis",
    "sourcelang",
    "sourcecountry",
    "imagetag",
    "imagewebtag",
  ]);
  const unique = new Map<string, string>();
  for (const rawTerm of terms) {
    const term = [...rawTerm]
      .slice(0, CONTEXTUAL_DISCOVERY_BUDGETS.maximumQueryTermCharacters)
      .join("");
    if ([...term].length < 2) continue;
    const key = term.toLocaleLowerCase("en-US");
    if (controlWords.has(key) || /^near\d+$/.test(key) || /^repeat\d+$/.test(key)) {
      continue;
    }
    if (!unique.has(key)) unique.set(key, term);
    if (unique.size >= CONTEXTUAL_DISCOVERY_BUDGETS.maximumQueryTerms) break;
  }

  let query = [...unique.values()].join(" ");
  query = [...query]
    .slice(0, CONTEXTUAL_DISCOVERY_BUDGETS.maximumQueryCharacters)
    .join("")
    .trim();
  while (
    query &&
    new TextEncoder().encode(query).byteLength >
      CONTEXTUAL_DISCOVERY_BUDGETS.maximumEncodedQueryBytes
  ) {
    query = [...query].slice(0, -1).join("").trim();
  }
  if (!query) {
    throw new Error("Contextual discovery requires at least one bounded term.");
  }
  return query;
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

function validateInput(
  input: GdeltContextualDiscoveryInput,
): ValidatedDiscoveryInput {
  if (typeof input.fetch !== "function") {
    throw new Error("Contextual discovery requires an injected fetch function.");
  }
  if (!validRetrievedAt(input.retrievedAt)) {
    throw new Error("retrievedAt must be an ISO 8601 UTC timestamp.");
  }
  if (
    !validCalendarDate(input.startDate) ||
    !validCalendarDate(input.endDate) ||
    input.startDate > input.endDate
  ) {
    throw new Error(
      "startDate and endDate must form a valid inclusive YYYY-MM-DD range.",
    );
  }
  return {
    ...input,
    query: boundedContextualDiscoveryQuery(input.query),
    resultLimit: boundedInteger(
      input.resultLimit,
      CONTEXTUAL_DISCOVERY_BUDGETS.maximumResults,
      CONTEXTUAL_DISCOVERY_BUDGETS.maximumResults,
      "resultLimit",
    ),
    timeoutMs: boundedInteger(
      input.timeoutMs,
      CONTEXTUAL_DISCOVERY_BUDGETS.defaultTimeoutMs,
      CONTEXTUAL_DISCOVERY_BUDGETS.maximumTimeoutMs,
      "timeoutMs",
    ),
  };
}

function boundedDateWindow(input: ValidatedDiscoveryInput): BoundedDateWindow | null {
  const retrievedDate = input.retrievedAt.slice(0, 10);
  const oldestSupported = new Date(
    Date.parse(`${retrievedDate}T00:00:00.000Z`) -
      CONTEXTUAL_DISCOVERY_BUDGETS.maximumSearchDays * 24 * 60 * 60 * 1_000,
  ).toISOString().slice(0, 10);
  const startDate = input.startDate < oldestSupported
    ? oldestSupported
    : input.startDate;
  const endDate = input.endDate > retrievedDate ? retrievedDate : input.endDate;
  return startDate <= endDate ? { startDate, endDate } : null;
}

function gdeltTimestamp(date: string, endOfDay: boolean) {
  return `${date.replaceAll("-", "")}${endOfDay ? "235959" : "000000"}`;
}

export function buildGdeltContextualDiscoveryRequest(input: Readonly<{
  query: string;
  startDate: string;
  endDate: string;
  resultLimit: number;
}>) {
  const url = new URL(GDELT_DOC_API_ENDPOINT);
  url.searchParams.set("query", input.query);
  url.searchParams.set("mode", "artlist");
  url.searchParams.set("format", "json");
  url.searchParams.set("sort", "datedesc");
  url.searchParams.set("maxrecords", String(input.resultLimit));
  url.searchParams.set("startdatetime", gdeltTimestamp(input.startDate, false));
  url.searchParams.set("enddatetime", gdeltTimestamp(input.endDate, true));
  const requestUrl = url.toString();
  if (
    requestUrl.length >
    CONTEXTUAL_DISCOVERY_BUDGETS.maximumRequestUrlCharacters
  ) {
    throw new Error("The contextual discovery request URL exceeded its cap.");
  }
  return requestUrl;
}

function baseDiagnostics(
  resultLimit: number,
  window: BoundedDateWindow | null,
): GdeltContextualDiscoveryDiagnostics {
  return {
    protocolVersion: CONTEXTUAL_DISCOVERY_PROTOCOL_VERSION,
    endpoint: GDELT_DOC_API_ENDPOINT,
    requestUrl: null,
    status: "failed",
    failureReason: "none",
    requestedResultLimit: resultLimit,
    recordsReceived: 0,
    recordsAccepted: 0,
    invalidRecordsDropped: 0,
    duplicateRecordsDropped: 0,
    overBudgetRecordsDropped: 0,
    boundedStartDate: window?.startDate ?? null,
    boundedEndDate: window?.endDate ?? null,
    articlePagesFetched: 0,
    outcomeValuesInspected: false,
  };
}

async function fetchGdeltJson(
  input: ValidatedDiscoveryInput,
  requestUrl: string,
) {
  const controller = new AbortController();
  let timedOut = false;
  let callerAborted = input.signal?.aborted ?? false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectOnCallerAbort: ((reason: Error) => void) | undefined;
  const callerAbort = () => {
    callerAborted = true;
    controller.abort();
    rejectOnCallerAbort?.(new ContextualDiscoveryAbortError());
  };
  if (callerAborted) throw new ContextualDiscoveryAbortError();
  input.signal?.addEventListener("abort", callerAbort, { once: true });

  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new ContextualDiscoveryTimeoutError());
    }, input.timeoutMs);
  });
  const upstreamAbort = new Promise<never>((_resolve, reject) => {
    rejectOnCallerAbort = reject;
  });
  const request = (async () => {
    let response: Response;
    try {
      response = await input.fetch(requestUrl, {
        method: "GET",
        headers: { accept: "application/json" },
        redirect: "manual",
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (error) {
      if (timedOut) throw new ContextualDiscoveryTimeoutError();
      if (callerAborted) throw new ContextualDiscoveryAbortError();
      throw error;
    }
    if (!response.ok) throw new ContextualDiscoveryHttpError();
    const contentType = (response.headers.get("content-type") ?? "")
      .toLocaleLowerCase("en-US");
    if (contentType && !contentType.includes("json")) {
      throw new ContextualDiscoveryContentTypeError();
    }
    const contentLength = Number(response.headers.get("content-length"));
    if (
      Number.isFinite(contentLength) &&
      contentLength > CONTEXTUAL_DISCOVERY_BUDGETS.maximumResponseBytes
    ) {
      throw new ContextualDiscoveryResponseSizeError();
    }
    let body: string;
    try {
      body = await readScreen02BoundedResponseText(
        response,
        CONTEXTUAL_DISCOVERY_BUDGETS.maximumResponseBytes,
      );
    } catch {
      throw new ContextualDiscoveryResponseSizeError();
    }
    try {
      return JSON.parse(body) as unknown;
    } catch {
      throw new ContextualDiscoveryJsonError();
    }
  })();

  try {
    return await Promise.race([request, timeout, upstreamAbort]);
  } finally {
    controller.abort();
    if (timer !== undefined) clearTimeout(timer);
    input.signal?.removeEventListener("abort", callerAbort);
  }
}

function failureReason(error: unknown): ContextualDiscoveryFailureReason {
  if (error instanceof ContextualDiscoveryAbortError) return "aborted";
  if (error instanceof ContextualDiscoveryTimeoutError) return "timed-out";
  if (error instanceof ContextualDiscoveryHttpError) return "http-failure";
  if (error instanceof ContextualDiscoveryContentTypeError) {
    return "unsupported-content-type";
  }
  if (error instanceof ContextualDiscoveryResponseSizeError) {
    return "response-too-large";
  }
  if (error instanceof ContextualDiscoveryJsonError) return "malformed-json";
  if (error instanceof ContextualDiscoverySchemaError) {
    return "invalid-response-schema";
  }
  return "network-failure";
}

function canonicalHttpsLocator(value: unknown) {
  if (typeof value !== "string" || value.length > 2_048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    url.hostname = url.hostname.toLocaleLowerCase("en-US");
    url.hash = "";
    if (url.port === "443") url.port = "";
    return url.toString();
  } catch {
    return null;
  }
}

function gdeltPublishedDate(value: unknown) {
  if (typeof value !== "string" || value.length > 40) return null;
  const compact = /^(\d{4})(\d{2})(\d{2})T\d{6}Z?$/.exec(value);
  const iso = /^(\d{4}-\d{2}-\d{2})T/.exec(value);
  const date = compact
    ? `${compact[1]}-${compact[2]}-${compact[3]}`
    : iso?.[1] ?? null;
  return date && validCalendarDate(date) ? date : null;
}

function stableFingerprint(value: string) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

function stableLeadId(locator: string) {
  return `gdelt-context-${stableFingerprint(locator).slice(-16)}`;
}

function parseArticle(
  value: unknown,
  window: BoundedDateWindow,
): GdeltContextualLead | null {
  if (!isRecord(value)) return null;
  const locator = canonicalHttpsLocator(value.url);
  const title = normalizedMetadataText(value.title, 500);
  const publishedDate = gdeltPublishedDate(value.seendate);
  if (
    !locator ||
    !title ||
    !publishedDate ||
    publishedDate < window.startDate ||
    publishedDate > window.endDate
  ) {
    return null;
  }
  const publisher = new URL(locator).hostname;
  return {
    id: stableLeadId(locator),
    title,
    locator,
    publisher,
    publishedDate,
    language: normalizedMetadataText(value.language, 80),
    sourceCountry: normalizedMetadataText(value.sourcecountry, 120),
    sourceRole: CONTEXTUAL_DISCOVERY_SOURCE_ROLE,
    authorityTier: 6,
    evidenceBasis: "source-metadata",
  };
}

function parseGdeltResponse(
  value: unknown,
  window: BoundedDateWindow,
  resultLimit: number,
) {
  if (!isRecord(value) || !Array.isArray(value.articles)) {
    throw new ContextualDiscoverySchemaError();
  }
  const leads: GdeltContextualLead[] = [];
  const locatorKeys = new Set<string>();
  const semanticKeys = new Set<string>();
  let invalidRecordsDropped = 0;
  let duplicateRecordsDropped = 0;
  for (const raw of value.articles) {
    const lead = parseArticle(raw, window);
    if (!lead) {
      invalidRecordsDropped += 1;
      continue;
    }
    const semanticKey = `${lead.publisher}|${lead.publishedDate}|${lead.title.toLocaleLowerCase("en-US")}`;
    if (locatorKeys.has(lead.locator) || semanticKeys.has(semanticKey)) {
      duplicateRecordsDropped += 1;
      continue;
    }
    locatorKeys.add(lead.locator);
    semanticKeys.add(semanticKey);
    if (leads.length < resultLimit) leads.push(lead);
  }
  return {
    leads,
    recordsReceived: value.articles.length,
    invalidRecordsDropped,
    duplicateRecordsDropped,
    overBudgetRecordsDropped: Math.max(
      0,
      value.articles.length -
        invalidRecordsDropped -
        duplicateRecordsDropped -
        leads.length,
    ),
  };
}

/**
 * Execute one bounded GDELT ArticleList lookup. All transport and response
 * failures return zero leads with machine-readable diagnostics; invalid caller
 * inputs throw before any network call.
 */
export async function discoverGdeltContextualLeads(
  rawInput: GdeltContextualDiscoveryInput,
): Promise<GdeltContextualDiscoveryResult> {
  const input = validateInput(rawInput);
  const window = boundedDateWindow(input);
  const diagnostics = baseDiagnostics(input.resultLimit, window);
  if (!window) {
    return {
      leads: [],
      diagnostics: {
        ...diagnostics,
        status: "skipped",
        failureReason: "date-window-outside-supported-range",
      },
    };
  }
  const requestUrl = buildGdeltContextualDiscoveryRequest({
    query: input.query,
    startDate: window.startDate,
    endDate: window.endDate,
    resultLimit: input.resultLimit,
  });
  diagnostics.requestUrl = requestUrl;

  try {
    const payload = await fetchGdeltJson(input, requestUrl);
    const parsed = parseGdeltResponse(payload, window, input.resultLimit);
    return {
      leads: parsed.leads,
      diagnostics: {
        ...diagnostics,
        status: "searched",
        recordsReceived: parsed.recordsReceived,
        recordsAccepted: parsed.leads.length,
        invalidRecordsDropped: parsed.invalidRecordsDropped,
        duplicateRecordsDropped: parsed.duplicateRecordsDropped,
        overBudgetRecordsDropped: parsed.overBudgetRecordsDropped,
      },
    };
  } catch (error) {
    return {
      leads: [],
      diagnostics: {
        ...diagnostics,
        status: "failed",
        failureReason: failureReason(error),
      },
    };
  }
}

function contextualLeadDescription(lead: GdeltContextualLead) {
  return `GDELT indexed a ${lead.publisher} article titled “${lead.title}” on ${lead.publishedDate}. This is contextual index metadata only; ShockAudit did not fetch the article or verify its claims.`;
}

/** Convert index metadata to the existing Screen 2 lead-only provider shape. */
export function gdeltLeadToScreen02ContextLead(input: Readonly<{
  lead: GdeltContextualLead;
  eventFamily: string;
  retrievedAt: string;
  stage: Exclude<Screen02SearchExpansionStage, "baseline">;
}>): Screen02ContextSearchLead {
  const { lead } = input;
  const source = {
    id: `source-${lead.id}`,
    title: lead.title,
    locator: lead.locator,
    publisher: lead.publisher,
    publishedDate: lead.publishedDate,
    authorityTier: 6 as const,
    authorityAssessment: {
      method: "unverified" as const,
      reason:
        "GDELT ArticleList supplies secondary index metadata only. Obtain and review a direct source before relying on this lead.",
      policyVersion: SCREEN_02_SOURCE_POLICY_VERSION,
    },
    channel: CONTEXTUAL_DISCOVERY_CHANNEL,
    retrievedAt: input.retrievedAt,
  };
  const value: Screen02FindProposal = {
    id: lead.id,
    mode: "find",
    kind: "event",
    title: lead.title,
    description: contextualLeadDescription(lead),
    nativeIdentity: {
      formalIdentifier: null,
      issuer: null,
      issuingJurisdiction: null,
      status: null,
    },
    event: {
      displayName: lead.title,
      eventDate: lead.publishedDate,
      eventFamily: input.eventFamily,
      geographies: [],
      populations: [SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN],
    },
    origin: "unsupported-lead",
    provisionalDates: [
      `Article publication date only (not a verified event date): ${lead.publishedDate}`,
    ],
    affectedPopulation: SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
    requiredVariables: [
      "Direct source supporting the reported event",
      "Verified event identity and issuing jurisdiction",
      "Official event timeline and operative date",
    ],
    outcomeLink: {
      text:
        "No outcome pathway was inferred from contextual article metadata. Outcome values were not inspected.",
      status: "system-template",
    },
    likelyServiceLevel: "event-reconnaissance",
    limitations: [
      "Context to verify only: this record cannot confirm an event, identity, date, coverage rule, or causal claim.",
      "ShockAudit did not fetch the linked article and retained no article body text.",
      `The lookup targeted the ${input.stage} discovery stage, but the article metadata does not prove that stage occurred.`,
    ],
    reasons: [
      "A bounded contextual index search surfaced this possible lead for researcher follow-up.",
      "The source role is fixed as contextual-secondary and authority is fixed at tier 6.",
    ],
    sources: [source],
  };
  return {
    recordId: lead.id,
    canonicalIdentity: lead.title,
    identityAliases: [],
    formalIdentifier: null,
    issuingJurisdiction: null,
    locator: lead.locator,
    value,
  };
}

/**
 * Build the trusted-host Screen 2 provider. One invocation performs at most
 * one fixed-endpoint request and returns at most five unverified leads.
 */
export function createGdeltContextSearchProvider(
  fetch: ContextualDiscoveryFetch,
  options: Readonly<{ timeoutMs?: number; resultLimit?: number }> = {},
): Screen02ContextSearchProvider {
  return async (input) => {
    const result = await discoverGdeltContextualLeads({
      fetch,
      // Audit and Screen 3 already know the event identity. Search that
      // bounded anchor instead of AND-ing every lifecycle planning synonym,
      // which would needlessly turn a useful context lookup into zero results.
      query: input.identity?.canonicalName ?? input.query,
      startDate: input.startDate,
      endDate: input.endDate,
      retrievedAt: input.retrievedAt,
      resultLimit: Math.min(
        input.resultLimit,
        options.resultLimit ?? CONTEXTUAL_DISCOVERY_BUDGETS.maximumResults,
      ),
      timeoutMs: options.timeoutMs,
      signal: input.signal,
    });
    if (result.diagnostics.status === "failed") {
      throw new Error(
        `Contextual discovery failed: ${result.diagnostics.failureReason}.`,
      );
    }
    return result.leads.map((lead) =>
      gdeltLeadToScreen02ContextLead({
        lead,
        eventFamily: input.eventFamily,
        retrievedAt: input.retrievedAt,
        stage: input.stage,
      }),
    );
  };
}

/**
 * Convert a GDELT lead for Screen 3 display. The sole passage is deliberately
 * `source-metadata`, which the Screen 3 core excludes from direct support,
 * synthesis input, focal-clock support, and event-card locking evidence.
 */
export function gdeltLeadToScreen03Evidence(
  lead: GdeltContextualLead,
  retrievedAt: string,
): Screen03EvidenceItem {
  if (!validRetrievedAt(retrievedAt)) {
    throw new Error("retrievedAt must be an ISO 8601 UTC timestamp.");
  }
  const passageText = contextualLeadDescription(lead);
  return {
    id: `screen03-${lead.id}`,
    sourceId: `source-${lead.id}`,
    title: lead.title,
    locator: lead.locator,
    publisher: lead.publisher,
    publishedDate: lead.publishedDate,
    retrievedAt,
    authorityTier: 6,
    channel: CONTEXTUAL_DISCOVERY_CHANNEL,
    contentFingerprint: stableFingerprint(
      JSON.stringify({
        title: lead.title,
        locator: lead.locator,
        publisher: lead.publisher,
        publishedDate: lead.publishedDate,
        language: lead.language,
        sourceCountry: lead.sourceCountry,
      }),
    ),
    language: lead.language ?? "Unknown",
    status: "retrieved",
    passages: [
      {
        id: `passage-${lead.id}`,
        number: 1,
        text: passageText,
        locator: lead.locator,
        basis: "source-metadata",
      },
    ],
  };
}
