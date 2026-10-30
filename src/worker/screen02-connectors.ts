import {
  SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
  SCREEN_02_SOURCE_POLICY_VERSION,
  type Screen02ChannelLog,
  type Screen02FindProposal,
  type Screen02Proposal,
  type Screen02QueryLog,
  type Screen02Source,
  type SourceAuthorityTier,
} from "../core/screen02-types";
import { canonicalScreen02FederalRegisterFormalIdentifier } from
  "../core/screen02-context-bridge";
import { readScreen02BoundedResponseText } from "./screen02-bounded-response";
import {
  usStateNameForCode,
  type Screen02ConnectorId,
} from "./screen02-source-router";

export const FEDERAL_REGISTER_API_ENDPOINT =
  "https://www.federalregister.gov/api/v1/documents.json";
export const OPEN_FEMA_API_ENDPOINT =
  "https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries";

export const SCREEN_02_CONNECTOR_DEFAULT_LIMIT = 8;
export const SCREEN_02_CONNECTOR_MAX_LIMIT = 20;
export const SCREEN_02_CONNECTOR_DEFAULT_TIMEOUT_MS = 8_000;
export const SCREEN_02_CONNECTOR_MAX_TIMEOUT_MS = 20_000;
export const SCREEN_02_CONNECTOR_MAX_RECORDED_REQUEST_URL_LENGTH =
  1_500;
export const SCREEN_02_CONNECTOR_MAX_RESPONSE_BYTES = 1_500_000;

export const FEDERAL_REGISTER_DOCUMENT_TYPES = [
  "RULE",
  "PRORULE",
  "NOTICE",
] as const;
export type FederalRegisterDocumentType =
  (typeof FEDERAL_REGISTER_DOCUMENT_TYPES)[number];

export type Screen02ConnectorFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type SharedConnectorInput = {
  fetch: Screen02ConnectorFetch;
  retrievedAt: string;
  startDate: string;
  endDate: string;
  population: string;
  outcomeFamily: string;
  limit?: number;
  timeoutMs?: number;
};

export type FederalRegisterConnectorInput = SharedConnectorInput & {
  query: string;
  /**
   * When present, this request is an identity bridge rather than a broad
   * metadata search. Only the exact official document number may be returned
   * or promoted to a proposal.
   */
  exactDocumentNumber?: string;
  queryId?: string;
  queryPurpose?: string;
  documentTypes?: readonly FederalRegisterDocumentType[];
  /**
   * The confirmed Screen 1 event family, used only to keep clearly
   * nonbinding administrative records out of a generic regulatory Find.
   */
  eventFamily?: string;
  workflowMode?: "find" | "audit";
};

export type OpenFemaConnectorInput = SharedConnectorInput & {
  state?: string;
  incidentType?: string;
};

export type Screen02ConnectorDiagnostics = {
  connector: Screen02ConnectorId;
  endpoint: string;
  requestUrl: string;
  retrievedAt: string;
  resultLimit: number;
  recordsReceived: number;
  recordsAccepted: number;
  proposalsReturned: number;
  invalidRecordsDropped: number;
  duplicateRecordsConsolidated: number;
  limitReached: boolean;
  failureKind:
    | "none"
    | "timeout"
    | "http"
    | "response-limit"
    | "invalid-response"
    | "unknown";
  queryMatrix: Screen02QueryLog[];
  channels: Screen02ChannelLog[];
  outcomeValuesInspected: false;
};

export function screen02ConnectorFailureKind(
  failure: string,
): Exclude<Screen02ConnectorDiagnostics["failureKind"], "none"> {
  const normalized = failure.toLocaleLowerCase("en-US");
  if (/\b(?:timed out|timeout|deadline|abort)\b/u.test(normalized)) {
    return "timeout";
  }
  if (/\bhttp\s+\d{3}\b/u.test(normalized)) return "http";
  if (/\b(?:byte limit|response exceeded|too large)\b/u.test(normalized)) {
    return "response-limit";
  }
  if (
    /\b(?:invalid json|json parse|syntaxerror|unexpected (?:token|end)|unsupported content type|invalid response)\b/u.test(
      normalized,
    )
  ) {
    return "invalid-response";
  }
  return "unknown";
}

export type Screen02OfficialProposalBinding = {
  proposalId: string;
  queryId: string;
  returnedRecordIds: string[];
  sourceIds: string[];
};

export type Screen02OfficialConnectorResult = {
  proposals: Screen02Proposal[];
  proposalBindings: Screen02OfficialProposalBinding[];
  diagnostics: Screen02ConnectorDiagnostics;
};

type FederalRegisterAgency = {
  name?: unknown;
  raw_name?: unknown;
};

type FederalRegisterRecord = {
  title?: unknown;
  type?: unknown;
  abstract?: unknown;
  action?: unknown;
  excerpts?: unknown;
  document_number?: unknown;
  html_url?: unknown;
  pdf_url?: unknown;
  raw_text_url?: unknown;
  body_html_url?: unknown;
  publication_date?: unknown;
  effective_on?: unknown;
  agencies?: unknown;
};

type FederalRegisterResponse = {
  count?: unknown;
  results?: unknown;
};

type OpenFemaRecord = {
  id?: unknown;
  disasterNumber?: unknown;
  state?: unknown;
  declarationType?: unknown;
  declarationDate?: unknown;
  incidentType?: unknown;
  declarationTitle?: unknown;
  incidentBeginDate?: unknown;
  incidentEndDate?: unknown;
  designatedArea?: unknown;
};

type OpenFemaResponse = {
  DisasterDeclarationsSummaries?: unknown;
};

type FemaCandidate = {
  disasterNumber: number;
  state: string;
  declarationType: string;
  declarationDate: string;
  incidentType: string;
  declarationTitle: string;
  incidentBeginDate: string | null;
  incidentEndDate: string | null;
  designatedAreas: string[];
  rawIds: string[];
};

const FEDERAL_REGISTER_CHANNEL =
  "Federal Register API v1 · rules, proposed rules, and notices";
const OPEN_FEMA_CHANNEL =
  "OpenFEMA Disaster Declarations Summaries v2";

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function normalizedText(
  value: unknown,
  maxLength: number,
  fallback = "",
) {
  if (typeof value !== "string") return fallback;
  const normalized = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return fallback;
  return normalized.slice(0, maxLength);
}

