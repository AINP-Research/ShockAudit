import { describe, expect, it } from "vitest";

import screen02Benchmark from "./fixtures/screen02-generalization-v1.json";
import screen03Benchmark from "./fixtures/screen03-evidence-confirmability-v1.json";
import type { Screen01StudyContext } from "../../src/core/scope-types";
import { buildScreen02WorkflowHandoff } from "../../src/core/screen02-workflow-handoff";
import {
  qualifyAndRankScreen02FindProposals,
  qualifyScreen02FindProposal,
} from "../../src/core/screen02-qualification";
import {
  SCREEN02_LOCAL_EMBEDDING_ADOPTION_CRITERIA,
  SCREEN02_RANKING_STRATEGIES,
  SCREEN02_RANKING_STRATEGY_PROTOCOL_VERSION,
  buildScreen02RankingBenchmarkReport,
} from "../../src/core/screen02-ranking-strategy";
import type { Screen02FindProposal } from "../../src/core/screen02-types";
import {
  SCREEN_03_RESEARCH_PACKET_PROTOCOL_VERSION,
  applyScreen03Action,
  buildScreen03StateFromResearch,
  fingerprintScreen03Value,
  integrateScreen03HostEvidenceMappings,
  restoreScreen03HostEvidenceMappings,
  restoreScreen03VerificationState,
  screen03ProposalConfirmability,
  screen03ProposalHasActiveDirectSupport,
  serializeScreen03VerificationState,
  type Screen03Contradiction,
  type Screen03EvidenceItem,
  type Screen03OfficialField,
  type Screen03PassageBasis,
  type Screen03Proposal,
  type Screen03ProposalGroup,
  type Screen03ResearchPacket,
  type Screen03SupportStatus,
  type Screen03TimelineProposal,
  type Screen03VerificationState,
} from "../../src/core/screen03-workflow";
import { buildReadyFindState } from "../core/screen02-workflow-fixtures";

const at = "2026-09-03T00:00:00.000Z";
const integratedAt = "2026-09-03T00:00:01.000Z";
const actionAt = "2026-09-03T00:00:02.000Z";
const changedAt = "2026-09-03T00:00:03.000Z";

type Screen03BenchmarkCase = (typeof screen03Benchmark.cases)[number];

function context(
  item: (typeof screen02Benchmark.cases)[number],
): Screen01StudyContext {
  const sentence = `Find a ${item.eventFamily} shock affecting ${item.population} in ${item.industry} within ${item.geography} during ${item.studyPeriod}.`;
  return {
    schemaVersion: "1.0",
    appVersion: "0.4.4",
    sourceScreen: "screen-01",
    startingPoint: "find",
    studySentence: sentence,
    contractSourceSentence: sentence,
    knownShock: "",
    scopeContract: {
      population: item.population,
      assignmentLevel: "Not specified",
      analysisLevel: "Organization",
      geography: item.geography,
      industry: item.industry,
      studyPeriod: item.studyPeriod,
      eventFamily: item.eventFamily,
      outcomeFamily: item.outcomeFamily,
      outcomeFrequency: "Not specified",
    },
    resolvedKeys: [],
    unresolvedDecisions: [],
    scopeDirty: false,
    confirmed: true,
    readyForLaterScreens: true,
    revision: 1,
  };
}

function yearIn(period: string) {
  return Number(period.match(/\d{4}/u)?.[0] ?? "2020") + 1;
}

function benchmarkProposal(
  item: (typeof screen02Benchmark.cases)[number],
): Screen02FindProposal {
  const year = yearIn(item.studyPeriod);
  // Frozen candidate facts are inputs. Expected classifications and fixture
  // identifiers are deliberately unavailable to proposal construction so the
  // production qualifier, rather than this harness, creates the result.
  const {
    title,
    industryEvidence,
    affectedPopulation: affectedGroup,
  } = item.candidateInput;
  const description = item.eventFamily === "Disaster"
    ? `The official record for ${title} states that ${title} began on ${year}-01-01 and affected ${affectedGroup} operating through ${industryEvidence}.`
    : `The official record for ${title} states that ${affectedGroup} operating through ${industryEvidence} must change a documented operating requirement beginning in ${year}.`;
  const materialTiming = item.eventFamily === "Disaster"
    ? `Incident began: ${year}-01-01.`
    : "";
  return {
    id: item.candidateId,
    mode: "find",
    kind: "event",
    title,
    description,
    nativeIdentity: {
      formalIdentifier: null,
      issuer: "Benchmark official authority",
      issuingJurisdiction: item.geography,
      status: "Final action",
    },
    event: {
      displayName: title,
      eventDate: `${year}-01-01`,
      eventFamily: item.eventFamily,
      geographies: [item.geography],
      populations: [affectedGroup],
    },
    origin: "newly-discovered",
    provisionalDates: [`${year}-01-01`],
    affectedPopulation: affectedGroup,
    requiredVariables: [
      "Covered-organization status",
      "Effective date",
      "Pre-event exposure indicator",
    ],
    outcomeLink: {
      text: `A preliminary pathway to ${item.outcomeFamily}; no realized value was inspected.`,
      status: "system-template",
    },
    likelyServiceLevel: "event-reconnaissance",
    limitations: ["Screen 3 must verify exact coverage."],
    reasons: ["Frozen production-qualification benchmark input."],
    sources: [{
      id: item.sourceIds[0]!,
      title,
      locator:
        `https://official.example.test/${encodeURIComponent(title.toLocaleLowerCase("en-US"))}`,
      publisher: "Benchmark official authority",
      publishedDate: `${year}-01-01`,
      authorityTier: 1,
      channel: "official-primary",
      retrievedAt: at,
      evidenceText:
        `${title}. Issuing jurisdiction: ${item.geography}. ${description} ${materialTiming} Affected population: ${affectedGroup}.`,
    }],
  };
}

