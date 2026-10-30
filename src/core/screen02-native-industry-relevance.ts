import type { Screen02Proposal } from "./screen02-types";
import {
  SCREEN02_DISCOVERY_MAX_QUERY_VARIANTS,
  SCREEN02_DISCOVERY_MIN_QUERY_VARIANTS,
  buildScreen02IndustryRelevanceProfile,
  isScreen02StudyRelevanceProfile,
  type Screen02StudyRelevanceProfile,
} from "./screen02-relevance-profile";

const SCREEN02_NATIVE_QUERY_PLAN_VERSION =
  "screen-02-native-query-plan-v1" as const;
const SCREEN02_NATIVE_QUERY_MIN_VARIANTS =
  SCREEN02_DISCOVERY_MIN_QUERY_VARIANTS;
const SCREEN02_NATIVE_QUERY_MAX_VARIANTS =
  SCREEN02_DISCOVERY_MAX_QUERY_VARIANTS;

type Screen02NativeQueryVariant = {
  id: string;
  query: string;
  purpose: string;
  strategy:
    | "known-shock"
    | "industry-exact"
    | "industry-alias"
    | "strict-criterion"
    | "chatgpt-query-expansion";
};

export type Screen02NativeIndustryRelevance = {
  version: typeof SCREEN02_NATIVE_QUERY_PLAN_VERSION;
  status: "clear-fit" | "possible-fit" | "mismatch";
  score: number;
  matchedPositiveTerms: string[];
  matchedContrastTerms: string[];
  reason: string;
};

function compareText(left: string, right: string) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function uniqueSorted(values: readonly string[]) {
  return [...new Set(values)].sort(compareText);
}

function canonicalCriteria(values: readonly string[] | undefined) {
  const byNormalized = new Map<string, string>();
  for (const value of values ?? []) {
    const trimmed = value.trim();
    const normalized = normalizeScreen02DiscoveryText(trimmed);
    if (!normalized) continue;
    const existing = byNormalized.get(normalized);
    if (!existing || compareText(trimmed, existing) < 0) {
      byNormalized.set(normalized, trimmed);
    }
  }
  return [...byNormalized.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([, original]) => original);
}

function normalizeScreen02DiscoveryText(input: string) {
  return input
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/(?<=\p{L})\.(?=\p{L})/gu, "")
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const NON_DISTINCTIVE_PROFILE_TERMS = new Set([
  "all", "any", "business", "businesses", "company", "companies",
  "consumer", "consumers", "controller", "controllers", "customer", "customers",
  "data", "digital", "enterprise", "enterprises", "firm", "firms",
  "industry", "industries", "information", "law", "laws", "listed", "online",
  "organization", "organizations", "platform", "platforms", "policy", "policies",
  "private", "provider", "providers", "public", "regulation", "regulations",
  "sector", "sectors", "the", "united", "us", "user", "users",
]);

function distinctiveProfileTerms(values: readonly string[]) {
  return uniqueSorted(values.map(normalizeScreen02DiscoveryText).filter(
    (term) => term.length >= 3 && term.split(" ").some(
      (token) => !NON_DISTINCTIVE_PROFILE_TERMS.has(token),
    ),
  ));
}

function qualifyingProfileTerms(
  industry: string,
  values: readonly string[],
) {
  const normalizedIndustry = normalizeScreen02DiscoveryText(industry);
  const nonQualifying = normalizedIndustry === "energy" ||
      normalizedIndustry === "energy sector"
    ? new Set(["energy", "energy sector", "sector"])
    : normalizedIndustry === "video gaming" ||
        normalizedIndustry === "video games"
      ? new Set(["video", "gaming", "game"])
      : new Set<string>();
  return distinctiveProfileTerms(values).filter((term) =>
    !nonQualifying.has(normalizeScreen02DiscoveryText(term))
  );
}

