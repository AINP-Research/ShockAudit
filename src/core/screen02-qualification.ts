import type { Screen01StudyContext } from "./scope-types";
import {
  clusterScreen02Proposals,
  normalizeScreen02DiscoveryText,
  rankScreen02ProposalsBm25,
  screen02StudyProfileIndustryTerms,
} from "./screen02-discovery";
import {
  isScreen02StudyRelevanceProfile,
  type Screen02StudyRelevanceProfile,
} from "./screen02-relevance-profile";
import {
  SCREEN02_RANKING_STRATEGIES,
  executeScreen02RankingStrategy,
} from "./screen02-ranking-strategy";
import {
  evaluateFindHardFilters,
  screen02MaterialTimingFacts,
  screen02RequiredVariableHasReconstructibleExposureConcept,
  sourceResolvesFindHardFilterReview,
} from "./screen02-service";
import {
  SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN,
  type Screen02FindProposal,
  type Screen02HardFilterKey,
} from "./screen02-types";
import {
  SCREEN02_SOURCE_GROUNDING_VERSION,
  groundScreen02ProposalSource,
  screen02SourceSupportsProposalIdentity,
  type Screen02SourceEvidenceCoordinate,
} from "./screen02-source-grounding";

import {
  SCREEN02_CANDIDATE_QUALIFICATION_VERSION,
  SCREEN02_CANDIDATE_ADMISSION_POLICY_VERSION,
  SCREEN02_CANDIDATE_REVIEW_INFLUENCE_TRACE_VERSION,
  SCREEN02_QUALIFICATION_GROUNDING_POLICY_VERSION,
  SCREEN02_QUALIFICATION_MAX_SOURCE_GROUNDING_COORDINATES,
  screen02CandidateReviewClassEffects,
  screen02CandidateReviewInfluenceReasons,
  screen02IndustryFitClasses,
  screen02QualificationLanes,
  screen02QualificationSections,
  validateScreen02CandidateReviewInfluenceMap,
  type Screen02CandidateQualification,
  type Screen02CandidateAdmission,
  type Screen02CandidateReviewClassEffect,
  type Screen02CandidateReviewInfluence,
  type Screen02CandidateReviewInfluenceMap,
  type Screen02CandidateReviewInfluenceReason,
  type Screen02CandidateReviewInfluenceTrace,
  type Screen02CandidateReviewVerifiedBridge,
  type Screen02HardScopeDisposition,
  type Screen02HardScopeEvidenceState,
  type Screen02HardScopeRelevanceState,
  type Screen02IndustryFitClass,
  type Screen02QualificationExclusionCode,
  type Screen02QualificationLane,
  type Screen02SubstantiveOverviewGate,
} from "./screen02-qualification-codec";

export * from "./screen02-qualification-codec";

const SCREEN02_QUALIFICATION_PREVIOUS_GROUNDING_POLICY_VERSION =
  "policy-v3" as const;
export const SCREEN02_ORDINARY_BROAD_RESULT_CAP =
  2;

export type Screen02QualifiedProposal = {
  proposal: Screen02FindProposal;
  qualification: Screen02CandidateQualification;
};

export type Screen02QualificationExclusion = Screen02QualifiedProposal & {
  code: Screen02QualificationExclusionCode;
  reason: string;
};

export type Screen02QualificationResult = {
  selected: Screen02QualifiedProposal[];
  excluded: Screen02QualificationExclusion[];
  evaluated: Screen02QualifiedProposal[];
  returnedTitleCount: number;
  qualifiedCandidateCount: number;
};

const GENERAL_ORGANIZATION_TERMS = [
  "business",
  "businesses",
  "company",
  "companies",
  "firm",
  "firms",
  "issuer",
  "issuers",
  "organization",
  "organizations",
  "enterprise",
  "enterprises",
  "public interest entit",
  "controller",
  "controllers",
  "processor",
  "processors",
] as const;

const GENERIC_POPULATION_WORDS = new Set([
  "all", "business", "businesses", "company", "companies", "covered",
  "enterprise", "enterprises", "firm", "firms", "listed", "organization",
  "organizations", "private", "public", "qualifying",
]);

const CROSS_INDUSTRY_REACH_TERMS = [
  "across industries",
  "all industries",
  "cross industry",
  "economy wide",
  "all public companies",
  "all listed companies",
  "all businesses",
] as const;

const CHANGE_TERMS = [
  "adopt",
  "allow",
  "amend",
  "authorize",
  "ban",
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
  "set",
] as const;

const AFFECTED_TERMS = [
  ...GENERAL_ORGANIZATION_TERMS,
  "applicant",
  "applicants",
  "consumer",
  "consumers",
  "customer",
  "customers",
  "employee",
  "employees",
  "provider",
  "providers",
  "operator",
  "operators",
  "bank",
  "banks",
  "depository institution",
  "depository institutions",
  "facility",
  "facilities",
  "fabricator",
  "fabricators",
  "manufacturer",
  "manufacturers",
  "producer",
  "producers",
  "publisher",
  "publishers",
  "supplier",
  "suppliers",
  "utility",
  "utilities",
  "user",
  "users",
] as const;

const OUTCOME_TERMS: Readonly<Record<string, readonly string[]>> = {
  innovation: [
    "innovation",
    "research and development",
    "r d",
    "product development",
    "technology investment",
    "patent",
  ],
  profitability: [
    "profitability",
    "profit",
    "cost",
    "revenue",
    "margin",
    "financial performance",
  ],
};

function normalize(value: string) {
  return normalizeScreen02DiscoveryText(value);
}

function unique(values: readonly string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function fingerprintCanonicalText(value: string) {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

function canonicalQualificationProfileValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalQualificationProfileValue).sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right), "en-US")
    );
  }
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(object).sort().map((key) => [
      key,
      canonicalQualificationProfileValue(object[key]),
    ]));
  }
  return value;
}

/**
 * Fingerprints the canonical classification vocabulary, not profile creation
 * timestamps. Fixed-profile cache reuse therefore survives an equivalent
 * rebuild but not a vocabulary, ambiguity, identity, schema, or version edit.
 */
export function fingerprintScreen02QualificationProfile(
  profile?: Screen02StudyRelevanceProfile,
) {
  if (!profile) return "profile-none";
  const {
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    hostEnrichmentCache: _hostEnrichmentCache,
    ...classificationProfile
  } = profile;
  return fingerprintCanonicalText(JSON.stringify(
    canonicalQualificationProfileValue(classificationProfile),
  ));
}

export function screen02QualificationCacheKey(input: {
  scopeFingerprint: string;
  proposal: Screen02FindProposal;
  sourceFingerprint: string;
  studyProfile?: Screen02StudyRelevanceProfile;
}) {
  const profileVersion = input.studyProfile?.profileVersion ?? "none";
  const profileFingerprint = fingerprintScreen02QualificationProfile(
    input.studyProfile,
  );
  return `${SCREEN02_CANDIDATE_QUALIFICATION_VERSION}:${input.scopeFingerprint}:profile:${profileVersion}:${profileFingerprint}:grounding:${SCREEN02_SOURCE_GROUNDING_VERSION}:${SCREEN02_QUALIFICATION_GROUNDING_POLICY_VERSION}:${input.sourceFingerprint}:${input.proposal.id}`;
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

/**
 * Binds a persisted qualification to the exact source-derived candidate facts
 * it evaluated. Set-like fields are sorted so connector/source ordering alone
 * cannot invalidate an otherwise identical cached result. Retrieval time is
 * execution metadata rather than a source fact, so reacquiring unchanged
 * content does not invalidate the qualification cache.
 */
export function fingerprintScreen02QualificationSources(
  proposal: Screen02FindProposal,
) {
  const sources = proposal.sources
    .map((source) => [
      source.id,
      source.title,
      source.locator,
      source.publisher,
      source.publishedDate ?? "",
      source.authorityTier,
      source.authorityAssessment?.method ?? "",
      source.authorityAssessment?.reason ?? "",
      source.authorityAssessment?.policyVersion ?? "",
      source.channel,
      source.evidenceText ?? "",
      source.isFictionalDemo === true,
    ] as const)
    .sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right), "en-US")
    );
  const canonical = {
    title: proposal.title,
    description: proposal.description,
    nativeIdentity: proposal.nativeIdentity ?? null,
    event: {
      ...proposal.event,
      geographies: [...proposal.event.geographies].sort((left, right) =>
        left.localeCompare(right, "en-US")
      ),
      populations: [...proposal.event.populations].sort((left, right) =>
        left.localeCompare(right, "en-US")
      ),
    },
    provisionalDates: [...proposal.provisionalDates].sort((left, right) =>
      left.localeCompare(right, "en-US")
    ),
    affectedPopulation: proposal.affectedPopulation,
    requiredVariables: [...proposal.requiredVariables].sort((left, right) =>
      left.localeCompare(right, "en-US")
    ),
    relationshipEvidenceSourceIds: [
      ...(proposal.relationshipEvidenceSourceIds ?? []),
    ].sort((left, right) => left.localeCompare(right, "en-US")),
    likelyServiceLevel: proposal.likelyServiceLevel,
    limitations: [...proposal.limitations].sort((left, right) =>
      left.localeCompare(right, "en-US")
    ),
    sources,
  };
  return fingerprintCanonicalText(JSON.stringify(canonical));
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

function matchedTerms(text: string, candidates: readonly string[]) {
  return unique(candidates.filter((term) => hasTerm(text, term)));
}

function qualificationEvidenceSources(proposal: Screen02FindProposal) {
  return proposal.sources.filter((source) => source.authorityTier < 6);
}

function qualificationSourceSupportsIdentity(
  proposal: Screen02FindProposal,
  source: Screen02FindProposal["sources"][number],
) {
  return screen02SourceSupportsProposalIdentity(proposal, source);
}

function traceableQualificationSources(proposal: Screen02FindProposal) {
  const authoritative = qualificationEvidenceSources(proposal);
  return authoritative.filter((source) =>
    Boolean(source.evidenceText?.trim()) &&
    qualificationSourceSupportsIdentity(proposal, source)
  );
}

function traceableIndustryRelationshipSources(
  proposal: Screen02FindProposal,
) {
  const relationshipIds = new Set(
    proposal.relationshipEvidenceSourceIds ?? [],
  );
  return proposal.sources.filter((source) =>
    relationshipIds.has(source.id) && source.authorityTier < 6 &&
    Boolean(source.evidenceText?.trim())
  );
}

function sourceEvidenceText(proposal: Screen02FindProposal) {
  const sourceText = traceableQualificationSources(proposal)
    .map((source) => groundScreen02ProposalSource(proposal, source).evidenceText)
    .filter(Boolean);
  return sourceText.join(" ");
}

function sourceEvidenceWithoutIdentitySequences(
  proposal: Screen02FindProposal,
  source: Screen02FindProposal["sources"][number],
) {
  let evidence = normalize(
    groundScreen02ProposalSource(proposal, source).evidenceText,
  );
  for (const identityText of [
    proposal.title,
    proposal.event.displayName,
    proposal.nativeIdentity?.formalIdentifier ?? "",
    source.title,
  ]) {
    const normalizedIdentity = normalize(identityText);
    if (normalizedIdentity) {
      evidence = removeNormalizedSequence(evidence, normalizedIdentity);
    }
  }
  return evidence;
}

/**
 * Adjacent fit may use concrete activities, products, or regulatory surfaces
 * stated in a candidate-bound authoritative passage. Candidate/source titles
 * and formal identifiers are removed first so metadata cannot create fit.
 */
function sourceBackedAdjacentEvidenceText(proposal: Screen02FindProposal) {
  const identityEvidence = traceableQualificationSources(proposal)
    .map((source) => sourceEvidenceWithoutIdentitySequences(proposal, source));
  const relationshipEvidence = traceableIndustryRelationshipSources(proposal)
    .map((source) => source.evidenceText?.trim() ?? "");
  return [...identityEvidence, ...relationshipEvidence]
    .filter(Boolean)
    .join(" ");
}

/**
 * Direct industry fit must come from the substantive portion of a
 * candidate-bound passage. Candidate and source titles are identity evidence,
 * not proof that the event changed activity in the named industry.
 */
function sourceBackedDirectEvidenceText(proposal: Screen02FindProposal) {
  return traceableQualificationSources(proposal)
    .map((source) => sourceEvidenceWithoutIdentitySequences(proposal, source))
    .filter(Boolean)
    .join(" ");
}

function sourceSupportsText(sourceText: string, value: string) {
  const normalizedValue = normalize(value);
  return normalizedValue.length > 0 && normalize(sourceText).includes(
    normalizedValue,
  );
}

function sourceBackedPopulationText(proposal: Screen02FindProposal) {
  const populationValues = [
    ...proposal.event.populations,
    proposal.affectedPopulation,
  ].filter((value) =>
    value.trim() &&
    value !== SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN &&
    !/\b(?:unknown|unverified|not established)\b/iu.test(value)
  );
  const evidence = sourceEvidenceText(proposal);
  return populationValues
    .filter((value) => sourceSupportsText(evidence, value))
    .join("; ");
}

function sourceIdsSupportingValues(
  proposal: Screen02FindProposal,
  values: readonly string[],
) {
  return unique(traceableQualificationSources(proposal).flatMap((source) => {
    const groundedText = groundScreen02ProposalSource(proposal, source)
      .evidenceText;
    return values.some((value) => sourceSupportsText(groundedText, value))
      ? [source.id]
      : [];
  }));
}

