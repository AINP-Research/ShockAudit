import { describe, expect, it, vi } from "vitest";

import {
  SCREEN_04_EXECUTION_MODE,
  SCREEN_04_RULE_VERSION,
  Screen04CoreError,
  SCREEN_04_STAGE_A_LIMITS,
  inspectScreen04CsvHeader,
  scanScreen04SelectedCsv,
  runScreen04FeasibilitySlice,
  type Screen04FeasibilityInput,
} from "../../src/core/screen04-feasibility";

function input(csvText: string): Screen04FeasibilityInput {
  return {
    csvText,
    mappings: {
      unitIdentifier: "GVKEY",
      year: "year",
      treatmentGroup: "treated",
      researcherTreatmentYear: 2020,
      treatedValue: "1",
      comparisonValue: "0",
    },
    eventCard: {
      eventCardId: "event-card-ccpa",
      eventCardVersion: "locked-v1",
      eventCardFingerprint:
        "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      verifiedShockName: "California Consumer Privacy Act",
      rule: {
        kind: "categorical-equals",
        ruleId: "ccpa-operating-state-rule",
        requirementLabel: "Operates in California",
        csvColumn: "operating_state",
        exposedValue: "CA",
        exposureStartYear: 2020,
        exposureComponent: "substantive-duty",
        exposureVersion: "original",
        evidenceIds: ["ccpa-effective-date", "ccpa-coverage"],
      },
    },
  };
}

const CLEAN_CSV = [
  "GVKEY,year,treated,operating_state,outcome,control_1",
  "001,2019,1,CA,private-outcome-a,private-control-a",
  "001,2020,1,CA,private-outcome-b,private-control-b",
  "002,2019,0,NV,private-outcome-c,private-control-c",
  "002,2020,0,NV,private-outcome-d,private-control-d",
].join("\n");

async function expectCode(
  promise: Promise<unknown>,
  code: Screen04CoreError["code"],
) {
  await expect(promise).rejects.toMatchObject({ code });
}

