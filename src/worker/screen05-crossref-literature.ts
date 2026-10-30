import { readScreen02BoundedResponseText } from
  "./screen02-bounded-response";
import {
  CROSSREF_WORKS_API_ENDPOINT,
  boundedCrossrefContextualQuery,
  type CrossrefContextualFetch,
} from "./crossref-contextual-discovery";
import { sanitizeScreen5ProviderText } from "./screen05-provider-text";

export const SIX_SCREEN_CROSSREF_LITERATURE_PROTOCOL_VERSION =
  "screen-05-crossref-literature-evidence-v2" as const;

export const SIX_SCREEN_CROSSREF_LITERATURE_BUDGETS = {
  maximumResults: 5,
  maximumResponseBytes: 192_000,
  defaultTimeoutMs: 18_000,
  maximumTimeoutMs: 20_000,
  maximumRequestUrlCharacters: 1_800,
} as const;

export type CrossrefLiteratureMetadata = {
  providerNativeId: string;
  doi: string | null;
  title: string;
  authors: string[];
  publicationYear: number | null;
  publishedDate: string | null;
  publicationVenue: string | null;
  publisher: string;
  workType: string | null;
  stableLocator: string;
  abstractText: string | null;
  abstractSource: "crossref_member_deposit" | null;
  updateRelations: Array<{
    relationType: string;
    relatedDoi: string | null;
    label: string | null;
  }>;
};

export type CrossrefLiteratureFailureReason =
  | "none"
  | "aborted"
  | "timed_out"
  | "network_failure"
  | "http_failure"
  | "unsupported_content_type"
  | "response_too_large"
  | "malformed_json"
  | "invalid_response_schema";

export type CrossrefLiteratureDiagnostics = {
  protocolVersion: typeof SIX_SCREEN_CROSSREF_LITERATURE_PROTOCOL_VERSION;
  endpoint: typeof CROSSREF_WORKS_API_ENDPOINT;
  requestUrl: string;
  status: "searched" | "failed";
  failureReason: CrossrefLiteratureFailureReason;
  requestedResultLimit: number;
  recordsReceived: number;
  recordsAccepted: number;
  invalidRecordsDropped: number;
  duplicateRecordsDropped: number;
  overBudgetRecordsDropped: number;
  abstractFieldsInspected: boolean;
  fullTextLocationsFollowed: 0;
  citationNeighborhoodHops: 0;
};

export type CrossrefLiteratureResult = {
  records: CrossrefLiteratureMetadata[];
  diagnostics: CrossrefLiteratureDiagnostics;
};

export type CrossrefLiteratureInput = {
  fetch: CrossrefContextualFetch;
  query: string;
  retrievedAt: string;
  resultLimit?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
};

type ValidatedInput = Required<Pick<
  CrossrefLiteratureInput,
  "fetch" | "query" | "retrievedAt" | "resultLimit" | "timeoutMs"
>> & Pick<CrossrefLiteratureInput, "signal">;

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

function text(value: unknown, maximum: number) {
  return sanitizeScreen5ProviderText(value, maximum);
}

function validInstant(value: string) {
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) &&
    new Date(milliseconds).toISOString() === value;
}

function validateInput(input: CrossrefLiteratureInput): ValidatedInput {
  if (typeof input.fetch !== "function") {
    throw new Error("Crossref literature discovery requires fetch.");
  }
  if (!validInstant(input.retrievedAt)) {
    throw new Error("Crossref literature retrievedAt must be canonical UTC.");
  }
  return {
    ...input,
    query: boundedCrossrefContextualQuery(input.query),
    resultLimit: Math.min(
      SIX_SCREEN_CROSSREF_LITERATURE_BUDGETS.maximumResults,
      Math.max(1, Math.floor(input.resultLimit ?? 5)),
    ),
    timeoutMs: Math.min(
      SIX_SCREEN_CROSSREF_LITERATURE_BUDGETS.maximumTimeoutMs,
      Math.max(1, Math.floor(
        input.timeoutMs ??
          SIX_SCREEN_CROSSREF_LITERATURE_BUDGETS.defaultTimeoutMs,
      )),
    ),
  };
}

export function buildCrossrefLiteratureRequest(input: Readonly<{
  query: string;
  resultLimit: number;
}>) {
  const url = new URL(CROSSREF_WORKS_API_ENDPOINT);
  url.searchParams.set("query.bibliographic", input.query);
  url.searchParams.set("rows", String(input.resultLimit));
  url.searchParams.set(
    "select",
    [
      "DOI",
      "title",
      "author",
      "publisher",
      "container-title",
      "published-print",
      "published-online",
      "published",
      "type",
      "URL",
      "update-to",
      "updated-by",
      "abstract",
    ].join(","),
  );
  const requestUrl = url.toString();
  if (
    requestUrl.length >
      SIX_SCREEN_CROSSREF_LITERATURE_BUDGETS.maximumRequestUrlCharacters
  ) throw new Error("The Crossref literature request URL exceeded its cap.");
  return requestUrl;
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
    url.hostname = url.hostname.toLocaleLowerCase("en-US");
    url.hash = "";
    if (url.port === "443") url.port = "";
    return url.toString();
  } catch {
    return null;
  }
}

