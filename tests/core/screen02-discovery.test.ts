import { describe, expect, it } from "vitest";

import {
  SCREEN02_DISCOVERY_FORMULA_VERSION,
  SCREEN02_NATIVE_QUERY_MAX_VARIANTS,
  SCREEN02_NATIVE_QUERY_MIN_VARIANTS,
  SCREEN02_NATIVE_QUERY_PLAN_VERSION,
  SCREEN02_PROPOSAL_CLUSTER_THRESHOLD,
  buildScreen02DiscoveryQuery,
  buildScreen02NativeQueryPlan,
  canonicalScreen02FormalIdentifier,
  clusterScreen02Proposals,
  compareScreen02Proposals,
  compareScreen02Titles,
  deduplicateScreen02Proposals,
  fuzzyScreen02TitleSimilarity,
  isIndependentlyScopedScreen02FormalIdentifier,
  normalizeScreen02DiscoveryText,
  rankScreen02DocumentsBm25,
  rankScreen02ProposalsBm25,
  scoreScreen02NativeIndustryRelevance,
  scoreScreen02PreferenceRelevance,
  stableScreen02ProposalId,
  tokenizeScreen02DiscoveryText,
} from "../../src/core/screen02-discovery";
import type { Screen01StudyContext } from "../../src/core/scope-types";
import type {
  Screen02AuditProposal,
  Screen02FindProposal,
  Screen02Source,
} from "../../src/core/screen02-types";
import { buildScreen02StudyRelevanceProfile } from "../../src/core/screen02-relevance-profile";

function context(mode: "find" | "audit" = "find"): Screen01StudyContext {
  const sentence =
    mode === "find"
      ? "Find a federal regulatory shock affecting annual profitability among U.S. public manufacturing firms from 2014 to 2022."
      : "Audit whether the California Consumer Privacy Act affected annual innovation among U.S. public technology firms from 2014 to 2022.";
  return {
    schemaVersion: "1.0",
    appVersion: "0.2.0",
    sourceScreen: "screen-01",
    startingPoint: mode,
    studySentence: sentence,
    contractSourceSentence: sentence,
    knownShock:
      mode === "audit"
        ? "California Consumer Privacy Act"
        : "",
    scopeContract: {
      population: `U.S. public ${
        mode === "find" ? "manufacturing" : "technology"
      } firms`,
      assignmentLevel: "Firm",
      analysisLevel: "Firm",
      geography: "United States",
      industry: mode === "find" ? "Manufacturing" : "Technology",
      studyPeriod: "2014–2022",
      eventFamily: "Regulation",
      outcomeFamily:
        mode === "find" ? "Profitability" : "Innovation",
      outcomeFrequency: "Annual",
    },
    resolvedKeys: [
      "population",
      "assignmentLevel",
      "analysisLevel",
      "geography",
      "industry",
      "studyPeriod",
      "eventFamily",
      "outcomeFamily",
      "outcomeFrequency",
      ...(mode === "audit" ? (["knownShock"] as const) : []),
    ],
    unresolvedDecisions: [],
    scopeDirty: false,
    confirmed: true,
    readyForLaterScreens: true,
    revision: 3,
  };
}

function source(
  id: string,
  authorityTier: 1 | 2 | 3 | 4 | 5 | 6,
  locator = `https://agency.example/${id}`,
): Screen02Source {
  return {
    id,
    title: `Official source ${id}`,
    locator,
    publisher: "Example Agency",
    publishedDate: "2019-06-01",
    authorityTier,
    channel: "official register",
  };
}

function findProposal(
  id: string,
  overrides: Partial<Screen02FindProposal> = {},
): Screen02FindProposal {
  return {
    id,
    mode: "find",
    kind: "event",
    title: "2019 Manufacturing Disclosure Rule",
    description:
      "A federal disclosure regulation with public firm-level eligibility data.",
    event: {
      displayName: "2019 Manufacturing Disclosure Rule",
      eventDate: "2019-07-01",
      eventFamily: "Regulation",
      geographies: ["United States"],
      populations: ["U.S. public manufacturing firms"],
    },
    origin: "newly-discovered",
    provisionalDates: ["2019-07-01"],
    affectedPopulation: "Covered U.S. public manufacturing firms",
    requiredVariables: [
      "Public firm-level eligibility threshold",
      "Effective date",
    ],
    outcomeLink: {
      text: "An AI hypothesis links compliance costs to profitability.",
      status: "ai-hypothesis",
    },
    likelyServiceLevel: "assisted-audit",
    limitations: ["Eligibility still requires verification."],
    reasons: ["The event falls inside the locked scope."],
    sources: [],
    ...overrides,
  };
}

function auditProposal(
  id: string,
  representationType:
    | "whole-package"
    | "formal-eligibility"
    | "phase-clock"
    | "realized-exposure" = "formal-eligibility",
  overrides: Partial<Screen02AuditProposal> = {},
): Screen02AuditProposal {
  return {
    id,
    mode: "audit",
    kind: "representation",
    representationType,
    title: "CCPA formal eligibility",
    description: "Formal statutory assignment under the CCPA.",
    candidateConstruct: "CCPA formal eligibility assignment",
    operationalization:
      "Indicator for firms meeting the statutory eligibility threshold.",
    origin: "newly-discovered",
    provisionalDates: ["2020-01-01"],
    affectedPopulation: "Covered firms",
    requiredVariables: ["Statutory threshold", "Firm eligibility"],
    outcomeLink: {
      text: "An AI hypothesis links formal assignment to innovation.",
      status: "ai-hypothesis",
    },
    likelyServiceLevel: "assisted-audit",
    limitations: ["The threshold needs source verification."],
    reasons: ["Formal assignment is a plausible representation."],
    sources: [],
    ...overrides,
  };
}

