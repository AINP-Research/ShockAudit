/**
 * Screen 4 Stage A: a deterministic, model-independent exposure compiler.
 *
 * Raw CSV records are transient implementation details. The public result contains
 * exact headers, aggregate counts, reason-coded findings, and fingerprints only.
 * Selected row-level values are written solely to the explicit download export.
 */

export const SCREEN_04_FEASIBILITY_SCHEMA_VERSION =
  "screen-04-feasibility-result-v1" as const;
export const SCREEN_04_RULE_VERSION = "screen-04-exposure-rule-v1" as const;
export const SCREEN_04_EXECUTION_MODE = "deterministic-fixed-software" as const;
/** Conservative Stage A safety bounds; full-release qualification may lower them. */
export const SCREEN_04_STAGE_A_LIMITS = Object.freeze({
  maximumFileBytes: 2 * 1024 * 1024,
  maximumDataRows: 20_000,
  maximumColumns: 128,
  maximumSelectedColumns: 4,
});
export const SCREEN_04_AUDIT_LIMITS = Object.freeze({
  maximumFileBytes: 2 * 1024 * 1024,
  maximumDataRows: 20_000,
  maximumColumns: 128,
  maximumSelectedColumns: 16,
});

export type Screen04ExposureStatus =
  | "exposed"
  | "unexposed"
  | "unknown"
  | "not_applicable";

export type Screen04ClassificationReasonCode =
  | "SCREEN04_RULE_MATCH_AFTER_START"
  | "SCREEN04_RULE_NOT_MATCHED"
  | "SCREEN04_REQUIRED_VALUE_MISSING"
  | "SCREEN04_BEFORE_EXPOSURE_START";

export type Screen04FindingSeverity =
  | "blocking"
  | "major"
  | "warning"
  | "informational";

export type Screen04OverallStatus =
  | "exposure-coding-is-executable"
  | "proceed-with-repairs"
  | "partial-audit-only";

export type Screen04ExactMappings = {
  unitIdentifier: string;
  year: string;
  treatmentGroup: string;
  researcherTreatmentYear: number;
  treatedValue: string;
  comparisonValue: string;
};

/** The deliberately narrow, typed Event Card rule proven by Stage A. */
export type Screen04CategoricalEqualsRule = {
  kind: "categorical-equals";
  ruleId: string;
  requirementLabel: string;
  csvColumn: string;
  exposedValue: string;
  exposureStartYear: number;
  exposureComponent: string;
  exposureVersion: string;
  evidenceIds: readonly string[];
};

export type Screen04EventCardRuleBinding = {
  eventCardId: string;
  eventCardVersion: string;
  eventCardFingerprint: string;
  verifiedShockName: string;
  rule: Screen04CategoricalEqualsRule;
};

export type Screen04FeasibilityInput = {
  csvText: string;
  mappings: Screen04ExactMappings;
  eventCard: Screen04EventCardRuleBinding;
};

export type Screen04PublicFinding = {
  code:
    | "SCREEN04_TREATMENT_YEAR_PRECEDES_VERIFIED_START"
    | "SCREEN04_TREATMENT_YEAR_FOLLOWS_VERIFIED_START"
    | "SCREEN04_RESEARCHER_TREATED_AUDITED_UNEXPOSED"
    | "SCREEN04_RESEARCHER_COMPARISON_AUDITED_EXPOSED"
    | "SCREEN04_RESEARCHER_TREATED_AUDITED_UNKNOWN"
    | "SCREEN04_RESEARCHER_COMPARISON_AUDITED_UNKNOWN";
  severity: Screen04FindingSeverity;
  title: string;
  requirement: string;
  datasetEvidence: string;
  affectedCaseCount: number;
  consequence: string;
  suggestion: string;
  blocksFullExposure: boolean;
  evidenceIds: readonly string[];
  ruleVersion: typeof SCREEN_04_RULE_VERSION;
};

export type Screen04ClassificationCounts = Record<
  Screen04ExposureStatus,
  number
> & { total: number };

/**
 * Safe for widget/model-visible structured output: deliberately no raw records,
 * unit identifiers, cell values, or affected-case arrays.
 */
export type Screen04PublicFeasibilityResult = {
  schemaVersion: typeof SCREEN_04_FEASIBILITY_SCHEMA_VERSION;
  ruleVersion: typeof SCREEN_04_RULE_VERSION;
  executionMode: typeof SCREEN_04_EXECUTION_MODE;
  verifiedShockName: string;
  eventCardId: string;
  eventCardVersion: string;
  eventCardFingerprint: string;
  csvFingerprint: string;
  resultFingerprint: string;
  selectedColumns: readonly string[];
  rowCount: number;
  observedYearRange: { earliest: number; latest: number };
  classificationCounts: Screen04ClassificationCounts;
  overallStatus: Screen04OverallStatus;
  findings: readonly Screen04PublicFinding[];
};

/** Explicit user download. It is separate from model-safe publicResult. */
export type Screen04AuditedExposureCsvExport = {
  filename: "shockaudit-screen04-audited-exposure.csv";
  mediaType: "text/csv;charset=utf-8";
  content: string;
  fingerprint: string;
  rowCount: number;
};

