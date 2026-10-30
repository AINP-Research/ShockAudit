import {
  SCREEN02_PROPOSAL_CLUSTER_THRESHOLD,
  buildScreen02DiscoveryQuery,
  compareScreen02Proposals,
  deduplicateScreen02Proposals,
  rankScreen02ProposalsBm25,
} from "./screen02-discovery";
import {
  SCREEN02_DISCOVERY_FORMULA_VERSION,
  buildInitialScreen02DiscoveryQuery,
} from "./screen02-discovery-contract";
import {
  SCREEN_02_SCORE_WEIGHTS,
  SCREEN_02_EXTERNALITY_RUBRIC_VERSION,
  SCREEN_02_POPULATION_APPLICABILITY_RUBRIC_VERSION,
  SCREEN_02_OUTCOME_PATHWAY_RUBRIC_VERSION,
  SCREEN_02_PREFERENCE_VERSION,
  SCREEN_02_PRELIMINARY_ASSESSMENT_SCHEMA_VERSION,
  SCREEN_02_RUBRIC_VERSION,
  SCREEN_02_SCORING_FORMULA_VERSION,
  SCREEN_02_SEARCH_PROTOCOL_VERSION,
  SCREEN_02_SESSION_SCHEMA_VERSION,
  SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
  SOURCE_AUTHORITY_TIERS,
  screen02ExternalShockPlausibilityCategories,
  screen02PopulationApplicabilityCategories,
  screen02OutcomePathwayCategories,
  screen02PreliminaryAssessmentJudgments,
  screen02SemanticScopeFields,
  screen02AuditRepresentationTypes,
  screen02HardFilterKeys,
  screen02ScoreComponentKeys,
  type DeepReadonly,
  type Screen02AssessmentResult,
  type Screen02AuditItem,
  type Screen02AuditProposal,
  type Screen02ChannelLog,
  type Screen02ComponentReasons,
  type Screen02ComponentScores,
  type Screen02ComponentDetail,
  type Screen02DeferredQuestion,
  type Screen02EvidenceStatus,
  type Screen02ExternalShockPlausibilityDetail,
  type Screen02PopulationApplicabilityDetail,
  type Screen02OutcomePathwayDetail,
  type Screen02ExclusionLog,
  type Screen02FindItem,
  type Screen02FindProposal,
  type Screen02HardFilterKey,
  type Screen02HardFilterResult,
  type Screen02HardFilterStatus,
  type Screen02Item,
  type Screen02ItemVersion,
  type Screen02InteractionRequestEvent,
  type Screen02ManifestHardFilter,
  type Screen02Proposal,
  type Screen02QueryLog,
  type Screen02RoundStage,
  type Screen02Scorecard,
  type Screen02SearchRequestType,
  type Screen02SearchRound,
  type Screen02SearchCoverage,
  type Screen02SearchManifest,
  type Screen02SearchManifestSupplement,
  type Screen02SemanticDecision,
  type Screen02Session,
  type Screen02LockedChoice,
  type Screen02PendingInteractionRequest,
  type Screen02PreferenceCriterion,
  type Screen02PreferenceRequest,
  type Screen02PreliminaryAssessment,
  type Screen02PreliminaryAssessmentResult,
  type Screen02ScopeRevisionRequest,
  type Screen02Source,
  type Screen02SourceSummary,
  type Screen02StoppingRule,
  type SourceAuthorityTier,
} from "./screen02-types";
import type { Screen01StudyContext } from "./scope-types";
import {
  groundScreen02ProposalSource,
  screen02SourceSupportsProposalIdentity,
} from "./screen02-source-grounding";
import {
  requireReadyScreen01Context,
} from "./study-context";
import {
  fingerprintScreen01StudyContext,
  sameDeterministicJson,
  serializeDeterministicJson,
  serializeScreen01StudyContext,
} from "./screen02-deterministic-json";
import {
  SCREEN_02_MAX_CANONICAL_SESSION_BYTES,
  SCREEN_02_MAX_STATE_PAYLOAD_CHARACTERS,
  Screen02StateCapacityError,
  assertScreen02StateEnvelopeCapacity,
} from "./screen02-state-capacity";

export { SCREEN_02_MAX_CANONICAL_SESSION_BYTES } from "./screen02-state-capacity";
export {
  fingerprintScreen01StudyContext,
  sameDeterministicJson,
  serializeDeterministicJson,
  serializeScreen01StudyContext,
} from "./screen02-deterministic-json";

export const SCREEN_02_MAX_PROPOSALS = 40;
export const SCREEN_02_MAX_SOURCES_PER_PROPOSAL = 50;
export const SCREEN_02_MAX_TOTAL_SOURCES = 500;
export const SCREEN_02_MAX_RESEARCHER_SEARCH_ROUNDS = 8;
export const SCREEN_02_MAX_PRELIMINARY_ASSESSMENT_ROUNDS_PER_ROOT = 3;
// One immutable initial round plus eight researcher searches and a shared
// assessment allowance equivalent to one initial compact pass plus two retries
// per search. Legacy native-retrieval/AI-review pairs remain valid within it.
export const SCREEN_02_MAX_SEARCH_ROUNDS =
  1 +
  SCREEN_02_MAX_RESEARCHER_SEARCH_ROUNDS *
    (1 + SCREEN_02_MAX_PRELIMINARY_ASSESSMENT_ROUNDS_PER_ROOT);
// Preserve the released v0.2.18 preference budget. Assessment-only retries do
// not create new preference criteria and must not inflate this cap.
export const SCREEN_02_MAX_PREFERENCE_CRITERIA = 48;
export const SCREEN_02_MAX_ACTIVE_ITEMS = 24;
// The cumulative ledger must be able to preserve eight distinct native
// result sets (the public tool normally displays five results) plus a bounded
// allowance for host-discovered additions without silently truncating history.
export const SCREEN_02_MAX_CANDIDATE_ITEMS = 80;
export const SCREEN_02_MAX_ITEM_VERSIONS =
  SCREEN_02_MAX_PROPOSALS * SCREEN_02_MAX_SEARCH_ROUNDS * 2;
const MAX_SHORT_TEXT = 500;
const MAX_LONG_TEXT = 2_000;
const MAX_LOCATOR_TEXT = 2_048;
const MAX_LIST_ITEMS = 30;

const auditRepresentationTypeSet = new Set<string>(
  screen02AuditRepresentationTypes,
);
const hardFilterKeySet = new Set<string>(screen02HardFilterKeys);
const scoreComponentKeySet = new Set<string>(screen02ScoreComponentKeys);
const authorityTierSet = new Set<number>([1, 2, 3, 4, 5, 6]);
const preliminaryAssessmentJudgmentSet = new Set<string>(
  screen02PreliminaryAssessmentJudgments,
);

const rubricCategoryScores = {
  externalShockPlausibility: {
    plausible: 100,
    mixed: 55,
    "major-concern": 0,
    unknown: null,
  },
  populationApplicability: {
    "documented-direct": null,
    "documented-conditional": null,
    "plausible-indirect": null,
    unlikely: null,
    unknown: null,
  },
  outcomePathway: {
    "source-anchored-specific": null,
    "conditional-or-indirect": null,
    unclear: null,
    unlikely: null,
  },
  exposureObservability: {
    "directly-observable": 100,
    "observable-with-linkage": 80,
    "proxy-dependent": 55,
    "weakly-observable": 25,
    unavailable: 0,
    unknown: null,
  },
  timeSupport: {
    ample: 100,
    adequate: 80,
    limited: 55,
    weak: 25,
    none: 0,
    unknown: null,
  },
  variation: {
    strong: 100,
    usable: 80,
    uncertain: 55,
    weak: 25,
    none: 0,
    unknown: null,
  },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function fail(message: string): never {
  throw new Error(message);
}

function screen2Fail(message: string): never {
  fail(`Screen 2 ${message}`);
}

function storedFail(message: string): never {
  fail(`Stored ${message}`);
}

function assertRecord(
  value: unknown,
  label: string,
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) fail(`${label} must be an object.`);
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
) {
  const allowedSet = new Set(allowed);
  const extra = Object.keys(value).find((key) => !allowedSet.has(key));
  if (extra) {
    fail(`${label}.${extra} is not a recognized Screen 2 field.`);
  }
}

function fingerprintSerialized(serialized: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const bytes = new TextEncoder().encode(serialized);
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

export function serializeScreen02Session(session: Screen02Session): string {
  return serializeDeterministicJson(session);
}

export function fingerprintScreen02Session(session: Screen02Session): string {
  return fingerprintSerialized(serializeScreen02Session(session));
}

function cloneJson<T>(value: T): T {
  return JSON.parse(serializeDeterministicJson(value)) as T;
}

function cloneJsonPreservingOrder<T>(value: T): T {
  // Validate first so JSON.stringify cannot silently drop unsupported values.
  serializeDeterministicJson(value);
  const exactJson = JSON.stringify(value);
  if (exactJson === undefined) {
    screen2Fail("data must be losslessly JSON serializable.");
  }
  return JSON.parse(exactJson) as T;
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): DeepReadonly<T> {
  if (typeof value !== "object" || value === null || seen.has(value)) {
    return value as DeepReadonly<T>;
  }
  seen.add(value);
  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child, seen);
  }
  return Object.freeze(value) as DeepReadonly<T>;
}

function rankNeutralItem(item: Screen02Item): Screen02Item {
  return {
    ...cloneJson(item),
    rank: 1,
  } as Screen02Item;
}

function itemVersionFingerprint(item: Screen02Item) {
  return fingerprintSerialized(
    serializeDeterministicJson(rankNeutralItem(item)),
  );
}

function appendItemVersions(
  existing: readonly Screen02ItemVersion[],
  items: readonly Screen02Item[],
  revision: number,
) {
  const versions = cloneJson([...existing]);
  const byFingerprint = new Map(
    versions.map((version) => [version.itemFingerprint, version]),
  );
  const versionIds: string[] = [];
  for (const item of items) {
    const normalized = rankNeutralItem(item);
    const itemFingerprint = itemVersionFingerprint(normalized);
    let version = byFingerprint.get(itemFingerprint);
    if (version) {
      if (
        serializeDeterministicJson(version.item) !==
        serializeDeterministicJson(normalized)
      ) {
        fail(
          "A Screen 2 item-version fingerprint collision was detected.",
        );
      }
    } else {
      version = {
        versionId: `item-version-${itemFingerprint.replace(":", "-")}`,
        itemId: normalized.id,
        itemFingerprint,
        recordedAtRevision: revision,
        item: normalized,
      };
      versions.push(version);
      byFingerprint.set(itemFingerprint, version);
    }
    versionIds.push(version.versionId);
  }
  if (versions.length > SCREEN_02_MAX_ITEM_VERSIONS) {
    screen2Fail(`cannot retain more than ${SCREEN_02_MAX_ITEM_VERSIONS} immutable candidate versions.`,
    );
  }
  return { versions, versionIds };
}

function readyBaseline(
  inbound: Screen01StudyContext,
): DeepReadonly<Screen01StudyContext> {
  const revalidated = requireReadyScreen01Context(inbound);
  if (!sameDeterministicJson(revalidated, inbound)) {
    fail(
      "Screen 1 context must exactly equal its canonical revalidated form before entering Screen 2.",
    );
  }
  return deepFreeze(revalidated);
}

function assertString(
  value: unknown,
  label: string,
  maxLength = MAX_SHORT_TEXT,
  allowEmpty = false,
): asserts value is string {
  if (
    typeof value !== "string" ||
    (!allowEmpty && value.trim().length === 0) ||
    value.length > maxLength ||
    /[\0\u2028\u2029]/.test(value)
  ) {
    fail(`${label} is invalid or exceeds its allowed length.`);
  }
}

function assertStringList(
  value: unknown,
  label: string,
  options: {
    allowEmpty?: boolean;
    maxText?: number;
    maxItems?: number;
  } = {},
): asserts value is string[] {
  if (
    !Array.isArray(value) ||
    value.length > (options.maxItems ?? MAX_LIST_ITEMS) ||
    (!options.allowEmpty && value.length === 0)
  ) {
    fail(`${label} must be a bounded list.`);
  }
  value.forEach((entry, index) =>
    assertString(
      entry,
      `${label}[${index}]`,
      options.maxText ?? MAX_SHORT_TEXT,
    ),
  );
}

function assertScore(value: unknown, label: string): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 100
  ) {
    fail(`${label} must be between 0 and 100.`);
  }
}

function roundScore(value: number) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function emptyComponentScores(): Screen02ComponentScores {
  return {
    scopeFit: null,
    sourceAuthority: null,
    exposureObservability: null,
    timeSupport: null,
    variation: null,
  };
}

function emptyComponentReasons(reason: string): Screen02ComponentReasons {
  return {
    scopeFit: reason,
    sourceAuthority: reason,
    exposureObservability: reason,
    timeSupport: reason,
    variation: reason,
  };
}

export function scoreScreen02Feasibility(
  components: Screen02ComponentScores,
  componentReasons: Screen02ComponentReasons,
  suppliedDetails?: Partial<
    Record<keyof Screen02ComponentScores, Screen02ComponentDetail>
  >,
): Screen02Scorecard {
  for (const key of screen02ScoreComponentKeys) {
    const value = components[key];
    if (value !== null) assertScore(value, `${key} score`);
    assertString(
      componentReasons[key],
      `${key} score reason`,
      MAX_LONG_TEXT,
    );
  }

  const knownKeys = screen02ScoreComponentKeys.filter(
    (key) => components[key] !== null,
  );
  const knownWeight = knownKeys.reduce(
    (sum, key) => sum + SCREEN_02_SCORE_WEIGHTS[key],
    0,
  );
  const roundedKnownWeight = Math.round(knownWeight * 100) / 100;
  const knownWeightedTotal = knownKeys.reduce(
    (sum, key) =>
      sum +
      (components[key] as number) * SCREEN_02_SCORE_WEIGHTS[key],
    0,
  );
  const allKnown =
    knownKeys.length === screen02ScoreComponentKeys.length;
  const overall = allKnown ? roundScore(knownWeightedTotal) : null;
  const knownWeightPercent = Math.round(roundedKnownWeight * 100);
  const componentDetails = Object.fromEntries(
    screen02ScoreComponentKeys.map((key) => {
      const supplied = suppliedDetails?.[key];
      if (supplied) return [key, supplied];
      const known = components[key] !== null;
      return [
        key,
        {
          method: "system-computed",
          category: known ? "numeric-rule-result" : "unknown",
          criteria: [
            "Apply the published Screen 2 component rubric.",
            "Keep unsupported evidence as Unknown rather than zero.",
          ],
          evidenceSourceIds: [],
          reason: componentReasons[key],
          confidence: known ? "medium" : "low",
          unresolved: known
            ? []
            : ["The available evidence does not support a component category."],
          rubricVersion: SCREEN_02_RUBRIC_VERSION,
        } satisfies Screen02ComponentDetail,
      ];
    }),
  ) as Screen02Scorecard["componentDetails"];
  const minimum = roundScore(knownWeightedTotal);
  const maximum = roundScore(
    knownWeightedTotal + (1 - roundedKnownWeight) * 100,
  );

  return {
    formulaVersion: SCREEN_02_SCORING_FORMULA_VERSION,
    components: { ...components },
    componentReasons: { ...componentReasons },
    componentDetails,
    overall,
    overallRange: { minimum, maximum },
    reason:
      allKnown
        ? "Overall feasibility uses all five components at their published, versioned weights."
        : knownKeys.length === 0
          ? "Overall feasibility is Unknown. The 0–100 range shows the full uncertainty created by five unsupported components."
          : `No point score is reported because only ${knownKeys.length} of 5 components are supported. The visible ${minimum}–${maximum} range preserves the published weights without silently reweighting known evidence.`,
    coverage: {
      knownComponents: knownKeys.length,
      totalComponents: screen02ScoreComponentKeys.length,
      knownWeight: roundedKnownWeight,
      knownWeightPercent,
    },
  };
}

export const calculateScreen02Scorecard = scoreScreen02Feasibility;

function normalizeLocator(locator: string) {
  const normalized = locator.trim().replace(/#.*$/, "").replace(/\/+$/, "");
  return normalized.toLocaleLowerCase("en-US");
}

function sourceIdentity(source: Screen02Source) {
  const locator = normalizeLocator(source.locator);
  if (locator) return `locator:${locator}`;
  return `fallback:${[
    source.title,
    source.publisher,
    source.publishedDate ?? "",
  ]
    .map((value) => value.trim().toLocaleLowerCase("en-US"))
    .join("|")}`;
}

function normalizeSourceAuthority(source: Screen02Source): Screen02Source {
  if (source.authorityAssessment?.method === "connector-native") {
    return { ...source };
  }
  if (source.authorityAssessment?.method === "unverified") {
    return {
      ...source,
      authorityTier: 6,
      authorityAssessment: {
        method: "unverified",
        reason:
          "The source is retained only as an unverified discovery lead.",
        policyVersion: "screen-02-source-policy-v1",
      },
    };
  }
  let hostname = "";
  try {
    hostname = new URL(source.locator).hostname.toLocaleLowerCase("en-US");
  } catch {
    hostname = "";
  }
  const official =
    hostname.endsWith(".gov") ||
    hostname === "federalregister.gov" ||
    hostname.endsWith(".federalregister.gov") ||
    hostname === "govinfo.gov" ||
    hostname.endsWith(".govinfo.gov") ||
    hostname === "europa.eu" ||
    hostname.endsWith(".europa.eu") ||
    hostname === "legislation.gov.uk" ||
    hostname.endsWith(".legislation.gov.uk");
  if (official) {
    const controlling = /primary|legislation|statute|rule|regulation/i.test(
      source.channel,
    );
    return {
      ...source,
      authorityTier: controlling ? 1 : 2,
      authorityAssessment: {
        method: "system-domain-rule",
        reason: controlling
          ? "The locator is on a recognized official domain and the recorded channel identifies a controlling or primary instrument."
          : "The locator is on a recognized official government or intergovernmental domain.",
        policyVersion: "screen-02-source-policy-v1",
      },
    };
  }
  return {
    ...source,
    authorityAssessment: {
      method:
        source.authorityAssessment?.method === "researcher-confirmed"
          ? "researcher-confirmed"
          : source.authorityTier === 6
            ? "unverified"
            : "ai-rubric",
      reason:
        source.authorityAssessment?.method === "researcher-confirmed"
          ? source.authorityAssessment.reason
          : source.authorityTier === 6
          ? "The source is retained only as an unverified discovery lead."
          : "The supplied tier is an AI rubric classification under the published source policy; Screen 3 must verify the source and its role.",
      policyVersion: "screen-02-source-policy-v1",
    },
  };
}

function assertSource(value: unknown, label: string): asserts value is Screen02Source {
  assertRecord(value, label);
  assertExactKeys(
    value,
    [
      "id",
      "title",
      "locator",
      "publisher",
      "publishedDate",
      "authorityTier",
      "authorityAssessment",
      "channel",
      "retrievedAt",
      "evidenceText",
      "isFictionalDemo",
    ],
    label,
  );
  assertString(value.id, `${label}.id`, 120);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value.id)) {
    fail(`${label}.id contains unsupported characters.`);
  }
  assertString(value.title, `${label}.title`, MAX_LONG_TEXT);
  assertString(value.locator, `${label}.locator`, MAX_LOCATOR_TEXT);
  assertString(value.publisher, `${label}.publisher`, MAX_SHORT_TEXT);
  if (value.publishedDate !== null) {
    assertString(
      value.publishedDate,
      `${label}.publishedDate`,
      MAX_SHORT_TEXT,
    );
  }
  if (
    typeof value.authorityTier !== "number" ||
    !authorityTierSet.has(value.authorityTier)
  ) {
    fail(`${label}.authorityTier must be one of the six tiers.`);
  }
  assertString(value.channel, `${label}.channel`, MAX_SHORT_TEXT);
  if (value.retrievedAt !== undefined) {
    assertString(value.retrievedAt, `${label}.retrievedAt`, MAX_SHORT_TEXT);
  }
  if (value.evidenceText !== undefined) {
    assertString(value.evidenceText, `${label}.evidenceText`, 12_000);
  }
  if (value.authorityAssessment !== undefined) {
    if (!isRecord(value.authorityAssessment)) {
      fail(`${label}.authorityAssessment must be an object.`);
    }
    assertExactKeys(
      value.authorityAssessment,
      ["method", "reason", "policyVersion"],
      `${label}.authorityAssessment`,
    );
    if (
      ![
        "connector-native",
        "system-domain-rule",
        "ai-rubric",
        "researcher-confirmed",
        "unverified",
      ].includes(String(value.authorityAssessment.method))
    ) {
      fail(`${label}.authorityAssessment.method is invalid.`);
    }
    assertString(
      value.authorityAssessment.reason,
      `${label}.authorityAssessment.reason`,
      MAX_LONG_TEXT,
    );
    if (
      value.authorityAssessment.policyVersion !==
      "screen-02-source-policy-v1"
    ) {
      fail(
        `${label}.authorityAssessment.policyVersion is invalid.`,
      );
    }
  }
  if (
    value.isFictionalDemo !== undefined &&
    value.isFictionalDemo !== true
  ) {
    fail(`${label}.isFictionalDemo can only be true or omitted.`);
  }
}

export function deduplicateScreen02Sources(
  sources: readonly Screen02Source[],
): Screen02Source[] {
  if (sources.length > SCREEN_02_MAX_TOTAL_SOURCES) {
    fail("Too many sources were supplied to Screen 2.");
  }
  const sorted = sources.map((source, index) => {
    assertSource(source, `sources[${index}]`);
    return cloneJson(normalizeSourceAuthority(source));
  });
  sorted.sort((a, b) => {
    const identityOrder = sourceIdentity(a).localeCompare(sourceIdentity(b));
    if (identityOrder !== 0) return identityOrder;
    const tierOrder = a.authorityTier - b.authorityTier;
    if (tierOrder !== 0) return tierOrder;
    return serializeDeterministicJson(a).localeCompare(
      serializeDeterministicJson(b),
    );
  });

  const unique = new Map<string, Screen02Source>();
  for (const source of sorted) {
    const identity = sourceIdentity(source);
    if (!unique.has(identity)) unique.set(identity, source);
  }
  const retained = [...unique.values()];
  const retainedIds = new Set<string>();
  for (const source of retained) {
    if (retainedIds.has(source.id)) {
      fail(
        `Duplicate Screen 2 source id refers to different records: ${source.id}.`,
      );
    }
    retainedIds.add(source.id);
  }
  return retained.sort((a, b) => a.id.localeCompare(b.id));
}

export function summarizeScreen02Sources(
  sources: readonly Screen02Source[],
): Screen02SourceSummary {
  const unique = deduplicateScreen02Sources(sources);
  const byAuthorityTier: Record<SourceAuthorityTier, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
  };
  for (const source of unique) byAuthorityTier[source.authorityTier] += 1;
  const strongestAuthorityTier =
    unique.length === 0
      ? null
      : (Math.min(
          ...unique.map((source) => source.authorityTier),
        ) as SourceAuthorityTier);
  const authorityScore =
    unique.length === 0
      ? null
      : roundScore(
          unique.reduce(
            (sum, source) =>
              sum + SOURCE_AUTHORITY_TIERS[source.authorityTier].score,
            0,
          ) / unique.length,
        );
  return {
    uniqueSourceCount: unique.length,
    byAuthorityTier,
    strongestAuthorityTier,
    authorityScore,
  };
}

function normalizeBoundaryText(value: string) {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase("en-US")
    .replace(/\bu\.?\s*s\.?\b/g, "united states")
    .replace(/\busa\b/g, "united states")
    .replace(/\bu\.?\s*k\.?\b/g, "united kingdom")
    .replace(/\bbritish\b/g, "united kingdom")
    .replace(/\be\.?\s*u\.?\b/g, "european union")
    .replace(/中华人民共和国|中国/gu, " china ")
    .replace(/ประเทศไทย|ไทย/gu, " thailand ")
    .replace(/\bchinese\b/g, "china")
    .replace(/\bthai\b/g, "thailand")
    .replace(/\bregulatory\b|\bregulations\b/g, "regulation")
    .replace(/\bfirms\b/g, "firm")
    .replace(/&/g, " and ")
    // Preserve letters and numbers from every script. Stripping non-Latin
    // scope text made a confirmed Chinese (or other non-Latin) boundary empty,
    // which incorrectly downgraded a wrong-country candidate to "review".
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function controlledShockAliases(knownShock: string) {
  const aliases = new Set<string>();
  const normalized = normalizeBoundaryText(knownShock);
  if (normalized) aliases.add(normalized);
  for (const parenthetical of knownShock.matchAll(/\(([^)]+)\)/g)) {
    const alias = normalizeBoundaryText(parenthetical[1] ?? "");
    if (alias.length >= 2) aliases.add(alias);
  }
  const stopWords = new Set([
    "a",
    "an",
    "and",
    "for",
    "in",
    "of",
    "on",
    "or",
    "the",
    "to",
  ]);
  const acronym = normalized
    .split(" ")
    .filter((word) => word && !stopWords.has(word))
    .map((word) => word[0])
    .join("");
  if (acronym.length >= 2) aliases.add(acronym);
  return [...aliases];
}

function textAnchorsKnownShock(text: string, knownShock: string) {
  const normalized = normalizeBoundaryText(text);
  if (!normalized) return false;
  const padded = ` ${normalized} `;
  return controlledShockAliases(knownShock).some(
    (alias) =>
      normalized === alias ||
      padded.includes(` ${alias} `),
  );
}