describe("Screen 4 Stage A deterministic feasibility core", () => {
  it("reads exact headers, maps an annual unit-year panel, applies one typed rule, and exports classifications", async () => {
    const result = await runScreen04FeasibilitySlice(input(CLEAN_CSV));

    expect(result.publicResult).toMatchObject({
      executionMode: SCREEN_04_EXECUTION_MODE,
      ruleVersion: SCREEN_04_RULE_VERSION,
      verifiedShockName: "California Consumer Privacy Act",
      selectedColumns: ["GVKEY", "year", "treated", "operating_state"],
      rowCount: 4,
      observedYearRange: { earliest: 2019, latest: 2020 },
      classificationCounts: {
        exposed: 1,
        unexposed: 1,
        unknown: 0,
        not_applicable: 2,
        total: 4,
      },
      overallStatus: "exposure-coding-is-executable",
      findings: [],
    });
    expect(result.auditedExposureExport.content).toContain(
      "001,2020,1,2020,exposed,substantive-duty,original,2020,SCREEN04_RULE_MATCH_AFTER_START",
    );
    expect(result.auditedExposureExport.content).toContain(
      "002,2020,0,2020,unexposed,substantive-duty,original,2020,SCREEN04_RULE_NOT_MATCHED",
    );
    expect(result.auditedExposureExport.content).not.toContain("private-outcome");
    expect(result.auditedExposureExport.content).not.toContain("private-control");
  });

  it("inspects only the exact CSV header before mappings and enforces bounded columns", async () => {
    const inspected = await inspectScreen04CsvHeader(CLEAN_CSV);
    expect(inspected).toMatchObject({
      schemaVersion: "screen-04-header-inspection-v1",
      exactHeaders: [
        "GVKEY",
        "year",
        "treated",
        "operating_state",
        "outcome",
        "control_1",
      ],
    });
    expect(inspected.csvFingerprint).toMatch(/^sha256:[a-f0-9]{64}$/u);

    const tooManyHeaders = Array.from(
      { length: SCREEN_04_STAGE_A_LIMITS.maximumColumns + 1 },
      (_, index) => `column_${index}`,
    ).join(",");
    await expectCode(
      inspectScreen04CsvHeader(`${tooManyHeaders}\n`),
      "SCREEN04_COLUMN_LIMIT_EXCEEDED",
    );

    const maximumHeaders = Array.from(
      { length: SCREEN_04_STAGE_A_LIMITS.maximumColumns },
      (_, index) => `column_${index}`,
    );
    await expect(inspectScreen04CsvHeader(`${maximumHeaders.join(",")}\n`))
      .resolves.toMatchObject({ headerCount: 128 });
  });

  it("accepts the exact byte boundary, rejects one byte beyond it, and bounds selected fields", async () => {
    const exactBytes = `a\n${"x".repeat(
      SCREEN_04_STAGE_A_LIMITS.maximumFileBytes - 2,
    )}`;
    await expect(inspectScreen04CsvHeader(exactBytes)).resolves.toMatchObject({
      byteLength: SCREEN_04_STAGE_A_LIMITS.maximumFileBytes,
      exactHeaders: ["a"],
    });
    await expectCode(
      inspectScreen04CsvHeader(`${exactBytes}x`),
      "SCREEN04_FILE_LIMIT_EXCEEDED",
    );

    const selectedHeaders = Array.from({ length: 16 }, (_, index) => `s${index}`);
    expect(scanScreen04SelectedCsv(
      `${selectedHeaders.join(",")}\n${selectedHeaders.map(() => "v").join(",")}`,
      selectedHeaders,
      () => undefined,
    )).toMatchObject({ rowCount: 1, headerCount: 16 });
    expect(() => scanScreen04SelectedCsv(
      `${[...selectedHeaders, "s16"].join(",")}\n${Array.from({ length: 17 }, () => "v").join(",")}`,
      [...selectedHeaders, "s16"],
      () => undefined,
    )).toThrow(/at most|between 1 and 16/iu);
  });

  it("treats prototype-like exact headers as ordinary selected cells", () => {
    let visits = 0;
    const scanned = scanScreen04SelectedCsv(
      "__proto__,constructor,toString\nproto-value,constructor-value,string-value",
      ["__proto__", "constructor", "toString"],
      (values) => {
        visits += 1;
        expect(Object.getPrototypeOf(values)).toBeNull();
        expect(values["__proto__"]).toBe("proto-value");
        expect(values.constructor).toBe("constructor-value");
        expect(values.toString).toBe("string-value");
      },
    );

    expect(scanned.rowCount).toBe(1);
    expect(visits).toBe(1);
    expect(Object.prototype).not.toHaveProperty("proto-value");
  });

  it("uses strict case-sensitive header equality and reports the exact available case", async () => {
    const mismatch = input(CLEAN_CSV);
    mismatch.mappings.unitIdentifier = "gvkey";

    await expectCode(
      runScreen04FeasibilitySlice(mismatch),
      "SCREEN04_UNIT_IDENTIFIER_NOT_FOUND",
    );
    await expect(runScreen04FeasibilitySlice(mismatch)).rejects.toThrow(
      /case-sensitive.*`GVKEY`/u,
    );
  });

  it("does not trim a hidden trailing space from a header", async () => {
    const trailing = input(CLEAN_CSV.replace("GVKEY,", "GVKEY ,"));

    await expectCode(
      runScreen04FeasibilitySlice(trailing),
      "SCREEN04_COLUMN_NAME_FORMATTING_PROBLEM",
    );
    await expect(runScreen04FeasibilitySlice(trailing)).rejects.toThrow(
      /`GVKEY ` rather than `GVKEY`/u,
    );
  });

  it("blocks an absent exact Event Card requirement mapping", async () => {
    const missing = input(CLEAN_CSV);
    missing.eventCard.rule.csvColumn = "operating_location";

    await expectCode(
      runScreen04FeasibilitySlice(missing),
      "SCREEN04_REQUIRED_EXPOSURE_VARIABLE_NOT_MAPPED",
    );
  });

  it("classifies missing required values as unknown rather than unexposed and emits reason-coded findings", async () => {
    const partial = input(CLEAN_CSV.replace("002,2020,0,NV", "002,2020,0,"));
    const result = await runScreen04FeasibilitySlice(partial);

    expect(result.publicResult.classificationCounts).toMatchObject({
      unknown: 1,
      unexposed: 0,
    });
    expect(result.publicResult.overallStatus).toBe("partial-audit-only");
    expect(result.publicResult.findings).toContainEqual(
      expect.objectContaining({
        code: "SCREEN04_RESEARCHER_COMPARISON_AUDITED_UNKNOWN",
        affectedCaseCount: 1,
        blocksFullExposure: true,
      }),
    );
    expect(result.auditedExposureExport.content).toContain(
      "unknown,substantive-duty,original,2020,SCREEN04_REQUIRED_VALUE_MISSING",
    );
  });

  it("blocks duplicate unit-years and non-annual time values without leaking cell contents", async () => {
    const duplicate = input(`${CLEAN_CSV}\n001,2020,1,CA,secret,secret`);
    await expectCode(
      runScreen04FeasibilitySlice(duplicate),
      "SCREEN04_DUPLICATE_UNIT_YEAR",
    );

    const invalidYear = input(CLEAN_CSV.replace("001,2019", "001,2019-Q1"));
    await expectCode(
      runScreen04FeasibilitySlice(invalidYear),
      "SCREEN04_INVALID_ANNUAL_TIME",
    );
    await expect(runScreen04FeasibilitySlice(invalidYear)).rejects.not.toThrow(
      /2019-Q1/u,
    );
  });

  it("reports treatment-group miscoding from audited exposure with deterministic counts", async () => {
    const miscoded = input([
      "GVKEY,year,treated,operating_state",
      "001,2020,1,NV",
      "002,2020,0,CA",
    ].join("\n"));
    const result = await runScreen04FeasibilitySlice(miscoded);

    expect(result.publicResult.overallStatus).toBe("proceed-with-repairs");
    expect(result.publicResult.findings.map((item) => [item.code, item.affectedCaseCount])).toEqual([
      ["SCREEN04_RESEARCHER_TREATED_AUDITED_UNEXPOSED", 1],
      ["SCREEN04_RESEARCHER_COMPARISON_AUDITED_EXPOSED", 1],
    ]);
  });

  it("produces identical ordered output and fingerprints for an identical rerun", async () => {
    const first = await runScreen04FeasibilitySlice(input(CLEAN_CSV));
    const second = await runScreen04FeasibilitySlice(input(CLEAN_CSV));

    expect(second).toEqual(first);
    expect(first.publicResult.csvFingerprint).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(first.publicResult.resultFingerprint).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(first.auditedExposureExport.fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/u);
  });

  it("hardens every exported user-derived string cell against CSV formula injection", async () => {
    const malicious = input([
      "GVKEY,year,treated,operating_state",
      "=1+1,2020,1,CA",
      "+SUM(A1:A2),2020,0,NV",
      "-2+3,2021,1,CA",
      "@cmd,2021,0,NV",
    ].join("\n"));
    const result = await runScreen04FeasibilitySlice(malicious);

    expect(result.auditedExposureExport.content).toContain("'=1+1,2020");
    expect(result.auditedExposureExport.content).toContain("'+SUM(A1:A2),2020");
    expect(result.auditedExposureExport.content).toContain("'-2+3,2021");
    expect(result.auditedExposureExport.content).toContain("'@cmd,2021");
    expect(result.affectedCasesExport.content).not.toMatch(
      /(?:^|\r\n)[=+\-@]/u,
    );
  });

  it("keeps raw rows and ignored values out of the model-safe public result and performs no messaging or logging", async () => {
    const consoleSpies = [
      vi.spyOn(console, "log").mockImplementation(() => undefined),
      vi.spyOn(console, "info").mockImplementation(() => undefined),
      vi.spyOn(console, "warn").mockImplementation(() => undefined),
      vi.spyOn(console, "error").mockImplementation(() => undefined),
    ];
    try {
      const result = await runScreen04FeasibilitySlice(input(CLEAN_CSV));
      const publicJson = JSON.stringify(result.publicResult);

      expect(publicJson).not.toContain("private-outcome");
      expect(publicJson).not.toContain("private-control");
      expect(publicJson).not.toContain("outcome");
      expect(publicJson).not.toContain("control_1");
      expect(publicJson).not.toContain('"001"');
      expect(publicJson).not.toContain('"002"');
      expect(publicJson).not.toMatch(/ui\/message|sendFollowUpMessage|modelContent/iu);
      for (const spy of consoleSpies) expect(spy).not.toHaveBeenCalled();
    } finally {
      for (const spy of consoleSpies) spy.mockRestore();
    }
  });
});
