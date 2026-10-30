import { describe, expect, it } from "vitest";

import type { PolicyReviewClaimProjection } from
  "../../src/core/six-screen/contracts";
import { createPolicyBriefing } from
  "../../src/core/six-screen/policy-review";
import {
  prepareScreen2PolicyInterpretation,
  requestScreen2PolicyInterpretationRepair,
  validateScreen2PolicyInterpretation,
} from "../../src/worker/screen2-openai-policy-interpretation";

const at = "2026-10-24T12:00:00.000Z";

function claim(
  id: string,
  predicate: PolicyReviewClaimProjection["predicate"],
  statement: string,
  typedValue: unknown = null,
): PolicyReviewClaimProjection {
  return {
    claimId: id,
    predicate,
    statement,
    typedValue,
    supportStatus: "direct",
    qualification: null,
    citation: {
      passageId: `passage-${id}`,
      exactText: statement,
      locator: `Section ${id}`,
      documentVersionId: "document-jobs-act",
      sourceId: "source-jobs-act",
      sourceTitle: "Jumpstart Our Business Startups Act",
      canonicalUrl: "https://www.govinfo.gov/content/pkg/PLAW-112publ106/html/PLAW-112publ106.htm",
      sourceRole: "official enacted public law",
      inspectedText: "full",
    },
  };
}

const claims = [
  claim("baseline", "previous_baseline",
    "Before enactment, an issuer had to provide three years of audited financial statements."),
  claim("duty", "operative_change",
    "An emerging growth company shall provide two years of audited financial statements."),
  claim("coverage", "coverage_condition",
    "The term emerging growth company means an issuer with total annual gross revenues below $1,000,000,000."),
  claim("effect", "legal_effect_date",
    "This title shall take effect on April 5, 2012.",
    { date: { start: "2012-04-05", end: null, precision: "day",
      kind: "legal_effect", passageIds: ["passage-effect"] } }),
  claim("authority", "enforcement_authority",
    "The Commission may bring a civil action to enforce this title."),
];

