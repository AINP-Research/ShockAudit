import type { Screen01StudyContext } from "./scope-types";
import type {
  Screen02Proposal,
  Screen02Source,
} from "./screen02-types";
import {
  SCREEN02_DISCOVERY_FORMULA_VERSION,
  buildInitialScreen02DiscoveryQuery,
} from "./screen02-discovery-contract";
import {
  canonicalScreen02FormalIdentifier as canonicalFormalIdentifier,
  compareScreen02FormalIdentifiers,
  isIndependentlyScopedScreen02FormalIdentifier as formalIdentifierIsIndependentlyScoped,
} from "./screen02-formal-identifier";
import {
  buildScreen02IndustryRelevanceProfile,
  isScreen02StudyRelevanceProfile,
  SCREEN02_DISCOVERY_MAX_QUERY_VARIANTS,
  SCREEN02_DISCOVERY_MIN_QUERY_VARIANTS,
  type Screen02StudyRelevanceProfile,
} from "./screen02-relevance-profile";

export {
  SCREEN02_DISCOVERY_FORMULA_VERSION,
  buildInitialScreen02DiscoveryQuery,
} from "./screen02-discovery-contract";
export {
  scoreScreen02NativeIndustryRelevance,
  screen02NativeEvidenceText,
} from "./screen02-native-industry-relevance";
export type { Screen02NativeIndustryRelevance } from
  "./screen02-native-industry-relevance";
export const SCREEN02_BM25_DEFAULTS = {
  k1: 1.2,
  b: 0.75,
} as const;
export const SCREEN02_PROPOSAL_CLUSTER_THRESHOLD = 0.78;
export const SCREEN02_PREFERENCE_MATCH_THRESHOLD = 0.6;
export const SCREEN02_NATIVE_QUERY_PLAN_VERSION =
  "screen-02-native-query-plan-v1" as const;
export const SCREEN02_NATIVE_QUERY_MIN_VARIANTS =
  SCREEN02_DISCOVERY_MIN_QUERY_VARIANTS;
export const SCREEN02_NATIVE_QUERY_MAX_VARIANTS =
  SCREEN02_DISCOVERY_MAX_QUERY_VARIANTS;

