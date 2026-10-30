import type { Screen02WorkflowHandoff } from "../core/screen02-workflow-handoff";
import { reviewedScreen02AuditOfficialIdentityFields } from
  "../core/screen02-audit-discovery";
import { unambiguousCalendarDate } from "../core/calendar-date";
import {
  canonicalScreen02FormalIdentifier,
  compareScreen02FormalIdentifiers,
  parseScreen02FormalIdentifier,
} from "../core/screen02-formal-identifier";
import { fingerprintScreen02WorkflowValue } from "../core/screen02-workflow-state";
import {
  isScreen02ContextLead,
  screen02DateLeadStages,
  type Screen02ContextLead,
  type Screen02DateLeadStage,
} from "../core/screen02-workflow-types";
import {
  canonicalizeScreen03EvidenceRetrievedAt,
  screen03EvidenceItemProvidesAuthoritativeDirectSupport,
  screen03EvidenceItemProvidesDirectSupportForProposal,
  screen03PassageProvidesDirectSupport,
  type Screen03AnyProposal,
  type Screen03DocumentType,
  type Screen03OfficialField,
  type Screen03PassageBasis,
  type Screen03ProposalGroup,
  type Screen03ResearchPacket,
  type Screen03SourcePlatform,
} from "../core/screen03-workflow";
import type {
  Screen02FindProposal,
  Screen02Proposal,
} from "../core/screen02-types";
import {
  fetchFederalRegisterProposals,
  fetchOpenFemaDisasterProposals,
  type Screen02ConnectorFetch,
  type Screen02OfficialConnectorResult,
} from "./screen02-connectors";
import {
  fetchEuCellarLegalProposals,
  fetchGdacsDisasterProposals,
  fetchUkLegislationProposals,
  fetchUsgsEarthquakeProposals,
  type GdacsEventType,
} from "./screen02-global-connectors";
import {
  getScreen02SourceCatalogEntry,
  planScreen02SourceRoutes,
  type Screen02ConnectorId,
} from "./screen02-source-router";
import {
  SCREEN_03_RESEARCH_STAGE_PLAN,
  screen03EvidenceSourceRole,
  screen03EvidenceTextHasUnsafeInstruction,
  synthesizeScreen03Evidence,
  type Screen03EvidenceSourceRole,
  type Screen03EvidenceSynthesizer,
  type Screen03EvidenceSynthesisResult,
  type Screen03ResearchStageId,
} from "./screen03-evidence-synthesis";
import type { Screen02ContextSearchProvider } from "./screen02-search-expansion";
import {
  euOfficialDocumentRecordId,
  euOfficialDocumentRepresentationLocators,
  euPublicationsLocatorRecordId,
  leadingVisibleEuDocumentRecordId,
  officialDocumentAccessChallenge,
  primaryOfficialDocumentHtml,
  readEuPublicationsDocumentIdentity,
  readEurLexDocumentIdentity,
} from "./official-document-html";
import { SHOCKAUDIT_OFFICIAL_SOURCE_USER_AGENT } from "./screen02-secure-transport";
import {
  screen03ClaimQualityScore,
  screen03ClaimsAreEquivalent,
  screen03CharacterEndsSentence,
  screen03CompleteExtractiveStatements,
  screen03ExtractiveClaimIsComplete,
} from "./screen03-claim-quality";
import {
  fuseScreen03ProposalSources,
  type Screen03SourceFusionConflict,
} from "./screen03-source-fusion";

export const SCREEN_03_RESEARCH_MAX_CALLS = 6;
export const SCREEN_03_RESEARCH_MAX_RESULTS_PER_CALL = 5;
export const SCREEN_03_RESEARCH_MAX_ACTIVE_EVIDENCE = 5;
// Five active sources times twelve retained passages remains a fixed packet
// bound. Twelve is large enough to preserve four exact document excerpts plus
// the complete typed official identity vocabulary (title, common name,
// identifier, issuer, jurisdiction, status, event type, and one record date)
// instead of silently dropping later structured fields.
export const SCREEN_03_RESEARCH_MAX_PASSAGES = 60;
export const SCREEN_03_RESEARCH_TIMEOUT_MS = 4_000;
/**
 * One outcome-blind research clock for connector, document, and optional
 * synthesis work. This factual phase remains bounded independently from the
 * later optional interpretation, Durable Object write, sealing, and transport;
 * the 30-second client boundary remains the final recovery guard.
 */
export const SCREEN_03_RESEARCH_TOTAL_DEADLINE_MS = 16_000;
/**
 * Three usable document-text slots preserve one controlling text, one
 * lifecycle announcement/precursor record, and one implementation or
 * enforcement record. Attempts, bytes, pages, active evidence, and the shared
 * deadline remain independently bounded.
 */
export const SCREEN_03_DOCUMENT_MAX_FETCHES = 3;
export const SCREEN_03_DOCUMENT_MAX_PDF_CONVERSIONS = 2;
/** Failed/empty slots may be backfilled, but outbound attempts stay bounded. */
export const SCREEN_03_DOCUMENT_MAX_ATTEMPTS = 4;
export const SCREEN_03_DOCUMENT_MAX_BYTES = 300_000;
/** Larger official representations share the original four-attempt byte budget. */
export const SCREEN_03_DOCUMENT_MAX_OFFICIAL_TRANSPORT_BYTES = 2 * 1024 * 1024;
export const SCREEN_03_DOCUMENT_MAX_TOTAL_BYTES =
  SCREEN_03_DOCUMENT_MAX_ATTEMPTS * SCREEN_03_DOCUMENT_MAX_BYTES;
export const SCREEN_03_DOCUMENT_MAX_PDF_PAGES = 40;
export const SCREEN_03_DOCUMENT_MAX_CONVERTED_TEXT = 200_000;
export const SCREEN_03_DOCUMENT_CONVERSION_TIMEOUT_MS = 4_000;
/**
 * Reviewed official HTML pages can be slower than structured connector APIs.
 * Keep one document fetch bounded below the total research deadline and the
 * 30-second Screen 3 client timeout while allowing current legislature pages
 * to return source excerpts instead of metadata-only evidence.
 */
export const SCREEN_03_DOCUMENT_FETCH_TIMEOUT_MS = 10_000;
export const SCREEN_03_DOCUMENT_MAX_REDIRECTS = 2;
/**
 * The original visible-text ceiling is independent of transport size. A
 * primary legal-content container is projected before this search cap; only
 * the extracted passage windows enter persisted state.
 */
export const SCREEN_03_DOCUMENT_MAX_TEXT = SCREEN_03_DOCUMENT_MAX_BYTES;
export const SCREEN_03_DOCUMENT_MAX_EXCERPTS = 4;
export const SCREEN_03_DETAIL_MAX_PER_CATEGORY = 4;
export const SCREEN_03_DETAIL_MAX_TOTAL = 20;
export const SCREEN_03_COMPONENT_TARGET = 3;

const SCREEN_03_DOCUMENT_TARGET_SEARCH_TERMS = 40;
const SCREEN_03_DOCUMENT_MAX_MATCHES_PER_TERM = 4;
const SCREEN_03_DOCUMENT_MAX_PASSAGES_PER_EVIDENCE = 12;

const STAGE_TERMS = SCREEN_03_RESEARCH_STAGE_PLAN.flatMap(
  (stage) => stage.queryTerms,
);

const DOCUMENT_STAGE_TERMS = [
  ...STAGE_TERMS,
  // Official lifecycle pages commonly use inflected action language rather
  // than the stage-plan nouns. Keep these general phrases in the bounded
  // document search plan so an exact announcement/circulation sentence can
  // reach the timeline compiler without introducing event-specific dates.
  "announced",
  "entered circulation",
  "cleared for circulation",
  "cleared to begin collecting",
  "exemption",
  "threshold",
  "apply",
  "application",
  "applicable",
  "commencement",
  "commence",
  "in force",
  "operative",
] as const;

const MONTH_NAMES = [
  ["january", "jan"],
  ["february", "feb"],
  ["march", "mar"],
  ["april", "apr"],
  ["may", "may"],
  ["june", "jun"],
  ["july", "jul"],
  ["august", "aug"],
  ["september", "sep", "sept"],
  ["october", "oct"],
  ["november", "nov"],
  ["december", "dec"],
] as const;

const OFFICIAL_CONNECTOR_IDS: readonly Screen02ConnectorId[] = [
  "federal-register-api-v1",
  "openfema-disaster-declarations-v2",
  "eu-cellar-sparql-v1",
  "uk-legislation-atom-v1",
  "gdacs-event-search-v1",
  "usgs-earthquake-catalog-v1",
];

type EvidenceItem = Screen03ResearchPacket["evidence"][number];
type EvidencePassage = EvidenceItem["passages"][number];
type PassageSeed = {
  text: string;
  basis: Screen03PassageBasis;
  officialField?: Screen03OfficialField | null;
  locator?: string | null;
};
type ConnectorResult = {
  callId: string;
  connectorId: Screen02ConnectorId;
  stageId: Screen03ResearchStageId;
  sourceRole: Screen03EvidenceSourceRole;
  requestedTerm: string | null;
  purpose: string;
  result: Screen02OfficialConnectorResult | null;
  failure: string | null;
};

type EvidenceCandidate = {
  evidence: EvidenceItem;
  score: number;
  carried: boolean;
  retrieved: boolean;
};

type ConnectorTask = {
  exactIdentity?: boolean;
  connectorId: Screen02ConnectorId;
  stageId: Screen03ResearchStageId;
  sourceRole: Screen03EvidenceSourceRole;
  term: string | null;
  purpose: string;
  execute: () => Promise<Screen02OfficialConnectorResult>;
};

type DocumentFetchGap = {
  locator: string;
  reason: string;
};

type DocumentTextResult = {
  locator: string;
  /** Original evidence locator when `locator` is an exact-ID representation. */
  sourceLocator?: string;
  resolvedLocator?: string;
  redirectCount?: number;
  excerpts: string[];
  officialTitleField?: string;
  gap: DocumentFetchGap | null;
  documentKind: "html" | "xml" | "json" | "plain-text" | "pdf" | "unknown";
  conversionStatus:
    | "not-applicable"
    | "converted"
    | "unavailable"
    | "failed"
    | "rejected";
  sourceContentFingerprint?: string;
  retrievedAt?: string;
  bytesRead?: number;
  language?: string;
  secureRedirectUpgradeCount?: number;
  /** A representation/access failure may try another exact-record source. */
  alternateEligible?: boolean;
  /** Returned bytes independently bind to the selected event identity. */
  selectedEventIdentityBound?: true;
};

type DocumentFetchTarget = {
  locator: string;
  sourceLocator: string;
  remainingRepresentations: readonly string[];
};

export type Screen03DocumentConversionInput = {
  name: string;
  blob: Blob;
  contentType: "application/pdf";
  /** Advisory raw-byte upper bound; the adapter must still enforce the cap. */
  detectedPageCount: number;
  maximumPages: number;
  maximumTextCharacters: number;
  signal: AbortSignal;
};

export type Screen03DocumentConversionResult = {
  text: string;
};

/**
 * Optional infrastructure seam for bounded deterministic PDF-to-text
 * conversion. Production v0.3.13 leaves this unset and records an explicit
 * extraction gap; any future converter must retain allowlisting, byte/page/text
 * gates, passage extraction, and fail-closed validation.
 */
export type Screen03DocumentConverter = (
  input: Screen03DocumentConversionInput,
) => Promise<Screen03DocumentConversionResult>;

export type Screen03ResearchTelemetry = {
  event: "screen03-research-completed";
  connectorCalls: number;
  connectorSucceeded: number;
  connectorFailed: number;
  recordsReviewed: number;
  documentAttempts: number;
  documentUsable: number;
  pdfConversionAttempts: number;
  pdfConversionSucceeded: number;
  activeEvidenceCount: number;
  passageCount: number;
  supportedStageCount: number;
  missingStageCount: number;
  synthesisMode: Screen03EvidenceSynthesisResult["mode"];
  synthesisStatus: Screen03EvidenceSynthesisResult["modelStatus"];
  synthesisCallCount: number;
  synthesisModelClaimCount: number;
  synthesisFallbackClaimCount: number;
  contextSearchCallCount: number;
  contextLeadCount: number;
  contextSearchStatus:
    | "not-configured"
    | "carried-only"
    | "completed"
    | "failed"
    | "skipped-budget";
  totalDurationMs: number;
  connectorDurationMs: number;
  documentDurationMs: number;
  synthesisDurationMs: number;
  assemblyDurationMs: number;
  documentBytesRead: number;
  evidenceStateBytes: number;
  packetStateBytes: number;
  stoppingRuleStatus: "met" | "not-met";
};

export type ResearchScreen03EvidenceInput = {
  handoff: Screen02WorkflowHandoff;
  fetch: Screen02ConnectorFetch;
  retrievedAt: string;
  convertDocument?: Screen03DocumentConverter;
  synthesizer?: Screen03EvidenceSynthesizer;
  /** Optional bounded secondary-source discovery; one guarded page may add evidence. */
  contextSearch?: Screen02ContextSearchProvider;
  /** Optional stricter budget used by deterministic tests and future callers. */
  deadlineMs?: number;
  /** Parent operation cancellation; never extends the fixed total budget. */
  signal?: AbortSignal;
  /** Optional exact active claim used to prioritize this bounded round. */
  targetClaim?: {
    proposalId: string;
    group: Screen03ProposalGroup;
    label: string;
    value: string;
    sourceIds: string[];
    passageIds: string[];
    stage?: Screen02DateLeadStage;
  };
  onTelemetry?: (
    telemetry: Screen03ResearchTelemetry,
  ) => void | Promise<void>;
};

/** Compatibility name used by the Screen 3 durable workflow runtime. */
export type Screen03EvidenceServiceInput = ResearchScreen03EvidenceInput;

type Screen03ResearchDeadline = {
  signal: AbortSignal;
  remainingMs: () => number;
  dispose: () => void;
};

type DocumentByteBudget = { remaining: number };

function createScreen03ResearchDeadline(input: ResearchScreen03EvidenceInput) {
  const duration = input.deadlineMs ?? SCREEN_03_RESEARCH_TOTAL_DEADLINE_MS;
  if (
    !Number.isSafeInteger(duration) || duration < 1 ||
    duration > SCREEN_03_RESEARCH_TOTAL_DEADLINE_MS
  ) {
    throw new Error(
      `Screen 3 deadlineMs must be an integer from 1 through ${SCREEN_03_RESEARCH_TOTAL_DEADLINE_MS}.`,
    );
  }
  const controller = new AbortController();
  const expiresAt = Date.now() + duration;
  const abortFromParent = () => controller.abort(
    input.signal?.reason ?? new DOMException("Screen 3 research aborted", "AbortError"),
  );
  if (input.signal?.aborted) abortFromParent();
  else input.signal?.addEventListener("abort", abortFromParent, { once: true });
  const timer = setTimeout(
    () => controller.abort(
      new DOMException("Screen 3 total research deadline reached", "TimeoutError"),
    ),
    duration,
  );
  return {
    signal: controller.signal,
    remainingMs: () => Math.max(0, expiresAt - Date.now()),
    dispose: () => {
      clearTimeout(timer);
      input.signal?.removeEventListener("abort", abortFromParent);
    },
  } satisfies Screen03ResearchDeadline;
}

function linkedAbortSignal(signals: readonly (AbortSignal | null | undefined)[]) {
  const controller = new AbortController();
  const active = signals.filter((signal): signal is AbortSignal => Boolean(signal));
  const abort = (signal: AbortSignal) => controller.abort(
    signal.reason ?? new DOMException("Screen 3 operation aborted", "AbortError"),
  );
  const listeners = active.map((signal) => {
    const listener = () => abort(signal);
    if (signal.aborted) abort(signal);
    else signal.addEventListener("abort", listener, { once: true });
    return { signal, listener };
  });
  return {
    signal: controller.signal,
    dispose: () => listeners.forEach(({ signal, listener }) =>
      signal.removeEventListener("abort", listener)
    ),
  };
}

function raceScreen03Deadline<Value>(
  operation: Promise<Value>,
  deadline: Screen03ResearchDeadline,
) {
  if (deadline.signal.aborted) {
    return Promise.reject(
      deadline.signal.reason ??
        new DOMException("Screen 3 research deadline reached", "TimeoutError"),
    );
  }
  return new Promise<Value>((resolve, reject) => {
    const abort = () => {
      cleanup();
      reject(
        deadline.signal.reason ??
          new DOMException("Screen 3 research deadline reached", "TimeoutError"),
      );
    };
    const cleanup = () => deadline.signal.removeEventListener("abort", abort);
    deadline.signal.addEventListener("abort", abort, { once: true });
    operation.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error) => {
        cleanup();
        reject(error);
      },
    );
  });
}

function fetchWithinScreen03Deadline(
  fetchImpl: Screen02ConnectorFetch,
  deadline: Screen03ResearchDeadline,
): Screen02ConnectorFetch {
  return async (request, init) => {
    const linked = linkedAbortSignal([init?.signal, deadline.signal]);
    try {
      return await raceScreen03Deadline(
        fetchImpl(request, { ...init, signal: linked.signal }),
        deadline,
      );
    } finally {
      linked.dispose();
    }
  };
}

function synthesizerWithinScreen03Deadline(
  synthesizer: Screen03EvidenceSynthesizer,
  deadline: Screen03ResearchDeadline,
): Screen03EvidenceSynthesizer {
  return async (request, options) => {
    const linked = linkedAbortSignal([options.signal, deadline.signal]);
    try {
      return await raceScreen03Deadline(
        synthesizer(request, { signal: linked.signal }),
        deadline,
      );
    } finally {
      linked.dispose();
    }
  };
}

