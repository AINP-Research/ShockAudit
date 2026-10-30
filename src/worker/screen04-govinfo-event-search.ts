import type { Screen02FindProposal } from "../core/screen02-types";
import {
  SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
} from "../core/screen02-types";
import { readScreen02BoundedResponseText } from "./screen02-bounded-response";
import type { Screen02ConnectorFetch } from "./screen02-connectors";
import {
  officialDocumentAccessChallenge,
  visibleOfficialDocumentText,
} from "./official-document-html";
import {
  SHOCKAUDIT_OFFICIAL_SOURCE_USER_AGENT,
} from "./screen02-secure-transport";

export const SCREEN04_GOVINFO_EVENT_SEARCH_VERSION =
  "screen04-govinfo-public-law-search-v2" as const;

const SEARCH_URL = "https://api.govinfo.gov/search";
export const SCREEN04_GOVINFO_SEARCH_PAGE_SIZE = 10;
export const SCREEN04_GOVINFO_MAX_INSPECTED_DOCUMENTS = 6;
export const SCREEN04_GOVINFO_MAX_SEARCH_PAGES = 2;
export const SCREEN04_GOVINFO_MAX_SEARCH_BYTES = 256 * 1024;
export const SCREEN04_GOVINFO_MAX_HTML_BYTES = 2 * 1024 * 1024;
const SEARCH_PAGE_SIZE = SCREEN04_GOVINFO_SEARCH_PAGE_SIZE;
const MAX_INSPECTED_DOCUMENTS = SCREEN04_GOVINFO_MAX_INSPECTED_DOCUMENTS;
const MAX_SEARCH_PAGES = SCREEN04_GOVINFO_MAX_SEARCH_PAGES;
const MAX_SEARCH_BYTES = SCREEN04_GOVINFO_MAX_SEARCH_BYTES;
const MAX_HTML_BYTES = SCREEN04_GOVINFO_MAX_HTML_BYTES;
const DEFAULT_TIMEOUT_MS = 12_000;

type DateFact = {
  role: "publication" | "enactment";
  date: string;
  sourceUrl: string;
  basis: "provider_metadata" | "inspected_original_html";
  inspectedPassage: string | null;
};

export type Screen04GovInfoInspectedDocument = {
  packageId: string;
  title: string;
  originalHtmlUrl: string;
  summaryUrl: string;
  dateFacts: DateFact[];
  inspectedExcerpt: string;
  retrievedAt: string;
};

export type Screen04GovInfoEventSearchResult = {
  status: "searched" | "not_configured" | "source_unavailable";
  /** Only packages whose original, identifier-bound HTML was inspected. */
  proposals: Screen02FindProposal[];
  inspectedDocuments: Screen04GovInfoInspectedDocument[];
  diagnostics: {
    provider: "govinfo";
    adapterVersion: typeof SCREEN04_GOVINFO_EVENT_SEARCH_VERSION;
    requestUrl: typeof SEARCH_URL | null;
    query: string;
    requestedWindow: { start: string; end: string };
    retrievedAt: string;
    recordsReceived: number;
    recordsAccepted: number;
    documentsAttempted: number;
    documentsInspected: number;
    documentFailures: number;
    duplicateRecordsConsolidated: number;
    invalidRecordsDropped: number;
    limitReached: boolean;
    sourceQueries: number;
    documentFetches: number;
    receivedBytes: number;
    failureKind:
      | "none" | "timeout" | "http" | "response-limit"
      | "invalid-response" | "unknown";
    limitation: string;
  };
};

type SearchRecord = {
  packageId: string;
  title: string;
  summaryUrl: string;
  dateIssued: string | null;
  governmentAuthor: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return null;
  }
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) &&
      new Date(parsed).toISOString().slice(0, 10) === value
    ? value : null;
}

