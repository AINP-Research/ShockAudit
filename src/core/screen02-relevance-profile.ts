export const SCREEN02_RELEVANCE_PROFILE_VERSION =
  "screen-02-relevance-profile-2026-09-09-v3" as const;
export const SCREEN02_STUDY_RELEVANCE_PROFILE_SCHEMA_VERSION =
  "screen-02-study-relevance-profile-v1" as const;
export const SCREEN02_PROFILE_HOST_CACHE_SCHEMA_VERSION =
  "screen-02-profile-host-cache-entry-v1" as const;

export const SCREEN02_INDUSTRY_VOCABULARY_METADATA = {
  source: "ShockAudit project-authored controlled vocabulary",
  version: "2026-09-09-v3",
  license: "CC0-1.0",
  note:
    "Vocabulary and ambiguity-crosswalk rows are search aids under one algorithm. Membership never proves candidate relevance.",
  method:
    "Lowercase normalized labels select data rows; ambiguous rows expose explicit canonical alternatives and never choose one automatically.",
} as const;

export const SCREEN02_DISCOVERY_RAW_CANDIDATE_TARGET = 40;
export const SCREEN02_DISCOVERY_RAW_CANDIDATE_MAX = 60;
export const SCREEN02_DISCOVERY_QUALIFIED_CANDIDATE_TARGET = 10;
export const SCREEN02_DISCOVERY_MAX_ROUNDS = 2;
export const SCREEN02_DISCOVERY_MIN_QUERY_VARIANTS = 12;
export const SCREEN02_DISCOVERY_MAX_QUERY_VARIANTS = 16;
// Short aliases keep orchestration code readable while preserving the more
// explicit names above for existing readers.
export const SCREEN02_DISCOVERY_RAW_TARGET =
  SCREEN02_DISCOVERY_RAW_CANDIDATE_TARGET;
export const SCREEN02_DISCOVERY_RAW_MAX = SCREEN02_DISCOVERY_RAW_CANDIDATE_MAX;
export const SCREEN02_DISCOVERY_QUALIFIED_TARGET =
  SCREEN02_DISCOVERY_QUALIFIED_CANDIDATE_TARGET;

export type Screen02IndustryVocabulary = {
  aliases: readonly string[];
  internationalVariants?: readonly string[];
  subsectors: readonly string[];
  productsAndServices: readonly string[];
  products?: readonly string[];
  services?: readonly string[];
  actors: readonly string[];
  businessModels?: readonly string[];
  distributionChannels?: readonly string[];
  platformRelationships?: readonly string[];
  activities: readonly string[];
  workforceRelationships?: readonly string[];
  supplyChainRelationships?: readonly string[];
  customerOrUserRelationships?: readonly string[];
  regulatorySurfaces?: readonly string[];
  disruptionSurfaces?: readonly string[];
  adjacentActivities: readonly string[];
  contrastTerms?: readonly string[];
  falseFriends: readonly string[];
  ambiguousWhenExact?: boolean;
  ambiguity?: {
    code: string;
    question: string;
    explanation: string;
    alternatives: readonly {
      canonicalCode: string;
      canonicalLabel: string;
      description: string;
    }[];
  };
};

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

/**
 * Versioned vocabulary data, not separate decision logic. Every industry,
 * including values absent from this table, is processed by the same builder
 * and matching algorithm below.
 */
export const SCREEN02_INDUSTRY_VOCABULARY_DATA: Readonly<
  Record<string, Screen02IndustryVocabulary>
> = {
  "video gaming": {
    aliases: [
      "video games",
      "interactive entertainment",
      "game software",
      "gaming console",
    ],
    internationalVariants: ["computer games", "electronic games"],
    subsectors: ["console gaming", "mobile gaming", "online gaming", "esports"],
    productsAndServices: [
      "video game",
      "game console",
      "game engine",
      "in game purchase",
      "downloadable game content",
    ],
    actors: ["game developer", "game publisher", "game platform"],
    businessModels: ["free to play", "game subscription", "premium game sales"],
    distributionChannels: ["digital storefront", "app distribution", "physical game retail"],
    platformRelationships: ["console platform", "app store", "online multiplayer platform"],
    activities: [
      "game development",
      "game publishing",
      "game distribution",
      "interactive entertainment publishing",
    ],
    adjacentActivities: [
      "digital content distribution",
      "app store distribution",
      "virtual goods marketplace",
      "online multiplayer service",
    ],
    workforceRelationships: ["game studio workforce", "independent game developer"],
    supplyChainRelationships: ["game publishing supply chain"],
    customerOrUserRelationships: ["player account", "child directed service"],
    regulatorySurfaces: [
      "online safety",
      "platform conduct",
      "player data",
      "personal information",
      "children's personal information",
      "privacy default",
      "virtual goods",
    ],
    disruptionSurfaces: ["storefront access", "monetization", "content distribution"],
    contrastTerms: ["gambling operator", "telecommunications relay provider"],
    falseFriends: [
      "gambling",
      "casino",
      "wagering",
      "sports betting",
      "sportsbook",
      "bingo",
      "keno",
      "slot machine",
      "slot machines",
      "lottery",
      "video relay",
      "video calling",
      "telecommunications relay",
    ],
  },
  gaming: {
    aliases: [],
    subsectors: [],
    productsAndServices: [],
    actors: [],
    activities: [],
    adjacentActivities: [],
    falseFriends: ["video game", "gambling", "casino", "wagering"],
    ambiguousWhenExact: true,
    ambiguity: {
      code: "gaming-sector-meaning",
      question: "Which kind of gaming is in scope?",
      explanation:
        "The label can describe video-game businesses or gambling and wagering businesses, which lead to materially different searches.",
      alternatives: [
        {
          canonicalCode: "industry:video-gaming",
          canonicalLabel: "Video gaming",
          description:
            "Game developers, publishers, platforms, consoles, mobile games, and interactive entertainment.",
        },
        {
          canonicalCode: "industry:gambling-and-wagering",
          canonicalLabel: "Gambling and wagering",
          description:
            "Casinos, betting, wagering operators, lotteries, and gambling services.",
        },
      ],
    },
  },
  "gambling and wagering": {
    aliases: ["gambling", "gaming operations", "casino gaming", "wagering"],
    internationalVariants: ["betting and gaming"],
    subsectors: ["casino operations", "sports betting", "lottery operations"],
    productsAndServices: [
      "gambling service",
      "wagering service",
      "casino game",
      "betting product",
    ],
    actors: ["casino operator", "betting operator", "wagering operator"],
    businessModels: ["house-banked gaming", "pari-mutuel wagering"],
    distributionChannels: ["betting platform", "casino venue"],
    platformRelationships: ["online gambling platform"],
    activities: ["gambling", "wagering", "betting", "casino operation"],
    customerOrUserRelationships: ["gambler account", "bettor account"],
    regulatorySurfaces: ["gambling licensing", "responsible gambling"],
    disruptionSurfaces: ["operating license", "betting access"],
    adjacentActivities: ["payment processing", "hospitality operations"],
    contrastTerms: ["video game developer", "interactive entertainment publisher"],
    falseFriends: ["video game", "esports", "game engine", "mobile game"],
  },
  manufacturing: {
    aliases: ["industrial production"],
    subsectors: ["advanced manufacturing", "process manufacturing"],
    productsAndServices: ["manufactured product", "industrial product"],
    actors: ["manufacturer", "factory operator", "plant operator"],
    activities: ["manufacturing", "assembly", "fabrication", "production"],
    adjacentActivities: [
      "industrial supply chain",
      "product safety",
      "production facility",
    ],
    falseFriends: ["manufactured housing"],
  },
  technology: {
    aliases: [],
    subsectors: [],
    productsAndServices: [],
    actors: [],
    activities: [],
    // Technology is too broad for a product or regulatory surface to prove
    // direct sector coverage. These narrow terms support only an adjacent
    // relationship when they occur in candidate-bound authoritative text.
    regulatorySurfaces: [
      "personal information",
      "personal data",
      "data protection",
      "connected device",
    ],
    adjacentActivities: [],
    falseFriends: [],
  },
  banking: {
    aliases: ["banking services", "depository services"],
    subsectors: ["commercial banking", "retail banking", "investment banking"],
    productsAndServices: ["deposit account", "bank loan", "payment processing"],
    actors: ["bank", "depository institution", "credit union", "lender"],
    activities: ["deposit taking", "lending", "banking"],
    adjacentActivities: ["consumer credit", "mortgage lending", "deposit insurance"],
    falseFriends: ["river bank", "data bank"],
  },
  energy: {
    aliases: ["energy sector"],
    subsectors: ["electric power", "oil and gas", "renewable energy"],
    productsAndServices: [
      "electricity",
      "natural gas",
      "energy generation",
      "electric storage",
      "electric storage resource",
    ],
    actors: [
      "electric utility",
      "electric generating unit",
      "power producer",
      "energy producer",
    ],
    activities: ["power generation", "energy transmission", "energy distribution"],
    adjacentActivities: ["electric grid", "electricity market", "energy storage"],
    falseFriends: ["energy drink", "personal energy"],
  },
  healthcare: {
    aliases: ["health care"],
    subsectors: ["hospital care", "ambulatory care", "health insurance"],
    productsAndServices: ["medical care", "health service"],
    actors: ["hospital", "healthcare provider", "health insurer"],
    activities: ["patient care", "medical treatment", "healthcare delivery"],
    adjacentActivities: ["medical claims", "health data processing"],
    falseFriends: [],
  },
  pharmaceutical: {
    aliases: ["pharmaceuticals", "drug industry"],
    subsectors: ["biopharmaceutical", "generic drugs"],
    productsAndServices: ["drug", "medicine", "pharmaceutical product"],
    actors: ["drug manufacturer", "pharmaceutical company"],
    activities: ["drug development", "drug manufacturing", "drug distribution"],
    adjacentActivities: ["clinical trial", "drug approval"],
    falseFriends: [],
  },
  retail: {
    aliases: ["retail trade"],
    subsectors: ["online retail", "brick and mortar retail"],
    productsAndServices: ["retail goods", "consumer merchandise"],
    actors: ["retailer", "merchant"],
    activities: ["retailing", "merchandise sales"],
    adjacentActivities: ["ecommerce marketplace", "point of sale"],
    falseFriends: ["retail investor", "retail banking"],
  },
  transportation: {
    aliases: ["transport industry"],
    subsectors: ["freight transport", "passenger transport", "logistics"],
    productsAndServices: ["transportation service", "freight service"],
    actors: ["carrier", "transport operator", "logistics provider"],
    activities: ["freight movement", "passenger carriage", "transportation"],
    adjacentActivities: ["shipping", "fleet operation", "port operation"],
    falseFriends: [],
  },
  food: {
    aliases: ["food industry"],
    subsectors: ["food processing", "food service", "food retail"],
    productsAndServices: ["food product", "beverage"],
    actors: ["food producer", "food processor", "restaurant"],
    activities: ["food production", "food processing", "food distribution"],
    adjacentActivities: ["food safety", "ingredient labeling"],
    falseFriends: ["food for thought"],
  },
};

