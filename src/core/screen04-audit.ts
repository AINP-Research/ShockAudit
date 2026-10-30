import { fingerprintScreen03Value } from "./screen03-workflow";
import {
  SCREEN_04_AUDIT_LIMITS,
  SCREEN_04_EXECUTION_MODE,
  Screen04CoreError,
  scanScreen04SelectedCsv,
  type Screen04ExposureStatus,
  type Screen04FindingSeverity,
} from "./screen04-feasibility";
import type { Screen04EventCardBinding } from "./screen04-event-card-binding";
import {
  SCREEN_04_RULE_AST_VERSION,
  evaluateScreen04ExposurePlan,
  type Screen04ExposurePlanEvaluation,
  type Screen04ExposureRulePlan,
  type Screen04RuleExpression,
} from "./screen04-rule-ast";
import type { Screen04WorkflowMappings } from "./screen04-workflow";
import {
  restoreHostReasoningRunAuditBundle,
  type HostReasoningRunAuditBundle,
} from "./host-reasoning-audit";
import { SHOCKAUDIT_VERSION } from "../version";

export const SCREEN_04_AUDIT_SCHEMA_VERSION = "screen-04-audit-result-v1" as const;
export const SCREEN_04_AUDIT_ENGINE_VERSION = "screen-04-audit-engine-v1" as const;

export type Screen04AuditLimitation = {
  code: string;
  message: string;
  requirementId: string | null;
  evidenceIds: readonly string[];
};

export type Screen04AuditIssue = {
  findingCode: string;
  severity: Screen04FindingSeverity;
  title: string;
  eventCardRequirement: string;
  datasetEvidence: string;
  affectedCaseCount: number;
  affectedUnitCount: number;
  affectedPeriodStart: number | null;
  affectedPeriodEnd: number | null;
  exposureDesignConsequence: string;
  concreteSuggestion: string;
  blocksFullExposure: boolean;
  eventCardEvidenceIds: readonly string[];
  softwareVersion: typeof SCREEN_04_AUDIT_ENGINE_VERSION;
  ruleVersion: typeof SCREEN_04_RULE_AST_VERSION;
};

export type Screen04AuditOverallStatus =
  | "exposure-coding-is-executable"
  | "proceed-with-repairs"
  | "exposure-requires-redesign"
  | "partial-audit-only"
  | "exposure-cannot-be-calculated";

export type Screen04AuditPublicResult = {
  schemaVersion: typeof SCREEN_04_AUDIT_SCHEMA_VERSION;
  engineVersion: typeof SCREEN_04_AUDIT_ENGINE_VERSION;
  ruleVersion: typeof SCREEN_04_RULE_AST_VERSION;
  applicationVersion: string;
  executionMode: typeof SCREEN_04_EXECUTION_MODE;
  verifiedShockName: string;
  eventCardId: string;
  eventCardVersion: string;
  eventCardFingerprint: string;
  screen02RunId: string;
  selectedEventId: string;
  screen03RunId: string;
  verifiedTimelineProposalId: string;
  csvFingerprint: string;
  resultFingerprint: string;
  selectedColumns: readonly string[];
  rowCount: number;
  unitCount: number;
  observedYearRange: { earliest: number; latest: number };
  classificationCounts: Record<Screen04ExposureStatus, number> & { total: number };
  completedAuditDimensions: readonly string[];
  unassessedRequirementIds: readonly string[];
  overallStatus: Screen04AuditOverallStatus;
  issues: readonly Screen04AuditIssue[];
};

export type Screen04AuditDownload = {
  filename: string;
  mediaType: "text/csv;charset=utf-8" | "application/json;charset=utf-8";
  content: string;
  fingerprint: string;
  rowCount?: number;
};

export type Screen04AuditOutput = {
  publicResult: Screen04AuditPublicResult;
  auditedExposureExport: Screen04AuditDownload;
  affectedCasesExport: Screen04AuditDownload;
  auditReportExport: Screen04AuditDownload;
};

/**
 * Optional sanitized provenance returned by the server-side host-task store.
 * Legacy Screen 4 calls do not carry it. The detailed task projection remains
 * opaque here so the deterministic Screen 4 core does not depend on Worker
 * persistence types or credentials.
 */
export type Screen04HostReasoningAuditBundle = HostReasoningRunAuditBundle;

export type Screen04AuditInput = {
  csvText: string;
  eventCardBinding: Screen04EventCardBinding;
  mappings: Screen04WorkflowMappings;
  exposurePlan: Screen04ExposureRulePlan;
  indicatorValueMappings?: {
    existingPostPeriod?: {
      prePeriodValue: string;
      postPeriodValue: string;
    };
    existingUnitPeriodTreatment?: {
      unexposedValue: string;
      exposedValue: string;
    };
  };
  auditLimitations: readonly Screen04AuditLimitation[];
  missingRequirementIds: readonly string[];
  hostReasoningTaskAudit?: Screen04HostReasoningAuditBundle;
};

export type Screen04NamedAuditScenario = {
  scenarioId: string;
  label: string;
  evidenceIds: readonly string[];
  input: Screen04AuditInput;
};

export type Screen04ScenarioExposureVariation = {
  exposedCaseCount: number;
  unexposedCaseCount: number;
  unknownCaseCount: number;
  notApplicableCaseCount: number;
  hasUsableExposureVariation: boolean;
};

export type Screen04ScenarioResearcherCoding = {
  agreementCaseCount: number;
  mismatchCaseCount: number;
  unresolvedCaseCount: number;
  treatedAuditedUnexposedCaseCount: number;
  comparisonAuditedExposedCaseCount: number;
  treatedAuditedUnknownCaseCount: number;
  comparisonAuditedUnknownCaseCount: number;
};

export type Screen04ScenarioComparisonOutput = {
  schemaVersion: "screen-04-scenario-comparison-v1";
  baselineScenarioId: string;
  alternativeScenarioId: string;
  baselineTimelineProposalId: string;
  alternativeTimelineProposalId: string;
  baselineResultFingerprint: string;
  alternativeResultFingerprint: string;
  issue: Screen04AuditIssue | null;
  changedCaseCount: number;
  changedUnitCount: number;
  changedPeriodStart: number | null;
  changedPeriodEnd: number | null;
  changesByStatus: readonly {
    from: Screen04ExposureStatus;
    to: Screen04ExposureStatus;
    count: number;
  }[];
  comparisonContamination: {
    baselineExposedComparisonCaseCount: number;
    alternativeExposedComparisonCaseCount: number;
    changedComparisonCaseCount: number;
    direction: "alternative-increases" | "alternative-decreases" | "unchanged";
  };
  exposureVariation: {
    baseline: Screen04ScenarioExposureVariation;
    alternative: Screen04ScenarioExposureVariation;
  };
  researcherCodingAgreement: {
    baseline: Screen04ScenarioResearcherCoding;
    alternative: Screen04ScenarioResearcherCoding;
    direction:
      | "alternative-improves"
      | "alternative-worsens"
      | "unchanged";
  };
  overallStatus:
    | "exposure-coding-is-executable"
    | "proceed-with-repairs";
  resultFingerprint: string;
  affectedCasesExport: Screen04AuditDownload;
};

type RowResult = {
  unitId: string;
  organizationName: string | null;
  year: number;
  group: string;
  status: Screen04ExposureStatus;
  reasonCode: string;
  classificationReason: string;
  components: string;
  versions: string;
  exposureStarts: string;
  componentStatuses: Readonly<Record<string, Screen04ExposureStatus>>;
  ruleReasonCodes: readonly string[];
  unresolvedRequirementIds: readonly string[];
  numericValues: Readonly<Record<string, number | null>>;
  forcedByUnresolvedBoundary: boolean;
  issueCodes: string[];
};

function fail(code: ConstructorParameters<typeof Screen04CoreError>[0], message: string): never {
  throw new Screen04CoreError(code, message);
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) =>
    `${JSON.stringify(key)}:${stableJson(object[key])}`
  ).join(",")}}`;
}

function requireScreen04HostReasoningAudit(
  value: Screen04HostReasoningAuditBundle,
  expectedRunId: string,
): Screen04HostReasoningAuditBundle {
  const parsed = restoreHostReasoningRunAuditBundle(value);
  if (!parsed || parsed.runId !== expectedRunId) {
    fail(
      "SCREEN04_INVALID_MAPPING",
      "Invalid private host-task material: host-task audit provenance does not match this Screen 4 run.",
    );
  }
  return parsed;
}

async function sha256(value: string): Promise<string> {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
  return `sha256:${Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0")).join("")}`;
}

