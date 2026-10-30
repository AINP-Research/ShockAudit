import {
  SCREEN02_POOL_HOST_REVIEW_CAPABILITY,
  SCREEN02_POOL_HOST_REVIEW_SCHEMA_VERSION,
  applyScreen02PoolHostReview,
  mergeScreen02StudyRelevanceProfileHostAdditions,
  validateScreen02PoolHostReviewSubmission,
  type Screen02PoolHostReviewContext,
  type Screen02PoolHostReviewSubmission,
  type Screen02StudyRelevanceProfile,
} from "../core/screen02-relevance-profile";
import {
  applyScreen03HostEvidenceMappings,
  buildScreen03SupportedFacts,
  fingerprintScreen03HostEvidenceMappings,
  fingerprintScreen03VerificationState,
  restoreScreen03HostEvidenceMappings,
  screen03FactualClaims,
  type Screen03HostEvidenceMapping,
  type Screen03ProposalGroups,
  type Screen03VerificationState,
} from "../core/screen03-workflow";
import {
  fingerprintHostReasoningValue,
  type HostReasoningTask,
} from "../core/host-reasoning-task";
import {
  HostReasoningRuntimeError,
  screen02SearchReviewProposalSchema,
  screen02SearchReviewTaskFactsSchema,
  screen03EvidenceMappingProposalSchema,
  screen03EvidenceMappingTaskFactsSchema,
  screen03OverviewProposalSchema,
  screen03OverviewTaskFactsSchema,
  type HostReasoningApplicationResult,
  type HostReasoningApplicationInput,
  type HostReasoningTaskPolicy,
  type HostReasoningValidationInput,
} from "./host-reasoning-task-runtime";

class HostReasoningPolicyBoundaryError extends HostReasoningRuntimeError {
  constructor(
    readonly failureCode: string,
    readonly failureExplanation: string,
  ) {
    super(failureCode, failureExplanation);
    this.name = "HostReasoningPolicyBoundaryError";
  }
}

function failPolicyBoundary(
  failureCode: string,
  failureExplanation: string,
): never {
  throw new HostReasoningPolicyBoundaryError(
    failureCode,
    failureExplanation,
  );
}

function boundedPolicyText(value: string, maximum: number) {
  const clean = value.replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/\s+/gu, " ").trim();
  return clean.length <= maximum
    ? clean
    : `${clean.slice(0, Math.max(0, maximum - 14)).trimEnd()} [truncated]`;
}

function policyRejection(
  error: unknown,
  fallbackCode: string,
  fallbackExplanation: string,
) {
  if (error instanceof HostReasoningPolicyBoundaryError) {
    return {
      outcome: "rejected" as const,
      failureCode: error.failureCode,
      failureExplanation: error.failureExplanation,
    };
  }
  if (error instanceof HostReasoningRuntimeError) {
    return {
      outcome: "rejected" as const,
      failureCode: error.code,
      failureExplanation: error.message,
    };
  }
  return {
    outcome: "rejected" as const,
    failureCode: fallbackCode,
    failureExplanation: fallbackExplanation,
  };
}

export type AuthoritativeScreen02HostReviewContext = {
  runId: string;
  candidatePoolId: string;
  candidatePoolFingerprint: string;
  scopeFingerprint: string;
  profile: Screen02StudyRelevanceProfile;
  candidates: Screen02PoolHostReviewContext["candidates"];
  rankings: ReadonlyArray<{
    candidateId: string;
    classification: "direct" | "adjacent" | "broad" | "mismatch";
    eligible: boolean;
    baseScore: number;
  }>;
};

export type ValidatedScreen02HostReviewResult = {
  schemaVersion: "shockaudit-screen02-host-review-result-v1";
  origin: "chatgpt-host";
  nonCanonical: true;
  review: Screen02PoolHostReviewSubmission;
  enrichedProfile: Screen02StudyRelevanceProfile;
  rankings: ReturnType<typeof applyScreen02PoolHostReview>;
  outcomeValuesInspected: false;
};

export type Screen02HostReasoningPolicyAdapter = {
  loadCurrent: (
    task: HostReasoningTask,
  ) => Promise<AuthoritativeScreen02HostReviewContext> |
    AuthoritativeScreen02HostReviewContext;
  applyValidated: (input: {
    task: HostReasoningTask;
    resultId: string;
    submissionFingerprint: string;
    current: AuthoritativeScreen02HostReviewContext;
    result: ValidatedScreen02HostReviewResult;
    observedAt: string;
  }) =>
    | Promise<HostReasoningApplicationResult | void>
    | HostReasoningApplicationResult
    | void;
  recoverApplication?: (
    input: HostReasoningApplicationInput,
  ) =>
    | Promise<HostReasoningApplicationResult | null>
    | HostReasoningApplicationResult
    | null;
};

function screen02CurrentContext(
  task: HostReasoningTask,
  current: AuthoritativeScreen02HostReviewContext,
) {
  if (task.taskType !== "screen02-search-review") {
    failPolicyBoundary(
      "wrong-input",
      "The authenticated proposal used the wrong Screen 2 task contract.",
    );
  }
  if (task.runId !== current.runId) {
    failPolicyBoundary(
      "wrong-run",
      "The current Screen 2 workflow run no longer matches the frozen task.",
    );
  }
  if (
    task.candidatePoolId !== current.candidatePoolId ||
    task.candidatePoolFingerprint !== current.candidatePoolFingerprint
  ) {
    failPolicyBoundary(
      "wrong-candidate-pool",
      "The current Screen 2 candidate pool no longer matches the frozen task.",
    );
  }
  if (task.scopeFingerprint !== current.scopeFingerprint) {
    failPolicyBoundary(
      "wrong-input",
      "The current Screen 2 scope no longer matches the frozen bounded input.",
    );
  }
  return {
    taskId: task.taskId,
    profile: current.profile,
    candidates: current.candidates,
  } satisfies Screen02PoolHostReviewContext;
}