function scoringProfileTerms(
  industry: string,
  studyProfile?: Screen02StudyRelevanceProfile,
) {
  const fallback = buildScreen02IndustryRelevanceProfile(industry);
  if (!studyProfile) {
    const directFamilies = new Set([
      "identity", "actor", "product-service", "activity",
    ]);
    const relationshipTerms = distinctiveProfileTerms(fallback.queryFacets
      .filter((facet) => !directFamilies.has(facet.family))
      .map((facet) => facet.term));
    const relationshipSet = new Set(relationshipTerms);
    const queryTerms = distinctiveProfileTerms([
      industry,
      ...fallback.directTerms,
      ...fallback.adjacentTerms,
    ]);
    const directTerms = qualifyingProfileTerms(
      industry,
      fallback.directTerms.filter((term) => !relationshipSet.has(term)),
    );
    const adjacentTerms = qualifyingProfileTerms(industry, [
      ...fallback.adjacentTerms,
      ...relationshipTerms,
    ]);
    return {
      ...fallback,
      queryTerms,
      directTerms,
      adjacentTerms,
      broadBridgeTerms: uniqueSorted([...directTerms, ...adjacentTerms]),
    };
  }
  if (!isScreen02StudyRelevanceProfile(studyProfile)) {
    throw new Error("Screen 2 received an invalid study relevance profile.");
  }
  const expectedIndustry = normalizeScreen02DiscoveryText(industry);
  const profileIndustries = [
    studyProfile.originalIndustryText,
    studyProfile.canonicalIndustryLabel,
    ...studyProfile.industryAliases,
    ...studyProfile.internationalVariants,
  ].map(normalizeScreen02DiscoveryText);
  if (!profileIndustries.includes(expectedIndustry)) {
    throw new Error("Screen 2 study relevance profile targets a different industry.");
  }
  const queryTerms = distinctiveProfileTerms([
    studyProfile.canonicalIndustryLabel,
    studyProfile.originalIndustryText,
    ...studyProfile.industryAliases,
    ...studyProfile.internationalVariants,
    ...studyProfile.subsectors,
    ...studyProfile.industryActors,
    ...studyProfile.products,
    ...studyProfile.services,
    ...studyProfile.regulatedActivities,
    ...studyProfile.businessModels,
    ...studyProfile.distributionChannels,
    ...studyProfile.platformRelationships,
    ...studyProfile.workforceRelationships,
    ...studyProfile.supplyChainRelationships,
    ...studyProfile.customerOrUserRelationships,
    ...studyProfile.regulatorySurfaces,
    ...studyProfile.disruptionSurfaces,
  ]);
  const directTerms = qualifyingProfileTerms(
    studyProfile.canonicalIndustryLabel,
    [
      studyProfile.canonicalIndustryLabel,
      ...studyProfile.industryAliases,
      ...studyProfile.internationalVariants,
      ...studyProfile.subsectors,
      ...studyProfile.industryActors,
      ...studyProfile.products,
      ...studyProfile.services,
      ...studyProfile.regulatedActivities,
    ],
  );
  const adjacentTerms = qualifyingProfileTerms(
    studyProfile.canonicalIndustryLabel,
    [
      ...studyProfile.businessModels,
      ...studyProfile.distributionChannels,
      ...studyProfile.platformRelationships,
      ...studyProfile.workforceRelationships,
      ...studyProfile.supplyChainRelationships,
      ...studyProfile.customerOrUserRelationships,
      ...studyProfile.regulatorySurfaces,
      ...studyProfile.disruptionSurfaces,
    ],
  );
  const normalizedIndustry = normalizeScreen02DiscoveryText(
    studyProfile.canonicalIndustryLabel,
  );
  const crossIndustry = /^(?:all|any|cross)(?: industry| industries| sector| sectors)$/u
    .test(normalizedIndustry);
  return {
    version: studyProfile.profileVersion,
    industry: studyProfile.canonicalIndustryLabel,
    normalizedIndustry,
    status: directTerms.length > 0 || crossIndustry
      ? "ready" as const
      : "needs-clarification" as const,
    scopeMode: crossIndustry ? "cross-industry" as const : "target-industry" as const,
    queryTerms,
    directTerms,
    adjacentTerms,
    broadBridgeTerms: uniqueSorted([...directTerms, ...adjacentTerms]),
    falseFriends: distinctiveProfileTerms([
      ...studyProfile.contrastTerms,
      ...studyProfile.falseFriends,
    ]),
    queryFacets: [
      ...distinctiveProfileTerms([
        studyProfile.canonicalIndustryLabel,
        ...studyProfile.industryAliases,
        ...studyProfile.internationalVariants,
        ...studyProfile.subsectors,
      ]).map((term) => ({ family: "identity" as const, term })),
      ...distinctiveProfileTerms(studyProfile.industryActors)
        .map((term) => ({ family: "actor" as const, term })),
      ...distinctiveProfileTerms([...studyProfile.products, ...studyProfile.services])
        .map((term) => ({ family: "product-service" as const, term })),
      ...distinctiveProfileTerms(studyProfile.regulatedActivities)
        .map((term) => ({ family: "activity" as const, term })),
      ...distinctiveProfileTerms(studyProfile.businessModels)
        .map((term) => ({ family: "business-model" as const, term })),
      ...distinctiveProfileTerms(studyProfile.distributionChannels)
        .map((term) => ({ family: "distribution-channel" as const, term })),
      ...distinctiveProfileTerms(studyProfile.platformRelationships)
        .map((term) => ({ family: "platform-relationship" as const, term })),
      ...distinctiveProfileTerms(studyProfile.workforceRelationships)
        .map((term) => ({ family: "workforce-relationship" as const, term })),
      ...distinctiveProfileTerms(studyProfile.supplyChainRelationships)
        .map((term) => ({ family: "supply-chain-relationship" as const, term })),
      ...distinctiveProfileTerms(studyProfile.customerOrUserRelationships)
        .map((term) => ({ family: "customer-user-relationship" as const, term })),
      ...distinctiveProfileTerms(studyProfile.regulatorySurfaces)
        .map((term) => ({ family: "regulatory-surface" as const, term })),
      ...distinctiveProfileTerms(studyProfile.disruptionSurfaces)
        .map((term) => ({ family: "disruption-surface" as const, term })),
    ],
    note: `Uses the complete ${studyProfile.origin} study relevance profile.`,
  };
}