function normalizePopulationBoundaryText(value: string) {
  return normalizeBoundaryText(value)
    .replace(
      /\b(?:companies|company|businesses|business|issuers|issuer|corporations|corporation)\b/g,
      "firm",
    )
    .replace(/\b(?:in|of|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type PopulationOwnership = "public" | "private" | "conflict" | "";

function populationOwnership(value: string): PopulationOwnership {
  const normalized = normalizePopulationBoundaryText(value);
  const publicContext =
    /\bpublic (?:relations?|policy|affairs|sector|benefits?|data|records?|scrutiny|debate|opinion|markets?)\b/;
  const privateContext =
    /\bprivate (?:equity|credit|capital|data|records?|markets?)\b/;
  const publicFirm =
    !publicContext.test(normalized) &&
    (/\bpublic(?:ly)?(?: (?:traded|listed|held|owned))?(?: [a-z0-9.-]+){0,3} (?:firm|banks?|depository institutions?|utilit(?:y|ies)|manufacturers?|producers?|providers?|publishers?|establishments?|facilities|controllers?|processors?|organizations?|enterprises?)\b/.test(
      normalized,
    ) ||
      /\b(?:firm|banks?|depository institutions?|utilit(?:y|ies)|manufacturers?|producers?|providers?|publishers?|establishments?|facilities|controllers?|processors?|organizations?|enterprises?)(?: [a-z0-9.-]+){0,3} publicly (?:traded|listed|held|owned)\b/.test(
        normalized,
      ));
  const privateFirm =
    !privateContext.test(normalized) &&
    (/\bprivate(?:ly)?(?: (?:held|owned))?(?: [a-z0-9.-]+){0,3} (?:firm|banks?|depository institutions?|utilit(?:y|ies)|manufacturers?|producers?|providers?|publishers?|establishments?|facilities|controllers?|processors?|organizations?|enterprises?)\b/.test(
      normalized,
    ) ||
      /\b(?:firm|banks?|depository institutions?|utilit(?:y|ies)|manufacturers?|producers?|providers?|publishers?|establishments?|facilities|controllers?|processors?|organizations?|enterprises?)(?: [a-z0-9.-]+){0,3} privately (?:held|owned)\b/.test(
        normalized,
      ));
  if (publicFirm && privateFirm) return "conflict";
  if (publicFirm) return "public";
  if (privateFirm) return "private";
  return "";
}

function hasNegatedBoundaryQualifier(
  value: string,
  requiredTokens: ReadonlySet<string>,
  normalize: (value: string) => string,
) {
  const normalized = normalize(value);
  const containsRequiredBoundary = [...requiredTokens].every((token) =>
    normalized.split(" ").includes(token)
  );
  if (
    containsRequiredBoundary &&
    (
      /\b(?:did|do|does) not (?:apply to|cover|govern|include|regulate)\b/u
        .test(normalized) ||
      /\b(?:are|is|was|were) not (?:applicable|covered|eligible|governed|included|regulated|subject)\b/u
        .test(normalized) ||
      /\b(?:no|none of)\b(?: [a-z0-9.-]+){0,24} (?:are|is|was|were) (?:applicable|covered|eligible|governed|included|regulated|subject)\b/u
        .test(normalized)
    )
  ) {
    return true;
  }
  return [...requiredTokens].some((token) => {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(
      `\\b(?:non\\s*|not\\s+|outside\\s+|excluding\\s+|exclude\\s+|except(?:\\s+for)?\\s+|without\\s+)${escaped}\\b`,
    ).test(normalized);
  });
}

function boundaryMatchStatus(
  required: string,
  candidates: readonly string[],
  population = false,
): Screen02HardFilterStatus {
  const normalize = population
    ? normalizePopulationBoundaryText
    : normalizeBoundaryText;
  const normalizedRequired = normalize(required);
  if (!normalizedRequired) return "review";
  const requiredTokens = new Set(normalizedRequired.split(" "));
  const requiredOwnership = population ? populationOwnership(required) : "";
  let partialOverlap = false;
  let explicitConflict = false;
  for (const candidate of candidates) {
    const normalizedCandidate = normalize(candidate);
    if (!normalizedCandidate) continue;
    const candidateTokens = new Set(normalizedCandidate.split(" "));
    const candidateOwnership = population
      ? populationOwnership(candidate)
      : "";
    const ownershipConflict =
      requiredOwnership === "conflict" ||
      candidateOwnership === "conflict" ||
      (Boolean(requiredOwnership) &&
        Boolean(candidateOwnership) &&
        candidateOwnership !== requiredOwnership);
    const ownershipUnresolved =
      Boolean(requiredOwnership) && !candidateOwnership;
    const negatedQualifier = hasNegatedBoundaryQualifier(
      candidate,
      requiredTokens,
      normalize,
    );
    if (ownershipConflict || negatedQualifier) {
      explicitConflict = true;
      continue;
    }
    if (
      !ownershipUnresolved &&
      normalizedCandidate === normalizedRequired
    ) {
      return "pass";
    }
    if ([...requiredTokens].every((token) => candidateTokens.has(token))) {
      if (!ownershipUnresolved) return "pass";
    }
    if ([...requiredTokens].some((token) => candidateTokens.has(token))) {
      partialOverlap = true;
    }
  }
  if (explicitConflict) return "fail";
  // Population vocabulary is open-ended. Zero lexical overlap (for example,
  // "power companies" versus "publicly listed electric utilities") is an
  // evidence gap, not proof that the groups are mutually exclusive. Only an
  // ownership conflict or explicit negation above is a demonstrated failure.
  if (population) return "review";
  return partialOverlap ? "review" : "fail";
}

function boundaryReason(
  label: string,
  status: Screen02HardFilterStatus,
  required: string,
) {
  if (status === "pass") {
    return `Candidate ${label} preserves the confirmed boundary and its qualifiers: ${required}.`;
  }
  if (status === "review") {
    return `Candidate ${label} overlaps the confirmed boundary but does not preserve every qualifier; review against: ${required}.`;
  }
  return `Candidate ${label} does not match the confirmed boundary: ${required}.`;
}

function isGlobalGeographyBoundary(value: string) {
  return new Set([
    "global",
    "world",
    "worldwide",
    "international",
    "all countries",
  ]).has(normalizeBoundaryText(value));
}

function yearFromDate(value: string): number | null {
  const match = value.match(/^(19|20)\d{2}(?:-\d{2}(?:-\d{2})?)?$/);
  if (!match) return null;
  const year = Number(value.slice(0, 4));
  return Number.isSafeInteger(year) ? year : null;
}

function sourceSupportsScreen02ProposalIdentity(
  proposal: Screen02FindProposal,
  source: Screen02Source,
) {
  return screen02SourceSupportsProposalIdentity(proposal, source);
}

function identityBoundScreen02Sources(proposal: Screen02FindProposal) {
  const authoritative = proposal.sources.filter(
    (source) => source.authorityTier < 6,
  );
  return authoritative.filter((source) =>
    sourceSupportsScreen02ProposalIdentity(proposal, source)
  );
}

function identityBoundScreen02EvidenceText(proposal: Screen02FindProposal) {
  return identityBoundScreen02Sources(proposal)
    .map((source) => groundScreen02ProposalSource(proposal, source).evidenceText)
    .filter(Boolean)
    .join(" ");
}

function screen02FactIsIdentityBound(
  proposal: Screen02FindProposal,
  value: string,
) {
  const normalizedValue = normalizeBoundaryText(value);
  return Boolean(
    normalizedValue && normalizeBoundaryText(
      identityBoundScreen02EvidenceText(proposal),
    ).includes(normalizedValue),
  );
}

export function screen02RequiredVariableHasReconstructibleExposureConcept(
  variable: string,
) {
  const normalized = normalizeBoundaryText(variable);
  return /\b(?:addresses?|assignment|coordinates?|coverage|eligibility|exposure|facilit(?:y|ies)|footprint|geograph(?:y|ic|ical)|linkage|locations?|registration|service areas?|sites?|thresholds?)\b/u
    .test(normalized);
}

function screen02RequiredVariableIsIdentityBound(
  proposal: Screen02FindProposal,
  variable: string,
) {
  const normalizedVariable = normalizeBoundaryText(variable);
  const variableTokens = normalizedVariable.split(" ").filter(Boolean);
  const meaningfulTokens = variableTokens.filter((token) =>
    token.length >= 3 &&
    !new Set(["a", "an", "and", "for", "from", "in", "of", "on", "or", "the", "to", "with"])
      .has(token)
  );
  if (
    variable.length > 240 || variableTokens.length > 24 ||
    meaningfulTokens.length < 2 ||
    !screen02RequiredVariableHasReconstructibleExposureConcept(variable)
  ) return false;
  let evidence = normalizeBoundaryText(
    identityBoundScreen02EvidenceText(proposal),
  );
  for (const identityText of [
    proposal.title,
    proposal.nativeIdentity?.formalIdentifier ?? "",
    ...proposal.sources.map((source) => source.title),
  ]) {
    const normalizedIdentity = normalizeBoundaryText(identityText);
    if (normalizedIdentity) {
      evidence = ` ${evidence} `.split(` ${normalizedIdentity} `).join(" ")
        .trim().replace(/\s+/gu, " ");
    }
  }
  return ` ${evidence} `.includes(` ${normalizedVariable} `);
}

function studyPeriodYears(value: string): [number, number] | null {
  const years = value.match(/(?:19|20)\d{2}/g)?.map(Number) ?? [];
  if (years.length !== 2) return null;
  return [Math.min(years[0], years[1]), Math.max(years[0], years[1])];
}

const SCREEN02_MATERIAL_TIMING_LABEL =
  // `Agency announcement date` is a deliberately exact system-owned label
  // emitted only when the retrieved announcement itself establishes an
  // approval or final action. It is a material public information-event anchor,
  // never an inferred adoption, implementation, or organization-level
  // treatment date. Generic publication/catalog dates remain documentary and
  // fail closed below.
  /\b(?:adopt\w*|announc\w*|approv\w*|decision date|rul(?:e|ed|ing|ing date)|order date|amend\w*|applicab\w*|appl(?:y|ies) from(?=\s+(?:(?:on|the)\s+)?(?:\d{1,2}\s+[A-Za-z]+\s+(?:18|19|20|21)\d{2}|(?:18|19|20|21)\d{2}-\d{2}-\d{2}))|application (?:beg\w*|date|start\w*)|begin\w*|came into force|commenc\w*|compliance|declar\w*|effective|enact\w*|enforc\w*|enter\w* into force|entry into force|expir\w*|gdacs event start|hazard (?:began|ended|start\w*)|implement\w*|incident (?:began|ended|start\w*)|landfall|made|onset|operative|phase|sunset|take\w* effect|took effect|treatment|usgs event date)\b/giu;
const SCREEN02_DOCUMENTARY_TIMING_LABEL =
  /\b(?:article|catalog(?:ue)?|document|filing|issuance|issued|modified|publication|published|record|retrieval|retrieved|revision|updated) date\b|\b(?:publication|published|retrieved)\b/iu;
const SCREEN02_CONTINUED_FORCE_TIMING =
  /\b(?:continu\w*|remain\w*|still)\b(?:\s+[\p{L}\p{N}.-]+){0,12}\s+(?:effective|in force|operative)\b|\b(?:effective|in force|operative)\b(?:\s+[\p{L}\p{N}.-]+){0,12}\s+(?:as of|through|until)\b/iu;
const SCREEN02_NEGATED_MATERIAL_TIMING =
  /\b(?:did|does|do|has|have|had|is|was|were|will|would)\s+not\b(?:\s+[\p{L}\p{N}.-]+){0,12}\s+(?:adopt\w*|amend\w*|applicab\w*|appl(?:y|ies) from|begin\w*|commenc\w*|declar\w*|effective|enact\w*|enforc\w*|implement\w*|operative|phase|take\w* effect|took effect)\b|\b(?:never|not|no|without)\b(?:\s+[\p{L}\p{N}.-]+){0,8}\s+(?:adopt\w*|amend\w*|applicab\w*|appl(?:y|ies) from|begin\w*|commenc\w*|declar\w*|effective|enact\w*|enforc\w*|implement\w*|operative|take\w* effect|took effect)\b|\b(?:adopt\w*|amend\w*|applicab\w*|appl(?:y|ies) from|begin\w*|commenc\w*|declar\w*|effective|enact\w*|enforc\w*|implement\w*|operative|phase|take\w* effect|took effect)\b(?:\s+[\p{L}\p{N}.-]+){0,12}\s+(?:never|not|unknown|undetermined|unestablished|unspecified|tbd)\b/iu;
const SCREEN02_CONDITIONAL_MATERIAL_TIMING =
  /\bif\b(?:\s+[\p{L}\p{N}.-]+){0,12}\s+(?:adopt\w*|approv\w*|enact\w*|finaliz\w*|pass\w*|promulgat\w*)\b|\b(?:proposal|proposed (?:measure|regulation|rule(?:making)?)|draft (?:measure|regulation|rule))\b(?:\s+[\p{L}\p{N}.-]+){0,20}\s+(?:could|may|might|would)\b|\b(?:could|may|might|would)\b(?:\s+[\p{L}\p{N}.-]+){0,20}\s+(?:become effective|begin\w*|commenc\w*|take\w* effect)\b/iu;
const SCREEN02_PRELIMINARY_LIFECYCLE_STATUS =
  /\b(?:advance notice of proposed rulemaking|draft|pending|preliminary|proposal|proposed|prorule)\b/iu;
const SCREEN02_FINAL_LIFECYCLE_STATUS =
  /(?:^(?:regulation|rule)$|\b(?:adopted|approved|completed|enacted|final|in force|operative|promulgated)\b)/iu;
const SCREEN02_PRELIMINARY_LIFECYCLE_TITLE =
  /^(?:(?:advance )?notice of )?proposed\b|^draft\b/iu;
const SCREEN02_PRELIMINARY_LIFECYCLE_ACTION =
  /\baction\s*:\s*(?:(?:advance )?notice of )?proposed\s+rule(?:making)?\b/iu;
const SCREEN02_TIMING_YEAR = /\b(?:18|19|20|21)\d{2}\b/gu;

export type Screen02MaterialTimingFact = {
  year: number;
  clause: string;
  sourceIds: string[];
};

const SCREEN02_MATERIAL_TIMING_CLAUSE_MAX_CHARS = 220;

function boundedScreen02MaterialTimingClause(
  clause: string,
  labelMatch: RegExpMatchArray,
  yearMatch: RegExpMatchArray,
) {
  if (clause.length <= SCREEN02_MATERIAL_TIMING_CLAUSE_MAX_CHARS) {
    return clause;
  }
  const labelStart = labelMatch.index ?? 0;
  const labelEnd = labelStart + labelMatch[0].length;
  const yearStart = yearMatch.index ?? 0;
  const yearEnd = yearStart + yearMatch[0].length;
  const materialStart = Math.min(labelStart, yearStart);
  const materialEnd = Math.max(labelEnd, yearEnd);
  const materialLength = materialEnd - materialStart;
  const contextBudget = Math.max(
    0,
    SCREEN02_MATERIAL_TIMING_CLAUSE_MAX_CHARS - materialLength,
  );
  let start = Math.max(0, materialStart - Math.floor(contextBudget / 2));
  let end = Math.min(
    clause.length,
    materialEnd + (contextBudget - (materialStart - start)),
  );
  if (end - start < SCREEN02_MATERIAL_TIMING_CLAUSE_MAX_CHARS && start > 0) {
    start = Math.max(
      0,
      end - SCREEN02_MATERIAL_TIMING_CLAUSE_MAX_CHARS,
    );
  }
  if (
    start > 0 &&
    /\S/u.test(clause[start - 1] ?? "") &&
    /\S/u.test(clause[start] ?? "")
  ) {
    const nextBoundary = clause.indexOf(" ", start);
    if (nextBoundary >= 0 && nextBoundary < materialStart) {
      start = nextBoundary + 1;
    }
  }
  if (
    end < clause.length &&
    /\S/u.test(clause[end - 1] ?? "") &&
    /\S/u.test(clause[end] ?? "")
  ) {
    const priorBoundary = clause.lastIndexOf(" ", end - 1);
    if (priorBoundary > materialEnd) end = priorBoundary;
  }
  return clause.slice(start, end).trim();
}

function splitScreen02TimingClauses(value: string) {
  const clauses = value
    .split(/(?<=[.!?])\s+|\s*(?:;|\n)\s*/u)
    .map((clause) => clause.replace(/\s+/gu, " ").trim())
    .filter(Boolean);
  return clauses.flatMap((clause) => {
    const parts = clause
      .split(/\s*(?:,|\b(?:and|but|whereas|while)\b)\s*/iu)
      .map((part) => part.trim())
      .filter(Boolean);
    const independentlyLabeled = parts.length > 1 && parts.every((part) =>
      part.search(SCREEN02_TIMING_YEAR) >= 0 &&
      (part.search(SCREEN02_MATERIAL_TIMING_LABEL) >= 0 ||
        SCREEN02_DOCUMENTARY_TIMING_LABEL.test(part) ||
        SCREEN02_CONTINUED_FORCE_TIMING.test(part))
    );
    return independentlyLabeled ? parts : [clause];
  });
}

function materialTimingFactsFromText(
  value: string,
  sourceIds: readonly string[],
) {
  // Identify citation spans before sentence splitting: an abbreviation such
  // as "No." can otherwise separate an identifier from its instrument name.
  const normalizedValue = value.replace(/\s+/gu, " ");
  const identifierSpans = [...normalizedValue.matchAll(
    /\b(?:Regulation|Directive|Decision|Act)\s*(?:\([A-Z]{2,5}\)\s*)?(?:No\.?\s*)?\d{1,6}\s*(?:\/\s*\d{1,6}(?:\s*\/\s*[A-Z]{2,5})?|of\s+(?:18|19|20|21)\d{2})\b/giu,
  )];
  let clauseCursor = 0;
  return splitScreen02TimingClauses(value).flatMap((clause) => {
    const clauseStart = normalizedValue.indexOf(clause, clauseCursor);
    if (clauseStart < 0) return [];
    clauseCursor = clauseStart + clause.length;
    const yearMatches = [...clause.matchAll(SCREEN02_TIMING_YEAR)].filter((match) => {
      const start = clauseStart + match.index!;
      return !identifierSpans.some((span) =>
        start >= span.index! && start < span.index! + span[0].length);
    });
    if (yearMatches.length === 0) return [];
    const labelMatches = [...clause.matchAll(SCREEN02_MATERIAL_TIMING_LABEL)];
    return labelMatches.flatMap((labelMatch) => {
      const labelIndex = labelMatch.index ?? 0;
      const localContext = clause.slice(
        Math.max(0, labelIndex - 80),
        Math.min(clause.length, labelIndex + labelMatch[0].length + 100),
      );
      if (
        SCREEN02_CONTINUED_FORCE_TIMING.test(localContext) ||
        SCREEN02_NEGATED_MATERIAL_TIMING.test(localContext) ||
        SCREEN02_CONDITIONAL_MATERIAL_TIMING.test(clause)
      ) return [];
      let nearest: RegExpMatchArray | undefined;
      let distance = Infinity;
      for (const match of yearMatches) {
        const start = match.index ?? 0;
        const candidateDistance = Math.min(
          Math.abs(start - labelIndex),
          Math.abs(start + match[0].length - labelIndex - labelMatch[0].length),
        );
        // A strict improvement preserves the first match on equal distances,
        // exactly as the prior stable sort did.
        if (candidateDistance < distance) {
          nearest = match;
          distance = candidateDistance;
        }
      }
      if (!nearest || distance > 160) return [];
      return [{
        year: Number(nearest[0]),
        clause: boundedScreen02MaterialTimingClause(
          clause,
          labelMatch,
          nearest,
        ),
        sourceIds: [...sourceIds],
      } satisfies Screen02MaterialTimingFact];
    });
  });
}

/**
 * Returns true only for source-bound proposal/draft lifecycle signals. A
 * proposed event remains a useful discovery lead, but it cannot establish an
 * observed shock merely because its text states a conditional future date.
 */
export function screen02ProposalHasPreliminaryLifecycle(
  proposal: Screen02FindProposal,
) {
  const status = proposal.nativeIdentity?.status?.trim() ?? "";
  if (SCREEN02_PRELIMINARY_LIFECYCLE_STATUS.test(status)) return true;
  // An explicit source-native final status controls over a title that may
  // retain proposal-era wording. Mixed statuses still fail closed above.
  if (status && SCREEN02_FINAL_LIFECYCLE_STATUS.test(status)) return false;
  if (SCREEN02_PRELIMINARY_LIFECYCLE_TITLE.test(proposal.title.trim())) {
    return true;
  }
  return identityBoundScreen02Sources(proposal).some((source) =>
    SCREEN02_PRELIMINARY_LIFECYCLE_ACTION.test(source.evidenceText ?? "")
  );
}

/**
 * Returns transition timing only. Publication/catalog dates and statements
 * that a rule merely remained in force are documentary status, not shocks.
 * Every lane uses the same retained-source pipeline. Registry metadata and
 * proposal-authored provisional dates are discovery leads, not timing facts.
 * Proposed/draft lifecycle records and conditional timing clauses likewise
 * remain leads until a distinct final or realized event is sourced.
 */
export function screen02MaterialTimingFacts(
  proposal: Screen02FindProposal,
): Screen02MaterialTimingFact[] {
  if (screen02ProposalHasPreliminaryLifecycle(proposal)) return [];
  const sourceFacts = identityBoundScreen02Sources(proposal).flatMap((source) => {
    const evidenceText = groundScreen02ProposalSource(
      proposal,
      source,
    ).evidenceText;
    return evidenceText
      ? materialTimingFactsFromText(evidenceText, [source.id])
      : []
  });
  const byIdentity = new Map<string, Screen02MaterialTimingFact>();
  for (const fact of sourceFacts) {
    const key = `${fact.year}\u001f${normalizeBoundaryText(fact.clause)}\u001f${fact.sourceIds.join(",")}`;
    if (!byIdentity.has(key)) byIdentity.set(key, fact);
  }
  return [...byIdentity.values()].sort(
    (left, right) =>
      left.year - right.year || left.clause.localeCompare(right.clause, "en-US"),
  );
}

function studyPeriodCompatibility(
  proposal: Screen02FindProposal,
  studyPeriod: string,
): Pick<Screen02HardFilterResult, "status" | "reason"> {
  const period = studyPeriodYears(studyPeriod);
  if (!period) {
    return {
      status: "review",
      reason:
        "Candidate material timing or the confirmed period cannot yet support a deterministic period check.",
    };
  }
  if (screen02ProposalHasPreliminaryLifecycle(proposal)) {
    return {
      status: "review",
      reason:
        "The retained record is still at a proposed or draft lifecycle stage. Conditional future timing does not establish a realized shock; a distinct final or adopted action is required.",
    };
  }
  const materialYears = screen02MaterialTimingFacts(proposal).map(
    (fact) => fact.year,
  );
  if (materialYears.length > 0) {
    const inPeriod = materialYears.filter(
      (year) => year >= period[0] && year <= period[1],
    );
    return inPeriod.length > 0
      ? {
          status: "pass",
          reason: `A source-labeled material event date falls inside the confirmed period: ${studyPeriod}.`,
        }
      : {
          status: "fail",
          reason: materialYears.every((year) => year > period[1])
            ? `Every source-labeled material event date begins after the confirmed period: ${studyPeriod}.`
            : `No source-labeled material event date falls inside the confirmed period: ${studyPeriod}.`,
        };
  }
  return {
    status: "review",
    reason:
      "No source-labeled material transition yet supports the confirmed-period check. Publication dates and continued-force statements do not qualify.",
  };
}

function hasSourceSupportedCrossJurisdictionPathway(
  proposal: Screen02FindProposal,
) {
  const identityBoundSources = identityBoundScreen02Sources(proposal);
  const evidence = normalizeBoundaryText(
    identityBoundScreen02EvidenceText(proposal),
  );
  const reachesOrganizationsOutsideIssuingArea =
    /\b(?:cross border|extraterritorial|foreign organizations?|outside(?: the)? (?:issuing )?jurisdiction|regardless of (?:their )?location|territorial (?:nexus|reach|scope|rule))\b/u
      .test(evidence);
  const organizationalActivityPathway =
    /\b(?:firms?|business(?:es)?|organizations?|enterprises?|providers?|publishers?|controllers?|processors?)\b/u
      .test(evidence) &&
    /\b(?:doing business|establishments?|offer(?:ing|s)? goods or services|monitor(?:ing|s)? (?:individuals|people|users)|operations?|processing activity|serv(?:e|es|ing) (?:customers|residents|users)|territorial nexus)\b/u
      .test(evidence);
  return identityBoundSources.length > 0 &&
    reachesOrganizationsOutsideIssuingArea &&
    organizationalActivityPathway;
}

function hasAuthoritativeContainingJurisdictionCoverage(
  proposal: Screen02FindProposal,
  context: Screen01StudyContext | DeepReadonly<Screen01StudyContext>,
) {
  if (identityBoundScreen02Sources(proposal).length === 0) {
    return false;
  }
  const requested = normalizeBoundaryText(
    context.scopeContract.geography,
  );
  const requestedTokens = new Set(requested.split(" ").filter(Boolean));
  return proposal.event.geographies.some((geography) => {
    const candidate = normalizeBoundaryText(geography);
    const candidateTokens = candidate.split(" ").filter(Boolean);
    const sourceBound = screen02FactIsIdentityBound(proposal, geography);
    return sourceBound && candidate !== requested && candidateTokens.length > 0 &&
      candidateTokens.length < requestedTokens.size &&
      candidateTokens.every((token) => requestedTokens.has(token));
  });
}

function hasSourceSupportedDisasterOrganizationPathway(
  proposal: Screen02FindProposal,
  context: Screen01StudyContext | DeepReadonly<Screen01StudyContext>,
) {
  if (identityBoundScreen02Sources(proposal).length === 0) {
    return false;
  }
  const eventFamily = normalizeBoundaryText(proposal.event.eventFamily);
  const requestedFamily = normalizeBoundaryText(
    context.scopeContract.eventFamily,
  );
  if (
    !eventFamily.includes("disaster") ||
    !requestedFamily.includes("disaster")
  ) {
    return false;
  }
  const requestedPopulation = normalizePopulationBoundaryText(
    context.scopeContract.population,
  );
  const organizationalPopulation =
    /\b(?:firms?|organizations?|enterprises?|operators?|providers?|publishers?|establishments?|facilities|banks?|utilit(?:y|ies)|manufacturers?|producers?)\b/u.test(
      requestedPopulation,
    );
  const documentedOccurrence = identityBoundScreen02Sources(proposal).some(
    (source) => groundScreen02ProposalSource(proposal, source).coordinates.some(
      (coordinate) =>
        coordinate.polarity === "affirmative" &&
        coordinate.matchedActionTerms.some((action) =>
          [
            "began",
            "declar",
            "detect",
            "occur",
            "record",
            "report",
            "struck",
          ].includes(action)
        ),
    ),
  );
  const sourceIdentifiedArea = proposal.event.geographies.some(
    (geography) =>
      screen02FactIsIdentityBound(proposal, geography) &&
      Boolean(normalizeBoundaryText(geography)) &&
      !/^(?:unknown|not specified|worldwide)$/u.test(
        normalizeBoundaryText(geography),
      ),
  );
  const sourceGroundedExposureSurface = proposal.requiredVariables.some(
    (variable) =>
      /^(?:designated-area location|earthquake point coordinates|event point coordinates|hazard-footprint coordinates)$/i.test(
        variable,
      ) && screen02RequiredVariableIsIdentityBound(proposal, variable),
  );
  // The join is an explicitly unfinished research-design variable. It must be
  // present, but an official hazard record must not be made to state that a
  // focal organization was exposed. The independently grounded source-native
  // area/point above is the positive evidence; this variable records the join
  // Screen 3 still has to construct.
  const organizationLocationLinkagePlanned = proposal.requiredVariables.some(
    (variable) =>
      /^organization-to-(?:(?:event|hazard)(?:-footprint)?|designated-area) location linkage$/i.test(
        variable,
      ),
  );
  return organizationalPopulation &&
    documentedOccurrence &&
    sourceIdentifiedArea &&
    sourceGroundedExposureSurface &&
    organizationLocationLinkagePlanned;
}

/**
 * A `review` result is not itself eligibility. This deliberately narrow
 * resolver recognizes only two positive, source-supported pathways that can
 * settle a Find hard-boundary review without researcher inference:
 *
 * - an explicit cross-jurisdiction organizational pathway; or
 * - a source-grounded disaster area/point plus an explicitly unfinished
 *   organization-location join; or
 * - an authoritative source-described organizational population broad enough
 *   to contain the requested organizational unit type.
 *
 * Missing dates, unknown coverage, connector-echoed applicability and other
 * partial overlaps remain unresolved and therefore block ordinary results.
 */
export function sourceResolvesFindHardFilterReview(
  proposal: Screen02FindProposal,
  context: Screen01StudyContext | DeepReadonly<Screen01StudyContext>,
  key: Screen02HardFilterKey,
) {
  if (key === "geography") {
    return hasSourceSupportedCrossJurisdictionPathway(proposal) ||
      hasAuthoritativeContainingJurisdictionCoverage(proposal, context);
  }
  if (key !== "population") return false;
  if (identityBoundScreen02Sources(proposal).length === 0) {
    return false;
  }
  if (hasSourceSupportedDisasterOrganizationPathway(proposal, context)) {
    return true;
  }
  const populationText = [
    ...proposal.event.populations,
    proposal.affectedPopulation,
  ].filter((population) =>
    screen02FactIsIdentityBound(proposal, population)
  ).join(" ");
  const populationUnresolved =
    !populationText.trim() ||
    /\b(?:unknown|unverified|not established|applicability (?:is )?provisional|coverage (?:is )?provisional)\b/i.test(
      populationText,
    );
  const authoritativePopulationSentences = identityBoundScreen02EvidenceText(
    proposal,
  )
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.replace(/\s+/gu, " ").trim())
    .filter(Boolean)
    .filter(
      (sentence) =>
        !/^(?:(?:final|proposed) rule|rule|notice) published in the federal register on \d{4}-\d{2}-\d{2}\.?$/i.test(
          sentence,
        ) &&
        !/^applicability to the requested organizational population is provisional\.?$/i.test(
          sentence,
        ) &&
        !/^the listing did not include a concise abstract\.?$/i.test(sentence) &&
        !/^nonbinding administrative\/governance notice published in the federal register\b/i.test(
          sentence,
        ) &&
        !/^this record concerns an advisory, charter, membership, recruitment, or public-participation process\b/i.test(
          sentence,
        ),
    )
    .filter(
      (sentence) =>
        /\b(?:require|requires|required|establish|establishes|established|impose|imposes|govern|governs|cover|covers|apply|applies|permit|permits|prohibit|prohibits|restrict|restricts)\b/i.test(
          sentence,
        ) &&
        /\b(?:firms?|companies|business(?:es)?|organizations?|enterprises?|operators?|providers?|publishers?|establishments?|facilities|controllers?|processors?|banks?|depository institutions?|utilit(?:y|ies)|manufacturers?|producers?)\b/i.test(
          sentence,
        ),
    );
  if (populationUnresolved && authoritativePopulationSentences.length === 0) {
    return false;
  }
  const sourcePopulationText = populationUnresolved
    ? authoritativePopulationSentences.join(" ")
    : populationText;
  const required = normalizePopulationBoundaryText(
    context.scopeContract.population,
  );
  const governedPopulationText = sourcePopulationText
    .split(/(?<=[.!?;])\s+/u)
    .map((sentence) => {
      const actionTarget =
        /\b(?:appl(?:y|ies) to|covers?|governs?|regulates?|requir(?:e|es|ed))\s+(.+)$/iu
          .exec(sentence)?.[1] ??
        /\bimposes?\b.*?\bon\s+(.+)$/iu.exec(sentence)?.[1] ??
        sentence;
      return actionTarget
        .split(
          /\b(?:to|financ(?:e|es|ing)|lend(?:s|ing)? to|serv(?:e|es|ing)|suppl(?:y|ies|ying) to|that|which|who|whose)\b/iu,
          1,
        )[0] ?? "";
    })
    .join(" ");
  const evidence = normalizePopulationBoundaryText(governedPopulationText);
  const requiredOwnership = populationOwnership(required);
  const evidenceOwnership = populationOwnership(evidence);
  if (
    requiredOwnership === "conflict" ||
    evidenceOwnership === "conflict" ||
    (Boolean(requiredOwnership) &&
      Boolean(evidenceOwnership) &&
      requiredOwnership !== evidenceOwnership)
  ) {
    return false;
  }
  // A narrow rural, small-business, member-only, or tribal population does
  // not establish the researcher's publicly listed-company boundary merely
  // because both are organizational groups. Keep that unresolved unless the
  // retained governing clause itself names public/listed firms or issuers.
  if (
    /\b(?:public|listed|issuer)\b/u.test(required) &&
    /\b(?:rural|small(?: business| firm| company)?|member(?: owned)?|tribal)\b/u
      .test(evidence) &&
    !/\b(?:public|listed|issuer)\b/u.test(evidence)
  ) {
    return false;
  }
  const requestedOrganizationalUnits =
    /\b(?:firms?|organizations?|enterprises?|operators?|providers?|publishers?|establishments?|facilities|banks?|utilit(?:y|ies)|manufacturers?|producers?)\b/u.test(
      required,
    );
  if (!requestedOrganizationalUnits) return false;
  const organizationalFamilies = [
    /\b(?:manufactur\w*|producers?)\b/u,
    /\b(?:banks?|depository institutions?)\b/u,
    /\butilit(?:y|ies)\b/u,
    /\b(?:operators?|providers?|publishers?)\b/u,
    /\b(?:establishments?|facilities)\b/u,
    /\b(?:controllers?|processors?)\b/u,
  ];
  const requestedFamilies = organizationalFamilies.filter((family) =>
    family.test(required)
  );
  const sourceFamilies = organizationalFamilies.filter((family) =>
    family.test(evidence)
  );
  if (requestedFamilies.length > 0) {
    return requestedFamilies.some((family) => family.test(evidence));
  }
  const broadOrganizationalPopulation =
    /\b(?:firms?|organizations?|enterprises?|business(?:es)?|companies|company|corporations?|entities|issuers?)\b/u.test(
      governedPopulationText.toLocaleLowerCase("en-US"),
    );
  if (broadOrganizationalPopulation) return true;
  // An ownership-unspecified regulated group can contain the requested public
  // or private subset. A stated opposing ownership still fails above.
  return sourceFamilies.length > 0;
}

export function evaluateFindHardFilters(
  proposal: Screen02FindProposal,
  context: Screen01StudyContext | DeepReadonly<Screen01StudyContext>,
): Screen02HardFilterResult[] {
  const scope = context.scopeContract;
  const requireSourceBinding = proposal.sources.some(
    (source) => source.authorityTier < 6,
  );
  const sourceBoundGeographies = requireSourceBinding
    ? proposal.event.geographies.filter((geography) =>
        screen02FactIsIdentityBound(proposal, geography)
      )
    : proposal.event.geographies;
  const directGeographyStatus = isGlobalGeographyBoundary(scope.geography)
    ? "pass"
    : sourceBoundGeographies.length === 0
      ? "review"
      : boundaryMatchStatus(scope.geography, sourceBoundGeographies);
  const crossJurisdictionPathway = directGeographyStatus === "fail" &&
    hasSourceSupportedCrossJurisdictionPathway(proposal);
  const geographyStatus = crossJurisdictionPathway
    ? "review"
    : directGeographyStatus;
  const sourceBoundPopulations = requireSourceBinding
    ? proposal.event.populations.filter((population) =>
        screen02FactIsIdentityBound(proposal, population)
      )
    : proposal.event.populations;
  const populationCandidates = sourceBoundPopulations.flatMap(
    (population) => [
      population,
      ...sourceBoundGeographies.map(
        (geography) => `${geography} ${population}`,
      ),
    ],
  );
  const populationMatchStatus = populationCandidates.length === 0
    ? "review"
    : boundaryMatchStatus(scope.population, populationCandidates, true);
  const populationApplicabilityUnverified =
    proposal.event.populations.some((population) =>
      /\b(?:applicability|coverage)\s+(?:is\s+)?unverified\b/i.test(
        population,
      ),
    );
  const populationCoverageUnknown = proposal.event.populations.some(
    (population) =>
      population === SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
  );
  const populationStatus =
    populationCoverageUnknown ||
    (populationMatchStatus === "pass" &&
      populationApplicabilityUnverified)
      ? "review"
      : populationMatchStatus === "fail" &&
          sourceResolvesFindHardFilterReview(proposal, context, "population")
        ? "review"
      : populationMatchStatus;
  const eventFamilyStatus = boundaryMatchStatus(scope.eventFamily, [
    proposal.event.eventFamily,
  ]);
  const periodCompatibility = studyPeriodCompatibility(
    proposal,
    scope.studyPeriod,
  );

  return [
    {
      key: "geography",
      status: geographyStatus,
      reason: crossJurisdictionPathway
        ? `Candidate issuer geography differs from ${scope.geography}, but the retained source-derived coverage text establishes a cross-jurisdiction organizational pathway that requires candidate-specific review.`
        : boundaryReason(
            "geography",
            geographyStatus,
            scope.geography,
          ),
    },
    {
      key: "studyPeriod",
      status: periodCompatibility.status,
      reason: periodCompatibility.reason,
    },
    {
      key: "population",
      status: populationStatus,
      reason: populationCoverageUnknown
        ? `Candidate source metadata does not establish organizational population coverage; review against the confirmed boundary: ${scope.population}.`
        : populationApplicabilityUnverified &&
            populationMatchStatus === "pass"
          ? `Candidate metadata repeats the confirmed population, but the connector explicitly marks population applicability as unverified; review formal coverage against: ${scope.population}.`
          : boundaryReason(
              "population",
              populationStatus,
              scope.population,
            ),
    },
    {
      key: "eventFamily",
      status: eventFamilyStatus,
      reason: boundaryReason(
        "event family",
        eventFamilyStatus,
        scope.eventFamily,
      ),
    },
  ];
}

function defaultAuditHardFilters(
  proposal: Screen02AuditProposal,
  context: Screen01StudyContext | DeepReadonly<Screen01StudyContext>,
): Screen02HardFilterResult[] {
  return screen02HardFilterKeys.map((key) => {
    const supplied = proposal.hardFilterEvidence?.[key];
    if (supplied) return { ...supplied, key };
    return {
      key,
      status: "review",
      reason: `The ${key} fit for ${context.knownShock} has not yet been established by a located source; keep this anchored representation visible for review.`,
    };
  });
}

function assertHardFilter(
  value: unknown,
  label: string,
  expectedKey?: Screen02HardFilterKey,
): asserts value is Screen02HardFilterResult {
  assertRecord(value, label);
  assertExactKeys(value, ["key", "status", "reason"], label);
  if (
    typeof value.key !== "string" ||
    !hardFilterKeySet.has(value.key) ||
    (expectedKey && value.key !== expectedKey)
  ) {
    fail(`${label}.key is invalid.`);
  }
  if (!["pass", "review", "fail"].includes(String(value.status))) {
    fail(`${label}.status is invalid.`);
  }
  assertString(value.reason, `${label}.reason`, MAX_LONG_TEXT);
}

function assertSharedCardFields(
  value: Record<string, unknown>,
  label: string,
) {
  if (
    ![
      "registry-reviewed",
      "newly-discovered",
      "user-provided",
      "fictional-demonstration",
      "unsupported-lead",
    ].includes(String(value.origin))
  ) {
    fail(`${label}.origin is invalid.`);
  }
  assertStringList(value.provisionalDates, `${label}.provisionalDates`, {
    allowEmpty: true,
  });
  assertString(
    value.affectedPopulation,
    `${label}.affectedPopulation`,
    MAX_LONG_TEXT,
  );
  assertStringList(value.requiredVariables, `${label}.requiredVariables`, {
    allowEmpty: true,
  });
  if (!isRecord(value.outcomeLink)) {
    fail(`${label}.outcomeLink must be an object.`);
  }
  assertExactKeys(
    value.outcomeLink,
    ["text", "status"],
    `${label}.outcomeLink`,
  );
  assertString(
    value.outcomeLink.text,
    `${label}.outcomeLink.text`,
    MAX_LONG_TEXT,
  );
  if (
    !["ai-hypothesis", "system-template"].includes(
      String(value.outcomeLink.status),
    )
  ) {
    fail(
      `${label}.outcomeLink.status must be ai-hypothesis or system-template.`,
    );
  }
  if (
    ![
      "full-audit",
      "assisted-audit",
      "event-reconnaissance",
      "stop",
    ].includes(String(value.likelyServiceLevel))
  ) {
    fail(`${label}.likelyServiceLevel is invalid.`);
  }
  assertStringList(value.limitations, `${label}.limitations`, {
    allowEmpty: true,
    maxText: MAX_LONG_TEXT,
  });
  assertStringList(value.reasons, `${label}.reasons`, {
    allowEmpty: true,
    maxText: MAX_LONG_TEXT,
  });
}

function assertAssessments(value: unknown, label: string) {
  if (value === undefined) return;
  assertRecord(value, label);
  for (const key of Object.keys(value)) {
    if (
      ![
        "externalShockPlausibility",
        "populationApplicability",
        "outcomePathway",
        "exposureObservability",
        "timeSupport",
        "variation",
      ].includes(key)
    ) {
      fail(
        `${label}.${key} is not accepted; scope fit and source authority are derived.`,
      );
    }
    const assessment: unknown = value[key];
    if (!isRecord(assessment)) {
      fail(`${label}.${key} must be an object.`);
    }
    assertExactKeys(
      assessment,
      [
        "value",
        "category",
        "sourceEstablishedPopulation",
        "reason",
        "evidenceSourceIds",
        "method",
        "confidence",
        "unresolved",
      ],
      `${label}.${key}`,
    );
    if (assessment.sourceEstablishedPopulation !== undefined) {
      if (key !== "populationApplicability") {
        fail(
          `${label}.${key}.sourceEstablishedPopulation is accepted only for populationApplicability.`,
        );
      }
      if (assessment.sourceEstablishedPopulation !== null) {
        if (!isRecord(assessment.sourceEstablishedPopulation)) {
          fail(
            `${label}.${key}.sourceEstablishedPopulation must be an object or null.`,
          );
        }
        assertExactKeys(
          assessment.sourceEstablishedPopulation,
          ["text", "evidenceSourceIds"],
          `${label}.${key}.sourceEstablishedPopulation`,
        );
        assertString(
          assessment.sourceEstablishedPopulation.text,
          `${label}.${key}.sourceEstablishedPopulation.text`,
          MAX_LONG_TEXT,
        );
        assertStringList(
          assessment.sourceEstablishedPopulation.evidenceSourceIds,
          `${label}.${key}.sourceEstablishedPopulation.evidenceSourceIds`,
          {
            maxText: 120,
            maxItems: SCREEN_02_MAX_SOURCES_PER_PROPOSAL,
          },
        );
      }
    }
    if (
      assessment.value !== undefined &&
      assessment.value !== null
    ) {
      assertScore(assessment.value, `${label}.${key}.value`);
    }
    if (assessment.category !== undefined) {
      assertString(
        assessment.category,
        `${label}.${key}.category`,
        MAX_SHORT_TEXT,
      );
    }
    if (
      assessment.value === undefined &&
      assessment.category === undefined
    ) {
      fail(
        `${label}.${key} must provide a published rubric category or a researcher-specified numeric assessment.`,
      );
    }
    assertString(
      assessment.reason,
      `${label}.${key}.reason`,
      MAX_LONG_TEXT,
    );
    if (assessment.evidenceSourceIds !== undefined) {
      assertStringList(
        assessment.evidenceSourceIds,
        `${label}.${key}.evidenceSourceIds`,
        {
          allowEmpty: true,
          maxText: 120,
          maxItems: SCREEN_02_MAX_SOURCES_PER_PROPOSAL,
        },
      );
      if (
        new Set(assessment.evidenceSourceIds as string[]).size !==
        (assessment.evidenceSourceIds as string[]).length
      ) {
        fail(
          `${label}.${key}.evidenceSourceIds contains duplicates.`,
        );
      }
    }
    if (
      assessment.method !== undefined &&
      !["ai-rubric", "researcher-specified"].includes(
        String(assessment.method),
      )
    ) {
      fail(`${label}.${key}.method is invalid.`);
    }
    const method = assessment.method ?? "ai-rubric";
    if (
      [
        "externalShockPlausibility",
        "populationApplicability",
        "outcomePathway",
      ].includes(key) &&
      (method !== "ai-rubric" || assessment.value !== undefined)
    ) {
      fail(
        `${label}.${key} must use its published ordinal AI rubric and cannot accept a researcher-specified numeric value.`,
      );
    }
    const normalizedCategory =
      typeof assessment.category === "string"
        ? assessment.category.trim().toLocaleLowerCase("en-US")
        : "";
    const categoryMap = rubricCategoryScores[
      key as keyof typeof rubricCategoryScores
    ] as Record<string, number | null | undefined>;
    if (
      normalizedCategory &&
      !Object.hasOwn(categoryMap, normalizedCategory)
    ) {
      fail(
        `${label}.${key}.category is not in the published rubric.`,
      );
    }
    if (
      !normalizedCategory &&
      typeof assessment.value === "number" &&
      method !== "researcher-specified"
    ) {
      fail(
        `${label}.${key} AI assessments must use a published rubric category; direct numeric values are accepted only when researcher-specified.`,
      );
    }
    if (
      normalizedCategory &&
      typeof assessment.value === "number" &&
      categoryMap[normalizedCategory] !== assessment.value
    ) {
      fail(
        `${label}.${key}.value contradicts the fixed mapping for its rubric category.`,
      );
    }
    if (
      assessment.confidence !== undefined &&
      !["low", "medium", "high"].includes(
        String(assessment.confidence),
      )
    ) {
      fail(`${label}.${key}.confidence is invalid.`);
    }
    if (assessment.unresolved !== undefined) {
      assertStringList(
        assessment.unresolved,
        `${label}.${key}.unresolved`,
        { allowEmpty: true, maxText: MAX_LONG_TEXT },
      );
    }
  }
}

function assertProposal(
  proposal: unknown,
  baseline: DeepReadonly<Screen01StudyContext>,
  index: number,
): asserts proposal is Screen02Proposal {
  const expectedMode = baseline.startingPoint;
  const label = `proposals[${index}]`;
  assertRecord(proposal, label);
  for (const forbidden of ["sourceSummary", "scorecard", "rank", "anchorShock"]) {
    if (Object.hasOwn(proposal, forbidden)) {
      fail(
        `${label}.${forbidden} is derived by Screen 2 and is not accepted.`,
      );
    }
  }
  assertExactKeys(
    proposal,
    [
      "id",
      "mode",
      "kind",
      "title",
      "description",
      "origin",
      "provisionalDates",
      "affectedPopulation",
      "requiredVariables",
      "outcomeLink",
      "likelyServiceLevel",
      "limitations",
      "reasons",
      "sources",
      "assessments",
      ...(expectedMode === "find"
        ? ["event", "nativeIdentity", "fictionalDemo"]
        : [
            "representationType",
            "candidateConstruct",
            "operationalization",
            "hardFilterEvidence",
          ]),
    ],
    label,
  );
  assertString(proposal.id, `${label}.id`, 120);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(proposal.id)) {
    fail(`${label}.id contains unsupported characters.`);
  }
  if (proposal.mode !== expectedMode) {
    fail(`${label}.mode does not match the immutable Screen 1 mode.`);
  }
  assertString(proposal.title, `${label}.title`, MAX_LONG_TEXT);
  assertString(proposal.description, `${label}.description`, MAX_LONG_TEXT);
  assertSharedCardFields(proposal, label);
  if (
    !Array.isArray(proposal.sources) ||
    proposal.sources.length > SCREEN_02_MAX_SOURCES_PER_PROPOSAL
  ) {
    fail(`${label}.sources exceeds the per-proposal limit.`);
  }
  proposal.sources.forEach((source, sourceIndex) =>
    assertSource(source, `${label}.sources[${sourceIndex}]`),
  );
  if (
    new Set(proposal.sources.map((source) => source.id)).size !==
    proposal.sources.length
  ) {
    fail(`${label}.sources contains a duplicate source id.`);
  }
  assertAssessments(proposal.assessments, `${label}.assessments`);

  if (expectedMode === "find") {
    if (proposal.kind !== "event" || !isRecord(proposal.event)) {
      fail(`${label} must be a Find event proposal.`);
    }
    assertExactKeys(
      proposal.event,
      [
        "displayName",
        "eventDate",
        "eventFamily",
        "geographies",
        "populations",
      ],
      `${label}.event`,
    );
    assertString(
      proposal.event.displayName,
      `${label}.event.displayName`,
      MAX_LONG_TEXT,
    );
    assertString(
      proposal.event.eventDate,
      `${label}.event.eventDate`,
      MAX_SHORT_TEXT,
    );
    assertString(
      proposal.event.eventFamily,
      `${label}.event.eventFamily`,
      MAX_SHORT_TEXT,
    );
    assertStringList(
      proposal.event.geographies,
      `${label}.event.geographies`,
    );
    assertStringList(
      proposal.event.populations,
      `${label}.event.populations`,
    );
    if (proposal.nativeIdentity !== undefined) {
      if (!isRecord(proposal.nativeIdentity)) {
        fail(`${label}.nativeIdentity must be an object when supplied.`);
      }
      assertExactKeys(
        proposal.nativeIdentity,
        [
          "formalIdentifier",
          "issuer",
          "issuingJurisdiction",
          "status",
        ],
        `${label}.nativeIdentity`,
      );
      for (const key of [
        "formalIdentifier",
        "issuer",
        "issuingJurisdiction",
        "status",
      ] as const) {
        const value = proposal.nativeIdentity[key];
        if (value !== null) {
          assertString(
            value,
            `${label}.nativeIdentity.${key}`,
            MAX_SHORT_TEXT,
          );
        }
      }
    }
    if (
      proposal.fictionalDemo !== undefined &&
      proposal.fictionalDemo !== true
    ) {
      fail(`${label}.fictionalDemo can only be true or omitted.`);
    }
    if (
      proposal.fictionalDemo === true &&
      proposal.origin !== "fictional-demonstration"
    ) {
      fail(
        `${label} must disclose fictional-demonstration provenance.`,
      );
    }
    if (
      proposal.origin === "fictional-demonstration" &&
      proposal.fictionalDemo !== true
    ) {
      fail(
        `${label} must set fictionalDemo=true for fictional-demonstration provenance.`,
      );
    }
  } else {
    if (proposal.origin === "fictional-demonstration") {
      fail(
        `${label} cannot use fictional-demonstration provenance in Audit mode.`,
      );
    }
    if (
      proposal.kind !== "representation" ||
      typeof proposal.representationType !== "string" ||
      !auditRepresentationTypeSet.has(proposal.representationType)
    ) {
      fail(`${label} must be a recognized Audit representation.`);
    }
    assertString(
      proposal.candidateConstruct,
      `${label}.candidateConstruct`,
      MAX_LONG_TEXT,
    );
    assertString(
      proposal.operationalization,
      `${label}.operationalization`,
      MAX_LONG_TEXT,
    );
    if (
      !textAnchorsKnownShock(
        [
          proposal.title,
          proposal.description,
          proposal.candidateConstruct,
          proposal.operationalization,
        ].join(" "),
        baseline.knownShock,
      )
    ) {
      fail(
        `${label} does not preserve the exact known-shock anchor from Screen 1.`,
      );
    }
    if (proposal.hardFilterEvidence !== undefined) {
      if (!isRecord(proposal.hardFilterEvidence)) {
        fail(`${label}.hardFilterEvidence must be an object.`);
      }
      for (const [key, evidence] of Object.entries(
        proposal.hardFilterEvidence,
      )) {
        if (!hardFilterKeySet.has(key)) {
          fail(
            `${label}.hardFilterEvidence contains an invalid key.`,
          );
        }
        assertHardFilter(
          evidence,
          `${label}.hardFilterEvidence.${key}`,
          key as Screen02HardFilterKey,
        );
      }
    }
  }
}

const screen02AiAssessmentKeys = [
  "externalShockPlausibility",
  "populationApplicability",
  "outcomePathway",
  "exposureObservability",
  "timeSupport",
  "variation",
] as const;

const assessmentNarrativeStopwords = new Set([
  "about",
  "above",
  "after",
  "again",
  "against",
  "affected",
  "affects",
  "agency",
  "applicability",
  "attached",
  "available",
  "candidate",
  "change",
  "conditional",
  "companies",
  "company",
  "could",
  "current",
  "coverage",
  "described",
  "describes",
  "documented",
  "document",
  "effect",
  "eligibility",
  "establish",
  "established",
  "establishes",
  "event",
  "evidence",
  "exposure",
  "feasibility",
  "federal",
  "firms",
  "focal",
  "further",
  "having",
  "industry",
  "information",
  "indirect",
  "implementation",
  "might",
  "native",
  "located",
  "official",
  "organization",
  "organizational",
  "organizations",
  "other",
  "outcome",
  "plausible",
  "policy",
  "population",
  "preliminary",
  "program",
  "publication",
  "published",
  "record",
  "relation",
  "regulation",
  "report",
  "reporting",
  "research",
  "returned",
  "requirements",
  "requirement",
  "rules",
  "should",
  "since",
  "some",
  "specific",
  "source",
  "their",
  "theirs",
  "there",
  "these",
  "those",
  "study",
  "support",
  "target",
  "through",
  "under",
  "uncertain",
  "uncertainty",
  "until",
  "unknown",
  "verification",
  "verified",
  "verify",
  "where",
  "which",
  "while",
  "would",
]);

function normalizedAssessmentNarrative(value: string) {
  return normalizeBoundaryText(value);
}

function distinctiveAssessmentTokens(value: string) {
  return new Set(
    normalizedAssessmentNarrative(value)
      .split(" ")
      .filter(
        (token) =>
          token.length >= 5 &&
          !assessmentNarrativeStopwords.has(token),
      ),
  );
}

function assertCandidateGroundedAssessmentNarrative(
  proposal: Screen02Proposal,
  index: number,
  field: string,
  narrative: string,
) {
  const anchors = distinctiveAssessmentTokens(
    [
      proposal.title,
      proposal.description,
      ...proposal.sources.map((source) => source.title),
    ].join(" "),
  );
  const narrativeTokens = distinctiveAssessmentTokens(narrative);
  if (!candidateGroundedNarrative(anchors, narrativeTokens)) {
    fail(
      `AI-interpreted proposals[${index}].${field} must contain at least one candidate-distinctive token (five or more characters, excluding generic assessment terms) from that candidate's title, description, or attached source titles.`,
    );
  }
}

function candidateGroundedNarrative(
  anchors: ReadonlySet<string>,
  narrativeTokens: ReadonlySet<string>,
) {
  return (
    anchors.size > 0 &&
    [...narrativeTokens].some((token) => anchors.has(token))
  );
}

function proposalGroundsNarrative(
  proposal: Screen02Proposal,
  narrative: string,
) {
  return candidateGroundedNarrative(
    distinctiveAssessmentTokens(
      [
        proposal.title,
        proposal.description,
        ...proposal.sources.map((source) => source.title),
      ].join(" "),
    ),
    distinctiveAssessmentTokens(narrative),
  );
}

function substantiveAssessmentNarrative(narrative: string) {
  const normalized = normalizedAssessmentNarrative(narrative);
  const tokens = normalized.split(" ").filter(Boolean);
  const informative = new Set(
    tokens.filter(
      (token) =>
        token.length >= 4 &&
        !assessmentNarrativeStopwords.has(token),
    ),
  );
  return (
    narrative.trim().length >= 60 &&
    tokens.length >= 10 &&
    informative.size >= 4
  );
}

function assertSubstantiveAssessmentNarrative(
  index: number,
  field: string,
  narrative: string,
) {
  if (!substantiveAssessmentNarrative(narrative)) {
    fail(
      `AI-interpreted proposals[${index}].${field} must be substantive: at least 60 characters, 10 normalized words, and four informative terms are required.`,
    );
  }
}

function concreteUnresolvedTask(value: string) {
  const normalized = normalizedAssessmentNarrative(value);
  return (
    value.trim().length >= 35 &&
    normalized.split(" ").filter(Boolean).length >= 6 &&
    /\b(?:check|confirm|determine|document|establish|identify|locate|map|measure|resolve|test|trace|verify)\b/u.test(
      normalized,
    )
  );
}

function normalizedTitleSkeleton(
  proposal: Screen02Proposal,
  narrative: string,
) {
  const titleTokens = new Set(
    normalizedAssessmentNarrative(proposal.title)
      .split(" ")
      .filter(Boolean),
  );
  return normalizedAssessmentNarrative(narrative)
    .split(" ")
    .map((token) => (titleTokens.has(token) ? "candidate" : token))
    .join(" ");
}

// Same-field comparison uses the maximum Sørensen-Dice similarity across
// normalized one-, two-, and three-token n-grams. At or above 0.95 the text
// is effectively the same narrative and no evidence-anchor escape applies.
const SCREEN02_NARRATIVE_GRAY_SIMILARITY = 0.86;
const SCREEN02_NARRATIVE_UNCONDITIONAL_SIMILARITY = 0.95;

function narrativeNgrams(value: string, width: number) {
  const tokens = value.split(" ").filter(Boolean);
  const grams = new Set<string>();
  for (let index = 0; index <= tokens.length - width; index += 1) {
    grams.add(tokens.slice(index, index + width).join("\u0001"));
  }
  return grams;
}

function narrativeNgramSimilarity(left: string, right: string) {
  return Math.max(
    ...[1, 2, 3].map((width) => {
      const leftGrams = narrativeNgrams(left, width);
      const rightGrams = narrativeNgrams(right, width);
      if (leftGrams.size === 0 || rightGrams.size === 0) return 0;
      let overlap = 0;
      for (const gram of leftGrams) {
        if (rightGrams.has(gram)) overlap += 1;
      }
      return (2 * overlap) / (leftGrams.size + rightGrams.size);
    }),
  );
}

type AssessmentNarrativeRecord = {
  proposal: Screen02Proposal;
  index: number;
  field: string;
  text: string;
  evidenceSourceIds: readonly string[];
};

function validatedNarrativeAnchors(record: AssessmentNarrativeRecord) {
  const narrativeTokens = distinctiveAssessmentTokens(record.text);
  const titleTokens = distinctiveAssessmentTokens(record.proposal.title);
  const evidenceIds = new Set(record.evidenceSourceIds);
  const sourceText = record.proposal.sources
    .filter((source) => evidenceIds.has(source.id))
    .map((source) => source.title)
    .join(" ");
  const anchors = new Set<string>();
  for (const token of distinctiveAssessmentTokens(sourceText)) {
    if (!titleTokens.has(token) && narrativeTokens.has(token)) {
      anchors.add(`source:${token}`);
    }
  }
  for (const token of distinctiveAssessmentTokens(
    record.proposal.description,
  )) {
    if (!titleTokens.has(token) && narrativeTokens.has(token)) {
      anchors.add(`provision:${token}`);
    }
  }
  const dateText = [
    ...record.proposal.provisionalDates,
    ...record.proposal.sources.flatMap((source) =>
      source.publishedDate ? [source.publishedDate] : [],
    ),
    ...(record.proposal.mode === "find"
      ? [record.proposal.event.eventDate]
      : []),
  ].join(" ");
  const narrativeNormalized = normalizedAssessmentNarrative(record.text);
  for (const year of dateText.match(/(?:19|20)\d{2}/g) ?? []) {
    if (new RegExp(`\\b${year}\\b`, "u").test(narrativeNormalized)) {
      anchors.add(`date:${year}`);
    }
  }
  return anchors;
}

function validatedTwoTokenSourceFeatures(
  record: AssessmentNarrativeRecord,
) {
  const titleTokens = new Set(
    normalizedAssessmentNarrative(record.proposal.title)
      .split(" ")
      .filter(Boolean),
  );
  const evidenceIds = new Set(record.evidenceSourceIds);
  const sourceFeatures = new Set<string>();
  for (const source of record.proposal.sources) {
    if (!evidenceIds.has(source.id)) continue;
    for (const phrase of meaningfulFeaturePhrases(
      source.title,
      titleTokens,
    )) {
      sourceFeatures.add(phrase);
    }
  }
  const narrativeFeatures = meaningfulFeaturePhrases(
    record.text,
    new Set<string>(),
  );
  return new Set(
    [...sourceFeatures].filter((phrase) =>
      narrativeFeatures.has(phrase),
    ),
  );
}

function materiallyDistinctValidatedNarrativeAnchors(
  left: AssessmentNarrativeRecord,
  right: AssessmentNarrativeRecord,
) {
  const leftAnchors = validatedNarrativeAnchors(left);
  const rightAnchors = validatedNarrativeAnchors(right);
  const materialValue = (anchor: string) =>
    anchor.slice(anchor.indexOf(":") + 1);
  const leftValues = new Set([...leftAnchors].map(materialValue));
  const rightValues = new Set([...rightAnchors].map(materialValue));
  const leftDistinctValues = [...leftValues].filter(
    (anchor) => !rightValues.has(anchor),
  );
  const rightDistinctValues = [...rightValues].filter(
    (anchor) => !leftValues.has(anchor),
  );
  if (
    leftDistinctValues.length >= 2 &&
    rightDistinctValues.length >= 2
  ) {
    return true;
  }
  const leftSourceFeatures = validatedTwoTokenSourceFeatures(left);
  const rightSourceFeatures = validatedTwoTokenSourceFeatures(right);
  return (
    [...leftSourceFeatures].some(
      (feature) => !rightSourceFeatures.has(feature),
    ) &&
    [...rightSourceFeatures].some(
      (feature) => !leftSourceFeatures.has(feature),
    )
  );
}

function duplicateNarrativeError(
  current: AssessmentNarrativeRecord,
  prior: AssessmentNarrativeRecord,
) {
  if (current.field === "outcomeLink.text") {
    return `AI-interpreted proposals[${current.index}].outcomeLink.text duplicates the normalized outcome narrative for distinct candidate proposals[${prior.index}] (${prior.proposal.id}); write a candidate-specific outcome connection instead of reusing assessment text.`;
  }
  if (
    current.field ===
    "assessments.populationApplicability.reason"
  ) {
    return `AI-interpreted proposals[${current.index}].assessments.populationApplicability.reason duplicates the normalized coverage narrative for distinct candidate proposals[${prior.index}] (${prior.proposal.id}); write a candidate-specific coverage relation instead of reusing assessment text.`;
  }
  return `AI-interpreted proposals[${current.index}].${current.field} duplicates the normalized same-field narrative for distinct candidate proposals[${prior.index}] (${prior.proposal.id}).`;
}

function assertDistinctAssessmentNarratives(
  records: readonly AssessmentNarrativeRecord[],
) {
  const byField = new Map<string, AssessmentNarrativeRecord[]>();
  for (const record of records) {
    const peers = byField.get(record.field) ?? [];
    for (const prior of peers) {
      if (prior.proposal.id === record.proposal.id) continue;
      const normalized = normalizedAssessmentNarrative(record.text);
      const priorNormalized = normalizedAssessmentNarrative(prior.text);
      if (normalized === priorNormalized) {
        fail(duplicateNarrativeError(record, prior));
      }
      const skeleton = normalizedTitleSkeleton(
        record.proposal,
        record.text,
      );
      const priorSkeleton = normalizedTitleSkeleton(
        prior.proposal,
        prior.text,
      );
      if (skeleton === priorSkeleton) {
        fail(
          `AI-interpreted proposals[${record.index}].${record.field} reuses the exact candidate-title-normalized narrative skeleton from distinct candidate proposals[${prior.index}] (${prior.proposal.id}).`,
        );
      }
      const similarity = narrativeNgramSimilarity(
        skeleton,
        priorSkeleton,
      );
      if (
        similarity >= SCREEN02_NARRATIVE_UNCONDITIONAL_SIMILARITY
      ) {
        fail(
          `AI-interpreted proposals[${record.index}].${record.field} exceeds the unconditional 0.95 same-field narrative similarity ceiling relative to distinct candidate proposals[${prior.index}] (${prior.proposal.id}).`,
        );
      }
      if (
        similarity >= SCREEN02_NARRATIVE_GRAY_SIMILARITY &&
        !materiallyDistinctValidatedNarrativeAnchors(record, prior)
      ) {
        fail(
          `AI-interpreted proposals[${record.index}].${record.field} is high-similarity same-field boilerplate in the 0.86–0.95 gray band relative to distinct candidate proposals[${prior.index}] (${prior.proposal.id}); add at least two materially distinct validated anchors per narrative or distinct cited-source two-token features.`,
        );
      }
    }
    peers.push(record);
    byField.set(record.field, peers);
  }
}

function assertDistinctAssessmentDimensions(
  records: readonly AssessmentNarrativeRecord[],
) {
  const assessmentRecords = records.filter((record) =>
    record.field.startsWith("assessments."),
  );
  const byProposal = new Map<string, AssessmentNarrativeRecord[]>();
  for (const record of assessmentRecords) {
    const peers = byProposal.get(record.proposal.id) ?? [];
    for (const prior of peers) {
      const normalized = normalizedAssessmentNarrative(record.text);
      const priorNormalized = normalizedAssessmentNarrative(prior.text);
      const similarity = narrativeNgramSimilarity(
        normalized,
        priorNormalized,
      );
      if (
        normalized === priorNormalized ||
        similarity >= SCREEN02_NARRATIVE_UNCONDITIONAL_SIMILARITY
      ) {
        fail(
          `AI-interpreted proposals[${record.index}].${record.field} repeats the same assessment narrative used for ${prior.field}; explain each feasibility dimension with its own candidate-specific evidence and reasoning.`,
        );
      }
    }
    peers.push(record);
    byProposal.set(record.proposal.id, peers);
  }
}

function meaningfulFeaturePhrases(value: string, titleTokens: Set<string>) {
  const tokens = normalizedAssessmentNarrative(value).split(" ");
  const eligible = (token: string) =>
    token.length >= 5 &&
    !assessmentNarrativeStopwords.has(token) &&
    !titleTokens.has(token);
  const phrases = new Set<string>();
  for (let index = 0; index < tokens.length - 1; index += 1) {
    if (eligible(tokens[index]!) && eligible(tokens[index + 1]!)) {
      phrases.add(`${tokens[index]} ${tokens[index + 1]}`);
    }
  }
  return phrases;
}

function outcomeNamesSourceFeatureBeyondTitle(
  proposal: Screen02Proposal,
  narrative: string,
) {
  const titleTokens = new Set(
    normalizedAssessmentNarrative(proposal.title)
      .split(" ")
      .filter(Boolean),
  );
  const candidatePhrases = new Set<string>();
  for (const value of [
    proposal.description,
    ...proposal.sources.map((source) => source.title),
  ]) {
    for (const phrase of meaningfulFeaturePhrases(value, titleTokens)) {
      candidatePhrases.add(phrase);
    }
  }
  const narrativePhrases = meaningfulFeaturePhrases(
    narrative,
    new Set<string>(),
  );
  return [...candidatePhrases].some((phrase) =>
    narrativePhrases.has(phrase),
  );
}

function sourcePopulationGroundedInCitedEvidence(
  proposal: Screen02Proposal,
  sourcePopulation: { text: string; evidenceSourceIds: string[] },
) {
  const titleTokens = new Set(
    normalizedAssessmentNarrative(proposal.title)
      .split(" ")
      .filter(Boolean),
  );
  const eligibleTokens = (value: string) =>
    new Set(
      [...distinctiveAssessmentTokens(value)].filter(
        (token) => !titleTokens.has(token),
      ),
    );
  const citedSourceIds = new Set(sourcePopulation.evidenceSourceIds);
  const evidenceTokens = eligibleTokens(
    [
      proposal.description,
      ...proposal.sources
        .filter((source) => citedSourceIds.has(source.id))
        .map((source) => source.title),
    ].join(" "),
  );
  const populationTokens = eligibleTokens(sourcePopulation.text);
  const requiredOverlap = Math.min(2, populationTokens.size);
  if (requiredOverlap === 0) return false;
  let overlap = 0;
  for (const token of populationTokens) {
    if (evidenceTokens.has(token)) overlap += 1;
  }
  return overlap >= requiredOverlap;
}

function assertCompleteAiProposalAssessments(
  proposals: readonly Screen02Proposal[],
  baseline: DeepReadonly<Screen01StudyContext>,
  semanticDecisions: readonly Screen02SemanticDecision[],
) {
  const narrativeRecords: AssessmentNarrativeRecord[] = [];
  const retainedDecisionById = new Map(
    semanticDecisions
      .filter((decision) => decision.decision === "retained")
      .map((decision) => [decision.itemId, decision]),
  );
  const normalizedOutcomeFamily = normalizedAssessmentNarrative(
    baseline.scopeContract.outcomeFamily,
  );
  proposals.forEach((proposal, index) => {
    for (const key of screen02AiAssessmentKeys) {
      const assessment = proposal.assessments?.[key];
      if (!assessment) {
        fail(
          `AI-interpreted Screen 2 proposals require complete AI-rubric assessments for externalShockPlausibility, populationApplicability, outcomePathway, exposureObservability, timeSupport, and variation; proposals[${index}] is missing ${key}.`,
        );
      }
      if ((assessment.method ?? "ai-rubric") !== "ai-rubric") {
        fail(
          `AI-interpreted Screen 2 proposals require method ai-rubric for every assessment; proposals[${index}].assessments.${key} is not AI-rubric.`,
        );
      }
      if (
        typeof assessment.category !== "string" ||
        assessment.category.trim().length === 0
      ) {
        fail(
          `AI-interpreted Screen 2 proposals require a published rubric category for every assessment; proposals[${index}].assessments.${key}.category is missing.`,
        );
      }
      if (assessment.evidenceSourceIds === undefined) {
        fail(
          `AI-interpreted Screen 2 proposals must explicitly cite attached source ids; proposals[${index}].assessments.${key}.evidenceSourceIds is missing.`,
        );
      }
      if (
        !["unknown", "unclear"].includes(
          assessment.category.trim().toLocaleLowerCase("en-US"),
        ) &&
        assessment.evidenceSourceIds.length === 0
      ) {
        fail(
          `AI-interpreted Screen 2 proposals require source evidence for every known judgment; proposals[${index}].assessments.${key}.evidenceSourceIds is empty.`,
        );
      }
      if (
        ["unknown", "unclear"].includes(
          assessment.category.trim().toLocaleLowerCase("en-US"),
        ) &&
        !(assessment.unresolved ?? []).some(concreteUnresolvedTask)
      ) {
        fail(
          `AI-interpreted proposals[${index}].assessments.${key}.unresolved must include a concrete verification task for an unknown or unclear judgment.`,
        );
      }
      const reasonField = `assessments.${key}.reason`;
      assertCandidateGroundedAssessmentNarrative(
        proposal,
        index,
        reasonField,
        assessment.reason,
      );
      assertSubstantiveAssessmentNarrative(
        index,
        reasonField,
        assessment.reason,
      );
      narrativeRecords.push({
        proposal,
        index,
        field: reasonField,
        text: assessment.reason,
        evidenceSourceIds: assessment.evidenceSourceIds,
      });
    }
    const populationAssessment =
      proposal.assessments?.populationApplicability;
    if (
      !populationAssessment ||
      !Object.prototype.hasOwnProperty.call(
        populationAssessment,
        "sourceEstablishedPopulation",
      )
    ) {
      fail(
        `AI-interpreted proposals[${index}].assessments.populationApplicability.sourceEstablishedPopulation must be a cited population record or null when current sources do not establish one.`,
      );
    }
    const sourceEstablishedPopulation =
      populationAssessment.sourceEstablishedPopulation;
    if (sourceEstablishedPopulation === undefined) {
      fail(
        `AI-interpreted proposals[${index}].assessments.populationApplicability.sourceEstablishedPopulation must be explicit.`,
      );
    }
    if (
      sourceEstablishedPopulation === null &&
      populationAssessment.category !== "unknown"
    ) {
      fail(
        `AI-interpreted proposals[${index}].assessments.populationApplicability.sourceEstablishedPopulation may be null only when population applicability is unknown.`,
      );
    }
    if (sourceEstablishedPopulation !== null) {
      const sourcePopulationIds = sourceEstablishedPopulation.evidenceSourceIds;
      if (
        sourcePopulationIds.length === 0 ||
        new Set(sourcePopulationIds).size !== sourcePopulationIds.length ||
        sourcePopulationIds.some(
          (sourceId) =>
            !(populationAssessment.evidenceSourceIds ?? []).includes(sourceId),
        )
      ) {
        fail(
          `AI-interpreted proposals[${index}].assessments.populationApplicability.sourceEstablishedPopulation must cite unique attached source IDs also listed on populationApplicability.`,
        );
      }
      if (
        !sourcePopulationGroundedInCitedEvidence(
          proposal,
          sourceEstablishedPopulation,
        )
      ) {
        fail(
          `AI-interpreted proposals[${index}].assessments.populationApplicability.sourceEstablishedPopulation.text must share source-derived population terms with the cited candidate description or source title beyond the candidate title alone.`,
        );
      }
    }
    if (proposal.outcomeLink.status !== "ai-hypothesis") {
      fail(
        `AI-interpreted Screen 2 proposals require a candidate-specific, outcome-blind AI hypothesis; proposals[${index}].outcomeLink.status must be ai-hypothesis.`,
      );
    }
    if (proposal.reasons.length === 0) {
      fail(
        `AI-interpreted Screen 2 proposals require an item-specific explanation of why the candidate appears under the current scope and criteria; proposals[${index}].reasons is empty.`,
      );
    }
    const itemSpecificReason = proposal.reasons.find(
      (reason) =>
        proposalGroundsNarrative(proposal, reason) &&
        substantiveAssessmentNarrative(reason),
    );
    if (!itemSpecificReason) {
      fail(
        `AI-interpreted proposals[${index}].reasons must include at least one substantive candidate-grounded item-specific reason; native factual reasons may remain unchanged.`,
      );
    }
    narrativeRecords.push({
      proposal,
      index,
      field: "reasons.itemSpecific",
      text: itemSpecificReason,
      evidenceSourceIds: screen02AiAssessmentKeys.flatMap(
        (key) => proposal.assessments?.[key]?.evidenceSourceIds ?? [],
      ),
    });

    assertCandidateGroundedAssessmentNarrative(
      proposal,
      index,
      "outcomeLink.text",
      proposal.outcomeLink.text,
    );
    assertSubstantiveAssessmentNarrative(
      index,
      "outcomeLink.text",
      proposal.outcomeLink.text,
    );
    const normalizedOutcomeText = normalizedAssessmentNarrative(
      proposal.outcomeLink.text,
    );
    if (
      !normalizedOutcomeFamily ||
      !normalizedOutcomeText.includes(normalizedOutcomeFamily)
    ) {
      fail(
        `AI-interpreted proposals[${index}].outcomeLink.text must name the locked outcomeFamily exactly: ${JSON.stringify(baseline.scopeContract.outcomeFamily)}.`,
      );
    }
    if (
      !outcomeNamesSourceFeatureBeyondTitle(
        proposal,
        proposal.outcomeLink.text,
      )
    ) {
      fail(
        `AI-interpreted proposals[${index}].outcomeLink.text must name a contiguous two-token source-derived event feature phrase from the candidate description or attached source titles beyond the candidate title alone; a date by itself is not a mechanism.`,
      );
    }
    const outcomeEvidenceIds =
      proposal.assessments!.outcomePathway!.evidenceSourceIds ?? [];
    narrativeRecords.push({
      proposal,
      index,
      field: "outcomeLink.text",
      text: proposal.outcomeLink.text,
      evidenceSourceIds: outcomeEvidenceIds,
    });

    const decision = retainedDecisionById.get(proposal.id);
    // Semantic decisions account exactly for the native parent candidates.
    // A separately sourced host-discovery proposal has no native parent row,
    // so its candidate-specific proposal reason is the auditable fit rationale
    // and it must not receive a fabricated semantic decision.
    if (decision) {
      assertCandidateGroundedAssessmentNarrative(
        proposal,
        index,
        "semanticDecision.reason",
        decision.reason,
      );
      assertSubstantiveAssessmentNarrative(
        index,
        "semanticDecision.reason",
        decision.reason,
      );
      narrativeRecords.push({
        proposal,
        index,
        field: "semanticDecision.reason",
        text: decision.reason,
        evidenceSourceIds: screen02AiAssessmentKeys.flatMap(
          (key) => proposal.assessments?.[key]?.evidenceSourceIds ?? [],
        ),
      });
    }
  });
  assertDistinctAssessmentDimensions(narrativeRecords);
  assertDistinctAssessmentNarratives(narrativeRecords);
}

const componentCriteria = {
  scopeFit: [
    "Compare geography, study period, organizational population, and event family with the locked Screen 1 scope.",
    "A hard failure excludes the candidate before ranking.",
  ],
  sourceAuthority: [
    "Deduplicate source records before counting them.",
    "Apply the published six-tier authority policy to every located source.",
  ],
  exposureObservability: [
    "Assess whether the required exposure variable appears available.",
    "Assess whether it can be linked historically to the confirmed assignment or analysis unit and outcome frequency.",
  ],
  timeSupport: [
    "Compare provisional event timing with the locked study period and outcome frequency.",
    "Preserve uncertainty when the operative date remains unverified.",
  ],
  variation: [
    "Look for thresholds, staggered timing, jurisdictional differences, phases, intensity, or another plausible source of differential exposure.",
    "Do not treat likely variation as verified sample variation.",
  ],
} satisfies Record<keyof Screen02ComponentScores, string[]>;

const externalShockPlausibilityCriteria = [
  "Use only pre-outcome evidence to assess whether the event appears to originate outside focal organizations and their discretion.",
  "Identify anticipation, selection, reverse-causation, or confounding concerns. Do not claim established exogeneity.",
] as const;

const populationApplicabilityCriteria = [
  "Identify the population established by candidate sources. Compare documented eligibility, jurisdiction, implementation, and organizational coverage with the immutable native affected-population lead and locked Screen 1 population.",
  "Distinguish direct or conditional documented coverage, plausible indirect exposure, unlikely coverage, and unknown coverage. Preserve the native population fact.",
] as const;

const outcomePathwayCriteria = [
  "Identify a source-grounded event feature and its organizational channel to the locked outcome family. Do not inspect realized outcomes.",
  "Distinguish specific source-anchored pathways, conditional or indirect pathways, unclear pathways needing concrete verification, and evidence against a pathway.",
] as const;

function proposalExternalShockPlausibilityDetail(
  proposal: Screen02Proposal,
  sourceIds: string[],
): Screen02ExternalShockPlausibilityDetail | undefined {
  const assessment =
    proposal.assessments?.externalShockPlausibility;
  if (!assessment) return undefined;
  const category = assessment.category
    ?.trim()
    .toLocaleLowerCase("en-US");
  if (
    !category ||
    !screen02ExternalShockPlausibilityCategories.includes(
      category as (typeof screen02ExternalShockPlausibilityCategories)[number],
    )
  ) {
    fail(
      "externalShockPlausibility must use a published ordinal rubric category.",
    );
  }
  const evidenceSourceIds = assessment.evidenceSourceIds ?? [];
  const unknownEvidenceId = evidenceSourceIds.find(
    (id) => !sourceIds.includes(id),
  );
  if (unknownEvidenceId) {
    fail(
      `externalShockPlausibility cites a source that is not attached to the proposal: ${unknownEvidenceId}.`,
    );
  }
  if (category !== "unknown" && evidenceSourceIds.length === 0) {
    fail(
      "externalShockPlausibility cannot make a known judgment without source evidence.",
    );
  }
  const unresolved = assessment.unresolved ?? [];
  if (category === "unknown" && unresolved.length === 0) {
    fail(
      "An unknown externalShockPlausibility judgment must record at least one unresolved externality question.",
    );
  }
  return {
    method: "ai-rubric",
    category:
      category as Screen02ExternalShockPlausibilityDetail["category"],
    criteria: [...externalShockPlausibilityCriteria],
    evidenceSourceIds,
    reason: assessment.reason,
    confidence: assessment.confidence ?? "medium",
    unresolved,
    rubricVersion: SCREEN_02_EXTERNALITY_RUBRIC_VERSION,
  };
}

function proposalPopulationApplicabilityDetail(
  proposal: Screen02Proposal,
  sourceIds: string[],
): Screen02PopulationApplicabilityDetail | undefined {
  const assessment = proposal.assessments?.populationApplicability;
  if (!assessment) return undefined;
  const category = assessment.category
    ?.trim()
    .toLocaleLowerCase("en-US");
  if (
    !category ||
    !screen02PopulationApplicabilityCategories.includes(
      category as (typeof screen02PopulationApplicabilityCategories)[number],
    )
  ) {
    fail(
      "populationApplicability must use a published ordinal rubric category.",
    );
  }
  const evidenceSourceIds = assessment.evidenceSourceIds ?? [];
  const unknownEvidenceId = evidenceSourceIds.find(
    (id) => !sourceIds.includes(id),
  );
  if (unknownEvidenceId) {
    fail(
      `populationApplicability cites a source that is not attached to the proposal: ${unknownEvidenceId}.`,
    );
  }
  if (category !== "unknown" && evidenceSourceIds.length === 0) {
    fail(
      "populationApplicability cannot make a known judgment without source evidence.",
    );
  }
  const unresolved = assessment.unresolved ?? [];
  if (category === "unknown" && unresolved.length === 0) {
    fail(
      "An unknown populationApplicability judgment must record at least one unresolved coverage question.",
    );
  }
  if (
    !Object.prototype.hasOwnProperty.call(
      assessment,
      "sourceEstablishedPopulation",
    )
  ) {
    fail(
      "populationApplicability must provide sourceEstablishedPopulation as a cited record or null.",
    );
  }
  const sourceEstablishedPopulation = assessment.sourceEstablishedPopulation;
  if (sourceEstablishedPopulation === null && category !== "unknown") {
    fail(
      "Only an unknown populationApplicability judgment may use a null sourceEstablishedPopulation.",
    );
  }
  let sourcePopulationRecord: Screen02PopulationApplicabilityDetail["sourceEstablishedPopulation"] =
    null;
  if (sourceEstablishedPopulation !== null) {
    if (!isRecord(sourceEstablishedPopulation)) {
      fail(
        "populationApplicability.sourceEstablishedPopulation must be an object or null.",
      );
    }
    const text = String(sourceEstablishedPopulation.text ?? "").trim();
    const sourcePopulationEvidenceIds = Array.isArray(
      sourceEstablishedPopulation.evidenceSourceIds,
    )
      ? sourceEstablishedPopulation.evidenceSourceIds.filter(
          (sourceId): sourceId is string => typeof sourceId === "string",
        )
      : [];
    if (!text || sourcePopulationEvidenceIds.length === 0) {
      fail(
        "A source-established population record requires nonempty text and source evidence.",
      );
    }
    if (
      new Set(sourcePopulationEvidenceIds).size !==
        sourcePopulationEvidenceIds.length ||
      sourcePopulationEvidenceIds.some(
        (sourceId) =>
          !sourceIds.includes(sourceId) ||
          !evidenceSourceIds.includes(sourceId),
      )
    ) {
      fail(
        "populationApplicability.sourceEstablishedPopulation must cite unique attached source IDs also listed on populationApplicability.",
      );
    }
    sourcePopulationRecord = {
      text,
      evidenceSourceIds: [...sourcePopulationEvidenceIds],
    };
  }
  return {
    method: "ai-rubric",
    category:
      category as Screen02PopulationApplicabilityDetail["category"],
    criteria: [...populationApplicabilityCriteria],
    evidenceSourceIds,
    sourceEstablishedPopulation: sourcePopulationRecord,
    reason: assessment.reason,
    confidence: assessment.confidence ?? "medium",
    unresolved,
    rubricVersion: SCREEN_02_POPULATION_APPLICABILITY_RUBRIC_VERSION,
  };
}

function proposalOutcomePathwayDetail(
  proposal: Screen02Proposal,
  sourceIds: string[],
): Screen02OutcomePathwayDetail | undefined {
  const assessment = proposal.assessments?.outcomePathway;
  if (!assessment) return undefined;
  const category = assessment.category
    ?.trim()
    .toLocaleLowerCase("en-US");
  if (
    !category ||
    !screen02OutcomePathwayCategories.includes(
      category as (typeof screen02OutcomePathwayCategories)[number],
    )
  ) {
    fail(
      "outcomePathway must use a published ordinal rubric category.",
    );
  }
  const evidenceSourceIds = assessment.evidenceSourceIds ?? [];
  const unattachedEvidenceId = evidenceSourceIds.find(
    (id) => !sourceIds.includes(id),
  );
  if (unattachedEvidenceId) {
    fail(
      `outcomePathway cites a source that is not attached to the proposal: ${unattachedEvidenceId}.`,
    );
  }
  if (category !== "unclear" && evidenceSourceIds.length === 0) {
    fail(
      "outcomePathway cannot make a known judgment without source evidence.",
    );
  }
  const unresolved = assessment.unresolved ?? [];
  if (category === "unclear" && !unresolved.some(concreteUnresolvedTask)) {
    fail(
      "An unclear outcomePathway judgment must record at least one concrete unresolved pathway task.",
    );
  }
  return {
    method: "ai-rubric",
    category: category as Screen02OutcomePathwayDetail["category"],
    criteria: [...outcomePathwayCriteria],
    evidenceSourceIds,
    reason: assessment.reason,
    confidence: assessment.confidence ?? "medium",
    unresolved,
    rubricVersion: SCREEN_02_OUTCOME_PATHWAY_RUBRIC_VERSION,
  };
}

function proposalAssessmentDetail(
  key: "exposureObservability" | "timeSupport" | "variation",
  proposal: Screen02Proposal,
  sourceIds: string[],
): { score: number | null; detail: Screen02ComponentDetail } | null {
  const assessment = proposal.assessments?.[key];
  if (!assessment) return null;
  const category = assessment.category?.trim().toLocaleLowerCase("en-US");
  const categoryMap = rubricCategoryScores[key] as Record<
    string,
    number | null | undefined
  >;
  let score = category
    ? categoryMap[category] ?? null
    : assessment.value ?? null;
  if (score !== null) {
    assertScore(score, `${key} rubric result`);
    score = roundScore(score);
  }
  const evidenceSourceIds = assessment.evidenceSourceIds ?? sourceIds;
  const unknownEvidenceId = evidenceSourceIds.find(
    (id) => !sourceIds.includes(id),
  );
  if (unknownEvidenceId) {
    fail(
      `${key} assessment cites a source that is not attached to the proposal: ${unknownEvidenceId}.`,
    );
  }
  if (score !== null && evidenceSourceIds.length === 0) {
    fail(
      `${key} assessment cannot produce a known score without source evidence.`,
    );
  }
  return {
    score,
    detail: {
      method: assessment.method ?? "ai-rubric",
      category:
        category ||
        (score === null ? "unknown" : "researcher-numeric-assessment"),
      criteria: componentCriteria[key],
      evidenceSourceIds,
      reason: assessment.reason,
      confidence: assessment.confidence ?? "medium",
      unresolved: assessment.unresolved ?? [],
      rubricVersion: SCREEN_02_RUBRIC_VERSION,
    },
  };
}

function computeTimeSupport(
  proposal: Screen02Proposal,
  context: Screen01StudyContext | DeepReadonly<Screen01StudyContext>,
): { score: number; category: string; reason: string } | null {
  const period = studyPeriodYears(context.scopeContract.studyPeriod);
  const date =
    proposal.mode === "find"
      ? proposal.event.eventDate
      : proposal.provisionalDates[0];
  const eventYear = date ? yearFromDate(date) : null;
  if (!period || eventYear === null) return null;
  const [startYear, endYear] = period;
  const preYears = eventYear - startYear;
  const postYears = endYear - eventYear;
  if (preYears < 0 || postYears < 0) return null;
  const frequency = context.scopeContract.outcomeFrequency
    .toLocaleLowerCase("en-US");
  const frequencyConfig = frequency.includes("day")
    ? { multiplier: 365, label: "daily" }
    : frequency.includes("week")
      ? { multiplier: 52, label: "weekly" }
      : frequency.includes("month")
        ? { multiplier: 12, label: "monthly" }
        : frequency.includes("quarter")
          ? { multiplier: 4, label: "quarterly" }
          : frequency.includes("year") || frequency.includes("annual")
            ? { multiplier: 1, label: "annual" }
            : null;
  if (!frequencyConfig) return null;
  const { multiplier } = frequencyConfig;
  const prePeriods = preYears * multiplier;
  const postPeriods = postYears * multiplier;
  const ample = 3 * multiplier;
  const adequate = 2 * multiplier;
  const limited = 1 * multiplier;
  const result =
    prePeriods >= ample && postPeriods >= ample
      ? { score: 100, category: "ample" }
      : prePeriods >= adequate && postPeriods >= adequate
        ? { score: 80, category: "adequate" }
        : prePeriods >= limited && postPeriods >= limited
          ? { score: 55, category: "limited" }
          : { score: 25, category: "weak" };
  return {
    ...result,
    reason: `Fixed code identifies approximately ${prePeriods} pre-event and ${postPeriods} post-event ${frequencyConfig.label} periods inside the locked study window. The operative event date remains provisional until Screen 3.`,
  };
}

function componentInputs(
  proposal: Screen02Proposal,
  sources: Screen02Source[],
  sourceSummary: Screen02SourceSummary,
  hardFilters: Screen02HardFilterResult[],
  context: Screen01StudyContext | DeepReadonly<Screen01StudyContext>,
): {
  components: Screen02ComponentScores;
  reasons: Screen02ComponentReasons;
  details: Record<keyof Screen02ComponentScores, Screen02ComponentDetail>;
} {
  const unknownDetail = (
    key: keyof Screen02ComponentScores,
    reason: string,
  ): Screen02ComponentDetail => ({
    method: "system-computed",
    category: "unknown",
    criteria: componentCriteria[key],
    evidenceSourceIds: [],
    reason,
    confidence: "low",
    unresolved: ["Additional source-backed evidence is required."],
    rubricVersion: SCREEN_02_RUBRIC_VERSION,
  });
  if (sources.length === 0) {
    const reason =
      "Unknown: no located source supports assessment of this component. Reconnaissance is required.";
    return {
      components: emptyComponentScores(),
      reasons: emptyComponentReasons(reason),
      details: Object.fromEntries(
        screen02ScoreComponentKeys.map((key) => [
          key,
          unknownDetail(key, reason),
        ]),
      ) as Record<
        keyof Screen02ComponentScores,
        Screen02ComponentDetail
      >,
    };
  }

  const anyFail = hardFilters.some((filter) => filter.status === "fail");
  const boundaryPoints = hardFilters.map((filter) =>
    filter.status === "pass" ? 100 : filter.status === "review" ? 60 : 0,
  );
  const scopeFit =
    boundaryPoints.length === 0
      ? null
      : roundScore(
          boundaryPoints.reduce<number>(
            (sum, value) => sum + value,
            0,
          ) /
            boundaryPoints.length,
        );
  const components = emptyComponentScores();
  const reasons = emptyComponentReasons(
    "Unknown: the supplied evidence does not assess this component.",
  );
  const sourceIds = sources.map((source) => source.id);
  const details = Object.fromEntries(
    screen02ScoreComponentKeys.map((key) => [
      key,
      unknownDetail(key, reasons[key]),
    ]),
  ) as Record<
    keyof Screen02ComponentScores,
    Screen02ComponentDetail
  >;

  components.scopeFit = anyFail ? 0 : scopeFit;
  reasons.scopeFit = anyFail
    ? "At least one pre-specified scope filter fails."
    : scopeFit === 100
      ? "All four pre-specified scope filters pass."
      : "The candidate remains eligible for review, but at least one locked scope boundary needs confirmation.";
  details.scopeFit = {
    method: "system-computed",
    category: anyFail
      ? "hard-fail"
      : scopeFit === 100
        ? "all-boundaries-pass"
        : "manual-boundary-review",
    criteria: componentCriteria.scopeFit,
    evidenceSourceIds: sourceIds,
    reason: reasons.scopeFit,
    confidence: anyFail || scopeFit === 100 ? "high" : "medium",
    unresolved: scopeFit === 100 ? [] : ["One or more scope matches need review."],
    rubricVersion: SCREEN_02_RUBRIC_VERSION,
  };
  components.sourceAuthority = sourceSummary.authorityScore;
  reasons.sourceAuthority =
    sourceSummary.authorityScore === null
      ? "Unknown: no unique located source remains after deduplication."
      : `Derived from ${sourceSummary.uniqueSourceCount} unique located ${
          sourceSummary.uniqueSourceCount === 1 ? "source" : "sources"
        } across the six-tier authority scale.`;
  details.sourceAuthority = {
    method: "system-computed",
    category:
      sourceSummary.strongestAuthorityTier === null
        ? "unknown"
        : `strongest-tier-${sourceSummary.strongestAuthorityTier}`,
    criteria: componentCriteria.sourceAuthority,
    evidenceSourceIds: sourceIds,
    reason: reasons.sourceAuthority,
    confidence: sourceSummary.authorityScore === null ? "low" : "high",
    unresolved:
      sourceSummary.authorityScore === null
        ? ["No unique source remains after deduplication."]
        : [],
    rubricVersion: SCREEN_02_RUBRIC_VERSION,
  };

  for (const key of [
    "exposureObservability",
    "variation",
  ] as const) {
    const assessment = proposalAssessmentDetail(key, proposal, sourceIds);
    if (!assessment) continue;
    components[key] = assessment.score;
    reasons[key] = assessment.detail.reason;
    details[key] = assessment.detail;
  }
  const fixedTimeSupport = computeTimeSupport(proposal, context);
  const proposedTimeSupport = proposalAssessmentDetail(
    "timeSupport",
    proposal,
    sourceIds,
  );
  if (proposedTimeSupport) {
    components.timeSupport = proposedTimeSupport.score;
    reasons.timeSupport = proposedTimeSupport.detail.reason;
    details.timeSupport = proposedTimeSupport.detail;
  } else if (fixedTimeSupport) {
    components.timeSupport = fixedTimeSupport.score;
    reasons.timeSupport = fixedTimeSupport.reason;
    details.timeSupport = {
      method: "system-computed",
      category: fixedTimeSupport.category,
      criteria: componentCriteria.timeSupport,
      evidenceSourceIds: sourceIds,
      reason: fixedTimeSupport.reason,
      confidence: "medium",
      unresolved: ["Screen 3 must verify the operative event date."],
      rubricVersion: SCREEN_02_RUBRIC_VERSION,
    };
  }
  return { components, reasons, details };
}

function evidenceStatus(
  proposal: Screen02Proposal,
  sourceCount: number,
  scorecard: Screen02Scorecard,
): Screen02EvidenceStatus {
  if (
    proposal.mode === "find" &&
    proposal.fictionalDemo === true
  ) {
    return "fictional-demonstration";
  }
  if (sourceCount === 0) return "reconnaissance-required";
  return scorecard.coverage.knownComponents ===
    scorecard.coverage.totalComponents
    ? "assessed"
    : "partial";
}

const serviceLevelReadiness = {
  stop: 0,
  "event-reconnaissance": 1,
  "assisted-audit": 2,
  "full-audit": 3,
} as const;

function maximumServiceLevel(
  origin: Screen02Proposal["origin"],
  sourceSummary: Screen02SourceSummary,
  hardFilters: Screen02HardFilterResult[],
  scorecard: Screen02Scorecard,
) {
  if (origin === "fictional-demonstration") {
    return "stop" as const;
  }
  if (hardFilters.some((filter) => filter.status === "fail")) {
    return "stop" as const;
  }
  if (
    sourceSummary.uniqueSourceCount === 0 ||
    sourceSummary.strongestAuthorityTier === null ||
    sourceSummary.strongestAuthorityTier > 4
  ) {
    return "event-reconnaissance" as const;
  }
  if (
    scorecard.coverage.knownComponents ===
      scorecard.coverage.totalComponents &&
    scorecard.overall !== null &&
    scorecard.overall >= 70 &&
    sourceSummary.strongestAuthorityTier <= 2
  ) {
    return "full-audit" as const;
  }
  if (
    scorecard.coverage.knownComponents >= 3 &&
    scorecard.overall !== null &&
    scorecard.overall >= 50
  ) {
    return "assisted-audit" as const;
  }
  return "event-reconnaissance" as const;
}

function boundedServiceLevel(
  proposal: Screen02Proposal,
  sourceSummary: Screen02SourceSummary,
  hardFilters: Screen02HardFilterResult[],
  scorecard: Screen02Scorecard,
) {
  const maximum = maximumServiceLevel(
    proposal.origin,
    sourceSummary,
    hardFilters,
    scorecard,
  );
  return serviceLevelReadiness[proposal.likelyServiceLevel] <=
    serviceLevelReadiness[maximum]
    ? proposal.likelyServiceLevel
    : maximum;
}

function buildFindItem(
  proposal: Screen02FindProposal,
  context: Screen01StudyContext | DeepReadonly<Screen01StudyContext>,
): { item: Screen02FindItem | null; exclusions: Screen02ExclusionLog[] } {
  const hardFilters = evaluateFindHardFilters(proposal, context);
  const exclusions = hardFilters
    .filter((filter) => filter.status === "fail")
    .map((filter) => ({
      proposalId: proposal.id,
      filter: filter.key,
      reason: filter.reason,
    }));
  if (exclusions.length > 0) return { item: null, exclusions };

  const sources = deduplicateScreen02Sources(proposal.sources);
  const sourceSummary = summarizeScreen02Sources(sources);
  const inputs = componentInputs(
    proposal,
    sources,
    sourceSummary,
    hardFilters,
    context,
  );
  const scorecard = scoreScreen02Feasibility(
    inputs.components,
    inputs.reasons,
    inputs.details,
  );
  const externalShockPlausibility =
    proposalExternalShockPlausibilityDetail(
      proposal,
      sources.map((source) => source.id),
    );
  const populationApplicability =
    proposalPopulationApplicabilityDetail(
      proposal,
      sources.map((source) => source.id),
    );
  const outcomePathway = proposalOutcomePathwayDetail(
    proposal,
    sources.map((source) => source.id),
  );
  return {
    item: {
      id: proposal.id,
      mode: "find",
      kind: "event",
      ...(proposal.nativeIdentity
        ? { nativeIdentity: cloneJson(proposal.nativeIdentity) }
        : {}),
      title: proposal.title,
      description: proposal.description,
      origin: proposal.origin,
      provisionalDates: [...proposal.provisionalDates],
      affectedPopulation: proposal.affectedPopulation,
      requiredVariables: [...proposal.requiredVariables],
      outcomeLink: { ...proposal.outcomeLink },
      likelyServiceLevel: boundedServiceLevel(
        proposal,
        sourceSummary,
        hardFilters,
        scorecard,
      ),
      limitations: [...proposal.limitations],
      reasons: [...proposal.reasons],
      provisional: true,
      evidenceStatus: evidenceStatus(
        proposal,
        sources.length,
        scorecard,
      ),
      sources,
      sourceSummary,
      hardFilters,
      scorecard,
      ...(externalShockPlausibility
        ? { externalShockPlausibility }
        : {}),
      ...(populationApplicability
        ? { populationApplicability }
        : {}),
      ...(outcomePathway ? { outcomePathway } : {}),
      rank: 0,
      event: {
        displayName: proposal.event.displayName,
        eventDate: proposal.event.eventDate,
        eventFamily: proposal.event.eventFamily,
        geographies: [...proposal.event.geographies],
        populations: [...proposal.event.populations],
      },
    },
    exclusions,
  };
}

function buildAuditItem(
  proposal: Screen02AuditProposal,
  context: Screen01StudyContext | DeepReadonly<Screen01StudyContext>,
): Screen02AuditItem {
  const hardFilters = defaultAuditHardFilters(proposal, context);
  const sources = deduplicateScreen02Sources(proposal.sources);
  const sourceSummary = summarizeScreen02Sources(sources);
  const inputs = componentInputs(
    proposal,
    sources,
    sourceSummary,
    hardFilters,
    context,
  );
  const scorecard = scoreScreen02Feasibility(
    inputs.components,
    inputs.reasons,
    inputs.details,
  );
  const externalShockPlausibility =
    proposalExternalShockPlausibilityDetail(
      proposal,
      sources.map((source) => source.id),
    );
  const populationApplicability =
    proposalPopulationApplicabilityDetail(
      proposal,
      sources.map((source) => source.id),
    );
  const outcomePathway = proposalOutcomePathwayDetail(
    proposal,
    sources.map((source) => source.id),
  );
  return {
    id: proposal.id,
    mode: "audit",
    kind: "representation",
    representationType: proposal.representationType,
    anchorShock: context.knownShock,
    candidateConstruct: proposal.candidateConstruct,
    operationalization: proposal.operationalization,
    title: proposal.title,
    description: proposal.description,
    origin: proposal.origin,
    provisionalDates: [...proposal.provisionalDates],
    affectedPopulation: proposal.affectedPopulation,
    requiredVariables: [...proposal.requiredVariables],
    outcomeLink: { ...proposal.outcomeLink },
    likelyServiceLevel: boundedServiceLevel(
      proposal,
      sourceSummary,
      hardFilters,
      scorecard,
    ),
    limitations: [...proposal.limitations],
    reasons: [...proposal.reasons],
    provisional: true,
    evidenceStatus: evidenceStatus(proposal, sources.length, scorecard),
    sources,
    sourceSummary,
    hardFilters,
    scorecard,
    ...(externalShockPlausibility
      ? { externalShockPlausibility }
      : {}),
    ...(populationApplicability
      ? { populationApplicability }
      : {}),
    ...(outcomePathway ? { outcomePathway } : {}),
    rank: 0,
  };
}

function assertQueryLog(value: unknown, label: string): asserts value is Screen02QueryLog {
  assertRecord(value, label);
  assertExactKeys(
    value,
    ["id", "query", "purpose", "returnedRecordIds"],
    label,
  );
  assertString(value.id, `${label}.id`, 120);
  assertString(value.query, `${label}.query`, MAX_LONG_TEXT);
  assertString(value.purpose, `${label}.purpose`, MAX_LONG_TEXT);
  if (value.returnedRecordIds !== undefined) {
    assertStringList(
      value.returnedRecordIds,
      `${label}.returnedRecordIds`,
      { allowEmpty: true, maxText: 180, maxItems: 100 },
    );
  }
}

function assertChannelLog(
  value: unknown,
  label: string,
): asserts value is Screen02ChannelLog {
  assertRecord(value, label);
  assertExactKeys(
    value,
    ["channel", "status", "note", "retrievedAt"],
    label,
  );
  assertString(value.channel, `${label}.channel`, MAX_SHORT_TEXT);
  if (!["searched", "not-searched", "failed"].includes(String(value.status))) {
    fail(`${label}.status is invalid.`);
  }
  assertString(value.note, `${label}.note`, MAX_LONG_TEXT);
  if (value.retrievedAt !== undefined) {
    assertString(
      value.retrievedAt,
      `${label}.retrievedAt`,
      MAX_SHORT_TEXT,
    );
  }
}

function assertStoppingRule(
  value: unknown,
  label: string,
): asserts value is Screen02StoppingRule {
  assertRecord(value, label);
  assertExactKeys(value, ["rule", "status", "note"], label);
  assertString(value.rule, `${label}.rule`, MAX_LONG_TEXT);
  if (!["not-started", "met", "not-met"].includes(String(value.status))) {
    fail(`${label}.status is invalid.`);
  }
  assertString(value.note, `${label}.note`, MAX_LONG_TEXT);
}

function validateManifestSupplement(
  supplement: Screen02SearchManifestSupplement | undefined,
) {
  if (!supplement) return;
  if (!isRecord(supplement)) {
    fail("Search manifest supplement must be an object.");
  }
  assertExactKeys(
    supplement,
    ["queryMatrix", "channels", "stoppingRule"],
    "searchManifest",
  );
  if (supplement.queryMatrix !== undefined) {
    if (
      !Array.isArray(supplement.queryMatrix) ||
      supplement.queryMatrix.length > 30
    ) {
      fail("Search query matrix is too large.");
    }
    supplement.queryMatrix.forEach((query, index) =>
      assertQueryLog(query, `queryMatrix[${index}]`),
    );
  }
  if (supplement.channels !== undefined) {
    if (
      !Array.isArray(supplement.channels) ||
      supplement.channels.length > 20
    ) {
      fail("Search channel log is too large.");
    }
    supplement.channels.forEach((channel, index) =>
      assertChannelLog(channel, `channels[${index}]`),
    );
  }
  if (supplement.stoppingRule !== undefined) {
    assertStoppingRule(supplement.stoppingRule, "stoppingRule");
  }
}

function defaultQueryMatrix(
  context: Screen01StudyContext | DeepReadonly<Screen01StudyContext>,
): Screen02QueryLog[] {
  const scope = context.scopeContract;
  if (context.startingPoint === "find") {
    return [
      {
        id: "find-event",
        query: [
          scope.eventFamily,
          scope.geography,
          scope.population,
          scope.studyPeriod,
        ].join(" | "),
        purpose:
          "Locate named external events that can pass all four hard scope filters.",
      },
      {
        id: "find-assignment",
        query: [
          scope.eventFamily,
          scope.assignmentLevel,
          "eligibility assignment implementation",
        ].join(" | "),
        purpose:
          "Locate evidence about assignment, eligibility, timing, and implementation.",
      },
    ];
  }
  return [
    {
      id: "audit-primary",
      query: `${context.knownShock} | official primary source`,
      purpose:
        "Locate the controlling or official record for the exact named shock.",
    },
    {
      id: "audit-representations",
      query: `${context.knownShock} | eligibility assignment effective implementation enforcement exposure`,
      purpose:
        "Locate background, timing, applicability, and exposure leads for the exact named shock without selecting an empirical representation.",
    },
  ];
}

const deterministicCoreNoLiveSearchNote =
  "No live search was performed by the deterministic core.";

function defaultChannels(): Screen02ChannelLog[] {
  return [
    {
      channel: "official-primary",
      status: "not-searched",
      note: deterministicCoreNoLiveSearchNote,
    },
    {
      channel: "administrative-data",
      status: "not-searched",
      note: deterministicCoreNoLiveSearchNote,
    },
    {
      channel: "legal-policy",
      status: "not-searched",
      note: deterministicCoreNoLiveSearchNote,
    },
    {
      channel: "scholarly-research",
      status: "not-searched",
      note: deterministicCoreNoLiveSearchNote,
    },
    {
      channel: "credible-reporting",
      status: "not-searched",
      note: deterministicCoreNoLiveSearchNote,
    },
  ];
}

function manifestHardFilters(
  context: Screen01StudyContext | DeepReadonly<Screen01StudyContext>,
): Screen02ManifestHardFilter[] {
  return [
    { key: "geography", requiredValue: context.scopeContract.geography },
    { key: "studyPeriod", requiredValue: context.scopeContract.studyPeriod },
    { key: "population", requiredValue: context.scopeContract.population },
    { key: "eventFamily", requiredValue: context.scopeContract.eventFamily },
  ];
}

function coverageFor(
  proposalsReceived: number,
  items: Screen02Item[],
  stoppingRule: Screen02StoppingRule,
): Screen02SearchCoverage {
  const sources = deduplicateScreen02Sources(
    items.flatMap((item) => item.sources),
  );
  if (items.length === 0) {
    return {
      status: "no-results",
      proposalsReceived,
      itemsRetained: 0,
      uniqueSourcesLocated: 0,
      reason:
        "Potential options were not found under this protocol: no supplied proposal survived validation and the pre-specified hard filters. This is not evidence that no feasible shock exists.",
    };
  }
  if (sources.length === 0) {
    return {
      status: "reconnaissance",
      proposalsReceived,
      itemsRetained: items.length,
      uniqueSourcesLocated: 0,
      reason:
        "Items are visible for reconnaissance, but no located source supports feasibility scoring.",
    };
  }
  const allComponentsKnown = items.every(
    (item) =>
      item.scorecard.coverage.knownComponents ===
      item.scorecard.coverage.totalComponents,
  );
  if (allComponentsKnown && stoppingRule.status === "met") {
    return {
      status: "complete",
      proposalsReceived,
      itemsRetained: items.length,
      uniqueSourcesLocated: sources.length,
      reason:
        "Every retained item has all five score components and the documented stopping rule was met.",
    };
  }
  return {
    status: "partial",
    proposalsReceived,
    itemsRetained: items.length,
    uniqueSourcesLocated: sources.length,
    reason:
      "At least one source was located, but component or search coverage remains incomplete.",
  };
}

function rankItems(items: Screen02Item[]) {
  return [...items]
    .sort((a, b) => {
      if (a.scorecard.overall === null && b.scorecard.overall !== null) return 1;
      if (a.scorecard.overall !== null && b.scorecard.overall === null) return -1;
      if (
        a.scorecard.overall !== null &&
        b.scorecard.overall !== null &&
        a.scorecard.overall !== b.scorecard.overall
      ) {
        return b.scorecard.overall - a.scorecard.overall;
      }
      if (
        a.scorecard.overall === null &&
        b.scorecard.overall === null
      ) {
        const lowerBoundOrder =
          b.scorecard.overallRange.minimum -
          a.scorecard.overallRange.minimum;
        if (lowerBoundOrder !== 0) return lowerBoundOrder;
        const coverageOrder =
          b.scorecard.coverage.knownWeight -
          a.scorecard.coverage.knownWeight;
        if (coverageOrder !== 0) return coverageOrder;
        const upperBoundOrder =
          b.scorecard.overallRange.maximum -
          a.scorecard.overallRange.maximum;
        if (upperBoundOrder !== 0) return upperBoundOrder;
      }
      if (a.mode === "audit" && b.mode === "audit") {
        const representationOrder =
          screen02AuditRepresentationTypes.indexOf(a.representationType) -
          screen02AuditRepresentationTypes.indexOf(b.representationType);
        if (representationOrder !== 0) return representationOrder;
      }
      return a.id.localeCompare(b.id);
    })
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

function preserveItemOrder(items: Screen02Item[]) {
  return items.map((item, index) => ({ ...item, rank: index + 1 }));
}

export function assessScreen02Items(
  context: Screen01StudyContext,
  proposals: readonly Screen02Proposal[],
  searchManifestSupplement?: Screen02SearchManifestSupplement,
): Screen02AssessmentResult {
  const baseline = readyBaseline(context);
  if (
    !Array.isArray(proposals) ||
    proposals.length > SCREEN_02_MAX_PROPOSALS
  ) {
    screen2Fail(`accepts at most ${SCREEN_02_MAX_PROPOSALS} proposals per assessment.`,
    );
  }
  validateManifestSupplement(searchManifestSupplement);

  const ids = new Set<string>();
  let suppliedSourceCount = 0;
  proposals.forEach((proposal, index) => {
    assertProposal(proposal, baseline, index);
    if (ids.has(proposal.id)) {
      fail(`Duplicate Screen 2 proposal id: ${proposal.id}.`);
    }
    ids.add(proposal.id);
    suppliedSourceCount += proposal.sources.length;
  });
  if (suppliedSourceCount > SCREEN_02_MAX_TOTAL_SOURCES) {
    screen2Fail(`accepts at most ${SCREEN_02_MAX_TOTAL_SOURCES} supplied sources per assessment.`,
    );
  }

  const retained: Screen02Item[] = [];
  const exclusions: Screen02ExclusionLog[] = [];
  for (const proposal of proposals) {
    if (proposal.mode === "find") {
      const built = buildFindItem(proposal, baseline);
      exclusions.push(...built.exclusions);
      if (built.item) retained.push(built.item);
    } else {
      retained.push(buildAuditItem(proposal, baseline));
    }
  }
  const items = rankItems(retained);
  const stoppingRule = searchManifestSupplement?.stoppingRule
    ? cloneJson(searchManifestSupplement.stoppingRule)
    : {
        rule:
          "Stop only after the declared channels and query matrix are completed or a documented access limit prevents continuation.",
        status: "not-started" as const,
        note:
          "The deterministic core records candidates but does not perform a live source search.",
      };
  const searchManifest: Screen02SearchManifest = {
    queryMatrix: cloneJson(
      searchManifestSupplement?.queryMatrix ?? defaultQueryMatrix(baseline),
    ),
    channels: cloneJson(
      searchManifestSupplement?.channels ?? defaultChannels(),
    ),
    hardFilters: manifestHardFilters(baseline),
    exclusions,
    stoppingRule,
    coverage: coverageFor(proposals.length, items, stoppingRule),
    outcomeValuesInspected: false,
  };

  return cloneJson({ items, searchManifest });
}

function initialInteraction(
  proposalIds: string[],
  items: Screen02Item[],
  manifest: Screen02SearchManifest,
  discovery: Screen02SearchRound["discovery"],
) {
  const itemLedger = appendItemVersions([], items, 0);
  const round: Screen02SearchRound = {
    id: "round-000",
    revision: 0,
    requestType: "initial",
    stage: "initial",
    exactRequest: "Open Screen 2 using the locked Screen 1 baseline.",
    retrievedAt: "not-recorded",
    searchProtocolVersion: SCREEN_02_SEARCH_PROTOCOL_VERSION,
    preferenceCriteriaIds: [],
    proposalIdsReceived: [...proposalIds],
    itemIdsRetained: items.map((item) => item.id),
    itemIdsAdded: items.map((item) => item.id),
    duplicateProposalIds: [],
    rejectedItemIds: [],
    assessedItemVersionIds: itemLedger.versionIds,
    activeItemVersionIds: itemLedger.versionIds,
    discovery,
    manifest: cloneJson(manifest),
  };
  return {
    preferences: {
      version: SCREEN_02_PREFERENCE_VERSION,
      criteria: [],
      requests: [],
    },
    preferenceAssessments: [],
    pendingRequest: null,
    interactionRequestHistory: [],
    itemVersions: itemLedger.versions,
    searchRounds: [round],
    rejections: [],
    selectionHistory: [],
    deferredQuestions: [],
    pendingScopeRevision: null,
    downstreamInvalidationCount: 0,
  } as Screen02Session["interaction"];
}

function discoveryPreferencesFromCriteria(
  criteria: readonly Screen02PreferenceCriterion[],
) {
  return {
    require: criteria
      .filter((criterion) => criterion.kind === "require")
      .map((criterion) => criterion.text),
    prefer: criteria
      .filter((criterion) => criterion.kind === "prefer")
      .map((criterion) => criterion.text),
    avoid: criteria
      .filter((criterion) => criterion.kind === "avoid")
      .map((criterion) => criterion.text),
  };
}

function prepareScreen02Discovery(
  proposals: readonly Screen02Proposal[],
  context: Screen01StudyContext,
  criteria: readonly Screen02PreferenceCriterion[] = [],
  preserveProposalOrder = false,
) {
  if (
    !Array.isArray(proposals) ||
    proposals.length > SCREEN_02_MAX_PROPOSALS
  ) {
    screen2Fail(`accepts at most ${SCREEN_02_MAX_PROPOSALS} raw proposals per search round.`,
    );
  }
  const proposalIds = new Set<string>();
  let suppliedSourceCount = 0;
  proposals.forEach((proposal, index) => {
    assertProposal(proposal, context, index);
    if (proposalIds.has(proposal.id)) {
      fail(`Duplicate Screen 2 proposal id: ${proposal.id}.`);
    }
    proposalIds.add(proposal.id);
    suppliedSourceCount += proposal.sources.length;
  });
  if (suppliedSourceCount > SCREEN_02_MAX_TOTAL_SOURCES) {
    screen2Fail(`accepts at most ${SCREEN_02_MAX_TOTAL_SOURCES} supplied sources per search round.`,
    );
  }
  const deduplicated = deduplicateScreen02Proposals(proposals);
  const firstInputIndexByCluster = new Map<string, number>();
  proposals.forEach((proposal, index) => {
    const clusterId = deduplicated.membership[proposal.id];
    if (!clusterId) {
      screen2Fail(`could not recover the deduplication cluster for ${proposal.id}.`,
      );
    }
    if (!firstInputIndexByCluster.has(clusterId)) {
      firstInputIndexByCluster.set(clusterId, index);
    }
  });
  const proposalsInRequestedOrder = preserveProposalOrder
    ? [...deduplicated.proposals].sort((left, right) => {
        const leftClusterId = deduplicated.membership[left.id];
        const rightClusterId = deduplicated.membership[right.id];
        const leftIndex =
          leftClusterId === undefined
            ? Number.MAX_SAFE_INTEGER
            : (firstInputIndexByCluster.get(leftClusterId) ??
              Number.MAX_SAFE_INTEGER);
        const rightIndex =
          rightClusterId === undefined
            ? Number.MAX_SAFE_INTEGER
            : (firstInputIndexByCluster.get(rightClusterId) ??
              Number.MAX_SAFE_INTEGER);
        return leftIndex - rightIndex;
      })
    : deduplicated.proposals;
  const preferences = discoveryPreferencesFromCriteria(criteria);
  const lexicalRanked = rankScreen02ProposalsBm25(
    deduplicated.proposals,
    context,
    preferences,
  );
  const lexicalByProposalId = new Map(
    lexicalRanked.map((entry) => [entry.proposalId, entry]),
  );
  const ranked = preserveProposalOrder
    ? proposalsInRequestedOrder.map((proposal, index) => {
        const diagnostics = lexicalByProposalId.get(proposal.id);
        if (!diagnostics) {
          screen2Fail(`could not retain discovery diagnostics for ${proposal.id}.`,
          );
        }
        return {
          ...diagnostics,
          proposal,
          proposalId: proposal.id,
          rank: index + 1,
        };
      })
    : lexicalRanked;
  return {
    proposals: ranked.map((entry) => entry.proposal),
    duplicateProposalIds: deduplicated.duplicateProposalIds,
    discovery: {
      formulaVersion: SCREEN02_DISCOVERY_FORMULA_VERSION,
      query: buildScreen02DiscoveryQuery(context, preferences),
      rankings: ranked.map((entry) => ({
        proposalId: entry.proposalId,
        stableProposalId: entry.stableProposalId,
        rank: entry.rank,
        rankScore: entry.rankScore,
        matchedTerms: entry.diagnostics.matchedTerms,
      })),
      clusters: deduplicated.clusters.map((cluster) => ({
        clusterId: cluster.clusterId,
        canonicalProposalId: cluster.canonicalProposalId,
        memberProposalIds: cluster.memberProposalIds,
        duplicateProposalIds: cluster.duplicateProposalIds,
      })),
    } satisfies Screen02SearchRound["discovery"],
  };
}

function initialScreen02RunId(
  baseline: Screen01StudyContext | DeepReadonly<Screen01StudyContext>,
) {
  return `screen02-run-${fingerprintScreen01StudyContext(baseline).slice(
    "fnv1a64:".length,
  )}`;
}

export function createScreen02Session(
  context: Screen01StudyContext,
  runId?: string,
): Screen02Session {
  const baseline = readyBaseline(context);
  const resolvedRunId = runId ?? initialScreen02RunId(baseline);
  assertString(resolvedRunId, "Screen 2 run id", 120);
  // Both entry paths now begin with an empty, outcome-blind result set.
  // Find discovers candidate events; Audit resolves the researcher's exact
  // name to source-backed event matches. Empirical representations belong to
  // Screen 3 and must not appear here as unsupported default choices.
  const stoppingRule: Screen02StoppingRule = {
    rule:
      "Stop only after the declared channels and query matrix are completed or a documented access limit prevents continuation.",
    status: "not-started",
    note:
      "The deterministic core records candidates but does not perform a live source search.",
  };
  const assessment: Screen02AssessmentResult = cloneJson({
    items: [],
    searchManifest: {
      queryMatrix: defaultQueryMatrix(baseline),
      channels: defaultChannels(),
      hardFilters: manifestHardFilters(baseline),
      exclusions: [],
      stoppingRule,
      coverage: {
        status: "no-results",
        proposalsReceived: 0,
        itemsRetained: 0,
        uniqueSourcesLocated: 0,
        reason:
          "Potential options were not found under this protocol: no supplied proposal survived validation and the pre-specified hard filters. This is not evidence that no feasible shock exists.",
      },
      outcomeValuesInspected: false,
    },
  });
  const discovery: Screen02SearchRound["discovery"] = {
    formulaVersion: SCREEN02_DISCOVERY_FORMULA_VERSION,
    query: buildInitialScreen02DiscoveryQuery(baseline),
    rankings: [],
    clusters: [],
  };
  const session: Screen02Session = {
    schemaVersion: SCREEN_02_SESSION_SCHEMA_VERSION,
    sourceScreen: "screen-02",
    runId: resolvedRunId,
    mode: baseline.startingPoint,
    screen01Baseline: baseline,
    screen01Fingerprint: fingerprintScreen01StudyContext(baseline),
    revision: 0,
    items: assessment.items,
    selectedItemId: null,
    lockedChoice: null,
    searchManifest: assessment.searchManifest,
    interaction: initialInteraction(
      [],
      assessment.items,
      assessment.searchManifest,
      discovery,
    ),
  };
  return finalizeScreen02Mutation(
    session,
    baseline,
    "Creating Screen 2",
  );
}

export function restartScreen02Session(
  session: Screen02Session,
  nextRunId: string,
): Screen02Session {
  const safe = restoreScreen02Session(session);
  if (!safe) screen2Fail("session failed integrity validation.");
  assertString(nextRunId, "Screen 2 run id", 120);
  if (nextRunId === safe.runId) {
    fail("Restarting Screen 2 requires a new run id.");
  }
  const restarted = createScreen02Session(
    cloneJsonPreservingOrder(
      safe.screen01Baseline,
    ) as Screen01StudyContext,
    nextRunId,
  );
  if (
    !sameDeterministicJson(
      restarted.screen01Baseline,
      safe.screen01Baseline,
    )
  ) {
    fail(
      "Restarting Screen 2 changed the immutable Screen 1 baseline.",
    );
  }
  return restarted;
}

function assertStoredSourceSummary(
  value: unknown,
  sources: Screen02Source[],
  label: string,
): asserts value is Screen02SourceSummary {
  assertRecord(value, label);
  assertExactKeys(
    value,
    [
      "uniqueSourceCount",
      "byAuthorityTier",
      "strongestAuthorityTier",
      "authorityScore",
    ],
    label,
  );
  if (!isRecord(value.byAuthorityTier)) {
    fail(`${label}.byAuthorityTier must be an object.`);
  }
  assertExactKeys(
    value.byAuthorityTier,
    ["1", "2", "3", "4", "5", "6"],
    `${label}.byAuthorityTier`,
  );
  const derived = summarizeScreen02Sources(sources);
  if (serializeDeterministicJson(value) !== serializeDeterministicJson(derived)) {
    fail(`${label} does not match the deduplicated sources.`);
  }
}

function assertStoredExternalShockPlausibility(
  value: unknown,
  sources: Screen02Source[],
  label: string,
): asserts value is Screen02ExternalShockPlausibilityDetail {
  assertRecord(value, label);
  assertExactKeys(
    value,
    [
      "method",
      "category",
      "criteria",
      "evidenceSourceIds",
      "reason",
      "confidence",
      "unresolved",
      "rubricVersion",
    ],
    label,
  );
  if (
    value.method !== "ai-rubric" ||
    value.rubricVersion !== SCREEN_02_EXTERNALITY_RUBRIC_VERSION ||
    !screen02ExternalShockPlausibilityCategories.includes(
      value.category as (typeof screen02ExternalShockPlausibilityCategories)[number],
    ) ||
    !["low", "medium", "high"].includes(String(value.confidence))
  ) {
    fail(`${label} metadata is invalid.`);
  }
  assertString(value.reason, `${label}.reason`, MAX_LONG_TEXT);
  assertStringList(value.criteria, `${label}.criteria`, {
    maxText: MAX_LONG_TEXT,
  });
  if (
    serializeDeterministicJson(value.criteria) !==
    serializeDeterministicJson(externalShockPlausibilityCriteria)
  ) {
    fail(`${label} criteria changed.`);
  }
  assertStringList(
    value.evidenceSourceIds,
    `${label}.evidenceSourceIds`,
    {
      allowEmpty: true,
      maxText: 120,
      maxItems: SCREEN_02_MAX_SOURCES_PER_PROPOSAL,
    },
  );
  const evidenceSourceIds = value.evidenceSourceIds as string[];
  const attachedSourceIds = new Set(sources.map((source) => source.id));
  if (
    new Set(evidenceSourceIds).size !== evidenceSourceIds.length ||
    evidenceSourceIds.some((id) => !attachedSourceIds.has(id))
  ) {
    fail(`${label} cites duplicate or unattached evidence.`);
  }
  assertStringList(value.unresolved, `${label}.unresolved`, {
    allowEmpty: true,
    maxText: MAX_LONG_TEXT,
  });
  if (value.category === "unknown") {
    if ((value.unresolved as string[]).length === 0) {
      fail(`${label} must record an unresolved externality question.`);
    }
  } else if (evidenceSourceIds.length === 0) {
    fail(`${label} has a known judgment without supporting evidence.`);
  }
}

function assertStoredPopulationApplicability(
  value: unknown,
  sources: Screen02Source[],
  label: string,
): asserts value is Screen02PopulationApplicabilityDetail {
  assertRecord(value, label);
  assertExactKeys(
    value,
    [
      "method",
      "category",
      "criteria",
      "evidenceSourceIds",
      "sourceEstablishedPopulation",
      "reason",
      "confidence",
      "unresolved",
      "rubricVersion",
    ],
    label,
  );
  if (
    value.method !== "ai-rubric" ||
    value.rubricVersion !==
      SCREEN_02_POPULATION_APPLICABILITY_RUBRIC_VERSION ||
    !screen02PopulationApplicabilityCategories.includes(
      value.category as (typeof screen02PopulationApplicabilityCategories)[number],
    ) ||
    !["low", "medium", "high"].includes(String(value.confidence))
  ) {
    fail(`${label} metadata is invalid.`);
  }
  assertString(value.reason, `${label}.reason`, MAX_LONG_TEXT);
  if (value.sourceEstablishedPopulation !== null) {
    if (
      value.sourceEstablishedPopulation !== undefined &&
      !isRecord(value.sourceEstablishedPopulation)
    ) {
      fail(
        `${label}.sourceEstablishedPopulation must be an object or null.`,
      );
    }
    if (value.sourceEstablishedPopulation !== undefined) {
      assertExactKeys(
        value.sourceEstablishedPopulation,
        ["text", "evidenceSourceIds"],
        `${label}.sourceEstablishedPopulation`,
      );
      assertString(
        value.sourceEstablishedPopulation.text,
        `${label}.sourceEstablishedPopulation.text`,
        MAX_LONG_TEXT,
      );
      assertStringList(
        value.sourceEstablishedPopulation.evidenceSourceIds,
        `${label}.sourceEstablishedPopulation.evidenceSourceIds`,
        {
          maxText: 120,
          maxItems: SCREEN_02_MAX_SOURCES_PER_PROPOSAL,
        },
      );
    }
  }
  assertStringList(value.criteria, `${label}.criteria`, {
    maxText: MAX_LONG_TEXT,
  });
  if (
    serializeDeterministicJson(value.criteria) !==
    serializeDeterministicJson(populationApplicabilityCriteria)
  ) {
    fail(`${label} criteria changed.`);
  }
  assertStringList(
    value.evidenceSourceIds,
    `${label}.evidenceSourceIds`,
    {
      allowEmpty: true,
      maxText: 120,
      maxItems: SCREEN_02_MAX_SOURCES_PER_PROPOSAL,
    },
  );
  const evidenceSourceIds = value.evidenceSourceIds as string[];
  const attachedSourceIds = new Set(sources.map((source) => source.id));
  if (
    new Set(evidenceSourceIds).size !== evidenceSourceIds.length ||
    evidenceSourceIds.some((id) => !attachedSourceIds.has(id))
  ) {
    fail(`${label} cites duplicate or unattached evidence.`);
  }
  const sourceEstablishedPopulation = value.sourceEstablishedPopulation;
  if (sourceEstablishedPopulation === null) {
    if (value.category !== "unknown") {
      fail(
        `${label}.sourceEstablishedPopulation may be null only for an unknown applicability judgment.`,
      );
    }
  } else if (sourceEstablishedPopulation !== undefined) {
    const sourcePopulationIds =
      sourceEstablishedPopulation.evidenceSourceIds as string[];
    if (
      new Set(sourcePopulationIds).size !== sourcePopulationIds.length ||
      sourcePopulationIds.some(
        (id) =>
          !attachedSourceIds.has(id) || !evidenceSourceIds.includes(id),
      )
    ) {
      fail(
        `${label}.sourceEstablishedPopulation cites duplicate, unattached, or unrelated evidence.`,
      );
    }
  }
  assertStringList(value.unresolved, `${label}.unresolved`, {
    allowEmpty: true,
    maxText: MAX_LONG_TEXT,
  });
  if (value.category === "unknown") {
    if ((value.unresolved as string[]).length === 0) {
      fail(`${label} must record an unresolved coverage question.`);
    }
  } else if (evidenceSourceIds.length === 0) {
    fail(`${label} has a known judgment without supporting evidence.`);
  }
}

function assertStoredOutcomePathway(
  value: unknown,
  sources: Screen02Source[],
  label: string,
): asserts value is Screen02OutcomePathwayDetail {
  assertRecord(value, label);
  assertExactKeys(
    value,
    [
      "method",
      "category",
      "criteria",
      "evidenceSourceIds",
      "reason",
      "confidence",
      "unresolved",
      "rubricVersion",
    ],
    label,
  );
  if (
    value.method !== "ai-rubric" ||
    value.rubricVersion !== SCREEN_02_OUTCOME_PATHWAY_RUBRIC_VERSION ||
    !screen02OutcomePathwayCategories.includes(
      value.category as (typeof screen02OutcomePathwayCategories)[number],
    ) ||
    !["low", "medium", "high"].includes(String(value.confidence))
  ) {
    fail(`${label} metadata is invalid.`);
  }
  assertString(value.reason, `${label}.reason`, MAX_LONG_TEXT);
  assertStringList(value.criteria, `${label}.criteria`, {
    maxText: MAX_LONG_TEXT,
  });
  if (
    serializeDeterministicJson(value.criteria) !==
    serializeDeterministicJson(outcomePathwayCriteria)
  ) {
    fail(`${label} criteria changed.`);
  }
  assertStringList(
    value.evidenceSourceIds,
    `${label}.evidenceSourceIds`,
    {
      allowEmpty: true,
      maxText: 120,
      maxItems: SCREEN_02_MAX_SOURCES_PER_PROPOSAL,
    },
  );
  const evidenceSourceIds = value.evidenceSourceIds as string[];
  const attachedSourceIds = new Set(sources.map((source) => source.id));
  if (
    new Set(evidenceSourceIds).size !== evidenceSourceIds.length ||
    evidenceSourceIds.some((id) => !attachedSourceIds.has(id))
  ) {
    fail(`${label} cites duplicate or unattached evidence.`);
  }
  assertStringList(value.unresolved, `${label}.unresolved`, {
    allowEmpty: true,
    maxText: MAX_LONG_TEXT,
  });
  if (value.category === "unclear") {
    if (!(value.unresolved as string[]).some(concreteUnresolvedTask)) {
      fail(`${label} must record a concrete unresolved pathway task.`);
    }
  } else if (evidenceSourceIds.length === 0) {
    fail(`${label} has a known judgment without supporting evidence.`);
  }
}

function assertStoredScorecard(
  value: unknown,
  sourceSummary: Screen02SourceSummary,
  hardFilters: Screen02HardFilterResult[],
  sources: Screen02Source[],
  storedItem: Record<string, unknown>,
  baseline: DeepReadonly<Screen01StudyContext>,
  label: string,
): asserts value is Screen02Scorecard {
  assertRecord(value, label);
  assertExactKeys(
    value,
    [
      "formulaVersion",
      "components",
      "componentReasons",
      "componentDetails",
      "overall",
      "overallRange",
      "reason",
      "coverage",
    ],
    label,
  );
  if (value.formulaVersion !== SCREEN_02_SCORING_FORMULA_VERSION) {
    fail(`${label}.formulaVersion is invalid.`);
  }
  if (
    !isRecord(value.components) ||
    !isRecord(value.componentReasons) ||
    !isRecord(value.componentDetails)
  ) {
    fail(`${label} components are invalid.`);
  }
  assertExactKeys(
    value.components,
    screen02ScoreComponentKeys,
    `${label}.components`,
  );
  assertExactKeys(
    value.componentReasons,
    screen02ScoreComponentKeys,
    `${label}.componentReasons`,
  );
  assertExactKeys(
    value.componentDetails,
    screen02ScoreComponentKeys,
    `${label}.componentDetails`,
  );
  if (!isRecord(value.overallRange)) {
    fail(`${label}.overallRange must be an object.`);
  }
  assertExactKeys(
    value.overallRange,
    ["minimum", "maximum"],
    `${label}.overallRange`,
  );
  if (!isRecord(value.coverage)) {
    fail(`${label}.coverage must be an object.`);
  }
  assertExactKeys(
    value.coverage,
    [
      "knownComponents",
      "totalComponents",
      "knownWeight",
      "knownWeightPercent",
    ],
    `${label}.coverage`,
  );
  const components = {} as Screen02ComponentScores;
  const reasons = {} as Screen02ComponentReasons;
  const details = {} as Record<
    keyof Screen02ComponentScores,
    Screen02ComponentDetail
  >;
  for (const key of screen02ScoreComponentKeys) {
    const component = value.components[key];
    if (component !== null) assertScore(component, `${label}.${key}`);
    const reason = value.componentReasons[key];
    assertString(reason, `${label}.${key}.reason`, MAX_LONG_TEXT);
    components[key] = component as number | null;
    reasons[key] = reason;
    const detail = value.componentDetails[key];
    if (!isRecord(detail)) {
      fail(`${label}.${key}.detail must be an object.`);
    }
    assertExactKeys(
      detail,
      [
        "method",
        "category",
        "criteria",
        "evidenceSourceIds",
        "reason",
        "confidence",
        "unresolved",
        "rubricVersion",
      ],
      `${label}.${key}.detail`,
    );
    if (
      ![
        "system-computed",
        "ai-rubric",
        "researcher-specified",
      ].includes(String(detail.method)) ||
      !["low", "medium", "high"].includes(String(detail.confidence)) ||
      detail.rubricVersion !== SCREEN_02_RUBRIC_VERSION
    ) {
      fail(`${label}.${key}.detail metadata is invalid.`);
    }
    assertString(
      detail.category,
      `${label}.${key}.detail.category`,
      MAX_SHORT_TEXT,
    );
    assertString(
      detail.reason,
      `${label}.${key}.detail.reason`,
      MAX_LONG_TEXT,
    );
    assertStringList(
      detail.criteria,
      `${label}.${key}.detail.criteria`,
      { maxText: MAX_LONG_TEXT },
    );
    if (
      serializeDeterministicJson(detail.criteria) !==
      serializeDeterministicJson(componentCriteria[key])
    ) {
      fail(`${label}.${key}.detail criteria changed.`);
    }
    assertStringList(
      detail.evidenceSourceIds,
      `${label}.${key}.detail.evidenceSourceIds`,
      {
        allowEmpty: true,
        maxText: 120,
        maxItems: SCREEN_02_MAX_SOURCES_PER_PROPOSAL,
      },
    );
    const evidenceSourceIds = detail.evidenceSourceIds as string[];
    const attachedSourceIds = new Set(sources.map((source) => source.id));
    if (
      new Set(evidenceSourceIds).size !== evidenceSourceIds.length ||
      evidenceSourceIds.some((id) => !attachedSourceIds.has(id))
    ) {
      fail(
        `${label}.${key}.detail cites duplicate or unattached evidence.`,
      );
    }
    assertStringList(
      detail.unresolved,
      `${label}.${key}.detail.unresolved`,
      { allowEmpty: true, maxText: MAX_LONG_TEXT },
    );
    if (detail.reason !== reason) {
      fail(`${label}.${key}.detail reason does not match.`);
    }
    if (detail.method === "ai-rubric") {
      if (key === "scopeFit" || key === "sourceAuthority") {
        fail(`${label}.${key} cannot be AI-assigned.`);
      }
      const categoryMap = rubricCategoryScores[
        key as keyof typeof rubricCategoryScores
      ] as Record<string, number | null | undefined>;
      if (
        !Object.hasOwn(categoryMap, detail.category as string) ||
        categoryMap[detail.category as string] !== component
      ) {
        fail(
          `${label}.${key} contradicts its published AI rubric category.`,
        );
      }
      if (component !== null && evidenceSourceIds.length === 0) {
        fail(
          `${label}.${key} has a known AI score without supporting evidence.`,
        );
      }
    } else if (detail.method === "researcher-specified") {
      if (key === "scopeFit" || key === "sourceAuthority") {
        fail(`${label}.${key} cannot be researcher-assigned.`);
      }
      const categoryMap = rubricCategoryScores[
        key as keyof typeof rubricCategoryScores
      ] as Record<string, number | null | undefined>;
      if (
        Object.hasOwn(categoryMap, detail.category as string) &&
        categoryMap[detail.category as string] !== component
      ) {
        fail(
          `${label}.${key} contradicts its published rubric category.`,
        );
      }
      if (
        !Object.hasOwn(categoryMap, detail.category as string) &&
        detail.category !== "researcher-numeric-assessment"
      ) {
        fail(
          `${label}.${key} has an invalid researcher assessment category.`,
        );
      }
      if (component !== null && evidenceSourceIds.length === 0) {
        fail(
          `${label}.${key} has a known researcher score without supporting evidence.`,
        );
      }
    } else if (
      (key === "exposureObservability" || key === "variation") &&
      (component !== null || detail.category !== "unknown")
    ) {
      fail(
        `${label}.${key} cannot store a system-computed rubric judgment.`,
      );
    }
    details[key] = detail as Screen02ComponentDetail;
  }
  if (
    Object.keys(value.components).some(
      (key) => !scoreComponentKeySet.has(key),
    ) ||
    Object.keys(value.componentReasons).some(
      (key) => !scoreComponentKeySet.has(key),
    )
  ) {
    fail(`${label} contains an unknown score component.`);
  }
  if (
    sourceSummary.uniqueSourceCount === 0 &&
    screen02ScoreComponentKeys.some((key) => components[key] !== null)
  ) {
    fail(`${label} cannot score an item without located sources.`);
  }
  const expectedScopeFit =
    sourceSummary.uniqueSourceCount === 0
      ? null
      : hardFilters.some((filter) => filter.status === "fail")
        ? 0
        : roundScore(
            hardFilters.reduce(
              (sum, filter) =>
                sum + (filter.status === "pass" ? 100 : 60),
              0,
            ) / hardFilters.length,
          );
  if (
    components.scopeFit !== expectedScopeFit ||
    components.sourceAuthority !== sourceSummary.authorityScore
  ) {
    fail(
      `${label} contradicts its derived hard filters or source authority.`,
    );
  }
  const attachedSourceIds = sources.map((source) => source.id);
  const sameEvidenceIds = (valueIds: readonly string[]) =>
    valueIds.length === attachedSourceIds.length &&
    new Set(valueIds).size === valueIds.length &&
    valueIds.every((id) => attachedSourceIds.includes(id));
  const anyFail = hardFilters.some((filter) => filter.status === "fail");
  const expectedScopeCategory =
    sourceSummary.uniqueSourceCount === 0
      ? "unknown"
      : anyFail
        ? "hard-fail"
        : expectedScopeFit === 100
          ? "all-boundaries-pass"
          : "manual-boundary-review";
  const expectedAuthorityCategory =
    sourceSummary.strongestAuthorityTier === null
      ? "unknown"
      : `strongest-tier-${sourceSummary.strongestAuthorityTier}`;
  if (
    details.scopeFit.method !== "system-computed" ||
    details.scopeFit.category !== expectedScopeCategory ||
    !sameEvidenceIds(details.scopeFit.evidenceSourceIds) ||
    details.sourceAuthority.method !== "system-computed" ||
    details.sourceAuthority.category !== expectedAuthorityCategory ||
    !sameEvidenceIds(details.sourceAuthority.evidenceSourceIds)
  ) {
    fail(
      `${label} changed deterministic scope or source-authority provenance.`,
    );
  }
  if (details.timeSupport.method === "system-computed") {
    const fixedTimeSupport =
      sources.length === 0
        ? null
        : computeTimeSupport(
            storedItem as unknown as Screen02Proposal,
            baseline,
          );
    const expectedTimeScore = fixedTimeSupport?.score ?? null;
    const expectedTimeCategory = fixedTimeSupport?.category ?? "unknown";
    const expectedTimeEvidenceIds =
      fixedTimeSupport === null ? [] : attachedSourceIds;
    if (
      components.timeSupport !== expectedTimeScore ||
      details.timeSupport.category !== expectedTimeCategory ||
      (details.timeSupport.evidenceSourceIds.length !==
        expectedTimeEvidenceIds.length) ||
      !details.timeSupport.evidenceSourceIds.every((id) =>
        expectedTimeEvidenceIds.includes(id),
      ) ||
      (fixedTimeSupport !== null &&
        (details.timeSupport.reason !== fixedTimeSupport.reason ||
          reasons.timeSupport !== fixedTimeSupport.reason))
    ) {
      fail(
        `${label}.timeSupport changed its deterministic calculation.`,
      );
    }
  }
  const derived = scoreScreen02Feasibility(components, reasons, details);
  if (serializeDeterministicJson(value) !== serializeDeterministicJson(derived)) {
    fail(`${label} does not match the versioned scoring formula.`);
  }
}

function assertStoredHardFilters(
  value: unknown,
  label: string,
): asserts value is Screen02HardFilterResult[] {
  if (!Array.isArray(value) || value.length !== screen02HardFilterKeys.length) {
    fail(`${label} must contain exactly four hard filters.`);
  }
  const seen = new Set<string>();
  value.forEach((filter, index) => {
    assertHardFilter(
      filter,
      `${label}[${index}]`,
      screen02HardFilterKeys[index],
    );
    if (seen.has(filter.key)) {
      fail(`${label} contains a duplicate hard filter.`);
    }
    seen.add(filter.key);
  });
  if (screen02HardFilterKeys.some((key) => !seen.has(key))) {
    fail(`${label} is missing a hard filter.`);
  }
}

function assertStoredPreliminaryAssessment(
  value: unknown,
  sources: readonly Screen02Source[],
  label: string,
): asserts value is Screen02PreliminaryAssessment {
  assertRecord(value, label);
  assertExactKeys(
    value,
    [
      "schemaVersion",
      "method",
      "judgment",
      "studyFit",
      "affectedPopulation",
      "outcomeMechanism",
      "mainConcern",
      "evidenceSourceIds",
      "nextChecks",
      "rootNativeRoundId",
      "assessedAtRevision",
    ],
    label,
  );
  if (
    value.schemaVersion !==
      SCREEN_02_PRELIMINARY_ASSESSMENT_SCHEMA_VERSION ||
    value.method !== "ai-preliminary" ||
    !preliminaryAssessmentJudgmentSet.has(String(value.judgment))
  ) {
    fail(`${label} has invalid version, method, or judgment metadata.`);
  }
  assertString(value.studyFit, `${label}.studyFit`, 800);
  assertString(value.mainConcern, `${label}.mainConcern`, 800);
  if (
    (value.studyFit as string).trim().length < 30 ||
    (value.mainConcern as string).trim().length < 30
  ) {
    fail(`${label} narratives are not substantive enough.`);
  }
  if (value.affectedPopulation !== null) {
    assertString(
      value.affectedPopulation,
      `${label}.affectedPopulation`,
      800,
    );
  }
  if (value.outcomeMechanism !== null) {
    assertString(
      value.outcomeMechanism,
      `${label}.outcomeMechanism`,
      800,
    );
    if ((value.outcomeMechanism as string).trim().length < 30) {
      fail(`${label}.outcomeMechanism is not substantive enough.`);
    }
  }
  assertStringList(value.evidenceSourceIds, `${label}.evidenceSourceIds`, {
    allowEmpty: true,
    maxText: 120,
    maxItems: SCREEN_02_MAX_SOURCES_PER_PROPOSAL,
  });
  assertStringList(value.nextChecks, `${label}.nextChecks`, {
    maxText: 800,
    maxItems: 2,
  });
  assertString(value.rootNativeRoundId, `${label}.rootNativeRoundId`, 120);
  const evidenceSourceIds = value.evidenceSourceIds as string[];
  const sourceIds = new Set(sources.map((source) => source.id));
  if (
    new Set(evidenceSourceIds).size !== evidenceSourceIds.length ||
    !evidenceSourceIds.every((sourceId) => sourceIds.has(sourceId)) ||
    new Set(value.nextChecks as string[]).size !==
      (value.nextChecks as string[]).length ||
    (value.judgment !== "not-enough-evidence" &&
      evidenceSourceIds.length === 0) ||
    (value.judgment !== "not-enough-evidence" &&
      value.outcomeMechanism === null) ||
    !Number.isSafeInteger(value.assessedAtRevision) ||
    (value.assessedAtRevision as number) < 1
  ) {
    fail(`${label} is not source-grounded or internally consistent.`);
  }
}

function assertStoredItem(
  value: unknown,
  baseline: DeepReadonly<Screen01StudyContext>,
  index: number,
): asserts value is Screen02Item {
  const label = `items[${index}]`;
  assertRecord(value, label);
  const modeSpecificKeys =
    value.mode === "find"
      ? ["kind", "event", "nativeIdentity"]
      : value.mode === "audit"
        ? [
            "kind",
            "representationType",
            "anchorShock",
            "candidateConstruct",
            "operationalization",
          ]
        : [];
  assertExactKeys(
    value,
    [
      "id",
      "mode",
      "title",
      "description",
      "origin",
      "provisionalDates",
      "affectedPopulation",
      "requiredVariables",
      "outcomeLink",
      "likelyServiceLevel",
      "limitations",
      "reasons",
      "provisional",
      "evidenceStatus",
      "sources",
      "sourceSummary",
      "hardFilters",
      "scorecard",
      "externalShockPlausibility",
      "populationApplicability",
      "outcomePathway",
      "preliminaryAssessment",
      "rank",
      ...modeSpecificKeys,
    ],
    label,
  );
  assertString(value.id, `${label}.id`, 120);
  assertString(value.title, `${label}.title`, MAX_LONG_TEXT);
  assertString(value.description, `${label}.description`, MAX_LONG_TEXT);
  assertSharedCardFields(value, label);
  if (value.mode !== baseline.startingPoint || value.provisional !== true) {
    fail(`${label} violates the Screen 1 mode or provisional state.`);
  }
  if (
    ![
      "assessed",
      "partial",
      "reconnaissance-required",
      "fictional-demonstration",
    ].includes(String(value.evidenceStatus))
  ) {
    fail(`${label}.evidenceStatus is invalid.`);
  }
  if (
    !Number.isSafeInteger(value.rank) ||
    (value.rank as number) < 1 ||
    (value.rank as number) > SCREEN_02_MAX_CANDIDATE_ITEMS
  ) {
    fail(`${label}.rank is invalid.`);
  }
  if (
    !Array.isArray(value.sources) ||
    value.sources.length > SCREEN_02_MAX_SOURCES_PER_PROPOSAL
  ) {
    fail(`${label}.sources is invalid.`);
  }
  value.sources.forEach((source, sourceIndex) =>
    assertSource(source, `${label}.sources[${sourceIndex}]`),
  );
  const sources = value.sources as Screen02Source[];
  const deduplicated = deduplicateScreen02Sources(sources);
  if (
    serializeDeterministicJson(sources) !==
    serializeDeterministicJson(deduplicated)
  ) {
    fail(`${label}.sources were not stored in deduplicated form.`);
  }
  assertStoredSourceSummary(
    value.sourceSummary,
    sources,
    `${label}.sourceSummary`,
  );
  assertStoredHardFilters(value.hardFilters, `${label}.hardFilters`);
  assertStoredScorecard(
    value.scorecard,
    value.sourceSummary as Screen02SourceSummary,
    value.hardFilters as Screen02HardFilterResult[],
    sources,
    value,
    baseline,
    `${label}.scorecard`,
  );
  if (value.externalShockPlausibility !== undefined) {
    assertStoredExternalShockPlausibility(
      value.externalShockPlausibility,
      sources,
      `${label}.externalShockPlausibility`,
    );
  }
  if (value.populationApplicability !== undefined) {
    assertStoredPopulationApplicability(
      value.populationApplicability,
      sources,
      `${label}.populationApplicability`,
    );
  }
  if (value.outcomePathway !== undefined) {
    assertStoredOutcomePathway(
      value.outcomePathway,
      sources,
      `${label}.outcomePathway`,
    );
  }
  if (value.preliminaryAssessment !== undefined) {
    assertStoredPreliminaryAssessment(
      value.preliminaryAssessment,
      sources,
      `${label}.preliminaryAssessment`,
    );
  }
  const storedSummary = value.sourceSummary as Screen02SourceSummary;
  const storedFilters = value.hardFilters as Screen02HardFilterResult[];
  const storedScorecard = value.scorecard as Screen02Scorecard;
  const expectedEvidenceStatus =
    value.origin === "fictional-demonstration"
      ? "fictional-demonstration"
      : storedSummary.uniqueSourceCount === 0
        ? "reconnaissance-required"
        : storedScorecard.coverage.knownComponents ===
            storedScorecard.coverage.totalComponents
          ? "assessed"
          : "partial";
  if (value.evidenceStatus !== expectedEvidenceStatus) {
    fail(`${label}.evidenceStatus contradicts its evidence.`);
  }
  const maximumService = maximumServiceLevel(
    value.origin as Screen02Proposal["origin"],
    storedSummary,
    storedFilters,
    storedScorecard,
  );
  if (
    serviceLevelReadiness[
      value.likelyServiceLevel as keyof typeof serviceLevelReadiness
    ] > serviceLevelReadiness[maximumService]
  ) {
    fail(
      `${label}.likelyServiceLevel exceeds the derived evidence ceiling.`,
    );
  }

  if (baseline.startingPoint === "find") {
    if (value.kind !== "event" || !isRecord(value.event)) {
      fail(`${label} must be a Find event.`);
    }
    assertExactKeys(
      value.event,
      [
        "displayName",
        "eventDate",
        "eventFamily",
        "geographies",
        "populations",
      ],
      `${label}.event`,
    );
    assertString(
      value.event.displayName,
      `${label}.event.displayName`,
      MAX_LONG_TEXT,
    );
    assertString(
      value.event.eventDate,
      `${label}.event.eventDate`,
      MAX_SHORT_TEXT,
    );
    assertString(
      value.event.eventFamily,
      `${label}.event.eventFamily`,
      MAX_SHORT_TEXT,
    );
    assertStringList(
      value.event.geographies,
      `${label}.event.geographies`,
    );
    assertStringList(
      value.event.populations,
      `${label}.event.populations`,
    );
    if (value.nativeIdentity !== undefined) {
      if (!isRecord(value.nativeIdentity)) {
        fail(`${label}.nativeIdentity must be an object when supplied.`);
      }
      assertExactKeys(
        value.nativeIdentity,
        [
          "formalIdentifier",
          "issuer",
          "issuingJurisdiction",
          "status",
        ],
        `${label}.nativeIdentity`,
      );
      for (const key of [
        "formalIdentifier",
        "issuer",
        "issuingJurisdiction",
        "status",
      ] as const) {
        const nativeValue = value.nativeIdentity[key];
        if (nativeValue !== null) {
          assertString(
            nativeValue,
            `${label}.nativeIdentity.${key}`,
            MAX_SHORT_TEXT,
          );
        }
      }
    }
    const expectedHardFilters = evaluateFindHardFilters(
      value as unknown as Screen02FindProposal,
      baseline,
    );
    if (
      serializeDeterministicJson(value.hardFilters) !==
      serializeDeterministicJson(expectedHardFilters)
    ) {
      fail(`${label} changed a derived Find hard filter.`);
    }
    if (
      (value.hardFilters as Screen02HardFilterResult[]).some(
        (filter) => filter.status === "fail",
      )
    ) {
      fail(`${label} bypassed a Find hard filter.`);
    }
  } else {
    if (
      value.kind !== "representation" ||
      typeof value.representationType !== "string" ||
      !auditRepresentationTypeSet.has(value.representationType)
    ) {
      fail(`${label} must be an Audit representation.`);
    }
    if (value.anchorShock !== baseline.knownShock) {
      fail(`${label} changed the exact known-shock anchor.`);
    }
    assertString(
      value.candidateConstruct,
      `${label}.candidateConstruct`,
      MAX_LONG_TEXT,
    );
    assertString(
      value.operationalization,
      `${label}.operationalization`,
      MAX_LONG_TEXT,
    );
    if (
      !textAnchorsKnownShock(
        [
          value.title,
          value.description,
          value.candidateConstruct,
          value.operationalization,
        ].join(" "),
        baseline.knownShock,
      )
    ) {
      fail(`${label} changed the exact known-shock subject.`);
    }
  }
  const preliminaryAssessment = value.preliminaryAssessment as
    | Screen02PreliminaryAssessment
    | undefined;
  if (preliminaryAssessment?.outcomeMechanism) {
    assertPreliminaryOutcomeMechanism(
      value as unknown as Screen02Item,
      baseline.scopeContract.outcomeFamily,
      preliminaryAssessment.outcomeMechanism,
    );
  }
}

function assertStoredManifest(
  value: unknown,
  baseline: DeepReadonly<Screen01StudyContext>,
  items: Screen02Item[],
): asserts value is Screen02SearchManifest {
  if (!isRecord(value) || value.outcomeValuesInspected !== false) {
    storedFail("search manifest is invalid or claims outcome inspection.",
    );
  }
  assertExactKeys(
    value,
    [
      "queryMatrix",
      "channels",
      "hardFilters",
      "exclusions",
      "stoppingRule",
      "coverage",
      "outcomeValuesInspected",
    ],
    "searchManifest",
  );
  if (!Array.isArray(value.queryMatrix) || value.queryMatrix.length > 30) {
    storedFail("query matrix is invalid.");
  }
  value.queryMatrix.forEach((query, index) =>
    assertQueryLog(query, `searchManifest.queryMatrix[${index}]`),
  );
  if (!Array.isArray(value.channels) || value.channels.length > 20) {
    storedFail("channel log is invalid.");
  }
  value.channels.forEach((channel, index) =>
    assertChannelLog(channel, `searchManifest.channels[${index}]`),
  );
  if (!Array.isArray(value.hardFilters)) {
    storedFail("manifest hard filters are invalid.");
  }
  value.hardFilters.forEach((filter, index) => {
    if (!isRecord(filter)) {
      fail(`searchManifest.hardFilters[${index}] is invalid.`);
    }
    assertExactKeys(
      filter,
      ["key", "requiredValue"],
      `searchManifest.hardFilters[${index}]`,
    );
  });
  const expectedHardFilters = manifestHardFilters(baseline);
  if (
    serializeDeterministicJson(value.hardFilters) !==
    serializeDeterministicJson(expectedHardFilters)
  ) {
    storedFail("manifest changed a Screen 1 hard filter.");
  }
  if (
    !Array.isArray(value.exclusions) ||
    value.exclusions.length >
      SCREEN_02_MAX_PROPOSALS * SCREEN_02_MAX_SEARCH_ROUNDS * 4
  ) {
    storedFail("exclusion log is invalid.");
  }
  value.exclusions.forEach((entry, index) => {
    if (!isRecord(entry)) {
      fail(`searchManifest.exclusions[${index}] is invalid.`);
    }
    assertExactKeys(
      entry,
      ["proposalId", "filter", "reason"],
      `searchManifest.exclusions[${index}]`,
    );
    assertString(
      entry.proposalId,
      `searchManifest.exclusions[${index}].proposalId`,
      120,
    );
    if (
      typeof entry.filter !== "string" ||
      (entry.filter !== "validation" && !hardFilterKeySet.has(entry.filter))
    ) {
      fail(
        `searchManifest.exclusions[${index}].filter is invalid.`,
      );
    }
    assertString(
      entry.reason,
      `searchManifest.exclusions[${index}].reason`,
      MAX_LONG_TEXT,
    );
  });
  assertStoppingRule(value.stoppingRule, "searchManifest.stoppingRule");
  if (!isRecord(value.coverage)) {
    storedFail("coverage is invalid.");
  }
  assertExactKeys(
    value.coverage,
    [
      "status",
      "proposalsReceived",
      "itemsRetained",
      "uniqueSourcesLocated",
      "reason",
    ],
    "searchManifest.coverage",
  );
  if (
    !["no-results", "reconnaissance", "partial", "complete"].includes(
      String(value.coverage.status),
    ) ||
    !Number.isSafeInteger(value.coverage.proposalsReceived) ||
    !Number.isSafeInteger(value.coverage.itemsRetained) ||
    !Number.isSafeInteger(value.coverage.uniqueSourcesLocated) ||
    (value.coverage.proposalsReceived as number) < 0 ||
    (value.coverage.proposalsReceived as number) >
      SCREEN_02_MAX_PROPOSALS * SCREEN_02_MAX_SEARCH_ROUNDS ||
    (value.coverage.itemsRetained as number) < 0 ||
    (value.coverage.uniqueSourcesLocated as number) < 0
  ) {
    storedFail("coverage counts are invalid.");
  }
  assertString(
    value.coverage.reason,
    "searchManifest.coverage.reason",
    MAX_LONG_TEXT,
  );
  const sourceCount = deduplicateScreen02Sources(
    items.flatMap((item) => item.sources),
  ).length;
  if (
    value.coverage.itemsRetained !== items.length ||
    value.coverage.uniqueSourcesLocated !== sourceCount ||
    (items.length === 0 && value.coverage.status !== "no-results") ||
    (items.length > 0 &&
      sourceCount === 0 &&
      value.coverage.status !== "reconnaissance")
  ) {
    storedFail("coverage does not match retained Screen 2 data.");
  }
  const derivedCoverage = coverageFor(
    value.coverage.proposalsReceived as number,
    items,
    value.stoppingRule as Screen02StoppingRule,
  );
  if (
    serializeDeterministicJson(value.coverage) !==
    serializeDeterministicJson(derivedCoverage)
  ) {
    storedFail("coverage does not match the deterministic coverage rules.",
    );
  }
}

function assertStoredInteraction(
  value: unknown,
  baseline: DeepReadonly<Screen01StudyContext>,
  items: Screen02Item[],
  revision: number,
  selectedItemId: string | null,
  lockedChoice: unknown,
): asserts value is Screen02Session["interaction"] {
  if (!isRecord(value)) {
    storedFail("Screen 2 interaction state is invalid.");
  }
  assertExactKeys(
    value,
    [
      "preferences",
      "preferenceAssessments",
      "pendingRequest",
      "interactionRequestHistory",
      "itemVersions",
      "searchRounds",
      "rejections",
      "selectionHistory",
      "deferredQuestions",
      "pendingScopeRevision",
      "downstreamInvalidationCount",
    ],
    "interaction",
  );
  const itemIds = new Set(items.map((item) => item.id));
  if (
    !Array.isArray(value.itemVersions) ||
    (value.itemVersions.length === 0 && items.length > 0) ||
    value.itemVersions.length > SCREEN_02_MAX_ITEM_VERSIONS
  ) {
    storedFail("Screen 2 item-version ledger is invalid.");
  }
  const itemVersions = value.itemVersions as unknown[];
  const versionsById = new Map<string, Screen02ItemVersion>();
  const versionIdsByFingerprint = new Map<string, string>();
  itemVersions.forEach((entry, index) => {
    if (!isRecord(entry)) {
      fail(`interaction.itemVersions[${index}] is invalid.`);
    }
    assertExactKeys(
      entry,
      [
        "versionId",
        "itemId",
        "itemFingerprint",
        "recordedAtRevision",
        "item",
      ],
      `interaction.itemVersions[${index}]`,
    );
    assertString(
      entry.versionId,
      `interaction.itemVersions[${index}].versionId`,
      120,
    );
    assertString(
      entry.itemId,
      `interaction.itemVersions[${index}].itemId`,
      120,
    );
    assertString(
      entry.itemFingerprint,
      `interaction.itemVersions[${index}].itemFingerprint`,
      120,
    );
    if (
      !Number.isSafeInteger(entry.recordedAtRevision) ||
      (entry.recordedAtRevision as number) < 0 ||
      (entry.recordedAtRevision as number) > revision ||
      !isRecord(entry.item)
    ) {
      storedFail("item-version metadata is invalid.");
    }
    assertStoredItem(entry.item, baseline, index);
    const versionItem = entry.item as Screen02Item;
    const expectedFingerprint = itemVersionFingerprint(versionItem);
    const expectedVersionId = `item-version-${expectedFingerprint.replace(
      ":",
      "-",
    )}`;
    if (
      versionItem.rank !== 1 ||
      entry.itemId !== versionItem.id ||
      entry.itemFingerprint !== expectedFingerprint ||
      entry.versionId !== expectedVersionId ||
      versionsById.has(entry.versionId as string) ||
      versionIdsByFingerprint.has(entry.itemFingerprint as string)
    ) {
      storedFail("item-version content is inconsistent.");
    }
    versionsById.set(
      entry.versionId as string,
      entry as unknown as Screen02ItemVersion,
    );
    versionIdsByFingerprint.set(
      entry.itemFingerprint as string,
      entry.versionId as string,
    );
  });
  if (value.pendingRequest !== null) {
    if (!isRecord(value.pendingRequest)) {
      storedFail("pending interaction request is invalid.");
    }
    assertExactKeys(
      value.pendingRequest,
      [
        "id",
        "baseRevision",
        "expectedRevision",
        "requestType",
        "status",
        "exactText",
        "criteria",
      ],
      "interaction.pendingRequest",
    );
    assertString(
      value.pendingRequest.id,
      "interaction.pendingRequest.id",
      120,
    );
    assertString(
      value.pendingRequest.exactText,
      "interaction.pendingRequest.exactText",
      MAX_LONG_TEXT,
    );
    if (
      !Number.isSafeInteger(value.pendingRequest.baseRevision) ||
      value.pendingRequest.baseRevision !== revision ||
      !Number.isSafeInteger(value.pendingRequest.expectedRevision) ||
      value.pendingRequest.expectedRevision !== revision + 1 ||
      !["find-more", "refine", "none-fit"].includes(
        String(value.pendingRequest.requestType),
      ) ||
      !["sending", "awaiting-response"].includes(
        String(value.pendingRequest.status),
      ) ||
      !Array.isArray(value.pendingRequest.criteria) ||
      value.pendingRequest.criteria.length > SCREEN_02_MAX_PROPOSALS
    ) {
      storedFail("pending interaction metadata is invalid.");
    }
    value.pendingRequest.criteria.forEach((criterion, index) => {
      if (!isRecord(criterion)) {
        fail(
          `interaction.pendingRequest.criteria[${index}] is invalid.`,
        );
      }
      assertExactKeys(
        criterion,
        ["kind", "text"],
        `interaction.pendingRequest.criteria[${index}]`,
      );
      assertString(
        criterion.text,
        `interaction.pendingRequest.criteria[${index}].text`,
        MAX_LONG_TEXT,
      );
      if (!["require", "prefer", "avoid"].includes(String(criterion.kind))) {
        storedFail("pending interaction criterion is invalid.");
      }
    });
  }
  if (
    !Array.isArray(value.interactionRequestHistory) ||
    value.interactionRequestHistory.length > 100
  ) {
    storedFail("interaction-request history is invalid.");
  }
  let replayedPending: Screen02PendingInteractionRequest | null = null;
  let previousRequestEventRevision = -1;
  const requestIds = new Set<string>();
  value.interactionRequestHistory.forEach((event, index) => {
    if (!isRecord(event)) {
      fail(`interactionRequestHistory[${index}] is invalid.`);
    }
    assertExactKeys(
      event,
      [
        "id",
        "requestId",
        "revision",
        "action",
        "requestType",
        "exactText",
        "criteria",
        "error",
      ],
      `interactionRequestHistory[${index}]`,
    );
    assertString(event.id, `interactionRequestHistory[${index}].id`, 120);
    assertString(
      event.requestId,
      `interactionRequestHistory[${index}].requestId`,
      120,
    );
    assertString(
      event.exactText,
      `interactionRequestHistory[${index}].exactText`,
      MAX_LONG_TEXT,
    );
    if (
      event.id !==
        `interaction-event-${String(index + 1).padStart(3, "0")}` ||
      !Number.isSafeInteger(event.revision) ||
      (event.revision as number) < 0 ||
      (event.revision as number) > revision ||
      (event.revision as number) < previousRequestEventRevision ||
      !["recorded", "sent", "send-failed", "reconciled"].includes(
        String(event.action),
      ) ||
      !["find-more", "refine", "none-fit"].includes(
        String(event.requestType),
      ) ||
      !Array.isArray(event.criteria) ||
      event.criteria.length > SCREEN_02_MAX_PROPOSALS ||
      (event.error !== null && typeof event.error !== "string")
    ) {
      storedFail("interaction-request event metadata is invalid.");
    }
    previousRequestEventRevision = event.revision as number;
    if (event.error !== null) {
      assertString(
        event.error,
        `interactionRequestHistory[${index}].error`,
        MAX_LONG_TEXT,
      );
    }
    event.criteria.forEach((criterion, criterionIndex) => {
      if (!isRecord(criterion)) {
        storedFail("interaction-request criterion is invalid.");
      }
      assertExactKeys(
        criterion,
        ["kind", "text"],
        `interactionRequestHistory[${index}].criteria[${criterionIndex}]`,
      );
      assertString(
        criterion.text,
        `interactionRequestHistory[${index}].criteria[${criterionIndex}].text`,
        MAX_LONG_TEXT,
      );
      if (!["require", "prefer", "avoid"].includes(String(criterion.kind))) {
        storedFail("interaction-request criterion is invalid.");
      }
    });
    const eventRequest = {
      id: event.requestId as string,
      baseRevision: event.revision as number,
      expectedRevision: (event.revision as number) + 1,
      requestType:
        event.requestType as Screen02PendingInteractionRequest["requestType"],
      status: "sending" as const,
      exactText: event.exactText as string,
      criteria: cloneJson(
        event.criteria,
      ) as Screen02PendingInteractionRequest["criteria"],
    };
    const eventMatchesPending = (
      pending: Screen02PendingInteractionRequest,
    ) =>
      pending.id === event.requestId &&
      pending.requestType === event.requestType &&
      pending.exactText === event.exactText &&
      serializeDeterministicJson(pending.criteria) ===
        serializeDeterministicJson(event.criteria);
    if (event.action === "recorded") {
      if (
        replayedPending !== null ||
        requestIds.has(event.requestId as string) ||
        event.error !== null
      ) {
        storedFail("interaction request was recorded out of order.");
      }
      requestIds.add(event.requestId as string);
      replayedPending = eventRequest;
    } else {
      if (
        replayedPending === null ||
        !eventMatchesPending(replayedPending)
      ) {
        storedFail("interaction-request event does not match its recorded request.",
        );
      }
      if (event.action === "sent") {
        if (
          replayedPending.status !== "sending" ||
          event.error !== null ||
          event.revision !== replayedPending.baseRevision
        ) {
          storedFail("sent event is out of order.");
        }
        replayedPending = {
          ...replayedPending,
          status: "awaiting-response",
        };
      } else if (event.action === "send-failed") {
        if (
          event.error === null ||
          event.revision !== replayedPending.baseRevision
        ) {
          storedFail("send-failed event is invalid.");
        }
        replayedPending = null;
      } else {
        if (
          event.error !== null ||
          event.revision !== replayedPending.expectedRevision
        ) {
          storedFail("reconciled event is invalid.");
        }
        replayedPending = null;
      }
    }
  });
  if (
    serializeDeterministicJson(replayedPending) !==
    serializeDeterministicJson(value.pendingRequest)
  ) {
    storedFail("pending interaction request does not match its append-only event history.",
    );
  }
  if (!isRecord(value.preferences)) {
    storedFail("preference set is invalid.");
  }
  assertExactKeys(
    value.preferences,
    ["version", "criteria", "requests"],
    "interaction.preferences",
  );
  if (
    value.preferences.version !== SCREEN_02_PREFERENCE_VERSION ||
    !Array.isArray(value.preferences.criteria) ||
    !Array.isArray(value.preferences.requests) ||
    value.preferences.criteria.length >
      SCREEN_02_MAX_PREFERENCE_CRITERIA ||
    value.preferences.requests.length > SCREEN_02_MAX_SEARCH_ROUNDS
  ) {
    storedFail("preference set exceeds its versioned limits.");
  }
  const criterionIds = new Set<string>();
  const criterionKinds = new Map<string, string>();
  value.preferences.criteria.forEach((criterion, index) => {
    if (!isRecord(criterion)) {
      fail(`interaction.preferences.criteria[${index}] is invalid.`);
    }
    assertExactKeys(
      criterion,
      ["id", "kind", "text", "source", "exactRequest"],
      `interaction.preferences.criteria[${index}]`,
    );
    assertString(
      criterion.id,
      `interaction.preferences.criteria[${index}].id`,
      120,
    );
    assertString(
      criterion.text,
      `interaction.preferences.criteria[${index}].text`,
      MAX_LONG_TEXT,
    );
    assertString(
      criterion.exactRequest,
      `interaction.preferences.criteria[${index}].exactRequest`,
      MAX_LONG_TEXT,
    );
    if (
      !["require", "prefer", "avoid"].includes(String(criterion.kind)) ||
      !["researcher", "ai-interpretation"].includes(
        String(criterion.source),
      ) ||
      criterionIds.has(criterion.id as string)
    ) {
      storedFail("preference criterion metadata is invalid.");
    }
    criterionIds.add(criterion.id as string);
    criterionKinds.set(
      criterion.id as string,
      criterion.kind as string,
    );
  });
  const preferenceRequestIds = new Set<string>();
  value.preferences.requests.forEach((request, index) => {
    if (!isRecord(request)) {
      fail(`interaction.preferences.requests[${index}] is invalid.`);
    }
    assertExactKeys(
      request,
      ["id", "exactText", "criteriaIds", "interpretationSource"],
      `interaction.preferences.requests[${index}]`,
    );
    assertString(
      request.id,
      `interaction.preferences.requests[${index}].id`,
      120,
    );
    assertString(
      request.exactText,
      `interaction.preferences.requests[${index}].exactText`,
      MAX_LONG_TEXT,
    );
    assertStringList(
      request.criteriaIds,
      `interaction.preferences.requests[${index}].criteriaIds`,
      { allowEmpty: true, maxText: 120, maxItems: 40 },
    );
    if (
      !(request.criteriaIds as string[]).every((id) =>
        criterionIds.has(id),
      ) ||
      preferenceRequestIds.has(request.id as string) ||
      !["researcher-structured", "ai-interpretation"].includes(
        String(request.interpretationSource),
      )
    ) {
      storedFail("preference request metadata is invalid.");
    }
    preferenceRequestIds.add(request.id as string);
  });
  if (
    !Array.isArray(value.preferenceAssessments) ||
    value.preferenceAssessments.length > SCREEN_02_MAX_PROPOSALS
  ) {
    storedFail("preference assessments are invalid.");
  }
  const assessedPreferenceItemIds = new Set<string>();
  value.preferenceAssessments.forEach((assessment, index) => {
    if (!isRecord(assessment)) {
      fail(`preferenceAssessments[${index}] is invalid.`);
    }
    assertExactKeys(
      assessment,
      [
        "itemId",
        "score",
        "matchedCriteriaIds",
        "unmetRequiredCriteriaIds",
        "reasons",
        "computedAtRevision",
      ],
      `preferenceAssessments[${index}]`,
    );
    if (
      !itemIds.has(String(assessment.itemId)) ||
      assessedPreferenceItemIds.has(String(assessment.itemId))
    ) {
      fail("Preference assessment points to an unknown item.");
    }
    assessedPreferenceItemIds.add(String(assessment.itemId));
    if (assessment.score !== null) {
      assertScore(assessment.score, `preferenceAssessments[${index}].score`);
    }
    for (const key of [
      "matchedCriteriaIds",
      "unmetRequiredCriteriaIds",
    ] as const) {
      assertStringList(
        assessment[key],
        `preferenceAssessments[${index}].${key}`,
        { allowEmpty: true, maxText: 120, maxItems: 40 },
      );
      if (
        !(assessment[key] as string[]).every((id) =>
          criterionIds.has(id),
        )
      ) {
        fail(
          `preferenceAssessments[${index}].${key} references an unknown criterion.`,
        );
      }
    }
    assertStringList(
      assessment.reasons,
      `preferenceAssessments[${index}].reasons`,
      { allowEmpty: true, maxText: MAX_LONG_TEXT },
    );
    if (
      !Number.isSafeInteger(assessment.computedAtRevision) ||
      (assessment.computedAtRevision as number) < 0 ||
      (assessment.computedAtRevision as number) > revision
    ) {
      fail("Preference assessment revision is invalid.");
    }
  });
  if (
    !Array.isArray(value.searchRounds) ||
    value.searchRounds.length === 0 ||
    value.searchRounds.length > SCREEN_02_MAX_SEARCH_ROUNDS
  ) {
    storedFail("search-round history is invalid.");
  }
  const roundIds = new Set<string>();
  const referencedVersionIds = new Set<string>();
  const firstVersionReferenceRevision = new Map<string, number>();
  const registeredPreliminaryAssessments = new Set<string>();
  const preliminaryAssessmentRoundCounts = new Map<string, number>();
  const mutationRevisions = new Set<number>([0]);
  let previousRoundRevision = -1;
  let finalActiveItems: Screen02Item[] = [];
  value.searchRounds.forEach((round, index) => {
    if (!isRecord(round)) {
      fail(`interaction.searchRounds[${index}] is invalid.`);
    }
    assertExactKeys(
      round,
      [
        "id",
        "revision",
        "requestType",
        "stage",
        "exactRequest",
        "retrievedAt",
        "searchProtocolVersion",
        "preferenceCriteriaIds",
        "proposalIdsReceived",
        "itemIdsRetained",
        "itemIdsAdded",
        "duplicateProposalIds",
        "rejectedItemIds",
        "assessedItemVersionIds",
        "activeItemVersionIds",
        "parentRoundId",
        "semanticDecisions",
        "assessmentParentRoundId",
        "rootNativeRoundId",
        "assessmentResults",
        "shockEvidence",
        "discovery",
        "manifest",
      ],
      `interaction.searchRounds[${index}]`,
    );
    assertString(round.id, `interaction.searchRounds[${index}].id`, 120);
    assertString(
      round.exactRequest,
      `interaction.searchRounds[${index}].exactRequest`,
      MAX_LONG_TEXT,
    );
    assertString(
      round.retrievedAt,
      `interaction.searchRounds[${index}].retrievedAt`,
      MAX_SHORT_TEXT,
    );
    if (
      round.searchProtocolVersion !==
        SCREEN_02_SEARCH_PROTOCOL_VERSION ||
      ![
        "initial",
        "find-more",
        "refine",
        "none-fit",
        "user-source",
      ].includes(String(round.requestType)) ||
      !Number.isSafeInteger(round.revision) ||
      (round.revision as number) < 0 ||
      (round.revision as number) > revision ||
      roundIds.has(round.id as string) ||
      round.id !== `round-${String(index).padStart(3, "0")}` ||
      (round.stage !== undefined &&
        ![
          "initial",
          "native-retrieval",
          "ai-review",
          "preliminary-assessment",
          "researcher-assessment",
        ].includes(String(round.stage))) ||
      (index === 0
        ? round.requestType !== "initial" ||
          round.revision !== 0 ||
          (round.stage !== undefined &&
            round.stage !== "initial")
        : round.requestType === "initial" ||
          round.stage === "initial" ||
          (round.revision as number) <= previousRoundRevision)
    ) {
      storedFail("search-round metadata is invalid.");
    }
    roundIds.add(round.id as string);
    previousRoundRevision = round.revision as number;
    mutationRevisions.add(round.revision as number);
    for (const key of [
      "preferenceCriteriaIds",
      "proposalIdsReceived",
      "itemIdsRetained",
      "itemIdsAdded",
      "duplicateProposalIds",
      "rejectedItemIds",
      "assessedItemVersionIds",
      "activeItemVersionIds",
    ] as const) {
      assertStringList(
        round[key],
        `interaction.searchRounds[${index}].${key}`,
        {
          allowEmpty: true,
          maxText: 180,
          maxItems:
            key === "activeItemVersionIds"
              ? SCREEN_02_MAX_CANDIDATE_ITEMS
              : SCREEN_02_MAX_PROPOSALS,
        },
      );
      if (
        new Set(round[key] as string[]).size !==
        (round[key] as string[]).length
      ) {
        fail(
          `interaction.searchRounds[${index}].${key} contains duplicates.`,
        );
      }
    }
    if (
      !(round.preferenceCriteriaIds as string[]).every((id) =>
        criterionIds.has(id),
      )
    ) {
      fail(
        `interaction.searchRounds[${index}] references an unknown preference criterion.`,
      );
    }
    const hasParentRoundId = round.parentRoundId !== undefined;
    const hasSemanticDecisions =
      round.semanticDecisions !== undefined;
    if (hasParentRoundId !== hasSemanticDecisions) {
      fail(
        `interaction.searchRounds[${index}] has an incomplete semantic-review record.`,
      );
    }
    if (
      (hasParentRoundId && round.stage !== "ai-review") ||
      (!hasParentRoundId && round.stage === "ai-review")
    ) {
      fail(
        `interaction.searchRounds[${index}] has an invalid AI-review stage.`,
      );
    }
    if (hasParentRoundId) {
      const previousRound = (value.searchRounds as unknown[])[
        index - 1
      ];
      if (
        index === 0 ||
        !isRecord(previousRound) ||
        round.parentRoundId !== previousRound.id ||
        previousRound.stage !== "native-retrieval" ||
        previousRound.parentRoundId !== undefined ||
        previousRound.requestType === "initial" ||
        !Array.isArray(previousRound.itemIdsRetained) ||
        !Array.isArray(previousRound.preferenceCriteriaIds) ||
        serializeDeterministicJson(
          round.preferenceCriteriaIds,
        ) !==
          serializeDeterministicJson(
            previousRound.preferenceCriteriaIds,
          ) ||
        !Array.isArray(round.semanticDecisions) ||
        round.semanticDecisions.length !==
          previousRound.itemIdsRetained.length
      ) {
        fail(
          `interaction.searchRounds[${index}] does not identify a valid parent native round.`,
        );
      }
      const parentItemIds = new Set(
        previousRound.itemIdsRetained as string[],
      );
      const parentCriterionIds = new Set(
        previousRound.preferenceCriteriaIds as string[],
      );
      const proposalIds = new Set(
        round.proposalIdsReceived as string[],
      );
      const retainedResultIds = new Set(
        round.itemIdsRetained as string[],
      );
      const semanticItemIds = new Set<string>();
      round.semanticDecisions.forEach((decision, decisionIndex) => {
        if (!isRecord(decision)) {
          fail(
            `interaction.searchRounds[${index}].semanticDecisions[${decisionIndex}] is invalid.`,
          );
        }
        assertExactKeys(
          decision,
          [
            "itemId",
            "decision",
            "criterionIds",
            "scopeMismatchFields",
            "reason",
          ],
          `interaction.searchRounds[${index}].semanticDecisions[${decisionIndex}]`,
        );
        assertString(
          decision.itemId,
          "Stored semantic-decision item id",
          180,
        );
        assertString(
          decision.reason,
          "Stored semantic-decision reason",
          MAX_LONG_TEXT,
        );
        assertStringList(
          decision.criterionIds,
          "Stored semantic-decision criterion ids",
          { allowEmpty: true, maxText: 120, maxItems: 3 },
        );
        const decisionCriterionIds =
          decision.criterionIds as string[];
        const scopeMismatchFields =
          decision.scopeMismatchFields ?? [];
        assertStringList(
          scopeMismatchFields,
          "Stored semantic-decision locked-scope mismatch fields",
          {
            allowEmpty: true,
            maxText: 40,
            maxItems: screen02SemanticScopeFields.length,
          },
        );
        if (
          !["retained", "excluded"].includes(
            String(decision.decision),
          ) ||
          !parentItemIds.has(decision.itemId as string) ||
          semanticItemIds.has(decision.itemId as string) ||
          new Set(decisionCriterionIds).size !==
            decisionCriterionIds.length ||
          !decisionCriterionIds.every((id) =>
            parentCriterionIds.has(id),
          ) ||
          new Set(scopeMismatchFields as string[]).size !==
            (scopeMismatchFields as string[]).length ||
          !(scopeMismatchFields as string[]).every((field) =>
            screen02SemanticScopeFields.includes(
              field as (typeof screen02SemanticScopeFields)[number],
            ),
          ) ||
          (decision.decision === "retained" &&
            (scopeMismatchFields as string[]).length > 0) ||
          (decision.decision === "retained" &&
            (!proposalIds.has(decision.itemId as string) ||
              !retainedResultIds.has(
                decision.itemId as string,
              ))) ||
          (decision.decision === "excluded" &&
            (proposalIds.has(decision.itemId as string) ||
              retainedResultIds.has(
                decision.itemId as string,
              ) ||
              (decisionCriterionIds.length === 0 &&
                (scopeMismatchFields as string[]).length === 0) ||
              !decisionCriterionIds.every((id) =>
                ["require", "avoid"].includes(
                  criterionKinds.get(id) ?? "",
                ),
              )))
        ) {
          fail(
            `interaction.searchRounds[${index}] contains an invalid semantic decision.`,
          );
        }
        semanticItemIds.add(decision.itemId as string);
      });
    }
    const preliminaryFieldPresence = [
      round.assessmentParentRoundId,
      round.rootNativeRoundId,
      round.assessmentResults,
    ].map((field) => field !== undefined);
    const hasAnyPreliminaryField = preliminaryFieldPresence.some(Boolean);
    const hasAllPreliminaryFields = preliminaryFieldPresence.every(Boolean);
    let preliminaryAssessmentResults:
      | Screen02PreliminaryAssessmentResult[]
      | null = null;
    let preliminaryRootRound: Record<string, unknown> | null = null;
    if (
      hasAnyPreliminaryField !== hasAllPreliminaryFields ||
      (hasAllPreliminaryFields &&
        round.stage !== "preliminary-assessment") ||
      (!hasAllPreliminaryFields &&
        round.stage === "preliminary-assessment") ||
      (hasAllPreliminaryFields &&
        (hasParentRoundId || round.shockEvidence !== undefined))
    ) {
      fail(
        `interaction.searchRounds[${index}] has an incomplete preliminary-assessment record.`,
      );
    }
    if (hasAllPreliminaryFields) {
      assertString(
        round.assessmentParentRoundId,
        `interaction.searchRounds[${index}].assessmentParentRoundId`,
        120,
      );
      assertString(
        round.rootNativeRoundId,
        `interaction.searchRounds[${index}].rootNativeRoundId`,
        120,
      );
      const previousRoundValue = (value.searchRounds as unknown[])[index - 1];
      const previousRound = isRecord(previousRoundValue)
        ? previousRoundValue
        : null;
      const matchingRootRound = (value.searchRounds as unknown[])
        .slice(0, index)
        .find(
          (candidate) =>
            isRecord(candidate) && candidate.id === round.rootNativeRoundId,
        );
      preliminaryRootRound = isRecord(matchingRootRound)
        ? matchingRootRound
        : null;
      const preliminaryRootId = round.rootNativeRoundId as string;
      const preliminaryRoundCount =
        (preliminaryAssessmentRoundCounts.get(preliminaryRootId) ?? 0) + 1;
      if (
        preliminaryRoundCount >
        SCREEN_02_MAX_PRELIMINARY_ASSESSMENT_ROUNDS_PER_ROOT
      ) {
        fail(
          `interaction.searchRounds[${index}] exceeds the per-root preliminary-assessment retry limit.`,
        );
      }
      preliminaryAssessmentRoundCounts.set(
        preliminaryRootId,
        preliminaryRoundCount,
      );
      const validParent =
        previousRound !== null &&
        round.assessmentParentRoundId === previousRound.id &&
        ((previousRound.id === round.rootNativeRoundId &&
          previousRound.stage === "native-retrieval") ||
          (previousRound.stage === "preliminary-assessment" &&
            previousRound.rootNativeRoundId === round.rootNativeRoundId &&
            Array.isArray(previousRound.assessmentResults) &&
            previousRound.assessmentResults.some(
              (result) =>
                isRecord(result) && result.status === "needs-retry",
            )));
      if (
        index === 0 ||
        !validParent ||
        !previousRound ||
        !preliminaryRootRound ||
        preliminaryRootRound.stage !== "native-retrieval" ||
        preliminaryRootRound.requestType === "initial" ||
        preliminaryRootRound.parentRoundId !== undefined ||
        preliminaryRootRound.assessmentParentRoundId !== undefined ||
        round.requestType !== preliminaryRootRound.requestType ||
        !Array.isArray(previousRound.itemIdsRetained) ||
        !Array.isArray(preliminaryRootRound.itemIdsRetained) ||
        serializeDeterministicJson(round.itemIdsRetained) !==
          serializeDeterministicJson(previousRound.itemIdsRetained) ||
        serializeDeterministicJson(round.itemIdsRetained) !==
          serializeDeterministicJson(preliminaryRootRound.itemIdsRetained) ||
        !Array.isArray(preliminaryRootRound.preferenceCriteriaIds) ||
        serializeDeterministicJson(round.preferenceCriteriaIds) !==
          serializeDeterministicJson(
            preliminaryRootRound.preferenceCriteriaIds,
          ) ||
        (round.proposalIdsReceived as string[]).length !== 0 ||
        (round.itemIdsAdded as string[]).length !== 0 ||
        (round.duplicateProposalIds as string[]).length !== 0 ||
        (round.rejectedItemIds as string[]).length !== 0 ||
        !Array.isArray(round.assessmentResults) ||
        round.assessmentResults.length !==
          (round.itemIdsRetained as string[]).length
      ) {
        fail(
          `interaction.searchRounds[${index}] does not identify a valid preliminary-assessment lineage.`,
        );
      }
      const resultItemIds = new Set<string>();
      preliminaryAssessmentResults = round.assessmentResults.map(
        (result, resultIndex) => {
          if (!isRecord(result)) {
            fail(
              `interaction.searchRounds[${index}].assessmentResults[${resultIndex}] is invalid.`,
            );
          }
          assertExactKeys(
            result,
            ["itemId", "status", "reason"],
            `interaction.searchRounds[${index}].assessmentResults[${resultIndex}]`,
          );
          assertString(
            result.itemId,
            `interaction.searchRounds[${index}].assessmentResults[${resultIndex}].itemId`,
            180,
          );
          assertString(
            result.reason,
            `interaction.searchRounds[${index}].assessmentResults[${resultIndex}].reason`,
            MAX_LONG_TEXT,
          );
          if (
            !["assessed", "needs-retry"].includes(String(result.status)) ||
            resultItemIds.has(result.itemId as string)
          ) {
            fail(
              `interaction.searchRounds[${index}] contains an invalid preliminary-assessment result.`,
            );
          }
          resultItemIds.add(result.itemId as string);
          return result as unknown as Screen02PreliminaryAssessmentResult;
        },
      );
      if (
        serializeDeterministicJson(
          preliminaryAssessmentResults.map((result) => result.itemId),
        ) !== serializeDeterministicJson(round.itemIdsRetained)
      ) {
        fail(
          `interaction.searchRounds[${index}] does not account for every visible candidate in order.`,
        );
      }
    }
    const materialize = (
      versionIds: unknown,
      field: "assessedItemVersionIds" | "activeItemVersionIds",
    ) =>
      (versionIds as string[]).map((versionId, itemIndex) => {
        const version = versionsById.get(versionId);
        if (!version) {
          fail(
            `interaction.searchRounds[${index}].${field} references an unknown version.`,
          );
        }
        if (version.recordedAtRevision > (round.revision as number)) {
          fail(
            `interaction.searchRounds[${index}].${field} references a future version.`,
          );
        }
        referencedVersionIds.add(versionId);
        if (!firstVersionReferenceRevision.has(versionId)) {
          firstVersionReferenceRevision.set(
            versionId,
            round.revision as number,
          );
        }
        return {
          ...cloneJson(version.item),
          rank: itemIndex + 1,
        } as Screen02Item;
      });
    const assessedItems = materialize(
      round.assessedItemVersionIds,
      "assessedItemVersionIds",
    );
    const activeItems = materialize(
      round.activeItemVersionIds,
      "activeItemVersionIds",
    );
    if (
      serializeDeterministicJson(
        assessedItems.map((item) => item.id),
      ) !== serializeDeterministicJson(round.itemIdsRetained)
    ) {
      fail(
        `interaction.searchRounds[${index}] changed its assessed item snapshot.`,
      );
    }
    if (preliminaryAssessmentResults) {
      const previousRoundValue = (value.searchRounds as unknown[])[index - 1];
      const previousRound = isRecord(previousRoundValue)
        ? previousRoundValue
        : null;
      const previousResultByItemId = new Map(
        previousRound?.stage === "preliminary-assessment" &&
          Array.isArray(previousRound.assessmentResults)
          ? previousRound.assessmentResults.flatMap((result) =>
              isRecord(result) && typeof result.itemId === "string"
                ? [[result.itemId, result] as const]
                : [],
            )
          : [],
      );
      const previousAssessmentByItemId = new Map(
        previousRound?.stage === "preliminary-assessment" &&
          Array.isArray(previousRound.assessedItemVersionIds)
          ? previousRound.assessedItemVersionIds.flatMap((versionId) => {
              const version = versionsById.get(String(versionId));
              return version
                ? [
                    [
                      version.itemId,
                      version.item.preliminaryAssessment,
                    ] as const,
                  ]
                : [];
            })
          : [],
      );
      preliminaryAssessmentResults.forEach((result, resultIndex) => {
        const item = assessedItems[resultIndex];
        const assessment = item?.preliminaryAssessment;
        const previousResult = previousResultByItemId.get(result.itemId);
        if (previousResult?.status === "assessed") {
          const previousAssessment = previousAssessmentByItemId.get(
            result.itemId,
          );
          if (
            result.status !== "assessed" ||
            !previousAssessment ||
            !assessment ||
            serializeDeterministicJson(assessment) !==
              serializeDeterministicJson(previousAssessment)
          ) {
            fail(
              `interaction.searchRounds[${index}] replaced a previously accepted compact assessment.`,
            );
          }
        }
        if (result.status === "assessed") {
          if (
            !assessment ||
            assessment.rootNativeRoundId !== round.rootNativeRoundId ||
            assessment.assessedAtRevision > (round.revision as number)
          ) {
            fail(
              `interaction.searchRounds[${index}] marks ${result.itemId} assessed without a matching compact assessment.`,
            );
          }
          const registration = serializeDeterministicJson([
            result.itemId,
            assessment,
          ]);
          if (
            assessment.assessedAtRevision < (round.revision as number) &&
            !registeredPreliminaryAssessments.has(registration)
          ) {
            fail(
              `interaction.searchRounds[${index}] references an unregistered prior compact assessment.`,
            );
          }
          registeredPreliminaryAssessments.add(registration);
        } else if (
          assessment?.rootNativeRoundId === round.rootNativeRoundId
        ) {
          fail(
            `interaction.searchRounds[${index}] marks ${result.itemId} for retry despite a matching compact assessment.`,
          );
        }
      });
    }
    const deterministicallyRankedAssessed =
      preserveItemOrder(assessedItems);
    const deterministicallyRankedActive = rankItems(activeItems);
    const activeSnapshotIds = new Set(
      activeItems.map((item) => item.id),
    );
    if (
      serializeDeterministicJson(
        deterministicallyRankedAssessed.map((item) => item.id),
      ) !==
        serializeDeterministicJson(
          assessedItems.map((item) => item.id),
        ) ||
      serializeDeterministicJson(
        deterministicallyRankedActive.map((item) => item.id),
      ) !==
        serializeDeterministicJson(activeItems.map((item) => item.id)) ||
      !(round.itemIdsAdded as string[]).every((id) =>
        activeSnapshotIds.has(id),
      ) ||
      !(round.rejectedItemIds as string[]).every((id) =>
        activeSnapshotIds.has(id),
      )
    ) {
      fail(
        `interaction.searchRounds[${index}] changed deterministic candidate ranks.`,
      );
    }
    finalActiveItems = activeItems;
    if (round.shockEvidence !== undefined) {
      const shockEvidence = round.shockEvidence;
      if (!isRecord(shockEvidence)) {
        storedFail("shock-level evidence is invalid.");
      }
      assertExactKeys(
        shockEvidence,
        [
          "status",
          "anchorShock",
          "matchMethod",
          "proposalIds",
          "candidateNames",
          "sources",
          "provisionalDates",
          "affectedPopulations",
          "note",
        ],
        `interaction.searchRounds[${index}].shockEvidence`,
      );
      if (
        shockEvidence.status !== "shock-level-reconnaissance" ||
        shockEvidence.matchMethod !==
          "exact-name-or-controlled-alias"
      ) {
        storedFail("shock-level evidence metadata is invalid.");
      }
      assertString(
        shockEvidence.anchorShock,
        "Stored shock-level evidence anchor",
        MAX_LONG_TEXT,
      );
      if (
        baseline.startingPoint === "audit" &&
        !textAnchorsKnownShock(
          shockEvidence.anchorShock as string,
          baseline.knownShock,
        )
      ) {
        storedFail("shock-level evidence changed the known-shock anchor.",
        );
      }
      assertString(
        shockEvidence.note,
        "Stored shock-level evidence note",
        MAX_LONG_TEXT,
      );
      for (const [key, maxItems, maxText] of [
        ["proposalIds", 40, 180],
        ["candidateNames", 40, MAX_LONG_TEXT],
        ["provisionalDates", 30, MAX_LONG_TEXT],
        ["affectedPopulations", 30, MAX_LONG_TEXT],
      ] as const) {
        assertStringList(
          shockEvidence[key],
          `interaction.searchRounds[${index}].shockEvidence.${key}`,
          { allowEmpty: true, maxItems, maxText },
        );
      }
      if (
        !Array.isArray(shockEvidence.sources) ||
        shockEvidence.sources.length >
          SCREEN_02_MAX_SOURCES_PER_PROPOSAL
      ) {
        storedFail("shock-level evidence sources are invalid.");
      }
      shockEvidence.sources.forEach((source, sourceIndex) =>
        assertSource(
          source,
          `interaction.searchRounds[${index}].shockEvidence.sources[${sourceIndex}]`,
        ),
      );
    }
    if (!isRecord(round.discovery)) {
      fail(`interaction.searchRounds[${index}].discovery is invalid.`);
    }
    assertExactKeys(
      round.discovery,
      ["formulaVersion", "query", "rankings", "clusters"],
      `interaction.searchRounds[${index}].discovery`,
    );
    assertString(
      round.discovery.formulaVersion,
      `interaction.searchRounds[${index}].discovery.formulaVersion`,
      120,
    );
    if (
      round.discovery.formulaVersion !==
      SCREEN02_DISCOVERY_FORMULA_VERSION
    ) {
      storedFail("discovery formula version is invalid.");
    }
    assertString(
      round.discovery.query,
      `interaction.searchRounds[${index}].discovery.query`,
      MAX_LONG_TEXT,
      true,
    );
    if (
      !Array.isArray(round.discovery.rankings) ||
      !Array.isArray(round.discovery.clusters) ||
      round.discovery.rankings.length > SCREEN_02_MAX_PROPOSALS ||
      round.discovery.clusters.length > SCREEN_02_MAX_PROPOSALS
    ) {
      storedFail("discovery diagnostics exceed their limits.");
    }
    round.discovery.rankings.forEach((ranking, rankingIndex) => {
      if (!isRecord(ranking)) {
        storedFail("discovery ranking is invalid.");
      }
      assertExactKeys(
        ranking,
        [
          "proposalId",
          "stableProposalId",
          "rank",
          "rankScore",
          "matchedTerms",
        ],
        `interaction.searchRounds[${index}].discovery.rankings[${rankingIndex}]`,
      );
      assertString(ranking.proposalId, "discovery ranking proposal id", 180);
      assertString(
        ranking.stableProposalId,
        "discovery ranking stable id",
        180,
      );
      if (
        !Number.isSafeInteger(ranking.rank) ||
        (ranking.rank as number) < 1 ||
        (ranking.rank as number) > SCREEN_02_MAX_PROPOSALS ||
        typeof ranking.rankScore !== "number" ||
        !Number.isFinite(ranking.rankScore)
      ) {
        storedFail("discovery ranking score is invalid.");
      }
      assertStringList(
        ranking.matchedTerms,
        "discovery ranking matched terms",
        { allowEmpty: true, maxText: 120, maxItems: 100 },
      );
    });
    round.discovery.clusters.forEach((cluster, clusterIndex) => {
      if (!isRecord(cluster)) {
        storedFail("discovery cluster is invalid.");
      }
      assertExactKeys(
        cluster,
        [
          "clusterId",
          "canonicalProposalId",
          "memberProposalIds",
          "duplicateProposalIds",
        ],
        `interaction.searchRounds[${index}].discovery.clusters[${clusterIndex}]`,
      );
      assertString(cluster.clusterId, "discovery cluster id", 180);
      assertString(
        cluster.canonicalProposalId,
        "discovery canonical proposal id",
        180,
      );
      assertStringList(
        cluster.memberProposalIds,
        "discovery cluster member ids",
        { maxText: 180, maxItems: 40 },
      );
      assertStringList(
        cluster.duplicateProposalIds,
        "discovery cluster duplicate ids",
        { allowEmpty: true, maxText: 180, maxItems: 40 },
      );
    });
    if (
      preliminaryRootRound &&
      (serializeDeterministicJson(round.discovery) !==
        serializeDeterministicJson(preliminaryRootRound.discovery) ||
        serializeDeterministicJson(round.manifest) !==
          serializeDeterministicJson(preliminaryRootRound.manifest))
    ) {
      fail(
        `interaction.searchRounds[${index}] changed native discovery or eligibility evidence during preliminary assessment.`,
      );
    }
    assertStoredManifest(round.manifest, baseline, assessedItems);
  });
  for (const version of versionsById.values()) {
    const assessment = version.item.preliminaryAssessment;
    if (
      assessment &&
      !registeredPreliminaryAssessments.has(
        serializeDeterministicJson([version.itemId, assessment]),
      )
    ) {
      storedFail("compact preliminary assessment has no append-only assessment-round origin.",
      );
    }
  }
  if (
    referencedVersionIds.size !== versionsById.size ||
    [...versionsById.values()].some(
      (version) =>
        firstVersionReferenceRevision.get(version.versionId) !==
        version.recordedAtRevision,
    ) ||
    serializeDeterministicJson(finalActiveItems) !==
      serializeDeterministicJson(items)
  ) {
    storedFail("Screen 2 item versions do not reconstruct the append-only round history.",
    );
  }
  for (const key of [
    "rejections",
    "selectionHistory",
    "deferredQuestions",
  ] as const) {
    if (!Array.isArray(value[key]) || value[key].length > 100) {
      storedFail(`interaction.${key} is invalid.`);
    }
  }
  const rejections = value.rejections as unknown[];
  const selectionHistory = value.selectionHistory as unknown[];
  const deferredQuestionEntries = value.deferredQuestions as unknown[];
  const rejectedItemIds = new Set<string>();
  let previousRejectionRevision = -1;
  rejections.forEach((entry, index) => {
    if (!isRecord(entry)) fail(`rejections[${index}] is invalid.`);
    assertExactKeys(
      entry,
      ["id", "itemId", "revision", "reason", "source"],
      `rejections[${index}]`,
    );
    if (
      !itemIds.has(String(entry.itemId)) ||
      rejectedItemIds.has(String(entry.itemId)) ||
      entry.source !== "researcher" ||
      !Number.isSafeInteger(entry.revision) ||
      (entry.revision as number) < 0 ||
      (entry.revision as number) < previousRejectionRevision ||
      (entry.revision as number) > revision
    ) {
      storedFail("rejection metadata is invalid.");
    }
    assertString(entry.id, `rejections[${index}].id`, 120);
    if (entry.id !== `rejection-${String(index + 1).padStart(3, "0")}`) {
      storedFail("rejection id sequence is invalid.");
    }
    assertString(entry.reason, `rejections[${index}].reason`, MAX_LONG_TEXT);
    rejectedItemIds.add(String(entry.itemId));
    previousRejectionRevision = entry.revision as number;
    mutationRevisions.add(entry.revision as number);
  });
  let replayedSelectedItemId: string | null = null;
  let replayedLockedItemId: string | null = null;
  let lastLockedRevision: number | null = null;
  let previousSelectionRevision = -1;
  let unlockCount = 0;
  selectionHistory.forEach((entry, index) => {
    if (!isRecord(entry)) {
      fail(`selectionHistory[${index}] is invalid.`);
    }
    assertExactKeys(
      entry,
      ["id", "revision", "action", "itemId", "reason"],
      `selectionHistory[${index}]`,
    );
    if (
      !["selected", "cleared", "locked", "unlocked"].includes(
        String(entry.action),
      ) ||
      (entry.itemId !== null && !itemIds.has(String(entry.itemId))) ||
      !Number.isSafeInteger(entry.revision) ||
      (entry.revision as number) < 0 ||
      (entry.revision as number) < previousSelectionRevision ||
      (entry.revision as number) > revision
    ) {
      storedFail("selection-history metadata is invalid.");
    }
    assertString(entry.id, `selectionHistory[${index}].id`, 120);
    if (entry.id !== `selection-${String(index + 1).padStart(3, "0")}`) {
      storedFail("selection-history id sequence is invalid.");
    }
    assertString(
      entry.reason,
      `selectionHistory[${index}].reason`,
      MAX_LONG_TEXT,
    );
    const eventItemId =
      entry.itemId === null ? null : String(entry.itemId);
    if (entry.action === "selected") {
      if (eventItemId === null || replayedLockedItemId !== null) {
        storedFail("selection event is out of order.");
      }
      replayedSelectedItemId = eventItemId;
    } else if (entry.action === "cleared") {
      if (
        eventItemId === null ||
        replayedLockedItemId !== null ||
        replayedSelectedItemId !== eventItemId
      ) {
        storedFail("cleared-selection event is out of order.");
      }
      replayedSelectedItemId = null;
    } else if (entry.action === "locked") {
      if (
        eventItemId === null ||
        replayedLockedItemId !== null ||
        replayedSelectedItemId !== eventItemId
      ) {
        storedFail("lock event is out of order.");
      }
      replayedLockedItemId = eventItemId;
      lastLockedRevision = entry.revision as number;
    } else {
      if (
        eventItemId === null ||
        replayedLockedItemId !== eventItemId ||
        replayedSelectedItemId !== eventItemId
      ) {
        storedFail("unlock event is out of order.");
      }
      replayedLockedItemId = null;
      unlockCount += 1;
    }
    previousSelectionRevision = entry.revision as number;
    mutationRevisions.add(entry.revision as number);
  });
  const storedLockedItemId =
    isRecord(lockedChoice) && typeof lockedChoice.itemId === "string"
      ? lockedChoice.itemId
      : null;
  if (
    replayedSelectedItemId !== selectedItemId ||
    replayedLockedItemId !== storedLockedItemId ||
    (storedLockedItemId !== null &&
      (!Number.isSafeInteger(
        (lockedChoice as Record<string, unknown>).lockedAtRevision,
      ) ||
        (lockedChoice as Record<string, unknown>).lockedAtRevision !==
          lastLockedRevision))
  ) {
    storedFail("selection and lock state do not match their append-only history.",
    );
  }
  let previousDeferredRevision = -1;
  deferredQuestionEntries.forEach((entry, index) => {
    if (!isRecord(entry)) {
      fail(`deferredQuestions[${index}] is invalid.`);
    }
    assertExactKeys(
      entry,
      ["id", "revision", "exactRequest", "reason", "destination"],
      `deferredQuestions[${index}]`,
    );
    if (
      entry.destination !== "screen-03" ||
      !Number.isSafeInteger(entry.revision) ||
      (entry.revision as number) < 0 ||
      (entry.revision as number) < previousDeferredRevision ||
      (entry.revision as number) > revision
    ) {
      storedFail("deferred-question metadata is invalid.");
    }
    assertString(entry.id, `deferredQuestions[${index}].id`, 120);
    if (
      entry.id !==
      `screen03-question-${String(index + 1).padStart(3, "0")}`
    ) {
      storedFail("deferred-question id sequence is invalid.");
    }
    assertString(
      entry.exactRequest,
      `deferredQuestions[${index}].exactRequest`,
      MAX_LONG_TEXT,
    );
    assertString(
      entry.reason,
      `deferredQuestions[${index}].reason`,
      MAX_LONG_TEXT,
    );
    previousDeferredRevision = entry.revision as number;
  });
  if (value.pendingScopeRevision !== null) {
    if (!isRecord(value.pendingScopeRevision)) {
      storedFail("pending scope revision is invalid.");
    }
    assertExactKeys(
      value.pendingScopeRevision,
      ["revision", "exactRequest", "conflictingFields", "reason"],
      "pendingScopeRevision",
    );
    assertString(
      value.pendingScopeRevision.exactRequest,
      "pendingScopeRevision.exactRequest",
      MAX_LONG_TEXT,
    );
    assertString(
      value.pendingScopeRevision.reason,
      "pendingScopeRevision.reason",
      MAX_LONG_TEXT,
    );
    assertStringList(
      value.pendingScopeRevision.conflictingFields,
      "pendingScopeRevision.conflictingFields",
      { allowEmpty: false, maxText: 120 },
    );
    if (
      !Number.isSafeInteger(value.pendingScopeRevision.revision) ||
      value.pendingScopeRevision.revision !== revision
    ) {
      storedFail("pending scope revision number is invalid.");
    }
    mutationRevisions.add(value.pendingScopeRevision.revision as number);
  }
  if (
    !Number.isSafeInteger(value.downstreamInvalidationCount) ||
    (value.downstreamInvalidationCount as number) < 0 ||
    value.downstreamInvalidationCount !== unlockCount
  ) {
    storedFail("downstream invalidation count is invalid.");
  }
  if (
    value.pendingScopeRevision === null
  ) {
    const latestRound = (
      value.searchRounds as Screen02SearchRound[]
    ).at(-1);
    const activeCriterionIds = new Set(
      latestRound?.preferenceCriteriaIds ?? [],
    );
    const activeCriteria = (
      value.preferences.criteria as Screen02PreferenceCriterion[]
    ).filter((criterion) => activeCriterionIds.has(criterion.id));
    const itemById = new Map(items.map((item) => [item.id, item]));
    const currentItems = (latestRound?.itemIdsRetained ?? [])
      .map((itemId) => itemById.get(itemId))
      .filter((item): item is Screen02Item => item !== undefined);
    if (
      activeCriteria.length > 0 ||
      value.preferenceAssessments.length > 0
    ) {
      const expectedAssessments = preferenceAssessments(
        currentItems,
        activeCriteria,
        latestRound?.revision ?? revision,
      );
      if (
        serializeDeterministicJson(value.preferenceAssessments) !==
          serializeDeterministicJson(expectedAssessments)
      ) {
        storedFail("preference assessments do not match their versioned criteria.",
        );
      }
    }
  }
  if (baseline.startingPoint === "audit" && baseline.knownShock.length === 0) {
    fail("Audit interaction lost its known-shock anchor.");
  }
  for (let expectedRevision = 0; expectedRevision <= revision; expectedRevision += 1) {
    if (!mutationRevisions.has(expectedRevision)) {
      storedFail("Screen 2 revision history contains an unexplained gap.",
      );
    }
  }
}

export function restoreScreen02Session(
  value: unknown,
): Screen02Session | null {
  try {
    const clone = cloneJsonPreservingOrder(value) as unknown;
    if (!isRecord(clone)) return null;
    const hasRunId = Object.hasOwn(clone, "runId");
    assertExactKeys(
      clone,
      [
        "schemaVersion",
        "sourceScreen",
        ...(hasRunId ? ["runId"] : []),
        "mode",
        "screen01Baseline",
        "screen01Fingerprint",
        "revision",
        "items",
        "selectedItemId",
        "lockedChoice",
        "searchManifest",
        "interaction",
      ],
      "screen02Session",
    );
    if (
      clone.schemaVersion !== SCREEN_02_SESSION_SCHEMA_VERSION ||
      clone.sourceScreen !== "screen-02" ||
      (clone.mode !== "find" && clone.mode !== "audit") ||
      !Number.isSafeInteger(clone.revision) ||
      (clone.revision as number) < 0 ||
      !isRecord(clone.screen01Baseline)
    ) {
      return null;
    }
    const baseline = readyBaseline(
      clone.screen01Baseline as unknown as Screen01StudyContext,
    );
    if (hasRunId && typeof clone.runId !== "string") {
      return null;
    }
    const runId = hasRunId
      ? (clone.runId as string)
      : initialScreen02RunId(baseline);
    assertString(runId, "Screen 2 run id", 120);
    if (
      clone.mode !== baseline.startingPoint ||
      clone.screen01Fingerprint !==
        fingerprintScreen01StudyContext(baseline)
    ) {
      return null;
    }
    if (
      !Array.isArray(clone.items) ||
    clone.items.length > SCREEN_02_MAX_CANDIDATE_ITEMS
    ) {
      return null;
    }
    const ids = new Set<string>();
    const ranks = new Set<number>();
    clone.items.forEach((item, index) => {
      assertStoredItem(item, baseline, index);
      if (ids.has(item.id) || ranks.has(item.rank)) {
        storedFail("items contain a duplicate id or rank.");
      }
      ids.add(item.id);
      ranks.add(item.rank);
    });
    const items = clone.items as Screen02Item[];
    const reranked = rankItems(items);
    if (
      items.some(
        (item, index) =>
          item.id !== reranked[index]?.id ||
          item.rank !== reranked[index]?.rank,
      )
    ) {
      return null;
    }
    if (
      clone.selectedItemId !== null &&
      (typeof clone.selectedItemId !== "string" ||
        !ids.has(clone.selectedItemId))
    ) {
      return null;
    }
    if (clone.selectedItemId !== null) {
      const selected = items.find(
        (item) => item.id === clone.selectedItemId,
      );
      if (!selected || !isSelectableScreen02Item(selected)) return null;
    }
    assertStoredManifest(clone.searchManifest, baseline, items);
    assertStoredInteraction(
      clone.interaction,
      baseline,
      items,
      clone.revision as number,
      clone.selectedItemId as string | null,
      clone.lockedChoice,
    );

    const restored: Screen02Session = {
      schemaVersion: SCREEN_02_SESSION_SCHEMA_VERSION,
      sourceScreen: "screen-02",
      runId,
      mode: baseline.startingPoint,
      screen01Baseline: baseline,
      screen01Fingerprint: clone.screen01Fingerprint as string,
      revision: clone.revision as number,
      items,
      selectedItemId: clone.selectedItemId as string | null,
      lockedChoice: clone.lockedChoice as Screen02LockedChoice | null,
      searchManifest: clone.searchManifest as Screen02SearchManifest,
      interaction: clone.interaction as Screen02Session["interaction"],
    };
    if (restored.lockedChoice !== null) {
      const lock = restored.lockedChoice;
      if (!isRecord(lock)) return null;
      assertExactKeys(
        lock,
        [
          "status",
          "itemId",
          "itemFingerprint",
          "lockedAtRevision",
          "mode",
          "shockName",
          "knownShockAnchor",
          "primaryRepresentationType",
          "primaryConstruct",
          "baselineFingerprint",
          "downstreamStatus",
        ],
        "lockedChoice",
      );
      const lockedItem = items.find((item) => item.id === lock.itemId);
      if (
        lock.status !== "locked" ||
        lock.downstreamStatus !== "screen-03-ready" ||
        lock.mode !== baseline.startingPoint ||
        lock.baselineFingerprint !== restored.screen01Fingerprint ||
        lock.itemId !== restored.selectedItemId ||
        !lockedItem ||
        lock.itemFingerprint !==
          fingerprintSerialized(serializeDeterministicJson(lockedItem)) ||
        !Number.isSafeInteger(lock.lockedAtRevision) ||
        lock.lockedAtRevision !== restored.revision ||
        !isLockableScreen02Item(restored, lockedItem)
      ) {
        return null;
      }
      assertString(lock.shockName, "lockedChoice.shockName", MAX_LONG_TEXT);
      if (baseline.startingPoint === "find") {
        if (
          lock.knownShockAnchor !== null ||
          lock.primaryRepresentationType !== null ||
          lock.primaryConstruct !== null ||
          lock.shockName !==
            (lockedItem as Screen02FindItem).event.displayName
        ) {
          return null;
        }
      } else {
        if (
          lock.knownShockAnchor !== baseline.knownShock ||
          lock.shockName !== baseline.knownShock ||
          lock.primaryRepresentationType !==
            (lockedItem as Screen02AuditItem).representationType ||
          lock.primaryConstruct !==
            (lockedItem as Screen02AuditItem).candidateConstruct
        ) {
          return null;
        }
      }
    }
    return deepFreeze(restored) as unknown as Screen02Session;
  } catch {
    return null;
  }
}

function finalizeScreen02Mutation(
  candidate: Screen02Session,
  prior:
    | Screen02Session
    | DeepReadonly<Screen01StudyContext>,
  label: string,
) {
  const canonicalCandidate = serializeScreen02Session(candidate);
  const canonicalCandidateBytes = new TextEncoder().encode(
    canonicalCandidate,
  ).byteLength;
  if (canonicalCandidateBytes > SCREEN_02_MAX_CANONICAL_SESSION_BYTES) {
    throw new Screen02StateCapacityError(
      "canonical-capacity",
      `Screen 2 state exceeds the ${SCREEN_02_MAX_CANONICAL_SESSION_BYTES}-byte canonical session limit. The prior valid state was preserved.`,
    );
  }
  try {
    assertScreen02StateEnvelopeCapacity(canonicalCandidate);
  } catch (error) {
    if (!(error instanceof Screen02StateCapacityError)) throw error;
    throw new Screen02StateCapacityError(
      error.code,
      `Screen 2 state cannot fit within the ${SCREEN_02_MAX_STATE_PAYLOAD_CHARACTERS}-character state-envelope transport limit. The prior valid state was preserved.`,
    );
  }
  const expectedBaseline =
    "screen01Baseline" in prior ? prior.screen01Baseline : prior;
  const expectedFingerprint =
    "screen01Fingerprint" in prior
      ? prior.screen01Fingerprint
      : fingerprintScreen01StudyContext(expectedBaseline);
  const restored = restoreScreen02Session(candidate);
  if (!restored) {
    fail(
      `${label} produced a Screen 2 session that failed its own integrity contract.`,
    );
  }
  if (
    serializeScreen01StudyContext(restored.screen01Baseline) !==
      serializeScreen01StudyContext(expectedBaseline) ||
    restored.screen01Fingerprint !== expectedFingerprint
  ) {
    fail(`${label} changed the immutable Screen 1 baseline.`);
  }
  if ("runId" in prior && restored.runId !== prior.runId) {
    fail(`${label} changed the active Screen 2 run id.`);
  }
  return restored;
}

function isSelectableScreen02Item(item: Screen02Item) {
  return (
    item.likelyServiceLevel !== "stop" &&
    item.evidenceStatus !== "fictional-demonstration" &&
    item.hardFilters.every((filter) => filter.status !== "fail")
  );
}

export type BeginScreen02InteractionRequestInput = {
  id: string;
  requestType: Screen02PendingInteractionRequest["requestType"];
  exactText: string;
  criteria: Screen02PendingInteractionRequest["criteria"];
};

function appendInteractionRequestEvent(
  history: readonly Screen02InteractionRequestEvent[],
  request: Screen02PendingInteractionRequest,
  action: Screen02InteractionRequestEvent["action"],
  revision: number,
  error: string | null = null,
) {
  if (history.length >= 100) {
    screen2Fail("cannot retain more than 100 interaction-request events.",
    );
  }
  return [
    ...history,
    {
      id: `interaction-event-${String(history.length + 1).padStart(
        3,
        "0",
      )}`,
      requestId: request.id,
      revision,
      action,
      requestType: request.requestType,
      exactText: request.exactText,
      criteria: cloneJson(request.criteria),
      error,
    },
  ] satisfies Screen02InteractionRequestEvent[];
}

export function beginScreen02InteractionRequest(
  session: Screen02Session,
  input: BeginScreen02InteractionRequestInput,
): Screen02Session {
  const safe = restoreScreen02Session(session);
  if (!safe) screen2Fail("session failed integrity validation.");
  if (safe.lockedChoice) {
    fail(
      "The shock is locked. Unlock it before requesting another Screen 2 search round.",
    );
  }
  if (safe.interaction.pendingScopeRevision) {
    fail(
      "Return to Screen 1 to resolve the pending scope revision before applying another Screen 2 round.",
    );
  }
  if (safe.interaction.pendingScopeRevision) {
    fail(
      "Return to Screen 1 to resolve the pending scope revision before requesting another Screen 2 search round.",
    );
  }
  if (safe.interaction.pendingRequest) {
    fail("A Screen 2 interaction request is already pending.");
  }
  if (safe.interaction.interactionRequestHistory.length > 97) {
    screen2Fail("interaction-request history has reached its limit.",
    );
  }
  assertString(input.id, "Screen 2 interaction request id", 120);
  assertString(
    input.exactText,
    "Screen 2 interaction exact request",
    MAX_LONG_TEXT,
  );
  if (!["find-more", "refine", "none-fit"].includes(input.requestType)) {
    screen2Fail("interaction request type is invalid.");
  }
  if (
    !Array.isArray(input.criteria) ||
    input.criteria.length > SCREEN_02_MAX_PROPOSALS
  ) {
    screen2Fail("interaction criteria are invalid.");
  }
  const criteria = cloneJson(input.criteria);
  criteria.forEach((criterion) => {
    if (
      !isRecord(criterion) ||
      !["require", "prefer", "avoid"].includes(String(criterion.kind))
    ) {
      screen2Fail("interaction criterion is invalid.");
    }
    assertExactKeys(
      criterion,
      ["kind", "text"],
      "Screen 2 interaction criterion",
    );
    assertString(
      criterion.text,
      "Screen 2 interaction criterion text",
      MAX_LONG_TEXT,
    );
  });
  const pendingRequest: Screen02PendingInteractionRequest = {
    id: input.id,
    baseRevision: safe.revision,
    expectedRevision: safe.revision + 1,
    requestType: input.requestType,
    status: "sending",
    exactText: input.exactText,
    criteria,
  };
  const next = {
    ...safe,
    interaction: {
      ...safe.interaction,
      pendingRequest,
      interactionRequestHistory: appendInteractionRequestEvent(
        safe.interaction.interactionRequestHistory,
        pendingRequest,
        "recorded",
        safe.revision,
      ),
    },
  } as Screen02Session;
  return finalizeScreen02Mutation(
    next,
    safe,
    "Recording a pending Screen 2 interaction",
  );
}

export function markScreen02InteractionRequestAwaitingResponse(
  session: Screen02Session,
  requestId: string,
): Screen02Session {
  assertString(requestId, "Screen 2 interaction request id", 120);
  const safe = restoreScreen02Session(session);
  if (!safe) screen2Fail("session failed integrity validation.");
  if (!safe.interaction.pendingRequest) return safe;
  if (safe.interaction.pendingRequest.id !== requestId) {
    fail("The pending Screen 2 interaction request id changed.");
  }
  if (safe.interaction.pendingRequest.status === "awaiting-response") {
    return safe;
  }
  const next = {
    ...safe,
    interaction: {
      ...safe.interaction,
      pendingRequest: {
        ...safe.interaction.pendingRequest,
        status: "awaiting-response",
      },
      interactionRequestHistory: appendInteractionRequestEvent(
        safe.interaction.interactionRequestHistory,
        safe.interaction.pendingRequest,
        "sent",
        safe.revision,
      ),
    },
  } as Screen02Session;
  return finalizeScreen02Mutation(
    next,
    safe,
    "Marking a Screen 2 interaction as sent",
  );
}

export function clearScreen02InteractionRequest(
  session: Screen02Session,
  requestId: string,
  error = "The Screen 2 request could not be sent.",
): Screen02Session {
  assertString(requestId, "Screen 2 interaction request id", 120);
  assertString(error, "Screen 2 interaction send error", MAX_LONG_TEXT);
  const safe = restoreScreen02Session(session);
  if (!safe) screen2Fail("session failed integrity validation.");
  if (!safe.interaction.pendingRequest) return safe;
  if (safe.interaction.pendingRequest.id !== requestId) {
    fail("The pending Screen 2 interaction request id changed.");
  }
  const next = {
    ...safe,
    interaction: {
      ...safe.interaction,
      pendingRequest: null,
      interactionRequestHistory: appendInteractionRequestEvent(
        safe.interaction.interactionRequestHistory,
        safe.interaction.pendingRequest,
        "send-failed",
        safe.revision,
        error,
      ),
    },
  } as Screen02Session;
  return finalizeScreen02Mutation(
    next,
    safe,
    "Recording a failed Screen 2 interaction",
  );
}

function isRejectedScreen02Item(session: Screen02Session, itemId: string) {
  return session.interaction.rejections.some(
    (rejection) => rejection.itemId === itemId,
  );
}

export function unmetRequiredCriteriaIdsForScreen02Item(
  session: Screen02Session,
  itemId: string,
) {
  const requiredIds = currentCriteriaForSession(session)
    .filter((criterion) => criterion.kind === "require")
    .map((criterion) => criterion.id);
  if (requiredIds.length === 0) return [];
  const assessment = session.interaction.preferenceAssessments.find(
    (entry) => entry.itemId === itemId,
  );
  if (!assessment) return requiredIds;
  const unmet = new Set(assessment.unmetRequiredCriteriaIds);
  return requiredIds.filter((id) => unmet.has(id));
}

export function isLockableScreen02Item(
  session: Screen02Session,
  item: Screen02Item,
) {
  return (
    isSelectableScreen02Item(item) &&
    !isRejectedScreen02Item(session, item.id) &&
    !session.interaction.pendingRequest &&
    !session.interaction.pendingScopeRevision &&
    item.sourceSummary.uniqueSourceCount > 0
  );
}

export function selectScreen02Item(
  session: Screen02Session,
  id: string,
): Screen02Session {
  assertString(id, "Screen 2 item id", 120);
  const safe = restoreScreen02Session(session);
  if (!safe) screen2Fail("session failed integrity validation.");
  if (safe.lockedChoice) {
    fail(
      "Unlock the current Screen 2 choice before changing the tentative selection.",
    );
  }
  if (safe.interaction.pendingRequest) {
    fail(
      "Wait for the pending Screen 2 request before changing the tentative selection.",
    );
  }
  if (safe.interaction.pendingScopeRevision) {
    fail(
      "Return to Screen 1 to resolve the pending scope revision before selecting an option.",
    );
  }
  const item = safe.items.find((candidate) => candidate.id === id);
  if (!item) {
    screen2Fail(`item does not exist: ${id}.`);
  }
  if (
    !isSelectableScreen02Item(item) ||
    isRejectedScreen02Item(safe, id)
  ) {
    fail(
      "A fictional, hard-fail, or Stop option cannot be selected for Screen 3.",
    );
  }
  if (safe.interaction.selectionHistory.length >= 100) {
    screen2Fail("selection history has reached its limit.");
  }
  const selected: Screen02Session = {
    ...safe,
    revision: safe.revision + 1,
    selectedItemId: id,
    interaction: {
      ...safe.interaction,
      selectionHistory: [
        ...safe.interaction.selectionHistory,
        {
          id: `selection-${String(
            safe.interaction.selectionHistory.length + 1,
          ).padStart(3, "0")}`,
          revision: safe.revision + 1,
          action: "selected",
          itemId: id,
          reason: "The researcher selected this option tentatively.",
        },
      ],
    },
  };
  return finalizeScreen02Mutation(
    selected,
    safe,
    "Selecting a Screen 2 item",
  );
}

export function rejectScreen02Item(
  session: Screen02Session,
  id: string,
  reason: string,
): Screen02Session {
  assertString(id, "Screen 2 item id", 120);
  assertString(reason, "Screen 2 rejection reason", MAX_LONG_TEXT);
  const safe = restoreScreen02Session(session);
  if (!safe) screen2Fail("session failed integrity validation.");
  if (safe.interaction.pendingRequest) {
    fail(
      "Wait for the pending Screen 2 request before rejecting an option.",
    );
  }
  if (safe.interaction.pendingScopeRevision) {
    fail(
      "Return to Screen 1 to resolve the pending scope revision before rejecting an option.",
    );
  }
  if (safe.lockedChoice?.itemId === id) {
    fail("Unlock the current choice before rejecting it.");
  }
  if (!safe.items.some((item) => item.id === id)) {
    screen2Fail(`item does not exist: ${id}.`);
  }
  if (isRejectedScreen02Item(safe, id)) return safe;
  if (
    safe.interaction.rejections.length >= 100 ||
    (safe.selectedItemId === id &&
      safe.interaction.selectionHistory.length >= 100)
  ) {
    screen2Fail("interaction history has reached its limit.");
  }
  const revision = safe.revision + 1;
  const next: Screen02Session = {
    ...safe,
    revision,
    selectedItemId:
      safe.selectedItemId === id ? null : safe.selectedItemId,
    interaction: {
      ...safe.interaction,
      rejections: [
        ...safe.interaction.rejections,
        {
          id: `rejection-${String(
            safe.interaction.rejections.length + 1,
          ).padStart(3, "0")}`,
          itemId: id,
          revision,
          reason,
          source: "researcher",
        },
      ],
      selectionHistory:
        safe.selectedItemId === id
          ? [
              ...safe.interaction.selectionHistory,
              {
                id: `selection-${String(
                  safe.interaction.selectionHistory.length + 1,
                ).padStart(3, "0")}`,
                revision,
                action: "cleared",
                itemId: id,
                reason: "The researcher rejected the tentative choice.",
              },
            ]
          : safe.interaction.selectionHistory,
    },
  };
  return finalizeScreen02Mutation(
    next,
    safe,
    "Rejecting a Screen 2 item",
  );
}

export function lockScreen02Choice(
  session: Screen02Session,
): Screen02Session {
  const safe = restoreScreen02Session(session);
  if (!safe) screen2Fail("session failed integrity validation.");
  if (safe.lockedChoice) return safe;
  if (safe.interaction.pendingRequest) {
    fail(
      "Wait for the pending Screen 2 request before locking an option.",
    );
  }
  if (safe.interaction.pendingScopeRevision) {
    fail(
      "Return to Screen 1 to resolve the pending scope revision before locking an option.",
    );
  }
  const item = safe.items.find(
    (candidate) => candidate.id === safe.selectedItemId,
  );
  if (!item) {
    fail("Select one Screen 2 option before locking the shock.");
  }
  if (!isLockableScreen02Item(safe, item)) {
    fail(
      "This option cannot be locked until at least one non-fictional source is located and the option passes the Screen 2 gate.",
    );
  }
  if (safe.interaction.selectionHistory.length >= 100) {
    screen2Fail("selection history has reached its limit.");
  }
  const revision = safe.revision + 1;
  const latestRound = safe.interaction.searchRounds.at(-1);
  const unverifiedStrictCriterionIds =
    latestRound?.stage === "native-retrieval"
      ? currentCriteriaForSession(safe)
          .filter(
            (criterion) =>
              criterion.kind === "require" || criterion.kind === "avoid",
          )
          .map((criterion) => criterion.id)
      : [];
  const lockedChoice: Screen02LockedChoice = {
    status: "locked",
    itemId: item.id,
    itemFingerprint: fingerprintSerialized(
      serializeDeterministicJson(item),
    ),
    lockedAtRevision: revision,
    mode: safe.mode,
    shockName:
      item.mode === "find"
        ? item.event.displayName
        : safe.screen01Baseline.knownShock,
    knownShockAnchor:
      item.mode === "audit"
        ? safe.screen01Baseline.knownShock
        : null,
    primaryRepresentationType:
      item.mode === "audit" ? item.representationType : null,
    primaryConstruct:
      item.mode === "audit" ? item.candidateConstruct : null,
    baselineFingerprint: safe.screen01Fingerprint,
    downstreamStatus: "screen-03-ready",
  };
  const next: Screen02Session = {
    ...safe,
    revision,
    lockedChoice,
    interaction: {
      ...safe.interaction,
      selectionHistory: [
        ...safe.interaction.selectionHistory,
        {
          id: `selection-${String(
            safe.interaction.selectionHistory.length + 1,
          ).padStart(3, "0")}`,
          revision,
          action: "locked",
          itemId: item.id,
          reason:
            unverifiedStrictCriterionIds.length > 0
              ? `The researcher explicitly locked this shock for Screen 3 evidence verification while overriding unverified strict criteria: ${unverifiedStrictCriterionIds.join(
                  ", ",
                )}.`
              : "The researcher explicitly locked this shock for Screen 3 evidence verification.",
        },
      ],
    },
  };
  return finalizeScreen02Mutation(
    next,
    safe,
    "Locking a Screen 2 choice",
  );
}

export function unlockScreen02Choice(
  session: Screen02Session,
  reason = "The researcher chose to revise the Screen 2 decision.",
): Screen02Session {
  assertString(reason, "Screen 2 unlock reason", MAX_LONG_TEXT);
  const safe = restoreScreen02Session(session);
  if (!safe) screen2Fail("session failed integrity validation.");
  if (!safe.lockedChoice) return safe;
  if (safe.interaction.selectionHistory.length >= 100) {
    screen2Fail("selection history has reached its limit.");
  }
  const revision = safe.revision + 1;
  const itemId = safe.lockedChoice.itemId;
  const next: Screen02Session = {
    ...safe,
    revision,
    lockedChoice: null,
    interaction: {
      ...safe.interaction,
      downstreamInvalidationCount:
        safe.interaction.downstreamInvalidationCount + 1,
      selectionHistory: [
        ...safe.interaction.selectionHistory,
        {
          id: `selection-${String(
            safe.interaction.selectionHistory.length + 1,
          ).padStart(3, "0")}`,
          revision,
          action: "unlocked",
          itemId,
          reason,
        },
      ],
    },
  };
  return finalizeScreen02Mutation(
    next,
    safe,
    "Unlocking a Screen 2 choice",
  );
}

export type Screen02SearchRoundInput = {
  expectedRevision: number;
  requestType: Screen02SearchRequestType;
  exactRequest: string;
  retrievedAt: string;
  proposals: readonly Screen02Proposal[];
  /**
   * Native retrieval may evaluate candidates that the common qualifier keeps
   * out of the visible proposal list. Preserve those received IDs for honest
   * round coverage without passing excluded proposal facts downstream.
   */
  evaluatedProposalIds?: readonly string[];
  searchManifest?: Screen02SearchManifestSupplement;
  criteria?: readonly Screen02PreferenceCriterion[];
  interpretationSource?:
    | "researcher-structured"
    | "ai-interpretation";
  scopeRevision?: Omit<Screen02ScopeRevisionRequest, "revision"> | null;
  deferredQuestions?: readonly Omit<
    Screen02DeferredQuestion,
    "id" | "revision" | "destination"
  >[];
  shockEvidence?: Screen02SearchRound["shockEvidence"];
  stage?: Screen02RoundStage;
  parentRoundId?: string;
  semanticDecisions?: readonly Screen02SemanticDecision[];
};

export type Screen02PreliminaryAssessmentRoundInput = {
  expectedRevision: number;
  exactRequest: string;
  retrievedAt: string;
  rootNativeRoundId: string;
  assessmentParentRoundId: string;
  /**
   * Deliberately broad so malformed model output can fail candidate by
   * candidate instead of rejecting the entire assessment turn at transport.
   */
  assessments: readonly unknown[];
};

function itemAsProposal(item: Screen02Item): Screen02Proposal {
  const shared = {
    id: item.id,
    title: item.title,
    description: item.description,
    origin: item.origin,
    provisionalDates: [...item.provisionalDates],
    affectedPopulation: item.affectedPopulation,
    requiredVariables: [...item.requiredVariables],
    outcomeLink: { ...item.outcomeLink },
    likelyServiceLevel: item.likelyServiceLevel,
    limitations: [...item.limitations],
    reasons: [...item.reasons],
    sources: cloneJson(item.sources),
  };
  if (item.mode === "find") {
    return {
      ...shared,
      mode: "find",
      kind: "event",
      event: cloneJson(item.event),
      ...(item.nativeIdentity
        ? { nativeIdentity: cloneJson(item.nativeIdentity) }
        : {}),
      ...(item.origin === "fictional-demonstration"
        ? { fictionalDemo: true as const }
        : {}),
    };
  }
  return {
    ...shared,
    mode: "audit",
    kind: "representation",
    representationType: item.representationType,
    candidateConstruct: item.candidateConstruct,
    operationalization: item.operationalization,
  };
}

function nativeCandidateFactSnapshot(
  value: Screen02Item | Screen02Proposal,
) {
  const shared = {
    id: value.id,
    mode: value.mode,
    kind: value.kind,
    title: value.title,
    description: value.description,
    origin: value.origin,
    provisionalDates: [...value.provisionalDates],
    affectedPopulation: value.affectedPopulation,
  };
  return value.mode === "find"
    ? {
        ...shared,
        event: cloneJson(value.event),
        ...(value.nativeIdentity
          ? { nativeIdentity: cloneJson(value.nativeIdentity) }
          : {}),
      }
    : {
        ...shared,
        representationType: value.representationType,
        candidateConstruct: value.candidateConstruct,
        operationalization: value.operationalization,
      };
}

function assertAiPreservesNativeCandidateFacts(
  nativeItem: Screen02Item,
  proposal: Screen02Proposal,
) {
  if (
    serializeDeterministicJson(
      nativeCandidateFactSnapshot(nativeItem),
    ) !==
    serializeDeterministicJson(
      nativeCandidateFactSnapshot(proposal),
    )
  ) {
    fail(
      `AI review proposal ${proposal.id} must preserve the native candidate's factual event or representation fields exactly.`,
    );
  }
  for (const nativeSource of nativeItem.sources) {
    const suppliedSource = proposal.sources.find(
      (source) => source.id === nativeSource.id,
    );
    if (
      !suppliedSource ||
      serializeDeterministicJson(
        normalizeSourceAuthority(suppliedSource),
      ) !==
        serializeDeterministicJson(nativeSource)
    ) {
      fail(
        `AI review proposal ${proposal.id} must preserve every native source record exactly; additional host-located leads may be appended separately.`,
      );
    }
  }
}

function proposalClustersWithNativeItem(
  nativeItem: Screen02Item,
  proposal: Screen02Proposal,
) {
  const comparison = compareScreen02Proposals(
    itemAsProposal(nativeItem),
    proposal,
  );
  return (
    comparison.compatible &&
    comparison.score >= SCREEN02_PROPOSAL_CLUSTER_THRESHOLD
  );
}

function sameCandidateAcrossRounds(
  left: Screen02Item,
  right: Screen02Item,
) {
  const comparison = compareScreen02Proposals(
    itemAsProposal(left),
    itemAsProposal(right),
  );
  return (
    comparison.compatible &&
    comparison.score >= SCREEN02_PROPOSAL_CLUSTER_THRESHOLD
  );
}

function mergeUniqueText(left: string[], right: string[]) {
  const values = new Map<string, string>();
  for (const value of [...left, ...right]) {
    const key = normalizeBoundaryText(value);
    if (!values.has(key)) values.set(key, value);
  }
  return [...values.values()];
}

function mergeAssessedItems(
  existing: Screen02Item,
  incoming: Screen02Item,
  authoritativeAiReview: boolean,
): Screen02Item {
  const primary =
    incoming.scorecard.coverage.knownWeight >
    existing.scorecard.coverage.knownWeight
      ? incoming
      : existing;
  const sources = deduplicateScreen02Sources([
    ...existing.sources,
    ...incoming.sources,
  ]);
  if (sources.length > SCREEN_02_MAX_SOURCES_PER_PROPOSAL) {
    fail(
      `Cross-round evidence consolidation would exceed the ${SCREEN_02_MAX_SOURCES_PER_PROPOSAL}-source per-candidate limit.`,
    );
  }
  const sourceSummary = summarizeScreen02Sources(sources);
  const components = { ...primary.scorecard.components };
  const reasons = { ...primary.scorecard.componentReasons };
  const details = cloneJson(primary.scorecard.componentDetails);
  details.scopeFit = {
    ...details.scopeFit,
    evidenceSourceIds: sources.map((source) => source.id),
  };
  components.sourceAuthority = sourceSummary.authorityScore;
  reasons.sourceAuthority = `Derived from ${sourceSummary.uniqueSourceCount} unique located ${
    sourceSummary.uniqueSourceCount === 1 ? "source" : "sources"
  } after cross-round deduplication.`;
  details.sourceAuthority = {
    ...details.sourceAuthority,
    method: "system-computed",
    category:
      sourceSummary.strongestAuthorityTier === null
        ? "unknown"
        : `strongest-tier-${sourceSummary.strongestAuthorityTier}`,
    evidenceSourceIds: sources.map((source) => source.id),
    reason: reasons.sourceAuthority,
    confidence: sourceSummary.authorityScore === null ? "low" : "high",
  };
  for (const key of [
    "exposureObservability",
    "timeSupport",
    "variation",
  ] as const) {
    const incomingDetail =
      incoming.scorecard.componentDetails[key];
    if (
      incomingDetail.method === "ai-rubric" ||
      (components[key] === null &&
        incoming.scorecard.components[key] !== null)
    ) {
      components[key] = incoming.scorecard.components[key];
      reasons[key] = incoming.scorecard.componentReasons[key];
      details[key] = incomingDetail;
    }
  }
  if (details.timeSupport.method === "system-computed") {
    details.timeSupport = {
      ...details.timeSupport,
      evidenceSourceIds:
        components.timeSupport === null
          ? []
          : sources.map((source) => source.id),
    };
  }
  const scorecard = scoreScreen02Feasibility(
    components,
    reasons,
    details,
  );
  const externalShockPlausibility =
    incoming.externalShockPlausibility ??
    primary.externalShockPlausibility ??
    existing.externalShockPlausibility;
  const populationApplicability =
    incoming.populationApplicability ??
    primary.populationApplicability ??
    existing.populationApplicability;
  const outcomePathway =
    incoming.outcomePathway ??
    primary.outcomePathway ??
    existing.outcomePathway;
  const outcomeLink =
    authoritativeAiReview &&
    incoming.outcomeLink.status === "ai-hypothesis"
      ? incoming.outcomeLink
      : existing.outcomeLink.status === "ai-hypothesis"
        ? existing.outcomeLink
        : incoming.outcomeLink.status === "system-template"
          ? primary.outcomeLink
          : existing.outcomeLink;
  return {
    ...primary,
    id: existing.id,
    sources,
    sourceSummary,
    scorecard,
    outcomeLink: { ...outcomeLink },
    ...(externalShockPlausibility
      ? { externalShockPlausibility }
      : {}),
    ...(populationApplicability
      ? { populationApplicability }
      : {}),
    ...(outcomePathway ? { outcomePathway } : {}),
    evidenceStatus:
      sources.length === 0
        ? "reconnaissance-required"
        : scorecard.coverage.knownComponents ===
            scorecard.coverage.totalComponents
          ? "assessed"
          : "partial",
    provisionalDates: mergeUniqueText(
      existing.provisionalDates,
      incoming.provisionalDates,
    ),
    requiredVariables: mergeUniqueText(
      existing.requiredVariables,
      incoming.requiredVariables,
    ),
    limitations: mergeUniqueText(
      incoming.limitations,
      existing.limitations,
    ),
    reasons: mergeUniqueText(incoming.reasons, existing.reasons),
  } as Screen02Item;
}

function preferenceText(item: Screen02Item) {
  return normalizeBoundaryText(
    [
      item.title,
      item.description,
      item.affectedPopulation,
      item.requiredVariables.join(" "),
      item.reasons.join(" "),
      item.mode === "find"
        ? [
            item.event.displayName,
            item.event.eventFamily,
            item.event.geographies.join(" "),
            item.event.populations.join(" "),
          ].join(" ")
        : [
            item.representationType,
            item.candidateConstruct,
            item.operationalization,
          ].join(" "),
    ].join(" "),
  );
}

function criterionNeedsSemanticInterpretation(criterion: string) {
  const normalized = normalizeBoundaryText(criterion);
  return (
    /\b(?:non|not|without|outside|except|excluding|exclude|unrelated|other than)\b/.test(
      normalized,
    ) ||
    /\b(?:doesn|don|isn|aren|wasn|weren|shouldn|wouldn|couldn) t\b/.test(
      normalized,
    )
  );
}

function criterionMatchesLexically(item: Screen02Item, criterion: string) {
  const terms = normalizeBoundaryText(criterion)
    .split(" ")
    .filter((term) => term.length >= 3);
  if (terms.length === 0) return false;
  const text = preferenceText(item);
  const matched = terms.filter((term) => text.includes(term)).length;
  return matched / terms.length >= 0.5;
}

function criterionMatchesDirectly(item: Screen02Item, criterion: string) {
  if (criterionNeedsSemanticInterpretation(criterion)) return false;
  const normalized = normalizeBoundaryText(criterion);
  if (normalized.length < 3) return false;
  return ` ${preferenceText(item)} `.includes(` ${normalized} `);
}

function currentCriteriaForSession(session: Screen02Session) {
  const currentIds = new Set(
    session.interaction.searchRounds.at(-1)?.preferenceCriteriaIds ?? [],
  );
  return session.interaction.preferences.criteria.filter((criterion) =>
    currentIds.has(criterion.id),
  );
}

function applyDirectDoNotShowCriteria(
  items: Screen02Item[],
  criteria: readonly Screen02PreferenceCriterion[],
) {
  const exclusions: Screen02ExclusionLog[] = [];
  const doNotShow = criteria.filter(
    (criterion) =>
      criterion.kind === "avoid" &&
      !criterionNeedsSemanticInterpretation(criterion.text),
  );
  const retained = items.filter((item) => {
    const matched = doNotShow.filter((criterion) =>
      criterionMatchesDirectly(item, criterion.text),
    );
    if (matched.length === 0) return true;
    exclusions.push(
      ...matched.map((criterion) => ({
        proposalId: item.id,
        filter: "validation" as const,
        reason: `Excluded by the explicit do-not-show criterion “${criterion.text}” because that exact normalized phrase appears in the candidate metadata.`,
      })),
    );
    return false;
  });
  return { retained, exclusions };
}

function preferenceAssessments(
  items: Screen02Item[],
  criteria: Screen02PreferenceCriterion[],
  revision: number,
) {
  return items.map((item) => {
    if (criteria.length === 0) {
      return {
        itemId: item.id,
        score: null,
        matchedCriteriaIds: [],
        unmetRequiredCriteriaIds: [],
        reasons: [
          "No researcher preference criteria have been recorded. Scientific feasibility remains separate.",
        ],
        computedAtRevision: revision,
      };
    }
    const ambiguousCriteria = criteria.filter((criterion) =>
      criterionNeedsSemanticInterpretation(criterion.text),
    );
    const matched = criteria.filter((criterion) =>
      criterion.kind === "avoid"
        ? criterionMatchesDirectly(item, criterion.text)
        : criterionMatchesLexically(item, criterion.text),
    );
    const unmetRequired = criteria.filter(
      (criterion) =>
        criterion.kind === "require" &&
        !matched.some((entry) => entry.id === criterion.id),
    );
    const preferTotal = criteria.filter(
      (criterion) => criterion.kind === "prefer",
    ).length;
    const avoidTotal = criteria.filter(
      (criterion) => criterion.kind === "avoid",
    ).length;
    const preferredMatches = matched.filter(
      (criterion) => criterion.kind === "prefer",
    ).length;
    const avoidedMatches = matched.filter(
      (criterion) => criterion.kind === "avoid",
    ).length;
    const denominator = Math.max(1, preferTotal + avoidTotal);
    const score =
      unmetRequired.length > 0
        ? 0
        : Math.max(
            0,
            Math.min(
              100,
              roundScore(
                50 +
                  ((preferredMatches - avoidedMatches) / denominator) *
                    50,
              ),
            ),
          );
    return {
      itemId: item.id,
      score,
      matchedCriteriaIds: matched.map((criterion) => criterion.id),
      unmetRequiredCriteriaIds: unmetRequired.map(
        (criterion) => criterion.id,
      ),
      reasons: [
        unmetRequired.length > 0
          ? `${unmetRequired.length} required preference criterion or criteria are not matched by the candidate text.`
          : "All recorded required preference criteria are textually compatible with the candidate.",
        "Preference fit is only a transparent lexical aid, separate from scientific feasibility. It determines neither selection nor lockability.",
        ...ambiguousCriteria.map(
          (criterion) =>
            `The criterion “${criterion.text}” contains negation or another semantic qualifier. Fixed code left it unevaluated for AI or researcher clarification.`,
        ),
      ],
      computedAtRevision: revision,
    };
  });
}

function assertConcisePreliminaryNarrative(
  value: unknown,
  label: string,
): asserts value is string {
  assertString(value, label, 800);
  if ((value as string).trim().length < 30) {
    fail(`${label} must contain at least 30 characters.`);
  }
}

function assertPreliminaryOutcomeMechanism(
  nativeItem: Screen02Item,
  outcomeFamily: string,
  outcomeMechanism: string,
) {
  const normalizedMechanism = normalizedAssessmentNarrative(
    outcomeMechanism,
  );
  const normalizedOutcomeFamily = normalizedAssessmentNarrative(
    outcomeFamily,
  );
  if (
    !proposalGroundsNarrative(
      itemAsProposal(nativeItem),
      outcomeMechanism,
    )
  ) {
    fail(
      "The outcome mechanism must contain a candidate-specific title, description, or attached-source anchor.",
    );
  }
  if (
    normalizedMechanism.length === 0 ||
    normalizedOutcomeFamily.length === 0 ||
    !` ${normalizedMechanism} `.includes(` ${normalizedOutcomeFamily} `)
  ) {
    fail(
      "The outcome mechanism must name the confirmed outcome family exactly.",
    );
  }
}

function buildPreliminaryAssessment(
  entry: unknown,
  nativeItem: Screen02Item,
  outcomeFamily: string,
  rootNativeRoundId: string,
  revision: number,
): Screen02PreliminaryAssessment {
  if (!isRecord(entry)) {
    fail("The assessment entry must be an object.");
  }
  assertExactKeys(
    entry,
    [
      "itemId",
      "judgment",
      "studyFit",
      "affectedPopulation",
      "outcomeMechanism",
      "mainConcern",
      "evidenceSourceIds",
      "nextChecks",
    ],
    `Preliminary assessment for ${nativeItem.id}`,
  );
  if (entry.itemId !== nativeItem.id) {
    fail("The assessment entry does not match its candidate id.");
  }
  if (!preliminaryAssessmentJudgmentSet.has(String(entry.judgment))) {
    fail("The preliminary judgment is invalid.");
  }
  assertConcisePreliminaryNarrative(
    entry.studyFit,
    `Preliminary assessment for ${nativeItem.id}.studyFit`,
  );
  assertConcisePreliminaryNarrative(
    entry.mainConcern,
    `Preliminary assessment for ${nativeItem.id}.mainConcern`,
  );
  if (entry.affectedPopulation !== null) {
    assertString(
      entry.affectedPopulation,
      `Preliminary assessment for ${nativeItem.id}.affectedPopulation`,
      800,
    );
  }
  if (entry.outcomeMechanism !== null) {
    assertConcisePreliminaryNarrative(
      entry.outcomeMechanism,
      `Preliminary assessment for ${nativeItem.id}.outcomeMechanism`,
    );
  }
  assertStringList(
    entry.evidenceSourceIds,
    `Preliminary assessment for ${nativeItem.id}.evidenceSourceIds`,
    {
      allowEmpty: true,
      maxText: 120,
      maxItems: SCREEN_02_MAX_SOURCES_PER_PROPOSAL,
    },
  );
  assertStringList(
    entry.nextChecks,
    `Preliminary assessment for ${nativeItem.id}.nextChecks`,
    { maxText: 800, maxItems: 2 },
  );
  const evidenceSourceIds = entry.evidenceSourceIds as string[];
  const nextChecks = entry.nextChecks as string[];
  const attachedSourceIds = new Set(
    nativeItem.sources.map((source) => source.id),
  );
  if (
    new Set(evidenceSourceIds).size !== evidenceSourceIds.length ||
    !evidenceSourceIds.every((sourceId) =>
      attachedSourceIds.has(sourceId),
    )
  ) {
    fail(
      "Evidence IDs must be unique and attached to this native candidate.",
    );
  }
  if (new Set(nextChecks).size !== nextChecks.length) {
    fail("Next checks must be distinct.");
  }
  if (
    entry.judgment !== "not-enough-evidence" &&
    evidenceSourceIds.length === 0
  ) {
    fail(
      "A judgment other than not-enough-evidence must cite attached evidence.",
    );
  }
  if (
    entry.judgment !== "not-enough-evidence" &&
    entry.outcomeMechanism === null
  ) {
    fail(
      "A judgment other than not-enough-evidence requires an outcome mechanism.",
    );
  }
  if (
    entry.affectedPopulation !== null &&
    evidenceSourceIds.length === 0
  ) {
    fail(
      "A source-established affected population must cite attached evidence.",
    );
  }
  if (entry.outcomeMechanism !== null) {
    assertPreliminaryOutcomeMechanism(
      nativeItem,
      outcomeFamily,
      entry.outcomeMechanism as string,
    );
  }
  const assessment: Screen02PreliminaryAssessment = {
    schemaVersion: SCREEN_02_PRELIMINARY_ASSESSMENT_SCHEMA_VERSION,
    method: "ai-preliminary",
    judgment:
      entry.judgment as Screen02PreliminaryAssessment["judgment"],
    studyFit: entry.studyFit as string,
    affectedPopulation: entry.affectedPopulation as string | null,
    outcomeMechanism: entry.outcomeMechanism as string | null,
    mainConcern: entry.mainConcern as string,
    evidenceSourceIds: [...evidenceSourceIds],
    nextChecks: [...nextChecks],
    rootNativeRoundId,
    assessedAtRevision: revision,
  };
  assertStoredPreliminaryAssessment(
    assessment,
    nativeItem.sources,
    `Preliminary assessment for ${nativeItem.id}`,
  );
  return assessment;
}

/**
 * Appends a compact assessment-only round. Candidate facts are hydrated from
 * the root native snapshot, while each generated entry is accepted or marked
 * for retry independently. The current candidate set and its display order do
 * not change in this mutation.
 */
export function applyScreen02PreliminaryAssessmentRound(
  session: Screen02Session,
  input: Screen02PreliminaryAssessmentRoundInput,
): Screen02Session {
  const safe = restoreScreen02Session(session);
  if (!safe) screen2Fail("session failed integrity validation.");
  if (safe.lockedChoice) {
    fail(
      "The shock is locked. Unlock it before recording a preliminary assessment.",
    );
  }
  if (input.expectedRevision !== safe.revision) {
    fail(
      `Stale Screen 2 response: expected revision ${safe.revision}, received ${input.expectedRevision}.`,
    );
  }
  if (
    safe.interaction.searchRounds.length >= SCREEN_02_MAX_SEARCH_ROUNDS
  ) {
    screen2Fail(`permits at most ${SCREEN_02_MAX_SEARCH_ROUNDS} documented search rounds in one active run.`,
    );
  }
  if (
    safe.interaction.pendingRequest ||
    safe.interaction.pendingScopeRevision
  ) {
    fail(
      "A preliminary assessment cannot be recorded while another Screen 2 mutation is pending.",
    );
  }
  assertString(input.exactRequest, "Screen 2 assessment request", MAX_LONG_TEXT);
  assertString(input.retrievedAt, "Screen 2 assessment time", MAX_SHORT_TEXT);
  assertString(input.rootNativeRoundId, "Root native round id", 120);
  assertString(
    input.assessmentParentRoundId,
    "Assessment parent round id",
    120,
  );
  if (
    !Array.isArray(input.assessments) ||
    input.assessments.length === 0 ||
    input.assessments.length > SCREEN_02_MAX_PROPOSALS
  ) {
    fail(
      `A preliminary assessment turn must contain 1–${SCREEN_02_MAX_PROPOSALS} candidate entries.`,
    );
  }

  const assessmentParentRound = safe.interaction.searchRounds.at(-1);
  const rootNativeRound = safe.interaction.searchRounds.find(
    (round) => round.id === input.rootNativeRoundId,
  );
  if (
    !assessmentParentRound ||
    !rootNativeRound ||
    input.assessmentParentRoundId !== assessmentParentRound.id ||
    rootNativeRound.stage !== "native-retrieval" ||
    rootNativeRound.requestType === "initial" ||
    rootNativeRound.parentRoundId !== undefined ||
    rootNativeRound.assessmentParentRoundId !== undefined ||
    !(
      (assessmentParentRound.id === rootNativeRound.id &&
        assessmentParentRound.stage === "native-retrieval") ||
      (assessmentParentRound.stage === "preliminary-assessment" &&
        assessmentParentRound.rootNativeRoundId === rootNativeRound.id)
    ) ||
    serializeDeterministicJson(assessmentParentRound.itemIdsRetained) !==
      serializeDeterministicJson(rootNativeRound.itemIdsRetained)
  ) {
    fail(
      "The preliminary assessment must parent the current native round or its latest assessment retry.",
    );
  }
  if (rootNativeRound.itemIdsRetained.length === 0) {
    fail("The root native round has no visible candidates to assess.");
  }
  const priorAssessmentRoundCount = safe.interaction.searchRounds.filter(
    (round) =>
      round.stage === "preliminary-assessment" &&
      round.rootNativeRoundId === rootNativeRound.id,
  ).length;
  if (
    priorAssessmentRoundCount >=
    SCREEN_02_MAX_PRELIMINARY_ASSESSMENT_ROUNDS_PER_ROOT
  ) {
    screen2Fail(`permits at most ${SCREEN_02_MAX_PRELIMINARY_ASSESSMENT_ROUNDS_PER_ROOT} preliminary-assessment rounds per native result set (one initial assessment plus two retries).`,
    );
  }

  const retryableItemIds =
    assessmentParentRound.stage === "preliminary-assessment"
      ? new Set(
          (assessmentParentRound.assessmentResults ?? [])
            .filter((result) => result.status === "needs-retry")
            .map((result) => result.itemId),
        )
      : new Set(rootNativeRound.itemIdsRetained);
  if (
    assessmentParentRound.stage === "preliminary-assessment" &&
    retryableItemIds.size === 0
  ) {
    fail(
      "The latest preliminary-assessment round has no candidates marked needs-retry.",
    );
  }

  const versionById = new Map(
    safe.interaction.itemVersions.map((version) => [
      version.versionId,
      version,
    ]),
  );
  const rootNativeItems = rootNativeRound.assessedItemVersionIds.map(
    (versionId, index) => {
      const version = versionById.get(versionId);
      if (!version || version.itemId !== rootNativeRound.itemIdsRetained[index]) {
        fail(
          "The root native round cannot hydrate its candidate facts.",
        );
      }
      const item = cloneJson(version.item);
      delete item.preliminaryAssessment;
      item.rank = index + 1;
      return item;
    },
  );
  const currentItemById = new Map(
    safe.items.map((item) => [item.id, item]),
  );
  if (
    rootNativeItems.some((item) => !currentItemById.has(item.id))
  ) {
    fail(
      "The root native candidates are no longer present in the active ledger.",
    );
  }

  const groupedEntries = new Map<string, unknown[]>();
  const resubmittedAcceptedItemIds = new Set<string>();
  const visibleItemIds = new Set(rootNativeRound.itemIdsRetained);
  for (const entry of input.assessments) {
    if (!isRecord(entry) || typeof entry.itemId !== "string") continue;
    if (!visibleItemIds.has(entry.itemId)) continue;
    if (!retryableItemIds.has(entry.itemId)) {
      resubmittedAcceptedItemIds.add(entry.itemId);
      continue;
    }
    const group = groupedEntries.get(entry.itemId) ?? [];
    group.push(entry);
    groupedEntries.set(entry.itemId, group);
  }
  const revision = safe.revision + 1;
  const assessmentResults: Screen02PreliminaryAssessmentResult[] = [];
  const currentItems = rootNativeItems.map((nativeItem) => {
    const priorAssessment = currentItemById.get(nativeItem.id)
      ?.preliminaryAssessment;
    const preservedAssessment =
      priorAssessment?.rootNativeRoundId === rootNativeRound.id
        ? cloneJson(priorAssessment)
        : undefined;
    const entries = groupedEntries.get(nativeItem.id) ?? [];
    let preliminaryAssessment = preservedAssessment;
    let result: Screen02PreliminaryAssessmentResult;
    if (entries.length === 1) {
      try {
        preliminaryAssessment = buildPreliminaryAssessment(
          entries[0],
          nativeItem,
          safe.screen01Baseline.scopeContract.outcomeFamily,
          rootNativeRound.id,
          revision,
        );
        result = {
          itemId: nativeItem.id,
          status: "assessed",
          reason: "The compact preliminary assessment was accepted.",
        };
      } catch (error) {
        if (preliminaryAssessment) {
          result = {
            itemId: nativeItem.id,
            status: "assessed",
            reason:
              "The prior accepted assessment remains in force; an invalid replacement was ignored.",
          };
        } else {
          const detail =
            error instanceof Error
              ? error.message
              : "The supplied assessment entry is invalid.";
          const safeDetail = detail.replace(/[\0\u2028\u2029]/g, " ");
          result = {
            itemId: nativeItem.id,
            status: "needs-retry",
            reason: `Needs retry: ${safeDetail}`.slice(0, MAX_LONG_TEXT),
          };
        }
      }
    } else if (entries.length > 1) {
      result = preliminaryAssessment
        ? {
            itemId: nativeItem.id,
            status: "assessed",
            reason:
              "The prior accepted assessment remains in force; duplicate replacement entries were ignored.",
          }
        : {
            itemId: nativeItem.id,
            status: "needs-retry",
            reason:
              "Needs retry: duplicate entries made this candidate assessment ambiguous.",
          };
    } else {
      result = preliminaryAssessment
        ? {
            itemId: nativeItem.id,
            status: "assessed",
            reason: resubmittedAcceptedItemIds.has(nativeItem.id)
              ? "The previously accepted compact assessment remains current; a resubmitted replacement was ignored."
              : "The previously accepted compact assessment remains current.",
          }
        : {
            itemId: nativeItem.id,
            status: "needs-retry",
            reason: "Needs retry: no assessment entry was supplied for this candidate.",
          };
    }
    assessmentResults.push(result);
    return {
      ...nativeItem,
      ...(preliminaryAssessment ? { preliminaryAssessment } : {}),
    } as Screen02Item;
  });

  const replacements = new Map(
    currentItems.map((item) => [item.id, item]),
  );
  const items = rankItems(
    safe.items.map((item) => replacements.get(item.id) ?? cloneJson(item)),
  );
  const assessedVersionLedger = appendItemVersions(
    safe.interaction.itemVersions,
    preserveItemOrder(currentItems),
    revision,
  );
  const activeVersionLedger = appendItemVersions(
    assessedVersionLedger.versions,
    items,
    revision,
  );
  const round: Screen02SearchRound = {
    id: `round-${String(safe.interaction.searchRounds.length).padStart(3, "0")}`,
    revision,
    requestType: rootNativeRound.requestType,
    stage: "preliminary-assessment",
    exactRequest: input.exactRequest,
    retrievedAt: input.retrievedAt,
    searchProtocolVersion: SCREEN_02_SEARCH_PROTOCOL_VERSION,
    preferenceCriteriaIds: [...rootNativeRound.preferenceCriteriaIds],
    proposalIdsReceived: [],
    itemIdsRetained: [...rootNativeRound.itemIdsRetained],
    itemIdsAdded: [],
    duplicateProposalIds: [],
    rejectedItemIds: [],
    assessedItemVersionIds: assessedVersionLedger.versionIds,
    activeItemVersionIds: activeVersionLedger.versionIds,
    assessmentParentRoundId: assessmentParentRound.id,
    rootNativeRoundId: rootNativeRound.id,
    assessmentResults,
    discovery: cloneJson(rootNativeRound.discovery),
    manifest: cloneJson(rootNativeRound.manifest),
  };
  const activeCriterionIds = new Set(rootNativeRound.preferenceCriteriaIds);
  const activeCriteria = safe.interaction.preferences.criteria.filter(
    (criterion) => activeCriterionIds.has(criterion.id),
  );
  const next: Screen02Session = {
    ...safe,
    revision,
    items,
    searchManifest: cloneJson(safe.searchManifest),
    interaction: {
      ...safe.interaction,
      preferenceAssessments:
        activeCriteria.length === 0
          ? []
          : preferenceAssessments(currentItems, activeCriteria, revision),
      itemVersions: activeVersionLedger.versions,
      searchRounds: [...safe.interaction.searchRounds, round],
    },
  };
  return finalizeScreen02Mutation(
    next,
    safe,
    "Applying compact preliminary Screen 2 assessments",
  );
}

export function applyScreen02SearchRound(
  session: Screen02Session,
  input: Screen02SearchRoundInput,
): Screen02Session {
  const safe = restoreScreen02Session(session);
  if (!safe) screen2Fail("session failed integrity validation.");
  if (safe.lockedChoice) {
    fail(
      "The shock is locked. Unlock it before requesting another Screen 2 search round.",
    );
  }
  if (
    !["find-more", "refine", "none-fit", "user-source"].includes(
      input.requestType,
    )
  ) {
    fail(
      "A follow-up Screen 2 round must use a recognized interactive request type.",
    );
  }
  if (input.expectedRevision !== safe.revision) {
    fail(
      `Stale Screen 2 response: expected revision ${safe.revision}, received ${input.expectedRevision}.`,
    );
  }
  if (
    safe.interaction.searchRounds.length >= SCREEN_02_MAX_SEARCH_ROUNDS
  ) {
    screen2Fail(`permits at most ${SCREEN_02_MAX_SEARCH_ROUNDS} documented search rounds in one active run.`,
    );
  }
  const researcherSearchRounds = safe.interaction.searchRounds.filter(
    (round) =>
      round.requestType !== "initial" &&
      round.stage !== "ai-review" &&
      round.stage !== "preliminary-assessment",
  ).length;
  if (
    input.stage !== "ai-review" &&
    researcherSearchRounds >= SCREEN_02_MAX_RESEARCHER_SEARCH_ROUNDS
  ) {
    screen2Fail(`permits at most ${SCREEN_02_MAX_RESEARCHER_SEARCH_ROUNDS} researcher search or proposal rounds in one active run.`,
    );
  }
  assertString(input.exactRequest, "Screen 2 exact request", MAX_LONG_TEXT);
  assertString(input.retrievedAt, "Screen 2 retrieval time", MAX_SHORT_TEXT);
  const criteria = cloneJson([...(input.criteria ?? [])]);
  if (
    safe.interaction.preferences.criteria.length + criteria.length >
    SCREEN_02_MAX_PREFERENCE_CRITERIA
  ) {
    screen2Fail(`accepts at most ${SCREEN_02_MAX_PREFERENCE_CRITERIA} versioned preference criteria.`,
    );
  }
  const criterionIds = new Set(
    safe.interaction.preferences.criteria.map((criterion) => criterion.id),
  );
  for (const criterion of criteria) {
    if (
      !isRecord(criterion) ||
      !["require", "prefer", "avoid"].includes(criterion.kind)
    ) {
      screen2Fail("preference criterion is invalid.");
    }
    assertExactKeys(
      criterion,
      ["id", "kind", "text", "source", "exactRequest"],
      "Screen 2 preference criterion",
    );
    assertString(criterion.id, "Preference criterion id", 120);
    assertString(criterion.text, "Preference criterion text", MAX_LONG_TEXT);
    assertString(
      criterion.exactRequest,
      "Preference criterion exact request",
      MAX_LONG_TEXT,
    );
    if (
      !["researcher", "ai-interpretation"].includes(
        String(criterion.source),
      )
    ) {
      screen2Fail("preference criterion source is invalid.");
    }
    if (criterionIds.has(criterion.id)) {
      fail(`Duplicate preference criterion id: ${criterion.id}.`);
    }
    criterionIds.add(criterion.id);
  }
  const pendingRequest = safe.interaction.pendingRequest;
  if (
    pendingRequest &&
    (pendingRequest.baseRevision !== safe.revision ||
      pendingRequest.expectedRevision !== safe.revision + 1 ||
      pendingRequest.requestType !== input.requestType ||
      pendingRequest.exactText !== input.exactRequest ||
      pendingRequest.criteria.some(
        (pendingCriterion) =>
          !criteria.some(
            (criterion) =>
              criterion.kind === pendingCriterion.kind &&
              criterion.text === pendingCriterion.text,
          ),
      ))
  ) {
    fail(
      "The authoritative Screen 2 response does not match the persisted pending request.",
    );
  }
  if (
    input.interpretationSource !== undefined &&
    !["researcher-structured", "ai-interpretation"].includes(
      input.interpretationSource,
    )
  ) {
    screen2Fail("preference interpretation source is invalid.");
  }
  if (
    input.stage !== undefined &&
    ![
      "native-retrieval",
      "ai-review",
      "researcher-assessment",
    ].includes(input.stage)
  ) {
    screen2Fail("round stage is invalid.");
  }
  if (
    input.stage === "ai-review" &&
    input.interpretationSource !== "ai-interpretation"
  ) {
    fail(
      "Only an AI-interpreted completion can record an AI-review stage.",
    );
  }
  if (input.stage === "ai-review" && criteria.length > 0) {
    fail(
      "An AI-review child round must apply the parent native round's recorded criteria rather than create duplicate criteria.",
    );
  }
  if (
    !Array.isArray(input.proposals) ||
    input.proposals.length > SCREEN_02_MAX_PROPOSALS
  ) {
    screen2Fail(
      `accepts at most ${SCREEN_02_MAX_PROPOSALS} raw proposals per search round.`,
    );
  }
  const evaluatedProposalIds = input.evaluatedProposalIds === undefined
    ? input.proposals.map((proposal) => proposal.id)
    : [...input.evaluatedProposalIds];
  assertStringList(
    evaluatedProposalIds,
    "Screen 2 evaluated proposal ids",
    {
      allowEmpty: true,
      maxText: 180,
      maxItems: SCREEN_02_MAX_PROPOSALS,
    },
  );
  if (new Set(evaluatedProposalIds).size !== evaluatedProposalIds.length) {
    fail("Screen 2 evaluated proposal ids contain duplicates.");
  }
  const evaluatedProposalIdSet = new Set(evaluatedProposalIds);
  if (
    input.proposals.some(
      (proposal) => !evaluatedProposalIdSet.has(proposal.id),
    )
  ) {
    fail(
      "Every retained Screen 2 proposal must appear in the evaluated proposal ids.",
    );
  }
  const revision = safe.revision + 1;
  const interactionRequestHistory = pendingRequest
    ? appendInteractionRequestEvent(
        safe.interaction.interactionRequestHistory,
        pendingRequest,
        "reconciled",
        revision,
      )
    : safe.interaction.interactionRequestHistory;
  const allCriteria = [
    ...safe.interaction.preferences.criteria,
    ...criteria,
  ];
  const parentRound = safe.interaction.searchRounds.at(-1);
  const appliedCriteria =
    input.stage === "ai-review" && parentRound
      ? allCriteria.filter((criterion) =>
          parentRound.preferenceCriteriaIds.includes(criterion.id),
        )
      : criteria;
  const request: Screen02PreferenceRequest | null =
    criteria.length === 0
      ? null
      : {
          id: `preference-request-${String(
            safe.interaction.preferences.requests.length + 1,
          ).padStart(3, "0")}`,
          exactText: input.exactRequest,
          criteriaIds: criteria.map((criterion) => criterion.id),
          interpretationSource:
            input.interpretationSource ?? "researcher-structured",
        };
  const scopeRevision = input.scopeRevision
    ? {
        ...cloneJson(input.scopeRevision),
        revision,
      }
    : null;
  if (scopeRevision) {
    assertExactKeys(
      scopeRevision,
      ["revision", "exactRequest", "conflictingFields", "reason"],
      "Scope revision request",
    );
    assertString(
      scopeRevision.exactRequest,
      "Scope revision exact request",
      MAX_LONG_TEXT,
    );
    assertString(
      scopeRevision.reason,
      "Scope revision reason",
      MAX_LONG_TEXT,
    );
    assertStringList(
      scopeRevision.conflictingFields,
      "Scope revision conflicting fields",
      { maxText: 120 },
    );
  }
  if ((input.deferredQuestions?.length ?? 0) > MAX_LIST_ITEMS) {
    screen2Fail(`accepts at most ${MAX_LIST_ITEMS} deferred Screen 3 questions per round.`,
    );
  }
  if (
    safe.interaction.deferredQuestions.length +
      (input.deferredQuestions?.length ?? 0) >
    100
  ) {
    screen2Fail("cannot retain more than 100 deferred Screen 3 questions.",
    );
  }
  const deferredQuestions = (input.deferredQuestions ?? []).map(
    (question, index) => {
      if (!isRecord(question)) {
        fail("A deferred Screen 3 question is invalid.");
      }
      assertExactKeys(
        question,
        ["exactRequest", "reason"],
        "Deferred Screen 3 question",
      );
      assertString(
        question.exactRequest,
        "Deferred Screen 3 exact request",
        MAX_LONG_TEXT,
      );
      assertString(
        question.reason,
        "Deferred Screen 3 reason",
        MAX_LONG_TEXT,
      );
      return {
        id: `screen03-question-${String(
          safe.interaction.deferredQuestions.length + index + 1,
        ).padStart(3, "0")}`,
        revision,
        exactRequest: question.exactRequest,
        reason: question.reason,
        destination: "screen-03" as const,
      };
    },
  );
  const shockEvidence = input.shockEvidence
    ? cloneJson(input.shockEvidence)
    : undefined;
  if (shockEvidence) {
    assertExactKeys(
      shockEvidence,
      [
        "status",
        "anchorShock",
        "matchMethod",
        "proposalIds",
        "candidateNames",
        "sources",
        "provisionalDates",
        "affectedPopulations",
        "note",
      ],
      "Shock-level reconnaissance evidence",
    );
    if (
      shockEvidence.status !== "shock-level-reconnaissance" ||
      shockEvidence.matchMethod !== "exact-name-or-controlled-alias"
    ) {
      fail("Shock-level reconnaissance metadata is invalid.");
    }
    assertString(
      shockEvidence.anchorShock,
      "Shock-level evidence anchor",
      MAX_LONG_TEXT,
    );
    if (
      safe.mode === "audit" &&
      !textAnchorsKnownShock(
        shockEvidence.anchorShock,
        safe.screen01Baseline.knownShock,
      )
    ) {
      fail(
        "Shock-level reconnaissance changed the known-shock anchor.",
      );
    }
    assertString(
      shockEvidence.note,
      "Shock-level evidence note",
      MAX_LONG_TEXT,
    );
    assertStringList(
      shockEvidence.proposalIds,
      "Shock-level evidence proposal ids",
      { allowEmpty: true, maxText: 180, maxItems: 40 },
    );
    assertStringList(
      shockEvidence.candidateNames,
      "Shock-level evidence candidate names",
      { allowEmpty: true, maxText: MAX_LONG_TEXT, maxItems: 40 },
    );
    assertStringList(
      shockEvidence.provisionalDates,
      "Shock-level evidence provisional dates",
      { allowEmpty: true, maxText: MAX_LONG_TEXT, maxItems: 30 },
    );
    assertStringList(
      shockEvidence.affectedPopulations,
      "Shock-level evidence affected populations",
      { allowEmpty: true, maxText: MAX_LONG_TEXT, maxItems: 30 },
    );
    if (
      !Array.isArray(shockEvidence.sources) ||
      shockEvidence.sources.length > SCREEN_02_MAX_SOURCES_PER_PROPOSAL
    ) {
      fail("Shock-level evidence sources exceed their limit.");
    }
    shockEvidence.sources.forEach((source, index) =>
      assertSource(source, `Shock-level evidence source ${index}`),
    );
  }
  if (scopeRevision) {
    const blocked: Screen02Session = {
      ...safe,
      revision,
      interaction: {
        ...safe.interaction,
        preferences: {
          ...safe.interaction.preferences,
          criteria: allCriteria,
          requests: request
            ? [...safe.interaction.preferences.requests, request]
            : safe.interaction.preferences.requests,
        },
        pendingRequest: null,
        interactionRequestHistory,
        pendingScopeRevision: scopeRevision,
        deferredQuestions: [
          ...safe.interaction.deferredQuestions,
          ...deferredQuestions,
        ],
      },
    };
    return finalizeScreen02Mutation(
      blocked,
      safe,
      "Recording a Screen 1 scope-revision request",
    );
  }

  const prepared = prepareScreen02Discovery(
    input.proposals,
    safe.screen01Baseline as Screen01StudyContext,
    appliedCriteria,
    input.interpretationSource === "ai-interpretation",
  );
  let semanticDecisions:
    | Screen02SemanticDecision[]
    | undefined;
  if (
    input.parentRoundId !== undefined ||
    input.semanticDecisions !== undefined
  ) {
    if (
      input.interpretationSource !== "ai-interpretation" ||
      input.stage !== "ai-review" ||
      input.parentRoundId === undefined ||
      input.semanticDecisions === undefined ||
      !parentRound ||
      parentRound.requestType === "initial" ||
      parentRound.stage !== "native-retrieval" ||
      parentRound.parentRoundId !== undefined ||
      input.parentRoundId !== parentRound.id
    ) {
      fail(
        "A semantic AI review must identify the immediately preceding native Screen 2 round.",
      );
    }
    semanticDecisions = cloneJson([...input.semanticDecisions]);
    if (
      semanticDecisions.length !==
      parentRound.itemIdsRetained.length
    ) {
      fail(
        "The semantic AI review must account for every candidate in its parent native round.",
      );
    }
    const parentItemIds = new Set(parentRound.itemIdsRetained);
    const parentCriterionIds = new Set(
      parentRound.preferenceCriteriaIds,
    );
    const strictCriterionIds = new Set(
      safe.interaction.preferences.criteria
        .filter(
          (criterion) =>
            parentCriterionIds.has(criterion.id) &&
            (criterion.kind === "require" ||
              criterion.kind === "avoid"),
        )
        .map((criterion) => criterion.id),
    );
    const proposalIds = new Set(
      input.proposals.map((proposal) => proposal.id),
    );
    const parentNativeItems = new Map(
      safe.items
        .filter((item) => parentItemIds.has(item.id))
        .map((item) => [item.id, item]),
    );
    for (const proposal of input.proposals) {
      const nativeItem = parentNativeItems.get(proposal.id);
      if (nativeItem) {
        assertAiPreservesNativeCandidateFacts(nativeItem, proposal);
        continue;
      }
      const aliasedNativeItem = [...parentNativeItems.values()].find(
        (candidate) =>
          proposalClustersWithNativeItem(candidate, proposal),
      );
      if (aliasedNativeItem) {
        fail(
          `AI review proposal ${proposal.id} clusters with native candidate ${aliasedNativeItem.id}; retain that candidate only under its exact native id and factual snapshot.`,
        );
      }
    }
    const decisionItemIds = new Set<string>();
    semanticDecisions.forEach((decision, index) => {
      if (!isRecord(decision)) {
        fail(
          `Semantic decision ${index} must be an object.`,
        );
      }
      assertExactKeys(
        decision,
        [
          "itemId",
          "decision",
          "criterionIds",
          "scopeMismatchFields",
          "reason",
        ],
        `Semantic decision ${index}`,
      );
      assertString(
        decision.itemId,
        `Semantic decision ${index} item id`,
        180,
      );
      assertString(
        decision.reason,
        `Semantic decision ${index} reason`,
        MAX_LONG_TEXT,
      );
      assertStringList(
        decision.criterionIds,
        `Semantic decision ${index} criterion ids`,
        { allowEmpty: true, maxText: 120, maxItems: 3 },
      );
      const scopeMismatchFields =
        decision.scopeMismatchFields ?? [];
      assertStringList(
        scopeMismatchFields,
        `Semantic decision ${index} locked-scope mismatch fields`,
        {
          allowEmpty: true,
          maxText: 40,
          maxItems: screen02SemanticScopeFields.length,
        },
      );
      if (
        !["retained", "excluded"].includes(decision.decision) ||
        !parentItemIds.has(decision.itemId) ||
        decisionItemIds.has(decision.itemId) ||
        new Set(decision.criterionIds).size !==
          decision.criterionIds.length ||
        !decision.criterionIds.every((id) =>
          parentCriterionIds.has(id),
        ) ||
        new Set(scopeMismatchFields).size !==
          scopeMismatchFields.length ||
        !scopeMismatchFields.every((field) =>
          screen02SemanticScopeFields.includes(field),
        ) ||
        (decision.decision === "retained" &&
          scopeMismatchFields.length > 0)
      ) {
        fail(
          `Semantic decision ${index} does not match the parent native round.`,
        );
      }
      if (
        decision.decision === "retained" &&
        !proposalIds.has(decision.itemId)
      ) {
        fail(
          `Retained native candidate ${decision.itemId} is missing from the AI-review proposals.`,
        );
      }
      if (
        decision.decision === "excluded" &&
        (proposalIds.has(decision.itemId) ||
          (decision.criterionIds.length === 0 &&
            scopeMismatchFields.length === 0) ||
          !decision.criterionIds.every((id) =>
            strictCriterionIds.has(id),
          ))
      ) {
        fail(
          `Excluded native candidate ${decision.itemId} must cite a parent only-include/do-not-show criterion or a locked Screen 1 industry/outcome mismatch, and must not remain in the proposals.`,
        );
      }
      decisionItemIds.add(decision.itemId);
    });
  } else if (input.stage === "ai-review") {
    fail(
      "An AI-review stage requires a parent round and semantic decisions.",
    );
  }
  if (input.interpretationSource === "ai-interpretation") {
    // prepareScreen02Discovery has already validated every raw proposal. Apply
    // the stricter host-AI contract to the raw list as well, so a duplicate
    // cannot evade completeness checks by being removed during deduplication.
    assertCompleteAiProposalAssessments(
      input.proposals,
      safe.screen01Baseline,
      semanticDecisions ?? [],
    );
  }
  const initialAssessment = assessScreen02Items(
    safe.screen01Baseline as Screen01StudyContext,
    prepared.proposals,
    input.searchManifest,
  );
  const discoveryOrder = new Map(
    prepared.proposals.map((proposal, index) => [proposal.id, index]),
  );
  const discoveredItems = preserveItemOrder(
    [...initialAssessment.items].sort(
      (left, right) =>
        (discoveryOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (discoveryOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER),
    ),
  );
  const directExclusions = applyDirectDoNotShowCriteria(
    discoveredItems,
    appliedCriteria,
  );
  const assessment: Screen02AssessmentResult = {
    items: preserveItemOrder(directExclusions.retained),
    searchManifest: {
      ...initialAssessment.searchManifest,
      exclusions: [
        ...initialAssessment.searchManifest.exclusions,
        ...directExclusions.exclusions,
      ],
      coverage: coverageFor(
        evaluatedProposalIds.length,
        directExclusions.retained,
        initialAssessment.searchManifest.stoppingRule,
      ),
    },
  };
  const byCandidateId = new Map(
    safe.items.map((item) => [item.id, item]),
  );
  const duplicateProposalIds: string[] = [
    ...prepared.duplicateProposalIds,
  ];
  const addedIds: string[] = [];
  const currentResultIds: string[] = [];
  for (const incoming of assessment.items) {
    const sameIdItem = safe.items.find((item) => item.id === incoming.id);
    if (
      sameIdItem &&
      !sameCandidateAcrossRounds(sameIdItem, incoming)
    ) {
      screen2Fail(`proposal id ${incoming.id} was already assigned to a different candidate.`,
      );
    }
    let existingEntry = [...byCandidateId.entries()].find(([, item]) =>
      sameCandidateAcrossRounds(item, incoming),
    );
    if (!existingEntry && incoming.mode === "audit") {
      existingEntry = [...byCandidateId.entries()].find(
        ([, item]) =>
          item.mode === "audit" &&
          item.representationType === incoming.representationType &&
          item.origin === "unsupported-lead" &&
          item.sourceSummary.uniqueSourceCount === 0,
      );
    }
    if (existingEntry) {
      const [existingKey, existing] = existingEntry;
      if (
        !sameCandidateAcrossRounds(existing, incoming) &&
        !(
          incoming.mode === "audit" &&
          existing.mode === "audit" &&
          existing.representationType === incoming.representationType &&
          existing.origin === "unsupported-lead" &&
          existing.sourceSummary.uniqueSourceCount === 0
        )
      ) {
        screen2Fail("attempted to merge incompatible candidates.",
        );
      }
      duplicateProposalIds.push(incoming.id);
      byCandidateId.delete(existingKey);
      const merged = mergeAssessedItems(
        existing,
        incoming,
        input.stage === "ai-review" &&
          input.interpretationSource === "ai-interpretation",
      );
      byCandidateId.set(merged.id, merged);
      currentResultIds.push(merged.id);
    } else {
      if (byCandidateId.has(incoming.id)) {
        screen2Fail(`proposal id ${incoming.id} is already in use.`,
        );
      }
      byCandidateId.set(incoming.id, incoming);
      addedIds.push(incoming.id);
      currentResultIds.push(incoming.id);
    }
  }
  const currentResultIdSet = new Set(currentResultIds);
  let items = rankItems(
    [...byCandidateId.values()].map((item) => {
      if (!currentResultIdSet.has(item.id) || !item.preliminaryAssessment) {
        return item;
      }
      const refreshed = cloneJson(item);
      delete refreshed.preliminaryAssessment;
      return refreshed;
    }),
  );
  if (items.length > SCREEN_02_MAX_CANDIDATE_ITEMS) {
    fail(
      `The cumulative Screen 2 candidate ledger cannot exceed ${SCREEN_02_MAX_CANDIDATE_ITEMS} items.`,
    );
  }
  const currentRejected = new Set(
    safe.interaction.rejections.map((rejection) => rejection.itemId),
  );
  const rejectedItemIds =
    input.requestType === "none-fit"
      ? (
          safe.interaction.searchRounds.at(-1)?.itemIdsRetained ??
          []
        ).filter((itemId) => !currentRejected.has(itemId))
      : [];
  const rejectedAfterRound = new Set([
    ...currentRejected,
    ...rejectedItemIds,
  ]);
  const visibleCurrentResultIds = [...new Set(currentResultIds)].filter(
    (id) => !rejectedAfterRound.has(id),
  );
  if (semanticDecisions) {
    const visibleCurrentResultIdSet = new Set(
      visibleCurrentResultIds,
    );
    for (const decision of semanticDecisions) {
      const retainedInFinalResults =
        visibleCurrentResultIdSet.has(decision.itemId);
      if (
        (decision.decision === "retained" &&
          !retainedInFinalResults) ||
        (decision.decision === "excluded" &&
          retainedInFinalResults)
      ) {
        fail(
          `Semantic decision for ${decision.itemId} contradicts the final deduplicated and fixed-filtered AI-review results.`,
        );
      }
    }
  }
  const itemById = new Map(items.map((item) => [item.id, item]));
  const currentItems = visibleCurrentResultIds
    .map((id) => itemById.get(id))
    .filter((item): item is Screen02Item => item !== undefined);
  const currentRoundManifest: Screen02SearchManifest = {
    ...assessment.searchManifest,
    coverage: coverageFor(
      evaluatedProposalIds.length,
      currentItems,
      assessment.searchManifest.stoppingRule,
    ),
  };
  const assessedVersionLedger = appendItemVersions(
    safe.interaction.itemVersions,
    currentItems,
    revision,
  );
  const activeVersionLedger = appendItemVersions(
    assessedVersionLedger.versions,
    items,
    revision,
  );
  const newRejections = rejectedItemIds.map((itemId, index) => ({
    id: `rejection-${String(
      safe.interaction.rejections.length + index + 1,
    ).padStart(3, "0")}`,
    itemId,
    revision,
    reason:
      input.exactRequest ||
      "The researcher indicated that none of the current options fit.",
    source: "researcher" as const,
  }));
  if (
    safe.interaction.rejections.length + newRejections.length > 100
  ) {
    screen2Fail("rejection history has reached its limit.");
  }
  const selectedItemId =
    safe.selectedItemId &&
    visibleCurrentResultIds.includes(safe.selectedItemId)
      ? safe.selectedItemId
      : null;
  if (
    safe.selectedItemId &&
    selectedItemId === null &&
    safe.interaction.selectionHistory.length >= 100
  ) {
    screen2Fail("selection history has reached its limit.");
  }
  const round: Screen02SearchRound = {
    id: `round-${String(
      safe.interaction.searchRounds.length,
    ).padStart(3, "0")}`,
    revision,
    requestType: input.requestType,
    ...(input.stage ? { stage: input.stage } : {}),
    exactRequest: input.exactRequest,
    retrievedAt: input.retrievedAt,
    searchProtocolVersion: SCREEN_02_SEARCH_PROTOCOL_VERSION,
    preferenceCriteriaIds: appliedCriteria.map(
      (criterion) => criterion.id,
    ),
    proposalIdsReceived: evaluatedProposalIds,
    itemIdsRetained: visibleCurrentResultIds,
    itemIdsAdded: addedIds,
    duplicateProposalIds,
    rejectedItemIds,
    assessedItemVersionIds: assessedVersionLedger.versionIds,
    activeItemVersionIds: activeVersionLedger.versionIds,
    ...(input.parentRoundId && semanticDecisions
      ? {
          parentRoundId: input.parentRoundId,
          semanticDecisions,
        }
      : {}),
    ...(shockEvidence ? { shockEvidence } : {}),
    discovery: prepared.discovery,
    manifest: currentRoundManifest,
  };
  const cumulativeProposalsReceived =
    safe.interaction.searchRounds.reduce(
      (sum, priorRound) =>
        sum + priorRound.proposalIdsReceived.length,
      0,
    ) + evaluatedProposalIds.length;
  const aggregateSearchManifest: Screen02SearchManifest = {
    ...currentRoundManifest,
    exclusions: [
      ...safe.searchManifest.exclusions,
      ...currentRoundManifest.exclusions,
    ],
    coverage: coverageFor(
      cumulativeProposalsReceived,
      items,
      currentRoundManifest.stoppingRule,
    ),
  };
  const next: Screen02Session = {
    ...safe,
    revision,
    items,
    selectedItemId,
    searchManifest: aggregateSearchManifest,
    interaction: {
      ...safe.interaction,
      preferences: {
        ...safe.interaction.preferences,
        criteria: allCriteria,
        requests: request
          ? [...safe.interaction.preferences.requests, request]
          : safe.interaction.preferences.requests,
      },
      pendingRequest: null,
      interactionRequestHistory,
      itemVersions: activeVersionLedger.versions,
      preferenceAssessments:
        appliedCriteria.length === 0
          ? []
          : preferenceAssessments(
              currentItems,
              appliedCriteria,
              revision,
            ),
      searchRounds: [...safe.interaction.searchRounds, round],
      rejections: [...safe.interaction.rejections, ...newRejections],
      selectionHistory:
        safe.selectedItemId && selectedItemId === null
          ? [
              ...safe.interaction.selectionHistory,
              {
                id: `selection-${String(
                  safe.interaction.selectionHistory.length + 1,
                ).padStart(3, "0")}`,
                revision,
                action: "cleared",
                itemId: safe.selectedItemId,
                reason:
                  "The prior selection is not present in the newest Screen 2 result set.",
              },
            ]
          : safe.interaction.selectionHistory,
      deferredQuestions: [
        ...safe.interaction.deferredQuestions,
        ...deferredQuestions,
      ],
      pendingScopeRevision: null,
    },
  };
  return finalizeScreen02Mutation(
    next,
    safe,
    "Applying a Screen 2 search round",
  );
}
