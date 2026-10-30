import {
  SCREEN02_SOURCE_GROUNDING_MAX_ACTION_TERMS,
  SCREEN02_SOURCE_GROUNDING_MAX_COORDINATE_TEXT_CHARS,
  SCREEN02_SOURCE_GROUNDING_MAX_DATE_TERMS,
  SCREEN02_SOURCE_GROUNDING_MAX_FORMAL_IDENTIFIERS,
  SCREEN02_SOURCE_GROUNDING_MAX_IDENTITY_TERMS,
  SCREEN02_SOURCE_GROUNDING_VERSION,
  type Screen02SourceEvidenceCoordinate,
} from "./screen02-source-grounding";
import type {
  Screen02HardFilterKey,
  Screen02HardFilterResult,
} from "./screen02-types";

export const SCREEN02_CANDIDATE_QUALIFICATION_VERSION =
  "screen-02-candidate-qualification-v4" as const;
export const SCREEN02_CANDIDATE_QUALIFICATION_PREVIOUS_VERSION =
  "screen-02-candidate-qualification-v3" as const;
export const SCREEN02_CANDIDATE_QUALIFICATION_LEGACY_VERSION =
  "screen-02-candidate-qualification-v2" as const;
export const SCREEN02_CANDIDATE_QUALIFICATION_MIGRATION_VERSION =
  "screen-02-candidate-qualification-migration-v1" as const;
export const SCREEN02_QUALIFICATION_GROUNDING_POLICY_VERSION =
  "policy-v4" as const;
const SCREEN02_QUALIFICATION_PREVIOUS_GROUNDING_POLICY_VERSION =
  "policy-v3" as const;
export const SCREEN02_QUALIFICATION_MAX_SOURCE_GROUNDING_COORDINATES = 8;
export const SCREEN02_CANDIDATE_ADMISSION_POLICY_VERSION =
  "screen-02-candidate-admission-v1" as const;

export const screen02QualificationLanes = [
  "reviewed-registry",
  "official-source",
  "context-live-web",
  // Historical persisted qualifications may contain this value. New cache
  // reuse preserves the underlying source lane and reports reuse separately
  // in the ranking/exclusion trace or execution history, because caching is
  // not source provenance.
  "cached-candidate",
  "researcher-source",
] as const;
export type Screen02QualificationLane =
  (typeof screen02QualificationLanes)[number];

export const screen02IndustryFitClasses = [
  "direct",
  "adjacent",
  "broad",
  "mismatch",
] as const;
export type Screen02IndustryFitClass =
  (typeof screen02IndustryFitClasses)[number];

export const SCREEN02_CANDIDATE_REVIEW_INFLUENCE_TRACE_VERSION =
  "screen-02-candidate-review-influence-v1" as const;
export const SCREEN02_CANDIDATE_REVIEW_INFLUENCE_MAX_CANDIDATES = 20;
export const SCREEN02_CANDIDATE_REVIEW_INFLUENCE_MAX_BINDINGS = 12;

export type Screen02CandidateReviewSourceSpan = {
  sourceId: string;
  text: string;
};

export type Screen02CandidateReviewVerifiedBridge = {
  profileTerms: string[];
  sourceIds: string[];
  sourceSpans: Screen02CandidateReviewSourceSpan[];
};

/**
 * Normalized, task-validated host review fields that fixed qualification may
 * inspect. The canonical candidate id is deliberately the Map key, so a host
 * cannot smuggle a second identity into the value. Ordering influence remains
 * a separate, independently bounded input.
 */
export type Screen02CandidateReviewInfluence = {
  proposedClass: Screen02IndustryFitClass;
  industryBridge: string;
  profileTermsUsed: string[];
  sourceIdsUsed: string[];
  sourceSpansUsed: Screen02CandidateReviewSourceSpan[];
  sampleConnection: string;
  outcomePathway: string;
  mainMismatchOrUncertainty: string;
  needsFollowUpRetrieval: boolean;
};

export type Screen02CandidateReviewInfluenceMap = ReadonlyMap<
  string,
  Screen02CandidateReviewInfluence
>;

export const screen02CandidateReviewInfluenceReasons = [
  "missing-study-profile",
  "unknown-profile-term",
  "unknown-source",
  "source-span-not-active",
  "source-span-not-found",
  "source-span-not-grounded",
  "missing-adjacent-profile-term",
  "missing-adjacent-source-span",
  "bridge-missing-profile-term",
  "hard-scope-failed",
  "source-quality-failed",
  "substantive-information-failed",
  "exposure-infeasible",
  "active-contradiction",
  "class-upgrade-blocked",
] as const;
export type Screen02CandidateReviewInfluenceReason =
  (typeof screen02CandidateReviewInfluenceReasons)[number];

export const screen02CandidateReviewClassEffects = [
  "applied-downgrade",
  "applied-source-verified-adjacent-downgrade",
  "applied-source-verified-adjacent-bridge",
  "recorded-no-class-change",
  "blocked-class-upgrade",
  "blocked-invalid-influence",
] as const;
export type Screen02CandidateReviewClassEffect =
  (typeof screen02CandidateReviewClassEffects)[number];

export type Screen02CandidateReviewInfluenceTrace = {
  schemaVersion: typeof SCREEN02_CANDIDATE_REVIEW_INFLUENCE_TRACE_VERSION;
  noncanonical: true;
  fixedClassification: Screen02IndustryFitClass;
  proposedClass: Screen02IndustryFitClass;
  resultingClassification: Screen02IndustryFitClass;
  fixedEligibility: boolean;
  resultingEligibility: boolean;
  classEffect: Screen02CandidateReviewClassEffect;
  bridgeVerification: "verified" | "not-requested" | "rejected";
  reasons: Screen02CandidateReviewInfluenceReason[];
  /** Fixed-code-derived bindings; empty unless every adjacent bridge gate passed. */
  verifiedBridge: Screen02CandidateReviewVerifiedBridge | null;
  review: Screen02CandidateReviewInfluence;
  fieldDispositions: {
    proposedClass: Screen02CandidateReviewClassEffect;
    industryBridge:
      | "source-bound-noncanonical-explanation"
      | "audit-only-no-qualification-effect";
    profileTermsUsed: "fixed-evidence-binding-only";
    sourceIdsUsed: "fixed-evidence-binding-only";
    sourceSpansUsed: "fixed-evidence-binding-only";
    sampleConnection: "audit-only-no-qualification-effect";
    outcomePathway: "audit-only-no-qualification-effect";
    mainMismatchOrUncertainty: "audit-only-no-qualification-effect";
    needsFollowUpRetrieval:
      | "follow-up-signal-only-no-retrieval"
      | "no-follow-up-requested";
  };
};

export const screen02QualificationSections = [
  "best-match",
  "broader",
] as const;
export type Screen02QualificationSection =
  (typeof screen02QualificationSections)[number];

export const screen02HardScopeDispositions = [
  "supported",
  "demonstrated-mismatch",
  "insufficient-evidence",
  "mixed",
] as const;
export type Screen02HardScopeDisposition =
  (typeof screen02HardScopeDispositions)[number];

