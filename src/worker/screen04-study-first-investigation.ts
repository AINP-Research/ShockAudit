import { fingerprintSixScreenValue } from
  "../core/six-screen/canonical";
import type { SourceCapability } from
  "../core/six-screen/capabilities";
import {
  createCoEventCandidateOccurrence,
  type CoEventCandidateOccurrence,
} from "../core/six-screen/co-event-execution";
import {
  PUBLIC_SCREEN02_EVENT_DATE_DETAILS,
  PUBLIC_SCREEN02_EVENT_INDEX_PROPOSALS,
  SCREEN02_PUBLIC_EVENT_INDEX_CAPTURED_AT,
  SCREEN02_PUBLIC_EVENT_INDEX_VERSION,
} from "../core/screen02-public-event-index";
import type { CoEventProviderId } from
  "../core/six-screen/co-event-search";
import {
  STUDY_FIRST_EVENT_ANALYSIS_VERSION,
  STUDY_FIRST_EVENT_MAX_VISIBLE,
  STUDY_FIRST_EVENT_PRESENTATION_VERSION,
  studyFirstEventSourceInputFingerprint,
  type StudyFirstEventBranch,
  type StudyFirstEventInvestigation,
  type StudyFirstEventPresentation,
  type StudyFirstEventRelevanceAnalysis,
  type StudyFirstEventSearchAttempt,
  type StudyFirstEventPlanStep,
} from "../core/six-screen/study-first-event-investigation";
import type {
  Screen02ConnectorFetch,
  Screen02OfficialConnectorResult,
} from "./screen02-connectors";
import {
  fetchFederalRegisterProposals,
  fetchOpenFemaDisasterProposals,
} from "./screen02-connectors";
import {
  fetchEuCellarLegalProposals,
  fetchGdacsDisasterProposals,
  fetchUkLegislationProposals,
} from "./screen02-global-connectors";
import { acquireCongressPublicLawIdentity } from
  "./screen01-congress-statute-identity";
import { proposalOccurrence } from "./screen04-coevent-execution";
import { SCREEN04_GOVINFO_MAX_HTML_BYTES,
  SCREEN04_GOVINFO_MAX_INSPECTED_DOCUMENTS,
  SCREEN04_GOVINFO_MAX_SEARCH_BYTES,
  SCREEN04_GOVINFO_MAX_SEARCH_PAGES,
  SCREEN04_GOVINFO_SEARCH_PAGE_SIZE,
  searchScreen04GovInfoPublicLaws,
  type Screen04GovInfoInspectedDocument } from
  "./screen04-govinfo-event-search";
import {
  searchScreen04RegulationsGovEvents,
  SCREEN04_REGULATIONS_GOV_MAX_RESPONSE_BYTES,
  SCREEN04_REGULATIONS_GOV_PAGE_SIZE,
} from "./screen04-regulations-gov-event-search";
import type { SixScreenSourceId } from "./six-screen-source-register";
import { searchOpenStatesBills } from "./openstates-bills";

export const STUDY_FIRST_EVENT_EXECUTOR_VERSION =
  "screen-04-study-first-multisource-executor-v8" as const;

const SOURCE_SEARCH_LIMIT = 48;
const DOCUMENT_FETCH_LIMIT = 40;
const METADATA_LIMIT = 500;
const INSPECTED_LIMIT = 60;
const SOURCE_CONCURRENCY = 3;
const MAX_CONGRESS_ENRICHMENTS_PER_GOVINFO_STEP = 1;
export const STUDY_FIRST_EVENT_SOURCE_REQUEST_TIMEOUT_MS = 18_000;
export const STUDY_FIRST_EVENT_SOURCE_LEASE_MARGIN_MS = 15_000;

export type StudyFirstEventStepResourceCaps = {
  sourceQueries: number;
  metadataRecords: number;
  documentAttempts: number;
  transportHops: number;
  receivedBytes: number;
  decodedBytes: number;
  activeResearchMs: number;
  leaseMs: number;
};

/** Exact adapter-owned admission bounds for one planned source step. */
export function studyFirstEventStepResourceCaps(
  step: StudyFirstEventPlanStep,
): StudyFirstEventStepResourceCaps {
  if (step.initialStatus === "unsupported_route" || !step.providerId) {
    return { sourceQueries: 0, metadataRecords: 0, documentAttempts: 0,
      transportHops: 0, receivedBytes: 0, decodedBytes: 0,
      activeResearchMs: 0, leaseMs: 60_000 };
  }
  if (step.providerId === "reviewed_official_documents") {
    return { sourceQueries: 0, metadataRecords: step.plannedLimit,
      documentAttempts: 0, transportHops: 0, receivedBytes: 0,
      decodedBytes: 0, activeResearchMs: 0, leaseMs: 60_000 };
  }
  if (step.providerId === "govinfo") {
    const documentAttempts = Math.min(
      SCREEN04_GOVINFO_MAX_INSPECTED_DOCUMENTS,
      step.plannedLimit,
    );
    // One exact Congress.gov enrichment may follow a GovInfo-discovered
    // public law. Congress.gov has no supported free-text law search here;
    // its three bounded reads only enrich the exact GovInfo coordinates.
    const sourceQueries = SCREEN04_GOVINFO_MAX_SEARCH_PAGES + 3;
    const transportHops = sourceQueries + documentAttempts;
    const receivedBytes = SCREEN04_GOVINFO_MAX_SEARCH_PAGES *
      SCREEN04_GOVINFO_MAX_SEARCH_BYTES +
      documentAttempts * SCREEN04_GOVINFO_MAX_HTML_BYTES +
      2 * 256 * 1024 + 2 * 1024 * 1024;
    const activeResearchMs = transportHops *
      STUDY_FIRST_EVENT_SOURCE_REQUEST_TIMEOUT_MS + 8_000;
    return { sourceQueries,
      metadataRecords: SCREEN04_GOVINFO_MAX_SEARCH_PAGES *
        SCREEN04_GOVINFO_SEARCH_PAGE_SIZE,
      documentAttempts, transportHops, receivedBytes,
      decodedBytes: receivedBytes, activeResearchMs,
      leaseMs: activeResearchMs + STUDY_FIRST_EVENT_SOURCE_LEASE_MARGIN_MS };
  }
  if (step.providerId === "regulations_gov") {
    return { sourceQueries: 1,
      metadataRecords: SCREEN04_REGULATIONS_GOV_PAGE_SIZE,
      documentAttempts: 0, transportHops: 1,
      receivedBytes: SCREEN04_REGULATIONS_GOV_MAX_RESPONSE_BYTES,
      decodedBytes: SCREEN04_REGULATIONS_GOV_MAX_RESPONSE_BYTES,
      activeResearchMs: STUDY_FIRST_EVENT_SOURCE_REQUEST_TIMEOUT_MS + 2_000,
      leaseMs: STUDY_FIRST_EVENT_SOURCE_REQUEST_TIMEOUT_MS + 2_000 +
        STUDY_FIRST_EVENT_SOURCE_LEASE_MARGIN_MS };
  }
  if (step.providerId === "openstates") {
    const sourceQueries = 3;
    const receivedBytes = sourceQueries * 2_000_000;
    const activeResearchMs = STUDY_FIRST_EVENT_SOURCE_REQUEST_TIMEOUT_MS +
      2_000;
    return { sourceQueries,
      metadataRecords: sourceQueries * 10,
      documentAttempts: 0, transportHops: sourceQueries, receivedBytes,
      decodedBytes: receivedBytes, activeResearchMs,
      leaseMs: activeResearchMs + STUDY_FIRST_EVENT_SOURCE_LEASE_MARGIN_MS };
  }
  const receivedBytes = 2_000_000;
  return { sourceQueries: 1, metadataRecords: step.plannedLimit,
    documentAttempts: 0, transportHops: 1, receivedBytes,
    decodedBytes: receivedBytes,
    activeResearchMs: STUDY_FIRST_EVENT_SOURCE_REQUEST_TIMEOUT_MS + 2_000,
    leaseMs: STUDY_FIRST_EVENT_SOURCE_REQUEST_TIMEOUT_MS + 2_000 +
      STUDY_FIRST_EVENT_SOURCE_LEASE_MARGIN_MS };
}
const US_STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas",
  CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho",
  IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas",
  KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico",
  NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia",
  WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia",
};

type Meter = {
  fetch: Screen02ConnectorFetch;
  hops: number;
  bytes: number;
  searches: number;
  documents: number;
};

type SourceBudget = { searches: number; documents: number };

function isDocumentFetch(request: RequestInfo | URL) {
  try {
    const url = new URL(String(request));
    return url.hostname === "www.govinfo.gov" &&
      url.pathname.startsWith("/content/pkg/");
  } catch {
    return false;
  }
}

function meteredFetch(fetch: Screen02ConnectorFetch,
  budget: SourceBudget): Meter {
  const meter: Meter = {
    hops: 0,
    bytes: 0,
    searches: 0,
    documents: 0,
    fetch: async (request, init) => {
      if (isDocumentFetch(request)) {
        if (budget.documents >= DOCUMENT_FETCH_LIMIT) {
          throw new Error("The bounded Screen 4 document-fetch allowance is full.");
        }
        budget.documents++;
        meter.documents++;
      } else {
        if (budget.searches >= SOURCE_SEARCH_LIMIT) {
          throw new Error("The bounded Screen 4 source-search allowance is full.");
        }
        budget.searches++;
        meter.searches++;
      }
      meter.hops += 1;
      const response = await fetch(request, init);
      if (!response.body) return response;
      const body = response.body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            meter.bytes += chunk.byteLength;
            controller.enqueue(chunk);
          },
        }),
      );
      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    },
  };
  return meter;
}

function govInfoOccurrence(
  proposal: Parameters<typeof proposalOccurrence>[1],
  document: Screen04GovInfoInspectedDocument | undefined,
  congress: Awaited<ReturnType<typeof acquireCongressPublicLawIdentity>> |
    undefined,
  recordedAt: string,
) {
  const base = proposalOccurrence("govinfo", proposal, recordedAt);
  if (!base) return null;
  const typedDates = document?.dateFacts.flatMap((fact) => {
    const sourceId = fact.role === "publication"
      ? `${proposal.id}-summary` : `${proposal.id}-original-html`;
    if (!base.evidence.some((item) => item.sourceId === sourceId)) return [];
    return [{ kind: fact.role === "publication" ? "publication" as const
      : "event" as const, value: fact.date,
      precision: "day" as const, sourceId }];
  }) ?? [];
  return createCoEventCandidateOccurrence({
    id: base.id,
    providerId: base.providerId,
    sourceNativeId: base.sourceNativeId,
    title: base.title,
    description: base.description,
    eventFamily: base.eventFamily,
    formalIdentifiers: [...new Set([
      ...base.formalIdentifiers,
      ...(congress?.status === "resolved"
        ? congress.formalIdentifiers : []),
    ])].slice(0, 20),
    typedDates: typedDates.length ? typedDates : base.typedDates,
    geography: base.geography,
    evidence: [
      ...base.evidence,
      ...(congress?.status === "resolved" && congress.source ? [{
        sourceId: `screen04-congress-${fingerprintSixScreenValue({
          packageId: base.sourceNativeId,
          nativeId: congress.source.nativeId,
          locator: congress.source.locator,
        }).slice("fnv1a64:".length)}`,
        title: congress.source.title,
        locator: congress.source.locator,
        publisher: congress.source.publisher,
        publishedDate: congress.source.publishedDate,
        authorityTier: 1 as const,
        retrievedAt: congress.source.retrievedAt,
        evidenceRole: "occurrence_metadata" as const,
        factText: congress.source.retainedText?.slice(0, 2_500) ??
          `Congress.gov bound the exact public-law coordinates to ${
            congress.formalIdentifiers.join(" and ")}.`,
      }] : []),
    ].slice(0, 12),
    recordedAt,
  });
}