const REQUIRED_VARIABLE_GROUNDING_STOP_WORDS = new Set([
  "a", "an", "and", "for", "from", "in", "of", "on", "or", "the",
  "to", "with",
]);

function removeNormalizedSequence(value: string, sequence: string) {
  const bounded = ` ${value} `;
  const needle = ` ${sequence} `;
  return bounded.split(needle).join(" ").trim().replace(/\s+/gu, " ");
}

function sourceIdsSupportingGroundedRequiredVariable(
  proposal: Screen02FindProposal,
  variable: string,
) {
  const normalizedVariable = normalize(variable);
  const variableTokens = normalizedVariable.split(" ").filter(Boolean);
  const meaningfulTokens = variableTokens.filter((token) =>
    token.length >= 3 && !REQUIRED_VARIABLE_GROUNDING_STOP_WORDS.has(token)
  );
  if (
    variable.length > 240 || variableTokens.length > 24 ||
    meaningfulTokens.length < 2 ||
    !screen02RequiredVariableHasReconstructibleExposureConcept(variable)
  ) return [];
  const normalizedTitle = normalize(proposal.title);
  const normalizedFormalIdentifier = normalize(
    proposal.nativeIdentity?.formalIdentifier ?? "",
  );
  return unique(traceableQualificationSources(proposal).flatMap((source) => {
    let groundedText = normalize(
      groundScreen02ProposalSource(proposal, source).evidenceText,
    );
    if (normalizedTitle) {
      groundedText = removeNormalizedSequence(groundedText, normalizedTitle);
    }
    if (normalizedFormalIdentifier) {
      groundedText = removeNormalizedSequence(
        groundedText,
        normalizedFormalIdentifier,
      );
    }
    const normalizedSourceTitle = normalize(source.title);
    if (normalizedSourceTitle) {
      groundedText = removeNormalizedSequence(
        groundedText,
        normalizedSourceTitle,
      );
    }
    return ` ${groundedText} `.includes(` ${normalizedVariable} `)
      ? [source.id]
      : [];
  }));
}

function sourceGroundedRequiredVariables(proposal: Screen02FindProposal) {
  return proposal.requiredVariables.filter((variable) =>
    sourceIdsSupportingGroundedRequiredVariable(proposal, variable).length > 0
  );
}

function proposalLane(proposal: Screen02FindProposal): Screen02QualificationLane {
  if (proposal.origin === "registry-reviewed") return "reviewed-registry";
  if (proposal.origin === "unsupported-lead") return "context-live-web";
  if (proposal.origin === "user-provided") return "researcher-source";
  return "official-source";
}

export function screen02QualificationLaneForProposal(
  proposal: Screen02FindProposal,
) {
  return proposalLane(proposal);
}

function exactCurrentRunScreen02QualificationMatches(
  qualification: Screen02CandidateQualification | undefined,
  input: {
    candidateId: string;
    scopeFingerprint: string;
    sourceFingerprint: string;
    cacheKey: string;
    lane: Screen02QualificationLane;
    hasCandidateReviewInfluence: boolean;
  },
) {
  return !input.hasCandidateReviewInfluence &&
    qualification?.hostReviewInfluence === undefined &&
    qualification?.migrationProvenance === undefined &&
    qualification?.version === SCREEN02_CANDIDATE_QUALIFICATION_VERSION &&
    qualification.scopeFingerprint === input.scopeFingerprint &&
    qualification.candidateId === input.candidateId &&
    qualification.sourceFingerprint === input.sourceFingerprint &&
    qualification.cacheKey === input.cacheKey &&
    qualification.lane === input.lane;
}

/**
 * Accepts only an immutable qualification created earlier in the same run for
 * the exact current proposal/profile/lane binding. This deliberately does not
 * apply the stricter fixed-profile rule used for persisted cache entries.
 */
export function screen02CurrentRunQualificationMatches(
  qualification: Screen02CandidateQualification | undefined,
  proposal: Screen02FindProposal,
  input: {
    scopeFingerprint: string;
    lane?: Screen02QualificationLane;
    studyProfile?: Screen02StudyRelevanceProfile;
    hasCandidateReviewInfluence?: boolean;
  },
) {
  const sourceFingerprint = fingerprintScreen02QualificationSources(proposal);
  return exactCurrentRunScreen02QualificationMatches(qualification, {
    candidateId: proposal.id,
    scopeFingerprint: input.scopeFingerprint,
    sourceFingerprint,
    cacheKey: screen02QualificationCacheKey({
      scopeFingerprint: input.scopeFingerprint,
      proposal,
      sourceFingerprint,
      studyProfile: input.studyProfile,
    }),
    lane: input.lane ?? proposalLane(proposal),
    hasCandidateReviewInfluence:
      input.hasCandidateReviewInfluence === true,
  });
}

function cleanOverviewDescription(value: string) {
  return value
    .replace(
      /^(?:final rule|proposed rule|rule|notice) published in the federal register on \d{4}-\d{2}-\d{2}\.\s*/i,
      "",
    )
    .replace(
      /\s*Applicability to the requested organizational population is provisional\.\s*$/i,
      "",
    )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1_000);
}

function overviewSentences(value: string) {
  return value
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.replace(/\s+/gu, " ").trim())
    .filter(Boolean);
}

function sentenceSupportsAffectedPopulation(sentence: string) {
  return matchedTerms(sentence, AFFECTED_TERMS).length > 0 &&
    /\b(?:affected population|appl(?:y|ies|ied) to|cover(?:s|ed)?|eligible|include(?:s|d)?|participants?|regulat(?:e|es|ed)|requir(?:e|es|ed))\b/iu
      .test(sentence);
}

function sourceBackedOverviewSummary(
  proposal: Screen02FindProposal,
  evidenceText: string,
) {
  const tracedDescription = overviewSentences(
    cleanOverviewDescription(proposal.description),
  ).filter((sentence) => sourceSupportsText(evidenceText, sentence));
  const tracedSummary = tracedDescription.join(" ");
  // A single matching metadata fragment (for example, only "Countries
  // reported") must not suppress the richer candidate-bound source window
  // that also contains the occurrence, date, and exposure surface.
  const baseSummary = tracedSummary.split(/\s+/u).filter(Boolean).length >= 12
    ? tracedSummary
    : evidenceText;
  // A long connector abstract can accurately summarize the change while
  // omitting the affected entities named in a subsequently fetched official
  // body. Retain one distinct population-bearing sentence, but only from the
  // candidate-bound grounding text and within the existing summary cap.
  const groundedAffectedSentence = overviewSentences(evidenceText).find(
    sentenceSupportsAffectedPopulation,
  ) ?? "";
  const summary = groundedAffectedSentence &&
      !sourceSupportsText(baseSummary, groundedAffectedSentence)
    ? `${groundedAffectedSentence} ${baseSummary}`
    : baseSummary;
  return cleanOverviewDescription(
    summary,
  );
}

function sourceBackedDescriptionText(proposal: Screen02FindProposal) {
  const evidenceText = sourceEvidenceText(proposal);
  return overviewSentences(cleanOverviewDescription(proposal.description))
    .filter((sentence) => sourceSupportsText(evidenceText, sentence))
    .join(" ");
}

function screen02OverviewStudyRelevance(
  context: Screen01StudyContext,
  industryExplanation: string,
  outcomeExplanation: string,
) {
  return `Preliminary research-design hypothesis: ${industryExplanation} ${outcomeExplanation} ` +
    `The requested study concerns ${context.scopeContract.population} in ${context.scopeContract.industry} within ${context.scopeContract.geography}. This is a pathway to investigate, not an established effect.`;
}

function substantiveOverview(
  proposal: Screen02FindProposal,
  context: Screen01StudyContext,
  industryExplanation: string,
  outcomeExplanation: string,
  exposureExplanation: string,
): Screen02SubstantiveOverviewGate {
  const evidenceSources = traceableQualificationSources(proposal);
  const allSourceGroundingCoordinates = evidenceSources.flatMap((source) =>
    groundScreen02ProposalSource(proposal, source).coordinates
      .map((coordinate) => structuredClone(coordinate))
  );
  const coordinateTokens = (text: string) => new Set(
    normalize(text).split(" ").filter((term) => term.length >= 4),
  );
  const nearDuplicateCoordinate = (
    left: Screen02SourceEvidenceCoordinate,
    right: Screen02SourceEvidenceCoordinate,
  ) => {
    const leftTokens = coordinateTokens(left.text);
    const rightTokens = coordinateTokens(right.text);
    if (leftTokens.size === 0 || rightTokens.size === 0) return false;
    let intersection = 0;
    for (const token of leftTokens) {
      if (rightTokens.has(token)) intersection += 1;
    }
    return intersection / Math.min(leftTokens.size, rightTokens.size) >= 0.82;
  };
  const coordinatePriority = (coordinate: Screen02SourceEvidenceCoordinate) =>
    coordinate.matchedActionTerms.length * 40 +
    coordinate.matchedFormalIdentifiers.length * 25 +
    coordinate.matchedDateTerms.length * 20 +
    coordinate.matchedIdentityTerms.length * 3 +
    (/\b(?:shall|must|requir\w*|revis\w*|establish\w*|prohibit\w*)\b/iu
        .test(coordinate.text)
      ? 80
      : 0) +
    (/\b(?:business\w*|compan\w*|controller\w*|firm\w*|operator\w*|organization\w*|provider\w*|publisher\w*)\b/iu
        .test(coordinate.text)
      ? 30
      : 0);
  const diverseCoordinates: Screen02SourceEvidenceCoordinate[] = [];
  for (const coordinate of allSourceGroundingCoordinates.sort((left, right) =>
    coordinatePriority(right) - coordinatePriority(left) ||
    left.sourceId.localeCompare(right.sourceId, "en-US") ||
    left.sentenceStart - right.sentenceStart ||
    left.sentenceEnd - right.sentenceEnd
  )) {
    if (diverseCoordinates.some((retained) =>
      nearDuplicateCoordinate(retained, coordinate)
    )) continue;
    diverseCoordinates.push(coordinate);
  }
  const sourceGroundingCoordinates = diverseCoordinates
    .slice(0, SCREEN02_QUALIFICATION_MAX_SOURCE_GROUNDING_COORDINATES)
    .sort((left, right) =>
    left.sourceId.localeCompare(right.sourceId, "en-US") ||
    left.sentenceStart - right.sentenceStart ||
    left.sentenceEnd - right.sentenceEnd
  );
  const sourceText = sourceEvidenceText(proposal);
  const sourceIds = unique(evidenceSources.map((source) => source.id));
  const summary = sourceBackedOverviewSummary(proposal, sourceText);
  const summarySentences = overviewSentences(summary);
  const normalizedTitle = normalize(proposal.title);
  const identity =
    sourceIds.length > 0 &&
    normalizedTitle.length >= 8 &&
    !new Set(["rule", "notice", "proposed rule", "final rule"]).has(
      normalizedTitle,
    ) &&
    sourceGroundingCoordinates.some((coordinate) =>
      coordinate.polarity === "affirmative" &&
      coordinate.matchedActionTerms.length > 0 &&
      (coordinate.matchedIdentityTerms.length > 0 ||
        coordinate.matchedFormalIdentifiers.length > 0)
    );
  const substantiveLength =
    summary.split(/\s+/).filter(Boolean).length >= 12;
  const disasterOccurrence =
    normalize(proposal.event.eventFamily).includes("disaster") &&
    summarySentences.some(
      (sentence) =>
        !/\b(?:does not|did not|cannot|could not|fails? to)\b/i.test(
          sentence,
        ) &&
        /\b(?:recorded|reported|declared|occurred|struck|began|beginning|detected)\b/i.test(
          sentence,
        ) &&
        /\b(?:earthquake|flood|cyclone|hurricane|storm|wildfire|volcano|drought|tsunami|disaster|declaration)\b/i.test(
          sentence,
        ),
    );
  const change = substantiveLength &&
    (matchedTerms(summary, CHANGE_TERMS).length > 0 || disasterOccurrence);
  const establishedPopulations = proposal.event.populations.filter(
    (population) =>
      population.trim() &&
      population !== SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN &&
      !/\b(?:unknown|unverified|not established)\b/iu.test(population) &&
      sourceSupportsText(sourceText, population),
  );
  const suppliedAffectedPopulation =
    proposal.affectedPopulation.trim() &&
    proposal.affectedPopulation !== SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN &&
    !/\b(?:unknown|unverified|not established)\b/i.test(
      proposal.affectedPopulation,
    ) && sourceSupportsText(sourceText, proposal.affectedPopulation)
      ? proposal.affectedPopulation.trim()
      : "";
  const affectedSentence = summarySentences.find(
    sentenceSupportsAffectedPopulation,
  ) ?? "";
  const sourceIdentifiedDisasterAreas =
    normalize(proposal.event.eventFamily).includes("disaster") &&
      disasterOccurrence
      ? unique(
          proposal.event.geographies.filter(
            (geography) =>
              Boolean(normalize(geography)) &&
              !/^(?:unknown|not specified|worldwide)$/.test(
                normalize(geography),
              ) && sourceSupportsText(sourceText, geography),
          ),
        )
      : [];
  const disasterAreaDescription = sourceIdentifiedDisasterAreas.length > 0
    ? `Source-identified geographic area${sourceIdentifiedDisasterAreas.length === 1 ? "" : "s"}: ${sourceIdentifiedDisasterAreas.join("; ")}. Organization-level exposure still requires the recorded location or footprint linkage.`
    : "";
  const whoMayBeAffected =
    unique([
      ...establishedPopulations,
      ...(suppliedAffectedPopulation ? [suppliedAffectedPopulation] : []),
    ]).join("; ") || affectedSentence || disasterAreaDescription;
  const affectedPopulation = whoMayBeAffected.length > 0;
  const timingFacts = screen02MaterialTimingFacts(proposal);
  const materialDate = timingFacts.length > 0;
  const importantTiming = timingFacts
    .slice(0, 4)
    .map((fact) => fact.clause.replace(/\s+/gu, " ").trim().slice(0, 220))
    .join(" ");
  const status = proposal.nativeIdentity?.status?.trim() ?? "";
  const issuer = proposal.nativeIdentity?.issuer?.trim() ?? "";
  const groundedStatus = status && sourceSupportsText(sourceText, status)
    ? status
    : "";
  const groundedIssuer = issuer && sourceSupportsText(sourceText, issuer)
    ? issuer
    : "";
  const groundedIdentityDetails = [
    groundedStatus ? `status ${groundedStatus}` : "",
    groundedIssuer ? `issuer ${groundedIssuer}` : "",
  ].filter(Boolean);
  const provisionalIdentityDetails = [
    status && !groundedStatus ? `status ${status}` : "",
    issuer && !groundedIssuer ? `issuer ${issuer}` : "",
  ].filter(Boolean);
  const whatTheShockIs =
    (identity
      ? `Retained candidate-bound passages support the event identity for ${proposal.title} and an affirmative event action.`
      : `Candidate metadata names ${proposal.title}, but no retained candidate-bound passage yet supports its identity and an affirmative event action.`) +
    (groundedIdentityDetails.length > 0
      ? ` Those passages also identify ${groundedIdentityDetails.join(" and ")}.`
      : "") +
    (provisionalIdentityDetails.length > 0
      ? ` Candidate metadata provisionally reports ${provisionalIdentityDetails.join(" and ")}; Screen 3 must verify these fields.`
      : "");
  const whatChanged = summary;
  const whyItMayMatterForStudy = screen02OverviewStudyRelevance(
    context,
    industryExplanation,
    outcomeExplanation,
  );
  const provisionalLimitation = proposal.limitations.find((limitation) =>
    limitation.trim().length > 0
  )?.trim();
  const mainUncertainty = provisionalLimitation
    ? `Candidate metadata provisionally reports: ${provisionalLimitation}`
    : exposureExplanation;
  // Screen 2 is a discovery gate. A source-backed identity, substantive
  // change, and correctly retained date are enough to display the candidate;
  // population precision remains an explicit Screen 3 verification need.
  const passed = identity && change && materialDate;
  const missing = [
    !identity ? "identity" : "",
    !change ? "substantive change" : "",
    !affectedPopulation ? "affected population" : "",
    !materialDate ? "material date" : "",
  ].filter(Boolean);
  return {
    identity,
    change,
    affectedPopulation,
    materialDate,
    passed,
    summary: summary || "No source-traced substantive summary is available.",
    whatTheShockIs,
    whatChanged,
    whoMayBeAffected,
    importantTiming,
    whyItMayMatterForStudy,
    mainUncertainty,
    explanation: passed
      ? affectedPopulation
        ? "The attached source record supports a preliminary event identity, substantive change, broad affected group, and material date. This overview remains noncanonical until Screen 3 verification."
        : "The attached source record supports a preliminary event identity, substantive change, and material date. The affected organizational population remains a Screen 3 verification need."
      : `The returned record lacks enough substantive source information to support a preliminary overview: ${missing.join(
          ", ",
        )}.`,
    evidenceSourceIds: unique([
      ...sourceIds,
      ...timingFacts.flatMap((fact) => fact.sourceIds),
    ]),
    sourceGrounding: {
      schemaVersion: SCREEN02_SOURCE_GROUNDING_VERSION,
      coordinates: sourceGroundingCoordinates,
    },
  };
}

