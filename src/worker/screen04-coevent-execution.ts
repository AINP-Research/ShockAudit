import { fingerprintSixScreenValue } from
  "../core/six-screen/canonical";
import type { SourceCapability } from
  "../core/six-screen/capabilities";
import {
  createCoEventCandidateOccurrence,
  createCoEventDiscoveryLead,
  createCoEventProviderAttempt,
  validateCoEventExecutionPlan,
  type CoEventCandidateOccurrence,
  type CoEventDiscoveryLead,
  type CoEventExecutionPlan,
  type CoEventExecutionPlanStep,
  type CoEventExecutionUsage,
  type CoEventProviderAttempt,
  type CoEventProviderExecutionCapability,
} from "../core/six-screen/co-event-execution";
import type {
  CoEventProviderId,
  CoEventSearchMatrix,
} from "../core/six-screen/co-event-search";
import type { Screen02Proposal, Screen02Source } from
  "../core/screen02-types";
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
} from "./screen02-global-connectors";
import {
  discoverCrossrefContextualLeads,
  type CrossrefContextualDiscoveryResult,
} from "./crossref-contextual-discovery";
import type {
  SixScreenSourceId,
} from "./six-screen-source-register";

export const SIX_SCREEN_COEVENT_EXECUTOR_VERSION =
  "screen-04-provider-executor-v1" as const;

const WIRED_PROVIDER_IDS = new Set<CoEventProviderId>([
  "federal_register",
  "eu_cellar",
  "uk_legislation",
  "crossref",
  "openfema",
  "gdacs",
]);

const PARTIAL_DATE = /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/u;

function requestScopeSupport(
  providerId: CoEventProviderId,
  matrix: CoEventSearchMatrix,
) {
  const jurisdiction = matrix.policy.issuingJurisdiction.toLocaleLowerCase("en-US");
  const geography = matrix.scope.geography
    .map((value) => value.toLocaleLowerCase("en-US"));
  const unitedStates = jurisdiction.includes("united states") ||
    jurisdiction === "us" || jurisdiction === "u.s." ||
    geography.some((value) => value.includes("united states") || value === "us");
  const europeanUnion = jurisdiction.includes("european union") ||
    jurisdiction === "eu" || geography.some((value) =>
      value.includes("european union") || value === "eu");
  const unitedKingdom = jurisdiction.includes("united kingdom") ||
    jurisdiction === "uk" || jurisdiction === "u.k." ||
    geography.some((value) =>
      value.includes("united kingdom") || value === "uk");
  if (!WIRED_PROVIDER_IDS.has(providerId)) {
    return {
      supported: false,
      limitation:
        "No reviewed Screen 4 search execution is wired for this registered provider operation.",
    };
  }
  if (providerId === "federal_register" && !unitedStates) {
    return {
      supported: false,
      limitation:
        "Federal Register execution requires a United States policy or study geography.",
    };
  }
  if (providerId === "eu_cellar" && !europeanUnion) {
    return {
      supported: false,
      limitation:
        "EU CELLAR execution requires a European Union policy or study geography.",
    };
  }
  if (providerId === "uk_legislation" && !unitedKingdom) {
    return {
      supported: false,
      limitation:
        "UK Legislation execution requires a United Kingdom policy or study geography.",
    };
  }
  if (providerId === "openfema" && !unitedStates) {
    return {
      supported: false,
      limitation:
        "OpenFEMA execution requires a United States study geography.",
    };
  }
  if (providerId === "gdacs" && !unitedStates && !unitedKingdom) {
    return {
      supported: false,
      limitation:
        "This first bounded GDACS route accepts only a disclosed United States or United Kingdom country filter.",
    };
  }
  return { supported: true, limitation: null };
}

export function coEventProviderExecutionCapabilities(input: {
  matrix: CoEventSearchMatrix;
  sourceRegister: Record<SixScreenSourceId, SourceCapability>;
}) {
  return input.matrix.rows.flatMap(({ providers }) =>
    providers.map(({ id }) => id)
  ).filter((id, index, values) => values.indexOf(id) === index).map(
    (providerId): CoEventProviderExecutionCapability => {
      const capability = input.sourceRegister[providerId];
      const request = requestScopeSupport(providerId, input.matrix);
      return {
        providerId,
        provider: capability.provider,
        adapterVersion: capability.adapterVersion,
        capabilityStatus: capability.status,
        implemented: capability.implemented,
        enabled: capability.enabled,
        searchRecords:
          capability.operations.searchRecords &&
          WIRED_PROVIDER_IDS.has(providerId),
        languageSupported:
          capability.languages.includes("en") ||
          capability.languages.includes("multi"),
        requestSupported: request.supported,
        limitation: request.limitation ?? capability.limitation,
      };
    },
  );
}

