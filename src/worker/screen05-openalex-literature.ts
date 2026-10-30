import { readScreen02BoundedResponseText } from
  "./screen02-bounded-response";
import type { Screen02ConnectorFetch } from "./screen02-connectors";
import { sanitizeScreen5ProviderText } from "./screen05-provider-text";

export const OPENALEX_WORKS_API_ENDPOINT =
  "https://api.openalex.org/works" as const;

export const SIX_SCREEN_OPENALEX_LITERATURE_PROTOCOL_VERSION =
  "screen-05-openalex-literature-evidence-v4" as const;

export const SIX_SCREEN_OPENALEX_LITERATURE_BUDGETS = {
  maximumResults: 5,
  maximumResponseBytes: 192_000,
  defaultTimeoutMs: 18_000,
  maximumTimeoutMs: 20_000,
  maximumRequestUrlCharacters: 1_800,
  maximumQueryCharacters: 600,
} as const;

export type OpenAlexReportedLocation = {
  landingPageUrl: string | null;
  pdfUrl: string | null;
  sourceName: string | null;
  sourceType: string | null;
  version: string | null;
  license: string | null;
  isOpenAccess: boolean;
};

export type OpenAlexLiteratureMetadata = {
  providerNativeId: string;
  doi: string | null;
  title: string;
  authors: string[];
  publicationYear: number | null;
  publishedDate: string | null;
  publicationVenue: string | null;
  publisher: string;
  workType: string | null;
  language: string | null;
  stableLocator: string;
  isRetracted: boolean;
  reportedLocations: OpenAlexReportedLocation[];
  abstractText: string | null;
  abstractSource: "openalex_abstract_inverted_index" | null;
  contentUrls: {
    pdf: string | null;
    grobidXml: string | null;
  };
};

export type OpenAlexLiteratureFailureReason =
  | "none"
  | "aborted"
  | "timed_out"
  | "network_failure"
  | "http_failure"
  | "unsupported_content_type"
  | "response_too_large"
  | "malformed_json"
  | "invalid_response_schema";

export type OpenAlexLiteratureDiagnostics = {
  protocolVersion: typeof SIX_SCREEN_OPENALEX_LITERATURE_PROTOCOL_VERSION;
  endpoint: typeof OPENALEX_WORKS_API_ENDPOINT;
  requestUrl: string;
  status: "searched" | "failed";
  failureReason: OpenAlexLiteratureFailureReason;
  requestedResultLimit: number;
  recordsReceived: number;
  recordsAccepted: number;
  invalidRecordsDropped: number;
  duplicateRecordsDropped: number;
  overBudgetRecordsDropped: number;
  authentication: "server_bearer_header" | "anonymous";
  abstractFieldsSelected: true;
  abstractFieldsInspected: boolean;
  reportedLocationsFollowed: 0;
  fullTextLocationsFollowed: 0;
  citationNeighborhoodHops: 0;
};

export type OpenAlexLiteratureResult = {
  records: OpenAlexLiteratureMetadata[];
  diagnostics: OpenAlexLiteratureDiagnostics;
};

export type OpenAlexLiteratureInput = {
  fetch: Screen02ConnectorFetch;
  apiKey?: string;
  query: string;
  retrievedAt: string;
  resultLimit?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
};

type ValidatedInput = Required<Pick<
  OpenAlexLiteratureInput,
  "fetch" | "query" | "retrievedAt" | "resultLimit" | "timeoutMs"
>> & Pick<OpenAlexLiteratureInput, "signal"> & { apiKey: string | null };

class OpenAlexTimeoutError extends Error {}
class OpenAlexAbortError extends Error {}
class OpenAlexHttpError extends Error {}
class OpenAlexContentTypeError extends Error {}
class OpenAlexResponseSizeError extends Error {}
class OpenAlexJsonError extends Error {}
class OpenAlexSchemaError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, maximum: number) {
  return sanitizeScreen5ProviderText(value, maximum);
}

