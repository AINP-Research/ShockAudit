import { describe, expect, it } from "vitest";

import { beginScreen02FindDiscovery, completeScreen02FindDiscovery } from
  "../../src/core/screen02-find-workflow";
import type { Screen02FindDiscoveryResult } from
  "../../src/core/screen02-find-discovery";
import { serializeDeterministicJson } from
  "../../src/core/screen02-deterministic-json";
import { encodeScreen02FindWorkflowStateEnvelope } from
  "../../src/core/screen02-workflow-envelope";
import { Screen02StateCapacityError } from
  "../../src/core/screen02-state-capacity";
import {
  createScreen02FindState,
  fingerprintScreen02WorkflowValue,
} from "../../src/core/screen02-workflow-state";
import {
  classifyScreen02FindContinuationFailure,
  continueCanonicalScreen02Find,
  type Screen02CanonicalFindContinuation,
  type ShockAuditEnv,
} from "../../src/worker/server";
import {
  SCREEN_02_FIND_STORE_CHECKPOINT_MAX_UNCOMPRESSED_BYTES,
  Screen02FindStoreCheckpointError,
  decodeScreen02FindStoreCheckpoint,
  encodeScreen02FindStoreCheckpoint,
  screen02FindStoreCheckpointBytes,
} from "../../src/worker/screen02-find-continuation-checkpoint";
import {
  InMemoryScreen02FindContinuationStoreBackend,
  SCREEN_02_FIND_CONTINUATION_MAX_CHECKPOINT_BYTES,
  Screen02FindContinuationStore,
  createScreen02FindContinuationBinding,
  fingerprintScreen02FindContinuationOutcome,
} from "../../src/worker/screen02-find-continuation-store";
import {
  InMemoryScreen02WorkflowStore,
  createScreen02WorkflowStoreIdentity,
} from "../../src/worker/screen02-workflow-store";
import { FEDERAL_REGISTER_API_ENDPOINT } from
  "../../src/worker/screen02-connectors";
import { FTC_PRESS_RELEASES_ENDPOINT } from
  "../../src/worker/screen02-agency-connectors";
import {
  GDACS_EVENT_SEARCH_ENDPOINT,
  UK_LEGISLATION_ATOM_ENDPOINT,
  USGS_EARTHQUAKE_API_ENDPOINT,
} from
  "../../src/worker/screen02-global-connectors";
import { confirmedWorkflowFindContext } from
  "../core/screen02-workflow-fixtures";
import { deterministicConnectorFetch } from "../browser/fixture-worker";

const encoder = new TextEncoder();
const at = "2026-09-03T12:00:02.000Z";

function bytes(value: unknown) {
  return encoder.encode(serializeDeterministicJson(value)).byteLength;
}

