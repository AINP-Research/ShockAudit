import {
  expect,
  test,
  type FrameLocator,
  type Page,
} from "@playwright/test";
import type { Server } from "node:http";

import { restoreScreen02StateEnvelope } from "../../src/core/screen02-state-envelope";
import type {
  Screen02Item,
  Screen02SearchRound,
  Screen02Session,
} from "../../src/core/screen02-types";
import { fieldKeys } from "../../src/core/scope-types";
import {
  callMcpTool,
  installMcpAppHost,
  type HostToolNotification,
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

const preliminaryAssessmentVersion =
  "screen02-preliminary-assessment-v1";

const gamingSentence =
  "Find a regulatory shock affecting public video gaming firms in the United States from 2014 to 2016 that may influence annual innovation.";

const gamingConfirmArguments: JsonObject = {
  revision: 7,
  mode: "find",
  sentence: gamingSentence,
  contractSourceSentence: gamingSentence,
  scope: {
    population: "Public video gaming firms",
    assignmentLevel: "Country",
    analysisLevel: "Firm",
    geography: "United States",
    industry: "Video gaming",
    studyPeriod: "2014–2016",
    eventFamily: "Regulation",
    outcomeFamily: "Innovation",
    outcomeFrequency: "Annual",
  },
  knownShock: "",
  resolvedKeys: [...fieldKeys],
  scopeDirty: false,
};

const privacySentence =
  "Find a regulatory shock with state-level assignment affecting U.S. public technology firms from 2018 to 2021 that may influence annual innovation.";

const privacyConfirmArguments: JsonObject = {
  revision: 7,
  mode: "find",
  sentence: privacySentence,
  contractSourceSentence: privacySentence,
  scope: {
    population: "U.S. public technology firms",
    assignmentLevel: "State",
    analysisLevel: "Firm",
    geography: "United States",
    industry: "Technology",
    studyPeriod: "2018–2021",
    eventFamily: "Regulation",
    outcomeFamily: "Innovation",
    outcomeFrequency: "Annual",
  },
  knownShock: "",
  resolvedKeys: [...fieldKeys],
  scopeDirty: false,
};

const auditSentence =
  "Audit whether the California Consumer Privacy Act changed annual innovation among U.S. public technology firms with state-level assignment and firm-level analysis from 2015 to 2023.";

const auditConfirmArguments: JsonObject = {
  revision: 7,
  mode: "audit",
  sentence: auditSentence,
  contractSourceSentence: auditSentence,
  scope: {
    population: "U.S. public technology firms",
    assignmentLevel: "State",
    analysisLevel: "Firm",
    geography: "United States",
    industry: "Technology",
    studyPeriod: "2015–2023",
    eventFamily: "Regulation",
    outcomeFamily: "Innovation",
    outcomeFrequency: "Annual",
  },
  knownShock: "California Consumer Privacy Act",
  resolvedKeys: [...fieldKeys],
  scopeDirty: false,
};

const bannedPrimaryWorkflowTerms = [
  "Applicability to the Screen 1 target",
  "Carry into Screen 3",
  "Screen 1 target population",
  "semantic review",
  "native candidate",
  "fixed gate",
  "AI-rubric",
  "Tier 6",
  "component score",
  "parent round",
  "run ID",
  "revision",
  "handoff",
] as const;

function screen02SessionFromResult(result: McpCallToolResult) {
  const session = restoreScreen02StateEnvelope(
    result.structuredContent?.sessionState,
  );
  if (!session) {
    throw new Error(
      `Expected a complete Screen 2 session, received ${JSON.stringify(result)}`,
    );
  }
  return session;
}

function latestNativeResultSet(result: McpCallToolResult): {
  session: Screen02Session;
  round: Screen02SearchRound;
  items: Screen02Item[];
} {
  const session = screen02SessionFromResult(result);
  const round = session.interaction.searchRounds.at(-1);
  if (
    !round ||
    round.stage !== "native-retrieval" ||
    round.itemIdsRetained.length === 0
  ) {
    throw new Error("Expected a nonempty native Screen 2 result round.");
  }
  const items = round.itemIdsRetained.map((itemId) => {
    const item = session.items.find((candidate) => candidate.id === itemId);
    if (!item) throw new Error(`Missing native candidate ${itemId}.`);
    return item;
  });
  return { session, round, items };
}

function mechanismPhrase(title: string) {
  const normalized = title.toLocaleLowerCase("en-US");
  if (normalized.includes("consumer privacy act")) {
    return "consumer data rights, product consent flows, and data-governance work";
  }
  if (normalized.includes("biometric")) {
    return "biometric consent, retention, and deletion controls in digital products";
  }
  if (normalized.includes("connected device")) {
    return "unique credentials and vulnerability-response engineering";
  }
  if (normalized.includes("portability")) {
    return "export interfaces, interoperability, and documented transfer controls";
  }
  if (normalized.includes("accessibility")) {
    return "accessible controls and reusable interface engineering";
  }
  if (normalized.includes("privacy safeguards")) {
    return "player-account governance and personalization constraints";
  }
  if (normalized.includes("energy labeling")) {
    return "efficiency engineering and component-selection requirements";
  }
  if (normalized.includes("children")) {
    return "age assurance, parental consent, and child-directed feature controls";
  }
  if (normalized.includes("purchase notice")) {
    return "checkout disclosures, refund design, and monetization experiments";
  }
  return "digital storefront disclosure duties and information-design changes";
}

function compactAssessmentFor(
  item: Screen02Item,
  outcomeFamily: string,
  index: number,
) {
  const sourceId = item.sources[0]?.id;
  if (!sourceId) {
    throw new Error(`Candidate ${item.id} has no source for assessment.`);
  }
  const mechanism = mechanismPhrase(item.title);
  return {
    itemId: item.id,
    judgment:
      index === 0 ? "promising-to-verify" : "worth-exploring",
    studyFit: `${item.title} is a dated, source-backed ${item.mode === "audit" ? "match" : "event lead"} within the confirmed geography, study period, and regulatory scope.`,
    affectedPopulation: `The attached record for ${item.title} describes covered technology products, services, operators, or firms whose exact organization-level eligibility still needs mapping.`,
    outcomeMechanism: `${item.title} could affect ${outcomeFamily} through ${mechanism}, although the direction and size of any response remain unverified.`,
    mainConcern: `The controlling coverage rule, operative date, and firm-level exposure linkage for ${item.title} are not yet verified.`,
    evidenceSourceIds: [sourceId],
    nextChecks: [
      `Verify the controlling provision and operative date for ${item.title}.`,
      `Map the documented coverage of ${item.title} to focal public firms.`,
    ],
  };
}

function compactAssessmentArguments(
  result: McpCallToolResult,
  exactRequest: string,
  assessments: unknown[],
  options?: {
    rootNativeRoundId?: string;
    assessmentParentRoundId?: string;
  },
): JsonObject {
  const session = screen02SessionFromResult(result);
  const latestRound = session.interaction.searchRounds.at(-1);
  if (!latestRound) throw new Error("Screen 2 has no assessment parent.");
  const rootNativeRoundId =
    options?.rootNativeRoundId ??
    (latestRound.stage === "preliminary-assessment"
      ? latestRound.rootNativeRoundId
      : latestRound.id);
  if (!rootNativeRoundId) {
    throw new Error("Screen 2 has no root native assessment round.");
  }
  return {
    assessmentVersion: preliminaryAssessmentVersion,
    studyContext: session.screen01Baseline,
    sessionState: result.structuredContent?.sessionState,
    expectedRevision: session.revision,
    exactRequest,
    rootNativeRoundId,
    assessmentParentRoundId:
      options?.assessmentParentRoundId ?? latestRound.id,
    assessments,
  };
}

async function notifyToolResult(
  page: Page,
  label: string,
  args: JsonObject,
  result: McpCallToolResult,
) {
  await page.evaluate(
    async (entry) => {
      const notify = (
        window as unknown as {
          __shockAuditNotifyToolResult: (
            notification: HostToolNotification,
          ) => Promise<void>;
        }
      ).__shockAuditNotifyToolResult;
      await notify(entry);
    },
    { label, arguments: args, result },
  );
}

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

async function hostMessageText(page: Page, index: number) {
  return page.evaluate((messageIndex) => {
    const requests = (
      window as unknown as {
        __shockAuditHostState: {
          messageRequests: Array<{
            params?: {
              content?: Array<{ type?: string; text?: string }>;
            };
          }>;
        };
      }
    ).__shockAuditHostState.messageRequests;
    return (requests[messageIndex]?.params?.content ?? [])
      .map((block) => block.text ?? "")
      .join("\n");
  }, index);
}

async function hostToolCalls(page: Page) {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __shockAuditHostState: {
            toolCalls: Array<{ name: string; arguments: JsonObject }>;
          };
        }
      ).__shockAuditHostState.toolCalls,
  );
}

