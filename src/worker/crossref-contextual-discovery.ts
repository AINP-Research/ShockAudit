import {
  SCREEN_02_SOURCE_POLICY_VERSION,
  SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
  type Screen02FindProposal,
} from "../core/screen02-types";
import { readScreen02BoundedResponseText } from "./screen02-bounded-response";
import {
  CONTEXTUAL_DISCOVERY_CHANNEL,
  createGdeltContextSearchProvider,
} from "./contextual-discovery";
import type {
  Screen02ContextSearchLead,
  Screen02ContextSearchProvider,
  Screen02SearchExpansionStage,
} from "./screen02-search-expansion";

/**
 * Crossref is a research-metadata discovery lane. It is deliberately not an
 * event-evidence source: the Worker reads only selected work metadata, never
 * follows a work URL, and never consumes abstracts, citations, scores, or
 * outcome values.
 */
export const CROSSREF_WORKS_API_ENDPOINT =
  "https://api.crossref.org/v1/works" as const;
export const CROSSREF_CONTEXTUAL_DISCOVERY_PROTOCOL_VERSION =
  "crossref-contextual-discovery-v1" as const;
export const CROSSREF_CONTEXTUAL_DISCOVERY_CHANNEL =
  "Context to verify · contextual-secondary · Crossref works metadata" as const;

export const CROSSREF_CONTEXTUAL_DISCOVERY_BUDGETS = {
  maximumResults: 5,
  maximumQueryCharacters: 240,
  maximumQueryTerms: 16,
  maximumQueryTermCharacters: 40,
  maximumEncodedQueryBytes: 720,
  maximumRequestUrlCharacters: 1_500,
  maximumResponseBytes: 128_000,
  defaultTimeoutMs: 20_000,
  maximumTimeoutMs: 20_000,
} as const;

export type CrossrefContextualFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type CrossrefContextualLead = {
  id: string;
  doi: string | null;
  title: string;
  locator: string;
  publisher: string;
  publishedDate: string | null;
  sourceRole: "contextual-secondary";
  authorityTier: 6;
  evidenceBasis: "source-metadata";
};

export type CrossrefContextualFailureReason =
  | "none"
  | "aborted"
  | "timed-out"
  | "network-failure"
  | "http-failure"
  | "unsupported-content-type"
  | "response-too-large"
  | "malformed-json"
  | "invalid-response-schema";

export type CrossrefContextualDiscoveryDiagnostics = {
  protocolVersion: typeof CROSSREF_CONTEXTUAL_DISCOVERY_PROTOCOL_VERSION;
  endpoint: typeof CROSSREF_WORKS_API_ENDPOINT;
  requestUrl: string;
  status: "searched" | "failed";
  failureReason: CrossrefContextualFailureReason;
  requestedResultLimit: number;
  recordsReceived: number;
  recordsAccepted: number;
  invalidRecordsDropped: number;
  duplicateRecordsDropped: number;
  overBudgetRecordsDropped: number;
  workPagesFetched: 0;
  outcomeValuesInspected: false;
};

export type CrossrefContextualDiscoveryResult = {
  leads: CrossrefContextualLead[];
  diagnostics: CrossrefContextualDiscoveryDiagnostics;
};

export type CrossrefContextualDiscoveryInput = {
  fetch: CrossrefContextualFetch;
  query: string;
  retrievedAt: string;
  resultLimit?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
};

type ValidatedInput = Required<
  Pick<
    CrossrefContextualDiscoveryInput,
    "fetch" | "query" | "retrievedAt" | "resultLimit" | "timeoutMs"
  >
> & Pick<CrossrefContextualDiscoveryInput, "signal">;

class CrossrefTimeoutError extends Error {}
class CrossrefAbortError extends Error {}
class CrossrefHttpError extends Error {}
class CrossrefContentTypeError extends Error {}
class CrossrefResponseSizeError extends Error {}
class CrossrefJsonError extends Error {}
class CrossrefSchemaError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizedMetadataText(value: unknown, maximum: number) {
  if (typeof value !== "string" || value.length > maximum) return null;
  const normalized = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return normalized || null;
}

function validRetrievedAt(value: string) {
  return /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?Z$/.test(
    value,
  ) && Number.isFinite(Date.parse(value));
}