const GENERIC_INDUSTRY_WORDS = new Set([
  "all", "and", "any", "business", "businesses", "company", "companies", "cross",
  "consumer", "consumers", "customer", "customers", "data", "digital",
  "enterprise", "enterprises", "firm", "firms", "industry", "industries",
  "information", "law", "laws", "listed", "online", "organization", "organizations",
  "platform", "platforms", "policy", "policies", "private", "provider", "providers", "public",
  "regulation", "regulations", "sector", "sectors", "the", "united", "us", "user", "users",
  "states",
]);

const RESEARCH_BOILERPLATE_WORDS = new Set([
  ...GENERIC_INDUSTRY_WORDS,
  "affect", "affecting", "annual", "between", "candidate", "event", "find",
  "cost", "costs", "employment", "from", "innovation", "investment", "may",
  "outcome", "policy", "profit", "profitability", "regulation", "regulatory",
  "research", "revenue", "revenues", "shock", "study", "that", "through", "with",
]);

function unique(values: readonly string[]) {
  return [...new Set(values.map(normalizeScreen02DiscoveryText).filter(Boolean))];
}

function singularVariants(term: string) {
  const normalized = normalizeScreen02DiscoveryText(term);
  if (!normalized) return [];
  const values = [normalized];
  if (normalized.endsWith("ies") && normalized.length > 4) {
    values.push(`${normalized.slice(0, -3)}y`);
  } else if (normalized.endsWith("s") && !normalized.endsWith("ss")) {
    values.push(normalized.slice(0, -1));
  }
  return values;
}

function genericIndustryTerms(industry: string) {
  const normalized = normalizeScreen02DiscoveryText(industry);
  const tokens = normalized
    .split(" ")
    .filter((token) => token.length >= 3 && !GENERIC_INDUSTRY_WORDS.has(token));
  if (tokens.length === 0) return [];
  return unique([normalized, ...tokens.flatMap(singularVariants)]).filter(
    (term) => !GENERIC_INDUSTRY_WORDS.has(term),
  );
}

function vocabularyFor(industry: string) {
  const normalized = normalizeScreen02DiscoveryText(industry);
  const direct = SCREEN02_INDUSTRY_VOCABULARY_DATA[normalized];
  if (direct) return { key: normalized, value: direct };
  const entries = Object.entries(SCREEN02_INDUSTRY_VOCABULARY_DATA)
    .sort(([left], [right]) => left.localeCompare(right, "en-US"));
  const selectionTerms = (
    key: string,
    value: Screen02IndustryVocabulary,
  ) => unique([key, ...value.aliases, ...(value.internationalVariants ?? [])])
    .map(normalizeScreen02DiscoveryText)
    .filter(Boolean);
  const exactAlias = entries.find(([key, value]) =>
    selectionTerms(key, value).some((term) => term === normalized)
  );
  if (exactAlias) return { key: exactAlias[0], value: exactAlias[1] };
  const contained = entries
    .flatMap(([key, value]) => selectionTerms(key, value).map((phrase) => ({
      key,
      value,
      phrase,
    })))
    .filter(({ phrase }) =>
      phrase.length >= 5 && ` ${normalized} `.includes(` ${phrase} `)
    )
    .sort((left, right) =>
      right.phrase.length - left.phrase.length ||
      left.phrase.localeCompare(right.phrase, "en-US") ||
      left.key.localeCompare(right.key, "en-US")
    )[0];
  return contained ? { key: contained.key, value: contained.value } : null;
}

function screen02ProfileCanonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(screen02ProfileCanonicalValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, screen02ProfileCanonicalValue(entry)]),
    );
  }
  return value;
}

function fingerprintScreen02ProfileValue(value: unknown) {
  const serialized = JSON.stringify(screen02ProfileCanonicalValue(value));
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of new TextEncoder().encode(serialized)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

function canonicalIndustryCodeFromKey(key: string) {
  const slug = normalizeScreen02DiscoveryText(key)
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 120);
  return slug
    ? `industry:${slug}`
    : `industry:custom-${fingerprintScreen02ProfileValue(key).slice(-16)}`;
}

/** Stable, data-driven code for a resolved industry interpretation. */
export function canonicalScreen02IndustryCode(industry: string) {
  const entry = vocabularyFor(industry);
  return canonicalIndustryCodeFromKey(
    entry?.key ?? normalizeScreen02DiscoveryText(industry),
  );
}

export type Screen02IndustryInterpretationAlternative = {
  canonicalCode: string;
  canonicalLabel: string;
  description: string;
};

export type Screen02IndustryInterpretationAmbiguity = {
  code: string;
  question: string;
  explanation: string;
};

export type Screen02IndustryRelevanceProfile = {
  version: typeof SCREEN02_RELEVANCE_PROFILE_VERSION;
  industry: string;
  normalizedIndustry: string;
  status: "ready" | "needs-clarification";
  canonicalIndustryCode: string | null;
  ambiguity: Screen02IndustryInterpretationAmbiguity | null;
  interpretationAlternatives: Screen02IndustryInterpretationAlternative[];
  scopeMode: "target-industry" | "cross-industry";
  directTerms: string[];
  adjacentTerms: string[];
  broadBridgeTerms: string[];
  falseFriends: string[];
  queryFacets: Array<{
    family:
      | "identity"
      | "actor"
      | "product-service"
      | "business-model"
      | "distribution-channel"
      | "platform-relationship"
      | "activity"
      | "workforce-relationship"
      | "supply-chain-relationship"
      | "customer-user-relationship"
      | "regulatory-surface"
      | "disruption-surface"
      | "adjacent-activity";
    term: string;
  }>;
  note: string;
};

