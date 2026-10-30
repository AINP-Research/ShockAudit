import { describe, expect, it } from "vitest";

import type {
  PolicyEvidenceRequirementKind,
  PolicyReviewClaimProjection,
} from "../../src/core/six-screen/contracts";
import { assessPolicyBriefingQuality } from
  "../../src/core/six-screen/policy-briefing-quality";
import { POLICY_EVIDENCE_REQUIREMENT_KINDS } from
  "../../src/core/six-screen/policy-evidence-plan";

function claim(
  predicate: PolicyReviewClaimProjection["predicate"],
  statement: string,
  typedValue: unknown = {},
): PolicyReviewClaimProjection {
  return {
    claimId: `claim-${predicate}`,
    predicate,
    statement,
    typedValue,
    supportStatus: "direct",
    qualification: null,
    citation: {
      passageId: `passage-${predicate}`,
      exactText: statement,
      locator: "Section 1",
      documentVersionId: "document-1",
      sourceId: "source-1",
      sourceTitle: "Official policy",
      canonicalUrl: "https://example.gov/policy",
      sourceRole: "controlling legal text",
      inspectedText: "full",
    },
  };
}

function requirements(status: "supported" | "not_yet_searched" = "supported") {
  return POLICY_EVIDENCE_REQUIREMENT_KINDS.map((kind) => ({ kind, status }));
}

describe("Screen 2 box-specific evidence quality", () => {
  it("accepts a rich one-source record without imposing a source-count minimum", () => {
    const value = assessPolicyBriefingQuality({
      assessedAt: "2026-09-17T10:00:00.000Z",
      requirements: requirements(),
      claims: [
        claim("policy_explanation", "The policy strengthens financial oversight and consumer protection by creating new safeguards across major financial markets."),
        claim("operative_change", "Covered financial companies must submit risk information and comply with the new supervisory requirements established by the policy."),
        claim("substantive_obligation", "The designated regulator must review systemic risks and may require corrective action from covered companies."),
        claim("coverage_condition", "The requirements apply to designated financial companies and specified market participants operating in the United States."),
        claim("exemption_rule", "The requirements do not apply to entities expressly excluded by the cited section."),
        claim("legal_effect_date", "The cited provisions took effect on July 21, 2010.", {
          date: { start: "2010-07-21", end: null, precision: "day",
            kind: "legal_effect", passageIds: ["passage-legal_effect_date"] },
        }),
        claim("implementation_schedule", "The regulator must issue implementing rules within 18 months after enactment."),
        claim("enforcement_authority", "The Commission may bring a civil action to enforce these requirements."),
        claim("penalty", "A civil penalty may be imposed for an intentional violation of the cited requirement."),
      ],
    });
    expect(value.boxes.every(({ status }) => status === "sufficient")).toBe(true);
    expect(value.readyForSynthesis).toBe(true);
    expect(value.requiresAdditionalSources).toBe(false);
  });

  it("names the precise gaps when a thin source cannot fill each box", () => {
    const value = assessPolicyBriefingQuality({
      assessedAt: "2026-09-17T10:00:00.000Z",
      requirements: requirements("not_yet_searched"),
      claims: [claim("policy_explanation",
        "The official page says that the policy concerns financial regulation but does not describe its operative provisions or covered entities.")],
    });
    expect(value.readyForSynthesis).toBe(false);
    expect(value.requiresAdditionalSources).toBe(true);
    expect(value.boxes.find(({ box }) => box === "what_changed"))
      .toMatchObject({ status: "missing",
        missingRequirementKinds: expect.arrayContaining([
          "operative_change" as PolicyEvidenceRequirementKind,
        ]) });
  });
});