export type Screen02HardScopeEvidenceState = "supported" | "insufficient";
export type Screen02HardScopeRelevanceState =
  | "within-scope"
  | "demonstrated-mismatch"
  | "unresolved";

export type Screen02CandidateQualificationMigrationProvenance = {
  schemaVersion: typeof SCREEN02_CANDIDATE_QUALIFICATION_MIGRATION_VERSION;
  fromVersion:
    | typeof SCREEN02_CANDIDATE_QUALIFICATION_PREVIOUS_VERSION
    | typeof SCREEN02_CANDIDATE_QUALIFICATION_LEGACY_VERSION;
  method:
    | "derived-retained-v3-disposition"
    | "derived-retained-v2-checks";
  sourceEvidenceReconstructed: false;
};

export const screen02QualificationExclusionCodes = [
  "hard-scope-mismatch",
  "hard-scope-insufficient-evidence",
  "industry-mismatch",
  "excluded-insufficient-substantive-information",
  "insufficient-source-quality",
  "exposure-infeasible",
  "broad-result-cap",
  "candidate-limit",
] as const;
export type Screen02QualificationExclusionCode =
  (typeof screen02QualificationExclusionCodes)[number];

export type Screen02SubstantiveOverviewGate = {
  identity: boolean;
  change: boolean;
  affectedPopulation: boolean;
  materialDate: boolean;
  passed: boolean;
  summary: string;
  whatTheShockIs: string;
  whatChanged: string;
  whoMayBeAffected: string;
  importantTiming: string;
  whyItMayMatterForStudy: string;
  mainUncertainty: string;
  explanation: string;
  evidenceSourceIds: string[];
  sourceGrounding: {
    schemaVersion: typeof SCREEN02_SOURCE_GROUNDING_VERSION;
    coordinates: Screen02SourceEvidenceCoordinate[];
  };
};

/**
 * Three deliberately separate decisions: what the retained documents support
 * displaying, whether that event is relevant enough to investigate for this
 * study, and which facts Screen 3 still has to verify.
 */
export type Screen02CandidateAdmission = {
  policyVersion: typeof SCREEN02_CANDIDATE_ADMISSION_POLICY_VERSION;
  displayEvidence: {
    supported: boolean;
    stableIdentity: boolean;
    substantiveChange: boolean;
    relevantDate: boolean;
    trustworthySourceIds: string[];
    explanation: string;
  };
  relevance: {
    recommended: boolean;
    classification: Screen02IndustryFitClass;
    explanation: string;
    evidenceSourceIds: string[];
  };
  screen3VerificationNeeds: string[];
};

export type Screen02CandidateQualification = {
  version: typeof SCREEN02_CANDIDATE_QUALIFICATION_VERSION;
  scopeFingerprint: string;
  cacheKey: string;
  candidateId: string;
  sourceFingerprint: string;
  lane: Screen02QualificationLane;
  classification: Screen02IndustryFitClass;
  section: Screen02QualificationSection | null;
  hardScope: {
    passed: boolean;
    disposition: Screen02HardScopeDisposition;
    evidenceState: Screen02HardScopeEvidenceState;
    relevanceState: Screen02HardScopeRelevanceState;
    mismatchKeys: Screen02HardFilterKey[];
    insufficientEvidenceKeys: Screen02HardFilterKey[];
    blockingKeys: Screen02HardFilterKey[];
    checks: Screen02HardFilterResult[];
    explanation: string;
  };
  industryFit: {
    matchedDirectTerms: string[];
    matchedAdjacentTerms: string[];
    matchedContrastTerms: string[];
    explanation: string;
    evidenceSourceIds: string[];
  };
  outcomeFit: {
    status: "source-signal" | "plausible" | "unclear" | "not-evaluated";
    explanation: string;
    evidenceSourceIds: string[];
  };
  exposureFeasibility: {
    status: "documented" | "plausible" | "unclear" | "infeasible";
    explanation: string;
    evidenceSourceIds: string[];
  };
  substantiveOverview: Screen02SubstantiveOverviewGate;
  sourceQuality: {
    status: "high" | "adequate" | "limited" | "insufficient";
    strongestAuthorityTier: 1 | 2 | 3 | 4 | 5 | 6 | null;
    score: number;
    explanation: string;
    evidenceSourceIds: string[];
  };
  retrieval: {
    bm25Rank: number;
    bm25Score: number;
  };
  ranking: {
    baseScore: number;
    diversityAdjustment: number;
    totalScore: number;
    rank: number | null;
    explanation: string;
  };
  eligible: boolean;
  exclusionCodes: Screen02QualificationExclusionCode[];
  explanation: string;
  evidenceSourceIds: string[];
  /** Absent only on readable historical v4 qualifications. */
  candidateAdmission?: Screen02CandidateAdmission;
  /**
   * Present only when a persisted v2/v3 trace is restored. It prevents that
   * historical trace from being mistaken for a newly evaluated v4 cache hit.
   */
  migrationProvenance?: Screen02CandidateQualificationMigrationProvenance;
  /**
   * Optional for historical compatibility. Host narratives remain
   * noncanonical audit material; only the explicit classEffect can alter the
   * fixed classification. It can never create eligibility; the sole upward
   * class movement is a fixed-verified broad-to-adjacent bridge.
   */
  hostReviewInfluence?: Screen02CandidateReviewInfluenceTrace;
};

function normalize(value: string) {
  return value
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

function unique(values: readonly string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function hasTerm(text: string, term: string) {
  const normalizedText = ` ${normalize(text)} `;
  const normalizedTerm = normalize(term);
  if (!normalizedTerm) return false;
  if (normalizedTerm.endsWith(" entit")) {
    return normalizedText.includes(" public interest entit");
  }
  if ([
    "adopt",
    "allow",
    "amend",
    "authorize",
    "change",
    "declare",
    "establish",
    "expand",
    "impose",
    "introduc",
    "limit",
    "mandat",
    "permit",
    "prohibit",
    "require",
    "restrict",
    "replace",
  ].includes(normalizedTerm)) {
    return normalizedText.includes(` ${normalizedTerm}`);
  }
  if (normalizedText.includes(` ${normalizedTerm} `)) return true;
  const singular = (token: string) =>
    token.endsWith("ies") && token.length > 4
      ? `${token.slice(0, -3)}y`
      : token.endsWith("s") && !token.endsWith("ss") && token.length > 3
        ? token.slice(0, -1)
        : token;
  const singularText = normalize(text).split(" ").map(singular).join(" ");
  const singularTerm = normalizedTerm.split(" ").map(singular).join(" ");
  return ` ${singularText} `.includes(` ${singularTerm} `);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length &&
    actual.every((key, index) => key === wanted[index]);
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) &&
    value.every((item) => typeof item === "string" && item.trim() === item && item.length > 0) &&
    new Set(value).size === value.length;
}

function finiteRange(value: unknown, minimum: number, maximum: number) {
  return typeof value === "number" && Number.isFinite(value) &&
    value >= minimum && value <= maximum;
}

function isScreen02QualificationProfileCacheBinding(value: string) {
  return value === "none:profile-none" ||
    (!value.startsWith("none:") &&
      /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}:fnv1a64:[0-9a-f]{16}$/u.test(
        value,
      ));
}