function calendarDate(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value["date-parts"])) return null;
  const parts = value["date-parts"][0];
  if (!Array.isArray(parts) || parts.length < 1) return null;
  const year = parts[0];
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  if (
    !Number.isInteger(year) || !Number.isInteger(month) ||
    !Number.isInteger(day) || (year as number) < 1000 ||
    (year as number) > 9999 || (month as number) < 1 ||
    (month as number) > 12 || (day as number) < 1 ||
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

function firstArrayText(value: unknown, maximum: number) {
  if (!Array.isArray(value)) return null;
  for (const item of value) {
    const found = text(item, maximum);
    if (found) return found;
  }
  return null;
}

function authors(value: unknown) {
  if (!Array.isArray(value)) return [];
  const names: string[] = [];
  for (const item of value.slice(0, 100)) {
    if (!isRecord(item)) continue;
    const literal = text(item.name, 300);
    const given = text(item.given, 160);
    const family = text(item.family, 160);
    const name = literal ?? [given, family].filter(Boolean).join(" ").trim();
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

function updateRelations(record: Record<string, unknown>) {
  const relations: CrossrefLiteratureMetadata["updateRelations"] = [];
  for (const [field, prefix] of [
    ["update-to", "update_to"],
    ["updated-by", "updated_by"],
  ] as const) {
    const values = record[field];
    if (!Array.isArray(values)) continue;
    for (const value of values.slice(0, 20 - relations.length)) {
      if (!isRecord(value)) continue;
      const type = text(value.type, 120) ?? "unspecified";
      const relation = {
        relationType: `${prefix}:${type}`,
        relatedDoi: canonicalDoi(value.DOI),
        label: text(value.label, 500),
      };
      if (!relation.relatedDoi && !relation.label) continue;
      if (!relations.some((existing) =>
        existing.relationType === relation.relationType &&
        existing.relatedDoi === relation.relatedDoi &&
        existing.label === relation.label)) relations.push(relation);
    }
  }
  return relations;
}

function parseWork(value: unknown): CrossrefLiteratureMetadata | null {
  if (!isRecord(value)) return null;
  const title = firstArrayText(value.title, 1_000);
  if (!title) return null;
  const doi = canonicalDoi(value.DOI);
  const stableLocator = doi
    ? `https://doi.org/${doi}`
    : httpsLocator(value.URL);
  if (!stableLocator) return null;
  const publishedDate = publicationDate(value);
  const abstractText = text(value.abstract, 12_000);
  return {
    providerNativeId: doi ?? stableLocator,
    doi,
    title,
    authors: authors(value.author),
    publicationYear: publishedDate
      ? Number(publishedDate.slice(0, 4))
      : null,
    publishedDate,
    publicationVenue: firstArrayText(value["container-title"], 1_000),
    publisher: text(value.publisher, 500) ?? "Crossref member",
    workType: text(value.type, 200),
    stableLocator,
    abstractText,
    abstractSource: abstractText ? "crossref_member_deposit" : null,
    updateRelations: updateRelations(value),
  };
}

function titleKey(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function parsePayload(value: unknown, resultLimit: number) {
  if (!isRecord(value) || !isRecord(value.message) ||
      !Array.isArray(value.message.items)) {
    throw new CrossrefSchemaError();
  }
  const records: CrossrefLiteratureMetadata[] = [];
  const dois = new Set<string>();
  const titles = new Set<string>();
  let invalidRecordsDropped = 0;
  let duplicateRecordsDropped = 0;
  for (const raw of value.message.items) {
    const record = parseWork(raw);
    if (!record) {
      invalidRecordsDropped += 1;
      continue;
    }
    const normalizedTitle = titleKey(record.title);
    if ((record.doi && dois.has(record.doi)) || titles.has(normalizedTitle)) {
      duplicateRecordsDropped += 1;
      continue;
    }
    if (record.doi) dois.add(record.doi);
    titles.add(normalizedTitle);
    if (records.length < resultLimit) records.push(record);
  }
  return {
    records,
    recordsReceived: value.message.items.length,
    invalidRecordsDropped,
    duplicateRecordsDropped,
    overBudgetRecordsDropped: Math.max(
      0,
      value.message.items.length - invalidRecordsDropped -
        duplicateRecordsDropped - records.length,
    ),
  };
}

function failureReason(error: unknown): CrossrefLiteratureFailureReason {
  if (error instanceof CrossrefAbortError) return "aborted";
  if (error instanceof CrossrefTimeoutError) return "timed_out";
  if (error instanceof CrossrefHttpError) return "http_failure";
  if (error instanceof CrossrefContentTypeError) {
    return "unsupported_content_type";
  }
  if (error instanceof CrossrefResponseSizeError) return "response_too_large";
  if (error instanceof CrossrefJsonError) return "malformed_json";
  if (error instanceof CrossrefSchemaError) return "invalid_response_schema";
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
    if (
      Number.isFinite(contentLength) &&
      contentLength >
        SIX_SCREEN_CROSSREF_LITERATURE_BUDGETS.maximumResponseBytes
    ) throw new CrossrefResponseSizeError();
    let body: string;
    try {
      body = await readScreen02BoundedResponseText(
        response,
        SIX_SCREEN_CROSSREF_LITERATURE_BUDGETS.maximumResponseBytes,
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

/** Executes exactly one bounded Crossref metadata query and follows no links. */
export async function discoverCrossrefLiteratureMetadata(
  rawInput: CrossrefLiteratureInput,
): Promise<CrossrefLiteratureResult> {
  const input = validateInput(rawInput);
  const requestUrl = buildCrossrefLiteratureRequest(input);
  const diagnostics: CrossrefLiteratureDiagnostics = {
    protocolVersion: SIX_SCREEN_CROSSREF_LITERATURE_PROTOCOL_VERSION,
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
    abstractFieldsInspected: false,
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
