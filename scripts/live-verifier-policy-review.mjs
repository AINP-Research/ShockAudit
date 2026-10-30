const sourceBackedStatuses = new Set(["ready", "partial"]);
const attemptedRouteStatuses = new Set([
  "searched",
  "waiting_source",
  "blocked",
]);
const precisePolicyPredicates = new Set([
  "operative_change",
  "substantive_obligation",
  "legal_effect_date",
  "policy_date",
  "implementation_schedule",
  "coverage_condition",
  "territorial_nexus",
  "threshold_condition",
  "exemption_rule",
  "enforcement_authority",
  "remedy",
  "penalty",
  "previous_baseline",
  "historical_version_change",
  "contemporaneous_amendment_record",
]);

export function precisePolicyRouteForInstrumentFamily(instrumentFamily) {
  if (instrumentFamily === "federal_rule") {
    return "confirmed_federal_register_record";
  }
  if (
    instrumentFamily === "federal_statute" ||
    instrumentFamily === "official_document"
  ) {
    return "confirmed_official_document";
  }
  throw new Error("The live verifier received an unknown policy instrument family.");
}

export function policyEvidenceRouteStatus(review, sourceRoute) {
  if (!Array.isArray(review?.plan?.steps)) return null;
  return review.plan.steps.find((step) =>
    step?.sourceRoute === sourceRoute
  )?.status ?? null;
}

function hasSourceBackedReview(review, expectedInstrumentFamily) {
  return (
    sourceBackedStatuses.has(review?.status) &&
    review?.artifactStatus === "current" &&
    typeof review?.evidenceSnapshotId === "string" &&
    review.evidenceSnapshotId.length > 0 &&
    Number.isSafeInteger(review?.sourceCount) &&
    review.sourceCount >= 1 &&
    Number.isSafeInteger(review?.passageCount) &&
    review.passageCount >= 1 &&
    Number.isSafeInteger(review?.claimCount) &&
    review.claimCount >= 1 &&
    Array.isArray(review?.claims) &&
    review.claims.length === review.claimCount &&
    review?.plan?.instrumentFamily === expectedInstrumentFamily
  );
}

function hasSourceLinkedClaim(review, predicate) {
  return review.claims.some((claim) =>
    claim?.predicate === predicate &&
    typeof claim?.citation?.exactText === "string" &&
    claim.citation.exactText.trim().length > 0 &&
    typeof claim?.citation?.canonicalUrl === "string" &&
    claim.citation.canonicalUrl.startsWith("https://")
  );
}

function hasSourceLinkedPrecisePolicyClaim(review) {
  return review.claims.some((claim) =>
    precisePolicyPredicates.has(claim?.predicate) &&
    typeof claim?.citation?.exactText === "string" &&
    claim.citation.exactText.trim().length > 0 &&
    typeof claim?.citation?.canonicalUrl === "string" &&
    claim.citation.canonicalUrl.startsWith("https://")
  );
}

export function introductoryPolicyReviewDiagnostic(
  review,
  expectedInstrumentFamily,
) {
  const claims = Array.isArray(review?.claims) ? review.claims : [];
  const requirements = Array.isArray(review?.requirements)
    ? review.requirements
    : [];
  let preciseRoute = null;
  try {
    preciseRoute = precisePolicyRouteForInstrumentFamily(
      expectedInstrumentFamily,
    );
  } catch {
    // The bounded diagnostic reports an unknown family without guessing.
  }
  return {
    status: review?.status ?? null,
    artifactStatus: review?.artifactStatus ?? null,
    evidenceSnapshotPresent:
      typeof review?.evidenceSnapshotId === "string" &&
      review.evidenceSnapshotId.length > 0,
    counts: {
      sources: Number.isSafeInteger(review?.sourceCount)
        ? review.sourceCount
        : null,
      passages: Number.isSafeInteger(review?.passageCount)
        ? review.passageCount
        : null,
      declaredClaims: Number.isSafeInteger(review?.claimCount)
        ? review.claimCount
        : null,
      returnedClaims: claims.length,
    },
    expectedInstrumentFamily,
    actualInstrumentFamily: review?.plan?.instrumentFamily ?? null,
    explanationRouteStatus: policyEvidenceRouteStatus(
      review,
      "complementary_policy_explanations",
    ),
    policyExplanationPresent: claims.some((claim) =>
      claim?.predicate === "policy_explanation"
    ),
    sourceLinkedPolicyExplanation: claims.length > 0 &&
      hasSourceLinkedClaim({ claims }, "policy_explanation"),
    preciseRoute,
    preciseRouteStatus: preciseRoute
      ? policyEvidenceRouteStatus(review, preciseRoute)
      : null,
    sourceLinkedPrecisePolicyClaim: claims.length > 0 &&
      hasSourceLinkedPrecisePolicyClaim({ claims }),
    overviewQualityStatus: Array.isArray(review?.briefingQuality?.boxes)
      ? review.briefingQuality.boxes.find((box) =>
        box?.box === "overview")?.status ?? null
      : null,
    synthesisStatus: review?.synthesis?.status ?? null,
    requirementCount: requirements.length,
    requirementsAllUnsearched: requirements.length > 0 &&
      requirements.every((requirement) =>
        requirement?.status === "not_yet_searched"
      ),
    requirementStatuses: [...new Set(requirements.map((requirement) =>
      typeof requirement?.status === "string"
        ? requirement.status
        : "missing"
    ))].sort().slice(0, 12),
  };
}

/**
 * A first research step may now be either explanatory-first (federal rules)
 * or controlling-source-first (statutes and other official documents). Both
 * paths must retain directly cited evidence before the live gate advances.
 */
export function isSourceBackedInitialPolicyReview(
  review,
  expectedInstrumentFamily,
) {
  if (!hasSourceBackedReview(review, expectedInstrumentFamily)) return false;
  const explanationFirst =
    policyEvidenceRouteStatus(
      review,
      "complementary_policy_explanations",
    ) === "searched" &&
    hasSourceLinkedClaim(review, "policy_explanation");
  const preciseRoute = precisePolicyRouteForInstrumentFamily(
    expectedInstrumentFamily,
  );
  const controllingFirst = attemptedRouteStatuses.has(
    policyEvidenceRouteStatus(review, preciseRoute),
  ) && hasSourceLinkedPrecisePolicyClaim(review);
  return explanationFirst || controllingFirst;
}

export function isSourceBackedIntroductoryPolicyReview(
  review,
  expectedInstrumentFamily,
) {
  return (
    hasSourceBackedReview(review, expectedInstrumentFamily) &&
    policyEvidenceRouteStatus(
      review,
      "complementary_policy_explanations",
    ) === "searched" &&
    hasSourceLinkedClaim(review, "policy_explanation") &&
    Array.isArray(review?.requirements) &&
    review.requirements.length > 0 &&
    review.requirements.every((requirement) =>
      requirement?.status === "not_yet_searched"
    )
  );
}

export function isSourceBackedAttemptedPrecisePolicyReview(
  review,
  expectedInstrumentFamily,
) {
  if (!hasSourceBackedReview(review, expectedInstrumentFamily)) return false;
  const sourceRoute = precisePolicyRouteForInstrumentFamily(
    expectedInstrumentFamily,
  );
  return attemptedRouteStatuses.has(
    policyEvidenceRouteStatus(review, sourceRoute),
  );
}