/** Strip all Crossref query syntax and retain only bounded literal terms. */
export function boundedCrossrefContextualQuery(value: string) {
  if (typeof value !== "string") {
    throw new Error("Crossref contextual discovery requires a query string.");
  }
  const terms = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .match(/[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu) ?? [];
  const byNormalized = new Map<string, string>();
  for (const rawTerm of terms) {
    const term = [...rawTerm]
      .slice(0, CROSSREF_CONTEXTUAL_DISCOVERY_BUDGETS.maximumQueryTermCharacters)
      .join("");
    if ([...term].length < 2) continue;
    const key = term.toLocaleLowerCase("en-US");
    if (!byNormalized.has(key)) byNormalized.set(key, term);
    if (
      byNormalized.size >=
        CROSSREF_CONTEXTUAL_DISCOVERY_BUDGETS.maximumQueryTerms
    ) break;
  }
  let query = [...byNormalized.values()].join(" ");
  query = [...query]
    .slice(0, CROSSREF_CONTEXTUAL_DISCOVERY_BUDGETS.maximumQueryCharacters)
    .join("")
    .trim();
  while (
    query &&
    new TextEncoder().encode(query).byteLength >
      CROSSREF_CONTEXTUAL_DISCOVERY_BUDGETS.maximumEncodedQueryBytes
  ) {
    query = [...query].slice(0, -1).join("").trim();
  }
  if (!query) {
    throw new Error(
      "Crossref contextual discovery requires at least one bounded term.",
    );
  }
  return query;
}

function validateInput(
  input: CrossrefContextualDiscoveryInput,
): ValidatedInput {
  if (typeof input.fetch !== "function") {
    throw new Error("Crossref contextual discovery requires fetch.");
  }
  if (!validRetrievedAt(input.retrievedAt)) {
    throw new Error("retrievedAt must be an ISO 8601 UTC timestamp.");
  }
  const resultLimit = Math.min(
    CROSSREF_CONTEXTUAL_DISCOVERY_BUDGETS.maximumResults,
    Math.max(1, Math.floor(input.resultLimit ?? 5)),
  );
  const timeoutMs = Math.min(
    CROSSREF_CONTEXTUAL_DISCOVERY_BUDGETS.maximumTimeoutMs,
    Math.max(1, Math.floor(
      input.timeoutMs ??
        CROSSREF_CONTEXTUAL_DISCOVERY_BUDGETS.defaultTimeoutMs,
    )),
  );
  return {
    ...input,
    query: boundedCrossrefContextualQuery(input.query),
    resultLimit,
    timeoutMs,
  };
}

export function buildCrossrefContextualDiscoveryRequest(input: Readonly<{
  query: string;
  resultLimit: number;
}>) {
  const url = new URL(CROSSREF_WORKS_API_ENDPOINT);
  url.searchParams.set("query.title", input.query);
  url.searchParams.set("rows", String(input.resultLimit));
  // Select only fields used by this metadata lane. In particular, abstract,
  // score, reference counts, and subjects cannot enter the response contract.
  url.searchParams.set(
    "select",
    "DOI,title,publisher,published-print,published-online,published,URL",
  );
  const requestUrl = url.toString();
  if (
    requestUrl.length >
    CROSSREF_CONTEXTUAL_DISCOVERY_BUDGETS.maximumRequestUrlCharacters
  ) {
    throw new Error("The Crossref contextual request URL exceeded its cap.");
  }
  return requestUrl;
}

function canonicalDoi(value: unknown) {
  const raw = normalizedMetadataText(value, 300);
  if (!raw) return null;
  const withoutLocator = raw
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//iu, "")
    .replace(/^doi:\s*/iu, "")
    .trim()
    .toLocaleLowerCase("en-US");
  return /^10\.\d{4,9}\/[\p{L}\p{N}._;()/:+\-]+$/iu.test(withoutLocator)
    ? withoutLocator
    : null;
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

function calendarDate(parts: unknown) {
  if (!isRecord(parts) || !Array.isArray(parts["date-parts"])) return null;
  const first = parts["date-parts"][0];
  if (!Array.isArray(first) || first.length < 1) return null;
  const year = first[0];
  const month = first[1] ?? 1;
  const day = first[2] ?? 1;
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    (year as number) < 1000 ||
    (year as number) > 9999 ||
    (month as number) < 1 ||
    (month as number) > 12 ||
    (day as number) < 1 ||
    (day as number) > 31
  ) return null;
  const date = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(parsed.valueOf()) &&
      parsed.toISOString().slice(0, 10) === date
    ? date
    : null;
}

function publicationDate(record: Record<string, unknown>) {
  return calendarDate(record["published-print"]) ??
    calendarDate(record["published-online"]) ??
    calendarDate(record.published);
}

function firstTitle(value: unknown) {
  if (!Array.isArray(value)) return null;
  for (const item of value) {
    const title = normalizedMetadataText(item, 500);
    if (title) return title;
  }
  return null;
}

function stableFingerprint(value: string) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(16).padStart(16, "0");
}