function safeNativeQueryText(value: string, maxLength = 160) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength)
    .trim();
}

function scoringPlan(
  industry: string,
  studyProfile?: Screen02StudyRelevanceProfile,
) {
  const safeIndustry = safeNativeQueryText(industry);
  const profile = scoringProfileTerms(safeIndustry, studyProfile);
  if (profile.status !== "ready") {
    return {
      status: "needs-clarification" as const,
      positiveTerms: [] as string[],
      contrastTerms: profile.falseFriends,
      note: profile.note,
    };
  }

  const positiveTerms = profile.queryTerms;
  const contrastTerms = profile.falseFriends;
  const variants: Screen02NativeQueryVariant[] = [];
  const seenQueries = new Set<string>();
  const addVariant = (
    query: string,
    strategy: Screen02NativeQueryVariant["strategy"],
    purpose: string,
  ) => {
    const safe = safeNativeQueryText(query);
    const normalized = normalizeScreen02DiscoveryText(safe);
    if (
      !safe ||
      seenQueries.has(normalized) ||
      variants.length >= SCREEN02_NATIVE_QUERY_MAX_VARIANTS
    ) {
      return;
    }
    seenQueries.add(normalized);
    variants.push({
      id: `native-${String(variants.length + 1).padStart(2, "0")}`,
      query: safe,
      purpose,
      strategy,
    });
  };

  const crossIndustryPrimaryQuery = [
    ...(studyProfile?.eventFamilyTerms ?? []),
    ...(studyProfile?.regulatorySurfaces ?? []),
    ...(studyProfile?.disruptionSurfaces ?? []),
  ].map((term) => safeNativeQueryText(term)).find(Boolean) ?? safeIndustry;
  const primaryQuery = profile.scopeMode === "cross-industry"
    ? crossIndustryPrimaryQuery
    : safeIndustry;
  addVariant(
    primaryQuery,
    "industry-exact",
    profile.scopeMode === "cross-industry"
      ? "Search official records using profile-defined cross-industry event vocabulary."
      : `Search official records using the confirmed industry phrase: ${safeIndustry}.`,
  );
  const firstFacetByFamily = new Map<
    (typeof profile.queryFacets)[number]["family"],
    (typeof profile.queryFacets)[number]
  >();
  for (const facet of profile.queryFacets) {
    if (!firstFacetByFamily.has(facet.family)) {
      firstFacetByFamily.set(facet.family, facet);
    }
  }
  const diverseFacets = [
    ...firstFacetByFamily.values(),
    ...profile.queryFacets.filter(
      (facet) => firstFacetByFamily.get(facet.family) !== facet,
    ),
  ];
  diverseFacets.slice(0, 6).forEach((facet) =>
    addVariant(
      facet.term,
      "industry-alias",
      `Search the disclosed ${facet.family} facet for ${safeIndustry}.`,
    ),
  );
  if (studyProfile) {
    const profileQueries: Array<[string, string]> = [
      [studyProfile.geographyAliases.join(" "), "sample-geography aliases"],
      [studyProfile.possibleIssuingJurisdictions.join(" "), "possible issuing jurisdictions"],
      [studyProfile.jurisdictionAliases.join(" "), "jurisdiction aliases"],
      [studyProfile.eventFamilyTerms.join(" "), "event-family vocabulary"],
      [
        studyProfile.studyStartYear && studyProfile.studyEndYear
          ? `${studyProfile.eventFamilyTerms[0] ?? "event"} ${studyProfile.studyStartYear} ${studyProfile.studyEndYear}`
          : "",
        "bounded study years",
      ],
    ];
    for (const [term, family] of profileQueries) {
      addVariant(
        `${primaryQuery} ${term}`,
        "industry-alias",
        `Search the profile's ${family}.`,
      );
    }
  }
  for (const criterion of canonicalCriteria(undefined).slice(0, 2)) {
    addVariant(
      `${primaryQuery} ${criterion}`,
      "strict-criterion",
      "Use an Only-include phrase as bounded query expansion; lexical retrieval does not prove semantic satisfaction.",
    );
  }

  const interventionFamilies = [
    ["eligibility threshold", "covered-entity and eligibility rules"],
    ["reporting disclosure", "reporting and disclosure duties"],
    ["licensing permit", "licensing and permit requirements"],
    ["safety standard", "product and operational safety standards"],
    ["market access restriction", "market-access restrictions"],
    ["tax fee assessment", "taxes, fees, and assessments"],
    ["environmental standard", "environmental requirements"],
    ["labor employment standard", "labor and employment requirements"],
    ["data cybersecurity requirement", "data and cybersecurity requirements"],
    ["consumer protection requirement", "consumer-protection requirements"],
    ["procurement contracting rule", "procurement and contracting rules"],
    ["competition ownership rule", "competition and ownership rules"],
  ] as const;
  for (const [suffix, purpose] of interventionFamilies) {
    if (variants.length >= SCREEN02_NATIVE_QUERY_MIN_VARIANTS) break;
    addVariant(
      `${primaryQuery} ${suffix}`,
      "industry-alias",
      `Search a materially distinct intervention family: ${purpose}.`,
    );
  }

  return {
    status: variants.length > 0
      ? "ready" as const
      : "needs-clarification" as const,
    positiveTerms,
    contrastTerms,
    note:
      variants.length > 0
        ? `Generated ${variants.length} profile-driven, bounded query ${
            variants.length === 1 ? "variant" : "variants"
          }; AI expansion is optional.`
        : "No safe industry query could be constructed from the confirmed scope.",
  };
}

