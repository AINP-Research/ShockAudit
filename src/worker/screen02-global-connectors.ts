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
import { readScreen02BoundedResponseText } from "./screen02-bounded-response";
import {
  SCREEN_02_CONNECTOR_DEFAULT_LIMIT,
  SCREEN_02_CONNECTOR_DEFAULT_TIMEOUT_MS,
  SCREEN_02_CONNECTOR_MAX_LIMIT,
  SCREEN_02_CONNECTOR_MAX_RECORDED_REQUEST_URL_LENGTH,
  SCREEN_02_CONNECTOR_MAX_TIMEOUT_MS,
  screen02ConnectorFailureKind,
  type Screen02ConnectorDiagnostics,
  type Screen02ConnectorFetch,
  type Screen02OfficialConnectorResult,
  type Screen02OfficialProposalBinding,
} from "./screen02-connectors";
import {
  getScreen02SourceCatalogEntry,
  type Screen02ConnectorId,
} from "./screen02-source-router";
import { SHOCKAUDIT_OFFICIAL_SOURCE_USER_AGENT } from "./screen02-secure-transport";

export const EU_CELLAR_SPARQL_ENDPOINT =
  "https://publications.europa.eu/webapi/rdf/sparql";
export const UK_LEGISLATION_ATOM_ENDPOINT =
  "https://www.legislation.gov.uk/all/data.feed";
export const GDACS_EVENT_SEARCH_ENDPOINT =
  "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH";
export const USGS_EARTHQUAKE_API_ENDPOINT =
  "https://earthquake.usgs.gov/fdsnws/event/1/query";

export const SCREEN_02_GLOBAL_CONNECTOR_MAX_RESPONSE_BYTES =
  2_000_000;

export type Screen02GlobalConnectorSharedInput = {
  fetch: Screen02ConnectorFetch;
  retrievedAt: string;
  startDate: string;
  endDate: string;
  population: string;
  outcomeFamily: string;
  limit?: number;
  timeoutMs?: number;
  /** Stable caller-owned query identity for exact multi-query manifests. */
  queryId?: string;
  queryPurpose?: string;
};

export const EU_CELLAR_LANGUAGE_CODES = {
  bg: "BUL",
  hr: "HRV",
  cs: "CES",
  da: "DAN",
  nl: "NLD",
  en: "ENG",
  et: "EST",
  fi: "FIN",
  fr: "FRA",
  de: "DEU",
  el: "ELL",
  hu: "HUN",
  ga: "GLE",
  it: "ITA",
  lv: "LAV",
  lt: "LIT",
  mt: "MLT",
  pl: "POL",
  pt: "POR",
  ro: "RON",
  sk: "SLK",
  sl: "SLV",
  es: "SPA",
  sv: "SWE",
} as const;

export type EuCellarLanguageCode =
  keyof typeof EU_CELLAR_LANGUAGE_CODES;

export type EuCellarConnectorInput =
  Screen02GlobalConnectorSharedInput & {
    query: string;
    language?: EuCellarLanguageCode;
    /** Exact CELEX lookup for an already selected instrument; never discovery inference. */
    celexId?: string;
    /** Identity lookup requires every name term; broad discovery retains its existing OR search. */
    titleMatch?: "all_terms" | "any_term";
  };

export type UkLegislationConnectorInput =
  Screen02GlobalConnectorSharedInput & {
    query: string;
  };

export const GDACS_EVENT_TYPES = [
  "EQ",
  "TC",
  "FL",
  "VO",
  "WF",
  "DR",
  "TS",
] as const;
export type GdacsEventType = (typeof GDACS_EVENT_TYPES)[number];

export const GDACS_ALERT_LEVELS = [
  "red",
  "orange",
  "green",
] as const;
export type GdacsAlertLevel = (typeof GDACS_ALERT_LEVELS)[number];

export type GdacsConnectorInput =
  Screen02GlobalConnectorSharedInput & {
    eventTypes?: readonly GdacsEventType[];
    alertLevels?: readonly GdacsAlertLevel[];
    countryName?: string;
    countryIso3?: string;
  };

const GDACS_COUNTRY_NAME_BY_SUPPORTED_ISO3 = {
  GBR: "United Kingdom",
  USA: "United States",
} as const;

export type UsgsBoundingBox = {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
};

export type UsgsEarthquakeConnectorInput =
  Screen02GlobalConnectorSharedInput & {
    boundingBox?: UsgsBoundingBox;
    minMagnitude?: number;
    geographyLabel?: string;
  };

type JsonRecord = Record<string, unknown>;

const EU_CELLAR_CHANNEL =
  "EU Publications Office CELLAR SPARQL";
const UK_LEGISLATION_CHANNEL =
  "UK legislation.gov.uk Atom search";
const GDACS_CHANNEL = "GDACS global event search";
const USGS_CHANNEL = "USGS FDSN earthquake catalog";

/**
 * CELLAR exposes a controlled resource-type code. Keep the reader-facing
 * event family tied to that code instead of classifying every EU document as
 * a regulation. Unknown codes remain explicitly generic rather than being
 * promoted to a known legal instrument type.
 */
function euCellarEventFamily(legalType: string) {
  const code = legalType.toLocaleUpperCase("en-US");
  if (/^(?:DIR|DIRECTIVE)(?:$|[_-])/u.test(code)) return "Directive";
  if (/^(?:REG|REGULATION)(?:$|[_-])/u.test(code)) return "Regulation";
  if (/^(?:DEC|DECISION)(?:$|[_-])/u.test(code)) return "Decision";
  return legalType === "EU legal document"
    ? legalType
    : `EU legal document (${legalType})`;
}

function isRecord(value: unknown): value is JsonRecord {
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
  if (typeof value !== "string" && typeof value !== "number") {
    return fallback;
  }
  const normalized = String(value)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized
    ? normalized.slice(0, maxLength)
    : fallback;
}

function requiredText(value: unknown, label: string, maxLength: number) {
  const normalized = normalizedText(value, maxLength + 1);
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

function dateOnly(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const candidate = value.slice(0, 10);
  return validCalendarDate(candidate) ? candidate : null;
}

function dateFromEpoch(value: unknown): string | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return dateOnly(value);
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf())
    ? parsed.toISOString().slice(0, 10)
    : null;
}