function csvCell(value: string | number): string {
  const original = String(value);
  const hardened =
    typeof value === "string" && /^[=+\-@\t\r\n]/u.test(original)
      ? `'${original}`
      : original;
  return /[",\r\n]/u.test(hardened)
    ? `"${hardened.replaceAll('"', '""')}"`
    : hardened;
}

function classificationReason(
  evaluation: Screen04ExposurePlanEvaluation,
  hasTypedComponents: boolean,
  forcedByUnresolvedBoundary: boolean,
): string {
  if (!hasTypedComponents) {
    return evaluation.status === "not_applicable"
      ? "The observation precedes the selected verified Event Card timeline entry; no explicitly typed exposure component was available."
      : "No explicitly typed Event Card exposure component was available, so full exposure remains unknown.";
  }
  if (forcedByUnresolvedBoundary) {
    return "Full exposure is held unknown because an unresolved Event Card compiler, audit, or missing-requirement boundary remains.";
  }
  switch (evaluation.reasonCode) {
    case "SCREEN04_COMPONENT_EXPOSED":
      return "At least one operative typed Event Card component rule was satisfied.";
    case "SCREEN04_COMPONENTS_UNEXPOSED":
      return "All operative typed Event Card component rules were evaluated and none was satisfied.";
    case "SCREEN04_COMPONENTS_NOT_YET_APPLICABLE":
      return "The observation precedes every typed Event Card component exposure start.";
    case "SCREEN04_COMPONENT_REQUIREMENT_UNKNOWN":
      return "At least one operative typed Event Card requirement could not be evaluated from the selected exact mappings.";
  }
}

function indicatorValues(input: Screen04AuditInput) {
  const explicitCombined = input.indicatorValueMappings
    ?.existingUnitPeriodTreatment;
  const sameAsTreatmentGroup =
    input.mappings.optional.existingUnitPeriodTreatment !== null &&
    input.mappings.optional.existingUnitPeriodTreatment ===
      input.mappings.structure.treatmentGroup;
  return {
    postPeriod: input.indicatorValueMappings?.existingPostPeriod ?? null,
    combinedTreatment: explicitCombined ?? (sameAsTreatmentGroup
      ? {
          exposedValue: input.mappings.structure.treatedValue,
          unexposedValue: input.mappings.structure.comparisonValue,
        }
      : null),
  };
}

function evaluateTypedPlanAtYear(
  plan: Screen04ExposureRulePlan,
  year: number,
  selectedValues: Readonly<Record<string, string | undefined>>,
  structuralStartYear: number,
): Screen04ExposurePlanEvaluation {
  if (plan.components.length > 0) {
    return evaluateScreen04ExposurePlan(plan, year, selectedValues);
  }
  return {
    status: year < structuralStartYear ? "not_applicable" : "unknown",
    reasonCode:
      year < structuralStartYear
        ? "SCREEN04_COMPONENTS_NOT_YET_APPLICABLE"
        : "SCREEN04_COMPONENT_REQUIREMENT_UNKNOWN",
    components: [],
  };
}

function leafRequirements(expression: Screen04RuleExpression): Array<{
  requirementId: string;
  csvColumn: string;
}> {
  if (expression.kind === "all" || expression.kind === "any") {
    return expression.rules.flatMap(leafRequirements);
  }
  if (expression.kind === "not") return leafRequirements(expression.rule);
  return [{
    requirementId: expression.requirementId,
    csvColumn: expression.csvColumn,
  }];
}

function validateBinding(binding: Screen04EventCardBinding): void {
  const { bindingFingerprint, ...input } = binding;
  if (bindingFingerprint !== fingerprintScreen03Value(input)) {
    throw new Error("Screen 4 Event Card binding failed fingerprint validation.");
  }
}

function validatePlanAndMappings(input: Screen04AuditInput) {
  validateBinding(input.eventCardBinding);
  if (input.exposurePlan.schemaVersion !== SCREEN_04_RULE_AST_VERSION) {
    throw new Error("Screen 4 exposure-rule plan version is unsupported.");
  }
  const indicators = indicatorValues(input);
  const validIndicatorPair = (left: string, right: string) =>
    left.length > 0 &&
    right.length > 0 &&
    left.length <= 300 &&
    right.length <= 300 &&
    left !== right &&
    !/[\u0000-\u001f\u007f]/u.test(left) &&
    !/[\u0000-\u001f\u007f]/u.test(right);
  if (
    (indicators.postPeriod !== null &&
      (input.mappings.optional.existingPostPeriod === null ||
        !validIndicatorPair(
          indicators.postPeriod.prePeriodValue,
          indicators.postPeriod.postPeriodValue,
        ))) ||
    (indicators.combinedTreatment !== null &&
      (input.mappings.optional.existingUnitPeriodTreatment === null ||
        !validIndicatorPair(
          indicators.combinedTreatment.unexposedValue,
          indicators.combinedTreatment.exposedValue,
        )))
  ) {
    throw new Error(
      "Optional indicator checks require distinct, bounded, explicitly confirmed values.",
    );
  }
  if (
    !input.eventCardBinding.verifiedTimeline.some((item) =>
      item.proposalId === input.mappings.verifiedTimelineProposalId
    )
  ) {
    throw new Error("The chosen timeline entry is not in the locked Event Card.");
  }
  const leaves = input.exposurePlan.components.flatMap((component) =>
    leafRequirements(component.expression)
  );
  for (const leaf of leaves) {
    if (!Object.hasOwn(input.mappings.eventRequirements, leaf.requirementId)) {
      throw new Error(
        `Exposure requirement ${leaf.requirementId} has no explicit mapping decision.`,
      );
    }
    const mapped = input.mappings.eventRequirements[leaf.requirementId];
    if (mapped !== null && mapped !== leaf.csvColumn) {
      throw new Error(
        `Exposure requirement ${leaf.requirementId} does not match its explicitly typed rule column.`,
      );
    }
  }
  return leaves;
}

function numericLeaves(expression: Screen04RuleExpression): Array<{
  requirementId: string;
  csvColumn: string;
  threshold: number;
}> {
  if (expression.kind === "all" || expression.kind === "any") {
    return expression.rules.flatMap(numericLeaves);
  }
  if (expression.kind === "not") return numericLeaves(expression.rule);
  return expression.kind === "numeric-threshold"
    ? [{
        requirementId: expression.requirementId,
        csvColumn: expression.csvColumn,
        threshold: expression.threshold,
      }]
    : [];
}

function addIssue(row: RowResult, code: string): void {
  if (!row.issueCodes.includes(code)) row.issueCodes.push(code);
}

function addIssueToUnitHistory(
  rows: readonly RowResult[],
  unitIds: ReadonlySet<string>,
  code: string,
): void {
  for (const row of rows) {
    if (unitIds.has(row.unitId)) addIssue(row, code);
  }
}

function addIssueToAllRows(rows: readonly RowResult[], code: string): void {
  for (const row of rows) addIssue(row, code);
}

function parseYear(value: string, recordNumber: number): number {
  const year = Number(value);
  if (!/^\d{4}$/u.test(value) || year < 1000 || year > 9999) {
    fail(
      "SCREEN04_INVALID_ANNUAL_TIME",
      `This Screen 4 version supports plausible annual years from 1000 through 9999. Record ${recordNumber} is outside that exact format and range.`,
    );
  }
  return year;
}

function unitIdentifierFormat(value: string):
  | "digits"
  | "decimal"
  | "letters"
  | "alphanumeric"
  | "structured" {
  if (/^\d+$/u.test(value)) return "digits";
  if (/^[+-]?\d+\.\d+$/u.test(value)) return "decimal";
  if (/^[A-Za-z]+$/u.test(value)) return "letters";
  if (/^[A-Za-z0-9]+$/u.test(value)) return "alphanumeric";
  return "structured";
}

function unique<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values));
}

function issueFromRows(
  rows: readonly RowResult[],
  code: string,
  values: Omit<
    Screen04AuditIssue,
    | "findingCode"
    | "affectedCaseCount"
    | "affectedUnitCount"
    | "affectedPeriodStart"
    | "affectedPeriodEnd"
    | "softwareVersion"
    | "ruleVersion"
  >,
): Screen04AuditIssue | null {
  const affected = rows.filter((row) => row.issueCodes.includes(code));
  if (affected.length === 0) return null;
  const years = affected.map((row) => row.year);
  return {
    findingCode: code,
    ...values,
    affectedCaseCount: affected.length,
    affectedUnitCount: new Set(affected.map((row) => row.unitId)).size,
    affectedPeriodStart: Math.min(...years),
    affectedPeriodEnd: Math.max(...years),
    softwareVersion: SCREEN_04_AUDIT_ENGINE_VERSION,
    ruleVersion: SCREEN_04_RULE_AST_VERSION,
  };
}

function genericIssue(
  code: string,
  values: Omit<Screen04AuditIssue, "findingCode" | "softwareVersion" | "ruleVersion">,
): Screen04AuditIssue {
  return {
    findingCode: code,
    ...values,
    softwareVersion: SCREEN_04_AUDIT_ENGINE_VERSION,
    ruleVersion: SCREEN_04_RULE_AST_VERSION,
  };
}

