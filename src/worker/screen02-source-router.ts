export const SCREEN_02_SOURCE_CATALOG_VERSION =
  "screen-02-source-catalog-v2" as const;

export type Screen02ConnectorId =
  | "federal-register-api-v1"
  | "ftc-press-releases-html-v1"
  | "openfema-disaster-declarations-v2"
  | "eu-cellar-sparql-v1"
  | "uk-legislation-atom-v1"
  | "gdacs-event-search-v1"
  | "usgs-earthquake-catalog-v1";

export type Screen02CanonicalEventFamily =
  | "regulation"
  | "disaster"
  | "unsupported";

export type Screen02JurisdictionKind =
  | "united-states"
  | "european-union"
  | "united-kingdom"
  | "global"
  | "other";

export type Screen02SourceLanguage = {
  code: string;
  label: string;
  role: "source-content" | "catalog-metadata" | "api-interface";
};

export type Screen02SourceCatalogEntry = {
  id: Screen02ConnectorId;
  name: string;
  eventFamilies: readonly Exclude<
    Screen02CanonicalEventFamily,
    "unsupported"
  >[];
  jurisdictionCoverage: readonly Screen02JurisdictionKind[];
  requestHosts: readonly string[];
  recordLocatorHosts: readonly string[];
  languages: readonly Screen02SourceLanguage[];
  coverageStatement: string;
  limitations: readonly string[];
};

const EU_OFFICIAL_LANGUAGES: readonly Screen02SourceLanguage[] = [
  ["bg", "Bulgarian"],
  ["hr", "Croatian"],
  ["cs", "Czech"],
  ["da", "Danish"],
  ["nl", "Dutch"],
  ["en", "English"],
  ["et", "Estonian"],
  ["fi", "Finnish"],
  ["fr", "French"],
  ["de", "German"],
  ["el", "Greek"],
  ["hu", "Hungarian"],
  ["ga", "Irish"],
  ["it", "Italian"],
  ["lv", "Latvian"],
  ["lt", "Lithuanian"],
  ["mt", "Maltese"],
  ["pl", "Polish"],
  ["pt", "Portuguese"],
  ["ro", "Romanian"],
  ["sk", "Slovak"],
  ["sl", "Slovenian"],
  ["es", "Spanish"],
  ["sv", "Swedish"],
].map(([code, label]) => ({
  code,
  label,
  role: "source-content" as const,
}));

const ENGLISH_API_LANGUAGE: readonly Screen02SourceLanguage[] = [
  {
    code: "en",
    label: "English",
    role: "api-interface",
  },
];

