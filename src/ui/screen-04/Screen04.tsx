import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import {
  SCREEN_04_AUDIT_LIMITS,
  Screen04CoreError,
  inspectScreen04CsvHeader,
} from "../../core/screen04-feasibility";
import type { Screen04ExposureDimensionKind } from "../../core/screen04-event-card-binding";
import type { Screen04RuleExpression } from "../../core/screen04-rule-ast";
import {
  runScreen04ScientificAssessment,
  type Screen04ScientificAssessmentResult,
  type Screen04ScientificExposureRule,
  type Screen04ScientificFinding,
  type Screen04ScientificOverallJudgment,
  type Screen04SetupIssue,
  type Screen04VerifiedDateRole,
} from "../../core/screen04-scientific-assessment";
import {
  SCREEN_04_ASSIGNMENT_UNITS,
  SCREEN_04_COMPARISON_BASES,
  SCREEN_04_GEOGRAPHIC_CONCEPTS,
  screen04DatasetAssessmentReadiness,
  screen04NodataReadiness,
  type Screen04AssignmentCrosswalkStatus,
  type Screen04AssignmentUnit,
  type Screen04ComparisonBasis,
  type Screen04CombinedExposureScenario,
  type Screen04DatasetSampleProfile,
  type Screen04DatasetExposureMapping,
  type Screen04DatasetProfilePatch,
  type Screen04ExposureCondition,
  type Screen04ExposureConditionKind,
  type Screen04GeographicConcept,
  type Screen04NodataProfilePatch,
  type Screen04NumericOperator,
  type Screen04SampleProfile,
  type Screen04WithinAggregateExposure,
} from "../../core/screen04-sample-profile";
import {
  attachScreen04Upload,
  beginScreen04ScientificAssessment,
  failScreen04Workflow,
  recordScreen04ScientificAssessment,
  saveScreen04SampleProfile,
  screen04AssessmentInputFingerprint,
  switchScreen04Mode,
  updateScreen04DatasetProfile,
  updateScreen04NodataProfile,
  type Screen04WorkflowState,
} from "../../core/screen04-workflow";
import Screen04YearInput from "./Screen04YearInput";
import "./screen-04.css";

export type Screen04Props = {
  state: Screen04WorkflowState;
  onStateChange: (state: Screen04WorkflowState) => void;
  onBack: () => void;
  onStartFresh: () => void;
  onContinue?: (profile: Screen04SampleProfile) => void;
};

const calculationDeadlineMs = 15_000;
const localFileLifetimeMs = 60 * 60 * 1_000;
const maximumConditions = 8;

export type Screen04OperationStateGuard = {
  runId: string;
  revision: number;
  stateFingerprint: string;
  bindingFingerprint: string;
  status: Screen04WorkflowState["status"];
};

export function screen04OperationStateGuard(
  state: Screen04WorkflowState,
): Screen04OperationStateGuard {
  return {
    runId: state.runId,
    revision: state.revision,
    stateFingerprint: state.integrity.stateFingerprint,
    bindingFingerprint: state.eventCardBinding.bindingFingerprint,
    status: state.status,
  };
}

export function screen04OperationStateIsCurrent(
  started: Screen04OperationStateGuard,
  current: Screen04OperationStateGuard,
): boolean {
  return started.runId === current.runId &&
    started.revision === current.revision &&
    started.stateFingerprint === current.stateFingerprint &&
    started.bindingFingerprint === current.bindingFingerprint &&
    started.status === current.status &&
    current.status !== "stale";
}

export function screen04TransientHeaderReadiness(
  dataset: Screen04DatasetSampleProfile,
  headers: readonly string[],
) {
  const exactHeaders = new Set(headers);
  const fields = dataset.fieldMappings;
  const exposure = dataset.exposureMapping;
  const mappedColumns = [
    fields.unitIdentifier,
    fields.annualTime,
    fields.treatmentGroup,
    fields.organizationName,
    fields.geography,
    fields.assignmentLowerLevelIdentifier,
    fields.assignmentAggregateIdentifier,
    ...Object.values(fields.exposureFields),
    ...(exposure?.approach === "coverage-variable"
      ? [exposure.column]
      : exposure?.approach === "conditions"
        ? exposure.conditions.flatMap((condition) => [
            condition.column,
            ...condition.nestedAnyGroup.map((nested) => nested.column),
          ])
        : []),
  ].filter((column): column is string => Boolean(column));
  const ready = mappedColumns.every((column) => exactHeaders.has(column));
  return {
    ready,
    missingMappings: ready ? [] : ["CSV column mapping"],
  } as const;
}

export function screen04LocalAssessmentMayRender(
  state: Screen04WorkflowState,
  assessment: Screen04ScientificAssessmentResult | null,
) {
  return state.status === "assessment-complete" &&
    assessment !== null &&
    assessment.metrics !== null &&
    !assessment.setupIssues.some((issue) => issue.blocking);
}

const comparisonBasisLabels: Record<Screen04ComparisonBasis, string> = {
  geography: "Geography",
  industry: "Industry",
  "size-or-threshold": "Size or threshold",
  "organization-type": "Organization type",
  "legal-eligibility": "Legal eligibility",
  "staggered-adoption": "Staggered adoption",
  "another-distinction": "Another distinction",
};

const geographicConceptLabels: Record<Screen04GeographicConcept, string> = {
  headquarters: "Headquarters",
  "operating-location": "Operating location",
  incorporation: "Incorporation",
  residence: "Residence",
  "establishment-or-facility-location": "Establishment or facility location",
  "another-geographic-concept": "Another geographic concept",
};

const assignmentUnitLabels: Record<Screen04AssignmentUnit, string> = {
  firm: "Firm",
  "parent-company": "Parent company",
  subsidiary: "Subsidiary",
  establishment: "Establishment",
  facility: "Facility",
  individual: "Individual",
  "geographic-area": "Geographic area",
  "another-unit": "Another unit",
};

const dimensionLabels: Record<Screen04ExposureDimensionKind, string> = {
  geography: "Geography",
  "organization-type": "Eligible organization type",
  threshold: "Threshold or qualifying condition",
  exemption: "Exemption",
  "implementation-stage": "Implementation stage",
  "treatment-component": "Treatment component",
  "amendment-version": "Amendment or version",
};

function isStagedDimension(
  dimension: Screen04ExposureDimensionKind,
) {
  return dimension === "implementation-stage" ||
    dimension === "treatment-component" ||
    dimension === "amendment-version";
}

const conditionKindLabels: Record<Screen04ExposureConditionKind, string> = {
  "categorical-equals": "Category equals a value",
  "numeric-threshold": "Numeric threshold",
  exemption: "Explicit exemption",
  "effective-year": "Effective year",
};

function now() {
  return new Date().toISOString();
}

function future(from: string, milliseconds: number) {
  return new Date(Date.parse(from) + milliseconds).toISOString();
}

function opaqueReference(prefix: string) {
  const id = globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${id}`;
}

function readerErrorMessage(error: unknown) {
  if (error instanceof Screen04CoreError) {
    if (error.code === "SCREEN04_FILE_LIMIT_EXCEEDED") {
      return "This CSV is larger than the supported file limit. Create a smaller sample extract and try again.";
    }
    if (error.code === "SCREEN04_MALFORMED_CSV") {
      return "This file is not a valid CSV. Save it as UTF-8 CSV and try again.";
    }
    if (error.code === "SCREEN04_DUPLICATE_HEADER") {
      return "The CSV contains a duplicate column name. Rename the duplicate before continuing.";
    }
  }
  if (error instanceof Error && error.message.length <= 600) return error.message;
  return "ShockAudit could not complete this step. Your sample description was preserved.";
}

async function withDeadline<T>(promise: Promise<T>, label: string): Promise<T> {
  let timeout: number | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeout = window.setTimeout(
          () => reject(new Error(`${label} took too long. Your entries were preserved; try again with a smaller CSV.`)),
          calculationDeadlineMs,
        );
      }),
    ]);
  } finally {
    if (timeout !== undefined) window.clearTimeout(timeout);
  }
}

function verifiedDateRole(stage: string): Screen04VerifiedDateRole {
  if (
    stage === "announcement" || stage === "enactment" ||
    stage === "effective" || stage === "implementation" ||
    stage === "enforcement" || stage === "amendment"
  ) return stage;
  return "other";
}

function judgmentStatusClass(judgment: Screen04ScientificOverallJudgment) {
  return judgment.startsWith("Revise") ? "revise" :
    judgment.startsWith("Fix") ? "fix" :
      judgment.startsWith("More") ? "more" :
        judgment.startsWith("Review") ? "review" : "usable";
}

function newCondition(
  dimension: Screen04ExposureDimensionKind,
): Screen04ExposureCondition {
  return {
    id: `condition-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    dimension,
    stageGroup: null,
    kind: dimension === "threshold" ? "numeric-threshold" :
      dimension === "exemption" ? "exemption" : "categorical-equals",
    column: null,
    operator: dimension === "threshold" ? ">=" : null,
    value: null,
    unit: null,
    sourceUnit: null,
    historicalYear: null,
    mappedHistoricalYear: null,
    historicalValueSource: "column-values",
    effectiveYear: null,
    nestedAnyGroup: [],
  };
}

function conditionExpression(
  condition: Screen04ExposureCondition,
): Screen04RuleExpression | null {
  if (condition.kind === "effective-year") return null;
  if (!condition.column) return null;
  if (condition.kind === "numeric-threshold") {
    const threshold = typeof condition.value === "number"
      ? condition.value
      : condition.value !== null && condition.value !== ""
        ? Number(condition.value)
        : Number.NaN;
    if (!condition.operator || !Number.isFinite(threshold) || !condition.unit) {
      return null;
    }
    if (condition.nestedAnyGroup.some((item) =>
      !item.column || !item.operator || item.threshold === null || !item.unit
    )) return null;
    const requirementPrefix = `${condition.dimension}:`;
    const base: Screen04RuleExpression = {
      kind: "numeric-threshold",
      requirementId: `${requirementPrefix}${condition.id}`,
      csvColumn: condition.column,
      operator: condition.operator,
      threshold,
      thresholdUnit: condition.unit,
      sourceUnit: condition.sourceUnit ?? condition.unit,
    };
    const alternatives = condition.nestedAnyGroup.flatMap((item) =>
      item.column && item.operator && item.threshold !== null && item.unit
        ? [{
            kind: "numeric-threshold" as const,
            requirementId: `${requirementPrefix}${item.id}`,
            csvColumn: item.column,
            operator: item.operator,
            threshold: item.threshold,
            thresholdUnit: item.unit,
            sourceUnit: item.sourceUnit ?? item.unit,
          }]
        : []
    );
    return alternatives.length > 0
      ? { kind: "any", rules: [base, ...alternatives] }
      : base;
  }
  if (condition.value === null || String(condition.value).length === 0) return null;
  const categorical: Screen04RuleExpression = {
    kind: "categorical-equals",
    requirementId: `${condition.dimension}:${condition.id}`,
    csvColumn: condition.column,
    value: String(condition.value),
  };
  return condition.kind === "exemption"
    ? { kind: "not", rule: categorical }
    : categorical;
}