export type Screen04AffectedCasesCsvExport = {
  filename: "shockaudit-screen04-affected-cases.csv";
  mediaType: "text/csv;charset=utf-8";
  content: string;
  fingerprint: string;
  rowCount: number;
};

export type Screen04ExposureAuditReportExport = {
  filename: "shockaudit-screen04-exposure-audit.json";
  mediaType: "application/json;charset=utf-8";
  content: string;
  fingerprint: string;
};

export type Screen04FeasibilityOutput = {
  publicResult: Screen04PublicFeasibilityResult;
  auditedExposureExport: Screen04AuditedExposureCsvExport;
  affectedCasesExport: Screen04AffectedCasesCsvExport;
  auditReportExport: Screen04ExposureAuditReportExport;
};

export type Screen04HeaderInspection = {
  schemaVersion: "screen-04-header-inspection-v1";
  csvFingerprint: string;
  headerFingerprint: string;
  byteLength: number;
  headerCount: number;
  exactHeaders: readonly string[];
};

export type Screen04SelectedCsvScanResult = {
  rowCount: number;
  headerCount: number;
};

export type Screen04CoreErrorCode =
  | "SCREEN04_EMPTY_CSV"
  | "SCREEN04_FILE_LIMIT_EXCEEDED"
  | "SCREEN04_ROW_LIMIT_EXCEEDED"
  | "SCREEN04_COLUMN_LIMIT_EXCEEDED"
  | "SCREEN04_MALFORMED_CSV"
  | "SCREEN04_DUPLICATE_HEADER"
  | "SCREEN04_UNIT_IDENTIFIER_NOT_FOUND"
  | "SCREEN04_TIME_VARIABLE_NOT_FOUND"
  | "SCREEN04_TREATMENT_GROUP_NOT_FOUND"
  | "SCREEN04_REQUIRED_EXPOSURE_VARIABLE_NOT_MAPPED"
  | "SCREEN04_COLUMN_NAME_FORMATTING_PROBLEM"
  | "SCREEN04_INVALID_MAPPING"
  | "SCREEN04_INVALID_ANNUAL_TIME"
  | "SCREEN04_MISSING_UNIT_IDENTIFIER"
  | "SCREEN04_DUPLICATE_UNIT_YEAR"
  | "SCREEN04_INVALID_TREATMENT_GROUP"
  | "SCREEN04_TREATMENT_GROUP_CHANGES"
  | "SCREEN04_INVALID_EVENT_CARD_RULE";

export class Screen04CoreError extends Error {
  readonly code: Screen04CoreErrorCode;

  constructor(code: Screen04CoreErrorCode, message: string) {
    super(message);
    this.name = "Screen04CoreError";
    this.code = code;
  }
}

type InternalClassification = {
  unitId: string;
  year: number;
  treatmentGroup: string;
  auditedExposure: Screen04ExposureStatus;
  reasonCode: Screen04ClassificationReasonCode;
  reason: string;
};

type ParsedCsv = {
  headers: string[];
  rows: InternalClassification[];
  earliestYear: number;
  latestYear: number;
};

const EXPORT_HEADERS = [
  "unit_id",
  "time",
  "researcher_treatment_group",
  "researcher_treatment_year",
  "audited_exposure",
  "exposure_component",
  "exposure_version",
  "exposure_start",
  "classification_reason_code",
  "classification_reason",
  "classification_status",
  "event_card_id",
  "event_card_version",
  "event_card_fingerprint",
  "screen04_rule_version",
] as const;

function fail(code: Screen04CoreErrorCode, message: string): never {
  throw new Screen04CoreError(code, message);
}

function safeHeader(value: string): string {
  const escaped = value
    .replaceAll("\\", "\\\\")
    .replaceAll("\r", "\\r")
    .replaceAll("\n", "\\n")
    .replaceAll("\t", "\\t");
  return escaped.length <= 120 ? escaped : `${escaped.slice(0, 117)}...`;
}

function validateBoundedText(value: string, label: string): void {
  if (value.length < 1 || value.length > 300 || value.trim() !== value) {
    fail(
      "SCREEN04_INVALID_EVENT_CARD_RULE",
      `${label} must be a non-empty, bounded exact value.`,
    );
  }
}

