import { expect, test, type Page } from "@playwright/test";
import type { Server } from "node:http";

import {
  STAGE1_DRAFT_SCHEMA_VERSION,
  type Stage1AssessmentRequest,
  type Stage1ProofOpenResult,
} from "../../src/core/stage1-assessment-proof";
import {
  callMcpTool,
  installMcpAppHost,
  type JsonObject,
  type McpCallToolResult,
} from "./mcp-app-host";
import { startNodeFixtureServer } from "./node-fixture-server";

const baseUrl =
  process.env.SHOCKAUDIT_BROWSER_BASE_URL ??
  "http://127.0.0.1:8791";
let nodeFixtureServer: Server | null = null;

test.beforeAll(async () => {
  if (process.env.SHOCKAUDIT_BROWSER_NODE_FIXTURE === "1") {
    nodeFixtureServer = await startNodeFixtureServer(baseUrl);
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

async function hostMessageCount(page: Page) {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __shockAuditHostState: { messageRequests: unknown[] };
        }
      ).__shockAuditHostState.messageRequests.length,
  );
}

async function openProofHost(
  page: Page,
  options?: { messageResponseDelayMs?: number },
) {
  const openResult = await callMcpTool(
    baseUrl,
    "open_stage1_assessment_proof",
    {},
  );
  if (openResult.isError || !openResult.structuredContent) {
    throw new Error(`Could not open Stage 1 proof: ${JSON.stringify(openResult)}`);
  }
  const open = openResult.structuredContent as Stage1ProofOpenResult;
  await installMcpAppHost(page, {
    appUrl: `${baseUrl}/`,
    initialToolNotifications: [
      {
        label: "stage1-proof-open",
        arguments: {},
        result: openResult,
      },
    ],
    messageResponseDelayMs: options?.messageResponseDelayMs,
    callTool: (name, args) => callMcpTool(baseUrl, name, args),
  });
  const app = page.frameLocator("#shockaudit-frame");
  await expect(
    app.getByRole("heading", { name: "Stage 1 assessment handshake" }),
  ).toBeVisible();
  return { app, open };
}

function goldDraftArguments(request: Stage1AssessmentRequest): JsonObject {
  return {
    schemaVersion: STAGE1_DRAFT_SCHEMA_VERSION,
    requestId: request.requestId,
    candidateId: request.candidateId,
    candidateSnapshotId: request.candidateSnapshotId,
    candidateFingerprint: request.candidateFingerprint,
    requestProof: request.requestProof,
    draft: {
      studyFit: {
        category: "strong",
        explanation:
          "The application date is within the confirmed study period and the territorial-scope lead can distinguish relevant U.S. technology firms.",
        evidenceSourceIds: [
          "source-eu-gdpr-regulation-2016-679",
        ],
      },
      outcomePathway: {
        category: "plausible",
        explanation:
          "Data-processing obligations can plausibly redirect product and engineering resources related to innovation without asserting realized outcomes.",
        evidenceSourceIds: [
          "source-eu-gdpr-regulation-2016-679",
        ],
      },
      measurementPotential: {
        category: "possible",
        explanation:
          "EU establishment and EU-facing activity may provide observable exposure indicators, while exact firm coverage remains unverified.",
        evidenceSourceIds: ["source-eu-gdpr-celex-metadata"],
      },
      mainConcern:
        "The U.S. study population is broader than organizations demonstrably covered by the territorial-scope evidence lead.",
      nextChecks: [
        "Verify firm-level EU-facing activity before constructing exposure.",
        "Check whether verified exposure varies across sampled firms.",
      ],
    },
  };
}

// Historical proof-only evidence is retained as source, but those tools are
// deliberately absent from the canonical Screen 2 v2.1 fixture catalog.
test.describe.skip("Historical Stage 1 assessment handshake — proof catalog fixture required", () => {
  test("negative control: message delivery alone remains uncompleted", async ({
    page,
  }) => {
    const { app } = await openProofHost(page);

    await app
      .getByRole("button", { name: "Request assessment from ChatGPT" })
      .click();
    await expect.poll(() => hostMessageCount(page)).toBe(1);
    await expect(app.locator(".stage1-proof-status")).toContainText(
      "Assessment requested. Waiting for ChatGPT",
    );
    await expect(app.locator(".stage1-proof-status")).toContainText(
      "delivery only",
    );
    await expect(app.getByText("Assessment ready.", { exact: true })).toHaveCount(
      0,
    );
    const modelDraftCalls = await page.evaluate(
      () =>
        (
          window as unknown as {
            __shockAuditHostState: {
              toolCalls: Array<{ name?: string }>;
            };
          }
        ).__shockAuditHostState.toolCalls.filter(
          (call) => call.name === "submit_stage1_assessment_draft",
        ).length,
    );
    expect(modelDraftCalls).toBe(0);
  });

  test("simulation only: a fast matching receipt waits for message acknowledgement", async ({
    page,
  }) => {
    const { app, open } = await openProofHost(page, {
      messageResponseDelayMs: 750,
    });
    await app
      .getByRole("button", { name: "Request assessment from ChatGPT" })
      .click();
    await expect.poll(() => hostMessageCount(page)).toBe(1);

    const draftArguments = goldDraftArguments(open.request);
    const result = await callMcpTool(
      baseUrl,
      "submit_stage1_assessment_draft",
      draftArguments,
    );
    expect(result.isError).not.toBe(true);
    await page.evaluate(
      async ({ arguments: args, result: receipt }) => {
        await (
          window as unknown as {
            __shockAuditNotifyToolResult: (entry: {
              label: string;
              arguments: JsonObject;
              result: McpCallToolResult;
            }) => Promise<void>;
          }
        ).__shockAuditNotifyToolResult({
          label: "stage1-simulated-fast-model-receipt",
          arguments: args,
          result: receipt,
        });
      },
      { arguments: draftArguments, result },
    );

    await expect(app.locator(".stage1-proof-status")).toContainText(
      "Assessment ready.",
    );
    await expect(app.locator(".stage1-proof-assessment")).toContainText(
      "Promising to verify",
    );
    await expect(app.locator(".stage1-proof-receipt")).toContainText(
      "Message delivered",
    );
    await expect(app.locator(".stage1-proof-receipt")).toContainText(
      String(result.structuredContent?.receiptId),
    );
  });
});
