import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { confirmScopeContract } from "../../src/core/screen01-service";
import {
  beginScreen02InteractionRequest,
} from "../../src/core/screen02-service";
import { restoreScreen02StateEnvelope } from "../../src/core/screen02-state-envelope";
import { buildScreen01StudyContext } from "../../src/core/study-context";
import { decisionKeys } from "../../src/core/scope-types";
import {
  buildScreen02DiscoveryToolInput,
  ShockAuditBridge,
} from "../../src/ui/mcp-bridge";
import Screen02, {
  currentVisibleScreen02Items,
} from "../../src/ui/screen-02/Screen02";
import worker from "../../src/worker/index";

const executionContext = {
  waitUntil: () => undefined,
  passThroughOnException: () => undefined,
};

const env = {
  SHOCKAUDIT_LOCAL_DEV_IN_PROCESS_MCP: "true",
  ASSETS: {
    fetch: async () =>
      new Response('<div id="root"></div>', {
        headers: { "content-type": "text/html" },
      }),
  },
  NOW: () => "2026-08-07T12:00:00.000Z",
  CONNECTOR_FETCH: async () =>
    new Response(
      JSON.stringify({
        count: 1,
        results: [
          {
            title: "Government Manufacturing Reporting Rule",
            type: "Rule",
            abstract:
              "A federal agency adopted new reporting requirements that require covered manufacturers to submit annual compliance and production records beginning in 2022.",
            document_number: "2022-12345",
            html_url:
              "https://www.federalregister.gov/documents/2022/07/01/2022-12345/government-manufacturing-reporting-rule",
            pdf_url:
              "https://www.govinfo.gov/content/pkg/FR-2022-07-01/pdf/2022-12345.pdf",
            publication_date: "2022-07-01",
            effective_on: "2022-09-01",
            agencies: [{ name: "Department of Commerce" }],
          },
        ],
      }),
      { headers: { "content-type": "application/json" } },
    ),
};

function findStudyContext() {
  const sentence =
    "Find a regulatory shock affecting annual profitability among U.S. exchange-listed manufacturing firms with state-level assignment and firm-level analysis from 2017 to 2023.";
  const confirmation = confirmScopeContract({
    revision: 1,
    mode: "find",
    sentence,
    contractSourceSentence: sentence,
    scope: {
      population: "U.S. exchange-listed manufacturing firms",
      assignmentLevel: "State",
      analysisLevel: "Firm",
      geography: "United States",
      industry: "Manufacturing",
      studyPeriod: "2017–2023",
      eventFamily: "Regulation",
      outcomeFamily: "Profitability",
      outcomeFrequency: "Annual",
    },
    knownShock: "",
    resolvedKeys: decisionKeys,
    scopeDirty: false,
  });
  if (!confirmation.ok) throw new Error(confirmation.error);
  return buildScreen01StudyContext(
    confirmation.state,
    confirmation.ambiguities,
  );
}

async function callTool(
  name: string,
  arguments_: Record<string, unknown>,
  id: number,
) {
  const response = await worker.fetch(
    new Request("http://localhost/mcp", {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        host: "localhost",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id,
        method: "tools/call",
        params: { name, arguments: arguments_ },
      }),
    }) as never,
    env as never,
    executionContext as never,
  );
  const body = await response.text();
  const data =
    body
      .split("\n")
      .find((line) => line.startsWith("data: "))
      ?.slice(6) ?? body;
  const payload = JSON.parse(data) as {
    result?: {
      isError?: boolean;
      structuredContent?: Record<string, unknown>;
      content?: Array<{ type?: string; text?: string }>;
      _meta?: Record<string, unknown>;
    };
    error?: unknown;
  };
  if (payload.error || !payload.result) {
    throw new Error(`MCP tool call failed: ${body}`);
  }
  return payload.result;
}

