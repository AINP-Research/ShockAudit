import type {
  Screen02FindProposal,
  Screen02Source,
} from "./screen02-types";
import {
  compareScreen02FormalIdentifiers,
  parseScreen02FormalIdentifier,
} from "./screen02-formal-identifier";

export const SCREEN02_SOURCE_GROUNDING_VERSION =
  "screen-02-source-grounding-v1" as const;
export const SCREEN02_SOURCE_GROUNDING_MAX_COORDINATES_PER_SOURCE = 2;
export const SCREEN02_SOURCE_GROUNDING_MAX_COORDINATE_TEXT_CHARS = 1_200;
export const SCREEN02_SOURCE_GROUNDING_MAX_IDENTITY_TERMS = 16;
export const SCREEN02_SOURCE_GROUNDING_MAX_FORMAL_IDENTIFIERS = 4;
export const SCREEN02_SOURCE_GROUNDING_MAX_ACTION_TERMS = 16;
export const SCREEN02_SOURCE_GROUNDING_MAX_DATE_TERMS = 4;

export type Screen02SourceEvidencePolarity =
  | "affirmative"
  | "negated"
  | "instructional";

export type Screen02SourceEvidenceCoordinate = {
  sourceId: string;
  sentenceStart: number;
  sentenceEnd: number;
  characterStart: number;
  characterEnd: number;
  text: string;
  matchedIdentityTerms: string[];
  matchedFormalIdentifiers: string[];
  matchedActionTerms: string[];
  matchedDateTerms: string[];
  polarity: Screen02SourceEvidencePolarity;
};

export type Screen02ProposalSourceGrounding = {
  version: typeof SCREEN02_SOURCE_GROUNDING_VERSION;
  supported: boolean;
  evidenceText: string;
  coordinates: Screen02SourceEvidenceCoordinate[];
  reason: string;
};

type Screen02SourceGroundingCacheEntry = {
  title: string;
  eventFamily: string;
  eventDate: string;
  formalIdentifier: string | null;
  issuer: string | null;
  provisionalDates: string[];
  sourceId: string;
  sourceEvidenceText: string;
  sourcePublishedDate: string | null;
  sourceAuthorityTier: number;
  result: Screen02ProposalSourceGrounding;
};

const screen02SourceGroundingCache = new WeakMap<
  Screen02FindProposal,
  WeakMap<Screen02Source, Screen02SourceGroundingCacheEntry>
>();

function sameOrderedStrings(left: readonly string[], right: readonly string[]) {
  return left.length === right.length &&
    left.every((value, index) => value === right[index]);
}

function cachedScreen02SourceGroundingMatches(
  entry: Screen02SourceGroundingCacheEntry,
  proposal: Screen02FindProposal,
  source: Screen02Source,
) {
  return entry.title === proposal.title &&
    entry.eventFamily === proposal.event.eventFamily &&
    entry.eventDate === proposal.event.eventDate &&
    entry.formalIdentifier ===
      (proposal.nativeIdentity?.formalIdentifier ?? null) &&
    entry.issuer === (proposal.nativeIdentity?.issuer ?? null) &&
    sameOrderedStrings(entry.provisionalDates, proposal.provisionalDates) &&
    entry.sourceId === source.id &&
    entry.sourceEvidenceText === (source.evidenceText ?? "") &&
    entry.sourcePublishedDate === (source.publishedDate ?? null) &&
    entry.sourceAuthorityTier === source.authorityTier;
}

function immutableScreen02SourceGrounding(
  result: Screen02ProposalSourceGrounding,
) {
  for (const coordinate of result.coordinates) {
    Object.freeze(coordinate.matchedIdentityTerms);
    Object.freeze(coordinate.matchedFormalIdentifiers);
    Object.freeze(coordinate.matchedActionTerms);
    Object.freeze(coordinate.matchedDateTerms);
    Object.freeze(coordinate);
  }
  Object.freeze(result.coordinates);
  return Object.freeze(result) as Screen02ProposalSourceGrounding;
}

type SentenceCoordinate = {
  index: number;
  start: number;
  end: number;
  text: string;
};

const TITLE_STOP_WORDS = new Set([
  "a", "an", "and", "announcement", "approv", "approval", "approve",
  "approved", "approves", "act", "action", "adopt", "adopted", "by",
  "change", "changes", "commission", "department", "final", "for", "from",
  "industry", "into", "law", "modification", "modifications", "notice", "of",
  "on", "order", "program", "proposal", "proposed", "regulation",
  "regulatory", "rule", "self", "the", "to", "with",
]);

const ACTION_PATTERNS = [
  ["adopt", /\badopt(?:s|ed|ing)?\b/iu],
  ["allow", /\ballow(?:s|ed|ing)?\b/iu],
  ["amend", /\bamend(?:s|ed|ing|ment|ments)?\b/iu],
  ["apply", /\bappl(?:y|ies|ied|ying)\b/iu],
  ["approv", /\bapprov(?:e|es|ed|ing|al|als)\b/iu],
  ["authoriz", /\bauthoriz(?:e|es|ed|ing|ation|ations)\b/iu],
  ["ban", /\bban(?:s|ned|ning)?\b/iu],
  ["chang", /\bchang(?:e|es|ed|ing)\b/iu],
  ["declar", /\bdeclar(?:e|es|ed|ing|ation|ations)\b/iu],
  ["detect", /\bdetect(?:s|ed|ing|ion|ions)?\b/iu],
  ["enact", /\benact(?:s|ed|ing|ment|ments)?\b/iu],
  ["establish", /\bestablish(?:es|ed|ing|ment|ments)?\b/iu],
  ["expand", /\bexpand(?:s|ed|ing)?\b/iu],
  ["finaliz", /\bfinaliz(?:e|es|ed|ing|ation)\b/iu],
  ["impos", /\bimpos(?:e|es|ed|ing|ition)\b/iu],
  ["introduc", /\bintroduc(?:e|es|ed|ing|tion)\b/iu],
  ["issu", /\bissu(?:e|es|ed|ing|ance|ances)\b/iu],
  [
    "effect",
    /\b(?:(?:take|takes|took|taken|taking)\s+effect|(?:become|becomes|became|becoming|is|are|was|were)\s+effective)\b/iu,
  ],
  ["limit", /\blimit(?:s|ed|ing|ation|ations)?\b/iu],
  ["mandat", /\bmandat(?:e|es|ed|ing|ory)\b/iu],
  ["permit", /\bpermit(?:s|ted|ting)?\b/iu],
  ["prohibit", /\bprohibit(?:s|ed|ing|ion|ions)?\b/iu],
  ["requir", /\brequir(?:e|es|ed|ing|ement|ements)\b/iu],
  ["restrict", /\brestrict(?:s|ed|ing|ion|ions)?\b/iu],
  ["revis", /\brevis(?:e|es|ed|ing|ion|ions)\b/iu],
  ["replac", /\breplac(?:e|es|ed|ing|ement|ements)\b/iu],
  ["set", /\b(?:set|sets|setting)\b/iu],
  ["struck", /\b(?:strike|strikes|striking|struck)\b/iu],
  ["occur", /\boccur(?:s|red|ring|rence|rences)?\b/iu],
  ["began", /\b(?:begin|begins|beginning|began|begun)\b/iu],
  ["record", /\brecord(?:s|ed|ing)?\b/iu],
  ["report", /\breport(?:s|ed|ing)?\b/iu],
] as const;

const LEGAL_INSTRUMENT_KINDS = [
  "act", "bill", "code", "decision", "decree", "directive", "law",
  "ordinance", "order", "program", "regulation", "rule", "statute",
] as const;

const INTERVENING_SOURCE_METADATA =
  /^(?:agency|formal identifier|identifier|issuer|issuing authority|issuing body|issuing jurisdiction|jurisdiction|publisher|record identifier|source identifier)\s*:/iu;

