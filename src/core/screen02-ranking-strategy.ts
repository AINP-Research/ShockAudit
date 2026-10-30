export const SCREEN02_RANKING_STRATEGY_PROTOCOL_VERSION =
  "screen-02-ranking-strategy-v1" as const;

export type Screen02RankingStrategyId =
  | "deterministic-profile-ranking"
  | "bounded-host-pool-review"
  | "local-embedding-reranking";

export type Screen02RankingStrategyDescriptor = Readonly<{
  id: Screen02RankingStrategyId;
  executionBoundary: "fixed-code" | "signed-in-host" | "local-runtime";
  role: "primary-ordering" | "bounded-ordering-review" | "optional-reranking";
  availability: "active" | "optional" | "deferred";
  fallbackStrategyId: "deterministic-profile-ranking" | null;
  candidateAuthority: "order-supplied-candidate-identities-only";
  evidenceAuthority: "none";
}>;

export const SCREEN02_RANKING_STRATEGIES = {
  deterministicProfile: {
    id: "deterministic-profile-ranking",
    executionBoundary: "fixed-code",
    role: "primary-ordering",
    availability: "active",
    fallbackStrategyId: null,
    candidateAuthority: "order-supplied-candidate-identities-only",
    evidenceAuthority: "none",
  },
  boundedHostReview: {
    id: "bounded-host-pool-review",
    executionBoundary: "signed-in-host",
    role: "bounded-ordering-review",
    availability: "optional",
    fallbackStrategyId: "deterministic-profile-ranking",
    candidateAuthority: "order-supplied-candidate-identities-only",
    evidenceAuthority: "none",
  },
  localEmbedding: {
    id: "local-embedding-reranking",
    executionBoundary: "local-runtime",
    role: "optional-reranking",
    availability: "deferred",
    fallbackStrategyId: "deterministic-profile-ranking",
    candidateAuthority: "order-supplied-candidate-identities-only",
    evidenceAuthority: "none",
  },
} as const satisfies Readonly<Record<string, Screen02RankingStrategyDescriptor>>;

/**
 * Executes an ordering strategy behind one provider-neutral identity boundary.
 * The strategy may only return a permutation of the supplied candidates. It
 * cannot add or remove candidate identities or create evidence. Source and
 * qualification gates remain authoritative outside this ordering boundary.
 */
export function executeScreen02RankingStrategy<TCandidate, TRanked>(input: {
  strategy: Screen02RankingStrategyDescriptor;
  candidates: readonly TCandidate[];
  candidateId: (candidate: TCandidate) => string;
  rank: (candidates: readonly TCandidate[]) => readonly TRanked[];
  rankedCandidateId: (candidate: TRanked) => string;
}): {
  strategyId: Screen02RankingStrategyId;
  ranked: TRanked[];
} {
  const suppliedIds = input.candidates.map(input.candidateId);
  if (
    suppliedIds.some((candidateId) => candidateId.trim() === "") ||
    new Set(suppliedIds).size !== suppliedIds.length
  ) {
    throw new Error(
      "Screen 2 ranking strategies require unique non-empty candidate IDs.",
    );
  }
  const ranked = [...input.rank(input.candidates)];
  const rankedIds = ranked.map(input.rankedCandidateId);
  if (
    rankedIds.length !== suppliedIds.length ||
    new Set(rankedIds).size !== rankedIds.length ||
    rankedIds.some((candidateId) => !suppliedIds.includes(candidateId))
  ) {
    throw new Error(
      "A Screen 2 ranking strategy must return an exact permutation of the supplied candidates.",
    );
  }
  return { strategyId: input.strategy.id, ranked };
}

export type Screen02RankingBenchmarkObservation = Readonly<{
  evaluatedCases: number;
  /** Null until at least one independently reviewed candidate pool reaches 10. */
  precisionAt10: number | null;
  /** Precision across the actually displayed candidates in the reviewed pools. */
  availablePoolPrecision?: number;
  /** Number of displayed candidates contributing to availablePoolPrecision. */
  availablePoolSize?: number;
}>;

export type Screen02LocalEmbeddingBenchmarkObservation =
  Screen02RankingBenchmarkObservation & Readonly<{
    incrementalBundleBytes: number;
    maximumIncrementalBundleBytes: number;
    p95LatencyMs: number;
    maximumP95LatencyMs: number;
    deterministicModelVersion: string;
    licenseSpdx: string;
    compatibleLicense: boolean;
    transmitsConfidentialResearchData: boolean;
    usesPaidInference: boolean;
    deterministicFallbackVerified: boolean;
    sourceRequirementsUnchanged: boolean;
  }>;

export const SCREEN02_LOCAL_EMBEDDING_ADOPTION_CRITERIA = [
  "improved-top-ten-precision",
  "acceptable-bundle-size",
  "acceptable-latency",
  "deterministic-versioning",
  "compatible-license",
  "no-confidential-data-transmission",
  "no-paid-inference",
  "deterministic-fallback",
  "source-requirements-unchanged",
] as const;

export type Screen02LocalEmbeddingAdoptionCriterion =
  (typeof SCREEN02_LOCAL_EMBEDDING_ADOPTION_CRITERIA)[number];