function isScreen02QualificationCacheKey(value: {
  scopeFingerprint: string;
  cacheKey: string;
  sourceFingerprint: string;
  candidateId: string;
}) {
  const prefix = `${SCREEN02_CANDIDATE_QUALIFICATION_VERSION}:${value.scopeFingerprint}:profile:`;
  const suffix = `:${value.sourceFingerprint}:${value.candidateId}`;
  if (!value.cacheKey.startsWith(prefix) || !value.cacheKey.endsWith(suffix)) {
    return false;
  }
  const cacheBinding = value.cacheKey.slice(
    prefix.length,
    value.cacheKey.length - suffix.length,
  );
  // Legacy v4 traces remain structurally readable audit history. Only the
  // exact current key generated above is reusable, so omitting this grounding
  // policy component forces a fresh qualification without schema churn.
  const groundingBinding =
    `:grounding:${SCREEN02_SOURCE_GROUNDING_VERSION}:${SCREEN02_QUALIFICATION_GROUNDING_POLICY_VERSION}`;
  const previousGroundingBinding =
    `:grounding:${SCREEN02_SOURCE_GROUNDING_VERSION}:${SCREEN02_QUALIFICATION_PREVIOUS_GROUNDING_POLICY_VERSION}`;
  const readableBinding = [groundingBinding, previousGroundingBinding].find(
    (binding) => cacheBinding.endsWith(binding),
  );
  return readableBinding
    ? isScreen02QualificationProfileCacheBinding(
        cacheBinding.slice(0, -readableBinding.length),
      )
    : isScreen02QualificationProfileCacheBinding(cacheBinding);
}

function boundedCandidateReviewText(
  value: unknown,
  label: string,
  maximum: number,
  maximumWords?: number,
) {
  if (
    typeof value !== "string" || value.trim() !== value || !value ||
    value.length > maximum ||
    /[\u0000-\u001f\u007f]/u.test(value) ||
    /<\/?[a-z][^>]*>/iu.test(value) ||
    (maximumWords !== undefined && value.split(/\s+/u).length > maximumWords)
  ) {
    throw new Error(`${label} is not bounded normalized review text.`);
  }
  return value;
}

function boundedCandidateReviewList(
  value: unknown,
  label: string,
  maximumItems: number,
  maximumCharacters: number,
) {
  if (!Array.isArray(value) || value.length > maximumItems) {
    throw new Error(`${label} exceeds its bounded review limit.`);
  }
  const result = value.map((item) =>
    boundedCandidateReviewText(item, label, maximumCharacters)
  );
  if (new Set(result).size !== result.length) {
    throw new Error(`${label} must not contain duplicates.`);
  }
  return result;
}

function requireCandidateReviewInfluence(
  value: unknown,
  candidateId: string,
): Screen02CandidateReviewInfluence {
  if (!record(value) || !exactKeys(value, [
    "proposedClass", "industryBridge", "profileTermsUsed", "sourceIdsUsed",
    "sourceSpansUsed", "sampleConnection", "outcomePathway",
    "mainMismatchOrUncertainty", "needsFollowUpRetrieval",
  ])) {
    throw new Error(
      `Candidate review influence for ${candidateId} has unknown or missing fields.`,
    );
  }
  if (!screen02IndustryFitClasses.includes(value.proposedClass as never)) {
    throw new Error(`Candidate review influence for ${candidateId} has an invalid class.`);
  }
  const profileTermsUsed = boundedCandidateReviewList(
    value.profileTermsUsed,
    `${candidateId}.profileTermsUsed`,
    SCREEN02_CANDIDATE_REVIEW_INFLUENCE_MAX_BINDINGS,
    200,
  );
  if (new Set(profileTermsUsed.map(normalize)).size !== profileTermsUsed.length) {
    throw new Error(`${candidateId}.profileTermsUsed must be normalized-unique.`);
  }
  const sourceIdsUsed = boundedCandidateReviewList(
    value.sourceIdsUsed,
    `${candidateId}.sourceIdsUsed`,
    SCREEN02_CANDIDATE_REVIEW_INFLUENCE_MAX_BINDINGS,
    160,
  );
  if (
    !Array.isArray(value.sourceSpansUsed) ||
    value.sourceSpansUsed.length >
      SCREEN02_CANDIDATE_REVIEW_INFLUENCE_MAX_BINDINGS
  ) {
    throw new Error(`${candidateId}.sourceSpansUsed exceeds its bounded limit.`);
  }
  const sourceSpansUsed = value.sourceSpansUsed.map((span, index) => {
    if (!record(span) || !exactKeys(span, ["sourceId", "text"])) {
      throw new Error(`${candidateId}.sourceSpansUsed[${index}] is invalid.`);
    }
    return {
      sourceId: boundedCandidateReviewText(
        span.sourceId,
        `${candidateId}.sourceSpansUsed[${index}].sourceId`,
        160,
      ),
      text: boundedCandidateReviewText(
        span.text,
        `${candidateId}.sourceSpansUsed[${index}].text`,
        500,
      ),
    };
  });
  if (
    new Set(sourceSpansUsed.map((span) => `${span.sourceId}\u001f${span.text}`))
      .size !== sourceSpansUsed.length
  ) {
    throw new Error(`${candidateId}.sourceSpansUsed must not contain duplicates.`);
  }
  if (typeof value.needsFollowUpRetrieval !== "boolean") {
    throw new Error(`${candidateId}.needsFollowUpRetrieval must be boolean.`);
  }
  return {
    proposedClass: value.proposedClass as Screen02IndustryFitClass,
    industryBridge: boundedCandidateReviewText(
      value.industryBridge,
      `${candidateId}.industryBridge`,
      640,
      80,
    ),
    profileTermsUsed,
    sourceIdsUsed,
    sourceSpansUsed,
    sampleConnection: boundedCandidateReviewText(
      value.sampleConnection,
      `${candidateId}.sampleConnection`,
      640,
      80,
    ),
    outcomePathway: boundedCandidateReviewText(
      value.outcomePathway,
      `${candidateId}.outcomePathway`,
      640,
      80,
    ),
    mainMismatchOrUncertainty: boundedCandidateReviewText(
      value.mainMismatchOrUncertainty,
      `${candidateId}.mainMismatchOrUncertainty`,
      640,
      80,
    ),
    needsFollowUpRetrieval: value.needsFollowUpRetrieval,
  };
}

/**
 * Runtime guard for the integration boundary. Unknown candidate keys,
 * duplicate/oversized values, and extra review fields fail closed before any
 * proposal is qualified.
 */
