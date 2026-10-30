import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  SCREEN5_MECHANISM_ASSESSMENT_RESPONSE_FORMAT,
  SCREEN5_MECHANISM_PLANNING_RESPONSE_FORMAT,
  SCREEN5_PLAN_LIMITS,
  Screen5MechanismWireValidationError,
  normalizeScreen5MechanismPlanWire,
  validateScreen5MechanismPlanWire,
} from "../../src/worker/screen5-mechanism-contract";
import type { StudyFirstTheoreticalProblem } from
  "../../src/core/six-screen/study-first-mechanism-comparison";
import {
  SCREEN5_MECHANISM_PLAN_WIRE_VERSION,
  PREVIOUS_SCREEN5_MECHANISM_PLAN_WIRE_VERSION,
} from "../../src/core/six-screen/screen5-mechanism";

const proposal = {
  candidate_id: "organizational-cost",
  concept: "Organizational adjustment",
  chain: ["Policy duties", "Staff work", "Firm costs"],
  difference: "Costs can move without customer response.",
  condition: "Firms face adjustment costs.",
  direction: {
    mode: "single_hypothesis", target_outcome: "Firm performance",
    target_measure: "Return on assets",
    scenarios: [{ sign: "negative", condition: "Costs are not offset",
      rationale: "Firm performance may decrease.",
      intermediate_movement: "Higher costs", horizon: null }],
    missing_assumption: null,
  },
  evidence_need: "Dated adjustment costs.", terms: ["adjustment cost"],
};
const plan = { candidates: [proposal], open_xy_terms: [],
  challenge_terms: [], qualification: "Pre-retrieval hypothesis." };
function issues(value: unknown, version: string = SCREEN5_MECHANISM_PLAN_WIRE_VERSION) {
  try { validateScreen5MechanismPlanWire(value, version); }
  catch (caught) {
    expect(caught).toBeInstanceOf(Screen5MechanismWireValidationError);
    return (caught as Screen5MechanismWireValidationError).issues;
  }
  throw new Error("Expected bounded plan validation to fail.");
}