function requiredText(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string") {
    throw new Error(`${label} is required.`);
  }
  const normalized = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  if (normalized.length > maxLength) {
    throw new Error(`${label} exceeds ${maxLength} characters.`);
  }
  return normalized;
}

function boundedQueryRequestUrl(
  query: string,
  buildUrl: (boundedQuery: string) => string,
) {
  const initialRequestUrl = buildUrl(query);
  if (
    initialRequestUrl.length <=
    SCREEN_02_CONNECTOR_MAX_RECORDED_REQUEST_URL_LENGTH
  ) {
    return {
      requestUrl: initialRequestUrl,
      queryWasShortened: false,
    };
  }

  const codePoints = [...query];
  for (let length = codePoints.length - 1; length >= 1; length -= 1) {
    const boundedQuery = codePoints.slice(0, length).join("").trim();
    const candidateUrl = boundedQuery ? buildUrl(boundedQuery) : "";
    if (
      candidateUrl &&
      candidateUrl.length <=
        SCREEN_02_CONNECTOR_MAX_RECORDED_REQUEST_URL_LENGTH
    ) {
      return {
        requestUrl: candidateUrl,
        queryWasShortened: true,
      };
    }
  }
  throw new Error(
    "The encoded connector request cannot fit the documented request-URL limit.",
  );
}

function validCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function validRetrievedAt(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match =
    /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?Z$/.exec(
      value,
    );
  return (
    match !== null &&
    validCalendarDate(match[1] ?? "") &&
    Number.isFinite(Date.parse(value))
  );
}

function validateSharedInput(input: SharedConnectorInput) {
  if (typeof input.fetch !== "function") {
    throw new Error("An injected fetch implementation is required.");
  }
  if (
    !validRetrievedAt(input.retrievedAt)
  ) {
    throw new Error(
      "retrievedAt must be an explicit ISO 8601 UTC timestamp.",
    );
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
  requiredText(input.population, "population", 500);
  requiredText(input.outcomeFamily, "outcomeFamily", 300);
}

function boundedLimit(limit = SCREEN_02_CONNECTOR_DEFAULT_LIMIT) {
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > SCREEN_02_CONNECTOR_MAX_LIMIT
  ) {
    throw new Error(
      `limit must be an integer from 1 through ${SCREEN_02_CONNECTOR_MAX_LIMIT}.`,
    );
  }
  return limit;
}

function boundedTimeout(
  timeoutMs = SCREEN_02_CONNECTOR_DEFAULT_TIMEOUT_MS,
) {
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > SCREEN_02_CONNECTOR_MAX_TIMEOUT_MS
  ) {
    throw new Error(
      `timeoutMs must be an integer from 1 through ${SCREEN_02_CONNECTOR_MAX_TIMEOUT_MS}.`,
    );
  }
  return timeoutMs;
}

function dateOnly(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const candidate = value.slice(0, 10);
  return validCalendarDate(candidate) ? candidate : null;
}

function safeOfficialUrl(
  value: unknown,
  allowedHosts: ReadonlySet<string>,
) {
  if (typeof value !== "string" || value.length > 2_048) return null;
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== "https:" ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.port !== "" ||
      !allowedHosts.has(parsed.hostname.toLowerCase())
    ) {
      return null;
    }
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

type FederalRegisterLocatorKind =
  | "publication-html"
  | "body-html"
  | "raw-text"
  | "govinfo-pdf";

function decodedPathSegments(locator: URL) {
  try {
    return locator.pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));
  } catch {
    return [];
  }
}

function sameFederalRegisterDocumentNumber(
  actual: string | undefined,
  expected: string,
  suffix = "",
) {
  if (!actual) return false;
  const withoutSuffix = suffix && actual.toLocaleLowerCase("en-US").endsWith(suffix)
    ? actual.slice(0, -suffix.length)
    : suffix
      ? ""
      : actual;
  return withoutSuffix.toLocaleLowerCase("en-US") ===
    expected.toLocaleLowerCase("en-US");
}

/**
 * Accept only source-native Federal Register/GovInfo URL shapes whose path
 * independently names the API record's exact document number. Host trust or
 * a document number placed only in a query/fragment is not an identity bind.
 */
function federalRegisterRecordUrl(
  value: unknown,
  documentNumber: string,
  kind: FederalRegisterLocatorKind,
) {
  const allowedHosts = kind === "govinfo-pdf"
    ? new Set(["govinfo.gov", "www.govinfo.gov"])
    : new Set(["federalregister.gov", "www.federalregister.gov"]);
  const safe = safeOfficialUrl(value, allowedHosts);
  if (!safe) return null;
  const parsed = new URL(safe);
  const segments = decodedPathSegments(parsed);

  const pathMatches = (() => {
    if (kind === "publication-html") {
      if (
        segments[0]?.toLocaleLowerCase("en-US") === "d" &&
        segments.length === 2
      ) {
        return sameFederalRegisterDocumentNumber(
          segments[1],
          documentNumber,
        );
      }
      return (
        segments[0]?.toLocaleLowerCase("en-US") === "documents" &&
        /^\d{4}$/u.test(segments[1] ?? "") &&
        /^(?:0[1-9]|1[0-2])$/u.test(segments[2] ?? "") &&
        /^(?:0[1-9]|[12]\d|3[01])$/u.test(segments[3] ?? "") &&
        sameFederalRegisterDocumentNumber(segments[4], documentNumber)
      );
    }

    if (kind === "body-html" || kind === "raw-text") {
      const representation = kind === "body-html" ? "html" : "text";
      const suffix = kind === "body-html" ? ".html" : ".txt";
      return (
        segments[0]?.toLocaleLowerCase("en-US") === "documents" &&
        segments[1]?.toLocaleLowerCase("en-US") === "full_text" &&
        segments[2]?.toLocaleLowerCase("en-US") === representation &&
        /^\d{4}$/u.test(segments[3] ?? "") &&
        /^(?:0[1-9]|1[0-2])$/u.test(segments[4] ?? "") &&
        /^(?:0[1-9]|[12]\d|3[01])$/u.test(segments[5] ?? "") &&
        segments.length === 7 &&
        sameFederalRegisterDocumentNumber(
          segments[6],
          documentNumber,
          suffix,
        )
      );
    }

    return (
      segments[0]?.toLocaleLowerCase("en-US") === "content" &&
      segments[1]?.toLocaleLowerCase("en-US") === "pkg" &&
      /^FR-\d{4}-\d{2}-\d{2}$/iu.test(segments[2] ?? "") &&
      segments[3]?.toLocaleLowerCase("en-US") === "pdf" &&
      segments.length === 5 &&
      sameFederalRegisterDocumentNumber(
        segments[4],
        documentNumber,
        ".pdf",
      )
    );
  })();

  return pathMatches ? safe : null;
}

