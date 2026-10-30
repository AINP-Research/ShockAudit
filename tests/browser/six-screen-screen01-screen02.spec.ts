import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import type { Server } from "node:http";
import { resolve } from "node:path";
import {
  expect,
  test,
  type Page,
  type TestInfo,
} from "@playwright/test";

import { SIX_SCREEN_RECOVERY_SNAPSHOT_TOOL } from
  "../../src/core/six-screen/recovery-snapshot";

import {
  callMcpTool,
  installMcpAppHost,
  type HostModelRequest,
  type HostModelToolCall,
  type JsonObject,
  type McpCallToolResult,
} from "./mcp-app-host";
import { startNodeFixtureServer } from "./node-fixture-server";

const baseUrl = process.env.SHOCKAUDIT_BROWSER_BASE_URL ??
  "http://127.0.0.1:8791";
const order841Source =
  "https://www.federalregister.gov/documents/2018/03/06/2018-03708/electric-storage-participation-in-markets-operated-by-regional-transmission-organizations-and";
const order841Title =
  "Electric Storage Participation in Markets Operated by Regional Transmission Organizations and Independent System Operators";
const officialTransportProbePath =
  "/__browser-fixture/official-transport-probe";
const officialTransportProbeUpstream =
  "https://www.legislation.gov.uk/all/2023/data.feed?title=Procurement%20Act%202023";

let nodeFixtureServer: Server | null = null;

const simulatedFullHostTaskTypes = [
  "screen02-search-review",
  "screen03-evidence-mapping",
  "screen03-overview-improvement",
  "six-screen-policy-fact-proof",
  "six-screen-mechanism-proof",
  "screen04-study-event-assessment",
] as const;

function withSimulatedHostMode(
  result: McpCallToolResult,
  mode: "disabled" | "full",
): McpCallToolResult {
  const metadata = result._meta && typeof result._meta === "object" &&
      !Array.isArray(result._meta)
    ? result._meta as JsonObject
    : {};
  const retainedMetadata = Object.fromEntries(
    Object.entries(metadata).filter(([key]) =>
      key !== "shockaudit/hostReasoningMode" &&
      key !== "shockaudit/hostReasoning"
    ),
  );
  return {
    ...result,
    _meta: {
      ...retainedMetadata,
      "shockaudit/hostReasoning": mode === "full"
        ? {
            mode: "full",
            enabled: true,
            genuineTraceCount: 0,
            availableTaskTypes: [...simulatedFullHostTaskTypes],
          }
        : {
            mode: "experimental-off",
            enabled: false,
            genuineTraceCount: 0,
            availableTaskTypes: [],
          },
    },
  };
}

test.beforeAll(async () => {
  if (process.env.SHOCKAUDIT_BROWSER_NODE_FIXTURE === "1") {
    nodeFixtureServer = await startNodeFixtureServer(baseUrl, {
      hostReasoningMode: "full",
    });
  }
});

test.afterAll(async () => {
  if (!nodeFixtureServer) return;
  await new Promise<void>((resolveClose, rejectClose) =>
    nodeFixtureServer!.close((error) =>
      error ? rejectClose(error) : resolveClose(),
    ),
  );
});

type BrowserIssues = {
  consoleErrors: string[];
  pageErrors: string[];
};

function captureBrowserIssues(page: Page): BrowserIssues {
  const issues = { consoleErrors: [], pageErrors: [] } as BrowserIssues;
  page.on("console", (entry) => {
    if (entry.type() === "error") issues.consoleErrors.push(entry.text());
  });
  page.on("pageerror", (error) => issues.pageErrors.push(error.message));
  return issues;
}

async function installFreshHost(
  page: Page,
  options: {
    hostCapabilities?: JsonObject;
    hostContext?: JsonObject;
    toolResponseDelayMsByName?: Record<string, number>;
    hostModelResponder?: (
      request: HostModelRequest,
    ) => Promise<HostModelToolCall[]> | HostModelToolCall[];
    callTool?: (
      name: string,
      args: JsonObject,
    ) => Promise<McpCallToolResult>;
  } = {},
) {
  await installMcpAppHost(page, {
    appUrl: `${baseUrl}/`,
    initialToolNotifications: [],
    ...(options.hostCapabilities
      ? { hostCapabilities: options.hostCapabilities }
      : {}),
    ...(options.hostContext ? { hostContext: options.hostContext } : {}),
    ...(options.toolResponseDelayMsByName
      ? { toolResponseDelayMsByName: options.toolResponseDelayMsByName }
      : {}),
    ...(options.hostModelResponder
      ? { hostModelResponder: options.hostModelResponder }
      : {}),
    installChatGptCompatibilityBridge: true,
    initialCompatibilityWidgetState: {
      modelContent: "ShockAudit private six-screen browser fixture.",
      privateContent: {},
    },
    callTool: options.callTool ??
      (async (name, args) => withSimulatedHostMode(
        await callMcpTool(baseUrl, name, args),
        "disabled",
      )),
  });
  await expect(page.getByTestId("simulated-browser-evidence")).toContainText(
    "not signed-in ChatGPT evidence",
  );
  return page.frameLocator("#shockaudit-frame");
}