describe("provider-neutral Screen 5 scientific contract", () => {
  it("repairs only mechanical Stage A deviations before strict validation", () => {
    const problem = {
      outcome: { concept: "Firm performance", measure: "Return on assets" },
    } as StudyFirstTheoreticalProblem;
    const noisy = {
      ...plan,
      qualification: `  ${"bounded qualification ".repeat(100)}  `,
      candidates: [{
        ...proposal,
        candidate_id: "m0",
        concept: `  ${"Adjustment ".repeat(40)}  `,
        direction: {
          ...proposal.direction,
          target_outcome: "A different endpoint",
          target_measure: "A different measure",
          scenarios: [proposal.direction.scenarios[0], {
            ...proposal.direction.scenarios[0], sign: "positive",
          }],
          missing_assumption: "Should be null for a single hypothesis",
        },
      }],
    };
    const normalized = normalizeScreen5MechanismPlanWire(noisy, problem);
    const validated = validateScreen5MechanismPlanWire(normalized);
    expect(validated.candidates[0]).toMatchObject({
      candidate_id: "alternative-1",
      direction: {
        target_outcome: "Firm performance",
        target_measure: "Return on assets",
        missing_assumption: null,
      },
    });
    expect(validated.candidates[0]!.direction!.scenarios).toHaveLength(1);
    expect(validated.candidates[0]!.concept.length)
      .toBeLessThanOrEqual(SCREEN5_PLAN_LIMITS.concept);
    expect(validated.qualification.length)
      .toBeLessThanOrEqual(SCREEN5_PLAN_LIMITS.qualification);
    expect(() => validateScreen5MechanismPlanWire(
      normalizeScreen5MechanismPlanWire({
        ...plan,
        candidates: [{ ...proposal, chain: ["one", "two"] }],
      }, problem),
    )).toThrow(/bounded contract/u);
  });

  it("retains the frozen scientific schema subset with every object closed", () => {
    const inspect = (value: unknown): void => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return;
      const schema = value as Record<string, unknown>;
      expect(Object.keys(schema).every((key) => [
        "type",
        "properties",
        "required",
        "additionalProperties",
        "items",
        "enum",
        "minItems",
        "maxItems",
      ].includes(key))).toBe(true);
      if (schema.type === "object") {
        const properties = schema.properties as Record<string, unknown>;
        expect(schema.additionalProperties).toBe(false);
        expect([...(schema.required as string[])].sort()).toEqual(
          Object.keys(properties).sort(),
        );
        Object.values(properties).forEach(inspect);
      }
      if (schema.type === "array") inspect(schema.items);
    };

    inspect(SCREEN5_MECHANISM_PLANNING_RESPONSE_FORMAT.json_schema.schema);
    inspect(SCREEN5_MECHANISM_ASSESSMENT_RESPONSE_FORMAT.json_schema.schema);
  });

  it("keeps the unchanged domain validator fail-closed", () => {
    expect(() => validateScreen5MechanismPlanWire({
      candidates: [{
        concept: "A",
        chain: ["one", "two"],
        difference: "Different",
        evidence_need: "Evidence",
        terms: [],
      }],
      open_xy_terms: [],
      challenge_terms: [],
      qualification: "Qualification",
    })).toThrow(/bounded contract/u);
  });

  it("contains science only and exposes no provider request boundary", () => {
    const source = readFileSync(
      new URL("../../src/worker/screen5-mechanism-contract.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(/api\.[a-z0-9.-]+/iu);
    expect(source).not.toMatch(/authorization\s*:/iu);
    expect(source).not.toMatch(/export\s+(?:async\s+)?function\s+request/iu);
  });

  it("aligns provider array cardinalities with the saved local v4 contract", () => {
    const schema = SCREEN5_MECHANISM_PLANNING_RESPONSE_FORMAT.json_schema.schema;
    expect(schema.properties.candidates.maxItems).toBe(SCREEN5_PLAN_LIMITS.candidates);
    const chain = (schema.properties.candidates.items as {
      properties: { chain: { minItems: number; maxItems: number } };
    }).properties.chain;
    expect(chain.minItems).toBe(3);
    expect(chain.maxItems).toBe(5);
    expect(schema.properties.open_xy_terms.maxItems).toBe(8);
  });

  it("reports exact bounded paths without throwing on malformed nested values", () => {
    const broken = structuredClone(plan) as unknown as Record<string, unknown>;
    broken.candidates = [null, { ...proposal, chain: ["one", "two",
      "three", "four", "five", "six"] }, 4];
    expect(issues(broken)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "invalid_candidate_shape",
        path: "$.candidates[0]", stage: "planning" }),
      expect.objectContaining({ code: "array_length",
        path: "$.candidates[1].chain", max: 5, observedCountOrLength: 6 }),
    ]));
    expect(issues({ ...plan, candidates: [{ ...proposal,
      direction: { ...proposal.direction, scenarios: [null] } }] })[0]
      ?.path).toBe("$.candidates[0].direction.scenarios[0]");
  });

  it("keeps mode, length, IDs and historical versions distinct", () => {
    expect(validateScreen5MechanismPlanWire(plan)).toEqual(plan);
    expect(issues({ ...plan, candidates: [{ ...proposal,
      concept: "😀".repeat(121) }] })[0]).toMatchObject({
      code: "text_too_long", path: "$.candidates[0].concept",
      observedCountOrLength: 242,
    });
    expect(issues({ ...plan, candidates: [proposal,
      { ...proposal }] }).some((item) => item.code === "duplicate_candidate_id"))
      .toBe(true);
    expect(issues({ ...plan, candidates: [{ ...proposal,
      direction: { ...proposal.direction, mode: "under_specified" } }] })
      .map((item) => item.code)).toEqual(expect.arrayContaining([
        "under_specified_has_scenarios", "invalid_text",
      ]));
    const { direction: _direction, ...old } = proposal;
    expect(validateScreen5MechanismPlanWire({ ...plan, candidates: [old] },
      PREVIOUS_SCREEN5_MECHANISM_PLAN_WIRE_VERSION).candidates[0]?.direction)
      .toBeUndefined();
    expect(issues({ ...plan, candidates: [old] }, "unknown-v99")[0]
      ?.code).toBe("unknown_contract_version");
  });
});
