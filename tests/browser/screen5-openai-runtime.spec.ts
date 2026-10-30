import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { McpServer } from "@modelcontextprotocol/server";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Server } from "node:http";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import {
  openScreen3,
  openScreen4,
  openScreen5,
  type StudyContextDraft,
} from "../../src/core/six-screen/workflow";
import {
  SCREEN5_OPENAI_MODEL,
} from "../../src/core/six-screen/screen5-mechanism";
import { Screen5OpenAILedgerStore } from
  "../../src/worker/screen5-openai-ledger";
import { SCREEN5_OPENAI_PLANNING_TEXT_FORMAT } from
  "../../src/worker/screen5-openai-provider";
import { SCREEN5_OPENAI_RESPONSES_URL } from
  "../../src/worker/screen5-openai-transport";
import { registerSixScreenWorkflowTools } from
  "../../src/worker/six-screen-tools";
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
  browserEventCardFixtureAccessToken as accessToken,
  browserEventCardFixtureCreatedAt,
  browserEventCardFixtureRunId as runId,
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

const study: StudyContextDraft = {
  population: "U.S. public manufacturers",
  analysisUnit: "firm-year",
  geography: ["United States", "California"],
  industry: ["Manufacturing"],
  period: { start: "2010", end: "2022" },
  outcome: "Firm performance",
  outcomeMeasure: "Return on assets",
  intendedConstruct: "Organizational performance",
  policySideConcept: "Customer protection increases",
  initialExplanation: "It reduces firms’ access to customer data.",
  proposedTreatment: "California firms",
  proposedComparison: "Non-California firms",
  resultsPreviouslyInspected: "not_disclosed",
};

const testCitation = {
  authors: ["Synthetic Test Author"],
  year: 2024,
  title: "Synthetic mechanism fixture",
  venue: "Synthetic Test Journal",
  volume: null,
  issue: null,
  pages: null,
  doi: null,
  url: null,
  full_citation:
    "Synthetic Test Author (2024). Synthetic mechanism fixture. Synthetic Test Journal.",
  supports: "Synthetic evidence for contract tests only.",
};

const planWire = {
  focal_citations: [testCitation],
  candidates: [{
    candidate_id: "cost-reallocation",
    concept: "Compliance-resource reallocation",
    chain: ["New duties", "Staff effort", "Operating costs"],
    difference: "Costs can change without reduced customer-data access.",
    condition: "Implementation requires material firm effort.",
    evidence_need: "Whether privacy obligations increase operating effort.",
    terms: ["privacy regulation", "compliance cost"],
  }, {
    candidate_id: "customer-trust",
    concept: "Customer trust",
    chain: ["Privacy controls", "Perceived protection", "Retention"],
    difference: "Trust can change without acquisition-data efficiency.",
    condition: "Customers notice and value privacy control.",
    evidence_need: "Whether perceived privacy control changes retention.",
    terms: ["privacy control", "customer trust", "retention"],
  }, {
    candidate_id: "privacy-risk",
    concept: "Privacy-risk and loss exposure",
    chain: ["Privacy practices", "Incident exposure", "Legal losses"],
    difference: "Expected losses can change without customer-data access changing.",
    condition: "The policy materially changes incident or dispute exposure.",
    evidence_need: "Whether privacy controls alter firm loss exposure.",
    terms: ["privacy risk", "legal loss", "incident exposure"],
  }, {
    candidate_id: "authorization-friction",
    concept: "Authorization friction and product delay",
    chain: ["Consent steps", "Testing friction", "Delayed launches"],
    difference: "Product timing can change while customer knowledge stays constant.",
    condition: "Products depend on affected personal-data uses.",
    evidence_need: "Whether consent requirements delay product activity.",
    terms: ["privacy consent", "product delay", "testing"],
  }].map((candidate, index) => ({
    ...candidate,
    citations: [testCitation],
    direction: {
      mode: "single_hypothesis",
      target_outcome: "Firm performance",
      target_measure: "Return on assets",
      scenarios: [{
        sign: index === 1 ? "positive" : "negative",
        condition: candidate.condition,
        rationale: index === 1
          ? "If customers value the privacy change, retention may improve measured performance."
          : "If the process imposes net firm costs, it may reduce measured performance.",
        intermediate_movement: candidate.concept,
        horizon: null,
      }],
      missing_assumption: null,
    },
  })),
  open_xy_terms: ["customer protection", "firm performance"],
  challenge_terms: ["privacy regulation", "boundary condition"],
  qualification: "The policy-to-construct link remains proposed.",
};

