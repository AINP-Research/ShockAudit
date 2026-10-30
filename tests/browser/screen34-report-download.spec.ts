import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { McpServer } from "@modelcontextprotocol/server";
import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { Server } from "node:http";
import { createBrowserEventCardFixture, browserEventCardFixtureRunId as runId,
  browserEventCardFixtureAccessToken as accessToken } from "./six-screen-event-card-review-fixture";
import { completeReportFixture } from "../fixtures/complete-report";
import { openScreen3, openScreen6 } from "../../src/core/six-screen/workflow";
import { fingerprintSixScreenValue } from "../../src/core/six-screen/canonical";
import { SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY } from "../../src/core/six-screen/metadata-keys";
import { SixScreenWorkflowRuntime } from "../../src/worker/six-screen-workflow-runtime";
import { SixScreenWorkflowStore, InMemorySixScreenWorkflowStorage } from "../../src/worker/six-screen-workflow-store";
import { SixScreenResearchTaskStore } from "../../src/worker/six-screen-research-task-store";
import { SixScreenEvidenceStore } from "../../src/worker/six-screen-evidence-store";
import { registerSixScreenWorkflowTools } from "../../src/worker/six-screen-tools";
import { installMcpAppHost, type JsonObject, type McpCallToolResult } from "./mcp-app-host";
import { startNodeFixtureServer } from "./node-fixture-server";

const origin = process.env.SHOCKAUDIT_BROWSER_BASE_URL ?? "http://127.0.0.1:8791";
const at = "2026-09-30T10:00:00.000Z";
let fixtureServer: Server | null = null;
test.beforeAll(async () => { fixtureServer = await startNodeFixtureServer(origin); });
test.afterAll(async () => { await new Promise<void>((resolve, reject) =>
  fixtureServer!.close((error) => error ? reject(error) : resolve())); });