function containsNormalizedPhrase(text: string, phrase: string) {
  const normalizedText = ` ${normalizeScreen02DiscoveryText(text)} `;
  const normalizedPhrase = normalizeScreen02DiscoveryText(phrase);
  return Boolean(
    normalizedPhrase && normalizedText.includes(` ${normalizedPhrase} `),
  );
}

/** Returns only source-derived candidate text. */
export function screen02NativeEvidenceText(proposal: Screen02Proposal) {
  return { title: proposal.description, body: "" };
}

/** Performs conservative, source-evidence-only industry triage. */
export function scoreScreen02NativeIndustryRelevance(
  proposal: Screen02Proposal,
  industry: string,
  studyProfile?: Screen02StudyRelevanceProfile,
): Screen02NativeIndustryRelevance {
  const plan = scoringPlan(industry, studyProfile);
  const profile = scoringProfileTerms(industry, studyProfile);
  if (profile.status === "ready" && profile.scopeMode === "cross-industry") {
    return {
      version: SCREEN02_NATIVE_QUERY_PLAN_VERSION,
      status: "possible-fit",
      score: 50,
      matchedPositiveTerms: [],
      matchedContrastTerms: [],
      reason: profile.note,
    };
  }
  if (plan.status !== "ready" || plan.positiveTerms.length === 0) {
    return {
      version: SCREEN02_NATIVE_QUERY_PLAN_VERSION,
      status: "mismatch",
      score: 0,
      matchedPositiveTerms: [],
      matchedContrastTerms: [],
      reason: plan.note,
    };
  }

  const evidence = screen02NativeEvidenceText(proposal);
  const titleMatches = plan.positiveTerms.filter((term) =>
    containsNormalizedPhrase(evidence.title, term),
  );
  const bodyMatches = plan.positiveTerms.filter(
    (term) =>
      !titleMatches.includes(term) &&
      containsNormalizedPhrase(evidence.body, term),
  );
  const matchedPositiveTerms = uniqueSorted([
    ...titleMatches,
    ...bodyMatches,
  ]);
  const matchedContrastTerms = uniqueSorted(
    plan.contrastTerms.filter(
      (term) =>
        containsNormalizedPhrase(evidence.title, term) ||
        containsNormalizedPhrase(evidence.body, term),
    ),
  );

  if (matchedPositiveTerms.length === 0) {
    return {
      version: SCREEN02_NATIVE_QUERY_PLAN_VERSION,
      status: "mismatch",
      score: 0,
      matchedPositiveTerms,
      matchedContrastTerms,
      reason:
        matchedContrastTerms.length > 0
          ? `The source record matches ${matchedContrastTerms.join(
              ", ",
            )}, but contains no source-derived evidence for the confirmed industry ${industry}.`
          : `The source title and description contain no source-derived evidence for the confirmed industry ${industry}.`,
    };
  }

  let score = Math.min(
    100,
    titleMatches.length * 60 +
      bodyMatches.length * 35 +
      Math.max(0, matchedPositiveTerms.length - 1) * 5,
  );
  const hasContrast = matchedContrastTerms.length > 0;
  if (hasContrast) score = Math.min(score, 65);
  const status =
    !hasContrast &&
    (titleMatches.length > 0 || matchedPositiveTerms.length >= 2)
      ? "clear-fit"
      : "possible-fit";
  return {
    version: SCREEN02_NATIVE_QUERY_PLAN_VERSION,
    status,
    score,
    matchedPositiveTerms,
    matchedContrastTerms,
    reason: hasContrast
      ? `The source record contains industry evidence (${matchedPositiveTerms.join(
          ", ",
        )}) and an ambiguity signal (${matchedContrastTerms.join(
          ", ",
        )}); retain it as a possible fit for review.`
      : `The source record contains industry evidence: ${matchedPositiveTerms.join(
          ", ",
        )}.`,
  };
}