export function buildScreen02IndustryRelevanceProfile(
  industry: string,
): Screen02IndustryRelevanceProfile {
  const cleanIndustry = industry.replace(/\s+/gu, " ").trim();
  const normalizedIndustry = normalizeScreen02DiscoveryText(cleanIndustry);
  const vocabularyEntry = vocabularyFor(cleanIndustry);
  const vocabulary = vocabularyEntry?.value ?? null;
  const genericTerms = genericIndustryTerms(cleanIndustry);
  const identityTerms = vocabularyEntry
    ? unique([vocabularyEntry.key])
    : genericTerms;
  const ambiguous = Boolean(
    vocabulary?.ambiguousWhenExact &&
      vocabularyEntry &&
      normalizedIndustry === normalizeScreen02DiscoveryText(vocabularyEntry.key),
  );
  const crossIndustry = /^(?:all|any|cross)(?: industry| industries| sector| sectors)$/u.test(
    normalizedIndustry,
  );
  const aliases = unique(vocabulary?.aliases ?? []);
  const subsectors = unique(vocabulary?.subsectors ?? []);
  const productsAndServices = unique(vocabulary?.productsAndServices ?? []);
  const products = unique(vocabulary?.products ?? []);
  const services = unique(vocabulary?.services ?? []);
  const actors = unique(vocabulary?.actors ?? []);
  const businessModels = unique(vocabulary?.businessModels ?? []);
  const distributionChannels = unique(vocabulary?.distributionChannels ?? []);
  const platformRelationships = unique(vocabulary?.platformRelationships ?? []);
  const activities = unique(vocabulary?.activities ?? []);
  const workforceRelationships = unique(vocabulary?.workforceRelationships ?? []);
  const supplyChainRelationships = unique(vocabulary?.supplyChainRelationships ?? []);
  const customerOrUserRelationships = unique(
    vocabulary?.customerOrUserRelationships ?? [],
  );
  const regulatorySurfaces = unique(vocabulary?.regulatorySurfaces ?? []);
  const disruptionSurfaces = unique(vocabulary?.disruptionSurfaces ?? []);
  const adjacentActivities = unique(vocabulary?.adjacentActivities ?? []);
  const directTerms = unique([
    ...identityTerms,
    ...aliases,
    ...subsectors,
    ...productsAndServices,
    ...products,
    ...services,
    ...actors,
    ...businessModels,
    ...activities,
  ]);
  const adjacentTerms = unique([
    ...distributionChannels,
    ...platformRelationships,
    ...workforceRelationships,
    ...supplyChainRelationships,
    ...customerOrUserRelationships,
    ...regulatorySurfaces,
    ...disruptionSurfaces,
    ...adjacentActivities,
  ]);
  const broadBridgeTerms = unique([
    ...identityTerms,
    ...aliases,
    ...subsectors,
    ...productsAndServices,
    ...products,
    ...services,
    ...actors,
    ...businessModels,
    ...activities,
    ...adjacentTerms,
  ]).filter((term) => !GENERIC_INDUSTRY_WORDS.has(term));
  const queryFacets = [
    ...unique([
      ...(vocabularyEntry ? [vocabularyEntry.key] : [normalizedIndustry]),
      ...aliases,
      ...subsectors,
    ]).map((term) => ({
      family: "identity" as const,
      term,
    })),
    ...actors.map((term) => ({ family: "actor" as const, term })),
    ...productsAndServices.map((term) => ({
      family: "product-service" as const,
      term,
    })),
    ...products.map((term) => ({ family: "product-service" as const, term })),
    ...services.map((term) => ({ family: "product-service" as const, term })),
    ...businessModels.map((term) => ({ family: "business-model" as const, term })),
    ...distributionChannels.map((term) => ({ family: "distribution-channel" as const, term })),
    ...platformRelationships.map((term) => ({ family: "platform-relationship" as const, term })),
    ...activities.map((term) => ({ family: "activity" as const, term })),
    ...workforceRelationships.map((term) => ({ family: "workforce-relationship" as const, term })),
    ...supplyChainRelationships.map((term) => ({ family: "supply-chain-relationship" as const, term })),
    ...customerOrUserRelationships.map((term) => ({ family: "customer-user-relationship" as const, term })),
    ...regulatorySurfaces.map((term) => ({ family: "regulatory-surface" as const, term })),
    ...disruptionSurfaces.map((term) => ({ family: "disruption-surface" as const, term })),
    ...adjacentActivities.map((term) => ({
      family: "adjacent-activity" as const,
      term,
    })),
  ].filter((facet) => facet.term && !GENERIC_INDUSTRY_WORDS.has(facet.term));

  const ready = Boolean(
    normalizedIndustry && (crossIndustry || directTerms.length > 0) && !ambiguous,
  );
  const ambiguity = ambiguous && vocabulary?.ambiguity
    ? {
        code: vocabulary.ambiguity.code,
        question: vocabulary.ambiguity.question,
        explanation: vocabulary.ambiguity.explanation,
      }
    : !ready
      ? {
          code: "distinct-economic-activity-required",
          question: "Which economic activity is in scope?",
          explanation:
            "The current label contains no distinctive activity terms. Enter the industry, product, service, or business activity that defines the sample.",
        }
      : null;
  const interpretationAlternatives = ambiguous
    ? (vocabulary?.ambiguity?.alternatives ?? [])
      .map((alternative) => ({ ...alternative }))
    : [];
  return {
    version: SCREEN02_RELEVANCE_PROFILE_VERSION,
    industry: cleanIndustry,
    normalizedIndustry,
    status: ready ? "ready" : "needs-clarification",
    canonicalIndustryCode: ready
      ? canonicalScreen02IndustryCode(cleanIndustry)
      : null,
    ambiguity,
    interpretationAlternatives,
    scopeMode: crossIndustry ? "cross-industry" : "target-industry",
    directTerms,
    adjacentTerms,
    broadBridgeTerms,
    falseFriends: unique([
      ...(vocabulary?.contrastTerms ?? []),
      ...(vocabulary?.falseFriends ?? []),
    ]),
    queryFacets,
    note: ready
      ? crossIndustry
        ? "The confirmed scope explicitly spans industries; records still need source-backed organizational applicability."
        : `Built one versioned relevance profile with ${directTerms.length} direct terms, ${adjacentTerms.length} adjacent activities, and ${vocabulary ? "reviewed" : "derived"} vocabulary.`
      : ambiguous
        ? `The industry label “${cleanIndustry}” is ambiguous. Clarify the economic activity before discovery.`
        : "A nonempty distinctive industry or activity is required before discovery.",
  };
}

export function distinctiveScreen02ResearchTerms(researchText: string) {
  return unique(
    normalizeScreen02DiscoveryText(researchText)
      .split(" ")
      .filter(
        (term) =>
          term.length >= 3 &&
          !RESEARCH_BOILERPLATE_WORDS.has(term) &&
          !/^\d+$/u.test(term),
      )
      .flatMap(singularVariants),
  );
}

/**
 * Returns the one bounded, provider-owned recovery query for a confirmed
 * industry. The mapped term is retrieval vocabulary only; it never becomes
 * qualification evidence. Singular `video game` follows the FTC index's
 * observed wording, while the broad `energy` token preserves recall for
 * agencies whose titles use a more specific activity such as electric
 * storage.
 */
export function screen02IndustryRecoveryQuery(industry: string) {
  const normalized = normalizeScreen02DiscoveryText(industry);
  if (normalized === "video gaming" || normalized === "video games") {
    return "video game";
  }
  if (normalized === "energy" || normalized === "energy sector") {
    return "energy";
  }
  return industry.replace(/\s+/gu, " ").trim();
}

export type Screen02StudyRelevanceProfileOrigin =
  | "fixed-profile"
  | "chatgpt-host-enriched"
  | "researcher-edited";

export const SCREEN02_PROFILE_HOST_ADDITION_FIELDS = [
  "industryAliases",
  "internationalVariants",
  "subsectors",
  "products",
  "services",
  "industryActors",
  "regulatedActivities",
  "platformRelationships",
  "contrastTerms",
  "falseFriends",
  "jurisdictionAliases",
] as const;

export type Screen02StudyRelevanceProfileHostAdditionField =
  (typeof SCREEN02_PROFILE_HOST_ADDITION_FIELDS)[number];

export type Screen02StudyRelevanceProfileHostAdditions = Partial<
  Record<Screen02StudyRelevanceProfileHostAdditionField, string[]>
>;

export type Screen02StudyRelevanceProfileHostCacheEntry = {
  schemaVersion: typeof SCREEN02_PROFILE_HOST_CACHE_SCHEMA_VERSION;
  cacheKey: string;
  scopeFingerprint: string;
  promptVersion: string;
  taskId: string;
  status: "applied" | "stale";
  staleReason: "scope-changed" | "researcher-edited" | null;
  inputFingerprint: string;
  contentFingerprint: string;
  additions: Screen02StudyRelevanceProfileHostAdditions;
  appliedAt: string;
};

/** The reusable cache identity is exactly scope plus prompt version. */
export function screen02StudyRelevanceProfileHostCacheKey(
  scopeFingerprint: string,
  promptVersion: string,
) {
  return fingerprintScreen02ProfileValue({
    schemaVersion: SCREEN02_PROFILE_HOST_CACHE_SCHEMA_VERSION,
    scopeFingerprint,
    promptVersion,
  });
}

export type Screen02StudyRelevanceProfile = {
  schemaVersion: typeof SCREEN02_STUDY_RELEVANCE_PROFILE_SCHEMA_VERSION;
  scopeFingerprint: string;
  originalIndustryText: string;
  canonicalIndustryLabel: string;
  canonicalIndustryCode: string | null;
  status: "ready" | "needs-clarification";
  ambiguity: Screen02IndustryInterpretationAmbiguity | null;
  interpretationAlternatives: Screen02IndustryInterpretationAlternative[];
  industryAliases: string[];
  internationalVariants: string[];
  subsectors: string[];
  products: string[];
  services: string[];
  industryActors: string[];
  businessModels: string[];
  distributionChannels: string[];
  platformRelationships: string[];
  regulatedActivities: string[];
  workforceRelationships: string[];
  supplyChainRelationships: string[];
  customerOrUserRelationships: string[];
  regulatorySurfaces: string[];
  disruptionSurfaces: string[];
  contrastTerms: string[];
  falseFriends: string[];
  sampleGeography: string;
  geographyAliases: string[];
  possibleIssuingJurisdictions: string[];
  jurisdictionAliases: string[];
  studyStartYear: number | null;
  studyEndYear: number | null;
  eventFamilyTerms: string[];
  requiredCriteria: string[];
  preferredCriteria: string[];
  avoidedCriteria: string[];
  origin: Screen02StudyRelevanceProfileOrigin;
  profileVersion: string;
  hostEnrichmentCache: Screen02StudyRelevanceProfileHostCacheEntry[];
  createdAt: string;
  updatedAt: string;
};

export type Screen02StudyRelevanceProfileInput = {
  scopeFingerprint: string;
  originalIndustryText: string;
  sampleGeography: string;
  studyPeriod: string;
  eventFamily: string;
  requiredCriteria?: readonly string[];
  preferredCriteria?: readonly string[];
  avoidedCriteria?: readonly string[];
  hostEnrichmentCache?: readonly Screen02StudyRelevanceProfileHostCacheEntry[];
  at: string;
};

const SCREEN02_PROFILE_ARRAY_KEYS = [
  "industryAliases",
  "internationalVariants",
  "subsectors",
  "products",
  "services",
  "industryActors",
  "businessModels",
  "distributionChannels",
  "platformRelationships",
  "regulatedActivities",
  "workforceRelationships",
  "supplyChainRelationships",
  "customerOrUserRelationships",
  "regulatorySurfaces",
  "disruptionSurfaces",
  "contrastTerms",
  "falseFriends",
  "geographyAliases",
  "possibleIssuingJurisdictions",
  "jurisdictionAliases",
  "eventFamilyTerms",
  "requiredCriteria",
  "preferredCriteria",
  "avoidedCriteria",
] as const;

