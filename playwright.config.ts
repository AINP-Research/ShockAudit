import { defineConfig, devices } from "@playwright/test";

const browserBaseUrl =
  process.env.SHOCKAUDIT_BROWSER_BASE_URL ??
  "http://127.0.0.1:8791";
const managesLocalServer =
  process.env.SHOCKAUDIT_BROWSER_BASE_URL === undefined;
const chromiumExecutablePath =
  process.env.SHOCKAUDIT_CHROMIUM_EXECUTABLE_PATH;
const chromiumSingleProcess =
  process.env.SHOCKAUDIT_CHROMIUM_SINGLE_PROCESS === "1";
const chromiumDisableGraphics =
  process.env.SHOCKAUDIT_CHROMIUM_DISABLE_GRAPHICS === "1";
const playwrightReportPath = process.env.SHOCKAUDIT_PLAYWRIGHT_REPORT;
const expectedCommit = process.env.SHOCKAUDIT_EXPECTED_COMMIT?.trim() ?? null;
const browserRuntime =
  process.env.SHOCKAUDIT_BROWSER_NODE_FIXTURE === "1"
    ? "deterministic-node-worker-fixture"
    : managesLocalServer
      ? "playwright-owned-wrangler"
      : "external-browser-runtime";
const releaseGate =
  process.env.SHOCKAUDIT_BROWSER_GATE_KIND?.trim() ||
  (playwrightReportPath && expectedCommit
    ? "browser-accessibility-execution"
    : null);
const ciReporters = [
  ["line"] as const,
  ...(playwrightReportPath
    ? [["json", { outputFile: playwrightReportPath }] as const]
    : []),
];

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "**/*.spec.ts",
  failOnFlakyTests: Boolean(process.env.CI),
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  metadata: {
    shockauditExactHeadCommit: expectedCommit,
    shockauditReleaseGate: releaseGate,
    shockauditBrowserRuntime: browserRuntime,
  },
  reporter: process.env.CI ? ciReporters : "list",
  use: {
    baseURL: browserBaseUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(chromiumExecutablePath
          ? {
              launchOptions: {
                executablePath: chromiumExecutablePath,
                args: [
                  "--no-sandbox",
                  "--disable-setuid-sandbox",
                  "--disable-dev-shm-usage",
                  ...(chromiumDisableGraphics
                    ? ["--disable-gpu", "--disable-software-rasterizer"]
                    : []),
                  ...(chromiumSingleProcess
                    ? ["--no-zygote", "--single-process"]
                    : []),
                ],
              },
            }
          : {}),
      },
    },
  ],
  webServer: managesLocalServer
    ? {
        command:
          "npm run dev:browser -- --local --ip 127.0.0.1 --port 8791 --inspector-ip 127.0.0.1 --inspector-port 18791",
        url: `${browserBaseUrl}/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
});