function screen02CoreSubmission(
  task: HostReasoningTask,
  proposal: unknown,
): Screen02PoolHostReviewSubmission {
  const parsed = screen02SearchReviewProposalSchema.parse(proposal);
  return {
    schemaVersion: SCREEN02_POOL_HOST_REVIEW_SCHEMA_VERSION,
    taskId: task.taskId,
    capability: SCREEN02_POOL_HOST_REVIEW_CAPABILITY,
    profileAdditions: parsed.profileAdditions,
    candidateReviews: parsed.candidateReviews,
    followUpQueries: parsed.followUpQueries,
    officialSourceLeads: parsed.officialSourceLeads,
    conciseRationale: parsed.conciseRationale,
    hostModel: parsed.hostModel,
  };
}

function screen02ProposalFromCoreReview(
  review: Screen02PoolHostReviewSubmission,
) {
  const {
    schemaVersion: _schemaVersion,
    taskId: _taskId,
    capability: _capability,
    ...proposal
  } = review;
  return proposal;
}

function screen02ReviewResult(
  input: HostReasoningValidationInput,
  current: AuthoritativeScreen02HostReviewContext,
) {
  const context = screen02CurrentContext(input.task, current);
  screen02SearchReviewTaskFactsSchema.parse(input.boundedFacts);
  const submitted = screen02CoreSubmission(input.task, input.proposal);
  const validated = validateScreen02PoolHostReviewSubmission(submitted, context);

  // The core validator requires a normalized containment bridge. At the
  // boundary to authoritative retrieval, require the cited text itself to be
  // a byte-for-byte substring as well. This prevents a normalization-only
  // near-match from becoming host influence.
  const candidateById = new Map(
    current.candidates.map((candidate) => [candidate.candidateId, candidate]),
  );
  for (const review of validated.candidateReviews) {
    const candidate = candidateById.get(review.candidateId);
    if (!candidate) throw new Error("The reviewed candidate is no longer active.");
    const sourceById = new Map(
      candidate.sources.map((source) => [source.sourceId, source]),
    );
    for (const span of review.sourceSpansUsed) {
      const source = sourceById.get(span.sourceId);
      if (!source?.active || !source.text.includes(span.text)) {
        throw new Error("A Screen 2 source span is not an exact active-source substring.");
      }
    }
  }

  const rankings = applyScreen02PoolHostReview(
    validated,
    context,
    current.rankings,
  );
  if (rankings.some((ranking) =>
    !ranking.eligibilityUnchanged || Math.abs(ranking.rankingAdjustment) > 3
  )) {
    throw new Error("Screen 2 host ranking influence exceeded its fixed bound.");
  }
  const enrichedProfile = mergeScreen02StudyRelevanceProfileHostAdditions(
    current.profile,
    validated.profileAdditions,
    input.observedAt,
    {
      promptVersion: input.task.promptVersion,
      taskId: input.task.taskId,
      inputFingerprint: input.task.inputFingerprint,
    },
  );
  const result: ValidatedScreen02HostReviewResult = {
    schemaVersion: "shockaudit-screen02-host-review-result-v1",
    origin: "chatgpt-host",
    nonCanonical: true,
    review: validated,
    enrichedProfile,
    rankings,
    outcomeValuesInspected: false,
  };
  return result;
}

/**
 * Adapts the generic host task to the strict Screen 2 pool validator. The
 * adapter may reorder only fixed-eligible candidates within the core's ±3
 * bound; it never changes fixed eligibility.
 */
export function createScreen02SearchReviewPolicy(
  adapter: Screen02HostReasoningPolicyAdapter,
): HostReasoningTaskPolicy {
  return {
    validate: async (input) => {
      try {
        const current = await adapter.loadCurrent(input.task);
        const result = screen02ReviewResult(input, current);
        return {
          outcome: "accepted",
          normalizedProposal: result,
          sourceIdsReferenced: [...new Set(
            result.review.candidateReviews.flatMap((review) => [
              ...review.sourceIdsUsed,
              ...review.sourceSpansUsed.map((span) => span.sourceId),
            ]),
          )].sort(),
        };
      } catch (error) {
        return policyRejection(
          error,
          "screen02-pool-review-invalid",
          "The host review failed the current candidate, exact source-span, profile, or bounded-ranking contract.",
        );
      }
    },
    apply: async (input) => {
      const current = await adapter.loadCurrent(input.task);
      // Revalidate against the state present at application time rather than
      // trusting the normalized object returned by the earlier callback.
      const result = screen02ReviewResult({
        ...input,
        proposal: screen02ProposalFromCoreReview(
          (input.normalizedProposal as ValidatedScreen02HostReviewResult).review,
        ),
        allowedSourceIds: input.sourceIdsReferenced,
        proposedSourceIdsReferenced: input.sourceIdsReferenced,
      }, current);
      return await adapter.applyValidated({
        task: input.task,
        resultId: input.resultId,
        submissionFingerprint: input.submissionFingerprint,
        current,
        result,
        observedAt: input.observedAt,
      });
    },
    ...(adapter.recoverApplication
      ? { recoverApplication: adapter.recoverApplication }
      : {}),
  };
}

export type AuthoritativeScreen03EvidenceContext = {
  scopeFingerprint: string;
  selectedEventId: string;
  claimGroupId: string;
  allowedSourceIds: readonly string[];
  state: Screen03VerificationState;
  /**
   * Exact same-storage coordinates for the Screen 3 predecessor inspected by
   * fixed validation. The workflow adapter must apply against these
   * coordinates directly; re-reading and applying to a newer state would
   * create a validation/application TOCTOU window.
   */
  applicationCoordinates: Screen03HostEvidenceApplicationCoordinates;
};

export type Screen03HostEvidenceApplicationCoordinates = {
  parent: {
    runId: string;
    generation: number;
    revision: number;
    stateFingerprint: string;
    expiresAt: string;
  };
  predecessor: {
    generation: number;
    revision: number;
    stateFingerprint: string;
    expiresAt: string;
    handoffProducerAppVersion: string;
  };
};