function validateInput(input: Screen04FeasibilityInput): void {
  if (typeof input.csvText !== "string" || input.csvText.length === 0) {
    fail("SCREEN04_EMPTY_CSV", "Upload a non-empty CSV file.");
  }
  validateCsvSize(input.csvText);
  const { mappings, eventCard } = input;
  if (
    !Number.isInteger(mappings.researcherTreatmentYear) ||
    mappings.researcherTreatmentYear < 1000 ||
    mappings.researcherTreatmentYear > 9999 ||
    mappings.treatedValue === mappings.comparisonValue
  ) {
    fail(
      "SCREEN04_INVALID_MAPPING",
      "Treatment year must be a four-digit annual value, and treated and comparison values must differ.",
    );
  }
  for (const [label, value] of [
    ["Unit identifier mapping", mappings.unitIdentifier],
    ["Time variable mapping", mappings.year],
    ["Treatment-group mapping", mappings.treatmentGroup],
    ["Treated value", mappings.treatedValue],
    ["Comparison value", mappings.comparisonValue],
    ["Event Card ID", eventCard.eventCardId],
    ["Event Card version", eventCard.eventCardVersion],
    ["Event Card fingerprint", eventCard.eventCardFingerprint],
    ["Verified shock name", eventCard.verifiedShockName],
    ["Rule ID", eventCard.rule.ruleId],
    ["Requirement label", eventCard.rule.requirementLabel],
    ["Exposure-rule mapping", eventCard.rule.csvColumn],
    ["Exposure match value", eventCard.rule.exposedValue],
    ["Exposure component", eventCard.rule.exposureComponent],
    ["Exposure version", eventCard.rule.exposureVersion],
  ] as const) {
    validateBoundedText(value, label);
  }
  if (
    eventCard.rule.kind !== "categorical-equals" ||
    !Number.isInteger(eventCard.rule.exposureStartYear) ||
    eventCard.rule.exposureStartYear < 1000 ||
    eventCard.rule.exposureStartYear > 9999
  ) {
    fail(
      "SCREEN04_INVALID_EVENT_CARD_RULE",
      "Stage A requires one categorical-equals Event Card rule with a four-digit exposure start year.",
    );
  }
  for (const evidenceId of eventCard.rule.evidenceIds) {
    validateBoundedText(evidenceId, "Event Card evidence ID");
  }
}

function csvByteLength(csvText: string): number {
  return new TextEncoder().encode(csvText).byteLength;
}

function validateCsvSize(csvText: string): number {
  const byteLength = csvByteLength(csvText);
  if (byteLength > SCREEN_04_STAGE_A_LIMITS.maximumFileBytes) {
    fail(
      "SCREEN04_FILE_LIMIT_EXCEEDED",
      `The Stage A CSV exceeds the bounded ${SCREEN_04_STAGE_A_LIMITS.maximumFileBytes}-byte safety limit. Create an exposure-only extract before retrying.`,
    );
  }
  return byteLength;
}

function headerErrorCode(
  role: "unit" | "year" | "group" | "rule",
): Screen04CoreErrorCode {
  if (role === "unit") return "SCREEN04_UNIT_IDENTIFIER_NOT_FOUND";
  if (role === "year") return "SCREEN04_TIME_VARIABLE_NOT_FOUND";
  if (role === "group") return "SCREEN04_TREATMENT_GROUP_NOT_FOUND";
  return "SCREEN04_REQUIRED_EXPOSURE_VARIABLE_NOT_MAPPED";
}

function headerLabel(role: "unit" | "year" | "group" | "rule"): string {
  if (role === "unit") return "Unit identifier";
  if (role === "year") return "Time variable";
  if (role === "group") return "Treatment-group variable";
  return "Required exposure variable";
}

function exactHeaderIndex(
  headers: readonly string[],
  requested: string,
  role: "unit" | "year" | "group" | "rule",
): number {
  const exactIndex = headers.indexOf(requested);
  if (exactIndex >= 0) return exactIndex;

  const formattingMatch = headers.find(
    (header) => header.trim() === requested || header === requested.trim(),
  );
  if (formattingMatch !== undefined) {
    fail(
      "SCREEN04_COLUMN_NAME_FORMATTING_PROBLEM",
      `Column-name formatting problem: the dataset contains \`${safeHeader(formattingMatch)}\` rather than \`${safeHeader(requested)}\`. ShockAudit will not silently alter column names. Rename the column or select the existing name explicitly.`,
    );
  }

  const caseMatch = headers.find(
    (header) => header.toLocaleLowerCase("en-US") === requested.toLocaleLowerCase("en-US"),
  );
  if (caseMatch !== undefined) {
    fail(
      headerErrorCode(role),
      `${headerLabel(role)} not found: you entered \`${safeHeader(requested)}\`, but the dataset does not contain a column with that exact name. Variable names are case-sensitive. The dataset contains \`${safeHeader(caseMatch)}\`.`,
    );
  }

  const examples = headers
    .slice(0, 5)
    .map((header) => `\`${safeHeader(header)}\``)
    .join(", ");
  fail(
    headerErrorCode(role),
    `${headerLabel(role)} not found: you entered \`${safeHeader(requested)}\`, but no exact column with that name exists. Available columns include ${examples}.`,
  );
}

