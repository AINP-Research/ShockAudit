import { spawn } from "node:child_process";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = resolve(
  repositoryRoot,
  "scripts/release-test-baseline.json",
);

function normalizedPath(value) {
  return relative(repositoryRoot, value).replaceAll("\\", "/");
}

export function releaseTestFailureKeys(report) {
  const failures = [];
  for (const testResult of report?.testResults ?? []) {
    const path = normalizedPath(testResult.name);
    const failedAssertions = (testResult.assertionResults ?? []).filter(
      (assertion) => assertion.status === "failed",
    );
    for (const assertion of failedAssertions) {
      failures.push(`${path} :: ${assertion.fullName}`);
    }
    if (testResult.status === "failed" && failedAssertions.length === 0) {
      failures.push(`${path} :: [suite initialization]`);
    }
  }
  return failures.sort();
}

export function validateReleaseTestReport(report, baseline) {
  const issues = [];
  if (baseline?.schemaVersion !== "shockaudit-release-test-baseline-v1") {
    issues.push("The release-test baseline has the wrong schema version.");
  }
  const expected = Array.isArray(baseline?.expectedFailures)
    ? [...baseline.expectedFailures].sort()
    : [];
  const actual = releaseTestFailureKeys(report);
  if (new Set(expected).size !== expected.length) {
    issues.push("The release-test baseline contains duplicate failure keys.");
  }
  if (new Set(actual).size !== actual.length) {
    issues.push("The Vitest report contains duplicate failure keys.");
  }
  if (baseline?.expectedFailureCount !== expected.length) {
    issues.push("The baseline failure count does not match its failure list.");
  }
  if (report?.numFailedTests !== actual.length) {
    issues.push("The Vitest failure count does not match its assertion report.");
  }
  if (
    !Number.isSafeInteger(report?.numTotalTests) ||
    report.numTotalTests < baseline?.minimumTotalTests
  ) {
    issues.push(
      `The release suite ran ${String(report?.numTotalTests)} tests; ` +
      `at least ${String(baseline?.minimumTotalTests)} are required.`,
    );
  }

  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const unexpected = actual.filter((failure) => !expectedSet.has(failure));
  const missing = expected.filter((failure) => !actualSet.has(failure));
  if (unexpected.length > 0) {
    issues.push(
      `Unexpected release-test failures:\n${unexpected.map((item) => `- ${item}`).join("\n")}`,
    );
  }
  if (missing.length > 0) {
    issues.push(
      `Baseline failures changed or passed; review and update the baseline explicitly:\n${missing.map((item) => `- ${item}`).join("\n")}`,
    );
  }
  return { issues, actual };
}

async function runVitest(reportPath) {
  const vitestPath = resolve(repositoryRoot, "node_modules/vitest/vitest.mjs");
  return await new Promise((resolveExit, reject) => {
    const child = spawn(
      process.execPath,
      [vitestPath, "run", "--reporter=json", `--outputFile=${reportPath}`],
      { cwd: repositoryRoot, env: process.env, stdio: "inherit" },
    );
    child.on("error", reject);
    child.on("exit", (code, signal) => resolveExit({ code, signal }));
  });
}

async function main() {
  const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
  const temporaryRoot = await mkdtemp(join(tmpdir(), "shockaudit-release-tests-"));
  const reportPath = resolve(temporaryRoot, "vitest-report.json");
  try {
    const outcome = await runVitest(reportPath);
    if (outcome.signal || (outcome.code !== 0 && outcome.code !== 1)) {
      throw new Error(
        `Vitest ended abnormally (code ${String(outcome.code)}, signal ${String(outcome.signal)}).`,
      );
    }
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    const { issues, actual } = validateReleaseTestReport(report, baseline);
    if (issues.length > 0) {
      throw new Error(issues.join("\n\n"));
    }
    console.log(
      `Release test gate passed: ${report.numPassedTests} tests passed, ` +
      `${actual.length} pinned migration-baseline failures were unchanged, and ` +
      "no new failure occurred.",
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "The release test gate failed.",
    );
    process.exitCode = 1;
  });
}
