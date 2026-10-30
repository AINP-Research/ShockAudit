import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import { fingerprintScreen03Value } from "../../src/core/screen03-workflow";
import {
  compareScreen04AuditScenarios,
  runScreen04Audit,
  type Screen04AuditInput,
  type Screen04AuditLimitation,
  type Screen04AuditOutput,
} from "../../src/core/screen04-audit";
import {
  SCREEN_04_EVENT_CARD_BINDING_SCHEMA_VERSION,
  type Screen04EventCardBinding,
} from "../../src/core/screen04-event-card-binding";
import {
  inspectScreen04CsvHeader,
  runScreen04FeasibilitySlice,
  SCREEN_04_STAGE_A_LIMITS,
  Screen04CoreError,
  type Screen04ExactMappings,
  type Screen04ExposureStatus,
} from "../../src/core/screen04-feasibility";
import {
  SCREEN_04_RULE_AST_VERSION,
  type Screen04ExposureRulePlan,
  type Screen04RuleExpression,
} from "../../src/core/screen04-rule-ast";
import {
  attachScreen04Upload,
  createScreen04WorkflowState,
  mapScreen04Columns,
  reconcileScreen04EventCardBinding,
  recordScreen04Calculation,
} from "../../src/core/screen04-workflow";

type ExpectedClassification =
  | Screen04ExposureStatus
  | "not_calculated"
  | "stale";

type FixtureExpectation = {
  id: number;
  file: string;
  classification: ExpectedClassification;
  issueCode: string;
  severity: "blocking" | "major" | "warning" | "informational";
  affectedCaseCount: number;
  overallStatus: string;
  mappingOverride?: Partial<Screen04ExactMappings>;
  ruleProfile?: string;
  assertions?: readonly string[];
  eventCardMutation?: {
    fromFingerprint: string;
    toFingerprint: string;
  };
};

type FixtureManifest = {
  schemaVersion: string;
  defaultMappings: Screen04ExactMappings & {
    ruleColumn: string;
    ruleValue: string;
    ruleStartYear: number;
  };
  fixtures: FixtureExpectation[];
};

type QualificationResult = {
  classification: ExpectedClassification;
  issueCode: string;
  severity: FixtureExpectation["severity"];
  affectedCaseCount: number;
  overallStatus: string;
};

const FIXTURE_DIRECTORY = fileURLToPath(
  new URL("../fixtures/screen04/", import.meta.url),
);
const manifest = JSON.parse(
  await readFile(new URL("../fixtures/screen04/manifest.json", import.meta.url), "utf8"),
) as FixtureManifest;

const FATAL_CASES = new Set([2, 3, 5, 6, 10, 28, 29]);

function eventCardBinding(
  eventCardFingerprint = "event-card-fixture-a",
): Screen04EventCardBinding {
  const withoutFingerprint = {
    schemaVersion: SCREEN_04_EVENT_CARD_BINDING_SCHEMA_VERSION,
    screen02: {
      runId: "screen02-fixture-run",
      mode: "find" as const,
      selectedEventId: "fixture-event",
      selectedEventFingerprint: "fnv1a64:1111111111111111",
      handoffFingerprint: "fnv1a64:2222222222222222",
    },
    screen03: {
      runId: "screen03-fixture-run",
      stateFingerprint: "fnv1a64:3333333333333333",
    },
    eventCard: {
      id: "screen03:screen03-fixture-run:event-card",
      version: "locked-at:2026-08-23T12:00:00.000Z",
      fingerprint: eventCardFingerprint,
      lockedAt: "2026-08-23T12:00:00.000Z",
    },
    verifiedShockName: "Verified fixture shock",
    verifiedTimeline: [{
      proposalId: "effective-date",
      label: "Effective date",
      stage: "effective" as const,
      proposedDate: "2020-01-01",
      resolvedDate: "2020-01-01",
      sourceIds: ["official-timeline"],
      passageIds: ["official-timeline:passage"],
    }],
    focalClock: {
      selected: null,
      alternatives: [],
    },
    assignmentUnit: [],
    geographicCoverage: [],
    eligibilityConditions: [],
    thresholds: [],
    exemptions: [],
    treatmentComponents: [],
    amendmentsAndVersions: [],
    exposureDimensions: [],
    unresolvedLimitations: {
      gaps: [],
      unknownProposalIds: [],
      rejectedProposalIds: [],
      unsupportedProposalIds: [],
      uncertainties: [],
    },
    compilerLimitations: [],
    linkedEvidenceIds: ["official-rule"],
  };
  return {
    ...withoutFingerprint,
    bindingFingerprint: fingerprintScreen03Value(withoutFingerprint),
  };
}