async function govInfoStep(input: {
  step: StudyFirstEventPlanStep;
  meter: Meter;
  startedAt: string;
  startedMs: number;
  now: () => string;
  monotonicNow?: () => number;
  govInfoApiKey?: string;
  congressApiKey?: string;
}) {
  const result = await searchScreen04GovInfoPublicLaws({
    fetch: input.meter.fetch,
    apiKey: input.govInfoApiKey,
    query: input.step.queryTerms.join(" ") || "public law",
    startDate: input.step.occurrenceWindow.start,
    endDate: input.step.occurrenceWindow.end,
    limit: Math.min(6, input.step.plannedLimit),
    retrievedAt: input.startedAt,
    timeoutMs: STUDY_FIRST_EVENT_SOURCE_REQUEST_TIMEOUT_MS,
  });
  const completedAt = input.now();
  const completedMs = input.monotonicNow?.() ?? Date.now();
  const documents = new Map(result.inspectedDocuments.map((item) =>
    [item.packageId, item]));
  const congressByPackage = new Map<string, Awaited<ReturnType<
    typeof acquireCongressPublicLawIdentity
  >>>();
  if (input.congressApiKey) {
    for (const proposal of result.proposals.slice(
      0,
      MAX_CONGRESS_ENRICHMENTS_PER_GOVINFO_STEP,
    )) {
      const packageId = proposal.nativeIdentity?.formalIdentifier ?? "";
      if (!/^PLAW-\d{1,3}(?:publ|priv)\d{1,4}$/u.test(packageId)) continue;
      const congress = await acquireCongressPublicLawIdentity({
        packageId,
        expectedTitle: proposal.title,
        retrievedAt: input.startedAt,
        fetch: input.meter.fetch,
        apiKey: input.congressApiKey,
        timeoutMs: STUDY_FIRST_EVENT_SOURCE_REQUEST_TIMEOUT_MS,
      });
      congressByPackage.set(packageId, congress);
    }
  }
  const candidates = result.proposals.map((proposal) =>
    govInfoOccurrence(proposal,
      documents.get(proposal.nativeIdentity?.formalIdentifier ?? ""),
      congressByPackage.get(
        proposal.nativeIdentity?.formalIdentifier ?? "",
      ),
      completedAt)
  ).filter((value): value is CoEventCandidateOccurrence => Boolean(value));
  const outcome = result.status === "source_unavailable" ||
    result.diagnostics.failureKind !== "none" && !candidates.length
    ? "source_unavailable" as const
    : result.status === "not_configured"
      ? "unsupported_route" as const
      : candidates.length
        ? "candidates_found" as const
        : result.diagnostics.recordsReceived
          ? "records_unusable" as const
          : "no_match" as const;
  return {
    candidates,
    attempt: attempt({
      id: `screen4-attempt-${input.step.id.slice("screen4-step-".length)}`,
      stepId: input.step.id,
      branch: input.step.branch,
      providerId: input.step.providerId,
      queryTerms: [...input.step.queryTerms],
      occurrenceWindow: structuredClone(input.step.occurrenceWindow),
      startedAt: input.startedAt,
      completedAt,
      requestUrl: result.diagnostics.requestUrl,
      outcome,
      recordsReceived: result.diagnostics.recordsReceived,
      recordsAccepted: candidates.length,
      candidateOccurrenceIds: candidates.map(({ id }) => id),
      note: result.diagnostics.limitation,
      usage: {
        sourceQueries: input.meter.searches,
        metadataRecords: result.diagnostics.recordsReceived,
        transportHops: input.meter.hops,
        receivedBytes: input.meter.bytes,
        activeResearchMs: Math.max(0, completedMs - input.startedMs),
        documentAttempts: input.meter.documents,
      },
    }),
  };
}

async function regulationsGovStep(input: {
  step: StudyFirstEventPlanStep;
  meter: Meter;
  startedAt: string;
  startedMs: number;
  now: () => string;
  monotonicNow?: () => number;
  regulationsApiKey?: string;
}) {
  const result = await searchScreen04RegulationsGovEvents({
    fetch: input.meter.fetch,
    apiKey: input.regulationsApiKey,
    query: input.step.queryTerms.join(" ") || "business regulation",
    startDate: input.step.occurrenceWindow.start,
    endDate: input.step.occurrenceWindow.end,
    retrievedAt: input.startedAt,
    timeoutMs: STUDY_FIRST_EVENT_SOURCE_REQUEST_TIMEOUT_MS,
  });
  const completedAt = input.now();
  const completedMs = input.monotonicNow?.() ?? Date.now();
  const outcome = result.status === "source_unavailable"
    ? "source_unavailable" as const
    : result.status === "not_configured"
      ? "unsupported_route" as const
      : result.candidates.length
        ? "candidates_found" as const
        : result.diagnostics.recordsReceived
          ? "records_unusable" as const
          : "no_match" as const;
  return {
    candidates: result.candidates,
    attempt: attempt({
      id: `screen4-attempt-${input.step.id.slice("screen4-step-".length)}`,
      stepId: input.step.id,
      branch: input.step.branch,
      providerId: input.step.providerId,
      queryTerms: [...input.step.queryTerms],
      occurrenceWindow: structuredClone(input.step.occurrenceWindow),
      startedAt: input.startedAt,
      completedAt,
      requestUrl: result.diagnostics.requestUrl,
      outcome,
      recordsReceived: result.diagnostics.recordsReceived,
      recordsAccepted: result.candidates.length,
      candidateOccurrenceIds: result.candidates.map(({ id }) => id),
      note: result.diagnostics.limitation,
      usage: {
        sourceQueries: input.meter.searches,
        metadataRecords: result.diagnostics.recordsReceived,
        transportHops: input.meter.hops,
        receivedBytes: input.meter.bytes,
        activeResearchMs: Math.max(0, completedMs - input.startedMs),
        documentAttempts: input.meter.documents,
      },
    }),
  };
}

function stateCode(geography: readonly string[]) {
  return geography.find((value) =>
    /^[A-Z]{2}$/u.test(value) && value !== "US" && value !== "UK"
  );
}

function openStatesJurisdiction(
  investigation: StudyFirstEventInvestigation,
) {
  const studyValues = investigation.context.study.geography;
  const studyText = studyValues.join(" ").toLocaleLowerCase("en-US");
  // A national study must search all states. The focal policy's state is not
  // a valid substitute for the study geography when looking for confounders.
  if (/united states|\bu\.?s\.?\b|\bfederal\b/u.test(studyText)) return null;
  const values = studyValues.length
    ? studyValues
    : [investigation.context.policy.issuingJurisdiction];
  for (const value of values) {
    const trimmed = value.trim();
    const code = trimmed.toUpperCase();
    if (US_STATE_NAMES[code]) return US_STATE_NAMES[code];
    const state = Object.values(US_STATE_NAMES).find((name) =>
      name.toLocaleLowerCase("en-US") ===
        trimmed.toLocaleLowerCase("en-US")
    );
    if (state) return state;
  }
  return null;
}

async function openStatesStep(input: {
  investigation: StudyFirstEventInvestigation;
  step: StudyFirstEventPlanStep;
  meter: Meter;
  startedAt: string;
  startedMs: number;
  now: () => string;
  monotonicNow?: () => number;
  openStatesApiKey?: string;
}) {
  const result = await searchOpenStatesBills({
    fetch: input.meter.fetch,
    apiKey: input.openStatesApiKey,
    query: input.step.queryTerms.join(" "),
    jurisdiction: openStatesJurisdiction(input.investigation),
    approximateYear: String(input.investigation.context.timing.year ??
      input.step.occurrenceWindow.start.slice(0, 4)),
    retrievedAt: input.startedAt,
    limit: input.step.plannedLimit,
    timeoutMs: STUDY_FIRST_EVENT_SOURCE_REQUEST_TIMEOUT_MS,
    monotonicNow: input.monotonicNow,
  });
  const completedAt = input.now();
  const completedMs = input.monotonicNow?.() ?? Date.now();
  const candidates = result.candidates.flatMap((candidate) => {
    const dates = candidate.typedDates.filter(({ start }) =>
      start && start >= input.step.occurrenceWindow.start &&
        start <= input.step.occurrenceWindow.end
    );
    const source = candidate.identitySources.find(({ retainedText }) =>
      Boolean(retainedText?.trim())) ?? candidate.identitySources[0];
    if (!dates.length || !source) return [];
    return [createCoEventCandidateOccurrence({
      id: `coevent-openstates-${fingerprintSixScreenValue({
        candidate: candidate.id,
        step: input.step.id,
      }).slice("fnv1a64:".length)}`,
      providerId: "openstates",
      sourceNativeId: source.nativeId ?? candidate.id,
      title: candidate.officialTitle,
      description: candidate.displayedDescription,
      eventFamily: "state legislation",
      formalIdentifiers: candidate.formalIdentifiers.slice(0, 20),
      typedDates: dates.slice(0, 12).map((date) => ({
        kind: date.kind === "legal_effect"
          ? "effective" as const
          : date.kind === "publication"
            ? "publication" as const
            : "event" as const,
        value: date.start!,
        precision: date.precision === "month" || date.precision === "year"
          ? date.precision : "day" as const,
        sourceId: source.id,
      })),
      geography: {
        status: "provider_reported",
        labels: [candidate.issuingJurisdiction],
      },
      evidence: [{
        sourceId: source.id,
        title: source.title,
        locator: source.locator,
        publisher: source.publisher,
        publishedDate: source.publishedDate,
        authorityTier: 2,
        retrievedAt: source.retrievedAt,
        evidenceRole: "occurrence_metadata",
        factText: source.retainedText,
      }],
      recordedAt: completedAt,
    })];
  });
  const outcome = result.status === "source_unavailable" ||
      result.status === "not_configured"
    ? "source_unavailable" as const
    : candidates.length
      ? "candidates_found" as const
      : result.candidates.length
        ? "records_unusable" as const
        : "no_match" as const;
  return {
    attempt: attempt({
      id: `screen4-attempt-${input.step.id.slice("screen4-step-".length)}`,
      stepId: input.step.id,
      branch: input.step.branch,
      providerId: "openstates",
      queryTerms: [...input.step.queryTerms],
      occurrenceWindow: structuredClone(input.step.occurrenceWindow),
      startedAt: input.startedAt,
      completedAt,
      requestUrl: result.requestUrl,
      outcome,
      recordsReceived: result.candidates.length,
      recordsAccepted: candidates.length,
      candidateOccurrenceIds: candidates.map(({ id }) => id),
      note: result.limitation ?? (candidates.length
        ? `Open States returned ${candidates.length} state legislative occurrence${candidates.length === 1 ? "" : "s"} within the bounded study window.`
        : "The bounded Open States query returned no occurrence-ready state bill in the study window."),
      usage: {
        sourceQueries: input.meter.searches,
        metadataRecords: result.candidates.length,
        transportHops: input.meter.hops,
        receivedBytes: input.meter.bytes,
        activeResearchMs: Math.max(0, completedMs - input.startedMs),
        documentAttempts: input.meter.documents,
      },
    }),
    candidates,
  };
}

function attempt(input: Omit<StudyFirstEventSearchAttempt, "attemptFingerprint">) {
  return {
    ...input,
    attemptFingerprint: fingerprintSixScreenValue(input),
  } satisfies StudyFirstEventSearchAttempt;
}

function unsupportedAttempt(
  step: StudyFirstEventPlanStep,
  now: () => string,
  note: string,
) {
  const startedAt = now();
  const body = {
    id: `screen4-attempt-${step.id.slice("screen4-step-".length)}-unsupported`,
    stepId: step.id,
    branch: step.branch,
    providerId: step.providerId,
    queryTerms: [...step.queryTerms],
    occurrenceWindow: structuredClone(step.occurrenceWindow),
    startedAt,
    completedAt: now(),
    requestUrl: null,
    outcome: "unsupported_route" as const,
    recordsReceived: 0,
    recordsAccepted: 0,
    candidateOccurrenceIds: [],
    note,
    usage: {
      sourceQueries: 0,
      metadataRecords: 0,
      transportHops: 0,
      receivedBytes: 0,
      activeResearchMs: 0,
      documentAttempts: 0,
    },
  };
  return { attempt: attempt(body), candidates: [] as CoEventCandidateOccurrence[] };
}