type Screen02ProfileArrayKey = (typeof SCREEN02_PROFILE_ARRAY_KEYS)[number];

const SCREEN02_PROFILE_RELATIONSHIP_KEYS = [
  "industryAliases",
  "internationalVariants",
  "subsectors",
  "products",
  "services",
  "industryActors",
  "businessModels",
  "distributionChannels",
  "platformRelationships",
  "regulatedActivities",
  "workforceRelationships",
  "supplyChainRelationships",
  "customerOrUserRelationships",
  "regulatorySurfaces",
  "disruptionSurfaces",
] as const satisfies readonly Screen02ProfileArrayKey[];

const GEOGRAPHY_VOCABULARY: Readonly<
  Record<string, { aliases: readonly string[]; jurisdictions: readonly string[] }>
> = {
  "united states": {
    aliases: ["U.S.", "US", "USA", "United States of America"],
    jurisdictions: ["United States", "U.S. federal", "U.S. states"],
  },
  "european union": {
    aliases: ["EU", "European Economic Area", "EEA"],
    jurisdictions: ["European Union", "EU member states"],
  },
  "united kingdom": {
    aliases: ["UK", "Great Britain"],
    jurisdictions: ["United Kingdom", "England", "Scotland", "Wales", "Northern Ireland"],
  },
};

function cleanBoundedText(value: string, label: string, maxLength = 240) {
  const clean = value.replace(/[\u0000-\u001f\u007f]/gu, " ").replace(/\s+/gu, " ").trim();
  if (!clean) throw new Error(`${label} must not be empty.`);
  if (clean.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  }
  return clean;
}

function cleanBoundedList(
  values: readonly string[] | undefined,
  label: string,
  maximum = 32,
) {
  if ((values?.length ?? 0) > maximum) {
    throw new Error(`${label} accepts at most ${maximum} values.`);
  }
  return unique(
    (values ?? []).map((value) => cleanBoundedText(value, label, 160)),
  );
}

function requireTimestamp(value: string, label: string) {
  const clean = cleanBoundedText(value, label, 40);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(clean)) {
    throw new Error(`${label} must be an ISO-8601 UTC timestamp.`);
  }
  return clean;
}

function studyYears(studyPeriod: string) {
  const years = [...studyPeriod.matchAll(/\b(?:18|19|20|21)\d{2}\b/gu)].map(
    (match) => Number(match[0]),
  );
  return {
    studyStartYear: years.length > 0 ? Math.min(...years) : null,
    studyEndYear: years.length > 0 ? Math.max(...years) : null,
  };
}

function geographyProfile(sampleGeography: string) {
  const normalized = normalizeScreen02DiscoveryText(sampleGeography);
  const exact = GEOGRAPHY_VOCABULARY[normalized];
  if (exact) return exact;
  return {
    aliases: unique([sampleGeography]),
    jurisdictions: unique([sampleGeography]),
  };
}

const screen02ProfileFingerprintPattern =
  /^(?:fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})$/u;
const screen02ProfileIdentifierPattern =
  /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u;

function normalizeScreen02HostAdditions(
  additions: Screen02StudyRelevanceProfileHostAdditions,
  maximum = 12,
) {
  if (!additions || typeof additions !== "object" || Array.isArray(additions)) {
    throw new Error("Host profile additions must be an object.");
  }
  const unsupportedKey = Object.keys(additions).find(
    (key) => !SCREEN02_PROFILE_HOST_ADDITION_FIELDS.includes(
      key as Screen02StudyRelevanceProfileHostAdditionField,
    ),
  );
  if (unsupportedKey) {
    throw new Error(`Unsupported host profile addition: ${unsupportedKey}`);
  }
  const normalized: Screen02StudyRelevanceProfileHostAdditions = {};
  for (const key of SCREEN02_PROFILE_HOST_ADDITION_FIELDS) {
    if (additions[key] !== undefined) {
      normalized[key] = cleanBoundedList(additions[key], key, maximum);
    }
  }
  return normalized;
}

function normalizeScreen02HostCacheEntry(
  value: Screen02StudyRelevanceProfileHostCacheEntry,
  currentScopeFingerprint: string,
): Screen02StudyRelevanceProfileHostCacheEntry {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      !exactKeys(value as unknown as Record<string, unknown>, [
        "schemaVersion", "cacheKey", "scopeFingerprint", "promptVersion",
        "taskId", "status", "staleReason", "inputFingerprint",
        "contentFingerprint", "additions", "appliedAt",
      ])) {
    throw new Error("Host profile cache entry has unknown or missing fields.");
  }
  if (value.schemaVersion !== SCREEN02_PROFILE_HOST_CACHE_SCHEMA_VERSION) {
    throw new Error("Host profile cache entry schema is unsupported.");
  }
  const scopeFingerprint = cleanBoundedText(
    value.scopeFingerprint,
    "hostEnrichmentCache.scopeFingerprint",
    160,
  );
  const promptVersion = cleanBoundedText(
    value.promptVersion,
    "hostEnrichmentCache.promptVersion",
    200,
  );
  const taskId = cleanBoundedText(
    value.taskId,
    "hostEnrichmentCache.taskId",
    200,
  );
  if (!screen02ProfileIdentifierPattern.test(promptVersion) ||
      !screen02ProfileIdentifierPattern.test(taskId)) {
    throw new Error("Host profile cache version and task ID must be canonical identifiers.");
  }
  if (!screen02ProfileFingerprintPattern.test(value.inputFingerprint) ||
      !screen02ProfileFingerprintPattern.test(value.contentFingerprint)) {
    throw new Error("Host profile cache fingerprints are malformed.");
  }
  const additions = normalizeScreen02HostAdditions(value.additions);
  const contentFingerprint = fingerprintScreen02ProfileValue(additions);
  if (value.contentFingerprint !== contentFingerprint) {
    throw new Error("Host profile cache content fingerprint does not match its additions.");
  }
  const cacheKey = screen02StudyRelevanceProfileHostCacheKey(
    scopeFingerprint,
    promptVersion,
  );
  if (value.cacheKey !== cacheKey) {
    throw new Error("Host profile cache key does not match scope and prompt version.");
  }
  const appliedAt = requireTimestamp(
    value.appliedAt,
    "hostEnrichmentCache.appliedAt",
  );
  const scopeChanged = scopeFingerprint !== currentScopeFingerprint;
  const status = scopeChanged ? "stale" as const : value.status;
  const staleReason = scopeChanged ? "scope-changed" as const : value.staleReason;
  if (!(["applied", "stale"] as const).includes(status) ||
      (status === "applied" && staleReason !== null) ||
      (status === "stale" &&
        !(["scope-changed", "researcher-edited"] as const).includes(
          staleReason as "scope-changed" | "researcher-edited",
        ))) {
    throw new Error("Host profile cache status and stale reason are inconsistent.");
  }
  return {
    schemaVersion: SCREEN02_PROFILE_HOST_CACHE_SCHEMA_VERSION,
    cacheKey,
    scopeFingerprint,
    promptVersion,
    taskId,
    status,
    staleReason,
    inputFingerprint: value.inputFingerprint,
    contentFingerprint,
    additions,
    appliedAt,
  };
}

function normalizeScreen02HostCache(
  values: readonly Screen02StudyRelevanceProfileHostCacheEntry[] | undefined,
  currentScopeFingerprint: string,
) {
  if ((values?.length ?? 0) > 8) {
    throw new Error("A Screen 2 profile accepts at most eight host cache entries.");
  }
  const entries = (values ?? []).map((entry) =>
    normalizeScreen02HostCacheEntry(entry, currentScopeFingerprint)
  );
  if (new Set(entries.map((entry) => entry.cacheKey)).size !== entries.length) {
    throw new Error("Host profile cache keys must be unique.");
  }
  return entries;
}

function applyScreen02HostAdditionsToProfile(
  profile: Screen02StudyRelevanceProfile,
  additions: Screen02StudyRelevanceProfileHostAdditions,
) {
  for (const key of SCREEN02_PROFILE_HOST_ADDITION_FIELDS) {
    const values = additions[key];
    if (values !== undefined) {
      profile[key] = cleanBoundedList([...profile[key], ...values], key, 32);
    }
  }
}