function stableId(prefix: string, value: unknown) {
  return `${prefix}-${fingerprintSixScreenValue(value).slice("fnv1a64:".length)}`;
}

function exactStateCode(geography: readonly string[]) {
  return geography.find((value) =>
    /^[A-Z]{2}$/u.test(value) && value !== "US" && value !== "UK"
  );
}

function gdacsCountry(matrix: CoEventSearchMatrix) {
  const values = [
    matrix.policy.issuingJurisdiction,
    ...matrix.scope.geography,
  ].map((value) => value.toLocaleLowerCase("en-US"));
  if (values.some((value) =>
    value.includes("united states") || value === "us" || value === "u.s.")) {
    return "USA" as const;
  }
  if (values.some((value) =>
    value.includes("united kingdom") || value === "uk" || value === "u.k.")) {
    return "GBR" as const;
  }
  return null;
}

function query(step: CoEventExecutionPlanStep) {
  return step.queryTerms.join(" ");
}

function datePrecision(value: string) {
  return value.length === 10
    ? "day" as const
    : value.length === 7
      ? "month" as const
      : "year" as const;
}

function occurrenceEvidence(source: Screen02Source, retrievedAt: string) {
  return {
    sourceId: source.id,
    title: source.title,
    locator: source.locator,
    publisher: source.publisher,
    publishedDate: source.publishedDate,
    authorityTier: source.authorityTier,
    retrievedAt: source.retrievedAt ?? retrievedAt,
    evidenceRole: "occurrence_metadata" as const,
    factText: source.evidenceText ?? null,
  };
}

function provisionalTypedDates(
  proposal: Screen02Proposal,
  sourceId: string,
) {
  return proposal.provisionalDates.flatMap((value) => {
    const match = value.match(
      /^(Publication date|Reported effective date):\s*(\d{4}(?:-\d{2}){0,2})$/u,
    );
    if (!match) return [];
    return [{
      kind: match[1] === "Reported effective date"
        ? "effective" as const
        : "publication" as const,
      value: match[2]!,
      precision: datePrecision(match[2]!),
      sourceId,
    }];
  });
}

export function proposalOccurrence(
  providerId: CoEventProviderId,
  proposal: Screen02Proposal,
  recordedAt: string,
): CoEventCandidateOccurrence | null {
  if (proposal.mode !== "find" || proposal.kind !== "event" ||
      !PARTIAL_DATE.test(proposal.event.eventDate) || !proposal.sources.length) {
    return null;
  }
  const evidence = proposal.sources.map((source) =>
    occurrenceEvidence(source, recordedAt));
  const primarySource = evidence[0]!;
  const sourceNativeId = proposal.nativeIdentity?.formalIdentifier ?? proposal.id;
  const formalIdentifiers = proposal.nativeIdentity?.formalIdentifier
    ? [proposal.nativeIdentity.formalIdentifier]
    : [];
  const geography = proposal.event.geographies.length
    ? {
        status: "provider_reported" as const,
        labels: [...new Set(proposal.event.geographies)],
      }
    : { status: "not_established" as const, labels: [] };
  return createCoEventCandidateOccurrence({
    id: stableId("coevent-candidate", {
      providerId,
      sourceNativeId,
      title: proposal.title,
      description: proposal.description,
      eventFamily: proposal.event.eventFamily,
      formalIdentifiers,
      date: proposal.event.eventDate,
      geography,
      evidence: evidence.map(({ retrievedAt: _retrievedAt, ...source }) => source),
    }),
    providerId,
    sourceNativeId,
    title: proposal.title,
    description: proposal.description,
    eventFamily: proposal.event.eventFamily,
    formalIdentifiers,
    typedDates: providerId === "openfema" || providerId === "gdacs"
      ? [{
          kind: "incident_start",
          value: proposal.event.eventDate,
          precision: datePrecision(proposal.event.eventDate),
          sourceId: primarySource.sourceId,
        }]
      : provisionalTypedDates(proposal, primarySource.sourceId).length
        ? provisionalTypedDates(proposal, primarySource.sourceId)
        : [{
            kind: "event",
            value: proposal.event.eventDate,
            precision: datePrecision(proposal.event.eventDate),
            sourceId: primarySource.sourceId,
          }],
    geography,
    evidence,
    recordedAt,
  });
}