/** Preserve an expired source lease as an unresolved documentary gap. This
 * deliberately does not recast an unobserved response as a no-match, an
 * unsupported route, or a known source failure. */
export function unknownStudyFirstEventStepResult(input: {
  step: StudyFirstEventPlanStep;
  startedAt: string;
  completedAt: string;
}) {
  const body = {
    id: `screen4-attempt-${input.step.id.slice("screen4-step-".length)}-unknown`,
    stepId: input.step.id,
    branch: input.step.branch,
    providerId: input.step.providerId,
    queryTerms: [...input.step.queryTerms],
    occurrenceWindow: structuredClone(input.step.occurrenceWindow),
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    requestUrl: null,
    outcome: "outcome_unknown" as const,
    recordsReceived: 0,
    recordsAccepted: 0,
    candidateOccurrenceIds: [],
    note: "The source-operation lease expired without an observed response. Its bounded reservation remains conservatively charged; this route is unresolved and was not resent.",
    usage: {
      sourceQueries: 0,
      metadataRecords: 0,
      transportHops: 0,
      receivedBytes: 0,
      activeResearchMs: 0,
      documentAttempts: 0,
    },
  };
  return {
    stepId: input.step.id,
    attempt: attempt(body),
    candidates: [] as CoEventCandidateOccurrence[],
  } satisfies StudyFirstEventStepExecutionResult;
}

function failedAttempt(
  step: StudyFirstEventPlanStep,
  startedAt: string,
  completedAt: string,
  message: string,
  meter: Meter,
) {
  const failureKind = /abort|time(?:d)? out/iu.test(message)
    ? "timeout" : /\b(?:HTTP|status)\s+[45]\d\d\b/iu.test(message)
      ? "upstream HTTP failure" : "source request failure";
  const body = {
    id: `screen4-attempt-${step.id.slice("screen4-step-".length)}-failed`,
    stepId: step.id,
    branch: step.branch,
    providerId: step.providerId,
    queryTerms: [...step.queryTerms],
    occurrenceWindow: structuredClone(step.occurrenceWindow),
    startedAt,
    completedAt,
    requestUrl: null,
    outcome: "source_unavailable" as const,
    recordsReceived: 0,
    recordsAccepted: 0,
    candidateOccurrenceIds: [],
    note: `The bounded source request stopped (${failureKind}). This is not a no-match result.`,
    usage: {
      sourceQueries: meter.searches,
      metadataRecords: 0,
      transportHops: meter.hops,
      receivedBytes: meter.bytes,
      activeResearchMs: Math.max(
        0,
        Date.parse(completedAt) - Date.parse(startedAt),
      ),
      documentAttempts: meter.documents,
    },
  };
  return { attempt: attempt(body), candidates: [] as CoEventCandidateOccurrence[] };
}

function reviewedIndexOccurrence(
  proposal: (typeof PUBLIC_SCREEN02_EVENT_INDEX_PROPOSALS)[number],
  recordedAt: string,
) {
  const base = proposalOccurrence(
    "reviewed_official_documents", {
      ...proposal,
      sources: proposal.sources.map((source) => ({
        ...source,
        retrievedAt: /^\d{4}-\d{2}-\d{2}$/u.test(source.retrievedAt ?? "")
          ? `${source.retrievedAt}T00:00:00.000Z`
          : source.retrievedAt ?? recordedAt,
      })),
    }, recordedAt,
  );
  if (!base) return null;
  const details = PUBLIC_SCREEN02_EVENT_DATE_DETAILS[proposal.id];
  const sourceIds = new Set(base.evidence.map((item) => item.sourceId));
  const typedDates = Object.values(details ?? {}).flatMap((detail) =>
    detail.sourceIds.filter((sourceId) => sourceIds.has(sourceId)).map(
      (sourceId) => ({
        kind: detail.role === "publication" ? "publication" as const
          : detail.role === "effective" || detail.role === "implementation" ||
              detail.role === "enforcement" ? "effective" as const
            : "event" as const,
        value: detail.date,
        precision: "day" as const,
        sourceId,
      }),
    )
  ).slice(0, 12);
  return createCoEventCandidateOccurrence({
    id: base.id,
    providerId: base.providerId,
    sourceNativeId: base.sourceNativeId,
    title: base.title,
    description: base.description,
    eventFamily: base.eventFamily,
    formalIdentifiers: base.formalIdentifiers,
    typedDates: typedDates.length ? typedDates : base.typedDates,
    geography: base.geography,
    evidence: base.evidence,
    recordedAt,
  });
}

function reviewedIndexStep(input: {
  investigation: StudyFirstEventInvestigation;
  step: StudyFirstEventPlanStep;
  now: () => string;
}) {
  const startedAt = input.now();
  const context = input.investigation.context;
  const studyTerms = tokens([
    context.policy.officialTitle,
    ...context.policy.aliases,
    context.study.policySideConcept,
    context.study.initialExplanation,
    context.study.population,
    context.study.analysisUnit,
    ...context.study.industry,
    context.study.outcome,
    context.study.outcomeMeasure,
    context.study.proposedTreatment,
    context.study.proposedComparison,
  ]);
  const scored = PUBLIC_SCREEN02_EVENT_INDEX_PROPOSALS.flatMap((proposal) => {
    if (proposal.mode !== "find" || proposal.kind !== "event") return [];
    const occurrence = reviewedIndexOccurrence(proposal, startedAt);
    if (!occurrence) return [];
    const assessment = fitAndPriority(occurrence, input.investigation);
    if (assessment.eligibility.status !== "qualifying") return [];
    const eventTerms = tokens([
      proposal.title, proposal.description, proposal.event.eventFamily,
      ...proposal.event.geographies,
      ...proposal.event.populations,
      ...proposal.reasons,
      ...proposal.sources.map((source) => source.evidenceText),
    ]);
    const subject = [...studyTerms].filter((word) => eventTerms.has(word));
    const priority = assessment.relevanceOrder.priorityBand === "high"
      ? 30 : assessment.relevanceOrder.priorityBand === "medium" ? 20 : 10;
    return [{ proposal, score: priority + subject.length * 2 }];
  }).sort((left, right) => right.score - left.score ||
    left.proposal.id.localeCompare(right.proposal.id))
    .slice(0, Math.min(input.step.plannedLimit, INSPECTED_LIMIT));
  const completedAt = input.now();
  const candidates = scored.map(({ proposal }) => reviewedIndexOccurrence(
    proposal, completedAt,
  )).filter((value): value is CoEventCandidateOccurrence => Boolean(value));
  const body = {
    id: `screen4-attempt-${input.step.id.slice("screen4-step-".length)}`,
    stepId: input.step.id,
    branch: input.step.branch,
    providerId: input.step.providerId,
    queryTerms: [...input.step.queryTerms],
    occurrenceWindow: structuredClone(input.step.occurrenceWindow),
    startedAt,
    completedAt,
    requestUrl: null,
    outcome: candidates.length ? "candidates_found" as const : "no_match" as const,
    recordsReceived: scored.length,
    recordsAccepted: candidates.length,
    candidateOccurrenceIds: candidates.map(({ id }) => id),
    note: `Searched the retained ${SCREEN02_PUBLIC_EVENT_INDEX_VERSION} collection, captured ${SCREEN02_PUBLIC_EVENT_INDEX_CAPTURED_AT}. ${scored.length} source-backed records passed jurisdiction, study-period, policy-family or specific population/activity/outcome/group screening; retained-source coverage is finite. Date-only source retrieval metadata is represented at the UTC day boundary. No network search or company exposure was inferred.`,
    usage: {
      sourceQueries: 0,
      metadataRecords: scored.length,
      transportHops: 0,
      receivedBytes: 0,
      activeResearchMs: 0,
      documentAttempts: 0,
    },
  };
  return { attempt: attempt(body), candidates };
}

async function executeStepInternal(input: {
  investigation: StudyFirstEventInvestigation;
  step: StudyFirstEventPlanStep;
  fetch: Screen02ConnectorFetch;
  now: () => string;
  monotonicNow?: () => number;
  sourceRegister: Record<SixScreenSourceId, SourceCapability>;
  govInfoApiKey?: string;
  congressApiKey?: string;
  regulationsApiKey?: string;
  openStatesApiKey?: string;
  requestBudget: SourceBudget;
}) {
  const step = input.step;
  if (step.initialStatus === "unsupported_route" || !step.providerId) {
    return unsupportedAttempt(
      step,
      input.now,
      step.statusNote ?? "No supported structured official-source route is available.",
    );
  }
  const capability = input.sourceRegister[step.providerId];
  if (!capability?.implemented || !capability.enabled ||
      !capability.operations.searchRecords) {
    return unsupportedAttempt(
      step,
      input.now,
      capability?.limitation ??
        "The registered source route is not enabled for this runtime.",
    );
  }
  if (step.providerId === "reviewed_official_documents") {
    return reviewedIndexStep(input);
  }
  const startedAt = input.now();
  const startedMs = input.monotonicNow?.() ?? Date.now();
  const meter = meteredFetch(input.fetch, input.requestBudget);
  const context = input.investigation.context;
  const common = {
    fetch: meter.fetch,
    retrievedAt: startedAt,
    startDate: step.occurrenceWindow.start,
    endDate: step.occurrenceWindow.end,
    population: context.study.population,
    outcomeFamily: context.study.outcome,
    limit: step.plannedLimit,
    timeoutMs: STUDY_FIRST_EVENT_SOURCE_REQUEST_TIMEOUT_MS,
  };
  if (step.providerId === "govinfo") {
    try {
      return await govInfoStep({ step, meter, startedAt, startedMs,
        now: input.now, monotonicNow: input.monotonicNow,
        govInfoApiKey: input.govInfoApiKey,
        congressApiKey:
          input.sourceRegister.congress_gov?.enabled
            ? input.congressApiKey : undefined });
    } catch (error) {
      return failedAttempt(step, startedAt, input.now(),
        error instanceof Error ? error.message : "unknown source error", meter);
    }
  }
  if (step.providerId === "regulations_gov") {
    try {
      return await regulationsGovStep({ step, meter, startedAt, startedMs,
        now: input.now, monotonicNow: input.monotonicNow,
        regulationsApiKey: input.regulationsApiKey });
    } catch (error) {
      return failedAttempt(step, startedAt, input.now(),
        error instanceof Error ? error.message : "unknown source error", meter);
    }
  }
  if (step.providerId === "openstates") {
    try {
      return await openStatesStep({
        investigation: input.investigation,
        step,
        meter,
        startedAt,
        startedMs,
        now: input.now,
        monotonicNow: input.monotonicNow,
        openStatesApiKey: input.openStatesApiKey,
      });
    } catch (error) {
      return failedAttempt(step, startedAt, input.now(),
        error instanceof Error ? error.message : "unknown source error", meter);
    }
  }
  let result: Screen02OfficialConnectorResult;
  try {
    switch (step.providerId) {
      case "federal_register":
        result = await fetchFederalRegisterProposals({
          ...common,
          query: step.queryTerms.join(" "),
          queryId: step.id,
          queryPurpose: step.question,
          documentTypes: ["RULE", "PRORULE", "NOTICE"],
          eventFamily: step.branch,
          workflowMode: "find",
        });
        break;
      case "eu_cellar":
        result = await fetchEuCellarLegalProposals({
          ...common,
          query: step.queryTerms.join(" "),
          language: "en",
          queryId: step.id,
          queryPurpose: step.question,
        });
        break;
      case "uk_legislation":
        result = await fetchUkLegislationProposals({
          ...common,
          query: step.queryTerms.join(" "),
          queryId: step.id,
          queryPurpose: step.question,
        });
        break;
      case "openfema":
        result = await fetchOpenFemaDisasterProposals({
          ...common,
          ...(stateCode(context.study.geography)
            ? { state: stateCode(context.study.geography) }
            : {}),
        });
        break;
      case "gdacs":
        result = await fetchGdacsDisasterProposals({
          ...common,
          ...(context.study.geography[0]
            ? { countryName: context.study.geography[0] }
            : {}),
          queryId: step.id,
          queryPurpose: step.question,
        });
        break;
      default:
        return unsupportedAttempt(
          step,
          input.now,
          "This planned provider has no study-first Screen 4 executor.",
        );
    }
  } catch (error) {
    return failedAttempt(
      step,
      startedAt,
      input.now(),
      error instanceof Error ? error.message : "unknown source error",
      meter,
    );
  }
  const completedAt = input.now();
  const completedMs = input.monotonicNow?.() ?? Date.now();
  const candidates = result.proposals.map((proposal) =>
    proposalOccurrence(step.providerId!, proposal, completedAt)
  ).filter((value): value is CoEventCandidateOccurrence => Boolean(value));
  const failure = result.diagnostics.failureKind;
  const outcome = failure !== "none"
    ? "source_unavailable" as const
    : candidates.length
      ? "candidates_found" as const
      : result.diagnostics.recordsReceived
        ? "records_unusable" as const
        : "no_match" as const;
  const body = {
    id: `screen4-attempt-${step.id.slice("screen4-step-".length)}`,
    stepId: step.id,
    branch: step.branch,
    providerId: step.providerId,
    queryTerms: [...step.queryTerms],
    occurrenceWindow: structuredClone(step.occurrenceWindow),
    startedAt,
    completedAt,
    requestUrl: result.diagnostics.requestUrl,
    outcome,
    recordsReceived: Math.min(
      result.diagnostics.recordsReceived,
      step.plannedLimit,
    ),
    recordsAccepted: candidates.length,
    candidateOccurrenceIds: candidates.map(({ id }) => id),
    note: result.diagnostics.channels.map(({ note }) => note).join(" ") ||
      (failure === "none"
        ? "The bounded structured-source request completed."
        : `The source route was unavailable (${failure}); this is not a no-match result.`),
    usage: {
      sourceQueries: meter.searches,
      metadataRecords: Math.min(
        result.diagnostics.recordsReceived,
        step.plannedLimit,
      ),
      transportHops: meter.hops,
      receivedBytes: meter.bytes,
      activeResearchMs: Math.max(0, completedMs - startedMs),
      documentAttempts: meter.documents,
    },
  };
  return { attempt: attempt(body), candidates };
}

