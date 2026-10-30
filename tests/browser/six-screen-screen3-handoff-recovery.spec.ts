import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { McpServer } from "@modelcontextprotocol/server";
import { expect, test, type FrameLocator, type Page } from "@playwright/test";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import { SIX_SCREEN_OPERATION_STATUS_TOOL } from
  "../../src/core/six-screen/operation-status";
import { SIX_SCREEN_RECOVERY_SNAPSHOT_TOOL } from
  "../../src/core/six-screen/recovery-snapshot";
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
import {
  browserEventCardFixtureAccessToken as accessToken,
  browserEventCardFixtureAt as at,
  browserEventCardFixtureCreatedAt as createdAt,
  browserEventCardFixtureRunId as runId,
  createBrowserEventCardFixture,
} from "./six-screen-event-card-review-fixture";
import type { Server } from "node:http";

const baseUrl = process.env.SHOCKAUDIT_BROWSER_BASE_URL ??
  "http://127.0.0.1:8791";
const mutateTool = "mutate_six_screen_workflow_v1";
const getTool = "get_six_screen_workflow_v1";
const authentication = { runId, accessToken };
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

type Deferred<T = void> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T = void>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function record(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} is not an object.`);
  }
  return value as JsonObject;
}

type ObservedToolCall = {
  name: string;
  action: string | null;
  operationId: string | null;
  expectedRevision: number | null;
  arguments: JsonObject;
};

type Screen3BrowserHarness = {
  runtime: SixScreenWorkflowRuntime;
  registeredCall: (
    name: string,
    arguments_: JsonObject,
  ) => Promise<McpCallToolResult>;
  initialPrivate: unknown;
  observedCalls: ObservedToolCall[];
  sourceCallCount: () => number;
  providerCallCount: () => number;
  close: () => Promise<void>;
};

async function createHarness(): Promise<Screen3BrowserHarness> {
  const fixture = createBrowserEventCardFixture();
  const storage = new InMemorySixScreenWorkflowStorage();
  const store = new SixScreenWorkflowStore(storage);
  await store.create({
    state: fixture.state,
    accessToken,
    createInputFingerprint: fingerprintSixScreenValue(
      "screen3-browser-handoff-recovery",
    ),
    createdAt,
    expiresAt: at(10_000),
  });
  let clock = 100;
  let sourceCalls = 0;
  let providerCalls = 0;
  const runtime = new SixScreenWorkflowRuntime({
    store,
    signingKey:
      "screen3-browser-handoff-recovery-signing-key-more-than-32-bytes",
    now: () => at(clock++),
    fetch: async () => {
      sourceCalls += 1;
      throw new Error("Screen 3 handoff acceptance forbids source traffic.");
    },
    screen5OpenAIFetch: async () => {
      providerCalls += 1;
      throw new Error("Screen 3 handoff acceptance forbids provider traffic.");
    },
  });
  const server = new McpServer(
    { name: "screen3-handoff-browser-fixture", version: "1.0.0" },
    { instructions: "Controlled local Screen 3 handoff acceptance." },
  );
  registerSixScreenWorkflowTools(server, runtime);
  const client = new Client({
    name: "screen3-handoff-browser-client",
    version: "1.0.0",
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  const registeredCall = async (name: string, arguments_: JsonObject) =>
    await client.callTool({ name, arguments: arguments_ }) as McpCallToolResult;
  const initialPrivate = (await runtime.status(authentication)).privateSnapshot;
  if (!initialPrivate) throw new Error("Initial workflow metadata is missing.");
  return {
    runtime,
    registeredCall,
    initialPrivate,
    observedCalls: [],
    sourceCallCount: () => sourceCalls,
    providerCallCount: () => providerCalls,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

function observeCall(
  harness: Screen3BrowserHarness,
  name: string,
  arguments_: JsonObject,
) {
  const mutation = arguments_.mutation &&
      typeof arguments_.mutation === "object" &&
      !Array.isArray(arguments_.mutation)
    ? arguments_.mutation as JsonObject
    : null;
  const call = {
    name,
    action: typeof mutation?.action === "string" ? mutation.action : null,
    operationId: typeof mutation?.operationId === "string"
      ? mutation.operationId
      : typeof arguments_.operationId === "string"
        ? arguments_.operationId
        : null,
    expectedRevision: typeof mutation?.expectedRevision === "number"
      ? mutation.expectedRevision
      : null,
    arguments: structuredClone(arguments_),
  } satisfies ObservedToolCall;
  harness.observedCalls.push(call);
  return call;
}

async function installHarness(
  page: Page,
  harness: Screen3BrowserHarness,
  callTool: (name: string, arguments_: JsonObject) => Promise<McpCallToolResult>,
) {
  await installMcpAppHost(page, {
    appUrl: `${baseUrl}/`,
    initialToolNotifications: [],
    installChatGptCompatibilityBridge: true,
    initialCompatibilityWidgetState: {
      modelContent: "Controlled Screen 3 handoff recovery.",
      privateContent: { sixScreenWorkflow: harness.initialPrivate },
    },
    callTool,
  });
  const app = page.frameLocator("#shockaudit-frame");
  await expect(app.getByRole("heading", {
    name: "2. Understand the policy",
  })).toBeVisible();
  await expect(app.getByRole("button", {
    name: "Continue to comparison guidance",
  })).toBeEnabled();
  return app;
}

async function prepareScreen3Handoff(app: FrameLocator) {
  const handoff = app.getByLabel("Your study for the next step");
  await handoff.getByLabel("Use a proposed year").check();
  await handoff.getByRole("textbox", {
    name: "Treatment year",
    exact: true,
  }).fill("2020");
  return handoff;
}

function screen3OpenCalls(harness: Screen3BrowserHarness) {
  return harness.observedCalls.filter(({ name, action }) =>
    name === mutateTool && action === "open_screen_3");
}

function statusCalls(harness: Screen3BrowserHarness) {
  return harness.observedCalls.filter(({ name }) =>
    name === SIX_SCREEN_OPERATION_STATUS_TOOL);
}

async function expectNoExternalCalls(harness: Screen3BrowserHarness) {
  expect(harness.sourceCallCount()).toBe(0);
  expect(harness.providerCallCount()).toBe(0);
}

test.describe("Screen 2 to Screen 3 durable handoff recovery", () => {
  test("shows saving/checking, keeps navigation readable, and restores the exact committed guidance after final-response loss", async ({
    page,
  }) => {
    const harness = await createHarness();
    const mutationEntered = deferred();
    const releaseMutation = deferred();
    const statusRead = deferred();
    const releaseStatus = deferred();
    const finalCanonicalRead = deferred();
    const releaseFinalCanonical = deferred();
    let dropFirstOpenResponse = true;
    let statusWasReleased = false;
    try {
      const app = await installHarness(page, harness, async (name, args) => {
        const call = observeCall(harness, name, args);
        if (name === mutateTool && call.action === "open_screen_3" &&
            dropFirstOpenResponse) {
          mutationEntered.resolve();
          await releaseMutation.promise;
          const committed = await harness.registeredCall(name, args);
          expect(committed.isError).not.toBe(true);
          dropFirstOpenResponse = false;
          throw new Error(
            "Controlled final-response loss after the registered runtime committed open_screen_3.",
          );
        }
        if (name === SIX_SCREEN_OPERATION_STATUS_TOOL) {
          const result = await harness.registeredCall(name, args);
          statusRead.resolve();
          await releaseStatus.promise;
          statusWasReleased = true;
          return result;
        }
        if (name === SIX_SCREEN_RECOVERY_SNAPSHOT_TOOL && statusWasReleased) {
          const result = await harness.registeredCall(name, args);
          finalCanonicalRead.resolve();
          await releaseFinalCanonical.promise;
          return result;
        }
        return harness.registeredCall(name, args);
      });
      const handoff = await prepareScreen3Handoff(app);
      await handoff.getByRole("button", {
        name: "Continue to comparison guidance",
      }).click();
      await mutationEntered.promise;
      await expect(handoff.getByRole("button", {
        name: "Saving study and opening comparison guidance…",
      })).toBeDisabled();

      releaseMutation.resolve();
      await statusRead.promise;
      await expect(handoff.getByRole("button", {
        name: "Checking saved handoff…",
      })).toBeDisabled();
      await expect.poll(() => page.evaluate(() => {
        const host = window as unknown as {
          __shockAuditCompatibilityWidgetState?: {
            privateContent?: Record<string, unknown>;
          };
        };
        return Object.hasOwn(
          host.__shockAuditCompatibilityWidgetState?.privateContent ?? {},
          "screen3HandoffRecovery",
        );
      })).toBe(true);

      await app.getByRole("button", {
        name: /Your study and policy/iu,
      }).click();
      await expect(app.getByRole("heading", {
        name: "1. Your study and policy",
      })).toBeVisible();
      releaseStatus.resolve();
      await finalCanonicalRead.promise;
      await expect(app.getByRole("heading", {
        name: "1. Your study and policy",
      })).toBeVisible();
      releaseFinalCanonical.resolve();
      await expect.poll(() => page.evaluate(() => {
        const host = window as unknown as {
          __shockAuditCompatibilityWidgetState?: {
            privateContent?: Record<string, unknown>;
          };
        };
        return Object.hasOwn(
          host.__shockAuditCompatibilityWidgetState?.privateContent ?? {},
          "screen3HandoffRecovery",
        );
      })).toBe(false);
      await expect(app.getByRole("heading", {
        name: "1. Your study and policy",
      })).toBeVisible();

      await app.getByRole("button", {
        name: /Suggested Approach/iu,
      }).click();
      await expect(app.getByRole("heading", {
        name: "3. Suggested Approach",
      })).toBeVisible();
      await expect(app.getByRole("heading", {
        name: "Study-specific design assessment",
      })).toBeVisible();
      await expect(app.locator(".six-proposed-comparison")).toContainText(
        "Covered market operators",
      );
      await expect(app.getByText("Conditional method guidance", {
        exact: true,
      }).first()).toBeVisible();

      const opens = screen3OpenCalls(harness);
      expect(opens).toHaveLength(1);
      const statuses = statusCalls(harness);
      expect(statuses).toHaveLength(1);
      expect(statuses[0]!.operationId).toBe(opens[0]!.operationId);
      const statusArguments = statuses[0]!.arguments;
      expect(statusArguments.operationKind).toBe("open_screen_3");
      expect(statusArguments.inputFingerprint).toMatch(
        /^fnv1a64:[0-9a-f]{16}$/u,
      );
      const openMutation = record(
        opens[0]!.arguments.mutation,
        "Observed Screen 3 mutation",
      );
      expect(statusArguments.inputFingerprint).toBe(
        fingerprintSixScreenValue({
          study: openMutation.study,
          proposedTiming: openMutation.proposedTiming,
          clarifications: openMutation.clarifications,
        }),
      );
      expect(harness.observedCalls.filter(({ name, action }) =>
        name === mutateTool && action !== null)).toHaveLength(1);
      expect(harness.observedCalls.filter(({ name }) =>
        name === SIX_SCREEN_RECOVERY_SNAPSHOT_TOOL)).toHaveLength(2);
      expect(harness.observedCalls.filter(({ name }) =>
        name === getTool)).toHaveLength(0);
      await expectNoExternalCalls(harness);
    } finally {
      await harness.close();
    }
  });

  test("opens Screen 3 through compressed recovery when the saved full mutation response is interrupted", async ({
    page,
  }) => {
    const harness = await createHarness();
    let dropOpenResponse = true;
    try {
      const app = await installHarness(page, harness, async (name, args) => {
        const call = observeCall(harness, name, args);
        if (name === mutateTool && call.action === "open_screen_3" &&
            dropOpenResponse) {
          const committed = await harness.registeredCall(name, args);
          expect(committed.isError).not.toBe(true);
          dropOpenResponse = false;
          const interrupted = new Error(
            "Controlled host delivery interruption after the Screen 3 commit.",
          );
          Object.assign(interrupted, { code: "TRANSPORT_INTERRUPTED" });
          throw interrupted;
        }
        return harness.registeredCall(name, args);
      });
      const handoff = await prepareScreen3Handoff(app);
      await handoff.getByRole("button", {
        name: "Continue to comparison guidance",
      }).click();

      await expect(app.getByRole("heading", {
        name: "3. Suggested Approach",
      })).toBeVisible();
      await expect(app.getByText("Study handoff needs attention"))
        .toHaveCount(0);
      await expect(app.getByRole("heading", {
        name: "Study-specific design assessment",
      })).toBeVisible();
      expect(screen3OpenCalls(harness)).toHaveLength(1);
      expect(statusCalls(harness)).toHaveLength(1);
      expect(harness.observedCalls.filter(({ name }) =>
        name === SIX_SCREEN_RECOVERY_SNAPSHOT_TOOL)).toHaveLength(2);
      expect(harness.observedCalls.filter(({ name }) =>
        name === getTool)).toHaveLength(0);
      await expectNoExternalCalls(harness);
    } finally {
      await harness.close();
    }
  });

  test("rebases once across navigation-only revision drift and never dispatches a third attempt", async ({
    page,
  }) => {
    const harness = await createHarness();
    let injectedDrift = false;
    try {
      const app = await installHarness(page, harness, async (name, args) => {
        const call = observeCall(harness, name, args);
        if (name === mutateTool && call.action === "open_screen_3" &&
            !injectedDrift) {
          injectedDrift = true;
          const drift = await harness.registeredCall(mutateTool, {
            ...authentication,
            mutation: {
              action: "open_screen_2",
              expectedRevision: call.expectedRevision,
              operationId: "screen3-browser-navigation-only-revision-drift",
            },
          });
          expect(drift.isError).not.toBe(true);
        }
        return harness.registeredCall(name, args);
      });
      const handoff = await prepareScreen3Handoff(app);
      await handoff.getByRole("button", {
        name: "Continue to comparison guidance",
      }).click();
      await expect(app.getByRole("heading", {
        name: "3. Suggested Approach",
      })).toBeVisible();

      const opens = screen3OpenCalls(harness);
      expect(opens).toHaveLength(2);
      expect(new Set(opens.map(({ operationId }) => operationId)).size).toBe(1);
      expect(opens[1]!.expectedRevision).toBe(
        (opens[0]!.expectedRevision ?? -1) + 1,
      );
      expect(statusCalls(harness)).toHaveLength(0);
      await expectNoExternalCalls(harness);
    } finally {
      await harness.close();
    }
  });

  test("does not retry or apply a stale submitted draft after a substantive concurrent edit", async ({
    page,
  }) => {
    const harness = await createHarness();
    let injectedScientificEdit = false;
    const concurrentOutcome =
      "Canonical concurrent outcome retained instead of stale submission";
    try {
      const app = await installHarness(page, harness, async (name, args) => {
        const call = observeCall(harness, name, args);
        if (name === mutateTool && call.action === "open_screen_3" &&
            !injectedScientificEdit) {
          injectedScientificEdit = true;
          const mutation = record(args.mutation, "Screen 3 mutation");
          const study = record(mutation.study, "Screen 3 submitted study");
          const changed = await harness.registeredCall(mutateTool, {
            ...authentication,
            mutation: {
              action: "update_study",
              expectedRevision: call.expectedRevision,
              operationId: "screen3-browser-substantive-revision-drift",
              study: { ...study, outcome: concurrentOutcome },
            },
          });
          expect(changed.isError).not.toBe(true);
        }
        return harness.registeredCall(name, args);
      });
      const handoff = await prepareScreen3Handoff(app);
      await handoff.getByLabel("Outcome *", { exact: true }).fill(
        "Stale submitted outcome that must not be applied",
      );
      await handoff.getByRole("button", {
        name: "Continue to comparison guidance",
      }).click();
      await expect(handoff.getByText("Study handoff needs attention"))
        .toBeVisible();
      await expect(handoff.getByLabel("Outcome *", { exact: true }))
        .toHaveValue(concurrentOutcome);

      expect(screen3OpenCalls(harness)).toHaveLength(1);
      expect(statusCalls(harness)).toHaveLength(0);
      const snapshot = record(
        (await harness.runtime.status(authentication)).privateSnapshot,
        "Canonical workflow snapshot",
      );
      const state = record(snapshot.state, "Canonical workflow state");
      const study = record(state.study, "Canonical study");
      expect(study.outcome).toBe(concurrentOutcome);
      expect(state.activeScreen).toBe(2);
      await expectNoExternalCalls(harness);
    } finally {
      await harness.close();
    }
  });

  test("preserves a researcher edit made while a stale handoff is in flight and sends no guarded retry", async ({
    page,
  }) => {
    const harness = await createHarness();
    const firstOpenEntered = deferred();
    const releaseFirstOpen = deferred();
    let injectedDrift = false;
    const activeEdit = "Researcher edit made while the save was in flight";
    try {
      const app = await installHarness(page, harness, async (name, args) => {
        const call = observeCall(harness, name, args);
        if (name === mutateTool && call.action === "open_screen_3" &&
            !injectedDrift) {
          injectedDrift = true;
          firstOpenEntered.resolve();
          await releaseFirstOpen.promise;
          const drift = await harness.registeredCall(mutateTool, {
            ...authentication,
            mutation: {
              action: "open_screen_2",
              expectedRevision: call.expectedRevision,
              operationId: "screen3-browser-edit-during-revision-drift",
            },
          });
          expect(drift.isError).not.toBe(true);
        }
        return harness.registeredCall(name, args);
      });
      const handoff = await prepareScreen3Handoff(app);
      await handoff.getByRole("button", {
        name: "Continue to comparison guidance",
      }).click();
      await firstOpenEntered.promise;
      await expect(handoff.getByRole("button", {
        name: "Saving study and opening comparison guidance…",
      })).toBeDisabled();
      await handoff.getByLabel("Outcome *", { exact: true }).fill(activeEdit);
      releaseFirstOpen.resolve();
      await expect(handoff.getByText("Study handoff needs attention"))
        .toBeVisible();
      await expect(handoff.getByLabel("Outcome *", { exact: true }))
        .toHaveValue(activeEdit);
      expect(screen3OpenCalls(harness)).toHaveLength(1);
      expect(statusCalls(harness)).toHaveLength(0);
      await expectNoExternalCalls(harness);
    } finally {
      await harness.close();
    }
  });
});