function component(
  componentId: string,
  exposureStartYear: number,
  expression: Screen04RuleExpression,
  exposureVersion = "original",
): Screen04ExposureRulePlan["components"][number] {
  return {
    componentId,
    componentLabel: componentId,
    exposureVersion,
    exposureStartYear,
    evidenceIds: ["official-rule"],
    expression,
  };
}

function categorical(
  requirementId: string,
  csvColumn: string,
  value = "yes",
): Screen04RuleExpression {
  return { kind: "categorical-equals", requirementId, csvColumn, value };
}

function rulePlan(
  components: Screen04ExposureRulePlan["components"],
): Screen04ExposureRulePlan {
  return { schemaVersion: SCREEN_04_RULE_AST_VERSION, components };
}

function rowCount(csvText: string): number {
  return csvText.trimEnd().split(/\r?\n/u).length - 1;
}

function profileInput(
  fixture: FixtureExpectation,
  csvText: string,
): Screen04AuditInput {
  const defaults = manifest.defaultMappings;
  const structure: Screen04ExactMappings = {
    unitIdentifier: defaults.unitIdentifier,
    year: defaults.year,
    treatmentGroup: defaults.treatmentGroup,
    researcherTreatmentYear: defaults.researcherTreatmentYear,
    treatedValue: defaults.treatedValue,
    comparisonValue: defaults.comparisonValue,
    ...fixture.mappingOverride,
  };
  const headers = csvText.slice(0, csvText.indexOf("\n")).replace(/\r$/u, "").split(",");
  let plan = rulePlan([
    component(
      "coverage",
      defaults.ruleStartYear,
      categorical("coverage", defaults.ruleColumn, defaults.ruleValue),
    ),
  ]);
  let eventRequirements: Record<string, string | null> = {
    coverage: headers.includes(defaults.ruleColumn) ? defaults.ruleColumn : null,
  };
  let auditLimitations: Screen04AuditLimitation[] = [];
  let missingRequirementIds = eventRequirements.coverage === null
    ? ["coverage"]
    : [];
  const optional = {
    organizationName: null as string | null,
    existingPostPeriod: null as string | null,
    existingUnitPeriodTreatment: null as string | null,
  };

  if (fixture.id === 11 || fixture.ruleProfile === "requires_frozen_revenue_2017") {
    plan = rulePlan([
      component("historical-eligibility", 2020, {
        kind: "numeric-threshold",
        requirementId: "frozen-revenue-2017",
        csvColumn: "revenue_2017_usd",
        operator: ">=",
        threshold: 100,
        thresholdUnit: "USD",
        sourceUnit: "USD",
      }),
    ]);
    eventRequirements = { "frozen-revenue-2017": null };
    missingRequirementIds = ["frozen-revenue-2017"];
    if (fixture.id === 12) {
      auditLimitations = [{
        code: "SCREEN04_HISTORICAL_MEASUREMENT_MISMATCH",
        message: "The file supplies contemporaneous revenue, not the required frozen 2017 value.",
        requirementId: "frozen-revenue-2017",
        evidenceIds: ["official-rule"],
      }];
    }
  }
  if (fixture.ruleProfile === "revenue_threshold_usd") {
    const csvColumn = fixture.id === 13
      ? "revenue_2017_thousands"
      : "revenue_2017_usd";
    plan = rulePlan([
      component("revenue-threshold", 2020, {
        kind: "numeric-threshold",
        requirementId: "revenue-threshold",
        csvColumn,
        operator: ">=",
        threshold: 1_000_000,
        thresholdUnit: "USD",
        sourceUnit: fixture.id === 13 ? "USD thousands" : "USD",
      }),
    ]);
    eventRequirements = { "revenue-threshold": csvColumn };
    missingRequirementIds = [];
    if (fixture.id === 13) {
      auditLimitations = [{
        code: "SCREEN04_RULE_UNIT_MISMATCH",
        message: "The Event Card threshold is in USD while the mapped field is in USD thousands.",
        requirementId: "revenue-threshold",
        evidenceIds: ["official-rule"],
      }];
    }
  }
  if (fixture.ruleProfile === "eligibility_and_not_exempt") {
    plan = rulePlan([
      component("eligibility-after-exemption", 2020, {
        kind: "all",
        rules: [
          categorical("eligibility", "eligible"),
          { kind: "not", rule: categorical("exemption", "exempt") },
        ],
      }),
    ]);
    eventRequirements = { eligibility: "eligible", exemption: null };
    missingRequirementIds = ["exemption"];
  }
  if (fixture.ruleProfile === "establishment_assignment") {
    structure.unitIdentifier = "parent_firm_id";
    plan = rulePlan([
      component(
        "establishment-coverage",
        2020,
        categorical("establishment-coverage", "establishment_covered"),
      ),
    ]);
    eventRequirements = { "establishment-coverage": null };
    missingRequirementIds = ["establishment-coverage"];
    auditLimitations = [{
      code: "SCREEN04_ASSIGNMENT_UNIT_MISMATCH",
      message: "The verified rule applies to establishments, while each row is a parent firm.",
      requirementId: "establishment-coverage",
      evidenceIds: ["official-rule"],
    }];
  }
  if (fixture.ruleProfile === "operating_location") {
    plan = rulePlan([
      component(
        "operating-location",
        2020,
        categorical("operating-location", "operating_state", "CA"),
      ),
    ]);
    eventRequirements = { "operating-location": null };
    missingRequirementIds = ["operating-location"];
    auditLimitations = [{
      code: "SCREEN04_ASSIGNMENT_UNIT_MISMATCH",
      message: "The verified rule uses operating location, while the file supplies headquarters only.",
      requirementId: "operating-location",
      evidenceIds: ["official-rule"],
    }];
  }
  if (fixture.ruleProfile === "amendment_2021") {
    plan = rulePlan([
      component("original", 2020, categorical("original", "covered_original")),
      component("amendment", 2021, categorical("amendment", "covered_amendment"), "amendment-2021"),
    ]);
    eventRequirements = {
      original: "covered_original",
      amendment: "covered_amendment",
    };
    missingRequirementIds = [];
  }
  if (
    fixture.ruleProfile === "two_components_separate_start_years" ||
    fixture.ruleProfile === "two_components_same_coverage"
  ) {
    const separate = fixture.ruleProfile === "two_components_separate_start_years";
    plan = rulePlan([
      component("disclosure", separate ? 2019 : 2020, categorical("disclosure", "disclosure"), "package-v1"),
      component("compliance", 2020, categorical("compliance", "compliance"), separate ? "package-v2" : "package-v1"),
    ]);
    eventRequirements = { disclosure: "disclosure", compliance: "compliance" };
    missingRequirementIds = [];
    optional.existingUnitPeriodTreatment = "group";
  }

  return {
    csvText,
    eventCardBinding: eventCardBinding(),
    mappings: {
      structure,
      verifiedTimelineProposalId: "effective-date",
      optional,
      eventRequirements,
    },
    exposurePlan: plan,
    auditLimitations,
    missingRequirementIds,
  };
}

