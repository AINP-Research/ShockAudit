import {
  type Ambiguity,
  type DecisionKey,
  type FieldKey,
  type Mode,
  type ScopeContract,
  fieldKeys,
} from "./scope-types";
import {
  canonicalKnownShockName,
  extractKnownShock,
  hasMultipleKnownShockCandidates,
} from "./scope-extractor";

const fieldLabels: Record<FieldKey, string> = {
  population: "Population",
  assignmentLevel: "Assignment level",
  analysisLevel: "Analysis level",
  geography: "Geography",
  industry: "Industry",
  studyPeriod: "Study period",
  eventFamily: "Event family",
  outcomeFamily: "Outcome family",
  outcomeFrequency: "Outcome frequency",
};

const placeholderValues = new Set([
  "",
  "-",
  "—",
  "?",
  "n/a",
  "na",
  "none",
  "null",
  "not applicable",
  "not available",
  "not decided",
  "not determined",
  "not known",
  "not specified",
  "not set",
  "not sure",
  "not yet determined",
  "not yet known",
  "pending",
  "placeholder",
  "same as above",
  "same",
  "ask coauthor",
  "later",
  "no preference",
  "select",
  "select one",
  "selected geography",
  "tbd",
  "tba",
  "tbc",
  "to be determined",
  "to be decided",
  "to decide",
  "to be confirmed",
  "todo",
  "unknown",
  "undecided",
  "unspecified",
  "unsure",
]);

const recognizedGeographies = new Map<string, string>([
  ["united states", "United States"],
  ["u.s.", "United States"],
  ["u.s", "United States"],
  ["us", "United States"],
  ["u.s.a.", "United States"],
  ["u.s.a", "United States"],
  ["usa", "United States"],
  ["united states of america", "United States"],
  ["united states (national)", "United States"],
  ["american", "United States"],
  ["united kingdom", "United Kingdom"],
  ["u.k.", "United Kingdom"],
  ["u.k", "United Kingdom"],
  ["uk", "United Kingdom"],
  ["british", "United Kingdom"],
  ["european union", "European Union"],
  ["eu", "European Union"],
  ["europe", "Europe"],
  ["european", "Europe"],
  ["canada", "Canada"],
  ["canadian", "Canada"],
  ["australia", "Australia"],
  ["australian", "Australia"],
  ["china", "China"],
  ["chinese", "China"],
  ["thailand", "Thailand"],
  ["thai", "Thailand"],
  ["netherlands", "Netherlands"],
  ["dutch", "Netherlands"],
  ["germany", "Germany"],
  ["german", "Germany"],
  ["france", "France"],
  ["french", "France"],
  ["spain", "Spain"],
  ["spanish", "Spain"],
  ["italy", "Italy"],
  ["italian", "Italy"],
]);

const domainValues = {
  level: new Set([
    "individual",
    "employee",
    "worker",
    "firm",
    "company",
    "organization",
    "state",
    "region",
    "county",
    "country",
    "industry",
    "market",
  ]),
  frequency: new Set([
    "annual",
    "annually",
    "yearly",
    "quarterly",
    "monthly",
    "weekly",
    "daily",
    "event-based",
    "event based",
    "event-time",
  ]),
  geography: new Set(recognizedGeographies.keys()),
  industry: new Set([
    "manufacturing",
    "technology",
    "banking",
    "healthcare",
    "energy",
    "retail",
    "pharmaceutical",
    "transportation",
    "video gaming",
    "video games",
    "interactive entertainment",
    "gambling",
    "gambling and casinos",
    "casinos",
    "all industries",
  ]),
  event: new Set([
    "regulation",
    "court ruling",
    "disaster",
    "infrastructure",
    "policy",
  ]),
  outcome: new Set([
    "profitability",
    "firm performance",
    "innovation",
    "employment",
    "investment",
    "market performance",
    "inequality",
  ]),
};

type ValueDomain = keyof typeof domainValues;