function incompleteConditionExpression(
  condition: Screen04ExposureCondition,
): Screen04RuleExpression {
  return {
    kind: "categorical-equals",
    requirementId: `${condition.dimension}:${condition.id}`,
    // Keep an unfinished numeric/exemption/category rule unmistakably
    // incomplete; never reinterpret it as a different rule kind.
    csvColumn: "",
    value: "",
  };
}

function thresholdMeasurements(
  conditions: readonly Screen04ExposureCondition[],
) {
  return conditions.flatMap((condition) => {
    if (
      condition.kind !== "numeric-threshold" || !condition.column ||
      condition.value === null || !condition.unit
    ) return [];
    const threshold = Number(condition.value);
    if (!Number.isFinite(threshold)) return [];
    return [{
      csvColumn: condition.column,
      threshold,
      thresholdUnit: condition.unit,
      sourceUnit: condition.sourceUnit ?? condition.unit,
      requiredHistoricalMeasurementYear: condition.historicalYear,
      mappedHistoricalMeasurementYear: condition.mappedHistoricalYear,
      historicalValueSource: condition.historicalValueSource ?? "column-values",
    }, ...condition.nestedAnyGroup.flatMap((item) =>
      item.column && item.threshold !== null && item.unit
        ? [{
            csvColumn: item.column,
            threshold: item.threshold,
            thresholdUnit: item.unit,
            sourceUnit: item.sourceUnit ?? item.unit,
            requiredHistoricalMeasurementYear: item.historicalYear,
            mappedHistoricalMeasurementYear: item.mappedHistoricalYear,
            historicalValueSource: item.historicalValueSource ?? "column-values",
          }]
        : []
    )];
  });
}

function conditionRule(
  conditions: readonly Screen04ExposureCondition[],
  combination: "all" | "any",
  treatmentYear: number,
  metadata: Pick<Screen04ScientificExposureRule, "label" | "component" | "version"> = {},
): Screen04ScientificExposureRule | null {
  const substantive = conditions.filter(
    (condition) => condition.kind !== "effective-year",
  );
  if (substantive.length === 0) return null;
  const expressions = substantive.map((condition) =>
    conditionExpression(condition) ?? incompleteConditionExpression(condition)
  );
  const explicitYears = Array.from(new Set([
    ...conditions.filter((condition) => condition.kind === "effective-year")
      .map((condition) => condition.effectiveYear),
    ...substantive.map((condition) => condition.effectiveYear),
  ].filter((year): year is number => year !== null)));
  // A single rule cannot truthfully collapse different effective years.
  // The engine translates this non-integer marker into one nonblocking setup
  // message while continuing timing and sample-structure checks.
  const effectiveYear = explicitYears.length > 1
    ? Number.NaN
    : explicitYears[0] ?? treatmentYear;
  return {
    approach: "conditions",
    expression: expressions.length === 1
      ? expressions[0]!
      : { kind: combination, rules: expressions },
    effectiveYear,
    label: metadata.label ?? "Researcher-confirmed exposure conditions",
    ...(metadata.component ? { component: metadata.component } : {}),
    ...(metadata.version ? { version: metadata.version } : {}),
    thresholdMeasurements: thresholdMeasurements(substantive),
  };
}

export function screen04CompileExposureRules(
  mapping: Screen04DatasetExposureMapping | null,
  treatmentYear: number,
): {
  exposureRule: Screen04ScientificExposureRule | null;
  additionalExposureRules: readonly Screen04ScientificExposureRule[];
} {
  if (mapping === null) {
    return { exposureRule: null, additionalExposureRules: [] };
  }
  if (mapping.approach === "coverage-variable") {
    return {
      exposureRule: !mapping.column || !mapping.coveredValue
        ? null
        : {
            approach: "coverage-variable",
            column: mapping.column,
            coveredValue: mapping.coveredValue,
            effectiveYear: treatmentYear,
            label: "Researcher-confirmed coverage variable",
          },
      additionalExposureRules: [],
    };
  }
  const stagedTiming = mapping.conditions.filter(
    (condition) => condition.kind === "effective-year" &&
      isStagedDimension(condition.dimension) &&
      Boolean(condition.stageGroup?.trim()),
  );
  const globalTiming = mapping.conditions.filter(
    (condition) => condition.kind === "effective-year" &&
      !stagedTiming.includes(condition),
  );
  const staged = mapping.conditions.filter((condition) =>
    isStagedDimension(condition.dimension) &&
    (condition.kind !== "effective-year" || stagedTiming.includes(condition))
  );
  let focal = mapping.conditions.filter((condition) => !staged.includes(condition));
  const stageGroups = new Map<string, {
    dimension: Screen04ExposureDimensionKind;
    effectiveYear: number;
    stageGroup: string;
    conditions: Screen04ExposureCondition[];
  }>();
  for (const condition of staged) {
    const effectiveYear = condition.effectiveYear ?? treatmentYear;
    const stageGroup = condition.stageGroup?.trim() || condition.id;
    // The reader-provided stage name defines membership. Dimension affects
    // the label only; a stage may legitimately contain implementation,
    // component, amendment, and timing conditions together.
    const key = stageGroup;
    const group = stageGroups.get(key) ?? {
      dimension: condition.dimension,
      effectiveYear,
      stageGroup,
      conditions: [],
    };
    group.conditions.push(condition);
    if (condition.effectiveYear !== null) {
      group.effectiveYear = condition.effectiveYear;
    }
    if (condition.dimension === "amendment-version") {
      group.dimension = condition.dimension;
    }
    stageGroups.set(key, group);
  }
  const later = [...stageGroups.values()].sort(
    (left, right) => left.effectiveYear - right.effectiveYear,
  );
  if (focal.every((condition) => condition.kind === "effective-year")) {
    const first = later.shift();
    if (first) focal = [...globalTiming, ...first.conditions];
  }
  return {
    exposureRule: conditionRule(
      focal,
      mapping.combination,
      treatmentYear,
    ),
    additionalExposureRules: later.flatMap((group) => {
      const rule = conditionRule(
        group.conditions,
        mapping.combination,
        treatmentYear,
        {
          label: `Researcher-confirmed ${dimensionLabels[group.dimension].toLocaleLowerCase("en-US")}`,
          ...(group.dimension === "amendment-version"
            ? { version: group.stageGroup }
            : { component: group.stageGroup }),
        },
      );
      return rule ? [rule] : [];
    }),
  };
}

export function screen04CombinedExposureScenarioInput(
  value: Screen04CombinedExposureScenario | null,
  mappedRuleCount: number,
): readonly { name: string; ruleIndexes: readonly number[] }[] {
  const name = value?.name?.trim() ?? "";
  if (
    !name ||
    name.length > 200 ||
    !value ||
    mappedRuleCount > 7 ||
    value.ruleIndexes.length < 2 ||
    value.ruleIndexes.length > 8 ||
    value.ruleIndexes.some((index) =>
      !Number.isSafeInteger(index) || index < 0 || index >= mappedRuleCount
    ) ||
    new Set(value.ruleIndexes).size !== value.ruleIndexes.length
  ) return [];
  return [{
    name,
    ruleIndexes: [...value.ruleIndexes].sort((left, right) => left - right),
  }];
}

function HeaderSelect({
  id,
  label,
  value,
  headers,
  required = false,
  issue,
  onChange,
}: {
  id: string;
  label: string;
  value: string | null;
  headers: readonly string[];
  required?: boolean;
  issue?: Screen04SetupIssue;
  onChange: (value: string | null) => void;
}) {
  const missingSavedValue = Boolean(value && !headers.includes(value));
  return (
    <label className="s4-field" htmlFor={id}>
      <span>{label}{required ? " *" : ""}</span>
      <select
        id={id}
        value={value ?? ""}
        required={required}
        aria-invalid={Boolean(issue || missingSavedValue)}
        aria-describedby={issue || missingSavedValue ? `${id}-message` : undefined}
        onChange={(event) => onChange(event.currentTarget.value || null)}
      >
        <option value="">{required ? "Select an exact CSV column" : "Not mapped"}</option>
        {missingSavedValue && <option value={value!}>{value} (not found)</option>}
        {headers.map((header) => <option key={header} value={header}>{header}</option>)}
      </select>
      {(issue || missingSavedValue) && (
        <span
          id={`${id}-message`}
          className="s4-inline-message s4-inline-message--error"
          data-testid="screen04-setup-message"
        >
          <strong>{issue?.title ?? "Column not found"}</strong>
          {issue?.message ?? `The selected column ${value} is not in this CSV. Select the exact column name.`}
        </span>
      )}
    </label>
  );
}

function FieldMessage({ issue }: { issue: Screen04SetupIssue | undefined }) {
  if (!issue) return null;
  return (
    <span
      className={`s4-inline-message s4-inline-message--${issue.blocking ? "error" : "warning"}`}
      data-testid="screen04-setup-message"
    >
      <strong>{issue.title}</strong>
      {issue.message}
    </span>
  );
}

function RequiredMessage({ show, label }: { show: boolean; label: string }) {
  if (!show) return null;
  return (
    <span
      className="s4-inline-message s4-inline-message--error"
      data-testid="screen04-setup-message"
    >
      <strong>{label} is required</strong>
      Complete this field before assessing the dataset.
    </span>
  );
}

function SelectOptions<T extends string>({
  values,
  labels,
}: {
  values: readonly T[];
  labels: Record<T, string>;
}) {
  return values.map((value) => <option key={value} value={value}>{labels[value]}</option>);
}