function parseWork(value: unknown): CrossrefContextualLead | null {
  if (!isRecord(value)) return null;
  const title = firstTitle(value.title);
  if (!title) return null;
  const doi = canonicalDoi(value.DOI);
  const locator = doi
    ? `https://doi.org/${doi}`
    : canonicalHttpsLocator(value.URL);
  if (!locator) return null;
  return {
    id: `crossref-context-${stableFingerprint(doi ?? `${title}|${locator}`)}`,
    doi,
    title,
    locator,
    publisher:
      normalizedMetadataText(value.publisher, 240) ?? "Crossref member",
    publishedDate: publicationDate(value),
    sourceRole: "contextual-secondary",
    authorityTier: 6,
    evidenceBasis: "source-metadata",
  };
}

function parsePayload(value: unknown, resultLimit: number) {
  if (!isRecord(value) || !isRecord(value.message) ||
      !Array.isArray(value.message.items)) {
    throw new CrossrefSchemaError();
  }
  const leads: CrossrefContextualLead[] = [];
  const dois = new Set<string>();
  const titles = new Set<string>();
  let invalidRecordsDropped = 0;
  let duplicateRecordsDropped = 0;
  for (const raw of value.message.items) {
    const lead = parseWork(raw);
    if (!lead) {
      invalidRecordsDropped += 1;
      continue;
    }
    const titleKey = lead.title
      .normalize("NFKC")
      .toLocaleLowerCase("en-US")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
    if ((lead.doi && dois.has(lead.doi)) || titles.has(titleKey)) {
      duplicateRecordsDropped += 1;
      continue;
    }
    if (lead.doi) dois.add(lead.doi);
    titles.add(titleKey);
    if (leads.length < resultLimit) leads.push(lead);
  }
  return {
    leads,
    recordsReceived: value.message.items.length,
    invalidRecordsDropped,
    duplicateRecordsDropped,
    overBudgetRecordsDropped: Math.max(
      0,
      value.message.items.length - invalidRecordsDropped -
        duplicateRecordsDropped - leads.length,
    ),
  };
}

function failureReason(error: unknown): CrossrefContextualFailureReason {
  if (error instanceof CrossrefAbortError) return "aborted";
  if (error instanceof CrossrefTimeoutError) return "timed-out";
  if (error instanceof CrossrefHttpError) return "http-failure";
  if (error instanceof CrossrefContentTypeError) {
    return "unsupported-content-type";
  }
  if (error instanceof CrossrefResponseSizeError) return "response-too-large";
  if (error instanceof CrossrefJsonError) return "malformed-json";
  if (error instanceof CrossrefSchemaError) return "invalid-response-schema";
  return "network-failure";
}