export type ValidatedScreen03HostEvidenceResult = {
  schemaVersion: "shockaudit-screen03-host-evidence-result-v1";
  origin: "chatgpt-host";
  nonCanonical: true;
  mappings: Screen03HostEvidenceMapping[];
  unmappedClaimIds: string[];
  conflictClaimIds: string[];
  conciseRationale: string;
  hostModel: "host_model_not_exposed";
  sourceIdsReferenced: string[];
  stateFingerprintInspected: string;
  sourcePoolFingerprintInspected: string;
  mappingFingerprint: string;
  applicationCoordinatesInspected: Screen03HostEvidenceApplicationCoordinates;
  outcomeValuesInspected: false;
};

export type Screen03EvidenceReasoningPolicyAdapter = {
  loadCurrent: (
    task: HostReasoningTask,
  ) => Promise<AuthoritativeScreen03EvidenceContext> |
    AuthoritativeScreen03EvidenceContext;
  applyValidated: (input: {
    task: HostReasoningTask;
    resultId: string;
    submissionFingerprint: string;
    current: AuthoritativeScreen03EvidenceContext;
    proposals: Screen03ProposalGroups;
    result: ValidatedScreen03HostEvidenceResult;
    observedAt: string;
  }) => Promise<void> | void;
  recoverApplication?: (
    input: HostReasoningApplicationInput,
  ) =>
    | Promise<HostReasoningApplicationResult | null>
    | HostReasoningApplicationResult
    | null;
};

export function uniqueExactScreen03QuoteOffsets(
  passageText: string,
  quotedText: string,
) {
  if (!quotedText || quotedText.length > 1_000) return null;
  const start = passageText.indexOf(quotedText);
  if (start < 0 || passageText.lastIndexOf(quotedText) !== start) return null;
  return { start, end: start + quotedText.length };
}

function screen03CurrentContext(
  task: HostReasoningTask,
  current: AuthoritativeScreen03EvidenceContext,
  frozenSourceIds: readonly string[],
) {
  const allowedSourceIds = [...new Set(current.allowedSourceIds)].sort();
  const currentStateFingerprint = fingerprintScreen03VerificationState(
    current.state,
  );
  if (
    current.applicationCoordinates.parent.runId !== current.state.runId ||
    current.applicationCoordinates.predecessor.revision !==
      current.state.revision ||
    current.applicationCoordinates.predecessor.stateFingerprint !==
      currentStateFingerprint ||
    current.applicationCoordinates.predecessor.expiresAt !==
      current.applicationCoordinates.parent.expiresAt
  ) {
    failPolicyBoundary(
      "stale-submission",
      "The authoritative Screen 3 application coordinates do not match the inspected predecessor.",
    );
  }
  if (task.taskType !== "screen03-evidence-mapping") {
    failPolicyBoundary(
      "wrong-input",
      "The authenticated proposal used the wrong Screen 3 mapping contract.",
    );
  }
  if (task.runId !== current.state.runId) {
    failPolicyBoundary(
      "wrong-run",
      "The current Screen 3 workflow run no longer matches the frozen task.",
    );
  }
  if (task.selectedEventId !== current.selectedEventId) {
    failPolicyBoundary(
      "wrong-event",
      "The current Screen 3 selected event no longer matches the frozen task.",
    );
  }
  if (task.claimGroupId !== current.claimGroupId) {
    failPolicyBoundary(
      "wrong-claim-group",
      "The current Screen 3 claim group no longer matches the frozen task.",
    );
  }
  if (task.eventFingerprint !== current.state.upstream.eventFingerprint) {
    failPolicyBoundary(
      "wrong-event",
      "The current Screen 3 event fingerprint no longer matches the frozen task.",
    );
  }
  if (task.scopeFingerprint !== current.scopeFingerprint) {
    failPolicyBoundary(
      "wrong-input",
      "The current Screen 3 scope no longer matches the frozen bounded input.",
    );
  }
  if (
    task.sourcePoolFingerprint !==
      fingerprintHostReasoningValue(allowedSourceIds)
  ) {
    if (frozenSourceIds.some((sourceId) => !allowedSourceIds.includes(sourceId))) {
      failPolicyBoundary(
        "inactive-evidence",
        "Evidence in the frozen Screen 3 source pool is no longer active.",
      );
    }
    failPolicyBoundary(
      "wrong-source-pool",
      "The current Screen 3 source pool no longer matches the frozen task.",
    );
  }
  return allowedSourceIds;
}