/** Builds the deterministic, immediately usable profile from bounded study input. */
export function buildScreen02StudyRelevanceProfile(
  input: Screen02StudyRelevanceProfileInput,
): Screen02StudyRelevanceProfile {
  const scopeFingerprint = cleanBoundedText(
    input.scopeFingerprint,
    "scopeFingerprint",
    160,
  );
  const originalIndustryText = cleanBoundedText(
    input.originalIndustryText,
    "originalIndustryText",
  );
  const sampleGeography = cleanBoundedText(
    input.sampleGeography,
    "sampleGeography",
  );
  const studyPeriod = cleanBoundedText(input.studyPeriod, "studyPeriod");
  const eventFamily = cleanBoundedText(input.eventFamily, "eventFamily");
  const at = requireTimestamp(input.at, "at");
  const vocabularyEntry = vocabularyFor(originalIndustryText);
  const vocabulary = vocabularyEntry?.value;
  const industryInterpretation = buildScreen02IndustryRelevanceProfile(
    originalIndustryText,
  );
  const derivedTerms = genericIndustryTerms(originalIndustryText);
  const geography = geographyProfile(sampleGeography);
  const canonicalIndustryLabel =
    vocabularyEntry?.key ?? normalizeScreen02DiscoveryText(originalIndustryText);
  const products = unique([
    ...(vocabulary?.products ?? []),
    ...(vocabulary?.productsAndServices ?? []),
  ]);
  const services = unique([
    ...(vocabulary?.services ?? []),
    ...(vocabulary?.productsAndServices ?? []),
  ]);
  const hostEnrichmentCache = normalizeScreen02HostCache(
    input.hostEnrichmentCache,
    scopeFingerprint,
  );
  const profile: Screen02StudyRelevanceProfile = {
    schemaVersion: SCREEN02_STUDY_RELEVANCE_PROFILE_SCHEMA_VERSION,
    scopeFingerprint,
    originalIndustryText,
    canonicalIndustryLabel,
    canonicalIndustryCode: industryInterpretation.canonicalIndustryCode,
    status: industryInterpretation.status,
    ambiguity: industryInterpretation.ambiguity,
    interpretationAlternatives:
      industryInterpretation.interpretationAlternatives,
    industryAliases: unique([
      ...derivedTerms,
      ...(vocabulary?.aliases ?? []),
    ]),
    internationalVariants: unique(vocabulary?.internationalVariants ?? []),
    subsectors: unique(vocabulary?.subsectors ?? []),
    products,
    services,
    industryActors: unique(vocabulary?.actors ?? []),
    businessModels: unique(vocabulary?.businessModels ?? []),
    distributionChannels: unique(vocabulary?.distributionChannels ?? []),
    platformRelationships: unique(vocabulary?.platformRelationships ?? []),
    regulatedActivities: unique(vocabulary?.activities ?? []),
    workforceRelationships: unique(vocabulary?.workforceRelationships ?? []),
    supplyChainRelationships: unique(vocabulary?.supplyChainRelationships ?? []),
    customerOrUserRelationships: unique(
      vocabulary?.customerOrUserRelationships ?? [],
    ),
    regulatorySurfaces: unique(vocabulary?.regulatorySurfaces ?? []),
    disruptionSurfaces: unique(vocabulary?.disruptionSurfaces ?? []),
    contrastTerms: unique(vocabulary?.contrastTerms ?? []),
    falseFriends: unique(vocabulary?.falseFriends ?? []),
    sampleGeography,
    geographyAliases: unique([sampleGeography, ...geography.aliases]),
    possibleIssuingJurisdictions: unique(geography.jurisdictions),
    jurisdictionAliases: unique(geography.aliases),
    ...studyYears(studyPeriod),
    eventFamilyTerms: unique([
      eventFamily,
      ...normalizeScreen02DiscoveryText(eventFamily)
        .split(" ")
        .filter((term) => term.length >= 4),
    ]),
    requiredCriteria: cleanBoundedList(input.requiredCriteria, "requiredCriteria", 12),
    preferredCriteria: cleanBoundedList(input.preferredCriteria, "preferredCriteria", 12),
    avoidedCriteria: cleanBoundedList(input.avoidedCriteria, "avoidedCriteria", 12),
    origin: hostEnrichmentCache.some((entry) => entry.status === "applied")
      ? "chatgpt-host-enriched"
      : "fixed-profile",
    profileVersion: SCREEN02_INDUSTRY_VOCABULARY_METADATA.version,
    hostEnrichmentCache,
    createdAt: at,
    updatedAt: at,
  };
  for (const entry of hostEnrichmentCache) {
    if (entry.status === "applied") {
      applyScreen02HostAdditionsToProfile(profile, entry.additions);
    }
  }
  if (!isScreen02StudyRelevanceProfile(profile)) {
    throw new Error("The deterministic Screen 2 relevance profile failed validation.");
  }
  return profile;
}

/**
 * Fields a researcher may correct without changing the confirmed Screen 1
 * scope. The original industry wording, sample geography, study years, and
 * event family remain fixed scope inputs. Geography/jurisdiction arrays are
 * search vocabulary and may be corrected without rewriting sampleGeography.
 */
const SCREEN02_RESEARCHER_EDITABLE_PROFILE_ARRAY_KEYS = [
  "industryAliases",
  "internationalVariants",
  "subsectors",
  "products",
  "services",
  "industryActors",
  "businessModels",
  "distributionChannels",
  "platformRelationships",
  "regulatedActivities",
  "workforceRelationships",
  "supplyChainRelationships",
  "customerOrUserRelationships",
  "regulatorySurfaces",
  "disruptionSurfaces",
  "contrastTerms",
  "falseFriends",
  "geographyAliases",
  "possibleIssuingJurisdictions",
  "jurisdictionAliases",
  "requiredCriteria",
  "preferredCriteria",
  "avoidedCriteria",
] as const satisfies readonly Screen02ProfileArrayKey[];

type Screen02ResearcherEditableProfileArrayKey =
  (typeof SCREEN02_RESEARCHER_EDITABLE_PROFILE_ARRAY_KEYS)[number];

export type Screen02StudyRelevanceProfileResearcherEdits = Partial<
  Pick<
    Screen02StudyRelevanceProfile,
    | Screen02ResearcherEditableProfileArrayKey
    | "canonicalIndustryLabel"
    | "canonicalIndustryCode"
  >
>;

function replaceScreen02IndustryInterpretation(
  profile: Screen02StudyRelevanceProfile,
  canonicalIndustryLabel: string,
  requestedCode?: string | null,
) {
  const label = cleanBoundedText(
    canonicalIndustryLabel,
    "canonicalIndustryLabel",
  );
  const interpretation = buildScreen02IndustryRelevanceProfile(label);
  if (interpretation.status !== "ready" ||
      interpretation.canonicalIndustryCode === null) {
    throw new Error(
      "The industry interpretation still needs clarification before discovery.",
    );
  }
  if (requestedCode !== undefined &&
      requestedCode !== interpretation.canonicalIndustryCode) {
    throw new Error(
      "canonicalIndustryCode does not match the selected industry interpretation.",
    );
  }
  const vocabulary = vocabularyFor(label)?.value;
  const derivedTerms = genericIndustryTerms(label);
  profile.canonicalIndustryLabel = label;
  profile.canonicalIndustryCode = interpretation.canonicalIndustryCode;
  profile.status = "ready";
  profile.ambiguity = null;
  profile.interpretationAlternatives = [];
  profile.industryAliases = unique([
    ...derivedTerms,
    ...(vocabulary?.aliases ?? []),
  ]);
  profile.internationalVariants = unique(
    vocabulary?.internationalVariants ?? [],
  );
  profile.subsectors = unique(vocabulary?.subsectors ?? []);
  profile.products = unique([
    ...(vocabulary?.products ?? []),
    ...(vocabulary?.productsAndServices ?? []),
  ]);
  profile.services = unique([
    ...(vocabulary?.services ?? []),
    ...(vocabulary?.productsAndServices ?? []),
  ]);
  profile.industryActors = unique(vocabulary?.actors ?? []);
  profile.businessModels = unique(vocabulary?.businessModels ?? []);
  profile.distributionChannels = unique(vocabulary?.distributionChannels ?? []);
  profile.platformRelationships = unique(vocabulary?.platformRelationships ?? []);
  profile.regulatedActivities = unique(vocabulary?.activities ?? []);
  profile.workforceRelationships = unique(vocabulary?.workforceRelationships ?? []);
  profile.supplyChainRelationships = unique(vocabulary?.supplyChainRelationships ?? []);
  profile.customerOrUserRelationships = unique(
    vocabulary?.customerOrUserRelationships ?? [],
  );
  profile.regulatorySurfaces = unique(vocabulary?.regulatorySurfaces ?? []);
  profile.disruptionSurfaces = unique(vocabulary?.disruptionSurfaces ?? []);
  profile.contrastTerms = unique(vocabulary?.contrastTerms ?? []);
  profile.falseFriends = unique(vocabulary?.falseFriends ?? []);
}

/** Applies a bounded correction without rewriting the original industry text. */
export function mergeScreen02StudyRelevanceProfileResearcherEdits(
  profile: Screen02StudyRelevanceProfile,
  edits: Screen02StudyRelevanceProfileResearcherEdits,
  updatedAt: string,
) {
  if (!isScreen02StudyRelevanceProfile(profile)) {
    throw new Error("Cannot edit an invalid Screen 2 relevance profile.");
  }
  if (!edits || typeof edits !== "object" || Array.isArray(edits)) {
    throw new Error("Screen 2 relevance-profile edits must be an object.");
  }
  const allowedKeys = new Set<string>([
    ...SCREEN02_RESEARCHER_EDITABLE_PROFILE_ARRAY_KEYS,
    "canonicalIndustryLabel",
    "canonicalIndustryCode",
  ]);
  const unsupportedKey = Object.keys(edits).find((key) => !allowedKeys.has(key));
  if (unsupportedKey) {
    throw new Error(
      `${unsupportedKey} is fixed by the confirmed Screen 1 scope and cannot be edited here.`,
    );
  }
  const next = structuredClone(profile);
  // An edit changes the input to host enrichment. Remove only additions that
  // were novel when accepted, then mark their cache entries stale. Explicit
  // researcher values applied below may deliberately add the same term back.
  for (const entry of next.hostEnrichmentCache) {
    if (entry.status !== "applied") continue;
    for (const key of SCREEN02_PROFILE_HOST_ADDITION_FIELDS) {
      const additions = new Set(entry.additions[key] ?? []);
      if (additions.size > 0) {
        next[key] = next[key].filter((term) => !additions.has(term));
      }
    }
  }
  if (edits.canonicalIndustryCode !== undefined &&
      edits.canonicalIndustryLabel === undefined) {
    throw new Error(
      "canonicalIndustryCode may be supplied only with its interpretation label.",
    );
  }
  if (edits.canonicalIndustryLabel !== undefined) {
    replaceScreen02IndustryInterpretation(
      next,
      edits.canonicalIndustryLabel,
      edits.canonicalIndustryCode,
    );
  }
  for (const key of SCREEN02_RESEARCHER_EDITABLE_PROFILE_ARRAY_KEYS) {
    const values = edits[key];
    if (values !== undefined) {
      next[key] = cleanBoundedList(values, key);
    }
  }
  next.hostEnrichmentCache = next.hostEnrichmentCache.map((entry) =>
    entry.status === "applied"
      ? {
          ...entry,
          status: "stale" as const,
          staleReason: "researcher-edited" as const,
        }
      : entry
  );
  next.origin = "researcher-edited";
  next.updatedAt = requireTimestamp(updatedAt, "updatedAt");
  if (Date.parse(next.updatedAt) <= Date.parse(profile.updatedAt)) {
    throw new Error("updatedAt must advance the current profile revision.");
  }
  if (!isScreen02StudyRelevanceProfile(next)) {
    throw new Error("The edited Screen 2 relevance profile failed validation.");
  }
  return next;
}