describe("Screen 2 bounded policy interpretation", () => {
  it("binds model slots back to server-owned claims and produces a hybrid briefing", () => {
    const prepared = prepareScreen2PolicyInterpretation({
      title: "Jumpstart Our Business Startups Act",
      claims,
    })!;
    expect(JSON.stringify(prepared.textFormat)).not.toContain("uniqueItems");
    const slot = (predicate: PolicyReviewClaimProjection["predicate"]) =>
      prepared.bindings.find((binding) =>
        binding.predicate === predicate)!.slotId;
    const schema = prepared.textFormat.schema as {
      properties: {
        sections: { properties: Record<string, {
          items: { properties: { claim_slots: {
            items: { enum?: string[] };
          } } };
        }> };
        accepted_timeline_slots: { items: { enum?: string[] } };
      };
    };
    expect(schema.properties.accepted_timeline_slots.items.enum)
      .toEqual([slot("legal_effect_date")]);
    expect(schema.properties.sections.properties.coverage.items.properties
      .claim_slots.items.enum).toEqual(
        prepared.bindings.map(({ slotId }) => slotId),
      );
    expect(schema.properties.sections.properties.enforcement.items.properties
      .claim_slots.items.enum).toEqual(
        prepared.bindings.map(({ slotId }) => slotId),
      );
    const result = validateScreen2PolicyInterpretation({
      overview: {
        text: "The Act reduced the audited-financial-statement history from three years to two years for an emerging growth company.",
        claim_slots: [slot("previous_baseline"), slot("operative_change")],
      },
      sections: {
        what_changed: [{
          label: "Disclosure history",
          text: "The cited provisions contrast three years before enactment with two years for the new category.",
          claim_slots: [slot("previous_baseline"), slot("operative_change")],
        }],
        coverage: [{
          label: "Covered issuer",
          text: "The cited definition uses annual gross revenues below $1,000,000,000.",
          claim_slots: [slot("coverage_condition")],
        }],
        enforcement: [{
          label: "Enforcing authority",
          text: "The Commission may bring a civil action to enforce the title.",
          claim_slots: [slot("enforcement_authority")],
        }],
      },
      accepted_timeline_slots: [slot("legal_effect_date")],
      unresolved_questions: [
        "Did later amendments change the revenue threshold?",
      ],
    }, prepared, at);

    expect(result.overviewClaimIds).toEqual(["baseline", "duty"]);
    expect(result.acceptedTimelineClaimIds).toEqual(["effect"]);
    expect(result.coverage[0]!.claimIds).toEqual(["coverage"]);
    const briefing = createPolicyBriefing({
      title: "Jumpstart Our Business Startups Act",
      claims,
      requirements: [
        { kind: "operative_change", status: "supported" },
        { kind: "previous_baseline", status: "supported" },
        { kind: "coverage", status: "supported" },
        { kind: "exemption", status: "not_applicable" },
        { kind: "temporal_stage", status: "supported" },
        { kind: "implementation", status: "not_applicable" },
        { kind: "enforcement", status: "supported" },
        { kind: "penalty", status: "not_applicable" },
      ],
      generatedAt: at,
      interpretation: result,
    });
    expect(briefing.mode).toBe("hybrid_validated_interpretation");
    expect(briefing.timeline).toHaveLength(1);
    expect(briefing.whatChanged.findings?.[0]).toMatchObject({
      label: "Disclosure history",
      claimIds: ["baseline", "duty"],
    });
    const timelineFallback = createPolicyBriefing({
      title: "Jumpstart Our Business Startups Act",
      claims,
      requirements: [],
      generatedAt: at,
      interpretation: { ...result, acceptedTimelineClaimIds: [] },
    });
    expect(timelineFallback.mode).toBe("hybrid_validated_interpretation");
    expect(timelineFallback.timeline).toHaveLength(1);
    expect(timelineFallback.timeline[0]!.claimIds).toContain("effect");
    const sectionFallback = createPolicyBriefing({
      title: "Jumpstart Our Business Startups Act",
      claims,
      requirements: [
        { kind: "operative_change", status: "supported" },
        { kind: "coverage", status: "supported" },
        { kind: "enforcement", status: "supported" },
      ],
      generatedAt: at,
      interpretation: {
        ...result,
        whatChanged: [],
        coverage: [],
        enforcement: [],
      },
    });
    expect(sectionFallback.whatChanged.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ claimIds: ["duty"] }),
      ]),
    );
    expect(sectionFallback.coverage.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ claimIds: ["coverage"] }),
      ]),
    );
    expect(sectionFallback.enforcement.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ claimIds: ["authority"] }),
      ]),
    );
  });

  it("rejects invented numbers but lets the model repair a deterministic label", () => {
    const prepared = prepareScreen2PolicyInterpretation({
      title: "Jumpstart Our Business Startups Act",
      claims,
    })!;
    const slot = (predicate: PolicyReviewClaimProjection["predicate"]) =>
      prepared.bindings.find((binding) =>
        binding.predicate === predicate)!.slotId;
    const base = {
      overview: {
        text: "The Act requires two years of audited financial statements.",
        claim_slots: [slot("operative_change")],
      },
      sections: {
        what_changed: [],
        coverage: [],
        enforcement: [],
      },
      accepted_timeline_slots: [slot("legal_effect_date")],
      unresolved_questions: [],
    };
    const invented = structuredClone(base);
    invented.overview.text =
      "The Act requires 5 years of audited financial statements.";
    expect(() => validateScreen2PolicyInterpretation(invented, prepared, at))
      .toThrow(/bounded evidence contract/iu);
    const mislabeled = claim(
      "mislabeled-change",
      "coverage_condition",
      "The Act amended restrictions on settlement and nondisparagement provisions.",
    );
    const semantic = prepareScreen2PolicyInterpretation({
      title: "Silenced No More Act",
      claims: [mislabeled],
    })!;
    const semanticSlot = semantic.bindings[0]!.slotId;
    const repairedLabel = validateScreen2PolicyInterpretation({
      overview: {
        text: "The Act amended restrictions on settlement and nondisparagement provisions.",
        claim_slots: [semanticSlot],
      },
      sections: {
        what_changed: [{
          label: "What changed",
          text: "The Act amended restrictions on settlement and nondisparagement provisions.",
          claim_slots: [semanticSlot],
        }],
        coverage: [],
        enforcement: [],
      },
      accepted_timeline_slots: [],
      unresolved_questions: [],
    }, semantic, at);
    expect(repairedLabel.whatChanged[0]!.claimIds)
      .toEqual(["mislabeled-change"]);
    const duplicate = structuredClone(base);
    duplicate.overview.claim_slots = [
      slot("operative_change"), slot("operative_change"),
    ];
    expect(validateScreen2PolicyInterpretation(
      duplicate, prepared, at,
    ).overviewClaimIds).toEqual(["duty"]);
    const missingTimeline = structuredClone(base);
    missingTimeline.accepted_timeline_slots = [];
    expect(() => validateScreen2PolicyInterpretation(
      missingTimeline, prepared, at,
    )).toThrow(/bounded evidence contract/iu);
    const missingTerminalPunctuation = structuredClone(base);
    missingTerminalPunctuation.overview.text =
      "The Act requires two years of audited financial statements";
    expect(validateScreen2PolicyInterpretation(
      missingTerminalPunctuation, prepared, at,
    ).overview).toBe(
      "The Act requires two years of audited financial statements.",
    );
  });

  it("rejects model prose that preserves broken citations or section-heading fragments", () => {
    const prepared = prepareScreen2PolicyInterpretation({
      title: "Jumpstart Our Business Startups Act",
      claims,
    })!;
    const duty = prepared.bindings.find(({ predicate }) =>
      predicate === "operative_change")!.slotId;
    const base = {
      overview: {
        text: "The Act requires two years of audited financial statements.",
        claim_slots: [duty],
      },
      sections: {
        what_changed: [],
        coverage: [],
        enforcement: [],
      },
      accepted_timeline_slots: [],
      unresolved_questions: [],
    };
    const broken = structuredClone(base);
    broken.sections.what_changed.push({
      label: "What changed",
      text: "An issuer (as defined under section 2(a) of the Act (15 U.S.C.",
      claim_slots: [duty],
    } as never);
    expect(() => validateScreen2PolicyInterpretation(broken, prepared, at))
      .toThrow(/bounded evidence contract/iu);

    const heading = structuredClone(base);
    heading.sections.what_changed.push({
      label: "What changed",
      text: "As used in this title, the following definitions shall apply:.",
      claim_slots: [duty],
    } as never);
    expect(() => validateScreen2PolicyInterpretation(heading, prepared, at))
      .toThrow(/bounded evidence contract/iu);
  });

  it("makes one bounded repair request with issue codes and validates the fresh response", async () => {
    const prepared = prepareScreen2PolicyInterpretation({
      title: "Jumpstart Our Business Startups Act",
      claims,
    })!;
    const slot = (predicate: PolicyReviewClaimProjection["predicate"]) =>
      prepared.bindings.find((binding) =>
        binding.predicate === predicate)!.slotId;
    const wire = {
      overview: {
        text: "The Act reduced the audited-financial-statement history from three years to two years for an emerging growth company.",
        claim_slots: [slot("previous_baseline"), slot("operative_change")],
      },
      sections: {
        what_changed: [{
          label: "Disclosure history",
          text: "The cited provisions contrast three years before enactment with two years for the new category.",
          claim_slots: [slot("previous_baseline"), slot("operative_change")],
        }],
        coverage: [],
        enforcement: [],
      },
      accepted_timeline_slots: [slot("legal_effect_date")],
      unresolved_questions: [],
    };
    const fetch = async (_url: RequestInfo | URL, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as {
        input: Array<{ content: Array<{ text: string }> }>;
        instructions: string;
      };
      const userData = JSON.parse(request.input[0]!.content[0]!.text) as {
        correction: { attempt: number; validation_issues: unknown[] };
      };
      expect(userData.correction).toEqual({
        attempt: 2,
        validation_issues: [{
          code: "incomplete_policy_prose",
          path: "$.overview.text",
        }],
      });
      expect(request.instructions).toContain("single permitted corrective retry");
      return new Response(JSON.stringify({
        id: "resp_screen2_repair",
        object: "response",
        status: "completed",
        model: "gpt-6-luna",
        service_tier: "default",
        output: [{
          id: "msg_screen2_repair",
          type: "message",
          role: "assistant",
          status: "completed",
          content: [{
            type: "output_text",
            annotations: [],
            text: JSON.stringify(wire),
          }],
        }],
        usage: {
          input_tokens: 500,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens: 160,
          output_tokens_details: { reasoning_tokens: 20 },
          total_tokens: 660,
        },
      }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "x-request-id": "screen2-repair-request",
          "x-ratelimit-reset-tokens": "1m",
          "x-ratelimit-remaining-tokens": "4000",
        },
      });
    };
    const repaired = await requestScreen2PolicyInterpretationRepair({
      apiKey: "secret-test-only",
      fetch,
      prepared,
      validationIssues: [{
        code: "incomplete_policy_prose",
        path: "$.overview.text",
      }],
      now: () => at,
    });
    expect(repaired.wire.overview).toContain("three years to two years");
    expect(repaired.usage).toMatchObject({
      promptTokens: 500,
      completionTokens: 160,
      totalTokens: 660,
    });
  });

  it("reserves model-packet capacity for timeline evidence in a dense policy", () => {
    const denseClaims = [
      ...Array.from({ length: 40 }, (_, index) => claim(
        `duty-${index + 1}`,
        "operative_change",
        `The policy requires covered entity ${index + 1} to provide a notice.`,
      )),
      claims.find(({ predicate }) => predicate === "legal_effect_date")!,
      claims.find(({ predicate }) => predicate === "coverage_condition")!,
      claims.find(({ predicate }) => predicate === "enforcement_authority")!,
    ];
    const prepared = prepareScreen2PolicyInterpretation({
      title: "Dense policy",
      claims: denseClaims,
    })!;
    expect(prepared.bindings).toHaveLength(40);
    expect(prepared.bindings.map(({ predicate }) => predicate)).toEqual(
      expect.arrayContaining([
        "operative_change",
        "coverage_condition",
        "legal_effect_date",
        "enforcement_authority",
      ]),
    );
    const schema = prepared.textFormat.schema as {
      properties: {
        accepted_timeline_slots: { minItems: number; items: {
          enum?: string[];
        } };
      };
    };
    expect(schema.properties.accepted_timeline_slots.minItems).toBe(1);
    expect(schema.properties.accepted_timeline_slots.items.enum).toHaveLength(1);
  });
  it("admits attributed explanatory passages for bounded high-level synthesis", () => {
    const attributed: PolicyReviewClaimProjection = {
      ...claim(
        "attributed-explanation",
        "policy_explanation",
        "The Silenced No More Act prohibits employers from using settlement and nondisparagement provisions to prevent disclosure of factual information about unlawful workplace conduct.",
      ),
      supportStatus: "indirect",
      qualification:
        "This attributed explanation supports introductory orientation only.",
      citation: {
        ...claim(
          "attributed-explanation",
          "policy_explanation",
          "The Silenced No More Act prohibits employers from using settlement and nondisparagement provisions to prevent disclosure of factual information about unlawful workplace conduct.",
        ).citation,
        sourceRole:
          "identity-bound attributed specialist analysis; explanatory evidence, not controlling legal authority",
      },
    };

    const prepared = prepareScreen2PolicyInterpretation({
      title: "California Silenced No More Act",
      claims: [attributed],
    });

    expect(prepared).not.toBeNull();
    expect(prepared!.bindings).toEqual([
      expect.objectContaining({
        claimId: "attributed-explanation",
        predicate: "policy_explanation",
      }),
    ]);
  });

});