function sourceQuality(proposal: Screen02FindProposal) {
  const traceableSources = traceableQualificationSources(proposal);
  const sourceIds = unique(traceableSources.map((source) => source.id));
  const strongestAuthorityTier = traceableSources.length
    ? (Math.min(
        ...traceableSources.map((source) => source.authorityTier),
      ) as 1 | 2 | 3 | 4 | 5 | 6)
    : null;
  const scoreByTier = [0, 100, 85, 70, 55, 35, 10] as const;
  const score = strongestAuthorityTier
    ? scoreByTier[strongestAuthorityTier]
    : 0;
  const status =
    strongestAuthorityTier === null || strongestAuthorityTier === 6
      ? "insufficient"
      : strongestAuthorityTier <= 2
        ? "high"
        : strongestAuthorityTier <= 4
          ? "adequate"
          : "limited";
  return {
    status,
    strongestAuthorityTier,
    score,
    explanation:
      strongestAuthorityTier === null
        ? proposal.sources.some((source) => source.authorityTier < 6)
          ? "No retained authoritative source passage binds its facts to this candidate's exact title or formal identifier."
          : "No source is attached to this record."
        : strongestAuthorityTier === 6
          ? "Only an unverified discovery lead from the contextual lane is attached; it cannot establish a candidate."
          : `The strongest attached source is authority tier ${strongestAuthorityTier}; qualification uses only attached source-derived facts.`,
    evidenceSourceIds: sourceIds,
  } as Screen02CandidateQualification["sourceQuality"];
}

function populationConflict(proposal: Screen02FindProposal, population: string) {
  const required = normalize(population);
  const evidence = normalize(
    [...proposal.event.populations, proposal.affectedPopulation].join(" "),
  );
  if (!evidence || /\b(?:unknown|unverified|not established)\b/.test(evidence)) {
    return false;
  }
  if (/\bpublic\b/.test(required) && /\bprivate\b/.test(evidence) && !/\bpublic\b/.test(evidence)) {
    return true;
  }
  const organizational = /\b(?:firm|company|business|issuer|organization|enterprise)\b/.test(required);
  const peopleOnly = /\b(?:user|consumer|employee|individual|household|patient|student)s?\b/.test(evidence) &&
    !/\b(?:firm|company|business|issuer|organization|enterprise|provider|publisher)s?\b/.test(evidence);
  return organizational && peopleOnly;
}

export type Screen02IndustryBridgeEvidence = {
  profileVersion: string;
  profileStatus: "ready" | "needs-clarification";
  scopeMode: "target-industry" | "cross-industry";
  matchedPrimaryTerms: string[];
  matchedPopulationTerms: string[];
  matchedAdjacentTerms: string[];
  matchedBridgeTerms: string[];
  matchedFalseFriends: string[];
  matchedCrossIndustryReachTerms: string[];
  hasOrganizationalPopulation: boolean;
  evidenceSourceIds: string[];
};

/**
 * Discloses the source-backed fields used to establish an industry bridge.
 * Generic organization words are reported separately and never count as a
 * target-industry term.
 */
export function screen02IndustryBridgeEvidence(
  proposal: Screen02FindProposal,
  industry: string,
  studyProfile?: Screen02StudyRelevanceProfile,
): Screen02IndustryBridgeEvidence {
  const profile = screen02StudyProfileIndustryTerms(industry, studyProfile);
  // Identity-bearing titles are removed before industry matching. A title can
  // establish which event a source describes, but it cannot by itself prove a
  // substantive industry relationship.
  const primary = sourceBackedDirectEvidenceText(proposal);
  const population = sourceBackedPopulationText(proposal);
  const canonicalSources = traceableQualificationSources(proposal);
  const relationshipSources = traceableIndustryRelationshipSources(proposal);
  const adjacentSources = [...canonicalSources, ...relationshipSources].filter(
    (source, index, sources) =>
      sources.findIndex((candidate) => candidate.id === source.id) === index,
  );
  const sourceFacts = `${primary} ${population}`;
  const adjacentSourceFacts = sourceBackedAdjacentEvidenceText(proposal);
  const controlledAdjacentTerms = new Set(
    screen02StudyProfileIndustryTerms(industry).adjacentTerms.map(normalize),
  );
  // A project-authored controlled surface may be recovered from the bounded
  // source coordinate even when a connector summary omits it. Host- or
  // researcher-added relationships retain the existing stricter rule: they
  // must occur in an exact source-backed proposal field or pass the separate
  // reviewed-bridge contract below.
  const coordinateAdjacentTerms = profile.adjacentTerms.filter((term) =>
    controlledAdjacentTerms.has(normalize(term))
  );
  const sourceFieldAdjacentTerms = matchedTerms(
    sourceBackedDescriptionText(proposal),
    profile.adjacentTerms,
  );
  const relationshipAdjacentTerms = relationshipSources.length > 0
    ? matchedTerms(
        relationshipSources.map((source) => source.evidenceText ?? "").join(" "),
        profile.adjacentTerms,
      )
    : [];
  const usableDirect = canonicalSources.length > 0 &&
    Boolean(normalize(sourceFacts));
  const usableAdjacent = canonicalSources.length > 0 &&
    Boolean(normalize(adjacentSourceFacts));
  const matchedPrimaryTerms = usableDirect
    ? matchedTerms(primary, profile.directTerms)
    : [];
  const matchedPopulationTerms = usableDirect
    ? matchedTerms(population, profile.directTerms)
    : [];
  const matchedAdjacentTerms = unique([
    ...sourceFieldAdjacentTerms,
    ...(usableAdjacent
      ? matchedTerms(adjacentSourceFacts, coordinateAdjacentTerms)
      : []),
    ...relationshipAdjacentTerms,
  ]);
  const matchedBridgeTerms: string[] = [];
  const matchedFalseFriends = matchedTerms(
    `${sourceFacts} ${adjacentSourceFacts}`,
    profile.falseFriends,
  );
  const matchedCrossIndustryReachTerms = usableDirect
    ? matchedTerms(
        sourceFacts,
        CROSS_INDUSTRY_REACH_TERMS,
      )
    : [];
  const anyEvidence =
    matchedPrimaryTerms.length > 0 ||
    matchedPopulationTerms.length > 0 ||
    matchedAdjacentTerms.length > 0 ||
    matchedBridgeTerms.length > 0 ||
    matchedFalseFriends.length > 0 ||
    matchedCrossIndustryReachTerms.length > 0;
  const componentTerms = unique([
    ...matchedPrimaryTerms,
    ...matchedPopulationTerms,
    ...matchedAdjacentTerms,
    ...matchedBridgeTerms,
    ...matchedFalseFriends,
    ...matchedCrossIndustryReachTerms,
  ]);
  return {
    profileVersion: profile.version,
    profileStatus: profile.status,
    scopeMode: profile.scopeMode,
    matchedPrimaryTerms,
    matchedPopulationTerms,
    matchedAdjacentTerms,
    matchedBridgeTerms,
    matchedFalseFriends,
    matchedCrossIndustryReachTerms,
    hasOrganizationalPopulation:
      matchedTerms(sourceFacts, GENERAL_ORGANIZATION_TERMS).length > 0,
    evidenceSourceIds: unique(
      anyEvidence
        ? adjacentSources.flatMap((source) => {
            const relationshipOnly = relationshipSources.some(
              (candidate) => candidate.id === source.id,
            );
            const groundedText = relationshipOnly
              ? source.evidenceText?.trim() ?? ""
              : groundScreen02ProposalSource(proposal, source).evidenceText;
            const adjacentEvidence = relationshipOnly
              ? groundedText
              : sourceEvidenceWithoutIdentitySequences(proposal, source);
            const hasAdjacentEvidence = matchedAdjacentTerms.some((term) =>
              hasTerm(adjacentEvidence, term)
            );
            const hasOtherEvidence = !relationshipOnly && componentTerms
              .filter((term) => !matchedAdjacentTerms.includes(term))
              .some((term) => hasTerm(groundedText, term));
            return hasAdjacentEvidence || hasOtherEvidence
              ? [source.id]
              : [];
          })
        : [],
    ),
  };
}