export type Screen02StudyRelevanceProfileHostProvenance = {
  promptVersion: string;
  taskId: string;
  inputFingerprint: string;
};

/** Adds validated host vocabulary without replacing fixed/researcher terms. */
export function mergeScreen02StudyRelevanceProfileHostAdditions(
  profile: Screen02StudyRelevanceProfile,
  additions: Screen02StudyRelevanceProfileHostAdditions,
  updatedAt: string,
  provenance: Screen02StudyRelevanceProfileHostProvenance,
) {
  if (!isScreen02StudyRelevanceProfile(profile)) {
    throw new Error("Cannot enrich an invalid Screen 2 relevance profile.");
  }
  if (profile.status !== "ready" || profile.canonicalIndustryCode === null) {
    throw new Error(
      "Clarify the industry interpretation before applying host enrichment.",
    );
  }
  if (!provenance || typeof provenance !== "object" ||
      !screen02ProfileIdentifierPattern.test(provenance.promptVersion) ||
      !screen02ProfileIdentifierPattern.test(provenance.taskId) ||
      !screen02ProfileFingerprintPattern.test(provenance.inputFingerprint)) {
    throw new Error(
      "Host profile enrichment requires canonical prompt, task, and input-fingerprint provenance.",
    );
  }
  const next = structuredClone(profile);
  const normalizedAdditions = normalizeScreen02HostAdditions(additions);
  for (const key of SCREEN02_PROFILE_HOST_ADDITION_FIELDS) {
    const values = normalizedAdditions[key];
    if (values === undefined) continue;
    if (!["contrastTerms", "falseFriends", "jurisdictionAliases"].includes(key)) {
      if (values.some((term) => genericIndustryTerms(term).length === 0)) {
        throw new Error(`${key} contains a generic-only industry term.`);
      }
    }
  }
  const cacheKey = screen02StudyRelevanceProfileHostCacheKey(
    next.scopeFingerprint,
    provenance.promptVersion,
  );
  const replacedEntry = next.hostEnrichmentCache.find((entry) =>
    entry.cacheKey === cacheKey && entry.status === "applied"
  );
  if (replacedEntry) {
    const otherAppliedEntries = next.hostEnrichmentCache.filter((entry) =>
      entry !== replacedEntry && entry.status === "applied"
    );
    for (const key of SCREEN02_PROFILE_HOST_ADDITION_FIELDS) {
      const replacedTerms = new Set(replacedEntry.additions[key] ?? []);
      if (replacedTerms.size === 0) continue;
      const termsOwnedByAnotherEntry = new Set(
        otherAppliedEntries.flatMap((entry) => entry.additions[key] ?? []),
      );
      next[key] = next[key].filter((term) =>
        !replacedTerms.has(term) || termsOwnedByAnotherEntry.has(term)
      );
    }
  }
  const novelAdditions: Screen02StudyRelevanceProfileHostAdditions = {};
  for (const key of SCREEN02_PROFILE_HOST_ADDITION_FIELDS) {
    const values = normalizedAdditions[key];
    if (values !== undefined) {
      novelAdditions[key] = values.filter((value) => !next[key].includes(value));
    }
  }
  applyScreen02HostAdditionsToProfile(next, novelAdditions);
  const at = requireTimestamp(updatedAt, "updatedAt");
  if (Date.parse(at) <= Date.parse(profile.updatedAt)) {
    throw new Error("updatedAt must advance the current profile revision.");
  }
  const cacheEntry: Screen02StudyRelevanceProfileHostCacheEntry = {
    schemaVersion: SCREEN02_PROFILE_HOST_CACHE_SCHEMA_VERSION,
    cacheKey,
    scopeFingerprint: next.scopeFingerprint,
    promptVersion: provenance.promptVersion,
    taskId: provenance.taskId,
    status: "applied",
    staleReason: null,
    inputFingerprint: provenance.inputFingerprint,
    contentFingerprint: fingerprintScreen02ProfileValue(novelAdditions),
    additions: novelAdditions,
    appliedAt: at,
  };
  next.hostEnrichmentCache = [
    ...next.hostEnrichmentCache.filter((entry) => entry.cacheKey !== cacheKey),
    cacheEntry,
  ].slice(-8);
  next.origin = "chatgpt-host-enriched";
  next.updatedAt = at;
  if (!isScreen02StudyRelevanceProfile(next)) {
    throw new Error("The host-enriched Screen 2 relevance profile failed validation.");
  }
  return next;
}

/** Returns a defensive copy only for the exact reusable cache coordinates. */
export function cachedScreen02StudyRelevanceProfileHostEnrichment(
  profile: Screen02StudyRelevanceProfile,
  input: {
    scopeFingerprint: string;
    promptVersion: string;
    inputFingerprint: string;
  },
) {
  if (!isScreen02StudyRelevanceProfile(profile)) return null;
  const cacheKey = screen02StudyRelevanceProfileHostCacheKey(
    input.scopeFingerprint,
    input.promptVersion,
  );
  const entry = profile.hostEnrichmentCache.find((candidate) =>
    candidate.cacheKey === cacheKey &&
    candidate.scopeFingerprint === input.scopeFingerprint &&
    candidate.promptVersion === input.promptVersion &&
    candidate.inputFingerprint === input.inputFingerprint &&
    candidate.status === "applied" &&
    candidate.staleReason === null &&
    candidate.contentFingerprint ===
      fingerprintScreen02ProfileValue(candidate.additions)
  );
  return entry ? structuredClone(entry) : null;
}

