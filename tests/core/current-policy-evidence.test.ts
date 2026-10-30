import { describe, expect, it } from "vitest";
import { readCurrentPolicyEvidence } from
  "../../src/core/six-screen/current-policy-evidence";
import { createBrowserEventCardFixture } from
  "../browser/six-screen-event-card-review-fixture";

describe("current Screen 2 policy evidence", () => {
  it("keeps complete coverage and exception propositions beside dated source links", () => {
    const state = createBrowserEventCardFixture().state;
    const review = state.policyReview!;
    const coverage = review.claims.find((claim) =>
      claim.predicate === "coverage_condition")!;
    review.claims.push({ ...coverage, claimId: "claim-exception",
      predicate: "exemption_rule", statement:
        "Small operators are excluded from this market rule.",
      qualification: "The historic size rule still needs verification.",
      citation: { ...coverage.citation,
        sourceId: "source-other-official",
        documentVersionId: "version-other-official",
        versionLabel: "2020 consolidated version" } });
    const evidence = readCurrentPolicyEvidence(state);
    expect(evidence.coverageClaimIds).toContain(coverage.claimId);
    expect(evidence.exceptionClaimIds).toContain("claim-exception");
    expect(evidence.claims.find(({ id }) => id === "claim-exception"))
      .toMatchObject({ sourceId: "source-other-official",
        versionLabel: "2020 consolidated version",
        qualification: "The historic size rule still needs verification." });
    expect(evidence.chronology.find(({ stage }) =>
      stage === "legal_effect")).toMatchObject({
      date: { start: "2020-03-01", precision: "day" },
      claimIds: ["claim-effective"],
      sourceIds: ["source-provider-neutral-official-fixture"],
    });
  });

  it("reconstructs missing current briefings, retains conflicts, and excludes stale reviews", () => {
    const state = createBrowserEventCardFixture().state;
    const review = state.policyReview!;
    review.briefing = undefined;
    const dateClaim = review.claims.find((claim) =>
      claim.predicate === "legal_effect_date")!;
    dateClaim.supportStatus = "conflicting";
    const reconstructed = readCurrentPolicyEvidence(state);
    expect(reconstructed.chronologyOrigin).toBe("reconstructed_current_claims");
    expect(reconstructed.chronology.find(({ stage }) =>
      stage === "legal_effect")?.conflictIds).toContain(dateClaim.claimId);
    expect(reconstructed.claims.find(({ id }) =>
      id === dateClaim.claimId)?.sourceUrl)
      .toBe(dateClaim.citation.canonicalUrl);

    review.artifactStatus = "out_of_date";
    const stale = readCurrentPolicyEvidence(state);
    expect(stale.status).toBe("review_not_current");
    expect(stale.claims).toEqual([]);
    expect(stale.chronology).toEqual([]);

    review.artifactStatus = "current";
    review.identityFingerprint = "fnv1a64:deadbeefdeadbeef";
    const differentEpisode = readCurrentPolicyEvidence(state);
    expect(differentEpisode.status).toBe("not_researched");
    expect(differentEpisode.claims).toEqual([]);
  });

  it("keeps supplemental dated source claims omitted by the short briefing", () => {
    const state = createBrowserEventCardFixture().state;
    const review = state.policyReview!;
    const base = review.claims.find((claim) =>
      claim.predicate === "legal_effect_date")!;
    review.claims.push({ ...base, claimId: "claim-later-version",
      predicate: "historical_version_change",
      statement: "An amended version takes effect in 2022.",
      typedValue: { date: { start: "2022-01-01", end: null,
        kind: "amendment", precision: "day",
        passageIds: [base.citation.passageId] } },
      citation: { ...base.citation, documentVersionId: "amended-2022",
        versionLabel: "2022 amendment" } });
    const evidence = readCurrentPolicyEvidence(state);
    expect(evidence.chronology.map(({ stage }) => stage))
      .toContain("amendment");
    expect(evidence.chronology.find(({ stage }) => stage === "amendment"))
      .toMatchObject({ claimIds: ["claim-later-version"],
        documentVersionIds: ["amended-2022"] });
  });

  it("reads a partial old current review without its optional briefing metadata", () => {
    const state = createBrowserEventCardFixture().state;
    const review = state.policyReview!;
    review.briefing = undefined;
    review.requirements = undefined as unknown as typeof review.requirements;
    review.unresolved = undefined as unknown as typeof review.unresolved;
    const evidence = readCurrentPolicyEvidence(state);
    expect(evidence.chronology.find(({ stage }) =>
      stage === "legal_effect")?.date.start).toBe("2020-03-01");
    expect(evidence.requirements).toEqual([]);
    expect(evidence.unresolved).toContain(review.limitation);
  });
});
