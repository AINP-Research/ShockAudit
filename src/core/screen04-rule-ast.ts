import type { Screen04ExposureStatus } from "./screen04-feasibility";

export const SCREEN_04_RULE_AST_VERSION = "screen-04-rule-ast-v1" as const;

export type Screen04RuleExpression =
  | {
      kind: "all";
      rules: readonly Screen04RuleExpression[];
    }
  | {
      kind: "any";
      rules: readonly Screen04RuleExpression[];
    }
  | {
      kind: "not";
      rule: Screen04RuleExpression;
    }
  | {
      kind: "categorical-equals";
      requirementId: string;
      csvColumn: string;
      value: string;
    }
  | {
      kind: "numeric-threshold";
      requirementId: string;
      csvColumn: string;
      operator: ">" | ">=" | "<" | "<=" | "=";
      threshold: number;
      thresholdUnit: string;
      sourceUnit: string;
    };

export type Screen04ExposureComponentRule = {
  componentId: string;
  componentLabel: string;
  exposureVersion: string;
  exposureStartYear: number;
  evidenceIds: readonly string[];
  expression: Screen04RuleExpression;
};

export type Screen04ExposureRulePlan = {
  schemaVersion: typeof SCREEN_04_RULE_AST_VERSION;
  /** Source-confirmed persistence only; absence never implies permanence. */
  exposurePersistence?: "permanent-once-exposed" | "may-change";
  components: readonly Screen04ExposureComponentRule[];
};

export type Screen04RuleReasonCode =
  | "SCREEN04_RULE_TRUE"
  | "SCREEN04_RULE_FALSE"
  | "SCREEN04_RULE_VALUE_MISSING"
  | "SCREEN04_RULE_NUMERIC_VALUE_INVALID"
  | "SCREEN04_RULE_UNIT_MISMATCH";

export type Screen04RuleEvaluation = {
  matched: boolean | null;
  reasonCodes: readonly Screen04RuleReasonCode[];
  evaluatedRequirementIds: readonly string[];
  unresolvedRequirementIds: readonly string[];
};

export type Screen04ComponentEvaluation = Screen04RuleEvaluation & {
  componentId: string;
  exposureVersion: string;
  exposureStartYear: number;
  status: Screen04ExposureStatus;
};

export type Screen04ExposurePlanEvaluation = {
  status: Screen04ExposureStatus;
  reasonCode:
    | "SCREEN04_COMPONENT_EXPOSED"
    | "SCREEN04_COMPONENTS_UNEXPOSED"
    | "SCREEN04_COMPONENT_REQUIREMENT_UNKNOWN"
    | "SCREEN04_COMPONENTS_NOT_YET_APPLICABLE";
  components: readonly Screen04ComponentEvaluation[];
};

type MutableEvaluation = {
  matched: boolean | null;
  reasonCodes: Screen04RuleReasonCode[];
  evaluatedRequirementIds: string[];
  unresolvedRequirementIds: string[];
};

function unique<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values));
}

function combine(
  matched: boolean | null,
  children: readonly MutableEvaluation[],
): MutableEvaluation {
  return {
    matched,
    reasonCodes: unique(children.flatMap((item) => item.reasonCodes)),
    evaluatedRequirementIds: unique(
      children.flatMap((item) => item.evaluatedRequirementIds),
    ),
    unresolvedRequirementIds: unique(
      children.flatMap((item) => item.unresolvedRequirementIds),
    ),
  };
}

function leaf(
  requirementId: string,
  matched: boolean | null,
  reasonCode: Screen04RuleReasonCode,
): MutableEvaluation {
  return {
    matched,
    reasonCodes: [reasonCode],
    evaluatedRequirementIds: [requirementId],
    unresolvedRequirementIds: matched === null ? [requirementId] : [],
  };
}