function validateSharedInput(
  input: Screen02GlobalConnectorSharedInput,
) {
  if (typeof input.fetch !== "function") {
    throw new Error("An injected fetch implementation is required.");
  }
  if (
    typeof input.retrievedAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?Z$/.test(
      input.retrievedAt,
    ) ||
    !Number.isFinite(Date.parse(input.retrievedAt))
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

function boundedLimit(
  limit = SCREEN_02_CONNECTOR_DEFAULT_LIMIT,
) {
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

function stableId(prefix: string, value: string) {
  const fragment = value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `${prefix}-${fragment || "record"}`.slice(0, 100);
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

function safeOfficialUrl(
  value: unknown,
  allowedHosts: ReadonlySet<string>,
  allowHttpUpgrade = false,
) {
  if (typeof value !== "string" || value.length > 2_048) {
    return null;
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "http:" && allowHttpUpgrade) {
      parsed.protocol = "https:";
    }
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      (parsed.port !== "" && parsed.port !== "443") ||
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

class ConnectorTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`Request timed out after ${timeoutMs} ms.`);
    this.name = "ConnectorTimeoutError";
  }
}

function failureMessage(
  error: unknown,
  timeoutMs: number,
) {
  if (
    error instanceof ConnectorTimeoutError ||
    (error instanceof Error && error.name === "AbortError")
  ) {
    return `Request timed out after ${timeoutMs} ms.`;
  }
  if (error instanceof Error) {
    return normalizedText(
      `${error.name}: ${error.message}`,
      500,
      "Connector request failed.",
    );
  }
  return "Connector request failed with an unknown error.";
}

function validateRequestUrl(
  requestUrl: string,
  connectorId: Screen02ConnectorId,
) {
  const allowedHosts = new Set(
    getScreen02SourceCatalogEntry(connectorId).requestHosts,
  );
  const parsed = new URL(requestUrl);
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.hash ||
    (parsed.port !== "" && parsed.port !== "443") ||
    !allowedHosts.has(parsed.hostname.toLowerCase())
  ) {
    throw new Error(
      `Connector request URL is outside the ${connectorId} allowlist.`,
    );
  }
}

async function fetchBoundedText(input: {
  fetch: Screen02ConnectorFetch;
  connectorId: Screen02ConnectorId;
  requestUrl: string;
  timeoutMs: number;
  accept: string;
  acceptedContentTypes: readonly string[];
  userAgent?: string;
}) {
  validateRequestUrl(input.requestUrl, input.connectorId);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ConnectorTimeoutError(input.timeoutMs));
    }, input.timeoutMs);
  });
  const request = (async () => {
    const response = await input.fetch(input.requestUrl, {
      method: "GET",
      headers: {
        accept: input.accept,
        ...(input.userAgent ? { "user-agent": input.userAgent } : {}),
      },
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
      contentLength >
        SCREEN_02_GLOBAL_CONNECTOR_MAX_RESPONSE_BYTES
    ) {
      throw new Error("Official API response exceeded the byte limit.");
    }
    const contentType = (
      response.headers.get("content-type") ?? ""
    ).toLowerCase();
    if (
      contentType &&
      !input.acceptedContentTypes.some((allowed) =>
        contentType.includes(allowed),
      )
    ) {
      throw new Error(
        "Official API returned an unsupported content type.",
      );
    }
    return readScreen02BoundedResponseText(
      response,
      SCREEN_02_GLOBAL_CONNECTOR_MAX_RESPONSE_BYTES,
    );
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

async function fetchBoundedJson(input: {
  fetch: Screen02ConnectorFetch;
  connectorId: Screen02ConnectorId;
  requestUrl: string;
  timeoutMs: number;
}) {
  const body = await fetchBoundedText({
    ...input,
    accept:
      "application/json, application/geo+json, application/sparql-results+json",
    acceptedContentTypes: [
      "application/json",
      "application/geo+json",
      "application/sparql-results+json",
    ],
  });
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error("Official API returned invalid JSON.");
  }
}

function failedResult(input: {
  connector: Screen02ConnectorId;
  endpoint: string;
  requestUrl: string;
  retrievedAt: string;
  resultLimit: number;
  channel: string;
  queryLog: Screen02QueryLog;
  failure: string;
}): Screen02OfficialConnectorResult {
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
      queryMatrix: [
        {
          ...input.queryLog,
          returnedRecordIds: [],
        },
      ],
      channels: [
        {
          channel: input.channel,
          status: "failed",
          retrievedAt: input.retrievedAt,
          note: `${input.failure} No outcome values were inspected and no candidate applicability was inferred.`,
        },
      ],
      outcomeValuesInspected: false,
    },
  };
}

function successfulResult(input: {
  connector: Screen02ConnectorId;
  endpoint: string;
  requestUrl: string;
  retrievedAt: string;
  resultLimit: number;
  channel: string;
  queryLog: Screen02QueryLog;
  returnedRecordIds: string[];
  recordsReceived: number;
  recordsAccepted: number;
  proposals: Screen02Proposal[];
  proposalBindings: Screen02OfficialProposalBinding[];
  invalidRecordsDropped: number;
  duplicateRecordsConsolidated: number;
  limitReached: boolean;
  note: string;
}): Screen02OfficialConnectorResult {
  const channelLog: Screen02ChannelLog = {
    channel: input.channel,
    status: "searched",
    retrievedAt: input.retrievedAt,
    note: input.note,
  };
  const diagnostics: Screen02ConnectorDiagnostics = {
    connector: input.connector,
    endpoint: input.endpoint,
    requestUrl: input.requestUrl,
    retrievedAt: input.retrievedAt,
    resultLimit: input.resultLimit,
    recordsReceived: input.recordsReceived,
    recordsAccepted: input.recordsAccepted,
    proposalsReturned: input.proposals.length,
    invalidRecordsDropped: input.invalidRecordsDropped,
    duplicateRecordsConsolidated:
      input.duplicateRecordsConsolidated,
    limitReached: input.limitReached,
    failureKind: "none",
    queryMatrix: [
      {
        ...input.queryLog,
        returnedRecordIds: input.returnedRecordIds,
      },
    ],
    channels: [channelLog],
    outcomeValuesInspected: false,
  };
  return {
    proposals: input.proposals,
    proposalBindings: input.proposalBindings,
    diagnostics,
  };
}

function officialProposalBinding(
  proposal: Screen02Proposal,
  queryId: string,
  returnedRecordIds: string[],
): Screen02OfficialProposalBinding {
  return {
    proposalId: proposal.id,
    queryId,
    returnedRecordIds: [...new Set(returnedRecordIds)],
    sourceIds: proposal.sources.map((source) => source.id),
  };
}

function appendProposalReturnedRecordId(
  binding: Screen02OfficialProposalBinding | undefined,
  returnedRecordId: string,
) {
  if (
    binding &&
    returnedRecordId &&
    !binding.returnedRecordIds.includes(returnedRecordId)
  ) {
    binding.returnedRecordIds.push(returnedRecordId);
  }
}

function makeProposal(input: {
  id: string;
  title: string;
  description: string;
  eventDate: string;
  eventFamily: string;
  geographies: string[];
  outcomeFamily: string;
  provisionalDates: string[];
  requiredVariables: string[];
  limitations: string[];
  reasons: string[];
  source: Screen02Source;
  nativeIdentity?: Screen02FindProposal["nativeIdentity"];
}): Screen02FindProposal {
  const evidenceText = input.source.evidenceText?.trim()
    ? normalizedText(input.source.evidenceText, 1_500)
    : normalizedText(
        [
          `${input.title}.`,
          input.description,
          ...input.provisionalDates,
          `Reported geography: ${input.geographies.join("; ")}.`,
        ].join(" "),
        1_500,
      );
  return {
    id: input.id,
    mode: "find",
    kind: "event",
    title: input.title,
    description: input.description,
    ...(input.nativeIdentity
      ? { nativeIdentity: { ...input.nativeIdentity } }
      : {}),
    event: {
      displayName: input.title,
      eventDate: input.eventDate,
      eventFamily: input.eventFamily,
      geographies: input.geographies,
      populations: [SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN],
    },
    origin: "newly-discovered",
    provisionalDates: input.provisionalDates,
    affectedPopulation: SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
    requiredVariables: input.requiredVariables,
    outcomeLink: {
      text: normalizedText(
        `Source-grounded event feature: ${input.description} A candidate-specific pathway from ${input.title} to ${input.outcomeFamily} still requires checking the organizational exposure and response implied by this record. The connector did not inspect outcomes or establish that pathway.`,
        2_000,
      ),
      status: "system-template",
    },
    likelyServiceLevel: "event-reconnaissance",
    limitations: input.limitations,
    reasons: [
      ...input.reasons,
      "The connector inspected event metadata only and did not inspect outcome values.",
    ],
    // Connector-specific structured-field serializations take precedence;
    // otherwise retain the legacy bounded projection for adapters whose
    // metadata shape does not yet provide one.
    sources: [{ ...input.source, evidenceText }],
  };
}

