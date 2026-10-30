import { serializeDeterministicJson } from "./screen02-deterministic-json";
import type { Screen02CandidateQualification } from "./screen02-qualification-codec";
import type { Screen02WorkflowHandoff } from "./screen02-workflow-handoff";
import type {
  Screen02AuditDossier,
  Screen02AuditPossibleMatch,
  Screen02AuditRelatedVersion,
  Screen02AuditState,
  Screen02DateLead,
  Screen02EventIdentity,
  Screen02FindCandidateSnapshot,
  Screen02FindState,
  Screen02ProvisionalClaim,
  Screen02WorkflowSource,
  Screen02WorkflowState,
} from "./screen02-workflow-types";

export const SCREEN_02_SHOCK_GLANCE_SCHEMA_VERSION =
  "screen-02-shock-glance-v1" as const;
export const SCREEN_02_SHOCK_GLANCE_MAX_ENTRIES = 80;

export const screen02ShockGlanceOrigins = [
  "chatgpt-host",
  "fixed-source-derived",
] as const;

export type Screen02ShockGlanceOrigin =
  (typeof screen02ShockGlanceOrigins)[number];

/**
 * Compact, preliminary orientation authored on Screen 2. The candidate fields
 * bind Find candidates and Audit match snapshots through the same stable
 * contract; selectedEventId is the candidate/identity snapshot carried by the
 * unchanged Screen 2 -> Screen 3 event-v4 handoff.
 */
export type Screen02ShockGlance = {
  schemaVersion: typeof SCREEN_02_SHOCK_GLANCE_SCHEMA_VERSION;
  runId: string;
  candidateSnapshotId: string;
  candidateFingerprint: string;
  selectedEventId: string;
  eventFingerprint: string;
  origin: Screen02ShockGlanceOrigin;
  summary: string;
  keyPoints: string[];
  whoIsAffected: string;
  keyTiming: string;
  importantCaveat: string;
  sourceIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type Screen02ShockGlanceEvent = {
  identitySnapshotId: string;
  identity: Screen02EventIdentity;
  description: Screen02ProvisionalClaim;
  dateLeads: Screen02DateLead[];
  broadCoverage: Screen02ProvisionalClaim[];
  highLevelChanges: Screen02ProvisionalClaim[];
  keyComponents: Screen02ProvisionalClaim[];
  relatedVersions: Screen02AuditRelatedVersion[];
  sourceIds: string[];
  limitations: string[];
  settlement: "preliminary-screen-02";
  preliminaryQualification?: Screen02CandidateQualification;
};

const glanceKeys = [
  "schemaVersion",
  "runId",
  "candidateSnapshotId",
  "candidateFingerprint",
  "selectedEventId",
  "eventFingerprint",
  "origin",
  "summary",
  "keyPoints",
  "whoIsAffected",
  "keyTiming",
  "importantCaveat",
  "sourceIds",
  "createdAt",
  "updatedAt",
] as const;

const fingerprintPattern = /^fnv1a64:[0-9a-f]{16}$/;
const sentenceEndingPattern = /[.!?]["')\]]?$/u;
const controlCharacterPattern = /[\u0000-\u001f\u007f]/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
  serializeDeterministicJson(value);
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

function fingerprintValue(value: unknown) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of new TextEncoder().encode(serializeDeterministicJson(value))) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

export function fingerprintScreen02ShockGlanceEvent(
  event: Screen02ShockGlanceEvent,
) {
  return fingerprintValue(event);
}

function wordCount(value: string) {
  return value.split(/\s+/u).filter(Boolean).length;
}

function validBoundedSentence(
  value: unknown,
  maximumCharacters: number,
  maximumWords: number,
) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value === value.trim() &&
    value.length <= maximumCharacters &&
    wordCount(value) <= maximumWords &&
    !controlCharacterPattern.test(value) &&
    sentenceEndingPattern.test(value)
  );
}

