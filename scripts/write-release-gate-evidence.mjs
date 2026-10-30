import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  SHOCKAUDIT_RELEASE_LABEL,
  SHOCKAUDIT_UI_RESOURCE_URI,
} from "../src/version.ts";

const destination = resolve(
  process.argv[2] ?? "artifacts/release-gates/exact-head.json",
);
const expectedCommit = process.env.SHOCKAUDIT_EXPECTED_COMMIT?.trim();
if (!expectedCommit) {
  throw new Error("SHOCKAUDIT_EXPECTED_COMMIT is required.");
}
if (!/^[0-9a-f]{40}$/u.test(expectedCommit)) {
  throw new Error("SHOCKAUDIT_EXPECTED_COMMIT must be a full lowercase Git SHA.");
}

const head = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
}).trim();
if (head !== expectedCommit) {
  throw new Error(`HEAD ${head} does not equal expected ${expectedCommit}.`);
}

const packageMetadata = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
if (packageMetadata.version !== "0.6.2") {
  throw new Error(`Expected package version 0.6.2, got ${packageMetadata.version}.`);
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJson(bytes, label) {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error(`${label} is not valid JSON.`);
  }
}

function sameStringArray(actual, expected) {
  return Array.isArray(actual) &&
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index]);
}

function testIdentity(file, title) {
  return `${file}\u0000${title}`;
}

const inventoryPath = fileURLToPath(
  new URL("../tests/browser/release-gate-inventory.json", import.meta.url),
);
const inventoryBytes = await readFile(inventoryPath);
const inventory = parseJson(inventoryBytes, "Browser release inventory");
if (
  !isRecord(inventory) ||
  inventory.schemaVersion !== "shockaudit-browser-release-inventory-v1" ||
  inventory.projectName !== "chromium" ||
  !sameStringArray(inventory.testMatch, ["**/*.spec.ts"]) ||
  !sameStringArray(inventory.testIgnore, []) ||
  !Array.isArray(inventory.tests) ||
  inventory.tests.length === 0
) {
  throw new Error("Browser release inventory has an invalid release schema.");
}
const inventoryTests = inventory.tests.map((entry, index) => {
  if (
    !isRecord(entry) ||
    typeof entry.file !== "string" ||
    !/^[a-z0-9][a-z0-9._-]*\.spec\.ts$/iu.test(entry.file) ||
    typeof entry.title !== "string" ||
    entry.title.trim() !== entry.title ||
    entry.title.length === 0 ||
    !["passed", "skipped"].includes(entry.expectedStatus) ||
    !Array.isArray(entry.axeAttachments) ||
    entry.axeAttachments.some((name) =>
      typeof name !== "string" ||
      !name.endsWith("-axe-wcag-a-aa.json")
    ) ||
    new Set(entry.axeAttachments).size !== entry.axeAttachments.length ||
    (entry.expectedStatus === "skipped" && entry.axeAttachments.length > 0)
  ) {
    throw new Error(`Browser release inventory test ${index + 1} is invalid.`);
  }
  return {
    file: entry.file,
    title: entry.title,
    expectedStatus: entry.expectedStatus,
    axeAttachments: entry.axeAttachments,
    identity: testIdentity(entry.file, entry.title),
  };
});
if (
  new Set(inventoryTests.map(({ identity }) => identity)).size !==
    inventoryTests.length
) {
  throw new Error("Browser release inventory contains a duplicate test identity.");
}
const inventoryAxeKeys = inventoryTests.flatMap((entry) =>
  entry.axeAttachments.map((name) => `${entry.identity}\u0000${name}`)
);
if (new Set(inventoryAxeKeys).size !== inventoryAxeKeys.length) {
  throw new Error("Browser release inventory contains duplicate Axe evidence.");
}