async function latestScreen03Handoff(page: Page) {
  return page.evaluate(() => {
    const requests = (
      window as unknown as {
        __shockAuditHostState: {
          modelContextRequests: Array<{ params?: unknown }>;
        };
      }
    ).__shockAuditHostState.modelContextRequests;

    function find(value: unknown): Record<string, unknown> | null {
      if (!value || typeof value !== "object") return null;
      if (
        !Array.isArray(value) &&
        (value as Record<string, unknown>).schemaVersion ===
          "screen-03-handoff-context-v1"
      ) {
        return value as Record<string, unknown>;
      }
      for (const child of Array.isArray(value)
        ? value
        : Object.values(value as Record<string, unknown>)) {
        const nested = find(child);
        if (nested) return nested;
      }
      return null;
    }

    for (let index = requests.length - 1; index >= 0; index -= 1) {
      const handoff = find(requests[index]?.params);
      if (handoff) return handoff;
    }
    return null;
  });
}

async function assertNoTechnicalPrimaryCopy(app: FrameLocator) {
  const visibleText = await app.locator("body").innerText();
  for (const term of bannedPrimaryWorkflowTerms) {
    expect(visibleText.toLocaleLowerCase("en-US")).not.toContain(
      term.toLocaleLowerCase("en-US"),
    );
  }
}

