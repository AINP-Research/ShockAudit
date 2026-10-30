import { describe, expect, it } from "vitest";

import {
  assessPolicyTextQuality,
  normalizePolicyEvidenceText,
} from "../../src/core/six-screen/policy-text-normalization";
import { parseOfficialDocumentPolicyEvidence } from
  "../../src/core/six-screen/policy-review";

const uslm = `
  <uslm:document xmlns:uslm="http://xml.house.gov/schemas/uslm/1.0">
    <uslm:meta><dc:title>Machine metadata that is not operative text</dc:title></uslm:meta>
    <uslm:main>
      <uslm:section>
        <uslm:header>SEC. 101. DEFINITIONS.</uslm:header>
        <uslm:text>The term emerging growth company means an issuer that first sold common equity securities on or before December 8, 2011.</uslm:text>
      </uslm:section>
      <uslm:section>
        <uslm:header>SEC. 102. DISCLOSURE.</uslm:header>
        <uslm:text>An emerging growth company shall provide the Commission with the required disclosure.</uslm:text>
      </uslm:section>
      <uslm:section>
        <uslm:header>SEC. 103. RULEMAKING.</uslm:header>
        <uslm:text>The Commission shall revise its rules not later than 90 days after enactment.</uslm:text>
      </uslm:section>
      <uslm:section>
        <uslm:header>SEC. 104. AMENDMENT.</uslm:header>
        <uslm:text>Section 6(b) of the Securities Act is amended by striking an obsolete reference.</uslm:text>
      </uslm:section>
      <uslm:section>
        <uslm:header>EFFECTIVE DATE.</uslm:header>
        <uslm:text>This title shall take effect on the date of enactment of this Act.</uslm:text>
      </uslm:section>
      <uslm:section>
        <uslm:header>ENACTMENT.</uslm:header>
        <uslm:text>Approved April 5, 2012.</uslm:text>
      </uslm:section>
    </uslm:main>
  </uslm:document>`;

describe("policy legal-text normalization", () => {
  it("projects raw and escaped USLM into the same readable structure", () => {
    const raw = normalizePolicyEvidenceText(uslm);
    const escaped = normalizePolicyEvidenceText(
      uslm.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;"),
    );
    const doubleEscaped = normalizePolicyEvidenceText(
      uslm.replaceAll("&", "&amp;").replaceAll("<", "&amp;lt;")
        .replaceAll(">", "&amp;gt;"),
    );
    expect(raw).toBe(escaped);
    expect(raw).toBe(doubleEscaped);
    expect(raw).toContain("SEC. 101. DEFINITIONS.");
    expect(raw).toContain("Approved April 5, 2012.");
    expect(raw).not.toMatch(/<\/?(?:uslm:)?(?:document|section|text)\b/iu);
    expect(raw).not.toContain("Machine metadata");
    expect(assessPolicyTextQuality(raw)).toMatchObject({
      accepted: true,
      reason: "accepted",
    });
    expect(normalizePolicyEvidenceText(
      `<!DOCTYPE document SYSTEM "uslm.dtd">${uslm}`,
    )).toBe(raw);
  });

  it("keeps eligibility cutoffs, amendment syntax, and rulemaking apart from legal effect, baseline, and enforcement", () => {
    const parsed = parseOfficialDocumentPolicyEvidence({
      eventId: "jobs-act",
      sourceId: "govinfo-jobs-act-uslm",
      provider: "GovInfo",
      nativeId: "PLAW-112publ106",
      canonicalUrl: "https://www.govinfo.gov/content/pkg/PLAW-112publ106/uslm/PLAW-112publ106.xml",
      title: "Jumpstart Our Business Startups Act",
      publisher: "U.S. Government Publishing Office",
      issuer: "United States Congress",
      jurisdiction: "United States",
      publicationDate: "2012-04-05",
      retrievedAt: "2026-10-24T12:00:00.000Z",
      contentHash: "sha256:jobs-act-uslm-fixture",
      retainedText: uslm,
      representation: "xml",
      searchedRequirementKinds: [
        "operative_change", "previous_baseline", "coverage", "exemption",
        "temporal_stage", "version", "implementation", "enforcement",
        "penalty",
      ],
    });
    const claims = parsed.projections;
    expect(claims.every((claim) =>
      !/<\/?(?:uslm:)?[A-Za-z][^>]*>/u.test(
        `${claim.statement} ${claim.citation.exactText}`,
      ))).toBe(true);
    expect(claims.some(({ predicate }) =>
      predicate === "previous_baseline")).toBe(false);
    expect(claims.some(({ predicate }) =>
      predicate === "enforcement_authority")).toBe(false);
    expect(claims.some(({ predicate }) => predicate === "penalty")).toBe(false);
    const effectDates = claims.filter(({ predicate }) =>
      predicate === "legal_effect_date").map(({ typedValue }) =>
        (typedValue as { date: { start: string | null } }).date.start);
    expect(effectDates).toContain("2012-04-05");
    expect(effectDates).not.toContain("2011-12-08");
  });
});