function validTimestamp(value: unknown) {
  if (typeof value !== "string" || value.trim() !== value) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

export function restoreScreen02ShockGlance(
  value: unknown,
): Screen02ShockGlance | null {
  if (!isRecord(value)) return null;
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = [...glanceKeys].sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    return null;
  }
  if (
    value.schemaVersion !== SCREEN_02_SHOCK_GLANCE_SCHEMA_VERSION ||
    !screen02ShockGlanceOrigins.includes(
      value.origin as Screen02ShockGlanceOrigin,
    )
  ) {
    return null;
  }
  for (const key of [
    "runId",
    "candidateSnapshotId",
    "selectedEventId",
  ] as const) {
    if (
      typeof value[key] !== "string" ||
      value[key].length < 1 ||
      value[key].length > 200 ||
      value[key] !== value[key].trim() ||
      controlCharacterPattern.test(value[key] as string)
    ) {
      return null;
    }
  }
  if (
    typeof value.candidateFingerprint !== "string" ||
    !fingerprintPattern.test(value.candidateFingerprint) ||
    typeof value.eventFingerprint !== "string" ||
    !fingerprintPattern.test(value.eventFingerprint) ||
    !validBoundedSentence(value.summary, 800, 100) ||
    !validBoundedSentence(value.whoIsAffected, 500, 75) ||
    !validBoundedSentence(value.keyTiming, 500, 75) ||
    !validBoundedSentence(value.importantCaveat, 450, 60) ||
    !validTimestamp(value.createdAt) ||
    !validTimestamp(value.updatedAt) ||
    Date.parse(value.updatedAt as string) < Date.parse(value.createdAt as string)
  ) {
    return null;
  }
  if (
    !Array.isArray(value.keyPoints) ||
    value.keyPoints.length < 3 ||
    value.keyPoints.length > 5 ||
    value.keyPoints.some(
      (point) => !validBoundedSentence(point, 300, 36),
    ) ||
    new Set(value.keyPoints).size !== value.keyPoints.length
  ) {
    return null;
  }
  if (
    !Array.isArray(value.sourceIds) ||
    value.sourceIds.length < 1 ||
    value.sourceIds.length > 4 ||
    value.sourceIds.some(
      (sourceId) =>
        typeof sourceId !== "string" ||
        sourceId.length < 1 ||
        sourceId.length > 200 ||
        sourceId !== sourceId.trim() ||
        controlCharacterPattern.test(sourceId),
    ) ||
    new Set(value.sourceIds).size !== value.sourceIds.length
  ) {
    return null;
  }
  const displayedWords = wordCount(value.summary as string) +
    (value.keyPoints as string[]).reduce(
      (total, point) => total + wordCount(point),
      0,
    ) +
    wordCount(value.whoIsAffected as string) +
    wordCount(value.keyTiming as string) +
    wordCount(value.importantCaveat as string);
  if (displayedWords > 280) return null;
  return deepFreeze(clone(value) as Screen02ShockGlance);
}

export function requireScreen02ShockGlance(
  value: unknown,
): Screen02ShockGlance {
  const restored = restoreScreen02ShockGlance(value);
  if (!restored) throw new Error("Screen 2 shock glance is invalid.");
  return restored;
}

/**
 * Replaces one candidate/match orientation without disturbing other retained
 * research. The stable array position makes state fingerprints deterministic.
 */
export function upsertScreen02ShockGlance(
  glances: readonly Screen02ShockGlance[] | undefined,
  glance: Screen02ShockGlance,
  maximum = SCREEN_02_SHOCK_GLANCE_MAX_ENTRIES,
) {
  if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > 500) {
    throw new Error("Screen 2 shock glance capacity is invalid.");
  }
  const safeGlance = requireScreen02ShockGlance(glance);
  const safeExisting = (glances ?? []).map(requireScreen02ShockGlance);
  if (
    safeExisting.some((entry) => entry.runId !== safeGlance.runId) ||
    new Set(safeExisting.map((entry) => entry.candidateSnapshotId)).size !==
      safeExisting.length
  ) {
    throw new Error("Screen 2 shock glance collection has foreign or duplicate entries.");
  }
  const index = safeExisting.findIndex(
    (entry) =>
      entry.candidateSnapshotId === safeGlance.candidateSnapshotId,
  );
  const result = safeExisting.map(clone);
  if (index >= 0) result[index] = clone(safeGlance);
  else result.push(clone(safeGlance));
  if (result.length > maximum) {
    throw new Error("Screen 2 shock glance collection exceeds its capacity.");
  }
  return deepFreeze(result);
}

function normalizedText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

const glanceReaderOperationalPattern = /\b(?:screen\s*[23]|source[- ](?:backed|derived)|event lead|candidate snapshot|event fingerprint|handoff|formal identifier|event status|possible exposure indicators?|provisional timing leads?|study[- ]relevant event clock|orientation is preliminary|fixed software|event card|does not establish exogeneity|causal mechanism|realized effects?|retained record|registry record|bounded record set|detailed evidence review|exposure reconstruction|treatment clocks?|effective clock|requires? verification|coverage remains provisional|defined by the study|any study must)\b/iu;