async function fetchPayload(input: ValidatedInput, requestUrl: string) {
  const controller = new AbortController();
  let timedOut = false;
  let callerAborted = input.signal?.aborted ?? false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectCallerAbort: ((reason: Error) => void) | undefined;
  const callerAbort = () => {
    callerAborted = true;
    controller.abort();
    rejectCallerAbort?.(new CrossrefAbortError());
  };
  if (callerAborted) throw new CrossrefAbortError();
  input.signal?.addEventListener("abort", callerAbort, { once: true });
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new CrossrefTimeoutError());
    }, input.timeoutMs);
  });
  const upstreamAbort = new Promise<never>((_resolve, reject) => {
    rejectCallerAbort = reject;
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
      if (timedOut) throw new CrossrefTimeoutError();
      if (callerAborted) throw new CrossrefAbortError();
      throw error;
    }
    if (!response.ok) throw new CrossrefHttpError();
    const contentType = (response.headers.get("content-type") ?? "")
      .toLocaleLowerCase("en-US");
    if (contentType && !contentType.includes("json")) {
      throw new CrossrefContentTypeError();
    }
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) &&
        contentLength > CROSSREF_CONTEXTUAL_DISCOVERY_BUDGETS.maximumResponseBytes) {
      throw new CrossrefResponseSizeError();
    }
    let body: string;
    try {
      body = await readScreen02BoundedResponseText(
        response,
        CROSSREF_CONTEXTUAL_DISCOVERY_BUDGETS.maximumResponseBytes,
      );
    } catch {
      throw new CrossrefResponseSizeError();
    }
    try {
      return JSON.parse(body) as unknown;
    } catch {
      throw new CrossrefJsonError();
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

/** Execute exactly one bounded `/v1/works` request. */
export async function discoverCrossrefContextualLeads(
  rawInput: CrossrefContextualDiscoveryInput,
): Promise<CrossrefContextualDiscoveryResult> {
  const input = validateInput(rawInput);
  const requestUrl = buildCrossrefContextualDiscoveryRequest(input);
  const diagnostics: CrossrefContextualDiscoveryDiagnostics = {
    protocolVersion: CROSSREF_CONTEXTUAL_DISCOVERY_PROTOCOL_VERSION,
    endpoint: CROSSREF_WORKS_API_ENDPOINT,
    requestUrl,
    status: "failed",
    failureReason: "none",
    requestedResultLimit: input.resultLimit,
    recordsReceived: 0,
    recordsAccepted: 0,
    invalidRecordsDropped: 0,
    duplicateRecordsDropped: 0,
    overBudgetRecordsDropped: 0,
    workPagesFetched: 0,
    outcomeValuesInspected: false,
  };
  try {
    const payload = await fetchPayload(input, requestUrl);
    const parsed = parsePayload(payload, input.resultLimit);
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

function leadDescription(lead: CrossrefContextualLead) {
  const publication = lead.publishedDate
    ? ` with publication metadata dated ${lead.publishedDate}`
    : "";
  return `Crossref indexed a research work titled “${lead.title}”${publication}. This is research metadata only; the publication date is not an event date, and ShockAudit did not fetch or treat the work as event evidence.`;
}

export function crossrefLeadToScreen02ContextLead(input: Readonly<{
  lead: CrossrefContextualLead;
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
        "Crossref supplies bibliographic metadata only. Obtain and review an independent direct source before relying on this lead.",
      policyVersion: SCREEN_02_SOURCE_POLICY_VERSION,
    },
    channel: CROSSREF_CONTEXTUAL_DISCOVERY_CHANNEL,
    retrievedAt: input.retrievedAt,
  };
  const value: Screen02FindProposal = {
    id: lead.id,
    mode: "find",
    kind: "event",
    title: lead.title,
    description: leadDescription(lead),
    nativeIdentity: {
      // A work DOI identifies the publication, never the reported event.
      formalIdentifier: null,
      issuer: null,
      issuingJurisdiction: null,
      status: null,
    },
    event: {
      displayName: lead.title,
      eventDate: "Unknown — bibliographic publication timing is not event timing.",
      eventFamily: input.eventFamily,
      geographies: [],
      populations: [SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN],
    },
    origin: "unsupported-lead",
    provisionalDates: lead.publishedDate
      ? [`Research publication date only (not an event date): ${lead.publishedDate}`]
      : [],
    affectedPopulation: SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
    requiredVariables: [
      "Independent official source supporting the reported event",
      "Verified event identity and issuing jurisdiction",
      "Official event timeline and operative date",
    ],
    outcomeLink: {
      text:
        "No outcome pathway was inferred from bibliographic metadata. Outcome values were not inspected.",
      status: "system-template",
    },
    likelyServiceLevel: "event-reconnaissance",
    limitations: [
      "Context to verify only: this work record cannot confirm an event, identity, date, scope, coverage rule, or causal claim.",
      "No abstract, citation count, relevance score, full text, or outcome value was requested or retained.",
      `The lookup targeted the ${input.stage} discovery stage, but publication metadata does not prove that stage occurred.`,
    ],
    reasons: [
      "A bounded research-metadata search surfaced this possible lead for independent official-source follow-up.",
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

export function createCrossrefContextSearchProvider(
  fetch: CrossrefContextualFetch,
  options: Readonly<{ timeoutMs?: number; resultLimit?: number }> = {},
): Screen02ContextSearchProvider {
  return async (input) => {
    const result = await discoverCrossrefContextualLeads({
      fetch,
      query: input.identity?.canonicalName ?? input.query,
      retrievedAt: input.retrievedAt,
      resultLimit: Math.min(
        input.resultLimit,
        options.resultLimit ??
          CROSSREF_CONTEXTUAL_DISCOVERY_BUDGETS.maximumResults,
      ),
      timeoutMs: options.timeoutMs,
      signal: input.signal,
    });
    if (result.diagnostics.status === "failed") {
      throw new Error(
        `Crossref contextual discovery failed: ${result.diagnostics.failureReason}.`,
      );
    }
    return result.leads.map((lead) =>
      crossrefLeadToScreen02ContextLead({
        lead,
        eventFamily: input.eventFamily,
        retrievedAt: input.retrievedAt,
        stage: input.stage,
      })
    );
  };
}

export type Screen02ContextLeadLane = "research" | "reporting" | "other";

/**
 * The lane is fixed by the Worker-owned source channel, never by provider
 * prose or publisher metadata. Unknown injected providers retain the legacy
 * `other` treatment.
 */
export function screen02ContextLeadLane(
  lead: Pick<Screen02ContextSearchLead, "value">,
): Screen02ContextLeadLane {
  const channels = new Set(lead.value.sources.map((source) => source.channel));
  if (channels.has(CROSSREF_CONTEXTUAL_DISCOVERY_CHANNEL)) return "research";
  if (channels.has(CONTEXTUAL_DISCOVERY_CHANNEL)) return "reporting";
  return "other";
}

/**
 * Share the five visible contextual slots predictably: reserve up to three
 * for research metadata and up to two for reporting metadata, then use any
 * vacant slots from the remaining records. Unknown injected-provider leads
 * follow those two fixed lanes and cannot crowd either one out.
 */
export function selectScreen02ContextLeadSlots<
  Lead extends Pick<Screen02ContextSearchLead, "value">,
>(
  leads: readonly Lead[],
  maximum = 5,
) {
  const research = leads.filter(
    (lead) => screen02ContextLeadLane(lead) === "research",
  );
  const reporting = leads.filter(
    (lead) => screen02ContextLeadLane(lead) === "reporting",
  );
  const other = leads.filter(
    (lead) => screen02ContextLeadLane(lead) === "other",
  );
  const selected = [
    ...research.slice(0, 3),
    ...reporting.slice(0, 2),
  ];
  for (const lead of [
    ...research.slice(3),
    ...reporting.slice(2),
    ...other,
  ]) {
    if (selected.length >= maximum) break;
    selected.push(lead);
  }
  return selected.slice(0, maximum);
}

/**
 * Build the default credential-free context lane. Each invocation makes at
 * most one Crossref request and one GDELT request. Either source may fail
 * independently; only total failure rejects the guarded expansion.
 */
export function createResearchAndReportingContextSearchProvider(
  fetch: CrossrefContextualFetch,
): Screen02ContextSearchProvider {
  const research = createCrossrefContextSearchProvider(fetch);
  const reporting = createGdeltContextSearchProvider(fetch);
  return async (input) => {
    const [researchResult, reportingResult] = await Promise.allSettled([
      research(input),
      reporting(input),
    ]);
    const researchLeads = researchResult.status === "fulfilled"
      ? researchResult.value
      : [];
    const reportingLeads = reportingResult.status === "fulfilled"
      ? reportingResult.value
      : [];
    if (
      researchResult.status === "rejected" &&
      reportingResult.status === "rejected"
    ) {
      throw new Error(
        "Research and reporting contextual discovery both failed.",
      );
    }
    return selectScreen02ContextLeadSlots(
      [...researchLeads, ...reportingLeads],
      Math.min(5, input.resultLimit),
    );
  };
}