function searchRecord(value: unknown): SearchRecord | null {
  if (!isRecord(value) || value.collectionCode !== "PLAW") return null;
  const packageId = value.packageId;
  if (typeof packageId !== "string" ||
      !/^PLAW-\d{1,3}(?:publ|priv)\d{1,4}$/u.test(packageId)) return null;
  const title = typeof value.title === "string"
    ? value.title.replace(/\s+/gu, " ").trim().slice(0, 500)
    : "";
  if (!title || typeof value.resultLink !== "string") return null;
  let summaryUrl: URL;
  try {
    summaryUrl = new URL(value.resultLink);
  } catch {
    return null;
  }
  if (summaryUrl.protocol !== "https:" || summaryUrl.hostname !==
      "api.govinfo.gov" || summaryUrl.port || summaryUrl.username ||
      summaryUrl.password || summaryUrl.search || summaryUrl.hash ||
      summaryUrl.pathname !== `/packages/${packageId}/summary`) return null;
  const governmentAuthor = Array.isArray(value.governmentAuthor)
    ? value.governmentAuthor.find((part): part is string =>
        typeof part === "string" && part.trim().length > 0)
    : null;
  return {
    packageId,
    title,
    summaryUrl: summaryUrl.toString(),
    dateIssued: canonicalDate(value.dateIssued),
    governmentAuthor: governmentAuthor?.trim().slice(0, 200) ?? null,
  };
}

function publicConcept(value: string) {
  // Only a quoted concept, never a caller-supplied provider query expression.
  // The resulting body matches the credentialed transport's exact allowlist.
  return value.normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/\s+/gu, " ").trim().slice(0, 200).trim();
}

function validApiKey(value: string | undefined) {
  if (!value) return false;
  const size = new TextEncoder().encode(value).byteLength;
  return size > 0 && size <= 512 && !/[\u0000-\u001f\u007f]/u.test(value);
}

function publicLawCoordinates(packageId: string) {
  const match = /^PLAW-(\d{1,3})(publ|priv)(\d{1,4})$/u.exec(packageId)!;
  return {
    congress: Number(match[1]),
    lawNumber: Number(match[3]),
    lawType: match[2] === "publ" ? "Public" : "Private",
  };
}

function originalHtmlUrl(packageId: string) {
  return `https://www.govinfo.gov/content/pkg/${packageId}/html/${packageId}.htm`;
}

function originalIdentityPresent(text: string, packageId: string) {
  const coordinates = publicLawCoordinates(packageId);
  const beginning = text.slice(0, 20_000).replace(/[\u2010-\u2015]/gu, "-");
  const marker = new RegExp(
    `\\b${coordinates.lawType}\\s+Law\\s+${coordinates.congress}\\s*[- ]\\s*${coordinates.lawNumber}\\b`,
    "iu",
  );
  return marker.test(beginning) || beginning.includes(packageId);
}

const MONTHS: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04", may: "05",
  june: "06", july: "07", august: "08", september: "09",
  october: "10", november: "11", december: "12",
};

function approvedDateFromOriginal(text: string): {
  date: string;
  passage: string;
} | null {
  // The enacted law may state an approval date. Read the signature end of the
  // original document only; never infer effectiveness from approval.
  const endings = [...text.slice(-4_000).matchAll(
    /\bApproved\s*[:,.]?\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/giu,
  )];
  if (endings.length !== 1) return null;
  const [, month, day, year] = endings[0]!;
  const date = canonicalDate(`${year}-${MONTHS[month!.toLowerCase()]}-${String(day).padStart(2, "0")}`);
  return date ? { date, passage: endings[0]![0] } : null;
}

async function boundedRequest(input: {
  fetch: Screen02ConnectorFetch;
  url: string;
  method: "POST" | "GET";
  timeoutMs: number;
  maximumBytes: number;
  accept: string;
  apiKey?: string;
  body?: string;
}) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("GovInfo bounded request timed out."));
    }, input.timeoutMs);
  });
  try {
    return await Promise.race([(async () => {
    const response = await input.fetch(input.url, {
      method: input.method,
      headers: {
        accept: input.accept,
        ...(input.apiKey ? { "x-api-key": input.apiKey } : {}),
        ...(input.body ? { "content-type": "application/json" } : {}),
        "user-agent": SHOCKAUDIT_OFFICIAL_SOURCE_USER_AGENT,
      },
      ...(input.body ? { body: input.body } : {}),
      signal: controller.signal,
      redirect: "manual",
      cache: "no-store",
    });
    if (response.redirected || !response.ok ||
        (response.status >= 300 && response.status < 400)) {
      await response.body?.cancel("GovInfo response rejected").catch(() => {});
      throw new Error(`GovInfo returned HTTP ${response.status}.`);
    }
    const contentType = (response.headers.get("content-type") ?? "")
      .toLowerCase().split(";", 1)[0];
    if (contentType && (input.method === "POST"
      ? contentType !== "application/json"
      : contentType !== "text/html")) {
      await response.body?.cancel("GovInfo content type rejected").catch(() => {});
      throw new Error("GovInfo returned an invalid response content type.");
    }
    const length = Number(response.headers.get("content-length"));
    if (response.headers.has("content-length") && Number.isFinite(length) &&
        length > input.maximumBytes) {
      await response.body?.cancel("GovInfo response byte limit reached").catch(() => {});
      throw new Error("GovInfo response exceeded the byte limit.");
    }
    const text = await readScreen02BoundedResponseText(
      response, input.maximumBytes,
    );
    return { text, bytes: new TextEncoder().encode(text).byteLength };
    })(), timeout]);
  } finally {
    controller.abort();
    if (timer !== undefined) clearTimeout(timer);
  }
}