function sparqlStringLiteral(value: string) {
  return JSON.stringify(value);
}

function euCellarQueryTerms(value: string) {
  const sparqlWords = new Set([
    "filter",
    "optional",
    "select",
    "union",
    "where",
  ]);
  return [
    ...new Set(
      value
        .toLocaleLowerCase("en-US")
        .match(/[\p{L}\p{N}]{3,}/gu) ?? [],
    ),
  ]
    .filter((term) => !sparqlWords.has(term))
    .slice(0, 8);
}

function euCellarRequestUrl(
  input: EuCellarConnectorInput,
  limit: number,
) {
  const query = requiredText(input.query, "query", 240);
  if (input.celexId !== undefined && !/^3\d{4}[RLD]\d{4}$/u.test(input.celexId)) {
    throw new Error("celexId must identify an exact EU regulation, directive, or decision.");
  }
  const language = input.language ?? "en";
  const languageAuthority =
    EU_CELLAR_LANGUAGE_CODES[language];
  if (!languageAuthority) {
    throw new Error("language must be an official EU language code.");
  }
  return boundedQueryRequestUrl(query, (boundedQuery) => {
    const titleTerms = euCellarQueryTerms(boundedQuery);
    const titleFilter = input.celexId
      ? [`  FILTER(STR(?celex) = ${sparqlStringLiteral(input.celexId)} || LCASE(STR(?celex)) = ${sparqlStringLiteral(`celex:${input.celexId.toLowerCase()}`)})`]
      : titleTerms.length === 0
        ? []
        : [
            `  FILTER(${titleTerms
              .map(
                (term) =>
                  `CONTAINS(LCASE(STR(?title)), LCASE(${sparqlStringLiteral(term)}))`,
              )
              .join(input.titleMatch === "all_terms" ? " && " : " || ")})`,
          ];
    const sparql = [
      "PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>",
      "PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>",
      "SELECT DISTINCT ?work ?celex ?title ?date ?type WHERE {",
      "  ?work cdm:work_date_document ?date .",
      "  ?work cdm:work_id_document ?celex .",
      "  ?expression cdm:expression_belongs_to_work ?work ;",
      `    cdm:expression_uses_language <http://publications.europa.eu/resource/authority/language/${languageAuthority}> ;`,
      "    cdm:expression_title ?title .",
      "  OPTIONAL { ?work cdm:resource_legal_type ?type . }",
      `  FILTER(?date >= ${sparqlStringLiteral(input.startDate)}^^xsd:date && ?date <= ${sparqlStringLiteral(input.endDate)}^^xsd:date)`,
      ...titleFilter,
      "}",
      "ORDER BY DESC(?date)",
      `LIMIT ${limit}`,
    ].join("\n");
    const url = new URL(EU_CELLAR_SPARQL_ENDPOINT);
    url.searchParams.set("query", sparql);
    url.searchParams.set(
      "format",
      "application/sparql-results+json",
    );
    return url.toString();
  });
}

function sparqlBindingValue(
  binding: JsonRecord,
  key: string,
) {
  const cell = binding[key];
  return isRecord(cell)
    ? normalizedText(cell.value, 600)
    : "";
}

export async function fetchEuCellarLegalProposals(
  input: EuCellarConnectorInput,
): Promise<Screen02OfficialConnectorResult> {
  validateSharedInput(input);
  const limit = boundedLimit(input.limit);
  const timeoutMs = boundedTimeout(input.timeoutMs);
  const { requestUrl, queryWasShortened } =
    euCellarRequestUrl(input, limit);
  const queryLog: Screen02QueryLog = {
    id: normalizedText(input.queryId, 120, "eu-cellar-legal-documents"),
    query: requestUrl,
    purpose: `${normalizedText(
      input.queryPurpose,
      500,
      "Search official EU CELLAR legal-document metadata by title term, document date, and selected official EU language.",
    )}${
      queryWasShortened
        ? " The supplied term was deterministically shortened so the exact encoded request remains within the persisted manifest limit."
        : ""
    }`,
  };
  let payload: unknown;
  try {
    payload = await fetchBoundedJson({
      fetch: input.fetch,
      connectorId: "eu-cellar-sparql-v1",
      requestUrl,
      timeoutMs,
    });
  } catch (error) {
    return failedResult({
      connector: "eu-cellar-sparql-v1",
      endpoint: EU_CELLAR_SPARQL_ENDPOINT,
      requestUrl,
      retrievedAt: input.retrievedAt,
      resultLimit: limit,
      channel: EU_CELLAR_CHANNEL,
      queryLog,
      failure: failureMessage(error, timeoutMs),
    });
  }

  const results =
    isRecord(payload) && isRecord(payload.results)
      ? payload.results
      : {};
  const allBindings = Array.isArray(results.bindings)
    ? results.bindings
    : [];
  const rawBindings = allBindings.slice(0, limit);
  const locatorLanguage = (input.language ?? "en").toUpperCase();
  const proposals: Screen02Proposal[] = [];
  const proposalBindings: Screen02OfficialProposalBinding[] = [];
  const bindingByProposalId = new Map<
    string,
    Screen02OfficialProposalBinding
  >();
  const ids = new Set<string>();
  const returnedRecordIds: string[] = [];
  let invalidRecordsDropped = 0;
  let duplicateRecordsConsolidated = 0;

  for (const raw of rawBindings) {
    if (!isRecord(raw)) {
      invalidRecordsDropped += 1;
      continue;
    }
    // CELLAR work_id_document also returns non-CELEX identifiers (genpub,
    // consolidation, etc.). Only construct EUR-Lex URLs from CELEX values.
    const rawIdentifier = sparqlBindingValue(raw, "celex");
    const celex = rawIdentifier.replace(/^celex:/iu, "").toUpperCase();
    const title = normalizedText(
      sparqlBindingValue(raw, "title"),
      240,
    );
    const documentDate = dateOnly(
      sparqlBindingValue(raw, "date"),
    );
    if (celex) returnedRecordIds.push(celex);
    if (
      !celex ||
      !/^[0-9][0-9A-Z]{4,40}(?:[-()/.][0-9A-Z]+)*$/u.test(celex) ||
      (input.celexId !== undefined && celex !== input.celexId) ||
      !title ||
      !documentDate ||
      documentDate < input.startDate ||
      documentDate > input.endDate
    ) {
      invalidRecordsDropped += 1;
      continue;
    }
    const id = stableId("eu-law", celex);
    if (ids.has(id)) {
      duplicateRecordsConsolidated += 1;
      appendProposalReturnedRecordId(
        bindingByProposalId.get(id),
        celex,
      );
      continue;
    }
    ids.add(id);
    const locator = new URL(
      `https://eur-lex.europa.eu/legal-content/${locatorLanguage}/TXT/`,
    );
    locator.searchParams.set("uri", `CELEX:${celex}`);
    const legalType = normalizedText(
      sparqlBindingValue(raw, "type").split("/").pop(),
      100,
      "EU legal document",
    );
    const eventFamily = euCellarEventFamily(legalType);
    const source: Screen02Source = {
      id: stableId("eu-source", celex),
      title,
      locator: locator.toString(),
      publisher: "Publications Office of the European Union",
      publishedDate: documentDate,
      ...sourceAuthority(
        2,
        "CELLAR is the official EU Publications Office repository; the controlling text, legal effect, and implementation still require verification.",
      ),
      channel: EU_CELLAR_CHANNEL,
      retrievedAt: input.retrievedAt,
    };
    const proposal = makeProposal({
        id,
        title,
        description: `${legalType} recorded by the official EU Publications Office on ${documentDate}. Applicability to the requested population and jurisdiction is provisional.`,
        eventDate: documentDate,
        eventFamily,
        geographies: ["European Union"],
        outcomeFamily: input.outcomeFamily,
        provisionalDates: [`Document date: ${documentDate}`],
        requiredVariables: [
          "CELEX identifier",
          "Verified operative or implementation date",
          "Territorial and substantive coverage rule",
          "Organization-to-covered-entity linkage",
        ],
        limitations: [
          "The CELLAR document date is a discovery anchor, not automatically the treatment date.",
          "National transposition, implementation, enforcement, amendments, thresholds, and exemptions require Screen 3 verification.",
          "EU-level metadata does not establish applicability to any particular organization or member state.",
        ],
        reasons: [
          `Official CELLAR metadata matched the encoded title term, date window, and selected language at ${input.retrievedAt}.`,
        ],
        source,
        nativeIdentity: {
          formalIdentifier: celex,
          issuer: null,
          issuingJurisdiction: "European Union",
          status: legalType,
        },
      });
    proposals.push(proposal);
    const binding = officialProposalBinding(
      proposal,
      queryLog.id,
      [celex],
    );
    proposalBindings.push(binding);
    bindingByProposalId.set(proposal.id, binding);
  }

  const limitReached = allBindings.length >= limit;
  return successfulResult({
    connector: "eu-cellar-sparql-v1",
    endpoint: EU_CELLAR_SPARQL_ENDPOINT,
    requestUrl,
    retrievedAt: input.retrievedAt,
    resultLimit: limit,
    channel: EU_CELLAR_CHANNEL,
    queryLog,
    returnedRecordIds,
    recordsReceived: rawBindings.length,
    recordsAccepted:
      rawBindings.length - invalidRecordsDropped,
    proposals,
    proposalBindings,
    invalidRecordsDropped,
    duplicateRecordsConsolidated,
    limitReached,
    note: `Retrieved ${rawBindings.length} EU legal-document records and created ${proposals.length} provisional candidates. ${
      limitReached
        ? `The ${limit}-record limit was reached.`
        : "The returned record count was below the connector limit."
    } National implementation and unit-level applicability were not verified; outcome values were not inspected.`,
  });
}

