import { describe, expect, it } from "vitest";

import {
  SCREEN_04_RULE_AST_VERSION,
  evaluateScreen04ExposurePlan,
  evaluateScreen04RuleExpression,
  type Screen04ExposureRulePlan,
  type Screen04RuleExpression,
} from "../../src/core/screen04-rule-ast";

const eligibility: Screen04RuleExpression = {
  kind: "all",
  rules: [
    {
      kind: "categorical-equals",
      requirementId: "operating-location",
      csvColumn: "operating_state",
      value: "CA",
    },
    {
      kind: "numeric-threshold",
      requirementId: "historical-revenue",
      csvColumn: "revenue_2017_millions",
      operator: ">",
      threshold: 25,
      thresholdUnit: "USD millions",
      sourceUnit: "USD millions",
    },
    {
      kind: "not",
      rule: {
        kind: "categorical-equals",
        requirementId: "exemption",
        csvColumn: "exempt",
        value: "1",
      },
    },
  ],
};

describe("Screen 4 explicit typed rule AST", () => {
  it("evaluates AND and NOT from explicitly mapped values", () => {
    expect(evaluateScreen04RuleExpression(eligibility, {
      operating_state: "CA",
      revenue_2017_millions: "30",
      exempt: "0",
    })).toMatchObject({
      matched: true,
      unresolvedRequirementIds: [],
    });
    expect(evaluateScreen04RuleExpression(eligibility, {
      operating_state: "CA",
      revenue_2017_millions: "20",
      exempt: "0",
    }).matched).toBe(false);
  });

  it("uses three-valued logic and never converts missing requirements to false", () => {
    const allUnknown = evaluateScreen04RuleExpression(eligibility, {
      operating_state: "CA",
      revenue_2017_millions: "",
      exempt: "0",
    });
    expect(allUnknown).toMatchObject({
      matched: null,
      unresolvedRequirementIds: ["historical-revenue"],
    });

    const falseDominatesUnknown = evaluateScreen04RuleExpression(eligibility, {
      operating_state: "NV",
      revenue_2017_millions: "",
      exempt: "0",
    });
    expect(falseDominatesUnknown.matched).toBe(false);
    expect(falseDominatesUnknown.unresolvedRequirementIds).toEqual([
      "historical-revenue",
    ]);
  });

  it("makes numeric unit mismatch and malformed values unknown", () => {
    const threshold = (sourceUnit: string): Screen04RuleExpression => ({
      kind: "numeric-threshold",
      requirementId: "historical-revenue",
      csvColumn: "revenue",
      operator: ">=",
      threshold: 25,
      thresholdUnit: "USD millions",
      sourceUnit,
    });
    expect(evaluateScreen04RuleExpression(threshold("USD"), {
      revenue: "30000000",
    })).toMatchObject({
      matched: null,
      reasonCodes: ["SCREEN04_RULE_UNIT_MISMATCH"],
    });
    expect(evaluateScreen04RuleExpression(threshold("USD millions"), {
      revenue: "30 million",
    })).toMatchObject({
      matched: null,
      reasonCodes: ["SCREEN04_RULE_NUMERIC_VALUE_INVALID"],
    });
  });

  it("keeps components and versions separate before package-level classification", () => {
    const plan: Screen04ExposureRulePlan = {
      schemaVersion: SCREEN_04_RULE_AST_VERSION,
      components: [
        {
          componentId: "disclosure",
          componentLabel: "Disclosure duty",
          exposureVersion: "original",
          exposureStartYear: 2019,
          evidenceIds: ["evidence-disclosure"],
          expression: eligibility,
        },
        {
          componentId: "enforcement",
          componentLabel: "Enforcement",
          exposureVersion: "original",
          exposureStartYear: 2021,
          evidenceIds: ["evidence-enforcement"],
          expression: eligibility,
        },
      ],
    };
    const values = {
      operating_state: "CA",
      revenue_2017_millions: "30",
      exempt: "0",
    };
    expect(evaluateScreen04ExposurePlan(plan, 2018, values)).toMatchObject({
      status: "not_applicable",
      reasonCode: "SCREEN04_COMPONENTS_NOT_YET_APPLICABLE",
    });
    expect(evaluateScreen04ExposurePlan(plan, 2020, values)).toMatchObject({
      status: "exposed",
      components: [
        { componentId: "disclosure", status: "exposed" },
        { componentId: "enforcement", status: "not_applicable" },
      ],
    });
  });

  it("preserves an empty structural-only plan as unknown instead of throwing", () => {
    expect(evaluateScreen04ExposurePlan({
      schemaVersion: SCREEN_04_RULE_AST_VERSION,
      components: [],
    }, 2020, Object.create(null))).toEqual({
      status: "unknown",
      reasonCode: "SCREEN04_COMPONENT_REQUIREMENT_UNKNOWN",
      components: [],
    });
  });
});