function deriveUniqueExactScreen03Mappings(
  input: HostReasoningValidationInput | HostReasoningApplicationInput,
  current: AuthoritativeScreen03EvidenceContext,
) {
  const facts = screen03EvidenceMappingTaskFactsSchema.parse(input.boundedFacts);
  const allowedSourceIds = screen03CurrentContext(
    input.task,
    current,
    facts.passages.map((passage) => passage.sourceId),
  );
  const proposal = screen03EvidenceMappingProposalSchema.parse(
    "proposal" in input ? input.proposal : input.normalizedProposal,
  );
  const currentFrozenClaims = screen03FactualClaims(current.state.proposals)
    .filter((claim) => claim.support !== "direct")
    .slice(0, 15)
    .map((claim) => ({
      claimId: claim.id,
      claimType: claim.group,
      label: boundedPolicyText(claim.label, 300),
      proposedValue: boundedPolicyText(
        claim.reviewStatus === "edited" ? claim.editedValue! : claim.value,
        1_000,
      ),
      currentEvidenceBasis: claim.support,
    }));
  if (
    fingerprintHostReasoningValue(currentFrozenClaims) !==
      fingerprintHostReasoningValue(facts.claims)
  ) {
    failPolicyBoundary(
      "stale-submission",
      "The current Screen 3 claims no longer match the frozen mapping input.",
    );
  }
  const knownClaimIds = new Set(facts.claims.map((claim) => claim.claimId));
  const currentActiveContradictions = current.state.contradictions
    .filter((contradiction) => contradiction.status === "unresolved")
    .map((contradiction) => ({
      contradictionId: contradiction.id,
      claimIds: contradiction.proposalIds
        .filter((claimId) => knownClaimIds.has(claimId))
        .sort(),
      summary: contradiction.summary,
    }))
    .filter((contradiction) => contradiction.claimIds.length > 0)
    .sort((left, right) =>
      left.contradictionId.localeCompare(right.contradictionId)
    );
  const frozenActiveContradictions = facts.activeContradictions
    .map((contradiction) => ({
      ...contradiction,
      claimIds: [...contradiction.claimIds].sort(),
    }))
    .sort((left, right) =>
      left.contradictionId.localeCompare(right.contradictionId)
    );
  if (
    fingerprintHostReasoningValue(currentActiveContradictions.map(
      ({ contradictionId, claimIds }) => ({ contradictionId, claimIds }),
    )) !== fingerprintHostReasoningValue(frozenActiveContradictions.map(
      ({ contradictionId, claimIds }) => ({ contradictionId, claimIds }),
    ))
  ) {
    failPolicyBoundary(
      "stale-submission",
      "The active Screen 3 contradictions no longer match the frozen mapping input.",
    );
  }
  const passageFacts = new Map(
    facts.passages.map((passage) => [passage.passageId, passage]),
  );
  const evidenceByPassageId = new Map(
    current.state.evidence.flatMap((evidence) =>
      evidence.passages.map((passage) => [passage.id, { evidence, passage }] as const)
    ),
  );
  const partitionClaimIds = [
    ...proposal.mappings.map((mapping) => mapping.claimId),
    ...proposal.unmappedClaimIds,
    ...proposal.conflictClaimIds,
  ];
  const partitionClaimIdSet = new Set(partitionClaimIds);
  if (
    partitionClaimIds.length !== knownClaimIds.size ||
    partitionClaimIdSet.size !== partitionClaimIds.length ||
    partitionClaimIds.some((claimId) => !knownClaimIds.has(claimId)) ||
    [...knownClaimIds].some((claimId) => !partitionClaimIdSet.has(claimId))
  ) {
    throw new Error(
      "Mappings, unmapped claims, and conflict claims must exactly and disjointly partition the frozen claim set.",
    );
  }

  const declaredConflictClaimIds = new Set([
    ...proposal.conflictClaimIds,
    ...proposal.mappings
      .filter((mapping) => mapping.proposedSupportStatus === "conflicting")
      .map((mapping) => mapping.claimId),
  ]);
  const unacknowledgedActiveConflict = frozenActiveContradictions
    .flatMap((contradiction) => contradiction.claimIds)
    .find((claimId) =>
      knownClaimIds.has(claimId) && !declaredConflictClaimIds.has(claimId)
    );
  if (unacknowledgedActiveConflict) {
    failPolicyBoundary(
      "active-conflict-unacknowledged",
      "Every current unresolved Screen 3 contradiction in the frozen claim group must be submitted as a conflict.",
    );
  }

  const sources = new Set<string>();
  const directMappings: Screen03HostEvidenceMapping[] = [];
  for (const mapping of proposal.mappings) {
    const spans = mapping.quotedSpans.map((span) => {
      if (!mapping.passageIds.includes(span.passageId)) {
        throw new Error("A quoted span does not belong to its mapping passage list.");
      }
      const frozenPassage = passageFacts.get(span.passageId);
      const authoritative = evidenceByPassageId.get(span.passageId);
      if (!frozenPassage) {
        failPolicyBoundary(
          "wrong-input",
          "The authenticated mapping referenced a passage outside its frozen input.",
        );
      }
      if (!authoritative || authoritative.evidence.status === "changed") {
        failPolicyBoundary(
          "inactive-evidence",
          "The authenticated mapping referenced evidence that is no longer active.",
        );
      }
      if (!allowedSourceIds.includes(authoritative.evidence.id)) {
        failPolicyBoundary(
          "wrong-source-pool",
          "The authenticated mapping referenced evidence outside the current source pool.",
        );
      }
      const frozenFragmentStart = authoritative.passage.text.indexOf(
        frozenPassage.text,
      );
      if (frozenPassage.sourceId !== authoritative.evidence.id) {
        failPolicyBoundary(
          "wrong-source-pool",
          "The authenticated mapping did not match the frozen passage owner.",
        );
      }
      if (
        frozenPassage.sourceAuthority !==
          boundedPolicyText(authoritative.evidence.publisher, 200) ||
        frozenPassage.authorityTier !== authoritative.evidence.authorityTier ||
        frozenPassage.evidenceBasis !== authoritative.passage.basis
      ) {
        failPolicyBoundary(
          "inactive-evidence",
          "The frozen passage authority or evidence basis is no longer current.",
        );
      }
      if (
        frozenFragmentStart < 0 ||
        authoritative.passage.text.lastIndexOf(frozenPassage.text) !==
          frozenFragmentStart
      ) {
        failPolicyBoundary(
          "inactive-evidence",
          "The frozen passage is no longer one unique active evidence fragment.",
        );
      }
      if (!frozenPassage.text.includes(span.text)) {
        failPolicyBoundary(
          "wrong-input",
          "The authenticated mapping did not preserve its exact frozen passage input.",
        );
      }
      const offsets = uniqueExactScreen03QuoteOffsets(
        authoritative.passage.text,
        span.text,
      );
      if (!offsets) {
        throw new Error("A quote must be one unique exact substring of its frozen passage.");
      }
      sources.add(authoritative.evidence.id);
      return {
        passageId: span.passageId,
        start: offsets.start,
        end: offsets.end,
        text: span.text,
      };
    });
    if (mapping.proposedSupportStatus === "direct") {
      directMappings.push({
        claimId: mapping.claimId,
        passageIds: mapping.passageIds,
        quotedSpans: spans,
        status: "direct",
      });
    }
  }
  const restored = restoreScreen03HostEvidenceMappings(
    directMappings,
    current.state,
  );
  if (!restored) {
    throw new Error("The authoritative Screen 3 evidence contract rejected a mapping.");
  }
  return {
    proposal,
    mappings: restored,
    sourceIdsReferenced: [...sources].sort(),
    proposals: applyScreen03HostEvidenceMappings(current.state, restored),
  };
}

