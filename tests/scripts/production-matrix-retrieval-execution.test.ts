import { describe, expect, it } from "vitest";

import {
  requireCurrentScreen02HandoffRetrieval,
  requireScreen02RetrievalBudget,
} from
  "../../scripts/verify-production-matrix.mjs";

type StopReason =
  | "raw-max"
  | "raw-target"
  | "query-budget"
  | "routes-exhausted"
  | "source-failure"
  | "unsupported"
  | "invalid";

function baselineFor(stop: StopReason) {
  const values = {
    "raw-max": ["completed", 16, 12, 12, 0, 1, 70, 65, 60],
    "raw-target": ["completed", 16, 12, 12, 0, 1, 45, 42, 40],
    "query-budget": ["completed", 16, 16, 15, 1, 2, 9, 7, 6],
    "routes-exhausted": ["completed", 12, 12, 12, 0, 1, 9, 7, 6],
    "source-failure": ["failed", 12, 12, 0, 12, 2, 0, 0, 0],
    unsupported: ["unsupported", 0, 0, 0, 0, 0, 0, 0, 0],
    invalid: ["invalid", 0, 0, 0, 0, 0, 0, 0, 0],
  }[stop] as [string, number, number, number, number, number, number, number, number];
  const [status, planned, attempted, succeeded, failed, rounds, records,
    proposals, unique] = values;
  return {
    phase: "baseline",
    status,
    queryIds: Array.from({ length: attempted }, (_value, index) =>
      `baseline-${index + 1}`
    ),
    stoppingReason: stop,
    queriesPlanned: planned,
    queriesAttempted: attempted,
    queriesSucceeded: succeeded,
    queriesFailed: failed,
    roundsExecuted: rounds,
    recordsReceived: records,
    proposalsGenerated: proposals,
    uniqueProposalsGenerated: unique,
  };
}

function manifestFor(
  stop: StopReason,
  recovery: Record<string, unknown> | null = null,
) {
  const baseline = baselineFor(stop);
  const metricKeys = [
    "queriesPlanned", "queriesAttempted", "queriesSucceeded", "queriesFailed",
    "roundsExecuted", "recordsReceived", "proposalsGenerated",
    "uniqueProposalsGenerated",
  ] as const;
  const aggregate = Object.fromEntries(metricKeys.map((key) => [
    key,
    Number(baseline[key]) + Number(recovery?.[key] ?? 0),
  ])) as Record<string, unknown>;
  aggregate.terminal = true;
  const queryIds = [
    ...baseline.queryIds,
    ...((recovery?.queryIds as string[] | undefined) ?? []),
  ];
  return {
    protocolVersion: "screen-02-search-protocol-v4",
    funnel: {
      schemaVersion: "screen-02-search-funnel-v2",
      sourceRecordsRetrieved: Number(aggregate.recordsReceived),
      uniqueEventLeads: Number(aggregate.uniqueProposalsGenerated),
      deeperRetrievalAttempts: 0,
    },
    queryMatrix: queryIds.map((id) => ({ id })),
    channels: [{
      channel: "localized presentation",
      note: "The verifier must never derive execution from this sentence.",
    }],
    retrievalExecution: {
      schemaVersion: "screen-02-retrieval-execution-v2",
      limits: {
        rawCandidateTarget: 40,
        rawCandidateMaximum: 60,
        qualifiedCandidateTarget: 10,
        minimumGeneralQueryVariants: 12,
        maximumGeneralQueryVariants: 16,
        maximumBaselineRounds: 2,
        maximumDocumentAcquisitions: 24,
        maximumDocumentRedirects: 3,
        documentRequestTimeoutMs: 3_000,
        documentRunTimeoutMs: 45_000,
        documentMaximumBytes: 2 * 1024 * 1024,
        documentTotalBytes: 6 * 1024 * 1024,
        documentConcurrency: 2,
      },
      baseline,
      qualificationRecovery: recovery,
      aggregate,
      documentAcquisitions: [],
      outcomeValuesInspected: false,
    },
  };
}