function scanCsv(
  csvText: string,
  visit: (record: string[], recordNumber: number) => void | "stop",
): void {
  let record: string[] = [];
  let field = "";
  let inQuotes = false;
  let closedQuote = false;
  let recordNumber = 1;

  const finishField = () => {
    record.push(field);
    field = "";
    closedQuote = false;
  };
  const finishRecord = () => {
    finishField();
    const action = visit(record, recordNumber);
    record = [];
    recordNumber += 1;
    return action;
  };

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index]!;
    if (inQuotes) {
      if (character === '"') {
        if (csvText[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
          closedQuote = true;
        }
      } else {
        field += character;
      }
      continue;
    }
    if (closedQuote && character !== "," && character !== "\n" && character !== "\r") {
      fail(
        "SCREEN04_MALFORMED_CSV",
        `Malformed CSV near record ${recordNumber}: unexpected text follows a closing quote.`,
      );
    }
    if (character === '"') {
      if (field.length > 0 || closedQuote) {
        fail(
          "SCREEN04_MALFORMED_CSV",
          `Malformed CSV near record ${recordNumber}: a quote appears inside an unquoted field.`,
        );
      }
      inQuotes = true;
    } else if (character === ",") {
      finishField();
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && csvText[index + 1] === "\n") index += 1;
      if (finishRecord() === "stop") return;
    } else {
      field += character;
    }
  }
  if (inQuotes) {
    fail(
      "SCREEN04_MALFORMED_CSV",
      `Malformed CSV near record ${recordNumber}: a quoted field is not closed.`,
    );
  }
  if (record.length > 0 || field.length > 0 || closedQuote) finishRecord();
}

function validateHeaders(headers: readonly string[]): void {
  if (headers.length === 0 || headers.every((header) => header.length === 0)) {
    fail("SCREEN04_EMPTY_CSV", "The CSV header is empty.");
  }
  if (headers.length > SCREEN_04_STAGE_A_LIMITS.maximumColumns) {
    fail(
      "SCREEN04_COLUMN_LIMIT_EXCEEDED",
      `The Stage A CSV has ${headers.length} columns and exceeds the bounded ${SCREEN_04_STAGE_A_LIMITS.maximumColumns}-column safety limit.`,
    );
  }
  const seen = new Set<string>();
  for (const header of headers) {
    if (seen.has(header)) {
      fail(
        "SCREEN04_DUPLICATE_HEADER",
        `The CSV contains the duplicate exact header \`${safeHeader(header)}\`. Exact mapping would be ambiguous.`,
      );
    }
    seen.add(header);
  }
}

/** Read only the exact first CSV record for the mapping UI. */
export async function inspectScreen04CsvHeader(
  csvText: string,
): Promise<Screen04HeaderInspection> {
  if (typeof csvText !== "string" || csvText.length === 0) {
    fail("SCREEN04_EMPTY_CSV", "Upload a non-empty CSV file.");
  }
  const byteLength = validateCsvSize(csvText);
  const inspectedRecords: string[][] = [];
  scanCsv(csvText, (record) => {
    inspectedRecords.push(record);
    return "stop";
  });
  const headers = inspectedRecords[0];
  if (!headers) fail("SCREEN04_EMPTY_CSV", "The CSV header is empty.");
  validateHeaders(headers);
  return {
    schemaVersion: "screen-04-header-inspection-v1",
    csvFingerprint: await sha256(csvText),
    headerFingerprint: fingerprintScreen04Headers(headers),
    byteLength,
    headerCount: headers.length,
    exactHeaders: [...headers],
  };
}

/**
 * Scan a CSV while exposing only explicitly selected cells to the callback.
 * Full records exist only for the current parser iteration and are discarded.
 */
export function scanScreen04SelectedCsv(
  csvText: string,
  selectedColumns: readonly string[],
  visit: (
    selectedValues: Readonly<Record<string, string>>,
    recordNumber: number,
  ) => void,
): Screen04SelectedCsvScanResult {
  if (typeof csvText !== "string" || csvText.length === 0) {
    fail("SCREEN04_EMPTY_CSV", "Upload a non-empty CSV file.");
  }
  validateCsvSize(csvText);
  const uniqueColumns = Array.from(new Set(selectedColumns));
  if (
    uniqueColumns.length !== selectedColumns.length ||
    uniqueColumns.length < 1 ||
    uniqueColumns.length > SCREEN_04_AUDIT_LIMITS.maximumSelectedColumns
  ) {
    fail(
      "SCREEN04_INVALID_MAPPING",
      `Select between 1 and ${SCREEN_04_AUDIT_LIMITS.maximumSelectedColumns} distinct exact CSV columns.`,
    );
  }
  let headers: string[] | null = null;
  let indexes: number[] | null = null;
  let rowCount = 0;
  let headerCount = 0;
  scanCsv(csvText, (record, recordNumber) => {
    if (recordNumber === 1) {
      headers = record;
      validateHeaders(headers);
      headerCount = headers.length;
      indexes = uniqueColumns.map((column) =>
        exactHeaderIndex(headers!, column, "rule")
      );
      return;
    }
    if (!headers || !indexes) {
      fail("SCREEN04_MALFORMED_CSV", "The CSV header could not be read.");
    }
    if (recordNumber - 1 > SCREEN_04_AUDIT_LIMITS.maximumDataRows) {
      fail(
        "SCREEN04_ROW_LIMIT_EXCEEDED",
        `The CSV exceeds the bounded ${SCREEN_04_AUDIT_LIMITS.maximumDataRows}-row limit. Create an exposure-only extract before retrying.`,
      );
    }
    if (record.length !== headers.length) {
      fail(
        "SCREEN04_MALFORMED_CSV",
        `Malformed CSV at record ${recordNumber}: expected ${headers.length} columns but found ${record.length}.`,
      );
    }
    // CSV headers are untrusted keys. A null-prototype record keeps exact
    // headers such as `__proto__`, `constructor`, and `toString` as ordinary
    // selected cells without invoking or shadowing Object.prototype.
    const selected = Object.create(null) as Record<string, string>;
    for (let index = 0; index < uniqueColumns.length; index += 1) {
      selected[uniqueColumns[index]!] = record[indexes[index]!]!;
    }
    visit(selected, recordNumber);
    rowCount += 1;
  });
  if (!headers || rowCount === 0) {
    fail(
      "SCREEN04_EMPTY_CSV",
      "The CSV contains a header but no unit-year observations.",
    );
  }
  return { rowCount, headerCount };
}