function screen03Input(
  item: Screen03BenchmarkCase,
  options: { activeChangedSource?: boolean } = {},
) {
  // The nested input is frozen independently from the expected outcome. The
  // harness never infers proposal support, source role, fields, or passages
  // from expected labels, scenario tags, or fixture IDs.
  const input = item.input;
  const group = input.group as Screen03ProposalGroup;
  const support = input.proposalSupport as Screen03SupportStatus;
  const evidenceInputs = input.passages.length > 0
    ? input.passages
    : [null];
  const evidence = evidenceInputs.map((passageInput, index): Screen03EvidenceItem => {
    const sourceId = index === 0
      ? item.sourceId
      : `${item.sourceId}:alternative:${index + 1}`;
    const passageId = `${sourceId}:passage:1`;
    return {
      id: sourceId,
      sourceId,
      title: index === 0
        ? item.sourcePlatform
        : `${item.sourcePlatform} — alternative official value`,
      locator: `https://official.example.test/${sourceId}`,
      publisher: item.sourcePlatform,
      publishedDate: null,
      retrievedAt: at,
      authorityTier: item.authorityTier as 1 | 2 | 3 | 4 | 5 | 6,
      channel: input.sourceRole === "related-secondary-record"
        ? "source role: related secondary record"
        : input.conflict
          ? "official-primary; unresolved source conflict"
          : "official-primary",
      sourceRole: input.sourceRole as NonNullable<Screen03EvidenceItem["sourceRole"]>,
      sourcePlatform:
        input.sourcePlatform as NonNullable<Screen03EvidenceItem["sourcePlatform"]>,
      documentType:
        input.documentType as NonNullable<Screen03EvidenceItem["documentType"]>,
      contentFingerprint: fingerprintScreen03Value({
        sourceId,
        passageInput,
        benchmark: screen03Benchmark.benchmarkId,
      }),
      language: "en",
      status: input.evidenceStatus === "changed"
        ? options.activeChangedSource ? "retrieved" : "changed"
        : input.evidenceStatus as Screen03EvidenceItem["status"],
      passages: passageInput
        ? [{
            id: passageId,
            number: 1,
            text: passageInput.text,
            locator: "benchmark exact support",
            basis: passageInput.basis as Screen03PassageBasis,
            officialField: passageInput.officialField as Screen03OfficialField | null,
          }]
        : [],
    };
  });
  const sourceIds = evidence.map((item) => item.id);
  const passageIds = evidence.flatMap((item) =>
    item.passages.map((passage) => passage.id)
  );
  const base = {
    id: item.claimId,
    group,
    label: input.label,
    value: input.value,
    critical: true,
    reviewStatus: "proposed" as const,
    editedValue: null,
    support,
    sourceIds,
    passageIds,
    uncertainty: support === "direct"
      ? null
      : `Benchmark evidence remains ${support}.`,
  };
  const proposal: Screen03Proposal | Screen03TimelineProposal = group === "timeline"
    ? { ...base, group, stage: "effective", date: input.value }
    : base as Screen03Proposal;
  return { proposal, evidence };
}

function effectiveScreen03SupportClass(
  proposal: Screen03Proposal | Screen03TimelineProposal,
  evidence: Screen03EvidenceItem[],
): Screen03SupportStatus {
  return proposal.support === "direct" &&
      !screen03ProposalHasActiveDirectSupport(proposal, evidence)
    ? "unsupported"
    : proposal.support;
}

function controlIdentity(claimId: string) {
  const sourceId = `benchmark-control-identity:${claimId}`;
  const passageId = `${sourceId}:passage:1`;
  const value = "Benchmark official event";
  const evidence: Screen03EvidenceItem = {
    id: sourceId,
    sourceId,
    title: "Benchmark official identity record",
    locator: `https://official.example.test/${sourceId}`,
    publisher: "Benchmark official authority",
    publishedDate: null,
    retrievedAt: at,
    authorityTier: 1,
    channel: "official-primary",
    sourceRole: "controlling-legal-record",
    sourcePlatform: "other-official",
    documentType: "structured-metadata",
    contentFingerprint: fingerprintScreen03Value({ sourceId, value }),
    language: "en",
    status: "retrieved",
    passages: [{
      id: passageId,
      number: 1,
      text: value,
      locator: "canonical title field",
      basis: "official-record-field",
      officialField: "canonical-title",
    }],
  };
  const proposal: Screen03Proposal = {
    id: `benchmark-control-title:${claimId}`,
    group: "identity",
    label: "Canonical title",
    value,
    critical: true,
    reviewStatus: "proposed",
    editedValue: null,
    support: "direct",
    sourceIds: [sourceId],
    passageIds: [passageId],
    uncertainty: null,
  };
  return { evidence, proposal };
}