export function isScreen02StudyRelevanceProfile(
  value: unknown,
): value is Screen02StudyRelevanceProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const expectedKeys = [
    "schemaVersion", "scopeFingerprint", "originalIndustryText",
    "canonicalIndustryLabel", "canonicalIndustryCode", "status",
    "ambiguity", "interpretationAlternatives", ...SCREEN02_PROFILE_ARRAY_KEYS,
    "sampleGeography", "studyStartYear", "studyEndYear", "origin",
    "profileVersion", "hostEnrichmentCache", "createdAt", "updatedAt",
  ];
  if (!exactKeys(value as Record<string, unknown>, expectedKeys)) return false;
  const profile = value as Partial<Screen02StudyRelevanceProfile>;
  if (
    profile.schemaVersion !== SCREEN02_STUDY_RELEVANCE_PROFILE_SCHEMA_VERSION ||
    typeof profile.scopeFingerprint !== "string" ||
    !profile.scopeFingerprint ||
    typeof profile.originalIndustryText !== "string" ||
    !profile.originalIndustryText ||
    typeof profile.canonicalIndustryLabel !== "string" ||
    !profile.canonicalIndustryLabel ||
    !["ready", "needs-clarification"].includes(profile.status ?? "") ||
    typeof profile.sampleGeography !== "string" ||
    !profile.sampleGeography ||
    !["fixed-profile", "chatgpt-host-enriched", "researcher-edited"].includes(
      profile.origin ?? "",
    ) ||
    profile.profileVersion !== SCREEN02_INDUSTRY_VOCABULARY_METADATA.version ||
    typeof profile.createdAt !== "string" ||
    typeof profile.updatedAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(profile.createdAt) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(profile.updatedAt) ||
    Date.parse(profile.updatedAt) < Date.parse(profile.createdAt)
  ) {
    return false;
  }
  if (
    (profile.status === "ready" &&
      (typeof profile.canonicalIndustryCode !== "string" ||
        !screen02ProfileIdentifierPattern.test(profile.canonicalIndustryCode) ||
        profile.canonicalIndustryCode !==
          canonicalScreen02IndustryCode(profile.canonicalIndustryLabel))) ||
    (profile.status === "needs-clarification" &&
      profile.canonicalIndustryCode !== null)
  ) return false;
  if (!Array.isArray(profile.interpretationAlternatives) ||
      profile.interpretationAlternatives.length > 8) return false;
  const interpretationAlternatives = profile.interpretationAlternatives;
  if (!interpretationAlternatives.every((alternative) =>
    alternative && typeof alternative === "object" &&
    !Array.isArray(alternative) &&
    exactKeys(alternative as unknown as Record<string, unknown>, [
      "canonicalCode", "canonicalLabel", "description",
    ]) &&
    typeof alternative.canonicalCode === "string" &&
    screen02ProfileIdentifierPattern.test(alternative.canonicalCode) &&
    typeof alternative.canonicalLabel === "string" &&
    alternative.canonicalLabel.length > 0 &&
    alternative.canonicalLabel.length <= 160 &&
    canonicalScreen02IndustryCode(alternative.canonicalLabel) ===
      alternative.canonicalCode &&
    typeof alternative.description === "string" &&
    alternative.description.length > 0 &&
    alternative.description.length <= 300
  )) return false;
  if (new Set(interpretationAlternatives.map((alternative) =>
    alternative.canonicalCode)).size !== interpretationAlternatives.length) {
    return false;
  }
  if (profile.ambiguity === null) {
    if (interpretationAlternatives.length !== 0 ||
        profile.status === "needs-clarification") return false;
  } else {
    if (!profile.ambiguity || typeof profile.ambiguity !== "object" ||
        Array.isArray(profile.ambiguity) ||
        profile.status !== "needs-clarification" ||
        !exactKeys(profile.ambiguity as unknown as Record<string, unknown>, [
          "code", "question", "explanation",
        ]) ||
        !screen02ProfileIdentifierPattern.test(profile.ambiguity.code) ||
        !profile.ambiguity.question || profile.ambiguity.question.length > 300 ||
        !profile.ambiguity.explanation ||
        profile.ambiguity.explanation.length > 600) return false;
  }
  if (
    profile.studyStartYear !== null &&
    (!Number.isInteger(profile.studyStartYear) || profile.studyStartYear! < 1800)
  ) return false;
  if (
    profile.studyEndYear !== null &&
    (!Number.isInteger(profile.studyEndYear) || profile.studyEndYear! > 2199)
  ) return false;
  if (
    typeof profile.studyStartYear === "number" &&
    typeof profile.studyEndYear === "number" &&
    profile.studyStartYear > profile.studyEndYear
  ) return false;
  if (!SCREEN02_PROFILE_ARRAY_KEYS.every((key) =>
    Array.isArray(profile[key]) &&
    profile[key]!.length <= 32 &&
    profile[key]!.every(
      (entry) =>
        typeof entry === "string" && entry.length > 0 && entry.length <= 160,
    )
  )) return false;
  if (!Array.isArray(profile.hostEnrichmentCache) ||
      profile.hostEnrichmentCache.length > 8) return false;
  let normalizedCache: Screen02StudyRelevanceProfileHostCacheEntry[];
  try {
    normalizedCache = normalizeScreen02HostCache(
      profile.hostEnrichmentCache,
      profile.scopeFingerprint,
    );
  } catch {
    return false;
  }
  if (fingerprintScreen02ProfileValue(normalizedCache) !==
      fingerprintScreen02ProfileValue(profile.hostEnrichmentCache)) return false;
  if (normalizedCache.some((entry) =>
    Date.parse(entry.appliedAt) > Date.parse(profile.updatedAt!) ||
    (entry.status === "applied" &&
      SCREEN02_PROFILE_HOST_ADDITION_FIELDS.some((key) =>
        (entry.additions[key] ?? []).some((term) =>
          !profile[key]!.includes(term)
        )
      ))
  )) return false;
  if (profile.origin === "chatgpt-host-enriched" &&
      !normalizedCache.some((entry) => entry.status === "applied")) return false;
  return true;
}

export function requireReadyScreen02StudyRelevanceProfile(
  value: unknown,
): Screen02StudyRelevanceProfile {
  if (!isScreen02StudyRelevanceProfile(value)) {
    throw new Error("Screen 2 received an invalid study relevance profile.");
  }
  if (value.status !== "ready" || value.canonicalIndustryCode === null) {
    throw new Error(
      value.ambiguity?.question ??
        "Clarify the study industry before finding candidate shocks.",
    );
  }
  return structuredClone(value);
}

export const SCREEN02_POOL_HOST_REVIEW_SCHEMA_VERSION =
  "screen-02-pool-host-review-v1" as const;
export const SCREEN02_POOL_HOST_REVIEW_CAPABILITY =
  "screen-02-pool-review" as const;
export const SCREEN02_POOL_HOST_REVIEW_MAX_QUERIES = 6;
export const SCREEN02_POOL_HOST_REVIEW_MAX_SOURCE_LEADS = 8;
export const SCREEN02_POOL_HOST_REVIEW_MAX_RANKING_ADJUSTMENT = 3;

export type Screen02PoolHostCandidateReview = {
  candidateId: string;
  proposedClass: "direct" | "adjacent" | "broad" | "mismatch";
  industryBridge: string;
  profileTermsUsed: string[];
  sourceIdsUsed: string[];
  sourceSpansUsed: Array<{ sourceId: string; text: string }>;
  sampleConnection: string;
  outcomePathway: string;
  mainMismatchOrUncertainty: string;
  needsFollowUpRetrieval: boolean;
  rankingAdjustment: number;
};

export type Screen02PoolHostOfficialSourceLead = {
  url: string;
  title: string;
  issuingBody: string | null;
  jurisdiction: string | null;
  reasonForRetrieval: string;
  candidateIdIfKnown: string | null;
};

export type Screen02PoolHostReviewSubmission = {
  schemaVersion: typeof SCREEN02_POOL_HOST_REVIEW_SCHEMA_VERSION;
  taskId: string;
  capability: typeof SCREEN02_POOL_HOST_REVIEW_CAPABILITY;
  profileAdditions: Screen02StudyRelevanceProfileHostAdditions;
  candidateReviews: Screen02PoolHostCandidateReview[];
  followUpQueries: string[];
  officialSourceLeads: Screen02PoolHostOfficialSourceLead[];
  conciseRationale: string;
  hostModel: string;
};

export type Screen02PoolHostReviewContext = {
  taskId: string;
  profile: Screen02StudyRelevanceProfile;
  candidates: Array<{
    candidateId: string;
    sources: Array<{ sourceId: string; active: boolean; text: string }>;
  }>;
};

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const expected = [...keys].sort();
  return Object.keys(value).sort().join("\u001f") === expected.join("\u001f");
}

function reviewText(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string") throw new Error(`${label} must be text.`);
  const clean = cleanBoundedText(value, label, maxLength);
  if (/<\/?[a-z][^>]*>/iu.test(clean)) {
    throw new Error(`${label} must not contain HTML.`);
  }
  return clean;
}

function reviewTextList(
  value: unknown,
  label: string,
  maximum: number,
) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return cleanBoundedList(
    value.map((entry) => reviewText(entry, label, 200)),
    label,
    maximum,
  );
}

function reviewIdentifierList(value: unknown, label: string, maximum: number) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  if (value.length > maximum) {
    throw new Error(`${label} accepts at most ${maximum} values.`);
  }
  return [...new Set(value.map((entry) => reviewText(entry, label, 160)))];
}

function reviewNarrative(value: unknown, label: string) {
  const clean = reviewText(value, label, 640);
  if (clean.split(/\s+/u).length > 80) {
    throw new Error(`${label} must contain no more than 80 words.`);
  }
  return clean;
}

