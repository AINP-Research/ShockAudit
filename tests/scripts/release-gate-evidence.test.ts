import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

import {
  auditAttemptTimeoutMs,
  auditArguments,
  auditFetchTimeoutMs,
  classifyAuditAttempt,
} from "../../scripts/run-lockfile-audit.mjs";
import { SHOCKAUDIT_UI_RESOURCE_URI } from "../../src/version";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const expectedCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: repositoryRoot,
  encoding: "utf8",
}).trim();
const browserTestRoot = path.join(repositoryRoot, "tests/browser");
const browserInventoryPath = path.join(
  browserTestRoot,
  "release-gate-inventory.json",
);
const browserInventoryBytes = readFileSync(browserInventoryPath);
const browserInventory = JSON.parse(browserInventoryBytes.toString("utf8")) as {
  projectName: string;
  testMatch: string[];
  testIgnore: string[];
  tests: Array<{
    file: string;
    title: string;
    expectedStatus: "passed" | "skipped";
    axeAttachments: string[];
  }>;
};
const requiredBrowserTestCount = browserInventory.tests.filter(
  (entry) => entry.expectedStatus === "passed",
).length;
const discoveredBrowserTestCount = browserInventory.tests.length;
const requiredAxeAttachmentCount = browserInventory.tests.flatMap(
  (entry) => entry.axeAttachments,
).length;
const wranglerSmokeTitle =
  "Order 841 opens the study-first Screen 2 handoff and restores useful Screen 3 guidance";
const temporaryRoot = mkdtempSync(
  path.join(tmpdir(), "shockaudit-release-gate-evidence-"),
);

afterAll(() => {
  rmSync(temporaryRoot, { recursive: true, force: true });
});
type SerializedResult = {
  status: "passed" | "failed" | "timedOut" | "skipped";
  attachments: Array<{
    name: string;
    contentType: string;
    body?: string;
  }>;
};

type SerializedTest = {
  projectName: string;
  expectedStatus: "passed" | "skipped";
  status: "expected" | "unexpected" | "flaky" | "skipped";
  results: SerializedResult[];
};

type SerializedReport = {
  config: Record<string, unknown> & {
    argv: string[];
    forbidOnly: boolean;
    metadata: Record<string, unknown>;
    projects: Array<Record<string, unknown>>;
  };
  errors: unknown[];
  stats: {
    expected: number;
    unexpected: number;
    flaky: number;
    skipped: number;
  };
  suites: Array<{
    specs: Array<{
      file: string;
      title: string;
      tests: SerializedTest[];
    }>;
  }>;
};

function axeBody() {
  return Buffer.from(JSON.stringify({
    simulatedEvidence: true,
    signedInChatGptEvidence: false,
    testEngine: { name: "axe-core", version: "4.10.2" },
    violations: [],
    incomplete: [],
  })).toString("base64");
}

function playwrightReport(): SerializedReport {
  const requiredCount = browserInventory.tests.filter(
    (entry) => entry.expectedStatus === "passed",
  ).length;
  const skippedCount = browserInventory.tests.length - requiredCount;
  return {
    config: {
      argv: [process.execPath, "/repo/node_modules/.bin/playwright", "test"],
      configFile: path.join(repositoryRoot, "playwright.config.ts"),
      failOnFlakyTests: true,
      forbidOnly: true,
      fullyParallel: false,
      grepInvert: null,
      maxFailures: 0,
      metadata: {
        shockauditExactHeadCommit: expectedCommit,
        shockauditReleaseGate: "browser-accessibility-execution",
        shockauditBrowserRuntime: "deterministic-node-worker-fixture",
      },
      projects: [{
        id: browserInventory.projectName,
        name: browserInventory.projectName,
        repeatEach: 1,
        retries: 0,
        testDir: browserTestRoot,
        testIgnore: browserInventory.testIgnore,
        testMatch: browserInventory.testMatch,
        timeout: 90_000,
      }],
      rootDir: browserTestRoot,
      shard: null,
      webServer: null,
      workers: 1,
    },
    errors: [],
    stats: {
      expected: requiredCount,
      unexpected: 0,
      flaky: 0,
      skipped: skippedCount,
    },
    suites: [{
      specs: browserInventory.tests.map((entry) => ({
        file: entry.file,
        title: entry.title,
        tests: [{
          projectName: browserInventory.projectName,
          expectedStatus: entry.expectedStatus,
          status: entry.expectedStatus === "passed" ? "expected" : "skipped",
          results: entry.expectedStatus === "passed"
            ? [{
                status: "passed",
                attachments: entry.axeAttachments.map((name) => ({
                  name,
                  contentType: "application/json",
                  body: axeBody(),
                })),
              }]
            : [],
        }],
      })),
    }],
  };
}