export const SCREEN_02_SOURCE_CATALOG: readonly Screen02SourceCatalogEntry[] =
  [
    {
      id: "federal-register-api-v1",
      name: "Federal Register API v1",
      eventFamilies: ["regulation"],
      jurisdictionCoverage: ["united-states"],
      requestHosts: ["www.federalregister.gov"],
      recordLocatorHosts: [
        "www.federalregister.gov",
        "federalregister.gov",
        "www.govinfo.gov",
        "govinfo.gov",
      ],
      languages: ENGLISH_API_LANGUAGE,
      coverageStatement:
        "Official U.S. Federal Register publication metadata for U.S. federal rules within an encoded term and publication-date window. This connector is specific to U.S. federal publications; supported foreign and supranational legal scopes use separate jurisdiction-specific routes.",
      limitations: [
        "This Federal Register connector does not search U.S. state, local, tribal, or other nonfederal legal sources.",
        "Publication metadata does not by itself establish the operative treatment date or unit-level coverage.",
      ],
    },
    {
      id: "ftc-press-releases-html-v1",
      name: "Federal Trade Commission official action search",
      eventFamilies: ["regulation"],
      jurisdictionCoverage: ["united-states"],
      requestHosts: ["www.ftc.gov"],
      recordLocatorHosts: ["www.ftc.gov", "ftc.gov"],
      languages: ENGLISH_API_LANGUAGE,
      coverageStatement:
        "Credential-free, bounded search of FTC-owned action announcements by keyword and date. Returned pages can identify completed competition or consumer-protection actions that do not appear as ordinary Federal Register rules.",
      limitations: [
        "FTC announcements cover only that agency and are official explanatory evidence, not automatically the controlling complaint, order, decision, statute, or rule.",
        "Search-result summaries do not establish that every organization in a requested industry is covered; linked documents and common qualification must establish the relevant activity and population.",
        "The public HTML search has no documented service-level or machine-interface guarantee and may fail independently without disabling other routes.",
      ],
    },
    {
      id: "openfema-disaster-declarations-v2",
      name: "OpenFEMA Disaster Declarations Summaries v2",
      eventFamilies: ["disaster"],
      jurisdictionCoverage: ["united-states"],
      requestHosts: ["www.fema.gov"],
      recordLocatorHosts: ["www.fema.gov", "fema.gov"],
      languages: ENGLISH_API_LANGUAGE,
      coverageStatement:
        "Official U.S. FEMA administrative metadata for federal disaster declarations and designated areas.",
      limitations: [
        "It does not cover declarations or administrative responses outside the United States.",
        "A declaration does not by itself establish organization-level exposure or exogenous assignment.",
      ],
    },
    {
      id: "eu-cellar-sparql-v1",
      name: "EU Publications Office CELLAR SPARQL",
      eventFamilies: ["regulation"],
      jurisdictionCoverage: ["european-union"],
      requestHosts: ["publications.europa.eu"],
      recordLocatorHosts: [
        "eur-lex.europa.eu",
        "publications.europa.eu",
      ],
      languages: EU_OFFICIAL_LANGUAGES,
      coverageStatement:
        "Official EU legal-document metadata from the Publications Office CELLAR repository. The current native execution queries English metadata and records all other official EU languages as a host-discovery gap.",
      limitations: [
        "It does not establish national transposition, implementation, enforcement, or unit-level applicability.",
        "Document dates are discovery anchors and are not automatically treatment dates.",
      ],
    },
    {
      id: "uk-legislation-atom-v1",
      name: "UK Legislation Atom search",
      eventFamilies: ["regulation"],
      jurisdictionCoverage: ["united-kingdom"],
      requestHosts: ["www.legislation.gov.uk"],
      recordLocatorHosts: [
        "www.legislation.gov.uk",
        "legislation.gov.uk",
      ],
      languages: [
        {
          code: "en",
          label: "English",
          role: "source-content",
        },
      ],
      coverageStatement:
        "Official legislation.gov.uk catalog results for UK legislation matching a title term and year window.",
      limitations: [
        "Catalog entries do not establish commencement, territorial extent, amendments, or unit-level applicability.",
        "Welsh-language and historical document availability varies; this connector currently queries the English catalog interface.",
      ],
    },
    {
      id: "gdacs-event-search-v1",
      name: "GDACS event search",
      eventFamilies: ["disaster"],
      jurisdictionCoverage: [
        "global",
        "united-states",
        "european-union",
        "united-kingdom",
        "other",
      ],
      requestHosts: ["www.gdacs.org"],
      recordLocatorHosts: ["www.gdacs.org", "gdacs.org"],
      languages: ENGLISH_API_LANGUAGE,
      coverageStatement:
        "Global multi-hazard event and alert metadata from the UN–European Commission Global Disaster Alert and Coordination System.",
      limitations: [
        "GDACS monitoring is not a national legal declaration, administrative eligibility decision, or complete census of local events.",
        "Event presence and alert level do not establish unit-level exposure or treatment assignment.",
      ],
    },
    {
      id: "usgs-earthquake-catalog-v1",
      name: "USGS FDSN earthquake catalog",
      eventFamilies: ["disaster"],
      jurisdictionCoverage: [
        "global",
        "united-states",
        "european-union",
        "united-kingdom",
        "other",
      ],
      requestHosts: ["earthquake.usgs.gov"],
      recordLocatorHosts: ["earthquake.usgs.gov"],
      languages: ENGLISH_API_LANGUAGE,
      coverageStatement:
        "Global scientific earthquake-event metadata from the USGS FDSN event service, optionally bounded by coordinates and magnitude.",
      limitations: [
        "The catalog covers seismic events, not other disaster families or government declarations.",
        "A detected event does not establish administrative response, causal exposure, or unit-level treatment.",
      ],
    },
  ];