const comparisonWire = {
  mechanisms: [{
    candidate_id: "m0",
    concept: "Restricted customer-data access",
    relation: "focal",
    chain: [
      "Customer protection",
      "Reduced customer-data access",
      "Changed acquisition activity",
      "Firm performance",
    ],
    direction: {
      mechanism_response: "decrease",
      outcome_implication: "uncertain",
      basis: "researcher_proposed",
      condition: "Restricted data changes acquisition activity.",
    },
    argument: [{
      text: "The focal chain preserves the researcher’s proposed process; the saved citation lead remains unverified.",
      evidence_ids: [],
      basis: "analytical_hypothesis",
    }],
    fit: "The pathway is stated at the firm-year level used by the study.",
    limit: "No scholarly passage was inspected in this bounded fixture.",
    theory: null,
    theory_basis: "not_assigned",
  }],
  row_definitions: [{
    row_id: "privacy-costs",
    observation: "Privacy-related costs and hiring",
    measure: "Dated privacy staffing and operating records",
    level: "Firm-year",
    timing: "Near the adjustment year",
    caution: "Shared operating changes would not distinguish the pathways.",
  }, {
    row_id: "customer-trust",
    observation: "Customer trust and retention",
    measure: "Direct trust measure or retention rate",
    level: "Customer or firm-period",
    timing: "After customers perceive the protection change",
    caution: "A shared response would not establish mediation.",
  }],
  cells: [
    ["privacy-costs", "m0", "No unique increase is required by reduced data access."],
    ["customer-trust", "m0", "No unique improvement is required by restricted data access."],
  ].map(([row_id, candidate_id, text]) => ({
    row_id,
    candidate_id,
    status: "prediction",
    text,
    evidence_ids: [],
  })),
  dispositions: [{
    candidate_id: "cost-reallocation",
    status: "unassessed_evidence",
    reason: "The process is distinct, but no admitted inspected source supports a proposition on this pathway.",
    merged_into: null,
  }, {
    candidate_id: "customer-trust",
    status: "unassessed_evidence",
    reason: "The process is distinct, but no admitted inspected source supports a proposition on this pathway.",
    merged_into: null,
  }],
  summary:
    "The pathways can coexist; intermediate timing and outcomes are more discriminating than final performance alone.",
  gaps: ["No inspected source tests these mechanisms in the proposed sample."],
};

const laterComparisonWire = {
  mechanisms: [],
  row_definitions: [],
  cells: [],
  dispositions: [{
    candidate_id: "privacy-risk",
    status: "unassessed_evidence",
    reason: "The process is distinct, but no admitted inspected source supports a proposition on this pathway.",
    merged_into: null,
  }, {
    candidate_id: "authorization-friction",
    status: "unassessed_evidence",
    reason: "The process is distinct, but no admitted inspected source supports a proposition on this pathway.",
    merged_into: null,
  }],
  summary:
    "The later bounded batch preserves both remaining hypotheses without claiming inspected support.",
  gaps: ["No inspected source tests these mechanisms in the proposed sample."],
};