function FindingCard({
  finding,
  surface,
}: {
  finding: Screen04ScientificFinding;
  surface: "priority" | "other";
}) {
  const affected = finding.whereItOccurs;
  const severity = finding.severity ?? (
    finding.priority === "high"
      ? "Major design concern"
      : finding.priority === "medium"
        ? "Review before analysis"
        : "Informational"
  );
  const readerToken = (value: string) => value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace("assignment unit", "assignment level")
    .replace("multi condition", "more than one condition");
  return (
    <article className="s4-finding" data-testid={`screen04-${surface}-finding`}>
      <span className="s4-severity">{severity}</span>
      <h4>{finding.diagnosticTitle ?? finding.title}</h4>
      {finding.diagnosticTitle && <p className="s4-finding-issue"><strong>{finding.title}</strong></p>}
      {finding.aggregate && (
        <p className="s4-finding-aggregate">
          <strong>Affected evidence:</strong>{" "}
          {finding.aggregate.affectedUnits.toLocaleString("en-US")} affected {finding.aggregate.affectedUnits === 1 ? "unit" : "units"}; {finding.aggregate.affectedObservations.toLocaleString("en-US")} affected unit-period {finding.aggregate.affectedObservations === 1 ? "observation" : "observations"}; {(finding.aggregate.shareOfReferenceObservations * 100).toLocaleString("en-US", { maximumFractionDigits: 1 })}% of the reference-scenario observations.
        </p>
      )}
      <dl>
        <div><dt>What ShockAudit found</dt><dd>{finding.whatFound}</dd></div>
        <div><dt>Why it matters</dt><dd>{finding.whyItMatters}</dd></div>
        {affected && (affected.details.length > 0 || affected.truncatedDetailCount > 0) && (
          <div>
            <dt>Where it occurs</dt>
            <dd>
              <details className="s4-affected-details">
                <summary>Review affected units, periods, and treatment stages</summary>
                {affected.details.length > 0 && (
                  <ul>
                    {affected.details.map((detail, index) => (
                      <li key={`${detail.scenarioName}-${detail.unitIdentifier}-${detail.year}-${index}`}>
                        <strong>{detail.unitIdentifier}</strong>, {detail.year}: proposed {readerToken(detail.proposedGroup)}, assessed {readerToken(detail.auditedStatus)} in {detail.scenarioName} ({readerToken(detail.treatmentStage)})
                        {detail.reasonCategories.length > 0
                          ? ` — ${detail.reasonCategories.map(readerToken).join(", ")}`
                          : ""}.
                      </li>
                    ))}
                  </ul>
                )}
                {affected.truncatedDetailCount > 0 && (
                  <p>{affected.truncatedDetailCount.toLocaleString("en-US")} additional affected records are omitted from this bounded detail list.</p>
                )}
              </details>
            </dd>
          </div>
        )}
        <div>
          <dt>Possible next step</dt>
          <dd>{finding.possibleNextStep ?? "No automatic correction is recommended. Review this issue against the intended treatment definition and theoretical claim."}</dd>
        </div>
      </dl>
    </article>
  );
}

function FindingsByCategory({
  findings,
  surface = "priority",
}: {
  findings: readonly Screen04ScientificFinding[];
  surface?: "priority" | "other";
}) {
  const groups = findings.reduce<Array<{
    category: Screen04ScientificFinding["category"];
    findings: Screen04ScientificFinding[];
  }>>((result, finding) => {
    const last = result.at(-1);
    if (last?.category === finding.category) {
      last.findings.push(finding);
    } else {
      result.push({ category: finding.category, findings: [finding] });
    }
    return result;
  }, []);
  return (
    <div className="s4-finding-groups">
      {groups.map((group, groupIndex) => (
          <section className="s4-finding-group" key={`${group.category}-${groupIndex}`}>
            <h3>{group.category}</h3>
            <div className="s4-findings">
              {group.findings.map((finding, index) => (
                <FindingCard key={`${group.category}-${finding.title}-${index}`} finding={finding} surface={surface} />
              ))}
            </div>
          </section>
      ))}
    </div>
  );
}

function ResearcherChoices({ choices }: { choices: readonly string[] }) {
  if (choices.length === 0) return null;
  return (
    <section className="s4-choices" aria-labelledby="s4-choices-title">
      <h3 id="s4-choices-title">Choices to confirm</h3>
      <ul>{choices.map((choice) => <li key={choice}>{choice}</li>)}</ul>
    </section>
  );
}

function DatasetResults({
  result,
  coverageMatchingIncluded,
}: {
  result: Screen04ScientificAssessmentResult;
  coverageMatchingIncluded: boolean;
}) {
  const statusClass = judgmentStatusClass(result.overallJudgment);
  return (
    <section className="s4-results" aria-labelledby="s4-results-title" data-testid="screen04-results">
      <div className={`s4-status s4-status--${statusClass}`} role="status" aria-live="polite">
        <span className="s4-kicker">Natural-experiment sample assessment</span>
        <h2 id="s4-results-title">{result.overallJudgment}</h2>
      </div>
      {result.metrics && <AssessmentProvenance
        rows={result.metrics.rowCount}
        units={result.metrics.treated.uniqueUnits + result.metrics.comparison.uniqueUnits}
        firstYear={result.metrics.observedYearRange.earliest}
        lastYear={result.metrics.observedYearRange.latest}
      />}
      {!coverageMatchingIncluded && (
        <p className="s4-coverage-note">Coverage matching was not included in this assessment.</p>
      )}
      {result.metrics && (
        <dl className="s4-metrics" aria-label="Sample support summary">
          <div><dt>Treated units</dt><dd>{result.metrics.treated.uniqueUnits.toLocaleString("en-US")}</dd></div>
          <div><dt>Comparison units</dt><dd>{result.metrics.comparison.uniqueUnits.toLocaleString("en-US")}</dd></div>
          <div><dt>Treated pre-treatment years</dt><dd>{result.metrics.treated.preTreatmentYears}</dd></div>
          <div><dt>Comparison pre-treatment years</dt><dd>{result.metrics.comparison.preTreatmentYears}</dd></div>
          <div><dt>Treated post-treatment years</dt><dd>{result.metrics.treated.postTreatmentYears}</dd></div>
          <div><dt>Comparison post-treatment years</dt><dd>{result.metrics.comparison.postTreatmentYears}</dd></div>
        </dl>
      )}
      {result.priorityFindings.length > 0 ? (
        <>
          <h3>Priority findings</h3>
          <FindingsByCategory findings={result.priorityFindings.slice(0, 5)} />
        </>
      ) : result.setupIssues.every((issue) => !issue.blocking) ? (
        <p>No major exposure-design problem was identified by the available deterministic checks.</p>
      ) : null}
      {result.otherFindings.length > 0 && (
        <details className="s4-other-findings">
          <summary>Other points to review</summary>
          <FindingsByCategory findings={result.otherFindings} surface="other" />
        </details>
      )}
      <ResearcherChoices choices={result.unresolvedResearcherChoices} />
    </section>
  );
}

function AssessmentProvenance({ rows, units, firstYear, lastYear }: {
  rows: number;
  units: number;
  firstYear: number;
  lastYear: number;
}) {
  return <p className="s4-provenance" data-testid="screen04-assessment-provenance"><strong>Assessment based on {rows.toLocaleString("en-US")} rows, {units.toLocaleString("en-US")} units, and annual data from {firstYear} to {lastYear}.</strong></p>;
}

type Screen04AssessmentActionState =
  | "incomplete-setup"
  | "ready"
  | "assessing"
  | "assessment-complete"
  | "assessment-error"
  | "rerun-required";

function DatasetAssessmentActionBar({
  actionState,
  canAssess,
  noFile = false,
}: {
  actionState: Screen04AssessmentActionState;
  canAssess: boolean;
  noFile?: boolean;
}) {
  const title = noFile
    ? "Choose a CSV to begin"
    : actionState === "assessing"
      ? "Assessing your sample…"
      : actionState === "assessment-error"
        ? "Correct the highlighted setup"
        : actionState === "rerun-required"
          ? "Your sample setup changed"
          : actionState === "assessment-complete"
            ? "Assessment complete"
            : actionState === "ready"
              ? "Ready to assess"
              : "Complete the required setup";
  const help = actionState === "rerun-required"
    ? "Run the assessment again to update the findings."
    : actionState === "assessment-error"
      ? "Correct the setup and run again. No findings were saved."
      : noFile
        ? "Select one annual unit-period CSV."
        : actionState === "incomplete-setup"
          ? "Map required fields and describe both groups."
          : actionState === "assessment-complete"
            ? "Rerun after changing any setup."
            : "Fixed software checks the selected columns.";
  return (
    <div
      className="s4-action-bar"
      data-testid="screen04-action-bar"
      data-state={actionState}
    >
      <div className="s4-action-status" aria-live="polite">
        <strong>{title}</strong>
        <span>{help}</span>
      </div>
      <button
        className="s4-calculate"
        type={noFile ? "button" : "submit"}
        disabled={!canAssess}
        data-testid="screen04-calculate"
      >
        {actionState === "assessing"
          ? "Assessing your sample…"
          : "Assess this dataset"}
      </button>
    </div>
  );
}