function classifyIndustry(
  proposal: Screen02FindProposal,
  context: Screen01StudyContext,
  scopeCompatibleForDiscovery: boolean,
  studyProfile?: Screen02StudyRelevanceProfile,
) {
  const industry = context.scopeContract.industry;
  const bridge = screen02IndustryBridgeEvidence(
    proposal,
    industry,
    studyProfile,
  );
  const matchedDirectTerms = unique([
    ...bridge.matchedPrimaryTerms,
    ...bridge.matchedPopulationTerms,
  ]);
  const conflict = populationConflict(
    proposal,
    context.scopeContract.population,
  );
  const hasPositiveEvidence =
    matchedDirectTerms.length > 0 ||
    bridge.matchedAdjacentTerms.length > 0 ||
    bridge.matchedBridgeTerms.length > 0;
  const hasFalseFriend = bridge.matchedFalseFriends.length > 0;
  const adjacentBridgeTerms = bridge.matchedAdjacentTerms;
  const sourceFacts = sourceEvidenceText(proposal);
  const populationFacts = sourceBackedPopulationText(proposal);
  const adjacentSourceFacts = sourceBackedAdjacentEvidenceText(proposal);
  const concreteChange =
    matchedTerms(`${sourceFacts} ${adjacentSourceFacts}`, CHANGE_TERMS).length >
      0;
  const concretePopulation = populationFacts
    .split(/\s*;\s*/u)
    .some((population) =>
      Boolean(normalize(population)) &&
      normalize(population).split(" ").some(
      (token) => !GENERIC_POPULATION_WORDS.has(token),
    )
  );
  const concreteExposure = /\b(?:facility|location|platform|provider|operator|manufacturer|workforce|supply chain|customer|user)\b/iu.test(
    `${sourceFacts} ${populationFacts} ${adjacentSourceFacts}`,
  );
  const groundedEvidence = sourceEvidenceText(proposal);
  const locationLinkedCrossIndustryExposure =
    bridge.scopeMode === "cross-industry" &&
    proposal.event.geographies.some((geography) =>
      geography.trim().length > 0 &&
      sourceSupportsText(groundedEvidence, geography)
    ) &&
    sourceGroundedRequiredVariables(proposal).some((variable) =>
      /\b(?:coordinates?|facility|geograph(?:y|ic)|location|site|footprint)\b/iu.test(variable)
    ) &&
    traceableQualificationSources(proposal).length > 0;
  let classification: Screen02IndustryFitClass;
  if (
    !scopeCompatibleForDiscovery ||
    conflict ||
    bridge.profileStatus !== "ready"
  ) {
    classification = "mismatch";
  } else if (
    bridge.scopeMode === "cross-industry" &&
    (bridge.matchedCrossIndustryReachTerms.length > 0 ||
      locationLinkedCrossIndustryExposure)
  ) {
    // Official location-bound events need not echo the researcher's phrase
    // "all industries." A bounded organization-to-location exposure design
    // is enough for broad (never direct) consideration. Independent source,
    // substantive-information, and exposure gates remain controlling.
    classification = "broad";
  } else if (matchedDirectTerms.length > 0 && !hasFalseFriend) {
    classification = "direct";
  } else if (
    (concreteChange || concretePopulation || concreteExposure) &&
    adjacentBridgeTerms.length > 0
  ) {
    classification = "adjacent";
  } else if (
    bridge.hasOrganizationalPopulation &&
    bridge.matchedCrossIndustryReachTerms.length > 0
  ) {
    classification = "broad";
  } else {
    classification = "mismatch";
  }
  const explanation =
    classification === "direct"
      ? `Attached source-derived facts directly name ${industry} through: ${matchedDirectTerms.join(
          ", ",
        )}.`
      : classification === "adjacent"
        ? `The source describes a concrete change and the profile documents an adjacent or ambiguity-qualified ${industry} relationship through ${adjacentBridgeTerms.join(
            ", ",
          )}; that activity makes the relationship plausible, while candidate-specific coverage remains unverified.`
        : classification === "broad"
          ? bridge.scopeMode === "cross-industry"
            ? bridge.matchedCrossIndustryReachTerms.length > 0
              ? `The confirmed scope intentionally spans industries, and source-derived facts also state cross-industry reach (${bridge.matchedCrossIndustryReachTerms.join(
                  ", ",
                )}).`
              : `The candidate-bound source passage establishes a location-bound event. Candidate metadata provisionally identifies a bounded organization-to-location exposure variable for the confirmed cross-industry study; this broad classification does not claim that the source established actual organization- or industry-level coverage. The separate substantive-information, source-quality, and exposure gates remain controlling.`
            : `Source-derived facts establish organization-level reach across industries (${bridge.matchedCrossIndustryReachTerms.join(
                ", ",
              )}) but do not establish a specific ${industry} bridge.`
          : conflict
            ? `The source-described affected population conflicts with the confirmed ${context.scopeContract.population} boundary.`
            : hasFalseFriend && !hasPositiveEvidence
              ? `The record matches only an ambiguous or false-friend use (${bridge.matchedFalseFriends.join(
                  ", ",
                )}) and contains no source-backed ${industry} evidence.`
              : bridge.profileStatus !== "ready"
                ? `The industry label ${industry} is ambiguous or lacks a distinctive activity; clarify it before qualification.`
                : `The attached source text does not establish a direct, adjacent, or source-backed broad relationship to ${industry}; generic organization words are insufficient.`;
  return {
    classification,
    matchedDirectTerms,
    matchedAdjacentTerms: adjacentBridgeTerms,
    matchedContrastTerms: bridge.matchedFalseFriends,
    explanation,
    evidenceSourceIds:
      bridge.evidenceSourceIds.length > 0
        ? bridge.evidenceSourceIds
        : locationLinkedCrossIndustryExposure
          ? sourceIdsSupportingValues(proposal, proposal.event.geographies)
          : [],
  };
}

function exposureFeasibility(proposal: Screen02FindProposal) {
  const candidateCoverage = unique([
    ...proposal.event.populations,
    proposal.affectedPopulation,
  ]).filter(
    (population) =>
      population !== SCREEN_02_SOURCE_POPULATION_COVERAGE_UNKNOWN &&
      !/\b(?:unknown|unverified|not established)\b/i.test(population),
  );
  const establishedCoverage = candidateCoverage.filter((population) =>
    sourceSupportsText(sourceEvidenceText(proposal), population)
  );
  const groundedRequiredVariables = sourceGroundedRequiredVariables(proposal);
  const populationSourceIds = sourceIdsSupportingValues(
    proposal,
    establishedCoverage,
  );
  const variableSourceIds = unique(groundedRequiredVariables.flatMap(
    (variable) =>
      sourceIdsSupportingGroundedRequiredVariable(proposal, variable),
  ));
  const status =
    proposal.likelyServiceLevel === "stop"
      ? "infeasible"
      : establishedCoverage.length > 0 && groundedRequiredVariables.length > 0
        ? "documented"
        : groundedRequiredVariables.length > 0
          ? "plausible"
          : "unclear";
  return {
    status,
    explanation:
      status === "documented"
        ? "Candidate-bound source passages document an affected group and an exposure variable. Screen 3 must still verify the construction."
        : status === "plausible"
          ? "A candidate-bound source passage supports an exposure variable, but does not yet establish organization-level coverage."
          : status === "infeasible"
            ? "Candidate metadata provisionally flags the exposure construction as infeasible; this conservative stop does not represent a source-established fact."
            : "The returned record does not yet identify a bounded way to reconstruct organization-level exposure.",
    evidenceSourceIds: status === "documented"
      ? unique([...populationSourceIds, ...variableSourceIds])
      : status === "plausible"
        ? variableSourceIds
        : [],
  } as Screen02CandidateQualification["exposureFeasibility"];
}

function exposureFeasibilityHasSourceGroundedRankSupport(
  proposal: Screen02FindProposal,
) {
  return sourceGroundedRequiredVariables(proposal).length > 0;
}

function outcomeFit(
  proposal: Screen02FindProposal,
  context: Screen01StudyContext,
  prerequisitesPassed: boolean,
) {
  if (!prerequisitesPassed) {
    return {
      status: "not-evaluated",
      explanation:
        "Outcome relevance was not evaluated because hard scope, non-mismatch relevance, source quality, and substantive source information must all pass first; outcome wording cannot rescue a failed gate.",
      evidenceSourceIds: [],
    } as Screen02CandidateQualification["outcomeFit"];
  }
  const outcome = normalize(context.scopeContract.outcomeFamily);
  const terms = OUTCOME_TERMS[outcome] ?? [outcome];
  const matches = matchedTerms(sourceEvidenceText(proposal), terms);
  if (matches.length > 0) {
    return {
      status: "source-signal",
      explanation: `Attached source text contains a preliminary ${context.scopeContract.outcomeFamily} signal (${matches.join(
        ", ",
      )}); this is not an observed outcome effect.`,
      evidenceSourceIds: sourceIdsSupportingValues(proposal, matches),
    } as Screen02CandidateQualification["outcomeFit"];
  }
  const mechanisms = matchedTerms(sourceEvidenceText(proposal), [
    "compliance",
    "investment",
    "product",
    "technology",
    "disclosure",
    "data",
    "cost",
  ]);
  return {
    status: mechanisms.length > 0 ? "plausible" : "unclear",
    explanation:
      mechanisms.length > 0
        ? `The source describes a possible mechanism (${mechanisms.join(
            ", ",
          )}) to examine for ${context.scopeContract.outcomeFamily}; no outcome value was inspected.`
        : `The source record does not yet support a candidate-specific pathway to ${context.scopeContract.outcomeFamily}; no outcome value was inspected.`,
    evidenceSourceIds: mechanisms.length > 0
      ? sourceIdsSupportingValues(proposal, mechanisms)
      : [],
  } as Screen02CandidateQualification["outcomeFit"];
}