/**
 * Resolves model-submitted quote text to offsets only when it occurs once,
 * byte-for-byte, in the still-current frozen passage. The core then rechecks
 * source activity, authority tier, official-field compatibility, value/date
 * support, and preserves every researcher review decision.
 */
export function createScreen03EvidenceMappingPolicy(
  adapter: Screen03EvidenceReasoningPolicyAdapter,
): HostReasoningTaskPolicy {
  return {
    validate: async (input) => {
      try {
        const current = await adapter.loadCurrent(input.task);
        const validated = deriveUniqueExactScreen03Mappings(input, current);
        const result: ValidatedScreen03HostEvidenceResult = {
          schemaVersion: "shockaudit-screen03-host-evidence-result-v1",
          origin: "chatgpt-host",
          nonCanonical: true,
          mappings: validated.mappings,
          unmappedClaimIds: [
            ...validated.proposal.unmappedClaimIds,
            ...validated.proposal.mappings
              .filter((mapping) =>
                mapping.proposedSupportStatus === "indirect" ||
                mapping.proposedSupportStatus === "unsupported"
              )
              .map((mapping) => mapping.claimId),
          ].sort(),
          conflictClaimIds: [
            ...validated.proposal.conflictClaimIds,
            ...validated.proposal.mappings
              .filter((mapping) =>
                mapping.proposedSupportStatus === "conflicting"
              )
              .map((mapping) => mapping.claimId),
          ].sort(),
          conciseRationale: validated.proposal.conciseRationale,
          hostModel: validated.proposal.hostModel,
          sourceIdsReferenced: validated.sourceIdsReferenced,
          stateFingerprintInspected: fingerprintScreen03VerificationState(
            current.state,
          ),
          sourcePoolFingerprintInspected: input.task.sourcePoolFingerprint,
          mappingFingerprint: fingerprintScreen03HostEvidenceMappings(
            validated.mappings,
          ),
          applicationCoordinatesInspected: structuredClone(
            current.applicationCoordinates,
          ),
          outcomeValuesInspected: false,
        };
        return {
          outcome: "accepted",
          normalizedProposal: result,
          sourceIdsReferenced: result.sourceIdsReferenced,
        };
      } catch (error) {
        return policyRejection(
          error,
          "screen03-evidence-mapping-invalid",
          "The host mapping failed the current claim, unique exact quote, active-source, authority, field, value, or date contract.",
        );
      }
    },
    apply: async (input) => {
      const current = await adapter.loadCurrent(input.task);
      const normalized = input.normalizedProposal as ValidatedScreen03HostEvidenceResult;
      const sourceProposal = {
        mappings: normalized.mappings.map((mapping) => ({
          claimId: mapping.claimId,
          passageIds: mapping.passageIds,
          quotedSpans: mapping.quotedSpans.map((span) => ({
            passageId: span.passageId,
            text: span.text,
          })),
          supportExplanation: "Exact source mapping validated by fixed software.",
          proposedSupportStatus: "direct" as const,
        })),
        unmappedClaimIds: normalized.unmappedClaimIds,
        conflictClaimIds: normalized.conflictClaimIds,
        conciseRationale: normalized.conciseRationale,
        hostModel: normalized.hostModel,
      };
      const validated = deriveUniqueExactScreen03Mappings({
        ...input,
        proposal: sourceProposal,
      }, current);
      const inspectedStateFingerprint = fingerprintScreen03VerificationState(
        current.state,
      );
      if (
        normalized.stateFingerprintInspected !== inspectedStateFingerprint ||
        normalized.sourcePoolFingerprintInspected !==
          input.task.sourcePoolFingerprint ||
        normalized.mappingFingerprint !==
          fingerprintScreen03HostEvidenceMappings(validated.mappings) ||
        fingerprintHostReasoningValue(
          normalized.applicationCoordinatesInspected,
        ) !== fingerprintHostReasoningValue(current.applicationCoordinates)
      ) {
        failPolicyBoundary(
          "stale-submission",
          "Screen 3 changed after the host mapping was validated.",
        );
      }
      await adapter.applyValidated({
        task: input.task,
        resultId: input.resultId,
        submissionFingerprint: input.submissionFingerprint,
        current,
        proposals: validated.proposals,
        result: {
          ...normalized,
          mappings: validated.mappings,
          sourceIdsReferenced: validated.sourceIdsReferenced,
        },
        observedAt: input.observedAt,
      });
    },
    ...(adapter.recoverApplication
      ? { recoverApplication: adapter.recoverApplication }
      : {}),
  };
}

export type AuthoritativeScreen03OverviewContext = {
  scopeFingerprint: string;
  selectedEventId: string;
  allowedSourceIds: readonly string[];
  state: Screen03VerificationState;
};

export type ValidatedScreen03HostOverviewResult = {
  schemaVersion: "shockaudit-screen03-host-overview-result-v1";
  origin: "chatgpt-host";
  nonCanonical: true;
  summary: string;
  keyPoints: string[];
  uncertainties: string[];
  sourceIds: string[];
  conciseRationale: string;
  hostModel: "host_model_not_exposed";
  stateFingerprintInspected: string;
  outcomeValuesInspected: false;
};