const playwrightReportPath = resolve(
  process.env.SHOCKAUDIT_PLAYWRIGHT_REPORT ??
    "test-results/playwright-results.json",
);
let playwrightReportBytes;
try {
  playwrightReportBytes = await readFile(playwrightReportPath);
} catch (error) {
  throw new Error(
    `Playwright JSON evidence is required at ${playwrightReportPath}: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
}
const playwrightReport = parseJson(
  playwrightReportBytes,
  "Playwright JSON evidence",
);

const wranglerSmokeReportPath = resolve(
  process.env.SHOCKAUDIT_WRANGLER_SMOKE_REPORT ??
    "artifacts/release-gates/wrangler-smoke-results.json",
);
let wranglerSmokeReportBytes;
try {
  wranglerSmokeReportBytes = await readFile(wranglerSmokeReportPath);
} catch (error) {
  throw new Error(
    `Wrangler smoke JSON evidence is required at ${wranglerSmokeReportPath}: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
}
const wranglerSmokeReport = parseJson(
  wranglerSmokeReportBytes,
  "Wrangler smoke JSON evidence",
);

const playwrightConfig = isRecord(playwrightReport)
  ? playwrightReport.config
  : null;
if (
  !isRecord(playwrightConfig) ||
  !isRecord(playwrightConfig.metadata) ||
  playwrightConfig.metadata.shockauditExactHeadCommit !== head ||
  playwrightConfig.metadata.shockauditReleaseGate !==
    "browser-accessibility-execution" ||
  playwrightConfig.metadata.shockauditBrowserRuntime !==
    "deterministic-node-worker-fixture"
) {
  throw new Error(
    "Playwright JSON evidence is not release-gate metadata-bound to the exact HEAD.",
  );
}

const playwrightArgv = playwrightConfig?.argv;
if (
  !Array.isArray(playwrightArgv) ||
  playwrightArgv.length !== 3 ||
  !/^playwright(?:\.js|\.cmd)?$/iu.test(basename(playwrightArgv[1] ?? "")) ||
  playwrightArgv[2] !== "test"
) {
  throw new Error(
    "Playwright JSON evidence must come from the unfiltered full `playwright test` invocation, not discovery, grep, or a selected file.",
  );
}
const chromiumProject = Array.isArray(playwrightConfig.projects) &&
    playwrightConfig.projects.length === 1 &&
    isRecord(playwrightConfig.projects[0])
  ? playwrightConfig.projects[0]
  : null;
const browserTestRoot = resolve(
  fileURLToPath(new URL("../tests/browser/", import.meta.url)),
);
const playwrightConfigPath = resolve(
  fileURLToPath(new URL("../playwright.config.ts", import.meta.url)),
);
if (
  playwrightConfig.failOnFlakyTests !== true ||
  playwrightConfig.forbidOnly !== true ||
  playwrightConfig.fullyParallel !== false ||
  playwrightConfig.workers !== 1 ||
  playwrightConfig.maxFailures !== 0 ||
  playwrightConfig.shard !== null ||
  playwrightConfig.grepInvert !== null ||
  resolve(playwrightConfig.configFile ?? "") !== playwrightConfigPath ||
  playwrightConfig.webServer != null ||
  !chromiumProject ||
  chromiumProject.id !== inventory.projectName ||
  chromiumProject.name !== inventory.projectName ||
  resolve(chromiumProject.testDir ?? "") !== browserTestRoot ||
  resolve(playwrightConfig.rootDir ?? "") !== browserTestRoot ||
  !sameStringArray(chromiumProject.testMatch, inventory.testMatch) ||
  !sameStringArray(chromiumProject.testIgnore, inventory.testIgnore) ||
  chromiumProject.repeatEach !== 1 ||
  chromiumProject.retries !== 0 ||
  chromiumProject.timeout !== 90_000
) {
  throw new Error(
    "Playwright JSON evidence did not use the exact complete, unfiltered Chromium release configuration.",
  );
}

const wranglerSmokeConfig = isRecord(wranglerSmokeReport)
  ? wranglerSmokeReport.config
  : null;
const wranglerSmokeArgv = wranglerSmokeConfig?.argv;
const wranglerSmokeWebServer = isRecord(wranglerSmokeConfig?.webServer)
  ? wranglerSmokeConfig.webServer
  : null;
const wranglerSmokeProject =
  Array.isArray(wranglerSmokeConfig?.projects) &&
    wranglerSmokeConfig.projects.length === 1 &&
    isRecord(wranglerSmokeConfig.projects[0])
    ? wranglerSmokeConfig.projects[0]
    : null;
const wranglerSmokeTitle =
  "Order 841 opens the study-first Screen 2 handoff and restores useful Screen 3 guidance";
if (
  !isRecord(wranglerSmokeConfig) ||
  !isRecord(wranglerSmokeConfig.metadata) ||
  wranglerSmokeConfig.metadata.shockauditExactHeadCommit !== head ||
  wranglerSmokeConfig.metadata.shockauditReleaseGate !== "wrangler-smoke" ||
  wranglerSmokeConfig.metadata.shockauditBrowserRuntime !==
    "playwright-owned-wrangler" ||
  !Array.isArray(wranglerSmokeArgv) ||
  wranglerSmokeArgv.length !== 7 ||
  !/^playwright(?:\.js|\.cmd)?$/iu.test(
    basename(wranglerSmokeArgv[1] ?? ""),
  ) ||
  wranglerSmokeArgv[2] !== "test" ||
  wranglerSmokeArgv[3] !==
    "tests/browser/six-screen-screen01-screen02.spec.ts" ||
  wranglerSmokeArgv[4] !== "--project=chromium" ||
  wranglerSmokeArgv[5] !== "--grep" ||
  wranglerSmokeArgv[6] !== wranglerSmokeTitle ||
  wranglerSmokeConfig.failOnFlakyTests !== true ||
  wranglerSmokeConfig.forbidOnly !== true ||
  wranglerSmokeConfig.fullyParallel !== false ||
  wranglerSmokeConfig.workers !== 1 ||
  wranglerSmokeConfig.maxFailures !== 0 ||
  wranglerSmokeConfig.shard !== null ||
  wranglerSmokeConfig.grepInvert !== null ||
  resolve(wranglerSmokeConfig.configFile ?? "") !== playwrightConfigPath ||
  !wranglerSmokeWebServer ||
  wranglerSmokeWebServer.command !==
    "npm run dev:browser -- --local --ip 127.0.0.1 --port 8791" ||
  wranglerSmokeWebServer.url !== "http://127.0.0.1:8791/health" ||
  wranglerSmokeWebServer.reuseExistingServer !== false ||
  wranglerSmokeWebServer.timeout !== 120_000 ||
  !wranglerSmokeProject ||
  wranglerSmokeProject.id !== inventory.projectName ||
  wranglerSmokeProject.name !== inventory.projectName ||
  resolve(wranglerSmokeProject.testDir ?? "") !== browserTestRoot ||
  resolve(wranglerSmokeConfig.rootDir ?? "") !== browserTestRoot ||
  !sameStringArray(wranglerSmokeProject.testMatch, inventory.testMatch) ||
  !sameStringArray(wranglerSmokeProject.testIgnore, inventory.testIgnore) ||
  wranglerSmokeProject.repeatEach !== 1 ||
  wranglerSmokeProject.retries !== 0 ||
  wranglerSmokeProject.timeout !== 90_000
) {
  throw new Error(
    "Wrangler smoke JSON evidence did not use the exact bounded real-workerd configuration.",
  );
}

const playwrightStats = playwrightReport?.stats;
for (const key of ["expected", "unexpected", "flaky", "skipped"]) {
  if (
    !Number.isInteger(playwrightStats?.[key]) ||
    playwrightStats[key] < 0
  ) {
    throw new Error(`Playwright JSON evidence has an invalid stats.${key}.`);
  }
}
if (
  !Array.isArray(playwrightReport?.errors) ||
  playwrightReport.errors.length > 0 ||
  playwrightStats.unexpected !== 0 ||
  playwrightStats.flaky !== 0
) {
  throw new Error(
    "Playwright JSON evidence contains top-level, unexpected, or flaky test failures.",
  );
}

function collectPlaywrightTests(suites, collected = []) {
  if (!Array.isArray(suites)) return;
  for (const suite of suites) {
    if (Array.isArray(suite?.specs)) {
      for (const spec of suite.specs) {
        if (Array.isArray(spec?.tests)) {
          for (const test of spec.tests) {
            collected.push({
              file: spec?.file,
              title: spec?.title,
              test,
            });
          }
        }
      }
    }
    collectPlaywrightTests(suite?.suites, collected);
  }
  return collected;
}
const playwrightTests = collectPlaywrightTests(playwrightReport?.suites) ?? [];
const chromiumTests = playwrightTests.filter(
  (entry) =>
    typeof entry.file === "string" &&
    typeof entry.title === "string" &&
    isRecord(entry.test) &&
    entry.test.projectName === inventory.projectName &&
    Array.isArray(entry.test.results),
);
if (
  playwrightTests.length === 0 ||
  chromiumTests.length !== playwrightTests.length
) {
  throw new Error(
    "Playwright JSON evidence must contain only well-formed Chromium tests.",
  );
}

const wranglerSmokeTests =
  collectPlaywrightTests(wranglerSmokeReport?.suites) ?? [];
const smokeStats = wranglerSmokeReport?.stats;
const smokeTest = wranglerSmokeTests[0];
if (
  !Array.isArray(wranglerSmokeReport?.errors) ||
  wranglerSmokeReport.errors.length !== 0 ||
  wranglerSmokeTests.length !== 1 ||
  smokeTest?.file !== "six-screen-screen01-screen02.spec.ts" ||
  smokeTest?.title !== wranglerSmokeTitle ||
  !isRecord(smokeTest?.test) ||
  smokeTest.test.projectName !== inventory.projectName ||
  smokeTest.test.expectedStatus !== "passed" ||
  smokeTest.test.status !== "expected" ||
  !Array.isArray(smokeTest.test.results) ||
  smokeTest.test.results.length !== 1 ||
  smokeTest.test.results[0]?.status !== "passed" ||
  smokeStats?.expected !== 1 ||
  smokeStats?.unexpected !== 0 ||
  smokeStats?.flaky !== 0 ||
  smokeStats?.skipped !== 0 ||
  !inventoryTests.some(
    (entry) =>
      entry.file === smokeTest.file &&
      entry.title === smokeTest.title &&
      entry.expectedStatus === "passed",
  )
) {
  throw new Error(
    "The exact-head real-Wrangler browser smoke must execute once and pass.",
  );
}
const serializedInventory = (entries) => entries.map((entry) =>
  `${entry.file}\u0000${entry.title}\u0000${entry.expectedStatus}`
).sort();
const actualBrowserInventory = serializedInventory(chromiumTests.map((entry) => ({
  file: entry.file,
  title: entry.title,
  expectedStatus: entry.test.expectedStatus,
})));
const expectedBrowserInventory = serializedInventory(inventoryTests);
if (
  JSON.stringify(actualBrowserInventory) !==
    JSON.stringify(expectedBrowserInventory)
) {
  throw new Error(
    "Playwright JSON evidence does not exactly match the checked-in browser test inventory.",
  );
}
const intentionallySkippedChromiumTests = chromiumTests.filter(
  (entry) =>
    entry.test.expectedStatus === "skipped" &&
    entry.test.status === "skipped",
);
const requiredChromiumTests = chromiumTests.filter(
  (entry) => entry.test.expectedStatus !== "skipped",
);
const passedChromiumTests = requiredChromiumTests.filter((entry) =>
  entry.test.expectedStatus === "passed" &&
  entry.test.status === "expected" &&
  entry.test.results.length > 0 &&
  entry.test.results.every((result) => result?.status === "passed")
);
if (
  requiredChromiumTests.length === 0 ||
  passedChromiumTests.length !== requiredChromiumTests.length ||
  intentionallySkippedChromiumTests.length + requiredChromiumTests.length !==
    chromiumTests.length ||
  playwrightStats.expected !== passedChromiumTests.length ||
  playwrightStats.skipped !== intentionallySkippedChromiumTests.length
) {
  throw new Error(
    "Every non-skipped Chromium test must execute and pass, and report totals must match the serialized suite.",
  );
}
function isPassedAxeEvidence(attachment) {
  if (
    typeof attachment?.name !== "string" ||
    !attachment.name.endsWith("-axe-wcag-a-aa.json") ||
    attachment.contentType !== "application/json" ||
    typeof attachment.body !== "string" ||
    attachment.body.length === 0
  ) {
    return false;
  }
  let axeEvidence;
  try {
    axeEvidence = JSON.parse(Buffer.from(attachment.body, "base64").toString("utf8"));
  } catch {
    return false;
  }
  return (
    axeEvidence?.simulatedEvidence === true &&
    axeEvidence?.signedInChatGptEvidence === false &&
    axeEvidence?.testEngine?.name === "axe-core" &&
    typeof axeEvidence?.testEngine?.version === "string" &&
    axeEvidence.testEngine.version.length > 0 &&
    Array.isArray(axeEvidence?.violations) &&
    Array.isArray(axeEvidence?.incomplete) &&
    !axeEvidence.violations.some((violation) =>
      violation?.impact === "serious" || violation?.impact === "critical"
    )
  );
}

const observedAxeKeys = [];
for (const entry of passedChromiumTests) {
  const identity = testIdentity(entry.file, entry.title);
  for (const result of entry.test.results) {
    for (const attachment of Array.isArray(result?.attachments)
      ? result.attachments
      : []) {
      if (!attachment?.name?.endsWith("-axe-wcag-a-aa.json")) continue;
      if (!isPassedAxeEvidence(attachment)) {
        throw new Error(
          `Axe attachment ${attachment.name} is missing valid, passing axe-core evidence.`,
        );
      }
      observedAxeKeys.push(`${identity}\u0000${attachment.name}`);
    }
  }
}
if (
  JSON.stringify([...observedAxeKeys].sort()) !==
    JSON.stringify([...inventoryAxeKeys].sort())
) {
  throw new Error(
    "Playwright JSON evidence does not contain the exact named Axe coverage required by the checked-in browser inventory.",
  );
}
const passedAxeAttachmentCount = observedAxeKeys.length;

const playwrightEvidence = {
  reportSha256:
    `sha256:${createHash("sha256").update(playwrightReportBytes).digest("hex")}`,
  inventorySchemaVersion: inventory.schemaVersion,
  inventorySha256:
    `sha256:${createHash("sha256").update(inventoryBytes).digest("hex")}`,
  expected: playwrightStats.expected,
  unexpected: playwrightStats.unexpected,
  flaky: playwrightStats.flaky,
  skipped: playwrightStats.skipped,
  discoveredChromiumTests: chromiumTests.length,
  executedChromiumTests: passedChromiumTests.length,
  passedChromiumTests: passedChromiumTests.length,
  passedAxeAttachmentCount,
  runtimeMode: "deterministic-node-worker-fixture",
  wranglerSmokeReportSha256:
    `sha256:${createHash("sha256").update(wranglerSmokeReportBytes).digest("hex")}`,
  wranglerSmokeTitle,
  wranglerSmokePassed: true,
};

const evidence = {
  schemaVersion: "shockaudit-release-gates-v1",
  packageVersion: packageMetadata.version,
  productReleaseLabel: `v${SHOCKAUDIT_RELEASE_LABEL}`,
  activeUiResourceUri: SHOCKAUDIT_UI_RESOURCE_URI,
  exactHeadCommit: head,
  ref: process.env.GITHUB_REF ?? null,
  runId: process.env.GITHUB_RUN_ID ?? null,
  runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
  completedAt: new Date().toISOString(),
  playwrightEvidence,
  passedGates: [
    "release-diff-check",
    "exact-source-tree",
    "runtime-audit",
    "full-audit",
    "unit",
    "build",
    "catalog-schema-budget",
    "generalization-benchmarks",
    "static-prohibited-paths",
    "release-support-syntax",
    "production-matrix-contract",
    "wrangler-browser-smoke",
    "browser",
    "accessibility",
    "production-dry-run",
  ],
};

await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(`Wrote exact-HEAD release evidence to ${destination}.`);