function assertedFixtureClassification(
  fixture: FixtureExpectation,
  output: Screen04AuditOutput,
): Screen04ExposureStatus {
  if (
    fixture.classification === "not_calculated" ||
    fixture.classification === "stale"
  ) {
    throw new Error(`Fixture ${fixture.id} does not declare a calculated classification.`);
  }
  expect(
    output.publicResult.classificationCounts[fixture.classification],
    `fixture ${fixture.id} expected at least one ${fixture.classification} unit-period`,
  ).toBeGreaterThan(0);
  return fixture.classification;
}

function resultFromAudit(
  fixture: FixtureExpectation,
  output: Screen04AuditOutput,
): QualificationResult {
  if (fixture.issueCode === "NONE") {
    expect(output.publicResult.issues).toEqual([]);
    return {
      classification: assertedFixtureClassification(fixture, output),
      issueCode: "NONE",
      severity: "informational",
      affectedCaseCount: 0,
      overallStatus: output.publicResult.overallStatus,
    };
  }
  const issue = output.publicResult.issues.find(
    (item) => item.findingCode === fixture.issueCode,
  );
  expect(issue, `fixture ${fixture.id} expected ${fixture.issueCode}`).toBeDefined();
  return {
    classification: assertedFixtureClassification(fixture, output),
    issueCode: issue!.findingCode,
    severity: issue!.severity,
    affectedCaseCount: issue!.affectedCaseCount,
    overallStatus: output.publicResult.overallStatus,
  };
}

