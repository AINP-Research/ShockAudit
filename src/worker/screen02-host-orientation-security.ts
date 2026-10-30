import {
  requireScreen02ShockGlance,
  type Screen02ShockGlance,
} from "../core/screen02-shock-glance";
import type {
  Screen02AuditState,
  Screen02FindState,
  Screen02WorkflowSource,
} from "../core/screen02-workflow-types";

export const SCREEN_02_HOST_ORIENTATION_RECEIPT_SCHEMA_VERSION =
  "screen-02-host-orientation-receipt-v1" as const;

export const screen02HostOrientationFieldNames = [
  "summary",
  "keyPoints",
  "whoIsAffected",
  "keyTiming",
  "importantCaveat",
] as const;

export type Screen02HostOrientationBlock = {
  summary: string;
  keyPoints: string[];
  whoIsAffected: string;
  keyTiming: string;
  importantCaveat: string;
};

/**
 * `candidate` means the bounded prose passed transport validation and is
 * authenticated by the surrounding HMAC receipt. It is not source-supported
 * until it is checked against the current canonical state at apply time.
 */
export type Screen02HostOrientationReceipt = {
  schemaVersion: typeof SCREEN_02_HOST_ORIENTATION_RECEIPT_SCHEMA_VERSION;
  status: "absent" | "candidate" | "rejected";
  orientation: Screen02HostOrientationBlock | null;
  codes: string[];
};

export type Screen02HostOrientationSupport = {
  runId: string;
  requestId: string;
  candidateSnapshotId: string;
  candidateFingerprint: string;
  identityTerms: string[];
  supportTexts: string[];
  sensitiveSupportTexts: string[];
  allowedSourceIds: string[];
};

export type Screen02HostOrientationResolution = {
  status: "accepted" | "fixed-fallback";
  glance: Screen02ShockGlance;
  codes: string[];
};