function parseAnnualYear(value: string, recordNumber: number): number {
  const year = Number(value);
  if (!/^\d{4}$/u.test(value) || year < 1000 || year > 9999) {
    fail(
      "SCREEN04_INVALID_ANNUAL_TIME",
      `This Screen 4 version supports plausible annual years from 1000 through 9999. Record ${recordNumber} is outside that exact format and range in the selected time variable. Your file was not changed.`,
    );
  }
  return year;
}

function classify(
  exposureValue: string,
  year: number,
  rule: Screen04CategoricalEqualsRule,
): Pick<
  InternalClassification,
  "auditedExposure" | "reasonCode" | "reason"
> {
  if (year < rule.exposureStartYear) {
    return {
      auditedExposure: "not_applicable",
      reasonCode: "SCREEN04_BEFORE_EXPOSURE_START",
      reason: "The unit-period precedes the verified exposure start year.",
    };
  }
  if (exposureValue.trim().length === 0) {
    return {
      auditedExposure: "unknown",
      reasonCode: "SCREEN04_REQUIRED_VALUE_MISSING",
      reason: "The mapped Event Card requirement is missing for this unit-period.",
    };
  }
  if (exposureValue === rule.exposedValue) {
    return {
      auditedExposure: "exposed",
      reasonCode: "SCREEN04_RULE_MATCH_AFTER_START",
      reason: "The mapped value satisfies the verified rule on or after its exposure start.",
    };
  }
  return {
    auditedExposure: "unexposed",
    reasonCode: "SCREEN04_RULE_NOT_MATCHED",
    reason: "The mapped value does not satisfy the verified exposure rule.",
  };
}

function parseAndClassify(input: Screen04FeasibilityInput): ParsedCsv {
  let headers: string[] | null = null;
  let indexes: {
    unit: number;
    year: number;
    group: number;
    exposure: number;
  } | null = null;
  const rows: InternalClassification[] = [];
  const unitYears = new Set<string>();
  const groupsByUnit = new Map<string, string>();
  let earliestYear = Number.POSITIVE_INFINITY;
  let latestYear = Number.NEGATIVE_INFINITY;

  scanCsv(input.csvText, (record, recordNumber) => {
    if (recordNumber === 1) {
      headers = record;
      validateHeaders(headers);
      indexes = {
        unit: exactHeaderIndex(headers, input.mappings.unitIdentifier, "unit"),
        year: exactHeaderIndex(headers, input.mappings.year, "year"),
        group: exactHeaderIndex(headers, input.mappings.treatmentGroup, "group"),
        exposure: exactHeaderIndex(headers, input.eventCard.rule.csvColumn, "rule"),
      };
      return;
    }
    if (recordNumber - 1 > SCREEN_04_STAGE_A_LIMITS.maximumDataRows) {
      fail(
        "SCREEN04_ROW_LIMIT_EXCEEDED",
        `The Stage A CSV exceeds the bounded ${SCREEN_04_STAGE_A_LIMITS.maximumDataRows}-row safety limit. Create an exposure-only extract before retrying.`,
      );
    }
    if (!headers || !indexes) {
      fail("SCREEN04_MALFORMED_CSV", "The CSV header could not be read.");
    }
    if (record.length !== headers.length) {
      fail(
        "SCREEN04_MALFORMED_CSV",
        `Malformed CSV at record ${recordNumber}: expected ${headers.length} columns but found ${record.length}.`,
      );
    }
    const unitId = record[indexes.unit]!;
    if (unitId.trim().length === 0) {
      fail(
        "SCREEN04_MISSING_UNIT_IDENTIFIER",
        `The selected unit identifier is missing at record ${recordNumber}.`,
      );
    }
    const year = parseAnnualYear(record[indexes.year]!, recordNumber);
    const treatmentGroup = record[indexes.group]!;
    if (
      treatmentGroup !== input.mappings.treatedValue &&
      treatmentGroup !== input.mappings.comparisonValue
    ) {
      fail(
        "SCREEN04_INVALID_TREATMENT_GROUP",
        `The selected treatment-group variable contains a missing or unmapped category at record ${recordNumber}. Select explicit treated and comparison values before calculating exposure.`,
      );
    }
    const key = JSON.stringify([unitId, year]);
    if (unitYears.has(key)) {
      fail(
        "SCREEN04_DUPLICATE_UNIT_YEAR",
        `Duplicate unit-year observations: the selected unit and time columns do not form a unique key at record ${recordNumber}.`,
      );
    }
    unitYears.add(key);
    const priorGroup = groupsByUnit.get(unitId);
    if (priorGroup !== undefined && priorGroup !== treatmentGroup) {
      fail(
        "SCREEN04_TREATMENT_GROUP_CHANGES",
        `Treatment-group membership changes over time for a unit at record ${recordNumber}. The selected variable does not behave like a fixed treatment-group variable.`,
      );
    }
    groupsByUnit.set(unitId, treatmentGroup);
    earliestYear = Math.min(earliestYear, year);
    latestYear = Math.max(latestYear, year);
    rows.push({
      unitId,
      year,
      treatmentGroup,
      ...classify(record[indexes.exposure]!, year, input.eventCard.rule),
    });
  });

  if (!headers || rows.length === 0) {
    fail(
      "SCREEN04_EMPTY_CSV",
      "The CSV contains a header but no unit-year observations.",
    );
  }
  return { headers, rows, earliestYear, latestYear };
}

