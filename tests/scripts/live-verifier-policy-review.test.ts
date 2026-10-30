import { describe, expect, it } from "vitest";

// The production live gate helpers are plain Node ESM rather than TypeScript.
// @ts-expect-error The verifier helper intentionally has no generated types.
import * as policyReviewVerifier from "../../scripts/live-verifier-policy-review.mjs";

const {
  introductoryPolicyReviewDiagnostic,
  isSourceBackedAttemptedPrecisePolicyReview,
  isSourceBackedInitialPolicyReview,
  isSourceBackedIntroductoryPolicyReview,
  policyEvidenceRouteStatus,
  precisePolicyRouteForInstrumentFamily,
} = policyReviewVerifier;

function introductoryReview(instrumentFamily = "official_document") {
  return {
    status: "partial",
    artifactStatus: "current",
    evidenceSnapshotId: "policy-evidence-intro-v1",
    sourceCount: 1,
    passageCount: 1,
    claimCount: 1,
    claims: [{
      predicate: "policy_explanation",
      citation: {
        exactText: "The official explanation describes the policy.",
        canonicalUrl: "https://agency.example/policy-explanation",
      },
    }],
    requirements: [
      { kind: "coverage", status: "not_yet_searched" },
      { kind: "enforcement", status: "not_yet_searched" },
    ],
    plan: {
      instrumentFamily,
      steps: [
        {
          sourceRoute: "complementary_policy_explanations",
          status: "searched",
        },
        {
          sourceRoute: instrumentFamily === "federal_rule"
            ? "confirmed_federal_register_record"
            : "confirmed_official_document",
          status: "not_started",
        },
      ],
    },
  };
}

describe("live verifier complementary policy review", () => {
  it.each([
    ["official_document", "confirmed_official_document"],
    ["federal_statute", "confirmed_official_document"],
    ["federal_rule", "confirmed_federal_register_record"],
  ])("maps %s to its precise source route", (instrumentFamily, route) => {
    expect(precisePolicyRouteForInstrumentFamily(instrumentFamily)).toBe(route);
  });

  it("rejects an unknown policy family instead of guessing a route", () => {
    expect(() => precisePolicyRouteForInstrumentFamily("unknown"))
      .toThrow(/unknown policy instrument family/iu);
  });

  it("accepts a source-linked introduction only while precise requirements remain unsearched", () => {
    const review = introductoryReview();
    expect(isSourceBackedIntroductoryPolicyReview(
      review,
      "official_document",
    )).toBe(true);

    review.requirements[0].status = "supported";
    expect(isSourceBackedIntroductoryPolicyReview(
      review,
      "official_document",
    )).toBe(false);
  });

  it("accepts a controlling-source-first review when adaptive routing skips a redundant explanation", () => {
    const review = introductoryReview("official_document");
    review.claims[0] = {
      predicate: "operative_change",
      citation: {
        exactText: "The Act requires covered businesses to honor consumer requests.",
        canonicalUrl: "https://legislature.example/act",
      },
    };
    review.plan.steps[0].status = "not_needed";
    review.plan.steps[1].status = "searched";
    review.requirements[0].status = "supported";

    expect(isSourceBackedInitialPolicyReview(
      review,
      "official_document",
    )).toBe(true);
    expect(isSourceBackedInitialPolicyReview(
      review,
      "federal_rule",
    )).toBe(false);
  });

  it("reports only bounded predicate diagnostics for a rejected introduction", () => {
    const review = introductoryReview("official_document");
    review.plan.steps[0].status = "waiting_source";
    review.claims[0].citation.exactText = "";
    review.requirements[0].status = "supported";
    expect(introductoryPolicyReviewDiagnostic(
      review,
      "federal_rule",
    )).toEqual({
      status: "partial",
      artifactStatus: "current",
      evidenceSnapshotPresent: true,
      counts: {
        sources: 1,
        passages: 1,
        declaredClaims: 1,
        returnedClaims: 1,
      },
      expectedInstrumentFamily: "federal_rule",
      actualInstrumentFamily: "official_document",
      explanationRouteStatus: "waiting_source",
      policyExplanationPresent: true,
      sourceLinkedPolicyExplanation: false,
      preciseRoute: "confirmed_federal_register_record",
      preciseRouteStatus: null,
      sourceLinkedPrecisePolicyClaim: false,
      overviewQualityStatus: null,
      synthesisStatus: null,
      requirementCount: 2,
      requirementsAllUnsearched: false,
      requirementStatuses: ["not_yet_searched", "supported"],
    });
  });

  it.each(["searched", "waiting_source", "blocked"])(
    "retains independent evidence after a precise route is %s",
    (status) => {
      const review = introductoryReview("federal_rule");
      review.plan.steps[1].status = status;
      expect(policyEvidenceRouteStatus(
        review,
        "confirmed_federal_register_record",
      )).toBe(status);
      expect(isSourceBackedAttemptedPrecisePolicyReview(
        review,
        "federal_rule",
      )).toBe(true);
    },
  );

  it("rejects an untouched precise route and the wrong family-specific route", () => {
    const review = introductoryReview("federal_rule");
    expect(isSourceBackedAttemptedPrecisePolicyReview(
      review,
      "federal_rule",
    )).toBe(false);

    review.plan.steps[1].status = "searched";
    expect(isSourceBackedAttemptedPrecisePolicyReview(
      review,
      "official_document",
    )).toBe(false);
  });
});