const CATALOG_BY_ID = new Map(
  SCREEN_02_SOURCE_CATALOG.map((entry) => [entry.id, entry]),
);

export type Screen02SourceRoute = {
  connectorId: Screen02ConnectorId;
  languages: readonly Screen02SourceLanguage[];
  coverageStatement: string;
  limitations: readonly string[];
  useWhen: string;
};

export type Screen02CoverageGapCode =
  | "unsupported-event-family"
  | "unsupported-issuer-jurisdiction"
  | "national-primary-source-not-configured"
  | "eea-incorporation-not-verified"
  | "national-declaration-source-not-configured"
  | "hazard-metadata-is-not-declaration"
  | "source-language-resolution-required";

export type Screen02CoverageGap = {
  code: Screen02CoverageGapCode;
  message: string;
  requiresHostDiscovery: boolean;
};

export type Screen02SourceRoutePlan = {
  catalogVersion: typeof SCREEN_02_SOURCE_CATALOG_VERSION;
  requestedGeography: string;
  requestedEventFamily: string;
  jurisdiction: {
    kind: Screen02JurisdictionKind;
    label: string;
    usState: {
      code: string;
      name: string;
    } | null;
  };
  canonicalEventFamily: Screen02CanonicalEventFamily;
  hazardKind: "earthquake" | null;
  routingSignals: {
    /** Study geography is applicability evidence, never issuer identity. */
    studyGeography: string;
    possibleIssuers: string[];
    possibleIssuingJurisdictions: string[];
    matchedIssuerJurisdictions: Screen02JurisdictionKind[];
  };
  routes: Screen02SourceRoute[];
  searchLanguages: Screen02SourceLanguage[];
  coverageGaps: Screen02CoverageGap[];
  fallbackPolicy: "never-cross-jurisdiction";
};