function boundedQuery(value: string) {
  const normalized = text(value, 4_000)
    ?.replace(/https?:\/\//giu, " ")
    .replace(/[^\p{L}\p{N}\p{M}\s'"()\-]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  if (!normalized) throw new Error("OpenAlex literature query is empty.");
  return normalized.slice(
    0,
    SIX_SCREEN_OPENALEX_LITERATURE_BUDGETS.maximumQueryCharacters,
  ).trim();
}

function validInstant(value: string) {
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) &&
    new Date(milliseconds).toISOString() === value;
}

function validateInput(input: OpenAlexLiteratureInput): ValidatedInput {
  if (typeof input.fetch !== "function") {
    throw new Error("OpenAlex literature discovery requires fetch.");
  }
  if (!validInstant(input.retrievedAt)) {
    throw new Error("OpenAlex literature retrievedAt must be canonical UTC.");
  }
  if (
    input.apiKey !== undefined &&
    (typeof input.apiKey !== "string" || !input.apiKey ||
      input.apiKey.length > 512 || /[\u0000-\u001f\u007f]/u.test(input.apiKey))
  ) throw new Error("OpenAlex literature discovery API key is malformed.");
  return {
    ...input,
    apiKey: input.apiKey ?? null,
    query: boundedQuery(input.query),
    resultLimit: Math.min(
      SIX_SCREEN_OPENALEX_LITERATURE_BUDGETS.maximumResults,
      Math.max(1, Math.floor(input.resultLimit ?? 5)),
    ),
    timeoutMs: Math.min(
      SIX_SCREEN_OPENALEX_LITERATURE_BUDGETS.maximumTimeoutMs,
      Math.max(1, Math.floor(
        input.timeoutMs ??
          SIX_SCREEN_OPENALEX_LITERATURE_BUDGETS.defaultTimeoutMs,
      )),
    ),
  };
}

export function buildOpenAlexLiteratureRequest(input: Readonly<{
  query: string;
  resultLimit: number;
}>) {
  const url = new URL(OPENALEX_WORKS_API_ENDPOINT);
  url.searchParams.set("search", boundedQuery(input.query));
  url.searchParams.set("per_page", String(Math.min(
    SIX_SCREEN_OPENALEX_LITERATURE_BUDGETS.maximumResults,
    Math.max(1, Math.floor(input.resultLimit)),
  )));
  url.searchParams.set("select", [
    "id",
    "doi",
    "display_name",
    "authorships",
    "publication_year",
    "publication_date",
    "primary_location",
    "best_oa_location",
    "type",
    "language",
    "is_retracted",
    "abstract_inverted_index",
    "content_urls",
  ].join(","));
  const requestUrl = url.toString();
  if (
    requestUrl.length >
      SIX_SCREEN_OPENALEX_LITERATURE_BUDGETS.maximumRequestUrlCharacters
  ) throw new Error("The OpenAlex literature request URL exceeded its cap.");
  return requestUrl;
}

function canonicalOpenAlexId(value: unknown) {
  const raw = text(value, 200);
  if (!raw) return null;
  const match = /^(?:https:\/\/openalex\.org\/)?(W\d+)$/iu.exec(raw);
  return match
    ? `https://openalex.org/${match[1]!.toLocaleUpperCase("en-US")}`
    : null;
}

function canonicalDoi(value: unknown) {
  const raw = text(value, 300);
  if (!raw) return null;
  const doi = raw
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//iu, "")
    .replace(/^doi:\s*/iu, "")
    .trim()
    .toLocaleLowerCase("en-US");
  return /^10\.\d{4,9}\/[\p{L}\p{N}._;()/:+\-]+$/iu.test(doi)
    ? doi
    : null;
}

function httpsLocator(value: unknown) {
  if (typeof value !== "string" || value.length > 2_048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if ([...url.searchParams.keys()].some((name) =>
      /(?:^|[_-])(?:api[_-]?key|key|token|auth|authorization|credential|signature|sig)(?:$|[_-])/iu
        .test(name) || /^x-amz-/iu.test(name)
    )) return null;
    url.hostname = url.hostname.toLocaleLowerCase("en-US");
    url.hash = "";
    if (url.port === "443") url.port = "";
    return url.toString();
  } catch {
    return null;
  }
}

function calendarDate(value: unknown) {
  const raw = text(value, 10);
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/u.test(raw)) return null;
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  return Number.isFinite(parsed.valueOf()) &&
      parsed.toISOString().slice(0, 10) === raw
    ? raw
    : null;
}

function publicationYear(value: unknown, date: string | null) {
  if (date) return Number(date.slice(0, 4));
  if (Number.isSafeInteger(value) && (value as number) >= 1000 &&
      (value as number) <= 9999) return value as number;
  return null;
}

function authors(value: unknown) {
  if (!Array.isArray(value)) return [];
  const names: string[] = [];
  for (const authorship of value.slice(0, 100)) {
    if (!isRecord(authorship) || !isRecord(authorship.author)) continue;
    const name = text(authorship.author.display_name, 300);
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

function reportedLocation(value: unknown): OpenAlexReportedLocation | null {
  if (!isRecord(value)) return null;
  const landingPageUrl = httpsLocator(value.landing_page_url);
  const pdfUrl = httpsLocator(value.pdf_url);
  if (!landingPageUrl && !pdfUrl) return null;
  const source = isRecord(value.source) ? value.source : null;
  return {
    landingPageUrl,
    pdfUrl,
    sourceName: text(source?.display_name, 500),
    sourceType: text(source?.type, 200),
    version: text(value.version, 100),
    license: text(value.license, 200),
    isOpenAccess: value.is_oa === true,
  };
}

function reportedLocations(record: Record<string, unknown>) {
  const locations: OpenAlexReportedLocation[] = [];
  for (const raw of [record.primary_location, record.best_oa_location]) {
    const location = reportedLocation(raw);
    if (!location) continue;
    const key = JSON.stringify(location);
    if (!locations.some((candidate) => JSON.stringify(candidate) === key)) {
      locations.push(location);
    }
  }
  return locations;
}

function primarySource(record: Record<string, unknown>) {
  const location = isRecord(record.primary_location)
    ? record.primary_location
    : null;
  return location && isRecord(location.source) ? location.source : null;
}

function reconstructedAbstract(value: unknown) {
  if (!isRecord(value)) return null;
  const positioned: Array<{ word: string; position: number }> = [];
  for (const [rawWord, rawPositions] of Object.entries(value)) {
    const word = text(rawWord, 200);
    if (!word || !Array.isArray(rawPositions)) continue;
    for (const rawPosition of rawPositions) {
      if (Number.isSafeInteger(rawPosition) && (rawPosition as number) >= 0 &&
          (rawPosition as number) <= 20_000) {
        positioned.push({ word, position: rawPosition as number });
      }
    }
  }
  if (!positioned.length || positioned.length > 5_000) return null;
  positioned.sort((left, right) => left.position - right.position ||
    left.word.localeCompare(right.word));
  const words: string[] = [];
  let expected = positioned[0]!.position;
  for (const item of positioned) {
    if (item.position < expected) continue;
    if (item.position > expected) words.push("[…]");
    words.push(item.word);
    expected = item.position + 1;
  }
  return text(words.join(" "), 12_000);
}

function contentUrls(value: unknown) {
  if (!isRecord(value)) return { pdf: null, grobidXml: null };
  return {
    pdf: httpsLocator(value.pdf),
    grobidXml: httpsLocator(value.grobid_xml),
  };
}

function parseWork(value: unknown): OpenAlexLiteratureMetadata | null {
  if (!isRecord(value)) return null;
  const providerNativeId = canonicalOpenAlexId(value.id);
  const title = text(value.display_name, 1_000);
  if (!providerNativeId || !title) return null;
  const publishedDate = calendarDate(value.publication_date);
  const source = primarySource(value);
  const abstractText = reconstructedAbstract(value.abstract_inverted_index);
  return {
    providerNativeId,
    doi: canonicalDoi(value.doi),
    title,
    authors: authors(value.authorships),
    publicationYear: publicationYear(value.publication_year, publishedDate),
    publishedDate,
    publicationVenue: text(source?.display_name, 1_000),
    publisher: text(source?.host_organization_name, 500) ??
      "OpenAlex indexed source",
    workType: text(value.type, 200),
    language: text(value.language, 50),
    stableLocator: providerNativeId,
    isRetracted: value.is_retracted === true,
    reportedLocations: reportedLocations(value),
    abstractText,
    abstractSource: abstractText
      ? "openalex_abstract_inverted_index" as const
      : null,
    contentUrls: contentUrls(value.content_urls),
  };
}

function titleKey(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function parsePayload(value: unknown, resultLimit: number) {
  if (!isRecord(value) || !isRecord(value.meta) || !Array.isArray(value.results)) {
    throw new OpenAlexSchemaError();
  }
  const records: OpenAlexLiteratureMetadata[] = [];
  const ids = new Set<string>();
  const dois = new Set<string>();
  const titles = new Set<string>();
  let invalidRecordsDropped = 0;
  let duplicateRecordsDropped = 0;
  for (const raw of value.results) {
    const record = parseWork(raw);
    if (!record) {
      invalidRecordsDropped += 1;
      continue;
    }
    const normalizedTitle = titleKey(record.title);
    if (
      ids.has(record.providerNativeId) ||
      (record.doi !== null && dois.has(record.doi)) ||
      titles.has(normalizedTitle)
    ) {
      duplicateRecordsDropped += 1;
      continue;
    }
    ids.add(record.providerNativeId);
    if (record.doi) dois.add(record.doi);
    titles.add(normalizedTitle);
    if (records.length < resultLimit) records.push(record);
  }
  return {
    records,
    recordsReceived: value.results.length,
    invalidRecordsDropped,
    duplicateRecordsDropped,
    overBudgetRecordsDropped: Math.max(
      0,
      value.results.length - invalidRecordsDropped -
        duplicateRecordsDropped - records.length,
    ),
  };
}

function failureReason(error: unknown): OpenAlexLiteratureFailureReason {
  if (error instanceof OpenAlexAbortError) return "aborted";
  if (error instanceof OpenAlexTimeoutError) return "timed_out";
  if (error instanceof OpenAlexHttpError) return "http_failure";
  if (error instanceof OpenAlexContentTypeError) return "unsupported_content_type";
  if (error instanceof OpenAlexResponseSizeError) return "response_too_large";
  if (error instanceof OpenAlexJsonError) return "malformed_json";
  if (error instanceof OpenAlexSchemaError) return "invalid_response_schema";
  return "network_failure";
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
    rejectCallerAbort?.(new OpenAlexAbortError());
  };
  if (callerAborted) throw new OpenAlexAbortError();
  input.signal?.addEventListener("abort", callerAbort, { once: true });
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new OpenAlexTimeoutError());
    }, input.timeoutMs);
  });
  const upstreamAbort = new Promise<never>((_resolve, reject) => {
    rejectCallerAbort = reject;
  });
  const request = (async () => {
    let response: Response;
    try {
      // OpenAlex's current authentication contract permits a Bearer header.
      // Keep the credential server-side and out of URLs, diagnostics, retained
      // source records, redirects, and provider response evidence.
      response = await input.fetch(requestUrl, {
        method: "GET",
        headers: {
          accept: "application/json",
          ...(input.apiKey
            ? { authorization: `Bearer ${input.apiKey}` }
            : {}),
        },
        redirect: "manual",
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (error) {
      if (timedOut) throw new OpenAlexTimeoutError();
      if (callerAborted) throw new OpenAlexAbortError();
      throw error;
    }
    if (!response.ok) throw new OpenAlexHttpError();
    const contentType = (response.headers.get("content-type") ?? "")
      .toLocaleLowerCase("en-US");
    if (contentType && !contentType.includes("json")) {
      throw new OpenAlexContentTypeError();
    }
    const contentLength = Number(response.headers.get("content-length"));
    if (
      Number.isFinite(contentLength) &&
      contentLength >
        SIX_SCREEN_OPENALEX_LITERATURE_BUDGETS.maximumResponseBytes
    ) throw new OpenAlexResponseSizeError();
    let body: string;
    try {
      body = await readScreen02BoundedResponseText(
        response,
        SIX_SCREEN_OPENALEX_LITERATURE_BUDGETS.maximumResponseBytes,
      );
    } catch {
      throw new OpenAlexResponseSizeError();
    }
    try {
      return JSON.parse(body) as unknown;
    } catch {
      throw new OpenAlexJsonError();
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

/** Executes exactly one bounded OpenAlex work search and follows no links. */
export async function discoverOpenAlexLiteratureMetadata(
  rawInput: OpenAlexLiteratureInput,
): Promise<OpenAlexLiteratureResult> {
  const input = validateInput(rawInput);
  const requestUrl = buildOpenAlexLiteratureRequest(input);
  const diagnostics: OpenAlexLiteratureDiagnostics = {
    protocolVersion: SIX_SCREEN_OPENALEX_LITERATURE_PROTOCOL_VERSION,
    endpoint: OPENALEX_WORKS_API_ENDPOINT,
    requestUrl,
    status: "failed",
    failureReason: "none",
    requestedResultLimit: input.resultLimit,
    recordsReceived: 0,
    recordsAccepted: 0,
    invalidRecordsDropped: 0,
    duplicateRecordsDropped: 0,
    overBudgetRecordsDropped: 0,
    authentication: input.apiKey ? "server_bearer_header" : "anonymous",
    abstractFieldsSelected: true,
    abstractFieldsInspected: false,
    reportedLocationsFollowed: 0,
    fullTextLocationsFollowed: 0,
    citationNeighborhoodHops: 0,
  };
  try {
    const payload = await fetchPayload(input, requestUrl);
    const parsed = parsePayload(payload, input.resultLimit);
    return {
      records: parsed.records,
      diagnostics: {
        ...diagnostics,
        status: "searched",
        recordsReceived: parsed.recordsReceived,
        recordsAccepted: parsed.records.length,
        invalidRecordsDropped: parsed.invalidRecordsDropped,
        duplicateRecordsDropped: parsed.duplicateRecordsDropped,
        overBudgetRecordsDropped: parsed.overBudgetRecordsDropped,
        abstractFieldsInspected: parsed.records.some(({ abstractText }) =>
          abstractText !== null),
      },
    };
  } catch (error) {
    return {
      records: [],
      diagnostics: {
        ...diagnostics,
        status: "failed",
        failureReason: failureReason(error),
      },
    };
  }
}