type Meter = {
  fetch: Screen02ConnectorFetch;
  hops: number;
  bytes: number;
};

function meteredFetch(fetch: Screen02ConnectorFetch): Meter {
  const meter: Meter = {
    hops: 0,
    bytes: 0,
    fetch: async (request, init) => {
      meter.hops += 1;
      const response = await fetch(request, init);
      if (!response.body) return response;
      const countedBody = response.body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            meter.bytes += chunk.byteLength;
            controller.enqueue(chunk);
          },
        }),
      );
      return new Response(countedBody, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    },
  };
  return meter;
}

function usage(input: {
  meter: Meter;
  metadataRecords: number;
  activeResearchMs: number;
}): CoEventExecutionUsage {
  return {
    sourceQueries: 1,
    metadataRecords: input.metadataRecords,
    documentAttempts: 0,
    usefulDocuments: 0,
    transportHops: input.meter.hops,
    receivedBytes: input.meter.bytes,
    decodedBytes: input.meter.bytes,
    activeResearchMs: Math.max(0, Math.round(input.activeResearchMs)),
    cpuMs: 0,
    providerCostUnits: {},
  };
}

function requestNote(result: Screen02OfficialConnectorResult) {
  return result.diagnostics.channels.map(({ note }) => note).join(" ") ||
    `The ${result.diagnostics.connector} route returned no additional note.`;
}

function officialResult(input: {
  attemptId: string;
  plan: CoEventExecutionPlan;
  step: CoEventExecutionPlanStep;
  result: Screen02OfficialConnectorResult;
  meter: Meter;
  startedAt: string;
  completedAt: string;
  activeResearchMs: number;
}) {
  const recordsReceived = Math.min(
    input.result.diagnostics.recordsReceived,
    input.step.plannedLimit,
  );
  const candidates = input.result.proposals.map((proposal) =>
    proposalOccurrence(input.step.providerId, proposal, input.completedAt)
  ).filter((value): value is CoEventCandidateOccurrence => Boolean(value));
  const failure = input.result.diagnostics.failureKind;
  const outcome = failure !== "none"
    ? "source_unavailable" as const
    : candidates.length
      ? "candidates_found" as const
      : input.result.diagnostics.recordsReceived
        ? "records_unusable" as const
        : "no_match" as const;
  const failureCode = failure !== "none"
    ? failure
    : outcome === "records_unusable"
      ? "invalid_candidate_projection"
      : null;
  const attempt = createCoEventProviderAttempt({
    id: input.attemptId,
    stepId: input.step.id,
    rowId: input.step.rowId,
    providerId: input.step.providerId,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    requestUrl: input.result.diagnostics.requestUrl,
    queryFingerprint: fingerprintSixScreenValue({
      planFingerprint: input.plan.planFingerprint,
      stepId: input.step.id,
      requestUrl: input.result.diagnostics.requestUrl,
    }),
    requestedLimit: input.result.diagnostics.resultLimit,
    recordsReceived,
    recordsAccepted: input.result.diagnostics.recordsAccepted,
    limitReached: input.result.diagnostics.limitReached,
    outcome,
    failureCode,
    note: requestNote(input.result),
    candidateOccurrenceIds: candidates.map(({ id }) => id),
    discoveryLeadIds: [],
    usage: usage({
      meter: input.meter,
      metadataRecords: recordsReceived,
      activeResearchMs: input.activeResearchMs,
    }),
  });
  return { attempt, candidates, leads: [] as CoEventDiscoveryLead[] };
}