function wranglerSmokeReport(): SerializedReport {
  return {
    config: {
      argv: [
        process.execPath,
        "/repo/node_modules/.bin/playwright",
        "test",
        "tests/browser/six-screen-screen01-screen02.spec.ts",
        "--project=chromium",
        "--grep",
        wranglerSmokeTitle,
      ],
      configFile: path.join(repositoryRoot, "playwright.config.ts"),
      failOnFlakyTests: true,
      forbidOnly: true,
      fullyParallel: false,
      grepInvert: null,
      maxFailures: 0,
      metadata: {
        shockauditExactHeadCommit: expectedCommit,
        shockauditReleaseGate: "wrangler-smoke",
        shockauditBrowserRuntime: "playwright-owned-wrangler",
      },
      projects: [{
        id: browserInventory.projectName,
        name: browserInventory.projectName,
        repeatEach: 1,
        retries: 0,
        testDir: browserTestRoot,
        testIgnore: browserInventory.testIgnore,
        testMatch: browserInventory.testMatch,
        timeout: 90_000,
      }],
      rootDir: browserTestRoot,
      shard: null,
      webServer: {
        command: "npm run dev:browser -- --local --ip 127.0.0.1 --port 8791",
        reuseExistingServer: false,
        timeout: 120_000,
        url: "http://127.0.0.1:8791/health",
      },
      workers: 1,
    },
    errors: [],
    stats: {
      expected: 1,
      unexpected: 0,
      flaky: 0,
      skipped: 0,
    },
    suites: [{
      specs: [{
        file: "six-screen-screen01-screen02.spec.ts",
        title: wranglerSmokeTitle,
        tests: [{
          projectName: browserInventory.projectName,
          expectedStatus: "passed",
          status: "expected",
          results: [{ status: "passed", attachments: [] }],
        }],
      }],
    }],
  };
}

function runWriter(
  report: unknown,
  name: string,
  smokeReport: unknown | null = wranglerSmokeReport(),
) {
  const reportPath = path.join(temporaryRoot, `${name}-playwright.json`);
  const smokeReportPath = path.join(
    temporaryRoot,
    `${name}-wrangler-smoke.json`,
  );
  const evidencePath = path.join(temporaryRoot, `${name}-evidence.json`);
  const reportBytes = `${JSON.stringify(report, null, 2)}\n`;
  const smokeReportBytes = smokeReport === null
    ? null
    : `${JSON.stringify(smokeReport, null, 2)}\n`;
  writeFileSync(reportPath, reportBytes, "utf8");
  if (smokeReportBytes !== null) {
    writeFileSync(smokeReportPath, smokeReportBytes, "utf8");
  }
  const result = spawnSync(
    process.execPath,
    ["scripts/write-release-gate-evidence.mjs", evidencePath],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        SHOCKAUDIT_EXPECTED_COMMIT: expectedCommit,
        SHOCKAUDIT_PLAYWRIGHT_REPORT: reportPath,
        SHOCKAUDIT_WRANGLER_SMOKE_REPORT: smokeReportPath,
      },
    },
  );
  return { evidencePath, reportBytes, smokeReportBytes, result };
}

function firstRequiredTest(report: SerializedReport) {
  const spec = report.suites[0]!.specs.find(
    (entry) => entry.tests[0]?.expectedStatus === "passed",
  );
  if (!spec) throw new Error("Synthetic report has no required test.");
  return spec.tests[0]!;
}

function firstAxeSpec(report: SerializedReport) {
  const spec = report.suites[0]!.specs.find(
    (entry) => entry.tests[0]?.results[0]?.attachments.length,
  );
  if (!spec) throw new Error("Synthetic report has no Axe evidence.");
  return spec;
}