async function assertCompactDetail(
  app: FrameLocator,
  outcomeFamily: string,
) {
  await expect(
    app.getByTestId("screen02-preliminary-judgment"),
  ).toBeVisible();
  await expect(app.getByTestId("screen02-study-fit")).toContainText(
    "Study fit",
  );
  await expect(
    app.getByTestId("screen02-affected-population"),
  ).toContainText("Who appears affected");
  await expect(
    app.getByTestId("screen02-outcome-pathway"),
  ).toContainText(`How it may affect ${outcomeFamily}`);
  await expect(app.getByTestId("screen02-main-concern")).toContainText(
    "Main concern",
  );
  await expect(app.getByTestId("screen02-next-checks")).toContainText(
    "What to check next",
  );
  await expect(app.getByTestId("screen02-evidence-basis")).toContainText(
    "Evidence",
  );
}

async function openScreen02Host(
  page: Page,
  confirmArguments: JsonObject,
  hostCapabilities?: JsonObject,
) {
  const confirmationResult = await callMcpTool(
    baseUrl,
    "confirm_scope_contract",
    confirmArguments,
  );
  expect(confirmationResult.isError).not.toBe(true);
  expect(confirmationResult.structuredContent).toMatchObject({ ok: true });
  const initialToolNotifications: HostToolNotification[] = [
    {
      label: "confirmed-screen-01",
      arguments: confirmArguments,
      result: confirmationResult,
    },
  ];
  if (confirmArguments.mode === "audit") {
    const studyContext = confirmationResult.structuredContent?.studyContext;
    if (!studyContext || typeof studyContext !== "object") {
      throw new Error("Audit confirmation did not return a study context.");
    }
    const openArguments: JsonObject = {
      studyContext,
      runId: "browser-audit-acceptance-run",
    };
    const openResult = await callMcpTool(
      baseUrl,
      "open_shockaudit_screen_2",
      openArguments,
    );
    expect(openResult.isError).not.toBe(true);
    initialToolNotifications.push({
      label: "opened-audit-screen-02",
      arguments: openArguments,
      result: openResult,
    });
  }
  let latestNativeResult: McpCallToolResult | null = null;
  await installMcpAppHost(page, {
    appUrl: `${baseUrl}/`,
    ...(hostCapabilities ? { hostCapabilities } : {}),
    initialToolNotifications,
    callTool: async (name, args) => {
      const result = await callMcpTool(baseUrl, name, args);
      if (name === "discover_shock_options") latestNativeResult = result;
      return result;
    },
  });
  const app = page.frameLocator("#shockaudit-frame");
  if (confirmArguments.mode === "audit") {
    await expect(app.getByTestId("screen02-workspace")).toBeVisible();
    return {
      app,
      latestNativeResult: () => latestNativeResult,
    };
  }
  await expect(
    app.getByRole("button", { name: "Continue to shock feasibility" }),
  ).toBeVisible();
  await app
    .getByRole("button", { name: "Continue to shock feasibility" })
    .click();
  await expect(app.getByTestId("screen02-workspace")).toBeVisible();
  return {
    app,
    latestNativeResult: () => latestNativeResult,
  };
}