function normalizeValue(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isPlaceholderValue(value: string) {
  const normalized = normalizeValue(value);
  return (
    placeholderValues.has(normalized) ||
    /^(?:enter|add|choose|select|ask (?:a |the )?coauthor|later|no preference|same(?: as above)?|tbd|tba|tbc|todo|unknown|undecided|unspecified|unsure|pending|placeholder|to decide|to be (?:decided|determined|confirmed)|not (?:applicable|available|decided|determined|known|set|specified|sure|yet (?:determined|known)))\b/.test(
      normalized,
    ) ||
    /\b(?:selected geography|ask (?:a |the )?coauthor|no preference|tbd|tba|tbc|todo|unknown|undecided|unspecified|unsure|pending|placeholder|to decide|to be (?:decided|determined|confirmed)|not (?:available|decided|determined|known|set|specified|sure|yet (?:determined|known)))\b/.test(
      normalized,
    ) ||
    /^[\p{P}\p{S}\s]+$/u.test(value)
  );
}

function canonicalGeography(value: string) {
  const normalized = normalizeValue(value).replace(
    /\s*(?:\((?:national|countrywide)\)|nationwide)$/,
    "",
  );
  return recognizedGeographies.get(normalized) ?? value.trim();
}

function describesPublicFirmPopulation(value: string) {
  const normalized = normalizeValue(value);
  const firmNoun =
    "(?:firms?|companies|businesses|issuers|corporations?)";
  return (
    new RegExp(
      `\\bpublic(?:ly)?(?:\\s+[\\w.-]+){0,6}\\s+${firmNoun}\\b`,
    ).test(normalized) ||
    new RegExp(
      `\\b${firmNoun}\\s+(?:(?:that|which)\\s+)?(?:are\\s+|is\\s+)?public(?:ly\\s+(?:traded|listed|held|owned))?\\b`,
    ).test(normalized) ||
    new RegExp(
      `\\b${firmNoun}\\b(?:\\s+[\\w.-]+){0,6}\\s+(?:are|is)\\s+publicly\\s+traded\\b`,
    ).test(normalized) ||
    new RegExp(
      `\\b${firmNoun}\\b(?:\\s+[\\w.-]+){0,5}\\s+with\\s+publicly\\s+traded\\s+shares\\b`,
    ).test(normalized) ||
    (new RegExp(`\\b${firmNoun}\\b`).test(normalized) &&
      /\b(?:exchange[- ]listed|listed on|otc|over[- ]the[- ]counter|nasdaq|nyse|amex|tsx|lse)\b/.test(
        normalized,
      )) ||
    new RegExp(
      `\\b${firmNoun}\\b(?:\\s+[\\w.-]+){0,4}\\s+traded\\s+(?:in|on)\\s+public\\s+markets?\\b`,
    ).test(normalized) ||
    new RegExp(
      `\\b${firmNoun}\\b(?:\\s+[\\w.-]+){0,4}\\s+trade(?:d|s)?\\s+(?:in|on)\\s+public\\s+markets?\\b`,
    ).test(normalized)
  );
}

function suppliesPublicFirmBoundary(value: string) {
  return /\b(?:exchange[- ]listed|publicly listed|listed on|otc|over[- ]the[- ]counter|nasdaq|nyse|amex|tsx|lse|fortune \d+|s&p \d+)\b/.test(
    normalizeValue(value),
  );
}

function populationNamesItsGeography(value: string, geography: string) {
  const populationGeographies = explicitGeographies(value);
  if (populationGeographies.size > 0) return true;
  if (isPlaceholderValue(geography)) return false;
  const normalizedPopulation = normalizeValue(value);
  const normalizedGeography = normalizeValue(canonicalGeography(geography));
  return (
    normalizedGeography.length > 1 &&
    new RegExp(
      `(?:^|\\b)${escapeRegExp(normalizedGeography)}(?=\\b|$)`,
    ).test(normalizedPopulation)
  );
}

function isGenericPublicFirmPopulation(
  value: string,
  geography: string,
) {
  return (
    describesPublicFirmPopulation(value) &&
    !suppliesPublicFirmBoundary(value) &&
    !populationNamesItsGeography(value, geography)
  );
}

function isAmbiguousPublicEnterprise(value: string) {
  const normalized = normalizeValue(value);
  if (
    suppliesPublicFirmBoundary(value) ||
    /\b(?:state|government)[- ]owned\b|\bmunicipally\s+owned\b/.test(
      normalized,
    )
  ) {
    return false;
  }
  return (
    /\bpublic(?:ly)?(?:\s+[\w.-]+){0,4}\s+enterprises?\b/.test(
      normalized,
    ) ||
    /\benterprises?\s+(?:(?:that|which)\s+)?(?:are\s+)?public\b/.test(
      normalized,
    )
  );
}

function knownLevelKinds(value: string) {
  const normalized = normalizeValue(value);
  const kinds = new Set<string>();
  if (
    /\b(?:individual|employee|worker|person|participant|household|ceo|executive)\b/.test(
      normalized,
    )
  )
    kinds.add("Individual");
  if (
    /\b(?:firm|company|corporation|enterprise|organization|establishment|plant|facility|hospital|school|university|board|team|product|alliance|dyad)\b/.test(
      normalized,
    )
  )
    kinds.add("Organization");
  if (/\b(?:transaction|claim|contract|order|patent)\b/.test(normalized))
    kinds.add("Transaction");
  if (/\b(?:state|province|subnational)\b/.test(normalized))
    kinds.add("State");
  if (
    /\b(?:region|regional|county|municipality|municipal|city|district)\b/.test(
      normalized,
    )
  )
    kinds.add("Region");
  if (/\b(?:country|national)\b/.test(normalized)) kinds.add("Country");
  if (/\b(?:industry|market)\b/.test(normalized)) kinds.add("Industry");
  return kinds;
}

function levelKinds(value: string) {
  const normalized = normalizeValue(value);
  const domain = valueDomain(value);
  if (
    isPlaceholderValue(value) ||
    frequencyKinds(value).size > 0 ||
    (domain && domain !== "level")
  ) {
    return new Set<string>();
  }

  const kinds = new Set<string>();
  // A researcher's unit is not restricted to our extraction vocabulary.
  // Classify explicit alternatives separately so custom units cannot hide
  // a second level behind a recognized word (for example, "sensor or firm").
  const units = normalized.split(
    /\s*(?:[,;/&+]|\b(?:and|or|versus|vs)\b)\s*/,
  );
  for (const unit of units) {
    const knownKinds = knownLevelKinds(unit);
    if (isPlaceholderValue(unit)) return new Set<string>();
    if (knownKinds.size > 0) {
      for (const kind of knownKinds) kinds.add(kind);
      continue;
    }

    const unitLabel = unit.replace(/(?:-|\s+)level$/, "");
    if (
      valueDomain(unitLabel) ||
      !/^[\p{L}][\p{L}\p{M}'’-]*(?: [\p{L}][\p{L}\p{M}'’-]*){0,3}$/u.test(
        unitLabel,
      ) ||
      /\b(?:a|an|the|at|by|for|from|in|of|on|to|with|which|that|either|both|multiple|various|other|custom|unit|units|level|levels)\b/.test(
        unitLabel,
      )
    ) {
      return new Set<string>();
    }
    // Keep distinct custom identities for sentence alignment. This does not
    // rewrite the supplied Scope Contract or infer scientific suitability.
    kinds.add(`Custom:${unitLabel}`);
  }
  return kinds;
}

