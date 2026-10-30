import type { ScopeContract } from "./scope-types";
import {
  matchReviewedEventAliases,
  normalizeReviewedEventAliasText,
} from "./reviewed-event-aliases";

function matchesAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function cueIsNegated(text: string, cue: string) {
  return (
    new RegExp(`\\bnon[- ](?:${cue})\\b`).test(text) ||
    new RegExp(
      `\\bnot\\s+(?:(?:[\\w.-]+)\\s+){0,6}(?:${cue})\\b`,
    ).test(text) ||
    new RegExp(
      `\\b(?:no|not\\s+(?:an?\\s+|the\\s+)?|excluding|exclude(?:s|d)?|except(?:ing)?|outside(?:\\s+of)?|apart\\s+from|without|other\\s+than|rather\\s+than|instead\\s+of|but|save)\\s+(?:(?:[\\w.-]+)\\s+){0,4}(?:${cue})\\b`,
    ).test(text) ||
    new RegExp(
      `\\b(?:all|any)\\s+(?:(?:[\\w.-]+)\\s+){0,4}but\\s+(?:(?:[\\w.-]+)\\s+){0,2}(?:${cue})\\b`,
    ).test(text)
  );
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

type ScopeLevel =
  | "Individual"
  | "Firm"
  | "Organization"
  | "State"
  | "Region"
  | "Country"
  | "Industry"
  | "Patent"
  | "Transaction"
  | "Establishment"
  | "Plant"
  | "Claim"
  | "Contract"
  | "Order"
  | "Product"
  | "Alliance"
  | "Dyad"
  | "City"
  | "Municipality";

type LevelRule = {
  level: ScopeLevel;
  assignment: RegExp[];
  analysis: RegExp[];
};

function makeLevelRule(
  level: ScopeLevel,
  levelTerms: string,
  unitTerms: string,
  assignmentEvents = "shock|policy",
): LevelRule {
  const levelNoun = `(?:${levelTerms})`;
  const unitNoun = `(?:${unitTerms})`;
  return {
    level,
    assignment: [
      new RegExp(
        `\\b${levelNoun}[ -]level (?:assignment|treatment|exposure|${assignmentEvents})\\b`,
      ),
      new RegExp(
        `\\b(?:assignment|treatment|exposure)\\s+(?:(?:is assigned|is|occurs?|happens?|varies|differs)\\s+)?(?:at|by|across|to|from)\\s+(?:the\\s+)?${unitNoun}(?:\\s+level)?\\b`,
      ),
      new RegExp(
        `\\bunit of assignment (?:is |are )?(?:the )?${levelNoun}\\b`,
      ),
    ],
    analysis: [
      new RegExp(
        `\\b${levelNoun}[ -]level (?:analysis|outcomes?|observations?|data)\\b`,
      ),
      new RegExp(
        `\\b(?:analysis|outcomes?|observations?|data)\\s+(?:(?:is|are)\\s+)?(?:(?:measured|observed|estimated)\\s+)?(?:at|by)\\s+(?:the\\s+)?${unitNoun}(?:\\s+level)?\\b`,
      ),
      new RegExp(
        `\\bunit of analysis (?:is |are )?(?:(?:an?|the) )?${levelNoun}\\b`,
      ),
      new RegExp(
        `\\bunits? of (?:analysis|observation) (?:is |are )?(?:(?:an?|the) )?${unitNoun}\\b`,
      ),
      new RegExp(
        `\\banalysis (?:is )?(?:conducted|performed|estimated) at (?:the )?${unitNoun}(?:\\s+level)?\\b`,
      ),
    ],
  };
}

const levelRules: LevelRule[] = [
  makeLevelRule(
    "Individual",
    "individual|employee|worker",
    "individuals?|employees?|workers?",
  ),
  makeLevelRule("Firm", "firm|company", "firms?|compan(?:y|ies)"),
  makeLevelRule(
    "Organization",
    "organization",
    "organizations?",
  ),
  makeLevelRule(
    "State",
    "state",
    "states?",
    "shock|policy|law|regulation|ruling|disaster",
  ),
  makeLevelRule(
    "Region",
    "region|regional|county",
    "regions?|count(?:y|ies)",
    "shock|policy|law|regulation|disaster",
  ),
  makeLevelRule(
    "Country",
    "country|national",
    "countr(?:y|ies)",
    "shock|policy|law|regulation|ruling|disaster",
  ),
  makeLevelRule(
    "Industry",
    "industry|market",
    "industr(?:y|ies)|markets?",
    "shock|policy|regulation",
  ),
  makeLevelRule("Patent", "patent", "patents?"),
  makeLevelRule("Transaction", "transaction", "transactions?"),
  makeLevelRule(
    "Establishment",
    "establishment|facility",
    "establishments?|facilities",
  ),
  makeLevelRule("Plant", "plant", "plants?"),
  makeLevelRule("Claim", "claim", "claims?"),
  makeLevelRule("Contract", "contract", "contracts?"),
  makeLevelRule("Order", "order", "orders?"),
  makeLevelRule("Product", "product", "products?"),
  makeLevelRule("Alliance", "alliance", "alliances?"),
  makeLevelRule("Dyad", "dyad", "dyads?"),
  makeLevelRule("City", "city", "cities"),
  makeLevelRule(
    "Municipality",
    "municipality|municipal",
    "municipalit(?:y|ies)",
  ),
];

function inferLevel(text: string, role: "assignment" | "analysis") {
  const matches = levelRules
    .filter((rule) => rule[role].some((pattern) => pattern.test(text)))
    .map((rule) => rule.level);
  return {
    value: matches.length === 1 ? matches[0] : "Not specified",
    explicit: matches.length > 0,
  };
}

function inferAssignmentLevel(text: string) {
  const inferred = inferLevel(text, "assignment").value;
  if (inferred !== "Not specified") return inferred;
  if (
    /\b(?:national|nationwide|federal)\s+(?:law|policy|regulation|rule|ruling|shock)\b/.test(
      text,
    )
  ) {
    return "Country";
  }
  if (
    /\b(?:assignment|treatment|exposure)\b[^.!?]{0,60}\bacross (?:us\s+)?states\b/.test(
      text,
    ) ||
    /\b(?:shock|policy|law|regulation|ruling)\b[^.!?]{0,50}\b(?:is\s+)?(?:assigned|adopted|enacted|implemented|occurs?|varies)\s+across (?:us\s+)?states\b/.test(
      text,
    )
  ) {
    return "State";
  }
  return inferred;
}

function analysisLevelFromPopulation(population: string) {
  if (["Employees", "Executives", "Individuals"].includes(population))
    return "Individual";
  if (
    ["Public firms", "Private firms", "Firms"].includes(population)
  ) {
    return "Firm";
  }
  if (
    ["Hospitals", "Universities", "Organizations"].includes(population)
  ) {
    return "Organization";
  }
  if (population === "States") return "State";
  if (population === "Countries") return "Country";
  if (population === "Industries") return "Industry";
  return "Not specified";
}

function populationParsingText(text: string) {
  return text
    .replace(
      /\b(?:individual|employee|worker|firm|company|organization|state|region|regional|county|country|national|industry|market)[ -]level (?:assignment|treatment|exposure|shock|policy|law|regulation|ruling|disaster)\b/g,
      " ",
    )
    .replace(
      /\b(?:unit of assignment|assignment|treatment|exposure)\s+(?:(?:is assigned|is|occurs?|happens?|varies)\s+)?(?:at|by|across|to)\s+(?:the\s+)?(?:individuals?|employees?|workers?|firms?|compan(?:y|ies)|organizations?|states?|regions?|count(?:y|ies)|countr(?:y|ies)|industr(?:y|ies)|markets?)(?:\s+level)?\b/g,
      " ",
    );
}

function hasPublicFirmCue(text: string) {
  const firmNoun =
    "(?:firms?|compan(?:y|ies)|businesses?|issuers?|corporations?)";
  if (
    new RegExp(
      `\\bpublicly\\s+(?:traded|listed|held|owned)(?:\\s+[\\w.-]+){0,4}\\s+${firmNoun}\\b`,
    ).test(text)
  ) {
    return true;
  }

  const plainPublic = new RegExp(
    `\\bpublic((?:\\s+[\\w.-]+){0,5}?)\\s+${firmNoun}\\b`,
    "g",
  );
  const relationalOrEventWords =
    /\b(?:of|about|on|for|at|in|from|toward|towards|among|with|regarding|against|over|surrounding|data|records?|scrutiny|concern|pressure|opinion|backlash|debate|information|policy|regulation|law|shock|event|agency|official|sector|relations?|accounting|utilit(?:y|ies)|benefit)\b/;
  for (const match of text.matchAll(plainPublic)) {
    if (!relationalOrEventWords.test(match[1])) return true;
  }

  return (
    new RegExp(
      `\\b${firmNoun}\\s+(?:(?:that|which)\\s+)?(?:are\\s+|is\\s+)?public(?:ly\\s+(?:traded|listed|held|owned))?\\b`,
    ).test(text) ||
    new RegExp(
      `\\bexchange[- ]listed(?:\\s+[\\w.-]+){0,4}\\s+${firmNoun}\\b`,
    ).test(text) ||
    new RegExp(
      `\\b(?:u\\.s\\.|us|u\\.k\\.|uk|eu)[- ]listed\\s+${firmNoun}\\b`,
    ).test(text)
  );
}

function hasPrivateFirmCue(text: string) {
  const firmNoun =
    "(?:firms?|compan(?:y|ies)|businesses?|issuers?|corporations?)";
  const plainPrivate = new RegExp(
    `\\bprivate((?:\\s+[\\w.-]+){0,5}?)\\s+${firmNoun}\\b`,
    "g",
  );
  const relationalWords =
    /\b(?:of|about|on|for|at|in|from|among|with|regarding|against|over|surrounding|data|records?|information|reporting|coverage|equity|investment|capital|credit)\b/;
  for (const match of text.matchAll(plainPrivate)) {
    if (!relationalWords.test(match[1])) return true;
  }
  return (
    new RegExp(
      `\\bprivately\\s+(?:held|owned)(?:\\s+[\\w.-]+){0,4}\\s+${firmNoun}\\b`,
    ).test(text) ||
    new RegExp(
      `\\b${firmNoun}\\s+(?:(?:that|which)\\s+)?(?:are\\s+|is\\s+)?private(?:ly\\s+(?:held|owned))?\\b`,
    ).test(text)
  );
}

function inferPopulation(text: string, explicitAnalysisLevel: string) {
  const populationText = populationParsingText(text);
  const firmPattern =
    /\b(?:firms?|compan(?:y|ies)|businesses?|issuers?|corporations?)\b/;
  const employeesAtFirms =
    /\b(?:employees?|workers?)\s+(?:at|in|of)\s+(?:public(?:ly)?\s+)?(?:[\w.-]+\s+){0,3}(?:firms?|compan(?:y|ies)|businesses?|corporations?)\b/;
  const executivesAtFirms =
    /\b(?:ceos?|executives?|directors?|managers?)\s+(?:at|in|of)\s+(?:public(?:ly)?\s+)?(?:[\w.-]+\s+){0,3}(?:firms?|compan(?:y|ies)|businesses?|corporations?)\b/;

  if (employeesAtFirms.test(populationText)) return "Employees";
  if (executivesAtFirms.test(populationText)) return "Executives";

  const candidates = new Set<string>();
  const publicFirmCue = hasPublicFirmCue(populationText);
  const privateFirmCue = hasPrivateFirmCue(populationText);
  if (
    publicFirmCue &&
    !cueIsNegated(
      populationText,
      "public(?:ly)?(?:\\s+(?:traded|listed|held|owned))?(?:\\s+[\\w.-]+){0,4}\\s+(?:firms?|compan(?:y|ies)|businesses?|issuers?|corporations?)",
    )
  ) {
    candidates.add("Public firms");
  }
  if (
    privateFirmCue &&
    !cueIsNegated(
      populationText,
      "private(?:ly)?(?:\\s+(?:held|owned))?(?:\\s+[\\w.-]+){0,4}\\s+(?:firms?|compan(?:y|ies)|businesses?|issuers?|corporations?)",
    )
  ) {
    candidates.add("Private firms");
  }
  if (
    /\b(?:employees?|workers?|individuals?|participants?)\b/.test(
      populationText,
    ) &&
    !cueIsNegated(
      populationText,
      "employees?|workers?|individuals?|participants?",
    )
  )
    candidates.add("Employees");
  if (
    /\b(?:ceos?|executives?|directors?|managers?)\b/.test(populationText) &&
    !cueIsNegated(
      populationText,
      "ceos?|executives?|directors?|managers?",
    )
  )
    candidates.add("Executives");
  if (
    /\bhospitals?\b/.test(populationText) &&
    !cueIsNegated(populationText, "hospitals?")
  )
    candidates.add("Hospitals");
  if (
    /\buniversit(?:y|ies)\b/.test(populationText) &&
    !cueIsNegated(populationText, "universit(?:y|ies)")
  )
    candidates.add("Universities");
  if (
    firmPattern.test(populationText) &&
    !publicFirmCue &&
    !privateFirmCue &&
    !cueIsNegated(
      populationText,
      "firms?|compan(?:y|ies)|businesses?|issuers?|corporations?",
    )
  )
    candidates.add("Firms");
  if (
    /\borganizations?\b/.test(populationText) &&
    !cueIsNegated(populationText, "organizations?")
  )
    candidates.add("Organizations");
  if (
    /\bstate governments?\b|\bselected states\b|\bstates (?:as|are) (?:the )?(?:units|population|observations)\b/.test(
      populationText,
    ) &&
    !cueIsNegated(populationText, "states?|state governments?") &&
    candidates.size === 0
  )
    candidates.add("States");
  if (
    /\bcountries\b/.test(populationText) &&
    !cueIsNegated(populationText, "countries") &&
    candidates.size === 0
  )
    candidates.add("Countries");
  if (
    /\bindustries\b/.test(populationText) &&
    !cueIsNegated(populationText, "industries") &&
    candidates.size === 0
  )
    candidates.add("Industries");

  if (candidates.size === 1) return [...candidates][0];
  if (candidates.size > 1) return "Not specified";

  const populationByLevel: Record<string, string> = {
    Individual: "Employees",
    Firm: "Firms",
    Organization: "Organizations",
    State: "States",
    Region: "Regions",
    Country: "Countries",
    Industry: "Industries",
    Patent: "Patents",
    Transaction: "Transactions",
    Establishment: "Establishments",
    Plant: "Plants",
    Claim: "Claims",
    Contract: "Contracts",
    Order: "Orders",
    Product: "Products",
    Alliance: "Alliances",
    Dyad: "Dyads",
    City: "Cities",
    Municipality: "Municipalities",
  };
  return populationByLevel[explicitAnalysisLevel] ?? "Not specified";
}

function inferFreeTextGeography(text: string) {
  const populationNoun =
    "(?:firms?|compan(?:y|ies)|businesses?|issuers?|corporations?|organizations?|employees?|workers?|hospitals?|universit(?:y|ies)|individuals?|participants?|establishments?|plants?|transactions?)";
  const clauseBoundary =
    "(?=\\s+(?:with|from|between|during|that|which|where|whose|using|under|after|before|over|for|to|as|and)\\b|[,.;]|$)";
  const place =
    "([a-z][a-z.'-]*(?:\\s+[a-z][a-z.'-]*){0,3}?)";
  const patterns = [
    new RegExp(
      `\\b${populationNoun}\\s+(?:based|located|headquartered|domiciled)\\s+in\\s+(?:the\\s+)?${place}${clauseBoundary}`,
    ),
    new RegExp(
      `\\b${populationNoun}\\s+in\\s+(?:the\\s+)?${place}${clauseBoundary}`,
    ),
  ];
  const excluded =
    /^(?:the )?(?:sample|study|dataset|data|public markets?|stock markets?|private markets?|all industries|selected industries|selected states|multiple states|several states|selected regions?|multiple regions?|several regions?|various regions?|chosen regions?|regions?|firms?|companies|organizations|workplaces?|establishments?|plants?)$/;

  for (const pattern of patterns) {
    const candidate = pattern.exec(text)?.[1]?.trim() ?? "";
    if (
      !candidate ||
      excluded.test(candidate) ||
      /\b(?:sample|dataset|industr(?:y|ies)|sectors?|markets?)\b/.test(
        candidate,
      ) ||
      /\b(?:19|20)\d{2}\b/.test(candidate)
    ) {
      continue;
    }
    const aliases: Record<string, string> = {
      us: "United States",
      usa: "United States",
      uk: "United Kingdom",
      eu: "European Union",
    };
    return aliases[candidate] ?? titleCase(candidate);
  }
  return "";
}

function outcomeRoleText(text: string) {
  const segments: Array<{ index: number; value: string }> = [];
  const effectPatterns = [
    /\b(?:may\s+)?(?:influences?|impacts?|changes?|changed|affects?|affected|alters?|altered|reduces?|reduced|increases?|increased)\s+([^.!?]{1,160})/g,
    /\baffecting\s+((?:(?:annual|quarterly|monthly|weekly|daily|hourly|biannual|biennial|bimonthly|biweekly|minutely|event[- ]based)\s+|both\s+(?:annual|quarterly|monthly|weekly|daily|hourly)\s+and\s+(?:annual|quarterly|monthly|weekly|daily|hourly)\s+)?(?:profitability|profits?|firm performance|innovation|patenting|patent\s+(?:counts?|applications?|output)|employment|hiring|workforce|stock returns?|market value|inequality|pay gap)[^.!?]{0,120})/g,
    /\b(?:effect|impact)\s+of\b[^.!?]{1,120}\bon\s+([^.!?]{1,160})/g,
    /\b(?:outcomes?|measures?|measurements?|observations?)\s+(?:are|were|include|measured|observed|recorded)?\s*([^.!?]{1,120})/g,
    /\bwith\s+((?:(?:annual|quarterly|monthly|weekly|daily|hourly|biannual|biennial|bimonthly|biweekly|minutely|event[- ]based)\s+)(?:profitability|profits?|firm performance|innovation|patenting|patent\s+(?:counts?|applications?|output)|employment|hiring|workforce|stock returns?|market value|inequality|pay gap)(?:\s+outcomes?)?)/g,
  ];
  for (const pattern of effectPatterns) {
    for (const match of text.matchAll(pattern)) {
      if (match[1]) {
        segments.push({
          index: match.index ?? 0,
          value: match[1],
        });
      }
    }
  }
  const selected = segments
    .sort((left, right) => left.index - right.index)
    .at(-1)?.value;
  return (
    selected
      ?.split(
        /\b(?:among|using|controlling\s+for|included?\s+as\s+(?:a\s+)?control|during|while)\b/,
      )[0]
      ?.trim() ?? ""
  );
}

function inferOutcomeFrequency(text: string) {
  const candidates: Array<[string, RegExp[]]> = [
    ["Annual", [/\bannual\b/, /\bannually\b/, /\byearly\b/]],
    [
      "Biannual",
      [
        /\bbiannual(?:ly)?\b/,
        /\bsemiannual(?:ly)?\b/,
        /\btwice (?:a|per) year\b/,
      ],
    ],
    ["Biennial", [/\bbiennial(?:ly)?\b/]],
    ["Quarterly", [/\bquarterly\b/, /\beach quarter\b/]],
    ["Monthly", [/\bmonthly\b/, /\beach month\b/]],
    ["Bimonthly", [/\bbimonthly\b/]],
    ["Weekly", [/\bweekly\b/, /\beach week\b/]],
    ["Biweekly", [/\bbiweekly\b/]],
    ["Daily", [/\bdaily\b/, /\beach day\b/]],
    ["Hourly", [/\bhourly\b/, /\beach hour\b/]],
    ["Minutely", [/\bminutely\b/, /\beach minute\b/]],
    [
      "Event-based",
      [/\bevent-based\b/, /\bevent based\b/, /\bevent-time\b/],
    ],
  ];
  const relevantText = outcomeRoleText(text);
  if (!relevantText) return "Not specified";
  const outcomeCue =
    /\b(?:profitability|profits?|firm performance|innovation|patenting|patent\s+(?:counts?|applications?|output)|employment|hiring|workforce|investments?|stock returns?|market value|inequality|pay gap)\b/;
  const outcomeMatch = outcomeCue.exec(relevantText);
  const roleBoundText = outcomeMatch
    ? relevantText.slice(0, outcomeMatch.index + outcomeMatch[0].length)
    : relevantText;
  const matches = candidates
    .filter(([, patterns]) => matchesAny(roleBoundText, patterns))
    .map(([frequency]) => frequency);
  return matches.length === 1 ? matches[0] : "Not specified";
}

function canonicalShockMatches(value: string) {
  return [...new Set(matchReviewedEventAliases(value).map(
    ({ record }) => record.canonicalName,
  ))];
}

function reviewedEventAliasCuePattern(value: string) {
  return normalizeReviewedEventAliasText(value)
    .split(" ")
    .filter(Boolean)
    .map((token) => token.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
    .join("[-\\s]+");
}

export function canonicalKnownShockName(value: string) {
  const matches = canonicalShockMatches(value);
  return matches.length === 1 ? matches[0] : "";
}

export function hasMultipleKnownShockCandidates(value: string) {
  if (canonicalShockMatches(value).length > 1) return true;
  if (
    /\b(?:either\b[^.!?]{1,80}\bor|rather than|instead of|versus|vs\.?)\b|,\s*not\b/i.test(
      value,
    )
  ) return true;
  const genericEventMarker =
    /\b(?:acts?|laws?|rulings?|decisions?|regulations?|reforms?|hurricanes?|earthquakes?|wildfires?|floods?|outages?|tariffs?|bans?|mandates?|strikes?|crises|breaches|pandemics?)\b/i;
  const eventBearingSegments = value
    .split(/\b(?:and|or|alongside)\b/i)
    .filter((segment) =>
      genericEventMarker.test(segment) ||
      matchReviewedEventAliases(segment).length > 0
    );
  return eventBearingSegments.length > 1;
}

export function extractKnownShock(sentence: string) {
  if (
    hasMultipleKnownShockCandidates(sentence) ||
    /audit whether (?:the )?.+?\s+rather than\s+.+?\s+(?:affected|changed|altered|influenced|reduced|increased)\b/i.test(
      sentence,
    )
  ) {
    return "";
  }
  const patterns = [
    /audit whether (?:the )?(.+?)(?:\s+rather than\b|\s+instead of\b|\s+(?:affected|changed|altered|influenced|reduced|increased)\b)/i,
    /(?:effect|impact) of (?:the )?(.+?) on\b/i,
    /audit (?:the )?(.+?) as (?:a )?shock\b/i,
  ];

  for (const pattern of patterns) {
    const match = sentence.match(pattern);
    if (match?.[1] && match[1].trim().split(/\s+/).length <= 12) {
      const candidate = match[1].trim();
      if (
        /\b(?:either|or|rather than|instead of|versus|vs\.?)\b|,\s*not\b/i.test(
          candidate,
        ) ||
        canonicalShockMatches(candidate).length > 1
      ) {
        return "";
      }
      return canonicalKnownShockName(candidate) || titleCase(candidate);
    }
  }
  return canonicalKnownShockName(sentence);
}

function eventRoleText(text: string) {
  const targetBoundary = text.search(/\b(?:affecting|affected)\b/);
  if (targetBoundary >= 0) return text.slice(0, targetBoundary);
  const effectBoundary = text.search(
    /\b(?:changes?|changed|altering|altered|influences?|influenced|reduces?|reduced|increases?|increased)\b/,
  );
  return effectBoundary >= 0 ? text.slice(0, effectBoundary) : text;
}

function inferStudyPeriod(sentence: string) {
  const normalized = sentence.replace(/[‐‑‒–—]/g, "-");
  const patterns = [
    /\bbetween\s+((?:19|20)\d{2})\s+and\s+((?:19|20)\d{2})\b/gi,
    /\bfrom\s+((?:19|20)\d{2})\s+(?:to|through|until)\s+((?:19|20)\d{2})\b/gi,
    /\b((?:19|20)\d{2})\s*(?:-|to|through)\s*((?:19|20)\d{2})\b/gi,
  ];
  const ranges = patterns
    .flatMap((pattern) => [...normalized.matchAll(pattern)])
    .map((match) => `${match[1]}–${match[2]}`);
  return new Set(ranges).size === 1 ? ranges[0] : "Not specified";
}

export function draftScope(sentence: string): ScopeContract {
  const text = sentence
    .toLowerCase()
    .replace(/\bu\.s\.a\.?/g, "usa")
    .replace(/\bu\.s\./g, "us")
    .replace(/\bu\.k\./g, "uk")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/\s+/g, " ");

  const assignmentLevel = inferAssignmentLevel(text);
  const analysisInference = inferLevel(text, "analysis");
  const population = inferPopulation(text, analysisInference.value);
  const analysisLevel = analysisInference.explicit
    ? analysisInference.value
    : analysisLevelFromPopulation(population);

  const geographyCandidates = new Set<string>();
  const firmNoun =
    "(?:firms?|compan(?:y|ies)|businesses?|issuers?|corporations?)";
  const geographyModifier =
    "(?:(?:public|private|listed|exchange[- ]listed|based|headquartered|domiciled|manufacturing|technology|banking|healthcare|energy|retail|pharmaceutical|transportation|nonfinancial|financial)[- ]+){0,4}";
  const hasUnitedStatesCue =
    matchesAny(text, [
      /\bus(?=\s|$)/,
      /\busa(?=\s|$)/,
      /\bunited states\b/,
      /\bin (?:the )?us\b/,
      new RegExp(`\\b(?:usa|us)[- ]+${geographyModifier}${firmNoun}\\b`),
    ]) ||
    (new RegExp(
      `\\bamerican[- ]+${geographyModifier}${firmNoun}\\b`,
    ).test(text) &&
      !/\b(?:north|latin|central|south) american\b/.test(text));
  if (
    hasUnitedStatesCue &&
    !cueIsNegated(
      text,
      "(?:usa|us|united states(?: of america)?|american)",
    )
  ) {
    geographyCandidates.add("United States");
  }
  if (
    matchesAny(text, [
      /\buk(?=\s|$)/,
      /\bunited kingdom\b/,
      /\bin (?:the )?uk\b/,
      new RegExp(`\\buk[- ]+${geographyModifier}${firmNoun}\\b`),
      new RegExp(`\\bbritish[- ]+${geographyModifier}${firmNoun}\\b`),
    ]) &&
    !cueIsNegated(
      text,
      "(?:uk|united kingdom|british)",
    )
  ) {
    geographyCandidates.add("United Kingdom");
  }
  if (
    matchesAny(text, [
      /\beuropean union\b/,
      /\bin (?:the )?eu\b/,
      new RegExp(`\\beu[- ]+${geographyModifier}${firmNoun}\\b`),
    ]) &&
    !cueIsNegated(
      text,
      "(?:european union|eu|european)",
    )
  ) {
    geographyCandidates.add("European Union");
  }
  if (
    new RegExp(
      `\\beuropean[- ]+${geographyModifier}${firmNoun}\\b`,
    ).test(text) &&
    !/\beuropean union\b/.test(text) &&
    !cueIsNegated(text, "european")
  ) {
    geographyCandidates.add("Europe");
  }
  if (
    (/\bcanada\b|\bcanadian\b/.test(text)) &&
    !cueIsNegated(text, "(?:canada|canadian)")
  )
    geographyCandidates.add("Canada");
  if (
    (/\baustralia\b|\baustralian\b/.test(text)) &&
    !cueIsNegated(text, "(?:australia|australian)")
  )
    geographyCandidates.add("Australia");
  if (
    (/\bchina\b|\bchinese\b/.test(text)) &&
    !cueIsNegated(text, "(?:china|chinese)")
  )
    geographyCandidates.add("China");
  if (
    (/\bthailand\b|\bthai\b/.test(text)) &&
    !cueIsNegated(text, "(?:thailand|thai)")
  )
    geographyCandidates.add("Thailand");
  if (
    (/\bnetherlands\b|\bdutch\b/.test(text)) &&
    !cueIsNegated(text, "(?:netherlands|dutch)")
  )
    geographyCandidates.add("Netherlands");
  const freeTextGeography = inferFreeTextGeography(text);
  if (freeTextGeography) geographyCandidates.add(freeTextGeography);
  const geography =
    geographyCandidates.size === 1
      ? [...geographyCandidates][0]
      : "Not specified";

  let industry = "Not specified";
  const industries = [
    { label: "Manufacturing", cue: "manufacturing" },
    { label: "Technology", cue: "technology" },
    { label: "Banking", cue: "banking" },
    { label: "Healthcare", cue: "healthcare" },
    { label: "Energy", cue: "energy" },
    { label: "Retail", cue: "retail" },
    { label: "Pharmaceutical", cue: "pharmaceutical" },
    { label: "Transportation", cue: "transportation" },
    {
      label: "Video gaming",
      cue: "(?:video[- ]+gaming|video[- ]+games?|videogames?|interactive[- ]+entertainment)",
    },
    {
      label: "Gambling and casinos",
      cue: "(?:gambling|casinos?|wagering|sports[- ]+betting)",
    },
  ];
  const foundIndustries = industries.filter((candidate) => {
    const rolePatterns = [
      new RegExp(
        `\\b${candidate.cue}(?:[- ](?:based|focused|sector|industry))?[- ]+${firmNoun}\\b`,
      ),
      new RegExp(
        `\\b${firmNoun}\\b(?:\\s+(?:operating|active|engaged))?\\s+(?:in|within|from)\\s+(?:the\\s+)?${candidate.cue}(?:\\s+(?:industry|sector))?\\b`,
      ),
      new RegExp(`\\b${candidate.cue}\\s+(?:industry|sector)\\b`),
    ];
    return (
      matchesAny(text, rolePatterns) &&
      !cueIsNegated(text, candidate.cue)
    );
  });
  if (
    /\b(?:all|across)\s+industries\b/.test(text) &&
    !/\b(?:except|excluding|other than|apart from|without|but|save)\b[^.!?]{0,40}\b(?:industry|manufacturing|technology|banking|healthcare|energy|retail|pharmaceutical|transportation)\b/.test(
      text,
    )
  )
    industry = "All industries";
  else if (foundIndustries.length === 1)
    industry = foundIndustries[0].label;

  const eventCandidates = new Set<string>();
  const eventText = eventRoleText(text);
  if (
    /\b(?:court\s+(?:decision|ruling|order)|judicial\s+(?:decision|ruling)|ruling)\b/.test(
      eventText,
    ) &&
    !/\bruling\s+part(?:y|ies)\b/.test(eventText) &&
    !cueIsNegated(
      eventText,
      "(?:court\\s+(?:decision|ruling|order)|judicial\\s+(?:decision|ruling)|ruling)",
    )
  )
    eventCandidates.add("Court ruling");
  const genericRegulationCue =
    "(?:regulatory\\s+(?:shock|change|event|intervention)|regulation|law(?!\\s+(?:firms?|practices?|offices?|schools?)\\b)|act(?!\\s+(?:firms?|practices?|offices?|schools?)\\b)|statute|ordinance|directive|rule)";
  const hasGenericRegulationCue =
    new RegExp(`\\b${genericRegulationCue}\\b`).test(eventText) &&
    !cueIsNegated(eventText, genericRegulationCue);
  const hasReviewedRegulationCue = matchReviewedEventAliases(eventText).some(
    ({ record, matchedAlias }) =>
      record.eventFamily === "Regulation" &&
      !cueIsNegated(eventText, reviewedEventAliasCuePattern(matchedAlias)),
  );
  if (
    (hasGenericRegulationCue || hasReviewedRegulationCue) &&
    !eventCandidates.has("Court ruling")
  )
    eventCandidates.add("Regulation");
  if (
    /\b(?:hurricane|flood|earthquake|wildfire)\b/.test(eventText) &&
    !cueIsNegated(
      eventText,
      "(?:hurricane|flood|earthquake|wildfire)",
    )
  )
    eventCandidates.add("Disaster");
  if (
    /\b(?:power\s+outage|grid\s+outage|electric grid|infrastructure\s+(?:failure|outage|shock))\b/.test(
      eventText,
    ) &&
    !cueIsNegated(
      eventText,
      "(?:power\\s+outage|grid\\s+outage|electric grid|infrastructure\\s+(?:failure|outage|shock))",
    )
  )
    eventCandidates.add("Infrastructure");
  if (
    /\b(?:policy\s+(?:shock|change|reform|adoption)|subsidy|tariff)\b/.test(
      eventText,
    ) &&
    !cueIsNegated(
      eventText,
      "(?:policy\\s+(?:shock|change|reform|adoption)|subsidy|tariff)",
    ) &&
    eventCandidates.size === 0
  )
    eventCandidates.add("Policy");
  if (
    /\b(?:market|financial)\s+(?:shock|disruption|crash)\b/.test(
      eventText,
    ) &&
    !cueIsNegated(
      eventText,
      "(?:(?:market|financial)\\s+(?:shock|disruption|crash))",
    )
  )
    eventCandidates.add("Market");
  const eventFamily =
    eventCandidates.size === 1
      ? [...eventCandidates][0]
      : "Not specified";

  const outcomeText = outcomeRoleText(text);
  const outcomeCandidates = new Set<string>();
  if (
    (/\b(?:profitability|profits?|roa)\b|\breturn on assets\b/.test(
      outcomeText,
    )) &&
    !cueIsNegated(
      outcomeText,
      "(?:profitability|profits?|roa|return on assets)",
    )
  )
    outcomeCandidates.add("Profitability");
  if (
    /\b(?:firm|company) performance\b/.test(outcomeText) &&
    !cueIsNegated(outcomeText, "(?:(?:firm|company) performance)")
  )
    outcomeCandidates.add("Firm performance");
  if (
    /\b(?:innovation|patenting|patent\s+(?:counts?|applications?|output))\b/.test(
      outcomeText,
    ) &&
    !cueIsNegated(
      outcomeText,
      "(?:innovation|patenting|patent\\s+(?:counts?|applications?|output))",
    )
  )
    outcomeCandidates.add("Innovation");
  if (
    /\b(?:employment|hiring|workforce)\b/.test(outcomeText) &&
    !cueIsNegated(outcomeText, "(?:employment|hiring|workforce)")
  )
    outcomeCandidates.add("Employment");
  if (
    /\binvestments?\b(?!\s+(?:bank(?:s|ing)?|firms?|companies|funds?|managers?|management)\b)/.test(
      outcomeText,
    ) &&
    !cueIsNegated(outcomeText, "investments?")
  )
    outcomeCandidates.add("Investment");
  if (
    /\b(?:stock returns?|market value)\b/.test(outcomeText) &&
    !cueIsNegated(outcomeText, "(?:stock returns?|market value)")
  )
    outcomeCandidates.add("Market performance");
  if (
    /\b(?:inequality|pay gap)\b/.test(outcomeText) &&
    !cueIsNegated(outcomeText, "(?:inequality|pay gap)")
  )
    outcomeCandidates.add("Inequality");
  const outcomeFamily =
    outcomeCandidates.size === 1
      ? [...outcomeCandidates][0]
      : "Not specified";

  const outcomeFrequency = inferOutcomeFrequency(text);

  return {
    population,
    assignmentLevel,
    analysisLevel,
    geography,
    industry,
    studyPeriod: inferStudyPeriod(sentence),
    eventFamily,
    outcomeFamily,
    outcomeFrequency,
  };
}
