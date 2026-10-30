import { describe, expect, it, vi } from "vitest";

import { createScreen02FindState } from
  "../../src/core/screen02-workflow-state";
import { SCREEN_02_DOCUMENT_ACQUISITION_MAX_RECORDED_TOTAL_BYTES } from
  "../../src/core/screen02-document-acquisition";
import { FTC_PRESS_RELEASES_ENDPOINT } from
  "../../src/worker/screen02-agency-connectors";
import { FEDERAL_REGISTER_API_ENDPOINT } from
  "../../src/worker/screen02-connectors";
import { GDELT_DOC_API_ENDPOINT } from
  "../../src/worker/contextual-discovery";
import { CROSSREF_WORKS_API_ENDPOINT } from
  "../../src/worker/crossref-contextual-discovery";
import {
  EU_CELLAR_SPARQL_ENDPOINT,
  UK_LEGISLATION_ATOM_ENDPOINT,
} from "../../src/worker/screen02-global-connectors";
import {
  continueCanonicalScreen02Find,
  discoverCanonicalScreen02Find,
  type Screen02CanonicalFindContinuation,
  type Screen02CanonicalFindDiscovery,
  type Screen02CanonicalFindProgress,
  type ShockAuditEnv,
} from "../../src/worker/server";
import { confirmedWorkflowFindContext } from
  "../core/screen02-workflow-fixtures";
import { deterministicConnectorFetch } from "../browser/fixture-worker";

const retrievedAt = "2026-09-09T12:00:00.000Z";

type FetchCall = {
  url: URL;
  init: RequestInit | undefined;
};

function requestUrl(input: RequestInfo | URL) {
  if (input instanceof URL) return input;
  if (typeof input === "string") return new URL(input);
  return new URL(input.url);
}

function instrumentedFetch() {
  const calls: FetchCall[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
    calls.push({ url: requestUrl(input), init });
    return deterministicConnectorFetch(input, init);
  });
  return { calls, fetch };
}

function endpointMatches(url: URL, endpoint: string) {
  const expected = new URL(endpoint);
  return url.origin === expected.origin && url.pathname === expected.pathname;
}

function ordinaryConnectorCalls(calls: readonly FetchCall[]) {
  return calls.filter(({ url }) =>
    endpointMatches(url, FEDERAL_REGISTER_API_ENDPOINT) ||
    endpointMatches(url, EU_CELLAR_SPARQL_ENDPOINT) ||
    endpointMatches(url, UK_LEGISLATION_ATOM_ENDPOINT) ||
    endpointMatches(url, CROSSREF_WORKS_API_ENDPOINT) ||
    endpointMatches(url, GDELT_DOC_API_ENDPOINT)
  );
}

function recoveryConnectorCalls(calls: readonly FetchCall[]) {
  return calls.filter(({ url }) =>
    endpointMatches(url, FTC_PRESS_RELEASES_ENDPOINT)
  );
}

function documentCalls(calls: readonly FetchCall[]) {
  return calls.filter(({ init }) =>
    new Headers(init?.headers).get("user-agent") ===
      "ShockAudit/0.6.2 substantive-overview retrieval"
  );
}

function fixture(runId: string, searchRoundId: string) {
  const state = createScreen02FindState(
    confirmedWorkflowFindContext("Manufacturing", {
      studyPeriod: "2014–2022",
      outcomeFamily: "Profitability",
      eventDescriptor: "regulatory shock",
    }),
    runId,
    retrievedAt,
  );
  const input = {
    searchRoundId,
    at: retrievedAt,
    exactRequest: "Find source-backed candidate shocks.",
    maximumCandidates: 10,
    queryPlanning: {
      origin: "fixed-fallback" as const,
      reason: "Use the deterministic continuation fixture fallback.",
    },
  };
  return { input, state };
}

function jsonRoundTrip<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function withoutContinuationAccounting(
  discovery: Screen02CanonicalFindDiscovery,
) {
  const copy = structuredClone(discovery);
  copy.manifest.channels = copy.manifest.channels.filter(
    (channel) => channel.channel !== "Worker continuation request accounting",
  );
  if (copy.manifest.retrievalExecution) {
    copy.manifest.retrievalExecution.documentAcquisitions =
      copy.manifest.retrievalExecution.documentAcquisitions.map(
        (acquisition) => ({ ...acquisition, latencyMs: 0 }),
      );
  }
  return copy;
}