function round(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function baseScore(input: {
  classification: Screen02IndustryFitClass;
  sourceQualityScore: number;
  overviewPassed: boolean;
  exposureStatus: Screen02CandidateQualification["exposureFeasibility"]["status"];
  exposureRankSupported: boolean;
  outcomeStatus: Screen02CandidateQualification["outcomeFit"]["status"];
}) {
  const scope = {
    direct: 55,
    adjacent: 45,
    broad: 25,
    mismatch: 0,
  }[input.classification];
  const source = input.sourceQualityScore * 0.15;
  const overview = input.overviewPassed ? 10 : 0;
  const exposure = input.exposureRankSupported
    ? {
        documented: 10,
        plausible: 6,
        unclear: 2,
        infeasible: 0,
      }[input.exposureStatus]
    : input.exposureStatus === "infeasible"
      ? 0
      : 2;
  // Outcome is explanatory only at Screen 2. It cannot retrieve, rescue, or
  // rank a candidate before the research design is selected.
  void input.outcomeStatus;
  return round(Math.min(100, scope + source + overview + exposure));
}

function blockingCodes(input: {
  hardScopeDisposition: Screen02HardScopeDisposition;
  classification: Screen02IndustryFitClass;
  overviewPassed: boolean;
  sourceStatus: Screen02CandidateQualification["sourceQuality"]["status"];
  exposureStatus: Screen02CandidateQualification["exposureFeasibility"]["status"];
}) {
  const codes: Screen02QualificationExclusionCode[] = [];
  if (
    input.hardScopeDisposition === "demonstrated-mismatch" ||
    input.hardScopeDisposition === "mixed"
  ) {
    codes.push("hard-scope-mismatch");
  }
  // Missing hard-scope facts are surfaced as Screen 3 verification needs.
  // Only a demonstrated conflict excludes a documentary discovery candidate.
  if (input.classification === "mismatch") codes.push("industry-mismatch");
  if (!input.overviewPassed) {
    codes.push("excluded-insufficient-substantive-information");
  }
  if (input.sourceStatus === "insufficient") {
    codes.push("insufficient-source-quality");
  }
  if (input.exposureStatus === "infeasible") codes.push("exposure-infeasible");
  return unique(codes) as Screen02QualificationExclusionCode[];
}

function buildCandidateAdmission(input: {
  proposal: Screen02FindProposal;
  context: Screen01StudyContext;
  overview: Screen02SubstantiveOverviewGate;
  industry: {
    classification: Screen02IndustryFitClass;
    explanation: string;
    evidenceSourceIds: string[];
  };
  sourceQuality: Screen02CandidateQualification["sourceQuality"];
  exposureStatus: Screen02CandidateQualification["exposureFeasibility"]["status"];
  hardScopeDisposition: Screen02HardScopeDisposition;
  insufficientEvidenceKeys: Screen02HardFilterKey[];
}): Screen02CandidateAdmission {
  const trustworthySourceIds = unique(input.sourceQuality.evidenceSourceIds);
  const displayEvidence = {
    stableIdentity: input.overview.identity,
    substantiveChange: input.overview.change,
    relevantDate: input.overview.materialDate,
    trustworthySourceIds,
  };
  const displaySupported = displayEvidence.stableIdentity &&
    displayEvidence.substantiveChange && displayEvidence.relevantDate &&
    trustworthySourceIds.length > 0;
  const noDemonstratedScopeConflict = ![
    "demonstrated-mismatch",
    "mixed",
  ].includes(input.hardScopeDisposition);
  const relevanceRecommended = noDemonstratedScopeConflict &&
    input.industry.classification !== "mismatch";
  const firstLimitation = input.proposal.limitations.at(0)?.trim();
  const verificationNeeds = unique([
    firstLimitation ?? "",
    input.insufficientEvidenceKeys.length > 0
      ? `Verify unresolved Screen 1 scope fields: ${input.insufficientEvidenceKeys.join(
          ", ",
        )}.`
      : "",
    !input.overview.affectedPopulation
      ? "Verify the affected organizational population and the focal firms' coverage."
      : "",
    input.exposureStatus !== "documented"
      ? "Verify the organization-level exposure rule and the variables needed to calculate it."
      : "",
    "Choose and verify the operative treatment clock; each displayed date retains only its documented role.",
  ].filter(Boolean));
  return {
    policyVersion: SCREEN02_CANDIDATE_ADMISSION_POLICY_VERSION,
    displayEvidence: {
      ...displayEvidence,
      supported: displaySupported,
      explanation: displaySupported
        ? `At least one retained trustworthy source jointly supports the stable identity, substantive event action, and a documented date for ${input.proposal.title}.`
        : "The retained documents do not yet jointly support a stable identity, substantive event action, and documented date.",
    },
    relevance: {
      recommended: relevanceRecommended,
      classification: input.industry.classification,
      explanation: relevanceRecommended
        ? `${input.industry.explanation} This is specific enough to investigate for ${input.context.scopeContract.population}; candidate-specific coverage remains provisional.`
        : noDemonstratedScopeConflict
          ? input.industry.explanation
          : "Retained source-derived facts demonstrate a conflict with at least one required Screen 1 scope boundary.",
      evidenceSourceIds: unique(input.industry.evidenceSourceIds),
    },
    screen3VerificationNeeds: verificationNeeds,
  };
}

function sourceNegatesProfileTerm(sourceText: string, profileTerm: string) {
  const text = normalize(sourceText);
  const term = normalize(profileTerm);
  if (!text || !term) return false;
  return [
    `does not apply to ${term}`,
    `do not apply to ${term}`,
    `did not apply to ${term}`,
    `does not cover ${term}`,
    `do not cover ${term}`,
    `excludes ${term}`,
    `excluding ${term}`,
    `${term} is excluded`,
    `${term} are excluded`,
    `${term} is not covered`,
    `${term} are not covered`,
    `${term} outside scope`,
  ].some((phrase) => text.includes(phrase));
}

function candidateReviewInfluenceEffect(input: {
  proposal: Screen02FindProposal;
  context: Screen01StudyContext;
  studyProfile?: Screen02StudyRelevanceProfile;
  review: Screen02CandidateReviewInfluence;
  fixedClassification: Screen02IndustryFitClass;
  hardScopePassed: boolean;
  overviewPassed: boolean;
  sourceQualityStatus: Screen02CandidateQualification["sourceQuality"]["status"];
  exposureStatus: Screen02CandidateQualification["exposureFeasibility"]["status"];
  fixedEligibility: boolean;
}) {
  const reasons: Screen02CandidateReviewInfluenceReason[] = [];
  const sourceById = new Map(
    input.proposal.sources.map((source) => [source.id, source]),
  );
  const groundedCoordinatesBySourceId = new Map(
    input.proposal.sources.map((source) => [
      source.id,
      groundScreen02ProposalSource(input.proposal, source).coordinates,
    ]),
  );
  const sourceIdsUsed = new Set(input.review.sourceIdsUsed);
  const profile = input.studyProfile
    ? screen02StudyProfileIndustryTerms(
        input.context.scopeContract.industry,
        input.studyProfile,
      )
    : null;
  if (!profile) reasons.push("missing-study-profile");
  const validProfileTerms = new Set(
    profile?.broadBridgeTerms.map(normalize) ?? [],
  );
  const validAdjacentTerms = new Set(
    profile?.adjacentTerms.map(normalize) ?? [],
  );
  if (input.review.profileTermsUsed.some((term) =>
    !validProfileTerms.has(normalize(term))
  )) {
    reasons.push("unknown-profile-term");
  }
  const referencedSourceIds = new Set([
    ...input.review.sourceIdsUsed,
    ...input.review.sourceSpansUsed.map((span) => span.sourceId),
  ]);
  if ([...referencedSourceIds].some((sourceId) => !sourceById.has(sourceId))) {
    reasons.push("unknown-source");
  }
  if (input.review.sourceSpansUsed.some((span) =>
    sourceById.has(span.sourceId) && !sourceIdsUsed.has(span.sourceId)
  )) {
    reasons.push("source-span-not-active");
  }
  if (input.review.sourceSpansUsed.some((span) => {
    if (!sourceById.has(span.sourceId) || !sourceIdsUsed.has(span.sourceId)) {
      return false;
    }
    const evidenceText = sourceById.get(span.sourceId)?.evidenceText;
    return typeof evidenceText !== "string" || !evidenceText.includes(span.text);
  })) {
    reasons.push("source-span-not-found");
  }
  if (input.review.sourceSpansUsed.some((span) => {
    const source = sourceById.get(span.sourceId);
    if (
      !source ||
      !sourceIdsUsed.has(span.sourceId) ||
      typeof source.evidenceText !== "string" ||
      !source.evidenceText.includes(span.text)
    ) return false;
    return !(groundedCoordinatesBySourceId.get(span.sourceId) ?? [])
      .some((coordinate) => coordinate.text.includes(span.text));
  })) {
    reasons.push("source-span-not-grounded");
  }

  const exactActiveSpans = input.review.sourceSpansUsed.filter((span) => {
    const source = sourceById.get(span.sourceId);
    return source !== undefined && sourceIdsUsed.has(span.sourceId) &&
      typeof source.evidenceText === "string" &&
      source.evidenceText.includes(span.text) &&
      (groundedCoordinatesBySourceId.get(span.sourceId) ?? [])
        .some((coordinate) => coordinate.text.includes(span.text));
  });

  const adjacentRequested = input.review.proposedClass === "adjacent";
  if (adjacentRequested) {
    if (
      input.review.profileTermsUsed.length === 0 ||
      !input.review.profileTermsUsed.some((term) =>
        validAdjacentTerms.has(normalize(term))
      )
    ) {
      reasons.push("missing-adjacent-profile-term");
    }
    if (input.review.sourceSpansUsed.length === 0) {
      reasons.push("missing-adjacent-source-span");
    }
    const everyProfileTermHasExactSpan =
      input.review.profileTermsUsed.length > 0 &&
      input.review.profileTermsUsed.every((term) =>
        exactActiveSpans.some((span) => hasTerm(span.text, term))
      );
    const everyProfileTermIsBound = everyProfileTermHasExactSpan &&
      input.review.profileTermsUsed.every((term) =>
        hasTerm(input.review.industryBridge, term)
      );
    if (!everyProfileTermIsBound) {
      reasons.push("bridge-missing-profile-term");
    }
    if (!input.hardScopePassed) reasons.push("hard-scope-failed");
    const everyProfileTermHasQualifiedSource =
      input.review.profileTermsUsed.length > 0 &&
      input.review.profileTermsUsed.every((term) =>
        exactActiveSpans.some((span) =>
          hasTerm(span.text, term) &&
          (sourceById.get(span.sourceId)?.authorityTier ?? 6) < 6
        )
      );
    if (
      input.sourceQualityStatus === "insufficient" ||
      (everyProfileTermHasExactSpan && !everyProfileTermHasQualifiedSource)
    ) {
      reasons.push("source-quality-failed");
    }
    if (!input.overviewPassed) {
      reasons.push("substantive-information-failed");
    }
    if (input.exposureStatus === "infeasible") {
      reasons.push("exposure-infeasible");
    }
    const activeEvidence = [
      input.proposal.description,
      ...input.proposal.event.populations,
      input.proposal.affectedPopulation,
      ...input.proposal.sources.map((source) => source.evidenceText ?? ""),
    ].filter(Boolean).join("\n");
    const falseFriendConflict = Boolean(profile?.falseFriends.some((term) =>
      hasTerm(activeEvidence, term)
    ));
    const explicitNegation = input.review.profileTermsUsed.some((term) =>
      sourceNegatesProfileTerm(activeEvidence, term)
    );
    if (
      populationConflict(input.proposal, input.context.scopeContract.population) ||
      falseFriendConflict || explicitNegation
    ) {
      reasons.push("active-contradiction");
    }
  }

  const fixedStrength: Record<Screen02IndustryFitClass, number> = {
    direct: 3,
    adjacent: 2,
    broad: 1,
    mismatch: 0,
  };
  const semanticReasons = unique(reasons) as Screen02CandidateReviewInfluenceReason[];
  const assertedUpgrade =
    fixedStrength[input.review.proposedClass] >
      fixedStrength[input.fixedClassification];
  const verifiedBroadToAdjacentBridge =
    adjacentRequested && input.fixedClassification === "broad" &&
    input.review.proposedClass === "adjacent" && input.fixedEligibility &&
    semanticReasons.length === 0;
  let resultingClassification = input.fixedClassification;
  let classEffect: Screen02CandidateReviewClassEffect;
  if (semanticReasons.length > 0) {
    classEffect = "blocked-invalid-influence";
  } else if (verifiedBroadToAdjacentBridge) {
    resultingClassification = "adjacent";
    classEffect = "applied-source-verified-adjacent-bridge";
  } else if (assertedUpgrade) {
    classEffect = "blocked-class-upgrade";
    semanticReasons.push("class-upgrade-blocked");
  } else if (input.review.proposedClass === input.fixedClassification) {
    classEffect = "recorded-no-class-change";
  } else {
    resultingClassification = input.review.proposedClass;
    classEffect = adjacentRequested
      ? "applied-source-verified-adjacent-downgrade"
      : "applied-downgrade";
  }
  const bridgeVerification = !adjacentRequested
    ? "not-requested" as const
    : semanticReasons.some((reason) => reason !== "class-upgrade-blocked")
      ? "rejected" as const
      : "verified" as const;
  const verifiedBridge: Screen02CandidateReviewVerifiedBridge | null =
    bridgeVerification === "verified"
      ? {
          profileTerms: unique(input.review.profileTermsUsed),
          sourceIds: unique(exactActiveSpans
            .filter((span) =>
              input.review.profileTermsUsed.some((term) =>
                hasTerm(span.text, term)
              ) && (sourceById.get(span.sourceId)?.authorityTier ?? 6) < 6
            )
            .map((span) => span.sourceId)),
          sourceSpans: exactActiveSpans
            .filter((span) =>
              input.review.profileTermsUsed.some((term) =>
                hasTerm(span.text, term)
              ) && (sourceById.get(span.sourceId)?.authorityTier ?? 6) < 6
            )
            .map((span) => ({ ...span })),
        }
      : null;
  return {
    resultingClassification,
    classEffect,
    bridgeVerification,
    verifiedBridge,
    reasons: semanticReasons,
    industryExplanationSuffix:
      classEffect === "applied-source-verified-adjacent-downgrade"
        ? " A validated host review conservatively downgraded this class to adjacent. Its bridge is retained only as a noncanonical, candidate-grounded source explanation; it does not create a source fact or eligibility."
        : classEffect === "applied-source-verified-adjacent-bridge"
          ? " Fixed software verified the host-proposed adjacent relationship against an exact candidate-grounded source span and the current profile. The bridge remains a provisional, noncanonical explanation and did not create candidate eligibility."
        : classEffect === "applied-downgrade"
          ? ` A validated host review conservatively downgraded the fixed class to ${resultingClassification}; its narrative remains noncanonical audit material.`
          : "",
  };
}

export function qualifyScreen02FindProposal(
  proposal: Screen02FindProposal,
  context: Screen01StudyContext,
  input: {
    scopeFingerprint: string;
    lane?: Screen02QualificationLane;
    bm25Rank?: number;
    bm25Score?: number;
    studyProfile?: Screen02StudyRelevanceProfile;
    candidateReviewInfluenceById?: Screen02CandidateReviewInfluenceMap;
  },
): Screen02CandidateQualification {
  if (
    input.studyProfile &&
    (!isScreen02StudyRelevanceProfile(input.studyProfile) ||
      input.studyProfile.scopeFingerprint !== input.scopeFingerprint)
  ) {
    throw new Error(
      "Screen 2 qualification requires a valid profile for the current scope.",
    );
  }
  const candidateReviewInfluenceById = input.candidateReviewInfluenceById
    ? validateScreen02CandidateReviewInfluenceMap(
        input.candidateReviewInfluenceById,
        [proposal.id],
      )
    : new Map<string, Screen02CandidateReviewInfluence>();
  const candidateReview = candidateReviewInfluenceById.get(proposal.id);
  const checks = evaluateFindHardFilters(proposal, context);
  const mismatchKeys = checks
    .filter((check) => check.status === "fail")
    .map((check) => check.key);
  const insufficientEvidenceKeys = checks
    .filter(
      (check) =>
        check.status === "review" &&
        !sourceResolvesFindHardFilterReview(proposal, context, check.key),
    )
    .map((check) => check.key);
  const blockingKeys = unique([
    ...mismatchKeys,
    ...insufficientEvidenceKeys,
  ]) as Screen02HardFilterKey[];
  const positivelyResolvedReviewKeys = checks
    .filter(
      (check) =>
        check.status === "review" &&
        sourceResolvesFindHardFilterReview(proposal, context, check.key),
    )
    .map((check) => check.key);
  const hardScopeDisposition: Screen02HardScopeDisposition =
    mismatchKeys.length > 0
      ? insufficientEvidenceKeys.length > 0
        ? "mixed"
        : "demonstrated-mismatch"
      : insufficientEvidenceKeys.length > 0
        ? "insufficient-evidence"
        : "supported";
  const hardScopeEvidenceState: Screen02HardScopeEvidenceState =
    insufficientEvidenceKeys.length > 0 ? "insufficient" : "supported";
  const hardScopeRelevanceState: Screen02HardScopeRelevanceState =
    mismatchKeys.length > 0
      ? "demonstrated-mismatch"
      : insufficientEvidenceKeys.length > 0
        ? "unresolved"
        : "within-scope";
  const hardScopePassed = hardScopeDisposition === "supported";
  const scopeCompatibleForDiscovery = mismatchKeys.length === 0;
  const fixedIndustry = classifyIndustry(
    proposal,
    context,
    scopeCompatibleForDiscovery,
    input.studyProfile,
  );
  const exposure = exposureFeasibility(proposal);
  const quality = sourceQuality(proposal);
  const fixedOverviewBeforeOutcome = substantiveOverview(
    proposal,
    context,
    fixedIndustry.explanation,
    "Outcome relevance has not yet been evaluated.",
    exposure.explanation,
  );
  const fixedOutcome = outcomeFit(
    proposal,
    context,
    scopeCompatibleForDiscovery &&
      fixedIndustry.classification !== "mismatch" &&
      quality.status !== "insufficient" &&
      fixedOverviewBeforeOutcome.passed,
  );
  const fixedOverview = {
    ...fixedOverviewBeforeOutcome,
    whyItMayMatterForStudy: screen02OverviewStudyRelevance(
      context,
      fixedIndustry.explanation,
      fixedOutcome.explanation,
    ),
  };
  const fixedExclusions = blockingCodes({
    hardScopeDisposition,
    classification: fixedIndustry.classification,
    overviewPassed: fixedOverview.passed,
    sourceStatus: quality.status,
    exposureStatus: exposure.status,
  });
  const fixedEligibility = fixedExclusions.length === 0;
  const influence = candidateReview
    ? candidateReviewInfluenceEffect({
        proposal,
        context,
        studyProfile: input.studyProfile,
        review: candidateReview,
        fixedClassification: fixedIndustry.classification,
        hardScopePassed: scopeCompatibleForDiscovery,
        overviewPassed: fixedOverview.passed,
        sourceQualityStatus: quality.status,
        exposureStatus: exposure.status,
        fixedEligibility,
      })
    : null;
  const industry = influence
    ? {
        ...fixedIndustry,
        classification: influence.resultingClassification,
        matchedAdjacentTerms:
          influence.bridgeVerification === "verified" &&
            influence.resultingClassification === "adjacent"
            ? unique([
                ...fixedIndustry.matchedAdjacentTerms,
                ...(influence.verifiedBridge?.profileTerms ?? []),
              ])
            : fixedIndustry.matchedAdjacentTerms,
        evidenceSourceIds:
          influence.bridgeVerification === "verified" &&
            influence.resultingClassification === "adjacent"
            ? unique([
                ...fixedIndustry.evidenceSourceIds,
                ...(influence.verifiedBridge?.sourceIds ?? []),
              ])
            : fixedIndustry.evidenceSourceIds,
        explanation:
          fixedIndustry.explanation + influence.industryExplanationSuffix,
      }
    : fixedIndustry;
  // Industry/outcome explanations do not alter the source-derived overview
  // facts. Reuse that immutable evidence trace, then replace only its
  // explanatory study-relevance sentence after any validated review.
  const overviewBeforeOutcome = fixedOverviewBeforeOutcome;
  const outcome = influence
    ? outcomeFit(
        proposal,
        context,
        scopeCompatibleForDiscovery &&
          industry.classification !== "mismatch" &&
          quality.status !== "insufficient" &&
          overviewBeforeOutcome.passed,
      )
    : fixedOutcome;
  const overview = influence
    ? {
        ...overviewBeforeOutcome,
        whyItMayMatterForStudy: screen02OverviewStudyRelevance(
          context,
          industry.explanation,
          outcome.explanation,
        ),
      }
    : fixedOverview;
  const candidateAdmission = buildCandidateAdmission({
    proposal,
    context,
    overview,
    industry,
    sourceQuality: quality,
    exposureStatus: exposure.status,
    hardScopeDisposition,
    insufficientEvidenceKeys,
  });
  const exclusions = blockingCodes({
    hardScopeDisposition,
    classification: industry.classification,
    overviewPassed: overview.passed,
    sourceStatus: quality.status,
    exposureStatus: exposure.status,
  });
  const eligible = exclusions.length === 0 &&
    candidateAdmission.displayEvidence.supported &&
    candidateAdmission.relevance.recommended;
  if (eligible && !fixedEligibility) {
    throw new Error(
      "A Screen 2 host review cannot create candidate eligibility.",
    );
  }
  const section = eligible
    ? industry.classification === "broad"
      ? "broader"
      : "best-match"
    : null;
  const score = baseScore({
    classification: industry.classification,
    sourceQualityScore: quality.score,
    overviewPassed: overview.passed,
    exposureStatus: exposure.status,
    exposureRankSupported:
      exposureFeasibilityHasSourceGroundedRankSupport(proposal),
    outcomeStatus: outcome.status,
  });
  const sourceIds = unique([
    ...industry.evidenceSourceIds,
    ...outcome.evidenceSourceIds,
    ...exposure.evidenceSourceIds,
    ...overview.evidenceSourceIds,
    ...quality.evidenceSourceIds,
  ]);
  const sourceFingerprint = fingerprintScreen02QualificationSources(proposal);
  const cacheKey = screen02QualificationCacheKey({
    scopeFingerprint: input.scopeFingerprint,
    proposal,
    sourceFingerprint,
    studyProfile: input.studyProfile,
  });
  const lane = input.lane ?? proposalLane(proposal);
  const hostReviewInfluence: Screen02CandidateReviewInfluenceTrace | undefined =
    candidateReview && influence
      ? {
          schemaVersion:
            SCREEN02_CANDIDATE_REVIEW_INFLUENCE_TRACE_VERSION,
          noncanonical: true,
          fixedClassification: fixedIndustry.classification,
          proposedClass: candidateReview.proposedClass,
          resultingClassification: industry.classification,
          fixedEligibility,
          resultingEligibility: eligible,
          classEffect: influence.classEffect,
          bridgeVerification: influence.bridgeVerification,
          reasons: [...influence.reasons],
          verifiedBridge: influence.verifiedBridge
            ? structuredClone(influence.verifiedBridge)
            : null,
          review: structuredClone(candidateReview),
          fieldDispositions: {
            proposedClass: influence.classEffect,
            industryBridge:
              influence.bridgeVerification === "verified" &&
                !["blocked-class-upgrade", "blocked-invalid-influence"]
                  .includes(influence.classEffect)
                ? "source-bound-noncanonical-explanation"
                : "audit-only-no-qualification-effect",
            profileTermsUsed: "fixed-evidence-binding-only",
            sourceIdsUsed: "fixed-evidence-binding-only",
            sourceSpansUsed: "fixed-evidence-binding-only",
            sampleConnection: "audit-only-no-qualification-effect",
            outcomePathway: "audit-only-no-qualification-effect",
            mainMismatchOrUncertainty:
              "audit-only-no-qualification-effect",
            needsFollowUpRetrieval: candidateReview.needsFollowUpRetrieval
              ? "follow-up-signal-only-no-retrieval"
              : "no-follow-up-requested",
          },
        }
      : undefined;
  return {
    version: SCREEN02_CANDIDATE_QUALIFICATION_VERSION,
    scopeFingerprint: input.scopeFingerprint,
    cacheKey,
    candidateId: proposal.id,
    sourceFingerprint,
    lane,
    classification: industry.classification,
    section,
    hardScope: {
      passed: hardScopePassed,
      disposition: hardScopeDisposition,
      evidenceState: hardScopeEvidenceState,
      relevanceState: hardScopeRelevanceState,
      mismatchKeys,
      insufficientEvidenceKeys,
      blockingKeys,
      checks,
      explanation: hardScopePassed
        ? positivelyResolvedReviewKeys.length > 0
          ? `The retained source-derived facts positively resolve the otherwise partial hard-scope check${positivelyResolvedReviewKeys.length === 1 ? "" : "s"} for: ${positivelyResolvedReviewKeys.join(
              ", ",
            )}. No unresolved hard-scope review remains.`
          : "The retained sources support the confirmed geography, study period, organizational population, and event family."
        : hardScopeDisposition === "demonstrated-mismatch"
          ? `Retained source-derived facts demonstrate that the candidate is outside the confirmed hard scope on: ${mismatchKeys.join(
              ", ",
            )}.`
          : hardScopeDisposition === "insufficient-evidence"
            ? `Retained sources do not yet establish the confirmed hard scope on: ${insufficientEvidenceKeys.join(
                ", ",
              )}. These unresolved facts remain explicit Screen 3 verification needs and do not alone exclude a source-backed discovery candidate.`
            : `Retained source-derived facts demonstrate a mismatch with the confirmed hard scope on: ${mismatchKeys.join(
                ", ",
              )}. More source evidence is also required to resolve: ${insufficientEvidenceKeys.join(
                ", ",
              )}.`,
    },
    industryFit: {
      matchedDirectTerms: industry.matchedDirectTerms,
      matchedAdjacentTerms: industry.matchedAdjacentTerms,
      matchedContrastTerms: industry.matchedContrastTerms,
      explanation: industry.explanation,
      evidenceSourceIds: industry.evidenceSourceIds,
    },
    outcomeFit: outcome,
    exposureFeasibility: exposure,
    substantiveOverview: overview,
    sourceQuality: quality,
    retrieval: {
      bm25Rank: input.bm25Rank ?? 1,
      bm25Score: round(input.bm25Score ?? 0),
    },
    ranking: {
      baseScore: score,
      diversityAdjustment: 0,
      totalScore: score,
      rank: null,
      explanation:
        "The deterministic base score combines scope class, source quality, substantive overview, and source-grounded exposure feasibility. Proposal-authored exposure variables and outcome wording are explanatory only until source-grounded and do not affect eligibility or rank.",
    },
    eligible,
    exclusionCodes: exclusions,
    explanation: eligible
      ? `${industry.explanation} ${overview.explanation}`
      : `${industry.explanation} ${overview.explanation} Exclusion codes: ${exclusions.join(
          ", ",
        )}.`,
    evidenceSourceIds: sourceIds,
    candidateAdmission,
    ...(hostReviewInfluence ? { hostReviewInfluence } : {}),
  };
}

export const screen02QualificationDiversityDimensions = [
  "issuing-authority",
  "jurisdiction",
  "source-lane",
  "event-subtype",
  "mechanism",
  "treatment-timing",
  "regulatory-surface",
  "event-family",
  "related-event-cluster",
] as const;
export type Screen02QualificationDiversityDimension =
  (typeof screen02QualificationDiversityDimensions)[number];

export const SCREEN02_RELATED_EVENT_CLUSTER_THRESHOLD = 0.65;
export const SCREEN02_DIVERSITY_MAX_ADJUSTMENT = 10;

type Screen02QualificationDiversityKeys = Record<
  Screen02QualificationDiversityDimension,
  string[]
>;

const SCREEN02_DIVERSITY_WEIGHTS: Readonly<
  Record<Screen02QualificationDiversityDimension, number>
> = {
  "issuing-authority": 3,
  jurisdiction: 2,
  "source-lane": 2,
  "event-subtype": 1,
  mechanism: 1,
  "treatment-timing": 1,
  "regulatory-surface": 1,
  "event-family": 1,
  "related-event-cluster": 3,
};

function normalizedDiversitySet(
  values: readonly (string | null | undefined)[],
) {
  return unique(
    values
      .map((value) => knownDiversityText(value))
      .filter((value): value is string => value !== null),
  );
}

function knownDiversityText(value: string | null | undefined) {
  const normalized = normalize(value ?? "");
  if (
    !normalized ||
    /^(?:n a|none|not available|not established|not specified|unknown|unspecified|unverified)(?:\b|$)/u
      .test(normalized)
  ) return null;
  return normalized;
}

function treatmentTimingKey(proposal: Screen02FindProposal) {
  return unique(screen02MaterialTimingFacts(proposal).map((fact) =>
    String(fact.year)
  ));
}

type Screen02DiversityTaxonomyEntry = {
  key: string;
  pattern: RegExp;
};

const EVENT_SUBTYPE_LIFECYCLE_TOKEN =
  /^(?:active|adopted|current|draft|effective|enacted|expired|final|inactive|interim|issued|pending|promulgated|proposed|repealed|superseded|withdrawn)$/u;

const EVENT_SUBTYPE_TAXONOMY: readonly Screen02DiversityTaxonomyEntry[] = [
  {
    key: "administrative-guidance",
    pattern: /\b(?:advisory|circular|directive|guidance|notice)\b/iu,
  },
  {
    key: "administrative-order",
    pattern: /\b(?:mandate|order|proclamation)\b/iu,
  },
  {
    key: "adjudicative-decision",
    pattern: /\b(?:decision|judgment|ruling)\b/iu,
  },
  { key: "declaration", pattern: /\bdeclarations?\b/iu },
  {
    key: "disaster-event",
    pattern:
      /\b(?:cyclone|disaster|drought|earthquake|eruption|flood\w*|hurricane|storm|tsunami|wildfire)\b/iu,
  },
  {
    key: "legislative-instrument",
    pattern: /\b(?:acts?|bills?|codes?|laws?|legislation|statutes?)\b/iu,
  },
  {
    key: "regulatory-instrument",
    pattern: /\b(?:reg|regulation\w*|rule(?:making)?s?)\b/iu,
  },
  { key: "standard", pattern: /\bstandards?\b/iu },
] as const;

function eventSubtypeKeys(value: string | null | undefined) {
  const known = knownDiversityText(value);
  if (!known) return [];
  const subtype = known
    .replace(/\b(?:entered into force|in force)\b/gu, " ")
    .split(" ")
    .filter((token) => !EVENT_SUBTYPE_LIFECYCLE_TOKEN.test(token))
    .join(" ");
  return subtype
    ? taxonomyKeys(subtype, EVENT_SUBTYPE_TAXONOMY)
    : [];
}

const MECHANISM_TAXONOMY: readonly Screen02DiversityTaxonomyEntry[] = [
  { key: "authorization-or-licensing", pattern: /\b(?:approval|authoriz\w*|licen[cs]\w*|permit\w*)\b/iu },
  { key: "declaration-or-emergency-action", pattern: /\b(?:declar\w*|emergency order|response activation|state of emergency)\b/iu },
  { key: "eligibility-or-threshold", pattern: /\b(?:coverage|eligib\w*|exempt\w*|threshold)\b/iu },
  { key: "enforcement-or-penalty", pattern: /\b(?:enforc\w*|fine\w*|inspection\w*|penalt\w*|sanction\w*)\b/iu },
  { key: "fiscal-incentive-or-charge", pattern: /\b(?:credit\w*|fee\w*|levy|subsid\w*|tariff\w*|tax\w*)\b/iu },
  { key: "obligation-or-disclosure", pattern: /\b(?:disclos\w*|duty|mandat\w*|obligation\w*|report\w*|requir\w*)\b/iu },
  { key: "operational-interruption", pattern: /\b(?:clos\w*|damage\w*|disrupt\w*|evacuat\w*|outage\w*|shutdown\w*)\b/iu },
  { key: "restriction-or-prohibition", pattern: /\b(?:ban\w*|cap\w*|limit\w*|prohibit\w*|restrict\w*)\b/iu },
  { key: "supply-demand-or-price", pattern: /\b(?:demand|price\w*|shortage\w*|supply)\b/iu },
] as const;

const REGULATORY_SURFACE_TAXONOMY: readonly Screen02DiversityTaxonomyEntry[] = [
  { key: "competition-or-consumer", pattern: /\b(?:antitrust|competition|consumer|market conduct)\b/iu },
  { key: "disaster-or-emergency", pattern: /\b(?:cyclone|disaster|drought|earthquake|emergency|eruption|flood\w*|hurricane|outbreak|pandemic|storm|tsunami|wildfire)\b/iu },
  { key: "environment-or-climate", pattern: /\b(?:climate|conservation|emission\w*|environment\w*|pollution)\b/iu },
  { key: "fiscal-or-finance", pattern: /\b(?:bank\w*|capital|credit\w*|finance|fiscal|securit\w*|tax\w*)\b/iu },
  { key: "health-or-safety", pattern: /\b(?:health|medical|patient\w*|safety)\b/iu },
  { key: "infrastructure-or-energy", pattern: /\b(?:electric\w*|energy|grid|infrastructure|transport\w*|utility|utilities)\b/iu },
  { key: "labor-or-workforce", pattern: /\b(?:employee\w*|employment|labor|staff\w*|wage\w*|worker\w*)\b/iu },
  { key: "operations-or-supply", pattern: /\b(?:facility|logistics|operation\w*|production|supply)\b/iu },
  { key: "privacy-data-or-technology", pattern: /\b(?:cyber\w*|data|digital|platform\w*|privacy|software|technolog\w*)\b/iu },
  { key: "reporting-or-governance", pattern: /\b(?:account\w*|audit\w*|disclos\w*|governance|report\w*)\b/iu },
  { key: "trade-or-customs", pattern: /\b(?:customs|export\w*|import\w*|trade)\b/iu },
] as const;

function sourceFactDiversityText(proposal: Screen02FindProposal) {
  const authoritativeSources = qualificationEvidenceSources(proposal);
  const hasTraceableFacts = traceableQualificationSources(proposal).length > 0;
  return [
    proposal.event.eventFamily,
    hasTraceableFacts ? proposal.title : "",
    hasTraceableFacts ? proposal.event.displayName : "",
    sourceEvidenceText(proposal),
    ...authoritativeSources.flatMap((source) => [
      source.title,
    ]),
  ].join(" ");
}

function taxonomyKeys(
  text: string,
  taxonomy: readonly Screen02DiversityTaxonomyEntry[],
) {
  return unique(taxonomy
    .filter((entry) => entry.pattern.test(text))
    .map((entry) => entry.key));
}

/**
 * Fixed, outcome-blind diversity facets. Authority and issuing jurisdiction
 * use only their exact native identity fields; publisher and impact geography
 * are deliberately not substitutes. Event subtype combines a non-lifecycle
 * native status with generic source facts and the canonical event family, so
 * an unknown status does not erase a source-backed rule, law, or disaster.
 * Mechanism and regulatory surface use generic source facts, never outcome
 * prose, profile text, required variables, or population fields.
 * The related-event key is supplied by deterministic pool clustering rather
 * than a raw-title heuristic. No named event or industry receives a branch.
 */
export function screen02QualificationDiversityKeys(
  proposal: Screen02FindProposal,
  lane: Screen02QualificationLane,
  relatedEventCluster: string | null = null,
): Screen02QualificationDiversityKeys {
  const sourceFactText = sourceFactDiversityText(proposal);
  const nativeSubtypeKeys = eventSubtypeKeys(proposal.nativeIdentity?.status);
  return {
    "issuing-authority": normalizedDiversitySet([
      proposal.nativeIdentity?.issuer,
    ]),
    jurisdiction: normalizedDiversitySet([
      proposal.nativeIdentity?.issuingJurisdiction,
    ]),
    "source-lane": [
      lane === "cached-candidate" ? proposalLane(proposal) : lane,
    ],
    "event-subtype": nativeSubtypeKeys.length > 0
      ? nativeSubtypeKeys
      : eventSubtypeKeys(sourceFactText),
    mechanism: taxonomyKeys(sourceFactText, MECHANISM_TAXONOMY),
    "treatment-timing": treatmentTimingKey(proposal),
    "regulatory-surface": taxonomyKeys(
      sourceFactText,
      REGULATORY_SURFACE_TAXONOMY,
    ),
    "event-family": normalizedDiversitySet([proposal.event.eventFamily]),
    "related-event-cluster": normalizedDiversitySet([relatedEventCluster]),
  };
}

type Screen02QualificationDiversityCountInput = {
  priorLaneCount: number;
  priorIssuerCount: number;
  priorJurisdictionCount?: number;
  priorEventSubtypeCount?: number;
  priorMechanismCount?: number;
  priorTreatmentTimingCount?: number;
  priorRegulatorySurfaceCount?: number;
  priorEventFamilyCount?: number;
  priorRelatedEventClusterCount?: number;
};

function screen02QualificationDiversityMagnitude(
  input: Screen02QualificationDiversityCountInput,
) {
  const counts: Record<Screen02QualificationDiversityDimension, number> = {
    "issuing-authority": input.priorIssuerCount,
    jurisdiction: input.priorJurisdictionCount ?? 0,
    "source-lane": input.priorLaneCount,
    "event-subtype": input.priorEventSubtypeCount ?? 0,
    mechanism: input.priorMechanismCount ?? 0,
    "treatment-timing": input.priorTreatmentTimingCount ?? 0,
    "regulatory-surface": input.priorRegulatorySurfaceCount ?? 0,
    "event-family": input.priorEventFamilyCount ?? 0,
    "related-event-cluster": input.priorRelatedEventClusterCount ?? 0,
  };
  return screen02QualificationDiversityDimensions.reduce(
    (sum, dimension) => {
      const supplied = counts[dimension];
      const repeatCount = Number.isFinite(supplied)
        ? Math.min(2, Math.max(0, Math.floor(supplied)))
        : 0;
      return sum + repeatCount * SCREEN02_DIVERSITY_WEIGHTS[dimension];
    },
    0,
  );
}

export function screen02QualificationDiversityAdjustment(
  input: Screen02QualificationDiversityCountInput,
) {
  const magnitude = screen02QualificationDiversityMagnitude(input);
  const cappedMagnitude = Math.min(
    SCREEN02_DIVERSITY_MAX_ADJUSTMENT,
    magnitude,
  );
  return cappedMagnitude === 0 ? 0 : -cappedMagnitude;
}

function diversityCountInput(
  keys: Screen02QualificationDiversityKeys,
  counts: Readonly<
    Record<Screen02QualificationDiversityDimension, ReadonlyMap<string, number>>
  >,
) {
  const count = (dimension: Screen02QualificationDiversityDimension) =>
    keys[dimension].reduce(
      (maximum, key) => Math.max(maximum, counts[dimension].get(key) ?? 0),
      0,
    );
  return {
    priorLaneCount: count("source-lane"),
    priorIssuerCount: count("issuing-authority"),
    priorJurisdictionCount: count("jurisdiction"),
    priorEventSubtypeCount: count("event-subtype"),
    priorMechanismCount: count("mechanism"),
    priorTreatmentTimingCount: count("treatment-timing"),
    priorRegulatorySurfaceCount: count("regulatory-surface"),
    priorEventFamilyCount: count("event-family"),
    priorRelatedEventClusterCount: count("related-event-cluster"),
  };
}

type Screen02DiversityOrderingState = {
  dimensionCounts: Record<
    Screen02QualificationDiversityDimension,
    Map<string, number>
  >;
  relatedClusterByProposalId: Map<string, string>;
  sourceLaneByProposalId: ReadonlyMap<string, Screen02QualificationLane>;
  reusedProposalIds: ReadonlySet<string>;
};

function createDiversityOrderingState(
  entries: readonly Screen02QualifiedProposal[],
  sourceLaneByProposalId: ReadonlyMap<string, Screen02QualificationLane>,
  reusedProposalIds: ReadonlySet<string>,
): Screen02DiversityOrderingState {
  const dimensionCounts = Object.fromEntries(
    screen02QualificationDiversityDimensions.map((dimension) => [
      dimension,
      new Map<string, number>(),
    ]),
  ) as Screen02DiversityOrderingState["dimensionCounts"];
  const relatedClusterByProposalId = new Map<string, string>();
  if (entries.length > 1) {
    // Discovery deduplication correctly keeps distinct treatment versions and
    // formal documents separate. Related-event diversification asks whether
    // those retained versions belong to the same event family, so immutable
    // comparison clones neutralize document identity, treatment clocks, and
    // assigned populations. Naming, family, and geography still control the
    // existing generic 0.65 clustering formula.
    const related = clusterScreen02Proposals(
      entries.map((entry) => ({
        ...entry.proposal,
        affectedPopulation: "Related-event comparison population",
        provisionalDates: [],
        event: {
          ...entry.proposal.event,
          eventDate: "Related-event comparison date",
          populations: ["Related-event comparison population"],
        },
        ...(entry.proposal.nativeIdentity
          ? {
              nativeIdentity: {
                ...entry.proposal.nativeIdentity,
                formalIdentifier: null,
              },
            }
          : {}),
      })),
      SCREEN02_RELATED_EVENT_CLUSTER_THRESHOLD,
    );
    related.clusters.filter((cluster) => cluster.memberProposalIds.length > 1)
      .forEach((cluster) => cluster.memberProposalIds.forEach((proposalId) =>
        relatedClusterByProposalId.set(proposalId, cluster.clusterId)
      ));
  }
  return {
    dimensionCounts,
    relatedClusterByProposalId,
    sourceLaneByProposalId,
    reusedProposalIds,
  };
}

function diversityOrder(
  entries: readonly Screen02QualifiedProposal[],
  startRank: number,
  boundedOrderingAdjustments: ReadonlyMap<string, number>,
  state: Screen02DiversityOrderingState,
) {
  const remaining = [...entries];
  const selected: Screen02QualifiedProposal[] = [];
  while (remaining.length > 0) {
    const scored = remaining.map((entry) => {
      const keys = screen02QualificationDiversityKeys(
        entry.proposal,
        state.sourceLaneByProposalId.get(entry.proposal.id) ??
          entry.qualification.lane,
        state.relatedClusterByProposalId.get(entry.proposal.id) ?? null,
      );
      const priorCounts = diversityCountInput(keys, state.dimensionCounts);
      const diversityMagnitude = screen02QualificationDiversityMagnitude(
        priorCounts,
      );
      const adjustment = screen02QualificationDiversityAdjustment(priorCounts);
      const repeatedDimensions = screen02QualificationDiversityDimensions
        .filter((dimension) => keys[dimension].some((key) =>
          state.dimensionCounts[dimension].has(key)
        ));
      const hostAdjustment =
        boundedOrderingAdjustments.get(entry.proposal.id) ?? 0;
      const relevanceScore = Math.max(0, Math.min(100, round(
        entry.qualification.ranking.baseScore + hostAdjustment,
      )));
      return {
        entry,
        keys,
        repeatedDimensions,
        diversityMagnitude,
        adjustment,
        hostAdjustment,
        relevanceScore,
      };
    });
    const bestRelevanceScore = Math.max(...scored.map((entry) =>
      entry.relevanceScore
    ));
    const equalRelevance = scored.filter((entry) =>
      entry.relevanceScore === bestRelevanceScore
    );
    equalRelevance.sort(
      (left, right) =>
        left.diversityMagnitude - right.diversityMagnitude ||
        right.entry.qualification.retrieval.bm25Score -
          left.entry.qualification.retrieval.bm25Score ||
        left.entry.proposal.id.localeCompare(right.entry.proposal.id),
    );
    const next = equalRelevance[0];
    const index = remaining.indexOf(next.entry);
    remaining.splice(index, 1);
    const rank = startRank + selected.length;
    const repeatedDimensionText = next.repeatedDimensions.join(", ");
    const relevanceGuard =
      " Fixed relevance (base score plus any validated host adjustment) was maximized before diversity. Diversity only breaks an exact fixed-relevance tie and is disclosed separately rather than subtracted from the total score.";
    const diversityExplanation = next.adjustment === 0
      ? ""
      : ` Recorded a capped ${Math.abs(next.adjustment)}-point diversity tie-break adjustment${next.diversityMagnitude > Math.abs(next.adjustment) ? ` from an uncapped repeat magnitude of ${next.diversityMagnitude} points` : ""} for repeated dimensions: ${repeatedDimensionText}.`;
    const hostExplanation = next.hostAdjustment === 0
      ? ""
      : ` A validated host pool review${next.adjustment === 0 ? "" : " also"} applied a bounded ${next.hostAdjustment > 0 ? "+" : ""}${next.hostAdjustment}-point ordering adjustment without changing fixed eligibility or section.`;
    next.entry.qualification.ranking = {
      ...next.entry.qualification.ranking,
      diversityAdjustment: next.adjustment,
      totalScore: next.relevanceScore,
      rank,
      explanation:
        state.reusedProposalIds.has(next.entry.proposal.id)
          ? `Reused the persisted deterministic qualification for the same candidate and confirmed scope; no provider or host follow-up was started for that qualification.${diversityExplanation}${hostExplanation}${relevanceGuard}`
          : `Ranked by deterministic qualification score with stable BM25 and candidate-ID tie-breakers.${diversityExplanation}${hostExplanation}${relevanceGuard}`,
    };
    selected.push(next.entry);
    screen02QualificationDiversityDimensions.forEach((dimension) => {
      next.keys[dimension].forEach((key) => state.dimensionCounts[dimension].set(
        key,
        (state.dimensionCounts[dimension].get(key) ?? 0) + 1,
      ));
    });
  }
  return selected;
}

function exclusionReason(
  qualification: Screen02CandidateQualification,
  code: Screen02QualificationExclusionCode,
) {
  if (
    code === "hard-scope-mismatch" ||
    code === "hard-scope-insufficient-evidence"
  ) {
    return qualification.hardScope.explanation;
  }
  if (code === "industry-mismatch") return qualification.industryFit.explanation;
  if (code === "excluded-insufficient-substantive-information") {
    return qualification.substantiveOverview.explanation;
  }
  if (code === "insufficient-source-quality") {
    return qualification.sourceQuality.explanation;
  }
  if (code === "exposure-infeasible") {
    return qualification.exposureFeasibility.explanation;
  }
  if (code === "broad-result-cap") {
    return `Excluded from the first ordinary result set because at least one direct or adjacent candidate is available and no more than ${SCREEN02_ORDINARY_BROAD_RESULT_CAP} broad candidates may be shown.`;
  }
  return "Retained outside this comparison after the disclosed qualified-candidate limit; the limit counts qualified candidates rather than returned titles.";
}

export function qualifyAndRankScreen02FindProposals(
  proposals: readonly Screen02FindProposal[],
  context: Screen01StudyContext,
  input: {
    scopeFingerprint: string;
    maximumCandidates: number;
    laneByProposalId?: ReadonlyMap<string, Screen02QualificationLane>;
    cachedByProposalId?: ReadonlyMap<string, Screen02CandidateQualification>;
    /** Exact qualifications produced earlier in this invocation only. */
    currentRunQualificationByProposalId?: ReadonlyMap<
      string,
      Screen02CandidateQualification
    >;
    studyProfile?: Screen02StudyRelevanceProfile;
    /** Validated, outcome-blind ordering-only adjustments, bounded to +/-3. */
    boundedOrderingAdjustments?: ReadonlyMap<string, number>;
    /**
     * Task-validated review fields keyed only by canonical proposal id. Fixed
     * qualification revalidates every bound and source/profile relationship.
     */
    candidateReviewInfluenceById?: Screen02CandidateReviewInfluenceMap;
  },
): Screen02QualificationResult {
  if (
    !Number.isSafeInteger(input.maximumCandidates) ||
    input.maximumCandidates < 1 ||
    input.maximumCandidates > 20
  ) {
    throw new Error("Screen 2 qualification requires a candidate limit from 1 through 20.");
  }
  const ids = proposals.map((proposal) => proposal.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Screen 2 qualification requires unique proposal IDs.");
  }
  const candidateReviewInfluenceById = input.candidateReviewInfluenceById
    ? validateScreen02CandidateReviewInfluenceMap(
        input.candidateReviewInfluenceById,
        ids,
      )
    : new Map<string, Screen02CandidateReviewInfluence>();
  const boundedOrderingAdjustments =
    input.boundedOrderingAdjustments ?? new Map<string, number>();
  if (
    [...boundedOrderingAdjustments].some(
      ([candidateId, adjustment]) =>
        !ids.includes(candidateId) || !Number.isInteger(adjustment) ||
        Math.abs(adjustment) > 3,
    )
  ) {
    throw new Error(
      "Screen 2 ordering adjustments must reference supplied candidates and remain within +/-3.",
    );
  }
  if (
    input.studyProfile &&
    (!isScreen02StudyRelevanceProfile(input.studyProfile) ||
      input.studyProfile.scopeFingerprint !== input.scopeFingerprint)
  ) {
    throw new Error(
      "Screen 2 qualification requires a valid profile for the current scope.",
    );
  }
  const { ranked } = executeScreen02RankingStrategy({
    strategy: SCREEN02_RANKING_STRATEGIES.deterministicProfile,
    candidates: proposals,
    candidateId: (proposal) => proposal.id,
    rank: (candidates) => rankScreen02ProposalsBm25(
      candidates,
      context,
      {},
      { studyProfile: input.studyProfile },
    ),
    rankedCandidateId: (entry) => entry.proposalId,
  });
  const retrievalById = new Map(
    ranked.map((entry) => [
      entry.proposalId,
      { rank: entry.rank, score: entry.rankScore },
    ]),
  );
  const sourceLaneByProposalId = new Map<
    string,
    Screen02QualificationLane
  >();
  const reusedProposalIds = new Set<string>();
  const evaluated = proposals.map((proposal) => {
    const cached = input.cachedByProposalId?.get(proposal.id);
    const currentRunQualification =
      input.currentRunQualificationByProposalId?.get(proposal.id);
    const candidateReview = candidateReviewInfluenceById.get(proposal.id);
    const retrieval = retrievalById.get(proposal.id);
    const sourceFingerprint = fingerprintScreen02QualificationSources(proposal);
    const expectedCacheKey = screen02QualificationCacheKey({
      scopeFingerprint: input.scopeFingerprint,
      proposal,
      sourceFingerprint,
      studyProfile: input.studyProfile,
    });
    const canonicalProfileCacheCompatible = input.studyProfile === undefined ||
      input.studyProfile.origin === "fixed-profile";
    const requestedSourceLane =
      input.laneByProposalId?.get(proposal.id) ?? proposalLane(proposal);
    const currentRunReusable = exactCurrentRunScreen02QualificationMatches(
      currentRunQualification,
      {
        candidateId: proposal.id,
        scopeFingerprint: input.scopeFingerprint,
        sourceFingerprint,
        cacheKey: expectedCacheKey,
        lane: requestedSourceLane,
        hasCandidateReviewInfluence: candidateReview !== undefined,
      },
    );
    const persistedReusable = canonicalProfileCacheCompatible &&
      candidateReview === undefined &&
      cached?.hostReviewInfluence === undefined &&
      cached?.migrationProvenance === undefined &&
      cached?.version === SCREEN02_CANDIDATE_QUALIFICATION_VERSION &&
      cached.scopeFingerprint === input.scopeFingerprint &&
      cached.candidateId === proposal.id &&
      cached.sourceFingerprint === sourceFingerprint &&
      cached.cacheKey === expectedCacheKey;
    let qualification: Screen02CandidateQualification;
    if (currentRunReusable && currentRunQualification) {
      qualification = structuredClone(currentRunQualification);
    } else if (persistedReusable && cached) {
      qualification = structuredClone(cached);
    } else {
      qualification = qualifyScreen02FindProposal(proposal, context, {
          scopeFingerprint: input.scopeFingerprint,
          lane: requestedSourceLane,
          bm25Rank: retrieval?.rank ?? 1,
          bm25Score: retrieval?.score ?? 0,
          studyProfile: input.studyProfile,
          candidateReviewInfluenceById: candidateReview
            ? new Map([[proposal.id, candidateReview]])
            : undefined,
        });
    }
    const cachedSourceLane = cached?.lane !== "cached-candidate"
      ? cached?.lane
      : undefined;
    const sourceLane = currentRunReusable
      ? requestedSourceLane
      : (persistedReusable ? cachedSourceLane : undefined) ??
        requestedSourceLane;
    sourceLaneByProposalId.set(
      proposal.id,
      sourceLane,
    );
    if (currentRunReusable || persistedReusable) {
      // Keep immutable source provenance across arbitrarily many cache
      // generations. A legacy cached-candidate marker falls back to the
      // proposal-derived lane, while a first-class stored source lane survives
      // subsequent reuse without requiring a schema change.
      qualification.lane = sourceLane;
      if (persistedReusable) reusedProposalIds.add(proposal.id);
      qualification.retrieval = {
        bm25Rank: retrieval?.rank ?? qualification.retrieval.bm25Rank,
        bm25Score: retrieval?.score ?? qualification.retrieval.bm25Score,
      };
      qualification.ranking = {
        ...qualification.ranking,
        diversityAdjustment: 0,
        totalScore: qualification.ranking.baseScore,
        rank: null,
        explanation: persistedReusable
          ? "Reused the persisted deterministic qualification for the same candidate and confirmed scope; no provider or host follow-up was started."
          : "Reused an exact deterministic qualification produced earlier in this run and refreshed its retrieval ranking.",
      };
    }
    return { proposal, qualification };
  });
  const excluded: Screen02QualificationExclusion[] = evaluated.flatMap((entry) =>
    entry.qualification.eligible
      ? []
      : entry.qualification.exclusionCodes.map((code) => ({
          ...entry,
          code,
          reason: exclusionReason(entry.qualification, code),
        })),
  );
  const eligible = evaluated.filter((entry) => entry.qualification.eligible);
  const diversityState = createDiversityOrderingState(
    eligible,
    sourceLaneByProposalId,
    reusedProposalIds,
  );
  const best = diversityOrder(
    eligible.filter(
      (entry) => entry.qualification.section === "best-match",
    ),
    1,
    boundedOrderingAdjustments,
    diversityState,
  );
  const broadRanked = diversityOrder(
    eligible.filter((entry) => entry.qualification.section === "broader"),
    best.length + 1,
    boundedOrderingAdjustments,
    diversityState,
  );
  const displayedStrongerAlternativeCount = Math.min(
    best.length,
    input.maximumCandidates,
  );
  const strongerAlternativeIsDisplayed =
    displayedStrongerAlternativeCount > 0;
  const unfilledDisplaySlots = Math.max(
    0,
    input.maximumCandidates - displayedStrongerAlternativeCount,
  );
  // The ordinary two-broad ceiling applies only after direct/adjacent results
  // have had the opportunity to fill the requested set. It must not create an
  // artificially short result set: broad candidates may fill every otherwise
  // empty display slot, and a broad-only pool is governed by candidate-limit.
  const broadLimit = strongerAlternativeIsDisplayed
    ? Math.max(SCREEN02_ORDINARY_BROAD_RESULT_CAP, unfilledDisplaySlots)
    : broadRanked.length;
  const broadWithinCap = broadRanked.slice(0, broadLimit);
  for (const entry of strongerAlternativeIsDisplayed
    ? broadRanked.slice(broadLimit)
    : []) {
    entry.qualification.eligible = false;
    entry.qualification.section = null;
    entry.qualification.exclusionCodes = [
      ...entry.qualification.exclusionCodes,
      "broad-result-cap",
    ];
    entry.qualification.ranking.rank = null;
    excluded.push({
      ...entry,
      code: "broad-result-cap",
      reason: exclusionReason(entry.qualification, "broad-result-cap"),
    });
  }
  const qualifiedOrdered = [...best, ...broadWithinCap];
  const selected = qualifiedOrdered.slice(0, input.maximumCandidates);
  for (const entry of qualifiedOrdered.slice(input.maximumCandidates)) {
    entry.qualification.eligible = false;
    entry.qualification.section = null;
    entry.qualification.exclusionCodes = [
      ...entry.qualification.exclusionCodes,
      "candidate-limit",
    ];
    entry.qualification.ranking.rank = null;
    excluded.push({
      ...entry,
      code: "candidate-limit",
      reason: exclusionReason(entry.qualification, "candidate-limit"),
    });
  }
  selected.forEach((entry, index) => {
    entry.qualification.ranking.rank = index + 1;
  });
  return {
    selected,
    excluded,
    evaluated,
    returnedTitleCount: proposals.length,
    qualifiedCandidateCount: eligible.length,
  };
}