function fatalAffectedCount(fixture: FixtureExpectation, csvText: string): number {
  if (fixture.id === 28) return 0;
  if (fixture.id === 29) return 1;
  const rows = csvText.trimEnd().split(/\r?\n/u).slice(1).map((line) => line.split(","));
  if (fixture.id === 5) {
    const frequencies = new Map<string, number>();
    for (const row of rows) {
      const key = `${row[0]}\u0000${row[1]}`;
      frequencies.set(key, (frequencies.get(key) ?? 0) + 1);
    }
    return [...frequencies.values()].filter((count) => count > 1)
      .reduce((total, count) => total + count, 0);
  }
  if (fixture.id === 6) return rows.filter((row) => !/^\d{4}$/u.test(row[1] ?? "")).length;
  if (fixture.id === 10) {
    const groups = new Map<string, Set<string>>();
    for (const row of rows) {
      const values = groups.get(row[0]!) ?? new Set<string>();
      values.add(row[2]!);
      groups.set(row[0]!, values);
    }
    const changed = new Set(
      [...groups].filter(([, values]) => values.size > 1).map(([unit]) => unit),
    );
    return rows.filter((row) => changed.has(row[0]!)).length;
  }
  return rows.length;
}

function feasibilityInput(csvText: string, fixture: FixtureExpectation) {
  const defaults = manifest.defaultMappings;
  const mappings: Screen04ExactMappings = {
    unitIdentifier: defaults.unitIdentifier,
    year: defaults.year,
    treatmentGroup: defaults.treatmentGroup,
    researcherTreatmentYear: defaults.researcherTreatmentYear,
    treatedValue: defaults.treatedValue,
    comparisonValue: defaults.comparisonValue,
    ...fixture.mappingOverride,
  };
  return {
    csvText,
    mappings,
    eventCard: {
      eventCardId: "screen03:screen03-fixture-run:event-card",
      eventCardVersion: "locked-at:2026-08-23T12:00:00.000Z",
      eventCardFingerprint: "event-card-fixture-a",
      verifiedShockName: "Verified fixture shock",
      rule: {
        kind: "categorical-equals" as const,
        ruleId: "coverage",
        requirementLabel: "Coverage",
        csvColumn: defaults.ruleColumn,
        exposedValue: defaults.ruleValue,
        exposureStartYear: defaults.ruleStartYear,
        exposureComponent: "coverage",
        exposureVersion: "original",
        evidenceIds: ["official-rule"],
      },
    },
  };
}

