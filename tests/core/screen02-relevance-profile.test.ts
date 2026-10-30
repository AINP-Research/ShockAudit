import { describe, expect, it } from "vitest";

import {
  buildScreen02NativeQueryPlan,
  screen02StudyProfileIndustryTerms,
} from "../../src/core/screen02-discovery";
import {
  SCREEN02_DISCOVERY_MAX_QUERY_VARIANTS,
  SCREEN02_DISCOVERY_MAX_ROUNDS,
  SCREEN02_DISCOVERY_MIN_QUERY_VARIANTS,
  SCREEN02_DISCOVERY_QUALIFIED_TARGET,
  SCREEN02_DISCOVERY_RAW_MAX,
  SCREEN02_DISCOVERY_RAW_TARGET,
  SCREEN02_INDUSTRY_VOCABULARY_METADATA,
  SCREEN02_STUDY_RELEVANCE_PROFILE_SCHEMA_VERSION,
  SCREEN02_POOL_HOST_REVIEW_CAPABILITY,
  SCREEN02_POOL_HOST_REVIEW_SCHEMA_VERSION,
  applyScreen02PoolHostReview,
  buildScreen02IndustryRelevanceProfile,
  buildScreen02StudyRelevanceProfile,
  cachedScreen02StudyRelevanceProfileHostEnrichment,
  isScreen02StudyRelevanceProfile,
  mergeScreen02StudyRelevanceProfileHostAdditions,
  mergeScreen02StudyRelevanceProfileResearcherEdits,
  requireReadyScreen02StudyRelevanceProfile,
  screen02IndustryRecoveryQuery,
  validateScreen02PoolHostReviewSubmission,
} from "../../src/core/screen02-relevance-profile";

