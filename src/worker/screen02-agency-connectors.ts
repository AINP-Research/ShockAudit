import {
  SCREEN_02_SOURCE_POLICY_VERSION,
  SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
  type Screen02FindProposal,
  type Screen02QueryLog,
  type Screen02Source,
} from "../core/screen02-types";
import { readScreen02BoundedResponseText } from "./screen02-bounded-response";
import {
  SCREEN_02_CONNECTOR_DEFAULT_LIMIT,
  SCREEN_02_CONNECTOR_DEFAULT_TIMEOUT_MS,
  SCREEN_02_CONNECTOR_MAX_LIMIT,
  SCREEN_02_CONNECTOR_MAX_RESPONSE_BYTES,
  SCREEN_02_CONNECTOR_MAX_TIMEOUT_MS,
  screen02ConnectorFailureKind,
  type Screen02ConnectorFetch,
  type Screen02OfficialConnectorResult,
  type Screen02OfficialProposalBinding,
} from "./screen02-connectors";

export const FTC_PRESS_RELEASES_ENDPOINT =
  "https://www.ftc.gov/news-events/news/press-releases";

const FTC_MAXIMUM_URL_LENGTH = 2_048;

const FTC_PRESS_RELEASES_CHANNEL =
  "Federal Trade Commission official actions and press releases";

export type FtcPressReleasesConnectorInput = {
  fetch: Screen02ConnectorFetch;
  retrievedAt: string;
  startDate: string;
  endDate: string;
  population: string;
  outcomeFamily: string;
  query: string;
  queryId?: string;
  queryPurpose?: string;
  limit?: number;
  timeoutMs?: number;
  workflowMode?: "find" | "audit";
  /** Source-policy admission runs before the bounded network-response timer. */
  beforeRequest?: (url: string, signal: AbortSignal) => Promise<void>;
  /** Optional parent deadline covering admission and the network response. */
  absoluteDeadlineAt?: number;
  /** Clock paired with absoluteDeadlineAt; injectable for deterministic tests. */
  now?: () => number;
  /** Optional parent cancellation propagated through admission and fetch. */
  signal?: AbortSignal;
};

type FtcListingRecord = {
  recordId: string;
  title: string;
  publishedDate: string;
  summary: string;
  locator: string;
};

function cleanText(value: string, maximum: number) {
  return value
    .replace(/<[^>]*>/gu, " ")
    .replace(/&nbsp;|&#160;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&quot;|&#34;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/&ldquo;|&rdquo;/giu, '"')
    .replace(/&lsquo;|&rsquo;/giu, "'")
    .replace(/&ndash;/giu, "–")
    .replace(/&mdash;/giu, "—")
    .replace(/&#(\d+);/gu, (_match, code: string) => {
      const point = Number(code);
      return Number.isSafeInteger(point) && point >= 32 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : " ";
    })
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maximum)
    .trim();
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value;
}

function validRetrievedAt(value: string) {
  return /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?Z$/u
    .test(value) && Number.isFinite(Date.parse(value));
}

function requiredText(value: string, label: string, maximum: number) {
  const cleaned = cleanText(value, maximum + 1);
  if (!cleaned) throw new Error(`${label} is required.`);
  if (cleaned.length > maximum) {
    throw new Error(`${label} exceeds ${maximum} characters.`);
  }
  return cleaned;
}

function fnv1a64(value: string) {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function stableTextId(prefix: string, value: string) {
  const fragment = value
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 60);
  return `${prefix}-${fragment || "record"}-${fnv1a64(value)}`.slice(0, 120);
}

function stableUrlId(prefix: string, canonicalUrl: string) {
  return `${prefix}-${fnv1a64(canonicalUrl)}`;
}

function requestUrl(input: FtcPressReleasesConnectorInput, limit: number) {
  const url = new URL(FTC_PRESS_RELEASES_ENDPOINT);
  // The FTC robots policy disallows URLs containing `items_per_page` and asks
  // automated clients to keep a five-second crawl delay. ShockAudit therefore
  // uses the site's default 20-row page and schedules at most one request in a
  // qualification-recovery round; `limit` is enforced after parsing.
  void limit;
  url.searchParams.set("search", requiredText(input.query, "query", 240));
  url.searchParams.set("date_range[min]", input.startDate);
  url.searchParams.set("date_range[max]", input.endDate);
  url.searchParams.set("field_competition_topics", "All");
  url.searchParams.set("field_consumer_protection_topics", "All");
  url.searchParams.set("field_industry_target_id", "All");
  const value = url.toString();
  if (value.length > FTC_MAXIMUM_URL_LENGTH) {
    throw new Error(
      `The encoded FTC request exceeds the ${FTC_MAXIMUM_URL_LENGTH}-character URL limit.`,
    );
  }
  return value;
}