function assertMonotoneProgress(
  previous: Screen02CanonicalFindProgress | null,
  current: Screen02CanonicalFindProgress,
) {
  expect(current.invocationDocumentsAttempted).toBeLessThanOrEqual(2);
  expect(current.documentsAttempted).toBeGreaterThanOrEqual(
    previous?.documentsAttempted ?? 0,
  );
  expect(
    current.documentsAttempted - (previous?.documentsAttempted ?? 0),
  ).toBe(current.invocationDocumentsAttempted);
  expect(current.invocationsCompleted).toBe(
    (previous?.invocationsCompleted ?? 0) + 1,
  );
  expect(current.receivedBytes).toBeGreaterThanOrEqual(
    previous?.receivedBytes ?? 0,
  );
  expect(current.attemptJournal).toHaveLength(current.documentsAttempted);
  expect(current.attemptedDocumentKeys).toHaveLength(
    current.documentsAttempted,
  );
  expect(new Set(current.attemptedDocumentKeys).size).toBe(
    current.attemptedDocumentKeys.length,
  );
  expect(current.attemptJournal.map((entry) => entry.attempt)).toEqual(
    Array.from(
      { length: current.documentsAttempted },
      (_unused, index) => index + 1,
    ),
  );
  expect(new Set(
    current.attemptJournal.map((entry) => entry.requestKey),
  ).size).toBe(current.attemptJournal.length);
}

