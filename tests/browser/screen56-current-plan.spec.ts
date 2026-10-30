import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { McpServer } from "@modelcontextprotocol/server";
import { expect, test } from "@playwright/test";
import type { Server } from "node:http";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import { openScreen3, openScreen6 } from
  "../../src/core/six-screen/workflow";
import { registerSixScreenWorkflowTools } from
  "../../src/worker/six-screen-tools";
import { SixScreenWorkflowRuntime } from
  "../../src/worker/six-screen-workflow-runtime";
import { InMemorySixScreenWorkflowStorage,
  SixScreenWorkflowStore } from
  "../../src/worker/six-screen-workflow-store";
import { installMcpAppHost, type JsonObject,
  type McpCallToolResult } from "./mcp-app-host";
import { startNodeFixtureServer } from "./node-fixture-server";
import { browserEventCardFixtureAccessToken as accessToken,
  browserEventCardFixtureAt as at,
  browserEventCardFixtureCreatedAt as createdAt,
  browserEventCardFixtureRunId as runId,
  createBrowserEventCardFixture } from
  "./six-screen-event-card-review-fixture";

const baseUrl = process.env.SHOCKAUDIT_BROWSER_BASE_URL ??
  "http://127.0.0.1:8791";
let fixtureServer: Server | null = null;

test.beforeAll(async () => {
  if (process.env.SHOCKAUDIT_BROWSER_NODE_FIXTURE === "1") {
    fixtureServer = await startNodeFixtureServer(baseUrl);
  }
});

test.afterAll(async () => {
  if (fixtureServer) await new Promise<void>((resolve, reject) =>
    fixtureServer!.close((error) => error ? reject(error) : resolve()));
});

test("Screen 6 renders the deterministic design map without model or source calls", async ({ page }, testInfo) => {
  const fixture = createBrowserEventCardFixture();
  const entered = openScreen3(fixture.state, {
    expectedRevision: fixture.state.revision,
    study: {
      population: "Public manufacturing firms",
      analysisUnit: "firm-year",
      geography: ["California", "United States"],
      industry: ["Manufacturing"],
      period: { start: "2010", end: "2022" },
      outcome: "Firm performance",
      outcomeMeasure: "Return on assets",
      intendedConstruct: "Customer protection",
      policySideConcept: null,
      initialExplanation: "Through customer trust.",
      proposedTreatment: "California firms",
      proposedComparison: "Other states' firms",
      resultsPreviouslyInspected: "not_disclosed",
    },
    proposedTiming: { mode: "year", year: 2020, milestoneReference: null },
    openedAt: at(25),
  });
  const opened = openScreen6(entered.state, {
    expectedRevision: entered.state.revision, openedAt: at(26),
  });
  const storage = new InMemorySixScreenWorkflowStorage();
  const store = new SixScreenWorkflowStore(storage);
  await store.create({ state: opened.state, accessToken,
    createInputFingerprint: fingerprintSixScreenValue("screen6-browser-plan"),
    createdAt, expiresAt: at(1_000) });
  let sourceCalls = 0;
  let modelCalls = 0;
  const modelFetch = async () => {
    modelCalls += 1;
    throw new Error("Screen 6 must not call the model.");
  };
  const runtime = new SixScreenWorkflowRuntime({
    store, signingKey: "screen6-browser-plan-signing-key-more-than-32-bytes",
    now: () => at(27),
    fetch: async () => { sourceCalls++; throw new Error("Unexpected source call"); },
    screen5OpenAIMode: "local-preview",
    screen5OpenAIApiKey: "controlled-browser-key-never-projected",
    screen5OpenAIFetch: modelFetch,
  });
  const server = new McpServer(
    { name: "screen6-plan-browser-fixture", version: "1.0.0" },
    { instructions: "Controlled Screen 6 view." },
  );
  registerSixScreenWorkflowTools(server, runtime);
  const client = new Client({ name: "screen6-plan-browser-client",
    version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const callTool = async (name: string, args: JsonObject) =>
      await client.callTool({ name, arguments: args }) as McpCallToolResult;
    const initialPrivate = (await runtime.status({
      runId,
      accessToken,
    })).privateSnapshot;
    await installMcpAppHost(page, {
      appUrl: `${baseUrl}/`, initialToolNotifications: [],
      installChatGptCompatibilityBridge: true,
      initialCompatibilityWidgetState: {
        modelContent: "Controlled Screen 6 current plan.",
        privateContent: { sixScreenWorkflow: initialPrivate },
      }, callTool,
    });
    const app = page.frameLocator("#shockaudit-frame");
    const plan = app.getByRole("region", {
      name: "Visual design dependency map",
      exact: true,
    });
    await expect(plan.getByRole("heading", { name: "YOUR DESIGN MAP" }))
      .toBeVisible();
    await expect(plan.getByRole("button", { name: "Export full JSON record" }))
      .toHaveCount(0);
    await expect(plan.getByRole("button", { name: "Generate study-specific challenge plan" }))
      .toHaveCount(0);
    await expect(plan.locator(".six-design-map-actions > button")).toHaveText([
      "Create PDF", "Create Word",
    ]);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: testInfo.outputPath("screen6-initial-1440.png") });
    await plan.getByText("Detailed design checks", { exact: true }).click();
    await expect(plan.getByRole("region", { name: "Ten uncertainty dimensions" })
      .locator(":scope > ol > li")).toHaveCount(10);
    await plan.getByText("Procedure, evidence and interpretation details").first().click();
    await expect(plan.getByText("What reassurance cannot establish").first())
      .toBeVisible();
    expect(sourceCalls).toBe(0);
    expect(modelCalls).toBe(0);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: testInfo.outputPath("screen6-initial-1280.png") });
    await page.setViewportSize({ width: 720, height: 900 });
    await expect(plan).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("screen6-initial-720.png") });
    const overflow = await app.locator("body").evaluate((body) =>
      body.scrollWidth > body.clientWidth + 1);
    expect(overflow).toBe(false);
  } finally {
    await client.close();
    await server.close();
  }
});