export type StudyFirstEventStepExecutionResult = {
  stepId: string;
  attempt: StudyFirstEventSearchAttempt;
  candidates: CoEventCandidateOccurrence[];
};

/** Execute exactly one saved plan step. Callers persist this result before
 * asking the panel to advance another step. */
export async function executeStudyFirstEventInvestigationStep(input: {
  investigation: StudyFirstEventInvestigation;
  step: StudyFirstEventPlanStep;
  fetch: Screen02ConnectorFetch;
  now: () => string;
  monotonicNow?: () => number;
  sourceRegister: Record<SixScreenSourceId, SourceCapability>;
  govInfoApiKey?: string;
  congressApiKey?: string;
  regulationsApiKey?: string;
  openStatesApiKey?: string;
}): Promise<StudyFirstEventStepExecutionResult> {
  if (input.investigation.status !== "planned") {
    throw new Error("Only a planned study-first event investigation can execute.");
  }
  const planned = input.investigation.plan.steps.find(({ id }) =>
    id === input.step.id);
  if (!planned || fingerprintSixScreenValue(planned) !==
      fingerprintSixScreenValue(input.step)) {
    throw new Error("The Screen 4 source step is not part of the saved plan.");
  }
  const result = await executeStepInternal({
    ...input,
    requestBudget: { searches: 0, documents: 0 },
  });
  return { stepId: input.step.id, ...result };
}

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
  "in", "into", "is", "of", "on", "or", "the", "to", "u", "us",
  "with", "firms", "firm", "public", "non", "other", "proposed",
  "applicability", "organizational", "population", "provisional", "requested",
  "act", "final", "fixture", "law", "notice", "order", "policy", "regulation",
  "rule", "standard", "standards",
]);

function cleanText(value: string) {
  return value
    .replace(/<[^>]*>/gu, " ")
    .replace(/&nbsp;|&#160;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&quot;|&#34;/giu, "\"")
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/\s+/gu, " ")
    .trim();
}

function tokens(values: Array<string | null | undefined>) {
  return new Set(values.flatMap((value) =>
    cleanText(value ?? "").toLocaleLowerCase("en-US")
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
  ));
}

const LOW_INFORMATION_CONTEXT_TOKENS = new Set([
  "activity", "activities", "business", "businesses", "company",
  "companies", "entity", "entities", "organization", "organizations",
  "market", "markets", "performance", "requirement", "requirements",
  "sector", "sectors", "service", "services", "unit", "units",
]);

function meaningfulMatches(
  studyValues: Array<string | null | undefined>,
  candidateTokens: Set<string>,
) {
  return [...tokens(studyValues)].filter((token) =>
    !LOW_INFORMATION_CONTEXT_TOKENS.has(token) &&
    candidateTokens.has(token));
}

function normalizedGeography(value: string) {
  return cleanText(value).normalize("NFKC").toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\bu\s+s\b/gu, "us")
    .replace(/\bu\s+k\b/gu, "uk")
    .replace(/\s+/gu, " ").trim();
}

const COUNTRY_ALIASES = Object.freeze({
  US: ["united states", "united states of america", "usa", "us"],
  GB: ["united kingdom", "great britain", "britain", "uk"],
  EU: ["european union", "eu"],
  CA: ["canada"],
  AU: ["australia"],
  CN: ["china", "people s republic of china"],
  IN: ["india"],
  JP: ["japan"],
  MX: ["mexico"],
  BR: ["brazil"],
} as const);

const GLOBAL_GEOGRAPHY_TERMS = new Set([
  "global", "worldwide", "world", "international",
]);

const US_STATE_REGIONS = new Map<string, string>(Object.entries(
  US_STATE_NAMES,
).flatMap(([code, name]) => [
  [normalizedGeography(code), `US-${code}`],
  [normalizedGeography(name), `US-${code}`],
]));

type GeographyScope = {
  labels: string[];
  normalizedLabels: Set<string>;
  countries: Set<string>;
  regions: Set<string>;
  global: boolean;
};

function phrasePresent(value: string, phrase: string) {
  return value === phrase || value.startsWith(`${phrase} `) ||
    value.endsWith(` ${phrase}`) || value.includes(` ${phrase} `);
}

function geographyScope(labels: readonly string[]): GeographyScope {
  const normalizedLabels = new Set(labels.map(normalizedGeography)
    .filter(Boolean));
  const countries = new Set<string>();
  const regions = new Set<string>();
  let global = false;
  for (const label of normalizedLabels) {
    if ([...GLOBAL_GEOGRAPHY_TERMS].some((term) =>
      phrasePresent(label, term))) global = true;
    for (const [country, aliases] of Object.entries(COUNTRY_ALIASES)) {
      if (aliases.some((alias) => phrasePresent(label, alias))) {
        countries.add(country);
      }
    }
    for (const [state, region] of US_STATE_REGIONS) {
      if (phrasePresent(label, state)) {
        regions.add(region);
        countries.add("US");
      }
    }
  }
  return { labels: [...labels], normalizedLabels, countries, regions, global };
}

function intersects(left: Set<string>, right: Set<string>) {
  return [...left].some((value) => right.has(value));
}

function studyHasExplicitCrossBorderScope(
  investigation: StudyFirstEventInvestigation,
  candidateScope: GeographyScope,
) {
  const study = investigation.context.study;
  const studyText = normalizedGeography([
    study.population,
    study.analysisUnit,
    ...study.geography,
    ...study.industry,
    study.initialExplanation,
    study.proposedTreatment,
    study.proposedComparison,
  ].filter((value): value is string => Boolean(value)).join(" "));
  if (/\b(global|worldwide|international|multinational|cross border|foreign operations?|overseas|imports?|exports?)\b/u
    .test(studyText)) return true;
  return [...candidateScope.normalizedLabels].some((label) =>
    label.length >= 3 && phrasePresent(studyText, label));
}

function geographyCompatibility(
  investigation: StudyFirstEventInvestigation,
  candidateLabels: readonly string[],
) {
  const studyScope = geographyScope(investigation.context.study.geography);
  const candidateScope = geographyScope(candidateLabels);
  const exactLabel = intersects(
    studyScope.normalizedLabels,
    candidateScope.normalizedLabels,
  );
  const sharedCountry = intersects(studyScope.countries,
    candidateScope.countries);
  const sharedRegion = intersects(studyScope.regions, candidateScope.regions);
  const explicitCrossBorder = studyHasExplicitCrossBorderScope(
    investigation,
    candidateScope,
  );
  if (studyScope.global || candidateScope.global || exactLabel ||
      sharedCountry) {
    return {
      status: "documented" as const,
      admissible: true,
      sharedCountry,
      sharedRegion,
      studyHasSpecificRegion: studyScope.regions.size > 0,
      candidateHasSpecificRegion: candidateScope.regions.size > 0,
      explanation: exactLabel || sharedRegion
        ? "The candidate's reported geography directly overlaps the saved study geography."
        : "The candidate and saved study are within the same documented national scope.",
    };
  }
  if (studyScope.countries.size && candidateScope.countries.size) {
    if (explicitCrossBorder) {
      return {
        status: "plausible_with_condition" as const,
        admissible: true,
        sharedCountry: false,
        sharedRegion: false,
        studyHasSpecificRegion: studyScope.regions.size > 0,
        candidateHasSpecificRegion: candidateScope.regions.size > 0,
        explanation:
          "The jurisdictions differ, but the saved study explicitly describes an international or cross-border scope; unit-level transmission still requires evidence.",
      };
    }
    return {
      status: "outside_scope" as const,
      admissible: false,
      sharedCountry: false,
      sharedRegion: false,
      studyHasSpecificRegion: studyScope.regions.size > 0,
      candidateHasSpecificRegion: candidateScope.regions.size > 0,
      explanation:
        `The candidate's reported geography (${candidateLabels.join(", ")}) does not overlap the saved study geography (${investigation.context.study.geography.join(", ")}), and the saved study supplies no cross-border transmission scope.`,
    };
  }
  if (!candidateLabels.length) {
    return {
      status: "unknown" as const,
      admissible: true,
      sharedCountry: false,
      sharedRegion: false,
      studyHasSpecificRegion: studyScope.regions.size > 0,
      candidateHasSpecificRegion: false,
      explanation:
        "The source record does not provide a usable candidate geography; geographic fit remains unresolved.",
    };
  }
  return {
    status: "plausible_with_condition" as const,
    admissible: true,
    sharedCountry: false,
    sharedRegion: false,
    studyHasSpecificRegion: studyScope.regions.size > 0,
    candidateHasSpecificRegion: candidateScope.regions.size > 0,
    explanation:
      "The reported geography could not be placed in the supported jurisdiction hierarchy; a direct study link is still required.",
  };
}

const TOPIC_FAMILY_RULES = Object.freeze([
  ["privacy_and_data", /\b(privacy|data protection|personal (?:data|information)|consumer data|data security|data sharing|information privacy|ccpa|coppa)\b/iu],
  ["finance_and_credit", /\b(bank|banking|credit|lending|loan|capital requirement|interest rate|financial services?|securities|insurance|payment services?|money laundering|bankruptcy)\b/iu],
  ["energy_and_environment", /\b(energy|electric|electricity|utility|emissions?|climate|pollution|effluent|water intake|natural gas|power plant)\b/iu],
  ["labor_and_employment", /\b(labor|labour|employment|employee|worker|wage|union|occupational safety)\b/iu],
  ["measurement_and_reporting", /\b(accounting|financial reporting|reporting standard|classification system|disclosure requirement|sample frame|survey redesign)\b/iu],
  ["competition", /\b(antitrust|competition law|merger|market concentration)\b/iu],
  ["tax_and_trade", /\b(tax|subsidy|tariff|export restriction|import restriction|trade restriction)\b/iu],
  ["health_and_safety", /\b(health care|healthcare|medical|pharmaceutical|drug safety|food safety|product safety)\b/iu],
] as const);