describe("canonical Screen 2 Find continuation execution", () => {
  it("retains concurrency two while canonicalizing out-of-order acquisitions", async () => {
    const value = fixture(
      "canonical-continuation-concurrency-run",
      "canonical-continuation-concurrency-round",
    );
    let documentOrdinal = 0;
    let releaseFirst: (() => void) | undefined;
    const returnedDocumentOrdinals: number[] = [];
    const fetch = vi.fn<typeof globalThis.fetch>(async (request, init) => {
      const isDocument = new Headers(init?.headers).get("user-agent") ===
        "ShockAudit/0.6.2 substantive-overview retrieval";
      if (!isDocument) return deterministicConnectorFetch(request, init);
      documentOrdinal += 1;
      const ordinal = documentOrdinal;
      if (ordinal === 1) {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("The second concurrent request did not start.")),
            1_000,
          );
          releaseFirst = () => {
            clearTimeout(timeout);
            resolve();
          };
        });
      } else if (ordinal === 2) {
        releaseFirst?.();
      }
      const response = await deterministicConnectorFetch(request, init);
      returnedDocumentOrdinals.push(ordinal);
      return response;
    });

    const first = await continueCanonicalScreen02Find(
      {
        CONNECTOR_FETCH: fetch,
        SCREEN02_SEARCH_EXPANSION_MODE: "on",
      } as unknown as ShockAuditEnv,
      value.state,
      value.input,
    );

    expect(documentOrdinal).toBe(2);
    expect(returnedDocumentOrdinals).toEqual([2, 1]);
    expect(first.progress.attemptJournal.map((entry) => entry.attempt))
      .toEqual([1, 2]);
    const attemptByAcquisition = new Map(
      first.progress.attemptJournal.map((entry) => [
        entry.acquisitionId,
        entry.attempt,
      ]),
    );
    expect(first.progress.acquisitions.map((entry) =>
      attemptByAcquisition.get(entry.acquisitionId)
    )).toEqual([1, 2]);
  }, 30_000);

  it("round-trips checkpoints across restored steps without repeating ordinary discovery and matches one-shot results", async () => {
    const chunkedTransport = instrumentedFetch();
    const chunkedFixture = fixture(
      "canonical-continuation-chunked-run",
      "canonical-continuation-shared-round",
    );
    const chunkedEnv = {
      CONNECTOR_FETCH: chunkedTransport.fetch,
      SCREEN02_SEARCH_EXPANSION_MODE: "on",
    } as unknown as ShockAuditEnv;
    let continuation: Screen02CanonicalFindContinuation | undefined;
    let previousProgress: Screen02CanonicalFindProgress | null = null;
    let terminal: Screen02CanonicalFindDiscovery | null = null;
    let firstOrdinaryConnectorCount: number | null = null;
    const progress: Screen02CanonicalFindProgress[] = [];

    for (let invocation = 0; invocation < 16; invocation += 1) {
      const result = await continueCanonicalScreen02Find(
        chunkedEnv,
        chunkedFixture.state,
        chunkedFixture.input,
        continuation,
      );
      assertMonotoneProgress(previousProgress, result.progress);
      progress.push(result.progress);
      previousProgress = result.progress;

      const ordinaryCount = ordinaryConnectorCalls(chunkedTransport.calls).length;
      if (firstOrdinaryConnectorCount === null) {
        firstOrdinaryConnectorCount = ordinaryCount;
        expect(firstOrdinaryConnectorCount).toBeGreaterThan(0);
      } else {
        expect(ordinaryCount).toBe(firstOrdinaryConnectorCount);
      }

      if (result.status === "complete") {
        terminal = result.discovery;
        break;
      }
      continuation = jsonRoundTrip(result.continuation);
    }

    expect(terminal).not.toBeNull();
    expect(progress.length).toBeGreaterThan(1);
    expect(progress.filter((entry) => entry.ordinaryConnectorExecuted))
      .toHaveLength(1);
    expect(progress[0]?.ordinaryConnectorExecuted).toBe(true);
    expect(progress[0]?.ordinaryConnectorFetches).toBe(
      firstOrdinaryConnectorCount,
    );
    // This replay starts 16 logical source queries and observes 16 actual
    // connector dispatches. The fixed reservation remains larger because a
    // contextual query may fan out and may also require the primary bridge.
    expect(progress[0]?.ordinaryConnectorFetches).toBe(16);
    expect(progress[0]?.ordinarySourceQueries).toBe(16);
    expect(progress.slice(1).every(
      (entry) =>
        entry.ordinaryConnectorFetches === 0 &&
        entry.ordinarySourceQueries === 0,
    )).toBe(true);
    expect(progress.filter((entry) => entry.recoveryConnectorExecuted))
      .toHaveLength(1);
    expect(progress.reduce(
      (sum, entry) => sum + entry.recoveryConnectorFetches,
      0,
    )).toBe(1);
    expect(progress.reduce(
      (sum, entry) => sum + entry.recoverySourceQueries,
      0,
    )).toBe(1);
    // The reviewed two-request pool reaches the same qualified fixture set in
    // ten attempts; the serial regression required thirteen.
    expect(progress.at(-1)?.documentsAttempted).toBe(10);
    expect(documentCalls(chunkedTransport.calls)).toHaveLength(
      progress.at(-1)!.documentsAttempted,
    );
    expect(recoveryConnectorCalls(chunkedTransport.calls)).toHaveLength(1);

    const oneShotTransport = instrumentedFetch();
    const oneShotFixture = fixture(
      "canonical-continuation-one-shot-run",
      "canonical-continuation-shared-round",
    );
    const oneShot = await discoverCanonicalScreen02Find(
      {
        CONNECTOR_FETCH: oneShotTransport.fetch,
        SCREEN02_SEARCH_EXPANSION_MODE: "on",
      } as unknown as ShockAuditEnv,
      oneShotFixture.state,
      oneShotFixture.input,
    );

    expect(withoutContinuationAccounting(terminal!)).toEqual(
      withoutContinuationAccounting(oneShot),
    );
    expect(ordinaryConnectorCalls(chunkedTransport.calls)).toHaveLength(
      ordinaryConnectorCalls(oneShotTransport.calls).length,
    );
    expect(recoveryConnectorCalls(oneShotTransport.calls)).toHaveLength(1);
  }, 30_000);

  it("performs no new I/O after the absolute continuation deadline", async () => {
    const transport = instrumentedFetch();
    const value = fixture(
      "canonical-continuation-deadline-run",
      "canonical-continuation-deadline-round",
    );
    let monotonicNow = 10_000;
    const environment = {
      CONNECTOR_FETCH: transport.fetch,
      SCREEN02_SEARCH_EXPANSION_MODE: "on",
      SCREEN02_SEARCH_MONOTONIC_NOW: () => monotonicNow,
    } as unknown as ShockAuditEnv;
    const first = await continueCanonicalScreen02Find(
      environment,
      value.state,
      value.input,
    );
    expect(first.status).toBe("pending");
    if (first.status !== "pending") {
      throw new Error("Expected the two-document first step to be pending.");
    }
    const callsAtCheckpoint = transport.calls.length;
    monotonicNow = first.continuation.budget.deadlineAt! + 1;

    const expired = await continueCanonicalScreen02Find(
      environment,
      value.state,
      value.input,
      jsonRoundTrip(first.continuation),
    );

    expect(expired.status).toBe("complete");
    expect(expired.progress.invocationDocumentsAttempted).toBe(0);
    expect(expired.progress.documentsAttempted).toBe(
      first.progress.documentsAttempted,
    );
    expect(transport.calls).toHaveLength(callsAtCheckpoint);
  }, 30_000);

  it("retains the bounded cumulative-byte overflow sentinel and performs no later I/O", async () => {
    const transport = instrumentedFetch();
    const value = fixture(
      "canonical-continuation-byte-sentinel-run",
      "canonical-continuation-byte-sentinel-round",
    );
    const environment = {
      CONNECTOR_FETCH: transport.fetch,
      SCREEN02_SEARCH_EXPANSION_MODE: "on",
    } as unknown as ShockAuditEnv;
    const first = await continueCanonicalScreen02Find(
      environment,
      value.state,
      value.input,
    );
    expect(first.status).toBe("pending");
    if (first.status !== "pending") {
      throw new Error("Expected the two-document first step to be pending.");
    }
    const overflow = jsonRoundTrip(first.continuation);
    overflow.budget.receivedBytes =
      SCREEN_02_DOCUMENT_ACQUISITION_MAX_RECORDED_TOTAL_BYTES;
    const callsAtCheckpoint = transport.calls.length;

    const terminal = await continueCanonicalScreen02Find(
      environment,
      value.state,
      value.input,
      overflow,
    );

    expect(terminal.status).toBe("complete");
    expect(terminal.progress.receivedBytes).toBe(
      SCREEN_02_DOCUMENT_ACQUISITION_MAX_RECORDED_TOTAL_BYTES,
    );
    expect(terminal.progress.invocationDocumentsAttempted).toBe(0);
    expect(transport.calls).toHaveLength(callsAtCheckpoint);
  }, 30_000);
});