function escapeCsv(value: string | number): string {
  const original = String(value);
  // Prevent spreadsheet applications from interpreting user-derived cells as
  // formulas when a researcher opens an export. Numeric software values remain
  // numeric; string values retain their content after a protective apostrophe.
  const text =
    typeof value === "string" && /^[=+\-@\t\r\n]/u.test(original)
      ? `'${original}`
      : original;
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function buildExport(
  rows: readonly InternalClassification[],
  input: Screen04FeasibilityInput,
): string {
  const lines = [EXPORT_HEADERS.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.unitId,
        row.year,
        row.treatmentGroup,
        input.mappings.researcherTreatmentYear,
        row.auditedExposure,
        input.eventCard.rule.exposureComponent,
        input.eventCard.rule.exposureVersion,
        input.eventCard.rule.exposureStartYear,
        row.reasonCode,
        row.reason,
        row.auditedExposure === "unknown" ? "incomplete" : "complete",
        input.eventCard.eventCardId,
        input.eventCard.eventCardVersion,
        input.eventCard.eventCardFingerprint,
        SCREEN_04_RULE_VERSION,
      ].map(escapeCsv).join(","),
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}

type AffectedCaseCode = Screen04PublicFinding["code"];

function affectedCaseCodes(
  row: InternalClassification,
  input: Screen04FeasibilityInput,
): AffectedCaseCode[] {
  const codes: AffectedCaseCode[] = [];
  const proposedStart = input.mappings.researcherTreatmentYear;
  const verifiedStart = input.eventCard.rule.exposureStartYear;
  if (
    proposedStart < verifiedStart &&
    row.year >= proposedStart &&
    row.year < verifiedStart
  ) {
    codes.push("SCREEN04_TREATMENT_YEAR_PRECEDES_VERIFIED_START");
  } else if (
    proposedStart > verifiedStart &&
    row.year >= verifiedStart &&
    row.year < proposedStart
  ) {
    codes.push("SCREEN04_TREATMENT_YEAR_FOLLOWS_VERIFIED_START");
  }
  if (
    row.treatmentGroup === input.mappings.treatedValue &&
    row.year >= proposedStart &&
    row.auditedExposure === "unexposed"
  ) {
    codes.push("SCREEN04_RESEARCHER_TREATED_AUDITED_UNEXPOSED");
  }
  if (
    row.treatmentGroup === input.mappings.comparisonValue &&
    row.year >= verifiedStart &&
    row.auditedExposure === "exposed"
  ) {
    codes.push("SCREEN04_RESEARCHER_COMPARISON_AUDITED_EXPOSED");
  }
  if (
    row.treatmentGroup === input.mappings.treatedValue &&
    row.year >= proposedStart &&
    row.auditedExposure === "unknown"
  ) {
    codes.push("SCREEN04_RESEARCHER_TREATED_AUDITED_UNKNOWN");
  }
  if (
    row.treatmentGroup === input.mappings.comparisonValue &&
    row.year >= verifiedStart &&
    row.auditedExposure === "unknown"
  ) {
    codes.push("SCREEN04_RESEARCHER_COMPARISON_AUDITED_UNKNOWN");
  }
  return codes;
}

function buildAffectedCasesExport(
  rows: readonly InternalClassification[],
  input: Screen04FeasibilityInput,
): { content: string; rowCount: number } {
  const lines = [[
    "unit_id",
    "time",
    "finding_code",
    "audited_exposure",
    "classification_reason_code",
    "event_card_id",
    "event_card_version",
    "event_card_fingerprint",
    "screen04_rule_version",
  ].join(",")];
  let rowCount = 0;
  for (const row of rows) {
    for (const code of affectedCaseCodes(row, input)) {
      lines.push([
        row.unitId,
        row.year,
        code,
        row.auditedExposure,
        row.reasonCode,
        input.eventCard.eventCardId,
        input.eventCard.eventCardVersion,
        input.eventCard.eventCardFingerprint,
        SCREEN_04_RULE_VERSION,
      ].map(escapeCsv).join(","));
      rowCount += 1;
    }
  }
  return { content: `${lines.join("\r\n")}\r\n`, rowCount };
}

function finding(
  input: Screen04FeasibilityInput,
  values: Omit<
    Screen04PublicFinding,
    "requirement" | "evidenceIds" | "ruleVersion"
  >,
): Screen04PublicFinding {
  return {
    ...values,
    requirement: input.eventCard.rule.requirementLabel,
    evidenceIds: [...input.eventCard.rule.evidenceIds],
    ruleVersion: SCREEN_04_RULE_VERSION,
  };
}

function buildFindings(
  input: Screen04FeasibilityInput,
  rows: readonly InternalClassification[],
): Screen04PublicFinding[] {
  const findings: Screen04PublicFinding[] = [];
  const start = input.eventCard.rule.exposureStartYear;
  const proposedStart = input.mappings.researcherTreatmentYear;
  if (proposedStart < start) {
    const count = rows.filter(
      (row) => row.year >= proposedStart && row.year < start,
    ).length;
    findings.push(finding(input, {
      code: "SCREEN04_TREATMENT_YEAR_PRECEDES_VERIFIED_START",
      severity: "major",
      title: "Selected treatment year precedes the verified exposure start",
      datasetEvidence: `${count} observed unit-periods fall between the selected and verified start years.`,
      affectedCaseCount: count,
      consequence: "The proposed timing begins exposure before the verified rule becomes operative.",
      suggestion: `Review the proposed ${proposedStart} start against the verified ${start} exposure start.`,
      blocksFullExposure: false,
    }));
  } else if (proposedStart > start) {
    const count = rows.filter(
      (row) => row.year >= start && row.year < proposedStart,
    ).length;
    findings.push(finding(input, {
      code: "SCREEN04_TREATMENT_YEAR_FOLLOWS_VERIFIED_START",
      severity: "warning",
      title: "Selected treatment year follows the verified exposure start",
      datasetEvidence: `${count} observed unit-periods fall between the verified and selected start years.`,
      affectedCaseCount: count,
      consequence: "The proposed timing may omit periods in which the verified exposure rule was already operative.",
      suggestion: `Review the proposed ${proposedStart} start against the verified ${start} exposure start.`,
      blocksFullExposure: false,
    }));
  }

  const comparisons = [
    {
      code: "SCREEN04_RESEARCHER_TREATED_AUDITED_UNEXPOSED" as const,
      status: "unexposed" as const,
      group: input.mappings.treatedValue,
      minimumYear: proposedStart,
      severity: "major" as const,
      title: "Researcher-treated cases fail the verified exposure rule",
      consequence: "The proposed treatment group is broader than audited exposure.",
      suggestion: "Review the affected cases in the export and revise the treatment-group coding or exposure rule mapping.",
      blocksFullExposure: false,
    },
    {
      code: "SCREEN04_RESEARCHER_COMPARISON_AUDITED_EXPOSED" as const,
      status: "exposed" as const,
      group: input.mappings.comparisonValue,
      minimumYear: start,
      severity: "major" as const,
      title: "Researcher-comparison cases satisfy the verified exposure rule",
      consequence: "The proposed comparison group contains exposure to the verified shock.",
      suggestion: "Review the affected comparison cases in the export before relying on the proposed group coding.",
      blocksFullExposure: false,
    },
    {
      code: "SCREEN04_RESEARCHER_TREATED_AUDITED_UNKNOWN" as const,
      status: "unknown" as const,
      group: input.mappings.treatedValue,
      minimumYear: proposedStart,
      severity: "major" as const,
      title: "Researcher-treated exposure cannot be fully verified",
      consequence: "Missing Event Card-required values prevent complete verification of proposed treated cases.",
      suggestion: "Supply the missing mapped exposure values or preserve these classifications as unknown.",
      blocksFullExposure: true,
    },
    {
      code: "SCREEN04_RESEARCHER_COMPARISON_AUDITED_UNKNOWN" as const,
      status: "unknown" as const,
      group: input.mappings.comparisonValue,
      minimumYear: start,
      severity: "major" as const,
      title: "Researcher-comparison exposure cannot be fully verified",
      consequence: "Missing Event Card-required values prevent confirmation that these comparison cases are unexposed.",
      suggestion: "Supply the missing mapped exposure values or preserve these classifications as unknown.",
      blocksFullExposure: true,
    },
  ];
  for (const comparison of comparisons) {
    const count = rows.filter(
      (row) =>
        row.treatmentGroup === comparison.group &&
        row.year >= comparison.minimumYear &&
        row.auditedExposure === comparison.status,
    ).length;
    if (count === 0) continue;
    findings.push(finding(input, {
      code: comparison.code,
      severity: comparison.severity,
      title: comparison.title,
      datasetEvidence: `${count} unit-period classifications meet this finding.`,
      affectedCaseCount: count,
      consequence: comparison.consequence,
      suggestion: comparison.suggestion,
      blocksFullExposure: comparison.blocksFullExposure,
    }));
  }
  return findings;
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
    .join(",")}}`;
}

/** Fingerprint transient headers without retaining or serializing their names. */
export function fingerprintScreen04Headers(headers: readonly string[]): string {
  const bytes = new TextEncoder().encode(stableJson(headers));
  let hash = 0xcbf29ce484222325n;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

async function sha256(value: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
  return `sha256:${Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Run the Stage A vertical slice without host messaging, model reasoning, network
 * access, logs, timestamps, or non-deterministic state.
 */
export async function runScreen04FeasibilitySlice(
  input: Screen04FeasibilityInput,
): Promise<Screen04FeasibilityOutput> {
  validateInput(input);
  const csvFingerprint = await sha256(input.csvText);
  const parsed = parseAndClassify(input);
  const auditedExposureCsv = buildExport(parsed.rows, input);
  const exportFingerprint = await sha256(auditedExposureCsv);
  const affectedCases = buildAffectedCasesExport(parsed.rows, input);
  const affectedCasesFingerprint = await sha256(affectedCases.content);
  const classificationCounts: Screen04ClassificationCounts = {
    exposed: 0,
    unexposed: 0,
    unknown: 0,
    not_applicable: 0,
    total: parsed.rows.length,
  };
  for (const row of parsed.rows) classificationCounts[row.auditedExposure] += 1;
  const findings = buildFindings(input, parsed.rows);
  const overallStatus: Screen04OverallStatus =
    classificationCounts.unknown > 0
      ? "partial-audit-only"
      : findings.some((item) => item.severity === "major" || item.severity === "blocking")
        ? "proceed-with-repairs"
        : "exposure-coding-is-executable";
  const selectedColumns = Array.from(new Set([
    input.mappings.unitIdentifier,
    input.mappings.year,
    input.mappings.treatmentGroup,
    input.eventCard.rule.csvColumn,
  ]));
  const fingerprintInput = {
    schemaVersion: SCREEN_04_FEASIBILITY_SCHEMA_VERSION,
    ruleVersion: SCREEN_04_RULE_VERSION,
    executionMode: SCREEN_04_EXECUTION_MODE,
    eventCard: input.eventCard,
    mappings: input.mappings,
    csvFingerprint,
    selectedColumns,
    rowCount: parsed.rows.length,
    observedYearRange: {
      earliest: parsed.earliestYear,
      latest: parsed.latestYear,
    },
    classificationCounts,
    overallStatus,
    findings,
    exportFingerprint,
    affectedCasesFingerprint,
  };
  const resultFingerprint = await sha256(stableJson(fingerprintInput));
  const auditReport = `${stableJson({
    schemaVersion: "screen-04-exposure-audit-report-v1",
    selectedShock: input.eventCard.verifiedShockName,
    eventCard: {
      id: input.eventCard.eventCardId,
      version: input.eventCard.eventCardVersion,
      fingerprint: input.eventCard.eventCardFingerprint,
    },
    csvFingerprint,
    exactMappings: input.mappings,
    eventSpecificMapping: {
      requirement: input.eventCard.rule.requirementLabel,
      csvColumn: input.eventCard.rule.csvColumn,
      ruleId: input.eventCard.rule.ruleId,
    },
    observedYearRange: fingerprintInput.observedYearRange,
    completedAuditDimensions: [
      "exact-header-mapping",
      "annual-unit-year-structure",
      "simple-event-card-rule",
      "treatment-year-alignment",
      "researcher-coding-comparison",
    ],
    findings,
    classificationCounts,
    calculationVersion: SCREEN_04_RULE_VERSION,
    resultFingerprint,
  })}\n`;
  const auditReportFingerprint = await sha256(auditReport);
  return {
    publicResult: {
      schemaVersion: SCREEN_04_FEASIBILITY_SCHEMA_VERSION,
      ruleVersion: SCREEN_04_RULE_VERSION,
      executionMode: SCREEN_04_EXECUTION_MODE,
      verifiedShockName: input.eventCard.verifiedShockName,
      eventCardId: input.eventCard.eventCardId,
      eventCardVersion: input.eventCard.eventCardVersion,
      eventCardFingerprint: input.eventCard.eventCardFingerprint,
      csvFingerprint,
      resultFingerprint,
      selectedColumns,
      rowCount: parsed.rows.length,
      observedYearRange: {
        earliest: parsed.earliestYear,
        latest: parsed.latestYear,
      },
      classificationCounts,
      overallStatus,
      findings,
    },
    auditedExposureExport: {
      filename: "shockaudit-screen04-audited-exposure.csv",
      mediaType: "text/csv;charset=utf-8",
      content: auditedExposureCsv,
      fingerprint: exportFingerprint,
      rowCount: parsed.rows.length,
    },
    affectedCasesExport: {
      filename: "shockaudit-screen04-affected-cases.csv",
      mediaType: "text/csv;charset=utf-8",
      content: affectedCases.content,
      fingerprint: affectedCasesFingerprint,
      rowCount: affectedCases.rowCount,
    },
    auditReportExport: {
      filename: "shockaudit-screen04-exposure-audit.json",
      mediaType: "application/json;charset=utf-8",
      content: auditReport,
      fingerprint: auditReportFingerprint,
    },
  };
}