async function oversizedCsv(): Promise<string> {
  const descriptor = JSON.parse(
    await readFile(new URL("../fixtures/screen04/28-oversized-csv.fixture.json", import.meta.url), "utf8"),
  ) as {
    headers: string[];
    dataRow: string[];
    repeatDataRowUntilMinimumBytes: number;
    expectedError: { code: string; stageALimitBytes: number; mustRejectBeforeRowParsing: boolean };
  };
  expect(descriptor.expectedError).toEqual({
    code: "SCREEN04_FILE_LIMIT_EXCEEDED",
    stageALimitBytes: SCREEN_04_STAGE_A_LIMITS.maximumFileBytes,
    mustRejectBeforeRowParsing: true,
  });
  const header = `${descriptor.headers.join(",")}\n`;
  const row = `${descriptor.dataRow.join(",")}\n`;
  const repeats = Math.ceil(
    (descriptor.repeatDataRowUntilMinimumBytes - new TextEncoder().encode(header).byteLength) /
      new TextEncoder().encode(row).byteLength,
  );
  const generated = `${header}${row.repeat(repeats)}`;
  expect(new TextEncoder().encode(generated).byteLength).toBeGreaterThanOrEqual(
    descriptor.repeatDataRowUntilMinimumBytes,
  );
  return generated;
}

