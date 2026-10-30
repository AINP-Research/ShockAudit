import { fingerprintSixScreenValue } from
  "../core/six-screen/canonical";
import {
  SIX_SCREEN_MECHANISM_LITERATURE_ATTEMPT_VERSION,
  SIX_SCREEN_OPENALEX_SCHOLARLY_METADATA_RECORD_VERSION,
  SIX_SCREEN_SCHOLARLY_METADATA_RECORD_VERSION,
  createMechanismLiteratureProviderAttempt,
  createScholarlyMetadataRecord,
  validateMechanismLiteratureExecutionPlan,
  type MechanismLiteratureExecutionPlan,
  type MechanismLiteratureExecutionPlanStep,
  type MechanismLiteratureExecutionUsage,
  type MechanismLiteratureProviderAttempt,
  type ScholarlyMetadataRecord,
} from "../core/six-screen/mechanism-literature-execution";
import type { MechanismLiteraturePlan } from
  "../core/six-screen/mechanism-literature-plan";
import type { Screen02ConnectorFetch } from "./screen02-connectors";
import { discoverCrossrefLiteratureMetadata } from
  "./screen05-crossref-literature";
import { discoverOpenAlexLiteratureMetadata } from
  "./screen05-openalex-literature";

export const SIX_SCREEN_MECHANISM_LITERATURE_EXECUTOR_LEGACY_VERSION =
  "screen-05-crossref-metadata-executor-v1" as const;
export const SIX_SCREEN_MECHANISM_LITERATURE_EXECUTOR_VERSION =
  "screen-05-openalex-crossref-metadata-executor-v2" as const;

export type SixScreenMechanismLiteratureExecutorVersion =
  | typeof SIX_SCREEN_MECHANISM_LITERATURE_EXECUTOR_LEGACY_VERSION
  | typeof SIX_SCREEN_MECHANISM_LITERATURE_EXECUTOR_VERSION;