async function fixture(screen: 3 | 6) {
  const { revision: _, ...study } = completeReportFixture().study;
  const original = createBrowserEventCardFixture().state;
  const state3 = openScreen3(original, { expectedRevision: original.revision,
    study, proposedTiming: { mode: "year", year: 2020, milestoneReference: null }, openedAt: at }).state;
  const reportState = completeReportFixture(10);
  const state = screen === 3 ? state3 : openScreen6(reportState, {
    expectedRevision: reportState.revision, openedAt: at }).state;
  const storage = new InMemorySixScreenWorkflowStorage(), store = new SixScreenWorkflowStore(storage);
  await store.create({ state, accessToken, createInputFingerprint: fingerprintSixScreenValue("browser-screen34-report"),
    createdAt: at, expiresAt: "2026-10-01T10:00:00.000Z" });
  let sourceCalls = 0;
  const runtime = new SixScreenWorkflowRuntime({ store,
    taskStore: new SixScreenResearchTaskStore(storage), evidenceStore: new SixScreenEvidenceStore(storage),
    signingKey: "browser-screen34-report-signing-key-more-than-thirty-two-bytes", now: () => at,
    fetch: async () => { sourceCalls++; return new Response(JSON.stringify({ count: 0, results: [], data: [], DisasterDeclarationsSummaries: [] }),
      { headers: { "content-type": "application/json" } }); },
  });
  const server = new McpServer({ name: "screen34-report-browser", version: "1.0.0" });
  registerSixScreenWorkflowTools(server, runtime);
  const client = new Client({ name: "screen34-report-browser", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport); await client.connect(clientTransport);
  const initialPrivate = (await runtime.status({ runId, accessToken })).privateSnapshot;
  return { initialPrivate, sourceCalls: () => sourceCalls,
    callTool: async (name: string, args: JsonObject) => await client.callTool({ name, arguments: args }) as McpCallToolResult,
    close: async () => { await client.close(); await server.close(); } };
}

for (const loseFirstResponse of [false, true]) test(`first Screen 3→4 entry recovers without a warning (lost response ${loseFirstResponse})`, async ({ page }) => {
  const api = await fixture(3);
  let openCalls = 0, lastResponse: McpCallToolResult | null = null;
  try {
    await installMcpAppHost(page, { appUrl: `${origin}/`, initialToolNotifications: [],
      installChatGptCompatibilityBridge: true,
      initialCompatibilityWidgetState: { privateContent: { sixScreenWorkflow: api.initialPrivate } },
      callTool: async (name, args) => {
        const result = await api.callTool(name, args);
        if (name === "mutate_six_screen_workflow_v1" && (args.mutation as JsonObject).action === "open_screen_4") {
          openCalls++; lastResponse = structuredClone(result);
          if (loseFirstResponse && openCalls === 1) {
            const metadata = result._meta as JsonObject;
            return { ...result, _meta: { ...metadata, [SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY]: {
              ...metadata[SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY] as JsonObject,
              encodedPublicProjectionPayload: "damaged first display payload",
            } } };
          }
        }
        return result;
      },
    });
    const app = page.frameLocator("#shockaudit-frame");
    await app.getByRole("button", { name: "Use this comparison for review", exact: true }).first().click();
    await expect(app.getByText(/Researcher decision saved: selected/)).toBeVisible();
    await app.getByRole("button", { name: "Continue to other-event review", exact: true }).click();
    await expect(app.getByText(/Screen 4 is open from the saved comparison/)).toBeVisible();
    expect(openCalls).toBe(1);
    expect(api.sourceCalls()).toBeGreaterThan(0);
    const duplicate = structuredClone(lastResponse!);
    const metadata = duplicate._meta as JsonObject;
    (metadata[SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY] as JsonObject).encodedPublicProjectionPayload = "damaged late duplicate";
    await page.evaluate(async (result) => {
      await (window as unknown as { __shockAuditNotifyToolResult: (value: unknown) => Promise<void> }).__shockAuditNotifyToolResult({
        label: "late-screen4-display-duplicate", arguments: {}, result,
      });
    }, duplicate);
    await app.locator("body").evaluate(() => new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(app.locator(".six-alert--error")).toHaveCount(0);
    expect(openCalls).toBe(1);
  } finally { await api.close(); }
});

test("exports real PDF and Word reports through the sandbox host and keeps the controls in the requested order", async ({ page }, testInfo) => {
  const api = await fixture(6);
  try {
    await installMcpAppHost(page, { appUrl: `${origin}/`, initialToolNotifications: [],
      installChatGptCompatibilityBridge: true,
      hostCapabilities: { serverTools: {}, downloadFile: {}, logging: {} },
      initialCompatibilityWidgetState: { privateContent: { sixScreenWorkflow: api.initialPrivate } }, callTool: api.callTool });
    const app = page.frameLocator("#shockaudit-frame");
    const map = app.getByRole("region", { name: "Visual design dependency map", exact: true });
    await expect(map).toBeVisible();
    await expect(map.locator(".six-design-map-actions > button")).toHaveText([
      "Create PDF", "Create Word",
    ]);
    const pdfDownloadPromise = page.waitForEvent("download");
    await map.getByRole("button", { name: "Create PDF", exact: true }).click();
    const pdfDownload = await pdfDownloadPromise;
    expect(pdfDownload.suggestedFilename()).toMatch(/^ShockAudit-Complete-Report-.*\.pdf$/u);
    await pdfDownload.saveAs(testInfo.outputPath("complete-report.pdf"));
    const bytes = await readFile(testInfo.outputPath("complete-report.pdf"));
    expect(bytes.subarray(0, 8).toString()).toBe("%PDF-1.7");
    expect(bytes.length).toBeGreaterThan(100_000);
    await expect(map.getByRole("status")).toHaveText("Report download requested.");

    const wordDownloadPromise = page.waitForEvent("download");
    await map.getByRole("button", { name: "Create Word", exact: true }).click();
    const wordDownload = await wordDownloadPromise;
    expect(wordDownload.suggestedFilename()).toMatch(/^ShockAudit-Complete-Report-.*\.docx$/u);
    await wordDownload.saveAs(testInfo.outputPath("complete-report.docx"));
    const wordBytes = await readFile(testInfo.outputPath("complete-report.docx"));
    expect(wordBytes.subarray(0, 4).toString("hex")).toBe("504b0304");
    expect(wordBytes.length).toBeGreaterThan(100_000);
    await expect(map.getByRole("status")).toHaveText("Report download requested.");
    expect(api.sourceCalls()).toBe(0);
    await page.screenshot({ path: testInfo.outputPath("screen6-export.png") });
  } finally { await api.close(); }
});

test("shows a clear message when the host declines the report download", async ({ page }) => {
  const api = await fixture(6);
  try {
    await installMcpAppHost(page, { appUrl: `${origin}/`, initialToolNotifications: [],
      installChatGptCompatibilityBridge: true,
      hostCapabilities: { serverTools: {}, downloadFile: {}, logging: {} }, downloadFileResult: { isError: true },
      initialCompatibilityWidgetState: { privateContent: { sixScreenWorkflow: api.initialPrivate } }, callTool: api.callTool });
    const map = page.frameLocator("#shockaudit-frame").getByRole("region", { name: "Visual design dependency map", exact: true });
    await map.getByRole("button", { name: "Create PDF", exact: true }).click();
    await expect(map.getByRole("alert")).toHaveText("The report download was cancelled or declined.");
    await expect(map.getByRole("button", { name: "Create PDF", exact: true })).toBeEnabled();
    expect(api.sourceCalls()).toBe(0);
  } finally { await api.close(); }
});