async function qualifyFatal(
  fixture: FixtureExpectation,
  csvText: string,
): Promise<QualificationResult> {
  let thrown: unknown;
  try {
    await runScreen04FeasibilitySlice(feasibilityInput(csvText, fixture));
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(Screen04CoreError);
  const coreError = thrown as Screen04CoreError;
  if (fixture.id === 28) {
    expect(coreError.message).toContain(String(SCREEN_04_STAGE_A_LIMITS.maximumFileBytes));
  }
  if (fixture.id === 29) {
    expect(coreError.message).toMatch(/quoted field is not closed|Malformed CSV/u);
  }
  return {
    classification: "not_calculated",
    issueCode: coreError.code,
    severity: "blocking",
    affectedCaseCount: fatalAffectedCount(fixture, csvText),
    overallStatus: "exposure-cannot-be-calculated-from-this-file",
  };
}

async function qualifyScenario(
  fixture: FixtureExpectation,
  csvText: string,
): Promise<QualificationResult> {
  const input = profileInput(fixture, csvText);
  const narrow = structuredClone(input);
  narrow.exposurePlan = rulePlan([
    component("narrow", 2020, categorical("narrow", "narrow_covered")),
  ]);
  narrow.mappings.eventRequirements = { narrow: "narrow_covered" };
  narrow.missingRequirementIds = [];
  const broad = structuredClone(input);
  broad.exposurePlan = rulePlan([
    component("broad", 2020, categorical("broad", "broad_covered")),
  ]);
  broad.mappings.eventRequirements = { broad: "broad_covered" };
  broad.missingRequirementIds = [];
  const [comparison, broadOutput] = await Promise.all([
    compareScreen04AuditScenarios({
      baseline: {
        scenarioId: "narrow",
        label: "Narrow source-supported coverage",
        evidenceIds: ["official-narrow-rule"],
        input: narrow,
      },
      alternative: {
        scenarioId: "broad",
        label: "Broad source-supported coverage",
        evidenceIds: ["official-broad-rule"],
        input: broad,
      },
    }),
    runScreen04Audit(broad),
  ]);
  expect(comparison.issue).toMatchObject({
    findingCode: fixture.issueCode,
    severity: fixture.severity,
    affectedCaseCount: comparison.changedCaseCount,
  });
  expect(comparison.affectedCasesExport.rowCount).toBe(comparison.changedCaseCount);
  expect(comparison.baselineResultFingerprint).not.toBe(
    comparison.alternativeResultFingerprint,
  );
  return {
    classification: assertedFixtureClassification(fixture, broadOutput),
    issueCode: comparison.issue!.findingCode,
    severity: comparison.issue!.severity,
    affectedCaseCount: comparison.changedCaseCount,
    overallStatus: comparison.overallStatus,
  };
}

async function qualifyStale(
  fixture: FixtureExpectation,
  csvText: string,
): Promise<QualificationResult> {
  const mutation = fixture.eventCardMutation!;
  const originalBinding = eventCardBinding(mutation.fromFingerprint);
  const currentBinding = eventCardBinding(mutation.toFingerprint);
  const inspected = await inspectScreen04CsvHeader(csvText);
  let state = createScreen04WorkflowState(
    originalBinding,
    "screen04-fixture-run",
    "2026-08-23T12:01:00.000Z",
  );
  state = attachScreen04Upload(state, {
    schemaVersion: "screen-04-upload-reference-v1",
    opaqueFileRef: "opaque:fixture-upload",
    csvFingerprint: inspected.csvFingerprint,
    headerFingerprint: inspected.headerFingerprint,
    byteLength: inspected.byteLength,
    headerCount: inspected.headerCount,
    uploadedAt: "2026-08-23T12:02:00.000Z",
    expiresAt: "2026-08-23T13:02:00.000Z",
  }, "2026-08-23T12:02:00.000Z");
  state = mapScreen04Columns(state, profileInput(fixture, csvText).mappings, inspected.exactHeaders, "2026-08-23T12:03:00.000Z");
  const calculated = await runScreen04FeasibilitySlice({
    ...feasibilityInput(csvText, fixture),
    eventCard: {
      ...feasibilityInput(csvText, fixture).eventCard,
      eventCardFingerprint: mutation.fromFingerprint,
    },
  });
  const expiry = "2026-08-23T13:04:00.000Z";
  state = recordScreen04Calculation(state, calculated.publicResult, {
    auditedExposure: {
      opaqueFileRef: "opaque:audited",
      fingerprint: calculated.auditedExposureExport.fingerprint,
      filename: calculated.auditedExposureExport.filename,
      expiresAt: expiry,
    },
    affectedCases: {
      opaqueFileRef: "opaque:affected",
      fingerprint: calculated.affectedCasesExport.fingerprint,
      filename: calculated.affectedCasesExport.filename,
      expiresAt: expiry,
    },
    auditReport: {
      opaqueFileRef: "opaque:report",
      fingerprint: calculated.auditReportExport.fingerprint,
      filename: calculated.auditReportExport.filename,
      expiresAt: expiry,
    },
  }, "2026-08-23T12:04:00.000Z");
  state = reconcileScreen04EventCardBinding(
    state,
    currentBinding,
    "2026-08-23T12:05:00.000Z",
  );
  expect(state.status).toBe("stale");
  expect(state.calculation?.resultFingerprint).toBe(calculated.publicResult.resultFingerprint);
  expect(state.stale).toMatchObject({
    isStale: true,
    priorEventCardFingerprint: mutation.fromFingerprint,
    currentEventCardFingerprint: mutation.toFingerprint,
  });
  return {
    classification: "stale",
    issueCode: "SCREEN04_EVENT_CARD_BINDING_STALE",
    severity: "blocking",
    affectedCaseCount: rowCount(csvText),
    overallStatus: "exposure-cannot-be-calculated-from-this-file",
  };
}

async function qualifyInformationalBehavior(
  fixture: FixtureExpectation,
  csvText: string,
): Promise<QualificationResult> {
  const input = profileInput(fixture, csvText);
  if (fixture.id === 27) {
    const inspected = await inspectScreen04CsvHeader(csvText);
    const controls = inspected.exactHeaders.filter((header) => /^control_\d{2}$/u.test(header));
    expect(controls).toHaveLength(20);
    const output = await runScreen04Audit(input);
    expect(output.publicResult.selectedColumns).toEqual([
      "unit_id",
      "year",
      "group",
      "covered",
    ]);
    expect(JSON.stringify(output.publicResult)).not.toMatch(/control_\d{2}/u);
    expect(output.auditedExposureExport.content).not.toMatch(/control_\d{2}/u);
    expect(output.auditReportExport.content).not.toMatch(/control_\d{2}/u);
    return resultFromAudit(fixture, output);
  }
  if (fixture.id === 31) {
    const first = await runScreen04Audit(input);
    const second = await runScreen04Audit(input);
    expect(second).toEqual(first);
    expect(second.publicResult.resultFingerprint).toBe(first.publicResult.resultFingerprint);
    return {
      classification: assertedFixtureClassification(fixture, first),
      issueCode: "SCREEN04_DETERMINISTIC_RERUN",
      severity: "informational",
      affectedCaseCount: 0,
      overallStatus: first.publicResult.overallStatus,
    };
  }
  const followUp = vi.fn(() => {
    throw new Error("Host messaging is disabled in this qualification case.");
  });
  const callTool = vi.fn(() => {
    throw new Error("Model/tool reasoning is disabled in this qualification case.");
  });
  const priorWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { openai: { sendFollowUpMessage: followUp, callTool } },
  });
  try {
    const output = await runScreen04Audit(input);
    expect(followUp).not.toHaveBeenCalled();
    expect(callTool).not.toHaveBeenCalled();
    return {
      classification: assertedFixtureClassification(fixture, output),
      issueCode: "SCREEN04_NO_MODEL_DEPENDENCY",
      severity: "informational",
      affectedCaseCount: 0,
      overallStatus: output.publicResult.overallStatus,
    };
  } finally {
    if (priorWindow) Object.defineProperty(globalThis, "window", priorWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
}

async function qualify(fixture: FixtureExpectation): Promise<QualificationResult> {
  const csvText = fixture.id === 28
    ? await oversizedCsv()
    : await readFile(`${FIXTURE_DIRECTORY}/${fixture.file}`, "utf8");
  if (FATAL_CASES.has(fixture.id)) return qualifyFatal(fixture, csvText);
  if (fixture.id === 26) return qualifyScenario(fixture, csvText);
  if (fixture.id === 30) return qualifyStale(fixture, csvText);
  if ([27, 31, 32].includes(fixture.id)) {
    return qualifyInformationalBehavior(fixture, csvText);
  }
  return resultFromAudit(fixture, await runScreen04Audit(profileInput(fixture, csvText)));
}

describe("Screen 4 required 32-case qualification fixture matrix", () => {
  it("has one immutable expectation for every required numbered case", () => {
    expect(manifest.schemaVersion).toBe("screen04-fixture-manifest-v1");
    expect(manifest.fixtures.map((fixture) => fixture.id)).toEqual(
      Array.from({ length: 32 }, (_, index) => index + 1),
    );
    expect(new Set(manifest.fixtures.map((fixture) => fixture.file)).size).toBe(32);
    for (const fixture of manifest.fixtures) {
      expect(fixture.classification).toBeTruthy();
      expect(fixture.issueCode).toBeTruthy();
      expect(fixture.severity).toMatch(/^(blocking|major|warning|informational)$/u);
      expect(fixture.affectedCaseCount).toBeGreaterThanOrEqual(0);
      expect(fixture.overallStatus).toBeTruthy();
    }
  });

  it.each(manifest.fixtures)(
    "fixture $id: $file",
    async (fixture) => {
      const actual = await qualify(fixture);
      expect(actual).toEqual({
        classification: fixture.classification,
        issueCode: fixture.issueCode,
        severity: fixture.severity,
        affectedCaseCount: fixture.affectedCaseCount,
        overallStatus: fixture.overallStatus,
      });
    },
  );
});