function fixtureRecord(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} is not an object.`);
  }
  return value as JsonObject;
}

function screen5PlanningSubmission(modelContext: JsonObject): JsonObject {
  const task = fixtureRecord(modelContext.task, "Screen 5 planning task");
  const submission = fixtureRecord(
    modelContext.submission,
    "Screen 5 planning submission",
  );
  const facts = fixtureRecord(
    modelContext.boundedFacts,
    "Screen 5 planning facts",
  );
  const problem = fixtureRecord(
    facts.theoreticalProblem,
    "Screen 5 theoretical problem",
  );
  const change = fixtureRecord(
    problem.theoreticalChange,
    "Screen 5 theoretical change",
  );
  const outcome = fixtureRecord(problem.outcome, "Screen 5 outcome");
  const theoreticalChange = String(
    change.originalText ?? "customer protection",
  );
  const outcomeConcept = String(outcome.concept ?? "firm performance");
  const outcomeEndpoint = typeof outcome.measure === "string"
    ? `${outcomeConcept} measured by ${outcome.measure}`
    : outcomeConcept;
  const sourceFieldRefs = Array.isArray(change.fieldRefs)
    ? change.fieldRefs.filter((value): value is string =>
      typeof value === "string"
    )
    : ["study.intendedConstruct", "study.outcome"];
  return {
    schemaVersion: submission.schemaVersion,
    taskId: task.taskId,
    capability: submission.capability,
    conceptualQuestion:
      `How could ${theoreticalChange} affect ${outcomeConcept} through organizational processes?`,
    relationshipInterpretation: {
      theoreticalChange,
      direction: change.direction,
      outcomeEndpoint,
      policyToConstructQualification: String(
        change.fitExplanation ??
          "The policy-to-construct relationship remains proposed.",
      ),
      sourceFieldRefs,
    },
    candidates: [{
      id: "candidate-compliance-effort",
      conceptLabel: "Compliance effort",
      actor: "Managers and compliance staff",
      processNodes: [
        "Customer-protection obligations change",
        "Managers allocate systems and staff effort",
        "Operating costs and capabilities may change",
        `${outcomeConcept} may change under those conditions`,
      ],
      contextualConditions: [
        "Sampled firms must bear material implementation effort.",
        "Resource changes must reach the saved outcome unit.",
      ],
      distinctionFromFocal:
        "This pathway could operate even if customer confidence does not change.",
      perspective: "Organizational adaptation",
      perspectiveOrigin: "analyst_suggested",
      relationToFocal: "competing_same_pattern",
      hypothesisStatus: "provisional",
    }],
    supplementaryAccounts: [{
      id: "account-data-intensity",
      category: "boundary_condition",
      label: "Data intensity",
      explanation:
        "Data intensity may condition implementation effort without being an intervening process.",
    }],
    evidenceNeeds: [{
      id: "need-compliance-effort",
      candidateId: "candidate-compliance-effort",
      propositionToInvestigate:
        "Customer-protection obligations may change organizational implementation effort.",
      purpose: "support",
      priority: "high",
    }],
    queryIntents: [{
      id: "intent-direct-x-y",
      intent: "direct_x_y_open_ended",
      conceptGroups: [[theoreticalChange], [outcomeConcept]],
      scopeTerms: ["firms"],
      evidenceNeedIds: [],
    }, {
      id: "intent-compliance-effort",
      intent: "alternative_pathway",
      conceptGroups: [[theoreticalChange], ["compliance effort"]],
      scopeTerms: ["organizations"],
      evidenceNeedIds: ["need-compliance-effort"],
    }, {
      id: "intent-contrary-boundary",
      intent: "contrary_or_boundary",
      conceptGroups: [[theoreticalChange], ["boundary condition"]],
      scopeTerms: ["firms"],
      evidenceNeedIds: ["need-compliance-effort"],
    }],
    limitations: [
      "No scholarly source was retrieved or inspected during Stage A.",
    ],
    hostModel: "host_model_not_exposed",
  };
}

function screen5ComparisonSubmission(modelContext: JsonObject): JsonObject {
  const task = fixtureRecord(modelContext.task, "Screen 5 comparison task");
  const submission = fixtureRecord(
    modelContext.submission,
    "Screen 5 comparison submission",
  );
  const facts = fixtureRecord(
    modelContext.boundedFacts,
    "Screen 5 comparison facts",
  );
  const researcherInput = fixtureRecord(
    facts.researcherInput,
    "Screen 5 researcher input",
  );
  const focalProcess = String(
    researcherInput.proposedMechanism ?? "Customer confidence may change",
  );
  return {
    schemaVersion: submission.schemaVersion,
    taskId: task.taskId,
    capability: submission.capability,
    focal: {
      id: "mechanism-customer-confidence",
      conceptLabel: "Customer confidence pathway",
      perspective: null,
      perspectiveOrigin: "not_assigned",
      processChain: [
        focalProcess,
        "Customer confidence may change",
        "Retention and firm performance may change",
      ],
      connectedArgument:
        "The saved focal process could reach firm performance if customer responses aggregate to sampled firms.",
      fitToStudy:
        "The pathway requires customer responses to reach the saved firm-year outcome.",
      evidenceStatus: "analytical_hypothesis",
      propositions: [],
      materialTransferLimit:
        "The inspected packet does not establish this pathway as a CCPA effect in the proposed sample.",
      relationToFocal: "focal",
    },
    alternatives: [{
      id: "mechanism-compliance-cost",
      conceptLabel: "Compliance-cost pathway",
      perspective: "Organizational adaptation",
      perspectiveOrigin: "analyst_suggested",
      processChain: [
        "New duties require systems and staff effort",
        "Operating costs may change",
        "Firm performance may change",
      ],
      connectedArgument:
        "Implementation effort could place pressure on firm performance even if customer confidence does not change.",
      fitToStudy:
        "A dated firm-year cost response could reach the same saved outcome.",
      evidenceStatus: "analytical_hypothesis",
      propositions: [],
      materialTransferLimit:
        "No sample-specific cost measure or causal estimate was inspected.",
      relationToFocal: "competing_same_pattern",
    }],
    predictionMatrix: [{
      id: "prediction-customer-confidence",
      observationConcept: "Customer confidence and retention",
      candidateMeasure:
        "A dated, validated customer-confidence or retention measure",
      dataSource: null,
      timing: "After credible privacy-control changes",
      level: "Customer linked to firm",
      aggregationRequirement:
        "Customer responses must be linked and aggregated to the firm-year unit.",
      conditions: "A defensible aggregation link is required.",
      feasibility: "unknown",
      distinction: "distinguishing",
      propositionWorkIds: [],
      patterns: [{
        mechanismId: "mechanism-customer-confidence",
        expectedPattern:
          "Confidence could change before firm performance if the focal pathway operates.",
      }, {
        mechanismId: "mechanism-compliance-cost",
        expectedPattern:
          "No unique customer-confidence prediction is established.",
      }],
    }],
    overallQualification:
      "The total-effect design alone would not identify either mechanism.",
    evidenceLimitations: [
      "The comparison remains conditional and feasibility is unresolved.",
    ],
    causalStatus: "conditional_comparison_not_mediation_estimate",
    hostModel: "host_model_not_exposed",
  };
}

function simulatedLateScreen5HostResponder(
  delayedSubmissions: Promise<void>[],
): (request: HostModelRequest) => Promise<HostModelToolCall[]> {
  return async (request) => {
    const contextValue = request.latestModelContext?.structuredContent;
    if (!contextValue || typeof contextValue !== "object" ||
        Array.isArray(contextValue)) return [];
    const context = contextValue as JsonObject;
    const task = fixtureRecord(context.task, "bounded host task");
    const submission = fixtureRecord(
      context.submission,
      "bounded host submission",
    );
    if (task.taskType === "screen05-theoretical-planning") {
      const args = screen5PlanningSubmission(context);
      const delayed = new Promise<void>((resolveDelay) =>
        setTimeout(resolveDelay, 6_000)
      ).then(async () => {
        const result = await callMcpTool(
          baseUrl,
          String(submission.tool),
          args,
        );
        if (result.isError) {
          throw new Error("The delayed Stage A fixture was rejected.");
        }
      });
      delayedSubmissions.push(delayed);
      return [];
    }
    if (task.taskType === "screen05-study-mechanism-comparison") {
      return [{
        label: `simulated-screen5-stage-b-${String(task.taskId)}`,
        name: String(submission.tool),
        arguments: screen5ComparisonSubmission(context),
      }];
    }
    return [];
  };
}

async function expectCcpaMatch(app: ReturnType<Page["frameLocator"]>) {
  await expect(app.getByRole("heading", {
    name: "Closest source-supported matches",
  })).toBeVisible();
  const ccpaCard = app.locator(".six-candidate-card").filter({
    has: app.getByRole("heading", {
      name: "California Consumer Privacy Act",
      exact: true,
    }),
  });
  await expect(ccpaCard).toHaveCount(1);
  await expect(ccpaCard.locator("p", {
    hasText: /Also known as:.*\bCCPA\b/iu,
  })).toBeVisible();
  await expect(ccpaCard.getByText("Available for policy review", { exact: true }))
    .toBeVisible();
  await expect(ccpaCard.getByRole("radio", {
    name: /Select California Consumer Privacy Act/iu,
  })).toBeChecked();
}

async function expectNoSeriousOrCriticalWcagViolations(
  page: Page,
  testInfo: TestInfo,
  label: string,
) {
  const results = await new AxeBuilder({ page })
    .include(["#shockaudit-frame", "main"])
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const severe = results.violations.filter(({ impact }) =>
    impact === "serious" || impact === "critical"
  );
  await testInfo.attach(`${label}-axe-wcag-a-aa.json`, {
    body: JSON.stringify({
      simulatedEvidence: true,
      signedInChatGptEvidence: false,
      url: results.url,
      testEngine: results.testEngine,
      testEnvironment: results.testEnvironment,
      violations: results.violations,
      incomplete: results.incomplete,
    }, null, 2),
    contentType: "application/json",
  });
  expect(severe).toEqual([]);
}

async function saveSimulatedScreenshot(page: Page, name: string) {
  const screenshotDirectory = resolve("artifacts/release-gates/screenshots");
  await mkdir(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: resolve(screenshotDirectory, `${name}.png`),
    fullPage: true,
    animations: "disabled",
  });
}

async function expectStandardPolicyResearchComplete(
  page: Page,
  app: ReturnType<Page["frameLocator"]>,
) {
  const progress = app.locator(".six-policy-progress");
  try {
    await expect(progress).toContainText("Done! Please see below.", {
      timeout: 30_000,
    });
  } catch (caught) {
    const hostErrors = await page.evaluate(() =>
      (
        window as unknown as {
          __shockAuditHostState?: { errors?: string[] };
        }
      ).__shockAuditHostState?.errors ?? []
    );
    const detail = caught instanceof Error ? caught.message : String(caught);
    throw new Error(
      `${detail}\nSimulated host errors:\n${JSON.stringify(hostErrors, null, 2)}`,
    );
  }
  await expect(app.getByRole("button", {
    name: "Build source-supported policy briefing",
  })).toHaveCount(0);
  await expect(app.getByRole("button", {
    name: "Research unresolved questions more deeply",
  })).toHaveCount(0);
}

async function verifyWranglerTransportProbe(page: Page, testInfo: TestInfo) {
  if (process.env.SHOCKAUDIT_BROWSER_GATE_KIND !== "wrangler-smoke") return;
  const response = await page.request.get(officialTransportProbePath);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/json");
  const probe = await response.json() as JsonObject;
  expect(Object.keys(probe).sort()).toEqual([
    "byteCount",
    "contentType",
    "sha256",
    "status",
    "upstreamUrl",
  ]);
  expect(probe).toMatchObject({
    upstreamUrl: officialTransportProbeUpstream,
    status: 200,
    contentType: expect.stringMatching(
      /^(?:application\/atom\+xml|application\/xml|text\/xml)(?:\s*;|$)/iu,
    ),
    byteCount: expect.any(Number),
    sha256: expect.stringMatching(/^[0-9a-f]{64}$/u),
  });
  expect(probe.byteCount).toEqual(expect.any(Number));
  expect(probe.byteCount as number).toBeGreaterThan(0);
  await testInfo.attach("official-transport-probe.json", {
    body: JSON.stringify(probe, null, 2),
    contentType: "application/json",
  });
}

test.describe("Six-screen replacement browser acceptance — not signed-in evidence", () => {
  test.beforeEach(({}, testInfo) => {
    testInfo.annotations.push({
      type: "evidence-boundary",
      description:
        "Local deterministic MCP Apps simulation only; this is not a signed-in ChatGPT acceptance session.",
    });
  });

  test(
    "uses a compact inline launcher and opens the fullscreen workspace without an inline-return control",
    async ({ page }, testInfo) => {
      const issues = captureBrowserIssues(page);
      const app = await installFreshHost(page, {
        hostContext: {
          displayMode: "inline",
          availableDisplayModes: ["inline", "fullscreen"],
          containerDimensions: { maxHeight: 360, maxWidth: 720 },
        },
      });
      await expect(app.getByRole("heading", { name: "Open ShockAudit" }))
        .toBeVisible();
      await expect(app.locator(".six-steps")).toHaveCount(0);
      await expectNoSeriousOrCriticalWcagViolations(
        page,
        testInfo,
        "simulated-six-screen-inline-launcher",
      );
      await app.getByRole("button", { name: "Open full workspace" }).click();
      await expect(app.getByRole("heading", {
        name: "1. Your study and policy",
      })).toBeVisible();
      await expect(app.getByRole("button", { name: "Return to inline view" }))
        .toHaveCount(0);
      await expect.poll(() => page.evaluate(() =>
        (
          window as unknown as {
            __shockAuditHostState: { events: Array<{ method?: string }> };
          }
        ).__shockAuditHostState.events.filter(({ method }) =>
          method === "ui/request-display-mode"
        ).length
      )).toBe(1);
      expect(issues).toEqual({ consoleErrors: [], pageErrors: [] });
    },
  );

  test(
    "uses the actual embedded width for the sidebar, compact rail, and phone selector",
    async ({ page }) => {
      const issues = captureBrowserIssues(page);
      await page.setViewportSize({ width: 1400, height: 1000 });
      const app = await installFreshHost(page);
      const widths = [360, 480, 599, 640, 720, 768, 820, 900, 960, 1200];
      for (const width of widths) {
        await page.locator("#shockaudit-frame").evaluate((frame, value) => {
          (frame as HTMLIFrameElement).style.width = `${value}px`;
        }, width);
        await expect(app.getByRole("heading", {
          name: "1. Your study and policy",
        })).toBeVisible();
        if (width >= 640) {
          await expect(app.locator(".six-steps")).toBeVisible();
          await expect(app.locator(".six-step-selector")).toBeHidden();
          await expect(app.locator(".six-steps strong")).toHaveCount(6);
        } else {
          await expect(app.locator(".six-steps")).toBeHidden();
          await expect(app.locator(".six-step-selector")).toBeVisible();
        }
        expect(await app.locator("html").evaluate((root) =>
          root.scrollWidth <= root.clientWidth + 1
        ), `horizontal overflow at ${width}px`).toBe(true);
      }
      await page.locator("#shockaudit-frame").evaluate((frame) => {
        (frame as HTMLIFrameElement).style.width = "720px";
      });
      await saveSimulatedScreenshot(
        page,
        "simulated-six-screen-sidebar-720-inner-frame",
      );
      expect(issues).toEqual({ consoleErrors: [], pageErrors: [] });
    },
  );

  const minimalCcpaInputs = [
    {
      label: "leading whitespace with supplied official source over the compatibility bridge",
      name: " California Consumer Privacy Act",
      officialSource: "https://oag.ca.gov/privacy/ccpa",
      compatibilityBridge: true,
      completeJourney: true,
    },
    {
      label: "ordinary name-only input",
      name: "California Consumer Privacy Act",
      officialSource: "",
      compatibilityBridge: false,
      completeJourney: false,
    },
    {
      label: "trailing whitespace name-only input",
      name: "California Consumer Privacy Act   ",
      officialSource: "",
      compatibilityBridge: false,
      completeJourney: false,
    },
    {
      label: "name-only alias",
      name: "CCPA",
      officialSource: "",
      compatibilityBridge: false,
      completeJourney: false,
    },
  ] as const;

  for (const scenario of minimalCcpaInputs) {
    test(
      `minimal CCPA regression accepts ${scenario.label} without optional fields`,
      async ({ page }, testInfo) => {
        const issues = captureBrowserIssues(page);
        await page.setViewportSize({ width: 1400, height: 1000 });
        const app = await installFreshHost(page, scenario.compatibilityBridge
          ? {
              hostCapabilities: {
                logging: {},
                message: { text: {} },
                updateModelContext: { text: {}, structuredContent: {} },
              },
            }
          : {});
        const policyInput = app.getByLabel(/Policy or shock name/iu);
        await policyInput.fill(scenario.name);
        if (scenario.officialSource) {
          await app.getByRole("button", {
            name: /Cannot find the right policy/iu,
          }).click();
          await app.getByLabel("Webpage URL").fill(scenario.officialSource);
        }
        if (scenario.completeJourney) {
          await saveSimulatedScreenshot(
            page,
            "simulated-six-screen-screen01-ccpa-minimal-entry",
          );
        }

        await app.getByRole("button", { name: "Find my policy" }).click();
        await expectCcpaMatch(app);
        await expect(policyInput).toHaveValue(scenario.name);
        await expect(app.locator(".six-alert--error")).toHaveCount(0);
        await expect(app.getByRole("main")).not.toContainText(
          /Six-screen mutation must advance|RuntimeException|TextContent/iu,
        );

        if (!scenario.completeJourney) {
          expect(issues).toEqual({ consoleErrors: [], pageErrors: [] });
          return;
        }

        const callsBeforeRepeatedSelection = await page.evaluate(() =>
          (
            window as unknown as {
              __shockAuditHostState: {
                toolCalls: Array<{
                  name: string;
                  arguments: { mutation?: { action?: string } };
                }>;
              };
            }
          ).__shockAuditHostState.toolCalls.filter(({ name, arguments: args }) =>
            name === "mutate_six_screen_workflow_v1" &&
            args.mutation?.action === "display_identity"
          ).length
        );
        await app.getByRole("radio", {
          name: /Select California Consumer Privacy Act/iu,
        }).click();
        const callsAfterRepeatedSelection = await page.evaluate(() =>
          (
            window as unknown as {
              __shockAuditHostState: {
                toolCalls: Array<{
                  name: string;
                  arguments: { mutation?: { action?: string } };
                }>;
              };
            }
          ).__shockAuditHostState.toolCalls.filter(({ name, arguments: args }) =>
            name === "mutate_six_screen_workflow_v1" &&
            args.mutation?.action === "display_identity"
          ).length
        );
        expect(callsAfterRepeatedSelection).toBe(callsBeforeRepeatedSelection);

        await page.locator("#shockaudit-frame").evaluate((frame) => {
          (frame as HTMLIFrameElement).style.width = "720px";
        });
        await expect(app.locator(".six-steps")).toBeVisible();
        await saveSimulatedScreenshot(
          page,
          "simulated-six-screen-screen01-ccpa-minimal-match-sidebar",
        );
        await expectNoSeriousOrCriticalWcagViolations(
          page,
          testInfo,
          "simulated-six-screen-screen01-ccpa-minimal-match",
        );

        await app.getByRole("button", {
          name: "Confirm this policy and continue",
        }).click();
        await expect(app.getByRole("heading", {
          name: "2. Understand the policy",
        })).toBeVisible();
        await expectStandardPolicyResearchComplete(page, app);
        await expect(app.locator(
          ".six-screen2-heading .six-review-status",
        )).toHaveText(
          "partial",
        );
        await saveSimulatedScreenshot(
          page,
          "simulated-six-screen-screen02-ccpa-minimal-confirmed",
        );

        await page.locator("#shockaudit-frame").evaluate((frame) => {
          (frame as HTMLIFrameElement).style.width = "480px";
        });
        await expect(app.locator(".six-step-selector")).toBeVisible();
        await expect(app.locator(".six-steps")).toBeHidden();
        await saveSimulatedScreenshot(
          page,
          "simulated-six-screen-screen02-ccpa-minimal-narrow-navigation",
        );

        const handoff = app.getByLabel("Your study for the next step");
        await handoff.getByLabel("Sample *", {
          exact: true,
        }).fill("US public firms");
        await handoff.getByLabel("Unit of analysis *", { exact: true })
          .fill("firm-year");
        await handoff.getByRole("textbox", { name: /^Geography/u })
          .fill("United States");
        await handoff.getByLabel("Outcome *", { exact: true })
          .fill("Firm performance");
        await handoff.getByLabel("Study period start *", { exact: true })
          .fill("2010");
        await handoff.getByLabel("Study period end *", { exact: true })
          .fill("2022");
        await handoff.getByRole("button", {
          name: "Continue to comparison guidance",
        }).click();
        const explanationInput = handoff.getByRole("textbox", {
          name: /^How the shock affects the outcome/u,
        });
        await expect(explanationInput).toBeFocused();
        const validationSummary = handoff.locator(
          ".six-field-error[aria-live='polite']",
        );
        await expect(validationSummary).toContainText(
          "State the intended policy-effect question or explanation.",
        );
        await expect(validationSummary).toContainText(
          "Enter a proposed treatment year or choose timing that varies by group.",
        );
        await expect(validationSummary).not.toContainText(
          /Specify the (?:organizational population|unit of analysis|study geography|outcome|study-period boundaries)/u,
        );
        await expect(handoff.getByLabel("Sample *", {
          exact: true,
        })).toHaveAttribute("aria-invalid", "false");
        await explanationInput.fill(
          "How did the CCPA affect firm performance?",
        );
        await handoff.getByLabel(
          "Staggered timing — treatment starts in different years",
        ).check();
        await handoff.getByRole("button", {
          name: "Continue to comparison guidance",
        }).click();
        await expect(app.getByRole("heading", {
          name: "3. Suggested Approach",
        })).toBeVisible();

        const compatibilityCalls = await page.evaluate(() =>
          (
            window as unknown as {
              __shockAuditHostState: {
                events: Array<{ method?: string }>;
              };
            }
          ).__shockAuditHostState.events.filter(({ method }) =>
            method === "compatibility/call-tool"
          ).length
        );
        expect(compatibilityCalls).toBeGreaterThan(0);
        expect(issues).toEqual({ consoleErrors: [], pageErrors: [] });
      },
    );
  }

  test(
    "reconciles interrupted identity and automatic policy receipts without creating a second research task",
    async ({ page }) => {
      const issues = captureBrowserIssues(page);
      const mutationCalls: Array<{
        action: string | null;
        operationId: string | null;
        outcome: unknown;
        policyTaskId: string | null;
      }> = [];
      let dropFirstResolveReceipt = true;
      let dropFirstPolicyReceipt = true;
      const app = await installFreshHost(page, {
        callTool: async (name, args) => {
          const mutation = args.mutation && typeof args.mutation === "object"
            ? args.mutation as Record<string, unknown>
            : null;
          const action = typeof mutation?.action === "string"
            ? mutation.action
            : null;
          const operationId = typeof mutation?.operationId === "string"
            ? mutation.operationId
            : null;
          const result = await callMcpTool(baseUrl, name, args);
          if (name === "mutate_six_screen_workflow_v1") {
            const metadata = result._meta &&
                typeof result._meta === "object" &&
                !Array.isArray(result._meta)
              ? result._meta as JsonObject
              : {};
            mutationCalls.push({
              action,
              operationId,
              outcome:
                metadata["shockaudit/sixScreenMutationOutcome"],
              policyTaskId: (() => {
                const review = result.structuredContent?.policyReview;
                if (!review || typeof review !== "object" || Array.isArray(review)) {
                  return null;
                }
                return typeof (review as JsonObject).taskId === "string"
                  ? (review as JsonObject).taskId as string
                  : null;
              })(),
            });
          }
          if (action === "resolve_shock" && dropFirstResolveReceipt) {
            dropFirstResolveReceipt = false;
            throw new Error("Transport response interrupted after tool completion.");
          }
          if (action === "research_policy" && dropFirstPolicyReceipt) {
            dropFirstPolicyReceipt = false;
            throw new Error("Transport response interrupted after tool completion.");
          }
          return result;
        },
      });
      await app.getByLabel(/Policy or shock name/iu).fill(
        "California Consumer Privacy Act",
      );
      await app.getByRole("button", { name: "Find my policy" }).evaluate(
        (button) => {
          (button as HTMLButtonElement).click();
          (button as HTMLButtonElement).click();
        },
      );
      await expect(app.locator(".six-alert--error")).toContainText(
        /response was interrupted.*action may already be saved.*host delivery.*\[SA-[0-9A-F]{12}\]/iu,
      );
      await expect(app.getByRole("button", { name: "Check saved status" }))
        .toBeVisible();
      expect(mutationCalls.filter(({ action }) => action === "resolve_shock"))
        .toHaveLength(1);

      await app.getByRole("button", { name: "Check saved status" }).click();
      await expectCcpaMatch(app);
      const resolveCalls = mutationCalls.filter(({ action }) =>
        action === "resolve_shock"
      );
      expect(resolveCalls).toHaveLength(1);
      expect(resolveCalls.map(({ outcome }) => outcome)).toEqual(["changed"]);

      await app.getByRole("button", {
        name: "Confirm this policy and continue",
      }).evaluate((button) => {
        (button as HTMLButtonElement).click();
        (button as HTMLButtonElement).click();
      });
      await expect(app.getByRole("heading", {
        name: "2. Understand the policy",
      })).toBeVisible();
      expect(mutationCalls.filter(({ action }) => action === "confirm_shock"))
        .toHaveLength(1);
      expect(mutationCalls.filter(({ action }) => action === "open_screen_2"))
        .toHaveLength(1);

      await expectStandardPolicyResearchComplete(page, app);
      await expect(app.locator(
        ".six-screen2-heading .six-review-status",
      )).toHaveText(
        "partial",
      );
      const policyCalls = mutationCalls.filter(({ action }) =>
        action === "research_policy" || action === "continue_policy_research"
      );
      const initialPolicyCalls = policyCalls.filter(({ action }) =>
        action === "research_policy"
      );
      expect(initialPolicyCalls).toHaveLength(1);
      expect(initialPolicyCalls.map(({ outcome }) => outcome)).toEqual([
        "changed",
      ]);
      const recoveryReads = await page.evaluate(
        (recoveryTool) =>
          (
            window as unknown as {
              __shockAuditHostState: {
                toolCalls: Array<{ name: string }>;
              };
            }
          ).__shockAuditHostState.toolCalls.filter(({ name }) =>
            name === "get_six_screen_workflow_v1" || name === recoveryTool
          ).length,
        SIX_SCREEN_RECOVERY_SNAPSHOT_TOOL,
      );
      expect(recoveryReads).toBeGreaterThan(0);
      expect(policyCalls.filter(({ action }) =>
        action === "continue_policy_research"
      ).length).toBeGreaterThan(0);
      expect(new Set(policyCalls.map(({ policyTaskId }) => policyTaskId)))
        .toEqual(new Set([policyCalls[0]!.policyTaskId]));
      expect(policyCalls[0]!.policyTaskId).not.toBeNull();
      expect(issues).toEqual({ consoleErrors: [], pageErrors: [] });
    },
  );

  test(
    "Order 841 opens the study-first Screen 2 handoff and restores useful Screen 3 guidance",
    async ({ page }, testInfo) => {
      const issues = captureBrowserIssues(page);
      await page.setViewportSize({ width: 1280, height: 800 });
      await verifyWranglerTransportProbe(page, testInfo);
      const app = await installFreshHost(page);

      await expect(app.getByRole("heading", {
        name: "1. Your study and policy",
      })).toBeVisible();
      await expect(app.getByRole("button", {
        name: "Find my policy",
      })).toBeEnabled();
      await expect(app.locator(".six-steps")).not.toContainText(
        "[object Object]",
      );
      await app.getByLabel(/Policy or shock name/iu).fill("FERC Order 841");
      await app.getByRole("button", { name: /Cannot find the right policy/iu })
        .click();
      await app.getByLabel("Webpage URL").fill(order841Source);
      await app.getByLabel("Sample").fill(
        "Regional transmission organizations and independent system operators",
      );
      await app.getByLabel("Unit of analysis").fill("Market operator");
      await app.getByRole("textbox", { name: /^Geography/u }).fill(
        "United States",
      );
      await app.getByLabel("Industry").fill("Energy");
      await app.getByLabel("Study period start").fill("2016");
      await app.getByLabel("Study period end").fill("2022");
      await app.getByLabel("Outcome", { exact: true })
        .fill("Storage participation");
      await app.getByLabel("Theoretical construct of the shock").fill(
        "Policy-induced market participation",
      );
      await app.getByLabel(/How the shock affects the outcome/iu).fill(
        "How does Order 841 affect storage participation?",
      );
      await app.getByLabel("Have you already examined results for this question?")
        .selectOption("no");

      await app.getByRole("button", { name: "Find my policy" }).click();
      await expect.poll(async () => {
        const resolved = await app.getByRole("heading", {
          name: "Closest source-supported matches",
        }).count();
        if (resolved) return "resolved";
        const errorAlert = app.locator(".six-alert--error");
        const visibleError = await errorAlert.count()
          ? await errorAlert.textContent()
          : null;
        if (!visibleError) return "pending";
        const actions = await page.evaluate(() =>
          (
            window as unknown as {
              __shockAuditHostState: {
                toolCalls: Array<{
                  name: string;
                  arguments: { mutation?: { action?: string } };
                }>;
              };
            }
          ).__shockAuditHostState.toolCalls.map(({ name, arguments: args }) =>
            args.mutation?.action ?? name
          )
        );
        return `error: ${visibleError}; calls: ${actions.join(", ")}`;
      }, { timeout: 30_000 }).toBe("resolved");
      await expect(app.getByRole("heading", {
        name: "Closest source-supported matches",
      })).toBeVisible();
      await expect(app.getByRole("heading", {
        name: order841Title,
      })).toBeVisible();
      await expect(app.getByText("2018-03708", { exact: true })).toBeVisible();
      await expect(app.getByText(
        /Confirmation does not establish sample exposure/iu,
      )).toBeVisible();
      await expectNoSeriousOrCriticalWcagViolations(
        page,
        testInfo,
        "simulated-six-screen-screen01-order841-identity",
      );
      await saveSimulatedScreenshot(
        page,
        "simulated-six-screen-screen01-order841-identity",
      );

      await app.getByRole("button", {
        name: "Confirm this policy and continue",
      }).click();
      await expect(app.getByRole("heading", {
        name: "2. Understand the policy",
      })).toBeVisible();
      await expect(app.locator(".six-context-strip strong", {
        hasText: order841Title,
      })).toBeVisible();
      await expectStandardPolicyResearchComplete(page, app);
      await expect(app.locator(
        ".six-screen2-heading .six-review-status",
      )).toHaveText(
        "partial",
      );
      const handoff = app.getByLabel("Your study for the next step");
      await expect(handoff.getByRole("heading", {
        name: "Your study for the next step",
      })).toBeVisible();
      await expect(app.getByLabel("Policy Event Card review")).toHaveCount(0);
      await handoff.getByLabel(
        /How the shock affects the outcome/iu,
      ).fill("How does Order 841 affect storage participation?");
      await handoff.getByLabel("Treatment group").fill(
        "Market operators implementing Order 841 participation models",
      );
      await handoff.getByLabel("Control group").fill(
        "Comparable market operators before implementation",
      );
      await handoff.getByLabel("Use a proposed year").check();
      await handoff.getByRole("textbox", {
        name: "Treatment year",
        exact: true,
      }).fill("2020");
      await handoff.getByRole("button", {
        name: "Continue to comparison guidance",
      }).click();
      await expect(app.getByRole("heading", {
        name: "3. Suggested Approach",
      })).toBeVisible();
      await expect(app.getByRole("heading", {
        name: "Suggested Approach",
        exact: true,
      })).toBeVisible();
      await expect(app.locator(".six-proposed-comparison")).toContainText(
        "How does Order 841 affect storage participation?",
      );
      await expect(app.getByText("2020", { exact: true }).first())
        .toBeVisible();
      await expect(app.getByRole("heading", {
        name: "Study-specific design assessment",
      })).toBeVisible();

      await page.evaluate(() => {
        (
          window as unknown as {
            __shockAuditRemount: (entries: unknown[]) => void;
          }
        ).__shockAuditRemount([]);
      });
      await expect.poll(() => page.evaluate(() =>
        (
          window as unknown as {
            __shockAuditHostState: { initializedMounts: number[] };
          }
        ).__shockAuditHostState.initializedMounts.length
      )).toBe(2);
      await expect(app.getByRole("heading", {
        name: "3. Suggested Approach",
      })).toBeVisible();
      await expectNoSeriousOrCriticalWcagViolations(
        page,
        testInfo,
        "simulated-six-screen-screen03-order841-restored",
      );
      await saveSimulatedScreenshot(
        page,
        "simulated-six-screen-screen03-order841-restored",
      );

      await app.locator(".six-steps").getByRole("button", {
        name: /Your study and policy/iu,
      }).click();
      await expect(app.getByLabel(/Policy or shock name/iu))
        .toHaveValue("FERC Order 841");
      await expect(app.getByLabel("Sample")).toHaveValue(
        "Regional transmission organizations and independent system operators",
      );
      const toolCalls = await page.evaluate(() =>
        (
          window as unknown as {
            __shockAuditHostState: {
              toolCalls: Array<{
                name: string;
                mountId: number;
                arguments: { mutation?: Record<string, unknown> };
              }>;
            };
          }
        ).__shockAuditHostState.toolCalls
      );
      // A current host-restored snapshot can reopen without a redundant
      // canonical read. The safety invariant is that remounting never creates
      // or replaces the saved workflow.
      expect(toolCalls.some(({ name, mountId }) =>
        name === "create_six_screen_workflow_v1" && mountId === 2
      )).toBe(false);
      const mutations = toolCalls.filter(({ name }) =>
        name === "mutate_six_screen_workflow_v1"
      );
      expect(mutations.map(({ arguments: args }) => args.mutation?.action))
        .toEqual(expect.arrayContaining([
          "resolve_shock",
          "confirm_shock",
          "open_screen_2",
          "research_policy",
        ]));
      expect(mutations.every(({ arguments: args }) =>
        !Object.prototype.hasOwnProperty.call(args.mutation ?? {}, "projection")
      )).toBe(true);
      expect(issues).toEqual({ consoleErrors: [], pageErrors: [] });
    },
  );

  test(
    "CCPA supplied-source journey preserves study semantics, opens retained-evidence Screen 2, and keeps responsive navigation state",
    async ({ page }, testInfo) => {
      const issues = captureBrowserIssues(page);
      await page.setViewportSize({ width: 1440, height: 900 });
      const app = await installFreshHost(page);

      await app.getByLabel(/Policy or shock name/iu).fill(
        "California Consumer Privacy Act",
      );
      await app.getByRole("button", { name: /Cannot find the right policy/iu })
        .click();
      await app.getByLabel("Webpage URL")
        .fill("https://oag.ca.gov/privacy/ccpa");
      await app.getByLabel("Sample").fill("US public firms");
      await app.getByLabel("Unit of analysis").fill("firm-year");
      await app.getByRole("textbox", { name: /^Geography/u })
        .fill("United States");
      await app.getByLabel("Industry").fill("Manufacturing industry");
      await app.getByLabel("Study period start").fill("2010");
      await app.getByLabel("Study period end").fill("2022");
      await app.getByLabel("Outcome", { exact: true })
        .fill("Firm performance");
      await app.getByLabel("Theoretical construct of the shock")
        .fill("Customer protection");
      await app.getByLabel(/How the shock affects the outcome/iu)
        .fill("How customer protection affects firm performance");
      await app.getByLabel("Treatment group")
        .fill("California firms");
      await app.getByLabel("Control group")
        .fill("non-california firms");
      await app.getByLabel("Have you already examined results for this question?")
        .selectOption("no");

      await app.getByRole("button", { name: "Find my policy" }).click();
      await expect(app.getByRole("heading", {
        name: "Closest source-supported matches",
      })).toBeVisible();
      await expect(app.getByRole("heading", {
        name: "California Consumer Privacy Act",
      })).toBeVisible();
      await expect(app.locator(".six-candidate-card p", {
        hasText: /Also known as:.*\bCCPA\b/iu,
      })).toBeVisible();
      await expect(app.getByText("Available for policy review", { exact: true }))
        .toBeVisible();
      await expect(app.getByRole("link", {
        name: "California Consumer Privacy Act (CCPA)",
      })).toHaveAttribute("href", "https://oag.ca.gov/privacy/ccpa");
      await expectNoSeriousOrCriticalWcagViolations(
        page,
        testInfo,
        "simulated-six-screen-screen01-ccpa-match",
      );
      await saveSimulatedScreenshot(
        page,
        "simulated-six-screen-screen01-ccpa-match",
      );

      await app.getByRole("button", {
        name: "Confirm this policy and continue",
      }).click();
      await expect(app.getByRole("heading", {
        name: "2. Understand the policy",
      })).toBeVisible();
      await expect(app.locator(".six-context-strip strong", {
        hasText: "California Consumer Privacy Act",
      })).toBeVisible();
      await expectStandardPolicyResearchComplete(page, app);
      await expect(app.locator(
        ".six-screen2-heading .six-review-status",
      )).toHaveText(
        "partial",
      );
      const briefing = app.getByLabel("Source-linked policy briefing");
      await expect(briefing.getByRole("heading", {
        name: "Policy episode overview",
        exact: true,
      })).toBeVisible();
      await expect(briefing).toContainText("California Consumer Privacy Act");
      await expect(briefing).toContainText(
        /became operative on 2020-01-01/iu,
      );
      const policyOverview = briefing.locator(".six-policy-overview");
      await expect(policyOverview).not.toContainText(/\b(?:SUMMARY|DATES):/u);
      expect((await policyOverview.innerText()).match(
        /AB 375 grants consumers rights concerning personal information/gu,
      )).toHaveLength(1);
      await expect(briefing.getByRole("heading", {
        name: "Distinct legal stages",
        exact: true,
      })).toBeVisible();
      for (const chronologyDate of [
        "2018-06-28",
        "2020-01-01",
        "2020-07-01",
        "2023-01-01",
      ]) {
        await expect(briefing).toContainText(chronologyDate);
      }
      const confirmedIdentitySources = briefing.locator(".six-policy-later");
      await expect(confirmedIdentitySources).toHaveCount(1);
      await expect(confirmedIdentitySources).toContainText(
        "Confirmed identity sources (2)",
      );
      await expectNoSeriousOrCriticalWcagViolations(
        page,
        testInfo,
        "simulated-six-screen-screen02-ccpa-retained-evidence",
      );
      await page.locator("#shockaudit-frame").evaluate((frame) => {
        (frame as HTMLIFrameElement).style.width = "780px";
      });
      await app.locator("html").evaluate((root) => {
        root.style.zoom = "2";
      });
      expect(await app.locator("html").evaluate((root) =>
        root.scrollWidth <= root.clientWidth + 1
      ), "horizontal overflow at simulated 200% zoom").toBe(true);
      await app.locator("html").evaluate((root) => {
        root.style.zoom = "1";
      });
      await page.locator("#shockaudit-frame").evaluate((frame) => {
        (frame as HTMLIFrameElement).style.width = "100%";
      });
      await saveSimulatedScreenshot(
        page,
        "simulated-six-screen-screen02-ccpa-retained-evidence",
      );
      await page.setViewportSize({ width: 1280, height: 800 });
      await saveSimulatedScreenshot(
        page,
        "simulated-six-screen-screen02-ccpa-1280x800",
      );

      const handoff = app.getByLabel("Your study for the next step");
      await expect(handoff.getByLabel("Outcome *", { exact: true })).toHaveValue(
        "Firm performance",
      );
      await expect(handoff.getByLabel("Treatment group")).toHaveValue(
        "California firms",
      );
      await expect(handoff.getByLabel("Control group")).toHaveValue(
        "non-california firms",
      );
      await expect(app.getByLabel("Policy Event Card review")).toHaveCount(0);
      await handoff.getByLabel("Use a proposed year").check();
      await handoff.getByRole("textbox", {
        name: "Treatment year",
        exact: true,
      }).fill("2020");
      await handoff.getByRole("button", {
        name: "Continue to comparison guidance",
      }).click();
      await expect(app.getByRole("heading", {
        name: "3. Suggested Approach",
      })).toBeVisible();
      await expect(app.getByRole("heading", {
        name: "DiD with common treatment timing",
      })).toBeVisible();
      await expect(app.getByText(
        "California firms vs. non-california firms",
        { exact: true },
      )).toBeVisible();
      await expect(app.getByRole("heading", {
        name: "Study-specific design assessment",
      })).toBeVisible();
      await app.locator(".six-general-design-checks > summary").click();
      await expect(app.getByText(
        /One selected year does not establish common adoption/iu,
      )).toBeVisible();
      const modelGuidance = app.locator(".six-study-design-advice");
      await expect(modelGuidance.getByRole("heading", {
        name: "Suggested specification",
      }).first()).toBeVisible();
      await expect(modelGuidance.locator(".six-equation").first()).toContainText(
        "Y_it = α_i + λ_t + β(A_i × Post_t) + ε_it",
      );
      await expect(modelGuidance.getByRole("heading", {
        name: "Assumptions to examine",
      }).first()).toBeVisible();
      await expect(modelGuidance.getByRole("heading", {
        name: "Data requirements",
      }).first()).toBeVisible();
      await expectNoSeriousOrCriticalWcagViolations(
        page,
        testInfo,
        "simulated-six-screen-screen03-ccpa-study-first",
      );
      await saveSimulatedScreenshot(
        page,
        "simulated-six-screen-screen03-ccpa-study-first",
      );

      await app.getByRole("button", {
        name: "Continue to other-event review",
      }).click();
      await expect(app.getByRole("heading", {
        name: "4. Check other events",
      })).toBeVisible({ timeout: 30_000 });
      const eventInvestigation = app.locator(".six-study-first-events");
      await expect(eventInvestigation.getByRole("heading", {
        name: "Alternative shocks",
      })).toBeVisible();
      await expect(eventInvestigation.getByRole("heading", {
        name: "Source record",
      })).toBeVisible();
      await expect(eventInvestigation.getByText("Assessment pending", {
        exact: true,
      }).first()).toBeVisible();
      await expect(eventInvestigation.getByRole("heading", {
        name: /What it is|Why it may matter|What should you check next/,
      })).toHaveCount(0);
      await eventInvestigation.getByText(
        "Evidence and general screening notes",
        {
          exact: true,
        },
      ).click();
      await expect(eventInvestigation.getByRole("link").first()).toBeVisible();
      await expectNoSeriousOrCriticalWcagViolations(
        page,
        testInfo,
        "simulated-six-screen-screen04-ccpa-study-first",
      );
      await saveSimulatedScreenshot(
        page,
        "simulated-six-screen-screen04-ccpa-study-first",
      );

      await app.getByRole("button", {
        name: "Continue to mechanism review",
      }).click();
      await expect(app.getByRole("heading", {
        name: "5. Compare explanations",
      })).toBeVisible();
      await expect(app.getByRole("heading", {
        name: "Compare explanations",
        exact: true,
      })).toBeVisible();
      await expect(app.getByRole("heading", {
        name: "Start with your proposed process",
      })).toBeVisible();
      await expect(app.getByLabel("Theoretical perspective optional"))
        .toHaveValue("");
      await expect(app.getByLabel(
        "Process mechanism to investigate required for a new comparison",
      )).toHaveValue("How customer protection affects firm performance");
      await expect(app.getByRole("button", {
        name: "Generate study-specific mechanisms",
      })).toBeEnabled();
      await app.getByRole("button", {
        name: "Generate study-specific mechanisms",
      }).click();
      const hostTaskTranscript = await page.evaluate(() => {
        const state = (
          window as unknown as {
            __shockAuditHostState: {
              modelContextRequests: Array<{ params: JsonObject }>;
              messageRequests: Array<{ params: JsonObject }>;
              compatibilityModelContextRequests: Array<{ params: JsonObject }>;
              compatibilityMessageRequests: Array<{ params: JsonObject }>;
              errors: string[];
            };
          }
        ).__shockAuditHostState;
        return {
          modelContextCount: state.modelContextRequests.length,
          messageCount: state.messageRequests.length,
          compatibilityModelContextCount:
            state.compatibilityModelContextRequests.length,
          compatibilityMessageCount: state.compatibilityMessageRequests.length,
          errors: state.errors,
        };
      });
      expect(
        hostTaskTranscript,
        JSON.stringify(hostTaskTranscript),
      ).toMatchObject({
        messageCount: 0,
        compatibilityMessageCount: 0,
        errors: [],
      });
      await expect(app.locator(
        ".six-host-assessment.six-direct-execution",
      ).getByRole("heading", {
        name: "Direct comparison unavailable",
        exact: true,
      })).toBeVisible();
      await expect(app.getByText(
        /direct provider configuration required/iu,
      )).toBeVisible();
      await expect(app.getByRole("button", {
        name: "Copy safe diagnostic summary",
      })).toHaveCount(0);
      await expectNoSeriousOrCriticalWcagViolations(
        page,
        testInfo,
        "simulated-six-screen-screen05-ccpa-direct-unavailable",
      );
      await saveSimulatedScreenshot(
        page,
        "simulated-six-screen-screen05-ccpa-direct-unavailable",
      );

      await app.locator(".six-steps").getByRole("button", {
        name: /Your study and policy/iu,
      }).click();
      const outcomeConceptInput = app.getByLabel("Outcome", { exact: true });
      await expect(outcomeConceptInput).toHaveValue("Firm performance");
      await expect(app.getByLabel("Theoretical construct of the shock"))
        .toHaveValue("Customer protection");

      await page.setViewportSize({ width: 720, height: 900 });
      await expect(app.locator(".six-step-selector")).toBeHidden();
      await expect(app.locator(".six-steps")).toBeVisible();
      await app.locator(".six-steps").getByRole("button", {
        name: /Understand the policy/iu,
      }).click();
      await expect(app.getByRole("heading", {
        name: "2. Understand the policy",
      })).toBeVisible();

      await page.setViewportSize({ width: 480, height: 900 });
      await expect(app.locator(".six-step-selector")).toBeVisible();
      await expect(app.locator(".six-steps")).toBeHidden();

      const researchCalls = await page.evaluate(() =>
        (
          window as unknown as {
            __shockAuditHostState: {
              toolCalls: Array<{
                name: string;
                arguments: { mutation?: { action?: string } };
              }>;
            };
          }
        ).__shockAuditHostState.toolCalls.filter(({ name, arguments: args }) =>
          name === "mutate_six_screen_workflow_v1" &&
          args.mutation?.action === "research_policy"
        ).length
      );
      expect(researchCalls).toBe(1);
      expect(issues).toEqual({ consoleErrors: [], pageErrors: [] });
    },
  );

  test(
    "replacement Screen 1 preserves an unresolved external jurisdiction without substituting or opening Screen 2",
    async ({ page }, testInfo) => {
      const issues = captureBrowserIssues(page);
      const app = await installFreshHost(page);
      await app.getByLabel(/Policy or shock name/iu).fill(
        "Canadian clean-energy rule",
      );
      await app.getByRole("button", { name: "Find my policy" }).click();

      await expect(app.getByRole("heading", {
        name: "Identity not yet resolved",
      })).toBeVisible();
      await expect(app.getByText("source unavailable", { exact: true }))
        .toBeVisible();
      await expect(app.getByRole("heading", {
        name: "Closest source-supported matches",
      })).toHaveCount(0);
      await expect(app.getByRole("main").getByText(
        /retrieval failed.*not an empty search result/iu,
      )).toBeVisible();
      await expect(app.getByRole("main").getByText(
        "No policy from a different jurisdiction was substituted.",
        { exact: true },
      )).toBeVisible();
      await expect(app.getByRole("main").getByText(
        "Your study inputs and exact original request remain saved.",
      )).toBeVisible();
      await expect(app.locator(".six-steps").getByRole("button", {
        name: /Understand the policy/iu,
      })).toBeDisabled();
      await expectNoSeriousOrCriticalWcagViolations(
        page,
        testInfo,
        "simulated-six-screen-screen01-unsupported-jurisdiction",
      );
      await saveSimulatedScreenshot(
        page,
        "simulated-six-screen-screen01-unsupported-jurisdiction",
      );
      const actions = await page.evaluate(() =>
        (
          window as unknown as {
            __shockAuditHostState: {
              toolCalls: Array<{
                name: string;
                arguments: { mutation?: Record<string, unknown> };
              }>;
            };
          }
        ).__shockAuditHostState.toolCalls
          .map(({ arguments: args }) => args.mutation?.action)
          .filter(Boolean)
      );
      expect(actions).not.toContain("confirm_shock");
      expect(actions).not.toContain("open_screen_2");
      expect(issues).toEqual({ consoleErrors: [], pageErrors: [] });
    },
  );
});