const benchmarkHandoff = buildScreen02WorkflowHandoff(
  buildReadyFindState(),
  "0.4.4",
  "2026-09-02T23:59:59.000Z",
);

function benchmarkScreen03State(
  item: Screen03BenchmarkCase,
  options: { activeChangedSource?: boolean } = {},
) {
  const input = screen03Input(item, options);
  const proposals: Screen03ResearchPacket["proposals"] = {
    identity: [],
    overview: [],
    timeline: [],
    component: [],
    eligibility: [],
    amendment: [],
    requiredVariable: [],
  };
  if (input.proposal.group === "timeline") {
    proposals.timeline = [input.proposal];
  } else if (input.proposal.group === "identity") {
    proposals.identity = [input.proposal];
  } else if (input.proposal.group === "overview") {
    proposals.overview = [input.proposal];
  } else if (input.proposal.group === "eligibility") {
    proposals.eligibility = [input.proposal];
  } else if (input.proposal.group === "amendment") {
    proposals.amendment = [input.proposal];
  } else {
    proposals.component = [input.proposal];
  }
  const evidence = [...input.evidence];
  const control = controlIdentity(item.claimId);
  if (input.proposal.group !== "identity") {
    proposals.identity.push(control.proposal);
  }
  // Preserve one explicitly unrelated active source for source-change controls,
  // including fixtures whose target claim is itself an identity proposal.
  evidence.push(control.evidence);
  const contradictions: Screen03Contradiction[] =
    item.input.conflict
      ? [{
          id: `benchmark-conflict:${item.claimId}`,
          kind: "source-conflict",
          proposalIds: [item.claimId],
          summary: item.input.passages.map((passage) => passage.text).join("; ") ||
            "Official values conflict.",
          status: "unresolved",
          resolution: null,
        }]
      : [];
  const packet: Screen03ResearchPacket = {
    protocolVersion: SCREEN_03_RESEARCH_PACKET_PROTOCOL_VERSION,
    researchedAt: at,
    upstreamEventFingerprint: benchmarkHandoff.integrity.eventFingerprint,
    coverage: {
      queries: [{
        id: `benchmark-query:${item.claimId}`,
        query: `Verify ${item.claimId}`,
        purpose: "Exercise the frozen Screen 3 evidence contract.",
        returnedEvidenceIds: evidence.map((entry) => entry.id),
      }],
      channels: [{
        channel: "benchmark-reviewed-source",
        status: "searched",
        note: "Frozen evidence was supplied to the production workflow core.",
        retrievedAt: at,
      }],
      routes: ["frozen-benchmark"],
      stages: [input.proposal.group],
      languages: ["en"],
      authorityTiers: [...new Set(evidence
        .filter((entry) => entry.status !== "changed")
        .map((entry) => entry.authorityTier))].sort(),
      gaps: [],
      recordsReviewed: evidence.length,
      activeEvidenceCount: evidence.filter((entry) =>
        entry.status !== "changed"
      ).length,
      exhaustive: false,
      stoppingRule: {
        rule: "Stop after the frozen source contract has been exercised.",
        status: "met",
        note: "The bounded fixture input was exhausted.",
      },
      outcomeValuesInspected: false,
    },
    evidence,
    proposals,
    contradictions,
    outcomeValuesInspected: false,
  };
  return buildScreen03StateFromResearch(
    benchmarkHandoff,
    packet,
    integratedAt,
  );
}

function stateProposal(
  state: Screen03VerificationState,
  proposalId: string,
) {
  return [
    ...state.proposals.identity,
    ...state.proposals.overview,
    ...state.proposals.timeline,
    ...state.proposals.component,
    ...state.proposals.eligibility,
    ...state.proposals.amendment,
    ...state.proposals.requiredVariable,
  ].find((proposal) => proposal.id === proposalId)!;
}

function restoredDecision(
  state: Screen03VerificationState,
  proposalId: string,
) {
  const restored = restoreScreen03VerificationState(
    JSON.parse(serializeScreen03VerificationState(state)),
  );
  expect(restored).not.toBeNull();
  return stateProposal(restored!, proposalId);
}

function reviewBenchmarkClaim(
  state: Screen03VerificationState,
  item: Screen03BenchmarkCase,
  decision: "accept" | "edit" | "reject" | "unresolved",
  editedValue?: string,
) {
  return applyScreen03Action(state, {
    type: "review-field",
    proposalId: item.claimId,
    decision,
    ...(editedValue === undefined ? {} : { editedValue }),
    reason: `Exercise the frozen ${decision} result.`,
    at: actionAt,
  });
}

function correctedBenchmarkValue(
  proposal: Screen03Proposal | Screen03TimelineProposal,
) {
  if (proposal.group === "timeline") return proposal.value;
  const lower = proposal.value.toLocaleLowerCase("en-US");
  return lower === proposal.value
    ? proposal.value.toLocaleUpperCase("en-US")
    : lower;
}

function screen03SourceChangePlan(item: Screen03BenchmarkCase) {
  const preChangeDecision = item.input.sourceChange.preChangeDecision;
  if (
    preChangeDecision !== "accept" &&
    preChangeDecision !== "unresolved"
  ) {
    throw new Error("Frozen source-change input has an invalid pre-change decision.");
  }
  return {
    activeChangedSource: item.input.evidenceStatus === "changed",
    targetRelation: item.input.sourceChange.targetRelation,
    preChangeDecision,
  } as const;
}