function frequencyKinds(value: string) {
  const normalized = normalizeValue(value);
  const kinds = new Set<string>();
  if (
    /\b(?:annual|annually|biannual|semiannual|biennial|yearly|year)\b/.test(
      normalized,
    )
  )
    kinds.add("Annual");
  if (/\bquarterly\b|\beach quarter\b|\bquarter\b/.test(normalized))
    kinds.add("Quarterly");
  if (/\bmonthly\b|\beach month\b|\bmonth\b/.test(normalized))
    kinds.add("Monthly");
  if (/\bbimonthly\b/.test(normalized)) kinds.add("Bimonthly");
  if (/\bweekly\b|\beach week\b|\bweek\b/.test(normalized))
    kinds.add("Weekly");
  if (/\bbiweekly\b/.test(normalized)) kinds.add("Biweekly");
  if (/\bdaily\b|\beach day\b|\bday\b/.test(normalized)) kinds.add("Daily");
  if (/\bhourly\b|\beach hour\b|\bhour\b/.test(normalized))
    kinds.add("Hourly");
  if (/\bminutely\b|\beach minute\b|\bminute\b/.test(normalized))
    kinds.add("Minutely");
  if (/\bevent[- ](?:based|time)\b/.test(normalized))
    kinds.add("Event-based");
  return kinds;
}

function isValidOutcomeFrequency(value: string) {
  return /^(?:annual(?:ly)?|yearly|biannual(?:ly)?|semiannual(?:ly)?|biennial(?:ly)?|quarterly|monthly|bimonthly|weekly|biweekly|daily|hourly|minutely|event[- ](?:based|time)|(?:each|every)\s+(?:year|quarter|month|week|day|hour|minute)|twice\s+(?:a|per)\s+year)$/i.test(
    value.trim(),
  );
}

function valueDomain(value: string): ValueDomain | "" {
  const normalized = normalizeValue(value);
  for (const [domain, values] of Object.entries(domainValues) as Array<
    [ValueDomain, Set<string>]
  >) {
    if (values.has(normalized)) return domain;
  }
  return "";
}

function wrongDomain(key: FieldKey, value: string) {
  if (
    (key === "assignmentLevel" || key === "analysisLevel") &&
    frequencyKinds(value).size > 0
  ) {
    return "frequency";
  }
  if (
    key === "outcomeFrequency" &&
    frequencyKinds(value).size <= 1 &&
    !isValidOutcomeFrequency(value)
  ) {
    return levelKinds(value).size > 0 ? "level" : "non-frequency";
  }

  const normalized = normalizeValue(value);
  if (key === "eventFamily" && normalized === "market") return "";
  if (key === "industry" && explicitGeographies(value).size > 0) {
    return "geography";
  }
  if (
    key === "eventFamily" &&
    /\b(?:profitability|profits?|firm performance|innovation|employment|hiring|investments?|market performance|stock returns?|inequality|pay gap)\b/.test(
      normalized,
    ) &&
    !/\b(?:regulation|regulatory|court|ruling|disaster|infrastructure|policy|market|law|legal|rule|act|statute|ordinance)\b/.test(
      normalized,
    )
  ) {
    return "outcome";
  }
  if (
    key === "outcomeFamily" &&
    /\b(?:regulation|regulatory|court ruling|disaster|infrastructure|policy shock|legal reform)\b/.test(
      normalized,
    ) &&
    !/\b(?:profitability|performance|innovation|employment|hiring|investments?|returns?|value|inequality|gap|compliance)\b/.test(
      normalized,
    )
  ) {
    return "event";
  }

  const domain = valueDomain(value);
  if (!domain) return "";
  const allowedDomains: Record<FieldKey, ValueDomain[]> = {
    population: [],
    assignmentLevel: ["level"],
    analysisLevel: ["level"],
    geography: ["geography"],
    industry: ["industry"],
    studyPeriod: [],
    eventFamily: ["event"],
    outcomeFamily: ["outcome"],
    outcomeFrequency: ["frequency"],
  };
  return allowedDomains[key].includes(domain) ? "" : domain;
}

function publicFirmChoices(geography: string) {
  const normalizedGeography = canonicalGeography(geography);
  const isUnitedStates = normalizedGeography === "United States";
  return [
    {
      label: isUnitedStates
        ? "U.S. public firms using my study's definition"
        : `Public firms in ${normalizedGeography} using my study's definition`,
      value: isUnitedStates
        ? "U.S. public firms"
        : `Public firms in ${normalizedGeography}`,
    },
    {
      label: isUnitedStates
        ? "U.S. exchange-listed firms only"
        : `Exchange-listed firms in ${normalizedGeography}`,
      value: isUnitedStates
        ? "U.S. exchange-listed firms"
        : `Exchange-listed firms in ${normalizedGeography}`,
    },
    {
      label: isUnitedStates
        ? "Include U.S. exchange-listed and OTC firms"
        : `Include exchange-listed and OTC firms in ${normalizedGeography}`,
      value: isUnitedStates
        ? "U.S. exchange-listed and OTC firms"
        : `Exchange-listed and OTC firms in ${normalizedGeography}`,
    },
  ];
}

