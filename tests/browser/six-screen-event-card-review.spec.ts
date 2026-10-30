import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { McpServer } from "@modelcontextprotocol/server";
import { expect, test, type Locator, type Page } from "@playwright/test";
import type { Server } from "node:http";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import {
  SIX_SCREEN_POLICY_EVENT_CARD_WORKSPACE_META_KEY,
  SIX_SCREEN_POLICY_LIFECYCLE_STAGE_WORKSPACE_META_KEY,
  SIX_SCREEN_WORKFLOW_META_KEY,
  registerSixScreenWorkflowTools,
} from "../../src/worker/six-screen-tools";
import { SixScreenEvidenceStore } from
  "../../src/worker/six-screen-evidence-store";
import { SixScreenResearchTaskStore } from
  "../../src/worker/six-screen-research-task-store";
import { SixScreenWorkflowRuntime } from
  "../../src/worker/six-screen-workflow-runtime";
import {
  InMemorySixScreenWorkflowStorage,
  SixScreenWorkflowStore,
} from "../../src/worker/six-screen-workflow-store";
import {
  installMcpAppHost,
  type JsonObject,
  type McpCallToolResult,
} from "./mcp-app-host";
import { startNodeFixtureServer } from "./node-fixture-server";
import {
  browserEventCardFixtureAccessToken,
  browserEventCardFixtureAt,
  browserEventCardFixtureCreatedAt,
  browserEventCardFixtureRunId,
  createBrowserEventCardFixture,
} from "./six-screen-event-card-review-fixture";

const baseUrl = process.env.SHOCKAUDIT_BROWSER_BASE_URL ??
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

type BrowserIssues = {
  consoleErrors: string[];
  pageErrors: string[];
};

const consequentialClaimStatements = [
  "Covered operators must establish a market-participation process.",
  "The requirement applies to operators serving the covered market.",
  "A filing is due within 270 days, followed by 365 days to implement.",
  "The final rule takes legal effect on 2020-03-01.",
] as const;