export function validateScreen02CandidateReviewInfluenceMap(
  value: unknown,
  candidateIds: readonly string[],
): Screen02CandidateReviewInfluenceMap {
  if (!(value instanceof Map)) {
    throw new Error("Screen 2 candidate review influence must be a Map.");
  }
  if (
    value.size > SCREEN02_CANDIDATE_REVIEW_INFLUENCE_MAX_CANDIDATES ||
    new Set(candidateIds).size !== candidateIds.length
  ) {
    throw new Error("Screen 2 candidate review influence exceeds its candidate bound.");
  }
  const allowedCandidateIds = new Set(candidateIds);
  const validated = new Map<string, Screen02CandidateReviewInfluence>();
  for (const [rawCandidateId, review] of value) {
    const candidateId = boundedCandidateReviewText(
      rawCandidateId,
      "candidateReviewInfluence.candidateId",
      200,
    );
    if (!allowedCandidateIds.has(candidateId)) {
      throw new Error(
        `Candidate review influence references unknown canonical candidate ${candidateId}.`,
      );
    }
    validated.set(
      candidateId,
      requireCandidateReviewInfluence(review, candidateId),
    );
  }
  return validated;
}

function isScreen02CandidateReviewInfluenceTrace(
  value: unknown,
): value is Screen02CandidateReviewInfluenceTrace {
  if (!record(value) || !exactKeys(value, [
    "schemaVersion", "noncanonical", "fixedClassification", "proposedClass",
    "resultingClassification", "fixedEligibility", "resultingEligibility",
    "classEffect", "bridgeVerification", "reasons", "verifiedBridge", "review",
    "fieldDispositions",
  ])) return false;
  if (
    value.schemaVersion !==
      SCREEN02_CANDIDATE_REVIEW_INFLUENCE_TRACE_VERSION ||
    value.noncanonical !== true ||
    !screen02IndustryFitClasses.includes(value.fixedClassification as never) ||
    !screen02IndustryFitClasses.includes(value.proposedClass as never) ||
    !screen02IndustryFitClasses.includes(value.resultingClassification as never) ||
    typeof value.fixedEligibility !== "boolean" ||
    typeof value.resultingEligibility !== "boolean" ||
    (value.resultingEligibility === true && value.fixedEligibility !== true) ||
    !screen02CandidateReviewClassEffects.includes(value.classEffect as never) ||
    !["verified", "not-requested", "rejected"].includes(
      value.bridgeVerification as string,
    ) ||
    !stringArray(value.reasons) ||
    !(value.reasons as string[]).every((reason) =>
      screen02CandidateReviewInfluenceReasons.includes(reason as never)
    )
  ) return false;
  let review: Screen02CandidateReviewInfluence;
  try {
    review = requireCandidateReviewInfluence(value.review, "persisted-review");
  } catch {
    return false;
  }
  if (review.proposedClass !== value.proposedClass) return false;
  const verifiedBridge = value.verifiedBridge;
  if (value.bridgeVerification === "verified") {
    if (
      !record(verifiedBridge) || !exactKeys(verifiedBridge, [
        "profileTerms", "sourceIds", "sourceSpans",
      ]) ||
      !stringArray(verifiedBridge.profileTerms) ||
      (verifiedBridge.profileTerms as string[]).length === 0 ||
      !stringArray(verifiedBridge.sourceIds) ||
      (verifiedBridge.sourceIds as string[]).length === 0 ||
      !Array.isArray(verifiedBridge.sourceSpans) ||
      (verifiedBridge.sourceSpans as unknown[]).length === 0 ||
      !(verifiedBridge.sourceSpans as unknown[]).every((span) =>
        record(span) && exactKeys(span, ["sourceId", "text"]) &&
        typeof span.sourceId === "string" && Boolean(span.sourceId) &&
        typeof span.text === "string" && Boolean(span.text)
      )
    ) return false;
    const verifiedProfileTerms = verifiedBridge.profileTerms as string[];
    const verifiedSourceIds = verifiedBridge.sourceIds as string[];
    const verifiedSourceSpans = verifiedBridge.sourceSpans as Array<{
      sourceId: string;
      text: string;
    }>;
    if (
      verifiedProfileTerms.join("\u001f") !==
        unique(review.profileTermsUsed).join("\u001f") ||
      verifiedSourceIds.join("\u001f") !==
        unique(verifiedSourceSpans.map((span) => span.sourceId)).join("\u001f") ||
      verifiedSourceSpans.some((span) =>
        !review.sourceSpansUsed.some((reviewSpan) =>
          reviewSpan.sourceId === span.sourceId && reviewSpan.text === span.text
        ) || !review.sourceIdsUsed.includes(span.sourceId)
      ) ||
      verifiedProfileTerms.some((term) =>
        !verifiedSourceSpans.some((span) => hasTerm(span.text, term))
      ) ||
      verifiedSourceSpans.some((span) =>
        !verifiedProfileTerms.some((term) => hasTerm(span.text, term))
      ) ||
      new Set(verifiedSourceSpans.map((span) =>
        `${span.sourceId}\u001f${span.text}`
      )).size !== verifiedSourceSpans.length
    ) return false;
  } else if (verifiedBridge !== null) {
    return false;
  }
  const dispositions = value.fieldDispositions;
  if (!record(dispositions) || !exactKeys(dispositions, [
    "proposedClass", "industryBridge", "profileTermsUsed", "sourceIdsUsed",
    "sourceSpansUsed", "sampleConnection", "outcomePathway",
    "mainMismatchOrUncertainty", "needsFollowUpRetrieval",
  ])) return false;
  if (
    dispositions.proposedClass !== value.classEffect ||
    ![
      "source-bound-noncanonical-explanation",
      "audit-only-no-qualification-effect",
    ].includes(dispositions.industryBridge as string) ||
    dispositions.profileTermsUsed !== "fixed-evidence-binding-only" ||
    dispositions.sourceIdsUsed !== "fixed-evidence-binding-only" ||
    dispositions.sourceSpansUsed !== "fixed-evidence-binding-only" ||
    dispositions.sampleConnection !== "audit-only-no-qualification-effect" ||
    dispositions.outcomePathway !== "audit-only-no-qualification-effect" ||
    dispositions.mainMismatchOrUncertainty !==
      "audit-only-no-qualification-effect" ||
    ![
      "follow-up-signal-only-no-retrieval",
      "no-follow-up-requested",
    ].includes(dispositions.needsFollowUpRetrieval as string) ||
    (review.needsFollowUpRetrieval
      ? dispositions.needsFollowUpRetrieval !==
        "follow-up-signal-only-no-retrieval"
      : dispositions.needsFollowUpRetrieval !== "no-follow-up-requested")
  ) return false;
  const strength: Record<Screen02IndustryFitClass, number> = {
    direct: 3,
    adjacent: 2,
    broad: 1,
    mismatch: 0,
  };
  const fixed = value.fixedClassification as Screen02IndustryFitClass;
  const resulting = value.resultingClassification as Screen02IndustryFitClass;
  const classEffect = value.classEffect as Screen02CandidateReviewClassEffect;
  const verifiedBroadToAdjacentBridge =
    classEffect === "applied-source-verified-adjacent-bridge" &&
    fixed === "broad" && resulting === "adjacent" &&
    value.fixedEligibility === true && value.resultingEligibility === true &&
    value.bridgeVerification === "verified";
  if (
    (strength[resulting] > strength[fixed] &&
      !verifiedBroadToAdjacentBridge) ||
    ((classEffect === "applied-downgrade" ||
      classEffect === "applied-source-verified-adjacent-downgrade") &&
      strength[resulting] >= strength[fixed]) ||
    (classEffect === "applied-source-verified-adjacent-downgrade" &&
      (resulting !== "adjacent" || value.bridgeVerification !== "verified")) ||
    (classEffect === "applied-source-verified-adjacent-bridge" &&
      !verifiedBroadToAdjacentBridge) ||
    ([
      "recorded-no-class-change",
      "blocked-class-upgrade",
      "blocked-invalid-influence",
    ].includes(classEffect) && resulting !== fixed) ||
    (dispositions.industryBridge ===
      "source-bound-noncanonical-explanation" &&
      value.bridgeVerification !== "verified")
  ) return false;
  const reasons = value.reasons as string[];
  if (
    ([
      "applied-downgrade",
      "applied-source-verified-adjacent-downgrade",
      "applied-source-verified-adjacent-bridge",
      "recorded-no-class-change",
    ].includes(classEffect) && reasons.length !== 0) ||
    (classEffect === "blocked-class-upgrade" &&
      (reasons.length !== 1 || reasons[0] !== "class-upgrade-blocked")) ||
    (classEffect === "blocked-invalid-influence" &&
      (reasons.length === 0 || reasons.includes("class-upgrade-blocked"))) ||
    (classEffect === "recorded-no-class-change" &&
      value.proposedClass !== fixed) ||
    ((classEffect === "applied-downgrade" ||
      classEffect === "applied-source-verified-adjacent-downgrade") &&
      value.proposedClass !== resulting) ||
    (classEffect === "applied-downgrade" && resulting === "adjacent") ||
    (review.proposedClass === "adjacent"
      ? value.bridgeVerification === "not-requested"
      : value.bridgeVerification !== "not-requested")
  ) return false;
  return true;
}