function crossrefResult(input: {
  attemptId: string;
  plan: CoEventExecutionPlan;
  step: CoEventExecutionPlanStep;
  result: CrossrefContextualDiscoveryResult;
  meter: Meter;
  startedAt: string;
  completedAt: string;
  activeResearchMs: number;
}) {
  const recordsReceived = Math.min(
    input.result.diagnostics.recordsReceived,
    input.step.plannedLimit,
  );
  const leads = input.result.leads.map((lead) => createCoEventDiscoveryLead({
    id: stableId("coevent-lead", {
      providerId: input.step.providerId,
      sourceNativeId: lead.doi ?? lead.id,
      title: lead.title,
      locator: lead.locator,
      publisher: lead.publisher,
      publishedDate: lead.publishedDate,
    }),
    providerId: input.step.providerId,
    sourceNativeId: lead.doi ?? lead.id,
    title: lead.title,
    locator: lead.locator,
    publisher: lead.publisher,
    publishedDate: lead.publishedDate,
    recordedAt: input.completedAt,
    limitation:
      "Crossref supplied bibliographic metadata only. The publication date is not an event date; obtain a direct source before creating occurrence evidence.",
  }));
  const failed = input.result.diagnostics.status === "failed";
  const outcome = failed
    ? "source_unavailable" as const
    : leads.length
      ? "discovery_leads_only" as const
      : input.result.diagnostics.recordsReceived
        ? "records_unusable" as const
        : "no_match" as const;
  const failureCode = failed
    ? input.result.diagnostics.failureReason
    : outcome === "records_unusable"
      ? "invalid_lead_projection"
      : null;
  const attempt = createCoEventProviderAttempt({
    id: input.attemptId,
    stepId: input.step.id,
    rowId: input.step.rowId,
    providerId: input.step.providerId,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    requestUrl: input.result.diagnostics.requestUrl,
    queryFingerprint: fingerprintSixScreenValue({
      planFingerprint: input.plan.planFingerprint,
      stepId: input.step.id,
      requestUrl: input.result.diagnostics.requestUrl,
    }),
    requestedLimit: input.result.diagnostics.requestedResultLimit,
    recordsReceived,
    recordsAccepted: input.result.diagnostics.recordsAccepted,
    limitReached: input.result.diagnostics.overBudgetRecordsDropped > 0,
    outcome,
    failureCode,
    note: failed
      ? `Crossref discovery was unavailable (${input.result.diagnostics.failureReason}); this is not a no-match result.`
      : leads.length
        ? `Crossref returned ${leads.length} bibliographic lead${leads.length === 1 ? "" : "s"}; none is occurrence evidence.`
        : "Crossref completed this bounded metadata query with no returned lead.",
    candidateOccurrenceIds: [],
    discoveryLeadIds: leads.map(({ id }) => id),
    usage: usage({
      meter: input.meter,
      metadataRecords: recordsReceived,
      activeResearchMs: input.activeResearchMs,
    }),
  });
  return { attempt, candidates: [] as CoEventCandidateOccurrence[], leads };
}

export type CoEventProviderExecutionResult = {
  attempt: CoEventProviderAttempt;
  candidates: CoEventCandidateOccurrence[];
  leads: CoEventDiscoveryLead[];
};

