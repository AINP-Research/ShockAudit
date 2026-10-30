import { describe, expect, it } from "vitest";

import type { Screen01StudyContext } from "../../src/core/scope-types";
import { deduplicateScreen02Proposals } from "../../src/core/screen02-discovery";
import {
  SCREEN02_CANDIDATE_REVIEW_INFLUENCE_TRACE_VERSION,
  SCREEN02_CANDIDATE_QUALIFICATION_MIGRATION_VERSION,
  SCREEN02_CANDIDATE_QUALIFICATION_PREVIOUS_VERSION,
  SCREEN02_CANDIDATE_QUALIFICATION_VERSION,
  SCREEN02_QUALIFICATION_GROUNDING_POLICY_VERSION,
  fingerprintScreen02QualificationProfile,
  fingerprintScreen02QualificationSources,
  isScreen02CandidateQualification,
  migrateScreen02CandidateQualification,
  qualifyAndRankScreen02FindProposals,
  qualifyScreen02FindProposal,
  screen02IndustryBridgeEvidence,
  screen02QualificationDiversityAdjustment,
  screen02QualificationDiversityDimensions,
  screen02QualificationDiversityKeys,
  validateScreen02CandidateReviewInfluenceMap,
  type Screen02CandidateReviewInfluence,
} from "../../src/core/screen02-qualification";
import { SCREEN02_SOURCE_GROUNDING_VERSION } from
  "../../src/core/screen02-source-grounding";
import {
  SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
  type Screen02FindProposal,
  type Screen02Source,
} from "../../src/core/screen02-types";
import {
  screen02MaterialTimingFacts,
  screen02ProposalHasPreliminaryLifecycle,
} from "../../src/core/screen02-service";
import { buildScreen02StudyRelevanceProfile } from "../../src/core/screen02-relevance-profile";

function context(
  industry:
    | "Manufacturing"
    | "Video gaming"
    | "Banking"
    | "Energy"
    | "Technology",
  outcomeFamily: "Innovation" | "Employment" | "Investment" = "Innovation",
) {
  const sentence = `Find a regulatory shock affecting U.S. public ${industry.toLowerCase()} firms between 2014 and 2022 that may influence firm ${outcomeFamily.toLowerCase()}.`;
  return {
    schemaVersion: "1.0",
    appVersion: "0.4.03",
    sourceScreen: "screen-01",
    startingPoint: "find",
    studySentence: sentence,
    contractSourceSentence: sentence,
    knownShock: "",
    scopeContract: {
      population: "Public firms",
      assignmentLevel: "Not specified",
      analysisLevel: "Firm",
      geography: "United States",
      industry,
      studyPeriod: "2014–2022",
      eventFamily: "Regulation",
      outcomeFamily,
      outcomeFrequency: "Not specified",
    },
    resolvedKeys: [],
    unresolvedDecisions: [],
    scopeDirty: false,
    confirmed: true,
    readyForLaterScreens: true,
    revision: 3,
  } satisfies Screen01StudyContext;
}

function source(id: string, title: string, tier: 1 | 2 | 3 | 4 | 5 | 6 = 1) {
  return {
    id,
    title,
    locator: `https://www.federalregister.gov/documents/${id}`,
    publisher: "Federal Register",
    publishedDate: "2019-06-06",
    authorityTier: tier,
    channel: tier === 6 ? "contextual-secondary" : "official-primary",
  } satisfies Screen02Source;
}

function proposal(
  id: string,
  input: {
    title: string;
    description: string;
    populations: string[];
    sourceTitle?: string;
    origin?: Screen02FindProposal["origin"];
    tier?: 1 | 2 | 3 | 4 | 5 | 6;
    geographies?: string[];
  },
): Screen02FindProposal {
  return {
    id,
    mode: "find",
    kind: "event",
    title: input.title,
    description: input.description,
    nativeIdentity: {
      formalIdentifier: id.toUpperCase(),
      issuer: "Example Federal Agency",
      issuingJurisdiction: "United States",
      status: "Final rule",
    },
    event: {
      displayName: input.title,
      eventDate: "2019-06-06",
      eventFamily: "Regulation",
      geographies: input.geographies ?? ["United States"],
      populations: input.populations,
    },
    origin: input.origin ?? "newly-discovered",
    provisionalDates: ["Effective date: 2019-06-06"],
    affectedPopulation: input.populations.join("; "),
    requiredVariables: [
      "Covered-entity status",
      "Effective date",
      "Pre-event exposure indicator",
    ],
    outcomeLink: {
      text:
        "A generated template says this event may influence innovation, but the qualifier must not use that wording to rescue scope.",
      status: "system-template",
    },
    likelyServiceLevel: "event-reconnaissance",
    limitations: ["Screen 3 must verify operative coverage."],
    reasons: ["Returned by a bounded official query."],
    sources: [
      {
        ...source(
        `${id}-source`,
        input.sourceTitle ?? input.title,
        input.tier ?? 1,
        ),
        evidenceText: [
          `${input.title}.`,
          `Issuing jurisdiction: ${(input.geographies ?? ["United States"]).join("; ")}.`,
          input.description,
          `Affected population: ${input.populations.join("; ")}.`,
        ].join(" "),
      },
    ],
  };
}

const manufacturingRule = proposal("manufacturing-rule", {
  title: "Manufacturing Facility Product-Safety Rule",
  description:
    "The final rule requires covered manufacturers and public manufacturing firms to change product-safety controls at production facilities beginning in 2019.",
  populations: ["Public manufacturing firms and covered manufacturers"],
});

const videoGamingRule = proposal("video-gaming-rule", {
  title: "Video Game Platform Consumer-Protection Rule",
  description:
    "The final rule requires video game publishers and online game platforms to change account and product disclosures for users beginning in 2019.",
  populations: ["Video game publishers and online game platform firms"],
});

const broadCorporateRule = (id: string) =>
  proposal(id, {
    title: `Cross-industry corporate disclosure rule ${id}`,
    description:
      "The final rule requires qualifying public companies and other covered businesses to change organization-level disclosures beginning in 2019.",
    populations: ["Qualifying public companies across industries"],
  });

const bankingRule = proposal("banking-rule", {
  title: "Bank Liquidity and Employment Reporting Rule",
  description:
    "The final rule requires public banks and depository institutions to change liquidity reporting and staffing processes beginning in 2019.",
  populations: ["Public banks and depository institutions"],
});

const energyRule = proposal("energy-rule", {
  title: "Electric Utility Grid-Investment Rule",
  description:
    "The final rule requires public electric utilities and power producers to change grid-investment planning beginning in 2019.",
  populations: ["Public electric utilities and power producers"],
});

function candidateReviewProfile(scopeFingerprint: string) {
  const study = context("Manufacturing");
  const profile = buildScreen02StudyRelevanceProfile({
    scopeFingerprint,
    originalIndustryText: study.scopeContract.industry,
    sampleGeography: study.scopeContract.geography,
    studyPeriod: study.scopeContract.studyPeriod,
    eventFamily: study.scopeContract.eventFamily,
    at: "2026-09-03T12:00:00.000Z",
  });
  if (!profile.supplyChainRelationships.includes("semiconductor equipment supply")) {
    profile.supplyChainRelationships.push("semiconductor equipment supply");
  }
  return profile;
}

function candidateReviewProposal(
  id: string,
  input: {
    base?: Screen02FindProposal;
    evidenceText?: string;
    tier?: 1 | 2 | 3 | 4 | 5 | 6;
  } = {},
) {
  const base = input.base ?? manufacturingRule;
  return {
    ...structuredClone(base),
    id,
    nativeIdentity: {
      ...structuredClone(base.nativeIdentity!),
      formalIdentifier: id.toUpperCase(),
    },
    sources: base.sources.map((candidateSource, index) => ({
      ...structuredClone(candidateSource),
      id: `${id}-source-${index + 1}`,
      authorityTier: input.tier ?? candidateSource.authorityTier,
      evidenceText: [
        `${base.title}.`,
        `Issuing jurisdiction: ${base.event.geographies.join("; ")}.`,
        base.description,
        `Affected population: ${[
          ...base.event.populations,
          base.affectedPopulation,
        ].join("; ")}.`,
        input.evidenceText ??
          "This rule applies new controls through the semiconductor equipment supply relationship beginning in 2019.",
      ].join(" "),
    })),
  } satisfies Screen02FindProposal;
}

function candidateReviewInfluence(
  proposal: Screen02FindProposal,
  proposedClass: Screen02CandidateReviewInfluence["proposedClass"],
  overrides: Partial<Screen02CandidateReviewInfluence> = {},
) {
  const sourceId = proposal.sources[0]!.id;
  const review: Screen02CandidateReviewInfluence = {
    proposedClass,
    industryBridge:
      "The exact official span documents a semiconductor equipment supply relationship to the manufacturing profile.",
    profileTermsUsed: proposedClass === "adjacent"
      ? ["semiconductor equipment supply"]
      : [],
    sourceIdsUsed: proposedClass === "adjacent" ? [sourceId] : [],
    sourceSpansUsed: proposedClass === "adjacent"
      ? [{ sourceId, text: "semiconductor equipment supply relationship" }]
      : [],
    sampleConnection:
      "The relationship may connect the event to public manufacturing firms, subject to fixed coverage checks.",
    outcomePathway:
      "Compliance inputs could affect production investment, but no realized outcome value was inspected.",
    mainMismatchOrUncertainty:
      "Firm-level coverage and exposure timing remain uncertain.",
    needsFollowUpRetrieval: true,
    ...overrides,
  };
  return new Map([[proposal.id, review]]);
}