function captureBrowserIssues(page: Page): BrowserIssues {
  const issues: BrowserIssues = { consoleErrors: [], pageErrors: [] };
  page.on("console", (message) => {
    if (message.type() === "error") {
      issues.consoleErrors.push(message.text());
      console.error(`[browser console error] ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    issues.pageErrors.push(error.message);
    console.error(`[browser page error] ${error.message}`);
  });
  return issues;
}

function redactDiagnostic(value: string) {
  return value.replace(/sa6[ar]_[A-Za-z0-9_-]+/gu, "[private workflow coordinate]");
}

async function expectMatrixTextWithDiagnostics(input: {
  page: Page;
  issues: BrowserIssues;
  searchMatrix: Locator;
  expected: string;
}) {
  try {
    await expect(input.searchMatrix).toContainText(input.expected, {
      timeout: 30_000,
    });
  } catch (error) {
    const host = await input.page.evaluate(() => {
      const state = (
        window as unknown as {
          __shockAuditHostState?: {
            mountId: number;
            initializedMounts: number[];
            errors: string[];
            toolCalls: Array<{
              name?: string;
              mountId?: number;
              arguments?: { mutation?: { action?: string } };
            }>;
            events: Array<{
              direction?: string;
              method?: string;
              mountId?: number;
            }>;
          };
        }
      ).__shockAuditHostState;
      return state
        ? {
            mountId: state.mountId,
            initializedMounts: state.initializedMounts,
            errors: state.errors,
            recentToolCalls: state.toolCalls.slice(-4).map((call) => ({
              name: call.name,
              mountId: call.mountId,
              action: call.arguments?.mutation?.action,
            })),
            recentEvents: state.events.slice(-8).map((event) => ({
              direction: event.direction,
              method: event.method,
              mountId: event.mountId,
            })),
          }
        : null;
    });
    const app = input.page.locator("#shockaudit-frame").contentFrame();
    const bodyText = await app.locator("body").innerText().catch(() => "");
    const headings = await app.locator("h1, h2, h3, h4").allTextContents()
      .catch(() => [] as string[]);
    const diagnostic = {
      expected: input.expected,
      frameUrls: input.page.frames().map((frame) => frame.url()),
      host,
      browserIssues: input.issues,
      bodyText: bodyText.slice(0, 2_000),
      headings: headings.slice(0, 30),
    };
    console.error(
      `[six-screen matrix diagnostic] ${redactDiagnostic(
        JSON.stringify(diagnostic, null, 2),
      )}`,
    );
    throw error;
  }
}

function resultMetadata(result: McpCallToolResult) {
  const metadata = result._meta;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error("The fixture tool result omitted metadata.");
  }
  return metadata as JsonObject;
}

async function decideClaims(
  reviewPanel: Locator,
  options: {
    correctedSourceStatement: string | null;
    rationalePrefix: string;
  },
) {
  const claimDetails = reviewPanel.locator(".six-review-claims");
  if (!(await claimDetails.getAttribute("open"))) {
    await claimDetails.locator("summary").click();
  }
  const claims = reviewPanel.locator(".six-review-claim");
  await expect(claims).toHaveCount(consequentialClaimStatements.length);
  for (const [index, sourceStatement] of
    consequentialClaimStatements.entries()) {
    const claim = claims.filter({ hasText: sourceStatement });
    await expect(claim).toHaveCount(1);
    const corrected = options.correctedSourceStatement === sourceStatement;
    await claim.getByRole("combobox").selectOption(
      corrected ? "corrected" : "accepted",
    );
    if (corrected) {
      await claim.getByLabel("Your corrected statement").fill(
        "For this study, the researcher describes the duty as a sample-specific participation process.",
      );
    }
    await claim.getByLabel("Reason for this decision").fill(
      `${options.rationalePrefix} claim ${index + 1} against the retained passage.`,
    );
    await claim.getByRole("button", { name: "Save claim decision" }).click();
    await expect(reviewPanel.locator(".six-review-progress")).toContainText(
      `${index + 1}/${consequentialClaimStatements.length}`,
    );
  }
}

async function saveNoTreatmentClock(reviewPanel: Locator, rationale: string) {
  const clock = reviewPanel.locator(".six-clock-review");
  await clock.getByRole("radio", {
    name: "Continue without selecting a treatment clock",
  }).check();
  await clock.getByLabel("Reason for this timing decision").fill(rationale);
  await clock.getByRole("button", { name: "Save treatment timing" }).click();
  await expect(clock.locator(".six-card-heading > span")).toHaveText(
    "no selection",
  );
}

async function lockReview(reviewPanel: Locator, rationale: string) {
  const lock = reviewPanel.locator(".six-lock-review");
  await lock.getByLabel("Reason for locking this reviewed record").fill(
    rationale,
  );
  await lock.getByRole("button", {
    name: /Save (?:this partial review|reviewed Event Card)/u,
  }).click();
}

// The study-first v2 surface preserves locked Event Cards read-only. The
// retired interactive review/revision journey below remains as historical
// executable documentation; core and render tests cover its stored-state
// compatibility without reintroducing it into the normal Screen 2 path.
test.skip(
  "fixture-only review survives restarts and routes a possible policy stage back to Screen 2",
  async ({ page }) => {
    const issues = captureBrowserIssues(page);
    const fixture = createBrowserEventCardFixture();
    const storage = new InMemorySixScreenWorkflowStorage();
    const store = new SixScreenWorkflowStore(storage);
    const evidenceStore = new SixScreenEvidenceStore(storage);
    const taskStore = new SixScreenResearchTaskStore(storage);
    await store.create({
      state: fixture.state,
      accessToken: browserEventCardFixtureAccessToken,
      createInputFingerprint: fingerprintSixScreenValue(
        "provider-neutral-browser-event-card-fixture",
      ),
      createdAt: browserEventCardFixtureCreatedAt,
      expiresAt: "2026-09-14T12:00:00.000Z",
    });
    await evidenceStore.create({
      runId: browserEventCardFixtureRunId,
      accessToken: browserEventCardFixtureAccessToken,
      snapshot: fixture.evidenceSnapshot,
      collection: fixture.collection,
      expiresAt: "2026-09-14T12:00:00.000Z",
    });
    let clockTick = 6;
    let coEventProviderCalls = 0;
    const runtime = new SixScreenWorkflowRuntime({
      store,
      evidenceStore,
      taskStore,
      signingKey:
        "provider-neutral-browser-event-card-signing-key-1234567890",
      now: () => browserEventCardFixtureAt(clockTick++),
      fetch: async (request) => {
        if (String(request).includes("/documents/full_text/")) {
          return new Response(`<!doctype html><html><body><main>
            <p>This implementation order cites focal rule 2020-12345 and retains a later schedule for review.</p>
            <p>No causal or comparison-specific conclusion appears in this official document.</p>
            <p>[FR Doc. 2021-54321 Filed 6-18-21; 8:45 am]</p>
          </main></body></html>`, {
            status: 200,
            headers: { "content-type": "text/html" },
          });
        }
        coEventProviderCalls += 1;
        if (coEventProviderCalls === 1) {
          return new Response(null, { status: 503 });
        }
        return new Response(JSON.stringify({
          count: 2,
          results: [{
            document_number: "2021-54321",
            title: "Capacity Market Reliability Implementation Rule",
            type: "Rule",
            abstract:
              "The commission reported a capacity-market implementation change.",
            action: "Final rule.",
            excerpts: [
              "A capacity-market implementation change was reported.",
            ],
            html_url:
              "https://www.federalregister.gov/documents/2021/06/21/2021-54321/example",
            publication_date: "2021-06-21",
            effective_on: "2021-07-21",
            agencies: [{ name: "Federal Energy Regulatory Commission" }],
          }, {
            document_number: "2021-60001",
            title: "Capacity Market Reliability Implementation Notice",
            type: "Notice",
            abstract:
              "The commission reported a later implementation-stage notice.",
            action: "Notice.",
            excerpts: [
              "A later capacity-market implementation stage was reported.",
            ],
            html_url:
              "https://www.federalregister.gov/documents/2021/07/15/2021-60001/example",
            publication_date: "2021-07-15",
            effective_on: "2021-08-01",
            agencies: [{ name: "Federal Energy Regulatory Commission" }],
          }],
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });
    const server = new McpServer(
      { name: "six-screen-browser-fixture", version: "1.0.0" },
      { instructions: "Provider-neutral fixture-only browser acceptance." },
    );
    registerSixScreenWorkflowTools(server, runtime);
    const client = new Client({
      name: "six-screen-browser-fixture-client",
      version: "1.0.0",
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    try {
      const callTool = async (name: string, args: JsonObject) =>
        await client.callTool({ name, arguments: args }) as McpCallToolResult;
      const authentication = {
        runId: browserEventCardFixtureRunId,
        accessToken: browserEventCardFixtureAccessToken,
      };
      const initial = await callTool(
        "get_six_screen_workflow_v1",
        authentication,
      );
      expect(initial.isError).not.toBe(true);
      const initialMetadata = resultMetadata(initial);
      const initialPrivate = initialMetadata[SIX_SCREEN_WORKFLOW_META_KEY];
      expect(initialPrivate).toMatchObject({
        runId: browserEventCardFixtureRunId,
        revision: 5,
        state: {
          activeScreen: 2,
          policyReview: {
            status: "partial",
            evidenceSnapshotId: fixture.evidenceSnapshot.id,
          },
        },
      });

      await installMcpAppHost(page, {
        appUrl: `${baseUrl}/`,
        initialToolNotifications: [],
        installChatGptCompatibilityBridge: true,
        initialCompatibilityWidgetState: {
          modelContent: "ShockAudit private restoration state.",
          privateContent: { sixScreenWorkflow: initialPrivate },
        },
        callTool,
      });

      await expect(page.getByTestId("simulated-browser-evidence")).toContainText(
        "not signed-in ChatGPT evidence",
      );
      const app = page.frameLocator("#shockaudit-frame");
      await expect(app.getByRole("heading", {
        name: "2. Understand the policy",
      })).toBeVisible();
      await expect(app.getByText("Saved workspace", { exact: true })).toBeVisible();
      await expect(app.locator(
        ".six-screen2-heading .six-review-status",
      )).toHaveText(
        "partial",
      );
      const reviewPanel = app.locator(".six-event-review");
      await expect(reviewPanel.getByText("Policy components")).toBeVisible();
      await reviewPanel.locator(".six-review-evidence-details > summary").click();
      await expect(reviewPanel.getByRole("heading", {
        name: "Separate policy clocks",
      })).toBeVisible();
      const sourcePanel = reviewPanel.locator(".six-source-panel");
      await sourcePanel.locator("summary").click();
      await expect(sourcePanel.getByText("Official fixture publisher")).toBeVisible();
      await expect(sourcePanel.getByText(
        "Covered operators must establish a market-participation process.",
      )).toBeVisible();

      await app.getByRole("button", {
        name: "Review and continue",
      }).click();
      await expect(reviewPanel.locator(".six-review-status")).toHaveText(
        "in review",
      );
      await decideClaims(reviewPanel, {
        correctedSourceStatement: consequentialClaimStatements[0],
        rationalePrefix: "Initial review checked",
      });
      const firstClaim = reviewPanel.locator(".six-review-claim").filter({
        hasText: consequentialClaimStatements[0],
      });
      await expect(firstClaim.locator(".six-researcher-correction")).toContainText(
        "Researcher-supplied correction",
      );
      await expect(firstClaim.locator(".six-researcher-correction")).toContainText(
        "sample-specific participation process",
      );
      await expect(firstClaim).toContainText(
        "Covered operators must establish a market-participation process.",
      );
      await saveNoTreatmentClock(
        reviewPanel,
        "The retained legal clocks do not establish the study treatment date.",
      );
      await lockReview(
        reviewPanel,
        "Lock this partial evidence record without inventing a treatment clock.",
      );
      await expect(reviewPanel.getByRole("heading", {
        name: "Event Card revision 1 is locked",
      })).toBeVisible();
      await expect(reviewPanel.locator(".six-review-status")).toHaveText(
        "current",
      );
      await expect(reviewPanel.locator(".six-locked-card")).toContainText(
        "explicit limitation",
      );

      const firstLocked = await callTool(
        "get_six_screen_workflow_v1",
        authentication,
      );
      const firstLockedMetadata = resultMetadata(firstLocked);
      const firstLockedWorkspace = firstLockedMetadata[
        SIX_SCREEN_POLICY_EVENT_CARD_WORKSPACE_META_KEY
      ] as {
        activeReview: {
          lockedEventCard: {
            eventCardFingerprint: string;
            binding: { evidenceSnapshotId: string };
          };
        };
        revisions: Array<{ ordinal: number; status: string }>;
      };
      const firstEventCardFingerprint =
        firstLockedWorkspace.activeReview.lockedEventCard.eventCardFingerprint;
      expect(firstLockedWorkspace).toMatchObject({
        revisions: [{ ordinal: 1, status: "current" }],
      });
      expect(
        firstLockedWorkspace.activeReview.lockedEventCard.binding
          .evidenceSnapshotId,
      ).toBe(fixture.evidenceSnapshot.id);

      await page.evaluate(() => {
        (
          window as unknown as {
            __shockAuditRemount: (entries: unknown[]) => void;
          }
        ).__shockAuditRemount([]);
      });
      await expect.poll(() =>
        page.evaluate(() =>
          (
            window as unknown as {
              __shockAuditHostState: { initializedMounts: number[] };
            }
          ).__shockAuditHostState.initializedMounts.length
        )
      ).toBe(2);
      await expect(app.getByRole("heading", {
        name: "Event Card revision 1 is locked",
      })).toBeVisible();
      await expect(app.locator(".six-review-status")).toHaveText("current");
      const restorationReads = await page.evaluate(() =>
        (
          window as unknown as {
            __shockAuditHostState: {
              toolCalls: Array<{ name: string; mountId: number }>;
            };
          }
        ).__shockAuditHostState.toolCalls
          .filter(({ name }) => name === "get_six_screen_workflow_v1")
          .map(({ mountId }) => mountId)
      );
      expect(restorationReads).toEqual([1, 2]);

      await app.getByLabel("Reason for opening this review").fill(
        "Recheck every decision while the first locked card stays immutable.",
      );
      await app.getByRole("button", {
        name: "Open a new Event Card revision",
      }).click();
      await expect(app.locator(".six-review-status")).toHaveText(
        "pending revision",
      );
      const pendingHistory = app.locator(".six-review-history");
      const revisionOnePending = pendingHistory.locator("li").filter({
        hasText: "Revision 1",
      });
      const revisionTwoPending = pendingHistory.locator("li").filter({
        hasText: "Revision 2",
      });
      await expect(revisionOnePending).toContainText("review required");
      await expect(revisionOnePending).not.toContainText("superseded");
      await expect(revisionTwoPending).toContainText("pending revision");

      const pending = await callTool(
        "get_six_screen_workflow_v1",
        authentication,
      );
      const pendingWorkspace = resultMetadata(pending)[
        SIX_SCREEN_POLICY_EVENT_CARD_WORKSPACE_META_KEY
      ] as {
        revisions: Array<{ ordinal: number; status: string }>;
        activeReview: {
          supersedes: { eventCardFingerprint: string };
        };
      };
      expect(pendingWorkspace.revisions).toEqual([
        expect.objectContaining({ ordinal: 1, status: "review_required" }),
        expect.objectContaining({ ordinal: 2, status: "pending_revision" }),
      ]);
      expect(pendingWorkspace.activeReview.supersedes.eventCardFingerprint).toBe(
        firstEventCardFingerprint,
      );

      await decideClaims(app.locator(".six-event-review"), {
        correctedSourceStatement: null,
        rationalePrefix: "Revision two rechecked",
      });
      await saveNoTreatmentClock(
        app.locator(".six-event-review"),
        "Revision two still does not establish the study treatment date.",
      );
      await lockReview(
        app.locator(".six-event-review"),
        "Lock revision two while retaining revision one's immutable history.",
      );
      await expect(app.getByRole("heading", {
        name: "Event Card revision 2 is locked",
      })).toBeVisible();
      const finalHistory = app.locator(".six-review-history");
      await expect(finalHistory.locator("li").filter({
        hasText: "Revision 1",
      })).toContainText("superseded");
      await expect(finalHistory.locator("li").filter({
        hasText: "Revision 2",
      })).toContainText("current");

      const final = await callTool(
        "get_six_screen_workflow_v1",
        authentication,
      );
      const finalMetadata = resultMetadata(final);
      const finalWorkspace = finalMetadata[
        SIX_SCREEN_POLICY_EVENT_CARD_WORKSPACE_META_KEY
      ] as {
        revisions: Array<{ ordinal: number; status: string }>;
        activeReview: {
          lockedEventCard: { eventCardFingerprint: string };
        };
      };
      expect(finalWorkspace.revisions).toEqual([
        expect.objectContaining({ ordinal: 1, status: "superseded" }),
        expect.objectContaining({ ordinal: 2, status: "current" }),
      ]);
      expect(
        finalWorkspace.activeReview.lockedEventCard.eventCardFingerprint,
      ).not.toBe(firstEventCardFingerprint);
      const finalPrivate = finalMetadata[SIX_SCREEN_WORKFLOW_META_KEY] as {
        state: {
          policyEventCardReviews: Array<{
            ordinal: number;
            lockedEventCard: unknown;
          }>;
        };
      };
      expect(finalPrivate.state.policyEventCardReviews).toHaveLength(2);
      expect(finalPrivate.state.policyEventCardReviews.every(
        ({ lockedEventCard }) => lockedEventCard !== null,
      )).toBe(true);

      const screen3Gate = app.getByLabel("Screen 3 readiness");
      await expect(screen3Gate.getByRole("heading", {
        name: "The comparison workspace is ready",
      })).toBeVisible();
      await screen3Gate.getByRole("button", {
        name: "Continue to build the comparison",
      }).click();
      await expect(app.getByRole("heading", {
        name: "3. Suggested Approach",
      })).toBeVisible();
      const comparison = app.getByLabel("Causal comparison workspace");
      await expect(comparison).toContainText(
        "How does the policy affect market participation among covered operators?",
      );
      await expect(comparison).toContainText(
        "do not certify exogeneity, parallel trends, local random assignment, or causal validity",
      );

      const targetEvidence = comparison.getByRole("group", {
        name: "Facts that define the target exposure",
      });
      await targetEvidence.locator("label").filter({
        hasText: consequentialClaimStatements[0],
      }).getByRole("checkbox").check();
      const variationEvidence = comparison.getByRole("group", {
        name: "Facts that may create the comparison",
      });
      await variationEvidence.locator("label").filter({
        hasText: consequentialClaimStatements[1],
      }).getByRole("checkbox").check();
      await comparison.getByLabel("Relevant data availability").selectOption(
        "partially_available",
      );
      await comparison.getByLabel("Data frequency").fill("annual");
      await comparison.getByLabel("Historical eligibility fields").fill(
        "historical_coverage_status",
      );
      await comparison.getByRole("button", {
        name: "Build source-linked comparison options",
      }).click();

      const identificationMap = comparison.locator(".six-identification-map");
      await expect(identificationMap.getByText("Identification Map", {
        exact: true,
      })).toBeVisible();
      await expect(identificationMap.getByRole("heading", {
        name: "Coverage-based change-over-time comparison",
      })).toBeVisible();
      await expect(identificationMap).toContainText("Source-linked variation");
      await expect(identificationMap).toContainText("Important threats");
      await expect(identificationMap).toContainText(
        "The reviewed policy sources do not establish parallel trends or exogeneity.",
      );
      const officialSourceLinks = identificationMap.getByRole("link", {
        name: /Official fixture publisher/u,
      });
      await expect(officialSourceLinks).toHaveCount(2);
      await expect(officialSourceLinks.nth(0)).toHaveAttribute(
        "href",
        "https://example.gov/policy/final-rule-2020",
      );
      await expect(officialSourceLinks.nth(1)).toHaveAttribute(
        "href",
        "https://example.gov/policy/final-rule-2020",
      );
      const option = identificationMap.locator(".six-design-option").first();
      await option.getByLabel("Why carry this comparison forward?").fill(
        "Carry this conditional design into the next review while testing its assumptions.",
      );
      await option.getByRole("button", {
        name: "Select for further review",
      }).click();
      await expect(comparison.getByRole("heading", {
        name: "Coverage-based change-over-time comparison selected for review",
      })).toBeVisible();
      await expect(comparison).toContainText("This decision is a plan, not proof");

      await app.getByRole("button", {
        name: "Back to reviewed Event Card",
      }).click();
      await expect(app.getByRole("heading", {
        name: "2. Understand the policy",
      })).toBeVisible();
      await expect(app.getByRole("heading", {
        name: "Event Card revision 2 is locked",
      })).toBeVisible();
      await app.getByRole("button", {
        name: "Suggested Approach",
      }).click();
      await expect(app.getByRole("heading", {
        name: "Coverage-based change-over-time comparison selected for review",
      })).toBeVisible();

      await page.evaluate(() => {
        (
          window as unknown as {
            __shockAuditRemount: (entries: unknown[]) => void;
          }
        ).__shockAuditRemount([]);
      });
      await expect.poll(() =>
        page.evaluate(() =>
          (
            window as unknown as {
              __shockAuditHostState: { initializedMounts: number[] };
            }
          ).__shockAuditHostState.initializedMounts.length
        )
      ).toBe(3);
      await expect(app.getByRole("heading", {
        name: "3. Suggested Approach",
      })).toBeVisible();
      await expect(app.getByRole("heading", {
        name: "Coverage-based change-over-time comparison selected for review",
      })).toBeVisible();

      const screen3Mutations = await page.evaluate(() =>
        (
          window as unknown as {
            __shockAuditHostState: {
              toolCalls: Array<{
                arguments: { mutation?: Record<string, unknown> };
              }>;
            };
          }
        ).__shockAuditHostState.toolCalls
          .map(({ arguments: args }) => args.mutation?.action)
          .filter((action) =>
            action === "open_screen_3" ||
            action === "build_causal_comparison" ||
            action === "decide_causal_comparison"
          )
      );
      expect(screen3Mutations).toEqual([
        "open_screen_3",
        "build_causal_comparison",
        "decide_causal_comparison",
        "open_screen_3",
      ]);

      const screen4Gate = app.getByLabel("Screen 4 readiness");
      await expect(screen4Gate.getByRole("heading", {
        name: "Targeted event scan — selected comparison retained",
      })).toBeVisible();
      await screen4Gate.getByRole("button", {
        name: "Continue to other-event search scope",
      }).click();
      await expect(app.getByRole("heading", {
        name: "4. Check other events",
      })).toBeVisible();
      const coevents = app.getByLabel("Other-event search workspace");
      await expect(coevents).toContainText(
        "Inspect the search boundary before retrieval",
      );
      await coevents.getByLabel(/Look back before the study window/iu).fill("2");
      await coevents.getByLabel("Known co-events").fill(
        "Regional capacity auction redesign",
      );
      await coevents.getByLabel("Important regulators").fill(
        "Regional market commission",
      );
      await coevents.getByLabel("Important markets").fill(
        "Regional capacity market",
      );
      await coevents.getByRole("button", {
        name: "Save deterministic search matrix",
      }).click();
      const searchMatrix = coevents.locator(".six-search-matrix");
      await expect(searchMatrix.getByRole("heading", {
        name: "6 substantive branches",
      })).toBeVisible();
      await expect(searchMatrix).toContainText("comparison spillover");
      await expect(searchMatrix).toContainText(
        "treatment: Covered market operators",
      );
      await expect(searchMatrix).toContainText(
        "comparison: Otherwise comparable uncovered market operators",
      );
      await expect(searchMatrix).toContainText("availability not checked");
      await expect(searchMatrix).toContainText("Retrieval has not run");
      await expect(searchMatrix).toContainText("not an executed search");
      await searchMatrix.getByRole("button", {
        name: "Run next bounded provider step",
      }).click();
      await expectMatrixTextWithDiagnostics({
        page,
        issues,
        searchMatrix,
        expected: "Provider plan",
      });
      await expect(searchMatrix).toContainText("Actual search boundary");
      await expect(searchMatrix).toContainText("1 processed");
      const providerOutcomes = coevents.locator(".six-coevent-results").first();
      await expect(providerOutcomes).toContainText("Outage is not no match");
      await expect(providerOutcomes).toContainText("federal register");
      await expect(providerOutcomes).toContainText("source unavailable");
      await expect(coevents).toContainText(
        "Automated semantic causal-relation analysis is unavailable",
      );

      await page.evaluate(() => {
        (
          window as unknown as {
            __shockAuditRemount: (entries: unknown[]) => void;
          }
        ).__shockAuditRemount([]);
      });
      await expect.poll(() =>
        page.evaluate(() =>
          (
            window as unknown as {
              __shockAuditHostState: { initializedMounts: number[] };
            }
          ).__shockAuditHostState.initializedMounts.length
        )
      ).toBe(4);
      await expect(app.getByRole("heading", {
        name: "4. Check other events",
      })).toBeVisible();
      await expect(app.getByLabel("Other-event search workspace"))
        .toContainText("6 substantive branches");
      await expect(app.getByLabel("Other-event search workspace"))
        .toContainText("source unavailable");
      await expect(app.getByLabel("Other-event search workspace")
        .getByRole("button", { name: "Run next bounded provider step" }))
        .toBeVisible();

      const restoredCoevents = app.getByLabel(
        "Other-event search workspace",
      );
      await restoredCoevents.getByRole("button", {
        name: "Run next bounded provider step",
      }).click();
      await expect(restoredCoevents.getByLabel("Actual search boundary"))
        .toContainText("2 processed");
      const occurrenceResults = restoredCoevents.locator(
        ".six-coevent-candidates",
      );
      await expect(occurrenceResults.locator("article")).toHaveCount(2);
      const reviewedOccurrence = occurrenceResults.locator("article").filter({
        hasText: "Capacity Market Reliability Implementation Rule",
      });
      await expect(reviewedOccurrence).toContainText(
        "does not establish exposure, relevance to the comparison",
      );
      await reviewedOccurrence.getByText(
        "Review this occurrence record",
        { exact: true },
      ).click();
      await reviewedOccurrence.getByLabel(/Occurrence decision/iu)
        .selectOption("corrected");
      await reviewedOccurrence.getByLabel("Corrected title").fill(
        "Researcher-corrected Capacity Market Reliability Rule",
      );
      await reviewedOccurrence.getByLabel("Corrected date kind")
        .selectOption("effective");
      await reviewedOccurrence.getByRole("textbox", {
        name: "Corrected date",
        exact: true,
      }).fill(
        "2021-07-21",
      );
      await reviewedOccurrence.getByLabel(/Researcher rationale/iu).fill(
        "Preserve this researcher correction beside the immutable provider metadata.",
      );
      await reviewedOccurrence.getByRole("button", {
        name: "Save occurrence review",
      }).click();
      await expect(reviewedOccurrence).toContainText(
        "Researcher-supplied correction",
      );
      await expect(reviewedOccurrence).toContainText(
        "Researcher-corrected Capacity Market Reliability Rule",
      );
      const relationReview = reviewedOccurrence.locator(
        ".six-coevent-relation-controls",
      );
      await relationReview.getByText(
        "Classify relation to the comparison",
        { exact: true },
      ).click();
      await relationReview.getByLabel(/Relation decision/iu)
        .selectOption("retained");
      await relationReview.getByLabel(/Relation category/iu)
        .selectOption("independent_concurrent_event");
      await relationReview.getByLabel(/Priority/iu).selectOption("high");
      await relationReview.getByLabel(/Potentially affected comparison side/iu)
        .selectOption("both");
      await relationReview.getByLabel(
        /Plausible pathway to the study outcome/iu,
      ).fill(
        "The capacity-market implementation could independently change investment and participation during the study period.",
      );
      await relationReview.getByLabel(
        /Why relevance could differ across the comparison/iu,
      ).fill(
        "Covered and comparison operators may participate in different capacity-market segments with unequal exposure.",
      );
      await relationReview.getByLabel("Assumptions").fill(
        "market segments are measured historically",
      );
      await relationReview.getByLabel("Unresolved questions").fill(
        "which operators were exposed before treatment",
      );
      await relationReview.getByLabel(/Proposed responses/iu).fill(
        "obtain historical market-segment exposure, retain a limitation",
      );
      await relationReview.getByLabel(/Researcher rationale/iu).fill(
        "Retain this as an independent concurrent-event concern pending historical exposure evidence.",
      );
      await relationReview.getByRole("button", {
        name: "Save relation judgment",
      }).click();
      await expect(relationReview).toContainText(
        "independent concurrent event",
      );
      await expect(relationReview).toContainText("semantic assistance not used");

      const duplicateReview = restoredCoevents.locator(
        ".six-coevent-duplicate-review",
      );
      await expect(duplicateReview.getByRole("heading", {
        name: "Duplicate and policy-stage review",
      })).toBeVisible();
      await duplicateReview.getByLabel(/Record relationship/iu)
        .selectOption("distinct_stage");
      await duplicateReview.getByLabel(/Researcher rationale/iu).fill(
        "Link the rule and implementation notice as distinct stages without collapsing either record.",
      );
      await duplicateReview.getByRole("button", {
        name: "Save duplicate/stage review",
      }).click();
      await duplicateReview.getByText(/saved pair decision/iu).click();
      await expect(duplicateReview).toContainText("distinct stage");
      await expect(duplicateReview).toContainText("both records retained");

      await page.evaluate(() => {
        (
          window as unknown as {
            __shockAuditRemount: (entries: unknown[]) => void;
          }
        ).__shockAuditRemount([]);
      });
      await expect.poll(() =>
        page.evaluate(() =>
          (
            window as unknown as {
              __shockAuditHostState: { initializedMounts: number[] };
            }
          ).__shockAuditHostState.initializedMounts.length
        )
      ).toBe(5);
      const persistedCoevents = app.getByLabel("Other-event search workspace");
      const persistedOccurrence = persistedCoevents
        .locator(".six-coevent-candidates article")
        .filter({
          hasText: "Capacity Market Reliability Implementation Rule",
        });
      await persistedOccurrence.getByText(
        "Review this occurrence record",
        { exact: true },
      ).click();
      await expect(persistedOccurrence).toContainText(
        "Researcher-corrected Capacity Market Reliability Rule",
      );
      const persistedRelation = persistedOccurrence.locator(
        ".six-coevent-relation-controls",
      );
      await persistedRelation.getByText(
        "Classify relation to the comparison",
        { exact: true },
      ).click();
      await expect(persistedRelation).toContainText(
        "independent concurrent event",
      );
      await expect(persistedRelation).toContainText(
        "Researcher-authored revision 1",
      );
      await expect(persistedCoevents.locator(
        ".six-coevent-duplicate-review",
      )).toContainText("1 saved pair decision");

      const lifecycleControls = persistedOccurrence.locator(
        ".six-coevent-lifecycle-controls",
      );
      await lifecycleControls.getByText(
        "Could this belong to the focal policy lifecycle?",
        { exact: true },
      ).click();
      await lifecycleControls.getByLabel(/Possible focal-policy stage/iu)
        .selectOption("implementation_delay");
      await lifecycleControls.getByLabel(
        /Why this may be part of the focal policy/iu,
      ).fill(
        "The implementation record may represent a later focal-policy stage that changes the operative timeline.",
      );
      await lifecycleControls.getByRole("button", {
        name: "Send possible policy stage to Screen 2",
      }).click();

      await expect(app.getByRole("heading", {
        name: "2. Understand the policy",
      })).toBeVisible();
      const lifecyclePanel = app.getByLabel(
        "Possible focal-policy lifecycle handoffs",
      );
      await expect(lifecyclePanel.getByRole("heading", {
        name: "Review possible stages of the focal policy",
      })).toBeVisible();
      await expect(lifecyclePanel).toContainText(
        "Researcher proposed · not verified",
      );
      await expect(lifecyclePanel).toContainText(
        "The prior Event Card and source occurrence remain unchanged",
      );
      await expect(lifecyclePanel).toContainText(
        "Capacity Market Reliability Implementation Rule",
      );
      await expect(lifecyclePanel).toContainText(
        "Researcher-supplied occurrence correction",
      );
      await expect(lifecyclePanel).toContainText(
        "Researcher-corrected Capacity Market Reliability Rule",
      );
      await expect(lifecyclePanel).toContainText(
        "does not create an independent co-event or assess comparison-specific causal relevance",
      );
      await expect(lifecyclePanel.getByRole("link", {
        name: /Federal Energy Regulatory Commission/iu,
      })).toHaveAttribute(
        "href",
        "https://www.federalregister.gov/documents/2021/06/21/2021-54321/example",
      );
      await expect(app.locator(".six-event-review .six-review-status"))
        .toHaveText("pending revision");
      await expect(app.locator(".six-steps button").filter({
        hasText: "Suggested Approach",
      })).toBeDisabled();
      await expect(app.locator(".six-steps button").filter({
        hasText: "Check other events",
      })).toBeDisabled();

      const handoffStatus = await callTool(
        "get_six_screen_workflow_v1",
        authentication,
      );
      expect(handoffStatus.structuredContent).toMatchObject({
        activeScreen: 2,
        canOpenScreen3: false,
        canOpenScreen4: false,
        coEventSearchWorkspace: {
          matrix: null,
          execution: null,
          policyLifecycleHandoffs: [expect.objectContaining({
            targetReviewStatus: "pending_event_card_review",
            handoff: expect.objectContaining({
              proposedStage: {
                kind: "implementation_delay",
                status: "researcher_proposed_for_review",
              },
              independentEventClassification: "not_assessed",
            }),
          })],
        },
      });
      const handoffPrivate = resultMetadata(handoffStatus)[
        SIX_SCREEN_WORKFLOW_META_KEY
      ] as {
        state: {
          coEventCandidates: unknown[];
          coEventPolicyLifecycleHandoffs: unknown[];
          policyEventCardReviews: Array<{
            ordinal: number;
            status: string;
            lockedEventCard: unknown;
          }>;
          policyLifecycleStageDocumentAcquisitions?: unknown[];
          policyLifecycleStageDispositions?: unknown[];
          policyLifecycleStageRevisionProposals?: unknown[];
          policyLifecycleStageRevisionReviews?: unknown[];
          artifacts: unknown[];
        };
      };
      expect(handoffPrivate.state.coEventCandidates).toHaveLength(2);
      expect(handoffPrivate.state.coEventPolicyLifecycleHandoffs).toHaveLength(1);
      expect(handoffPrivate.state.policyEventCardReviews.at(-1)).toMatchObject({
        ordinal: 3,
        status: "in_review",
        lockedEventCard: null,
      });
      const targetReviewBeforeStageDocument = structuredClone(
        handoffPrivate.state.policyEventCardReviews.at(-1),
      );
      const artifactsBeforeStageDocument = structuredClone(
        handoffPrivate.state.artifacts,
      );

      const officialDocumentPanel = lifecyclePanel.getByLabel(
        "Official document review for Capacity Market Reliability Implementation Rule",
      );
      await officialDocumentPanel.getByRole("button", {
        name: "Acquire official stage document",
      }).click();
      await expect(officialDocumentPanel).toContainText(
        "Immutable official document",
      );
      await expect(officialDocumentPanel).toContainText(
        "Federal Register 2021-54321",
      );
      await expect(officialDocumentPanel).toContainText(
        "exact identifier found",
      );
      await expect(officialDocumentPanel).toContainText("2020-12345");
      await expect(officialDocumentPanel).toContainText(
        "This saves a researcher decision only. It does not change chronology",
      );

      const stageDisposition = officialDocumentPanel.getByLabel(
        "Possible stage document disposition",
      );
      await stageDisposition.getByLabel(/Researcher disposition/iu)
        .selectOption("accepted_for_event_card_review");
      await stageDisposition.getByLabel(/Reason for this disposition/iu).fill(
        "The exact focal-policy identifier appears in the retained official passage; accept it for later Event Card review without changing the card yet.",
      );
      await stageDisposition.getByRole("button", {
        name: "Save stage-document disposition",
      }).click();
      await expect(officialDocumentPanel).toContainText(
        "Latest researcher disposition",
      );
      await expect(officialDocumentPanel).toContainText(
        "accepted for event card review",
      );
      await expect(officialDocumentPanel).toContainText(
        "Researcher decision—not legal verification",
      );

      const stageStatus = await callTool(
        "get_six_screen_workflow_v1",
        authentication,
      );
      expect(stageStatus.structuredContent).toMatchObject({
        activeScreen: 2,
        canOpenScreen3: false,
        canOpenScreen4: false,
        policyLifecycleStageReviewWorkspace: null,
      });
      expect(resultMetadata(stageStatus)[
        SIX_SCREEN_POLICY_LIFECYCLE_STAGE_WORKSPACE_META_KEY
      ]).toMatchObject({
        entries: [expect.objectContaining({
          canAcquire: false,
          canRetry: false,
          canDispose: true,
          canProposeRevision: true,
          canReviewRevision: false,
          latestAcquisition: expect.objectContaining({
            outcome: "document_retained",
            chronologyMutation: "none",
            eventCardMutation: "none",
            source: expect.objectContaining({
              nativeDocumentNumber: "2021-54321",
              focalPolicyReferenceStatus: "exact_identifier_found",
            }),
          }),
          latestDisposition: expect.objectContaining({
            decision: "accepted_for_event_card_review",
            chronologyMutation: "none",
            eventCardMutation: "none",
          }),
        })],
      });
      const stagePrivate = resultMetadata(stageStatus)[
        SIX_SCREEN_WORKFLOW_META_KEY
      ] as typeof handoffPrivate;
      expect(stagePrivate.state.policyLifecycleStageDocumentAcquisitions)
        .toHaveLength(1);
      expect(stagePrivate.state.policyLifecycleStageDispositions)
        .toHaveLength(1);
      expect(stagePrivate.state.policyEventCardReviews.at(-1)).toEqual(
        targetReviewBeforeStageDocument,
      );
      expect(stagePrivate.state.artifacts).toEqual(
        artifactsBeforeStageDocument,
      );

      const stageProposal = officialDocumentPanel.getByLabel(
        "Lifecycle-stage chronology proposal",
      );
      await expect(stageProposal).toContainText(
        "Propose one chronology stage for later review",
      );
      await stageProposal.getByLabel(/Chronology stage/iu)
        .selectOption("implementation");
      await stageProposal.getByLabel(/Exact source date to preserve/iu)
        .selectOption({ label: "publication · 2021-06-21" });
      await stageProposal.getByLabel(
        /Why this document supports the proposed stage/iu,
      ).fill(
        "The retained publication-dated document supports a separate implementation-stage proposal without retyping the source date.",
      );
      await stageProposal.getByRole("button", {
        name: "Save immutable stage proposal",
      }).click();
      await expect(officialDocumentPanel).toContainText(
        "Immutable lifecycle-stage proposal",
      );
      await expect(officialDocumentPanel).toContainText(
        "source date type: publication",
      );
      await expect(officialDocumentPanel).toContainText(
        "chronology and Event Card unchanged",
      );

      const proposalStatus = await callTool(
        "get_six_screen_workflow_v1",
        authentication,
      );
      const proposalPrivate = resultMetadata(proposalStatus)[
        SIX_SCREEN_WORKFLOW_META_KEY
      ] as typeof handoffPrivate;
      expect(proposalPrivate.state.policyLifecycleStageRevisionProposals)
        .toHaveLength(1);
      expect(proposalPrivate.state.policyLifecycleStageRevisionReviews)
        .toHaveLength(0);
      expect(proposalPrivate.state.policyEventCardReviews.at(-1)).toEqual(
        targetReviewBeforeStageDocument,
      );
      expect(proposalPrivate.state.artifacts).toEqual(
        artifactsBeforeStageDocument,
      );

      const stageProposalReview = officialDocumentPanel.getByLabel(
        "Lifecycle-stage proposal review",
      );
      await stageProposalReview.getByLabel(/Separate proposal decision/iu)
        .selectOption("accepted_for_event_card_revision");
      await stageProposalReview.getByLabel(
        /Reason for this proposal decision/iu,
      ).fill(
        "Accept the source-bound proposal only for inclusion by the later explicit Event Card lock.",
      );
      await stageProposalReview.getByRole("button", {
        name: "Save proposal decision",
      }).click();
      await expect(officialDocumentPanel).toContainText(
        "Latest proposal decision",
      );
      await expect(officialDocumentPanel).toContainText(
        "Accepted content enters only through an explicit lock",
      );

      const reviewedProposalStatus = await callTool(
        "get_six_screen_workflow_v1",
        authentication,
      );
      const reviewedProposalPrivate = resultMetadata(reviewedProposalStatus)[
        SIX_SCREEN_WORKFLOW_META_KEY
      ] as typeof handoffPrivate;
      expect(reviewedProposalPrivate.state.policyLifecycleStageRevisionReviews)
        .toHaveLength(1);
      expect(reviewedProposalPrivate.state.policyEventCardReviews.at(-1))
        .toEqual(targetReviewBeforeStageDocument);
      expect(reviewedProposalPrivate.state.artifacts).toEqual(
        artifactsBeforeStageDocument,
      );

      const lifecycleReviewPanel = app.locator(".six-event-review");
      await decideClaims(lifecycleReviewPanel, {
        correctedSourceStatement: null,
        rationalePrefix: "Lifecycle revision rechecked",
      });
      await saveNoTreatmentClock(
        lifecycleReviewPanel,
        "The accepted lifecycle-stage proposal does not automatically establish the study treatment clock.",
      );
      await lockReview(
        lifecycleReviewPanel,
        "Lock revision three and explicitly include the separately accepted lifecycle-stage proposal.",
      );
      await expect(lifecycleReviewPanel.getByRole("heading", {
        name: "Event Card revision 3 is locked",
      })).toBeVisible();
      await expect(lifecycleReviewPanel.locator(".six-locked-card"))
        .toContainText("1 accepted lifecycle-stage revision");
      await expect(lifecycleReviewPanel.locator(".six-locked-card"))
        .toContainText("Implementation review");

      const lockedStageStatus = await callTool(
        "get_six_screen_workflow_v1",
        authentication,
      );
      const lockedStageWorkspace = resultMetadata(lockedStageStatus)[
        SIX_SCREEN_POLICY_EVENT_CARD_WORKSPACE_META_KEY
      ] as {
        activeReview: {
          lockedEventCard: {
            lifecycleStageRevisions: Array<{
              sourceDateId: string;
              sourceTypedDate: { start: string; kind: string };
              clock: { stage: string; timing: { start: string } };
              inclusionStatus: string;
            }>;
          };
        };
      };
      expect(lockedStageWorkspace.activeReview.lockedEventCard
        .lifecycleStageRevisions).toEqual([
          expect.objectContaining({
            sourceDateId: expect.any(String),
            sourceTypedDate: expect.objectContaining({
              start: "2021-06-21",
              kind: "publication",
            }),
            clock: expect.objectContaining({
              stage: "implementation",
              timing: expect.objectContaining({ start: "2021-06-21" }),
            }),
            inclusionStatus: "included_by_explicit_event_card_lock",
          }),
        ]);

      await page.evaluate(() => {
        (
          window as unknown as {
            __shockAuditRemount: (entries: unknown[]) => void;
          }
        ).__shockAuditRemount([]);
      });
      await expect.poll(() =>
        page.evaluate(() =>
          (
            window as unknown as {
              __shockAuditHostState: { initializedMounts: number[] };
            }
          ).__shockAuditHostState.initializedMounts.length
        )
      ).toBe(6);
      await expect(app.getByRole("heading", {
        name: "2. Understand the policy",
      })).toBeVisible();
      await expect(app.getByLabel(
        "Possible focal-policy lifecycle handoffs",
      )).toContainText("accepted for event card review");
      await expect(app.getByLabel(
        "Possible focal-policy lifecycle handoffs",
      )).toContainText("2020-12345");
      await expect(app.getByRole("heading", {
        name: "Event Card revision 3 is locked",
      })).toBeVisible();
      await expect(app.locator(".six-event-review .six-review-status"))
        .toHaveText("current");
      await expect(app.locator(".six-locked-card"))
        .toContainText("1 accepted lifecycle-stage revision");

      const screen4Mutations = await page.evaluate(() =>
        (
          window as unknown as {
            __shockAuditHostState: {
              toolCalls: Array<{
                arguments: { mutation?: Record<string, unknown> };
              }>;
            };
          }
        ).__shockAuditHostState.toolCalls
          .map(({ arguments: args }) => args.mutation?.action)
          .filter((action) =>
            action === "open_screen_4" ||
            action === "save_coevent_search_matrix" ||
            action === "continue_coevent_search" ||
            action === "review_coevent_occurrence" ||
            action === "review_coevent_duplicate_pair" ||
            action === "route_coevent_policy_stage_to_screen_2"
          )
      );
      expect(screen4Mutations).toEqual([
        "open_screen_4",
        "save_coevent_search_matrix",
        "continue_coevent_search",
        "continue_coevent_search",
        "review_coevent_occurrence",
        "review_coevent_duplicate_pair",
        "route_coevent_policy_stage_to_screen_2",
      ]);

      const lifecycleStageMutations = await page.evaluate(() =>
        (
          window as unknown as {
            __shockAuditHostState: {
              toolCalls: Array<{
                arguments: { mutation?: Record<string, unknown> };
              }>;
            };
          }
        ).__shockAuditHostState.toolCalls
          .map(({ arguments: args }) => args.mutation?.action)
          .filter((action) =>
            action === "acquire_policy_lifecycle_stage_document" ||
            action === "review_policy_lifecycle_stage_document" ||
            action === "propose_policy_lifecycle_stage_revision" ||
            action === "review_policy_lifecycle_stage_revision"
          )
      );
      expect(lifecycleStageMutations).toEqual([
        "acquire_policy_lifecycle_stage_document",
        "review_policy_lifecycle_stage_document",
        "propose_policy_lifecycle_stage_revision",
        "review_policy_lifecycle_stage_revision",
      ]);

      const reviewMutations = await page.evaluate(() =>
        (
          window as unknown as {
            __shockAuditHostState: {
              toolCalls: Array<{
                name: string;
                arguments: {
                  mutation?: Record<string, unknown>;
                };
              }>;
            };
          }
        ).__shockAuditHostState.toolCalls.filter(
          ({ arguments: args }) =>
            (typeof args.mutation?.action === "string" &&
              String(args.mutation.action).includes("policy_event_card")) ||
            args.mutation?.action === "decide_policy_treatment_clock",
        )
      );
      expect(reviewMutations.length).toBeGreaterThan(0);
      expect(reviewMutations.every(({ arguments: args }) =>
        !Object.prototype.hasOwnProperty.call(args.mutation ?? {}, "projection")
      )).toBe(true);
      expect(issues).toEqual({ consoleErrors: [], pageErrors: [] });
    } finally {
      await client.close();
      await server.close();
    }
  },
);
