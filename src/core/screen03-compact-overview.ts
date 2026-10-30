import type { Screen02EventIdentity } from "./screen02-workflow-types";
import type {
  Screen03ReleaseLabel,
  Screen03VerificationState,
} from "./screen03-workflow";

export const screen03CompactOverviewSectionLabels = [
  "What it does",
  "What changed",
  "What it did",
  "Main effects",
  "Key requirements",
] as const;

export type Screen03CompactOverviewSectionLabel =
  (typeof screen03CompactOverviewSectionLabels)[number];

/**
 * A noncanonical reading projection. It deliberately omits provenance,
 * sources, status, timing, coverage boxes, and research-design guidance while
 * leaving every one of those values intact in Screen 3 state.
 */
export type Screen03CompactOverview = {
  title: string;
  summary: string;
  keyPoints: string[];
  sectionLabel: Screen03CompactOverviewSectionLabel;
};

const sentenceEndingPattern = /[.!?]["')\]]?$/u;
const operationalPatterns = [
  /\bscreen\s*[23]\b/iu,
  /\bprovisional timing leads?\b/iu,
  /\bformal identifiers?\b/iu,
  /\bpossible exposure indicators?\b/iu,
  /\bstudy[- ]relevant event clock\b/iu,
  /\b(?:candidate snapshot|event fingerprint|handoff|event card)\b/iu,
  /\b(?:source[- ]derived|source[- ]backed|fixed software)\b/iu,
  /\b(?:the )?orientation is preliminary\b/iu,
  /\bselected (?:regulation|law|statute|event|shock|identity)\b/iu,
  /\bevent status (?:is|as)\b/iu,
  /\b(?:does not|cannot) establish (?:legal coverage,? )?(?:exogeneity|a causal mechanism|causality|realized effects?)\b/iu,
  /\b(?:causal mechanism|realized effects?)\b/iu,
  /\b(?:must verify|requires? confirmation|subject to factual verification)\b/iu,
  /\b(?:attached source records?|retained issuing authority|retained source|research-design validity)\b/iu,
  /\b(?:retained record|detailed evidence review|bounded record set|source-supported)\b/iu,
  /\b(?:organization-level exposure|preliminary record|research-design use)\b/iu,
  /\bonly researcher-reviewed,? directly supported facts replace preliminary wording\b/iu,
  /\bcoverage, timing, and later changes remain qualified until their fields are resolved\b/iu,
  /\b(?:registry record|exposure reconstruction|treatment clocks?|effective clock|requires? verification|coverage remains provisional|defined by the study|any study must)\b/iu,
  /\b(?:event lead|retrieval note|measurement requirement|study-fit warning)\b/iu,
  /\b(?:share this|date published)\b/iu,
  /\b(?:bounded coverage description|organization-level eligibility|later classification task)\b/iu,
  /\b(?:cited record|users? can inspect against)\b/iu,
  /\bmay distinguish it from related events\b/iu,
  /\bsolicit (?:broad )?public participation\b/iu,
  /\bsubmits? proposed regulations? for approval\b/iu,
] as const;

const summaryPartitionPattern = /^(.+?\b(law|act|statute|regulation|rule|directive|program|order|agreement|restriction|standard|measure|reform|policy|initiative|disruption|outage)),?\s+(?:that|which)\s+(.+?)[.!?]["')\]]?$/iu;
const summaryLeadActionPattern = /\b(?:adopted|announced|approved|created|enacted|established|implemented|imposed|introduced|issued|launched)\b/iu;
const summarySubjectPredicatePattern = /^(?:added|amended|changed|created|established|expanded|gave|imposed|introduced|prohibited|provided|required|restricted|updated)\b/iu;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value && typeof value === "object" && !seen.has(value as object)) {
    seen.add(value as object);
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child, seen);
    }
  }
  return value;
}

function normalizedText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function wordCount(value: string) {
  return value.split(/\s+/u).filter(Boolean).length;
}