describe("exact-HEAD release gate evidence", () => {
  it("audits both exact lockfile graphs without an implicit install audit", () => {
    const workflow = readFileSync(
      path.join(repositoryRoot, ".github/workflows/ci.yml"),
      "utf8",
    );

    expect(workflow).toContain("node-version: 22.23.2");
    expect(workflow).toContain(
      "timeout 10m npm install --global npm@11.19.1 --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org/",
    );
    expect(workflow).toContain("hash -r");
    expect(workflow).toContain('test "$(npm --version)" = "11.19.1"');
    expect(workflow).toContain("timeout 10m npm ci --no-audit");
    expect(workflow).toContain("timeout 10m npm run audit:runtime");
    expect(workflow).toContain("timeout 20m npm run audit:full");
    expect(
      readFileSync(path.join(repositoryRoot, ".npmrc"), "utf8"),
    ).toMatch(/(?:^|\n)audit=false(?:\n|$)/u);
    expect(workflow).toContain(
      "timeout 1m node --check scripts/run-lockfile-audit.mjs",
    );
    const runtimeAuditArguments = auditArguments("runtime");
    const fullAuditArguments = auditArguments("full");
    expect(runtimeAuditArguments).toEqual(
      expect.arrayContaining([
        "--package-lock-only",
        "--omit=dev",
        "--audit-level=moderate",
        "--json",
        "--fetch-retries=0",
        "--fetch-timeout=120000",
        "--registry=https://registry.npmjs.org/",
        "--loglevel=http",
      ]),
    );
    expect(fullAuditArguments).toEqual(
      expect.arrayContaining([
        "--include=prod",
        "--include=dev",
        "--include=optional",
        "--include=peer",
        "--fetch-timeout=300000",
      ]),
    );
    expect(fullAuditArguments).not.toContain("--omit=dev");
    expect(runtimeAuditArguments.filter((argument) =>
      argument.startsWith("--fetch-timeout=")
    )).toEqual(["--fetch-timeout=120000"]);
    expect(fullAuditArguments.filter((argument) =>
      argument.startsWith("--fetch-timeout=")
    )).toEqual(["--fetch-timeout=300000"]);
    expect(auditFetchTimeoutMs("runtime")).toBe(120_000);
    expect(auditAttemptTimeoutMs("runtime")).toBe(170_000);
    expect(auditFetchTimeoutMs("full")).toBe(300_000);
    expect(auditAttemptTimeoutMs("full")).toBe(350_000);
    expect(auditAttemptTimeoutMs("runtime") * 3 + 4_000).toBeLessThan(
      10 * 60_000,
    );
    expect(auditAttemptTimeoutMs("full") * 3 + 4_000).toBeLessThan(
      20 * 60_000,
    );
  });

  it("accepts only a valid clean audit report and never retries vulnerabilities", () => {
    const cleanCounts = {
      info: 0,
      low: 0,
      moderate: 0,
      high: 0,
      critical: 0,
      total: 0,
    };
    expect(classifyAuditAttempt({
      status: 0,
      stdout: JSON.stringify({ metadata: { vulnerabilities: cleanCounts } }),
    })).toEqual({ outcome: "clean", exitCode: 0 });
    expect(classifyAuditAttempt({
      status: 1,
      stdout: JSON.stringify({
        metadata: {
          vulnerabilities: {
            ...cleanCounts,
            moderate: 1,
            total: 1,
          },
        },
      }),
    })).toEqual({ outcome: "vulnerabilities", exitCode: 1 });
    expect(classifyAuditAttempt({
      status: 1,
      stdout: JSON.stringify({ error: "bulk endpoint failed" }),
    })).toEqual({ outcome: "retryable", exitCode: 1 });
  });

  it("layers a real Wrangler smoke with the unfiltered browser and Axe suite", () => {
    const workflow = readFileSync(
      path.join(repositoryRoot, ".github/workflows/ci.yml"),
      "utf8",
    );
    const wranglerSmokeStep = workflow.match(
      /- name: Run Wrangler browser runtime smoke([\s\S]*?)- name: Run MCP Apps browser and accessibility acceptance/u,
    )?.[1];
    const fullBrowserStep = workflow.match(
      /- name: Run MCP Apps browser and accessibility acceptance([\s\S]*?)- name: Verify production Cloudflare bundle only/u,
    )?.[1];
    expect(wranglerSmokeStep).toBeDefined();
    expect(wranglerSmokeStep).toContain(
      "SHOCKAUDIT_BROWSER_GATE_KIND: wrangler-smoke",
    );
    expect(wranglerSmokeStep).toContain(
      "SHOCKAUDIT_PLAYWRIGHT_REPORT: artifacts/release-gates/wrangler-smoke-results.json",
    );
    expect(wranglerSmokeStep).toContain("WRANGLER_LOG: debug");
    expect(wranglerSmokeStep).toContain(
      "WRANGLER_LOG_PATH: artifacts/browser-diagnostics/wrangler-smoke-debug.log",
    );
    expect(wranglerSmokeStep).toContain(
      "mkdir -p artifacts/release-gates artifacts/browser-diagnostics",
    );
    expect(wranglerSmokeStep).toContain(
      "tests/browser/six-screen-screen01-screen02.spec.ts",
    );
    expect(wranglerSmokeStep).toContain("--project=chromium");
    expect(wranglerSmokeStep).toContain(`--grep "${wranglerSmokeTitle}"`);
    expect(fullBrowserStep).toBeDefined();
    expect(fullBrowserStep).toContain(
      "SHOCKAUDIT_BROWSER_BASE_URL: http://127.0.0.1:8791",
    );
    expect(fullBrowserStep).toContain(
      "SHOCKAUDIT_BROWSER_GATE_KIND: browser-accessibility-execution",
    );
    expect(fullBrowserStep).toContain(
      'SHOCKAUDIT_BROWSER_NODE_FIXTURE: "1"',
    );
    expect(fullBrowserStep).toContain(
      "SHOCKAUDIT_PLAYWRIGHT_REPORT: test-results/playwright-results.json",
    );
    expect(fullBrowserStep).toContain("run: npm run test:browser");
    expect(workflow).toContain(
      "artifacts/release-gates/wrangler-smoke-results.json",
    );
    expect(browserInventory.tests).toContainEqual(
      expect.objectContaining({
        file: "six-screen-screen01-screen02.spec.ts",
        title: wranglerSmokeTitle,
        expectedStatus: "passed",
      }),
    );

    const playwrightConfig = readFileSync(
      path.join(repositoryRoot, "playwright.config.ts"),
      "utf8",
    );
    expect(playwrightConfig).toContain(
      "process.env.SHOCKAUDIT_BROWSER_BASE_URL === undefined",
    );
    expect(playwrightConfig).toContain(
      '"npm run dev:browser -- --local --ip 127.0.0.1 --port 8791 --inspector-ip 127.0.0.1 --inspector-port 18791"',
    );
    expect(playwrightConfig).toContain(
      '"deterministic-node-worker-fixture"',
    );
    expect(playwrightConfig).toContain('"playwright-owned-wrangler"');
    expect(playwrightConfig).toContain("testMatch: \"**/*.spec.ts\"");
    expect(playwrightConfig).toContain("timeout: 120_000");
  });

  it("retains compact release evidence and limits duplicate browser diagnostics", () => {
    const workflow = parseYaml(readFileSync(
      path.join(repositoryRoot, ".github/workflows/ci.yml"),
      "utf8",
    ));
    const steps = workflow.jobs["test-and-build"].steps as Array<{
      name?: string;
      id?: string;
      uses?: string;
      if?: string;
      run?: string;
      env?: Record<string, string>;
      with?: Record<string, unknown>;
      "continue-on-error"?: boolean;
    }>;
    const smoke = steps.find(
      (step) => step.name === "Run Wrangler browser runtime smoke",
    );
    const browser = steps.find(
      (step) =>
        step.name === "Run MCP Apps browser and accessibility acceptance",
    );
    const record = steps.find(
      (step) => step.name === "Record exact-HEAD release gate evidence",
    );
    expect(smoke?.id).toBe("wrangler_browser_smoke");
    expect(browser?.id).toBe("browser_accessibility");
    expect(record?.id).toBe("record_release_evidence");
    const curatedBrowserEvidence = steps.find(
      (step) => step.name === "Verify curated browser evidence is complete",
    );
    expect(curatedBrowserEvidence?.id).toBe(
      "verify_curated_browser_evidence",
    );

    const prepareReleaseEvidence = steps.find(
      (step) => step.name === "Prepare bounded exact-HEAD release evidence",
    );
    expect(prepareReleaseEvidence?.id).toBe("prepare_release_evidence");
    expect(prepareReleaseEvidence?.run).toContain(
      "scripts/manage-actions-evidence.mjs prepare",
    );
    expect(prepareReleaseEvidence?.run).toContain("--profile release");
    expect(prepareReleaseEvidence?.if).toContain(
      "github.event_name == 'pull_request'",
    );
    expect(prepareReleaseEvidence?.if).toContain(
      "<!-- shockaudit-final-candidate-evidence:v0.6.2 -->",
    );
    expect(prepareReleaseEvidence?.if).not.toContain(
      "github.event.changes.body.from",
    );
    const releaseEvidence = steps.find(
      (step) => step.name === "Upload bounded exact-HEAD release evidence",
    );
    expect(releaseEvidence?.id).toBe("upload_release_evidence");
    expect(releaseEvidence?.uses).toBe("actions/upload-artifact@v4");
    expect(releaseEvidence?.if).toBe(
      "${{ success() && steps.prepare_release_evidence.outcome == 'success' }}",
    );
    expect(releaseEvidence?.with?.["if-no-files-found"]).toBe("error");
    expect(releaseEvidence?.with?.["retention-days"]).toBe(90);
    expect(releaseEvidence?.with?.["compression-level"]).toBe(9);
    expect(releaseEvidence?.with?.path).toBe(
      "${{ steps.prepare_release_evidence.outputs.stage_root }}/",
    );
    const releaseDownload = steps.find(
      (step) => step.name === "Inspect and download exact release artifact by ID",
    );
    expect(releaseDownload?.env?.SHOCKAUDIT_ARTIFACT_ID).toBe(
      "${{ steps.upload_release_evidence.outputs.artifact-id }}",
    );
    expect(releaseDownload?.env?.SHOCKAUDIT_ARTIFACT_DIGEST).toBe(
      "${{ steps.upload_release_evidence.outputs.artifact-digest }}",
    );
    expect(releaseDownload?.run).toContain(
      "/actions/artifacts/$SHOCKAUDIT_ARTIFACT_ID/zip",
    );
    expect(steps.find(
      (step) => step.name === "Verify downloaded exact-HEAD release evidence",
    )?.run).toContain("scripts/manage-actions-evidence.mjs verify");

    const prepareDiagnostics = steps.find(
      (step) => step.name === "Prepare relevant browser failure diagnostics",
    );
    expect(prepareDiagnostics?.id).toBe("prepare_browser_diagnostics");
    expect(prepareDiagnostics?.run).toContain("--profile diagnostics");
    const diagnostics = steps.find(
      (step) => step.name === "Upload bounded browser failure diagnostics",
    );
    expect(diagnostics?.uses).toBe("actions/upload-artifact@v4");
    expect(diagnostics?.if).toContain(
      "steps.prepare_browser_diagnostics.outcome == 'success'",
    );
    expect(diagnostics?.with).toMatchObject({
      "if-no-files-found": "error",
      "retention-days":
        "${{ steps.prepare_browser_diagnostics.outputs.retention_days }}",
      "compression-level": 9,
    });
    const diagnosticPaths = String(diagnostics?.with?.path ?? "");
    expect(diagnosticPaths).toBe(
      "${{ steps.prepare_browser_diagnostics.outputs.stage_root }}/",
    );
    expect(diagnosticPaths).not.toContain("playwright-report/");
    expect(steps.every((step) => step["continue-on-error"] !== true)).toBe(true);

    const playwrightConfig = readFileSync(
      path.join(repositoryRoot, "playwright.config.ts"),
      "utf8",
    );
    expect(playwrightConfig).toContain('trace: "retain-on-failure"');
    expect(playwrightConfig).toContain('screenshot: "only-on-failure"');
    expect(playwrightConfig).toContain('video: "off"');
    expect(playwrightConfig).not.toContain('["html"');

    const curatedEvidenceScript = String(curatedBrowserEvidence?.run ?? "");
    expect(curatedEvidenceScript).toContain(
      'screenshot_dir="artifacts/release-gates/screenshots"',
    );
    expect(curatedEvidenceScript).toContain(
      'test ! -L "$screenshot_dir/$screenshot"',
    );
    expect(curatedEvidenceScript).toContain(
      '(cd "$screenshot_dir" && sha256sum "$screenshot")',
    );
    expect(curatedEvidenceScript).toContain(
      'test "$(wc -l < "$checksum_file")" -eq 10',
    );
  });

  it("keeps replacement Screen 1 and Screen 2 evidence wired to the active gate", () => {
    const browserAcceptance = readFileSync(
      path.join(browserTestRoot, "six-screen-screen01-screen02.spec.ts"),
      "utf8",
    );
    expect(browserAcceptance).toContain("expectStandardPolicyResearchComplete");
    expect(browserAcceptance).toContain("Done! Please see below.");
    expect(browserAcceptance).toContain("Policy episode overview");
    expect(browserAcceptance).toContain(
      "uses a compact inline launcher and opens the fullscreen workspace without an inline-return control",
    );
    expect(browserAcceptance).toContain("__shockAuditRemount([])");
    expect(browserAcceptance).toContain(
      "No policy from a different jurisdiction was substituted",
    );
    expect(browserInventory.tests).toEqual(expect.arrayContaining([
      expect.objectContaining({
        file: "six-screen-screen01-screen02.spec.ts",
        title: "uses a compact inline launcher and opens the fullscreen workspace without an inline-return control",
        expectedStatus: "passed",
        axeAttachments: [
          "simulated-six-screen-inline-launcher-axe-wcag-a-aa.json",
        ],
      }),
      expect.objectContaining({
        file: "six-screen-screen01-screen02.spec.ts",
        title: "uses the actual embedded width for the sidebar, compact rail, and phone selector",
        expectedStatus: "passed",
        axeAttachments: [],
      }),
      expect.objectContaining({
        file: "six-screen-screen01-screen02.spec.ts",
        title: "minimal CCPA regression accepts leading whitespace with supplied official source over the compatibility bridge without optional fields",
        expectedStatus: "passed",
        axeAttachments: [
          "simulated-six-screen-screen01-ccpa-minimal-match-axe-wcag-a-aa.json",
        ],
      }),
      expect.objectContaining({
        file: "six-screen-screen01-screen02.spec.ts",
        title: "minimal CCPA regression accepts ordinary name-only input without optional fields",
        expectedStatus: "passed",
        axeAttachments: [],
      }),
      expect.objectContaining({
        file: "six-screen-screen01-screen02.spec.ts",
        title: "minimal CCPA regression accepts trailing whitespace name-only input without optional fields",
        expectedStatus: "passed",
        axeAttachments: [],
      }),
      expect.objectContaining({
        file: "six-screen-screen01-screen02.spec.ts",
        title: "minimal CCPA regression accepts name-only alias without optional fields",
        expectedStatus: "passed",
        axeAttachments: [],
      }),
      expect.objectContaining({
        file: "six-screen-screen01-screen02.spec.ts",
        title: "reconciles interrupted identity and automatic policy receipts without creating a second research task",
        expectedStatus: "passed",
        axeAttachments: [],
      }),
      expect.objectContaining({
        file: "six-screen-screen01-screen02.spec.ts",
        title: "CCPA supplied-source journey preserves study semantics, opens retained-evidence Screen 2, and keeps responsive navigation state",
        expectedStatus: "passed",
        axeAttachments: [
          "simulated-six-screen-screen01-ccpa-match-axe-wcag-a-aa.json",
          "simulated-six-screen-screen02-ccpa-retained-evidence-axe-wcag-a-aa.json",
          "simulated-six-screen-screen03-ccpa-study-first-axe-wcag-a-aa.json",
        ],
      }),
      expect.objectContaining({
        file: "six-screen-screen01-screen02.spec.ts",
        title: wranglerSmokeTitle,
        expectedStatus: "passed",
        axeAttachments: [
          "simulated-six-screen-screen01-order841-identity-axe-wcag-a-aa.json",
          "simulated-six-screen-screen03-order841-restored-axe-wcag-a-aa.json",
        ],
      }),
      expect.objectContaining({
        file: "six-screen-screen01-screen02.spec.ts",
        title: "replacement Screen 1 preserves an unsupported jurisdiction without substituting or opening Screen 2",
        expectedStatus: "passed",
        axeAttachments: [
          "simulated-six-screen-screen01-unsupported-jurisdiction-axe-wcag-a-aa.json",
        ],
      }),
    ]));
  });

  it("binds the exact inventory, report, HEAD, and Axe evidence to the release", () => {
    const { evidencePath, reportBytes, smokeReportBytes, result } = runWriter(
      playwrightReport(),
      "valid",
    );
    expect(result.status, result.stderr).toBe(0);
    const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
    expect(evidence).toMatchObject({
      packageVersion: "0.6.2",
      productReleaseLabel: "v0.6.2",
      activeUiResourceUri: SHOCKAUDIT_UI_RESOURCE_URI,
      exactHeadCommit: expectedCommit,
      playwrightEvidence: {
        inventorySchemaVersion: "shockaudit-browser-release-inventory-v1",
        expected: requiredBrowserTestCount,
        unexpected: 0,
        discoveredChromiumTests: discoveredBrowserTestCount,
        executedChromiumTests: requiredBrowserTestCount,
        passedChromiumTests: requiredBrowserTestCount,
        passedAxeAttachmentCount: requiredAxeAttachmentCount,
        runtimeMode: "deterministic-node-worker-fixture",
        wranglerSmokeTitle,
        wranglerSmokePassed: true,
      },
    });
    expect(evidence.playwrightEvidence.reportSha256).toBe(
      `sha256:${createHash("sha256").update(reportBytes).digest("hex")}`,
    );
    expect(evidence.playwrightEvidence.inventorySha256).toBe(
      `sha256:${createHash("sha256").update(browserInventoryBytes).digest("hex")}`,
    );
    expect(evidence.playwrightEvidence.wranglerSmokeReportSha256).toBe(
      `sha256:${createHash("sha256").update(smokeReportBytes!).digest("hex")}`,
    );
  });

  it("rejects missing, failed, or non-Wrangler smoke evidence", () => {
    const missingResult = runWriter(
      playwrightReport(),
      "missing-wrangler-smoke",
      null,
    ).result;
    expect(missingResult.status).toBe(1);
    expect(missingResult.stderr).toMatch(
      /Wrangler smoke JSON evidence is required/iu,
    );

    const failed = wranglerSmokeReport();
    failed.stats.expected = 0;
    failed.stats.unexpected = 1;
    failed.suites[0]!.specs[0]!.tests[0]!.status = "unexpected";
    failed.suites[0]!.specs[0]!.tests[0]!.results[0]!.status = "failed";
    const failedResult = runWriter(
      playwrightReport(),
      "failed-wrangler-smoke",
      failed,
    ).result;
    expect(failedResult.status).toBe(1);
    expect(failedResult.stderr).toMatch(/real-Wrangler browser smoke/iu);

    const wrongRuntime = wranglerSmokeReport();
    wrongRuntime.config.metadata.shockauditBrowserRuntime =
      "deterministic-node-worker-fixture";
    const wrongRuntimeResult = runWriter(
      playwrightReport(),
      "non-wrangler-smoke",
      wrongRuntime,
    ).result;
    expect(wrongRuntimeResult.status).toBe(1);
    expect(wrongRuntimeResult.stderr).toMatch(
      /exact bounded real-workerd configuration/iu,
    );
  });

  it("rejects a missing, added, or skipped required inventory test", () => {
    const missing = playwrightReport();
    const removedIndex = missing.suites[0]!.specs.findIndex(
      (entry) => entry.tests[0]?.expectedStatus === "passed",
    );
    missing.suites[0]!.specs.splice(removedIndex, 1);
    missing.stats.expected -= 1;
    const missingResult = runWriter(missing, "missing-test").result;
    expect(missingResult.status).toBe(1);
    expect(missingResult.stderr).toMatch(/checked-in browser test inventory/iu);

    const added = playwrightReport();
    added.suites[0]!.specs.push({
      file: "extra.spec.ts",
      title: "Unreviewed extra test",
      tests: [{
        projectName: "chromium",
        expectedStatus: "skipped",
        status: "skipped",
        results: [],
      }],
    });
    added.stats.skipped += 1;
    const addedResult = runWriter(added, "added-test").result;
    expect(addedResult.status).toBe(1);
    expect(addedResult.stderr).toMatch(/checked-in browser test inventory/iu);

    const newlySkipped = playwrightReport();
    const required = firstRequiredTest(newlySkipped);
    required.expectedStatus = "skipped";
    required.status = "skipped";
    required.results = [];
    newlySkipped.stats.expected -= 1;
    newlySkipped.stats.skipped += 1;
    const skippedResult = runWriter(newlySkipped, "newly-skipped").result;
    expect(skippedResult.status).toBe(1);
    expect(skippedResult.stderr).toMatch(/checked-in browser test inventory/iu);
  });

  it("rejects missing, moved, or body-free Axe evidence", () => {
    const missing = playwrightReport();
    firstAxeSpec(missing).tests[0]!.results[0]!.attachments = [];
    const missingResult = runWriter(missing, "missing-axe").result;
    expect(missingResult.status).toBe(1);
    expect(missingResult.stderr).toMatch(/exact named Axe coverage/iu);

    const invalid = playwrightReport();
    delete firstAxeSpec(invalid).tests[0]!.results[0]!.attachments[0]!.body;
    const invalidResult = runWriter(invalid, "body-free-axe").result;
    expect(invalidResult.status).toBe(1);
    expect(invalidResult.stderr).toMatch(/missing valid, passing axe-core evidence/iu);

    const moved = playwrightReport();
    const source = firstAxeSpec(moved);
    const [attachment] = source.tests[0]!.results[0]!.attachments.splice(0, 1);
    const destination = moved.suites[0]!.specs.find(
      (entry) =>
        entry !== source &&
        entry.tests[0]?.expectedStatus === "passed" &&
        entry.tests[0].results[0],
    );
    if (!attachment || !destination) {
      throw new Error("Synthetic report cannot move Axe evidence.");
    }
    destination.tests[0]!.results[0]!.attachments.push(attachment);
    const movedResult = runWriter(moved, "moved-axe").result;
    expect(movedResult.status).toBe(1);
    expect(movedResult.stderr).toMatch(/exact named Axe coverage/iu);
  });

  it("rejects unexpected, focused, nonlocal, parallel, and non-exact-head reports", () => {
    const unexpected = playwrightReport();
    const required = firstRequiredTest(unexpected);
    required.status = "unexpected";
    required.results[0]!.status = "failed";
    unexpected.stats.expected -= 1;
    unexpected.stats.unexpected = 1;
    const unexpectedResult = runWriter(unexpected, "unexpected").result;
    expect(unexpectedResult.status).toBe(1);
    expect(unexpectedResult.stderr).toMatch(/unexpected, or flaky test failures/iu);

    const focusCapable = playwrightReport();
    focusCapable.config.forbidOnly = false;
    const focusResult = runWriter(focusCapable, "allows-only").result;
    expect(focusResult.status).toBe(1);
    expect(focusResult.stderr).toMatch(/exact complete, unfiltered Chromium/iu);

    const parallel = playwrightReport();
    parallel.config.workers = 2;
    const parallelResult = runWriter(parallel, "parallel").result;
    expect(parallelResult.status).toBe(1);
    expect(parallelResult.stderr).toMatch(/exact complete, unfiltered Chromium/iu);

    const nonlocal = playwrightReport();
    nonlocal.config.webServer = {
      command: "true",
      reuseExistingServer: true,
      timeout: 120_000,
      url: "https://example.test/health",
    };
    const nonlocalResult = runWriter(nonlocal, "nonlocal").result;
    expect(nonlocalResult.status).toBe(1);
    expect(nonlocalResult.stderr).toMatch(/exact complete, unfiltered Chromium/iu);

    const wrongHead = playwrightReport();
    wrongHead.config.metadata.shockauditExactHeadCommit = "0".repeat(40);
    const wrongHeadResult = runWriter(wrongHead, "wrong-head").result;
    expect(wrongHeadResult.status).toBe(1);
    expect(wrongHeadResult.stderr).toMatch(/metadata-bound to the exact HEAD/iu);
  });

  it("rejects discovery-only, grep-filtered, and file-selected invocations", () => {
    for (const [name, extraArg] of [
      ["list", "--list"],
      ["grep", "--grep=accessibility"],
      ["file", "one.spec.ts"],
    ] as const) {
      const report = playwrightReport();
      report.config.argv.push(extraArg);
      const result = runWriter(report, name).result;
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/unfiltered full `playwright test` invocation/iu);
    }
  });

  it("requires a full production commit before the live verifier contacts a target", () => {
    for (const [name, commit] of [
      ["missing", ""],
      ["prefix", expectedCommit.slice(0, 7)],
    ] as const) {
      const result = spawnSync(
        process.execPath,
        [
          "scripts/verify-live-mcp.mjs",
          "--evidence-dir",
          path.join(temporaryRoot, `live-${name}`),
        ],
        {
          cwd: repositoryRoot,
          encoding: "utf8",
          env: {
            ...process.env,
            SHOCKAUDIT_BASE_URL: "https://invalid.example",
            SHOCKAUDIT_EXPECTED_COMMIT: commit,
          },
        },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/full 40-hex production commit/iu);
    }
  });
});