export type Screen02NativeQueryVariant = {
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

export type Screen02NativeQueryPlan = {
  version: typeof SCREEN02_NATIVE_QUERY_PLAN_VERSION;
  status: "ready" | "needs-clarification";
  industry: string;
  positiveTerms: string[];
  contrastTerms: string[];
  variants: Screen02NativeQueryVariant[];
  note: string;
};

const STOP_WORDS = new Set([
  "a",
  "about",
  "after",
  "among",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "before",
  "being",
  "by",
  "for",
  "from",
  "in",
  "into",
  "is",
  "of",
  "on",
  "or",
  "over",
  "that",
  "the",
  "these",
  "this",
  "those",
  "to",
  "under",
  "was",
  "were",
  "with",
]);

const originPriority: Record<Screen02Proposal["origin"], number> = {
  "registry-reviewed": 0,
  "user-provided": 1,
  "newly-discovered": 2,
  "unsupported-lead": 3,
  "fictional-demonstration": 4,
};

export type Screen02TokenizerOptions = {
  removeStopWords?: boolean;
};

export type Screen02DiscoveryPreferences = {
  require?: readonly string[];
  prefer?: readonly string[];
  avoid?: readonly string[];
};

export type Screen02Bm25Document<T> = {
  id: string;
  text: string;
  value: T;
};

export type Screen02Bm25Options = {
  k1?: number;
  b?: number;
  studyProfile?: Screen02StudyRelevanceProfile;
};

export type Screen02Bm25TermDiagnostic = {
  term: string;
  termFrequency: number;
  documentFrequency: number;
  inverseDocumentFrequency: number;
  contribution: number;
};

export type Screen02Bm25RankedDocument<T> = {
  id: string;
  value: T;
  rank: number;
  rankScore: number;
  diagnostics: {
    formulaVersion: typeof SCREEN02_DISCOVERY_FORMULA_VERSION;
    queryTerms: string[];
    matchedTerms: string[];
    documentLength: number;
    averageDocumentLength: number;
    k1: number;
    b: number;
    terms: Screen02Bm25TermDiagnostic[];
  };
};

export type Screen02ProposalRank = {
  proposal: Screen02Proposal;
  proposalId: string;
  stableProposalId: string;
  documentId: string;
  rank: number;
  rankScore: number;
  preferenceRelevance: Screen02PreferenceRelevance;
  diagnostics: Screen02Bm25RankedDocument<Screen02Proposal>["diagnostics"];
};

export type Screen02TitleSimilarity = {
  leftNormalized: string;
  rightNormalized: string;
  tokenJaccard: number;
  characterBigramDice: number;
  editSimilarity: number;
  score: number;
};

export type Screen02ProposalSimilarity = {
  leftProposalId: string;
  rightProposalId: string;
  compatible: boolean;
  score: number;
  titleSimilarity: number;
  metadataSimilarity: number;
  reason: string;
};

export type Screen02ProposalClusterMember = {
  proposalId: string;
  stableProposalId: string;
};

export type Screen02ProposalCluster = {
  clusterId: string;
  canonicalProposalId: string;
  members: Screen02ProposalClusterMember[];
  memberProposalIds: string[];
  duplicateProposalIds: string[];
};

export type Screen02ProposalClusteringResult = {
  formulaVersion: typeof SCREEN02_DISCOVERY_FORMULA_VERSION;
  threshold: number;
  clusters: Screen02ProposalCluster[];
  membership: Record<string, string>;
  comparisons: Screen02ProposalSimilarity[];
};

export type Screen02ProposalDeduplicationResult = {
  formulaVersion: typeof SCREEN02_DISCOVERY_FORMULA_VERSION;
  threshold: number;
  proposals: Screen02Proposal[];
  retainedProposalIds: string[];
  duplicateProposalIds: string[];
  clusters: Screen02ProposalCluster[];
  membership: Record<string, string>;
  comparisons: Screen02ProposalSimilarity[];
};

export type Screen02PreferenceCriterionKind =
  | "require"
  | "prefer"
  | "avoid";

export type Screen02PreferenceCriterionDiagnostic = {
  kind: Screen02PreferenceCriterionKind;
  criterion: string;
  normalizedCriterion: string;
  relevance: number;
  matched: boolean;
  matchedTokens: string[];
  missingTokens: string[];
  reason: string;
};

export type Screen02PreferenceRelevance = {
  formulaVersion: typeof SCREEN02_DISCOVERY_FORMULA_VERSION;
  proposalId: string;
  stableProposalId: string;
  score: number | null;
  requiredSatisfied: boolean;
  positiveRelevance: number | null;
  avoidPenalty: number;
  criteria: Screen02PreferenceCriterionDiagnostic[];
  reason: string;
};

function compareText(left: string, right: string) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function round(value: number, digits = 6) {
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function average(values: readonly number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function uniqueSorted(values: readonly string[]) {
  return [...new Set(values)].sort(compareText);
}

function normalizedUniqueSorted(values: readonly string[]) {
  return uniqueSorted(
    values
      .map((value) => normalizeScreen02DiscoveryText(value))
      .filter(Boolean),
  );
}

/**
 * Normalizes evidence text without language-model inference. Unicode
 * diacritics, apostrophes, punctuation, and whitespace are handled by fixed
 * rules. Dots inside abbreviations are removed before other punctuation so
 * "U.S." and "US" normalize identically.
 */
export function normalizeScreen02DiscoveryText(input: string) {
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

/**
 * Tokenizes normalized text for lexical retrieval. The stop-word list is
 * fixed in this module and can be disabled for diagnostics or tests.
 */
export function tokenizeScreen02DiscoveryText(
  input: string,
  options: Screen02TokenizerOptions = {},
) {
  const normalized = normalizeScreen02DiscoveryText(input);
  if (!normalized) return [];
  const removeStopWords = options.removeStopWords ?? true;
  return normalized.split(" ").filter((token) => {
    if (!token) return false;
    if (/^\p{N}+$/u.test(token)) return true;
    if (token.length === 1) return false;
    return !removeStopWords || !STOP_WORDS.has(token);
  });
}

function fnv1a64(input: string) {
  let hash = 0xcbf29ce484222325n;
  const bytes = new TextEncoder().encode(input);
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function proposalSemanticSignature(proposal: Screen02Proposal) {
  if (proposal.mode === "find") {
    return [
      proposal.mode,
      proposal.kind,
      normalizeScreen02DiscoveryText(proposal.event.displayName),
      normalizeScreen02DiscoveryText(proposal.event.eventDate),
      normalizeScreen02DiscoveryText(proposal.event.eventFamily),
      normalizedUniqueSorted(proposal.event.geographies).join("|"),
      normalizedUniqueSorted(proposal.event.populations).join("|"),
    ].join("\u001f");
  }

  return [
    proposal.mode,
    proposal.kind,
    proposal.representationType,
    normalizeScreen02DiscoveryText(proposal.candidateConstruct),
    normalizeScreen02DiscoveryText(proposal.operationalization),
  ].join("\u001f");
}

/**
 * Returns a content-derived identifier that is independent of input order,
 * evidence-source order, and the caller-supplied proposal ID.
 */
export function stableScreen02ProposalId(proposal: Screen02Proposal) {
  return `s2p-${fnv1a64(proposalSemanticSignature(proposal))}`;
}

function stableProposalDocumentId(proposal: Screen02Proposal) {
  const proposalReference = normalizeScreen02DiscoveryText(proposal.id);
  return `${stableScreen02ProposalId(proposal)}-${fnv1a64(
    proposalReference,
  ).slice(0, 8)}`;
}

function proposalSearchParts(proposal: Screen02Proposal) {
  const shared = [
    proposal.title,
    proposal.description,
    proposal.origin,
    ...proposal.provisionalDates,
    proposal.affectedPopulation,
    ...proposal.requiredVariables,
    ...proposal.limitations,
    ...proposal.reasons,
    ...proposal.sources.flatMap((source) => [
      source.title,
      source.publisher,
      source.channel,
    ]),
  ];

  if (proposal.mode === "find") {
    return [
      ...shared,
      proposal.event.displayName,
      proposal.event.eventDate,
      proposal.event.eventFamily,
      ...proposal.event.geographies,
      ...proposal.event.populations,
    ];
  }

  return [
    ...shared,
    proposal.representationType,
    proposal.candidateConstruct,
    proposal.operationalization,
  ];
}

export function screen02ProposalSearchText(proposal: Screen02Proposal) {
  return proposalSearchParts(proposal).filter(Boolean).join(" ");
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

function safeNativeQueryText(value: string, maxLength = 160) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength)
    .trim();
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

/**
 * Retrieval vocabulary and qualification vocabulary serve different jobs.
 * Broad words such as `energy` are useful to obtain recall from an official
 * index, but they cannot by themselves prove that a returned record concerns
 * the requested economic activity. Likewise, a host-added standalone `video`
 * token can aid recall but must never establish video-game relevance.
 */
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

export function screen02StudyProfileIndustryTerms(
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

/**
 * Builds an auditable, profile-driven native query matrix. Except when an
 * event-family or event-surface term is needed to anchor a cross-industry
 * search, it deliberately omits event-family labels (the connector already
 * filters document types), population boilerplate, outcome wording,
 * Rank-higher preferences, and Do-not-show preferences. Those terms either
 * narrow recall incorrectly or make unrelated records appear relevant.
 */
export function buildScreen02NativeQueryPlan(input: {
  industry: string;
  knownShock?: string;
  require?: readonly string[];
  assistantTerms?: readonly string[];
  studyProfile?: Screen02StudyRelevanceProfile;
}): Screen02NativeQueryPlan {
  const industry = safeNativeQueryText(input.industry);
  const knownShock = safeNativeQueryText(input.knownShock ?? "", 200);
  if (knownShock) {
    return {
      version: SCREEN02_NATIVE_QUERY_PLAN_VERSION,
      status: "ready",
      industry,
      positiveTerms: [normalizeScreen02DiscoveryText(knownShock)],
      contrastTerms: [],
      variants: [
        {
          id: "known-shock-exact",
          query: knownShock,
          purpose:
            "Search the exact researcher-named shock without substituting a different event.",
          strategy: "known-shock",
        },
      ],
      note: "Audit mode uses one exact-shock query.",
    };
  }

  const profile = screen02StudyProfileIndustryTerms(
    industry,
    input.studyProfile,
  );
  if (profile.status !== "ready") {
    return {
      version: SCREEN02_NATIVE_QUERY_PLAN_VERSION,
      status: "needs-clarification",
      industry,
      positiveTerms: [],
      contrastTerms: profile.falseFriends,
      variants: [],
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
    ...(input.studyProfile?.eventFamilyTerms ?? []),
    ...(input.studyProfile?.regulatorySurfaces ?? []),
    ...(input.studyProfile?.disruptionSurfaces ?? []),
  ].map((term) => safeNativeQueryText(term)).find(Boolean) ?? industry;
  const primaryQuery = profile.scopeMode === "cross-industry"
    ? crossIndustryPrimaryQuery
    : industry;
  addVariant(
    primaryQuery,
    "industry-exact",
    profile.scopeMode === "cross-industry"
      ? "Search official records using profile-defined cross-industry event vocabulary."
      : `Search official records using the confirmed industry phrase: ${industry}.`,
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
      `Search the disclosed ${facet.family} facet for ${industry}.`,
    ),
  );
  const studyProfile = input.studyProfile;
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
  for (const criterion of canonicalCriteria(input.require).slice(0, 2)) {
    addVariant(
      `${primaryQuery} ${criterion}`,
      "strict-criterion",
      "Use an Only-include phrase as bounded query expansion; lexical retrieval does not prove semantic satisfaction.",
    );
  }
  for (const term of canonicalCriteria(input.assistantTerms).slice(0, 4)) {
    addVariant(
      `${primaryQuery} ${term}`,
      "chatgpt-query-expansion",
      "Use bounded supplemental vocabulary to improve official-record recall only; this phrase proves no event fact, fit, eligibility, or rank.",
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
    version: SCREEN02_NATIVE_QUERY_PLAN_VERSION,
    status: variants.length > 0 ? "ready" : "needs-clarification",
    industry,
    positiveTerms,
    contrastTerms,
    variants,
    note:
      variants.length > 0
        ? `Generated ${variants.length} profile-driven, bounded query ${
            variants.length === 1 ? "variant" : "variants"
          }; AI expansion is optional.`
        : "No safe industry query could be constructed from the confirmed scope.",
  };
}

/**
 * Builds the lexical query from the immutable Screen 1 research context and
 * positive Screen 2 preferences. Avoid criteria are intentionally excluded
 * from retrieval and are applied later as a transparent penalty.
 */
export function buildScreen02DiscoveryQuery(
  context: Screen01StudyContext,
  preferences: Screen02DiscoveryPreferences = {},
  studyProfile?: Screen02StudyRelevanceProfile,
) {
  const profile = studyProfile
    ? screen02StudyProfileIndustryTerms(
        context.scopeContract.industry,
        studyProfile,
      )
    : null;
  const parts = [
    buildInitialScreen02DiscoveryQuery(context),
    ...(profile?.queryTerms ?? []),
    ...(studyProfile?.geographyAliases ?? []),
    ...(studyProfile?.possibleIssuingJurisdictions ?? []),
    ...(studyProfile?.jurisdictionAliases ?? []),
    ...(studyProfile?.eventFamilyTerms ?? []),
    ...(studyProfile?.requiredCriteria ?? []),
    ...(studyProfile?.preferredCriteria ?? []),
    ...canonicalCriteria(preferences.require),
    ...canonicalCriteria(preferences.prefer),
  ];
  return parts.filter(Boolean).join(" ");
}

function validateBm25Options(options: Screen02Bm25Options) {
  const k1 = options.k1 ?? SCREEN02_BM25_DEFAULTS.k1;
  const b = options.b ?? SCREEN02_BM25_DEFAULTS.b;
  if (!Number.isFinite(k1) || k1 <= 0) {
    throw new Error("BM25 k1 must be a finite number greater than zero.");
  }
  if (!Number.isFinite(b) || b < 0 || b > 1) {
    throw new Error("BM25 b must be a finite number between zero and one.");
  }
  return { k1, b };
}

function assertUniqueDocumentIds<T>(
  documents: readonly Screen02Bm25Document<T>[],
) {
  const seen = new Set<string>();
  for (const document of documents) {
    if (!document.id.trim()) {
      throw new Error("BM25 document IDs must not be empty.");
    }
    if (seen.has(document.id)) {
      throw new Error(`Duplicate BM25 document ID: ${document.id}`);
    }
    seen.add(document.id);
  }
}

/**
 * Ranks arbitrary candidate documents with the Robertson-Sparck Jones BM25
 * formula. All inputs, parameters, term contributions, and tie-breaks are
 * deterministic and returned in the diagnostics.
 */
export function rankScreen02DocumentsBm25<T>(
  query: string,
  documents: readonly Screen02Bm25Document<T>[],
  options: Screen02Bm25Options = {},
): Screen02Bm25RankedDocument<T>[] {
  assertUniqueDocumentIds(documents);
  const { k1, b } = validateBm25Options(options);
  if (documents.length === 0) return [];

  const queryTerms = uniqueSorted(
    tokenizeScreen02DiscoveryText(query),
  );
  const tokenized = documents.map((document) => ({
    document,
    tokens: tokenizeScreen02DiscoveryText(document.text),
  }));
  const averageDocumentLength =
    average(tokenized.map(({ tokens }) => tokens.length)) || 1;

  const documentFrequency = new Map<string, number>();
  for (const term of queryTerms) {
    documentFrequency.set(
      term,
      tokenized.reduce(
        (count, { tokens }) =>
          count + (tokens.includes(term) ? 1 : 0),
        0,
      ),
    );
  }

  const ranked = tokenized.map(({ document, tokens }) => {
    const termFrequency = new Map<string, number>();
    for (const token of tokens) {
      termFrequency.set(token, (termFrequency.get(token) ?? 0) + 1);
    }

    let rawScore = 0;
    const terms = queryTerms.map((term) => {
      const tf = termFrequency.get(term) ?? 0;
      const df = documentFrequency.get(term) ?? 0;
      const inverseDocumentFrequency = Math.log(
        1 + (documents.length - df + 0.5) / (df + 0.5),
      );
      const lengthNormalization =
        k1 *
        (1 -
          b +
          b * (tokens.length / averageDocumentLength));
      const contribution =
        tf === 0
          ? 0
          : inverseDocumentFrequency *
            ((tf * (k1 + 1)) / (tf + lengthNormalization));
      rawScore += contribution;
      return {
        term,
        termFrequency: tf,
        documentFrequency: df,
        inverseDocumentFrequency: round(inverseDocumentFrequency),
        contribution: round(contribution),
      };
    });

    return {
      id: document.id,
      value: document.value,
      rawScore,
      diagnostics: {
        formulaVersion: SCREEN02_DISCOVERY_FORMULA_VERSION,
        queryTerms,
        matchedTerms: terms
          .filter((term) => term.termFrequency > 0)
          .map((term) => term.term),
        documentLength: tokens.length,
        averageDocumentLength: round(averageDocumentLength),
        k1,
        b,
        terms,
      },
    };
  });

  ranked.sort(
    (left, right) =>
      right.rawScore - left.rawScore ||
      compareText(left.id, right.id),
  );

  return ranked.map((entry, index) => ({
    id: entry.id,
    value: entry.value,
    rank: index + 1,
    rankScore: round(entry.rawScore),
    diagnostics: entry.diagnostics,
  }));
}

function assertUniqueProposalIds(
  proposals: readonly Screen02Proposal[],
) {
  const seen = new Set<string>();
  for (const proposal of proposals) {
    if (!proposal.id.trim()) {
      throw new Error("Screen 2 proposal IDs must not be empty.");
    }
    if (seen.has(proposal.id)) {
      throw new Error(`Duplicate Screen 2 proposal ID: ${proposal.id}`);
    }
    seen.add(proposal.id);
  }
}

export function rankScreen02ProposalsBm25(
  proposals: readonly Screen02Proposal[],
  context: Screen01StudyContext,
  preferences: Screen02DiscoveryPreferences = {},
  options: Screen02Bm25Options = {},
): Screen02ProposalRank[] {
  assertUniqueProposalIds(proposals);
  const query = buildScreen02DiscoveryQuery(
    context,
    preferences,
    options.studyProfile,
  );
  const documents = proposals.map((proposal) => ({
    id: stableProposalDocumentId(proposal),
    text: screen02ProposalSearchText(proposal),
    value: proposal,
  }));

  return rankScreen02DocumentsBm25(
    query,
    documents,
    options,
  ).map((ranked) => ({
    proposal: ranked.value,
    proposalId: ranked.value.id,
    stableProposalId: stableScreen02ProposalId(ranked.value),
    documentId: ranked.id,
    rank: ranked.rank,
    rankScore: ranked.rankScore,
    preferenceRelevance: scoreScreen02PreferenceRelevance(
      ranked.value,
      context,
      preferences,
    ),
    diagnostics: ranked.diagnostics,
  }));
}

function setJaccard(
  leftValues: readonly string[],
  rightValues: readonly string[],
) {
  const left = new Set(leftValues);
  const right = new Set(rightValues);
  const union = new Set([...left, ...right]);
  if (union.size === 0) return 0;
  let intersection = 0;
  for (const value of left) {
    if (right.has(value)) intersection += 1;
  }
  return intersection / union.size;
}

function characterBigrams(value: string) {
  const compact = value.replace(/\s+/g, "");
  if (!compact) return [];
  if (compact.length === 1) return [compact];
  const grams: string[] = [];
  for (let index = 0; index < compact.length - 1; index += 1) {
    grams.push(compact.slice(index, index + 2));
  }
  return grams;
}

function multisetDice(
  leftValues: readonly string[],
  rightValues: readonly string[],
) {
  if (leftValues.length === 0 || rightValues.length === 0) return 0;
  const rightCounts = new Map<string, number>();
  for (const value of rightValues) {
    rightCounts.set(value, (rightCounts.get(value) ?? 0) + 1);
  }
  let intersection = 0;
  for (const value of leftValues) {
    const available = rightCounts.get(value) ?? 0;
    if (available > 0) {
      intersection += 1;
      rightCounts.set(value, available - 1);
    }
  }
  return (2 * intersection) / (leftValues.length + rightValues.length);
}

function levenshteinDistance(left: string, right: string) {
  if (left === right) return 0;
  if (!left) return right.length;
  if (!right) return left.length;

  let previous = Array.from(
    { length: right.length + 1 },
    (_, index) => index,
  );
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (
      let rightIndex = 1;
      rightIndex <= right.length;
      rightIndex += 1
    ) {
      const substitution =
        previous[rightIndex - 1] +
        (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1);
      current[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        substitution,
      );
    }
    previous = current;
  }
  return previous[right.length];
}

export function compareScreen02Titles(
  left: string,
  right: string,
): Screen02TitleSimilarity {
  const leftNormalized = normalizeScreen02DiscoveryText(left);
  const rightNormalized = normalizeScreen02DiscoveryText(right);
  if (!leftNormalized || !rightNormalized) {
    return {
      leftNormalized,
      rightNormalized,
      tokenJaccard: 0,
      characterBigramDice: 0,
      editSimilarity: 0,
      score: 0,
    };
  }
  if (leftNormalized === rightNormalized) {
    return {
      leftNormalized,
      rightNormalized,
      tokenJaccard: 1,
      characterBigramDice: 1,
      editSimilarity: 1,
      score: 1,
    };
  }

  const tokenJaccard = setJaccard(
    uniqueSorted(tokenizeScreen02DiscoveryText(left)),
    uniqueSorted(tokenizeScreen02DiscoveryText(right)),
  );
  const characterBigramDice = multisetDice(
    characterBigrams(leftNormalized),
    characterBigrams(rightNormalized),
  );
  const editSimilarity =
    1 -
    levenshteinDistance(leftNormalized, rightNormalized) /
      Math.max(leftNormalized.length, rightNormalized.length);
  const score =
    0.5 * tokenJaccard +
    0.3 * characterBigramDice +
    0.2 * editSimilarity;

  return {
    leftNormalized,
    rightNormalized,
    tokenJaccard: round(tokenJaccard),
    characterBigramDice: round(characterBigramDice),
    editSimilarity: round(editSimilarity),
    score: round(score),
  };
}

export function fuzzyScreen02TitleSimilarity(
  left: string,
  right: string,
) {
  return compareScreen02Titles(left, right).score;
}

function normalizedValueSetSimilarity(
  left: readonly string[],
  right: readonly string[],
) {
  return setJaccard(
    normalizedUniqueSorted(left),
    normalizedUniqueSorted(right),
  );
}

function normalizedTokenSimilarity(left: string, right: string) {
  return setJaccard(
    uniqueSorted(tokenizeScreen02DiscoveryText(left)),
    uniqueSorted(tokenizeScreen02DiscoveryText(right)),
  );
}

function formalIdentifierInput(
  value: string | null | undefined,
  proposal?: Extract<Screen02Proposal, { mode: "find" }>,
) {
  const normalized = normalizeScreen02DiscoveryText(value ?? "");
  const bareYearSerial = /^(\d{4}) (\d{4,6})$/u.exec(normalized);
  const federalRegisterSignal = proposal &&
    canonicalIssuingJurisdiction(
      proposal.nativeIdentity?.issuingJurisdiction,
    ) === "us" &&
    proposal.sources.some((source) =>
      /\bfederal register\b/iu.test([
        source.title,
        source.publisher,
        source.channel,
        source.locator,
      ].join(" "))
    );
  return bareYearSerial && federalRegisterSignal
    ? `Federal Register ${bareYearSerial[1]}-${bareYearSerial[2]}`
    : value;
}

function normalizedFormalIdentifier(
  value: string | null | undefined,
  proposal?: Extract<Screen02Proposal, { mode: "find" }>,
) {
  return canonicalFormalIdentifier(formalIdentifierInput(value, proposal));
}

function proposalFormalIdentifierRelation(
  leftValue: string | null | undefined,
  leftProposal: Extract<Screen02Proposal, { mode: "find" }>,
  rightValue: string | null | undefined,
  rightProposal: Extract<Screen02Proposal, { mode: "find" }>,
) {
  return compareScreen02FormalIdentifiers(
    formalIdentifierInput(leftValue, leftProposal),
    formalIdentifierInput(rightValue, rightProposal),
  );
}

/** Canonicalizes context-free official identifier forms for pre-cap retrieval. */
export function canonicalScreen02FormalIdentifier(
  value: string | null | undefined,
) {
  return canonicalFormalIdentifier(value);
}

const ISSUING_JURISDICTION_ALIAS_GROUPS = [
  ["china", "prc", "peoples republic of china"],
  ["eu", "european union"],
  ["uk", "united kingdom"],
  ["us", "usa", "united states", "united states of america"],
] as const;

function canonicalIssuingJurisdiction(value: string | null | undefined) {
  let normalized = normalizeScreen02DiscoveryText(value ?? "")
    .replace(
      /^(?:peoples republic|(?:federal )?republic|kingdom|commonwealth|province|region|state|territory) of /u,
      "",
    );
  if (!normalized) return null;
  for (const aliases of ISSUING_JURISDICTION_ALIAS_GROUPS) {
    for (const alias of [...aliases].sort((left, right) =>
      right.length - left.length
    )) {
      if (normalized === alias) return aliases[0];
      if (normalized.endsWith(` ${alias}`)) {
        normalized = `${normalized.slice(0, -(alias.length + 1))} ${aliases[0]}`;
        return normalized;
      }
    }
  }
  return normalized;
}

function compatibleIssuingJurisdictions(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  const leftNormalized = canonicalIssuingJurisdiction(left);
  const rightNormalized = canonicalIssuingJurisdiction(right);
  if (!leftNormalized || !rightNormalized) return true;
  if (leftNormalized === rightNormalized) return true;

  const isKnownHierarchy = (specific: string, qualified: string) =>
    ISSUING_JURISDICTION_ALIAS_GROUPS.some((aliases) =>
      !(aliases as readonly string[]).includes(specific) &&
      (aliases as readonly string[]).some((broader) =>
        qualified === `${specific} ${broader}`
      )
    );
  // Official repositories alternate between a subdivision alone and the
  // same subdivision qualified by its sovereign jurisdiction. Only a known
  // broad-jurisdiction suffix establishes that hierarchy; arbitrary token
  // containment (for example, country names that are also subdivisions) does
  // not.
  return isKnownHierarchy(leftNormalized, rightNormalized) ||
    isKnownHierarchy(rightNormalized, leftNormalized);
}

function normalizedIssuerTokens(
  value: string | null | undefined,
  jurisdiction?: string | null,
) {
  const canonical = canonicalIssuingJurisdiction(jurisdiction);
  const jurisdictionTokens = new Set(
    tokenizeScreen02DiscoveryText(canonical ?? ""),
  );
  const aliasGroup = ISSUING_JURISDICTION_ALIAS_GROUPS.find((aliases) =>
    canonical === aliases[0]
  );
  for (const alias of aliasGroup ?? []) {
    tokenizeScreen02DiscoveryText(alias).forEach((token) =>
      jurisdictionTokens.add(token)
    );
  }
  // "United States" in a jurisdiction and "State of California" in an
  // issuer use plural/singular variants of the same jurisdiction qualifier.
  for (const token of [...jurisdictionTokens]) {
    if (token.length > 3 && token.endsWith("s")) {
      jurisdictionTokens.add(token.slice(0, -1));
    }
  }
  const normalizedIssuer = normalizeScreen02DiscoveryText(value ?? "");
  const normalizedJurisdiction = canonical ?? "";
  const localJurisdictions = [normalizedJurisdiction];
  for (const aliases of ISSUING_JURISDICTION_ALIAS_GROUPS) {
    for (const broader of aliases) {
      const suffix = ` ${broader}`;
      if (normalizedJurisdiction.endsWith(suffix)) {
        localJurisdictions.push(normalizedJurisdiction.slice(0, -suffix.length));
      }
    }
  }
  if (
    normalizedJurisdiction &&
    localJurisdictions.some((localJurisdiction) =>
      normalizedIssuer.includes(`state of ${localJurisdiction}`) ||
      normalizedIssuer.includes(`${localJurisdiction} state`) ||
      normalizedIssuer.includes(`state ${localJurisdiction}`)
    )
  ) {
    jurisdictionTokens.add("state");
  }
  // Keep source order for acronym comparison ("EC" ↔ "European
  // Commission"). Set-style equality is handled separately below.
  const originalTokens = [...new Set(
    tokenizeScreen02DiscoveryText(value ?? "")
      .map((token) => token === "dept" ? "department" : token),
  )];
  const strippedTokens = originalTokens.filter((token) =>
    !jurisdictionTokens.has(token)
  );
  const tokens = strippedTokens.length > 0 ? strippedTokens : originalTokens;
  return tokens.length > 0 ? tokens : null;
}

function compatibleIssuers(
  left: string | null | undefined,
  right: string | null | undefined,
  leftJurisdiction?: string | null,
  rightJurisdiction?: string | null,
) {
  const leftTokens = normalizedIssuerTokens(left, leftJurisdiction);
  const rightTokens = normalizedIssuerTokens(right, rightJurisdiction);
  if (!leftTokens || !rightTokens) return true;
  if (
    uniqueSorted(leftTokens).join("\u001f") ===
      uniqueSorted(rightTokens).join("\u001f")
  ) return true;
  const lowercaseIssuerAcronymMatches = (
    rawCompact: string | null | undefined,
    compact: readonly string[],
    expanded: readonly string[],
  ) => {
    const raw = String(rawCompact ?? "").normalize("NFKC").trim();
    if (compact.length !== 1 || !/^[a-z]{2,5}$/u.test(raw)) return false;
    const insignificant = new Set(["and", "for", "of", "the"]);
    const significant = expanded.filter((token) => !insignificant.has(token));
    const issuingBodySuffixes = new Set([
      "administration",
      "agency",
      "authority",
      "board",
      "bureau",
      "commission",
      "council",
      "department",
      "directorate",
      "ministry",
    ]);
    return significant.length >= 2 &&
      issuingBodySuffixes.has(significant.at(-1)!) &&
      significant.map((token) => token[0]).join("") === compact[0];
  };
  if (
    lowercaseIssuerAcronymMatches(left, leftTokens, rightTokens) ||
    lowercaseIssuerAcronymMatches(right, rightTokens, leftTokens)
  ) return true;

  const sequenceMatchesAcronyms = (
    compact: readonly string[],
    expanded: readonly string[],
    allowedAcronyms: ReadonlySet<string>,
    compactIndex = 0,
    expandedIndex = 0,
  ): boolean => {
    if (compactIndex === compact.length || expandedIndex === expanded.length) {
      return compactIndex === compact.length && expandedIndex === expanded.length;
    }
    const compactToken = compact[compactIndex]!;
    if (compactToken === expanded[expandedIndex]) {
      return sequenceMatchesAcronyms(
        compact,
        expanded,
        allowedAcronyms,
        compactIndex + 1,
        expandedIndex + 1,
      );
    }
    // Only a visibly compact all-letter token may abbreviate two or more
    // consecutive words. Matching the remaining sequence prevents a loose
    // acronym from collapsing different issuing bodies.
    if (!allowedAcronyms.has(compactToken)) return false;
    let initials = "";
    for (
      let end = expandedIndex;
      end < expanded.length && initials.length < compactToken.length;
      end += 1
    ) {
      initials += expanded[end]![0];
      if (
        end > expandedIndex &&
        initials === compactToken &&
        sequenceMatchesAcronyms(
          compact,
          expanded,
          allowedAcronyms,
          compactIndex + 1,
          end + 1,
        )
      ) return true;
    }
    return false;
  };

  const leftOriginalTokens = normalizedIssuerTokens(left);
  const rightOriginalTokens = normalizedIssuerTokens(right);
  const visibleAcronyms = (value: string | null | undefined) => new Set(
    [...String(value ?? "").normalize("NFKC").matchAll(
      /(?<!\p{L})((?:[A-Z]\.){2,8}|[A-Z]{2,8})(?!\p{L})/gu,
    )].map((match) => normalizeScreen02DiscoveryText(match[1]!)),
  );
  const leftAcronyms = visibleAcronyms(left);
  const rightAcronyms = visibleAcronyms(right);
  return sequenceMatchesAcronyms(leftTokens, rightTokens, leftAcronyms) ||
    sequenceMatchesAcronyms(rightTokens, leftTokens, rightAcronyms) ||
    Boolean(
      leftOriginalTokens && rightOriginalTokens &&
      (
        sequenceMatchesAcronyms(
          leftOriginalTokens,
          rightOriginalTokens,
          leftAcronyms,
        ) ||
        sequenceMatchesAcronyms(
          rightOriginalTokens,
          leftOriginalTokens,
          rightAcronyms,
        )
      ),
    );
}

function hasConflictingKnownIssuer(
  left: string | null | undefined,
  right: string | null | undefined,
  leftJurisdiction?: string | null,
  rightJurisdiction?: string | null,
) {
  return Boolean(
    normalizedIssuerTokens(left, leftJurisdiction) &&
    normalizedIssuerTokens(right, rightJurisdiction) &&
    !compatibleIssuers(
      left,
      right,
      leftJurisdiction,
      rightJurisdiction,
    ),
  );
}

export function isIndependentlyScopedScreen02FormalIdentifier(
  value: string | null | undefined,
) {
  return formalIdentifierIsIndependentlyScoped(value);
}

function concreteTreatmentTimingFacts(
  proposal: Extract<Screen02Proposal, { mode: "find" }>,
) {
  const isoDate = /\b(?:18|19|20|21)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\b/gu;
  const kindForClause = (value: string) => {
    const normalized = normalizeScreen02DiscoveryText(value);
    if (/\b(?:phase|treatment)\b/u.test(normalized)) return "phase";
    if (/\b(?:incident ended|hazard end\w*)\b/u.test(normalized)) {
      return "hazard-end";
    }
    if (/\b(?:sunset|expir\w*)\b/u.test(normalized)) return "cessation";
    if (/\bdeclar\w*\b/u.test(normalized)) return "declaration";
    if (
      /\b(?:incident began|incident start\w*|onset|landfall|gdacs event start|usgs event date)\b/u
        .test(normalized)
    ) return "hazard-onset";
    if (/\benforc\w*\b/u.test(normalized)) return "enforcement-start";
    if (/\bcompliance\b/u.test(normalized)) return "compliance-deadline";
    if (/\bdeadline\b/u.test(normalized)) {
      return /\b(?:application|comment|response|submission)\b/u.test(normalized)
        ? null
        : "compliance-deadline";
    }
    if (/\bimplement\w*\b/u.test(normalized)) return "implementation-start";
    if (/\b(?:applicab\w*|eligib\w*)\b/u.test(normalized)) {
      return "applicability";
    }
    if (
      /\b(?:came into force|come\w* into force|commenc\w*|effective|enter\w* into force|entry into force|in force|operative|take\w* effect|took effect)\b/u
        .test(normalized)
    ) {
      return "operative-start";
    }
    return null;
  };
  const isDocumentaryDateClause = (value: string) =>
    /\b(?:catalog(?:ue)? date|document date|issu(?:ed|ance)|publish(?:ed|ing)?|publication)\b/iu
      .test(value);
  const splitLocallyLabeledDates = (clause: string) => {
    const parts = clause
      .split(/\s*(?:,|\b(?:and|but|whereas|while)\b)\s*/iu)
      .filter(Boolean);
    return parts.length > 1 && parts.every((part) =>
      new RegExp(isoDate.source, "u").test(part) &&
      (kindForClause(part) !== null || isDocumentaryDateClause(part))
    ) ? parts : [clause];
  };
  return uniqueSorted(
    [proposal.event.eventDate, ...proposal.provisionalDates]
      .flatMap((value) => value.split(/\s*(?:;|\n)\s*/u))
      .flatMap(splitLocallyLabeledDates)
      .flatMap((clause) => {
        const kind = kindForClause(clause);
        if (!kind) return [];
        return [...clause.matchAll(isoDate)]
          .map((match) => `${kind}:${match[0]}`);
      }),
  );
}

const SCREEN02_CATEGORICAL_CONTRASTS = [
  ["public", "private"],
  ["domestic", "foreign"],
  ["urban", "rural"],
  ["large", "small"],
  ["listed", "unlisted"],
  ["incorporated", "unincorporated"],
  ["employee", "contractor"],
  ["mandatory", "voluntary"],
  ["profit", "nonprofit"],
] as const;

const SCREEN02_CATEGORICAL_QUALIFIERS = new Set<string>(
  SCREEN02_CATEGORICAL_CONTRASTS.flat(),
);

function concreteAssignmentFacts(
  proposal: Extract<Screen02Proposal, { mode: "find" }>,
) {
  const values = [proposal.affectedPopulation, ...proposal.event.populations]
    .flatMap((value) => value.split(/\s*(?:;|\n)\s*/u))
    .flatMap((value) =>
      /\b(?:not established|not specified|unknown|unverified)\b/iu.test(value)
        ? value.split(/\s*(?:,|\b(?:and|but|whereas|while)\b)\s*/iu)
        : [value]
    )
    .filter((value) =>
      !/\b(?:not established|not specified|unknown|unverified)\b/iu.test(value)
    );
  const genericPopulationTokens = new Set([
    "affected", "applicable", "applicant", "applicants", "applies",
    "business", "businesses", "company", "companies", "covered", "covers",
    "entities", "entity", "establishment", "establishments", "firm", "firms",
    "individual", "individuals", "operator", "operators", "organization",
    "organizations", "participant", "participants", "people", "person",
    "population", "regulated", "requirements", "subject", "include",
    "included", "including", "exclude", "excluded", "excluding",
    "exempt", "exempted", "not", "no", "above", "at", "below",
    "billion", "bn", "dollar", "dollars", "equal", "equals", "eur",
    "euro", "euros", "exactly", "fewer", "gbp", "greater", "least",
    "less", "maximum", "minimum", "million", "more", "over", "percent",
    "pound", "pounds", "than", "threshold", "thousand", "tier", "under",
    "usd", "eligible", "eligibility", "ineligible", "longer",
    "neither", "none", "nor", "outside", "scope",
  ]);
  const quantitativeModifiers = new Set([
    ...SCREEN02_CATEGORICAL_QUALIFIERS,
    "aggregate", "annual", "average", "daily", "monthly", "overall",
    "total", "weekly", "yearly",
  ]);
  const singularSubjectToken = (token: string) =>
    token.length > 4 && token.endsWith("s") ? token.slice(0, -1) : token;
  const subjectTokens = (value: string) => uniqueSorted(
    tokenizeScreen02DiscoveryText(value)
      .filter((token) =>
        !genericPopulationTokens.has(token) &&
        !/^\d[\d,.]*$/u.test(token)
      )
      .map(singularSubjectToken),
  );
  const rangeConjunctionPlaceholder = "\uE000";
  const splitNumericClauses = (value: string) => value
    .replace(
      /(\bbetween\s+(?:(?:[A-Z]{3}|[$€£])\s*)?\d[\d,.]*(?:\s*(?:%|percent|billion|bn|million|thousand|[mbk]))?)\s+and(?=\s+(?:(?:[A-Z]{3}|[$€£])\s*)?\d)/giu,
      `$1 ${rangeConjunctionPlaceholder}`,
    )
    .split(/\s*(?:;|,(?!\d{3}\b)|\band\b|\bwhereas\b|\bwhile\b)\s*/iu)
    .map((clause) => clause.replaceAll(rangeConjunctionPlaceholder, "and"));
  const numeric = uniqueSorted(values.flatMap((value) => {
    // Bind each threshold to its local clause. This keeps a shared revenue
    // rule from masking a changed employee threshold elsewhere in the same
    // population description. Preserve the conjunction inside a bounded
    // range so both endpoints stay attached to the same metric.
    return splitNumericClauses(value)
      .flatMap((clause) => {
        const normalized = normalizeScreen02DiscoveryText(clause);
        const quantitativeSignal =
          /(?:[$€£%]|\b(?:above|at least|at most|below|between|billion|bn|dollars?|equal(?:s|led)?|euros?|exactly|exceed\w*|fewer than|gbp|greater than|less than|maximum|minimum|million|more than|no fewer than|no less than|no more than|not fewer than|not more than|not greater than|not less than|or fewer|or more|over|percent|pounds?|threshold|thousand|tier|under|up to|usd|eur)\b|\b[A-Z]{3}\s*\d)/u;
        const bareCountSignal =
          /\b\d[\d,.]*\s+(?:beds?|employees?|facilities|facility|locations?|people|persons?|sites?|staff(?:\s+members?)?|vehicles?|workers?)\b/iu;
        if (
          !quantitativeSignal.test(clause) &&
          !bareCountSignal.test(clause)
        ) return [];
        const defaultDirection = /\b(?:at most|less than or equal to|maximum|no greater than|no more than|not greater than|not more than|or fewer|up to)\b/u
            .test(normalized)
          ? "inclusive-upper"
          : /\b(?:at least|greater than or equal to|minimum|no fewer than|no less than|not fewer than|not less than|or more)\b/u.test(normalized)
            ? "inclusive-lower"
            : /\b(?:above|exceed\w*|greater than|more than|over)\b/u
                .test(normalized)
              ? "strict-lower"
              : /\b(?:below|fewer than|less than|under)\b/u
                  .test(normalized)
                ? "strict-upper"
                : /\b(?:equal(?:s|led)?|exactly|threshold|tier)\b/u.test(normalized)
                  ? "exact"
                  : bareCountSignal.test(clause)
                    ? "exact"
                    : "unspecified";
        // Preserve any visibly encoded three-letter unit/currency namespace
        // immediately attached to a number. A fixed ISO allowlist would make
        // unfamiliar-country thresholds silently collide with USD or an
        // unspecified unit; semantic interpretation is deliberately deferred.
        const currencyCode = /\b([A-Z]{3})\s*(?=\d)/u
          .exec(clause)?.[1].toLowerCase() ??
          /\b(?:eur|gbp|usd)\b/iu.exec(clause)?.[0].toLowerCase();
        const currency = currencyCode ?? (
          /[$]|\bdollars?\b/iu.test(clause)
            ? "usd"
            : /€|\beuros?\b/iu.test(clause)
              ? "eur"
              : /£|\bpounds?\b/iu.test(clause)
                ? "gbp"
                : "none"
        );
        const numberMatches = [...clause.matchAll(
          /(?:(?:[A-Z]{3}|[$€£])\s*)?(\d[\d,.]*)(?:\s*(%|percent|billion|bn|million|thousand|[mbk]))?/giu,
        )];
        const boundedRange =
          /\bbetween\s+(?:(?:[A-Z]{3}|[$€£])\s*)?\d[\d,.]*(?:\s*(?:%|percent|billion|bn|million|thousand|[mbk]))?\s+and\s+(?:(?:[A-Z]{3}|[$€£])\s*)?\d[\d,.]*(?:\s*(?:%|percent|billion|bn|million|thousand|[mbk]))?/iu
            .exec(clause);
        const rangeNumbers = boundedRange
          ? numberMatches.filter((match) =>
            (match.index ?? -1) >= (boundedRange.index ?? 0) &&
            (match.index ?? -1) <
              (boundedRange.index ?? 0) + boundedRange[0].length
          )
          : [];
        const inheritedRangeUnit = rangeNumbers
          .map((match) => (match[2] ?? "none").toLowerCase())
          .find((unit) => unit !== "none");
        return numberMatches.flatMap((match) => {
          const direction = match === rangeNumbers[0]
            ? "inclusive-lower"
            : match === rangeNumbers[1]
              ? "inclusive-upper"
              : defaultDirection;
          const number = match[1]!.replaceAll(",", "");
          const rawUnit = (match[2] ?? inheritedRangeUnit ?? "none")
            .toLowerCase();
          const unit = rawUnit === "%" || rawUnit === "percent"
            ? "percent"
            : rawUnit === "bn" || rawUnit === "b"
              ? "billion"
              : rawUnit === "m"
                ? "million"
                : rawUnit === "k"
                  ? "thousand"
              : rawUnit;
          const precedingText = normalizeScreen02DiscoveryText(
            clause.slice(0, match.index ?? 0),
          );
          if (/\b(?:fortune|naics)\s*$/u.test(precedingText)) return [];
          if (
            currency === "none" &&
            unit === "none" &&
            /^(?:18|19|20|21)\d{2}$/u.test(number)
          ) return [];
          const scale = unit === "billion"
            ? 1_000_000_000
            : unit === "million"
              ? 1_000_000
              : unit === "thousand"
                ? 1_000
                : 1;
          const parsedNumber = Number(number);
          const scaledNumber = scale > 1 && Number.isFinite(parsedNumber)
            ? String(parsedNumber * scale)
            : number;
          const canonicalUnit = unit === "percent" ? "percent" : "count";
          const metricTokens = (text: string) =>
            tokenizeScreen02DiscoveryText(text)
              .filter((token) =>
                !genericPopulationTokens.has(token) &&
                !quantitativeModifiers.has(token) &&
                !/^(?:exceed\w*|worldwide|nationwide)$/u.test(token) &&
                !/^\d[\d,.]*$/u.test(token)
              )
              .map(singularSubjectToken);
          const afterWindow = clause.slice((match.index ?? 0) + match[0].length)
            .split(
              /\b(?:among|applicab\w*|appl(?:y|ies|ying)|for|that|where|which|who|whose|within|across)\b|[,;]/iu,
              1,
            )[0] ?? "";
          const afterTokens = metricTokens(afterWindow);
          const beforeTokens = metricTokens(clause.slice(0, match.index ?? 0));
          const metricHead = afterTokens[0] ?? beforeTokens.at(-1) ??
            "unspecified";
          return [
            `${direction}|${currency}:${scaledNumber}:${canonicalUnit}|${metricHead}`,
          ];
        });
      });
  }));
  const categorical = uniqueSorted(values.flatMap((value) =>
    tokenizeScreen02DiscoveryText(value)
      .filter((token) => !genericPopulationTokens.has(token))
      .map(singularSubjectToken)
  ));
  const explicitCategorical = uniqueSorted(values.flatMap((value) =>
    [...normalizeScreen02DiscoveryText(value).matchAll(
      /\b(category|class|group|tier) ([\p{L}\p{N}]+)\b/gu,
    )].map((match) => `${match[1]}:${match[2]}`)
  ));
  const explicitStatus = (value: string): "included" | "excluded" | null => {
    const normalized = normalizeScreen02DiscoveryText(value);
    // Do not turn a negated negative ("not exempt") into positive evidence.
    if (/\bnot (?:excluded|exempt(?:ed)?)\b/u.test(normalized)) return null;
    if (
      /\b(?:(?:arent|didnt|doesnt|dont|isnt|wasnt|werent) (?:applicab\w*|appl(?:y|ies|ied)|cover\w*|eligib\w*|includ\w*|subject to)|does not (?:apply|cover|include)|ineligib\w*|never (?:be )?(?:applicab\w*|appl(?:y|ies|ied)|cover\w*|eligib\w*|includ\w*|subject to)|no longer (?:be )?(?:applicab\w*|appl(?:y|ies|ied)|cover\w*|eligib\w*|includ\w*|subject to)|no (?!fewer|greater|less|more)\w+(?: \w+){0,4} (?:are |is )?(?:applicab\w*|cover\w*|eligib\w*|includ\w*|subject to)|none of (?:the )?\w+(?: \w+){0,4} (?:are |is )?(?:applicab\w*|cover\w*|eligib\w*|includ\w*|subject to)|neither \w+(?: \w+){0,4} nor \w+(?: \w+){0,4} (?:are |is )?(?:applicab\w*|cover\w*|eligib\w*|includ\w*|subject to)|non covered|not (?:be )?(?:applicab\w*|appl(?:y|ies|ied)|cover\w*|eligib\w*|includ\w*|subject to)|outside (?:the )?scope|exclud\w*|exempt\w*)\b/u
        .test(normalized)
    ) {
      return "excluded";
    }
    return /\b(?:appl(?:y|ies)|applicab\w*|cover\w*|eligib\w*|includ\w*|subject to)\b/u
        .test(normalized)
      ? "included"
      : null;
  };
  const statusClauses = (value: string) => {
    const exception = /^(.*?)\b(?:but not|except|other than|excluding)\b(.*)$/iu.exec(
      value,
    );
    if (exception && exception[1]?.trim() && exception[2]?.trim()) {
      const base = explicitStatus(exception[1])
        ? exception[1]
        : `${exception[1]} included`;
      return [base, `${exception[2]} excluded`];
    }
    const parts = value
      .split(/\s*(?:,|\b(?:and|but|whereas|while)\b)\s*/iu)
      .filter(Boolean);
    return parts.length > 1 && parts.every((part) => explicitStatus(part))
      ? parts
      : [value];
  };
  const status = uniqueSorted(values.flatMap(statusClauses)
    .map(explicitStatus)
    .filter((value): value is "included" | "excluded" => value !== null));
  const scopedStatus = uniqueSorted(values.flatMap(statusClauses)
    .flatMap((clause) => {
      const state = explicitStatus(clause);
      if (!state) return [];
      const subjects = subjectTokens(clause).filter((token) =>
        !quantitativeModifiers.has(token)
      );
      return subjects.length > 0 ? [`${state}|${subjects.join(",")}`] : [];
    }));
  const hasGenericCoveredUnit = (value: string) =>
    /\b(?:business(?:es)?|companies|company|entities|entity|firms?|individuals?|operators?|organizations?|people|persons?)\b/iu.test(value);
  const scopedCategorical = uniqueSorted(values.flatMap((value) => {
    const parts = value
      .split(/\s*(?:,|\/|\b(?:and|but|whereas|while)\b)\s*/iu)
      .filter(Boolean);
    const clauses = parts.length > 1 && parts.every((part) =>
      (
        subjectTokens(part).some((token) =>
          !SCREEN02_CATEGORICAL_QUALIFIERS.has(token)
        ) || hasGenericCoveredUnit(part)
      ) &&
      subjectTokens(part).some((token) => SCREEN02_CATEGORICAL_QUALIFIERS.has(token))
    ) ? parts : [value];
    return clauses.flatMap((clause) => {
      const tokens = subjectTokens(clause);
      const qualifiers = tokens.filter((token) =>
        SCREEN02_CATEGORICAL_QUALIFIERS.has(token)
      );
      const concreteSubjects = tokens.filter((token) =>
        !SCREEN02_CATEGORICAL_QUALIFIERS.has(token)
      );
      const subjects = concreteSubjects.length > 0
        ? concreteSubjects
        : qualifiers.length > 0 && hasGenericCoveredUnit(clause)
          ? ["covered-unit"]
          : [];
      return qualifiers.flatMap((qualifier) =>
        subjects.length > 0 ? [`${qualifier}|${subjects.join(",")}`] : []
      );
    });
  }));
  return {
    numeric: uniqueSorted(numeric),
    categorical,
    explicitCategorical,
    status,
    scopedStatus,
    scopedCategorical,
  };
}

function factsAreDisjoint(left: readonly string[], right: readonly string[]) {
  return left.length > 0 &&
    right.length > 0 &&
    !left.some((fact) => right.includes(fact));
}

function timingFactsConflict(
  left: readonly string[],
  right: readonly string[],
) {
  const kinds = uniqueSorted([
    ...left.map((fact) => fact.split(":", 1)[0]!),
    ...right.map((fact) => fact.split(":", 1)[0]!),
  ]);
  return kinds.some((kind) => {
    const leftDates = left
      .filter((fact) => fact.startsWith(`${kind}:`))
      .map((fact) => fact.slice(kind.length + 1));
    const rightDates = right
      .filter((fact) => fact.startsWith(`${kind}:`))
      .map((fact) => fact.slice(kind.length + 1));
    if (leftDates.length === 0 || rightDates.length === 0) return false;
    const leftSubset = leftDates.every((date) => rightDates.includes(date));
    const rightSubset = rightDates.every((date) => leftDates.includes(date));
    return !leftSubset && !rightSubset;
  });
}

function numericAssignmentFactsConflict(
  left: readonly string[],
  right: readonly string[],
) {
  const parse = (fact: string) => {
    const [direction = "unspecified", value = "", measures = "unspecified"] =
      fact.split("|");
    const [currency = "none", number = "", unit = "count"] =
      value.split(":");
    return {
      direction,
      currency,
      number,
      unit,
      measures: measures.split(","),
    };
  };
  const leftFacts = left.map(parse);
  const rightFacts = right.map(parse);
  const commonMeasures = uniqueSorted(leftFacts.flatMap((leftFact) =>
    rightFacts.flatMap((rightFact) =>
      leftFact.measures.includes("unspecified") &&
        rightFact.measures.includes("unspecified")
        ? ["*"]
        : leftFact.measures.includes("unspecified") ||
            rightFact.measures.includes("unspecified")
          ? []
          : leftFact.measures.filter((measure) =>
            rightFact.measures.includes(measure)
          )
    )
  ));
  const compatible = (
    leftFact: ReturnType<typeof parse>,
    rightFact: ReturnType<typeof parse>,
  ) => leftFact.number === rightFact.number &&
    leftFact.unit === rightFact.unit &&
    (
      leftFact.currency === rightFact.currency ||
      leftFact.currency === "none" ||
      rightFact.currency === "none"
    ) &&
    (
      leftFact.direction === rightFact.direction ||
      leftFact.direction === "unspecified" ||
      rightFact.direction === "unspecified"
    );
  return commonMeasures.some((measure) => {
    const inGroup = (fact: ReturnType<typeof parse>) =>
      measure === "*" ||
      fact.measures.includes("unspecified") ||
      fact.measures.includes(measure);
    const leftGroup = leftFacts.filter(inGroup);
    const rightGroup = rightFacts.filter(inGroup);
    const leftIsCompatibleSubset = leftGroup.every((leftFact) =>
      rightGroup.some((rightFact) => compatible(leftFact, rightFact))
    );
    const rightIsCompatibleSubset = rightGroup.every((rightFact) =>
      leftGroup.some((leftFact) => compatible(leftFact, rightFact))
    );
    // A richer source may add a threshold already absent from a sparse copy.
    // Two non-nested fact sets, however, encode a changed assignment.
    return !leftIsCompatibleSubset && !rightIsCompatibleSubset;
  });
}

function scopedStatusFactsConflict(
  left: readonly string[],
  right: readonly string[],
) {
  if (
    left.every((fact) => right.includes(fact)) ||
    right.every((fact) => left.includes(fact))
  ) return false;
  const parse = (fact: string) => {
    const [status = "", subjects = ""] = fact.split("|");
    return { status, subjects: subjects.split(",").filter(Boolean) };
  };
  const leftFacts = left.map(parse);
  const rightFacts = right.map(parse);
  const substantiveSubjects = (subjects: readonly string[]) => {
    const substantive = subjects.filter((subject) =>
      !SCREEN02_CATEGORICAL_QUALIFIERS.has(subject)
    );
    return substantive.length > 0 ? substantive : [...subjects];
  };
  const subjectsOverlap = (
    leftSubjects: readonly string[],
    rightSubjects: readonly string[],
  ) => substantiveSubjects(leftSubjects).some((subject) =>
    substantiveSubjects(rightSubjects).includes(subject)
  );
  if (leftFacts.some((leftFact) =>
    rightFacts.some((rightFact) =>
      subjectsOverlap(leftFact.subjects, rightFact.subjects) &&
      leftFact.status !== rightFact.status
    )
  )) return true;
  return ["included", "excluded"].some((status) => {
    const leftSubjects = uniqueSorted(leftFacts
      .filter((fact) => fact.status === status)
      .flatMap((fact) => substantiveSubjects(fact.subjects)));
    const rightSubjects = uniqueSorted(rightFacts
      .filter((fact) => fact.status === status)
      .flatMap((fact) => substantiveSubjects(fact.subjects)));
    if (leftSubjects.length === 0 || rightSubjects.length === 0) return false;
    const overlap = leftSubjects.some((subject) =>
      rightSubjects.includes(subject)
    );
    if (!overlap) return false;
    const leftSubset = leftSubjects.every((subject) =>
      rightSubjects.includes(subject)
    );
    const rightSubset = rightSubjects.every((subject) =>
      leftSubjects.includes(subject)
    );
    return !leftSubset && !rightSubset;
  });
}

function scopedCategoricalFactsConflict(
  left: readonly string[],
  right: readonly string[],
) {
  const parse = (fact: string) => {
    const [qualifier = "", subjects = ""] = fact.split("|");
    return { qualifier, subjects: subjects.split(",").filter(Boolean) };
  };
  const leftFacts = left.map(parse);
  const rightFacts = right.map(parse);
  const subjects = uniqueSorted([
    ...leftFacts.flatMap((fact) => fact.subjects),
    ...rightFacts.flatMap((fact) => fact.subjects),
  ]);
  if (SCREEN02_CATEGORICAL_CONTRASTS.some(([first, second]) =>
    subjects.some((subject) => {
      const leftQualifiers = uniqueSorted(leftFacts
        .filter((fact) => fact.subjects.includes(subject))
        .map((fact) => fact.qualifier)
        .filter((qualifier) => qualifier === first || qualifier === second));
      const rightQualifiers = uniqueSorted(rightFacts
        .filter((fact) => fact.subjects.includes(subject))
        .map((fact) => fact.qualifier)
        .filter((qualifier) => qualifier === first || qualifier === second));
      if (leftQualifiers.length === 0 || rightQualifiers.length === 0) {
        return false;
      }
      return !leftQualifiers.every((qualifier) =>
        rightQualifiers.includes(qualifier)
      ) && !rightQualifiers.every((qualifier) =>
        leftQualifiers.includes(qualifier)
      );
    })
  )) return true;
  return [...SCREEN02_CATEGORICAL_QUALIFIERS].some((qualifier) => {
    const leftSubjects = uniqueSorted(leftFacts
      .filter((fact) => fact.qualifier === qualifier)
      .flatMap((fact) => fact.subjects));
    const rightSubjects = uniqueSorted(rightFacts
      .filter((fact) => fact.qualifier === qualifier)
      .flatMap((fact) => fact.subjects));
    if (leftSubjects.length === 0 || rightSubjects.length === 0) return false;
    const overlap = leftSubjects.some((subject) =>
      rightSubjects.includes(subject)
    );
    if (!overlap) return false;
    return !leftSubjects.every((subject) => rightSubjects.includes(subject)) &&
      !rightSubjects.every((subject) => leftSubjects.includes(subject));
  });
}

type TreatmentLifecycleStage = "proposal" | "final" | "amendment" | "retired";

function treatmentLifecycleStage(
  proposal: Extract<Screen02Proposal, { mode: "find" }>,
): TreatmentLifecycleStage | null {
  const status = normalizeScreen02DiscoveryText(
    proposal.nativeIdentity?.status ?? "",
  );
  const text = normalizeScreen02DiscoveryText([
    status,
    proposal.title,
    proposal.event.displayName,
  ].join(" "));
  if (/\b(?:draft|pending|proposal|proposed|prorule)\b/u.test(text)) {
    return "proposal";
  }
  if (/\b(?:amend\w*|recast|revis(?:ed|ion)|replacement)\b/u.test(text)) {
    return "amendment";
  }
  if (/\b(?:repeal\w*|supersed\w*|withdrawn)\b/u.test(text)) return "retired";
  // Federal Register `RULE` is a final-rule document type even when its title
  // does not repeat the word "final". Keep this exact status narrow so a
  // generic mention of rulemaking is not promoted to finality.
  if (/^(?:regulation|rule)$/u.test(status)) return "final";
  if (/\b(?:adopted|enacted|effective|final|in force|promulgated)\b/u.test(text)) {
    return "final";
  }
  return null;
}

function isProposalFinalSequence(
  left: Extract<Screen02Proposal, { mode: "find" }>,
  right: Extract<Screen02Proposal, { mode: "find" }>,
) {
  const stages = new Set([
    treatmentLifecycleStage(left),
    treatmentLifecycleStage(right),
  ]);
  return stages.has("proposal") && stages.has("final");
}

export function screen02TreatmentAssignmentSignature(
  proposal: Screen02Proposal,
) {
  if (proposal.mode !== "find") return null;
  const timing = concreteTreatmentTimingFacts(proposal);
  const assignment = concreteAssignmentFacts(proposal);
  if (
    timing.length === 0 &&
    assignment.numeric.length === 0 &&
    assignment.categorical.length === 0 &&
    assignment.explicitCategorical.length === 0 &&
    assignment.status.length === 0 &&
    assignment.scopedStatus.length === 0 &&
    assignment.scopedCategorical.length === 0
  ) return null;
  return [
    `timing=${timing.join(",")}`,
    `numeric=${assignment.numeric.join(",")}`,
    `categorical=${assignment.categorical.join(",")}`,
    `explicit-categorical=${assignment.explicitCategorical.join(",")}`,
    `status=${assignment.status.join(",")}`,
    `scoped-status=${assignment.scopedStatus.join(",")}`,
    `scoped-categorical=${assignment.scopedCategorical.join(",")}`,
  ].join(";");
}

function materiallyDistinctTreatmentVersion(
  left: Extract<Screen02Proposal, { mode: "find" }>,
  right: Extract<Screen02Proposal, { mode: "find" }>,
) {
  const leftTiming = concreteTreatmentTimingFacts(left);
  const rightTiming = concreteTreatmentTimingFacts(right);
  if (timingFactsConflict(leftTiming, rightTiming)) return true;

  const leftAssignment = concreteAssignmentFacts(left);
  const rightAssignment = concreteAssignmentFacts(right);
  if (numericAssignmentFactsConflict(
    leftAssignment.numeric,
    rightAssignment.numeric,
  )) {
    return true;
  }
  if (scopedStatusFactsConflict(
    leftAssignment.scopedStatus,
    rightAssignment.scopedStatus,
  )) return true;
  if (scopedCategoricalFactsConflict(
    leftAssignment.scopedCategorical,
    rightAssignment.scopedCategorical,
  )) return true;
  if (
    leftAssignment.scopedStatus.length === 0 &&
    rightAssignment.scopedStatus.length === 0 &&
    factsAreDisjoint(leftAssignment.status, rightAssignment.status)
  ) return true;
  return factsAreDisjoint(
    leftAssignment.explicitCategorical,
    rightAssignment.explicitCategorical,
  );
}

function separatelyNumberedFederalAdministrativeRecords(
  left: Extract<Screen02Proposal, { mode: "find" }>,
  right: Extract<Screen02Proposal, { mode: "find" }>,
  leftIdentifier: string,
  rightIdentifier: string,
) {
  if (
    !leftIdentifier.startsWith("federal register ") ||
    !rightIdentifier.startsWith("federal register ")
  ) return false;
  const leftStatus = normalizeScreen02DiscoveryText(
    left.nativeIdentity?.status ?? "",
  );
  const rightStatus = normalizeScreen02DiscoveryText(
    right.nativeIdentity?.status ?? "",
  );
  const administrativeRecord =
    /\b(?:administrative|governance|meeting|nonbinding|notice|recruit\w*)\b/u;
  return administrativeRecord.test(leftStatus) &&
    administrativeRecord.test(rightStatus) &&
    !isProposalFinalSequence(left, right);
}

function conflictingFormalTreatmentVersions(
  left: Screen02Proposal,
  right: Screen02Proposal,
) {
  if (left.mode !== "find" || right.mode !== "find") return false;
  if (materiallyDistinctTreatmentVersion(left, right)) return true;
  const leftIdentifier = normalizedFormalIdentifier(
    left.nativeIdentity?.formalIdentifier,
    left,
  );
  const rightIdentifier = normalizedFormalIdentifier(
    right.nativeIdentity?.formalIdentifier,
    right,
  );
  if (!leftIdentifier || !rightIdentifier) {
    return false;
  }
  const identifierRelation = proposalFormalIdentifierRelation(
    left.nativeIdentity?.formalIdentifier,
    left,
    right.nativeIdentity?.formalIdentifier,
    right,
  );
  if (identifierRelation === "conflict") return true;
  if (
    identifierRelation === "equivalent" ||
    identifierRelation === "compatible-partial"
  ) {
    return !compatibleIssuingJurisdictions(
      left.nativeIdentity?.issuingJurisdiction,
      right.nativeIdentity?.issuingJurisdiction,
    ) || hasConflictingKnownIssuer(
      left.nativeIdentity?.issuer,
      right.nativeIdentity?.issuer,
      left.nativeIdentity?.issuingJurisdiction,
      right.nativeIdentity?.issuingJurisdiction,
    );
  }
  const jurisdictionsConflict = !compatibleIssuingJurisdictions(
    left.nativeIdentity?.issuingJurisdiction,
    right.nativeIdentity?.issuingJurisdiction,
  );
  const issuersConflict = hasConflictingKnownIssuer(
    left.nativeIdentity?.issuer,
    right.nativeIdentity?.issuer,
    left.nativeIdentity?.issuingJurisdiction,
    right.nativeIdentity?.issuingJurisdiction,
  );
  if (jurisdictionsConflict || issuersConflict) return true;
  const leftStage = treatmentLifecycleStage(left);
  const rightStage = treatmentLifecycleStage(right);
  const stripCopySuffix = (identifier: string) => identifier.replace(
    / (?:corr|corrected|correction|corrigendum|technical correction)$/u,
    "",
  );
  const relatedCopy = stripCopySuffix(leftIdentifier) ===
    stripCopySuffix(rightIdentifier);
  if (isProposalFinalSequence(left, right) && !relatedCopy) {
    // A proposal and a later final action are distinct source records and
    // potentially distinct events. Shared titles do not establish that the
    // final adopted the proposal unchanged, so do not union their sources or
    // lifecycle facts without an explicit same-identity/correction relation.
    return true;
  }
  if (leftStage !== null && leftStage === rightStage && !relatedCopy) {
    return true;
  }
  const bothStagesUnknown = leftStage === null && rightStage === null;
  const bothIssuersKnown = Boolean(
    normalizedIssuerTokens(
      left.nativeIdentity?.issuer,
      left.nativeIdentity?.issuingJurisdiction,
    ) &&
    normalizedIssuerTokens(
      right.nativeIdentity?.issuer,
      right.nativeIdentity?.issuingJurisdiction,
    ),
  );
  const bothIdentifiersIndependentlyScoped =
    isIndependentlyScopedScreen02FormalIdentifier(
      left.nativeIdentity?.formalIdentifier,
    ) &&
    isIndependentlyScopedScreen02FormalIdentifier(
      right.nativeIdentity?.formalIdentifier,
    );
  return (bothStagesUnknown &&
    (bothIssuersKnown || bothIdentifiersIndependentlyScoped)) ||
    separatelyNumberedFederalAdministrativeRecords(
    left,
    right,
    leftIdentifier,
    rightIdentifier,
  );
}

export function compareScreen02Proposals(
  left: Screen02Proposal,
  right: Screen02Proposal,
): Screen02ProposalSimilarity {
  const base = {
    leftProposalId: left.id,
    rightProposalId: right.id,
  };
  if (left.mode !== right.mode || left.kind !== right.kind) {
    return {
      ...base,
      compatible: false,
      score: 0,
      titleSimilarity: 0,
      metadataSimilarity: 0,
      reason: "Different Screen 2 modes or proposal kinds are not clustered.",
    };
  }

  if (
    left.mode === "audit" &&
    right.mode === "audit" &&
    left.representationType !== right.representationType
  ) {
    return {
      ...base,
      compatible: false,
      score: 0,
      titleSimilarity: fuzzyScreen02TitleSimilarity(
        left.title,
        right.title,
      ),
      metadataSimilarity: 0,
      reason:
        "Different known-shock representation families remain separate.",
    };
  }

  if (left.mode === "find" && right.mode === "find") {
    if (materiallyDistinctTreatmentVersion(left, right)) {
      return {
        ...base,
        compatible: false,
        score: 0,
        titleSimilarity: fuzzyScreen02TitleSimilarity(left.title, right.title),
        metadataSimilarity: 0,
        reason:
          "Source-backed treatment timing or assignment facts establish distinct versions.",
      };
    }
    const leftFormalIdentifier = normalizedFormalIdentifier(
      left.nativeIdentity?.formalIdentifier,
      left,
    );
    const rightFormalIdentifier = normalizedFormalIdentifier(
      right.nativeIdentity?.formalIdentifier,
      right,
    );
    const formalIdentifierRelation = leftFormalIdentifier &&
        rightFormalIdentifier
      ? proposalFormalIdentifierRelation(
          left.nativeIdentity?.formalIdentifier,
          left,
          right.nativeIdentity?.formalIdentifier,
          right,
        )
      : null;
    if (formalIdentifierRelation === "conflict") {
      return {
        ...base,
        compatible: false,
        score: 0,
        titleSimilarity: fuzzyScreen02TitleSimilarity(left.title, right.title),
        metadataSimilarity: 0,
        reason:
          "Conflicting formal-identifier coordinates remain separate even when titles overlap.",
      };
    }
    if (
      leftFormalIdentifier &&
      rightFormalIdentifier &&
      (formalIdentifierRelation === "equivalent" ||
        formalIdentifierRelation === "compatible-partial")
    ) {
      const jurisdictionsCompatible = compatibleIssuingJurisdictions(
        left.nativeIdentity?.issuingJurisdiction,
        right.nativeIdentity?.issuingJurisdiction,
      );
      const issuersCompatible = compatibleIssuers(
        left.nativeIdentity?.issuer,
        right.nativeIdentity?.issuer,
        left.nativeIdentity?.issuingJurisdiction,
        right.nativeIdentity?.issuingJurisdiction,
      );
      const leftIssuerKnown = Boolean(normalizedIssuerTokens(
        left.nativeIdentity?.issuer,
        left.nativeIdentity?.issuingJurisdiction,
      ));
      const rightIssuerKnown = Boolean(normalizedIssuerTokens(
        right.nativeIdentity?.issuer,
        right.nativeIdentity?.issuingJurisdiction,
      ));
      const leftIndependentlyScoped = formalIdentifierIsIndependentlyScoped(
        formalIdentifierInput(
          left.nativeIdentity?.formalIdentifier,
          left,
        ),
      );
      const rightIndependentlyScoped = formalIdentifierIsIndependentlyScoped(
        formalIdentifierInput(
          right.nativeIdentity?.formalIdentifier,
          right,
        ),
      );
      const independentlyScoped = formalIdentifierRelation === "equivalent"
        ? leftIndependentlyScoped || rightIndependentlyScoped
        : leftIndependentlyScoped && rightIndependentlyScoped;
      if (
        !jurisdictionsCompatible ||
        (leftIssuerKnown && rightIssuerKnown && !issuersCompatible)
      ) {
        return {
          ...base,
          compatible: false,
          score: 0,
          titleSimilarity: fuzzyScreen02TitleSimilarity(left.title, right.title),
          metadataSimilarity: 0,
          reason: !jurisdictionsCompatible
            ? "The same formal identifier is reused across incompatible issuing jurisdictions."
            : "The same local formal identifier is reused by different issuing bodies.",
        };
      }
      if (
        (leftIssuerKnown && rightIssuerKnown && issuersCompatible) ||
        independentlyScoped
      ) {
        return {
          ...base,
          compatible: true,
          score: 1,
          titleSimilarity: 1,
          metadataSimilarity: 1,
          reason:
            "The proposals have the same issuer-scoped formal identity in compatible issuing jurisdictions.",
        };
      }
      // An unscoped label such as "Order 12" with an absent issuer is not a
      // globally unique identity. Let the ordinary event comparison decide.
    }
    if (
      leftFormalIdentifier &&
      rightFormalIdentifier &&
      formalIdentifierRelation === "different" &&
      conflictingFormalTreatmentVersions(left, right)
    ) {
      return {
        ...base,
        compatible: false,
        score: 0,
        titleSimilarity: fuzzyScreen02TitleSimilarity(left.title, right.title),
        metadataSimilarity: 0,
        reason:
          "Different formal document identifiers remain separate even when titles overlap.",
      };
    }
  }

  if (
    stableScreen02ProposalId(left) ===
    stableScreen02ProposalId(right)
  ) {
    return {
      ...base,
      compatible: true,
      score: 1,
      titleSimilarity: 1,
      metadataSimilarity: 1,
      reason: "The proposals have the same normalized semantic signature.",
    };
  }

  if (left.mode === "find" && right.mode === "find") {
    const titleSimilarity = Math.max(
      fuzzyScreen02TitleSimilarity(left.title, right.title),
      fuzzyScreen02TitleSimilarity(
        left.event.displayName,
        right.event.displayName,
      ),
    );
    const dateSimilarity =
      normalizeScreen02DiscoveryText(left.event.eventDate) ===
      normalizeScreen02DiscoveryText(right.event.eventDate)
        ? 1
        : 0;
    const familySimilarity = fuzzyScreen02TitleSimilarity(
      left.event.eventFamily,
      right.event.eventFamily,
    );
    const geographySimilarity = normalizedValueSetSimilarity(
      left.event.geographies,
      right.event.geographies,
    );
    const populationSimilarity = normalizedValueSetSimilarity(
      left.event.populations,
      right.event.populations,
    );
    const metadataSimilarity =
      0.375 * dateSimilarity +
      0.25 * familySimilarity +
      0.1875 * geographySimilarity +
      0.1875 * populationSimilarity;
    const score =
      0.6 * titleSimilarity +
      0.4 * metadataSimilarity;
    return {
      ...base,
      compatible: true,
      score: round(score),
      titleSimilarity: round(titleSimilarity),
      metadataSimilarity: round(metadataSimilarity),
      reason:
        "Find-mode similarity combines event naming, date, family, geography, and population.",
    };
  }

  if (left.mode === "audit" && right.mode === "audit") {
    const titleSimilarity = fuzzyScreen02TitleSimilarity(
      left.title,
      right.title,
    );
    const constructSimilarity = fuzzyScreen02TitleSimilarity(
      left.candidateConstruct,
      right.candidateConstruct,
    );
    const operationalizationSimilarity = normalizedTokenSimilarity(
      left.operationalization,
      right.operationalization,
    );
    const metadataSimilarity =
      0.6 * constructSimilarity +
      0.4 * operationalizationSimilarity;
    const score =
      0.5 * titleSimilarity +
      0.5 * metadataSimilarity;
    return {
      ...base,
      compatible: true,
      score: round(score),
      titleSimilarity: round(titleSimilarity),
      metadataSimilarity: round(metadataSimilarity),
      reason:
        "Audit-mode similarity combines title, construct, and operationalization within one representation family.",
    };
  }

  return {
    ...base,
    compatible: false,
    score: 0,
    titleSimilarity: 0,
    metadataSimilarity: 0,
    reason: "The proposals are not comparable.",
  };
}

function strongestAuthorityTier(proposal: Screen02Proposal) {
  if (proposal.sources.length === 0) return 7;
  return Math.min(
    ...proposal.sources.map((source) => source.authorityTier),
  );
}

function compareCanonicalCandidates(
  left: Screen02Proposal,
  right: Screen02Proposal,
) {
  return (
    strongestAuthorityTier(left) - strongestAuthorityTier(right) ||
    right.sources.length - left.sources.length ||
    originPriority[left.origin] - originPriority[right.origin] ||
    compareText(
      stableScreen02ProposalId(left),
      stableScreen02ProposalId(right),
    ) ||
    compareText(left.id, right.id)
  );
}

function stableClusterId(members: readonly Screen02Proposal[]) {
  const signature = members
    .map(
      (proposal) =>
        `${stableScreen02ProposalId(proposal)}:${normalizeScreen02DiscoveryText(
          proposal.id,
        )}`,
    )
    .sort(compareText)
    .join("\u001e");
  return `s2c-${fnv1a64(signature)}`;
}

function validateClusterThreshold(threshold: number) {
  if (
    !Number.isFinite(threshold) ||
    threshold < 0 ||
    threshold > 1
  ) {
    throw new Error(
      "Proposal-clustering threshold must be between zero and one.",
    );
  }
}

/**
 * Uses deterministic, fixed-threshold, conflict-aware union-find clustering.
 * Pairwise similarities and complete cluster membership are retained so a
 * researcher can see why records were consolidated.
 */
export function clusterScreen02Proposals(
  proposals: readonly Screen02Proposal[],
  threshold = SCREEN02_PROPOSAL_CLUSTER_THRESHOLD,
): Screen02ProposalClusteringResult {
  assertUniqueProposalIds(proposals);
  validateClusterThreshold(threshold);
  const ordered = [...proposals].sort((left, right) =>
    compareText(left.id, right.id),
  );
  const parent = ordered.map((_, index) => index);

  function find(index: number): number {
    if (parent[index] !== index) {
      parent[index] = find(parent[index]);
    }
    return parent[index];
  }

  function union(leftIndex: number, rightIndex: number) {
    const leftRoot = find(leftIndex);
    const rightRoot = find(rightIndex);
    if (leftRoot === rightRoot) return;
    if (leftRoot < rightRoot) parent[rightRoot] = leftRoot;
    else parent[leftRoot] = rightRoot;
  }

  const comparisons: Screen02ProposalSimilarity[] = [];
  const eligibleEdges: Array<{
    leftIndex: number;
    rightIndex: number;
    comparison: Screen02ProposalSimilarity;
  }> = [];
  for (let leftIndex = 0; leftIndex < ordered.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < ordered.length;
      rightIndex += 1
    ) {
      const comparison = compareScreen02Proposals(
        ordered[leftIndex],
        ordered[rightIndex],
      );
      comparisons.push(comparison);
      if (comparison.compatible && comparison.score >= threshold) {
        eligibleEdges.push({ leftIndex, rightIndex, comparison });
      }
    }
  }

  // Stronger identity edges are resolved before fuzzier similarities. This
  // lets an identifierless lane join its exact semantic counterpart while
  // the component-wide guard below prevents conflicting formal versions from
  // being joined through an otherwise eligible bridge.
  eligibleEdges.sort(
    (left, right) =>
      right.comparison.score - left.comparison.score ||
      compareText(
        left.comparison.leftProposalId,
        right.comparison.leftProposalId,
      ) ||
      compareText(
        left.comparison.rightProposalId,
        right.comparison.rightProposalId,
      ),
  );
  for (const edge of eligibleEdges) {
    const leftRoot = find(edge.leftIndex);
    const rightRoot = find(edge.rightIndex);
    if (leftRoot === rightRoot) continue;
    const hasVersionConflict = ordered.some((leftMember, leftMemberIndex) =>
      find(leftMemberIndex) === leftRoot &&
      ordered.some((rightMember, rightMemberIndex) =>
        find(rightMemberIndex) === rightRoot &&
        conflictingFormalTreatmentVersions(leftMember, rightMember)
      )
    );
    if (!hasVersionConflict) {
      union(edge.leftIndex, edge.rightIndex);
    }
  }

  const groups = new Map<number, Screen02Proposal[]>();
  ordered.forEach((proposal, index) => {
    const root = find(index);
    const members = groups.get(root) ?? [];
    members.push(proposal);
    groups.set(root, members);
  });

  const clusters = [...groups.values()]
    .map((members) => {
      const canonical = [...members].sort(
        compareCanonicalCandidates,
      )[0];
      const orderedMembers = [...members].sort((left, right) =>
        compareText(left.id, right.id),
      );
      const clusterId = stableClusterId(orderedMembers);
      const memberProposalIds = orderedMembers.map(
        (proposal) => proposal.id,
      );
      return {
        clusterId,
        canonicalProposalId: canonical.id,
        members: orderedMembers.map((proposal) => ({
          proposalId: proposal.id,
          stableProposalId: stableScreen02ProposalId(proposal),
        })),
        memberProposalIds,
        duplicateProposalIds: memberProposalIds.filter(
          (proposalId) => proposalId !== canonical.id,
        ),
      };
    })
    .sort((left, right) =>
      compareText(left.clusterId, right.clusterId),
    );

  const membership: Record<string, string> = {};
  for (const cluster of clusters) {
    for (const proposalId of cluster.memberProposalIds) {
      membership[proposalId] = cluster.clusterId;
    }
  }

  return {
    formulaVersion: SCREEN02_DISCOVERY_FORMULA_VERSION,
    threshold,
    clusters,
    membership,
    comparisons,
  };
}

function mergeUniqueText(values: readonly string[]) {
  const byNormalized = new Map<string, string>();
  for (const value of values) {
    const normalized = normalizeScreen02DiscoveryText(value);
    if (!normalized) continue;
    const existing = byNormalized.get(normalized);
    if (!existing || compareText(value, existing) < 0) {
      byNormalized.set(normalized, value);
    }
  }
  return [...byNormalized.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([, value]) => value);
}

function normalizedSourceLocator(source: Screen02Source) {
  return source.locator.trim().toLowerCase().replace(/\/+$/g, "");
}

function mergeSources(proposals: readonly Screen02Proposal[]) {
  const byIdentity = new Map<string, Screen02Source>();
  for (const proposal of proposals) {
    for (const source of proposal.sources) {
      const locator = normalizedSourceLocator(source);
      const identity = locator
        ? `locator:${locator}`
        : `id:${normalizeScreen02DiscoveryText(source.id)}`;
      const existing = byIdentity.get(identity);
      if (
        !existing ||
        source.authorityTier < existing.authorityTier ||
        (source.authorityTier === existing.authorityTier &&
          compareText(source.id, existing.id) < 0)
      ) {
        byIdentity.set(identity, source);
      }
    }
  }
  return [...byIdentity.values()].sort(
    (left, right) =>
      left.authorityTier - right.authorityTier ||
      compareText(
        normalizedSourceLocator(left),
        normalizedSourceLocator(right),
      ) ||
      compareText(left.id, right.id),
  );
}

function consolidateCluster(
  members: readonly Screen02Proposal[],
  canonicalProposalId: string,
): Screen02Proposal {
  const canonical = members.find(
    (proposal) => proposal.id === canonicalProposalId,
  );
  if (!canonical) {
    throw new Error(
      `Canonical proposal ${canonicalProposalId} is missing from its cluster.`,
    );
  }
  const substantiveMembers = members.filter(
    (proposal) =>
      proposal.origin !== "unsupported-lead" &&
      proposal.sources.some((source) => source.authorityTier < 6),
  );
  // Contextual Tier-6 leads remain visible in the merged source trail, but
  // they cannot fill official-source coverage, timing, or variable gaps. A
  // context-only cluster keeps its own facts so that it can still be shown as
  // a clearly non-authoritative lead and rejected by the source-quality gate.
  const factMembers = substantiveMembers.length > 0
    ? substantiveMembers
    : members;
  const provisionalDates = mergeUniqueText(
    factMembers.flatMap((proposal) => proposal.provisionalDates),
  );
  const requiredVariables = mergeUniqueText(
    factMembers.flatMap((proposal) => proposal.requiredVariables),
  );
  const limitations = mergeUniqueText(
    members.flatMap((proposal) => proposal.limitations),
  );
  const reasons = mergeUniqueText(
    members.flatMap((proposal) => proposal.reasons),
  );
  const sources = mergeSources(members);

  if (canonical.mode === "find") {
    const findMembers = factMembers.filter(
      (proposal): proposal is Extract<
        Screen02Proposal,
        { mode: "find" }
      > => proposal.mode === "find",
    );
    return {
      ...canonical,
      provisionalDates,
      requiredVariables,
      limitations,
      reasons,
      sources,
      event: {
        ...canonical.event,
        geographies: mergeUniqueText(
          findMembers.flatMap(
            (proposal) => proposal.event.geographies,
          ),
        ),
        populations: mergeUniqueText(
          findMembers.flatMap(
            (proposal) => proposal.event.populations,
          ),
        ),
      },
    };
  }

  return {
    ...canonical,
    provisionalDates,
    requiredVariables,
    limitations,
    reasons,
    sources,
  };
}

/**
 * Consolidates each fuzzy cluster into one canonical proposal while retaining
 * every cluster member and duplicate proposal ID in diagnostics. The source
 * trail is unioned deterministically; only non-contextual authoritative
 * members may supply list-valued substantive facts when one exists. Scalar
 * judgments remain those of the traceable canonical proposal.
 */
export function deduplicateScreen02Proposals(
  proposals: readonly Screen02Proposal[],
  threshold = SCREEN02_PROPOSAL_CLUSTER_THRESHOLD,
): Screen02ProposalDeduplicationResult {
  const clustering = clusterScreen02Proposals(proposals, threshold);
  const byId = new Map(
    proposals.map((proposal) => [proposal.id, proposal]),
  );
  const consolidated = clustering.clusters.map((cluster) => {
    const members = cluster.memberProposalIds.map((id) => {
      const proposal = byId.get(id);
      if (!proposal) {
        throw new Error(`Proposal ${id} is missing during consolidation.`);
      }
      return proposal;
    });
    return consolidateCluster(
      members,
      cluster.canonicalProposalId,
    );
  });
  const proposalById = new Map(
    consolidated.map((proposal) => [proposal.id, proposal]),
  );
  const retainedProposalIds = clustering.clusters
    .map((cluster) => cluster.canonicalProposalId)
    .sort(compareText);
  const orderedProposals = retainedProposalIds.map((id) => {
    const proposal = proposalById.get(id);
    if (!proposal) {
      throw new Error(`Consolidated proposal ${id} is missing.`);
    }
    return proposal;
  });
  const duplicateProposalIds = clustering.clusters
    .flatMap((cluster) => cluster.duplicateProposalIds)
    .sort(compareText);

  return {
    formulaVersion: SCREEN02_DISCOVERY_FORMULA_VERSION,
    threshold,
    proposals: orderedProposals,
    retainedProposalIds,
    duplicateProposalIds,
    clusters: clustering.clusters,
    membership: clustering.membership,
    comparisons: clustering.comparisons,
  };
}

function proposalPreferenceTitle(proposal: Screen02Proposal) {
  return proposal.mode === "find"
    ? `${proposal.title} ${proposal.event.displayName}`
    : `${proposal.title} ${proposal.candidateConstruct}`;
}

function criterionDiagnostic(
  kind: Screen02PreferenceCriterionKind,
  criterion: string,
  proposalText: string,
  proposalTitle: string,
): Screen02PreferenceCriterionDiagnostic {
  const normalizedCriterion =
    normalizeScreen02DiscoveryText(criterion);
  const criterionTokens = uniqueSorted(
    tokenizeScreen02DiscoveryText(criterion),
  );
  const documentTokens = new Set(
    tokenizeScreen02DiscoveryText(proposalText),
  );
  const matchedTokens = criterionTokens.filter((token) =>
    documentTokens.has(token),
  );
  const missingTokens = criterionTokens.filter(
    (token) => !documentTokens.has(token),
  );
  const tokenCoverage =
    criterionTokens.length === 0
      ? 0
      : matchedTokens.length / criterionTokens.length;
  const phraseMatch =
    normalizedCriterion.length > 0 &&
    normalizeScreen02DiscoveryText(proposalText).includes(
      normalizedCriterion,
    )
      ? 1
      : 0;
  const titleSimilarity =
    fuzzyScreen02TitleSimilarity(criterion, proposalTitle) * 0.9;
  const relevance = round(
    Math.max(tokenCoverage, phraseMatch, titleSimilarity),
  );
  const matched =
    relevance >= SCREEN02_PREFERENCE_MATCH_THRESHOLD;
  return {
    kind,
    criterion,
    normalizedCriterion,
    relevance,
    matched,
    matchedTokens,
    missingTokens,
    reason: matched
      ? `Matched at or above the fixed ${SCREEN02_PREFERENCE_MATCH_THRESHOLD} relevance threshold.`
      : `Did not reach the fixed ${SCREEN02_PREFERENCE_MATCH_THRESHOLD} relevance threshold.`,
  };
}

/**
 * Scores researcher preferences separately from scientific feasibility. The
 * context supplies the locked mode and known-shock guard; the score itself is
 * based only on proposal text and explicit Require/Prefer/Avoid criteria.
 */
export function scoreScreen02PreferenceRelevance(
  proposal: Screen02Proposal,
  context: Screen01StudyContext,
  preferences: Screen02DiscoveryPreferences = {},
): Screen02PreferenceRelevance {
  if (proposal.mode !== context.startingPoint) {
    throw new Error(
      "A proposal cannot be preference-scored against a different Screen 1 mode.",
    );
  }
  if (
    proposal.mode === "audit" &&
    !normalizeScreen02DiscoveryText(context.knownShock)
  ) {
    throw new Error(
      "Audit-mode preference scoring requires the locked known shock.",
    );
  }

  const proposalText = screen02ProposalSearchText(proposal);
  const proposalTitle = proposalPreferenceTitle(proposal);
  const criteria = (
    [
      ["require", canonicalCriteria(preferences.require)],
      ["prefer", canonicalCriteria(preferences.prefer)],
      ["avoid", canonicalCriteria(preferences.avoid)],
    ] as const
  ).flatMap(([kind, values]) =>
    values.map((criterion) =>
      criterionDiagnostic(
        kind,
        criterion,
        proposalText,
        proposalTitle,
      ),
    ),
  );

  if (criteria.length === 0) {
    return {
      formulaVersion: SCREEN02_DISCOVERY_FORMULA_VERSION,
      proposalId: proposal.id,
      stableProposalId: stableScreen02ProposalId(proposal),
      score: null,
      requiredSatisfied: true,
      positiveRelevance: null,
      avoidPenalty: 0,
      criteria: [],
      reason: "No Screen 2 preferences were supplied.",
    };
  }

  const required = criteria.filter(
    (criterion) => criterion.kind === "require",
  );
  const preferred = criteria.filter(
    (criterion) => criterion.kind === "prefer",
  );
  const avoided = criteria.filter(
    (criterion) => criterion.kind === "avoid",
  );
  const requiredRelevance = average(
    required.map((criterion) => criterion.relevance),
  );
  const preferredRelevance = average(
    preferred.map((criterion) => criterion.relevance),
  );
  let positiveRelevance = 1;
  if (required.length > 0 && preferred.length > 0) {
    positiveRelevance =
      0.65 * requiredRelevance + 0.35 * preferredRelevance;
  } else if (required.length > 0) {
    positiveRelevance = requiredRelevance;
  } else if (preferred.length > 0) {
    positiveRelevance = preferredRelevance;
  }

  const avoidRelevance = average(
    avoided.map((criterion) =>
      criterion.matched ? criterion.relevance : 0,
    ),
  );
  const avoidPenalty =
    avoided.length === 0 ? 0 : 0.6 * avoidRelevance;
  const requiredSatisfied = required.every(
    (criterion) => criterion.matched,
  );
  let score = 100 * positiveRelevance * (1 - avoidPenalty);
  if (!requiredSatisfied) score = Math.min(score, 49);
  score = round(Math.max(0, Math.min(100, score)), 2);

  return {
    formulaVersion: SCREEN02_DISCOVERY_FORMULA_VERSION,
    proposalId: proposal.id,
    stableProposalId: stableScreen02ProposalId(proposal),
    score,
    requiredSatisfied,
    positiveRelevance: round(positiveRelevance),
    avoidPenalty: round(avoidPenalty),
    criteria,
    reason: requiredSatisfied
      ? "Preference relevance uses explicit positive criteria and a separate Avoid penalty."
      : "At least one Require criterion was not matched, so preference relevance is capped below 50.",
  };
}