function ukLegislationRequestUrl(
  input: UkLegislationConnectorInput,
) {
  const query = requiredText(input.query, "query", 240);
  const startYear = input.startDate.slice(0, 4);
  const endYear = input.endDate.slice(0, 4);
  const yearPath = startYear === endYear
    ? startYear
    : `${startYear}-${endYear}`;
  return boundedQueryRequestUrl(query, (boundedQuery) => {
    const url = new URL(UK_LEGISLATION_ATOM_ENDPOINT);
    url.pathname = `/all/${yearPath}/data.feed`;
    url.searchParams.set("title", boundedQuery);
    return url.toString();
  });
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => {
      const codePoint = Number.parseInt(hex, 16);
      return Number.isSafeInteger(codePoint) &&
        codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : "";
    })
    .replace(/&#(\d+);/g, (_match, decimal: string) => {
      const codePoint = Number.parseInt(decimal, 10);
      return Number.isSafeInteger(codePoint) &&
        codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : "";
    })
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function xmlElementText(xml: string, localName: string) {
  const expression = new RegExp(
    `<(?:[A-Za-z][\\w.-]*:)?${localName}\\b[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z][\\w.-]*:)?${localName}>`,
    "i",
  );
  const value = expression.exec(xml)?.[1] ?? "";
  return normalizedText(
    decodeXmlEntities(
      value
        .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/i, "$1")
        .replace(/<[^>]+>/g, " "),
    ),
    600,
  );
}