function numeric(value: string): number | null {
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function evaluateNode(
  expression: Screen04RuleExpression,
  selectedValues: Readonly<Record<string, string | undefined>>,
): MutableEvaluation {
  if (expression.kind === "all") {
    if (expression.rules.length === 0) {
      throw new Error("An all-rule must contain at least one child rule.");
    }
    const children = expression.rules.map((item) =>
      evaluateNode(item, selectedValues)
    );
    const matched = children.some((item) => item.matched === false)
      ? false
      : children.some((item) => item.matched === null)
        ? null
        : true;
    return combine(matched, children);
  }
  if (expression.kind === "any") {
    if (expression.rules.length === 0) {
      throw new Error("An any-rule must contain at least one child rule.");
    }
    const children = expression.rules.map((item) =>
      evaluateNode(item, selectedValues)
    );
    const matched = children.some((item) => item.matched === true)
      ? true
      : children.some((item) => item.matched === null)
        ? null
        : false;
    return combine(matched, children);
  }
  if (expression.kind === "not") {
    const child = evaluateNode(expression.rule, selectedValues);
    return {
      ...child,
      matched: child.matched === null ? null : !child.matched,
    };
  }
  const value = selectedValues[expression.csvColumn];
  if (value === undefined || value.trim().length === 0) {
    return leaf(
      expression.requirementId,
      null,
      "SCREEN04_RULE_VALUE_MISSING",
    );
  }
  if (expression.kind === "categorical-equals") {
    const matched = value === expression.value;
    return leaf(
      expression.requirementId,
      matched,
      matched ? "SCREEN04_RULE_TRUE" : "SCREEN04_RULE_FALSE",
    );
  }
  if (expression.sourceUnit !== expression.thresholdUnit) {
    return leaf(
      expression.requirementId,
      null,
      "SCREEN04_RULE_UNIT_MISMATCH",
    );
  }
  const number = numeric(value);
  if (number === null) {
    return leaf(
      expression.requirementId,
      null,
      "SCREEN04_RULE_NUMERIC_VALUE_INVALID",
    );
  }
  const matched =
    expression.operator === ">"
      ? number > expression.threshold
      : expression.operator === ">="
        ? number >= expression.threshold
        : expression.operator === "<"
          ? number < expression.threshold
          : expression.operator === "<="
            ? number <= expression.threshold
            : number === expression.threshold;
  return leaf(
    expression.requirementId,
    matched,
    matched ? "SCREEN04_RULE_TRUE" : "SCREEN04_RULE_FALSE",
  );
}

/** Evaluate AND/OR/NOT without converting missing or invalid values to false. */
export function evaluateScreen04RuleExpression(
  expression: Screen04RuleExpression,
  selectedValues: Readonly<Record<string, string | undefined>>,
): Screen04RuleEvaluation {
  return evaluateNode(expression, selectedValues);
}

/** Evaluate source-linked components separately before package-level exposure. */
export function evaluateScreen04ExposurePlan(
  plan: Screen04ExposureRulePlan,
  year: number,
  selectedValues: Readonly<Record<string, string | undefined>>,
): Screen04ExposurePlanEvaluation {
  if (plan.schemaVersion !== SCREEN_04_RULE_AST_VERSION) {
    throw new Error("Screen 4 exposure plan version is unsupported.");
  }
  if (!Number.isInteger(year)) {
    throw new Error("Screen 4 exposure plan requires an annual year.");
  }
  // A locked Event Card may support only the structural portion of a partial
  // audit because Screen 3 has no explicitly typed exposure rule. Preserve
  // that uncertainty instead of throwing or treating an empty plan as false.
  if (plan.components.length === 0) {
    return {
      status: "unknown",
      reasonCode: "SCREEN04_COMPONENT_REQUIREMENT_UNKNOWN",
      components: [],
    };
  }
  const components = plan.components.map((component): Screen04ComponentEvaluation => {
    if (!Number.isInteger(component.exposureStartYear)) {
      throw new Error("Every Screen 4 component requires an annual start year.");
    }
    if (year < component.exposureStartYear) {
      return {
        componentId: component.componentId,
        exposureVersion: component.exposureVersion,
        exposureStartYear: component.exposureStartYear,
        status: "not_applicable",
        matched: false,
        reasonCodes: [],
        evaluatedRequirementIds: [],
        unresolvedRequirementIds: [],
      };
    }
    const evaluation = evaluateScreen04RuleExpression(
      component.expression,
      selectedValues,
    );
    return {
      ...evaluation,
      componentId: component.componentId,
      exposureVersion: component.exposureVersion,
      exposureStartYear: component.exposureStartYear,
      status:
        evaluation.matched === true
          ? "exposed"
          : evaluation.matched === false
            ? "unexposed"
            : "unknown",
    };
  });
  if (components.every((item) => item.status === "not_applicable")) {
    return {
      status: "not_applicable",
      reasonCode: "SCREEN04_COMPONENTS_NOT_YET_APPLICABLE",
      components,
    };
  }
  if (components.some((item) => item.status === "exposed")) {
    return {
      status: "exposed",
      reasonCode: "SCREEN04_COMPONENT_EXPOSED",
      components,
    };
  }
  if (components.some((item) => item.status === "unknown")) {
    return {
      status: "unknown",
      reasonCode: "SCREEN04_COMPONENT_REQUIREMENT_UNKNOWN",
      components,
    };
  }
  return {
    status: "unexposed",
    reasonCode: "SCREEN04_COMPONENTS_UNEXPOSED",
    components,
  };
}