function safeFtcPressReleaseUrl(value: string) {
  try {
    if (!value || value.length > FTC_MAXIMUM_URL_LENGTH) return null;
    const url = new URL(value, FTC_PRESS_RELEASES_ENDPOINT);
    if (
      url.protocol !== "https:" ||
      !["ftc.gov", "www.ftc.gov"].includes(url.hostname.toLowerCase()) ||
      !url.pathname.startsWith("/news-events/news/press-releases/") ||
      url.username || url.password || (url.port && url.port !== "443")
    ) return null;
    url.hostname = "www.ftc.gov";
    url.port = "";
    url.search = "";
    url.hash = "";
    const canonical = url.toString();
    return canonical.length <= FTC_MAXIMUM_URL_LENGTH ? canonical : null;
  } catch {
    return null;
  }
}

function articleField(article: string, pattern: RegExp) {
  return pattern.exec(article)?.[1] ?? "";
}

export function parseFtcPressReleaseListing(
  html: string,
  maximumRecords = SCREEN_02_CONNECTOR_MAX_LIMIT,
): {
  records: FtcListingRecord[];
  invalidRecordsDropped: number;
  reportedTotal: number;
  limitReached: boolean;
} {
  if (
    !Number.isSafeInteger(maximumRecords) || maximumRecords < 1 ||
    maximumRecords > SCREEN_02_CONNECTOR_MAX_LIMIT
  ) {
    throw new Error(
      `maximumRecords must be an integer from 1 through ${SCREEN_02_CONNECTOR_MAX_LIMIT}.`,
    );
  }
  const resultArticles = [
    ...html.matchAll(/<article\b[\s\S]*?<\/article>/giu),
  ]
    .map((match) => match[0])
    // These two class tokens are the observed FTC result-row contract. Both
    // must be present before the local record limit is applied; a generic
    // article or a node-title elsewhere in the page is not a search result.
    .filter((article) => {
      const openingTag = /^<article\b([^>]*)>/iu.exec(article)?.[1] ?? "";
      const classValue = /\bclass\s*=\s*["']([^"']*)["']/iu
        .exec(openingTag)?.[1] ?? "";
      const classes = new Set(classValue.split(/\s+/u).filter(Boolean));
      return classes.has("node--type-press-release") &&
        classes.has("node--view-mode-search-result");
    });
  const zeroResults = [
    ...html.matchAll(
      /<div\b[^>]*class=["'][^"']*\bview-empty\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/giu,
    ),
  ].some((match) =>
    /\bno results found(?: for (?:the|these) filters)?\.?\b/iu.test(
      cleanText(match[1] ?? "", 300),
    )
  );
  if (resultArticles.length === 0) {
    if (!zeroResults) {
      throw new Error(
        "Invalid response: FTC listing contained neither recognized press-release results nor the explicit zero-results marker.",
      );
    }
    return {
      records: [],
      invalidRecordsDropped: 0,
      reportedTotal: 0,
      limitReached: false,
    };
  }
  if (zeroResults) {
    throw new Error(
      "Invalid response: FTC listing contained both result rows and a zero-results marker.",
    );
  }

  const summaries = [
    ...html.matchAll(
      /<div\b[^>]*class=["'][^"']*\bview-summary\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/giu,
    ),
  ].flatMap((match) => {
    const summary = cleanText(match[1] ?? "", 300);
    const parsed = /^Displaying\s+([\d,]+)\s*-\s*([\d,]+)\s+of\s+([\d,]+)$/iu
      .exec(summary);
    if (!parsed) return [];
    const start = Number((parsed[1] ?? "").replaceAll(",", ""));
    const end = Number((parsed[2] ?? "").replaceAll(",", ""));
    const total = Number((parsed[3] ?? "").replaceAll(",", ""));
    return Number.isSafeInteger(start) && Number.isSafeInteger(end) &&
        Number.isSafeInteger(total) && start >= 1 && end >= start &&
        total >= end
      ? [{ start, end, total }]
      : [];
  });
  const matchingSummaries = summaries.filter(
    (summary) =>
      summary.start === 1 &&
      summary.end - summary.start + 1 === resultArticles.length,
  );
  const reportedTotals = new Set(
    matchingSummaries.map((summary) => summary.total),
  );
  if (reportedTotals.size !== 1) {
    throw new Error(
      "Invalid response: FTC result rows did not have one consistent source-reported result total.",
    );
  }
  const reportedSummary = matchingSummaries[0]!;
  const reportedTotal = reportedSummary.total;
  const inspectedArticles = resultArticles.slice(0, maximumRecords);
  const records: FtcListingRecord[] = [];
  let invalidRecordsDropped = 0;
  for (const article of inspectedArticles) {
    const headingMatch =
      /<h3\b[^>]*class=["'][^"']*\bnode-title\b[^"']*["'][^>]*>[\s\S]*?<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/iu
        .exec(article);
    const locator = safeFtcPressReleaseUrl(headingMatch?.[1] ?? "");
    const title = cleanText(headingMatch?.[2] ?? "", 500);
    const publishedDate = articleField(
      article,
      /<time\b[^>]*datetime=["'](\d{4}-\d{2}-\d{2})(?:T[^"']*)?["'][^>]*>/iu,
    );
    const summary = cleanText(
      articleField(
        article,
        /<div\b[^>]*class=["'][^"']*\bfield--name-body\b[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/iu,
      ),
      1_000,
    );
    if (!locator || !title || !validDate(publishedDate) || !summary) {
      invalidRecordsDropped += 1;
      continue;
    }
    records.push({
      recordId: stableUrlId("ftc-record", locator),
      title,
      publishedDate,
      summary,
      locator,
    });
  }
  return {
    records,
    invalidRecordsDropped,
    reportedTotal,
    limitReached:
      inspectedArticles.length < resultArticles.length ||
      reportedSummary.end < reportedTotal,
  };
}

function isSupportedFtcAnnouncementLead(record: FtcListingRecord) {
  // A press release is explanatory evidence, not the controlling instrument.
  // Promote only announcements whose current source-native wording says the
  // Commission itself approved/finalized/issued a final action. Complaint,
  // suit, proposal, comment, or event announcements fail closed unless that
  // explicit finality/approval wording is present in the current title.
  const explicitCurrentAction =
    /^(?:the\s+)?(?:federal trade commission|ftc|commission)\s+(?:has\s+|today\s+)?(?:approv(?:es|ed)|finaliz(?:es|ed)|adopt(?:s|ed)|issues?\s+(?:a\s+)?final\b|enters?\s+(?:a\s+)?(?:final\s+)?order\b)/iu;
  if (explicitCurrentAction.test(record.title)) return true;

  const preliminaryOrUnresolved =
    /\b(?:agenda|complaint|files? suit|hearing|inquiry|perspective paper|propos(?:al|als|e|ed|es|ing)|request(?:s|ed|ing)? information|seeks? (?:public )?comment|seeks? to|speech|staff paper|tentative|workshop)\b/iu;
  if (preliminaryOrUnresolved.test(record.title)) return false;

  return /^(?:the\s+)?(?:federal trade commission|ftc|commission)\s+(?:has\s+|today\s+)?(?:approv(?:es|ed)|finaliz(?:es|ed)|adopt(?:s|ed)|issues?\s+(?:a\s+)?final\b|enters?\s+(?:a\s+)?(?:final\s+)?order\b)/iu
    .test(record.summary);
}

function proposal(
  record: FtcListingRecord,
  input: FtcPressReleasesConnectorInput,
): Screen02FindProposal | null {
  if (!isSupportedFtcAnnouncementLead(record)) {
    return null;
  }
  const evidenceText = [
    `${record.title}.`,
    // Keep the connector-owned scope and public-announcement timing beside
    // the exact source title so deterministic grounding retains them. This is
    // only the dated information-event anchor; it is never an approval,
    // adoption, effectiveness, implementation, or treatment date.
    "Jurisdiction: United States.",
    `Agency announcement date: ${record.publishedDate}.`,
    "Issuing authority: Federal Trade Commission.",
    record.summary,
  ].join(" ");
  const source: Screen02Source = {
    id: stableUrlId("ftc-source", record.locator),
    title: record.title,
    locator: record.locator,
    publisher: "Federal Trade Commission",
    publishedDate: record.publishedDate,
    authorityTier: 2,
    authorityAssessment: {
      method: "connector-native",
      reason:
        "The connector retrieved an FTC-owned press-release announcement whose source-native wording reports Commission approval or final action. It is official explanatory evidence, not automatically the controlling order or instrument.",
      policyVersion: SCREEN_02_SOURCE_POLICY_VERSION,
    },
    channel: FTC_PRESS_RELEASES_CHANNEL,
    retrievedAt: input.retrievedAt,
    evidenceText,
  };
  return {
    id: stableUrlId("ftc-announcement", record.locator),
    mode: "find",
    kind: "event",
    title: record.title,
    description:
      `FTC announcement published on ${record.publishedDate}. ${record.summary} ` +
      "The linked agency page supports an announcement lead only; the controlling instrument, finality, practical change, and covered organizations remain to be verified.",
    nativeIdentity: {
      formalIdentifier: null,
      issuer: "Federal Trade Commission",
      issuingJurisdiction: "United States",
      status: "Official agency announcement lead",
    },
    event: {
      displayName: record.title,
      eventDate: record.publishedDate,
      eventFamily: "Regulation",
      geographies: ["United States"],
      populations: [SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN],
    },
    origin: "newly-discovered",
    provisionalDates: [`Agency announcement date: ${record.publishedDate}`],
    affectedPopulation: SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
    requiredVariables: [
      "Controlling order or decision identifier and final status",
      "Organization-to-covered-activity linkage",
      "Implementation or compliance date",
    ],
    outcomeLink: {
      text:
        `The retrieved FTC summary describes the reported approval or final-action announcement. A candidate-specific pathway to ${requiredText(input.outcomeFamily, "outcomeFamily", 300)} remains a research hypothesis until coverage and organizational responses are verified; no outcome values were inspected.`,
      status: "system-template",
    },
    likelyServiceLevel: "event-reconnaissance",
    limitations: [
      "The agency announcement is official explanatory evidence; retrieve and verify the controlling order, decision, or approval where available.",
      "The announcement date is only a public information-event anchor, not adoption, implementation, effectiveness, enforcement, or organization-level treatment.",
      "Applicability is conditional on the covered activity and was not inferred from the search query.",
    ],
    reasons: [
      `The bounded FTC search returned this official announcement lead at ${input.retrievedAt}; source-native wording reports Commission approval or final action, but the announcement is not itself treated as the controlling instrument.`,
      "Fixed parsing used only retrieved title, date, summary, and locator fields and did not inspect outcomes.",
    ],
    sources: [source],
  };
}

async function fetchListing(
  fetchImpl: Screen02ConnectorFetch,
  url: string,
  timeoutMs: number,
  options: Pick<
    FtcPressReleasesConnectorInput,
    "absoluteDeadlineAt" | "beforeRequest" | "now" | "signal"
  >,
) {
  const controller = new AbortController();
  const now = options.now ?? Date.now;
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
  let responseTimer: ReturnType<typeof setTimeout> | undefined;
  let removeParentAbort: (() => void) | undefined;
  const timeoutError = (message: string) => {
    const error = new Error(message);
    error.name = "TimeoutError";
    return error;
  };
  const abortError = () => {
    const error = new Error("Request was aborted by its parent operation.");
    error.name = "AbortError";
    return error;
  };
  const guards: Promise<never>[] = [];
  if (options.absoluteDeadlineAt !== undefined) {
    const remaining = options.absoluteDeadlineAt - now();
    if (remaining <= 0) {
      controller.abort();
    } else {
      guards.push(new Promise<never>((_resolve, reject) => {
        deadlineTimer = setTimeout(() => {
          controller.abort();
          reject(timeoutError(
            "Request exceeded the parent operation deadline.",
          ));
        }, remaining);
      }));
    }
  }
  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      guards.push(new Promise<never>((_resolve, reject) => {
        const abort = () => {
          controller.abort();
          reject(abortError());
        };
        options.signal!.addEventListener("abort", abort, { once: true });
        removeParentAbort = () =>
          options.signal!.removeEventListener("abort", abort);
      }));
    }
  }
  try {
    if (controller.signal.aborted) {
      if (
        options.absoluteDeadlineAt !== undefined &&
        now() >= options.absoluteDeadlineAt
      ) {
        throw timeoutError(
          "Request deadline was exhausted before source-policy admission.",
        );
      }
      throw abortError();
    }
    // Crawl-policy admission remains outside the connector's response-only
    // timeout, but is inside the parent search deadline and cancellation.
    await Promise.race([
      Promise.resolve(options.beforeRequest?.(url, controller.signal)),
      ...guards,
    ]);
    if (controller.signal.aborted) {
      if (
        options.absoluteDeadlineAt !== undefined &&
        now() >= options.absoluteDeadlineAt
      ) {
        throw timeoutError(
          "Request exceeded the parent operation deadline before network start.",
        );
      }
      const error = new Error("Request was aborted before network start.");
      error.name = "AbortError";
      throw error;
    }
    const deadlineRemaining = options.absoluteDeadlineAt === undefined
      ? timeoutMs
      : options.absoluteDeadlineAt - now();
    if (deadlineRemaining <= 0) {
      controller.abort();
      throw timeoutError(
        "Request deadline was exhausted before network start.",
      );
    }
    const responseTimeoutMs = Math.min(timeoutMs, deadlineRemaining);
    const responseTimeout = new Promise<never>((_resolve, reject) => {
      responseTimer = setTimeout(() => {
        controller.abort();
        reject(timeoutError(
          `Request timed out after ${responseTimeoutMs} ms.`,
        ));
      }, responseTimeoutMs);
    });
    const request = (async () => {
      const response = await fetchImpl(url, {
        method: "GET",
        headers: {
          accept: "text/html",
          "user-agent": "ShockAudit/0.6.2 source discovery",
        },
        redirect: "manual",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Official source returned HTTP ${response.status}.`);
      }
      const declaredContentType = response.headers.get("content-type") ?? "";
      const mediaType = declaredContentType.split(";", 1)[0]?.trim()
        .toLocaleLowerCase("en-US") ?? "";
      if (mediaType !== "text/html") {
        throw new Error(
          "Official source returned an unsupported content type; the response must declare text/html.",
        );
      }
      const contentLength = Number(response.headers.get("content-length"));
      if (
        Number.isFinite(contentLength) &&
        contentLength > SCREEN_02_CONNECTOR_MAX_RESPONSE_BYTES
      ) {
        throw new Error("Official source response exceeded the byte limit.");
      }
      return readScreen02BoundedResponseText(
        response,
        SCREEN_02_CONNECTOR_MAX_RESPONSE_BYTES,
      );
    })();
    return await Promise.race([request, responseTimeout, ...guards]);
  } finally {
    controller.abort();
    if (deadlineTimer !== undefined) clearTimeout(deadlineTimer);
    if (responseTimer !== undefined) clearTimeout(responseTimer);
    removeParentAbort?.();
  }
}

export async function fetchFtcPressReleaseProposals(
  input: FtcPressReleasesConnectorInput,
): Promise<Screen02OfficialConnectorResult> {
  if (typeof input.fetch !== "function") {
    throw new Error("An injected fetch implementation is required.");
  }
  if (!validRetrievedAt(input.retrievedAt)) {
    throw new Error("retrievedAt must be an explicit ISO 8601 UTC timestamp.");
  }
  if (
    !validDate(input.startDate) || !validDate(input.endDate) ||
    input.startDate > input.endDate
  ) {
    throw new Error("startDate and endDate must form a valid inclusive YYYY-MM-DD range.");
  }
  requiredText(input.population, "population", 500);
  requiredText(input.outcomeFamily, "outcomeFamily", 300);
  const limit = input.limit ?? SCREEN_02_CONNECTOR_DEFAULT_LIMIT;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > SCREEN_02_CONNECTOR_MAX_LIMIT) {
    throw new Error(`limit must be an integer from 1 through ${SCREEN_02_CONNECTOR_MAX_LIMIT}.`);
  }
  const timeoutMs = input.timeoutMs ?? SCREEN_02_CONNECTOR_DEFAULT_TIMEOUT_MS;
  if (
    !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 ||
    timeoutMs > SCREEN_02_CONNECTOR_MAX_TIMEOUT_MS
  ) {
    throw new Error(`timeoutMs must be an integer from 1 through ${SCREEN_02_CONNECTOR_MAX_TIMEOUT_MS}.`);
  }
  const url = requestUrl(input, limit);
  const queryLog: Screen02QueryLog = {
    id: stableTextId("ftc-query", input.queryId ?? input.query),
    query: url,
    purpose: input.queryPurpose
      ? requiredText(input.queryPurpose, "queryPurpose", 1_500)
      : "Search bounded FTC-owned press-release announcements for source-native approval or final-action leads matching the supplied terms and date window.",
  };
  let parsed: ReturnType<typeof parseFtcPressReleaseListing>;
  try {
    const html = await fetchListing(
      input.fetch,
      url,
      timeoutMs,
      input,
    );
    parsed = parseFtcPressReleaseListing(html, limit);
  } catch (error) {
    const failure = error instanceof Error
      ? `${error.name}: ${error.message}`.slice(0, 500)
      : "Official source request failed.";
    const failureKind = error instanceof Error &&
        (error.name === "AbortError" || error.name === "TimeoutError")
      ? "timeout" as const
      : screen02ConnectorFailureKind(failure);
    return {
      proposals: [],
      proposalBindings: [],
      diagnostics: {
        connector: "ftc-press-releases-html-v1",
        endpoint: FTC_PRESS_RELEASES_ENDPOINT,
        requestUrl: url,
        retrievedAt: input.retrievedAt,
        resultLimit: limit,
        recordsReceived: 0,
        recordsAccepted: 0,
        proposalsReturned: 0,
        invalidRecordsDropped: 0,
        duplicateRecordsConsolidated: 0,
        limitReached: false,
        failureKind,
        queryMatrix: [{ ...queryLog, returnedRecordIds: [] }],
        channels: [{
          channel: FTC_PRESS_RELEASES_CHANNEL,
          status: "failed",
          retrievedAt: input.retrievedAt,
          note: `${failure} This route failed independently; no query terms were treated as facts and no outcome values were inspected.`,
        }],
        outcomeValuesInspected: false,
      },
    };
  }
  const seen = new Set<string>();
  const bindingByProposalId = new Map<
    string,
    Screen02OfficialProposalBinding
  >();
  let duplicateRecordsConsolidated = 0;
  const proposals: Screen02FindProposal[] = [];
  const proposalBindings: Screen02OfficialProposalBinding[] = [];
  for (const record of parsed.records) {
    const candidate = proposal(record, input);
    if (!candidate) continue;
    if (seen.has(candidate.id)) {
      duplicateRecordsConsolidated += 1;
      const binding = bindingByProposalId.get(candidate.id);
      if (
        binding &&
        !binding.returnedRecordIds.includes(record.recordId)
      ) {
        binding.returnedRecordIds.push(record.recordId);
      }
      continue;
    }
    seen.add(candidate.id);
    proposals.push(candidate);
    const binding: Screen02OfficialProposalBinding = {
      proposalId: candidate.id,
      queryId: queryLog.id,
      returnedRecordIds: [record.recordId],
      sourceIds: candidate.sources.map((source) => source.id),
    };
    proposalBindings.push(binding);
    bindingByProposalId.set(candidate.id, binding);
  }
  queryLog.returnedRecordIds = parsed.records.map((record) => record.recordId);
  return {
    proposals,
    proposalBindings,
    diagnostics: {
      connector: "ftc-press-releases-html-v1",
      endpoint: FTC_PRESS_RELEASES_ENDPOINT,
      requestUrl: url,
      retrievedAt: input.retrievedAt,
      resultLimit: limit,
      recordsReceived: parsed.records.length + parsed.invalidRecordsDropped,
      recordsAccepted: parsed.records.length,
      proposalsReturned: proposals.length,
      invalidRecordsDropped: parsed.invalidRecordsDropped,
      duplicateRecordsConsolidated,
      limitReached: parsed.limitReached,
      failureKind: "none",
      queryMatrix: [queryLog],
      channels: [{
        channel: FTC_PRESS_RELEASES_CHANNEL,
        status: "searched",
        retrievedAt: input.retrievedAt,
        note:
          `Retrieved ${parsed.records.length} bounded FTC listing records from ${parsed.reportedTotal} source-reported results and retained ${proposals.length} official announcement leads with source-native approval or final-action wording. ` +
          "Complaint, suit, proposal, comment, hearing, and event-only announcements were not promoted. The route supplies official explanatory evidence only; finality, applicability, dates, and controlling documents remain subject to common qualification and verification.",
      }],
      outcomeValuesInspected: false,
    },
  };
}