describe("Screen 2 component result transport", () => {
  it.each([
    {
      label: "blank optional criteria",
      requestType: "find-more" as const,
      criteria: [],
    },
    {
      label: "the user's government-initiated condition",
      requestType: "refine" as const,
      criteria: [
        {
          kind: "require" as const,
          text: "initiated by goverment",
        },
      ],
    },
  ])(
    "carries a complete worker-produced session through the direct app response for $label",
    async ({ requestType, criteria }) => {
      const opened = await callTool(
        "open_shockaudit_screen_2",
        {
          studyContext: findStudyContext(),
          runId: `screen02-run-component-${requestType}`,
        },
        1,
      );
      const initial = restoreScreen02StateEnvelope(
        opened.structuredContent?.sessionState,
      );
      if (!initial) throw new Error("Screen 2 did not open.");
      const exactRequest =
        criteria.length === 0
          ? "Find shocks with all optional criteria blank."
          : "Find shocks initiated by goverment.";
      const pending = beginScreen02InteractionRequest(initial, {
        id: `screen02-request-component-${requestType}`,
        requestType,
        exactText: exactRequest,
        criteria,
      });
      const input = buildScreen02DiscoveryToolInput(
        pending,
        requestType,
        exactRequest,
        criteria,
      );
      const directResult = await callTool(
        "discover_shock_options",
        input,
        2,
      );
      const serverSession = restoreScreen02StateEnvelope(
        directResult.structuredContent?.sessionState,
      );
      if (!serverSession) {
        throw new Error("Screen 2 discovery returned no valid session.");
      }

      expect(directResult.isError).not.toBe(true);
      expect(directResult._meta).toBeUndefined();
      expect(serverSession.interaction.pendingRequest).toBeNull();
      expect(serverSession.revision).toBe(pending.revision + 1);
      expect(
        serverSession.interaction.searchRounds.at(-1)
          ?.preferenceCriteriaIds,
      ).toStrictEqual(input.criteria.map((criterion) => criterion.id));
      const visibleItems = currentVisibleScreen02Items(serverSession);
      expect(visibleItems.length).toBeGreaterThan(0);
      expect(
        visibleItems.some(
          (item) =>
            item.title === "Government Manufacturing Reporting Rule",
        ),
      ).toBe(true);

      const callServerTool = async () => directResult;
      const bridge = new ShockAuditBridge();
      (
        bridge as unknown as {
          app: {
            getHostCapabilities: () => { serverTools: object };
            callServerTool: typeof callServerTool;
          };
        }
      ).app = {
        getHostCapabilities: () => ({ serverTools: {} }),
        callServerTool,
      };

      await expect(
        bridge.discoverScreen02Options(
          pending,
          requestType,
          exactRequest,
          criteria,
        ),
      ).resolves.toStrictEqual(serverSession);

      const html = renderToStaticMarkup(
        createElement(Screen02, {
          session: serverSession,
          hostView: {
            connected: true,
            embedded: true,
            displayMode: "fullscreen",
            canFullscreen: true,
            canSendMessage: true,
          },
          researchNotice: null,
          onSelect: () => undefined,
          onReject: () => undefined,
          onLock: () => undefined,
          onUnlock: () => undefined,
          onRequestSearch: () => undefined,
          onBack: () => undefined,
          onReset: () => undefined,
          onRequestFullscreen: () => undefined,
          initialReviewedItemId: visibleItems[0]?.id ?? null,
        }),
      );
      const candidateTitle = html.indexOf(
        "Government Manufacturing Reporting Rule",
      );
      const candidateRowStart = html.lastIndexOf(
        'class="s2-result-row',
        candidateTitle,
      );
      const candidateRowEnd = html.indexOf("</button>", candidateTitle);
      expect(candidateRowStart).toBeGreaterThanOrEqual(0);
      expect(candidateRowEnd).toBeGreaterThan(candidateRowStart);
      expect(candidateTitle).toBeGreaterThan(candidateRowStart);
      expect(candidateTitle).toBeLessThan(candidateRowEnd);
      expect(html).not.toContain(
        "candidate search returned no complete Screen 2 state",
      );
    },
  );

  it("summarizes the latest empty round instead of the cumulative ledger", async () => {
    const studyContext = findStudyContext();
    const opened = await callTool(
      "open_shockaudit_screen_2",
      {
        studyContext,
        runId: "screen02-run-component-summary-scope",
      },
      3,
    );
    const initial = restoreScreen02StateEnvelope(
      opened.structuredContent?.sessionState,
    );
    if (!initial) throw new Error("Screen 2 did not open.");
    const exactRequest = "Find shocks with all optional criteria blank.";
    const pending = beginScreen02InteractionRequest(initial, {
      id: "screen02-request-component-summary-scope",
      requestType: "find-more",
      exactText: exactRequest,
      criteria: [],
    });
    const discovery = await callTool(
      "discover_shock_options",
      buildScreen02DiscoveryToolInput(
        pending,
        "find-more",
        exactRequest,
        [],
      ),
      4,
    );
    const discovered = restoreScreen02StateEnvelope(
      discovery.structuredContent?.sessionState,
    );
    if (!discovered) {
      throw new Error("Screen 2 discovery returned no valid session.");
    }

    const restoration = await callTool(
      "assess_shock_options",
      {
        studyContext,
        sessionState: discovery.structuredContent?.sessionState,
        expectedRevision: discovered.revision,
        requestType: "user-source",
        exactRequest:
          "Restore the completed session without adding candidates.",
        interpretationSource: "researcher-structured",
        proposals: [],
      },
      5,
    );
    const restored = restoreScreen02StateEnvelope(
      restoration.structuredContent?.sessionState,
    );
    if (!restored) {
      throw new Error("Screen 2 restoration returned no valid session.");
    }
    const latestRound = restored.interaction.searchRounds.at(-1);
    const summary = restoration.structuredContent?.sessionSummary as
      | {
          latestRoundId?: string;
          stage?: string;
          currentItems?: unknown[];
          coverageStatus?: string;
        }
      | undefined;

    expect(discovered.items.length).toBeGreaterThan(0);
    expect(latestRound?.itemIdsRetained).toStrictEqual([]);
    expect(latestRound?.manifest.coverage.status).toBe("no-results");
    expect(restored.searchManifest.coverage.status).not.toBe(
      latestRound?.manifest.coverage.status,
    );
    expect(summary).toMatchObject({
      latestRoundId: latestRound?.id,
      stage: latestRound?.stage,
      currentItems: [],
      coverageStatus: latestRound?.manifest.coverage.status,
    });
  });
});