export type Screen03OverviewReasoningPolicyAdapter = {
  loadCurrent: (
    task: HostReasoningTask,
  ) => Promise<AuthoritativeScreen03OverviewContext> |
    AuthoritativeScreen03OverviewContext;
  /** A fixed, deterministic domain validator; no inference or sampling. */
  validateWording: (input: {
    task: HostReasoningTask;
    current: AuthoritativeScreen03OverviewContext;
    boundedFacts: ReturnType<typeof screen03OverviewTaskFactsSchema.parse>;
    proposal: ReturnType<typeof screen03OverviewProposalSchema.parse>;
  }) => Promise<boolean> | boolean;
  applyValidated: (input: {
    task: HostReasoningTask;
    resultId: string;
    submissionFingerprint: string;
    current: AuthoritativeScreen03OverviewContext;
    result: ValidatedScreen03HostOverviewResult;
    observedAt: string;
  }) => Promise<void> | void;
  recoverApplication?: (
    input: HostReasoningApplicationInput,
  ) =>
    | Promise<HostReasoningApplicationResult | null>
    | HostReasoningApplicationResult
    | null;
};

function screen03OverviewCurrentContext(
  task: HostReasoningTask,
  current: AuthoritativeScreen03OverviewContext,
  frozenSourceIds: readonly string[],
) {
  const allowedSourceIds = [...new Set(current.allowedSourceIds)].sort();
  if (
    task.taskType !== "screen03-overview-improvement" ||
    task.claimGroupId !== null
  ) {
    failPolicyBoundary(
      "wrong-input",
      "The authenticated proposal used the wrong Screen 3 overview contract.",
    );
  }
  if (task.runId !== current.state.runId) {
    failPolicyBoundary(
      "wrong-run",
      "The current Screen 3 workflow run no longer matches the frozen task.",
    );
  }
  if (task.selectedEventId !== current.selectedEventId) {
    failPolicyBoundary(
      "wrong-event",
      "The current Screen 3 selected event no longer matches the frozen task.",
    );
  }
  if (task.eventFingerprint !== current.state.upstream.eventFingerprint) {
    failPolicyBoundary(
      "wrong-event",
      "The current Screen 3 event fingerprint no longer matches the frozen task.",
    );
  }
  if (task.scopeFingerprint !== current.scopeFingerprint) {
    failPolicyBoundary(
      "wrong-input",
      "The current Screen 3 scope no longer matches the frozen bounded input.",
    );
  }
  if (
    task.sourcePoolFingerprint !==
      fingerprintHostReasoningValue(allowedSourceIds)
  ) {
    if (frozenSourceIds.some((sourceId) => !allowedSourceIds.includes(sourceId))) {
      failPolicyBoundary(
        "inactive-evidence",
        "A frozen overview source no longer provides active direct support.",
      );
    }
    failPolicyBoundary(
      "wrong-source-pool",
      "The current Screen 3 source pool no longer matches the frozen task.",
    );
  }
  return allowedSourceIds;
}

function overviewHighRiskTokens(text: string) {
  return [...new Set([
    ...(text.match(/(?:[$£€]\s*)?\b\d[\d,.]*(?:%|\s*(?:days?|months?|years?))?\b/giu) ?? []),
    ...(text.match(/\b[A-Z]{2,}(?:[ -][A-Z0-9]{2,})*\b/gu) ?? []),
  ].map((token) => token.normalize("NFKC").toLocaleLowerCase("en-US")))];
}

const OVERVIEW_SAFE_WORDS = new Set([
  "a", "an", "and", "are", "as", "be", "been", "being", "canonical", "current",
  "currently", "describe", "described", "document", "documented",
  "documents", "each", "event", "evidence", "fact", "identified",
  "identifies", "identify", "is", "it", "its", "key", "of", "only",
  "overview", "point", "points", "record", "report", "reported", "reports",
  "selected", "source", "state", "stated", "states", "summary", "support",
  "supported", "supports", "the", "this", "title", "type", "verified", "was", "were",
]);

const OVERVIEW_UNCERTAINTY_SAFE_WORDS = new Set([
  ...OVERVIEW_SAFE_WORDS,
  "explicit", "explicitly", "remain", "remains", "uncertain", "uncertainty",
  "unresolved",
]);

const OVERVIEW_WORD_ALIASES = new Map<string, string>([
  ["applied", "apply"], ["applies", "apply"], ["applying", "apply"],
  ["businesses", "business"], ["companies", "company"],
  ["covered", "cover"], ["covers", "cover"], ["covering", "cover"],
  ["duties", "duty"], ["entities", "entity"], ["firms", "firm"],
  ["obligations", "obligation"], ["policies", "policy"],
  ["regulated", "regulate"], ["regulates", "regulate"],
  ["regulating", "regulate"], ["regulations", "regulation"],
  ["required", "require"], ["requires", "require"],
  ["requiring", "require"], ["rules", "rule"], ["must", "require"],
]);