async function requireCapturedNativeResult(
  getResult: () => McpCallToolResult | null,
) {
  await expect.poll(() => getResult() !== null).toBe(true);
  const result = getResult();
  if (!result) throw new Error("The host did not capture native discovery.");
  return result;
}

async function chooseFindCandidateAndLock(
  page: Page,
  app: FrameLocator,
  card: ReturnType<FrameLocator["locator"]>,
) {
  await card.locator("button.s2-result-row").click();
  const choose = app
    .locator("#s2-candidate-detail")
    .getByRole("button", { name: "Choose this shock" });
  await expect(choose).toBeEnabled();
  await choose.click();
  const continueButton = app.getByRole("button", {
    name: "Continue: Verify the event",
  });
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
  await expect(app.getByTestId("screen02-research-notice")).toContainText(
    "ready for event verification",
  );
  await expect.poll(() => latestScreen03Handoff(page)).not.toBeNull();
  const handoff = await latestScreen03Handoff(page);
  expect(handoff).toMatchObject({
    schemaVersion: "screen-03-handoff-context-v1",
    fullHandoffSchemaVersion: "screen-02-to-screen-03-v1",
    sourceScreen: "screen-02",
    destinationScreen: "screen-03",
    producerAppVersion: "0.2.20",
    mode: "find",
    lockedEvent: {
      preliminaryAssessment: {
        schemaVersion: preliminaryAssessmentVersion,
      },
    },
    historySummary: { fullHistoryLocation: "sessionState" },
  });
}