const EXPLICIT_ISSUER_METADATA =
  /(?:^|[;,\n\r—–(]\s*)(?:agency|issuer|issuing authority|issuing body)\s*:\s*([^;\n\r]{1,240})/giu;

const EXPLICIT_FORMAL_IDENTIFIER_METADATA =
  /(?:^|[;,\n\r—–(]\s*)(?:formal identifier|record identifier|identifier)\s*:\s*([^;\n\r]{1,240})/giu;

const NEXT_EXPLICIT_IDENTITY_METADATA =
  /\s(?:,|—|–)\s*(?:agency|formal identifier|identifier|issuer|issuing authority|issuing body|record identifier)\s*:/iu;

const CANDIDATE_CONTEXT_METADATA =
  /^(?:the official record concerns\b|(?:action|agency announcement date|affected (?:entities|organizations|population|units)|alert level|application (?:date|start)|commencement date|compliance date|countries? reported|covered (?:entities|organizations|population|units)|declaration date|effective date|enforcement date|entry into force|expiration date|implementation date|incident (?:began|begin|end|start)|participants?|phase(?: \d+)?(?: date| start)?|status|sunset date|treatment date)\s*:)/iu;

const CANDIDATE_CONTEXT_ANAPHOR =
  /^(?:(?:overview|summary)\s*:\s*)?(?:it|(?:the|this) (?:(?:adopted|enacted|final|proposed) )?(?:act|action|bill|decision|decree|directive|instrument|law|measure|order|ordinance|program|regulation|rule|standard|statute))\b/iu;

const CANDIDATE_POPULATION_CONTEXT =
  /^(?:affected|covered|eligible|participating|regulated)\s+(?:actors?|businesses|companies|entities|firms|organizations|operators|participants?|people|persons?|units?)\b|^(?:participants?|regulated entities)\s+(?:are|include)\b/iu;

const CANDIDATE_TIMING_CONTEXT =
  /^(?:effective|operative)(?:\s+(?:on|from))?\s+(?:(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+(?:18|19|20|21)\d{2}|(?:18|19|20|21)\d{2}-\d{2}-\d{2})\b/iu;

const CANDIDATE_MIXED_TIMING_CONTEXT =
  /^publication date\s*:[^;\n]{1,80};\s*(?:application (?:date|start)|commencement date|compliance date|effective date|enforcement date|entry into force|implementation date|treatment date)\s*:/iu;

const EXPLICIT_NAMED_INSTRUMENT =
  /\b(?:the\s+)?(?:[A-Z][\p{L}\p{N}'’&.-]*\s+){1,10}(?:Act|Bill|Code|Decision|Decree|Directive|Law|Ordinance|Order|Program|Regulation|Rule|Statute)\b/gu;

const BOUNDED_NAMED_INSTRUMENT =
  /\b(?:[\p{L}\p{N}'’&.-]+\s+){1,10}(?:act|bill|code|decision|decree|directive|law|ordinance|order|program|regulation|rule|statute)\b/giu;

const INSTRUCTIONAL_EVIDENCE =
  /\b(?:ignore|disregard)\b.{0,80}\b(?:instruction|prompt|rule|system)\b|\b(?:system|developer)\s+prompt\b|\b(?:you|the assistant|the model)\s+(?:must|should)\b|\b(?:classify|mark|treat|return|render)\b.{0,80}\b(?:candidate|proposal)\b.{0,40}\b(?:eligible|qualified|direct|adjacent|broad)\b/iu;

const NEGATABLE_ACTION =
  String.raw`(?:adopt\w*|allow\w*|amend\w*|approv\w*|authoriz\w*|ban\w*|chang\w*|declar\w*|enact\w*|establish\w*|expand\w*|finaliz\w*|impos\w*|introduc\w*|issu\w*|limit\w*|mandat\w*|permit\w*|prohibit\w*|replac\w*|requir\w*|restrict\w*|revis\w*|set|sets|setting|(?:take|takes|took|taken|taking)\s+effect)`;

const NEGATED_ACTION = new RegExp(
  String.raw`\b(?:did|does|do|has|have|had|is|was|were|will|would)\s+not\b(?:\s+[\p{L}\p{N}.-]+){0,10}\s+${NEGATABLE_ACTION}\b|` +
    String.raw`\b(?:never|no|not|without)\b(?:\s+[\p{L}\p{N}.-]+){0,8}\s+${NEGATABLE_ACTION}\b|` +
    String.raw`\b${NEGATABLE_ACTION}\b(?:\s+[\p{L}\p{N}.-]+){0,10}\s+(?:never|not|unknown|unestablished)\b|` +
    String.raw`\bfail(?:s|ed|ing)?\s+to\b(?:\s+[\p{L}\p{N}.-]+){0,8}\s+${NEGATABLE_ACTION}\b|` +
    String.raw`\b(?:falsely|incorrectly)\s+(?:claim\w*|describ\w*|report\w*)\b(?:\s+[\p{L}\p{N}.-]+){0,8}\s+${NEGATABLE_ACTION}\b`,
  "iu",
);

const NEGATED_DISASTER_OCCURRENCE =
  /\b(?:(?:did|does|do|has|have|had|is|was|were|will|would)\s+not|never|no|not|without)\b(?:\s+[\p{L}\p{N}.-]+){0,10}\s+(?:beg(?:in|ins|inning|an|un)|detect\w*|occur\w*|record\w*|report\w*|strik\w*|struck)\b|\b(?:beg(?:in|ins|inning|an|un)|detect\w*|occur\w*|record\w*|report\w*|strik\w*|struck)\b(?:\s+[\p{L}\p{N}.-]+){0,10}\s+(?:never|no|not|unknown|unestablished)\b|\bfail(?:s|ed|ing)?\s+to\b(?:\s+[\p{L}\p{N}.-]+){0,8}\s+(?:beg(?:in|ins|inning)|detect\w*|occur\w*|record\w*|report\w*|strik\w*)\b|\bfalsely\s+(?:describ\w*|list\w*|record\w*|report\w*)\b(?:\s+[\p{L}\p{N}.-]+){0,8}\s+(?:beg(?:in|ins|inning|an)|detect\w*|occur\w*|record\w*|report\w*|strik\w*)\b/iu;

const NEGATED_TRANSITION =
  /\b(?:did|does|do|has|have|had|is|was|were|will|would|shall)\s+not\b(?:\s+[\p{L}\p{N}.-]+){0,8}\s+(?:appl\w*|become\s+effective|commenc\w*|enter\w*\s+into\s+force|implement\w*|(?:take|takes|took|taken|taking)\s+effect)|\b(?:never|no|not|without)\b(?:\s+[\p{L}\p{N}.-]+){0,8}\s+(?:appl\w*|effective|implementation|in\s+force|(?:take|takes|took|taken|taking)\s+effect)\b|\b(?:falsely|incorrectly)\s+(?:claim\w*|describ\w*|report\w*)\b(?:\s+[\p{L}\p{N}.-]+){0,8}\s+(?:(?:take|takes|took|taken|taking)\s+effect|becom\w*\s+effective|enter\w*\s+into\s+force)\b/iu;

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/(?<=\p{L})\.(?=\p{L})/gu, "")
    .replace(/&/gu, " and ")
    .replace(/[’']/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

function tokenStem(value: string) {
  const token = normalize(value);
  if (token.length <= 3) return token;
  if (token.endsWith("ies") && token.length > 5) {
    return `${token.slice(0, -3)}y`;
  }
  if (/(?:sses|shes|ches|xes|zes)$/u.test(token) && token.length > 5) {
    return token.slice(0, -2);
  }
  for (const suffix of ["ments", "ment", "ations", "ation", "ingly", "edly", "ing", "ers", "ors", "ed"] as const) {
    if (token.endsWith(suffix) && token.length - suffix.length >= 4) {
      return token.slice(0, -suffix.length);
    }
  }
  if (token.endsWith("s") && !token.endsWith("ss") && token.length > 4) {
    return token.slice(0, -1);
  }
  return token;
}

function unique(values: readonly string[]) {
  return [...new Set(values)].sort((left, right) =>
    left.localeCompare(right, "en-US")
  );
}

function boundedTerms(values: readonly string[], maximum: number) {
  return unique(values)
    .filter((value) => value.length > 0 && value.length <= 160)
    .slice(0, maximum);
}

function sentenceCoordinates(value: string): SentenceCoordinate[] {
  const rawSentences: Array<{ start: number; end: number }> = [];
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index] ?? "";
    const next = value[index + 1] ?? "";
    const lineBoundary = character === "\n" || character === "\r";
    const punctuationBoundary = /[.!?]/u.test(character) &&
      (!next || /\s/u.test(next));
    const abbreviation = character === "." &&
      /(?:\b(?:e\.g|i\.e|no|mr|mrs|ms|dr|prof)|\b(?:[\p{L}]\.)+[\p{L}])$/iu
        .test(value.slice(Math.max(start, index - 16), index));
    if (!lineBoundary && (!punctuationBoundary || abbreviation)) {
      continue;
    }
    rawSentences.push({ start, end: lineBoundary ? index : index + 1 });
    if (character === "\r" && next === "\n") index += 1;
    start = index + 1;
  }
  if (start < value.length) {
    rawSentences.push({ start, end: value.length });
  }
  const retained = rawSentences.flatMap((span) => {
    const raw = value.slice(span.start, span.end);
    const leading = raw.search(/\S/u);
    if (leading < 0) return [];
    let trailing = raw.length;
    while (trailing > leading && /\s/u.test(raw[trailing - 1] ?? "")) {
      trailing -= 1;
    }
    const sentenceStart = span.start + leading;
    const sentenceEnd = span.start + trailing;
    const text = value.slice(sentenceStart, sentenceEnd);
    return [{
      start: sentenceStart,
      end: sentenceEnd,
      text,
    }];
  });
  return retained.map((sentence, index) => ({ ...sentence, index }));
}

function titleIdentityTerms(title: string) {
  return unique(normalize(title).split(" ").map(tokenStem).filter((token) =>
    token.length >= 3 && !TITLE_STOP_WORDS.has(token) && !/^\d+$/u.test(token)
  ));
}

function normalizedFormalIdentifiers(proposal: Screen02FindProposal) {
  const formalIdentifier = normalize(
    proposal.nativeIdentity?.formalIdentifier ?? "",
  );
  return formalIdentifier ? [formalIdentifier] : [];
}

function dateTerms(proposal: Screen02FindProposal, source: Screen02Source) {
  return unique([
    proposal.event.eventDate,
    ...proposal.provisionalDates,
    source.publishedDate ?? "",
  ].flatMap((value) => [...value.matchAll(/\b(?:18|19|20|21)\d{2}(?:-\d{2}(?:-\d{2})?)?\b/gu)]
    .map((match) => match[0])));
}

function matchedDateTerms(
  text: string,
  expectedDates: readonly string[],
) {
  const normalizedText = normalize(text);
  return expectedDates.filter((date) => {
    const normalizedDate = normalize(date);
    return /^\d{4}$/u.test(date)
      ? new RegExp(`(?:^|\\s)${date}(?:$|\\s)`, "u").test(normalizedText)
      : normalizedDate.length > 0 && normalizedText.includes(normalizedDate);
  });
}

function actionTerms(sentence: string) {
  // Source metadata labels describe who issued an item; they are not evidence
  // that the candidate itself was issued or otherwise took effect.
  const withoutMetadataLabels = sentence.replace(
    /\b(?:data\s+sets?|(?:ban|limit)\s+analys(?:is|es))\b/giu,
    (value) => " ".repeat(value.length),
  ).replace(
    /\bIssuing\s+(?:authority|jurisdiction)\s*:[^.\n]*/giu,
    (value) => " ".repeat(value.length),
  ).replace(
    /\bcountries?\s+reported\s*:[^.;\n]*/giu,
    (value) => " ".repeat(value.length),
  ).replace(
    /^(?:agency|formal identifier|identifier|issuer|issuing authority|issuing body|issuing jurisdiction|jurisdiction|publisher|record identifier|source identifier|action|agency announcement date|affected (?:entities|organizations|population|units)|alert level|application (?:date|start)|commencement date|compliance date|countries? reported|covered (?:entities|organizations|population|units)|declaration date|effective date|enforcement date|entry into force|expiration date|implementation date|incident (?:begin|end|start)|participants?|phase(?: \d+)?(?: date| start)?|status|sunset date|treatment date)\s*:[\s\S]*$/iu,
    (value) => " ".repeat(value.length),
  );
  return unique(ACTION_PATTERNS.flatMap(([action, pattern]) =>
    pattern.test(withoutMetadataLabels) ? [action] : []
  ));
}

function firstActionCharacter(sentence: string) {
  const matches = ACTION_PATTERNS.flatMap(([_action, pattern]) => {
    const match = pattern.exec(sentence);
    return match?.index === undefined ? [] : [match.index];
  });
  return matches.length > 0 ? Math.min(...matches) : null;
}

function clauseContainingFirstAction(sentence: string, firstAction: number) {
  const prefix = sentence.slice(0, firstAction);
  const boundaries = [
    ...prefix.matchAll(/;|\b(?:but|whereas|while)\b/giu),
  ];
  const boundary = boundaries.at(-1);
  const start = boundary?.index === undefined
    ? 0
    : boundary.index + boundary[0].length;
  const suffix = sentence.slice(firstAction);
  const trailingBoundary = /;|,\s*(?:according\s+to|see)\b|\b(?:but|whereas|while)\b/iu.exec(
    suffix,
  );
  const end = trailingBoundary?.index === undefined
    ? sentence.length
    : firstAction + trailingBoundary.index;
  return sentence.slice(start, end).trim();
}

function evidencePolarity(sentence: string): Screen02SourceEvidencePolarity {
  if (INSTRUCTIONAL_EVIDENCE.test(sentence)) return "instructional";
  const expandedNegation = sentence
    .replace(
      /\(\s*not a verbatim passage\s*\)/giu,
      (value) => " ".repeat(value.length),
    )
    .replace(/\bcannot\b/giu, "can not")
    .replace(/\bcan[’']t\b/giu, "can not")
    .replace(
      /\b(could|did|does|do|has|have|had|is|was|were|will|would)n[’']t\b/giu,
      "$1 not",
    );
  if (
    NEGATED_ACTION.test(expandedNegation) ||
    NEGATED_DISASTER_OCCURRENCE.test(expandedNegation) ||
    NEGATED_TRANSITION.test(expandedNegation)
  ) {
    return "negated";
  }
  return "affirmative";
}

function eventActionCompatible(
  proposal: Screen02FindProposal,
  matchedActions: readonly string[],
) {
  if (matchedActions.length === 0) return false;
  const family = normalize(proposal.event.eventFamily);
  if (/\b(?:disaster|hazard|weather|earthquake|flood|storm|wildfire)\b/u.test(family)) {
    return matchedActions.some((action) =>
      ["declar", "detect", "struck", "occur", "began", "record", "report"].includes(action)
    );
  }
  return matchedActions.some((action) =>
    !["detect", "struck", "occur", "began", "record", "report"].includes(action)
  );
}

function compatibleInstrumentAnaphor(title: string, sentence: string) {
  const titleTokens = new Set(normalize(title).split(" "));
  return LEGAL_INSTRUMENT_KINDS.some((kind) =>
    titleTokens.has(kind) && new RegExp(
      `\\b(?:(?:the|this)\\s+(?:final\\s+)?|final\\s+)${kind}\\b`,
      "iu",
    ).test(sentence)
  );
}

function guardedDisasterEventReference(
  proposal: Screen02FindProposal,
  sentence: string,
) {
  const family = normalize(proposal.event.eventFamily);
  if (!/\b(?:disaster|hazard|weather|earthquake|flood|storm|wildfire)\b/u.test(family)) {
    return false;
  }
  const eventKinds = [
    "cyclone", "disaster", "drought", "earthquake", "flood", "hazard",
    "hurricane", "storm", "tsunami", "typhoon", "volcano", "wildfire",
  ];
  const titleKinds = eventKinds.filter((kind) => hasNormalizedTerm(
    proposal.title,
    kind,
  ));
  const titleSpecificTerms = new Set(
    normalize(proposal.title).split(" ").filter((term) =>
      term.length >= 3 && !eventKinds.includes(term) &&
      !["event", "the", "this"].includes(term)
    ),
  );
  const competingNamedDisaster = [
    ...sentence.matchAll(
      /\b(?:The\s+)?((?:[A-Z][\p{L}'’.-]*\s+){1,6})(?:[Ee]arthquake|[Ff]lood|[Hh]urricane|[Ss]torm|[Tt]sunami|[Tt]yphoon|[Vv]olcano|[Ww]ildfire)\b/gu,
    ),
  ].some((match) => {
    const observedSpecificTerms = normalize(match[1] ?? "").split(" ")
      .filter((term) => term.length >= 3 && term !== "the");
    return observedSpecificTerms.length > 0 &&
      !observedSpecificTerms.every((term) => titleSpecificTerms.has(term));
  });
  return !competingNamedDisaster && titleKinds.length > 0 && titleKinds.some((kind) =>
    hasNormalizedTerm(sentence, kind)
  );
}

function hasNormalizedTerm(value: string, term: string) {
  return ` ${normalize(value)} `.includes(` ${normalize(term)} `);
}

function hasNormalizedTokenSequence(value: string, sequence: string) {
  const normalizedValue = normalize(value);
  const normalizedSequence = normalize(sequence);
  return Boolean(
    normalizedSequence &&
      ` ${normalizedValue} `.includes(` ${normalizedSequence} `),
  );
}

function boundedMetadataValues(value: string, pattern: RegExp) {
  return [...value.matchAll(pattern)].map((match) =>
    (() => {
      const captured = match[1] ?? "";
      const nextMetadata = captured.search(NEXT_EXPLICIT_IDENTITY_METADATA);
      return nextMetadata < 0 ? captured : captured.slice(0, nextMetadata);
    })()
      .replace(/[.!?]+\s*$/u, "")
      .trim()
  ).filter(Boolean);
}

const SAFE_ISSUER_DESCRIPTION =
  /^(?:a|an|the)\s+(?:(?:administrative|competition|consumer|federal|governmental|independent|national|public|regulatory|state)\s+)*(?:agency|authority|body|commission|department|institution|regulator)(?:\s+of\s+(?:the\s+)?(?:federal|national|state|united states)(?:\s+government)?)?$/iu;

const KNOWN_ISSUER_INITIALISMS = new Map<string, string>([
  ["epa", "environmental protection agency"],
  ["fcc", "federal communications commission"],
  ["ferc", "federal energy regulatory commission"],
  ["ftc", "federal trade commission"],
  ["sec", "securities and exchange commission"],
]);

function stripSafeIssuerDescription(value: string) {
  const comma = value.indexOf(",");
  if (comma < 0) return value.trim();
  const description = value.slice(comma + 1).trim();
  return SAFE_ISSUER_DESCRIPTION.test(description) ||
      firstActionCharacter(description) === 0
    ? value.slice(0, comma).trim()
    : value.trim();
}

function visibleStandaloneInitialism(value: string) {
  const withoutJurisdiction = value.trim().replace(
    /^(?:(?:U\.?S\.?)|United States)\s+/u,
    "",
  );
  return /^(?:(?:[A-Z]\.){2,8}|[A-Z]{2,8})$/u.test(withoutJurisdiction)
    ? normalize(withoutJurisdiction)
    : "";
}

function issuerIdentity(value: string) {
  const trimmed = stripSafeIssuerDescription(value);
  const alias = /^(.*?)\s*\(([A-Z][A-Z0-9.-]{1,14})\)\s*$/u.exec(trimmed);
  const baseText = alias?.[1] ?? trimmed;
  const normalizedBase = normalize(baseText)
    .replace(/^the\s+/u, "")
    .replace(/^(?:u s|us|united states)\s+/u, "");
  const standaloneInitialism = visibleStandaloneInitialism(baseText);
  return {
    base: KNOWN_ISSUER_INITIALISMS.get(standaloneInitialism) ?? normalizedBase,
    alias: normalize(alias?.[2] ?? ""),
  };
}

function issuerInitialism(value: string) {
  const tokens = normalize(value).split(" ").filter((token) =>
    token && !["and", "of", "the"].includes(token)
  );
  return tokens.length >= 2
    ? tokens.map((token) => token[0]).join("")
    : "";
}

function issuerAliasMatchesBase(identity: ReturnType<typeof issuerIdentity>) {
  if (!identity.alias) return true;
  const initialism = issuerInitialism(identity.base);
  return Boolean(initialism && identity.alias === initialism);
}

function issuerMetadataCompatible(expected: string, observed: string) {
  const expectedIdentity = issuerIdentity(expected);
  const observedIdentity = issuerIdentity(observed);
  if (
    !issuerAliasMatchesBase(expectedIdentity) ||
    !issuerAliasMatchesBase(observedIdentity)
  ) return false;
  const expectedInitialism = issuerInitialism(expectedIdentity.base);
  return Boolean(
    expectedIdentity.base &&
      expectedIdentity.base === observedIdentity.base &&
      [expectedIdentity.alias, observedIdentity.alias].every((alias) =>
        !alias || alias === expectedInitialism
      ),
  );
}

function explicitIssuerMetadataConflict(
  proposal: Screen02FindProposal,
  sentences: readonly SentenceCoordinate[],
) {
  const expectedIssuer = proposal.nativeIdentity?.issuer?.trim() ?? "";
  if (!expectedIssuer) return false;
  return sentences.some((sentence) =>
    boundedMetadataValues(sentence.text, EXPLICIT_ISSUER_METADATA).some(
      (observedIssuer) =>
        !issuerMetadataCompatible(expectedIssuer, observedIssuer),
    )
  );
}

function formalIdentifierMetadataValue(value: string) {
  return value.replace(
    /\s*\((?:(?:final|interim|official|proposed|temporary)\s+)?(?:decision|document|order|record|rule|version)\)\s*$/iu,
    "",
  ).trim();
}

type FormalIdentifierMention = Readonly<{
  start: number;
  end: number;
  text: string;
}>;

function legacyExpectedFamilyFormalIdentifierMentions(
  sentence: string,
  expectedIdentifier: string,
): FormalIdentifierMention[] {
  const expectedTokens = normalize(expectedIdentifier).split(" ")
    .filter(Boolean);
  const numericStart = expectedTokens.findIndex((token) => /\d/u.test(token));
  if (numericStart <= 0) return [];
  const prefix = expectedTokens.slice(0, numericStart);
  const escapedPrefix = prefix.map((token) =>
    token.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
  ).join("[^\\p{L}\\p{N}]+");
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])${escapedPrefix}[^\\p{L}\\p{N}]+` +
      "(?=[\\p{L}\\p{N}]*\\d)[\\p{L}\\p{N}]+" +
      "(?:[-/.\\u2013\\u2014][\\p{L}\\p{N}]+|\\([\\p{L}\\p{N}]+\\))*",
    "giu",
  );
  return [...sentence.matchAll(pattern)].map((match) => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
    text: formalIdentifierMetadataValue(match[0]),
  }));
}

const FORMAL_IDENTIFIER_MENTION_OVERFLOW =
  "screen02-formal-identifier-mention-overflow";

const FORMAL_IDENTIFIER_STARTERS = Object.freeze({
  bill: new Set([
    "a", "ab", "assembly", "california", "h", "hb", "house", "s", "sb",
    "senate",
  ]),
  celex: new Set(["celex"]),
  "european-instrument": new Set([
    "commission", "decision", "delegated", "directive", "ec", "eec", "eu",
    "implementing", "regulation", "uk",
  ]),
  "federal-register": new Set(["federal", "fr"]),
  "numbered-instrument": new Set([
    "act", "decree", "law", "order", "ordinance", "regulation", "rule",
  ]),
  "public-law": new Set(["pub", "public"]),
} as const);

/**
 * Extract complete, structured identifier spans while retaining their source
 * coordinates. Keeping only maximal spans prevents `AB 375` from hiding the
 * conflicting chapter/year coordinates that immediately follow it.
 */
function structuredFormalIdentifierMentions(
  sentence: string,
  expectedIdentifier: string,
): FormalIdentifierMention[] {
  const expected = parseScreen02FormalIdentifier(expectedIdentifier);
  if (!expected || expected.family === "opaque") return [];
  const tokens = [...sentence.matchAll(/[\p{L}\p{N}]+/gu)].map((match) => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
    normalized: normalize(match[0]),
  }));
  const starters = FORMAL_IDENTIFIER_STARTERS[expected.family];
  const spans: FormalIdentifierMention[] = [];
  for (let startIndex = 0; startIndex < tokens.length; startIndex += 1) {
    const startToken = tokens[startIndex]!;
    const rawStart = sentence.slice(startToken.start, startToken.end);
    if (
      !starters.has(startToken.normalized as never) &&
      !(expected.family === "celex" && /^(?:celex)?\d{1,2}(?:18|19|20|21)\d{2}[a-z]\d{3,8}$/iu.test(rawStart))
    ) continue;
    const maximumEnd = Math.min(tokens.length, startIndex + 16);
    for (let endIndex = startIndex + 1; endIndex <= maximumEnd; endIndex += 1) {
      const endToken = tokens[endIndex - 1]!;
      let coordinateEnd = endToken.end;
      while (/^[\])}]$/u.test(sentence[coordinateEnd] ?? "")) {
        coordinateEnd += 1;
      }
      const text = formalIdentifierMetadataValue(
        sentence.slice(startToken.start, coordinateEnd),
      );
      const parsed = parseScreen02FormalIdentifier(text);
      if (parsed?.family === expected.family) {
        spans.push({ start: startToken.start, end: coordinateEnd, text });
      }
    }
  }
  const maximal = spans.filter((span) =>
    !spans.some((other) =>
      other !== span && other.start <= span.start && other.end >= span.end &&
      (other.start < span.start || other.end > span.end)
    )
  );
  return maximal.length > SCREEN02_SOURCE_GROUNDING_MAX_FORMAL_IDENTIFIERS
    ? [
        ...maximal.slice(0, SCREEN02_SOURCE_GROUNDING_MAX_FORMAL_IDENTIFIERS),
        { start: 0, end: 0, text: FORMAL_IDENTIFIER_MENTION_OVERFLOW },
      ]
    : maximal;
}

function formalIdentifierMentions(
  sentence: string,
  expectedIdentifier: string,
) {
  const expected = parseScreen02FormalIdentifier(expectedIdentifier);
  if (expected && expected.family !== "opaque") {
    return structuredFormalIdentifierMentions(sentence, expectedIdentifier)
      .map((mention) => mention.text);
  }
  return opaqueFormalIdentifierMentions(sentence, expectedIdentifier)
    .map((mention) => mention.text);
}

function numericLeadingFormalIdentifierMentions(
  sentence: string,
  expectedIdentifier: string,
): FormalIdentifierMention[] {
  if (!/^(?:18|19|20|21)\d{2} [\p{L}\p{N}]{1,40}(?: [\p{L}\p{N}]{1,40})*$/u.test(
    normalize(expectedIdentifier),
  )) return [];
  return [...sentence.matchAll(
    /\b(?:18|19|20|21)\d{2}[-/–—][\p{L}\p{N}]{1,40}(?:[-/.–—][\p{L}\p{N}]{1,40})*\b/gu,
  )].map((match) => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
    text: formalIdentifierMetadataValue(match[0]),
  }));
}

function opaqueFormalIdentifierMentions(
  sentence: string,
  expectedIdentifier: string,
): FormalIdentifierMention[] {
  const mentions = [
    ...legacyExpectedFamilyFormalIdentifierMentions(
      sentence,
      normalize(expectedIdentifier),
    ),
    ...numericLeadingFormalIdentifierMentions(sentence, expectedIdentifier),
  ].filter((mention, index, all) =>
    all.findIndex((other) =>
      other.start === mention.start && other.end === mention.end
    ) === index
  ).sort((left, right) => left.start - right.start || left.end - right.end);
  return mentions.length > SCREEN02_SOURCE_GROUNDING_MAX_FORMAL_IDENTIFIERS
    ? [
        ...mentions.slice(0, SCREEN02_SOURCE_GROUNDING_MAX_FORMAL_IDENTIFIERS),
        { start: 0, end: 0, text: FORMAL_IDENTIFIER_MENTION_OVERFLOW },
      ]
    : mentions;
}

function exactFormalIdentifierMention(
  sentence: string,
  expectedIdentifier: string,
) {
  const normalizedExpected = normalize(expectedIdentifier);
  const expected = parseScreen02FormalIdentifier(expectedIdentifier);
  const scopedMentions = formalIdentifierMentions(sentence, expectedIdentifier);
  if (scopedMentions.includes(FORMAL_IDENTIFIER_MENTION_OVERFLOW)) return true;
  if (expected && expected.family !== "opaque") {
    return scopedMentions.some((mention) =>
      compareScreen02FormalIdentifiers(expectedIdentifier, mention) ===
        "equivalent"
    );
  }
  return scopedMentions.length > 0
    ? scopedMentions.some((mention) => normalize(mention) === normalizedExpected)
    : hasNormalizedTokenSequence(sentence, normalizedExpected);
}

function sentenceCarriesCandidateTitleIdentity(
  proposal: Screen02FindProposal,
  sentence: string,
) {
  const identityTerms = titleIdentityTerms(proposal.title);
  return identityMatches(
    proposal.title,
    sentence,
    identityTerms,
    [],
  ).supported;
}

function metadataSentenceFollowsCandidateHeading(
  proposal: Screen02FindProposal,
  sentences: readonly SentenceCoordinate[],
  sentenceIndex: number,
) {
  for (
    let index = sentenceIndex - 1;
    index >= Math.max(0, sentenceIndex - 3);
    index -= 1
  ) {
    const prior = sentences[index];
    if (!prior) return false;
    if (sentenceCarriesCandidateTitleIdentity(proposal, prior.text)) {
      return true;
    }
    if (
      !INTERVENING_SOURCE_METADATA.test(prior.text) ||
      actionTerms(prior.text).length > 0
    ) return false;
  }
  return false;
}

function candidateHeadingGuardsActionSentence(
  proposal: Screen02FindProposal,
  sentences: readonly SentenceCoordinate[],
  sentenceIndex: number,
  expectedIdentifier: string,
) {
  const sentence = sentences[sentenceIndex];
  if (!sentence) return false;
  const firstAction = firstActionCharacter(sentence.text);
  const actionClause = firstAction === null
    ? ""
    : clauseContainingFirstAction(sentence.text, firstAction);
  const guardedAnaphor = compatibleInstrumentAnaphor(
    proposal.title,
    actionClause,
  ) || CANDIDATE_CONTEXT_ANAPHOR.test(actionClause) ||
    guardedDisasterEventReference(proposal, actionClause);
  if (
    firstAction === null ||
    !guardedAnaphor ||
    evidencePolarity(sentence.text) !== "affirmative" ||
    !eventActionCompatible(proposal, actionTerms(sentence.text)) ||
    mentionsCompetingNamedInstrument(proposal, sentence.text, firstAction)
  ) return false;

  const normalizedTitle = normalize(proposal.title);
  for (
    let headingIndex = sentenceIndex - 1;
    headingIndex >= Math.max(0, sentenceIndex - 3);
    headingIndex -= 1
  ) {
    const heading = sentences[headingIndex];
    if (!heading) return false;
    const exactTitle = normalizedTitle.length >= 8 &&
      hasNormalizedTokenSequence(heading.text, normalizedTitle);
    const exactFormalIdentifier = Boolean(expectedIdentifier) &&
      exactFormalIdentifierMention(heading.text, expectedIdentifier);
    if (
      (exactTitle || exactFormalIdentifier) &&
      evidencePolarity(heading.text) === "affirmative"
    ) return true;
    if (
      evidencePolarity(heading.text) !== "affirmative" ||
      mentionsCompetingNamedInstrument(proposal, heading.text) ||
      actionTerms(heading.text).length > 0 ||
      (!INTERVENING_SOURCE_METADATA.test(heading.text) &&
        !CANDIDATE_CONTEXT_METADATA.test(heading.text))
    ) return false;
  }
  return false;
}

function identifierHasExplicitRelationship(context: string) {
  return /\b(?:another|different|earlier|later|prior|previous|related|separate|supersed\w*|amend\w*)\s+(?:framework|instrument|order|proceeding|record|regulation|rule)(?:\s+(?:as|at|by|from|in|of|under))?\s*$/iu.test(
    context,
  ) || /\b(?:amend\w*|supersed\w*)\s*$/iu.test(context);
}

function explicitFormalIdentifierConflict(
  proposal: Screen02FindProposal,
  sentences: readonly SentenceCoordinate[],
) {
  const rawExpectedIdentifier =
    proposal.nativeIdentity?.formalIdentifier?.trim() ?? "";
  const expectedIdentifier = normalize(rawExpectedIdentifier);
  if (!expectedIdentifier) return false;
  const observedIdentifiers: string[] = [];
  for (const sentence of sentences) {
    const labeled = boundedMetadataValues(
      sentence.text,
      EXPLICIT_FORMAL_IDENTIFIER_METADATA,
    ).slice(
      0,
      SCREEN02_SOURCE_GROUNDING_MAX_FORMAL_IDENTIFIERS + 1,
    ).map(formalIdentifierMetadataValue);
    const carriesCandidateIdentity = sentenceCarriesCandidateTitleIdentity(
      proposal,
      sentence.text,
    );
    const carriesExpectedFormalIdentifier = exactFormalIdentifierMention(
      sentence.text,
      rawExpectedIdentifier,
    );
    const inCandidateHeader = carriesCandidateIdentity ||
      metadataSentenceFollowsCandidateHeading(
        proposal,
        sentences,
        sentence.index,
      );
    const inGuardedHeadingAction = candidateHeadingGuardsActionSentence(
      proposal,
      sentences,
      sentence.index,
      rawExpectedIdentifier,
    );
    const identityMentions = carriesCandidateIdentity ||
        carriesExpectedFormalIdentifier || inGuardedHeadingAction
      ? (() => {
          const expected = parseScreen02FormalIdentifier(
            rawExpectedIdentifier,
          );
          if (!expected || expected.family === "opaque") {
            return opaqueFormalIdentifierMentions(
              sentence.text,
              rawExpectedIdentifier,
            ).map((mention) => mention.text);
          }
          const firstAction = firstActionCharacter(sentence.text) ??
            Number.POSITIVE_INFINITY;
          const allMentions = structuredFormalIdentifierMentions(
            sentence.text,
            rawExpectedIdentifier,
          );
          if (allMentions.some((mention) =>
            mention.text === FORMAL_IDENTIFIER_MENTION_OVERFLOW
          )) return [FORMAL_IDENTIFIER_MENTION_OVERFLOW];
          const sameBaseMentions = allMentions.filter((mention) => {
            const parsed = parseScreen02FormalIdentifier(mention.text);
            return parsed?.baseKey === expected.baseKey;
          });
          const normalizedTitle = normalize(proposal.title);
          const unqualifiedOtherMentions = allMentions.filter((mention) => {
            const parsed = parseScreen02FormalIdentifier(mention.text);
            if (!parsed || parsed.baseKey === expected.baseKey) return false;
            if (
              sameBaseMentions.length > 0 &&
              hasNormalizedTokenSequence(normalizedTitle, mention.text)
            ) return false;
            if (mention.start < firstAction) return true;
            const relationshipContext = sentence.text.slice(
              Math.max(firstAction, mention.start - 120),
              mention.start,
            );
            return !identifierHasExplicitRelationship(relationshipContext);
          });
          if (sameBaseMentions.length > 0 || unqualifiedOtherMentions.length > 0) {
            return [...sameBaseMentions, ...unqualifiedOtherMentions]
              .map((mention) => mention.text);
          }
          return [];
        })()
      : [];
    const scopedLabeled = inCandidateHeader ? labeled : [];
    for (const observed of [...scopedLabeled, ...identityMentions]) {
      observedIdentifiers.push(observed);
      if (
        observedIdentifiers.length >
          SCREEN02_SOURCE_GROUNDING_MAX_FORMAL_IDENTIFIERS ||
        observed === FORMAL_IDENTIFIER_MENTION_OVERFLOW
      ) return true;
    }
  }
  if (observedIdentifiers.some((observedIdentifier) => {
    const relation = compareScreen02FormalIdentifiers(
      rawExpectedIdentifier,
      observedIdentifier,
    );
    return relation !== "equivalent" && relation !== "compatible-partial";
  })) return true;
  return observedIdentifiers.some((observedIdentifier, index) =>
    observedIdentifiers.slice(index + 1).some((other) => {
      const relation = compareScreen02FormalIdentifiers(
        observedIdentifier,
        other,
      );
      return relation === "conflict" || relation === "different";
    })
  );
}

function mentionsCompetingNamedInstrument(
  proposal: Screen02FindProposal,
  sentence: string,
  beforeCharacter = Number.POSITIVE_INFINITY,
) {
  const normalizedTitle = normalize(proposal.title);
  const explicitCompetitor = [...sentence.matchAll(EXPLICIT_NAMED_INSTRUMENT)].some((match) => {
    if ((match.index ?? Number.POSITIVE_INFINITY) >= beforeCharacter) {
      return false;
    }
    const namedInstrument = normalize(match[0]).replace(/^the\s+/u, "");
    const matchStart = match.index ?? 0;
    const matchEnd = matchStart + match[0].length;
    const namesExpectedFormalIdentifier = normalizedFormalIdentifiers(proposal)
      .some((identifier) =>
        structuredFormalIdentifierMentions(sentence, identifier).some(
          (mention) => mention.start <= matchStart && mention.end >= matchEnd,
        )
      );
    return namedInstrument.length >= 8 &&
      !namesExpectedFormalIdentifier &&
      !normalizedTitle.includes(namedInstrument) &&
      !namedInstrument.includes(normalizedTitle);
  });
  if (explicitCompetitor) return true;

  const expectedTerms = titleIdentityTerms(proposal.title);
  if (expectedTerms.length < 3) return false;
  const expected = new Set(expectedTerms);
  const requiredOverlap = Math.min(
    3,
    Math.max(2, Math.ceil(expectedTerms.length * 0.6)),
  );
  return [...sentence.matchAll(BOUNDED_NAMED_INSTRUMENT)].some((match) => {
    const matchEnd = (match.index ?? 0) + match[0].length;
    if (matchEnd > beforeCharacter) return false;
    const observedTerms = titleIdentityTerms(match[0]);
    const overlap = observedTerms.filter((term) => expected.has(term));
    const missing = expectedTerms.filter((term) => !observedTerms.includes(term));
    const divergent = observedTerms.filter((term) => !expected.has(term));
    return overlap.length >= requiredOverlap && missing.length > 0 &&
      divergent.length > 0;
  });
}

function identityMatches(
  title: string,
  sentence: string,
  identityTerms: readonly string[],
  formalIdentifiers: readonly string[],
) {
  const normalizedSentence = normalize(sentence);
  const sentenceTokens = new Set(normalizedSentence.split(" ").map(tokenStem));
  const matchedIdentityTerms = identityTerms.filter((term) =>
    sentenceTokens.has(term)
  );
  const matchedFormalIdentifiers = formalIdentifiers.filter((identifier) =>
    exactFormalIdentifierMention(sentence, identifier)
  );
  const normalizedTitle = normalize(title);
  const exactTitle = normalizedTitle.length >= 8 &&
    hasNormalizedTokenSequence(normalizedSentence, normalizedTitle);
  const minimumIdentityTerms = Math.min(
    3,
    Math.max(2, Math.ceil(identityTerms.length * 0.6)),
  );
  return {
    matchedIdentityTerms,
    matchedFormalIdentifiers,
    exactTitle,
    supported: exactTitle || matchedFormalIdentifiers.length > 0 ||
      (identityTerms.length >= 2 &&
        matchedIdentityTerms.length >= minimumIdentityTerms),
  };
}

function candidateBoundContextSentence(
  proposal: Screen02FindProposal,
  sentence: SentenceCoordinate,
  identityTerms: readonly string[],
  formalIdentifiers: readonly string[],
) {
  if (
    evidencePolarity(sentence.text) !== "affirmative" ||
    mentionsCompetingNamedInstrument(proposal, sentence.text)
  ) return false;
  // These explicit same-record labels/context phrases are metadata rather
  // than event actions. Accept them as bounded context before action-token
  // scanning so nouns such as "record" or "declaration" cannot prevent the
  // following substantive same-instrument sentence from being reached.
  if (
    INTERVENING_SOURCE_METADATA.test(sentence.text) ||
    CANDIDATE_CONTEXT_METADATA.test(sentence.text)
  ) return true;
  const identity = identityMatches(
    proposal.title,
    sentence.text,
    identityTerms,
    formalIdentifiers,
  );
  const firstAction = firstActionCharacter(sentence.text);
  if (firstAction !== null) {
    const actionClause = clauseContainingFirstAction(
      sentence.text,
      firstAction,
    );
    const boundIdentity = identityMatches(
      proposal.title,
      actionClause,
      identityTerms,
      formalIdentifiers,
    );
    return boundIdentity.supported ||
      compatibleInstrumentAnaphor(proposal.title, actionClause) ||
      CANDIDATE_CONTEXT_ANAPHOR.test(actionClause) ||
      guardedDisasterEventReference(proposal, actionClause);
  }
  if (identity.supported) return true;
  if (
    INTERVENING_SOURCE_METADATA.test(sentence.text) ||
    CANDIDATE_CONTEXT_METADATA.test(sentence.text)
  ) return true;
  if (
    compatibleInstrumentAnaphor(proposal.title, sentence.text) ||
    CANDIDATE_CONTEXT_ANAPHOR.test(sentence.text)
  ) return true;
  return CANDIDATE_POPULATION_CONTEXT.test(sentence.text) ||
    CANDIDATE_TIMING_CONTEXT.test(sentence.text) ||
    CANDIDATE_MIXED_TIMING_CONTEXT.test(sentence.text);
}

function validatedSentenceWindow(
  sentences: readonly SentenceCoordinate[],
  proposal: Screen02FindProposal,
  identityTerms: readonly string[],
  formalIdentifiers: readonly string[],
  anchorStart: number,
  anchorEnd: number,
  before: number,
  after: number,
) {
  let start = anchorStart;
  for (
    let index = anchorStart - 1;
    index >= Math.max(0, anchorStart - before);
    index -= 1
  ) {
    const candidate = sentences[index];
    if (
      !candidate ||
      !candidateBoundContextSentence(
        proposal,
        candidate,
        identityTerms,
        formalIdentifiers,
      )
    ) break;
    start = index;
  }
  let end = anchorEnd;
  for (
    let index = anchorEnd + 1;
    index <= Math.min(sentences.length - 1, anchorEnd + after);
    index += 1
  ) {
    const candidate = sentences[index];
    if (
      !candidate ||
      !candidateBoundContextSentence(
        proposal,
        candidate,
        identityTerms,
        formalIdentifiers,
      )
    ) break;
    end = index;
  }
  // Prefer dropping optional context to truncating the sentence(s) that carry
  // the actual identity/action binding.
  const spanLength = () =>
    (sentences[end]?.end ?? 0) - (sentences[start]?.start ?? 0);
  while (
    spanLength() > SCREEN02_SOURCE_GROUNDING_MAX_COORDINATE_TEXT_CHARS &&
    start < anchorStart
  ) start += 1;
  while (
    spanLength() > SCREEN02_SOURCE_GROUNDING_MAX_COORDINATE_TEXT_CHARS &&
    end > anchorEnd
  ) end -= 1;
  return spanLength() <= SCREEN02_SOURCE_GROUNDING_MAX_COORDINATE_TEXT_CHARS
    ? sentences.slice(start, end + 1)
    : [];
}

/**
 * Locates candidate-bound evidence in deterministic sentence windows. A
 * source is usable only when one sentence independently contains strong
 * identity evidence plus a compatible affirmative event action, or an exact
 * title/formal-ID heading reaches a guarded same-event action. Adjacent
 * sentences are retained only as bounded candidate context and can never
 * supply the missing identity/action pair for a different event.
 */
function computeScreen02ProposalSourceGrounding(
  proposal: Screen02FindProposal,
  source: Screen02Source,
): Screen02ProposalSourceGrounding {
  const evidence = source.evidenceText ?? "";
  if (!evidence.trim() || source.authorityTier >= 6) {
    return {
      version: SCREEN02_SOURCE_GROUNDING_VERSION,
      supported: false,
      evidenceText: "",
      coordinates: [],
      reason: evidence
        ? "Contextual discovery metadata cannot establish candidate facts."
        : "The source contains no retained evidence passage.",
    };
  }
  const sentences = sentenceCoordinates(evidence);
  if (
    explicitIssuerMetadataConflict(proposal, sentences) ||
    explicitFormalIdentifierConflict(proposal, sentences)
  ) {
    return {
      version: SCREEN02_SOURCE_GROUNDING_VERSION,
      supported: false,
      evidenceText: "",
      coordinates: [],
      reason:
        "Explicit source identity metadata conflicts with the candidate issuer or formal identifier.",
    };
  }
  const identityTerms = titleIdentityTerms(proposal.title);
  const formalIdentifiers = normalizedFormalIdentifiers(proposal);
  const expectedDates = dateTerms(proposal, source);
  const acceptedDirect = sentences.flatMap((sentence) => {
    const identity = identityMatches(
      proposal.title,
      sentence.text,
      identityTerms,
      formalIdentifiers,
    );
    const matchedActionTerms = actionTerms(sentence.text);
    const polarity = evidencePolarity(sentence.text);
    const firstAction = firstActionCharacter(sentence.text);
    const actionClause = firstAction === null
      ? ""
      : clauseContainingFirstAction(sentence.text, firstAction);
    const actionClauseIdentity = identityMatches(
      proposal.title,
      actionClause,
      identityTerms,
      formalIdentifiers,
    );
    const actionClauseBound = actionClauseIdentity.supported ||
      compatibleInstrumentAnaphor(proposal.title, actionClause) ||
      CANDIDATE_CONTEXT_ANAPHOR.test(actionClause) ||
      guardedDisasterEventReference(proposal, actionClause);
    if (
      !identity.supported ||
      polarity !== "affirmative" ||
      !eventActionCompatible(proposal, matchedActionTerms) ||
      firstAction === null ||
      !actionClauseBound ||
      mentionsCompetingNamedInstrument(proposal, sentence.text, firstAction)
    ) return [];
    const selected = validatedSentenceWindow(
      sentences,
      proposal,
      identityTerms,
      formalIdentifiers,
      sentence.index,
      sentence.index,
      0,
      3,
    );
    if (selected.length === 0) return [];
    const first = selected[0] ?? sentence;
    const last = selected.at(-1) ?? sentence;
    const text = evidence.slice(first.start, last.end);
    return [{
      sourceId: source.id,
      sentenceStart: first.index,
      sentenceEnd: last.index,
      characterStart: first.start,
      characterEnd: last.end,
      text,
      matchedIdentityTerms: identity.matchedIdentityTerms,
      matchedFormalIdentifiers: identity.matchedFormalIdentifiers,
      matchedActionTerms,
      matchedDateTerms: matchedDateTerms(text, expectedDates),
      polarity,
    } satisfies Screen02SourceEvidenceCoordinate];
  });
  const normalizedTitle = normalize(proposal.title);
  const acceptedHeadingBridges = sentences.flatMap((heading) => {
    const headingText = normalize(heading.text);
    const formalMatches = formalIdentifiers.filter((identifier) =>
      exactFormalIdentifierMention(heading.text, identifier)
    );
    const exactTitle = normalizedTitle.length >= 8 &&
      hasNormalizedTokenSequence(headingText, normalizedTitle);
    if (
      (!exactTitle && formalMatches.length === 0) ||
      evidencePolarity(heading.text) !== "affirmative"
    ) return [];
    const candidates = sentences.slice(
      heading.index + 1,
      Math.min(sentences.length, heading.index + 4),
    );
    const actionSentence = candidates.find((candidate) => {
      const matchedActions = actionTerms(candidate.text);
      const firstAction = firstActionCharacter(candidate.text);
      const actionClause = firstAction === null
        ? ""
        : clauseContainingFirstAction(candidate.text, firstAction);
      const boundIdentity = identityMatches(
        proposal.title,
        actionClause,
        identityTerms,
        formalIdentifiers,
      );
      const interveningIdentityOrMetadata = sentences.slice(
        heading.index + 1,
        candidate.index,
      ).every((item) => {
        const interveningIdentity = identityMatches(
          proposal.title,
          item.text,
          identityTerms,
          formalIdentifiers,
        );
        return evidencePolarity(item.text) === "affirmative" &&
          !mentionsCompetingNamedInstrument(proposal, item.text) &&
          actionTerms(item.text).length === 0 &&
          (interveningIdentity.supported ||
            INTERVENING_SOURCE_METADATA.test(item.text) ||
            CANDIDATE_CONTEXT_METADATA.test(item.text));
      });
      const guardedHeadingAnaphor = interveningIdentityOrMetadata &&
        (compatibleInstrumentAnaphor(proposal.title, actionClause) ||
          CANDIDATE_CONTEXT_ANAPHOR.test(actionClause) ||
          guardedDisasterEventReference(proposal, actionClause));
      return evidencePolarity(candidate.text) === "affirmative" &&
        eventActionCompatible(proposal, matchedActions) &&
        firstAction !== null &&
        !mentionsCompetingNamedInstrument(
          proposal,
          candidate.text,
          firstAction,
        ) &&
        (boundIdentity.supported || guardedHeadingAnaphor);
    });
    if (!actionSentence) return [];
    const selected = validatedSentenceWindow(
      sentences,
      proposal,
      identityTerms,
      formalIdentifiers,
      heading.index,
      actionSentence.index,
      0,
      2,
    );
    if (selected.length === 0) return [];
    const first = selected[0] ?? heading;
    const last = selected.at(-1) ?? actionSentence;
    const text = evidence.slice(first.start, last.end);
    const actionIdentity = identityMatches(
      proposal.title,
      actionSentence.text,
      identityTerms,
      formalIdentifiers,
    );
    return [{
      sourceId: source.id,
      sentenceStart: first.index,
      sentenceEnd: last.index,
      characterStart: first.start,
      characterEnd: last.end,
      text,
      matchedIdentityTerms: actionIdentity.matchedIdentityTerms,
      matchedFormalIdentifiers: unique([
        ...formalMatches,
        ...actionIdentity.matchedFormalIdentifiers,
      ]),
      matchedActionTerms: actionTerms(actionSentence.text),
      matchedDateTerms: matchedDateTerms(text, expectedDates),
      polarity: "affirmative",
    } satisfies Screen02SourceEvidenceCoordinate];
  });
  const accepted = [...acceptedDirect, ...acceptedHeadingBridges];

  const byWindow = new Map<string, Screen02SourceEvidenceCoordinate>();
  for (const coordinate of accepted) {
    const key = `${coordinate.sentenceStart}:${coordinate.sentenceEnd}`;
    const prior = byWindow.get(key);
    if (!prior) {
      byWindow.set(key, coordinate);
      continue;
    }
    prior.matchedIdentityTerms = unique([
      ...prior.matchedIdentityTerms,
      ...coordinate.matchedIdentityTerms,
    ]);
    prior.matchedFormalIdentifiers = unique([
      ...prior.matchedFormalIdentifiers,
      ...coordinate.matchedFormalIdentifiers,
    ]);
    prior.matchedActionTerms = unique([
      ...prior.matchedActionTerms,
      ...coordinate.matchedActionTerms,
    ]);
    prior.matchedDateTerms = unique([
      ...prior.matchedDateTerms,
      ...coordinate.matchedDateTerms,
    ]);
  }
  // Multiple heading anchors can produce the same substantive window with a
  // one-sentence offset (for example, a title followed by a formal-ID line).
  // Collapse a fully contained window before enforcing the two-coordinate
  // cap so it cannot crowd out a distinct, later population-bearing window.
  const nonRedundantCoordinates: Screen02SourceEvidenceCoordinate[] = [];
  for (const coordinate of [...byWindow.values()].sort((left, right) =>
    left.sentenceStart - right.sentenceStart ||
    right.sentenceEnd - left.sentenceEnd
  )) {
    const containing = nonRedundantCoordinates.find((retained) =>
      retained.sentenceStart <= coordinate.sentenceStart &&
      retained.sentenceEnd >= coordinate.sentenceEnd
    );
    if (!containing) {
      nonRedundantCoordinates.push(coordinate);
      continue;
    }
    containing.matchedIdentityTerms = unique([
      ...containing.matchedIdentityTerms,
      ...coordinate.matchedIdentityTerms,
    ]);
    containing.matchedFormalIdentifiers = unique([
      ...containing.matchedFormalIdentifiers,
      ...coordinate.matchedFormalIdentifiers,
    ]);
    containing.matchedActionTerms = unique([
      ...containing.matchedActionTerms,
      ...coordinate.matchedActionTerms,
    ]);
    containing.matchedDateTerms = unique([
      ...containing.matchedDateTerms,
      ...coordinate.matchedDateTerms,
    ]);
  }
  const coordinateScore = (coordinate: Screen02SourceEvidenceCoordinate) =>
    coordinate.matchedFormalIdentifiers.length * 100 +
    coordinate.matchedDateTerms.length * 20 +
    coordinate.matchedActionTerms.length * 10 +
    coordinate.matchedIdentityTerms.length * 3 +
    (coordinate.matchedActionTerms.some((term) =>
        [
          "establish", "impos", "mandat", "prohibit", "requir", "restrict",
          "revis", "set",
        ].includes(term)
      )
      ? 120
      : 0);
  const coordinates = nonRedundantCoordinates.sort((left, right) =>
    coordinateScore(right) - coordinateScore(left) ||
    left.sentenceStart - right.sentenceStart ||
    left.sentenceEnd - right.sentenceEnd
  ).slice(0, SCREEN02_SOURCE_GROUNDING_MAX_COORDINATES_PER_SOURCE)
    .map((coordinate) => ({
      ...coordinate,
      matchedIdentityTerms: boundedTerms(
        coordinate.matchedIdentityTerms,
        SCREEN02_SOURCE_GROUNDING_MAX_IDENTITY_TERMS,
      ),
      matchedFormalIdentifiers: boundedTerms(
        coordinate.matchedFormalIdentifiers,
        SCREEN02_SOURCE_GROUNDING_MAX_FORMAL_IDENTIFIERS,
      ),
      matchedActionTerms: boundedTerms(
        coordinate.matchedActionTerms,
        SCREEN02_SOURCE_GROUNDING_MAX_ACTION_TERMS,
      ),
      matchedDateTerms: boundedTerms(
        coordinate.matchedDateTerms,
        SCREEN02_SOURCE_GROUNDING_MAX_DATE_TERMS,
      ),
    })).sort((left, right) =>
      left.sentenceStart - right.sentenceStart ||
      left.sentenceEnd - right.sentenceEnd
    );
  const coordinateTexts = coordinates.map((coordinate) => coordinate.text)
    .filter((text, index, values) => values.indexOf(text) === index);
  return {
    version: SCREEN02_SOURCE_GROUNDING_VERSION,
    supported: coordinates.length > 0,
    evidenceText: coordinateTexts.join("\n"),
    coordinates,
    reason: coordinates.length > 0
      ? "A retained bounded sentence window binds strong event identity to a compatible affirmative action."
      : "No retained sentence or guarded heading bridge binds strong event identity to a compatible affirmative action.",
  };
}

/**
 * Reuses this pure, regex-heavy derivation only while every field inspected by
 * the grounder remains byte-for-byte unchanged. Weak object keys bound cache
 * lifetime to the proposal/source objects and prevent cross-request growth.
 */
export function groundScreen02ProposalSource(
  proposal: Screen02FindProposal,
  source: Screen02Source,
): Screen02ProposalSourceGrounding {
  const bySource = screen02SourceGroundingCache.get(proposal);
  const cached = bySource?.get(source);
  if (
    cached &&
    cachedScreen02SourceGroundingMatches(cached, proposal, source)
  ) return cached.result;

  const result = immutableScreen02SourceGrounding(
    computeScreen02ProposalSourceGrounding(proposal, source),
  );
  const nextBySource = bySource ??
    new WeakMap<Screen02Source, Screen02SourceGroundingCacheEntry>();
  if (!bySource) screen02SourceGroundingCache.set(proposal, nextBySource);
  nextBySource.set(source, {
    title: proposal.title,
    eventFamily: proposal.event.eventFamily,
    eventDate: proposal.event.eventDate,
    formalIdentifier: proposal.nativeIdentity?.formalIdentifier ?? null,
    issuer: proposal.nativeIdentity?.issuer ?? null,
    provisionalDates: [...proposal.provisionalDates],
    sourceId: source.id,
    sourceEvidenceText: source.evidenceText ?? "",
    sourcePublishedDate: source.publishedDate ?? null,
    sourceAuthorityTier: source.authorityTier,
    result,
  });
  return result;
}

export function screen02SourceSupportsProposalIdentity(
  proposal: Screen02FindProposal,
  source: Screen02Source,
) {
  return groundScreen02ProposalSource(proposal, source).supported;
}