function buildAuditedExport(
  rows: readonly RowResult[],
  input: Screen04AuditInput,
): string {
  const header = [
    "unit_id",
    ...(input.mappings.optional.organizationName ? ["organization_name"] : []),
    "time",
    "researcher_treatment_group",
    "researcher_treatment_year",
    "audited_exposure",
    "classification_status",
    "exposure_components",
    "exposure_versions",
    "exposure_starts",
    "classification_reason_code",
    "classification_reason",
    "event_card_id",
    "event_card_version",
    "event_card_fingerprint",
    "screen04_rule_version",
    "screen04_engine_version",
    "shockaudit_application_version",
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push([
      row.unitId,
      ...(input.mappings.optional.organizationName
        ? [row.organizationName ?? ""]
        : []),
      row.year,
      row.group,
      input.mappings.structure.researcherTreatmentYear,
      row.status,
      row.status,
      row.components,
      row.versions,
      row.exposureStarts,
      row.reasonCode,
      row.classificationReason,
      input.eventCardBinding.eventCard.id,
      input.eventCardBinding.eventCard.version,
      input.eventCardBinding.eventCard.fingerprint,
      SCREEN_04_RULE_AST_VERSION,
      SCREEN_04_AUDIT_ENGINE_VERSION,
      SHOCKAUDIT_VERSION,
    ].map(csvCell).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

function buildAffectedExport(
  rows: readonly RowResult[],
  input: Screen04AuditInput,
): { content: string; rowCount: number } {
  const lines = [[
    "unit_id",
    "time",
    "finding_code",
    "audited_exposure",
    "event_card_id",
    "event_card_fingerprint",
    "screen04_rule_version",
    "screen04_engine_version",
    "shockaudit_application_version",
  ].join(",")];
  let count = 0;
  for (const row of rows) {
    for (const code of row.issueCodes) {
      lines.push([
        row.unitId,
        row.year,
        code,
        row.status,
        input.eventCardBinding.eventCard.id,
        input.eventCardBinding.eventCard.fingerprint,
        SCREEN_04_RULE_AST_VERSION,
        SCREEN_04_AUDIT_ENGINE_VERSION,
        SHOCKAUDIT_VERSION,
      ].map(csvCell).join(","));
      count += 1;
    }
  }
  return { content: `${lines.join("\r\n")}\r\n`, rowCount: count };
}

function selectedColumns(input: Screen04AuditInput): string[] {
  const indicators = indicatorValues(input);
  return unique([
    input.mappings.structure.unitIdentifier,
    input.mappings.structure.year,
    input.mappings.structure.treatmentGroup,
    ...(input.mappings.optional.organizationName
      ? [input.mappings.optional.organizationName]
      : []),
    ...(input.mappings.optional.existingPostPeriod && indicators.postPeriod
      ? [input.mappings.optional.existingPostPeriod]
      : []),
    ...(input.mappings.optional.existingUnitPeriodTreatment &&
        indicators.combinedTreatment
      ? [input.mappings.optional.existingUnitPeriodTreatment]
      : []),
    ...Object.values(input.mappings.eventRequirements).filter(
      (value): value is string => value !== null,
    ),
  ]);
}

/** Full deterministic Stage B core; no host/model/messaging capability is read. */
export async function runScreen04Audit(
  input: Screen04AuditInput,
): Promise<Screen04AuditOutput> {
  const hostReasoningTaskAudit = input.hostReasoningTaskAudit === undefined
    ? undefined
    : requireScreen04HostReasoningAudit(
        input.hostReasoningTaskAudit,
        input.eventCardBinding.screen02.runId,
      );
  const leaves = validatePlanAndMappings(input);
  const indicators = indicatorValues(input);
  const effectiveLimitations = unique([
    ...input.eventCardBinding.compilerLimitations.map((item) =>
      stableJson({
        code: item.code,
        message: item.message,
        requirementId: null,
        evidenceIds: [],
      })
    ),
    ...input.auditLimitations.map(stableJson),
    ...(input.exposurePlan.components.length === 0
      ? [stableJson({
          code: "SCREEN04_EXPOSURE_RULE_NOT_EXECUTABLE",
          message:
            "The locked Event Card supplies no explicitly typed exposure component; only the structural partial audit can execute.",
          requirementId: null,
          evidenceIds: input.eventCardBinding.linkedEvidenceIds,
        })]
      : []),
  ]).map((item) => JSON.parse(item) as Screen04AuditLimitation);
  const typedNumericLeaves = input.exposurePlan.components.flatMap((component) =>
    numericLeaves(component.expression)
  );
  const numericStartByRequirement = new Map<string, number>();
  for (const component of input.exposurePlan.components) {
    for (const leaf of numericLeaves(component.expression)) {
      numericStartByRequirement.set(
        leaf.requirementId,
        Math.min(
          numericStartByRequirement.get(leaf.requirementId) ?? Number.POSITIVE_INFINITY,
          component.exposureStartYear,
        ),
      );
    }
  }
  const chosenTimeline = input.eventCardBinding.verifiedTimeline.find(
    (item) => item.proposalId === input.mappings.verifiedTimelineProposalId,
  )!;
  const verifiedYear = Number(chosenTimeline.resolvedDate.slice(0, 4));
  const incompleteExposureBoundary =
    effectiveLimitations.length > 0 ||
    input.missingRequirementIds.length > 0 ||
    input.exposurePlan.components.length === 0;
  const selected = selectedColumns(input);
  if (selected.length > SCREEN_04_AUDIT_LIMITS.maximumSelectedColumns) {
    throw new Error(
      `Screen 4 supports at most ${SCREEN_04_AUDIT_LIMITS.maximumSelectedColumns} selected fields.`,
    );
  }
  const rows: RowResult[] = [];
  const rowsByUnit = new Map<string, RowResult[]>();
  const unitYears = new Set<string>();
  const groupsByUnit = new Map<string, string>();
  const identifierFormats = new Set<ReturnType<typeof unitIdentifierFormat>>();
  const organizationIds = new Map<string, Set<string>>();
  let validCombinedIndicatorRowCount = 0;
  let earliest = Number.POSITIVE_INFINITY;
  let latest = Number.NEGATIVE_INFINITY;
  const structure = input.mappings.structure;
  scanScreen04SelectedCsv(input.csvText, selected, (values, recordNumber) => {
    const unitId = values[structure.unitIdentifier]!;
    if (unitId.trim().length === 0) {
      fail(
        "SCREEN04_MISSING_UNIT_IDENTIFIER",
        `The selected unit identifier is missing at record ${recordNumber}.`,
      );
    }
    const year = parseYear(values[structure.year]!, recordNumber);
    const group = values[structure.treatmentGroup]!;
    if (group !== structure.treatedValue && group !== structure.comparisonValue) {
      fail(
        "SCREEN04_INVALID_TREATMENT_GROUP",
        `The treatment-group variable contains a missing or unmapped category at record ${recordNumber}.`,
      );
    }
    const unitYear = stableJson([unitId, year]);
    if (unitYears.has(unitYear)) {
      fail(
        "SCREEN04_DUPLICATE_UNIT_YEAR",
        `Duplicate unit-year observations occur at record ${recordNumber}.`,
      );
    }
    unitYears.add(unitYear);
    const priorGroup = groupsByUnit.get(unitId);
    if (priorGroup !== undefined && priorGroup !== group) {
      fail(
        "SCREEN04_TREATMENT_GROUP_CHANGES",
        `Treatment-group membership changes within a unit at record ${recordNumber}.`,
      );
    }
    groupsByUnit.set(unitId, group);
    identifierFormats.add(unitIdentifierFormat(unitId));
    earliest = Math.min(earliest, year);
    latest = Math.max(latest, year);
    const organizationName = input.mappings.optional.organizationName
      ? values[input.mappings.optional.organizationName] ?? null
      : null;
    if (organizationName !== null && organizationName.trim().length > 0) {
      const ids = organizationIds.get(organizationName) ?? new Set<string>();
      ids.add(unitId);
      organizationIds.set(organizationName, ids);
    }
    const typedEvaluation = evaluateTypedPlanAtYear(
      input.exposurePlan,
      year,
      values,
      verifiedYear,
    );
    const forcedByUnresolvedBoundary =
      incompleteExposureBoundary && year >= verifiedYear;
    const evaluation: Screen04ExposurePlanEvaluation =
      forcedByUnresolvedBoundary
        ? {
            ...typedEvaluation,
            status: "unknown",
            reasonCode: "SCREEN04_COMPONENT_REQUIREMENT_UNKNOWN",
          }
        : typedEvaluation;
    const ruleReasonCodes = unique(
      evaluation.components.flatMap((item) => item.reasonCodes),
    );
    const unresolvedRequirementIds = unique(
      evaluation.components.flatMap((item) => item.unresolvedRequirementIds),
    );
    const numericValues = Object.create(null) as Record<string, number | null>;
    for (const leaf of typedNumericLeaves) {
      const raw = values[leaf.csvColumn];
      const parsed =
        raw !== undefined &&
        /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(raw) &&
        Number.isFinite(Number(raw))
          ? Number(raw)
          : null;
      numericValues[leaf.requirementId] = parsed;
    }
    const issueCodes: string[] = [];
    if (
      group === structure.treatedValue &&
      year >= structure.researcherTreatmentYear &&
      evaluation.status === "unexposed"
    ) issueCodes.push("SCREEN04_RESEARCHER_TREATED_AUDITED_UNEXPOSED");
    if (
      group === structure.comparisonValue &&
      year >= verifiedYear &&
      evaluation.status === "exposed"
    ) issueCodes.push("SCREEN04_RESEARCHER_COMPARISON_AUDITED_EXPOSED");
    if (
      year >= Math.min(structure.researcherTreatmentYear, verifiedYear) &&
      evaluation.status === "unknown"
    ) issueCodes.push("SCREEN04_EXPOSURE_UNKNOWN");
    if (
      group === structure.treatedValue &&
      year >= structure.researcherTreatmentYear &&
      evaluation.status === "unknown"
    ) issueCodes.push("SCREEN04_RESEARCHER_TREATED_AUDITED_UNKNOWN");
    if (
      group === structure.comparisonValue &&
      year >= verifiedYear &&
      evaluation.status === "unknown"
    ) issueCodes.push("SCREEN04_RESEARCHER_COMPARISON_AUDITED_UNKNOWN");
    if (
      input.mappings.optional.existingPostPeriod !== null &&
      indicators.postPeriod !== null
    ) {
      const raw = values[input.mappings.optional.existingPostPeriod]!;
      const expected = year >= structure.researcherTreatmentYear
        ? indicators.postPeriod.postPeriodValue
        : indicators.postPeriod.prePeriodValue;
      if (raw.trim().length === 0) {
        issueCodes.push("SCREEN04_EXISTING_POST_PERIOD_VALUE_MISSING");
      } else if (
        raw !== indicators.postPeriod.prePeriodValue &&
        raw !== indicators.postPeriod.postPeriodValue
      ) {
        issueCodes.push("SCREEN04_EXISTING_POST_PERIOD_VALUE_UNMAPPED");
      } else if (raw !== expected) {
        issueCodes.push("SCREEN04_EXISTING_POST_PERIOD_MISMATCH");
      }
    }
    if (
      input.mappings.optional.existingUnitPeriodTreatment !== null &&
      indicators.combinedTreatment !== null
    ) {
      const raw = values[
        input.mappings.optional.existingUnitPeriodTreatment
      ]!;
      if (raw.trim().length === 0) {
        issueCodes.push("SCREEN04_EXISTING_TREATMENT_VALUE_MISSING");
      } else if (
        raw !== indicators.combinedTreatment.unexposedValue &&
        raw !== indicators.combinedTreatment.exposedValue
      ) {
        issueCodes.push("SCREEN04_EXISTING_TREATMENT_VALUE_UNMAPPED");
      } else {
        validCombinedIndicatorRowCount += 1;
        if (evaluation.status === "unknown") {
          issueCodes.push("SCREEN04_EXISTING_TREATMENT_NOT_AUDITABLE");
        } else {
          const expected = evaluation.status === "exposed"
            ? indicators.combinedTreatment.exposedValue
            : indicators.combinedTreatment.unexposedValue;
          if (raw !== expected) {
            issueCodes.push("SCREEN04_EXISTING_TREATMENT_MISMATCH");
          }
        }
      }
    }
    if (
      structure.researcherTreatmentYear < verifiedYear &&
      year >= structure.researcherTreatmentYear &&
      year < verifiedYear
    ) issueCodes.push("SCREEN04_TREATMENT_YEAR_PRECEDES_VERIFIED_DATE");
    if (
      structure.researcherTreatmentYear > verifiedYear &&
      year >= verifiedYear &&
      year < structure.researcherTreatmentYear
    ) issueCodes.push("SCREEN04_TREATMENT_YEAR_FOLLOWS_VERIFIED_DATE");
    const componentStatuses = Object.create(null) as Record<
      string,
      Screen04ExposureStatus
    >;
    for (const component of evaluation.components) {
      componentStatuses[component.componentId] = component.status;
    }
    const rowResult: RowResult = {
      unitId,
      organizationName,
      year,
      group,
      status: evaluation.status,
      reasonCode: evaluation.reasonCode,
      classificationReason: classificationReason(
        evaluation,
        input.exposurePlan.components.length > 0,
        forcedByUnresolvedBoundary,
      ),
      components: evaluation.components
        .map((item) => `${item.componentId}:${item.status}`)
        .join(";"),
      versions: unique(
        evaluation.components
          .filter((item) => item.status === "exposed")
          .map((item) => item.exposureVersion),
      ).join(";"),
      exposureStarts: evaluation.components
        .map((item) => `${item.componentId}:${item.exposureStartYear}`)
        .join(";"),
      componentStatuses,
      ruleReasonCodes,
      unresolvedRequirementIds,
      numericValues,
      forcedByUnresolvedBoundary,
      issueCodes,
    };
    rows.push(rowResult);
    const priorRows = rowsByUnit.get(unitId);
    if (priorRows) priorRows.push(rowResult);
    else rowsByUnit.set(unitId, [rowResult]);
  });

  if (identifierFormats.size > 1) {
    addIssueToAllRows(rows, "SCREEN04_MIXED_UNIT_IDENTIFIER_FORMATS");
  }
  const organizationIdentifierUnits = new Set<string>();
  for (const ids of organizationIds.values()) {
    if (ids.size > 1) {
      for (const unitId of ids) organizationIdentifierUnits.add(unitId);
    }
  }
  addIssueToUnitHistory(
    rows,
    organizationIdentifierUnits,
    "SCREEN04_ORGANIZATION_IDENTIFIER_CHANGES",
  );

  const annualGapUnits = new Set<string>();
  let missingAnnualPeriodCount = 0;
  for (const [unitId, unitRows] of rowsByUnit) {
    const sortedRows = [...unitRows].sort((left, right) => left.year - right.year);
    for (let index = 1; index < sortedRows.length; index += 1) {
      const prior = sortedRows[index - 1]!;
      const current = sortedRows[index]!;
      const gap = current.year - prior.year - 1;
      if (gap < 1) continue;
      annualGapUnits.add(unitId);
      missingAnnualPeriodCount += gap;
      // The absent unit-years have no source rows to export. Tag only the
      // first observed row after each gap as the predicate-bearing boundary;
      // the issue evidence separately records the number of absent slots.
      addIssue(current, "SCREEN04_MISSING_WITHIN_UNIT_YEARS");
    }
  }

  // Propagate deterministic evaluator failures to an issue rather than hiding
  // the precise numeric reason behind a package-level `unknown` status.
  for (const row of rows) {
    if (row.ruleReasonCodes.includes("SCREEN04_RULE_UNIT_MISMATCH")) {
      addIssue(row, "SCREEN04_RULE_UNIT_MISMATCH");
    }
  }

  // A missing operative threshold value is especially consequential when the
  // same unit has a source value within one percent of the verified boundary.
  // This is a classification warning only; it never imputes the missing value.
  for (const leaf of typedNumericLeaves) {
    const nearDistance = Math.max(1, Math.abs(leaf.threshold) * 0.01);
    const operativeYear = numericStartByRequirement.get(leaf.requirementId);
    if (operativeYear === undefined) continue;
    for (const unitRows of rowsByUnit.values()) {
      for (const row of unitRows) {
        if (
          row.year >= operativeYear &&
          row.numericValues[leaf.requirementId] === leaf.threshold
        ) {
          addIssue(row, "SCREEN04_EXACT_THRESHOLD_BOUNDARY");
        }
      }
      const isNearBoundary = unitRows.some((row) => {
        const value = row.numericValues[leaf.requirementId];
        return value !== null && value !== undefined &&
          Math.abs(value - leaf.threshold) <= nearDistance;
      });
      if (!isNearBoundary) continue;
      for (const row of unitRows) {
        if (
          row.year >= operativeYear &&
          row.unresolvedRequirementIds.includes(leaf.requirementId)
        ) {
          addIssue(row, "SCREEN04_UNKNOWN_NEAR_THRESHOLD");
        }
      }
    }
  }

  const minimumComponentStart = input.exposurePlan.components.length > 0
    ? Math.min(
        ...input.exposurePlan.components.map(
          (component) => component.exposureStartYear,
        ),
      )
    : verifiedYear;
  const treatedUnitsWithoutPreExposure = new Set<string>();
  if (input.exposurePlan.components.length > 0) {
    for (const [unitId, unitRows] of rowsByUnit) {
      if (
        groupsByUnit.get(unitId) === structure.treatedValue &&
        !unitRows.some((row) => row.year < minimumComponentStart)
      ) {
        treatedUnitsWithoutPreExposure.add(unitId);
      }
    }
  }
  addIssueToUnitHistory(
    rows,
    treatedUnitsWithoutPreExposure,
    "SCREEN04_TREATED_UNIT_NO_PRE_EXPOSURE_PERIOD",
  );

  if (input.exposurePlan.exposurePersistence === "permanent-once-exposed") {
    for (const unitRows of rowsByUnit.values()) {
      let observedExposed = false;
      for (const row of [...unitRows].sort((left, right) => left.year - right.year)) {
        if (row.status === "exposed") observedExposed = true;
        else if (observedExposed && row.status === "unexposed") {
          addIssue(row, "SCREEN04_EXPOSURE_STATUS_REVERSED");
        }
      }
    }
  }

  const usableExposureRows = rows.filter(
    (row) => row.year >= minimumComponentStart && row.status !== "not_applicable",
  );
  const unknownUsableRows = usableExposureRows.filter(
    (row) => row.status === "unknown",
  );
  const knownUsableCount = usableExposureRows.length - unknownUsableRows.length;
  if (
    unknownUsableRows.length > 0 &&
    unknownUsableRows.length > knownUsableCount
  ) {
    for (const row of unknownUsableRows) {
      addIssue(row, "SCREEN04_UNKNOWN_EXPOSURE_DOMINATES_VARIATION");
    }
  }
  const baselineVersion = input.exposurePlan.components[0]?.exposureVersion;
  const laterComponents = input.exposurePlan.components.filter(
    (component) =>
      component.exposureStartYear > minimumComponentStart ||
      component.exposureVersion !== baselineVersion,
  );
  for (const [unitId, unitRows] of rowsByUnit) {
    if (groupsByUnit.get(unitId) !== structure.comparisonValue) continue;
    for (const component of laterComponents) {
      const hasObservedPreAmendmentComparison = unitRows.some(
        (row) =>
          row.year < component.exposureStartYear && row.status !== "exposed",
      );
      if (!hasObservedPreAmendmentComparison) continue;
      for (const row of unitRows) {
        if (
          row.year >= component.exposureStartYear &&
          row.componentStatuses[component.componentId] === "exposed"
        ) {
          addIssue(row, "SCREEN04_COMPARISON_CONTAMINATED_AFTER_AMENDMENT");
        }
      }
    }
  }

  const sampleStartsAfterUniversalExposure =
    earliest > structure.researcherTreatmentYear &&
    rows.every((row) => row.status === "exposed");
  if (sampleStartsAfterUniversalExposure) {
    addIssueToAllRows(rows, "SCREEN04_SAMPLE_STARTS_AFTER_UNIVERSAL_EXPOSURE");
  }
  const postTreatmentRows = rows.filter(
    (row) => row.year >= structure.researcherTreatmentYear,
  );
  if (
    postTreatmentRows.length > 0 &&
    postTreatmentRows.every((row) => row.status === "exposed")
  ) {
    for (const row of postTreatmentRows) {
      addIssue(row, "SCREEN04_ALL_UNITS_EXPOSED_AFTER_TREATMENT_YEAR");
    }
  }
  const operativeComponentRows = rows.filter(
    (row) => row.year >= minimumComponentStart,
  );
  if (
    operativeComponentRows.length > 0 &&
    operativeComponentRows.every((row) => row.status === "unexposed")
  ) {
    for (const row of operativeComponentRows) {
      addIssue(row, "SCREEN04_NO_EXPOSED_UNITS");
    }
  }

  const componentIds = input.exposurePlan.components.map(
    (component) => component.componentId,
  );
  const perfectlyBundled =
    componentIds.length > 1 &&
    rows.every(
      (row) =>
        new Set(componentIds.map((id) => row.componentStatuses[id])).size === 1,
    );
  if (
    input.mappings.optional.existingUnitPeriodTreatment !== null &&
    indicators.combinedTreatment !== null &&
    validCombinedIndicatorRowCount === rows.length &&
    componentIds.length > 1
  ) {
    addIssueToAllRows(
      rows,
      perfectlyBundled
        ? "SCREEN04_COMPONENTS_PERFECTLY_BUNDLED"
        : "SCREEN04_COMPONENTS_COLLAPSED",
    );
  }

  const csvFingerprint = await sha256(input.csvText);
  const issues: Screen04AuditIssue[] = [];
  const evidenceIds = unique(
    input.exposurePlan.components.flatMap((item) => item.evidenceIds),
  );
  const rowIssueDefinitions: Array<{
    code: string;
    values: Parameters<typeof issueFromRows>[2];
  }> = [
    {
      code: "SCREEN04_MISSING_WITHIN_UNIT_YEARS",
      values: {
        severity: "major",
        title: "Unit histories contain missing annual periods",
        eventCardRequirement: "Annual unit-period structure",
        datasetEvidence: `${missingAnnualPeriodCount} annual unit-period slots are absent within the observed histories of ${annualGapUnits.size} units; affected rows are the first observed boundaries after those gaps.`,
        exposureDesignConsequence: "Exposure transitions across the missing periods cannot be directly observed.",
        concreteSuggestion: "Add the missing annual rows or document and preserve the panel gaps before interpreting exposure transitions.",
        blocksFullExposure: false,
        eventCardEvidenceIds: [],
      },
    },
    {
      code: "SCREEN04_MIXED_UNIT_IDENTIFIER_FORMATS",
      values: {
        severity: "major",
        title: "Unit identifiers use mixed formats",
        eventCardRequirement: "Stable unit-period identifier",
        datasetEvidence: `The selected unit field contains ${identifierFormats.size} distinct deterministic formats: ${[...identifierFormats].sort().join(", ")}.`,
        exposureDesignConsequence: "Mixed identifier representations can split or conflate longitudinal unit histories.",
        concreteSuggestion: "Confirm one stable identifier format and create a source-documented crosswalk before rerunning the audit.",
        blocksFullExposure: false,
        eventCardEvidenceIds: [],
      },
    },
    {
      code: "SCREEN04_ORGANIZATION_IDENTIFIER_CHANGES",
      values: {
        severity: "major",
        title: "One organization label maps to multiple identifiers",
        eventCardRequirement: "Stable organization-level unit identifier",
        datasetEvidence: "The same nonempty exact organization label appears with more than one selected unit identifier.",
        exposureDesignConsequence: "Longitudinal exposure may be split across identifiers, although a nonunique label alone cannot prove an identifier change.",
        concreteSuggestion: "Verify identifier continuity with a source-documented crosswalk; do not merge units from the label alone.",
        blocksFullExposure: false,
        eventCardEvidenceIds: [],
      },
    },
    {
      code: "SCREEN04_TREATMENT_YEAR_PRECEDES_VERIFIED_DATE",
      values: {
        severity: "major",
        title: "Selected treatment year precedes the verified timeline entry",
        eventCardRequirement: chosenTimeline.label,
        datasetEvidence: `The selected ${structure.researcherTreatmentYear} treatment year precedes the verified ${verifiedYear} date.`,
        exposureDesignConsequence: "The proposed coding begins before the chosen verified intervention stage.",
        concreteSuggestion: "Review the selected treatment year or explicitly choose another verified Event Card timeline scenario.",
        blocksFullExposure: false,
        eventCardEvidenceIds: chosenTimeline.sourceIds,
      },
    },
    {
      code: "SCREEN04_TREATMENT_YEAR_FOLLOWS_VERIFIED_DATE",
      values: {
        severity: "warning",
        title: "Selected treatment year follows the verified timeline entry",
        eventCardRequirement: chosenTimeline.label,
        datasetEvidence: `The selected ${structure.researcherTreatmentYear} treatment year follows the verified ${verifiedYear} date.`,
        exposureDesignConsequence: "The proposed coding omits observed periods after the chosen verified intervention stage.",
        concreteSuggestion: "Review the selected treatment year against the chosen verified Event Card date.",
        blocksFullExposure: false,
        eventCardEvidenceIds: chosenTimeline.sourceIds,
      },
    },
    {
      code: "SCREEN04_EXISTING_POST_PERIOD_VALUE_MISSING",
      values: {
        severity: "major",
        title: "Existing post-period values are missing",
        eventCardRequirement: "Explicit existing post-period value mapping",
        datasetEvidence: "The confirmed existing post-period column is empty in affected rows.",
        exposureDesignConsequence: "The researcher's existing post-period coding cannot be checked for those periods.",
        concreteSuggestion: "Restore the missing binary period values or leave the optional indicator unmapped.",
        blocksFullExposure: false,
        eventCardEvidenceIds: [],
      },
    },
    {
      code: "SCREEN04_EXISTING_POST_PERIOD_VALUE_UNMAPPED",
      values: {
        severity: "major",
        title: "Existing post-period values are outside the confirmed mapping",
        eventCardRequirement: "Explicit existing post-period value mapping",
        datasetEvidence: "Affected values match neither the explicitly confirmed pre-period nor post-period token.",
        exposureDesignConsequence: "The optional post-period indicator has categories that fixed software cannot interpret.",
        concreteSuggestion: "Confirm exact tokens for every supported category or provide a clean binary post-period field.",
        blocksFullExposure: false,
        eventCardEvidenceIds: [],
      },
    },
    {
      code: "SCREEN04_EXISTING_POST_PERIOD_MISMATCH",
      values: {
        severity: "major",
        title: "Existing post-period coding disagrees with the selected year",
        eventCardRequirement: "Researcher-selected treatment year",
        datasetEvidence: "The confirmed post-period token does not match whether the row is before or on/after the selected treatment year.",
        exposureDesignConsequence: "The researcher's existing time indicator uses a different period boundary.",
        concreteSuggestion: "Review the affected years and recode the post-period indicator from the confirmed treatment-year choice.",
        blocksFullExposure: false,
        eventCardEvidenceIds: chosenTimeline.sourceIds,
      },
    },
    {
      code: "SCREEN04_EXISTING_TREATMENT_VALUE_MISSING",
      values: {
        severity: "major",
        title: "Existing combined-treatment values are missing",
        eventCardRequirement: "Explicit existing combined-treatment value mapping",
        datasetEvidence: "The confirmed existing unit-period treatment column is empty in affected rows.",
        exposureDesignConsequence: "The existing coding cannot be compared with audited exposure for those rows.",
        concreteSuggestion: "Restore the missing indicator values or leave the optional indicator unmapped.",
        blocksFullExposure: false,
        eventCardEvidenceIds: evidenceIds,
      },
    },
    {
      code: "SCREEN04_EXISTING_TREATMENT_VALUE_UNMAPPED",
      values: {
        severity: "major",
        title: "Existing combined-treatment values are outside the confirmed mapping",
        eventCardRequirement: "Explicit existing combined-treatment value mapping",
        datasetEvidence: "Affected values match neither the explicitly confirmed exposed nor unexposed token.",
        exposureDesignConsequence: "Fixed software cannot compare the unsupported categories with audited exposure.",
        concreteSuggestion: "Confirm exact tokens for every supported category or provide a clean binary unit-period indicator.",
        blocksFullExposure: false,
        eventCardEvidenceIds: evidenceIds,
      },
    },
    {
      code: "SCREEN04_EXISTING_TREATMENT_NOT_AUDITABLE",
      values: {
        severity: "warning",
        title: "Existing treatment coding cannot be checked where exposure is unknown",
        eventCardRequirement: "Executable typed exposure rule",
        datasetEvidence: "The existing combined-treatment token is valid, but audited exposure remains unknown for affected rows.",
        exposureDesignConsequence: "Agreement or disagreement cannot be asserted for those cases.",
        concreteSuggestion: "Resolve the missing exposure requirements before comparing the existing combined indicator.",
        blocksFullExposure: false,
        eventCardEvidenceIds: evidenceIds,
      },
    },
    {
      code: "SCREEN04_EXISTING_TREATMENT_MISMATCH",
      values: {
        severity: "major",
        title: "Existing combined-treatment coding disagrees with audited exposure",
        eventCardRequirement: "Typed Event Card exposure plan",
        datasetEvidence: "The explicitly confirmed existing indicator token differs from the deterministic audited exposure classification.",
        exposureDesignConsequence: "The researcher's unit-period treatment coding includes miscoded rows.",
        concreteSuggestion: "Use the affected-cases export to repair the combined treatment indicator.",
        blocksFullExposure: false,
        eventCardEvidenceIds: evidenceIds,
      },
    },
    {
      code: "SCREEN04_RESEARCHER_TREATED_AUDITED_UNEXPOSED",
      values: {
        severity: "major",
        title: "Current treatment coding is too broad",
        eventCardRequirement: "Typed Event Card exposure plan",
        datasetEvidence: "Researcher-treated unit-periods fail the independently compiled exposure rule.",
        exposureDesignConsequence: "The proposed treated group includes audited-unexposed cases.",
        concreteSuggestion: "Review the affected-cases export and revise the proposed treatment coding or confirmed rule mapping.",
        blocksFullExposure: false,
        eventCardEvidenceIds: evidenceIds,
      },
    },
    {
      code: "SCREEN04_RESEARCHER_COMPARISON_AUDITED_EXPOSED",
      values: {
        severity: "major",
        title: "The proposed comparison contains exposed cases",
        eventCardRequirement: "Typed Event Card exposure plan",
        datasetEvidence: "Researcher-comparison unit-periods satisfy at least one operative exposure component.",
        exposureDesignConsequence: "The proposed comparison is contaminated by the verified focal shock.",
        concreteSuggestion: "Review affected comparison cases and periods before relying on the proposed group coding.",
        blocksFullExposure: false,
        eventCardEvidenceIds: evidenceIds,
      },
    },
    {
      code: "SCREEN04_RESEARCHER_TREATED_AUDITED_UNKNOWN",
      values: {
        severity: "major",
        title: "Researcher-treated exposure remains unknown",
        eventCardRequirement: "Mapped Event Card requirements",
        datasetEvidence: "Post-treatment unit-periods in the researcher-treated group cannot be independently classified from the selected fields.",
        exposureDesignConsequence: "The proposed treated coding is not independently verified for these cases.",
        concreteSuggestion: "Recover the required historical exposure fields and preserve the affected classifications as unknown meanwhile.",
        blocksFullExposure: true,
        eventCardEvidenceIds: evidenceIds,
      },
    },
    {
      code: "SCREEN04_RESEARCHER_COMPARISON_AUDITED_UNKNOWN",
      values: {
        severity: "major",
        title: "Researcher-comparison exposure remains unknown",
        eventCardRequirement: "Mapped Event Card requirements",
        datasetEvidence: "Operative unit-periods in the researcher-comparison group cannot be independently classified from the selected fields.",
        exposureDesignConsequence: "ShockAudit cannot verify that these proposed comparison cases are unexposed.",
        concreteSuggestion: "Recover the required historical exposure fields or exclude unsupported comparison periods from the claimed contrast.",
        blocksFullExposure: true,
        eventCardEvidenceIds: evidenceIds,
      },
    },
    {
      code: "SCREEN04_EXPOSURE_UNKNOWN",
      values: {
        severity: "major",
        title: "Exposure remains unknown for affected unit-periods",
        eventCardRequirement: "Mapped Event Card requirements",
        datasetEvidence: "At least one operative typed requirement is missing, invalid, or uses an incompatible unit.",
        exposureDesignConsequence: "ShockAudit cannot independently classify these cases as unexposed.",
        concreteSuggestion: "Supply the missing historical exposure field or preserve these classifications as unknown.",
        blocksFullExposure: true,
        eventCardEvidenceIds: evidenceIds,
      },
    },
    {
      code: "SCREEN04_RULE_UNIT_MISMATCH",
      values: {
        severity: "blocking",
        title: "Threshold units do not match",
        eventCardRequirement: "Typed numeric Event Card threshold",
        datasetEvidence: "The mapped numeric field uses a different explicit unit from the verified threshold.",
        exposureDesignConsequence: "The threshold cannot be applied without an explicit, verified unit conversion.",
        concreteSuggestion: "Map a field in the verified unit or explicitly construct and confirm a correctly converted field.",
        blocksFullExposure: true,
        eventCardEvidenceIds: evidenceIds,
      },
    },
    {
      code: "SCREEN04_UNKNOWN_NEAR_THRESHOLD",
      values: {
        severity: "major",
        title: "Exposure is unknown near the assignment threshold",
        eventCardRequirement: "Typed numeric Event Card threshold",
        datasetEvidence: "An operative threshold value is missing for a unit whose observed source value lies within one percent of the verified boundary.",
        exposureDesignConsequence: "The missing value can change which side of the exposure boundary the unit occupies.",
        concreteSuggestion: "Recover the required historical threshold value; do not impute exposure as zero.",
        blocksFullExposure: false,
        eventCardEvidenceIds: evidenceIds,
      },
    },
    {
      code: "SCREEN04_EXACT_THRESHOLD_BOUNDARY",
      values: {
        severity: "warning",
        title: "Observed values lie exactly on the assignment threshold",
        eventCardRequirement: "Typed inclusive or exclusive numeric threshold",
        datasetEvidence: "The selected numeric field equals the exact typed threshold in operative unit-periods; the configured operator determines their classification.",
        exposureDesignConsequence: "Changing threshold inclusivity would change the affected classifications.",
        concreteSuggestion: "Confirm the source-supported inclusive or exclusive operator and retain the boundary cases in the audit record.",
        blocksFullExposure: false,
        eventCardEvidenceIds: evidenceIds,
      },
    },
    {
      code: "SCREEN04_TREATED_UNIT_NO_PRE_EXPOSURE_PERIOD",
      values: {
        severity: "major",
        title: "Treated units lack an observed pre-exposure period",
        eventCardRequirement: "Typed component exposure start",
        datasetEvidence: "Affected researcher-treated units have no observation before the earliest typed exposure-component start.",
        exposureDesignConsequence: "The uploaded sample does not show an observed pre-exposure classification for these treated units.",
        concreteSuggestion: "Extend the exposure-only panel earlier or narrow the supported sample-window claim.",
        blocksFullExposure: false,
        eventCardEvidenceIds: evidenceIds,
      },
    },
    {
      code: "SCREEN04_EXPOSURE_STATUS_REVERSED",
      values: {
        severity: "major",
        title: "Permanent exposure reverses in later observations",
        eventCardRequirement: "Explicit permanent-once-exposed rule plan",
        datasetEvidence: "After a unit is audited-exposed, a later operative observation is audited-unexposed despite the plan's explicit permanence setting.",
        exposureDesignConsequence: "The mapped fields or rule plan contradict permanent exposure persistence.",
        concreteSuggestion: "Verify historical values, identifier continuity, and whether the Event Card truly supports permanent exposure.",
        blocksFullExposure: false,
        eventCardEvidenceIds: evidenceIds,
      },
    },
    {
      code: "SCREEN04_UNKNOWN_EXPOSURE_DOMINATES_VARIATION",
      values: {
        severity: "major",
        title: "Unknown exposure dominates usable classifications",
        eventCardRequirement: "Executable mapped Event Card requirements",
        datasetEvidence: `${unknownUsableRows.length} operative classifications are unknown versus ${knownUsableCount} known exposed or unexposed classifications.`,
        exposureDesignConsequence: "The observed exposure contrast is driven more by unavailable classifications than by known exposure variation.",
        concreteSuggestion: "Recover the missing historical exposure fields before treating the remaining known contrast as representative of the sample.",
        blocksFullExposure: false,
        eventCardEvidenceIds: evidenceIds,
      },
    },
    {
      code: "SCREEN04_COMPARISON_CONTAMINATED_AFTER_AMENDMENT",
      values: {
        severity: "major",
        title: "The comparison becomes exposed under a later version",
        eventCardRequirement: "Typed component and version exposure plan",
        datasetEvidence: "Proposed comparison units are initially unexposed and later satisfy a component with a later start or version.",
        exposureDesignConsequence: "The original comparison group no longer remains unexposed after the later version begins.",
        concreteSuggestion: "Review the affected units and years and represent the later version separately.",
        blocksFullExposure: false,
        eventCardEvidenceIds: evidenceIds,
      },
    },
    {
      code: "SCREEN04_ALL_UNITS_EXPOSED_AFTER_TREATMENT_YEAR",
      values: {
        severity: "blocking",
        title: "All units are exposed after the selected treatment year",
        eventCardRequirement: "Typed Event Card exposure plan",
        datasetEvidence: "Every observed unit is audited-exposed in every period on or after the selected treatment year.",
        exposureDesignConsequence: "The observed post-treatment sample has no audited-unexposed comparison.",
        concreteSuggestion: "Revise the sample or claim boundary; Screen 4 will not optimize a control group.",
        blocksFullExposure: true,
        eventCardEvidenceIds: evidenceIds,
      },
    },
    {
      code: "SCREEN04_NO_EXPOSED_UNITS",
      values: {
        severity: "blocking",
        title: "No unit is audited as exposed",
        eventCardRequirement: "Typed Event Card exposure plan",
        datasetEvidence: "No observed unit-period satisfies an operative exposure component.",
        exposureDesignConsequence: "The sample contains no audited-exposed cases for the proposed contrast.",
        concreteSuggestion: "Check the sample scope, exact mappings, and source-linked eligibility rule.",
        blocksFullExposure: true,
        eventCardEvidenceIds: evidenceIds,
      },
    },
    {
      code: "SCREEN04_SAMPLE_STARTS_AFTER_UNIVERSAL_EXPOSURE",
      values: {
        severity: "blocking",
        title: "The sample starts after exposure is already universal",
        eventCardRequirement: "Verified exposure timing and typed coverage plan",
        datasetEvidence: "The first observed year follows the selected treatment year and every observed unit-period is exposed.",
        exposureDesignConsequence: "The file contains neither an observed pre-exposure period nor an unexposed comparison.",
        concreteSuggestion: "Extend the sample earlier or narrow the supported research claim.",
        blocksFullExposure: true,
        eventCardEvidenceIds: evidenceIds,
      },
    },
    {
      code: "SCREEN04_COMPONENTS_COLLAPSED",
      values: {
        severity: "major",
        title: "One treatment indicator collapses distinct components",
        eventCardRequirement: "Separate typed Event Card treatment components",
        datasetEvidence: "The explicitly mapped combined treatment indicator represents components whose observed statuses, start years, or versions differ.",
        exposureDesignConsequence: "The current binary coding combines substantively or temporally distinct exposure stages.",
        concreteSuggestion: "Retain component-level exposure unless only package-level exposure is supported.",
        blocksFullExposure: false,
        eventCardEvidenceIds: evidenceIds,
      },
    },
    {
      code: "SCREEN04_COMPONENTS_PERFECTLY_BUNDLED",
      values: {
        severity: "warning",
        title: "Treatment components are perfectly bundled in this sample",
        eventCardRequirement: "Separate typed Event Card treatment components",
        datasetEvidence: "Every observed row has the same classification across all mapped components.",
        exposureDesignConsequence: "The sample cannot distinguish component-specific exposure variation.",
        concreteSuggestion: "Represent the result as package-level exposure and avoid component-specific claims unless another sample supplies independent variation.",
        blocksFullExposure: false,
        eventCardEvidenceIds: evidenceIds,
      },
    },
  ];
  for (const definition of rowIssueDefinitions) {
    const item = issueFromRows(rows, definition.code, definition.values);
    if (item) issues.push(item);
  }

  const unassessed = unique([
    ...input.missingRequirementIds,
    ...leaves
      .filter((leaf) => input.mappings.eventRequirements[leaf.requirementId] === null)
      .map((leaf) => leaf.requirementId),
    ...effectiveLimitations
      .map((item) => item.requirementId)
      .filter((value): value is string => value !== null),
  ]).sort();
  const forcedUnknownRows = rows.filter(
    (row) => row.forcedByUnresolvedBoundary && row.status === "unknown",
  );
  for (const limitation of effectiveLimitations) {
    for (const row of forcedUnknownRows) addIssue(row, limitation.code);
    if (!issues.some((item) => item.findingCode === limitation.code)) {
      const values: Parameters<typeof issueFromRows>[2] = {
        severity: "blocking",
        title: "Event Card requirement is not machine-executable",
        eventCardRequirement: limitation.requirementId ?? "Screen 3 compiler contract",
        datasetEvidence: limitation.message,
        exposureDesignConsequence: "This dimension was not included in the independent exposure classification.",
        concreteSuggestion: "Confirm an explicitly typed, source-linked rule and exact CSV mapping; do not infer it from prose.",
        blocksFullExposure: true,
        eventCardEvidenceIds: limitation.evidenceIds,
      };
      const affected = issueFromRows(rows, limitation.code, values);
      issues.push(affected ?? genericIssue(limitation.code, {
        ...values,
        affectedCaseCount: 0,
        affectedUnitCount: 0,
        affectedPeriodStart: null,
        affectedPeriodEnd: null,
      }));
    }
  }
  if (unassessed.length > 0) {
    const unassessedSet = new Set(unassessed);
    const missingRequirementRows = rows.filter(
      (row) =>
        row.forcedByUnresolvedBoundary ||
        row.unresolvedRequirementIds.some((id) => unassessedSet.has(id)),
    );
    for (const row of missingRequirementRows) {
      addIssue(row, "SCREEN04_REQUIRED_EXPOSURE_VARIABLE_NOT_MAPPED");
    }
    const values: Parameters<typeof issueFromRows>[2] = {
      severity: "blocking",
      title: "Required exposure variables are not mapped",
      eventCardRequirement: unassessed.join(", "),
      datasetEvidence: `${unassessed.length} explicit requirement mappings are unavailable.`,
      exposureDesignConsequence: "Full exposure cannot be independently verified from this file.",
      concreteSuggestion: "Map the exact historical fields or preserve dependent classifications as unknown.",
      blocksFullExposure: true,
      eventCardEvidenceIds: evidenceIds,
    };
    const affected = issueFromRows(
      rows,
      "SCREEN04_REQUIRED_EXPOSURE_VARIABLE_NOT_MAPPED",
      values,
    );
    issues.push(affected ?? genericIssue(
      "SCREEN04_REQUIRED_EXPOSURE_VARIABLE_NOT_MAPPED",
      {
        ...values,
        affectedCaseCount: 0,
        affectedUnitCount: 0,
        affectedPeriodStart: null,
        affectedPeriodEnd: null,
      },
    ));
  }
  const treatedUnits = new Set(
    rows.filter((row) => row.group === structure.treatedValue).map((row) => row.unitId),
  );
  const comparisonUnits = new Set(
    rows.filter((row) => row.group === structure.comparisonValue).map((row) => row.unitId),
  );
  if (treatedUnits.size === 0 || comparisonUnits.size === 0) {
    const missing = treatedUnits.size === 0 ? "treated" : "comparison";
    const code = `SCREEN04_NO_${missing.toUpperCase()}_UNITS`;
    addIssueToAllRows(rows, code);
    issues.push(genericIssue(code, {
      severity: "blocking",
      title: `No ${missing} units are present`,
      eventCardRequirement: "Researcher treatment-group mapping",
      datasetEvidence: `The explicit mapping identifies zero ${missing} units.`,
      affectedCaseCount: rows.length,
      affectedUnitCount: groupsByUnit.size,
      affectedPeriodStart: earliest,
      affectedPeriodEnd: latest,
      exposureDesignConsequence: "The proposed exposed-versus-comparison contrast cannot be compiled.",
      concreteSuggestion: "Correct the explicit group values or provide a file containing both groups.",
      blocksFullExposure: true,
      eventCardEvidenceIds: [],
    }));
  }
  if (
    structure.researcherTreatmentYear < earliest ||
    structure.researcherTreatmentYear > latest
  ) {
    addIssueToAllRows(rows, "SCREEN04_TREATMENT_YEAR_OUTSIDE_SAMPLE");
    issues.push(genericIssue("SCREEN04_TREATMENT_YEAR_OUTSIDE_SAMPLE", {
      severity: "major",
      title: "Selected treatment year falls outside the sample",
      eventCardRequirement: chosenTimeline.label,
      datasetEvidence: `The sample runs from ${earliest} through ${latest}, while the selected year is ${structure.researcherTreatmentYear}.`,
      affectedCaseCount: rows.length,
      affectedUnitCount: groupsByUnit.size,
      affectedPeriodStart: earliest,
      affectedPeriodEnd: latest,
      exposureDesignConsequence: "The proposed sample contains no complete observed transition at the selected year.",
      concreteSuggestion: "Review the sample window or treatment year without inspecting an outcome.",
      blocksFullExposure: false,
      eventCardEvidenceIds: chosenTimeline.sourceIds,
    }));
  }

  const counts = {
    exposed: 0,
    unexposed: 0,
    unknown: 0,
    not_applicable: 0,
    total: rows.length,
  };
  for (const row of rows) counts[row.status] += 1;
  const hasPartialBoundary =
    effectiveLimitations.length > 0 || unassessed.length > 0;
  const hasBlocking = issues.some((item) => item.severity === "blocking");
  const hasMajor = issues.some((item) => item.severity === "major");
  const hasWarning = issues.some((item) => item.severity === "warning");
  const overallStatus: Screen04AuditOverallStatus = hasPartialBoundary
    ? "partial-audit-only"
    : hasBlocking
      ? "exposure-requires-redesign"
      : hasMajor || hasWarning
        ? "proceed-with-repairs"
        : "exposure-coding-is-executable";
  const auditedContent = buildAuditedExport(rows, input);
  const affected = buildAffectedExport(rows, input);
  const auditedFingerprint = await sha256(auditedContent);
  const affectedFingerprint = await sha256(affected.content);
  const hasExecutableExposurePlan =
    input.exposurePlan.components.length > 0 &&
    effectiveLimitations.length === 0 &&
    unassessed.length === 0;
  const completedAuditDimensions = [
    "exact-header-mapping",
    "annual-unit-year-structure",
    "treatment-group-consistency",
    "treatment-year-alignment",
    ...(hasExecutableExposurePlan
      ? [
          "typed-event-card-rule",
          "researcher-coding-comparison",
          "exposure-variation",
          "component-level-exposure",
        ]
      : []),
  ];
  const unassessedCompilerCodes = unique(
    effectiveLimitations.map((item) => item.code),
  ).sort();
  const unassessedAuditChecks = [
    ...(input.mappings.optional.organizationName === null
      ? [{
          code: "SCREEN04_IDENTIFIER_CONTINUITY_NOT_IDENTIFIABLE",
          message:
            "No organization-name field was selected, so fixed software cannot screen for one exact organization label appearing under multiple identifiers. External identifier continuity is not inferred.",
        }]
      : []),
    ...(input.mappings.optional.existingPostPeriod !== null &&
        indicators.postPeriod === null
      ? [{
          code: "SCREEN04_EXISTING_POST_PERIOD_VALUES_NOT_CONFIRMED",
          message:
            "An existing post-period column was mapped without explicit pre/post value semantics; fixed software did not select or inspect that column.",
        }]
      : []),
    ...(input.mappings.optional.existingUnitPeriodTreatment !== null &&
        indicators.combinedTreatment === null
      ? [{
          code: "SCREEN04_EXISTING_TREATMENT_VALUES_NOT_CONFIRMED",
          message:
            "An existing combined-treatment column was mapped without explicit exposed/unexposed value semantics; fixed software did not select or inspect that column.",
        }]
      : []),
    ...(input.exposurePlan.components.length > 0 &&
        input.exposurePlan.exposurePersistence === undefined
      ? [{
          code: "SCREEN04_EXPOSURE_PERMANENCE_NOT_MACHINE_TYPED",
          message:
            "The typed exposure plan does not state whether exposure is permanent once reached, so reversal checks were not run.",
        }]
      : []),
  ];
  const fingerprintInput = {
    schemaVersion: SCREEN_04_AUDIT_SCHEMA_VERSION,
    engineVersion: SCREEN_04_AUDIT_ENGINE_VERSION,
    ruleVersion: SCREEN_04_RULE_AST_VERSION,
    applicationVersion: SHOCKAUDIT_VERSION,
    csvFingerprint,
    eventCardBinding: input.eventCardBinding,
    mappings: input.mappings,
    indicatorValueMappings: input.indicatorValueMappings ?? null,
    exposurePlan: input.exposurePlan,
    auditLimitations: effectiveLimitations,
    missingRequirementIds: unassessed,
    selectedColumns: selected,
    rowCount: rows.length,
    unitCount: groupsByUnit.size,
    observedYearRange: { earliest, latest },
    classificationCounts: counts,
    completedAuditDimensions,
    unassessedCompilerCodes,
    unassessedAuditChecks,
    overallStatus,
    issues,
    auditedFingerprint,
    affectedFingerprint,
  };
  const resultFingerprint = await sha256(stableJson(fingerprintInput));
  const reportContent = `${stableJson({
    schemaVersion: "screen-04-exposure-audit-report-v1",
    applicationVersion: SHOCKAUDIT_VERSION,
    selectedShock: input.eventCardBinding.verifiedShockName,
    screen02: input.eventCardBinding.screen02,
    screen03: input.eventCardBinding.screen03,
    eventCard: input.eventCardBinding.eventCard,
    csvFingerprint,
    exactSelectedMappings: input.mappings,
    indicatorValueMappings: input.indicatorValueMappings ?? null,
    verifiedTimelineProposalId: input.mappings.verifiedTimelineProposalId,
    eventCardUnresolvedLimitations:
      input.eventCardBinding.unresolvedLimitations,
    auditLimitations: effectiveLimitations,
    unassessedCompilerCodes,
    unassessedAuditChecks,
    completedAuditDimensions,
    unassessedRequirementIds: unassessed,
    issues,
    classificationCounts: counts,
    overallStatus,
    calculationVersion: SCREEN_04_AUDIT_ENGINE_VERSION,
    resultFingerprint,
    ...(hostReasoningTaskAudit === undefined
      ? {}
      : { hostReasoningTaskAudit }),
  })}\n`;
  const reportFingerprint = await sha256(reportContent);
  return {
    publicResult: {
      schemaVersion: SCREEN_04_AUDIT_SCHEMA_VERSION,
      engineVersion: SCREEN_04_AUDIT_ENGINE_VERSION,
      ruleVersion: SCREEN_04_RULE_AST_VERSION,
      applicationVersion: SHOCKAUDIT_VERSION,
      executionMode: SCREEN_04_EXECUTION_MODE,
      verifiedShockName: input.eventCardBinding.verifiedShockName,
      eventCardId: input.eventCardBinding.eventCard.id,
      eventCardVersion: input.eventCardBinding.eventCard.version,
      eventCardFingerprint: input.eventCardBinding.eventCard.fingerprint,
      screen02RunId: input.eventCardBinding.screen02.runId,
      selectedEventId: input.eventCardBinding.screen02.selectedEventId,
      screen03RunId: input.eventCardBinding.screen03.runId,
      verifiedTimelineProposalId: input.mappings.verifiedTimelineProposalId,
      csvFingerprint,
      resultFingerprint,
      selectedColumns: selected,
      rowCount: rows.length,
      unitCount: groupsByUnit.size,
      observedYearRange: { earliest, latest },
      classificationCounts: counts,
      completedAuditDimensions,
      unassessedRequirementIds: unassessed,
      overallStatus,
      issues,
    },
    auditedExposureExport: {
      filename: "shockaudit-screen04-audited-exposure.csv",
      mediaType: "text/csv;charset=utf-8",
      content: auditedContent,
      fingerprint: auditedFingerprint,
      rowCount: rows.length,
    },
    affectedCasesExport: {
      filename: "shockaudit-screen04-affected-cases.csv",
      mediaType: "text/csv;charset=utf-8",
      content: affected.content,
      fingerprint: affectedFingerprint,
      rowCount: affected.rowCount,
    },
    auditReportExport: {
      filename: "shockaudit-screen04-exposure-audit.json",
      mediaType: "application/json;charset=utf-8",
      content: reportContent,
      fingerprint: reportFingerprint,
    },
  };
}

/**
 * Compare two explicitly named, source-supported Event Card interpretations.
 * The same file, shock binding, structural mapping, and timeline choice are
 * required; only the typed exposure plans and their requirement mappings may
 * differ. No outcome is inspected and neither scenario is selected as "best."
 */
export async function compareScreen04AuditScenarios(input: {
  baseline: Screen04NamedAuditScenario;
  alternative: Screen04NamedAuditScenario;
}): Promise<Screen04ScenarioComparisonOutput> {
  for (const scenario of [input.baseline, input.alternative]) {
    if (
      scenario.scenarioId.length < 1 ||
      scenario.scenarioId.length > 200 ||
      scenario.scenarioId.trim() !== scenario.scenarioId ||
      scenario.label.length < 1 ||
      scenario.label.length > 300 ||
      scenario.label.trim() !== scenario.label ||
      scenario.evidenceIds.length < 1
    ) {
      throw new Error(
        "Every Screen 4 scenario requires a bounded ID, label, and source evidence.",
      );
    }
  }
  if (input.baseline.scenarioId === input.alternative.scenarioId) {
    throw new Error("Screen 4 scenarios require distinct IDs.");
  }
  const baselineInput = input.baseline.input;
  const alternativeInput = input.alternative.input;
  if (
    baselineInput.csvText !== alternativeInput.csvText ||
    baselineInput.eventCardBinding.eventCard.fingerprint !==
      alternativeInput.eventCardBinding.eventCard.fingerprint ||
    baselineInput.eventCardBinding.screen02.selectedEventFingerprint !==
      alternativeInput.eventCardBinding.screen02.selectedEventFingerprint ||
    stableJson(baselineInput.mappings.structure) !==
      stableJson(alternativeInput.mappings.structure)
  ) {
    throw new Error(
      "Scenario comparison requires the same CSV, selected shock, and structure mapping.",
    );
  }
  const [baseline, alternative] = await Promise.all([
    runScreen04Audit(baselineInput),
    runScreen04Audit(alternativeInput),
  ]);
  const selected = unique([
    ...baseline.publicResult.selectedColumns,
    ...alternative.publicResult.selectedColumns,
  ]);
  const changed: Array<{
    unitId: string;
    year: number;
    from: Screen04ExposureStatus;
    to: Screen04ExposureStatus;
  }> = [];
  const structure = baselineInput.mappings.structure;
  const baselineTimeline = baselineInput.eventCardBinding.verifiedTimeline.find(
    (item) => item.proposalId === baselineInput.mappings.verifiedTimelineProposalId,
  )!;
  const alternativeTimeline = alternativeInput.eventCardBinding.verifiedTimeline.find(
    (item) =>
      item.proposalId === alternativeInput.mappings.verifiedTimelineProposalId,
  )!;
  const baselineVerifiedYear = Number(baselineTimeline.resolvedDate.slice(0, 4));
  const alternativeVerifiedYear = Number(
    alternativeTimeline.resolvedDate.slice(0, 4),
  );
  const evaluatedRows: Array<{
    unitId: string;
    year: number;
    group: string;
    baselineStatus: Screen04ExposureStatus;
    alternativeStatus: Screen04ExposureStatus;
  }> = [];
  scanScreen04SelectedCsv(
    baselineInput.csvText,
    selected,
    (values, recordNumber) => {
      const unitId = values[structure.unitIdentifier]!;
      if (unitId.trim().length === 0) {
        fail(
          "SCREEN04_MISSING_UNIT_IDENTIFIER",
          `The selected unit identifier is missing at record ${recordNumber}.`,
        );
      }
      const year = parseYear(values[structure.year]!, recordNumber);
      const group = values[structure.treatmentGroup]!;
      const baselineTyped = evaluateTypedPlanAtYear(
        baselineInput.exposurePlan,
        year,
        values,
        baselineVerifiedYear,
      );
      const alternativeTyped = evaluateTypedPlanAtYear(
        alternativeInput.exposurePlan,
        year,
        values,
        alternativeVerifiedYear,
      );
      const baselineIncomplete =
        baselineInput.eventCardBinding.compilerLimitations.length > 0 ||
        baselineInput.auditLimitations.length > 0 ||
        baselineInput.missingRequirementIds.length > 0 ||
        baselineInput.exposurePlan.components.length === 0;
      const alternativeIncomplete =
        alternativeInput.eventCardBinding.compilerLimitations.length > 0 ||
        alternativeInput.auditLimitations.length > 0 ||
        alternativeInput.missingRequirementIds.length > 0 ||
        alternativeInput.exposurePlan.components.length === 0;
      const from = baselineIncomplete && year >= baselineVerifiedYear
        ? "unknown"
        : baselineTyped.status;
      const to = alternativeIncomplete && year >= alternativeVerifiedYear
        ? "unknown"
        : alternativeTyped.status;
      evaluatedRows.push({
        unitId,
        year,
        group,
        baselineStatus: from,
        alternativeStatus: to,
      });
      if (from !== to) changed.push({ unitId, year, from, to });
    },
  );
  const years = changed.map((item) => item.year);
  const changedPeriodStart = years.length > 0 ? Math.min(...years) : null;
  const changedPeriodEnd = years.length > 0 ? Math.max(...years) : null;
  const evidenceIds = unique([
    ...input.baseline.evidenceIds,
    ...input.alternative.evidenceIds,
    ...baselineInput.exposurePlan.components.flatMap((item) => item.evidenceIds),
    ...alternativeInput.exposurePlan.components.flatMap((item) => item.evidenceIds),
  ]);
  const issue = changed.length === 0
    ? null
    : genericIssue("SCREEN04_SCENARIO_CLASSIFICATION_CHANGED", {
        severity: "warning",
        title: "Source-supported scenarios change exposure classification",
        eventCardRequirement: `${input.baseline.label} versus ${input.alternative.label}`,
        datasetEvidence: `${changed.length} unit-period classifications differ between the two explicitly typed scenarios.`,
        affectedCaseCount: changed.length,
        affectedUnitCount: new Set(changed.map((item) => item.unitId)).size,
        affectedPeriodStart: changedPeriodStart,
        affectedPeriodEnd: changedPeriodEnd,
        exposureDesignConsequence: "Exposure coding depends on which retained source-supported Event Card interpretation is used.",
        concreteSuggestion: "Report both scenario results and preserve the unresolved interpretation; do not select a scenario using outcome values.",
        blocksFullExposure: false,
        eventCardEvidenceIds: evidenceIds,
      });
  const changesByStatus = Array.from(
    changed.reduce((counts, item) => {
      const key = `${item.from}\u0000${item.to}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return counts;
    }, new Map<string, number>()),
    ([key, count]) => {
      const [from, to] = key.split("\u0000") as [
        Screen04ExposureStatus,
        Screen04ExposureStatus,
      ];
      return { from, to, count };
    },
  ).sort((left, right) =>
    `${left.from}:${left.to}`.localeCompare(`${right.from}:${right.to}`)
  );
  const comparisonRows = evaluatedRows.filter(
    (row) => row.group === structure.comparisonValue,
  );
  const baselineExposedComparisonCaseCount = comparisonRows.filter(
    (row) =>
      row.year >= baselineVerifiedYear && row.baselineStatus === "exposed",
  ).length;
  const alternativeExposedComparisonCaseCount = comparisonRows.filter(
    (row) =>
      row.year >= alternativeVerifiedYear && row.alternativeStatus === "exposed",
  ).length;
  const comparisonContamination = {
    baselineExposedComparisonCaseCount,
    alternativeExposedComparisonCaseCount,
    changedComparisonCaseCount: comparisonRows.filter(
      (row) => row.baselineStatus !== row.alternativeStatus,
    ).length,
    direction: (
      alternativeExposedComparisonCaseCount > baselineExposedComparisonCaseCount
        ? "alternative-increases"
        : alternativeExposedComparisonCaseCount < baselineExposedComparisonCaseCount
          ? "alternative-decreases"
          : "unchanged"
    ) as Screen04ScenarioComparisonOutput["comparisonContamination"]["direction"],
  };

  const summarizeVariation = (
    key: "baselineStatus" | "alternativeStatus",
    startYear: number,
  ): Screen04ScenarioExposureVariation => {
    const summary = {
      exposedCaseCount: 0,
      unexposedCaseCount: 0,
      unknownCaseCount: 0,
      notApplicableCaseCount: 0,
      hasUsableExposureVariation: false,
    };
    for (const row of evaluatedRows) {
      if (row.year < startYear) continue;
      const status = row[key];
      if (status === "exposed") summary.exposedCaseCount += 1;
      else if (status === "unexposed") summary.unexposedCaseCount += 1;
      else if (status === "unknown") summary.unknownCaseCount += 1;
      else summary.notApplicableCaseCount += 1;
    }
    summary.hasUsableExposureVariation =
      summary.exposedCaseCount > 0 && summary.unexposedCaseCount > 0;
    return summary;
  };
  const exposureStart = (
    plan: Screen04ExposureRulePlan,
    fallbackYear: number,
  ) =>
    plan.components.length > 0
      ? Math.min(...plan.components.map((component) => component.exposureStartYear))
      : fallbackYear;
  const exposureVariation = {
    baseline: summarizeVariation(
      "baselineStatus",
      exposureStart(baselineInput.exposurePlan, baselineVerifiedYear),
    ),
    alternative: summarizeVariation(
      "alternativeStatus",
      exposureStart(alternativeInput.exposurePlan, alternativeVerifiedYear),
    ),
  };

  const summarizeResearcherCoding = (
    key: "baselineStatus" | "alternativeStatus",
  ): Screen04ScenarioResearcherCoding => {
    const summary: Screen04ScenarioResearcherCoding = {
      agreementCaseCount: 0,
      mismatchCaseCount: 0,
      unresolvedCaseCount: 0,
      treatedAuditedUnexposedCaseCount: 0,
      comparisonAuditedExposedCaseCount: 0,
      treatedAuditedUnknownCaseCount: 0,
      comparisonAuditedUnknownCaseCount: 0,
    };
    for (const row of evaluatedRows) {
      if (row.year < structure.researcherTreatmentYear) continue;
      const status = row[key];
      const treated = row.group === structure.treatedValue;
      if (status === "unknown" || status === "not_applicable") {
        summary.unresolvedCaseCount += 1;
        if (treated) summary.treatedAuditedUnknownCaseCount += 1;
        else summary.comparisonAuditedUnknownCaseCount += 1;
      } else if (
        (treated && status === "exposed") ||
        (!treated && status === "unexposed")
      ) {
        summary.agreementCaseCount += 1;
      } else {
        summary.mismatchCaseCount += 1;
        if (treated) summary.treatedAuditedUnexposedCaseCount += 1;
        else summary.comparisonAuditedExposedCaseCount += 1;
      }
    }
    return summary;
  };
  const baselineCoding = summarizeResearcherCoding("baselineStatus");
  const alternativeCoding = summarizeResearcherCoding("alternativeStatus");
  const codingDirection =
    alternativeCoding.agreementCaseCount > baselineCoding.agreementCaseCount ||
      (alternativeCoding.agreementCaseCount === baselineCoding.agreementCaseCount &&
        alternativeCoding.mismatchCaseCount < baselineCoding.mismatchCaseCount)
      ? "alternative-improves"
      : alternativeCoding.agreementCaseCount < baselineCoding.agreementCaseCount ||
          (alternativeCoding.agreementCaseCount === baselineCoding.agreementCaseCount &&
            alternativeCoding.mismatchCaseCount > baselineCoding.mismatchCaseCount)
        ? "alternative-worsens"
        : "unchanged";
  const researcherCodingAgreement = {
    baseline: baselineCoding,
    alternative: alternativeCoding,
    direction: codingDirection as Screen04ScenarioComparisonOutput[
      "researcherCodingAgreement"
    ]["direction"],
  };
  const exportLines = [[
    "unit_id",
    "time",
    "baseline_scenario",
    "baseline_exposure",
    "alternative_scenario",
    "alternative_exposure",
    "finding_code",
    "event_card_fingerprint",
    "screen04_rule_version",
    "screen04_engine_version",
    "shockaudit_application_version",
  ].join(",")];
  for (const item of changed) {
    exportLines.push([
      item.unitId,
      item.year,
      input.baseline.scenarioId,
      item.from,
      input.alternative.scenarioId,
      item.to,
      "SCREEN04_SCENARIO_CLASSIFICATION_CHANGED",
      baselineInput.eventCardBinding.eventCard.fingerprint,
      SCREEN_04_RULE_AST_VERSION,
      SCREEN_04_AUDIT_ENGINE_VERSION,
      SHOCKAUDIT_VERSION,
    ].map(csvCell).join(","));
  }
  const exportContent = `${exportLines.join("\r\n")}\r\n`;
  const exportFingerprint = await sha256(exportContent);
  const fingerprintInput = {
    schemaVersion: "screen-04-scenario-comparison-v1",
    applicationVersion: SHOCKAUDIT_VERSION,
    baselineScenarioId: input.baseline.scenarioId,
    alternativeScenarioId: input.alternative.scenarioId,
    baselineTimelineProposalId:
      baselineInput.mappings.verifiedTimelineProposalId,
    alternativeTimelineProposalId:
      alternativeInput.mappings.verifiedTimelineProposalId,
    baselineResultFingerprint: baseline.publicResult.resultFingerprint,
    alternativeResultFingerprint: alternative.publicResult.resultFingerprint,
    issue,
    changesByStatus,
    comparisonContamination,
    exposureVariation,
    researcherCodingAgreement,
    exportFingerprint,
  };
  return {
    schemaVersion: "screen-04-scenario-comparison-v1",
    baselineScenarioId: input.baseline.scenarioId,
    alternativeScenarioId: input.alternative.scenarioId,
    baselineTimelineProposalId:
      baselineInput.mappings.verifiedTimelineProposalId,
    alternativeTimelineProposalId:
      alternativeInput.mappings.verifiedTimelineProposalId,
    baselineResultFingerprint: baseline.publicResult.resultFingerprint,
    alternativeResultFingerprint: alternative.publicResult.resultFingerprint,
    issue,
    changedCaseCount: changed.length,
    changedUnitCount: new Set(changed.map((item) => item.unitId)).size,
    changedPeriodStart,
    changedPeriodEnd,
    changesByStatus,
    comparisonContamination,
    exposureVariation,
    researcherCodingAgreement,
    overallStatus:
      changed.length > 0
        ? "proceed-with-repairs"
        : "exposure-coding-is-executable",
    resultFingerprint: await sha256(stableJson(fingerprintInput)),
    affectedCasesExport: {
      filename: "shockaudit-screen04-scenario-changes.csv",
      mediaType: "text/csv;charset=utf-8",
      content: exportContent,
      fingerprint: exportFingerprint,
      rowCount: changed.length,
    },
  };
}
