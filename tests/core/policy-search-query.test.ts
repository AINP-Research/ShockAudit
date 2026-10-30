import { describe, expect, it } from "vitest";
import {
  policySearchQueryVariants,
  policySearchUrlCues,
} from "../../src/core/policy-search-query";

describe("shared policy search query expansion", () => {
  it("keeps the original name and adds bounded year, family and acronym cues", () => {
    const variants = policySearchQueryVariants({
      name: "State-Level Pay Transparency Laws (2021–2025)",
      aliases: ["Pay disclosure requirements"],
      maximum: 10,
    });
    expect(variants[0]).toBe(
      "State-Level Pay Transparency Laws (2021–2025)",
    );
    expect(variants).toContain("Pay Transparency Laws");
    expect(variants).toContain("Pay disclosure requirements");
    expect(variants).not.toContain("2021–2025");
    expect(new Set(variants).size).toBe(variants.length);
    expect(variants.length).toBeLessThanOrEqual(10);
  });

  it("extracts search cues from supplied official-style URLs", () => {
    expect(policySearchUrlCues([
      "https://leginfo.example.gov/faces/billNavClient.xhtml?bill_id=202120220SB331",
      "https://example.gov/policies/silenced-no-more-act-2021.html",
    ])).toEqual(expect.arrayContaining([
      "202120220SB331",
      expect.stringMatching(/silenced no more act 2021/iu),
    ]));
  });
});