function isScreen02CandidateAdmission(
  value: unknown,
): value is Screen02CandidateAdmission {
  if (!record(value) || !exactKeys(value, [
    "policyVersion", "displayEvidence", "relevance",
    "screen3VerificationNeeds",
  ]) ||
    value.policyVersion !== SCREEN02_CANDIDATE_ADMISSION_POLICY_VERSION ||
    !stringArray(value.screen3VerificationNeeds) ||
    value.screen3VerificationNeeds.length === 0 ||
    !record(value.displayEvidence) || !record(value.relevance)
  ) return false;
  const display = value.displayEvidence;
  const relevance = value.relevance;
  if (!exactKeys(display, [
      "supported", "stableIdentity", "substantiveChange", "relevantDate",
      "trustworthySourceIds", "explanation",
    ]) ||
    ["supported", "stableIdentity", "substantiveChange", "relevantDate"]
      .some((key) => typeof display[key] !== "boolean") ||
    !stringArray(display.trustworthySourceIds) ||
    typeof display.explanation !== "string" || !display.explanation ||
    !exactKeys(relevance, [
      "recommended", "classification", "explanation", "evidenceSourceIds",
    ]) ||
    typeof relevance.recommended !== "boolean" ||
    !screen02IndustryFitClasses.includes(
      relevance.classification as never,
    ) ||
    typeof relevance.explanation !== "string" ||
    !relevance.explanation || !stringArray(relevance.evidenceSourceIds)
  ) return false;
  return display.supported === (
    display.stableIdentity === true &&
    display.substantiveChange === true &&
    display.relevantDate === true &&
    display.trustworthySourceIds.length > 0
  );
}