describe("Screen 2 classical discovery utilities", () => {
  it("builds a bounded video-game query matrix without confusing gambling", () => {
    const plan = buildScreen02NativeQueryPlan({
      industry: "Video games / interactive entertainment",
      require: ["publicly documented coverage"],
    });

    expect(plan).toMatchObject({
      version: SCREEN02_NATIVE_QUERY_PLAN_VERSION,
      status: "ready",
      industry: "Video games / interactive entertainment",
    });
    expect(plan.variants.length).toBeGreaterThanOrEqual(
      SCREEN02_NATIVE_QUERY_MIN_VARIANTS,
    );
    expect(plan.variants.length).toBeLessThanOrEqual(
      SCREEN02_NATIVE_QUERY_MAX_VARIANTS,
    );
    expect(new Set(plan.variants.map((variant) => variant.id)).size).toBe(
      plan.variants.length,
    );
    expect(plan.variants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ query: "video game" }),
        expect.objectContaining({ query: "game developer" }),
        expect.objectContaining({
          query: expect.stringContaining("publicly documented coverage"),
          strategy: "strict-criterion",
        }),
      ]),
    );
    expect(plan.positiveTerms).toContain("video game");
    expect(plan.contrastTerms).toEqual(
      expect.arrayContaining(["gambling", "bingo", "slot machine"]),
    );
    expect(plan.variants.every((variant) => !/profitability/i.test(variant.query))).toBe(
      true,
    );
  });

  it("requires clarification for bare gaming but supports a generic industry phrase", () => {
    expect(
      buildScreen02NativeQueryPlan({ industry: "Gaming" }),
    ).toMatchObject({
      status: "needs-clarification",
      variants: [],
    });
    const generic = buildScreen02NativeQueryPlan({
      industry: "Semiconductor manufacturing",
      require: ["observable eligibility"],
    });
    expect(generic.status).toBe("ready");
    expect(generic.variants[0]?.query).toBe(
      "Semiconductor manufacturing",
    );
    expect(generic.variants.some((variant) =>
      variant.query.includes("observable eligibility"),
    )).toBe(true);
    expect(generic.variants.length).toBeGreaterThanOrEqual(12);
    expect(generic.variants.length).toBeLessThanOrEqual(16);
  });

  it("uses supplemental phrases only as bounded additive retrieval variants", () => {
    const plan = buildScreen02NativeQueryPlan({
      industry: "All industries",
      assistantTerms: [
        "consumer privacy regulation",
        "data protection law",
        "third bounded phrase",
        "fourth bounded phrase",
        "zz fifth phrase that must be dropped",
      ],
    });

    const assistantVariants = plan.variants.filter(
      (variant) => variant.strategy === "chatgpt-query-expansion",
    );
    expect(assistantVariants).toHaveLength(4);
    expect(assistantVariants.map((variant) => variant.query)).toEqual([
      "All industries consumer privacy regulation",
      "All industries data protection law",
      "All industries fourth bounded phrase",
      "All industries third bounded phrase",
    ]);
    expect(plan.variants.every((variant) =>
      !variant.query.toLowerCase().includes("business regulation")
    )).toBe(true);
    expect(
      assistantVariants.every(
        (variant) =>
          /recall only/i.test(variant.purpose) &&
          /proves no event fact/i.test(variant.purpose) &&
          /bounded supplemental vocabulary/i.test(variant.purpose) &&
          !/ChatGPT|host|model|MCP|provider|fallback/i.test(variant.purpose),
      ),
    ).toBe(true);
    expect(plan.positiveTerms).not.toContain("consumer privacy regulation");
  });

  it("anchors cross-industry searches in the fixed study profile event vocabulary", () => {
    const profile = buildScreen02StudyRelevanceProfile({
      scopeFingerprint: "scope-cross-industry-disaster",
      originalIndustryText: "All industries",
      sampleGeography: "Chile",
      studyPeriod: "2010–2020",
      eventFamily: "Earthquake disaster",
      at: "2026-09-03T12:00:00.000Z",
    });
    const plan = buildScreen02NativeQueryPlan({
      industry: "All industries",
      studyProfile: profile,
    });

    expect(plan.variants[0]).toMatchObject({
      query: "earthquake disaster",
      strategy: "industry-exact",
    });
    expect(plan.variants[0]?.purpose).toMatch(/profile-defined/i);
    expect(plan.variants.every((variant) =>
      !variant.query.toLowerCase().includes("business regulation")
    )).toBe(true);
  });

  it("uses the complete optional study profile without changing legacy queries", () => {
    const study = context();
    const profile = buildScreen02StudyRelevanceProfile({
      scopeFingerprint: "scope-manufacturing-profile",
      originalIndustryText: study.scopeContract.industry,
      sampleGeography: study.scopeContract.geography,
      studyPeriod: study.scopeContract.studyPeriod,
      eventFamily: study.scopeContract.eventFamily,
      requiredCriteria: ["observable covered entities"],
      preferredCriteria: ["machine-readable notices"],
      avoidedCriteria: ["exclude private-only firms"],
      at: "2026-09-03T12:00:00.000Z",
    });
    profile.subsectors.push("precision wafer fabrication");
    profile.industryActors.push("semiconductor fabricator");
    profile.products.push("silicon wafer");
    profile.services.push("foundry service");
    profile.regulatedActivities.push("photolithography");
    profile.supplyChainRelationships.push("semiconductor equipment supply");

    const legacy = buildScreen02DiscoveryQuery(study);
    const expanded = buildScreen02DiscoveryQuery(study, {}, profile);
    expect(expanded).toContain(legacy);
    for (const term of [
      "precision wafer fabrication",
      "semiconductor fabricator",
      "silicon wafer",
      "foundry service",
      "photolithography",
      "semiconductor equipment supply",
      "observable covered entities",
      "machine readable notices",
    ]) expect(expanded).toContain(term);
    expect(expanded).not.toContain("exclude private-only firms");

    const native = buildScreen02NativeQueryPlan({
      industry: study.scopeContract.industry,
      studyProfile: profile,
    });
    expect(native.positiveTerms).toEqual(expect.arrayContaining([
      "precision wafer fabrication",
      "semiconductor fabricator",
      "silicon wafer",
      "foundry service",
      "photolithography",
      "semiconductor equipment supply",
    ]));
  });

  it("scores industry relevance only from source-derived text", () => {
    const videoGame = findProposal("video-game-rule", {
      title: "Access Controls for Video Game Consoles",
      description:
        "The rule addresses access-control circumvention for video game console software.",
      event: {
        displayName: "Access Controls for Video Game Consoles",
        eventDate: "2015-10-28",
        eventFamily: "Regulation",
        geographies: ["United States"],
        populations: ["Covered organizations"],
      },
    });
    const gambling = findProposal("gambling-rule", {
      title: "Information Returns for Bingo, Keno, and Slot Machines",
      description: "The rule concerns reportable gambling winnings.",
    });
    const fishery = findProposal("fishery-rule", {
      title: "Longline Pot Gear in the Gulf of Alaska",
      description: "The rule concerns sablefish fishing quotas.",
    });
    const contextInjected = findProposal("context-injected", {
      title: "Unrelated Reporting Rule",
      description: "The rule concerns municipal water records.",
      affectedPopulation: "U.S. public video-game firms",
      outcomeLink: {
        text: "A system template says it could affect video-game profitability.",
        status: "system-template",
      },
    });
    const mixed = findProposal("mixed-rule", {
      title: "Video Game Loot-Box and Gambling Disclosures",
      description:
        "The rule addresses video games that contain gambling-like mechanics.",
    });
    const industry = "Video games / interactive entertainment";

    expect(
      scoreScreen02NativeIndustryRelevance(videoGame, industry),
    ).toMatchObject({ status: "clear-fit" });
    expect(
      scoreScreen02NativeIndustryRelevance(videoGame, industry).score,
    ).toBeGreaterThanOrEqual(60);
    expect(
      scoreScreen02NativeIndustryRelevance(gambling, industry),
    ).toMatchObject({
      status: "mismatch",
      matchedContrastTerms: ["gambling"],
    });
    expect(
      scoreScreen02NativeIndustryRelevance(fishery, industry),
    ).toMatchObject({ status: "mismatch", score: 0 });
    expect(
      scoreScreen02NativeIndustryRelevance(contextInjected, industry),
    ).toMatchObject({ status: "mismatch", score: 0 });
    expect(
      scoreScreen02NativeIndustryRelevance(mixed, industry),
    ).toMatchObject({ status: "possible-fit", score: 60 });
  });

  it("normalizes and tokenizes text with fixed Unicode and stop-word rules", () => {
    expect(
      normalizeScreen02DiscoveryText(
        "  U.S. Café’s Firm-Level Rule & Threshold  ",
      ),
    ).toBe("us cafes firm level rule and threshold");
    expect(
      tokenizeScreen02DiscoveryText(
        "The U.S. rule and a 5-year threshold",
      ),
    ).toEqual(["us", "rule", "5", "year", "threshold"]);
    expect(
      tokenizeScreen02DiscoveryText("The rule and threshold", {
        removeStopWords: false,
      }),
    ).toEqual(["the", "rule", "and", "threshold"]);
  });

  it("ranks documents with deterministic BM25 diagnostics and stable ties", () => {
    const ranked = rankScreen02DocumentsBm25(
      "federal manufacturing eligibility threshold",
      [
        {
          id: "z-weak",
          text: "A local weather event affecting retail stores.",
          value: "weak",
        },
        {
          id: "a-strong",
          text: "Federal manufacturing eligibility threshold rule.",
          value: "strong",
        },
        {
          id: "b-tie",
          text: "No matching vocabulary.",
          value: "tie-b",
        },
        {
          id: "a-tie",
          text: "No matching vocabulary.",
          value: "tie-a",
        },
      ],
    );

    expect(ranked[0]).toMatchObject({
      id: "a-strong",
      value: "strong",
      rank: 1,
    });
    expect(ranked[0].rankScore).toBeGreaterThan(0);
    expect(ranked[0].diagnostics.formulaVersion).toBe(
      SCREEN02_DISCOVERY_FORMULA_VERSION,
    );
    expect(ranked[0].diagnostics.matchedTerms).toEqual([
      "eligibility",
      "federal",
      "manufacturing",
      "threshold",
    ]);
    expect(
      ranked.find((entry) => entry.id === "a-tie")?.rank,
    ).toBeLessThan(
      ranked.find((entry) => entry.id === "b-tie")?.rank ?? 0,
    );
  });

  it("ranks Screen 2 proposals against the locked context and preferences", () => {
    const matching = findProposal("matching");
    const unrelated = findProposal("unrelated", {
      title: "Regional Flood Closure",
      description: "A weather disruption affecting local restaurants.",
      event: {
        displayName: "Regional Flood Closure",
        eventDate: "2019-07-01",
        eventFamily: "Disaster",
        geographies: ["France"],
        populations: ["Restaurants"],
      },
      affectedPopulation: "Restaurants",
      requiredVariables: ["Rainfall"],
      reasons: ["Weather exposure."],
    });
    const preferences = {
      require: ["public firm-level eligibility"],
      prefer: ["federal regulation"],
      avoid: ["proprietary data"],
    };
    const ranked = rankScreen02ProposalsBm25(
      [unrelated, matching],
      context(),
      preferences,
    );

    expect(ranked.map((entry) => entry.proposalId)).toEqual([
      "matching",
      "unrelated",
    ]);
    expect(ranked[0].stableProposalId).toMatch(/^s2p-[a-f0-9]{16}$/);
    expect(ranked[0].documentId).toContain(
      ranked[0].stableProposalId,
    );
    expect(ranked[0].preferenceRelevance.requiredSatisfied).toBe(
      true,
    );
    expect(
      buildScreen02DiscoveryQuery(context(), preferences),
    ).not.toContain("proprietary data");
  });

  it("excludes the requested outcome from BM25 query and proposal text", () => {
    const originalContext = context();
    const changedOutcome = {
      ...originalContext,
      studySentence: originalContext.studySentence.replace(
        "profitability",
        "employment",
      ),
      scopeContract: {
        ...originalContext.scopeContract,
        outcomeFamily: "Employment",
        outcomeFrequency: "Quarterly",
      },
    } satisfies Screen01StudyContext;
    const original = findProposal("outcome-invariant");
    const changedProposal = {
      ...original,
      outcomeLink: {
        text: "Employment employment employment quarterly employment.",
        status: "system-template" as const,
      },
    };

    expect(buildScreen02DiscoveryQuery(originalContext)).toBe(
      buildScreen02DiscoveryQuery(changedOutcome),
    );
    expect(
      rankScreen02ProposalsBm25([original], originalContext)[0]?.rankScore,
    ).toBe(
      rankScreen02ProposalsBm25([changedProposal], changedOutcome)[0]?.rankScore,
    );
  });

  it("returns transparent fuzzy-title components", () => {
    const similar = compareScreen02Titles(
      "California Consumer Privacy Act",
      "Consumer Privacy Act, California",
    );
    const unrelated = fuzzyScreen02TitleSimilarity(
      "California Consumer Privacy Act",
      "Hurricane Plant Closure",
    );

    expect(similar.tokenJaccard).toBe(1);
    expect(similar.score).toBeGreaterThan(0.75);
    expect(unrelated).toBeLessThan(0.25);
  });

  it("clusters and consolidates duplicate proposals with stable diagnostics", () => {
    const weaker = findProposal("secondary-record", {
      title: "Manufacturing Disclosure Rule 2019",
      event: {
        displayName: "Manufacturing Disclosure Rule 2019",
        eventDate: "2019-07-01",
        eventFamily: "Regulation",
        geographies: ["United States"],
        populations: ["U.S. public manufacturing firms"],
      },
      sources: [source("secondary", 5)],
      requiredVariables: ["Coverage indicator"],
    });
    const stronger = findProposal("official-record", {
      sources: [source("controlling", 1)],
      origin: "registry-reviewed",
      limitations: ["Controlling text still needs passage extraction."],
    });
    const distinct = findProposal("distinct-event", {
      title: "2021 Factory Energy Credit",
      event: {
        displayName: "2021 Factory Energy Credit",
        eventDate: "2021-04-01",
        eventFamily: "Tax policy",
        geographies: ["United States"],
        populations: ["U.S. public manufacturing firms"],
      },
    });

    const first = deduplicateScreen02Proposals([
      weaker,
      distinct,
      stronger,
    ]);
    const reordered = deduplicateScreen02Proposals([
      stronger,
      weaker,
      distinct,
    ]);

    expect(first.threshold).toBe(
      SCREEN02_PROPOSAL_CLUSTER_THRESHOLD,
    );
    expect(first.retainedProposalIds).toEqual([
      "distinct-event",
      "official-record",
    ]);
    expect(first.duplicateProposalIds).toEqual([
      "secondary-record",
    ]);
    expect(first.clusters).toEqual(reordered.clusters);
    expect(first.membership).toEqual(reordered.membership);
    expect(first.comparisons).toEqual(reordered.comparisons);

    const duplicateCluster = first.clusters.find(
      (cluster) =>
        cluster.canonicalProposalId === "official-record",
    );
    expect(duplicateCluster).toMatchObject({
      memberProposalIds: ["official-record", "secondary-record"],
      duplicateProposalIds: ["secondary-record"],
    });
    expect(duplicateCluster?.clusterId).toMatch(
      /^s2c-[a-f0-9]{16}$/,
    );
    expect(
      first.membership["official-record"],
    ).toBe(first.membership["secondary-record"]);

    const consolidated = first.proposals.find(
      (proposal) => proposal.id === "official-record",
    );
    expect(consolidated?.sources.map((item) => item.id)).toEqual([
      "controlling",
      "secondary",
    ]);
    expect(consolidated?.requiredVariables).toContain(
      "Coverage indicator",
    );
  });

  it("keeps same-title Federal Register notices with conflicting formal identifiers separate", () => {
    const initialNotice = findProposal("manufacturing-council-initial", {
      title: "Manufacturing Council",
      nativeIdentity: {
        formalIdentifier: "FR Doc. 2014-21513",
        issuer: "Department of Commerce",
        issuingJurisdiction: "United States",
        status: "Nonbinding administrative/governance notice",
      },
      event: {
        displayName: "Manufacturing Council",
        eventDate: "2014-09-10",
        eventFamily: "Administrative/governance event",
        geographies: ["United States"],
        populations: ["Manufacturing Council applicants"],
      },
    });
    const followUpNotice = findProposal("manufacturing-council-follow-up", {
      title: "Manufacturing Council",
      nativeIdentity: {
        formalIdentifier: "FR Doc. 2014-25531",
        issuer: "Department of Commerce",
        issuingJurisdiction: "United States",
        status: "Nonbinding administrative/governance notice",
      },
      event: {
        displayName: "Manufacturing Council",
        eventDate: "2014-10-27",
        eventFamily: "Administrative/governance event",
        geographies: ["United States"],
        populations: ["Manufacturing Council applicants"],
      },
    });

    expect(
      compareScreen02Proposals(initialNotice, followUpNotice),
    ).toMatchObject({
      compatible: false,
      score: 0,
      reason:
        "Different formal document identifiers remain separate even when titles overlap.",
    });
    const result = deduplicateScreen02Proposals([
      followUpNotice,
      initialNotice,
    ]);
    expect(result.proposals).toHaveLength(2);
    expect(result.duplicateProposalIds).toEqual([]);
    expect(result.clusters).toHaveLength(2);
  });

  it("clusters equivalent Federal Register identifier formats", () => {
    const first = findProposal("formal-prefixed", {
      nativeIdentity: {
        formalIdentifier: "FR Doc. 2014-21513",
        issuer: "Department of Commerce",
        issuingJurisdiction: "United States",
        status: "Published",
      },
    });
    const second = findProposal("formal-bare", {
      nativeIdentity: {
        formalIdentifier: "2014-21513",
        issuer: "Department of Commerce",
        issuingJurisdiction: "United States",
        status: "Published",
      },
      sources: [{
        ...source("federal-register-2014-21513", 1),
        title: "Federal Register document 2014-21513",
        publisher: "Federal Register",
        channel: "Federal Register",
      }],
    });

    expect(compareScreen02Proposals(first, second)).toMatchObject({
      compatible: true,
      score: 1,
      reason:
        "The proposals have the same issuer-scoped formal identity in compatible issuing jurisdictions.",
    });
    expect(deduplicateScreen02Proposals([first, second]).proposals).toHaveLength(1);
  });

  it("consolidates differently shaped non-Federal lanes with the same normalized formal identity deterministically", () => {
    const reviewed = findProposal("reviewed-orchid-instrument", {
      title: "Orchid Digital Services Instrument",
      description:
        "A reviewed instrument that became applicable to covered services in 2022.",
      origin: "registry-reviewed",
      nativeIdentity: {
        formalIdentifier: "EU 2019/770",
        issuer: "Orchid Council",
        issuingJurisdiction: "European Union",
        status: "Final instrument",
      },
      event: {
        displayName: "Orchid Digital Services Instrument",
        eventDate: "2022-01-01",
        eventFamily: "Consumer law",
        geographies: ["European Union", "European Economic Area"],
        populations: ["Covered digital-service suppliers"],
      },
      provisionalDates: ["Applicable date: 2022-01-01"],
      sources: [source("reviewed-orchid-source", 1)],
    });
    const live = findProposal("cellar-orchid-record", {
      title: "Official journal record for digital-content contracts",
      description:
        "Repository metadata for a legal document published during 2019.",
      nativeIdentity: {
        formalIdentifier: "eu-2019-770",
        issuer: null,
        issuingJurisdiction: "EU",
        status: "Published legal document",
      },
      event: {
        displayName: "Digital-content contract requirements",
        eventDate: "2019-05-22",
        eventFamily: "Regulation",
        geographies: ["European Union"],
        populations: ["Population coverage not established by source"],
      },
      provisionalDates: ["Document date: 2019-05-22"],
      sources: [source("live-orchid-source", 2)],
    });

    expect(compareScreen02Proposals(reviewed, live)).toMatchObject({
      compatible: true,
      score: 1,
      reason:
        "The proposals have the same issuer-scoped formal identity in compatible issuing jurisdictions.",
    });
    const forward = deduplicateScreen02Proposals([reviewed, live]);
    const reversed = deduplicateScreen02Proposals([live, reviewed]);
    expect(forward.proposals).toHaveLength(1);
    expect(forward.retainedProposalIds).toEqual([reviewed.id]);
    expect(forward.clusters).toEqual(reversed.clusters);
    expect(forward.membership).toEqual(reversed.membership);
    expect(forward.comparisons).toEqual(reversed.comparisons);
  });

  it("canonicalizes European instrument wrappers, suffix namespaces, and lowercase scoped IDs", () => {
    for (const [variant, canonical] of [
      ["Directive 2019/770/EU", "directive eu 2019 770"],
      ["EU Directive 2019/770", "directive eu 2019 770"],
      ["Directive 2019/770/EC", "directive ec 2019 770"],
      ["EC 2019/770", "ec 2019 770"],
      ["Commission Implementing Regulation (EU) No. 2018/1234", "implementing regulation eu 2018 1234"],
      ["EU 2018/1234", "eu 2018 1234"],
      ["Regulation (EC) No. 1234/2008", "regulation ec 2008 1234"],
      ["EC 1234/2008", "ec 2008 1234"],
    ] as const) {
      expect(canonicalScreen02FormalIdentifier(variant)).toBe(canonical);
    }
    expect(isIndependentlyScopedScreen02FormalIdentifier("ou 2019/770"))
      .toBe(true);

    const wrapped = findProposal("wrapped-eu-instrument", {
      nativeIdentity: {
        formalIdentifier:
          "Commission Implementing Regulation (EU) No. 2018/1234",
        issuer: "European Commission",
        issuingJurisdiction: "European Union",
        status: "Final regulation",
      },
    });
    const compact = findProposal("compact-eu-instrument", {
      ...structuredClone(wrapped),
      id: "compact-eu-instrument",
      nativeIdentity: {
        ...structuredClone(wrapped.nativeIdentity!),
        formalIdentifier: "EU 2018/1234",
        issuingJurisdiction: "EU",
      },
    });

    expect(compareScreen02Proposals(wrapped, compact)).toMatchObject({
      compatible: true,
      score: 1,
    });
    expect(deduplicateScreen02Proposals([compact, wrapped]).proposals)
      .toHaveLength(1);
  });

  it("does not let a bare California bill ID bridge conflicting rich coordinates", () => {
    const version = (id: string, formalIdentifier: string) =>
      findProposal(id, {
        title: "California Consumer Privacy Act",
        nativeIdentity: {
          formalIdentifier,
          issuer: "California Legislature",
          issuingJurisdiction: "California, United States",
          status: "Enacted",
        },
      });
    const chapter55 = version(
      "ccpa-chapter-55",
      "AB 375, Chapter 55, Statutes of 2018",
    );
    const bare = version("ccpa-bare", "AB 375");
    const chapter56 = version(
      "ccpa-chapter-56",
      "AB 375, Chapter 56, Statutes of 2024",
    );

    expect(compareScreen02Proposals(chapter55, chapter56)).toMatchObject({
      compatible: false,
      score: 0,
      reason:
        "Conflicting formal-identifier coordinates remain separate even when titles overlap.",
    });
    const clustering = clusterScreen02Proposals([
      chapter56,
      bare,
      chapter55,
    ]);
    expect(clustering.clusters).toHaveLength(2);
    expect(clustering.clusters.every((cluster) =>
      !(cluster.memberProposalIds.includes(chapter55.id) &&
        cluster.memberProposalIds.includes(chapter56.id))
    )).toBe(true);
  });

  it("retains meaningful identifier schemes and separates reuse across incompatible jurisdictions", () => {
    const instrument = (
      id: string,
      formalIdentifier: string,
      issuingJurisdiction: string,
      title: string,
      family: string,
    ) => findProposal(id, {
      title,
      description: `${title} establishes source-backed requirements.`,
      nativeIdentity: {
        formalIdentifier,
        issuer: `${issuingJurisdiction} Authority`,
        issuingJurisdiction,
        status: "Final instrument",
      },
      event: {
        displayName: title,
        eventDate: "2020-06-01",
        eventFamily: family,
        geographies: [issuingJurisdiction],
        populations: ["Covered organizations"],
      },
      provisionalDates: ["2020-06-01"],
    });
    const firstScheme = instrument(
      "first-scheme",
      "EU 2019/770",
      "Shared Union",
      "Digital Contract Instrument",
      "Consumer law",
    );
    const secondScheme = instrument(
      "second-scheme",
      "OU 2019/770",
      "Shared Union",
      "Energy Grid Instrument",
      "Energy regulation",
    );
    const reusedElsewhere = instrument(
      "reused-elsewhere",
      "EU 2019/770",
      "Different Republic",
      "Digital Contract Instrument",
      "Consumer law",
    );

    expect(compareScreen02Proposals(firstScheme, secondScheme).score)
      .toBeLessThan(SCREEN02_PROPOSAL_CLUSTER_THRESHOLD);
    expect(compareScreen02Proposals(firstScheme, reusedElsewhere)).toMatchObject({
      compatible: false,
      score: 0,
      reason:
        "The same formal identifier is reused across incompatible issuing jurisdictions.",
    });
    expect(deduplicateScreen02Proposals([
      reusedElsewhere,
      secondScheme,
      firstScheme,
    ]).proposals).toHaveLength(3);
  });

  it("does not treat a generic local identifier as globally unique across issuers", () => {
    const first = findProposal("commerce-order-12", {
      title: "Commerce reporting waiver",
      nativeIdentity: {
        formalIdentifier: "Order 12",
        issuer: "Commerce Department",
        issuingJurisdiction: "Example Republic",
        status: "Final order",
      },
      event: {
        displayName: "Commerce reporting waiver",
        eventDate: "2020-03-01",
        eventFamily: "Administrative order",
        geographies: ["Example Republic"],
        populations: ["Licensed exporters"],
      },
    });
    const second = findProposal("energy-order-12", {
      title: "Energy rationing direction",
      nativeIdentity: {
        formalIdentifier: "order-12",
        issuer: "Energy Commission",
        issuingJurisdiction: "Example Republic",
        status: "Final order",
      },
      event: {
        displayName: "Energy rationing direction",
        eventDate: "2021-11-15",
        eventFamily: "Emergency direction",
        geographies: ["Example Republic"],
        populations: ["Grid operators"],
      },
    });

    expect(compareScreen02Proposals(first, second)).toMatchObject({
      compatible: false,
      score: 0,
      reason:
        "The same local formal identifier is reused by different issuing bodies.",
    });
    expect(deduplicateScreen02Proposals([second, first]).proposals).toHaveLength(2);
  });

  it("does not promote a generic instrument label with a year and serial into a global namespace", () => {
    const first = findProposal("local-order-first", {
      title: "Port operating restriction",
      nativeIdentity: {
        formalIdentifier: "Order No. 2019/12",
        issuer: null,
        issuingJurisdiction: "Example Republic",
        status: "Final order",
      },
      event: {
        displayName: "Port operating restriction",
        eventDate: "2019-03-01",
        eventFamily: "Transport order",
        geographies: ["Example Republic"],
        populations: ["Port operators"],
      },
    });
    const second = findProposal("local-order-second", {
      title: "Hospital staffing requirement",
      nativeIdentity: {
        formalIdentifier: "Order No. 2019/12",
        issuer: null,
        issuingJurisdiction: "Example Republic",
        status: "Final order",
      },
      event: {
        displayName: "Hospital staffing requirement",
        eventDate: "2021-08-15",
        eventFamily: "Health order",
        geographies: ["Example Republic"],
        populations: ["Hospitals"],
      },
    });

    const comparison = compareScreen02Proposals(first, second);
    expect(comparison.score).toBeLessThan(SCREEN02_PROPOSAL_CLUSTER_THRESHOLD);
    expect(deduplicateScreen02Proposals([first, second]).proposals).toHaveLength(2);
  });

  it("does not infer a Federal Register namespace from a non-US bare year/serial", () => {
    const first = findProposal("bare-serial-port", {
      title: "Port operating restriction",
      nativeIdentity: {
        formalIdentifier: "2019-12345",
        issuer: null,
        issuingJurisdiction: "Example Republic",
        status: "Final order",
      },
      event: {
        displayName: "Port operating restriction",
        eventDate: "2019-03-01",
        eventFamily: "Transport order",
        geographies: ["Example Republic"],
        populations: ["Port operators"],
      },
    });
    const second = findProposal("bare-serial-health", {
      title: "Hospital staffing requirement",
      nativeIdentity: {
        formalIdentifier: "2019-12345",
        issuer: null,
        issuingJurisdiction: "Example Republic",
        status: "Final order",
      },
      event: {
        displayName: "Hospital staffing requirement",
        eventDate: "2021-08-15",
        eventFamily: "Health order",
        geographies: ["Example Republic"],
        populations: ["Hospitals"],
      },
    });

    expect(compareScreen02Proposals(first, second).score)
      .toBeLessThan(SCREEN02_PROPOSAL_CLUSTER_THRESHOLD);
    expect(deduplicateScreen02Proposals([second, first]).proposals).toHaveLength(2);
  });

  it("does not infer a Federal Register namespace from a US issuer alone", () => {
    const first = findProposal("us-bare-commerce", {
      title: "Commerce reporting waiver",
      nativeIdentity: {
        formalIdentifier: "2019-12345",
        issuer: "Department of Commerce",
        issuingJurisdiction: "United States",
        status: "Final order",
      },
      event: {
        displayName: "Commerce reporting waiver",
        eventDate: "2019-03-01",
        eventFamily: "Trade order",
        geographies: ["United States"],
        populations: ["Licensed exporters"],
      },
    });
    const second = findProposal("us-bare-energy", {
      title: "Energy rationing direction",
      nativeIdentity: {
        formalIdentifier: "2019-12345",
        issuer: "Federal Energy Commission",
        issuingJurisdiction: "United States",
        status: "Final order",
      },
      event: {
        displayName: "Energy rationing direction",
        eventDate: "2021-08-15",
        eventFamily: "Emergency direction",
        geographies: ["United States"],
        populations: ["Grid operators"],
      },
    });

    expect(compareScreen02Proposals(first, second)).toMatchObject({
      compatible: false,
      score: 0,
      reason:
        "The same local formal identifier is reused by different issuing bodies.",
    });
  });

  it("does not treat descriptive instrument words as independent namespaces", () => {
    const instrument = (id: string, title: string, family: string) =>
      findProposal(id, {
        title,
        nativeIdentity: {
          formalIdentifier: "Ministerial Order 2019/12",
          issuer: null,
          issuingJurisdiction: "Example Republic",
          status: "Final order",
        },
        event: {
          displayName: title,
          eventDate: "2020-01-01",
          eventFamily: family,
          geographies: ["Example Republic"],
          populations: ["Covered organizations"],
        },
      });
    const first = instrument("ministerial-port", "Port operating restriction", "Transport");
    const second = instrument("ministerial-health", "Hospital staffing requirement", "Health");

    expect(compareScreen02Proposals(first, second).score)
      .toBeLessThan(SCREEN02_PROPOSAL_CLUSTER_THRESHOLD);
    expect(deduplicateScreen02Proposals([first, second]).proposals).toHaveLength(2);
  });

  it("does not treat an uppercase lifecycle label as an independent namespace", () => {
    const record = (id: string, title: string, family: string) =>
      findProposal(id, {
        title,
        nativeIdentity: {
          formalIdentifier: "FINAL ORDER 2019/12",
          issuer: null,
          issuingJurisdiction: "Example Republic",
          status: "Final order",
        },
        event: {
          displayName: title,
          eventDate: "2020-01-01",
          eventFamily: family,
          geographies: ["Example Republic"],
          populations: ["Covered organizations"],
        },
      });
    const first = record("final-order-port", "Port operating restriction", "Transport");
    const second = record("final-order-health", "Hospital staffing requirement", "Health");

    expect(compareScreen02Proposals(first, second).score)
      .toBeLessThan(SCREEN02_PROPOSAL_CLUSTER_THRESHOLD);
  });

  it("canonicalizes jurisdictional issuer qualifiers without equating different bodies", () => {
    const shortIssuer = findProposal("california-order-short-issuer", {
      nativeIdentity: {
        formalIdentifier: "Order 12",
        issuer: "California Legislature",
        issuingJurisdiction: "California, United States",
        status: "Final order",
      },
    });
    const qualifiedIssuer = findProposal("california-order-qualified-issuer", {
      ...structuredClone(shortIssuer),
      id: "california-order-qualified-issuer",
      nativeIdentity: {
        ...structuredClone(shortIssuer.nativeIdentity!),
        issuer: "Legislature of the State of California",
        issuingJurisdiction: "California",
      },
    });
    const differentBody = findProposal("california-order-different-body", {
      ...structuredClone(shortIssuer),
      id: "california-order-different-body",
      nativeIdentity: {
        ...structuredClone(shortIssuer.nativeIdentity!),
        issuer: "California Energy Commission",
      },
    });
    const stateQualified = findProposal("california-order-state-qualified", {
      ...structuredClone(shortIssuer),
      id: "california-order-state-qualified",
      nativeIdentity: {
        ...structuredClone(shortIssuer.nativeIdentity!),
        issuer: "California State Legislature",
        issuingJurisdiction: "State of California",
      },
    });

    expect(compareScreen02Proposals(shortIssuer, qualifiedIssuer)).toMatchObject({
      compatible: true,
      score: 1,
    });
    expect(compareScreen02Proposals(shortIssuer, differentBody)).toMatchObject({
      compatible: false,
      score: 0,
    });
    expect(compareScreen02Proposals(shortIssuer, stateQualified)).toMatchObject({
      compatible: true,
      score: 1,
    });
  });

  it("preserves meaningful issuer modifiers and never lets a scoped ID override known issuer conflict", () => {
    const authority = (id: string, issuer: string) => findProposal(id, {
      title: "Energy market instrument",
      nativeIdentity: {
        formalIdentifier: "OU 2020/12",
        issuer,
        issuingJurisdiction: "Orchid Union",
        status: "Final instrument",
      },
      event: {
        displayName: "Energy market instrument",
        eventDate: "2020-06-01",
        eventFamily: "Energy regulation",
        geographies: ["Orchid Union"],
        populations: ["Energy suppliers"],
      },
    });
    const national = authority("national-energy", "National Energy Commission");
    const regional = authority("regional-energy", "Regional Energy Commission");

    expect(compareScreen02Proposals(national, regional)).toMatchObject({
      compatible: false,
      score: 0,
      reason:
        "The same local formal identifier is reused by different issuing bodies.",
    });
    expect(deduplicateScreen02Proposals([regional, national]).proposals)
      .toHaveLength(2);
  });

  it("recognizes a compact CELEX identity when one official lane omits the issuer", () => {
    const reviewed = findProposal("celex-reviewed", {
      title: "Digital content directive",
      nativeIdentity: {
        formalIdentifier: "32019L0770",
        issuer: "European Parliament and Council",
        issuingJurisdiction: "European Union",
        status: "Final directive",
      },
    });
    const repository = findProposal("celex-repository", {
      ...structuredClone(reviewed),
      id: "celex-repository",
      nativeIdentity: {
        ...structuredClone(reviewed.nativeIdentity!),
        issuer: null,
        issuingJurisdiction: "EU",
      },
    });

    expect(compareScreen02Proposals(reviewed, repository)).toMatchObject({
      compatible: true,
      score: 1,
    });
  });

  it("canonicalizes CELEX labels and exact issuer acronyms without weakening issuer guards", () => {
    const celex = (
      id: string,
      formalIdentifier: string,
      issuer: string | null,
      title = "Digital content directive",
    ) => findProposal(id, {
      title,
      nativeIdentity: {
        formalIdentifier,
        issuer,
        issuingJurisdiction: "European Union",
        status: "Final directive",
      },
    });
    const lowerBare = celex(
      "celex-lower-bare",
      "32019l0770",
      null,
      "Directive relative aux contenus numériques",
    );
    const labeled = celex(
      "celex-labeled",
      "CELEX: 32019L0770",
      null,
    );
    const commission = celex(
      "celex-commission",
      "32019R1234",
      "European Commission",
    );
    const commissionAcronym = celex(
      "celex-commission-acronym",
      "CELEX 32019R1234",
      "EC",
    );
    const legislature = celex(
      "celex-legislature",
      "32019L0888",
      "European Parliament and Council",
    );
    const legislatureAcronym = celex(
      "celex-legislature-acronym",
      "32019l0888",
      "EP and Council",
    );

    for (const [left, right] of [
      [lowerBare, labeled],
      [commission, commissionAcronym],
      [legislature, legislatureAcronym],
    ] as const) {
      expect(compareScreen02Proposals(left, right)).toMatchObject({
        compatible: true,
        score: 1,
      });
      expect(deduplicateScreen02Proposals([right, left]).proposals)
        .toHaveLength(1);
    }

    for (const [shortWord, expandedBody] of [
      ["Care", "Consumer Affairs Regulatory Entity"],
      ["care", "Consumer Affairs Regulatory Entity"],
      ["Eco", "Environmental Compliance Office"],
      ["eco", "Environmental Compliance Office"],
    ] as const) {
      expect(compareScreen02Proposals(
        celex(`ordinary-${shortWord}`, "32019R9999", shortWord),
        celex(`expanded-${shortWord}`, "32019R9999", expandedBody),
      )).toMatchObject({ compatible: false, score: 0 });
    }
  });

  it("normalizes bill, order, department, and formal-country aliases conservatively", () => {
    const instrument = (
      id: string,
      formalIdentifier: string,
      issuer: string,
      issuingJurisdiction: string,
    ) => findProposal(id, {
      nativeIdentity: {
        formalIdentifier,
        issuer,
        issuingJurisdiction,
        status: "Final instrument",
      },
    });
    const pairs = [
      [
        instrument("order-no", "Order No. 2019/12", "Commerce Department", "Example Republic"),
        instrument("order-short", "Order 2019/12", "Commerce Department", "Example Republic"),
      ],
      [
        instrument("bill-short", "SB327", "California Legislature", "California"),
        instrument("bill-long", "Senate Bill No. 327", "California State Legislature", "State of California"),
      ],
      [
        instrument("department-long", "Order 12", "Department of Commerce", "United States"),
        instrument("department-short", "Order 12", "U.S. Dept. of Commerce", "US"),
      ],
      [
        instrument("epa-lower", "Order 15", "epa", "United States"),
        instrument("epa-expanded", "Order 15", "Environmental Protection Agency", "US"),
      ],
      [
        instrument("germany-short", "Order 12", "Federal Ministry of Finance", "Germany"),
        instrument("germany-formal", "Order 12", "Federal Ministry of Finance", "Federal Republic of Germany"),
      ],
      [
        instrument("california-usa", "Order 13", "California Legislature", "California, USA"),
        instrument("california-united-states", "Order 13", "California Legislature", "California, United States"),
      ],
      [
        instrument("china-prc", "Order 14", "Ministry of Commerce", "PRC"),
        instrument("china-formal", "Order 14", "Ministry of Commerce", "People's Republic of China"),
      ],
    ] as const;

    for (const [left, right] of pairs) {
      expect(compareScreen02Proposals(left, right)).toMatchObject({
        compatible: true,
        score: 1,
      });
    }
    expect(compareScreen02Proposals(
      instrument("federal-ministry", "Order 77", "Federal Ministry of Finance", "Germany"),
      instrument("plain-ministry", "Order 77", "Ministry of Finance", "Federal Republic of Germany"),
    )).toMatchObject({ compatible: false, score: 0 });
    expect(compareScreen02Proposals(
      instrument("epa-guard", "Order 16", "epa", "United States"),
      instrument("policy-association", "Order 16", "Environmental Policy Association", "US"),
    )).toMatchObject({ compatible: false, score: 0 });
  });

  it("keeps differently identified proposal and final records separate even when their titles overlap", () => {
    const proposal = findProposal("orchid-proposed-record", {
      title: "Orchid Platform Duties Instrument",
      nativeIdentity: {
        formalIdentifier: "OU 2019/101",
        issuer: "Orchid Council",
        issuingJurisdiction: "Orchid Union",
        status: "Proposed instrument",
      },
      event: {
        displayName: "Orchid Platform Duties Instrument",
        eventDate: "2019-02-01",
        eventFamily: "Regulation",
        geographies: ["Orchid Union"],
        populations: ["Covered platform operators"],
      },
      provisionalDates: ["Publication date: 2019-02-01"],
    });
    const final = findProposal("orchid-final-record", {
      ...structuredClone(proposal),
      id: "orchid-final-record",
      nativeIdentity: {
        ...structuredClone(proposal.nativeIdentity!),
        formalIdentifier: "OU 2020/202",
        status: "Final instrument",
      },
      event: {
        ...structuredClone(proposal.event),
        eventDate: "2020-06-01",
      },
      provisionalDates: ["Publication date: 2020-06-01"],
    });

    expect(compareScreen02Proposals(proposal, final)).toMatchObject({
      compatible: false,
      score: 0,
      reason:
        "Different formal document identifiers remain separate even when titles overlap.",
    });
    expect(deduplicateScreen02Proposals([final, proposal]).proposals)
      .toHaveLength(2);
  });

  it("keeps differently numbered Federal Register PRORULE and RULE records separate", () => {
    const proposed = findProposal("orchid-nprm", {
      title: "Orchid Platform Duties Rule",
      nativeIdentity: {
        formalIdentifier: "FR Doc. 2020-10101",
        issuer: "Example Federal Agency",
        issuingJurisdiction: "United States",
        status: "Proposed rule",
      },
      event: {
        displayName: "Orchid Platform Duties Rule",
        eventDate: "2020-04-01",
        eventFamily: "Regulation",
        geographies: ["United States"],
        populations: ["Covered platform operators"],
      },
      provisionalDates: ["Publication date: 2020-04-01"],
    });
    const final = findProposal("orchid-final-rule", {
      ...structuredClone(proposed),
      id: "orchid-final-rule",
      nativeIdentity: {
        ...structuredClone(proposed.nativeIdentity!),
        formalIdentifier: "FR Doc. 2021-20202",
        status: "Rule",
      },
      event: {
        ...structuredClone(proposed.event),
        eventDate: "2021-02-01",
      },
      provisionalDates: ["Publication date: 2021-02-01"],
    });

    expect(compareScreen02Proposals(proposed, final)).toMatchObject({
      compatible: false,
      score: 0,
      reason:
        "Different formal document identifiers remain separate even when titles overlap.",
    });
    expect(deduplicateScreen02Proposals([final, proposed]).proposals)
      .toHaveLength(2);
  });

  it("separates same-stage formal documents and blocks an identifierless bridge", () => {
    const document = (
      id: string,
      formalIdentifier: string | null,
      status: string,
      eventDate = "2020-06-01",
    ) => findProposal(id, {
      title: "Orchid Market Coverage Order",
      nativeIdentity: {
        formalIdentifier,
        issuer: "Orchid Commerce Authority",
        issuingJurisdiction: "Orchid Union",
        status,
      },
      event: {
        displayName: "Orchid Market Coverage Order",
        eventDate,
        eventFamily: "Regulation",
        geographies: ["Orchid Union"],
        populations: ["Covered market operators"],
      },
      provisionalDates: ["Publication date: 2020-06-01"],
    });
    const firstFinal = document("orchid-order-12", "Order 12", "Final order");
    const secondFinal = document("orchid-order-99", "Order 99", "Final order");
    const bridge = document("orchid-order-bridge", null, "Final order");
    const unknownFirst = document(
      "orchid-official-12",
      "Order 12",
      "Official record",
      "2020-06-01",
    );
    const unknownSecond = document(
      "orchid-official-99",
      "Order 99",
      "Official record",
      "2021-06-01",
    );
    const amendment = document(
      "orchid-amendment-100",
      "Order 100",
      "Final amendment",
    );
    const corrigendum = document(
      "orchid-order-12-corrigendum",
      "Order 12 Corrigendum",
      "Final order",
    );
    const correction = document(
      "orchid-order-12-correction",
      "Order 12 Correction",
      "Final order",
    );

    expect(compareScreen02Proposals(firstFinal, secondFinal)).toMatchObject({
      compatible: false,
      score: 0,
    });
    expect(compareScreen02Proposals(unknownFirst, unknownSecond)).toMatchObject({
      compatible: false,
      score: 0,
    });
    expect(deduplicateScreen02Proposals([
      secondFinal,
      bridge,
      firstFinal,
    ]).proposals).toHaveLength(2);
    expect(compareScreen02Proposals(firstFinal, amendment).score)
      .toBeGreaterThanOrEqual(SCREEN02_PROPOSAL_CLUSTER_THRESHOLD);
    expect(deduplicateScreen02Proposals([amendment, firstFinal]).proposals)
      .toHaveLength(1);
    expect(compareScreen02Proposals(firstFinal, corrigendum).score)
      .toBeGreaterThanOrEqual(SCREEN02_PROPOSAL_CLUSTER_THRESHOLD);
    expect(compareScreen02Proposals(corrigendum, correction).score)
      .toBeGreaterThanOrEqual(SCREEN02_PROPOSAL_CLUSTER_THRESHOLD);
    expect(deduplicateScreen02Proposals([
      correction,
      firstFinal,
      corrigendum,
    ]).proposals).toHaveLength(1);
  });

  it("retains proposal and final records when source-backed operative dates changed", () => {
    const proposed = findProposal("orchid-proposed-effective", {
      title: "Orchid Platform Duties Rule",
      nativeIdentity: {
        formalIdentifier: "OU 2020/101",
        issuer: "Orchid Council",
        issuingJurisdiction: "Orchid Union",
        status: "Proposed rule",
      },
      provisionalDates: ["Proposed effective date: 2021-01-01"],
    });
    const final = findProposal("orchid-final-effective", {
      ...structuredClone(proposed),
      id: "orchid-final-effective",
      nativeIdentity: {
        ...structuredClone(proposed.nativeIdentity!),
        formalIdentifier: "OU 2021/202",
        status: "Final rule",
      },
      provisionalDates: ["Final effective date: 2021-03-01"],
    });

    expect(compareScreen02Proposals(proposed, final)).toMatchObject({
      compatible: false,
      score: 0,
      reason:
        "Source-backed treatment timing or assignment facts establish distinct versions.",
    });
  });

  it("canonicalizes timing synonyms, preserves complementary clocks, and detects changed schedules", () => {
    const timed = (id: string, provisionalDates: string[]) =>
      findProposal(id, {
        title: "Orchid Emergency Coverage Order",
        nativeIdentity: {
          formalIdentifier: "OU 2020/303",
          issuer: "Orchid Emergency Authority",
          issuingJurisdiction: "Orchid Union",
          status: "Final order",
        },
        provisionalDates,
      });

    expect(compareScreen02Proposals(
      timed("effective-clock", ["Effective date: 2021-01-01"]),
      timed("commencement-clock", ["Commencement: 2021-01-01"]),
    )).toMatchObject({ compatible: true, score: 1 });
    expect(compareScreen02Proposals(
      timed("comes-into-force-clock", ["Comes into force: 2021-01-01"]),
      timed("takes-effect-clock", ["Takes effect: 2021-01-01"]),
    )).toMatchObject({ compatible: true, score: 1 });
    expect(compareScreen02Proposals(
      timed("entered-into-force-clock", ["Entered into force: 2021-01-01"]),
      timed("took-effect-clock", ["Took effect: 2021-02-01"]),
    )).toMatchObject({ compatible: false, score: 0 });
    expect(compareScreen02Proposals(
      timed("incident-clock", ["Incident began: 2021-01-01"]),
      timed("declaration-clock", ["Declaration date: 2021-01-03"]),
    )).toMatchObject({ compatible: true, score: 1 });
    expect(compareScreen02Proposals(
      timed("multi-clock-first", [
        "Effective date: 2021-01-01; Compliance date: 2021-07-01",
      ]),
      timed("multi-clock-second", [
        "Commencement: 2021-01-01; Compliance date: 2021-10-01",
      ]),
    )).toMatchObject({ compatible: false, score: 0 });
  });

  it("binds each documentary and treatment date to its local label", () => {
    const timed = (id: string, provisionalDates: string[]) => findProposal(id, {
      title: "Orchid Locally Timed Instrument",
      nativeIdentity: {
        formalIdentifier: "OU 2021/404",
        issuer: "Orchid Council",
        issuingJurisdiction: "Orchid Union",
        status: "Final instrument",
      },
      provisionalDates,
    });

    expect(compareScreen02Proposals(
      timed("published-first", [
        "Published 2020-01-01, effective 2021-01-01",
      ]),
      timed("published-second", [
        "Published 2020-02-01, effective 2021-01-01",
      ]),
    )).toMatchObject({ compatible: true, score: 1 });
    expect(compareScreen02Proposals(
      timed("two-clock-first", [
        "Effective 2021-01-01; compliance 2022-01-01",
      ]),
      timed("two-clock-changed", [
        "Effective 2022-01-01 and compliance 2023-01-01",
      ]),
    )).toMatchObject({ compatible: false, score: 0 });
    expect(compareScreen02Proposals(
      timed("two-clock-order-first", [
        "Effective 2021-01-01, compliance 2022-01-01",
      ]),
      timed("two-clock-order-second", [
        "Compliance 2022-01-01 and effective 2021-01-01",
      ]),
    )).toMatchObject({ compatible: true, score: 1 });
  });

  it.each([
    ["Enforcement start", "2021-01-01", "2021-02-01"],
    ["Covered-entity deadline", "2021-03-01", "2021-04-01"],
    ["Sunset", "2022-01-01", "2023-01-01"],
    ["Incident began", "2020-08-10", "2020-08-11"],
    ["Declaration date", "2020-08-12", "2020-08-13"],
    ["Incident ended", "2020-08-14", "2020-08-15"],
    ["Entry into force", "2021-05-01", "2021-06-01"],
  ])("retains versions with changed %s clocks", (label, firstDate, secondDate) => {
    const timed = (id: string, date: string) => findProposal(id, {
      title: "Orchid Timed Coverage Event",
      nativeIdentity: {
        formalIdentifier: "OU 2020/808",
        issuer: "Orchid Authority",
        issuingJurisdiction: "Orchid Union",
        status: "Final event",
      },
      provisionalDates: [`${label}: ${date}`],
    });

    expect(compareScreen02Proposals(
      timed(`first-${label}`, firstDate),
      timed(`second-${label}`, secondDate),
    )).toMatchObject({ compatible: false, score: 0 });
  });

  it("consolidates richer and sparse overlapping assignment evidence", () => {
    const sparse = findProposal("orchid-sparse-assignment", {
      title: "Orchid Platform Duties Instrument",
      affectedPopulation: "Covered platform operators",
      nativeIdentity: {
        formalIdentifier: "OU 2020/101",
        issuer: "Orchid Council",
        issuingJurisdiction: "Orchid Union",
        status: "Final instrument",
      },
      provisionalDates: ["Effective date: 2021-01-01"],
      event: {
        displayName: "Orchid Platform Duties Instrument",
        eventDate: "2020-06-01",
        eventFamily: "Regulation",
        geographies: ["Orchid Union"],
        populations: ["Covered platform operators"],
      },
    });
    const richer = findProposal("orchid-richer-assignment", {
      ...structuredClone(sparse),
      id: "orchid-richer-assignment",
      nativeIdentity: {
        ...structuredClone(sparse.nativeIdentity!),
        formalIdentifier: "OU 2020/101",
      },
      affectedPopulation: "Large covered platform operators",
      provisionalDates: [
        "Effective date: 2021-01-01",
        "Treatment phase begins: 2022-01-01",
      ],
      event: {
        ...structuredClone(sparse.event),
        populations: ["Large covered platform operators"],
      },
    });

    expect(compareScreen02Proposals(sparse, richer).score)
      .toBeGreaterThanOrEqual(SCREEN02_PROPOSAL_CLUSTER_THRESHOLD);
    expect(deduplicateScreen02Proposals([richer, sparse]).proposals)
      .toHaveLength(1);
  });

  it("treats complementary timing, synonymous population prose, and descriptor numbers as non-conflicting", () => {
    const first = findProposal("orchid-complementary-effective", {
      title: "Orchid Financial Coverage Instrument",
      affectedPopulation: "Covered financial institutions",
      nativeIdentity: {
        formalIdentifier: "OU 2020/505",
        issuer: "Orchid Council",
        issuingJurisdiction: "Orchid Union",
        status: "Final instrument",
      },
      provisionalDates: ["Effective date: 2021-01-01"],
      event: {
        displayName: "Orchid Financial Coverage Instrument",
        eventDate: "2020-06-01",
        eventFamily: "Regulation",
        geographies: ["Orchid Union"],
        populations: ["Covered Fortune 500 manufacturers"],
      },
    });
    const second = findProposal("orchid-complementary-compliance", {
      ...structuredClone(first),
      id: "orchid-complementary-compliance",
      affectedPopulation: "Regulated banks",
      provisionalDates: ["Compliance date: 2021-07-01"],
      event: {
        ...structuredClone(first.event),
        populations: ["NAICS 31 manufacturers"],
      },
    });

    expect(compareScreen02Proposals(first, second)).toMatchObject({
      compatible: true,
      score: 1,
    });
    expect(deduplicateScreen02Proposals([second, first]).proposals).toHaveLength(1);
  });

  it("retains opposite quantitative thresholds under the same formal identity", () => {
    const threshold = (
      id: string,
      population: string,
    ) => findProposal(id, {
      title: "Orchid Revenue Coverage Order",
      affectedPopulation: population,
      nativeIdentity: {
        formalIdentifier: "OU 2020/606",
        issuer: "Orchid Council",
        issuingJurisdiction: "Orchid Union",
        status: "Final order",
      },
      event: {
        displayName: "Orchid Revenue Coverage Order",
        eventDate: "2020-06-01",
        eventFamily: "Regulation",
        geographies: ["Orchid Union"],
        populations: [population],
      },
    });
    const above = threshold(
      "orchid-above-threshold",
      "Covered firms above $10 million annual revenue",
    );
    const below = threshold(
      "orchid-below-threshold",
      "Covered firms below $10 million annual revenue",
    );

    expect(compareScreen02Proposals(above, below)).toMatchObject({
      compatible: false,
      score: 0,
      reason:
        "Source-backed treatment timing or assignment facts establish distinct versions.",
    });
    expect(deduplicateScreen02Proposals([above, below]).proposals).toHaveLength(2);
  });

  it("preserves currency and unit semantics while canonicalizing equivalent quantities", () => {
    const threshold = (id: string, population: string) => findProposal(id, {
      title: "Orchid Financial Coverage Order",
      affectedPopulation: population,
      nativeIdentity: {
        formalIdentifier: "OU 2020/707",
        issuer: "Orchid Council",
        issuingJurisdiction: "Orchid Union",
        status: "Final order",
      },
      event: {
        displayName: "Orchid Financial Coverage Order",
        eventDate: "2020-06-01",
        eventFamily: "Financial regulation",
        geographies: ["Orchid Union"],
        populations: [population],
      },
    });

    expect(compareScreen02Proposals(
      threshold("usd-threshold", "Covered firms above $10 million annual revenue"),
      threshold("eur-threshold", "Covered firms above €10 million annual revenue"),
    )).toMatchObject({ compatible: false, score: 0 });
    expect(compareScreen02Proposals(
      threshold("unspecified-currency", "Covered firms above 10 million annual revenue"),
      threshold("specified-currency", "Covered firms above USD 10 million annual revenue"),
    )).toMatchObject({ compatible: true, score: 1 });
    expect(compareScreen02Proposals(
      threshold("unspecified-measure", "Covered firms above a 10 million threshold"),
      threshold("specific-measure", "Covered firms above 20 million annual revenue"),
    )).toMatchObject({ compatible: true, score: 1 });
    expect(compareScreen02Proposals(
      threshold("percent-symbol", "Covered firms with at least 50% workforce participation"),
      threshold("percent-word", "Covered firms with not less than 50 percent workforce participation"),
    )).toMatchObject({ compatible: true, score: 1 });
    expect(compareScreen02Proposals(
      threshold("comma-count", "Covered firms with a threshold exactly 10,000 employees"),
      threshold("plain-count", "Covered firms with a threshold exactly 10000 employees"),
    )).toMatchObject({ compatible: true, score: 1 });
    expect(compareScreen02Proposals(
      threshold("percent-unit", "Covered firms with a 10% revenue threshold"),
      threshold("million-unit", "Covered firms with a 10 million revenue threshold"),
    )).toMatchObject({ compatible: false, score: 0 });
  });

  it("retains partially changed multi-threshold and subgroup-status assignments", () => {
    const assignment = (id: string, population: string) => findProposal(id, {
      title: "Orchid Multi-part Coverage Order",
      affectedPopulation: population,
      nativeIdentity: {
        formalIdentifier: "OU 2020/909",
        issuer: "Orchid Council",
        issuingJurisdiction: "Orchid Union",
        status: "Final order",
      },
      event: {
        displayName: "Orchid Multi-part Coverage Order",
        eventDate: "2020-06-01",
        eventFamily: "Financial regulation",
        geographies: ["Orchid Union"],
        populations: [population],
      },
    });
    const firstThresholds = assignment(
      "threshold-set-first",
      "Covered firms with annual revenue at least $10 million; no more than 50 employees",
    );
    const secondThresholds = assignment(
      "threshold-set-second",
      "Covered firms with annual revenue at least $10 million; no more than 100 employees",
    );
    const firstStatuses = assignment(
      "status-set-first",
      "Banks included; insurers excluded",
    );
    const secondStatuses = assignment(
      "status-set-second",
      "Banks excluded; insurers included",
    );
    const complementaryStatuses = assignment(
      "status-complementary",
      "Insurers excluded",
    );
    const firstInlineStatuses = assignment(
      "status-inline-first",
      "Banks included and insurers excluded",
    );
    const secondInlineStatuses = assignment(
      "status-inline-second",
      "Banks excluded and insurers included",
    );
    const firstCoverage = assignment(
      "coverage-set-first",
      "Covered public hospitals and banks",
    );
    const secondCoverage = assignment(
      "coverage-set-second",
      "Covered public hospitals and insurers",
    );

    expect(compareScreen02Proposals(firstThresholds, secondThresholds))
      .toMatchObject({ compatible: false, score: 0 });
    expect(compareScreen02Proposals(firstStatuses, secondStatuses))
      .toMatchObject({ compatible: false, score: 0 });
    expect(compareScreen02Proposals(
      assignment("status-included-only", "Banks included"),
      complementaryStatuses,
    )).toMatchObject({ compatible: true, score: 1 });
    expect(compareScreen02Proposals(firstInlineStatuses, secondInlineStatuses))
      .toMatchObject({ compatible: false, score: 0 });
    expect(compareScreen02Proposals(firstCoverage, secondCoverage))
      .toMatchObject({ compatible: false, score: 0 });
  });

  it("binds quantitative facts to their local metric and preserves boundary semantics", () => {
    const assignment = (id: string, population: string) => findProposal(id, {
      title: "Orchid Quantitative Coverage Order",
      affectedPopulation: population,
      nativeIdentity: {
        formalIdentifier: "OU 2020/919",
        issuer: "Orchid Council",
        issuingJurisdiction: "Orchid Union",
        status: "Final order",
      },
      event: {
        displayName: "Orchid Quantitative Coverage Order",
        eventDate: "2020-06-01",
        eventFamily: "Financial regulation",
        geographies: ["Orchid Union"],
        populations: [population],
      },
    });
    const compare = (left: string, right: string) => compareScreen02Proposals(
      assignment(`left-${left}`, left),
      assignment(`right-${right}`, right),
    );

    expect(compare(
      "Covered firms with total annual revenue above $10 million",
      "Covered firms with total employees above 50",
    )).toMatchObject({ compatible: true, score: 1 });
    expect(compare(
      "Covered firms with annual revenue above $10 million",
      "Covered firms with annual assets above $10 million",
    )).toMatchObject({ compatible: true, score: 1 });
    expect(compare(
      "Covered firms with annual revenue above $10 million",
      "Covered firms with annual revenue above $20 million",
    )).toMatchObject({ compatible: false, score: 0 });
    expect(compare(
      "Covered firms with more than 50 employees",
      "Covered firms with at least 50 employees",
    )).toMatchObject({ compatible: false, score: 0 });
    expect(compare(
      "Covered firms with fewer than 50 employees",
      "Covered firms with at most 50 employees",
    )).toMatchObject({ compatible: false, score: 0 });
    expect(compare(
      "Covered firms with no more than 50 employees",
      "Covered firms with not more than 50 employees",
    )).toMatchObject({ compatible: true, score: 1 });
    expect(compare(
      "Covered firms with at least 50 employees",
      "Covered firms with not fewer than 50 employees",
    )).toMatchObject({ compatible: true, score: 1 });
    expect(compare(
      "Covered firms with at least 50 employees",
      "Covered firms with no less than 50 employees",
    )).toMatchObject({ compatible: true, score: 1 });
    expect(compare(
      "Covered firms with greater than or equal to 50 employees",
      "Covered firms with at least 50 employees",
    )).toMatchObject({ compatible: true, score: 1 });
    expect(compare(
      "Covered firms with greater than 50 employees",
      "Covered firms with greater than or equal to 50 employees",
    )).toMatchObject({ compatible: false, score: 0 });
    expect(compare(
      "Covered firms with less than or equal to 50 employees",
      "Covered firms with at most 50 employees",
    )).toMatchObject({ compatible: true, score: 1 });
    expect(compare(
      "Covered firms with less than 50 employees",
      "Covered firms with less than or equal to 50 employees",
    )).toMatchObject({ compatible: false, score: 0 });
    expect(compare(
      "Covered firms with up to 50 employees",
      "Covered firms with more than 50 employees",
    )).toMatchObject({ compatible: false, score: 0 });
    expect(compare(
      "Covered firms with between 50 and 100 employees",
      "Covered firms with at least 50 employees; at most 100 employees",
    )).toMatchObject({ compatible: true, score: 1 });
    expect(compare(
      "Covered firms with between 50 and 100 employees",
      "Covered firms with between 50 and 200 employees",
    )).toMatchObject({ compatible: false, score: 0 });
    expect(compare(
      "Covered firms with 50 employees",
      "Covered firms with 100 employees",
    )).toMatchObject({ compatible: false, score: 0 });
    expect(compare(
      "Covered Fortune 500 manufacturers",
      "Covered Fortune 100 manufacturers",
    )).toMatchObject({ compatible: true, score: 1 });
    expect(compare(
      "Covered NAICS 31 manufacturers",
      "Covered NAICS 32 manufacturers",
    )).toMatchObject({ compatible: true, score: 1 });
    expect(compare(
      "Covered firms above CAD 10 million annual revenue",
      "Covered firms above USD 10 million annual revenue",
    )).toMatchObject({ compatible: false, score: 0 });
    expect(compare(
      "Covered firms above KES 10 million annual revenue",
      "Covered firms above USD 10 million annual revenue",
    )).toMatchObject({ compatible: false, score: 0 });
  });

  it("binds inclusion, negation, exceptions, and categorical contrasts to subjects", () => {
    const assignment = (id: string, population: string) => findProposal(id, {
      title: "Orchid Subject Coverage Order",
      affectedPopulation: population,
      nativeIdentity: {
        formalIdentifier: "OU 2020/929",
        issuer: "Orchid Council",
        issuingJurisdiction: "Orchid Union",
        status: "Final order",
      },
      event: {
        displayName: "Orchid Subject Coverage Order",
        eventDate: "2020-06-01",
        eventFamily: "Financial regulation",
        geographies: ["Orchid Union"],
        populations: [population],
      },
    });
    const compare = (left: string, right: string) => compareScreen02Proposals(
      assignment(`left-${left}`, left),
      assignment(`right-${right}`, right),
    );

    for (const [positive, negative] of [
      ["Banks included", "Banks not included"],
      ["Banks eligible", "Banks not eligible"],
      ["Banks are eligible", "None of the banks are eligible"],
      [
        "Banks and insurers are eligible",
        "Neither banks nor insurers are eligible",
      ],
      ["Banks subject to requirements", "Banks not subject to requirements"],
      ["The rule covers banks", "The rule does not cover banks"],
      ["The rule applies to banks", "The rule doesn't apply to banks"],
      ["Banks included", "Banks are outside the scope"],
      [
        "Banks included, insurers excluded",
        "Banks excluded, insurers included",
      ],
      [
        "Banks included but insurers excluded",
        "Banks excluded but insurers included",
      ],
      [
        "Banks and insurers included",
        "Banks and hospitals excluded",
      ],
      [
        "Banks included; insurers not specified",
        "Banks not included",
      ],
      [
        "Covered public hospitals and private banks",
        "Covered private hospitals and public banks",
      ],
      [
        "Covered public firms and private banks",
        "Covered private firms and public banks",
      ],
    ] as const) {
      expect(
        compare(positive, negative),
        `${positive} vs. ${negative}`,
      ).toMatchObject({
        compatible: false,
        score: 0,
      });
    }

    expect(compare("Banks included", "Insurers excluded"))
      .toMatchObject({ compatible: true, score: 1 });
    expect(compare("Covered public hospitals", "Covered private banks"))
      .toMatchObject({ compatible: true, score: 1 });
    expect(compare(
      "Covered public and private firms",
      "Covered public and private firms",
    )).toMatchObject({ compatible: true, score: 1 });
    expect(compare(
      "All institutions except insurers",
      "Institutions included; insurers excluded",
    )).toMatchObject({ compatible: true, score: 1 });
  });

  it("retains same-ID and identifierless records with distinct treatment assignments", () => {
    const phase = (
      id: string,
      date: string,
      population: string,
      formalIdentifier: string | null,
    ) => findProposal(id, {
      title: "Orchid Emergency Coverage Order",
      affectedPopulation: population,
      nativeIdentity: {
        formalIdentifier,
        issuer: "Orchid Emergency Authority",
        issuingJurisdiction: "Orchid Union",
        status: "Final order",
      },
      event: {
        displayName: "Orchid Emergency Coverage Order",
        eventDate: "2020-01-01",
        eventFamily: "Emergency order",
        geographies: ["Orchid Union"],
        populations: [population],
      },
      provisionalDates: [`Treatment phase begins: ${date}`],
    });
    const sameIdFirst = phase(
      "same-id-public-phase",
      "2020-04-01",
      "Covered public hospitals",
      "OU 2020/404",
    );
    const sameIdSecond = phase(
      "same-id-private-phase",
      "2021-04-01",
      "Covered private banks",
      "OU 2020/404",
    );
    const sparseBridge = {
      ...structuredClone(sameIdFirst),
      id: "same-id-sparse-bridge",
      affectedPopulation: "Covered organizations",
      nativeIdentity: {
        ...structuredClone(sameIdFirst.nativeIdentity!),
        formalIdentifier: null,
      },
      event: {
        ...structuredClone(sameIdFirst.event),
        populations: ["Covered organizations"],
      },
      provisionalDates: [],
    } satisfies Screen02FindProposal;
    const identifierlessFirst = phase(
      "idless-hospital-phase",
      "2020-04-01",
      "Covered hospitals",
      null,
    );
    const identifierlessSecond = phase(
      "idless-bank-phase",
      "2021-04-01",
      "Covered banks",
      null,
    );

    expect(compareScreen02Proposals(sameIdFirst, sameIdSecond)).toMatchObject({
      compatible: false,
      score: 0,
      reason:
        "Source-backed treatment timing or assignment facts establish distinct versions.",
    });
    expect(deduplicateScreen02Proposals([
      sameIdFirst,
      sparseBridge,
      sameIdSecond,
    ]).proposals).toHaveLength(2);
    expect(compareScreen02Proposals(
      identifierlessFirst,
      identifierlessSecond,
    )).toMatchObject({ compatible: false, score: 0 });
    expect(deduplicateScreen02Proposals([
      identifierlessSecond,
      identifierlessFirst,
    ]).proposals).toHaveLength(2);
  });

  it("keeps non-Federal proposal, final, and amendment treatment versions separate through an unidentified bridge", () => {
    const version = (
      id: string,
      formalIdentifier: string,
      eventDate: string,
      status: string,
    ) => findProposal(id, {
      title: "Orchid Platform Duties Instrument",
      nativeIdentity: {
        formalIdentifier,
        issuer: "Orchid Council",
        issuingJurisdiction: "Orchid Union",
        status,
      },
      event: {
        displayName: "Orchid Platform Duties Instrument",
        eventDate,
        eventFamily: "Regulation",
        geographies: ["Orchid Union"],
        populations: ["Covered platform operators"],
      },
      provisionalDates: [`Treatment phase begins: ${eventDate}`],
    });
    const proposed = version(
      "orchid-proposal",
      "OU 2019/101",
      "2019-02-01",
      "Proposed instrument",
    );
    const final = version(
      "orchid-final",
      "OU 2020/202",
      "2020-06-01",
      "Final instrument",
    );
    const amendment = version(
      "orchid-amendment",
      "OU 2022/303",
      "2022-09-01",
      "Final amendment",
    );
    const unidentified = {
      ...structuredClone(final),
      id: "orchid-unidentified-lane",
      nativeIdentity: {
        ...structuredClone(final.nativeIdentity!),
        formalIdentifier: null,
      },
    } satisfies Screen02FindProposal;

    for (const [left, right] of [
      [proposed, final],
      [final, amendment],
      [proposed, amendment],
    ] as const) {
      expect(compareScreen02Proposals(left, right)).toMatchObject({
        compatible: false,
        score: 0,
      });
    }
    const forward = deduplicateScreen02Proposals([
      proposed,
      unidentified,
      amendment,
      final,
    ]);
    const reversed = deduplicateScreen02Proposals([
      final,
      amendment,
      unidentified,
      proposed,
    ]);
    expect(forward.proposals).toHaveLength(3);
    expect(new Set([
      forward.membership[proposed.id],
      forward.membership[final.id],
      forward.membership[amendment.id],
    ]).size).toBe(3);
    expect(forward.clusters).toEqual(reversed.clusters);
    expect(forward.membership).toEqual(reversed.membership);
    expect(forward.comparisons).toEqual(reversed.comparisons);
  });

  it("keeps distinct known-shock representation families separate", () => {
    const formal = auditProposal("formal");
    const timing = auditProposal("timing", "phase-clock", {
      title: formal.title,
      candidateConstruct: formal.candidateConstruct,
      operationalization: formal.operationalization,
    });
    const clustered = clusterScreen02Proposals([timing, formal]);

    expect(clustered.clusters).toHaveLength(2);
    expect(clustered.comparisons).toHaveLength(1);
    expect(clustered.comparisons[0]).toMatchObject({
      compatible: false,
      score: 0,
    });
  });

  it("scores explicit preferences separately and exposes every criterion", () => {
    const proposal = findProposal("preference-fit", {
      description:
        "A federal policy with public firm-level eligibility and no proprietary database.",
      requiredVariables: [
        "Public firm eligibility",
        "Annual accounting data",
      ],
    });
    const scored = scoreScreen02PreferenceRelevance(
      proposal,
      context(),
      {
        require: ["public firm eligibility"],
        prefer: ["federal policy"],
        avoid: ["plant-level geocoded data"],
      },
    );
    const missingRequirement = scoreScreen02PreferenceRelevance(
      proposal,
      context(),
      {
        require: ["confidential supplier contracts"],
      },
    );
    const noPreferences = scoreScreen02PreferenceRelevance(
      proposal,
      context(),
    );

    expect(scored.requiredSatisfied).toBe(true);
    expect(scored.score).toBeGreaterThan(80);
    expect(scored.criteria).toHaveLength(3);
    expect(
      scored.criteria.find(
        (criterion) => criterion.kind === "avoid",
      ),
    ).toMatchObject({
      matched: false,
      matchedTokens: ["data", "level"],
    });
    expect(missingRequirement.requiredSatisfied).toBe(false);
    expect(missingRequirement.score).toBeLessThanOrEqual(49);
    expect(noPreferences).toMatchObject({
      score: null,
      requiredSatisfied: true,
      criteria: [],
    });
  });

  it("generates semantic stable IDs independently of source and caller ID", () => {
    const first = findProposal("caller-a", {
      sources: [source("one", 1)],
    });
    const second = findProposal("caller-b", {
      sources: [source("two", 5)],
      description: "A differently worded evidence summary.",
    });

    expect(stableScreen02ProposalId(first)).toBe(
      stableScreen02ProposalId(second),
    );
  });
});