function validateObservation(
  observation: Screen02RankingBenchmarkObservation,
  label: string,
) {
  if (
    !Number.isSafeInteger(observation.evaluatedCases) ||
    observation.evaluatedCases < 1 ||
    (observation.precisionAt10 !== null &&
      (!Number.isFinite(observation.precisionAt10) ||
        observation.precisionAt10 < 0 ||
        observation.precisionAt10 > 1)) ||
    ((observation.availablePoolPrecision === undefined) !==
      (observation.availablePoolSize === undefined)) ||
    (observation.availablePoolPrecision !== undefined &&
      (!Number.isFinite(observation.availablePoolPrecision) ||
        observation.availablePoolPrecision < 0 ||
        observation.availablePoolPrecision > 1)) ||
    (observation.availablePoolSize !== undefined &&
      (!Number.isSafeInteger(observation.availablePoolSize) ||
        observation.availablePoolSize < 1 ||
        observation.availablePoolSize > observation.evaluatedCases))
  ) {
    throw new Error(`${label} has invalid frozen benchmark metrics.`);
  }
}

function localEmbeddingCriteria(
  baseline: Screen02RankingBenchmarkObservation,
  observation: Screen02LocalEmbeddingBenchmarkObservation | null,
): Record<Screen02LocalEmbeddingAdoptionCriterion, boolean> {
  if (observation === null) {
    return Object.fromEntries(
      SCREEN02_LOCAL_EMBEDDING_ADOPTION_CRITERIA.map((criterion) => [
        criterion,
        false,
      ]),
    ) as Record<Screen02LocalEmbeddingAdoptionCriterion, boolean>;
  }
  validateObservation(observation, "Local vector reranking");
  const finiteNonnegative = (value: number) =>
    Number.isFinite(value) && value >= 0;
  if (
    !finiteNonnegative(observation.incrementalBundleBytes) ||
    !finiteNonnegative(observation.maximumIncrementalBundleBytes) ||
    !finiteNonnegative(observation.p95LatencyMs) ||
    !finiteNonnegative(observation.maximumP95LatencyMs)
  ) {
    throw new Error("Local vector reranking has invalid size or latency metrics.");
  }
  return {
    "improved-top-ten-precision":
      baseline.precisionAt10 !== null &&
      observation.precisionAt10 !== null &&
      observation.precisionAt10 > baseline.precisionAt10,
    "acceptable-bundle-size":
      observation.incrementalBundleBytes <=
      observation.maximumIncrementalBundleBytes,
    "acceptable-latency":
      observation.p95LatencyMs <= observation.maximumP95LatencyMs,
    "deterministic-versioning":
      observation.deterministicModelVersion.trim().length > 0,
    "compatible-license":
      observation.compatibleLicense && observation.licenseSpdx.trim().length > 0,
    "no-confidential-data-transmission":
      !observation.transmitsConfidentialResearchData,
    "no-paid-inference": !observation.usesPaidInference,
    "deterministic-fallback": observation.deterministicFallbackVerified,
    "source-requirements-unchanged": observation.sourceRequirementsUnchanged,
  };
}

export function buildScreen02RankingBenchmarkReport(input: {
  benchmarkId: string;
  deterministic: Screen02RankingBenchmarkObservation;
  host: Readonly<{
    genuineExecutions: number;
    observation: Screen02RankingBenchmarkObservation | null;
  }>;
  localEmbedding: Screen02LocalEmbeddingBenchmarkObservation | null;
}) {
  if (!input.benchmarkId.trim() || input.benchmarkId.length > 160) {
    throw new Error("Screen 2 ranking benchmark ID must be bounded non-empty text.");
  }
  validateObservation(input.deterministic, "Deterministic profile ranking");
  if (
    !Number.isSafeInteger(input.host.genuineExecutions) ||
    input.host.genuineExecutions < 0 ||
    (input.host.genuineExecutions === 0) !== (input.host.observation === null)
  ) {
    throw new Error(
      "Bounded host review metrics must correspond to one or more genuine host executions.",
    );
  }
  if (input.host.observation !== null) {
    validateObservation(input.host.observation, "Bounded host review");
  }
  const criteria = localEmbeddingCriteria(
    input.deterministic,
    input.localEmbedding,
  );
  const unmetCriteria = SCREEN02_LOCAL_EMBEDDING_ADOPTION_CRITERIA.filter(
    (criterion) => !criteria[criterion],
  );
  return {
    protocolVersion: SCREEN02_RANKING_STRATEGY_PROTOCOL_VERSION,
    benchmarkId: input.benchmarkId,
    strategies: [
      {
        descriptor: SCREEN02_RANKING_STRATEGIES.deterministicProfile,
        benchmarkStatus: "benchmarked" as const,
        observation: input.deterministic,
      },
      {
        descriptor: SCREEN02_RANKING_STRATEGIES.boundedHostReview,
        benchmarkStatus:
          input.host.observation === null
            ? "not-observed" as const
            : "benchmarked" as const,
        genuineExecutions: input.host.genuineExecutions,
        observation: input.host.observation,
      },
      {
        descriptor: SCREEN02_RANKING_STRATEGIES.localEmbedding,
        benchmarkStatus:
          input.localEmbedding === null
            ? "deferred" as const
            : "benchmarked" as const,
        observation: input.localEmbedding,
      },
    ],
    localEmbeddingDecision: {
      outcome: unmetCriteria.length === 0
        ? "eligible-for-reviewed-adoption" as const
        : "deferred" as const,
      criteria,
      unmetCriteria,
      automaticAdoption: false as const,
    },
  };
}