function ConditionEditor({
  condition,
  index,
  headers,
  canAddNestedGroup,
  onChange,
  onRemove,
}: {
  condition: Screen04ExposureCondition;
  index: number;
  headers: readonly string[];
  canAddNestedGroup: boolean;
  onChange: (condition: Screen04ExposureCondition) => void;
  onRemove: () => void;
}) {
  const set = <K extends keyof Screen04ExposureCondition>(
    key: K,
    value: Screen04ExposureCondition[K],
  ) => onChange({ ...condition, [key]: value });
  return (
    <article className="s4-condition" data-testid="screen04-exposure-condition">
      <div className="s4-condition-header">
        <h3>Condition {index + 1}</h3>
        <button className="s4-button s4-button--quiet" type="button" onClick={onRemove}>Remove condition</button>
      </div>
      <div className="s4-condition-grid">
        <label className="s4-field">
          <span>Exposure dimension</span>
          <select value={condition.dimension} onChange={(event) => set("dimension", event.currentTarget.value as Screen04ExposureDimensionKind)}>
            {Object.entries(dimensionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {isStagedDimension(condition.dimension) && (
          <label className="s4-field">
            <span>Stage, component, or version name</span>
            <input
              value={condition.stageGroup ?? ""}
              onChange={(event) => set("stageGroup", event.currentTarget.value || null)}
              placeholder="2021 amendment or enforcement stage"
            />
          </label>
        )}
        <label className="s4-field">
          <span>Condition type</span>
          <select value={condition.kind} onChange={(event) => set("kind", event.currentTarget.value as Screen04ExposureConditionKind)}>
            {Object.entries(conditionKindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {condition.kind !== "effective-year" && (
          <label className="s4-field">
            <span>Exact CSV column</span>
            <select value={condition.column ?? ""} onChange={(event) => set("column", event.currentTarget.value || null)}>
              <option value="">Select a column</option>
              {headers.map((header) => <option key={header} value={header}>{header}</option>)}
            </select>
          </label>
        )}
        {condition.kind === "numeric-threshold" && (
          <>
            <label className="s4-field"><span>Comparison</span><select value={condition.operator ?? ">="} onChange={(event) => set("operator", event.currentTarget.value as Screen04NumericOperator)}><option value=">">Greater than</option><option value=">=">Greater than or equal to</option><option value="<">Less than</option><option value="<=">Less than or equal to</option></select></label>
            <label className="s4-field"><span>Threshold value</span><input type="number" value={condition.value ?? ""} onChange={(event) => set("value", event.currentTarget.value === "" ? null : Number(event.currentTarget.value))} /></label>
            <label className="s4-field"><span>Threshold unit</span><input value={condition.unit ?? ""} onChange={(event) => set("unit", event.currentTarget.value || null)} placeholder="USD millions" /></label>
            <label className="s4-field"><span>Unit used by the CSV values</span><input value={condition.sourceUnit ?? ""} onChange={(event) => set("sourceUnit", event.currentTarget.value || null)} placeholder="Same as threshold unit" /></label>
            <label className="s4-field"><span>Required historical measurement year</span><Screen04YearInput value={condition.historicalYear} onValueChange={(value) => set("historicalYear", value)} /></label>
            <label className="s4-field"><span>Historical year used by the CSV values</span><Screen04YearInput value={condition.mappedHistoricalYear} onValueChange={(value) => set("mappedHistoricalYear", value)} /></label>
            <label className="s4-field"><span>How the historical value is stored</span><select value={condition.historicalValueSource ?? "column-values"} onChange={(event) => set("historicalValueSource", event.currentTarget.value as "column-values" | "panel-year")}><option value="column-values">The selected column already represents that year</option><option value="panel-year">Use the annual panel row for the mapped year</option></select></label>
          </>
        )}
        {(condition.kind === "categorical-equals" || condition.kind === "exemption") && (
          <label className="s4-field"><span>Exact value meaning {condition.kind === "exemption" ? "exempt" : "condition met"}</span><input value={condition.value ?? ""} onChange={(event) => set("value", event.currentTarget.value || null)} /></label>
        )}
        <label className="s4-field"><span>Effective year</span><Screen04YearInput value={condition.effectiveYear} onValueChange={(value) => set("effectiveYear", value)} /></label>
      </div>
      {condition.kind === "numeric-threshold" && (
        <div className="s4-condition-actions">
          <small className="s4-help">Use one nested “at least one threshold” group only when alternative thresholds determine coverage.</small>
          {canAddNestedGroup && condition.nestedAnyGroup.length === 0 && (
            <button className="s4-button s4-button--secondary" type="button" onClick={() => set("nestedAnyGroup", [{ id: `${condition.id}-alternative-1`, column: null, operator: ">=", threshold: null, unit: null, sourceUnit: null, historicalYear: null, mappedHistoricalYear: null, historicalValueSource: "column-values" }])}>Add alternative threshold</button>
          )}
        </div>
      )}
      {condition.nestedAnyGroup.map((item, nestedIndex) => (
        <div className="s4-condition-grid" key={item.id}>
          <label className="s4-field"><span>Alternative threshold column</span><select value={item.column ?? ""} onChange={(event) => set("nestedAnyGroup", condition.nestedAnyGroup.map((candidate, candidateIndex) => candidateIndex === nestedIndex ? { ...candidate, column: event.currentTarget.value || null } : candidate))}><option value="">Select a column</option>{headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>
          <label className="s4-field"><span>Comparison</span><select value={item.operator ?? ">="} onChange={(event) => set("nestedAnyGroup", condition.nestedAnyGroup.map((candidate, candidateIndex) => candidateIndex === nestedIndex ? { ...candidate, operator: event.currentTarget.value as Screen04NumericOperator } : candidate))}><option value=">">Greater than</option><option value=">=">Greater than or equal to</option><option value="<">Less than</option><option value="<=">Less than or equal to</option></select></label>
          <label className="s4-field"><span>Threshold value</span><input type="number" value={item.threshold ?? ""} onChange={(event) => set("nestedAnyGroup", condition.nestedAnyGroup.map((candidate, candidateIndex) => candidateIndex === nestedIndex ? { ...candidate, threshold: event.currentTarget.value === "" ? null : Number(event.currentTarget.value) } : candidate))} /></label>
          <label className="s4-field"><span>Threshold unit</span><input value={item.unit ?? ""} onChange={(event) => set("nestedAnyGroup", condition.nestedAnyGroup.map((candidate, candidateIndex) => candidateIndex === nestedIndex ? { ...candidate, unit: event.currentTarget.value || null } : candidate))} /></label>
          <label className="s4-field"><span>Unit used by the CSV values</span><input value={item.sourceUnit ?? ""} onChange={(event) => set("nestedAnyGroup", condition.nestedAnyGroup.map((candidate, candidateIndex) => candidateIndex === nestedIndex ? { ...candidate, sourceUnit: event.currentTarget.value || null } : candidate))} /></label>
          <label className="s4-field"><span>Required historical measurement year</span><Screen04YearInput value={item.historicalYear} onValueChange={(value) => set("nestedAnyGroup", condition.nestedAnyGroup.map((candidate, candidateIndex) => candidateIndex === nestedIndex ? { ...candidate, historicalYear: value } : candidate))} /></label>
          <label className="s4-field"><span>Historical year used by the CSV values</span><Screen04YearInput value={item.mappedHistoricalYear} onValueChange={(value) => set("nestedAnyGroup", condition.nestedAnyGroup.map((candidate, candidateIndex) => candidateIndex === nestedIndex ? { ...candidate, mappedHistoricalYear: value } : candidate))} /></label>
          <label className="s4-field"><span>How the historical value is stored</span><select value={item.historicalValueSource ?? "column-values"} onChange={(event) => set("nestedAnyGroup", condition.nestedAnyGroup.map((candidate, candidateIndex) => candidateIndex === nestedIndex ? { ...candidate, historicalValueSource: event.currentTarget.value as "column-values" | "panel-year" } : candidate))}><option value="column-values">The selected column already represents that year</option><option value="panel-year">Use the annual panel row for the mapped year</option></select></label>
          <button className="s4-button s4-button--quiet" type="button" onClick={() => set("nestedAnyGroup", [])}>Remove alternative threshold</button>
        </div>
      ))}
    </article>
  );
}

export default function Screen04({
  state,
  onStateChange,
  onBack,
  onStartFresh,
  onContinue,
}: Screen04Props) {
  const [headers, setHeaders] = useState<readonly string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const csvTextRef = useRef<string | null>(null);
  const fileExpiryTimeoutRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const operationGenerationRef = useRef(0);
  const stateGuardRef = useRef(screen04OperationStateGuard(state));
  stateGuardRef.current = screen04OperationStateGuard(state);
  const [busy, setBusy] = useState<"file" | "calculation" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showFileLimitGuidance, setShowFileLimitGuidance] = useState(false);
  const [assessment, setAssessment] = useState<Screen04ScientificAssessmentResult | null>(null);
  const [attemptedDataset, setAttemptedDataset] = useState(false);
  const [attemptedNodata, setAttemptedNodata] = useState(false);
  const binding = state.eventCardBinding;
  const profile = state.sampleProfile;
  const dataset = profile.dataset;
  const nodata = profile.nodata;
  const datasetDescription = dataset.description;
  const datasetMappings = dataset.fieldMappings;
  const assignmentCrosswalkStatus = dataset.assignmentCrosswalkStatus;
  const withinAggregateExposure = dataset.withinAggregateExposure;
  const combinedExposureScenario = dataset.combinedExposureScenario;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      operationGenerationRef.current += 1;
      if (fileExpiryTimeoutRef.current !== null) {
        window.clearTimeout(fileExpiryTimeoutRef.current);
      }
      csvTextRef.current = null;
    };
  }, []);

  const setupIssues = assessment?.setupIssues ?? [];
  const assessmentReady = screen04LocalAssessmentMayRender(state, assessment);
  const issueFor = (field: Screen04SetupIssue["field"]) =>
    setupIssues.find((issue) => issue.field === field);
  const savedDatasetFindings = dataset.scientificFindings;
  const savedNodataFindings = nodata.scientificFindings;

  function beginOperation(operationState = state) {
    const generation = operationGenerationRef.current + 1;
    operationGenerationRef.current = generation;
    return {
      generation,
      state: screen04OperationStateGuard(operationState),
    };
  }

  function operationIsCurrent(operation: ReturnType<typeof beginOperation>) {
    return mountedRef.current &&
      operationGenerationRef.current === operation.generation &&
      screen04OperationStateIsCurrent(operation.state, stateGuardRef.current);
  }

  function cancelPendingOperation() {
    operationGenerationRef.current += 1;
    setBusy(null);
  }

  function scheduleLocalFileExpiry(delayMs = localFileLifetimeMs) {
    if (fileExpiryTimeoutRef.current !== null) {
      window.clearTimeout(fileExpiryTimeoutRef.current);
    }
    fileExpiryTimeoutRef.current = window.setTimeout(() => {
      csvTextRef.current = null;
      setHeaders([]);
      setFileName(null);
      setAssessment(null);
      setNotice("The temporary local CSV expired after one hour. Select it again; your sample description and mappings were preserved.");
      fileExpiryTimeoutRef.current = null;
    }, Math.max(1, delayMs));
  }

  function commitDataset(patch: Screen04DatasetProfilePatch) {
    cancelPendingOperation();
    try {
      onStateChange(updateScreen04DatasetProfile(state, patch, now()));
      setAssessment(null);
      setNotice(null);
    } catch (error) {
      setNotice(readerErrorMessage(error));
    }
  }

  function commitNodata(patch: Screen04NodataProfilePatch) {
    cancelPendingOperation();
    try {
      onStateChange(updateScreen04NodataProfile(state, patch, now()));
      setNotice(null);
    } catch (error) {
      setNotice(readerErrorMessage(error));
    }
  }

  function switchMode(mode: "dataset" | "nodata") {
    cancelPendingOperation();
    try {
      onStateChange(switchScreen04Mode(state, mode, now()));
      setNotice(null);
    } catch (error) {
      setNotice(readerErrorMessage(error));
    }
  }

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    const generation = beginOperation();
    setBusy("file");
    setNotice(null);
    setAssessment(null);
    setShowFileLimitGuidance(false);
    try {
      if (!file.name.toLocaleLowerCase("en-US").endsWith(".csv")) {
        throw new Error("Choose a CSV file; other formats are not read.");
      }
      if (file.size > SCREEN_04_AUDIT_LIMITS.maximumFileBytes) {
        setShowFileLimitGuidance(true);
        throw new Error(`File exceeds the ${SCREEN_04_AUDIT_LIMITS.maximumFileBytes.toLocaleString("en-US")}-byte limit. Use a smaller sample.`);
      }
      const buffer = await withDeadline(file.arrayBuffer(), "Reading the CSV");
      if (!operationIsCurrent(generation)) return;
      let text: string;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      } catch {
        throw new Error("The CSV is not valid UTF-8 text. Save it as UTF-8 CSV and try again.");
      }
      const inspection = await withDeadline(inspectScreen04CsvHeader(text), "Checking the CSV header");
      if (!operationIsCurrent(generation)) return;
      csvTextRef.current = text;
      setHeaders(inspection.exactHeaders);
      setFileName(file.name);
      const at = now();
      scheduleLocalFileExpiry(localFileLifetimeMs);
      // Selecting a file is the start of a new explicit assessment cycle even
      // when its bytes match the previous upload. Retire any saved findings so
      // they cannot reappear before the researcher clicks Assess this dataset.
      const next = attachScreen04Upload(state, {
        schemaVersion: "screen-04-upload-reference-v1",
        opaqueFileRef: opaqueReference("screen04-local-file"),
        csvFingerprint: inspection.csvFingerprint,
        headerFingerprint: inspection.headerFingerprint,
        byteLength: inspection.byteLength,
        headerCount: inspection.headerCount,
        uploadedAt: at,
        expiresAt: future(at, localFileLifetimeMs),
      }, at);
      onStateChange(next);
    } catch (error) {
      if (!operationIsCurrent(generation)) return;
      setNotice(readerErrorMessage(error));
    } finally {
      if (operationIsCurrent(generation)) setBusy(null);
    }
  }

  async function calculate(event: FormEvent) {
    event.preventDefault();
    setAttemptedDataset(true);
    setAssessment(null);
    if (!csvTextRef.current || headers.length === 0) {
      setNotice("Choose the CSV again before assessing the sample. Raw rows are not stored in saved state.");
      return;
    }
    const persistedReadiness = screen04DatasetAssessmentReadiness(dataset);
    const transientReadiness = screen04TransientHeaderReadiness(
      dataset,
      headers,
    );
    if (!persistedReadiness.ready || !transientReadiness.ready) {
      return;
    }
    const mapping = datasetMappings;
    const treatmentYear = datasetDescription.researcherTreatmentYear!;
    const compiledExposure = screen04CompileExposureRules(
      dataset.exposureMapping,
      treatmentYear,
    );
    const mappedRuleCount = [
      compiledExposure.exposureRule,
      ...compiledExposure.additionalExposureRules,
    ].filter((rule) => rule !== null).length;
    let assessingState: Screen04WorkflowState;
    try {
      assessingState = beginScreen04ScientificAssessment(state, now());
    } catch (error) {
      setNotice(readerErrorMessage(error));
      return;
    }
    const generation = beginOperation(assessingState);
    stateGuardRef.current = screen04OperationStateGuard(assessingState);
    onStateChange(assessingState);
    setBusy("calculation");
    setNotice(null);
    try {
      const result = await withDeadline(runScreen04ScientificAssessment({
        csvText: csvTextRef.current,
        verifiedShockName: binding.verifiedShockName,
        mappings: {
          unitIdentifier: mapping.unitIdentifier ?? "",
          year: mapping.annualTime ?? "",
          treatmentGroup: mapping.treatmentGroup ?? "",
          researcherTreatmentYear: treatmentYear,
          treatedValue: mapping.treatedValue ?? "",
          comparisonValue: mapping.comparisonValue ?? "",
          ...(mapping.assignmentLowerLevelIdentifier
            ? {
                assignmentLowerLevelIdentifier:
                  mapping.assignmentLowerLevelIdentifier,
              }
            : {}),
          ...(mapping.assignmentAggregateIdentifier
            ? {
                assignmentAggregateIdentifier:
                  mapping.assignmentAggregateIdentifier,
              }
            : {}),
        },
        studyDescription: {
          unitOfAnalysis: datasetDescription.unitOfAnalysis!,
          sampleUnitDescription: datasetDescription.sampleUnits!,
          dataFrequency: datasetDescription.dataFrequency ?? "annual",
          treatmentGroupDescription: datasetDescription.treatmentGroupDescription!,
          comparisonGroupDescription: datasetDescription.controlGroupDescription!,
          mainComparisonBasis: datasetDescription.comparisonBasis!,
          groupGeographicConcept: datasetDescription.geographicConcept,
          shockGeographicConcept: datasetDescription.shockGeographicConcept,
          groupGeographyColumn: mapping.geography,
          treatmentGroupGeographicValues:
            mapping.treatmentGeographicValues,
          comparisonGroupGeographicValues:
            mapping.controlGeographicValues,
          datasetAssignmentUnit: datasetDescription.datasetAssignmentUnit,
          shockAssignmentUnit: datasetDescription.shockAssignmentUnit,
        },
        verifiedDates: binding.verifiedTimeline.map((entry) => ({
          label: entry.label,
          date: entry.resolvedDate,
          role: verifiedDateRole(entry.stage),
        })),
        exposureDimensions: binding.exposureDimensions.map((dimension) => ({
          kind: dimension.kind,
          label: dimension.label,
          summary: dimension.summary,
        })),
        coverageMatchingIntent: dataset.exposureMapping?.approach ?? "skip",
        exposureRule: compiledExposure.exposureRule,
        additionalExposureRules: compiledExposure.additionalExposureRules,
        combinedExposureScenarios: screen04CombinedExposureScenarioInput(
          dataset.combinedExposureScenario,
          mappedRuleCount,
        ),
        assignmentCrosswalk:
          datasetDescription.datasetAssignmentUnit !== null &&
            datasetDescription.shockAssignmentUnit !== null &&
            datasetDescription.datasetAssignmentUnit !==
              datasetDescription.shockAssignmentUnit
            ? {
                crosswalkStatus: assignmentCrosswalkStatus,
                withinAggregateExposure:
                  assignmentCrosswalkStatus === "complete"
                    ? withinAggregateExposure
                    : null,
              }
            : null,
      }), "Assessing the sample");
      if (!operationIsCurrent(generation)) return;
      if (
        result.metrics === null ||
        result.setupIssues.some((issue) => issue.blocking)
      ) {
        // Preserve field-local setup diagnostics, but the workflow failure
        // status keeps all substantive result rendering and saving gated off.
        setAssessment(result);
        onStateChange(failScreen04Workflow(assessingState, {
          stage: "validation",
          code: "SCREEN04_SETUP_REQUIRES_CORRECTION",
          safeMessage: "Correct the highlighted dataset setup before assessing again.",
          failedAt: now(),
        }));
        return;
      }
      const assessedAt = now();
      const next = recordScreen04ScientificAssessment(
        assessingState,
        result,
        assessedAt,
      );
      onStateChange(next);
      // Publish the local result only after the atomic persisted record has
      // succeeded. If recording throws, the catch path clears it.
      setAssessment(result);
    } catch (error) {
      if (!operationIsCurrent(generation)) return;
      setAssessment(null);
      setNotice(readerErrorMessage(error));
      try {
        onStateChange(failScreen04Workflow(assessingState, {
          stage: "calculation",
          code: "SCREEN04_ASSESSMENT_ERROR",
          safeMessage: readerErrorMessage(error),
          failedAt: now(),
        }));
      } catch {
        // Preserve the current inputs even if a concurrent update already won.
      }
    } finally {
      if (
        mountedRef.current &&
        operationGenerationRef.current === generation.generation
      ) setBusy(null);
    }
  }

  function saveAndContinue() {
    if (busy !== null) return;
    try {
      const saved = saveScreen04SampleProfile(state, now());
      onStateChange(saved);
      onContinue?.(saved.sampleProfile);
      setNotice(null);
    } catch (error) {
      setNotice(readerErrorMessage(error));
    }
  }

  function updateExposureMapping(mapping: Screen04DatasetExposureMapping | null) {
    commitDataset({ exposureMapping: mapping });
  }

  function updateCombinedExposureScenario(
    value: Screen04CombinedExposureScenario | null,
  ) {
    commitDataset({ combinedExposureScenario: value });
  }

  function toggleCombinedExposureRule(ruleIndex: number, include: boolean) {
    const current = combinedExposureScenario ?? {
      name: "Researcher-selected combined package",
      ruleIndexes: [],
    };
    const nextIndexes = new Set(current.ruleIndexes);
    if (include) nextIndexes.add(ruleIndex);
    else nextIndexes.delete(ruleIndex);
    updateCombinedExposureScenario({
      ...current,
      ruleIndexes: [...nextIndexes].sort((left, right) => left - right),
    });
  }

  if (state.status === "stale") {
    return (
      <main className="s4-workspace" data-testid="screen04" data-status="stale">
        <button className="s4-back" type="button" onClick={onBack}>← Back to Screen 3</button>
        <section className="s4-alert s4-alert--warning" role="alert">
          <h1>The verified shock changed</h1>
          <p>Review this sample again before relying on the earlier assessment.</p>
          <button className="s4-button" type="button" onClick={onStartFresh} data-testid="screen04-start-fresh">Review the sample for the current shock</button>
        </section>
      </main>
    );
  }

  const nodataReadiness = screen04NodataReadiness(nodata.description);
  const datasetAssessmentReadiness = screen04DatasetAssessmentReadiness(
    dataset,
  );
  const transientHeaderReadiness = screen04TransientHeaderReadiness(
    dataset,
    headers,
  );
  const datasetReadyToAssess = datasetAssessmentReadiness.ready &&
    transientHeaderReadiness.ready;
  const datasetMissingSetup = Array.from(new Set([
    ...datasetAssessmentReadiness.missingFields,
    ...transientHeaderReadiness.missingMappings,
  ]));
  const currentExposure = dataset.exposureMapping;
  const completedAssessment = dataset.assessment?.status === "completed"
    ? dataset.assessment
    : null;
  const savedAssessmentIsCurrent = completedAssessment !== null &&
    state.upload !== null &&
    (state.status === "assessment-complete" ||
      state.status === "ready-to-continue") &&
    completedAssessment.csvFingerprint === state.upload.csvFingerprint &&
    completedAssessment.assessmentInputFingerprint ===
      screen04AssessmentInputFingerprint(state);
  const assessmentActionState: Screen04AssessmentActionState =
    busy === "calculation"
    ? "assessing"
    : state.status === "assessment-error"
      ? "assessment-error"
    : dataset.assessment?.status === "stale"
      ? "rerun-required"
      : savedAssessmentIsCurrent
        ? "assessment-complete"
        : datasetReadyToAssess
          ? "ready"
          : "incomplete-setup";
  const canAssess = busy === null &&
    csvTextRef.current !== null &&
    headers.length > 0 &&
    datasetReadyToAssess;
  const nestedGroupExists = currentExposure?.approach === "conditions" &&
    currentExposure.conditions.some((condition) => condition.nestedAnyGroup.length > 0);
  const compiledScenarioRules = screen04CompileExposureRules(
    currentExposure,
    datasetDescription.researcherTreatmentYear ?? 1000,
  );
  const mappedScenarioRules = [
    compiledScenarioRules.exposureRule,
    ...compiledScenarioRules.additionalExposureRules,
  ].filter((rule): rule is Screen04ScientificExposureRule => rule !== null);
  const combinedScenarioHasRoom = mappedScenarioRules.length >= 2 &&
    mappedScenarioRules.length <= 7;

  return (
    <main className="s4-workspace" data-testid="screen04" data-status={state.status} data-mode={profile.activeMode} aria-busy={busy !== null}>
      <button className="s4-back" type="button" onClick={onBack} data-testid="screen04-back">← Back to Screen 3</button>

      <header className="s4-hero">
        <span className="s4-kicker">Screen 4 · Sample exposure review</span>
        <h1>Audit exposure in your sample</h1>
        <p>Review how the verified shock, proposed groups, and sample fit before analysis.</p>
        <strong className="s4-shock-name">Shock being assessed: {binding.verifiedShockName}</strong>
        <small>Screen 4 uses the shock facts you confirmed in Screen 3.</small>
      </header>

      <section className="s4-panel s4-mode-panel" aria-labelledby="s4-mode-title">
        <div>
          <h2 id="s4-mode-title">{profile.activeMode === "dataset" ? "No dataset ready yet?" : "Prefer to assess a dataset now?"}</h2>
          <p>{profile.activeMode === "dataset"
            ? "Describe the sample now; you can upload a CSV later."
            : "Your dataset entries remain available."}</p>
        </div>
        <button className="s4-button s4-button--secondary" type="button" onClick={() => switchMode(profile.activeMode === "dataset" ? "nodata" : "dataset")} data-testid="screen04-mode-switch">
          {profile.activeMode === "dataset" ? "Continue without a dataset" : "Upload a dataset instead"}
        </button>
      </section>

      {notice && <div className="s4-alert s4-alert--error" role="alert" data-testid="screen04-error">{notice}</div>}

      {profile.activeMode === "nodata" ? (
        <form className="s4-nodata-form" onSubmit={(event) => { event.preventDefault(); setAttemptedNodata(true); if (nodataReadiness.ready) saveAndContinue(); }} data-testid="screen04-nodata-form">
          <section aria-labelledby="s4-nodata-title">
            <span className="s4-kicker">Describe the intended sample</span>
            <h2 id="s4-nodata-title">Continue without a dataset</h2>
            <p className="s4-section-intro">These entries support timing and consistency checks only; row-level exposure requires data.</p>
            <div className="s4-grid">
              <label className="s4-field"><span>Unit of analysis *</span><input required value={nodata.description.unitOfAnalysis ?? ""} onChange={(event) => commitNodata({ description: { unitOfAnalysis: event.currentTarget.value || null } })} placeholder="Firm-year" /></label>
              <label className="s4-field"><span>Sample units *</span><input required value={nodata.description.sampleUnits ?? ""} onChange={(event) => commitNodata({ description: { sampleUnits: event.currentTarget.value || null } })} placeholder="Public technology firms" /></label>
              <label className="s4-field"><span>Data frequency *</span><select required value={nodata.description.dataFrequency ?? ""} onChange={(event) => commitNodata({ description: { dataFrequency: event.currentTarget.value || null } })}><option value="">Select frequency</option><option value="annual">Annual</option><option value="quarterly">Quarterly</option><option value="monthly">Monthly</option><option value="other">Other</option></select></label>
              <label className="s4-field"><span>Sample start year *</span><Screen04YearInput required value={nodata.description.sampleStartYear} onValueChange={(value) => commitNodata({ description: { sampleStartYear: value } })} /></label>
              <label className="s4-field"><span>Sample end year *</span><Screen04YearInput required value={nodata.description.sampleEndYear} onValueChange={(value) => commitNodata({ description: { sampleEndYear: value } })} /></label>
              <label className="s4-field"><span>Treatment year *</span><Screen04YearInput required value={nodata.description.researcherTreatmentYear} onValueChange={(value) => commitNodata({ description: { researcherTreatmentYear: value } })} /></label>
              <label className="s4-field s4-field--wide"><span>Treatment-group description *</span><textarea required value={nodata.description.treatmentGroupDescription ?? ""} onChange={(event) => commitNodata({ description: { treatmentGroupDescription: event.currentTarget.value || null } })} placeholder="Firms headquartered in California" /></label>
              <label className="s4-field s4-field--wide"><span>Control-group description *</span><textarea required value={nodata.description.controlGroupDescription ?? ""} onChange={(event) => commitNodata({ description: { controlGroupDescription: event.currentTarget.value || null } })} placeholder="Firms headquartered outside California" /></label>
              <label className="s4-field"><span>Main basis distinguishing the groups *</span><select required value={nodata.description.comparisonBasis ?? ""} onChange={(event) => commitNodata({ description: { comparisonBasis: (event.currentTarget.value || null) as Screen04ComparisonBasis | null, ...(event.currentTarget.value !== "geography" ? { geographicConcept: null, shockGeographicConcept: null } : {}) } })}><option value="">Select the main basis</option><SelectOptions values={SCREEN_04_COMPARISON_BASES} labels={comparisonBasisLabels} /></select></label>
              {nodata.description.comparisonBasis === "geography" && <><label className="s4-field"><span>Geographic concept used for the groups *</span><select required value={nodata.description.geographicConcept ?? ""} onChange={(event) => commitNodata({ description: { geographicConcept: (event.currentTarget.value || null) as Screen04GeographicConcept | null } })}><option value="">Select the geographic concept</option><SelectOptions values={SCREEN_04_GEOGRAPHIC_CONCEPTS} labels={geographicConceptLabels} /></select></label><label className="s4-field"><span>Geographic concept used by the shock</span><select value={nodata.description.shockGeographicConcept ?? ""} onChange={(event) => commitNodata({ description: { shockGeographicConcept: (event.currentTarget.value || null) as Screen04GeographicConcept | null } })}><option value="">Not yet confirmed</option><SelectOptions values={SCREEN_04_GEOGRAPHIC_CONCEPTS} labels={geographicConceptLabels} /></select></label></>}
              <label className="s4-field"><span>Dataset assignment unit</span><select value={nodata.description.datasetAssignmentUnit ?? ""} onChange={(event) => commitNodata({ description: { datasetAssignmentUnit: (event.currentTarget.value || null) as Screen04AssignmentUnit | null } })}><option value="">Not yet specified</option><SelectOptions values={SCREEN_04_ASSIGNMENT_UNITS} labels={assignmentUnitLabels} /></select></label>
              <label className="s4-field"><span>Unit to which the shock applies</span><select value={nodata.description.shockAssignmentUnit ?? ""} onChange={(event) => commitNodata({ description: { shockAssignmentUnit: (event.currentTarget.value || null) as Screen04AssignmentUnit | null } })}><option value="">Not yet confirmed</option><SelectOptions values={SCREEN_04_ASSIGNMENT_UNITS} labels={assignmentUnitLabels} /></select></label>
            </div>
            {attemptedNodata && !nodataReadiness.ready && <div className="s4-inline-message s4-inline-message--error" role="alert"><strong>Complete the sample description</strong>{nodataReadiness.missingFields.join(", ")}.</div>}
          </section>
          {savedNodataFindings.length > 0 && <section aria-labelledby="s4-nodata-findings"><h2 id="s4-nodata-findings">Timing points to review</h2><FindingsByCategory findings={savedNodataFindings.slice(0, 5)} /></section>}
          <ResearcherChoices choices={nodata.unresolvedResearcherChoices} />
          <div className="s4-form-actions"><button className="s4-button" type="submit">Save this sample description and continue</button><span className="s4-help">You can upload a CSV later.</span></div>
        </form>
      ) : (
        <>
          <section className="s4-upload" aria-labelledby="s4-upload-title">
            <div><span className="s4-kicker">Private local file</span><h2 id="s4-upload-title">Choose one annual unit-period CSV</h2><p className="s4-section-intro">Fixed local software reads only the selected fields.</p></div>
            <label className="s4-file-button">{busy === "file" ? "Reading CSV…" : fileName ? "Replace CSV" : "Choose CSV"}<input type="file" accept=".csv,text/csv" disabled={busy !== null} onChange={(event) => void selectFile(event)} data-testid="screen04-file-input" /></label>
            {fileName && <p className="s4-file-name" data-testid="screen04-file-name">{fileName} · {headers.length} exact columns</p>}
            <p className="s4-limit">Limit: {SCREEN_04_AUDIT_LIMITS.maximumFileBytes.toLocaleString("en-US")} bytes, {SCREEN_04_AUDIT_LIMITS.maximumDataRows.toLocaleString("en-US")} rows, {SCREEN_04_AUDIT_LIMITS.maximumColumns} columns.</p>
          </section>

          {showFileLimitGuidance && <section className="s4-limit-guidance"><h2>Create a smaller sample CSV</h2><p>Keep the unit, year, group, and exposure fields; omit outcomes and controls.</p></section>}

          {headers.length === 0 && (
            <DatasetAssessmentActionBar
              actionState="incomplete-setup"
              canAssess={false}
              noFile
            />
          )}

          {headers.length > 0 && (
            <form className="s4-form" onSubmit={(event) => void calculate(event)}>
              <section aria-labelledby="s4-study-title">
                <span className="s4-kicker">Describe the study groups</span>
                <h2 id="s4-study-title">What do the proposed groups represent?</h2>
                <div className="s4-grid">
                  <label className="s4-field"><span>Unit of analysis *</span><input required value={datasetDescription.unitOfAnalysis ?? ""} onChange={(event) => commitDataset({ description: { unitOfAnalysis: event.currentTarget.value || null } })} placeholder="Firm-year" /><RequiredMessage show={attemptedDataset && !datasetDescription.unitOfAnalysis?.trim()} label="Unit of analysis" /></label>
                  <label className="s4-field"><span>Sample units *</span><input required value={datasetDescription.sampleUnits ?? ""} onChange={(event) => commitDataset({ description: { sampleUnits: event.currentTarget.value || null } })} placeholder="Public technology firms" /><RequiredMessage show={attemptedDataset && !datasetDescription.sampleUnits?.trim()} label="Sample units" /></label>
                  <label className="s4-field s4-field--wide"><span>What does your treatment group represent? *</span><textarea required value={datasetDescription.treatmentGroupDescription ?? ""} onChange={(event) => commitDataset({ description: { treatmentGroupDescription: event.currentTarget.value || null } })} placeholder="Firms headquartered in California" /><RequiredMessage show={attemptedDataset && !datasetDescription.treatmentGroupDescription?.trim()} label="Treatment-group description" /><FieldMessage issue={issueFor("treatmentGroupDescription")} /></label>
                  <label className="s4-field s4-field--wide"><span>What does your control group represent? *</span><textarea required value={datasetDescription.controlGroupDescription ?? ""} onChange={(event) => commitDataset({ description: { controlGroupDescription: event.currentTarget.value || null } })} placeholder="Firms headquartered outside California" /><RequiredMessage show={attemptedDataset && !datasetDescription.controlGroupDescription?.trim()} label="Control-group description" /><FieldMessage issue={issueFor("comparisonGroupDescription")} /></label>
                  <label className="s4-field"><span>What mainly distinguishes the two groups? *</span><select required value={datasetDescription.comparisonBasis ?? ""} onChange={(event) => commitDataset({ description: { comparisonBasis: (event.currentTarget.value || null) as Screen04ComparisonBasis | null, ...(event.currentTarget.value !== "geography" ? { geographicConcept: null, shockGeographicConcept: null } : {}) } })}><option value="">Select the main basis</option><SelectOptions values={SCREEN_04_COMPARISON_BASES} labels={comparisonBasisLabels} /></select><RequiredMessage show={attemptedDataset && datasetDescription.comparisonBasis === null} label="Main comparison basis" /><FieldMessage issue={issueFor("comparisonBasis")} /></label>
                  {datasetDescription.comparisonBasis === "geography" && (
                    <>
                      <label className="s4-field"><span>Geographic concept used for the groups *</span><select required value={datasetDescription.geographicConcept ?? ""} onChange={(event) => commitDataset({ description: { geographicConcept: (event.currentTarget.value || null) as Screen04GeographicConcept | null } })}><option value="">Select the group concept</option><SelectOptions values={SCREEN_04_GEOGRAPHIC_CONCEPTS} labels={geographicConceptLabels} /></select><RequiredMessage show={attemptedDataset && datasetDescription.geographicConcept === null} label="Geographic concept" /><FieldMessage issue={issueFor("geographicConcept")} /></label>
                      <label className="s4-field"><span>Geographic concept used by the shock</span><select value={datasetDescription.shockGeographicConcept ?? ""} onChange={(event) => commitDataset({ description: { shockGeographicConcept: (event.currentTarget.value || null) as Screen04GeographicConcept | null } })}><option value="">Not yet confirmed</option><SelectOptions values={SCREEN_04_GEOGRAPHIC_CONCEPTS} labels={geographicConceptLabels} /></select></label>
                      <HeaderSelect id="s4-geography" label="Exact geography column" value={datasetMappings.geography} headers={headers} onChange={(value) => commitDataset({ fieldMappings: { geography: value } })} />
                      <label className="s4-field"><span>Treatment-group geographic values</span><input value={datasetMappings.treatmentGeographicValues ?? ""} onChange={(event) => commitDataset({ fieldMappings: { treatmentGeographicValues: event.currentTarget.value || null } })} placeholder="CA" /></label>
                      <label className="s4-field"><span>Control-group geographic values</span><input value={datasetMappings.controlGeographicValues ?? ""} onChange={(event) => commitDataset({ fieldMappings: { controlGeographicValues: event.currentTarget.value || null } })} placeholder="All other states" /></label>
                    </>
                  )}
                  <label className="s4-field"><span>Dataset assignment unit</span><select value={datasetDescription.datasetAssignmentUnit ?? ""} onChange={(event) => commitDataset({ description: { datasetAssignmentUnit: (event.currentTarget.value || null) as Screen04AssignmentUnit | null } })}><option value="">Not yet specified</option><SelectOptions values={SCREEN_04_ASSIGNMENT_UNITS} labels={assignmentUnitLabels} /></select></label>
                  <label className="s4-field"><span>Unit to which the shock applies</span><select value={datasetDescription.shockAssignmentUnit ?? ""} onChange={(event) => commitDataset({ description: { shockAssignmentUnit: (event.currentTarget.value || null) as Screen04AssignmentUnit | null } })}><option value="">Not yet confirmed</option><SelectOptions values={SCREEN_04_ASSIGNMENT_UNITS} labels={assignmentUnitLabels} /></select><FieldMessage issue={issueFor("assignmentUnit")} /></label>
                  {datasetDescription.datasetAssignmentUnit !== null &&
                    datasetDescription.shockAssignmentUnit !== null &&
                    datasetDescription.datasetAssignmentUnit !==
                      datasetDescription.shockAssignmentUnit && (
                    <fieldset className="s4-field s4-field--wide" data-testid="screen04-assignment-crosswalk">
                      <legend>Can lower-level exposure be connected to each dataset unit?</legend>
                      <p className="s4-help">Answer only from a known identifier or crosswalk. ShockAudit will not infer this from column names.</p>
                      <label className="s4-field">
                        <span>Crosswalk availability</span>
                        <select
                          data-testid="screen04-assignment-crosswalk-status"
                          value={assignmentCrosswalkStatus}
                          onChange={(event) => commitDataset({
                            assignmentCrosswalkStatus:
                              event.currentTarget.value as
                                Screen04AssignmentCrosswalkStatus,
                          })}
                        >
                          <option value="unknown">Not yet known</option>
                          <option value="missing">No crosswalk is available</option>
                          <option value="partial">A partial crosswalk is available</option>
                          <option value="complete">A complete crosswalk is available</option>
                        </select>
                      </label>
                      {["partial", "complete"].includes(
                        assignmentCrosswalkStatus,
                      ) && (
                        <div className="s4-grid s4-field--wide" data-testid="screen04-assignment-crosswalk-columns">
                          <HeaderSelect
                            id="s4-assignment-lower-level-identifier"
                            label="Exact identifier for the unit covered by the shock"
                            required
                            value={datasetMappings.assignmentLowerLevelIdentifier}
                            headers={headers}
                            onChange={(value) => commitDataset({
                              fieldMappings: {
                                assignmentLowerLevelIdentifier: value,
                              },
                            })}
                          />
                          <HeaderSelect
                            id="s4-assignment-aggregate-identifier"
                            label="Exact identifier connecting it to the dataset unit"
                            required
                            value={datasetMappings.assignmentAggregateIdentifier}
                            headers={headers}
                            onChange={(value) => commitDataset({
                              fieldMappings: {
                                assignmentAggregateIdentifier: value,
                              },
                            })}
                          />
                          <p className="s4-help s4-field--wide">
                            Select the two exact CSV columns that provide the known link. ShockAudit reads only these selected identifiers and does not guess a relationship from their names.
                          </p>
                        </div>
                      )}
                      {assignmentCrosswalkStatus === "complete" && (
                        <label className="s4-field">
                          <span>Exposure within each dataset unit</span>
                          <select
                            data-testid="screen04-within-aggregate-exposure"
                            value={withinAggregateExposure}
                            onChange={(event) => commitDataset({
                              withinAggregateExposure:
                                event.currentTarget.value as
                                  Screen04WithinAggregateExposure,
                            })}
                          >
                            <option value="unknown">Not yet known</option>
                            <option value="uniform">All linked lower-level units share one exposure status</option>
                            <option value="mixed">Some dataset units contain both covered and uncovered lower-level units</option>
                          </select>
                        </label>
                      )}
                    </fieldset>
                  )}
                </div>
              </section>

              <section aria-labelledby="s4-structure-title">
                <span className="s4-kicker">Exact dataset structure</span>
                <h2 id="s4-structure-title">Map the annual panel</h2>
                <p className="s4-section-intro">CSV names are exact and case-sensitive: GVKEY differs from gvkey.</p>
                <div className="s4-grid">
                  <HeaderSelect id="s4-unit" label="Unit identifier" required value={datasetMappings.unitIdentifier} headers={headers} issue={issueFor("unitIdentifier")} onChange={(value) => commitDataset({ fieldMappings: { unitIdentifier: value } })} />
                  <HeaderSelect id="s4-year" label="Annual time variable" required value={datasetMappings.annualTime} headers={headers} issue={issueFor("year")} onChange={(value) => commitDataset({ fieldMappings: { annualTime: value } })} />
                  <HeaderSelect id="s4-group" label="Treatment-group variable" required value={datasetMappings.treatmentGroup} headers={headers} issue={issueFor("treatmentGroup")} onChange={(value) => commitDataset({ fieldMappings: { treatmentGroup: value } })} />
                  <label className="s4-field"><span>Treatment year *</span><Screen04YearInput required value={datasetDescription.researcherTreatmentYear} invalid={Boolean(issueFor("treatmentYear"))} onValueChange={(value) => commitDataset({ description: { researcherTreatmentYear: value, dataFrequency: "annual" } })} /><RequiredMessage show={attemptedDataset && datasetDescription.researcherTreatmentYear === null} label="Treatment year" /><FieldMessage issue={issueFor("treatmentYear")} /></label>
                  <label className="s4-field"><span>Exact treated value *</span><input required value={datasetMappings.treatedValue ?? ""} aria-invalid={Boolean(issueFor("treatedValue"))} onChange={(event) => commitDataset({ fieldMappings: { treatedValue: event.currentTarget.value || null } })} /><FieldMessage issue={issueFor("treatedValue")} /></label>
                  <label className="s4-field"><span>Exact comparison value *</span><input required value={datasetMappings.comparisonValue ?? ""} aria-invalid={Boolean(issueFor("comparisonValue"))} onChange={(event) => commitDataset({ fieldMappings: { comparisonValue: event.currentTarget.value || null } })} /><FieldMessage issue={issueFor("comparisonValue")} /></label>
                  <HeaderSelect id="s4-name" label="Organization name (optional)" value={datasetMappings.organizationName} headers={headers} onChange={(value) => commitDataset({ fieldMappings: { organizationName: value } })} />
                </div>
                {issueFor("file") && <div className="s4-inline-message s4-inline-message--error" role="alert" data-testid="screen04-setup-message"><strong>{issueFor("file")!.title}</strong>{issueFor("file")!.message}</div>}
              </section>

              <section className="s4-optional-coverage" aria-labelledby="s4-exposure-title">
                <h2 id="s4-exposure-title">Optional: Check whether your groups match who was actually covered</h2>
                <details data-testid="screen04-exposure-details">
                  <summary>Choose whether to include coverage matching</summary>
                  <div className="s4-optional-coverage-body">
                    <p>Use this section when your CSV contains information that helps determine whether each unit was covered by the shock, such as location, organization type, a size threshold, filing status, or an exemption.</p>
                    <p>Adding this information lets ShockAudit check whether some proposed treated units may not have been covered, whether some proposed control units may have been exposed, and where exposure remains uncertain.</p>
                    <p>You may skip this section. ShockAudit can still assess treatment timing, treatment and control group sizes, panel coverage, entry, exit, and missing periods.</p>

                    {binding.exposureDimensions.length > 0 && (
                      <div className="s4-coverage-guidance">
                        <h3>Coverage guidance for {binding.verifiedShockName}</h3>
                        <p>Use only the coverage information that is available in this CSV.</p>
                        <ul className="s4-dimensions" aria-label="Coverage guidance from the verified shock">
                          {binding.exposureDimensions.map((dimension) => <li key={dimension.kind}><strong>{dimension.label}</strong><span>{dimension.summary}</span></li>)}
                        </ul>
                      </div>
                    )}

                    <div className="s4-radio-grid" role="radiogroup" aria-label="Optional coverage matching">
                      <label className="s4-radio-card">
                        <input type="radio" name="exposure-approach" checked={currentExposure === null} onChange={() => updateExposureMapping(null)} />
                        <span>Skip this optional check</span>
                        <small>Assess sample structure and timing without independently reconstructing who was covered.</small>
                      </label>
                      <label className="s4-radio-card">
                        <input type="radio" name="exposure-approach" checked={currentExposure?.approach === "coverage-variable"} onChange={() => updateExposureMapping({ approach: "coverage-variable", column: null, coveredValue: null })} />
                        <span>I already have a variable showing who was covered</span>
                        <small>Choose the CSV column that represents coverage and identify the value meaning covered. ShockAudit will compare this coding with your proposed treatment and control groups.</small>
                        <small>For example: CoverageStatus = Covered.</small>
                      </label>
                      <label className="s4-radio-card">
                        <input type="radio" name="exposure-approach" checked={currentExposure?.approach === "conditions"} onChange={() => updateExposureMapping({ approach: "conditions", combination: "all", conditions: [newCondition(binding.exposureDimensions[0]?.kind ?? "organization-type")] })} />
                        <span>Use dataset fields to determine who was covered</span>
                        <small>Select the dataset fields that correspond to the verified coverage rules, such as state, organization type, revenue threshold, or exemption. ShockAudit will apply the confirmed rules to each unit and period.</small>
                      </label>
                    </div>

                    {currentExposure?.approach === "coverage-variable" && <div className="s4-grid"><HeaderSelect id="s4-coverage-column" label="Coverage column" value={currentExposure.column} headers={headers} issue={issueFor("exposureRule")} onChange={(value) => updateExposureMapping({ ...currentExposure, column: value })} /><label className="s4-field"><span>Value meaning covered</span><input value={currentExposure.coveredValue ?? ""} onChange={(event) => updateExposureMapping({ ...currentExposure, coveredValue: event.currentTarget.value || null })} placeholder="Covered" /></label></div>}
                    {currentExposure?.approach === "conditions" && <><label className="s4-field"><span>How the selected fields combine</span><select value={currentExposure.combination} onChange={(event) => updateExposureMapping({ ...currentExposure, combination: event.currentTarget.value as "all" | "any" })}><option value="all">All selected conditions must be met</option><option value="any">At least one selected condition must be met</option></select></label><div className="s4-conditions">{currentExposure.conditions.map((condition, index) => <ConditionEditor key={condition.id} condition={condition} index={index} headers={headers} canAddNestedGroup={!nestedGroupExists || condition.nestedAnyGroup.length > 0} onChange={(nextCondition) => updateExposureMapping({ ...currentExposure, conditions: currentExposure.conditions.map((candidate) => candidate.id === condition.id ? nextCondition : candidate) })} onRemove={() => updateExposureMapping({ ...currentExposure, conditions: currentExposure.conditions.filter((candidate) => candidate.id !== condition.id) })} />)}</div><div className="s4-condition-actions"><small className="s4-help">Use up to eight fields. Reuse a stage name for fields that belong to one stage; unavailable information stays unknown.</small><button className="s4-button s4-button--secondary" type="button" disabled={currentExposure.conditions.length >= maximumConditions} onClick={() => updateExposureMapping({ ...currentExposure, conditions: [...currentExposure.conditions, newCondition(binding.exposureDimensions[currentExposure.conditions.length % Math.max(1, binding.exposureDimensions.length)]?.kind ?? "organization-type")] })}>Add field</button></div></>}
                    {currentExposure?.approach === "conditions" &&
                      mappedScenarioRules.length >= 2 && (
                      <details className="s4-combined-scenario" data-testid="screen04-combined-scenario">
                        <summary>Optional: compare one combined treatment package</summary>
                        <div className="s4-combined-scenario-body">
                          <p>
                            Combine two or more of the mapped coverage stages below when that package represents a source-supported treatment definition you want ShockAudit to compare. The selection never uses outcome values.
                          </p>
                          <p className="s4-help">
                            One primary scenario, mapped alternatives, and this optional package share a maximum of eight scenarios in one assessment.
                          </p>
                          {!combinedScenarioHasRoom ? (
                            <p className="s4-inline-message s4-inline-message--warning" role="status">
                              The eight mapped definitions already use the scenario limit. Narrow the mapped stages before adding a combined package.
                            </p>
                          ) : (
                            <>
                              <label className="s4-check-row">
                                <input
                                  type="checkbox"
                                  checked={combinedExposureScenario !== null}
                                  onChange={(event) => updateCombinedExposureScenario(
                                    event.currentTarget.checked
                                      ? {
                                          name: "Researcher-selected combined package",
                                          ruleIndexes: [],
                                        }
                                      : null,
                                  )}
                                />
                                <span>Include one researcher-selected combined package</span>
                              </label>
                              {combinedExposureScenario !== null && (
                                <div className="s4-combined-scenario-fields">
                                  <label className="s4-field">
                                    <span>Plain-language package name</span>
                                    <input
                                      maxLength={200}
                                      value={combinedExposureScenario.name ?? ""}
                                      onChange={(event) => updateCombinedExposureScenario({
                                        ...combinedExposureScenario,
                                        name: event.currentTarget.value || null,
                                      })}
                                      placeholder="Implementation and enforcement package"
                                    />
                                  </label>
                                  <fieldset>
                                    <legend>Mapped rules included in this package</legend>
                                    <div className="s4-scenario-rule-list">
                                      {mappedScenarioRules.map((rule, ruleIndex) => {
                                        const ruleName = rule.label?.trim() ||
                                          rule.component?.trim() ||
                                          rule.version?.trim() ||
                                          (ruleIndex === 0
                                            ? "Primary mapped coverage definition"
                                            : `Mapped coverage stage ${ruleIndex + 1}`);
                                        const sourceBasis = rule.version?.trim()
                                          ? `Verified coverage version: ${rule.version.trim()}`
                                          : rule.component?.trim()
                                            ? `Verified treatment component: ${rule.component.trim()}`
                                            : "Verified Screen 3 coverage information and the selected CSV fields";
                                        return (
                                          <label className="s4-check-row" key={`${ruleName}-${ruleIndex}`}>
                                            <input
                                              type="checkbox"
                                              checked={combinedExposureScenario.ruleIndexes.includes(ruleIndex)}
                                              onChange={(event) => toggleCombinedExposureRule(
                                                ruleIndex,
                                                event.currentTarget.checked,
                                              )}
                                            />
                                            <span><strong>{ruleName}</strong><small>{sourceBasis}</small></span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </fieldset>
                                  {(combinedExposureScenario.name?.trim().length ?? 0) === 0 ||
                                    combinedExposureScenario.ruleIndexes.length < 2 ? (
                                    <p className="s4-help" role="status">
                                      Add a plain-language name and select at least two mapped rules to include this package in the assessment.
                                    </p>
                                  ) : (
                                    <p className="s4-help" role="status">
                                      This package will be included as one bounded researcher-selected scenario.
                                    </p>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </details>
                    )}
                    {issueFor("exposureRule") && currentExposure?.approach === "conditions" && <div className="s4-inline-message s4-inline-message--warning"><strong>{issueFor("exposureRule")!.title}</strong>{issueFor("exposureRule")!.message}</div>}
                  </div>
                </details>
              </section>

              {attemptedDataset && !datasetReadyToAssess && (
                <div className="s4-inline-message s4-inline-message--error" role="alert" data-testid="screen04-readiness-message">
                  <strong>Complete the required setup</strong>
                  {datasetMissingSetup.join(", ")}.
                </div>
              )}
              <DatasetAssessmentActionBar
                actionState={assessmentActionState}
                canAssess={canAssess}
              />
            </form>
          )}

          {dataset.assessment?.status === "stale" &&
            dataset.assessment.reason === "Your sample setup changed" && (
            <section className="s4-alert s4-alert--warning" role="status" data-testid="screen04-assessment-stale">
              <h2>Your sample setup changed</h2>
              <p>Run the assessment again to update the findings.</p>
            </section>
          )}
          {assessmentReady ? <DatasetResults result={assessment!} coverageMatchingIncluded={currentExposure !== null} /> : savedAssessmentIsCurrent && dataset.overallJudgment !== null && <section className="s4-results" data-testid="screen04-saved-findings"><div className={`s4-status s4-status--${judgmentStatusClass(dataset.overallJudgment)}`}><span className="s4-kicker">Saved sample assessment</span><h2>{dataset.overallJudgment}</h2></div>{completedAssessment?.summary && <AssessmentProvenance rows={completedAssessment.summary.rowCount} units={completedAssessment.summary.uniqueUnits} firstYear={completedAssessment.summary.sampleStartYear} lastYear={completedAssessment.summary.sampleEndYear} />}{currentExposure === null && <p className="s4-coverage-note">Coverage matching was not included in this assessment.</p>}{savedDatasetFindings.length > 0 ? <><h3>Priority findings</h3><FindingsByCategory findings={savedDatasetFindings.slice(0, 5)} />{savedDatasetFindings.length > 5 && <details className="s4-other-findings"><summary>Other points to review</summary><FindingsByCategory findings={savedDatasetFindings.slice(5)} surface="other" /></details>}</> : <p>No major exposure-design problem was identified by the available deterministic checks.</p>}<ResearcherChoices choices={dataset.unresolvedResearcherChoices} /></section>}
          {(assessmentReady || savedAssessmentIsCurrent) && <div className="s4-form-actions"><button className="s4-button" type="button" disabled={busy !== null} onClick={saveAndContinue}>Save assessment and continue</button><span className="s4-help">Saves findings and mappings, never raw rows.</span></div>}
        </>
      )}

      {(profile.activeMode === "dataset" ? dataset.completion : nodata.completion).status === "saved" && (
        <section className="s4-alert s4-alert--success" role="status" data-testid="screen04-ready">
          <h2>Sample profile saved</h2>
          <p>Your sample profile is ready for the next step. No later design screen is connected in this build, so you can return to Screen 3 or keep editing this profile.</p>
        </section>
      )}

      <p className="s4-boundary">This pre-analysis check does not inspect outcomes or regression controls, test causal assumptions, estimate effects, or recommend an estimator.</p>
    </main>
  );
}