function sourceResponse(url: string) {
  if (url.includes("api.openalex.org")) {
    return new Response(JSON.stringify({
      meta: { count: 1 },
      results: [{
        id: "https://openalex.org/W1234567890",
        doi: "https://doi.org/10.1234/ROUTING.1",
        display_name: "Privacy controls, data access, and customer trust",
        authorships: [{ author: { display_name: "Ada Researcher" } }],
        publication_year: 2022,
        publication_date: "2022-01-01",
        primary_location: {
          is_oa: true,
          landing_page_url: "https://journal.example/routing",
          pdf_url: null,
          version: "publishedVersion",
          license: "cc-by",
          source: {
            display_name: "Journal of Privacy Research",
            type: "journal",
            host_organization_name: "Research Publisher",
          },
        },
        best_oa_location: null,
        type: "article",
        language: "en",
        is_retracted: false,
        abstract_inverted_index: {
          Privacy: [0], controls: [1], alter: [2], data: [3], access: [4],
          customer: [5], trust: [6], and: [7], retention: [8],
        },
        content_urls: { pdf: null, grobid_xml: null },
      }],
    }), { headers: { "content-type": "application/json" } });
  }
  return new Response(JSON.stringify({
    message: { items: [{
      DOI: "10.1234/routing.1",
      title: ["Privacy controls, data access, and customer trust"],
      author: [{ given: "Ada", family: "Researcher" }],
      publisher: "Research Publisher",
      "container-title": ["Journal of Privacy Research"],
      "published-online": { "date-parts": [[2022, 1, 1]] },
      type: "journal-article",
      URL: "https://doi.org/10.1234/routing.1",
      abstract:
        "<jats:p>Privacy controls may alter data access, customer trust, and retention.</jats:p>",
    }] },
  }), { headers: { "content-type": "application/json" } });
}