describe("Screen 2 v0.4.04 current/generalization qualification contract", () => {
  it.each([
    ["Manufacturing", manufacturingRule, "direct", true],
    ["Video gaming", videoGamingRule, "direct", true],
    ["Video gaming", manufacturingRule, "mismatch", false],
    ["Manufacturing", videoGamingRule, "mismatch", false],
  ] as const)(
    "classifies the %s scope against %s without outcome rescue",
    (industry, candidate, classification, eligible) => {
      const qualification = qualifyScreen02FindProposal(
        candidate,
        context(industry),
        { scopeFingerprint: `scope-${industry}` },
      );

      expect(qualification).toMatchObject({
        version: SCREEN02_CANDIDATE_QUALIFICATION_VERSION,
        candidateId: candidate.id,
        classification,
        eligible,
      });
      expect(isScreen02CandidateQualification(qualification)).toBe(true);
      if (!eligible) {
        expect(qualification.outcomeFit.status).toBe("not-evaluated");
        expect(qualification.exclusionCodes).toContain("industry-mismatch");
      }
    },
  );

  it("uses the same relevance algorithm for an unfamiliar nonempty industry", () => {
    const semiconductorContext = {
      ...context("Manufacturing"),
      scopeContract: {
        ...context("Manufacturing").scopeContract,
        industry: "Semiconductor fabrication",
      },
    } satisfies Screen01StudyContext;
    const semiconductorRule = proposal("semiconductor-rule", {
      title: "Semiconductor Fabrication Chemical Reporting Rule",
      description:
        "The final rule requires semiconductor fabrication operators and public foundry firms to change chemical reporting beginning in 2019.",
      populations: ["Public semiconductor fabrication and foundry firms"],
    });
    const qualification = qualifyScreen02FindProposal(
      semiconductorRule,
      semiconductorContext,
      { scopeFingerprint: "scope-semiconductor" },
    );
    expect(qualification).toMatchObject({
      classification: "direct",
      eligible: true,
    });
    expect(
      screen02IndustryBridgeEvidence(
        semiconductorRule,
        "Semiconductor fabrication",
      ).matchedPrimaryTerms,
    ).toEqual(expect.arrayContaining(["semiconductor", "fabrication"]));
  });

  it("keeps outcome wording outside qualification score and exposes diversity math", () => {
    const first = qualifyScreen02FindProposal(
      manufacturingRule,
      context("Manufacturing", "Innovation"),
      { scopeFingerprint: "scope-outcome-invariant", bm25Score: 2 },
    );
    const changed = qualifyScreen02FindProposal(
      {
        ...manufacturingRule,
        outcomeLink: {
          text: "Employment employment employment.",
          status: "system-template",
        },
      },
      context("Manufacturing", "Employment"),
      { scopeFingerprint: "scope-outcome-invariant", bm25Score: 2 },
    );
    expect(changed.ranking.baseScore).toBe(first.ranking.baseScore);
    expect(changed.eligible).toBe(first.eligible);
    expect(
      screen02QualificationDiversityAdjustment({
        priorLaneCount: 2,
        priorIssuerCount: 1,
      }),
    ).toBe(-7);
  });

  it("keeps proposal-authored exposure variables rank-neutral until a retained passage supports them", () => {
    const peer = {
      ...structuredClone(manufacturingRule),
      id: "a-exposure-peer",
      requiredVariables: [],
    } satisfies Screen02FindProposal;
    const unbound = {
      ...structuredClone(manufacturingRule),
      id: "z-unbound-exposure-variable",
      requiredVariables: ["Connector-authored synthetic exposure score"],
    } satisfies Screen02FindProposal;
    const grounded = {
      ...structuredClone(unbound),
      requiredVariables: ["production facilities"],
    } satisfies Screen02FindProposal;
    const otherUngroundedVariables = [
      ["the"],
      ["facil"],
      [manufacturingRule.title],
      ["final rule"],
      ["United States"],
      ["covered manufacturers"],
    ];
    const options = {
      scopeFingerprint: "scope-exposure-rank-grounding",
      maximumCandidates: 2,
    } as const;

    const withoutGrounding = qualifyAndRankScreen02FindProposals(
      [peer, unbound],
      context("Manufacturing"),
      options,
    );
    const withGrounding = qualifyAndRankScreen02FindProposals(
      [peer, grounded],
      context("Manufacturing"),
      options,
    );

    expect(withoutGrounding.selected.map((entry) => entry.proposal.id))
      .toEqual([peer.id, unbound.id]);
    expect(withoutGrounding.selected[0]?.qualification.ranking.baseScore)
      .toBe(withoutGrounding.selected[1]?.qualification.ranking.baseScore);
    for (const requiredVariables of otherUngroundedVariables) {
      const qualification = qualifyScreen02FindProposal(
        { ...structuredClone(unbound), requiredVariables },
        context("Manufacturing"),
        { scopeFingerprint: "scope-exposure-rank-grounding" },
      );
      expect(qualification.exposureFeasibility.status, requiredVariables[0])
        .toBe("unclear");
      expect(qualification.ranking.baseScore, requiredVariables[0]).toBe(
        withoutGrounding.selected[0]!.qualification.ranking.baseScore,
      );
    }
    expect(withGrounding.selected.map((entry) => entry.proposal.id))
      .toEqual([grounded.id, peer.id]);
    expect(withGrounding.selected[0]?.qualification.ranking.baseScore)
      .toBeGreaterThan(
        withGrounding.selected[1]!.qualification.ranking.baseScore,
      );
  });

  it("derives all nine diversity dimensions from generic candidate and source fields", () => {
    const baseline = screen02QualificationDiversityKeys(
      manufacturingRule,
      "official-source",
      "cluster-baseline",
    );
    const variants = {
      "issuing-authority": {
        ...manufacturingRule,
        nativeIdentity: {
          ...manufacturingRule.nativeIdentity!,
          issuer: "Another issuing body",
        },
      },
      jurisdiction: {
        ...manufacturingRule,
        nativeIdentity: {
          ...manufacturingRule.nativeIdentity!,
          issuingJurisdiction: "Another jurisdiction",
        },
      },
      "source-lane": manufacturingRule,
      "event-subtype": {
        ...manufacturingRule,
        nativeIdentity: {
          ...manufacturingRule.nativeIdentity!,
          status: "Enacted standard",
        },
      },
      mechanism: {
        ...manufacturingRule,
        description:
          "The final rule prohibits a manufacturing practice for covered manufacturers beginning in 2019.",
        sources: manufacturingRule.sources.map((candidateSource) => ({
          ...candidateSource,
          evidenceText:
            "The final rule prohibits a manufacturing practice for covered manufacturers beginning in 2019.",
        })),
      },
      "treatment-timing": {
        ...manufacturingRule,
        event: { ...manufacturingRule.event, eventDate: "2020-07-01" },
        provisionalDates: ["Effective date: 2020-07-01"],
        sources: manufacturingRule.sources.map((candidateSource) => ({
          ...candidateSource,
          evidenceText: candidateSource.evidenceText!.replaceAll("2019", "2020"),
        })),
      },
      "regulatory-surface": {
        ...manufacturingRule,
        description:
          "The final rule requires public manufacturing firms to change emissions controls at production facilities beginning in 2019.",
        sources: manufacturingRule.sources.map((candidateSource) => ({
          ...candidateSource,
          evidenceText: [
            manufacturingRule.title,
            "Issuing jurisdiction: United States.",
            "The final rule requires public manufacturing firms to change emissions controls at production facilities beginning in 2019.",
            "Affected population: Public manufacturing firms and covered manufacturers.",
          ].join(" "),
        })),
      },
      "event-family": {
        ...manufacturingRule,
        event: { ...manufacturingRule.event, eventFamily: "Safety standard" },
      },
      "related-event-cluster": {
        ...manufacturingRule,
        id: "same-proposal-different-related-cluster",
      },
    } satisfies Record<
      (typeof screen02QualificationDiversityDimensions)[number],
      Screen02FindProposal
    >;

    expect(Object.keys(baseline)).toEqual([
      ...screen02QualificationDiversityDimensions,
    ]);
    for (const dimension of screen02QualificationDiversityDimensions) {
      const lane = dimension === "source-lane"
        ? "researcher-source"
        : "official-source";
      const cluster = dimension === "related-event-cluster"
        ? "cluster-alternative"
        : "cluster-baseline";
      expect(
        screen02QualificationDiversityKeys(
          variants[dimension],
          lane,
          cluster,
        )[dimension],
        dimension,
      ).not.toEqual(baseline[dimension]);
    }
  });

  it("does not substitute publisher, impact geography, variables, populations, or outcome prose for missing facets", () => {
    const neutral = {
      ...proposal("neutral-facets", {
        title: "Procedural record",
        description:
          "A dated document records a change for public manufacturing firms beginning in 2019.",
        populations: ["Public manufacturing firms"],
      }),
      nativeIdentity: {
        formalIdentifier: null,
        issuer: null,
        issuingJurisdiction: null,
        status: null,
      },
      event: {
        displayName: "Procedural record",
        eventDate: "Not established",
        eventFamily: "Unknown",
        geographies: ["Impact Region"],
        populations: ["Regulated population"],
      },
      provisionalDates: ["Not established"],
      affectedPopulation: "Regulated population",
      requiredVariables: ["Penalty and reporting variables"],
      outcomeLink: {
        text: "Privacy technology and consumer finance mechanism.",
        status: "ai-hypothesis" as const,
      },
      sources: [{
        ...source("neutral-source", "Procedural record"),
        publisher: "Publisher That Is Not The Issuer",
      }],
    } satisfies Screen02FindProposal;
    const changedProxies = {
      ...structuredClone(neutral),
      event: {
        ...structuredClone(neutral.event),
        geographies: ["Different Impact Region"],
        populations: ["Different regulated population"],
      },
      affectedPopulation: "Different regulated population",
      requiredVariables: ["Tax, subsidy, enforcement, and licensing variables"],
      outcomeLink: {
        text: "Emissions, worker safety, trade, and infrastructure pathway.",
        status: "ai-hypothesis" as const,
      },
      sources: neutral.sources.map((entry) => ({
        ...entry,
        publisher: "Another Publisher",
      })),
    } satisfies Screen02FindProposal;

    const baseline = screen02QualificationDiversityKeys(
      neutral,
      "official-source",
    );
    const changed = screen02QualificationDiversityKeys(
      changedProxies,
      "official-source",
    );
    expect(baseline).toMatchObject({
      "issuing-authority": [],
      jurisdiction: [],
      "event-subtype": [],
      mechanism: [],
      "treatment-timing": [],
      "regulatory-surface": [],
      "event-family": [],
      "related-event-cluster": [],
    });
    expect(changed).toEqual(baseline);
  });

  it("canonicalizes generic event-subtype aliases while ignoring lifecycle and alert-severity tokens", () => {
    const subtypeKeys = (status: string) =>
      screen02QualificationDiversityKeys(
        {
          ...manufacturingRule,
          nativeIdentity: {
            ...manufacturingRule.nativeIdentity!,
            status,
          },
        },
        "official-source",
      )["event-subtype"];

    for (const status of [
      "Final rule",
      "Regulation in force",
      "Proposed rulemaking",
      "Active regulations",
      "Promulgated reg.",
    ]) {
      expect(subtypeKeys(status), status).toEqual(["regulatory-instrument"]);
    }
    for (const status of [
      "Enacted law",
      "Act in force",
      "Pending legislation",
    ]) {
      expect(subtypeKeys(status), status).toEqual(["legislative-instrument"]);
    }
    expect(subtypeKeys("Emergency declaration in force")).toEqual([
      "declaration",
    ]);
    expect(subtypeKeys("Final")).toEqual(["regulatory-instrument"]);
    expect(subtypeKeys("Red alert severity 4")).toEqual([
      "regulatory-instrument",
    ]);
    const lifecycleOnly = {
      ...structuredClone(manufacturingRule),
      title: "Administrative record",
      description: "Administrative record with no event subtype.",
      nativeIdentity: {
        ...structuredClone(manufacturingRule.nativeIdentity!),
        status: "Final",
      },
      event: {
        ...structuredClone(manufacturingRule.event),
        displayName: "Administrative record",
        eventFamily: "Unknown",
      },
      sources: manufacturingRule.sources.map((candidateSource) => ({
        ...candidateSource,
        title: "Administrative record",
        evidenceText: "Administrative record with no event subtype.",
      })),
    } satisfies Screen02FindProposal;
    expect(screen02QualificationDiversityKeys(
      lifecycleOnly,
      "official-source",
    )["event-subtype"]).toEqual([]);
  });

  it("derives an event subtype, disaster surface, and declaration mechanism from generic source facts when status is unknown", () => {
    const declaration = {
      ...proposal("regional-emergency", {
        title: "Regional Flood Emergency Declaration",
        description:
          "The authority declared a state of emergency after flood damage disrupted production facilities beginning in 2019.",
        populations: [
          "Public manufacturing firms and covered manufacturers",
        ],
      }),
      nativeIdentity: {
        ...manufacturingRule.nativeIdentity!,
        formalIdentifier: "REGIONAL-EMERGENCY",
        status: null,
      },
      event: {
        ...manufacturingRule.event,
        displayName: "Regional Flood Emergency Declaration",
        eventFamily: "Flood disaster",
      },
    } satisfies Screen02FindProposal;
    const keys = screen02QualificationDiversityKeys(
      declaration,
      "official-source",
    );

    expect(keys["event-subtype"]).toEqual([
      "declaration",
      "disaster-event",
    ]);
    expect(keys.mechanism).toEqual(expect.arrayContaining([
      "declaration-or-emergency-action",
      "operational-interruption",
    ]));
    expect(keys["regulatory-surface"]).toEqual(expect.arrayContaining([
      "disaster-or-emergency",
      "operations-or-supply",
    ]));
  });

  it("restores a cached candidate's original source lane and retains separate multi-key mechanism facets", () => {
    const registry = {
      ...manufacturingRule,
      origin: "registry-reviewed" as const,
      description:
        "The final rule requires reporting and imposes penalties on covered manufacturing firms beginning in 2019.",
      sources: manufacturingRule.sources.map((candidateSource) => ({
        ...candidateSource,
        evidenceText:
          `${manufacturingRule.title}. Issuing jurisdiction: United States. The final rule requires reporting and imposes penalties on covered manufacturing firms beginning in 2019. Affected population: Public manufacturing firms and covered manufacturers.`,
      })),
    };
    const cached = screen02QualificationDiversityKeys(
      registry,
      "cached-candidate",
    );
    const original = screen02QualificationDiversityKeys(
      registry,
      "reviewed-registry",
    );

    expect(cached["source-lane"]).toEqual(["reviewed-registry"]);
    expect(cached["source-lane"]).toEqual(original["source-lane"]);
    expect(cached.mechanism).toEqual(expect.arrayContaining([
      "enforcement-or-penalty",
      "obligation-or-disclosure",
    ]));

    const cachedCandidate = {
      ...structuredClone(manufacturingRule),
      id: "explicit-researcher-lane-cached",
    } satisfies Screen02FindProposal;
    const first = qualifyAndRankScreen02FindProposals(
      [cachedCandidate],
      context("Manufacturing"),
      {
        scopeFingerprint: "scope-explicit-researcher-cache",
        maximumCandidates: 1,
        laneByProposalId: new Map([
          [cachedCandidate.id, "researcher-source"],
        ]),
      },
    );
    const seed = {
      ...structuredClone(manufacturingRule),
      id: "explicit-researcher-lane-seed",
    } satisfies Screen02FindProposal;
    let cachedQualification = first.selected[0]!.qualification;
    const selectedOrders: string[][] = [];
    for (let reuseGeneration = 1; reuseGeneration <= 3; reuseGeneration += 1) {
      const restored = qualifyAndRankScreen02FindProposals(
        [seed, cachedCandidate],
        context("Manufacturing"),
        {
          scopeFingerprint: "scope-explicit-researcher-cache",
          maximumCandidates: 2,
          // The current-round map is deliberately wrong for the cached item;
          // reusable persisted provenance must remain authoritative.
          laneByProposalId: new Map([
            [seed.id, "researcher-source"],
            [cachedCandidate.id, "official-source"],
          ]),
          cachedByProposalId: new Map([
            [cachedCandidate.id, cachedQualification],
          ]),
          boundedOrderingAdjustments: new Map([[seed.id, 1]]),
        },
      );
      const restoredCandidate = restored.evaluated.find(
        (entry) => entry.proposal.id === cachedCandidate.id,
      )!;
      selectedOrders.push(restored.selected.map((entry) => entry.proposal.id));
      expect(restoredCandidate.qualification.lane).toBe("researcher-source");
      expect(restoredCandidate.qualification.ranking.explanation).toMatch(
        /Reused the persisted deterministic qualification/,
      );
      expect(restoredCandidate.qualification.ranking.explanation).toMatch(
        /repeated dimensions:.*source-lane/,
      );
      expect(isScreen02CandidateQualification(
        restoredCandidate.qualification,
      )).toBe(true);
      cachedQualification = restoredCandidate.qualification;
    }
    expect(selectedOrders).toEqual([
      [seed.id, cachedCandidate.id],
      [seed.id, cachedCandidate.id],
      [seed.id, cachedCandidate.id],
    ]);
  });

  it("assigns a deterministic repeat penalty to every diversity dimension", () => {
    const adjustment = (
      overrides: Partial<Parameters<
        typeof screen02QualificationDiversityAdjustment
      >[0]>,
    ) => screen02QualificationDiversityAdjustment({
      priorLaneCount: 0,
      priorIssuerCount: 0,
      ...overrides,
    });

    expect([
      adjustment({ priorIssuerCount: 1 }),
      adjustment({ priorJurisdictionCount: 1 }),
      adjustment({ priorLaneCount: 1 }),
      adjustment({ priorEventSubtypeCount: 1 }),
      adjustment({ priorMechanismCount: 1 }),
      adjustment({ priorTreatmentTimingCount: 1 }),
      adjustment({ priorRegulatorySurfaceCount: 1 }),
      adjustment({ priorEventFamilyCount: 1 }),
      adjustment({ priorRelatedEventClusterCount: 1 }),
    ]).toEqual([-3, -2, -2, -1, -1, -1, -1, -1, -3]);
    expect(adjustment({
      priorLaneCount: Number.NaN,
      priorIssuerCount: Number.POSITIVE_INFINITY,
    })).toBe(0);
  });

  it("reports cache reuse without replacing the original source lane", () => {
    const scope = context("Manufacturing");
    const registry = {
      ...manufacturingRule,
      id: "registry-manufacturing",
      origin: "registry-reviewed" as const,
    };
    const contextLead = proposal("context-manufacturing", {
      title: "Manufacturing policy analysis lead",
      description:
        "A secondary analysis says a proposed policy may require manufacturers to change production reporting in 2019.",
      populations: ["Manufacturers"],
      origin: "unsupported-lead",
      tier: 6,
    });
    const first = qualifyAndRankScreen02FindProposals(
      [registry, manufacturingRule, contextLead],
      scope,
      {
        scopeFingerprint: "scope-common-lanes",
        maximumCandidates: 4,
      },
    );
    expect(first.evaluated.map((entry) => entry.qualification.lane)).toEqual(
      expect.arrayContaining([
        "reviewed-registry",
        "official-source",
        "context-live-web",
      ]),
    );
    expect(
      first.evaluated.find((entry) => entry.proposal.id === contextLead.id)
        ?.qualification.exclusionCodes,
    ).toContain("insufficient-source-quality");

    const cachedQualification = first.evaluated.find(
      (entry) => entry.proposal.id === manufacturingRule.id,
    )!.qualification;
    const cached = qualifyAndRankScreen02FindProposals(
      [manufacturingRule],
      scope,
      {
        scopeFingerprint: "scope-common-lanes",
        maximumCandidates: 1,
        cachedByProposalId: new Map([
          [manufacturingRule.id, cachedQualification],
        ]),
      },
    );
    expect(cached.selected[0]?.qualification.lane).toBe("official-source");
    expect(cached.selected[0]?.qualification.ranking.explanation).toContain(
      "no provider or host follow-up",
    );
  });

  it("ignores retrieval time but invalidates cache fingerprints for changed source facts", () => {
    const candidate = structuredClone(manufacturingRule);
    candidate.sources[0]!.retrievedAt = "2026-09-11T12:00:00.000Z";
    const reacquired = structuredClone(candidate);
    reacquired.sources[0]!.retrievedAt = "2026-09-11T12:01:00.000Z";
    expect(fingerprintScreen02QualificationSources(reacquired)).toBe(
      fingerprintScreen02QualificationSources(candidate),
    );

    reacquired.sources[0]!.evidenceText =
      `${reacquired.sources[0]!.evidenceText ?? ""} Materially changed source fact.`;
    expect(fingerprintScreen02QualificationSources(reacquired)).not.toBe(
      fingerprintScreen02QualificationSources(candidate),
    );
  });

  it("reuses a qualification with the canonical fixed study profile while preserving its source lane", () => {
    const scopeFingerprint = "scope-fixed-profile-cache";
    const scope = context("Manufacturing");
    const profile = buildScreen02StudyRelevanceProfile({
      scopeFingerprint,
      originalIndustryText: scope.scopeContract.industry,
      sampleGeography: scope.scopeContract.geography,
      studyPeriod: scope.scopeContract.studyPeriod,
      eventFamily: scope.scopeContract.eventFamily,
      at: "2026-09-03T12:00:00.000Z",
    });
    expect(profile.origin).toBe("fixed-profile");
    const candidate = {
      ...structuredClone(manufacturingRule),
      id: "fixed-profile-cached-candidate",
    } satisfies Screen02FindProposal;
    const first = qualifyAndRankScreen02FindProposals(
      [candidate],
      scope,
      {
        scopeFingerprint,
        maximumCandidates: 1,
        studyProfile: profile,
        laneByProposalId: new Map([[candidate.id, "researcher-source"]]),
      },
    );
    const cachedQualification = first.selected[0]!.qualification;
    const second = qualifyAndRankScreen02FindProposals(
      [candidate],
      scope,
      {
        scopeFingerprint,
        maximumCandidates: 1,
        studyProfile: profile,
        cachedByProposalId: new Map([[candidate.id, cachedQualification]]),
        laneByProposalId: new Map([[candidate.id, "official-source"]]),
      },
    );

    expect(second.selected[0]?.qualification.lane).toBe("researcher-source");
    expect(second.selected[0]?.qualification.ranking.explanation).toMatch(
      /Reused the persisted deterministic qualification/,
    );
  });

  it("binds qualification cache reuse to the exact relevance-profile identity, version, and semantic fingerprint", () => {
    const scopeFingerprint = "scope-semantic-profile-cache";
    const scope = context("Manufacturing");
    const profile = buildScreen02StudyRelevanceProfile({
      scopeFingerprint,
      originalIndustryText: scope.scopeContract.industry,
      sampleGeography: scope.scopeContract.geography,
      studyPeriod: scope.scopeContract.studyPeriod,
      eventFamily: scope.scopeContract.eventFamily,
      at: "2026-09-03T12:00:00.000Z",
    });
    const first = qualifyAndRankScreen02FindProposals(
      [manufacturingRule],
      scope,
      {
        scopeFingerprint,
        maximumCandidates: 1,
        studyProfile: profile,
        laneByProposalId: new Map([[manufacturingRule.id, "researcher-source"]]),
      },
    ).selected[0]!.qualification;
    expect(first.cacheKey).toContain(
      `:profile:${profile.profileVersion}:${fingerprintScreen02QualificationProfile(profile)}:`,
    );

    const semanticallyChanged = structuredClone(profile);
    semanticallyChanged.products = [
      ...semanticallyChanged.products,
      "manufacturing precision systems",
    ];
    const changed = qualifyAndRankScreen02FindProposals(
      [manufacturingRule],
      scope,
      {
        scopeFingerprint,
        maximumCandidates: 1,
        studyProfile: semanticallyChanged,
        cachedByProposalId: new Map([[manufacturingRule.id, first]]),
        laneByProposalId: new Map([[manufacturingRule.id, "official-source"]]),
      },
    ).selected[0]!.qualification;

    expect(changed.cacheKey).not.toBe(first.cacheKey);
    expect(changed.lane).toBe("official-source");
    expect(changed.ranking.explanation).not.toMatch(/Reused the persisted/);
  });

  it("reuses only an exact current-run qualification and bypasses it for changed source, profile, lane, or review", () => {
    const scopeFingerprint = "scope-current-run-qualification";
    const study = context("Manufacturing");
    const candidate = candidateReviewProposal(
      "current-run-qualification",
      { base: broadCorporateRule("current-run-qualification") },
    );
    const profile = {
      ...candidateReviewProfile(scopeFingerprint),
      origin: "researcher-edited" as const,
    };
    const qualification = qualifyScreen02FindProposal(candidate, study, {
      scopeFingerprint,
      lane: "official-source",
      studyProfile: profile,
    });
    const sentinel = "EXACT-CURRENT-RUN-QUALIFICATION";
    qualification.industryFit.explanation = sentinel;
    const currentRunQualificationByProposalId = new Map([
      [candidate.id, qualification],
    ]);
    const qualify = (
      proposal: Screen02FindProposal,
      overrides: Partial<Parameters<
        typeof qualifyAndRankScreen02FindProposals
      >[2]> = {},
    ) => qualifyAndRankScreen02FindProposals([proposal], study, {
      scopeFingerprint,
      maximumCandidates: 1,
      studyProfile: profile,
      laneByProposalId: new Map([[proposal.id, "official-source"]]),
      currentRunQualificationByProposalId,
      ...overrides,
    }).evaluated[0]!.qualification;

    expect(qualify(candidate).industryFit.explanation).toBe(sentinel);

    const changedSource = {
      ...candidate,
      sources: candidate.sources.map((source) => ({
        ...source,
        evidenceText: `${source.evidenceText} Corrected official source text.`,
      })),
    };
    expect(qualify(changedSource).industryFit.explanation).not.toBe(sentinel);

    const changedProfile = {
      ...profile,
      products: [...profile.products, "industrial control hardware"],
    };
    expect(qualify(candidate, { studyProfile: changedProfile })
      .industryFit.explanation).not.toBe(sentinel);

    expect(qualify(candidate, {
      laneByProposalId: new Map([[candidate.id, "researcher-source"]]),
    })).toMatchObject({
      lane: "researcher-source",
      industryFit: { explanation: expect.not.stringContaining(sentinel) },
    });

    expect(qualify(candidate, {
      candidateReviewInfluenceById: candidateReviewInfluence(
        candidate,
        "adjacent",
      ),
    })).toMatchObject({
      industryFit: { explanation: expect.not.stringContaining(sentinel) },
      hostReviewInfluence: expect.any(Object),
    });

    // A non-fixed profile remains ineligible for persisted-cache reuse.
    expect(qualifyAndRankScreen02FindProposals([candidate], study, {
      scopeFingerprint,
      maximumCandidates: 1,
      studyProfile: profile,
      cachedByProposalId: currentRunQualificationByProposalId,
    }).evaluated[0]!.qualification.industryFit.explanation).not.toBe(sentinel);
  });

  it("rejects malformed or internally inconsistent cache profile bindings", () => {
    const scopeFingerprint = "scope-profile-binding-validation";
    const scope = context("Manufacturing");
    const profile = buildScreen02StudyRelevanceProfile({
      scopeFingerprint,
      originalIndustryText: scope.scopeContract.industry,
      sampleGeography: scope.scopeContract.geography,
      studyPeriod: scope.scopeContract.studyPeriod,
      eventFamily: scope.scopeContract.eventFamily,
      at: "2026-09-03T12:00:00.000Z",
    });
    const qualification = qualifyScreen02FindProposal(
      manufacturingRule,
      scope,
      { scopeFingerprint, studyProfile: profile },
    );
    const profileFingerprint = fingerprintScreen02QualificationProfile(profile);
    const cacheKeyFor = (binding: string) =>
      `${scopeFingerprint}:profile:${binding}:${qualification.sourceFingerprint}:${manufacturingRule.id}`;

    expect(isScreen02CandidateQualification(qualification)).toBe(true);
    for (const binding of [
      `none:${profileFingerprint}`,
      `${profile.profileVersion}:profile-none`,
      `${profile.profileVersion}:sha256:0000000000000000`,
      `${profile.profileVersion}:fnv1a64:000000000000000`,
      `${profile.profileVersion}:fnv1a64:000000000000000G`,
      `:${profileFingerprint}`,
    ]) {
      expect(isScreen02CandidateQualification({
        ...structuredClone(qualification),
        cacheKey: cacheKeyFor(binding),
      }), binding).toBe(false);
    }
  });

  it("invalidates a cached qualification when canonical source-derived facts change", () => {
    const scope = context("Manufacturing");
    const first = qualifyAndRankScreen02FindProposals(
      [manufacturingRule],
      scope,
      {
        scopeFingerprint: "scope-source-cache",
        maximumCandidates: 1,
      },
    );
    const cachedQualification = first.selected[0]!.qualification;
    const revised = {
      ...manufacturingRule,
      sources: manufacturingRule.sources.map((candidateSource) => ({
        ...candidateSource,
        title: `${candidateSource.title} — corrected official record`,
      })),
    };
    const second = qualifyAndRankScreen02FindProposals(
      [revised],
      scope,
      {
        scopeFingerprint: "scope-source-cache",
        maximumCandidates: 1,
        cachedByProposalId: new Map([
          [manufacturingRule.id, cachedQualification],
        ]),
      },
    );

    expect(second.selected[0]?.qualification.lane).toBe("official-source");
    expect(second.selected[0]?.qualification.sourceFingerprint).not.toBe(
      cachedQualification.sourceFingerprint,
    );
    expect(second.selected[0]?.qualification.cacheKey).toBe(
      `${SCREEN02_CANDIDATE_QUALIFICATION_VERSION}:scope-source-cache:profile:none:profile-none:grounding:${SCREEN02_SOURCE_GROUNDING_VERSION}:${SCREEN02_QUALIFICATION_GROUNDING_POLICY_VERSION}:${second.selected[0]?.qualification.sourceFingerprint}:${manufacturingRule.id}`,
    );
    expect(
      isScreen02CandidateQualification(second.selected[0]?.qualification),
    ).toBe(true);
  });

  it("reads a previous grounding-policy cache key but requalifies it under the current grounding policy", () => {
    const scope = context("Manufacturing");
    const scopeFingerprint = "scope-grounding-policy-cache";
    const first = qualifyAndRankScreen02FindProposals(
      [manufacturingRule],
      scope,
      { scopeFingerprint, maximumCandidates: 1 },
    ).selected[0]!.qualification;
    const groundingBinding =
      `:grounding:${SCREEN02_SOURCE_GROUNDING_VERSION}:${SCREEN02_QUALIFICATION_GROUNDING_POLICY_VERSION}`;
    const legacyV4 = {
      ...structuredClone(first),
      cacheKey: first.cacheKey.replace(
        groundingBinding,
        `:grounding:${SCREEN02_SOURCE_GROUNDING_VERSION}:policy-v3`,
      ),
      explanation: "LEGACY-V4-GROUNDING-CACHE-SENTINEL",
    };
    expect(isScreen02CandidateQualification(legacyV4)).toBe(true);

    const refreshed = qualifyAndRankScreen02FindProposals(
      [manufacturingRule],
      scope,
      {
        scopeFingerprint,
        maximumCandidates: 1,
        cachedByProposalId: new Map([[manufacturingRule.id, legacyV4]]),
      },
    ).selected[0]!.qualification;
    expect(refreshed.cacheKey).toContain(groundingBinding);
    expect(refreshed.explanation).not.toContain(
      "LEGACY-V4-GROUNDING-CACHE-SENTINEL",
    );
    expect(refreshed.ranking.explanation).not.toMatch(/Reused the persisted/i);
  });

  it("does not let a Tier-6 contextual duplicate promote an official sparse candidate", () => {
    const official = proposal("official-accessibility", {
      title: "Video Game Platform Accessibility Rule",
      description:
        "The final rule establishes and changes accessibility procedures for digital products beginning in 2019.",
      populations: [SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN],
    });
    const contextual = {
      ...official,
      id: "context-accessibility",
      origin: "unsupported-lead" as const,
      description:
        "A secondary analysis claims the rule requires public video game publishers and platforms to change accessibility systems beginning in 2019.",
      event: {
        ...official.event,
        populations: ["U.S. publicly listed video gaming firms"],
      },
      affectedPopulation: "U.S. publicly listed video gaming firms",
      requiredVariables: [
        ...official.requiredVariables,
        "Context-only video gaming coverage flag",
      ],
      sources: [
        source(
          "context-accessibility-source",
          "Secondary video game accessibility analysis",
          6,
        ),
      ],
    } satisfies Screen02FindProposal;
    const merged = deduplicateScreen02Proposals([official, contextual]);

    expect(merged.proposals).toHaveLength(1);
    const retained = merged.proposals[0];
    expect(retained?.mode).toBe("find");
    if (!retained || retained.mode !== "find") {
      throw new Error("Expected one consolidated Find proposal.");
    }
    expect(retained.event.populations).toEqual([
      SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
    ]);
    expect(retained.description).toBe(official.description);
    expect(retained.affectedPopulation).toBe(official.affectedPopulation);
    expect(retained.requiredVariables).not.toContain(
      "Context-only video gaming coverage flag",
    );
    expect(retained.sources).toContainEqual(
      expect.objectContaining({
        id: "context-accessibility-source",
        authorityTier: 6,
      }),
    );

    const qualification = qualifyScreen02FindProposal(
      retained,
      context("Video gaming"),
      { scopeFingerprint: "scope-context-dedupe" },
    );
    expect(qualification.substantiveOverview).toMatchObject({
      affectedPopulation: false,
      passed: true,
    });
    expect(qualification.industryFit.evidenceSourceIds).toEqual([]);
    expect(qualification.evidenceSourceIds).not.toContain(
      "context-accessibility-source",
    );
    expect(qualification).toMatchObject({
      eligible: false,
      exclusionCodes: expect.arrayContaining([
        "industry-mismatch",
      ]),
    });
  });

  it("does not let a matching discovery title bind unrelated official text", () => {
    const candidate = structuredClone(manufacturingRule);
    candidate.sources = candidate.sources.map((candidateSource) => ({
      ...candidateSource,
      // The source title still matches candidate.title, but the retained text
      // identifies a different instrument.
      evidenceText:
        "Unrelated Financial Filing Rule. Issuing jurisdiction: United States. The unrelated rule requires public manufacturing firms to change controls. Effective date: 2019-06-06.",
    }));

    expect(qualifyScreen02FindProposal(
      candidate,
      context("Manufacturing"),
      { scopeFingerprint: "scope-unrelated-source-title" },
    )).toMatchObject({
      classification: "mismatch",
      eligible: false,
      hardScope: { passed: false },
      substantiveOverview: {
        identity: false,
        materialDate: false,
        passed: false,
      },
      outcomeFit: { status: "not-evaluated" },
    });
  });

  it("does not let an unrelated Tier 1 attachment inflate a traceable Tier 5 source", () => {
    const candidate = structuredClone(manufacturingRule);
    const factBearingSource = {
      ...candidate.sources[0]!,
      id: "traceable-tier-5-source",
      authorityTier: 5 as const,
    };
    candidate.sources = [
      factBearingSource,
      {
        ...source("unrelated-tier-1-source", "Unrelated official rule", 1),
        evidenceText:
          "Unrelated Hospital Reporting Rule. The official record concerns hospital billing administration.",
      },
    ];

    const qualification = qualifyScreen02FindProposal(
      candidate,
      context("Manufacturing"),
      { scopeFingerprint: "scope-source-quality-poisoning" },
    );
    expect(qualification).toMatchObject({
      sourceQuality: {
        status: "limited",
        strongestAuthorityTier: 5,
        score: 35,
        evidenceSourceIds: [factBearingSource.id],
      },
    });
    expect(qualification.evidenceSourceIds).toContain(factBearingSource.id);
    expect(qualification.evidenceSourceIds).not.toContain(
      "unrelated-tier-1-source",
    );
  });

  it("labels unsupported identity fields as provisional without crediting exposure variables", () => {
    const candidate = structuredClone(manufacturingRule);
    candidate.nativeIdentity = {
      ...candidate.nativeIdentity!,
      issuer: "Metadata-Only Standards Office",
      status: "Metadata-only final status",
    };
    const qualification = qualifyScreen02FindProposal(
      candidate,
      context("Manufacturing"),
      { scopeFingerprint: "scope-provisional-candidate-metadata" },
    );

    expect(qualification.substantiveOverview.whatTheShockIs).toMatch(
      /Candidate metadata provisionally reports status Metadata-only final status and issuer Metadata-Only Standards Office; Screen 3 must verify these fields\./u,
    );
    expect(qualification.substantiveOverview.mainUncertainty).toMatch(
      /^Candidate metadata provisionally reports:/u,
    );
    expect(qualification.exposureFeasibility.explanation).toMatch(
      /does not yet identify a bounded way/u,
    );
    expect(qualification.substantiveOverview.whatTheShockIs).not.toMatch(
      /connector|provider/iu,
    );
  });

  it("does not exempt reviewed-registry metadata from retained evidence binding", () => {
    const registry = structuredClone(manufacturingRule);
    registry.origin = "registry-reviewed";
    registry.sources = registry.sources.map((candidateSource) => {
      const { evidenceText: _omitted, ...metadata } = candidateSource;
      return metadata;
    });

    expect(qualifyScreen02FindProposal(
      registry,
      context("Manufacturing"),
      { scopeFingerprint: "scope-registry-same-pipeline" },
    )).toMatchObject({
      eligible: false,
      classification: "mismatch",
      hardScope: { passed: false },
      substantiveOverview: {
        identity: false,
        change: false,
        affectedPopulation: false,
        materialDate: false,
        passed: false,
      },
      outcomeFit: { status: "not-evaluated" },
    });
  });

  it("uses only source-bound, material, non-negated timing for diversity", () => {
    const negated = structuredClone(manufacturingRule);
    negated.sources = negated.sources.map((candidateSource) => ({
      ...candidateSource,
      evidenceText:
        `${negated.title}. The rule did not take effect in 2020. Publication date: 2019-06-06.`,
    }));
    const unbound = structuredClone(manufacturingRule);
    unbound.sources = unbound.sources.map((candidateSource) => ({
      ...candidateSource,
      evidenceText:
        "Different Official Instrument. Effective date: 2020-06-06.",
    }));
    const contextualOnly = structuredClone(manufacturingRule);
    contextualOnly.origin = "unsupported-lead";
    contextualOnly.provisionalDates = ["Effective date: 2020-06-06"];
    contextualOnly.sources = contextualOnly.sources.map((candidateSource) => ({
      ...candidateSource,
      authorityTier: 6,
      evidenceText:
        `${contextualOnly.title}. Contextual orientation only; no material timing is source-supported.`,
    }));

    expect(screen02QualificationDiversityKeys(
      negated,
      "official-source",
    )["treatment-timing"]).toEqual([]);
    expect(screen02QualificationDiversityKeys(
      unbound,
      "official-source",
    )["treatment-timing"]).toEqual([]);
    expect(screen02QualificationDiversityKeys(
      contextualOnly,
      "context-live-web",
    )["treatment-timing"]).toEqual([]);
  });

  it("does not classify generic organization wording as an industry bridge", () => {
    const genericRules = ["a", "b", "c"].map((suffix) =>
      proposal(`generic-${suffix}`, {
        title: `Corporate disclosure rule ${suffix}`,
        description:
          "The final rule requires qualifying public companies and covered businesses to change organization-level disclosures beginning in 2019.",
        populations: ["Qualifying public companies"],
      })
    );
    const result = qualifyAndRankScreen02FindProposals(
      [
        manufacturingRule,
        ...genericRules,
      ],
      context("Manufacturing"),
      {
        scopeFingerprint: "scope-broad-cap",
        maximumCandidates: 6,
      },
    );

    expect(result.selected.map((entry) => entry.proposal.id)).toEqual([
      "manufacturing-rule",
    ]);
    expect(result.excluded).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "industry-mismatch" }),
      ]),
    );
    expect(
      result.selected.map((entry) => entry.qualification.ranking.rank),
    ).toEqual([1]);
  });

  it("returns one best match plus every qualified broad candidate when all fit the requested set", () => {
    const broad = ["a", "b", "c"].map((suffix) =>
      proposal(`source-backed-broad-${suffix}`, {
        title: `Cross-industry disclosure rule ${suffix}`,
        description:
          "The final rule requires qualifying public companies and covered businesses to change organization-level disclosures beginning in 2019.",
        populations: ["Qualifying public companies across industries"],
      })
    );
    const result = qualifyAndRankScreen02FindProposals(
      [manufacturingRule, ...broad],
      context("Manufacturing"),
      { scopeFingerprint: "scope-broad-source-bridge", maximumCandidates: 6 },
    );

    expect(result.selected).toHaveLength(4);
    expect(result.selected.filter(
      (entry) => entry.qualification.classification === "broad"
    )).toHaveLength(3);
    expect(result.excluded.some((entry) =>
      entry.code === "broad-result-cap"
    )).toBe(false);
  });

  it("returns every qualified broad-only candidate when fewer than the maximum qualify", () => {
    const broad = ["a", "b", "c"].map((suffix) =>
      proposal(`broad-only-${suffix}`, {
        title: `Cross-industry reporting rule ${suffix}`,
        description:
          "The final rule requires qualifying public companies across industries to change organization-level reporting beginning in 2019.",
        populations: ["Qualifying public companies across industries"],
      })
    );
    const result = qualifyAndRankScreen02FindProposals(
      broad,
      context("Manufacturing"),
      { scopeFingerprint: "scope-broad-only", maximumCandidates: 6 },
    );

    expect(result.selected).toHaveLength(3);
    expect(result.selected.every(
      (entry) => entry.qualification.classification === "broad",
    )).toBe(true);
    expect(result.excluded.filter((entry) =>
      entry.code === "broad-result-cap"
    )).toHaveLength(0);
  });

  it("shows at most two broad candidates when eight stronger candidates fill the other requested slots", () => {
    const direct = Array.from({ length: 8 }, (_, index) =>
      proposal(`direct-manufacturing-${index}`, {
        title: `Manufacturing Product-Safety Control Rule ${index}`,
        description:
          `The final rule requires covered manufacturers and public manufacturing firms to change product-safety control ${index} at production facilities beginning in 2019.`,
        populations: [
          "Public manufacturing firms and covered manufacturers",
        ],
      })
    );
    const broad = ["a", "b", "c"].map((suffix) =>
      proposal(`capacity-broad-${suffix}`, {
        title: `Cross-industry reporting rule ${suffix}`,
        description:
          "The final rule requires qualifying public companies across industries to change organization-level reporting beginning in 2019.",
        populations: ["Qualifying public companies across industries"],
      })
    );
    const result = qualifyAndRankScreen02FindProposals(
      [...direct, ...broad],
      context("Manufacturing"),
      {
        scopeFingerprint: "scope-broad-cap-at-display-capacity",
        maximumCandidates: 10,
      },
    );

    expect(result.selected).toHaveLength(10);
    expect(result.selected.filter((entry) =>
      entry.qualification.classification === "broad"
    )).toHaveLength(2);
    expect(result.excluded.filter((entry) =>
      entry.code === "broad-result-cap"
    )).toHaveLength(1);
  });

  it("records and applies transparent multi-dimension diversity adjustments", () => {
    const first = {
      ...manufacturingRule,
      id: "diversity-a",
      nativeIdentity: {
        ...manufacturingRule.nativeIdentity!,
        formalIdentifier: "DIVERSITY-A",
        issuer: "Agency A",
      },
    };
    const repeatedIssuer = {
      ...manufacturingRule,
      id: "diversity-b",
      nativeIdentity: {
        ...manufacturingRule.nativeIdentity!,
        formalIdentifier: "DIVERSITY-B",
        issuer: "Agency A",
      },
    };
    const differentIssuer = {
      ...manufacturingRule,
      id: "diversity-c",
      title: "Alternative Manufacturing Investment Tax Credit",
      description:
        "The enacted statute establishes an investment tax credit for covered manufacturers and public manufacturing firms beginning in 2020.",
      nativeIdentity: {
        ...manufacturingRule.nativeIdentity!,
        formalIdentifier: "DIVERSITY-C",
        issuer: "Agency B",
        issuingJurisdiction: "Another issuing jurisdiction",
        status: "Enacted statute",
      },
      event: {
        ...manufacturingRule.event,
        displayName: "Alternative Manufacturing Investment Tax Credit",
        eventDate: "2020-07-01",
      },
      provisionalDates: ["Effective date: 2020-07-01"],
      sources: [{
        ...manufacturingRule.sources[0]!,
        id: "diversity-c-source",
        title: "Alternative manufacturing investment tax credit statute",
        evidenceText:
          "Alternative Manufacturing Investment Tax Credit. Issuing jurisdiction: United States. The enacted statute establishes an investment tax credit for covered manufacturers and public manufacturing firms beginning in 2020. Affected population: Public manufacturing firms and covered manufacturers.",
      }],
    };

    const result = qualifyAndRankScreen02FindProposals(
      [first, repeatedIssuer, differentIssuer],
      context("Manufacturing"),
      {
        scopeFingerprint: "scope-diversity",
        maximumCandidates: 3,
        laneByProposalId: new Map([["diversity-c", "researcher-source"]]),
        boundedOrderingAdjustments: new Map([["diversity-a", 1]]),
      },
    );

    expect(result.selected.map((entry) => entry.proposal.id)).toEqual([
      "diversity-a",
      "diversity-c",
      "diversity-b",
    ]);
    expect(
      result.selected.map(
        (entry) => entry.qualification.ranking.diversityAdjustment,
      ),
    ).toEqual([0, -1, -10]);
    expect(result.selected[1]?.qualification.ranking.explanation).toContain(
      "capped 1-point diversity tie-break adjustment",
    );
    expect(result.selected[2]?.qualification.ranking.explanation).toContain(
      "issuing-authority, jurisdiction, source-lane, event-subtype, mechanism, treatment-timing, regulatory-surface, event-family, related-event-cluster",
    );
  });

  it("groups retained treatment phases under one related-event diversity facet", () => {
    const phaseOne = {
      ...structuredClone(manufacturingRule),
      id: "manufacturing-phase-one",
      nativeIdentity: {
        ...structuredClone(manufacturingRule.nativeIdentity!),
        formalIdentifier: "OU 2020/11",
      },
      provisionalDates: ["Treatment phase begins: 2020-01-01"],
    } satisfies Screen02FindProposal;
    const phaseTwo = {
      ...structuredClone(manufacturingRule),
      id: "manufacturing-phase-two",
      nativeIdentity: {
        ...structuredClone(manufacturingRule.nativeIdentity!),
        formalIdentifier: "OU 2020/12",
      },
      provisionalDates: ["Treatment phase begins: 2021-01-01"],
    } satisfies Screen02FindProposal;

    const result = qualifyAndRankScreen02FindProposals(
      [phaseTwo, phaseOne],
      context("Manufacturing"),
      {
        scopeFingerprint: "scope-related-treatment-phases",
        maximumCandidates: 2,
      },
    );

    expect(result.selected).toHaveLength(2);
    expect(result.selected[1]?.qualification.ranking.explanation)
      .toContain("related-event-cluster");
  });

  it("uses diversity only to order an exact fixed-relevance tie", () => {
    const seed = {
      ...structuredClone(manufacturingRule),
      id: "cohort-a-seed",
    } satisfies Screen02FindProposal;
    const repeated = {
      ...structuredClone(manufacturingRule),
      id: "cohort-c-repeated",
    } satisfies Screen02FindProposal;
    const diverse = {
      ...structuredClone(manufacturingRule),
      id: "cohort-b-diverse",
      title: "Alternative Manufacturing Operations Standard",
      description:
        "The enacted statute establishes an investment tax credit for covered manufacturers and public manufacturing firms beginning in 2020.",
      nativeIdentity: {
        formalIdentifier: "ALT-OPS",
        issuer: "Another issuing body",
        issuingJurisdiction: "North American manufacturing zone",
        status: "Enacted standard",
      },
      event: {
        ...structuredClone(manufacturingRule.event),
        displayName: "Alternative Manufacturing Operations Standard",
        eventDate: "2020-07-01",
        populations: [
          ...manufacturingRule.event.populations,
          "Manufacturing operators",
        ],
      },
      provisionalDates: ["2020-07-01"],
      affectedPopulation:
        "Public manufacturing firms, covered manufacturers, and manufacturing operators",
      requiredVariables: ["Facility inspection intensity"],
      sources: [{
        ...structuredClone(manufacturingRule.sources[0]!),
        id: "cohort-diverse-source",
        title: "Alternative manufacturing tax credit statute",
        evidenceText:
          "Alternative Manufacturing Operations Standard. Issuing jurisdiction: United States. The enacted statute establishes an investment tax credit for covered manufacturers and public manufacturing firms beginning in 2020. Affected population: Public manufacturing firms and covered manufacturers; Manufacturing operators; Public manufacturing firms, covered manufacturers, and manufacturing operators.",
      }],
    } satisfies Screen02FindProposal;
    const laneByProposalId = new Map([
      [seed.id, "official-source"],
      [repeated.id, "official-source"],
      [diverse.id, "researcher-source"],
    ] as const);

    const result = qualifyAndRankScreen02FindProposals(
      [seed, repeated, diverse],
      context("Manufacturing"),
      {
        scopeFingerprint: "scope-nine-dimension-diversity",
        maximumCandidates: 3,
        laneByProposalId,
        boundedOrderingAdjustments: new Map([[seed.id, 3]]),
      },
    );

    expect(result.selected.map((entry) => entry.proposal.id)).toEqual([
      seed.id,
      diverse.id,
      repeated.id,
    ]);
    expect(result.selected[1]?.qualification.ranking.diversityAdjustment)
      .toBeGreaterThan(result.selected[2]!.qualification.ranking.diversityAdjustment);
    expect(result.selected[2]?.qualification.ranking.explanation).toContain(
      "only breaks an exact fixed-relevance tie",
    );
    expect(result.selected[1]?.qualification.ranking.totalScore).toBe(
      result.selected[2]?.qualification.ranking.totalScore,
    );
  });

  it("never lets diversity promote a materially lower base score", () => {
    const seed = {
      ...structuredClone(manufacturingRule),
      id: "relevance-a-seed",
    } satisfies Screen02FindProposal;
    const strongerRepeated = {
      ...structuredClone(manufacturingRule),
      id: "relevance-c-stronger-repeated",
    } satisfies Screen02FindProposal;
    const weakerDiverse = {
      ...structuredClone(manufacturingRule),
      id: "relevance-b-weaker-diverse",
      title: "Alternative Manufacturing Operations Standard",
      description:
        "The enacted statute establishes an investment tax credit for covered manufacturers and public manufacturing firms beginning in 2020.",
      nativeIdentity: {
        formalIdentifier: "ALT-OPS-WEAKER",
        issuer: "Another issuing body",
        issuingJurisdiction: "North American manufacturing zone",
        status: "Enacted standard",
      },
      event: {
        ...structuredClone(manufacturingRule.event),
        displayName: "Alternative Manufacturing Operations Standard",
        eventDate: "2020-07-01",
        populations: [
          ...manufacturingRule.event.populations,
          "Manufacturing operators",
        ],
      },
      provisionalDates: ["Effective date: 2020-07-01"],
      affectedPopulation:
        "Public manufacturing firms, covered manufacturers, and manufacturing operators",
      requiredVariables: ["Facility inspection intensity"],
      sources: manufacturingRule.sources.map((entry) => ({
        ...structuredClone(entry),
        id: "weaker-diverse-source",
        title: "Alternative manufacturing tax credit statute",
        authorityTier: 2,
        evidenceText:
          "Alternative Manufacturing Operations Standard. Issuing jurisdiction: United States. The enacted statute establishes an investment tax credit for covered manufacturers and public manufacturing firms beginning in 2020. Affected population: Public manufacturing firms and covered manufacturers; Manufacturing operators; Public manufacturing firms, covered manufacturers, and manufacturing operators.",
      })),
    } satisfies Screen02FindProposal;

    const result = qualifyAndRankScreen02FindProposals(
      [seed, strongerRepeated, weakerDiverse],
      context("Manufacturing"),
      {
        scopeFingerprint: "scope-relevance-before-diversity",
        maximumCandidates: 3,
        laneByProposalId: new Map([
          [seed.id, "official-source"],
          [strongerRepeated.id, "official-source"],
          [weakerDiverse.id, "researcher-source"],
        ] as const),
        boundedOrderingAdjustments: new Map([[seed.id, 3]]),
      },
    );

    expect(
      result.selected[1]!.qualification.ranking.baseScore -
        result.selected[2]!.qualification.ranking.baseScore,
    ).toBeGreaterThan(0);
    expect(result.selected.map((entry) => entry.proposal.id)).toEqual([
      seed.id,
      strongerRepeated.id,
      weakerDiverse.id,
    ]);
    expect(result.selected[1]?.qualification.ranking.diversityAdjustment)
      .toBeLessThan(result.selected[2]!.qualification.ranking.diversityAdjustment);
    expect(result.selected[1]?.qualification.ranking.totalScore)
      .toBeGreaterThan(result.selected[2]!.qualification.ranking.totalScore);
  });

  it("breaks equal-relevance privacy crowding without dropping eligible results when no alternative exists", () => {
    const themed = (
      id: string,
      title: string,
      description: string,
      issuer: string,
      status: string,
      eventDate = "2019-06-06",
      issuingJurisdiction = "United States",
    ) => ({
      ...proposal(id, {
        title,
        sourceTitle: title,
        description,
        populations: ["Public manufacturing firms and covered manufacturers"],
      }),
      nativeIdentity: {
        formalIdentifier: id.toUpperCase(),
        issuer,
        issuingJurisdiction,
        status,
      },
      event: {
        ...proposal(id, {
          title,
          sourceTitle: title,
          description,
          populations: ["Public manufacturing firms and covered manufacturers"],
        }).event,
        eventDate,
      },
      provisionalDates: [eventDate],
    } satisfies Screen02FindProposal);
    const privacyCases = [
      [
        "alder",
        "Alder Consumer Information Rights Act",
        "requires consumer personal-data notice disclosures",
        "Alder Office of Consumer Affairs",
        "State of Alder",
        "Enacted act",
        "2014-02-01",
      ],
      [
        "birch",
        "Birch Digital Privacy Code",
        "restricts consumer personal-data transfers",
        "Birch Digital Services Commission",
        "State of Birch",
        "Code in force",
        "2015-03-01",
      ],
      [
        "cedar",
        "Cedar Personal Data Protection Statute",
        "establishes consumer personal-data security penalties",
        "Cedar Information Protection Bureau",
        "State of Cedar",
        "Final statute",
        "2016-04-01",
      ],
      [
        "dogwood",
        "Dogwood Consumer Records Safeguards Law",
        "limits consumer personal-data retention",
        "Dogwood Consumer Records Office",
        "State of Dogwood",
        "Active law",
        "2017-05-01",
      ],
      [
        "elm",
        "Elm Online Information Rights Act",
        "requires consumer personal-data access reporting",
        "Elm Online Commerce Authority",
        "State of Elm",
        "Effective act",
        "2018-06-01",
      ],
      [
        "fir",
        "Fir Personal Data Accountability Code",
        "requires consumer personal-data consent records",
        "Fir Data Accountability Board",
        "State of Fir",
        "Adopted code",
        "2019-07-01",
      ],
      [
        "grove",
        "Grove Consumer Privacy Protection Law",
        "requires consumer personal-data breach reporting",
        "Grove Privacy Enforcement Office",
        "State of Grove",
        "Final law",
        "2020-08-01",
      ],
      [
        "hawthorn",
        "Hawthorn Digital Records Rights Statute",
        "mandates consumer personal-data processor contracts",
        "Hawthorn Digital Records Commission",
        "State of Hawthorn",
        "Enacted statute",
        "2021-09-01",
      ],
      [
        "ivy",
        "Ivy Personal Information Controls Act",
        "requires consumer personal-data deletion procedures",
        "Ivy Personal Information Agency",
        "State of Ivy",
        "Act in force",
        "2022-10-01",
      ],
      [
        "juniper",
        "Juniper Consumer Data Governance Law",
        "requires consumer personal-data portability controls",
        "Juniper Data Governance Council",
        "State of Juniper",
        "Current law",
        "2014-11-01",
      ],
    ] as const;
    const privacy = privacyCases.map(([
      id,
      title,
      action,
      issuer,
      issuingJurisdiction,
      status,
      eventDate,
    ]) => themed(
      `privacy-${id}`,
      title,
      `The ${title} ${action} for public manufacturing firms and covered manufacturers beginning in ${eventDate.slice(0, 4)}.`,
      issuer,
      status,
      eventDate,
      issuingJurisdiction,
    ));
    const alternatives = [
      themed(
        "alternative-safety",
        "Manufacturing Facility Safety Standard",
        "The final standard requires public manufacturing firms and covered manufacturers to change facility safety inspections beginning in 2019.",
        "Workplace Standards Board",
        "Final standard",
        "2021-02-01",
      ),
      themed(
        "alternative-emissions",
        "Manufacturing Emissions Levy Statute",
        "The enacted statute imposes an emissions levy on public manufacturing firms and covered manufacturers beginning in 2022.",
        "Environmental Revenue Office",
        "Enacted statute",
        "2022-07-01",
        "Another issuing jurisdiction",
      ),
    ];

    const mixed = qualifyAndRankScreen02FindProposals(
      [...privacy, ...alternatives],
      context("Manufacturing"),
      {
        scopeFingerprint: "scope-privacy-crowding",
        maximumCandidates: 10,
        laneByProposalId: new Map([[alternatives[1]!.id, "researcher-source"]]),
        boundedOrderingAdjustments: new Map([[privacy[0]!.id, 1]]),
      },
    );
    expect(mixed.selected[0]?.proposal.id).toBe(privacy[0]!.id);
    expect(mixed.selected.slice(1, 3).map((entry) => entry.proposal.id))
      .toEqual(expect.arrayContaining(alternatives.map((entry) => entry.id)));
    expect(mixed.selected).toHaveLength(10);
    expect(mixed.selected.filter((entry) =>
      entry.proposal.id.startsWith("privacy-")
    )).toHaveLength(8);
    expect(new Set(privacy.map((entry) =>
      entry.nativeIdentity?.issuer
    )).size).toBe(10);
    expect(new Set(privacy.map((entry) =>
      entry.nativeIdentity?.issuingJurisdiction
    )).size).toBe(10);
    for (const entry of privacy) {
      expect(
        screen02QualificationDiversityKeys(entry, "official-source")[
          "regulatory-surface"
        ],
      ).toEqual(expect.arrayContaining([
        "competition-or-consumer",
        "privacy-data-or-technology",
      ]));
    }
    const mixedById = new Map(mixed.selected.map((entry) => [
      entry.proposal.id,
      entry,
    ]));
    const firstRemainingPrivacy = mixed.selected.find((entry, index) =>
      index >= 3 && entry.proposal.id.startsWith("privacy-")
    );
    expect(firstRemainingPrivacy).toBeDefined();
    for (const alternative of alternatives) {
      expect(
        mixedById.get(alternative.id)?.qualification.ranking.totalScore,
      ).toBe(firstRemainingPrivacy?.qualification.ranking.totalScore);
    }

    const onlyNearMatches = qualifyAndRankScreen02FindProposals(
      privacy,
      context("Manufacturing"),
      {
        scopeFingerprint: "scope-no-diverse-alternative",
        maximumCandidates: 10,
      },
    );
    expect(deduplicateScreen02Proposals(privacy).proposals).toHaveLength(10);
    expect(onlyNearMatches.selected).toHaveLength(10);
    expect(onlyNearMatches.selected.map((entry) => entry.proposal.id).sort())
      .toEqual(privacy.map((entry) => entry.id).sort());
  });

  it.each([
    ["an unknown candidate", new Map([["not-in-the-pool", 1]])],
    ["an adjustment above the positive bound", new Map([[manufacturingRule.id, 4]])],
    ["an adjustment below the negative bound", new Map([[manufacturingRule.id, -4]])],
    ["a fractional adjustment", new Map([[manufacturingRule.id, 1.5]])],
  ])("rejects %s in bounded ordering adjustments", (_label, adjustments) => {
    expect(() =>
      qualifyAndRankScreen02FindProposals(
        [manufacturingRule],
        context("Manufacturing"),
        {
          scopeFingerprint: "scope-invalid-host-ordering",
          maximumCandidates: 1,
          boundedOrderingAdjustments: adjustments,
        },
      )
    ).toThrow(/reference supplied candidates|within \+\/-3/i);
  });

  it("applies bounded host ordering before greedy diversity and the candidate limit", () => {
    const candidates = [
      ["ordering-a", "Agency A"],
      ["ordering-b", "Agency B"],
      ["ordering-c", "Agency C"],
    ].map(([id, issuer]) => ({
      ...proposal(id!, {
        title: `Manufacturing controls ${id}`,
        description: manufacturingRule.description,
        populations: [...manufacturingRule.event.populations],
      }),
      nativeIdentity: {
        ...manufacturingRule.nativeIdentity!,
        formalIdentifier: id!.toUpperCase(),
        issuer: issuer!,
      },
    } satisfies Screen02FindProposal));

    const baseline = qualifyAndRankScreen02FindProposals(
      candidates,
      context("Manufacturing"),
      {
        scopeFingerprint: "scope-host-ordering-baseline",
        maximumCandidates: 2,
      },
    );
    const adjusted = qualifyAndRankScreen02FindProposals(
      candidates,
      context("Manufacturing"),
      {
        scopeFingerprint: "scope-host-ordering-adjusted",
        maximumCandidates: 2,
        boundedOrderingAdjustments: new Map([
          ["ordering-a", -3],
          ["ordering-c", 3],
        ]),
      },
    );

    expect(baseline.selected.map((entry) => entry.proposal.id)).toEqual([
      "ordering-a",
      "ordering-b",
    ]);
    expect(adjusted.selected.map((entry) => entry.proposal.id)).toEqual([
      "ordering-c",
      "ordering-b",
    ]);
    expect(adjusted.selected.map((entry) => entry.qualification.ranking.rank))
      .toEqual([1, 2]);
    expect(adjusted.selected[0]?.qualification).toMatchObject({
      classification: "direct",
      section: "best-match",
      eligible: true,
      ranking: {
        diversityAdjustment: 0,
        explanation: expect.stringMatching(/bounded \+3-point ordering adjustment/i),
      },
    });
    expect(adjusted.excluded).toEqual(expect.arrayContaining([
      expect.objectContaining({
        proposal: expect.objectContaining({ id: "ordering-a" }),
        code: "candidate-limit",
      }),
    ]));
  });

  it("applies bounded host ordering without imposing a broad-only cap", () => {
    const candidates = ["a", "b", "c"].map((suffix) => ({
      ...broadCorporateRule(`host-broad-${suffix}`),
      nativeIdentity: {
        ...broadCorporateRule(`host-broad-${suffix}`).nativeIdentity!,
        issuer: `Broad Agency ${suffix.toUpperCase()}`,
      },
    } satisfies Screen02FindProposal));
    const baseline = qualifyAndRankScreen02FindProposals(
      candidates,
      context("Manufacturing"),
      {
        scopeFingerprint: "scope-host-broad-baseline",
        maximumCandidates: 6,
      },
    );
    const adjusted = qualifyAndRankScreen02FindProposals(
      candidates,
      context("Manufacturing"),
      {
        scopeFingerprint: "scope-host-broad-adjusted",
        maximumCandidates: 6,
        boundedOrderingAdjustments: new Map([
          ["host-broad-a", -3],
          ["host-broad-c", 3],
        ]),
      },
    );

    expect(baseline.selected.map((entry) => entry.proposal.id)).toEqual([
      "host-broad-a",
      "host-broad-b",
      "host-broad-c",
    ]);
    expect(adjusted.selected.map((entry) => entry.proposal.id)).toEqual([
      "host-broad-c",
      "host-broad-b",
      "host-broad-a",
    ]);
    expect(adjusted.selected.every((entry) =>
      entry.qualification.classification === "broad" &&
      entry.qualification.section === "broader" &&
      entry.qualification.eligible
    )).toBe(true);
    expect(adjusted.excluded.some((entry) =>
      entry.code === "broad-result-cap"
    )).toBe(false);
  });

  it("makes geography and organizational population failures hard blockers", () => {
    const nfrd = proposal("eu-nfrd", {
      title: "EU Non-Financial Reporting Directive",
      description:
        "The directive requires large European public-interest entities to publish non-financial statements for financial years beginning in 2017.",
      populations: ["Large European public-interest entities"],
      geographies: ["European Union"],
    });
    const qualification = qualifyScreen02FindProposal(
      nfrd,
      context("Video gaming"),
      { scopeFingerprint: "scope-nfrd-us-video" },
    );

    expect(qualification).toMatchObject({
      eligible: false,
      classification: "mismatch",
      hardScope: {
        passed: false,
        disposition: "demonstrated-mismatch",
        mismatchKeys: expect.arrayContaining(["geography"]),
        insufficientEvidenceKeys: [],
        blockingKeys: expect.arrayContaining(["geography"]),
      },
      exclusionCodes: expect.arrayContaining(["hard-scope-mismatch"]),
    });
  });

  it("admits a source-backed discovery candidate with unresolved population while rejecting a missing event date", () => {
    const unknownPopulation = proposal("unknown-population-rule", {
      title: "Manufacturing Production Reporting Rule",
      description:
        "The final rule changes manufacturing reporting requirements and compliance schedules beginning in 2019.",
      populations: [SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN],
    });
    const unknownPeriod = {
      ...manufacturingRule,
      id: "unknown-period-rule",
      event: {
        ...manufacturingRule.event,
        eventDate: "Date requires verification",
      },
      provisionalDates: ["Date requires verification"],
      sources: manufacturingRule.sources.map((candidateSource) => ({
        ...candidateSource,
        evidenceText:
          "The final rule requires covered manufacturers and public manufacturing firms to change product-safety controls at production facilities; operative timing is not established.",
      })),
    } satisfies Screen02FindProposal;

    const populationQualification = qualifyScreen02FindProposal(
      unknownPopulation,
      context("Manufacturing"),
      { scopeFingerprint: "scope-unresolved-population" },
    );
    const periodQualification = qualifyScreen02FindProposal(
      unknownPeriod,
      context("Manufacturing"),
      { scopeFingerprint: "scope-unresolved-period" },
    );

    expect(populationQualification).toMatchObject({
      eligible: true,
      hardScope: {
        passed: false,
        disposition: "insufficient-evidence",
        mismatchKeys: [],
        insufficientEvidenceKeys: expect.arrayContaining(["population"]),
        blockingKeys: expect.arrayContaining(["population"]),
      },
      exclusionCodes: [],
      candidateAdmission: {
        displayEvidence: { supported: true },
        relevance: { recommended: true },
        screen3VerificationNeeds: expect.arrayContaining([
          expect.stringMatching(/population/i),
        ]),
      },
    });
    expect(periodQualification).toMatchObject({
      eligible: false,
      hardScope: {
        passed: false,
        disposition: "insufficient-evidence",
        mismatchKeys: [],
        insufficientEvidenceKeys: expect.arrayContaining(["studyPeriod"]),
        blockingKeys: expect.arrayContaining(["studyPeriod"]),
      },
      exclusionCodes: expect.arrayContaining([
        "excluded-insufficient-substantive-information",
      ]),
    });
    expect(populationQualification.exclusionCodes).not.toContain(
      "hard-scope-mismatch",
    );
    expect(periodQualification.exclusionCodes).not.toContain(
      "hard-scope-mismatch",
    );
    expect(populationQualification.hardScope.explanation).toMatch(
      /do not yet establish/i,
    );
  });

  it("does not mislabel a population vocabulary gap as demonstrated mismatch", () => {
    const energyContext = {
      ...context("Energy"),
      scopeContract: {
        ...context("Energy").scopeContract,
        population: "Publicly listed electric utilities",
      },
    } satisfies Screen01StudyContext;
    const vocabularyGap = proposal("power-company-rule", {
      title: "Power Market Reliability Rule",
      description:
        "The final rule requires power companies to change reliability reporting beginning in 2019.",
      populations: ["Power companies"],
    });
    const ownershipConflict = proposal("private-utility-rule", {
      title: "Private Utility Reliability Rule",
      description:
        "The final rule requires privately held electric utilities to change reliability reporting beginning in 2019.",
      populations: ["Privately held electric utilities"],
    });

    const unresolved = qualifyScreen02FindProposal(
      vocabularyGap,
      energyContext,
      { scopeFingerprint: "scope-energy-population-vocabulary-gap" },
    );
    const demonstrated = qualifyScreen02FindProposal(
      ownershipConflict,
      energyContext,
      { scopeFingerprint: "scope-energy-population-ownership-conflict" },
    );

    expect(unresolved.hardScope).toMatchObject({
      disposition: "insufficient-evidence",
      mismatchKeys: [],
      insufficientEvidenceKeys: expect.arrayContaining(["population"]),
    });
    expect(unresolved.exclusionCodes).not.toContain("hard-scope-mismatch");
    expect(demonstrated.hardScope).toMatchObject({
      disposition: "demonstrated-mismatch",
      mismatchKeys: expect.arrayContaining(["population"]),
      insufficientEvidenceKeys: [],
    });
    expect(demonstrated.exclusionCodes).toContain("hard-scope-mismatch");
  });

  it("records demonstrated mismatch and missing evidence separately when both block", () => {
    const candidate = proposal("mixed-hard-scope-rule", {
      title: "Canadian Manufacturing Reporting Rule",
      description:
        "The final rule changes manufacturing reporting procedures. The retained source does not establish an operative date.",
      populations: [SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN],
      geographies: ["Canada"],
    });
    const qualification = qualifyScreen02FindProposal(
      candidate,
      context("Manufacturing"),
      { scopeFingerprint: "scope-mixed-hard-scope" },
    );

    expect(qualification).toMatchObject({
      eligible: false,
      hardScope: {
        passed: false,
        disposition: "mixed",
        mismatchKeys: expect.arrayContaining(["geography"]),
        insufficientEvidenceKeys: expect.arrayContaining(["studyPeriod"]),
        blockingKeys: expect.arrayContaining(["geography", "studyPeriod"]),
      },
      exclusionCodes: expect.arrayContaining([
        "hard-scope-mismatch",
      ]),
    });
    expect(qualification.hardScope.explanation).toMatch(
      /demonstrate a mismatch.*more source evidence/is,
    );
    expect(isScreen02CandidateQualification(qualification)).toBe(true);
    const dispositionTamper = structuredClone(qualification);
    dispositionTamper.hardScope.disposition = "demonstrated-mismatch";
    expect(isScreen02CandidateQualification(dispositionTamper)).toBe(false);
    const evidenceKeyTamper = structuredClone(qualification);
    evidenceKeyTamper.hardScope.insufficientEvidenceKeys = [];
    expect(isScreen02CandidateQualification(evidenceKeyTamper)).toBe(false);
    expect(qualification.exclusionCodes).not.toContain(
      "hard-scope-insufficient-evidence",
    );
  });

  it("positively resolves an authoritative broad organizational population without treating Tier 6 text as evidence", () => {
    const broadManufacturingPopulation = proposal("broad-manufacturing-population", {
      title: "Manufacturing Production Reporting Rule",
      description:
        "The final rule requires manufacturers and manufacturing firms to change production reporting beginning in 2019.",
      populations: ["Manufacturing firms"],
    });
    const authoritative = qualifyScreen02FindProposal(
      broadManufacturingPopulation,
      context("Manufacturing"),
      { scopeFingerprint: "scope-authoritative-population-path" },
    );
    const contextOnly = qualifyScreen02FindProposal(
      {
        ...broadManufacturingPopulation,
        id: "context-only-population-path",
        origin: "unsupported-lead",
        sources: broadManufacturingPopulation.sources.map((candidateSource) => ({
          ...candidateSource,
          id: "context-only-population-source",
          authorityTier: 6 as const,
          channel: "contextual-secondary",
        })),
      },
      context("Manufacturing"),
      { scopeFingerprint: "scope-context-only-population-path" },
    );

    expect(authoritative).toMatchObject({
      eligible: true,
      hardScope: { passed: true, blockingKeys: [] },
    });
    expect(authoritative.hardScope.explanation).toMatch(
      /positively resolve.*population/i,
    );
    expect(contextOnly).toMatchObject({
      eligible: false,
      hardScope: {
        passed: false,
        disposition: "insufficient-evidence",
        blockingKeys: expect.arrayContaining(["population"]),
      },
      exclusionCodes: expect.arrayContaining([
        "insufficient-source-quality",
      ]),
    });
  });

  it("does not let a cross-jurisdiction organization pathway invent a target-industry bridge", () => {
    const crossBorder = proposal("cross-border-data-rule", {
      title: "Cross-Border Personal Data Regulation",
      description:
        "The regulation requires controllers and processors, including firms outside the European Union that offer goods or services to or monitor people there, to change personal-data processing procedures beginning in 2018.",
      populations: [
        "Firms outside the European Union offering goods or services to or monitoring people in the European Union",
      ],
      geographies: ["European Union"],
    });
    const qualification = qualifyScreen02FindProposal(
      crossBorder,
      context("Video gaming"),
      { scopeFingerprint: "scope-cross-jurisdiction" },
    );

    expect(qualification).toMatchObject({
      eligible: false,
      classification: "mismatch",
      hardScope: { passed: true, blockingKeys: [] },
    });
    expect(
      qualification.hardScope.checks.find((check) =>
        check.key === "geography")?.status,
    ).toBe("review");
    expect(qualification.hardScope.explanation).toMatch(
      /geography.*population|population.*geography/i,
    );
  });

  it("places CCPA in broad rather than inventing a target-industry bridge", () => {
    const ccpa = proposal("us-ca-ccpa", {
      title: "California Consumer Privacy Act",
      description:
        "The law requires covered businesses serving California consumers to change how they collect, disclose, and delete personal data beginning in 2020.",
      populations: [
        "Covered businesses serving California consumers across industries",
      ],
    });
    const manufacturing = qualifyScreen02FindProposal(
      ccpa,
      context("Manufacturing"),
      { scopeFingerprint: "scope-ccpa-manufacturing" },
    );
    const videoGaming = qualifyScreen02FindProposal(
      ccpa,
      context("Video gaming"),
      { scopeFingerprint: "scope-ccpa-video" },
    );

    for (const qualification of [manufacturing, videoGaming]) {
      expect(qualification).toMatchObject({
        eligible: true,
        classification: "broad",
        section: "broader",
      });
    }
    expect(videoGaming.industryFit.matchedDirectTerms).toEqual([]);
  });

  it("excludes a wildlife rule from video gaming without an organizational activity pathway", () => {
    const wildlife = proposal("wildlife-habitat-rule", {
      title: "Migratory Wildlife Habitat Conservation Rule",
      description:
        "The rule requires wildlife refuge managers to change habitat conservation plans beginning in 2019.",
      populations: ["Wildlife refuge managers"],
    });
    const qualification = qualifyScreen02FindProposal(
      wildlife,
      context("Video gaming"),
      { scopeFingerprint: "scope-wildlife-video" },
    );

    expect(qualification).toMatchObject({
      eligible: false,
      classification: "mismatch",
      outcomeFit: { status: "not-evaluated" },
      exclusionCodes: expect.arrayContaining(["industry-mismatch"]),
    });
  });

  it("excludes trademark-classification metadata without a source-backed industry change or exposure rule", () => {
    const metadataOnly = proposal("annual-goods-classification-revision", {
      title:
        "Annual Trademark Goods Classification Revision — video-game software category",
      description:
        "The office amends the administrative goods-and-services classification schedule used by public firms submitting trademark applications beginning in 2019.",
      populations: ["Public firms submitting trademark applications"],
    });
    const sourceGrounded = proposal("interactive-software-filing-rule", {
      title: "Interactive Software Trademark Filing Rule",
      description:
        "The final rule requires public video game publishers to change trademark filing classifications for downloadable game software beginning in 2019.",
      populations: [
        "Public video game publishers filing marks for downloadable game software",
      ],
    });

    const rejected = qualifyScreen02FindProposal(
      metadataOnly,
      context("Video gaming"),
      { scopeFingerprint: "scope-trademark-metadata-only-video" },
    );
    const admitted = qualifyScreen02FindProposal(
      sourceGrounded,
      context("Video gaming"),
      { scopeFingerprint: "scope-trademark-source-grounded-video" },
    );

    expect(rejected).toMatchObject({
      eligible: false,
      classification: "mismatch",
      section: null,
      hardScope: { passed: true, blockingKeys: [] },
      industryFit: {
        matchedDirectTerms: [],
        matchedAdjacentTerms: [],
        evidenceSourceIds: [],
      },
      substantiveOverview: { passed: true },
      exposureFeasibility: { status: "unclear" },
      exclusionCodes: ["industry-mismatch"],
    });
    expect(rejected.industryFit.explanation).toMatch(
      /does not establish.+video gaming|generic organization words are insufficient/i,
    );
    expect(admitted).toMatchObject({
      eligible: true,
      classification: "direct",
      section: "best-match",
      hardScope: { passed: true, blockingKeys: [] },
      industryFit: {
        matchedDirectTerms: expect.arrayContaining([
          "video game",
          "game publisher",
        ]),
        evidenceSourceIds: [sourceGrounded.sources[0]!.id],
      },
      substantiveOverview: { passed: true },
      exposureFeasibility: { status: "unclear" },
      exclusionCodes: [],
    });
  });

  it("produces different qualified leaders for banking/employment and energy/investment", () => {
    const pool = [
      manufacturingRule,
      videoGamingRule,
      bankingRule,
      energyRule,
      broadCorporateRule("shared-broad"),
    ];
    const banking = qualifyAndRankScreen02FindProposals(
      pool,
      context("Banking", "Employment"),
      { scopeFingerprint: "scope-banking-employment", maximumCandidates: 5 },
    );
    const energy = qualifyAndRankScreen02FindProposals(
      pool,
      context("Energy", "Investment"),
      { scopeFingerprint: "scope-energy-investment", maximumCandidates: 5 },
    );

    expect(banking.selected[0]?.proposal.id).toBe("banking-rule");
    expect(energy.selected[0]?.proposal.id).toBe("energy-rule");
    expect(banking.selected.map((entry) => entry.proposal.id)).not.toEqual(
      energy.selected.map((entry) => entry.proposal.id),
    );
    expect([
      ...banking.selected,
      ...energy.selected,
    ]).not.toContainEqual(
      expect.objectContaining({
        qualification: expect.objectContaining({ classification: "mismatch" }),
      }),
    );
  });

  it("keeps spoofed or incomplete hazard records excluded but admits source-grounded event surfaces", () => {
    const base = context("Manufacturing");
    const disasterContext = {
      ...base,
      studySentence:
        "Find earthquake disasters affecting public firms in Thailand between 2020 and 2024.",
      contractSourceSentence:
        "Find earthquake disasters affecting public firms in Thailand between 2020 and 2024.",
      scopeContract: {
        ...base.scopeContract,
        population: "Thai publicly listed firms",
        geography: "Thailand",
        industry: "All industries",
        studyPeriod: "2020–2024",
        eventFamily: "Earthquake disaster",
      },
    } satisfies Screen01StudyContext;
    const hazard = {
      ...proposal("gdacs-earthquake-example", {
        title: "Earthquake: Northern Thailand Earthquake",
        description:
          "GDACS recorded an earthquake event beginning 2024-08-10 with an orange alert level. Countries reported: Thailand.",
        populations: [SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN],
        geographies: ["Thailand"],
        tier: 3,
      }),
      event: {
        ...proposal("gdacs-earthquake-example-copy", {
          title: "Earthquake: Northern Thailand Earthquake",
          description:
            "GDACS recorded an earthquake event beginning 2024-08-10 with an orange alert level. Countries reported: Thailand.",
          populations: [SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN],
          geographies: ["Thailand"],
          tier: 3,
        }).event,
        eventDate: "2024-08-10",
        eventFamily: "Earthquake disaster",
      },
      affectedPopulation: SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
      provisionalDates: ["GDACS event start: 2024-08-10"],
      requiredVariables: [
        "Organization-to-event-footprint location linkage",
        "Verified event onset and duration",
      ],
    } satisfies Screen02FindProposal;

    const incompleteRecordWithUngroundedVariable = qualifyScreen02FindProposal(
      hazard,
      disasterContext,
      { scopeFingerprint: "scope-thailand-earthquake" },
    );
    const withoutVariable = qualifyScreen02FindProposal(
      {
        ...hazard,
        requiredVariables: [],
      },
      disasterContext,
      { scopeFingerprint: "scope-thailand-earthquake" },
    );
    const sourceCompleteHazard = {
      ...hazard,
      nativeIdentity: {
        formalIdentifier: "GDACS-EQ-1001-2",
        issuer: null,
        issuingJurisdiction: null,
        status: "orange alert",
      },
      requiredVariables: [
        "Hazard-footprint coordinates",
        "Organization-to-event-footprint location linkage",
        "Verified event onset and duration",
      ],
      sources: hazard.sources.map((candidateSource) => ({
        ...candidateSource,
        evidenceText:
          "Earthquake: Northern Thailand Earthquake; Record identifier: GDACS-EQ-1001-2; Structured source-native fields (not a verbatim passage): GDACS recorded this earthquake event beginning 2024-08-10; Hazard-footprint coordinates: longitude 99.841, latitude 19.912; countries reported: Thailand; alert level: orange.",
      })),
    } satisfies Screen02FindProposal;
    const sourceComplete = qualifyScreen02FindProposal(
      sourceCompleteHazard,
      disasterContext,
      { scopeFingerprint: "scope-thailand-earthquake-source-complete" },
    );
    const sourceCompletePoint = qualifyScreen02FindProposal(
      {
        ...sourceCompleteHazard,
        requiredVariables: [
          "Earthquake point coordinates",
          "Organization-to-hazard-footprint location linkage",
          "Verified event onset and duration",
        ],
        sources: sourceCompleteHazard.sources.map((candidateSource) => ({
          ...candidateSource,
          evidenceText: candidateSource.evidenceText?.replace(
            "Hazard-footprint coordinates",
            "Earthquake point coordinates",
          ),
        })),
      },
      disasterContext,
      { scopeFingerprint: "scope-thailand-earthquake-point-complete" },
    );

    for (const qualification of [
      incompleteRecordWithUngroundedVariable,
      withoutVariable,
    ]) {
      expect(qualification).toMatchObject({
        eligible: false,
        classification: "mismatch",
        section: null,
        hardScope: {
          passed: false,
          disposition: "insufficient-evidence",
          insufficientEvidenceKeys: expect.arrayContaining(["population"]),
        },
        exposureFeasibility: { status: "unclear", evidenceSourceIds: [] },
        exclusionCodes: expect.arrayContaining([
          "industry-mismatch",
        ]),
      });
    }
    expect(incompleteRecordWithUngroundedVariable.substantiveOverview).toMatchObject({
      passed: true,
      whoMayBeAffected: expect.stringMatching(/Thailand/),
    });
    expect(incompleteRecordWithUngroundedVariable.hardScope).toEqual(withoutVariable.hardScope);
    expect(incompleteRecordWithUngroundedVariable.industryFit)
      .toEqual(withoutVariable.industryFit);
    expect(incompleteRecordWithUngroundedVariable.exposureFeasibility)
      .toEqual(withoutVariable.exposureFeasibility);
    expect(incompleteRecordWithUngroundedVariable.substantiveOverview)
      .toEqual(withoutVariable.substantiveOverview);
    expect(incompleteRecordWithUngroundedVariable.ranking.baseScore)
      .toBe(withoutVariable.ranking.baseScore);
    for (const qualification of [sourceComplete, sourceCompletePoint]) {
      expect(qualification).toMatchObject({
        eligible: true,
        classification: "broad",
        section: "broader",
        hardScope: {
          passed: true,
          disposition: "supported",
          blockingKeys: [],
        },
        exposureFeasibility: {
          status: "plausible",
          evidenceSourceIds: expect.arrayContaining([
            sourceCompleteHazard.sources[0]!.id,
          ]),
        },
        substantiveOverview: {
          passed: true,
          whoMayBeAffected: expect.stringMatching(/Thailand/),
        },
        exclusionCodes: [],
      });
    }
    expect(sourceComplete.exposureFeasibility.explanation).toMatch(
      /does not yet establish organization-level coverage/i,
    );

    const pricePointOnly = qualifyScreen02FindProposal(
      {
        ...sourceCompleteHazard,
        event: {
          ...sourceCompleteHazard.event,
          populations: ["Thai publicly listed firms"],
        },
        affectedPopulation: "Thai publicly listed firms",
        requiredVariables: ["Price point threshold"],
        sources: sourceCompleteHazard.sources.map((candidateSource) => ({
          ...candidateSource,
          evidenceText:
            "Earthquake: Northern Thailand Earthquake; Record identifier: GDACS-EQ-1001-2; Structured source-native fields (not a verbatim passage): GDACS recorded this earthquake event beginning 2024-08-10; countries reported: Thailand; affected population: Thai publicly listed firms; price point threshold: 50.",
        })),
      },
      disasterContext,
      { scopeFingerprint: "scope-thailand-earthquake-price-point" },
    );
    expect(pricePointOnly.classification).not.toBe("broad");
    expect(pricePointOnly.eligible).toBe(false);
  });

  it("does not let substantive proposal text plus a publication date qualify as a material shock", () => {
    const vrs = {
      ...proposal("fr-2019-11744", {
      title: "Improving Video Relay Service and Direct Video Calling",
      sourceTitle:
        "84 FR 26379: Improving Video Relay Service and Direct Video Calling",
      description:
        "Proposed Rule FCC 19-39 published on 2019-06-06. The proposal would permanently permit communications assistants to handle Video Relay Service calls at home, allow up to two weeks of service for new or porting users while database registration is verified with compensation only after verification, and establish login and authentication procedures for enterprise and public videophones to guard against waste, fraud, and abuse.",
      populations: [
        "Video Relay Service providers, communications assistants, enterprise videophone users, and public videophone users",
      ],
      }),
      nativeIdentity: {
        ...manufacturingRule.nativeIdentity!,
        formalIdentifier: "FR-2019-11744",
        status: "Proposed rule",
      },
      provisionalDates: ["Publication date: 2019-06-06"],
    } satisfies Screen02FindProposal;

    for (const industry of ["Manufacturing", "Video gaming"] as const) {
      const qualification = qualifyScreen02FindProposal(
        vrs,
        context(industry),
        { scopeFingerprint: `scope-vrs-${industry}` },
      );
      expect(qualification.substantiveOverview).toMatchObject({
        identity: true,
        change: true,
        affectedPopulation: true,
        materialDate: false,
        passed: false,
        whatTheShockIs: expect.stringContaining(
          "Improving Video Relay Service and Direct Video Calling",
        ),
        whatChanged: expect.stringMatching(/permanently permit/i),
        whoMayBeAffected: expect.stringMatching(/communications assistants/i),
        importantTiming: "",
        whyItMayMatterForStudy: expect.stringMatching(/Preliminary research-design hypothesis/i),
        mainUncertainty: expect.any(String),
      });
      expect(qualification).toMatchObject({
        classification: "mismatch",
        eligible: false,
        outcomeFit: { status: "not-evaluated" },
        hardScope: {
          passed: false,
          disposition: "insufficient-evidence",
          blockingKeys: expect.arrayContaining(["studyPeriod"]),
        },
        exclusionCodes: expect.arrayContaining([
          "excluded-insufficient-substantive-information",
        ]),
      });
      expect(qualification.industryFit.explanation).toMatch(
        /does not establish|conflicts|false-friend/i,
      );
    }
  });

  it.each([
    [
      "a PRORULE-style conditional adoption clause",
      "If adopted, the proposed rule would require public manufacturing firms and covered manufacturers to change product controls beginning in 2019.",
      "Proposed rule",
    ],
    [
      "a proposal-would-take-effect clause without lifecycle metadata",
      "The proposal would take effect in 2020 and would require public manufacturing firms and covered manufacturers to change product controls.",
      null,
    ],
  ] as const)(
    "keeps %s as an ineligible discovery lead",
    (_label, description, status) => {
      const candidate = {
        ...proposal("conditional-manufacturing-rule", {
          title: "Manufacturing Product-Control Rulemaking",
          description,
          populations: [
            "Public manufacturing firms and covered manufacturers",
          ],
        }),
        nativeIdentity: {
          ...manufacturingRule.nativeIdentity!,
          formalIdentifier: "FR-CONDITIONAL-001",
          status,
        },
      } satisfies Screen02FindProposal;

      expect(screen02MaterialTimingFacts(candidate)).toEqual([]);
      expect(screen02ProposalHasPreliminaryLifecycle(candidate)).toBe(
        status === "Proposed rule",
      );

      const result = qualifyAndRankScreen02FindProposals(
        [candidate],
        context("Manufacturing"),
        {
          scopeFingerprint: `scope-conditional-${status ?? "source-text"}`,
          maximumCandidates: 8,
        },
      );
      expect(result.selected).toEqual([]);
      expect(result.evaluated).toHaveLength(1);
      expect(result.evaluated[0]?.qualification).toMatchObject({
        eligible: false,
        section: null,
        substantiveOverview: {
          materialDate: false,
          passed: false,
        },
        hardScope: {
          passed: false,
          disposition: "insufficient-evidence",
          insufficientEvidenceKeys: expect.arrayContaining(["studyPeriod"]),
        },
        exclusionCodes: expect.arrayContaining([
          "excluded-insufficient-substantive-information",
        ]),
      });
    },
  );

  it("still qualifies source-established final and adopted rule timing", () => {
    const finalRule = {
      ...proposal("adopted-manufacturing-rule", {
        title: "Manufacturing Product-Control Final Rule",
        description:
          "The Commission adopted the final rule on June 4, 2018. The final rule requires public manufacturing firms and covered manufacturers to change product controls beginning in 2019.",
        populations: [
          "Public manufacturing firms and covered manufacturers",
        ],
      }),
      nativeIdentity: {
        ...manufacturingRule.nativeIdentity!,
        formalIdentifier: "FR-FINAL-001",
        status: "Adopted final rule",
      },
    } satisfies Screen02FindProposal;

    expect(screen02ProposalHasPreliminaryLifecycle(finalRule)).toBe(false);
    expect(screen02MaterialTimingFacts(finalRule).map((fact) => fact.year))
      .toEqual(expect.arrayContaining([2018, 2019]));

    const qualification = qualifyScreen02FindProposal(
      finalRule,
      context("Manufacturing"),
      { scopeFingerprint: "scope-adopted-final-rule" },
    );
    expect(qualification).toMatchObject({
      eligible: true,
      section: "best-match",
      hardScope: { passed: true, disposition: "supported" },
      substantiveOverview: { materialDate: true, passed: true },
    });
  });

  it("excludes a sparse VRS record without a source-established population", () => {
    const sparse = proposal("fr-2019-11744-sparse", {
      title: "Improving Video Relay Service and Direct Video Calling",
      description:
        "Proposed Rule published in the Federal Register on 2019-06-06. Applicability to the requested organizational population is provisional.",
      populations: [SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN],
    });
    const qualification = qualifyScreen02FindProposal(
      sparse,
      context("Video gaming"),
      { scopeFingerprint: "scope-vrs-sparse" },
    );

    expect(qualification.substantiveOverview).toMatchObject({
      change: false,
      affectedPopulation: false,
      passed: false,
    });
    expect(qualification.exclusionCodes).toEqual(
      expect.arrayContaining([
        "industry-mismatch",
        "excluded-insufficient-substantive-information",
      ]),
    );
    expect(isScreen02CandidateQualification(qualification)).toBe(true);
  });

  it("does not let untraced proposal prose or publication metadata establish substance or direct fit", () => {
    const generated = proposal("untraced-manufacturing-prose", {
      title: "Manufacturing Innovation Controls Rule",
      description:
        "The final rule requires public manufacturing firms to change production technology and innovation controls beginning in 2019.",
      populations: ["Public manufacturing firms"],
    });
    const untraced = {
      ...generated,
      event: { ...generated.event, eventDate: "2019-06-06" },
      provisionalDates: ["Publication date: 2019-06-06"],
      sources: generated.sources.map((candidateSource) => {
        const { evidenceText: _untraced, ...sourceMetadata } = candidateSource;
        return sourceMetadata;
      }),
    } satisfies Screen02FindProposal;
    const qualification = qualifyScreen02FindProposal(
      untraced,
      context("Manufacturing"),
      { scopeFingerprint: "scope-untraced-proposal-prose" },
    );

    expect(qualification).toMatchObject({
      classification: "mismatch",
      eligible: false,
      industryFit: { matchedDirectTerms: [], evidenceSourceIds: [] },
      outcomeFit: { status: "not-evaluated", evidenceSourceIds: [] },
      substantiveOverview: {
        identity: false,
        change: false,
        affectedPopulation: false,
        materialDate: false,
        passed: false,
        evidenceSourceIds: [],
      },
      exclusionCodes: expect.arrayContaining([
        "industry-mismatch",
        "excluded-insufficient-substantive-information",
        "insufficient-source-quality",
      ]),
    });
  });

  it("evaluates outcome relevance only after substantive evidence and material period compatibility pass", () => {
    const sparse = proposal("outcome-before-substance", {
      title: "Manufacturing Innovation Notice",
      description: "Manufacturing firms report innovation.",
      populations: ["Public manufacturing firms"],
    });
    sparse.sources = sparse.sources.map((candidateSource) => ({
      ...candidateSource,
      evidenceText:
        "Manufacturing Innovation Notice. Issuing jurisdiction: United States. Manufacturing firms report innovation. Affected population: Public manufacturing firms.",
    }));
    const sparseQualification = qualifyScreen02FindProposal(
      sparse,
      context("Manufacturing"),
      { scopeFingerprint: "scope-outcome-before-substance" },
    );
    expect(sparseQualification).toMatchObject({
      classification: "mismatch",
      hardScope: {
        passed: false,
        blockingKeys: expect.arrayContaining(["studyPeriod"]),
      },
      sourceQuality: { status: "insufficient" },
      substantiveOverview: { passed: false },
      outcomeFit: { status: "not-evaluated", evidenceSourceIds: [] },
    });

    const afterPeriod = {
      ...structuredClone(manufacturingRule),
      id: "material-treatment-after-period",
      description:
        "The final rule requires public manufacturing firms to change innovation controls beginning in 2025.",
      provisionalDates: ["Effective date: 2025-01-01"],
      sources: manufacturingRule.sources.map((candidateSource) => ({
        ...candidateSource,
        id: "material-treatment-after-period-source",
        evidenceText: [
          manufacturingRule.title,
          "Issuing jurisdiction: United States.",
          "The final rule requires public manufacturing firms to change innovation controls beginning in 2025.",
          "Affected population: Public manufacturing firms and covered manufacturers.",
        ].join(" "),
      })),
    } satisfies Screen02FindProposal;
    const afterPeriodQualification = qualifyScreen02FindProposal(
      afterPeriod,
      context("Manufacturing"),
      { scopeFingerprint: "scope-material-treatment-after-period" },
    );
    expect(afterPeriodQualification).toMatchObject({
      eligible: false,
      hardScope: {
        passed: false,
        blockingKeys: expect.arrayContaining(["studyPeriod"]),
      },
      substantiveOverview: { passed: true },
      outcomeFit: { status: "not-evaluated", evidenceSourceIds: [] },
    });
  });

  it("uses profile facts for direct and adjacent fit but never title-only metadata", () => {
    const study = context("Manufacturing");
    const scopeFingerprint = "scope-full-manufacturing-profile";
    const profile = buildScreen02StudyRelevanceProfile({
      scopeFingerprint,
      originalIndustryText: study.scopeContract.industry,
      sampleGeography: study.scopeContract.geography,
      studyPeriod: study.scopeContract.studyPeriod,
      eventFamily: study.scopeContract.eventFamily,
      at: "2026-09-03T12:00:00.000Z",
    });
    profile.subsectors.push("precision wafer fabrication");
    profile.industryActors.push("semiconductor fabricator");
    profile.products.push("silicon wafer");
    profile.services.push("foundry service");
    profile.regulatedActivities.push("photolithography");
    profile.supplyChainRelationships.push("semiconductor equipment supply");

    const direct = proposal("profile-direct", {
      title: "Official operational controls bulletin",
      sourceTitle: "Official operational controls bulletin",
      description:
        "The final rule requires semiconductor fabricators to change photolithography controls for silicon wafer production beginning in 2019.",
      populations: ["Public semiconductor fabrication firms and semiconductor fabricators"],
    });
    const adjacent = proposal("profile-adjacent", {
      title: "Official supplier maintenance rule",
      sourceTitle: "Official supplier maintenance rule",
      description:
        "The final rule requires equipment suppliers to change maintenance controls across the semiconductor equipment supply relationship beginning in 2019.",
      populations: ["Public semiconductor equipment supplier firms"],
    });
    const metadataOnly = proposal("profile-title-only", {
      title: "Silicon wafer photolithography rule",
      sourceTitle: "Semiconductor fabricator official register",
      description:
        "The final rule changes annual reporting procedures for covered public companies beginning in 2019 without identifying their economic activity.",
      populations: ["Covered public companies"],
    });
    metadataOnly.sources[0]!.publisher =
      "Semiconductor Fabricator and Silicon Wafer Register";
    const relationOnly = proposal("profile-relation-only", {
      title: "Official relationship index",
      description: "This index mentions semiconductor equipment supply.",
      populations: ["Public firms"],
    });

    expect(qualifyScreen02FindProposal(direct, study, {
      scopeFingerprint,
      studyProfile: profile,
    })).toMatchObject({ classification: "direct", eligible: true });
    expect(qualifyScreen02FindProposal(adjacent, study, {
      scopeFingerprint,
      studyProfile: profile,
    })).toMatchObject({
      classification: "adjacent",
      eligible: true,
      industryFit: {
        matchedAdjacentTerms: ["semiconductor equipment supply"],
      },
    });
    const titleOnly = qualifyScreen02FindProposal(metadataOnly, study, {
      scopeFingerprint,
      studyProfile: profile,
    });
    expect(titleOnly).toMatchObject({
      classification: "mismatch",
      eligible: false,
      industryFit: { matchedDirectTerms: [], evidenceSourceIds: [] },
    });
    expect(qualifyScreen02FindProposal(relationOnly, study, {
      scopeFingerprint,
      studyProfile: profile,
    })).toMatchObject({ classification: "mismatch", eligible: false });
    const wrongGeography = {
      ...direct,
      id: "profile-direct-wrong-geography",
      event: { ...direct.event, geographies: ["Canada"] },
      sources: direct.sources.map((candidateSource) => ({
        ...candidateSource,
        evidenceText: candidateSource.evidenceText?.replace(
          /United States/gu,
          "Canada",
        ),
      })),
    };
    expect(qualifyScreen02FindProposal(wrongGeography, study, {
      scopeFingerprint,
      studyProfile: profile,
    })).toMatchObject({
      classification: "mismatch",
      eligible: false,
      hardScope: { passed: false },
    });
  });

  it("uses grounded Technology activities for adjacent fit without trusting identity titles", () => {
    const scopeFingerprint = "scope-technology-grounded-adjacent";
    const study = context("Technology");
    const profile = buildScreen02StudyRelevanceProfile({
      scopeFingerprint,
      originalIndustryText: study.scopeContract.industry,
      sampleGeography: study.scopeContract.geography,
      studyPeriod: study.scopeContract.studyPeriod,
      eventFamily: study.scopeContract.eventFamily,
      at: "2026-09-09T12:00:00.000Z",
    });
    const ccpa = proposal("technology-ccpa-adjacent", {
      title: "California Consumer Privacy Act",
      description: "A California privacy statute became operative in 2020.",
      populations: ["Qualifying for-profit businesses"],
    });
    ccpa.sources = [{
      ...source("technology-ccpa-adjacent-source", ccpa.title),
      evidenceText:
        "California Consumer Privacy Act. Issuing jurisdiction: United States. The California Consumer Privacy Act requires covered businesses to change how they collect and use personal information beginning in 2020. Affected population: Qualifying for-profit businesses.",
    }];
    const connectedDevices = proposal("technology-iot-adjacent", {
      title: "California Connected Device Security Law",
      description:
        "A California product-security measure became operative in 2020.",
      populations: [
        "Manufacturers of connected devices sold or offered for sale in California",
      ],
    });
    connectedDevices.sources = [{
      ...source("technology-iot-adjacent-source", connectedDevices.title),
      evidenceText:
        "California Connected Device Security Law. Issuing jurisdiction: United States. The law requires manufacturers of connected devices sold or offered for sale in California to change product security controls beginning in 2020. Affected population: Manufacturers of connected devices sold or offered for sale in California.",
    }];
    const titleOnly = proposal("technology-adjacent-title-only", {
      title: "Personal Information and Connected Device Reporting Rule",
      description:
        "The final rule requires qualifying public companies to change annual reporting procedures beginning in 2019.",
      populations: ["Qualifying public companies"],
    });

    for (const [candidate, term] of [
      [ccpa, "personal information"],
      [connectedDevices, "connected device"],
    ] as const) {
      const qualification = qualifyScreen02FindProposal(candidate, study, {
        scopeFingerprint,
        studyProfile: profile,
      });
      expect(qualification).toMatchObject({
        classification: "adjacent",
        section: "best-match",
        eligible: true,
        hardScope: { passed: true },
        industryFit: {
          matchedDirectTerms: [],
          matchedAdjacentTerms: [term],
          evidenceSourceIds: [candidate.sources[0]!.id],
        },
        substantiveOverview: { passed: true },
        sourceQuality: { status: "high" },
      });
    }

    const rejectedTitle = qualifyScreen02FindProposal(titleOnly, study, {
      scopeFingerprint,
      studyProfile: profile,
    });
    expect(rejectedTitle).toMatchObject({
      classification: "mismatch",
      eligible: false,
      industryFit: {
        matchedDirectTerms: [],
        matchedAdjacentTerms: [],
        evidenceSourceIds: [],
      },
      exclusionCodes: expect.arrayContaining(["industry-mismatch"]),
    });
  });

  it("uses an exact source-verified profile bridge to move an already-eligible broad candidate to adjacent", () => {
    const scopeFingerprint = "scope-host-review-broad-adjacent";
    const profile = candidateReviewProfile(scopeFingerprint);
    const candidate = candidateReviewProposal(
      "host-reviewed-broad",
      { base: broadCorporateRule("host-reviewed-broad") },
    );
    const baseline = qualifyScreen02FindProposal(
      candidate,
      context("Manufacturing"),
      { scopeFingerprint, studyProfile: profile },
    );
    expect(baseline).toMatchObject({
      classification: "broad",
      section: "broader",
      eligible: true,
    });

    const result = qualifyAndRankScreen02FindProposals(
      [candidate],
      context("Manufacturing"),
      {
        scopeFingerprint,
        maximumCandidates: 1,
        studyProfile: profile,
        candidateReviewInfluenceById: candidateReviewInfluence(
          candidate,
          "adjacent",
        ),
      },
    );
    const qualification = result.selected[0]?.qualification;
    expect(qualification).toMatchObject({
      classification: "adjacent",
      section: "best-match",
      eligible: true,
      hostReviewInfluence: {
        schemaVersion: SCREEN02_CANDIDATE_REVIEW_INFLUENCE_TRACE_VERSION,
        noncanonical: true,
        fixedClassification: "broad",
        proposedClass: "adjacent",
        resultingClassification: "adjacent",
        fixedEligibility: true,
        resultingEligibility: true,
        classEffect: "applied-source-verified-adjacent-bridge",
        bridgeVerification: "verified",
        reasons: [],
        verifiedBridge: {
          profileTerms: ["semiconductor equipment supply"],
          sourceIds: [candidate.sources[0]!.id],
          sourceSpans: [{
            sourceId: candidate.sources[0]!.id,
            text: "semiconductor equipment supply relationship",
          }],
        },
        fieldDispositions: {
          proposedClass: "applied-source-verified-adjacent-bridge",
          industryBridge: "source-bound-noncanonical-explanation",
          profileTermsUsed: "fixed-evidence-binding-only",
          sourceIdsUsed: "fixed-evidence-binding-only",
          sourceSpansUsed: "fixed-evidence-binding-only",
          sampleConnection: "audit-only-no-qualification-effect",
          outcomePathway: "audit-only-no-qualification-effect",
          mainMismatchOrUncertainty: "audit-only-no-qualification-effect",
          needsFollowUpRetrieval: "follow-up-signal-only-no-retrieval",
        },
      },
    });
    expect(qualification?.hostReviewInfluence?.review).toEqual(
      candidateReviewInfluence(candidate, "adjacent").get(candidate.id),
    );
    expect(qualification?.industryFit.explanation).not.toContain(
      qualification?.hostReviewInfluence?.review.industryBridge,
    );
    expect(qualification?.industryFit).toMatchObject({
      matchedAdjacentTerms: ["semiconductor equipment supply"],
      evidenceSourceIds: [candidate.sources[0]!.id],
    });
    expect(qualification && isScreen02CandidateQualification(qualification))
      .toBe(true);
  });

  it("applies conservative host downgrades without turning narratives into source facts", () => {
    const scopeFingerprint = "scope-host-review-downgrade";
    const profile = candidateReviewProfile(scopeFingerprint);
    const candidate = candidateReviewProposal("host-reviewed-direct");
    const qualification = qualifyScreen02FindProposal(
      candidate,
      context("Manufacturing"),
      {
        scopeFingerprint,
        studyProfile: profile,
        candidateReviewInfluenceById: candidateReviewInfluence(
          candidate,
          "broad",
        ),
      },
    );

    expect(qualification).toMatchObject({
      classification: "broad",
      section: "broader",
      eligible: true,
      hostReviewInfluence: {
        fixedClassification: "direct",
        resultingClassification: "broad",
        fixedEligibility: true,
        resultingEligibility: true,
        classEffect: "applied-downgrade",
        bridgeVerification: "not-requested",
        fieldDispositions: {
          industryBridge: "audit-only-no-qualification-effect",
          sampleConnection: "audit-only-no-qualification-effect",
          outcomePathway: "audit-only-no-qualification-effect",
          mainMismatchOrUncertainty: "audit-only-no-qualification-effect",
          needsFollowUpRetrieval: "follow-up-signal-only-no-retrieval",
        },
      },
    });
    const trace = qualification.hostReviewInfluence!;
    for (const narrative of [
      trace.review.industryBridge,
      trace.review.sampleConnection,
      trace.review.outcomePathway,
      trace.review.mainMismatchOrUncertainty,
    ]) {
      expect(qualification.substantiveOverview.summary).not.toContain(narrative);
      expect(qualification.industryFit.explanation).not.toContain(narrative);
    }
    expect(isScreen02CandidateQualification(qualification)).toBe(true);
  });

  it("never uses a host assertion to create eligibility or a direct class", () => {
    const scopeFingerprint = "scope-host-review-no-eligibility-creation";
    const profile = candidateReviewProfile(scopeFingerprint);
    const unrelated = candidateReviewProposal(
      "host-reviewed-unrelated",
      {
        base: proposal("host-reviewed-unrelated", {
          title: "Freight Provider Reporting Rule",
          description:
            "The final rule requires public freight providers to change logistics reporting and compliance controls beginning in 2019.",
          populations: ["Public freight provider firms"],
        }),
      },
    );
    const mismatch = qualifyScreen02FindProposal(
      unrelated,
      context("Manufacturing"),
      {
        scopeFingerprint,
        studyProfile: profile,
        candidateReviewInfluenceById: candidateReviewInfluence(
          unrelated,
          "adjacent",
        ),
      },
    );
    expect(mismatch).toMatchObject({
      classification: "mismatch",
      section: null,
      eligible: false,
      hostReviewInfluence: {
        fixedClassification: "mismatch",
        resultingClassification: "mismatch",
        fixedEligibility: false,
        resultingEligibility: false,
        classEffect: "blocked-class-upgrade",
        bridgeVerification: "verified",
        reasons: ["class-upgrade-blocked"],
      },
    });

    const broad = candidateReviewProposal(
      "host-reviewed-no-direct",
      { base: broadCorporateRule("host-reviewed-no-direct") },
    );
    const noDirect = qualifyScreen02FindProposal(
      broad,
      context("Manufacturing"),
      {
        scopeFingerprint,
        studyProfile: profile,
        candidateReviewInfluenceById: candidateReviewInfluence(
          broad,
          "direct",
        ),
      },
    );
    expect(noDirect).toMatchObject({
      classification: "broad",
      section: "broader",
      eligible: true,
      hostReviewInfluence: {
        fixedClassification: "broad",
        proposedClass: "direct",
        resultingClassification: "broad",
        classEffect: "blocked-class-upgrade",
        reasons: ["class-upgrade-blocked"],
      },
    });
  });

  it("fails adjacent influence closed across source binding and every fixed gate", () => {
    const scopeFingerprint = "scope-host-review-adjacent-gates";
    const profile = candidateReviewProfile(scopeFingerprint);
    const valid = candidateReviewProposal("host-review-gate-valid");
    const sourceId = valid.sources[0]!.id;
    const hardScope = candidateReviewProposal("host-review-gate-hard-scope");
    hardScope.event.geographies = ["Canada"];
    hardScope.sources = hardScope.sources.map((candidateSource) => ({
      ...candidateSource,
      evidenceText: candidateSource.evidenceText?.replace(
        /United States/gu,
        "Canada",
      ),
    }));
    const weakSource = candidateReviewProposal(
      "host-review-gate-weak-source",
      { tier: 6 },
    );
    const sparse = candidateReviewProposal("host-review-gate-sparse");
    sparse.description = "Manufacturing rule published in 2019.";
    sparse.sources = sparse.sources.map((candidateSource) => ({
      ...candidateSource,
      evidenceText:
        "Manufacturing rule published in 2019. The record mentions a semiconductor equipment supply relationship without describing a substantive change or affected group.",
    }));
    const infeasible = candidateReviewProposal("host-review-gate-exposure");
    infeasible.likelyServiceLevel = "stop";
    const contradicted = candidateReviewProposal(
      "host-review-gate-contradiction",
      {
        evidenceText:
          "The official text does not apply to semiconductor equipment supply relationships and excludes those firms from the rule.",
      },
    );
    const cases: Array<{
      label: string;
      candidate: Screen02FindProposal;
      review: Map<string, Screen02CandidateReviewInfluence>;
      reason: string;
    }> = [
      {
        label: "missing span",
        candidate: valid,
        review: candidateReviewInfluence(valid, "adjacent", {
          sourceSpansUsed: [],
        }),
        reason: "missing-adjacent-source-span",
      },
      {
        label: "inactive span",
        candidate: valid,
        review: candidateReviewInfluence(valid, "adjacent", {
          sourceIdsUsed: [],
        }),
        reason: "source-span-not-active",
      },
      {
        label: "unknown span",
        candidate: valid,
        review: candidateReviewInfluence(valid, "adjacent", {
          sourceSpansUsed: [{
            sourceId,
            text: "semiconductor equipment supply operators absent from the source",
          }],
        }),
        reason: "source-span-not-found",
      },
      {
        label: "unknown source",
        candidate: valid,
        review: candidateReviewInfluence(valid, "adjacent", {
          sourceIdsUsed: ["source-no-longer-current"],
          sourceSpansUsed: [{
            sourceId: "source-no-longer-current",
            text: "semiconductor equipment supply relationship",
          }],
        }),
        reason: "unknown-source",
      },
      {
        label: "hard scope",
        candidate: hardScope,
        review: candidateReviewInfluence(hardScope, "adjacent"),
        reason: "hard-scope-failed",
      },
      {
        label: "weak source",
        candidate: weakSource,
        review: candidateReviewInfluence(weakSource, "adjacent"),
        reason: "source-quality-failed",
      },
      {
        label: "insufficient substance",
        candidate: sparse,
        review: candidateReviewInfluence(sparse, "adjacent"),
        reason: "substantive-information-failed",
      },
      {
        label: "infeasible exposure",
        candidate: infeasible,
        review: candidateReviewInfluence(infeasible, "adjacent"),
        reason: "exposure-infeasible",
      },
      {
        label: "active contradiction",
        candidate: contradicted,
        review: candidateReviewInfluence(contradicted, "adjacent"),
        reason: "active-contradiction",
      },
    ];

    for (const testCase of cases) {
      const baseline = qualifyScreen02FindProposal(
        testCase.candidate,
        context("Manufacturing"),
        { scopeFingerprint, studyProfile: profile },
      );
      const influenced = qualifyScreen02FindProposal(
        testCase.candidate,
        context("Manufacturing"),
        {
          scopeFingerprint,
          studyProfile: profile,
          candidateReviewInfluenceById: testCase.review,
        },
      );
      expect(
        influenced.hostReviewInfluence?.reasons,
        testCase.label,
      ).toContain(testCase.reason);
      expect(influenced.hostReviewInfluence?.classEffect, testCase.label)
        .toBe("blocked-invalid-influence");
      expect(influenced.hostReviewInfluence?.bridgeVerification, testCase.label)
        .toBe("rejected");
      if (testCase.label === "unknown source") {
        expect(influenced.hostReviewInfluence?.reasons).not.toContain(
          "source-span-not-active",
        );
        expect(influenced.hostReviewInfluence?.reasons).not.toContain(
          "source-span-not-found",
        );
      }
      expect(influenced.classification, testCase.label).toBe(
        baseline.classification,
      );
      expect(influenced.eligible, testCase.label).toBe(baseline.eligible);
      expect(influenced.section, testCase.label).toBe(baseline.section);
      expect(isScreen02CandidateQualification(influenced), testCase.label)
        .toBe(true);
    }
  });

  it("requires every claimed relationship term to share an exact current source binding", () => {
    const scopeFingerprint = "scope-host-review-multi-term";
    const profile = candidateReviewProfile(scopeFingerprint);
    profile.supplyChainRelationships.push("advanced component network");
    const candidate = candidateReviewProposal(
      "host-review-multi-term",
      {
        base: broadCorporateRule("host-review-multi-term"),
        evidenceText:
          "This rule applies new controls through the semiconductor equipment supply relationship and advanced component network beginning in 2019.",
      },
    );
    const sourceId = candidate.sources[0]!.id;
    const common = {
      industryBridge:
        "The semiconductor equipment supply relationship and advanced component network connect the rule to the manufacturing profile.",
      profileTermsUsed: [
        "semiconductor equipment supply",
        "advanced component network",
      ],
      sourceIdsUsed: [sourceId],
    } satisfies Partial<Screen02CandidateReviewInfluence>;

    const missingBinding = qualifyScreen02FindProposal(
      candidate,
      context("Manufacturing"),
      {
        scopeFingerprint,
        studyProfile: profile,
        candidateReviewInfluenceById: candidateReviewInfluence(
          candidate,
          "adjacent",
          {
            ...common,
            sourceSpansUsed: [{
              sourceId,
              text: "semiconductor equipment supply relationship",
            }],
          },
        ),
      },
    );
    expect(missingBinding).toMatchObject({
      classification: "broad",
      section: "broader",
      eligible: true,
      hostReviewInfluence: {
        classEffect: "blocked-invalid-influence",
        bridgeVerification: "rejected",
        reasons: ["bridge-missing-profile-term"],
        verifiedBridge: null,
      },
    });

    const fullyBound = qualifyScreen02FindProposal(
      candidate,
      context("Manufacturing"),
      {
        scopeFingerprint,
        studyProfile: profile,
        candidateReviewInfluenceById: candidateReviewInfluence(
          candidate,
          "adjacent",
          {
            ...common,
            sourceSpansUsed: [
              {
                sourceId,
                text: "semiconductor equipment supply relationship",
              },
              { sourceId, text: "advanced component network" },
            ],
          },
        ),
      },
    );
    expect(fullyBound).toMatchObject({
      classification: "adjacent",
      section: "best-match",
      eligible: true,
      hostReviewInfluence: {
        classEffect: "applied-source-verified-adjacent-bridge",
        bridgeVerification: "verified",
        reasons: [],
        verifiedBridge: {
          profileTerms: [
            "advanced component network",
            "semiconductor equipment supply",
          ],
          sourceIds: [sourceId],
        },
      },
    });
  });

  it("does not let an unrelated strong source launder a Tier-6 bridge citation", () => {
    const scopeFingerprint = "scope-host-review-source-quality";
    const profile = candidateReviewProfile(scopeFingerprint);
    const candidate = candidateReviewProposal(
      "host-review-source-quality",
      { base: broadCorporateRule("host-review-source-quality") },
    );
    const strongSource = {
      ...source("host-review-strong-source", "Official administration notice", 1),
      evidenceText: "The official docket records general filing administration.",
    };
    const weakSource = {
      ...source("host-review-weak-source", "Contextual supply-chain lead", 6),
      evidenceText:
        "The contextual lead describes a semiconductor equipment supply relationship.",
    };
    candidate.sources = [strongSource, weakSource];
    const baseline = qualifyScreen02FindProposal(
      candidate,
      context("Manufacturing"),
      { scopeFingerprint, studyProfile: profile },
    );
    expect(baseline).toMatchObject({
      classification: "mismatch",
      eligible: false,
      sourceQuality: {
        status: "insufficient",
        strongestAuthorityTier: null,
        evidenceSourceIds: [],
      },
      outcomeFit: { status: "not-evaluated" },
      substantiveOverview: { passed: false },
    });

    const influenced = qualifyScreen02FindProposal(
      candidate,
      context("Manufacturing"),
      {
        scopeFingerprint,
        studyProfile: profile,
        candidateReviewInfluenceById: candidateReviewInfluence(
          candidate,
          "adjacent",
          {
            sourceIdsUsed: [weakSource.id],
            sourceSpansUsed: [{
              sourceId: weakSource.id,
              text: "semiconductor equipment supply relationship",
            }],
          },
        ),
      },
    );
    expect(influenced).toMatchObject({
      classification: "mismatch",
      section: null,
      eligible: false,
      hostReviewInfluence: {
        classEffect: "blocked-invalid-influence",
        bridgeVerification: "rejected",
        reasons: expect.arrayContaining([
          "source-quality-failed",
          "substantive-information-failed",
        ]),
        verifiedBridge: null,
      },
    });
  });

  it("rejects a host relevance span that exists only outside candidate-grounded coordinates", () => {
    const scopeFingerprint = "scope-host-review-ungrounded-sidebar";
    const profile = candidateReviewProfile(scopeFingerprint);
    const candidate = candidateReviewProposal(
      "host-review-ungrounded-sidebar",
      {
        base: broadCorporateRule("host-review-ungrounded-sidebar"),
        evidenceText:
          "The Unrelated Supplier Notice Rule requires freight operators to file notices. Sidebar: semiconductor equipment supply relationship.",
      },
    );
    const baseline = qualifyScreen02FindProposal(
      candidate,
      context("Manufacturing"),
      { scopeFingerprint, studyProfile: profile },
    );
    const influenced = qualifyScreen02FindProposal(
      candidate,
      context("Manufacturing"),
      {
        scopeFingerprint,
        studyProfile: profile,
        candidateReviewInfluenceById: candidateReviewInfluence(
          candidate,
          "adjacent",
        ),
      },
    );

    expect(baseline).toMatchObject({
      classification: "broad",
      eligible: true,
    });
    expect(influenced).toMatchObject({
      classification: "broad",
      eligible: true,
      hostReviewInfluence: {
        classEffect: "blocked-invalid-influence",
        bridgeVerification: "rejected",
        reasons: expect.arrayContaining(["source-span-not-grounded"]),
        verifiedBridge: null,
      },
    });
  });

  it("never reuses an old host-influenced qualification without a current review", () => {
    const scopeFingerprint = "scope-host-review-stale-cache";
    const candidate = candidateReviewProposal("host-review-stale-cache");
    const influenced = qualifyScreen02FindProposal(
      candidate,
      context("Manufacturing"),
      {
        scopeFingerprint,
        studyProfile: candidateReviewProfile(scopeFingerprint),
        candidateReviewInfluenceById: candidateReviewInfluence(
          candidate,
          "broad",
        ),
      },
    );
    expect(influenced).toMatchObject({
      classification: "broad",
      hostReviewInfluence: { classEffect: "applied-downgrade" },
    });

    const refreshed = qualifyAndRankScreen02FindProposals(
      [candidate],
      context("Manufacturing"),
      {
        scopeFingerprint,
        maximumCandidates: 1,
        cachedByProposalId: new Map([[candidate.id, influenced]]),
      },
    ).selected[0]!.qualification;
    expect(refreshed).toMatchObject({
      classification: "direct",
      eligible: true,
    });
    expect(refreshed.lane).not.toBe("cached-candidate");
    expect(refreshed).not.toHaveProperty("hostReviewInfluence");
  });

  it("strictly bounds the canonical candidate-review Map and accepts historical traces", () => {
    const scopeFingerprint = "scope-host-review-map-boundary";
    const profile = candidateReviewProfile(scopeFingerprint);
    const candidate = candidateReviewProposal("host-review-map-candidate");
    const validMap = candidateReviewInfluence(candidate, "broad");
    expect(validateScreen02CandidateReviewInfluenceMap(
      validMap,
      [candidate.id],
    )).toEqual(validMap);
    expect(() => validateScreen02CandidateReviewInfluenceMap(
      new Map([["unknown-candidate", validMap.get(candidate.id)!]]),
      [candidate.id],
    )).toThrow(/unknown canonical candidate/i);
    expect(() => validateScreen02CandidateReviewInfluenceMap(
      new Map([[candidate.id, {
        ...validMap.get(candidate.id)!,
        rankingAdjustment: 1,
      }]]),
      [candidate.id],
    )).toThrow(/unknown or missing fields/i);

    const historical = qualifyScreen02FindProposal(
      candidate,
      context("Manufacturing"),
      { scopeFingerprint, studyProfile: profile },
    );
    expect(historical).not.toHaveProperty("hostReviewInfluence");
    expect(isScreen02CandidateQualification(historical)).toBe(true);
    const current = qualifyScreen02FindProposal(
      candidate,
      context("Manufacturing"),
      {
        scopeFingerprint,
        studyProfile: profile,
        candidateReviewInfluenceById: validMap,
      },
    );
    expect(current).toHaveProperty("hostReviewInfluence");
    expect(isScreen02CandidateQualification(current)).toBe(true);
    const rootClassTamper = structuredClone(current);
    rootClassTamper.classification = "direct";
    expect(isScreen02CandidateQualification(rootClassTamper)).toBe(false);
    const rootEligibilityTamper = structuredClone(current);
    rootEligibilityTamper.eligible = false;
    rootEligibilityTamper.section = null;
    rootEligibilityTamper.exclusionCodes = ["industry-mismatch"];
    expect(isScreen02CandidateQualification(rootEligibilityTamper)).toBe(false);
    const reasonTamper = structuredClone(current);
    reasonTamper.hostReviewInfluence!.reasons = ["hard-scope-failed"];
    expect(isScreen02CandidateQualification(reasonTamper)).toBe(false);
    const effectTamper = structuredClone(current);
    effectTamper.hostReviewInfluence!.classEffect =
      "applied-source-verified-adjacent-bridge";
    effectTamper.hostReviewInfluence!.fieldDispositions.proposedClass =
      "applied-source-verified-adjacent-bridge";
    expect(isScreen02CandidateQualification(effectTamper)).toBe(false);
    const restoredHistoricalShape = structuredClone(current);
    delete restoredHistoricalShape.hostReviewInfluence;
    expect(isScreen02CandidateQualification(restoredHistoricalShape)).toBe(true);
  });

  it("keeps broad retrieval words out of Energy and Video gaming qualification", () => {
    const genericEnergy = proposal("generic-energy-sector-rule", {
      title: "Energy Sector Administrative Reporting Rule",
      description:
        "The final rule requires public firms in the energy sector to change administrative reporting beginning in 2019.",
      populations: ["Public firms in the energy sector"],
    });
    const standaloneVideo = proposal("video-relay-provider-rule", {
      title: "Video Relay Provider Operating Rule",
      description:
        "The final rule requires public video relay providers to change call handling beginning in 2019.",
      populations: ["Public video relay providers"],
    });
    const electricStorage = proposal("ferc-order-841", {
      title:
        "Electric Storage Participation in Regional Transmission Markets",
      description:
        "The final rule requires regional transmission organizations and independent system operators to establish a participation model for electric storage resources beginning in 2018.",
      populations: [
        "Regional transmission organizations, independent system operators, and electric storage resources",
      ],
    });

    const genericEnergyQualification = qualifyScreen02FindProposal(
      genericEnergy,
      context("Energy"),
      { scopeFingerprint: "scope-generic-energy" },
    );
    const standaloneVideoQualification = qualifyScreen02FindProposal(
      standaloneVideo,
      context("Video gaming"),
      { scopeFingerprint: "scope-standalone-video" },
    );
    const electricStorageQualification = qualifyScreen02FindProposal(
      electricStorage,
      context("Energy"),
      { scopeFingerprint: "scope-electric-storage" },
    );

    expect(genericEnergyQualification.industryFit.matchedDirectTerms)
      .not.toContain("energy");
    expect(genericEnergyQualification.classification).toBe("mismatch");
    expect(standaloneVideoQualification).toMatchObject({
      classification: "mismatch",
      eligible: false,
    });
    expect(standaloneVideoQualification.industryFit.matchedDirectTerms)
      .toEqual([]);
    expect(electricStorageQualification).toMatchObject({
      classification: "direct",
      eligible: true,
      industryFit: {
        matchedDirectTerms: expect.arrayContaining([
          "electric storage",
          "electric storage resource",
        ]),
      },
    });
  });

  it("retains distinct grounded population evidence beyond a long listing abstract", () => {
    const title =
      "Electric Storage Participation in Markets Operated by Regional Transmission Organizations and Independent System Operators";
    const listingAbstract =
      "The final rule amends federal regulations to remove barriers to electric storage participation in capacity, energy, and ancillary service markets beginning in 2018.";
    const candidate = proposal("order-841-summary", {
      title,
      description: listingAbstract,
      populations: [SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN],
    });
    candidate.affectedPopulation =
      SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN;
    candidate.sources = [
      {
        ...source("order-841-listing", title),
        evidenceText:
          `${title}. Issuing jurisdiction: United States. ${listingAbstract} The final rule is effective June 4, 2018.`,
      },
      {
        ...source("order-841-body", title),
        evidenceText:
          `${title}. This final rule requires each regional transmission organization and independent system operator to revise its tariff and establish a participation model for electric storage resources. The final rule is effective June 4, 2018.`,
      },
    ];

    const qualification = qualifyScreen02FindProposal(
      candidate,
      context("Energy", "Investment"),
      { scopeFingerprint: "scope-order-841-distinct-population" },
    );

    expect(qualification.substantiveOverview).toMatchObject({
      identity: true,
      change: true,
      affectedPopulation: true,
      materialDate: true,
      passed: true,
      whoMayBeAffected: expect.stringMatching(
        /requires each regional transmission organization and independent system operator/i,
      ),
      summary: expect.stringMatching(
        /requires each regional transmission organization and independent system operator/i,
      ),
    });
    expect(
      qualification.substantiveOverview.sourceGrounding.coordinates.some(
        (coordinate) => /requires each regional transmission organization/i
          .test(coordinate.text),
      ),
    ).toBe(true);
  });

  it("keeps source support orthogonal to a demonstrated scope mismatch", () => {
    const euRule = proposal("eu-manufacturing-rule", {
      title: "European Manufacturing Emissions Rule",
      description:
        "The final rule requires public manufacturing firms in the European Union to change emissions reporting beginning in 2019.",
      populations: ["Public manufacturing firms"],
      geographies: ["European Union"],
    });
    const qualification = qualifyScreen02FindProposal(
      euRule,
      context("Manufacturing"),
      { scopeFingerprint: "scope-supported-eu-mismatch" },
    );

    expect(qualification).toMatchObject({
      eligible: false,
      hardScope: {
        evidenceState: "supported",
        relevanceState: "demonstrated-mismatch",
        disposition: "demonstrated-mismatch",
        mismatchKeys: expect.arrayContaining(["geography"]),
        insufficientEvidenceKeys: [],
      },
      sourceQuality: { status: "high" },
      substantiveOverview: {
        identity: true,
        sourceGrounding: {
          coordinates: expect.arrayContaining([expect.objectContaining({
            sourceId: euRule.sources[0]!.id,
            polarity: "affirmative",
          })]),
        },
      },
    });
    expect(qualification.hardScope.explanation).toMatch(
      /outside the confirmed hard scope/i,
    );
    expect(isScreen02CandidateQualification(qualification)).toBe(true);
  });

  it("restores v3 with explicit no-reconstruction provenance and requalifies it instead of reusing it as cache", () => {
    const scopeFingerprint = "scope-stale-v3-cache";
    const fresh = qualifyScreen02FindProposal(
      manufacturingRule,
      context("Manufacturing"),
      { scopeFingerprint },
    );
    expect(fresh.cacheKey).toContain(
      `${SCREEN02_CANDIDATE_QUALIFICATION_VERSION}:${scopeFingerprint}:`,
    );
    const stale = structuredClone(fresh) as unknown as Record<string, unknown>;
    stale.version = SCREEN02_CANDIDATE_QUALIFICATION_PREVIOUS_VERSION;
    stale.cacheKey = (stale.cacheKey as string).replace(
      `${SCREEN02_CANDIDATE_QUALIFICATION_VERSION}:`,
      "",
    );
    const hardScope = stale.hardScope as Record<string, unknown>;
    delete hardScope.evidenceState;
    delete hardScope.relevanceState;
    const overview = stale.substantiveOverview as Record<string, unknown>;
    delete overview.sourceGrounding;

    const migrated = migrateScreen02CandidateQualification(stale);
    expect(migrated).toMatchObject({
      version: SCREEN02_CANDIDATE_QUALIFICATION_VERSION,
      hardScope: {
        evidenceState: "supported",
        relevanceState: "within-scope",
      },
      substantiveOverview: {
        sourceGrounding: { coordinates: [] },
      },
      migrationProvenance: {
        schemaVersion: SCREEN02_CANDIDATE_QUALIFICATION_MIGRATION_VERSION,
        fromVersion: SCREEN02_CANDIDATE_QUALIFICATION_PREVIOUS_VERSION,
        method: "derived-retained-v3-disposition",
        sourceEvidenceReconstructed: false,
      },
    });
    expect(isScreen02CandidateQualification(migrated)).toBe(true);

    const refreshed = qualifyAndRankScreen02FindProposals(
      [manufacturingRule],
      context("Manufacturing"),
      {
        scopeFingerprint,
        maximumCandidates: 1,
        cachedByProposalId: new Map([[manufacturingRule.id, stale as never]]),
      },
    ).selected[0]!.qualification;
    expect(refreshed).not.toHaveProperty("migrationProvenance");
    expect(refreshed.substantiveOverview.sourceGrounding.coordinates.length)
      .toBeGreaterThan(0);
    expect(refreshed.ranking.explanation).not.toMatch(/Reused the persisted/i);
  });

});