function explicitGeographies(value: string) {
  const geographies = new Set<string>();
  const normalized = normalizeValue(value);
  const aliases: Array<[RegExp, string]> = [
    [
      /(?:^|\b)(?:u\.s\.?a?\.?|usa|us|united states(?: of america)?)(?=\s|$|[-,(])/g,
      "United States",
    ],
    [
      /(?:^|\b)(?:u\.k\.?|uk|united kingdom|british)(?=\s|$|[-,])/g,
      "United Kingdom",
    ],
    [/\b(?:european union|eu)\b/g, "European Union"],
    [/\b(?:europe|european)\b(?!\s+union)/g, "Europe"],
    [/\b(?:canada|canadian)\b/g, "Canada"],
    [/\b(?:australia|australian)\b/g, "Australia"],
    [/\b(?:china|chinese)\b/g, "China"],
    [/\b(?:thailand|thai)\b/g, "Thailand"],
    [/\b(?:netherlands|dutch)\b/g, "Netherlands"],
    [/\b(?:germany|german)\b/g, "Germany"],
    [/\b(?:france|french)\b/g, "France"],
    [/\b(?:spain|spanish)\b/g, "Spain"],
    [/\b(?:italy|italian)\b/g, "Italy"],
  ];
  for (const [pattern, geography] of aliases) {
    if (pattern.test(normalized)) geographies.add(geography);
  }
  if (
    /\bamerican(?=\s|$|[-,(])/.test(normalized) &&
    !/\b(?:north|latin|central|south) american\b/.test(normalized)
  ) {
    geographies.add("United States");
  }
  return geographies;
}

function populationGeographyMismatch(
  population: string,
  geography: string,
) {
  if (isPlaceholderValue(geography)) return false;
  const normalizedPopulation = normalizeValue(population);
  const scopeGeographies = explicitGeographies(geography);
  if (
    /(?:^|\b)non[- ](?:u\.s\.?a?\.?|usa|us|united states(?: of america)?|american)(?=\s|$|[-,])|outside(?:\s+of)?\s+(?:the\s+)?(?:u\.s\.?a?\.?|usa|us|united states(?: of america)?)(?=\s|$|[-,])/.test(
      normalizedPopulation,
    ) &&
    scopeGeographies.has("United States")
  ) {
    return true;
  }
  const populationGeographies = explicitGeographies(population);
  if (populationGeographies.size === 0) return false;
  if (scopeGeographies.size === 0) {
    scopeGeographies.add(canonicalGeography(geography));
  }
  return [...populationGeographies].some(
    (candidate) => !scopeGeographies.has(candidate),
  );
}

const genericKnownShockTokens = new Set([
  "a",
  "an",
  "the",
  "some",
  "this",
  "that",
  "in",
  "of",
  "on",
  "at",
  "by",
  "during",
  "known",
  "focal",
  "proposed",
  "named",
  "new",
  "severe",
  "deadly",
  "major",
  "regulatory",
  "judicial",
  "decision",
  "natural",
  "infrastructure",
  "outage",
  "pandemic",
  "market",
  "disruption",
  "reform",
  "tax",
  "economic",
  "financial",
  "crisis",
  "government",
  "legal",
  "state",
  "federal",
  "local",
  "national",
  "court",
  "supreme",
  "public",
  "general",
  "event",
  "law",
  "policy",
  "change",
  "ruling",
  "regulation",
  "rule",
  "act",
  "disaster",
  "hurricane",
  "earthquake",
  "wildfire",
  "flood",
  "cyberattack",
  "tornado",
  "drought",
  "tsunami",
  "storm",
  "mass",
  "shooting",
  "terrorist",
  "attack",
  "data",
  "breach",
  "power",
  "privacy",
  "minimum",
  "wage",
  "labor",
  "strike",
  "war",
  "protest",
  "lockdown",
  "disease",
  "outbreak",
  "epidemic",
  "new",
  "york",
  "texas",
  "florida",
  "chicago",
  "recession",
  "california",
  "shock",
]);

function isGenericKnownShock(value: string) {
  if (hasMultipleKnownShockCandidates(value)) return true;
  const tokens = normalizeValue(value)
    .replace(/[^\p{L}\p{N}-]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return (
    tokens.length > 0 &&
    tokens.every(
      (token) =>
        genericKnownShockTokens.has(token) || /^\d+$/.test(token),
    )
  );
}

const shockIdentityStopwords = new Set([
  "a",
  "an",
  "the",
  "of",
  "in",
  "on",
  "at",
  "by",
  "and",
  "or",
  "act",
  "law",
  "policy",
  "change",
  "decision",
  "ruling",
  "regulation",
  "rule",
  "reform",
  "event",
  "shock",
  "disaster",
  "hurricane",
  "earthquake",
  "wildfire",
  "flood",
  "outage",
  "strike",
  "crisis",
  "breach",
  "pandemic",
  "federal",
  "state",
  "national",
  "court",
]);

function identityTokens(value: string) {
  return new Set(
    normalizeValue(value)
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .split(/\s+/)
      .filter(
        (token) =>
          token &&
          !shockIdentityStopwords.has(token) &&
          !/^\d+$/.test(token),
      ),
  );
}

function shockJurisdictions(value: string) {
  const normalized = normalizeValue(value);
  const jurisdictions = new Set<string>();
  const aliases: Array<[RegExp, string]> = [
    [/\b(?:new york|ny)\b/, "New York"],
    [/\bcalifornia\b/, "California"],
    [/\bvirginia\b/, "Virginia"],
    [/\bflorida\b/, "Florida"],
    [/\btexas\b/, "Texas"],
    [/\billinois\b/, "Illinois"],
    [/\bfederal\b|\bunited states\b|\bu\.s\.?\b/, "United States"],
    [/\beuropean union\b|\beu\b/, "European Union"],
  ];
  for (const [pattern, name] of aliases) {
    if (pattern.test(normalized)) jurisdictions.add(name);
  }
  return jurisdictions;
}

function knownShockValuesMatch(sentenceShock: string, suppliedShock: string) {
  const sentenceCanonical = canonicalKnownShockName(sentenceShock);
  const suppliedCanonical = canonicalKnownShockName(suppliedShock);
  if (sentenceCanonical && suppliedCanonical) {
    return sentenceCanonical === suppliedCanonical;
  }
  if (normalizeValue(sentenceShock) === normalizeValue(suppliedShock)) {
    return true;
  }

  const sentenceJurisdictions = shockJurisdictions(sentenceShock);
  const suppliedJurisdictions = shockJurisdictions(suppliedShock);
  if (
    sentenceJurisdictions.size > 0 &&
    suppliedJurisdictions.size > 0 &&
    ![...sentenceJurisdictions].some((jurisdiction) =>
      suppliedJurisdictions.has(jurisdiction),
    )
  ) {
    return false;
  }

  const sentenceTokens = identityTokens(sentenceShock);
  const suppliedTokens = identityTokens(suppliedShock);
  if (sentenceTokens.size === 0 || suppliedTokens.size === 0) {
    return false;
  }
  return [...sentenceTokens].some((token) => suppliedTokens.has(token));
}

function populationMatchesDraft(inferred: string, supplied: string) {
  const normalized = normalizeValue(supplied);
  const rules: Record<string, RegExp> = {
    "Private firms":
      /\bprivate(?:ly)?\b[^.!?]{0,50}\b(?:firms?|companies|businesses|issuers|corporations?)\b|\b(?:firms?|companies|businesses|issuers|corporations?)\b[^.!?]{0,50}\bprivate\b/,
    Firms: /\b(?:firms?|companies|businesses|issuers|corporations?)\b/,
    Employees: /\b(?:employees?|workers?|individuals?|participants?)\b/,
    Executives: /\b(?:ceos?|executives?|directors?|managers?)\b/,
    Hospitals: /\bhospitals?\b/,
    Universities: /\buniversit(?:y|ies)\b/,
    Organizations:
      /\b(?:organizations?|firms?|companies|businesses|hospitals?|universit(?:y|ies))\b/,
    States: /\b(?:states?|state governments?)\b/,
    Regions: /\b(?:regions?|count(?:y|ies)|municipalit(?:y|ies)|cities)\b/,
    Countries: /\bcountr(?:y|ies)\b/,
    Industries: /\bindustr(?:y|ies)\b/,
    Patents: /\bpatents?\b/,
    Transactions: /\btransactions?\b/,
    Establishments: /\b(?:establishments?|facilities)\b/,
    Plants: /\bplants?\b/,
    Claims: /\bclaims?\b/,
    Contracts: /\bcontracts?\b/,
    Orders: /\borders?\b/,
    Products: /\bproducts?\b/,
    Alliances: /\balliances?\b/,
    Dyads: /\bdyads?\b/,
    Cities: /\bcities\b/,
    Municipalities: /\bmunicipalit(?:y|ies)\b/,
  };
  if (inferred === "Public firms") {
    // A public-firm phrase can qualify a different population unit. Do not
    // treat "Employees at public firms" as a firm-level population merely
    // because the qualifier contains the words "public firms".
    if (
      /^(?:employees?|workers?|individuals?|participants?|executives?|ceos?|directors?|managers?)\b/.test(
        normalized,
      )
    ) {
      return false;
    }
    return describesPublicFirmPopulation(supplied);
  }
  return rules[inferred]?.test(normalized) ?? true;
}

export function validateScopeInputLines(input: {
  sentence: string;
  scope: ScopeContract;
  mode: Mode;
  knownShock: string;
}) {
  const sentence = input.sentence.trim();
  const scope = Object.fromEntries(
    fieldKeys.map((key) => [key, input.scope[key].trim()]),
  ) as ScopeContract;
  const knownShock = input.mode === "audit" ? input.knownShock.trim() : "";
  if (
    fieldKeys.some((key) => scope[key].length > 200) ||
    (input.mode === "audit" && knownShock.length > 200)
  ) {
    return "Keep each Scope Contract value at 200 characters or fewer.";
  }
  if (
    /[\r\n\t\0\u2028\u2029]/.test(sentence) ||
    fieldKeys.some((key) => /[\r\n\t\0\u2028\u2029]/.test(scope[key])) ||
    (input.mode === "audit" && /[\r\n\t\0\u2028\u2029]/.test(knownShock))
  ) {
    return "Keep the study sentence and each Scope Contract value on one line.";
  }
  return "";
}

export function fieldMatchesSentenceDraft(
  key: FieldKey,
  inferred: string,
  supplied: string,
) {
  if (isPlaceholderValue(inferred)) return true;
  const normalized = normalizeValue(supplied);
  if (key === "population") {
    return populationMatchesDraft(inferred, supplied);
  }
  if (key === "assignmentLevel" || key === "analysisLevel") {
    const inferredKinds = levelKinds(inferred);
    const suppliedKinds = levelKinds(supplied);
    return (
      inferredKinds.size === 1 &&
      suppliedKinds.size === 1 &&
      [...inferredKinds][0] === [...suppliedKinds][0]
    );
  }
  if (key === "geography") {
    const inferredGeographies = explicitGeographies(inferred);
    const suppliedGeographies = explicitGeographies(supplied);
    if (
      inferredGeographies.size === 0 ||
      suppliedGeographies.size === 0
    ) {
      return canonicalGeography(inferred) === canonicalGeography(supplied);
    }
    return (
      inferredGeographies.size === 1 &&
      suppliedGeographies.size === 1 &&
      [...inferredGeographies][0] === [...suppliedGeographies][0]
    );
  }
  if (key === "studyPeriod") {
    const years = (value: string) =>
      value.match(/\b(?:19|20)\d{2}\b/g)?.join("–") ?? "";
    return years(inferred) === years(supplied);
  }
  if (key === "outcomeFrequency") {
    const inferredKinds = frequencyKinds(inferred);
    const suppliedKinds = frequencyKinds(supplied);
    return (
      inferredKinds.size === 1 &&
      suppliedKinds.size === 1 &&
      [...inferredKinds][0] === [...suppliedKinds][0]
    );
  }

  if (key === "industry") {
    const inferredIndustry = normalizeValue(inferred);
    const videoGameIndustry = new Set([
      "video gaming",
      "video games",
      "interactive entertainment",
    ]);
    const gamblingIndustry = new Set([
      "gambling",
      "gambling and casinos",
      "casinos",
    ]);
    const videoGameCue =
      /\b(?:video[- ]+gaming|video[- ]+games?|videogames?|interactive[- ]+entertainment)\b/;
    const gamblingCue =
      /\b(?:gambling|casinos?|wagering|sports[- ]+betting)\b/;
    if (videoGameIndustry.has(inferredIndustry)) {
      return videoGameCue.test(normalized) && !gamblingCue.test(normalized);
    }
    if (gamblingIndustry.has(inferredIndustry)) {
      return gamblingCue.test(normalized) && !videoGameCue.test(normalized);
    }
  }

  const semanticCues: Partial<Record<FieldKey, Record<string, RegExp>>> = {
    industry: {
      Manufacturing: /\bmanufactur(?:ing|ers?)\b/,
      Technology: /\b(?:technology|tech)\b/,
      Banking: /\b(?:banking|banks?)\b/,
      Healthcare: /\b(?:healthcare|health care)\b/,
      Energy: /\benergy\b/,
      Retail: /\bretail\b/,
      Pharmaceutical: /\bpharmaceuticals?\b/,
      Transportation: /\btransportation\b/,
      "Video gaming":
        /\b(?:video[- ]+gaming|video[- ]+games?|videogames?|interactive[- ]+entertainment)\b/,
      "Video games":
        /\b(?:video[- ]+gaming|video[- ]+games?|videogames?|interactive[- ]+entertainment)\b/,
      "Interactive entertainment":
        /\b(?:video[- ]+gaming|video[- ]+games?|videogames?|interactive[- ]+entertainment)\b/,
      "Gambling and casinos":
        /\b(?:gambling|casinos?|wagering|sports[- ]+betting)\b/,
      Gambling: /\b(?:gambling|casinos?|wagering|sports[- ]+betting)\b/,
      Casinos: /\b(?:gambling|casinos?|wagering|sports[- ]+betting)\b/,
      "All industries": /\b(?:all|across)\s+industries\b/,
    },
    eventFamily: {
      Regulation: /\b(?:regulation|regulatory|law|rule|act)\b/,
      "Court ruling": /\b(?:court|ruling|judicial)\b/,
      Disaster: /\b(?:disaster|hurricane|flood|earthquake|wildfire)\b/,
      Infrastructure: /\b(?:infrastructure|outage|grid)\b/,
      Policy: /\b(?:policy|subsidy|tariff)\b/,
      Market: /\b(?:market|financial)\b/,
    },
    outcomeFamily: {
      Profitability: /\b(?:profitability|profits?|roa|return on assets)\b/,
      "Firm performance": /\b(?:firm|company)\s+performance\b/,
      Innovation:
        /\b(?:innovation|patenting|patent\s+(?:counts?|applications?|output))\b/,
      Employment: /\b(?:employment|hiring|workforce)\b/,
      Investment: /\binvestments?\b/,
      "Market performance": /\b(?:stock returns?|market value)\b/,
      Inequality: /\b(?:inequality|pay gap)\b/,
    },
  };
  const fieldCues = semanticCues[key];
  const cue = fieldCues?.[inferred];
  if (!cue) return normalizeValue(inferred) === normalized;
  const addsAnotherRecognizedFamily = Object.entries(fieldCues).some(
    ([label, pattern]) => label !== inferred && pattern.test(normalized),
  );
  return cue.test(normalized) && !addsAnotherRecognizedFamily;
}

function missingFieldChoices(key: FieldKey, scope: ScopeContract) {
  if (key === "assignmentLevel") {
    const choices: NonNullable<Ambiguity["choices"]> = [];
    const recognizedLevels = new Set([
      "Individual",
      "Firm",
      "Organization",
      "State",
      "Region",
      "Country",
      "Industry",
    ]);
    if (recognizedLevels.has(scope.analysisLevel)) {
      choices.push({
        label: `${scope.analysisLevel} — same as analysis level`,
        value: scope.analysisLevel,
      });
    }
    choices.push(
      {
        label: "State or equivalent subnational jurisdiction",
        value: "State",
      },
      { label: "Country", value: "Country" },
      { label: "Industry or market", value: "Industry" },
    );
    return choices.filter(
      (choice, index) =>
        choices.findIndex((candidate) => candidate.value === choice.value) ===
        index,
    );
  }
  if (key === "outcomeFrequency") {
    return [
      { label: "Annual", value: "Annual" },
      { label: "Biannual or semiannual", value: "Biannual" },
      { label: "Biennial", value: "Biennial" },
      { label: "Quarterly", value: "Quarterly" },
      { label: "Monthly", value: "Monthly" },
      { label: "Bimonthly", value: "Bimonthly" },
      { label: "Weekly", value: "Weekly" },
      { label: "Biweekly", value: "Biweekly" },
      { label: "Daily", value: "Daily" },
      { label: "Hourly", value: "Hourly" },
      { label: "Minutely", value: "Minutely" },
      { label: "Event-based", value: "Event-based" },
    ];
  }
  return undefined;
}

export function validateSentence(sentence: string) {
  const trimmed = sentence.trim();
  if (trimmed.length < 20)
    return "Describe the study in at least 20 characters.";
  if (trimmed.length > 350)
    return "Keep the study description below 350 characters.";
  if (/[\r\n\t\0\u2028\u2029]/.test(trimmed))
    return "Write the study description as one sentence on one line.";

  const withoutAbbreviations = trimmed
    .replace(/\bU\.S\.A\./gi, "USA")
    .replace(/\bU\.S\./gi, "US")
    .replace(/\bU\.K\./gi, "UK")
    .replace(/\be\.g\./gi, "eg")
    .replace(/\bi\.e\./gi, "ie");
  const sentenceEndings =
    withoutAbbreviations.match(/[!?]+|(?:\.(?=\s|$))/g)?.length ?? 0;
  if (sentenceEndings > 1) {
    return "Combine the study into one clear sentence before drafting the scope.";
  }
  return "";
}

export function validateStudyPeriod(value: string) {
  const match = value
    .trim()
    .match(
      /^(?:from\s+)?(?:fy\s*)?((?:19|20)\d{2})\s*(?:[-‐‑‒–—]|to|through)\s*(?:fy\s*)?((?:19|20)\d{2})$/i,
    );
  if (!match) {
    return "Enter one year range, such as 2014–2022.";
  }
  const startYear = Number(match[1]);
  const endYear = Number(match[2]);
  if (startYear >= endYear) {
    return "The start year must be earlier than the end year.";
  }
  return "";
}

type AmbiguityInput = {
  scope: ScopeContract;
  mode: Mode;
  knownShock: string;
  resolvedKeys: DecisionKey[];
  sentence?: string;
};

export function getAmbiguities({
  scope,
  mode,
  knownShock,
  resolvedKeys: _resolvedKeys,
  sentence,
}: AmbiguityInput): Ambiguity[] {
  const issues: Ambiguity[] = [];
  const deferredUntilShockSelection = new Set<FieldKey>([
    "assignmentLevel",
    "outcomeFrequency",
  ]);
  const normalizedIndustry = normalizeValue(scope.industry);
  const normalizedSentence = normalizeValue(sentence ?? "");
  const unresolvedGamingTerm =
    normalizedIndustry === "gaming" ||
    ((isPlaceholderValue(scope.industry) || normalizedIndustry === "gmaing") &&
      (/\bgmaing\b/.test(normalizedSentence) ||
        (/\bgaming\b/.test(normalizedSentence) &&
          !/\b(?:video[- ]+gaming|online[- ]+gaming|mobile[- ]+gaming|computer[- ]+gaming|casino[- ]+gaming)\b/.test(
            normalizedSentence,
          ) &&
          !/\b(?:gambling|casinos?|wagering|sports[- ]+betting)\b/.test(
            normalizedSentence,
          ))));
  if (unresolvedGamingTerm) {
    issues.push({
      key: "industry",
      title: /\bgmaing\b/.test(
        `${normalizedIndustry} ${normalizedSentence}`,
      )
        ? "Did you mean gaming?"
        : "Which kind of gaming is in scope?",
      question:
        "Choose the industry meaning you intend. ShockAudit will preserve this study wording and expand search aliases separately.",
      choices: [
        {
          label: "Video games / interactive entertainment",
          value: "Video gaming",
        },
        {
          label: "Gambling / casinos",
          value: "Gambling and casinos",
        },
      ],
    });
  }
  const genericPublicPopulation = isGenericPublicFirmPopulation(
    scope.population,
    scope.geography,
  );
  if (
    genericPublicPopulation &&
    isPlaceholderValue(scope.geography)
  ) {
    issues.push({
      key: "geography",
      title: "Geography needs a decision",
      question:
        "Specify the study geography before choosing the operational public-firm boundary.",
    });
  } else if (
    populationGeographyMismatch(scope.population, scope.geography)
  ) {
    const choices =
      describesPublicFirmPopulation(scope.population) &&
      !isPlaceholderValue(scope.geography)
        ? publicFirmChoices(scope.geography)
        : undefined;
    issues.push({
      key: "population",
      title: "Population and geography do not match",
      question: `Choose a population boundary that is consistent with ${scope.geography}.`,
      choices,
    });
  } else if (isAmbiguousPublicEnterprise(scope.population)) {
    issues.push({
      key: "population",
      title: "What does public enterprises mean in this study?",
      question:
        "Specify whether this means listed corporations, state-owned enterprises, or another operational population.",
    });
  }

  for (const key of fieldKeys) {
    if (issues.some((issue) => issue.key === key)) continue;
    const value = scope[key];
    if (isPlaceholderValue(value)) {
      if (deferredUntilShockSelection.has(key)) continue;
      issues.push({
        key,
        title: `${fieldLabels[key]} needs a decision`,
        question: `Add a specific ${fieldLabels[key].toLowerCase()} before confirming the scope.`,
        choices: missingFieldChoices(key, scope),
      });
      continue;
    }

    if (key === "studyPeriod" && validateStudyPeriod(value)) {
      issues.push({
        key,
        title: "Study period needs one valid range",
        question:
          "Enter exactly one start year and one later end year, such as 2014–2022.",
      });
      continue;
    }

    const misplacedDomain =
      key === "population" &&
      !isPlaceholderValue(scope.geography) &&
      normalizeValue(canonicalGeography(value)) ===
        normalizeValue(canonicalGeography(scope.geography))
        ? "geography"
        : wrongDomain(key, value);
    if (misplacedDomain) {
      issues.push({
        key,
        title: `${fieldLabels[key]} contains the wrong type of value`,
        question: `Replace this ${misplacedDomain} value with a specific ${fieldLabels[key].toLowerCase()}.`,
        choices: missingFieldChoices(key, scope),
      });
      continue;
    }

    if (
      (key === "assignmentLevel" || key === "analysisLevel") &&
      levelKinds(value).size === 0
    ) {
      issues.push({
        key,
        title: `${fieldLabels[key]} needs one identifiable level`,
        question: `Name one primary ${fieldLabels[
          key
        ].toLowerCase()}, such as firm, state, country, industry, or individual.`,
        choices: missingFieldChoices(key, scope),
      });
      continue;
    }

    if (
      (key === "assignmentLevel" || key === "analysisLevel") &&
      levelKinds(value).size > 1
    ) {
      issues.push({
        key,
        title: `${fieldLabels[key]} contains more than one level`,
        question: `Choose one primary ${fieldLabels[key].toLowerCase()} for the Scope Contract.`,
        choices: missingFieldChoices(key, scope),
      });
      continue;
    }

    if (key === "outcomeFrequency" && frequencyKinds(value).size > 1) {
      issues.push({
        key,
        title: "Outcome frequency contains more than one interval",
        question:
          "Choose one primary observation interval for the Scope Contract.",
        choices: missingFieldChoices(key, scope),
      });
    }
  }

  if (
    mode === "audit" &&
    (isPlaceholderValue(knownShock) ||
      isGenericKnownShock(knownShock))
  ) {
    issues.unshift({
      key: "knownShock",
      title: "Which known shock should be audited?",
      question: "Name the event, law, ruling, disruption, or policy change.",
    });
  }
  if (mode === "audit" && sentence && !isPlaceholderValue(knownShock)) {
    if (
      hasMultipleKnownShockCandidates(sentence) &&
      !issues.some((issue) => issue.key === "knownShock")
    ) {
      issues.unshift({
        key: "knownShock",
        title: "Study sentence names more than one possible shock",
        question:
          "Choose one focal event and use that same event in the study sentence and Known shock field.",
      });
    }
    const extractedSentenceShock = extractKnownShock(sentence);
    if (
      extractedSentenceShock &&
      !isGenericKnownShock(extractedSentenceShock) &&
      !knownShockValuesMatch(extractedSentenceShock, knownShock) &&
      !issues.some((issue) => issue.key === "knownShock")
    ) {
      issues.unshift({
        key: "knownShock",
        title: "Known shock does not match the study sentence",
        question:
          "Use the same specifically named event in the study sentence and the Known shock field.",
      });
    }

    if (
      canonicalKnownShockName(knownShock) &&
      normalizeValue(scope.eventFamily) !== "regulation" &&
      !issues.some((issue) => issue.key === "eventFamily")
    ) {
      issues.push({
        key: "eventFamily",
        title: "Event family does not match the known shock",
        question:
          "CCPA, GDPR, and Sarbanes–Oxley are regulatory events; use Regulation or revise the named shock.",
      });
    }
  }
  return issues;
}

export function canConfirmScope(input: {
  sentenceError: string;
  scopeError?: string;
  ambiguities: Ambiguity[];
  alignment: import("./scope-types").ScopeAlignmentResult;
  confirmed: boolean;
}) {
  return (
    !input.sentenceError &&
    !input.scopeError &&
    input.ambiguities.length === 0 &&
    input.alignment.alignedForConfirmation &&
    !input.confirmed
  );
}

export function isFieldKey(value: string): value is FieldKey {
  return fieldKeys.includes(value as FieldKey);
}