export async function executeCoEventProviderStep(input: {
  attemptId: string;
  plan: CoEventExecutionPlan;
  matrix: CoEventSearchMatrix;
  step: CoEventExecutionPlanStep;
  fetch: Screen02ConnectorFetch;
  now: () => string;
  monotonicNow?: () => number;
}): Promise<CoEventProviderExecutionResult> {
  validateCoEventExecutionPlan(input.plan, input.matrix);
  requirePendingStep(input.plan, input.step);
  const startedAt = input.now();
  const startMs = input.monotonicNow?.() ?? Date.now();
  const meter = meteredFetch(input.fetch);
  const common = {
    fetch: meter.fetch,
    retrievedAt: startedAt,
    startDate: input.plan.searchPeriod.start,
    endDate: input.plan.searchPeriod.end,
    population: input.matrix.scope.population,
    outcomeFamily: input.matrix.scope.outcome,
    limit: input.step.plannedLimit,
    timeoutMs: 18_000,
  };
  let official: Screen02OfficialConnectorResult | null = null;
  let crossref: CrossrefContextualDiscoveryResult | null = null;
  switch (input.step.providerId) {
    case "federal_register":
      official = await fetchFederalRegisterProposals({
        ...common,
        query: query(input.step),
        queryId: input.step.id,
        queryPurpose: input.matrix.rows.find(({ id }) =>
          id === input.step.rowId)!.question,
        documentTypes: ["RULE", "NOTICE", "PRORULE"],
        eventFamily: input.step.branch,
        workflowMode: "find",
      });
      break;
    case "eu_cellar":
      official = await fetchEuCellarLegalProposals({
        ...common,
        query: query(input.step),
        language: "en",
        queryId: input.step.id,
        queryPurpose: input.matrix.rows.find(({ id }) =>
          id === input.step.rowId)!.question,
      });
      break;
    case "uk_legislation":
      official = await fetchUkLegislationProposals({
        ...common,
        query: query(input.step),
        queryId: input.step.id,
        queryPurpose: input.matrix.rows.find(({ id }) =>
          id === input.step.rowId)!.question,
      });
      break;
    case "openfema":
      official = await fetchOpenFemaDisasterProposals({
        ...common,
        ...(exactStateCode(input.matrix.scope.geography)
          ? { state: exactStateCode(input.matrix.scope.geography) }
          : {}),
      });
      break;
    case "gdacs": {
      const countryIso3 = gdacsCountry(input.matrix);
      if (!countryIso3) {
        return unsupportedAttempt(input, startedAt,
          "The current study geography has no reviewed GDACS country filter.");
      }
      official = await fetchGdacsDisasterProposals({
        ...common,
        countryIso3,
        queryId: input.step.id,
        queryPurpose: input.matrix.rows.find(({ id }) =>
          id === input.step.rowId)!.question,
      });
      break;
    }
    case "crossref":
      crossref = await discoverCrossrefContextualLeads({
        fetch: meter.fetch,
        query: query(input.step),
        retrievedAt: startedAt,
        resultLimit: input.step.plannedLimit,
        timeoutMs: 18_000,
      });
      break;
    default:
      return unsupportedAttempt(
        input,
        startedAt,
        "This provider step has no reviewed Screen 4 executor.",
      );
  }
  const completedAt = input.now();
  const endMs = input.monotonicNow?.() ?? Date.now();
  const activeResearchMs = Math.max(0, endMs - startMs);
  if (official) return officialResult({
    attemptId: input.attemptId,
    plan: input.plan,
    step: input.step,
    result: official,
    meter,
    startedAt,
    completedAt,
    activeResearchMs,
  });
  return crossrefResult({
    attemptId: input.attemptId,
    plan: input.plan,
    step: input.step,
    result: crossref!,
    meter,
    startedAt,
    completedAt,
    activeResearchMs,
  });
}

function requirePendingStep(
  plan: CoEventExecutionPlan,
  step: CoEventExecutionPlanStep,
) {
  const saved = plan.steps.find(({ id }) => id === step.id);
  if (!saved || saved.initialStatus !== "pending" ||
      saved.providerId !== step.providerId || saved.rowId !== step.rowId) {
    throw new Error("Screen 4 execution requires a pending saved plan step.");
  }
}

function unsupportedAttempt(
  input: {
    attemptId: string;
    plan: CoEventExecutionPlan;
    step: CoEventExecutionPlanStep;
    now: () => string;
  },
  startedAt: string,
  note: string,
): CoEventProviderExecutionResult {
  const completedAt = input.now();
  return {
    attempt: createCoEventProviderAttempt({
      id: input.attemptId,
      stepId: input.step.id,
      rowId: input.step.rowId,
      providerId: input.step.providerId,
      startedAt,
      completedAt,
      requestUrl: null,
      queryFingerprint: fingerprintSixScreenValue({
        planFingerprint: input.plan.planFingerprint,
        stepId: input.step.id,
        unsupported: true,
      }),
      requestedLimit: input.step.plannedLimit,
      recordsReceived: 0,
      recordsAccepted: 0,
      limitReached: false,
      outcome: "unsupported_request",
      failureCode: null,
      note,
      candidateOccurrenceIds: [],
      discoveryLeadIds: [],
      usage: {
        sourceQueries: 0,
        metadataRecords: 0,
        documentAttempts: 0,
        usefulDocuments: 0,
        transportHops: 0,
        receivedBytes: 0,
        decodedBytes: 0,
        activeResearchMs: 0,
        cpuMs: 0,
        providerCostUnits: {},
      },
    }),
    candidates: [],
    leads: [],
  };
}