function xmlElementAttribute(
  xml: string,
  localName: string,
  attribute: string,
) {
  const tagExpression = new RegExp(
    `<(?:[A-Za-z][\\w.-]*:)?${localName}\\b[^>]*>`,
    "i",
  );
  const tag = tagExpression.exec(xml)?.[0] ?? "";
  const attributeExpression = new RegExp(
    `\\b${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,
    "i",
  );
  const match = attributeExpression.exec(tag);
  return decodeXmlEntities(match?.[1] ?? match?.[2] ?? "");
}

type UkAtomEntry = {
  id: string;
  title: string;
  date: string | null;
  locator: string | null;
};

function parseUkAtomEntries(
  xml: string,
  maximumEntries: number,
) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
    throw new Error(
      "Official Atom response contained a prohibited declaration.",
    );
  }
  const entries: UkAtomEntry[] = [];
  const expression = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
  let match: RegExpExecArray | null;
  while (
    entries.length < maximumEntries &&
    (match = expression.exec(xml)) !== null
  ) {
    const entry = match[1] ?? "";
    const id = xmlElementText(entry, "id");
    const title =
      xmlElementText(entry, "title") ||
      xmlElementText(entry, "Title");
    const enactmentDate = xmlElementAttribute(
      entry,
      "EnactmentDate",
      "Date",
    );
    const creationDate = xmlElementAttribute(
      entry,
      "CreationDate",
      "Date",
    );
    const date =
      dateOnly(enactmentDate) ??
      dateOnly(creationDate) ??
      dateOnly(xmlElementText(entry, "published")) ??
      dateOnly(xmlElementText(entry, "updated"));
    const links =
      entry.match(/<link\b[^>]*>/gi) ?? [];
    let locator: string | null = null;
    for (const link of links) {
      const rel = xmlElementAttribute(
        link.replace(/\/?>$/, "></link>"),
        "link",
        "rel",
      );
      const href = xmlElementAttribute(
        link.replace(/\/?>$/, "></link>"),
        "link",
        "href",
      );
      if (!rel || rel === "alternate") {
        locator = safeOfficialUrl(
          href,
          new Set([
            "www.legislation.gov.uk",
            "legislation.gov.uk",
          ]),
          true,
        );
        if (locator) break;
      }
    }
    locator ??= safeOfficialUrl(
      id,
      new Set([
        "www.legislation.gov.uk",
        "legislation.gov.uk",
      ]),
      true,
    );
    entries.push({ id, title, date, locator });
  }
  return entries;
}

export async function fetchUkLegislationProposals(
  input: UkLegislationConnectorInput,
): Promise<Screen02OfficialConnectorResult> {
  validateSharedInput(input);
  const limit = boundedLimit(input.limit);
  const timeoutMs = boundedTimeout(input.timeoutMs);
  const { requestUrl, queryWasShortened } =
    ukLegislationRequestUrl(input);
  const queryLog: Screen02QueryLog = {
    id: normalizedText(input.queryId, 120, "uk-legislation-title-search"),
    query: requestUrl,
    purpose: `${normalizedText(
      input.queryPurpose,
      500,
      "Search the official UK legislation Atom catalog by title term and year window, then enforce the exact date window locally.",
    )}${
      queryWasShortened
        ? " The supplied term was deterministically shortened so the exact encoded request remains within the persisted manifest limit."
        : ""
    }`,
  };
  let body: string;
  try {
    body = await fetchBoundedText({
      fetch: input.fetch,
      connectorId: "uk-legislation-atom-v1",
      requestUrl,
      timeoutMs,
      accept: "application/atom+xml, application/xml, text/xml",
      acceptedContentTypes: [
        "application/atom+xml",
        "application/xml",
        "text/xml",
      ],
      // legislation.gov.uk's published fair-use policy rejects anonymous
      // clients. Send a stable product identity on every bounded catalog GET;
      // no researcher data or credential is included.
      userAgent: SHOCKAUDIT_OFFICIAL_SOURCE_USER_AGENT,
    });
  } catch (error) {
    return failedResult({
      connector: "uk-legislation-atom-v1",
      endpoint: UK_LEGISLATION_ATOM_ENDPOINT,
      requestUrl,
      retrievedAt: input.retrievedAt,
      resultLimit: limit,
      channel: UK_LEGISLATION_CHANNEL,
      queryLog,
      failure: failureMessage(error, timeoutMs),
    });
  }

  let parsedEntries: UkAtomEntry[];
  try {
    parsedEntries = parseUkAtomEntries(body, limit + 1);
  } catch (error) {
    return failedResult({
      connector: "uk-legislation-atom-v1",
      endpoint: UK_LEGISLATION_ATOM_ENDPOINT,
      requestUrl,
      retrievedAt: input.retrievedAt,
      resultLimit: limit,
      channel: UK_LEGISLATION_CHANNEL,
      queryLog,
      failure: failureMessage(error, timeoutMs),
    });
  }

  const rawEntries = parsedEntries.slice(0, limit);
  const proposals: Screen02Proposal[] = [];
  const proposalBindings: Screen02OfficialProposalBinding[] = [];
  const bindingByProposalId = new Map<
    string,
    Screen02OfficialProposalBinding
  >();
  const ids = new Set<string>();
  const returnedRecordIds: string[] = [];
  let invalidRecordsDropped = 0;
  let duplicateRecordsConsolidated = 0;

  for (const entry of rawEntries) {
    if (entry.id) returnedRecordIds.push(entry.id);
    if (
      !entry.id ||
      !entry.title ||
      !entry.date ||
      !entry.locator ||
      entry.date < input.startDate ||
      entry.date > input.endDate
    ) {
      invalidRecordsDropped += 1;
      continue;
    }
    const id = stableId(
      "uk-law",
      new URL(entry.locator).pathname,
    );
    if (ids.has(id)) {
      duplicateRecordsConsolidated += 1;
      appendProposalReturnedRecordId(
        bindingByProposalId.get(id),
        entry.id,
      );
      continue;
    }
    ids.add(id);
    const source: Screen02Source = {
      id: stableId(
        "uk-source",
        new URL(entry.locator).pathname,
      ),
      title: entry.title,
      locator: entry.locator,
      publisher: "The National Archives, legislation.gov.uk",
      publishedDate: entry.date,
      ...sourceAuthority(
        2,
        "legislation.gov.uk is the official revised and enacted UK legislation service; commencement, extent, amendments, and controlling provisions still require verification.",
      ),
      channel: UK_LEGISLATION_CHANNEL,
      retrievedAt: input.retrievedAt,
    };
    const proposal = makeProposal({
        id,
        title: entry.title,
        description: `Official UK legislation catalog metadata dated ${entry.date}. Commencement, territorial extent, and applicability to the requested population are provisional.`,
        eventDate: entry.date,
        eventFamily: "Regulation",
        geographies: ["United Kingdom"],
        outcomeFamily: input.outcomeFamily,
        provisionalDates: [`Catalog document date: ${entry.date}`],
        requiredVariables: [
          "Official legislation identifier",
          "Verified commencement or operative date",
          "Territorial extent and formal coverage rule",
          "Organization-to-covered-entity linkage",
        ],
        limitations: [
          "The catalog date is a discovery anchor, not automatically the treatment date.",
          "Commencement orders, territorial extent, amendments, thresholds, exemptions, and controlling text require Screen 3 verification.",
          "Catalog metadata does not establish organization-level applicability.",
        ],
        reasons: [
          `The official legislation.gov.uk Atom catalog matched the encoded title term and year window at ${input.retrievedAt}; the connector then enforced the exact date range.`,
        ],
        source,
        nativeIdentity: {
          formalIdentifier: normalizedText(
            new URL(entry.locator).pathname.replace(/^\/(?:id\/)?/u, ""),
            500,
          ) || null,
          issuer: null,
          issuingJurisdiction: "United Kingdom",
          status: "Published legislation catalog record",
        },
      });
    proposals.push(proposal);
    const binding = officialProposalBinding(
      proposal,
      queryLog.id,
      [entry.id],
    );
    proposalBindings.push(binding);
    bindingByProposalId.set(proposal.id, binding);
  }

  const limitReached = parsedEntries.length > limit;
  return successfulResult({
    connector: "uk-legislation-atom-v1",
    endpoint: UK_LEGISLATION_ATOM_ENDPOINT,
    requestUrl,
    retrievedAt: input.retrievedAt,
    resultLimit: limit,
    channel: UK_LEGISLATION_CHANNEL,
    queryLog,
    returnedRecordIds,
    recordsReceived: rawEntries.length,
    recordsAccepted:
      rawEntries.length - invalidRecordsDropped,
    proposals,
    proposalBindings,
    invalidRecordsDropped,
    duplicateRecordsConsolidated,
    limitReached,
    note: `Retrieved ${rawEntries.length} UK legislation catalog entries and created ${proposals.length} provisional candidates. ${
      limitReached
        ? `The ${limit}-record connector limit did not cover every returned entry.`
        : "The returned entry count was below the connector limit."
    } Commencement and unit-level applicability were not verified; outcome values were not inspected.`,
  });
}

function gdacsRequestUrl(
  input: GdacsConnectorInput,
  limit: number,
) {
  const eventTypes = input.eventTypes ?? GDACS_EVENT_TYPES;
  if (
    eventTypes.length < 1 ||
    eventTypes.some(
      (value) =>
        !GDACS_EVENT_TYPES.includes(value as GdacsEventType),
    )
  ) {
    throw new Error("eventTypes contains an unsupported GDACS code.");
  }
  const alertLevels = input.alertLevels;
  if (
    alertLevels !== undefined &&
    (alertLevels.length < 1 ||
      alertLevels.some(
        (value) =>
          !GDACS_ALERT_LEVELS.includes(
            value as GdacsAlertLevel,
          ),
      ))
  ) {
    throw new Error(
      "alertLevels contains an unsupported GDACS level.",
    );
  }
  const url = new URL(GDACS_EVENT_SEARCH_ENDPOINT);
  url.searchParams.set(
    "eventlist",
    [...new Set(eventTypes)].join(";"),
  );
  url.searchParams.set("fromdate", input.startDate);
  url.searchParams.set("todate", input.endDate);
  url.searchParams.set("pagesize", String(limit));
  url.searchParams.set("pagenumber", "1");
  if (alertLevels) {
    url.searchParams.set(
      "alertlevel",
      [...new Set(alertLevels)].join(";"),
    );
  }
  if (
    input.countryName !== undefined &&
    input.countryIso3 !== undefined
  ) {
    throw new Error(
      "Supply either countryName or countryIso3, not both.",
    );
  }
  if (input.countryName !== undefined) {
    url.searchParams.set(
      "country",
      requiredText(input.countryName, "countryName", 100),
    );
  } else if (input.countryIso3 !== undefined) {
    const country = input.countryIso3.trim().toUpperCase();
    const countryName =
      GDACS_COUNTRY_NAME_BY_SUPPORTED_ISO3[
        country as keyof typeof GDACS_COUNTRY_NAME_BY_SUPPORTED_ISO3
      ];
    if (!countryName) {
      throw new Error(
        "countryIso3 must be a supported route code: GBR or USA.",
      );
    }
    url.searchParams.set("country", countryName);
  }
  return url.toString();
}

function stringList(value: unknown, maxItems = 12) {
  if (typeof value === "string") {
    return value
      .split(/[;,]/)
      .map((item) => normalizedText(item, 120))
      .filter(Boolean)
      .slice(0, maxItems);
  }
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, maxItems)
    .map((item) => {
      if (isRecord(item)) {
        return normalizedText(
          item.countryname ??
            item.country ??
            item.name ??
            item.iso3,
          120,
        );
      }
      return normalizedText(item, 120);
    })
    .filter(Boolean);
}

type GeoJsonPointCoordinates = {
  longitude: number;
  latitude: number;
  thirdOrdinate: number | null;
};

/**
 * Retain only a bounded, source-native GeoJSON Point. The first two ordinates
 * locate an event point; a generic third ordinate has no connector-independent
 * meaning. An event point is not itself a hazard footprint, organization
 * exposure, or treatment.
 */
function geoJsonPointCoordinates(feature: JsonRecord): GeoJsonPointCoordinates | null {
  const geometry = isRecord(feature.geometry) ? feature.geometry : null;
  if (
    !geometry ||
    normalizedText(geometry.type, 20).toLocaleLowerCase("en-US") !== "point" ||
    !Array.isArray(geometry.coordinates) ||
    geometry.coordinates.length < 2 ||
    geometry.coordinates.length > 3
  ) {
    return null;
  }
  const [longitude, latitude, rawThirdOrdinate] = geometry.coordinates;
  if (
    typeof longitude !== "number" ||
    typeof latitude !== "number" ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    longitude < -180 ||
    longitude > 180 ||
    latitude < -90 ||
    latitude > 90
  ) {
    return null;
  }
  const thirdOrdinate = typeof rawThirdOrdinate === "number" &&
      Number.isFinite(rawThirdOrdinate)
    ? rawThirdOrdinate
    : null;
  return { longitude, latitude, thirdOrdinate };
}

function boundedCoordinate(value: number) {
  return String(Number(value.toFixed(5)));
}

function pointCoordinateText(
  label: "Event point coordinates" | "Earthquake point coordinates",
  coordinates: GeoJsonPointCoordinates,
  depthKm: number | null = null,
) {
  return `${label}: longitude ${boundedCoordinate(coordinates.longitude)}, latitude ${boundedCoordinate(coordinates.latitude)}${
    depthKm === null
      ? ""
      : `, depth ${boundedCoordinate(depthKm)} km`
  }`;
}

const GDACS_TYPE_NAMES: Record<GdacsEventType, string> = {
  EQ: "Earthquake",
  TC: "Tropical cyclone",
  FL: "Flood",
  VO: "Volcano",
  WF: "Wildfire",
  DR: "Drought",
  TS: "Tsunami",
};

function gdacsProposal(
  feature: JsonRecord,
  input: GdacsConnectorInput,
) {
  const properties = isRecord(feature.properties)
    ? feature.properties
    : {};
  const eventType = normalizedText(
    properties.eventtype ?? properties.eventType,
    2,
  ).toUpperCase() as GdacsEventType;
  const eventId = normalizedText(
    properties.eventid ?? properties.eventId ?? feature.id,
    80,
  );
  const episodeId = normalizedText(
    properties.episodeid ?? properties.episodeId,
    80,
  );
  const eventDate = dateOnly(
    properties.fromdate ??
      properties.fromDate ??
      properties.eventdate,
  );
  if (
    !GDACS_EVENT_TYPES.includes(eventType) ||
    !eventId ||
    !eventDate ||
    eventDate < input.startDate ||
    eventDate > input.endDate
  ) {
    return null;
  }
  const countries = [
    ...stringList(
      properties.affectedcountries ??
        properties.affectedCountries,
    ),
    ...stringList(
      properties.country ?? properties.countryname,
    ),
  ].filter(
    (value, index, values) =>
      values.indexOf(value) === index,
  );
  const eventName = normalizedText(
    properties.name ??
      properties.eventname ??
      properties.description,
    200,
    `${GDACS_TYPE_NAMES[eventType]} ${eventId}`,
  );
  const title = normalizedText(
    `${GDACS_TYPE_NAMES[eventType]}: ${eventName}`,
    240,
  );
  const urls = isRecord(properties.url)
    ? properties.url
    : {};
  const locator =
    safeOfficialUrl(
      urls.details ??
        urls.report ??
        properties.url,
      new Set(["www.gdacs.org", "gdacs.org"]),
    ) ??
    `https://www.gdacs.org/report.aspx?eventtype=${encodeURIComponent(eventType)}&eventid=${encodeURIComponent(eventId)}`;
  const alertLevel = normalizedText(
    properties.alertlevel ?? properties.alertLevel,
    20,
    "unspecified",
  );
  const pointCoordinates = geoJsonPointCoordinates(feature);
  const formalIdentifier =
    `GDACS-${eventType}-${eventId}${episodeId ? `-${episodeId}` : ""}`;
  const source: Screen02Source = {
    id: stableId(
      "gdacs-source",
      `${eventType}-${eventId}-${episodeId}`,
    ),
    title,
    locator,
    publisher:
      "Global Disaster Alert and Coordination System (GDACS)",
    publishedDate: eventDate,
    ...sourceAuthority(
      3,
      "GDACS is authoritative UN–European Commission institutional hazard-monitoring documentation, not a national legal declaration or exposure determination.",
    ),
    channel: GDACS_CHANNEL,
    retrievedAt: input.retrievedAt,
    // This is a bounded serialization of returned structured fields, not a
    // verbatim page passage or a generated applicability claim.
    evidenceText: normalizedText(
      [
        `${title}; Record identifier: ${formalIdentifier}; Structured source-native fields (not a verbatim passage): GDACS recorded this ${GDACS_TYPE_NAMES[eventType].toLowerCase()} event beginning ${eventDate}; ${
          pointCoordinates
            ? `${pointCoordinateText("Event point coordinates", pointCoordinates)}; `
            : ""
        }countries reported: ${countries.join("; ") || "not specified"}; alert level: ${alertLevel}.`,
      ].join(" "),
      1_200,
    ),
  };
  return makeProposal({
    id: stableId(
      "gdacs",
      `${eventType}-${eventId}-${episodeId}`,
    ),
    title,
    description: `GDACS recorded a ${GDACS_TYPE_NAMES[eventType].toLowerCase()} event beginning ${eventDate}, with alert level ${alertLevel}. Countries reported: ${countries.join("; ") || "not specified in the bounded record"}.`,
    eventDate,
    eventFamily: `${GDACS_TYPE_NAMES[eventType]} disaster`,
    geographies:
      countries.length > 0 ? countries : ["Worldwide"],
    outcomeFamily: input.outcomeFamily,
    provisionalDates: [`GDACS event start: ${eventDate}`],
    requiredVariables: [
      "GDACS event and episode identifiers",
      "Verified event onset and duration",
      ...(pointCoordinates
        ? ["Event point coordinates"]
        : []),
      "Hazard footprint or intensity",
      "Organization-to-event-footprint location linkage",
      "Relevant national or local administrative response records",
    ],
    limitations: [
      "GDACS monitoring is not a national declaration, administrative eligibility decision, or complete census of local events.",
      "Alert level and affected-country metadata do not establish unit-level exposure or treatment assignment.",
      "Event timing, footprint, intensity, and relevant government response require Screen 3 verification.",
    ],
    reasons: [
      `GDACS returned this bounded event record for the encoded hazard, date, alert, and country filters at ${input.retrievedAt}.`,
    ],
    source,
    nativeIdentity: {
      formalIdentifier,
      issuer: null,
      issuingJurisdiction: null,
      status: `${alertLevel} alert`,
    },
  });
}

export async function fetchGdacsDisasterProposals(
  input: GdacsConnectorInput,
): Promise<Screen02OfficialConnectorResult> {
  validateSharedInput(input);
  const limit = boundedLimit(input.limit);
  const timeoutMs = boundedTimeout(input.timeoutMs);
  const requestUrl = gdacsRequestUrl(input, limit);
  const queryLog: Screen02QueryLog = {
    id: normalizedText(input.queryId, 120, "gdacs-global-events"),
    query: requestUrl,
    purpose: normalizedText(
      input.queryPurpose,
      500,
      "Search bounded GDACS global hazard-event metadata by event type, date, optional alert level, and optional API country name.",
    ),
  };
  let payload: unknown;
  try {
    payload = await fetchBoundedJson({
      fetch: input.fetch,
      connectorId: "gdacs-event-search-v1",
      requestUrl,
      timeoutMs,
    });
  } catch (error) {
    return failedResult({
      connector: "gdacs-event-search-v1",
      endpoint: GDACS_EVENT_SEARCH_ENDPOINT,
      requestUrl,
      retrievedAt: input.retrievedAt,
      resultLimit: limit,
      channel: GDACS_CHANNEL,
      queryLog,
      failure: failureMessage(error, timeoutMs),
    });
  }

  const allFeatures =
    isRecord(payload) && Array.isArray(payload.features)
      ? payload.features
      : [];
  const rawFeatures = allFeatures.slice(0, limit);
  const proposals: Screen02Proposal[] = [];
  const proposalBindings: Screen02OfficialProposalBinding[] = [];
  const bindingByProposalId = new Map<
    string,
    Screen02OfficialProposalBinding
  >();
  const ids = new Set<string>();
  const returnedRecordIds: string[] = [];
  let invalidRecordsDropped = 0;
  let duplicateRecordsConsolidated = 0;
  let recordsAccepted = 0;
  for (const raw of rawFeatures) {
    if (!isRecord(raw)) {
      invalidRecordsDropped += 1;
      continue;
    }
    const properties = isRecord(raw.properties)
      ? raw.properties
      : {};
    const returnedId = normalizedText(
      properties.eventid ?? raw.id,
      80,
    );
    if (returnedId) returnedRecordIds.push(returnedId);
    const proposal = gdacsProposal(raw, input);
    if (!proposal) {
      invalidRecordsDropped += 1;
      continue;
    }
    recordsAccepted += 1;
    if (ids.has(proposal.id)) {
      duplicateRecordsConsolidated += 1;
      appendProposalReturnedRecordId(
        bindingByProposalId.get(proposal.id),
        returnedId,
      );
      continue;
    }
    ids.add(proposal.id);
    proposals.push(proposal);
    const binding = officialProposalBinding(
      proposal,
      queryLog.id,
      returnedId ? [returnedId] : [],
    );
    proposalBindings.push(binding);
    bindingByProposalId.set(proposal.id, binding);
  }
  const limitReached = allFeatures.length >= limit;
  return successfulResult({
    connector: "gdacs-event-search-v1",
    endpoint: GDACS_EVENT_SEARCH_ENDPOINT,
    requestUrl,
    retrievedAt: input.retrievedAt,
    resultLimit: limit,
    channel: GDACS_CHANNEL,
    queryLog,
    // GDACS can return multiple episode rows under one event identifier.
    // Query provenance is an identifier set in canonical Screen 2 state, so
    // retain that event ID once while each episode keeps its own proposal and
    // source identity.
    returnedRecordIds: [...new Set(returnedRecordIds)],
    recordsReceived: rawFeatures.length,
    recordsAccepted,
    proposals,
    proposalBindings,
    invalidRecordsDropped,
    duplicateRecordsConsolidated,
    limitReached,
    note: `Retrieved ${rawFeatures.length} GDACS hazard records and created ${proposals.length} provisional candidates. ${
      limitReached
        ? `The ${limit}-record connector limit was reached.`
        : "The returned record count was below the connector limit."
    } GDACS monitoring was not represented as a national declaration or unit-level exposure; outcome values were not inspected.`,
  });
}

function validateBoundingBox(
  boundingBox: UsgsBoundingBox,
) {
  const {
    minLatitude,
    maxLatitude,
    minLongitude,
    maxLongitude,
  } = boundingBox;
  if (
    ![minLatitude, maxLatitude, minLongitude, maxLongitude].every(
      Number.isFinite,
    ) ||
    minLatitude < -90 ||
    maxLatitude > 90 ||
    minLongitude < -180 ||
    maxLongitude > 180 ||
    minLatitude >= maxLatitude ||
    minLongitude >= maxLongitude
  ) {
    throw new Error(
      "boundingBox must contain ordered finite latitude and longitude bounds.",
    );
  }
}

function usgsRequestUrl(
  input: UsgsEarthquakeConnectorInput,
  limit: number,
) {
  const url = new URL(USGS_EARTHQUAKE_API_ENDPOINT);
  url.searchParams.set("format", "geojson");
  url.searchParams.set("starttime", input.startDate);
  url.searchParams.set("endtime", input.endDate);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("orderby", "time");
  if (input.boundingBox) {
    validateBoundingBox(input.boundingBox);
    url.searchParams.set(
      "minlatitude",
      String(input.boundingBox.minLatitude),
    );
    url.searchParams.set(
      "maxlatitude",
      String(input.boundingBox.maxLatitude),
    );
    url.searchParams.set(
      "minlongitude",
      String(input.boundingBox.minLongitude),
    );
    url.searchParams.set(
      "maxlongitude",
      String(input.boundingBox.maxLongitude),
    );
  }
  if (input.minMagnitude !== undefined) {
    if (
      !Number.isFinite(input.minMagnitude) ||
      input.minMagnitude < -1 ||
      input.minMagnitude > 10
    ) {
      throw new Error(
        "minMagnitude must be a finite value from -1 through 10.",
      );
    }
    url.searchParams.set(
      "minmagnitude",
      String(input.minMagnitude),
    );
  }
  return url.toString();
}

function usgsProposal(
  feature: JsonRecord,
  input: UsgsEarthquakeConnectorInput,
) {
  const properties = isRecord(feature.properties)
    ? feature.properties
    : {};
  const eventId = normalizedText(feature.id, 100);
  const eventDate =
    dateFromEpoch(properties.time) ??
    dateOnly(properties.time);
  if (
    !eventId ||
    !eventDate ||
    eventDate < input.startDate ||
    eventDate > input.endDate
  ) {
    return null;
  }
  const place = normalizedText(
    properties.place,
    180,
    "location not specified",
  );
  const magnitude =
    typeof properties.mag === "number" &&
    Number.isFinite(properties.mag)
      ? properties.mag
      : null;
  const title = normalizedText(
    properties.title,
    240,
    `${magnitude === null ? "" : `M ${magnitude} `}earthquake near ${place}`,
  );
  const locator =
    safeOfficialUrl(
      properties.url,
      new Set(["earthquake.usgs.gov"]),
    ) ??
    `https://earthquake.usgs.gov/earthquakes/eventpage/${encodeURIComponent(eventId)}`;
  const pointCoordinates = geoJsonPointCoordinates(feature);
  const earthquakeDepth = pointCoordinates?.thirdOrdinate !== null &&
      pointCoordinates?.thirdOrdinate !== undefined &&
      pointCoordinates.thirdOrdinate >= -20 &&
      pointCoordinates.thirdOrdinate <= 1_000
    ? pointCoordinates.thirdOrdinate
    : null;
  const source: Screen02Source = {
    id: stableId("usgs-source", eventId),
    title,
    locator,
    publisher: "U.S. Geological Survey (USGS)",
    publishedDate: eventDate,
    ...sourceAuthority(
      3,
      "The USGS FDSN catalog is authoritative scientific earthquake-event metadata, not a government declaration or exposure determination.",
    ),
    channel: USGS_CHANNEL,
    retrievedAt: input.retrievedAt,
    // This is a bounded serialization of returned structured fields, not a
    // verbatim page passage or a generated applicability claim.
    evidenceText: normalizedText(
      [
        `${title}; Record identifier: ${eventId}; Structured source-native fields (not a verbatim passage): USGS recorded ${title} as this earthquake; USGS event date: ${eventDate}; ${
          pointCoordinates
            ? `${pointCoordinateText("Earthquake point coordinates", pointCoordinates, earthquakeDepth)}; `
            : ""
        }place: ${place}; magnitude: ${magnitude === null ? "not specified" : magnitude}.`,
      ].join(" "),
      1_200,
    ),
  };
  return makeProposal({
    id: stableId("usgs-earthquake", eventId),
    title,
    description: `USGS recorded an earthquake on ${eventDate}${magnitude === null ? "" : ` with magnitude ${magnitude}`}, near ${place}. The scientific event record does not establish administrative response or unit-level exposure.`,
    eventDate,
    eventFamily: "Earthquake disaster",
    geographies: [place],
    outcomeFamily: input.outcomeFamily,
    provisionalDates: [`USGS event date: ${eventDate}`],
    requiredVariables: [
      "USGS event identifier",
      ...(pointCoordinates
        ? ["Earthquake point coordinates"]
        : ["Verified origin time and location"]),
      "Hazard intensity at unit locations",
      "Organization-to-hazard-footprint location linkage",
      "Relevant national or local declaration and response records",
    ],
    limitations: [
      "The USGS catalog covers scientific seismic events, not national or local disaster declarations.",
      "Detection, magnitude, and place metadata do not establish organization-level exposure or treatment.",
      "Event footprint, local intensity, administrative response, and relevant timing require Screen 3 verification.",
    ],
    reasons: [
      `The USGS FDSN service returned this event for the encoded date, magnitude, and optional geographic bounds at ${input.retrievedAt}.`,
    ],
    source,
    nativeIdentity: {
      formalIdentifier: eventId,
      issuer: null,
      issuingJurisdiction: null,
      status: "Scientific earthquake event record",
    },
  });
}

export async function fetchUsgsEarthquakeProposals(
  input: UsgsEarthquakeConnectorInput,
): Promise<Screen02OfficialConnectorResult> {
  validateSharedInput(input);
  const limit = boundedLimit(input.limit);
  const timeoutMs = boundedTimeout(input.timeoutMs);
  const requestUrl = usgsRequestUrl(input, limit);
  const queryLog: Screen02QueryLog = {
    id: normalizedText(input.queryId, 120, "usgs-fdsn-earthquakes"),
    query: requestUrl,
    purpose: normalizedText(
      input.queryPurpose,
      500,
      "Search the bounded USGS global earthquake catalog by date, optional magnitude, and optional validated geographic rectangle.",
    ),
  };
  let payload: unknown;
  try {
    payload = await fetchBoundedJson({
      fetch: input.fetch,
      connectorId: "usgs-earthquake-catalog-v1",
      requestUrl,
      timeoutMs,
    });
  } catch (error) {
    return failedResult({
      connector: "usgs-earthquake-catalog-v1",
      endpoint: USGS_EARTHQUAKE_API_ENDPOINT,
      requestUrl,
      retrievedAt: input.retrievedAt,
      resultLimit: limit,
      channel: USGS_CHANNEL,
      queryLog,
      failure: failureMessage(error, timeoutMs),
    });
  }

  const allFeatures =
    isRecord(payload) && Array.isArray(payload.features)
      ? payload.features
      : [];
  const rawFeatures = allFeatures.slice(0, limit);
  const proposals: Screen02Proposal[] = [];
  const proposalBindings: Screen02OfficialProposalBinding[] = [];
  const bindingByProposalId = new Map<
    string,
    Screen02OfficialProposalBinding
  >();
  const ids = new Set<string>();
  const returnedRecordIds: string[] = [];
  let invalidRecordsDropped = 0;
  let duplicateRecordsConsolidated = 0;
  let recordsAccepted = 0;
  for (const raw of rawFeatures) {
    if (!isRecord(raw)) {
      invalidRecordsDropped += 1;
      continue;
    }
    const returnedId = normalizedText(raw.id, 100);
    if (returnedId) returnedRecordIds.push(returnedId);
    const proposal = usgsProposal(raw, input);
    if (!proposal) {
      invalidRecordsDropped += 1;
      continue;
    }
    recordsAccepted += 1;
    if (ids.has(proposal.id)) {
      duplicateRecordsConsolidated += 1;
      appendProposalReturnedRecordId(
        bindingByProposalId.get(proposal.id),
        returnedId,
      );
      continue;
    }
    ids.add(proposal.id);
    proposals.push(proposal);
    const binding = officialProposalBinding(
      proposal,
      queryLog.id,
      returnedId ? [returnedId] : [],
    );
    proposalBindings.push(binding);
    bindingByProposalId.set(proposal.id, binding);
  }
  const limitReached = allFeatures.length >= limit;
  return successfulResult({
    connector: "usgs-earthquake-catalog-v1",
    endpoint: USGS_EARTHQUAKE_API_ENDPOINT,
    requestUrl,
    retrievedAt: input.retrievedAt,
    resultLimit: limit,
    channel: USGS_CHANNEL,
    queryLog,
    returnedRecordIds,
    recordsReceived: rawFeatures.length,
    recordsAccepted,
    proposals,
    proposalBindings,
    invalidRecordsDropped,
    duplicateRecordsConsolidated,
    limitReached,
    note: `Retrieved ${rawFeatures.length} USGS earthquake records and created ${proposals.length} provisional candidates. ${
      limitReached
        ? `The ${limit}-record connector limit was reached.`
        : "The returned record count was below the connector limit."
    } Scientific event metadata was not represented as a disaster declaration or unit-level exposure; outcome values were not inspected.`,
  });
}