/** Strictly validates structure and all task-bound candidate/source references. */
export function validateScreen02PoolHostReviewSubmission(
  value: unknown,
  context: Screen02PoolHostReviewContext,
): Screen02PoolHostReviewSubmission {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Screen 2 pool host review must be an object.");
  }
  const raw = value as Record<string, unknown>;
  const rootKeys = [
    "schemaVersion", "taskId", "capability", "profileAdditions",
    "candidateReviews", "followUpQueries", "officialSourceLeads",
    "conciseRationale", "hostModel",
  ];
  if (!exactKeys(raw, rootKeys)) {
    throw new Error("Screen 2 pool host review has unknown or missing fields.");
  }
  if (
    raw.schemaVersion !== SCREEN02_POOL_HOST_REVIEW_SCHEMA_VERSION ||
    raw.capability !== SCREEN02_POOL_HOST_REVIEW_CAPABILITY ||
    raw.taskId !== context.taskId
  ) {
    throw new Error("Screen 2 pool host review is stale or has the wrong schema/capability.");
  }
  if (!isScreen02StudyRelevanceProfile(context.profile)) {
    throw new Error("Screen 2 pool host review context has an invalid profile.");
  }
  const additionKeys = [
    "industryAliases", "internationalVariants", "subsectors", "products",
    "services", "industryActors", "regulatedActivities",
    "platformRelationships", "contrastTerms", "falseFriends",
    "jurisdictionAliases",
  ] as const;
  if (!raw.profileAdditions || typeof raw.profileAdditions !== "object" || Array.isArray(raw.profileAdditions)) {
    throw new Error("profileAdditions must be an object.");
  }
  const rawAdditions = raw.profileAdditions as Record<string, unknown>;
  if (Object.keys(rawAdditions).some((key) => !additionKeys.includes(key as never))) {
    throw new Error("profileAdditions contains an unsupported field.");
  }
  const profileAdditions: Screen02PoolHostReviewSubmission["profileAdditions"] = {};
  for (const key of additionKeys) {
    if (rawAdditions[key] !== undefined) {
      profileAdditions[key] = reviewTextList(rawAdditions[key], key, 12);
    }
  }
  if (!Array.isArray(raw.candidateReviews)) {
    throw new Error("candidateReviews must be an array.");
  }
  if (raw.candidateReviews.length > context.candidates.length) {
    throw new Error("candidateReviews exceeds the supplied candidate pool.");
  }
  const candidateById = new Map(
    context.candidates.map((candidate) => [candidate.candidateId, candidate]),
  );
  const seenCandidates = new Set<string>();
  const validProfileTerms = new Set(
    [
      context.profile.canonicalIndustryLabel,
      ...SCREEN02_PROFILE_RELATIONSHIP_KEYS.flatMap((key) => context.profile[key]),
      ...([
        "industryAliases", "internationalVariants", "subsectors", "products",
        "services", "industryActors", "regulatedActivities",
        "platformRelationships",
      ] as const).flatMap((key) => profileAdditions[key] ?? []),
    ].map(normalizeScreen02DiscoveryText),
  );
  const candidateReviews = raw.candidateReviews.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`candidateReviews[${index}] must be an object.`);
    }
    const review = entry as Record<string, unknown>;
    const keys = [
      "candidateId", "proposedClass", "industryBridge", "profileTermsUsed",
      "sourceIdsUsed", "sourceSpansUsed", "sampleConnection", "outcomePathway",
      "mainMismatchOrUncertainty", "needsFollowUpRetrieval", "rankingAdjustment",
    ];
    if (!exactKeys(review, keys)) {
      throw new Error(`candidateReviews[${index}] has unknown or missing fields.`);
    }
    const candidateId = reviewText(review.candidateId, "candidateId", 160);
    const candidate = candidateById.get(candidateId);
    if (!candidate) throw new Error(`Unknown candidate ID: ${candidateId}`);
    if (seenCandidates.has(candidateId)) {
      throw new Error(`Duplicate candidate review: ${candidateId}`);
    }
    seenCandidates.add(candidateId);
    if (!["direct", "adjacent", "broad", "mismatch"].includes(String(review.proposedClass))) {
      throw new Error(`Invalid proposed class for ${candidateId}.`);
    }
    const profileTermsUsed = reviewTextList(review.profileTermsUsed, "profileTermsUsed", 12);
    if (profileTermsUsed.some((term) => !validProfileTerms.has(normalizeScreen02DiscoveryText(term)))) {
      throw new Error(`Candidate ${candidateId} uses an unknown profile term.`);
    }
    const sourceIdsUsed = reviewIdentifierList(review.sourceIdsUsed, "sourceIdsUsed", 12);
    const sourceById = new Map(candidate.sources.map((source) => [source.sourceId, source]));
    for (const sourceId of sourceIdsUsed) {
      const source = sourceById.get(sourceId);
      if (!source) throw new Error(`Unknown source ID ${sourceId} for ${candidateId}.`);
      if (!source.active) throw new Error(`Inactive source ID ${sourceId} for ${candidateId}.`);
    }
    if (!Array.isArray(review.sourceSpansUsed) || review.sourceSpansUsed.length > 12) {
      throw new Error(`sourceSpansUsed for ${candidateId} must contain at most 12 spans.`);
    }
    const sourceSpansUsed = review.sourceSpansUsed.map((span, spanIndex) => {
      if (!span || typeof span !== "object" || Array.isArray(span) ||
          !exactKeys(span as Record<string, unknown>, ["sourceId", "text"])) {
        throw new Error(`Invalid source span ${spanIndex} for ${candidateId}.`);
      }
      const rawSpan = span as Record<string, unknown>;
      const sourceId = reviewText(rawSpan.sourceId, "sourceSpan.sourceId", 160);
      const text = reviewText(rawSpan.text, "sourceSpan.text", 500);
      const source = sourceById.get(sourceId);
      if (!source || !source.active || !sourceIdsUsed.includes(sourceId)) {
        throw new Error(`Unverified source span reference ${sourceId} for ${candidateId}.`);
      }
      if (!normalizeScreen02DiscoveryText(source.text).includes(normalizeScreen02DiscoveryText(text))) {
        throw new Error(`Source span is not present in ${sourceId} for ${candidateId}.`);
      }
      return { sourceId, text };
    });
    if (
      ["direct", "adjacent"].includes(String(review.proposedClass)) &&
      (profileTermsUsed.length === 0 || sourceSpansUsed.length === 0 ||
        profileTermsUsed.some((term) => !sourceSpansUsed.some((span) =>
          normalizeScreen02DiscoveryText(span.text).includes(normalizeScreen02DiscoveryText(term)),
        )))
    ) {
      throw new Error(`Candidate ${candidateId} lacks a source-backed profile bridge.`);
    }
    if (!Number.isInteger(review.rankingAdjustment) ||
        Math.abs(Number(review.rankingAdjustment)) > SCREEN02_POOL_HOST_REVIEW_MAX_RANKING_ADJUSTMENT) {
      throw new Error(`Candidate ${candidateId} has an out-of-bounds ranking adjustment.`);
    }
    if (typeof review.needsFollowUpRetrieval !== "boolean") {
      throw new Error(`needsFollowUpRetrieval for ${candidateId} must be boolean.`);
    }
    return {
      candidateId,
      proposedClass: review.proposedClass as Screen02PoolHostCandidateReview["proposedClass"],
      industryBridge: reviewNarrative(review.industryBridge, "industryBridge"),
      profileTermsUsed,
      sourceIdsUsed,
      sourceSpansUsed,
      sampleConnection: reviewNarrative(review.sampleConnection, "sampleConnection"),
      outcomePathway: reviewNarrative(review.outcomePathway, "outcomePathway"),
      mainMismatchOrUncertainty: reviewNarrative(review.mainMismatchOrUncertainty, "mainMismatchOrUncertainty"),
      needsFollowUpRetrieval: review.needsFollowUpRetrieval,
      rankingAdjustment: Number(review.rankingAdjustment),
    };
  });
  const followUpQueries = reviewTextList(
    raw.followUpQueries,
    "followUpQueries",
    SCREEN02_POOL_HOST_REVIEW_MAX_QUERIES,
  );
  if (!Array.isArray(raw.officialSourceLeads) ||
      raw.officialSourceLeads.length > SCREEN02_POOL_HOST_REVIEW_MAX_SOURCE_LEADS) {
    throw new Error("officialSourceLeads must contain at most eight leads.");
  }
  const officialSourceLeads = raw.officialSourceLeads.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry) ||
        !exactKeys(entry as Record<string, unknown>, [
          "url", "title", "issuingBody", "jurisdiction",
          "reasonForRetrieval", "candidateIdIfKnown",
        ])) {
      throw new Error(`officialSourceLeads[${index}] is invalid.`);
    }
    const lead = entry as Record<string, unknown>;
    const url = reviewText(lead.url, "officialSourceLead.url", 500);
    let parsed: URL;
    try { parsed = new URL(url); } catch { throw new Error(`Invalid official source lead URL: ${url}`); }
    if (
      parsed.protocol !== "https:" || parsed.username || parsed.password ||
      (parsed.port !== "" && parsed.port !== "443")
    ) {
      throw new Error("Official source leads must use credential-free HTTPS on the standard port.");
    }
    const candidateIdIfKnown = lead.candidateIdIfKnown === null
      ? null
      : reviewText(
          lead.candidateIdIfKnown,
          "officialSourceLead.candidateIdIfKnown",
          160,
        );
    if (candidateIdIfKnown !== null && !candidateById.has(candidateIdIfKnown)) {
      throw new Error(`Unknown official source lead candidate ID: ${candidateIdIfKnown}`);
    }
    const nullableLeadText = (
      value: unknown,
      label: string,
      maximum: number,
    ) => value === null ? null : reviewText(value, label, maximum);
    return {
      url: parsed.toString(),
      title: reviewText(lead.title, "officialSourceLead.title", 200),
      issuingBody: nullableLeadText(
        lead.issuingBody,
        "officialSourceLead.issuingBody",
        200,
      ),
      jurisdiction: nullableLeadText(
        lead.jurisdiction,
        "officialSourceLead.jurisdiction",
        200,
      ),
      reasonForRetrieval: reviewText(
        lead.reasonForRetrieval,
        "officialSourceLead.reasonForRetrieval",
        400,
      ),
      candidateIdIfKnown,
    };
  });
  return {
    schemaVersion: SCREEN02_POOL_HOST_REVIEW_SCHEMA_VERSION,
    taskId: context.taskId,
    capability: SCREEN02_POOL_HOST_REVIEW_CAPABILITY,
    profileAdditions,
    candidateReviews,
    followUpQueries,
    officialSourceLeads,
    conciseRationale: reviewText(raw.conciseRationale, "conciseRationale", 1_000),
    hostModel: reviewText(raw.hostModel, "hostModel", 120),
  };
}

export function applyScreen02PoolHostReview(
  submission: Screen02PoolHostReviewSubmission,
  context: Screen02PoolHostReviewContext,
  candidates: ReadonlyArray<{
    candidateId: string;
    classification: "direct" | "adjacent" | "broad" | "mismatch";
    eligible: boolean;
    baseScore: number;
  }>,
) {
  const validated = validateScreen02PoolHostReviewSubmission(submission, context);
  const reviewById = new Map(validated.candidateReviews.map((review) => [review.candidateId, review]));
  return candidates.map((candidate) => {
    const review = reviewById.get(candidate.candidateId);
    const adjustment = candidate.eligible ? review?.rankingAdjustment ?? 0 : 0;
    return {
      ...candidate,
      proposedClass: review?.proposedClass ?? candidate.classification,
      eligibilityUnchanged: true as const,
      rankingAdjustment: adjustment,
      totalScore: Math.max(0, Math.min(100, candidate.baseScore + adjustment)),
    };
  });
}