/** Strict structural reader for persisted candidate and handoff traces. */
export function isScreen02CandidateQualification(
  value: unknown,
): value is Screen02CandidateQualification {
  const hasHostReviewInfluence = record(value) &&
    Object.prototype.hasOwnProperty.call(value, "hostReviewInfluence");
  const hasMigrationProvenance = record(value) &&
    Object.prototype.hasOwnProperty.call(value, "migrationProvenance");
  const hasCandidateAdmission = record(value) &&
    Object.prototype.hasOwnProperty.call(value, "candidateAdmission");
  if (!record(value) || !exactKeys(value, [
    "version", "scopeFingerprint", "cacheKey", "candidateId", "sourceFingerprint", "lane",
    "classification", "section", "hardScope", "industryFit", "outcomeFit",
    "exposureFeasibility", "substantiveOverview", "sourceQuality",
    "retrieval", "ranking", "eligible", "exclusionCodes", "explanation",
    "evidenceSourceIds",
    ...(hasCandidateAdmission ? ["candidateAdmission"] : []),
    ...(hasMigrationProvenance ? ["migrationProvenance"] : []),
    ...(hasHostReviewInfluence ? ["hostReviewInfluence"] : []),
  ])) return false;
  if (
    value.version !== SCREEN02_CANDIDATE_QUALIFICATION_VERSION ||
    typeof value.scopeFingerprint !== "string" || !value.scopeFingerprint ||
    typeof value.cacheKey !== "string" || !value.cacheKey ||
    typeof value.candidateId !== "string" || !value.candidateId ||
    typeof value.sourceFingerprint !== "string" ||
    !/^fnv1a64:[0-9a-f]{16}$/u.test(value.sourceFingerprint) ||
    !isScreen02QualificationCacheKey({
      scopeFingerprint: value.scopeFingerprint,
      cacheKey: value.cacheKey,
      sourceFingerprint: value.sourceFingerprint,
      candidateId: value.candidateId,
    }) ||
    !screen02QualificationLanes.includes(value.lane as never) ||
    !screen02IndustryFitClasses.includes(value.classification as never) ||
    !(value.section === null || screen02QualificationSections.includes(value.section as never)) ||
    typeof value.eligible !== "boolean" ||
    !stringArray(value.exclusionCodes) ||
    !(value.exclusionCodes as string[]).every((code) =>
      screen02QualificationExclusionCodes.includes(code as never)) ||
    typeof value.explanation !== "string" || !value.explanation ||
    !stringArray(value.evidenceSourceIds) ||
    (hasCandidateAdmission &&
      !isScreen02CandidateAdmission(value.candidateAdmission)) ||
    (hasMigrationProvenance &&
      (!record(value.migrationProvenance) ||
        !exactKeys(value.migrationProvenance, [
          "schemaVersion", "fromVersion", "method",
          "sourceEvidenceReconstructed",
        ]) ||
        value.migrationProvenance.schemaVersion !==
          SCREEN02_CANDIDATE_QUALIFICATION_MIGRATION_VERSION ||
        ![
          SCREEN02_CANDIDATE_QUALIFICATION_PREVIOUS_VERSION,
          SCREEN02_CANDIDATE_QUALIFICATION_LEGACY_VERSION,
        ].includes(value.migrationProvenance.fromVersion as never) ||
        value.migrationProvenance.method !== (
          value.migrationProvenance.fromVersion ===
              SCREEN02_CANDIDATE_QUALIFICATION_PREVIOUS_VERSION
            ? "derived-retained-v3-disposition"
            : "derived-retained-v2-checks"
        ) ||
        value.migrationProvenance.sourceEvidenceReconstructed !== false)) ||
    (hasHostReviewInfluence &&
      (!isScreen02CandidateReviewInfluenceTrace(value.hostReviewInfluence) ||
        value.hostReviewInfluence.resultingClassification !==
          value.classification ||
        value.hostReviewInfluence.resultingEligibility !== value.eligible))
  ) return false;
  if (!record(value.hardScope) || !exactKeys(value.hardScope, [
    "passed", "disposition", "evidenceState", "relevanceState",
    "mismatchKeys", "insufficientEvidenceKeys", "blockingKeys", "checks",
    "explanation",
  ]) || typeof value.hardScope.passed !== "boolean" ||
    !screen02HardScopeDispositions.includes(value.hardScope.disposition as never) ||
    !["supported", "insufficient"].includes(
      value.hardScope.evidenceState as string,
    ) ||
    !["within-scope", "demonstrated-mismatch", "unresolved"].includes(
      value.hardScope.relevanceState as string,
    ) ||
    !stringArray(value.hardScope.mismatchKeys) ||
    !stringArray(value.hardScope.insufficientEvidenceKeys) ||
    !stringArray(value.hardScope.blockingKeys) ||
    !Array.isArray(value.hardScope.checks) ||
    value.hardScope.checks.length !== 4 ||
    !value.hardScope.checks.every((check) => record(check) &&
      exactKeys(check, ["key", "status", "reason"]) &&
      ["geography", "studyPeriod", "population", "eventFamily"].includes(check.key as string) &&
      ["pass", "review", "fail"].includes(check.status as string) &&
      typeof check.reason === "string" && Boolean(check.reason)) ||
    typeof value.hardScope.explanation !== "string" || !value.hardScope.explanation
  ) return false;
  const hardScope = value.hardScope;
  const hardScopeKeys = [
    "geography", "studyPeriod", "population", "eventFamily",
  ] as const;
  const validUniqueHardScopeKeys = (keys: unknown[]) =>
    keys.every((key) => hardScopeKeys.includes(key as never)) &&
    new Set(keys).size === keys.length;
  const mismatchKeys = hardScope.mismatchKeys as string[];
  const insufficientEvidenceKeys = hardScope.insufficientEvidenceKeys as string[];
  const blockingKeys = hardScope.blockingKeys as string[];
  const checkByKey = new Map(
    (hardScope.checks as Screen02HardFilterResult[]).map((check) => [
      check.key,
      check,
    ]),
  );
  const disposition = hardScope.disposition as Screen02HardScopeDisposition;
  if (
    !validUniqueHardScopeKeys(mismatchKeys) ||
    !validUniqueHardScopeKeys(insufficientEvidenceKeys) ||
    !validUniqueHardScopeKeys(blockingKeys) ||
    checkByKey.size !== hardScopeKeys.length ||
    mismatchKeys.some((key) => checkByKey.get(key as Screen02HardFilterKey)?.status !== "fail") ||
    [...checkByKey.values()].some((check) =>
      check.status === "fail" && !mismatchKeys.includes(check.key)) ||
    insufficientEvidenceKeys.some((key) => checkByKey.get(key as Screen02HardFilterKey)?.status !== "review") ||
    mismatchKeys.some((key) => insufficientEvidenceKeys.includes(key)) ||
    blockingKeys.length !== mismatchKeys.length + insufficientEvidenceKeys.length ||
    !blockingKeys.every((key) =>
      mismatchKeys.includes(key) || insufficientEvidenceKeys.includes(key)) ||
    hardScope.passed !== (disposition === "supported") ||
    (disposition === "supported" && blockingKeys.length !== 0) ||
    (disposition === "demonstrated-mismatch" &&
      (mismatchKeys.length === 0 || insufficientEvidenceKeys.length !== 0)) ||
    (disposition === "insufficient-evidence" &&
      (mismatchKeys.length !== 0 || insufficientEvidenceKeys.length === 0)) ||
    (disposition === "mixed" &&
      (mismatchKeys.length === 0 || insufficientEvidenceKeys.length === 0)) ||
    hardScope.evidenceState !== (
      insufficientEvidenceKeys.length > 0 ? "insufficient" : "supported"
    ) ||
    hardScope.relevanceState !== (
      mismatchKeys.length > 0
        ? "demonstrated-mismatch"
        : insufficientEvidenceKeys.length > 0
          ? "unresolved"
          : "within-scope"
    )
  ) return false;
  const exclusionCodes = value.exclusionCodes as string[];
  if (
    new Set(exclusionCodes).size !== exclusionCodes.length ||
    exclusionCodes.includes("hard-scope-mismatch") !==
      (["demonstrated-mismatch", "mixed"] as Screen02HardScopeDisposition[])
        .includes(disposition) ||
    exclusionCodes.includes("hard-scope-insufficient-evidence") !==
      (hasCandidateAdmission
        ? false
        : (["insufficient-evidence", "mixed"] as Screen02HardScopeDisposition[])
          .includes(disposition))
  ) return false;
  if (!record(value.industryFit) || !exactKeys(value.industryFit, [
    "matchedDirectTerms", "matchedAdjacentTerms", "matchedContrastTerms",
    "explanation", "evidenceSourceIds",
  ]) || !stringArray(value.industryFit.matchedDirectTerms) ||
    !stringArray(value.industryFit.matchedAdjacentTerms) ||
    !stringArray(value.industryFit.matchedContrastTerms) ||
    typeof value.industryFit.explanation !== "string" || !value.industryFit.explanation ||
    !stringArray(value.industryFit.evidenceSourceIds)) return false;
  if (!record(value.outcomeFit) || !exactKeys(value.outcomeFit, [
    "status", "explanation", "evidenceSourceIds",
  ]) || !["source-signal", "plausible", "unclear", "not-evaluated"].includes(value.outcomeFit.status as string) ||
    typeof value.outcomeFit.explanation !== "string" || !value.outcomeFit.explanation ||
    !stringArray(value.outcomeFit.evidenceSourceIds)) return false;
  if (!record(value.exposureFeasibility) || !exactKeys(value.exposureFeasibility, [
    "status", "explanation", "evidenceSourceIds",
  ]) || !["documented", "plausible", "unclear", "infeasible"].includes(value.exposureFeasibility.status as string) ||
    typeof value.exposureFeasibility.explanation !== "string" || !value.exposureFeasibility.explanation ||
    !stringArray(value.exposureFeasibility.evidenceSourceIds)) return false;
  const overview = value.substantiveOverview;
  if (!record(overview) || !exactKeys(overview, [
    "identity", "change", "affectedPopulation", "materialDate", "passed",
    "summary", "whatTheShockIs", "whatChanged", "whoMayBeAffected",
    "importantTiming", "whyItMayMatterForStudy", "mainUncertainty",
    "explanation", "evidenceSourceIds", "sourceGrounding",
  ]) || ["identity", "change", "affectedPopulation", "materialDate", "passed"].some((key) =>
    typeof overview[key] !== "boolean") ||
    typeof overview.summary !== "string" || !overview.summary ||
    typeof overview.whatTheShockIs !== "string" || !overview.whatTheShockIs ||
    typeof overview.whatChanged !== "string" ||
    typeof overview.whoMayBeAffected !== "string" ||
    typeof overview.importantTiming !== "string" ||
    typeof overview.whyItMayMatterForStudy !== "string" || !overview.whyItMayMatterForStudy ||
    typeof overview.mainUncertainty !== "string" || !overview.mainUncertainty ||
    typeof overview.explanation !== "string" || !overview.explanation ||
    !stringArray(overview.evidenceSourceIds) ||
    !record(overview.sourceGrounding) ||
    !exactKeys(overview.sourceGrounding, ["schemaVersion", "coordinates"]) ||
    overview.sourceGrounding.schemaVersion !== SCREEN02_SOURCE_GROUNDING_VERSION ||
    !Array.isArray(overview.sourceGrounding.coordinates) ||
    overview.sourceGrounding.coordinates.length >
      SCREEN02_QUALIFICATION_MAX_SOURCE_GROUNDING_COORDINATES ||
    !overview.sourceGrounding.coordinates.every((coordinate) =>
      record(coordinate) && exactKeys(coordinate, [
        "sourceId", "sentenceStart", "sentenceEnd", "characterStart",
        "characterEnd", "text", "matchedIdentityTerms",
        "matchedFormalIdentifiers", "matchedActionTerms", "matchedDateTerms",
        "polarity",
      ]) &&
      typeof coordinate.sourceId === "string" && Boolean(coordinate.sourceId) &&
      Number.isSafeInteger(coordinate.sentenceStart) &&
      (coordinate.sentenceStart as number) >= 0 &&
      Number.isSafeInteger(coordinate.sentenceEnd) &&
      (coordinate.sentenceEnd as number) >= (coordinate.sentenceStart as number) &&
      Number.isSafeInteger(coordinate.characterStart) &&
      (coordinate.characterStart as number) >= 0 &&
      Number.isSafeInteger(coordinate.characterEnd) &&
      (coordinate.characterEnd as number) > (coordinate.characterStart as number) &&
      typeof coordinate.text === "string" && Boolean(coordinate.text) &&
      [...coordinate.text].length <=
        SCREEN02_SOURCE_GROUNDING_MAX_COORDINATE_TEXT_CHARS &&
      stringArray(coordinate.matchedIdentityTerms) &&
      coordinate.matchedIdentityTerms.length <=
        SCREEN02_SOURCE_GROUNDING_MAX_IDENTITY_TERMS &&
      (coordinate.matchedIdentityTerms as string[]).every((term) =>
        term.length > 0 && term.length <= 160
      ) &&
      stringArray(coordinate.matchedFormalIdentifiers) &&
      coordinate.matchedFormalIdentifiers.length <=
        SCREEN02_SOURCE_GROUNDING_MAX_FORMAL_IDENTIFIERS &&
      (coordinate.matchedFormalIdentifiers as string[]).every((term) =>
        term.length > 0 && term.length <= 160
      ) &&
      stringArray(coordinate.matchedActionTerms) &&
      coordinate.matchedActionTerms.length <=
        SCREEN02_SOURCE_GROUNDING_MAX_ACTION_TERMS &&
      (coordinate.matchedActionTerms as string[]).every((term) =>
        term.length > 0 && term.length <= 160
      ) &&
      stringArray(coordinate.matchedDateTerms) &&
      coordinate.matchedDateTerms.length <=
        SCREEN02_SOURCE_GROUNDING_MAX_DATE_TERMS &&
      (coordinate.matchedDateTerms as string[]).every((term) =>
        term.length > 0 && term.length <= 160
      ) &&
      coordinate.polarity === "affirmative"
    ) ||
    (!hasMigrationProvenance &&
      overview.identity === true &&
      overview.sourceGrounding.coordinates.length === 0)
  ) return false;
  if (!record(value.sourceQuality) || !exactKeys(value.sourceQuality, [
    "status", "strongestAuthorityTier", "score", "explanation", "evidenceSourceIds",
  ]) || !["high", "adequate", "limited", "insufficient"].includes(value.sourceQuality.status as string) ||
    !(value.sourceQuality.strongestAuthorityTier === null || [1,2,3,4,5,6].includes(value.sourceQuality.strongestAuthorityTier as number)) ||
    !finiteRange(value.sourceQuality.score, 0, 100) ||
    typeof value.sourceQuality.explanation !== "string" || !value.sourceQuality.explanation ||
    !stringArray(value.sourceQuality.evidenceSourceIds)) return false;
  if (!record(value.retrieval) || !exactKeys(value.retrieval, ["bm25Rank", "bm25Score"]) ||
    !Number.isSafeInteger(value.retrieval.bm25Rank) || (value.retrieval.bm25Rank as number) < 1 ||
    !finiteRange(value.retrieval.bm25Score, 0, Number.MAX_SAFE_INTEGER)) return false;
  if (!record(value.ranking) || !exactKeys(value.ranking, [
    "baseScore", "diversityAdjustment", "totalScore", "rank", "explanation",
  ]) || !finiteRange(value.ranking.baseScore, 0, 100) ||
    !finiteRange(value.ranking.diversityAdjustment, -100, 0) ||
    !finiteRange(value.ranking.totalScore, 0, 100) ||
    !(value.ranking.rank === null || (Number.isSafeInteger(value.ranking.rank) && (value.ranking.rank as number) >= 1)) ||
    typeof value.ranking.explanation !== "string" || !value.ranking.explanation) return false;
  const eligible = value.eligible as boolean;
  const classification = value.classification as Screen02IndustryFitClass;
  const admission = hasCandidateAdmission
    ? value.candidateAdmission as Screen02CandidateAdmission
    : null;
  if (admission && (
    admission.displayEvidence.stableIdentity !== overview.identity ||
    admission.displayEvidence.substantiveChange !== overview.change ||
    admission.displayEvidence.relevantDate !== overview.materialDate ||
    admission.relevance.classification !== classification ||
    admission.relevance.recommended !== (
      classification !== "mismatch" &&
      disposition !== "demonstrated-mismatch" && disposition !== "mixed"
    )
  )) return false;
  return eligible
    ? value.exclusionCodes.length === 0 && value.section !== null &&
        classification !== "mismatch" &&
        (admission
          ? admission.displayEvidence.supported &&
            admission.relevance.recommended
          : value.hardScope.passed === true) &&
        overview.passed === true &&
        value.sourceQuality.status !== "insufficient" &&
        value.exposureFeasibility.status !== "infeasible"
    : value.exclusionCodes.length > 0 && value.section === null;
}