function overviewWordFamily(word: string) {
  const normalized = word.normalize("NFKC").toLocaleLowerCase("en-US")
    .replace(/[’']s$/u, "");
  const alias = OVERVIEW_WORD_ALIASES.get(normalized);
  if (alias) return alias;
  if (normalized.length > 5 && normalized.endsWith("ies")) {
    return `${normalized.slice(0, -3)}y`;
  }
  if (
    normalized.length > 4 && normalized.endsWith("s") &&
    !normalized.endsWith("ss")
  ) return normalized.slice(0, -1);
  return normalized;
}

function overviewWords(text: string) {
  return (text.match(/[\p{L}\p{N}]+(?:[’'][\p{L}\p{N}]+)?/gu) ?? [])
    .map(overviewWordFamily);
}

function overviewAssertions(text: string) {
  return text.split(/(?:[.!?]+["')\]]*\s+|[;\n]+)/u)
    .map((value) => value.trim())
    .filter(Boolean);
}

function overviewContainsPhrase(
  assertionWords: readonly string[],
  phraseWords: readonly string[],
) {
  if (phraseWords.length === 0 || phraseWords.length > assertionWords.length) {
    return false;
  }
  return assertionWords.some((_, start) =>
    start + phraseWords.length <= assertionWords.length &&
    phraseWords.every((word, offset) => assertionWords[start + offset] === word)
  );
}

function overviewPhraseStart(
  assertionWords: readonly string[],
  phraseWords: readonly string[],
) {
  if (phraseWords.length === 0 || phraseWords.length > assertionWords.length) {
    return -1;
  }
  return assertionWords.findIndex((_, start) =>
    start + phraseWords.length <= assertionWords.length &&
    phraseWords.every((word, offset) => assertionWords[start + offset] === word)
  );
}

function overviewHasNeutralFactRelation(
  words: readonly string[],
  labelWords: readonly string[],
  valueWords: readonly string[],
) {
  const labelStart = overviewPhraseStart(words, labelWords);
  const valueStart = overviewPhraseStart(words, valueWords);
  if (labelStart < 0 || valueStart < 0) return false;
  const labelEnd = labelStart + labelWords.length;
  const valueEnd = valueStart + valueWords.length;
  const insideAnchor = (index: number) =>
    index >= labelStart && index < labelEnd ||
    index >= valueStart && index < valueEnd;
  const reportingVerbs = new Set(["document", "identify", "report", "state", "support"]);
  const reportingIndex = words.findIndex((word, index) =>
    !insideAnchor(index) && reportingVerbs.has(word)
  );
  if (reportingIndex >= 0) {
    const neutralSubject = words.slice(0, reportingIndex).some((word) =>
      ["evidence", "overview", "record", "report", "source"].includes(word)
    );
    return neutralSubject && reportingIndex < labelStart &&
      reportingIndex < valueStart;
  }
  const firstEnd = labelStart < valueStart ? labelEnd : valueEnd;
  const secondStart = labelStart < valueStart ? valueStart : labelStart;
  return firstEnd === secondStart || words.slice(firstEnd, secondStart).some(
    (word) => ["are", "is", "was", "were"].includes(word),
  );
}

function assertConservativeOverviewGrounding(
  boundedFacts: ReturnType<typeof screen03OverviewTaskFactsSchema.parse>,
  proposal: ReturnType<typeof screen03OverviewProposalSchema.parse>,
) {
  const citedSourceIds = new Set(proposal.sourceIds);
  const factVocabulary = boundedFacts.supportedFacts.map((fact) => ({
    fact,
    labelWords: overviewWords(fact.label),
    valueWords: overviewWords(fact.value),
    words: new Set(overviewWords(`${fact.label} ${fact.value}`)),
  }));
  const explicitUncertaintyVocabulary = boundedFacts.explicitUncertainties.map(
    (uncertainty) => new Set(overviewWords(uncertainty)),
  );
  const eventTitleWords = overviewWords(boundedFacts.eventTitle);
  const eventTypeWords = overviewWords(boundedFacts.eventType);
  const eventVocabulary = new Set([...eventTitleWords, ...eventTypeWords]);
  const assertGroundedAssertion = (assertion: string) => {
    const words = overviewWords(assertion);
    // An assertion may use neutral reporting scaffolding, but every other word
    // must come from one (not a collage of several) cited supported fact. Both
    // the exact label and exact value phrases must be present. This deliberately
    // rejects fluent but invented relations assembled from otherwise known words.
    const sourceGroundedFact = factVocabulary.some(({
      fact,
      labelWords,
      valueWords,
      words: factWords,
    }) =>
      fact.sourceIds.some((sourceId) => citedSourceIds.has(sourceId)) &&
      overviewContainsPhrase(words, labelWords) &&
      overviewContainsPhrase(words, valueWords) &&
      overviewHasNeutralFactRelation(words, labelWords, valueWords) &&
      words.every((word) =>
        OVERVIEW_SAFE_WORDS.has(word) || factWords.has(word)
      )
    );
    const eventTitleStart = overviewPhraseStart(words, eventTitleWords);
    const eventTypeStart = overviewPhraseStart(words, eventTypeWords);
    const eventIndex = words.indexOf("event");
    const typeIndex = words.indexOf("type");
    const relationBetween = (leftEnd: number, rightStart: number) =>
      leftEnd <= rightStart && words.slice(leftEnd, rightStart).some(
        (word) => ["are", "is", "was", "were"].includes(word),
      );
    const exactEventIdentity = words.every((word) =>
      OVERVIEW_SAFE_WORDS.has(word) || eventVocabulary.has(word)
    ) &&
      (
        eventTitleStart >= 0 && eventIndex >= 0 &&
          (
            relationBetween(eventTitleStart + eventTitleWords.length, eventIndex) ||
            relationBetween(eventIndex + 1, eventTitleStart)
          ) ||
        eventTypeStart >= 0 && eventIndex >= 0 && typeIndex >= 0 &&
          (
            relationBetween(typeIndex + 1, eventTypeStart) ||
            relationBetween(eventTypeStart + eventTypeWords.length, eventIndex)
          )
      );
    if (!sourceGroundedFact && !exactEventIdentity) {
      throw new Error(
        "Each overview assertion must resolve to a supplied supported fact or exact event identity.",
      );
    }
  };

  const assertions = [
    ...overviewAssertions(proposal.summary),
    ...proposal.keyPoints.flatMap(overviewAssertions),
  ];
  if (assertions.length === 0) {
    throw new Error("The overview contains no grounded assertion.");
  }
  assertions.forEach(assertGroundedAssertion);

  for (const uncertainty of proposal.uncertainties) {
    const submittedWords = overviewWords(uncertainty);
    const supportedUncertainty = explicitUncertaintyVocabulary.some(
      (knownWords) =>
        submittedWords.some((word) =>
          !OVERVIEW_UNCERTAINTY_SAFE_WORDS.has(word) && knownWords.has(word)
        ) &&
        submittedWords.every((word) =>
          OVERVIEW_UNCERTAINTY_SAFE_WORDS.has(word) || knownWords.has(word)
        ),
    );
    if (!supportedUncertainty) {
      throw new Error(
        "An overview uncertainty does not correspond to a supplied explicit uncertainty.",
      );
    }
  }
}

async function screen03OverviewResult(
  input: HostReasoningValidationInput | HostReasoningApplicationInput,
  current: AuthoritativeScreen03OverviewContext,
  adapter: Screen03OverviewReasoningPolicyAdapter,
) {
  const boundedFacts = screen03OverviewTaskFactsSchema.parse(input.boundedFacts);
  const allowedSourceIds = screen03OverviewCurrentContext(
    input.task,
    current,
    boundedFacts.supportedFacts.flatMap((fact) => fact.sourceIds),
  );
  const rawProposal = "proposal" in input
    ? input.proposal
    : (input.normalizedProposal as ValidatedScreen03HostOverviewResult);
  const proposal = screen03OverviewProposalSchema.parse(rawProposal);
  if (
    boundedFacts.eventTitle !== current.state.eventIdentity.canonicalTitle ||
    boundedFacts.eventType !== current.state.eventIdentity.eventType
  ) {
    failPolicyBoundary(
      "wrong-event",
      "The current Screen 3 event identity no longer matches the frozen overview input.",
    );
  }
  if (proposal.sourceIds.length === 0) {
    failPolicyBoundary(
      "wrong-input",
      "The authenticated overview omitted a source for its supplied supported facts.",
    );
  }
  if (proposal.sourceIds.some((sourceId) => !allowedSourceIds.includes(sourceId))) {
    failPolicyBoundary(
      "wrong-source-pool",
      "The authenticated overview referenced a source outside the current Screen 3 pool.",
    );
  }
  const supportedSourceIds = new Set(
    boundedFacts.supportedFacts.flatMap((fact) => fact.sourceIds),
  );
  if (proposal.sourceIds.some((sourceId) => !supportedSourceIds.has(sourceId))) {
    failPolicyBoundary(
      "unknown-source",
      "The authenticated overview cited a source not attached to a supplied supported fact.",
    );
  }
  const supportedById = new Map(
    buildScreen03SupportedFacts(current.state).map((fact) => [fact.claimId, fact]),
  );
  for (const fact of boundedFacts.supportedFacts) {
    const currentFact = supportedById.get(fact.factId);
    if (!currentFact) {
      failPolicyBoundary(
        "inactive-evidence",
        "A frozen overview fact no longer has current direct evidence support.",
      );
    }
    if (currentFact.label !== fact.label || currentFact.value !== fact.value) {
      failPolicyBoundary(
        "stale-submission",
        "A supplied overview fact no longer matches the frozen supported value.",
      );
    }
    if (
      fingerprintHostReasoningValue([...currentFact.evidenceIds].sort()) !==
      fingerprintHostReasoningValue([...fact.sourceIds].sort())
    ) {
      failPolicyBoundary(
        "inactive-evidence",
        "A supplied overview fact no longer has the same active supporting sources.",
      );
    }
  }
  const factCorpus = [
    boundedFacts.eventTitle,
    boundedFacts.eventType,
    ...boundedFacts.supportedFacts.flatMap((fact) => [fact.label, fact.value]),
    ...boundedFacts.explicitUncertainties,
  ].join("\n").normalize("NFKC").toLocaleLowerCase("en-US");
  const proposedText = [
    proposal.summary,
    ...proposal.keyPoints,
    ...proposal.uncertainties,
  ].join("\n");
  if (overviewHighRiskTokens(proposedText).some((token) =>
    !factCorpus.includes(token)
  )) {
    throw new Error("The overview introduced an unsupported date, amount, or authority token.");
  }
  assertConservativeOverviewGrounding(boundedFacts, proposal);
  if (!await adapter.validateWording({
    task: input.task,
    current,
    boundedFacts,
    proposal,
  })) {
    throw new Error("The fixed overview wording validator rejected an unsupported fact.");
  }
  const result: ValidatedScreen03HostOverviewResult = {
    schemaVersion: "shockaudit-screen03-host-overview-result-v1",
    origin: "chatgpt-host",
    nonCanonical: true,
    ...proposal,
    sourceIds: [...proposal.sourceIds].sort(),
    stateFingerprintInspected: fingerprintScreen03VerificationState(current.state),
    outcomeValuesInspected: false,
  };
  return result;
}

/**
 * Keeps optional prose outside the verified Event Card. Current supported
 * facts, sources, high-risk numeric/authority tokens, and a caller-supplied
 * fixed wording contract must all pass before noncanonical storage.
 */
export function createScreen03OverviewPolicy(
  adapter: Screen03OverviewReasoningPolicyAdapter,
): HostReasoningTaskPolicy {
  return {
    validate: async (input) => {
      try {
        const current = await adapter.loadCurrent(input.task);
        const result = await screen03OverviewResult(input, current, adapter);
        return {
          outcome: "accepted",
          normalizedProposal: result,
          sourceIdsReferenced: result.sourceIds,
        };
      } catch (error) {
        return policyRejection(
          error,
          "screen03-overview-invalid",
          "The optional overview introduced or referenced content outside the current directly supported facts and fixed wording contract.",
        );
      }
    },
    apply: async (input) => {
      const current = await adapter.loadCurrent(input.task);
      const normalized = input.normalizedProposal as ValidatedScreen03HostOverviewResult;
      const proposal = {
        summary: normalized.summary,
        keyPoints: normalized.keyPoints,
        uncertainties: normalized.uncertainties,
        sourceIds: normalized.sourceIds,
        conciseRationale: normalized.conciseRationale,
        hostModel: normalized.hostModel,
      };
      const result = await screen03OverviewResult({
        ...input,
        proposal,
      }, current, adapter);
      await adapter.applyValidated({
        task: input.task,
        resultId: input.resultId,
        submissionFingerprint: input.submissionFingerprint,
        current,
        result,
        observedAt: input.observedAt,
      });
    },
    ...(adapter.recoverApplication
      ? { recoverApplication: adapter.recoverApplication }
      : {}),
  };
}