// Historical v0.2.20 discover/assess evidence is retained as source, but its
// legacy tool catalog must not be run against the canonical v2.1 fixture.
test.describe.skip("Historical Screen 2 v0.2.20 MCP Apps iframe acceptance — legacy catalog fixture required", () => {
  test.describe.configure({ mode: "serial" });

  test("Find assesses five U.S. video-gaming candidates independently and retries only the failed card", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const { app, latestNativeResult } = await openScreen02Host(
      page,
      gamingConfirmArguments,
    );

    await app.getByTestId("screen02-search-button").click();
    const cards = app.getByTestId("screen02-result-card");
    await expect(cards).toHaveCount(5);
    const nativeResult = await requireCapturedNativeResult(latestNativeResult);
    const native = latestNativeResultSet(nativeResult);
    expect(native.items).toHaveLength(5);
    expect(native.items.map((item) => item.title).join("\n")).not.toMatch(
      /casino|fishery|PlayStation|Xbox/i,
    );
    expect(
      native.items.every(
        (item) => item.sources.length > 0 && item.sourceSummary.uniqueSourceCount > 0,
      ),
    ).toBe(true);

    await expect.poll(() => hostMessageCount(page)).toBe(1);
    const firstPrompt = await hostMessageText(page, 0);
    expect(firstPrompt).toContain("assess_shock_options");
    expect(firstPrompt).toContain(preliminaryAssessmentVersion);
    for (const item of native.items) expect(firstPrompt).toContain(item.id);
    expect(firstPrompt).toContain("Do not resubmit proposals");
    expect(firstPrompt).not.toContain(native.items[0]!.description);

    const firstCard = cards.filter({ hasText: native.items[0]!.title });
    await firstCard.locator("button.s2-result-row").click();
    await expect(app.getByTestId("screen02-assessment-neutral")).toContainText(
      /Preliminary assessment (?:in progress|not completed)/,
    );
    await expect(
      app
        .locator("#s2-candidate-detail")
        .getByRole("button", { name: "Choose this shock" }),
    ).toBeEnabled();
    await expect(app.getByTestId("screen02-search-button")).toBeEnabled();

    const failedItem = native.items.at(-1)!;
    const compactEntries = native.items.map((item, index) =>
      compactAssessmentFor(item, "Innovation", index),
    );
    const partialEntries = compactEntries.map((entry) =>
      entry.itemId === failedItem.id
        ? {
            itemId: entry.itemId,
            judgment: entry.judgment,
            studyFit: "Too short",
          }
        : entry,
    );
    const partialArgs = compactAssessmentArguments(
      nativeResult,
      "Assess every displayed gaming candidate independently.",
      partialEntries,
    );
    const partialResult = await callMcpTool(
      baseUrl,
      "assess_shock_options",
      partialArgs,
    );
    expect(partialResult.isError).not.toBe(true);
    const partialSession = screen02SessionFromResult(partialResult);
    const partialRound = partialSession.interaction.searchRounds.at(-1)!;
    expect(partialRound.assessmentResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemId: failedItem.id,
          status: "needs-retry",
        }),
        ...native.items.slice(0, -1).map((item) =>
          expect.objectContaining({ itemId: item.id, status: "assessed" }),
        ),
      ]),
    );
    const acceptedBeforeRetry = new Map(
      partialSession.items
        .filter(
          (item) => item.id !== failedItem.id && item.preliminaryAssessment,
        )
        .map((item) => [item.id, item.preliminaryAssessment]),
    );
    await notifyToolResult(
      page,
      "compact-partial-gaming-assessment",
      partialArgs,
      partialResult,
    );

    const failedCard = cards.filter({ hasText: failedItem.title });
    await expect(
      failedCard.getByRole("button", { name: "Retry assessment", exact: true }),
    ).toBeVisible();
    await firstCard.locator("button.s2-result-row").click();
    await assertCompactDetail(app, "Innovation");
    await expect(app.getByTestId("screen02-study-fit")).toContainText(
      native.items[0]!.title,
    );

    await failedCard
      .getByRole("button", { name: "Retry assessment", exact: true })
      .click();
    await expect.poll(() => hostMessageCount(page)).toBe(2);
    const retryPrompt = await hostMessageText(page, 1);
    expect(retryPrompt).toContain(failedItem.id);
    for (const accepted of native.items.slice(0, -1)) {
      expect(retryPrompt).not.toContain(accepted.id);
    }

    const retryEntry = compactEntries.find(
      (entry) => entry.itemId === failedItem.id,
    )!;
    const retryArgs = compactAssessmentArguments(
      partialResult,
      "Retry only the failed gaming candidate assessment.",
      [retryEntry],
      {
        rootNativeRoundId: native.round.id,
        assessmentParentRoundId: partialRound.id,
      },
    );
    const retryResult = await callMcpTool(
      baseUrl,
      "assess_shock_options",
      retryArgs,
    );
    expect(retryResult.isError).not.toBe(true);
    const completedSession = screen02SessionFromResult(retryResult);
    const completedRound = completedSession.interaction.searchRounds.at(-1)!;
    expect(completedRound.assessmentResults?.every(
      (result) => result.status === "assessed",
    )).toBe(true);
    expect(completedRound.itemIdsRetained).toEqual(
      native.round.itemIdsRetained,
    );
    for (const [itemId, assessment] of acceptedBeforeRetry) {
      expect(
        completedSession.items.find((item) => item.id === itemId)
          ?.preliminaryAssessment,
      ).toEqual(assessment);
    }
    await notifyToolResult(
      page,
      "compact-completed-gaming-assessment",
      retryArgs,
      retryResult,
    );
    await expect(app.getByTestId("screen02-research-notice")).toContainText(
      "Preliminary assessments are complete",
    );

    for (const item of native.items) {
      const card = cards.filter({ hasText: item.title });
      await card.locator("button.s2-result-row").click();
      await assertCompactDetail(app, "Innovation");
      await expect(app.getByTestId("screen02-study-fit")).toContainText(
        item.title,
      );
    }
    await assertNoTechnicalPrimaryCopy(app);
    await chooseFindCandidateAndLock(page, app, firstCard);
    expect(pageErrors).toEqual([]);
  });

  test("Find uses a distinct privacy and Innovation assessment for each technology candidate", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const { app, latestNativeResult } = await openScreen02Host(
      page,
      privacyConfirmArguments,
    );
    await app.getByTestId("screen02-search-button").click();
    const cards = app.getByTestId("screen02-result-card");
    await expect(cards).toHaveCount(2);
    const nativeResult = await requireCapturedNativeResult(latestNativeResult);
    const native = latestNativeResultSet(nativeResult);
    expect(native.items).toHaveLength(2);
    expect(native.items.map((item) => item.title)).toEqual(
      expect.arrayContaining([
        "California Consumer Privacy Act",
        "California Security of Connected Devices Law",
      ]),
    );
    const discoveryCall = (await hostToolCalls(page)).find(
      (call) => call.name === "discover_shock_options",
    );
    expect(discoveryCall?.arguments.resultLimit).toBe(10);

    await expect.poll(() => hostMessageCount(page)).toBe(1);
    const entries = native.items.map((item, index) =>
      compactAssessmentFor(item, "Innovation", index),
    );
    const mechanisms = entries.map((entry) => entry.outcomeMechanism);
    expect(new Set(mechanisms).size).toBe(entries.length);
    expect(mechanisms.join("\n")).toMatch(
      /consumer data rights|unique credentials/i,
    );
    const assessmentArgs = compactAssessmentArguments(
      nativeResult,
      "Assess every displayed privacy and technology candidate.",
      entries,
    );
    const assessmentResult = await callMcpTool(
      baseUrl,
      "assess_shock_options",
      assessmentArgs,
    );
    expect(assessmentResult.isError).not.toBe(true);
    const assessed = screen02SessionFromResult(assessmentResult);
    expect(
      assessed.items
        .filter((item) => native.round.itemIdsRetained.includes(item.id))
        .map((item) => item.preliminaryAssessment?.outcomeMechanism),
    ).toEqual(expect.arrayContaining(mechanisms));
    await notifyToolResult(
      page,
      "compact-privacy-assessment",
      assessmentArgs,
      assessmentResult,
    );
    await expect(app.getByTestId("screen02-research-notice")).toContainText(
      "Preliminary assessments are complete",
    );

    for (const item of native.items) {
      const card = cards.filter({ hasText: item.title });
      await card.locator("button.s2-result-row").click();
      await assertCompactDetail(app, "Innovation");
      await expect(app.getByTestId("screen02-outcome-pathway")).toContainText(
        mechanismPhrase(item.title),
      );
    }
    await assertNoTechnicalPrimaryCopy(app);
    await chooseFindCandidateAndLock(
      page,
      app,
      cards.filter({ hasText: "California Consumer Privacy Act" }),
    );
    expect(pageErrors).toEqual([]);
  });

  test("Audit resolves the exact CCPA anchor, assesses it, and emits the same v1 handoff", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const { app, latestNativeResult } = await openScreen02Host(
      page,
      auditConfirmArguments,
    );
    await expect(
      app.getByText("California Consumer Privacy Act", { exact: true }).first(),
    ).toBeVisible();
    await app.getByTestId("screen02-audit-search-button").click();
    await expect(app.getByTestId("screen02-audit-dossier")).toBeVisible();
    await expect(app.getByTestId("screen02-audit-dossier")).toContainText(
      "Identity evidence located",
    );
    const nativeResult = await requireCapturedNativeResult(latestNativeResult);
    const native = latestNativeResultSet(nativeResult);
    expect(native.session.mode).toBe("audit");
    expect(native.items.length).toBeGreaterThan(0);
    expect(
      native.items.every(
        (item) =>
          item.mode === "audit" &&
          item.anchorShock === "California Consumer Privacy Act" &&
          item.sources.length > 0,
      ),
    ).toBe(true);
    expect(native.items.map((item) => item.title).join("\n")).toContain(
      "California Consumer Privacy Act",
    );

    await expect.poll(() => hostMessageCount(page)).toBe(1);
    const entries = native.items.map((item, index) =>
      compactAssessmentFor(item, "Innovation", index),
    );
    const assessmentArgs = compactAssessmentArguments(
      nativeResult,
      "Assess the exact known-shock identity match.",
      entries,
    );
    const assessmentResult = await callMcpTool(
      baseUrl,
      "assess_shock_options",
      assessmentArgs,
    );
    expect(assessmentResult.isError).not.toBe(true);
    await notifyToolResult(
      page,
      "compact-ccpa-audit-assessment",
      assessmentArgs,
      assessmentResult,
    );
    await expect(app.getByTestId("screen02-research-notice")).toContainText(
      "Preliminary assessments are complete",
    );
    await assertCompactDetail(app, "Innovation");
    await expect(app.getByTestId("screen02-outcome-pathway")).toContainText(
      "consumer data rights",
    );
    await assertNoTechnicalPrimaryCopy(app);

    const confirmShock = app.getByRole("button", {
      name: "This is my shock",
    });
    await expect(confirmShock).toBeEnabled();
    await confirmShock.click();
    const continueButton = app.getByRole("button", {
      name: "Continue: Verify the event",
    });
    await expect(continueButton).toBeEnabled();
    await continueButton.click();
    await expect(app.getByTestId("screen02-research-notice")).toContainText(
      "ready for event verification",
    );
    await expect.poll(() => latestScreen03Handoff(page)).not.toBeNull();
    expect(await latestScreen03Handoff(page)).toMatchObject({
      schemaVersion: "screen-03-handoff-context-v1",
      fullHandoffSchemaVersion: "screen-02-to-screen-03-v1",
      sourceScreen: "screen-02",
      destinationScreen: "screen-03",
      producerAppVersion: "0.2.20",
      mode: "audit",
      lockedEvent: {
        preliminaryAssessment: {
          schemaVersion: preliminaryAssessmentVersion,
          judgment: expect.stringMatching(
            /promising-to-verify|worth-exploring/,
          ),
        },
      },
      historySummary: { fullHistoryLocation: "sessionState" },
    });
    expect(pageErrors).toEqual([]);
  });

  test("an AI-incapable host shows one global fallback and keeps factual screening useful without a finished handoff", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const { app } = await openScreen02Host(page, gamingConfirmArguments, {
      serverTools: {},
      logging: {},
    });
    await app.getByTestId("screen02-search-button").click();
    const cards = app.getByTestId("screen02-result-card");
    await expect(cards).toHaveCount(5);
    const fallback = app.getByTestId("screen02-research-notice");
    await expect(fallback).toHaveCount(1);
    await expect(fallback).toContainText(
      "The preliminary assessment is unavailable in this view",
    );
    await expect(fallback).toContainText("not finished assessments");
    await expect(app.getByText("Assessment unavailable")).toHaveCount(0);
    await expect(app.getByTestId("screen02-ai-review-button")).toHaveCount(0);
    expect(await hostMessageCount(page)).toBe(0);

    const firstCard = cards.first();
    await expect(firstCard).toContainText("Official documentation");
    await expect(firstCard).toContainText(/Rule|Standards|Requirements/);
    await firstCard.locator("button.s2-result-row").click();
    await expect(app.getByTestId("screen02-assessment-neutral")).toContainText(
      "Preliminary assessment not completed",
    );
    await expect(
      app.locator("#s2-candidate-detail").getByRole("link").first(),
    ).toBeVisible();
    const choose = app
      .locator("#s2-candidate-detail")
      .getByRole("button", { name: "Choose this shock" });
    await expect(choose).toBeEnabled();
    await expect(app.getByTestId("screen02-search-button")).toBeEnabled();
    await choose.click();
    await expect(
      app.getByRole("button", { name: "Continue: Verify the event" }),
    ).toBeDisabled();
    await expect(app.getByText("Assessment unavailable")).toHaveCount(0);
    await assertNoTechnicalPrimaryCopy(app);
    expect(pageErrors).toEqual([]);
  });
});