export function isSupportedMechanismLiteratureExecutorVersion(
  value: unknown,
): value is SixScreenMechanismLiteratureExecutorVersion {
  return value === SIX_SCREEN_MECHANISM_LITERATURE_EXECUTOR_VERSION ||
    value === SIX_SCREEN_MECHANISM_LITERATURE_EXECUTOR_LEGACY_VERSION;
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
}): MechanismLiteratureExecutionUsage {
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

function stableId(prefix: string, value: unknown) {
  return `${prefix}-${fingerprintSixScreenValue(value).slice("fnv1a64:".length)}`;
}

function requirePendingProviderStep(
  plan: MechanismLiteratureExecutionPlan,
  step: MechanismLiteratureExecutionPlanStep,
) {
  const saved = plan.steps.find(({ id }) => id === step.id);
  if (
    !saved || saved.initialStatus !== "pending" ||
    fingerprintSixScreenValue(saved) !== fingerprintSixScreenValue(step)
  ) throw new Error("Screen 5 execution requires a pending metadata-provider step.");
}

export type MechanismLiteratureProviderExecutionResult = {
  attempt: MechanismLiteratureProviderAttempt;
  records: ScholarlyMetadataRecord[];
};

export async function executeMechanismLiteratureProviderStep(input: {
  attemptId: string;
  executionPlan: MechanismLiteratureExecutionPlan;
  literaturePlan: MechanismLiteraturePlan;
  step: MechanismLiteratureExecutionPlanStep;
  fetch: Screen02ConnectorFetch;
  openAlexApiKey?: string;
  now: () => string;
  monotonicNow?: () => number;
}): Promise<MechanismLiteratureProviderExecutionResult> {
  validateMechanismLiteratureExecutionPlan(
    input.executionPlan,
    input.literaturePlan,
  );
  requirePendingProviderStep(input.executionPlan, input.step);
  const startedAt = input.now();
  const startMs = input.monotonicNow?.() ?? Date.now();
  const meter = meteredFetch(input.fetch);
  if (input.step.providerId === "openalex" && !input.openAlexApiKey) {
    throw new Error("The pending OpenAlex step lost its server-side credential.");
  }
  let records: ScholarlyMetadataRecord[];
  let completedAt: string;
  let diagnostics: {
    requestUrl: string;
    status: "searched" | "failed";
    failureReason: string;
    recordsReceived: number;
    overBudgetRecordsDropped: number;
  };
  if (input.step.providerId === "openalex") {
    const result = await discoverOpenAlexLiteratureMetadata({
      fetch: meter.fetch,
      apiKey: input.openAlexApiKey!,
      query: input.step.queryTerms.join(" "),
      retrievedAt: startedAt,
      resultLimit: input.step.plannedLimit,
      timeoutMs: 18_000,
    });
    diagnostics = result.diagnostics;
    completedAt = input.now();
    records = result.records.map((record) => createScholarlyMetadataRecord({
      schemaVersion: SIX_SCREEN_OPENALEX_SCHOLARLY_METADATA_RECORD_VERSION,
      id: stableId("scholarly-openalex", {
        stepId: input.step.id,
        providerNativeId: record.providerNativeId,
      }),
      providerId: "openalex",
      providerNativeId: record.providerNativeId,
      doi: record.doi,
      title: record.title,
      authors: record.authors,
      publicationYear: record.publicationYear,
      publishedDate: record.publishedDate,
      publicationVenue: record.publicationVenue,
      publisher: record.publisher,
      workType: record.workType,
      language: record.language,
      stableLocator: record.stableLocator,
      updateMetadata: {
        status: "not_available_from_route",
        relations: [],
        caveat:
          "OpenAlex discovery does not supply Crossref deposited update relations. Its retraction flag is retained separately and must not be treated as a complete update check.",
      },
      openAccessLocationMetadata: {
        status: record.reportedLocations.length
          ? "locations_reported"
          : "none_reported",
        locations: record.reportedLocations,
        followedLocations: 0,
        caveat:
          "OpenAlex reported locations are unvisited discovery metadata. They do not establish access rights, document identity, text availability, or evidentiary support.",
      },
      retractionMetadata: {
        status: record.isRetracted ? "flagged" : "not_flagged",
        caveat:
          "The OpenAlex retraction flag is provider metadata only. A false flag is not evidence that the work is valid, unretracted, or unchanged.",
      },
      source: {
        attemptId: input.attemptId,
        stepId: input.step.id,
        rowId: input.step.rowId,
        branch: input.step.branch,
        requestUrl: result.diagnostics.requestUrl,
        retrievedAt: completedAt,
      },
      access: {
        route: "openalex_works_api",
        metadata: "retrieved",
        abstract: "not_requested",
        fullText: "not_requested",
        appendix: "not_requested",
        inspectedPassageIds: [],
      },
      evidenceRole: "scholarly_metadata_lead",
      detailedClaimSupport: "not_eligible",
      limitation:
        "This record contains OpenAlex work and reported-location metadata only. No reported location, abstract, full text, appendix, cited passage, theoretical proposition, measure, result, or mechanism was inspected.",
    }));
  } else {
    const result = await discoverCrossrefLiteratureMetadata({
      fetch: meter.fetch,
      query: input.step.queryTerms.join(" "),
      retrievedAt: startedAt,
      resultLimit: input.step.plannedLimit,
      timeoutMs: 18_000,
    });
    diagnostics = result.diagnostics;
    completedAt = input.now();
    records = result.records.map((record) => createScholarlyMetadataRecord({
      schemaVersion: SIX_SCREEN_SCHOLARLY_METADATA_RECORD_VERSION,
      id: stableId("scholarly-crossref", {
        stepId: input.step.id,
        providerNativeId: record.providerNativeId,
      }),
      providerId: "crossref",
      providerNativeId: record.providerNativeId,
      doi: record.doi,
      title: record.title,
      authors: record.authors,
      publicationYear: record.publicationYear,
      publishedDate: record.publishedDate,
      publicationVenue: record.publicationVenue,
      publisher: record.publisher,
      workType: record.workType,
      stableLocator: record.stableLocator,
      updateMetadata: {
        status: record.updateRelations.length
          ? "relations_reported"
          : "none_reported",
        relations: record.updateRelations,
        caveat:
          "Crossref update metadata reports deposited relations only. No reported relation is not evidence that a work is valid, unretracted, or unchanged.",
      },
      source: {
        attemptId: input.attemptId,
        stepId: input.step.id,
        rowId: input.step.rowId,
        branch: input.step.branch,
        requestUrl: result.diagnostics.requestUrl,
        retrievedAt: completedAt,
      },
      access: {
        route: "crossref_metadata_api",
        metadata: "retrieved",
        abstract: "not_requested",
        fullText: "not_requested",
        appendix: "not_requested",
        inspectedPassageIds: [],
      },
      evidenceRole: "scholarly_metadata_lead",
      detailedClaimSupport: "not_eligible",
      limitation:
        "This record contains Crossref bibliographic metadata only. No abstract, full text, appendix, cited passage, theoretical proposition, measure, result, or mechanism was inspected.",
    }));
  }
  const endMs = input.monotonicNow?.() ?? Date.now();
  const recordsReceived = Math.min(
    diagnostics.recordsReceived,
    input.step.plannedLimit,
  );
  const outcome = diagnostics.status === "failed"
    ? "source_unavailable" as const
    : records.length
      ? "metadata_leads_found" as const
      : recordsReceived
        ? "records_unusable" as const
        : "no_match" as const;
  const attempt = createMechanismLiteratureProviderAttempt({
    schemaVersion: SIX_SCREEN_MECHANISM_LITERATURE_ATTEMPT_VERSION,
    id: input.attemptId,
    stepId: input.step.id,
    rowId: input.step.rowId,
    branch: input.step.branch,
    providerId: input.step.providerId,
    startedAt,
    completedAt,
    requestUrl: diagnostics.requestUrl,
    queryFingerprint: fingerprintSixScreenValue({
      executionPlanFingerprint: input.executionPlan.planFingerprint,
      stepId: input.step.id,
      requestUrl: diagnostics.requestUrl,
    }),
    requestedLimit: input.step.plannedLimit,
    recordsReceived: diagnostics.status === "failed"
      ? 0
      : recordsReceived,
    recordsAccepted: records.length,
    limitReached: diagnostics.overBudgetRecordsDropped > 0,
    outcome,
    failureCode: diagnostics.status === "failed"
      ? diagnostics.failureReason
      : null,
    note: diagnostics.status === "failed"
      ? `${input.step.provider} metadata discovery was unavailable (${diagnostics.failureReason}); this is not a no-match result.`
      : records.length
        ? `${input.step.provider} returned ${records.length} scholarly metadata lead${records.length === 1 ? "" : "s"}; no reported location, abstract, or full text was requested.`
        : recordsReceived
          ? `${input.step.provider} returned records, but none met the bounded scholarly metadata contract.`
          : `${input.step.provider} completed this bounded metadata query with no returned record.`,
    scholarlyMetadataRecordIds: records.map(({ id }) => id),
    inspectedTextIds: [],
    usage: usage({
      meter,
      metadataRecords: diagnostics.status === "failed"
        ? 0
        : recordsReceived,
      activeResearchMs: Math.max(0, endMs - startMs),
    }),
  });
  return { attempt, records };
}