function normalizedScopeToken(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const US_STATE_ENTRIES = [
  ["AL", "Alabama"],
  ["AK", "Alaska"],
  ["AZ", "Arizona"],
  ["AR", "Arkansas"],
  ["CA", "California"],
  ["CO", "Colorado"],
  ["CT", "Connecticut"],
  ["DE", "Delaware"],
  ["DC", "District of Columbia"],
  ["FL", "Florida"],
  ["GA", "Georgia"],
  ["HI", "Hawaii"],
  ["ID", "Idaho"],
  ["IL", "Illinois"],
  ["IN", "Indiana"],
  ["IA", "Iowa"],
  ["KS", "Kansas"],
  ["KY", "Kentucky"],
  ["LA", "Louisiana"],
  ["ME", "Maine"],
  ["MD", "Maryland"],
  ["MA", "Massachusetts"],
  ["MI", "Michigan"],
  ["MN", "Minnesota"],
  ["MS", "Mississippi"],
  ["MO", "Missouri"],
  ["MT", "Montana"],
  ["NE", "Nebraska"],
  ["NV", "Nevada"],
  ["NH", "New Hampshire"],
  ["NJ", "New Jersey"],
  ["NM", "New Mexico"],
  ["NY", "New York"],
  ["NC", "North Carolina"],
  ["ND", "North Dakota"],
  ["OH", "Ohio"],
  ["OK", "Oklahoma"],
  ["OR", "Oregon"],
  ["PA", "Pennsylvania"],
  ["RI", "Rhode Island"],
  ["SC", "South Carolina"],
  ["SD", "South Dakota"],
  ["TN", "Tennessee"],
  ["TX", "Texas"],
  ["UT", "Utah"],
  ["VT", "Vermont"],
  ["VA", "Virginia"],
  ["WA", "Washington"],
  ["WV", "West Virginia"],
  ["WI", "Wisconsin"],
  ["WY", "Wyoming"],
] as const;

const US_STATE_BY_NORMALIZED_NAME = new Map(
  US_STATE_ENTRIES.map(([code, name]) => [
    normalizedScopeToken(name),
    { code, name },
  ]),
);
const US_STATE_BY_CODE = new Map<string, { code: string; name: string }>(
  US_STATE_ENTRIES.map(([code, name]) => [code, { code, name }]),
);

export function usStateForScreen02Geography(geography: string) {
  const directCode = geography.trim().toUpperCase();
  if (/^[A-Z]{2}$/u.test(directCode)) {
    return US_STATE_BY_CODE.get(directCode) ?? null;
  }
  const normalized = normalizedScopeToken(geography);
  const withoutCountry = normalized
    .replace(/^(?:united states(?: of america)?|usa|u s)\s+/, "")
    .replace(/\s+(?:united states(?: of america)?|usa|u s)$/, "")
    .replace(/^state of\s+/, "")
    .trim();
  const state = US_STATE_BY_NORMALIZED_NAME.get(withoutCountry);
  // An unqualified "Georgia" is a country as well as a U.S. state.
  if (state?.code === "GA" && withoutCountry === normalized) {
    return null;
  }
  return state ?? null;
}

/**
 * Find a spelled-out U.S. state in a policy name. Screen 1 often receives a
 * study geography such as "United States" even when the policy itself is a
 * state law, so routing cannot rely on the geography field alone.
 */
export function usStateMentionForScreen02Text(text: string) {
  const normalized = ` ${normalizedScopeToken(text)} `;
  const matches = US_STATE_ENTRIES.flatMap(([code, name]) => {
    const stateName = normalizedScopeToken(name);
    return normalized.includes(` ${stateName} `)
      ? [{ code, name, length: stateName.length }]
      : [];
  }).sort((left, right) => right.length - left.length);
  return matches[0]
    ? { code: matches[0].code, name: matches[0].name }
    : null;
}

export function usStateNameForCode(code: string) {
  return US_STATE_ENTRIES.find(([candidate]) => candidate === code)?.[1];
}

function jurisdictionFor(geography: string): {
  kind: Screen02JurisdictionKind;
  label: string;
  usState: { code: string; name: string } | null;
} {
  const normalized = normalizedScopeToken(geography);
  const usState = usStateForScreen02Geography(geography);
  const usAliases = new Set([
    "united states",
    "united states of america",
    "usa",
    "u s",
    "us",
  ]);
  const euAliases = new Set([
    "european union",
    "eu",
  ]);
  const ukAliases = new Set([
    "united kingdom",
    "great britain",
    "uk",
    "u k",
  ]);
  const globalAliases = new Set([
    "global",
    "world",
    "worldwide",
    "all countries",
    "international",
  ]);

  if (usAliases.has(normalized)) {
    return {
      kind: "united-states",
      label: "United States",
      usState: null,
    };
  }
  if (usState) {
    return {
      kind: "united-states",
      label: usState.name,
      usState,
    };
  }
  if (euAliases.has(normalized)) {
    return {
      kind: "european-union",
      label: "European Union",
      usState: null,
    };
  }
  if (ukAliases.has(normalized)) {
    return {
      kind: "united-kingdom",
      label: "United Kingdom",
      usState: null,
    };
  }
  if (globalAliases.has(normalized)) {
    return {
      kind: "global",
      label: "Worldwide",
      usState: null,
    };
  }
  return {
    kind: "other",
    label: geography.trim() || "Unspecified geography",
    usState: null,
  };
}

function boundedRoutingHints(values: readonly string[] | undefined) {
  const byNormalized = new Map<string, string>();
  for (const raw of values ?? []) {
    const value = raw
      .normalize("NFKC")
      .replace(/[\u0000-\u001f\u007f]/gu, " ")
      .replace(/\s+/gu, " ")
      .trim()
      .slice(0, 160)
      .trim();
    const normalized = normalizedScopeToken(value);
    if (!value || !normalized || byNormalized.has(normalized)) continue;
    byNormalized.set(normalized, value);
    if (byNormalized.size >= 6) break;
  }
  return [...byNormalized.values()];
}

function jurisdictionKindFromIssuerHint(value: string) {
  const normalized = normalizedScopeToken(value);
  if (
    /\b(?:european union|european commission|european parliament|council of the european union|publications office of the european union|eur lex|eu commission|eu parliament)\b/u.test(
      normalized,
    )
  ) {
    return "european-union" as const;
  }
  if (
    /\b(?:united kingdom|uk parliament|u k parliament|parliament of the united kingdom|legislation gov uk|the national archives uk)\b/u.test(
      normalized,
    )
  ) {
    return "united-kingdom" as const;
  }
  if (
    /\b(?:united states|u s federal|us federal|federal register|congress of the united states|government of the united states)\b/u.test(
      normalized,
    ) ||
    /\b(?:u s|us)\b.{0,80}\b(?:department|agency|commission|administration|bureau|board|office)\b/u.test(
      normalized,
    )
  ) {
    return "united-states" as const;
  }
  return null;
}

function namesUSStateAuthority(value: string) {
  const normalized = normalizedScopeToken(value);
  return /\b(?:legislature|general assembly|state government|governor|state agency|state department|state commission)\b/u.test(
    normalized,
  ) && US_STATE_ENTRIES.some(([, name]) =>
    ` ${normalized} `.includes(` ${normalizedScopeToken(name)} `)
  );
}

function issuerJurisdictionKinds(input: {
  possibleIssuers: readonly string[];
  possibleIssuingJurisdictions: readonly string[];
}) {
  const kinds = new Set<Screen02JurisdictionKind>();
  for (const hint of input.possibleIssuingJurisdictions) {
    const jurisdiction = jurisdictionFor(hint);
    if (
      jurisdiction.kind !== "other" &&
      jurisdiction.kind !== "global" &&
      jurisdiction.usState === null
    ) {
      kinds.add(jurisdiction.kind);
    }
  }
  for (const hint of input.possibleIssuers) {
    const kind = jurisdictionKindFromIssuerHint(hint);
    if (kind) kinds.add(kind);
  }
  return kinds;
}

function eventFamilyFor(eventFamily: string): {
  canonical: Screen02CanonicalEventFamily;
  hazardKind: "earthquake" | null;
} {
  const normalized = normalizedScopeToken(eventFamily);
  if (
    /\b(regulation|regulatory|law|legal|legislation|policy|rule|directive|statute)\b/u.test(
      normalized,
    )
  ) {
    return { canonical: "regulation", hazardKind: null };
  }
  if (
    /\b(disaster|hazard|earthquake|seismic|flood|cyclone|hurricane|typhoon|volcano|wildfire|drought|tsunami)\b/u.test(
      normalized,
    )
  ) {
    return {
      canonical: "disaster",
      hazardKind: /\b(earthquake|seismic)\b/u.test(normalized)
        ? "earthquake"
        : null,
    };
  }
  return { canonical: "unsupported", hazardKind: null };
}

export function getScreen02SourceCatalogEntry(
  connectorId: Screen02ConnectorId,
) {
  const entry = CATALOG_BY_ID.get(connectorId);
  if (!entry) {
    throw new Error(`Unknown Screen 2 connector: ${connectorId}`);
  }
  return entry;
}

function route(
  connectorId: Screen02ConnectorId,
  useWhen: string,
): Screen02SourceRoute {
  const entry = getScreen02SourceCatalogEntry(connectorId);
  return {
    connectorId,
    languages: entry.languages,
    coverageStatement: entry.coverageStatement,
    limitations: entry.limitations,
    useWhen,
  };
}

function distinctLanguages(routes: readonly Screen02SourceRoute[]) {
  const byCodeAndRole = new Map<string, Screen02SourceLanguage>();
  for (const sourceRoute of routes) {
    for (const language of sourceRoute.languages) {
      byCodeAndRole.set(
        `${language.code}:${language.role}`,
        language,
      );
    }
  }
  return [...byCodeAndRole.values()];
}

export function planScreen02SourceRoutes(input: {
  geography: string;
  eventFamily: string;
  possibleIssuers?: readonly string[];
  possibleIssuingJurisdictions?: readonly string[];
}): Screen02SourceRoutePlan {
  const requestedGeography = input.geography.trim();
  const requestedEventFamily = input.eventFamily.trim();
  const jurisdiction = jurisdictionFor(requestedGeography);
  const { canonical, hazardKind } = eventFamilyFor(
    requestedEventFamily,
  );
  const possibleIssuers = boundedRoutingHints(input.possibleIssuers);
  const possibleIssuingJurisdictions = boundedRoutingHints(
    input.possibleIssuingJurisdictions,
  );
  const issuerKinds = issuerJurisdictionKinds({
    possibleIssuers,
    possibleIssuingJurisdictions,
  });
  const routes: Screen02SourceRoute[] = [];
  const coverageGaps: Screen02CoverageGap[] = [];

  if (canonical === "regulation") {
    const routeKinds = new Set<Screen02JurisdictionKind>();
    if (
      jurisdiction.kind === "united-states" ||
      jurisdiction.kind === "european-union" ||
      jurisdiction.kind === "united-kingdom"
    ) {
      routeKinds.add(jurisdiction.kind);
    }
    issuerKinds.forEach((kind) => routeKinds.add(kind));
    if (routeKinds.has("united-states")) {
      routes.push(
        route(
          "federal-register-api-v1",
          jurisdiction.kind === "united-states"
            ? "Search U.S. federal publication metadata as an applicability lead for the study geography; a returned record must independently establish its issuer and covered population."
            : "Search U.S. federal publication metadata because an explicit possible-issuer or possible-issuing-jurisdiction hint points to that source; the hint is untrusted until the returned record establishes identity.",
        ),
      );
      if (
        jurisdiction.kind === "united-states" ||
        possibleIssuers.some((issuer) =>
          /\b(?:federal trade commission|ftc)\b/iu.test(issuer)
        )
      ) {
        routes.push(
          route(
            "ftc-press-releases-html-v1",
            jurisdiction.kind === "united-states"
              ? "Search FTC-owned records for completed federal competition and consumer-protection actions, then require retrieved source text to establish covered activities and organizations."
              : "Search FTC-owned records because an explicit possible-issuer hint names that agency; the hint remains untrusted until retrieved evidence establishes identity.",
          ),
        );
      }
    }
    if (routeKinds.has("european-union")) {
      routes.push(
        route(
          "eu-cellar-sparql-v1",
          jurisdiction.kind === "european-union"
            ? "Search EU legal-document metadata as an applicability lead for the study geography; a returned record must independently establish issuer and scope."
            : "Search EU legal-document metadata because an explicit possible-issuer or possible-issuing-jurisdiction hint points to that source; the hint is untrusted until the returned record establishes identity.",
        ),
      );
    }
    if (routeKinds.has("united-kingdom")) {
      routes.push(
        route(
          "uk-legislation-atom-v1",
          jurisdiction.kind === "united-kingdom"
            ? "Search the official UK legislation catalog as an applicability lead for the study geography; a returned record must independently establish issuer and extent."
            : "Search the official UK legislation catalog because an explicit possible-issuer or possible-issuing-jurisdiction hint points to that source; the hint is untrusted until the returned record establishes identity.",
        ),
      );
    }
    if (routeKinds.size === 0) {
      coverageGaps.push({
        code: "national-primary-source-not-configured",
        message: `No native official legal-source connector is configured for ${jurisdiction.label}. Study geography was not converted into an issuing jurisdiction. A suitable jurisdiction-specific source must be identified and disclosed before candidates can be proposed.`,
        requiresHostDiscovery: true,
      });
      coverageGaps.push({
        code: "source-language-resolution-required",
        message: `The authoritative source language or languages for ${jurisdiction.label} have not been resolved.`,
        requiresHostDiscovery: true,
      });
    } else if (jurisdiction.kind === "other" || jurisdiction.kind === "global") {
      coverageGaps.push({
        code: "national-primary-source-not-configured",
        message: `The explicit possible-issuer routes do not search all national legislation, implementing measures, or regulator decisions applicable within ${jurisdiction.label}; the study geography remains separate from issuer identity.`,
        requiresHostDiscovery: true,
      });
      coverageGaps.push({
        code: "source-language-resolution-required",
        message: `Only languages exposed by the explicitly hinted official repositories were searched; authoritative national-language coverage for ${jurisdiction.label} remains unresolved.`,
        requiresHostDiscovery: true,
      });
    }
    const unresolvedIssuerHints = [
      ...possibleIssuingJurisdictions.filter((hint) => {
        const possible = jurisdictionFor(hint);
        return possible.kind === "other" ||
          possible.kind === "global" || possible.usState !== null;
      }),
      ...possibleIssuers.filter((hint) =>
        jurisdictionKindFromIssuerHint(hint) === null ||
        namesUSStateAuthority(hint)
      ),
    ].filter((hint, index, values) =>
      values.findIndex((candidate) =>
        normalizedScopeToken(candidate) === normalizedScopeToken(hint)
      ) === index
    );
    if (unresolvedIssuerHints.length > 0) {
      coverageGaps.push({
        code: "unsupported-issuer-jurisdiction",
        message: `No configured native legal connector matched the possible issuing jurisdiction hint${unresolvedIssuerHints.length === 1 ? "" : "s"}: ${unresolvedIssuerHints.join("; ")}. The hints were recorded but not substituted with another jurisdiction.`,
        requiresHostDiscovery: true,
      });
    }
  } else if (canonical === "disaster") {
    if (jurisdiction.kind === "united-states") {
      routes.push(
        route(
          "openfema-disaster-declarations-v2",
          "Search official U.S. federal disaster-declaration metadata.",
        ),
      );
    }
    routes.push(
      route(
        "gdacs-event-search-v1",
        "Search global multi-hazard event and alert metadata, then retain only geography-matching records.",
      ),
    );
    if (hazardKind === "earthquake") {
      routes.push(
        route(
          "usgs-earthquake-catalog-v1",
          "Search the global scientific earthquake catalog, using a validated geographic bounding box when the scope is not worldwide.",
        ),
      );
    }
    coverageGaps.push({
      code: "hazard-metadata-is-not-declaration",
      message:
        "Global hazard records are event-discovery evidence, not proof of a government declaration, administrative response, or unit-level exposure.",
      requiresHostDiscovery: false,
    });
    if (
      jurisdiction.kind !== "united-states" &&
      jurisdiction.kind !== "global"
    ) {
      coverageGaps.push({
        code: "national-declaration-source-not-configured",
        message: `No native national disaster-declaration connector is configured for ${jurisdiction.label}. A suitable jurisdiction-specific administrative source must be identified and disclosed before candidates can be proposed.`,
        requiresHostDiscovery: true,
      });
      coverageGaps.push({
        code: "source-language-resolution-required",
        message: `The authoritative administrative source language or languages for ${jurisdiction.label} have not been resolved.`,
        requiresHostDiscovery: true,
      });
    }
  } else {
    coverageGaps.push({
      code: "unsupported-event-family",
      message: `The first native connector pack does not cover the event family “${requestedEventFamily || "unspecified"}.”`,
      requiresHostDiscovery: true,
    });
  }

  return {
    catalogVersion: SCREEN_02_SOURCE_CATALOG_VERSION,
    requestedGeography,
    requestedEventFamily,
    jurisdiction,
    canonicalEventFamily: canonical,
    hazardKind,
    routingSignals: {
      studyGeography: requestedGeography,
      possibleIssuers,
      possibleIssuingJurisdictions,
      matchedIssuerJurisdictions: [...issuerKinds],
    },
    routes,
    searchLanguages: distinctLanguages(routes),
    coverageGaps,
    fallbackPolicy: "never-cross-jurisdiction",
  };
}