function failureKind(error: unknown): Screen04GovInfoEventSearchResult[
  "diagnostics"]["failureKind"] {
  const message = error instanceof Error ? error.message : "";
  if (/Abort|time(?:d)? out/iu.test(message)) return "timeout";
  if (/HTTP \d{3}/u.test(message)) return "http";
  if (/byte limit/iu.test(message)) return "response-limit";
  if (/invalid response|JSON/iu.test(message)) return "invalid-response";
  return "unknown";
}

/**
 * A Screen 4 co-event route, independent of Screen 1 identity confirmation.
 * Search metadata creates no occurrence. Only an inspected original public-law
 * document yields a provisional proposal; its publication and enactment dates
 * remain distinct, and no effective date is inferred.
 */
export async function searchScreen04GovInfoPublicLaws(input: {
  fetch: Screen02ConnectorFetch;
  apiKey?: string;
  query: string;
  startDate: string;
  endDate: string;
  limit?: number;
  retrievedAt: string;
  timeoutMs?: number;
}): Promise<Screen04GovInfoEventSearchResult> {
  if (!canonicalDate(input.startDate) || !canonicalDate(input.endDate) ||
      input.startDate > input.endDate) {
    throw new Error("GovInfo co-event search requires a valid study date window.");
  }
  const concept = publicConcept(input.query);
  if (concept.length < 3 || /^collection\s*:/iu.test(concept)) {
    throw new Error("GovInfo co-event search requires a bounded public concept.");
  }
  const limit = input.limit ?? MAX_INSPECTED_DOCUMENTS;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_INSPECTED_DOCUMENTS) {
    throw new Error("GovInfo co-event inspection limit must be between 1 and 6.");
  }
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 20_000) {
    throw new Error("GovInfo co-event timeout must be within 1–20,000 ms.");
  }
  // GovInfo's publishdate operator is a source-native metadata filter. It
  // narrows first-page saturation; approval and legal effect remain distinct.
  const query = `collection:(PLAW) publishdate:range(${input.startDate},${input.endDate}) "${concept}"`;
  const diagnostics: Screen04GovInfoEventSearchResult["diagnostics"] = {
    provider: "govinfo",
    adapterVersion: SCREEN04_GOVINFO_EVENT_SEARCH_VERSION,
    requestUrl: null,
    query,
    requestedWindow: { start: input.startDate, end: input.endDate },
    retrievedAt: input.retrievedAt,
    recordsReceived: 0,
    recordsAccepted: 0,
    documentsAttempted: 0,
    documentsInspected: 0,
    documentFailures: 0,
    duplicateRecordsConsolidated: 0,
    invalidRecordsDropped: 0,
    limitReached: false,
    sourceQueries: 0,
    documentFetches: 0,
    receivedBytes: 0,
    failureKind: "none",
    limitation: "Original public-law text requires inspection; publication metadata alone does not establish enactment, effective date, coverage, or organizational exposure.",
  };
  const result = (
    status: Screen04GovInfoEventSearchResult["status"],
    proposals: Screen02FindProposal[] = [],
    inspectedDocuments: Screen04GovInfoInspectedDocument[] = [],
  ): Screen04GovInfoEventSearchResult => ({
    status, proposals, inspectedDocuments, diagnostics,
  });
  if (!validApiKey(input.apiKey)) {
    diagnostics.limitation =
      "GovInfo statute discovery was not attempted because the server-side GOVINFO_API_KEY is unavailable.";
    return result("not_configured");
  }
  diagnostics.requestUrl = SEARCH_URL;
  const rows: unknown[] = [];
  const seenCursors = new Set<string>();
  let cursor = "*";
  let moreReported = false;
  for (let page = 0; page < MAX_SEARCH_PAGES; page++) {
    const body = JSON.stringify({
      query,
      pageSize: String(SEARCH_PAGE_SIZE),
      offsetMark: cursor,
      resultLevel: "package",
      sorts: [{ field: "score", sortOrder: "DESC" }],
    });
    diagnostics.sourceQueries++;
    try {
      const response = await boundedRequest({
        fetch: input.fetch,
        url: SEARCH_URL,
        method: "POST",
        body,
        apiKey: input.apiKey,
        timeoutMs,
        maximumBytes: MAX_SEARCH_BYTES,
        accept: "application/json",
      });
      diagnostics.receivedBytes += response.bytes;
      const payload: unknown = JSON.parse(response.text);
      if (!isRecord(payload) || !Array.isArray(payload.results)) {
        throw new Error("GovInfo returned an invalid response JSON shape.");
      }
      const pageRows = payload.results.slice(0, SEARCH_PAGE_SIZE);
      rows.push(...pageRows);
      const next = payload.offsetMark;
      moreReported = (typeof payload.count === "number" &&
        Number.isFinite(payload.count) && payload.count > rows.length) ||
        payload.results.length > SEARCH_PAGE_SIZE;
      const distinctInspectedLeads = new Set(rows.flatMap((row) => {
        const candidate = searchRecord(row);
        return candidate ? [candidate.packageId] : [];
      })).size;
      if (pageRows.length < SEARCH_PAGE_SIZE || !moreReported ||
          distinctInspectedLeads >= limit ||
          typeof next !== "string" ||
          !/^[A-Za-z0-9+/_-]{8,256}={0,2}$/u.test(next) ||
          next === cursor || seenCursors.has(next)) break;
      seenCursors.add(cursor);
      cursor = next;
    } catch (error) {
      diagnostics.failureKind = failureKind(error);
      if (page === 0) {
        diagnostics.limitation =
          "The GovInfo public-law search was unavailable. No result or non-result can be inferred from this source.";
        return result("source_unavailable");
      }
      moreReported = true;
      break;
    }
  }
  diagnostics.recordsReceived = rows.length;
  diagnostics.limitReached = moreReported || rows.length > limit;
  const proposals: Screen02FindProposal[] = [];
  const inspectedDocuments: Screen04GovInfoInspectedDocument[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const record = searchRecord(row);
    if (!record) {
      diagnostics.invalidRecordsDropped++;
      continue;
    }
    if (seen.has(record.packageId)) {
      diagnostics.duplicateRecordsConsolidated++;
      continue;
    }
    seen.add(record.packageId);
    if (diagnostics.documentsAttempted >= limit) break;
    const originalUrl = originalHtmlUrl(record.packageId);
    diagnostics.documentsAttempted++;
    diagnostics.documentFetches++;
    let inspectedText: string;
    try {
      const page = await boundedRequest({
        fetch: input.fetch,
        url: originalUrl,
        method: "GET",
        timeoutMs,
        maximumBytes: MAX_HTML_BYTES,
        accept: "text/html",
      });
      diagnostics.receivedBytes += page.bytes;
      if (officialDocumentAccessChallenge(page.text)) {
        throw new Error("GovInfo original public-law page showed an access challenge.");
      }
      inspectedText = visibleOfficialDocumentText(page.text);
      if (inspectedText.length < 100 || !originalIdentityPresent(
        inspectedText, record.packageId,
      )) {
        throw new Error("GovInfo original public-law identity was not established.");
      }
    } catch {
      diagnostics.documentFailures++;
      continue;
    }
    const approvalDate = approvedDateFromOriginal(inspectedText);
    const dateFacts: DateFact[] = [
      ...(record.dateIssued ? [{
        role: "publication" as const,
        date: record.dateIssued,
        sourceUrl: record.summaryUrl,
        basis: "provider_metadata" as const,
        inspectedPassage: null,
      }] : []),
      ...(approvalDate ? [{
        role: "enactment" as const,
        date: approvalDate.date,
        sourceUrl: originalUrl,
        basis: "inspected_original_html" as const,
        inspectedPassage: approvalDate.passage,
      }] : []),
    ];
    inspectedDocuments.push({
      packageId: record.packageId,
      title: record.title,
      originalHtmlUrl: originalUrl,
      summaryUrl: record.summaryUrl,
      dateFacts,
      inspectedExcerpt: [
        inspectedText.slice(0, 1_750),
        ...(approvalDate ? [`Approval passage: ${approvalDate.passage}`] : []),
      ].join(" ").slice(0, 2_000),
      retrievedAt: input.retrievedAt,
    });
    // The common proposal converter recognizes publication but not enactment.
    // Do not call the inspected approval date an effective date merely to pass
    // its admission test. Consumers may use inspectedDocuments.dateFacts.
    if (!record.dateIssued && !approvalDate) continue;
    const coordinate = publicLawCoordinates(record.packageId);
    const proposalId = `screen04-govinfo-${record.packageId}`;
    proposals.push({
      id: proposalId,
      mode: "find",
      kind: "event",
      title: record.title,
      description:
        `The original ${coordinate.lawType.toLowerCase()} law ${coordinate.congress}-${coordinate.lawNumber} was inspected. Its legal effects and covered activities require provision-level review.`,
      nativeIdentity: {
        formalIdentifier: record.packageId,
        issuer: record.governmentAuthor,
        issuingJurisdiction: "United States",
        status: `${coordinate.lawType} law, original package`,
      },
      event: {
        displayName: record.title,
        eventDate: approvalDate?.date ?? record.dateIssued!,
        eventFamily: "Federal statute",
        geographies: ["United States"],
        populations: [SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN],
      },
      origin: "newly-discovered",
      provisionalDates: [
        ...(record.dateIssued
          ? [`Publication date: ${record.dateIssued}`] : []),
      ],
      affectedPopulation: SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
      requiredVariables: [
        "Relevant statutory provision",
        "Operative and implementation dates",
        "Organization-to-affected-activity linkage",
      ],
      outcomeLink: {
        text: "Any route from this statute to the saved outcome requires a documented affected activity and study-specific exposure assessment.",
        status: "system-template",
      },
      likelyServiceLevel: "event-reconnaissance",
      limitations: [
        "Original statutory text was inspected for package identity, but operative provisions and firm-level exposure were not established.",
        "The provider's dateIssued is publication metadata; an inspected approval date is enactment, neither is automatically legal effectiveness.",
      ],
      reasons: [
        "The bounded GovInfo public-law search supplied this native package and the corresponding original document passed identifier inspection.",
      ],
      sources: [{
        id: `${proposalId}-summary`,
        title: record.title,
        locator: record.summaryUrl,
        publisher: "U.S. Government Publishing Office",
        publishedDate: record.dateIssued,
        authorityTier: 1,
        channel: "GovInfo public-law search metadata; summary locator supplied by provider",
        retrievedAt: input.retrievedAt,
        evidenceText: record.dateIssued
          ? `GovInfo package ${record.packageId} is dated ${record.dateIssued}; this is publication metadata, not an effective date.`
          : `GovInfo returned original public-law package ${record.packageId} without a valid publication date.`,
      }, {
        id: `${proposalId}-original-html`,
        title: record.title,
        locator: originalUrl,
        publisher: record.governmentAuthor ?? "U.S. Government Publishing Office",
        publishedDate: record.dateIssued,
        authorityTier: 1,
        channel: "GovInfo original public-law HTML",
        retrievedAt: input.retrievedAt,
        evidenceText: [
          inspectedText.slice(0, 1_750),
          ...(approvalDate ? [`Approval passage: ${approvalDate.passage}`] : []),
        ].join(" ").slice(0, 2_000),
      }],
    });
  }
  diagnostics.recordsAccepted = proposals.length;
  diagnostics.documentsInspected = inspectedDocuments.length;
  diagnostics.limitation = [
    `${rows.length} GovInfo metadata record(s) were returned across ${diagnostics.sourceQueries} page(s); ${inspectedDocuments.length} original public-law document(s) passed bounded identity inspection.`,
    "Search results are statutes only. No provider-wide, state/local, or all-event coverage is implied.",
    "Publication, inspected approval, substantive duties and legal effectiveness remain separate date roles.",
    ...(diagnostics.documentFailures
      ? [`${diagnostics.documentFailures} document attempt(s) failed or did not establish the native package.`]
      : []),
    ...(diagnostics.limitReached
      ? ["The bounded search pages or document-inspection limit did not exhaust the matching GovInfo collection."]
      : []),
    ...(diagnostics.failureKind !== "none"
      ? ["A later page failed; earlier inspected records remain usable but this route has partial coverage."]
      : []),
  ].join(" ");
  return result("searched", proposals, inspectedDocuments);
}