const receiptKeys = [
  "schemaVersion",
  "status",
  "orientation",
  "codes",
] as const;
const controlCharacterPattern = /[\u0000-\u001f\u007f]/u;
const sentenceEndingPattern = /[.!?]["')\]]?$/u;
const unsafeMarkupPattern = /(?:<\/?(?:script|iframe|object|embed)\b|javascript:|data:text\/html)/iu;
const promptOrToolInstructionPattern =
  /\b(?:ignore (?:all |the )?(?:previous|prior|system)|system prompt|developer message|call (?:a |the )?tool|tool call|capability token|receipt token|request proof|packet hash)\b/iu;
const forbiddenInferencePattern =
  /\b(?:p[- ]?value|statistical(?:ly)? significant|effect estimate|realized (?:effect|outcome)|observed (?:effect|outcome)|proves? causality|causal validity|causally valid|as-if random|exogeneity|exogenous(?:ly)?(?: assignment)?|random assignment|established causal mechanism)\b/iu;
const certaintyInflationPattern =
  /\b(?:always|definitely|certainly|conclusively|without (?:any )?(?:exception|qualification)|guarantees?|ensures?|will cause|all (?:firms|businesses|organizations|people|consumers)|every (?:firm|business|organization|person|consumer)|(?:is|are|was|were|has been|have been) (?:fully )?(?:confirmed|verified|proven|established))\b/iu;
const sourceReferencePatterns = [
  /\b(?:source|citation|evidence)(?:\s+id)?\s*[:#]\s*([A-Za-z0-9][A-Za-z0-9._:-]{0,199})\b/giu,
  /\[([A-Za-z][A-Za-z0-9._:-]{2,199})\]/gu,
] as const;
const datePatterns = [
  /\b(?:1[6-9]\d{2}|20\d{2}|21\d{2})(?:-\d{2}(?:-\d{2})?)?\b/gu,
  /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+(?:\d{1,2},\s+)?(?:1[6-9]\d{2}|20\d{2}|21\d{2})\b/giu,
] as const;
const numericFactPattern =
  /(?:[$€£]\s*\d[\d,.]*(?:\s*(?:million|billion|thousand))?|\b\d[\d,.]*\s*(?:%|percent|million|billion|thousand|employees?|consumers?|households?|records?|businesses?)\b)/giu;
const spelledMagnitudePattern =
  /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)(?:[-\s](?:one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety))*\s+(?:percent|million|billion|thousand|employees?|consumers?|households?|records?|businesses?)\b/giu;
const authorityPattern =
  /\b(?:[A-Z][A-Za-z.&'-]*\s+){0,6}(?:Attorney General|Department|Commission|Agency|Authority|Legislature|Parliament|Council|Court|Office|Bureau)\b/giu;
const penaltyTermPattern =
  /\b(?:penalt(?:y|ies)|fines?|statutory damages|civil damages|criminal sanctions?)\b/giu;
const exemptionTermPattern = /\b(?:exemptions?|exceptions?|carve[- ]outs?)\b/giu;
const domainTerms = [
  "privacy",
  "tax",
  "labor",
  "environmental",
  "health",
  "education",
  "criminal",
  "trade",
  "immigration",
  "securities",
] as const;
const oppositions = [
  ["created", "repealed"],
  ["expanded", "eliminated"],
  ["increased", "decreased"],
  ["enacted", "repealed"],
  ["requires", "prohibits"],
  ["required", "prohibited"],
  ["allows", "prohibits"],
] as const;
const stopWords = new Set([
  "about", "after", "again", "against", "also", "among", "because",
  "before", "being", "below", "between", "broadly", "could", "does",
  "during", "each", "from", "have", "helps", "into", "itself", "later",
  "must", "other", "over", "preliminary", "researcher", "screen", "selected",
  "should", "their", "there", "these", "they", "this", "those", "through",
  "under", "until", "using", "verify", "what", "when", "where", "which",
  "while", "with", "would",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length &&
    actual.every((key, index) => key === wanted[index]);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizedText(value: string) {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function comparisonText(value: string) {
  return normalizedText(value)
    .toLocaleLowerCase("en-US")
    .replace(/[’']/gu, "'")
    .replace(/[^a-z0-9%$€£.'-]+/gu, " ")
    .trim();
}

function wordCount(value: string) {
  return normalizedText(value).split(/\s+/u).filter(Boolean).length;
}

function uniqueCodes(codes: readonly string[]) {
  return [...new Set(codes)].slice(0, 20);
}

function validateSentence(
  value: unknown,
  limits: { minimumWords: number; maximumWords: number; maximumCharacters: number },
) {
  if (typeof value !== "string") return { value: null, codes: ["not-text"] };
  // Reject oversized raw input before Unicode normalization or pattern scans.
  // The optional sibling is deliberately transport-permissive so malformed
  // host prose cannot invalidate the assessment, which makes this cheap
  // independent bound important for adversarial submissions.
  if (value.length < 1 || value.length > limits.maximumCharacters) {
    return { value: null, codes: ["length"] };
  }
  const normalized = normalizedText(value);
  const words = wordCount(normalized);
  const codes: string[] = [];
  if (
    normalized.length < 1 ||
    normalized.length > limits.maximumCharacters ||
    words < limits.minimumWords ||
    words > limits.maximumWords
  ) {
    codes.push("length");
  }
  if (
    controlCharacterPattern.test(normalized) ||
    unsafeMarkupPattern.test(normalized)
  ) {
    codes.push("unsafe-markup");
  }
  if (!sentenceEndingPattern.test(normalized)) codes.push("incomplete-sentence");
  if (promptOrToolInstructionPattern.test(normalized)) {
    codes.push("instruction-like-content");
  }
  if (forbiddenInferencePattern.test(normalized)) {
    codes.push("forbidden-causal-or-outcome-claim");
  }
  if (certaintyInflationPattern.test(normalized)) {
    codes.push("certainty-inflation");
  }
  return codes.length > 0
    ? { value: null, codes: uniqueCodes(codes) }
    : { value: normalized, codes };
}

function explicitSourceIds(value: string) {
  const ids: string[] = [];
  for (const pattern of sourceReferencePatterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(value))) {
      if (match[1]) ids.push(match[1]);
    }
  }
  return [...new Set(ids)];
}

export function normalizeScreen02HostOrientationBlock(
  value: unknown,
  allowedSourceIds: readonly string[] = [],
): { orientation: Screen02HostOrientationBlock | null; codes: string[] } {
  if (!isRecord(value) || !exactKeys(value, screen02HostOrientationFieldNames)) {
    return { orientation: null, codes: ["invalid-or-partial-shape"] };
  }
  const summary = validateSentence(value.summary, {
    minimumWords: 12,
    maximumWords: 100,
    maximumCharacters: 800,
  });
  const whoIsAffected = validateSentence(value.whoIsAffected, {
    minimumWords: 5,
    maximumWords: 75,
    maximumCharacters: 500,
  });
  const keyTiming = validateSentence(value.keyTiming, {
    minimumWords: 5,
    maximumWords: 75,
    maximumCharacters: 500,
  });
  const importantCaveat = validateSentence(value.importantCaveat, {
    minimumWords: 5,
    maximumWords: 60,
    maximumCharacters: 450,
  });
  const codes: string[] = [
    ...summary.codes.map((code) => `summary-${code}`),
    ...whoIsAffected.codes.map((code) => `who-is-affected-${code}`),
    ...keyTiming.codes.map((code) => `key-timing-${code}`),
    ...importantCaveat.codes.map((code) => `important-caveat-${code}`),
  ];
  const keyPoints: string[] = [];
  if (
    !Array.isArray(value.keyPoints) ||
    value.keyPoints.length < 3 ||
    value.keyPoints.length > 5
  ) {
    codes.push("key-points-count");
  } else {
    for (const point of value.keyPoints) {
      const parsed = validateSentence(point, {
        minimumWords: 4,
        maximumWords: 36,
        maximumCharacters: 300,
      });
      if (parsed.value) keyPoints.push(parsed.value);
      else codes.push(...parsed.codes.map((code) => `key-point-${code}`));
    }
    const comparisonPoints = keyPoints.map(comparisonText);
    if (new Set(comparisonPoints).size !== comparisonPoints.length) {
      codes.push("duplicate-key-point");
    }
  }
  const texts = [
    summary.value,
    ...keyPoints,
    whoIsAffected.value,
    keyTiming.value,
    importantCaveat.value,
  ].filter((item): item is string => Boolean(item));
  const totalWords = texts.reduce((total, text) => total + wordCount(text), 0);
  if (totalWords < 55 || totalWords > 280) codes.push("total-length");
  const allowed = new Set(allowedSourceIds);
  if (
    texts.flatMap(explicitSourceIds).some((sourceId) => !allowed.has(sourceId))
  ) {
    codes.push("foreign-source-id");
  }
  if (
    codes.length > 0 ||
    !summary.value ||
    !whoIsAffected.value ||
    !keyTiming.value ||
    !importantCaveat.value ||
    keyPoints.length < 3
  ) {
    return { orientation: null, codes: uniqueCodes(codes) };
  }
  return {
    orientation: {
      summary: summary.value,
      keyPoints,
      whoIsAffected: whoIsAffected.value,
      keyTiming: keyTiming.value,
      importantCaveat: importantCaveat.value,
    },
    codes: [],
  };
}

export function prepareScreen02HostOrientationReceipt(
  value: unknown,
  input: {
    mode: string;
    allowedSourceIds: readonly string[];
  },
): Screen02HostOrientationReceipt {
  if (value === undefined) {
    return {
      schemaVersion: SCREEN_02_HOST_ORIENTATION_RECEIPT_SCHEMA_VERSION,
      status: "absent",
      orientation: null,
      codes: [],
    };
  }
  if (
    input.mode !== "find-candidate" &&
    input.mode !== "audit-dossier" &&
    input.mode !== "audit-confirmed-event"
  ) {
    return {
      schemaVersion: SCREEN_02_HOST_ORIENTATION_RECEIPT_SCHEMA_VERSION,
      status: "rejected",
      orientation: null,
      codes: ["unsupported-request-mode"],
    };
  }
  const parsed = normalizeScreen02HostOrientationBlock(
    value,
    input.allowedSourceIds,
  );
  return parsed.orientation
    ? {
        schemaVersion: SCREEN_02_HOST_ORIENTATION_RECEIPT_SCHEMA_VERSION,
        status: "candidate",
        orientation: parsed.orientation,
        codes: [],
      }
    : {
        schemaVersion: SCREEN_02_HOST_ORIENTATION_RECEIPT_SCHEMA_VERSION,
        status: "rejected",
        orientation: null,
        codes: parsed.codes,
      };
}

export function parseScreen02HostOrientationReceipt(
  value: unknown,
  allowedSourceIds: readonly string[] = [],
): Screen02HostOrientationReceipt {
  if (
    !isRecord(value) ||
    !exactKeys(value, receiptKeys) ||
    value.schemaVersion !== SCREEN_02_HOST_ORIENTATION_RECEIPT_SCHEMA_VERSION ||
    (value.status !== "absent" &&
      value.status !== "candidate" &&
      value.status !== "rejected") ||
    !Array.isArray(value.codes) ||
    value.codes.length > 20 ||
    value.codes.some(
      (code) => typeof code !== "string" || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(code),
    ) ||
    new Set(value.codes).size !== value.codes.length
  ) {
    throw new Error("Screen 2 host orientation receipt is malformed.");
  }
  if (value.status === "candidate") {
    const parsed = normalizeScreen02HostOrientationBlock(
      value.orientation,
      allowedSourceIds,
    );
    if (!parsed.orientation || value.codes.length !== 0) {
      throw new Error("Screen 2 host orientation candidate is not normalized.");
    }
    return {
      schemaVersion: SCREEN_02_HOST_ORIENTATION_RECEIPT_SCHEMA_VERSION,
      status: "candidate",
      orientation: parsed.orientation,
      codes: [],
    };
  }
  if (
    value.orientation !== null ||
    (value.status === "absent" && value.codes.length !== 0) ||
    (value.status === "rejected" && value.codes.length === 0)
  ) {
    throw new Error("Screen 2 host orientation disposition is inconsistent.");
  }
  return {
    schemaVersion: SCREEN_02_HOST_ORIENTATION_RECEIPT_SCHEMA_VERSION,
    status: value.status,
    orientation: null,
    codes: [...value.codes] as string[],
  };
}

function pushSupportText(target: string[], value: unknown, key = "", depth = 0) {
  if (depth > 8 || target.length >= 300) return;
  if (typeof value === "string") {
    if (
      value.length > 0 &&
      value.length <= 4_000 &&
      !/(?:fingerprint|locator|retrievedAt|recordedAt|snapshotId|runId)$/u.test(key)
    ) {
      target.push(normalizedText(value));
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const child of value) pushSupportText(target, child, key, depth + 1);
    return;
  }
  if (!isRecord(value)) return;
  for (const [childKey, child] of Object.entries(value)) {
    pushSupportText(target, child, childKey, depth + 1);
  }
}

function supportTexts(values: readonly unknown[]) {
  const texts: string[] = [];
  for (const value of values) pushSupportText(texts, value);
  return [...new Set(texts)].slice(0, 300);
}

function retainedSources(
  sources: readonly Screen02WorkflowSource[],
  allowedSourceIds: ReadonlySet<string>,
) {
  return sources
    .filter((source) => allowedSourceIds.has(source.id))
    .map((source) => ({
      title: source.title,
      publisher: source.publisher,
      publishedDate: source.publishedDate,
      evidenceText: source.evidenceText ?? null,
    }));
}

function identityTerms(identity: {
  canonicalTitle: string;
  commonNames: string[];
  formalIdentifier: string | null;
}) {
  return [
    identity.canonicalTitle,
    ...identity.commonNames,
    ...(identity.formalIdentifier ? [identity.formalIdentifier] : []),
  ].map(normalizedText).filter(Boolean);
}

export function buildScreen02FindHostOrientationSupport(
  state: Screen02FindState,
  binding: {
    runId: string;
    requestId: string;
    candidateSnapshotId: string;
    candidateFingerprint: string;
  },
): Screen02HostOrientationSupport | null {
  const request = state.assessmentRequests.find(
    (item) => item.requestId === binding.requestId,
  );
  const candidate = state.candidates.find(
    (item) => item.candidateSnapshotId === binding.candidateSnapshotId,
  );
  const activeSet = state.candidateSets.find(
    (item) =>
      item.candidateSetSnapshotId === state.activeCandidateSetSnapshotId &&
      item.status === "active",
  );
  if (
    state.runId !== binding.runId ||
    request?.target.mode !== "find-candidate" ||
    request.target.candidateSnapshotId !== binding.candidateSnapshotId ||
    request.target.candidateFingerprint !== binding.candidateFingerprint ||
    !candidate ||
    candidate.candidateFingerprint !== binding.candidateFingerprint ||
    !activeSet?.candidateSnapshotIds.includes(candidate.candidateSnapshotId)
  ) {
    return null;
  }
  const allowedSourceIds = new Set(candidate.sourceIds);
  const canonicalSupport = supportTexts([
    candidate.identity,
    candidate.description,
    candidate.dateLeads,
    candidate.broadCoverage,
    candidate.apparentExposureVariables,
    candidate.limitations,
    retainedSources(state.sources, allowedSourceIds),
  ]);
  return {
    ...binding,
    identityTerms: identityTerms(candidate.identity),
    supportTexts: canonicalSupport,
    sensitiveSupportTexts: canonicalSupport,
    allowedSourceIds: [...allowedSourceIds],
  };
}

export function buildScreen02AuditHostOrientationSupport(
  state: Screen02AuditState,
  binding: {
    runId: string;
    requestId: string;
    candidateSnapshotId: string;
    candidateFingerprint: string;
    dossierSnapshotId?: string | null;
  },
): Screen02HostOrientationSupport | null {
  const request = state.assessmentRequests.find(
    (item) => item.requestId === binding.requestId,
  );
  const match = state.possibleMatches.find(
    (item) => item.matchSnapshotId === binding.candidateSnapshotId,
  );
  if (
    state.runId !== binding.runId ||
    (request?.target.mode !== "audit-dossier" &&
      request?.target.mode !== "audit-confirmed-event") ||
    request.target.matchSnapshotId !== binding.candidateSnapshotId ||
    request.target.matchFingerprint !== binding.candidateFingerprint ||
    !match ||
    match.matchFingerprint !== binding.candidateFingerprint
  ) {
    return null;
  }
  if (
    (request.target.mode === "audit-dossier" &&
      binding.dossierSnapshotId != null) ||
    (request.target.mode === "audit-confirmed-event" &&
      binding.dossierSnapshotId !== request.target.dossierSnapshotId)
  ) {
    return null;
  }
  const dossier = binding.dossierSnapshotId
    ? state.dossiers.find(
        (item) => item.dossierSnapshotId === binding.dossierSnapshotId,
      )
    : state.dossiers.find(
        (item) =>
          item.identitySnapshotId === match.identitySnapshotId &&
          item.requestId === binding.requestId,
      );
  if (
    (binding.dossierSnapshotId && !dossier) ||
    (dossier && dossier.identitySnapshotId !== match.identitySnapshotId)
  ) return null;
  const allowedSourceIds = new Set([
    ...match.sourceIds,
    ...(dossier?.sourceIds ?? []),
  ]);
  const retainedSourceSupport = supportTexts([
    match.identity,
    match.relationship,
    match.relationshipReason,
    match.limitations,
    retainedSources(state.sources, allowedSourceIds),
  ]);
  return {
    runId: binding.runId,
    requestId: binding.requestId,
    candidateSnapshotId: binding.candidateSnapshotId,
    candidateFingerprint: binding.candidateFingerprint,
    identityTerms: identityTerms(match.identity),
    supportTexts: supportTexts([
      match.identity,
      match.relationship,
      match.relationshipReason,
      match.limitations,
      dossier ?? null,
      retainedSources(state.sources, allowedSourceIds),
    ]),
    // Dossier prose is preliminary model output. It may provide ordinary
    // explanatory overlap, but it cannot self-authorize a date, threshold,
    // penalty, exemption, or named authority repeated in the sibling
    // orientation. Sensitive facts need the retained match/source record.
    sensitiveSupportTexts: retainedSourceSupport,
    allowedSourceIds: [...allowedSourceIds],
  };
}

function patternMatches(value: string, patterns: readonly RegExp[]) {
  const matches: string[] = [];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(value))) matches.push(match[0]);
  }
  return matches;
}

function meaningfulTokens(value: string) {
  return comparisonText(value)
    .split(/\s+/u)
    .map((token) => token.replace(/(?:ed|ing|es|s)$/u, ""))
    .filter((token) => token.length >= 4 && !stopWords.has(token));
}

function hasSupportOverlap(value: string, corpusTokens: ReadonlySet<string>) {
  const tokens = [...new Set(meaningfulTokens(value))];
  if (tokens.length === 0) return false;
  const supported = tokens.filter((token) => corpusTokens.has(token)).length;
  return supported >= Math.min(2, tokens.length) && supported / tokens.length >= 0.15;
}

function regexEscape(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function sensitiveFactIsExplicitlyUncertain(value: string, fact: string) {
  const factText = comparisonText(fact);
  if (!factText) return false;
  const clauses = normalizedText(value).split(
    /(?:[;.!?]|\b(?:but|however|although|whereas|while)\b)/giu,
  );
  const factPattern = regexEscape(factText);
  for (const clause of clauses) {
    const text = comparisonText(clause);
    if (!text.includes(factText)) continue;

    // An uncertainty phrase elsewhere in the clause must not launder a
    // positive unsupported assertion such as "an exemption applies, and exact
    // coverage requires review."
    const assertedAfter = new RegExp(
      `\\b${factPattern}\\b(?:\\s+[a-z0-9'-]+){0,5}\\s+\\b(?:applies?|exists?|covers?|excludes?|provides?|sets?|imposes?)\\b`,
      "iu",
    );
    const assertedBefore = new RegExp(
      `\\b(?:imposes?|carries?|faces?|incurs?|qualif(?:y|ies|ied)|subject to)\\b(?:\\s+[a-z0-9'-]+){0,7}\\s+\\b${factPattern}\\b`,
      "iu",
    );
    if (assertedAfter.test(text) || assertedBefore.test(text)) return false;

    const factIndex = text.indexOf(factText);
    const uncertaintyPattern =
      /\b(?:unknown|unverified|unresolved|uncertain|not (?:yet )?(?:known|verified|confirmed|resolved)|requires? (?:confirmation|verification|review)|needs? (?:confirmation|verification|review)|must be (?:confirmed|verified|reviewed|determined)|remain(?:s)? (?:subject|subjects?) (?:to|for) (?:screen 3 )?(?:confirmation|verification|review))\b/giu;
    let uncertainty: RegExpExecArray | null;
    while ((uncertainty = uncertaintyPattern.exec(text))) {
      if (Math.abs(uncertainty.index - factIndex) <= 140) return true;
    }
  }
  return false;
}

function unsupportedMatchedFacts(value: string, corpus: string) {
  const unsupported: string[] = [];
  const facts = [
    ...patternMatches(value, datePatterns),
    ...patternMatches(value, [numericFactPattern, spelledMagnitudePattern]),
    ...patternMatches(value, [authorityPattern]),
  ];
  for (const fact of facts) {
    if (!corpus.includes(comparisonText(fact))) unsupported.push(fact);
  }
  for (const pattern of [penaltyTermPattern, exemptionTermPattern]) {
    for (const fact of patternMatches(value, [pattern])) {
      if (
        !corpus.includes(comparisonText(fact)) &&
        !sensitiveFactIsExplicitlyUncertain(value, fact)
      ) {
        unsupported.push(fact);
      }
    }
  }
  return unsupported;
}

function contradictsSupport(value: string, corpus: string) {
  for (const term of domainTerms) {
    if (comparisonText(value).includes(term) && !corpus.includes(term)) {
      return true;
    }
  }
  for (const [left, right] of oppositions) {
    const textHasLeft = comparisonText(value).includes(left);
    const textHasRight = comparisonText(value).includes(right);
    const corpusHasLeft = corpus.includes(left);
    const corpusHasRight = corpus.includes(right);
    if (
      (textHasLeft && corpusHasRight && !corpusHasLeft) ||
      (textHasRight && corpusHasLeft && !corpusHasRight)
    ) {
      return true;
    }
  }
  const negatedClauses = value.match(
    /\b(?:does not|did not|doesn't|didn't|never|no longer)\s+([^.!?]{4,120})/giu,
  ) ?? [];
  for (const clause of negatedClauses) {
    if (/\b(?:establish|prove|verify|confirm|show|mean|determine)\b/iu.test(clause)) {
      continue;
    }
    const supportedTokens = meaningfulTokens(
      clause.replace(/^(?:does not|did not|doesn't|didn't|never|no longer)\s+/iu, ""),
    ).filter((token) => corpus.includes(token));
    if (new Set(supportedTokens).size >= 2) return true;
  }
  return false;
}

export function validateScreen02HostOrientationSupport(
  orientation: Screen02HostOrientationBlock,
  support: Screen02HostOrientationSupport,
) {
  const parsed = normalizeScreen02HostOrientationBlock(
    orientation,
    support.allowedSourceIds,
  );
  if (!parsed.orientation) {
    return { orientation: null, codes: parsed.codes };
  }
  const corpus = comparisonText(support.supportTexts.join(" \n "));
  const sensitiveCorpus = comparisonText(
    support.sensitiveSupportTexts.join(" \n "),
  );
  const corpusTokens = new Set(meaningfulTokens(corpus));
  const codes: string[] = [];
  const allText = [
    parsed.orientation.summary,
    ...parsed.orientation.keyPoints,
    parsed.orientation.whoIsAffected,
    parsed.orientation.keyTiming,
    parsed.orientation.importantCaveat,
  ].join(" ");
  if (
    !support.identityTerms.some((term) =>
      comparisonText(parsed.orientation!.summary).includes(comparisonText(term))
    )
  ) {
    codes.push("identity-not-bound");
  }
  for (const text of [
    parsed.orientation.summary,
    ...parsed.orientation.keyPoints,
    parsed.orientation.whoIsAffected,
    parsed.orientation.keyTiming,
  ]) {
    if (!hasSupportOverlap(text, corpusTokens)) {
      codes.push("insufficient-source-support");
      break;
    }
  }
  if (
    [
      parsed.orientation.summary,
      ...parsed.orientation.keyPoints,
      parsed.orientation.whoIsAffected,
      parsed.orientation.keyTiming,
      parsed.orientation.importantCaveat,
    ].some((text) => unsupportedMatchedFacts(text, sensitiveCorpus).length > 0)
  ) {
    codes.push("unsupported-sensitive-fact");
  }
  if (contradictsSupport(allText, corpus)) codes.push("contradicts-retained-record");
  const allowedSources = new Set(support.allowedSourceIds);
  if (explicitSourceIds(allText).some((sourceId) => !allowedSources.has(sourceId))) {
    codes.push("foreign-source-id");
  }
  return codes.length > 0
    ? { orientation: null, codes: uniqueCodes(codes) }
    : { orientation: parsed.orientation, codes: [] };
}

export function applyScreen02HostOrientationToGlance(
  fixedGlance: Screen02ShockGlance,
  receipt: Screen02HostOrientationReceipt,
  support: Screen02HostOrientationSupport | null,
  at: string,
): Screen02HostOrientationResolution {
  const exactBinding = support &&
    fixedGlance.runId === support.runId &&
    fixedGlance.candidateSnapshotId === support.candidateSnapshotId &&
    fixedGlance.candidateFingerprint === support.candidateFingerprint;
  if (
    receipt.status !== "candidate" ||
    !receipt.orientation ||
    !support ||
    !exactBinding
  ) {
    return {
      status: "fixed-fallback",
      glance: fixedGlance,
      codes: receipt.status === "rejected"
        ? [...receipt.codes]
        : support && exactBinding
          ? []
          : ["stale-or-mismatched-support"],
    };
  }
  const supported = validateScreen02HostOrientationSupport(
    receipt.orientation,
    support,
  );
  if (!supported.orientation) {
    return {
      status: "fixed-fallback",
      glance: fixedGlance,
      codes: supported.codes,
    };
  }
  return {
    status: "accepted",
    glance: requireScreen02ShockGlance({
      ...clone(fixedGlance),
      ...supported.orientation,
      origin: "chatgpt-host",
      updatedAt: at,
    }),
    codes: [],
  };
}