function comparable(value: string) {
  return normalizedText(value)
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Deterministic sentence splitting without locale/ICU dependencies. A period
 * inside an acronym or before a lowercase continuation is not treated as a
 * boundary; saved v0.3.16 multi-sentence summaries can therefore be filtered
 * sentence by sentence without damaging values such as "U.S.".
 */
function sentences(value: string) {
  const normalized = normalizedText(value);
  const result: string[] = [];
  let start = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    if (character !== "." && character !== "!" && character !== "?") {
      continue;
    }
    if (
      character === "." &&
      index + 1 < normalized.length &&
      /[\p{L}\p{N}]/u.test(normalized[index + 1]!)
    ) {
      continue;
    }
    let end = index + 1;
    while (end < normalized.length && /["')\]]/u.test(normalized[end]!)) {
      end += 1;
    }
    let next = end;
    while (next < normalized.length && /\s/u.test(normalized[next]!)) {
      next += 1;
    }
    if (
      character === "." &&
      next < normalized.length &&
      /\p{Ll}/u.test(normalized[next]!)
    ) {
      continue;
    }
    const sentence = normalized.slice(start, end).trim();
    if (sentence) result.push(sentence);
    start = next;
    index = next - 1;
  }
  const remainder = normalized.slice(start).trim();
  if (remainder) result.push(remainder);
  return result;
}

function hasMetadata(
  sentence: string,
  identity: Screen02EventIdentity,
  exactSourceMetadata: readonly string[],
) {
  const normalized = comparable(sentence);
  const formalIdentifier = identity.formalIdentifier
    ? comparable(identity.formalIdentifier)
    : "";
  if (
    formalIdentifier.length >= 3 &&
    ` ${normalized} `.includes(` ${formalIdentifier} `)
  ) {
    return true;
  }
  const titleValues = [identity.canonicalTitle, ...identity.commonNames]
    .map(comparable)
    .filter(Boolean);
  if (titleValues.includes(normalized)) return true;
  if (
    exactSourceMetadata
      .map(comparable)
      .filter(Boolean)
      .includes(normalized)
  ) {
    return true;
  }
  const status = identity.status ? comparable(identity.status) : "";
  if (!status) return false;
  return normalized === status ||
    normalized.endsWith(` event status is ${status}`) ||
    normalized.endsWith(` event status as ${status}`) ||
    normalized.endsWith(` is ${status}`) ||
    normalized.endsWith(` remains ${status}`);
}

function readerSentence(
  value: string,
  identity: Screen02EventIdentity,
  maximumWords: number,
  exactSourceMetadata: readonly string[] = [],
) {
  const sentence = normalizedText(value);
  if (
    !sentenceEndingPattern.test(sentence) ||
    wordCount(sentence) > maximumWords ||
    wordCount(sentence) < 3 ||
    /https?:\/\//iu.test(sentence) ||
    /\|/u.test(sentence) ||
    /^['’]s\b/iu.test(sentence) ||
    /\b(?:and|or|the|to|a|an|of|for|with|that|which|by)[.!?]["')\]]?$/iu.test(
      sentence,
    ) ||
    operationalPatterns.some((pattern) => pattern.test(sentence)) ||
    hasMetadata(sentence, identity, exactSourceMetadata)
  ) {
    return null;
  }
  return sentence;
}

function readerSentences(
  value: string,
  identity: Screen02EventIdentity,
  maximumWords: number,
  exactSourceMetadata: readonly string[] = [],
) {
  return sentences(value)
    .map((sentence) =>
      readerSentence(
        sentence,
        identity,
        maximumWords,
        exactSourceMetadata,
      )
    )
    .filter((sentence): sentence is string => sentence !== null);
}

function partitionReaderSummary(
  summary: string,
  identity: Screen02EventIdentity,
  exactSourceMetadata: readonly string[],
) {
  const match = summaryPartitionPattern.exec(summary);
  if (
    !match ||
    !summaryLeadActionPattern.test(match[1]!) ||
    !summarySubjectPredicatePattern.test(match[3]!)
  ) {
    return null;
  }
  const lead = readerSentence(
    `${match[1]}.`,
    identity,
    55,
    exactSourceMetadata,
  );
  const point = readerSentence(
    `The ${match[2]!.toLocaleLowerCase("en-US")} ${match[3]}.`,
    identity,
    25,
    exactSourceMetadata,
  );
  if (!lead || !point || duplicate(point, [lead])) return null;
  return { summary: lead, point };
}

function duplicate(candidate: string, retained: readonly string[]) {
  const normalized = comparable(candidate);
  const duplicateStopWords = new Set(["a", "an", "the"]);
  const tokens = new Set(
    normalized
      .split(" ")
      .filter((token) => token && !duplicateStopWords.has(token)),
  );
  return retained.some((value) => {
    const retainedComparable = comparable(value);
    if (
      normalized === retainedComparable ||
      ` ${normalized} `.includes(` ${retainedComparable} `) ||
      ` ${retainedComparable} `.includes(` ${normalized} `)
    ) {
      return true;
    }
    const retainedTokens = new Set(
      retainedComparable
        .split(" ")
        .filter((token) => token && !duplicateStopWords.has(token)),
    );
    const intersection = [...tokens].filter((token) =>
      retainedTokens.has(token)
    ).length;
    const union = new Set([...tokens, ...retainedTokens]).size;
    return union > 0 && intersection / union >= 0.8;
  });
}

function sectionLabel(
  identity: Screen02EventIdentity,
  summary: string,
  keyPoints: readonly string[],
): Screen03CompactOverviewSectionLabel {
  const text = comparable([
    identity.canonicalTitle,
    identity.eventType ?? "",
    summary,
    ...keyPoints,
  ].join(" "));
  if (
    /\b(?:disruption|outage|disaster|earthquake|storm|flood|wildfire|strike|shutdown|cyberattack|pandemic|shortage|interruption)\b/u.test(
      text,
    )
  ) {
    return "Main effects";
  }
  if (
    /\b(?:privacy|data protection|consumer rights?|personal information)\b/u.test(
      text,
    )
  ) {
    return "What it does";
  }
  if (
    /\b(?:financial|securities|governance|reporting|disclosure|accounting|capital|banking)\b/u.test(
      text,
    ) &&
    /\b(?:law|act|regulation|rule|directive|standard|requirement)\b/u.test(text)
  ) {
    return "Key requirements";
  }
  if (/\b(?:law|act|regulation|rule|directive|statute)\b/u.test(text)) {
    return "What changed";
  }
  if (/\b(?:program|initiative|intervention|order|agreement)\b/u.test(text)) {
    return "What it did";
  }
  return "What changed";
}

function releaseIsCurrent(releaseLabel: Screen03ReleaseLabel) {
  const match = /^v0\.3\.(\d+)$/u.exec(releaseLabel);
  return match !== null && Number(match[1]) >= 16;
}

/**
 * Projects the saved orientation and its retained substantive Screen 3 fields
 * into the compact "Understand this shock" view. This pure function performs
 * no request, persistence, or state mutation. Historical v0.3.15-and-earlier
 * states return null so their briefing compatibility path remains available.
 */
export function projectScreen03CompactOverview(
  state: Screen03VerificationState,
): Screen03CompactOverview | null {
  if (!state.orientation || !releaseIsCurrent(state.releaseLabel)) return null;
  const identity = state.eventIdentity;
  const orientation = state.orientation;
  const exactSourceMetadata = state.evidence.flatMap((item) => [
    item.title,
    item.publisher,
  ]);
  const summaryInputs = [
    orientation.current.summary,
    ...(orientation.provenance !== "screen-03-reviewed"
      ? [orientation.initial.summary]
      : []),
  ];
  const summarySentences: string[] = [];
  for (const input of summaryInputs) {
    for (const sentence of readerSentences(
      input,
      identity,
      80,
      exactSourceMetadata,
    )) {
      if (duplicate(sentence, summarySentences)) continue;
      const nextWords = wordCount([...summarySentences, sentence].join(" "));
      if (nextWords > 80) continue;
      summarySentences.push(sentence);
      if (wordCount(summarySentences.join(" ")) >= 35) break;
    }
    if (wordCount(summarySentences.join(" ")) >= 35) break;
  }

  const coverageSentences = readerSentences(
    orientation.current.whoIsAffected,
    identity,
    30,
    exactSourceMetadata,
  );
  const preliminarySummary = summarySentences.join(" ");
  const substantivePointPreview: string[] = [];
  for (const value of orientation.current.keyPoints) {
    for (const sentence of readerSentences(
      value,
      identity,
      25,
      exactSourceMetadata,
    )) {
      if (
        !duplicate(sentence, [
          preliminarySummary,
          ...substantivePointPreview,
        ])
      ) {
        substantivePointPreview.push(sentence);
      }
    }
  }
  if (
    wordCount(preliminarySummary) < 35 &&
    substantivePointPreview.length > 0 &&
    substantivePointPreview.length < 3
  ) {
    const coverage = coverageSentences.find(
      (sentence) => !duplicate(sentence, summarySentences),
    );
    if (
      coverage &&
      wordCount([...summarySentences, coverage].join(" ")) <= 80
    ) {
      summarySentences.push(coverage);
    }
  }

  if (summarySentences.length === 0) {
    const preferredName = identity.commonNames[0] ?? identity.canonicalTitle;
    const eventType = identity.eventType
      ? normalizedText(identity.eventType).toLocaleLowerCase("en-US")
      : "";
    const article = /^[aeiou]/u.test(eventType) ? "an" : "a";
    summarySentences.push(
      eventType
        ? `${preferredName} is ${article} ${eventType}.`
        : "It is an event.",
    );
  }
  let summary = summarySentences.join(" ");

  const keyPoints: string[] = [];
  let amendmentIncluded = false;
  const retainPoint = (candidate: string) => {
    const amendment = /\b(?:amendment|later change|successor)\b/iu.test(
      candidate,
    );
    if (
      wordCount(candidate) > 25 ||
      keyPoints.length >= 5 ||
      (amendment && amendmentIncluded) ||
      duplicate(candidate, [summary, ...keyPoints])
    ) {
      return;
    }
    const visibleWords = wordCount([
      identity.canonicalTitle,
      summary,
      ...keyPoints,
      candidate,
    ].join(" "));
    // Reserve room for the fixed visible labels: "Brief overview",
    // "Understand this shock", and the adaptive section heading.
    if (visibleWords > 190) return;
    keyPoints.push(candidate);
    if (amendment) amendmentIncluded = true;
  };
  for (const input of orientation.current.keyPoints) {
    for (const sentence of readerSentences(
      input,
      identity,
      25,
      exactSourceMetadata,
    )) {
      retainPoint(sentence);
    }
  }
  const additionalCoverage = coverageSentences.find(
    (coverage) => !duplicate(coverage, [summary, ...keyPoints]),
  );
  if (additionalCoverage) retainPoint(additionalCoverage);
  if (keyPoints.length === 0) {
    const partition = partitionReaderSummary(
      summary,
      identity,
      exactSourceMetadata,
    );
    if (partition) {
      summary = partition.summary;
      retainPoint(partition.point);
    }
  }
  return deepFreeze(clone({
    title: identity.canonicalTitle,
    summary,
    keyPoints,
    sectionLabel: sectionLabel(identity, summary, keyPoints),
  }));
}