function completeSentence(value: string) {
  const normalized = normalizedText(value).replace(/[,:;\-–—]+$/u, "");
  if (!normalized) return "";
  return sentenceEndingPattern.test(normalized) ? normalized : `${normalized}.`;
}

function glanceSentenceUnits(value: string) {
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

function boundedSentence(
  value: string,
  maximumWords = 36,
  maximumCharacters = 300,
) {
  const normalized = completeSentence(value);
  if (
    normalized.length <= maximumCharacters &&
    wordCount(normalized) <= maximumWords
  ) {
    return normalized;
  }
  const sentences = normalized.match(/[^.!?]+[.!?]["')\]]?/gu) ?? [];
  let retained = "";
  for (const sentence of sentences) {
    const next = `${retained} ${sentence.trim()}`.trim();
    if (next.length > maximumCharacters || wordCount(next) > maximumWords) {
      break;
    }
    retained = next;
  }
  if (retained) return retained;
  const words = normalized.replace(/[.!?]["')\]]?$/u, "").split(/\s+/u);
  let result = "";
  for (const word of words) {
    const next = `${result} ${word}`.trim();
    if (next.length + 1 > maximumCharacters || wordCount(next) > maximumWords) {
      break;
    }
    result = next;
  }
  return completeSentence(result || "This detail remains preliminary");
}

function uniqueSentences(values: readonly string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const sentence = boundedSentence(value);
    const key = sentence.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/gu, " ");
    if (!sentence || seen.has(key)) continue;
    seen.add(key);
    result.push(sentence);
  }
  return result;
}

function substantiveGlanceSentence(
  value: string,
  maximumWords = 36,
  maximumCharacters = 300,
) {
  const sentence = completeSentence(value);
  if (
    glanceReaderOperationalPattern.test(sentence) ||
    wordCount(sentence) > maximumWords ||
    sentence.length > maximumCharacters ||
    /^['’]s\b/iu.test(sentence) ||
    /\b(?:and|or|the|to|a|an|of|for|with|that|which|by)[.!?]["')\]]?$/iu.test(
      sentence,
    )
  ) {
    return null;
  }
  return sentence;
}

function substantiveGlanceSentences(
  value: string,
  maximumWords = 36,
  maximumCharacters = 300,
) {
  return glanceSentenceUnits(value)
    .map((sentence) =>
      substantiveGlanceSentence(
        sentence,
        maximumWords,
        maximumCharacters,
      )
    )
    .filter((sentence): sentence is string => sentence !== null);
}

function naturalDescriptionSummary(
  identity: Screen02EventIdentity,
  description: Screen02ProvisionalClaim,
  coverage: readonly Screen02ProvisionalClaim[],
) {
  const descriptionSentences = substantiveGlanceSentences(
    description.text,
    80,
    800,
  );
  let summary = "";
  for (const sentence of descriptionSentences) {
    const next = `${summary} ${sentence}`.trim();
    if (wordCount(next) > 80 || next.length > 800) break;
    summary = next;
  }
  if (summary) return summary;
  const kind = normalizedText(identity.eventType).toLocaleLowerCase("en-US");
  const article = /^[aeiou]/iu.test(kind) ? "an" : "a";
  const subject = identity.commonNames[0]
    ? normalizedText(identity.commonNames[0])
    : "It";
  const identitySentence = kind
    ? `${subject} is ${article} ${kind}.`
    : "It is an event.";
  const coverageSentence = coverage.length > 0
    ? substantiveGlanceSentences(coverage[0]!.text, 40, 500)[0] ?? null
    : null;
  return boundedSentence(
    [identitySentence, coverageSentence].filter(Boolean).join(" "),
    80,
    800,
  );
}

function joinedList(values: readonly string[]) {
  if (values.length === 1) return values[0]!;
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

/**
 * Some source-backed descriptions coordinate a general right with a bounded
 * list of duties. Split only that grammatically explicit construction; no
 * right, duty, actor, or effect is added beyond the retained sentence.
 */
function coordinatedDescriptionPoints(description: string) {
  const sentence = completeSentence(description);
  const match = /^(.+?)\s+and\s+(?:places?|imposes?)\s+(.+?)\s+(obligations?|duties|requirements?|restrictions?)\s+on\s+(.+?)[.!?]["')\]]?$/iu.exec(
    sentence,
  );
  if (!match) return [];
  const [, firstClause, rawItems, noun, affected] = match;
  const items = rawItems
    .replace(/,?\s+and\s+/giu, ", ")
    .split(/\s*,\s*/u)
    .map(normalizedText)
    .filter(Boolean);
  if (
    items.length < 3 ||
    items.length > 6 ||
    items.some((item) => wordCount(item) > 5)
  ) {
    return [];
  }
  const splitAt = Math.ceil(items.length / 2);
  const pointFor = (group: readonly string[]) => {
    const list = joinedList(group);
    const capitalized = `${list.charAt(0).toLocaleUpperCase("en-US")}${list.slice(1)}`;
    return `${capitalized} ${noun.toLocaleLowerCase("en-US")} apply to ${normalizedText(affected)}.`;
  };
  return [
    completeSentence(firstClause),
    pointFor(items.slice(0, splitAt)),
    pointFor(items.slice(splitAt)),
  ];
}

function sourceIdsForEvent(
  event: Screen02ShockGlanceEvent,
  sources: readonly Screen02WorkflowSource[],
) {
  const retained = new Set(event.sourceIds);
  return [...sources]
    .filter((source) => retained.has(source.id))
    .sort(
      (left, right) =>
        left.authorityTier - right.authorityTier ||
        left.id.localeCompare(right.id),
    )
    .map((source) => source.id)
    .filter((id, index, all) => all.indexOf(id) === index)
    .slice(0, 4);
}

function chronologicalDateLeads(dateLeads: readonly Screen02DateLead[]) {
  return [...dateLeads].sort((left, right) => {
    const leftTime = Date.parse(left.date);
    const rightTime = Date.parse(right.date);
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
      return leftTime - rightTime || left.id.localeCompare(right.id);
    }
    if (Number.isFinite(leftTime)) return -1;
    if (Number.isFinite(rightTime)) return 1;
    return left.date.localeCompare(right.date) || left.id.localeCompare(right.id);
  });
}

function timingSentence(dateLeads: readonly Screen02DateLead[]) {
  const dated = chronologicalDateLeads(dateLeads).slice(0, 3);
  if (dated.length === 0) {
    return "The retained Screen 2 record does not yet establish a verified event date.";
  }
  const details = dated.map(
    (lead) => `${lead.date} (${normalizedText(lead.label)})`,
  );
  return boundedSentence(
    `Screen 2 retains these provisional timing leads: ${details.join("; ")}. Screen 3 must verify the study-relevant event clock.`,
    75,
    500,
  );
}

function affectedSentence(coverage: readonly Screen02ProvisionalClaim[]) {
  if (coverage.length === 0) {
    return "The retained Screen 2 record does not yet establish exactly which organizations or people are covered.";
  }
  return boundedSentence(
    uniqueSentences(coverage.slice(0, 2).map((claim) => claim.text)).join(" "),
    75,
    500,
  );
}

function relatedVersionSentence(versions: readonly Screen02AuditRelatedVersion[]) {
  if (versions.length === 0) return null;
  const version = versions[0]!;
  const relationship = normalizedText(version.relationship)
    .toLocaleLowerCase("en-US");
  return boundedSentence(
    `${version.identity.canonicalTitle} is a related ${relationship}.`,
  );
}

function caveatSentence(limitations: readonly string[]) {
  const specific = limitations.find(
    (limitation) => wordCount(normalizedText(limitation)) <= 28,
  );
  if (specific) {
    return boundedSentence(
      `${specific} Exact coverage thresholds, exemptions, operative dates, and later amendments require confirmation on Screen 3.`,
      60,
      450,
    );
  }
  return "Exact coverage thresholds, exemptions, operative dates, and later amendments require confirmation on Screen 3.";
}

function assembleContent(input: {
  identity: Screen02EventIdentity;
  description: Screen02ProvisionalClaim;
  changes: readonly Screen02ProvisionalClaim[];
  components: readonly Screen02ProvisionalClaim[];
  coverage: readonly Screen02ProvisionalClaim[];
  dates: readonly Screen02DateLead[];
  relatedVersions: readonly Screen02AuditRelatedVersion[];
  limitations: readonly string[];
  preliminaryQualification?: Screen02CandidateQualification;
}) {
  const qualifiedOverview =
    input.preliminaryQualification?.eligible === true &&
      input.preliminaryQualification.substantiveOverview.passed
      ? input.preliminaryQualification.substantiveOverview
      : null;
  if (qualifiedOverview) {
    const keyPoints = uniqueSentences([
      boundedSentence(qualifiedOverview.whatChanged, 32, 300),
      boundedSentence(qualifiedOverview.whyItMayMatterForStudy, 32, 300),
      boundedSentence(
        `Main uncertainty: ${qualifiedOverview.mainUncertainty}`,
        32,
        300,
      ),
    ]).slice(0, 3);
    while (keyPoints.length < 3) {
      const fallback = [
        "The substantive change is preliminary and remains linked to the retained Screen 2 evidence.",
        "The proposed study pathway is an orientation hypothesis, not an established effect.",
        "The main uncertainty must be resolved against the official evidence on Screen 3.",
      ][keyPoints.length]!;
      if (!keyPoints.includes(fallback)) keyPoints.push(fallback);
    }
    return {
      summary: boundedSentence(
        qualifiedOverview.whatTheShockIs,
        55,
        600,
      ),
      keyPoints,
      whoIsAffected: qualifiedOverview.whoMayBeAffected.trim()
        ? boundedSentence(
            qualifiedOverview.whoMayBeAffected,
            42,
            500,
          )
        : "The retained Screen 2 evidence does not yet establish which organizations or people may be affected.",
      keyTiming: boundedSentence(
        qualifiedOverview.importantTiming,
        42,
        500,
      ),
      importantCaveat: boundedSentence(
        `Main uncertainty: ${qualifiedOverview.mainUncertainty} This overview remains preliminary and noncanonical until Screen 3 verification.`,
        45,
        450,
      ),
    };
  }
  // The event identity, formal identifier, issuer, status, workflow state, and
  // exposure variables remain available in their canonical fields. The
  // reader-facing prose starts with the substantive event description instead
  // of repeating those administrative values.
  const summary = naturalDescriptionSummary(
    input.identity,
    input.description,
    input.coverage,
  );
  const candidatePoints: string[] = [
    ...input.changes.map((claim) => claim.text),
    ...input.components.map((claim) => claim.text),
    ...coordinatedDescriptionPoints(input.description.text),
  ];
  if (input.coverage.length > 0) {
    candidatePoints.push(input.coverage[0]!.text);
  }
  const related = relatedVersionSentence(input.relatedVersions);
  if (related) candidatePoints.push(related);
  const keyPoints = uniqueSentences(
    candidatePoints.flatMap((point) => substantiveGlanceSentences(point)),
  ).slice(0, 5);
  // v1 remains a strict 3–5 point archival contract. Older readers and host
  // validators depend on that bound, so genuinely sparse records retain
  // compatibility placeholders internally. The compact Screen 3 projection
  // classifies these as operational and never displays them.
  while (keyPoints.length < 3) {
    const fallback = [
      "The selected identity remains subject to factual verification on Screen 3.",
      "Attached source records support orientation but do not yet settle the Event Card.",
      "Organization-level exposure must be established separately from broad coverage.",
    ][keyPoints.length] ??
      "The preliminary record must be checked before research-design use.";
    if (!keyPoints.includes(fallback)) keyPoints.push(fallback);
  }
  return {
    summary,
    keyPoints,
    whoIsAffected: affectedSentence(input.coverage),
    keyTiming: timingSentence(input.dates),
    importantCaveat: caveatSentence(input.limitations),
  };
}

export function screen02FindGlanceEvent(
  candidate: Screen02FindCandidateSnapshot,
): Screen02ShockGlanceEvent {
  return {
    identitySnapshotId: candidate.candidateSnapshotId,
    identity: clone(candidate.identity),
    description: clone(candidate.description),
    dateLeads: clone(candidate.dateLeads),
    broadCoverage: clone(candidate.broadCoverage),
    highLevelChanges: [],
    keyComponents: [],
    relatedVersions: [],
    sourceIds: [...candidate.sourceIds],
    limitations: [...candidate.limitations],
    settlement: "preliminary-screen-02",
    ...(candidate.qualification
      ? { preliminaryQualification: clone(candidate.qualification) }
      : {}),
  };
}

export function screen02AuditGlanceEvent(
  match: Screen02AuditPossibleMatch,
  dossier: Screen02AuditDossier,
): Screen02ShockGlanceEvent {
  if (!dossier.whatHappened) {
    throw new Error("Audit shock glance requires a what-happened claim.");
  }
  return {
    identitySnapshotId: match.identitySnapshotId,
    identity: clone(match.identity),
    description: clone(dossier.whatHappened),
    dateLeads: clone(dossier.timeline),
    broadCoverage: clone(dossier.broadCoverage),
    highLevelChanges: clone(dossier.whatChanged),
    keyComponents: clone(dossier.keyComponents),
    relatedVersions: clone(dossier.relatedVersions),
    sourceIds: [...new Set([...match.sourceIds, ...dossier.sourceIds])],
    limitations: [...match.limitations, ...dossier.unresolvedFacts],
    settlement: "preliminary-screen-02",
  };
}

function glanceFromEvent(input: {
  runId: string;
  candidateSnapshotId: string;
  candidateFingerprint: string;
  event: Screen02ShockGlanceEvent;
  sources: readonly Screen02WorkflowSource[];
  at: string;
  exposureVariables?: readonly string[];
}): Screen02ShockGlance {
  const sourceIds = sourceIdsForEvent(input.event, input.sources);
  if (sourceIds.length === 0) {
    throw new Error("Screen 2 shock glance needs a retained event source.");
  }
  const content = assembleContent({
    identity: input.event.identity,
    description: input.event.description,
    changes: input.event.highLevelChanges,
    components: input.event.keyComponents,
    coverage: input.event.broadCoverage,
    dates: input.event.dateLeads,
    relatedVersions: input.event.relatedVersions,
    limitations: input.event.limitations,
    preliminaryQualification: input.event.preliminaryQualification,
  });
  return requireScreen02ShockGlance({
    schemaVersion: SCREEN_02_SHOCK_GLANCE_SCHEMA_VERSION,
    runId: input.runId,
    candidateSnapshotId: input.candidateSnapshotId,
    candidateFingerprint: input.candidateFingerprint,
    selectedEventId: input.event.identitySnapshotId,
    eventFingerprint: fingerprintScreen02ShockGlanceEvent(input.event),
    origin: "fixed-source-derived",
    ...content,
    sourceIds,
    createdAt: input.at,
    updatedAt: input.at,
  });
}

export function assembleScreen02FindShockGlance(
  state: Screen02FindState,
  candidateSnapshotId: string,
  at: string,
) {
  const candidate = state.candidates.find(
    (item) => item.candidateSnapshotId === candidateSnapshotId,
  );
  if (!candidate) throw new Error("Find shock glance candidate was not found.");
  return glanceFromEvent({
    runId: state.runId,
    candidateSnapshotId: candidate.candidateSnapshotId,
    candidateFingerprint: candidate.candidateFingerprint,
    event: screen02FindGlanceEvent(candidate),
    sources: state.sources,
    at,
    exposureVariables: candidate.apparentExposureVariables,
  });
}

export function assembleScreen02AuditShockGlance(
  state: Screen02AuditState,
  matchSnapshotId: string,
  at: string,
) {
  const dossierSnapshotId =
    state.confirmedIdentity?.matchSnapshotId === matchSnapshotId
      ? state.confirmedIdentity.dossierSnapshotId
      : null;
  if (!dossierSnapshotId) {
    throw new Error("Audit shock glance requires the confirmed dossier binding.");
  }
  return assembleScreen02AuditShockGlanceForDossier(
    state,
    matchSnapshotId,
    dossierSnapshotId,
    at,
  );
}

export function assembleScreen02AuditShockGlanceForDossier(
  state: Screen02AuditState,
  matchSnapshotId: string,
  dossierSnapshotId: string,
  at: string,
) {
  const match = state.possibleMatches.find(
    (item) => item.matchSnapshotId === matchSnapshotId,
  );
  const dossier = match && state.dossiers.find(
    (item) =>
      item.dossierSnapshotId === dossierSnapshotId &&
      item.identitySnapshotId === match.identitySnapshotId &&
      item.status === "completed",
  );
  if (!match || !dossier) {
    throw new Error("Audit shock glance match or completed dossier was not found.");
  }
  return glanceFromEvent({
    runId: state.runId,
    candidateSnapshotId: match.matchSnapshotId,
    candidateFingerprint: match.matchFingerprint,
    event: screen02AuditGlanceEvent(match, dossier),
    sources: state.sources,
    at,
  });
}

function handoffBinding(handoff: Screen02WorkflowHandoff) {
  return handoff.provenance.mode === "find"
    ? {
        candidateSnapshotId: handoff.provenance.candidateSnapshotId,
        candidateFingerprint: handoff.provenance.candidateFingerprint,
      }
    : {
        candidateSnapshotId: handoff.provenance.matchSnapshotId,
        candidateFingerprint: handoff.provenance.matchFingerprint,
      };
}

export function assembleScreen02ShockGlanceFromHandoff(
  handoff: Screen02WorkflowHandoff,
  at = handoff.builtAt,
) {
  const binding = handoffBinding(handoff);
  return glanceFromEvent({
    runId: handoff.runId,
    ...binding,
    event: clone(handoff.event),
    sources: handoff.sources,
    at,
  });
}

function glanceMatchesHandoff(
  glance: Screen02ShockGlance,
  handoff: Screen02WorkflowHandoff,
) {
  const binding = handoffBinding(handoff);
  const eventSourceIds = new Set(handoff.event.sourceIds);
  return (
    glance.runId === handoff.runId &&
    glance.candidateSnapshotId === binding.candidateSnapshotId &&
    glance.candidateFingerprint === binding.candidateFingerprint &&
    glance.selectedEventId === handoff.event.identitySnapshotId &&
    glance.eventFingerprint === handoff.integrity.eventFingerprint &&
    glance.sourceIds.every((sourceId) => eventSourceIds.has(sourceId))
  );
}

export function resolveScreen02ShockGlance(
  state: Screen02WorkflowState,
  handoff: Screen02WorkflowHandoff,
  at = handoff.builtAt,
): Screen02ShockGlance | null {
  if (
    state.runId !== handoff.runId ||
    fingerprintValue(state) !== handoff.integrity.stateFingerprint
  ) {
    return null;
  }
  const existing = state.shockGlances
    ?.map(restoreScreen02ShockGlance)
    .find(
      (glance): glance is Screen02ShockGlance =>
        Boolean(glance && glanceMatchesHandoff(glance, handoff)),
    );
  return existing ?? assembleScreen02ShockGlanceFromHandoff(handoff, at);
}

export function buildScreen02ShockGlance(
  state: Screen02WorkflowState,
  handoff: Screen02WorkflowHandoff,
  at = handoff.builtAt,
) {
  const glance = resolveScreen02ShockGlance(state, handoff, at);
  if (!glance) {
    throw new Error(
      "Screen 2 shock glance does not belong to the current authenticated parent state.",
    );
  }
  return glance;
}

export function screen02ShockGlanceMatchesFindState(
  glance: Screen02ShockGlance,
  state: Screen02FindState,
) {
  const candidate = state.candidates.find(
    (item) => item.candidateSnapshotId === glance.candidateSnapshotId,
  );
  if (!candidate) return false;
  const allowedSourceIds = new Set(candidate.sourceIds);
  return (
    glance.runId === state.runId &&
    glance.candidateSnapshotId === candidate.candidateSnapshotId &&
    glance.candidateFingerprint === candidate.candidateFingerprint &&
    glance.selectedEventId === candidate.candidateSnapshotId &&
    glance.eventFingerprint ===
      fingerprintScreen02ShockGlanceEvent(screen02FindGlanceEvent(candidate)) &&
    glance.sourceIds.every((sourceId) => allowedSourceIds.has(sourceId))
  );
}

export function screen02ShockGlanceMatchesAuditState(
  glance: Screen02ShockGlance,
  state: Screen02AuditState,
) {
  const match = state.possibleMatches.find(
    (item) => item.matchSnapshotId === glance.candidateSnapshotId,
  );
  if (
    !match ||
    glance.runId !== state.runId ||
    glance.candidateFingerprint !== match.matchFingerprint ||
    glance.selectedEventId !== match.identitySnapshotId
  ) {
    return false;
  }
  return state.dossiers
    .filter(
      (dossier) =>
        dossier.identitySnapshotId === match.identitySnapshotId &&
        dossier.status === "completed",
    )
    .some((dossier) => {
      const event = screen02AuditGlanceEvent(match, dossier);
      const allowedSourceIds = new Set(event.sourceIds);
      return (
        glance.eventFingerprint === fingerprintScreen02ShockGlanceEvent(event) &&
        glance.sourceIds.every((sourceId) => allowedSourceIds.has(sourceId))
      );
    });
}