function screen03SourceChangeTargetId(item: Screen03BenchmarkCase) {
  return item.input.sourceChange.targetRelation === "claim-linked-source"
    ? item.sourceId
    : controlIdentity(item.claimId).evidence.id;
}

function hostMappingFor(
  state: Screen03VerificationState,
  proposalId: string,
) {
  const proposal = stateProposal(state, proposalId);
  const passage = state.evidence
    .flatMap((evidence) => evidence.passages)
    .find((candidate) => proposal.passageIds.includes(candidate.id));
  if (!passage) {
    return [{
      claimId: proposalId,
      passageIds: ["missing:passage"],
      quotedSpans: [{
        passageId: "missing:passage",
        start: 0,
        end: 7,
        text: "missing",
      }],
      status: "direct" as const,
    }];
  }
  return [{
    claimId: proposalId,
    passageIds: [passage.id],
    quotedSpans: [{
      passageId: passage.id,
      start: 0,
      end: passage.text.length,
      text: passage.text,
    }],
    status: "direct" as const,
  }];
}

describe("frozen generalization fixtures against production policy", () => {
  it("keeps frozen production inputs independent from expected outcomes, tags, and fixture IDs", () => {
    const screen02Case = screen02Benchmark.cases[0]!;
    const alteredScreen02Case = structuredClone(screen02Case);
    alteredScreen02Case.candidateId = "adversarial-renamed-candidate";
    alteredScreen02Case.expectedMaximumClass = "mismatch";
    alteredScreen02Case.expectedExclusion = "industry-mismatch";
    alteredScreen02Case.rationale = "An intentionally false expected label.";
    const screen02Semantics = (
      proposal: Screen02FindProposal,
    ) => ({
      ...proposal,
      id: "excluded-fixture-identity",
      sources: proposal.sources.map((source) => ({
        ...source,
        id: "excluded-source-identity",
      })),
    });
    expect(screen02Semantics(benchmarkProposal(alteredScreen02Case))).toEqual(
      screen02Semantics(benchmarkProposal(screen02Case)),
    );

    const screen03Case = screen03Benchmark.cases[0]!;
    const alteredScreen03Case = structuredClone(screen03Case);
    alteredScreen03Case.claimId = "adversarial-renamed-claim";
    alteredScreen03Case.expectedSupportClass = "unsupported";
    alteredScreen03Case.expectedConfirmability = false;
    alteredScreen03Case.expectedReason = "no-direct-support";
    alteredScreen03Case.exactOfficialSupport = "Intentionally false expected text.";
    alteredScreen03Case.evidenceBasis = "malformed";
    alteredScreen03Case.scenarioTags = ["wrong-event", "conflict"];
    alteredScreen03Case.actions.sourceChange =
      screen03Case.actions.sourceChange === "reopens-decision"
        ? "preserves-decision"
        : "reopens-decision";
    const screen03Semantics = (
      value: ReturnType<typeof screen03Input>,
    ) => ({
      proposal: {
        ...value.proposal,
        id: "excluded-fixture-identity",
        sourceIds: [],
        passageIds: [],
      },
      evidence: value.evidence.map((source) => ({
        ...source,
        id: "excluded-source-identity",
        sourceId: "excluded-source-identity",
        contentFingerprint: "excluded-content-fingerprint",
        passages: source.passages.map((passage) => ({
          ...passage,
          id: "excluded-passage-identity",
        })),
      })),
    });
    expect(screen03Semantics(screen03Input(alteredScreen03Case))).toEqual(
      screen03Semantics(screen03Input(screen03Case)),
    );
    expect(screen03SourceChangePlan(alteredScreen03Case)).toEqual(
      screen03SourceChangePlan(screen03Case),
    );
  });

  it("runs every Screen 2 case through production qualification and computes acceptance metrics", () => {
    const evaluated = screen02Benchmark.cases.map((item) => {
      const proposal = benchmarkProposal(item);
      const qualification = qualifyScreen02FindProposal(proposal, context(item), {
        scopeFingerprint: item.scopeId,
      });
      return { item, proposal, qualification };
    });
    const classificationMismatches = evaluated.flatMap(({ item, qualification }) =>
      qualification.classification === item.expectedMaximumClass ? [] : [{
        candidateId: item.candidateId,
        expected: item.expectedMaximumClass,
        actual: qualification.classification,
      }]
    );
    const exclusionMismatches = evaluated.flatMap(({ item, qualification }) => {
      const matches = item.expectedExclusion === null
        ? qualification.exclusionCodes.length === 0
        : qualification.exclusionCodes.includes(item.expectedExclusion as never);
      return matches ? [] : [{
        candidateId: item.candidateId,
        expected: item.expectedExclusion,
        actual: qualification.exclusionCodes,
      }];
    });
    const outcomeOrderMismatches = evaluated.flatMap(({ item, qualification }) => {
      const notEvaluated = qualification.outcomeFit.status === "not-evaluated";
      return notEvaluated === !qualification.eligible ? [] : [{
        candidateId: item.candidateId,
        eligible: qualification.eligible,
        outcomeStatus: qualification.outcomeFit.status,
      }];
    });
    const outcomeLeakageMismatches = evaluated.flatMap(({ item, proposal, qualification }) => {
      const alteredContext = context(item);
      alteredContext.scopeContract.outcomeFamily = "Adversarial outcome wording";
      const altered = qualifyScreen02FindProposal(
        {
          ...proposal,
          outcomeLink: {
            text: "Large positive realized effects and favorable significance.",
            status: "ai-hypothesis",
          },
        },
        alteredContext,
        { scopeFingerprint: item.scopeId },
      );
      return altered.classification === qualification.classification &&
          altered.eligible === qualification.eligible &&
          altered.ranking.baseScore === qualification.ranking.baseScore
        ? []
        : [{
            candidateId: item.candidateId,
            before: {
              classification: qualification.classification,
              eligible: qualification.eligible,
              score: qualification.ranking.baseScore,
            },
            after: {
              classification: altered.classification,
              eligible: altered.eligible,
              score: altered.ranking.baseScore,
            },
          }];
    });
    expect(classificationMismatches).toEqual([]);
    expect(exclusionMismatches).toEqual([]);
    expect(outcomeOrderMismatches).toEqual([]);
    expect(outcomeLeakageMismatches).toEqual([]);

    const byScope = new Map<string, typeof evaluated>();
    for (const entry of evaluated) {
      const values = byScope.get(entry.item.scopeId) ?? [];
      values.push(entry);
      byScope.set(entry.item.scopeId, values);
    }
    const rankedByScope = [...byScope.values()].map((entries) => ({
      reviewedCount: entries.length,
      selected: qualifyAndRankScreen02FindProposals(
        entries.map((entry) => entry.proposal),
        context(entries[0]!.item),
        { scopeFingerprint: entries[0]!.item.scopeId, maximumCandidates: 10 },
      ).selected,
    }));
    const ranked = rankedByScope.flatMap((pool) => pool.selected);
    const expectedRelevant = new Set(evaluated
      .filter(({ item }) => item.expectedMaximumClass !== "mismatch")
      .map(({ item }) => item.candidateId));
    const mismatches = evaluated.filter(({ qualification }) =>
      qualification.classification === "mismatch");
    const displayedTruePositives = ranked.filter(({ proposal }) =>
      expectedRelevant.has(proposal.id)).length;
    const fullTopTenPools = rankedByScope.filter(
      (pool) => pool.reviewedCount >= 10 && pool.selected.length >= 10,
    );
    const precisionAt10 = fullTopTenPools.length === 0
      ? null
      : fullTopTenPools.reduce((truePositives, pool) =>
          truePositives + pool.selected.slice(0, 10).filter(({ proposal }) =>
            expectedRelevant.has(proposal.id)
          ).length, 0) / (fullTopTenPools.length * 10);
    const metrics = {
      rawRecords: evaluated.length,
      uniqueLeads: new Set(evaluated.map(({ proposal }) => proposal.id)).size,
      qualifiedCount: evaluated.filter(({ qualification }) => qualification.eligible).length,
      displayedCount: ranked.length,
      directCount: evaluated.filter(({ qualification }) => qualification.classification === "direct").length,
      adjacentCount: evaluated.filter(({ qualification }) => qualification.classification === "adjacent").length,
      broadCount: evaluated.filter(({ qualification }) => qualification.classification === "broad").length,
      mismatchCount: mismatches.length,
      precisionAmongDisplayed: ranked.length === 0 ? 1 : displayedTruePositives / ranked.length,
      precisionAmongTopFive: ranked.slice(0, 5).length === 0 ? 1 : ranked.slice(0, 5)
        .filter(({ proposal }) => expectedRelevant.has(proposal.id)).length / ranked.slice(0, 5).length,
      precisionAt10,
      maximumReviewedScopePool: Math.max(
        0,
        ...rankedByScope.map((pool) => pool.reviewedCount),
      ),
      firstDirectlyRelevantRank: ranked.findIndex(({ qualification }) =>
        qualification.classification === "direct") + 1,
      falsePositiveRate: ranked.length === 0 ? 0 : (ranked.length - displayedTruePositives) / ranked.length,
      duplicateRate: 1 - new Set(evaluated.map(({ proposal }) => proposal.id)).size / evaluated.length,
      sourceQualityExclusions: evaluated.filter(({ qualification }) =>
        qualification.exclusionCodes.includes("insufficient-source-quality")).length,
      substantiveInformationExclusions: evaluated.filter(({ qualification }) =>
        qualification.exclusionCodes.includes("excluded-insufficient-substantive-information")).length,
      hardScopeExclusions: evaluated.filter(({ qualification }) =>
        qualification.exclusionCodes.includes("hard-scope-mismatch")).length,
      exposureFeasibilityExclusions: evaluated.filter(({ qualification }) =>
        qualification.exclusionCodes.includes("exposure-infeasible")).length,
      searchShortfall: [...byScope.values()].reduce((sum, entries) =>
        sum + Math.max(0, 10 - entries.filter(({ qualification }) => qualification.eligible).length), 0),
      hostContribution: 0,
    };
    expect(metrics.rawRecords).toBe(screen02Benchmark.cases.length);
    expect(metrics.uniqueLeads).toBe(metrics.rawRecords);
    expect(metrics.displayedCount).toBe(metrics.qualifiedCount);
    expect(metrics.precisionAmongDisplayed).toBe(1);
    expect(metrics.precisionAmongTopFive).toBe(1);
    expect(metrics.maximumReviewedScopePool).toBeLessThan(10);
    expect(metrics.precisionAt10).toBeNull();
    expect(metrics.falsePositiveRate).toBe(0);
    expect(metrics.duplicateRate).toBe(0);
    expect(metrics.firstDirectlyRelevantRank).toBeGreaterThan(0);
    expect(metrics.directCount).toBeGreaterThan(0);
    expect(metrics.adjacentCount).toBeGreaterThan(0);
    expect(metrics.broadCount).toBeGreaterThan(0);
    expect(metrics.mismatchCount).toBeGreaterThan(0);
    expect(Object.values(metrics).filter((value) => value !== null)
      .every((value) => Number.isFinite(value) && value >= 0)).toBe(true);
    expect(ranked.every(({ qualification }) => qualification.classification !== "mismatch")).toBe(true);

    const strategyReport = buildScreen02RankingBenchmarkReport({
      benchmarkId: screen02Benchmark.benchmarkId,
      deterministic: {
        evaluatedCases: metrics.rawRecords,
        precisionAt10: metrics.precisionAt10,
        availablePoolPrecision: metrics.precisionAmongDisplayed,
        availablePoolSize: metrics.displayedCount,
      },
      host: { genuineExecutions: 0, observation: null },
      localEmbedding: null,
    });
    expect(strategyReport).toEqual({
      protocolVersion: SCREEN02_RANKING_STRATEGY_PROTOCOL_VERSION,
      benchmarkId: "screen02-cross-domain-v1",
      strategies: [
        {
          descriptor: SCREEN02_RANKING_STRATEGIES.deterministicProfile,
          benchmarkStatus: "benchmarked",
          observation: {
            evaluatedCases: 16,
            precisionAt10: null,
            availablePoolPrecision: 1,
            availablePoolSize: 14,
          },
        },
        {
          descriptor: SCREEN02_RANKING_STRATEGIES.boundedHostReview,
          benchmarkStatus: "not-observed",
          genuineExecutions: 0,
          observation: null,
        },
        {
          descriptor: SCREEN02_RANKING_STRATEGIES.localEmbedding,
          benchmarkStatus: "deferred",
          observation: null,
        },
      ],
      localEmbeddingDecision: {
        outcome: "deferred",
        criteria: Object.fromEntries(
          SCREEN02_LOCAL_EMBEDDING_ADOPTION_CRITERIA.map((criterion) => [
            criterion,
            false,
          ]),
        ),
        unmetCriteria: SCREEN02_LOCAL_EMBEDDING_ADOPTION_CRITERIA,
        automaticAdoption: false,
      },
    });
  });

  it("classifies every Screen 3 fixture with its exact production reason and evidence metadata", () => {
    const mismatches = screen03Benchmark.cases.flatMap((item) => {
      const { proposal, evidence } = screen03Input(item);
      const result = screen03ProposalConfirmability(proposal, evidence);
      const supportClass = effectiveScreen03SupportClass(proposal, evidence);
      const supportParts = (item.exactOfficialSupport ?? "")
        .split(/;\s*/u)
        .filter(Boolean);
      const passageText = evidence
        .flatMap((source) => source.passages)
        .map((passage) => passage.text)
        .join("; ");
      const exactEvidenceVisible = item.exactOfficialSupport === null
        ? evidence.every((source) => source.passages.length === 0) ||
          item.input.sourceRole === "related-secondary-record"
        : supportParts.every((part) => passageText.includes(part));
      const frozenInputPassages = new Set(
        item.input.passages.map((passage) => JSON.stringify({
          text: passage.text,
          basis: passage.basis,
          officialField: passage.officialField,
        })),
      );
      const evidenceMetadataValid = evidence.every((source) =>
        source.authorityTier === item.authorityTier &&
        source.retrievedAt === at &&
        source.language === "en" &&
        /^fnv1a64:[0-9a-f]{16}$/u.test(source.contentFingerprint) &&
        source.passages.every((passage) => frozenInputPassages.has(JSON.stringify({
          text: passage.text,
          basis: passage.basis,
          officialField: passage.officialField,
        })))
      );
      return supportClass === item.expectedSupportClass &&
          result.confirmable === item.expectedConfirmability &&
          result.reason === item.expectedReason &&
          exactEvidenceVisible &&
          evidenceMetadataValid
        ? []
        : [{
            claimId: item.claimId,
            expectedSupportClass: item.expectedSupportClass,
            actualSupportClass: supportClass,
            expectedConfirmability: item.expectedConfirmability,
            actualConfirmability: result.confirmable,
            expectedReason: item.expectedReason,
            actualReason: result.reason,
            exactEvidenceVisible,
            evidenceMetadataValid,
          }];
    });
    expect(mismatches).toEqual([]);
  });

  it("executes Confirm and Correct through production state transitions and restoration", () => {
    const failures: Array<Record<string, unknown>> = [];
    for (const item of screen03Benchmark.cases) {
      const state = benchmarkScreen03State(item);
      const proposal = stateProposal(state, item.claimId);
      try {
        const confirmed = reviewBenchmarkClaim(state, item, "accept");
        if (item.actions.confirm === "disabled") {
          failures.push({
            claimId: item.claimId,
            action: "confirm",
            expected: "disabled",
            actual: stateProposal(confirmed, item.claimId).reviewStatus,
          });
        } else {
          const restored = restoredDecision(confirmed, item.claimId);
          if (restored.reviewStatus !== "accepted") {
            failures.push({
              claimId: item.claimId,
              action: "confirm",
              expected: "accepted after restore",
              actual: restored.reviewStatus,
            });
          }
        }
      } catch (error) {
        if (item.actions.confirm !== "disabled") {
          failures.push({
            claimId: item.claimId,
            action: "confirm",
            expected: item.actions.confirm,
            error: String(error),
          });
        }
      }

      try {
        const editedValue = correctedBenchmarkValue(proposal);
        const corrected = reviewBenchmarkClaim(
          state,
          item,
          "edit",
          editedValue,
        );
        if (item.actions.correct === "unavailable") {
          failures.push({
            claimId: item.claimId,
            action: "correct",
            expected: "unavailable",
            actual: stateProposal(corrected, item.claimId).reviewStatus,
          });
        } else {
          const restored = restoredDecision(corrected, item.claimId);
          if (
            restored.reviewStatus !== "edited" ||
            restored.editedValue !== editedValue
          ) {
            failures.push({
              claimId: item.claimId,
              action: "correct",
              expected: { reviewStatus: "edited", editedValue },
              actual: {
                reviewStatus: restored.reviewStatus,
                editedValue: restored.editedValue,
              },
            });
          }
        }
      } catch (error) {
        if (item.actions.correct !== "unavailable") {
          failures.push({
            claimId: item.claimId,
            action: "correct",
            expected: item.actions.correct,
            error: String(error),
          });
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("persists Needs more evidence and Not correct for every Screen 3 fixture", () => {
    const failures: Array<Record<string, unknown>> = [];
    for (const item of screen03Benchmark.cases) {
      for (const [decision, status] of [
        ["unresolved", "unresolved"],
        ["reject", "rejected"],
      ] as const) {
        try {
          const decided = reviewBenchmarkClaim(
            benchmarkScreen03State(item),
            item,
            decision,
          );
          const restored = restoredDecision(decided, item.claimId);
          const finalEvent = restored.reviewStatus === status
            ? decided.history.findLast((event) =>
                event.action === "review-field" &&
                event.targetId === item.claimId
              )
            : null;
          if (
            restored.reviewStatus !== status ||
            finalEvent?.nextReviewStatus !== status
          ) {
            failures.push({
              claimId: item.claimId,
              decision,
              expected: status,
              actual: restored.reviewStatus,
              historyStatus: finalEvent?.nextReviewStatus,
            });
          }
        } catch (error) {
          failures.push({
            claimId: item.claimId,
            decision,
            error: String(error),
          });
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("executes each declared source-change result and retains prior decisions in immutable history", () => {
    const failures: Array<Record<string, unknown>> = [];
    for (const item of screen03Benchmark.cases) {
      try {
        const plan = screen03SourceChangePlan(item);
        const state = benchmarkScreen03State(item, {
          activeChangedSource: plan.activeChangedSource,
        });
        const decided = reviewBenchmarkClaim(
          state,
          item,
          plan.preChangeDecision,
        );
        const proposalBeforeChange = stateProposal(decided, item.claimId);
        const linkedSourceIds = new Set(proposalBeforeChange.sourceIds);
        const source = decided.evidence.find(
          (entry) => entry.id === screen03SourceChangeTargetId(item),
        );
        if (!source) throw new Error("No source was available for the declared change result.");
        const targetIsLinked = linkedSourceIds.has(source.id) ||
          (source.sourceId !== null && linkedSourceIds.has(source.sourceId));
        const stimulusMatchesInput =
          plan.targetRelation === "claim-linked-source"
            ? targetIsLinked
            : !targetIsLinked;
        const changed = applyScreen03Action(decided, {
          type: "mark-source-changed",
          sourceId: source.id,
          contentFingerprint: fingerprintScreen03Value({
            previous: source.contentFingerprint,
            changedFor: item.claimId,
          }),
          reason: "Exercise the frozen source-change result.",
          at: changedAt,
        });
        const restored = restoreScreen03VerificationState(
          JSON.parse(serializeScreen03VerificationState(changed)),
        );
        if (!restored) throw new Error("Changed state did not restore.");
        const after = stateProposal(restored, item.claimId);
        const change = restored.sourceChanges?.at(-1);
        const preservedDecision = restored.history.some((event) =>
          event.action === "review-field" &&
          event.targetId === item.claimId &&
          event.nextReviewStatus === proposalBeforeChange.reviewStatus
        );
        const shouldReopen = item.actions.sourceChange === "reopens-decision";
        const resultMatches = shouldReopen
          ? after.reviewStatus === "proposed" &&
            after.support === "unsupported" &&
            change?.reopenedProposalIds.includes(item.claimId) === true &&
            change.staleProposals.some((proposal) =>
              proposal.id === item.claimId &&
              proposal.reviewStatus === proposalBeforeChange.reviewStatus
            )
          : after.reviewStatus === proposalBeforeChange.reviewStatus &&
            change?.reopenedProposalIds.includes(item.claimId) === false;
        if (!stimulusMatchesInput || !resultMatches || !preservedDecision) {
          failures.push({
            claimId: item.claimId,
            expected: item.actions.sourceChange,
            before: proposalBeforeChange.reviewStatus,
            after: after.reviewStatus,
            afterSupport: after.support,
            reopenedProposalIds: change?.reopenedProposalIds,
            stimulusMatchesInput,
            preservedDecision,
          });
        }
      } catch (error) {
        failures.push({
          claimId: item.claimId,
          expected: item.actions.sourceChange,
          error: String(error),
        });
      }
    }
    expect(failures).toEqual([]);
  });

  it("executes every declared host-mapping result without making a researcher decision", () => {
    const failures: Array<Record<string, unknown>> = [];
    for (const item of screen03Benchmark.cases) {
      if (item.actions.hostMapping === "not-required") continue;
      try {
        const state = benchmarkScreen03State(item);
        const mapping = hostMappingFor(state, item.claimId);
        const restored = restoreScreen03HostEvidenceMappings(mapping, state);
        if (item.actions.hostMapping === "must-reject") {
          if (restored !== null) {
            failures.push({
              claimId: item.claimId,
              expected: "must-reject",
              actual: "accepted",
            });
          }
          continue;
        }
        if (!restored) {
          failures.push({
            claimId: item.claimId,
            expected: item.actions.hostMapping,
            actual: "rejected",
          });
          continue;
        }
        const integrated = integrateScreen03HostEvidenceMappings(
          state,
          restored,
          {
            claimGroupId: `benchmark:${item.claimId}`,
            resultId: `benchmark-result:${item.claimId}`,
            applicationBindingFingerprint: fingerprintScreen03Value({
              benchmarkId: screen03Benchmark.benchmarkId,
              claimId: item.claimId,
              sourceId: item.sourceId,
            }),
            at: actionAt,
          },
        );
        const proposal = restoredDecision(integrated.state, item.claimId);
        if (
          proposal.reviewStatus !== "proposed" ||
          integrated.state.history.at(-1)?.action !==
            "host-evidence-mapping-applied"
        ) {
          failures.push({
            claimId: item.claimId,
            expected: "noncanonical mapping with no researcher decision",
            actual: {
              reviewStatus: proposal.reviewStatus,
              historyAction: integrated.state.history.at(-1)?.action,
            },
          });
        }
      } catch (error) {
        failures.push({
          claimId: item.claimId,
          expected: item.actions.hostMapping,
          error: String(error),
        });
      }
    }
    expect(failures).toEqual([]);
  });

  it("keeps an unresolved official-source conflict unconfirmable and preserves it in the Event Card", () => {
    const item = screen03Benchmark.cases.find((entry) =>
      entry.input.conflict
    )!;
    let state = benchmarkScreen03State(item);
    const conflictProposal = stateProposal(state, item.claimId);
    const conflict = state.contradictions.find((entry) =>
      entry.proposalIds.includes(item.claimId)
    );
    expect(new Set(conflictProposal.sourceIds).size).toBe(2);
    expect(conflictProposal.passageIds).toHaveLength(2);
    expect(state.evidence
      .filter((source) => conflictProposal.sourceIds.includes(source.id))
      .map((source) => source.passages[0]?.text)).toEqual([
        "2020-01-01: Instrument A commences on publication",
        "2020-07-01: Instrument B applies six months later.",
      ]);
    expect(conflict).toMatchObject({
      kind: "source-conflict",
      status: "unresolved",
      resolution: null,
    });
    expect(() => reviewBenchmarkClaim(state, item, "accept")).toThrow(
      /active direct passage support/iu,
    );
    expect(() => reviewBenchmarkClaim(
      state,
      item,
      "edit",
      stateProposal(state, item.claimId).value,
    )).toThrow(/active direct passage support/iu);
    state = reviewBenchmarkClaim(state, item, "unresolved");
    const control = state.proposals.identity.find((proposal) =>
      proposal.id.startsWith("benchmark-control-title:")
    )!;
    state = applyScreen03Action(state, {
      type: "review-field",
      proposalId: control.id,
      decision: "accept",
      reason: "Accept the independently supported event identity.",
      at: changedAt,
    });
    state = applyScreen03Action(state, {
      type: "lock-event-card",
      reason: "Lock while preserving the explicitly unresolved conflict.",
      at: "2026-09-03T00:00:04.000Z",
    });
    expect(state.lockedEventCard?.contradictions).toContainEqual(
      expect.objectContaining({
        id: conflict?.id,
        status: "unresolved",
        resolution: null,
      }),
    );
    expect(state.lockedEventCard?.reviewedProposals.timeline).toContainEqual(
      expect.objectContaining({
        id: item.claimId,
        decision: "unresolved",
        resolvedValue: null,
      }),
    );
    expect(state.lockedEventCard?.linkedEvidence.map((source) => source.id))
      .toEqual(expect.arrayContaining(conflictProposal.sourceIds));
    expect(restoreScreen03VerificationState(
      JSON.parse(serializeScreen03VerificationState(state)),
    )).not.toBeNull();
  });
});