function topicFamilies(values: Array<string | null | undefined>) {
  const text = cleanText(values.filter((value): value is string =>
    Boolean(value)).join(" "));
  return new Set(TOPIC_FAMILY_RULES.flatMap(([family, pattern]) =>
    pattern.test(text) ? [family] : []));
}

function normalizedTitle(value: string) {
  return [...tokens([value])].sort().join("-");
}

function exactNormalizedTitle(value: string) {
  return cleanText(value).normalize("NFKC").toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function substantiveDate(candidate: CoEventCandidateOccurrence) {
  return candidate.typedDates.find(({ kind }) =>
    kind === "effective" || kind === "incident_start" || kind === "event"
  )?.value ?? null;
}

function publicationDate(candidate: CoEventCandidateOccurrence) {
  return candidate.typedDates.find(({ kind }) => kind === "publication")
    ?.value ?? candidate.evidence.find(({ publishedDate }) => publishedDate)
    ?.publishedDate ?? null;
}

function eventKey(candidate: CoEventCandidateOccurrence) {
  const title = exactNormalizedTitle(candidate.title);
  const identifiers = candidate.formalIdentifiers
    .map((value) => value.toLocaleLowerCase("en-US").replace(/[^a-z0-9]/gu, ""))
    .filter(Boolean)
    .sort();
  // Structured providers commonly return the same named action once for its
  // publication record and again for its effective/event date. Treat an exact
  // substantive title as one display event and preserve every typed date and
  // source in mergeOccurrences. Distinct amendments retain distinct titles.
  if (title) {
    return [
      "titled-event",
      title,
    ].join("\u0000");
  }
  // A parent statute or docket can contain several genuinely different
  // unnamed actions. Keep date and identifier coordinates for those records.
  if (identifiers.length) {
    return [
      "identified-event",
      substantiveDate(candidate) ?? publicationDate(candidate) ?? "undated",
      identifiers.join("+"),
    ].join("\u0000");
  }
  return [
    "event",
    substantiveDate(candidate) ?? publicationDate(candidate) ?? "undated",
  ].join("\u0000");
}

function mergeOccurrences(
  left: CoEventCandidateOccurrence,
  right: CoEventCandidateOccurrence,
) {
  const evidence = [...left.evidence, ...right.evidence].filter(
    (value, index, values) => values.findIndex(({ sourceId }) =>
      sourceId === value.sourceId) === index,
  ).slice(0, 12);
  const retainedSourceIds = new Set(evidence.map(({ sourceId }) => sourceId));
  const datePriority: Record<CoEventCandidateOccurrence["typedDates"][number]["kind"], number> = {
    effective: 0,
    incident_start: 0,
    event: 0,
    publication: 2,
  };
  const typedDates = [...left.typedDates, ...right.typedDates].filter(
    (value, index, values) => values.findIndex((candidate) =>
      candidate.kind === value.kind && candidate.value === value.value &&
      candidate.sourceId === value.sourceId) === index &&
      retainedSourceIds.has(value.sourceId),
  ).sort((a, b) => datePriority[a.kind] - datePriority[b.kind] ||
    a.value.localeCompare(b.value) || a.sourceId.localeCompare(b.sourceId))
    .slice(0, 12);
  return createCoEventCandidateOccurrence({
    id: left.id,
    providerId: left.providerId,
    sourceNativeId: left.sourceNativeId,
    title: cleanText(left.title),
    description: cleanText(
      left.description.length >= right.description.length
        ? left.description
        : right.description,
    ),
    eventFamily: left.eventFamily,
    formalIdentifiers: [...new Set([
      ...left.formalIdentifiers,
      ...right.formalIdentifiers,
    ])].slice(0, 20),
    typedDates,
    geography: left.geography.labels.length
      ? left.geography
      : right.geography,
    evidence,
    recordedAt: left.recordedAt <= right.recordedAt
      ? left.recordedAt
      : right.recordedAt,
  });
}

function normalizedIdentity(value: string) {
  return cleanText(value).toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function focalRelationshipEvidence(
  candidate: CoEventCandidateOccurrence,
  investigation: StudyFirstEventInvestigation,
) {
  const policy = investigation.context.policy;
  const identities = [...new Set([
    policy.officialTitle,
    ...policy.aliases,
    ...policy.formalIdentifiers,
  ].map(normalizedIdentity).filter((value) =>
    value.length >= 4 && (value.includes(" ") || /\d/u.test(value))
  ))];
  const segments = [
    candidate.title,
    candidate.description,
    ...candidate.evidence.map(({ factText }) => factText ?? ""),
  ].flatMap((value) => cleanText(value).split(/(?<=[.!?;])\s+|\n+/u))
    .map(normalizedIdentity).filter(Boolean);
  const action = /\b(?:amends?|amended|amending|implements?|implementing|implementation of|delays?|postpones?|enforces?|enforcement of|adjudicates?|invalidates?|repeals?|supersedes?|modifies?|revises?)\b/iu;
  const incidentalCompliance = /\b(?:applicable laws?|privacy policy|compliance (?:with|including)|including (?:the )?california consumer privacy act|such as)\b/iu;
  for (const segment of segments) {
    const target = identities.find((identity) => segment.includes(identity));
    if (target && action.test(segment) && !incidentalCompliance.test(segment)) {
      return {
        status: "source_linked" as const,
        targetInstrument: target,
        sourceIds: candidate.evidence.map(({ sourceId }) => sourceId),
        explanation:
          "The same source passage names the focal instrument and an operative action on it.",
      };
    }
  }
  const focalIdentifiers = new Set(
    policy.formalIdentifiers.map(normalizedIdentity).filter(Boolean),
  );
  const sharedIdentifier = candidate.formalIdentifiers.map(normalizedIdentity)
    .find((value) => focalIdentifiers.has(value));
  if (sharedIdentifier && segments.some((segment) => action.test(segment))) {
    return {
      status: "source_linked" as const,
      targetInstrument: sharedIdentifier,
      sourceIds: candidate.evidence.map(({ sourceId }) => sourceId),
      explanation:
        "The record carries the focal formal identifier and documents an operative action.",
    };
  }
  return {
    status: "not_established" as const,
    targetInstrument: null,
    sourceIds: [] as string[],
    explanation:
      "No inspected source passage both identifies the focal instrument and documents an action on it. Shared legal or privacy vocabulary is only a discovery signal.",
  };
}

function explicitRelationship(
  candidate: CoEventCandidateOccurrence,
  investigation: StudyFirstEventInvestigation,
) {
  const text = cleanText(`${candidate.title} ${candidate.description} ${candidate.evidence.map(({ factText }) => factText ?? "").join(" ")}`)
    .toLocaleLowerCase("en-US");
  if (focalRelationshipEvidence(candidate, investigation).status ===
      "source_linked") {
    return "related_policy_stage" as const;
  }
  if (/\b(reporting standard|accounting standard|classification system|survey redesign|measurement method|sample frame)\b/u.test(text)) {
    return "measurement_or_sample_change" as const;
  }
  if (/\b(spillover|interstate|supply chain|cross-border|cross border)\b/u.test(text)) {
    return "comparison_exposure_or_spillover" as const;
  }
  if (/\b(response to|because of|following implementation|compliance response)\b/u.test(text)) {
    return "possible_downstream_response" as const;
  }
  if (/\b(disaster|pandemic|flood|storm|wildfire|hurricane|earthquake|recession|strike|shortage)\b/u.test(text)) {
    return "potential_independent_event" as const;
  }
  if (/\b(lending|credit|tariff|subsidy|tax credit|interest rate|bankruptcy|recall|export restriction|import restriction|price cap)\b/u.test(text)) {
    return "potential_independent_event" as const;
  }
  // A Privacy Act "System of Records" notice can mention privacy law while
  // only announcing a records system; it does not enact the named statute.
  if (/\bsystem of records\b/iu.test(candidate.title)) {
    return "uncertain" as const;
  }
  if (/\b(statute|legislation|law|regulation)\b/u.test(
    candidate.eventFamily.toLocaleLowerCase("en-US")) &&
    /\b(requir(?:e|es|ed|ing)|enact(?:s|ed|ing)?|prohibit(?:s|ed|ing)?|mandat(?:e|es|ed|ing)|chang(?:e|es|ed|ing)|establish(?:es|ed|ing)?|adopt(?:s|ed|ing)?|revis(?:e|es|ed|ing))\b/u
      .test(text)) {
    return "potential_independent_event" as const;
  }
  return "uncertain" as const;
}

function documentEventDistinction(candidate: CoEventCandidateOccurrence) {
  const text = cleanText(`${candidate.title} ${candidate.description}`)
    .toLocaleLowerCase("en-US");
  const published = publicationDate(candidate);
  const occurred = substantiveDate(candidate);
  const incident = candidate.typedDates.some(({ kind }) =>
    kind === "incident_start");
  const enactment = candidate.providerId === "govinfo" &&
    candidate.eventFamily === "Federal statute";
  const report = /\b(annual report|report to congress|information release|statistical release)\b/u
    .test(text);
  const documentRole = incident
    ? "incident_record" as const
    : report
      ? "report_or_information_release" as const
      : /\b(rule|regulation|notice|order|decision|act|standard)\b/u.test(text)
        ? "official_rule_or_notice" as const
        : "unresolved" as const;
  // Publication and effectiveness can be independently supported roles even
  // when they share a calendar date. Never erase a genuine role merely
  // because its normalized value equals publication.
  const substantiveOccurrenceDate = occurred;
  const dateRoleStatus = published && substantiveOccurrenceDate
    ? published === substantiveOccurrenceDate
      ? "separate_roles_same_date" as const
      : "distinct_dates_documented" as const
    : published
      ? "publication_only" as const
      : substantiveOccurrenceDate
        ? "occurrence_only" as const
        : "unresolved" as const;
  const explanation = report && !substantiveOccurrenceDate
    ? `The source documents publication${published ? ` on ${published}` : ""}; it does not establish that a new substantive change occurred on that date.`
    : published && substantiveOccurrenceDate
      ? published === substantiveOccurrenceDate
        ? `The source separately supports publication and ${enactment
          ? "inspected enactment/approval" : "substantive occurrence"} on ${published}; the two date roles share a calendar date.`
        : `The source distinguishes publication on ${published} from the recorded substantive date ${substantiveOccurrenceDate}.`
      : substantiveOccurrenceDate
        ? `The source records ${enactment ? "enactment/approval" :
          "a substantive occurrence"} on ${substantiveOccurrenceDate}.`
        : "The available structured fields do not establish a distinct substantive occurrence date.";
  return {
    documentRole,
    publicationDate: published,
    substantiveOccurrenceDate,
    dateRoleStatus,
    explanation,
  };
}

function fitAndPriority(
  candidate: CoEventCandidateOccurrence,
  investigation: StudyFirstEventInvestigation,
) {
  const context = investigation.context;
  const candidateValues = [
    candidate.title,
    candidate.description,
    candidate.eventFamily,
    ...candidate.geography.labels,
    ...candidate.evidence.map(({ factText }) => factText),
  ];
  const candidateTokens = tokens(candidateValues);
  const matches = (values: Array<string | null | undefined>) =>
    meaningfulMatches(values, candidateTokens);
  const policyMatches = matches([
    context.policy.officialTitle,
    ...context.policy.aliases,
    ...context.policy.formalIdentifiers,
  ]);
  const industryMatches = matches(context.study.industry);
  const populationMatches = matches([context.study.population]);
  const outcomeMatches = matches([
    context.study.outcome,
    context.study.outcomeMeasure,
  ]);
  const constructMatches = matches([context.study.policySideConcept]);
  const mechanismMatches = matches([context.study.initialExplanation]);
  const groupMatches = matches([
    context.study.proposedTreatment,
    context.study.proposedComparison,
  ]);
  const analysisLevelMatches = matches([context.study.analysisUnit]);
  const geography = geographyCompatibility(
    investigation,
    candidate.geography.labels,
  );
  const studyTopicFamilies = topicFamilies([
    context.policy.officialTitle,
    ...context.policy.aliases,
    context.study.policySideConcept,
    context.study.initialExplanation,
  ]);
  const candidateTopicFamilies = topicFamilies(candidateValues);
  const sharedTopicFamilies = [...studyTopicFamilies].filter((family) =>
    candidateTopicFamilies.has(family));
  const generalPolicyInstrument =
    /\b(act|code|law|legislation|regulation|rule|standard|statute|amendment)\b/iu
      .test(candidate.title) &&
    !/\b(complaint|agreements?|settlement|final order|individual order)\b/iu
      .test(candidate.title);
  const date = substantiveDate(candidate) ?? publicationDate(candidate);
  const inWindow = Boolean(date && date.slice(0, 10) >=
    context.effectiveScope.occurrenceStart && date.slice(0, 10) <=
    context.effectiveScope.occurrenceEnd);
  const preWindowPersistence = Boolean(date &&
    date.slice(0, 10) < context.effectiveScope.occurrenceStart &&
    Number(context.effectiveScope.occurrenceStart.slice(0, 4)) -
      Number(date.slice(0, 4)) <= 3 &&
    /\b(ongoing|continued|continues|through \d{4}|multi.year|phased implementation)\b/iu
      .test([candidate.description, ...candidate.evidence.map(
        ({ factText }) => factText ?? "")].join(" ")));
  const temporallyRelevant = inWindow || preWindowPersistence;
  const timingYear = context.timing.mode === "year" ? context.timing.year : null;
  const yearDistance = date && timingYear
    ? Math.abs(Number(date.slice(0, 4)) - timingYear)
    : null;
  const relationship = explicitRelationship(candidate, investigation);
  const relationshipEvidence = focalRelationshipEvidence(
    candidate,
    investigation,
  );
  const exactFocalRecord = normalizedIdentity(candidate.title) ===
      normalizedIdentity(context.policy.officialTitle) ||
    candidate.formalIdentifiers.some((identifier) =>
      context.policy.formalIdentifiers.some((formal) =>
        normalizedIdentity(formal) === normalizedIdentity(identifier)));
  const distinction = documentEventDistinction(candidate);
  const substantiveMatches = [
    policyMatches.length,
    constructMatches.length,
    mechanismMatches.length,
    industryMatches.length,
    populationMatches.length,
    outcomeMatches.length,
    groupMatches.length,
    analysisLevelMatches.length,
    sharedTopicFamilies.length,
  ].filter(Boolean).length;
  const factualEvent = distinction.substantiveOccurrenceDate !== null ||
    distinction.documentRole === "incident_record";
  const reportOnly = distinction.documentRole ===
    "report_or_information_release" && !factualEvent;
  const activityRouteMatches = industryMatches.length +
    populationMatches.length + analysisLevelMatches.length;
  const studyRouteMatches = activityRouteMatches + outcomeMatches.length +
    groupMatches.length + mechanismMatches.length;
  const policyFamilyRoute = sharedTopicFamilies.length > 0 &&
    (generalPolicyInstrument || studyRouteMatches > 0);
  const strongLexicalPolicyRoute = policyMatches.length +
    constructMatches.length >= 2;
  const disruption = candidate.eventFamily === "disaster_or_disruption" ||
    /\b(disaster|flood|storm|wildfire|hurricane|earthquake)\b/iu.test(
      candidate.title);
  const disruptionGeography = geography.sharedRegion ||
    geography.sharedCountry && !geography.studyHasSpecificRegion;
  const qualifying = geography.admissible && factualEvent &&
    temporallyRelevant && !exactFocalRecord && (
    relationshipEvidence.status === "source_linked" ||
    (relationship === "potential_independent_event" &&
      (policyFamilyRoute || strongLexicalPolicyRoute ||
        activityRouteMatches > 0 || outcomeMatches.length > 0 ||
        groupMatches.length > 0 || mechanismMatches.length > 0 ||
        (disruption && disruptionGeography))) ||
    (relationship === "measurement_or_sample_change" &&
      (outcomeMatches.length > 0 || populationMatches.length > 0 ||
        analysisLevelMatches.length > 0)) ||
    ((relationship === "comparison_exposure_or_spillover" ||
      relationship === "possible_downstream_response") &&
      (studyRouteMatches > 0 || policyFamilyRoute))
  );
  const background = geography.admissible && !qualifying && (
    policyMatches.length > 0 || industryMatches.length > 0 ||
    outcomeMatches.length > 0 || groupMatches.length > 0 ||
    constructMatches.length > 0 || populationMatches.length > 0 ||
    mechanismMatches.length > 0 || sharedTopicFamilies.length > 0
  );
  const evidenceBasis = [
    ...(policyMatches.length ? [`Policy identity overlap: ${policyMatches.join(", ")}.`] : []),
    ...(constructMatches.length ? [`Shock-construct overlap: ${constructMatches.join(", ")}.`] : []),
    ...(mechanismMatches.length ? [
      `Proposed-pathway overlap: ${mechanismMatches.join(", ")}.`,
    ] : []),
    ...(sharedTopicFamilies.length ? [
      `Policy-family overlap: ${sharedTopicFamilies.join(", ")}.`,
    ] : []),
    ...(industryMatches.length ? [`Industry/activity overlap: ${industryMatches.join(", ")}.`] : []),
    ...(populationMatches.length ? [`Population wording overlap: ${populationMatches.join(", ")}.`] : []),
    ...(analysisLevelMatches.length ? [`Analysis-unit overlap: ${analysisLevelMatches.join(", ")}.`] : []),
    ...(["documented", "plausible_with_condition"].includes(geography.status)
      ? [`Geographic fit: ${geography.explanation}`]
      : []),
    ...(outcomeMatches.length ? [`Outcome/measure overlap: ${outcomeMatches.join(", ")}.`] : []),
    ...(groupMatches.length ? [`Group-label overlap: ${groupMatches.join(", ")}.`] : []),
    ...(inWindow ? ["The documented date is inside the proposed study window."] : []),
    ...(preWindowPersistence ? [
      "The source describes a continuing or phased condition reaching the study period; the unit-level route needs verification.",
    ] : []),
    ...(factualEvent ? ["A substantive or incident date is separately documented."] : []),
  ];
  const priorityBand = qualifying && (sharedTopicFamilies.length > 0 ||
      substantiveMatches >= 2 || (yearDistance !== null && yearDistance <= 1))
    ? "high" as const
    : qualifying
      ? "medium" as const
      : background
        ? "low" as const
        : "background" as const;
  const eligibility = qualifying
    ? {
        status: "qualifying" as const,
        reason:
          relationshipEvidence.status === "source_linked"
            ? "The source documents an operative action on the exact focal instrument within the study window."
            : "The source documents a relevant event or continuing condition and a concrete activity, geography, group, measurement, or outcome route that warrants study-specific inspection.",
      }
    : background
      ? {
          status: "background_lead" as const,
          reason: reportOnly
            ? "The document is a related report or release, but the available fields do not establish a new substantive change."
            : exactFocalRecord
              ? "This source describes the focal instrument itself, not a separate event or documented later stage."
            : "The record shares study concepts, but a supported occurrence or concrete study pathway remains unresolved.",
        }
      : {
          status: "excluded" as const,
          reason: !geography.admissible
            ? geography.explanation
            : !temporallyRelevant
              ? "The available record does not place a substantive or continuing event inside the saved study period."
              : "The available record does not supply a policy-family or specific population, activity, industry, outcome, group, or disruption route for main-list inspection.",
        };
  const bandOrder = { high: "0", medium: "1", low: "2", background: "3" };
  const distanceOrder = yearDistance === null
    ? "9999"
    : String(Math.min(yearDistance, 9999)).padStart(4, "0");
  return {
    relationship,
    relationshipEvidence,
    distinction,
    eligibility,
    dimensionalFit: {
      populationOrActivity: populationMatches.length || industryMatches.length
        ? "plausible_with_condition" as const
        : "unknown" as const,
      analysisLevel: analysisLevelMatches.length
        ? "plausible_with_condition" as const
        : "unknown" as const,
      geography: geography.status,
      industry: industryMatches.length
        ? "plausible_with_condition" as const
        : "unknown" as const,
      temporalContrast: temporallyRelevant
        ? "plausible_with_condition" as const
        : date
          ? "outside_scope" as const
          : "unknown" as const,
      outcomeOrMeasure: outcomeMatches.length
        ? "plausible_with_condition" as const
        : "unknown" as const,
      groupDifferential: groupMatches.length
        ? "plausible_with_condition" as const
        : "unknown" as const,
    },
    relevanceOrder: {
      priorityBand,
      evidenceBasis,
      stableSortKey: [
        bandOrder[priorityBand],
        String(9 - Math.min(substantiveMatches, 9)),
        distanceOrder,
        normalizedTitle(candidate.title),
        candidate.id,
      ].join(":"),
    },
  };
}

function pathway(
  relationship: ReturnType<typeof explicitRelationship>,
  candidate: CoEventCandidateOccurrence,
  investigation: StudyFirstEventInvestigation,
) {
  const context = investigation.context;
  const actor = cleanText(candidate.evidence[0]?.publisher ?? "The documented actor");
  const activity = cleanText(candidate.title);
  const text = cleanText(`${candidate.title} ${candidate.description}`)
    .toLocaleLowerCase("en-US");
  const outcome = context.study.outcomeMeasure ?? context.study.outcome;
  const sample = context.study.population;
  const geography = candidate.geography.labels.join(", ") ||
    context.study.geography.join(", ") || "the documented area";
  switch (relationship) {
    case "measurement_or_sample_change":
      return `${actor}'s documented change could alter reporting, classification, coverage, or sample composition. If the saved ${outcome} series or the membership of ${sample} uses the affected definition, the observed outcome could change without a corresponding change in underlying organizational performance.`;
    case "potential_independent_event":
      if (/\b(lending|credit|interest|loan|financ|bankruptcy)\b/u.test(text)) {
        return `If sampled firms borrow under, lend into, or depend on markets covered by ${activity}, the documented financing change could alter funding access or cost, then investment or liquidity, and ultimately ${outcome}. That borrowing-market link is a hypothesis, not measured exposure.`;
      }
      if (/\b(disaster|pandemic|flood|storm|wildfire|hurricane|earthquake|strike|shortage)\b/u.test(text)) {
        return `If ${sample} has facilities, suppliers, distribution routes, or customer markets exposed in ${geography}, ${activity} could disrupt production or demand and thereby change ${outcome}. The source documents the event, not which sampled firms experienced that route.`;
      }
      return `If ${activity} reaches an input, product market, customer group, or operating activity used by ${sample}, firms may adjust costs, output, or demand in ways that change ${outcome}. The specific affected activity still has to be linked to the sample.`;
    case "related_policy_stage":
      return `The source-linked action on ${context.policy.officialTitle} may alter the content or timing of the focal treatment itself. It should therefore be reconciled with the saved policy episode before it is treated as an independent event; any route to ${outcome} depends on the operative duty or timing that changed.`;
    case "comparison_exposure_or_spillover":
      return `${activity} could reach a proposed group through a documented cross-border, market, or supply relationship. It matters for ${outcome} only if that route reaches sampled activity and exposure or response differs across the proposed groups.`;
    case "possible_downstream_response":
      return `${activity} may be a response to the focal policy rather than a separate cause. If the response changes ${outcome}, it may form part of the treatment pathway or modify the policy effect; treating it as an ordinary pre-treatment control would require a different argument.`;
    default:
      return `${activity} is documented, but the available record does not establish the intermediate process connecting it to ${outcome}.`;
  }
}

function relevanceArgument(input: {
  relationship: ReturnType<typeof explicitRelationship>;
  relationshipEvidence: ReturnType<typeof focalRelationshipEvidence>;
  candidate: CoEventCandidateOccurrence;
  investigation: StudyFirstEventInvestigation;
  qualifying: boolean;
}) {
  if (!input.qualifying) {
    return `${input.candidate.title} is retained only as a discovery lead. ${input.relationshipEvidence.explanation}`;
  }
  const timing = temporalInterpretation(input.candidate, input.investigation);
  if (input.relationship === "related_policy_stage") {
    return `${input.relationshipEvidence.explanation} This can change how the focal intervention and its treatment clock should be defined. ${timing}`;
  }
  return `${input.candidate.title} is a documented event with a plausible route to the saved population or comparison. ${timing}`;
}

function targetedChecks(
  relationship: ReturnType<typeof explicitRelationship>,
  candidate: CoEventCandidateOccurrence,
  investigation: StudyFirstEventInvestigation,
) {
  const groups = investigation.context.groupsPresent
    ? `${investigation.context.study.proposedTreatment} and ${investigation.context.study.proposedComparison}`
    : "the proposed study units";
  if (relationship === "related_policy_stage") {
    return [
      `Verify the cited provision and whether this action changes, implements, delays, enforces, or adjudicates the saved ${investigation.context.policy.episode} episode.`,
      "Decide whether the action belongs inside the treatment package or changes the proposed treatment clock before treating it as a separate event.",
    ];
  }
  if (relationship === "measurement_or_sample_change") {
    return [
      `Check whether the affected reporting or classification rule is used to construct ${investigation.context.study.outcomeMeasure ?? investigation.context.study.outcome} or the saved sample.`,
      "Compare definitions and coverage on both sides of the event date before interpreting an outcome change as substantive.",
    ];
  }
  if (relationship === "potential_independent_event") {
    return [
      `Map dated operational, market, or financing exposure to ${groups}; headquarters or broad geography alone is insufficient.`,
      `Check whether that exposure could alter the untreated ${investigation.context.study.outcome} path during the proposed contrast.`,
    ];
  }
  return [
    `Verify the affected actor and activity in the linked record for ${candidate.title}.`,
    `Establish a concrete route to ${groups} and ${investigation.context.study.outcome} before assigning a causal role.`,
  ];
}

function temporalInterpretation(
  candidate: CoEventCandidateOccurrence,
  investigation: StudyFirstEventInvestigation,
) {
  const occurred = substantiveDate(candidate);
  const published = publicationDate(candidate);
  const date = occurred ?? published;
  if (!date) {
    return "The structured occurrence record has no usable event date; temporal overlap with the proposed study remains unresolved.";
  }
  const start = investigation.context.effectiveScope.occurrenceStart;
  const end = investigation.context.effectiveScope.occurrenceEnd;
  const inside = date.slice(0, 10) >= start && date.slice(0, 10) <= end;
  const timing = investigation.context.timing.mode === "year"
    ? `the researcher-proposed ${investigation.context.timing.year} treatment year`
    : investigation.context.timing.mode === "varies_by_group"
      ? "the unresolved group-specific treatment dates"
      : "an unresolved treatment boundary";
  const role = occurred
    ? "substantive/incident date"
    : "publication date only";
  return inside
    ? `The source records ${date} (${role}) within the proposed ${start}–${end} window. Its position relative to ${timing}, anticipation, fiscal aggregation, and any persistent exposure still requires study-specific assessment.`
    : `The source records ${date} (${role}) outside the proposed ${start}–${end} window. A later implementation, anticipation, baseline-comparability role, or persistent effect would require separate support and is not assumed.`;
}

function analyzeEvent(input: {
  candidate: CoEventCandidateOccurrence;
  branches: StudyFirstEventBranch[];
  investigation: StudyFirstEventInvestigation;
}) {
  const context = input.investigation.context;
  const assessment = fitAndPriority(input.candidate, input.investigation);
  const treatment = context.study.proposedTreatment;
  const comparison = context.study.proposedComparison;
  const sourceRefs = input.candidate.evidence.map(({ sourceId }) => sourceId);
  const actor = cleanText(
    input.candidate.evidence[0]?.publisher ?? "The documented actor",
  );
  const activity = cleanText(input.candidate.title);
  const comparisonImplication = context.groupsPresent
    ? assessment.relationship === "related_policy_stage"
      ? `This action belongs to the focal-policy lifecycle if the cited link is confirmed. Its main implication is then treatment-definition or timing ambiguity, not an automatic independent confounder. Compare the operative stage used for both “${treatment}” and “${comparison}.”`
      : assessment.relationship === "measurement_or_sample_change"
        ? `The proposed “${treatment}” versus “${comparison}” contrast can be distorted if the documented definition, coverage, or reporting change affects measured ${context.study.outcome} or sample inclusion differently across the groups. No such differential has been calculated.`
        : `For the proposed “${treatment}” versus “${comparison}” contrast, this event can affect the untreated ${context.study.outcome} path only if operational exposure or response differs across the groups. A shared date, national scope, or headquarters label alone does not establish that difference.`
    : "No complete affected/comparison pair is supplied. The event can be retained as context, but a differential comparison implication cannot be assessed.";
  const pathwayText = pathway(
    assessment.relationship,
    input.candidate,
    input.investigation,
  );
  const whyRelevant = relevanceArgument({
    relationship: assessment.relationship,
    relationshipEvidence: assessment.relationshipEvidence,
    candidate: input.candidate,
    investigation: input.investigation,
    qualifying: assessment.eligibility.status === "qualifying",
  });
  const nextChecks = targetedChecks(
    assessment.relationship,
    input.candidate,
    input.investigation,
  );
  const body = {
    schemaVersion: STUDY_FIRST_EVENT_ANALYSIS_VERSION,
    eventId: input.candidate.id,
    branchRoles: [...input.branches],
    interpretationMode: "bounded_evidence_rules" as const,
    relationshipType: assessment.relationship,
    relationshipStatus: "hypothetical" as const,
    eligibility: assessment.eligibility,
    documentEventDistinction: assessment.distinction,
    dimensionalFit: assessment.dimensionalFit,
    relevanceOrder: assessment.relevanceOrder,
    relationshipEvidence: assessment.relationshipEvidence,
    affectedActorOrActivity: `${actor}: ${activity}`,
    materialUncertainty: assessment.relationship === "related_policy_stage"
      ? "The documentary link does not by itself establish which treatment definition or date is appropriate for this study."
      : "The event is documented, but unit-level exposure and any differential outcome response have not been established.",
    whatHappened: `${cleanText(input.candidate.title)}. ${cleanText(input.candidate.description)}`,
    documentedFactRefs: sourceRefs,
    whyRelevant,
    outcomePathway: pathwayText,
    comparisonImplication,
    temporalInterpretation: temporalInterpretation(
      input.candidate,
      input.investigation,
    ),
    causalChain: assessment.eligibility.status === "qualifying"
      ? [
          {
            from: actor,
            to: activity,
            status: "source_documented" as const,
            factRefs: sourceRefs,
            assumption: null,
          },
          {
            from: activity,
            to: "A study-relevant intermediate response",
            status: "analyst_hypothesis" as const,
            factRefs: [],
            assumption:
              "The documented change reaches an activity represented in the saved sample.",
          },
          {
            from: "The hypothesized intermediate response",
            to: context.study.outcomeMeasure ?? context.study.outcome,
            status: "unresolved" as const,
            factRefs: [],
            assumption:
              `The intermediate response is linked to ${context.study.outcome} at the ${context.study.analysisUnit ?? "saved analysis"} level.`,
          },
        ]
      : [],
    requiredExposureAssumptions: assessment.eligibility.status === "qualifying"
      ? [
          "The event reaches units represented in the proposed sample rather than only the named geography or sector in the source record.",
          "The event's relevant exposure timing overlaps the study contrast after accounting for anticipation and persistence.",
          context.groupsPresent
            ? "Exposure or response differs across the proposed groups in a way relevant to their counterfactual outcome paths."
            : "A defensible comparison and its exposure mapping are supplied before differential implications are claimed.",
        ]
      : [],
    directionStatus: "unknown" as const,
    uncertainties: [
      "No dataset was uploaded, so unit-level exposure, overlap, response, trends, or effect magnitude were not calculated.",
      assessment.relationshipEvidence.explanation,
    ],
    nextChecks,
    executionProvenance: {
      libraryVersion: STUDY_FIRST_EVENT_ANALYSIS_VERSION,
      semanticRouteStatus: "bounded_rules_completed" as const,
    },
  };
  const analysisFingerprint = fingerprintSixScreenValue(body);
  return {
    ...body,
    id: `screen4-analysis-${analysisFingerprint.slice("fnv1a64:".length)}`,
    analysisFingerprint,
  } satisfies StudyFirstEventRelevanceAnalysis;
}

function presentation(input: {
  investigation: StudyFirstEventInvestigation;
  attempts: StudyFirstEventSearchAttempt[];
  occurrences: CoEventCandidateOccurrence[];
  analyses: StudyFirstEventRelevanceAnalysis[];
  completedAt: string;
  omittedMetadataCandidates: number;
}): StudyFirstEventPresentation {
  const completed = input.attempts.filter(({ outcome }) =>
    outcome === "candidates_found" || outcome === "no_match" ||
    outcome === "records_unusable");
  const unsupported = input.attempts.filter(({ outcome }) =>
    outcome === "unsupported_route");
  const failed = input.attempts.filter(({ outcome }) =>
    outcome === "source_unavailable");
  const unknown = input.attempts.filter(({ outcome }) =>
    outcome === "outcome_unknown");
  const allFailed = completed.length === 0;
  const partial = !allFailed && (unsupported.length > 0 || failed.length > 0 ||
    unknown.length > 0);
  const analysisByEventId = new Map(
    input.analyses.map((analysis) => [analysis.eventId, analysis]),
  );
  const qualifying = input.occurrences.filter(({ id }) =>
    analysisByEventId.get(id)?.eligibility.status === "qualifying"
  );
  const visibleEventIds = qualifying.slice(0, STUDY_FIRST_EVENT_MAX_VISIBLE)
    .map(({ id }) => id);
  const body = {
    schemaVersion: STUDY_FIRST_EVENT_PRESENTATION_VERSION,
    status: allFailed
      ? "scan_failed" as const
      : partial
        ? "completed_partial" as const
        : visibleEventIds.length
          ? "events_available" as const
          : "completed_zero_events" as const,
    visibleEventIds,
    overflowEventIds: qualifying.slice(STUDY_FIRST_EVENT_MAX_VISIBLE)
      .map(({ id }) => id),
    coverage: {
      attemptedBranches: input.attempts.map(({ branch }) => branch),
      completedBranches: completed.map(({ branch }) => branch),
      unsupportedBranches: unsupported.map(({ branch }) => branch),
      failedBranches: failed.map(({ branch }) => branch),
      unknownBranches: unknown.map(({ branch }) => branch),
      sourceRoutesAttempted: input.attempts.filter(({ outcome }) =>
        outcome !== "unsupported_route").length,
      sourceRoutesSucceeded: completed.length,
      interpretation: "evidence_bounded" as const,
      semanticAssessment: visibleEventIds.length
        ? "pending_host_assessment" as const
        : "unavailable" as const,
      phases: {
        retrieval: allFailed ? "failed" as const : partial
          ? "partial" as const
          : "complete" as const,
        inspection: allFailed ? "failed" as const : partial
          ? "partial" as const
          : "complete" as const,
        screening: allFailed ? "failed" as const : "complete" as const,
        synthesis: visibleEventIds.length
          ? "pending" as const
          : "unavailable" as const,
        validation: visibleEventIds.length
          ? "pending" as const
          : "unavailable" as const,
        presentation: allFailed ? "failed" as const : "complete" as const,
      },
      limitation: (allFailed
        ? "No planned structured source route completed successfully. This is a scan failure, not evidence of zero relevant events."
        : partial
          ? `${completed.length} of ${input.attempts.length} planned branch routes completed. Documented occurrences remain usable; ${unknown.length ? `${unknown.length} source outcome(s) remain unknown and were not resent; ` : ""}missing branches and study-specific implications remain unresolved.`
          : visibleEventIds.length
            ? "All planned branch routes completed. Main-list events passed occurrence and study-link checks, but exposure, causal role, and impact remain unresolved hypotheses."
            : input.occurrences.length
              ? `All planned branch routes completed, but none of the ${input.occurrences.length} bounded records established both a substantive occurrence and a context-linked reason for main-list inspection. Background leads are retained; this is not a claim that no relevant event exists.`
              : "All planned branch routes completed with zero display-ready occurrences in their bounded queries. This is not a claim that no relevant event exists.") +
          (input.omittedMetadataCandidates > 0
            ? ` ${input.omittedMetadataCandidates} additional metadata candidate(s) were not inspected under the bounded 40-record assessment limit.`
            : "") +
          (input.investigation.plan.steps.some((step) =>
            step.providerId === "federal_register" && step.statusNote)
            ? input.attempts.some((attempt) =>
                attempt.providerId === "reviewed_official_documents" &&
                attempt.outcome !== "unsupported_route" &&
                attempt.outcome !== "source_unavailable")
              ? " The reviewed official index includes a finite set of state actions; unindexed state/local and nongovernment events remain search gaps."
              : " Federal Register searches leave state/local rules and nongovernment sector events outside this bounded scan."
            : ""),
    },
    completedAt: input.completedAt,
  };
  return {
    ...body,
    presentationFingerprint: fingerprintSixScreenValue(body),
  };
}

/** Build the deterministic local analysis/presentation from already saved
 * source-step results. This function performs no fetches. */
export function finalizeStudyFirstEventInvestigation(input: {
  investigation: StudyFirstEventInvestigation;
  stepResults: StudyFirstEventStepExecutionResult[];
  startedAt: string;
  completedAt: string;
}) {
  if (input.investigation.status !== "planned") {
    throw new Error("Only a planned study-first event investigation can finalize.");
  }
  const expectedStepIds = input.investigation.plan.steps.map(({ id }) => id);
  if (input.stepResults.length !== expectedStepIds.length ||
      new Set(input.stepResults.map(({ stepId }) => stepId)).size !==
        expectedStepIds.length ||
      input.stepResults.some(({ stepId, attempt }) =>
        !expectedStepIds.includes(stepId) || attempt.stepId !== stepId)) {
    throw new Error("The saved Screen 4 source steps are incomplete or inconsistent.");
  }
  const resultByStepId = new Map(input.stepResults.map((result) =>
    [result.stepId, result]));
  const results = expectedStepIds.map((stepId) => resultByStepId.get(stepId)!);
  const rawAttempts = results.map(({ attempt: value }) => value);
  const rolesByKey = new Map<string, Set<StudyFirstEventBranch>>();
  const occurrenceByKey = new Map<string, CoEventCandidateOccurrence>();
  const eventKeyByCandidateId = new Map<string, string>();
  results.forEach((result, index) => {
    const branch = input.investigation.plan.steps[index]!.branch;
    for (const candidate of result.candidates) {
      const key = eventKey(candidate);
      eventKeyByCandidateId.set(candidate.id, key);
      const existing = occurrenceByKey.get(key);
      occurrenceByKey.set(
        key,
        existing ? mergeOccurrences(existing, candidate) : candidate,
      );
      const roles = rolesByKey.get(key) ?? new Set<StudyFirstEventBranch>();
      roles.add(branch);
      rolesByKey.set(key, roles);
    }
  });
  const rawMetadata = [...occurrenceByKey.entries()].slice(0,
    Math.min(METADATA_LIMIT,
      input.investigation.plan.budget.metadataCandidateCeiling));
  const scopedTerms = tokens([
    input.investigation.context.study.policySideConcept,
    input.investigation.context.study.outcome,
    input.investigation.context.study.outcomeMeasure,
    ...input.investigation.context.study.industry,
    input.investigation.context.study.proposedTreatment,
    input.investigation.context.study.proposedComparison,
  ]);
  const inspectable = rawMetadata.map(([key, candidate]) => ({
    key, candidate,
    score: [...tokens([candidate.title, candidate.description,
      ...candidate.evidence.map(({ factText }) => factText)])].filter(
      (token) => scopedTerms.has(token)).length,
  })).sort((left, right) => right.score - left.score ||
    left.key.localeCompare(right.key)).slice(0, Math.min(INSPECTED_LIMIT,
      input.investigation.plan.budget.inspectedCandidateCeiling ??
        INSPECTED_LIMIT));
  const ranked = inspectable.map(({ key, candidate }) => ({
    key,
    candidate,
    analysis: analyzeEvent({
      candidate,
      branches: [...(rolesByKey.get(key) ?? [])],
      investigation: input.investigation,
    }),
  })).sort((left, right) =>
    left.analysis.relevanceOrder.stableSortKey.localeCompare(
      right.analysis.relevanceOrder.stableSortKey,
    )
  );
  const occurrences = ranked.map(({ candidate }) => candidate);
  const retainedIdByKey = new Map(occurrences.map((candidate) =>
    [eventKey(candidate), candidate.id]));
  const attempts = rawAttempts.map((value) => {
    const body = {
      ...value,
      candidateOccurrenceIds: [...new Set(
        value.candidateOccurrenceIds.flatMap((id) => {
          const key = eventKeyByCandidateId.get(id);
          const retainedId = key ? retainedIdByKey.get(key) : null;
          return retainedId ? [retainedId] : [];
        }),
      )],
    };
    const { attemptFingerprint: _fingerprint, ...withoutFingerprint } = body;
    return {
      ...withoutFingerprint,
      attemptFingerprint: fingerprintSixScreenValue(withoutFingerprint),
    } satisfies StudyFirstEventSearchAttempt;
  });
  const analyses = ranked.map(({ analysis }) => analysis);
  return {
    attempts,
    occurrences,
    analyses,
    presentation: presentation({
      investigation: input.investigation,
      attempts,
      occurrences,
      analyses,
      completedAt: input.completedAt,
      omittedMetadataCandidates: Math.max(0,
        occurrenceByKey.size - inspectable.length),
    }),
    startedAt: input.startedAt,
    completedAt: input.completedAt,
  };
}

/** Re-run only deterministic local screening/presentation for a new context
 * whose source-search inputs are exactly compatible with a retained result. */
export function rebindStudyFirstEventSourceResult(input: {
  source: StudyFirstEventInvestigation;
  target: StudyFirstEventInvestigation;
  completedAt: string;
}) {
  if (input.target.status !== "planned" ||
      !["completed", "completed_partial", "failed"].includes(
        input.source.status) ||
      studyFirstEventSourceInputFingerprint(input.source) !==
        studyFirstEventSourceInputFingerprint(input.target)) {
    throw new Error("Screen 4 documentary source results are not reusable for this context.");
  }
  const usedSourceStepIds = new Set<string>();
  const stepResults = input.target.plan.steps.map((targetStep) => {
    const sourceStep = input.source.plan.steps.find((candidate) =>
      !usedSourceStepIds.has(candidate.id) &&
      candidate.branch === targetStep.branch &&
      candidate.providerId === targetStep.providerId &&
      fingerprintSixScreenValue({ ...candidate, id: null }) ===
        fingerprintSixScreenValue({ ...targetStep, id: null }));
    const sourceAttempt = sourceStep && input.source.attempts.find(
      ({ stepId }) => stepId === sourceStep.id);
    if (!sourceStep || !sourceAttempt) {
      throw new Error("A reusable Screen 4 source step is missing.");
    }
    usedSourceStepIds.add(sourceStep.id);
    const candidateIds = new Set(sourceAttempt.candidateOccurrenceIds);
    const candidates = input.source.occurrences.filter(({ id }) =>
      candidateIds.has(id));
    const attemptBody = {
      ...structuredClone(sourceAttempt),
      id: `screen4-attempt-${targetStep.id.slice("screen4-step-".length)}`,
      stepId: targetStep.id,
      branch: targetStep.branch,
      providerId: targetStep.providerId,
      queryTerms: [...targetStep.queryTerms],
      occurrenceWindow: structuredClone(targetStep.occurrenceWindow),
    };
    const { attemptFingerprint: _fingerprint, ...withoutFingerprint } =
      attemptBody;
    return {
      stepId: targetStep.id,
      attempt: {
        ...withoutFingerprint,
        attemptFingerprint: fingerprintSixScreenValue(withoutFingerprint),
      },
      candidates: structuredClone(candidates),
    } satisfies StudyFirstEventStepExecutionResult;
  });
  return finalizeStudyFirstEventInvestigation({
    investigation: input.target,
    stepResults,
    startedAt: input.source.startedAt ?? input.source.context.createdAt,
    completedAt: input.completedAt,
  });
}

/** Rebind one durable source-step checkpoint across a change that did not
 * alter the source-search semantics (for example, a method-only selection).
 * This performs no source request and does not carry downstream analysis. */
export function rebindStudyFirstEventStepResult(input: {
  source: StudyFirstEventInvestigation;
  target: StudyFirstEventInvestigation;
  result: StudyFirstEventStepExecutionResult;
}) {
  if (input.target.status !== "planned" ||
      studyFirstEventSourceInputFingerprint(input.source) !==
        studyFirstEventSourceInputFingerprint(input.target)) {
    throw new Error("Screen 4 source-step checkpoint is not reusable for this context.");
  }
  const sourceStep = input.source.plan.steps.find(({ id }) =>
    id === input.result.stepId);
  const targetStep = sourceStep && input.target.plan.steps.find((candidate) =>
    candidate.branch === sourceStep.branch &&
    candidate.providerId === sourceStep.providerId &&
    fingerprintSixScreenValue({ ...candidate, id: null }) ===
      fingerprintSixScreenValue({ ...sourceStep, id: null }));
  if (!sourceStep || !targetStep ||
      input.result.attempt.stepId !== sourceStep.id) {
    throw new Error("A reusable Screen 4 source-step checkpoint is missing.");
  }
  const attemptBody = {
    ...structuredClone(input.result.attempt),
    id: `screen4-attempt-${targetStep.id.slice("screen4-step-".length)}`,
    stepId: targetStep.id,
    branch: targetStep.branch,
    providerId: targetStep.providerId,
    queryTerms: [...targetStep.queryTerms],
    occurrenceWindow: structuredClone(targetStep.occurrenceWindow),
  };
  const { attemptFingerprint: _fingerprint, ...withoutFingerprint } =
    attemptBody;
  return {
    stepId: targetStep.id,
    attempt: { ...withoutFingerprint,
      attemptFingerprint: fingerprintSixScreenValue(withoutFingerprint) },
    candidates: structuredClone(input.result.candidates),
  } satisfies StudyFirstEventStepExecutionResult;
}

export async function executeStudyFirstEventInvestigation(input: {
  investigation: StudyFirstEventInvestigation;
  fetch: Screen02ConnectorFetch;
  now: () => string;
  monotonicNow?: () => number;
  sourceRegister: Record<SixScreenSourceId, SourceCapability>;
  govInfoApiKey?: string;
  congressApiKey?: string;
  regulationsApiKey?: string;
  openStatesApiKey?: string;
}) {
  if (input.investigation.status !== "planned") {
    throw new Error("Only a planned study-first event investigation can execute.");
  }
  const startedAt = input.now();
  const requestBudget: SourceBudget = { searches: 0, documents: 0 };
  const pending = input.investigation.plan.steps.map((step, index) => ({
    step, index,
  }));
  const results: Array<Awaited<ReturnType<typeof executeStepInternal>>> = [];
  while (pending.length) {
    const selected: typeof pending = [];
    const busyProviders = new Set<string>();
    for (let index = 0; index < pending.length &&
      selected.length < SOURCE_CONCURRENCY;) {
      const item = pending[index]!;
      const provider = item.step.providerId ?? item.step.id;
      if (busyProviders.has(provider)) {
        index++;
        continue;
      }
      busyProviders.add(provider);
      selected.push(item);
      pending.splice(index, 1);
    }
    const batch = await Promise.all(selected.map(async ({ step, index }) => ({
      index, result: await executeStepInternal({
        ...input, step, requestBudget,
      }),
    })));
    for (const { index, result } of batch) results[index] = result;
  }
  const completedAt = input.now();
  return finalizeStudyFirstEventInvestigation({
    investigation: input.investigation,
    stepResults: results.map((result, index) => ({
      stepId: input.investigation.plan.steps[index]!.id,
      ...result,
    })),
    startedAt,
    completedAt,
  });
}
