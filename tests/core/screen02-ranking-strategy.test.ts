import { describe, expect, it } from "vitest";

import {
  SCREEN02_RANKING_STRATEGIES,
  buildScreen02RankingBenchmarkReport,
  executeScreen02RankingStrategy,
  type Screen02LocalEmbeddingBenchmarkObservation,
} from "../../src/core/screen02-ranking-strategy";

describe("provider-neutral Screen 2 ranking strategy boundary", () => {
  it("preserves a strategy's exact candidate permutation and identity", () => {
    const candidates = [{ id: "candidate-a" }, { id: "candidate-b" }];
    const execution = executeScreen02RankingStrategy({
      strategy: SCREEN02_RANKING_STRATEGIES.deterministicProfile,
      candidates,
      candidateId: (candidate) => candidate.id,
      rank: (values) => [...values].reverse(),
      rankedCandidateId: (candidate) => candidate.id,
    });

    expect(execution).toEqual({
      strategyId: "deterministic-profile-ranking",
      ranked: [{ id: "candidate-b" }, { id: "candidate-a" }],
    });
    expect(candidates).toEqual([{ id: "candidate-a" }, { id: "candidate-b" }]);
  });

  it("rejects a strategy that adds, drops, or duplicates candidate identity", () => {
    const run = (rankedIds: string[]) => executeScreen02RankingStrategy({
      strategy: SCREEN02_RANKING_STRATEGIES.localEmbedding,
      candidates: [{ id: "candidate-a" }, { id: "candidate-b" }],
      candidateId: (candidate) => candidate.id,
      rank: () => rankedIds.map((id) => ({ id })),
      rankedCandidateId: (candidate) => candidate.id,
    });

    expect(() => run(["candidate-a"])).toThrow(/exact permutation/iu);
    expect(() => run(["candidate-a", "candidate-a"])).toThrow(
      /exact permutation/iu,
    );
    expect(() => run(["candidate-a", "candidate-c"])).toThrow(
      /exact permutation/iu,
    );
  });

  it("never auto-adopts a local embedding strategy even after every gate passes", () => {
    const localEmbedding: Screen02LocalEmbeddingBenchmarkObservation = {
      evaluatedCases: 16,
      precisionAt10: 0.91,
      incrementalBundleBytes: 20_000,
      maximumIncrementalBundleBytes: 25_000,
      p95LatencyMs: 40,
      maximumP95LatencyMs: 50,
      deterministicModelVersion: "permissive-model-v1",
      licenseSpdx: "Apache-2.0",
      compatibleLicense: true,
      transmitsConfidentialResearchData: false,
      usesPaidInference: false,
      deterministicFallbackVerified: true,
      sourceRequirementsUnchanged: true,
    };
    const report = buildScreen02RankingBenchmarkReport({
      benchmarkId: "provider-neutral-gate-test",
      deterministic: { evaluatedCases: 16, precisionAt10: 0.9 },
      host: { genuineExecutions: 0, observation: null },
      localEmbedding,
    });

    expect(report.localEmbeddingDecision).toMatchObject({
      outcome: "eligible-for-reviewed-adoption",
      unmetCriteria: [],
      automaticAdoption: false,
    });
    expect(report.strategies.every(({ descriptor }) =>
      descriptor.evidenceAuthority === "none" &&
      descriptor.candidateAuthority ===
        "order-supplied-candidate-identities-only"
    )).toBe(true);
  });
});