function stableId(prefix: string, value: string) {
  const fragment = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `${prefix}-${fragment || "record"}`.slice(0, 100);
}

function errorMessage(error: unknown, timeoutMs: number, timedOut: boolean) {
  if (timedOut) return `Request timed out after ${timeoutMs} ms.`;
  if (error instanceof Error) {
    return normalizedText(
      `${error.name}: ${error.message}`,
      500,
      "Connector request failed.",
    );
  }
  return "Connector request failed with an unknown error.";
}

class ConnectorTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`Request timed out after ${timeoutMs} ms.`);
    this.name = "ConnectorTimeoutError";
  }
}

async function fetchJson(
  fetchImpl: Screen02ConnectorFetch,
  requestUrl: string,
  timeoutMs: number,
) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ConnectorTimeoutError(timeoutMs));
    }, timeoutMs);
  });
  const request = (async () => {
    const response = await fetchImpl(requestUrl, {
      method: "GET",
      headers: {
        accept: "application/json",
      },
      // Cloudflare Workers supports `follow` and `manual`, but rejects the
      // browser-standard `error` mode at the edge. Keep redirects manual so
      // the status check below fails closed instead of following an
      // unreviewed destination.
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Official API returned HTTP ${response.status}.`);
    }
    const contentLength = Number(
      response.headers.get("content-length"),
    );
    if (
      Number.isFinite(contentLength) &&
      contentLength > SCREEN_02_CONNECTOR_MAX_RESPONSE_BYTES
    ) {
      throw new Error("Official API response exceeded the byte limit.");
    }
    const contentType = (
      response.headers.get("content-type") ?? ""
    ).toLowerCase();
    if (contentType && !contentType.includes("json")) {
      throw new Error(
        "Official API returned an unsupported content type.",
      );
    }
    const body = await readScreen02BoundedResponseText(
      response,
      SCREEN_02_CONNECTOR_MAX_RESPONSE_BYTES,
    );
    return JSON.parse(body) as unknown;
  })();
  try {
    return await Promise.race([request, timeout]);
  } finally {
    // Also abort an in-flight body reader when the timeout branch wins; the
    // losing request promise must not continue consuming a large response.
    controller.abort();
    if (timer !== undefined) clearTimeout(timer);
  }
}

function failedResult(input: {
  connector: Screen02ConnectorDiagnostics["connector"];
  endpoint: string;
  requestUrl: string;
  retrievedAt: string;
  resultLimit: number;
  channel: string;
  queryLog: Screen02QueryLog;
  failure: string;
}): Screen02OfficialConnectorResult {
  const queryLog = {
    ...input.queryLog,
    returnedRecordIds: [],
  };
  const channelLog: Screen02ChannelLog = {
    channel: input.channel,
    status: "failed",
    retrievedAt: input.retrievedAt,
    note: `${input.failure} No outcome values were inspected and no candidate applicability was inferred.`,
  };
  return {
    proposals: [],
    proposalBindings: [],
    diagnostics: {
      connector: input.connector,
      endpoint: input.endpoint,
      requestUrl: input.requestUrl,
      retrievedAt: input.retrievedAt,
      resultLimit: input.resultLimit,
      recordsReceived: 0,
      recordsAccepted: 0,
      proposalsReturned: 0,
      invalidRecordsDropped: 0,
      duplicateRecordsConsolidated: 0,
      limitReached: false,
      failureKind: screen02ConnectorFailureKind(input.failure),
      queryMatrix: [queryLog],
      channels: [channelLog],
      outcomeValuesInspected: false,
    },
  };
}

function sourceAuthority(
  authorityTier: SourceAuthorityTier,
  reason: string,
) {
  return {
    authorityTier,
    authorityAssessment: {
      method: "connector-native" as const,
      reason,
      policyVersion: SCREEN_02_SOURCE_POLICY_VERSION,
    },
  };
}

function federalAgencies(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 8)
    .map((agency) => {
      if (!isRecord(agency)) return "";
      const typed = agency as FederalRegisterAgency;
      return normalizedText(
        typed.name ?? typed.raw_name,
        120,
      );
    })
    .filter(Boolean);
}

function federalExcerpts(value: unknown) {
  const excerpts = Array.isArray(value) ? value : [value];
  return excerpts
    .slice(0, 4)
    .map((excerpt) =>
      normalizedText(
        typeof excerpt === "string"
          ? excerpt.replace(/<[^>]*>/g, " ")
          : excerpt,
        300,
      ),
    )
    .filter(Boolean)
    .join(" ");
}

function federalSources(
  record: FederalRegisterRecord,
  documentNumber: string,
  title: string,
  publicationDate: string,
  retrievedAt: string,
): Screen02Source[] {
  const boundGovInfoPdf = federalRegisterRecordUrl(
    record.pdf_url,
    documentNumber,
    "govinfo-pdf",
  );
  const federalRegisterHtml = federalRegisterRecordUrl(
    record.html_url,
    documentNumber,
    "publication-html",
  );
  const federalRegisterBodyHtml = federalRegisterRecordUrl(
    record.body_html_url,
    documentNumber,
    "body-html",
  );
  const federalRegisterRawText = federalRegisterRecordUrl(
    record.raw_text_url,
    documentNumber,
    "raw-text",
  );
  const agencies = federalAgencies(record.agencies);
  const publisher = normalizedText(
    agencies.join("; "),
    200,
    "Office of the Federal Register",
  );
  const shared = {
    publisher,
    publishedDate: publicationDate,
    channel: FEDERAL_REGISTER_CHANNEL,
    retrievedAt,
  };
  const sources: Screen02Source[] = [];

  if (boundGovInfoPdf) {
    sources.push({
      id: stableId("fr-source", documentNumber),
      title,
      locator: boundGovInfoPdf,
      ...shared,
      ...sourceAuthority(
        1,
        "The connector used the Federal Register API's govinfo.gov PDF locator for the published document.",
      ),
    });
  }

  if (federalRegisterBodyHtml) {
    sources.push({
      id: stableId("fr-source-body-html", documentNumber),
      title: `${title} — Federal Register full-text HTML`,
      locator: federalRegisterBodyHtml,
      ...shared,
      ...sourceAuthority(
        2,
        "The Federal Register API supplied this bounded full-text HTML representation for the exact document number; the controlling govinfo.gov edition remains separately identified.",
      ),
    });
  }

  if (federalRegisterRawText) {
    sources.push({
      id: stableId("fr-source-raw-text", documentNumber),
      title: `${title} — Federal Register full text`,
      locator: federalRegisterRawText,
      ...shared,
      ...sourceAuthority(
        2,
        "The Federal Register API supplied this plain-text representation for the exact document number as a bounded alternative when the publication landing page is not machine-readable.",
      ),
    });
  }

  if (federalRegisterHtml) {
    sources.push({
      id: stableId(
        boundGovInfoPdf ? "fr-source-html" : "fr-source",
        documentNumber,
      ),
      title: boundGovInfoPdf ? `${title} — Federal Register HTML` : title,
      locator: federalRegisterHtml,
      ...shared,
      ...sourceAuthority(
        2,
        "The connector used the official FederalRegister.gov publication page; the controlling edition still requires verification.",
      ),
    });
  }

  if (sources.length === 0) {
    sources.push({
      id: stableId("fr-source", documentNumber),
      title,
      locator: `https://www.federalregister.gov/d/${encodeURIComponent(documentNumber)}`,
      ...shared,
      ...sourceAuthority(
        2,
        "The connector constructed the official FederalRegister.gov document locator because the API record supplied no accepted official locator.",
      ),
    });
  }

  return sources;
}