function emptyFtcListing() {
  return new Response(
    "<!doctype html><html><body><main><div class=\"view-empty\">No results found.</div></main></body></html>",
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

function federalRegisterRecord(
  documentNumber: string,
  title: string,
  abstract: string,
  excerpts: string[],
) {
  return {
    document_number: documentNumber,
    title,
    type: "Rule",
    action: "Final rule.",
    abstract,
    excerpts,
    html_url: `https://www.federalregister.gov/d/${documentNumber}`,
    body_html_url:
      `https://www.federalregister.gov/documents/full_text/html/2018/08/01/${documentNumber}.html`,
    raw_text_url:
      `https://www.federalregister.gov/documents/full_text/text/2018/08/01/${documentNumber}.txt`,
    pdf_url:
      `https://www.govinfo.gov/content/pkg/FR-2018-08-01/pdf/${documentNumber}.pdf`,
    publication_date: "2018-08-01",
    effective_on: "2018-10-01",
    agencies: [{ name: "Federal Energy Regulatory Commission" }],
  };
}

function officialReplayFetch(input: {
  records: (query: string, queryIndex: number) => unknown[];
}) {
  const federalQueries: string[] = [];
  const queryIndexes = new Map<string, number>();
  const fetch: NonNullable<ShockAuditEnv["CONNECTOR_FETCH"]> = async (
    request,
  ) => {
    const url = new URL(String(request));
    if (url.toString().startsWith(FEDERAL_REGISTER_API_ENDPOINT)) {
      const query = url.searchParams.get("conditions[term]") ?? "";
      let queryIndex = queryIndexes.get(query);
      if (queryIndex === undefined) {
        queryIndex = queryIndexes.size;
        queryIndexes.set(query, queryIndex);
      }
      federalQueries.push(query);
      return new Response(JSON.stringify({
        count: 5,
        results: input.records(query, queryIndex),
      }), { headers: { "content-type": "application/json" } });
    }
    if (url.toString().startsWith(FTC_PRESS_RELEASES_ENDPOINT)) {
      return emptyFtcListing();
    }
    return new Response("Official document unavailable in frozen replay.", {
      status: 404,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  };
  return { fetch, federalQueries };
}

function searchingState(
  industry: string,
  outcomeFamily: string,
  id: string,
) {
  const initial = createScreen02FindState(
    confirmedWorkflowFindContext(industry, {
      studyPeriod: "2014–2022",
      outcomeFamily,
      eventDescriptor: "regulation",
    }),
    `${id}-run`,
    "2026-09-03T12:00:00.000Z",
  );
  return beginScreen02FindDiscovery(initial, {
    discoveryRequestId: `${id}-request`,
    searchRoundId: `${id}-round`,
    candidateSetSnapshotId: `${id}-set`,
    exactRequest: "Find source-backed candidate shocks.",
    at: "2026-09-03T12:00:01.000Z",
  });
}

function canonicalInput(id: string) {
  return {
    searchRoundId: `${id}-round`,
    at,
    exactRequest: "Find source-backed candidate shocks.",
    maximumCandidates: 10,
    queryPlanning: {
      origin: "fixed-fallback" as const,
      reason: "Use the recorded official-response shape.",
    },
  };
}

describe("Screen 2 runtime-state repair measurements", () => {
  it.each([
    [new Error("Official source returned HTTP 503."), "source-retrieval", "source-unavailability"],
    [new Error("Invalid URL in request construction."), "source-retrieval", "request-construction"],
    [Object.assign(new Error("DNS resolver failed."), { name: "Screen02DnsResolutionError" }), "source-retrieval", "dns-transport"],
    [new Error("Parser rejected the wrong document identity."), "source-retrieval", "parser-identity-rejection"],
    [new Screen02FindStoreCheckpointError("checkpoint-capacity", "checkpoint capacity"), "checkpoint-persistence", "checkpoint-capacity"],
    [new Screen02StateCapacityError("canonical-capacity", "Find state exceeds capacity."), "final-state-persistence", "final-state-capacity"],
    [new Error("Final-state provenance invariant failed."), "final-state-persistence", "unexpected-internal"],
    [new Error("The lease is stale and conflicts with a newer owner."), "continuation-settlement", "stale-conflicting-operation"],
    [new Error("Unclassified invariant."), "source-retrieval", "unexpected-internal"],
  ] as const)("classifies a sanitized %s failure", (error, stage, expected) => {
    const classified = classifyScreen02FindContinuationFailure(error, stage);
    expect(classified.failureClass).toBe(expected);
    expect(classified.diagnosticReference).toMatch(/^fnv1a64:[0-9a-f]{16}$/u);
    expect(JSON.stringify(classified)).not.toContain(error.message);
  });

  it("persists a completed GDACS result when distinct episodes share one event ID", async () => {
    const base = confirmedWorkflowFindContext();
    const sentence =
      "Find a disaster affecting copper mines in Chile from 2009 to 2018 that may influence output.";
    const context = {
      ...base,
      studySentence: sentence,
      contractSourceSentence: sentence,
      scopeContract: {
        ...base.scopeContract,
        population: "Copper mines",
        assignmentLevel: "Mine",
        analysisLevel: "Mine",
        geography: "Chile",
        industry: "Mining",
        studyPeriod: "2009–2018",
        eventFamily: "Disaster",
        outcomeFamily: "Output",
        outcomeFrequency: "Monthly",
      },
    };
    const initial = createScreen02FindState(
      context,
      "gdacs-repeated-event-run",
      "2026-09-03T12:00:00.000Z",
    );
    const searching = beginScreen02FindDiscovery(initial, {
      discoveryRequestId: "gdacs-repeated-event-request",
      searchRoundId: "gdacs-repeated-event-round",
      candidateSetSnapshotId: "gdacs-repeated-event-set",
      exactRequest: "Find source-backed candidate shocks.",
      at: "2026-09-03T12:00:01.000Z",
    });
    const environment = {
      SCREEN02_SEARCH_EXPANSION_MODE: "off",
      SCREEN02_SEARCH_MONOTONIC_NOW: () => 1_000,
      CONNECTOR_FETCH: async (request: RequestInfo | URL) => {
        const url = new URL(String(request));
        if (url.toString().startsWith(GDACS_EVENT_SEARCH_ENDPOINT)) {
          return new Response(JSON.stringify({
            type: "FeatureCollection",
            features: [1, 2].map((episodeid) => ({
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [-70.65, -33.45],
              },
              properties: {
                eventtype: "EQ",
                eventid: 1001,
                episodeid,
                name: `Chile Earthquake episode ${episodeid}`,
                fromdate:
                  `2010-02-${String(26 + episodeid).padStart(2, "0")}T00:00:00Z`,
                alertlevel: "orange",
                affectedcountries: [
                  { countryname: "Chile", iso3: "CHL" },
                ],
              },
            })),
          }), { headers: { "content-type": "application/json" } });
        }
        return new Response("Official document unavailable in replay.", {
          status: 404,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      },
    } as unknown as ShockAuditEnv;
    let continuation: Screen02CanonicalFindContinuation | undefined;
    let discovery: Screen02FindDiscoveryResult | undefined;
    for (let invocation = 0; invocation < 16; invocation += 1) {
      const step = await continueCanonicalScreen02Find(
        environment,
        searching,
        canonicalInput("gdacs-repeated-event"),
        continuation,
      );
      if (step.status === "complete") {
        discovery = step.discovery;
        break;
      }
      continuation = step.continuation;
    }
    expect(discovery!).toBeDefined();
    const gdacsQuery = discovery!.manifest.queryMatrix.find((query) =>
      query.id === "gdacs-global-events"
    );
    expect(gdacsQuery?.returnedRecordIds).toEqual(["1001"]);
    const malformed = structuredClone(discovery!);
    malformed.manifest.queryMatrix.find((query) =>
      query.id === "gdacs-global-events"
    )!.returnedRecordIds.push("1001");
    expect(() => completeScreen02FindDiscovery(searching, {
      discoveryRequestId: "gdacs-repeated-event-request",
      at: "2026-09-03T12:00:03.000Z",
      sources: malformed.sources,
      candidates: malformed.candidates,
      manifest: malformed.manifest,
    })).toThrow("Screen 2 Find state failed its canonical contract.");
    const completed = completeScreen02FindDiscovery(searching, {
      discoveryRequestId: "gdacs-repeated-event-request",
      at: "2026-09-03T12:00:03.000Z",
      sources: discovery!.sources,
      candidates: discovery!.candidates,
      manifest: discovery!.manifest,
    });
    expect(() => encodeScreen02FindWorkflowStateEnvelope(completed))
      .not.toThrow();
  }, 60_000);

  it("persists GDACS results after common semantic deduplication", async () => {
    const base = confirmedWorkflowFindContext("All industries", {
      studyPeriod: "2000–2024",
      outcomeFamily: "Survival",
      eventDescriptor: "disaster",
    });
    const sentence =
      "Find a disaster affecting listed firms globally across all industries from 2000 to 2024 that may influence survival.";
    const context = {
      ...base,
      studySentence: sentence,
      contractSourceSentence: sentence,
      scopeContract: {
        ...base.scopeContract,
        population: "Listed firms",
        geography: "Global",
        industry: "All industries",
        studyPeriod: "2000–2024",
        eventFamily: "Disaster",
        outcomeFamily: "Survival",
      },
    };
    const initial = createScreen02FindState(
      context,
      "gdacs-semantic-dedup-run",
      "2026-09-11T10:00:00.000Z",
    );
    const searching = beginScreen02FindDiscovery(initial, {
      discoveryRequestId: "gdacs-semantic-dedup-request",
      searchRoundId: "gdacs-semantic-dedup-round",
      candidateSetSnapshotId: "gdacs-semantic-dedup-set",
      exactRequest: "Find source-backed candidate shocks.",
      at: "2026-09-11T10:00:01.000Z",
    });
    const environment = {
      SCREEN02_SEARCH_EXPANSION_MODE: "off",
      SCREEN02_SEARCH_MONOTONIC_NOW: () => 1_000,
      CONNECTOR_FETCH: async (request: RequestInfo | URL) => {
        const url = new URL(String(request));
        if (url.toString().startsWith(GDACS_EVENT_SEARCH_ENDPOINT)) {
          return new Response(JSON.stringify({
            type: "FeatureCollection",
            features: [
              { eventid: 1394968, episodeid: 1529438, minute: "40" },
              { eventid: 1394967, episodeid: 1529374, minute: "34" },
            ].map(({ eventid, episodeid, minute }) => ({
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [146.03, -6.14],
              },
              properties: {
                eventtype: "EQ",
                eventid,
                episodeid,
                name: "Earthquake in Papua New Guinea",
                fromdate: `2023-10-07T08:${minute}:00Z`,
                alertlevel: "orange",
                affectedcountries: [
                  { countryname: "Papua New Guinea", iso3: "PNG" },
                ],
              },
            })),
          }), { headers: { "content-type": "application/json" } });
        }
        if (url.toString().startsWith(USGS_EARTHQUAKE_API_ENDPOINT)) {
          throw new Error("USGS source request timed out.");
        }
        return new Response("Official document unavailable in replay.", {
          status: 404,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      },
    } as unknown as ShockAuditEnv;
    let continuation: Screen02CanonicalFindContinuation | undefined;
    let discovery: Screen02FindDiscoveryResult | undefined;
    for (let invocation = 0; invocation < 16; invocation += 1) {
      const step = await continueCanonicalScreen02Find(
        environment,
        searching,
        {
          searchRoundId: "gdacs-semantic-dedup-round",
          at: "2026-09-11T10:00:02.000Z",
          exactRequest: "Find source-backed candidate shocks.",
          maximumCandidates: 10,
          queryPlanning: {
            origin: "fixed-fallback",
            reason: "Use the retained source-native response shape.",
          },
        },
        continuation,
      );
      if (step.status === "complete") {
        discovery = step.discovery;
        break;
      }
      continuation = step.continuation;
    }
    expect(discovery).toBeDefined();
    expect(
      discovery!.manifest.retrievalExecution?.aggregate
        .uniqueProposalsGenerated,
    ).toBe(1);
    expect(discovery!.manifest.funnel?.uniqueEventLeads).toBe(1);
    const completed = completeScreen02FindDiscovery(searching, {
      discoveryRequestId: "gdacs-semantic-dedup-request",
      at: "2026-09-11T10:00:03.000Z",
      sources: discovery!.sources,
      candidates: discovery!.candidates,
      manifest: discovery!.manifest,
    });
    expect(() => encodeScreen02FindWorkflowStateEnvelope(completed))
      .not.toThrow();
  }, 60_000);

  it.each([
    ["Video gaming", "Profitability"],
    ["Energy", "Investment"],
  ] as const)("measures realistic %s continuation and final envelopes", async (
    industry,
    outcomeFamily,
  ) => {
    const initial = createScreen02FindState(
      confirmedWorkflowFindContext(industry, {
        studyPeriod: "2014–2022",
        outcomeFamily,
        eventDescriptor: "regulation",
      }),
      `runtime-size-${industry.replaceAll(" ", "-")}`,
      "2026-09-03T12:00:00.000Z",
    );
    const searching = beginScreen02FindDiscovery(initial, {
      discoveryRequestId: `runtime-size-request-${industry.replaceAll(" ", "-")}`,
      searchRoundId: `runtime-size-round-${industry.replaceAll(" ", "-")}`,
      candidateSetSnapshotId: `runtime-size-set-${industry.replaceAll(" ", "-")}`,
      exactRequest: "Find source-backed candidate shocks.",
      at: "2026-09-03T12:00:01.000Z",
    });
    const input = {
      searchRoundId: `runtime-size-round-${industry.replaceAll(" ", "-")}`,
      at,
      exactRequest: "Find source-backed candidate shocks.",
      maximumCandidates: 10,
      queryPlanning: {
        origin: "fixed-fallback" as const,
        reason: "Use the deterministic production acceptance replay.",
      },
    };
    const environment = {
      CONNECTOR_FETCH: deterministicConnectorFetch,
      SCREEN02_SEARCH_EXPANSION_MODE: "on",
      SCREEN02_SEARCH_MONOTONIC_NOW: () => 1_000,
    } as unknown as ShockAuditEnv;
    let continuation: Screen02CanonicalFindContinuation | undefined;
    const measurements: Array<Record<string, unknown>> = [];
    for (let invocation = 1; invocation <= 16; invocation += 1) {
      const step = await continueCanonicalScreen02Find(
        environment,
        searching,
        input,
        continuation,
      );
      const checkpoint = encodeScreen02FindStoreCheckpoint(step);
      const restored = decodeScreen02FindStoreCheckpoint(
        JSON.parse(JSON.stringify(checkpoint)),
      );
      measurements.push({
        invocation,
        status: step.status,
        v1CheckpointBytes: bytes({
          schemaVersion: "screen-02-find-store-checkpoint-v1",
          step,
        }),
        stepBytes: bytes(step),
        progressBytes: bytes(step.progress),
        v2CheckpointBytes: screen02FindStoreCheckpointBytes(checkpoint),
        v2UncompressedBytes: checkpoint.uncompressedBytes,
        v2CompressedBytes: checkpoint.compressedBytes,
        ...(step.status === "pending"
          ? {
              continuationBytes: bytes(step.continuation),
              ordinaryDiscoveryBytes: bytes(step.continuation.ordinaryDiscovery),
              initialEnrichmentBytes: bytes(step.continuation.initialEnrichment),
              recoveryBytes: bytes(step.continuation.recovery),
            }
          : { discoveryBytes: bytes(step.discovery) }),
      });
      if (step.status === "complete") {
        expect(restored).toEqual({
          status: "complete",
          discovery: step.discovery,
        });
        const completed = completeScreen02FindDiscovery(searching, {
          discoveryRequestId: searching.discoveryRequests.at(-1)!.discoveryRequestId,
          at: "2026-09-03T12:00:03.000Z",
          sources: step.discovery.sources,
          candidates: step.discovery.candidates,
          manifest: step.discovery.manifest,
        });
        measurements.push({
          finalCanonicalStateBytes: bytes(completed),
          finalCanonicalEnvelopeBytes: bytes(
            encodeScreen02FindWorkflowStateEnvelope(completed),
          ),
        });
        break;
      }
      expect(restored.status).toBe("pending");
      if (restored.status !== "pending") {
        throw new Error("Expected a pending restored checkpoint.");
      }
      expect(restored.continuation).toEqual(step.continuation);
      continuation = restored.continuation;
    }
    console.log(`RUNTIME_SIZE_${industry.replaceAll(" ", "_")}`, JSON.stringify(measurements));
    expect(measurements.some((entry) => entry.status === "complete")).toBe(true);
    expect(measurements.every((entry) =>
      entry.v2CheckpointBytes === undefined ||
      (entry.v2CheckpointBytes as number) <
        SCREEN_02_FIND_CONTINUATION_MAX_CHECKPOINT_BYTES
    )).toBe(true);
  }, 60_000);

  it("keeps query-highlight variants out of same-record source identity", async () => {
    const replay = officialReplayFetch({
      records: (query) => [federalRegisterRecord(
        "2014-18203",
        "Energy Conservation Program: Test Procedures for Consumer Electronics",
        "The Department of Energy establishes test procedures for covered consumer electronics and video game console products.",
        [`The ${query} query highlighted a different passage about covered video game products.`],
      )],
    });
    const step = await continueCanonicalScreen02Find(
      {
        CONNECTOR_FETCH: replay.fetch,
        SCREEN02_SEARCH_EXPANSION_MODE: "off",
        SCREEN02_SEARCH_MONOTONIC_NOW: () => 1_000,
      } as unknown as ShockAuditEnv,
      searchingState("Video gaming", "Profitability", "gaming-excerpts"),
      canonicalInput("gaming-excerpts"),
    );
    expect(replay.federalQueries.length).toBeGreaterThan(1);
    const ordinary = step.status === "pending"
      ? step.continuation.ordinaryDiscovery
      : null;
    expect(ordinary).not.toBeNull();
    const repeated = ordinary!.results.flatMap((result) => result.proposals)
      .filter((proposal) => proposal.id === "fr-2014-18203");
    expect(repeated.length).toBeGreaterThan(1);
    expect(new Set(repeated.map((proposal) =>
      serializeDeterministicJson(proposal.sources)
    )).size).toBe(1);
    expect(new Set(repeated.map((proposal) => proposal.description)).size)
      .toBeGreaterThan(1);
  }, 60_000);

  it("persists a production-sized multibyte Energy continuation below the unchanged 1 MiB cap", async () => {
    const replay = officialReplayFetch({
      records: (query, queryIndex) => Array.from({ length: 5 }, (_, index) => {
        const ordinal = queryIndex * 5 + index;
        const documentNumber = `2018-${String(10_000 + ordinal).padStart(5, "0")}`;
        const marker = `route-${queryIndex}-record-${index}`;
        const abstract = (
          `Final energy-market rule ${marker}. The Commission requires covered electric storage operators and regional transmission organizations to implement participation, tariff, eligibility, metering, and settlement requirements. ` +
          "Material timing, exemptions, covered entities, and implementation duties remain tied to the official instrument. " +
          "電力市場の公式記録 preserves multibyte evidence accounting. " +
          `${query} `.repeat(12)
        ).slice(0, 500);
        const excerpts = Array.from({ length: 4 }, (_, excerptIndex) =>
          (`Official highlighted passage ${excerptIndex + 1} for ${marker}: ${query}; ` +
            "covered energy operators must revise market participation and compliance procedures. ")
            .repeat(3)
            .slice(0, 300)
        );
        return federalRegisterRecord(
          documentNumber,
          `Electric Storage Market Participation Rule ${marker}`,
          abstract,
          excerpts,
        );
      }),
    });
    const searching = searchingState("Energy", "Investment", "energy-capacity");
    const input = canonicalInput("energy-capacity");
    const environment = {
      CONNECTOR_FETCH: replay.fetch,
      SCREEN02_SEARCH_EXPANSION_MODE: "off",
      SCREEN02_SEARCH_MONOTONIC_NOW: () => 1_000,
    } as unknown as ShockAuditEnv;
    const first = await continueCanonicalScreen02Find(
      environment,
      searching,
      input,
    );
    expect(first.status).toBe("pending");
    if (first.status !== "pending") {
      throw new Error("Expected a production-sized pending checkpoint.");
    }
    const legacyBytes = bytes({
      schemaVersion: "screen-02-find-store-checkpoint-v1",
      step: first,
    });
    const checkpoint = encodeScreen02FindStoreCheckpoint(first);
    const checkpointBytes = screen02FindStoreCheckpointBytes(checkpoint);
    expect(legacyBytes).toBeGreaterThan(
      SCREEN_02_FIND_CONTINUATION_MAX_CHECKPOINT_BYTES,
    );
    expect(checkpoint.uncompressedBytes).toBeLessThanOrEqual(
      SCREEN_02_FIND_STORE_CHECKPOINT_MAX_UNCOMPRESSED_BYTES,
    );
    expect(checkpointBytes).toBeLessThan(
      SCREEN_02_FIND_CONTINUATION_MAX_CHECKPOINT_BYTES,
    );
    const parentIdentity = createScreen02WorkflowStoreIdentity();
    const parentStore = new InMemoryScreen02WorkflowStore();
    const parentCreated = await parentStore.create({
      ...parentIdentity,
      stateEnvelope: encodeScreen02FindWorkflowStateEnvelope({
        ...searching,
        runId: parentIdentity.runId,
      }),
    });
    if (parentCreated.outcome !== "created") {
      throw new Error("Expected the realistic continuation parent to persist.");
    }
    const binding = await createScreen02FindContinuationBinding(
      parentCreated.record,
      parentIdentity.accessToken,
    );
    const store = new Screen02FindContinuationStore(
      new InMemoryScreen02FindContinuationStoreBackend(),
      { enforceParentGuard: false },
    );
    const operationFingerprint = fingerprintScreen02WorkflowValue(
      "production-energy-save-1",
    );
    const stored = await store.create({
      binding,
      continuationId: "production-energy-continuation",
      operationId: "production-energy-create",
      inputFingerprint: fingerprintScreen02WorkflowValue(
        "production-energy-create",
      ),
      discoveryRequestId: "energy-capacity-request",
      searchRoundId: "energy-capacity-round",
      candidateSetSnapshotId: "energy-capacity-set",
      exactRequest: input,
      criteriaFingerprint: fingerprintScreen02WorkflowValue("energy-criteria"),
      relevanceProfileFingerprint:
        fingerprintScreen02WorkflowValue("energy-profile"),
      discoveryVersion: "screen-02-canonical-find-continuation-v1",
      sourcePolicyVersion: "screen-02-source-policy-v1",
      parserVersion: "screen-02-document-acquisition-v1",
      qualificationVersion: "screen-02-candidate-qualification-v3",
      limits: {
        maxSourceQueries: 19,
        maxConnectorFetches: 19,
        maxDocumentAttempts: 24,
        maxTransportHops: 96,
        maxRedirectHops: 72,
        maxRetries: 1,
        maxReceivedBytes: 6 * 1024 * 1024 + 1,
        maxContinuationRequests: 16,
        requiredPlatformSubrequestHeadroom: 7,
      },
      checkpoint: null,
      createdAt: "2026-09-03T12:00:02.000Z",
      absoluteDeadline: "2026-09-03T12:01:03.000Z",
      expiresAt: parentCreated.record.expiresAt,
    });
    expect(stored.outcome).toBe("created");
    const redirectHops = first.progress.acquisitions.reduce(
      (sum, acquisition) => sum + acquisition.redirectChain.length,
      0,
    );
    const actualUsage = {
      sourceQueries:
        first.progress.ordinarySourceQueries +
        first.progress.recoverySourceQueries,
      connectorFetches:
        first.progress.ordinaryConnectorFetches +
        first.progress.recoveryConnectorFetches,
      documentAttempts: first.progress.documentsAttempted,
      transportHops: Math.max(
        first.progress.documentsAttempted,
        first.progress.acquisitions.length + redirectHops,
      ),
      redirectHops,
      retries: 0,
      receivedBytes: first.progress.receivedBytes,
    };
    const reserved = await store.reserve({
      binding,
      continuationId: "production-energy-continuation",
      expected: { revision: 0, cursor: 0 },
      operationId: "production-energy-save-1",
      inputFingerprint: operationFingerprint,
      reservation: {
        sourceQueries: actualUsage.sourceQueries,
        connectorFetches: actualUsage.connectorFetches,
        documentAttempts: actualUsage.documentAttempts,
        transportHops: actualUsage.transportHops,
        redirectHops: actualUsage.redirectHops,
        retries: actualUsage.retries,
        maximumReceivedBytes: actualUsage.receivedBytes,
      },
      reservedAt: "2026-09-03T12:00:03.000Z",
      leaseExpiresAt: "2026-09-03T12:01:03.000Z",
    });
    if (reserved.outcome !== "reserved") {
      throw new Error("Expected the realistic continuation save lease.");
    }
    const outcomeFingerprint = fingerprintScreen02FindContinuationOutcome({
      actualUsage,
      checkpoint,
      status: "active",
    });
    const advanced = await store.advance({
      binding,
      continuationId: "production-energy-continuation",
      expected: { revision: reserved.record.revision, cursor: 0 },
      operationId: "production-energy-save-1",
      inputFingerprint: operationFingerprint,
      leaseGeneration: reserved.lease.leaseGeneration,
      // The real Worker can finish encoding a proven result just after the
      // shared acquisition deadline. That exact owner must still settle it.
      completedAt: "2026-09-03T12:01:04.000Z",
      actualUsage,
      checkpoint,
      status: "active",
      outcomeFingerprint,
    });
    expect(advanced).toMatchObject({
      outcome: "advanced",
      record: {
        lease: null,
        journal: [{
          operationId: "production-energy-save-1",
          status: "committed",
          actualUsage,
        }],
      },
    });
    const reread = await store.read(
      binding,
      "production-energy-continuation",
    );
    if (reread.outcome !== "found") {
      throw new Error("Expected the realistic continuation to be readable.");
    }
    const restored = decodeScreen02FindStoreCheckpoint(
      reread.record.checkpoint,
    );
    expect(restored).toEqual({
      status: "pending",
      continuation: first.continuation,
    });
    if (restored.status !== "pending") {
      throw new Error("Expected a restored pending checkpoint.");
    }
    const initialQueryCount = replay.federalQueries.length;
    await continueCanonicalScreen02Find(
      environment,
      searching,
      input,
      restored.continuation,
    );
    expect(replay.federalQueries).toHaveLength(initialQueryCount);
    console.log("RUNTIME_SIZE_PRODUCTION_ENERGY", JSON.stringify({
      legacyBytes,
      checkpointBytes,
      uncompressedBytes: checkpoint.uncompressedBytes,
      compressedBytes: checkpoint.compressedBytes,
    }));
  }, 60_000);

  it("uses one bounded UK title query and disables rapid expansion on that host", async () => {
    const base = confirmedWorkflowFindContext("Finance", {
      studyPeriod: "2014–2022",
      outcomeFamily: "Investment",
      eventDescriptor: "regulation",
    });
    const sentence =
      "Find a regulation affecting United Kingdom public finance firms from 2014 to 2022 that may influence investment.";
    const ukContext = {
      ...base,
      studySentence: sentence,
      contractSourceSentence: sentence,
      scopeContract: {
        ...base.scopeContract,
        population: "United Kingdom public finance firms",
        geography: "United Kingdom",
      },
      revision: base.revision + 1,
    };
    const initial = createScreen02FindState(
      ukContext,
      "uk-single-query-run",
      "2026-09-03T12:00:00.000Z",
    );
    const searching = beginScreen02FindDiscovery(initial, {
      discoveryRequestId: "uk-single-query-request",
      searchRoundId: "uk-single-query-round",
      candidateSetSnapshotId: "uk-single-query-set",
      exactRequest: "Find source-backed candidate shocks.",
      at: "2026-09-03T12:00:01.000Z",
    });
    const ukRequests: URL[] = [];
    const ukFetch: NonNullable<ShockAuditEnv["CONNECTOR_FETCH"]> = async (
      request,
    ) => {
      const url = new URL(String(request));
      if (url.origin === new URL(UK_LEGISLATION_ATOM_ENDPOINT).origin) {
        ukRequests.push(url);
        return new Response(
          "<?xml version=\"1.0\"?><feed xmlns=\"http://www.w3.org/2005/Atom\"></feed>",
          { headers: { "content-type": "application/atom+xml" } },
        );
      }
      throw new Error(`Unexpected UK replay request: ${url}`);
    };
    await continueCanonicalScreen02Find(
      {
        CONNECTOR_FETCH: ukFetch,
        SCREEN02_SEARCH_EXPANSION_MODE: "on",
        SCREEN02_SEARCH_MONOTONIC_NOW: () => 1_000,
      } as unknown as ShockAuditEnv,
      searching,
      {
        ...canonicalInput("uk-single-query"),
        searchRoundId: "uk-single-query-round",
      },
    );
    expect(ukRequests).toHaveLength(1);
    expect(ukRequests[0]?.searchParams.get("title")).toMatch(/finance/iu);
  }, 60_000);
});