describe("Screen 2 study relevance profile", () => {
  it("separates broad retrieval vocabulary from qualifying industry terms", () => {
    const energy = screen02StudyProfileIndustryTerms("Energy");
    const technology = screen02StudyProfileIndustryTerms("Technology");
    const videoGaming = screen02StudyProfileIndustryTerms("Video gaming");

    expect(energy.queryTerms).toContain("energy");
    expect(energy.directTerms).not.toContain("energy");
    expect(energy.directTerms).not.toContain("energy sector");
    expect(energy.directTerms).toEqual(expect.arrayContaining([
      "electric storage",
      "electric storage resource",
    ]));
    expect(videoGaming.directTerms).not.toContain("video");
    expect(videoGaming.directTerms).not.toContain("gaming");
    expect(videoGaming.directTerms).toContain("video game");
    expect(technology.directTerms).toEqual(["technology"]);
    expect(technology.adjacentTerms).toEqual([
      "connected device",
      "data protection",
      "personal data",
      "personal information",
    ]);
    expect(technology.directTerms).not.toEqual(
      expect.arrayContaining(technology.adjacentTerms),
    );
    expect(screen02IndustryRecoveryQuery("Video gaming")).toBe("video game");
    expect(screen02IndustryRecoveryQuery("Energy")).toBe("energy");
  });

  it("publishes the measured discovery budgets and vocabulary provenance", () => {
    expect({
      rawTarget: SCREEN02_DISCOVERY_RAW_TARGET,
      rawMax: SCREEN02_DISCOVERY_RAW_MAX,
      qualifiedTarget: SCREEN02_DISCOVERY_QUALIFIED_TARGET,
      rounds: SCREEN02_DISCOVERY_MAX_ROUNDS,
      queryMin: SCREEN02_DISCOVERY_MIN_QUERY_VARIANTS,
      queryMax: SCREEN02_DISCOVERY_MAX_QUERY_VARIANTS,
    }).toEqual({
      rawTarget: 40,
      rawMax: 60,
      qualifiedTarget: 10,
      rounds: 2,
      queryMin: 12,
      queryMax: 16,
    });
    expect(SCREEN02_INDUSTRY_VOCABULARY_METADATA).toMatchObject({
      source: expect.stringMatching(/project-authored/i),
      version: expect.any(String),
      license: "CC0-1.0",
    });
  });

  it("builds the complete deterministic profile while preserving original wording", () => {
    const profile = buildScreen02StudyRelevanceProfile({
      scopeFingerprint: "scope-semiconductor-01",
      originalIndustryText: "  Semiconductor fabrication & foundry services ",
      sampleGeography: "United States",
      studyPeriod: "2014–2022",
      eventFamily: "Regulation and policy change",
      requiredCriteria: ["Observable eligibility threshold"],
      preferredCriteria: ["Federal source"],
      avoidedCriteria: ["Outcome-only discussion"],
      at: "2026-09-03T12:00:00.000Z",
    });

    expect(profile).toMatchObject({
      schemaVersion: SCREEN02_STUDY_RELEVANCE_PROFILE_SCHEMA_VERSION,
      scopeFingerprint: "scope-semiconductor-01",
      originalIndustryText: "Semiconductor fabrication & foundry services",
      canonicalIndustryLabel: "semiconductor fabrication and foundry services",
      studyStartYear: 2014,
      studyEndYear: 2022,
      origin: "fixed-profile",
      createdAt: "2026-09-03T12:00:00.000Z",
      updatedAt: "2026-09-03T12:00:00.000Z",
    });
    expect(profile.industryAliases).toEqual(
      expect.arrayContaining(["semiconductor", "fabrication", "foundry"]),
    );
    expect(profile.geographyAliases).toEqual(
      expect.arrayContaining(["united states", "us", "usa"]),
    );
    expect(profile.eventFamilyTerms).toEqual(
      expect.arrayContaining(["regulation and policy change", "regulation", "policy", "change"]),
    );
    expect(isScreen02StudyRelevanceProfile(profile)).toBe(true);
    const queryPlan = buildScreen02NativeQueryPlan({
      industry: profile.originalIndustryText,
      studyProfile: profile,
    });
    expect(queryPlan.variants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ purpose: expect.stringMatching(/sample-geography/i) }),
        expect.objectContaining({ purpose: expect.stringMatching(/study years/i) }),
      ]),
    );
  });

  it("uses the same profile and 12–16-query algorithm for unfamiliar industries", () => {
    for (const industry of [
      "Semiconductor fabrication",
      "Commercial space launch services",
      "Aquaculture equipment production",
    ]) {
      const profile = buildScreen02IndustryRelevanceProfile(industry);
      const plan = buildScreen02NativeQueryPlan({ industry });
      expect(profile.status).toBe("ready");
      expect(profile.directTerms.length).toBeGreaterThan(0);
      expect(plan.status).toBe("ready");
      expect(plan.variants.length).toBeGreaterThanOrEqual(12);
      expect(plan.variants.length).toBeLessThanOrEqual(16);
    }
  });

  it("does not let generic stop terms establish a target industry", () => {
    for (const industry of [
      "Businesses and companies",
      "Digital online platforms",
      "Public data providers",
    ]) {
      expect(buildScreen02IndustryRelevanceProfile(industry)).toMatchObject({
        status: "needs-clarification",
        directTerms: [],
      });
      expect(buildScreen02NativeQueryPlan({ industry })).toMatchObject({
        status: "needs-clarification",
        variants: [],
      });
    }
    expect(buildScreen02IndustryRelevanceProfile("Gaming")).toMatchObject({
      status: "needs-clarification",
      canonicalIndustryCode: null,
      ambiguity: {
        code: "gaming-sector-meaning",
        question: expect.stringMatching(/kind of gaming/i),
      },
      interpretationAlternatives: [
        expect.objectContaining({ canonicalCode: "industry:video-gaming" }),
        expect.objectContaining({
          canonicalCode: "industry:gambling-and-wagering",
        }),
      ],
    });
    const persisted = buildScreen02StudyRelevanceProfile({
      scopeFingerprint: "scope-ambiguous-gaming",
      originalIndustryText: "Gaming",
      sampleGeography: "United States",
      studyPeriod: "2018–2024",
      eventFamily: "Regulation",
      at: "2026-09-03T12:00:00.000Z",
    });
    const restored = JSON.parse(JSON.stringify(persisted));
    expect(isScreen02StudyRelevanceProfile(restored)).toBe(true);
    expect(restored).toMatchObject({
      status: "needs-clarification",
      canonicalIndustryCode: null,
      ambiguity: { code: "gaming-sector-meaning" },
      interpretationAlternatives: [
        { canonicalCode: "industry:video-gaming" },
        { canonicalCode: "industry:gambling-and-wagering" },
      ],
    });
    expect(() => requireReadyScreen02StudyRelevanceProfile(restored))
      .toThrow(/kind of gaming/i);
  });

  it("prefers exact and longest industry phrases before a bare ambiguous term", () => {
    expect(buildScreen02IndustryRelevanceProfile(
      "Gaming console manufacturers",
    )).toMatchObject({
      status: "ready",
      canonicalIndustryCode: "industry:video-gaming",
      ambiguity: null,
      interpretationAlternatives: [],
    });
    for (const industry of ["Gaming and wagering", "Betting and gaming"]) {
      expect(buildScreen02IndustryRelevanceProfile(industry)).toMatchObject({
        status: "ready",
        canonicalIndustryCode: "industry:gambling-and-wagering",
        ambiguity: null,
        interpretationAlternatives: [],
      });
    }
  });

  it("merges bounded researcher corrections without rewriting immutable provenance", () => {
    const original = buildScreen02StudyRelevanceProfile({
      scopeFingerprint: "scope-edit-01",
      originalIndustryText: "Gaming",
      sampleGeography: "United States",
      studyPeriod: "2018 to 2024",
      eventFamily: "Regulation",
      at: "2026-09-03T12:00:00.000Z",
    });
    const edited = mergeScreen02StudyRelevanceProfileResearcherEdits(
      original,
      {
        canonicalIndustryLabel: "Video games",
        industryAliases: ["Video games", "Interactive entertainment"],
        falseFriends: ["Gambling", "Video relay service"],
      },
      "2026-09-03T12:05:00.000Z",
    );

    expect(edited).toMatchObject({
      origin: "researcher-edited",
      originalIndustryText: "Gaming",
      canonicalIndustryLabel: "Video games",
      canonicalIndustryCode: "industry:video-gaming",
      status: "ready",
      ambiguity: null,
      interpretationAlternatives: [],
      createdAt: original.createdAt,
      updatedAt: "2026-09-03T12:05:00.000Z",
    });
    expect(edited.industryAliases).toEqual([
      "video games",
      "interactive entertainment",
    ]);
    expect(() =>
      mergeScreen02StudyRelevanceProfileResearcherEdits(
        original,
        { industryAliases: Array.from({ length: 33 }, (_, index) => `term ${index}`) },
        "2026-09-03T12:05:00.000Z",
      )
    ).toThrow(/at most 32/i);

    const enriched = mergeScreen02StudyRelevanceProfileHostAdditions(
      edited,
      { services: ["Semiconductor foundry service"] },
      "2026-09-03T12:10:00.000Z",
      {
        promptVersion: "screen02-profile-test-v1",
        taskId: "profile-host-task-1",
        inputFingerprint: "fnv1a64:0000000000000001",
      },
    );
    expect(enriched).toMatchObject({
      origin: "chatgpt-host-enriched",
      originalIndustryText: "Gaming",
      updatedAt: "2026-09-03T12:10:00.000Z",
    });
    expect(enriched.services).toContain("semiconductor foundry service");
    expect(cachedScreen02StudyRelevanceProfileHostEnrichment(enriched, {
      scopeFingerprint: edited.scopeFingerprint,
      promptVersion: "screen02-profile-test-v1",
      inputFingerprint: "fnv1a64:0000000000000001",
    })).toMatchObject({
      status: "applied",
      additions: { services: ["semiconductor foundry service"] },
    });
    expect(cachedScreen02StudyRelevanceProfileHostEnrichment(enriched, {
      scopeFingerprint: edited.scopeFingerprint,
      promptVersion: "screen02-profile-test-v1",
      inputFingerprint: "fnv1a64:ffffffffffffffff",
    })).toBeNull();
    const changedScope = buildScreen02StudyRelevanceProfile({
      scopeFingerprint: "scope-edit-02",
      originalIndustryText: "Video gaming",
      sampleGeography: "European Union",
      studyPeriod: "2018 to 2024",
      eventFamily: "Regulation",
      hostEnrichmentCache: enriched.hostEnrichmentCache,
      at: "2026-09-03T12:12:00.000Z",
    });
    expect(changedScope.hostEnrichmentCache).toContainEqual(
      expect.objectContaining({
        status: "stale",
        staleReason: "scope-changed",
      }),
    );
    expect(changedScope.services).not.toContain(
      "semiconductor foundry service",
    );
    const correctedAfterHost = mergeScreen02StudyRelevanceProfileResearcherEdits(
      enriched,
      { falseFriends: ["Gambling"] },
      "2026-09-03T12:15:00.000Z",
    );
    expect(correctedAfterHost.services).not.toContain(
      "semiconductor foundry service",
    );
    expect(correctedAfterHost.hostEnrichmentCache).toContainEqual(
      expect.objectContaining({
        status: "stale",
        staleReason: "researcher-edited",
      }),
    );
    expect(cachedScreen02StudyRelevanceProfileHostEnrichment(
      correctedAfterHost,
      {
        scopeFingerprint: edited.scopeFingerprint,
        promptVersion: "screen02-profile-test-v1",
        inputFingerprint: "fnv1a64:0000000000000001",
      },
    )).toBeNull();
    expect(() =>
      mergeScreen02StudyRelevanceProfileHostAdditions(
        edited,
        { services: ["Digital platforms"] },
        "2026-09-03T12:10:00.000Z",
        {
          promptVersion: "screen02-profile-test-v1",
          taskId: "profile-host-task-2",
          inputFingerprint: "fnv1a64:0000000000000002",
        },
      )
    ).toThrow(/generic-only/i);
  });

  it("replaces same-key host additions without orphaning host-only terms", () => {
    const fixed = buildScreen02StudyRelevanceProfile({
      scopeFingerprint: "scope-host-replacement",
      originalIndustryText: "Video gaming",
      sampleGeography: "United States",
      studyPeriod: "2018 to 2024",
      eventFamily: "Regulation",
      at: "2026-09-03T12:00:00.000Z",
    });
    const researcher = mergeScreen02StudyRelevanceProfileResearcherEdits(
      fixed,
      {
        services: [
          ...fixed.services,
          "researcher preserved service",
        ],
      },
      "2026-09-03T12:01:00.000Z",
    );
    const first = mergeScreen02StudyRelevanceProfileHostAdditions(
      researcher,
      {
        services: ["host alpha service", "shared replacement service"],
      },
      "2026-09-03T12:02:00.000Z",
      {
        promptVersion: "screen02-profile-replacement-v1",
        taskId: "profile-host-replacement-1",
        inputFingerprint: "fnv1a64:0000000000000001",
      },
    );
    const replacement = mergeScreen02StudyRelevanceProfileHostAdditions(
      first,
      {
        services: [
          "shared replacement service",
          "host beta service",
          "researcher preserved service",
        ],
      },
      "2026-09-03T12:03:00.000Z",
      {
        promptVersion: "screen02-profile-replacement-v1",
        taskId: "profile-host-replacement-2",
        inputFingerprint: "fnv1a64:0000000000000002",
      },
    );

    expect(replacement.services).not.toContain("host alpha service");
    expect(replacement.services).toEqual(expect.arrayContaining([
      "shared replacement service",
      "host beta service",
      "researcher preserved service",
    ]));
    expect(replacement.hostEnrichmentCache).toHaveLength(1);
    expect(replacement.hostEnrichmentCache[0]).toMatchObject({
      taskId: "profile-host-replacement-2",
      inputFingerprint: "fnv1a64:0000000000000002",
      additions: {
        services: ["shared replacement service", "host beta service"],
      },
    });

    const edited = mergeScreen02StudyRelevanceProfileResearcherEdits(
      replacement,
      { contrastTerms: ["non-game service"] },
      "2026-09-03T12:04:00.000Z",
    );
    expect(edited.services).toContain("researcher preserved service");
    expect(edited.services).not.toContain("host alpha service");
    expect(edited.services).not.toContain("shared replacement service");
    expect(edited.services).not.toContain("host beta service");
    expect(edited.hostEnrichmentCache).toContainEqual(expect.objectContaining({
      taskId: "profile-host-replacement-2",
      status: "stale",
      staleReason: "researcher-edited",
    }));
  });

  it("strictly verifies one pool host review without creating eligibility", () => {
    const profile = buildScreen02StudyRelevanceProfile({
      scopeFingerprint: "scope-host-01",
      originalIndustryText: "Semiconductor fabrication",
      sampleGeography: "United States",
      studyPeriod: "2018–2024",
      eventFamily: "Regulation",
      at: "2026-09-03T12:00:00.000Z",
    });
    const context = {
      taskId: "task-host-01",
      profile,
      candidates: [
        {
          candidateId: "candidate-1",
          sources: [
            {
              sourceId: "source-1",
              active: true,
              text: "The rule applies to semiconductor fabrication facilities.",
            },
          ],
        },
      ],
    };
    const submission = {
      schemaVersion: SCREEN02_POOL_HOST_REVIEW_SCHEMA_VERSION,
      taskId: "task-host-01",
      capability: SCREEN02_POOL_HOST_REVIEW_CAPABILITY,
      profileAdditions: {},
      candidateReviews: [
        {
          candidateId: "candidate-1",
          proposedClass: "direct" as const,
          industryBridge: "The source names semiconductor fabrication facilities.",
          profileTermsUsed: ["semiconductor"],
          sourceIdsUsed: ["source-1"],
          sourceSpansUsed: [
            {
              sourceId: "source-1",
              text: "semiconductor fabrication facilities",
            },
          ],
          sampleConnection: "Public foundry firms can be tested for coverage.",
          outcomePathway: "Outcome relevance remains only a hypothesis.",
          mainMismatchOrUncertainty: "Covered-facility thresholds need verification.",
          needsFollowUpRetrieval: true,
          rankingAdjustment: 3,
        },
      ],
      followUpQueries: ["semiconductor fabrication covered facility threshold"],
      officialSourceLeads: [
        {
          url: "https://agency.example/rule",
          title: "Agency rule",
          issuingBody: "Example agency",
          jurisdiction: "Example jurisdiction",
          reasonForRetrieval: "Possible official text.",
          candidateIdIfKnown: "candidate-1",
        },
      ],
      conciseRationale: "One bridge was checked against one active source.",
      hostModel: "example-host-model",
    };

    const validated = validateScreen02PoolHostReviewSubmission(
      submission,
      context,
    );
    expect(validated.officialSourceLeads).toEqual([{
      url: "https://agency.example/rule",
      title: "Agency rule",
      issuingBody: "Example agency",
      jurisdiction: "Example jurisdiction",
      reasonForRetrieval: "Possible official text.",
      candidateIdIfKnown: "candidate-1",
    }]);
    expect(validated.candidateReviews[0]?.profileTermsUsed).toEqual([
      "semiconductor",
    ]);
    expect(
      applyScreen02PoolHostReview(validated, context, [
        {
          candidateId: "candidate-1",
          classification: "mismatch",
          eligible: false,
          baseScore: 40,
        },
      ])[0],
    ).toMatchObject({
      eligible: false,
      eligibilityUnchanged: true,
      proposedClass: "direct",
      rankingAdjustment: 0,
      totalScore: 40,
    });

    expect(() =>
      validateScreen02PoolHostReviewSubmission(
        {
          ...submission,
          candidateReviews: [
            { ...submission.candidateReviews[0], candidateId: "unknown" },
          ],
        },
        context,
      )
    ).toThrow(/unknown candidate/i);
    expect(() =>
      validateScreen02PoolHostReviewSubmission(
        {
          ...submission,
          candidateReviews: [
            {
              ...submission.candidateReviews[0],
              sourceSpansUsed: [
                { sourceId: "source-1", text: "invented source passage" },
              ],
            },
          ],
        },
        context,
      )
    ).toThrow(/not present/i);

    expect(() =>
      validateScreen02PoolHostReviewSubmission(
        {
          ...submission,
          officialSourceLeads: [{
            ...submission.officialSourceLeads[0],
            candidateIdIfKnown: "unknown-candidate",
          }],
        },
        context,
      )
    ).toThrow(/unknown official source lead candidate ID/i);

    expect(() =>
      validateScreen02PoolHostReviewSubmission(
        {
          ...submission,
          officialSourceLeads: [{
            ...submission.officialSourceLeads[0],
            issuingAuthority: "Unsupported duplicate metadata field",
          }],
        },
        context,
      )
    ).toThrow(/officialSourceLeads\[0\] is invalid/i);

    for (const url of [
      "https://reader:secret@agency.example/rule",
      "https://agency.example:8443/rule",
    ]) {
      expect(() =>
        validateScreen02PoolHostReviewSubmission(
          {
            ...submission,
            officialSourceLeads: [{
              ...submission.officialSourceLeads[0],
              url,
            }],
          },
          context,
        )
      ).toThrow(/credential-free HTTPS on the standard port/i);
    }
  });
});