function setAcquisitions(
  manifest: any,
  acquisitions: Array<Record<string, unknown>>,
) {
  manifest.retrievalExecution.documentAcquisitions = acquisitions;
  manifest.funnel.deeperRetrievalAttempts = acquisitions.length;
  return manifest;
}

function acquisition(
  overrides: Record<string, unknown> = {},
  index = 1,
) {
  return {
    schemaVersion: "screen-02-document-acquisition-v1",
    acquisitionId: `acquisition-${index}`,
    candidateId: "candidate-1",
    sourceId: "source-1",
    level: 2,
    requestedUrl: "https://agency.gov/document",
    redirectChain: [],
    finalUrl: "https://agency.gov/document",
    httpStatus: 200,
    mediaType: "text/html",
    receivedBytes: 1_024,
    latencyMs: 20,
    parserPath: "official-html-visible-text",
    parserOutcome: "parsed",
    outcome: "succeeded",
    failureReason: null,
    ...overrides,
  };
}

describe("typed Screen 2 production retrieval evidence", () => {
  it.each<StopReason>([
    "raw-max",
    "raw-target",
    "query-budget",
    "routes-exhausted",
    "source-failure",
  ])("accepts the strictly supported %s stop", (stop) => {
    expect(requireScreen02RetrievalBudget(manifestFor(stop)).stoppingReason)
      .toBe(stop);
  });

  it("accepts zero execution only for typed unsupported or invalid phases", () => {
    expect(requireScreen02RetrievalBudget(manifestFor("unsupported"), {
      allowUnsupportedRoute: true,
    }).stoppingReason).toBe("unsupported");
    expect(requireScreen02RetrievalBudget(manifestFor("invalid"), {
      generalLegal: false,
    }).stoppingReason).toBe("invalid");
    expect(() => requireScreen02RetrievalBudget(manifestFor("unsupported")))
      .toThrow(/12–16-query/iu);
  });

  it.each([
    ["raw-target", { queriesAttempted: 0, queriesSucceeded: 0, queryIds: [] }],
    ["query-budget", { queriesPlanned: 15 }],
    ["routes-exhausted", { queriesPlanned: 16 }],
    ["source-failure", { queriesSucceeded: 1, queriesFailed: 11 }],
    ["unsupported", { recordsReceived: 1 }],
    ["invalid", { queryIds: ["fabricated"] }],
  ] as const)("rejects a numerically false %s stop", (stop, changes) => {
    const manifest = manifestFor(stop);
    Object.assign(manifest.retrievalExecution.baseline, changes);
    expect(() => requireScreen02RetrievalBudget(manifest, {
      generalLegal: stop !== "invalid",
      allowUnsupportedRoute: stop === "unsupported",
    })).toThrow();
  });

  it("binds exactly one successful recovery request and exact aggregates", () => {
    const recovery = {
      phase: "qualification-recovery",
      status: "completed",
      stoppingReason: "qualification-recovery-completed",
      queryIds: ["recovery-1"],
      queriesPlanned: 1,
      queriesAttempted: 1,
      queriesSucceeded: 1,
      queriesFailed: 0,
      roundsExecuted: 1,
      recordsReceived: 1,
      proposalsGenerated: 1,
      uniqueProposalsGenerated: 1,
    };
    const manifest = manifestFor("routes-exhausted", recovery);
    expect(requireScreen02RetrievalBudget(manifest)).toMatchObject({
      queryRequestsExecuted: 13,
      roundsExecuted: 2,
      maximumRounds: 3,
      qualificationRecovery: { status: "completed" },
      aggregate: { terminal: true },
    });

    const duplicate = structuredClone(manifest);
    duplicate.retrievalExecution.qualificationRecovery!.queryIds = [
      duplicate.retrievalExecution.baseline.queryIds[0],
    ];
    expect(() => requireScreen02RetrievalBudget(duplicate)).toThrow(
      /query-matrix|unique/iu,
    );

    const falseAggregate = structuredClone(manifest);
    falseAggregate.retrievalExecution.aggregate.recordsReceived =
      Number(falseAggregate.retrievalExecution.aggregate.recordsReceived) + 1;
    expect(() => requireScreen02RetrievalBudget(falseAggregate)).toThrow(
      /aggregates/iu,
    );

    for (const invalidId of ["", " recovery-1", "recovery-1\u0000"]) {
      const invalidRecoveryId = structuredClone(manifest);
      invalidRecoveryId.retrievalExecution.qualificationRecovery!.queryIds = [
        invalidId,
      ];
      invalidRecoveryId.queryMatrix.at(-1)!.id = invalidId;
      expect(() => requireScreen02RetrievalBudget(invalidRecoveryId)).toThrow(
        /qualification-recovery/iu,
      );
    }

    for (const stoppingReason of [
      undefined,
      "qualification-recovery-failed",
      "routes-exhausted",
    ]) {
      const invalidRecoveryStop = structuredClone(manifest);
      if (stoppingReason === undefined) {
        delete invalidRecoveryStop.retrievalExecution.qualificationRecovery!
          .stoppingReason;
      } else {
        invalidRecoveryStop.retrievalExecution.qualificationRecovery!
          .stoppingReason = stoppingReason;
      }
      expect(() => requireScreen02RetrievalBudget(invalidRecoveryStop))
        .toThrow(/qualification-recovery/iu);
    }
  });

  it("accepts only the explicit failed recovery stop for a failed request", () => {
    const recovery = {
      phase: "qualification-recovery",
      status: "failed",
      stoppingReason: "qualification-recovery-failed",
      queryIds: ["recovery-failed-1"],
      queriesPlanned: 1,
      queriesAttempted: 1,
      queriesSucceeded: 0,
      queriesFailed: 1,
      roundsExecuted: 1,
      recordsReceived: 0,
      proposalsGenerated: 0,
      uniqueProposalsGenerated: 0,
    };
    expect(requireScreen02RetrievalBudget(
      manifestFor("routes-exhausted", recovery),
    ).qualificationRecovery).toMatchObject({
      status: "failed",
      stoppingReason: "qualification-recovery-failed",
    });
  });

  it("caps baseline planning at 16 even outside the general-legal route", () => {
    const manifest = manifestFor("raw-max");
    manifest.retrievalExecution.baseline.queriesPlanned = 17;
    manifest.retrievalExecution.aggregate.queriesPlanned = 17;
    expect(() => requireScreen02RetrievalBudget(manifest, {
      generalLegal: false,
    })).toThrow(/baseline/iu);
  });

  it("independently validates contextual-to-official bridge provenance", () => {
    const valid = manifestFor("routes-exhausted") as any;
    valid.contextLeads = [{
      id: "context-lead",
      title: "Research names Federal Register 2020-12345",
    }];
    valid.queryMatrix.push({
      id: "bridge-query",
      query:
        "https://www.federalregister.gov/api/v1/documents.json?conditions%5Bterm%5D=2020-12345",
      returnedRecordIds: ["2020-12345"],
    });
    valid.contextBridges = [{
      schemaVersion: "screen-02-context-official-bridge-v1",
      contextualLeadId: "context-lead",
      bridgeQueryId: "bridge-query",
      formalIdentifier: "2020-12345",
      returnedOfficialRecordIds: ["2020-12345"],
      status: "corroborated",
    }];
    expect(() => requireScreen02RetrievalBudget(valid)).not.toThrow();

    for (const mutate of [
      (manifest: any) => {
        manifest.contextLeads[0].title =
          "Research names Federal Register 2020-54321";
      },
      (manifest: any) => {
        manifest.queryMatrix.at(-1).returnedRecordIds = [];
      },
      (manifest: any) => {
        manifest.contextBridges[0].status = "no-corroboration";
      },
    ]) {
      const changed = structuredClone(valid);
      mutate(changed);
      expect(() => requireScreen02RetrievalBudget(changed)).toThrow(
        /contextual-to-official bridge/iu,
      );
    }
  });

  it("cross-checks the funnel against typed retrieval execution", () => {
    const records = manifestFor("routes-exhausted");
    records.funnel.sourceRecordsRetrieved =
      Number(records.retrievalExecution.aggregate.recordsReceived) - 1;
    expect(() => requireScreen02RetrievalBudget(records)).toThrow(/funnel/iu);

    const leads = manifestFor("routes-exhausted");
    leads.funnel.uniqueEventLeads =
      Number(leads.retrievalExecution.aggregate.uniqueProposalsGenerated) - 1;
    expect(() => requireScreen02RetrievalBudget(leads)).toThrow(/funnel/iu);

    const attempts = manifestFor("routes-exhausted");
    attempts.funnel.deeperRetrievalAttempts = 1;
    expect(() => requireScreen02RetrievalBudget(attempts)).toThrow(/funnel/iu);
  });

  it("rejects impossible phase metrics instead of trusting integer-shaped counters", () => {
    const noRounds = manifestFor("routes-exhausted");
    noRounds.retrievalExecution.baseline.roundsExecuted = 0;
    noRounds.retrievalExecution.aggregate.roundsExecuted = 0;
    expect(() => requireScreen02RetrievalBudget(noRounds)).toThrow();

    const proposalsWithoutRecords = manifestFor("routes-exhausted");
    proposalsWithoutRecords.retrievalExecution.baseline.recordsReceived = 0;
    proposalsWithoutRecords.retrievalExecution.aggregate.recordsReceived = 0;
    expect(() => requireScreen02RetrievalBudget(proposalsWithoutRecords))
      .toThrow();

    const moreRoundsThanQueries = manifestFor("routes-exhausted");
    moreRoundsThanQueries.retrievalExecution.baseline.roundsExecuted = 13;
    moreRoundsThanQueries.retrievalExecution.aggregate.roundsExecuted = 13;
    expect(() => requireScreen02RetrievalBudget(moreRoundsThanQueries))
      .toThrow();
  });

  it("requires the exact declared document transport budgets", () => {
    for (const [key, value] of [
      ["maximumDocumentAcquisitions", 25],
      ["maximumDocumentRedirects", 4],
      ["documentRequestTimeoutMs", 3_001],
      ["documentRunTimeoutMs", 45_001],
      ["documentMaximumBytes", 2 * 1024 * 1024 + 1],
      ["documentTotalBytes", 6 * 1024 * 1024 + 1],
      ["documentConcurrency", 3],
    ] as const) {
      const manifest = manifestFor("routes-exhausted");
      (manifest.retrievalExecution.limits as Record<string, unknown>)[key] =
        value;
      expect(() => requireScreen02RetrievalBudget(manifest)).toThrow(
        /retrieval limits/iu,
      );
    }
  });

  it("rejects unsafe, discontinuous, unbounded, or ghost acquisitions", () => {
    const options = {
      allowedCandidateIds: new Set(["candidate-1", "unretained-candidate"]),
      allowedSourceIds: new Set(["source-1"]),
      candidateSourceIds: new Map([["candidate-1", new Set(["source-1"])]]),
      sourcesById: new Map([["source-1", {
        id: "source-1",
        locator: "https://agency.gov/document",
      }]]),
    };
    const valid = setAcquisitions(
      manifestFor("routes-exhausted"),
      [acquisition()],
    );
    expect(requireScreen02RetrievalBudget(valid, options).documentAcquisitions)
      .toHaveLength(1);

    const wholeAcquisitionLatency = setAcquisitions(
      manifestFor("routes-exhausted"),
      [acquisition({ latencyMs: 3_002 })],
    );
    expect(() => requireScreen02RetrievalBudget(
      wholeAcquisitionLatency,
      options,
    )).not.toThrow();

    const validUnretained = setAcquisitions(
      manifestFor("routes-exhausted"),
      [acquisition({
        candidateId: "unretained-candidate",
        sourceId: null,
      })],
    );
    expect(() => requireScreen02RetrievalBudget(validUnretained, options))
      .not.toThrow();

    const borrowedReturnedSource = setAcquisitions(
      manifestFor("routes-exhausted"),
      [acquisition({ candidateId: "unretained-candidate" })],
    );
    expect(() => requireScreen02RetrievalBudget(
      borrowedReturnedSource,
      options,
    )).toThrow(/document-acquisition account/iu);

    const wrongEndpoint = setAcquisitions(
      manifestFor("routes-exhausted"),
      [acquisition({
        requestedUrl: "https://agency.gov/other-document",
        finalUrl: "https://agency.gov/other-document",
      })],
    );
    expect(() => requireScreen02RetrievalBudget(wrongEndpoint, options))
      .toThrow(/document-acquisition account/iu);

    const aliasOptions = {
      ...options,
      sourcesById: new Map([["source-1", {
        id: "source-1",
        locator: "https://www.agency.gov/document",
      }]]),
    };
    const allowedAliasRedirect = setAcquisitions(
      manifestFor("routes-exhausted"),
      [acquisition({
        redirectChain: [{
          status: 302,
          fromUrl: "https://agency.gov/document",
          toUrl: "https://www.agency.gov/document",
        }],
        finalUrl: "https://www.agency.gov/document",
      })],
    );
    expect(() => requireScreen02RetrievalBudget(
      allowedAliasRedirect,
      aliasOptions,
    )).not.toThrow();

    const coherentCrossHost = setAcquisitions(
      manifestFor("routes-exhausted"),
      [acquisition({
        requestedUrl: "https://unrelated.gov/start",
        redirectChain: [{
          status: 302,
          fromUrl: "https://unrelated.gov/start",
          toUrl: "https://agency.gov/document",
        }],
        finalUrl: "https://agency.gov/document",
      })],
    );
    expect(() => requireScreen02RetrievalBudget(coherentCrossHost, options))
      .toThrow(/document-acquisition account/iu);

    const federalSource = {
      id: "source-1",
      locator:
        "https://www.federalregister.gov/documents/2026/09/08/2026-12345/example-rule",
    };
    const federalOptions = {
      ...options,
      sourcesById: new Map([["source-1", federalSource]]),
    };
    const federalToGovInfo = setAcquisitions(
      manifestFor("routes-exhausted"),
      [acquisition({
        requestedUrl: federalSource.locator,
        redirectChain: [{
          status: 302,
          fromUrl: federalSource.locator,
          toUrl:
            "https://www.govinfo.gov/content/pkg/FR-2026-09-08/pdf/2026-12345.pdf",
        }],
        finalUrl:
          "https://www.govinfo.gov/content/pkg/FR-2026-09-08/pdf/2026-12345.pdf",
      })],
    );
    expect(() => requireScreen02RetrievalBudget(
      federalToGovInfo,
      federalOptions,
    )).not.toThrow();

    for (const finalUrl of [
      "https://www.federalregister.gov/d/2026-99999",
      "https://govinfo.gov/content/pkg/FR-2026-09-08/html/2026-99999.htm",
    ]) {
      const wrongFederalId = setAcquisitions(
        manifestFor("routes-exhausted"),
        [acquisition({
          requestedUrl: federalSource.locator,
          redirectChain: [{
            status: 302,
            fromUrl: federalSource.locator,
            toUrl: finalUrl,
          }],
          finalUrl,
        })],
      );
      expect(() => requireScreen02RetrievalBudget(
        wrongFederalId,
        federalOptions,
      )).toThrow(/document-acquisition account/iu);
    }

    const federalIndexOptions = {
      ...options,
      sourcesById: new Map([["source-1", {
        id: "source-1",
        locator: "https://www.federalregister.gov/",
      }]]),
    };
    const noInitialIdMultiHopMismatch = setAcquisitions(
      manifestFor("routes-exhausted"),
      [acquisition({
        requestedUrl: "https://www.federalregister.gov/",
        redirectChain: [
          {
            status: 302,
            fromUrl: "https://www.federalregister.gov/",
            toUrl: "https://www.federalregister.gov/d/2026-12345",
          },
          {
            status: 302,
            fromUrl: "https://www.federalregister.gov/d/2026-12345",
            toUrl: "https://www.federalregister.gov/d/2026-99999",
          },
        ],
        finalUrl: "https://www.federalregister.gov/d/2026-99999",
      })],
    );
    expect(() => requireScreen02RetrievalBudget(
      noInitialIdMultiHopMismatch,
      federalIndexOptions,
    )).toThrow(/document-acquisition account/iu);

    for (const rejectedLocator of [
      "https://public-inspection.federalregister.gov/2026-12345.pdf",
      "https://europa.eu/legal-content/EN/TXT/",
    ]) {
      const rejectedSourceOptions = {
        ...options,
        sourcesById: new Map([["source-1", {
          id: "source-1",
          locator: rejectedLocator,
        }]]),
      };
      const rejectedSameHostTrace = setAcquisitions(
        manifestFor("routes-exhausted"),
        [acquisition({
          requestedUrl: rejectedLocator,
          finalUrl: rejectedLocator,
        })],
      );
      expect(() => requireScreen02RetrievalBudget(
        rejectedSameHostTrace,
        rejectedSourceOptions,
      )).toThrow(/document-acquisition account/iu);
    }

    const europaOptions = {
      ...options,
      sourcesById: new Map([["source-1", {
        id: "source-1",
        locator: "https://op.europa.eu/legal-content/EN/TXT/",
      }]]),
    };
    const europaFamilyRedirect = setAcquisitions(
      manifestFor("routes-exhausted"),
      [acquisition({
        requestedUrl: "https://eur-lex.europa.eu/legal-content/EN/TXT/",
        redirectChain: [{
          status: 302,
          fromUrl: "https://eur-lex.europa.eu/legal-content/EN/TXT/",
          toUrl: "https://op.europa.eu/legal-content/EN/TXT/",
        }],
        finalUrl: "https://op.europa.eu/legal-content/EN/TXT/",
      })],
    );
    expect(() => requireScreen02RetrievalBudget(
      europaFamilyRedirect,
      europaOptions,
    )).not.toThrow();

    const attacks = [
      acquisition({ requestedUrl: "https://localhost/document" }),
      acquisition({ requestedUrl: "https://127.0.0.1/document" }),
      acquisition({ receivedBytes: 999_999_999 }),
      acquisition({ latencyMs: 999_999_999 }),
      acquisition({
        redirectChain: [{
          status: 302,
          fromUrl: "https://unrelated.gov/start",
          toUrl: "https://agency.gov/document",
        }],
      }),
      acquisition({
        redirectChain: [{
          status: 302,
          fromUrl: "https://agency.gov/document",
          toUrl: "https://agency.gov/next",
        }],
        finalUrl: null,
        httpStatus: null,
        mediaType: null,
        parserPath: "not-run",
        parserOutcome: "not-run",
        outcome: "failed",
        failureReason: "The redirected request failed.",
      }),
      acquisition({ candidateId: "ghost-candidate" }),
      acquisition({ sourceId: "ghost-source" }),
      acquisition({
        candidateId: "unretained-candidate",
        sourceId: "ghost-source",
      }),
    ];
    for (const attack of attacks) {
      const manifest = setAcquisitions(
        manifestFor("routes-exhausted"),
        [attack],
      );
      expect(() => requireScreen02RetrievalBudget(manifest, options)).toThrow(
        /document-acquisition account/iu,
      );
    }

    const aggregateOverflow = setAcquisitions(
      manifestFor("routes-exhausted"),
      Array.from({ length: 4 }, (_value, index) => acquisition({
        receivedBytes: 2 * 1024 * 1024,
        sourceId: null,
      }, index + 1)),
    );
    expect(() => requireScreen02RetrievalBudget(aggregateOverflow, options))
      .toThrow(/document-acquisition account/iu);

    const tooMany = setAcquisitions(
      manifestFor("routes-exhausted"),
      Array.from({ length: 25 }, (_value, index) => acquisition({
        receivedBytes: 0,
        sourceId: null,
      }, index + 1)),
    );
    expect(() => requireScreen02RetrievalBudget(tooMany, options))
      .toThrow(/document-acquisition account/iu);
  });

  it("reserves overflow sentinels for failed acquisitions", () => {
    const succeededBytes = setAcquisitions(
      manifestFor("routes-exhausted"),
      [acquisition({ receivedBytes: 2 * 1024 * 1024 + 1, sourceId: null })],
    );
    expect(() => requireScreen02RetrievalBudget(succeededBytes)).toThrow(
      /document-acquisition account/iu,
    );

    const succeededLatency = setAcquisitions(
      manifestFor("routes-exhausted"),
      [acquisition({ latencyMs: 45_001, sourceId: null })],
    );
    expect(() => requireScreen02RetrievalBudget(succeededLatency)).toThrow(
      /document-acquisition account/iu,
    );

    const successfulAggregate = setAcquisitions(
      manifestFor("routes-exhausted"),
      [
        acquisition({ receivedBytes: 2 * 1024 * 1024, sourceId: null }, 1),
        acquisition({ receivedBytes: 2 * 1024 * 1024, sourceId: null }, 2),
        acquisition({ receivedBytes: 2 * 1024 * 1024, sourceId: null }, 3),
        acquisition({ receivedBytes: 1, sourceId: null }, 4),
      ],
    );
    expect(() => requireScreen02RetrievalBudget(successfulAggregate)).toThrow(
      /document-acquisition account/iu,
    );

    const failedSentinel = setAcquisitions(
      manifestFor("routes-exhausted"),
      [acquisition({
        sourceId: null,
        finalUrl: null,
        httpStatus: null,
        mediaType: null,
        receivedBytes: 2 * 1024 * 1024 + 1,
        latencyMs: 45_001,
        parserPath: "not-run",
        parserOutcome: "not-run",
        outcome: "failed",
        failureReason: "The response exceeded a fixed retrieval sentinel.",
      })],
    );
    expect(() => requireScreen02RetrievalBudget(failedSentinel)).not.toThrow();
  });

  it("requires a current v4 final manifest for a Screen 3 handoff", () => {
    const current = manifestFor("routes-exhausted");
    const handoff = {
      schemaVersion: "screen-02-to-screen-03-event-v4",
      sourceScreen: "screen-02",
      destinationScreen: "screen-03",
      mode: "find",
      sources: [],
      event: {
        sourceIds: [],
        preliminaryQualification: { candidateId: "candidate-1" },
      },
      history: { searchManifests: [current] },
    };
    expect(() => requireCurrentScreen02HandoffRetrieval(handoff))
      .not.toThrow();

    const historicalThenCurrent = structuredClone(handoff);
    historicalThenCurrent.history.searchManifests.unshift({
      protocolVersion: "screen-02-search-protocol-v3",
    } as typeof current);
    expect(() => requireCurrentScreen02HandoffRetrieval(
      historicalThenCurrent,
    )).not.toThrow();

    const downgradedFinal = structuredClone(handoff) as any;
    downgradedFinal.history.searchManifests[0].protocolVersion =
      "screen-02-search-protocol-v3";
    delete downgradedFinal.history.searchManifests[0].retrievalExecution;
    expect(() => requireCurrentScreen02HandoffRetrieval(downgradedFinal))
      .toThrow(/current v4/iu);
  });

  it("rejects prose-only and legacy-v3 manifests as current production proof", () => {
    expect(() => requireScreen02RetrievalBudget({
      protocolVersion: "screen-02-search-protocol-v3",
      queryMatrix: [],
      channels: [{
        channel: "Screen 2 exact retrieval funnel · legacy",
        note: "Targets: 40 raw; executed 12; Stop: routes-exhausted.",
      }],
    })).toThrow(/typed v4 retrieval execution/iu);
  });
});