type FederalRegisterAdministrativeClassification =
  | "substantive"
  | "legacy-administrative"
  | "nonbinding-governance";

function normalizedIntentText(value: string | undefined) {
  return (value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function explicitlyRequestsAdministrativeEvents(
  eventFamily: string | undefined,
) {
  const normalized = normalizedIntentText(eventFamily);
  return (
    /\b(?:administrative|governance|advisory)\b/u.test(normalized) ||
    /\b(?:committee|council|charter|membership|recruitment|appointment)\b/u.test(
      normalized,
    )
  );
}

function isGenericRegulatoryEventFamily(
  eventFamily: string | undefined,
) {
  const normalized = normalizedIntentText(eventFamily);
  return /\b(?:regulation|regulatory|law|legal|rule|rules|statute|policy)\b/u.test(
    normalized,
  );
}

function queryExplicitlyNamesRecord(query: string, title: string) {
  const normalizedQuery = ` ${normalizedIntentText(query)} `;
  const normalizedTitle = normalizedIntentText(title);
  const distinctiveTitleTerms = normalizedTitle
    .split(" ")
    .filter((term) => term.length >= 3);
  return (
    distinctiveTitleTerms.length >= 2 &&
    normalizedQuery.includes(` ${normalizedTitle} `)
  );
}

/**
 * Federal Register NOTICE is a publication container, not proof that the
 * record creates a regulatory shock. Use only bounded API metadata and text,
 * and require paired body/process signals before classifying a governance
 * notice. Final/proposed rules and binding orders always remain substantive.
 */
function classifyFederalRegisterAdministrativeRecord(input: {
  title: string;
  type: string;
  action: string;
  abstract: string;
}): FederalRegisterAdministrativeClassification {
  if (/\brules?\b/i.test(input.type)) return "substantive";

  const evidence = `${input.title} ${input.action} ${input.abstract}`;
  const substantiveOverride =
    /\bconsent orders?\b/i.test(evidence) ||
    /^\s*(?:final|interim final|proposed) rules?\b/i.test(input.title) ||
    /\b(?:establish(?:es|ed|ing)|impose(?:s|d|ing)|create(?:s|d|ing))\b.{0,80}\b(?:binding )?(?:requirements?|obligations?|prohibitions?|standards?|duties)\b/i.test(
      evidence,
    ) ||
    /\b(?:covered entities|regulated parties)\b.{0,50}\b(?:must|shall|required)\b/i.test(
      evidence,
    );
  if (substantiveOverride) return "substantive";

  const legacyAdministrativeTitle =
    /\b(?:workshops?|meetings?|webinars?|conferences?|roundtables?|listening[- ]sessions?|advisory[- ]sessions?|advisory committee sessions?)\b/i.test(
      input.title,
    );
  if (legacyAdministrativeTitle) return "legacy-administrative";

  const governanceBody =
    /\b(?:advisory (?:committee|council|board|panel)|federal advisory committee|committee|council)\b/i.test(
      evidence,
    );
  const administrativeProcess =
    /\b(?:charter (?:renewal|renewed|reestablishment|reestablished)|renewal of\b.{0,100}\b(?:committee|council)|opportunit(?:y|ies) to apply|seek(?:s|ing)? (?:applications|applicants|candidates|nominations)|membership (?:applications?|recruitment|terms?|appointments?)|application deadline|nominations? for (?:appointment|membership)|appointments? to)\b/i.test(
      evidence,
    );
  const expresslyNonbinding =
    /\b(?:solely|strictly|purely) advisory\b|\bno regulatory authority\b|\bnonbinding\b/i.test(
      evidence,
    );
  if (
    expresslyNonbinding ||
    (governanceBody && administrativeProcess)
  ) {
    return "nonbinding-governance";
  }
  return "substantive";
}

function federalProposal(
  record: FederalRegisterRecord,
  input: FederalRegisterConnectorInput,
): Screen02FindProposal | null {
  const documentNumber = normalizedText(
    record.document_number,
    80,
  );
  const title = normalizedText(record.title, 500);
  const publicationDate = dateOnly(record.publication_date);
  if (!documentNumber || !title || !publicationDate) return null;

  const type = normalizedText(record.type, 80, "Rule");
  const sourceAbstract = normalizedText(
    record.abstract ?? record.action,
    500,
  );
  const abstract = normalizedText(
    [
      sourceAbstract,
      federalExcerpts(record.excerpts),
    ]
      .filter(Boolean)
      .join(" "),
    650,
    "The listing did not include a concise abstract.",
  );
  const administrativeClassification =
    classifyFederalRegisterAdministrativeRecord({
      title,
      type,
      action: normalizedText(record.action, 300),
      abstract,
    });
  const administrativeEventsRequested =
    input.workflowMode === "audit" ||
    explicitlyRequestsAdministrativeEvents(input.eventFamily) ||
    queryExplicitlyNamesRecord(input.query, title);
  const genericRegulatoryFind =
    input.workflowMode === "find" &&
    isGenericRegulatoryEventFamily(input.eventFamily);
  if (
    administrativeClassification === "legacy-administrative" &&
    !administrativeEventsRequested
  ) {
    return null;
  }
  if (
    administrativeClassification === "nonbinding-governance" &&
    genericRegulatoryFind &&
    !administrativeEventsRequested
  ) {
    return null;
  }
  const isAdministrativeEvent =
    administrativeClassification !== "substantive";
  const isPreliminaryDocument = /\b(?:proposed|notice)\b/i.test(type);
  const effectiveDate = dateOnly(record.effective_on);
  const outcomeFamily = requiredText(
    input.outcomeFamily,
    "outcomeFamily",
    300,
  );
  const agencies = federalAgencies(record.agencies);
  const evidenceText = [
    `${title}. Federal Register document ${documentNumber}.`,
    agencies.length > 0 ? `Issuing authority: ${agencies.join("; ")}.` : "",
    "Issuing jurisdiction: United States.",
    sourceAbstract.length === 0
      ? ""
      : sourceAbstract,
    effectiveDate ? `Effective date: ${effectiveDate}.` : "",
  ].filter(Boolean).join(" ");
  const sources = federalSources(
    record,
    documentNumber,
    title,
    publicationDate,
    input.retrievedAt,
  ).map((source) => evidenceText.length === 0
    ? source
    : { ...source, evidenceText });
  return {
    id: stableId("fr", documentNumber),
    mode: "find",
    kind: "event",
    title,
    description: normalizedText(
      isAdministrativeEvent
        ? `Nonbinding administrative/governance notice published in the Federal Register on ${publicationDate}. ${abstract} This record concerns an advisory, charter, membership, recruitment, or public-participation process and does not by itself establish a binding regulatory shock. Applicability to the requested organizational population is provisional.`
        : `${type} published in the Federal Register on ${publicationDate}. ${abstract} Applicability to the requested organizational population is provisional.`,
      1_000,
    ),
    nativeIdentity: {
      formalIdentifier: documentNumber,
      issuer:
        agencies.length > 0
          ? normalizedText(agencies.join("; "), 500)
          : null,
      issuingJurisdiction: "United States",
      status: isAdministrativeEvent
        ? "Nonbinding administrative/governance notice"
        : type,
    },
    event: {
      displayName: title,
      eventDate: publicationDate,
      eventFamily: isAdministrativeEvent
        ? "Administrative/governance event"
        : "Regulation",
      geographies: ["United States"],
      populations: [SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN],
    },
    origin: "newly-discovered",
    provisionalDates: [
      `Publication date: ${publicationDate}`,
      ...(effectiveDate
        ? [`Reported effective date: ${effectiveDate}`]
        : []),
    ],
    affectedPopulation: SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
    requiredVariables: [
      "Federal Register document number",
      "Verified operative event date",
      "Formal coverage or eligibility rule",
      "Organization-to-covered-entity linkage",
    ],
    outcomeLink: {
      text: normalizedText(
        `Source-grounded event feature: the official record describes “${title}” as follows: ${abstract} A candidate-specific pathway to ${outcomeFamily} still requires checking which requirement, permission, or market change reaches the focal organizations and which organizational response it could trigger. The connector did not inspect outcomes or establish that pathway.`,
        2_000,
      ),
      status: "system-template",
    },
    likelyServiceLevel: "event-reconnaissance",
    limitations: [
      "The publication date is a discovery anchor, not automatically the treatment date.",
      ...(isAdministrativeEvent
        ? [
            "This is a nonbinding administrative/governance record; it does not itself establish a legal duty, prohibition, compliance deadline, or enforcement exposure.",
          ]
        : []),
      ...(isPreliminaryDocument
        ? [
            "This record is a proposed-rule or notice-stage lead; verify whether and when an operative requirement followed.",
          ]
        : []),
      "Applicability to the confirmed study population is provisional and was not established by returned source metadata.",
      "Screen 3 must verify operative dates, coverage, thresholds, exemptions, amendments, and the controlling text.",
      "FederalRegister.gov metadata should be checked against the official govinfo.gov edition before reliance.",
    ],
    reasons: [
      isAdministrativeEvent
        ? `The official API returned this administrative/governance record for an explicitly permitted administrative or exact-event search at ${input.retrievedAt}.`
        : `The official API returned this regulatory-document record for the encoded query and publication-date window at ${input.retrievedAt}.`,
      "The connector inspected event metadata only and did not inspect outcome values.",
    ],
    sources,
  };
}

function federalRegisterRequestUrl(
  input: FederalRegisterConnectorInput,
  limit: number,
) {
  const query = requiredText(input.query, "query", 240);
  const documentTypes = [
    ...new Set(
      input.documentTypes ?? FEDERAL_REGISTER_DOCUMENT_TYPES,
    ),
  ];
  if (
    documentTypes.length === 0 ||
    documentTypes.some(
      (type) => !FEDERAL_REGISTER_DOCUMENT_TYPES.includes(type),
    )
  ) {
    throw new Error(
      "Federal Register documentTypes must contain only RULE, PRORULE, or NOTICE.",
    );
  }
  return boundedQueryRequestUrl(query, (boundedQuery) => {
    const url = new URL(FEDERAL_REGISTER_API_ENDPOINT);
    url.searchParams.set("conditions[term]", boundedQuery);
    url.searchParams.set(
      "conditions[publication_date][gte]",
      input.startDate,
    );
    url.searchParams.set(
      "conditions[publication_date][lte]",
      input.endDate,
    );
    for (const documentType of documentTypes) {
      url.searchParams.append("conditions[type][]", documentType);
    }
    for (const field of [
      "document_number",
      "title",
      "type",
      "abstract",
      "action",
      "excerpts",
      "html_url",
      "pdf_url",
      "raw_text_url",
      "body_html_url",
      "publication_date",
      "effective_on",
      "agencies",
    ]) {
      url.searchParams.append("fields[]", field);
    }
    url.searchParams.set("per_page", String(limit));
    url.searchParams.set("order", "relevance");
    return url.toString();
  });
}

export async function fetchFederalRegisterProposals(
  input: FederalRegisterConnectorInput,
): Promise<Screen02OfficialConnectorResult> {
  validateSharedInput(input);
  const exactDocumentNumber = input.exactDocumentNumber === undefined
    ? null
    : canonicalScreen02FederalRegisterFormalIdentifier(
        input.exactDocumentNumber,
      );
  if (
    input.exactDocumentNumber !== undefined &&
    exactDocumentNumber !== input.exactDocumentNumber
  ) {
    throw new Error(
      "exactDocumentNumber must be a canonical Federal Register document number.",
    );
  }
  if (
    exactDocumentNumber &&
    canonicalScreen02FederalRegisterFormalIdentifier(input.query) !==
      exactDocumentNumber
  ) {
    throw new Error(
      "An exact Federal Register bridge query must equal exactDocumentNumber.",
    );
  }
  const limit = boundedLimit(input.limit);
  const timeoutMs = boundedTimeout(input.timeoutMs);
  const { requestUrl, queryWasShortened } =
    federalRegisterRequestUrl(input, limit);
  const queryId = input.queryId
    ? stableId(
        "federal-register",
        requiredText(input.queryId, "queryId", 100),
      )
    : "federal-register-regulatory-documents";
  const queryPurpose = input.queryPurpose
    ? requiredText(input.queryPurpose, "queryPurpose", 1_500)
    : "Search official Federal Register publication metadata for regulatory documents matching the supplied term and date window.";
  const queryLog: Screen02QueryLog = {
    id: queryId,
    query: requestUrl,
    purpose: `${queryPurpose}${
      queryWasShortened
        ? " The supplied term was deterministically shortened so the exact encoded request remains within the persisted manifest limit."
        : ""
    }`,
  };

  let payload: unknown;
  try {
    payload = await fetchJson(input.fetch, requestUrl, timeoutMs);
  } catch (error) {
    return failedResult({
      connector: "federal-register-api-v1",
      endpoint: FEDERAL_REGISTER_API_ENDPOINT,
      requestUrl,
      retrievedAt: input.retrievedAt,
      resultLimit: limit,
      channel: FEDERAL_REGISTER_CHANNEL,
      queryLog,
      failure: errorMessage(
        error,
        timeoutMs,
        error instanceof ConnectorTimeoutError ||
          (error instanceof Error && error.name === "AbortError"),
      ),
    });
  }

  const typedPayload = isRecord(payload)
    ? (payload as FederalRegisterResponse)
    : {};
  const rawResults = Array.isArray(typedPayload.results)
    ? typedPayload.results.slice(0, limit)
    : [];
  const proposals: Screen02Proposal[] = [];
  const proposalBindings: Screen02OfficialProposalBinding[] = [];
  const bindingByProposalId = new Map<
    string,
    Screen02OfficialProposalBinding
  >();
  const acceptedDocumentNumbers = new Set<string>();
  const returnedRecordIds: string[] = [];
  let invalidRecordsDropped = 0;
  let duplicateRecordsConsolidated = 0;

  for (const raw of rawResults) {
    if (!isRecord(raw)) {
      invalidRecordsDropped += 1;
      continue;
    }
    const record = raw as FederalRegisterRecord;
    const documentNumber = normalizedText(
      record.document_number,
      80,
    );
    if (exactDocumentNumber && documentNumber !== exactDocumentNumber) {
      invalidRecordsDropped += 1;
      continue;
    }
    if (documentNumber && !returnedRecordIds.includes(documentNumber)) {
      returnedRecordIds.push(documentNumber);
    }
    const proposal = federalProposal(record, input);
    if (!proposal) {
      invalidRecordsDropped += 1;
      continue;
    }
    if (acceptedDocumentNumbers.has(proposal.id)) {
      duplicateRecordsConsolidated += 1;
      const binding = bindingByProposalId.get(proposal.id);
      if (
        binding &&
        documentNumber &&
        !binding.returnedRecordIds.includes(documentNumber)
      ) {
        binding.returnedRecordIds.push(documentNumber);
      }
      continue;
    }
    acceptedDocumentNumbers.add(proposal.id);
    proposals.push(proposal);
    const binding: Screen02OfficialProposalBinding = {
      proposalId: proposal.id,
      queryId,
      returnedRecordIds: [documentNumber],
      sourceIds: proposal.sources.map((source) => source.id),
    };
    proposalBindings.push(binding);
    bindingByProposalId.set(proposal.id, binding);
  }

  const reportedCount =
    typeof typedPayload.count === "number" &&
    Number.isFinite(typedPayload.count) &&
    typedPayload.count >= 0
      ? Math.floor(typedPayload.count)
      : null;
  const limitReached =
    reportedCount !== null
      ? reportedCount > rawResults.length
      : rawResults.length >= limit;
  queryLog.returnedRecordIds = returnedRecordIds;
  const channelLog: Screen02ChannelLog = {
    channel: FEDERAL_REGISTER_CHANNEL,
    status: "searched",
    retrievedAt: input.retrievedAt,
    note: `Retrieved ${rawResults.length} rule, proposed-rule, or notice records and created ${proposals.length} provisional candidates at ${input.retrievedAt}. ${
      limitReached
        ? `The ${limit}-record connector limit did not cover every matching API record.`
        : "The API response did not indicate additional matching records beyond this request."
    } Applicability was not verified and outcome values were not inspected.`,
  };

  return {
    proposals,
    proposalBindings,
    diagnostics: {
      connector: "federal-register-api-v1",
      endpoint: FEDERAL_REGISTER_API_ENDPOINT,
      requestUrl,
      retrievedAt: input.retrievedAt,
      resultLimit: limit,
      recordsReceived: rawResults.length,
      recordsAccepted:
        rawResults.length - invalidRecordsDropped,
      proposalsReturned: proposals.length,
      invalidRecordsDropped,
      duplicateRecordsConsolidated,
      limitReached,
      failureKind: "none",
      queryMatrix: [queryLog],
      channels: [channelLog],
      outcomeValuesInspected: false,
    },
  };
}

function odataQuoted(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function femaRequestUrl(input: OpenFemaConnectorInput, limit: number) {
  const filters = [
    `declarationDate ge '${input.startDate}T00:00:00.000Z'`,
    `declarationDate le '${input.endDate}T23:59:59.999Z'`,
  ];
  if (input.state !== undefined) {
    const state = input.state.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(state)) {
      throw new Error("state must be a two-letter U.S. postal code.");
    }
    filters.push(`state eq ${odataQuoted(state)}`);
  }
  if (input.incidentType !== undefined) {
    const incidentType = requiredText(
      input.incidentType,
      "incidentType",
      80,
    );
    if (!/^[A-Za-z0-9][A-Za-z0-9 /&(),.'-]*$/.test(incidentType)) {
      throw new Error(
        "incidentType contains unsupported search characters.",
      );
    }
    filters.push(`incidentType eq ${odataQuoted(incidentType)}`);
  }

  const url = new URL(OPEN_FEMA_API_ENDPOINT);
  url.searchParams.set("$filter", filters.join(" and "));
  url.searchParams.set(
    "$select",
    [
      "disasterNumber",
      "state",
      "declarationType",
      "declarationDate",
      "incidentType",
      "declarationTitle",
      "incidentBeginDate",
      "incidentEndDate",
      "designatedArea",
      "id",
      "lastRefresh",
    ].join(","),
  );
  url.searchParams.set("$top", String(limit));
  url.searchParams.set("$orderby", "declarationDate desc");
  url.searchParams.set("$format", "json");
  return url.toString();
}

function femaCandidate(record: OpenFemaRecord): FemaCandidate | null {
  const disasterNumber =
    typeof record.disasterNumber === "number" &&
    Number.isSafeInteger(record.disasterNumber) &&
    record.disasterNumber > 0
      ? record.disasterNumber
      : null;
  const state = normalizedText(record.state, 2).toUpperCase();
  const declarationDate = dateOnly(record.declarationDate);
  const declarationTitle = normalizedText(
    record.declarationTitle,
    180,
  );
  if (
    disasterNumber === null ||
    !/^[A-Z]{2}$/.test(state) ||
    !declarationDate ||
    !declarationTitle
  ) {
    return null;
  }
  return {
    disasterNumber,
    state,
    declarationType: normalizedText(
      record.declarationType,
      20,
      "Declaration",
    ),
    declarationDate,
    incidentType: normalizedText(
      record.incidentType,
      100,
      "Disaster",
    ),
    declarationTitle,
    incidentBeginDate: dateOnly(record.incidentBeginDate),
    incidentEndDate: dateOnly(record.incidentEndDate),
    designatedAreas: [
      normalizedText(record.designatedArea, 180),
    ].filter(Boolean),
    rawIds: [normalizedText(record.id, 100)].filter(Boolean),
  };
}

function mergeFemaCandidate(
  existing: FemaCandidate,
  incoming: FemaCandidate,
) {
  for (const area of incoming.designatedAreas) {
    if (
      !existing.designatedAreas.includes(area) &&
      existing.designatedAreas.length < 12
    ) {
      existing.designatedAreas.push(area);
    }
  }
  for (const id of incoming.rawIds) {
    if (!existing.rawIds.includes(id) && existing.rawIds.length < 20) {
      existing.rawIds.push(id);
    }
  }
  existing.incidentBeginDate ??= incoming.incidentBeginDate;
  existing.incidentEndDate ??= incoming.incidentEndDate;
}

function femaProposal(
  candidate: FemaCandidate,
  input: OpenFemaConnectorInput,
): Screen02FindProposal {
  const outcomeFamily = requiredText(
    input.outcomeFamily,
    "outcomeFamily",
    300,
  );
  const displayName = normalizedText(
    `${candidate.declarationTitle} (${candidate.state}, FEMA-${candidate.disasterNumber})`,
    240,
  );
  const areaSummary =
    candidate.designatedAreas.length > 0
      ? candidate.designatedAreas.join("; ")
      : "No designated-area value was returned.";
  const stateName = usStateNameForCode(candidate.state);
  const source: Screen02Source = {
    id: stableId(
      "fema-source",
      String(candidate.disasterNumber),
    ),
    title: normalizedText(
      `FEMA disaster ${candidate.disasterNumber}: ${candidate.declarationTitle}`,
      240,
    ),
    locator: `https://www.fema.gov/disaster/${candidate.disasterNumber}`,
    publisher: "Federal Emergency Management Agency (FEMA)",
    publishedDate: candidate.declarationDate,
    ...sourceAuthority(
      2,
      "OpenFEMA is an official FEMA administrative dataset summarizing disaster declarations; the underlying declaration and amendments still require verification.",
    ),
    channel: OPEN_FEMA_CHANNEL,
    retrievedAt: input.retrievedAt,
    // This is a bounded serialization of returned structured fields, not a
    // verbatim declaration passage or a generated applicability claim.
    evidenceText: normalizedText(
      [
        `${displayName}; Record identifier: FEMA-${candidate.disasterNumber}; Structured source-native fields (not a verbatim passage): FEMA recorded an official ${candidate.declarationType} disaster declaration for a ${candidate.incidentType} event in ${stateName ?? candidate.state} on ${candidate.declarationDate}; issuing jurisdiction: United States; designated-area location: ${areaSummary}.`,
        candidate.incidentBeginDate
          ? `Incident began: ${candidate.incidentBeginDate}.`
          : "",
        candidate.incidentEndDate
          ? `Incident ended: ${candidate.incidentEndDate}.`
          : "",
      ].filter(Boolean).join(" "),
      1_000,
    ),
  };

  return {
    id: stableId("fema", String(candidate.disasterNumber)),
    mode: "find",
    kind: "event",
    title: displayName,
    description: normalizedText(
      `FEMA recorded an official ${candidate.declarationType} disaster declaration for a ${candidate.incidentType} event in ${candidate.state}. The declaration returned these designated areas: ${areaSummary}. Organizational applicability is provisional.`,
      1_000,
    ),
    nativeIdentity: {
      formalIdentifier: `FEMA-${candidate.disasterNumber}`,
      issuer: "Federal Emergency Management Agency (FEMA)",
      issuingJurisdiction: "United States",
      status: `${candidate.declarationType} declaration`,
    },
    event: {
      displayName,
      eventDate: candidate.declarationDate,
      eventFamily: `${candidate.incidentType} disaster`,
      geographies: [
        "United States",
        ...(stateName ? [stateName] : []),
        candidate.state,
      ],
      populations: [SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN],
    },
    origin: "newly-discovered",
    provisionalDates: [
      `Declaration date: ${candidate.declarationDate}`,
      ...(candidate.incidentBeginDate
        ? [`Incident began: ${candidate.incidentBeginDate}`]
        : []),
      ...(candidate.incidentEndDate
        ? [`Incident ended: ${candidate.incidentEndDate}`]
        : []),
    ],
    affectedPopulation: SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
    requiredVariables: [
      "FEMA disaster number",
      ...(candidate.designatedAreas.length > 0
        ? ["Designated-area location"]
        : []),
      "Declaration and incident dates",
      "Organization-to-designated-area location linkage",
    ],
    outcomeLink: {
      text: normalizedText(
        `Source-grounded event feature: official FEMA metadata identifies “${displayName}” as a ${candidate.incidentType} event declared in ${candidate.state} on ${candidate.declarationDate}, with returned designated areas including ${areaSummary}. A candidate-specific pathway to ${outcomeFamily} still requires checking which focal organizations had operations, workers, customers, or suppliers in those areas; when disruption or assistance actually reached them; and which organizational response could affect the outcome. The connector did not inspect outcomes or establish that pathway.`,
        2_000,
      ),
      status: "system-template",
    },
    likelyServiceLevel: "event-reconnaissance",
    limitations: [
      "Applicability to the confirmed study population is provisional and was not established by returned source metadata.",
      "FEMA declaration dates, incident dates, assistance designations, and amendments can differ and require Screen 3 verification.",
      "The API dataset is organized by designated area, so a bounded result set may not contain every area for a declaration.",
      "A FEMA declaration does not by itself establish organization-level treatment or exogenous assignment.",
    ],
    reasons: [
      `OpenFEMA returned official declaration-summary metadata within the encoded date and optional event filters at ${input.retrievedAt}.`,
      "Duplicate designated-area rows in the bounded response were consolidated by FEMA disaster number.",
      "The connector inspected event metadata only and did not inspect outcome values.",
    ],
    sources: [source],
  };
}

export async function fetchOpenFemaDisasterProposals(
  input: OpenFemaConnectorInput,
): Promise<Screen02OfficialConnectorResult> {
  validateSharedInput(input);
  const limit = boundedLimit(input.limit);
  const timeoutMs = boundedTimeout(input.timeoutMs);
  const requestUrl = femaRequestUrl(input, limit);
  const queryLog: Screen02QueryLog = {
    id: "openfema-disaster-declarations",
    query: requestUrl,
    purpose:
      "Search official FEMA disaster-declaration summary records within the supplied date and optional state or incident-type filters.",
  };

  let payload: unknown;
  try {
    payload = await fetchJson(input.fetch, requestUrl, timeoutMs);
  } catch (error) {
    return failedResult({
      connector: "openfema-disaster-declarations-v2",
      endpoint: OPEN_FEMA_API_ENDPOINT,
      requestUrl,
      retrievedAt: input.retrievedAt,
      resultLimit: limit,
      channel: OPEN_FEMA_CHANNEL,
      queryLog,
      failure: errorMessage(
        error,
        timeoutMs,
        error instanceof ConnectorTimeoutError ||
          (error instanceof Error && error.name === "AbortError"),
      ),
    });
  }

  const typedPayload = isRecord(payload)
    ? (payload as OpenFemaResponse)
    : {};
  const rawResults = Array.isArray(
    typedPayload.DisasterDeclarationsSummaries,
  )
    ? typedPayload.DisasterDeclarationsSummaries.slice(0, limit)
    : [];
  const candidates = new Map<number, FemaCandidate>();
  const returnedRecordIds: string[] = [];
  let invalidRecordsDropped = 0;
  let validRecordsAccepted = 0;

  for (const raw of rawResults) {
    if (!isRecord(raw)) {
      invalidRecordsDropped += 1;
      continue;
    }
    const record = raw as OpenFemaRecord;
    const returnedId = normalizedText(record.id, 100);
    if (returnedId) returnedRecordIds.push(returnedId);
    const candidate = femaCandidate(record);
    if (!candidate) {
      invalidRecordsDropped += 1;
      continue;
    }
    validRecordsAccepted += 1;
    const existing = candidates.get(candidate.disasterNumber);
    if (existing) {
      mergeFemaCandidate(existing, candidate);
    } else {
      candidates.set(candidate.disasterNumber, candidate);
    }
  }

  const proposals: Screen02Proposal[] = [];
  const proposalBindings: Screen02OfficialProposalBinding[] = [];
  for (const candidate of candidates.values()) {
    const proposal = femaProposal(candidate, input);
    proposals.push(proposal);
    proposalBindings.push({
      proposalId: proposal.id,
      queryId: queryLog.id,
      returnedRecordIds: [...candidate.rawIds],
      sourceIds: proposal.sources.map((source) => source.id),
    });
  }
  const limitReached = rawResults.length >= limit;
  queryLog.returnedRecordIds = returnedRecordIds;
  const channelLog: Screen02ChannelLog = {
    channel: OPEN_FEMA_CHANNEL,
    status: "searched",
    retrievedAt: input.retrievedAt,
    note: `Retrieved ${rawResults.length} designated-area records and consolidated them into ${proposals.length} provisional disaster candidates at ${input.retrievedAt}. ${
      limitReached
        ? `The ${limit}-record connector limit was reached, so additional declarations or designated areas may exist.`
        : "The returned record count was below the connector limit."
    } Organizational applicability was not verified and outcome values were not inspected.`,
  };

  return {
    proposals,
    proposalBindings,
    diagnostics: {
      connector: "openfema-disaster-declarations-v2",
      endpoint: OPEN_FEMA_API_ENDPOINT,
      requestUrl,
      retrievedAt: input.retrievedAt,
      resultLimit: limit,
      recordsReceived: rawResults.length,
      recordsAccepted: validRecordsAccepted,
      proposalsReturned: proposals.length,
      invalidRecordsDropped,
      duplicateRecordsConsolidated:
        validRecordsAccepted - candidates.size,
      limitReached,
      failureKind: "none",
      queryMatrix: [queryLog],
      channels: [channelLog],
      outcomeValuesInspected: false,
    },
  };
}