function normalizedText(value: unknown, maximum = 2_000) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function normalizedToken(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Locator equality is an evidence-integrity boundary, not a fuzzy text match.
 * Normalize only URL-origin details that are case-insensitive or equivalent;
 * preserve pathname, query ordering/case, and fragment exactly as parsed.
 */
function canonicalLocatorKey(locator: string) {
  try {
    const parsed = new URL(locator);
    const protocol = parsed.protocol.toLocaleLowerCase("en-US");
    const hostname = parsed.hostname.toLocaleLowerCase("en-US");
    const defaultPort =
      (protocol === "https:" && parsed.port === "443") ||
      (protocol === "http:" && parsed.port === "80");
    const port = parsed.port && !defaultPort ? `:${parsed.port}` : "";
    const credentials = parsed.username || parsed.password
      ? `${parsed.username}${parsed.password ? `:${parsed.password}` : ""}@`
      : "";
    return `${protocol}//${credentials}${hostname}${port}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    // Invalid locators cannot be made equivalent safely. Exact input equality
    // is the only fail-closed fallback.
    return locator;
  }
}

function lexicalTerms(value: string) {
  const stop = new Set([
    "a",
    "an",
    "and",
    "for",
    "in",
    "of",
    "on",
    "the",
    "to",
  ]);
  return new Set(
    normalizedToken(value)
      .split(" ")
      .filter((term) => term.length > 1 && !stop.has(term)),
  );
}

function stableId(prefix: string, value: string) {
  const slug = normalizedToken(value)
    .replace(/\s+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 66);
  const suffix = fingerprintScreen02WorkflowValue(value).slice(-8);
  return `${prefix}-${slug || "item"}-${suffix}`.slice(0, 100);
}

function validRetrievedAt(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?Z$/.test(
      value,
    ) && Number.isFinite(Date.parse(value))
  );
}

function dateOnly(value: string) {
  const candidate = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return null;
  const parsed = new Date(`${candidate}T00:00:00.000Z`);
  return Number.isFinite(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === candidate
    ? candidate
    : null;
}

function yearRange(handoff: Screen02WorkflowHandoff) {
  const years = [
    ...(handoff.screen01Baseline.scopeContract.studyPeriod.match(/\b(?:1\d{3}|2\d{3})\b/g) ?? []),
    ...handoff.event.dateLeads.map((lead) => lead.date.slice(0, 4)),
  ]
    .map(Number)
    .filter((year) => Number.isSafeInteger(year) && year >= 1000 && year <= 9999);
  const currentYear = new Date(handoff.builtAt).getUTCFullYear();
  const minimum = years.length > 0 ? Math.min(...years) : currentYear - 5;
  const maximum = years.length > 0 ? Math.max(...years) : currentYear;
  return {
    startDate: `${Math.max(1000, minimum - 3)}-01-01`,
    endDate: `${Math.min(9999, maximum + 3)}-12-31`,
  };
}

function hazardDateRange(handoff: Screen02WorkflowHandoff) {
  const eventDates = handoff.event.dateLeads
    .filter((lead) => lead.stage === "occurrence")
    .map((lead) => dateOnly(lead.date))
    .filter((date): date is string => date !== null);
  if (eventDates.length === 0) return yearRange(handoff);
  const earliest = Date.parse(`${eventDates.sort()[0]}T00:00:00.000Z`);
  const latest = Date.parse(`${eventDates.sort().at(-1)}T00:00:00.000Z`);
  const oneWeek = 7 * 24 * 60 * 60 * 1_000;
  return {
    startDate: new Date(earliest - oneWeek).toISOString().slice(0, 10),
    endDate: new Date(latest + oneWeek).toISOString().slice(0, 10),
  };
}

function safeHost(locator: string) {
  try {
    const parsed = new URL(locator);
    return parsed.protocol === "https:" ? parsed.hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

const REVIEWED_OFFICIAL_DOCUMENT_HOSTS = new Set([
  "leginfo.legislature.ca.gov",
  "oag.ca.gov",
  "www.oag.ca.gov",
  "www.sos.ca.gov",
  "vig.cdn.sos.ca.gov",
  "www.irs.gov",
  "www.nhc.noaa.gov",
  "www.sec.gov",
  "www.congress.gov",
  "congress.gov",
  "www.govinfo.gov",
  "govinfo.gov",
  "laws-lois.justice.gc.ca",
  "www.legifrance.gouv.fr",
  "legifrance.gouv.fr",
  "www.gesetze-im-internet.de",
  "gesetze-im-internet.de",
  "www.irishstatutebook.ie",
  "irishstatutebook.ie",
  "www.boe.es",
  "boe.es",
  "diariodarepublica.pt",
  "www.dre.pt",
  "dre.pt",
  "elaw.klri.re.kr",
  "elaws.e-gov.go.jp",
  "www.japaneselawtranslation.go.jp",
  "japaneselawtranslation.go.jp",
  "www.indiacode.nic.in",
  "indiacode.nic.in",
]);

const REVIEWED_OFFICIAL_HOST_SUFFIXES = [
  ".gov",
  ".mil",
  ".gov.uk",
  ".gov.au",
  ".govt.nz",
  ".gc.ca",
  ".gouv.fr",
  ".bund.de",
  ".admin.ch",
  ".gov.ie",
  ".go.jp",
  ".gov.sg",
  ".gov.in",
  ".gov.za",
  ".gov.br",
  ".gob.mx",
  ".gob.es",
  ".gov.pt",
  ".gov.it",
  ".europa.eu",
] as const;

function reviewedOfficialHost(hostname: string) {
  const host = hostname.toLocaleLowerCase("en-US");
  return CONNECTOR_RECORD_LOCATOR_HOSTS.has(host) ||
    REVIEWED_OFFICIAL_DOCUMENT_HOSTS.has(host) ||
    REVIEWED_OFFICIAL_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/**
 * Fixed secondary publishers reviewed for this narrow, low-authority lane.
 * Index presence alone never qualifies a publisher, and exact hosts are used
 * so an attacker-controlled sibling domain cannot inherit admission.
 */
const REVIEWED_RELATED_DOCUMENT_HOSTS = new Set([
  "apnews.com",
  "www.bbc.com",
  "www.reuters.com",
]);

const CONNECTOR_RECORD_LOCATOR_HOSTS = new Set(
  OFFICIAL_CONNECTOR_IDS.flatMap(
    (connectorId) =>
      getScreen02SourceCatalogEntry(connectorId).recordLocatorHosts,
  ),
);

function allowlistedOfficialDocumentLocator(locator: string) {
  try {
    const parsed = new URL(locator);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      (parsed.port !== "" && parsed.port !== "443") ||
      parsed.hash
    ) {
      return null;
    }
    if (
      !reviewedOfficialHost(parsed.hostname)
    ) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Contextual discovery may return any publisher URL. Admit a page fetch only
 * when the index-bound publisher is the exact public HTTPS host and the URL
 * has no credentials, custom port, fragment, IP literal, or local/private
 * hostname suffix. Redirects remain disabled at fetch time.
 */
function allowlistedRelatedDocumentLocator(lead: Screen02ContextLead) {
  try {
    const parsed = new URL(lead.locator);
    const hostname = parsed.hostname.toLocaleLowerCase("en-US");
    const publisher = lead.publisher.toLocaleLowerCase("en-US");
    const ipv4 = hostname.split(".").map(Number);
    const isIpv4 = ipv4.length === 4 && ipv4.every((part) =>
      Number.isInteger(part) && part >= 0 && part <= 255
    );
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      (parsed.port !== "" && parsed.port !== "443") ||
      parsed.hash ||
      hostname !== publisher ||
      !REVIEWED_RELATED_DOCUMENT_HOSTS.has(hostname) ||
      !hostname.includes(".") ||
      hostname.includes(":") ||
      isIpv4 ||
      /(?:^|\.)(?:localhost|local|internal|home|lan|test|invalid)$/.test(
        hostname,
      )
    ) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function relatedDocumentMatchesSelectedEvent(
  text: string,
  handoff: Screen02WorkflowHandoff,
) {
  const normalized = normalizedToken(text);
  const identity = handoff.event.identity;
  const anchors = [
    identity.formalIdentifier,
    identity.canonicalTitle,
    ...identity.commonNames,
  ]
    .filter((value): value is string => Boolean(value))
    .map(normalizedToken)
    .filter((value) => value.length >= 3);
  return anchors.some((anchor) => containsTokenSequence(normalized, anchor));
}

/**
 * Authoritative promotion of a researcher-supplied locator needs a stronger
 * identity anchor than contextual discovery. An official page that merely
 * mentions a short/common alias can still describe a different instrument or
 * event. Require the fetched bytes themselves to contain the selected formal
 * identifier or complete canonical title. When the locator carries a
 * recognized exact CELEX or Federal Register coordinate, that coordinate must
 * also be equivalent to the selected formal identifier; a matching title
 * elsewhere in the page cannot repair a different-record selection.
 */
function authoritativeDocumentMatchesSelectedEvent(
  text: string,
  handoff: Screen02WorkflowHandoff,
  exactLocatorFormalIdentifiers: readonly string[],
) {
  const selectedFormalIdentifier = handoff.event.identity.formalIdentifier;
  const exactLocatorIdentifiers = exactLocatorFormalIdentifiers
    .filter((value, index, values) => values.indexOf(value) === index);
  if (
    exactLocatorIdentifiers.length > 0 &&
    (!selectedFormalIdentifier || exactLocatorIdentifiers.some((identifier) =>
      !screen03FormalIdentifiersEquivalent(
        identifier,
        selectedFormalIdentifier,
      )
    ))
  ) return false;
  const normalized = normalizedToken(text);
  const identity = handoff.event.identity;
  return [identity.formalIdentifier, identity.canonicalTitle]
    .filter((value): value is string => Boolean(value))
    .map(normalizedToken)
    .filter((value) => value.length >= 3)
    .some((anchor) => containsTokenSequence(normalized, anchor));
}

function decodeHtmlEntity(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => {
      const codePoint = Number.parseInt(hex, 16);
      return Number.isSafeInteger(codePoint) && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : "";
    })
    .replace(/&#(\d+);/g, (_match, decimal: string) => {
      const codePoint = Number.parseInt(decimal, 10);
      return Number.isSafeInteger(codePoint) && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : "";
    })
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function visibleDocumentText(body: string) {
  const decoded = decodeHtmlEntity(
    body
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
      .replace(/<br\b[^>]*>|<\/(?:address|article|aside|blockquote|div|h[1-6]|li|main|p|section|td|th|tr)>/gi, "\n\n")
      .replace(/<[^>]+>/g, " "),
  );
  const blocks = decoded
    .split(/\n\s*\n/gu)
    .map((block) => block.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return blocks
    .map((block, index) =>
      index < blocks.length - 1 && !/[.!?;:]["'\u2019\u201d)\]]*$/u.test(block)
        ? `${block}.`
        : block
    )
    .join(" ")
    .trim();
}

function visibleJsonDocumentText(body: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  const values: string[] = [];
  const visit = (value: unknown, depth: number) => {
    if (depth > 8 || values.length >= 2_000) return;
    if (typeof value === "string" || typeof value === "number") {
      const text = normalizedText(String(value), 1_600);
      if (text) values.push(text);
      return;
    }
    if (Array.isArray(value)) {
      value.slice(0, 200).forEach((item) => visit(item, depth + 1));
      return;
    }
    if (typeof value === "object" && value !== null) {
      Object.values(value as Record<string, unknown>)
        .slice(0, 200)
        .forEach((item) => visit(item, depth + 1));
    }
  };
  visit(parsed, 0);
  return normalizedText(values.join(". "), SCREEN_03_DOCUMENT_MAX_TEXT);
}

function selectedEuDocumentBodyRecordId(
  body: string,
  expectedRecordId: string,
  handoff: Screen02WorkflowHandoff,
) {
  const leadingRecordId = leadingVisibleEuDocumentRecordId(body);
  if (leadingRecordId) return leadingRecordId;
  const canonicalTitle = normalizedToken(handoff.event.identity.canonicalTitle);
  const visible = normalizedToken(visibleDocumentText(body).slice(0, 20_000));
  return canonicalTitle.length >= 16 &&
      containsTokenSequence(visible, canonicalTitle)
    ? expectedRecordId
    : null;
}

function ordinalDay(day: number) {
  const mod100 = day % 100;
  const suffix = mod100 >= 11 && mod100 <= 13
    ? "th"
    : day % 10 === 1
      ? "st"
      : day % 10 === 2
        ? "nd"
        : day % 10 === 3
          ? "rd"
          : "th";
  return `${day}${suffix}`;
}

function dateTextVariants(value: string) {
  const exact = dateOnly(value);
  if (!exact) return [];
  const [year, paddedMonth, paddedDay] = exact.split("-");
  const monthNumber = Number(paddedMonth);
  const dayNumber = Number(paddedDay);
  const monthNames = MONTH_NAMES[monthNumber - 1] ?? [];
  const day = String(dayNumber);
  const ordinal = ordinalDay(dayNumber);
  const paddedOrdinal = dayNumber < 10 ? `0${ordinal}` : ordinal;
  const unambiguousDayMonth = dayNumber > 12
    ? [
        `${paddedDay} ${paddedMonth} ${year}`,
        `${day} ${monthNumber} ${year}`,
        `${paddedMonth} ${paddedDay} ${year}`,
        `${monthNumber} ${day} ${year}`,
      ]
    : [];
  return [
    exact,
    `${year} ${monthNumber} ${dayNumber}`,
    ...unambiguousDayMonth,
    ...monthNames.flatMap((month) => [
      `${day} ${month} ${year}`,
      `${paddedDay} ${month} ${year}`,
      `${ordinal} ${month} ${year}`,
      `${paddedOrdinal} ${month} ${year}`,
      `${month} ${day} ${year}`,
      `${month} ${paddedDay} ${year}`,
      `${month} ${ordinal} ${year}`,
      `${month} ${paddedOrdinal} ${year}`,
    ]),
  ]
    .map((variant) => normalizedToken(variant))
    .filter((variant, index, variants) => variants.indexOf(variant) === index);
}

function representativeDateTextVariants(value: string) {
  const exact = dateOnly(value);
  if (!exact) return [];
  const [year, paddedMonth, paddedDay] = exact.split("-");
  const monthNumber = Number(paddedMonth);
  const dayNumber = Number(paddedDay);
  const fullMonth = MONTH_NAMES[monthNumber - 1]?.[0];
  return [
    exact,
    ...(dayNumber > 12
      ? [
          `${paddedDay} ${paddedMonth} ${year}`,
          `${paddedMonth} ${paddedDay} ${year}`,
        ]
      : []),
    fullMonth ? `${dayNumber} ${fullMonth} ${year}` : "",
    fullMonth ? `${paddedDay} ${fullMonth} ${year}` : "",
    fullMonth ? `${fullMonth} ${dayNumber} ${year}` : "",
    fullMonth ? `${fullMonth} ${paddedDay} ${year}` : "",
  ]
    .map((variant) => normalizedToken(variant))
    .filter((variant) => variant.length >= 3)
    .filter((variant, index, variants) => variants.indexOf(variant) === index);
}

function containsTokenSequence(text: string, sequence: string) {
  return ` ${text} `.includes(` ${sequence} `);
}

function tokenSequenceMatcher(value: string) {
  const tokens = normalizedToken(value).split(" ").filter(Boolean);
  if (tokens.length === 0) return null;
  return new RegExp(
    tokens
      .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("[^\\p{L}\\p{N}]+"),
    "giu",
  );
}

function textContainsDate(text: string, date: string) {
  const normalized = normalizedToken(text);
  return dateTextVariants(date).some((variant) =>
    containsTokenSequence(normalized, variant),
  );
}

function federalRegisterDocumentNumber(value: string) {
  const normalized = value.normalize("NFKC").trim();
  return /^(\d{4}-\d{4,8})$/u.exec(normalized)?.[1] ??
    /(?:^|[^\p{L}\p{N}])FR\s+Doc(?:ument)?\.?\s+(?:No\.?\s*)?(\d{4}-\d{4,8})(?![\p{L}\p{N}])/iu
      .exec(normalized)?.[1] ?? null;
}

/** @internal Exported for deterministic official-locator regression coverage. */
export function screen03FederalRegisterLocatorDocumentNumber(value: string) {
  try {
    const parsed = new URL(value);
    if (![
      "federalregister.gov",
      "www.federalregister.gov",
      "govinfo.gov",
      "www.govinfo.gov",
    ].includes(parsed.hostname.toLocaleLowerCase("en-US"))) return null;
    return /(?:^|[/])((?:18|19|20|21)\d{2}-\d{4,8})(?:[/]|\.(?:htm|html|json|pdf|txt|xml)(?:[/]|$)|$)/iu
      .exec(parsed.pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}

type Screen03EuropeanInstrumentIdentifier = Readonly<{
  source: "celex" | "citation";
  namespace: "ec" | "eec" | "eu" | "uk" | null;
  modifier: "delegated" | "implementing" | null;
  kind: "decision" | "directive" | "regulation";
  year: string;
  serial: string;
}>;

function screen03EuropeanInstrumentIdentifier(
  value: string,
): Screen03EuropeanInstrumentIdentifier | null {
  const compact = value.normalize("NFKC").toLocaleUpperCase("en-US")
    .replace(/[^A-Z0-9]/gu, "");
  const celex = /^(?:CELEX)?3(\d{4})([RLD])(\d{1,4})$/u.exec(compact);
  if (celex) {
    const kind = celex[2] === "R"
      ? "regulation"
      : celex[2] === "L"
        ? "directive"
        : "decision";
    return {
      source: "celex",
      namespace: null,
      modifier: null,
      kind,
      year: celex[1]!,
      serial: String(Number(celex[3])),
    };
  }
  const parsed = parseScreen02FormalIdentifier(value);
  if (parsed?.family !== "european-instrument") return null;
  const kind = parsed.coordinates.kind;
  const year = parsed.coordinates.year;
  const serial = parsed.coordinates.serial;
  if (
    !year || !serial ||
    (kind !== "decision" && kind !== "directive" && kind !== "regulation")
  ) return null;
  const namespace = parsed.coordinates.namespace;
  const modifier = parsed.coordinates.modifier;
  return {
    source: "citation",
    namespace:
      namespace === "ec" || namespace === "eec" || namespace === "eu" ||
        namespace === "uk"
        ? namespace
        : null,
    modifier:
      modifier === "delegated" || modifier === "implementing"
        ? modifier
        : null,
    kind,
    year,
    serial,
  };
}

function euLegalInstrumentIdentifier(value: string) {
  const instrument = screen03EuropeanInstrumentIdentifier(value);
  if (!instrument) return null;
  return [
    instrument.source === "celex"
      ? "celex"
      : instrument.namespace ?? "unscoped",
    instrument.modifier,
    instrument.kind,
    instrument.year,
    instrument.serial,
  ].filter(Boolean).join("-");
}

function normalizedFormalIdentifier(value: string) {
  return euLegalInstrumentIdentifier(value) ??
    federalRegisterDocumentNumber(value) ??
    canonicalScreen02FormalIdentifier(value) ??
    normalizedToken(value);
}

/**
 * Exact Screen 3 identity equality. CELEX does not encode the displayed
 * EC/EEC/EU wrapper, so it may bridge those official citation namespaces;
 * it can never bridge a UK citation. CELEX is itself the exact official record
 * coordinate, so a citation's delegated/implementing label may accompany that
 * record even though CELEX does not repeat the label. Two displayed citations
 * must retain and match every explicit kind, modifier, namespace, year, and
 * serial coordinate.
 */
export function screen03FormalIdentifiersEquivalent(
  leftValue: string | null | undefined,
  rightValue: string | null | undefined,
) {
  return screen03FormalIdentifierRelation(leftValue, rightValue) ===
    "equivalent";
}

function screen03FormalIdentifierRelation(
  leftValue: string | null | undefined,
  rightValue: string | null | undefined,
) {
  const left = screen03EuropeanInstrumentIdentifier(leftValue ?? "");
  const right = screen03EuropeanInstrumentIdentifier(rightValue ?? "");
  if (left && right) {
    if (left.year !== right.year || left.serial !== right.serial) {
      return "different" as const;
    }
    if (left.kind !== right.kind) return "conflict" as const;
    if (left.source === "citation" && right.source === "citation") {
      return compareScreen02FormalIdentifiers(leftValue, rightValue);
    }
    const citation = left.source === "citation" ? left : right;
    return citation.namespace === "uk"
      ? "conflict" as const
      : "equivalent" as const;
  }
  if (left || right) return "different" as const;
  const leftFederalRegister = federalRegisterDocumentNumber(leftValue ?? "");
  const rightFederalRegister = federalRegisterDocumentNumber(rightValue ?? "");
  if (leftFederalRegister && rightFederalRegister) {
    return leftFederalRegister === rightFederalRegister
      ? "equivalent" as const
      : "different" as const;
  }
  return compareScreen02FormalIdentifiers(leftValue, rightValue);
}

/** Construct only a lookup key; evidence still comes from the response field. */
function selectedEuCelexLookupKey(formalIdentifier: string) {
  const instrument = screen03EuropeanInstrumentIdentifier(formalIdentifier);
  if (
    !instrument ||
    (instrument.source === "citation" &&
      !["ec", "eec", "eu"].includes(instrument.namespace ?? "")) ||
    instrument.serial.length > 4
  ) return null;
  const type = instrument.kind === "regulation" ? "R"
    : instrument.kind === "directive" ? "L" : "D";
  return `3${instrument.year}${type}${instrument.serial.padStart(4, "0")}`;
}

type GloballyScopedFormalIdentifierNamespace =
  | "eu-legal-instrument"
  | "federal-register-document"
  | "fema-disaster"
  | "uk-legislation";

/**
 * Exact strings are not necessarily globally unique identifiers. For example,
 * two issuing systems can both publish a record numbered `2026-12345`. Treat a
 * formal identifier as self-sufficient only when its syntax and authoritative
 * locator establish a recognized global namespace. Every other identifier
 * still needs positive issuer/jurisdiction or controlling-source context.
 */
function globallyScopedFormalIdentifierNamespace(
  value: string,
  locators: string[],
): GloballyScopedFormalIdentifierNamespace | null {
  const compact = value.normalize("NFKC").toLocaleUpperCase("en-US")
    .replace(/[^A-Z0-9]/gu, "");
  const hosts = locators.map((locator) => safeHost(locator) ?? "");
  const hasHost = (predicate: (host: string) => boolean) =>
    hosts.some(predicate);

  const europeanInstrument = screen03EuropeanInstrumentIdentifier(value);
  const explicitCelex = /^(?:CELEX)?3\d{4}[RLD]\d{1,4}$/u.test(compact);
  const explicitEuCitation = europeanInstrument?.source === "citation" &&
    ["ec", "eec", "eu"].includes(europeanInstrument.namespace ?? "");
  if (
    europeanInstrument && europeanInstrument.namespace !== "uk" &&
    (explicitCelex || explicitEuCitation ||
      hasHost((host) => host === "publications.europa.eu" ||
        host === "eur-lex.europa.eu" || host.endsWith(".europa.eu")))
  ) {
    return "eu-legal-instrument";
  }

  if (
    federalRegisterDocumentNumber(value) &&
    hasHost((host) =>
      host === "federalregister.gov" ||
      host === "www.federalregister.gov" ||
      host === "govinfo.gov" ||
      host === "www.govinfo.gov"
    )
  ) {
    return "federal-register-document";
  }

  if (
    /^FEMA\d+$/u.test(compact) &&
    hasHost((host) => host === "fema.gov" || host.endsWith(".fema.gov"))
  ) {
    return "fema-disaster";
  }

  if (
    (/^(?:UKPGA|UKSI|UKLA|ASP|ANAW|ASC|MWA|NISI)\d{4}\d+$/u.test(compact) ||
      europeanInstrument?.namespace === "uk") &&
    hasHost((host) =>
      host === "legislation.gov.uk" || host === "www.legislation.gov.uk"
    )
  ) {
    return "uk-legislation";
  }

  return null;
}

function federalRegisterDocumentMarkers(text: string) {
  return [...text.matchAll(
    /\[?\s*FR\s+Doc(?:ument)?\.?\s+(?:No\.?\s*)?(\d{4}-\d{4,8})\b/giu,
  )].map((match) => ({
    documentNumber: match[1]!,
    start: match.index,
    end: match.index + match[0].length,
  }));
}

/**
 * A Federal Register volume can place the last paragraph of one notice on the
 * same printed page as the next notice. Associate content with the FR Doc
 * number carried by the per-record locator before searching for dates. In the
 * common printed-edition layout the marker closes a document; on per-record
 * HTML pages it can precede the title, so the nearest selected title decides
 * which side of the marker is the record body.
 */
function identityBoundedOfficialDocumentText(
  text: string,
  locator: string,
  handoff: Screen02WorkflowHandoff,
) {
  const host = safeHost(locator);
  if (![
    "federalregister.gov",
    "www.federalregister.gov",
    "govinfo.gov",
    "www.govinfo.gov",
  ].includes(host ?? "")) {
    return { text, grounded: true };
  }
  const locatorDocumentNumber = screen03FederalRegisterLocatorDocumentNumber(
    locator,
  );
  const selectedDocumentNumber = federalRegisterDocumentNumber(
    handoff.event.identity.formalIdentifier ?? "",
  );
  const expectedDocumentNumber =
    locatorDocumentNumber ?? selectedDocumentNumber;
  if (!expectedDocumentNumber) {
    return { text: "", grounded: false };
  }
  const markers = federalRegisterDocumentMarkers(text);
  const matchingIndex = markers.findIndex(
    (marker) => marker.documentNumber === expectedDocumentNumber,
  );
  if (matchingIndex < 0) {
    // The reviewed FederalRegister.gov and govinfo.gov locators are scoped to
    // one explicit document number. That locator identity is sufficient only
    // when the body contains no competing FR Doc boundary at all.
    return markers.length === 0 && locatorDocumentNumber === expectedDocumentNumber
      ? { text, grounded: true }
      : { text: "", grounded: false };
  }
  const marker = markers[matchingIndex]!;
  const previousEnd = markers[matchingIndex - 1]?.end ?? 0;
  const nextStart = markers[matchingIndex + 1]?.start ?? text.length;
  const titleMatcher = tokenSequenceMatcher(
    handoff.event.identity.canonicalTitle,
  );
  const titlePositions: number[] = [];
  if (titleMatcher) {
    for (const match of text.matchAll(titleMatcher)) {
      if (match.index >= previousEnd && match.index < nextStart) {
        titlePositions.push(match.index);
      }
    }
  }
  const closestTitle = titlePositions.sort(
    (left, right) => Math.abs(left - marker.start) - Math.abs(right - marker.start),
  )[0];
  const markerPrecedesBody = closestTitle !== undefined &&
    closestTitle >= marker.end;
  const start = markerPrecedesBody ? marker.start : previousEnd;
  const end = markerPrecedesBody ? nextStart : marker.end;
  const bounded = text.slice(start, end).trim();
  return {
    text: bounded,
    grounded: bounded.length > 0,
  };
}

function appendUniqueTerm(target: string[], seen: Set<string>, value: string) {
  const term = normalizedToken(value);
  if (term.length < 3 || seen.has(term)) return false;
  seen.add(term);
  target.push(term);
  return true;
}

/**
 * Build the document search plan by category instead of truncating one global
 * list. Identity anchors, operative vocabulary, and three representation
 * families for every valid date lead are mandatory. Only optional aliases,
 * extra date spellings, and lexical title tokens share the remaining target
 * budget, allocated round-robin so one verbose category cannot starve another.
 *
 * A handoff with unusually many distinct date leads can exceed the target of
 * 40 terms: preserving a representative ISO, numeric, and natural-language
 * spelling for each upstream lead is more important than silently dropping a
 * lead. Work remains bounded to four matches per resulting term and the fixed
 * four-excerpt output cap.
 */
function documentSearchTerms(
  handoff: Screen02WorkflowHandoff,
  targetClaim?: ResearchScreen03EvidenceInput["targetClaim"],
) {
  const terms: string[] = [];
  const seen = new Set<string>();
  const identity = handoff.event.identity;

  appendUniqueTerm(terms, seen, identity.canonicalTitle);
  appendUniqueTerm(terms, seen, identity.formalIdentifier ?? "");
  if (targetClaim) {
    // A claim-targeted search must not let a verbose date/alias inventory
    // consume the complete extraction budget before the selected claim is
    // considered. Preserve the exact visible value and label first; bounded
    // lexical fallbacks remain in the fair optional lane below.
    appendUniqueTerm(terms, seen, targetClaim.value);
    appendUniqueTerm(terms, seen, targetClaim.label);
  }
  for (const stageTerm of DOCUMENT_STAGE_TERMS) {
    appendUniqueTerm(terms, seen, stageTerm);
  }

  const additionalDateVariants: string[][] = [];
  for (const lead of handoff.event.dateLeads) {
    const representatives = representativeDateTextVariants(lead.date);
    for (const representative of representatives) {
      appendUniqueTerm(terms, seen, representative);
    }
    const representativeSet = new Set(representatives);
    additionalDateVariants.push(
      dateTextVariants(lead.date).filter(
        (variant) => !representativeSet.has(variant),
      ),
    );
  }

  const optionalGroups = [
    targetClaim
      ? [...lexicalTerms(targetClaim.value)]
      : [],
    identity.commonNames.map((alias) => normalizedToken(alias)),
    ...additionalDateVariants,
    [...lexicalTerms(identity.canonicalTitle)],
  ];
  for (
    let depth = 0;
    terms.length < SCREEN_03_DOCUMENT_TARGET_SEARCH_TERMS;
    depth += 1
  ) {
    let found = false;
    for (const group of optionalGroups) {
      const candidate = group[depth];
      if (candidate === undefined) continue;
      found = true;
      appendUniqueTerm(terms, seen, candidate);
      if (terms.length === SCREEN_03_DOCUMENT_TARGET_SEARCH_TERMS) break;
    }
    if (!found) break;
  }
  return terms;
}

function boundedDocumentExcerpts(
  text: string,
  handoff: Screen02WorkflowHandoff,
  targetClaim?: ResearchScreen03EvidenceInput["targetClaim"],
) {
  const terms = documentSearchTerms(handoff, targetClaim);
  type DocumentWindow = {
    start: number;
    end: number;
    index: number;
    score: number;
    text: string;
    leadKeys: string[];
    stageKeys: string[];
    targetMatches: number;
    identityMatches: number;
  };
  const alignedBounds = (start: number, end: number) => {
    let alignedStart = start;
    const backwardLimit = Math.max(0, start - 500);
    for (let index = start - 1; index >= backwardLimit; index -= 1) {
      if (
        screen03CharacterEndsSentence(text, index) &&
        /\s/u.test(text[index + 1] ?? "")
      ) {
        alignedStart = index + 1;
        break;
      }
    }
    let alignedEnd = end;
    const forwardLimit = Math.min(text.length, end + 500);
    for (let index = end; index < forwardLimit; index += 1) {
      if (
        screen03CharacterEndsSentence(text, index) &&
        (index + 1 === text.length || /\s/u.test(text[index + 1] ?? ""))
      ) {
        alignedEnd = index + 1;
        break;
      }
    }
    // Evidence passages remain bounded. When a single legal sentence is too
    // long, retain the original relevant window; the complete-statement gate
    // will ignore its cut edges instead of showing them as review claims.
    return alignedEnd - alignedStart <= 1_600
      ? { start: alignedStart, end: alignedEnd }
      : { start, end };
  };
  const describeWindow = (requestedStart: number, requestedEnd: number): DocumentWindow => {
    const { start, end } = alignedBounds(requestedStart, requestedEnd);
    const excerpt = text.slice(start, end).trim();
    const normalizedExcerpt = normalizedToken(excerpt);
    const matchingLeads = handoff.event.dateLeads
      .map((lead, leadIndex) => ({ lead, leadIndex }))
      .filter(({ lead }) => textContainsDate(normalizedExcerpt, lead.date));
    const stageKeys = [
      ...DOCUMENT_STAGE_TERMS.filter((stageTerm) =>
        containsTokenSequence(
          normalizedExcerpt,
          normalizedToken(stageTerm),
        ),
      ).map((stageTerm) => `term:${normalizedToken(stageTerm)}`),
      ...matchingLeads.map(({ lead }) => `lead-stage:${lead.stage}`),
    ].filter((value, index, values) => values.indexOf(value) === index);
    const identityMatches = [
      handoff.event.identity.formalIdentifier ?? "",
      ...handoff.event.identity.commonNames,
      handoff.event.identity.canonicalTitle,
    ].filter((identityTerm) => {
      const normalizedIdentity = normalizedToken(identityTerm);
      return normalizedIdentity.length >= 3 &&
        containsTokenSequence(normalizedExcerpt, normalizedIdentity);
    }).length;
    const targetMatches = targetClaim
      ? [targetClaim.value, targetClaim.label]
          .map(normalizedToken)
          .filter((value) => value.length >= 3)
          .filter((value) => containsTokenSequence(normalizedExcerpt, value))
          .length
      : 0;
    const leadKeys = matchingLeads.map(
      ({ lead, leadIndex }) => `${leadIndex}:${lead.id}:${lead.date}`,
    );
    return {
      start,
      end,
      index: start,
      // The selected claim is the reason for this explicit research action.
      // One exact target match must outrank generic stage/date density while
      // the ordinary (non-targeted) ranking remains byte-for-byte equivalent.
      score: targetMatches * 100_000 +
        leadKeys.length * 100 + stageKeys.length * 10 + identityMatches * 3,
      text: excerpt,
      leadKeys,
      stageKeys,
      targetMatches,
      identityMatches,
    };
  };
  const overlapRatio = (left: DocumentWindow, right: DocumentWindow) => {
    const overlap = Math.max(
      0,
      Math.min(left.end, right.end) - Math.max(left.start, right.start),
    );
    return overlap / Math.min(left.end - left.start, right.end - right.start);
  };

  const windows: DocumentWindow[] = [];
  for (const term of terms) {
    const matcher = tokenSequenceMatcher(term);
    if (!matcher) continue;
    let matchesForTerm = 0;
    while (matchesForTerm < SCREEN_03_DOCUMENT_MAX_MATCHES_PER_TERM) {
      const match = matcher.exec(text);
      if (!match) break;
      const index = match.index;
      const start = Math.max(0, index - 260);
      const end = Math.min(text.length, index + match[0].length + 420);
      windows.push(describeWindow(start, end));
      matchesForTerm += 1;
    }
  }

  // Multiple nearby terms normally describe the same passage. Merge their
  // heavily overlapping windows before ranking so a dense early paragraph
  // cannot masquerade as several independent excerpts.
  const consolidated: DocumentWindow[] = [];
  for (const window of windows.sort(
    (left, right) => left.start - right.start || left.end - right.end,
  )) {
    const overlappingIndex = consolidated.findIndex(
      (candidate) => overlapRatio(candidate, window) >= 0.6,
    );
    if (overlappingIndex < 0) {
      consolidated.push(window);
      continue;
    }
    const overlapping = consolidated[overlappingIndex]!;
    const mergedStart = Math.min(overlapping.start, window.start);
    const mergedEnd = Math.max(overlapping.end, window.end);
    consolidated[overlappingIndex] = mergedEnd - mergedStart <= 1_600
      ? describeWindow(mergedStart, mergedEnd)
      : [overlapping, window].sort(
          (left, right) => right.score - left.score || left.index - right.index,
        )[0]!;
  }

  // Greedily maximize new date-lead and stage coverage. Base relevance only
  // breaks ties after diversity, preventing repeated mentions of an early date
  // from consuming all four bounded excerpt slots.
  const remaining = consolidated.filter((window) => window.text.length >= 40);
  const selected: DocumentWindow[] = [];
  const coveredLeadKeys = new Set<string>();
  const coveredStageKeys = new Set<string>();
  // Initial review must retain an exact selected-event identity passage when
  // one exists. Dense lifecycle sections otherwise consume every window even
  // when the official heading directly establishes the event. This reserves
  // one existing slot; an explicit target-claim request retains its priority.
  if (!targetClaim) {
    const identityWindow = remaining.filter((window) => window.identityMatches > 0)
      .sort((left, right) => right.identityMatches - left.identityMatches ||
        right.score - left.score || left.index - right.index)[0];
    if (identityWindow) {
      selected.push(identityWindow);
      remaining.splice(remaining.indexOf(identityWindow), 1);
      identityWindow.leadKeys.forEach((key) => coveredLeadKeys.add(key));
      identityWindow.stageKeys.forEach((key) => coveredStageKeys.add(key));
    }
  }
  while (
    selected.length < SCREEN_03_DOCUMENT_MAX_EXCERPTS &&
    remaining.length > 0
  ) {
    remaining.sort((left, right) => {
      const diversityScore = (window: DocumentWindow) =>
        window.leadKeys.filter((key) => !coveredLeadKeys.has(key)).length * 10_000 +
        window.stageKeys.filter((key) => !coveredStageKeys.has(key)).length * 1_000 +
        window.score;
      return diversityScore(right) - diversityScore(left) ||
        right.score - left.score ||
        left.index - right.index;
    });
    const chosen = remaining.shift()!;
    selected.push(chosen);
    chosen.leadKeys.forEach((key) => coveredLeadKeys.add(key));
    chosen.stageKeys.forEach((key) => coveredStageKeys.add(key));
  }

  return selected
    .sort((left, right) => left.index - right.index)
    .map((window) => window.text)
    .filter(
      (value, index, values) =>
        values.findIndex(
          (candidate) => normalizedToken(candidate) === normalizedToken(value),
        ) === index,
    );
}

async function readBoundedResponseText(
  response: Response,
  maximumBytes: number,
  budget: DocumentByteBudget,
): Promise<{
  text: string;
  bytes: Uint8Array<ArrayBuffer>;
  exceeded: boolean;
  aggregateExceeded?: boolean;
}> {
  if (!response.body) {
    return {
      text: "",
      bytes: new Uint8Array(new ArrayBuffer(0)),
      exceeded: false,
    };
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: Uint8Array[] = [];
  let received = 0;
  let text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      received += chunk.value.byteLength;
      const aggregateExceeded = chunk.value.byteLength > budget.remaining;
      budget.remaining = Math.max(0, budget.remaining - chunk.value.byteLength);
      if (received > maximumBytes || aggregateExceeded) {
        try {
          await reader.cancel("Screen 3 official-document byte limit reached");
        } catch {
          // The fixed byte gate already rejected the body; cancellation is
          // best-effort because some injected fetch adapters close first.
        }
        return {
          text: "",
          bytes: new Uint8Array(new ArrayBuffer(0)),
          exceeded: true,
          aggregateExceeded,
        };
      }
      chunks.push(chunk.value);
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    const bytes = new Uint8Array(new ArrayBuffer(received));
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { text, bytes, exceeded: false };
  } finally {
    reader.releaseLock();
  }
}

async function fingerprintDocumentBytes(bytes: Uint8Array<ArrayBuffer>) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

function detectedPdfPageCount(bytes: Uint8Array<ArrayBuffer>) {
  // This is only an advisory raw-byte upper-bound screen, not an authoritative
  // PDF parser. Object streams, encryption, or an absent count make the page
  // bound unknowable here and therefore fail closed before conversion.
  const binary = new TextDecoder("latin1").decode(bytes);
  if (
    !binary.startsWith("%PDF-") ||
    /\/ObjStm\b|\/Type\s*\/XRef\b|\/XRefStm\b|\/Encrypt\b/.test(binary)
  ) return 0;
  const pageObjects = [...binary.matchAll(/\/Type\s*\/Page\b/g)].length;
  const declaredPageTreeCounts = [
    ...binary.matchAll(/\/Type\s*\/Pages\b[\s\S]{0,512}?\/Count\s+(\d+)/g),
    ...binary.matchAll(/\/Count\s+(\d+)[\s\S]{0,512}?\/Type\s*\/Pages\b/g),
  ]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isSafeInteger(value) && value > 0);
  return Math.max(pageObjects, ...declaredPageTreeCounts, 0);
}

function documentConversionName(locator: string) {
  try {
    const lastSegment = new URL(locator).pathname.split("/").filter(Boolean).at(-1);
    const name = normalizedText(lastSegment ?? "official-record.pdf", 120);
    return /\.pdf$/i.test(name) ? name : `${name || "official-record"}.pdf`;
  } catch {
    return "official-record.pdf";
  }
}

async function convertBoundedPdf(input: {
  converter: Screen03DocumentConverter;
  locator: string;
  bytes: Uint8Array<ArrayBuffer>;
  detectedPageCount: number;
  deadline: Screen03ResearchDeadline;
}) {
  const controller = new AbortController();
  const abortFromDeadline = () => controller.abort(
    input.deadline.signal.reason ??
      new DOMException("Screen 3 research deadline reached", "TimeoutError"),
  );
  if (input.deadline.signal.aborted) abortFromDeadline();
  else input.deadline.signal.addEventListener("abort", abortFromDeadline, {
    once: true,
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      input.converter({
        name: documentConversionName(input.locator),
        blob: new Blob([input.bytes], { type: "application/pdf" }),
        contentType: "application/pdf",
        detectedPageCount: input.detectedPageCount,
        maximumPages: SCREEN_03_DOCUMENT_MAX_PDF_PAGES,
        maximumTextCharacters: SCREEN_03_DOCUMENT_MAX_CONVERTED_TEXT,
        signal: controller.signal,
      }),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new DOMException("Screen 3 PDF conversion timed out", "AbortError"));
        }, Math.max(1, Math.min(
          SCREEN_03_DOCUMENT_CONVERSION_TIMEOUT_MS,
          input.deadline.remainingMs(),
        )));
      }),
    ]);
    if (
      typeof result !== "object" ||
      result === null ||
      Object.keys(result).some((key) => key !== "text") ||
      typeof result.text !== "string"
    ) {
      throw new Error("The document converter returned an unsupported result shape");
    }
    return result.text;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    input.deadline.signal.removeEventListener("abort", abortFromDeadline);
  }
}

async function fetchDocumentText(input: {
  fetch: Screen02ConnectorFetch;
  locator: string;
  sourceLocator?: string;
  handoff: Screen02WorkflowHandoff;
  retrievedAt: string;
  relatedLead?: Screen02ContextLead;
  convertDocument?: Screen03DocumentConverter;
  claimPdfConversionSlot?: () => boolean;
  targetClaim?: ResearchScreen03EvidenceInput["targetClaim"];
  deadline: Screen03ResearchDeadline;
  byteBudget: DocumentByteBudget;
}): Promise<DocumentTextResult> {
  const relatedSource = input.relatedLead !== undefined;
  const safeLocator = input.relatedLead
    ? allowlistedRelatedDocumentLocator(input.relatedLead)
    : allowlistedOfficialDocumentLocator(input.locator);
  const documentLabel = relatedSource ? "related source page" : "official document";
  if (!safeLocator) {
    return {
      locator: input.locator,
      excerpts: [],
      documentKind: "unknown",
      conversionStatus: "rejected",
      gap: {
        locator: input.locator,
        reason: relatedSource
          ? "The related source locator did not match its indexed publisher or the guarded public-HTTPS policy."
          : "The record locator was outside the reviewed official-document host allowlist.",
      },
    };
  }
  const sourceEuRecordId = input.sourceLocator
    ? euOfficialDocumentRecordId(input.sourceLocator)
    : null;
  const targetEuRecordId = euOfficialDocumentRecordId(safeLocator);
  const targetIsEurLex = (() => {
    try {
      return new URL(safeLocator).hostname === "eur-lex.europa.eu";
    } catch {
      return false;
    }
  })();
  const alternateEuRecordId = input.sourceLocator &&
      canonicalLocatorKey(input.sourceLocator) !== canonicalLocatorKey(safeLocator)
    ? sourceEuRecordId
    : null;
  if (alternateEuRecordId && targetEuRecordId !== alternateEuRecordId) {
    return {
      locator: safeLocator,
      excerpts: [],
      documentKind: "unknown",
      conversionStatus: "rejected",
      gap: {
        locator: safeLocator,
        reason:
          "The derived EU official representation did not retain the selected record's exact CELEX identity.",
      },
    };
  }
  const publicationsRecordId = euPublicationsLocatorRecordId(safeLocator);
  const controller = new AbortController();
  const abortFromDeadline = () => controller.abort(
    input.deadline.signal.reason ??
      new DOMException("Screen 3 research deadline reached", "TimeoutError"),
  );
  if (input.deadline.signal.aborted) abortFromDeadline();
  else input.deadline.signal.addEventListener("abort", abortFromDeadline, {
    once: true,
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    timer = setTimeout(
      () => controller.abort(),
      Math.max(
        1,
        Math.min(
          SCREEN_03_DOCUMENT_FETCH_TIMEOUT_MS,
          input.deadline.remainingMs(),
        ),
      ),
    );
    let resolvedLocator = safeLocator;
    let redirectCount = 0;
    let secureRedirectUpgradeCount = 0;
    let response: Response;
    while (true) {
      const headers: Record<string, string> = publicationsRecordId
        ? {
            accept: "application/xhtml+xml",
            "accept-encoding": "identity",
            "accept-language":
              /\.([A-Z]{3})\/?$/u.exec(new URL(safeLocator).pathname)?.[1]
                ?.toLowerCase() ?? "eng",
            "accept-max-cs-size": String(
              SCREEN_03_DOCUMENT_MAX_OFFICIAL_TRANSPORT_BYTES,
            ),
            "user-agent": SHOCKAUDIT_OFFICIAL_SOURCE_USER_AGENT,
          }
        : {
            accept:
              "text/html, application/xhtml+xml, application/xml;q=0.95, text/xml;q=0.95, application/atom+xml;q=0.95, application/json;q=0.9, application/ld+json;q=0.9, text/plain;q=0.85, application/pdf;q=0.8",
            "accept-encoding": "identity",
            "user-agent": SHOCKAUDIT_OFFICIAL_SOURCE_USER_AGENT,
          };
      response = await input.fetch(resolvedLocator, {
        method: "GET",
        headers,
        redirect: "manual",
        cache: "no-store",
        signal: controller.signal,
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      if (redirectCount >= SCREEN_03_DOCUMENT_MAX_REDIRECTS) {
        return {
          locator: safeLocator,
          resolvedLocator,
          redirectCount,
          excerpts: [],
          documentKind: "unknown",
          conversionStatus: "rejected",
          alternateEligible: true,
          gap: {
            locator: safeLocator,
            reason: `The ${documentLabel} exceeded the fixed ${SCREEN_03_DOCUMENT_MAX_REDIRECTS}-redirect limit.`,
          },
        };
      }
      const location = response.headers.get("location");
      if (!location) {
        return {
          locator: safeLocator,
          resolvedLocator,
          redirectCount,
          excerpts: [],
          documentKind: "unknown",
          conversionStatus: "rejected",
          alternateEligible: true,
          gap: {
            locator: safeLocator,
            reason: `The ${documentLabel} returned a redirect without a Location header.`,
          },
        };
      }
      let candidate: string;
      try {
        const candidateUrl = new URL(location, resolvedLocator);
        const secureCellarUpgrade =
          redirectCount === 0 &&
          publicationsRecordId !== null &&
          resolvedLocator === safeLocator &&
          candidateUrl.protocol === "http:" &&
          candidateUrl.hostname === "publications.europa.eu" &&
          !candidateUrl.username &&
          !candidateUrl.password &&
          !candidateUrl.port &&
          !candidateUrl.search &&
          !candidateUrl.hash &&
          /^\/resource\/cellar\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\.\d{4}\.\d{2})?\/DOC_1\/?$/iu
            .test(candidateUrl.pathname);
        if (secureCellarUpgrade) {
          candidateUrl.protocol = "https:";
          secureRedirectUpgradeCount += 1;
        }
        candidate = candidateUrl.toString();
      } catch {
        candidate = "";
      }
      const revalidated = relatedSource
        ? allowlistedRelatedDocumentLocator({
            ...input.relatedLead!,
            locator: candidate,
          })
        : allowlistedOfficialDocumentLocator(candidate);
      const publicationsRedirectEscapedHost = publicationsRecordId !== null &&
        revalidated !== null &&
        new URL(revalidated).hostname !== "publications.europa.eu";
      if (!revalidated || publicationsRedirectEscapedHost) {
        return {
          locator: safeLocator,
          resolvedLocator,
          redirectCount,
          excerpts: [],
          documentKind: "unknown",
          conversionStatus: "rejected",
          alternateEligible: true,
          gap: {
            locator: safeLocator,
            reason: `The ${documentLabel} redirected outside its reviewed HTTPS source policy.`,
          },
        };
      }
      resolvedLocator = revalidated;
      redirectCount += 1;
    }
    if (!response.ok) {
      return {
        locator: safeLocator,
        excerpts: [],
        documentKind: "unknown",
        conversionStatus: "rejected",
        alternateEligible: true,
        gap: {
          locator: safeLocator,
          reason: `The ${documentLabel} returned HTTP ${response.status}.`,
        },
      };
    }
    const contentType = (response.headers.get("content-type") ?? "")
      .toLocaleLowerCase("en-US");
    const contentEncoding = (response.headers.get("content-encoding") ??
      "identity").toLocaleLowerCase("en-US").trim();
    const encodings = contentEncoding.split(",").map((value) => value.trim());
    if (encodings.some((encoding) =>
      !["identity", "gzip", "deflate", "br"].includes(encoding)
    )) {
      return {
        locator: safeLocator,
        excerpts: [],
        documentKind: "unknown",
        conversionStatus: "rejected",
        alternateEligible: true,
        gap: {
          locator: safeLocator,
          reason: `The ${documentLabel} returned an unsupported content encoding.`,
        },
      };
    }
    const isPdf = contentType.includes("application/pdf");
    const isJson = contentType.includes("application/json") ||
      contentType.includes("application/ld+json");
    const isXml = contentType.includes("application/xml") ||
      contentType.includes("text/xml") ||
      contentType.includes("application/atom+xml");
    if (publicationsRecordId &&
      !contentType.includes("application/xhtml+xml")) {
      return {
        locator: safeLocator,
        resolvedLocator,
        redirectCount,
        excerpts: [],
        documentKind: "unknown",
        conversionStatus: "rejected",
        alternateEligible: true,
        gap: {
          locator: safeLocator,
          reason:
            "The Publications Office exact-record adapter returned a non-XHTML representation.",
        },
      };
    }
    if (relatedSource && isPdf) {
      return {
        locator: safeLocator,
        excerpts: [],
        documentKind: "pdf",
        conversionStatus: "rejected",
        gap: {
          locator: safeLocator,
          reason:
            "The related source is a PDF; this bounded secondary-source lane accepts HTML or plain text only.",
        },
      };
    }
    if (
      !isPdf &&
      !["text/html", "application/xhtml+xml", "text/plain"].some((type) =>
        contentType.includes(type)
      ) && !isJson && !isXml
    ) {
      return {
        locator: safeLocator,
        excerpts: [],
        documentKind: "unknown",
        conversionStatus: "rejected",
        alternateEligible: true,
        gap: {
          locator: safeLocator,
          reason: `The ${documentLabel} returned an unsupported document content type.`,
        },
      };
    }
    const contentLength = Number(response.headers.get("content-length"));
    const maximumBytes = relatedSource
      ? SCREEN_03_DOCUMENT_MAX_BYTES
      : SCREEN_03_DOCUMENT_MAX_OFFICIAL_TRANSPORT_BYTES;
    if (
      Number.isFinite(contentLength) &&
      contentLength > maximumBytes
    ) {
      return {
        locator: safeLocator,
        excerpts: [],
        documentKind: isPdf ? "pdf" : "plain-text",
        conversionStatus: "rejected",
        alternateEligible: !relatedSource,
        gap: {
          locator: safeLocator,
          reason: `The ${documentLabel} exceeded the fixed response-size limit.`,
        },
      };
    }
    if (input.byteBudget.remaining <= 0 ||
      (Number.isFinite(contentLength) && contentLength > input.byteBudget.remaining)) {
      await response.body?.cancel("Screen 3 cumulative document byte limit reached");
      return {
        locator: safeLocator,
        excerpts: [],
        documentKind: isPdf ? "pdf" : "plain-text",
        conversionStatus: "rejected",
        alternateEligible: !relatedSource,
        gap: {
          locator: safeLocator,
          reason: `The ${documentLabel} exceeded the fixed cumulative document-byte limit.`,
        },
      };
    }
    const encodedResponse = encodings.some((encoding) => encoding !== "identity");
    const decompressionLimit = encodedResponse && Number.isFinite(contentLength) &&
        contentLength > 0
      ? Math.min(
          maximumBytes,
          Math.max(64_000, contentLength * 40),
        )
      : maximumBytes;
    const bodyResult = await readBoundedResponseText(
      response,
      decompressionLimit,
      input.byteBudget,
    );
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    if (bodyResult.exceeded) {
      return {
        locator: safeLocator,
        excerpts: [],
        documentKind: isPdf ? "pdf" : "plain-text",
        conversionStatus: "rejected",
        alternateEligible: !relatedSource,
        gap: {
          locator: safeLocator,
          reason: bodyResult.aggregateExceeded
            ? `The ${documentLabel} exceeded the fixed cumulative document-byte limit.`
            : decompressionLimit < maximumBytes
            ? `The ${documentLabel} exceeded the fixed decompression-expansion limit.`
            : `The ${documentLabel} exceeded the fixed response-size limit.`,
        },
      };
    }
    const body = bodyResult.text;
    const bytesRead = bodyResult.bytes.byteLength;
    const sourceContentFingerprint = await fingerprintDocumentBytes(
      bodyResult.bytes,
    );
    if (contentType.includes("html") && officialDocumentAccessChallenge(body)) {
      return {
        locator: safeLocator,
        resolvedLocator,
        redirectCount,
        secureRedirectUpgradeCount,
        excerpts: [],
        documentKind: "html",
        conversionStatus: "rejected",
        alternateEligible: true,
        bytesRead,
        retrievedAt: input.retrievedAt,
        gap: {
          locator: safeLocator,
          reason:
            `The ${documentLabel} returned an access-control challenge instead of document content.`,
        },
      };
    }
    // A requested exact CELEX coordinate is an evidence-integrity boundary on
    // the first representation as well as every fallback. A 200 response for
    // the wrong native EUR-Lex record must never supply passages.
    const requiredEuRecordId = alternateEuRecordId ?? publicationsRecordId ??
      (targetIsEurLex ? targetEuRecordId : null);
    const exactLocatorFormalIdentifiers = [
      requiredEuRecordId,
      ...[input.sourceLocator, safeLocator, resolvedLocator].flatMap(
        (locator) => locator
          ? [
              euOfficialDocumentRecordId(locator),
              screen03FederalRegisterLocatorDocumentNumber(locator),
            ]
          : [],
      ),
    ].filter((value): value is string => value !== null);
    const publicationsIdentity = requiredEuRecordId && publicationsRecordId
      ? readEuPublicationsDocumentIdentity(body, safeLocator)
      : undefined;
    const requiredEurLexIdentity = requiredEuRecordId &&
        !publicationsRecordId && contentType.includes("html")
      ? readEurLexDocumentIdentity(body, safeLocator)
      : undefined;
    const requiredResolvedIdentity = requiredEurLexIdentity &&
        resolvedLocator !== safeLocator
      ? readEurLexDocumentIdentity(body, resolvedLocator)
      : requiredEurLexIdentity;
    const strictEurLexRecordId =
      (requiredEurLexIdentity && requiredResolvedIdentity &&
          requiredEurLexIdentity.recordId === requiredResolvedIdentity.recordId
        ? requiredEurLexIdentity.recordId
        : null);
    const resolvedEuRecordId = euOfficialDocumentRecordId(resolvedLocator);
    const visibleEuRecordId = requiredEuRecordId && !publicationsRecordId &&
        resolvedEuRecordId === requiredEuRecordId
      ? selectedEuDocumentBodyRecordId(
          body,
          requiredEuRecordId,
          input.handoff,
        )
      : null;
    const boundEuRecordId = publicationsIdentity?.recordId ??
      strictEurLexRecordId ?? visibleEuRecordId;
    const euIdentityMismatch = requiredEuRecordId &&
      boundEuRecordId !== requiredEuRecordId;
    if (euIdentityMismatch && !isJson && !isPdf) {
      return {
        locator: safeLocator,
        resolvedLocator,
        redirectCount,
        secureRedirectUpgradeCount,
        excerpts: [],
        documentKind: contentType.includes("html") ? "html" : "unknown",
        conversionStatus: "rejected",
        alternateEligible: true,
        bytesRead,
        retrievedAt: input.retrievedAt,
        gap: {
          locator: safeLocator,
          reason:
            "The EU official representation could not be bound to the selected record's exact CELEX identity; no passage was admitted.",
        },
      };
    }
    if (isPdf) {
      const pageCount = detectedPdfPageCount(bodyResult.bytes);
      if (pageCount === 0) {
        return {
          locator: safeLocator,
          excerpts: [],
          documentKind: "pdf",
          conversionStatus: "rejected",
          alternateEligible: Boolean(requiredEuRecordId),
          bytesRead,
          sourceContentFingerprint,
          retrievedAt: input.retrievedAt,
          gap: {
            locator: safeLocator,
            reason:
              "The advisory raw-byte scan could not safely bound the PDF page structure (including compressed, encrypted, or missing page objects), so conversion was not attempted.",
          },
        };
      }
      if (pageCount > SCREEN_03_DOCUMENT_MAX_PDF_PAGES) {
        return {
          locator: safeLocator,
          excerpts: [],
          documentKind: "pdf",
          conversionStatus: "rejected",
          alternateEligible: Boolean(requiredEuRecordId),
          bytesRead,
          sourceContentFingerprint,
          retrievedAt: input.retrievedAt,
          gap: {
            locator: safeLocator,
            reason: `The advisory raw-byte scan found a page-count upper bound of ${pageCount}, exceeding the ${SCREEN_03_DOCUMENT_MAX_PDF_PAGES}-page conversion limit.`,
          },
        };
      }
      if (!input.convertDocument) {
        return {
          locator: safeLocator,
          excerpts: [],
          documentKind: "pdf",
          conversionStatus: "unavailable",
          alternateEligible: Boolean(requiredEuRecordId),
          bytesRead,
          sourceContentFingerprint,
          retrievedAt: input.retrievedAt,
          gap: {
            locator: safeLocator,
            reason:
              "The official record is PDF, but bounded PDF conversion was unavailable; deterministic connector metadata was retained.",
          },
        };
      }
      if (input.claimPdfConversionSlot && !input.claimPdfConversionSlot()) {
        return {
          locator: safeLocator,
          excerpts: [],
          documentKind: "pdf",
          conversionStatus: "unavailable",
          alternateEligible: Boolean(requiredEuRecordId),
          bytesRead,
          sourceContentFingerprint,
          retrievedAt: input.retrievedAt,
          gap: {
            locator: safeLocator,
            reason:
              `The round reached its ${SCREEN_03_DOCUMENT_MAX_PDF_CONVERSIONS}-PDF conversion limit; this additional PDF remains an unresolved source lead.`,
          },
        };
      }
      try {
        const converted = await convertBoundedPdf({
          converter: input.convertDocument,
          locator: resolvedLocator,
          bytes: bodyResult.bytes,
          detectedPageCount: pageCount,
          deadline: input.deadline,
        });
        const exceededTextLimit =
          converted.length > SCREEN_03_DOCUMENT_MAX_CONVERTED_TEXT;
        const boundedConverted = converted.slice(
          0,
          SCREEN_03_DOCUMENT_MAX_CONVERTED_TEXT,
        );
        if (
          requiredEuRecordId &&
          leadingVisibleEuDocumentRecordId(boundedConverted) !==
            requiredEuRecordId
        ) {
          return {
            locator: safeLocator,
            resolvedLocator,
            redirectCount,
            secureRedirectUpgradeCount,
            excerpts: [],
            documentKind: "pdf",
            conversionStatus: "rejected",
            alternateEligible: true,
            bytesRead,
            sourceContentFingerprint,
            retrievedAt: input.retrievedAt,
            gap: {
              locator: safeLocator,
              reason:
                "The converted EU official PDF could not be bound to the selected record's exact CELEX identity; no passage was admitted.",
            },
          };
        }
        const identityBounded = identityBoundedOfficialDocumentText(
          boundedConverted,
          resolvedLocator,
          input.handoff,
        );
        const text = normalizedText(
          identityBounded.text,
          SCREEN_03_DOCUMENT_MAX_CONVERTED_TEXT,
        );
        const selectedEventIdentityBound = identityBounded.grounded &&
          authoritativeDocumentMatchesSelectedEvent(
            text,
            input.handoff,
            exactLocatorFormalIdentifiers,
          );
        const excerpts = boundedDocumentExcerpts(
          text,
          input.handoff,
          input.targetClaim,
        ).filter((excerpt) =>
          !screen03EvidenceTextHasUnsafeInstruction(excerpt)
        );
        return {
          locator: safeLocator,
          resolvedLocator,
          redirectCount,
          excerpts,
          documentKind: "pdf",
          conversionStatus: "converted",
          bytesRead,
          sourceContentFingerprint,
          retrievedAt: input.retrievedAt,
          ...(selectedEventIdentityBound
            ? { selectedEventIdentityBound: true as const }
            : {}),
          gap: !identityBounded.grounded
            ? {
                locator: safeLocator,
                reason:
                  "The converted Federal Register text could not be grounded to the document number in its official locator; no passage was admitted.",
              }
            : exceededTextLimit
            ? {
                locator: safeLocator,
                reason: `The converted PDF text exceeded ${SCREEN_03_DOCUMENT_MAX_CONVERTED_TEXT} characters and was truncated before bounded passage extraction.`,
              }
            : excerpts.length > 0
              ? null
              : {
                  locator: safeLocator,
                  reason:
                    "The bounded converted PDF text contained no excerpt around the selected event identity or stage terms.",
                },
        };
      } catch (error) {
        return {
          locator: safeLocator,
          excerpts: [],
          documentKind: "pdf",
          conversionStatus: "failed",
          alternateEligible: Boolean(requiredEuRecordId),
          bytesRead,
          sourceContentFingerprint,
          retrievedAt: input.retrievedAt,
          gap: {
            locator: safeLocator,
            reason:
              input.deadline.signal.aborted
                ? "The Screen 3 total research deadline was reached during PDF conversion."
                : error instanceof Error && error.name === "AbortError"
                ? `The PDF conversion timed out after ${SCREEN_03_DOCUMENT_CONVERSION_TIMEOUT_MS} ms.`
                : `The PDF conversion failed: ${normalizedText(
                    error instanceof Error ? error.message : error,
                    300,
                  ) || "unknown error"}.`,
          },
        };
      }
    }
    const structuredJsonText = isJson ? visibleJsonDocumentText(body) : null;
    if (isJson && structuredJsonText === null) {
      return {
        locator: safeLocator,
        resolvedLocator,
        redirectCount,
        excerpts: [],
        documentKind: "unknown",
        conversionStatus: "rejected",
        alternateEligible: !relatedSource,
        bytesRead,
        sourceContentFingerprint,
        retrievedAt: input.retrievedAt,
        gap: {
          locator: safeLocator,
          reason: `The ${documentLabel} returned malformed JSON.`,
        },
      };
    }
    if (euIdentityMismatch && isJson) {
      return {
        locator: safeLocator,
        resolvedLocator,
        redirectCount,
        secureRedirectUpgradeCount,
        excerpts: [],
        documentKind: "json",
        conversionStatus: "rejected",
        alternateEligible: true,
        bytesRead,
        retrievedAt: input.retrievedAt,
        gap: {
          locator: safeLocator,
          reason:
            "The EU official representation could not be bound to the selected record's exact CELEX identity; no passage was admitted.",
        },
      };
    }
    const visibleText = (contentType.includes("html") || isXml
      ? visibleDocumentText(!relatedSource && contentType.includes("html")
          ? primaryOfficialDocumentHtml(body)
          : body)
      : isJson
        ? structuredJsonText!
        : normalizedText(body, SCREEN_03_DOCUMENT_MAX_TEXT))
      .slice(0, SCREEN_03_DOCUMENT_MAX_TEXT);
    const relatedGrounded = relatedSource
      ? relatedDocumentMatchesSelectedEvent(visibleText, input.handoff)
      : false;
    const identityBounded = relatedSource
      ? {
          text: relatedGrounded ? visibleText : "",
          grounded: relatedGrounded,
        }
      : identityBoundedOfficialDocumentText(
          visibleText,
          resolvedLocator,
          input.handoff,
        );
    const text = identityBounded.text;
    const selectedEventIdentityBound = identityBounded.grounded &&
      authoritativeDocumentMatchesSelectedEvent(
        text,
        input.handoff,
        exactLocatorFormalIdentifiers,
      );
    const extracted = boundedDocumentExcerpts(
      text,
      input.handoff,
      input.targetClaim,
    ).filter((excerpt) =>
      !screen03EvidenceTextHasUnsafeInstruction(excerpt)
    );
    const excerpts = relatedSource
      ? extracted.filter(
          (excerpt) =>
            relatedDocumentMatchesSelectedEvent(excerpt, input.handoff) &&
            !screen03EvidenceTextHasUnsafeInstruction(excerpt),
        )
      : extracted;
    // Preserve the returned ELI scalar only after the native record ID and
    // visible own title agree at both URL boundaries. The parser's derived
    // display citation is not an official response field.
    const nativeIdentity = !relatedSource && contentType.includes("html")
      ? readEurLexDocumentIdentity(body, safeLocator)
      : undefined;
    const resolvedIdentity = resolvedLocator === safeLocator
      ? nativeIdentity
      : nativeIdentity && readEurLexDocumentIdentity(body, resolvedLocator);
    const eurLexOfficialTitleField = nativeIdentity && resolvedIdentity &&
      nativeIdentity.recordId === resolvedIdentity.recordId &&
      nativeIdentity.metadataTitle.length <= 1_600 &&
      !screen03EvidenceTextHasUnsafeInstruction(nativeIdentity.metadataTitle)
      ? nativeIdentity.metadataTitle
      : undefined;
    // Publications Office converted XHTML can ground substantive passages,
    // but its visible heading is not promoted into an exact structured title
    // field unless the existing WT.z_docID + eli:title contract is present.
    const officialTitleField = eurLexOfficialTitleField;
    return {
      locator: safeLocator,
      resolvedLocator,
      redirectCount,
      secureRedirectUpgradeCount,
      excerpts,
      ...(officialTitleField ? { officialTitleField } : {}),
      documentKind: isJson
        ? "json"
        : isXml
        ? "xml"
        : contentType.includes("html")
        ? "html"
        : "plain-text",
      conversionStatus: "not-applicable",
      bytesRead,
      sourceContentFingerprint,
      retrievedAt: input.retrievedAt,
      ...(selectedEventIdentityBound
        ? { selectedEventIdentityBound: true as const }
        : {}),
      language: documentLanguage(
        response.headers.get("content-language"),
        body,
      ),
      gap: excerpts.length > 0
        ? null
        : !identityBounded.grounded
          ? {
              locator: safeLocator,
              reason: relatedSource
                ? "The related source page did not contain the selected event title, alias, or formal identifier; no passage was admitted."
                : "The Federal Register text could not be grounded to the document number in its official locator; no passage was admitted.",
            }
        : {
            locator: safeLocator,
            reason: `The bounded ${documentLabel} text contained no excerpt around the selected event identity or stage terms.`,
          },
    };
  } catch (error) {
    const totalDeadlineReached = input.deadline.signal.aborted;
    return {
      locator: safeLocator,
      excerpts: [],
      documentKind: "unknown",
      conversionStatus: "failed",
      alternateEligible: true,
      gap: {
        locator: safeLocator,
        reason:
          totalDeadlineReached
            ? `The Screen 3 total research deadline was reached during the ${documentLabel} fetch.`
            : error instanceof Error && error.name === "AbortError"
            ? `The ${documentLabel} fetch timed out after ${SCREEN_03_DOCUMENT_FETCH_TIMEOUT_MS} ms.`
            : `The ${documentLabel} fetch failed: ${normalizedText(
                error instanceof Error ? error.message : error,
                300,
              ) || "unknown error"}.`,
      },
    };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    input.deadline.signal.removeEventListener("abort", abortFromDeadline);
  }
}

function inferredRoutes(handoff: Screen02WorkflowHandoff) {
  const routes: Screen02ConnectorId[] = [];
  for (const source of handoff.sources) {
    const host = safeHost(source.locator);
    const channel = normalizedToken(source.channel);
    for (const connectorId of OFFICIAL_CONNECTOR_IDS) {
      const catalog = getScreen02SourceCatalogEntry(connectorId);
      if (
        (host !== null && catalog.recordLocatorHosts.includes(host)) ||
        channel.includes(
          normalizedToken(catalog.name)
            .split(" ")
            .slice(0, 2)
            .join(" "),
        )
      ) {
        routes.push(connectorId);
      }
    }
  }
  return [...new Set(routes)];
}

function isFederalRegulatoryIdentity(handoff: Screen02WorkflowHandoff) {
  const jurisdiction = normalizedToken(
    handoff.event.identity.issuingJurisdiction ?? "",
  );
  const issuer = normalizedToken(handoff.event.identity.issuer ?? "");
  return (
    jurisdiction === "united states" ||
    jurisdiction === "united states of america" ||
    jurisdiction.includes("federal") ||
    issuer.includes("federal") ||
    handoff.sources.some((source) => {
      const host = safeHost(source.locator);
      return [
        "federalregister.gov",
        "www.federalregister.gov",
        "govinfo.gov",
        "www.govinfo.gov",
      ].includes(host ?? "");
    })
  );
}

function plannedRoutes(handoff: Screen02WorkflowHandoff) {
  const identityGeography =
    handoff.event.identity.issuingJurisdiction ??
    handoff.screen01Baseline.scopeContract.geography;
  const eventFamily =
    handoff.event.identity.eventType ||
    handoff.screen01Baseline.scopeContract.eventFamily;
  const plan = planScreen02SourceRoutes({
    geography: identityGeography,
    eventFamily,
  });
  const inferred = inferredRoutes(handoff);
  const routes = [...inferred];
  for (const candidate of plan.routes.map((route) => route.connectorId)) {
    if (
      candidate === "federal-register-api-v1" &&
      !isFederalRegulatoryIdentity(handoff) &&
      !inferred.includes(candidate)
    ) {
      continue;
    }
    routes.push(candidate);
  }
  const gaps = plan.coverageGaps.map((gap) => gap.message);
  if (
    plan.canonicalEventFamily === "regulation" &&
    plan.jurisdiction.usState !== null &&
    !isFederalRegulatoryIdentity(handoff) &&
    !inferred.some((route) =>
      [
        "federal-register-api-v1",
        "eu-cellar-sparql-v1",
        "uk-legislation-atom-v1",
      ].includes(route),
    )
  ) {
    gaps.push(
      `No native official legal connector is configured for ${identityGeography}; the federal route was not used as a proxy for state law. The carried evidence remains available for review.`,
    );
  }
  return {
    // The configured catalog contains at most the six routes allowed by the
    // research-call budget. Preserve every eligible inferred/planned family;
    // connectorTasks allocates one first-pass call per route before follow-ups.
    routes: [...new Set(routes)],
    gaps,
    jurisdiction: plan.jurisdiction,
  };
}

function connectorSourceRole(
  connectorId: Screen02ConnectorId,
): Screen03EvidenceSourceRole {
  if (connectorId === "federal-register-api-v1") {
    return "official-publication-record";
  }
  if (connectorId === "openfema-disaster-declarations-v2") {
    return "administrative-declaration-record";
  }
  if (connectorId === "usgs-earthquake-catalog-v1") {
    return "scientific-hazard-record";
  }
  if (connectorId === "gdacs-event-search-v1") {
    return "institutional-hazard-record";
  }
  if (
    connectorId === "eu-cellar-sparql-v1" ||
    connectorId === "uk-legislation-atom-v1"
  ) {
    return "controlling-legal-record";
  }
  return "official-record";
}

function textQueries(
  handoff: Screen02WorkflowHandoff,
  targetClaim?: ResearchScreen03EvidenceInput["targetClaim"],
) {
  const identity = handoff.event.identity;
  const targetAnchor = targetClaim
    ? normalizedText([targetClaim.value, targetClaim.label].join(" "), 120)
    : "";
  const identityAnchor = normalizedText(
    [
      identity.formalIdentifier,
      identity.commonNames[0],
      identity.canonicalTitle,
    ].filter(Boolean).join(" "),
    targetClaim ? 90 : 150,
  );
  return SCREEN_03_RESEARCH_STAGE_PLAN.map((stage) => {
    const extraTerms = stage.id === "effective-application"
      ? ["threshold", "exemption", "coverage"]
      : stage.id === "implementation-compliance"
        ? ["threshold", "exemption"]
        : [];
    return {
      stageId: stage.id,
      stageLabel: stage.label,
      query: normalizedText(
        [targetAnchor, identityAnchor, ...stage.queryTerms, ...extraTerms]
          .filter(Boolean).join(" "),
        240,
      ),
    };
  }).filter((query) => Boolean(query.query));
}

/**
 * legislation.gov.uk applies title terms conjunctively and requires crawlers
 * to observe a host-wide delay. Screen 3 therefore sends one concise title
 * lookup for the selected event, rather than parallel stage-expanded title
 * variants. One Atom response already carries the bounded catalog result set.
 */
function ukLegislationTitleQuery(handoff: Screen02WorkflowHandoff) {
  const identity = handoff.event.identity;
  return [
    identity.canonicalTitle,
    ...identity.commonNames,
    identity.formalIdentifier,
    identity.eventType,
  ]
    .map((value) => normalizedText(value, 240))
    .find(Boolean) ?? "legislation";
}

function gdacsEventTypes(eventType: string): GdacsEventType[] | undefined {
  const value = normalizedToken(eventType);
  if (/earthquake|seismic/.test(value)) return ["EQ"];
  if (/cyclone|hurricane|typhoon/.test(value)) return ["TC"];
  if (/flood/.test(value)) return ["FL"];
  if (/volcan/.test(value)) return ["VO"];
  if (/wildfire|forest fire/.test(value)) return ["WF"];
  if (/drought/.test(value)) return ["DR"];
  if (/tsunami/.test(value)) return ["TS"];
  return undefined;
}

function connectorTasks(
  input: ResearchScreen03EvidenceInput,
  routes: readonly Screen02ConnectorId[],
  deadline: Screen03ResearchDeadline,
) {
  const { handoff, retrievedAt } = input;
  const fetch = fetchWithinScreen03Deadline(input.fetch, deadline);
  const common = {
    fetch,
    retrievedAt,
    population: handoff.screen01Baseline.scopeContract.population,
    outcomeFamily: handoff.screen01Baseline.scopeContract.outcomeFamily,
    limit: SCREEN_03_RESEARCH_MAX_RESULTS_PER_CALL,
    timeoutMs: Math.max(
      1,
      Math.min(SCREEN_03_RESEARCH_TIMEOUT_MS, deadline.remainingMs()),
    ),
  };
  const documentDates = yearRange(handoff);
  const hazardDates = hazardDateRange(handoff);
  const queries = textQueries(handoff, input.targetClaim);
  const targetMarker = input.targetClaim
    ? ` target-proposal:${input.targetClaim.proposalId}`
    : "";
  const jurisdictionPlan = plannedRoutes(handoff).jurisdiction;
  const tasks: ConnectorTask[] = [];
  const addTextTasks = (
    connectorId: Screen02ConnectorId,
    build: (query: string) => Promise<Screen02OfficialConnectorResult>,
  ) => {
    for (const queryPlan of queries) {
      tasks.push({
        connectorId,
        stageId: queryPlan.stageId,
        sourceRole: connectorSourceRole(connectorId),
        term: queryPlan.query,
        purpose:
          `Seek ${queryPlan.stageLabel} support from the ${connectorSourceRole(connectorId).replace(/-/g, " ")} family for the selected event identity.${targetMarker}`,
        execute: () => build(queryPlan.query),
      });
    }
  };

  for (const connectorId of routes) {
    if (connectorId === "federal-register-api-v1") {
      addTextTasks(connectorId, (query) =>
        fetchFederalRegisterProposals({
          ...common,
          ...documentDates,
          query,
          queryPurpose:
            "Deepen the selected Screen 2 event using identity- and stage-specific official records.",
        }),
      );
    } else if (connectorId === "eu-cellar-sparql-v1") {
      const celexId = selectedEuCelexLookupKey(
        handoff.event.identity.formalIdentifier ?? "",
      );
      if (celexId) {
        tasks.push({
          exactIdentity: true,
          connectorId,
          stageId: "announcement-discussion",
          sourceRole: connectorSourceRole(connectorId),
          term: celexId,
          purpose: `Retrieve the selected instrument by its exact CELEX identifier before broader stage discovery.${targetMarker}`,
          execute: () => fetchEuCellarLegalProposals({
            ...common,
            ...documentDates,
            query: celexId,
            celexId,
            language: "en",
          }),
        });
      }
      addTextTasks(connectorId, (query) =>
        fetchEuCellarLegalProposals({
          ...common,
          ...documentDates,
          query,
          language: "en",
        }),
      );
    } else if (connectorId === "uk-legislation-atom-v1") {
      const query = ukLegislationTitleQuery(handoff);
      tasks.push({
        connectorId,
        stageId: "announcement-discussion",
        sourceRole: connectorSourceRole(connectorId),
        term: query,
        purpose:
          `Retrieve one bounded official UK legislation title result set for the selected event; stage-specific claims remain for document review.${targetMarker}`,
        execute: () => fetchUkLegislationProposals({
          ...common,
          ...documentDates,
          query,
        }),
      });
    } else if (connectorId === "openfema-disaster-declarations-v2") {
      tasks.push({
        connectorId,
        stageId: "announcement-discussion",
        sourceRole: connectorSourceRole(connectorId),
        term: null,
        purpose:
          `Check official federal declaration dates and designated-area metadata for the selected disaster.${targetMarker}`,
        execute: () =>
          fetchOpenFemaDisasterProposals({
            ...common,
            ...documentDates,
            ...(jurisdictionPlan.usState
              ? { state: jurisdictionPlan.usState.code }
              : {}),
            ...(!/^(disaster|hazard|event)$/i.test(
              handoff.event.identity.eventType.trim(),
            )
              ? { incidentType: handoff.event.identity.eventType }
              : {}),
          }),
      });
    } else if (connectorId === "gdacs-event-search-v1") {
      tasks.push({
        connectorId,
        stageId: "announcement-discussion",
        sourceRole: connectorSourceRole(connectorId),
        term: null,
        purpose:
          `Check bounded global hazard metadata for the selected event window and hazard family.${targetMarker}`,
        execute: () =>
          fetchGdacsDisasterProposals({
            ...common,
            ...hazardDates,
            ...(gdacsEventTypes(handoff.event.identity.eventType)
              ? { eventTypes: gdacsEventTypes(handoff.event.identity.eventType) }
              : {}),
          }),
      });
    } else if (connectorId === "usgs-earthquake-catalog-v1") {
      tasks.push({
        connectorId,
        stageId: "announcement-discussion",
        sourceRole: connectorSourceRole(connectorId),
        term: null,
        purpose:
          `Check bounded scientific earthquake metadata around the selected occurrence date.${targetMarker}`,
        execute: () =>
          fetchUsgsEarthquakeProposals({
            ...common,
            ...hazardDates,
            geographyLabel:
              handoff.event.identity.issuingJurisdiction ??
              handoff.screen01Baseline.scopeContract.geography,
          }),
      });
    }
  }
  const tasksByRoute = routes.map((connectorId) =>
    tasks.filter((task) => task.connectorId === connectorId),
  );
  const bounded: ConnectorTask[] = [];
  const used = new Set<ConnectorTask>();
  const addTask = (task: ConnectorTask | undefined) => {
    if (!task || used.has(task) || bounded.length >= SCREEN_03_RESEARCH_MAX_CALLS) {
      return false;
    }
    used.add(task);
    bounded.push(task);
    return true;
  };

  // First allocate one call to every eligible route. Stagger the desired
  // stage across route families so the first pass is not six copies of the
  // same broad query when several legal catalogs are eligible.
  tasksByRoute.forEach((routeTasks, routeIndex) => {
    const desiredStage =
      SCREEN_03_RESEARCH_STAGE_PLAN[routeIndex % SCREEN_03_RESEARCH_STAGE_PLAN.length]!
        .id;
    addTask(
      routeTasks.find((task) => task.exactIdentity) ??
        routeTasks.find((task) => task.stageId === desiredStage) ?? routeTasks[0],
    );
  });

  // Spend remaining calls on uncovered research stages before duplicating a
  // stage. Each query remains tied to one official source family and role.
  for (const stage of SCREEN_03_RESEARCH_STAGE_PLAN) {
    if (bounded.length >= SCREEN_03_RESEARCH_MAX_CALLS) break;
    if (bounded.some((task) => task.stageId === stage.id)) continue;
    for (const routeTasks of tasksByRoute) {
      if (addTask(routeTasks.find((task) => task.stageId === stage.id))) break;
    }
  }

  // If structured routes cannot express every legal stage, fill any spare
  // budget round-robin without starving a route family.
  for (let depth = 0; bounded.length < SCREEN_03_RESEARCH_MAX_CALLS; depth += 1) {
    let found = false;
    for (const routeTasks of tasksByRoute) {
      const candidate = routeTasks.find((task, index) =>
        index >= depth && !used.has(task)
      );
      if (!candidate) continue;
      found = addTask(candidate) || found;
      if (bounded.length >= SCREEN_03_RESEARCH_MAX_CALLS) break;
    }
    if (!found) break;
  }
  return bounded;
}

async function runConnectorTasks(
  tasks: readonly ConnectorTask[],
  deadline: Screen03ResearchDeadline,
) {
  return Promise.all(
    tasks.map(async (task, index): Promise<ConnectorResult> => {
      try {
        return {
          callId: `screen03-query-${index + 1}`,
          connectorId: task.connectorId,
          stageId: task.stageId,
          sourceRole: task.sourceRole,
          requestedTerm: task.term,
          purpose: task.purpose,
          result: await raceScreen03Deadline(task.execute(), deadline),
          failure: null,
        };
      } catch (error) {
        return {
          callId: `screen03-query-${index + 1}`,
          connectorId: task.connectorId,
          stageId: task.stageId,
          sourceRole: task.sourceRole,
          requestedTerm: task.term,
          purpose: task.purpose,
          result: null,
          failure: normalizedText(
            error instanceof Error ? `${error.name}: ${error.message}` : error,
            500,
          ) || "The authorized connector failed before returning diagnostics.",
        };
      }
    }),
  );
}

function isFindProposal(value: Screen02Proposal): value is Screen02FindProposal {
  return value.mode === "find";
}

type SameEventIdentityMatch =
  | "formal-identifier-exact"
  | "controlled-title-or-alias-exact"
  | "strong-title-issuer-jurisdiction";

type ProposalIdentityRelationship =
  | {
      scope: "selected";
      identityMatch: SameEventIdentityMatch;
      relatedStage: null;
    }
  | {
      scope: "related";
      identityMatch: Exclude<
        SameEventIdentityMatch,
        "formal-identifier-exact"
      >;
      relatedStage: Screen02DateLeadStage | null;
    };

function relatedRecordStage(proposal: Screen02FindProposal) {
  const text = normalizedToken([
    proposal.title,
    proposal.description,
    proposal.nativeIdentity?.status,
    ...proposal.provisionalDates,
  ].filter(Boolean).join(" "));
  if (/\b(?:amend\w*|revis\w*|renew\w*|delay\w*|extend\w*|extension\w*|deadline\w*|postpon\w*|reopen\w*|repeal\w*|supersed\w*)\b/u.test(text)) {
    return "amendment" as const;
  }
  if (/\b(?:enforc\w*|penalt\w*|sanction\w*|inspection\w*)\b/u.test(text)) {
    return "enforcement" as const;
  }
  if (/\b(?:implement\w*|compliance\w*|phase[ -]?in|rollout\w*)\b/u.test(text)) {
    return "implementation" as const;
  }
  if (/\b(?:effective\w*|application\w*|operative\w*|commenc\w*)\b/u.test(text)) {
    return "effective" as const;
  }
  return null;
}

/**
 * A connector hit must establish that it is the selected event before any
 * authority/date relevance score can affect rank. Related instruments often
 * share dates and most title tokens, so those soft signals are deliberately
 * insufficient on their own.
 */
/** @internal Exported for deterministic policy regression coverage. */
export function screen03ProposalIdentityRelationship(
  proposal: Screen02FindProposal,
  handoff: Screen02WorkflowHandoff,
): ProposalIdentityRelationship | null {
  const identity = handoff.event.identity;
  const expectedFormalValue = identity.formalIdentifier ?? "";
  const observedFormalValue = proposal.nativeIdentity?.formalIdentifier ?? "";
  const expectedFormal = normalizedFormalIdentifier(
    expectedFormalValue,
  );
  const observedFormal = normalizedFormalIdentifier(
    observedFormalValue,
  );
  const formalIdentifierRelation = expectedFormal && observedFormal
    ? screen03FormalIdentifierRelation(
        expectedFormalValue,
        observedFormalValue,
      )
    : null;
  const formalIdentifiersEquivalent = formalIdentifierRelation ===
    "equivalent";
  const expectedIssuer = normalizedToken(identity.issuer ?? "");
  const observedIssuer = normalizedToken(proposal.nativeIdentity?.issuer ?? "");
  const expectedJurisdiction = normalizedToken(
    identity.issuingJurisdiction ?? "",
  );
  const observedJurisdictions = [
    proposal.nativeIdentity?.issuingJurisdiction ?? "",
    ...proposal.event.geographies,
  ].map(normalizedToken).filter(Boolean);
  const issuerConflict = expectedIssuer.length > 0 &&
    observedIssuer.length > 0 && observedIssuer !== expectedIssuer;
  const jurisdictionConflict = expectedJurisdiction.length > 0 &&
    observedJurisdictions.length > 0 &&
    !observedJurisdictions.includes(expectedJurisdiction);
  const sameControllingSource = proposal.sources.some((proposalSource) =>
    handoff.sources.some((selectedSource) =>
      handoff.event.sourceIds.includes(selectedSource.id) &&
      (proposalSource.id === selectedSource.id ||
        canonicalLocatorKey(proposalSource.locator) ===
          canonicalLocatorKey(selectedSource.locator))
    )
  );
  const exactIssuerAndJurisdiction = expectedIssuer.length > 0 &&
    observedIssuer === expectedIssuer &&
    expectedJurisdiction.length > 0 &&
    observedJurisdictions.includes(expectedJurisdiction);
  const globallyScopedFormalIdentifier =
    globallyScopedFormalIdentifierNamespace(
      proposal.nativeIdentity?.formalIdentifier ?? "",
      proposal.sources.map((source) => source.locator),
    ) !== null;

  // Same-coordinate partials and explicit coordinate conflicts are neither
  // the selected record nor a safely characterized related lifecycle record.
  // Drop them before title similarity can relabel the collision as related.
  if (
    formalIdentifierRelation === "conflict" ||
    formalIdentifierRelation === "compatible-partial"
  ) return null;

  // A formal identifier is normally the strongest event key, but identifiers
  // are not globally unique across issuing systems. An explicit issuer or
  // jurisdiction contradiction therefore fails closed instead of binding a
  // similarly numbered record from another authority.
  if (
    formalIdentifiersEquivalent &&
    !issuerConflict && !jurisdictionConflict &&
    (globallyScopedFormalIdentifier ||
      exactIssuerAndJurisdiction ||
      sameControllingSource)
  ) {
    return {
      scope: "selected",
      identityMatch: "formal-identifier-exact",
      relatedStage: null,
    };
  }

  const controlledNames = [
    identity.canonicalTitle,
    ...identity.commonNames,
  ]
    .map(normalizedToken)
    .filter(Boolean);
  const observedTitles = [proposal.title, proposal.event.displayName]
    .map(normalizedToken)
    .filter(Boolean);
  const controlledTitleExact = observedTitles.some((title) =>
    controlledNames.includes(title)
  );

  const expectedTitleTerms = lexicalTerms(identity.canonicalTitle);
  const observedTitleTerms = lexicalTerms(
    `${proposal.title} ${proposal.event.displayName}`,
  );
  const genericTitleTerms = new Set([
    "act",
    "document",
    "final",
    "official",
    "regulation",
    "rule",
  ]);
  const distinctiveExpected = [...expectedTitleTerms].filter(
    (term) => !genericTitleTerms.has(term),
  );
  const distinctiveObserved = [...observedTitleTerms].filter(
    (term) => !genericTitleTerms.has(term),
  );
  const strongTitle = distinctiveExpected.length >= 2 &&
    distinctiveExpected.every((term) => distinctiveObserved.includes(term)) &&
    distinctiveObserved.every((term) => distinctiveExpected.includes(term));
  const strongTitleIssuerJurisdiction =
    strongTitle &&
    exactIssuerAndJurisdiction;
  // Titles and aliases are not event identifiers: generic names such as
  // “Consumer Protection Act” legitimately recur across jurisdictions. Bind
  // an exact controlled title only when the returned record also matches both
  // issuer and jurisdiction, or when it is the exact carried controlling
  // source. This keeps missing-identifier records usable without allowing a
  // title collision to become selected-event evidence.
  const controlledTitleWithIdentityContext = controlledTitleExact &&
    (exactIssuerAndJurisdiction ||
      (sameControllingSource && !issuerConflict && !jurisdictionConflict));
  const titleMatch = controlledTitleWithIdentityContext
    ? "controlled-title-or-alias-exact" as const
    : strongTitleIssuerJurisdiction
      ? "strong-title-issuer-jurisdiction" as const
      : null;
  if (!titleMatch) return null;

  if (expectedFormal && observedFormal && !formalIdentifiersEquivalent) {
    return {
      scope: "related",
      identityMatch: titleMatch,
      relatedStage: relatedRecordStage(proposal),
    };
  }
  return {
    scope: "selected",
    identityMatch: titleMatch,
    relatedStage: null,
  };
}

function sameEventIdentityMatch(
  proposal: Screen02FindProposal,
  handoff: Screen02WorkflowHandoff,
) {
  const relationship = screen03ProposalIdentityRelationship(proposal, handoff);
  return relationship?.scope === "selected"
    ? relationship.identityMatch
    : null;
}

function identityScore(
  proposal: Screen02FindProposal,
  handoff: Screen02WorkflowHandoff,
  identityMatch: SameEventIdentityMatch,
) {
  const identity = handoff.event.identity;
  const haystack = normalizedToken(
    [
      proposal.id,
      proposal.title,
      proposal.description,
      proposal.event.displayName,
      proposal.nativeIdentity?.formalIdentifier,
      proposal.nativeIdentity?.issuer,
      ...proposal.provisionalDates,
    ]
      .filter(Boolean)
      .join(" "),
  );
  let score = 0;
  const formal = normalizedToken(identity.formalIdentifier ?? "");
  const canonical = normalizedToken(identity.canonicalTitle);
  if (formal && haystack.includes(formal)) score += 220;
  if (canonical && haystack.includes(canonical)) score += 150;
  for (const alias of identity.commonNames) {
    const normalizedAlias = normalizedToken(alias);
    if (normalizedAlias && haystack.includes(normalizedAlias)) score += 90;
  }
  const expectedTerms = lexicalTerms(identity.canonicalTitle);
  const observedTerms = lexicalTerms(haystack);
  const overlap = [...expectedTerms].filter((term) => observedTerms.has(term));
  score += expectedTerms.size === 0
    ? 0
    : Math.round((overlap.length / expectedTerms.size) * 80);
  const issuer = normalizedToken(identity.issuer ?? "");
  if (issuer && haystack.includes(issuer)) score += 35;
  if (
    handoff.event.dateLeads.some((lead) =>
      proposal.provisionalDates.some((value) => value.includes(lead.date)),
    )
  ) {
    score += 35;
  }
  const strongestTier = Math.min(
    ...proposal.sources.map((source) => source.authorityTier),
    6,
  );
  score += (7 - strongestTier) * 4;
  // Identity-match kind is already a mandatory gate. It is only a stable
  // tie-breaker here so carried controlling evidence keeps its intended
  // document-fetch priority.
  score += identityMatch === "formal-identifier-exact"
    ? 3
    : identityMatch === "controlled-title-or-alias-exact"
      ? 2
      : 1;
  return score;
}

function normalizedLanguageTag(value: string | null | undefined) {
  const candidate = value?.split(",")[0]?.split(";")[0]?.trim() ?? "";
  if (!/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,2}$/.test(candidate)) {
    return null;
  }
  return candidate.toLocaleLowerCase("en-US");
}

function documentLanguage(
  contentLanguage: string | null,
  body: string,
) {
  const header = normalizedLanguageTag(contentLanguage);
  if (header) return header;
  const declared = /<(?:html\b[^>]*?\blang|[A-Za-z_][\w:.-]*\b[^>]*?\bxml:lang)\s*=\s*["']([^"']{2,35})["']/iu
    .exec(body.slice(0, 8_192))?.[1];
  return normalizedLanguageTag(declared) ?? "und";
}

function languageFor(
  locator: string,
  channel: string,
  observedLanguage?: string,
) {
  const observed = normalizedLanguageTag(observedLanguage);
  if (observed) return observed;
  const text = `${locator} ${channel}`;
  const explicit = /(?:\/|=)(BUL|HRV|CES|DAN|NLD|ENG|EST|FIN|FRA|DEU|ELL|HUN|GLE|ITA|LAV|LIT|MLT|POL|POR|RON|SLK|SLV|SPA|SWE)(?:\/|&|$)/i.exec(
    text,
  )?.[1];
  const byCode: Record<string, string> = {
    BUL: "bg", HRV: "hr", CES: "cs", DAN: "da", NLD: "nl", ENG: "en",
    EST: "et", FIN: "fi", FRA: "fr", DEU: "de", ELL: "el", HUN: "hu",
    GLE: "ga", ITA: "it", LAV: "lv", LIT: "lt", MLT: "mt", POL: "pl",
    POR: "pt", RON: "ro", SLK: "sk", SLV: "sl", SPA: "es", SWE: "sv",
  };
  if (explicit) return byCode[explicit.toUpperCase()] ?? "und";
  return /federal register|fema|legislation|gdacs|usgs/i.test(text)
    ? "en"
    : "und";
}

function sourcePlatformFor(
  locator: string,
  role: Screen03EvidenceSourceRole,
): Screen03SourcePlatform {
  const host = safeHost(locator) ?? "";
  if (role === "researcher-supplied-record") return "researcher-supplied";
  if (role === "related-secondary-record") return "secondary-publisher";
  if (/^(?:www\.)?federalregister\.gov$/u.test(host)) return "federal-register";
  if (/^(?:www\.)?govinfo\.gov$/u.test(host)) return "govinfo";
  if (/^(?:www\.)?congress\.gov$/u.test(host)) return "congress";
  if (/\.legislature\.[a-z]{2}\.gov$/u.test(host) || host === "leginfo.legislature.ca.gov") {
    return "us-state-official";
  }
  if (/\.europa\.eu$/u.test(host) || host === "eur-lex.europa.eu") return "eur-lex";
  if (host === "publications.europa.eu") return "eu-publications";
  if (host === "www.legislation.gov.uk" || host === "legislation.gov.uk") {
    return "uk-legislation";
  }
  if (/fema\.gov$|gdacs\.org$|earthquake\.usgs\.gov$/u.test(host)) {
    return "official-disaster-repository";
  }
  if ([
    "laws-lois.justice.gc.ca",
    "www.legifrance.gouv.fr",
    "legifrance.gouv.fr",
    "www.gesetze-im-internet.de",
    "gesetze-im-internet.de",
    "www.irishstatutebook.ie",
    "irishstatutebook.ie",
    "www.boe.es",
    "boe.es",
    "diariodarepublica.pt",
    "www.dre.pt",
    "dre.pt",
    "elaw.klri.re.kr",
    "elaws.e-gov.go.jp",
    "www.japaneselawtranslation.go.jp",
    "japaneselawtranslation.go.jp",
    "www.indiacode.nic.in",
    "indiacode.nic.in",
  ].includes(host)) return "national-legislation";
  if (reviewedOfficialHost(host)) return "regulatory-agency";
  return role === "official-record" ? "other-official" : "unknown";
}

function documentTypeForLocator(
  locator: string,
  channel: string,
): Screen03DocumentType {
  let pathname = "";
  try {
    pathname = new URL(locator).pathname.toLocaleLowerCase("en-US");
  } catch {
    return "unknown";
  }
  if (/\.pdf$/u.test(pathname)) return "pdf";
  if (/\.(?:xml|atom)$/u.test(pathname)) return "xml";
  if (/\.(?:json|jsonld)$/u.test(pathname)) return "json";
  if (/\.(?:html?|xhtml)$/u.test(pathname)) return "html";
  if (/\.(?:txt|text)$/u.test(pathname)) return "plain-text";
  return /api|atom|sparql|structured|connector/iu.test(channel)
    ? "structured-metadata"
    : "unknown";
}

function contentFingerprint(
  evidence: Omit<EvidenceItem, "contentFingerprint">,
) {
  return fingerprintScreen02WorkflowValue({
    sourceId: evidence.sourceId,
    title: evidence.title,
    locator: evidence.locator,
    publisher: evidence.publisher,
    publishedDate: evidence.publishedDate,
    authorityTier: evidence.authorityTier,
    channel: evidence.channel,
    sourceRole: evidence.sourceRole,
    sourcePlatform: evidence.sourcePlatform,
    documentType: evidence.documentType,
    language: evidence.language,
    passages: evidence.passages,
  });
}

function channelWithSourceRole(
  channel: string,
  role: Screen03EvidenceSourceRole,
) {
  const clean = normalizedText(channel, 190);
  return normalizedToken(clean).includes("source role")
    ? clean
    : `${clean} · source role: ${role.replace(/-/g, " ")}`;
}

function makeEvidence(input: {
  sourceId: string | null;
  title: string;
  locator: string;
  publisher: string;
  publishedDate: string | null;
  retrievedAt: string;
  authorityTier: 1 | 2 | 3 | 4 | 5 | 6;
  channel: string;
  status: EvidenceItem["status"];
  passageSeeds: PassageSeed[];
  sourceRole?: Screen03EvidenceSourceRole;
  sourcePlatform?: Screen03SourcePlatform;
  documentType?: Screen03DocumentType;
  language?: string;
  sourceContentFingerprint?: string;
}) {
  const id = stableId(
    "screen03-evidence",
    input.sourceId ?? input.locator,
  );
  const passagePriority: Record<Screen03PassageBasis, number> = {
    "official-document-passage": 0,
    "official-guidance-passage": 1,
    "source-excerpt": 2,
    "official-record-field": 3,
    "contextual-secondary": 4,
    "source-metadata": 5,
  };
  const passages: EvidencePassage[] = input.passageSeeds
    .map((seed, inputIndex) => ({
      text: normalizedText(seed.text, 1_600),
      basis: seed.basis,
      officialField: seed.officialField ?? null,
      locator: seed.locator,
      inputIndex,
    }))
    .filter((seed) => Boolean(seed.text))
    .filter(
      (seed, index, values) =>
        values.findIndex(
          (candidate) =>
            candidate.basis === seed.basis &&
            candidate.officialField === seed.officialField &&
            candidate.locator === seed.locator &&
            normalizedToken(candidate.text) === normalizedToken(seed.text),
        ) === index,
    )
    .sort(
      (left, right) =>
        passagePriority[left.basis] - passagePriority[right.basis] ||
        left.inputIndex - right.inputIndex,
    )
    .slice(0, SCREEN_03_DOCUMENT_MAX_PASSAGES_PER_EVIDENCE)
    .map((seed, index) => ({
      id: `${id}-p${index + 1}`,
      number: index + 1,
      text: seed.text,
      locator: seed.locator === undefined ? input.locator || null : seed.locator,
      basis: seed.basis,
      officialField: seed.officialField,
    }));
  const sourceRole = input.sourceRole ?? screen03EvidenceSourceRole({
    channel: input.channel,
    locator: input.locator,
    publisher: input.publisher,
    title: input.title,
  });
  const withoutFingerprint: Omit<EvidenceItem, "contentFingerprint"> = {
    id,
    sourceId: input.sourceId,
    title: normalizedText(input.title, 300),
    locator: input.locator,
    publisher: normalizedText(input.publisher, 240),
    publishedDate: input.publishedDate,
    retrievedAt: input.retrievedAt,
    authorityTier: input.authorityTier,
    channel: channelWithSourceRole(input.channel, sourceRole),
    sourceRole,
    sourcePlatform:
      input.sourcePlatform ?? sourcePlatformFor(input.locator, sourceRole),
    documentType:
      input.documentType ?? documentTypeForLocator(input.locator, input.channel),
    language: languageFor(input.locator, input.channel, input.language),
    status: input.status,
    passages,
  };
  return {
    ...withoutFingerprint,
    contentFingerprint:
      input.sourceContentFingerprint ?? contentFingerprint(withoutFingerprint),
  } satisfies EvidenceItem;
}

function carriedEvidenceCandidates(
  handoff: Screen02WorkflowHandoff,
  fallbackRetrievedAt: string,
) {
  return handoff.sources.map((source): EvidenceCandidate => {
    const metadata = [
      `Source metadata: ${source.title}.`,
      `Publisher: ${source.publisher}.`,
      source.publishedDate ? `Published: ${source.publishedDate}.` : "",
      `Official or researcher-supplied locator: ${source.locator}.`,
    ]
      .filter(Boolean)
      .join(" ");
    return {
      evidence: makeEvidence({
        sourceId: source.id,
        title: source.title,
        locator: source.locator,
        publisher: source.publisher,
        publishedDate: source.publishedDate,
        retrievedAt: canonicalizeScreen03EvidenceRetrievedAt(
          source.retrievedAt,
          fallbackRetrievedAt,
        ),
        authorityTier: source.authorityTier,
        channel: source.channel,
        sourceRole: source.userProvided
          ? "researcher-supplied-record"
          : screen03EvidenceSourceRole(source),
        status: "carried",
        passageSeeds: [
          ...(source.evidenceText
            ? [{
                text: source.evidenceText,
                // Production connector sources may synthesize evidenceText
                // from a generated proposal description. Only researcher-
                // supplied/fetched text has provenance strong enough to be an
                // excerpt before this service performs its own page fetch.
                basis: source.userProvided
                  ? "source-excerpt" as const
                  : "source-metadata" as const,
              }]
            : []),
          { text: metadata, basis: "source-metadata" },
        ],
      }),
      score: 320 + (7 - source.authorityTier) * 10 +
        (handoff.event.sourceIds.includes(source.id) ? 60 : 0),
      carried: true,
      retrieved: false,
    };
  });
}

function relatedContextEvidenceCandidates(
  leads: readonly Screen02ContextLead[],
  retrievedAt: string,
) {
  return leads.map((lead): EvidenceCandidate => ({
    evidence: makeEvidence({
      sourceId: `context-source-${lead.id}`,
      title: lead.title,
      locator: lead.locator,
      publisher: lead.publisher,
      publishedDate: lead.publishedDate,
      retrievedAt,
      authorityTier: 6,
      channel: "Related online source · bounded contextual discovery",
      sourceRole: "related-secondary-record",
      status: "retrieved",
      passageSeeds: [{
        text:
          `Context index metadata: ${lead.title}. Publisher: ${lead.publisher}.`,
        basis: "source-metadata",
      }],
    }),
    // Related sources are intentionally below carried and official records;
    // one usable direct-passage lane is reserved later without letting this
    // score displace controlling evidence.
    score: 40,
    carried: false,
    retrieved: true,
  }));
}

/**
 * California Legislative Information exposes bill text and bill history as
 * separate views keyed by the same opaque bill_id. When a selected event
 * already carries an allowlisted bill-text source, derive only that official
 * same-host history view. This adds a bounded lifecycle lead for any
 * California bill without guessing a date or treating the first action in a
 * reused bill shell as the announcement of the selected substantive reform.
 */
function officialLifecycleCompanionCandidates(
  handoff: Screen02WorkflowHandoff,
  retrievedAt: string,
) {
  const candidates: EvidenceCandidate[] = [];
  for (const source of handoff.sources) {
    try {
      const input = new URL(source.locator);
      if (
        input.protocol !== "https:" ||
        input.hostname.toLowerCase() !== "leginfo.legislature.ca.gov" ||
        input.pathname !== "/faces/billTextClient.xhtml"
      ) {
        continue;
      }
      const billId = input.searchParams.get("bill_id")?.trim() ?? "";
      if (!/^\d{8,12}[A-Za-z]{1,4}\d{1,8}$/.test(billId)) continue;
      const locator = new URL(
        "/faces/billHistoryClient.xhtml",
        "https://leginfo.legislature.ca.gov",
      );
      locator.searchParams.set("bill_id", billId);
      candidates.push({
        evidence: makeEvidence({
          sourceId: null,
          title: `Official bill history for ${source.title}`,
          locator: locator.toString(),
          publisher: "California Legislative Information",
          publishedDate: null,
          retrievedAt,
          authorityTier: source.authorityTier,
          channel: "official-legislative-history-companion",
          sourceRole: "controlling-legal-record",
          status: "retrieved",
          passageSeeds: [{
            text:
              "Official same-record bill-history view derived from the carried California bill identifier. Its actions are lifecycle leads only and require event-version review.",
            basis: "source-metadata",
          }],
        }),
        // Below a carried tier-1 controlling text, but ahead of unreviewed
        // catalog metadata when a second document slot is available.
        score: 435,
        carried: false,
        retrieved: true,
      });
    } catch {
      // Invalid or unsupported carried locators create no derived request.
    }
  }
  return candidates;
}

function guardedOfficialDocumentProfile(locator: string) {
  const safeLocator = allowlistedOfficialDocumentLocator(locator);
  if (!safeLocator) return null;
  const host = safeHost(safeLocator);
  if (!host) return null;
  const platform = sourcePlatformFor(safeLocator, "official-record");
  if ([
    "eur-lex",
    "eu-publications",
    "uk-legislation",
    "national-legislation",
    "us-state-official",
    "congress",
    "govinfo",
  ].includes(platform)) {
    return {
      authorityTier: 1 as const,
      sourceRole: "controlling-legal-record" as const,
      sourcePlatform: platform,
      host,
    };
  }
  if (platform === "federal-register") {
    return {
      authorityTier: 2 as const,
      sourceRole: "official-publication-record" as const,
      sourcePlatform: platform,
      host,
    };
  }
  if (/^(?:www\.)?fema\.gov$|\.fema\.gov$/u.test(host)) {
    return {
      authorityTier: 2 as const,
      sourceRole: "administrative-declaration-record" as const,
      sourcePlatform: "official-disaster-repository" as const,
      host,
    };
  }
  if (
    /(?:^|\.)(?:nhc\.noaa|earthquake\.usgs)\.gov$/u.test(host)
  ) {
    return {
      authorityTier: 2 as const,
      sourceRole: "scientific-hazard-record" as const,
      sourcePlatform: "official-disaster-repository" as const,
      host,
    };
  }
  return {
    authorityTier: 2 as const,
    sourceRole: "official-record" as const,
    sourcePlatform: platform,
    host,
  };
}

function enrichEvidenceCandidatesWithDocumentText(
  candidates: readonly EvidenceCandidate[],
  documents: readonly DocumentTextResult[],
) {
  const byLocator = new Map<string, DocumentTextResult>();
  const documentScore = (document: DocumentTextResult) =>
    document.excerpts.length > 0 ? 3
    : document.officialTitleField ? 2
    : document.sourceContentFingerprint ? 1
    : 0;
  for (const document of documents) {
    const key = canonicalLocatorKey(document.sourceLocator ?? document.locator);
    const current = byLocator.get(key);
    if (!current || documentScore(document) > documentScore(current)) {
      byLocator.set(key, document);
    }
  }
  return candidates.map((candidate): EvidenceCandidate => {
    const document = byLocator.get(canonicalLocatorKey(candidate.evidence.locator));
    if (!document) {
      return candidate;
    }
    const fetchedLocator = document.resolvedLocator ?? document.locator;
    const bytesMatchCandidateLocator =
      canonicalLocatorKey(document.locator) ===
        canonicalLocatorKey(candidate.evidence.locator) &&
      canonicalLocatorKey(fetchedLocator) ===
        canonicalLocatorKey(candidate.evidence.locator);
    const carriedRole = screen03EvidenceSourceRole(candidate.evidence);
    const guardedProfile = carriedRole === "researcher-supplied-record" &&
        document.excerpts.length > 0 &&
        document.selectedEventIdentityBound === true &&
        document.sourceContentFingerprint?.startsWith("sha256:")
      ? guardedOfficialDocumentProfile(fetchedLocator)
      : null;
    if (guardedProfile) {
      const title = document.officialTitleField ??
        `Official document retrieved from ${guardedProfile.host}`;
      return {
        evidence: makeEvidence({
          sourceId: candidate.evidence.sourceId,
          title,
          locator: fetchedLocator,
          publisher: guardedProfile.host,
          publishedDate: null,
          retrievedAt: document.retrievedAt ?? candidate.evidence.retrievedAt,
          authorityTier: guardedProfile.authorityTier,
          channel:
            "Guarded official-document retrieval of a researcher-supplied locator",
          sourceRole: guardedProfile.sourceRole,
          sourcePlatform: guardedProfile.sourcePlatform,
          documentType: document.documentKind === "unknown"
            ? candidate.evidence.documentType
            : document.documentKind,
          language: document.language ?? candidate.evidence.language,
          status: "retrieved",
          passageSeeds: [
            ...document.excerpts.map((text) => ({
              text,
              basis: "official-document-passage" as const,
              locator: fetchedLocator,
            })),
            ...(document.officialTitleField
              ? [{
                  text: document.officialTitleField,
                  basis: "official-record-field" as const,
                  officialField: "canonical-title" as const,
                  locator: fetchedLocator,
                }]
              : []),
            {
              text:
                "A researcher supplied this locator. ShockAudit independently fetched it through the guarded official-document lane and admitted only passages bound to the selected event identity.",
              basis: "source-metadata" as const,
              locator: candidate.evidence.locator,
            },
          ],
          sourceContentFingerprint: document.sourceContentFingerprint,
        }),
        score: candidate.score + 220,
        carried: false,
        retrieved: true,
      };
    }
    if (
      document.excerpts.length === 0 &&
      !document.officialTitleField &&
      (!document.sourceContentFingerprint || !bytesMatchCandidateLocator)
    ) return candidate;
    const alternateRepresentation = !bytesMatchCandidateLocator;
    const evidenceLocator = alternateRepresentation
      ? fetchedLocator
      : candidate.evidence.locator;
    const role = carriedRole;
    const officialGuidance =
      /\b(?:overview|guidance|frequently asked questions?|faqs?)\b/iu.test(
        `${candidate.evidence.channel} ${candidate.evidence.title}`,
      );
    const fetchedBasis: Screen03PassageBasis =
      role === "related-secondary-record"
        ? "contextual-secondary"
        : role === "researcher-supplied-record"
          ? "source-excerpt"
          : officialGuidance
            ? "official-guidance-passage"
            : "official-document-passage";
    const passageSeeds: PassageSeed[] = [
      ...document.excerpts.map((text) => ({
        text,
        basis: fetchedBasis,
        locator: fetchedLocator,
      })),
      ...(document.officialTitleField &&
        screen03EvidenceItemProvidesAuthoritativeDirectSupport(candidate.evidence)
        ? [{
            text: document.officialTitleField,
            basis: "official-record-field" as const,
            officialField: "canonical-title" as const,
            locator: fetchedLocator,
          }]
        : []),
      ...candidate.evidence.passages.map((passage) => ({
        text: passage.text,
        basis: passage.basis,
        officialField: passage.officialField ?? null,
        locator: passage.locator,
      })),
      ...(alternateRepresentation
        ? [{
            text:
              `Exact official representation ${fetchedLocator} retrieved for selected source ${candidate.evidence.locator}.`,
            basis: "source-metadata" as const,
            locator: candidate.evidence.locator,
          }]
        : []),
    ];
    return {
      ...candidate,
      // A successfully fetched controlling passage must be eligible to fill an
      // active slot even when earlier, higher-ranked catalog locators failed.
      score: candidate.score + (document.excerpts.length > 0 ? 120 : 0),
      evidence: makeEvidence({
        sourceId: candidate.evidence.sourceId,
        title: candidate.evidence.title,
        locator: evidenceLocator,
        publisher: candidate.evidence.publisher,
        publishedDate: candidate.evidence.publishedDate,
        retrievedAt: document.retrievedAt ?? candidate.evidence.retrievedAt,
        authorityTier: candidate.evidence.authorityTier,
        channel: alternateRepresentation
          ? `${candidate.evidence.channel} · exact alternate representation`
          : candidate.evidence.channel,
        sourceRole: role,
        ...(!alternateRepresentation && candidate.evidence.sourcePlatform
          ? { sourcePlatform: candidate.evidence.sourcePlatform }
          : {}),
        documentType: document.documentKind === "unknown"
          ? candidate.evidence.documentType
          : document.documentKind,
        language: document.language ?? candidate.evidence.language,
        status: candidate.evidence.status,
        passageSeeds,
        ...(document.sourceContentFingerprint
          ? { sourceContentFingerprint: document.sourceContentFingerprint }
          : {}),
      }),
    };
  });
}

function enrichEvidenceCandidatesWithReviewedIdentityFallback(
  candidates: readonly EvidenceCandidate[],
  documents: readonly DocumentTextResult[],
  handoff: Screen02WorkflowHandoff,
) {
  const usableDocumentLocators = new Set(
    documents
      .filter((document) =>
        document.excerpts.length > 0 || Boolean(document.officialTitleField)
      )
      .flatMap((document) => [
        canonicalLocatorKey(document.sourceLocator ?? document.locator),
        canonicalLocatorKey(document.locator),
      ]),
  );
  const sourcesById = new Map(
    handoff.sources.map((source) => [source.id, source]),
  );
  return candidates.map((candidate): EvidenceCandidate => {
    const source = candidate.evidence.sourceId
      ? sourcesById.get(candidate.evidence.sourceId)
      : undefined;
    if (
      !source ||
      canonicalLocatorKey(source.locator) !==
        canonicalLocatorKey(candidate.evidence.locator) ||
      usableDocumentLocators.has(canonicalLocatorKey(source.locator))
    ) {
      return candidate;
    }
    const fields = reviewedScreen02AuditOfficialIdentityFields(source);
    if (fields.length === 0) return candidate;
    const evidence = candidate.evidence;
    return {
      ...candidate,
      evidence: makeEvidence({
        sourceId: evidence.sourceId,
        title: evidence.title,
        locator: evidence.locator,
        publisher: evidence.publisher,
        publishedDate: evidence.publishedDate,
        retrievedAt: evidence.retrievedAt,
        authorityTier: evidence.authorityTier,
        channel: evidence.channel,
        sourceRole: evidence.sourceRole,
        sourcePlatform: evidence.sourcePlatform,
        documentType: evidence.documentType,
        language: evidence.language,
        status: evidence.status,
        passageSeeds: [
          ...fields.map(({ field, value }) => ({
            text: value,
            basis: "official-record-field" as const,
            officialField: field,
          })),
          ...evidence.passages.map((passage) => ({
            text: passage.text,
            basis: passage.basis,
            officialField: passage.officialField ?? null,
            locator: passage.locator,
          })),
        ],
      }),
    };
  });
}

/**
 * These adapters expose `proposal.title` as one exact structured record field.
 * Disaster adapters may compose a display title from several fields (or use a
 * fallback), so their title remains metadata until fetched document text
 * supplies an extractive passage.
 */
const CONNECTORS_WITH_EXACT_NATIVE_TITLE = new Set<Screen02ConnectorId>([
  "federal-register-api-v1",
  "ftc-press-releases-html-v1",
  "eu-cellar-sparql-v1",
  "uk-legislation-atom-v1",
]);

/**
 * `nativeIdentity` is a presentation shape, not proof that every property was
 * copied from one authoritative response field. Some adapters add prefixes,
 * join arrays, map codes, or supply fixed jurisdiction/status labels. Only
 * the fields below preserve a single official response value (apart from
 * bounded whitespace/control-text sanitation), so only they may use
 * `official-record-field` provenance.
 *
 * Any connector change must expand this policy explicitly and add a raw-field
 * regression. Constructed values remain visible in the source-metadata
 * passage, where they cannot directly confirm an identity proposal.
 */
const CONNECTOR_EXACT_NATIVE_IDENTITY_FIELDS: Readonly<
  Record<Screen02ConnectorId, ReadonlySet<Screen03OfficialField>>
> = {
  "federal-register-api-v1": new Set(["formal-identifier"]),
  "ftc-press-releases-html-v1": new Set(),
  "eu-cellar-sparql-v1": new Set(["formal-identifier"]),
  "uk-legislation-atom-v1": new Set(),
  "openfema-disaster-declarations-v2": new Set(),
  "gdacs-event-search-v1": new Set(),
  "usgs-earthquake-catalog-v1": new Set(["formal-identifier"]),
};

function connectorNativeIdentityFields(
  connectorId: Screen02ConnectorId,
  proposal: Screen02FindProposal,
) {
  const allowed = CONNECTOR_EXACT_NATIVE_IDENTITY_FIELDS[connectorId];
  const fields: Array<{ field: Screen03OfficialField; value: string }> = [];
  for (const [field, value] of [
    ["formal-identifier", proposal.nativeIdentity?.formalIdentifier],
    ["issuer", proposal.nativeIdentity?.issuer],
    ["issuing-jurisdiction", proposal.nativeIdentity?.issuingJurisdiction],
    ["status", proposal.nativeIdentity?.status],
  ] as const) {
    if (allowed.has(field) && value?.trim()) fields.push({ field, value });
  }
  return fields;
}

function retrievedEvidenceCandidates(
  runs: readonly ConnectorResult[],
  handoff: Screen02WorkflowHandoff,
) {
  const candidates: EvidenceCandidate[] = [];
  for (const run of runs) {
    for (const proposal of (run.result?.proposals ?? []).filter(isFindProposal)) {
      const relationship = screen03ProposalIdentityRelationship(proposal, handoff);
      if (!relationship) continue;
      const score = identityScore(
        proposal,
        handoff,
        relationship.identityMatch,
      ) - (relationship.scope === "related" ? 80 : 0);
      const source = [...proposal.sources].sort(
        (left, right) => left.authorityTier - right.authorityTier,
      )[0];
      if (!source) continue;
      const datePassage = proposal.provisionalDates.length > 0
        ? `Official metadata dates: ${proposal.provisionalDates.join("; ")}.`
        : `Official metadata event date: ${proposal.event.eventDate}.`;
      const identityPassage = [
        `Official connector identity metadata: ${proposal.title}.`,
        proposal.nativeIdentity?.formalIdentifier
          ? `Formal identifier: ${proposal.nativeIdentity.formalIdentifier}.`
          : "",
        proposal.nativeIdentity?.issuer
          ? `Issuer: ${proposal.nativeIdentity.issuer}.`
          : "",
        proposal.nativeIdentity?.issuingJurisdiction
          ? `Reported jurisdiction: ${proposal.nativeIdentity.issuingJurisdiction}.`
          : "",
        proposal.nativeIdentity?.status
          ? `Reported status: ${proposal.nativeIdentity.status}.`
          : "",
        `Fixed-core event classification: ${proposal.event.eventFamily}.`,
      ]
        .filter(Boolean)
        .join(" ");
      const officialFields: PassageSeed[] = [];
      // These values are preserved verbatim by the existing connectors from
      // an individual structured official record field. Do not put composed
      // descriptions, synthesized publisher strings, or constructed locators
      // in this collection.
      for (const datedField of proposal.provisionalDates) {
        officialFields.push({
          text: datedField,
          basis: "official-record-field",
          officialField: null,
        });
      }
      if (CONNECTORS_WITH_EXACT_NATIVE_TITLE.has(run.connectorId)) {
        officialFields.push({
          text: proposal.title,
          basis: "official-record-field",
          officialField: "canonical-title",
        });
      }
      for (const identityField of connectorNativeIdentityFields(
        run.connectorId,
        proposal,
      )) {
        officialFields.push({
          text: identityField.value,
          basis: "official-record-field",
          officialField: identityField.field,
        });
      }
      candidates.push({
        evidence: makeEvidence({
          sourceId: source.id,
          title: source.title,
          locator: source.locator,
          publisher: source.publisher,
          publishedDate: source.publishedDate,
          retrievedAt: source.retrievedAt ?? handoff.builtAt,
          authorityTier: source.authorityTier,
          channel: source.channel,
          sourceRole: relationship.scope === "related"
            ? "related-official-record"
            : run.sourceRole,
          status: "retrieved",
          passageSeeds: [
            ...officialFields,
            { text: identityPassage, basis: "source-metadata" },
            { text: proposal.description, basis: "source-metadata" },
            { text: datePassage, basis: "source-metadata" },
          ],
        }),
        score,
        carried: false,
        retrieved: true,
      });
    }
  }
  return candidates;
}

function mergeEvidenceCandidates(candidates: readonly EvidenceCandidate[]) {
  const byLocator = new Map<string, EvidenceCandidate>();
  for (const candidate of candidates) {
    const locatorKey = canonicalLocatorKey(candidate.evidence.locator);
    const existing = byLocator.get(locatorKey);
    if (!existing) {
      byLocator.set(locatorKey, candidate);
      continue;
    }
    const passageSeeds = [
      ...existing.evidence.passages.map((passage) => ({
        text: passage.text,
        basis: passage.basis,
        officialField: passage.officialField ?? null,
      })),
      ...candidate.evidence.passages.map((passage) => ({
        text: passage.text,
        basis: passage.basis,
        officialField: passage.officialField ?? null,
      })),
    ];
    const preferred = existing.evidence.authorityTier <= candidate.evidence.authorityTier
      ? existing.evidence
      : candidate.evidence;
    const fetchedContentFingerprint = [
      existing.evidence.contentFingerprint,
      candidate.evidence.contentFingerprint,
    ].find((fingerprint) => fingerprint.startsWith("sha256:"));
    const merged = makeEvidence({
      sourceId: existing.evidence.sourceId ?? candidate.evidence.sourceId,
      title: preferred.title,
      locator: preferred.locator,
      publisher: preferred.publisher,
      publishedDate: preferred.publishedDate,
      // A carried source retains the timestamp of the reviewed snapshot.
      // Fresh retrieval time belongs to a newly retrieved record; merging a
      // connector/catalog echo must not silently rewrite carried provenance.
      retrievedAt: existing.carried
        ? existing.evidence.retrievedAt
        : candidate.carried
          ? candidate.evidence.retrievedAt
          : existing.evidence.retrievedAt > candidate.evidence.retrievedAt
            ? existing.evidence.retrievedAt
            : candidate.evidence.retrievedAt,
      authorityTier: Math.min(
        existing.evidence.authorityTier,
        candidate.evidence.authorityTier,
      ) as EvidenceItem["authorityTier"],
      channel: preferred.channel,
      sourceRole: preferred.sourceRole,
      sourcePlatform: preferred.sourcePlatform,
      documentType: preferred.documentType,
      language: preferred.language,
      // A fresh research round may enrich a carried source but cannot declare
      // its content changed merely because catalog titles differ. The fixed
      // source-change workflow owns that decision after fingerprint review.
      status: existing.carried || candidate.carried
        ? "carried"
        : "retrieved",
      passageSeeds,
      ...(fetchedContentFingerprint
        ? { sourceContentFingerprint: fetchedContentFingerprint }
        : {}),
    });
    byLocator.set(locatorKey, {
      evidence: merged,
      score: Math.max(existing.score, candidate.score),
      carried: existing.carried || candidate.carried,
      retrieved: existing.retrieved || candidate.retrieved,
    });
  }
  return [...byLocator.values()];
}

function selectActiveEvidence(candidates: readonly EvidenceCandidate[]) {
  const ranked = [...candidates].sort(
    (left, right) =>
      right.score - left.score ||
      left.evidence.authorityTier - right.evidence.authorityTier ||
      left.evidence.id.localeCompare(right.evidence.id),
  );
  const chosen: EvidenceCandidate[] = [];
  const add = (candidate: EvidenceCandidate) => {
    if (!chosen.some((item) =>
      canonicalLocatorKey(item.evidence.locator) ===
        canonicalLocatorKey(candidate.evidence.locator)
    )) {
      chosen.push(candidate);
    }
  };
  ranked.filter((candidate) => candidate.carried).slice(0, 3).forEach(add);
  ranked
    .filter(
      (candidate) =>
        candidate.retrieved &&
        screen03EvidenceSourceRole(candidate.evidence) !==
          "related-secondary-record",
    )
    .slice(0, 1)
    .forEach(add);
  const related = ranked.find(
    (candidate) =>
      candidate.retrieved &&
      screen03EvidenceSourceRole(candidate.evidence) ===
        "related-secondary-record" &&
      candidate.evidence.passages.some(
        (passage) => passage.basis === "contextual-secondary",
      ),
  );
  if (related) add(related);
  ranked.forEach((candidate) => {
    if (chosen.length < SCREEN_03_RESEARCH_MAX_ACTIVE_EVIDENCE) add(candidate);
  });
  return chosen
    .slice(0, SCREEN_03_RESEARCH_MAX_ACTIVE_EVIDENCE)
    .map((candidate) => candidate.evidence);
}

function rankedDocumentLocators(
  candidates: readonly EvidenceCandidate[],
  targetClaim?: ResearchScreen03EvidenceInput["targetClaim"],
) {
  const representationRank = (locator: string) => {
    try {
      const path = new URL(locator).pathname.toLocaleLowerCase("en-US");
      if (/\.(?:html?|xhtml|xml|atom|json|jsonld|txt|text)$/u.test(path)) return 0;
      return path.endsWith(".pdf") ? 2 : 1;
    } catch {
      return 3;
    }
  };
  const targetRank = (candidate: EvidenceCandidate) =>
    targetClaim && (
      targetClaim.sourceIds.includes(candidate.evidence.id) ||
      (candidate.evidence.sourceId !== null &&
        targetClaim.sourceIds.includes(candidate.evidence.sourceId)) ||
      candidate.evidence.passages.some((passage) =>
        targetClaim.passageIds.includes(passage.id)
      )
    ) ? 0 : 1;
  const ranked = [...candidates]
    .sort(
      (left, right) =>
        targetRank(left) - targetRank(right) ||
        representationRank(left.evidence.locator) -
          representationRank(right.evidence.locator) ||
        left.evidence.authorityTier - right.evidence.authorityTier ||
        right.score - left.score ||
        left.evidence.id.localeCompare(right.evidence.id),
    )
    .filter(
      (candidate) =>
        allowlistedOfficialDocumentLocator(candidate.evidence.locator) !== null,
    )
    .filter(
      (candidate, index, values) =>
        values.findIndex(
          (other) =>
            canonicalLocatorKey(other.evidence.locator) ===
              canonicalLocatorKey(candidate.evidence.locator),
        ) === index,
    );
  const readerFriendlyOfficialSource = (candidate: EvidenceCandidate) =>
    /\b(?:overview|guidance|frequently asked questions?|faqs?)\b/iu.test(
      `${candidate.evidence.channel} ${candidate.evidence.title}`,
    );
  // Keep the confirmation lane anchored in a carried controlling record, but
  // also reserve an early attempt for an official overview or guidance page
  // when the selected event supplies one. The latter is reader context only;
  // it does not change the direct-passage gates used to confirm Screen 3
  // claims. This prevents dense bill text from consuming every bounded fetch
  // before a concise official explanation can be read.
  const pinned = [
    ranked.find(
      (candidate) =>
        candidate.carried &&
        screen03EvidenceSourceRole(candidate.evidence) ===
          "controlling-legal-record",
    ),
    ranked.find(
      (candidate) => candidate.carried && readerFriendlyOfficialSource(candidate),
    ),
  ].filter((candidate): candidate is EvidenceCandidate => Boolean(candidate));
  const byRole = new Map<Screen03EvidenceSourceRole, EvidenceCandidate[]>();
  for (const candidate of ranked) {
    const role = screen03EvidenceSourceRole(candidate.evidence);
    const roleCandidates = byRole.get(role) ?? [];
    roleCandidates.push(candidate);
    byRole.set(role, roleCandidates);
  }
  const diversified: string[] = [];
  for (let depth = 0; diversified.length < ranked.length; depth += 1) {
    let found = false;
    for (const roleCandidates of byRole.values()) {
      const candidate = roleCandidates[depth];
      if (!candidate) continue;
      found = true;
      diversified.push(candidate.evidence.locator);
    }
    if (!found) break;
  }
  return [...pinned.map((candidate) => candidate.evidence.locator), ...diversified]
    .filter(
      (locator, index, values) =>
        values.findIndex(
          (other) => canonicalLocatorKey(other) === canonicalLocatorKey(locator),
        ) === index,
    );
}

function priorityCarriedDocumentCandidates(
  candidates: readonly EvidenceCandidate[],
  handoff: Screen02WorkflowHandoff,
  targetClaim?: ResearchScreen03EvidenceInput["targetClaim"],
) {
  const carried = candidates.filter((candidate) =>
    candidate.carried &&
    candidate.evidence.sourceId !== null &&
    handoff.event.sourceIds.includes(candidate.evidence.sourceId)
  );
  const selectedPackHasIdentityAnchor = carried.some((candidate) =>
    relatedDocumentMatchesSelectedEvent([
      candidate.evidence.title,
      candidate.evidence.locator,
      ...candidate.evidence.passages.map((passage) => passage.text),
    ].join(" "), handoff)
  );
  if (!selectedPackHasIdentityAnchor) return [];
  const locator = rankedDocumentLocators(carried, targetClaim)[0];
  if (!locator) return [];
  return carried.filter(
    (candidate) =>
      canonicalLocatorKey(candidate.evidence.locator) ===
        canonicalLocatorKey(locator),
  ).slice(0, 1);
}

function documentSourceKey(locator: string) {
  const representations = euOfficialDocumentRepresentationLocators(locator);
  const exactEuRecordId = representations.length > 1
    ? euOfficialDocumentRecordId(locator)
    : null;
  return exactEuRecordId
    ? `eu-celex:${exactEuRecordId}`
    : canonicalLocatorKey(locator);
}

function documentFetchTarget(sourceLocator: string): DocumentFetchTarget {
  const representations = euOfficialDocumentRepresentationLocators(sourceLocator);
  return {
    locator: representations[0]!,
    sourceLocator,
    remainingRepresentations: representations.slice(1),
  };
}

async function fetchDocumentSlots(input: {
  serviceInput: ResearchScreen03EvidenceInput;
  candidates: readonly EvidenceCandidate[];
  orderedLocators?: readonly string[];
  deadline: Screen03ResearchDeadline;
  maximumAttempts?: number;
  maximumUsable?: number;
  byteBudget: DocumentByteBudget;
  claimPdfConversionSlot?: () => boolean;
}) {
  const locators = input.orderedLocators ?? rankedDocumentLocators(
    input.candidates,
    input.serviceInput.targetClaim,
  );
  const maximumAttempts = input.maximumAttempts ?? SCREEN_03_DOCUMENT_MAX_ATTEMPTS;
  const maximumUsable = input.maximumUsable ?? SCREEN_03_DOCUMENT_MAX_FETCHES;
  const results: DocumentTextResult[] = [];
  const pending = locators.map(documentFetchTarget);
  const usableSources = new Set<string>();
  let pdfConversionSlots = 0;
  const localClaimPdfConversionSlot = () => {
    if (pdfConversionSlots >= SCREEN_03_DOCUMENT_MAX_PDF_CONVERSIONS) {
      return false;
    }
    pdfConversionSlots += 1;
    return true;
  };
  const claimPdfConversionSlot = input.claimPdfConversionSlot ??
    localClaimPdfConversionSlot;
  while (
    pending.length > 0 &&
    results.length < maximumAttempts &&
    usableSources.size < maximumUsable &&
    !input.deadline.signal.aborted &&
    input.deadline.remainingMs() > 0
  ) {
    const remainingAttempts =
      maximumAttempts - results.length;
    const neededSlots = maximumUsable - usableSources.size;
    const waveSize = Math.min(
      remainingAttempts,
      neededSlots,
      pending.length,
    );
    const wave = pending.splice(0, waveSize);
    const waveResults = await Promise.all(
      wave.map(async (target): Promise<DocumentTextResult> => {
        try {
          const result = await raceScreen03Deadline(
            fetchDocumentText({
              fetch: fetchWithinScreen03Deadline(
                input.serviceInput.fetch,
                input.deadline,
              ),
              locator: target.locator,
              sourceLocator: target.sourceLocator,
              handoff: input.serviceInput.handoff,
              retrievedAt: input.serviceInput.retrievedAt,
              deadline: input.deadline,
              byteBudget: input.byteBudget,
              targetClaim: input.serviceInput.targetClaim,
              ...(input.serviceInput.convertDocument
                ? {
                    convertDocument: input.serviceInput.convertDocument,
                    claimPdfConversionSlot,
                  }
                : {}),
            }),
            input.deadline,
          );
          return { ...result, sourceLocator: target.sourceLocator };
        } catch {
          return {
            locator: target.locator,
            sourceLocator: target.sourceLocator,
            excerpts: [],
            documentKind: "unknown",
            conversionStatus: "failed",
            alternateEligible: true,
            gap: {
              locator: target.locator,
              reason:
                "The Screen 3 total research deadline was reached before this official document could be reviewed.",
            },
          };
        }
      }),
    );
    results.push(...waveResults);
    for (const result of waveResults) {
      if (result.excerpts.length > 0) {
        usableSources.add(documentSourceKey(result.sourceLocator!));
      }
    }
    const fallbackTargets: DocumentFetchTarget[] = [];
    for (let index = 0; index < wave.length; index += 1) {
      const target = wave[index]!;
      const result = waveResults[index]!;
      const nextRepresentation = target.remainingRepresentations[0];
      if (
        result.alternateEligible === true &&
        result.excerpts.length === 0 &&
        !usableSources.has(documentSourceKey(target.sourceLocator)) &&
        nextRepresentation
      ) {
        fallbackTargets.push({
          locator: nextRepresentation,
          sourceLocator: target.sourceLocator,
          remainingRepresentations: target.remainingRepresentations.slice(1),
        });
      }
    }
    pending.unshift(...fallbackTargets);
    if (input.deadline.signal.aborted) break;
  }
  return results;
}

async function fetchRelatedContextDocument(input: {
  serviceInput: ResearchScreen03EvidenceInput;
  leads: readonly Screen02ContextLead[];
  deadline: Screen03ResearchDeadline;
  byteBudget: DocumentByteBudget;
}) {
  const lead = input.leads.find(
    (candidate) => allowlistedRelatedDocumentLocator(candidate) !== null,
  );
  if (
    !lead ||
    input.deadline.signal.aborted ||
    input.deadline.remainingMs() <= 0
  ) {
    return {
      candidates: [] as EvidenceCandidate[],
      documentResults: [] as DocumentTextResult[],
    };
  }
  let result: DocumentTextResult;
  try {
    result = await raceScreen03Deadline(
      fetchDocumentText({
        fetch: fetchWithinScreen03Deadline(
          input.serviceInput.fetch,
          input.deadline,
        ),
        locator: lead.locator,
        relatedLead: lead,
        handoff: input.serviceInput.handoff,
        retrievedAt: input.serviceInput.retrievedAt,
        deadline: input.deadline,
        byteBudget: input.byteBudget,
        targetClaim: input.serviceInput.targetClaim,
      }),
      input.deadline,
    );
  } catch {
    result = {
      locator: lead.locator,
      excerpts: [],
      documentKind: "unknown",
      conversionStatus: "failed",
      gap: {
        locator: lead.locator,
        reason:
          "The Screen 3 total research deadline was reached before this related source page could be reviewed.",
      },
    };
  }
  const candidates = result.excerpts.length > 0
    ? enrichEvidenceCandidatesWithDocumentText(
        relatedContextEvidenceCandidates([lead], input.serviceInput.retrievedAt),
        [result],
      )
    : [];
  return { candidates, documentResults: [result] };
}

function evidenceReferences(
  evidence: readonly EvidenceItem[],
  upstreamSourceIds: readonly string[],
  value: string,
  group: Screen03ProposalGroup,
  label: string,
) {
  const selected = evidence.filter(
    (item) => item.sourceId !== null && upstreamSourceIds.includes(item.sourceId),
  );
  const normalizedValue = normalizedToken(value);
  const selectedExactPassages = selected.flatMap((item) =>
    item.passages.filter(
      (passage) =>
        directSupportAvailable(item, passage, { group, label }) &&
        normalizedValue.length > 0 &&
        containsTokenSequence(
          normalizedToken(passage.text),
          normalizedValue,
        ),
    ),
  );
  const exactPassages = selectedExactPassages.length > 0
    ? selectedExactPassages
    : evidence.flatMap((item) =>
        item.passages.filter(
          (passage) =>
            directSupportAvailable(item, passage, { group, label }) &&
            normalizedValue.length > 0 &&
            containsTokenSequence(
              normalizedToken(passage.text),
              normalizedValue,
            ),
        ),
      );
  const exactOwners = evidence.filter((item) =>
    item.passages.some((passage) =>
      exactPassages.some((exact) => exact.id === passage.id),
    ),
  );
  const allPassages = selected.flatMap((item) => item.passages).slice(0, 6);
  return {
    sourceIds: exactPassages.length > 0
      ? exactOwners.map((item) => item.id)
      : selected.map((item) => item.id),
    passageIds: (exactPassages.length > 0 ? exactPassages : allPassages).map(
      (passage) => passage.id,
    ),
    support: exactPassages.length > 0
      ? "direct" as const
      : allPassages.length > 0
        ? "indirect" as const
        : "unsupported" as const,
  };
}

function directSupportAvailable(
  evidence: EvidenceItem,
  passage: EvidencePassage,
  proposal: Pick<Screen03AnyProposal, "group" | "label"> & {
    stage?: Screen02DateLeadStage;
  },
) {
  return (
    passage.locator !== null &&
    screen03EvidenceItemProvidesDirectSupportForProposal(evidence, proposal) &&
    screen03PassageProvidesDirectSupport(passage, proposal)
  );
}

function timelinePassageSupports(
  evidence: EvidenceItem,
  passage: EvidencePassage,
  stage: Screen02DateLeadStage,
  date: string,
) {
  if (
    passage.locator === null ||
    !directSupportAvailable(evidence, passage, {
      group: "timeline",
      label: stage,
      stage,
    })
  ) return false;
  const text = normalizedToken(passage.text);
  if (!textContainsDate(text, date)) return false;
  const stagePattern: Record<Screen02DateLeadStage, RegExp | null> = {
    announcement: /\b(?:announc|declar|publication)\w*\b/,
    adoption: /\b(?:adopt|approv|decision|order)\w*\b/,
    enactment: /\b(?:enact|adopt|assent|sign)\w*\b/,
    scheduled_effect:
      /\b(?:scheduled|would|was to)\s+(?:become\s+|take\s+)?effect(?:ive)?\b/,
    effective:
      /\b(?:effective|takes? effect|took effect|went into effect|appl\w*|in force|commenc\w*)\b/,
    implementation: /\b(?:implement|phase|rollout|compliance)\w*\b/,
    enforcement: /\b(?:enforc|penalt|inspection)\w*\b/,
    publication: /\b(?:publish|publication|gazette|register)\w*\b/,
    ruling: /\b(?:rul|judg|decision|order|court)\w*\b/,
    injunction: /\b(?:enjoin\w*|injunction\w*|stay|stayed)\b/,
    invalidation: /\b(?:vacat\w*|invalidat\w*|set aside|held unlawful)\b/,
    withdrawal: /\b(?:withdraw\w*|rescind\w*)\b/,
    repeal: /\b(?:repeal\w*|remov(?:e|ed|al) from)\b/,
    supersession: /\b(?:supersed\w*|replaced by)\b/,
    rulemaking: /\b(?:rule|regulat|publication|document date|gazette)\w*\b/,
    amendment:
      /\b(?:amend|revis|renew|delay|extend|extension|deadline|postpon|repeal|supersed)\w*\b/,
    occurrence: /\b(?:event|incident|origin|began|start|landfall|earthquake)\w*\b/,
    other: null,
  };
  const pattern = stagePattern[stage];
  return pattern === null || pattern.test(text);
}

function timelineEvidenceReferences(
  evidence: readonly EvidenceItem[],
  upstreamSourceIds: readonly string[],
  date: string,
  stage: Screen02DateLeadStage,
) {
  const selected = evidence.filter(
    (item) => item.sourceId !== null && upstreamSourceIds.includes(item.sourceId),
  );
  const selectedDirect = selected.flatMap((item) =>
    item.passages.filter((passage) =>
      timelinePassageSupports(item, passage, stage, date)
    ),
  );
  const direct = selectedDirect.length > 0
    ? selectedDirect
    : evidence.flatMap((item) =>
        item.passages.filter((passage) =>
          timelinePassageSupports(item, passage, stage, date)
        ),
      );
  const owners = evidence.filter((item) =>
    item.passages.some((passage) => direct.some((match) => match.id === passage.id)),
  );
  const indirect = selected.flatMap((item) => item.passages).slice(0, 6);
  return {
    sourceIds: direct.length > 0
      ? owners.map((item) => item.id)
      : selected.map((item) => item.id),
    passageIds: (direct.length > 0 ? direct : indirect).map((passage) => passage.id),
    support: direct.length > 0
      ? "direct" as const
      : indirect.length > 0
        ? "indirect" as const
        : "unsupported" as const,
  };
}

function referencesFromEvidence(
  evidence: readonly EvidenceItem[],
  value: string,
  group: Screen03ProposalGroup,
  label: string,
) {
  const normalizedValue = normalizedToken(value);
  const directPassages = evidence.flatMap((item) =>
    item.passages.filter(
      (passage) =>
        directSupportAvailable(item, passage, { group, label }) &&
        normalizedValue.length > 0 &&
        containsTokenSequence(
          normalizedToken(passage.text),
          normalizedValue,
        ),
    ),
  );
  const allPassages = evidence.flatMap((item) => item.passages).slice(0, 12);
  return {
    sourceIds: evidence.map((item) => item.id),
    passageIds: (directPassages.length > 0 ? directPassages : allPassages).map(
      (passage) => passage.id,
    ),
    support: directPassages.length > 0
      ? "direct" as const
      : allPassages.length > 0
        ? "indirect" as const
        : "unsupported" as const,
  };
}

function proposalBase(input: {
  idSeed: string;
  group: Exclude<keyof Screen03ResearchPacket["proposals"], "timeline">;
  label: string;
  value: string;
  critical: boolean;
  sourceIds: string[];
  passageIds: string[];
  support: "direct" | "indirect" | "conflicting" | "unsupported";
  uncertainty: string | null;
}) {
  return {
    id: stableId("screen03-proposal", `${input.group}:${input.idSeed}`),
    group: input.group === "requiredVariable"
      ? "required-variable" as const
      : input.group,
    label: normalizedText(input.label, 160),
    value: normalizedText(input.value, 2_000),
    critical: input.critical,
    reviewStatus: "proposed" as const,
    editedValue: null,
    support: input.support,
    sourceIds: input.sourceIds,
    passageIds: input.passageIds,
    uncertainty: input.uncertainty,
  };
}

type ExtractedDetailCategory =
  | "threshold"
  | "exemption"
  | "coverage"
  | "rights"
  | "operative-component"
  | "amendment";

type ExtractedDetail = {
  category: ExtractedDetailCategory;
  group: "component" | "eligibility" | "amendment";
  label: string;
  value: string;
  critical: boolean;
  sourceIds: string[];
  passageIds: string[];
};

const EXTRACTED_DETAIL_RULES: readonly {
  category: ExtractedDetailCategory;
  group: ExtractedDetail["group"];
  label: string;
  critical: boolean;
  matches: (normalizedStatement: string) => boolean;
}[] = [
  {
    category: "threshold",
    group: "eligibility",
    label: "Eligibility thresholds",
    critical: true,
    matches: (statement) =>
      /\b(?:threshold|revenue|turnover|annual receipts?|employees?|assets?|exceed\w*|at least|more than|no less than)\b/u.test(
        statement,
      ) &&
      /(?:[$€£]\s*\d|\b\d[\d,.]*\s*(?:%|percent|million|billion|thousand|employees?|dollars?|euros?|pounds?|units?)\b)/u.test(
        statement,
      ),
  },
  {
    category: "exemption",
    group: "eligibility",
    label: "Exemptions",
    critical: true,
    matches: (statement) =>
      /\b(?:exempt\w*|exception\w*|excluded?|does not apply|shall not apply|not subject to)\b/u.test(
        statement,
      ),
  },
  {
    category: "coverage",
    group: "eligibility",
    label: "Covered entities or eligibility",
    critical: true,
    matches: (statement) =>
      !/\bsubject to limitation\b/u.test(statement) &&
      (
        /\b(?:covered entit(?:y|ies)|covered persons?|eligible|eligibility|applies to|applicable to|scope includes?|coverage includes?)\b/u.test(
          statement,
        ) ||
        (
          /\bsubject to\b/u.test(statement) &&
          /\b(?:business(?:es)?|entit(?:y|ies)|organizations?|persons?|firms?|plants?|facilities|operators?|employers?|units?)\b/u.test(
            statement,
          )
        )
      ),
  },
  {
    category: "rights",
    group: "component",
    label: "Rights or protections",
    critical: true,
    matches: (statement) =>
      /\b(?:rights?|right to|protections?|entitled to|may request|may ask|may direct|may opt|non[- ]?discrimination)\b/u.test(
        statement,
      ),
  },
  {
    category: "operative-component",
    group: "component",
    label: "Operative duty or component",
    critical: true,
    matches: (statement) =>
      /\b(?:shall|must|required to|requires?|prohibits?|may not|dut(?:y|ies)|obligation\w*|mandates?|imposes?|establishes?|operative (?:change|provision)|takes effect|comes into force)\b/u.test(
        statement,
      ),
  },
  {
    category: "amendment",
    group: "amendment",
    label: "Amendments and delays",
    critical: true,
    matches: (statement) =>
      /\b(?:amend\w*|revis(?:e|ed|es|ing|ion|ions)|renew\w*|delay\w*|extension\w*|phase[ -]?in|supersed\w*|repeal\w*)\b/u.test(
        statement,
      ),
  },
] as const;

function boundedPassageStatements(text: string) {
  return screen03CompleteExtractiveStatements(text, 24)
    .map((statement) => normalizedText(statement, 1_600));
}

/**
 * Extract a small, deterministic set of review candidates from exact active
 * source excerpts. A lexical hit is never a decision: every item remains
 * proposed and cites only the evidence item and exact passage containing the
 * verbatim proposed value. Structured-record fields and synthesized metadata
 * are deliberately excluded from this detail extractor.
 */
function extractDirectDetailProposals(
  evidence: readonly EvidenceItem[],
): ExtractedDetail[] {
  type RankedDetail = ExtractedDetail & { score: number };
  const extracted: RankedDetail[] = [];

  for (const item of evidence) {
    if (!screen03EvidenceItemProvidesAuthoritativeDirectSupport(item)) continue;
    // A precursor initiative can support the announcement timeline, but its
    // proposed duties are not operative provisions of the later enacted law.
    if (screen03EvidenceSourceRole(item) === "precursor-official-record") {
      continue;
    }
    const relatedRecord =
      screen03EvidenceSourceRole(item) === "related-official-record";
    for (const passage of item.passages) {
      if (
        passage.locator === null ||
        ![
          "source-excerpt",
          "official-document-passage",
          "official-guidance-passage",
        ].includes(passage.basis)
      ) {
        continue;
      }
      if (screen03EvidenceTextHasUnsafeInstruction(passage.text)) continue;
      for (const statement of boundedPassageStatements(passage.text)) {
        const normalizedStatement = normalizedToken(statement);
        for (const rule of EXTRACTED_DETAIL_RULES) {
          if (relatedRecord && rule.category !== "amendment") continue;
          if (!rule.matches(normalizedStatement)) continue;
          const existing = extracted.find(
            (candidate) =>
              candidate.category === rule.category &&
              screen03ClaimsAreEquivalent(candidate.value, statement),
          );
          if (existing) {
            const candidateScore = screen03ClaimQualityScore(statement) +
              (7 - item.authorityTier) * 20;
            if (existing.value === statement) {
              if (!existing.sourceIds.includes(item.id)) {
                existing.sourceIds.push(item.id);
              }
              if (!existing.passageIds.includes(passage.id)) {
                existing.passageIds.push(passage.id);
              }
            } else if (candidateScore > existing.score) {
              existing.value = statement;
              existing.score = candidateScore;
              existing.sourceIds = [item.id];
              existing.passageIds = [passage.id];
            }
            continue;
          }
          extracted.push({
            category: rule.category,
            group: rule.group,
            label: rule.label,
            value: statement,
            critical: rule.critical,
            sourceIds: [item.id],
            passageIds: [passage.id],
            score: screen03ClaimQualityScore(statement) +
              (7 - item.authorityTier) * 20,
          });
        }
      }
    }
  }
  const categoryCounts = new Map<ExtractedDetailCategory, number>();
  return extracted
    .sort((left, right) =>
      right.score - left.score ||
      left.value.localeCompare(right.value)
    )
    .filter((detail) => {
      const categoryMaximum = detail.category === "operative-component"
        ? SCREEN_03_COMPONENT_TARGET
        : SCREEN_03_DETAIL_MAX_PER_CATEGORY;
      const count = categoryCounts.get(detail.category) ?? 0;
      if (count >= categoryMaximum) return false;
      categoryCounts.set(detail.category, count + 1);
      return true;
    })
    .slice(0, SCREEN_03_DETAIL_MAX_TOTAL)
    .map(({ score: _score, ...detail }) => detail);
}

function componentLabelPriority(label: string) {
  const token = normalizedToken(label);
  if (token === "rights or protections") return 30;
  if (token === "operative duty or component") return 0;
  if (token === "event component") return 10;
  if (
    token === "implementation or compliance" ||
    token === "enforcement or penalty" ||
    token === "effective date or application"
  ) {
    return 20;
  }
  return 5;
}

function componentProposalScore(
  proposal: Screen03AnyProposal,
  protectedUpstream: boolean,
) {
  return (protectedUpstream ? 1_000_000 : 0) +
    (proposal.support === "direct" ? 100_000 : 0) +
    screen03ClaimQualityScore(proposal.value) +
    componentLabelPriority(proposal.label);
}

function mergeExactComponentProvenance(
  left: Screen03AnyProposal,
  right: Screen03AnyProposal,
  preferRight: boolean,
) {
  const preferred = preferRight ? right : left;
  const direct = [left, right].filter((proposal) => proposal.support === "direct");
  const referenced = direct.length > 0 ? direct : [left, right];
  return {
    ...preferred,
    critical: left.critical || right.critical,
    support: direct.length > 0
      ? "direct" as const
      : left.support === "conflicting" || right.support === "conflicting"
        ? "conflicting" as const
        : left.support === "indirect" || right.support === "indirect"
          ? "indirect" as const
          : "unsupported" as const,
    sourceIds: [...new Set(referenced.flatMap((proposal) => proposal.sourceIds))],
    passageIds: [...new Set(referenced.flatMap((proposal) => proposal.passageIds))],
    uncertainty: preferred.uncertainty ?? (preferRight ? left : right).uncertainty,
  } satisfies Screen03AnyProposal;
}

/**
 * Keep every distinct critical Screen 2 handoff component, then fill the lane
 * with at most three concise direct additions. Exact equivalents across
 * carried, deterministic, and model-validated paths merge their provenance;
 * conservative near-duplicates retain only the stronger displayed claim.
 */
function consolidateComponentProposals(
  proposals: readonly Screen03AnyProposal[],
  protectedIds: ReadonlySet<string>,
) {
  const distinct: Array<{
    proposal: Screen03AnyProposal;
    protectedUpstream: boolean;
  }> = [];
  const ordered = [
    ...proposals.filter((proposal) => protectedIds.has(proposal.id)),
    ...proposals
      .filter((proposal) => !protectedIds.has(proposal.id))
      .sort((left, right) =>
        componentProposalScore(right, false) -
          componentProposalScore(left, false) ||
        left.id.localeCompare(right.id)
      ),
  ];
  for (const candidate of ordered) {
    const protectedUpstream = protectedIds.has(candidate.id);
    const priorIndex = distinct.findIndex(({ proposal }) =>
      screen03ClaimsAreEquivalent(proposal.value, candidate.value)
    );
    if (priorIndex < 0) {
      distinct.push({ proposal: candidate, protectedUpstream });
      continue;
    }
    const prior = distinct[priorIndex]!;
    const preferCandidate = protectedUpstream && !prior.protectedUpstream ||
      (protectedUpstream === prior.protectedUpstream &&
        componentProposalScore(candidate, protectedUpstream) >
          componentProposalScore(prior.proposal, prior.protectedUpstream));
    distinct[priorIndex] = {
      proposal: prior.proposal.value === candidate.value
        ? mergeExactComponentProvenance(
            prior.proposal,
            candidate,
            preferCandidate,
          )
        : preferCandidate
          ? candidate
          : prior.proposal,
      protectedUpstream: prior.protectedUpstream || protectedUpstream,
    };
  }

  const upstream = distinct.filter((item) => item.protectedUpstream);
  const additions = distinct
    .filter((item) => !item.protectedUpstream)
    .sort((left, right) =>
      componentProposalScore(right.proposal, false) -
        componentProposalScore(left.proposal, false) ||
      left.proposal.id.localeCompare(right.proposal.id)
    );
  const openSlots = Math.max(0, SCREEN_03_COMPONENT_TARGET - upstream.length);
  return [...upstream, ...additions.slice(0, openSlots)].map(
    (item) => item.proposal,
  );
}

function retrievedTimelineStage(input: {
  proposal: Screen02FindProposal;
  relationship: ProposalIdentityRelationship;
  dated: string;
}) {
  if (input.relationship.scope === "related") {
    return input.relationship.relatedStage;
  }
  const recordType = normalizedToken(
    input.proposal.nativeIdentity?.status ?? "",
  );
  if (/effective/i.test(input.dated)) return "effective" as const;
  if (/implement|commencement/i.test(input.dated)) {
    return "implementation" as const;
  }
  if (/enforce/i.test(input.dated)) return "enforcement" as const;
  if (/amend|revis|renew|delay|extend|extension|deadline|postpon|repeal|supersed/i.test(input.dated)) {
    return "amendment" as const;
  }
  if (/event|incident|start|origin/i.test(input.dated)) {
    return "occurrence" as const;
  }
  if (/declaration/i.test(input.dated)) return "announcement" as const;
  if (/publication|document/i.test(input.dated)) {
    return /\bnotice\b/u.test(recordType)
      ? "announcement" as const
      : "rulemaking" as const;
  }
  return "other" as const;
}

function retrievedTimelineLabel(
  proposal: Screen02FindProposal,
  relationship: ProposalIdentityRelationship,
  dated: string,
  stage: Screen02DateLeadStage,
) {
  const lifecycle = `${proposal.title} ${proposal.description} ${
    proposal.nativeIdentity?.status ?? ""
  } ${dated}`;
  if (stage === "amendment") {
    const publication = relationship.scope === "related" ? " publication" : "";
    if (/\bcharter\b[\s\S]{0,100}\brenew\w*\b/i.test(lifecycle)) {
      return `Charter renewal${publication} date`;
    }
    if (/\brenew\w*\b/i.test(lifecycle)) return `Renewal${publication} date`;
    if (/\b(?:deadline|extend\w*|delay\w*|postpon\w*)\b/i.test(lifecycle)) {
      return relationship.scope === "related"
        ? "Deadline-extension notice publication date"
        : "Deadline extension or delay date";
    }
    if (/\bsupersed\w*\b/i.test(lifecycle)) {
      return `Supersession${publication} date`;
    }
    if (/\brepeal\w*\b/i.test(lifecycle)) return `Repeal${publication} date`;
    return `Amendment${publication} date`;
  }
  if (relationship.scope === "related") {
    if (relationship.relatedStage === "implementation") {
      return "Related implementation milestone";
    }
    if (relationship.relatedStage === "enforcement") {
      return "Related enforcement milestone";
    }
    if (relationship.relatedStage === "effective") {
      return "Related effective or application milestone";
    }
  }
  return dated.replace(/:\s*\d{4}-\d{2}-\d{2}.*/, "");
}

function retrievedTimelineScope(
  proposal: Screen02FindProposal,
  dated: string,
) {
  return `${proposal.title} ${proposal.description} ${dated}`.match(
    /\b(?:(?:phase|group|class)\s+(?:\d+|one|two|three|four|five|first|second|third|fourth|fifth)|(?:\d+|first|second|third|fourth|fifth)\s+(?:phase|group|class)|(?:small|large)\s+(?:business(?:es)?|entit(?:y|ies)|firms?))\b/i,
  )?.[0] ?? null;
}

function buildProposals(
  handoff: Screen02WorkflowHandoff,
  evidence: readonly EvidenceItem[],
  runs: readonly ConnectorResult[],
  synthesis: Screen03EvidenceSynthesisResult,
) {
  const proposals: Screen03ResearchPacket["proposals"] = {
    identity: [],
    overview: [],
    timeline: [],
    component: [],
    eligibility: [],
    amendment: [],
    requiredVariable: [],
  };

  const addField = (
    group: Exclude<keyof Screen03ResearchPacket["proposals"], "timeline">,
    label: string,
    value: string,
    sourceIds: string[],
    critical: boolean,
    uncertainty: string | null,
    idSeed = `${label}:${value}`,
  ) => {
    const refs = evidenceReferences(
      evidence,
      sourceIds,
      value,
      group === "requiredVariable" ? "required-variable" : group,
      label,
    );
    proposals[group].push(proposalBase({
      idSeed,
      group,
      label,
      value,
      critical,
      ...refs,
      uncertainty: refs.support === "unsupported"
        ? uncertainty ?? "The reviewed packet does not contain a passage supporting this value."
        : uncertainty,
    }) as never);
  };

  const identity = handoff.event.identity;
  addField(
    "identity",
    "Canonical event title",
    identity.canonicalTitle,
    handoff.event.sourceIds,
    true,
    null,
  );
  for (const commonName of identity.commonNames) {
    addField(
      "identity",
      "Common name",
      commonName,
      handoff.event.sourceIds,
      false,
      null,
      `common-name:${commonName}`,
    );
  }
  if (identity.formalIdentifier) {
    addField(
      "identity",
      "Formal identifier",
      identity.formalIdentifier,
      handoff.event.sourceIds,
      true,
      null,
    );
  }
  if (identity.issuer) {
    addField(
      "identity",
      "Issuer",
      identity.issuer,
      handoff.event.sourceIds,
      true,
      null,
    );
  }
  if (identity.issuingJurisdiction) {
    addField(
      "identity",
      "Issuing jurisdiction",
      identity.issuingJurisdiction,
      handoff.event.sourceIds,
      true,
      null,
    );
  }
  if (identity.status) {
    addField(
      "identity",
      "Current status",
      identity.status,
      handoff.event.sourceIds,
      false,
      "Current status may depend on later amendments, judicial action, or implementation records.",
    );
  }
  addField(
    "identity",
    "Event type",
    identity.eventType,
    handoff.event.sourceIds,
    true,
    null,
  );
  addField(
    "overview",
    "What happened",
    handoff.event.description.text,
    handoff.event.description.sourceIds,
    true,
    handoff.event.description.uncertainty,
  );

  for (const lead of handoff.event.dateLeads) {
    const date = unambiguousCalendarDate(lead.date);
    if (!date) continue;
    const refs = timelineEvidenceReferences(
      evidence,
      lead.sourceIds,
      date,
      lead.stage,
    );
    proposals.timeline.push({
      id: stableId("screen03-proposal", `timeline:${lead.id}:${date}`),
      group: "timeline",
      label: lead.label,
      value: date,
      date,
      stage: lead.stage,
      critical: true,
      reviewStatus: "proposed",
      editedValue: null,
      support: refs.support,
      sourceIds: refs.sourceIds,
      passageIds: refs.passageIds,
      uncertainty: refs.support === "unsupported"
        ? lead.uncertainty ?? "No active passage directly supports this date lead."
        : lead.uncertainty,
    });
  }

  const componentClaims = [
    ...handoff.event.highLevelChanges,
    ...handoff.event.keyComponents,
  ];
  for (const claim of componentClaims) {
    if (!screen03ExtractiveClaimIsComplete(claim.text)) continue;
    addField(
      "component",
      "Event component",
      claim.text,
      claim.sourceIds,
      true,
      claim.uncertainty,
      claim.id,
    );
  }
  const protectedComponentIds = new Set(
    proposals.component.map((proposal) => proposal.id),
  );
  for (const claim of handoff.event.broadCoverage) {
    addField(
      "eligibility",
      "Covered population or geography",
      claim.text,
      claim.sourceIds,
      true,
      claim.uncertainty,
      claim.id,
    );
  }
  for (const related of handoff.event.relatedVersions) {
    addField(
      "amendment",
      `Related ${related.relationship.replace(/-/g, " ")}`,
      `${related.identity.canonicalTitle}: ${related.note}`,
      related.sourceIds,
      true,
      "The relationship and operative timing require separate approval.",
    );
  }

  for (const detail of extractDirectDetailProposals(evidence)) {
    proposals[detail.group].push(proposalBase({
      idSeed: `excerpt-detail:${detail.category}:${detail.value}`,
      group: detail.group,
      label: detail.label,
      value: detail.value,
      critical: detail.critical,
      support: "direct",
      sourceIds: detail.sourceIds,
      passageIds: detail.passageIds,
      uncertainty:
        "Fixed lexical extraction from an exact source excerpt; applicability and interpretation require researcher approval.",
    }) as never);
  }

  const extractiveClaims = [
    ...proposals.overview,
    ...proposals.component,
    ...proposals.eligibility,
    ...proposals.amendment,
  ];
  const extractiveClaimKeys = new Set(
    extractiveClaims.map((proposal) => JSON.stringify([
      normalizedToken(proposal.label),
      normalizedToken(proposal.value),
      [...proposal.sourceIds].sort(),
    ])),
  );
  for (const claim of synthesis.output.claims) {
    const claimKey = JSON.stringify([
      normalizedToken(claim.label),
      normalizedToken(claim.value),
      [...claim.evidenceIds].sort(),
    ]);
    if (
      extractiveClaimKeys.has(claimKey) ||
      extractiveClaims.some((proposal) =>
        proposal.group === claim.group &&
        screen03ClaimsAreEquivalent(proposal.value, claim.value)
      )
    ) continue;
    extractiveClaimKeys.add(claimKey);
    proposals[claim.group].push(proposalBase({
      idSeed: `bounded-synthesis:${claim.id}`,
      group: claim.group,
      label: claim.label,
      value: claim.value,
      critical: false,
      support: "direct",
      sourceIds: claim.evidenceIds,
      passageIds: claim.passageIds,
      uncertainty: synthesis.mode === "model-validated"
        ? "Optional synthesis passed the strict extractive evidence/passage validator; applicability and interpretation still require researcher approval."
        : "Deterministic extractive synthesis from one exact active passage; applicability and interpretation still require researcher approval.",
    }) as never);
  }

  const discovered = runs.flatMap((run) =>
    (run.result?.proposals ?? []).filter(isFindProposal).flatMap((proposal) => {
      const relationship = screen03ProposalIdentityRelationship(proposal, handoff);
      return relationship
        ? [{
            proposal,
            relationship,
            score: identityScore(
              proposal,
              handoff,
              relationship.identityMatch,
            ) - (relationship.scope === "related" ? 80 : 0),
          }]
        : [];
    }),
  );
  const seenDiscovered = new Set<string>();
  for (const { proposal, relationship, score } of discovered.sort(
    (a, b) => b.score - a.score,
  )) {
    if (seenDiscovered.has(proposal.id)) continue;
    seenDiscovered.add(proposal.id);
    const referencedEvidence = evidence.filter((item) =>
      proposal.sources.some(
        (source) =>
          item.sourceId === source.id ||
          canonicalLocatorKey(item.locator) ===
            canonicalLocatorKey(source.locator),
      ),
    );
    if (referencedEvidence.length === 0) continue;
    const amendmentLike = relationship.scope === "related" || /\b(amend|delay|extension|exemption|threshold|implementation|enforcement)\b/i.test(
      `${proposal.title} ${proposal.description}`,
    );
    const refs = referencesFromEvidence(
      referencedEvidence,
      proposal.description,
      amendmentLike ? "amendment" : "overview",
      amendmentLike
        ? "Related operative-stage record"
        : "Official record context",
    );
    if (amendmentLike) {
      proposals.amendment.push(proposalBase({
        idSeed: `retrieved:${proposal.id}`,
        group: "amendment",
        label: relationship.scope === "related"
          ? "Distinct related official record"
          : "Related operative-stage record",
        value: proposal.description,
        critical: false,
        ...refs,
        uncertainty:
          relationship.scope === "related"
            ? "The title matches the selected event, but the formal identifier differs. This is retained as a distinct related record and is not treated as the selected document."
            : "The record is identity-ranked official metadata; its legal relationship to the selected event remains for researcher approval.",
      }));
    } else if (proposals.overview.length < 3) {
      proposals.overview.push(proposalBase({
        idSeed: `retrieved:${proposal.id}`,
        group: "overview",
        label: "Official record context",
        value: proposal.description,
        critical: false,
        ...refs,
        uncertainty:
          "Connector metadata is context; controlling text and study-specific applicability remain unapproved.",
      }));
    }
    for (const dated of proposal.provisionalDates) {
      const date = /\b(\d{4}-\d{2}-\d{2})\b/.exec(dated)?.[1];
      if (!date || !dateOnly(date)) continue;
      const stage = retrievedTimelineStage({ proposal, relationship, dated });
      // A different formal record can enrich the selected event only when its
      // own text identifies a concrete lifecycle relationship. An exact title
      // alone never promotes its publication date into the selected timeline.
      if (relationship.scope === "related" && stage === null) continue;
      const resolvedStage = stage ?? "other";
      const matchingPassages = referencedEvidence.flatMap((item) =>
        item.passages.filter((passage) =>
          timelinePassageSupports(item, passage, resolvedStage, date),
        ),
      );
      const matchingEvidence = referencedEvidence.filter((item) =>
        item.passages.some((passage) => matchingPassages.includes(passage))
      );
      const allPassages = referencedEvidence.flatMap((item) => item.passages);
      const label = retrievedTimelineLabel(
        proposal,
        relationship,
        dated,
        resolvedStage,
      );
      const scope = retrievedTimelineScope(proposal, dated);
      proposals.timeline.push({
        id: stableId(
          "screen03-proposal",
          `retrieved-date:${proposal.id}:${date}:${resolvedStage}:${label}:${scope ?? ""}`,
        ),
        group: "timeline",
        label,
        value: date,
        date,
        stage: resolvedStage,
        critical: true,
        reviewStatus: "proposed",
        editedValue: null,
        support: matchingPassages.length > 0 ? "direct" : "indirect",
        sourceIds: (matchingPassages.length > 0
          ? matchingEvidence
          : referencedEvidence).map((item) => item.id),
        passageIds: (matchingPassages.length > 0 ? matchingPassages : allPassages).map((passage) => passage.id),
        uncertainty: [
          relationship.scope === "related"
            ? "This is a distinct related formal record with an explicit lifecycle relationship; it is not the selected document and is not automatically the focal event clock."
            : "This date is official connector metadata and is not automatically the focal event clock.",
          scope ? `Source scope: ${scope}.` : "",
        ].filter(Boolean).join(" "),
      });
    }
  }

  const ensureUnsupported = (
    group: "eligibility" | "amendment",
    label: string,
    value: string,
  ) => {
    if (proposals[group].some((proposal) => normalizedToken(proposal.label).includes(normalizedToken(label)))) {
      return;
    }
    proposals[group].push(proposalBase({
      idSeed: `unresolved:${label}`,
      group,
      label,
      value,
      critical: false,
      support: "unsupported",
      sourceIds: [],
      passageIds: [],
      uncertainty:
        "Unknown in the bounded active packet. Do not confirm without a direct supporting passage.",
    }));
  };
  ensureUnsupported(
    "eligibility",
    "Eligibility thresholds",
    "Unknown — no verified threshold is established by the active packet.",
  );
  ensureUnsupported(
    "eligibility",
    "Exemptions",
    "Unknown — no verified exemption is established by the active packet.",
  );
  ensureUnsupported(
    "amendment",
    "Amendments and delays",
    "Unknown — the active packet does not establish a complete amendment or delay history.",
  );
  if (!proposals.timeline.some((proposal) => proposal.stage === "enforcement")) {
    ensureUnsupported(
      "amendment",
      "Enforcement timing",
      "Unknown — no enforcement start date is established by the active packet.",
    );
  }

  const requiredVariables = [
    "Approved focal event clock and source passage",
    "Unit-level covered-entity or eligibility indicator measured before treatment",
    "Threshold, exemption, and phase-in inputs needed to classify exposure",
    "Organization-to-jurisdiction or hazard-footprint linkage",
    "Amendment, implementation, and enforcement timing relevant to the study window",
    ...handoff.event.dateLeads.flatMap((lead) =>
      unambiguousCalendarDate(lead.date) ? [] :
        [`Verify date: ${lead.date.slice(0, 3_800)}`],
    ),
  ];
  for (const variable of new Set(requiredVariables)) {
    proposals.requiredVariable.push(proposalBase({
      idSeed: variable,
      group: "requiredVariable",
      label: "Required downstream variable",
      value: variable,
      critical: false,
      support: "unsupported",
      sourceIds: [],
      passageIds: [],
      uncertainty:
        "This is a research requirement, not a claim that the variable is already available.",
    }));
  }

  for (const group of Object.values(proposals)) {
    const items = group as Screen03AnyProposal[];
    const seen = new Map<string, number>();
    for (let index = 0; index < items.length; index += 1) {
      const proposal = items[index]!;
      const key = normalizedToken(
        `${proposal.group === "timeline" ? `${proposal.stage}:` : ""}${proposal.label}:${proposal.value}`,
      );
      const priorIndex = seen.get(key);
      if (priorIndex === undefined) {
        seen.set(key, index);
        continue;
      }
      const prior = items[priorIndex]!;
      const direct = [prior, proposal].filter((item) => item.support === "direct");
      items[priorIndex] = {
        ...prior,
        critical: prior.critical || proposal.critical,
        support: direct.length > 0
          ? "direct"
          : prior.support === "conflicting" || proposal.support === "conflicting"
            ? "conflicting"
            : prior.support === "indirect" || proposal.support === "indirect"
              ? "indirect"
              : "unsupported",
        sourceIds: [...new Set([...prior.sourceIds, ...proposal.sourceIds])],
        passageIds: [...new Set(
          (direct.length > 0 ? direct : [prior, proposal])
            .flatMap((item) => item.passageIds),
        )],
        uncertainty: prior.uncertainty ?? proposal.uncertainty,
      } as Screen03AnyProposal;
      items.splice(index, 1);
      index -= 1;
    }
  }
  proposals.component = consolidateComponentProposals(
    proposals.component,
    protectedComponentIds,
  ) as typeof proposals.component;
  return proposals;
}

function timelineMilestoneScope(proposal: Screen03AnyProposal) {
  const uncertainty = normalizedToken(proposal.uncertainty ?? "");
  return /\b(?:appl\w*|cover\w*|entit\w*|firms?|business\w*|small|large|phase|group|class|threshold|before|after)\b/u
    .test(uncertainty)
    ? uncertainty
    : "";
}

function buildContradictions(
  proposals: Screen03ResearchPacket["proposals"],
  sourceFusionConflicts: readonly Screen03SourceFusionConflict[] = [],
) {
  const contradictions: Screen03ResearchPacket["contradictions"] =
    sourceFusionConflicts.map((conflict) => ({
      id: stableId(
        "screen03-contradiction",
        `source-fusion:${conflict.representativeProposalId}:${conflict.summary}`,
      ),
      kind: "source-conflict" as const,
      proposalIds: [conflict.representativeProposalId],
      summary: conflict.summary,
      status: "unresolved" as const,
      resolution: null,
    }));
  const semanticMilestones = new Map<
    string,
    typeof proposals.timeline
  >();
  for (const proposal of proposals.timeline) {
    if (
      proposal.support === "unsupported" ||
      proposal.sourceIds.length === 0 ||
      proposal.passageIds.length === 0
    ) continue;
    const semanticKey = [
      proposal.stage,
      normalizedToken(proposal.label),
      timelineMilestoneScope(proposal),
    ].join(":");
    const matches = semanticMilestones.get(semanticKey) ?? [];
    matches.push(proposal);
    semanticMilestones.set(semanticKey, matches);
  }
  for (const candidates of semanticMilestones.values()) {
    const dates = [...new Set(candidates.map((candidate) => candidate.date))];
    if (dates.length < 2) continue;
    const stage = candidates[0]!.stage;
    const label = candidates[0]!.label;
    contradictions.push({
      id: stableId(
        "screen03-contradiction",
        `${stage}:${normalizedToken(label)}:${dates.join(":")}`,
      ),
      kind: "source-conflict",
      proposalIds: candidates.map((candidate) => candidate.id),
      summary: `Sources assign incompatible dates to the same “${label}” milestone (${dates.join(", ")}). Distinct phase-in or compliance milestones remain separate and are not treated as contradictions.`,
      status: "unresolved",
      resolution: null,
    });
  }
  return contradictions;
}

const ACTUAL_STAGE_SUPPORT_PATTERNS: Record<
  Screen03ResearchStageId,
  RegExp
> = {
  "announcement-discussion":
    /\b(?:announc\w*|declar\w*|propos\w*|notice|consult\w*|discussion)\b/u,
  "enactment-publication":
    /\b(?:enact\w*|adopt\w*|assent|signed|publish\w*|publication|final rule|document date|gazette)\b/u,
  "effective-application":
    /\b(?:effective|appl\w*|commenc\w*|in force|operative)\b/u,
  "implementation-compliance":
    /\b(?:implement\w*|compliance|phase[ -]?in|rollout|deadline|guidance)\b/u,
  "enforcement-penalty":
    /\b(?:enforc\w*|penalt\w*|fines?|inspection|sanction\w*)\b/u,
  "amendment-delay-repeal":
    /\b(?:amend\w*|delay\w*|extension\w*|renew\w*|repeal\w*|supersed\w*|revis\w*)\b/u,
};

function actualSupportedResearchStages(
  evidence: readonly EvidenceItem[],
) {
  const directText = evidence
    .filter((item) => item.status !== "changed")
    .flatMap((item) =>
      item.passages
        .filter((passage) => {
          const precursor =
            screen03EvidenceSourceRole(item) === "precursor-official-record";
          return directSupportAvailable(item, passage, precursor
            ? {
                group: "timeline",
                label: "announcement",
                stage: "announcement",
              }
            : {
                group: "overview",
                label: "Research stage",
              });
        })
        .filter(
          (passage) =>
            !screen03EvidenceTextHasUnsafeInstruction(passage.text),
        )
        .map((passage) => ({
          text: normalizedToken(passage.text),
          precursor:
            screen03EvidenceSourceRole(item) === "precursor-official-record",
          related:
            screen03EvidenceSourceRole(item) === "related-official-record",
        }))
    );
  return SCREEN_03_RESEARCH_STAGE_PLAN.filter((stage) =>
    directText.some(({ text, precursor, related }) =>
      (!precursor || stage.id === "announcement-discussion") &&
      (!related || stage.id === "amendment-delay-repeal") &&
      ACTUAL_STAGE_SUPPORT_PATTERNS[stage.id].test(text)
    )
  );
}

function buildCoverage(
  handoff: Screen02WorkflowHandoff,
  runs: readonly ConnectorResult[],
  evidence: readonly EvidenceItem[],
  routePlan: ReturnType<typeof plannedRoutes>,
  tasks: readonly ConnectorTask[],
  documentResults: readonly DocumentTextResult[],
  synthesis: Screen03EvidenceSynthesisResult,
  deadlineDepleted: boolean,
) {
  const evidenceIdsBySource = new Map(
    evidence
      .filter((item) => item.sourceId !== null)
      .map((item) => [item.sourceId!, item.id]),
  );
  const queries = runs.map((run) => {
    const diagnosticQuery = run.result?.diagnostics.queryMatrix[0];
    const returnedEvidenceIds = [
      ...new Set(
        (run.result?.proposals ?? [])
          .flatMap((proposal) => proposal.sources)
          .map((source) => evidenceIdsBySource.get(source.id))
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    return {
      id: run.callId,
      query:
        diagnosticQuery?.query ??
        `${run.connectorId}:${run.requestedTerm ?? "bounded structured filters"}`,
      purpose: run.purpose,
      returnedEvidenceIds,
    };
  });
  const connectorChannels = runs.map((run, index) => {
    const diagnosticChannel = run.result?.diagnostics.channels[0];
    const stage = SCREEN_03_RESEARCH_STAGE_PLAN.find(
      (candidate) => candidate.id === run.stageId,
    )!;
    return {
      channel: `${
        diagnosticChannel?.channel ??
        getScreen02SourceCatalogEntry(run.connectorId).name
      } · role: ${run.sourceRole.replace(/-/g, " ")} · stage: ${stage.label} · bounded call ${index + 1}`,
      status: run.failure
        ? "failed" as const
        : diagnosticChannel?.status ?? "failed" as const,
      note:
        run.failure ??
        diagnosticChannel?.note ??
        "The connector returned no channel diagnostics.",
      retrievedAt: run.failure
        ? null
        : diagnosticChannel?.retrievedAt ?? null,
    };
  });
  const channels = [
    ...connectorChannels,
    ...documentResults
      .filter((document) => (document.redirectCount ?? 0) > 0)
      .map((document) => ({
        channel: "Official document representation resolver",
        status: document.gap === null ? "searched" as const : "failed" as const,
        note: document.gap?.reason ??
          `Followed ${document.redirectCount} policy-revalidated redirect${document.redirectCount === 1 ? "" : "s"} to ${document.resolvedLocator}.`,
        retrievedAt: document.retrievedAt ?? null,
      })),
  ];
  const attemptedRoutes = [...new Set(tasks.map((task) => task.connectorId))];
  const supportedStages = actualSupportedResearchStages(evidence);
  const supportedStageIds = new Set(supportedStages.map((stage) => stage.id));
  const attemptedRoles = [...new Set(tasks.map((task) => task.sourceRole))];
  const activeRoles = new Set(evidence.map((item) =>
    screen03EvidenceSourceRole(item)
  ));
  const reviewedRecords = new Set<string>();
  for (const item of evidence) {
    reviewedRecords.add(canonicalLocatorKey(item.locator));
  }
  for (const run of runs) {
    for (const proposal of run.result?.proposals ?? []) {
      for (const source of proposal.sources) {
        reviewedRecords.add(canonicalLocatorKey(source.locator));
      }
    }
  }
  const gaps = [
    ...routePlan.gaps,
    ...runs
      .filter((run) => run.failure || run.result?.diagnostics.channels.some((channel) => channel.status === "failed"))
      .map(
        (run) =>
          `${getScreen02SourceCatalogEntry(run.connectorId).name} did not complete successfully; carried evidence was retained.`,
      ),
    ...documentResults
      .map((document) => document.gap)
      .filter((gap): gap is DocumentFetchGap => gap !== null)
      .map((gap) => `${gap.reason} Locator: ${gap.locator}`),
    ...SCREEN_03_RESEARCH_STAGE_PLAN
      .filter((stage) => !supportedStageIds.has(stage.id))
      .map(
        (stage) =>
          `No active direct passage supports the ${stage.label} research stage; attempted searches are not counted as evidence coverage.`,
      ),
    ...attemptedRoles
      .filter((role) => !activeRoles.has(role))
      .map(
        (role) =>
          `The attempted ${role.replace(/-/g, " ")} source role produced no active evidence item.`,
      ),
    ...(evidence.some((item) => item.language === "und")
      ? [
          "At least one source did not declare a verifiable language; its original text was retained without inferred translation.",
        ]
      : []),
    ...(evidence.some((item) =>
      item.language !== "und" && !item.language.startsWith("en")
    )
      ? [
          "Non-English official text was retained in its recorded source language. ShockAudit did not silently translate it; a researcher must review the original wording before confirmation.",
        ]
      : []),
    ...(synthesis.gap ? [synthesis.gap] : []),
    ...(deadlineDepleted
      ? [
          `The ${SCREEN_03_RESEARCH_TOTAL_DEADLINE_MS}-millisecond total research budget was reached; remaining document backfill and optional synthesis work stopped, while completed and carried evidence was retained.`,
        ]
      : []),
    ...([
        ...handoff.event.highLevelChanges,
        ...handoff.event.keyComponents,
      ].some((claim) => !screen03ExtractiveClaimIsComplete(claim.text))
        ? [
            "One or more incomplete upstream component fragments were omitted from review. A complete source-grounded sentence is required before the component can be confirmed.",
          ]
        : []),
    "The bounded native connector pack is not an exhaustive search of all amendments, court decisions, regulator guidance, national implementation records, languages, or local administrative sources.",
  ];
  return {
    queries,
    channels,
    routes: attemptedRoutes,
    stages: supportedStages.map((stage) => stage.label),
    languages: [...new Set(
      evidence
        .filter((item) => item.status !== "changed")
        .map((item) => item.language)
        .filter((language) => language !== "und"),
    )],
    authorityTiers: [...new Set(evidence.map((item) => item.authorityTier))].sort() as EvidenceItem["authorityTier"][],
    gaps: [...new Set(gaps)],
    recordsReviewed: reviewedRecords.size,
    activeEvidenceCount: evidence.filter((item) => item.status !== "changed").length,
    exhaustive: false as const,
    outcomeValuesInspected: false as const,
    stoppingRule: {
      rule: `Stop within ${SCREEN_03_RESEARCH_TOTAL_DEADLINE_MS} milliseconds and after all eligible official routes are attempted within ${SCREEN_03_RESEARCH_MAX_CALLS} calls, ${SCREEN_03_RESEARCH_MAX_RESULTS_PER_CALL} records per call, ${SCREEN_03_DOCUMENT_MAX_ATTEMPTS} total document attempts for ${SCREEN_03_DOCUMENT_MAX_FETCHES} usable slots (at most one may be a reviewed related-source page), ${SCREEN_03_RESEARCH_MAX_ACTIVE_EVIDENCE} active evidence items, and ${SCREEN_03_RESEARCH_MAX_PASSAGES} passages.`,
      status: deadlineDepleted ? "not-met" as const : "met" as const,
      note: deadlineDepleted
        ? `The total server research deadline stopped the round after ${runs.length} official call${runs.length === 1 ? "" : "s"} and ${documentResults.length} document fetch${documentResults.length === 1 ? "" : "es"}. Completed and carried evidence remains reviewable, but this round did not complete its fixed search plan.`
        : `The bounded round attempted ${runs.length} official call${runs.length === 1 ? "" : "s"} and ${documentResults.length} document fetch${documentResults.length === 1 ? "" : "es"}; ${supportedStages.length} of ${SCREEN_03_RESEARCH_STAGE_PLAN.length} planned stages have active direct-passage support. “Met” means the fixed budget stopped normally, not that coverage is complete, exhaustive, or approved.`,
    },
  } satisfies Screen03ResearchPacket["coverage"];
}

async function discoverScreen03ContextLeads(
  input: ResearchScreen03EvidenceInput,
  deadline: Screen03ResearchDeadline,
) {
  let contextLeads = (input.handoff.mode === "audit"
    ? input.handoff.history.searchManifests
      .flatMap((manifest) => manifest.contextLeads ?? [])
    : [])
    .filter(
      (lead, index, values) =>
        values.findIndex((candidate) => candidate.locator === lead.locator) ===
          index,
    )
    .slice(0, 5);
  let contextSearchCallCount = 0;
  let contextSearchStatus: Screen03ResearchTelemetry["contextSearchStatus"] =
    input.contextSearch
      ? "skipped-budget"
      : contextLeads.length > 0
        ? "carried-only"
        : "not-configured";
  if (input.contextSearch && deadline.remainingMs() >= 2_400) {
    contextSearchCallCount = 1;
    const identity = input.handoff.event.identity;
    const endDate = input.retrievedAt.slice(0, 10);
    const startDate = new Date(
      Date.parse(`${endDate}T00:00:00.000Z`) - 365 * 86_400_000,
    ).toISOString().slice(0, 10);
    try {
      const records = await raceScreen03Deadline(input.contextSearch({
        mode: input.handoff.mode,
        stage: "implementation",
        query: [identity.canonicalTitle, identity.formalIdentifier, identity.issuer]
          .filter(Boolean).join(" "),
        resultLimit: 5,
        retrievedAt: input.retrievedAt,
        eventFamily: identity.eventType,
        startDate,
        endDate,
        identity: {
          canonicalName: identity.canonicalTitle,
          issuingJurisdiction: identity.issuingJurisdiction,
        },
        signal: deadline.signal,
      }), deadline);
      const discovered = records.slice(0, 5).flatMap((record) => {
        const source = record.value.sources[0];
        const lead = {
          id: normalizedText(record.recordId, 200),
          title: normalizedText(record.canonicalIdentity, 500),
          locator: record.locator ?? "",
          publisher: normalizedText(source?.publisher ?? "Unknown publisher", 240),
          publishedDate: source?.publishedDate ?? null,
          sourceRole: "contextual-secondary" as const,
          status: "unverified" as const,
          note:
            "Indexed related-source lead. ShockAudit will admit it as evidence only if a guarded page fetch returns a direct passage grounded to the selected event.",
        };
        return isScreen02ContextLead(lead) ? [lead] : [];
      });
      contextLeads = [...contextLeads, ...discovered]
        .filter(
          (lead, index, values) =>
            values.findIndex((candidate) => candidate.locator === lead.locator) ===
              index,
        )
        .slice(0, 5);
      contextSearchStatus = "completed";
    } catch {
      // Carried Screen 2 context remains visible when optional refresh fails.
      contextSearchStatus = "failed";
    }
  }
  return { contextLeads, contextSearchCallCount, contextSearchStatus };
}

/**
 * Deepens one already-selected Screen 2 event with configured official
 * connectors and, when enabled, at most one guarded tier-6 related page. The
 * service is deliberately outcome-blind: direct passages may propose event
 * facts, but no proposal is approved and unsupported facts remain unresolved.
 */
export async function researchScreen03Evidence(
  input: ResearchScreen03EvidenceInput,
): Promise<Screen03ResearchPacket> {
  const researchStartedAt = Date.now();
  if (typeof input.fetch !== "function") {
    throw new Error("Screen 3 research requires an injected connector fetch implementation.");
  }
  if (!validRetrievedAt(input.retrievedAt)) {
    throw new Error("retrievedAt must be an explicit ISO 8601 UTC timestamp.");
  }
  if (input.handoff.outcomeValuesInspected !== false) {
    throw new Error("Screen 3 research only accepts an outcome-blind Screen 2 handoff.");
  }
  if (input.targetClaim) {
    const target = input.targetClaim;
    if (
      !target.proposalId?.trim() || target.proposalId.length > 600 ||
      !target.label?.trim() || target.label.length > 600 ||
      !target.value?.trim() || target.value.length > 4_000 ||
      !["identity", "overview", "timeline", "component", "eligibility", "amendment"].includes(target.group) ||
      !Array.isArray(target.sourceIds) ||
      !Array.isArray(target.passageIds) ||
      target.sourceIds.length > 100 ||
      target.passageIds.length > 100 ||
      new Set(target.sourceIds).size !== target.sourceIds.length ||
      new Set(target.passageIds).size !== target.passageIds.length ||
      target.sourceIds.some((id) => !id?.trim() || id.length > 600) ||
      target.passageIds.some((id) => !id?.trim() || id.length > 600) ||
      (target.group === "timeline"
        ? !target.stage || !screen02DateLeadStages.includes(target.stage)
        : target.stage !== undefined)
    ) {
      throw new Error("Screen 3 targetClaim failed its bounded fixed contract.");
    }
  }
  const deadline = createScreen03ResearchDeadline(input);
  try {
  const routePlan = plannedRoutes(input.handoff);
  const tasks = connectorTasks(input, routePlan.routes, deadline);
  const preConnectorCandidates = mergeEvidenceCandidates([
    ...carriedEvidenceCandidates(input.handoff, input.retrievedAt),
    ...officialLifecycleCompanionCandidates(
      input.handoff,
      input.retrievedAt,
    ),
  ]);
  const byteBudget: DocumentByteBudget = {
    remaining: SCREEN_03_DOCUMENT_MAX_TOTAL_BYTES,
  };
  let pdfConversionSlots = 0;
  const claimPdfConversionSlot = () => {
    if (pdfConversionSlots >= SCREEN_03_DOCUMENT_MAX_PDF_CONVERSIONS) {
      return false;
    }
    pdfConversionSlots += 1;
    return true;
  };
  // Start the selected carried official record before slower catalog fanout.
  // It still shares the one total deadline and the existing attempt, usable,
  // byte, redirect, conversion, and host-policy limits. A failed exact-record
  // representation may therefore use the existing bounded fallback chain,
  // but it cannot create a second document budget.
  const priorityDocumentRun = (async () => {
    const startedAt = Date.now();
    const results = await fetchDocumentSlots({
      serviceInput: input,
      candidates: priorityCarriedDocumentCandidates(
        preConnectorCandidates,
        input.handoff,
        input.targetClaim,
      ),
      deadline,
      byteBudget,
      claimPdfConversionSlot,
      maximumAttempts: SCREEN_03_DOCUMENT_MAX_ATTEMPTS,
      maximumUsable: 1,
    });
    return { results, durationMs: Date.now() - startedAt };
  })();
  const connectorRun = (async () => {
    const startedAt = Date.now();
    const runs = await runConnectorTasks(tasks, deadline);
    return { runs, durationMs: Date.now() - startedAt };
  })();
  const [priorityDocuments, connectorResult, contextDiscovery] =
    await Promise.all([
      priorityDocumentRun,
      connectorRun,
      discoverScreen03ContextLeads(input, deadline),
    ]);
  const { runs, durationMs: connectorDurationMs } = connectorResult;
  const initialCandidates = mergeEvidenceCandidates([
    ...preConnectorCandidates,
    ...retrievedEvidenceCandidates(runs, input.handoff),
  ]);
  const priorityDocumentResults = priorityDocuments.results;
  const attemptedPriorityLocators = new Set(
    priorityDocumentResults.map((result) =>
      canonicalLocatorKey(result.sourceLocator ?? result.locator)
    ),
  );
  const remainingCandidates = initialCandidates.filter(
    (candidate) =>
      !attemptedPriorityLocators.has(
        canonicalLocatorKey(candidate.evidence.locator),
      ),
  );
  const remainingDocumentLocators = rankedDocumentLocators(
    initialCandidates,
    input.targetClaim,
  ).filter(
    (locator) => !attemptedPriorityLocators.has(canonicalLocatorKey(locator)),
  );
  const priorityUsable = new Set(
    priorityDocumentResults
      .filter((result) => result.excerpts.length > 0)
      .map((result) =>
        documentSourceKey(result.sourceLocator ?? result.locator)
      ),
  ).size;
  const remainingAttempts = Math.max(
    0,
    SCREEN_03_DOCUMENT_MAX_ATTEMPTS - priorityDocumentResults.length,
  );
  const remainingUsable = Math.max(
    0,
    SCREEN_03_DOCUMENT_MAX_FETCHES - priorityUsable,
  );
  const relatedFetchPlanned = remainingAttempts > 0 && remainingUsable > 0 &&
    contextDiscovery.contextLeads.some(
      (lead) => allowlistedRelatedDocumentLocator(lead) !== null,
    );
  const reservedRelatedSlot = relatedFetchPlanned ? 1 : 0;
  const remainingDocumentStartedAt = Date.now();
  const [remainingOfficialDocumentResults, relatedResearch] = await Promise.all([
    fetchDocumentSlots({
      serviceInput: input,
      candidates: remainingCandidates,
      orderedLocators: remainingDocumentLocators,
      deadline,
      byteBudget,
      claimPdfConversionSlot,
      maximumAttempts: remainingAttempts - reservedRelatedSlot,
      maximumUsable: remainingUsable - reservedRelatedSlot,
    }),
    fetchRelatedContextDocument({
      serviceInput: input,
      leads: relatedFetchPlanned ? contextDiscovery.contextLeads : [],
      deadline,
      byteBudget,
    }),
  ]);
  const officialDocumentResults = [
    ...priorityDocumentResults,
    ...remainingOfficialDocumentResults,
  ];
  const documentResults = [
    ...officialDocumentResults,
    ...relatedResearch.documentResults,
  ];
  const documentDurationMs = priorityDocuments.durationMs +
    (Date.now() - remainingDocumentStartedAt);
  const candidates = mergeEvidenceCandidates(
    [
      ...enrichEvidenceCandidatesWithReviewedIdentityFallback(
        enrichEvidenceCandidatesWithDocumentText(
          initialCandidates,
          officialDocumentResults,
        ),
        officialDocumentResults,
        input.handoff,
      ),
      ...relatedResearch.candidates,
    ],
  );
  const evidence = selectActiveEvidence(candidates);
  const passageCount = evidence.reduce(
    (sum, item) => sum + item.passages.length,
    0,
  );
  if (
    evidence.length > SCREEN_03_RESEARCH_MAX_ACTIVE_EVIDENCE ||
    passageCount > SCREEN_03_RESEARCH_MAX_PASSAGES
  ) {
    throw new Error("Screen 3 active evidence exceeded its fixed packet bounds.");
  }
  const synthesisStartedAt = Date.now();
  const synthesisCallCount = input.synthesizer && !deadline.signal.aborted
    ? 1
    : 0;
  const synthesis = await synthesizeScreen03Evidence({
    handoff: input.handoff,
    evidence,
    ...(input.synthesizer && !deadline.signal.aborted
      ? {
          synthesizer: synthesizerWithinScreen03Deadline(
            input.synthesizer,
            deadline,
          ),
        }
      : {}),
  });
  const synthesisDurationMs = Date.now() - synthesisStartedAt;
  const fetchedRelatedLocators = new Set(
    relatedResearch.documentResults
      .filter((result) => result.excerpts.length > 0)
      .map((result) => canonicalLocatorKey(result.locator)),
  );
  const contextLeads = contextDiscovery.contextLeads.map((lead) =>
    fetchedRelatedLocators.has(canonicalLocatorKey(lead.locator))
      ? {
          ...lead,
          note:
            "ShockAudit fetched this related page through the guarded tier-6 lane and preserved direct passages for claim review. The source remains unverified and every proposal still requires researcher confirmation.",
        }
      : lead
  );
  const { contextSearchCallCount, contextSearchStatus } = contextDiscovery;
  const assemblyStartedAt = Date.now();
  const sourceFusion = fuseScreen03ProposalSources(
    buildProposals(input.handoff, evidence, runs, synthesis),
    evidence,
  );
  const proposals = sourceFusion.proposals;
  const coverage = buildCoverage(
    input.handoff,
    runs,
    evidence,
    routePlan,
    tasks,
    documentResults,
    synthesis,
    deadline.signal.aborted,
  );
  const packet = {
    protocolVersion: "screen-03-research-packet-v1",
    researchedAt: input.retrievedAt,
    upstreamEventFingerprint: input.handoff.integrity.eventFingerprint,
    coverage,
    contextLeads,
    evidence,
    proposals,
    contradictions: buildContradictions(proposals, sourceFusion.conflicts),
    outcomeValuesInspected: false,
  } satisfies Screen03ResearchPacket;
  const assemblyDurationMs = Date.now() - assemblyStartedAt;
  if (input.onTelemetry) {
    const supportedStageCount = coverage.stages.length;
    const telemetry: Screen03ResearchTelemetry = {
      event: "screen03-research-completed",
      connectorCalls: runs.length,
      connectorSucceeded: runs.filter((run) => run.failure === null).length,
      connectorFailed: runs.filter((run) => run.failure !== null).length,
      recordsReviewed: coverage.recordsReviewed,
      documentAttempts: documentResults.length,
      documentUsable: new Set(
        documentResults
          .filter((result) => result.excerpts.length > 0)
          .map((result) => documentSourceKey(
            result.sourceLocator ?? result.locator,
          )),
      ).size,
      pdfConversionAttempts: documentResults.filter(
        (result) =>
          result.documentKind === "pdf" &&
          ["converted", "failed"].includes(result.conversionStatus),
      ).length,
      pdfConversionSucceeded: documentResults.filter(
        (result) => result.conversionStatus === "converted",
      ).length,
      activeEvidenceCount: coverage.activeEvidenceCount,
      passageCount,
      supportedStageCount,
      missingStageCount:
        SCREEN_03_RESEARCH_STAGE_PLAN.length - supportedStageCount,
      synthesisMode: synthesis.mode,
      synthesisStatus: synthesis.modelStatus,
      synthesisCallCount,
      synthesisModelClaimCount: synthesis.modelClaimCount,
      synthesisFallbackClaimCount: synthesis.fallbackClaimCount,
      contextSearchCallCount,
      contextLeadCount: contextLeads.length,
      contextSearchStatus,
      totalDurationMs: Date.now() - researchStartedAt,
      connectorDurationMs,
      documentDurationMs,
      synthesisDurationMs,
      assemblyDurationMs,
      documentBytesRead: documentResults.reduce(
        (sum, result) => sum + (result.bytesRead ?? 0),
        0,
      ),
      evidenceStateBytes: new TextEncoder().encode(JSON.stringify(evidence))
        .byteLength,
      packetStateBytes: new TextEncoder().encode(JSON.stringify(packet))
        .byteLength,
      stoppingRuleStatus: coverage.stoppingRule.status,
    };
    try {
      await raceScreen03Deadline(
        Promise.resolve(input.onTelemetry(telemetry)),
        deadline,
      );
    } catch {
      // Observability cannot alter research results or review/lock invariants.
    }
  }
  return packet;
  } finally {
    deadline.dispose();
  }
}