function migratedScreen02QualificationCacheKey(value: Record<string, unknown>) {
  if (typeof value.cacheKey !== "string") return value.cacheKey;
  return value.cacheKey.startsWith(
    `${SCREEN02_CANDIDATE_QUALIFICATION_VERSION}:`,
  )
    ? value.cacheKey
    : `${SCREEN02_CANDIDATE_QUALIFICATION_VERSION}:${value.cacheKey}`;
}

function migratedHardScopeStates(
  mismatchKeys: readonly unknown[],
  insufficientEvidenceKeys: readonly unknown[],
) {
  return {
    evidenceState: insufficientEvidenceKeys.length > 0
      ? "insufficient" as const
      : "supported" as const,
    relevanceState: mismatchKeys.length > 0
      ? "demonstrated-mismatch" as const
      : insufficientEvidenceKeys.length > 0
        ? "unresolved" as const
        : "within-scope" as const,
  };
}

/**
 * Restores persisted v2/v3 traces without claiming that an old run emitted v4
 * evidence. The retained checks/disposition determine only the two orthogonal
 * state labels. Explicit provenance records that no current source evidence
 * was reconstructed, and cache reuse rejects every migrated trace.
 */
export function migrateScreen02CandidateQualification(
  value: unknown,
): Screen02CandidateQualification | null {
  if (isScreen02CandidateQualification(value)) {
    return JSON.parse(JSON.stringify(value)) as Screen02CandidateQualification;
  }
  if (!record(value)) return null;

  if (
    value.version === SCREEN02_CANDIDATE_QUALIFICATION_PREVIOUS_VERSION &&
    record(value.hardScope) &&
    exactKeys(value.hardScope, [
      "passed", "disposition", "mismatchKeys", "insufficientEvidenceKeys",
      "blockingKeys", "checks", "explanation",
    ]) &&
    Array.isArray(value.hardScope.mismatchKeys) &&
    Array.isArray(value.hardScope.insufficientEvidenceKeys)
  ) {
    const mismatchKeys = value.hardScope.mismatchKeys;
    const insufficientEvidenceKeys = value.hardScope.insufficientEvidenceKeys;
    const migrated = {
      ...JSON.parse(JSON.stringify(value)) as Record<string, unknown>,
      version: SCREEN02_CANDIDATE_QUALIFICATION_VERSION,
      cacheKey: migratedScreen02QualificationCacheKey(value),
      hardScope: {
        ...JSON.parse(JSON.stringify(value.hardScope)) as Record<string, unknown>,
        ...migratedHardScopeStates(mismatchKeys, insufficientEvidenceKeys),
      },
      substantiveOverview: record(value.substantiveOverview)
        ? {
            ...JSON.parse(JSON.stringify(value.substantiveOverview)) as Record<string, unknown>,
            sourceGrounding: {
              schemaVersion: SCREEN02_SOURCE_GROUNDING_VERSION,
              coordinates: [],
            },
          }
        : value.substantiveOverview,
      migrationProvenance: {
        schemaVersion: SCREEN02_CANDIDATE_QUALIFICATION_MIGRATION_VERSION,
        fromVersion: SCREEN02_CANDIDATE_QUALIFICATION_PREVIOUS_VERSION,
        method: "derived-retained-v3-disposition",
        sourceEvidenceReconstructed: false,
      },
    };
    return isScreen02CandidateQualification(migrated)
      ? migrated
      : null;
  }

  if (
    value.version !== SCREEN02_CANDIDATE_QUALIFICATION_LEGACY_VERSION ||
    !record(value.hardScope) ||
    !exactKeys(value.hardScope, [
      "passed", "blockingKeys", "checks", "explanation",
    ]) ||
    !Array.isArray(value.hardScope.blockingKeys) ||
    !Array.isArray(value.hardScope.checks) ||
    !Array.isArray(value.exclusionCodes) ||
    (value.exclusionCodes as unknown[]).includes(
      "hard-scope-insufficient-evidence",
    )
  ) {
    return null;
  }

  const blockingKeys = value.hardScope.blockingKeys;
  const checkByKey = new Map<string, unknown>(
    value.hardScope.checks.flatMap((check) =>
      record(check) && typeof check.key === "string"
        ? [[check.key, check.status]]
        : []
    ),
  );
  const mismatchKeys = blockingKeys.filter(
    (key): key is Screen02HardFilterKey =>
      typeof key === "string" && checkByKey.get(key) === "fail",
  );
  const insufficientEvidenceKeys = blockingKeys.filter(
    (key): key is Screen02HardFilterKey =>
      typeof key === "string" && checkByKey.get(key) === "review",
  );
  const disposition: Screen02HardScopeDisposition =
    mismatchKeys.length > 0
      ? insufficientEvidenceKeys.length > 0
        ? "mixed"
        : "demonstrated-mismatch"
      : insufficientEvidenceKeys.length > 0
        ? "insufficient-evidence"
        : "supported";
  const migratedExclusionCodes = (value.exclusionCodes as unknown[])
    .filter((code) => code !== "hard-scope-mismatch");
  if (mismatchKeys.length > 0) {
    migratedExclusionCodes.unshift("hard-scope-mismatch");
  }
  if (insufficientEvidenceKeys.length > 0) {
    const insertAt = mismatchKeys.length > 0 ? 1 : 0;
    migratedExclusionCodes.splice(
      insertAt,
      0,
      "hard-scope-insufficient-evidence",
    );
  }

  const migrated = {
    ...JSON.parse(JSON.stringify(value)) as Record<string, unknown>,
    version: SCREEN02_CANDIDATE_QUALIFICATION_VERSION,
    cacheKey: migratedScreen02QualificationCacheKey(value),
    hardScope: {
      ...JSON.parse(JSON.stringify(value.hardScope)) as Record<string, unknown>,
      disposition,
      ...migratedHardScopeStates(mismatchKeys, insufficientEvidenceKeys),
      mismatchKeys,
      insufficientEvidenceKeys,
    },
    substantiveOverview: record(value.substantiveOverview)
      ? {
          ...JSON.parse(JSON.stringify(value.substantiveOverview)) as Record<string, unknown>,
          sourceGrounding: {
            schemaVersion: SCREEN02_SOURCE_GROUNDING_VERSION,
            coordinates: [],
          },
        }
      : value.substantiveOverview,
    exclusionCodes: migratedExclusionCodes,
    migrationProvenance: {
      schemaVersion: SCREEN02_CANDIDATE_QUALIFICATION_MIGRATION_VERSION,
      fromVersion: SCREEN02_CANDIDATE_QUALIFICATION_LEGACY_VERSION,
      method: "derived-retained-v2-checks",
      sourceEvidenceReconstructed: false,
    },
  };
  return isScreen02CandidateQualification(migrated)
    ? migrated
    : null;
}

export function isCompatibleScreen02CandidateQualification(
  value: unknown,
) {
  return migrateScreen02CandidateQualification(value) !== null;
}