test("same saved host run automatically reconciles a lost response and renders mechanisms", async ({
  page,
}, testInfo) => {
  const fixture = createBrowserEventCardFixture();
  const screen3 = openScreen3(fixture.state, {
    expectedRevision: fixture.state.revision,
    study,
    proposedTiming: { mode: "year", year: 2020, milestoneReference: null },
    openedAt: "2026-09-21T20:00:00.000Z",
  });
  const screen4 = openScreen4(screen3.state, {
    expectedRevision: screen3.state.revision,
    openedAt: "2026-09-21T20:00:01.000Z",
  });
  const screen5 = openScreen5(screen4.state, {
    expectedRevision: screen4.state.revision,
    openedAt: "2026-09-21T20:00:02.000Z",
  });
  const storage = new InMemorySixScreenWorkflowStorage();
  const store = new SixScreenWorkflowStore(storage);
  await store.create({
    state: screen5.state,
    accessToken,
    createInputFingerprint: fingerprintSixScreenValue("screen5-routing-browser"),
    createdAt: browserEventCardFixtureCreatedAt,
    expiresAt: "2026-09-24T00:00:00.000Z",
  });
  const mechanism = "It reduces firms’ access to customer data.";
  const hostRuntime = new SixScreenWorkflowRuntime({
    store,
    signingKey: "screen5-routing-browser-signing-key-more-than-32-bytes",
    now: () => "2026-09-21T20:00:03.000Z",
    fetch: async () => new Response(null, { status: 503 }),
    screen5OpenAIMode: "off",
  });
  const hostSaved = await hostRuntime.compareStudyFirstMechanisms(
    { runId, accessToken },
    {
      expectedRevision: screen5.state.revision,
      operationId: "browser-save-legacy-host-run",
      theoreticalPerspective: null,
      proposedMechanism: mechanism,
    },
  );
  const hostRun = hostSaved.projection.studyFirstMechanismWorkspace.currentRun!;
  const jobId = hostRun.providerExecution!.id;
  let providerCalls = 0;
  const providerFetch = async (url: RequestInfo | URL, init?: RequestInit) => {
    providerCalls += 1;
    expect(String(url)).toBe(SCREEN5_OPENAI_RESPONSES_URL);
    expect(init?.method).toBe("POST");
    const body = JSON.parse(String(init?.body)) as {
      model: string;
      reasoning: { effort: string };
      service_tier: string;
      store: boolean;
      text: { format: { name: string } };
    };
    expect(body).toMatchObject({
      model: "gpt-6-luna",
      reasoning: { effort: "medium" },
      service_tier: "default",
      store: false,
    });
    const planning = body.text.format.name ===
      SCREEN5_OPENAI_PLANNING_TEXT_FORMAT.name;
    const assessmentWire = providerCalls === 2
      ? comparisonWire
      : providerCalls === 3
        ? laterComparisonWire
        : null;
    if (!planning && !assessmentWire) {
      throw new Error(
        "The browser fixture dispatched an unexpected extra assessment batch.",
      );
    }
    const requestId = planning ? "browser-stage-a" : "browser-stage-b";
    const inputTokens = planning ? 900 : 1_800;
    const outputTokens = planning ? 500 : 1_000;
    return new Response(JSON.stringify({
      id: `resp_${requestId}`,
      object: "response",
      status: "completed",
      model: SCREEN5_OPENAI_MODEL,
      service_tier: "default",
      output: [{
        id: `msg_${requestId}`,
        type: "message",
        role: "assistant",
        status: "completed",
        content: [{
          type: "output_text",
          annotations: [],
          text: JSON.stringify(planning ? planWire : assessmentWire),
        }],
      }],
      usage: {
        input_tokens: inputTokens,
        input_tokens_details: { cached_tokens: 0 },
        output_tokens: outputTokens,
        output_tokens_details: { reasoning_tokens: 0 },
        total_tokens: inputTokens + outputTokens,
      },
    }), {
      headers: {
        "content-type": "application/json",
        "x-request-id": requestId,
        "x-ratelimit-reset-tokens": "1s",
        "x-ratelimit-remaining-tokens": planning ? "3000" : "1000",
      },
    });
  };
  let clock = Date.parse("2026-09-22T00:00:00.000Z");
  let sourceCalls = 0;
  const directRuntime = new SixScreenWorkflowRuntime({
    store,
    signingKey: "screen5-routing-browser-signing-key-more-than-32-bytes",
    now: () => {
      const value = new Date(clock).toISOString();
      clock += 70_000;
      return value;
    },
    fetch: async (request) => {
      sourceCalls += 1;
      return sourceResponse(String(request));
    },
    screen5OpenAIMode: "local-preview",
    screen5OpenAIApiKey: "browser-test-key-never-projected",
    screen5OpenAIFetch: providerFetch,
    screen5OpenAILedgerStore: new Screen5OpenAILedgerStore(storage),
    screen5OpenAIAuthorization: {
      authorizationId: "browser-controlled-two-stage-ticket",
      jobId,
      stages: ["planning", "assessment"],
    },
  });
  const server = new McpServer(
    { name: "screen5-routing-browser", version: "1.0.0" },
    { instructions: "Controlled zero-network Screen 5 routing fixture." },
  );
  registerSixScreenWorkflowTools(server, directRuntime);
  const client = new Client({
    name: "screen5-routing-browser-client",
    version: "1.0.0",
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  let hostMessageRequests = 0;

  try {
    let lostStageADelivery = false;
    const callTool = async (name: string, args: JsonObject) => {
      const result = await client.callTool({ name, arguments: args }) as McpCallToolResult;
      if (name === "mutate_six_screen_workflow_v1" &&
          (args.mutation as JsonObject | undefined)?.action ===
            "advance_study_first_mechanism_job") {
        if (!lostStageADelivery) {
          // The real registered mutation committed its receipt and proposal;
          // only final delivery from the simulated host is interrupted.
          lostStageADelivery = true;
          throw new Error("Controlled network response lost after durable server commit");
        }
      }
      return result;
    };
    const initialPrivate = (await directRuntime.status({
      runId,
      accessToken,
    })).privateSnapshot;
    await installMcpAppHost(page, {
      appUrl: `${baseUrl}/`,
      initialToolNotifications: [],
      installChatGptCompatibilityBridge: true,
      representativeHostShell: {
        heightPx: 900,
        composerHeightPx: 112,
        safeAreaBottomPx: 0,
      },
      hostContext: { theme: "dark" },
      initialCompatibilityWidgetState: {
        modelContent: "ShockAudit Screen 5 routing fixture.",
        privateContent: { sixScreenWorkflow: initialPrivate },
      },
      hostModelResponder: () => {
        hostMessageRequests += 1;
        return [];
      },
      callTool,
    });

    const app = page.frameLocator("#shockaudit-frame");
    await expect(app.getByRole("heading", {
      name: "5. Compare explanations",
    })).toBeVisible();
    await app.getByRole("button", { name: "Edit mechanism" }).click();
    await expect(app.getByLabel(/Process mechanism to investigate/u))
      .toHaveValue("It reduces firms’ access to customer data.");
    await app.getByRole("button", {
      name: "Generate study-specific mechanisms",
    }).click();
    const alternativeResult = app.locator("#screen5-alternative-results");
    await expect(alternativeResult.getByRole("heading", {
      name: /Alternative mechanisms/,
    })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(
      "screen5-before-generation.png") });
    await expect(app.getByRole("heading", {
      name: "Competing and complementary mechanisms",
    })).toBeVisible({ timeout: 30_000 });
    await expect(app.locator(".six-mechanism-status h3"))
      .toHaveText("Mechanism comparison saved", {
        timeout: 30_000,
      });
    await expect.poll(() => providerCalls).toBe(3);
    expect(lostStageADelivery).toBe(true);
    const finishSavedAssessment = app.getByRole("button", {
      name: /Finish saved assessment/iu,
    });
    await expect(finishSavedAssessment).toHaveCount(0);
    await expect(app.locator(".six-alert--error")).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(
      "screen5-after-lost-delivery-recovery.png") });

    const navigation = app.getByRole("navigation", {
      name: "ShockAudit screens",
    });
    const sourceCallsBeforeReadOnlyNavigation = sourceCalls;
    await navigation.getByRole("button", {
      name: /Understand the policy/iu,
    }).click();
    await expect(app.getByRole("heading", {
      name: "2. Understand the policy",
    })).toBeVisible();
    await navigation.getByRole("button", {
      name: /Compare explanations/iu,
    }).click();
    await expect(app.getByRole("heading", {
      name: "Competing and complementary mechanisms",
    })).toBeVisible();
    expect(providerCalls).toBe(3);
    expect(sourceCalls).toBe(sourceCallsBeforeReadOnlyNavigation);
    await expect(app.getByRole("heading", {
      name: "Your finalized focal mechanism",
    })).toBeVisible();
    await expect(app.getByRole("heading", {
      name: "Compliance-resource reallocation",
    })).toBeVisible();
    await expect(app.getByRole("heading", {
      name: "Customer trust",
    })).toBeVisible();
    await expect(app.getByRole("heading", {
      name: "Privacy-risk and loss exposure",
    })).toBeVisible();
    await expect(app.getByRole("heading", {
      name: "Authorization friction and product delay",
    })).toBeVisible();
    await expect(app.getByText(
      "Four mechanisms proposed. Evidence checks are complete for zero; four remain to be checked.",
    )).toBeVisible();
    await expect(app.getByText("Compare observable predictions")).toBeVisible();
    await expect(app.getByText("Privacy-related costs and hiring")).toBeVisible();
    await expect(app.getByText(/Complete assessment · saved/u)).toBeVisible();
    await expect(app.getByRole("button", {
      name: "Continue evidence checks",
    })).toHaveCount(0);
    await expect(app.getByRole("button", {
      name: "Generate alternative mechanisms",
    })).toHaveCount(0);
    expect(providerCalls).toBe(3);
    expect(hostMessageRequests).toBe(0);

    const focalAssessment = app.getByText("Focal assessment and evidence");
    await focalAssessment.click();
    await expect(app.locator(".six-focal-summary .six-claim-citation"))
      .toHaveCount(0);
    await expect(app.getByText(
      "Analytical hypothesis: no inspected source is linked to this argument.",
    )).toBeVisible();
    expect(providerCalls).toBe(3);
    await focalAssessment.click();

    await expect(app.getByText("Execution and accounting details"))
      .toHaveCount(0);
    expect(providerCalls).toBe(3);

    const editMechanism = app.getByRole("button", { name: "Edit mechanism" });
    await editMechanism.focus();
    await page.keyboard.press("Enter");
    const mechanismInput = app.getByLabel(/Process mechanism to investigate/u);
    await mechanismInput.fill("Unsaved presentation-check draft.");
    await expect(app.getByText(/Unsaved draft preserved/u)).toBeVisible();
    await app.getByRole("button", { name: "Close editor" }).click();
    await app.getByRole("button", { name: "Edit mechanism" }).click();
    await expect(mechanismInput).toHaveValue("Unsaved presentation-check draft.");
    await app.getByRole("button", { name: "Close editor" }).click();
    expect(providerCalls).toBe(3);

    const accessibility = await new AxeBuilder({ page })
      .include(["#shockaudit-frame", "main"])
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const severeAccessibilityViolations = accessibility.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    );
    await testInfo.attach("screen5-presentation-axe-wcag-a-aa.json", {
      body: JSON.stringify({
        simulatedEvidence: true,
        signedInChatGptEvidence: false,
        violations: accessibility.violations,
        incomplete: accessibility.incomplete,
      }, null, 2),
      contentType: "application/json",
    });
    expect(severeAccessibilityViolations).toEqual([]);

    const reopenedPage = await page.context().newPage();
    try {
      await installMcpAppHost(reopenedPage, {
        appUrl: `${baseUrl}/`,
        initialToolNotifications: [],
        installChatGptCompatibilityBridge: true,
        hostContext: { theme: "dark" },
        initialCompatibilityWidgetState: {
          modelContent: "ShockAudit Screen 5 routing fixture.",
          privateContent: { sixScreenWorkflow: initialPrivate },
        },
        hostModelResponder: () => {
          hostMessageRequests += 1;
          return [];
        },
        callTool,
      });
      const reopenedApp = reopenedPage.frameLocator("#shockaudit-frame");
      await expect(reopenedApp.getByRole("heading", {
        name: "Competing and complementary mechanisms",
      })).toBeVisible();
      await expect(reopenedApp.getByText(/Complete assessment · saved/u))
        .toBeVisible();
      expect(providerCalls).toBe(3);
      expect(hostMessageRequests).toBe(0);
    } finally {
      await reopenedPage.close();
    }

    for (const viewport of [
      { width: 1440, height: 900, name: "screen5-routing-1440x900.png" },
      { width: 1280, height: 800, name: "screen5-routing-1280x800.png" },
      { width: 720, height: 900, name: "screen5-routing-720x900.png" },
    ]) {
      await page.setViewportSize(viewport);
      await app.locator("body").evaluate(() => window.scrollTo(0, 0));
      await expect.poll(async () =>
        await app.locator("body").evaluate((body) =>
          body.scrollWidth <= body.clientWidth
        )
      ).toBe(true);
      const alternativeCards = app.locator(
        '.six-mechanism-comparison > section[aria-label="Generated additional mechanisms"] .six-mechanism-comparison-cards > article',
      );
      const firstBox = await alternativeCards.nth(0).boundingBox();
      const secondBox = await alternativeCards.nth(1).boundingBox();
      expect(firstBox).not.toBeNull();
      expect(secondBox).not.toBeNull();
      if (viewport.width <= 900) {
        expect(secondBox!.y).toBeGreaterThan(firstBox!.y + 20);
      } else {
        expect(Math.abs(secondBox!.y - firstBox!.y)).toBeLessThan(4);
      }
      await page.screenshot({
        path: testInfo.outputPath(
          viewport.name.replace(".png", "-top.png"),
        ),
      });
      await app.getByRole("heading", {
        name: "Alternative mechanisms (4)",
      }).scrollIntoViewIfNeeded();
      await page.screenshot({
        path: testInfo.outputPath(viewport.name),
      });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await app.locator("html").evaluate((root) => {
      (root as HTMLElement).style.zoom = "200%";
    });
    await app.getByRole("heading", {
      name: "Alternative mechanisms (4)",
    }).scrollIntoViewIfNeeded();
    await expect.poll(async () => app.locator("body").evaluate((body) =>
      body.scrollWidth <= body.clientWidth + 1)).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("screen5-routing-200-percent.png"),
    });
    await app.locator("html").evaluate((root) => {
      (root as HTMLElement).style.zoom = "";
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await app.getByRole("heading", {
      name: "Privacy-risk and loss exposure",
    }).scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath("screen5-routing-lower-cards-1440x900.png"),
    });
    await app.getByText("Compare observable predictions")
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath("screen5-routing-predictions-1440x900.png"),
    });
    expect(providerCalls).toBe(3);
  } finally {
    await client.close();
    await server.close();
  }
});
